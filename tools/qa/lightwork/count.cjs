// lightwork/count — SHADOW RAYS PER PIXEL of the direct-light pass, counted by the pass itself (restir.wgsl debug view 12 writes each pixel's traced rays into its
// own output), on draw-equal's pinned views under the software WebGPU adapter — one row of settings at a time against the build's own defaults.
//
//   node tools/qa/lightwork/count.cjs <out.json> [--port 5262] [--views office-night,records-inside,squad-cast] [--size 480x270] [--quality high] [--first 8] [--warm 4] [--frames 2] [--pic 4] [--rows a,b]
//
// A COUNT, not a timing: nothing here says what a ray costs on a real GPU, only how many the pass asked for. Per view the page boots once (draw-equal's PREP: seeded dice,
// rAF never run, a fresh encounter, the view's own staging); `first` drawn frames under the debug view fill the reservoirs; then per row: the row's settings over the defaults, `warm` drawn frames (hints and beliefs settle under the
// row; the reservoirs carry over from row to row), then `frames` drawn frames whose direct S target is read back (rgba16float: r = rays ÷ 6) and averaged. A second pass
// draws each row `pic` frames with the debug view off and reads the frame's mean — a row that moved the picture's energy shows there.
//
// WHAT THIS IS NOT: a look A/B. The rows run one after another in ONE booted page (the game steps a frame per drawn frame, so the scene drifts a little from row to row —
// the closing `baseAgain` row is the defaults counted a second time: the gap between it and `base` is that drift, and a row's saving under it is not a result). The picture
// mean is a coarse energy check only; judging a row's look takes a fresh boot per configuration (CLAUDE.md, one config per fresh boot). Views that stage per drawn frame
// (draw-equal's `before`) are refused: this loop does not run their hook.
const fs = require('fs');
const { VIEWS, PREP, FLAGS, NOISE, BANNER } = require('../draw-equal.cjs');
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
// the rows: what the lighting page prices. The first three are this lane's trades (default off); the rest exist at base.
const ROWS = {
  base: {},
  heldAdaptive: { heldAdaptive: true },
  stableRetrace: { restirStableRetrace: true },
  dimClass5: { restirDimClass: 0.05 },
  allThree: { heldAdaptive: true, restirStableRetrace: true, restirDimClass: 0.05 },
  penRaysOff: { restirPenRays: false },
  rays3: { restirRays: 3 },
  held2: { heldRays: 2 },
  baseAgain: {},   // the defaults once more, last: the drift check
};
const PIC = ['base', 'heldAdaptive', 'stableRetrace', 'dimClass5', 'allThree', 'baseAgain'];   // the rows whose picture mean is read (the trades against the defaults; baseAgain last = how far the pass itself drifts)
const EXTRA_VIEWS = {
  // take 1's mission (the records office, the pair): the hall and two of its rooms from the camera the scripted play holds there at 30 s
  'records-inside': { query: 'levelFile=records.json&roomclear', settle: 6,
    stage: () => window.__stage({ look: [13.7, 0, 15.7], yaw: -0.38, pitch: 0.96, dist: 10.5 }, {}) },
  // … and where that play starts: the pair in the dark lot outside the door (take 1's first seconds: the same light list, a third of the direct pass's time)
  'records-outside': { query: 'levelFile=records.json&roomclear', settle: 6,
    stage: () => window.__stage({ look: [13, 0, 26.9], yaw: -0.38, pitch: 0.96, dist: 10.5 }, {}) },
};
// in the page: draw n frames; read the direct S target of class 0 back and sum its red channel (rays ÷ 6)
const COUNT = async (n) => {
  const E = window.__engine, P = E.passes, DE = window.__de; let rays = 0, lit = 0, px = 0; const hist = new Array(20).fill(0);
  const h2f = (h) => { const e = (h >> 10) & 31, m = h & 1023; return e === 0 ? m * Math.pow(2, -24) : e === 31 ? Infinity : (1 + m / 1024) * Math.pow(2, e - 15); };
  for (let i = 0; i < n; i++) {
    await DE.draw(1);
    const tex = P.dS[0], w = tex.width, h = tex.height, bpr = Math.ceil(w * 8 / 256) * 256;
    const buf = E.device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = E.device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]); E.device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ); const u = new Uint16Array(buf.getMappedRange());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.round(h2f(u[(y * bpr >> 1) + x * 4]) * 6); rays += r; if (r > 0) lit++; hist[Math.min(19, r)]++; px++; }
    buf.unmap(); buf.destroy();
  }
  return { w: P.dS[0].width, h: P.dS[0].height, frames: n, raysPerPixel: +(rays / px).toFixed(4), raysPerTracingPixel: +(rays / Math.max(1, lit)).toFixed(4), tracingShare: +(lit / px).toFixed(4), hist: hist.map(c => +(c / px).toFixed(4)) };
};
const MEAN = async (n) => { const E = window.__engine, DE = window.__de; await DE.draw(n); const fr = await E.readbackFrame(); let s = 0; for (let i = 0; i < fr.data.length; i += 4) s += fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; return +(s / (fr.w * fr.h * 3)).toFixed(3); };
const LIGHTS = () => { const E = window.__engine, L = E.lights.lights.filter(l => (l.slot ?? -1) >= 0); return { lights: L.length, held: L.filter(l => l.owner && !(l.ttl >= 0 || l.transient)).length, broad: L.filter(l => l.broad).length, internal: [E.width, E.height], quality: window.__quality && window.__quality.current, restir: { rays: E.settings.restirRays, held: E.settings.heldRays, spatial: E.settings.restirSpatial, penRays: E.settings.restirPenRays, spatialAll: E.settings.restirSpatialAll, audit: E.settings.restirAudit } }; };

