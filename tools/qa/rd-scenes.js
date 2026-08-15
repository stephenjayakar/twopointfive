// Render-defects lane (docs/internal/render-defects-0812.md): deterministic stagings + crops + line profiles for the three 08-12 playtest defects —
// (1) the bright rim round Sam's silhouette, (2) screen-space banding in a lit smoke plume, (3) indirect light behind the storage shelves.
// Paste / import into a ?paused&quality=high&gatherStrata&mute boot once __ready resolved:  await import('/qa/rd-scenes.js')  →  window.__rd
//   __rd.stage('rim' | 'rimTorch' | 'smoke' | 'shelf')   stage the scene (seeded restart on first use, guards parked, phases zeroed, grain off)
//   __rd.run(n)                                          step n frames (serialized every 8)
//   __rd.frame(view)                                     render one offscreen frame in debug view `view` (0 final · 3 direct · 4 indirect · 1 albedo) → { w, h, data (RGBA) }
//   __rd.crop(name, fr, x, y, w, h, k)                   crop + ×k nearest upscale → docs/shots/<name>.jpg (+ ab/<name>.png with {png:true})
//   __rd.profile(fr, x0, y0, x1, y1, n)                  n luminance samples (0‥255 display) along a line
//   __rd.views(tag, crops, {views, k})                   capture views × crops in one call → names
// Everything posts to window.__shotPort (this lane: 5231).
(() => {
  const E = () => window.__engine, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  function seed(s0 = 4242) { Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SCENES = {
    // (1) Sam crouched in the sodium lamp's streak through the lobby's south windows, seen from the room side looking at the windows
    rim:      { pin: { look: [7.6, 0.35, 23.0], yaw: 180 * DEG, pitch: 55 * DEG, dist: 4.2 }, player: { pos: [7.6, 0, 23.0], yaw: Math.PI, crouch: true, holstered: true }, guards: [] },
    // (1b) the same man lit by a guard's torch from behind-left (legitimate rim LIGHT must survive the fix)
    rimTorch: { pin: { look: [20.0, 0.35, 17.4], yaw: -20 * DEG, pitch: 55 * DEG, dist: 4.2 }, player: { pos: [20.0, 0, 17.4], yaw: 2.4, crouch: true, holstered: true }, guards: [{ i: 0, pos: [18.3, 0, 18.9], yaw: 2.35, torch: true, aimPitch: -0.32 }] },
    // (2) a smoke canister in the cubicle aisle under the lit panels, follow-camera framing
    smoke:    { pin: { look: [20.0, 0.6, 15.6], yaw: -20 * DEG, pitch: 55 * DEG, dist: 9 }, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true }, guards: [], can: [20.0, 0, 15.6] },
    // (3) the storage room's shelving against its walls, indirect view
    shelf:    { pin: { look: [30.5, 0.5, 8.0], yaw: 90 * DEG, pitch: 55 * DEG, dist: 8 }, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true }, guards: [] },
  };
  let restarted = false;
  async function stage(name, over = {}) {
    const sc = { ...SCENES[name], ...over }; const g = G();
    if (window.__menu && window.__menu.mode !== 'closed') window.__menu.close();
    if (!restarted) { seed(4242); g.restartEncounter(); restarted = true; window.__runFrames(1, 1 / 60, []); await settle(); }
    window.__stage(sc.pin, { park: true, guards: sc.guards, player: sc.player });
    g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); for (const s of sc.guards) { const gd = g.guards[s.i]; if (gd) gd.lightDeadUntil = s.torch ? 0 : 1e9; }
    const A = window.__anim; if (A) { A.LIFE.on = 0; A.FEET.on = 0; } E().passes.grain = 0;
    for (const gd of g.guards) gd.char.anim.phase = 0; g.player.char.anim.phase = 0;
    if (sc.can) { window.__smoke.spawnCanister(sc.can); }
    for (let i = 0; i < 8; i++) { window.__runFrames(1, 1 / 60, []); await settle(); }
    window.__resetClock(); E().passes.grain = 0;
    window.__rdScene = name;
    return { name, pin: sc.pin, player: g.player.char.pos.slice() };
  }
  async function run(n = 40) { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60, []); if ((i & 7) === 7) await settle(); } await settle(); return n; }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) return null; if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return fr; }
  /** render ONE offscreen frame in debug view `view` without stepping the game (the same clock every call) → RGBA readback */
  async function frame(view = 0, opts = {}) {
    const S = E().settings; const was = S.debugView; S.debugView = view;
    if (opts.exposure !== undefined) { opts._exp = S.exposure; S.exposure = opts.exposure; }
    E().render(window.__cam, opts.time ?? 100, 1 / 60, false); await settle();
    const fr = await readback();
    S.debugView = was; if (opts._exp !== undefined) S.exposure = opts._exp;
    return fr;
  }
  async function post(name, canvas, png) {
    const blob = await new Promise(res => canvas.toBlob(b => res(b), png ? 'image/png' : 'image/jpeg', 0.95));
    const port = window.__shotPort || 5174;
    const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
    return r.status;
  }
  function toCanvas(fr, x, y, w, h, k) {
    const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const cx = c.getContext('2d');
    const img = cx.createImageData(w * k, h * k);
    for (let j = 0; j < h * k; j++) for (let i = 0; i < w * k; i++) {
      const sx = Math.min(fr.w - 1, x + Math.floor(i / k)), sy = Math.min(fr.h - 1, y + Math.floor(j / k));
      const s = (sy * fr.w + sx) * 4, d = (j * w * k + i) * 4;
      img.data[d] = fr.data[s]; img.data[d + 1] = fr.data[s + 1]; img.data[d + 2] = fr.data[s + 2]; img.data[d + 3] = 255;
    }
    cx.putImageData(img, 0, 0); return c;
  }
  async function crop(name, fr, x, y, w, h, k = 4, opts = {}) {
    const c = toCanvas(fr, x, y, w, h, k);
    const st = await post(name, c, false);
    let sp = null; if (opts.png) sp = await post(name, toCanvas(fr, x, y, w, h, 1), true);
    return { name, status: st, png: sp };
  }
  async function full(name, fr) { const c = toCanvas(fr, 0, 0, fr.w, fr.h, 1); return post(name, c, false); }
  const lum = (fr, x, y) => { const i = (Math.max(0, Math.min(fr.h - 1, Math.round(y))) * fr.w + Math.max(0, Math.min(fr.w - 1, Math.round(x)))) * 4; return 0.2126 * fr.data[i] + 0.7152 * fr.data[i + 1] + 0.0722 * fr.data[i + 2]; };
  function profile(fr, x0, y0, x1, y1, n = 0) {
    const len = Math.hypot(x1 - x0, y1 - y0); const m = n || Math.round(len) + 1; const out = [];
    for (let i = 0; i < m; i++) { const t = i / (m - 1); out.push(Math.round(lum(fr, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) * 10) / 10); }
    return out;
  }
  /** rim metric across a silhouette: walk the line, find the boundary (albedo mask from `mask` frame: dark = man), report the man-side edge peak vs the man's interior and the floor side */
  function rimMetric(fr, mask, x0, y0, x1, y1) {
    const m = Math.round(Math.hypot(x1 - x0, y1 - y0)) + 1; const L = [], M = [];
    for (let i = 0; i < m; i++) { const t = i / (m - 1); const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; L.push(lum(fr, x, y)); M.push(lum(mask, x, y) < 60 ? 1 : 0); }
    // boundary = first index where mask flips
    let b = -1; for (let i = 1; i < m; i++) if (M[i] !== M[i - 1]) { b = i; break; }
    if (b < 0) return { ok: false, L, M };
    const manFirst = M[0] === 1;   // line starts on the man
    const manIdx = [], floorIdx = [];
    for (let i = 0; i < m; i++) (M[i] ? manIdx : floorIdx).push(i);
    const edgeMan = manIdx.filter(i => Math.abs(i - b) <= 3).map(i => L[i]);      // the man's pixels within 3 px of the boundary
    const inMan = manIdx.filter(i => Math.abs(i - b) >= 6).map(i => L[i]);        // his interior
    const edgeFloor = floorIdx.filter(i => Math.abs(i - b) <= 3).map(i => L[i]);
    const inFloor = floorIdx.filter(i => Math.abs(i - b) >= 6).map(i => L[i]);
    const mx = a => a.length ? Math.max(...a) : NaN, av = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
    return { ok: true, b, manFirst, edgeManMax: mx(edgeMan), manMean: Math.round(av(inMan) * 10) / 10, edgeFloorMax: mx(edgeFloor), floorMean: Math.round(av(inFloor) * 10) / 10, L: L.map(v => Math.round(v)), M };
  }
  async function views(tag, crops, opts = {}) {
    const vs = opts.views ?? [0, 3, 4]; const k = opts.k ?? 4; const out = {};
    for (const v of vs) {
      const fr = await frame(v, opts);
      if (opts.full) out[`full${v}`] = await full(`${tag}_v${v}`, fr);
      for (const c of crops) out[`${c.name}_v${v}`] = (await crop(`${tag}_${c.name}_v${v}`, fr, c.x, c.y, c.w, c.h, k, opts)).status;
    }
    return out;
  }
  function project(p) { const v = document.getElementById('view'); const r = window.__cam.project(p, v.clientWidth, v.clientHeight); const fr = { w: E().outWidth || E().width, h: E().outHeight || E().height }; return [r[0] * fr.w / v.clientWidth, r[1] * fr.h / v.clientHeight, r[2]]; }
  window.__rd = { SCENES, seed, settle, stage, run, frame, readback, crop, full, profile, rimMetric, views, project, lum };
  return 'rd-scenes ready: __rd.stage(name) / run(n) / frame(view) / crop / profile / views';
})();
