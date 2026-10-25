// THE LEDGER'S STORE ON THE REAL PAGE, WITH REAL KEYS: the stretch of the tutorial's stealth mission that teaches the rifle's launcher (tools/levels/tut-quiet.ts,
// THE SPONGE ROUND) — headless Chromium on the software WebGPU adapter (tools/qa/tut-page.cjs's recipe: the page is ?paused and stepped by __runFrames with
// nothing drawn, every input a DOM event from Playwright's keyboard and mouse).
// What the headless lesson run (tools/qa/lessons/tut-quiet.ts) cannot see: that the bundle boots the level with its own card (the launcher up on the grenade),
// that each line is up with the player's own key on a key cap, that the interaction key still works the back door from inside the store (open, then shut:
// the first build took that key there), that the card comes up with the rifle in his hands and closes, that the gun's setup takes the
// swap from two real presses of the rifle's key, that neither button does anything to the man until the sponge round is on (both tried from the doorway's
// line, where there IS a way to him), that the right button then fires it from the mark, and that the hands' key is drawn as the board has it.
// STAGED, NOT PLAYED, up to the store's doorway: the lesson is put on the line that sends him in, the court's man is marked down and the player stood a stride
// inside the back door, then in the store's dark corner (the lane, the whistle and the grab are the lesson run's and are not walked here: a boot alone is five minutes on this adapter). Inside
// the store he is stood on each spot too (the corner, the doorway's line): what is asked of the page is its keys and its buttons, not his feet.
//   PORT=5247 node tools/qa/tut-quiet-page.cjs        (a dev server on that port: PORT=5247 bun run tools/serve.ts)
//   env: QUALITY (default verylow) · OUT (a folder for the pictures; default a temp folder) · SHOTS=0 (no pictures: each is about a minute here)
// exit 0 = every line passes · 1 = a FAIL or a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'tut-quiet-page-'));
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false;
const same = (drawn, written) => drawn.replace(/\s+/g, ' ').trim() === written.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();   // (the line as drawn carries its key on a cap, not in brackets)
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', 'tut-quiet.json'), 'utf8')), steps = data.scenarios.lesson.steps, step = id => steps.find(s => s.id === id);
  const INSIDE = step('nook').at, NOOK = step('corner').at, SHOT = step('behind').at, issue = data.scenarios.issue.members['0'];
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); const errors = [];
  page.setDefaultTimeout(0);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  const run = n => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);   // (stepped, never drawn: a drawn frame is half a minute here)
  const read = () => page.evaluate(() => { const g = window.__game, el = document.getElementById('railprompt'), P = g.player, rf = P.rifle, eq = document.getElementById('equip'), card = document.getElementById('railcard');
    const hall = g.guards.find(x => !x.unit && x.route?.name === 'hall'), box = g.guards.find(x => !x.unit && x.route?.name === 'table');
    return { i: g.lesson.i, id: g.lesson.step?.id ?? null, line: el?.querySelector('.line')?.textContent ?? '', keys: [...(el?.querySelectorAll('kbd') ?? [])].map(k => k.textContent), up: !!el && getComputedStyle(el).display !== 'none',
      fatal: document.getElementById('fatal')?.textContent || '', rails: g.rails.live, slot: P.slot, away: !!P.holstered, setup: P.setup ? P.setup.gun : '', load: rf.attachment, shells: rf.shells, rings: rf.rings, back: (d => d ? +d.angle.toFixed(3) : null)(g.doors.list.find(d => d.def.name === 'back')), ring: !!P.sel?.open, hints: g.nearby.filter(r => r.kind === 'guard').map(r => `${r.line2 ?? ''}`).join(' | '),
      strip: (eq?.textContent ?? '').replace(/\s+/g, ' ').trim(), words: eq?.querySelector('.hb-st')?.textContent ?? '', rows: [...(eq?.querySelectorAll('.hp kbd:not(.x)') ?? [])].map(k => k.textContent),
      card: { on: !!card && card.classList.contains('on'), h: card?.querySelector('h2')?.textContent ?? '', p: [...(card?.querySelectorAll('p') ?? [])].map(x => x.textContent).join(' / ') },
      hall: hall ? { state: hall.state, how: hall.down?.how ?? hall.downHow ?? '', at: [+hall.char.pos[0].toFixed(2), +hall.char.pos[2].toFixed(2)], aw: +(hall.awareness ?? 0).toFixed(2) } : null, other: box ? box.state : '',
      trips: (g.devices?.lasers ?? []).reduce((n, l) => n + l.trips, 0), ko: g.chronicle.events.filter(r => r.kind === 'ko').map(r => r.data?.method).join(','), at: [+P.char.pos[0].toFixed(2), +P.char.pos[2].toFixed(2)], holding: !!P.holding, t: +g.time.toFixed(1) }; });
  // (a picture, as tut-page.cjs takes one: the frame is drawn and read back in the page and stood under the HUD as a still)
  const shot = async tag => { if (process.env.SHOTS === '0') return '(no picture asked)'; const f = path.join(OUT, `tut-quiet-${tag}.png`);
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
  const point = async w => { const s = await page.evaluate(p => { const c = document.getElementById('view'), r = c.getBoundingClientRect(), [x, y] = window.__cam.project(p, r.width, r.height, 1); return { x: r.left + x, y: r.top + y }; }, w); await page.mouse.move(s.x, s.y); await run(2); return s; };
  const head = () => page.evaluate(() => { const g = window.__game, h = g.guards.find(x => !x.unit && x.route?.name === 'hall'); return h.char.bones?.head ? [...h.char.bones.head] : [h.char.pos[0], 1.6, h.char.pos[2]]; });
  const right = async frames => { await page.mouse.down({ button: 'right' }); await run(frames); await page.mouse.up({ button: 'right' }); await run(3); };
  const key = async (k, frames = 3) => { await page.keyboard.press(k); await run(frames); };
  // (the physical key the board has put a game code on — host/keymap.ts: the first of `codes` that the board reads as one of `games`)
  const keyFor = (codes, games) => page.evaluate(([codes, games]) => { const K = window.__keys; return K ? codes.find(c => games.includes(K.gameCode(c))) ?? null : null; }, [codes, games]);
  const s = r => `step '${r.id}' · "${r.line}" [${r.keys}] · ${r.slot}${r.away ? ' (away)' : ''} · launcher ${r.load}, ${r.shells} grenade(s), ${r.rings} sponge round(s) · setup '${r.setup}'`;

  const url = `http://localhost:${PORT}/?levelFile=tut-quiet.json&quiet&paused&quality=${QUALITY}&mute&nocutboxes`;
  log(url);
  await page.goto(url, { timeout: 600000 });
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(3, 1 / 60, [], 'none'); });
  let R = await read();
  log('booted', s(R));
  check(!R.fatal && R.rails && R.up && R.i === 0 && R.load === issue.loaded && R.shells === issue.shells && R.rings === issue.rings, 'the page boots the mission on rails with its own card: the launcher is up on the grenade, with the grenade and the sponge rounds the level names',
    `fatal "${R.fatal}" · rails ${R.rails} · ${s(R)} · the level's card: ${JSON.stringify(issue)}`);

  // ---- staged to the store (see the head)
  await page.evaluate(nook => { const g = window.__game, L = g.level.scenarios.lesson, court = g.guards.find(x => !x.unit && x.route?.name === 'court');
    for (const d of g.doors.list) d.locked = false;
    if (court) { court.script = null; court.state = 'dead'; }
    g.lesson.i = L.steps.findIndex(x => x.id === 'nook'); g.teleportPlayer([nook[0], 0, nook[2]]); if (!g.player.crouch) g.player.crouch = true; window.__runFrames(12, 1 / 60, [], 'none'); }, INSIDE);
  await run(150);   // (the view rides to him: he was put here, he did not walk)
  const stand = p => page.evaluate(p => { const g = window.__game; g.teleportPlayer([p[0], 0, p[2]]); g.player.crouch = true; window.__runFrames(6, 1 / 60, [], 'none'); }, p);
  const I0 = await read();
  log('picture', await shot('0-inside'));
  check(I0.id === 'corner' && same(I0.line, step('corner').line) && I0.keys.length === 0 && I0.hall?.state !== 'dead', 'a stride inside the back door the line names the laser behind the man and sends him to the dark', `${s(I0)} · the hall's man ${JSON.stringify(I0.hall)} · he stands at ${I0.at}`);
  // the interaction key is his on that line, his hands empty: a tap opens the back door from inside and a second tap shuts it behind him. Held on open
  // floor it puts no ring up (the whistle is not his in the store: it would bring the man round to him)
  const useKey = await keyFor(['KeyE', 'Space', 'KeyF'], ['Space']);
  if (useKey) await key(useKey, 150); const I1 = await read(); if (useKey) await key(useKey, 150); const I2 = await read();
  check(!!useKey && I1.back !== I0.back && Math.abs(I2.back - I0.back) < Math.abs(I1.back - I0.back) - 0.3 && I2.id === 'corner' && I2.hall?.state === I0.hall?.state, 'the interaction key works the back door from inside on that line: a tap opens the leaf and a second tap shuts it behind him',
    `the key pressed: ${useKey} · the leaf ${I0.back} → ${I1.back} → ${I2.back} · ${s(I2)} · the hall's man ${JSON.stringify(I2.hall)}`);
  await stand(NOOK); await run(40);
  if (useKey) { await page.keyboard.down(useKey); await run(40); } const K0 = await read(); if (useKey) { await page.keyboard.up(useKey); await run(6); } if (K0.ring) await key('Escape', 6);
  check(!!useKey && !K0.ring, 'the interaction key held on open floor in the store puts no ring up: there is no whistle to pick here', `ring up: ${K0.ring} · ${s(K0)}`);
  R = await read();
  log('picture', await shot('1-rifle-line'));
  check(R.id === 'rifle' && R.keys.join() === '2' && same(R.line, step('rifle').line) && R.hall?.state !== 'dead', 'in the store\'s dark corner the line names the rifle\'s key on a key cap',
    `${s(R)} · the hall's man ${JSON.stringify(R.hall)} · he stands at ${R.at}`);
  // neither button is his yet: tried from the doorway's line, 2.6 m behind him, where a held left click would stalk him and the launcher has a line
  await stand(SHOT); const at0 = (await read()).at; await point(await head()); await page.mouse.down(); await run(90); await page.mouse.up(); await run(3); await right(30); const L0 = await read();
  const moved = Math.hypot(L0.at[0] - at0[0], L0.at[1] - at0[1]);
  check(L0.rings === R.rings && L0.shells === R.shells && L0.hall?.state === R.hall?.state && L0.id === 'rifle' && moved < 0.1 && !L0.holding && L0.trips === R.trips && !/LMB|sneak/i.test(L0.hints), 'from the doorway\'s line, hands empty: the left button held on the man stalks nobody, no row offers that click, and the right button does nothing',
    `${s(L0)} · moved ${moved.toFixed(2)} m · holding ${L0.holding} · beams broken ${L0.trips - R.trips} · the man's rows say: "${L0.hints || 'nothing'}" · him ${JSON.stringify(L0.hall)}`);
  // …and put right behind him on that line (0.6 m, low: under the beam), where the row that grabs is his: its line names no mouse button, because both are shut
  const BEHIND = await page.evaluate(() => { const H = window.__game.guards.find(x => !x.unit && x.route?.name === 'hall'); return H ? [H.char.pos[0] - Math.sin(H.char.bodyYaw) * 0.6, 0, H.char.pos[2] - Math.cos(H.char.bodyYaw) * 0.6] : null; });
  if (BEHIND) { await stand(BEHIND); await point(await head()); await run(12); } const B0 = await read();
  check(!!BEHIND && /grab him/.test(B0.hints) && !/LMB|RMB/.test(B0.hints) && !B0.holding && B0.trips === R.trips && B0.hall?.state === R.hall?.state, 'right behind him on that line the row that grabs is his and its line names no mouse button',
    `the man's rows say: "${B0.hints || 'nothing'}" · holding ${B0.holding} · beams broken ${B0.trips - R.trips} · ${s(B0)} · him ${JSON.stringify(B0.hall)}`);
  await stand(NOOK);

  // ---- the rifle, and the card
  await key('2', 120); let C = await read();
  log('picture', await shot('2-card'));
  check(C.id === 'load' && C.slot === 'rifle' && !C.away && C.card.on && C.card.h.toLowerCase() === step('load').explain.title.toLowerCase() && C.load === 'he40', 'the rifle\'s key takes the rifle out and the launcher\'s card comes up over it, the grenade still loaded',
    `${s(C)}\n    the card: "${C.card.h}": ${C.card.p}\n    the kit strip under it: "${C.strip}"`);
  await page.waitForTimeout(450); await page.keyboard.press('Enter'); await run(6); let D = await read();
  check(!D.card.on && D.id === 'load' && same(D.line, step('load').setupLine) && D.keys.join() === '2', 'Enter closes the card and the line under it asks for the swap by the rifle\'s key', s(D));
  // the right button is still shut: nothing leaves the tube before the sponge round is on it
  await stand(SHOT); await point(await head()); await right(30); const L1 = await read();
  check(L1.shells === D.shells && L1.rings === D.rings && L1.hall?.state === D.hall?.state && L1.id === 'load', 'with the grenade loaded the right button fires nothing, held on him from the doorway\'s line: the swap comes first', `${s(L1)} · him ${JSON.stringify(L1.hall)}`);
  await stand(NOOK);

  // ---- the swap: the rifle's key again is its setup, and the same key is the load's row
  await key('2'); const S1 = await read();
  log('picture', await shot('3-setup'));
  await key('2', 6); const S2 = await read();
  check(S1.setup === 'rifle' && S1.rows.includes('2') && S1.load === 'he40' && S2.load === 'ring' && S2.setup === '' && S2.id === 'behind' && same(S2.line, step('behind').line) && S2.strip !== D.strip, 'the rifle\'s key again opens its setup with the load on row 2, and the same key puts the sponge round on: the kit strip says so and the next line sends him out of the corner',
    `2: ${s(S1)} rows [${S1.rows}]\n    2 again: ${s(S2)}\n    the kit strip before: "${D.strip}"\n    the kit strip after:  "${S2.strip}"`);

  // ---- the shot: the right button held on him and let go
  // on the mark the shot's own line comes up, and the right button is his
  await stand(SHOT); await run(20); const M = await read();
  check(M.id === 'sponge' && same(M.line, step('sponge').line) && M.rings === S2.rings, 'on the mark in the doorway\'s line the shot\'s own line comes up', `${s(M)} at ${M.at}`);
  const trips0 = S2.trips; await point(await head()); log('picture', await shot('4-aim'));
  await page.mouse.down({ button: 'right' }); await run(36); await point(await head()); await page.mouse.up({ button: 'right' }); let H = await read();
  for (let n = 0; n < 30 && H.hall?.state !== 'dead'; n++) { await run(10); H = await read(); }
  log('picture', await shot('5-down'));
  check(H.hall?.state === 'dead' && H.rings === S2.rings - 1 && H.shells === S2.shells && /ring/.test(H.ko) && H.trips === trips0 && H.id === 'sling' && H.other === 'patrol', 'the right button held on him and let go puts him out with one sponge round: no beam broken, the other man none the wiser, and the next line is up',
    `${s(H)} · him ${JSON.stringify(H.hall)} · out cold by: ${H.ko || 'nothing'} · beams broken ${H.trips - trips0} · the other man: ${H.other}`);

  // ---- the hands' key, as the board has it
  const handsCode = await keyFor(['Backquote', 'KeyE', 'Digit0'], ['Digit0', 'KeyE']), hands = handsCode ? { code: handsCode, cap: await page.evaluate(() => window.__keys.keyCap('E')) } : null;
  const label = c => c === 'Backquote' ? '`' : c.replace(/^Key|^Digit/, ''), cap = H.keys.join(); if (hands) await key(hands.code, 60); const E = await read();
  log('picture', await shot('6-under'));
  check(!!hands && E.away && E.id === 'under' && cap === hands.cap && cap.toLowerCase() === label(hands.code).toLowerCase(), 'the line names the hands\' key on a key cap as this board has it, and the key with that cap puts the rifle away',
    `the cap drawn: [${cap}] · the board's cap for it: [${hands?.cap}] · the physical key pressed: ${hands?.code} · ${s(E)}`);
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(failed ? '=== tut-quiet-page: FAILED ===' : '=== tut-quiet-page: ALL PASS ===');
  console.log(`pictures: ${OUT}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
