// A TUTORIAL MISSION PLAYED ON THE REAL PAGE WITH REAL KEYS: headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe — SwiftShader, no GPU).
// What the headless lesson run cannot see: that the bundle boots the level and its script, that the one big line is on screen with the player's own key on a key cap,
// that the locks hold against real DOM events, and that a hand at the keyboard and the mouse (not a script calling the game) gets through every step.
//   PORT=5199 node tools/qa/tut-page.cjs [tut-sky]         (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   env: QUALITY (default verylow) · OUT (a folder for a picture per step; default a temp folder) · STEPS (stop after this many steps) · SHOTS=0 (no pictures: each is about a
//        minute on the software adapter) · PICS=boot,move,stack (pictures at these tags only) · CDP=<port> (a browser already up on the mission's page)
// The page is ?paused and stepped by __runFrames with nothing drawn (the game steps the same; a picture draws its own frames); every input is a DOM event from
// Playwright's keyboard and mouse, read by the page's own listeners. exit 0 = every line passes · 1 = a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'tut-page-')), STEPS = +(process.env.STEPS || 99), PICS = process.env.PICS ? process.env.PICS.split(',') : null;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const name = process.argv[2] || 'tut-sky';
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false;
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

// ---- in the page
const run = (page, n) => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);   // (stepped, never drawn: a drawn frame is half a minute here — a picture draws its own)
const read = page => page.evaluate(() => { const g = window.__game, L = window.__lesson, el = document.getElementById('railprompt'), vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return { i: L.i, id: g.lesson.step?.id ?? null, done: g.lesson.finished, line: el?.querySelector('.line')?.textContent ?? '', keys: [...(el?.querySelectorAll('kbd') ?? [])].map(k => k.textContent), up: !!el && getComputedStyle(el).display !== 'none',
    row: document.getElementById('objective')?.textContent ?? '', sky: document.body.classList.contains('skyseat'), equip: vis('equip'), meters: vis('meters'), fatal: document.getElementById('fatal')?.textContent || '',
    rails: { live: g.rails.live, sum: g.rails.summary() }, t: +g.time.toFixed(1), team: g.guards.filter(x => x.team === 'operative').map(x => `${x.callsign}${x.state === 'dead' ? '†' : ''}@${x.char.pos[0].toFixed(0)},${x.char.pos[2].toFixed(0)}`).join(' '),
    foes: g.guards.filter(x => x.team !== 'operative' && x.state !== 'dead').length, orders: g.orders.log.length, state: window.__roomclear?.state ?? null }; });
