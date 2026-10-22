// THE KIT STEP'S BRIEF AND ITS WALKTHROUGH, ON THE REAL PAGE (ui/kitBrief.ts `?kitbrief=0`, ui/kitGuide.ts `?kitguide=0`). The maintainer, 10-22: "we should
// teach how to pick squad layouts! so maybe a tutorial on the gear page for a mission (that's skippable). honestly it doesn't make a ton of sense right now
// since you don't know anything about the objective or map when picking kit".
// Headless Chromium with no WebGPU adapter (the start page is plain DOM, live from the first tick), driven with REAL keys and clicks:
//   · the Team & kit step shows the mission's job, its facts, what is set and its map, and what the place asks of a kit (a rescue: hostages, locked doors);
//   · M makes the map large and puts it back;
//   · a browser that has never been here is walked through the step, one card beside one lit row at a time, and each card goes only when its own thing
//     is DONE (the map opened and put back · another team size · another named kit · another man · one thing on his card changed) — and not on anything else;
//   · the card never covers the row it is about and never leaves the window;
//   · finished, it is not shown on the next visit; the word on the step's head plays it again; Esc skips it and the next Esc is the step's own;
//   · a tutorial mission (kit as issued) has the brief and no walkthrough; each switch off is the step as it was.
//   node tools/qa/kitguide-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZES · KITGUIDE_BREAK=1 (both switches off, the step as it was: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Pictures of every beat go to outDir.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const SIZES = (process.env.SIZES || '1440x900,1353x770,1000x673').split(',').map(s => s.split('x').map(Number));
const BREAK = process.env.KITGUIDE_BREAK === '1';
const OFF = BREAK ? '&kitguide=0&kitbrief=0' : '';
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });

