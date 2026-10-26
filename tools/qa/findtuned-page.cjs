// THE OUTLINE IS ON FOR A MACHINE THAT HAS KEPT NOTHING, ON THE REAL PAGE (src/host/findme.ts FINDME_TUNED, findMeStarts; host/profile.ts pageSwitches):
// headless Chromium on the software WebGPU adapter, a squad of four, the page's own boot. The table and what a kept line makes of it are
// tools/qa/findme-check.ts (12), headless on both stands; this is that the page itself boots so, and that the rim is DRAWN there with no error.
//   PORT=5241 bun run tools/serve.ts &      then      node tools/qa/findtuned-page.cjs [outDir]
//   fresh    a browser that has kept nothing, the page with no word: Options' table says the outline is on, a quarter of its width, the teammates' at
//            four fifths, half the colour; the renderer's frame has his own man and four teammates so; the pass's one program compiles and it draws
//            (frames counted); Options > Game shows those rows so on its own screen, a row put Off is kept as Off, Reset puts the page's starts back;
//   word     the same browser on ?findtuned=0: the table is every row as built, the frame is off and the pass is never made;
//   kept     a browser that kept the row Off: off on the plain page, and its line still says so after the boot.
//   exit 0 = all of it with no page or console error · 1 = otherwise. With an outDir it keeps the pictures for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const LS = 'twopointsix.findme';

const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
// in the page: Options > Game opened by its own buttons, its rows read off the screen, one moved, Reset pressed (findme-page.cjs's own)
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWS = () => ({ rows: Object.fromEntries([...document.querySelectorAll('#options .op-row')].map(r => [r.querySelector('.op-label').textContent,
  r.querySelector('.op-switch') ? r.querySelector('.op-switch').textContent : r.querySelector('.op-range') ? r.querySelector('.op-val').textContent : [...r.querySelectorAll('.op-opt.on')].map(b => b.textContent).join('|')])), kept: localStorage.getItem('twopointsix.findme') });
