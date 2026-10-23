// round-page.cjs — ROUND THINGS ON THE REAL PAGE (src/scene/round.ts): the pass booted twice in headless Chromium on the software WebGPU adapter (SwiftShader: the
// cloud box has no GPU), once with `round=0` (the kit's octagons, "before") and once as the page opens ("after"). Each boot must come ready with every pipeline
// compiled, no console or page error and no GPU validation error over the drawn frames, and say through window.__round what it stood up; then a still of the
// pass's brazier from a pinned camera (`--cam brazier,play` adds the game's own follow camera over the same spot).
//
//   node tools/qa/round-page.cjs --root <checkout dir> --out <dir> [--quality verylow] [--w 960 --h 540] [--settle 8] [--cam brazier,play] [--port N] [--only before|after] [--q 'a=1&b']
//
// Files: <out>/round-<camera>-<before|after>.png and <out>/round-page.json. Exit 0 = both boots clean and the switch read as asked; 1 otherwise.
// What this is NOT: a GPU. The software adapter draws the same programs, slowly, at the lowest preset; motion, a round's edge against a bright ground and what the
// round rule costs a frame have never been seen on one. The smoke solver is off (its pipelines cannot be made on SwiftShader), so no smoke is in a still.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
if (!flag('--root') || !flag('--out')) { console.error('usage: node round-page.cjs --root <checkout dir> --out <dir> [--quality verylow] [--w 960 --h 540] [--settle 8] [--cam brazier,play] [--port N] [--only before|after] [--q flags]'); process.exit(2); }
const ROOT = path.resolve(flag('--root')), OUT = path.resolve(flag('--out')), QUALITY = flag('--quality', 'verylow'), VW = Number(flag('--w', 960)), VH = Number(flag('--h', 540)), SETTLE = Number(flag('--settle', 8));
const DEG = Math.PI / 180, LEVEL = 'pass.json';
// metres; yaw / pitch in degrees; a camera sits at look + dist × (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch)
const ALL_CAMS = [
  { name: 'brazier', look: [19.6, 0.55, 13.6], yaw: 20, pitch: 38, dist: 3.4 },   // the pass's brazier: a drum with a fire in it
  { name: 'play', look: [19.6, 0, 13.6], yaw: -22, pitch: 55, dist: 21 },          // the game's own follow camera over the same spot
];
const CAMS = flag('--cam') ? ALL_CAMS.filter(c => flag('--cam').split(',').includes(c.name)) : ALL_CAMS.slice(0, 1);   // (a frame is a minute or two on the software adapter: one camera unless asked)
if (!CAMS.length) { console.error(`--cam: none of ${ALL_CAMS.map(c => c.name).join(' | ')}`); process.exit(2); }
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

let srv = null, browser = null;
const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });

async function boot(port, tag) {
  const t0 = Date.now(), errors = []; let noise = 0;
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log(tag, 'PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error') return; if (NOISE.test(x)) { noise++; return; } errors.push(x.slice(0, 500)); if (errors.length < 10) log(tag, 'console.error', x.slice(0, 400)); });
  const q = ['paused', 'mute', `quality=${QUALITY}`, `levelFile=${LEVEL}`, 'nofow', 'nosharp', tag === 'before' ? 'round=0' : '', flag('--q', '')].filter(Boolean).join('&');
  const url = `http://localhost:${port}/?${q}`;
  log(tag, 'goto', url);
  await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 240) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const pinOf = c => ({ look: c.look, yaw: c.yaw * DEG, pitch: c.pitch * DEG, dist: c.dist });
  const state = await page.evaluate(async ([pin]) => {
    window.__testVisible = true; await window.__ready;
    const g = window.__game, E = window.__engine;
    window.__menu.close();
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false;   // no live smoke domain on SwiftShader
    try { window.__weather.setEnabled(false); } catch { }
    g.godMode = true; g.aiEnabled = false;
    const p = g.player.char.pos;
    const staged = window.__stage(pin, { park: true, player: { pos: [p[0], 0, p[2]], yaw: 0, holstered: true, invisible: true } });
    window.__resetClock();
    const real = E.render.bind(E); window.__lastT = 0;
    E.render = (c, t, dt, pz) => { window.__lastT = t; return real(c, t, dt, pz); }; window.__real = real;
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    window.__runFrames(2, 1 / 60); await window.__done();
    const b = window.__boot || {}, R = window.__round, W = E.world;
    return { pipelines: b.pipelines, adapter: E.gpu && E.gpu.adapterInfo, internal: [E.width, E.height], round: R ? { on: R.knobs.on, gpu: R.config.gpu, made: R.stats.made, list: R.list().length } : null,
      world: { roundOn: W.roundOn, cutOn: W.cutOn, cutTraced: W.cutTraced, listed: W.visibleCutCount, statics: W.statics.length, roundBoxes: W.statics.filter(x => x.round === true).length },
      staged: !!staged, fatal: (document.getElementById('fatal') || {}).textContent || '' };
  }, [pinOf(CAMS[0])]);
  log(tag, `ready in ${Math.round((Date.now() - t0) / 1000)} s · pipelines ${JSON.stringify(state.pipelines)} · round ${JSON.stringify(state.round)} · world ${JSON.stringify(state.world)}`);
  const stills = [];
  for (const c of CAMS) {
    await page.evaluate(([pin]) => { window.__stage(pin, {}); window.__cam.update(1 / 60, pin.look, null); }, [pinOf(c)]);
    const cap = await page.evaluate(async ([n]) => {
      const E = window.__engine, cam = window.__cam, t = window.__lastT;
      for (let i = 0; i < n; i++) { window.__real(cam, t, i < n - 4 ? 1 / 15 : 1 / 480, false); await window.__done(); }
      const fr = await E.readbackFrame(); if (!fr) return { err: 'no frame' };
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      let sum = 0; for (let i = 0; i < fr.data.length; i += 4) { sum += fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; fr.data[i + 3] = 255; }
      const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
      return { w: fr.w, h: fr.h, meanRGB: +(sum / (fr.w * fr.h * 3)).toFixed(2), gpuErrs: window.__gpuErrs.length, gpuErrSample: window.__gpuErrs.slice(0, 3), url: c2.toDataURL('image/png') };
    }, [SETTLE]);
    if (cap.err) throw new Error(cap.err);
    const file = path.join(OUT, `round-${c.name}-${tag}.png`); fs.writeFileSync(file, Buffer.from(cap.url.split(',')[1], 'base64')); delete cap.url;
    stills.push({ camera: c.name, file, ...cap }); log(tag, `still ${c.name}: ${cap.w}×${cap.h}, mean ${cap.meanRGB}, ${cap.gpuErrs} GPU errors`);
  }
  await page.close();
  const want = tag === 'after';
  const P = state.pipelines || {};
  const ok = errors.length === 0 && !state.fatal && P.total > 0 && P.done === P.total && !P.failed && stills.every(s => s.gpuErrs === 0 && s.meanRGB > 1)
    && !!state.round && state.round.on === want && state.round.gpu === want && state.world.roundOn === want && (want ? state.round.made > 0 && state.world.roundBoxes === state.round.made && state.world.listed >= state.round.made : state.round.made === 0 && state.world.roundBoxes === 0)
    && state.world.cutTraced === 0;
  return { tag, url, ok, state, stills, errors, smokePipelineNoise: noise, wallSeconds: Math.round((Date.now() - t0) / 1000) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = Number(flag('--port', 0)) || await freePort();
  srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; ; i++) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch { } if (i > 120) throw new Error('the dev server did not come up'); await new Promise(r => setTimeout(r, 500)); }
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const tags = flag('--only') ? [flag('--only')] : ['before', 'after'];
  const res = await Promise.all(tags.map(t => boot(port, t).catch(e => ({ tag: t, ok: false, errors: [String(e && e.stack || e).slice(0, 600)] }))));   // (two pages at once is what the software adapter bears)
  fs.writeFileSync(path.join(OUT, 'round-page.json'), JSON.stringify(res, null, 1));
  for (const r of res) console.log(`- ${r.ok ? 'PASS' : 'FAIL'} — ${r.tag}: ${r.state ? `pipelines ${JSON.stringify(r.state.pipelines)} · round ${JSON.stringify(r.state.round)} · ${r.errors.length} console / page errors · ${r.stills.reduce((n, s) => n + s.gpuErrs, 0)} GPU errors` : r.errors[0]}`);
  stop(); process.exit(res.every(r => r.ok) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