/** what the step shows right now, read off the page */
const read = page => page.evaluate(() => {
  const root = document.querySelector('#missions'), vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const card = document.querySelector('.kg-card'), lit = document.querySelector('.kg-lit'), map = document.querySelector('.msheet > .mmap');
  const txt = sel => { const e = document.querySelector(sel); return vis(e) ? e.textContent.trim() : ''; };
  return { cls: root.className, pane: root.classList.contains('pane-loadout') ? 'kit' : 'mission',
    card: vis(card) ? { title: card.querySelector('h3').firstChild.textContent, text: [...card.querySelectorAll('p')].map(p => p.textContent).join(' '), box: box(card), pips: card.querySelectorAll('.kg-pips i').length, tick: card.classList.contains('tick') } : null,
    lit: lit ? (lit.getAttribute('data-row') || 'map') : '', litBox: box(lit), sel: document.querySelector('#loadout [data-row].sel')?.getAttribute('data-row') ?? '',
    map: vis(map) ? box(map) : null, big: root.classList.contains('kb-big'), blurb: txt('.mblurb'), csum: txt('.mcsum'), cap: txt('.kb-cap'), kitTop: document.querySelector('.onehost')?.getBoundingClientRect().top ?? 0,
    facts: [...document.querySelectorAll('.mfacts .mfact')].filter(vis).map(f => `${f.querySelector('i').textContent} ${f.querySelector('b').textContent}`),
    again: vis(document.querySelector('.kg-again')), squad: document.querySelector('#loadout .lo-size.on')?.textContent.trim() ?? '', kit: document.querySelector('#loadout .lo-set.on')?.getAttribute('data-kit') ?? '',
    man: document.querySelector('#loadout .lo-slot.pick .lo-name')?.textContent ?? '', seen: localStorage.getItem('twopointsix.kitguide'), win: { w: innerWidth, h: innerHeight } };
});
const apart = (a, b) => !a || !b || a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5;
const inside = (a, w) => !!a && a.l >= -0.5 && a.t >= -0.5 && a.r <= w.w + 0.5 && a.b <= w.h + 0.5;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const fresh = async (W, H) => { const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch { /* as it is */ } });   // (this browser stands for a player's: the walkthrough is not played unasked in one a script drives — ui/kitGuide.ts)
    await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
    const page = await ctx.newPage(); page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    return { ctx, page }; };
  const open = async (page, q) => { await page.goto(`http://localhost:${PORT}/?${q}&paused&mute${OFF}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector('#missions.one.on #loadout .lo-slot.in', { timeout: 60000 }); await page.waitForTimeout(1200); };
  const shot = async (page, name) => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); };

  for (const [W, H] of SIZES) {
    const at = `${W}x${H}`, { ctx, page } = await fresh(W, H);
    // ── the brief, on a rescue: the job, the map, what the place asks ──
    await open(page, 'loadout=rescue-registry&kitguide=0');
    let s = await read(page);
    const short = H <= 800, kitTop = s.kitTop;   // (a short window: the band is no taller than the name alone was — the map a small mark, the job whole on the large sheet)
    check(!!s.map && s.map.w >= (short ? 40 : 120) && (short || s.blurb.length > 20) && s.facts.length >= 1, `${at}: the kit step shows the mission's map${short ? '' : ', its job'} and its facts`, `map ${s.map ? `${s.map.w.toFixed(0)} px wide` : 'not drawn'} · "${s.blurb.slice(0, 60)}…" · ${s.facts.join(' | ') || 'no facts'}`);
    check(s.facts.some(f => /^Hostages 2$/i.test(f)) && s.facts.some(f => /^Locked doors 4$/i.test(f)), `${at}: the registry's own counts are on it: two hostages, four locked doors`, s.facts.join(' | ') || 'none');
    if (!short) check(s.csum.length > 0, `${at}: what is set for the mission is on it`, s.csum || 'nothing');
    check(!s.card && !s.again, `${at}: ?kitguide=0 = no card and no word for the walkthrough`, `card ${s.card ? s.card.title : 'none'} · word ${s.again}`);
    await page.keyboard.press('m'); await page.waitForTimeout(350); const big = await read(page); await shot(page, `map-large-${at}`);
    await page.keyboard.press('m'); await page.waitForTimeout(350); const small = await read(page);
    check(big.big && big.map && s.map && big.map.w > s.map.w * 2 && inside(big.map, big.win) && !small.big && big.cap.length > 30, `${at}: M makes the map large with the job under it, M again puts it back`, `${s.map ? s.map.w.toFixed(0) : '—'} px → ${big.map ? big.map.w.toFixed(0) : '—'} px → ${small.map ? small.map.w.toFixed(0) : '—'} px`);
    await shot(page, `brief-${at}`);
    // ── a tutorial mission: its kit is issued, so there is nothing to walk through ──
    await open(page, 'loadout=tut-squad');
    s = await read(page);
    check(!s.card && !s.again && !!s.map && (short || s.blurb.length > 10), `${at}: a tutorial mission (kit as issued) has the brief and no walkthrough`, `card ${s.card ? s.card.title : 'none'} · word ${s.again} · "${s.blurb.slice(0, 50)}…"`);
    // ── the walkthrough, on a mission with a team, in a browser that has never been here ──
    await open(page, 'loadout=compound-four');
    const beat = async (name, title, lit, act, also) => {
      let b = await read(page);
      check(!!b.card && b.card.title === title && b.lit === lit, `${at}: ${name}: its card is up beside its lit row`, `card "${b.card ? b.card.title : 'none'}" · lit ${b.lit || 'nothing'} · the keys on ${b.sel}`);
      if (!b.card) return b;
      check(inside(b.card.box, b.win) && apart(b.card.box, b.litBox), `${at}: ${name}: the card is whole in the window and clear of its row`, `card ${b.card.box.l.toFixed(0)},${b.card.box.t.toFixed(0)} to ${b.card.box.r.toFixed(0)},${b.card.box.b.toFixed(0)} · row ${b.litBox.l.toFixed(0)},${b.litBox.t.toFixed(0)} to ${b.litBox.r.toFixed(0)},${b.litBox.b.toFixed(0)}`);
      check(!/[6-9]/.test(b.card.text + b.card.title), `${at}: ${name}: no digit above 5 on the card`, b.card.text);
      await shot(page, `beat-${name}-${at}`);
      if (also) { await also(); await page.waitForTimeout(900); const c = await read(page); check(!!c.card && c.card.title === title, `${at}: ${name}: something else done does not put the card away`, `card "${c.card ? c.card.title : 'none'}"`); }
      await act(); await page.waitForTimeout(250); const mid = await read(page); await page.waitForTimeout(800);
      return mid; };
    const mapTwice = async () => { await page.keyboard.press('m'); await page.waitForTimeout(250); await page.keyboard.press('m'); };
    const m0 = await beat('the job', 'The job', 'map', mapTwice);
    const m1 = await beat('who comes', 'Who comes', 'squad', async () => { await page.keyboard.press('a'); }, mapTwice);
    check(m1.squad !== m0.squad && !!m1.card && m1.card.tick, `${at}: who comes: A picked another size and the card ticked`, `${m0.squad} → ${m1.squad}`);
    const m2 = await beat('a kit for the squad', 'A kit for the squad', 'squadkit', async () => { await page.keyboard.press('d'); await page.keyboard.press('Enter'); }, async () => { await page.keyboard.press('d'); });   // (D alone moves the pick along the row and puts nothing on)
    check(m2.kit !== m1.kit && m2.kit !== '', `${at}: a kit for the squad: D then Enter put another named kit on`, `${m1.kit} → ${m2.kit}`);
    const m3 = await beat('each man', 'Each man', 'members', async () => { await page.click('#loadout .lo-slot.in[data-slot="2"]'); }, mapTwice);
    check(m3.man !== m2.man, `${at}: each man: a click picked another man`, `${m2.man} → ${m3.man}`);
    await beat('his card', 'His card', 'kit', async () => { const row = '#loadout .lo-kit .kc-row[data-field="bangs"]'; await page.hover(row); await page.click(`${row} .kc-step:first-of-type`); }, async () => { await page.keyboard.press('s'); });   // (a walk over the tiles changes nothing)
    let g = await read(page);
    check(!!g.card && g.card.title === 'Go' && g.lit === 'actions' && g.sel === 'actions', `${at}: go: Deploy is lit, the keys are on it, the last card is up`, `card "${g.card ? g.card.title : 'none'}" · lit ${g.lit} · the keys on ${g.sel}`);
    if (g.card) check(inside(g.card.box, g.win) && g.card.pips <= 6, `${at}: go: the card is whole in the window`, `${g.card.box.l.toFixed(0)},${g.card.box.t.toFixed(0)} to ${g.card.box.r.toFixed(0)},${g.card.box.b.toFixed(0)} · ${g.card.pips} pips`);
    await shot(page, `beat-go-${at}`);
    check(g.seen === null, `${at}: not remembered until it is finished or skipped`, `store ${g.seen}`);
    if (g.card) await page.click('.kg-card [data-kg="ok"]'); await page.waitForTimeout(300);
    g = await read(page);
    check(!g.card && g.seen === 'done' && g.pane === 'kit' && g.again, `${at}: 'Got it' ends it: remembered, still on the step, the way back on the head`, `card ${g.card ? g.card.title : 'none'} · store ${g.seen} · word ${g.again}`);
    // ── the next visit, the way back, and Esc ──
    await open(page, 'loadout=compound-four');
    g = await read(page);
    check(!g.card && g.again, `${at}: the next visit: no card, the word on the head`, `card ${g.card ? g.card.title : 'none'} · word ${g.again}`);
    await shot(page, `after-${at}`);
    if (g.again) await page.click('.kg-again'); await page.waitForTimeout(500);
    g = await read(page);
    check(!!g.card && g.card.title === 'The job', `${at}: the word plays it again from its first card`, `card "${g.card ? g.card.title : 'none'}"`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); const e1 = await read(page);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); const e2 = await read(page);
    check(!e1.card && e1.pane === 'kit' && e2.pane === 'mission', `${at}: Esc skips it and stays on the step; the next Esc is the step's own, back to the mission`, `after one: card ${e1.card ? e1.card.title : 'none'}, on ${e1.pane} · after two: on ${e2.pane}`);
    // ── under a card: Enter is its Next and never Deploy, a pop-up's Esc is the pop-up's, a card changed by KEY closes its beat, the map opened mid-way is whole ──
    await page.evaluate(() => localStorage.removeItem('twopointsix.kitguide'));   // (a browser that has not been through it: what is remembered below is this section's doing)
    await open(page, 'loadout=compound-four&kitguide=1&squad=2');
    g = await read(page);
    check(/2/.test(g.squad), `${at}: a team size named on the address is the one the step opens at (the page's own settings reach the kit screen)`, `the step opens at '${g.squad}'`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(450); g = await read(page);
    check(g.pane === 'kit' && /loadout=compound-four/.test(page.url()) && !!g.card && g.card.title === 'Who comes' && g.seen !== 'done', `${at}: Enter on a card is its Next: nothing is deployed`, `on ${g.pane} · card "${g.card ? g.card.title : 'none'}" · store ${g.seen}`);
    await page.keyboard.press('m'); await page.waitForTimeout(400); const op = await page.evaluate(() => getComputedStyle(document.querySelector('.msheet > .mmap')).opacity); await page.keyboard.press('m'); await page.waitForTimeout(300);
    check(op === '1', `${at}: the map opened under a later card is drawn whole, not dimmed`, `opacity ${op}`);
    for (let i = 0; i < 3; i++) { await page.click('.kg-card [data-kg="next"]').catch(() => {}); await page.waitForTimeout(300); }
    g = await read(page);
    check(!!g.card && g.card.title === 'His card', `${at}: 'Next' on a card goes on without the thing done`, `card "${g.card ? g.card.title : 'none'}"`);
    const pop = () => page.evaluate(() => { const e = document.querySelector('#loadout .kc-pop.open'); return !!e && e.offsetParent !== null; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(400); const popUp = await pop();
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); const popGone = !(await pop()); g = await read(page);
    check(popUp && popGone && !!g.card && g.card.title === 'His card' && g.seen !== 'done', `${at}: Esc with a gun's pop-up open shuts the pop-up and the walkthrough stays`, `pop-up ${popUp ? 'opened' : 'did not open'}, ${popGone ? 'shut' : 'still open'} · card "${g.card ? g.card.title : 'none'}" · store ${g.seen}`);
    await page.keyboard.press('s'); await page.waitForTimeout(200); await page.keyboard.press('d'); await page.waitForTimeout(1200); g = await read(page);
    check(!!g.card && g.card.title === 'Go', `${at}: his card changed by key (S, then D) closes the beat`, `card "${g.card ? g.card.title : 'none'}"`);
    // ── the words follow the mission: no way-in dot is promised where the map marks none, and the counts are the mission's as staged ──
    await open(page, 'loadout=vault-quiet&kitguide=1'); g = await read(page);
    check(!!g.card && !/dot/.test(g.card.text), `${at}: a quiet mission's map marks no way in, and its card promises none`, g.card ? g.card.text : 'no card');
    await open(page, 'loadout=hostage-rescue&kitguide=0'); g = await read(page);
    check(g.facts.some(f => /^Hostages 2$/i.test(f)) && g.facts.some(f => /^Locked doors 4$/i.test(f)), `${at}: the office's rescue: two hostages, and four locked doors (its staging unlocks the side door)`, g.facts.join(' | ') || 'none');
    await open(page, 'loadout=warehouse-four&kitguide=0'); g = await read(page);
    check(g.facts.length > 0 && !g.facts.some(f => /[6-9]|\d\d/.test(f)), `${at}: no digit above 5 among the facts (eleven defenders are written out)`, g.facts.join(' | ') || 'none');
    // ── each switch off ──
    await open(page, 'loadout=compound-four&kitbrief=0&kitguide=1');
    g = await read(page);
    check(!g.map && g.blurb === '' && !!g.card && g.card.title === 'Who comes', `${at}: ?kitbrief=0 = the step's head as it was, and the walkthrough starts at the team`, `map ${g.map ? 'drawn' : 'none'} · blurb "${g.blurb}" · card "${g.card ? g.card.title : 'none'}"`);
    if (short) { await open(page, 'loadout=rescue-registry&kitbrief=0&kitguide=0'); const was = await read(page);
      check(kitTop <= was.kitTop + 0.5, `${at}: a short window: the brief takes no height from the kit (it starts where it did under the name alone)`, `the kit starts at ${kitTop.toFixed(0)} px with the brief, ${was.kitTop.toFixed(0)} px without`); }
    await ctx.close();
    // ── a browser a script drives (every other page tool): the step as it stands, nothing played unasked ──
    { const ctx2 = await browser.newContext({ viewport: { width: W, height: H } }), p2 = await ctx2.newPage(); p2.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
      await ctx2.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
      await open(p2, 'loadout=compound-four'); const d = await read(p2);
      check(!d.card && d.again && d.seen === null, `${at}: a browser a script drives is not walked through unasked, and has the word`, `card ${d.card ? d.card.title : 'none'} · word ${d.again} · store ${d.seen}`);
      await ctx2.close(); }
  }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== kitguide-page: ${fails} FAILED ===` : '\n=== kitguide-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
