// THE FOG OF WAR PASS, OLD AGAINST HINTED (render/fogofwar.ts, shaders/fogofwar.wgsl) — on the real page in headless Chromium on the software WebGPU adapter
// (SwiftShader: no GPU needed; draw-equal.cjs's recipe and flags). Per boot (one level, one difficulty) three pinned views of a squad mission: `early` = the team
// where the mission starts, `late` = the five of them spread through the building (each put where a defender stood, the defenders parked), `cut` = late with cut pieces alive. Per view:
//   · THE PICTURE, PROGRAM AGAINST PROGRAM: the frame's own fog inputs (its copy of hdr, its g-buffer, its uniform block, the scene as uploaded) run through the
//     old kernel and through the hinted one into scratch textures (FogPass.qaRun) and compared half for half — the two programs on identical inputs;
//   · THE WORK: the counting twins of both — walks of the trace grid (rays), the box tests and cells those walks took, the hints' box tests, the table pass's own
//     rays — summed over the frame, and how often a hint answered where the walk says clear (must be 0);
//   · (once a boot, after its views) the switch flipped live to the other program and back: the fog on every frame, the program asked for running once compiled;
//   · the drawn frame itself read back (sha256 + raw RGBA): two boots of two builds / two flags staged alike compare frame for frame with `compare`.
//   node tools/qa/fog-pass-check.cjs run <outDir> [--root <checkout>] [--levels compound,depot] [--difficulty standard,hard] [--q 'fogpass=old'] [--quality medium] [--size 640x360] [--views early,late,cut] [--jobs 2]
//       (`cut` = the late view again with cut test pieces alive: the frame, and both programs run again, on the second set of programs — render/cutSwap.ts)
//       exit 0 = every boot clean (no console / page / GPU error), old == hinted on every view, no disagreement; 1 = not. A build without FogPass.qaRun (the base)
//       is only drawn and read back.
//   node tools/qa/fog-pass-check.cjs compare <dirA> <dirB>      frame for frame: EQUAL, or the differing pixels counted (+ the largest channel difference)
// The dev server is started from --root (default: this checkout) on a free port and stopped by pid. Slow by nature: about 100 s to boot a page, seconds a frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

