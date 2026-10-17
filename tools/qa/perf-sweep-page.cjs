// THE PERF SWEEP, RUN ON A PAGE (src/ui/perfsweep.ts): boot the real page in headless Chromium on the software WebGPU adapter, press F8 as a player would, stop it with F8
// again (everything must be back as it was), then run a short sweep start to finish through the hook and keep its dump — the file tools/qa/perf-report.ts reads.
//   node tools/qa/perf-sweep-page.cjs
//   env: PORT (the dev server's, default 5199) · QUERY (default 'roomclear&squad4&quality=high') · OUT (a folder for the dump, default a temp one) · ROUNDS (2) · ONLY (row ids, comma-separated)
//        SETTLE / MEASURE (frames dropped / measured a segment, default 1 / 2) · SIZE (the viewport, default 320x180) · DEADLINE (minutes the whole sweep may take, default 150)
//        STALL (minutes with no new segment that mean the frame loop has died, default 10). A sweep still moving when DEADLINE runs out is a slow box, said as such:
//        it is stopped (everything must be back), its one FAIL names the minutes it wants, and the checks that need a finished sweep are passed over.
//        LIVE=1: the whole sweep of step 2 is a live take (Shift+F8's), the only kind the rows of the running world flip on ('air', 'oneAir', 'wispMotes': a snow
//        level, QUERY='levelFile=pass.json&roomclear&squad4&quality=high'); with ONLY, each row named there must then really be flipped, not skipped.
//        FLIP (row ids, comma-separated): the rows that must really be flipped in step 2, on either kind of take (default: under LIVE with ONLY, all of ONLY).
//        GOGGLES=1: night vision is put on (N) before anything is swept and the check waits (GOGGLES_WAIT minutes at most, default 6; no infrared light by then ends
//        the run) for the infrared lights to be in the picture (game/irlight.ts): the stand the rows 'irLight' / 'irLightOne' flip on
//        (QUERY='levelFile=depot.json&roomclear=1&squad4&quality=high', FLIP=irLight,irLightOne). The lights the renderer took are then counted on every frame of
//        step 2: none while the first row is flipped, one under the second, and on a frozen take as many as the take began with on every frame between.
// The software adapter takes seconds to draw a frame at High (the whole list × 2 rounds is about 230 frames) and its pass timers time the CPU: this proves the sweep's mechanics (segments, events, restore, the dump's shape), no price.
// Exit 0 = every check passed, 1 = one failed (printed) or the page did not boot.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, QUERY = process.env.QUERY ?? 'roomclear&squad4&quality=high', OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'perf-sweep-'));
const ROUNDS = Number(process.env.ROUNDS || 2), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, LIVE = !!process.env.LIVE && process.env.LIVE !== '0', MUST = process.env.FLIP ? process.env.FLIP.split(',') : LIVE && ONLY ? ONLY : null, GOGGLES = !!process.env.GOGGLES && process.env.GOGGLES !== '0';
const DEADLINE = Number(process.env.DEADLINE || 150), STALL = Number(process.env.STALL || 10), SETTLE = Number(process.env.SETTLE || 1), MEASURE = Number(process.env.MEASURE || 2), [VW, VH] = (process.env.SIZE || '320x180').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let red = 0; const check = (ok, what) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
fs.mkdirSync(OUT, { recursive: true });

// in the page: everything the sweep may move, as one string
const STATE = () => {
  const S = window.__engine.settings, o = {}; for (const k of Object.keys(S)) { const v = S[k]; if (k !== 'nvAmount' && k !== 'hitFlash' && (typeof v !== 'object' || Array.isArray(v))) o[k] = v; }   // (the loop writes those two every frame)
  return JSON.stringify({ settings: o, preset: window.__quality.current, auto: window.__quality.auto, adaptive: window.__quality.adaptive, climb: window.__quality.climbState.standing, fog: window.__game.fogOfWar.on, fogFrame: !!window.__engine.fogFrame?.on, fogEdge: window.__engine.fogFrame?.edge ?? null,
    smoke: { enabled: window.__smoke.params.enabled, rb: window.__smoke.params.rbIters }, wisps: window.__snow ? { motes: window.__snow.wisps.motes, stretch: window.__snow.wisps.stretch } : null });
};

