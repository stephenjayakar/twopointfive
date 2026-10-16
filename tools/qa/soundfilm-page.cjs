// The hear-again FILMSTRIP (src/replay/soundfilm.ts) on the real page (headless Chromium, the software adapter): the class is built by itself and
// put into the game page, frames are stepped by hand and captured right after each render, and the strip must hold real, different pictures that
// show() lays exactly over the view.
//   PORT=<dev server> node tools/qa/soundfilm-page.cjs [outDir]     QUALITY=verylow   SIZE=480x270   VERBOSE=1 (the page's progress lines)   RULE_ONLY=1 (the last block alone)
// THE CAPTURE RULE this holds: capture() in the same task as the render reads the frame; the same call from a LATER task (a timer, another frame's
// callback that runs before that frame's render) reads a canvas whose picture has been handed on — the 'late capture' line prints what it got.
// Exit 0 = every line passed, 1 = a line failed, 2 = the script died.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const PORT = process.env.PORT || 5264, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '';
const [VW, VH] = (process.env.SIZE || '480x270').split('x').map(Number), VERBOSE = !!process.env.VERBOSE, RULE_ONLY = !!process.env.RULE_ONLY;   // (a small view: on a shared machine a software frame can take most of a minute)
const ROOT = path.join(__dirname, '../..');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist',
  '--disable-gpu-watchdog', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];

