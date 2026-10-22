// THE TUTORIAL'S PAIR MISSION ON THE REAL PAGE, WITH REAL KEYS: headless Chromium on the software WebGPU adapter (tools/qa/tut-page.cjs's recipe — SwiftShader,
// no GPU; the page is ?paused and stepped by __runFrames with nothing drawn, every input a DOM event from Playwright's keyboard and mouse).
// What the headless lesson run (tools/qa/lessons/tut-pair.ts) cannot see: that the bundle boots the level and its script on the frame (game/rails.ts), that the
// one big line is up with the player's own key on a key cap, that what a step has not taught yet is locked against a real key, that each explain card comes
// up and closes, and that a hand at the keyboard and the mouse gets through all of it: the walk keys, the squad's key on a man and on the fuse box, the word,
// the grab, the right button, the pad, the trunk and the far gate.
//   PORT=5247 node tools/qa/tut-pair-page.cjs        (a dev server on that port: PORT=5247 bun run tools/serve.ts)
//   env: QUALITY (default verylow) · OUT (a folder for the pictures; default a temp folder) · SHOTS=0 (no pictures: each is about a minute here) ·
//        PICS=boot,mark,lamps (pictures at these steps only) · STEPS (stop after this many steps)
// exit 0 = every line passes · 1 = a FAIL or a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'tut-pair-page-')), STEPS = +(process.env.STEPS || 99), PICS = process.env.PICS ? process.env.PICS.split(',') : null;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false;
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', 'tut-pair.json'), 'utf8')), steps = data.scenarios.lesson.steps, step = id => steps.find(s => s.id === id);
  const post = name => data.routes.find(r => r.id === name).points[0];
  const A = post('pickup'), B = post('near'), C = post('far'), D = post('gate'), FIRST = step('lead').at, GAP = step('gap').at, BEHIND = step('near').at, PAST = step('past').at, BOX = step('box').at;
  const office = data.doors.find(d => d.id === 'office'), gate = data.doors.find(d => d.id === 'gate_e'), TRUNK = step('take').at;
  const DOOR = [office.hinge[0] + office.width / 2, 1.0, office.hinge[1]], GATE = [gate.hinge[0], 1.0, gate.hinge[1] + gate.width / 2];
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); const errors = [];
  page.setDefaultTimeout(0);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  const run = n => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);   // (stepped, never drawn: a drawn frame is half a minute here)
  const read = () => page.evaluate(() => { const g = window.__game, el = document.getElementById('railprompt'), P = g.player, mate = g.guards.find(x => x.unit && x.team === 'operative');
    return { i: g.lesson.i, id: g.lesson.step?.id ?? null, done: g.lesson.finished, line: el?.querySelector('.line')?.textContent ?? '', keys: [...(el?.querySelectorAll('kbd') ?? [])].map(k => k.textContent), up: !!el && getComputedStyle(el).display !== 'none',
      note: el?.querySelector('.note')?.textContent ?? '', row: document.getElementById('objective')?.textContent ?? '', fatal: document.getElementById('fatal')?.textContent || '', rails: g.rails.live, sum: g.rails.summary(), script: !!g.director.running,
      at: [+P.char.pos[0].toFixed(2), +P.char.pos[2].toFixed(2)], crouch: !!P.crouch, holding: !!P.holding, nv: !!P.nv, lit: +P.visibility.toFixed(2), dark: !!g.blackout.active,
      mate: mate ? [+mate.char.pos[0].toFixed(1), +mate.char.pos[2].toFixed(1)] : null, mateSays: mate ? g.orders.statusOf(mate) : '', men: g.guards.filter(x => !x.unit && x.state !== 'dead').length,
      roused: g.guards.filter(x => !x.unit && x.state !== 'dead' && x.state !== 'patrol' && !x.held).map(x => `${x.callsign} ${x.state}`).join(', '),
      orders: g.orders.log.length, last: g.orders.log.length ? `${g.orders.log[g.orders.log.length - 1].order}@${g.orders.log[g.orders.log.length - 1].target}` : '', menu: !!window.__orders?.menu, stage: g.mission.stage, t: +g.time.toFixed(1) }; });
  // (a picture, as tut-page.cjs takes one: the frame is drawn and read back in the page and stood under the HUD as a still)
  const shot = async tag => { if (process.env.SHOTS === '0' || (PICS && !PICS.includes(String(tag).replace(/^\d+-/, '')))) return '(no picture asked)'; const f = path.join(OUT, `tut-pair-${tag}.png`);
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
  /** a few DRAWN frames: the stepped frames are never drawn here, so the page's own light meter (the player's, and the partner's where he stands) answers
   *  only when a frame is — and the partner reads his before he sets off. Called where the light is the thing in question; `SETTLE=0` leaves it out */
  const settle = async (n = 4) => { if (process.env.SETTLE === '0') return; await page.evaluate(async n => { const dev = window.__engine.device, y = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 15); await dev.queue.onSubmittedWorkDone(); await y(); } }, n); const s = await read(); log(`  the meter, drawn: lit ${s.lit} at ${s.at} · partner ${s.mate} (${s.mateSays})`); };
  const point = async w => { const s = await page.evaluate(p => { const c = document.getElementById('view'), r = c.getBoundingClientRect(), [x, y] = window.__cam.project(p, r.width, r.height, 1); return { x: r.left + x, y: r.top + y }; }, w); await page.mouse.move(s.x, s.y); await run(2); return s; };
  const tap = async k => { await page.keyboard.down(k); await run(3); await page.keyboard.up(k); await run(3); };
  const right = async () => { await page.mouse.down({ button: 'right' }); await run(4); await page.mouse.up({ button: 'right' }); await run(3); };
  /** step the page until another step is up (at most `secs` seconds of play) */
  const until = async (id, secs) => { for (let k = 0; k < secs; k++) { const s = await read(); if (s.id !== id) return s; await run(60); } return read(); };
  // (the key a cap names: the page writes the player's own binding on it)
  const capKey = c => c === 'Space' ? 'Space' : /^[A-Z]$/.test(c) ? `Key${c}` : c;
  const lineKey = async () => capKey((await read()).keys[0] || '');
  // (walked with the walk keys held, steered off where the page says he is. The view may be turned, so which key is which way is MEASURED: a short stride on D
  //  and one on S give the two directions the keys move him in, and each stride after is the pair of keys whose sum points most nearly at the mark)
  let AX = null;
  const stride = async (keys, n) => { for (const k of keys) await page.keyboard.down(k); await run(n); for (const k of keys) await page.keyboard.up(k); await run(1); };
  const axes = async () => { const a = await read(); await stride(['KeyD'], 10); const b = await read(); await stride(['KeyS'], 10); const c = await read();
    const n = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }; AX = { D: n([b.at[0] - a.at[0], b.at[1] - a.at[1]]), S: n([c.at[0] - b.at[0], c.at[1] - b.at[1]]) }; };
  const walk = async (to, secs = 30, near = 0.45) => { if (!AX) await axes();
    for (let k = 0; k < secs * 6; k++) { const s = await read(), dx = to[0] - s.at[0], dz = to[2] - s.at[1], d = Math.hypot(dx, dz); if (d < near) return true;
      const pd = (dx * AX.D[0] + dz * AX.D[1]) / d, ps = (dx * AX.S[0] + dz * AX.S[1]) / d, keys = [];
      if (Math.abs(pd) > 0.3) keys.push(pd > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(ps) > 0.3) keys.push(ps > 0 ? 'KeyS' : 'KeyW'); await stride(keys, Math.max(2, Math.min(30, Math.round(d * 12)))); }
    return false; };
  /** walk there by the game's own way round things (a hand sees the yard; a straight line does not), a leg at a time */
  const go = async (to, secs = 40, near = 0.45) => {
    const legs = await page.evaluate(to => { const g = window.__game, n = g.col.nav, c = g.player.char.pos, q = n.isBlocked(to[0], to[2]) ? n.nearestFreePoint(to[0], to[2]) ?? to : to;
      return (n.findPath([c[0], 0, c[2]], [q[0], 0, q[2]], 8000) ?? []).map(w => [w[0], 0, w[2]]); }, to);
    for (const w of legs.slice(0, -1)) await walk(w, secs / 2, 0.35);
    return walk(to, secs / 2, near); };
  /** once the order a step asks for is out, its line is what the partner is doing, drawn as a thing to watch: no key cap, never the ask again */
  const watched = async id => { const w = await page.evaluate(() => { const e = document.querySelector('#railprompt .line'); return { watch: !!e && e.classList.contains('watch'), line: e?.textContent ?? '', caps: e ? e.querySelectorAll('kbd').length : -1 }; });
    check(w.watch && w.caps === 0, `step '${id}': with the order out the line is a thing to watch, not the ask again`, `"${w.line}" · watch style ${w.watch} · key caps ${w.caps}`); };
  const low = async () => { if (!(await read()).crouch) await tap('KeyC'); };
  /** the place a stride behind a man, off the way he faces now */
  const backOf = (name, off = 0.85) => page.evaluate(([name, off]) => { const g = window.__game, h = g.guards.find(x => !x.unit && g.level.routes[x.routeI]?.name === name), c = h.char; return [c.pos[0] - Math.sin(c.bodyYaw) * off, 0, c.pos[2] - Math.cos(c.bodyYaw) * off]; }, [name, off]);
  const chest = p => [p[0], 1.2, p[2]];
  const ground = async () => { const s = await read(); return [s.at[0] + 1.3, 0, s.at[1] + 0.7]; };

  const url = `http://localhost:${PORT}/?levelFile=tut-pair.json&quiet&squad=1&paused&quality=${QUALITY}&mute&nocutboxes`;
  log(url);
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 0 });   // (the bundle has run: the boot's own promise is there to wait on)
  const row = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(3, 1 / 60, [], 'none'); const e = window.__scenarios.current()?.entry ?? window.__scenarios.current(); return e ? `${e.id} · ${e.group} ▸ ${e.title}` : null; });
  let R = await read(); log('booted', JSON.stringify(R));
  check(/^tut-pair · tutorial/.test(row || ''), "the page knows this URL as the Tutorial group's row", String(row));
  check(!R.fatal && R.rails && R.up && R.i === 0 && R.id === 'crouch' && !!R.mate && R.men === 4 && R.script, 'it boots on rails: one big line up, the partner beside him, four men, its script running',
    `fatal "${R.fatal}" · ${R.sum} · line "${R.line}" keys [${R.keys}] · small row "${R.row}" · partner at ${R.mate} · ${R.men} men · script ${R.script}`);
  check(R.keys.length === 1 && !/\[/.test(R.line), "the line's key is drawn as a key cap", `"${R.line}" keys [${R.keys}]`);
  log('picture', await shot('0-boot'));

  // ---- locked: what the first step has not taught does nothing under a real key (the squad's key, the word, the interaction key, night vision, a click)
  { const b = await read(); await point(chest(A));
    for (const k of ['KeyQ', 'KeyF', 'KeyE', 'KeyN']) await tap(k);
    await page.mouse.down(); await run(4); await page.mouse.up(); await run(4); await right();
    const a = await read();
    check(a.orders === b.orders && !a.menu && !a.nv && a.i === 0 && !a.roused, 'before anything is taught, the squad\'s key, the word, the interaction key, night vision and both buttons do nothing', `orders ${b.orders} → ${a.orders} · menu ${a.menu} · nv ${a.nv} · step ${a.i} · roused "${a.roused}" · ${a.sum}`); }

  const hand = {
    crouch: async () => { await tap(await lineKey()); },
    lead: async () => { await go(FIRST, 40); await settle(); await until('lead', 12); },
    mark: async () => { await settle(); await point(chest(A)); await tap(await lineKey()); await run(20); await watched('mark'); await until('mark', 60); },
    word: async () => { await tap(await lineKey()); await until('word', 20); },
    gap: async () => { await low(); await go(GAP, 40); await settle(); },
    far: async () => { await settle(); await point(chest(C)); await tap(await lineKey()); },
    near: async () => { await go(BEHIND, 30, 0.3); await until('near', 70); },
    hands: async () => { await walk(await backOf('near'), 10, 0.2); await point(chest(B)); await tap(await lineKey()); await until('hands', 15); },
    sleep: async () => { await right(); await until('sleep', 15); },
    past: async () => { await low(); await go(PAST, 60, 0.35); await settle(); await until('past', 30); },
    hold: async () => { await go(await backOf('gate', 1.6), 30, 0.3); await walk(await backOf('gate'), 10, 0.2); await point(chest(D)); await tap(await lineKey()); await until('hold', 10); },
    ask: async () => { for (let n = 0; n < 4 && (await read()).id === 'ask'; n++) { await tap(await lineKey()); await until('ask', 6); } },
    box: async () => { await settle(2); await point(BOX); await tap(await lineKey()); await run(20); await watched('box'); await until('box', 60); },
    drop: async () => { await right(); await until('drop', 15); },
    nv: async () => { await tap(await lineKey()); await run(20); },
    code: async () => { await go([DOOR[0] - 0.7, 0, DOOR[2] + 0.75], 80, 0.25); await point(DOOR); await tap(await lineKey()); await until('code', 15); },
    take: async () => { const k = await lineKey();
      await walk([DOOR[0], 0, DOOR[2] + 1.0], 15, 0.25);   // (square on to the doorway: a real-size door leaves a hand's width either side of him)
      for (let n = 0; n < 3; n++) { const open = await page.evaluate(() => !window.__game.doors.byName('office').isClosed()); if (open) break; await point(DOOR); await tap(k); await run(90); }
      await walk([DOOR[0], 0, DOOR[2] - 1.0], 15, 0.35); await go([TRUNK[0] - 0.25, 0, TRUNK[2]], 30, 0.25); await point(TRUNK); await tap(k); await until('take', 25);
      if ((await read()).id === 'take') log('  stuck at the trunk: ' + await page.evaluate(() => { const g = window.__game, d = g.doors.byName('office'); return `office closed ${d.isClosed()} locked ${d.locked} · rows ${g.nearby.map(r => `${r.kind}:${r.verb}`).join(' ') || 'none'}`; })); },
    out: async () => { await point(await ground()); await tap(await lineKey()); await walk([DOOR[0], 0, DOOR[2] - 1.0], 15, 0.35); await walk([DOOR[0], 0, DOOR[2] + 1.4], 15, 0.4); await go([GATE[0] - 1.0, 0, GATE[2]], 60, 0.35);
      for (let n = 0; n < 3; n++) { const open = await page.evaluate(() => !window.__game.doors.byName('gate_e').isClosed()); if (open) break; await point(GATE); await tap('KeyE'); await run(90); }
      await walk([GATE[0] + 0.5, 0, GATE[2]], 15, 0.25); await until('out', 10); },
  };

  for (let n = 0; n < steps.length && n < STEPS; n++) {
    const s = steps[n]; R = await read();
    if (R.id !== s.id) { check(false, `step ${n + 1} '${s.id}' is the one up`, `up: ${R.id} (${R.i}) · line "${R.line}"`); break; }
    // A CARD on the step (its `explain`, ui/railcard.ts): up with its words, and Enter closes it
    if (s.explain) {
      const card = () => page.evaluate(() => { const e = document.getElementById('railcard'); return { on: !!e && e.classList.contains('on'), h: e?.querySelector('h2')?.textContent || '', p: [...(e?.querySelectorAll('p') ?? [])].map(x => x.textContent).join(' / '), owed: !!window.__game.rails.card() }; });
      const Cd = await card(); log('picture', await shot(`${n + 1}-${s.id}-card`));
      await page.waitForTimeout(450); await page.keyboard.press('Enter'); await run(2); const Dd = await card();
      check(Cd.on && Cd.owed && !!Cd.p && !Dd.on, `step ${n + 1} '${s.id}' opens on a card: up with its words, and Enter closes it`, `"${Cd.h}": ${Cd.p} · Enter: card ${Dd.on ? 'up' : 'gone'}`);
    }
    const f = await shot(`${n + 1}-${s.id}`); R = await read();
    log(`step ${n + 1} '${s.id}': "${R.line}" keys [${R.keys}] t ${R.t} · at ${R.at} lit ${R.lit} · partner ${R.mate} (${R.mateSays}) · ${R.men} men · ${f}`);
    if (!hand[s.id]) { check(false, `step '${s.id}' has a hand`, 'no entry'); break; }
    await hand[s.id](s);
    for (let k = 0; k < 6; k++) { R = await read(); if (R.id !== s.id) break; await run(60); }
    R = await read();
    check(R.id !== s.id && !R.roused, `step ${n + 1} '${s.id}' is done by a hand's own keys, and nobody is roused`, `now ${R.done ? 'finished' : `'${R.id}'`} at t ${R.t} · at ${R.at} · partner ${R.mate} (${R.mateSays}) · ${R.men} men · roused "${R.roused}" · last order ${R.last} · ${R.sum}`);
    if (R.id === s.id) { log('stuck picture', await shot(`stuck-${s.id}`)); break; }
  }
  await run(180); R = await read();
  log('end', JSON.stringify(R)); log('picture', await shot('99-end'));
  check(R.done && (R.stage === 'done' || R.stage === 'exfil'), 'the mission ends with every step done', `finished ${R.done} · stage ${R.stage} · ${R.men} men up`);
  check(!errors.length, 'no page error and no console error', errors.length ? errors.slice(0, 6).join('\n    ') : 'none');
  console.log(`pictures: ${OUT}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