// two STATE strings that should be equal: every setting and switch that is not
const printDiff = (x, y, name = '') => { if (x === y) return; const a = JSON.parse(x), b = JSON.parse(y), p = name ? `${name}: ` : '';
  for (const k of Object.keys(a.settings)) if (JSON.stringify(a.settings[k]) !== JSON.stringify(b.settings[k])) console.log(`    ${p}${k}: ${JSON.stringify(a.settings[k])} → ${JSON.stringify(b.settings[k])}`);
  for (const k of Object.keys(a)) if (k !== 'settings' && JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log(`    ${p}${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  // (two console lines every boot of this page prints, the base build's too, are passed over by their address: no /favicon.ico on the dev server, and no capture sink on :5174 for the recorder's POST of each dump)
  const errs = []; let passed = 0; page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
  page.on('console', m => { if (m.type() !== 'error') return; const at = m.location().url || ''; if (/\/favicon\.ico$/.test(at) || /^http:\/\/localhost:5174\//.test(at)) passed++; else errs.push(`${m.text().slice(0, 400)}${at ? ` (${at})` : ''}`); });
  const url = `http://localhost:${PORT}/?${QUERY ? QUERY + '&' : ''}mute`;
  log(url);
  try {
    await page.goto(url);
    await page.evaluate(async () => { await window.__ready; window.__testVisible = true; if (window.__menu.isOpen) window.__menu.close(); });
  } catch (e) { console.log(`- FAIL — the page did not come ready — ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); await browser.close(); process.exit(1); }
  const frames = async n => page.evaluate(n => new Promise(res => { let k = 0; const f = () => (++k >= n ? res(k) : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await frames(3);
  log('ready; the loop is running');
  if (GOGGLES) { await page.evaluate(() => { const K = window.__knobs?.registry?.().IRLIGHT; if (K && 'auto' in K) K.auto = false; });   // (the stand prices the lights: they burn whenever the goggles are down here, not only where the place is too dark — game/irlight.ts IRLIGHT.auto)
    await page.keyboard.press('KeyN');
    const up = await page.evaluate(ms => new Promise(res => { const t0 = performance.now(); let k = 0; const f = () => { const L = window.__engine.lights; k++; if ((L.tube && L.irCount > 0) || performance.now() - t0 > ms) return res({ tube: !!L.tube, n: L.irCount ?? null, frames: k, nv: window.__game.player.nv }); requestAnimationFrame(f); }; requestAnimationFrame(f); }), Number(process.env.GOGGLES_WAIT || 6) * 60000);
    check(up.tube && up.n > 0, `goggles down: the picture is the tube's and the renderer takes infrared light (${JSON.stringify(up)})`);
    if (!(up.tube && up.n > 0)) { console.log('  (no infrared light to sweep on this stand: a kit without goggles, ?noirlight, or goggles that were already down — nothing further is run)'); await browser.close(); process.exit(1); } }
  const before = await page.evaluate(STATE), t0 = await page.evaluate(() => window.__game.time);
  check(await page.evaluate(() => !window.__perfsweep.active && !window.__perfrec.recording), 'nothing sweeps or records until asked');

  // 1. the key: F8 starts (the recorder with it, the world frozen), F8 again stops and puts everything back
  await page.keyboard.press('F8'); await frames(2);
  const mid = await page.evaluate(() => ({ active: window.__perfsweep.active, freezing: window.__perfsweep.freezing, rec: window.__perfrec.recording, t: window.__game.time, tag: [...document.body.children].some(e => /^SWEEP/.test(e.textContent || '')) }));
  check(mid.active && mid.rec && mid.freezing && mid.tag, `F8 starts the sweep: recorder on, world frozen, the tag up (${JSON.stringify(mid)})`);
  const tA = mid.t; await frames(2); const tB = await page.evaluate(() => window.__game.time);
  check(tA === tB, `the world holds still while it sweeps (game clock ${tA.toFixed(3)} → ${tB.toFixed(3)})`);
  await page.keyboard.press('F8'); await frames(2);
  const afterKey = await page.evaluate(STATE);
  check(await page.evaluate(() => !window.__perfsweep.active && !window.__perfrec.recording && /^stopped/.test(window.__perfsweep.last)), 'F8 again stops it and the recorder');
  check(afterKey === before, 'a stopped sweep leaves every setting, the preset and the switches as they were');
  printDiff(before, afterKey);
  await frames(3); const tC = await page.evaluate(() => window.__game.time);
  check(tC > tB, `the world goes on afterwards (game clock ${tB.toFixed(3)} → ${tC.toFixed(3)})`);

  // 1b. stopped in the MIDDLE of a flip — the preset row, the widest write there is (every row quality.apply sets): caught from inside the page on the first frame of the flip
  await page.evaluate(() => window.__perfsweep.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['preset'] }));
  const flip = await page.evaluate(() => new Promise(res => { const f = () => { const s = window.__perfsweep; if (!s.active) return res({ reached: false }); if (s.progress.startsWith('2/')) { const preset = window.__quality.current; s.stop('the check'); return res({ reached: true, preset }); } requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  await frames(1);
  const presetBefore = JSON.parse(before).preset, afterFlip = await page.evaluate(STATE);
  check(flip.reached && flip.preset !== presetBefore, `the preset row really flips the preset (${presetBefore} → ${flip.preset})`);
  check(afterFlip === before, 'stopped in the middle of that flip, every setting, the preset and the switches are back');
  printDiff(before, afterFlip);

  // 2. a whole sweep, short segments
  if (GOGGLES) await page.evaluate(() => { const seen = window.__irSeen = {}, s = window.__perfsweep; let was = '';   // (the count the renderer took, by the row the sweep says is flipped that frame; the frame a segment turns over is passed over: its upload may have run before the flip)
    const f = () => { if (window.__irSeen !== seen) return; const id = s.flipped; if (id && id === was) (seen[id] ??= []).push(window.__engine.lights.irCount); was = id; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const started = await page.evaluate(([rounds, only, settleFrames, measureFrames, live]) => window.__perfsweep.start({ rounds, settleMs: 0, measureMs: 0, settleFrames, measureFrames, live, ...(only ? { only } : {}) }), [ROUNDS, ONLY, SETTLE, MEASURE, LIVE]);
  log(started);
  const sweepT0 = Date.now(), until = sweepT0 + DEADLINE * 60000; let seen = '', moved = sweepT0, cut = '';   // cut: '' = ran to its end · 'slow' = still moving at the cap · 'dead' = no new segment in STALL min
  for (;;) { const p = await page.evaluate(() => ({ a: window.__perfsweep.active, p: window.__perfsweep.progress })); if (!p.a) break;
    if (p.p !== seen) { seen = p.p; moved = Date.now(); }
    const [at, of] = p.p.split('/').map(Number), per = (Date.now() - sweepT0) / 1000 / Math.max(1, at - 1);
    if (Date.now() - moved > STALL * 60000) { cut = 'dead'; check(false, `the sweep stopped moving: no new segment in ${STALL} min (at ${p.p}): the frame loop may have died`); }
    else if (Date.now() > until) { cut = 'slow'; check(false, `the sweep was still moving when the check's ${DEADLINE} min ran out at ${p.p}: a slow box, not a dead loop. ${at >= 3 ? `At about ${per.toFixed(0)} s a segment all ${of} want about ${Math.ceil(per * of / 60)} min here` : 'Too early in it to say how long it wants'}: raise DEADLINE, or cut rows with ONLY`); }
    if (cut) { await page.evaluate(() => window.__perfsweep.stop('the check ran out of time')); if (cut === 'slow') await frames(1); break; }   // (stopped, so what follows meets a page with no sweep on it; a dead loop draws no frame to wait for)
    log(`  ${p.p}`); await page.waitForTimeout(30000); }
  const last = await page.evaluate(() => window.__perfsweep.last);
  if (!cut) check(last === 'done', `the sweep ran to its end (${last})`);
  const after = await page.evaluate(STATE);
  check(after === before, cut ? 'stopped at the cap, the sweep leaves every setting, the preset and the switches as they were' : 'a finished sweep leaves every setting, the preset and the switches as they were');
  printDiff(before, after);
  const dump = await page.evaluate(() => JSON.stringify(window.__lastPerfDump ?? null));
  const file = path.join(OUT, 'perf-sweep-dryrun.json'); fs.writeFileSync(file, dump);
  const D = JSON.parse(dump) ?? { events: [], frames: [] }, ev = D.events.filter(e => e.kind === 'sweep').map(e => JSON.parse(e.text));
  const begin = ev.find(e => e.op === 'begin'), segs = ev.filter(e => e.op === 'seg'), end = ev.find(e => e.op === 'end');
  if (cut) log(`not finished (${segs.length} segments in the dump): the end event and the segment count are passed over`);
  else {
    check(!!begin && !!end && end.done === true, `the dump carries the sweep's begin and end events (${D.frames.length} frames, ${D.events.length} events)`);
    check(!!begin && segs.length === ROUNDS * 2 * begin.rows.length + 1, `one segment per flip and a base either side: ${segs.length} segments for ${begin ? begin.rows.length : '?'} rows × ${ROUNDS} rounds`);
  }
  if (begin) { log(`rows: ${begin.rows.map(r => r.id).join(', ')}`); if (begin.skipped.length) log(`skipped: ${begin.skipped.map(s => `${s.id} (${s.why})`).join(', ')}`); }
  if (LIVE) check(!!begin && begin.mode === 'live', `a live take: the world runs under the sweep (mode ${begin ? begin.mode : '?'})`);
  if (MUST) { const ran = begin && begin.mode === (LIVE ? 'live' : 'frozen') ? begin.rows.map(r => r.id) : [], out = MUST.filter(id => !ran.includes(id));   // (by the rows that RAN: a sweep with nothing to flip writes no dump, and the one read here is then an earlier step's)
    check(out.length === 0, out.length ? `asked for by name and not flipped: ${out.map(id => `${id} (${(begin && begin.skipped.find(s => s.id === id) || {}).why || started})`).join(', ')}` : `every row asked for by name was flipped (${MUST.join(', ')})`); }
  if (GOGGLES) { await frames(2); const ir = await page.evaluate(() => { const seen = window.__irSeen; window.__irSeen = null; const L = window.__engine.lights; return { seen, now: L.irCount, tube: L.tube, cap: L.irCap === Infinity }; });
    const ran = !cut && begin ? begin.rows : [], uniq = a => [...new Set(a)].join(','), row = id => ran.find(r => r.id === id), took = (id, n) => { const a = ir.seen[id] || []; return a.length > 0 && a.every(x => x === n); };   // (asked only of the rows this sweep ran to the end)
    if (row('irLight')) check(took('irLight', 0), `while '${row('irLight').label}' is flipped the renderer takes none (${(ir.seen.irLight || []).length} frames: ${uniq(ir.seen.irLight || [])})`);
    if (row('irLightOne')) check(took('irLightOne', 1), `while '${row('irLightOne').label}' is flipped it takes one (${(ir.seen.irLightOne || []).length} frames: ${uniq(ir.seen.irLightOne || [])})`);
    const n0 = (row('irLight') || row('irLightOne') || { from: {} }).from.irLights;
    if (!LIVE && n0) check(took('base', n0), `on every baseline frame of the frozen take it takes the ${n0} the take began with (${(ir.seen.base || []).length} frames: ${uniq(ir.seen.base || [])})`);
    check(ir.cap && ir.tube && ir.now > 0, `after the sweep the cap is off and infrared light is in the picture again (${ir.now})`); }
  check(typeof D.query === 'string', `the dump names the page's flags (${D.query}) and commit (${D.commit})`);
  check(D.smokeUnit === 512, `the dump says what its smoke count counts (smokeUnit ${D.smokeUnit}: the brick pool in 512s)`);
  // 3. the quality changed BY HAND in the middle of a flip: the sweep stops, a flipped setting no preset writes is back where it was, and the page is the one that hand change gives with no sweep near it
  const cur = JSON.parse(before).preset, other = cur === 'medium' ? 'high' : 'medium', pinned = JSON.parse(before).auto === false;   // (a page on auto has a scale and rungs of its own that pinning its preset again does not give back: only the second check is asked of it)
  let hand = null;
  for (const id of ['shadowOccl', 'audit', 'secMinE']) {   // (rows whose setting no preset writes; the first one this build and preset can flip)
    hand = await page.evaluate(([id, other]) => new Promise(res => {
      const s = window.__perfsweep, r = s.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: [id] }); if (!s.active) return res({ id, started: false, why: r });
      let pinned = false, n = 0; const f = () => { if (!s.active) return res({ id, started: true, reached: pinned, last: s.last }); if (++n > 3000) return res({ id, started: true, reached: false, last: `still sweeping after ${n} frames at ${s.progress}` });   // (never left waiting on a sweep that has stopped stepping)
        if (!pinned && s.progress.startsWith('2/')) { pinned = true; window.__quality.pin(other); } requestAnimationFrame(f); }; requestAnimationFrame(f); }), [id, other]);
    if (hand.started) break;
  }
  if (!hand.started) check(false, `no row to try a hand change on (${hand.why})`);
  else {
    await frames(1); const handState = await page.evaluate(STATE);
    await page.evaluate(c => window.__quality.pin(c), cur); await frames(1); const backState = await page.evaluate(STATE);
    await page.evaluate(o => window.__quality.pin(o), other); await frames(1); const refState = await page.evaluate(STATE);
    await page.evaluate(c => window.__quality.pin(c), cur); await frames(1);
    check(hand.reached && /^stopped: quality was changed by hand/.test(hand.last), `a hand change to ${other} in the middle of the '${hand.id}' flip stops the sweep (${hand.last})`);
    if (pinned) check(backState === before, `pinning ${cur} again gives the page as it stood before any sweep (so nothing the sweep flipped was left behind)`);
    check(handState === refState, `the page after that hand change is the page a plain change to ${other} gives`);
    if (pinned) printDiff(before, backState, 'back'); printDiff(refState, handState, 'hand');
  }
  if (errs.length) { console.log(`- FAIL — ${errs.length} page / console errors:`); errs.slice(0, 8).forEach(e => console.log(`    ${e}`)); red++; } else console.log(`- PASS — no page or console error (${passed} lines for the missing favicon / capture sink passed over)`);
  await browser.close();
  log(`dump: ${file}`);
  process.exit(red ? 1 : 0);
})();
