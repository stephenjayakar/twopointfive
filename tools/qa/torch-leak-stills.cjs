// TORCH LEAK STILLS — does a guard's torch (a character-carried spot light: the HELD path of restir.wgsl) paint a faint image of its beam on the FAR side of a wall?
// Headless Chromium on the software WebGPU adapter (SwiftShader; fog-cone-stills.cjs / cut-stills.cjs's flag set). ONE FRESH PAGE BOOT PER VARIANT, the same call
// sequence in each: ?paused boot → smoke / weather off → render scale forced → Math.random seeded → restartEncounter → anim phases zeroed → AI off → __stage (ONE
// guard by a wall with his torch on, everyone else parked dark, the player parked, holstered, invisible) → undrawn pose frames → drawn settle frames at a sliver of
// dt → the engine's own read-back → PNG. Then per variant an amplified |variant − reference| image (reference = the same boot with the torch dark) and the mean /
// max of that difference over a rectangle of far-side floor chosen by projecting world points through the camera (never by eye).
//
//   node tools/qa/torch-leak-stills.cjs --out DIR [--quality high] [--scale 0.5] [--w 1566 --h 1000] [--q 'extra&query'] [--staging face|end|…] [--variants a,b,c,d,e,move] [--settle 12]
//        [--explore]   one boot, the level's guards / lights printed and one overview still (leak_explore.png) — for choosing a staging
// Variants: a = default · b = the torch dark (THE REFERENCE) · c = &nosharp · d = &legacydenoise · e = &norestir · a and b also in debug views 3 (direct only) and
// 4 (indirect only) · move = a and b again with the guard's yaw swept 40° over 20 frames at 1/60 s, read back on the frame the sweep ends (and 6 frames later).
// The dev server is started from this checkout on a free port and stopped by pid.
// The stagings stand on levels/train-silent.json (the play-style levels' quiet training level): run it from a checkout that has that level. `pair` = the one that shows the leak —
// a second guard's torch lights the far-side floor (the same emitter class as the hidden torch); compare default against &noleakfix (settings.dnShadowOccl off) and the torch-dark reference.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync, spawnSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; }, has = n => argv.includes(n);
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots'))), QUALITY = flag('--quality', 'high'), SCALE = +flag('--scale', 0.5), VW = +flag('--w', 1566), VH = +flag('--h', 1000);
const SETTLE = +flag('--settle', 12), STAGING = flag('--staging', 'face'), EXTRA = flag('--q', ''), VARIANTS = flag('--variants', 'b,a,c,d,e,move').split(',').filter(Boolean), TAG = flag('--tag', ''), VIEWS = flag('--views', 'direct,indirect').split(','), DSETTLE = +flag('--dsettle', 6);
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const D = Math.PI / 180;
// THE STAGINGS. yaw: forward = (sin yaw, 0, cos yaw). far = a world rectangle of FLOOR wholly on the far side of the wall, where the occluded cone would land; ctl = far-side floor out of the beam's way.
const STAGINGS = {
  // levels/train-silent.json: the mud wall along x = 15 (z 6‥18, 0.24 thick, 2.4 high, open sky). lamp_west (11.4, 3.37, 8.4; a spot straight down, 90 cd, outer 52°) lights the floor WEST of it,
  // lamp_post (20.9, 3.37, 7.3) the floor east of it. The guard stands EAST of the wall, 1.3 m off its face, square on to it, beam toward −x: the cone's axis continues over lamp_west's pool.
  face: { level: 'train-silent.json', q: 'quiet&quietfog=off&difficulty=hard', guard: { pos: [16.4, 0, 8.6], yaw: -90 * D, aimPitch: -0.2 }, pin: { look: [14.2, 0, 8.6], yaw: 0, pitch: 65 * D, dist: 10 },
    far: { x0: 11.9, x1: 14.5, z0: 7.5, z1: 9.7 }, ctl: { x0: 11.9, x1: 14.5, z0: 10.6, z1: 12.2 }, park: [-40, 0, -40] },
  // the same wall, the beam meeting it at 45°: the cone's far edge runs along the far-side floor
  skew: { level: 'train-silent.json', q: 'quiet&quietfog=off&difficulty=hard', guard: { pos: [16.3, 0, 10.2], yaw: -135 * D, aimPitch: -0.2 }, pin: { look: [14.2, 0, 8.8], yaw: 0, pitch: 65 * D, dist: 10 },
    far: { x0: 11.9, x1: 14.5, z0: 7.2, z1: 9.4 }, ctl: { x0: 11.9, x1: 14.5, z0: 10.6, z1: 12.2 }, park: [-40, 0, -40] },
  // (g) the OTHER light on the far-side floor is another CARRIED light: guard A east of the wall, his lens ~0.5 m off its face, square on; guard B west of the wall (the far side), his torch
  // burning in both runs, beam running north along x ≈ 12.6 over the floor A's occluded cone would land on. Compare A on vs A off.
  pair: { level: 'train-silent.json', q: 'quiet&quietfog=off&difficulty=hard', guard: { pos: [16.4, 0, 13.0], yaw: -90 * D, aimPitch: -0.2 }, guardB: { pos: [13.2, 0, 16.4], yaw: 180 * D, aimPitch: -0.2 },
    pin: { look: [14.0, 0, 13.4], yaw: 0, pitch: 65 * D, dist: 10 }, far: { x0: 12.2, x1: 14.75, z0: 11.4, z1: 14.4 }, ctl: { x0: 12.2, x1: 14.75, z0: 14.6, z1: 15.3 }, park: [-40, 0, -40] },
};
const ST = STAGINGS[STAGING]; if (!ST) { console.error(`unknown --staging ${STAGING}: ${Object.keys(STAGINGS).join(' | ')}`); process.exit(2); }
let srv = null, browser = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
const savePng = (name, url) => { const f = path.join(OUT, `leak_${TAG}${name}.png`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); return f; };

