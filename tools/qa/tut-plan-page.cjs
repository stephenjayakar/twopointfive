// THE PLAN MODE MISSION PLAYED ON THE REAL PAGE WITH REAL KEYS AND A REAL MOUSE: headless Chromium on the software WebGPU adapter (tools/qa/tut-page.cjs's
// recipe — SwiftShader, no GPU). What the headless lesson run cannot see: that the bundle boots the level and its script with plan mode already up and
// nobody of the player's on the floor (the frame's sky seat, rails.ts RAILS.skyUp), that no key on the real keyboard puts the mode down — the pair, Tab
// and Esc are the page's own there — that a left drag is a box and a right click an order (and no browser menu), that a right drag gives a way to
// face, and that each thing a line points at is on the picture when the line is up.
//   PORT=5199 node tools/qa/tut-plan-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   env: QUALITY (default verylow) · OUT (a folder for pictures; default a temp folder) · STEPS (stop after this many steps) · SHOTS=0 (no pictures: each
//        is minutes on the software adapter) · PICS=send,all (pictures at these step ids only; default send,all,word2,hold) · CDP=<port> (a browser
//        already up on the mission's page)
// The page is ?paused and stepped by __runFrames with nothing drawn; every input is a DOM event from Playwright's keyboard and mouse.
// exit 0 = every line passes · 1 = a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..'), NAME = 'tut-plan';
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'tut-plan-page-')), STEPS = +(process.env.STEPS || 99), PICS = (process.env.PICS || 'send,all,word2,hold').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false;
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', `${NAME}.json`), 'utf8')), steps = data.scenarios.lesson.steps;
  const held = process.env.CDP;
  const browser = held ? await chromium.connectOverCDP(`http://127.0.0.1:${held}`) : await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = held ? browser.contexts()[0].pages()[0] : await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); const errors = [];
  page.setDefaultTimeout(0);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  const run = n => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);
  const read = () => page.evaluate(() => { const g = window.__game, el = document.getElementById('railprompt'), O = g.orders, P = O.plan;
    const stack = m => { const A = O.of(m); return A && A.order === 'stack' && A.door ? A.door.def.name : null; };
    return { i: g.lesson.i, id: g.lesson.step?.id ?? null, done: g.lesson.finished, line: el?.querySelector('.line')?.textContent ?? '', keys: [...(el?.querySelectorAll('kbd') ?? [])].map(k => k.textContent), up: !!el && getComputedStyle(el).display !== 'none',
      fatal: document.getElementById('fatal')?.textContent || '', rails: g.rails.live, seat: !!g.rails.planSeat, sky: document.body.classList.contains('skyseat'), unseen: !!g.playerInvisible, park: g.level.scenarios.lesson.rails.sky?.park ?? null, tabcard: !!document.getElementById('tabcard')?.classList.contains('on'), backable: !!g.backable(), sum: g.rails.summary(), t: +g.time.toFixed(1), plan: P.up, look: P.look ? [+P.look[0].toFixed(1), +P.look[2].toFixed(1)] : null, crouch: g.player.crouch,
      sam: [+g.player.char.pos[0].toFixed(2), +g.player.char.pos[2].toFixed(2)], picked: O.recipients().map(m => m.callsign), chains: P.chains.length, orders: O.log.length, last: O.log.length ? O.log[O.log.length - 1].order : null,
      men: O.men('all').map(m => ({ cs: m.callsign, p: [m.char.pos[0], 0, m.char.pos[2]], stack: stack(m), order: O.of(m)?.order ?? null, arrived: !!O.of(m)?.arrived })),
      foes: g.guards.filter(x => x.team !== 'operative' && x.state !== 'dead').length, shots: g.mission.stats.shots }; });
  const at = p => page.evaluate(p => { const c = document.getElementById('view'), r = c.getBoundingClientRect(), [x, y, vis] = window.__cam.project(p, r.width, r.height, 1); return { x: r.left + x, y: r.top + y, vis: !!vis && x > 8 && y > 8 && x < r.width - 8 && y < r.height - 8 }; }, p);
  // (a picture, as tut-page.cjs takes one: the frame is drawn and read back in the page and stood under the HUD as a still)
  let drew = false;
  const shot = async tag => { if (process.env.SHOTS === '0' || !PICS.includes(String(tag).replace(/^\d+-/, ''))) return '(no picture asked)'; const f = path.join(OUT, `${NAME}-${tag}.png`); drew = true;
    await page.evaluate(async () => { const dev = window.__engine.device, y = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 2; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await y(); }
      window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return;
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
      const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
      const v = document.getElementById('view'), r = v.getBoundingClientRect(); let im = document.getElementById('__still'); if (!im) { im = document.createElement('img'); im.id = '__still'; v.parentNode.insertBefore(im, v); }
      im.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:0;`; im.src = c2.toDataURL('image/png'); await im.decode(); v.style.visibility = 'hidden'; });
    try { await page.screenshot({ path: f, timeout: 60000 }); } catch (e) { return `(no picture: ${String(e).slice(0, 60)})`; }
    finally { await page.evaluate(() => { document.getElementById('view').style.visibility = ''; document.getElementById('__still')?.remove(); }); }
    return f; };
  // A FIGHT ON A PAGE THAT HAS DRAWN: the GPU's senses (who sees whom through the picture's own light and haze) are answered by drawn frames, and a page
  // stepped with nothing drawn keeps the answers of its last picture — men stand a metre apart and nobody fires. Before any picture the page plays on the
  // stand-in senses and needs no draw; after one, a fight is stepped a second at a time with a frame drawn to its end between (a minute each here).
  const fight = async (want, secs) => { if (!drew) return until(want, secs);
    for (let k = 0; k < secs; k++) { const s = await read(); if (want(s)) return s; await run(60); await page.evaluate(async () => { window.__runFrames(1, 1 / 60, [], false); await window.__engine.device.queue.onSubmittedWorkDone(); await new Promise(r => setTimeout(r, 50)); }); }
    return read(); };
  const url = `http://localhost:${PORT}/?roomclear&squad4&levelFile=${NAME}.json&paused&quality=${QUALITY}&mute&nocutboxes${process.env.URL_ADD || ''}`;   // (URL_ADD='&tab=brief' = Tab's objectives card as a played page has it: a driven page has none)
  log(url);
  // (a browser kept up from a run before this one: a page that is not this mission at its first tick — left in the middle, FINISHED, or on another mission, the
  //  end card's own key goes on to the next row — is loaded again, however long the software adapter takes: the game's own restart puts back a checkpoint, not
  //  the first line, and a page loaded before the server was started again is not this build)
  const state = () => page.evaluate(() => ({ here: /levelFile=tut-plan\.json/.test(location.search), card: !!document.querySelector('.db.vd-on'), mid: !window.__game || window.__game.lesson.i > 0 || window.__game.orders.plan.up || window.__game.time > 1 })).catch(() => ({ here: false }));
  const st = held ? await state() : { here: false };
  if (!st.here || st.card || st.mid) await page.goto(url, { timeout: 1800000 });
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
  await page.evaluate(() => window.__runFrames(5, 1 / 60, [], 'none'));
  let R = await read();
  log('booted', JSON.stringify({ ...R, men: R.men.length }));
  check(!R.fatal && R.rails && R.up && R.i === 0 && ['W', 'A', 'S', 'D'].every(k => R.keys.includes(k)) && R.keys.length === 4, 'the page boots the mission on rails: one big line up, the four walk keys on key caps and no other key', `fatal "${R.fatal}" · rails ${R.rails} · line "${R.line}" keys [${R.keys}]`);
  // NOBODY OF HIS IS ON THE FLOOR: the seat is on, plan mode is up with no key pressed, the page wears the sky seat's class (his kit panel and meters are
  // hidden by it), he stands parked where the level says, unseen, and the view's point is on the four and far from him
  { const mid = R.men.reduce((c, m) => [c[0] + m.p[0] / R.men.length, c[1] + m.p[2] / R.men.length], [0, 0]), off = R.look ? Math.hypot(R.look[0] - mid[0], R.look[1] - mid[1]) : NaN;
    const parked = !!R.park && Math.hypot(R.sam[0] - R.park[0], R.sam[1] - R.park[2]) < 0.3, panels = await page.evaluate(() => ['equip', 'meters'].map(id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none'; }));
    check(R.seat && R.plan && R.sky && parked && R.unseen && !R.crouch && off < 1.5 && panels.every(Boolean), 'nobody of the player\'s is on the floor: plan mode is up from the first frames with no key pressed, he is parked out of the picture and unseen, his kit panel and meters are not shown, and the view is on the four',
      `the seat ${R.seat} · mode ${R.plan} · the page's sky seat class ${R.sky} · parked at (${R.sam}) ${parked}, unseen ${R.unseen} · the view ${Number.isFinite(off) ? `${off.toFixed(1)} m from the four's middle` : 'has no point'} · kit panel and meters hidden ${panels}`); }

  // ---- the hands
  const tap = async k => { await page.keyboard.down(k); await run(2); await page.keyboard.up(k); await run(2); };
  const until = async (want, secs) => { for (let k = 0; k < secs; k++) { const s = await read(); if (want(s)) return s; await run(60); } return read(); };
  /** the walk keys, as a hand looking for a thing: until every place is on the picture, clear of the panels and the line */
  const panTo = async (...ps) => { const MX = 270, MY = 150;
    for (let k = 0; k < 120; k++) { const q = []; for (const p of ps) q.push(await at(p)); const x0 = Math.min(...q.map(v => v.x)), x1 = Math.max(...q.map(v => v.x)), y0 = Math.min(...q.map(v => v.y)), y1 = Math.max(...q.map(v => v.y));
      const ks = [y0 < MY && y1 < 720 - MY ? 'KeyW' : y1 > 720 - MY && y0 > MY ? 'KeyS' : '', x0 < MX && x1 < 1280 - MX ? 'KeyA' : x1 > 1280 - MX && x0 > MX ? 'KeyD' : ''].filter(Boolean);
      if (!ks.length) break; for (const c of ks) await page.keyboard.down(c); await run(6); for (const c of ks) await page.keyboard.up(c); await run(1); }
    await run(30); };
  /** the walk keys until the view's own point is within a metre of a place (the steps that ask for the view) */
  const viewTo = async (p, id) => { for (let k = 0; k < 150; k++) { const s = await read(); if (s.id !== id || !s.look) break; const dx = p[0] - s.look[0], dz = p[2] - s.look[1]; if (Math.hypot(dx, dz) < 1) break;
      // (east is right and a little up on the page's default view, south down and right: which key is which way is read off the picture)
      const c = await at([s.look[0], 0, s.look[1]]), e = await at(p), ks = [e.y < c.y - 12 ? 'KeyW' : e.y > c.y + 12 ? 'KeyS' : '', e.x < c.x - 12 ? 'KeyA' : e.x > c.x + 12 ? 'KeyD' : ''].filter(Boolean);
      if (!ks.length) break; for (const q of ks) await page.keyboard.down(q); await run(4); for (const q of ks) await page.keyboard.up(q); await run(1); } await run(20); };
  /** the left button dragged round these men's feet (a man walking through the box is waited out) */
  const box = async (names, tries = 2) => { let s = await read(); await panTo(...s.men.filter(m => names.includes(m.cs)).map(m => m.p));
    let a, b; for (let k = 0; k < 24; k++) { s = await read(); const f = new Map(); for (const m of s.men) f.set(m.cs, await at([m.p[0], 0, m.p[2]]));
      const q = names.map(n => f.get(n)); a = { x: Math.min(...q.map(v => v.x)) - 12, y: Math.min(...q.map(v => v.y)) - 12 }; b = { x: Math.max(...q.map(v => v.x)) + 12, y: Math.max(...q.map(v => v.y)) + 12 };
      if (!s.men.some(m => !names.includes(m.cs) && f.get(m.cs).x >= a.x && f.get(m.cs).x <= b.x && f.get(m.cs).y >= a.y && f.get(m.cs).y <= b.y)) break; await run(10); }
    await page.mouse.move(a.x, a.y); await run(2); await page.mouse.down(); await run(1);
    for (let k = 1; k <= 5; k++) { await page.mouse.move(a.x + (b.x - a.x) * k / 5, a.y + (b.y - a.y) * k / 5); await run(1); }
    await page.mouse.up(); await run(3); const got = (await read()).picked;
    if ((got.length !== names.length || !names.every(n => got.includes(n))) && tries > 0) { await run(40); return box(names, tries - 1); }   // (one walked out from under it: again, as a hand would)
    return got; };
  /** two of the four that a box can take without the others: the two at one end of the group as the picture shows it (the end nearer `p` first) */
  const twoOf = async p => { const s = await read(); await panTo(...s.men.map(m => m.p)); const f = new Map(); for (const m of s.men) f.set(m.cs, await at([m.p[0], 0, m.p[2]]));
    const by = k => [...s.men].sort((x, y) => f.get(x.cs)[k] - f.get(y.cs)[k]), ends = [by('x').slice(0, 2), by('x').slice(-2), by('y').slice(0, 2), by('y').slice(-2)];
    const clean = men => { const q = men.map(m => f.get(m.cs)), x0 = Math.min(...q.map(v => v.x)) - 12, x1 = Math.max(...q.map(v => v.x)) + 12, y0 = Math.min(...q.map(v => v.y)) - 12, y1 = Math.max(...q.map(v => v.y)) + 12;
      return s.men.every(m => men.includes(m) || !(f.get(m.cs).x >= x0 && f.get(m.cs).x <= x1 && f.get(m.cs).y >= y0 && f.get(m.cs).y <= y1)); };
    const far = men => men.reduce((t, m) => t + Math.hypot(m.p[0] - p[0], m.p[2] - p[2]), 0);
    return (ends.filter(clean).sort((x, y) => far(x) - far(y))[0] ?? ends[1]).map(m => m.cs); };
  /** THE DIGITS on the real keyboard, as the lines teach them: the first alone, each one after it with Shift held. Who is picked, and what the parked player holds */
  const digits = async (...ds) => { for (const [i, d] of ds.entries()) { if (i) { await page.keyboard.down('ShiftLeft'); await run(2); } await tap(`Digit${d}`); if (i) { await page.keyboard.up('ShiftLeft'); await run(2); } }
    await run(3); return { got: (await read()).picked, slot: await page.evaluate(() => window.__game.player.slot) }; };
  const SQUAD = ['Red One', 'Red Two', 'Blue One', 'Blue Two'], same = (got, want) => got.length === want.length && want.every(n => got.includes(n));
  const chains = () => page.evaluate(() => window.__game.orders.plan.chains.map(c => c.phase));
  const rclick = async p => { await panTo(p); const s = await at(p); await page.mouse.move(s.x, s.y); await run(3); await page.mouse.down({ button: 'right' }); await run(1); await page.mouse.up({ button: 'right' }); await run(4); return s; };
  const rdrag = async (a, toward) => { const l = Math.hypot(toward[0] - a[0], toward[2] - a[2]), b = [a[0] + (toward[0] - a[0]) / l * 3, 0, a[2] + (toward[2] - a[2]) / l * 3]; await panTo(a, b);
    const s = await at(a), e = await at(b); await page.mouse.move(s.x, s.y); await run(3); await page.mouse.down({ button: 'right' }); await run(1);
    for (let k = 1; k <= 5; k++) { await page.mouse.move(s.x + (e.x - s.x) * k / 5, s.y + (e.y - s.y) * k / 5); await run(1); }
    await page.mouse.up({ button: 'right' }); await run(4); return Math.hypot(e.x - s.x, e.y - s.y); };
  const free = men => men.filter(m => m.stack === null).map(m => m.cs);
  const seen = async (s, what) => { if (!s.at) return; const q = await at(s.at); check(q.vis, `step '${s.id}': ${what} is on the picture when the hand acts`, `at ${Math.round(q.x)}, ${Math.round(q.y)} of 1280 x 720`); };
  let pairA = [];
  // ---- NO KEY OF HIS PUTS THE MODE DOWN, and nothing else is his: the pair (a walk key held too), Tab and Esc on the real keyboard — Tab and Esc are
  //      the page's own with nothing to back out of (its objectives card where a played page has it; its pause) — then the command
  //      key alone, the word and a key that is nobody's. The mode is up after each, no order has gone out and nobody has moved
  { const b = await read(), after = {}; await page.mouse.move(700, 330);
    await page.keyboard.down('ShiftLeft'); await run(2); await tap('KeyQ'); await page.keyboard.up('ShiftLeft'); await run(4); after.pair = (await read()).plan;
    await page.keyboard.down('KeyS'); await run(4); await page.keyboard.down('ShiftLeft'); await run(2); await tap('KeyQ'); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyS'); await run(4); after.walking = (await read()).plan;
    await tap('Tab'); const t1 = await read(); after.tab = t1.plan; if (t1.tabcard) { await tap('Tab'); } const t2 = await read();
    await tap('Escape'); await page.waitForTimeout(100); const e1 = await read(); await tap('Escape'); await page.waitForTimeout(100); await run(10); const e2 = await read(); after.esc = e1.plan && e2.plan;
    for (const k of ['KeyQ', 'KeyF', 'KeyX']) { await page.keyboard.down(k); await run(6); await page.keyboard.up(k); await run(2); }
    const a = await read(), card = /tab=brief/.test(url);
    check(after.pair && after.walking && after.tab && after.esc && a.plan && a.orders === b.orders && a.shots === b.shots && Math.hypot(a.sam[0] - b.sam[0], a.sam[1] - b.sam[1]) < 0.05 && a.i === 0 && a.t > e1.t && !b.backable && !a.backable && !t2.tabcard,
      'no key of his puts plan mode down: Shift + Q (a walk key held too), Tab and Esc on the real keyboard leave it up, the command key alone and the word give no order, and the game runs on after them',
      `mode after Shift + Q ${after.pair}, with S held ${after.walking}, after Tab ${after.tab}, after Esc twice ${after.esc} · nothing of the game's to back out of ${!b.backable && !a.backable} (so Tab and Esc are the page's) · the objectives card on that Tab: ${t1.tabcard ? `up, and after a second Tab ${t2.tabcard ? 'STILL UP' : 'gone'}` : `not up (${card ? 'this page is held between its frames, and a held page opens no card' : 'a driven page has none'})`} · orders ${b.orders} → ${a.orders} · shots ${b.shots} → ${a.shots} · the clock ${e1.t} → ${a.t} · ${a.sum}`); }

  /** the point a step's view test wants the view near (the lesson's own) */
  const viewAt = s => { const f = t => !t ? null : t.is === 'planView' ? t : (t.of ?? []).map(f).find(Boolean) ?? null; return f(s.done).at; };
  let downAt = [];
  const hand = {
    view: async s => { const b = await read(); await viewTo(viewAt(s), 'view'); const a = await read();
      check(Math.hypot(a.sam[0] - b.sam[0], a.sam[1] - b.sam[1]) < 0.05 && !!a.look && !!b.look && Math.hypot(a.look[0] - b.look[0], a.look[1] - b.look[1]) > 2, 'the walk keys on the real keyboard move the view and nobody on the floor', `the view's point (${b.look}) → (${a.look}) · the parked player moved ${Math.hypot(a.sam[0] - b.sam[0], a.sam[1] - b.sam[1]).toFixed(2)} m`); },
    send: async s => { const b = await read(); await seen(s, 'the wall\'s mark');
      // (picks wait for their lesson — rails.ts RAILS.planDigits: before the step that teaches them a digit and a left click on a man pick nobody)
      { const slot0 = await page.evaluate(() => window.__game.player.slot), d = await digits(1), m = b.men[1]; await panTo(m.p); const q = await at([m.p[0], 1.0, m.p[2]]); await page.mouse.move(q.x, q.y); await run(2); await page.mouse.down(); await run(1); await page.mouse.up(); await run(3); const c = (await read()).picked;
        check(q.vis && d.got.length === 4 && c.length === 4 && d.slot === slot0, 'before the line that teaches picking, [1] and a left click on a teammate pick nobody: the order still goes to all four', `after [1]: ${d.got.length} picked · after a left click on ${m.cs} at ${Math.round(q.x)}, ${Math.round(q.y)} (on the picture ${q.vis}): ${c.length} picked · the parked player holds his ${d.slot}`); }
      await rclick(s.at); const a = await read();
      check(a.orders === b.orders + 1 && a.chains === 1, 'a right click on the real mouse is one order to all four (and no browser menu took it)', `orders ${b.orders} → ${a.orders} (${a.last}) · chains ${a.chains}`);
      await until(x => x.id !== 'send', 40); await run(90); },
    pick: async s => { const slot0 = await page.evaluate(() => window.__game.player.slot), one = await digits(1), d = await digits(1, 2);
      check(same(one.got, SQUAD.slice(0, 1)) && same(d.got, SQUAD.slice(0, 2)) && d.slot === slot0, '[1] on the real keyboard picks the first teammate alone, and Shift + [2] adds the second', `[1]: ${one.got.join(', ') || 'nobody'} · then Shift + [2]: ${d.got.join(', ') || 'nobody'} · the parked player holds his ${d.slot} (was ${slot0})`); },
    door1: async s => { await panTo(s.at); await seen(s, 'the door\'s mark'); await rclick(s.at); },
    pick2: async () => { const d = await digits(3, 4), click = await box(SQUAD.slice(2));   // ("the other two … with their numbers": the first pair was 1 and 2 — and a box round the same two is the same pick)
      check(same(d.got, SQUAD.slice(2)) && same(click, SQUAD.slice(2)), '[3], then Shift + [4], picks the other two, and so does a box round them', `the digits picked ${d.got.join(', ') || 'nobody'} · the box ${click.join(', ') || 'nobody'}`); },
    door2: async s => { await panTo(s.at); await seen(s, 'the side door\'s mark'); await rclick(s.at); await until(x => x.id !== 'door2', 60); },
    all: async () => { const d = await digits(5); check(d.got.length === 4, '[5] on the real keyboard is everyone again', `picked ${d.got.join(', ')}`); },
    word: async () => { const b = await chains(); await tap('KeyF'); await run(6); const a = await chains();
      check(b.length === 2 && b.every(x => x === 'wait') && a.every(x => x !== 'wait'), 'the line asks for the word when both stacks wait on it, and ONE press of F sends both', `chains before ${b.join(', ')} · after ${a.join(', ')}`);
      await fight(x => x.id !== 'word', 40); await run(90); },
    hall: async s => { await viewTo(viewAt(s), 'hall'); },
    front: async s => { const got = await box(await twoOf([26, 0, 12])); check(got.length === 2, 'a left drag on the real mouse is still a box that picks two men (the line says only "pick two")', `picked ${got.join(', ') || 'nobody'}`); await panTo(s.at); await seen(s, 'the front door\'s mark'); await rclick(s.at); },
    back: async s => { const r = await read(); await box(free(r.men)); await panTo(s.at); await seen(s, 'the back door\'s mark'); await rclick(s.at); await until(x => x.id !== 'back', 70); },
    all2: async () => { await digits(5); },
    word2: async () => { const c = await chains(), b = await read(); await tap('KeyF'); await run(6); const c2 = await chains(); const a = await fight(x => x.id !== 'word2', 40);
      check(c.length === 2 && c.every(x => x === 'wait') && c2.every(x => x !== 'wait'), 'the hall: one press of F sends both stacks', `chains before ${c.join(', ')} · after ${c2.join(', ')} · word at t ${b.t}, the hall taken by t ${a.t}`); await run(90); },
    gates: async s => { await viewTo(viewAt(s), 'gates'); },
    faceA: async s => { pairA = await twoOf(s.at); await box(pairA); await seen(s, 'the bags\' arrow'); const d = await rdrag(s.at, s.toward); log(`  right drag: ${d.toFixed(0)} px on the picture`); await until(x => x.id !== 'faceA', 60); },
    faceB: async s => { const r = await read(); await box(r.men.filter(m => !pairA.includes(m.cs)).map(m => m.cs)); await seen(s, 'the barrier\'s arrow'); await rdrag(s.at, s.toward); await until(x => x.id !== 'faceB', 60); },
    hold: async () => { await fight(x => x.id !== 'hold', 120); await run(60); },
  };

  for (let n = 0; n < steps.length && n < STEPS; n++) {
    const s = steps[n]; R = await read();
    if (R.id !== s.id) { check(false, `step ${n + 1} '${s.id}' is the one up`, `up: ${R.id} (${R.i}) · line "${R.line}"`); break; }
    if (!R.plan) downAt.push(s.id);
    log(`step ${n + 1} '${s.id}': "${R.line}" keys [${R.keys}] t ${R.t} · mode ${R.plan} · view ${R.look} · foes ${R.foes} · ${await shot(`${n + 1}-${s.id}`)}`);
    // A CARD on the step (its `explain`, ui/railcard.ts): up with its words; Enter closes it once it has been up a moment
    if (s.explain) {
      const card = () => page.evaluate(() => { const e = document.getElementById('railcard'); return { on: !!e && e.classList.contains('on'), h: e?.querySelector('h2')?.textContent || '', p: [...(e?.querySelectorAll('p') ?? [])].map(x => x.textContent).join(' ') }; });
      await page.evaluate(() => { const g = window.__game; window.__railcardTick?.(); void g; });
      const live = k => page.evaluate(async k => { const g = window.__game, t0 = g.time; window.__pauseLoop = false; await new Promise(res => { let i = 0; const f = () => { if (++i > k) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); window.__pauseLoop = true; return +(g.time - t0).toFixed(3); }, k);
      const under = process.env.LIVE === '1' ? await live(3) : null; const C = await card();
      await page.waitForTimeout(450); await page.keyboard.press('Enter'); await run(2); const D = await card();
      if (process.env.LIVE === '1') check(C.on && !!C.p && !D.on, `step ${n + 1} '${s.id}' opens on a card: up with its words, Enter closes it`, `"${C.h}": ${C.p} · the loop's frames under it moved the clock ${under} s · after Enter: ${D.on ? 'up' : 'gone'}`);
      else log(`  card (not drawn here: the page's own loop draws it, LIVE=1 lets it run): "${s.explain.title}"`);
    }
    if (!hand[s.id]) { check(false, `step '${s.id}' has a hand`, 'no entry'); break; }
    await hand[s.id](s);
    for (let k = 0; k < 6; k++) { R = await read(); if (R.id !== s.id) break; await run(60); }
    R = await read();
    check(R.id !== s.id, `step ${n + 1} '${s.id}' is done by a hand's own keys`, `now ${R.done ? 'finished' : `'${R.id}'`} at t ${R.t} · mode ${R.plan} · picked ${R.picked.length} · foes ${R.foes} · orders ${R.orders} (${R.last}) · ${R.sum}`);
    if (R.id === s.id) { log('stuck', JSON.stringify(R)); break; }
  }
  await run(120); R = await read();
  log('end', JSON.stringify({ ...R, men: R.men.map(m => `${m.cs}:${m.order}`) }));
  if (STEPS >= steps.length) check(R.done, 'the mission is finished', `finished ${R.done} at t ${R.t}`);
  // (the mode was up as every step came up and is up at the end; no line of the mission named a key that opens or closes it, a walk of his or a click on the ground — [Shift] is named: it adds a man to the picked)
  { const named = steps.filter(s => [s.line, s.planLine, s.explain?.title, s.explain?.text, s.after?.line, s.after?.word].some(x => typeof x === 'string' && /\[Tab\]|\[B\]|walk to|walk into the|yourself|click[^.]*\bground\b|\bground to pick/i.test(x))).map(s => s.id);
    if (STEPS >= steps.length) check(!downAt.length && R.plan && !named.length, 'plan mode was up as every step came up and at the end, and no line or card names Tab, the command key, a walk of his, "yourself" or a click on the ground', `down at: ${downAt.join(', ') || 'never'} · at the end ${R.plan ? 'up' : 'DOWN'} · lines that name them: ${named.join(', ') || 'none'}`); }
  check(!errors.length, 'no page error and no console error', errors.length ? errors.slice(0, 6).join('\n    ') : 'none');
  console.log(`pictures: ${OUT}`);
  if (!held) await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