// ---- in the page ------------------------------------------------------------------------------------------------------------------------------------------
// straight after __ready: seeded dice, the loop held, a fresh encounter, the helpers (draw-equal.cjs PREP, cut to what this needs)
const PREP = (seed) => {
  window.__testVisible = true; window.__pauseLoop = true;
  let s0 = seed | 0;
  Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const E = window.__engine, g = window.__game;
  window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
  window.__menu.close(); window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
  const real = E.render; const Q = window.__fq = { stub: false, drawn: 0 };
  E.render = function (cam, t, dt) { if (Q.stub) return; Q.drawn++; return real.call(E, cam, t, dt, false); };   // drawn frames go to the offscreen target; stubbed = the simulation alone steps
  Q.play = (n, dt = 1 / 60) => { const was = Q.stub; Q.stub = true; try { window.__runFrames(n, dt); } finally { Q.stub = was; } };
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  Q.settle = async () => { await E.device.queue.onSubmittedWorkDone(); await yieldMacro(); await yieldMacro(); };
  Q.draw = async (n, dt = 1 / 600) => { for (let i = 0; i < n; i++) { window.__runFrames(1, dt); await Q.settle(); } };
  Q.pass = () => E.passes.fogPass || null;
  g.restartEncounter(); g.godMode = true; document.body.classList.add('breaching');
  for (const c of [g.player.char, ...g.guards.map(x => x.char)]) if (c && c.anim) c.anim.phase = 0;
  Q.play(1);
  const FOG = window.__knobs && window.__knobs.registry().FOG;
  return { time: g.time, fogOn: g.fogOfWar.on, cone: FOG ? FOG.cone : null, pass: g.fogOfWar.frame.pass || '(base)', team: g.guards.filter(x => x.team === 'operative').length, foes: g.guards.filter(x => x.team !== 'operative').length, pipelines: window.__boot && window.__boot.pipelines };
};
// the two stagings. early: the team where the scenario puts it, a second in. late: each of the five where a defender stood (the five furthest apart), the rest parked.
const STAGE = ([view, w, h]) => {
  const g = window.__game, Q = window.__fq, D = Math.PI / 180;
  const fit = (pts, minDist) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    return { look: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw: 0, pitch: 78 * D, dist: Math.max(minDist, 1.15 * Math.max(x1 - x0, (z1 - z0) * 1.78) + 8) }; };
  if (view === 'early') {
    window.__mouse(w * 0.5, h * 0.22); Q.play(45);
    const team = [g.player.char.pos, ...g.guards.filter(x => x.team === 'operative').map(x => x.char.pos)];
    window.__stage(fit(team, 21), {}); window.__mouse(w * 0.5, h * 0.22); Q.play(20);
  } else {
    const ops = g.guards.map((x, i) => ({ x, i })).filter(o => o.x.team === 'operative'), foes = g.guards.filter(x => x.team !== 'operative' && x.state !== 'dead').map(x => [x.char.pos[0], 0, x.char.pos[2]]);
    const pick = [foes[0]]; const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
    while (pick.length < Math.min(ops.length + 1, foes.length)) { let best = null, bd = -1; for (const f of foes) { const m = Math.min(...pick.map(p => d2(p, f))); if (m > bd) { bd = m; best = f; } } pick.push(best); }
    const yawOf = (k) => (k * 137.5) * D;   // each man looks his own way (the golden angle: no two alike)
    window.__stage(fit(pick, 21), { park: true, guards: ops.slice(0, pick.length - 1).map((o, k) => ({ i: o.i, pos: pick[k + 1], yaw: yawOf(k + 1) })), player: { pos: pick[0], yaw: yawOf(0) } });
    g.aiEnabled = false; window.__mouse(w * 0.5, h * 0.3); Q.play(6);
  }
  const F = g.fogOfWar;
  return { eyes: F.eyes.map(e => ({ id: e.id, at: (e.at || e.pos).map(x => +x.toFixed(2)) })), count: F.frame.count, hidden: g.guards.filter(x => x.state !== 'dead' && !F.drawn(x)).length, pin: window.__cam.pin && { look: window.__cam.pin.look.map(x => +x.toFixed(2)), dist: +window.__cam.pin.dist.toFixed(2) } };
};
// the late view again with cut pieces alive (scene/cut.ts): the second set of programs awaited, a test wedge stood a stride from each eye and one at the look-at,
// frames drawn until the frame is on the cut set — the fog's rays then meet cut shapes, and qaRun compiles both programs behind the cut prelude
const STAGECUT = async () => {
  const g = window.__game, Q = window.__fq, C = window.__cut, F = g.fogOfWar;
  if (!C || !C.on) return { skipped: 'cut boxes are off in this build' };
  const ready = await C.programs.ready; const pin = window.__cam.pin; if (!pin) return { skipped: 'no pinned view to stand the pieces in (the cut view follows early or late)' };
  // (a loose thing is in the picture only where the team sees the floor it stands on — FOG.things: each piece goes on the first seen spot round an eye)
  const at = [], seen = (x, z) => !F.spotSeen || F.spotSeen(x, z); if (seen(pin.look[0], pin.look[2])) at.push([pin.look[0], 0, pin.look[2]]);
  for (const e of F.eyes.slice(0, F.frame.count)) { const p = e.at || e.pos; let put = false;
    for (const r of [1.3, 0.9, 1.8]) { for (let k = 0; k < 8 && !put; k++) { const x = p[0] + r * Math.cos(k * Math.PI / 4 + 0.3), z = p[2] + r * Math.sin(k * Math.PI / 4 + 0.3); if (seen(x, z)) { at.push([x, 0, z]); put = true; } } if (put) break; } }
  if (!at.length) return { skipped: 'no seen floor round any eye to stand a cut piece on' };
  // (EACH PIECE A THING OF ITS OWN: the hook keys its pieces by a serial, and the things rule reads serials 0‥31 of that range as the parts of ONE thing — judged
  //  at the middle of them all, which with a piece by every eye is floor somewhere between the men, seen or not by the luck of the staging. Keys 32 apart are
  //  one thing each, judged where it stands.)
  at.forEach((p, k) => { const b = C.test(p, k % 2 ? 'wedge' : 'lump', { scale: k % 2 ? 2.4 : 3, yaw: k * 0.7 }); if (b && b.mkey !== undefined) b.mkey = b.mkey - (b.mkey & 0xFFF) + 0xC00 + (k << 5); });
  const mid = at.reduce((m, p) => [m[0] + p[0] / at.length, m[1] + p[2] / at.length], [0, 0]);
  const P = Q.pass(), twins = () => !!(P && P.cutSet && P.cutSet.cut);   // the fog pass joins the swap late (its programs are made on the first fogged frame): its own cut twins in too —
  for (let i = 0; i < 2400 && !twins() && C.programs.state !== 'failed' && !(P && P.failed); i++) await new Promise(r => setTimeout(r, 250));   // waited for by state (a loaded box compiles for minutes), not drawn through
  const n = 1; await Q.draw(n);   // (a fixed count: the first frame with a piece alive takes the cut set)
  return { ready, twins: twins(), pieces: at.length, traced: C.stats.traced, middleSeen: seen(mid[0], mid[1]), frames: n, live: !!(C.programs.live && P && P.cutSet.live), info: C.programs.info, stats: C.stats, things: F.thingStats ? { ...F.thingStats } : null, eyes: F.frame.count, hidden: g.guards.filter(x => x.state !== 'dead' && !F.drawn(x)).length };
};
// the first drawn frames, THE SAME COUNT ON EVERY BUILD (two boots compare frame for frame only after the same call sequence): one frame asks for the program, the
// compile is waited for without drawing, one more frame runs it
const WARM = async () => {
  const Q = window.__fq, g = window.__game, want = g.fogOfWar.frame.pass || null;
  await Q.draw(1);
  for (let i = 0; i < 480; i++) { const P = Q.pass(); if (P && P.ready && (!want || !P.has || P.has(want) || P.failed)) break; await new Promise(r => setTimeout(r, 250)); }
  await Q.draw(1);
  const P = Q.pass(); return { frames: 2, ready: !!(P && P.ready), dispatched: P ? P.dispatched ?? '(base)' : 0, ran: P ? P.ran ?? '(base)' : null };
};
// K drawn frames from a dropped history, then the frame read back
const SHOOT = async (k) => {
  const E = window.__engine, Q = window.__fq; E.resetTaa('fog-pass-check'); const P = Q.pass(), d0 = P ? P.dispatched : 0;
  await Q.draw(k);
  const fr = await E.readbackFrame(); if (!fr) return { err: 'no frame' };
  const d = fr.data; if (fr.bgra) for (let i = 0; i < d.length; i += 4) { const b = d[i]; d[i] = d[i + 2]; d[i + 2] = b; }
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  let s = ''; const CH = 0x8000; for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
  return { w: fr.w, h: fr.h, ran: P ? (d0 === undefined ? (P.ready ? k : 0) : P.dispatched - d0) : 0, mode: P ? P.ran ?? '(base)' : null, cutSet: !!(P && P.cutSet && P.cutSet.live), b64: btoa(s), gpuErrs: window.__gpuErrs.slice(), comp: [E.passes.cw, E.passes.ch] };
};
// THE SWITCH, LIVE (FogFrame.pass — what a sweep row flips): to the other program and back. Every frame keeps its fog (the program that is in draws while the
// other compiles), and once compiled the one asked for is the one that runs.
const FLIP = async () => {
  const g = window.__game, Q = window.__fq, P = Q.pass(), F = g.fogOfWar.frame; if (!P || F.pass === undefined || !P.has) return null;
  const was = F.pass, to = was === 'old' ? 'hint' : 'old', out = { from: was, to, steps: [] };
  for (const want of [to, was]) { F.pass = want; const d0 = P.dispatched; await Q.draw(1); for (let i = 0; i < 480 && !(P.has(want) || P.failed); i++) await new Promise(r => setTimeout(r, 250)); await Q.draw(2); out.steps.push({ want, ran: P.ran, dispatched: P.dispatched - d0 }); }
  out.ok = out.steps.every(x => x.ran === x.want && x.dispatched === 3); out.gpuErrs = window.__gpuErrs.slice(); return out;
};
// the last drawn frame's fog inputs through both programs (the picture), then through both counting twins (the work)
const AB = async () => {
  const P = window.__fq.pass(); if (!P || !P.qaRun) return null;
  const f16 = (h) => { const e = (h >> 10) & 31, m = h & 1023, s = h & 0x8000 ? -1 : 1; return e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15); };
  const a = await P.qaRun('old', false), b = await P.qaRun('hint', false); if (!a || !b) return { err: 'no frame to run again' };
  const n = a.w * a.h; let diff = 0, maxD = 0;
  for (let i = 0; i < n; i++) { let d = false; for (let c = 0; c < 4; c++) if (a.halves[i * 4 + c] !== b.halves[i * 4 + c]) { d = true; maxD = Math.max(maxD, Math.abs(f16(a.halves[i * 4 + c]) - f16(b.halves[i * 4 + c]))); } if (d) diff++; }
  const sum = async (mode) => { const r = await P.qaRun(mode, true); let rays = 0, hints = 0, tests = 0, cells = 0, bad = 0, clipped = 0, hist = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) { let x = f16(r.halves[i * 4]); const k = Math.floor(x / 64); bad += k; x -= 64 * k; rays += x; hist[Math.min(5, x)]++; const ht = f16(r.halves[i * 4 + 1]), bt = f16(r.halves[i * 4 + 2]), ce = f16(r.halves[i * 4 + 3]); hints += ht; tests += bt; cells += ce; if (bt >= 2048 || ce >= 2048 || ht >= 2048) clipped++; }   // (a half float counts whole numbers exactly to 2048: a pixel past it is reported, not summed as if exact)
    let pre = null; if (r.pre) { let pt = 0, pc = 0; for (const v of r.pre) { pt += v & 0xffff; pc += v >>> 16; } pre = { rays: r.pre.length, tests: pt, cells: pc }; }
    return { rays, hints, tests, cells, disagree: bad, clipped, raysHist: hist, pre }; };
  const old = await sum('old'), hint = await sum('hint');
  return { w: a.w, h: a.h, cut: !!a.cut, pixels: n, differ: diff, maxDelta: maxD, old, hint, gpuErrs: window.__gpuErrs.slice() };
};

