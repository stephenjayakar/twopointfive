// THE AIR FIELD ALONE (src/render/airField.ts + shaders/air_field.wgsl: the 2D wind solve the blown snow rides) — a standalone check and its PICTURES, from headless
// Chromium on the software WebGPU adapter (fog-lit-stills.cjs's flag set). It does NOT boot the game (a full frame there is seconds): tools/qa/air-field-entry.ts is
// bundled with `bun build` into a temp dir and loaded in a blank page, which runs only the solver. Three scenes on the game's 200 × 140 grid, a 2.5 m/s wind along
// +x gusting ±35 % on an 8 s sine, 900 steps of 1/60 s each:
//   OPEN   nothing in the way                              GATE   a wall across the wind with a 3 m gap and a door leaf standing open into the lee
//   YARD   a lorry, a crate, an L of walls, a roofed house with one doorway
// It asserts (one PASS / FAIL line each, exit 1 on any FAIL): nothing non-finite, speeds bounded, solids hold no air, the divergence small, the open field at the
// ambient, the jet through the gap, the calm lee, the wake off the leaf's free edge UNSTEADY (and different under another `time`), the decay in still air, and two
// other step lengths. And it writes the pictures the field is judged by: speed + direction, the lift, and STREAKS (tracers carried through the read-back field).
// Nothing here has been on a GPU: the ms per step it prints is the software adapter's and says nothing about a Mac.
//   node tools/qa/air-field-page.cjs [--out DIR] [--air '{"confine":3}'] [--steps 900] [--quick | --only yard | --only sources]
// (--quick: the gate scene's main run and its pictures only; --only: that part alone. Either is a look while tuning, not the check: the last line says so.)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process'); const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT_DIR = path.resolve(flag('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'air-field-')))), AIR_SET = JSON.parse(flag('--air', '{}')), STEPS = +flag('--steps', 900), QUICK = argv.includes('--quick'), ONLY = flag('--only', '');
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const WIND = +flag('--wind', 2.5), GUST = 0.35, DT = 1 / 60;   // (--wind: a look at another wind — the assertions' numbers are the 2.5 m/s ones)
let browser = null, srv = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.close(); } catch { } browser = srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });

// ---- a PNG, by hand (8-bit RGB, no filter; zlib is node's own)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function writePng(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

// ---- reading a field
const f32 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const u8 = s => new Uint8Array(Buffer.from(s, 'base64'));
function stats(f, mask, w, h, res) {
  let bad = 0, max = 0, sum = 0, sx = 0, sz = 0, open = 0, solidMax = 0, solidA = 0, aBad = 0, div = 0, divN = 0, liftMin = 0, liftMax = 0;
  const S = (i, j) => mask[j * w + i] === 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4, x = f[o], z = f[o + 1], l = f[o + 2], a = f[o + 3];
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(l) || !Number.isFinite(a)) { bad++; continue; }
    const sp = Math.hypot(x, z);
    if (S(i, j)) { solidMax = Math.max(solidMax, sp, Math.abs(l)); solidA = Math.max(solidA, a); continue; }
    if (a !== 1) aBad++; open++; sum += sp; sx += x; sz += z; if (sp > max) max = sp; liftMin = Math.min(liftMin, l); liftMax = Math.max(liftMax, l);
    // the divergence by central differences of the texture's own cell-centre values (what a grain feels), where the cell and its four neighbours are open
    if (i > 0 && j > 0 && i < w - 1 && j < h - 1 && !S(i - 1, j) && !S(i + 1, j) && !S(i, j - 1) && !S(i, j + 1)) { div += Math.abs((f[o + 4] - f[o - 4] + f[o + w * 4 + 1] - f[o - w * 4 + 1]) * 0.5 * res); divN++; }
  }
  return { bad, max, mean: sum / open, mx: sx / open, mz: sz / open, solidMax, solidA, aBad, div: div / Math.max(1, divN), liftMin, liftMax };
}
const meanSpeed = (f, w, cells) => { let s = 0; for (const [i, j] of cells) s += Math.hypot(f[(j * w + i) * 4], f[(j * w + i) * 4 + 1]); return s / cells.length; };

