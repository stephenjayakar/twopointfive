// THE PLAN MODE MISSION PLAYED ON THE REAL PAGE WITH REAL KEYS AND A REAL MOUSE: headless Chromium on the software WebGPU adapter (tools/qa/tut-page.cjs's
// recipe — SwiftShader, no GPU). What the headless lesson run cannot see: that the bundle boots the level and its script, that Shift + the command key
// reaches the game through the page's own listeners and the frame's gate, that a left drag is a box and a right click an order (and no browser menu),
// that a right drag gives a way to face, that Tab puts the mode away and the walk keys then walk him to each marked spot, and that each thing a line
// points at is on the picture when the line is up — with the view held near him (?plannear=0 is the page without that rule).
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
      fatal: document.getElementById('fatal')?.textContent || '', rails: g.rails.live, sum: g.rails.summary(), t: +g.time.toFixed(1), plan: P.up, look: P.look ? [+P.look[0].toFixed(1), +P.look[2].toFixed(1)] : null, crouch: g.player.crouch,
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
  check(!R.fatal && R.rails && R.up && R.i === 0 && R.keys.includes('Shift') && R.keys.length === 2, 'the page boots the mission on rails: one big line up, Shift and the command key on key caps', `fatal "${R.fatal}" · rails ${R.rails} · line "${R.line}" keys [${R.keys}]`);

  // ---- the hands
  const tap = async k => { await page.keyboard.down(k); await run(2); await page.keyboard.up(k); await run(2); };
  const until = async (want, secs) => { for (let k = 0; k < secs; k++) { const s = await read(); if (want(s)) return s; await run(60); } return read(); };
  /** Shift held over a tap of the command key (Q on the page's board) */
  const mode = async () => { await page.keyboard.down('ShiftLeft'); await run(2); await page.keyboard.down('KeyQ'); await run(2); await page.keyboard.up('KeyQ'); await run(2); await page.keyboard.up('ShiftLeft'); await run(4); };
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
  /** a left click on bare ground in the yard's middle */
  const ground = async () => { const p = [20, 0, 15]; await panTo(p); const q = await at(p); await page.mouse.move(q.x, q.y); await run(2); await page.mouse.down(); await run(1); await page.mouse.up(); await run(3); return (await read()).picked; };
  const chains = () => page.evaluate(() => window.__game.orders.plan.chains.map(c => c.phase));
  const rclick = async p => { await panTo(p); const s = await at(p); await page.mouse.move(s.x, s.y); await run(3); await page.mouse.down({ button: 'right' }); await run(1); await page.mouse.up({ button: 'right' }); await run(4); return s; };
  const rdrag = async (a, toward) => { const l = Math.hypot(toward[0] - a[0], toward[2] - a[2]), b = [a[0] + (toward[0] - a[0]) / l * 3, 0, a[2] + (toward[2] - a[2]) / l * 3]; await panTo(a, b);
    const s = await at(a), e = await at(b); await page.mouse.move(s.x, s.y); await run(3); await page.mouse.down({ button: 'right' }); await run(1);
    for (let k = 1; k <= 5; k++) { await page.mouse.move(s.x + (e.x - s.x) * k / 5, s.y + (e.y - s.y) * k / 5); await run(1); }
    await page.mouse.up({ button: 'right' }); await run(4); return Math.hypot(e.x - s.x, e.y - s.y); };
  const free = men => men.filter(m => m.stack === null).map(m => m.cs);
  const seen = async (s, what) => { if (!s.at) return; const q = await at(s.at); check(q.vis, `step '${s.id}': ${what} is on the picture when the hand acts`, `at ${Math.round(q.x)}, ${Math.round(q.y)} of 1280 x 720`); };
  let pairA = [];
  /** the mode up, if a walk left it down (a hand reads the line that says how, and does it) */
  const modeUp = async () => { if (!(await read()).plan) await mode(); };
  /** …and the pair pressed by a hand that has not let go of its walk key yet (rails.ts RAILS.planWalk; URL_ADD='&planwalk=0' = the page without that rule, where this does nothing) */
  const modeWalking = async () => { await page.keyboard.down('KeyS'); await run(8); await page.keyboard.down('ShiftLeft'); await run(2); await page.keyboard.down('KeyQ'); await run(2); await page.keyboard.up('KeyQ'); await run(2); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyS'); await run(4); };
  /** THE WALK TO A MARKED SPOT: Tab puts the mode away (in it the walk keys are the view's), then the walk keys along the game's own path to the spot — which
   *  key is which way is the picture's (the camera's across and up), two keys together for a slant, as a hand does */
  const walkTo = async (s, what) => {
    let r = await read(); const was = r.plan; if (r.plan) { await tap('Tab'); await run(80); r = await read(); }
    if (was) check(!r.plan && !r.crouch, `step '${s.id}': Tab on the real keyboard puts plan mode away and he stands`, `mode ${r.plan} · on a knee ${r.crouch}`);
    // (…and that press was the back key's alone: the page's objectives card, which Tab opens when there is nothing to back out of, did not come up on it;
    //  with the mode down the line stops naming the key, so nobody is sent to press it a second time)
    if (was) { const tc = await page.evaluate(() => { const e = document.getElementById('tabcard'); return !!e && e.classList.contains('on'); });
      check(!tc && !r.keys.includes('Tab') && !/plan mode/.test(r.line) && /walk/i.test(r.line), `step '${s.id}': the press that closed plan mode did not open the objectives card, and the line now only says where to walk`, `objectives card ${tc ? 'UP' : 'not up'} · the line "${r.line}" · keys ${r.keys.join(' ') || 'none'}`); }
    // (the view has come back to him: the ring he is to walk to is on the picture, or the page has pinned the step's mark to the picture's edge on that side
    //  with the metres to it — ui/overlay.ts, the objective's mark — so the line never points at nothing)
    { const q = await at(s.at), m = await page.evaluate(() => { const e = document.querySelector('.objmark'); return e ? { on: getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.2, edge: e.classList.contains('edge'), x: Math.round(parseFloat(e.style.left)), y: Math.round(parseFloat(e.style.top)), text: e.textContent } : null; });
      const inside = q.x > 36 && q.y > 36 && q.x < 1280 - 36 && q.y < 720 - 36;   // (the overlay pins its mark once the place is past a 36 px inset of the view)
      check(!!m && m.on && m.edge === !inside, `step '${s.id}': with plan mode closed, ${what}'s ring is on the picture, or its mark is pinned to the picture's edge on that side`, `the ring at ${Math.round(q.x)}, ${Math.round(q.y)} of 1280 x 720 (${inside ? 'on the picture' : 'off it, or at its rim'}) · the mark ${m ? `${m.on ? 'shown' : 'NOT shown'} at ${m.x}, ${m.y}${m.edge ? ', pinned to the edge' : ''} "${m.text}"` : 'missing'}`); }
    const goal = [s.at[0], 0, s.at[2]], from = r.sam, path = await page.evaluate(([a, b]) => window.__game.col.nav.findPath(a, b, 8000) ?? [], [[from[0], 0, from[1]], goal]); path.push(goal);
    let stuck = false;
    for (let n = 0; n < path.length && !stuck; n++) { const wp = path[n], near = n === path.length - 1 ? 0.35 : 0.55; let best = 1e9, since = 0;
      for (let k = 0; k < 500; k++) {
        const d = await page.evaluate(wp => { const c = window.__game.player.char.pos, B = window.__cam.planarBasis(), dx = wp[0] - c[0], dz = wp[2] - c[2], l = Math.hypot(dx, dz) || 1; return { l, f: (dx * B.fwd[0] + dz * B.fwd[2]) / l, r: (dx * B.right[0] + dz * B.right[2]) / l }; }, wp);
        if (d.l < near) break; if (d.l < best - 0.05) { best = d.l; since = 0; } else if (++since > 40) { stuck = true; break; }
        const ks = [d.f > 0.38 ? 'KeyW' : d.f < -0.38 ? 'KeyS' : '', d.r > 0.38 ? 'KeyD' : d.r < -0.38 ? 'KeyA' : ''].filter(Boolean);
        for (const c of ks) await page.keyboard.down(c); await run(3); for (const c of ks) await page.keyboard.up(c); } }
    await run(20); const a = await read(), left = Math.hypot(a.sam[0] - goal[0], a.sam[1] - goal[2]);
    check(!stuck && left < 0.6 && !a.plan, `step '${s.id}': the walk keys on the real keyboard walk him to ${what}`, `from (${from}) to (${a.sam}), ${left.toFixed(2)} m from the mark's middle${stuck ? ' · STUCK on the way' : ''} · mode ${a.plan}`); };

  // ---- locked: before the mode, a hand on the keys and the mouse does nothing (his feet come with the first walk step)
  { const b = await read(); await page.mouse.move(700, 330);
    for (const k of ['KeyQ', 'KeyF', 'KeyW', 'KeyD', 'KeyX']) { await page.keyboard.down(k); await run(6); await page.keyboard.up(k); await run(2); }
    await page.mouse.down(); await run(3); await page.mouse.up(); await run(3); await page.mouse.down({ button: 'right' }); await run(3); await page.mouse.up({ button: 'right' }); await run(3);
    const a = await read();
    check(a.orders === b.orders && a.shots === b.shots && Math.hypot(a.sam[0] - b.sam[0], a.sam[1] - b.sam[1]) < 0.05 && !a.plan && a.i === 0, 'before the mode, the command key alone, the word, the walk keys and both buttons do nothing',
      `orders ${b.orders} → ${a.orders} · shots ${b.shots} → ${a.shots} · he moved ${Math.hypot(a.sam[0] - b.sam[0], a.sam[1] - b.sam[1]).toFixed(2)} m · mode ${a.plan} · ${a.sum}`); }

  const hand = {
    mode: async () => { await mode(); const s = await read(); check(s.plan && s.crouch, 'Shift + Q on the real keyboard puts plan mode up and him on his knee', `mode ${s.plan} · on a knee ${s.crouch}`); },
    view: async s => { await viewTo([17.5, 0, 9.5], 'view'); },
    send: async s => { const b = await read(); await seen(s, 'the wall\'s mark'); await rclick(s.at); const a = await read();
      check(a.orders === b.orders + 1 && a.chains === 1, 'a right click on the real mouse is one order to all four (and no browser menu took it)', `orders ${b.orders} → ${a.orders} (${a.last}) · chains ${a.chains}`);
      await until(x => x.id !== 'send', 40); await run(90); },
    up1: async s => { const r = await read(); check(r.keys.includes('Tab'), "the first walk's line names the key that closes plan mode on a key cap", `"${r.line}" keys [${r.keys}]`); await walkTo(s, 'the spot behind his squad'); },
    pick: async s => { const d = await read(); await modeWalking(); const w = await read();
      check(w.plan && w.crouch, 'at the end of the walk, Shift + Q on the real keyboard with a walk key still down puts plan mode up and him on his knee', `mode ${w.plan} · on a knee ${w.crouch}`);
      await modeUp(); const u = await read();
      check(!d.plan && /plan mode again/.test(d.line) && d.keys.includes('Shift') && u.plan && u.line === s.line, 'after a walk the mode is down on a step done in it, and the line is what puts it up again; up, the step\'s own line is back', `down: "${d.line}" keys [${d.keys}] · up: "${u.line}"`);
      const got = await box(await twoOf([16, 0, 12])); check(got.length === 2, 'a left drag on the real mouse is a box that picks two men', `picked ${got.join(', ') || 'nobody'}`); },
    door1: async s => { await panTo(s.at); await seen(s, 'the door\'s mark'); await rclick(s.at); },
    pick2: async () => { const s = await read(); await box(free(s.men)); },
    door2: async s => { await panTo(s.at); await seen(s, 'the side door\'s mark'); await rclick(s.at); await until(x => x.id !== 'door2', 60); },
    all: async () => { const got = await ground(); check(got.length === 4, 'a left click on bare ground is everyone again', `picked ${got.join(', ')}`); },
    word: async () => { const b = await chains(); await tap('KeyF'); await run(6); const a = await chains();
      check(b.length === 2 && b.every(x => x === 'wait') && a.every(x => x !== 'wait'), 'the line asks for the word when both stacks wait on it, and ONE press of F sends both', `chains before ${b.join(', ')} · after ${a.join(', ')}`);
      await fight(x => x.id !== 'word', 40); await run(90); },
    up2: async s => { await walkTo(s, 'the spot beside the hall'); },
    hall: async s => { await modeUp(); await viewTo([28.0, 0, 15.5], 'hall'); },
    front: async s => { await box(await twoOf([26, 0, 12])); await panTo(s.at); await seen(s, 'the front door\'s mark'); await rclick(s.at); },
    back: async s => { const r = await read(); await box(free(r.men)); await panTo(s.at); await seen(s, 'the back door\'s mark'); await rclick(s.at); await until(x => x.id !== 'back', 70); },
    all2: async () => { await ground(); },
    word2: async () => { const c = await chains(), b = await read(); await tap('KeyF'); await run(6); const c2 = await chains(); const a = await fight(x => x.id !== 'word2', 40);
      check(c.length === 2 && c.every(x => x === 'wait') && c2.every(x => x !== 'wait'), 'the hall: one press of F sends both stacks', `chains before ${c.join(', ')} · after ${c2.join(', ')} · word at t ${b.t}, the hall taken by t ${a.t}`); await run(90); },
    up3: async s => { await walkTo(s, 'the spot in the hall'); },
    gates: async s => { await modeUp(); await viewTo([27.5, 0, 11.5], 'gates'); },
    faceA: async s => { pairA = await twoOf(s.at); await box(pairA); await seen(s, 'the bags\' arrow'); const d = await rdrag(s.at, s.toward); log(`  right drag: ${d.toFixed(0)} px on the picture`); await until(x => x.id !== 'faceA', 60); },
    faceB: async s => { const r = await read(); await box(r.men.filter(m => !pairA.includes(m.cs)).map(m => m.cs)); await seen(s, 'the barrier\'s arrow'); await rdrag(s.at, s.toward); await until(x => x.id !== 'faceB', 60); },
    hold: async () => { await fight(x => x.id !== 'hold', 120); await run(60); },
    'back-in': async s => { const r = await read(); if (!r.plan) await mode(); await page.mouse.move(40, 690); await run(2); await page.mouse.down(); await run(1); await page.mouse.up(); await run(3);   // (a click on nothing: everyone again)
      await rclick([r.sam[0], 1.0, r.sam[1]]); await until(x => x.done, 30); },
  };

  for (let n = 0; n < steps.length && n < STEPS; n++) {
    const s = steps[n]; R = await read();
    if (R.id !== s.id) { check(false, `step ${n + 1} '${s.id}' is the one up`, `up: ${R.id} (${R.i}) · line "${R.line}"`); break; }
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
  // (the mode put down: he stands again and the view comes back to him)
  if (R.plan) { await mode(); await run(90); const E = await read(); check(!E.plan && !E.crouch, 'Shift + Q again puts the mode down and he stands', `mode ${E.plan} · on a knee ${E.crouch}`); }
  check(!errors.length, 'no page error and no console error', errors.length ? errors.slice(0, 6).join('\n    ') : 'none');
  console.log(`pictures: ${OUT}`);
  if (!held) await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
