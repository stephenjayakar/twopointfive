// Per-FRAME serialized cost sequences — the instrument for hitches (one slow frame after a settings flip / a resolution step / the first torch search),
// where the averaged per-pass numbers of tools/qa/perf-harness.js hide exactly the frame that matters. Dev only: `await import('/qa/perf-frames.js')` on a
// `?paused&quality=<preset>&mute` page (it pulls in perf-harness.js for __perf.settle / still) → window.__pf.
//
// Protocol (learned the hard way, 08-11): a frame is `engine.render(offscreen)` (or a game step) → `await queue.onSubmittedWorkDone()` → MessageChannel yields
// until the GPU timer's readback for THAT frame resolves (timer.resolved advances by exactly one per frame this way, so timer.lastFrame is this frame's).
// Do NOT put a second onSubmittedWorkDone / setTimeout between frames: the GPU idles, clocks down, and every pass reads 1.5–2× with σ of milliseconds. Never
// setTimeout at all in the pane (a hidden document clamps it to ≥ 1 s). Long runs: __pf.run(name, fn) fire-and-forget, poll __pf.res[name] from later calls.
// Rows: { i, wall (ms, JS render call → readback resolved), cpu (ms, the JS call itself), gpu (Σ compute passes of that frame), passes, res }.
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  window.__testVisible = true;
  const E = () => window.__engine;
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'];   // render-pass timestamps read as a frame on Metal: out of every Σ
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  async function oneFrame(dt = 1 / 60, render = true) {
    const t = E().timer; const before = t.resolved;
    const t0 = performance.now();
    if (render) { E().render(window.__cam, __perf.time, dt, false); __perf.time += dt; } else window.__runFrames(1, dt, []);
    const t1 = performance.now();
    await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
    const t2 = performance.now();
    let gpu = 0; const passes = {};
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = +v.toFixed(2); if (!RP.includes(k)) gpu += v; }
    return { wall: +(t2 - t0).toFixed(2), cpu: +(t1 - t0).toFixed(2), gpu: +gpu.toFixed(2), passes, dr: t.resolved - before };
  }
  /** n serialized frames; actions[i]() runs just before frame i; opts.render false = whole game steps (__runFrames) instead of offscreen renders */
  async function seq(n, actions = {}, opts = {}) {
    const rows = [];
    for (let i = 0; i < n; i++) { if (actions[i]) await actions[i](); const r = await oneFrame(opts.dt ?? 1 / 60, opts.render ?? true); r.i = i; r.res = E().width + 'x' + E().height; rows.push(r); }
    return rows;
  }
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length)); };
  const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const summ = (rows) => { const g = rows.map(r => r.gpu), w = rows.map(r => r.wall); return { n: rows.length, gpuMean: +mean(g).toFixed(2), gpuMed: +med(g).toFixed(2), gpuSd: +sd(g).toFixed(2), gpuMax: +Math.max(...g).toFixed(2), wallMean: +mean(w).toFixed(2), wallMed: +med(w).toFixed(2), wallMax: +Math.max(...w).toFixed(2) }; };
  const res = {};
  function run(name, fn) { res[name] = { running: true, t0: performance.now() }; (async () => { try { const v = await fn(); res[name] = { done: true, ms: +(performance.now() - res[name].t0).toFixed(0), v }; } catch (e) { res[name] = { error: String(e?.stack || e) }; } })(); return 'started ' + name; }
  const DEG = Math.PI / 180;
  /** the still used for the tables: cubicles from above, guards parked dark, Sam holstered at the edge of shot, life layer / grain / phases off */
  async function stageStill() {
    window.__menu?.close();
    __stage({ look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true } });
    __perf.still();
    await __perf.step(30);
  }
  /** settings[key] flipped at frame 10 and back at 23 of a 36-frame sequence, `reps` times: medians either side + the three frames right after each flip ('gpu/wall') */
  async function flipTest(key, reps = 3, val) {
    const S = E().settings; const orig = S[key]; const other = val === undefined ? !orig : val; const out = [];
    const f = r => `${r.gpu.toFixed(1)}/${r.wall.toFixed(0)}`;
    for (let rep = 0; rep < reps; rep++) {
      const rows = await seq(36, { 10: () => { S[key] = other; }, 23: () => { S[key] = orig; } });
      out.push({ base: [summ(rows.slice(2, 10)).gpuMed, summ(rows.slice(2, 10)).gpuSd, summ(rows.slice(2, 10)).wallMed], atFlip: rows.slice(10, 13).map(f), steadyFlip: [summ(rows.slice(14, 23)).gpuMed, summ(rows.slice(14, 23)).wallMed], atBack: rows.slice(23, 26).map(f), steadyBack: [summ(rows.slice(27, 36)).gpuMed, summ(rows.slice(27, 36)).wallMed], res: [rows[5].res, rows[15].res] });
    }
    return { key, orig, other, out };
  }
  /** renderScale a → b → a (frames 12 / 28 of 44): the frame of each change vs the medians around it — extra = first frame − the median of the frames after it */
  async function scaleTest(a, b, reps = 3) {
    const S = E().settings; const out = [];
    for (let rep = 0; rep < reps; rep++) {
      S.renderScale = a; await seq(6);
      const rows = await seq(44, { 12: () => { S.renderScale = b; }, 28: () => { S.renderScale = a; } });
      const st = (k, from, to) => { const first = rows[k], rest = summ(rows.slice(from, to)); return { first: { gpu: first.gpu, wall: first.wall, cpu: first.cpu }, next: { gpu: rows[k + 1].gpu, wall: rows[k + 1].wall }, steady: { gpu: rest.gpuMed, wall: rest.wallMed, sd: rest.gpuSd }, extraGpu: +(first.gpu - rest.gpuMed).toFixed(2), extraWall: +(first.wall - rest.wallMed).toFixed(2) }; };
      out.push({ res: [rows[0].res, rows[14].res, rows[30].res], base: summ(rows.slice(2, 12)), down: st(12, 16, 28), up: st(28, 32, 44) });
    }
    return { a, b, out };
  }
  window.__pf = { oneFrame, seq, summ, run, res, mean, sd, med, yieldTask, stageStill, flipTest, scaleTest, DEG };
  return 'perf-frames ready: __pf.{oneFrame,seq,summ,run,res,stageStill,flipTest,scaleTest}';
})();
