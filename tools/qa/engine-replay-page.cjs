// THE ENGINE REPLAY ON THE REAL PAGE (src/replay/engineplay.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), muted.
//   PORT=5243 node tools/qa/engine-replay-page.cjs [outDir]        (a dev server on that port: PORT=5243 bun run tools/serve.ts)
//   record  a four-man room clear played for a quarter of a minute by scripted input (walk, rounds, a can, an order), saved to this browser's shelf as F7 would
//   play    /?playtape=<its id>: the page is sent to the tape's own query, stands, and walks the tape to its end — every man where the trace had him, no sensor
//           read the tape did not make; the sounds the mixer was asked for while it played are the recording's own, name for name in order
//   note    a note typed there is on the shelf row, and the 2D viewer (replay.html) lists it
//   file    the same replay opened as a FILE (the shelf's copy served back): plays the same
//   cam     the picture's camera taken off the player's view (a drag, a right drag, the wheel, W A S D, `__tape.cam`) with the tape standing and playing: the
//           picture is the viewer's, the run is still the recording's; C / the bar's 'Player view' gives it back; a seek backwards (a page load) keeps it
//   refuse  a replay with no run tape says so and boots the game as itself
//   fog     the bar's 'Fog' (F, `__tape.fog`) takes the fog of war off the picture for each draw and hands the step's lists back; Ctrl + the mouse turns the
//           view; a seek back keeps the fog off; the run drawn so is still the recording's
//   nv      the bar's 'NV' (V, `__tape.nv`) puts the night vision tube on or off the PICTURE (the run's own goggles as played until it is pressed; pressed back
//           to what the run has = as played again); the player's goggles are never written; a seek back keeps it; the run drawn so is still the recording's
//   map     the bar's line marked from the trace and dragged to scrub; the corner map drawn from the running game, opened large (click, M), a click on it
//           sends the picture's camera to that floor point; the run still the recording's
//   slow    the bar's pace (− · the reading · +, the keys - and +): slow motion is the recording's own steps fed more slowly — the game's clock a quarter
//           as fast at ¼× — kept over a seek back, and the run slowed and sped on the way ends as recorded
//   between under 1× the picture is drawn BETWEEN the tape's last two steps (host/tween.ts): at ¼× a step lasts four frames and every frame is further along,
//           the men the lifted fog shows too; paused it stands where it is; a script's steps, 1× and faster draw the step itself; played so and then to
//           its end the run is still the recording's
//   open    the page with no `paused`, as a person opens it: it stands on the tape's first step, the men drawn, and plays on as recorded
// exit 0 = all of it with no page error · 1 = otherwise. ONLY=record,play,… runs fewer; FILE=<path to a replay .json[.gz]> walks that file instead of recording
// one (its drift is REPORTED, not judged: a tape of another build may part).
// A QUIET SECTION IS NOT A HUNG ONE. On the software adapter a drawn frame is most of a minute and a page load several, and a section draws dozens of frames
// inside ONE page.evaluate that prints nothing until it returns (nv alone: half an hour on a four-core box). So every BEAT_S (default 120) the tool says
// where the page is: the section, the tape's step, the engine's count of frames drawn. A reading that has not moved in STALL_MIN (default 30; 0 = wait for ever)
// is a FAIL that names the section and ends the run (exit 1); a slower box raises the word. NAV_MS (default 480000) is what one page load is given (the
// default STALL_MIN is never under NAV_MS + 15 minutes: a page may take NAV_MS to load and ten minutes more to stand).
// PROBE=1 (with an outDir) also writes probe-rec.json / probe-play.json: per step the aim point, Sam's place and yaws, the first item in the air, the cursor
// and the view matrix, as the recording made them and as the player did — diff the two to find the first thing that parts.
// A SCRIPTED STEP HERE IS NOT DRAWN, BUT THE WORLD IS PACKED (e.world.upload): the cursor's ray reads the box list as last packed, so a recording made with
// no pack at all would not be the game a drawn page plays.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', FILE = process.env.FILE || '';
const NAV = Math.max(60000, Number(process.env.NAV_MS) || 480000), BEAT = Math.max(5, Number(process.env.BEAT_S) || 120) * 1000, STALL = process.env.STALL_MIN === undefined ? Math.max(30 * 60000, NAV + 900000) : Math.max(0, Number(process.env.STALL_MIN) || 0) * 60000;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'];
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });   // ONE context: the shelf (IndexedDB) is shared by the pages
  let loads = 0; ctx.on('page', p => p.on('framenavigated', f => { if (f === p.mainFrame()) loads++; }));   // (in the beat's reading: `stay` is seven loads back to back, each the same 'not standing yet')
  let section = 'record', cur = null, asked = '', read = '', since = Date.now(); const clock = () => new Date().toISOString().slice(11, 19);
  const say = (r, moved = true) => { const now = `${section}: ${r}`; if (moved && now !== read) { read = now; since = Date.now(); } console.log(`    … ${clock()} ${now}`);   // (a page that has not answered has not moved, whatever the line says)
    if (STALL && Date.now() - since >= STALL) { console.log(`- FAIL — the ${section} section stood still for ${Math.round((Date.now() - since) / 60000)} minutes (STALL_MIN)\n    ${r}\n\n=== engine-replay-page: FAILED ===`); process.exit(1); } };
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (url, wait = true) => {
    const page = await ctx.newPage(); const errors = [], t0 = Date.now(); cur = page;
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    // the sounds the mixer is ASKED for, by name, whatever the mute does (wrapped at the mixer's own door once the page stands)
    await page.goto(`http://localhost:${PORT}/${url}`, { timeout: NAV });
    if (wait) { await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio, null, { timeout: 600000 });
      const fatal = await page.evaluate(async (probe) => { await window.__ready; window.__testVisible = true;
        const a = window.__audio, heard = window.__heard = [], play = a.play.bind(a), step = a.footstep?.bind(a);
        const at = () => '@' + (window.__game?.time ?? 0).toFixed(2); a.play = (name, ...r) => { heard.push(name + at()); return play(name, ...r); }; if (step) a.footstep = (...r) => { heard.push('step' + at()); return step(...r); };
        if (probe) { const g = window.__game, u = g.update.bind(g), P = window.__probe = [], r = v => v == null ? null : Array.from(v, x => +(+x).toFixed(5));
          g.update = (...x) => { const o = u(...x), pl = g.player, c = pl.char; P.push([+g.time.toFixed(4), r(g.aimPoint), r(c.pos), +c.bodyYaw.toFixed(5), +c.aimYaw.toFixed(5), g.items.items?.length ?? -1, r(g.items.items?.[0]?.pos), r(g.items.items?.[0]?.vel), pl.pendingThrow ? r(pl.pendingThrow.sol.v0) : null, r([x[1].mouseX ?? -1, x[1].mouseY ?? -1, x[3]?.clientWidth ?? -1, x[3]?.clientHeight ?? -1]), r(x[2].viewProj)]); return o; }; }
        return document.getElementById('fatal')?.textContent || ''; }, !!process.env.PROBE);
      if (fatal) errors.push('fatal: ' + fatal); }
    console.log(`    (${clock()} ${section}: the page stood in ${Math.round((Date.now() - t0) / 1000)} s)`);
    return { page, errors };
  };
  const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 180000 }).catch(e => console.log('    (no still: ' + String(e).slice(0, 80) + ')')); };
  const want = n => { const ok = !process.env.ONLY || process.env.ONLY.split(',').includes(n); if (ok) section = n; return ok; };
  const beat = setInterval(() => {
    if (asked) { say(`the page has not answered since ${asked} (inside a step or a draw)`, false); return; } const p = cur; if (!p || p.isClosed()) { say('no page open', false); return; }
    asked = clock(); p.evaluate(() => { const s = window.__tape?.state, g = window.__game;
      return `${location.pathname}${location.hash}${s ? ` · step ${s.f} of ${s.ticks}` : g ? ` · game time ${(+g.time).toFixed(2)}` : ' · not standing yet'}${typeof window.__engine?.frameIdx === 'number' ? ` · frame ${window.__engine.frameIdx}` : ''}`; })
      .catch(() => 'between two loads').then(r => { asked = ''; say(`load ${loads} · ${r}`); });
  }, BEAT); beat.unref();
  let id = null, rec = null;

  // ── record
  if (FILE) {   // (served to the page as a file beside it: nothing is put on the shelf until a note is typed)
    const buf = fs.readFileSync(FILE), gz = buf[0] === 0x1f && buf[1] === 0x8b;
    await ctx.route('**/qa-file.bin', r => r.fulfill({ contentType: gz ? 'application/gzip' : 'application/json', body: buf })); id = 'qa-file.bin';
    console.log(`- file ${path.basename(FILE)} (${(buf.length / 1024).toFixed(0)} KB${gz ? ', gzipped' : ''})`);
  } else if (want('record')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&seed=7&nocutboxes`);
    rec = await page.evaluate(async () => {
      const g = window.__game, e = window.__engine, view = document.getElementById('view'); window.__smoke.params.enabled = false;
      const quick = (n, keys) => { const real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const real = async n => { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60); await e.device.queue.onSubmittedWorkDone(); await tick(); } };
      window.__cam.rebuild();   // (a ?paused page has drawn nothing yet: the camera's matrices are built before the first step, as on a page that has shown its card)
      const press = k => { window.__input.pressed.add(k); quick(1); };
      window.__mouse(view.clientWidth * 0.7, view.clientHeight * 0.4);
      quick(40); quick(90, ['KeyW']); await real(2);                       // walk; two drawn frames so the light meter answers
      press('Digit2'); quick(50); window.__click(0); quick(12); window.__click(0); quick(30);   // the rifle, two rounds
      press('KeyB'); quick(90, ['KeyD']);                                  // the quick order, a walk
      press('Digit4'); quick(50); window.__click(0); quick(200);           // a stun canister, its bang
      press('KeyR'); quick(160); await real(1); quick(120, ['KeyS']);      // a reload, a walk back
      const f = window.__replay.file('check'), id = await window.__replay.save('check');
      return { id, ticks: f?.rerun?.ticks ?? null, dead: f?.rerun?.dead ?? null, search: f?.rerun?.recipe?.search ?? null, samples: f?.samples?.length ?? 0, probe: window.__probe ?? null, heard: window.__heard.slice(), pos: [...g.player.char.pos].map(v => +v.toFixed(3)), scn: window.__scenarios?.current?.()?.id ?? null }; });
    id = rec.id; if (rec.probe && OUT) fs.writeFileSync(path.join(OUT, 'probe-rec.json'), JSON.stringify(rec.probe));
    const kinds = [...new Set(rec.heard.map(n => n.split('@')[0]))];
    line(id !== null && rec.ticks > 800 && !rec.dead && kinds.length >= 4 && !errors.length, 'a played quarter minute is on the shelf with its run tape', `id ${id} · ${rec.ticks} steps · ${rec.samples} samples · ${rec.heard.length} sounds asked (${kinds.slice(0, 14).join(' ')}) · tape query ${rec.search}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  // ── stay: every way between the game, the replay and the map viewer keeps to THE ONE WINDOW (the maintainer, 10-15: "replays should just play in the current
  //    window, not open a new tab"), and the replay bar's '‹ Game' is the way back: one step back in the history when the replay is the next entry after the
  //    game, the address he left when it is not (a hop to the map and back between them). It makes its own short run: ONLY=stay needs no other section
  if (want('stay') && !FILE) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&seed=7&nocutboxes`);
    // (THIS PAGE's alone — the context's would hold the `open` section's page paused too. A replay page reached by these roads is not `paused` — the card's road drops that word, the map's link never had it — and a software adapter draws a
    // running page too slowly to click through: the word is put back on its address before the page's own script reads it. The walk is of the WINDOW, not the play)
    await page.addInitScript(() => { try { if (/[?&]playtape=/.test(location.search) && !/[?&]paused(&|=|$)/.test(location.search)) history.replaceState(history.state, '', location.pathname + location.search + '&paused' + location.hash); } catch { /* */ } });
    let tabs = 0; ctx.on('page', () => { tabs++; }); const home = page.url(), at = [], SLOW = { timeout: 600000 };   // (a real click, hit-tested: the replay page is not `paused` — the card's road drops that word — and a software adapter draws it slowly)
    const play = () => page.evaluate(() => { const e = window.__engine, real = e.render; window.__smoke.params.enabled = false; e.render = () => { e.world.upload(); }; try { window.__runFrames(60, 1 / 60, ['KeyW']); } finally { e.render = real; } });
    const to = async (name, re, act, ready) => { let ok = true; await Promise.all([page.waitForURL(re, { timeout: 600000 }), act()]).catch(e => { ok = false; at.push(`${name}: ${String(e).slice(0, 120)}`); });
      if (ok && ready) ok = await page.waitForFunction(ready, null, { timeout: 600000 }).then(() => true).catch(() => false); at.push(`${name} → ${page.url().replace(/^https?:\/\/[^/]+/, '')}${ok ? '' : ' (NOT READY)'}`); return ok; };
    const tape = () => !!window.__tape && !!document.querySelector('#tapebar'), game = () => !!window.__game && !window.__tape && !!window.__replay, map = () => { const a = document.getElementById('engine'); return !!a && !a.hidden && !!a.href; };
    const isHome = u => u.href === home, isTape = u => u.pathname.replace(/index\.html$/, '') === new URL(home).pathname.replace(/index\.html$/, '') && u.searchParams.has('playtape') && u.searchParams.has('roomclear'), isMap = u => /\/replay(\.html)?$/.test(u.pathname) && /^#id=\d+$/.test(u.hash);
    await play();
    // the end card's press → the replay, here; '‹ Game' → the game's address, one step back
    const a1 = await to('the card', isTape, () => page.evaluate(() => { window.__replay.view('card'); }), tape);
    const bar = a1 ? await page.evaluate(() => [...document.querySelectorAll('#tapebar button, #tapebar a')].map(b => b.textContent)) : [];
    const len1 = a1 ? await page.evaluate(() => history.length) : -1;
    const a2 = a1 && await to('‹ Game', isHome, () => page.click('#tapebar button:has-text("Game")', SLOW), game);
    const back = a2 ? await page.evaluate(async () => { await window.__ready; return { nav: performance.getEntriesByType('navigation')[0]?.type ?? '?', len: history.length, mark: sessionStorage.getItem('twopointsix.replay.from'), fatal: document.getElementById('fatal')?.textContent || '' }; }) : null;
    // Shift+F7's road → the map viewer, here; 'Play in engine' → the replay, here; 'Map' → the map, here; and '‹ Game' from a replay that is not the next entry
    if (a2) await play();
    const b0 = a2 && await to('the key', isMap, () => page.evaluate(() => { window.__replay.view('key'); }), map);
    // the map's own '‹ Game': the game's entry again (not the title page), then Shift+F7's road once more
    const c1 = b0 && await to('the map’s ‹ Game, pressed twice', isHome, () => page.click('#back', { ...SLOW, clickCount: 2 }), game);   // (two presses are one going: the second does not fall to the title page)
    const mapBack = c1 ? await page.evaluate(async () => { await window.__ready; return performance.getEntriesByType('navigation')[0]?.type ?? '?'; }) : '?';
    if (c1) await play();
    const b1 = c1 && await to('the key', isMap, () => page.evaluate(() => { window.__replay.view('key'); }), map);
    const b2 = b1 && await to('Play in engine', isTape, () => page.click('#engine', SLOW), tape);
    const b3 = b2 && await to('Map', isMap, () => page.click('#tapebar a:has-text("Map")', SLOW), map);
    const b4 = b3 && await to('Play in engine', isTape, () => page.click('#engine', SLOW), tape);
    // (…and with the game's entry gone from the history — the mark's slot is one this window does not hold — the address left)
    if (b4) await page.evaluate(() => { const k = 'twopointsix.replay.from', m = JSON.parse(sessionStorage.getItem(k) || 'null'); if (m) { m.key = 'no-such-slot'; sessionStorage.setItem(k, JSON.stringify(m)); } });
    const b5 = b4 && await to('‹ Game', isHome, () => page.click('#tapebar button:has-text("Game")', SLOW), game);
    const end = b5 ? await page.evaluate(async () => { await window.__ready; return { nav: performance.getEntriesByType('navigation')[0]?.type ?? '?', mark: sessionStorage.getItem('twopointsix.replay.from'), fatal: document.getElementById('fatal')?.textContent || '' }; }) : { fatal: '?' };
    line(a1 && a2 && b1 && b2 && b3 && b4 && b5 && tabs === 0 && ctx.pages().length === 1 && bar[0] === '‹ Game' && bar.includes('Map') && !back.fatal && back.nav === 'back_forward' && back.len === len1 && back.mark === null && mapBack === 'back_forward' && end.nav === 'navigate' && end.mark === null && !end.fatal && !errors.length,
      'the card, Shift+F7, Play in engine and Map all move the one window, no tab is opened, and ‹ Game on the bar and on the map goes back to the game: to the game\'s own entry of the history, and by the address left when that entry is gone',
      `${at.join(' · ')} · tabs opened ${tabs}, pages ${ctx.pages().length} · the bar: ${bar.join(' | ')} · history at the replay ${len1}, back at the game ${JSON.stringify(back)} · from the map: ${mapBack} · with the entry gone ${JSON.stringify(end)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  if (id === null) { const lone = process.env.ONLY === 'stay';   // (that section alone records nothing for the others)
    console.log(!lone ? 'nothing to play' : failed ? '\n=== engine-replay-page: FAILED ===' : '\n=== engine-replay-page: ALL PASS ==='); await browser.close(); process.exit(lone && !failed ? 0 : 1); }

  const walk = async (page) => page.evaluate(async () => {
    const e = window.__engine, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    const T = window.__tape; if (!T) return { why: 'no __tape on the page', search: location.search };
    // (120 steps, then a frame really drawn: the steps between are packed by the player itself, the last by the draw — both roads a played replay takes)
    let s = T.state, n = 0;
    while (!s.ended && n++ < 4000) { s = T.run(120, true); await e.device.queue.onSubmittedWorkDone(); await tick(); }
    T.run(0, true); await e.device.queue.onSubmittedWorkDone();
    return { state: T.state, probe: window.__probe ?? null, heard: window.__heard.slice(), pos: [...window.__game.player.char.pos].map(v => +v.toFixed(3)), search: location.search, bar: (document.getElementById('tapebar')?.textContent || '').replace(/\s+/g, ' '), big: !!document.getElementById('tapebig') }; });

  // ── play
  let fileText = '';
  if (want('play')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const R = await walk(page); await shot(page, 'engine-replay-end'); if (R.probe && OUT) fs.writeFileSync(path.join(OUT, 'probe-play.json'), JSON.stringify(R.probe));
    const s = R.state || {}, same = rec?.heard ? JSON.stringify(rec.heard) === JSON.stringify(R.heard) : null, at = rec?.pos ? Math.hypot(R.pos[0] - rec.pos[0], R.pos[2] - rec.pos[2]) : null;
    const detail = `${s.f} of ${s.ticks} steps · held against ${s.compared} samples · worst ${s.worst ? s.worst.metres.toFixed(3) + ' m (' + s.worst.who + ', step ' + s.worst.f + ')' : '—'} · parted ${s.drift ? 'at step ' + s.drift.f + ' (' + s.drift.who + ' ' + (+s.drift.metres).toFixed(2) + ' m)' : 'never'} · ${s.unjournaled} reads the tape never made · level ${s.fp} · sounds ${R.heard?.length}${same === null ? '' : same ? ' = the recording’s, in order' : ' ≠ the recording’s ' + rec.heard.length + (() => { const a = rec.heard, b = R.heard; let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return ` (first apart at ${i}: recorded … ${a.slice(Math.max(0, i - 2), i + 8).join(' ')} · played … ${b.slice(Math.max(0, i - 2), i + 8).join(' ')})`; })()}${at === null ? '' : ' · Sam ends ' + at.toFixed(3) + ' m from where the recording left him'} · bar "${R.bar}" · page ${R.search}${R.why ? ' · ' + R.why : ''}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`;
    if (FILE) console.log(`- REPORT — the file walked in the engine\n    ${detail}`);
    else line(s.ended && s.f === s.ticks && s.compared > 100 && !s.drift && s.unjournaled === 0 && same === true && at < 0.01 && /as recorded/.test(R.bar || '') && !errors.length, 'the replay plays to its end in the engine as recorded', detail);
    if (FILE && (errors.length || !s.ended)) failed = true;

    // ── note
    if (want('note')) {
      const N = await page.evaluate(async () => { const n = await window.__tape.note('too thin — the bang', [12.5, 9.25]); await window.__tape.note('to be deleted', null); const row = document.querySelectorAll('#tapebar .tk').length; return { n, row, id: window.__tape.state.id }; });
      const { page: v, errors: ve } = await open(`replay#id=${N.id}`, false);
      await v.waitForFunction(() => /too thin/.test(document.body.innerText || '') || [...document.querySelectorAll('input,textarea')].some(x => /too thin/.test(x.value || '')), null, { timeout: 60000 }).catch(() => { });
      const seen = await v.evaluate(() => /too thin/.test(document.body.innerText || '') || [...document.querySelectorAll('input,textarea')].some(x => /too thin/.test(x.value || '')));
      await shot(v, 'engine-replay-note-in-map');
      line(!!N.n && N.row >= 1 && seen && !ve.length, 'a note left in the engine replay is in the map viewer', `note ${JSON.stringify(N.n)} · ticks on the bar ${N.row} · the 2D viewer shows it: ${seen}${ve.length ? ' · ERRORS ' + ve.join(' | ') : ''}`);
      // a second note typed in the map viewer's tab, after the engine page read the shelf: Save's file has to carry it too
      await v.click('#addNote', { timeout: 60000 }).catch(() => { }); await v.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA', null, { timeout: 30000 }).catch(() => { });
      await v.keyboard.type('from the map tab'); await v.keyboard.press('Enter'); await v.waitForTimeout(600);
      // … and one of the engine page's own notes deleted there: Save's file must not bring it back
      await v.evaluate(() => { const el = [...document.querySelectorAll('#notes .note')].find(x => /to be deleted/.test(x.querySelector('textarea').value)); if (el) el.querySelector('.top i').click(); }); await v.waitForTimeout(1500);
      await v.close(); cur = page;
      // Save on the bar: the replay leaves the page as one file with every note in it — the one typed here, the one typed in the map tab, and words still in the
      // note box when the button is pressed (what a person drops in a thread). Clicked as a person clicks it; the button says it went.
      await page.bringToFront(); await page.keyboard.press('n'); await page.waitForFunction(() => { const b = document.getElementById('tapenote'); return b && !b.hidden; }, null, { timeout: 30000 }).catch(() => { }); await page.keyboard.type('still in the box');
      await page.evaluate(() => { const b = document.querySelector('#tapebar .save'); window.__saved = false; new MutationObserver(() => { if (/Saved/.test(b.textContent)) window.__saved = true; }).observe(b, { childList: true, characterData: true, subtree: true }); });
      const got = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#tapebar .save', { timeout: 120000 })]).then(x => x[0]).catch(() => null);
      const S = { name: got ? got.suggestedFilename() : '', has: [], same: false, said: false, box: null };
      S.said = await page.waitForFunction(() => window.__saved, null, { timeout: 30000 }).then(() => true).catch(() => false);
      if (got) { try { let buf = fs.readFileSync(await got.path()); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = require('zlib').gunzipSync(buf); const f = JSON.parse(buf.toString('utf8'));
        const mine = await page.evaluate(() => { const f = window.__tape.file; return { samples: f.samples.length, savedAt: f.savedAt, ticks: f.rerun ? f.rerun.ticks : -1, notes: f.notes.length }; });
        S.has = ['too thin', 'from the map tab', 'still in the box', 'to be deleted'].map(w => f.notes.filter(n => n.text.includes(w)).length); S.same = f.samples.length === mine.samples && f.savedAt === mine.savedAt && (f.rerun ? f.rerun.ticks : -1) === mine.ticks && f.notes.length === mine.notes; } catch (e) { S.name += ' (unread: ' + String(e).slice(0, 80) + ')'; } }
      S.box = await page.evaluate(() => { const b = document.getElementById('tapenote'); return !!b && !b.hidden; });
      line(!!got && /^twopointsix-replay-.*-\d+notes\.json(\.gz)?$/.test(S.name) && S.has.join() === '1,1,1,0' && S.same && S.said && !S.box && !errors.length, 'Save on the bar hands the replay over as one file with every note in it',
        `${S.name || 'no download'} · notes in it [typed here, typed in the map tab, still in the box, deleted in the map tab]: ${S.has.join(' ') || 'unread'} · the same recording: ${S.same} · the button said Saved: ${S.said} · the note box shut: ${!S.box}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    }
    fileText = await page.evaluate(() => JSON.stringify(window.__tape?.file ?? null)).catch(() => '');
    await page.close();
  }

  // ── file: the same replay served as a file (the copy the play page holds, its note in it)
  if (want('file') && !FILE && fileText) {
    await ctx.route('**/qa-tape.json', r => r.fulfill({ contentType: 'application/json', body: fileText }));
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=qa-tape.json`);
    const R = await walk(page), s = R.state || {};
    line(s.ended && !s.drift && s.unjournaled === 0 && s.id === id && s.notes >= (want('note') ? 1 : 0) && !errors.length, 'the same replay opened as a file plays the same and is found on the shelf', `${s.f} of ${s.ticks} · parted ${s.drift ? 'at ' + s.drift.f : 'never'} · shelf row ${s.id} (want ${id}) · its notes ${s.notes}${R.why ? ' · ' + R.why : ''}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  // ── cam: the picture's camera taken off the player's view (drag, turn, wheel, W A S D, a script's pose) while the tape stands and while it plays —
  //    the picture follows the viewer, the run is the same run (the simulation is handed the tape's camera whatever the picture shows), and 'Player view' / C gives it back.
  //    A seek backwards is a page load: the camera is kept across it.
  if (want('cam')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const A = await page.evaluate(async () => {
      const T = window.__tape, e = window.__engine, cam = window.__cam, cv = document.getElementById('view'); if (!T) return { why: 'no __tape on the page' };
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const drawn = async () => { T.run(0, true); await e.device.queue.onSubmittedWorkDone(); await tick(); };
      const pose = () => ({ look: [...cam.target], yaw: cam.yaw, pitch: cam.pitch, dist: cam.distance }), far = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
      const btn = () => [...document.querySelectorAll('#tapebar button')].find(b => b.textContent === 'Player view'), shown = () => { const b = btn(); return !!b && !b.classList.contains('on'); };   // (the switch is always on the bar: lit = the picture is the player's view, unlit = it offers the way back)
      const noteUp = () => { const n = document.getElementById('tapenote'); return !!n && !n.hidden; };
      const r = cv.getBoundingClientRect(), cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.55;
      const pe = (type, x, y, button, o) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, clientX: x, clientY: y, button, buttons: type === 'pointerup' ? 0 : button === 2 ? 2 : 1, bubbles: true, cancelable: true, ...(o || {}) }));
      const click = (x, y) => cv.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }));
      const key = (type, code, target) => (target || window).dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
      const out = {};
      T.run(120, true); await drawn(); const p0 = pose(); out.before = { free: T.state.free, button: shown() };
      // a left drag: the floor under the cursor comes with it, and the click that ends it is no note
      const g0 = cam.groundPoint((cx - r.left) / r.width, (cy - r.top) / r.height, p0.look[1]);
      pe('pointerdown', cx, cy, 0); pe('pointermove', cx + 60, cy + 30, 0); pe('pointermove', cx + 140, cy + 70, 0); pe('pointerup', cx + 140, cy + 70, 0); click(cx + 140, cy + 70);
      await drawn(); const p1 = pose(), g1 = cam.groundPoint((cx + 140 - r.left) / r.width, (cy + 70 - r.top) / r.height, p0.look[1]);
      out.drag = { free: T.state.free, button: shown(), moved: +far(p1.look, p0.look).toFixed(3), slip: g0 && g1 ? +far(g0, g1).toFixed(3) : null, turned: +Math.abs(p1.yaw - p0.yaw).toFixed(4), note: noteUp(), f: T.state.f };
      // a right drag turns and tilts about the point it looks at; the wheel zooms
      pe('pointerdown', cx, cy, 2); pe('pointermove', cx + 100, cy - 40, 2); pe('pointerup', cx + 100, cy - 40, 2);
      await drawn(); const p2 = pose();
      cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true })); await drawn(); const p3 = pose();
      out.turn = { yaw: +(p2.yaw - p1.yaw).toFixed(4), pitch: +(p2.pitch - p1.pitch).toFixed(4), look: +far(p2.look, p1.look).toFixed(4), zoom: +(p3.dist / p2.dist).toFixed(4) };
      // W A S D slide it on the wall's clock while the tape stands
      const f0 = T.state.f; key('keydown', 'KeyD'); window.__runFrames(10, 1 / 60); key('keyup', 'KeyD'); await e.device.queue.onSubmittedWorkDone(); await tick(); const p4 = pose();
      window.__runFrames(5, 1 / 60); await e.device.queue.onSubmittedWorkDone(); await tick(); const p4b = pose();
      out.fly = { moved: +far(p4.look, p3.look).toFixed(3), want: +(p3.dist * 0.6 * 10 / 60).toFixed(3), after: +far(p4b.look, p4.look).toFixed(4), steps: T.state.f - f0 };
      // a click that did not travel is still a note at that spot
      pe('pointerdown', cx, cy, 0); pe('pointerup', cx, cy, 0); click(cx, cy); const up = noteUp(); const field = document.querySelector('#tapenote input'); if (field) key('keydown', 'Escape', field);
      out.click = { note: up, shut: !noteUp(), free: T.state.free };
      // C = the player's view again; the bar's button does the same
      key('keydown', 'KeyC'); await drawn(); const p5 = pose(), v5 = T.view;
      out.back = { free: T.state.free, button: shown(), onTape: far(p5.look, v5.look) < 1e-6 && Math.abs(p5.yaw - v5.yaw) < 1e-9 && Math.abs(p5.dist - v5.dist) < 1e-9 };
      T.cam({ yaw: 1.1, dist: 30 }); const follow = T.view; T.run(60, true); await drawn(); const p6 = pose(), v6 = T.view;
      out.follow = { free: T.state.free, yaw: +p6.yaw.toFixed(3), dist: +p6.dist.toFixed(2), withTape: far(p6.look, v6.look) < 1e-6, went: +far(v6.look, follow.look).toFixed(3) };
      btn().click(); out.button = { free: T.state.free, button: shown() };
      // set down far from the player, then a seek backwards (a page load)
      out.set = T.cam({ look: [p0.look[0] + 6, p0.look[1], p0.look[2] - 4], yaw: -0.8, pitch: 0.7, dist: 26 }); out.f = T.state.f;
      return out; });
    let B = { why: 'the first half did not run' };
    if (!A.why) {
      const nav = page.waitForNavigation({ timeout: NAV }).catch(e => console.log('    (no page load on the seek back: ' + String(e).slice(0, 120) + ')'));
      await page.evaluate(() => { setTimeout(() => window.__tape.seek(60), 0); }); await nav;
      await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape, null, { timeout: 600000 });
      B = await page.evaluate(async (rec) => {
        await window.__ready; window.__testVisible = true;
        const a = window.__audio, heard = window.__heard = [], play = a.play.bind(a), step = a.footstep?.bind(a), at = () => '@' + (window.__game?.time ?? 0).toFixed(2);
        a.play = (name, ...r) => { heard.push(name + at()); return play(name, ...r); }; if (step) a.footstep = (...r) => { heard.push('step' + at()); return step(...r); };
        const T = window.__tape, e = window.__engine, cam = window.__cam;
        const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        let n = 0; const E = window.__engine, drawIt = E.render; E.render = () => { E.world.upload(); };   // (the seek's frames PACKED, not drawn: see `map`)
        try { while ((T.state.seeking || T.state.f < 60) && n++ < 4000) { window.__runFrames(1, 1 / 60); await tick(); } } finally { E.render = drawIt; }
        const kept = { free: T.state.free, f: T.state.f, view: T.view, search: location.search };
        // the rest of the run with the camera thrown about, drawn every 120 steps: the picture is the viewer's, the run the recording's
        let s = T.state, k = 0, off = 0, worst = 0; const base = T.view.look;
        while (!s.ended && k++ < 4000) {
          const m = k % 4; if (m === 3) T.cam(null); else T.cam({ look: [base[0] + 5 * Math.cos(k), base[1], base[2] + 5 * Math.sin(k * 1.7)], yaw: k * 0.9, pitch: 0.3 + 0.25 * m, dist: 8 + 9 * m });
          s = T.run(120, true); await e.device.queue.onSubmittedWorkDone(); await tick();
          const v = T.view, d = Math.hypot(cam.target[0] - v.look[0], cam.target[2] - v.look[2]) + Math.abs(cam.yaw - v.yaw) + Math.abs(cam.distance - v.dist); if (m !== 3 && T.state.free !== true) off++;
          // (the picture is one frame behind `view` only in the look-at the tape moved since: yaw and distance are the viewer's exactly)
          if (Math.abs(cam.yaw - v.yaw) + Math.abs(cam.distance - v.dist) > 1e-9) off++; worst = Math.max(worst, d);
        }
        T.cam({ yaw: 2, dist: 40 }); T.run(0, true); await e.device.queue.onSubmittedWorkDone();
        return { kept, state: T.state, off, worst: +worst.toFixed(3), heard: heard.slice(), pos: [...window.__game.player.char.pos].map(v => +v.toFixed(3)), bar: (document.getElementById('tapebar')?.textContent || '').replace(/\s+/g, ' '), fatal: document.getElementById('fatal')?.textContent || '' }; }, null);
      await shot(page, 'engine-replay-free-camera');
    }
    const s = B.state || {}, K = B.kept || {}, near = (a, b, eps) => a != null && b != null && Math.abs(a - b) <= eps;
    // (the sounds from step 60 on are the recording's from that moment: its list is cut at the first one stamped at or after the game time of step 60 — compared by tail)
    const tail = rec?.heard && B.heard ? rec.heard.slice(rec.heard.length - B.heard.length) : null, same = tail ? JSON.stringify(tail) === JSON.stringify(B.heard) : null;
    const at = rec?.pos && B.pos ? Math.hypot(B.pos[0] - rec.pos[0], B.pos[2] - rec.pos[2]) : null;
    const hands = !A.why && A.before && !A.before.free && !A.before.button
      && A.drag.free && A.drag.button && A.drag.moved > 0.3 && A.drag.slip !== null && A.drag.slip < 0.05 && A.drag.turned === 0 && !A.drag.note
      && near(A.turn.yaw, 0.6, 1e-3) && near(A.turn.pitch, -0.2, 1e-3) && A.turn.look === 0 && near(A.turn.zoom, Math.exp(0.36), 1e-3)
      && near(A.fly.moved, A.fly.want, 0.02) && A.fly.after === 0 && A.fly.steps === 0
      && A.click.note && A.click.shut && !A.back.free && !A.back.button && A.back.onTape
      && A.follow.free && near(A.follow.yaw, 1.1, 1e-3) && near(A.follow.dist, 30, 1e-3) && A.follow.withTape && !A.button.free && !A.button.button;
    const keptOk = K.free === true && K.f >= 60 && K.view && near(K.view.yaw, -0.8, 1e-9) && near(K.view.dist, 26, 1e-9) && near(K.view.look[0], A.set?.look?.[0], 1e-9) && /at=60/.test(K.search || '');
    // (FILE=…: a tape of another build may part — its drift is reported above by the play section, not judged; the picture obeying the viewer still is)
    const runOk = s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && B.off === 0 && !B.fatal && (same === null || same === true) && (at === null || at < 0.01);
    line(hands && !errors.length, 'the picture’s camera comes off the player’s view by drag, right drag, wheel and W A S D while the tape stands, and goes back on C or the bar’s button', A.why ? A.why : `drag ${JSON.stringify(A.drag)} · turn ${JSON.stringify(A.turn)} · slide ${JSON.stringify(A.fly)} · plain click ${JSON.stringify(A.click)} · C ${JSON.stringify(A.back)} · turned only, it follows ${JSON.stringify(A.follow)} · button ${JSON.stringify(A.button)}`);
    line(keptOk && runOk && !errors.length, 'a seek back keeps the camera where it was put, and the run under a thrown camera is the recording’s', B.why ? B.why : `after the page load: free ${K.free} at step ${K.f}, view ${JSON.stringify(K.view)} (set ${JSON.stringify(A.set)}) · ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at step ' + s.drift.f + ' (' + s.drift.who + ' ' + (+s.drift.metres).toFixed(2) + ' m)' : 'never'} · ${s.unjournaled} reads the tape never made · picture off the viewer’s pose on ${B.off} frames · sounds from step 60 ${B.heard?.length}${same === null ? '' : same ? ' = the recording’s tail, in order' : ' ≠ the recording’s tail'}${at === null ? '' : ' · Sam ends ' + at.toFixed(3) + ' m from where the recording left him'} · bar "${B.bar}"${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  // ── fog: the bar's 'Fog' (F) takes the fog of war off the PICTURE — everybody drawn, nobody hidden to the HUD, no fog pass — for each draw only (Game.fogLift /
  //    fogBack): between draws the game is as the step left it and the run is still the recording's. Ctrl + the mouse turns the view as it does in play (no tilt).
  if (want('fog')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const prep = () => { const e = window.__engine, g = window.__game, fw = g.fogOfWar, R = window.__seen = [], render = e.render.bind(e);
      window.__thin = () => { const a = e.world.dynamics, b = g.dynBoxes; if (a === b) return 0; if (a.length !== b.length) return -1; let n = 0;   // (how the list a draw is handed differs from the step's own: 0 the same boxes · n > 0 the same list with n laser lines / tracers re-made for the picture's pixel, thinline.ts thinFit: width and light only · -1 another list)
        for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x === y) continue; for (const k in x) if (k !== 'h' && k !== 'dh' && k !== 'emissive' && x[k] !== y[k]) return -1; n++; } return n; };
      const px = () => +(g.viewPx(window.__cam, document.getElementById('view')) / g.mPerPx).toFixed(3);
      e.render = (...a) => { R.push({ on: fw.frame.on, bared: fw.bared, hid: g.guards.filter(x => fw.hidden(x)).length, n: e.world.dynamics.length, own: e.world.dynamics === g.dynBoxes, thin: window.__thin(), px: px() }); return render(...a); }; };
    const A = await page.evaluate(async (prepSrc) => {
      const T = window.__tape, e = window.__engine, g = window.__game, cam = window.__cam, cv = document.getElementById('view'); if (!T || typeof T.fog !== 'function') return { why: 'no __tape.fog on the page' };
      (0, eval)('(' + prepSrc + ')')(); const R = window.__seen, fw = g.fogOfWar;
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const drawn = async () => { T.run(0, true); await e.device.queue.onSubmittedWorkDone(); await tick(); return R[R.length - 1]; };
      const btn = () => [...document.querySelectorAll('#tapebar button')].find(b => b.textContent === 'Fog'), look = () => { const b = btn(); return { shown: !!b && getComputedStyle(b).display !== 'none', off: !!b && b.classList.contains('off'), title: b?.title }; };
      const now = () => ({ on: fw.frame.on, bared: fw.bared, hid: g.guards.filter(x => fw.hidden(x)).length, n: e.world.dynamics.length, own: e.world.dynamics === g.dynBoxes });
      const out = {}; T.run(180, true);
      out.as = { fog: T.state.fog, active: fw.active, viewer: fw.viewer, btn: look(), draw: await drawn(), after: now() };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true }));
      out.lifted = { fog: T.state.fog, btn: look(), draw: await drawn(), after: now(), f: T.state.f };
      btn().click(); out.back = { fog: T.state.fog, btn: look(), draw: await drawn() };
      out.api = { off: T.fog(false), fog: T.state.fog };
      // Ctrl + the mouse: moved with no button, then dragged — a turn at play's rate, no tilt; the camera is the viewer's from then on
      const r = cv.getBoundingClientRect(), cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.55, p0 = { yaw: cam.yaw, pitch: cam.pitch };
      const pe = (type, x, y, o) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true, ctrlKey: true, ...(o || {}) }));
      pe('pointermove', cx + 50, cy, { buttons: 0, movementX: 50, movementY: 9 }); await drawn(); const p1 = { yaw: cam.yaw, pitch: cam.pitch, free: T.state.free };
      pe('pointermove', cx + 80, cy, { buttons: 0, movementX: 30, ctrlKey: false }); await drawn(); const p1b = { yaw: cam.yaw };
      pe('pointerdown', cx, cy); pe('pointermove', cx + 100, cy + 40); pe('pointerup', cx + 100, cy + 40, { buttons: 0 });
      cv.dispatchEvent(new MouseEvent('click', { clientX: cx + 100, clientY: cy + 40, button: 0, ctrlKey: true, bubbles: true, cancelable: true }));
      await drawn(); const p2 = { yaw: cam.yaw, pitch: cam.pitch }, n = document.getElementById('tapenote');
      out.ctrl = { move: +(p1.yaw - p0.yaw).toFixed(4), tilt: +(p1.pitch - p0.pitch).toFixed(4), free: p1.free, plain: +(p1b.yaw - p1.yaw).toFixed(4), drag: +(p2.yaw - p1b.yaw).toFixed(4), dragTilt: +(p2.pitch - p1.pitch).toFixed(4), note: !!n && !n.hidden, f: T.state.f };
      return out; }, prep.toString());
    let B = { why: 'the first half did not run' };
    if (!A.why) {
      await shot(page, 'engine-replay-nofog');
      const nav = page.waitForNavigation({ timeout: NAV }).catch(e => console.log('    (no page load on the seek back: ' + String(e).slice(0, 120) + ')'));
      await page.evaluate(() => { setTimeout(() => window.__tape.seek(60), 0); }); await nav;
      await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape, null, { timeout: 600000 });
      B = await page.evaluate(async (prepSrc) => {
        await window.__ready; window.__testVisible = true; (0, eval)('(' + prepSrc + ')')();
        const T = window.__tape, e = window.__engine, g = window.__game, R = window.__seen, fw = g.fogOfWar;
        const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        let n = 0; const E = window.__engine, drawIt = E.render; E.render = () => { E.world.upload(); };   // (the seek's frames PACKED, not drawn: see `map`)
        try { while ((T.state.seeking || T.state.f < 60) && n++ < 4000) { window.__runFrames(1, 1 / 60); await tick(); } } finally { E.render = drawIt; }
        const kept = { fog: T.state.fog, off: [...document.querySelectorAll('#tapebar button')].find(b => b.textContent === 'Fog')?.classList.contains('off') };
        // the rest of the run drawn every 40 steps, the fog off the picture two draws in three: the run is the recording's
        let s = T.state, k = 0, bad = 0, lifts = 0, hidMax = 0, longer = 0; R.length = 0;
        while (!s.ended && k++ < 6000) { const lift = k % 3 !== 0; T.fog(!lift); 
          s = T.run(40, true); await e.device.queue.onSubmittedWorkDone(); await tick();
          const d = R[R.length - 1]; if (!d) { bad++; continue; }
          const hid = g.guards.filter(x => fw.hidden(x)).length; hidMax = Math.max(hidMax, hid);   // (asked between two steps: the run's own answer)
          if (lift && fw.active) { lifts++; if (d.on || !d.bared || d.hid || d.own) bad++; if (d.n > e.world.dynamics.length) longer++; } else if (d.bared || !(d.own || d.thin > 0)) bad++;   // (as played: the step's own list, or that list with its thin lines re-fit to this picture)
          if (fw.bared || e.world.dynamics !== g.dynBoxes || fw.frame.on !== fw.active) bad++; }
        return { kept, state: T.state, bad, lifts, hidMax, longer, draws: R.length, pos: [...g.player.char.pos].map(v => +v.toFixed(3)), fatal: document.getElementById('fatal')?.textContent || '' }; }, prep.toString());
    }
    const L = A.lifted || {}, s = B.state || {}, near = (a, b, eps) => a != null && b != null && Math.abs(a - b) <= eps;
    const asOk = !A.why && A.as.fog === true && A.as.active && A.as.viewer && A.as.btn.shown && !A.as.btn.off && A.as.btn.title === 'F' && A.as.draw.on && !A.as.draw.bared && (A.as.draw.own || A.as.draw.thin > 0);
    const liftOk = asOk && L.fog === false && L.btn.off && !L.draw.on && L.draw.bared && A.as.after.hid > 0 && L.draw.hid === 0 && !L.draw.own && L.draw.n > A.as.draw.n
      && L.after.on && !L.after.bared && L.after.own && L.after.hid === A.as.after.hid && L.after.n === A.as.after.n && L.f === 180
      && A.back.fog === true && !A.back.btn.off && A.back.draw.on && !A.back.draw.bared && A.api.off === false && A.api.fog === false;
    const ctrlOk = !A.why && near(A.ctrl.move, 0.3, 1e-3) && A.ctrl.tilt === 0 && A.ctrl.free === true && A.ctrl.plain === 0 && near(A.ctrl.drag, 0.6, 1e-3) && A.ctrl.dragTilt === 0 && !A.ctrl.note && A.ctrl.f === 180;
    const at = rec?.pos && B.pos ? Math.hypot(B.pos[0] - rec.pos[0], B.pos[2] - rec.pos[2]) : null;
    const runOk = !B.why && B.kept.fog === false && B.kept.off === true && s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && B.bad === 0 && B.lifts > 0 && B.hidMax > 0 && B.longer > 0 && !B.fatal && (at === null || at < 0.01);
    line(liftOk && !errors.length, 'the bar’s Fog (F) takes the fog of war off the picture and its HUD for the draw, and the game between draws is as the step left it', A.why ? A.why : `as played ${JSON.stringify(A.as)} · lifted ${JSON.stringify(L)} · the button again ${JSON.stringify(A.back)} · __tape.fog(false) ${JSON.stringify(A.api)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    line(ctrlOk && !errors.length, 'Ctrl + the mouse turns the view, moved or dragged, at play’s rate and with no tilt; the tape stands', A.why ? A.why : JSON.stringify(A.ctrl));
    line(runOk && !errors.length, 'a seek back keeps the fog off, and the run drawn without the fog is the recording’s', B.why ? B.why : `after the page load: fog ${B.kept.fog}, button struck ${B.kept.off} · ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at step ' + s.drift.f + ' (' + s.drift.who + ' ' + (+s.drift.metres).toFixed(2) + ' m)' : 'never'} · ${s.unjournaled} reads the tape never made · ${B.draws} draws, ${B.lifts} without the fog, up to ${B.hidMax} men hidden under it, the lifted list longer on ${B.longer} · wrong on ${B.bad}${at === null ? '' : ' · Sam ends ' + at.toFixed(3) + ' m from where the recording left him'}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  // ── nv: the bar's 'NV' (V) is the VIEWER's tube — the picture's intensifier and the infrared lines only (Game.fogLift's second argument); the run's goggles
  //    (Player.nv / nvAmount, which the squad's own night vision rules read) are never written, so the run is still the recording's.
  if (want('nv')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const prep = () => { const e = window.__engine, g = window.__game, R = window.__seen = [], render = e.render.bind(e);
      window.__thin = () => { const a = e.world.dynamics, b = g.dynBoxes; if (a === b) return 0; if (a.length !== b.length) return -1; let n = 0;   // (how the list a draw is handed differs from the step's own: 0 the same boxes · n > 0 the same list with n laser lines / tracers re-made for the picture's pixel, thinline.ts thinFit: width and light only · -1 another list)
        for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x === y) continue; for (const k in x) if (k !== 'h' && k !== 'dh' && k !== 'emissive' && x[k] !== y[k]) return -1; n++; } return n; };
      const px = () => +(g.viewPx(window.__cam, document.getElementById('view')) / g.mPerPx).toFixed(3);
      e.render = (...a) => { R.push({ k: +e.settings.nvAmount.toFixed(3), n: e.world.dynamics.length, own: e.world.dynamics === g.dynBoxes, thin: window.__thin(), px: px() }); return render(...a); }; };
    const A = await page.evaluate(async (prepSrc) => {
      const T = window.__tape, e = window.__engine, g = window.__game; if (!T || typeof T.nv !== 'function') return { why: 'no __tape.nv on the page' };
      (0, eval)('(' + prepSrc + ')')(); const R = window.__seen, pl = g.player;
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const drawn = async (n = 0) => { T.run(n, true); await e.device.queue.onSubmittedWorkDone(); await tick(); return R[R.length - 1]; };
      const settle = async () => { let d; for (let i = 0; i < 8; i++) d = await drawn(6); return d; };   // (the tube eases over drawn time: 48 steps of it)
      const btn = () => [...document.querySelectorAll('#tapebar button')].find(b => b.textContent === 'NV'), look = () => { const b = btn(); return { shown: !!b && getComputedStyle(b).display !== 'none', on: !!b && b.classList.contains('on'), title: b?.title }; };
      const now = () => ({ nv: T.state.nv, tube: T.state.tube, run: pl.nv, runK: +pl.nvAmount.toFixed(3), btn: look() });
      const out = {}; T.run(180, true);
      out.as = { ...now(), draw: await drawn() };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true, cancelable: true }));
      out.on = { ...now(), draw: await settle() };
      btn().click(); out.back = { ...now(), draw: await settle() };
      out.api = { off: T.nv(false), held: T.state.nv, asPlayed: T.nv(null), nv: T.state.nv, on: T.nv(true), kept: T.state.nv, f: T.state.f };
      return out; }, prep.toString());
    let B = { why: 'the first half did not run' };
    if (!A.why) {
      await shot(page, 'engine-replay-nv');
      const nav = page.waitForNavigation({ timeout: NAV }).catch(e => console.log('    (no page load on the seek back: ' + String(e).slice(0, 120) + ')'));
      await page.evaluate(() => { setTimeout(() => window.__tape.seek(60), 0); }); await nav;
      await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape, null, { timeout: 600000 });
      B = await page.evaluate(async (prepSrc) => {
        await window.__ready; window.__testVisible = true; (0, eval)('(' + prepSrc + ')')();
        const T = window.__tape, e = window.__engine, g = window.__game, R = window.__seen, pl = g.player;
        const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        let n = 0; const E = window.__engine, drawIt = E.render; E.render = () => { E.world.upload(); };   // (the seek's frames PACKED, not drawn: see `map`)
        try { while ((T.state.seeking || T.state.f < 60) && n++ < 4000) { window.__runFrames(1, 1 / 60); await tick(); } } finally { E.render = drawIt; }
        T.run(0, true); const kept = { nv: T.state.nv, tube: T.state.tube, k: R[R.length - 1]?.k, on: [...document.querySelectorAll('#tapebar button')].find(b => b.textContent === 'NV')?.classList.contains('on') };
        // the rest of the run drawn every 40 steps, the viewer's tube on, off and as played in turn: the run is the recording's
        let s = T.state, k = 0, bad = 0, more = 0, fewer = 0, wrote = 0; R.length = 0;
        while (!s.ended && k++ < 6000) { const w = k % 3 === 0 ? null : k % 3 === 1; T.nv(w);
          s = T.run(40, true); await e.device.queue.onSubmittedWorkDone(); await tick();
          const d = R[R.length - 1]; if (!d) { bad++; continue; }
          if (pl.nv || pl.nvAmount > 0.01) wrote++;   // (the recording's Sam never puts his goggles down: any tube on him is the viewer's hand)
          if (d.n > g.dynBoxes.length) more++; if (d.n < g.dynBoxes.length) fewer++;
          if (e.world.dynamics !== g.dynBoxes) bad++; }
        return { kept, state: T.state, bad, more, fewer, wrote, draws: R.length, pos: [...g.player.char.pos].map(v => +v.toFixed(3)), fatal: document.getElementById('fatal')?.textContent || '' }; }, prep.toString());
    }
    const s = B.state || {}, at = rec?.pos && B.pos ? Math.hypot(B.pos[0] - rec.pos[0], B.pos[2] - rec.pos[2]) : null;
    const asOk = !A.why && A.as.nv === null && A.as.tube === A.as.run && A.as.btn.shown && A.as.btn.on === A.as.run && A.as.btn.title === 'V' && A.as.draw.k === A.as.runK && (A.as.draw.own || A.as.draw.thin > 0);
    const onOk = asOk && !A.as.run && A.on.nv === true && A.on.tube === true && A.on.btn.on && A.on.draw.k > 0.95 && A.on.run === false && A.on.runK === A.as.runK
      && A.back.nv === null && A.back.tube === false && !A.back.btn.on && A.back.draw.k === A.back.runK && (A.back.draw.own || A.back.draw.thin > 0)
      && A.api.off === false && A.api.held === false && A.api.asPlayed === false && A.api.nv === null && A.api.on === true && A.api.kept === true;
    const runOk = !B.why && B.kept.nv === true && B.kept.tube === true && B.kept.k === 1 && B.kept.on === true && s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && B.bad === 0 && (FILE || (B.wrote === 0 && B.fewer === 0)) && !B.fatal && (at === null || at < 0.01);
    line((FILE ? asOk : onOk) && !errors.length, 'the bar’s NV (V) puts the tube on the picture and takes it off, as played until pressed, and the run’s own goggles are not written', A.why ? A.why : `as played ${JSON.stringify(A.as)} · V ${JSON.stringify(A.on)} · the button again ${JSON.stringify(A.back)} · __tape.nv ${JSON.stringify(A.api)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    line(runOk && !errors.length, 'a seek back keeps the viewer’s tube, and the run drawn with it on, off and as played is the recording’s', B.why ? B.why : `after the page load: nv ${B.kept.nv}, tube ${B.kept.tube} at ${B.kept.k}, button lit ${B.kept.on} · ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at step ' + s.drift.f + ' (' + s.drift.who + ' ' + (+s.drift.metres).toFixed(2) + ' m)' : 'never'} · ${s.unjournaled} reads the tape never made · ${B.draws} draws, infrared lines added on ${B.more} · the player’s goggles written on ${B.wrote} · wrong on ${B.bad}${at === null ? '' : ' · Sam ends ' + at.toFixed(3) + ' m from where the recording left him'}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  // ── map: the bar's line is a timeline (the trace's rounds and orders marked on it, dragged to scrub — the seek is made when the button comes up) and the corner
  //    holds a map of the game as it plays here, which opens large on a click or M; a click on the large one sends the picture's camera to that spot of the floor.
  //    None of it reaches the run: the men end where the recording has them.
  if (want('map')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const M = await page.evaluate(async () => {
      const T = window.__tape, e = window.__engine, g = window.__game; if (!T) return { why: 'no __tape on the page' };
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const drawn = async () => { T.run(0, true); await e.device.queue.onSubmittedWorkDone(); await tick(); };
      const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
      T.run(120, true); await drawn();
      const mini = document.getElementById('tapemap'), modal = document.getElementById('tapemapbig'), large = modal && modal.querySelector('canvas'), bar = document.querySelector('#tapebar .line'), marks = bar && bar.querySelector('canvas'), ghost = bar && bar.querySelector('.ghost');
      if (!mini || !modal || !large || !bar || !marks || !ghost) return { why: `missing: ${[!mini && 'map', !modal && 'large map', !bar && 'line', !marks && 'marks', !ghost && 'ghost'].filter(Boolean).join(', ')}` };
      const ink = (cv, over = 8) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > over) n++; return n; };
      // (minimap.ts mapFit, said again: where a floor point lands on a map canvas of this CSS size)
      const b = T.file.map.bounds, fit = (cv, pad) => { const W = cv.clientWidth, H = cv.clientHeight, w = Math.max(1, b[2] - b[0]), h = Math.max(1, b[3] - b[1]), k = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h); return { k, ox: W / 2 - (b[0] + b[2]) / 2 * k, oy: H / 2 - (b[1] + b[3]) / 2 * k, W }; };
      const px = (cv, pad, x, z) => { const f = fit(cv, pad), q = cv.width / f.W, d = cv.getContext('2d').getImageData(Math.round((f.ox + x * f.k) * q) - 2, Math.round((f.oy + z * f.k) * q) - 2, 5, 5).data; let best = [0, 0, 0, 0]; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > best[0] + best[1] + best[2]) best = [d[i], d[i + 1], d[i + 2], d[i + 3]]; return best; };   // (the palest of a small patch: a name drawn across the very centre must not turn the check)
      const out = {}, pl = g.player.char.pos;
      out.mini = { w: mini.clientWidth, h: mini.clientHeight, ink: ink(mini), sam: px(mini, 6, pl[0], pl[2]), open: T.state.map, top: (() => { const m = mini.getBoundingClientRect(); return document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2) === mini; })(), right: Math.round(innerWidth - mini.getBoundingClientRect().right), overBar: Math.round(document.getElementById('tapebar').getBoundingClientRect().top - mini.getBoundingClientRect().bottom), fromTop: Math.round(mini.getBoundingClientRect().top),
        clear: (() => { const m = mini.getBoundingClientRect(); return ['sndl', 'equip', 'meters', 'lcol'].every(id => { const e = document.getElementById(id); if (!e) return true; const r = e.getBoundingClientRect(); return !r.width || !r.height || r.right <= m.left || r.left >= m.right || r.bottom <= m.top || r.top >= m.bottom; }); })() };   // (the corner map is in the TOP corner: clear of the bar, of the sound lanes that stand on it and of the game's own HUD)
      // nothing of the viewer is see-through over the game, and the HUD keeps room for the sound lanes only while they are on the page
      const solid = el => !!el && /^rgb\(/.test(getComputedStyle(el).backgroundColor), mt = document.getElementById('meters'), mr = mt && mt.getBoundingClientRect();
      out.alone = { lanes: !!document.getElementById('sndl'), cls: document.body.classList.contains('sndl'), reserved: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sndl-h')) || 0,
        gap: mr && mr.height ? Math.round(document.getElementById('tapebar').getBoundingClientRect().top - mr.bottom) : null, solid: { bar: solid(document.getElementById('tapebar')), map: solid(mini) } };
      // the line: marks from the trace, a ghost under the pointer
      const r = bar.getBoundingClientRect(), pe = (type, k, buttons) => bar.dispatchEvent(new PointerEvent(type, { pointerId: 7, isPrimary: true, clientX: r.left + r.width * k, clientY: r.top + r.height / 2, button: 0, buttons, bubbles: true, cancelable: true }));
      out.line = { ink: ink(marks, 120), rounds: T.file.events.length, orders: T.file.lines.filter(l => l.k === 'order').length };
      pe('pointermove', 0.5, 0); out.line.ghost = !ghost.hidden && !!ghost.dataset.t; out.line.at = ghost.dataset.t; bar.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 7 })); out.line.gone = ghost.hidden;
      // the map large: a click, then M and Esc
      mini.click(); await drawn(); out.big = { open: T.state.map, shown: !modal.hidden, ink: ink(large), sam: px(large, 26, pl[0], pl[2]) }; out.alone.solid.modal = solid(modal); out.alone.solid.large = solid(large);
      // (a MouseEvent's clientX / clientY are whole pixels to the page: the click is put ON a pixel and the floor point asked for is the one under it — at 18.5 px a metre
      //  a fraction of a pixel lost is up to 7 cm, more than the 5 cm this line allows)
      const aim = [pl[0] + 3, pl[2] - 2], f = fit(large, 26), lr = large.getBoundingClientRect();
      const cx = Math.round(lr.left + large.clientLeft + f.ox + aim[0] * f.k), cy = Math.round(lr.top + large.clientTop + f.oy + aim[1] * f.k);
      const at = [(cx - lr.left - large.clientLeft - f.ox) / f.k, (cy - lr.top - large.clientTop - f.oy) / f.k];
      large.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, button: 0, bubbles: true, cancelable: true })); await drawn();
      const v = T.view; out.sent = { k: +f.k.toFixed(2), off: Math.hypot(v.look[0] - at[0], v.look[2] - at[1]), free: T.state.free, open: T.state.map, pin: Math.hypot(window.__cam.target[0] - at[0], window.__cam.target[2] - at[1]) };
      key('KeyM'); const m1 = T.state.map; key('Escape'); const m2 = T.state.map; key('KeyM'); modal.click(); out.keys = { m: m1, esc: m2, backdrop: T.state.map }; key('KeyC');
      // a drag along the line: nothing moves until the button comes up, then the run is taken there
      const f0 = T.state.f, to = Math.min(0.95, Math.max(0.62, f0 / T.state.ticks + 0.2)); pe('pointerdown', 0.5, 1); pe('pointermove', to, 1); const held = { f: T.state.f, seeking: T.state.seeking, ghost: !ghost.hidden }; pe('pointerup', to, 0);
      const asked = T.state.seeking; let n = 0; const E = window.__engine, drawIt = E.render; E.render = () => { E.world.upload(); };
      // (A SEEK'S FRAMES ARE PACKED HERE, NOT DRAWN. The page steps a seek for 14 ms a frame — engineplay.ts SEEK_MS — which on a box with no GPU is two or
      //  three steps (measured: this scrub's 407 steps took 158 frames), and a drawn frame there is most of a minute: twenty-odd of them for a seek back,
      //  some 160 for this scrub. That was the tool's long silence. `frames` in the detail is the count.)
      try { while (T.state.seeking && n++ < 4000) { window.__runFrames(1, 1 / 60); await tick(); } } finally { E.render = drawIt; }
      out.scrub = { from: f0, to, held, asked, frames: n, f: T.state.f, share: T.state.f / T.state.ticks, ghost: !ghost.hidden };
      await drawn(); out.after = px(mini, 6, g.player.char.pos[0], g.player.char.pos[2]);
      let s = T.state; n = 0; while (!s.ended && n++ < 4000) { s = T.run(120, true); await e.device.queue.onSubmittedWorkDone(); await tick(); }
      out.state = T.state; out.pos = [...g.player.char.pos].map(x => +x.toFixed(3)); return out; });
    if (!M.why) await shot(page, 'engine-replay-map');
    const pale = c => !!c && c[3] > 200 && c[0] > 200 && c[1] > 200 && c[2] > 200, s = M.state || {};
    const mapOk = !M.why && M.mini.ink > 400 && pale(M.mini.sam) && !M.mini.open && M.mini.top && M.mini.right >= 0 && M.mini.right < 40 && M.mini.overBar >= 0 && M.mini.fromTop >= 0 && M.mini.fromTop < 40 && M.mini.clear
      && M.big.open && M.big.shown && M.big.ink > 2000 && pale(M.big.sam) && M.sent.off < 0.05 && M.sent.pin < 0.05 && M.sent.free === true && M.sent.open === false
      && M.keys.m === true && M.keys.esc === false && M.keys.backdrop === false;
    const A = M.alone || { solid: {} }, aloneOk = !M.why && A.solid.bar && A.solid.map && A.solid.modal && A.solid.large && (A.gap === null || Math.abs(A.gap - 16 - A.reserved) <= 1) && (A.lanes || (!A.reserved && !A.cls));
    const lineOk = !M.why && (M.line.rounds + M.line.orders === 0 || M.line.ink > 0) && M.line.ghost && M.line.gone
      && M.scrub.held.f === M.scrub.from && !M.scrub.held.seeking && M.scrub.held.ghost && M.scrub.asked && (FILE || Math.abs(M.scrub.share - M.scrub.to) < 0.02) && !M.scrub.ghost && pale(M.after);
    const at = rec?.pos && M.pos ? Math.hypot(M.pos[0] - rec.pos[0], M.pos[2] - rec.pos[2]) : null;
    const runOk = s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && (at === null || at < 0.01);
    line(mapOk && !errors.length, 'a map of the game as it plays sits in the corner, opens large on a click or M, and a click on the large one sends the camera there', M.why ? M.why : `corner ${JSON.stringify(M.mini)} · large ${JSON.stringify(M.big)} · sent ${JSON.stringify(M.sent)} · keys ${JSON.stringify(M.keys)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    line(aloneOk, 'nothing of the viewer is see-through over the game, and no room is kept for sound lanes that are not on the page', M.why ? M.why : JSON.stringify(A));
    line(lineOk && runOk && !errors.length, 'the bar’s line carries the trace’s marks and is dragged to scrub, and the run scrubbed is still the recording’s', M.why ? M.why : `line ${JSON.stringify(M.line)} · scrub ${JSON.stringify(M.scrub)} · the player’s dot after ${JSON.stringify(M.after)} · ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at ' + s.drift.f : 'never'} · unjournaled ${s.unjournaled}${at === null ? '' : ` · ended ${at.toFixed(3)} m from the recording’s end`}`);
    await page.close();
  }

  // ── slow: the bar's pace (− · what it is now · +, the keys - and +). Slow motion is the recording's own steps fed more slowly: the game's clock moves a
  //    quarter as fast at ¼×, the pace is kept over a seek back (a page load), and a run slowed and sped on the way still ends as the recording did.
  if (want('slow')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const paced = () => { const T = window.__tape, E = window.__engine, g = window.__game, pace = document.querySelector('#tapebar .pace'), b = pace ? [...pace.querySelectorAll('button')] : [];
      const look = () => ({ speed: T.state.speed, read: b[1]?.textContent, lit: !!b[1]?.classList.contains('on'), slowEnd: !!b[0]?.classList.contains('end'), fastEnd: !!b[2]?.classList.contains('end') });
      // (frames PACKED, not drawn — see `map` — at a sixtieth of a second each: what the pace feeds is read off the game's own clock)
      const fed = n => { const drawIt = E.render, f0 = T.state.f, t0 = g.time; E.render = () => { E.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { E.render = drawIt; } return { frames: n, steps: T.state.f - f0, game: +(g.time - t0).toFixed(4) }; };
      return { T, b, look, fed, key: (key, code) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })) }; };
    const A = await page.evaluate(`(() => { const { T, b, look, fed, key } = (${paced})(); if (!T || typeof T.speed !== 'function') return { why: 'no __tape.speed on the page' }; if (b.length !== 3) return { why: 'no pace group on the bar' };
      const out = { first: look() }; b[0].click(); out.half = look(); b[0].click(); out.quarter = look(); b[0].click(); out.floor = look();
      T.play(); out.q = fed(240);
      // (the keys by the character typed: = and + where this keyboard has them, then a + that sits where this keyboard has its minus, and a minus on another key still: two other keyboards)
      key('=', 'Equal'); key('+', 'Equal'); key('=', 'Equal'); key('+', 'NumpadAdd'); key('+', 'Minus'); out.four = look(); out.x4 = fed(30);
      key('-', 'Slash'); out.two = look(); b[1].focus(); b[1].click(); out.one = look(); out.x1 = fed(60);
      T.pause(); out.off = T.speed(3); b[0].focus(); b[0].click(); out.keep = look(); out.focus = b.includes(document.activeElement); out.state = T.state; return out; })()`);
    let B = {};
    if (!A.why) {
      const nav = page.waitForNavigation({ timeout: NAV }).catch(e => console.log('    (no page load on the seek back: ' + String(e).slice(0, 120) + ')'));
      await page.evaluate(() => { setTimeout(() => window.__tape.seek(60), 0); }); await nav;
      await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio && !!window.__tape, null, { timeout: 600000 });
      B = await page.evaluate(`(async () => { await window.__ready; window.__testVisible = true; window.__heard = window.__heard || []; const { T, look, fed } = (${paced})();
        const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        let n = 0; const E = window.__engine, drawIt = E.render; E.render = () => { E.world.upload(); };
        try { while ((T.state.seeking || T.state.f < 60) && n++ < 4000) { window.__runFrames(1, 1 / 60); await tick(); } } finally { E.render = drawIt; }
        const out = { kept: look(), f: T.state.f, search: location.search }; T.play(); out.h = fed(60); T.pause(); T.run(0, true); await E.device.queue.onSubmittedWorkDone(); return out; })()`);
      await shot(page, 'engine-replay-slow');
    }
    const R = A.why ? {} : await walk(page), s = R.state || {}, at = rec?.pos && R.pos ? Math.hypot(R.pos[0] - rec.pos[0], R.pos[2] - rec.pos[2]) : null;
    const is = (l, speed, read, lit, slowEnd, fastEnd) => !!l && l.speed === speed && l.read === read && l.lit === lit && l.slowEnd === slowEnd && l.fastEnd === fastEnd;
    const near = (r, speed) => !!r && (FILE ? r.steps > 0 : Math.abs(r.game - r.frames / 60 * speed) <= 0.035 && Math.abs(r.steps - r.frames * speed) <= 1);   // (a file's steps are whatever its page ran at, and whether it parts is reported, not judged)
    const barOk = !A.why && is(A.first, 1, '1×', false, false, false) && is(A.half, 0.5, '½×', true, false, false) && is(A.quarter, 0.25, '¼×', true, true, false) && is(A.floor, 0.25, '¼×', true, true, false)
      && is(A.four, 4, '4×', true, false, true) && is(A.two, 2, '2×', true, false, false) && is(A.one, 1, '1×', false, false, false) && A.off === 1 && is(A.keep, 0.5, '½×', true, false, false) && A.focus === false;
    const paceOk = !A.why && near(A.q, 0.25) && near(A.x4, 4) && near(A.x1, 1) && (FILE || (!A.state.drift && A.state.unjournaled === 0)) && /[?&]at=60(&|$)/.test(B.search || '') && B.f >= 60 && B.f < A.state.f && is(B.kept, 0.5, '½×', true, false, false) && near(B.h, 0.5);
    const runOk = s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && (at === null || at < 0.01);
    line(barOk && !errors.length, 'the bar’s pace steps from ¼× to 4× by its − and + and the keys, holds at the ends, and a click on the reading is 1× again', A.why ? A.why : `${['first', 'half', 'quarter', 'floor', 'four', 'two', 'one', 'keep'].map(k => `${k} ${JSON.stringify(A[k])}`).join(' · ')} · a pace off the list asked: ${A.off} · a pressed button still holds the keyboard: ${A.focus}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    line(paceOk && runOk && !errors.length, 'slow motion feeds the recording’s own steps more slowly, the pace is kept over a seek back, and the run slowed and sped on the way is still the recording’s', A.why ? A.why : `¼× ${JSON.stringify(A.q)} · 4× ${JSON.stringify(A.x4)} · 1× ${JSON.stringify(A.x1)} · after the seek back (from step ${A.state.f}) the page ${B.search} stands on step ${B.f}: ${JSON.stringify(B.kept)} · ½× ${JSON.stringify(B.h)} · ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at ' + s.drift.f : 'never'} · unjournaled ${s.unjournaled}${at === null ? '' : ` · ended ${at.toFixed(3)} m from the recording’s end`}`);
    await page.close();
  }

  // ── refuse: no run tape
  // ── between: under 1× the picture is drawn BETWEEN the tape's last two steps (engineplay.ts slowBlend, host/tween.ts). Most frames here pack the world and draw nothing (the software adapter's draw is most of a minute); what the blend hung on the
  //    drawn things is read where the render would read it. Two frames are drawn for real.
  if (want('between')) {
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=${id}`);
    const A = await page.evaluate(async () => {
      const T = window.__tape, e = window.__engine, g = window.__game, FS = window.__fixedstep; if (!T || typeof T.speed !== 'function') return { why: 'no __tape.speed on the page' };
      const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const out = {};
      // the men's shadow proxies as the render is handed them (the blend rides on them: tween.ts pose) and as the step left them
      const sig = () => { const d = e.world.capsuleData, n = Math.min(d.length, 8 * 8 * e.world.charCount); let h = 0; for (let i = 0; i < n; i++) h = (h * 31 + Math.round(d[i] * 1e5)) | 0; return h; };
      const real = e.render; let seen = null; e.render = () => { seen = { a: FS.drew ? FS.drew.a : null, men: FS.drew ? FS.drew.men : 0, boxes: FS.drew ? FS.drew.boxes : 0, sig: sig() }; e.world.upload(); };
      const frames = (n) => { const rows = []; for (let i = 0; i < n; i++) { seen = null; const f0 = T.state.f; window.__runFrames(1, 1 / 60); rows.push({ stepped: T.state.f - f0, ...(seen || {}), after: sig() }); } return rows; };
      try {
        T.speed(0.5); T.run(150, false);   // (to where the men are moving: a script's steps, at a slow pace too, leave no blend behind them)
        out.before = FS.drew === null; T.speed(0.25); T.play(); out.f0 = T.state.f; out.quarter = frames(48); out.f1 = T.state.f;
        out.hid = g.fogOfWar.active ? g.guards.filter(x => g.fogOfWar.hidden(x)).length : 0;   // (men the fog leaves out of the picture: with it off they are drawn, so they are drawn between the steps too)
        T.fog(false); out.bare = frames(16); T.fog(true); frames(8);
        T.speed(0.5); out.half = frames(16); out.f2 = T.state.f;
        e.render = real; { const f = T.state.f; for (let i = 0; i < 2; i++) { window.__runFrames(1, 1 / 60); await e.device.queue.onSubmittedWorkDone(); await tick(); } out.drawn = { stepped: T.state.f - f, a: FS.drew ? FS.drew.a : null, men: FS.drew ? FS.drew.men : 0 }; }
        e.render = () => { seen = { a: FS.drew ? FS.drew.a : null, sig: sig() }; e.world.upload(); };
        { const was = frames(1)[0]; T.pause(); const p = frames(2); T.play(); const on = frames(1)[0];   // (paused: the picture stands where it is, between the two steps, and moves on from there)
          out.stood = { stepped: p[0].stepped + p[1].stepped, same: p[0].sig === was.sig && p[1].sig === was.sig, on: on.a > was.a || on.stepped === 1 };
          T.run(2, false); const r = frames(1)[0]; out.ran = { rested: FS.drew === null || r.stepped === 1 }; frames(8); }   // (a script's steps end the blend: the next frame is the step itself)
        T.speed(1); out.one = frames(4);
        T.speed(4); let n = 0; while (!T.state.ended && n++ < 20000) { window.__runFrames(1, 1 / 60); if (n % 50 === 0) await tick(); }
      } finally { e.render = real; }
      out.s = T.state; out.fatal = (document.getElementById('fatal') || {}).textContent || '';
      return out;
    });
    const s = A.s || {}, Q = A.quarter || [], H = A.half || [], Bz = A.bare || [];
    // at ¼×: a step every fourth frame; once two steps stand, every frame is drawn between them (a < 1), further along on each frame until the next step
    const qSteps = Q.reduce((n, r) => n + r.stepped, 0), hSteps = H.reduce((n, r) => n + r.stepped, 0), posed = Q.filter(r => r.a !== null && r.a < 1);
    let rising = 0, falls = 0; for (let i = 1; i < Q.length; i++) { const p = Q[i - 1], c = Q[i]; if (p.a === null || c.a === null || p.a >= 1 || c.a >= 1) continue; if (c.stepped) continue; if (c.a > p.a) rising++; else falls++; }
    const pictures = new Set(posed.map(r => r.sig)).size, moved = Q.filter((r, i) => i > 0 && !r.stepped && r.after !== Q[i - 1].after).length, menMin = posed.length ? Math.min(...posed.map(r => r.men)) : 0;
    const bareMen = Math.max(0, ...Bz.map(r => r.men || 0)), fogMen = Math.max(0, ...Q.map(r => r.men || 0)), counts = FILE ? qSteps >= 1 && hSteps >= 1 : qSteps >= 11 && qSteps <= 13 && Q.every(r => r.stepped <= 1) && hSteps >= 7 && hSteps <= 9;   // (a file's steps may be of any length: only the recorded quarter minute's are counted)
    const slowOk = !A.why && A.before && counts && posed.length >= (FILE ? 8 : 40) && rising >= (FILE ? 4 : 24) && falls === 0 && menMin >= 1 && pictures >= (FILE ? 4 : 30) && moved === 0
      && Bz.filter(r => r.a !== null && r.a < 1).length >= 12 && A.one.every(r => r.a === null && (FILE || r.stepped === 1)) && A.stood.stepped === 0 && A.stood.same && A.stood.on && A.ran.rested && (A.hid === 0 || bareMen > fogMen) && A.drawn.a !== null && A.drawn.a < 1 && A.drawn.men >= 1;
    const runOk = !A.why && s.ended && s.f === s.ticks && (FILE || (!s.drift && s.unjournaled === 0)) && !A.fatal;
    line(slowOk && !errors.length, 'at ¼× a step lasts four frames and each frame between is drawn further along between the last two steps, the men with it (those the lifted fog shows too); paused it stands where it is; scripted steps and 1× draw the step itself', A.why ? A.why : `150 scripted steps at ½× left no blend: ${A.before ? 'yes' : 'NO'} · ¼×: ${qSteps} steps in ${Q.length} frames, ${posed.length} drawn between two steps (further along on ${rising}, back on ${falls}), ${pictures} different pictures of the men, at least ${menMin} men blended, the step's own proxies changed by ${moved} frames with no step · fog off: ${Bz.filter(r => r.a !== null && r.a < 1).length} of ${Bz.length} between, ${bareMen} men blended against ${fogMen} under it (${A.hid} hidden by the fog then) · ½×: ${hSteps} steps in ${H.length} frames · drawn for real: ${JSON.stringify(A.drawn)} · paused: ${JSON.stringify(A.stood)} · after a script's two steps: ${JSON.stringify(A.ran)} · 1×: ${JSON.stringify(A.one.map(r => [r.stepped, r.a]))}`);
    line(runOk && !errors.length, 'played slow, with the fog on and off, then fast to its end, the run is the recording’s', A.why ? A.why : `${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at step ' + s.drift.f + ' (' + s.drift.who + ' ' + (+s.drift.metres).toFixed(2) + ' m)' : 'never'} · ${s.unjournaled} reads the tape never made · worst ${s.worst ? (+s.worst.metres).toFixed(3) + ' m' : '–'}${A.fatal ? ' · FATAL ' + A.fatal.slice(0, 120) : ''}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await shot(page, 'engine-replay-between');
    await page.close();
  }

  // ── open: the page as a PERSON opens it (no `paused`, the end card's Replay or the viewer's 'Play in engine'): the still under the play button is the tape's
  //    FIRST STEP, with the men in it — nobody is drawn before a step has run — and played from there the run is the recording's
  if (want('open') && !FILE) {
    const { page, errors } = await open(`?quality=${QUALITY}&mute&playtape=${id}`);
    await page.waitForFunction(() => !!window.__tape && window.__tape.state.f >= 1, null, { timeout: 600000 }).catch(() => {});
    const A = await page.evaluate(async () => { const T = window.__tape, g = window.__game, e = window.__engine; await e.device.queue.onSubmittedWorkDone();
      return { f: T.state.f, playing: T.state.playing, big: !!document.getElementById('tapebig'), men: g.menAll?.length ?? -1, boxes: e.world.dynamics.length }; });
    await shot(page, 'engine-replay-open');
    const R = await walk(page), s = R.state || {}, at = rec?.pos && R.pos ? Math.hypot(R.pos[0] - rec.pos[0], R.pos[2] - rec.pos[2]) : null;
    line(A.f === 1 && !A.playing && A.big && A.men > 0 && s.ended && s.f === s.ticks && !s.drift && s.unjournaled === 0 && (at === null || at < 0.01) && /as recorded/.test(R.bar || '') && !errors.length,
      'opened by a person the replay stands on its first step with the men drawn under the play button, and plays from there as recorded',
      `the still ${JSON.stringify(A)} · then ${s.f} of ${s.ticks} steps · parted ${s.drift ? 'at step ' + s.drift.f : 'never'} · ${s.unjournaled} reads the tape never made · Sam ends ${at === null ? '?' : at.toFixed(3)} m from where the recording left him${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }

  if (want('refuse') && !FILE && fileText) {
    const F = JSON.parse(fileText); delete F.rerun; F.savedAt += 'x';
    await ctx.route('**/qa-bare.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(F) }));
    const { page, errors } = await open(`?paused&quality=${QUALITY}&mute&playtape=qa-bare.json`);
    const R = await page.evaluate(() => ({ tape: !!window.__tape, said: /no run tape/.test(document.body.innerText || ''), game: !!window.__game, search: location.search }));
    line(!R.tape && R.said && R.game && !errors.length, 'a replay with no run tape says so and the game boots as itself', `${JSON.stringify(R)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '\n=== engine-replay-page: FAILED ===' : '\n=== engine-replay-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