/** one fresh boot: stage, settle, read back. o = { q (extra query), torch (bool), debug (bool: also views 3 / 4), sweep (bool), explore (bool) } */
async function boot(port, name, o, errors) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { errors.push(`${name} pageerror: ` + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || NOISE.test(x)) return; errors.push(`${name}: ` + x.slice(0, 500)); log('console.error', x.slice(0, 300)); });
  const url = `http://localhost:${port}/?${[`levelFile=${ST.level}`, ST.q, 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, o.q, EXTRA].filter(Boolean).join('&')}`;
  log(name, 'goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const info = await page.evaluate(async ([ST, o, SCALE]) => {
    window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine; try { window.__menu.close(); } catch { }
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    const real = E.render.bind(E); window.__draw = on => { E.render = on ? (c, t, dt) => real(c, t, dt, false) : () => { }; };   // (present = false: the frame lands in the engine's offscreen target, which readbackFrame reads)
    window.__grab = async () => { const fr = await E.readbackFrame(); if (!fr) return null; if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255; const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0); return { w: fr.w, h: fr.h, url: c2.toDataURL('image/png') }; };
    window.__draw(false);
    if (o.cards === false) E.settings.torchBounceCards = false;   // variant f: the torch bounce cards off (the preset turned them on)
    E.settings.renderScale = SCALE;   // the owner's HUD: '783×500 ×0.50 of 1000p → 1566×1000 taau sharp' (quality pinned by ?quality= → auto and the ladder's climb are off)
    { let s = 4242 >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    g.restartEncounter();
    g.godMode = true; g.aiEnabled = false;
    const zero = () => { for (const gd of [...g.guards, ...(g.civilians || [])]) if (gd.char && gd.char.anim) gd.char.anim.phase = 0; g.player.char.anim.phase = 0; }; zero();
    const gi = g.guards.findIndex(x => !x.unit && x.state !== 'dead'); if (gi < 0) return { err: 'no staff guard in this level', guards: g.guards.length };
    const roster = g.guards.map((x, i) => ({ i, id: x.char.id, team: x.team, unit: !!x.unit, state: x.state, pos: Array.from(x.char.pos).map(v => +v.toFixed(2)), light: !!x.flashlight.enabled }));
    const gj = ST.guardB ? g.guards.findIndex((x, i) => i !== gi && !x.unit && x.state !== 'dead') : -1; if (ST.guardB && gj < 0) return { err: 'no second staff guard for guard B' };
    window.__gi = gi; window.__gj = gj; window.__dark = !o.torch;
    // (poseFlashlight re-derives `enabled` every game frame for a staff man: a torch is put out for good through lightDeadUntil, the model's own 'his light is dead' clock)
    window.__lightsRule = () => g.guards.forEach((x, i) => { if (i === gj) return; if (i !== gi || window.__dark) { x.lightDeadUntil = 1e12; x.flashlight.enabled = false; } });
    if (o.explore) return { roster, gi, lights: E.lights.lights ? E.lights.lights.length : null };
    const st = window.__stage(ST.pin, { park: true, guards: [{ i: gi, pos: ST.guard.pos, yaw: ST.guard.yaw, aimPitch: ST.guard.aimPitch, torch: !!o.torch }, ...(ST.guardB ? [{ i: gj, pos: ST.guardB.pos, yaw: ST.guardB.yaw, aimPitch: ST.guardB.aimPitch, torch: true }] : [])], player: { pos: ST.park, holstered: true, invisible: true } });
    window.__lightsRule();
    for (let i = 0; i < 40; i++) { window.__runFrames(1, 1 / 60); window.__lightsRule(); }   // undrawn: his pose and the relaxed carry's beam settle
    zero(); window.__resetClock();
    const gd = g.guards[gi], fl = gd.flashlight, cam = window.__cam;
    const r3 = a => Array.from(a).map(v => +v.toFixed(3));
    return { roster, gi, pin: st.pin, guard: { pos: r3(gd.char.pos), bodyYaw: gd.char.bodyYaw, aimYaw: gd.char.aimYaw, state: gd.state, hold: gd.hold },
      torch: { enabled: !!fl.enabled, pos: r3(fl.pos), dir: r3(fl.dir), intensity: fl.intensity, innerDeg: fl.innerDeg, outerDeg: fl.outerDeg, range: fl.range, radius: fl.radius, owner: fl.owner },
      others: g.guards.filter((x, i) => i !== gi && x.flashlight.enabled).length, torchB: gj >= 0 ? { enabled: !!g.guards[gj].flashlight.enabled, pos: r3(g.guards[gj].flashlight.pos), dir: r3(g.guards[gj].flashlight.dir) } : null, cardsSetting: E.settings.torchBounceCards, playerPos: r3(g.player.char.pos), invisible: g.playerInvisible,
      quality: window.__quality && window.__quality.current, auto: window.__quality && window.__quality.auto, settings: { renderScale: E.settings.renderScale, maxInternalHeight: E.settings.maxInternalHeight, taau: E.settings.taau, sharpDirect: E.settings.sharpDirect, sharpDecouple: E.settings.sharpDecouple, gbaa: E.settings.gbaa, restir: E.settings.restir, denoiser: E.settings.denoiser, heldRays: E.settings.heldRays, froxelVol: E.settings.froxelVol, debugView: E.settings.debugView } };
  }, [ST, o, SCALE]);
  if (info.err) throw new Error(info.err);
  const out = { name, url, info, shots: {} };
  const settle = async (n, dt = 1 / 600) => page.evaluate(async ([n, dt]) => { const ms = []; window.__draw(true); for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__runFrames(1, dt); window.__lightsRule(); await window.__done(); ms.push(Math.round(performance.now() - t0)); }
    const E = window.__engine, g = window.__game, fl = g.guards[window.__gi].flashlight;
    return { ms, w: E.width, h: E.height, ow: E.outWidth, oh: E.outHeight, sharpOn: E.sharpOn, torchOn: !!fl.enabled, numCards: E.passes.numCards, lights: (E.lights.lights || []).filter(l => l.enabled !== false).length, chars: g.guards.length + 1, gpuErrs: window.__gpuErrs.slice(0, 4), debugView: E.settings.debugView, scale: E.settings.renderScale }; }, [n, dt]);
  const grab = async (key) => { const fr = await page.evaluate(() => window.__grab()); if (!fr) throw new Error('no frame read back'); out.shots[key] = { file: savePng(`${name}${key === 'final' ? '' : '_' + key}`, fr.url), w: fr.w, h: fr.h }; };
  if (o.explore) { await page.evaluate(([pin, park]) => { window.__stage(pin, { player: { pos: park, holstered: true, invisible: true } }); window.__runFrames(2, 1 / 60); }, [flagPin() || ST.pin, ST.park]); const s = await settle(4); log('explore', JSON.stringify(info), JSON.stringify(s)); await grab('final'); await page.close(); return out; }
  const s0 = await settle(SETTLE); out.frame = s0; log(name, `settled ${SETTLE}: ${s0.w}×${s0.h} → ${s0.ow}×${s0.oh} sharpOn ${s0.sharpOn} torch ${s0.torchOn} numCards ${s0.numCards} lights ${s0.lights} · ms ${s0.ms.join(',')}`, s0.gpuErrs.length ? 'GPU ERRORS ' + JSON.stringify(s0.gpuErrs) : '');
  // the far-side rectangle on screen: world floor points through the camera's own (unjittered) view-projection, column-major
  out.proj = await page.evaluate(([ST]) => { const cam = window.__cam, E = window.__engine, m = cam.viewProj, W = E.outWidth, H = E.outHeight;
    const P = (x, y, z) => { const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(cx / cw * 0.5 + 0.5) * W, (0.5 - cy / cw * 0.5) * H]; };
    const rect = r => { const c = [P(r.x0, 0, r.z0), P(r.x1, 0, r.z0), P(r.x1, 0, r.z1), P(r.x0, 0, r.z1)]; const xs = c.map(p => p[0]).sort((a, b) => a - b), ys = c.map(p => p[1]).sort((a, b) => a - b);
      return { corners: c.map(p => p.map(v => +v.toFixed(1))), inner: [Math.ceil(xs[1]) + 2, Math.ceil(ys[1]) + 2, Math.floor(xs[2]) - 2, Math.floor(ys[2]) - 2] }; };   // (inner = the box between the two middle xs / ys: inside the projected quad for a camera looking along a world axis)
    const fl = window.__game.guards[window.__gi].flashlight;
    return { W, H, look: P(...ST.pin.look).map(v => +v.toFixed(1)), guard: P(...ST.guard.pos).map(v => +v.toFixed(1)), wallTop: [P(15, 2.4, 6), P(15, 2.4, 18)].map(p => p.map(v => +v.toFixed(1))), wallFoot: [P(14.88, 0, 6), P(14.88, 0, 18)].map(p => p.map(v => +v.toFixed(1))),
      far: rect(ST.far), ctl: rect(ST.ctl), rim: (() => { // where the torch's OUTER cone edge (and its axis) would meet the floor with no wall in the way: world [x, z] + screen px
        const d = fl.dir, o = fl.pos, a = fl.outerDeg * Math.PI / 180; let u = [d[2], 0, -d[0]]; const ul = Math.hypot(u[0], u[2]) || 1; u = [u[0] / ul, 0, u[2] / ul]; const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]; const pts = [];
        const hit = r => { if (r[1] >= -1e-3) return null; const t = -o[1] / r[1]; if (t > (fl.range || 16)) return null; const x = o[0] + r[0] * t, z = o[2] + r[2] * t; return { w: [+x.toFixed(2), +z.toFixed(2)], s: P(x, 0, z).map(q => +q.toFixed(1)) }; };
        for (let k = 0; k < 48; k++) { const ph = k / 48 * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a); const h = hit([0, 1, 2].map(i => d[i] * c + (u[i] * Math.cos(ph) + v[i] * Math.sin(ph)) * sn)); if (h) pts.push(h); }
        return { axis: hit(d), pts }; })(), torchAt: P(fl.pos[0], fl.pos[1], fl.pos[2]).map(v => +v.toFixed(1)) }; }, [ST]);
  await grab('final');
  if (o.sweep) { const s = await page.evaluate(async ([deg, n]) => { const g = window.__game, gd = g.guards[window.__gi], y0 = gd.char.aimYaw, ms = []; window.__draw(true);
      for (let i = 1; i <= n; i++) { const y = y0 + deg * Math.PI / 180 * i / n; gd.char.bodyYaw = y; gd.char.aimYaw = y; const t0 = performance.now(); window.__runFrames(1, 1 / 60); window.__lightsRule(); await window.__done(); ms.push(Math.round(performance.now() - t0)); }
      const fl = gd.flashlight; return { ms, yaw0: y0, yaw1: gd.char.aimYaw, dir: Array.from(fl.dir).map(v => +v.toFixed(3)), pos: Array.from(fl.pos).map(v => +v.toFixed(3)), torchOn: !!fl.enabled }; }, [+flag('--sweep', 40), 20]);
    out.sweep = s; await grab('swept'); log(name, 'swept', JSON.stringify({ dir: s.dir, torchOn: s.torchOn })); await settle(6); await grab('swept6'); }
  if (o.debug) for (const [key, v] of [['direct', 3], ['indirect', 4]].filter(x => VIEWS.includes(x[0]))) { await page.evaluate(v => { window.__engine.settings.debugView = v; }, v); const s = await settle(DSETTLE); out['frame_' + key] = s; await grab(key); log(name, `debug view ${v} (${key}): ${s.w}×${s.h} → ${s.ow}×${s.oh} sharpOn ${s.sharpOn}`); }
  out.gpuErrs = await page.evaluate(() => window.__gpuErrs.slice());
  await page.close(); return out;
}
function flagPin() { const p = flag('--pin', ''); if (!p) return null; const a = p.split(',').map(Number); return { look: [a[0], 0, a[1]], yaw: (a[4] || 0) * D, pitch: (a[3] || 65) * D, dist: a[2] || 12 }; }

