// WEATHER LOOK: one software-rendered still per (level, weather, view). Boots the real page in headless Chromium on the SwiftShader WebGPU adapter (the
// recipe of tools/qa/page-look.cjs), stages the scenario the query names, pins the camera on each of the level's views and reads the frame back.
//
//   node weather-look.cjs <outDir> name=query [name=query ...]
//       e.g.  barracks-rain='levelFile=barracks.json&roomclear&squad4&weather=rain'   (the query is passed through verbatim: any extra text works)
//       → <outDir>/<name>-<view>.png (+ -stroke.png under STRIKE=1) and <outDir>/report.json (report-<first name>.json too, so parallel runs do not collide)
//   env: PORT (dev server, default 5231) · SIZE (default 960x540) · QUALITY (default medium) · FRAMES (drawn frames per still; default by quality, see
//        FRAMES_BY_QUALITY; a comma list '4,8,16' also saves <name>-<view>-f4.png … and reports the mean abs difference between successive readbacks)
//        · VIEW (comma list of view names, default every view of the level) · STRIKE=1 (a lightning stroke frame after the plain still)
//        · PINS='{"mine":{"look":[x,y,z],"yaw":deg,"pitch":deg,"dist":m}}' (ad-hoc views added to every job; with VIEW unset they are drawn after the table's)
//        · EVAL='<async function body>' (run in the page after the stills; its return value lands in the job's report.eval)
//        · PRE='<async function body>' (run in the page once staged, before the undrawn SECS and the stills: the scene set up — a door held open; report.pre)
//        · PAR (pages at once, each in its own browser; default 1 — on a 4-core box 2 is the ceiling) · SECS (sim seconds played undrawn before the stills, default 2)
//   node weather-look.cjs --sheet <outDir> <level> <view> name1 name2 ...
//       → <outDir>/sheet-<level>-<view>.png: a labelled contact sheet (ImageMagick montage) of <outDir>/<nameN>-<view>.png
//
// The level of a job is read from its query (levelFile=<file>; absent = office.json). A level with no row in VIEWS gets DEFAULT_VIEWS.
// What counts as an error (report.errors, exit code 1): any console error, any console warning (the adapter's four boot banners excepted, counted in `banners`), any
// pageerror, any failed request / http ≥ 400 (the favicon excepted), a play step that threw, a frame that did not read back. Smoke is NOT switched off.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- THE VIEWS. yaw / pitch in DEGREES (converted for __stage), look in world metres, dist in metres. yaw 0 looks north (−z) from the south, +90 looks west
// from the east. The game's own follow camera is yaw −22°, pitch 55°, distance 21, fov 28° (src/game/camera.ts): pitch stays at 55 throughout.
const VIEWS = {
  'compound.json': {
    wide: { look: [20, 0, 14.6], yaw: 0, pitch: 55, dist: 48 },
    yard: { look: [21.5, 0, 21.6], yaw: -90, pitch: 55, dist: 14 }, // the yard by the lit main gate (lamp_gate), the house's front door and south wall beyond
  },
  'barracks.json': {
    wide: { look: [20, 0, 14.6], yaw: 0, pitch: 55, dist: 48 },
    yard: { look: [17.5, 0, 14.0], yaw: 90, pitch: 55, dist: 14 },   // the courtyard under yard_lamp, both wings' edges
  },
  'warehouse.json': {
    wide: { look: [20, 0, 14.6], yaw: 0, pitch: 55, dist: 48 },
    yard: { look: [35.6, 0, 16.9], yaw: 90, pitch: 55, dist: 14 },       // the loading dock's strip under yard_lamp_e, looking west at the dock doors
  },
  'block-squads.json': {
    wide: { look: [20, 0, 14.6], yaw: 0, pitch: 55, dist: 48 },
    yard: { look: [35.8, 0, 13.6], yaw: 90, pitch: 55, dist: 13 },       // the east strip under street_lamp_e, the fire exit
  },
};
const DEFAULT_VIEWS = { wide: { look: [20, 0, 14.6], yaw: 0, pitch: 55, dist: 48 }, yard: { look: [20, 0, 26], yaw: -22, pitch: 55, dist: 13 } };
// drawn frames a still needs before it stops changing, per quality (measured; see the hand-over note)
const FRAMES_BY_QUALITY = { verylow: 8, low: 8, medium: 12, high: 16, ultra: 16 };

