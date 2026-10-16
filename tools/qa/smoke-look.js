// Smoke-look lane (docs/internal/smoke-look.md): the tour's Smoke stop restaged deterministically, a canister under the sodium lot lamps, offscreen
// captures + ×k crops + simple texture metrics, so today's build and older builds served beside can be compared frame for frame (ONE CONFIG PER FRESH BOOT:
// navigate `?paused&quality=high&mute`, then ONE of the stagings below, then capture — never two stagings in one page).
//   await import('/qa/smoke-look.js'); await __sk.boot();
//   await __sk.tour({ frames })                     the REAL tour stop 7 (seeded restart, __demo.start + goto(7)), stepped `frames` at 1/60
//   await __sk.door({ dist, yaw, dev, freeze })     the same doorway plume restaged under a PINNED camera (no puppet, no torches): canister at the sill, `dev` s of growth, frozen or live
//   await __sk.lot({ lamp: 'e'|'s', storm, dist, yaw, dev, freeze })   a canister under a sodium street lamp at night
//   await __sk.run(n)                                step n frames (serialized every 8)
//   await __sk.frame(view)                           one offscreen render in debug view `view` (0 final · 5 volumetrics only · 3 direct) → { w, h, data }
//   await __sk.crop(name, fr, x, y, w, h, k)         ×k nearest crop → the sink (window.__shotPort) as docs/shots/<name>.jpg
//   await __sk.full(name, fr) / __sk.hash(fr) / __sk.metrics(fr, x, y, w, h) / __sk.state()
(() => {
  const E = () => window.__engine, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  function seed(s0 = 4242) { Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const K = {
    doorLook: [29.0, 0.0, 17.8],          // the tour shot's final look-at (demo.ts stop 7)
    canDoor: [28.05, 0, 17.6],            // where the tour's can comes to rest: on the sill of breakroom_w (hinge (28, 17.02), 1.16 wide)
    lampE: [38.25, 5.05, 22.0], lampS: [16.0, 5.05, 26.45],   // the sodium heads (levels/office.json exterior spots, radius 0.18)
    canE: [37.2, 0, 22.0], canS: [16.0, 0, 25.4],              // a can on the asphalt under each (a metre in from the head, inside the cone's bright core)
  };
  let restarted = false;
  async function boot() {
    await window.__ready; if (window.__menu && window.__menu.mode !== 'closed') window.__menu.close();
    window.__testVisible = true; E().passes.grain = 0;
    window.__runFrames(1, 1 / 60, []); await settle();
    return state();
  }
  function state() {
    const S = E().settings, sm = window.__smoke, P = E().passes;
    return { commit: window.__skCommit ?? null, internal: [E().width, E().height], output: [E().outWidth, E().outHeight], scale: S.renderScale, maxH: S.maxInternalHeight, preset: window.__quality?.current ?? null,
      volQuarter: !!S.volQuarter, gatherThird: !!S.gatherThird, volDiv: P.volDiv ?? P.divVol ?? null, froxel: !!S.froxelVol, froxelTopRays: S.froxelTopRays, froxelGrid: window.__froxel?.grid ?? null,
      taau: !!S.taau, sharp: !!S.sharpDirect, sharpOn: !!E().sharpOn, decouple: !!S.sharpDecouple, gbaa: !!S.gbaa, taauMotionAlpha: S.taauMotionAlpha, taauAlpha: S.taauAlpha, motionCalm: S.restirSpatialAll && S.restirPenRays,
      volLightCap: S.volLightCap, volEvery: S.volShadowEvery, volStep: S.volStepVoxels, volSteps: S.volSteps, smokeShadowSteps: S.smokeShadowSteps,
      calm: sm?.params?.calmCells, frozen: !!sm?.params?.frozen, bricks: sm?.stats?.pool ?? 0, stepped: sm?.stats?.stepped ?? 0,
      frameIdx: E().frameIdx, time: G().time };
  }
  function parkAll(g) {
    g.guards.forEach((gd, i) => { gd.hold = true; gd.lightDeadUntil = 1e9; gd.char.anim.phase = 0; });
    g.player.char.anim.phase = 0;
    const A = window.__anim; if (A) { A.LIFE.on = 0; A.FEET.on = 0; }
  }
  /** the REAL tour stop: seeded restart, the tour started and jumped to stop 7, stepped `frames` (the can leaves his hand at ~1.6 s, the doorway is full by ~7 s, the shot cuts at 15 s) */
  async function tour(opts = {}) {
    const g = G(); const frames = opts.frames ?? 480;
    seed(opts.seed ?? 4242); g.restartEncounter(); restarted = true;
    for (const gd of g.guards) gd.char.anim.phase = 0; g.player.char.anim.phase = 0;
    E().passes.grain = 0;
    window.__demo.start(); window.__demo.goto(7);
    window.__resetClock(); E().passes.grain = 0;
    await run(frames);
    return { shotT: window.__demo.shotT, cam: camInfo(), ...brief() };
  }
  function camInfo() { const c = window.__cam; return { target: Array.from(c.target).map(v => +v.toFixed(2)), yaw: +(c.yaw / DEG).toFixed(1), pitch: +(c.pitch / DEG).toFixed(1), dist: +c.distance.toFixed(2) }; }
  function brief() { const s = state(); return { internal: s.internal, output: s.output, scale: s.scale, volQuarter: s.volQuarter, calm: s.calm, bricks: s.bricks, frameIdx: s.frameIdx }; }
  /** the doorway plume under a PINNED camera: no puppet, no torches, the two rooms' panels on, the leaf at the tour's 1.35 rad, a can on the sill, `dev` seconds of growth, then frozen (unless live) */
  async function door(opts = {}) {
    const g = G(); const dist = opts.dist ?? 15, yaw = opts.yaw ?? -15, pitch = opts.pitch ?? 55, dev = opts.dev ?? 7;
    if (!restarted) { seed(opts.seed ?? 4242); g.restartEncounter(); restarted = true; window.__runFrames(1, 1 / 60, []); await settle(); }
    const guards = opts.torches ? [{ i: 0, pos: [31.6, 0, 16.8], yaw: -Math.PI / 2, torch: true, aimPitch: opts.aimPitch ?? -0.12 }, { i: 1, pos: [33.2, 0, 18.9], yaw: -Math.PI / 2, torch: true, aimPitch: opts.aimPitch ?? -0.12 }] : [];   // the tour's two watchers inside the break room, torches into the doorway
    window.__stage({ look: opts.look ?? K.doorLook, yaw: yaw * DEG, pitch: pitch * DEG, dist }, { park: true, guards, player: { pos: [8, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
    parkAll(g); for (const s of guards) { const gd = g.guards[s.i]; if (gd) gd.lightDeadUntil = 0; }
    g.setGroup('breakroom', true); g.setGroup('cubicles', true);
    const dw = g.doors.byName('breakroom_w');
    if (dw) { dw.angle = 1.35; dw.vel = 0; dw.latched = false; dw.closing = false; }
    E().passes.grain = 0;
    window.__smoke.spawnCanister(opts.can ?? K.canDoor);
    window.__resetClock(); E().passes.grain = 0;
    await run(Math.round(dev * 60));
    if (opts.freeze !== false) { window.__smoke.params.frozen = true; await run(opts.settleFrames ?? 24); }
    return { door: !!dw, cam: camInfo(), ...brief() };
  }
  /** a can under a sodium street lamp at night: lamp 'e' (fire-exit side, (38.25, 5, 22)) or 's' (the south lot, (16, 5, 26.45)); storm 0 = dry & still, 1 = the storm as authored */
  async function lot(opts = {}) {
    const g = G(); const lamp = opts.lamp ?? 'e'; const dist = opts.dist ?? 15, yaw = opts.yaw ?? (lamp === 'e' ? 60 : -10), pitch = opts.pitch ?? 55, dev = opts.dev ?? 7;
    if (!restarted) { seed(opts.seed ?? 4242); g.restartEncounter(); restarted = true; window.__runFrames(1, 1 / 60, []); await settle(); }
    const can = opts.can ?? (lamp === 'e' ? K.canE : K.canS);
    window.__stage({ look: opts.look ?? [can[0], 0.3, can[2]], yaw: yaw * DEG, pitch: pitch * DEG, dist }, { park: true, guards: [], player: { pos: [8, 0, 12], yaw: 1.57, holstered: true, invisible: true } });
    parkAll(g);
    if (window.__weather) { const W = window.__weather; if (opts.storm) { W.enabled = true; W.seed?.(7); W.nextFlashAt = 1e9; } else { W.enabled = false; } }   // storm: the authored rain + wind + wet lot with the strokes held off (a flash across a capture is its own variable); dry: the weather system off
    E().passes.grain = 0;
    window.__smoke.spawnCanister(can);
    window.__resetClock(); E().passes.grain = 0;
    await run(Math.round(dev * 60));
    if (opts.freeze !== false) { window.__smoke.params.frozen = true; await run(opts.settleFrames ?? 24); }
    return { lamp, can, cam: camInfo(), ...brief() };
  }
  async function run(n = 40, keys = []) { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60, keys); if ((i & 7) === 7) await settle(); } await settle(); return n; }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) return null; if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return fr; }
  /** ONE offscreen render in debug view `view` without stepping the game → RGBA readback (note: it is a real render — histories, jitter phase and frameIdx advance by one) */
  async function frame(view = 0, opts = {}) {
    const S = E().settings; const was = S.debugView; S.debugView = view;
    if (opts.exposure !== undefined) { opts._exp = S.exposure; S.exposure = opts.exposure; }
    E().render(window.__cam, opts.time ?? G().time, 1 / 60, false); await settle();
    const fr = await readback();
    S.debugView = was; if (opts._exp !== undefined) S.exposure = opts._exp;
    return fr;
  }
  /** the LAST-BUT-ONE stepped frame read back as it was rendered IN MOTION (steps 2 game frames: __runFrames renders every frame of a burst but the last offscreen, so the
   *  offscreen target holds the first of the two — real history, real camera motion, no extra still render on top) */
  async function motionFrame(keys = []) { window.__runFrames(2, 1 / 60, keys); await settle(); return readback(); }
  /** ORBIT the pinned camera: n frames, yaw += dyawDeg and dist += ddist per frame (re-pinned verbatim each frame — no damping), then read back the last-but-one frame IN MOTION.
   *  The player / guards stay where the staging put them (only the pin moves). */
  async function orbitFrame(n = 30, dyawDeg = 0.4, ddist = 0, view = 0) {
    const c = window.__cam; const P = c.pin; if (!P) throw new Error('orbitFrame: stage a pinned view first');
    let yaw = P.yaw, dist = P.dist; const look = Array.from(P.look), pitch = P.pitch;
    const S = E().settings; const was = S.debugView; S.debugView = view;
    for (let i = 0; i < n; i++) { yaw += dyawDeg * DEG; dist += ddist; c.setPin({ look, yaw, pitch, dist }); window.__runFrames(1, 1 / 60, []); if ((i & 7) === 7) await settle(); }
    yaw += dyawDeg * DEG; dist += ddist; c.setPin({ look, yaw, pitch, dist }); window.__runFrames(2, 1 / 60, []); await settle();   // (both of the pair share one pin: the read-back frame moved relative to the one before it, held still relative to the presented one)
    const fr = await readback(); S.debugView = was; return fr;
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
  async function crop(name, fr, x, y, w, h, k = 3, opts = {}) { const c = toCanvas(fr, x, y, w, h, k); const st = await post(name, c, false); let sp = null; if (opts.png) sp = await post(name, toCanvas(fr, x, y, w, h, 1), true); return { name, status: st, png: sp }; }
  async function full(name, fr, png = false) { const c = toCanvas(fr, 0, 0, fr.w, fr.h, 1); return post(name, c, png); }
  /** crop with the tile's luminance range stretched to 0‥255 (banding in a bright smooth field hides in 8 bits at unit contrast) */
  async function cropStretch(name, fr, x, y, w, h, k = 3) {
    let lo = 255, hi = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = lumAt(fr, x + i, y + j); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const g = 255 / Math.max(1, hi - lo); const f2 = { w: w, h: h, data: new Uint8ClampedArray(w * h * 4) };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = ((y + j) * fr.w + (x + i)) * 4, d = (j * w + i) * 4; for (let c = 0; c < 3; c++) f2.data[d + c] = (fr.data[s + c] - lo) * g; f2.data[d + 3] = 255; }
    const c = toCanvas(f2, 0, 0, w, h, k); const st = await post(name, c, false); return { name, status: st, lo: +lo.toFixed(1), hi: +hi.toFixed(1) };
  }
  /** mean luminance of a w-wide column band down rows y0‥y1 at x (a vertical profile through a plume) */
  function colProfile(fr, x, y0, y1, w = 5) { const out = []; for (let y = y0; y <= y1; y++) { let s = 0; for (let i = 0; i < w; i++) s += lumAt(fr, x + i, y); out.push(+(s / w).toFixed(2)); } return out; }
  /** FNV-1a over the RGBA bytes (identity checks across builds / boots) */
  function hash(fr) { let h = 0x811c9dc5; const d = fr.data; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  const lumAt = (fr, x, y) => { const i = (Math.max(0, Math.min(fr.h - 1, y)) * fr.w + Math.max(0, Math.min(fr.w - 1, x))) * 4; return 0.2126 * fr.data[i] + 0.7152 * fr.data[i + 1] + 0.0722 * fr.data[i + 2]; };
  /** texture metrics over a rect (display luminance 0‥255): mean; hf1 = mean |L − 3×3 box mean| (pixel-scale grain); blk = mean |2×2-block mean − 6×6 box mean| (texel-scale
   *  blockiness: energy at the 2–3 px scale a half-res texel spans at the output); rowsd / colsd = sd of row / column means (banding shows as one far above the other);
   *  lag-k autocorrelation of the row-mean derivative for k = 2‥12 (a period p in the bands = a peak at k = p) */
  function metrics(fr, x, y, w, h) {
    const L = new Float32Array(w * h); let mean = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = lumAt(fr, x + i, y + j); L[j * w + i] = v; mean += v; }
    mean /= w * h;
    const box = (r) => { const o = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0, n = 0; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue; s += L[jj * w + ii]; n++; } o[j * w + i] = s / n; } return o; };
    const b1 = box(1), b3 = box(3);
    let hf1 = 0; for (let k = 0; k < w * h; k++) hf1 += Math.abs(L[k] - b1[k]); hf1 /= w * h;
    let blk = 0, nb = 0; for (let j = 0; j + 1 < h; j += 2) for (let i = 0; i + 1 < w; i += 2) { const m2 = (L[j * w + i] + L[j * w + i + 1] + L[(j + 1) * w + i] + L[(j + 1) * w + i + 1]) / 4; const c = (b3[j * w + i] + b3[j * w + i + 1] + b3[(j + 1) * w + i] + b3[(j + 1) * w + i + 1]) / 4; blk += Math.abs(m2 - c); nb++; } blk /= Math.max(1, nb);
    const rows = new Float32Array(h), cols = new Float32Array(w);
    for (let j = 0; j < h; j++) { let s = 0; for (let i = 0; i < w; i++) s += L[j * w + i]; rows[j] = s / w; }
    for (let i = 0; i < w; i++) { let s = 0; for (let j = 0; j < h; j++) s += L[j * w + i]; cols[i] = s / h; }
    const sd = a => { let m = 0; for (const v of a) m += v; m /= a.length; let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / a.length); };
    // detrended row means (minus a 9-row moving average) → the banding residual, then its autocorrelation
    const detr = new Float32Array(h); for (let j = 0; j < h; j++) { let s = 0, n = 0; for (let d = -4; d <= 4; d++) { const jj = j + d; if (jj < 0 || jj >= h) continue; s += rows[jj]; n++; } detr[j] = rows[j] - s / n; }
    const ac = {}; const v0 = detr.reduce((s, v) => s + v * v, 0) / h;
    for (let k = 2; k <= 12; k++) { let s = 0; for (let j = 0; j + k < h; j++) s += detr[j] * detr[j + k]; ac[k] = +(s / (h - k) / Math.max(v0, 1e-9)).toFixed(3); }
    const r = v => +v.toFixed(3);
    return { mean: r(mean), hf1: r(hf1), blk: r(blk), rowsd: r(sd(rows)), colsd: r(sd(cols)), bandsd: r(Math.sqrt(v0)), ac };
  }
  /** temporal sd of display luminance over n consecutive stepped frames inside a rect (a frozen plume under a still camera should converge; what is left is crawl) */
  async function temporal(view, x, y, w, h, n = 8) {
    const acc = new Float64Array(w * h), acc2 = new Float64Array(w * h);
    for (let f = 0; f < n; f++) { window.__runFrames(1, 1 / 60, []); await settle(); const fr = await frame(view); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = lumAt(fr, x + i, y + j); acc[j * w + i] += v; acc2[j * w + i] += v * v; } }
    let msd = 0; for (let k = 0; k < w * h; k++) { const m = acc[k] / n; msd += Math.sqrt(Math.max(0, acc2[k] / n - m * m)); }
    return +(msd / (w * h)).toFixed(3);
  }
  /** serialized still renders: n frames of engine.render + settle each, per-pass medians + union (ms) off engine.timer — the still camera and a frozen plume make every variant see the same work */
  const RENDER_PASSES = ['composite', 'post', 'fxaa', 'gbuffer', 'pdraw', 'present'];   // render-pass stamps span the drawable wait on Metal: out of the union, as the HUD has it
  async function take(n = 20, warm = 6) {
    const T = E().timer; const rows = [];
    for (let i = 0; i < warm + n; i++) {
      E().render(window.__cam, G().time, 1 / 60, false); await settle();
      if (i >= warm) { const t = {}; for (const [k, v] of (T.lastFrame ?? new Map())) t[k] = v; rows.push({ union: T.unionMs(RENDER_PASSES), ...t }); }
    }
    const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.floor(b.length / 2)].toFixed(3) : 0; };
    const keys = Object.keys(rows[0] ?? {}); const out = {}; for (const k of keys) out[k] = med(rows.map(r => +r[k] || 0));
    return out;
  }
  /** interleaved cost A/B: variants = { name: async apply() }, `rounds` × `n` frames each, round-robin; per variant the per-pass MIN over rounds of the round medians (the shared-GPU rule) + all rounds */
  async function costAB(variants, rounds = 4, n = 20) {
    const names = Object.keys(variants); const res = {}; for (const nm of names) res[nm] = [];
    for (let r = 0; r < rounds; r++) for (let k = 0; k < names.length; k++) { const nm = names[(k + r) % names.length]; await variants[nm](); await take(4, 4); res[nm].push(await take(n, 2)); }
    const summary = {};
    for (const nm of names) { const keys = Object.keys(res[nm][0] ?? {}); const o = {}; for (const k of keys) { const vals = res[nm].map(x => x[k]); o[k] = { min: Math.min(...vals), med: [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)], all: vals }; } summary[nm] = o; }
    return { summary, rounds: res };
  }
  /** GPU-error sweep: presets × froxel on/off × K 0/3/6 × smoke frozen/live × debug views 0/5/3, a few frames each, uncaptured errors collected (stage a plume first) */
  async function validate() {
    const errs = []; const h = e => errs.push(String(e.error && e.error.message).slice(0, 240)); E().device.addEventListener('uncapturederror', h);
    const S = E().settings, Q = window.__quality, sm = window.__smoke; const was = { preset: Q?.current, froxel: S.froxelVol, K: S.smokeMarchLights, view: S.debugView, frozen: sm.params.frozen };
    let n = 0;
    for (const preset of ['ultra', 'high', 'medium', 'low', 'verylow']) {
      Q.apply(preset); window.__runFrames(2, 1 / 60, []); await settle();
      for (const froxel of [true, false]) for (const K of [0, 3, 6]) for (const frozen of [true, false]) {
        S.froxelVol = froxel; S.smokeMarchLights = K; sm.params.frozen = frozen;
        for (const view of [0, 5, 3]) { S.debugView = view; window.__runFrames(2, 1 / 60, []); n += 2; }
        await settle();
      }
    }
    S.debugView = was.view; S.froxelVol = was.froxel; S.smokeMarchLights = was.K; sm.params.frozen = was.frozen; if (was.preset) Q.apply(was.preset);
    window.__runFrames(2, 1 / 60, []); await settle();
    E().device.removeEventListener('uncapturederror', h);
    return { frames: n, errors: errs.length, errs: errs.slice(0, 8) };
  }
  function project(p) { const v = document.getElementById('view'); const r = window.__cam.project(p, v.clientWidth, v.clientHeight); const W = E().outWidth || E().width, H = E().outHeight || E().height; return [Math.round(r[0] * W / v.clientWidth), Math.round(r[1] * H / v.clientHeight), r[2]]; }
  window.__sk = { K, seed, settle, boot, state, tour, door, lot, run, frame, motionFrame, readback, crop, full, hash, metrics, temporal, take, costAB, project, camInfo, lumAt, cropStretch, colProfile, orbitFrame, validate };
  return 'smoke-look ready: __sk.boot() then ONE of tour / door / lot, then frame / crop / metrics';
})();