const FLIP = (label) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`; r.querySelector('.op-switch').click(); return ''; };
const RESET = () => { const b = document.querySelector('#options [data-act="reset"]'); if (!b) return 'no Reset'; b.click(); return ''; };
// in the page: draw n frames one at a time, read the last one back — the whole frame as a PNG, and the count of strongly coloured pixels in the men's boxes
const DRAW = async (n) => {
  const E = window.__engine, dev = E.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  E.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await E.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  const F = E.outline, all = F ? [F, ...F.mates.filter(m => m.on)].map(m => m.rect).filter(q => q[2] > q[0]) : [];
  const r = all.length ? [Math.min(...all.map(q => q[0])), Math.min(...all.map(q => q[1])), Math.max(...all.map(q => q[2])), Math.max(...all.map(q => q[3]))] : [0.3, 0.3, 0.7, 0.7];
  const x0 = Math.max(0, Math.floor(r[0] * fr.w)), y0 = Math.max(0, Math.floor(r[1] * fr.h)), w = Math.min(fr.w, Math.ceil(r[2] * fr.w)) - x0, h = Math.min(fr.h, Math.ceil(r[3] * fr.h)) - y0;
  let ink = 0; const d = fr.data; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * fr.w + x) * 4, hi = Math.max(d[i], d[i + 1], d[i + 2]), lo = Math.min(d[i], d[i + 1], d[i + 2]); if (hi > 70 && hi - lo > hi * 0.45) ink++; }
  return { full: c2.toDataURL('image/png'), ink };
};
const STATE = () => { const E = window.__engine, P = E.passes.outlinePass, F = E.outline, T = window.__findme.table, man = m => ({ on: m.on, wide: m.wide, times: m.times, strength: +m.strength.toFixed(2) });
  return { table: { outline: T.outline, width: T.width, mates: T.mates, colour: T.colour, opacity: T.opacity, picture: T.picture, ring: T.ring, pan: T.pan, turn: T.turn }, you: F ? man(F) : null, mates: F ? F.mates.filter(m => m.on).map(man) : [],
    pass: P ? { pipe: !!P.pipe, bad: !!P.bad, drawn: P.drawn } : null, kept: localStorage.getItem('twopointsix.findme'), fatal: (document.querySelector('#fatal') || {}).textContent || '' }; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errs = [], warns = []; let fails = 0;
  const line = (ok, what, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  const keep = (name, u) => { if (outDir && u) { fs.writeFileSync(path.join(outDir, name), Buffer.from(u.split(',')[1], 'base64')); log(`kept ${name}`); } };
  /** a browser of its own (nothing kept but `kept`), the page booted on `words`, a squad of four stood in the dark */
  const open = async (words, kept) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 });
    if (kept != null) await ctx.addInitScript(([k, v]) => { try { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch {} }, [LS, kept]);
    const page = await ctx.newPage(); page.setDefaultNavigationTimeout(900000); page.setDefaultTimeout(1800000);
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));   // (a GPU validation error is the page's own console.error: gpu/device.ts)
    page.on('console', m => { if (/Failed to load resource/.test(m.text())) return; if (m.type() === 'error') errs.push(m.text().slice(0, 300)); else if (m.type() === 'warning') warns.push(m.text().slice(0, 200)); });
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&squad4${words}`; log(url);
    await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20);
    await page.evaluate(() => { window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; });
    await page.evaluate(STEP, 30); log('booted');
    return { ctx, page };
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const BUILT = { outline: false, width: 1, mates: 1, colour: 0.6, opacity: 0.6, picture: true, ring: false, pan: 1, turn: 1 }, TUNED = { ...BUILT, outline: true, width: 0.25, mates: 0.8, colour: 0.5 };
  try {
    // fresh: nothing kept, no word
    { const { ctx, page } = await open('', null);
      let s = await page.evaluate(STATE);
      line(same(s.table, TUNED) && s.kept == null && !!s.you && s.you.on && s.you.wide === 0.25 && s.mates.length === 4 && s.mates.every(m => m.wide === 0.25 && m.times === 0.8),
        'a browser that has kept nothing, the page with no word: the outline is on at the tuned numbers, and the renderer\'s frame has his man and four teammates so', JSON.stringify({ table: s.table, kept: s.kept, you: s.you, mates: s.mates }));
      for (let i = 0; i < 40 && !(s.pass && (s.pass.pipe || s.pass.bad)); i++) { await page.evaluate(DRAW, 1); await new Promise(r => setTimeout(r, 1000)); s = await page.evaluate(STATE); }   // (the program compiles off the frame)
      const d0 = s.pass ? s.pass.drawn : 0, pic = await page.evaluate(DRAW, 6), s2 = await page.evaluate(STATE); if (pic) keep('findtuned-fresh.png', pic.full);
      line(!!s2.pass && s2.pass.pipe && !s2.pass.bad && s2.pass.drawn > d0 && !!pic && !s2.fatal,
        'its one program compiles and the rims are drawn on the page (frames counted)', `program ${s2.pass ? (s2.pass.pipe ? 'in' : s2.pass.bad ? 'FAILED' : 'not in') : 'NO PASS'} · frames drawn ${d0} → ${s2.pass ? s2.pass.drawn : '?'} · strongly coloured pixels in the men's boxes ${pic ? pic.ink : '?'} (said, not judged: at a quarter of its width the rim is a few per cent of one pixel, and this count was made for whole rims)${s2.fatal ? ` · the error card: ${s2.fatal.slice(0, 120)}` : ''}`);
      // the Options screen says so, a row put Off is kept as Off, and Reset puts the page's starts back
      let e = await page.evaluate(OPEN); if (e) throw new Error(e); const o0 = await page.evaluate(ROWS), four = r => ['Outline in the dark', 'Outline width', 'Teammate outline width', 'Outline colour'].map(l => r.rows[l]).join(' · ');
      e = await page.evaluate(FLIP, 'Outline in the dark'); if (e) throw new Error(e); const o1 = await page.evaluate(ROWS);
      e = await page.evaluate(RESET); if (e) throw new Error(e); const o2 = await page.evaluate(ROWS), WANT = 'On · 25 % · 80 % · 50 %';
      line(four(o0) === WANT && o0.kept == null && o1.rows['Outline in the dark'] === 'Off' && o1.kept === '{"outline":false}' && four(o2) === WANT && o2.kept === '{}',
        'Options > Game shows the outline On at 25 %, teammates 80 %, colour 50 %; put Off it is kept as Off; Reset to defaults puts those back', `as it opens: ${four(o0)}, kept ${o0.kept} · flipped: ${o1.rows['Outline in the dark']}, kept ${o1.kept} · Reset: ${four(o2)}, kept ${o2.kept}`);
      await ctx.close(); }
    // the word: the rows as built, no pass at all
    { const { ctx, page } = await open('&findtuned=0', null); await page.evaluate(DRAW, 3); const s = await page.evaluate(STATE);
      line(same(s.table, BUILT) && s.kept == null && (!s.you || !s.you.on) && !s.mates.length && !s.pass, '?findtuned=0: every row as built, the frame off, the pass never made', JSON.stringify({ table: s.table, you: s.you, mates: s.mates.length, pass: s.pass }));
      await ctx.close(); }
    // kept Off: stays off, and the line is not written away
    { const { ctx, page } = await open('', '{"outline":false}'); await page.evaluate(DRAW, 3); const s = await page.evaluate(STATE);
      line(s.table.outline === false && s.table.width === 0.25 && s.kept === '{"outline":false}' && (!s.you || !s.you.on) && !s.pass, 'a browser that kept the row Off: off on the plain page, its line as it was', JSON.stringify({ table: s.table, kept: s.kept, you: s.you, pass: s.pass }));
      await ctx.close(); }
  } catch (e) { fails++; console.log(`- FAIL — the run itself: ${String(e && e.stack || e).slice(0, 600)}`); }
  line(!errs.length, 'no page error, no console error (a GPU validation error is one)', (errs.length ? errs.slice(0, 8).join('\n    ') : 'none') + (warns.length ? `\n    warnings, not judged: ${warns.slice(0, 4).join(' | ')}` : ''));
  await browser.close();
  console.log(fails ? `\nfindtuned-page: ${fails} FAIL` : '\nfindtuned-page: ALL PASS'); process.exit(fails ? 1 : 0);
})();