// the differences: python3 + PIL + numpy. |variant − reference| × 8 per channel, clamped; the mean / max of the plain difference (0‥255 units) over the far-side and control rectangles
const PY = `
import sys, json
import numpy as np
from PIL import Image
jobs = json.load(sys.stdin); res = []
for j in jobs:
    a = np.asarray(Image.open(j['a']).convert('RGB')).astype(np.int16); b = np.asarray(Image.open(j['b']).convert('RGB')).astype(np.int16)
    if a.shape != b.shape: res.append({'name': j['name'], 'err': 'sizes differ %s %s' % (a.shape, b.shape)}); continue
    d = np.abs(a - b); Image.fromarray(np.clip(d * 8, 0, 255).astype(np.uint8)).save(j['out'])
    sx = a.shape[1] / j['W']; sy = a.shape[0] / j['H']; r = {'name': j['name'], 'out': j['out'], 'whole': {'mean': round(float(d.mean()), 3), 'max': int(d.max())}}
    for k in ('far', 'ctl'):
        x0, y0, x1, y1 = j[k]; x0 = int(x0 * sx); x1 = int(x1 * sx); y0 = int(y0 * sy); y1 = int(y1 * sy); t = d[y0:y1, x0:x1]; s = (a - b)[y0:y1, x0:x1]
        lum = t.max(axis=2)
        r[k] = {'rect': [x0, y0, x1, y1], 'mean': round(float(t.mean()), 3), 'max': int(t.max()), 'signedMean': round(float(s.mean()), 3), 'p99': float(np.percentile(lum, 99)), 'pxOver2': int((lum > 2).sum()), 'pxOver8': int((lum > 8).sum()), 'px': int(lum.size),
                'refMean': round(float(b[y0:y1, x0:x1].mean()), 2)}
    res.append(r)
print(json.dumps(res))
`;
function diffs(jobs) { const r = spawnSync('python3', ['-c', PY], { input: JSON.stringify(jobs), encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) { console.error(r.stderr); return []; } return JSON.parse(r.stdout); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(); srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port}`);
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = [], R = {};
  if (has('--explore')) { await boot(port, 'explore', { explore: true, torch: true }, errors); }
  else {
    const TABLE = { a: { q: '', torch: true, debug: true }, b: { q: '', torch: false, debug: true }, c: { q: 'nosharp', torch: true }, d: { q: 'legacydenoise', torch: true }, e: { q: 'norestir', torch: true },
      bc: { q: 'nosharp', torch: false }, bd: { q: 'legacydenoise', torch: false }, be: { q: 'norestir', torch: false },   // (each switch's OWN torch-off reference: --variants …,bc,bd,be)
      f: { q: '', torch: true, cards: false, debug: true }, n: { q: 'noleakfix', torch: true, debug: true }, cn: { q: 'nosharp&noleakfix', torch: true }, dn: { q: 'legacydenoise&noleakfix', torch: true },
      moven: { q: 'noleakfix', torch: true, sweep: true, debug: true }, move: { q: '', torch: true, sweep: true, debug: true }, moveb: { q: '', torch: false, sweep: true, debug: true } };
    const want = has('--diff-only') ? [] : VARIANTS;
    for (const v of want) { if (!TABLE[v]) { log('unknown variant', v); continue; } try { R[v] = await boot(port, v, TABLE[v], errors); } catch (e) { log(v, 'FAILED', String(e && e.stack || e).slice(0, 600)); errors.push(`${v}: ${e}`); } }
    const projFile = path.join(OUT, `leak_${TAG}proj.json`); let pr = (Object.values(R).find(r => r.proj) || {}).proj; if (pr) fs.writeFileSync(projFile, JSON.stringify(pr)); else if (fs.existsSync(projFile)) pr = JSON.parse(fs.readFileSync(projFile, 'utf8'));
    const jobs = [], f = (v, k = 'final') => { const x = path.join(OUT, `leak_${TAG}${v}${k === 'final' ? '' : '_' + k}.png`); return fs.existsSync(x) ? x : null; };
    const job = (name, a, b) => { if (a && b && pr) jobs.push({ name, a, b, out: path.join(OUT, `leak_${TAG}diff_${name}.png`), W: pr.W, H: pr.H, far: pr.far.inner, ctl: pr.ctl.inner }); };
    // every torch-on take against the torch-off reference of the SAME call sequence (b for the plain boots, moveb for the sweep boots, b<x> for a switch's own reference when it was taken)
    for (const v of ['a', 'n', 'f', 'c', 'cn', 'd', 'dn', 'e']) { const own = { c: 'bc', cn: 'bc', d: 'bd', dn: 'bd', e: 'be' }[v]; const ref = own && f(own) ? own : f('b') ? 'b' : 'moveb'; job(`${v}_vs_${ref}`, f(v), f(ref)); for (const k of ['direct', 'indirect']) job(`${v}_${k}_vs_${ref}`, f(v, k), f(ref, k)); }
    for (const v of ['move', 'moven']) for (const k of ['final', 'swept', 'swept6', 'direct']) job(`${v}_${k}_vs_moveb`, f(v, k), f('moveb', k));
    job('n_vs_a', f('n'), f('a')); job('moven_swept_vs_move', f('moven', 'swept'), f('move', 'swept')); job('noise_moveb_vs_b', f('moveb'), f('b'));
    const dres = diffs(jobs);
    console.log('\n=== staging', STAGING, JSON.stringify(ST));
    if (pr) console.log('projection', JSON.stringify({ ...pr, rim: pr.rim && { axis: pr.rim.axis, n: pr.rim.pts.length } }));
    for (const v of Object.keys(R)) console.log(v, JSON.stringify({ url: R[v].url, frame: R[v].frame && { ...R[v].frame, ms: undefined, secPerFrame: +(R[v].frame.ms.reduce((a, b) => a + b, 0) / R[v].frame.ms.length / 1000).toFixed(2) }, torch: R[v].info.torch, guard: R[v].info.guard, others: R[v].info.others, settings: R[v].info.settings, sweep: R[v].sweep && { dir: R[v].sweep.dir, torchOn: R[v].sweep.torchOn }, gpuErrs: R[v].gpuErrs }));
    console.log('\n=== |variant − torch-off reference| (0‥255 units; far = far-side floor in the beam\'s line, ctl = far-side floor out of it)');
    for (const d of dres) console.log(d.err ? `${d.name}: ${d.err}` : `${d.name.padEnd(18)} far mean ${String(d.far.mean).padEnd(7)} max ${String(d.far.max).padEnd(4)} signed ${String(d.far.signedMean).padEnd(7)} p99 ${d.far.p99} >2: ${d.far.pxOver2}/${d.far.px} >8: ${d.far.pxOver8} (ref mean ${d.far.refMean}) | ctl mean ${d.ctl.mean} max ${d.ctl.max} signed ${d.ctl.signedMean} | rect far ${JSON.stringify(d.far.rect)} ctl ${JSON.stringify(d.ctl.rect)} → ${d.out}`);
    fs.writeFileSync(path.join(OUT, `leak_${TAG}results_${want.join('-') || 'diff'}.json`), JSON.stringify({ staging: STAGING, ST, quality: QUALITY, scale: SCALE, view: [VW, VH], runs: R, diffs: dres, errors }, null, 1));
  }
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  log(`dev server (pid ${pid}) stopped · ${errors.length ? errors.length + ' console / page errors:\n' + errors.join('\n') : 'no console or page error'}`);
  process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
