// lightwork/cutview — the office-night pinned view of draw-equal.cjs with three traceable CUT PIECES stood in it (__cut.test), so the cut set of ray programs is on the frame (awaited ready, 'live' logged):
//   node tools/qa/lightwork/cutview.cjs <port> <out prefix> [1]   → <out>-a.rgba / -b.rgba after drawn frames 3 and 7 (cmp two builds' files), <out>.json; exit 1 on a console / page error.
// With the trailing 1: then the three lighting trade rows on with the pieces alive — every trade twin compiled (both preludes × both motion variants), three more frames drawn, <out>-rows.rgba.
const fs = require('fs'), crypto = require('crypto');
const { VIEWS, PREP, FLAGS, NOISE, BANNER } = require('../draw-equal.cjs');
const [port, out, rows] = [Number(process.argv[2]), process.argv[3], process.argv[4] === '1'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const READ = async () => { const E = window.__engine; const fr = await E.readbackFrame(); const d = fr.data; if (fr.bgra) for (let i = 0; i < d.length; i += 4) { const b = d[i]; d[i] = d[i + 2]; d[i + 2] = b; }
  for (let i = 3; i < d.length; i += 4) d[i] = 255; let s = ''; const CH = 0x8000; for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH)); return { w: fr.w, h: fr.h, b64: btoa(s) }; };
(async () => {
  const { chromium } = require('/opt/node-tools/node_modules/playwright'); const errors = [];
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); let noise = 0;
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && t !== 'warning') return; if (/Failed to load resource/.test(x) || (t === 'warning' && BANNER.test(x))) return; if (NOISE.test(x) && noise < 80) noise++; else errors.push(`${t}: ${x.slice(0, 400)}`); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  await page.goto(`http://localhost:${port}/?paused&quality=high&mute`);
  const pipes = await page.evaluate(async () => { await window.__ready; return window.__boot.pipelines; }); log('booted', JSON.stringify(pipes));
  await page.evaluate(PREP, 4242); await page.evaluate(VIEWS['office-night'].stage);
  await page.evaluate((n) => { const DE = window.__de; DE.zeroPhases(); DE.play(n); window.__resetClock(); }, 6);
  const built = await page.evaluate(async () => { const ok = await window.__cut.programs.ready; return { ok, info: window.__cut.programs.info }; }); log('cut programs', JSON.stringify(built));
  await page.evaluate(() => { const C = window.__cut; C.test([24.2, 0, 11.5], 'wedge'); C.test([26.0, 0, 10.7], 'lump', { scale: 1.6 }); C.test([25.2, 0, 11.0], 'snap', { yaw: 0.6 }); });
  const shot = async (tag, n) => { await page.evaluate((k) => window.__de.draw(k), n); const info = await page.evaluate(() => ({ p: window.__cut.programs.info, s: window.__cut.stats })); const cap = await page.evaluate(READ);
    const rgba = Buffer.from(cap.b64, 'base64'), sha = crypto.createHash('sha256').update(rgba).digest('hex'); fs.writeFileSync(`${out}-${tag}.rgba`, rgba); log(tag, `sha ${sha}`, `cut live ${info.p.live} state ${info.p.state} traced ${info.s.traced} drawnWhole ${info.s.drawnWhole}`); return { sha, info }; };
  const R = { pipes, built, a: await shot('a', 3), b: await shot('b', 4) };
  if (rows) {
    await page.evaluate(() => { Object.assign(window.__engine.settings, { heldAdaptive: true, restirStableRetrace: true, restirDimClass: 0.05 }); }); await page.evaluate(() => window.__de.draw(1));
    R.twin = await page.evaluate(async () => { const P = window.__engine.passes; for (let i = 0; i < 900; i++) { const v = [...P.restirTrade.entries()]; if (v.length && v.every(x => x[1])) return v.map(x => x[0]); await new Promise(r => setTimeout(r, 200)); } return 'TIMEOUT ' + JSON.stringify([...P.restirTrade.entries()].map(x => [x[0], !!x[1]])); });
    log('trade twins compiled', JSON.stringify(R.twin)); R.rowsOn = await shot('rows', 3);
    R.cutLiveUnderRows = R.rowsOn.info.p.live;
  }
  R.errors = errors; errors.forEach(e => console.log('  >', e)); fs.writeFileSync(out + '.json', JSON.stringify(R, null, 1)); await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 1200)); process.exit(2); });
