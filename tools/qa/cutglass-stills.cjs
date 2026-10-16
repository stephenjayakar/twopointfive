// FALLEN GLASS, BEFORE AND AFTER (rebuild/cut-pieces/glass/notes.md): the same shot-out pane, the same seed and the same two pinned cameras, drawn with the cut
// switch off (the rectangles) and on (plates cut to their cells), in headless Chromium on the software WebGPU adapter (as glass-page.cjs — no GPU needed, and no
// verdict on how it looks on a real one).
//   node tools/qa/cutglass-stills.cjs <outDir> [name=query ...]     e.g.  before=nocutboxes  after=cutboxes   (the page opens with cut pieces ON: the before job must say nocutboxes)
//   env PORT (5199) · QUALITY (high) · SIZE (800x450) · WARM (10 frames after each camera cut) · FRAMES (6 drawn for a still) · SEED (7) · FLIGHT (1: the in-flight still too) · FLOOR (1: the floor still; 0 stops after the flight) · SHARDS ('{"cutEdge":0.6}': shards.ts knobs set before the shots)
// Per job: <name>-flight.png (the last volley's pieces 0.15 s after they let go, seen from inside the room they fall into), <name>-floor.png (ten seconds on, the
// floor under the pane from above) and report.json (plates, cut records, pool, console errors). Exit 1 on a console / page error that is not the smoke solver's noise.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'cutglass-stills';
const jobs = process.argv.slice(3).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a, query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!jobs.length) jobs.push({ name: 'before', query: 'nocutboxes' }, { name: 'after', query: 'cutboxes' });
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'high', FRAMES = Number(process.env.FRAMES || 6), WARM = Number(process.env.WARM || 10), SEED = Number(process.env.SEED || 7), FLIGHT = process.env.FLIGHT !== '0', FLOOR = process.env.FLOOR !== '0', KNOBS = process.env.SHARDS ? JSON.parse(process.env.SHARDS) : null;
const [W, H] = (process.env.SIZE || '800x450').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
// PANE = the conference partition's second sheet, c (7.5, 1.5, 10), float glass, thin along z (cutglass-probes.ts): the blows go in from the corridor (−z). Found by
// where it stands (as tools/qa/office-pane.ts CONF_PANE), never by index: a level export that adds a box moves every index after it
const PANE = require('../../levels/office.json').boxes.findIndex(b => b.flags && b.flags.includes('Glass') && Math.abs(b.c[0] - 7.5) < 0.01 && Math.abs(b.c[2] - 10) < 0.01);
if (PANE < 0) { console.error('cutglass-stills: no glass pane with its centre at (7.5, 10) in levels/office.json'); process.exit(2); }
const SHOTS = [[0.1, 0.1], [0.11, 0.1], [0.12, 0.11], [-0.5, -0.3], [-0.49, -0.3], [0.6, 0.4], [0.61, 0.41], [-0.2, 0.6], [-0.21, 0.6], [0.3, -0.6]];
const LAST = [[0.31, -0.6], [-0.7, 0.2], [0.75, -0.2], [0.0, -0.4], [0.01, -0.41], [0.45, 0.0]];
const CAM_FLIGHT = { look: [7.4, 1.2, 9.8], yaw: Math.PI, pitch: 0.36, dist: 2.3 };
const CAM_FLOOR = { look: [7.55, 0, 9.5], yaw: Math.PI, pitch: 1.25, dist: 2.2 };

