// The MARKINGS lane's pane-side instrument (docs/review/legibility.html). Dev only: `await import('/qa/legibility-harness.js')` on a
// `?paused&quality=<preset>&mute` page (pulls in perf-harness.js) → window.__lg.
//   views                     the graded objects: follow-height framing (the game camera's own pitch 55° / distance 21 m / fov 28°) + a close showcase angle
//   go(view, 'follow'|'close')  stage deterministically (guards parked dark, Sam invisible, phases zeroed) and settle
//   shot(name) / crop(name, x, y, w, h, k)   whole frame / a ×k crop (coords in 1777×1000 output px) → this lane's shot sink (window.__shotPort, default 5189)
//   costAB(view, applyA, applyB, rounds, frames)   interleaved ABAB serialized medians: g-buffer stamp, direct, gather, reflect, Σ compute, union
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  window.__testVisible = true;
  window.__shotPort = window.__shotPort || 5189;
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const FOLLOW = { pitch: 55 * DEG, dist: 21 };   // camera.ts defaults: what the player sees
  // look = the object; follow = the game camera at its default height/distance looking at it (yaw chosen so no wall is in the way); close = a showcase angle
  const VIEWS = {   // (camera offset = dist·cos(pitch)·(sin yaw, cos yaw) in x/z: yaw 0 stands SOUTH of the object looking north, π/2 east of it looking west)
    keyboard:  { look: [26.5, 0.77, 6.35], followYaw: 0, close: { yaw: 0, pitch: 1.0, dist: 3.2 }, tile: [820, 430, 160, 120] },              // the manager's desk under the desk lamp
    cartons:   { look: [33.1, 0.3, 5.5], followYaw: 0, close: { yaw: 0.3, pitch: 0.75, dist: 4 }, tile: [780, 380, 260, 200] },              // storage floor cartons under the bulb
    cartonsCub:{ look: [12.6, 0.3, 13.7], followYaw: 0.5, close: { yaw: 0.6, pitch: 0.7, dist: 4 }, tile: [800, 400, 240, 200] },         // cubicle cartons against the west partition
    vending:   { look: [29.1, 1.0, 13.4], followYaw: 0, close: { yaw: 0.15, pitch: 0.45, dist: 5 }, tile: [760, 330, 300, 260] },          // both machines, front (they face south)
    vendingRefl:{ look: [29.1, 0.0, 14.6], followYaw: 0, close: { yaw: 0.1, pitch: 0.5, dist: 5.5 }, tile: [760, 420, 320, 240] },       // their image in the lino
    monitorRefl:{ look: [26.5, 0.95, 6.05], followYaw: 0, close: { yaw: 0.0, pitch: 0.72, dist: 2.6 }, tile: [655, 350, 470, 230] },     // the manager's dark screen mirroring his desk: the keyboard in the glass (reflections follow-up)
    stoneDay:  { look: [8.6, 0.35, 19.2], followYaw: 0, close: { yaw: 3.1416, pitch: 0.38, dist: 4.2 }, tile: [980, 620, 440, 200] },     // cartons stood on the sunlit lobby stone (stageStoneDay() first: the level's daylight, three cartons moved in)
    cabinets:  { look: [24.85, 0.7, 12.75], followYaw: 0, close: { yaw: 0.15, pitch: 0.6, dist: 3.5 }, tile: [820, 400, 200, 200] },      // the two filing cabinets against the corridor partition (drawers face south)
    papers:    { look: [15.4, 0.78, 14.5], followYaw: 0, close: { yaw: 0.3, pitch: 1.0, dist: 2.6 }, tile: [830, 440, 150, 120] },
    whiteboard:{ look: [9.0, 1.4, 4.4], followYaw: 0, close: { yaw: 0, pitch: 0.35, dist: 4.5 }, tile: [640, 330, 500, 200] },            // conference whiteboard (faces south)
    door:      { look: [17.6, 1.0, 10.05], followYaw: 0, close: { yaw: 0.15, pitch: 0.75, dist: 2.6 }, tile: [810, 360, 200, 260] },      // the server-room door, corridor face
    extinguisher:{ look: [16.42, 1.05, 10.15], followYaw: 0, close: { yaw: 0, pitch: 0.6, dist: 2.2 }, tile: [865, 410, 70, 130] },
    racks:     { look: [17.0, 1.0, 6.9], followYaw: 0, close: { yaw: 0.2, pitch: 0.55, dist: 2.8 }, tile: [700, 320, 380, 300] },          // the west bank's LED faces
    binders:   { look: [18.3, 0.9, 20.2], followYaw: 0, close: { yaw: 0.4, pitch: 0.8, dist: 2.8 }, tile: [850, 430, 140, 130] },
    lobbySign: { look: [10.4, 1.5, 12.4], followYaw: 0, close: { yaw: 0.1, pitch: 0.35, dist: 4.5 }, tile: [760, 360, 300, 200] },       // the sign panel + placards
    breakEast: { look: [35.2, 1.1, 15.0], followYaw: -Math.PI / 2, close: { yaw: -1.35, pitch: 0.5, dist: 4.5 }, tile: [700, 330, 420, 300] },   // the kitchen wall: microwave, coffee machine, cupboards, sink (they face west → stand west of them: yaw −π/2)
  };

  let seeded = false;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  async function go(name, mode = 'follow', settle = 36, extra = {}) {
    const v = VIEWS[name]; if (!v) throw new Error('no view ' + name);
    window.__menu?.close(); seed();
    const pin = mode === 'follow' ? { look: v.look, yaw: v.followYaw, pitch: FOLLOW.pitch, dist: FOLLOW.dist } : { look: v.look, ...v.close };
    window.__stage(pin, { park: true, player: { pos: [6, 0, 22], yaw: 1.57, holstered: true, invisible: true }, ...extra });
    for (const gd of G().guards) gd.char.anim.phase = 0; G().player.char.anim.phase = 0;
    __perf.still();
    await __perf.step(4);
    await __perf.render(settle);
    return `${name}/${mode} at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  async function shot(name, q = 0.9) { return window.__shot(name, q); }
  async function crop(name, x, y, w, h, k = 3, fr) { fr = fr || await __perf.readback(); const sx = fr.w / 1777, sy = fr.h / 1000; return __perf.crop(name, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy), k, 0.92, fr); }
  /** the view's tile at ×1 and ×3 (follow) or ×2 (close): <prefix>_x1 / _x3 */
  async function tiles(view, prefix, mode = 'follow') {
    const v = VIEWS[view]; const fr = await __perf.readback(); const [x, y, w, h] = v.tile;
    if (mode === 'follow') { await crop(`${prefix}_x1`, x - w, y - h, w * 3, h * 3, 1, fr); return crop(`${prefix}_x3`, x, y, w, h, 3, fr); }
    return crop(`${prefix}_x2`, Math.max(0, x - w / 2), Math.max(0, y - h / 2), Math.min(1777 - x + w / 2, w * 2), Math.min(1000 - y + h / 2, h * 2), 2, fr);
  }
  const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const p95 = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(0.95 * b.length))] : NaN; };
  const RP = ['composite', 'post', 'fxaa', 'pdraw'];
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  /** one serialized offscreen render → { passes (raw ms per pass of that frame, gbuffer included: offscreen its stamp is honest), sum of compute passes, union } */
  async function frame1() {
    const t = E().timer; const before = t.resolved;
    E().render(window.__cam, __perf.time, 1 / 60, false); __perf.time += 1 / 60;
    await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
    const passes = {}; let sum = 0;
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = v; if (!RP.includes(k) && k !== 'gbuffer') sum += v; }
    const union = t.unionMs ? t.unionMs(RP) : sum;
    return { passes, sum, union };
  }
  /** interleaved ABAB: apply → settle → N serialized frames each; medians per pass */
  async function costAB(applyA, applyB, rounds = 3, frames = 20, settle = 8) {
    const acc = { A: [], B: [] };
    for (let r = 0; r < rounds; r++) for (const [tag, apply] of [['A', applyA], ['B', applyB]]) { apply(); await __perf.render(settle); for (let i = 0; i < frames; i++) acc[tag].push(await frame1()); }
    const summarise = (arr) => { const keys = new Set(); arr.forEach(f => Object.keys(f.passes).forEach(k => keys.add(k))); const out = {}; for (const k of keys) { const xs = arr.map(f => f.passes[k]).filter(x => x !== undefined); out[k] = { med: +med(xs).toFixed(3), p95: +p95(xs).toFixed(3) }; } out.sum = { med: +med(arr.map(f => f.sum)).toFixed(3), p95: +p95(arr.map(f => f.sum)).toFixed(3) }; out.union = { med: +med(arr.map(f => f.union)).toFixed(3), p95: +p95(arr.map(f => f.union)).toFixed(3) }; return out; };
    return { A: summarise(acc.A), B: summarise(acc.B), n: acc.A.length };
  }
  /** the lobby by DAY with three cartons on the stone (reflections follow-up, view 'stoneDay'): the level's daylight variant swapped in
   *  (__daylight — the removed day showcase used to be started and frozen for this; __daylight(false) puts the night back), the first three cardboard props moved onto the stone. Idempotent. */
  async function stageStoneDay() {
    if (!window.__daylight()) { window.__daylight(true); await __perf.render(4); }
    window.__game.props.props.filter(p => p.def.kind === 'cardboard').slice(0, 3).forEach((p, i) => { p.x = 8.0 + i * 0.85; p.z = 19.4 - i * 0.35; p.yaw = 0.3 + i * 0.9; p.dirty = true; p.asleep = true; });
    await __perf.render(4);
  }
  /** ×k crop of the last readback in OUTPUT pixels (not the 1777 grid): <name>.jpg */
  async function cropPx(name, x, y, w, h, k = 3, fr) { fr = fr || await __perf.readback(); return __perf.crop(name, x, y, w, h, k, 0.92, fr); }
  /** temporal sd of 8-bit luma over `frames` still renders in the output-pixel tile [x, y, w, h]: mean per-pixel sd, p99, mean luma */
  async function sd(tile, frames = 24) {
    const [x, y, w, h] = tile; const n = w * h; const s1 = new Float64Array(n), s2 = new Float64Array(n);
    for (let f = 0; f < frames; f++) {
      await __perf.render(1); const fr = await __perf.readback();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; const L = 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; const q = j * w + i; s1[q] += L; s2[q] += L * L; }
    }
    const sds = []; let meanL = 0;
    for (let q = 0; q < n; q++) { const m = s1[q] / frames; meanL += m; sds.push(Math.sqrt(Math.max(0, s2[q] / frames - m * m))); }
    sds.sort((a, b) => a - b);
    return { meanSd: +(sds.reduce((a, b) => a + b, 0) / n).toFixed(4), p99: +sds[Math.floor(0.99 * (n - 1))].toFixed(3), meanL: +(meanL / n).toFixed(2) };
  }
  /** n serialized frames on the current view after `warm`: per-pass medians + the union's median / p95 */
  async function record(n = 40, warm = 10) {
    await __perf.render(warm); const fs = []; for (let i = 0; i < n; i++) fs.push(await frame1());
    const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; }; const p95 = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.95))] : 0; };
    const keys = new Set(); fs.forEach(f => Object.keys(f.passes).forEach(k => keys.add(k)));
    const passes = {}; for (const k of keys) passes[k] = +med(fs.map(f => f.passes[k] ?? 0)).toFixed(3);
    return { n, res: `${E().width}×${E().height}`, unionMed: +med(fs.map(f => f.union)).toFixed(3), unionP95: +p95(fs.map(f => f.union)).toFixed(3), sumMed: +med(fs.map(f => f.sum)).toFixed(3), passes };
  }
  window.__lg = { VIEWS, FOLLOW, go, shot, crop, cropPx, tiles, costAB, frame1, stageStoneDay, sd, record };
  console.log('__lg ready: views ' + Object.keys(VIEWS).join(' '));
})();
