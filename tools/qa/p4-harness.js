// Renderer v3 PHASE 4 (materials + RT reflections + the detail layer) — the pane-side instrument. Dev only: `await import('/qa/p4-harness.js')` on a
// `?paused&quality=<preset>&mute` page (pulls in perf-harness.js + perf-frames.js) → window.__p4.
//   views / go(name)      the graded views, staged deterministically (guards parked dark, Sam invisible, phases zeroed, grain off) and settled
//   shot(name) / tiles()  whole frame + the ×3 crops of a view's points of interest → this lane's shot sink (window.__shotPort)
//   costAB(view, applyA, applyB)   interleaved ABAB serialized per-pass medians (reflect / rdenoise / composite… + Σ compute + union)
//   sd(view, tile)        temporal sd of 8-bit luma over N still frames in a tile (reflection stability under TAAU)
//   identityHash()        the deterministic still's FNV hash (OFF identity vs main)
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  window.__testVisible = true;
  window.__shotPort = window.__shotPort || 5186;   // this lane's capture sink (tools/shot-server.ts PORT=5186 in the p4 worktree) — never the default :5174, which lands in the main checkout
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  // The graded views. tiles: [name, x, y, w, h] in OUTPUT pixels of a 1777×1000 frame (scaled to the actual output by tiles()).
  const VIEWS = {
    // break room NW corner: the two vending fronts (screenOff 0.08, emissive) standing on the lino (0.22) — soft rectangles hardening at the contact
    vending:  { pin: { look: [29.5, 0, 15.5], yaw: 0 * DEG, pitch: 35 * DEG, dist: 6 }, tiles: [['contact', 520, 170, 300, 230], ['lobe', 560, 430, 300, 220]] },
    // the corridor looking west from x≈20: lino strips either side of the runner, the lit panel at x 14 overhead, the tripwire, the extinguisher
    corridor: { pin: { look: [15, 0, 11.1], yaw: 90 * DEG, pitch: 30 * DEG, dist: 6 }, tiles: [['linoL', 470, 380, 300, 240], ['linoR', 1000, 420, 300, 240]] },
    // lobby stone (0.15) looking west at the frontage: moonlight through the mullions, the glazing's mirror image at right
    lobby:    { pin: { look: [7, 0, 20.5], yaw: 90 * DEG, pitch: 30 * DEG, dist: 5.5 }, tiles: [['stone', 1300, 320, 320, 240], ['moon', 250, 700, 320, 240]] },
    // the east lot in the rain: wet asphalt (0.22 anisotropic) under the sodium lamp — the maintainer's 'mirror disc' case
    lot:      { pin: { look: [38, 0, 23], yaw: 0 * DEG, pitch: 25 * DEG, dist: 7 }, tiles: [['streak', 760, 600, 300, 260], ['pole', 980, 260, 300, 240]] },
    // storage: brushed-steel shelving (metal 0.28) under the bulb, concrete floor (matte)
    storage:  { pin: { look: [31.3, 0, 7], yaw: 90 * DEG, pitch: 28 * DEG, dist: 4 }, tiles: [['shelf', 1100, 40, 320, 240], ['upright', 280, 200, 240, 300]] },
    // server room: anti-static tiles (0.35 — the medium cutoff), racks (0.3), the cold panel
    server:   { pin: { look: [18, 0, 6.5], yaw: 0 * DEG, pitch: 45 * DEG, dist: 4.5 }, tiles: [['floor', 700, 500, 320, 240]] },
    // the P0–P3 still (identity / whole-frame cost)
    cubicles: { pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, tiles: [['desk', 760, 380, 320, 240]] },
  };

  let seeded = false;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  async function go(name, settle = 40, extra = {}) {
    const v = typeof name === 'string' ? VIEWS[name] : name; if (!v) throw new Error('no view ' + name);
    window.__menu?.close(); seed();
    window.__stage(v.pin, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true }, ...extra });
    __perf.still();
    await __perf.step(4);
    await __perf.render(settle);
    return `${typeof name === 'string' ? name : 'view'} staged, ${settle} settled renders at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  async function shot(name, q = 0.9) { return window.__shot(name, q); }
  /** the view's tiles as ×k crops of the last readback: <prefix>_<tile>.jpg */
  async function tiles(view, prefix, k = 3) {
    const v = VIEWS[view]; const fr = await __perf.readback(); const sx = fr.w / 1777, sy = fr.h / 1000; const out = [];
    for (const [tn, x, y, w, h] of v.tiles) out.push(await __perf.crop(`${prefix}_${tn}`, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy), k, 0.92, fr));
    return out;
  }
  /** one named crop of the last readback in 1777×1000 coordinates */
  async function crop(name, x, y, w, h, k = 3) { const fr = await __perf.readback(); const sx = fr.w / 1777, sy = fr.h / 1000; return __perf.crop(name, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy), k, 0.92, fr); }
  const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const p95 = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(0.95 * b.length))] : NaN; };
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'];
  /** one serialized offscreen render → { passes, sum, union } */
  async function frame1() {
    const t = E().timer; const before = t.resolved;
    E().render(window.__cam, __perf.time, 1 / 60, false); __perf.time += 1 / 60;
    await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
    const passes = {}; let sum = 0;
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = v; if (!RP.includes(k)) sum += v; }
    const union = t.unionMs ? t.unionMs(RP) : sum;
    return { passes, sum, union };
  }
  /** interleaved A/B on the current view: rounds × (warm + n) serialized renders per variant; per-pass medians + Σ + union (median and p95) */
  async function costAB(applyA, applyB, opts = {}) {
    const { rounds = 4, n = 20, warm = 12, passes = ['reflect', 'rdenoise', 'gather', 'temporal', 'direct', 'softblur', 'volumetrics', 'volFroxel'] } = opts;
    const acc = { A: { sum: [], union: [], p: {} }, B: { sum: [], union: [], p: {} } };
    for (const k of passes) { acc.A.p[k] = []; acc.B.p[k] = []; }
    for (let r = 0; r < rounds; r++) {
      for (const [tag, apply] of (r % 2 === 0 ? [['A', applyA], ['B', applyB]] : [['B', applyB], ['A', applyA]])) {
        await apply(); await __perf.render(warm);
        for (let i = 0; i < n; i++) { const f = await frame1(); acc[tag].sum.push(f.sum); acc[tag].union.push(f.union); for (const k of passes) acc[tag].p[k].push(f.passes[k] ?? 0); }
      }
    }
    await applyA();
    const row = a => ({ sumMed: +med(a.sum).toFixed(2), sumP95: +p95(a.sum).toFixed(2), unionMed: +med(a.union).toFixed(2), unionP95: +p95(a.union).toFixed(2), ...Object.fromEntries(Object.entries(a.p).map(([k, v]) => [k, +med(v).toFixed(3)])) });
    const A = row(acc.A), B = row(acc.B);
    return { A, B, dUnionMed: +(B.unionMed - A.unionMed).toFixed(2), dUnionP95: +(B.unionP95 - A.unionP95).toFixed(2), res: `${E().width}×${E().height}`, text: `A Σ ${A.sumMed} ∪ ${A.unionMed} (p95 ${A.unionP95}) · B Σ ${B.sumMed} ∪ ${B.unionMed} (p95 ${B.unionP95}) · Δ∪ ${(B.unionMed - A.unionMed).toFixed(2)} · B reflect ${B.reflect} rdenoise ${B.rdenoise}` };
  }
  /** temporal sd of 8-bit luma over `frames` still offscreen renders in tile [x, y, w, h] (1777×1000 coords → output px): mean per-pixel sd, p99 */
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
  /** the deterministic still's hash (main with the same script = the identity reference) */
  async function identityHash(view = 'cubicles', frames = 40) {
    seed(); await go(view, 0);
    E().passes.grain = 0; window.__resetClock();
    window.__runFrames(frames, 1 / 60);
    await E().device.queue.onSubmittedWorkDone();
    E().render(window.__cam, 100, 1 / 60, false);
    const fr = await __perf.readback();
    return { hash: __perf.hash(fr), res: [fr.w, fr.h], rt: S().rtReflect ?? '(main)', detail: S().detail ?? '(main)', taau: S().taau };
  }
  /** GPU validation sweep: an error scope + the uncaptured list across a set of state changes on the current view */
  async function validate() {
    const dev = E().device; const errs = []; const onErr = e => errs.push('uncaptured: ' + e.error.message); dev.addEventListener('uncapturederror', onErr);
    dev.pushErrorScope('validation');
    const s = S(); const steps = [];
    const stepDo = async (label, fn) => { await fn(); await __perf.render(3); steps.push(label); };
    await stepDo('plain', () => {});
    for (const dv of [1, 2, 3, 4, 10, 13, 14, 0]) await stepDo('view' + dv, () => { s.debugView = dv; });
    await stepDo('rt off', () => { s.rtReflect = false; }); await stepDo('rt on', () => { s.rtReflect = true; });
    for (const d of [1, 3, 2]) await stepDo('div' + d, () => { s.rtReflectDiv = d; });
    for (const r of [0, 2, 1]) await stepDo('rays' + r, () => { s.rtRays = r; });
    await stepDo('gloss legacy', () => { s.rtReflect = false; s.gloss = true; }); await stepDo('rt back', () => { s.rtReflect = true; });
    await stepDo('detail0', () => { s.detail = 0; }); await stepDo('detail1', () => { s.detail = 1; }); await stepDo('detail.35', () => { s.detail = 0.35; });
    await stepDo('legacy dn', () => { s.denoiser = 'legacy'; }); await stepDo('v3 dn', () => { s.denoiser = 'v3'; });
    await stepDo('taau off', () => { s.taau = false; }); await stepDo('taau on', () => { s.taau = true; });
    await stepDo('scale .6', () => { s.renderScale = 0.6; }); await stepDo('scale 1', () => { s.renderScale = 1.0; });
    await stepDo('nv', () => { s.nvAmount = 1; }); await stepDo('nv off', () => { s.nvAmount = 0; });
    const scope = await dev.popErrorScope(); dev.removeEventListener('uncapturederror', onErr);
    return { steps: steps.length, scope: scope ? scope.message.slice(0, 600) : null, uncaptured: errs.slice(0, 4) };
  }
  /** every view: whole frame + its tiles under `prefix` (docs/shots/<prefix>_<view>[_<tile>].jpg) */
  async function gradeSet(prefix, views = ['vending', 'corridor', 'lobby', 'lot', 'storage', 'server'], settle = 40) {
    const out = [];
    for (const v of views) { await go(v, settle); out.push(await shot(`${prefix}_${v}`, 0.85)); out.push(...await tiles(v, `${prefix}_${v}`)); }
    return out;
  }
  window.__p4 = { VIEWS, go, shot, tiles, crop, costAB, frame1, sd, identityHash, validate, gradeSet, DEG };
  return 'p4 harness ready: __p4.{VIEWS,go,shot,tiles,crop,costAB,sd,identityHash,validate}';
})();
