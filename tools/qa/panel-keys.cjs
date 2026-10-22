// PANEL KEYS: the debugger's key, pressed for real. The page is booted in headless Chromium on the software WebGPU adapter (see page-look.cjs for what that
// adapter can and cannot do) and REAL key events are sent through the browser, so the whole road is under test: Input's capture listener, the panel's veto,
// the panel's own listener for a focused field, main.ts's hotkey line.
//   backtick  opens and shuts the tweak panel — with the pointer over the game, over the panel, with the search box / a slider / a list holding the keyboard —
//             is never typed into the search, and steps NO debug view (the buffers are the 'debug view' row on the Frame page, by the list alone)
//   Tab       does nothing to the panel; the game is handed the press (Input.pressed) and the browser's focus does not move
//   node tools/qa/panel-keys.cjs      env: PORT (the dev server's, default 5199) · QUALITY (default verylow)      exit 0 = every check passed, 1 = a FAIL, 2 = the script died
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const KEY = 'Backslash';   // the debugger's key on the page's board: backslash while empty hands are the slot on backtick (game/handslot.ts; under ?handslot=0 it is Backquote)
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let fails = 0;
const check = (ok, what, got) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${ok || got === undefined ? '' : `   (got ${JSON.stringify(got)})`}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const pageErrors = []; page.on('pageerror', x => pageErrors.push(String(x && x.stack || x).slice(0, 400)));
  log('goto'); await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute`);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); window.__smoke.params.enabled = false; window.__engine.render = () => {}; });   // (keys, not pixels: the renderer is stubbed, a frame costs nothing)
  log('ready');
  // one frame of the page's own loop (the hotkeys run inside it), then what the checks read
  const frame = () => page.evaluate(() => { window.__runFrames(1, 1 / 60); const s = document.querySelector('#panel input[type=search]'); const a = document.activeElement;
    return { open: window.__panel.visible, view: window.__engine.settings.debugView, search: s ? s.value : null, focus: a && a !== document.body ? (a.closest('#panel') ? 'panel' : a.tagName) : 'none' }; });
  const pressed = (code) => page.evaluate((c) => window.__input.pressed.has(c), code);
  const game = { x: 300, y: 400 };   // a spot on the canvas, clear of the panel's column on the right
  await page.mouse.move(game.x, game.y);
  let s = await frame(); check(!s.open && s.view === 0, 'boot: the panel is shut, the final picture is up', s);

  await page.keyboard.press(KEY); s = await frame(); check(s.open && s.view === 0, 'the debugger\'s key opens the panel and steps no debug view', s);
  await page.keyboard.press('Shift+' + KEY); s = await frame(); check(!s.open && s.view === 0, 'Shift + the key is the same key (it used to step the views backwards)', s);
  await page.keyboard.press(KEY); s = await frame(); check(s.open, 'the key opens it again', s);

  await page.keyboard.press('Tab'); const tabSeen = await pressed('Tab'); s = await frame();
  check(s.open, 'Tab leaves the open panel alone', s); check(tabSeen, 'Tab reaches the game (Input.pressed has it for that frame)', tabSeen); check(s.focus === 'none', 'Tab moves no browser focus', s.focus);

  const box = await page.locator('#panel').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('KeyF'); s = await frame(); check(s.open && s.search === 'f' && s.focus === 'panel', 'pointer over the panel: a typed letter still opens its search', s);
  await page.keyboard.press(KEY); s = await frame(); check(!s.open && s.search === 'f', 'the key in the search box shuts the panel and types nothing', s);
  check(s.focus === 'none', 'shut from a field: the keyboard is handed back to the game', s.focus);

  await page.evaluate(() => { const b = document.querySelector('#panel input[type=search]'); b.value = ''; b.dispatchEvent(new Event('input')); });
  await page.keyboard.press(KEY); s = await frame(); check(s.open, 'open again, pointer still over the panel', s);
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3);   // (a panel that appears under a still pointer gets no mouseenter: move, so the hover is real)
  await page.keyboard.press(KEY); s = await frame(); check(!s.open && s.search === '', 'pointer over the panel, nothing focused: the key shuts it (not a character for the search)', s);

  await page.keyboard.press(KEY); s = await frame();
  const slider = await page.evaluate(() => { const fr = [...document.querySelectorAll('#panel .sys')].find(b => (b.title || '').startsWith('Frame')); if (fr) fr.click();   // (a page that opens with a slider in sight, whatever page the rail starts on)
    const r = [...document.querySelectorAll('#panel input[type=range]')].find(e => e.offsetParent); if (!r) return false; r.focus(); return true; });
  await page.keyboard.press(KEY); s = await frame(); check(slider && !s.open, 'a slider holding the keyboard: the key shuts the panel', { slider, ...s });

  await page.keyboard.press(KEY); s = await frame();
  const row = await page.evaluate(() => { const lab = [...document.querySelectorAll('#panel .row')].find(e => { const l = e.querySelector('label'); return !!l && (l.textContent || '').trim() === 'debug view'; }); const sel = lab && lab.querySelector('select'); if (!sel) return null;
    const n = sel.options.length; sel.value = '2'; sel.dispatchEvent(new Event('change')); const v = window.__engine.settings.debugView; sel.value = '0'; sel.dispatchEvent(new Event('change')); return { n, v, back: window.__engine.settings.debugView, }; });
  check(!!row && row.v === 2 && row.back === 0 && row.n >= 10, 'the buffers are still there: the Frame page\'s \'debug view\' list sets them', row);
  await page.mouse.move(game.x, game.y); await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await page.keyboard.press(KEY); s = await frame(); check(!s.open && s.view === 0, 'and the key shuts it from the game again', s);

  const rail = await page.evaluate(() => { const names = [...document.querySelectorAll('#panel .sys')].map(b => (b.title || '').split(' — ')[0]); const rows = document.querySelectorAll('#panel .row').length; const empty = [...document.querySelectorAll('#panel .ppage')].filter(p => !p.querySelector('.row')).length; return { names, rows, empty }; });
  check(rail.names[0] === 'Sandbox' && ['Missions', 'Squad', 'Enemy AI', 'Stealth', 'Player & weapons', 'Frame'].every(n => rail.names.includes(n)) && rail.rows > 1000 && rail.empty === 0, 'the rail: the game\'s pages first, every page has rows', { ...rail, names: rail.names.join(' · ') });
  check(pageErrors.length === 0, 'no page error', pageErrors);
  await browser.close();
  console.log(fails ? `=== panel-keys: ${fails} FAILED ===` : '=== panel-keys: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
