// THE FOG LIT AS THE TEAM LAST KNEW IT (FOG.lit) — stills of ONE staged frame from headless Chromium on the software WebGPU adapter (no GPU needed; fog-cone-stills.cjs's
// flag set and staging): the fog under its one fixed light (FOG.flat, as it was), lit (FOG.lit), the live frame dimmed (both 0: the oldest fog), the same frame with no fog,
// and THE FULL PICTURE (FOG.full, rule 4g: the live frame dimmed, with every light the team should not see cut where the renderer evaluates it).
// THE LEAK WATCH (--torches): every enemy's torch is then forced on at full strength and the frame drawn again, lit and live: the count of pixels that moved is
// printed for each (the live fog shows the torches' pools in rooms nobody sees; the lit fog may move only where the team sees the floor a pool spills on; the full
// picture is the renderer's own noisy frame, so it is first drawn twice with nothing changed and the torches' count is read against that). The lit fog too is
// first drawn twice with nothing changed, and its torches' count read against 3 x that: 0 on a settled picture, so the rule is the old one (any patch at all is a
// leak). A picture that has NOT SETTLED moves by itself and makes the watch loose: on pass.json `--frames 12` reads 1236 full and 3160 lit fog px in patches with
// nothing changed (640 x 400; the same on two trees, and with the particles' splats not drawn), where the default 45 reads 0 and 0. The tool says so when it sees it.
// THE SOFT EDGE (--edge [--band m]; FOG.edge): the full picture with the hard line, the same again, and with the band — the band lies ACROSS the sight line, so it
// must DIM pixels in patches (the seen side) and BRIGHTEN pixels in patches (the fog's side), each more than three times what the unchanged pair moves, and the
// two together under 35 % of the picture. IT WANTS A STAGING WITH A SIGHT LINE ACROSS OPEN FLOOR, CLOSE IN (pass.json `--look 22,20 --dist 14`: the gate, 2081 / 2605 px against 55 / 85 unchanged; as it opens, 304 / 646 against 52 / 201): a wall
// keeps its line by design, and from far out the band is a few pixels — the mouse hole at `--look 14,13 --dist 30` and the pass at `--dist 52` both read NO BAND.
// It also writes foglit_edge_was.png, the fog as it was until 10-15 (the hard line, greyed by 0.75), for the eye.
// It also is the check that the page's bundle boots with the change in it and that fogofwar.wgsl compiles (console / GPU errors fail it).
//   node tools/qa/fog-lit-stills.cjs [--out DIR] [--level mousehole.json | office] [--quality low] [--w 960 --h 600] [--look x,z] [--dist 24] [--pitch 62] [--yaw deg] [--frames 45] [--torches | --quick | --edge [--band m]] [--q 'extra&query']
// The dev server is started from this checkout on a free port and stopped by pid.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots'))), QUALITY = flag('--quality', 'low'), VW = +flag('--w', 960), VH = +flag('--h', 600);
const LEVEL = flag('--level', 'mousehole.json'), LOOK = flag('--look', ''), DIST = +flag('--dist', 24), PITCH = +flag('--pitch', 62), YAW = flag('--yaw', ''), FRAMES = +flag('--frames', 45), TORCHES = argv.includes('--torches');
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let srv = null, browser = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(); srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port}`);
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 }); const errors = [];
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || NOISE.test(x)) return; errors.push(x.slice(0, 500)); log('console.error', x.slice(0, 400)); });
  const url = `http://localhost:${port}/?${[LEVEL && LEVEL !== "office" ? `levelFile=${LEVEL}` : "", 'roomclear', 'squad4', 'difficulty=hard', 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp', flag('--q', '')].filter(Boolean).join('&')}`;
  log('goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 900) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const boot = await page.evaluate(async () => {
    window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine; try { window.__menu.close(); } catch { }
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    const real = E.render.bind(E); window.__draw = on => { E.render = on ? real : () => { }; };   // (on the software adapter a drawn frame is seconds: nothing is drawn while staging)
    g.godMode = true; const FOG = window.__knobs.registry().FOG;
    return { fogOn: g.fogOfWar.on, lit: FOG.lit, flat: FOG.flat, fill: FOG.litFill, pipelines: window.__boot && window.__boot.pipelines, targets: g.targets.filter(t => t.light || t.areaLights).length, team: g.guards.filter(x => x.team === 'operative').length, foes: g.guards.filter(x => x.team !== 'operative').length };
  });
  log('booted', JSON.stringify(boot));
  const staged = await page.evaluate(async ([w, h, look, dist, pitch, yaw, frames]) => {
    const g = window.__game; window.__draw(false); window.__mouse(w * 0.5, h * 0.22); window.__runFrames(frames); document.body.classList.add('breaching');   // (index.html: kit, meters, markers and prompts hidden — the picture alone)
    const p = g.player.char.pos; const at = look ? look.split(',').map(Number) : [p[0], p[2]];
    const r = window.__stage({ look: [at[0], 0, at[1]], yaw: yaw === '' ? (window.__cam.yaw || 0) : +yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, dist }, {});
    window.__mouse(w * 0.5, h * 0.22); window.__runFrames(30); window.__draw(true);
    return { pin: r.pin, player: [...p].map(x => +x.toFixed(2)), lamps: g.targets.filter(t => t.light || t.areaLights).map(t => `${t.name}@${t.pos.map(x => x.toFixed(1))}${t.on && !t.broken ? '' : ' (dark)'}`).slice(0, 40), summary: g.fogOfWar.summary() };
  }, [VW, VH, LOOK, DIST, PITCH, YAW, FRAMES]);
  log('staged', JSON.stringify(staged));
  const still = async (name, set, fog = true) => {
    const r = await page.evaluate(async ([set, fog]) => { const g = window.__game, FOG = window.__knobs.registry().FOG; Object.assign(FOG, set); g.fogOfWar.on = fog; const dt = 1 / 600;   // (a sliver of time a frame: the picture settles, nobody walks)
      if (set.full && fog) for (let i = 0; i < 40 && !window.__engine.fogSight.live; i++) { window.__runFrames(1, dt); await window.__done(); }   // (the sight table's program compiles on the first fogged frame that asks for it: until it has, the pass draws the lit fog)
      try { window.__engine.resetTaa('still'); } catch { }   // (the resolve's history is the last still's picture: without this half of it is still in the seventh frame)
      const t0 = performance.now(); for (let i = 0; i < 7; i++) { window.__runFrames(1, dt); await window.__done(); }
      const F = g.fogOfWar; return { ms: Math.round((performance.now() - t0) / 7), full: F.frame.full, live: window.__engine.fogSight.live, sight: window.__engine.fogSight.dispatched, classed: F.fullStats, lit: F.frame.lit, lights: F.frame.lightCount, stats: F.litStats, ran: (window.__engine.passes && window.__engine.passes.fogPass && window.__engine.passes.fogPass.ran) || '?', gpuErrs: window.__gpuErrs.slice() }; }, [set, fog]);
    const file = path.join(OUT, `foglit_${name}.png`); const png = await page.screenshot({ path: file }); log(name, JSON.stringify(r), '→', file); if (set.full && fog && !r.live) errors.push(`${name}: the sight table was not live — the full picture was not what was drawn`); return { ...r, png };
  };
  const base = await page.evaluate(() => { const F = window.__knobs.registry().FOG; return { lit: F.lit || 1, flat: F.flat || 0.12 }; });   // (FOG.full — rule 4g, the page's — is put by each still: the three older fogs are drawn with it off)
  const shots = [];
  if (argv.includes('--quick')) {   // the boot check alone: the page's bundle, every program, and ONE still of the full picture
    const q = await still('full', { full: true, lit: base.lit, flat: base.flat }); await browser.close().catch(() => { }); browser = null; stop();
    const bad = errors.length + q.gpuErrs.length; log(bad ? `${errors.length} console / page errors, ${q.gpuErrs.length} GPU errors` : 'clean: no console, page or GPU error'); process.exit(bad ? 1 : 0);
  }
  if (argv.includes('--edge')) {   // THE SOFT EDGE (FOG.edge): the full picture with the hard line, the same again, and with the band — what the band dims on the seen side and brightens on the fog's
    const band = +flag('--band', 0) || await page.evaluate(() => window.__knobs.registry().FOG.edge) || 0.5, set = { full: true, lit: base.lit, flat: base.flat };
    const desat = await page.evaluate(() => window.__knobs.registry().FOG.desat), was = await still('edge_was', { ...set, edge: 0, desat: 0.75 });   // (the fog as it was until 10-15: the hard line, greyed — a still for the eye, not measured)
    const hard = await still('edge_off', { ...set, edge: 0, desat }), hard2 = await still('edge_off_again', { ...set, edge: 0 }), soft = await still('edge_on', { ...set, edge: band });
    const cmp = async (a, b) => page.evaluate(async ([A, B]) => { const im = async s => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      // (b against a, by the sum of the three channels: a pixel is DIMMER / BRIGHTER by more than 8 of 765; in patches = its 3 × 3 neighbours all are, so the resolve's one-pixel jitter along an edge is not counted)
      const a = await im(A), b = await im(B), W = innerWidth, n = a.length / 4, dn = new Uint8Array(n), up = new Uint8Array(n); let dimmer = 0, brighter = 0, most = 0;
      for (let i = 0; i < a.length; i += 4) { const d = (b[i] + b[i + 1] + b[i + 2]) - (a[i] + a[i + 1] + a[i + 2]); if (d < -8) { dn[i >> 2] = 1; dimmer++; } else if (d > 8) { up[i >> 2] = 1; brighter++; if (d > most) most = d; } }
      const patches = m => { let k = 0; const H = n / W; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let all = 1; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!m[(y + dy) * W + x + dx]) { all = 0; break; } k += all; } return k; };
      return { dimmer, dimmerPatch: patches(dn), brighter, brighterPatch: patches(up), most, of: n }; }, [a.toString('base64'), b.toString('base64')]);
    const noise = await cmp(hard.png, hard2.png), d = await cmp(hard2.png, soft.png);
    log(`THE SOFT EDGE · band ${band} m · drawn twice with the hard line: ${noise.dimmerPatch} px dimmer and ${noise.brighterPatch} brighter in patches (${noise.dimmer} / ${noise.brighter} in all) · with the band: ${d.dimmerPatch} px DIMMER in patches (${d.dimmer} in all) · ${d.brighterPatch} BRIGHTER in patches (${d.brighter} in all, most ${d.most}/765) of ${d.of}`);
    if (noise.dimmerPatch + noise.brighterPatch > 40) log(`NOT SETTLED: the stills move with nothing changed — stage for longer (--frames, default 45)`);
    if (!(d.dimmerPatch > Math.max(40, noise.dimmerPatch * 3))) errors.push(`NO BAND: the soft edge dims ${d.dimmerPatch} px in patches (${noise.dimmerPatch} with nothing changed) — the fog's line is as hard as it was`);
    if (!(d.brighterPatch > Math.max(40, noise.brighterPatch * 3))) errors.push(`NO BAND ON THE FOG'S SIDE: the soft edge brightens ${d.brighterPatch} px in patches (${noise.brighterPatch} with nothing changed) — the band lies across the line, half of it in the fog`);
    if (d.dimmer + d.brighter > 0.35 * d.of) errors.push(`TOO MUCH: the band moves ${d.dimmer + d.brighter} of ${d.of} px — a band along the sight edges is a small share of the picture`);
    const gpuE = [was, hard, hard2, soft].flatMap(x => x.gpuErrs); await browser.close().catch(() => { }); browser = null; stop();
    const bad = errors.length + gpuE.length; log(bad ? `${errors.length} errors, ${gpuE.length} GPU errors` : 'clean: no console, page or GPU error'); if (errors.length) console.log(errors.join('\n')); if (gpuE.length) console.log([...new Set(gpuE)].join('\n')); process.exit(bad ? 1 : 0);
  }
  shots.push(await still('flat', { full: false, lit: 0, flat: base.flat }));
  shots.push(await still('lit', { full: false, lit: base.lit, flat: base.flat }));
  shots.push(await still('live', { full: false, lit: 0, flat: 0 }));
  shots.push(await still('open', { full: true, lit: base.lit, flat: base.flat }, false));
  const full = await still('full', { full: true, lit: base.lit, flat: base.flat });
  if (TORCHES) {
    const hi = await still('mask', { full: false, lit: 0, flat: 0.5 }), again = await still('full_again', { full: true, lit: base.lit, flat: base.flat }), litAgain = await still('lit_again', { full: false, lit: base.lit, flat: base.flat });   // (the full picture drawn twice with nothing changed: what its own noise moves)
    // every enemy's torch held on at full strength, whatever his own rule says: the property is pinned for the rest of the visit
    const n = await page.evaluate(() => { const g = window.__game; let n = 0; for (const gd of g.guards) { if (gd.team === 'operative' || gd.state === 'dead' || !gd.flashlight) continue; const fl = gd.flashlight, I = Math.max(fl.peakIntensity || 0, fl.intensity || 0, 120);
      Object.defineProperty(fl, 'enabled', { get: () => true, set() { }, configurable: true }); Object.defineProperty(fl, 'intensity', { get: () => I, set() { }, configurable: true }); n++; } return n; });
    const diff = async (a, b, m0, m1) => page.evaluate(async ([A, B, M0, M1]) => { const im = async s => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      // (the mask: a pixel is UNSEEN where the fog's fixed light at two levels gives two pictures — the team's own floor does not answer to that row)
      // (PATCHES: a moved pixel whose 5 × 5 neighbours all moved — a pool of light; the resolve's own jitter moves one-pixel lines along edges from one still to the next, and those are not that)
      const a = await im(A), b = await im(B), m0 = await im(M0), m1 = await im(M1); let moved = 0, most = 0, unseen = 0, seenMoved = 0, patch = 0; const W = innerWidth, mv = new Uint8Array(a.length / 4);
      for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])), fog = Math.abs(m0[i] - m1[i]) + Math.abs(m0[i + 1] - m1[i + 1]) + Math.abs(m0[i + 2] - m1[i + 2]) > 24;
        if (fog) { unseen++; if (d > 6) { moved++; mv[i >> 2] = 1; } if (d > most) most = d; } else if (d > 6) seenMoved++; }
      const H = mv.length / W; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let all = 1; for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2; dx++) if (!mv[(y + dy) * W + x + dx]) { all = 0; break; } patch += all; }
      return { moved, patch, most, unseen, seenMoved, of: a.length / 4 }; }, [a.toString('base64'), b.toString('base64'), m0.toString('base64'), m1.toString('base64')]);
    const fullT = await still('full_torches', { full: true, lit: base.lit, flat: base.flat }), litT = await still('lit_torches', { full: false, lit: base.lit, flat: base.flat }), liveT = await still('live_torches', { full: false, lit: 0, flat: 0 });
    const dl = await diff(shots[1].png, litT.png, shots[0].png, hi.png), dv = await diff(shots[2].png, liveT.png, shots[0].png, hi.png); shots.push(hi, again, litAgain, fullT, litT, liveT); const dnl = await diff(shots[1].png, litAgain.png, shots[0].png, hi.png);
    const dn = await diff(full.png, again.png, shots[0].png, hi.png), df = await diff(again.png, fullT.png, shots[0].png, hi.png);
    log(`LEAK WATCH, THE FULL PICTURE · drawn twice with nothing changed: ${dn.patch} fog px moved in patches (${dn.moved} in all, most ${dn.most}/255; ${dn.seenMoved} where the team sees) · with the torches on: ${df.patch} in patches (${df.moved} in all, most ${df.most}/255; ${df.seenMoved} where the team sees)`);
    if (dn.patch > 40 || dnl.patch > 0) { log(`NOT SETTLED: the stills move with nothing changed (${dn.patch} full, ${dnl.patch} lit fog px in patches) — the watch below only tells a leak over three times that; stage for longer (--frames, default 45)`); }
    if (df.patch > Math.max(40, dn.patch * 3)) { errors.push(`LEAK: ${df.patch} fog px moved in patches under the full picture with the enemy's torches forced on (${dn.patch} with nothing changed)`); }
    log(`LEAK WATCH · ${n} enemy torches forced on · ${dl.unseen} of ${dl.of} px are fog · lit fog drawn twice with nothing changed: ${dnl.patch} in patches (${dnl.moved} in all) · lit fog with the torches on: ${dl.patch} fog px moved in patches (${dl.moved} in all, most ${dl.most}/255; ${dl.seenMoved} px moved where the team sees) · live fog: ${dv.patch} in patches (${dv.moved} in all, most ${dv.most}/255; ${dv.seenMoved} where the team sees)`);
    if (dl.patch > dnl.patch * 3) { errors.push(`LEAK: ${dl.patch} fog px moved in patches under the lit fog with the enemy's torches forced on (${dnl.patch} with nothing changed)`); }
  }
  shots.push(full); const gpu = shots.flatMap(s => s.gpuErrs);
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  const bad = errors.length + gpu.length; log(`dev server (pid ${pid}) stopped · ${bad ? `${errors.length} console / page errors, ${gpu.length} GPU errors` : 'clean: no console, page or GPU error'}`);
  if (gpu.length) console.log([...new Set(gpu)].join('\n')); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
