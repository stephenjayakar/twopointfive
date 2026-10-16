// SHARP-DIRECT lane (docs/internal/sharp-direct.md): the pane-side capture instrument. Dev only — `await import('/qa/sharp-harness.js')` on a
// `?paused&quality=<preset>&mute[&notaau…]` boot of THIS lane's server → window.__sh. Captures are lossless PNGs of the OUTPUT frame posted to this lane's
// shot sink (docs/shots/ab/sh_<tag>_<view>_<static|motion>.png); the metrics (edge-spread, local contrast) are computed OFFLINE from those PNGs by
// tools/qa/sharp-metrics.py, so a capture is taken once and graded as often as the edge definitions change.
//   boot()                      hooks up, error capture, ports, dice seeded, menu closed
//   go(view, settle)            stage a view (camera pinned VERBATIM, guards parked dark unless the view stages one, Sam invisible, phases / grain / life off) + settle renders
//   capStatic(tag, view)        go + 40 settled renders → PNG  sh_<tag>_<view>_static
//   capMotion(tag, view)        go, then a 20-frame 0.3°/frame orbit ENDING at the view's own yaw (so the static edge definitions apply) → PNG of the last MOVING frame  sh_<tag>_<view>_motion
//   capAll(tag)                 the three views × static + motion (fire-and-forget through __pf.run; poll __pf.res.capAll)
//   frame1() / cost(n)          serialized offscreen renders → per-pass ms + union (CLAUDE.md protocol)
(async () => {
  // (ports: this file is shared by lanes — window.__shPort overrides the shot sink; default = the serving port + 1)
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown'];   // render-pass stamps (drawable wait on Metal): out of every Σ / union
  // The three graded views. Pins are FollowCamera.pin (look, yaw, pitch, dist); `guards` stages men after the park.
  const VIEWS = {
    // V1 — the manager's desk under the desk lamp: hard contact shadows (keyboard, monitor foot), lit box edges (keyboard, papers, desk front), the lamp's pool
    v1: { pin: { look: [26.62, 0.5, 6.22], yaw: -20 * DEG, pitch: 60 * DEG, dist: 3.0 } },
    // V2 — a torch cone up the corridor's north wall and across its lino, seen along the corridor. A FIXED spot with the guards' torch numbers (7° / 19°, radius 0.07, held at hand height at the
    // cubicle opening, dipped) instead of a staged man's torch: his idle sway moves a held beam a few pixels between captures, and the cone edge is the thing measured
    v2: { pin: { look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, light: { pos: [23.5, 1.05, 11.8], dir: [-0.26, -0.30, -0.92], intensity: 70, innerDeg: 7, outerDeg: 19, radius: 0.07 } },
    // V3 — four cubicle desks under the ceiling panels: box edges lit vs shadowed, keyboards, partition tops, chair shadows
    v3: { pin: { look: [22.5, 0.4, 16.0], yaw: -20 * DEG, pitch: 55 * DEG, dist: 9.5 } },
  };
  let seeded = false;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** Pin the canvas's CSS box and the device pixel ratio to the reference pane (1280×720 CSS at dpr 2 → high = 1777×1000 out) whatever the tab's visibility: a BACKGROUND tab of the shared
   *  Browser pane lays the canvas out at 0×0 (engine.resize then renders 16×16), and this lane's tab has to stay in the background — other lanes' tabId-less navigations land on
   *  whichever tab is fronted. engine.resize reads exactly these three numbers; offscreen renders never touch the swap chain. */
  function pinViewport(cssW = 1280, cssH = 720, dpr = 2) {
    const cv = document.getElementById('view');
    Object.defineProperty(cv, 'clientWidth', { configurable: true, get: () => cssW });
    Object.defineProperty(cv, 'clientHeight', { configurable: true, get: () => cssH });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => dpr });
    return [cssW, cssH, dpr];
  }
  async function boot() {
    for (let i = 0; i < 300 && !(window.__engine && window.__runFrames && document.getElementById('view')); i++) await yieldTask();
    pinViewport();
    if (!window.__errs) { window.__errs = []; E().device.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
    window.__testVisible = true; window.__shotPort = window.__shPort ?? (parseInt(location.port, 10) + 1);
    seed(); window.__menu?.close();
    if (window.__weather) { try { window.__weather.setEnabled(false); } catch { /* */ } }   // rain off unless a take says otherwise (the storm's dice would otherwise schedule strokes into a capture)
    return { ok: true, res: [E().width, E().height, E().outWidth, E().outHeight], q: window.__quality?.current, taau: S().taau, restir: S().restir, dn: S().denoiser, froxel: S().froxelVol, rt: S().rtReflect, detail: S().detail, scale: S().renderScale, sharp: S().sharpDirect, hidden: document.hidden };
  }
  let fixed = null;   // the harness's own fixed spot (V2), added to the engine's light list once and switched per view
  function stage(view, yaw = null) {
    const v = VIEWS[view]; if (!v) throw new Error('views: ' + Object.keys(VIEWS).join(' '));
    const pin = { ...v.pin }; if (yaw !== null) pin.yaw = yaw;
    const r = window.__stage(pin, { park: true, guards: v.guards ?? [], player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
    if (!fixed) { const n = Math.hypot(1, 1, 1); fixed = E().lights.add({ name: 'sh_fixed', group: 'test', kind: 1, pos: [0, -10, 0], dir: [0, -1, 0], color: [1.0, 0.92, 0.78], intensity: 30, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 30 }); void n; }
    if (v.light) { const L = v.light; const d = Math.hypot(...L.dir); fixed.pos = [...L.pos]; fixed.dir = L.dir.map(x => x / d); fixed.intensity = fixed.peakIntensity = L.intensity; fixed.innerDeg = L.innerDeg; fixed.outerDeg = L.outerDeg; fixed.radius = L.radius; fixed.enabled = true; }
    else fixed.enabled = false;
    return r;
  }
  async function go(view, settle = 40) {
    window.__menu?.close(); seed();
    stage(view);
    __perf.still();
    await __perf.step(6);            // game steps: the pin is applied by the camera's update, the staged man settles into his pose
    __perf.still();                  // (phases zeroed again after the steps posed him)
    await __perf.render(settle);     // offscreen renders of the frozen state: every history converges on a still picture
    return `${view} staged, ${settle} settled at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  async function png(name) { const fr = await __perf.readback(); return __perf.png(name, fr); }   // (__perf.readback: the LAST offscreen render as RGBA — it swaps Metal's BGRA — nothing is re-rendered)
  async function capStatic(tag, view, settle = 40) { await go(view, settle); return png(`sh_${tag}_${view}_static`); }
  /** the in-motion case: after staging + settling, `n` game frames each turning the pinned camera by `ddeg`, the LAST landing exactly on the view's own yaw; the PNG is that last
   *  moving frame as rendered (scripted frames render offscreen on the hidden pane — nothing re-renders it still) */
  async function capMotion(tag, view, n = 20, ddeg = 0.3, settle = 24) {
    await go(view, settle);
    const v = VIEWS[view]; const yaw1 = v.pin.yaw;
    // settle at the START of the arc first (so the orbit begins from a converged picture of its own first view, not from the end view's history)
    stage(view, yaw1 - n * ddeg * DEG); await __perf.step(2); await __perf.render(settle);
    for (let i = 1; i <= n; i++) { stage(view, yaw1 - (n - i) * ddeg * DEG); await __perf.step(1); }
    if (!document.hidden) { /* a visible pane presented that frame: re-render it offscreen (one still frame on top — noted in the doc if it ever happens) */ E().render(window.__cam, __perf.time, 1 / 60, false); await __perf.settle(); }
    return png(`sh_${tag}_${view}_motion`);
  }
  async function capAll(tag, views = ['v1', 'v2', 'v3']) {
    const out = [];
    for (const v of views) { out.push(await capStatic(tag, v)); out.push(await capMotion(tag, v)); }
    out.push(JSON.stringify({ tag, res: [E().width, E().height, E().outWidth, E().outHeight], taau: S().taau, sharpen: S().taauSharpen, restir: S().restir, dn: S().denoiser, froxel: S().froxelVol, rt: S().rtReflect, detail: S().detail, scale: S().renderScale, sharp: S().sharpDirect ?? null, errs: (window.__errs || []).slice(0, 3) }));
    return out;
  }
  /** one serialized offscreen render → { passes, sum, union } */
  async function frame1() {
    const t = E().timer; const before = t.resolved; const w0 = performance.now();
    E().render(window.__cam, __perf.time, 1 / 60, false); __perf.time += 1 / 60;
    await E().device.queue.onSubmittedWorkDone(); const wall = performance.now() - w0; await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
    const passes = {}; let sum = 0;
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = +v.toFixed(3); if (!RP.includes(k)) sum += v; }
    return { passes, sum: +sum.toFixed(3), union: +(t.unionMs ? t.unionMs(RP) : sum).toFixed(3), wall: +wall.toFixed(3), stale: t.resolved === before };
  }
  const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const q95 = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(0.95 * b.length))] : NaN; };
  /** n serialized still renders after `warm` → per-pass medians + Σ + union (median, p95) */
  async function cost(n = 30, warm = 10, passes = ['gbuffer', 'gdown', 'direct', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'volFroxel', 'volumetrics', 'sharpU', 'compS', 'taau', 'bloom']) {
    const acc = { sum: [], union: [], wall: [], p: {} }; for (const k of passes) acc.p[k] = [];
    for (let i = 0; i < warm + n; i++) { const f = await frame1(); if (i < warm || f.stale) continue; acc.sum.push(f.sum); acc.union.push(f.union); acc.wall.push(f.wall); for (const k of passes) acc.p[k].push(f.passes[k] ?? 0); }
    return { n: acc.sum.length, sumMed: +med(acc.sum).toFixed(2), unionMed: +med(acc.union).toFixed(2), unionP95: +q95(acc.union).toFixed(2), wallMed: +med(acc.wall).toFixed(2), passes: Object.fromEntries(passes.map(k => [k, +med(acc.p[k]).toFixed(3)])), res: `${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}` };
  }
  /** interleaved A/B (ABBA) of cost(): apply functions may be async */
  async function costAB(applyA, applyB, opts = {}) {
    const { rounds = 4, n = 20, warm = 10 } = opts; const A = [], B = [];
    for (let r = 0; r < rounds; r++) for (const [tag, ap] of (r % 2 === 0 ? [['A', applyA], ['B', applyB]] : [['B', applyB], ['A', applyA]])) { await ap(); await __perf.render(4); (tag === 'A' ? A : B).push(await cost(n, warm)); }
    await applyA();
    const merge = rows => { const out = { unionMed: +med(rows.map(r => r.unionMed)).toFixed(2), unionP95: +med(rows.map(r => r.unionP95)).toFixed(2), sumMed: +med(rows.map(r => r.sumMed)).toFixed(2), wallMed: +med(rows.map(r => r.wallMed)).toFixed(2), passes: {} }; for (const k of Object.keys(rows[0].passes)) out.passes[k] = +med(rows.map(r => r.passes[k])).toFixed(3); out.res = rows[0].res; return out; };
    const a = merge(A), b = merge(B);
    return { A: a, B: b, dUnion: +(b.unionMed - a.unionMed).toFixed(2), dWall: +(b.wallMed - a.wallMed).toFixed(2), text: `A ∪ ${a.unionMed} (p95 ${a.unionP95}) Σ ${a.sumMed} wall ${a.wallMed} @${a.res} · B ∪ ${b.unionMed} (p95 ${b.unionP95}) Σ ${b.sumMed} wall ${b.wallMed} @${b.res} · Δ∪ ${(b.unionMed - a.unionMed).toFixed(2)} Δwall ${(b.wallMed - a.wallMed).toFixed(2)}` };
  }
  /** one serialized GAME frame (the stress minute's orbit step applied by the caller) → { passes, sum, union, wall } */
  async function gameFrame1(dt = 1 / 60) {
    const t = E().timer; const before = t.resolved; const w0 = performance.now();
    window.__runFrames(1, dt, []); await E().device.queue.onSubmittedWorkDone(); const wall = performance.now() - w0;
    await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) { if ((k & 15) === 15) await E().device.queue.onSubmittedWorkDone(); await yieldTask(); }
    const passes = {}; let sum = 0;
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = v; if (!RP.includes(k)) sum += v; }
    return { passes, sum, union: t.unionMs ? t.unionMs(RP) : sum, wall, stale: t.resolved === before };
  }
  /** THE STRESS MINUTE, interleaved: after `await __stress.setup({fight:false})` (tools/qa/stress-scene.js), `blocks` × (`per` frames under A, `per` under B) in ABBA order with the 0.6°/frame orbit
   *  running throughout → per variant: union / Σ compute mean · p50 · p95 · max, per-pass mean / p95, wall. */
  async function stressAB(applyA, applyB, opts = {}) {
    const { blocks = 4, per = 80, warm = 4, passes = ['direct', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'volFroxel', 'volumetrics', 'sharpU', 'compS', 'taau', 'smoke', 'particles'] } = opts;
    const ST = window.__stress; if (!ST) throw new Error('await import("/qa/stress-scene.js") + __stress.setup() first');
    const cam = window.__cam; if (!cam.pin) cam.pin = { look: [...ST.center], yaw: ST.yaw0, pitch: ST.pitch, dist: ST.dist };
    const pools = [{ union: [], sum: [], wall: [], p: {} }, { union: [], sum: [], wall: [], p: {} }];
    for (const P of pools) for (const k of passes) P.p[k] = [];
    for (let b = 0; b < blocks; b++) for (let vv = 0; vv < 2; vv++) {
      const v = (b & 1) ? 1 - vv : vv; await (v === 0 ? applyA : applyB)(); const P = pools[v];
      for (let i = 0; i < per + warm; i++) {
        cam.pin.yaw += ST.orbitDeg * DEG;
        const f = await gameFrame1();
        if (i < warm || f.stale) continue;
        P.union.push(f.union); P.sum.push(f.sum); P.wall.push(f.wall); for (const k of passes) P.p[k].push(f.passes[k] ?? 0);
      }
    }
    await applyA();
    const st = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
    const shape = P => ({ union: st(P.union), sum: st(P.sum), wall: st(P.wall), passes: Object.fromEntries(passes.map(k => [k, st(P.p[k])])) });
    const A = shape(pools[0]), B = shape(pools[1]);
    const line = (n, x) => `${n} ∪ ${x.union.mean}/${x.union.p50}/${x.union.p95}/${x.union.max} Σ ${x.sum.mean}/${x.sum.p95} wall ${x.wall.p50} · direct ${x.passes.direct?.mean} sharpU ${x.passes.sharpU?.mean} compS ${x.passes.compS?.mean} taau ${x.passes.taau?.mean}`;
    return { A, B, res: `${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`, lights: E().lights.activeCount, text: line('A', A) + '\n' + line('B', B) };
  }
  /** temporal sd of 8-bit luma over `frames` still renders in tile [x, y, w, h] (1777×1000 coords → output px) */
  async function sd(tile, frames = 30) {
    const fr0 = await __perf.readback(); const sx = fr0.w / 1777, sy = fr0.h / 1000;
    const x = Math.round(tile[0] * sx), y = Math.round(tile[1] * sy), w = Math.round(tile[2] * sx), h = Math.round(tile[3] * sy);
    const n = w * h; const s1 = new Float64Array(n), s2 = new Float64Array(n);
    for (let f = 0; f < frames; f++) {
      await __perf.render(1); const fr = await __perf.readback();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; const L = 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; const k = j * w + i; s1[k] += L; s2[k] += L * L; }
    }
    const sds = []; let meanL = 0;
    for (let k = 0; k < n; k++) { const m = s1[k] / frames; meanL += m; sds.push(Math.sqrt(Math.max(0, s2[k] / frames - m * m))); }
    sds.sort((a, b) => a - b);
    return { meanSd: +(sds.reduce((a, b) => a + b, 0) / n).toFixed(4), p99: +sds[Math.floor(0.99 * (n - 1))].toFixed(3), meanL: +(meanL / n).toFixed(2), tile: [x, y, w, h] };
  }
  /** the deterministic still's FNV hash (identity checks: same script on two builds) */
  async function identityHash(view = 'v3', frames = 40) {
    seed(); await go(view, 0);
    E().passes.grain = 0; window.__resetClock();
    window.__runFrames(frames, 1 / 60);
    await E().device.queue.onSubmittedWorkDone();
    E().render(window.__cam, 100, 1 / 60, false);
    const fr = await __perf.readback();
    return { hash: __perf.hash(fr), res: [fr.w, fr.h], scale: S().renderScale, sharp: S().sharpDirect ?? '(none)', taau: S().taau, q: window.__quality?.current };
  }
  window.__sh = { VIEWS, DEG, boot, pinViewport, stage, go, png, capStatic, capMotion, capAll, frame1, gameFrame1, cost, costAB, stressAB, sd, identityHash };
  return 'sharp harness ready: __sh.{boot,go,capStatic,capMotion,capAll,cost,costAB,sd,identityHash}';
})();