// ---- the pictures
const hsv = (hh, s, v) => { const k = n => { const t = (n + hh * 6) % 6; return v - v * s * Math.max(0, Math.min(t, 4 - t, 1)); }; return [k(5) * 255, k(3) * 255, k(1) * 255]; };
// speed (brightness, full at 2 × the ambient) and direction (hue: red = along +x, the wind's way; green / blue = turned) ×4, solids light grey, a roofed cell a little washed out
function speedPng(file, f, mask, w, h, ref = WIND) {
  const K = 4, W = w * K, H = h * K, px = new Uint8Array(W * H * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4, m = mask[j * w + i]; let c;
    if (m === 255) c = [205, 205, 210]; else { const sp = Math.hypot(f[o], f[o + 1]); c = hsv((Math.atan2(f[o + 1], f[o]) / (2 * Math.PI) + 1) % 1, m < 127 ? 0.6 : 0.95, Math.min(1, sp / (2 * ref)) ** 0.7); }
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) { const q = ((j * K + y) * W + i * K + x) * 3; px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; }
  }
  writePng(file, W, H, px);
}
// the lift ×4: red = up (full at 1.5 m/s), blue = down
function liftPng(file, f, mask, w, h) {
  const K = 4, W = w * K, H = h * K, px = new Uint8Array(W * H * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = Math.max(-1, Math.min(1, f[(j * w + i) * 4 + 2] / 1.5)), s = mask[j * w + i] === 255, c = s ? [205, 205, 210] : l >= 0 ? [20 + 235 * l, 20 + 60 * l, 24] : [20, 20 - 60 * l, 24 - 231 * l];
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) { const q = ((j * K + y) * W + i * K + x) * 3; px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; }
  }
  writePng(file, W, H, px);
}
// STREAKS ×5: tracers dropped at random (a seeded die: the same picture every run) and carried through the FROZEN read-back field for half a second, each drawn
// tail dim → head bright, bluish where slow, white at the ambient, warm where fast. The field is read the way the grains will read it: bilinear between cell
// centres (xz × res − ½). What to look for: the jet, the curls behind free edges and corners, the calm lee.
function streakPng(file, f, mask, w, h, res, n = 6000, secs = 0.5, ref = WIND) {
  const K = 5, W = w * K, H = h * K, acc = new Float32Array(W * H * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const m = mask[j * w + i], c = m === 255 ? [150, 150, 158] : m < 127 ? [30, 30, 38] : [10, 12, 16];
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) { const q = ((j * K + y) * W + i * K + x) * 3; acc[q] = c[0]; acc[q + 1] = c[1]; acc[q + 2] = c[2]; } }
  let seed = 0x9e3779b9; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const solid = (x, z) => { const i = Math.floor(x * res), j = Math.floor(z * res); return i < 0 || j < 0 || i >= w || j >= h || mask[j * w + i] === 255; };
  const vel = (x, z) => { const gx = Math.max(0, Math.min(w - 1.001, x * res - 0.5)), gz = Math.max(0, Math.min(h - 1.001, z * res - 0.5)), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, o = (j * w + i) * 4;
    const a = (k) => (f[o + k] * (1 - fx) + f[o + 4 + k] * fx) * (1 - fz) + (f[o + w * 4 + k] * (1 - fx) + f[o + w * 4 + 4 + k] * fx) * fz; return [a(0), a(1)]; };
  const dot = (x, y, c, a) => { const X = Math.round(x), Y = Math.round(y); if (X < 0 || Y < 0 || X >= W || Y >= H) return; const q = (Y * W + X) * 3; acc[q] += c[0] * a; acc[q + 1] += c[1] * a; acc[q + 2] += c[2] * a; };
  const seg = (x0, y0, x1, y1, c, a) => { const m = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k < m; k++) dot(x0 + (x1 - x0) * k / m, y0 + (y1 - y0) * k / m, c, a); };
  const SUB = 30, dt = secs / SUB;
  for (let p = 0; p < n; p++) {
    let x = rnd() * w / res, z = rnd() * h / res; if (solid(x, z)) continue;
    for (let s = 0; s < SUB; s++) {
      const v0 = vel(x, z), v1 = vel(x + v0[0] * dt * 0.5, z + v0[1] * dt * 0.5), nx = x + v1[0] * dt, nz = z + v1[1] * dt; if (solid(nx, nz)) break;
      const sp = Math.hypot(v1[0], v1[1]) / ref, c = sp < 1 ? [90 + 165 * sp, 140 + 115 * sp, 255] : [255, 255 - 110 * Math.min(1, sp - 1), 255 - 215 * Math.min(1, sp - 1)];
      seg(x * res * K, z * res * K, nx * res * K, nz * res * K, c, 0.12 + 0.75 * (s / SUB) ** 1.5); x = nx; z = nz;
    }
    dot(x * res * K, z * res * K, [255, 255, 255], 0.6);
  }
  const px = new Uint8Array(W * H * 3); for (let i = 0; i < px.length; i++) px[i] = Math.min(255, acc[i]); writePng(file, W, H, px);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'air-field-bundle-'));
  execFileSync('bun', ['build', path.join(ROOT, 'tools/qa/air-field-entry.ts'), '--outfile', path.join(tmp, 'air.js'), '--target', 'browser', '--loader', '.wgsl:text'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  // (a page off 127.0.0.1 is a secure context: navigator.gpu is there)
  srv = http.createServer((q, r) => { if (q.url === '/air.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(fs.readFileSync(path.join(tmp, 'air.js'))); } else { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><meta charset="utf-8"><title>air field</title><script src="/air.js"></script>'); } });
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); const port = srv.address().port;
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() === 'error' || /WGSL/.test(x)) { errors.push(x.slice(0, 500)); log('console', x.slice(0, 600)); } });
  await page.goto(`http://127.0.0.1:${port}/`); await page.waitForFunction(() => !!window.__air);
  const boot = await page.evaluate(() => window.__air.boot()); log(`adapter: ${boot.adapter} · out: ${OUT_DIR}`);
  const run = async o => { const r = await page.evaluate(o => window.__air.run(o), { air: AIR_SET, ...o }); for (const s of r.snaps) s.f = f32(s.field); r.m = u8(r.mask); if (r.still) r.stillF = f32(r.still); if (r.cleared) r.clearedF = f32(r.cleared); for (const e of r.gpuErrors) if (!errors.includes('gpu: ' + e)) errors.push('gpu: ' + e); return r; };

  let fails = 0, checks = 0; const check = (ok, what) => { checks++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); return ok; };
  const n = x => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(3));
  // the checks every field answers to
  const sane = (name, r, f) => { const s = stats(f, r.m, r.w, r.h, r.res);
    check(s.bad === 0, `${name}: no NaN / Inf (${s.bad} non-finite texels)`);
    check(s.max <= 4 * WIND, `${name}: max speed ${n(s.max)} m/s ≤ 4 × the ambient ${WIND} (= ${4 * WIND}); mean ${n(s.mean)}`);
    check(s.solidMax === 0 && s.solidA === 0 && s.aBad === 0, `${name}: solid cells hold velocity 0 and a = 0 (largest |v| or lift in a solid ${s.solidMax}, largest a ${s.solidA}; ${s.aBad} open cells with a ≠ 1)`);
    check(s.div <= 0.1 * s.mean * r.res, `${name}: mean |divergence| over open cells ${n(s.div)} /s = ${(100 * s.div / (s.mean * r.res)).toFixed(1)} % of mean speed ÷ cell (${n(s.mean * r.res)} /s; ≤ 10 %; the vent leaves some on purpose)`);
    return s; };
  const still = (name, r, before) => { const s = stats(r.stillF, r.m, r.w, r.h, r.res); check(s.bad === 0 && s.mean < 0.05 * before, `${name}: 600 steps of no wind: mean speed ${n(before)} → ${s.mean.toExponential(2)} m/s (${(100 * s.mean / before).toFixed(2)} %; < 5 %)`); };
  const pics = (name, r) => { r.snaps.forEach((s, k) => { const tag = `${name}_t${k}`; speedPng(path.join(OUT_DIR, `air_${tag}_speed.png`), s.f, r.m, r.w, r.h); streakPng(path.join(OUT_DIR, `air_${tag}_streaks.png`), s.f, r.m, r.w, r.h, r.res); if (k === r.snaps.length - 1) liftPng(path.join(OUT_DIR, `air_${name}_lift.png`), s.f, r.m, r.w, r.h); }); };
  const A = STEPS - 60, B = STEPS;   // the two pictures, a second apart

  // ---- (b) GATE first: it is the one the pictures are about
  const GEO = await page.evaluate(() => window.__air.GEO), G = GEO.gate, RES = 5, W = 200;
  const part = async () => { stop(); console.log(`pictures in ${OUT_DIR}`); if (errors.length) console.log(errors.join('\n')); console.log(fails || errors.length ? `=== air-field-page: ${fails} of ${checks} FAILED, ${errors.length} errors (a part only) ===` : '=== air-field-page: a part only, its checks pass ==='); process.exit(fails || errors.length ? 1 : 0); };
  if (ONLY === 'yard') { await yardPart(); await part(); }
  if (ONLY === 'sources') { await sourcesPart(); await part(); }
  if (ONLY === 'court') { await courtPart(); await part(); }
  const tip = [G.wallX + 0.1 + Math.sin(G.leafDeg * Math.PI / 180) * G.leafLen, G.gapZ0 - 0.1 + Math.cos(G.leafDeg * Math.PI / 180) * G.leafLen];
  const probes = [1, 2, 3].map(d => [Math.round((tip[0] + d) * RES), Math.round(tip[1] * RES)]);
  const gate = await run({ scene: 'gate', wind: WIND, steps: STEPS, dt: DT, snaps: [A, B], probes, seriesLast: 300, stillSteps: 600 });
  log(`gate: ${gate.dispatches} dispatches a step (${gate.iterations} red + black sweeps), ${n(gate.msPerStep)} ms a step on this adapter · AIR ${JSON.stringify(gate.air)}`);
  pics('gate', gate); check(gate.sameView, 'gate: `view` is the same object after 900 steps');
  const gs = sane('gate', gate, gate.snaps[1].f); log(`gate: lift over the field ${n(gs.liftMin)} ‥ ${n(gs.liftMax)} m/s`);
  if (QUICK) { probes.forEach((p, k) => { const z = gate.series[k].filter((_, i) => i & 1), mean = z.reduce((a, b) => a + b, 0) / z.length, sd = Math.sqrt(z.reduce((a, b) => a + (b - mean) ** 2, 0) / z.length); let flips = 0; for (let i = 1; i < z.length; i++) if (z[i] * z[i - 1] < 0) flips++;
    log(`gate: probe ${k + 1} m past the leaf: cross-wind speed changes sign ${flips} times, mean ${n(mean)}, sd ${n(sd)} m/s`); });
    { const f = gate.snaps[1].f; let sx = 0, c = 0, v = 0; for (let j = 20; j < 120; j++) for (let i = 10; i < 45; i++) { sx += f[(j * W + i) * 4]; c++; } sx /= c; for (let j = 20; j < 120; j++) for (let i = 10; i < 45; i++) { const o = (j * W + i) * 4; v += (f[o] - sx) ** 2 + f[o + 1] ** 2; }
      log(`gate: the open air upstream (x 2 ‥ 9 m): mean ${n(sx)} m/s along the wind, rms departure ${n(Math.sqrt(v / c))} m/s = ${(100 * Math.sqrt(v / c) / sx).toFixed(0)} %`); }
    await part(); }

  // ---- (a) OPEN
  const open = await run({ scene: 'open', wind: WIND, steps: STEPS, dt: DT, snaps: [B], stillSteps: 600 }); const os_ = sane('open', open, open.snaps[0].f);
  // (the ambient = the wind handed to that step, gust and all: the open field takes a change in the wind at once, AIR.follow)
  { const m = Math.hypot(os_.mx, os_.mz), deg = Math.abs(Math.atan2(os_.mz, os_.mx)) * 180 / Math.PI, amb = open.snaps[0].wind, f = open.snaps[0].f; let v = 0, c = 0; for (let i = 0; i < f.length; i += 4) { v += (f[i] - os_.mx) ** 2 + (f[i + 1] - os_.mz) ** 2; c++; }
    check(Math.abs(m - amb) <= 0.15 * amb && deg <= 10, `open: the mean velocity (${n(os_.mx)}, ${n(os_.mz)}) m/s = ${n(m)} is within 15 % of the ambient at that step ${n(amb)} (${(100 * (m / amb - 1)).toFixed(1)} %; the gust's mid-point is ${WIND}) and ${deg.toFixed(1)}° off its direction (≤ 10°)`);
    log(`open: the boil: rms departure from the mean velocity ${n(Math.sqrt(v / c))} m/s = ${(100 * Math.sqrt(v / c) / m).toFixed(0)} % of it`);
    speedPng(path.join(OUT_DIR, 'air_open_speed.png'), f, open.m, open.w, open.h); streakPng(path.join(OUT_DIR, 'air_open_streaks.png'), f, open.m, open.w, open.h, open.res); }
  still('open', open, os_.mean);

  // ---- (b) the jet, the lee, the shedding
  { const f = gate.snaps[1].f, wi = Math.round(G.wallX * RES), j0 = Math.round(G.gapZ0 * RES), j1 = Math.round(G.gapZ1 * RES), gap = [], lee = [];
    for (let j = j0; j < j1; j++) gap.push([wi, j]);
    for (let j = 10; j < 130; j++) if (j < j0 - 20 || j >= j1 + 20) for (let i = wi + 1; i <= wi + 5; i++) lee.push([i, j]);   // the metre behind the wall, 4 m and more from the gap, 2 m off the rim
    const jet = meanSpeed(f, W, gap), calm = meanSpeed(f, W, lee);
    check(jet >= os_.mean, `gate: the jet: mean speed in the gap ${n(jet)} m/s ≥ the open field's mean ${n(os_.mean)} (${(jet / os_.mean).toFixed(2)} ×)`);
    check(calm <= 0.6 * os_.mean, `gate: the lee: the metre behind the wall away from the gap ${n(calm)} m/s is ${(100 * (1 - calm / os_.mean)).toFixed(0)} % calmer than the open field (≥ 40 %)`); }
  const gate2 = await run({ scene: 'gate', wind: WIND, steps: STEPS, dt: DT, timeOffset: 100, probes, seriesLast: 300 });
  probes.forEach((p, k) => { const s = gate.series[k], s2 = gate2.series[k], z = [], z2 = []; for (let i = 1; i < s.length; i += 2) { z.push(s[i]); z2.push(s2[i]); }
    const mean = z.reduce((a, b) => a + b, 0) / z.length, sd = Math.sqrt(z.reduce((a, b) => a + (b - mean) ** 2, 0) / z.length); let flips = 0; for (let i = 1; i < z.length; i++) if (z[i] * z[i - 1] < 0) flips++;
    const diff = Math.sqrt(z.reduce((a, b, i) => a + (b - z2[i]) ** 2, 0) / z.length);
    check(flips >= 3 && sd >= 0.1 * WIND, `gate: SHEDDING at the probe ${k + 1} m past the leaf's free edge (cell ${p}): the cross-wind speed over the last 300 steps changes sign ${flips} times (≥ 3), mean ${n(mean)}, standard deviation ${n(sd)} m/s = ${(100 * sd / WIND).toFixed(0)} % of the ambient (≥ 10 %)`);
    check(diff >= 0.05 * WIND, `gate: … and the same probe with \`time\` 100 s on differs: rms difference ${n(diff)} m/s (≥ ${0.05 * WIND})`); });
  still('gate', gate, gs.mean);
  for (const [dt, name] of [[1 / 30, 'gate at dt 1/30'], [1 / 120, 'gate at dt 1/120']]) { const r = await run({ scene: 'gate', wind: WIND, steps: STEPS, dt, snaps: [B] }); sane(name, r, r.snaps[0].f); log(`${name}: ${n(r.msPerStep)} ms a step`); }

  // ---- (c) YARD
  async function yardPart() { const yard = await run({ scene: 'yard', wind: WIND, steps: STEPS, dt: DT, snaps: [A, B], stillSteps: 600 }); pics('yard', yard); const ys = sane('yard', yard, yard.snaps[1].f); still('yard', yard, ys.mean);
  { const Y = GEO.yard, f = yard.snaps[1].f, inside = [], door = []; for (let j = Math.round(Y.house[1] * RES) + 3; j < Math.round(Y.house[3] * RES) - 3; j++) for (let i = Math.round(Y.house[0] * RES) + 3; i < Math.round(Y.house[2] * RES) - 3; i++) inside.push([i, j]);
    for (let j = Math.round(Y.door[0] * RES); j < Math.round(Y.door[1] * RES); j++) door.push([Math.round(Y.house[0] * RES), j]);
    log(`yard: under the roof the mean speed is ${n(meanSpeed(f, W, inside))} m/s, in its doorway ${n(meanSpeed(f, W, door))}; lift over the field ${n(ys.liftMin)} ‥ ${n(ys.liftMax)} m/s `); } }

  // ---- (d) COURT: a walled yard under the sky (the pass's compound). The wind pushes on a box with one gate: the air inside must be a FLOW, not grain —
  // ROUGH = how far a cell's velocity stands from the mean of its four neighbours', over the court's open cells, as a share of their mean speed.
  async function courtPart() { const court = await run({ scene: 'court', wind: WIND, steps: STEPS, dt: DT, snaps: [A, B] }); pics('court', court); sane('court', court, court.snaps[1].f);
    const C = GEO.court, f = court.snaps[1].f, m = court.m; let rough = 0, sp = 0, cnt = 0; const o = (i, j) => (j * W + i) * 4, solid = (i, j) => m[j * W + i] === 255;
    for (let j = Math.round(C.wall[1] * RES) + 2; j < Math.round(C.wall[3] * RES) - 2; j++) for (let i = Math.round(C.wall[0] * RES) + 2; i < Math.round(C.wall[2] * RES) - 2; i++) {
      if (solid(i, j) || solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) continue;
      const ax = (f[o(i - 1, j)] + f[o(i + 1, j)] + f[o(i, j - 1)] + f[o(i, j + 1)]) / 4, az = (f[o(i - 1, j) + 1] + f[o(i + 1, j) + 1] + f[o(i, j - 1) + 1] + f[o(i, j + 1) + 1]) / 4;
      rough += Math.hypot(f[o(i, j)] - ax, f[o(i, j) + 1] - az); sp += Math.hypot(f[o(i, j)], f[o(i, j) + 1]); cnt++; }
    check(cnt > 0 && rough / Math.max(sp, 1e-9) <= 0.25 && sp / cnt >= 0.05 * WIND, `court: the air in a walled yard is a flow, not grain: a cell stands ${(100 * rough / Math.max(sp, 1e-9)).toFixed(1)} % of the mean speed from its four neighbours' mean (≤ 25 %); mean speed inside ${n(sp / cnt)} m/s (≥ ${n(0.05 * WIND)})`); }

  // ---- LOCAL SOURCES, indoors: no ambient wind at all
  async function sourcesPart() { const R = GEO.room, [x0, z0, x1, z1] = R.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, SIG = 0.8, OUT = 1.5, at = (f, x, z) => { const o = (Math.floor(z * RES) * W + Math.floor(x * RES)) * 4; return [f[o], f[o + 1]]; };
    // (a) a ceiling diffuser in a closed roofed room: a radial source and nothing else
    const a = await run({ scene: 'room', steps: 600, dt: DT, wind: 0, sources: [[cx, cz, 0, 0, SIG, OUT, 4, 0]], snaps: [600], clearSteps: 600 }), f = a.snaps[0].f, s = stats(f, a.m, a.w, a.h, a.res);
    let ring = 0; for (let k = 0; k < 48; k++) { const th = k / 48 * 2 * Math.PI, v = at(f, cx + Math.cos(th) * SIG, cz + Math.sin(th) * SIG); ring += (v[0] * Math.cos(th) + v[1] * Math.sin(th)) / 48; }
    check(s.bad === 0 && s.max <= 4 * OUT, `radial source in a closed roofed room (out ${OUT} m/s, sigma ${SIG} m, rate 4, no wind): no NaN / Inf (${s.bad}), max speed ${n(s.max)} m/s ≤ 4 × out`);
    check(ring >= 0.5 * OUT, `… the outflow on the ring at one sigma, settled (600 steps): ${n(ring)} m/s = ${(100 * ring / OUT).toFixed(0)} % of out (≥ 50 %)`);
    const c = stats(a.clearedF, a.m, a.w, a.h, a.res); check(c.bad === 0 && c.mean < 0.05 * s.mean, `… sources cleared, 600 steps: mean speed ${n(s.mean)} → ${c.mean.toExponential(2)} m/s (${(100 * c.mean / s.mean).toFixed(2)} %; < 5 %)`);
    speedPng(path.join(OUT_DIR, 'air_room_radial_speed.png'), f, a.m, a.w, a.h, OUT); streakPng(path.join(OUT_DIR, 'air_room_radial_streaks.png'), f, a.m, a.w, a.h, a.res, 6000, 0.5, OUT);
    // (b) a gust through the room's one doorway: a directional source standing in it
    const V = 2, dz = (R.door[0] + R.door[1]) / 2, b = await run({ scene: 'roomdoor', steps: 600, dt: DT, wind: 0, sources: [[x0 + 0.1, dz, V, 0, 0.6, 0, 4, 0]], snaps: [600], clearSteps: 600 }), g = b.snaps[0].f, t = stats(g, b.m, b.w, b.h, b.res);
    let jet = 0, jn = 0; for (let x = x0 + 1; x <= x0 + 2.5; x += 0.2) { jet += at(g, x, dz)[0]; jn++; } jet /= jn;
    let back = 0, inside = 0, backSum = 0; for (let j = Math.round(z0 * RES) + 1; j < Math.round(z1 * RES) - 1; j++) for (let i = Math.round(x0 * RES) + 1; i < Math.round(x1 * RES) - 1; i++) { inside++; const u = g[(j * W + i) * 4]; if (u < -0.03 * V) { back++; backSum += u; } }
    check(t.bad === 0 && t.max <= 4 * V, `directional source in a room's doorway (${V} m/s inward, sigma 0.6 m, rate 4, no wind): no NaN / Inf (${t.bad}), max speed ${n(t.max)} m/s ≤ 4 × its speed; mean over the field ${n(t.mean)}`);
    check(jet >= 0.3 * V, `… the jet: mean inward speed on its axis 1 ‥ 2.5 m inside the room ${n(jet)} m/s (≥ ${0.3 * V})`);
    check(back >= 0.05 * inside, `… the return flow: ${back} of ${inside} cells in the room (${(100 * back / inside).toFixed(0)} %; ≥ 5 %) flow back against it, mean ${n(back ? backSum / back : 0)} m/s`);
    const d = stats(b.clearedF, b.m, b.w, b.h, b.res); check(d.bad === 0 && d.mean < 0.05 * t.mean, `… sources cleared, 600 steps: mean speed ${n(t.mean)} → ${d.mean.toExponential(2)} m/s (${(100 * d.mean / t.mean).toFixed(2)} %; < 5 %)`);
    speedPng(path.join(OUT_DIR, 'air_room_door_speed.png'), g, b.m, b.w, b.h, V); streakPng(path.join(OUT_DIR, 'air_room_door_streaks.png'), g, b.m, b.w, b.h, b.res, 6000, 0.5, V); }

  await yardPart(); await courtPart(); await sourcesPart();
  const cells = gate.w * gate.h;
  log(`cost: ${gate.dispatches} dispatches a step = curl + advect + divergence + ${gate.iterations} × (red, black) + project, each over ${cells} cells (${gate.w} × ${gate.h}; ${cells * gate.iterations * 2} cell-sweeps of pressure a step, ${cells * gate.dispatches} cell-visits in all); ${n(gate.msPerStep)} ms a step on the software adapter (not a GPU's number)`);
  stop(); console.log(`pictures in ${OUT_DIR}`);
  check(errors.length === 0, `no console, page or GPU error (${errors.length})`); if (errors.length) console.log(errors.join('\n'));
  console.log(fails ? `=== air-field-page: ${fails} of ${checks} FAILED ===` : '=== air-field-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
