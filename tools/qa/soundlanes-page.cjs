// The engine replay's SOUND LANES on the real page (headless Chromium, the software adapter, the browser itself muted): a sound replay is played
// with the mixer running, and the lanes must fill as it plays, a click on a mark must open that sound's card, a take picked there must be the buffer the
// mixer plays next, a flag and the picks must come out as one line of text, and the replay must still play step for step.
//   PORT=<dev server> node tools/qa/soundlanes-page.cjs [outDir]     TAPE=<id in public/assets/replays> (wall-charge)   QUALITY=verylow   BARE_ONLY=1 (the last block alone: the pages WITHOUT the lanes)
// NOT `?mute`: a muted page never starts the mixer, so no take could be loaded. `--mute-audio` keeps the machine silent instead.
// Exit 0 = every line passed, 1 = a line failed, 2 = the script died.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', TAPE = process.env.TAPE || 'wall-charge', BARE_ONLY = !!process.env.BARE_ONLY;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist',
  '--disable-gpu-watchdog', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];
// (the voices with BOTH new takes still on offer: magIn, rack and footHard gave one up to the game's table on 10-13)
const TOYS = ['rifleSuppressed', 'magOut', 'doorBang', 'doorLatch', 'doorRattle', 'stairDoor', 'chokeLimp', 'lightBreak', 'wallDebris', 'murmur', 'heldProtest'];