const at = (page, p) => page.evaluate(p => { const c = document.getElementById('view'), r = c.getBoundingClientRect(), [x, y, vis] = window.__cam.project(p, r.width, r.height, 1); return { x: r.left + x, y: r.top + y, vis: !!vis && x > 8 && y > 8 && x < r.width - 8 && y < r.height - 8 }; }, p);

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', `${name}.json`), 'utf8')), steps = data.scenarios.lesson.steps, door = n => data.doors?.find(d => d.name === n);
  const held = process.env.CDP;   // (CDP=<port>: a browser already up with the mission's page open — a boot is six minutes on the software adapter)
  const browser = held ? await chromium.connectOverCDP(`http://127.0.0.1:${held}`) : await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = held ? browser.contexts()[0].pages()[0] : await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  // A PICTURE: the page does not answer a plain screenshot here (a drawn frame is half a minute on the software adapter and the compositor waits on it), so the
  // frame is drawn and read back in the page, stood under the HUD as a still in the canvas's place, and the page — HUD and all — is taken with that.
  const shot = async tag => { if (process.env.SHOTS === '0' || (PICS && !PICS.includes(String(tag).replace(/^\d+-/, '')))) return '(no picture asked)'; const f = path.join(OUT, `${name}-${tag}.png`);
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
  const url = `http://localhost:${PORT}/?roomclear&squad4&levelFile=${name}.json&paused&quality=${QUALITY}&mute${process.env.MARKCLEAR_BREAK === '1' ? '&markclear=0' : ''}`;
  log(url);
  if (!held) await page.goto(url, { timeout: 600000 });
  await page.evaluate(async held => { await window.__ready; window.__testVisible = true; if (held && window.__game.lesson.i > 0) window.__game.restartEncounter();   // (a page played before: the mission again, as Shift+Enter gives it)
    window.__runFrames(3, 1 / 60, [], 'none'); }, !!held);
  let R = await read(page);
  log('booted', JSON.stringify(R));
  check(!R.fatal && R.rails.live && R.up && R.i === 0 && R.sky && !R.equip && !R.meters, 'the page boots the mission on rails: one big line up, the sky seat, no kit or meter rows',
    `fatal "${R.fatal}" · rails ${JSON.stringify(R.rails)} · line "${R.line}" keys [${R.keys}] · small row "${R.row}" · skyseat ${R.sky} · equip ${R.equip} · meters ${R.meters}`);
  log('picture', await shot('0-boot'));

  // ---- locked: before anything is taught a hand on every key does nothing
  { const before = await page.evaluate(() => ({ o: window.__game.orders.log.length }));
    await page.mouse.move(640, 300);
    for (const k of ['KeyQ', 'KeyX', 'KeyF', 'KeyT', 'KeyG', 'Digit3']) { await page.keyboard.down(k); await run(page, 3); await page.keyboard.up(k); await run(page, 3); }
    await page.mouse.down(); await run(page, 4); await page.mouse.up(); await run(page, 4);
    const after = await page.evaluate(() => ({ o: window.__game.orders.log.length, menu: !!window.__orders.menu })); R = await read(page);
    check(after.o === before.o && !after.menu && R.i === 0, 'before anything is taught, the command key, the menu, the word, a throw and a click do nothing', `orders ${before.o} → ${after.o} · menu up ${after.menu} · step ${R.i} · ${R.rails.sum}`); }

  // ---- the steps, by hand
  const camKey = async () => (await page.evaluate(() => document.querySelector('#railprompt kbd')?.textContent || '')) === 'Space' ? 'Space' : 'ControlLeft';
  let smokeCall = null;   // (the 'zoom' hand's reading of the squad's smoke calls)
  const hand = {
    // (the camera's key is the one the line's own cap names: Ctrl, or the Space bar where the page's board leaves it spare)
    turn: async () => { const k = await camKey(); await page.keyboard.down(k); for (let x = 400; x <= 900; x += 50) { await page.mouse.move(x, 320); await run(page, 3); } await page.keyboard.up(k); },
    // (…and the squad's smoke goes out on the NEXT step's cue, the tick that step comes up: the page is stepped a twentieth of a second at a time from the
    //  zoom's last frame, so each thrower's call is read as the page draws it before his can is in the air)
    zoom: async () => { const k = await camKey(); await page.keyboard.down(k); for (let n = 0; n < 8; n++) { await page.mouse.wheel(0, 120); await run(page, 4); } await page.keyboard.up(k);
      // (the page as it is DRAWN, a twentieth of a second at a time: the bubbles on it with 'smoke' in them, the radio strip's rows, and — from the game —
      //  each can in the air with its thrower's name)
      const look = () => page.evaluate(() => { const g = window.__game, shown = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.3; };
        return { bubbles: [...document.querySelectorAll('.bubble')].filter(e => shown(e) && /smoke/i.test(e.textContent)).map(e => e.textContent), strip: [...document.querySelectorAll('#log .rx')].map(e => e.textContent).filter(t => /smoke/i.test(t)),
          cans: g.items.items.filter(i => i.kind === 'smoke').map(i => ({ n: i.serial, who: g.guards.find(x => x.char.id === i.who)?.callsign ?? '?', said: g.guards.find(x => x.char.id === i.who)?.bubble?.text ?? '' })) }; });
      if (steps[steps.findIndex(s => s.id === 'zoom') + 1]?.cue !== 'smoke') return;   // (a mission whose next step throws no smoke)
      for (let n = 0; n < 60 && (await read(page)).id === 'zoom'; n++) await run(page, 3);
      smokeCall = { cans: [], pic: '' }; let was = { bubbles: [], strip: [] };
      for (let n = 0; n < 120 && smokeCall.cans.length < 2; n++) { await run(page, 3); const L = await look();   // (six seconds at most: the second can is out about 1.6 s after the cue)
        for (const c of L.cans) if (!smokeCall.cans.some(x => x.n === c.n)) smokeCall.cans.push({ ...c, bubble: !!c.said && was.bubbles.some(t => t.includes(c.said)), row: was.strip.find(t => t.includes(c.who) && t.includes(c.said)) || '' });   // (`was`: the page a twentieth of a second BEFORE the can was first in the air)
        if (L.cans.length === 1 && !smokeCall.pic) smokeCall.pic = await shot('2-call'); was = L; }
      check(smokeCall.cans.length >= 2 && new Set(smokeCall.cans.map(c => c.who)).size >= 2 && smokeCall.cans.every(c => c.bubble && c.row),
        'the squad\'s smoke is called on the page: before each can is in the air its own thrower\'s line is drawn in a bubble and is a row under his name on the radio strip',
        `${smokeCall.cans.map(c => `${c.who}: ${c.said ? `"${c.said}"` : 'SAID NOTHING'} · bubble ${c.bubble ? 'drawn' : 'NOT DRAWN'} · strip ${c.row ? `"${c.row.trim()}"` : 'NO ROW'}`).join(' | ') || 'no can went out'} · picture ${smokeCall.pic}`); },
    pan: async () => {
      await page.keyboard.down('KeyD'); await run(page, 70); await page.keyboard.up('KeyD'); },
    move: async s => { await point(s.at); await tap('KeyQ'); for (let k = 0; k < 25; k++) { await run(page, 120); if ((await read(page)).id !== 'move') break; } },
    gate: async () => { for (let k = 0; k < 40; k++) { await run(page, 120); if ((await read(page)).id !== 'gate') break; } },
    // (the stack's tap is made WITH SHIFT DOWN: plan mode is locked on this step and the pair is then the plain key — the second play's 'Q doesn't do anything here')
    stack: async s => { await point(s.at); await page.keyboard.down('ShiftLeft'); await run(page, 3); await tap('KeyQ'); await page.keyboard.up('ShiftLeft'); for (let k = 0; k < 20; k++) { await run(page, 120); if ((await read(page)).id !== 'stack') break; } },
    go: async () => { await tap('KeyF'); for (let k = 0; k < 20; k++) { await run(page, 120); if ((await read(page)).id !== 'go') break; } },
    kitchen: async s => { await point(s.at); await tap('KeyQ'); for (let k = 0; k < 10; k++) { await run(page, 120); if (k >= 3) break; }
      await tap('KeyF'); for (let k = 0; k < 20; k++) { await run(page, 120); if ((await read(page)).id !== 'kitchen') break; } },
    // the orders' menu on the wall's ring: ONE ring with the charge on a wedge of it (the level's `rails.flatRing`) — or, with that off, its fifth row
    // is the wall's page, the third there the charge; then the word once a man has set it
    charge: async s => {
      // (the step teaches the key HELD: a tap gives no order and says so under the line; held, the ring is up and the line is what to press in it)
      await point(s.at); const o0 = await page.evaluate(() => window.__game.orders.log.length); await tap('KeyQ'); await run(page, 6);
      const T = await page.evaluate(() => ({ o: window.__game.orders.log.length, note: document.querySelector('#railprompt .note')?.textContent || '', line: document.querySelector('#railprompt .line')?.textContent || '' }));
      check(T.o === o0 && !!T.note, 'on the hold\'s step a tap of the command key gives no order and words come up under the line', `orders ${o0} → ${T.o} · line "${T.line}" · under it "${T.note}"`);
      log('picture', await shot('91-tap'));
      const mk = () => page.evaluate(() => { const e = document.querySelector('.objmark'); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await point(s.at); const mark0 = await mk(); await page.keyboard.down('KeyQ'); await run(page, 30); await page.keyboard.up('KeyQ'); await run(page, 3);
      await run(page, 2); const mark1 = await mk(); const U = await page.evaluate(() => ({ menu: !!window.__orders.menu, flat: !!window.__orders.menu?.flat, line: document.querySelector('#railprompt .line')?.textContent || '', keys: [...document.querySelectorAll('#railprompt .line kbd')].map(k => k.textContent) }));
      if (U.flat) check(U.menu && U.keys.length === 1 && /^[1-5]$/.test(U.keys[0]), 'held, the ring is up and stays with the key let go: one ring, and the line names its one digit', `ring ${U.menu}, flat ${U.flat} · line "${U.line}" · keys ${JSON.stringify(U.keys)}`);
      else check(U.menu && /5/.test(U.line) && /3/.test(U.line), 'held, the ring is up and stays with the key let go, and the line names the two digits', `ring ${U.menu} · line "${U.line}"`);
      check(!!mark0 && !mark1, 'the step\'s mark is drawn on its place, and gives way to the ring held up over it (?markclear=0 keeps it: MARKCLEAR_BREAK=1 loads that)', `before the ring ${mark0 ? `at ${mark0.x.toFixed(0)},${mark0.y.toFixed(0)}` : 'NOT DRAWN'} · with the ring up ${mark1 ? `DRAWN at ${mark1.x.toFixed(0)},${mark1.y.toFixed(0)}` : 'not drawn'}`);
      log('picture', await shot('92-ring'));
      if (U.flat) { await tap('Digit' + U.keys[0]); const V = await page.evaluate(() => ({ menu: !!window.__orders.menu, last: window.__game.orders.log[window.__game.orders.log.length - 1]?.order ?? null })); check(!V.menu && V.last === 'wallCharge', 'that one digit gives the wall charge and the ring is gone: no second ring', `ring up ${V.menu} · the last order '${V.last}'`); }
      else { await tap('Digit5'); await tap('Digit3'); }
      await until('charge', 40); },   // (the command key held is the squad's menu, a ring that stays: its wall page, then the charge)
    blow: async () => { await run(page, 60); await tap('KeyF'); await until('blow', 30); },
    breaker: async s => { await point(s.at); await tap('KeyQ'); await until('breaker', 40); },
    nv: async () => { await tap('KeyN'); await run(page, 20); },
    // (nothing to press: the two who come out with torches are the squad's, and the step is done by the script's own word)
    torches: async () => { await until('torches', 25); },
    bunk: async s => { for (let n = 0; n < 2 && (await read(page)).id === 'bunk'; n++) { await point(s.at); await tap('KeyQ'); await run(page, 1200); await tap('KeyF'); await until('bunk', 20); } },
    out: async s => { const nv0 = await page.evaluate(() => window.__game.player.nv); await point(s.at); await tap('KeyQ'); await run(page, 240);
      const V = await page.evaluate(() => ({ nv: window.__game.player.nv, off: window.__game.rails.panned() }));
      check(nv0 && !V.nv && V.off < 1, 'the last order given, the night vision comes up and the view is back on the squad', `night vision ${nv0} → ${V.nv} · the view's shift off the squad ${V.off.toFixed(1)} m`);
      log('picture', await shot('93-way')); await until('out', 40); },
  };
  /** step the page until another step is up (at most `n` two-second waits) */
  const until = async (id, n) => { for (let k = 0; k < n; k++) { await run(page, 120); if ((await read(page)).id !== id) break; } };
  // (a hand looks for the marker: if the place is off the picture, pan the view toward it with the keys the mission has taught)
  const point = async p => { for (let k = 0; k < 12; k++) { const s = await at(page, p); if (s.vis) { await page.mouse.move(s.x, s.y); await run(page, 2); return s; }
      const key = s.y < 8 ? 'KeyW' : s.y > 700 ? 'KeyS' : s.x < 8 ? 'KeyA' : 'KeyD'; await page.keyboard.down(key); await run(page, 20); await page.keyboard.up(key); }
    log('  (the place never came onto the picture)', JSON.stringify(p)); return null; };
  const tap = async k => { await page.keyboard.down(k); await run(page, 2); await page.keyboard.up(k); await run(page, 2); };

  for (let n = 0; n < steps.length && n < STEPS; n++) {
    const s = steps[n]; R = await read(page);
    if (R.id !== s.id) { check(false, `step ${n + 1} '${s.id}' is the one up`, `up: ${R.id} (${R.i}) · line "${R.line}"`); break; }
    const f = await shot(`${n + 1}-${s.id}`);
    log(`step ${n + 1} '${s.id}': "${R.line}" keys [${R.keys}] t ${R.t} · ${R.team} · foes ${R.foes} · ${f}`);
    // A CARD on the step (its `explain`, ui/railcard.ts): up and read; the page's OWN loop let run under it holds the world still (LIVE=0 skips that: a drawn
    // frame is slow here); Enter closes it, and the loop then runs the world again
    if (s.explain) {
      const card = () => page.evaluate(() => { const e = document.getElementById('railcard'); return { on: !!e && e.classList.contains('on'), h: e?.querySelector('h2')?.textContent || '', p: [...(e?.querySelectorAll('p') ?? [])].map(x => x.textContent).join(' / '), owed: !!window.__game.rails.card(), t: window.__game.time }; });
      const live = n => page.evaluate(async n => { const g = window.__game, t0 = g.time; window.__pauseLoop = false; await new Promise(res => { let k = 0; const f = () => { if (++k > n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); window.__pauseLoop = true; return +(g.time - t0).toFixed(4); }, n);
      const C = await card(); log('picture', await shot(`60${n + 1}-card`));
      const LIVE = process.env.LIVE !== '0', under = LIVE ? await live(3) : null;
      await page.waitForTimeout(450); await page.keyboard.press('Enter'); const D = await card(), after = LIVE ? await live(3) : null;   // (a card closes on a key only once it has been up a moment)
      check(C.on && C.owed && !!C.p && !D.on && (!LIVE || (under === 0 && after > 0)), `step ${n + 1} '${s.id}' opens on a card: up with its words, the page's own loop holds the world under it, Enter closes it and the world runs again`,
        `"${C.h}": ${C.p} · the loop's three frames under it moved the clock ${under ?? '(not asked)'} s · Enter: card ${D.on ? 'up' : 'gone'} · three frames after: ${after ?? '(not asked)'} s`);
    }
    if (!hand[s.id]) { check(false, `step '${s.id}' has a hand`, 'no entry'); break; }
    await hand[s.id](s);
    for (let k = 0; k < 6; k++) { R = await read(page); if (R.id !== s.id) break; await run(page, 60); }
    R = await read(page);
    check(R.id !== s.id, `step ${n + 1} '${s.id}' is done by a hand's own keys`, `now ${R.done ? 'finished' : `'${R.id}'`} at t ${R.t} · ${R.team} · foes ${R.foes} · orders ${R.orders} · ${R.rails.sum}`);
    if (R.id === s.id) { log('stuck picture', await shot(`stuck-${s.id}`)); break; }
  }
  await run(page, 180); R = await read(page);
  log('end', JSON.stringify(R)); log('picture', await shot('9-end'));
  check(!errors.length, 'no page error and no console error', errors.length ? errors.slice(0, 6).join('\n    ') : 'none');
  console.log(`pictures: ${OUT}`);
  if (!held) await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