// ---- node side ---------------------------------------------------------------------------------------------------------------------------------------------
async function boot(browser, port, level, difficulty, opt, outDir) {
  const name = `${level}-${difficulty}`, errors = []; const [VW, VH] = opt.size;
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 }); let noise = 0;
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 400)); log(name, 'PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error') return; if (NOISE.test(x) && ++noise <= 80) return; errors.push(x.slice(0, 400)); log(name, 'console.error', x.slice(0, 300)); });
  const url = `http://localhost:${port}/?${['roomclear', 'squad4', `levelFile=${level}.json`, `difficulty=${difficulty}`, 'seed=1', 'paused', 'mute', `quality=${opt.quality}`, 'fogfull=0', opt.q].filter(Boolean).join('&')}`;
  page.on('framenavigated', f => { if (f === page.mainFrame()) log(name, 'navigated', f.url()); });
  log(name, 'goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error(`${name}: the page never set __ready: ${errors.join(' | ')}`); await new Promise(r => setTimeout(r, 500)); }
  for (let i = 0; ; i++) { try { await page.evaluate(() => window.__ready); break; } catch (e) { if (i >= 3 || !/context was destroyed|navigation/i.test(String(e))) throw e; log(name, 'the page loaded again while booting (', page.url(), ') — waiting once more'); await page.waitForLoadState('domcontentloaded').catch(() => { }); for (let j = 0; j < 240; j++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } await new Promise(r => setTimeout(r, 500)); } } }
  const R = { name, url, level, difficulty, prep: await page.evaluate(PREP, 4242), views: {} };
  log(name, 'booted', JSON.stringify(R.prep));
  let warmed = false;
  for (const view of opt.views) {
    const V = R.views[view] = { staged: view === 'cut' ? await page.evaluate(STAGECUT) : await page.evaluate(STAGE, [view, VW, VH]) };
    if (V.staged.skipped) { log(name, view, V.staged.skipped); delete R.views[view]; continue; }
    if (view === 'cut') { const s = V.staged; log(name, 'cut staged', JSON.stringify({ ready: s.ready, twins: s.twins, pieces: s.pieces, traced: s.traced, middleSeen: s.middleSeen, live: s.live, things: s.things }));
      if (!s.live) errors.push(`cut: the frame never took the cut programs — ${!s.ready ? 'the second set of programs did not compile' : !s.twins ? "the fog pass's own cut twins never came in" : !s.traced ? `none of the ${s.pieces} test pieces reached the frame's traced list (kept out of the picture: the fog's things rule?)` : 'pieces traced, set not live'} (${JSON.stringify(s.info)})`); }
    if (!warmed) { V.warm = await page.evaluate(WARM); warmed = true; }
    const shot = await page.evaluate(SHOOT, opt.frames); const rgba = Buffer.from(shot.b64 || '', 'base64'); delete shot.b64;
    shot.sha256 = crypto.createHash('sha256').update(rgba).digest('hex'); V.shot = shot;
    fs.writeFileSync(path.join(outDir, `${name}-${view}.rgba`), rgba); await page.screenshot({ path: path.join(outDir, `${name}-${view}.png`) });
    V.ab = await page.evaluate(AB);
    log(name, view, JSON.stringify({ eyes: V.staged.count, hidden: V.staged.hidden, warm: V.warm, ran: shot.ran, mode: shot.mode, cutSet: shot.cutSet, sha: shot.sha256.slice(0, 16), ab: V.ab && (V.ab.err ? V.ab : { cut: V.ab.cut, differ: V.ab.differ, disagree: [V.ab.old.disagree, V.ab.hint.disagree], rays: [V.ab.old.rays, V.ab.hint.rays], tests: [V.ab.old.tests, V.ab.hint.tests + V.ab.hint.hints], pre: V.ab.hint.pre }) }));
  }
  R.flip = await page.evaluate(FLIP); if (R.flip) { log(name, 'flip', JSON.stringify(R.flip)); if (!R.flip.ok) errors.push(`flip: ${JSON.stringify(R.flip.steps)}`); }
  R.errors = errors; R.gpuErrs = [...new Set([...Object.values(R.views).flatMap(v => [...(v.shot.gpuErrs || []), ...((v.ab && v.ab.gpuErrs) || [])]), ...((R.flip && R.flip.gpuErrs) || [])])];
  await page.close().catch(() => { });
  return R;
}
async function run() {
  const outDir = path.resolve(argv[1] || 'fog-pass-check'), ROOT = path.resolve(flag('--root', path.resolve(__dirname, '../..')));
  const opt = { quality: flag('--quality', 'medium'), size: flag('--size', '640x360').split('x').map(Number), q: flag('--q', ''), frames: +flag('--frames', 4), views: flag('--views', 'early,late,cut').split(',') };
  const levels = flag('--levels', 'compound,depot').split(','), diffs = flag('--difficulty', 'standard,hard').split(','), jobs = +flag('--jobs', 2);
  fs.mkdirSync(outDir, { recursive: true });
  const port = await freePort(); const srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const browsers = []; const stop = () => { for (const b of browsers) { try { b.close(); } catch { } } try { srv.kill(); } catch { } };
  process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port} from ${ROOT}`);
  const todo = levels.flatMap(l => diffs.map(d => [l, d])), results = [];
  const worker = async () => { for (;;) { const t = todo.shift(); if (!t) return; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); browsers.push(browser);   // a fresh browser a boot
    try { results.push(await boot(browser, port, t[0], t[1], opt, outDir)); } catch (e) { results.push({ name: `${t[0]}-${t[1]}`, died: String(e && e.stack || e).slice(0, 600), views: {}, errors: [String(e)], gpuErrs: [] }); log(t.join('-'), 'DIED', String(e).slice(0, 300)); } await browser.close().catch(() => { }); } };
  await Promise.all(Array.from({ length: Math.min(jobs, todo.length) }, worker));
  results.sort((a, b) => a.name < b.name ? -1 : 1);
  let commit = ''; try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ commit, root: ROOT, opt, at: new Date().toISOString(), results }, null, 1));
  stop(); try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  let bad = 0;
  for (const R of results) { const e = (R.errors || []).length + (R.gpuErrs || []).length + (R.died ? 1 : 0); bad += e; if (e) console.log(`${R.name}: ${R.died || ''} ${(R.errors || []).join(' | ')} ${(R.gpuErrs || []).join(' | ')}`);
    for (const [v, V] of Object.entries(R.views)) { const A = V.ab; if (V.shot.ran !== opt.frames) { bad++; console.log(`${R.name} ${v}: the pass ran on ${V.shot.ran} of ${opt.frames} frames`); }
      if (!A) { console.log(`${R.name} ${v}: drawn only (this build has no qaRun) · frame ${V.shot.sha256.slice(0, 16)}`); continue; }
      if (A.err) { bad++; console.log(`${R.name} ${v}: ${A.err}`); continue; }
      const o = A.old, h = A.hint, wo = o.tests, wh = h.tests + h.hints + (h.pre ? h.pre.tests : 0);
      if (A.differ || o.disagree || h.disagree || o.clipped || h.clipped) bad++;
      console.log(`${R.name} ${v}${A.cut ? ' (cut programs)' : ''}: ${A.differ ? `${A.differ} PIXELS DIFFER (largest ${A.maxDelta})` : 'old == hinted, every half'} · disagreements ${o.disagree}+${h.disagree}${o.clipped || h.clipped ? ` · ${o.clipped}+${h.clipped} PIXELS PAST THE COUNTER'S RANGE` : ''} · walks ${o.rays} → ${h.rays}${h.pre ? ` + ${h.pre.rays} table` : ''} (${(100 * (h.rays + (h.pre ? h.pre.rays : 0)) / Math.max(1, o.rays)).toFixed(1)} %) · box tests ${wo} → ${wh} (${(100 * wh / Math.max(1, wo)).toFixed(1)} %) · cells ${o.cells} → ${h.cells + (h.pre ? h.pre.cells : 0)} · frame ${V.shot.sha256.slice(0, 16)}`); } }
  console.log(bad ? `=== fog-pass-check: ${bad} FAILED ===` : '=== fog-pass-check: ALL PASS ===');
  process.exit(bad ? 1 : 0);
}
function compare() {
  const A = path.resolve(argv[1]), B = path.resolve(argv[2]); const names = fs.readdirSync(A).filter(f => f.endsWith('.rgba')).sort(); let bad = 0;
  for (const f of names) { if (!fs.existsSync(path.join(B, f))) { console.log(`${f}: missing in B`); bad++; continue; }
    const a = fs.readFileSync(path.join(A, f)), b = fs.readFileSync(path.join(B, f));
    if (a.length !== b.length || !a.length) { console.log(`${f}: sizes ${a.length} / ${b.length}`); bad++; continue; }
    let n = 0, maxD = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d) { n++; if (d > maxD) maxD = d; } }
    if (n) bad++; console.log(`${f}: ${n ? `${n} of ${a.length / 4} pixels differ (largest ${maxD} of 255)` : 'EQUAL'}`); }
  for (const f of fs.readdirSync(B).filter(f => f.endsWith('.rgba'))) if (!names.includes(f)) { console.log(`${f}: missing in A`); bad++; }
  console.log(bad ? `=== compare: ${bad} NOT EQUAL ===` : `=== compare: ${names.length} frames EQUAL ===`); process.exit(bad ? 1 : 0);
}
if (argv[0] === 'run') run().catch(e => { console.error(String(e && e.stack || e)); process.exit(2); });
else if (argv[0] === 'compare' && argv[2]) compare();
else { console.log('node tools/qa/fog-pass-check.cjs run <outDir> [--root DIR] [--levels compound,depot] [--difficulty standard,hard] [--q fogpass=old] [--jobs 2]\nnode tools/qa/fog-pass-check.cjs compare <dirA> <dirB>'); process.exit(2); }
