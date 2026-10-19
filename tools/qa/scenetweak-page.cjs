// THE SCENE TWEAK PANEL IN THE REAL PAGE (src/ui/sceneTweak.ts, `?tweak`) — headless Chromium on the software WebGPU adapter (fog-lit-stills.cjs's flag set), the
// pass booted as the maintainer's clip had it (room clear, four, hard) with `&tweak`. What tools/qa/scenetweak-check.ts cannot reach: the DOM, real pipelines
// rebuilt from an overridden constant, the kept copy across a reload, a page without the word.
//   node tools/qa/scenetweak-page.cjs [--out DIR] [--quality low]
// One PASS / FAIL line each, exit 1 on any FAIL or any console / GPU error. The pictures it writes are the software adapter's: nothing here has been on a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'scenetweak-')))), QUALITY = flag('--quality', 'low');
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let srv = null, browser = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
let fails = 0; const verdict = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(); srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port}`);
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => { });
  const errors = [];
  const open = async (words) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
    page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || NOISE.test(x)) return; errors.push(x.slice(0, 500)); log('console.error', x.slice(0, 400)); });
    const url = `http://localhost:${port}/?${['levelFile=pass.json', 'roomclear', 'squad4', 'difficulty=hard', 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp', ...words].join('&')}`;
    log('goto', url); await page.goto(url, { waitUntil: 'commit' });
    for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 2400) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
    await page.evaluate(async () => {
      window.__testVisible = true; await window.__ready; const E = window.__engine; try { window.__menu.close(); } catch { }
      window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
      window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
      window.__frames = async n => { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60); await window.__done(); } };
      // the panel's own promises: wait until no layer says it is building (a quarter of an hour at most: on the software adapter one program is tens of seconds
      // built alone, and minutes on a box that is also running other browsers — two minutes was not enough there, and read as a red `reset`)
      window.__settled = async () => { for (let i = 0; i < 18000; i++) { if (![...document.querySelectorAll('#stweak .ststat')].some(s => s.textContent === 'building…')) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
      window.__layer = name => [...document.querySelectorAll('#stweak .stlayer')].find(l => l.querySelector('.stname').textContent.replace(/ [↻◆]/g, '') === name);
      window.__row = (layer, label) => [...window.__layer(layer).querySelectorAll('.strow')].find(r => r.querySelector('label').textContent.replace(/ [◆⟳›]$/, '') === label);
      window.__setNum = (layer, label, v) => { const n = window.__row(layer, label).querySelector('input[type=number]'); n.value = String(v); n.dispatchEvent(new Event('change')); };
      window.__slide = (layer, label, v) => { const n = window.__row(layer, label).querySelector('input[type=range]'); n.value = String(v); n.dispatchEvent(new Event('input')); };
    });
    return page;
  };

  // ---- 1: the panel is there, with the scene's layers
  let page = await open(['tweak']);   // (a browser context of this run's own: nothing kept from an earlier one)
  const made = await page.evaluate(async () => { await window.__frames(3);
    const L = [...document.querySelectorAll('#stweak .stlayer')]; return { there: !!document.getElementById('stweak'), layers: L.map(l => l.querySelector('.stname').textContent.replace(' ◆', '')), rows: document.querySelectorAll('#stweak .strow').length,
      groups: [...document.querySelectorAll('#stweak .stgroup')].map(g => g.textContent), stats: L.map(l => l.querySelector('.ststat').textContent).filter(Boolean).length, count: document.querySelector('#stweak .stcount').textContent }; });
  const WANT = ['Sky and moon', 'Torches', 'Beams in the air', 'Snow surface ↻', 'Sparkle', 'Glow through snow', 'Boot prints', 'Things mark the snow', 'Blast marks', 'Falling flakes', 'Snow in one air', 'Blown wisps', 'Blown grains', 'Breath', 'Wind sim', 'Storm wind', 'Bloom', 'Exposure and tone'];
  verdict(made.there && WANT.every(n => made.layers.includes(n)) && made.rows > 150 && made.count === '', 'panel — `?tweak` puts the scene\'s layers on the page, nothing changed', `${made.layers.length} layers under ${made.groups.join(' · ')} · ${made.rows} rows · ${made.stats} live read-outs · missing: ${WANT.filter(n => !made.layers.includes(n)).join(', ') || 'none'}`);
  await page.evaluate(() => { for (const n of ['Falling flakes', 'Sparkle']) window.__layer(n).querySelector('.stlhead').click(); });
  await page.evaluate(() => window.__frames(2)); await page.screenshot({ path: path.join(OUT, 'scenetweak-panel.png') });

  // ---- 2: a slider is the table's number, live
  const slid = await page.evaluate(() => { window.__layer('Blown grains').querySelector('.stlhead').click(); const was = window.__snow.grains.opacity; window.__slide('Blown grains', 'opacity', 0.8);
    const now = window.__snow.grains.opacity;
    // the number box: an empty one changes nothing, one past the slider's reach is held to it; and a button let go over the panel is still heard by the game (Input listens on the window)
    window.__setNum('Blown grains', 'opacity', ''); const empty = window.__snow.grains.opacity; window.__setNum('Blown grains', 'opacity', 99); const far = window.__snow.grains.opacity; window.__setNum('Blown grains', 'opacity', 0.8);
    let heard = false; const h = () => { heard = true; }; window.addEventListener('mouseup', h); document.querySelector('#stweak .stbody, #stweak').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); window.removeEventListener('mouseup', h);
    return { was, now, empty, far, max: +window.__row('Blown grains', 'opacity').querySelector('input[type=range]').max, heard, back: window.__snow.grains.opacity, ch: window.__row('Blown grains', 'opacity').classList.contains('ch'), count: document.querySelector('#stweak .stcount').textContent, dot: window.__layer('Blown grains').querySelector('.stdot').textContent }; });
  verdict(slid.was === 0.5 && slid.now === 0.8 && slid.empty === 0.8 && slid.far === slid.max && slid.back === 0.8 && slid.heard && slid.ch && slid.count === '1' && slid.dot === '1', 'slider — a move is the table\'s own number, marked changed; the box takes a number inside the reach or nothing',
    `SNOWGRAINS.opacity ${slid.was} → ${slid.now} · an empty box: ${slid.empty} · 99 typed: ${slid.far} (reach ${slid.max}) · a release over the panel reaches the window: ${slid.heard} · row marked ${slid.ch} · head count '${slid.count}' · layer count '${slid.dot}'`);

  // ---- 3: a shader constant: the composite is rebuilt, and draws
  const comp = await page.evaluate(async () => { const P = window.__engine.passes, was = P.pComp; window.__setNum('Sparkle', 'gain', 6); const ok = await window.__settled(); await window.__frames(2);
    // … and a plain number of the same layer, moved and put back, builds nothing: the owner skips a text it already runs
    const built = P.pComp, d = +window.__row('Sparkle', 'sparkle').querySelector('input[type=range]').value; window.__slide('Sparkle', 'sparkle', d * 0.5); await new Promise(r => setTimeout(r, 100)); await window.__settled(); await window.__frames(1);
    const skipped = P.pComp === built; window.__row('Sparkle', 'sparkle').querySelector('.back').click(); await window.__settled();
    return { ok, swapped: built !== was, skipped, err: window.__layer('Sparkle').querySelector('.ststat').classList.contains('err') ? window.__layer('Sparkle').querySelector('.ststat').textContent : '', gpu: window.__gpuErrs.slice() }; });
  verdict(comp.ok && comp.swapped && comp.skipped && !comp.err && !comp.gpu.length, 'composite — SNOW_SPARKLE_GAIN moved: the program rebuilt and drawn with; a plain number builds nothing', `settled ${comp.ok} · pipeline replaced ${comp.swapped} · left alone by a plain row ${comp.skipped} · ${comp.err || 'no error on the layer'} · GPU errors ${comp.gpu.length}${comp.gpu.length ? ': ' + comp.gpu[0] : ''}`);
  // ---- 4: … and a particle one
  const part = await page.evaluate(async () => { const P = window.__engine.particles, was = P.pUpdate; window.__setNum('Blown grains', 'pick rate', 9); const ok = await window.__settled(); await window.__frames(2);
    const st = window.__layer('Blown grains').querySelector('.ststat'); return { ok, swapped: P.pUpdate !== was, err: st.classList.contains('err') ? st.textContent : '', gpu: window.__gpuErrs.slice() }; });
  verdict(part.ok && part.swapped && !part.err && !part.gpu.length, 'particles — GRAIN_PICK_RATE moved: the kernels rebuilt and stepped', `settled ${part.ok} · pipeline replaced ${part.swapped} · ${part.err || 'no error on the layer'} · GPU errors ${part.gpu.length}${part.gpu.length ? ': ' + part.gpu[0] : ''}`);

  // ---- 4b: one snow in one air is live (the grains stand down with it and their layer is dimmed; off, they are back), and the blast button marks the snow
  const air = await page.evaluate(async () => { const T = window.__tweak, G = () => window.__layer('Blown grains').classList.contains('idle'); const dim = (l, r) => window.__row(l, r).classList.contains('idle');
    const box = window.__layer('Snow in one air').querySelector('input[type=checkbox]');
    await window.__frames(2); T.refresh(true); const on = { force: window.__snow.oneAir, grains: G(), speedK: dim('Blown wisps', 'speedK'), liftLo: dim('Blown wisps', 'liftLo'), airLow: dim('Falling flakes', 'airLow') };
    box.click(); await window.__frames(3); T.refresh(true); const off = { force: window.__snow.oneAir, grains: G(), speedK: dim('Blown wisps', 'speedK'), liftLo: dim('Blown wisps', 'liftLo'), airLow: dim('Falling flakes', 'airLow'), text: T.text() };
    box.click(); await window.__frames(3); T.refresh(true); const back = { force: window.__snow.oneAir, grains: G() };
    const b0 = window.__snow.blastStats.blasts; window.__layer('Blast marks').querySelector('button.stact').click(); await window.__frames(3); const B = window.__snow.blastStats;
    return { on, off, back, b0, b1: B.blasts, why: B.why, count: document.querySelector('#stweak .stcount').textContent, gpu: window.__gpuErrs.slice() }; });
  { const same = (o, v) => o.grains === v && o.speedK === v && o.liftLo === !v && o.airLow === !v;
    verdict(air.on.force === true && same(air.on, true) && air.off.force === false && same(air.off, false) && /switched off: .*Snow in one air/.test(air.off.text) && air.back.force === air.on.force && air.back.grains === air.on.grains && air.b1 === air.b0 + 1 && !air.gpu.length,
      'oneair — the switch is live: what nothing reads is dimmed, either way; the blast button tells the snow one blast', `opened in force ${air.on.force} (grains dimmed ${air.on.grains}, wisps speedK ${air.on.speedK}, liftLo ${air.on.liftLo}) · off: in force ${air.off.force}, grains dimmed ${air.off.grains}, liftLo ${air.off.liftLo} · on again: ${air.back.force} · blasts ${air.b0} → ${air.b1} (${air.why}) · GPU errors ${air.gpu.length}${air.gpu.length ? ': ' + air.gpu[0] : ''}`); }

  // ---- 4c: a blown man's breath (the hard breath rule, on as the page opens): the rule's `blown` rows are lit and the breath's own four dimmed; the rule put
  //      off in the page's own table (window.__knobs), the other way round; put back, as it opened
  const breath = await page.evaluate(async () => { const T = window.__tweak, H = window.__knobs.registry().HARDBREATH, was = H.on; const dim = r => window.__row('Breath', r).classList.contains('idle');
    const soft = ['everyHard', 'hardK', 'effortUp', 'effortDown'], hard = ['blown every', 'blown puffs', 'blown count', 'blown jet', 'blown size', 'blown carry', 'blown in', 'wind back in'];
    const read = () => { T.refresh(true); return { soft: soft.map(dim), hard: hard.map(dim), rest: ['every', 'puffs', 'opacity'].map(dim) }; };
    const on = read(); H.on = !was; await window.__frames(2); const off = read(); H.on = was; await window.__frames(2); const back = read();
    return { was, on, off, back, note: window.__row('Breath', 'blown jet').title, gpu: window.__gpuErrs.slice() }; });
  { const all = (a, v) => a.every(x => x === v), ok = (o, rule) => all(o.soft, rule) && all(o.hard, !rule) && all(o.rest, false);
    verdict(breath.was === true && ok(breath.on, true) && ok(breath.off, false) && ok(breath.back, true) && /thrown/.test(breath.note) && !breath.gpu.length,
      'breath — a blown man breathes by the hard breath rule\'s rows while it is on and by the breath\'s own four with it off: the rows nothing reads are the dimmed ones, either way',
      `opened with the rule ${breath.was ? 'on' : 'OFF'}: the four dimmed ${all(breath.on.soft, true)}, the rule's eight lit ${all(breath.on.hard, false)} · rule off: the four lit ${all(breath.off.soft, false)}, the eight dimmed ${all(breath.off.hard, true)} · put back: ${ok(breath.back, true) ? 'as it opened' : 'NOT BACK'} · hover on blown jet: ${JSON.stringify(breath.note.slice(0, 60))} · GPU errors ${breath.gpu.length}`); }

  // ---- 5: a switch mutes live; `none` and `all`
  const sw = await page.evaluate(async () => { const box = window.__layer('Blown wisps').querySelector('input[type=checkbox]'); const was = window.__snow.wisps.opacity; box.click(); const off = window.__snow.wisps.opacity; await window.__frames(1); box.click();
    const btn = t => [...document.querySelectorAll('#stweak .sthead button')].find(b => b.textContent === t);
    btn('none').click(); const offN = [...document.querySelectorAll('#stweak .stlayer.off')].length, fl = window.__snow.fx.gain, air = !window.__layer('Snow in one air').classList.contains('off'); await window.__settled(); await window.__frames(1);
    btn('all').click(); await window.__settled(); await window.__frames(1);
    return { was, off, back: window.__snow.wisps.opacity, offN, torch: !window.__layer('Torches').classList.contains('off'), air, flGain: fl, flBack: window.__snow.fx.gain, gpu: window.__gpuErrs.slice() }; });
  verdict(sw.off === 0 && sw.back === sw.was && sw.offN >= 10 && sw.torch && sw.air && sw.flGain === 0 && sw.flBack === 9 && !sw.gpu.length, 'switch — off is live and comes back; none / all', `wisps ${sw.was} → ${sw.off} → ${sw.back} · 'none' put ${sw.offN} layers off (flake gain ${sw.flGain}; the torches, which guards see by, left on: ${sw.torch}; one air, a way the scene runs, left on: ${sw.air}) · 'all': gain ${sw.flBack} · GPU errors ${sw.gpu.length}`);
  await page.screenshot({ path: path.join(OUT, 'scenetweak-moved.png') });

  // ---- 6: copy
  const copied = await page.evaluate(async () => { [...document.querySelectorAll('#stweak .sthead button')].find(b => b.textContent === 'copy').click(); await new Promise(r => setTimeout(r, 300)); let clip = ''; try { clip = await navigator.clipboard.readText(); } catch (e) { clip = 'unreadable: ' + e; } return { clip, text: window.__tweak.text() }; });
  const lines = copied.text.split('\n');
  verdict(lines.includes('SNOWGRAINS.opacity = 0.8   (was 0.5)') && lines.includes('SNOW_SPARKLE_GAIN = 6   (was 2)') && lines.includes('GRAIN_PICK_RATE = 9   (was 5)') && lines.filter(l => / = /.test(l)).length === 3 && (copied.clip === copied.text || /unreadable/.test(copied.clip)), 'copy — the three changes as text', `${copied.text.trim().split('\n').join(' ⏎ ')} · clipboard ${copied.clip === copied.text ? 'holds it' : copied.clip.slice(0, 60)}`);

  // ---- 7: a reload keeps the hand's work (and rebuilds the programs it had rebuilt)
  await new Promise(r => setTimeout(r, 400)); await page.close(); page = await open(['tweak']);
  const kept = await page.evaluate(async () => { await window.__settled(); await window.__frames(2); return { op: window.__snow.grains.opacity, text: window.__tweak.text(), count: document.querySelector('#stweak .stcount').textContent, gpu: window.__gpuErrs.slice(),
    errs: [...document.querySelectorAll('#stweak .ststat.err')].map(s => s.textContent) }; });
  verdict(kept.op === 0.8 && kept.count === '3' && /SNOW_SPARKLE_GAIN = 6/.test(kept.text) && /GRAIN_PICK_RATE = 9/.test(kept.text) && !kept.gpu.length && !kept.errs.length, 'kept — a reload with `?tweak` comes back with the changes', `opacity ${kept.op} · ${kept.count} changed · layer errors ${kept.errs.length} · GPU errors ${kept.gpu.length}`);

  // ---- 8: a page without the word reads nothing of it
  const plain = await open([]);
  const bare = await plain.evaluate(() => ({ there: !!document.getElementById('stweak'), hook: typeof window.__tweak, op: window.__snow.grains.opacity, kept: !!localStorage.getItem('twopointsix.sceneTweak.pass') }));
  verdict(!bare.there && bare.hook === 'undefined' && bare.op === 0.5 && bare.kept, 'plain — without `?tweak`: no panel, the shipped numbers, the kept copy unread', `panel ${bare.there} · __tweak ${bare.hook} · SNOWGRAINS.opacity ${bare.op} · a kept copy on this machine: ${bare.kept}`);
  await plain.close();

  // ---- 9: reset
  const reset = await page.evaluate(async () => { [...document.querySelectorAll('#stweak .sthead button')].find(b => b.textContent === 'reset').click(); const t0 = performance.now(); const ok = await window.__settled(); const secs = Math.round((performance.now() - t0) / 1000); await window.__frames(2); await new Promise(r => setTimeout(r, 400));
    return { ok, secs, op: window.__snow.grains.opacity, text: window.__tweak.text(), kept: localStorage.getItem('twopointsix.sceneTweak.pass'), gpu: window.__gpuErrs.slice() }; });
  verdict(reset.ok && reset.op === 0.5 && /nothing changed/.test(reset.text) && reset.kept === '{"v":{},"sw":{}}' && !reset.gpu.length, 'reset — every number back, the kept copy empty', `its two programs rebuilt: ${reset.ok ? 'yes' : 'NOT IN A QUARTER OF AN HOUR'} (${reset.secs} s) · opacity ${reset.op} · ${reset.text.trim().split('\n').join(' ⏎ ')} · kept ${reset.kept} · GPU errors ${reset.gpu.length}`);

  if (errors.length) { fails++; console.log(`- FAIL — console: ${errors.length} error(s)\n    ${errors.slice(0, 4).join('\n    ')}`); }
  console.log(`\nscenetweak-page: ${fails ? fails + ' FAIL' : 'all pass'} · pictures in ${OUT} (software adapter, never a GPU)`);
  stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('scenetweak-page: died —', e); stop(); process.exit(1); });
