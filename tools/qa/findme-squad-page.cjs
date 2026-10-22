// THE OUTLINE ROUND A SQUAD, ON THE REAL PAGE (src/render/outline.ts, src/ui/findme.ts findMeOutline): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the page opened on a squad of four with the outline kept on, every rim at its full and in full colour.
// findme-page.cjs opens the page with no squad, so its pass draws one man from the first slot; this is the one that asks a real device for a draw a man.
//   PORT=5241 node tools/qa/findme-squad-page.cjs [outDir]     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   frame    the renderer's frame has the player's own man and four teammates on, each with an owner of his own, the player's ink yellow, two red, two blue
//   device   the pass's one program compiled on this adapter, and frames drawn with it: several men in one pass, each from his own slot of the uniform
//            buffer, with no GPU error and no console error
//   exit 0 = all of it · 1 = otherwise. The verdict is the game's numbers and the page's console: nothing here judges a picture. With an outDir it keeps two
//   pictures (the squad as the page frames it, whole and cut to the men) for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const LS = 'twopointsix.findme', KEPT = { outline: true, lit: 1, dark: 1, opacity: 1, colour: 1 };   // (shows under any light, at its full: the rims whatever the light on the men)

const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
// in the page: draw n frames one at a time, read the last one back as PNG data URLs — the whole frame, and the box round every man rimmed, enlarged
const DRAW = async (n) => {
  const E = window.__engine, dev = E.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  E.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await E.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  const all = [E.outline, ...E.outline.mates.filter(m => m.on)].map(m => m.rect).filter(q => q[2] > q[0]);
  const r = all.length ? [Math.min(...all.map(q => q[0])), Math.min(...all.map(q => q[1])), Math.max(...all.map(q => q[2])), Math.max(...all.map(q => q[3]))] : [0.3, 0.3, 0.7, 0.7];
  const x0 = Math.max(0, Math.floor(r[0] * fr.w)), y0 = Math.max(0, Math.floor(r[1] * fr.h)), w = Math.min(fr.w, Math.ceil(r[2] * fr.w)) - x0, h = Math.min(fr.h, Math.ceil(r[3] * fr.h)) - y0;
  let crop = null; if (w > 0 && h > 0) { const k = Math.max(1, Math.floor(1400 / Math.max(w, h))), c3 = document.createElement('canvas'); c3.width = w * k; c3.height = h * k; const x = c3.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c2, x0, y0, w, h, 0, 0, w * k, h * k); crop = c3.toDataURL('image/png'); }
  return { full: c2.toDataURL('image/png'), crop };
};
const STATE = () => { const E = window.__engine, P = E.passes.outlinePass, F = E.outline, man = m => ({ on: m.on, owner: m.owner, strength: +m.strength.toFixed(2), ink: m.ink.map(v => +v.toFixed(2)), wide: m.wide, times: m.times, boxed: m.rect[2] > m.rect[0] });
  return { you: F ? man(F) : null, mates: F ? F.mates.map(man) : [], pass: P ? { pipe: !!P.pipe, bad: !!P.bad, drawn: P.drawn } : null, fatal: (document.querySelector('#fatal') || {}).textContent || '' }; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [LS, JSON.stringify(KEPT)]);
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(900000); page.setDefaultTimeout(1800000);
  const errs = [], warns = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));   // (a GPU validation error is the page's own console.error: gpu/device.ts)
  page.on('console', m => { if (/Failed to load resource/.test(m.text())) return; if (m.type() === 'error') errs.push(m.text().slice(0, 300)); else if (m.type() === 'warning') warns.push(m.text().slice(0, 200)); });
  let fails = 0; const line = (ok, what, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  const keep = (name, u) => { if (outDir && u) { fs.writeFileSync(path.join(outDir, name), Buffer.from(u.split(',')[1], 'base64')); log(`kept ${name}`); } };
  try {
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&squad4`; log(url);
    await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20); log('booted');
    await page.evaluate(() => { window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; });
    await page.evaluate(STEP, 30);
    const s0 = await page.evaluate(STATE), near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.02), on = s0.mates.filter(m => m.on);
    const YOU = [0.95, 0.72, 0.12], RED = [0.95, 0.22, 0.16], BLUE = [0.2, 0.45, 1];
    line(!!s0.you && s0.you.on && on.length === 4 && new Set([s0.you.owner, ...on.map(m => m.owner)]).size === 5 && near(s0.you.ink, YOU) && on.filter(m => near(m.ink, RED)).length === 2 && on.filter(m => near(m.ink, BLUE)).length === 2 && on.every(m => m.wide === s0.you.wide && m.times === 1),
      'the frame has his own man and four teammates, an owner each, yellow for him, two red, two blue', JSON.stringify({ you: s0.you, mates: s0.mates }));
    // the program compiles off the frame: draw until it is in, then draw with it
    let s1 = s0; for (let i = 0; i < 40 && !(s1.pass && (s1.pass.pipe || s1.pass.bad)); i++) { await page.evaluate(DRAW, 1); await new Promise(r => setTimeout(r, 1000)); s1 = await page.evaluate(STATE); }
    const d0 = s1.pass ? s1.pass.drawn : 0, pic = await page.evaluate(DRAW, 6), s2 = await page.evaluate(STATE);
    if (pic) { keep('findme-squad.png', pic.full); keep('findme-squad-men.png', pic.crop); }
    const boxed = [s2.you, ...s2.mates.filter(m => m.on)].filter(m => m && m.boxed).length;
    line(!!s2.pass && s2.pass.pipe && !s2.pass.bad && s2.pass.drawn - d0 >= 6 && boxed >= 2 && !s2.fatal,
      'the pass\'s program compiled on this adapter and frames were drawn with it, several men in the one pass', `program ${s2.pass && s2.pass.pipe ? 'in' : 'NOT in'}${s2.pass && s2.pass.bad ? ' (failed)' : ''} · frames drawn with it ${s2.pass ? s2.pass.drawn - d0 : 0} · men with a box on the picture ${boxed}${s2.fatal ? ` · the page's fatal line: ${s2.fatal.slice(0, 200)}` : ''}`);
  } catch (e) { fails++; console.log(`- FAIL — the run threw\n    ${String(e).slice(0, 600)}`); }
  line(!errs.length, 'no page error, no console error (a GPU validation error is one)', (errs.length ? errs.slice(0, 8).join('\n    ') : 'none') + (warns.length ? `\n    warnings, not judged: ${warns.slice(0, 4).join(' | ')}` : ''));
  await browser.close();
  console.log(fails ? `\n=== findme-squad-page: ${fails} FAILED ===` : '\n=== findme-squad-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})();
