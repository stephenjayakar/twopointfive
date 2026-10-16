// EVERY RUN KEPT, AND HANDED OVER AS ONE FILE, ON THE REAL PAGE (src/replay/keeper.ts, keepstore.ts, dumpui.ts; tools/qa/replaykeep-probes.ts holds the same
// headless): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), one browser profile, three page loads and the replay page —
//   1. a mission page is played with no key pressed: the page's own timer files its tape in this browser's storage, piece by piece
//   2. the page is LEFT for another mission (no beat due): what was played up to the last step is there afterwards, and its row says its page has gone
//      (keeper.ts leave: the list of replays does not call it 'being played'); the second visit is kept beside it, and is marked in its turn when its page
//      goes with nothing new to file. NOT SEEN HERE: the list's own words inside the minute — on this adapter a navigation takes minutes to commit
//   3. the start page, nothing played: keeps nothing. Extras ▸ 'Hand over replays' downloads ONE file; tools/qa/replay-dump.ts unpacks it to two tapes, whole,
//      each with a run tape; pressed again there is nothing new and no second download
//   4. /replay lists both visits as handed over, and opens one
//   PORT=5311 [NAV_MS=480000] node tools/qa/replaykeep-page.cjs [outDir]      (a dev server on that port: PORT=5311 bun run tools/serve.ts; FRAMES=240 = frames a stretch of play;
//   three boots of some minutes each on the software adapter)
// exit 0 = all of it · 1 = otherwise / a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), cp = require('node:child_process');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'replaykeep-page-'));
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
let failed = false; const check = (ok, text) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); if (!ok) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms)), FR = Math.max(30, Number(process.env.FRAMES) || 240);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  // LEAVING A PAGE: the game draws a frame on every animation frame, stepped or not, and on this adapter a drawn frame is seconds of main thread — a page
  // with frames queued does not let a navigation commit for minutes (the walk died on a 240 s page load on a loaded box, a different load each time). So the
  // page being left stops drawing first and waits for what it had queued; the load itself is given NAV_MS (default 480 s) and says how long it took.
  const NAV = Math.max(60000, Number(process.env.NAV_MS) || 480000), went = [];
  const go = async (path) => {
    await page.evaluate(async () => { const e = window.__engine; if (!e) return; e.render = () => {}; try { if (window.__smoke) window.__smoke.params.enabled = false; await Promise.race([e.device.queue.onSubmittedWorkDone(), new Promise(r => setTimeout(r, 20000))]); } catch { /* */ } }).catch(() => {});
    const t0 = Date.now(); await page.goto(`http://localhost:${PORT}/${path}`, { timeout: NAV }); went.push(`${path.slice(0, 28)} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  };
  const boot = async (q) => { await go(`?${q}`); return page.evaluate(async () => { await window.__ready; return { fatal: document.getElementById('fatal')?.textContent || '', sid: window.__replay?.session, keeping: !!window.__replay?.keeper }; }); };
  /** play: frames stepped with W held (the page is ?paused, so nothing else steps it); → the buffer's step count and seconds of play */
  // (tools/qa/page-look.cjs's way: the renderer stubbed out and the smoke solver off while it plays — on this adapter a drawn squad frame takes seconds, and a
  //  page with drawn frames still queued does not let a navigation commit for minutes; `draw` then draws ONE frame for real and waits for it)
  const play = (frames) => page.evaluate(async (n) => { window.__menu.close(); window.__smoke.params.enabled = false; const e = window.__engine, real = e.render; e.render = () => {};
    try { await window.__runFrames(n, 1 / 60, ['KeyW']); } finally { e.render = real; } return { n: window.__replay.buf.n, secs: window.__game.time }; }, frames);
  const draw = () => page.evaluate(async () => { await window.__runFrames(1, 1 / 60); await window.__engine.device.queue.onSubmittedWorkDone(); });
  const kept = () => page.evaluate(async () => { const K = await window.__replay.kept(); return { visits: K.visits, fresh: K.fresh, rows: K.rows.map(r => ({ sid: r.sid, pieces: r.pieces, seconds: r.seconds, bytes: r.bytes, sent: r.sent ?? 0, scenario: r.scenario, left: r.left === true })), broke: window.__replay.keeper?.broke ?? '', stats: window.__replay.keeper ? { ...window.__replay.keeper.stats } : null }; });

  // ---- 1. a mission page, played; the page's own timer does the filing
  const A = await boot(`paused&quality=${QUALITY}&mute&roomclear&squad4`);
  check(!A.fatal && A.keeping && !!A.sid, `visit one booted and is keeping its tape (${A.sid})${A.fatal ? ' · FATAL ' + A.fatal : ''}`);
  await play(FR); await draw(); await sleep(6500); await play(FR); await sleep(6500);
  const timer = await page.evaluate(() => ({ ...window.__replay.keeper.stats }));
  check(timer.beats >= 2 && timer.pieces >= 1 && timer.failed === 0, `nothing pressed: the page's timer has filed ${timer.pieces} piece(s) in ${timer.beats} beats (${(timer.bytes / 1024).toFixed(0)} KB; a beat ${(timer.ms / Math.max(1, timer.beats)).toFixed(1)} ms, worst ${timer.worstMs.toFixed(1)})`);
  const pA = await play(Math.round(FR / 2));   // (a stretch no beat has seen: the page is left with it)

  // ---- 2. left for another mission
  const B = await boot(`paused&quality=${QUALITY}&mute&solo`);
  check(!B.fatal && B.keeping && B.sid !== A.sid, `visit two booted with a visit id of its own (${B.sid})`);
  const pB = await play(FR * 2); const K2 = await kept(), rA = K2.rows.find(r => r.sid === A.sid), rB = K2.rows.find(r => r.sid === B.sid);
  check(!!rA && rA.seconds >= pA.n / 60 - 0.4, `leaving the page lost nothing: visit one holds ${rA?.seconds} s of the ${(pA.n / 60).toFixed(1)} s stepped, in ${rA?.pieces} pieces`);
  check(!!rA && rA.left === true && !!rB && rB.left === false, `the page that was left said so as it went (visit one: left ${rA?.left}), the one being played has not (left ${rB?.left}): the list will not call visit one 'being played'`);
  check(K2.visits === 2 && !!rB && rB.pieces >= 1 && !K2.broke, `visit two is kept beside it (${K2.visits} visits, ${K2.fresh} new${K2.broke ? ' · STOPPED: ' + K2.broke : ''})`);

  // ---- 3. the start page: keeps nothing by itself; Extras ▸ Hand over replays
  await go(`?paused&quality=${QUALITY}&mute`);   // (paused: an idle start page starts its attract reel, and on this adapter a drawn frame is seconds of main thread)
  const T = await page.evaluate(async () => { await window.__ready; return { sid: window.__replay.session, fatal: document.getElementById('fatal')?.textContent || '' }; });
  // (visit two had filed everything when its page went — kept() above — so its mark is ALL that page wrote as it went: one small write asked at pagehide)
  const K3 = await kept(), gA = K3.rows.find(r => r.sid === A.sid), gB = K3.rows.find(r => r.sid === B.sid);
  check(!!gA && gA.left === true && !!gB && gB.left === true && gB.pieces === rB?.pieces, `visit two, left with nothing new to file, is marked as left all the same (left ${gB?.left}, ${gB?.pieces} pieces as before), and visit one still is`);
  await sleep(3000);
  const open = await page.evaluate(() => { const b = document.querySelector('#menu .xopen'); if (!b) return 'no Extras button'; b.click(); const row = [...document.querySelectorAll('#menu a.xrow')].find(a => /Hand over replays/.test(a.textContent)); if (!row) return 'no row'; row.setAttribute('data-qa', 'dump'); return ''; });
  check(!T.fatal && !open, `the start page's Extras has the 'Hand over replays' row${open ? ' — ' + open : ''}`);
  await sleep(1500);
  const words = await page.evaluate(() => document.querySelector('#menu a[data-qa=dump] small')?.textContent ?? '');
  check(/^2 new .*2 kept/.test(words), `the row says what is kept (${JSON.stringify(words.slice(-90))})`);
  const file = path.join(OUT, 'dump.ndjson.gz'); let name = '';
  // (the row is pressed with a click event of its own: the mouse-driven page.click first waits for the row to hold still over two animation frames, and a
  //  start page drawing its frames on this adapter gives one in twenty seconds)
  const press = () => page.evaluate(() => { document.querySelector('#menu a[data-qa=dump]').click(); });
  { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), press()]); name = dl.suggestedFilename(); await dl.saveAs(file); }
  const raw = fs.readFileSync(file), text = raw[0] === 0x1f ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8'), L = text.split('\n').filter(Boolean).map(l => JSON.parse(l));
  const sids = [...new Set(L.filter(l => l.k === 'piece').map(l => l.sid))];
  check(/^twopointsix-replays-.*-2-visits\.ndjson\.gz$/.test(name) && L[0].k === 'dump' && sids.length === 2 && sids.includes(A.sid) && sids.includes(B.sid) && !sids.includes(T.sid), `one click, one file (${name}, ${(raw.length / 1024).toFixed(0)} KB): both played visits, not the start page's`);
  await sleep(1500);
  const after = await page.evaluate(() => document.querySelector('#menu a[data-qa=dump] small')?.textContent ?? '');
  check(/^Downloaded 2 visits/.test(after), `the row says what it did (${JSON.stringify(after.slice(0, 80))})`);
  let again = false; page.once('download', () => { again = true; }); await press(); await sleep(2500);
  const none = await page.evaluate(() => document.querySelector('#menu a[data-qa=dump] small')?.textContent ?? '');
  check(!again && /Nothing new/.test(none), `pressed again: nothing new, no second file (${JSON.stringify(none.slice(0, 80))})`);
  // the reader, end to end, on what the page made
  const un = path.join(OUT, 'unpacked'), rd = cp.spawnSync('bun', ['run', path.join(ROOT, 'tools/qa/replay-dump.ts'), file, '--out', un, '--quiet'], { encoding: 'utf8' });
  const IX = fs.existsSync(path.join(un, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(un, 'index.json'), 'utf8')) : { entries: {} }, es = Object.values(IX.entries);
  check(rd.status === 0 && es.length === 2 && es.every(e => !e.missing.length && /^\d+ steps$/.test(e.tape)), `tools/qa/replay-dump.ts unpacks it to two whole tapes, each with its run tape (${es.map(e => `${e.scenario} ${e.seconds} s, ${e.tape}`).join(' · ')})${rd.status ? '\n' + (rd.stdout + rd.stderr).slice(-600) : ''}`);
  const eA = IX.entries[A.sid]; check(!!eA && Math.abs(eA.n1 - pA.n) <= 3, `visit one's tape reaches its last step (${eA?.n1} of ${pA.n})`);

  // ---- 4. the replay page
  await go('replay.html'); await sleep(2500);
  const V = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#keptList .row')].map(r => r.textContent), line: document.getElementById('keptLine')?.textContent ?? '', dis: document.getElementById('dumpNew')?.disabled }));
  check(V.rows.length === 2 && V.rows.every(t => /handed over/.test(t)) && V.dis === true, `/replay lists both visits as handed over, 'what is new' greyed (${JSON.stringify(V.line.slice(0, 90))})`);
  await page.click('#keptList .row'); await sleep(2500);
  const O = await page.evaluate(() => { const f = window.__viewer?.file; return f ? { secs: f.seconds, why: f.why, session: f.session, samples: f.samples.length } : null; });
  check(!!O && O.samples > 20 && (O.session === A.sid || O.session === B.sid), `a kept visit opens in the viewer (${O ? `${O.secs} s, ${O.samples} samples` : 'nothing opened'})`);

  check(!errors.length, `no page or console error${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''}`);
  await browser.close();
  console.log(`(page loads: ${went.join(' · ')})`);
  console.log(failed ? '=== replaykeep-page: FAILED ===' : '=== replaykeep-page: ALL PASS ===');
  console.log(`(files: ${OUT})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
