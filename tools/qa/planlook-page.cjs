// PLAN MODE'S CIRCLES ON THE REAL PAGE (src/ui/planlook.ts, ui/cmdring.ts updatePlan, index.html `.planmode .pm`): headless Chromium on the software
// WebGPU adapter, the page as it opens, plan mode put up with its own keys, the Options row moved by its own control.
//   PORT=5241 node tools/qa/planlook-page.cjs     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   drawn    plan mode up on the room clear with its squad of four: a circle at each man's feet, each at the page's own strength of what it was built with
//   row      Options > Game has "Plan mode circles" at the page's value; moved, the circles are drawn at the new strength at once and the value is kept
//   as built the strength put to 1 draws them as they were built
//   kept     after a reload the row and the circles are as they were left; Reset to defaults puts the page's back and keeps nothing
//   exit 0 = all of it with no page error · 1 = otherwise. The verdict is the circles' own computed opacity in the page's DOM: nothing here judges a
//   picture, and the software adapter is not a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const LS = 'twopointsix.planlook', ROW = 'Plan mode circles', URL = `http://localhost:${PORT}/?roomclear&squad4&paused&quality=${QUALITY}&mute`;
let red = 0;
const check = (ok, what, got) => { if (!ok) red++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}: ${got}`); };

// in the page: the circles as drawn (each one's computed opacity), the layer's own factor, what the machine keeps
const READ = (LS) => { const g = document.querySelector('.planmode'), ps = g ? [...g.querySelectorAll('path.pm')] : [];
  return { up: !!window.__orders.plan.up, k: g ? g.style.getPropertyValue('--pm-k') : null, men: ps.map(p => ({ picked: p.classList.contains('picked'), o: Number(getComputedStyle(p).opacity) })),
    self: g && g.querySelector('path.pself') ? Number(getComputedStyle(g.querySelector('path.pself')).opacity) : null, value: window.__planlook.get(), kept: localStorage.getItem(LS) }; };
// in the page: the Options screen on its GAME tab, from the pause card · the row's value · the row moved · Reset · the screen shut
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWV = (label) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); return r ? r.querySelector('.op-val').textContent : null; };
const MOVE = ([label, v]) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`;
  const i = r.querySelector('.op-range'); i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); return ''; };
const RESET = () => { const b = document.querySelector('#options button[data-act="reset"]'); if (!b) return 'no Reset button'; b.click(); return ''; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 300))); page.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /Invalid|error:/.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  const run = n => page.evaluate(n => { window.__runFrames(n, 1 / 60, [], false); }, n);
  const boot = async () => { await page.goto(URL, { waitUntil: 'commit', timeout: 300000 }); await page.waitForFunction(() => !!window.__ready, null, { timeout: 120000 }); await page.evaluate(async () => { await window.__ready; });
    await page.evaluate(() => { window.__pauseLoop = true; window.__testVisible = true; window.__game.godMode = true; window.__runFrames(90, 1 / 60, [], false); }); };
  /** plan mode put up the player's own way: Shift held, the squad's key pressed */
  const planUp = async () => { await page.mouse.move(420, 250); await page.keyboard.down('ShiftLeft'); await run(2); await page.keyboard.down('KeyQ'); await run(2); await page.keyboard.up('KeyQ'); await run(2); await page.keyboard.up('ShiftLeft'); await run(6); };
  const near = (a, b) => Math.abs(a - b) < 0.006;
  const all = (R, f) => R.men.length > 0 && R.men.every(m => near(m.o, (m.picked ? 0.95 : 0.6) * f));

  await boot(); log('ready');   // (a fresh browser context: a machine that has kept nothing)
  await planUp();
  const a = await page.evaluate(READ, LS), page0 = a.value;
  check(a.up && a.men.length === 4 && page0 > 0 && page0 < 1 && all(a, page0) && a.kept === null, 'drawn — plan mode up, a circle at each of the four men\'s feet, each at the page\'s own strength of what it was built with, nothing kept',
    `up ${a.up} · strength ${page0} (--pm-k ${a.k}) · circles ${JSON.stringify(a.men)} · kept ${a.kept}`);

  let e = await page.evaluate(OPEN); if (e) throw new Error(e);
  const v0 = await page.evaluate(ROWV, ROW);
  e = await page.evaluate(MOVE, [ROW, 20]); if (e) throw new Error(e);
  const v1 = await page.evaluate(ROWV, ROW);
  await page.keyboard.press('Escape'); await page.evaluate(() => { if (document.querySelector('#menu.on, #options.on')) window.__menu.close?.(); }); await run(4);
  const b = await page.evaluate(READ, LS);
  check(v0 === `${Math.round(page0 * 100)} %` && v1 === '20 %' && near(b.value, 0.2) && all(b, 0.2) && b.kept === JSON.stringify({ rings: 0.2 }), 'row — Options > Game has the row at the page\'s value; moved to 20 %, the circles are drawn at that strength and it is kept',
    `the row read ${v0}, then ${v1} · strength ${b.value} (--pm-k ${b.k}) · circles ${JSON.stringify(b.men)} · kept ${b.kept} · plan mode still up ${b.up}`);

  await page.evaluate(() => window.__planlook.set(1)); await run(4);
  const c = await page.evaluate(READ, LS);
  check(all(c, 1), 'as built — the strength put to 1 draws them as they were built (0.95 a picked man\'s, 0.6 another\'s)', `circles ${JSON.stringify(c.men)}`);

  await page.evaluate(() => window.__planlook.set(0.35));
  await boot(); await planUp();
  const d = await page.evaluate(READ, LS);
  e = await page.evaluate(OPEN); if (e) throw new Error(e);
  const v2 = await page.evaluate(ROWV, ROW);
  e = await page.evaluate(RESET); if (e) throw new Error(e);
  const v3 = await page.evaluate(ROWV, ROW), f = await page.evaluate(READ, LS);
  check(near(d.value, 0.35) && all(d, 0.35) && v2 === '35 %' && v3 === `${Math.round(page0 * 100)} %` && near(f.value, page0) && f.kept === null, 'kept — after a reload the row and the circles are as they were left; Reset to defaults puts the page\'s back and keeps nothing',
    `after the reload: strength ${d.value}, circles ${JSON.stringify(d.men)}, the row ${v2} · after Reset: the row ${v3}, strength ${f.value}, kept ${f.kept}`);

  check(!errs.length, 'no page error', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
  console.log(red ? `=== planlook-page: ${red} FAIL ===` : '=== planlook-page: ALL PASS ===');
  process.exit(red ? 1 : 0);
})().catch(e => { console.log('- FAIL — the drive stopped: ' + String(e).slice(0, 600)); process.exit(1); });