const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 2000); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }   // (a hair of game time a drawn frame: the picture settles, the glass all but hangs where it is)
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0; for (let i = 0; i < fr.data.length; i += 4) { sum += fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; fr.data[i + 3] = 255; }
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), url: c2.toDataURL('image/png') };
};
// undrawn frames with the GPU PARTICLE step still running (glass-page.cjs SETTLE): the shard particles fall and go to sleep, nothing else is rendered
const SETTLE = async (frames) => {
  const E = window.__engine, dev = E.device, P = E.particles; let threw = null;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  const own = Object.prototype.hasOwnProperty.call(E, 'render'), real = E.render;
  E.render = (cam, t, dt) => { if (!P) return; const on = E.particlesOn; P.prepare(dt || 0, on, E.settings.particleBirths);
    if (on && P.hasWork && E.sceneBG) { dev.queue.writeBuffer(E.frameBuf, 204, new Float32Array([t])); dev.queue.writeBuffer(E.frameBuf, 220, new Float32Array([dt || 0]));
      const enc = dev.createCommandEncoder(); P.encodeUpdate(enc, E.sceneBG, E.rc.diceView); dev.queue.submit([enc.finish()]); }
    P.afterSubmit(); };
  try { for (let i = 0; i < frames && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } if (i % 10 === 9) { await dev.queue.onSubmittedWorkDone(); await yieldMacro(); } } }
  finally { if (own) E.render = real; else delete E.render; }
  await dev.queue.onSubmittedWorkDone(); await yieldMacro();
  return threw;
};
const SETUP = ({ seed, knobs }) => {
  if (knobs) Object.assign(window.__shards.knobs, knobs);
  let a = seed | 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = window.__game; window.__menu.close(); window.__smoke.params.enabled = false;
  g.restartEncounter(); g.godMode = true; g.aiEnabled = false;
  window.__stage(null, { park: true, player: { pos: [30, 0, 20], invisible: true } });
  const day = !!(window.__daylight && window.__daylight(true));   // (the office at night leaves that floor near black)
  const C = window.__cut || null;
  return { day, cutHook: C ? { on: C.on } : null, glassLive: window.__glassbreak.live, shardsLive: window.__shards.live, chaos: g.tune.chaos, debrisCap: g.destr.debris.cap(), quality: window.__quality && window.__quality.preset };
};
const HIT = ({ pane, shots }) => { for (const [u, v] of shots) window.__glassbreak.hit(pane, [7.5 + u, 1.5 + v, 10], [0, 0, -1], 1); };
const PIN = (pin) => { const r = window.__stage(pin, {}); if (window.__taa && window.__taa.reset) window.__taa.reset(); return r; };
const COUNT = () => { const g = window.__game, L = g.destr.debris.list, G = L.filter(c => c.glass);
  return { pool: L.length, cap: g.destr.debris.cap(), glass: G.length, atRest: G.filter(c => c.rest).length, cut: G.filter(c => c.box.cut && c.box.cut.length).length, outlines: G.filter(c => c.glass.poly).length, planes: G.reduce((n, c) => n + (c.box.cut ? c.box.cut.length : 0), 0),
    shards: { fragments: window.__shards.stats.fragments, plates: window.__shards.stats.plates, cutPlates: window.__shards.stats.cutPlates, breaks: window.__shards.stats.breaks, refused: window.__shards.stats.platesRefused },
    gpuErrors: ((window.__boot && window.__boot.gpuInitErrors) || []).filter(e => !/smoke/i.test(e) && !/number of storage textures \(5\)/.test(e)).map(e => e.slice(0, 300)) }; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const report = [];
  for (const job of jobs) {
    const R = { name: job.name, query: job.query, errors: [], noise: 0 }; report.push(R);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;
      if (NOISE.test(x) && R.noise < NOISE_MAX) R.noise++; else R.errors.push(`${t}: ${x.slice(0, 600)}`); });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    const save = (cap, file) => { if (cap && cap.url) fs.writeFileSync(path.join(outDir, file), Buffer.from(cap.url.split(',')[1], 'base64')); else R.errors.push(`draw ${file}: ${cap ? cap.err : 'nothing came back'}`); return cap && { w: cap.w, h: cap.h, mean: cap.mean }; };
    try {
      const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&nocivilians&glassbreak${job.query ? '&' + job.query : ''}`;
      log(job.name, 'goto', url); await page.goto(url);
      const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; if (window.__cut && window.__cut.programs && window.__cut.programs.swap) await window.__cut.programs.ready;   /* the second set of ray programs (render/cutSwap.ts) compiles after boot: a cut piece is traced whole until it is in */ return document.getElementById('fatal')?.textContent || ''; }); if (fatal) R.errors.push('fatal: ' + fatal);
      R.setup = await page.evaluate(SETUP, { seed: SEED, knobs: KNOBS }); log(job.name, 'setup', JSON.stringify(R.setup));
      let threw = await page.evaluate(SETTLE, 30); if (threw) R.errors.push('settle threw: ' + threw);
      await page.evaluate(DRAW, 1);   // (one drawn frame first: the world's glass list is packed by the upload a render makes)
      for (const s of SHOTS) { await page.evaluate(HIT, { pane: PANE, shots: [s] }); threw = await page.evaluate(SETTLE, 18); if (threw) R.errors.push('settle threw: ' + threw); }
      threw = await page.evaluate(SETTLE, 90); if (threw) R.errors.push('settle threw: ' + threw);
      await page.evaluate(HIT, { pane: PANE, shots: LAST });
      threw = await page.evaluate(SETTLE, 9); if (threw) R.errors.push('settle threw: ' + threw);   // 0.15 s: the last volley's pieces are a hand's breadth out of their holes
      R.inFlight = await page.evaluate(COUNT);
      if (FLIGHT) { R.pinFlight = await page.evaluate(PIN, CAM_FLIGHT); await page.evaluate(DRAW, WARM); R.flight = save(await page.evaluate(DRAW, FRAMES), `${job.name}-flight.png`); log(job.name, 'flight', JSON.stringify(R.inFlight)); }
      if (FLOOR) {
        threw = await page.evaluate(SETTLE, 600); if (threw) R.errors.push('settle threw: ' + threw);
        R.atRest = await page.evaluate(COUNT);
        R.pinFloor = await page.evaluate(PIN, CAM_FLOOR); await page.evaluate(DRAW, WARM); R.floor = save(await page.evaluate(DRAW, FRAMES), `${job.name}-floor.png`); log(job.name, 'floor', JSON.stringify(R.atRest));
      }
      for (const e of (R.atRest || R.inFlight).gpuErrors) R.errors.push('pipeline: ' + e);
    } catch (x) { R.errors.push('driver: ' + String(x && x.stack || x).slice(0, 600)); }
    log(job.name, `errors ${R.errors.length} · smoke noise ${R.noise}`); for (const e of R.errors.slice(0, 8)) log('   ', e.slice(0, 300));
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
    await page.close();
  }
  await browser.close();
  process.exit(report.some(r => r.errors.length) ? 1 : 0);
})().catch(x => { console.error('cutglass-stills: the driver died —', x && x.stack || x); process.exit(2); });
