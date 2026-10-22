// THE TUTORIAL'S SQUAD MISSION ON THE REAL PAGE, WITH REAL KEYS: headless Chromium on the software WebGPU adapter (tools/qa/tut-page.cjs's recipe — SwiftShader,
// no GPU; the page is ?paused and stepped by __runFrames with nothing drawn, every input a DOM event from Playwright's keyboard and mouse).
// What the headless lesson run cannot see: that the bundle boots the level and its script on the frame (game/rails.ts), that the one big line is up with the
// player's own key on a key cap, that what the mission has not taught yet is locked against a real key, that a hand gets through the two easy rooms, that the
// next line walks him out to the mouth of the lane, that the workshop's man is there on the screen, in the picture under the fog on his open doorway, that
// the authored checkpoint comes back on its step with the level's script running again, and that the squad's key on the side door's ring, the walk round and
// the key again take the workshop.
// Then its two menu steps, each put up by hand: the line's caps, the squad's key kept down (the ring), and the digit that gives the order.
//   PORT=5231 node tools/qa/tut-squad-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   env: QUALITY (default verylow) · OUT (a folder for the pictures; default a temp folder) · SHOTS=0 (no pictures: each is about a minute here)
// exit 0 = every line passes · 1 = a FAIL or a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'tut-squad-page-'));
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const HUT = [10.85, 1, 11.0], STORE = [10.85, 1, 16.5], SIDE = [22.0, 1, 8.25], ALLEY = [23.4, 0, 8.8], VIEW = [14.25, 0, 12.5], STORE_IN = [10.6, 0, 18.8], STREET = [8.6, 0, 13.6];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false;
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); const errors = [];
  page.setDefaultTimeout(0);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  const run = n => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);   // (stepped, never drawn: a drawn frame is half a minute here)
  const read = () => page.evaluate(() => { const g = window.__game, el = document.getElementById('railprompt');
    return { i: g.lesson.i, id: g.lesson.step?.id ?? null, line: el?.querySelector('.line')?.textContent ?? '', keys: [...(el?.querySelectorAll('kbd') ?? [])].map(k => k.textContent), up: !!el && getComputedStyle(el).display !== 'none',
      row: document.getElementById('objective')?.textContent ?? '', fatal: document.getElementById('fatal')?.textContent || '', rails: g.rails.live, sum: g.rails.summary(), script: !!g.director.running,
      at: [+g.player.char.pos[0].toFixed(1), +g.player.char.pos[2].toFixed(1)], mates: g.guards.filter(x => x.team === 'operative' && x.state !== 'dead').length, men: g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead').length,
      shop: (() => { const m = g.guards.find(x => x.callsign === 'Tango 4'), F = g.fogOfWar, d = g.doors.byName('workshop'); const v = document.getElementById('view').getBoundingClientRect(), sc = m ? window.__cam.project(m.char.pos, v.width, v.height, 1) : null;
        return { fog: !!F.active, drawn: !!m && F.drawn(m), held: !!m?.script, up: !!m && m.state !== 'dead', door: d ? +d.angle.toFixed(2) : null, screen: !!sc && sc[0] > 40 && sc[0] < v.width - 40 && sc[1] > 40 && sc[1] < v.height - 40 }; })(),
      set: (() => { const m = g.orders.men('all'); return m.length > 0 && m.every(x => g.orders.of(x)?.arrived); })(),
      orders: g.orders.log.length, last: g.orders.log.length ? `${g.orders.log[g.orders.log.length - 1].order} ${g.orders.log[g.orders.log.length - 1].target}` : '', menu: !!window.__orders?.menu, frags: g.player.frags, slot: g.player.slot ?? null, t: +g.time.toFixed(1) }; });
  // (a picture, as tut-page.cjs takes one: the frame is drawn and read back in the page and stood under the HUD as a still)
  const shot = async tag => { if (process.env.SHOTS === '0') return '(no picture asked)'; const f = path.join(OUT, `tut-squad-${tag}.png`);
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
  const point = async w => { const s = await page.evaluate(p => { const c = document.getElementById('view'), r = c.getBoundingClientRect(), [x, y] = window.__cam.project(p, r.width, r.height, 1); return { x: r.left + x, y: r.top + y }; }, w); await page.mouse.move(s.x, s.y); await run(2); };
  const tap = async k => { await page.keyboard.down(k); await run(3); await page.keyboard.up(k); await run(3); };
  const until = async (want, secs) => { for (let k = 0; k < secs; k++) { const s = await read(); if (want(s)) return s; await run(60); } return read(); };
  // (walked with the walk keys held, steered off where the page says he is. The view may be turned, so which key is which way is MEASURED: a short stride on D
  //  and one on S give the two directions the keys move him in, and each stride after is the pair of keys whose sum points most nearly at the mark)
  let AX = null;
  const stride = async (keys, n) => { for (const k of keys) await page.keyboard.down(k); await run(n); for (const k of keys) await page.keyboard.up(k); await run(1); };
  const axes = async () => { const a = await read(); await stride(['KeyD'], 10); const b = await read(); await stride(['KeyS'], 10); const c = await read();
    const n = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }; AX = { D: n([b.at[0] - a.at[0], b.at[1] - a.at[1]]), S: n([c.at[0] - b.at[0], c.at[1] - b.at[1]]) }; };
  //  (a stride that got him nowhere — a teammate in a doorway, a jamb — is answered as a hand would: a short step to one side, the other side next time)
  const walk = async (to, secs) => { if (!AX) await axes(); let was = Infinity, side = 1;
    for (let k = 0; k < secs * 4; k++) { const s = await read(), dx = to[0] - s.at[0], dz = to[2] - s.at[1], d = Math.hypot(dx, dz); if (d < 0.7) return true;
      const pd = (dx * AX.D[0] + dz * AX.D[1]) / d, ps = (dx * AX.S[0] + dz * AX.S[1]) / d, keys = [];
      if (was - d < 0.08) { await stride(Math.abs(pd) > Math.abs(ps) ? [side > 0 ? 'KeyS' : 'KeyW'] : [side > 0 ? 'KeyD' : 'KeyA'], 14); side = -side; was = Infinity; continue; }
      was = d;
      if (Math.abs(pd) > 0.3) keys.push(pd > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(ps) > 0.3) keys.push(ps > 0 ? 'KeyS' : 'KeyW'); await stride(keys, Math.max(4, Math.min(40, Math.round(d * 14)))); }
    return false; };

  const url = `http://localhost:${PORT}/?levelFile=tut-squad.json&roomclear=1&squad4&paused&quality=${QUALITY}&mute&nocutboxes`;
  log(url);
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 0 });   // (the bundle has run: the boot's own promise is there to wait on)
  const row = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(3, 1 / 60, [], 'none'); const e = window.__scenarios.current()?.entry ?? window.__scenarios.current(); return e ? `${e.id} · ${e.group} ▸ ${e.title}` : null; });
  let R = await read(); log('booted', JSON.stringify(R));
  check(/^tut-squad · tutorial/.test(row || ''), "the page knows this URL as the Tutorial group's row", String(row));
  check(!R.fatal && R.rails && R.up && R.i === 0 && R.id === 'stack-hut' && R.mates === 4 && R.men === 11 && R.script, 'it boots on rails: one big line up, the four, eleven defenders, its script running',
    `fatal "${R.fatal}" · ${R.sum} · line "${R.line}" keys [${R.keys}] · small row "${R.row}" · ${R.mates} teammates · ${R.men} defenders · script ${R.script}`);
  check(R.keys.length === 1 && R.keys[0] === 'Q' && !/\[/.test(R.line), "the line's key is drawn as a key cap with the key the page has the squad's command on (Q)", `"${R.line}" keys [${R.keys}]`);
  log('picture', await shot('1-boot'));

  // ---- locked: what this mission has not asked for yet does nothing under a real key (the orders menu, the frag's slot)
  { const b = await read(); await page.mouse.move(640, 300);
    for (const k of ['KeyX', 'Digit5', 'KeyG', 'KeyT']) await tap(k);
    const a = await read(); check(a.orders === b.orders && !a.menu && a.i === 0 && a.slot === b.slot, 'before their steps the frag and a tool do nothing (the menu and the roster keys have no key on this page; the ring: the last line)', `orders ${b.orders} → ${a.orders} · menu up ${a.menu} · slot ${b.slot} → ${a.slot} · ${a.sum}`); }

  // ---- steps 1 to 4 by hand: the squad's key (Q on the page) on two doors, and in behind them
  await walk(STREET, 20);
  await point(HUT); await tap('KeyQ'); R = await until(x => x.i >= 1, 60); check(R.i >= 1, "the squad's key on the hut door: they stack", `step ${R.i + 1} '${R.id}' at ${R.t} s · "${R.line}"`);
  await point(HUT); await tap('KeyQ'); R = await until(x => x.i >= 2, 40); if (R.i < 2) { await tap('KeyF'); R = await until(x => x.i >= 2, 40); } check(R.i >= 2 && R.men <= 10, 'the key again: they go in and the hut is taken', `${R.men} defenders left at ${R.t} s · step ${R.i + 1} '${R.id}'`);
  await point(STORE); await tap('KeyQ'); R = await until(x => x.i >= 3, 80); check(R.i >= 3, 'the key on the store door: they stack', `step ${R.i + 1} '${R.id}' at ${R.t} s`);
  await point(STORE); await tap('KeyQ'); R = await until(x => x.men <= 8, 40); if (R.men > 8) { await tap('KeyF'); R = await until(x => x.men <= 8, 40); } check(R.men <= 8, 'the key again: the store is taken', `${R.men} defenders left at ${R.t} s`);
  // (through the doorway as a hand walks it: square on to the open leaf's gap, through, then to the mark)
  await walk([10.75, 0, 15.3], 20); await walk([10.75, 0, 17.7], 20); const inside = await walk(STORE_IN, 20); R = await until(x => x.i >= 4, 10); check(inside && R.i === 4 && R.id === 'out', 'walked in behind them: the next line sends him back out to the street', `inside ${inside} · step ${R.i + 1} '${R.id}' · "${R.line}" at ${R.at}`);
  const slots = await page.evaluate(() => window.__game.saves.slots().map(x => ({ key: x.key, label: x.label })));
  const mine = slots.find(x => /the street/.test(x.label || ''));
  check(!!mine, "the checkpoint 'the street' was kept as that step came up", `slots: ${slots.map(x => x.label).join(' · ') || 'none'}`);
  // ---- out to the mouth of the lane, as the line says: the workshop's man is on the screen there, in the script's hand on his open doorway, and in the
  //      picture under the fog (the page runs the fog of war: a run with it off fails this line, on purpose)
  const out = async () => { for (const p of [[10.85, 0, 17.9], [10.85, 0, 15.2], VIEW]) await walk(p, 30); return until(x => x.i >= 5, 10); };
  const shown = x => x.shop.up && x.shop.held && Math.abs(x.shop.door) > 1 && x.shop.fog && x.shop.drawn;
  R = await out(); check(R.i === 5 && R.id === 'side', 'out at the mouth of the lane: the side door is the step', `step ${R.i + 1} '${R.id}' · "${R.line}" keys [${R.keys}] at ${R.at}`);
  await run(120); R = await read();
  check(shown(R) && R.shop.screen, "the workshop's man holds his open doorway, is in the picture under the fog and is on the screen from where the player stands", JSON.stringify(R.shop));
  log('picture', await shot('6-side'));
  // (the squad's key on the step's ring: the view eases to keep the ring on the screen, so the cursor is put on it again once it has settled)
  const order = async () => { await point(SIDE); await run(40); await point(SIDE); await tap('KeyQ'); };
  if (mine) {
    await order(); const before = await until(x => x.i >= 6, 20);
    check(before.i >= 6 && /stack door:workshop_side/.test(before.last), "the squad's key on the step's ring: they are sent to the side door", `step ${before.i + 1} '${before.id}' · last order ${before.last}`);
    const why = await page.evaluate(k => window.__game.saves.load(window.__game, k), mine.key); await run(90); R = await read();
    check(!why && R.id === 'out' && R.script && R.men === 8 && shown(R), 'the checkpoint put back: its own step, the script running again, eight defenders, the man on his doorway and shown', `was step ${before.i + 1} '${before.id}' → step ${R.i + 1} '${R.id}' at ${R.at} · script ${R.script} · ${R.men} defenders · ${JSON.stringify(R.shop)} ${why || ''}`);
    R = await out(); check(R.i === 5, 'out to the street again: the side door is the step', `step ${R.i + 1} '${R.id}' at ${R.at}`);
  }
  // ---- by hand: the key on the side door, the walk round by the street, the key again
  await order(); R = await until(x => x.i >= 6, 20); check(R.i >= 6 && /stack door:workshop_side/.test(R.last), 'the key on the side door: the squad is sent to it and the next line is up', `step ${R.i + 1} '${R.id}' · "${R.line}" · last order ${R.last}`);
  for (const p of [[21.4, 0, 12.3], [22.8, 0, 11.6], ALLEY]) await walk(p, 30);
  R = await until(x => x.i >= 7, 40); check(R.i >= 7 && R.shop.up && R.shop.held, "walked round by the street: in the alley, the man still the script's, on his doorway", `step ${R.i + 1} '${R.id}' at ${R.at} · ${JSON.stringify(R.shop)}`);
  const took = x => x.men <= 7 && x.i >= 8;
  R = await until(x => x.set, 40); check(R.set, 'the four stand on the side door', `set ${R.set} at ${R.t} s`); await run(30); await point(SIDE); await tap('KeyQ'); R = await until(took, 40); if (!took(R)) { await tap('KeyF'); R = await until(took, 40); }
  check(took(R), 'the key again: in at his back, the workshop is taken', `${R.men} defenders left · step ${R.i + 1} '${R.id}' at ${R.t} s · last order ${R.last}`);
  // ---- the two menu steps, each put up BY HAND (lesson.i set from here: nothing walked or fought to them, and the frame answers the step as it would a
  //      real one — its checkpoint written from this floor, the level's program started over — so nothing after this block reads a checkpoint). Where the
  //      squad's keys are the command key and the word's (the page as it opens) the menu's own key gives nothing, the line's [X] is drawn "Hold" and the
  //      command key's cap, and that key kept down is the menu as a ring
  { const more = () => page.evaluate(() => { const g = window.__game, l = g.orders.log, m = g.orders.menu; return { n: l.length, last: l.length ? l[l.length - 1].order : null, menu: !!m, ring: !!g.orders.cmdRing, kind: m?.target?.kind ?? null, man: !!m?.target?.man }; });
    const setStep = async i => { await page.evaluate(i => { const L = window.__game.lesson; L.i = i; L.seen = null; }, i); await run(4); return read(); };
    const holdQ = async () => { await page.keyboard.down('KeyQ'); await run(30); await page.keyboard.up('KeyQ'); await run(3); };
    // (the cursor on a spot the game's own pick calls bare floor — no man, no door — asked before the key goes down)
    const onFloor = async () => { const s0 = await read();
      for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [3, 1], [1, 3], [1.5, 1.5], [-1.5, 1.5], [3, -1], [-1, 3]]) {
        await point([s0.at[0] + dx, 0.05, s0.at[1] + dz]);
        const t = await page.evaluate(() => { const t = window.__game.orders.targetUnder(window.__input, window.__cam, document.getElementById('view')); return { kind: t.kind, man: !!t.man }; });
        if (t.kind === 'floor' && !t.man) return true; }
      return false; };
    R = await setStep(8);
    check(R.id === 'wall' && /^Hold\s*Q/.test(R.line.replace(/\s+/g, ' ')) && R.keys.join(',') === 'Q,3' && !/—/.test(R.line), "step 9's line reads Hold Q, 3, both on key caps", `"${R.line}" keys [${R.keys}] · ${R.sum}`);
    let floor = await onFloor(), M = await more(); await tap('KeyX'); let A = await more();
    check(floor && !A.menu && A.n === M.n, "the menu's own key gives nothing on this page", `floor under the cursor ${floor} · ${JSON.stringify(A)}`);
    await holdQ(); A = await more();
    check(A.menu && A.ring && !A.man, "the squad's key kept down: the menu is up as a ring, on no man, and stays", JSON.stringify(A));
    await tap('Digit3'); let Z = await more();
    check(Z.n === M.n + 1 && Z.last === 'fallIn' && !Z.menu, '3: fall in is given and the ring is away', `${JSON.stringify(M)} → ${JSON.stringify(Z)}`);
    R = await setStep(19);
    check(R.id === 'back' && /Hold\s*Q/.test(R.line.replace(/\s+/g, ' ')) && R.keys.join(',') === 'Q,2' && !/—/.test(R.line), "step 20's line reads Hold Q … then 2, both on key caps", `"${R.line}" keys [${R.keys}]`);
    floor = await onFloor(); M = await more(); await holdQ(); A = await more();
    check(floor && A.menu && A.ring && A.kind === 'floor' && !A.man, 'the key kept down with the cursor on the ground: the ring is up on that place', JSON.stringify(A));
    await tap('Digit2'); Z = await more();
    check(Z.n === M.n + 1 && Z.last === 'cover' && !Z.menu, '2: cover is given', `${JSON.stringify(M)} → ${JSON.stringify(Z)}`);
    // …and before the menu's step the same key kept down is a tap: no ring comes up (the lesson set back by hand: the steps this floor has already done go
    //  by at once, and the one left up is before 'wall', the ring not among what is unlocked)
    R = await setStep(0); floor = await onFloor(); await holdQ(); A = await more();
    check(R.i < 8 && !/\bring\b/.test(R.sum) && floor && !A.menu && !A.ring, "before the menu's step the squad's key kept down puts no ring up", `step ${R.i + 1} '${R.id}' · floor under the cursor ${floor} · ${JSON.stringify(A)} · ${R.sum}`); }
  check(!errors.length, 'no page error and no console error', errors.length ? errors.slice(0, 6).join('\n    ') : 'none');
  console.log(`pictures: ${OUT}`);
  await browser.close();
  console.log(failed ? '=== tut-squad-page: FAILED ===' : '=== tut-squad-page: ALL PASS (software adapter: never seen on a GPU) ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
