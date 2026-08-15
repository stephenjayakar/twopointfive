// Renderer v3 PHASE 5 (ultra-only: gather resampling, mesh closest-hit in reflections, 2-ray reflections + hit-lighting reuse) — the pane-side instrument.
// Dev only: `await import('/qa/p5-harness.js')` on a `?paused&quality=<preset>&mute` page (pulls in perf-harness.js + perf-frames.js + p4-harness.js) → window.__p5.
//   views / go(name)          the graded views, staged deterministically (guards parked dark unless the view stages them, Sam invisible unless staged, phases zeroed, grain off)
//   shot(name) / tiles(view)  whole frame + the ×3 crops of a view's tiles → this lane's shot sink (window.__shotPort)
//   costAB(applyA, applyB)    interleaved ABAB serialized per-pass medians (gather / temporal / reflect / rdenoise … + Σ compute + union) on the current view
//   sd(tile) / linSd(getTex, tile)   temporal sd of 8-bit luma (output frame) / of a linear texture's luminance (its own texels) over N still renders
//   means(tiles)              LDR tile means (bias checks) · linMean(getTex, tile) linear
//   lightsOff(tile, apply)    convergence after every light group goes off: frames to 50 / 10 / 2 %
//   walk(prefix, variants)    a man sliding across the lobby stone: crops at frames k (reflection ghost trail) per variant
//   sweep(prefix, variants)   a torch sweeping a wall: per-frame tile mean of the indirect-only view (GI lag) per variant
//   identityHash(view)        the deterministic still's FNV hash (OFF identity vs main)
//   validate()                GPU validation sweep over the P5 switches
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  window.__testVisible = true;
  window.__shotPort = window.__shotPort || 5187;   // this lane's capture sink (tools/shot-server.ts PORT=5187 in the p5 worktree)
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  // The graded views. tiles: [name, x, y, w, h] in OUTPUT pixels of a 1777×1000 frame (scaled to the actual output by tiles()/sd()).
  // guards: staged men (index, pos, yaw, torch) — absent = everybody parked dark; player: Sam's staging (absent = out of shot, invisible)
  const VIEWS = {
    // the P0–P4 still: cubicles from above (mostly carpet; walls + partitions top-left) — identity / whole-frame cost / the wall GI tile
    cubicles: { pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, tiles: [['wall', 40, 20, 300, 220], ['floor', 620, 620, 300, 220], ['desk', 760, 380, 320, 240]] },
    // storage room: shelving under the bulb, matte concrete floor, dim corners either side of the door — the corner-bias tile
    storage: { pin: { look: [31.3, 0, 7], yaw: 90 * DEG, pitch: 28 * DEG, dist: 4 }, tiles: [['cornerL', 60, 560, 300, 240], ['cornerR', 1400, 560, 300, 240], ['shelf', 1100, 40, 320, 240]] },
    // corridor looking west from x≈20 (lino either side of the runner, a lit panel overhead)
    corridor: { pin: { look: [15, 0, 11.1], yaw: 90 * DEG, pitch: 30 * DEG, dist: 6 }, tiles: [['linoL', 470, 380, 300, 240], ['wallN', 700, 120, 300, 200]] },
    // a torch on the corridor's north wall: guard 0 standing 0.8 m off it facing it, torch lit — floor GI under a hotspot (perf-harness scene s2's geometry)
    torch: { pin: { look: [27.4, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 8 }, guards: [{ i: 0, pos: [27.5, 0, 10.9], yaw: Math.PI, torch: true, aimPitch: -0.25 }], tiles: [['floorGI', 700, 430, 300, 220], ['wallGI', 760, 150, 300, 200]] },
    // break room NW corner: the two vending fronts standing on the lino — the reflection tiles of P4
    vending: { pin: { look: [29.5, 0, 15.5], yaw: 0 * DEG, pitch: 35 * DEG, dist: 6 }, tiles: [['contact', 520, 170, 300, 230], ['lobe', 560, 430, 300, 220]] },
    // lobby stone (x 4‥12, z 16‥24; the rug x < 7.9 avoided) looking NORTH from just inside the south wall, above the (invisible) ceiling, with FOUR men standing on the polish (the
    // shift's three + Sam), two torches lit — the mesh-reflection view: their mirror images lie on the stone between them and the camera. Tiles = the two guards' images, a moonlit strip.
    lobby4: { pin: { look: [9.4, 0, 21.4], yaw: 180 * DEG, pitch: 40 * DEG, dist: 6.8 }, lights: ['lobby'], guards: [{ i: 0, pos: [8.4, 0, 21.2], yaw: 3.14, torch: false }, { i: 1, pos: [10.6, 0, 21.8], yaw: -1.2, torch: false }, { i: 2, pos: [9.4, 0, 23.2], yaw: 3.14, torch: false }], player: { pos: [9.7, 0, 19.9], yaw: 0, holstered: true, invisible: false }, tiles: [['manA', 1050, 540, 250, 360], ['manB', 490, 430, 230, 340], ['manC', 800, 220, 190, 330], ['stone', 80, 585, 300, 210]] },   // lights: the lobby's two ceiling panels ON (authored off at night) so the men are lit from above and their images read; torches off (their lens glints in the polish sit exactly on the images). The tiles sit on each man's mirror image: his mid-body point mirrored under the floor, projected — __perf.projectOut([x, −0.9, z]); manTiles() recomputes them live
    // the east lot in the rain: wet asphalt under the sodium lamp (rain switched on by go())
    lot: { pin: { look: [38, 0, 23], yaw: 0 * DEG, pitch: 25 * DEG, dist: 7 }, rain: 0.6, tiles: [['streak', 760, 600, 300, 260], ['pole', 980, 260, 300, 240]] },
    // storage shelving close (brushed metal 0.28): rough-metal shimmer
    metal: { pin: { look: [31.3, 0, 7], yaw: 90 * DEG, pitch: 28 * DEG, dist: 4 }, tiles: [['shelf', 1100, 40, 320, 240], ['upright', 280, 200, 240, 300]] },
  };

  let seeded = false;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const P5H = { legacyStage: false };
  let rainWas = null; let litGroups = [];
  async function go(name, settle = 40, extra = {}) {
    const v = typeof name === 'string' ? VIEWS[name] : name; if (!v) throw new Error('no view ' + name);
    window.__menu?.close(); seed();
    const player = v.player ?? { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true };
    window.__stage(v.pin, { park: true, guards: v.guards ?? [], player, ...extra });
    if (!P5H.legacyStage) { const g = G(); g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); for (const s of v.guards ?? []) { const gd = g.guards[s.i]; if (gd) gd.lightDeadUntil = s.torch ? 0 : 1e9; } }   // a live man's torch is re-lit every frame by the carry rule (guards.ts attachFlashlight): 'torch: false' holds it dead the way a shot-out lens is, parked men likewise (legacyStage = the staging the pre-P5 identity baselines were hashed with: torches left to the carry rule)
    if (window.__weather) { if (v.rain) { window.__weather.setEnabled?.(true); window.__weather.rainRate = v.rain; rainWas = v.rain; } else if (rainWas !== null) { window.__weather.rainRate = 0; window.__weather.setEnabled?.(false); rainWas = null; } }
    for (const gr of litGroups) if (!(v.lights ?? []).includes(gr)) G().setGroup(gr, false);   // (a view's light groups switched on for it go back off when another view is staged)
    for (const gr of v.lights ?? []) G().setGroup(gr, true);
    litGroups = [...(v.lights ?? [])];
    __perf.still();
    await __perf.step(v.rain ? 30 : 4);   // (rain: the wet lot's gloss / darkening ramps with the game's wetness clock)
    await __perf.render(settle);
    return `${typeof name === 'string' ? name : 'view'} staged, ${settle} settled renders at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  /** the staged men's mirror-image tiles in OUTPUT pixels (feet → head mirrored under the floor, projected), for crops that must sit on the reflection whatever the framing: [{k, x, y, w, h}] */
  function manTiles(fr, count = 3, pad = 110) {
    const g = G(); const men = [...g.guards.slice(0, 3).map(x => x.char.pos), g.player.char.pos].slice(0, count); const out = [];
    men.forEach((p, k) => { const f = __perf.projectOut([p[0], 0, p[2]]), h = __perf.projectOut([p[0], -1.8, p[2]]); if (!f || !h) return; const x0 = Math.max(0, Math.min(f[0], h[0]) - pad), y0 = Math.max(0, Math.min(f[1], h[1]) - 10); out.push({ k, x: x0, y: y0, w: Math.min(fr.w - x0, 2 * pad), h: Math.min(fr.h - y0, Math.abs(h[1] - f[1]) + 40) }); });
    return out;
  }
  async function shot(name, q = 0.9) { return window.__shot(name, q); }
  const scaleTile = (fr, t) => { const sx = fr.w / 1777, sy = fr.h / 1000; return [Math.round(t[0] * sx), Math.round(t[1] * sy), Math.round(t[2] * sx), Math.round(t[3] * sy)]; };
  /** the view's tiles as ×k crops of the last readback: <prefix>_<tile>.jpg */
  async function tiles(view, prefix, k = 3) {
    const v = VIEWS[view]; const fr = await __perf.readback(); const out = [];
    for (const t of v.tiles) { const [x, y, w, h] = scaleTile(fr, t.slice(1)); out.push(await __perf.crop(`${prefix}_${t[0]}`, x, y, w, h, k, 0.92, fr)); }
    return out;
  }
  async function crop(name, x, y, w, h, k = 3) { const fr = await __perf.readback(); const [X, Y, W, H] = scaleTile(fr, [x, y, w, h]); return __perf.crop(name, X, Y, W, H, k, 0.92, fr); }
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
    const { rounds = 4, n = 20, warm = 12, passes = ['gather', 'temporal', 'reflect', 'rdenoise', 'direct', 'softblur', 'mesh', 'volumetrics', 'volFroxel', 'rc c0'] } = opts;
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
    return { A, B, dUnionMed: +(B.unionMed - A.unionMed).toFixed(2), dUnionP95: +(B.unionP95 - A.unionP95).toFixed(2), res: `${E().width}×${E().height}`, text: `A Σ ${A.sumMed} ∪ ${A.unionMed} (p95 ${A.unionP95}) gather ${A.gather} refl ${A.reflect} · B Σ ${B.sumMed} ∪ ${B.unionMed} (p95 ${B.unionP95}) gather ${B.gather} refl ${B.reflect} · Δ∪ ${(B.unionMed - A.unionMed).toFixed(2)}` };
  }
  /** temporal sd of 8-bit luma over `frames` still offscreen renders in tile [x, y, w, h] (1777×1000 coords → output px): mean per-pixel sd, p99, tile mean luma */
  async function sd(tile, frames = 30) {
    const fr0 = await __perf.readback(); const [x, y, w, h] = scaleTile(fr0, tile);
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
  /** temporal sd of a LINEAR texture's luminance (getTex() each render, e.g. () => passes.gi[0]) over the footprint of an OUTPUT tile (1777×1000 coords, mapped through the
   *  texture's own size ÷ the output's) → { relSd (% of tile mean), mean, texels } */
  async function linSd(getTex, tile, frames = 30) {
    const fr0 = await __perf.readback(); const [X, Y, W, H] = scaleTile(fr0, tile);
    const t0 = getTex(); const kx = t0.width / fr0.w, ky = t0.height / fr0.h;
    const x = Math.floor(X * kx), y = Math.floor(Y * ky), w = Math.max(1, Math.floor(W * kx)), h = Math.max(1, Math.floor(H * ky)); const n = w * h;
    const s1 = new Float64Array(n), s2 = new Float64Array(n);
    for (let f = 0; f < frames; f++) {
      await __perf.render(1);
      const t = await __perf.readTexture(getTex());
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * t.w + x + i) * 4; const L = 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; const k = j * w + i; s1[k] += L; s2[k] += L * L; }
    }
    let mean = 0, sdv = 0; for (let k = 0; k < n; k++) { const m = s1[k] / frames; mean += m; sdv += Math.sqrt(Math.max(0, s2[k] / frames - m * m)); }
    return { relSd: +((sdv / n) / Math.max(mean / n, 1e-12) * 100).toFixed(2), mean: +(mean / n).toExponential(4), texels: n, tile: [x, y, w, h] };
  }
  /** mean 8-bit luma of each tile of the last readback (converge first) */
  async function means(tileList) {
    const fr = await __perf.readback(); const out = {};
    for (const t of tileList) { const [x, y, w, h] = scaleTile(fr, t.slice(1)); let s = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } out[t[0]] = +(s / (w * h)).toFixed(3); }
    return out;
  }
  /** mean linear luminance of a texture over the footprint of an output tile, averaged over `frames` renders */
  async function linMean(getTex, tile, frames = 12) {
    const fr0 = await __perf.readback(); const [X, Y, W, H] = scaleTile(fr0, tile);
    const t0 = getTex(); const kx = t0.width / fr0.w, ky = t0.height / fr0.h;
    const x = Math.floor(X * kx), y = Math.floor(Y * ky), w = Math.max(1, Math.floor(W * kx)), h = Math.max(1, Math.floor(H * ky));
    let acc = 0;
    for (let f = 0; f < frames; f++) { await __perf.render(1); const t = await __perf.readTexture(getTex()); let s = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * t.w + x + i) * 4; s += 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; } acc += s / (w * h); }
    return { mean: +(acc / frames).toExponential(4), texels: w * h };
  }
  /** A vs B on the current view: settle each, then LDR sd + linear sd/mean of `getTex` on each tile → text rows */
  async function qualityAB(applyA, applyB, tileList, opts = {}) {
    const { frames = 30, settle = 60, getTex = () => E().passes.gi[0], names = ['A', 'B'] } = opts; const out = {};
    for (const [tag, apply] of [[names[0], applyA], [names[1], applyB]]) {
      await apply(); await __perf.render(settle);
      for (const t of tileList) { const tl = t.slice(1); out[`${t[0]}_${tag}`] = { ldr: await sd(tl, frames), lin: getTex ? await linSd(getTex, tl, frames) : null }; }
    }
    await applyA();
    out.text = tileList.map(t => { const a = out[`${t[0]}_${names[0]}`], b = out[`${t[0]}_${names[1]}`]; return `${t[0].padEnd(10)} ${names[0]}: ldr sd ${a.ldr.meanSd} (p99 ${a.ldr.p99}) mean ${a.ldr.meanL}${a.lin ? ` · lin sd ${a.lin.relSd} % mean ${a.lin.mean}` : ''}  |  ${names[1]}: ldr sd ${b.ldr.meanSd} (p99 ${b.ldr.p99}) mean ${b.ldr.meanL}${b.lin ? ` · lin sd ${b.lin.relSd} % mean ${b.lin.mean}` : ''}  (ldr ${(b.ldr.meanSd / Math.max(a.ldr.meanSd, 1e-6)).toFixed(2)}× · mean ${((b.ldr.meanL / Math.max(a.ldr.meanL, 1e-6) - 1) * 100).toFixed(1)} %${a.lin ? ` · lin mean ${((parseFloat(b.lin.mean) / Math.max(parseFloat(a.lin.mean), 1e-12) - 1) * 100).toFixed(1)} %` : ''})`; }).join('\n');
    return out;
  }
  /** CONVERGENCE after every switchable light group goes off at once under `apply`: per frame the mean luma of `tile` (1777×1000 coords) relative to frame 0's; frames to 50 / 10 / 2 %.
   *  opts.view: debug view to measure in (4 = indirect only). Restores the groups. */
  async function lightsOff(tile, apply, opts = {}) {
    const { frames = 48, settle = 60, view = 0 } = opts; const g = G(), s = S();
    await apply(); const dv0 = s.debugView; s.debugView = view;
    const groups = [...new Set(E().lights.lights.filter(l => l.group && l.group !== 'test' && l.kind !== 2).map(l => l.group))];
    for (const gr of groups) g.setGroup(gr, true);
    await __perf.step(settle);
    const fr0 = await __perf.readback(); const [x, y, w, h] = scaleTile(fr0, tile);
    const lum = fr => { let sum = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; sum += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } return sum / (w * h); };
    const seq = []; seq.push(lum(fr0));
    for (const gr of groups) g.setGroup(gr, false);
    for (let f = 0; f < frames; f++) { await __perf.step(1); seq.push(lum(await __perf.readback())); }
    const end = seq[seq.length - 1], start = seq[0];
    const rel = seq.map(v => (v - end) / Math.max(start - end, 1e-6));
    let to50 = -1, to10 = -1, to2 = -1; for (let i = 1; i < rel.length; i++) { if (to50 < 0 && rel[i] <= 0.5) to50 = i; if (to10 < 0 && rel[i] <= 0.1) to10 = i; if (to2 < 0 && rel[i] <= 0.02) to2 = i; }
    for (const gr of groups) g.setGroup(gr, true);
    await __perf.step(10); s.debugView = dv0;
    return { start: +start.toFixed(2), end: +end.toFixed(2), to50, to10, to2, rel: rel.slice(0, 30).map(v => +v.toFixed(3)) };
  }
  /** A man sliding across the lobby stone (guard 0, from p0 along +x at `speed` m/s), camera = the lobby4 pin, the other men parked: crops of a tile round him at frames `at` per variant
   *  (name → apply). The reflection's trailing edge is what to look at (+1 / +2 / +4 frames after he passes). */
  async function walk(prefix, variants, opts = {}) {
    const { frames = 20, at = [8, 9, 10, 12], speed = 1.6, p0 = [6.2, 0, 19.6], scale = 3, tileW = 360, tileH = 320, settle = 40, view = 0 } = opts;
    const g = G(); const out = {}; const s = S(); const dv0 = s.debugView;
    for (const [vname, apply] of Object.entries(variants)) {
      await apply(); s.debugView = view;
      window.__stage(VIEWS.lobby4.pin, { park: true, guards: [{ i: 0, pos: [...p0], yaw: Math.PI / 2, torch: false }], player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
      __perf.still(); await __perf.step(settle);
      const gd = g.guards[0];
      for (let f = 1; f <= frames; f++) {
        gd.char.pos = [p0[0] + speed * f / 60, 0, p0[2]];
        await __perf.step(1);
        if (at.includes(f)) {
          const fr = await __perf.readback(); const p = __perf.project([gd.char.pos[0], 0.5, gd.char.pos[2]]);
          const sx = fr.w / E().width, sy = fr.h / E().height;
          const cx = Math.round(p[0] * sx), cy = Math.round(p[1] * sy);
          const x = Math.max(0, Math.min(fr.w - tileW, cx - Math.round(tileW * 0.5))), y = Math.max(0, Math.min(fr.h - tileH, cy - Math.round(tileH * 0.3)));
          out[`f${f}_${vname}`] = await __perf.crop(`${prefix}_walk_f${f}_${vname}`, x, y, tileW, tileH, scale, 0.9, fr);
        }
      }
    }
    s.debugView = dv0;
    return out;
  }
  /** A torch sweeping the corridor's north wall (guard 0 at the torch view, his aim yaw swung `deg` over `frames`): per variant the mean luma of the wallGI / floorGI tiles per frame in
   *  debug view `view` (4 = indirect only) → the lag between variants shows as a shifted curve; crops at frames `at`. */
  async function sweep(prefix, variants, opts = {}) {
    const { frames = 24, deg = 60, at = [8, 16, 24], view = 4, settle = 60, scale = 3 } = opts;
    const g = G(), s = S(); const dv0 = s.debugView; const out = { curves: {} };
    const V = VIEWS.torch;
    for (const [vname, apply] of Object.entries(variants)) {
      await apply();
      window.__stage(V.pin, { park: true, guards: V.guards, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
      __perf.still(); await __perf.step(settle); s.debugView = view; await __perf.step(4);
      const gd = g.guards[0]; const yaw0 = Math.PI - deg * DEG / 2;
      const curveW = [], curveF = [];
      for (let f = 0; f <= frames; f++) {
        const yaw = yaw0 + deg * DEG * f / frames; gd.char.bodyYaw = yaw; gd.char.aimYaw = yaw;
        await __perf.step(1);
        const fr = await __perf.readback();
        const lum = (t) => { const [x, y, w, h] = scaleTile(fr, t); let sum = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; sum += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } return +(sum / (w * h)).toFixed(2); };
        curveW.push(lum(V.tiles[1].slice(1))); curveF.push(lum(V.tiles[0].slice(1)));
        if (at.includes(f)) { for (const t of V.tiles) { const [x, y, w, h] = scaleTile(fr, t.slice(1)); out[`f${f}_${t[0]}_${vname}`] = await __perf.crop(`${prefix}_sweep_f${f}_${t[0]}_${vname}`, x, y, w, h, scale, 0.9, fr); } }
      }
      out.curves[vname] = { wall: curveW, floor: curveF };
      s.debugView = dv0;
    }
    return out;
  }
  /** the deterministic still's hash (main with the same script = the identity reference) */
  async function identityHash(view = 'cubicles', frames = 40) {
    seed(); await go(view, 0);
    E().passes.grain = 0; window.__resetClock();
    window.__runFrames(frames, 1 / 60);
    await E().device.queue.onSubmittedWorkDone();
    E().render(window.__cam, 100, 1 / 60, false);
    const fr = await __perf.readback();
    const s = S();
    return { hash: __perf.hash(fr), res: [fr.w, fr.h], preset: window.__quality?.current, gi: s.giResample ?? '(main)', mesh: s.rtMeshHits ?? '(main)', reuse: s.rtHitReuse ?? '(main)', rt: s.rtReflect, taau: s.taau };
  }
  /** the P5 switches by name (missing on main: the appliers then do nothing, which is the point of an A/B against it) */
  const P5 = {
    off: () => { const s = S(); if ('giResample' in s) s.giResample = 'off'; if ('rtMeshHits' in s) s.rtMeshHits = false; if ('rtHitReuse' in s) s.rtHitReuse = false; },
    gi: (mode = 'temporal') => { const s = S(); if ('giResample' in s) s.giResample = mode; },
    mesh: (on = true) => { const s = S(); if ('rtMeshHits' in s) s.rtMeshHits = on; },
    reuse: (on = true) => { const s = S(); if ('rtHitReuse' in s) s.rtHitReuse = on; },
    all: () => { const s = S(); if ('giResample' in s) s.giResample = 'full'; if ('rtMeshHits' in s) s.rtMeshHits = true; if ('rtHitReuse' in s) s.rtHitReuse = true; },
    knobs: () => { const s = S(); return { giResample: s.giResample, giResampleRays: s.giResampleRays, giResampleCap: s.giResampleCap, giResampleTaps: s.giResampleTaps, rtMeshHits: s.rtMeshHits, rtHitReuse: s.rtHitReuse, rtRays: s.rtRays, meshShadows: s.meshShadows }; },
  };
  /** GPU validation sweep: an error scope + the uncaptured list across the P5 state changes on the current view */
  async function validate() {
    const dev = E().device; const errs = []; const onErr = e => errs.push('uncaptured: ' + e.error.message); dev.addEventListener('uncapturederror', onErr);
    dev.pushErrorScope('validation');
    const s = S(); const steps = [];
    const stepDo = async (label, fn) => { await fn(); await __perf.render(3); steps.push(label); };
    await stepDo('plain', () => {});
    if ('giResample' in s) { for (const m of ['off', 'temporal', 'full', 'off', 'full']) await stepDo('gi ' + m, () => { s.giResample = m; }); }
    if ('rtMeshHits' in s) { await stepDo('mesh on', () => { s.rtMeshHits = true; }); await stepDo('meshShadows off', () => { s.meshShadows = false; }); await stepDo('meshShadows on', () => { s.meshShadows = true; }); await stepDo('mesh off', () => { s.rtMeshHits = false; }); await stepDo('mesh on2', () => { s.rtMeshHits = true; }); }
    if ('rtHitReuse' in s) { await stepDo('reuse on', () => { s.rtHitReuse = true; }); await stepDo('rays1', () => { s.rtRays = 1; }); await stepDo('rays0', () => { s.rtRays = 0; }); await stepDo('rays2', () => { s.rtRays = 2; }); await stepDo('reuse off', () => { s.rtHitReuse = false; }); await stepDo('reuse on2', () => { s.rtHitReuse = true; }); }
    for (const dv of [1, 4, 10, 14, 16, 17, 0]) await stepDo('view' + dv, () => { s.debugView = dv; });
    await stepDo('rt off', () => { s.rtReflect = false; }); await stepDo('rt on', () => { s.rtReflect = true; });
    for (const d of [1, 3, 2]) await stepDo('div' + d, () => { s.rtReflectDiv = d; });
    await stepDo('gatherThird on', () => { s.gatherThird = true; }); await stepDo('gatherThird off', () => { s.gatherThird = false; });
    await stepDo('legacy dn', () => { s.denoiser = 'legacy'; }); await stepDo('v3 dn', () => { s.denoiser = 'v3'; });
    await stepDo('taau off', () => { s.taau = false; }); await stepDo('taau on', () => { s.taau = true; });
    await stepDo('scale .6', () => { s.renderScale = 0.6; }); await stepDo('scale 1', () => { s.renderScale = 1.0; });
    await stepDo('indirect off', () => { s.flags &= ~2; }); await stepDo('indirect on', () => { s.flags |= 2; });
    await stepDo('temporal off', () => { s.flags &= ~2048; }); await stepDo('temporal on', () => { s.flags |= 2048; });
    await stepDo('nv', () => { s.nvAmount = 1; }); await stepDo('nv off', () => { s.nvAmount = 0; });
    const scope = await dev.popErrorScope(); dev.removeEventListener('uncapturederror', onErr);
    return { steps: steps.length, scope: scope ? scope.message.slice(0, 600) : null, uncaptured: errs.slice(0, 4) };
  }
  /** every view: whole frame + its tiles under `prefix` */
  async function gradeSet(prefix, views = ['cubicles', 'storage', 'torch', 'vending', 'lobby4', 'lot'], settle = 40) {
    const out = [];
    for (const v of views) { await go(v, settle); out.push(await shot(`${prefix}_${v}`, 0.85)); out.push(...await tiles(v, `${prefix}_${v}`)); }
    return out;
  }
  window.__p5 = { VIEWS, go, shot, tiles, crop, manTiles, costAB, frame1, sd, linSd, means, linMean, qualityAB, lightsOff, walk, sweep, identityHash, validate, gradeSet, P5, DEG, flags: P5H };
  return 'p5 harness ready: __p5.{VIEWS,go,shot,tiles,crop,costAB,sd,linSd,means,linMean,qualityAB,lightsOff,walk,sweep,identityHash,validate,gradeSet,P5}';
})();
