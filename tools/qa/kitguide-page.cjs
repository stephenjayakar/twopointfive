// THE KIT STEP'S BRIEF, AND THE PLAN A TUTORIAL MISSION TEACHES ON IT, ON THE REAL PAGE (ui/kitBrief.ts `?kitbrief=0`, ui/kitGuide.ts `?kitguide=0`,
// ui/kitPlan.ts, game/kit.ts ISSUE.picked `?kitpack=0`). The maintainer, 10-22: "we should teach how to pick squad layouts! so maybe a tutorial on the
// gear page for a mission (that's skippable). honestly it doesn't make a ton of sense right now since you don't know anything about the objective or map
// when picking kit" — and, 10-23, of the walkthrough that came up on every mission: "this tutorial is good but we should attach it to a tutorial mission
// (and make it bespoke and explain how to plan), not for the regular ones".
// Headless Chromium with no WebGPU adapter (the start page is plain DOM, live from the first tick), driven with REAL keys and clicks:
//   · the Team & kit step shows the mission's job, its facts, what is set and its map, and what the place asks of a kit (a rescue: hostages, locked doors);
//   · M makes the map large and puts it back;
//   · A REGULAR MISSION plays no walkthrough and has no word for one;
//   · THE SQUAD TUTORIAL MISSION shows its cards, and a browser that has never been there is walked through planning its kit, one card beside one lit
//     row at a time, each card gone only when its own thing is DONE (the map opened and put back, with the street's rooms named on it · Stun heavy put
//     on · a frag back on your card · one of the four looked at) — and not on anything else; no card writes a digit;
//   · the card never covers the row it is about and never leaves the window;
//   · finished, it is remembered under its own key and not shown on the next visit; the word on the step's head plays it again; Esc skips it and the
//     next Esc is the step's own; Enter under a card is its Next and never Deploy;
//   · `?kitpack=0` = that mission as issued again (no cards, no plan) · `?kitguide=0` = no walkthrough anywhere · `?kitguide=1` = the step's general
//     walkthrough on a regular mission, kept for comparing.
//   node tools/qa/kitguide-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZES · KITGUIDE_BREAK=1 (the walkthrough and the brief off, the step as it was: must FAIL)
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
    man: document.querySelector('#loadout .lo-slot.pick .lo-name')?.textContent ?? '', seen: localStorage.getItem('twopointsix.kitguide'), planSeen: localStorage.getItem('twopointsix.kitplan.tut-squad'), win: { w: innerWidth, h: innerHeight },
    beat: vis(card) ? card.getAttribute('data-beat') : '', word: vis(document.querySelector('.kg-again')) ? document.querySelector('.kg-again').textContent : '', cards: vis(document.querySelector('#loadout .lo-kit .kc')),
    pins: [...document.querySelectorAll('.kb-pin')].filter(e => vis(e.parentElement)).map(e => ({ label: e.getAttribute('data-pin'), box: box(e.querySelector('b')), at: box(e) })),
    pool: vis(document.querySelector('#loadout .lo-pool')) ? { text: document.querySelector('#loadout .lo-pool').textContent, box: box(document.querySelector('#loadout .lo-pool')) } : null,
    frags: document.querySelector('#loadout .lo-kit .kc-row[data-field="frags"] .kc-val')?.textContent ?? '', smoke: document.querySelector('#loadout .lo-kit .kc-row[data-field="smoke"] .kc-val')?.textContent ?? '' };
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
    // ── A REGULAR MISSION, in a browser that has never been here: no walkthrough, no word for one ──
    await open(page, 'loadout=compound-four');
    s = await read(page);
    check(!s.card && !s.again && s.cards && s.seen === null, `${at}: a regular mission plays no walkthrough and has no word for one`, `card ${s.card ? s.card.title : 'none'} · word ${s.again} · its kit cards shown ${s.cards}`);
    await page.keyboard.press('m'); await page.waitForTimeout(450); s = await read(page); await page.keyboard.press('m'); await page.waitForTimeout(250);
    check(s.big && s.pins.length === 0, `${at}: a regular mission's large map carries no pinned words`, `${s.pins.length} pins`);
    // ── THE SQUAD TUTORIAL MISSION: its cards are on the step, and its plan is played ──
    await open(page, 'loadout=tut-squad');
    const beat = async (name, id, title, lit, act, also) => {
      let b = await read(page);
      check(!!b.card && b.beat === id && b.card.title === title && b.lit === lit, `${at}: ${name}: its card is up beside its lit row`, `card "${b.card ? b.card.title : 'none'}" (${b.beat}) · lit ${b.lit || 'nothing'} · the keys on ${b.sel}`);
      if (!b.card) return b;
      check(inside(b.card.box, b.win) && apart(b.card.box, b.litBox), `${at}: ${name}: the card is whole in the window and clear of its row`, `card ${b.card.box.l.toFixed(0)},${b.card.box.t.toFixed(0)} to ${b.card.box.r.toFixed(0)},${b.card.box.b.toFixed(0)} · row ${b.litBox.l.toFixed(0)},${b.litBox.t.toFixed(0)} to ${b.litBox.r.toFixed(0)},${b.litBox.b.toFixed(0)}`);
      check(!/\d/.test(b.card.text + b.card.title) && !/\b(north|south|east|west)\b/i.test(b.card.text), `${at}: ${name}: no digit and no compass word on the card`, b.card.text);
      await shot(page, `plan-${name}-${at}`);
      if (also) { await also(); await page.waitForTimeout(900); const c = await read(page); check(!!c.card && c.beat === id, `${at}: ${name}: something else done does not put the card away`, `card "${c.card ? c.card.title : 'none'}"`); }
      await act(); await page.waitForTimeout(250); const mid = await read(page); await page.waitForTimeout(800);
      return { ...mid, text: b.card.text, cardBox: b.card.box, poolAt: b.pool }; };
    const mapTwice = async () => { await page.keyboard.press('m'); await page.waitForTimeout(250); await page.keyboard.press('m'); };
    s = await read(page);
    check(s.cards && /4/.test(s.squad) && s.planSeen === null, `${at}: the squad tutorial mission's own cards are on its step, at its own team of four`, `cards ${s.cards} · team '${s.squad}'`);
    // the map, large: the street's rooms are named on it
    await page.keyboard.press('m'); await page.waitForTimeout(500); const pm = await read(page); await shot(page, `plan-map-${at}`); await page.keyboard.press('m'); await page.waitForTimeout(900);
    { const labels = pm.pins.map(k => k.label), inMap = pm.pins.every(k => pm.map && k.at.l > pm.map.l && k.at.l < pm.map.r && k.at.t > pm.map.t && k.at.t < pm.map.b && inside(k.box, pm.win)), clear = pm.pins.every((a, i) => pm.pins.every((b, j) => j <= i || apart(a.box, b.box)));
      check(pm.big && labels.length === 5 && ['Guard hut', 'Store', 'Workshop', 'Machine gun', 'Locked hall'].every(l => labels.includes(l)) && inMap && clear && /four rooms/.test(pm.cap) && !/\d/.test(pm.cap), `${at}: the map opened large names the street's rooms, the gun and the locked hall, each word on the sheet and clear of the others, and says what to look for`, `${labels.join(' · ') || 'no pins'} · on the sheet ${inMap} · clear of each other ${clear} · "${pm.cap.slice(0, 90)}…"`); }
    s = await read(page);
    check(!!s.card && s.beat === 'squad', `${at}: plan it first: the map opened and put back is the first card done`, `now "${s.card ? s.card.title : 'none'}"`);
    const m1 = await beat('pack-for-the-rooms', 'squad', 'Pack for the rooms', 'squadkit', async () => { await page.keyboard.press('d'); await page.keyboard.press('Enter'); }, async () => { await page.keyboard.press('d'); });   // (D alone moves the pick along the row and puts nothing on)
    check(m1.kit === 'stun' && /three/.test(m1.text) && /four rooms/.test(m1.text) && !!m1.poolAt && /3 stun/.test(m1.poolAt.text) && apart(m1.cardBox, m1.poolAt.box) && /6 stun/.test(m1.pool ? m1.pool.text : ''), `${at}: pack for the rooms: the card counts the squad's stun grenades as the step does, leaves that line in view, and D, D, Enter put Stun heavy on`, `kit '${m1.kit}' · the line before "${m1.poolAt ? m1.poolAt.text : ''}", after "${m1.pool ? m1.pool.text : ''}" · clear of the card ${m1.poolAt ? apart(m1.cardBox, m1.poolAt.box) : false}`);
    const m2 = await beat('the-machine-gun', 'gun', 'The machine gun', 'kit', async () => { const row = f => `#loadout .lo-kit .kc-row[data-field="${f}"]`; await page.hover(row('smoke')); await page.click(`${row('smoke')} .kc-step:first-of-type`); await page.waitForTimeout(200); await page.hover(row('frags')); await page.click(`${row('frags')} .kc-step:last-of-type`); }, async () => { await page.keyboard.press('s'); });   // (a walk over the tiles changes nothing)
    check(/Stun heavy took your frag/.test(m2.text) && m2.man === 'You' && m2.frags === '1' && m2.smoke === '0' && !!m2.card && m2.card.tick, `${at}: the machine gun: your own card is the one open, the card says Stun heavy took your frag, and a smoke traded for a frag ticks it`, `the man '${m2.man}' · smoke ${m2.smoke} · frags ${m2.frags} · ticked ${!!m2.card && m2.card.tick}`);
    const m3 = await beat('the-four', 'four', 'The four', 'members', async () => { await page.keyboard.press('d'); }, mapTwice);
    check(m3.man !== 'You' && m3.man !== '', `${at}: the four: D opened a teammate's card`, `${m2.man} → ${m3.man}`);
    let g = await read(page);
    check(!!g.card && g.beat === 'go' && g.lit === 'actions' && g.sel === 'actions' && !/handed/.test(g.card.text), `${at}: that's a plan: Deploy is lit, the keys are on it, the last card is up (and says nothing of a frag handed over: one was packed)`, `card "${g.card ? g.card.title : 'none'}" · lit ${g.lit} · the keys on ${g.sel}`);
    if (g.card) check(inside(g.card.box, g.win) && g.card.pips === 5 && !/\d/.test(g.card.text), `${at}: that's a plan: the card is whole in the window, five pips, no digit`, `${g.card.box.l.toFixed(0)},${g.card.box.t.toFixed(0)} to ${g.card.box.r.toFixed(0)},${g.card.box.b.toFixed(0)} · ${g.card.pips} pips`);
    await shot(page, `plan-thats-a-plan-${at}`);
    check(g.planSeen === null, `${at}: not remembered until it is finished or skipped`, `store ${g.planSeen}`);
    if (g.card) await page.click('.kg-card [data-kg="ok"]'); await page.waitForTimeout(300);
    g = await read(page);
    check(!g.card && g.planSeen === 'done' && g.seen === null && g.pane === 'kit' && g.word === 'How to plan', `${at}: 'Got it' ends it: remembered under its own key, still on the step, the way back on the head`, `card ${g.card ? g.card.title : 'none'} · its key ${g.planSeen} · the general key ${g.seen} · word '${g.word}'`);
    // ── the next visit, the way back, and Esc ──
    await open(page, 'loadout=tut-squad');
    g = await read(page);
    check(!g.card && g.word === 'How to plan' && g.kit === '' && g.frags === '1', `${at}: the next visit: no card, the word on the head, and the kit as it was packed`, `card ${g.card ? g.card.title : 'none'} · word '${g.word}' · your frags ${g.frags}`);
    await shot(page, `plan-after-${at}`);
    if (g.again) await page.click('.kg-again'); await page.waitForTimeout(500);
    g = await read(page);
    check(!!g.card && g.beat === 'read', `${at}: the word plays it again from its first card`, `card "${g.card ? g.card.title : 'none'}"`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); const e1 = await read(page);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); const e2 = await read(page);
    check(!e1.card && e1.pane === 'kit' && e2.pane === 'mission', `${at}: Esc skips it and stays on the step; the next Esc is the step's own, back to the mission`, `after one: card ${e1.card ? e1.card.title : 'none'}, on ${e1.pane} · after two: on ${e2.pane}`);
    // ── a browser that went through the step's GENERAL walkthrough has not been through this one; the kit as issued again ──
    await page.evaluate(() => { localStorage.removeItem('twopointsix.kitplan.tut-squad'); localStorage.setItem('twopointsix.kitguide', 'done'); localStorage.removeItem('twopointsix.kit'); });
    await open(page, 'loadout=tut-squad');
    g = await read(page);
    check(!!g.card && g.beat === 'read' && g.kit === 'issued', `${at}: a browser that finished the general walkthrough is still walked through this mission's plan`, `card "${g.card ? g.card.title : 'none'}" · kit '${g.kit}'`);
    // ── under a card: Enter is its Next and never Deploy; Next goes on without the thing done; the words follow what is packed ──
    await page.keyboard.press('Enter'); await page.waitForTimeout(450); g = await read(page);
    check(g.pane === 'kit' && /loadout=tut-squad/.test(page.url()) && !!g.card && g.beat === 'squad' && g.planSeen !== 'done', `${at}: Enter on a card is its Next: nothing is deployed`, `on ${g.pane} · card "${g.card ? g.card.title : 'none'}" · store ${g.planSeen}`);
    await page.keyboard.press('m'); await page.waitForTimeout(400); const op = await page.evaluate(() => { const e = document.querySelector('.msheet > .mmap'); return e ? getComputedStyle(e).opacity : 'no map'; }); await page.keyboard.press('m'); await page.waitForTimeout(300);
    check(op === '1', `${at}: the map opened under a later card is drawn whole, not dimmed`, `opacity ${op}`);
    await page.click('.kg-card [data-kg="next"]').catch(() => {}); await page.waitForTimeout(350); g = await read(page);
    check(!!g.card && g.beat === 'gun' && /You're carrying one, so keep it/.test(g.card.text) && !/\d/.test(g.card.text), `${at}: 'Next' goes on without the thing done, and with the kit as issued the gun's card says to keep the frag you carry`, g.card ? g.card.text : 'no card');
    const pop = () => page.evaluate(() => { const e = document.querySelector('#loadout .kc-pop.open'); return !!e && e.offsetParent !== null; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(400); const popUp = await pop();
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); const popGone = !(await pop()); g = await read(page);
    check(popUp && popGone && !!g.card && g.beat === 'gun' && g.planSeen !== 'done', `${at}: Esc with a gun's pop-up open shuts the pop-up and the plan stays`, `pop-up ${popUp ? 'opened' : 'did not open'}, ${popGone ? 'shut' : 'still open'} · card "${g.card ? g.card.title : 'none'}" · store ${g.planSeen}`);
    // …a kit packed with no frag: the last card says one will be handed over
    await page.click('#loadout .lo-set[data-kit="stun"]'); await page.waitForTimeout(400);
    for (let i = 0; i < 2; i++) { await page.click('.kg-card [data-kg="next"]').catch(() => {}); await page.waitForTimeout(350); }
    g = await read(page);
    check(!!g.card && g.beat === 'go' && /you'll be handed one for the machine gun/.test(g.card.text) && !/\d/.test(g.card.text), `${at}: packed with no frag, the last card says one will be handed over for the machine gun`, g.card ? g.card.text : 'no card');
    await shot(page, `plan-no-frag-${at}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // ── each switch ──
    await page.evaluate(() => { localStorage.removeItem('twopointsix.kitplan.tut-squad'); localStorage.removeItem('twopointsix.kitguide'); localStorage.removeItem('twopointsix.kit'); });
    await open(page, 'loadout=tut-squad&kitpack=0'); g = await read(page);
    await page.keyboard.press('m'); await page.waitForTimeout(400); const offMap = await read(page); await page.keyboard.press('m'); await page.waitForTimeout(250);
    check(!g.cards && !g.card && !g.again && offMap.pins.length === 0 && !!g.map, `${at}: ?kitpack=0 = that mission as issued again: no cards on its step, no plan, no word, a bare map`, `cards ${g.cards} · card ${g.card ? g.card.title : 'none'} · word ${g.again} · ${offMap.pins.length} pins`);
    await open(page, 'loadout=tut-squad&kitguide=0'); g = await read(page);
    check(g.cards && !g.card && !g.again, `${at}: ?kitguide=0 = its cards and no walkthrough or word`, `cards ${g.cards} · card ${g.card ? g.card.title : 'none'} · word ${g.again}`);
    await open(page, 'loadout=tut-squad&kitbrief=0'); g = await read(page);
    check(!g.map && !!g.card && g.beat === 'squad', `${at}: ?kitbrief=0 = the step's head as it was, and the plan starts at the squad's kit`, `map ${g.map ? 'drawn' : 'none'} · card "${g.card ? g.card.title : 'none'}"`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(250); await page.evaluate(() => localStorage.removeItem('twopointsix.kitplan.tut-squad'));
    // …the step's general walkthrough, kept for comparing: asked for on the address of a regular mission
    await open(page, 'loadout=compound-four&kitguide=1&squad=2'); g = await read(page);
    check(!!g.card && g.card.title === 'The job' && /2/.test(g.squad), `${at}: ?kitguide=1 on a regular mission plays the step's general walkthrough (kept for comparing), at the team size the address names`, `card "${g.card ? g.card.title : 'none'}" · the step opens at '${g.squad}'`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(450); g = await read(page);
    check(g.pane === 'kit' && !!g.card && g.card.title === 'Who comes', `${at}: …its Enter is its Next too`, `on ${g.pane} · card "${g.card ? g.card.title : 'none'}"`);
    await page.keyboard.press('a'); await page.waitForTimeout(1100); g = await read(page);
    check(!!g.card && g.card.title === 'A kit for the squad', `${at}: …and another team size picked is its second card done`, `card "${g.card ? g.card.title : 'none'}"`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); g = await read(page);
    check(!g.card && g.word === 'How to pick' && g.seen === 'done', `${at}: …skipped, it leaves its own word on the head`, `word '${g.word}' · store ${g.seen}`);
    // ── the brief's counts on other missions ──
    await open(page, 'loadout=hostage-rescue&kitguide=0'); g = await read(page);
    check(g.facts.some(f => /^Hostages 2$/i.test(f)) && g.facts.some(f => /^Locked doors 4$/i.test(f)), `${at}: the office's rescue: two hostages, and four locked doors (its staging unlocks the side door)`, g.facts.join(' | ') || 'none');
    await open(page, 'loadout=warehouse-four&kitguide=0'); g = await read(page);
    check(g.facts.length > 0 && !g.facts.some(f => /[6-9]|\d\d/.test(f)), `${at}: no digit above 5 among the facts (eleven defenders are written out)`, g.facts.join(' | ') || 'none');
    if (short) { await open(page, 'loadout=rescue-registry&kitbrief=0&kitguide=0'); const was = await read(page);
      check(kitTop <= was.kitTop + 0.5, `${at}: a short window: the brief takes no height from the kit (it starts where it did under the name alone)`, `the kit starts at ${kitTop.toFixed(0)} px with the brief, ${was.kitTop.toFixed(0)} px without`); }
    await ctx.close();
    // ── a browser a script drives (every other page tool): the step as it stands, nothing played unasked ──
    { const ctx2 = await browser.newContext({ viewport: { width: W, height: H } }), p2 = await ctx2.newPage(); p2.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
      await ctx2.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
      await open(p2, 'loadout=tut-squad'); const d = await read(p2);
      check(!d.card && d.word === 'How to plan' && d.planSeen === null && d.cards, `${at}: a browser a script drives is not walked through unasked, and has the word`, `card ${d.card ? d.card.title : 'none'} · word '${d.word}' · store ${d.planSeen}`);
      await ctx2.close(); }
  }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== kitguide-page: ${fails} FAILED ===` : '\n=== kitguide-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