let failed = 0;
const line = (ok, label, detail = '') => { if (!ok) failed++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`); };

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/assets/replays/index.json'), 'utf8'));
  const row = index.tapes.find(t => t.id === TAPE);
  if (!row) throw new Error(`no sound replay named ${TAPE}`);
  const toys = TOYS.filter(n => n in row.sounds).sort((a, b) => row.sounds[a] - row.sounds[b]);
  if (!toys.length) throw new Error(`${TAPE} plays none of the voices with two takes`);
  const toy = toys[toys.length - 1], first = row.sounds[toy];   // (the one first heard latest: there are steps to walk before it)

  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (!BARE_ONLY) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // the dev server has no favicon: the browser's own ask for one is not the page's error; any other address that fails is named
  page.on('console', m => {
    if (m.type() !== 'error') return; const at = (m.location() || {}).url || '';
    if (/\/favicon\.ico$/.test(at)) return;
    errors.push(/Failed to load resource/.test(m.text()) ? `${m.text()} ${at}` : m.text());
  });
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&playtape=assets/replays/${TAPE}.json.gz&soundlanes`, { timeout: 240000 });   // (the lanes are a debug mode: only a page that asks for them has them)
  await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape && !!window.__sndlanes, null, { timeout: 900000 });
  const boot = await page.evaluate(async () => {
    await window.__ready; window.__testVisible = true;
    const a = window.__audio; a.start();
    const be = a.backend; window.__bufs = [];
    if (be) { const play = be.play.bind(be); be.play = o => { window.__bufs.push(o.buffer); return play(o); }; }
    return { mute: /[?&]mute\b/.test(location.search), mixer: !!be, search: location.search };
  });
  line(!boot.mute && boot.mixer, 'the replay page runs its mixer', boot.search);

  const walk = to => page.evaluate(async to => {
    const T = window.__tape, e = window.__engine;
    const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    let s = T.state;
    for (let i = 0; i < 4000 && !s.ended && s.f < to; i++) { s = T.run(Math.min(120, to - s.f), true); await e.device.queue.onSubmittedWorkDone(); await tick(); }
    window.__sndlanes.paint();
    return { state: T.state, rows: window.__sndlanes.rowNames(), events: window.__sndlanes.events().length };
  }, to);

  // the replay PLAYED to a step, frame by frame (the page's own frame, a tenth of a second each: what the hear-again picture is taken from), the last steps run to land on it
  const playTo = to => page.evaluate(async to => {
    const T = window.__tape, e = window.__engine;
    const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    let s = T.state, frames = 0; T.play();
    for (let i = 0; i < 600 && !s.ended && s.f < to - 6; i++) { window.__runFrames(1, 0.1); frames++; await e.device.queue.onSubmittedWorkDone(); await tick(); s = T.state; }
    T.pause(); s = T.state; if (s.f < to) { s = T.run(to - s.f, true); await e.device.queue.onSubmittedWorkDone(); await tick(); }
    window.__sndlanes.paint();
    return { state: T.state, rows: window.__sndlanes.rowNames(), events: window.__sndlanes.events().length, frames };
  }, to);

  // 1. the lanes fill as it plays
  const a = await walk(Math.max(60, first - 40));
  const b0 = a.rows.length, e0 = a.events;
  line(await page.locator('#sndl').count() === 1 && b0 > 0 && e0 > 0, 'lanes are up and hold what has played', `${b0} lanes, ${e0} sounds at step ${a.state.f}`);
  line(!a.rows.some(r => r.name === toy), `a sound not yet played has no lane`, toy);
  const box = await page.evaluate(() => { const r = document.querySelector('#sndl .rows').getBoundingClientRect(), lb = document.querySelector('#sndl .lb').getBoundingClientRect(), at = document.elementFromPoint(lb.left + 20, lb.top + lb.height / 2);
    return { h: r.height, hit: at ? at.className : '' }; });
  line(box.h >= 13 && /\blb\b/.test(box.hit), 'the open panel has height and a lane\'s name can be clicked', `${box.h} px tall, the point on the first name is '${box.hit}'`);
  // 1b. the panel as it is laid out: opaque, clear of the map, only the caret folds it, the wheel sets how many seconds the lanes show
  const cross = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const lay = () => page.evaluate(() => { const L = window.__sndlanes; L.paint(); const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    return { bg: getComputedStyle(document.querySelector('#sndl')).backgroundColor, map: q('#tapemap'), panel: q('#sndl'), card: q('#sndcard'), oldMap: !!(document.querySelector('#tapemap') || { style: {} }).style.bottom, kit: q('#equip'), bar: q('#tapebar'), search: location.search, copy: q('#sndl .hd .copy'), open: !!document.querySelector('#sndl:not(.shut)'), caret: document.querySelector('#sndl .hd .car').textContent,
      hd: [...document.querySelector('#sndl .hd').children].filter(e => !e.hidden).map(e => ({ text: e.textContent, left: e.getBoundingClientRect().left })), view: L.view(), kept: localStorage.getItem('twopointsix.soundlanes') || '' }; });
  const l0 = await lay(), alpha = (/^rgba\(.*,\s*([\d.]+)\)$/.exec(l0.bg) || [0, /^rgb\(/.test(l0.bg) ? 1 : 0])[1];
  line(+alpha === 1, 'the panel\'s background is opaque', l0.bg);
  // (the map is the replay bar's: its rework stands it at the top right, clear of the dock. A bar from before that rework hangs the map over the bar by an inline `bottom` and
  //  it reaches into the dock; that is said, not counted — the lanes do not move another file's element)
  const mapClear = l => !cross(l.map, l.panel) || l.oldMap;
  if (l0.oldMap && cross(l0.map, l0.panel)) console.log(`- NOTE — this build's replay bar still hangs the map over the bar (bottom ${Math.round(l0.map.bottom)}, dock top ${Math.round(l0.panel.top)}): it reaches into the dock until the bar's rework is in`);
  const tall = await page.evaluate(() => { const d = document.querySelector('#sndl'), hd = d.querySelector('.hd'), rl = d.querySelector('.rl'), c = d.querySelector('.hd .copy'), rows = window.__sndlanes.rowNames().length;
    return { h: d.getBoundingClientRect().height, want: Math.max(120, Math.min(260, hd.offsetHeight + rl.offsetHeight + rows * 13 + 2)), rows, v: document.documentElement.style.getPropertyValue('--sndl-h'), copy: !!c && c.getBoundingClientRect().width > 0, picks: window.__sndlanes.copyText() }; });
  line(Math.abs(tall.h - tall.want) < 1.5 && tall.h < 260 && tall.h >= 120 && tall.v === `${Math.round(tall.h)}px`, 'with no card up the dock is as tall as its head, ruler and lanes, and says so in --sndl-h', `${Math.round(tall.h)} px for ${tall.rows} lanes, --sndl-h ${tall.v}`);
  line(!tall.copy && / none$/.test(tall.picks), 'with nothing picked there is no "copy picks" button', tall.picks);
  line(!!l0.map && l0.open && mapClear(l0), 'the map does not cover the open panel', l0.map ? `map bottom ${Math.round(l0.map.bottom)}, panel top ${Math.round(l0.panel.top)}` : 'no map on this page');
  await page.mouse.click(l0.hd[1].left + 20, l0.panel.top + 10);   // (the tally: not the caret)
  const l1 = await lay();
  await page.locator('#sndl .hd .car').click(); const l2 = await lay();
  await page.locator('#sndl .hd .car').click(); const l3 = await lay();
  line(l1.open && l0.caret === '▾' && !l2.open && l2.caret === '▸' && l3.open, 'a click on the head away from the caret folds nothing; the caret folds and unfolds', `${l0.caret} → ${l2.caret} → ${l3.caret}`);
  const wh = { x: l0.panel.left + l0.view.gutter + l0.view.width / 2, y: l0.panel.bottom - 6 };
  await page.mouse.move(wh.x, wh.y); await page.mouse.wheel(0, 120); const w1 = await lay();
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 120); const w2 = await lay();
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -120); const w3 = await lay();
  await page.waitForTimeout(500); const w3k = await lay();   // (the span is written a moment after the last change, not per wheel event)
  // the − and + beside the ruler do what the wheel does, where it can be seen
  await page.locator('#sndl .rl .gut button').last().click(); const z1 = await lay();
  await page.locator('#sndl .rl .gut button').first().click(); const z2 = await lay();
  await page.evaluate(() => { const L = window.__sndlanes; L.span = 30; L.keepOpen(); }); const w4 = await lay();
  line(l0.view.span === 30 && w1.view.span > 30 && w1.view.span <= 38 && w2.view.span === 120 && w3.view.span === 10 && /"span":10/.test(w3k.kept) && w4.view.span === 30, 'the wheel over the lanes sets the seconds they show, 10 to 120, a quarter at most a notch, and it is kept', `${l0.view.span} → ${w1.view.span} → ${w2.view.span} → ${w3.view.span} s · kept ${w3k.kept}`);
  line(z1.view.span > 10 && z1.view.span <= 13 && z2.view.span === 10, 'the + and − beside the ruler show more and fewer seconds', `10 → ${z1.view.span} → ${z2.view.span} s`);

  // 2. a pick made on the card is the buffer the mixer plays next
  const picked = await page.evaluate(toy => {
    const L = window.__sndlanes, before = L.takesOf(toy);
    L.pick(toy, { take: 'new 1' });
    return { before, after: L.takesOf(toy) };
  }, toy);
  line(picked.before.takes.includes('new 1') && picked.before.takes.includes('before') && picked.before.takes.includes('after'), `${toy} offers before, after and new takes`, picked.before.takes.join(' · '));
  line(picked.after.trim && picked.after.trim.take === `${toy}@new 1`, 'a pick loads its take into the mixer', JSON.stringify(picked.after.trim));
  await page.evaluate(() => { window.__bufs.length = 0; });
  // (run most of the way, then PLAYED: the last second and a half, fifteen drawn frames, are what the hear-again picture below is taken from — a software frame is dear)
  const PLAYED = 90; const END = Math.min(row.steps, Math.max(first + 240, 1230)); await walk(END - PLAYED);   // (at least 20.5 s in: the line below wants twenty seconds of marks, wherever the replay first plays the toy)
  const b = await playTo(END);
  const bufs = await page.evaluate(() => window.__bufs.slice());
  const lane = b.rows.find(r => r.name === toy);
  line(!!lane && lane.asked > 0 && b.rows.length > b0 && b.events > e0, 'lanes grew as it played on', `${b.rows.length} lanes, ${b.events} sounds at step ${b.state.f}`);
  line(bufs.includes(`${toy}@new 1`) && !bufs.includes(toy), 'the replay plays the picked take', `${bufs.filter(x => x.startsWith(toy)).length} of ${bufs.length} plays`);

  // 3. a click on a mark opens its card; a flag and a note come out as text
  const hit = await page.evaluate(toy => {
    const L = window.__sndlanes; if (L.cardOf) L.shut();
    const lb = [...document.querySelectorAll('#sndl .lb')].find(x => x.textContent === toy);
    lb.scrollIntoView({ block: 'center' });
    L.paint(); const r = document.querySelector('#sndl .rows canvas').getBoundingClientRect(), lr = lb.getBoundingClientRect(), v = L.view(), ev = L.events(), t = ev.filter(e => e.name === toy).pop().t;
    const xs = ev.filter(e => e.t >= v.t0 && e.t <= v.t0 + v.span).map(e => (e.t - v.t0) / v.span * v.width);
    return { y: lr.top + lr.height / 2, x0: r.left, w: r.width, t, x: r.left + (t - v.t0) / v.span * v.width + 1, view: v, now: v.now, spread: xs.length ? (Math.max(...xs) - Math.min(...xs)) / v.width : 0, marks: xs.length };
  }, toy);
  line(hit.now >= 20 && hit.spread > 1 / 3 && Math.abs(hit.w - hit.view.width) < 2, 'twenty seconds in, the marks are spread over the lanes, not bunched at one end', `${hit.marks} marks over ${Math.round(hit.spread * 100)} % of ${Math.round(hit.w)} px, ${hit.view.span} s shown from ${hit.view.t0.toFixed(1)} s, now ${hit.now.toFixed(1)} s`);
  await page.mouse.click(hit.x, hit.y);   // (the lanes map their own window of seconds to their width)
  const opened = await page.evaluate(() => { const c = document.querySelector('#sndcard'); return c && c.getBoundingClientRect().width > 0 ? c.textContent : ''; });
  line(opened.includes(toy), 'a click on a mark opens that sound\'s card', opened.slice(0, 60).replace(/\s+/g, ' '));
  // the card is a column INSIDE the dock; the dock is one opaque box that covers neither the map nor the game's kit column, and nothing of it says what it does in a tooltip
  const dock = await lay(), inside = (a, b) => !!a && !!b && a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5, kitOn = !!dock.kit && dock.kit.right > dock.kit.left && dock.kit.bottom > dock.kit.top;
  line(Math.abs((dock.panel.bottom - dock.panel.top) - 260) < 1.5 && (await page.evaluate(() => document.documentElement.style.getPropertyValue('--sndl-h'))) === '260px', 'with the card up the dock is 260 px, and --sndl-h follows', `${Math.round(dock.panel.bottom - dock.panel.top)} px`);
  line(inside(dock.card, dock.panel) && dock.card.right - dock.card.left >= 300 && Math.abs(dock.view.width + dock.view.gutter + (dock.card.right - dock.card.left) - (dock.panel.right - dock.panel.left)) < 2, 'the card opens inside the dock, as a column right of the lanes', dock.card ? `card ${Math.round(dock.card.left)}–${Math.round(dock.card.right)} × ${Math.round(dock.card.top)}–${Math.round(dock.card.bottom)} in dock ${Math.round(dock.panel.left)}–${Math.round(dock.panel.right)} × ${Math.round(dock.panel.top)}–${Math.round(dock.panel.bottom)}, lanes ${Math.round(dock.view.width)} px` : 'no card');
  line(mapClear(dock) && Math.abs(dock.panel.bottom - (dock.bar ? dock.bar.top : dock.panel.bottom)) < 1.5, 'the dock sits on the bar and does not meet the map', `dock top ${Math.round(dock.panel.top)}, map bottom ${dock.map ? Math.round(dock.map.bottom) : '—'}, kit ${kitOn ? `${Math.round(dock.kit.top)}–${Math.round(dock.kit.bottom)} at x ${Math.round(dock.kit.left)}–${Math.round(dock.kit.right)}` : 'not drawn'}`);
  // (the game's HUD is not the lanes' to move: where its kit column still reaches into the dock it is said, for whoever lifts the HUD by --sndl-h, and not counted)
  if (kitOn && cross(dock.panel, dock.kit)) console.log(`- NOTE — the game HUD's kit column (#equip, y ${Math.round(dock.kit.top)}–${Math.round(dock.kit.bottom)}) reaches under the dock (top ${Math.round(dock.panel.top)}): the HUD is not lifted by --sndl-h yet`);
  const said = await page.evaluate(() => { const all = [...document.querySelectorAll('#sndl button')], ok = /^[▶✕MS▾▸−+]$/; return { glyphs: all.map(b => b.textContent.trim()).filter(t => [...t].length < 3 && !ok.test(t)), long: [...document.querySelectorAll('#sndl [title]')].map(e => e.title).filter(t => t.trim().split(/\s+/).length > 4), n: all.length }; });
  line(!said.glyphs.length && !said.long.length, 'every button in the dock says what it does in a word; no sentence hides in a tooltip', `${said.n} buttons${said.glyphs.length ? `, glyph-only: ${said.glyphs.join(' ')}` : ''}${said.long.length ? `, long titles: ${said.long.join(' | ')}` : ''}`);
  line(/[?&]soundlanes(=(?!0)|&|$)/.test(dock.search), 'the page kept the flag through the replay\'s redirect', dock.search);
  const card = await page.evaluate(() => ({ takes: [...document.querySelectorAll('#sndcard .tk button')].map(x => x.textContent), sliders: document.querySelectorAll('#sndcard input[type=range]').length }));
  line(card.takes.includes('new 1') && card.sliders >= 3, 'the card offers takes and three dials', `${card.takes.join(' · ')} · ${card.sliders} dials`);
  await page.locator('#sndcard .fl button').first().click();
  await page.locator('#sndcard .fl input').fill('too clicky');
  await page.locator('#sndcard .fl input').dispatchEvent('change');
  const text = await page.evaluate(() => window.__sndlanes.copyText());
  line(text.includes(`${toy}: new 1`) && /FLAG at .+ \d+:\d\d/.test(text) && text.includes('too clicky'), 'the picks, the flag and the note come out as one line', text);
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}.png`) }); }

  // 3b. the keys stay the replay's: no control of the card keeps the keyboard, and Esc in the note field reaches nothing but the field
  await page.locator('#sndcard .fl input').focus();
  await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => ({ menu: !!(window.__menu && window.__menu.isOpen), held: document.activeElement ? document.activeElement.tagName : '', card: !!document.querySelector('#sndcard'), state: window.__tape.state }));
  line(!esc.menu && esc.held !== 'INPUT' && esc.card && !esc.state.drift, 'Esc in the note field lets go of the field and opens nothing', `menu ${esc.menu}, focus on ${esc.held}`);
  await page.locator('#sndcard .t button').first().click();
  const held = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : '');
  line(held !== 'BUTTON' && held !== 'INPUT', 'a pressed button does not keep the keyboard', `focus on ${held}`);

  // 3t. a sound TUNED on its card: a layer's line opened, one of its dials moved — the take that is up is 'tuned', the buffer the mixer plays next is no longer the
  //     base take's, the number is in what 'copy picks' hands over; the tune taken back, the mixer has the take it had
  const tn = await page.evaluate(toy => { const L = window.__sndlanes; return [toy, ...L.rowNames().map(r => r.name)].find(n => L.tuneState(n).layers.length > 1) || ''; }, toy);
  if (!tn) line(false, 'a sound of this replay is built of layers');
  else {
    const t0 = await page.evaluate(tn => { const L = window.__sndlanes; if (L.cardOf !== tn || !document.querySelector('#sndcard')) L.show(tn); return { ...L.tuneState(tn), rows: document.querySelectorAll('#sndcard .ly .l').length, pick: JSON.stringify(L.picks()[tn] || {}) }; }, tn);
    line(t0.rows === t0.layers.length && t0.take !== 'tuned', `${tn}'s card lists its layers`, `${t0.rows} lines for ${t0.layers.length} layers of '${t0.base}'`);
    await page.locator('#sndcard .ly .l').first().click();
    const dials = await page.locator('#sndcard .lp input[type=range]').count();
    const moved = await page.evaluate(() => { const s = document.querySelector('#sndcard .lp input[type=range]'); if (!s) return null; const n0 = s.parentElement.querySelector('input:not([type=range])').value; const lo = +s.min, hi = +s.max, v = +s.value;
      s.value = String(v - lo > hi - v ? lo + (v - lo) * 0.25 : hi - (hi - v) * 0.25); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      return { held: document.activeElement ? document.activeElement.tagName : '', was: n0 }; });
    await page.evaluate(() => { window.__sndlanes.flush(); window.__bufs.length = 0; });
    await page.locator('#sndcard .t button').first().click();
    const t1 = await page.evaluate(tn => { const L = window.__sndlanes; return { ...L.tuneState(tn), trim: L.takesOf(tn).trim, bufs: window.__bufs.slice(), text: L.copyText(), is: (document.querySelector('#sndcard .tk button.is') || {}).textContent || '', ch: document.querySelectorAll('#sndcard .ch').length, nums: document.querySelectorAll('#sndcard .lp input:not([type=range])').length }; }, tn);
    line(dials > 0 && !!moved && moved.held !== 'INPUT' && t1.nums >= dials, 'a click on a layer opens its dials, each with its number, and a moved dial does not keep the keyboard', `${dials} dials, ${t1.nums} numbers`);
    line(t1.take === 'tuned' && t1.is === 'tuned' && t1.diff > 1e-5 && !!t1.trim && t1.trim.take === `${tn}@tuned` && t1.ch > 0, 'a layer\'s dial moved: the take is \'tuned\', and its buffer is not the base take\'s', `take ${t1.take} from ${t1.base}, largest sample difference ${t1.diff.toFixed(4)}, ${t1.ch} marked changed`);
    line(t1.bufs.includes(`${tn}@tuned`), 'the mixer plays the tuned buffer next', t1.bufs.join(' '));
    line(new RegExp(`${tn}: tuned from ${t1.base} · L0 \\w+ [^·]*\\d`).test(t1.text), 'copy picks carries the number, in its unit', t1.text);
    // the moved dial still SHOWS what it was moved to once the card is filled again (it used to go back to the number as written), and the card says the buffer's peak
    const shown = await page.evaluate(() => { const d = document.querySelector('#sndcard .lp .d'), n = d && d.querySelector('input:not([type=range])'), sp = document.querySelector('#sndcard canvas.sp');
      return { ch: !!d && d.classList.contains('ch'), v: n ? n.value : '', peak: sp ? sp.dataset.peak || '' : '' }; });
    line(shown.ch && shown.v !== '' && shown.v !== moved.was, 'the dial let go of still shows the number it was moved to, marked changed', `${moved.was} → ${shown.v}`);
    line(/^peak [+−][\d.]+ dBFS/.test(shown.peak), 'the card says the peak of what the mixer is handed', shown.peak);
    // Esc in a dial's number field is 'never mind': nothing applied, nothing kept, the number back, the keys the replay's
    const pickB = await page.evaluate(tn => JSON.stringify(window.__sndlanes.picks()[tn] || {}), tn);
    await page.locator('#sndcard .lp input:not([type=range])').first().click();
    await page.keyboard.type('9999'); await page.keyboard.press('Escape');
    const esc = await page.evaluate(tn => { const n = document.querySelector('#sndcard .lp input:not([type=range])'); window.__sndlanes.flush();
      return { pick: JSON.stringify(window.__sndlanes.picks()[tn] || {}), v: n ? n.value : '', held: document.activeElement ? document.activeElement.tagName : '', menu: !!document.querySelector('#menu.open, #menu:not([hidden]).pause') }; }, tn);
    line(esc.pick === pickB && esc.v !== '9999' && esc.v !== '' && esc.held !== 'INPUT', 'Esc in a number field throws the typed number away', `typed 9999, the field reads ${esc.v}`);
    // a seed typed, then a button pressed straight from the field: the press still lands (the card is not filled again under it)
    const hasSeed = await page.locator('#sndcard .sd input').count();
    if (hasSeed) {
      await page.locator('#sndcard .sd input').click(); await page.keyboard.type('4242');
      await page.evaluate(() => { window.__sndlanes.flush(); window.__bufs.length = 0; });
      await page.locator('#sndcard .t button').first().click();
      const sd = await page.evaluate(tn => { const L = window.__sndlanes; L.flush(); return { seed: (L.tuneState(tn).tune || {}).seed, bufs: window.__bufs.slice() }; }, tn);
      line(sd.seed === 4242 && sd.bufs.filter(b => b === `${tn}@tuned`).length >= 2, 'a seed typed and ▶ pressed from the field: the seed is taken and the press lands', `seed ${sd.seed}, played ${sd.bufs.join(' ')}`);
    }
    const t2 = await page.evaluate(([tn, pick]) => { const L = window.__sndlanes, was = JSON.parse(pick); L.pick(tn, { take: was.take || L.takesOf(tn).game, tune: undefined }); L.flush(); return { pick: JSON.stringify(L.picks()[tn] || {}), trim: L.takesOf(tn).trim }; }, [tn, t0.pick]);
    line(t2.pick === t0.pick && (!t2.trim || t2.trim.take !== `${tn}@tuned`), 'the tune taken back: the pick and the mixer as they were', t2.pick);
  }

  // 3c. checkpoints: one set where the tape stands, one behind it; a click on the one behind hands that stretch's sounds back to the mixer under the picks AS THEY
  //     ARE NOW, files no new mark and runs no step; a take changed and "again" pressed is heard in the new take; a right click takes a checkpoint away
  const chipAt = i => page.evaluate(i => { window.__sndlanes.paint(); const r = [...document.querySelectorAll('#sndl .rl .cp:not([hidden])')].map(c => c.getBoundingClientRect()).sort((a, b) => a.left - b.left)[i]; return r ? { x: r.left + r.width / 2, y: r.top + 4, x0: r.left } : null; }, i);
  const re = () => page.evaluate(() => { const L = window.__sndlanes; L.reStep(1000); L.paint(); return { ...L.relistening(), bufs: window.__bufs.slice(), events: L.events().length, state: window.__tape.state, cps: L.checkpoints() }; });
  const ev1 = await page.evaluate(() => window.__sndlanes.events().length);
  await page.locator('#sndl .hd .add').click();
  const set = await page.evaluate(behind => { const L = window.__sndlanes; L.checkpoint(behind); L.paint();
    return { cps: L.checkpoints(), f: window.__tape.state.f, chips: document.querySelectorAll('#sndl .rl .cp').length, words: [...document.querySelectorAll('#sndl .hd .chip')].map(c => c.textContent), nums: [...document.querySelectorAll('#sndl .rl .cp')].map(c => c.textContent).join(), open: !!document.querySelector('#sndl:not(.shut)'), held: document.activeElement ? document.activeElement.tagName : '', kept: localStorage.getItem('twopointsix.soundlanes.cp') || '' }; }, first - 20);
  line(set.cps.length === 2 && set.cps[0] === first - 20 && set.cps[1] === set.f && set.chips === 2 && set.open && set.held !== 'BUTTON', 'a checkpoint is set with one click, and the panel and the keys are left alone', `checkpoints at ${set.cps.join(', ')}, ${set.chips} on the strip, focus on ${set.held}`);
  line(set.words.length === 2 && /^1 \d+:\d\d×$/.test(set.words[0]) && /^2 \d+:\d\d×$/.test(set.words[1]) && set.nums === '1,2', 'each checkpoint is numbered, in the head and on the ruler, and its chip carries a ×', `${set.words.join(' · ')} · flags ${set.nums}`);
  const l4 = await lay(), words = l4.hd.map(e => e.text.replace(/\d+ \d+:\d\d×/g, '#').replace(/^\d+ sounds?.*/, 'tally').replace(/from \d+:\d\d/, 'from #').replace(/\(\d+\)/, '(#)'));
  line(words.join('|') === '▾|tally|＋ checkpoint|##|↺ again from #|⟳ loop|copy picks (#)' && l4.hd.every(e => e.left < 760) && !!l4.map && !cross(l4.copy, l4.map) && mapClear(l4), 'the head\'s controls are words, in a row at the left, none under the map', `${l4.hd.map(e => `${e.text} @${Math.round(e.left)}`).join(' · ')}${l4.map ? ` · map from ${Math.round(l4.map.left)}` : ' · no map'}`);
  // kept in the order they were set (a seventh lets the OLDEST-SET go), so ask for the two steps, not for an order
  const keptSteps = (() => { try { return Object.values(JSON.parse(set.kept)).map(a => [...a].sort((x, y) => x - y).join()); } catch { return []; } })();
  line(keptSteps.includes(`${first - 20},${set.f}`), 'checkpoints are kept for this replay', set.kept.slice(0, 90));
  await page.evaluate(() => { window.__bufs.length = 0; });
  const c0 = await chipAt(0);
  const going = await page.evaluate(() => { const L = window.__sndlanes; document.querySelector('#sndl .hd .chip').click(); L.paint();   /* (in one turn of the page: its own frames tick the stretch too) */ const q = s => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; };
    return { ...L.relistening(), back: document.querySelector('#sndl .hd .back').textContent, is: document.querySelector('#sndl .hd .back').classList.contains('is'), head: q('#sndl .ov .reh'), band: q('#sndl .ov .band'), held: document.activeElement ? document.activeElement.tagName : '' }; });
  if (OUT) await page.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}-again.png`), timeout: 20000 }).catch(() => {});
  const r1 = await re();
  line(going.from === first - 20 && going.n > 0, 'a click on a checkpoint\'s chip behind the tape starts that stretch again', `from step ${going.from}, ${going.n} sounds to hand back`);
  line(going.back === '■ stop' && going.is && going.head && going.band && going.held !== 'BUTTON', 'while it is heard again the head says so: "■ stop", its own head and its stretch on the lanes', `${going.back}, head ${going.head}, band ${going.band}`);
  line(!r1.on && r1.played === going.n && r1.bufs.length === going.n && r1.bufs.includes(`${toy}@new 1`) && !r1.bufs.includes(toy), 'the stretch is heard again in the picked take', `${r1.bufs.length} sounds, ${r1.bufs.filter(x => x.startsWith(toy)).join(' ')}`);
  line(r1.events === ev1 && r1.state.f === set.f && !r1.state.drift && !r1.state.unjournaled, 'hearing it again files no mark and runs no step', `${r1.events} marks, step ${r1.state.f}`);
  await page.evaluate(toy => { window.__sndlanes.pick(toy, { take: 'new 2' }); window.__bufs.length = 0; }, toy);
  await page.locator('#sndl .hd .back').click();
  const r2 = await re();
  line(r2.bufs.includes(`${toy}@new 2`) && !r2.bufs.includes(`${toy}@new 1`) && r2.events === ev1, 'a take changed, then "again": the same stretch in the new take', `${r2.bufs.length} sounds, ${r2.bufs.filter(x => x.startsWith(toy)).join(' ')}`);
  await page.evaluate(toy => { window.__sndlanes.pick(toy, { take: 'new 1' }); window.__sndlanes.paint(); }, toy);
  const c1 = await chipAt(0); await page.mouse.click(c1.x, c1.y); const flagged = await re();   // (the flag on the ruler does what its chip does)
  line(flagged.from === first - 20 && flagged.events === ev1, 'a click on a checkpoint\'s flag on the ruler hears from there too', `from step ${flagged.from}`);
  await page.mouse.click(c1.x, c1.y, { button: 'right' });
  const gone = await page.evaluate(() => { const L = window.__sndlanes; L.paint(); return { cps: L.checkpoints(), chips: document.querySelectorAll('#sndl .rl .cp').length + document.querySelectorAll('#sndl .hd .chip').length, on: L.relistening().on }; });
  line(gone.cps.length === 1 && gone.chips === 2 && !gone.on, 'a right click on a flag takes its checkpoint away', `left: ${gone.cps.join(', ')}`);
  // … and so does the × its chip carries (what can be SEEN to do it); every control of the head and every chip says what it is under the pointer
  await page.evaluate(f => { const L = window.__sndlanes; L.checkpoint(f); L.paint(); }, first - 30);
  await page.locator('#sndl .hd .chip i').first().click();
  const xed = await page.evaluate(() => { const L = window.__sndlanes; L.paint(); return { cps: L.checkpoints(), on: L.relistening().on, bare: [...document.querySelectorAll('#sndl .hd button, #sndl .hd .chip i, #sndl .rl .cp, #sndl .rl .gut button')].filter(e => !e.title).map(e => e.textContent) }; });
  line(xed.cps.length === 1 && xed.cps[0] === gone.cps[0] && !xed.on && !xed.bare.length, 'the × on a chip takes that checkpoint away and hears nothing; every control of the head has a title', `left: ${xed.cps.join(', ')}${xed.bare.length ? ` · no title: ${xed.bare.join(' | ')}` : ''}`);
  await page.mouse.click((hit.x0 + c0.x) / 2, c0.y);   // (the strip itself, half way to where the checkpoint was: from there)
  const strip = await page.evaluate(() => window.__sndlanes.relistening());
  await page.locator('#sndl .hd .back').click();
  const cut = await page.evaluate(() => ({ ...window.__sndlanes.relistening(), state: window.__tape.state }));
  line(strip.on && strip.from < first - 20 && !cut.on && cut.state.f === set.f, 'a click on the strip hears it from there, and the same button stops it', `from step ${strip.from}`);

  // 3d. a stretch on a LOOP: ⟳ on, a stretch [first - 20, first] set — pass after pass asked of the mixer with no step run and no mark filed, each under the takes as
  //     they stand when it starts; ■ ends it; a stretch that stops short of a sound does not play it; ⟳ off = one pass; a drag on the strip sets the stretch, a click lets it go
  //     (each part in ONE turn of the page: its own frames tick a stretch too, and a loop never ends by itself)
  // 3p. THE PICTURE: the stretch heard again shows the frames drawn while it played, in step with its head, over the game's view; stopped, it is gone
  const pic = await page.evaluate(async played => {
    const L = window.__sndlanes, wait = ms => new Promise(r => setTimeout(r, ms)), v = document.getElementById('view');
    const read = () => { const e = document.getElementById('sndfilm'); if (!e || getComputedStyle(e).display === 'none') return null;
      const c = document.createElement('canvas'); c.width = 96; c.height = 54; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(e, 0, 0, 96, 54);
      const r = e.getBoundingClientRect(), vr = v.getBoundingClientRect(), d = x.getImageData(0, 0, 96, 54).data; let lum = 0; for (let i = 0; i < d.length; i += 4) lum += d[i] + d[i + 1] + d[i + 2];
      const dock = document.querySelector('#sndl').getBoundingClientRect(), cs = getComputedStyle(e), tag = document.getElementById('sndfilmtag'), tr = tag && !tag.hidden ? tag.getBoundingClientRect() : null, vis = id => { const h = document.getElementById(id); return h ? getComputedStyle(h).visibility : 'none'; };
      // (laid in what the dock leaves of the view: its box ends at the dock's top, so all four of its edges are in sight; the picture inside keeps its aspect)
      return { d: Array.from(d), lum: lum / (d.length / 4 * 3), over: Math.abs(r.left - vr.left) < 3 && Math.abs(r.top - vr.top) < 3 && Math.abs(r.width - vr.width) < 4 && Math.abs(r.bottom - dock.top) < 1.5 && r.bottom <= innerHeight && r.right <= innerWidth + 0.5,
        edge: parseFloat(cs.outlineWidth) >= 1 && cs.outlineStyle === 'solid' && cs.outlineColor === 'rgb(127, 200, 255)' && cs.objectFit === 'contain', box: `${Math.round(r.width)}×${Math.round(r.height)} to y ${Math.round(r.bottom)}, dock from ${Math.round(dock.top)}`,
        tag: tr ? tag.textContent : '', tagIn: !!tr && tr.left >= r.left && tr.top >= r.top && tr.bottom <= r.bottom, cls: document.body.classList.contains('sndfilm-on'), hud: ['equip', 'meters', 'log', 'objective', 'lcol'].map(vis).join(), bar: vis('tapebar'), map: vis('tapemap') }; };
    const hudOf = () => ({ cls: document.body.classList.contains('sndfilm-on'), hud: ['equip', 'meters', 'log', 'objective', 'lcol'].map(id => getComputedStyle(document.getElementById(id)).visibility).join(), map: getComputedStyle(document.getElementById('tapemap')).visibility, tag: !!document.querySelector('#sndfilmtag:not([hidden])') });
    const was = L.loop(), before = !!read(), hud0 = hudOf(); L.loop(true); L.relisten(window.__tape.state.f - played); L.reStep(0.15); await wait(700); L.paint(); const a = read(), t1 = L.relistening().t;
    L.reStep(0.7); await wait(700); L.paint(); const b = read(), r2 = L.relistening(), tag = b ? b.tag : '';
    if (r2.on) document.querySelector('#sndl .hd .back').click(); L.paint(); await wait(150); const off = read(), hud1 = hudOf(); L.loop(was);
    let diff = -1; if (a && b) { diff = 0; for (let i = 0; i < a.d.length; i++) diff += Math.abs(a.d[i] - b.d[i]); diff /= a.d.length; }
    return { before, a: !!a, b: !!b, over: !!a && a.over, lum: a ? a.lum : 0, diff, on: r2.on, t1, t2: r2.t, off: !off, tag, f: window.__tape.state.f, hud0, hud1, shown: a ? { edge: a.edge, box: a.box, tag: a.tag, tagIn: a.tagIn, cls: a.cls, hud: a.hud, bar: a.bar, map: a.map } : null };
  }, PLAYED - 6);
  line(!pic.before && pic.a && pic.b && pic.over && pic.lum > 2 && pic.on && !!pic.shown && pic.shown.edge, 'heard again, the recorded picture is laid in the view above the dock, whole, a cyan edge on all four sides', `mean luminance ${pic.lum.toFixed(1)}, ${pic.shown ? pic.shown.box : 'not shown'} · ${b.frames} frames were played`);
  line(!!pic.shown && /^↺ recorded \d+:\d\d$/.test(pic.shown.tag) && pic.shown.tagIn && /^↺ recorded \d+:\d\d$/.test(pic.tag), 'a tag in its corner says what it is and when: "↺ recorded m:ss"', pic.shown ? `"${pic.shown.tag}" → "${pic.tag}"` : '');
  line(!!pic.shown && !pic.hud0.cls && pic.hud0.hud !== pic.shown.hud && pic.shown.cls && pic.shown.hud === 'hidden,hidden,hidden,hidden,hidden' && pic.shown.bar === 'visible' && !pic.hud1.cls && pic.hud1.hud === pic.hud0.hud && !pic.hud1.tag, 'while it is up the game\'s live HUD is out of the way, the bar stays; stopped, the HUD is back', pic.shown ? `HUD ${pic.hud0.hud.split(',')[0]} → ${pic.shown.hud.split(',')[0]} → ${pic.hud1.hud.split(',')[0]}, bar ${pic.shown.bar}` : '');
  // (the replay's corner map shows where everyone is NOW, and sat on the recorded picture's corner: it goes with the HUD and comes back with it)
  line(!!pic.shown && pic.hud0.map === 'visible' && pic.shown.map === 'hidden' && pic.hud1.map === 'visible', 'the replay\'s corner map is out of the way with it, and back exactly when the HUD is', pic.shown ? `map ${pic.hud0.map} → ${pic.shown.map} → ${pic.hud1.map}` : '');
  line(pic.diff > 0.05, 'and it moves with the stretch\'s head: a little on, another picture', `mean difference ${pic.diff.toFixed(2)} of 255 between ${(+pic.t1 || 0).toFixed(1)} s and ${(+pic.t2 || 0).toFixed(1)} s`);
  line(pic.off && pic.f === set.f, 'stopped, the picture is gone and the tape is where it stood', `step ${pic.f}`);
  // where the film holds nothing (emptied here; on a real page: before its first frame after a load, or a stretch a seek ran over), the view says so where the picture would be
  const nop = await page.evaluate(async played => {
    const L = window.__sndlanes, wait = ms => new Promise(r => setTimeout(r, ms)), stats = { ...L.film.stats }, v = document.getElementById('view').getBoundingClientRect(), dock = document.querySelector('#sndl').getBoundingClientRect();
    const tag = () => { const e = document.getElementById('sndnopic'); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { text: e.textContent, edge: getComputedStyle(e).borderTopColor, in: r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= dock.top, w: r.width }; };
    const before = tag(); L.film.clear(); const empty = L.film.stats.kept;
    L.relisten(window.__tape.state.f - played); L.reStep(0.2); L.paint(); const on = tag(), film = !!document.getElementById('sndfilm') && getComputedStyle(document.getElementById('sndfilm')).display !== 'none', going = L.relistening().on;
    document.querySelector('#sndl .hd .back').click(); L.paint(); await wait(50); const off = tag();
    return { stats, empty, before: !!before, on, film, going, off: !!off, f: window.__tape.state.f };
  }, PLAYED - 6);
  line(nop.stats.taken > 0 && nop.stats.kept > 0 && nop.stats.dropped >= 0 && nop.empty === 0, 'the film\'s counts are on the hook (__sndlanes.film.stats)', `taken ${nop.stats.taken}, dropped ${nop.stats.dropped}, failed ${nop.stats.failed}, kept ${nop.stats.kept}`);
  line(!nop.before && nop.going && !!nop.on && nop.on.in && nop.on.w > 0 && /no picture here/.test(nop.on.text) && nop.on.edge === 'rgb(127, 200, 255)' && !nop.film && !nop.off && nop.f === set.f, 'heard again where no picture was kept: a cyan-edged tag on the view says so, and goes when it stops', nop.on ? `"${nop.on.text}", inside the view above the dock ${nop.on.in}` : 'no tag');
  await page.locator('#sndl .hd .lp').click();
  const lit = await page.evaluate(() => { const L = window.__sndlanes, b = document.querySelector('#sndl .hd .lp'); L.paint();
    const r0 = L.relistening(), v0 = L.view(); L.reStep(0.3); const r1 = L.relistening(), v1 = L.view(); L.reStep(1000); L.reStep(1); L.reStep(0.3); L.paint(); const r2 = L.relistening(), v2 = L.view();
    return { is: b.classList.contains('is'), text: b.textContent, held: document.activeElement ? document.activeElement.tagName : '', loop: L.loop(), kept: sessionStorage.getItem('twopointsix.soundlanes.loop') || '', region: r2.region, band: !!document.querySelector('#sndl .ov .reg:not([hidden])'), handles: document.querySelectorAll('#sndl .ov .hnd:not([hidden])').length, f: window.__tape.state.f,
      r0, r1, r2, v0, v1, v2, back: document.querySelector('#sndl .hd .back').textContent }; });
  line(lit.is && lit.loop && lit.text === '⟳ loop' && lit.held !== 'BUTTON' && /"reg":\[\d+,\d+\]/.test(lit.kept) && lit.kept.includes(`assets/replays/${TAPE}`), 'the loop switch beside "again" lights; it and its stretch are kept for the visit, for this replay', `${lit.text} ${lit.is ? 'lit' : 'unlit'}, kept ${lit.kept}`);
  const look = await page.evaluate(async toy => { const L = window.__sndlanes; if (L.cardOf !== toy || !document.querySelector('#sndcard')) L.show(toy); L.paint();
    const cs = (e, p) => e ? getComputedStyle(e)[p] : '', card = document.querySelector('#sndcard'), kids = [...card.children].map(e => e.className.split(' ')[0]), GREEN = 'rgb(143, 240, 180)';
    const sel = document.querySelector('#sndl .lb.sel'), is = card.querySelector('.tk button.is'), game = card.querySelector('.tk button.game'), rest = card.querySelector('.d:not(.ch) input[type=range]'), units = [...card.querySelectorAll('.d')].map(d => `${d.querySelector('input.n').value} ${d.querySelector('i').textContent}`.trim());
    const green = [...card.querySelectorAll('*')].filter(e => [cs(e, 'color'), cs(e, 'backgroundColor'), cs(e, 'borderTopColor'), cs(e, 'accentColor')].includes(GREEN)).length;
    const rl = document.querySelector('#sndl .rl').getBoundingClientRect(), cps = [...document.querySelectorAll('#sndl .rl .cp:not([hidden])')].map(e => e.getBoundingClientRect()), hn = [...document.querySelectorAll('#sndl .ov .hnd:not([hidden])')].map(e => e.getBoundingClientRect()), now = document.querySelector('#sndl .ov .now');
    const pk = card.querySelector('.pk'), sp = card.querySelector('canvas.sp'), pr = pk ? pk.getBoundingClientRect() : null, sr = sp ? sp.getBoundingClientRect() : null;
    return { kids, selColor: cs(sel, 'color'), selWeight: cs(sel, 'fontWeight'), isBg: cs(is, 'backgroundColor'), isEdge: cs(is, 'borderTopColor'), badge: game ? getComputedStyle(game, '::after').content : '', accent: cs(rest, 'accentColor'), units, green,
      flagsUp: cps.every(r => r.bottom <= rl.top + 14), labelRow: rl.height - 13, handlesLow: hn.length > 0 && hn.every(r => r.top >= rl.bottom - 0.5), nowZ: +cs(now, 'zIndex'), hndZ: Math.max(0, ...[...document.querySelectorAll('#sndl .ov .hnd')].map(e => +cs(e, 'zIndex') || 0)),
      peak: pk ? pk.textContent : '', peakPx: parseFloat(cs(pk, 'fontSize')), peakOut: !!pr && !!sr && pr.top >= sr.bottom - 3.5, more: card.classList.contains('more'), fade: getComputedStyle(card, '::after').position, scrolls: card.scrollHeight > card.clientHeight + 2,
      lanes: await (async () => { const r = document.querySelector('#sndl .rows'), ft = document.querySelector('#sndl .ft'), fd = document.querySelector('#sndl .fd'), gut = document.querySelector('#sndl .lb').getBoundingClientRect();
        // (a frame of the page's own after each scroll: the mark and the fade are read as the page left them — the lanes are not asked to look again)
        const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 5000); });
        const at = () => { const rb = r.getBoundingClientRect(), fr = ft.getBoundingClientRect(); return { below: [...document.querySelectorAll('#sndl .lb')].filter(e => e.getBoundingClientRect().bottom > rb.bottom + 0.5).length, mark: ft.hidden ? null : ft.textContent, fade: !fd.hidden && fd.getBoundingClientRect().height > 0,
          foot: !ft.hidden && fr.height >= 11 && fr.top >= rb.bottom - 0.5 && fr.left >= gut.left - 0.5 && fr.right <= gut.right + 0.5 && fr.bottom <= document.querySelector('#sndl').getBoundingClientRect().bottom + 0.5 }; };
        const was = r.scrollTop; r.scrollTop = r.scrollHeight; await frame(); const end = at(); r.scrollTop = 0; await frame(); const top = at(); r.scrollTop = was; await frame();
        return { top, end, n: L.rowNames().length, room: Math.floor(r.clientHeight / 13), pe: `${getComputedStyle(ft).pointerEvents},${getComputedStyle(fd).pointerEvents}` }; })() }; }, toy);
  line(look.kids.indexOf('t') === 0 && look.kids.indexOf('tk') === 1 && look.kids.indexOf('fl') === 2 && look.kids.indexOf('d3') === 3 && look.kids.indexOf('d3') < look.kids.indexOf('sp') && look.kids.indexOf('sp') < look.kids.indexOf('d') && look.kids.indexOf('d') < look.kids.indexOf('ly'), 'the card runs name and ▶ / again, takes, flag and note, the three dials, then the picture, the take\'s filters, the layers', look.kids.join(' '));
  line(look.green === 0 && look.selColor === 'rgb(255, 255, 255)' && +look.selWeight >= 700 && look.isEdge === 'rgb(255, 255, 255)' && /^rgba\(0, 0, 0, 0\)$/.test(look.isBg) && look.accent !== 'rgb(143, 240, 180)' && /in game/.test(look.badge), 'green is only "now": the picked lane and take are white, a dial at rest is grey, the game\'s take says "in game"', `${look.green} green things on the card, lane ${look.selColor} ${look.selWeight}, take edge ${look.isEdge}, badge ${look.badge}, dial ${look.accent}`);
  line(look.units.some(u => u === 'off') && !look.units.some(u => /^off Hz|×/.test(u)) && /^peak /.test(look.peak) && look.peakPx >= 11 && look.peakOut, 'a dial that is off says "off" alone, the pitch is plain cents, the peak is said under the picture', `${look.units.join(' · ')} · ${look.peak}`);
  line(look.scrolls && look.more && look.fade === 'sticky', 'the card\'s bottom edge fades while there is more of it below', `scrolls ${look.scrolls}, fade ${look.more}`);
  line(look.lanes.n > look.lanes.room && look.lanes.top.below > 0 && look.lanes.top.mark === `▾ ${look.lanes.top.below}` && look.lanes.top.fade && look.lanes.top.foot && look.lanes.end.below === 0 && look.lanes.end.mark === '' && !look.lanes.end.fade && look.lanes.pe === 'none,none',
    'more lanes than fit: the foot of the names says how many are below, the edge above it fades; both gone at the list\'s end, neither takes the pointer', `${look.lanes.n} lanes, room for ${look.lanes.room}: at the top "${look.lanes.top.mark}" for ${look.lanes.top.below} below, faded ${look.lanes.top.fade}; at the end "${look.lanes.end.mark}" for ${look.lanes.end.below}, faded ${look.lanes.end.fade}; pointer-events ${look.lanes.pe}`);
  line(look.flagsUp && look.labelRow >= 15 && look.handlesLow && look.nowZ > look.hndZ, 'the ruler is two rows — flags, then times — the stretch\'s handles hang below it, the tape\'s head is drawn over them all', `label row ${look.labelRow} px, handles below ${look.handlesLow}, z ${look.nowZ} over ${look.hndZ}`);
  line(lit.r0.on && lit.r1.on && lit.r1.t > lit.r0.t && lit.v1.headX > lit.v0.headX && lit.back === '■ stop' && lit.r2.on && lit.r2.passes === 2, '⟳ loop starts looping at once: the stretch is heard, its head moves, a second pass follows', `head ${lit.r0.t.toFixed(2)} → ${lit.r1.t.toFixed(2)} s, pass ${lit.r2.passes}`);
  line(lit.v0.t0 === lit.v1.t0 && lit.v1.t0 === lit.v2.t0 && lit.v0.span === lit.v2.span && lit.v0.now === lit.v2.now, 'the lanes hold still under a loop: the window starts where it did, pass after pass', `from ${lit.v0.t0.toFixed(2)} · ${lit.v1.t0.toFixed(2)} · ${lit.v2.t0.toFixed(2)} s, ${lit.v2.span} s wide`);
  // Esc: the first stops the stretch being heard (the loop stays armed, the card up), the next shuts the card, a third is nobody's — no menu, nothing run
  const escAt = () => page.evaluate(() => ({ on: window.__sndlanes.relistening().on, card: !!document.querySelector('#sndcard'), of: window.__sndlanes.cardOf, menu: !!(window.__menu && window.__menu.isOpen), f: window.__tape.state.f, playing: window.__tape.state.playing, map: window.__tape.state.map }));
  await page.evaluate(() => { const L = window.__sndlanes; if (!document.querySelector('#sndcard')) L.show(L.rowNames()[0].name); });
  const k0 = await escAt(); await page.keyboard.press('Escape'); const k1 = await escAt(); await page.keyboard.press('Escape'); const k2 = await escAt(); await page.keyboard.press('Escape'); const k3 = await escAt();
  line(k0.on && k0.card && !k1.on && k1.card && !k2.on && !k2.card && !k3.menu && !k3.playing && k3.f === lit.f, 'Esc stops the stretch being heard, the next Esc shuts the card, a third does nothing', `heard ${k0.on} → ${k1.on}, card ${k1.card} → ${k2.card}, menu ${k3.menu}`);
  // the bar's keys are still the bar's: M opens its big map and Esc shuts THAT, a stretch being heard goes on under it
  await page.evaluate(() => { window.__sndlanes.relisten(); }); await page.keyboard.press('KeyM'); const m1 = await escAt(); await page.evaluate(() => window.__sndlanes.paint()); await page.keyboard.press('Escape'); const m2 = await escAt();
  line(m1.map && !m2.map && m1.on && m2.on, 'with the bar\'s map up, Esc shuts the map and the stretch plays on', `map ${m1.map} → ${m2.map}, heard ${m2.on}`);
  await page.evaluate(of => { const L = window.__sndlanes; if (!document.querySelector('#sndcard')) L.show(of); L.paint(); }, k0.of);   // (the card back up: the lanes as wide as the places measured above)
  line(!!lit.region && lit.region[0] < lit.region[1] && lit.region[1] === lit.f && lit.band && lit.handles >= 1, 'put on with no stretch set, the loop makes one up to now and shows it on the ruler, with a handle', `steps ${lit.region ? lit.region.join('–') : 'none'}, ${lit.handles} handle(s) in the window`);
  const lp = await page.evaluate(([toy, a, b]) => {
    const L = window.__sndlanes, B = window.__bufs, btn = k => document.querySelector(k === 1 ? '#sndl .hd .back' : '#sndl .hd .lp');
    const snap = () => { const r = { ...L.relistening(), bufs: B.slice(), events: L.events().length, f: window.__tape.state.f, drift: window.__tape.state.drift, reg: false, back: '' }; B.length = 0; return r; };
    B.length = 0; L.region(a, b + 1); L.relisten(); L.reStep(1000); const p1 = snap();
    L.pick(toy, { take: 'new 2' }); L.reStep(0.1); const gap = snap(); L.reStep(1); L.reStep(1000); const p2 = snap();
    L.paint(); p2.back = btn(1).textContent; p2.reg = !!document.querySelector('#sndl .ov .reg:not([hidden])'); B.length = 0; const before = L.relistening().passes;
    btn(1).click(); L.reStep(1); L.reStep(1000); L.reStep(1); L.reStep(1000); const p3 = snap(); L.paint(); p3.back = btn(1).textContent;
    L.region(a, b); L.relisten(); L.reStep(1000); const p4 = snap();
    btn(2).click(); L.reStep(1); const off = snap(); off.gone = !L.relistening().region; L.region(a, b); L.relisten(); L.reStep(1000); L.reStep(1); L.reStep(1000); const p5 = snap();
    return { p1, gap, p2, before, p3, p4, off, p5 };
  }, [toy, first - 20, first]);
  const toyBufs = b => b.filter(x => x.startsWith(toy)).join(' ');
  const { p1, p2, p3, p4, p5 } = lp;
  line(p1.on && p1.passes === 1 && p1.from === first - 20 && p1.to === first + 1 && p1.n > 0 && p1.bufs.length === p1.n && p1.bufs.includes(`${toy}@new 1`), 'a stretch set and heard: its sounds once, and it is still on', `steps ${p1.from}–${p1.to}, ${p1.n} sounds, pass ${p1.passes}`);
  line(lp.gap.on && lp.gap.passes === 1 && !lp.gap.bufs.length && p2.on && p2.passes === 2 && p2.bufs.length === p1.n && p2.bufs.includes(`${toy}@new 2`) && !p2.bufs.includes(`${toy}@new 1`), 'after a short gap a second pass starts by itself, in the take changed meanwhile', `pass ${p2.passes}: ${p2.bufs.length} sounds, ${toyBufs(p2.bufs)}`);
  line(p2.events === ev1 && p2.f === set.f && !p2.drift && p2.back === '■ stop' && p2.reg, 'two passes ran no step and filed no mark', `${p2.events} marks, step ${p2.f}`);
  line(!p3.on && p3.passes === lp.before && !p3.bufs.length && p3.f === set.f && /^↺ again from \d+:\d\d$/.test(p3.back), '■ ends the loop: no further pass', `${p3.passes} passes begun, ${p3.bufs.length} sounds after the stop`);
  line(p4.on && p4.to === first && !toyBufs(p4.bufs) && p4.bufs.length === p4.n && p4.n < p1.n, 'a stretch that stops short of a sound does not play it', `steps ${p4.from}–${p4.to}: ${p4.n} sounds${toyBufs(p4.bufs) ? `, ${toyBufs(p4.bufs)}` : ''}`);
  line(!lp.off.on && !lp.off.loop && lp.off.gone && !p5.on && p5.passes === 1 && p5.bufs.length === p4.n && p5.f === set.f && p5.events === ev1, 'the loop put off takes its stretch with it; a stretch then heard: one pass, and done', `${p5.passes} pass, ${p5.bufs.length} sounds`);
  // the stretch by a drag on the strip (from before the old checkpoint's place up to it; the loop on, so that it is still going when asked), then a plain click lets it go
  await page.evaluate(() => { const L = window.__sndlanes; L.region(0, null); L.loop(true); });
  const dx0 = hit.x0 + (c0.x - hit.x0) * 0.4;
  await page.mouse.move(dx0, c0.y); await page.mouse.down(); await page.mouse.move(dx0 + 3, c0.y); await page.mouse.move((dx0 + c0.x) / 2, c0.y); await page.mouse.move(c0.x0 - 1, c0.y); await page.mouse.up();   // (a flag's box hangs right of its pole: the pole is the step)
  const d1 = await page.evaluate(() => { const L = window.__sndlanes, r = L.relistening(); L.paint(); return { ...r, f: window.__tape.state.f, reg: !!document.querySelector('#sndl .ov .reg:not([hidden])') }; });
  line(!!d1.region && d1.region[0] < d1.region[1] && d1.region[1] <= first - 19 && d1.on && d1.from === d1.region[0] && d1.to === d1.region[1] && d1.reg && d1.f === set.f, 'a drag on the strip sets a stretch, drawn on it, and it is heard at once', `steps ${d1.region ? d1.region.join('–') : 'none'}`);
  // the stretch's right handle dragged left: that end moves, the other stays
  const hd = await page.evaluate(() => { const r = [...document.querySelectorAll('#sndl .ov .hnd:not([hidden])')].map(h => h.getBoundingClientRect()).sort((a, b) => b.left - a.left)[0]; return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 }; });
  await page.mouse.move(hd.x, hd.y); await page.mouse.down(); await page.mouse.move(hd.x - 6, hd.y); await page.mouse.move(hd.x - 40, hd.y); await page.mouse.up();
  const dh = await page.evaluate(() => { const L = window.__sndlanes, r = L.relistening(); L.paint(); return { ...r, handles: document.querySelectorAll('#sndl .ov .hnd:not([hidden])').length }; });
  line(!!dh.region && d1.region && dh.region[0] === d1.region[0] && dh.region[1] < d1.region[1] && dh.region[1] > dh.region[0] && dh.handles === 2 && dh.on && dh.to === dh.region[1], 'a handle dragged moves that end of the stretch, and it is heard under its new ends', `steps ${dh.region ? dh.region.join('–') : 'none'} from ${d1.region ? d1.region.join('–') : 'none'}`);
  await page.evaluate(() => { const L = window.__sndlanes; if (L.relistening().on) document.querySelector('#sndl .hd .back').click(); L.loop(false); });
  await page.mouse.click(dx0 - 14, c0.y);   // (beside the stretch's left handle, not on it)
  const d2 = await page.evaluate(toy => { const L = window.__sndlanes, r = L.relistening(); if (r.on) document.querySelector('#sndl .hd .back').click(); L.pick(toy, { take: 'new 1' }); L.paint();
    return { ...r, after: L.relistening(), f: window.__tape.state.f, reg: !!document.querySelector('#sndl .ov .reg:not([hidden])') }; }, toy);
  line(!d2.region && !d2.reg && d2.from < first - 20 && d1.region && d2.from <= d1.region[0] + 1 && !d2.after.on && !d2.after.loop && d2.f === set.f, 'a click on the strip lets the stretch go and hears from there; stopped, the tape is where it stood', `from step ${d2.from}, step ${d2.f}`);
  // a click on a checkpoint's marker lets a dragged stretch go too (it used to stay set and drawn, and the next ↺ went back to it)
  const d3 = await page.evaluate(([a, b]) => { const L = window.__sndlanes; L.checkpoint(a); const set = L.region(a, b); L.paint(); const chip = document.querySelector('#sndl .rl .cp:not(.ahead)'); if (chip) chip.click();
    const r = L.relistening(); if (r.on) document.querySelector('#sndl .hd .back').click(); L.uncheck(a); L.paint(); return { set, chip: !!chip, on: r.on, region: r.region, reg: !!document.querySelector('#sndl .ov .reg:not([hidden])') }; }, [first - 20, first]);
  line(d3.set && d3.chip && d3.on && !d3.region && !d3.reg, 'a click on a checkpoint behind the tape hears from it and lets a dragged stretch go', d3.region ? `still ${d3.region.join('–')}` : 'none set');
  // AHEAD of the tape there is nothing to hear: a click on the ruler there, or on a checkpoint the tape has not passed (drawn dim), starts nothing and leaves the stretch alone
  const ah0 = await page.evaluate(([a, b]) => { const L = window.__sndlanes, set = L.region(a, b); L.paint(); const v = L.view(), r = document.querySelector('#sndl .rl').getBoundingClientRect(), chip = document.querySelector('#sndl .hd .chip');
    return { set, x: r.left + v.gutter + Math.min(v.width - 4, v.headX + (v.width - v.headX) * 0.6), y: r.bottom - 5, dim: !!chip && chip.classList.contains('ahead') && +getComputedStyle(chip).opacity < 0.6, flagDim: !!document.querySelector('#sndl .rl .cp.ahead'), ends: window.__tape.state.ticks > window.__tape.state.f }; }, [first - 20, first]);
  await page.mouse.click(ah0.x, ah0.y);
  const ah1 = await page.evaluate(() => { const L = window.__sndlanes, r = L.relistening(); document.querySelector('#sndl .hd .chip').click(); const r2 = L.relistening(); L.region(0, null); L.paint(); return { on: r.on, region: r.region, on2: r2.on, region2: r2.region, cps: L.checkpoints().length }; });
  line(ah0.set && ah0.ends && !ah1.on && !!ah1.region && ah1.region[0] === first - 20, 'a click on the ruler ahead of the tape hears nothing and keeps the stretch', ah1.region ? `still ${ah1.region.join('–')}` : 'the stretch is gone');
  line(ah0.dim && ah0.flagDim && !ah1.on2 && !!ah1.region2 && ah1.cps === 1, 'a checkpoint the tape has not passed is drawn dim; a click on it hears nothing and keeps the stretch', ah1.region2 ? `still ${ah1.region2.join('–')}` : 'the stretch is gone');

  // 4. the replay still plays step for step, with the lanes holding every sound the tape lists
  const c = await walk(row.steps + 10);
  const names = new Set(c.rows.map(r => r.name)), missing = Object.keys(row.sounds).filter(n => !names.has(n) && !(n === 'smokePop' && names.has('smokeHiss')));
  line(c.state.ended && !c.state.drift && !c.state.unjournaled, 'the replay plays to its end step for step', `step ${c.state.f}, drift ${c.state.drift ?? 'none'}, unjournaled ${c.state.unjournaled}`);
  line(!missing.length, 'every sound of the replay has a lane', missing.length ? `missing ${missing.join(' ')}` : `${names.size} lanes`);
  const reset = await page.evaluate(toy => { const L = window.__sndlanes; L.pick(toy, { take: L.takesOf(toy).game, flag: false, note: '' }); return { trim: L.takesOf(toy).trim, text: L.copyText() }; }, toy);
  line(!reset.trim || !reset.trim.take, 'picking the game\'s own take puts the mixer back', reset.text);
  const noCopy = await page.evaluate(() => { window.__sndlanes.paint(); const c = document.querySelector('#sndl .hd .copy'); return !c || c.getBoundingClientRect().width === 0; });
  line(noCopy && / none$/.test(reset.text), 'with the picks gone "copy picks" is gone too', reset.text);
  line(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  // 4b. a NARROW window (800 px), six checkpoints and the card up: the head wraps instead of running off the edge, the card takes at most 45 % of the dock, the lanes
  //     keep their place, the card is one scroller as tall as the dock's body, and no text of the dock is under 11 px
  await page.setViewportSize({ width: 800, height: 720 });
  const nar = await page.evaluate(toy => { const L = window.__sndlanes; for (let i = 1; i <= 6; i++) L.checkpoint(i * 7); if (L.cardOf !== toy || !document.querySelector('#sndcard')) L.show(toy); L.paint(); L.paint();
    const hd = document.querySelector('#sndl .hd'), H = hd.getBoundingClientRect(), kids = [...hd.querySelectorAll('button')].map(e => e.getBoundingClientRect()), card = document.querySelector('#sndcard'), C = card.getBoundingClientRect(), mn = document.querySelector('#sndl .mn').getBoundingClientRect(), dock = document.querySelector('#sndl').getBoundingClientRect();
    const small = []; for (const e of document.querySelectorAll('#sndl *')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const px = parseFloat(getComputedStyle(e).fontSize); if (px < 11) small.push(`${e.className || e.tagName} ${px}`); }
    const inner = [...card.querySelectorAll('div')].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY)).length;
    return { w: innerWidth, clipped: kids.filter(r => r.right > innerWidth + 0.5 || r.left < 0 || r.bottom > H.bottom + 0.5).length, n: kids.length, rows: Math.round(H.height), over: hd.scrollWidth > hd.clientWidth + 1, card: C.width, dockW: dock.width, lanes: L.view().width, cardH: C.height, mnH: mn.height, inner, small: [...new Set(small)], dockTop: dock.top }; }, toy);
  line(nar.w === 800 && !nar.clipped && !nar.over, 'at 800 px wide the head wraps: none of its controls is cut off', `${nar.n} controls, head ${nar.rows} px tall`);
  line(nar.card <= nar.dockW * 0.45 + 1 && nar.lanes >= 280, 'and the card takes at most 45 % of the dock, the lanes keep their room', `card ${Math.round(nar.card)} px, lanes ${Math.round(nar.lanes)} px`);
  line(Math.abs(nar.cardH - nar.mnH) < 1.5 && nar.inner === 0, 'the card is ONE scroller, as tall as the dock\'s body', `card ${Math.round(nar.cardH)} px in a body of ${Math.round(nar.mnH)} px, ${nar.inner} scrollers inside`);
  line(!nar.small.length, 'no text in the dock is under 11 px', nar.small.join(' · ') || 'all 11 px or more');
  if (OUT) await page.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}-800.png`), timeout: 20000 }).catch(() => {});
  // 4c. THE CARD UNSCROLLED shows what is used most: ▶, the takes, and the mixer's three dials (pitch · level · tone) side by side — each whole inside the card's
  //     own box, none on another, nothing of a dial spilling out of it — at 1280×800 and at 1440×900; at rest, and with all three MOVED through their number fields
  //     (the widest numbers they show): each number whole in its box, the boxes where they stood at rest, each dial marked changed
  for (const [w, h] of [[1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    const seen = set => page.evaluate(([toy, set]) => { const L = window.__sndlanes; if (L.cardOf !== toy || !document.querySelector('#sndcard')) L.show(toy); L.paint(); L.paint();
      const card = document.querySelector('#sndcard'); card.scrollTop = 0;
      if (set) [...card.querySelectorAll('.d3 .d input.n')].forEach((n, i) => { n.value = set[i]; n.dispatchEvent(new Event('change', { bubbles: true })); });
      const C = card.getBoundingClientRect(), box = { left: C.left, top: C.top, right: C.left + card.clientWidth + 1, bottom: Math.min(C.top + card.clientHeight, innerHeight) };
      const R = e => e.getBoundingClientRect(), inBox = (r, b) => r.width > 0 && r.height > 0 && r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5, meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const dials = [...card.querySelectorAll('.d3 .d')], rs = dials.map(R), nums = dials.map(d => d.querySelector('input.n')), out = [];
      const play = card.querySelector('.t button'); if (!play || play.textContent !== '▶' || !inBox(R(play), box)) out.push('▶');
      for (const b of card.querySelectorAll('.tk button')) if (!inBox(R(b), box)) out.push(b.textContent);
      dials.forEach((d, i) => { const word = d.firstChild.textContent; if (!inBox(rs[i], box)) out.push(word); for (const k of d.children) if (!inBox(R(k), rs[i]) && k.textContent + (k.value || '') !== '') out.push(`${word}'s ${k.tagName.toLowerCase()}`);
        if (d.firstElementChild.scrollWidth > d.firstElementChild.clientWidth + 1) out.push(`${word} cut`); if (nums[i].scrollWidth > nums[i].clientWidth) out.push(`${word}'s number cut (${nums[i].scrollWidth} in ${nums[i].clientWidth})`);
        const u = d.querySelector('i'); if (u.textContent && R(u).right > rs[i].right + 0.5) out.push(`${word}'s unit out`); for (let j = 0; j < i; j++) if (meet(rs[i], rs[j])) out.push(`${word} on ${dials[j].firstChild.textContent}`); });
      return { w: innerWidth, h: innerHeight, top: card.scrollTop, words: dials.map(d => d.firstChild.textContent).join(' · '), sliders: card.querySelectorAll('.d3 .d input[type=range]').length, takes: card.querySelectorAll('.tk button').length, out,
        vals: dials.map((d, i) => `${nums[i].value} ${d.querySelector('i').textContent}`.trim()), at: dials.map((d, i) => { const n = R(nums[i]); return [Math.round((n.left - rs[i].left) * 10) / 10, Math.round(n.width * 10) / 10]; }),
        ch: dials.map((d, i) => d.classList.contains('ch') && getComputedStyle(nums[i]).color === 'rgb(255, 255, 255)'),
        low: rs.length ? Math.round(Math.max(...rs.map(r => r.bottom)) - C.top) : -1, room: card.clientHeight, row: rs.length > 0 && rs.every(r => Math.abs(r.top - rs[0].top) < 1) }; }, [toy, set]);
    const rest = await seen(null);
    line(rest.w === w && rest.h === h && rest.top === 0 && rest.words === 'pitch · level · tone' && rest.sliders === 3 && rest.takes > 1 && rest.row && !rest.out.length && !rest.ch.some(Boolean), `at ${w}×${h} the card unscrolled shows ▶, the takes and the three dials, side by side`, `${rest.words} (${rest.vals.join(' · ')}) · ${rest.takes} takes · the dials end ${rest.low} px down a card of ${rest.room}${rest.out.length ? ` · out of sight or cut: ${rest.out.join(', ')}` : ''}`);
    const moved = await seen(['+1200', '-23.5', '12000']);
    if (OUT) await page.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}-${w}.png`), timeout: 20000 }).catch(() => {});
    const still = rest.at.length === 3 && rest.at.every(a => Math.abs(a[0] - rest.at[0][0]) < 0.6 && Math.abs(a[1] - rest.at[0][1]) < 0.6) && moved.at.every((a, i) => Math.abs(a[0] - rest.at[i][0]) < 0.6 && Math.abs(a[1] - rest.at[i][1]) < 0.6);
    line(moved.top === 0 && moved.row && !moved.out.length && /^\+1200 ¢$/.test(moved.vals[0]) && /^[-−]23\.5 dB$/.test(moved.vals[1]) && moved.vals[2] === '12000 Hz' && still && moved.ch.every(Boolean), 'and with all three moved: each number whole in its box, the boxes where they stood, each dial marked changed', `${moved.vals.join(' · ')} · number boxes ${moved.at.map(a => `${a[1]} px at +${a[0]}`).join(', ')} (at rest ${rest.at.map(a => `+${a[0]}`).join(', ')}) · changed ${moved.ch.join()}${moved.out.length ? ` · out of sight or cut: ${moved.out.join(', ')}` : ''}`);
    await page.evaluate(toy => { window.__sndlanes.pick(toy, { rate: 1, gain: 1, tone: 20000 }); }, toy);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // 5. what the browser kept may be anything (another build's, a hand edit): the page comes up all the same, with what could be read of it
  const errs0 = errors.length;
  await page.evaluate(toy => {
    const L = window.__sndlanes; L.unsaved = 1; L.keep();
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('twopointsix.soundlanes:'));
    for (const k of keys) sessionStorage.setItem(k, JSON.stringify([[1e9, 'x', 2, 1, 1], 5, ['a'], null, [3, 'click', 7, 'loud', -1], [2.5, 'equip', 2, 1, 1], [4, 'click', 2, 1, 1, [1, 'a']], [6, 'click', 2, 1, 1, [0, 0, 1, 1e9, -5, 3, 2, 1]], [8, 'click', 2, 1, 1, { rel: 1 }]]));
    localStorage.setItem('twopointsix.soundlanes.cp', JSON.stringify({ [L.key]: [5, -3, 'x', 1e9, 5, 2.5, 7], other: 'nope', ['y'.repeat(500)]: [1], list: [[1]] }));
    localStorage.setItem('twopointsix.soundpicks', JSON.stringify({ [toy]: { take: 'new 1', rate: 'fast', gain: 99, note: 7, tune: { base: 5, over: 'x', mute: 3, bell: 'q' }, mine: [3, { take: 'zz' }, { tune: [1] }, null] }, magIn: { take: 'tuned', tune: 'loud' }, rack: { take: 'tuned', tune: { base: 'new 9', hp: 90 } }, dryFire: { take: 'new 3', flag: true }, bodyFall: 5, ['x'.repeat(90)]: { flag: true }, click: null, constructor: { take: 'before', flag: true }, toString: { take: 'after' } }));
    // (the dock folded, as an older build kept it — and a loop with its stretch, as this one keeps them for the visit)
    localStorage.setItem('twopointsix.soundlanes', JSON.stringify({ open: false, span: 'wide' }));
    sessionStorage.setItem('twopointsix.soundlanes.loop', JSON.stringify({ k: L.key, reg: [5, 9] }));
  }, toy);
  await page.reload({ timeout: 240000 });
  await page.waitForFunction(() => !!window.__ready && !!window.__audio && !!window.__tape && (!!window.__sndlanes || (document.getElementById('fatal') || {}).style?.display === 'flex'), null, { timeout: 900000 });
  const again = await page.evaluate(async () => {
    await window.__ready; window.__audio.start(); const L = window.__sndlanes; if (L) L.paint(); const f = document.getElementById('fatal');
    return { lanes: !!L, fatal: !!f && f.style.display === 'flex', picks: L ? JSON.stringify(L.picks()) : '', events: L ? L.events() : [], cps: L ? L.checkpoints() : [], open: !!document.querySelector('#sndl:not(.shut)'), span: L ? L.view().span : 0, re: L ? L.relistening() : {}, lit: !!document.querySelector('#sndl .hd .lp.is') };
  });
  line(again.lanes && !again.fatal && again.open && errors.length === errs0, 'a page whose kept picks and sounds are not what the lanes wrote still comes up', errors.slice(errs0, errs0 + 2).join(' | ') || `fatal card ${again.fatal}`);
  line(again.picks === JSON.stringify({ [toy]: { take: 'new 1', gain: 2 }, dryFire: { flag: true } }), 'what could be read of the picks is kept, the rest dropped', again.picks);
  line(again.events.some(e => e.name === 'click' && e.f === 3 && e.heard === 0) && !again.events.some(e => e.name === 'x' || e.name === 'a' || e.name === 'equip' && e.f !== Math.round(e.f)), 'and so with the sounds it kept', `${again.events.length} kept`);
  line(JSON.stringify(again.cps) === '[5,7]' && [4, 6, 8].every(f => again.events.some(e => e.name === 'click' && e.f === f)), 'and with its checkpoints and the mixes of its sounds', `checkpoints ${JSON.stringify(again.cps)}`);
  line(again.open && again.span === 30, 'a page that asks for the lanes shows them OPEN, whatever an earlier visit kept', `open ${again.open}, ${again.span} s`);
  line(again.re.loop && again.lit && JSON.stringify(again.re.region) === '[5,9]' && !again.re.on, 'the loop and its stretch come back together after a page load', `loop ${again.re.loop}, stretch ${JSON.stringify(again.re.region)}`);
  // 5b. TAKEN DOWN (a fault while they ran, `fail`; a throw while they were being made, the constructor's catch): nothing of the lanes is left on the page, and the
  //     replay's frame is its own method again — not a wrap that calls it
  const down = await page.evaluate(() => {
    const L = window.__sndlanes, t = L.tape, P = Object.getPrototypeOf(t), own = () => Object.prototype.hasOwnProperty.call(t, 'frame'), styles = () => [...document.querySelectorAll('style')].filter(x => x.textContent.includes('#sndl{')).length;
    const left = () => ({ dock: !!document.querySelector('#sndl'), card: !!document.querySelector('#sndcard'), tag: !!document.querySelector('#sndnopic'), film: !!document.querySelector('#sndfilm'), cls: document.body.classList.contains('sndl'), h: document.documentElement.style.getPropertyValue('--sndl-h'), styles: styles(), wrapped: own() || t.frame !== P.frame, tap: !!window.__audio.tap });
    const up = left(); L.show(L.rowNames()[0].name); L.fail('taken down by the page check'); const failed = left();
    // made again with a mixer whose tap cannot be set: the constructor throws AFTER it has wrapped the frame and put its style and dock on the page
    const bad = Object.create(window.__audio, { tap: { get() { return null; }, set(v) { if (v) throw new Error('no tap'); } } }); let threw = '';
    try { new L.constructor(t, bad); } catch (e) { threw = String(e && e.message || e); }
    return { up, failed, threw, thrown: left() };
  });
  const clean = l => !l.dock && !l.card && !l.tag && !l.film && !l.cls && !l.h && l.styles === 0 && !l.wrapped && !l.tap;
  line(down.up.dock && down.up.wrapped && down.up.styles === 1 && down.up.cls && clean(down.failed), 'the lanes taken down leave nothing: no dock, card, style, class or tap, and the replay\'s frame is its own again', JSON.stringify(down.failed));
  line(down.threw === 'no tap' && clean(down.thrown), 'a throw while the lanes are being made leaves nothing either', `threw '${down.threw}' · ${JSON.stringify(down.thrown)}`);
  await page.evaluate(() => { localStorage.removeItem('twopointsix.soundpicks'); localStorage.removeItem('twopointsix.soundlanes'); localStorage.removeItem('twopointsix.soundlanes.cp'); sessionStorage.removeItem('twopointsix.soundlanes.loop'); });
  if (OUT) await page.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}-end.png`), timeout: 20000 }).catch(() => console.log('  (no end still: the screenshot timed out)'));
  // 6. the same replay WITHOUT the flag, and with `soundlanes=0`: nothing of the lanes is on the page, and no played frame is copied for a film (the replay's frame
  //    is not wrapped — the player itself is not on `window`, so it is asked of what a wrap would DO: one createImageBitmap of the view per played frame)
  await page.close();
  }
  for (const [word, flag] of [['without the flag', ''], ['with soundlanes=0', '&soundlanes=0']]) {
    const plain = await ctx.newPage(); const perr = []; plain.on('pageerror', e => perr.push(String(e))); plain.on('console', m => { if (m.type() === 'error' && /sound lanes/.test(m.text())) perr.push(m.text()); });
    await plain.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&playtape=assets/replays/${TAPE}.json.gz${flag}`, { timeout: 240000 });
    await plain.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape, null, { timeout: 900000 });
    const bare = await plain.evaluate(async () => { await window.__ready; window.__testVisible = true; const view = document.getElementById('view'), cib = window.createImageBitmap; let copies = 0; window.createImageBitmap = function (src, ...a) { if (src === view) copies++; return cib.call(this, src, ...a); };
      window.__tape.play(); for (let i = 0; i < 3; i++) { window.__runFrames(1, 0.1); await window.__engine.device.queue.onSubmittedWorkDone(); } window.__tape.pause(); await new Promise(r => setTimeout(r, 300)); window.createImageBitmap = cib;
      return { dock: !!document.querySelector('#sndl'), film: !!document.querySelector('#sndfilm'), card: !!document.querySelector('#sndcard'), tag: !!document.querySelector('#sndnopic'), style: [...document.querySelectorAll('style')].some(x => x.textContent.includes('#sndl{')), cls: document.body.classList.contains('sndl'), hook: typeof window.__sndlanes, h: document.documentElement.style.getPropertyValue('--sndl-h'), bar: !!document.querySelector('#tapebar'), tap: !!window.__audio.tap, copies, f: window.__tape.state.f, search: location.search }; });
    line(!bare.dock && !bare.film && !bare.card && !bare.tag && !bare.style && !bare.cls && bare.hook === 'undefined' && !bare.h && bare.bar && !bare.tap && bare.copies === 0 && bare.f > 0 && (flag ? /soundlanes=0/.test(bare.search) : !/soundlanes/.test(bare.search)) && !perr.length,
      `${word} the replay page has no dock, card, style, recorded picture, body class, hook or tap, and its frames are not copied`, `#sndl ${bare.dock}, #sndfilm ${bare.film}, body.sndl ${bare.cls}, __sndlanes ${bare.hook}, --sndl-h '${bare.h}', ${bare.copies} copies of the view over three played frames (step ${bare.f}) · ${bare.search}${perr.length ? ` · ${perr[0]}` : ''}`);
    if (OUT && !flag) await plain.screenshot({ path: path.join(OUT, `soundlanes-${TAPE}-plain.png`), timeout: 20000 }).catch(() => {});
    await plain.close();
  }
  await browser.close();
  console.log(failed ? `=== soundlanes-page: ${failed} FAILED ===` : '=== soundlanes-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
