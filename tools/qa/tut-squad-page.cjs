// THE TUTORIAL'S SQUAD MISSION ON THE REAL PAGE: boot the row 'tut-squad' in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe —
// SwiftShader, no GPU) and play its first five steps with real key and mouse events: the squad's key on two doors, the walk into the store, then the
// authored checkpoint 'the street' is loaded and the step it was saved at must come back with the level's script running again.
//   PORT=5231 node tools/qa/tut-squad-page.cjs [shot-dir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = every step went by on the page's own input, the checkpoint came back on its step, no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', SHOTS = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const HUT = [10.85, 1, 11.0], STORE = [10.85, 1, 16.5], STORE_IN = [10.6, 0, 18.8], STREET = [8.6, 0, 13.6];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; let failed = false;
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  const say = (ok, what) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  page.setDefaultTimeout(0);
  // (the row's own page, as the page's list starts it — `__scenarios.pick('tut-squad')` is a load of this URL with the visit's flags kept)
  await page.goto(`http://localhost:${PORT}/?levelFile=tut-squad.json&roomclear=1&squad4&paused&quality=${QUALITY}&mute`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 0 });   // (the bundle has run: the boot's own promise is there to wait on)
  const row = await page.evaluate(async () => { await window.__ready; const e = window.__scenarios.current()?.entry ?? window.__scenarios.current(); return e && e.id === 'tut-squad' ? `${e.group} ▸ ${e.title}` : null; });
  say(!!row, `the page knows this URL as the row 'tut-squad': ${row}`);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(30, 1 / 60, [], false); });
  // (the page's own state, read back: the step that is up, the row it draws, where Sam is, who is on the floor)
  const state = () => page.evaluate(() => { const g = window.__game, L = window.__lesson; return { i: L.i, step: L.step?.id ?? null, row: document.body.innerText.split('\n').find(l => /▸/.test(l) && /training/.test(l)) ?? '', text: g.objectiveText(),
    at: [+g.player.char.pos[0].toFixed(1), +g.player.char.pos[2].toFixed(1)], down: !!g.player.down, mates: g.guards.filter(x => x.team === 'operative' && x.state !== 'dead').length, men: g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead').length,
    script: !!g.director.running, t: +g.time.toFixed(1), fatal: document.getElementById('fatal')?.textContent || '' }; });
  const frames = (n, keys = []) => page.evaluate(([n, keys]) => window.__runFrames(n, 1 / 60, keys, false), [n, keys]);
  const aim = w => page.evaluate(w => { const v = document.getElementById('view'), [x, y] = window.__cam.project(w, v.clientWidth, v.clientHeight); window.__mouse(x, y); window.__runFrames(3, 1 / 60, [], false); }, w);
  const tap = async code => { await page.keyboard.down(code); await frames(3); await page.keyboard.up(code); await frames(3); };
  // (the squad's command: on Q as the page ships it; B where a visit keeps the build's own letter)
  let CMD = ''; const cmd = async () => { if (CMD) return tap(CMD); const n = await page.evaluate(() => window.__orders.log.length); await tap('KeyQ'); await frames(20); CMD = await page.evaluate(() => window.__orders.log.length) > n ? 'KeyQ' : 'KeyB'; if (CMD === 'KeyB') await tap(CMD); console.log(`  the squad's command key on this page: ${CMD.slice(3)}`); };
  const until = async (want, secs) => { for (let k = 0; k < secs / 1.5; k++) { const s = await state(); if (want(s)) return s; await frames(90); } return state(); };   // (a call of frames draws ONE frame, its last: seconds each on the software adapter)
  // (walked with the walk keys held, steered off where the page says he is. The view is turned, so which key is which way is MEASURED: a short stride on D and
  //  one on S give the two directions the keys move him in, and each stride after is the pair of keys whose sum points most nearly at the mark)
  let AX = null;
  const axes = async () => { const a = await state(); await frames(10, ['KeyD']); const b = await state(); await frames(10, ['KeyS']); const c = await state();
    const n = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }; AX = { D: n([b.at[0] - a.at[0], b.at[1] - a.at[1]]), S: n([c.at[0] - b.at[0], c.at[1] - b.at[1]]) }; };
  const walk = async (to, secs) => {
    if (!AX) await axes();
    for (let k = 0; k < secs * 4; k++) { const s = await state(), dx = to[0] - s.at[0], dz = to[2] - s.at[1], d = Math.hypot(dx, dz); if (d < 0.7) return true;
      const pd = (dx * AX.D[0] + dz * AX.D[1]) / d, ps = (dx * AX.S[0] + dz * AX.S[1]) / d, keys = [];
      if (Math.abs(pd) > 0.3) keys.push(pd > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(ps) > 0.3) keys.push(ps > 0 ? 'KeyS' : 'KeyW'); await frames(Math.max(4, Math.min(40, Math.round(d * 14))), keys); }
    return false; };
  let s = await state();
  say(!s.fatal && s.step === 'stack-hut' && s.mates === 4 && s.men === 11 && s.script, `it opens on its first step with the four, eleven defenders and its script running: step '${s.step}', ${s.mates} teammates, ${s.men} defenders, script ${s.script}${s.fatal ? ' · FATAL ' + s.fatal : ''}`);
  console.log(`  the line as the page writes it: "${s.text}"`); await shot('1-start');
  // 1 and 2: the squad's key on the guard hut door, twice (the key the PAGE has it on: Q)
  await walk(STREET, 20); await aim(HUT); await cmd(); s = await until(x => x.i >= 1, 60); say(s.i >= 1, `the squad's key on the hut door: they stack (step ${s.i + 1} '${s.step}' at ${s.t} s)`); await shot('2-stacked');
  await aim(HUT); await cmd(); s = await until(x => x.i >= 2, 60); if (s.i < 2) { await tap('KeyF'); s = await until(x => x.i >= 2, 40); } say(s.i >= 2 && s.men <= 10, `the key again: they go in and the hut is taken (${s.men} defenders left at ${s.t} s)`); await shot('3-hut');
  // 3 and 4: the store, and in behind them
  await aim(STORE); await cmd(); s = await until(x => x.i >= 3, 80); say(s.i >= 3, `the key on the store door: they stack (step ${s.i + 1} '${s.step}' at ${s.t} s)`);
  await aim(STORE); await cmd(); s = await until(x => x.men <= 8, 60); if (s.men > 8) { await tap('KeyF'); s = await until(x => x.men <= 8, 40); } say(s.men <= 8, `the key again: the store is taken (${s.men} defenders left at ${s.t} s)`);
  const inside = await walk(STORE_IN, 40); s = await until(x => x.i >= 4, 10); say(inside && s.i >= 4, `walked in behind them: step ${s.i + 1} '${s.step}' is up (Sam at ${s.at})`); await shot('4-store');
  // the authored checkpoint: saved as step 5 came up, and a load of it brings that step back with the script started over
  const saved = await page.evaluate(() => window.__save.slots().map(x => ({ key: x.key, label: x.label })));
  const mine = saved.find(x => /the street/.test(x.label || ''));
  say(!!mine, `the checkpoint 'the street' was saved as its step came up (slots: ${saved.map(x => x.label).join(' · ') || 'none'})`);
  if (mine) {
    await walk(STREET, 20); await frames(120);
    const why = await page.evaluate(k => window.__save.load(k), mine.key); await frames(30); s = await state();
    say(!why && s.step === 'stack-shop' && s.script && s.men === 8, `loaded: back on step '${s.step}' with ${s.men} defenders and the script running again${why ? ' · refused: ' + why : ''}`); await shot('5-loaded');
  }
  say(!errors.length, `no page error${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''}`);
  await browser.close();
  console.log(failed ? '=== tut-squad-page: FAILED ===' : '=== tut-squad-page: ALL PASS (software adapter: never seen on a GPU) ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
