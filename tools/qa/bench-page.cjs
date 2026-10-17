// THE BENCHMARK, RUN ON A PAGE (src/ui/bench.ts): boot the real page in headless Chromium on the software WebGPU adapter with ?bench on its address (it must start
// by itself and hold the world), stop it, then run a short one start to finish through the hook — the opening picture, the day showcase live, its picture held
// under every preset, two sweep rows inside the same take, the scene's tail — and hold the page to: everything back as it stood, the card up with the report, the
// take downloaded with the report in it, the title's Extras row starting a run in place.
//   node tools/qa/bench-page.cjs
//   env: PORT (the dev server's, default 5199) · OUT (a folder for the dump and the report, default a temp one) · SIZE (the viewport, default 320x180)
//        DEADLINE (minutes the run may take, default 60)
// The software adapter takes a second or so to draw a frame and its pass timers time the CPU: this proves the run's mechanics, no number in its report is a price.
// Quality is pinned on the address (auto never settles on frames this slow, and the sweep waits for it), the show's smoke is minutes away at this pace (the run
// holds at its cap, and must say so), and the show is ended by hand in its tail (its own end is what hands the title back: the card must keep the keyboard).
// Exit 0 = every check passed, 1 = one failed (printed) or the page did not boot.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'bench-')), DEADLINE = Number(process.env.DEADLINE || 60), [VW, VH] = (process.env.SIZE || '320x180').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let red = 0; const check = (ok, what) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
fs.mkdirSync(OUT, { recursive: true });

