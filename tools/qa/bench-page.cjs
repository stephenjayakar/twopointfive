// THE BENCHMARK, RUN ON A PAGE (src/ui/bench.ts, src/ui/benchrun.ts): the real page in headless Chromium on the software WebGPU adapter.
//   1. ?bench on the address: the page goes to the first scene's address BEFORE it boots the game, the run starts there by itself and holds the world; Esc stops
//      it, the record of the run is gone and the page is a plain mission page.
//   2. the title's Extras ▸ Benchmark row: a short run start to finish — a page per scene (src/host/benchScenes.ts), each scene played by the hands-off player
//      (orders given, Sam walked), the last one held under every preset with two sweep rows inside the same take, its tail — and the page held to: the card up
//      with a line per scene, one file downloaded with the report in it, every setting back as it stood, nothing left in the tab's session store, Close back to
//      the address the run was started from.
//   node tools/qa/bench-page.cjs
//   env: PORT (the dev server's, default 5199) · OUT (a folder for the dump, the report and a still per scene, default a temp one) · SIZE (the viewport, default
//        320x180) · CAP (game seconds each scene plays, default 10) · DEADLINE (minutes the whole check may take, default 150) · STEP=script (below)
// The software adapter takes a second or so to draw a frame and its pass timers time the CPU: this proves the run's mechanics, no number in its report is a price.
// Quality is pinned on the address (auto never settles on frames this slow, and the sweep waits for it). The run's own options (short windows, two sweep rows, no
// cut on the wall's clock) are written into the run's record as each page opens, since a run started by the row carries none. A SCENE IS PLAYED BY THE PAGE'S
// OWN FRAMES, up to four ticks of its fixed step a frame (at a frame every few seconds the wall's clock would end it before the hands-off player had walked a
// step: hence no cut on it here); STEP=script has the check step it instead (__runFrames, a second of the game's clock a call at thirty updates, off the fixed
// step). Each scene so plays its CAP seconds through the page's own loop, input and camera, and ends by the player's own cut; the last page's scene
// therefore ends before a heavy moment, and the picture it left is the one held (the tail is the fake page's to prove: bench-check).
// Exit 0 = every check passed, 1 = one failed (printed) or a page did not boot.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'bench-')), DEADLINE = Number(process.env.DEADLINE || 150), CAP = Number(process.env.CAP || 10), [VW, VH] = (process.env.SIZE || '320x180').split('x').map(Number), SCRIPT = process.env.STEP === 'script';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let red = 0; const check = (ok, what) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'twopointsix.bench';
const OPTS = { waitFrames: 3, settleFrames: 1, measureFrames: 2, settleMs: 300, measureMs: 300, slowMs: 1e9, sweepSlowMs: 1e9, heavyHoldMs: 0, heavyCapMs: 1e12, sceneCapMs: 1e12, sweep: { only: ['held2', 'reflect'], settleFrames: 1, measureFrames: 2, settleMs: 0, measureMs: 0 } };

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
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, acceptDownloads: true });
  // every page of the run: seen as visible, and (once the check says so) the run's record given the check's own options before the page reads it
  await ctx.addInitScript(({ KEY, OPTS, CAP }) => { window.__testVisible = true;
    try { if (sessionStorage.getItem('bench-check.short')) { const t = sessionStorage.getItem(KEY); if (t) { const c = JSON.parse(t); c.opts = OPTS; c.cap = CAP; c.secs = '0.3'; sessionStorage.setItem(KEY, JSON.stringify(c)); } } } catch (e) { /* */ } }, { KEY, OPTS, CAP });
  const page = await ctx.newPage();
  // (two console lines every boot of this page prints are passed over by their address: no /favicon.ico on the dev server, and no capture sink on :5174 for the recorder's POST of each dump)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
  page.on('console', m => { if (m.type() !== 'error') return; const at = m.location().url || ''; if (!(/\/favicon\.ico$/.test(at) || /^http:\/\/localhost:5174\//.test(at))) errs.push(`${m.text().slice(0, 400)}${at ? ` (${at})` : ''}`); });
  const downloads = []; page.on('download', d => downloads.push(d));
  const went = []; page.on('framenavigated', f => { if (f === page.mainFrame()) went.push(f.url().replace(/^https?:\/\/[^/]+/, '')); });
  const ready = async what => { try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 600000 }); await page.evaluate(async () => { await window.__ready; }); return true; }
    catch (e) { console.log(`- FAIL — ${what}: the page did not come ready — ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); return false; } };
  const frames = async n => page.evaluate(n => new Promise(res => { let k = 0; const f = () => (++k >= n ? res(k) : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const record = () => page.evaluate(KEY => { try { const t = sessionStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }, KEY);
  const SCENES = () => page.evaluate(() => window.__bench.sceneDefs.map(s => ({ id: s.id, name: s.name, scn: s.scn, seed: s.seed, hard: s.hard })));
  const REST = '?quality=medium&mute';

  // 1. ?bench on the address
  log(`http://localhost:${PORT}/?bench=0.3&benchcap=${CAP}&quality=medium&mute`);
  await page.goto(`http://localhost:${PORT}/?bench=0.3&benchcap=${CAP}&quality=medium&mute`, { waitUntil: 'commit' });
  await page.waitForURL(u => /benchrun=0/.test(String(u)), { timeout: 60000 }).catch(() => {});
  if (!(await ready('the first scene'))) { await browser.close(); process.exit(1); }
  await frames(3);
  const scenes = await SCENES(), q0 = new URL(page.url()).searchParams;
  check(/benchrun=0/.test(page.url()) && q0.get('roomclear') === String(scenes[0].seed) && q0.get('seed') === String(scenes[0].seed) && q0.has('noverdict') && q0.has('nokeep') && q0.has('mute') && !q0.has('bench') && q0.get('quality') === 'medium', `?bench on the address: the page went to the first scene's own address (${page.url().replace(/^https?:\/\/[^/]+/, '')})`);
  const first = await page.evaluate(() => ({ active: window.__bench.active, freezing: window.__bench.freezing, state: window.__bench.state, veil: document.getElementById('bench-veil')?.textContent ?? null, staged: !!window.__roomclear.state, squad: window.__game.orders.squad().length }));
  const rec0 = await record();
  check(first.active && first.freezing && /^Benchmark \d+ % · Esc stops$/.test(first.veil ?? '') && first.staged && first.squad === 4 && rec0 && rec0.live === 0 && rec0.warm === false && rec0.from === '/' + REST, `a run is under way on the staged mission, the world held, its record in the tab's session store (${JSON.stringify(first)} · from ${rec0?.from})`);
  // Esc: nothing was timed yet on a machine this slow, so there is no card to close and the page goes back by itself to the address the run was started from
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.evaluate(() => !!document.getElementById('bench-card')).catch(() => false)) await page.click('#bench-card button:nth-of-type(2)', { noWaitAfter: true }).catch(() => {});   // (a machine fast enough to have timed a window shows its card: closed)
  await page.waitForURL(u => !/benchrun=/.test(String(u)), { timeout: 120000, waitUntil: 'commit' }).catch(() => {});
  log('the title');
  if (!(await ready('the title'))) { await browser.close(); process.exit(1); }
  { const back = await page.evaluate(() => ({ active: window.__bench.active, veil: !!document.getElementById('bench-veil'), rec: window.__perfrec.recording, menu: window.__menu.mode }));
    check(page.url().replace(/^https?:\/\/[^/]+/, '') === '/' + REST && !back.active && !back.veil && !back.rec && back.menu === 'start' && (await record()) === null, `Esc stops it: the page is back on the address it was started from, no run, no recording, the run's record gone (${page.url().replace(/^https?:\/\/[^/]+/, '')} · ${JSON.stringify(back)})`); }
  downloads.length = 0;

  // 2. the title's row: a short run start to finish
  await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => (!window.__quality.calibrating || performance.now() - t0 > 120000 ? res(0) : requestAnimationFrame(f)); f(); }));
  await frames(3);
  await page.evaluate(() => sessionStorage.setItem('bench-check.short', '1'));
  const row = await page.evaluate(() => { const b = document.querySelector('#menu .xopen'); if (!b) return 'no Extras button'; b.click(); const shows = [...document.querySelectorAll('#menu a[data-extra]')].map(a => a.getAttribute('data-extra')); const a = document.querySelector('#menu a[data-extra="bench"]'); if (!a) return 'no Benchmark row'; const out = { href: a.getAttribute('href'), name: a.querySelector('b')?.textContent ?? a.textContent, rows: shows }; a.click(); return out; });
  check(row && row.name === 'Benchmark' && /^\?bench/.test(row.href) && !row.rows.includes('night') && !row.rows.includes('day'), `Extras has the Benchmark row and no showcase rows (${JSON.stringify(row)})`);
  const per = []; let tooLong = false, R = null, before = null;
  for (let i = 0; i < scenes.length && !tooLong; i++) {
    await page.waitForURL(u => new RegExp(`benchrun=${i}(&|$)`).test(String(u)), { timeout: 120000 }).catch(() => {});
    if (!(await ready(`scene ${i}`))) { await browser.close(); process.exit(1); }
    const S = scenes[i], last = i === scenes.length - 1, seen = []; let prev = '', shot = false, keys = null, f9 = null, hands = null, done = null, sam0 = null;
    log(`scene ${i}: ${S.id} · ${page.url().replace(/^https?:\/\/[^/]+/, '')}`);
    if (i === 0) { const c = await record(); check(c && c.warm === true && c.opts && c.cap === CAP, `the row's run says its first load is a second one, and carries the check's options (${JSON.stringify({ warm: c?.warm, cap: c?.cap })})`); }
    await page.evaluate(() => { const w = window.__benchWatch = { by: {}, tag: 0, off: false };
      const f = () => { if (w.off) return; const s = window.__bench.state, t = window.__game.time, b = w.by[s] ?? (w.by[s] = { a: t, b: t, n: 0 }); b.a = Math.min(b.a, t); b.b = Math.max(b.b, t); b.n++; if ([...document.querySelectorAll('body > div')].some(d => /^SWEEP/.test(d.textContent || ''))) w.tag++; requestAnimationFrame(f); };
      requestAnimationFrame(f); });
    for (;;) {
      let s = null;
      try { s = await page.evaluate(SCRIPT => { const B = window.__bench, G = window.__game;
        if (SCRIPT && B.state === 'scene' && B.hands && !B.hands.end) window.__runFrames(30, 1 / 30);   // (STEP=script: the scene stepped a second at a time at thirty updates, off the page's fixed step. Without it the page's own frames play the scene, up to four ticks of its fixed step a frame: the wall's clock is no cap here, the check's options put it out of reach, since a software frame takes seconds)
        return { state: B.state, last: B.last, veil: document.getElementById('bench-veil')?.textContent ?? '', orders: G.orders.log.map(o => o.order), sam: [...G.player.char.pos].map(v => +v.toFixed(1)), hands: B.hands ? { t: +B.hands.t.toFixed(1), end: B.hands.end, b: B.hands.b } : null, god: G.godMode, dark: G.blackout.active, locked: !!window.__input.lockExcept, acts: B.acts.join(' '), by: window.__benchWatch?.by, tag: window.__benchWatch?.tag }; }, SCRIPT); }
      catch (e) { if (!last) break; throw e; }   // (the page went on to the next scene under the question)
      if (s.state !== prev) { seen.push(s.state); log(`  ${s.state} · ${s.veil}`); prev = s.state; }
      if (s.hands && s.state === 'scene') { if (!sam0) sam0 = s.sam; hands = s; }
      done = s;
      if (s.state === 'scene' && s.hands && !s.hands.end) {
        if (!keys && s.hands.t > 1) {   // hands off: a key held never reaches the game, and the keys that would stop the recording, open the debugger, the panel or the pause card do nothing
          await page.keyboard.down('KeyC').catch(() => {}); const held = await page.evaluate(() => window.__input.keys.has('KeyC')).catch(() => null); await page.keyboard.up('KeyC').catch(() => {});
          for (const k of ['p', 'F9', 'Backquote', 'Tab', 'Enter']) await page.keyboard.press(k).catch(() => {});
          keys = await page.evaluate(() => ({ state: window.__bench.state, active: window.__bench.active, rec: window.__perfrec.recording, menu: window.__menu.isOpen })).catch(() => null); if (keys) keys.reached = held;
          if (last) before = await page.evaluate(STATE);   // (the last page's settings with its level and its weather up: what the presets and the sweep must put back)
        }
        if (!shot && s.hands.t >= CAP - 2) { shot = true; await page.screenshot({ path: path.join(OUT, `scene-${S.id}.png`), timeout: 240000 }).catch(e => log(`  no still of ${S.id}: ${String(e).slice(0, 120)}`)); }
        if (!SCRIPT) await page.waitForTimeout(1000);
        continue;
      }
      if (last && s.state === 'held' && !f9) { await page.keyboard.press('F9'); await frames(2); f9 = await page.evaluate(() => ({ active: window.__bench.active, rec: window.__perfrec.recording })); }
      if (s.state === 'idle' && (last || s.last === 'next scene') && seen.length > 1) break;
      if (Date.now() - T0 > DEADLINE * 60000) { tooLong = true; break; }
      await page.waitForTimeout(400);
    }
    per.push({ S, seen, hands, keys, f9, acts: done && done.state === 'idle' ? done.acts : seen.join(' '), by: done?.by, tag: done?.tag ?? 0 });
    const H = hands;
    const walked = H && sam0 ? Math.hypot(H.sam[0] - sam0[0], H.sam[2] - sam0[2]) : 0;
    check(!!H && H.hands.t >= CAP - 1.5 && H.orders.length > 0 && (walked > 1 || i > 0) && H.god === true && H.locked === true, `${S.id}: the hands-off player played it on the page — ${H ? `${H.hands.t} s, orders ${[...new Set(H.orders)].join(', ')}, Sam walked ${walked.toFixed(1)} m to (${H.sam[0]}, ${H.sam[2]})${H.dark ? ', the mains out' : ''}, the keyboard locked out ${H.locked}` : 'no hands seen'}`);
    check(!!keys && keys.active && keys.rec && !keys.menu && keys.reached === false, `${S.id}: P, F9, backtick, Tab and Enter during the scene change nothing, and a key held never reaches the game (${JSON.stringify(keys)})`);
  }
  check(!tooLong, `the run ended by itself inside ${DEADLINE} minutes`);
  if (tooLong) await page.evaluate(() => window.__bench.stop('the check ran out of time')).catch(() => {});
  { const trim = a => a.replace(/ idle$/, ''), want = scenes.map((_, i) => i === 0 ? 'waiting opened scene' : 'waiting scene'), got = per.map(p => trim(p.acts));
    check(JSON.stringify(got.slice(0, -1)) === JSON.stringify(want.slice(0, -1)) && got[got.length - 1] === 'waiting scene held sweep', `each page's acts in order: ${got.join(' | ')}`); }
  { const L = per[per.length - 1], span = s => L.by && L.by[s] ? +(L.by[s].b - L.by[s].a).toFixed(3) : null, held = ['held', 'sweep'].map(span);
    check(held.every(x => x === 0) && L.tag === 0, `on the last page the game's clock stands still for the windows and the sweep (${held.join(' / ')} s), and the sweep put no tag of its own on the screen`);
    check(!!L.f9 && L.f9.active && L.f9.rec, `F9 while the picture is held: the recording goes on (${JSON.stringify(L.f9)})`); }
  await page.waitForTimeout(300); await frames(3);
  R = await page.evaluate(() => ({ last: window.__bench.last, result: window.__bench.result, report: window.__bench.report, card: document.getElementById('bench-report')?.value ?? null, buttons: [...document.querySelectorAll('#bench-card button')].map(b => b.textContent), veil: !!document.getElementById('bench-veil'), rec: window.__perfrec.recording, sweep: window.__perfsweep.active, focus: document.activeElement?.id ?? '', god: window.__game.godMode, frozen: window.__bench.freezing, keysHeld: [...window.__input.keys] }));
  console.log((R.report || '').split('\n').map(l => '    | ' + l).join('\n'));
  fs.writeFileSync(path.join(OUT, 'report.txt'), R.report || '');
  check(R.last === 'done', `it ended as done (${R.last})`);
  const steps = (R.result?.steps ?? []), ids = steps.map(s => s.id).join(' '), want = `opened ${scenes.map(s => `scene:${s.id}`).join(' ')} held verylow low medium high`;
  check(ids === want && steps.every(s => s.skipped || (s.frames >= 1 && s.ms > 0 && s.res[0] > 0)), `a line per window and per scene, each with frames in it: ${ids}`);
  check(R.result?.set && (R.result.scenes ?? []).map(s => s.id).join(' ') === scenes.map(s => s.id).join(' ') && R.result.scenes.every(s => /levelFile=/.test(s.query) && !!s.end) && scenes.every(s => R.report.includes(s.name)), `the file names the set (${R.result?.set}) and every scene with its address and its end: ${(R.result?.scenes ?? []).map(s => `${s.id}: ${s.end}`).join(' · ')}`);
  check((R.result?.features ?? []).map(f => f.id).sort().join(' ') === 'held2 reflect', `the two sweep rows are priced in the report: ${JSON.stringify(R.result?.features)}`);
  check(R.card === R.report && R.buttons.join(' | ') === 'Copy | Close' && !R.veil && R.focus === 'bench-report', `the card is up with the report in its box, two buttons, and the keyboard (${R.buttons.join(' | ')})`);
  const M = R.result?.machine ?? {}, B = R.result?.boot;
  check(!!M.webgpu && !!M.webgl && /GPU\s+\S/.test(R.report) && /browser\s+\S/.test(R.report) && /machine\s+\S/.test(R.report), `the report names the machine: ${M.webgl} · WebGPU ${M.webgpu}${M.fallback ? ' (fallback)' : ''} · ${M.browser} · ${M.os}`);
  check(!!B && B.pipelines[0] > 0 && B.pipelines[0] === B.pipelines[1] && /load\s+/.test(R.report) && (R.result?.notes ?? []).some(n => /started from the title/.test(n)), `the report carries the first page's boot and says it was a second load: ${JSON.stringify(B)}`);
  check(!R.rec && !R.sweep && R.god === false && R.frozen === true && !R.keysHeld.some(k => /^Key[WASD]$/.test(k)) && (await record()) === null, `nothing is left running or held: no recording, no sweep, god mode off again, the world held under the card, no walk key down, no record in the session store (${JSON.stringify({ rec: R.rec, sweep: R.sweep, god: R.god, keys: R.keysHeld })})`);
  const after = await page.evaluate(STATE);
  check(after === before, 'every setting, the preset, auto and the ladder\'s rungs are as they stood in the last page\'s scene'); printDiff(before, after);
  check(downloads.length === 1, `one file was downloaded over the whole run (${downloads.length})`);
  if (downloads.length) { const f = path.join(OUT, downloads[0].suggestedFilename()); await downloads[0].saveAs(f); const D = JSON.parse(fs.readFileSync(f, 'utf8'));
    const ev = k => D.events.filter(e => e.kind === k), b = ev('bench').length === 1 ? JSON.parse(ev('bench')[0].text) : null;
    check(/^perf-.*\.json$/.test(path.basename(f)) && D.frames.length > 20 && !!b && b.steps.length === steps.length && b.set === R.result.set && ev('sweep').some(e => JSON.parse(e.text).op === 'end'), `${path.basename(f)}: ${D.frames.length} frames, the sweep's events and the whole report inside (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`); }
  // 3. Close goes back to where the run was started
  await page.click('#bench-card button:nth-of-type(2)', { noWaitAfter: true });
  await page.waitForURL(u => !/benchrun=/.test(String(u)), { timeout: 120000, waitUntil: 'commit' }).catch(() => {});
  check(page.url().replace(/^https?:\/\/[^/]+/, '') === '/' + REST, `Close loads the address the run was started from (${page.url().replace(/^https?:\/\/[^/]+/, '')})`);
  check(!errs.length, `no page or console error (${errs.length})`); for (const e of errs.slice(0, 6)) console.log('    ' + e);
  await browser.close();
  console.log(red ? `\n${red} FAILED` : `\nall pass (${((Date.now() - T0) / 60000).toFixed(1)} min) · ${OUT}`);
  process.exit(red ? 1 : 0);
})();