let failed = 0;
const line = (ok, label, detail = '') => { if (!ok) failed++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`); };
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;

(async () => {
  // the class alone, as a script the page can take: an entry that hangs it on window, bundled for the browser
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soundfilm-')), entry = path.join(tmp, 'entry.ts'), bundle = path.join(tmp, 'soundfilm.js');
  fs.writeFileSync(entry, `import { SoundFilm } from ${JSON.stringify(path.join(ROOT, 'src/replay/soundfilm.ts'))};\n(globalThis as any).SoundFilm = SoundFilm;\n`);
  cp.execFileSync('bun', ['build', entry, '--target', 'browser', '--format', 'iife', '--outfile', bundle], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const code = fs.readFileSync(bundle, 'utf8');

  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (VERBOSE && m.text().startsWith('film: ')) console.error(`  ${m.text()}`);
    if (m.type() !== 'error') return; const at = (m.location() || {}).url || '';
    if (/\/favicon\.ico$/.test(at)) return;
    errors.push(/Failed to load resource/.test(m.text()) ? `${m.text()} ${at}` : m.text());
  });
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute`, { timeout: 240000 });
  await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__engine && !!window.__runFrames, null, { timeout: 900000 });
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu && window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; });   // (no smoke solver: its step is the dear part of a software frame)
  await page.waitForFunction(() => { const v = document.getElementById('view'); return !!v && v.clientWidth > 0 && v.width > 0; }, null, { timeout: 120000 });
  await page.addScriptTag({ content: code });
  line(await page.evaluate(() => typeof window.SoundFilm === 'function'), 'the class is in the page');

  // helpers the page keeps: a turn of the event loop, the GPU through with the frame, the strip's pixels read back
  await page.evaluate(() => {
    const view = document.getElementById('view');
    window.__ft = {
      view,
      tick: () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }),
      wait: ms => new Promise(res => setTimeout(res, ms)),
      gpu: () => window.__engine.device.queue.onSubmittedWorkDone(),
      // until the strip holds n frames (an encode is off the hot path), or six seconds
      async held(film, n, ms = 6000) { const t0 = performance.now(); while (film.count() < n && performance.now() - t0 < ms) await this.wait(10); return film.count(); },
      // step one frame and capture it IN THE SAME TASK, then let the encode land
      async shot(film, t) { const t0 = performance.now(); window.__runFrames(1); const t1 = performance.now(); film.capture(t); const t2 = performance.now(); await this.gpu(); await this.tick(); console.log(`film: t ${t.toFixed(2)} · frame ${(t1 - t0).toFixed(0)} ms · capture ${(t2 - t1).toFixed(1)} ms · gpu ${(performance.now() - t2).toFixed(0)} ms · kept ${film.count()}`); },
      // a capture with NO new frame (what the strip's own books do needs no picture: an expired canvas still hands over a bitmap)
      async quick(film, t) { film.capture(t); await this.tick(); },
      // what a canvas shows, away from the tag in its corner: mean luminance, distinct colours, and the samples themselves
      read(c) {
        const s = document.createElement('canvas'); s.width = 96; s.height = 54; const x = s.getContext('2d', { willReadFrequently: true });
        x.drawImage(c, 0, 0, 96, 54); const d = x.getImageData(24, 0, 72, 54).data; const seen = new Set(); let lum = 0; const px = [];
        for (let i = 0; i < d.length; i += 4) { lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3); px.push(d[i], d[i + 1], d[i + 2]); }
        return { lum: lum / (d.length / 4), colours: seen.size, px };
      },
      diff(a, b) { let s = 0; for (let i = 0; i < a.px.length; i++) s += Math.abs(a.px[i] - b.px[i]); return s / a.px.length; },
    };
  });

  if (!RULE_ONLY) {
  // 1. thirty frames, each captured right after its render
  const a = await page.evaluate(async () => {
    const F = window.__ft, film = window.__film = new window.SoundFilm(F.view);
    for (let i = 0; i < 30; i++) { await F.shot(film, i * 0.1); await F.held(film, i + 1); }
    return { count: film.count(), span: film.span(), stats: film.stats, view: [F.view.width, F.view.height] };
  });
  line(a.count >= 25, 'thirty drawn frames, a tenth of a second apart, are kept', `${a.count} kept · taken ${a.stats.taken}, dropped ${a.stats.dropped}, failed ${a.stats.failed} · view ${a.view.join('×')}`);
  line(!!a.span && near(a.span[0], 0) && near(a.span[1], 2.9), 'the strip spans the time captured', JSON.stringify(a.span));

  // 2. captures nearer than the gap take nothing, and taking nothing is cheap
  const gap = await page.evaluate(() => {
    const film = window.__film, n = film.count(), taken = film.stats.taken, t0 = performance.now();
    const last = film.span()[1]; for (let i = 0; i < 20000; i++) film.capture(last + (i % 9) * 0.01);   // (from the last frame's own time: a hair UNDER it would be time going back)
    return { same: film.count() === n && film.stats.taken === taken, us: (performance.now() - t0) / 20000 * 1000 };
  });
  line(gap.same && gap.us < 20, 'a capture inside the gap takes nothing and costs nothing', `${gap.us.toFixed(3)} µs a call`);

  // 3. show(1.5): the overlay exists, covers the view, and is a picture
  const s = await page.evaluate(async () => {
    const F = window.__ft, film = window.__film, ok = film.show(1.5); await F.wait(600);
    const e = document.getElementById('sndfilm'); if (!e) return { ok, el: false };
    const r = e.getBoundingClientRect(), v = F.view.getBoundingClientRect(), cs = getComputedStyle(e);
    const under = [...document.querySelectorAll('#tapebar,#sndl,#hud,#meters,#equip,#log,#menu,#panel')].filter(o => (o.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING) === 0 && !(Number(getComputedStyle(o).zIndex) > 0)).map(o => o.id);
    window.__shown15 = F.read(e);
    return { ok, el: true, shown: cs.display !== 'none', off: Math.max(Math.abs(r.left - v.left), Math.abs(r.top - v.top), Math.abs(r.right - v.right), Math.abs(r.bottom - v.bottom)),
      size: [e.width, e.height], z: cs.zIndex, pe: cs.pointerEvents, after: e.previousElementSibling === F.view, under, lum: window.__shown15.lum, colours: window.__shown15.colours, n: document.querySelectorAll('#sndfilm').length };
  });
  line(s.ok && s.el && s.shown && s.n === 1, 'show(1.5) answers true and puts ONE #sndfilm up', JSON.stringify({ ok: s.ok, shown: s.shown, n: s.n }));
  line(s.el && s.off <= 2, 'the overlay covers the view', `${s.el ? s.off.toFixed(2) : '-'} px off · strip ${s.el ? s.size.join('×') : '-'}`);
  line(s.el && s.after && s.pe === 'none' && !s.under.length, 'it sits right over the view, under the HUD, and takes no pointer', `z-index ${s.z}${s.el && s.under.length ? ` · above: ${s.under.join(' ')}` : ''}`);
  line(s.el && s.lum > 4 && s.colours > 1, 'the frame shown is a picture, not black', s.el ? `mean luminance ${s.lum.toFixed(1)}, ${s.colours} colours` : '');
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'soundfilm-1.5.png') }); }

  // 4. the same frame asked again is the same picture; the camera moved and three frames on, the strip holds another
  const d = await page.evaluate(async () => {
    const F = window.__ft, film = window.__film, e = document.getElementById('sndfilm');
    film.show(1.52); await F.wait(300); const again = F.read(e);
    const p = window.__game.player.char.pos;
    window.__stage({ look: [p[0], 1, p[2]], yaw: 2.4, pitch: 1.1, dist: 22 });
    for (let i = 0; i < 3; i++) { await F.shot(film, 3 + i * 0.1); await F.held(film, 31 + i); }
    const count = film.count(), span = film.span();
    const ok = film.show(3.25); await F.wait(600); const late = F.read(e);
    film.show(1.5); await F.wait(600); const back = F.read(e);
    return { same: F.diff(window.__shown15, again), moved: F.diff(window.__shown15, late), back: F.diff(window.__shown15, back), ok, count, span, lum: late.lum, colours: late.colours };
  });
  line(d.same < 0.5, 'a time inside the same frame shows the same picture', `mean difference ${d.same.toFixed(2)}`);
  line(d.ok && d.count >= 28 && near(d.span[1], 3.2) && d.lum > 4 && d.colours > 1 && d.moved > 3, 'after the camera moved the strip holds a different picture at a later time', `${d.count} kept to ${d.span[1]} · mean difference ${d.moved.toFixed(1)} · luminance ${d.lum.toFixed(1)}`);
  line(d.back < 0.5, 'and the earlier time is the earlier picture again', `mean difference ${d.back.toFixed(2)}`);
  if (OUT) { await page.evaluate(async () => { window.__film.show(3.2); await window.__ft.wait(500); }); await page.screenshot({ path: path.join(OUT, 'soundfilm-3.2.png') }); }

  // 5. hide(); a show overtaken by a hide paints nothing; no frame within a second = false and hidden
  const h = await page.evaluate(async () => {
    const F = window.__ft, film = window.__film, e = document.getElementById('sndfilm'), vis = () => getComputedStyle(e).display !== 'none';
    film.show(1.5); await F.wait(300); const up = vis(); film.hide(); const down = !vis();
    film.show(0.7); film.hide(); await F.wait(600); const stale = !vis();     // (0.7 is not in the decode cache: its decode lands after the hide)
    film.show(1.5); await F.wait(300); const up2 = vis(); const far = film.show(99); const farHid = !vis();
    film.show(1.5); await F.wait(300); const before = film.show(-0.5); const beforeHid = !vis();
    return { up, down, stale, up2, far, farHid, before, beforeHid };
  });
  line(h.up && h.down, 'hide() hides it');
  line(h.stale, 'a decode that lands after hide() paints nothing');
  line(h.up2 && h.far === false && h.farHid && h.before === false && h.beforeHid, 'show(99) and a time before the strip answer false and hide it', JSON.stringify(h));

  // 6. time going back re-keys; maxFrames drops the oldest; a third encode in flight is dropped, not queued; clear / dispose
  const k = await page.evaluate(async () => {
    const F = window.__ft, V = F.view, out = {};
    const f2 = new window.SoundFilm(V);
    for (let i = 0; i < 6; i++) { await F.quick(f2, i * 0.1); await F.held(f2, i + 1); }
    out.before = [f2.count(), f2.span()];
    await F.quick(f2, 0.2); await F.held(f2, 3); await F.wait(100);
    out.rekey = [f2.count(), f2.span()];
    await F.quick(f2, 0.25); await F.wait(200); out.gapAfter = f2.count();          // (inside the gap of the re-keyed frame: nothing)
    await F.quick(f2, 0.3); await F.held(f2, 4); out.onward = [f2.count(), f2.span()];
    f2.clear(); out.cleared = [f2.count(), f2.span(), f2.show(0.1)];
    f2.dispose();

    const f3 = new window.SoundFilm(V, { maxFrames: 5 });
    for (let i = 0; i < 10; i++) { await F.quick(f3, i * 0.1); await F.held(f3, Math.min(5, i + 1)); await F.wait(30); }
    out.max = [f3.count(), f3.span()]; f3.dispose();

    const f4 = new window.SoundFilm(V, { everyMs: 0, width: 320 });
    for (let i = 0; i < 6; i++) f4.capture(i);                                      // (six asked in one task)
    await F.wait(1500); out.flood = [f4.count(), f4.stats.taken, f4.stats.dropped];
    f4.show(0); await F.wait(300); const n = document.querySelectorAll('#sndfilm').length; f4.dispose();
    out.els = [n, document.querySelectorAll('#sndfilm').length];
    f4.capture(9); out.dead = [f4.count(), f4.show(0)];
    return out;
  });
  line(k.before[0] === 6 && k.rekey[0] === 3 && near(k.rekey[1][0], 0) && near(k.rekey[1][1], 0.2) && k.gapAfter === 3 && k.onward[0] === 4 && near(k.onward[1][1], 0.3),
    'time going back drops what was kept at or after it and keys on from there', `${JSON.stringify(k.before)} → ${JSON.stringify(k.rekey)} → ${JSON.stringify(k.onward)}`);
  line(k.cleared[0] === 0 && k.cleared[1] === null && k.cleared[2] === false, 'clear() empties the strip');
  line(k.max[0] === 5 && near(k.max[1][0], 0.5) && near(k.max[1][1], 0.9), 'maxFrames drops the oldest', JSON.stringify(k.max));
  line(k.flood[0] === 2 && k.flood[1] === 2 && k.flood[2] === 4, 'no more than two encodes in flight: the rest are dropped, not queued', `kept ${k.flood[0]}, taken ${k.flood[1]}, dropped ${k.flood[2]}`);
  line(k.els[0] === 2 && k.els[1] === 1 && k.dead[0] === 0 && k.dead[1] === false, 'each strip has its own overlay, and dispose() takes it away for good', JSON.stringify(k.els));

  }

  // 7. THE RULE: the same capture from a later task. Informational — what an expired canvas reads as on this adapter.
  const r = await page.evaluate(async () => {
    const F = window.__ft, V = F.view;
    const one = async late => {
      const f = new window.SoundFilm(V); window.__runFrames(1);
      if (late === 'task') await F.wait(50); else if (late === 'raf') await new Promise(res => requestAnimationFrame(() => res()));
      f.capture(0); await F.gpu(); await F.held(f, 1, 180000); f.show(0); await F.wait(600);   // (the copy is asked for at once; on this adapter it can be most of a minute in coming)
      const e = [...document.querySelectorAll('#sndfilm')].find(c => getComputedStyle(c).display !== 'none'), got = e ? F.read(e) : null; f.dispose();
      return got ? { lum: got.lum, colours: got.colours } : null;
    };
    return { same: await one(''), raf: await one('raf'), task: await one('task') };
  });
  const say = o => o ? `luminance ${o.lum.toFixed(1)}, ${o.colours} colours` : 'nothing kept';
  line(!!r.same && r.same.lum > 4 && r.same.colours > 1, 'captured in the render\'s own task: the frame', say(r.same));
  console.log(`  late capture — in the next animation frame, before any render: ${say(r.raf)}`);
  console.log(`  late capture — from a timer 50 ms on: ${say(r.task)}`);
  console.log(`  the rule: ${(r.raf && r.raf.lum > 4) || (r.task && r.task.lum > 4) ? 'this adapter still handed a late capture a picture; a real GPU presents and clears — capture in the render\'s task all the same' : 'a late capture reads an empty canvas — capture() must run in the task that rendered'}`);

  await page.evaluate(() => window.__film && window.__film.dispose());
  line(await page.locator('#sndfilm').count() === 0, 'nothing of it is left in the page');
  line(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* a temp dir */ }
  console.log(failed ? `=== soundfilm-page: ${failed} FAILED ===` : '=== soundfilm-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
