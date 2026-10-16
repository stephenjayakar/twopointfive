// LOADOUT LOOK: the whole way in on the REAL page — start card ▸ Missions ▸ loadout ▸ Deploy ▸ the staged run — in headless Chromium on the SOFTWARE WebGPU
// adapter (SwiftShader, no GPU; page-look.cjs is the general tool and says what that adapter cannot do), driven the way a player drives it: real key presses and
// real clicks against the page's own listeners. What the fake-DOM probes (tools/qa/loadout-probes.ts, missions-probes.ts, kit-probes.ts) cannot see: the three
// screens in the BUNDLE, laid out and drawn; whose key a key is (Esc must step back one screen and never start the game under the cards); Deploy as the page
// load it is, and the run it lands in wearing what the screen showed.
//   node tools/qa/loadout-look.cjs <outDir> [mission id, default room-clear-four]     env: PORT (the dev server's, default 5199) · SIZE (default 1280x720) · ONLY=flow,solo
// Two pages, one at a time (about seven minutes: four boots at a minute and a half each), PASS / FAIL lines, stills beside a report.json, exit 1 on a FAIL or a page error:
//   flow   the start card ▸ Missions (still 1) ▸ Enter on the mission = its loadout, the list gone (still 2) ▸ by the keys alone to a teammate's card, one stun
//          canister more and another suit (still 3) ▸ Esc = the list again on the same row ▸ Esc = the start card, nothing started ▸ in again, the team to
//          three, a slot clicked (still 4) ▸ Deploy = a page load of the mission's URL with squad=3 ▸ the run: three teammates, the squad's stun and charge
//          count the screen showed, the suit on the man (still 5, three frames drawn)
//   solo   ?loadout=solo-night: the solo night's loadout over the start card (still 6): every size but solo greyed, your own card; pistol only and a suit;
//          Deploy loads ?solo — the plain night straight in, no start card, no rifle on the player, the suit on him (still 7)
// The stills are the page as composited: the screens are HTML over the canvas, so they are what a GPU would show; the 3D frame under and after them is the
// software adapter's (slow, and not the look of the renderer on a real GPU).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'loadout-look', ID = process.argv[3] || 'room-clear-four';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1280x720').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;   // (page-look.cjs: the smoke solver's pipelines on SwiftShader)
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/`, Q = 'paused&quality=verylow&mute&noslots&cards';   // (noslots: this walk steps the free rows — one more stun canister on a full man; the pouches rule has its own look, pouch-look.cjs)

const report = { id: ID, checks: [], errors: [], noise: 0 };
const noiseOf = {};
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page, name) {
  let load = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) load++; });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error') return; if (/Failed to load resource/.test(x)) return; const k = `${name}/${load}`;
    if (NOISE.test(x) && (noiseOf[k] ?? 0) < NOISE_MAX) { noiseOf[k] = (noiseOf[k] ?? 0) + 1; report.noise++; } else report.errors.push(`${name} console: ${x.slice(0, 400)}`); });
  page.on('pageerror', x => report.errors.push(`${name} pageerror: ${String(x && x.stack || x).slice(0, 600)}`));
}
// in the page: what is up, and what the loadout screen shows
const STATE = () => {
  const r = document.getElementById('loadout'), L = document.getElementById('missions'), txt = s => r?.querySelector(s)?.textContent ?? null;
  const fits = e => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5; };
  const c = r?.querySelector('.lo-card'), rows = r?.querySelector('.lo-body') ?? c;   // (the rows scroll inside the card; the card itself never does)
  return { loadout: !!r, list: !!L?.classList.contains('on'), listOn: L?.querySelector('.mrow.sel')?.getAttribute('data-mission') ?? null, listBtn: L?.querySelector('.mgo')?.textContent ?? null,
    menu: window.__menu?.mode ?? null, time: window.__game?.time ?? null, search: location.search,
    title: txt('.lo-title'), size: [...(r?.querySelectorAll('.lo-size.on') ?? [])].map(b => b.getAttribute('data-squad')).join(','), off: [...(r?.querySelectorAll('.lo-size.off') ?? [])].map(b => b.getAttribute('data-squad')).join(','),
    note: txt('.lo-note'), pool: txt('.lo-pool'), deploy: txt('[data-act="deploy"]'), member: r?.querySelector('.lo-kit')?.getAttribute('data-member') ?? null, cardName: txt('.lo-kit .kc-title'),
    slots: [...(r?.querySelectorAll('.lo-slot') ?? [])].map(s => `${s.classList.contains('in') ? '+' : '-'}${s.querySelector('.lo-name')?.textContent}${s.classList.contains('pick') ? '*' : ''}`),
    sums: [...(r?.querySelectorAll('.lo-slot .lo-sum') ?? [])].map(s => s.textContent), selRow: r?.querySelector('[data-row].sel')?.getAttribute('data-row') ?? null,
    fits: fits(c), scroll: rows ? rows.scrollHeight - rows.clientHeight : null,
    deployIn: (() => { const g = r?.querySelector('[data-act="deploy"]'); if (!fits(g)) return false; const b = g.getBoundingClientRect(), at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!at && (at === g || g.contains(at)); })() };   // (the button is in the window and nothing lies over it)
};
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
};
const ready = page => page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', search: location.search, mode: window.__menu.mode }; });
const kit = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__kit.KIT.members)));
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
// in a kit card: S until the highlighted row is `field` — by its NAME, never by a count (the card gained the frag and 40 mm rows after this walk was first written, and a count of S presses then landed on the wrong row)
const toRow = async (page, field) => { for (let i = 0; i < 24; i++) { if (await page.evaluate(() => document.querySelector('#loadout .kc .kc-row.sel')?.getAttribute('data-field') ?? null) === field) return true; await page.keyboard.press('KeyS'); } return false; };
const j = x => JSON.stringify(x);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const shot = (page, name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

  // ───────────── flow: start card ▸ Missions ▸ loadout ▸ Deploy ▸ the run
  const flow = async () => { const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); watch(page, 'flow');
    await page.goto(BASE + '?' + Q); log('flow: waiting for the page to be ready (about a minute and a half on the software adapter)');
    const rd = await ready(page); if (rd.fatal) report.errors.push('fatal: ' + rd.fatal);
    await page.evaluate(() => { localStorage.removeItem('twopointsix.kit'); localStorage.removeItem('twopointsix.loadout'); window.__kit.reset(); });
    await page.click('#menu button:has-text("Missions")'); await page.waitForSelector('#missions.on');
    await page.click(`#missions .mrow[data-mission="${ID}"]`); await page.waitForTimeout(400);
    let s = await page.evaluate(STATE); await shot(page, '1-missions');
    check(rd.mode === 'start' && s.list && s.listOn === ID && /Loadout/.test(s.listBtn ?? '') && !s.loadout, 'the start card\'s Missions opens the list; the sheet\'s button says Loadout', `on ${s.listOn} · button '${s.listBtn}'`);
    await press(page, 'Enter'); await page.waitForTimeout(250); s = await page.evaluate(STATE); await shot(page, '2-loadout');
    const own = s.size;
    check(s.loadout && !s.list && s.menu === 'start' && s.time === 0 && s.slots.length === 5 && s.member === '0' && s.fits && s.deployIn, 'Enter on the mission: its loadout screen, the list gone, nothing started; the card sits whole in the window with Deploy in sight (on a short window the rows scroll over it, the buttons never)', `'${s.title}' · team ${s.size} · ${s.slots.join(' ')} · ${s.pool} · fits ${s.fits}, Deploy in sight ${s.deployIn}, the rows scroll ${s.scroll} px`);
    // by the keys alone: down to the members, across to the first teammate, into his card, down to the stun canisters, one more; down to the suit, the next one
    const before = await kit(page), poolBefore = s.pool;
    await press(page, 'KeyS', 'KeyD', 'Enter'); const onStun = await toRow(page, 'bangs'); await press(page, 'KeyD'); const onSuit = await toRow(page, 'suit'); await press(page, 'KeyD'); await page.waitForTimeout(200);
    const after = await kit(page); s = await page.evaluate(STATE); await shot(page, '3-loadout-kit');
    check(onStun && onSuit && s.member === '1' && s.selRow === 'kit' && after[1].bangs === before[1].bangs + 1 && after[1].charges === before[1].charges && after[1].suit !== before[1].suit && s.pool !== poolBefore && s.loadout && s.time === 0, 'keys alone: S to the members, D to the first teammate, Enter into his card, S to a row, D changes it — a stun canister more (the squad\'s count follows) and another suit', `member ${s.member} · stun ${before[1].bangs} → ${after[1].bangs} · suit ${before[1].suit} → ${after[1].suit} · ${poolBefore} → ${s.pool} · his slot: ${s.sums[1]}`);
    await press(page, 'Escape'); await page.waitForTimeout(250); s = await page.evaluate(STATE);
    const onList = { ...s }; await press(page, 'Escape'); await page.waitForTimeout(200); s = await page.evaluate(STATE);
    check(!onList.loadout && onList.list && onList.listOn === ID && !s.list && !s.loadout && s.menu === 'start' && s.time === 0, 'Esc steps back one screen: from inside a kit card to the mission list on the same row, then to the start card — the game never started under them', `after one Esc: list on ${onList.listOn} · after two: menu '${s.menu}', game time ${s.time}`);
    // in again; the team to three; a slot clicked; Deploy
    await page.click('#menu button:has-text("Missions")'); await page.waitForSelector('#missions.on'); await press(page, 'Space'); await page.waitForSelector('#loadout');
    await page.click('#loadout .lo-size[data-squad="3"]'); await page.click('#loadout .lo-slot[data-slot="2"]'); await page.waitForTimeout(200);
    s = await page.evaluate(STATE); await shot(page, '4-loadout-three');
    const want = await page.evaluate(() => window.__kit.pool(3)), kept = await kit(page);
    check(s.size === '3' && s.member === '2' && s.slots.filter(x => x[0] === '+').length === 4 && s.pool === `Squad carries · ${want.bangs} stun · ${want.charges} charge${want.charges === 1 ? '' : 's'} · ${want.frags} frag${want.frags === 1 ? '' : 's'}` && kept[1].bangs === after[1].bangs && s.fits, 'in again (Space on the list): the kit is as it was left; a click sets the team to three and a click on a slot picks that man', `${s.slots.join(' ')} · ${s.pool} · Deploy button '${s.deploy}'`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('#loadout [data-act="deploy"]')]);
    log('flow: Deploy was a page load; waiting for it'); const rd2 = await ready(page); if (rd2.fatal) report.errors.push('fatal: ' + rd2.fatal);
    const run = await page.evaluate(() => { window.__smoke.params.enabled = false; const g = window.__game, O = window.__orders; g.doorTools.sync();
      const ops = O.squad(); return { search: location.search, menu: window.__menu.mode, scenario: window.__scenarios.current()?.title ?? null, squad: ops.map(m => m.callsign), bangs: g.doorTools.bangs, charges: g.doorTools.charges,
        tint: [...ops[0].char.tint].map(x => +x.toFixed(3)), screen: !!document.getElementById('loadout') || document.getElementById('missions').classList.contains('on') }; });
    const suit = await page.evaluate(() => { const id = window.__kit.KIT.members[1].suit; return { id, tint: [...window.__kit.suits[id].tint].map(x => +x.toFixed(3)) }; });
    check(suit.id === after[1].suit && j(run.tint) === j(suit.tint) && /squad=3/.test(run.search) && !/loadout=/.test(run.search) && /quality=verylow/.test(run.search) && run.menu === 'closed' && !!run.scenario && run.squad.length === 3 && run.bangs === want.bangs && run.charges === want.charges && !run.screen,
      'Deploy is a page load of the mission\'s own URL with squad=3: the run stands three teammates, its door tools carry the count the screen showed, and the first man wears the suit his card was given', `${run.search} · '${run.scenario}' · ${run.squad.join(', ')} · ${run.bangs} stun, ${run.charges} charges (screen: ${want.bangs}, ${want.charges}) · ${run.squad[0]} suit '${suit.id}' tint ${j(run.tint)} (the table's ${j(suit.tint)})`);
    await page.evaluate(() => { const e = window.__engine, real = e.render; e.render = () => {}; try { window.__runFrames(120, 1 / 60); } catch (x) { console.error('play threw', x); } finally { e.render = real; } });   // (two seconds of the page's own loop, undrawn: a drawn frame takes seconds on this adapter)
    await page.evaluate(DRAW, 3); await shot(page, '5-run');
    await page.close(); };

  // ───────────── solo: the solo night through the loadout, by URL
  const solo = async () => { const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); watch(page, 'solo');
    await page.goto(BASE + '?loadout=solo-night&' + Q); log('solo: waiting for the page to be ready');
    const rd = await ready(page); if (rd.fatal) report.errors.push('fatal: ' + rd.fatal);
    await page.evaluate(() => { localStorage.removeItem('twopointsix.kit'); window.__kit.reset(); }); await page.waitForTimeout(200);
    let s = await page.evaluate(STATE);
    check(s.loadout && s.menu === 'start' && s.size === '0' && s.off === '1,2,3,4' && s.member === '0' && (s.pool ?? '') === '' && s.fits, '?loadout=solo-night: the solo night\'s loadout over the start card — every size but solo greyed, your own card, no squad count', `'${s.title}' · team ${s.size}, greyed ${s.off} · '${s.note}'`);
    // S to the members, Enter into your card: the first row is the guns — D = the pistol only; down to the suit — D = the next one
    await press(page, 'KeyS', 'Enter', 'KeyD'); const onSuit = await toRow(page, 'suit'); await press(page, 'KeyD'); await page.waitForTimeout(200);
    const mine = (await kit(page))[0]; s = await page.evaluate(STATE); await shot(page, '6-loadout-solo');
    check(onSuit && mine.weapon === 'pistol' && mine.suit !== 'issued', 'your own card by the keys: the rifle left at home, another suit', `${j(mine)} · your slot: ${s.sums[0]}`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('#loadout [data-act="deploy"]')]);
    log('solo: Deploy was a page load; waiting for it'); const rd2 = await ready(page); if (rd2.fatal) report.errors.push('fatal: ' + rd2.fatal);
    const run = await page.evaluate(() => { window.__smoke.params.enabled = false; const g = window.__game, p = g.player; return { search: location.search, menu: window.__menu.mode, card: document.getElementById('menu').classList.contains('on'), scenario: window.__scenarios.current()?.title ?? null,
      rifle: p.hasRifle, tint: [...p.char.tint].map(x => +x.toFixed(3)), guards: g.guards.length }; });
    const again = await page.evaluate(() => { const g = window.__game; g.restartEncounter(); return { rifle: g.player.hasRifle, tint: [...g.player.char.tint].map(x => +x.toFixed(3)) }; });
    const mySuit = await page.evaluate(id => [...window.__kit.suits[id].tint].map(x => +x.toFixed(3)), mine.suit);
    check(j(run.tint) === j(mySuit) && j(again.tint) === j(mySuit) && /[?&]solo\b/.test(run.search) && !/loadout=/.test(run.search) && run.menu === 'closed' && !run.card && run.scenario === null && run.rifle === false && again.rifle === false && run.guards === 3,
      'Deploy loads ?solo: the plain night straight in with no start card, the shift of three, and your card on the player — no rifle, the suit — after a restart too', `${run.search} · rifle ${run.rifle} (after a restart ${again.rifle}) · suit '${mine.suit}' tint ${j(run.tint)}`);
    await page.evaluate(DRAW, 3); await shot(page, '7-run-solo');
    await page.evaluate(() => { localStorage.removeItem('twopointsix.kit'); });
    await page.close(); };

  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, wanted = n => !ONLY || ONLY.includes(n);
  if (ONLY && !['flow', 'solo'].some(wanted)) { console.log(`=== loadout-look: NO VERDICT — ONLY=${process.env.ONLY} names no page (flow, solo) ===`); await browser.close(); process.exit(2); }
  try { if (wanted('flow')) await flow(); if (wanted('solo')) await solo(); }   // (one at a time: a page booting beside another gets no frames on the software adapter)
  catch (e) { report.errors.push('script: ' + String(e && e.stack || e).slice(0, 700)); }
  await browser.close();
  report.errors.forEach(e => console.log('   >', e));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.checks.filter(c => !c.ok).length;
  console.log(bad || report.errors.length ? `=== loadout-look: ${bad} FAIL, ${report.errors.length} page errors ===` : `=== loadout-look: ${report.checks.length} checks PASS, no page errors (${report.noise} lines of the software adapter's smoke-pipeline noise passed over) ===`);
  process.exit(bad || report.errors.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