const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const BANNER = /WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// ---------------------------------------------------------------------------------------------------------------- --sheet
if (process.argv[2] === '--sheet') {
  const [outDir, level, view, ...names] = process.argv.slice(3);
  if (!outDir || !level || !view || !names.length) { console.error('usage: weather-look.cjs --sheet <outDir> <level> <view> name1 name2 ...'); process.exit(2); }
  const args = [], missing = [];
  for (const n of names) { const f = path.join(outDir, `${n}-${view}.png`); if (fs.existsSync(f)) args.push('-label', n, f); else missing.push(f); }
  if (!args.length) { console.error('no stills found: ' + missing.join(', ')); process.exit(1); }
  const cols = names.length <= 3 ? names.length : names.length <= 4 ? 2 : 3;
  const out = path.join(outDir, `sheet-${level.replace(/\.json$/, '')}-${view}.png`);
  execFileSync('montage', [...args, '-tile', `${cols}x`, '-geometry', '+6+6', '-background', '#101214', '-fill', '#e8e8e8', '-pointsize', '20',
    '-title', `${level} · ${view}`, out], { stdio: 'inherit' });
  console.log(out + (missing.length ? `   (missing: ${missing.join(', ')})` : ''));
  process.exit(missing.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------------------- stills
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const outDir = process.argv[2];
const jobs = process.argv.slice(3).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a, query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!outDir || !jobs.length) { console.error('usage: weather-look.cjs <outDir> name=query [name=query ...]   |   --sheet <outDir> <level> <view> names…'); process.exit(2); }
const PORT = process.env.PORT || 5231;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'medium';
const STEPS = String(process.env.FRAMES || FRAMES_BY_QUALITY[QUALITY] || 12).split(',').map(Number).filter(n => n > 0).sort((a, b) => a - b);
const ONLY = process.env.VIEW ? process.env.VIEW.split(',') : null;
const STRIKE = !!process.env.STRIKE && process.env.STRIKE !== '0';
const PINS = process.env.PINS ? JSON.parse(process.env.PINS) : {};
const PAR = Math.max(1, Number(process.env.PAR || 1));
const SECS = Number(process.env.SECS || 2);
const DEG = Math.PI / 180;
fs.mkdirSync(outDir, { recursive: true });

// in the page: draw n frames one at a time (each waited for), read the last one back; the mean luminance, and the mean abs difference (0‥255 per channel)
// from the readback before it (kept on window.__wlPrev; null across a camera change — the caller clears it)
const DRAW = async ({ n, dt }) => {
  const dev = window.__engine.device, t0 = performance.now();
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, dt); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  const t1 = performance.now();
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0, diff = null; const prev = window.__wlPrev;
  for (let i = 0; i < fr.data.length; i += 4) { sum += 0.2126 * fr.data[i] + 0.7152 * fr.data[i + 1] + 0.0722 * fr.data[i + 2]; fr.data[i + 3] = 255; }
  if (prev && prev.length === fr.data.length) { let d = 0, big = 0; for (let i = 0; i < fr.data.length; i += 4) { const a = Math.abs(fr.data[i] - prev[i]) + Math.abs(fr.data[i + 1] - prev[i + 1]) + Math.abs(fr.data[i + 2] - prev[i + 2]); d += a; if (a > 24) big++; }
    diff = { meanAbs: +(d / (fr.w * fr.h * 3)).toFixed(3), pctOver8: +(100 * big / (fr.w * fr.h)).toFixed(2) }; }
  window.__wlPrev = fr.data.slice();
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h)).toFixed(2), diff, secPerFrame: n ? +((t1 - t0) / 1000 / n).toFixed(1) : null, readbackSec: +((performance.now() - t1) / 1000).toFixed(1), url: c2.toDataURL('image/png') };
};
// in the page: run the page's own loop for `secs` of game time with the renderer stubbed out
const PLAY = (secs) => {
  const e = window.__engine, real = e.render; let threw = null;
  e.render = () => {};
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw;
};
const WEATHER = () => { const w = window.__weather; if (!w) return null; let s = null; try { s = w.summary(); } catch (x) { s = 'summary threw: ' + x; }
  return { summary: s, enabled: !!w.enabled, stroke: !!w.flash, kind: w.kind ?? null, rainRate: w.rainRate ?? null, storm: w.storm ?? null }; };