function args(argv) { const pos = [], opt = {}; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const eq = a.indexOf('='); if (eq > 0) opt[a.slice(2, eq)] = a.slice(eq + 1); else opt[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; } else pos.push(a); } return { pos, opt }; }
(async () => {
  const { pos, opt } = args(process.argv.slice(2)); if (pos.length !== 1) { console.error('usage: count.cjs <out.json> [--port 5262] [--views a,b] [--size 480x270] [--quality high] [--warm 4] [--frames 2] [--rows a,b]'); process.exit(2); }
  const ALL = { ...VIEWS, ...EXTRA_VIEWS }, views = (opt.views || 'office-night,records-inside,squad-cast').split(','), rows = (opt.rows || Object.keys(ROWS).join(',')).split(',');
  for (const v of views) if (!ALL[v]) { console.error('unknown view ' + v); process.exit(2); }
  for (const r of rows) if (!ROWS[r]) { console.error('unknown row ' + r); process.exit(2); }
  for (const v of views) { if (ALL[v].before) { console.error(`view ${v} stages every drawn frame (draw-equal's before hook) — not counted here`); process.exit(2); } }
  const [W, H] = (opt.size || '480x270').split('x').map(Number), warm = Number(opt.warm || 4), frames = Number(opt.frames || 2), first = Number(opt.first || 8), pic = Number(opt.pic === undefined ? 4 : opt.pic), port = Number(opt.port || 5262), quality = opt.quality || 'high';
  const { chromium } = require('/opt/node-tools/node_modules/playwright'); const out = { size: `${W}x${H}`, quality, warm, frames, rows: ROWS, views: {} };
  for (const name of views) {
    const V = ALL[name], R = out.views[name] = { query: V.query, errors: [], rows: {} };
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
    try {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); let noise = 0;
      page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && t !== 'warning') return; if (/Failed to load resource/.test(x) || (t === 'warning' && BANNER.test(x))) return; if (NOISE.test(x) && noise < 80) noise++; else R.errors.push(`${t}: ${x.slice(0, 400)}`); });
      page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
      await page.goto(`http://localhost:${port}/?paused&quality=${quality}&mute${V.query ? '&' + V.query : ''}`);
      R.pipelines = await page.evaluate(async () => { await window.__ready; return window.__boot ? window.__boot.pipelines : null; });
      await page.evaluate(PREP, 4242); R.staged = await page.evaluate(V.stage);
      await page.evaluate((n) => { const DE = window.__de; DE.zeroPhases(); DE.play(n); window.__resetClock(); }, V.settle);
      const defaults = await page.evaluate((keys) => { const S = window.__engine.settings, o = {}; for (const k of keys) o[k] = S[k]; return o; }, [...new Set(Object.values(ROWS).flatMap(r => Object.keys(r)))]);
      R.defaults = defaults; log(name, 'booted', JSON.stringify(R.pipelines), JSON.stringify(defaults));
      // phase A, the debug view up throughout (switching it restarts histories): per row the settings, the warm frames, the counted frames
      await page.evaluate(() => { window.__engine.settings.debugView = 12; });
      await page.evaluate((n) => window.__de.draw(n), first);
      for (const row of rows) {
        const t = Date.now();
        await page.evaluate(({ d, r }) => { Object.assign(window.__engine.settings, d, r); }, { d: defaults, r: ROWS[row] });
        await page.evaluate((n) => window.__de.draw(n), 1);
        // a trade row's program is compiled on first use: wait for it before counting (the frame takes the plain program until then)
        const twin = await page.evaluate(async () => { const P = window.__engine.passes; if (!(P.heldAdaptive || P.restirStableRetrace || P.restirDimClass > 0)) return 'plain'; for (let i = 0; i < 600; i++) { const v = [...P.restirTrade.values()]; if (v.length && v.every(x => x)) return 'trade'; await new Promise(r => setTimeout(r, 500)); } return 'TIMEOUT'; });
        if (twin === 'TIMEOUT') { R.errors.push(`row ${row}: the trade twin never compiled — not counted`); R.rows[row] = { program: twin }; log(name, row.padEnd(14), 'TRADE TWIN TIMEOUT — row not counted'); continue; }
        await page.evaluate((n) => window.__de.draw(n), warm);
        const c = await page.evaluate(COUNT, frames), L = await page.evaluate(LIGHTS);
        R.rows[row] = { program: twin, ...c, lights: L, seconds: +((Date.now() - t) / 1000).toFixed(0) };
        log(name, row.padEnd(14), `rays/px ${c.raysPerPixel}  (per tracing px ${c.raysPerTracingPixel}, ${Math.round(c.tracingShare * 100)} % trace)  lights ${L.lights} held ${L.held}  [${twin}]  ${R.rows[row].seconds} s`);
        fs.writeFileSync(pos[0], JSON.stringify(out, null, 1));
      }
      // phase B, the picture itself: the frame's mean under each row after `pic` drawn frames from the same restart — a row that moved the picture's energy shows here
      if (pic > 0) for (const row of rows.filter(r => PIC.includes(r) && R.rows[r] && R.rows[r].program !== 'TIMEOUT')) {
        await page.evaluate(({ d, r }) => { Object.assign(window.__engine.settings, d, r); window.__engine.settings.debugView = 12; }, { d: defaults, r: ROWS[row] });
        await page.evaluate((n) => window.__de.draw(n), 1);   // (a frame under the debug view, then off: every row's picture starts from the same history restart)
        await page.evaluate(() => { window.__engine.settings.debugView = 0; });
        R.rows[row].pictureMean = await page.evaluate(MEAN, pic);
        log(name, row.padEnd(14), `picture mean ${R.rows[row].pictureMean}`);
        fs.writeFileSync(pos[0], JSON.stringify(out, null, 1));
      }
      await page.close();
    } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); }
    await browser.close().catch(() => {});
    R.errors.forEach(e => console.log('   >', e)); fs.writeFileSync(pos[0], JSON.stringify(out, null, 1));
  }
  process.exit(Object.values(out.views).some(v => v.errors.length) ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 1200)); process.exit(2); });