// in the page: everything a run may move, as one string
const STATE = () => {
  const S = window.__engine.settings, o = {}; for (const k of Object.keys(S)) { const v = S[k]; if (k !== 'nvAmount' && k !== 'hitFlash' && (typeof v !== 'object' || Array.isArray(v))) o[k] = v; }   // (the loop writes those two every frame)
  return JSON.stringify({ settings: o, preset: window.__quality.current, auto: window.__quality.auto, adaptive: window.__quality.adaptive, climb: window.__quality.climbState.standing, rb: window.__smoke.params.rbIters });
};
const printDiff = (x, y) => { if (x === y) return; const a = JSON.parse(x), b = JSON.parse(y);
  for (const k of Object.keys(a.settings)) if (JSON.stringify(a.settings[k]) !== JSON.stringify(b.settings[k])) console.log(`    ${k}: ${JSON.stringify(a.settings[k])} → ${JSON.stringify(b.settings[k])}`);
  for (const k of Object.keys(a)) if (k !== 'settings' && JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log(`    ${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, acceptDownloads: true })).newPage();
  // (two console lines every boot of this page prints are passed over by their address: no /favicon.ico on the dev server, and no capture sink on :5174 for the recorder's POST of each dump)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
  page.on('console', m => { if (m.type() !== 'error') return; const at = m.location().url || ''; if (!(/\/favicon\.ico$/.test(at) || /^http:\/\/localhost:5174\//.test(at))) errs.push(`${m.text().slice(0, 400)}${at ? ` (${at})` : ''}`); });
  const downloads = []; page.on('download', d => downloads.push(d));
  const REST = '?quality=medium&mute', url = `http://localhost:${PORT}/?bench=0.3&quality=medium&mute`;
  log(url);
  try { await page.goto(url); await page.evaluate(async () => { await window.__ready; window.__testVisible = true; }); }
  catch (e) { console.log(`- FAIL — the page did not come ready — ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); await browser.close(); process.exit(1); }
  const frames = async n => page.evaluate(n => new Promise(res => { let k = 0; const f = () => (++k >= n ? res(k) : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await frames(3);
  log('ready; the loop is running');

  // 1. the address alone started it: the world is held behind the title, a veil says so; stopped, nothing is left
  const first = await page.evaluate(() => ({ active: window.__bench.active, freezing: window.__bench.freezing, state: window.__bench.state, veil: document.getElementById('bench-veil')?.textContent ?? null, title: window.__menu.isOpen && window.__menu.mode === 'start', inert: document.getElementById('menu').hasAttribute('inert'), at: location.search }));
  check(first.active && first.freezing && /^Benchmark \d+ % · Esc stops$/.test(first.veil ?? '') && first.title && first.inert, `?bench on the address: a run is under way behind the title, whose buttons take no key meanwhile (${JSON.stringify(first)})`);
  check(first.at === REST, `the word is off the address once it started: a reload or a mission's link starts no second one (${first.at})`);
  await page.keyboard.press('Escape'); await frames(2);
  // (on a machine fast enough to have timed a window by now a card and a file are right: closed and forgotten here, the short run below is the one held to its file)
  if (await page.evaluate(() => !!document.getElementById('bench-card'))) { await page.click('#bench-card button:nth-of-type(2)'); await frames(2); }
  downloads.length = 0;
  const stopped = await page.evaluate(() => ({ active: window.__bench.active, veil: !!document.getElementById('bench-veil'), card: !!document.getElementById('bench-card'), rec: window.__perfrec.recording, title: window.__menu.isOpen && window.__menu.mode === 'start', last: window.__bench.last }));
  check(!stopped.active && !stopped.veil && !stopped.rec && stopped.title && !(await page.evaluate(() => document.getElementById('menu').hasAttribute('inert'))), `Esc stops it: no veil, no recording, the title still up and its own again (${JSON.stringify(stopped)})`);

  // the page's own quality settles first (auto measures the machine behind the title), then that is the state every run must put back
  await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => (!window.__quality.calibrating || performance.now() - t0 > 120000 ? res(0) : requestAnimationFrame(f)); f(); }));
  await frames(3);
  const before = await page.evaluate(STATE);
  log(`quality: ${await page.evaluate(() => window.__quality.label + ' x' + window.__engine.settings.renderScale + (window.__quality.calibrating ? ' (still measuring)' : ''))}`);
  // a watch of its own in the page, a sample a frame: the game's clock per act (a poll from out here can miss a short act), and the sweep's own tag
  await page.evaluate(() => { const w = window.__benchWatch = { by: {}, tag: 0, off: false };
    const f = () => { if (w.off) return; const s = window.__bench.state, t = window.__game.time, b = w.by[s] ?? (w.by[s] = { a: t, b: t, n: 0 }); b.a = Math.min(b.a, t); b.b = Math.max(b.b, t); b.n++; if ([...document.querySelectorAll('body > div')].some(d => /^SWEEP/.test(d.textContent || ''))) w.tag++; requestAnimationFrame(f); };
    requestAnimationFrame(f); });

  // 2. a short run, start to finish
  const said = await page.evaluate(() => window.__bench.start({ settleMs: 300, measureMs: 300, slowMs: 1e9, sweepSlowMs: 1e9, heavyHoldMs: 2000, heavyCapMs: 12000, sceneCapMs: 90000, sweep: { only: ['held2', 'reflect'], settleFrames: 1, measureFrames: 2, settleMs: 0, measureMs: 0 } }));
  log(`start: ${said}`);
  const seen = []; let last = '', tooLong = false, keys = null, f9 = null, ended = false;
  for (;;) {
    const s = await page.evaluate(() => ({ state: window.__bench.state, freezing: window.__bench.freezing, show: window.__breach.active, t: +window.__game.time.toFixed(2), sweep: window.__perfsweep.active, veil: document.getElementById('bench-veil')?.textContent ?? '' }));
    if (s.state !== last) { seen.push(s.state); log(`${s.state}${s.show ? ' (the show runs)' : ''} · ${s.veil}`); last = s.state; }
    if (s.state === 'idle') break;
    if (s.state === 'scene' && !keys) {   // hands off: the keys that would quit the show, stop the recording, open the debugger or pause do nothing while it runs
      for (const k of ['p', 'F9', 'Backquote', 'Tab', 'Enter']) await page.keyboard.press(k); await frames(2);
      keys = await page.evaluate(() => ({ state: window.__bench.state, active: window.__bench.active, show: window.__breach.active, rec: window.__perfrec.recording, menu: window.__menu.isOpen }));
    }
    if (s.state === 'held' && !f9) {   // (the show's own lock on the keys is off while the world is held: F9 here is the recorder's key, and must not be)
      await page.keyboard.press('F9'); await frames(2);
      f9 = await page.evaluate(() => ({ active: window.__bench.active, rec: window.__perfrec.recording, last: window.__bench.last }));
    }
    if (s.state === 'tail' && !ended) { ended = true; await frames(3); await page.evaluate(() => window.__breach.stop()); }   // (the show over, as when it runs out: the title comes back up under the run)
    if (Date.now() - T0 > DEADLINE * 60000) { tooLong = true; break; }
    await page.waitForTimeout(400);
  }
  check(!tooLong, `the run ended by itself inside ${DEADLINE} minutes`);
  if (tooLong) await page.evaluate(() => window.__bench.stop('the check ran out of time'));
  const W = await page.evaluate(() => { const w = window.__benchWatch; w.off = true; return { acts: window.__bench.acts.join(' '), by: w.by, tag: w.tag }; });
  check(W.acts === 'waiting opened scene held sweep tail idle', `the acts in order: ${W.acts} (seen from out here: ${seen.join(' ')})`);
  check(W.tag === 0, 'the sweep inside the run put no tag of its own on the screen');
  { const span = s => W.by[s] ? +(W.by[s].b - W.by[s].a).toFixed(3) : null, held = ['opened', 'held', 'sweep'].map(span), live = ['scene', 'tail'].map(span);
    check(held.every(x => x === 0) && live.every(x => x > 0), `the game's clock stands still for the windows and the sweep (${held.join(' / ')} s) and runs for the scene and its tail (${live.join(' / ')} s)`); }
  check(!!keys && keys.active && keys.show && keys.rec && !keys.menu, `P, F9, backtick, Tab and Enter during the scene: the show, the recording and the run go on (${JSON.stringify(keys)})`);
  check(!!f9 && f9.active && f9.rec, `F9 while the picture is held: the recording goes on (${JSON.stringify(f9)})`);
  await page.waitForTimeout(300); await frames(3);
  // the title came back up under the card as the show ended: the card keeps the focus, and Enter presses nothing under it
  const focus = await page.evaluate(() => ({ on: document.activeElement?.id ?? '', inert: document.getElementById('menu').hasAttribute('inert') }));
  await page.keyboard.press('Enter'); await frames(2);
  const enter = await page.evaluate(() => ({ card: !!document.getElementById('bench-card'), title: window.__menu.isOpen && window.__menu.mode === 'start', bench: window.__bench.active }));
  check(focus.on === 'bench-report' && focus.inert && enter.card && enter.title && !enter.bench, `the report has the keyboard, not the title under it (${JSON.stringify({ ...focus, ...enter })})`);
  const R = await page.evaluate(() => ({ last: window.__bench.last, result: window.__bench.result, report: window.__bench.report, card: document.getElementById('bench-report')?.value ?? null, buttons: [...document.querySelectorAll('#bench-card button')].map(b => b.textContent), veil: !!document.getElementById('bench-veil'), rec: window.__perfrec.recording, sweep: window.__perfsweep.active, show: window.__breach.active, title: window.__menu.isOpen && window.__menu.mode === 'start', held: window.__perfsweep.freezing }));
  console.log((R.report || '').split('\n').map(l => '    | ' + l).join('\n'));
  fs.writeFileSync(path.join(OUT, 'report.txt'), R.report || '');
  check(R.last === 'done', `it ended as done (${R.last})`);
  check((R.result?.notes ?? []).some(n => /heavy moment had not come/.test(n)) && R.result?.query === REST, `the report says its scene was held before the smoke came, and carries the address (${R.result?.query})`);
  const steps = (R.result?.steps ?? []), ids = steps.map(s => s.id).join(' ');
  check(ids === 'opened scene held verylow low medium high' && steps.every(s => s.skipped || (s.frames >= 1 && s.ms > 0 && s.res[0] > 0)), `a line per window, each with frames in it: ${ids}`);
  check((R.result?.features ?? []).map(f => f.id).sort().join(' ') === 'held2 reflect', `the two sweep rows are priced in the report: ${JSON.stringify(R.result?.features)}`);
  check(R.card === R.report && R.buttons.join(' | ') === 'Copy | Close' && !R.veil, `the card is up with the report in its box and two buttons (${R.buttons.join(' | ')})`);
  const M = R.result?.machine ?? {}, B = R.result?.boot;
  check(!!M.webgpu && !!M.webgl && /GPU\s+\S/.test(R.report) && /browser\s+\S/.test(R.report) && /machine\s+\S/.test(R.report), `the report names the machine: ${M.webgl} · WebGPU ${M.webgpu}${M.fallback ? ' (fallback)' : ''} · ${M.browser} · ${M.os}`);
  check(!!B && B.toCard > 0 && B.pipelines[0] > 0 && B.pipelines[0] === B.pipelines[1] && /load\s+[\d.]+ m?s to the start card/.test(R.report), `the report carries the boot: ${JSON.stringify(B)}`);
  check(!R.rec && !R.sweep && !R.show && R.title, `nothing is left running: no recording, no sweep, no show, the title back up (${JSON.stringify({ rec: R.rec, sweep: R.sweep, show: R.show, title: R.title })})`);
  const after = await page.evaluate(STATE);
  check(after === before, 'every setting, the preset, auto and the ladder\'s rungs are back as they stood'); printDiff(before, after);
  // the take: one download, the recorder's json, with the sweep's events and the report in it
  check(downloads.length === 1, `one file was downloaded (${downloads.length})`);
  if (downloads.length) { const f = path.join(OUT, downloads[0].suggestedFilename()); await downloads[0].saveAs(f); const D = JSON.parse(fs.readFileSync(f, 'utf8'));
    const ev = k => D.events.filter(e => e.kind === k);
    check(/^perf-.*\.json$/.test(path.basename(f)) && D.frames.length > 20 && ev('bench').length === 1 && JSON.parse(ev('bench')[0].text).steps.length === 7 && ev('sweep').some(e => JSON.parse(e.text).op === 'end'), `${path.basename(f)}: ${D.frames.length} frames, the sweep's events and the report inside (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`); }

  // 3. the card closes; Extras ▸ Benchmark starts a run in place
  await page.click('#bench-card button:nth-of-type(2)'); await frames(2);
  check(await page.evaluate(() => !document.getElementById('bench-card') && !document.getElementById('menu').hasAttribute('inert')), 'Close takes the card away, and the title is its own again');
  const row = await page.evaluate(() => { const b = document.querySelector('#menu .xopen'); if (!b) return 'no Extras button'; b.click(); const a = document.querySelector('#menu a[data-extra="bench"]'); if (!a) return 'no Benchmark row'; const href = a.getAttribute('href'), name = a.textContent; a.click(); return { href, name, active: window.__bench.active, at: location.search }; });
  check(row && row.active === true && row.name === 'Benchmark' && /^\?bench/.test(row.href) && row.at === REST, `Extras ▸ Benchmark starts a run in place, no page load (${JSON.stringify(row)})`);
  await page.keyboard.press('Escape'); await frames(2);
  check(await page.evaluate(() => !window.__bench.active && !window.__perfrec.recording) && (await page.evaluate(STATE)) === before, 'stopped again: nothing running, everything as it stood');
  check(!errs.length, `no page or console error (${errs.length})`); for (const e of errs.slice(0, 6)) console.log('    ' + e);
  await browser.close();
  console.log(red ? `\n${red} FAILED` : `\nall pass (${((Date.now() - T0) / 60000).toFixed(1)} min) · ${OUT}`);
  process.exit(red ? 1 : 0);
})();