async function runJob(job) {
  const t0 = Date.now();
  const level = (/(?:^|&)levelFile=([^&]+)/.exec(job.query) || [])[1] ? decodeURIComponent(/(?:^|&)levelFile=([^&]+)/.exec(job.query)[1]) : 'office.json';
  const R = { name: job.name, query: job.query, level, quality: QUALITY, size: `${W}x${H}`, errors: [], banners: 0, notes: [], pipelines: null, views: {}, weather: null, seconds: 0 };
  const table = { ...(VIEWS[level] || DEFAULT_VIEWS), ...PINS };
  const views = (ONLY || Object.keys(table)).filter(v => { if (!table[v]) { R.errors.push(`no view '${v}' for ${level}`); return false; } return true; });
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && t !== 'warning') return;
    if (/Failed to load resource/.test(x)) return;   // (named with its URL by the response / requestfailed hooks below)
    if (t === 'warning' && BANNER.test(x)) { R.banners++; return; }
    R.errors.push(`${t}: ${x.slice(0, 500)}`); });
  page.on('requestfailed', r => R.errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText ?? '?'}`));
  page.on('response', r => { if (r.status() >= 400) { const u = r.url(); if (/favicon/.test(u)) R.notes.push(`${r.status()} ${u}`); else R.errors.push(`http ${r.status()}: ${u}`); } });
  page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
  const write = (file, cap) => fs.writeFileSync(path.join(outDir, file), Buffer.from(cap.url.split(',')[1], 'base64'));
  try {
    const url = `http://localhost:${PORT}/?paused&mute&quality=${QUALITY}${job.query ? '&' + job.query : ''}`;
    log(job.name, 'goto', url);
    await page.goto(url);
    const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true;
      return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines ?? null, internal: [window.__engine.width, window.__engine.height], out: [window.__engine.outWidth, window.__engine.outHeight] }; });
    R.pipelines = ready.pipelines; R.internal = ready.internal; R.bootSeconds = +((Date.now() - t0) / 1000).toFixed(0);
    log(job.name, 'ready', JSON.stringify(ready)); if (ready.fatal) R.errors.push('fatal: ' + ready.fatal);
    if (ready.pipelines && ready.pipelines.failed) R.errors.push(`${ready.pipelines.failed} pipelines failed to build`);
    R.staged = await page.evaluate(() => { window.__menu.close(); const g = window.__game, r = (p) => [+p[0].toFixed(1), +p[2].toFixed(1)];
      return { sam: r(g.player.char.pos), men: g.guards.length, squad: window.__orders?.squad?.().map(m => r(m.char.pos)) ?? null,
        scenario: g.roomClear?.active ? 'roomclear' : g.nightBreach?.active ? 'nightbreach' : g.rescue?.active ? 'rescue' : null, smoke: window.__smoke?.params?.enabled ?? null }; });
    if (process.env.PRE) { try { R.pre = await page.evaluate(`(async () => { ${process.env.PRE} })()`); log(job.name, 'pre', JSON.stringify(R.pre)); } catch (x) { R.errors.push('pre: ' + String(x && x.stack || x).slice(0, 800)); } }   // PRE='<async function body>': run in the page once staged, BEFORE the undrawn seconds and the stills (hold a door open, park somebody)
    let threw = await page.evaluate(PLAY, SECS); if (threw) R.errors.push('play threw: ' + threw);
    R.weather = await page.evaluate(WEATHER);
    log(job.name, 'staged', JSON.stringify(R.staged), JSON.stringify(R.weather));
    for (const v of views) {
      const P = table[v], V = R.views[v] = { pin: P, frames: STEPS[STEPS.length - 1], steps: [] }, tv = Date.now();
      // a stroke of the storm's own in flight would be in the still: play it out first (undrawn)
      for (let k = 0; k < 3 && await page.evaluate(() => !!window.__weather?.flash); k++) { V.waitedOutStroke = true; threw = await page.evaluate(PLAY, 0.6); if (threw) R.errors.push('play threw: ' + threw); }
      V.applied = await page.evaluate((p) => { window.__wlPrev = null; return window.__stage(p, {})?.pin ?? null; }, { look: P.look, yaw: P.yaw * DEG, pitch: P.pitch * DEG, dist: P.dist }).catch(x => { R.errors.push(`${v}: stage threw: ${x}`); return null; });
      let done = 0, cap = null;
      for (const n of STEPS) {
        cap = await page.evaluate(DRAW, { n: n - done, dt: 1 / 600 }); done = n;
        if (!cap || cap.err) { R.errors.push(`${v}: ${cap ? cap.err : 'no capture'} at frame ${n}`); break; }
        V.steps.push({ frames: n, mean: cap.mean, diffFromPrev: cap.diff, secPerFrame: cap.secPerFrame });
        if (n !== STEPS[STEPS.length - 1]) write(`${job.name}-${v}-f${n}.png`, cap);
        log(job.name, v, `f${n} mean ${cap.mean}`, cap.diff ? `Δ ${cap.diff.meanAbs}` : '', `${cap.secPerFrame} s/frame`);
      }
      if (cap && cap.url) { V.file = `${job.name}-${v}.png`; V.mean = cap.mean; V.size = `${cap.w}x${cap.h}`; V.secPerFrame = cap.secPerFrame; write(V.file, cap); }
      V.naturalStroke = await page.evaluate(() => !!window.__weather?.flash);   // (true = the storm's own stroke lit this still: draw it again)
      if (STRIKE && cap && cap.url) {
        const st = await page.evaluate(() => { const w = window.__weather; if (!w) return { why: 'no __weather' }; if (!w.enabled) return { why: '__weather not enabled' };
          const f = w.strike({ bearing: 0.6, elevDeg: 40, distKm: 0.5, peak: 18 }); return f ? { fired: true } : { why: 'strike() returned null (weather off or held)' }; });
        if (st.fired) {
          const sc = await page.evaluate(DRAW, { n: 1, dt: 1 / 60 });
          if (sc && sc.url) { write(`${job.name}-${v}-stroke.png`, sc); V.stroke = { file: `${job.name}-${v}-stroke.png`, mean: sc.mean, plainMean: cap.mean, brighter: sc.mean > cap.mean * 1.05, diff: sc.diff }; }
          else { V.stroke = { err: sc?.err ?? 'no capture' }; R.errors.push(`${v}: stroke frame did not read back`); }
          threw = await page.evaluate(PLAY, 0.7); if (threw) R.errors.push('play threw: ' + threw);   // (the stroke played out before the next view)
        } else V.stroke = { skipped: st.why };
        log(job.name, v, 'stroke', JSON.stringify(V.stroke));
      }
      V.seconds = +((Date.now() - tv) / 1000).toFixed(0);
    }
    R.weatherAfter = await page.evaluate(WEATHER);
    if (process.env.EVAL) { try { R.eval = await page.evaluate(`(async () => { ${process.env.EVAL} })()`); log(job.name, 'eval', JSON.stringify(R.eval)); } catch (x) { R.errors.push('eval: ' + String(x && x.stack || x).slice(0, 800)); } }   // EVAL='<async function body>': run in the page after the stills, its return value in report.eval
  } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); await page.screenshot({ path: path.join(outDir, `${job.name}-fail-page.png`) }).catch(() => {}); }
  R.seconds = +((Date.now() - t0) / 1000).toFixed(0);
  log(job.name, R.errors.length ? `ERRORS ${R.errors.length}` : 'clean', `${R.seconds} s`); R.errors.slice(0, 12).forEach(e => console.log('   >', e));
  await browser.close().catch(() => {});
  return R;
}

(async () => {
  const report = new Array(jobs.length); let next = 0;
  const worker = async () => { for (;;) { const i = next++; if (i >= jobs.length) return; report[i] = await runJob(jobs[i]).catch(e => ({ name: jobs[i].name, query: jobs[i].query, errors: ['runner: ' + String(e && e.stack || e).slice(0, 800)] })); } };
  await Promise.all(Array.from({ length: Math.min(PAR, jobs.length) }, worker));
  const out = { at: new Date().toISOString(), port: PORT, size: `${W}x${H}`, quality: QUALITY, frames: STEPS, par: PAR, strike: STRIKE, wallSeconds: +((Date.now() - T0) / 1000).toFixed(0), jobs: report };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(outDir, `report-${jobs[0].name}.json`), JSON.stringify(out, null, 1));
  const bad = report.filter(r => r.errors.length);
  console.log(bad.length ? `=== weather-look: ${bad.length} of ${report.length} with errors: ${bad.map(r => r.name).join(', ')} ===` : `=== weather-look: ${report.length} jobs clean ===`, `${out.wallSeconds} s`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
