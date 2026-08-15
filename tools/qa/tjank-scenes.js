// Temporal-jank bench (lane v3/temporal-jank): the four deterministic scenes behind the designer's 08-11 report — "the temporal reuse looks jank
// with the flickering light in the cubicle room, the lightning, and the flashlights … boiling due to the rain near the window" — measured per
// v3 system. Dev only: on a `?paused&quality=<p>&mute` boot with #view visible and this lane's shot sink up (window.__shotPort),
//     await import('/qa/tjank-scenes.js'); await __tj.boot(); r = await __tj.run('A', 'v3'); … or __tj.go('A') = every variant → __tj.res.A
// Scenes (each a fixed __stage pin, guards parked dark, phases zeroed, grain off, __resetClock before the scripted sequence so every variant sees the
// same frame indices / jitter / dice):
//   A  the flickering cubicles panel (panel_cubicles_11 over the tan cluster): its intensity DRIVEN by a recorded square pattern (the game's own 90 rad/s
//      dropout = ~2 frames at 15 %, ~2 at 100 %; or 'sq4' = 4 / 4) through offscreen renders — tile mean per frame vs the drive, per-level noise.
//   B  a lightning stroke of fixed bearing / elevation / peak through the south windows onto the cubicle floor: frames −3 … +14 (game steps).
//   C  a torch-like spot swept ±40° (and slid 1 m) over 60 frames across the tan cluster and the aisle floor, in the level's haze (game steps).
//   D  the rain by the south-west window band: the wet lot under street_lamp_s seen through the glass + the lamp's patch on the floor inside; 60
//      still frames (offscreen renders).
// Variants: v3 (defaults) · noRestir · legacyDn · noFroxel · noTaau (scale 1.0) · allOff (all four off, scale 1.0 = the pre-v3 chain) · taauOnly.
// Per tile per frame: mean luma; per pixel over the window: temporal sd, |Δ|, max−min (boil map), sd WITHIN each drive level (A); RMSE against a
// reference run of the same frames (allOff by default; every variant renders the same 1777×1000 output grid). Crops ×3 of chosen consecutive
// frames + the boil map are posted as tj_<scene>_<variant>_<tile>_f<k>.jpg / _boil.jpg.
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  // every scripted game step renders OFFSCREEN (main.ts presents the last frame of a burst only when the document is visible): one render per game
  // frame, read back as it was drawn — no second offscreen render doubling every history's frame count
  let fakeHidden = false;
  try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => fakeHidden }); } catch (e) { /* already defined by an earlier import */ }
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];

  const DEFAULTS = { restir: true, denoiser: 'v3', froxelVol: true, taau: true };
  const VARIANTS = {
    v3:       {},
    noRestir: { restir: false },
    legacyDn: { denoiser: 'legacy' },
    noFroxel: { froxelVol: false },
    noTaau:   { taau: false, scale1: true },
    taauOnly: { restir: false, denoiser: 'legacy', froxelVol: false },
    allOff:   { restir: false, denoiser: 'legacy', froxelVol: false, taau: false, scale1: true },
  };
  let scale0 = null;
  function applyVariant(name, extra = {}) {
    const v = { ...VARIANTS[name], ...extra }; if (!VARIANTS[name]) throw new Error('variants: ' + Object.keys(VARIANTS).join(' '));
    const s = S(); if (scale0 === null) scale0 = s.renderScale;
    s.restir = v.restir ?? DEFAULTS.restir; s.denoiser = v.denoiser ?? DEFAULTS.denoiser; s.froxelVol = v.froxelVol ?? DEFAULTS.froxelVol; s.taau = v.taau ?? DEFAULTS.taau;
    s.renderScale = v.scale1 ? 1.0 : scale0;
    for (const [k, val] of Object.entries(v.settings || {})) s[k] = val;
    return { name, restir: s.restir, denoiser: s.denoiser, froxelVol: s.froxelVol, taau: s.taau, renderScale: s.renderScale };
  }

  // ------------------------------------------------------------------ scenes
  const panel11 = () => G().targets.find(t => t.name === 'panel_cubicles_11');
  const drivePattern = (kind, k, level = 1) => {   // the panel's factor at scripted frame k
    if (kind === 'steady') return level;
    if (kind === 'sq4') return (Math.floor(k / 4) & 1) ? 0.15 : 1;                 // 4 frames full, 4 frames at 15 %
    if (kind === 'sq8') return (Math.floor(k / 8) & 1) ? 0.15 : 1;
    return Math.sin(90 * (k / 60) + 0.4) > 0 ? 0.15 : 1;                            // 'game': lighting.ts's dropout burst, sin(90 t) > 0 → 15 % (≈ 2 frames either way at 60 Hz)
  };
  function setPanel(f) {   // what lighting.ts updateTargets writes for factor f (renders only: no game step re-syncs it)
    const t = panel11(); const es = S().emissiveScale;
    for (const al of t.areaLights || []) { al.light.enabled = f > 0.001; al.light.intensity = al.light.peakIntensity = al.base * f * es; }
    for (const bi of t.boxes) { const b = E().world.statics[bi]; b.emissive = [t.baseEmissive[0] * f, t.baseEmissive[1] * f, t.baseEmissive[2] * f]; }
    t.factor = f;
  }
  let testTorch = null;
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const SCENES = {
    // A: the tan cluster under the flickering panel (16.5, 2.98, 20.6), from the north-east looking down-sun of it: desk tops, the spine partition's shadow on the carpet, chairs
    A: {
      mode: 'render', frames: 72, warm: 50,
      pin: [{ look: [16.6, 0, 20.4], yaw: 200 * DEG, pitch: 56 * DEG, dist: 9.5 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
      tiles: { desk: [[15.3, 0.76, 20.05], 300, 220], rugN: [[16.7, 0.02, 19.35], 300, 200], chairN: [[17.8, 0.25, 18.9], 280, 220], floorS: [[16.4, 0.02, 22.6], 300, 220], aisle: [[19.4, 0.02, 20.8], 260, 220] },
      setup() { panel11().fluorescentFlicker = false; setPanel(1); },
      drive(k, opts) { const f = drivePattern(opts.pattern || 'game', k, opts.level ?? 1); setPanel(f); return f; },
      teardown() { setPanel(1); panel11().fluorescentFlicker = true; },
      cropAt: [20, 21, 22, 23], boil: [16, 40],
    },
    // B: lightning through the south windows onto the cubicle floor by the glass — the stroke's mullion pattern, its arrival and decay
    B: {
      mode: 'step', frames: 22, warm: 50, strikeAt: 4,
      pin: [{ look: [17.2, 0, 21.6], yaw: 180 * DEG, pitch: 47 * DEG, dist: 12.5 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
      tiles: { floorGlass: [[16.2, 0.02, 23.05], 420, 120], desks: [[16.5, 0.76, 21.1], 340, 220], aisle: [[19.6, 0.02, 21.5], 260, 240], window: [[16.0, 1.5, 24.0], 300, 130] },
      setup() { panel11().fluorescentFlicker = false; const w = window.__weather; w.setEnabled(true); w.storm = 0; w.rainRate = 0; },
      drive(k, opts, sc) { const w = window.__weather; if (k === sc.strikeAt) { w.seed(opts.seedW ?? 4242); w.strike({ bearing: (opts.bearing ?? 180) * DEG, elevDeg: opts.elev ?? 38, distKm: 1.0, peak: opts.peak ?? 20 }); } return w.flash ? +w.flash.light.intensity.toFixed(3) : 0; },
      teardown() { const w = window.__weather; w.storm = 0.7; w.rainRate = 0.55; panel11().fluorescentFlicker = true; },
      cropAt: [4, 5, 6, 9], boil: [4, 16],
    },
    // C: a torch-like spot (the guards' hand-torch numbers) swept ±40° about −x while sliding 1 m along z over 60 frames, across the tan cluster and the aisle carpet, in the haze
    C: {
      mode: 'step', frames: 66, warm: 50,
      pin: [{ look: [17.4, 0, 19.6], yaw: 200 * DEG, pitch: 52 * DEG, dist: 10.5 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
      tiles: { beamFloor: [[17.6, 0.02, 18.4], 320, 220], cluster: [[16.3, 0.76, 20.1], 320, 220], haze: [[19.2, 0.9, 18.9], 260, 200], box: [[19.2, 0.02, 17.75], 300, 200] },
      setup() {
        panel11().fluorescentFlicker = false;
        if (!testTorch) testTorch = E().lights.add({ name: 'tjTorch', group: 'test', kind: 1, pos: [20.6, 1.15, 18.6], dir: norm([-1, -0.28, 0.15]), color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70, card: true });
        testTorch.enabled = true; SCENES.C.drive(0, {}, SCENES.C);
      },
      drive(k, opts, sc) { const u = Math.min(1, k / 60); const a = (opts.ampDeg ?? 40) * DEG * Math.sin(2 * Math.PI * u); const c = Math.cos(a), s = Math.sin(a); const b = [-1, -0.28, 0.15]; testTorch.dir = norm([b[0] * c - b[2] * s, b[1], b[0] * s + b[2] * c]); testTorch.pos = [20.6, 1.15, 18.1 + (opts.slide ?? 1.0) * u]; return +(a / DEG).toFixed(1); },   // (opts.ampDeg 0 + slide 0 = a static torch: the rig for still-noise numbers)
      teardown() { if (testTorch) testTorch.enabled = false; panel11().fluorescentFlicker = true; },
      cropAt: [14, 15, 16, 44], boil: [8, 20],
    },
    // D: the rain by the south-west window band — the lamp's patch on the carpet inside, the windows, the wet lot under street_lamp_s through them; nothing moves but the rain
    D: {
      mode: 'render', frames: 60, warm: 60,
      pin: [{ look: [17.2, 0, 21.6], yaw: 180 * DEG, pitch: 45 * DEG, dist: 12.5 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
      tiles: { floorGlass: [[16.2, 0.02, 23.05], 420, 120], window: [[16.0, 1.5, 24.0], 300, 130], desks: [[16.5, 0.76, 21.1], 300, 200] },
      setup(opts) { panel11().fluorescentFlicker = false; const w = window.__weather; w.setEnabled(true); w.storm = 0; w.rainRate = opts.rain ?? 0.55; },
      drive() { return 0; },
      teardown() { window.__weather.storm = 0.7; window.__weather.rainRate = 0.55; panel11().fluorescentFlicker = true; },
      cropAt: [30, 31, 32], boil: [24, 36],
    },
    // D2: the same rain from OUTSIDE — the follow camera south of the wall: interior floor by the glass at the top, the wall, the lot with its bollards below (the yaw-0 framing)
    D2: {
      mode: 'render', frames: 60, warm: 60,
      pin: [{ look: [18.5, 0, 22.5], yaw: 0, pitch: 50 * DEG, dist: 13 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
      tiles: { lot: [[17.0, 0.0, 26.4], 360, 150], floorIn: [[17.5, 0.02, 22.2], 340, 160], wall: [[18.8, 1.6, 24.05], 300, 110] },
      setup(opts) { panel11().fluorescentFlicker = false; const w = window.__weather; w.setEnabled(true); w.storm = 0; w.rainRate = opts.rain ?? 0.55; },
      drive() { return 0; },
      teardown() { window.__weather.storm = 0.7; window.__weather.rainRate = 0.55; panel11().fluorescentFlicker = true; },
      cropAt: [30, 31, 32], boil: [24, 36],
    },
  };

  // D3: the wet lot itself under the south street lamp (restir-bench's lotS framing, the F9 recordings' view): the sodium pool on the glossy asphalt, its edge, the cars' end of it
  SCENES.D3 = {
    mode: 'render', frames: 60, warm: 60,
    pin: [{ look: [17, 0, 30], yaw: 170 * DEG, pitch: 50 * DEG, dist: 16 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }],
    tiles: { pool: [[16.2, 0.0, 28.2], 340, 200], poolEdge: [[19.5, 0.0, 30.5], 320, 200], asphalt: [[13.0, 0.0, 33.0], 320, 200], facade: [[16.0, 1.4, 24.1], 340, 120] },
    setup(opts) { panel11().fluorescentFlicker = false; const w = window.__weather; w.setEnabled(true); w.storm = 0; w.rainRate = opts.rain ?? 0.55; },
    drive() { return 0; },
    teardown() { window.__weather.storm = 0.7; window.__weather.rainRate = 0.55; panel11().fluorescentFlicker = true; },
    cropAt: [30, 31, 32], boil: [24, 36],
  };
  // ------------------------------------------------------------------ capture plumbing
  async function oneFrame(mode, dt, time) {
    if (mode === 'render') { E().render(window.__cam, time, dt, false); }
    else { fakeHidden = true; try { window.__runFrames(1, dt, []); } finally { fakeHidden = false; } }
    await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
  }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) throw new Error('no offscreen frame'); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return { w: fr.w, h: fr.h, data: fr.data }; }
  /** tile rect in OUTPUT px round world point p, w×h given at 1000 output rows */
  function tileRect(p, w, h, fr) { const q = p.length === 2 ? [Math.round(p[0] * fr.h / 1000), Math.round(p[1] * fr.h / 1000)] : window.__perf.projectOut(p); if (!q) return null; /* (a 2-vector anchor = OUTPUT px at 1000 rows, for tiles placed off a crop rather than a world point) */ const k = fr.h / 1000; const tw = Math.round(w * k), th = Math.round(h * k); return { x: Math.max(0, Math.min(fr.w - tw, q[0] - (tw >> 1))), y: Math.max(0, Math.min(fr.h - th, q[1] - (th >> 1))), w: tw, h: th }; }
  function tileLumas(fr, r) { const out = new Float32Array(r.w * r.h); for (let j = 0; j < r.h; j++) { let o = ((r.y + j) * fr.w + r.x) * 4; for (let i = 0; i < r.w; i++, o += 4) out[j * r.w + i] = luma(fr.data, o); } return out; }
  async function postCanvas(name, c, q = 0.9) { const blob = await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q)); const port = Number(window.__shotPort) || 5174; try { const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return `${name}.jpg ${c.width}x${c.height} → ${r.status}`; } catch (e) { return `${name}: ${e}`; } }
  /** crop of readback fr at rect r, ×scale nearest */
  async function postCrop(name, fr, r, scale = 3) {
    const c = document.createElement('canvas'); c.width = r.w * scale; c.height = r.h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height);
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const so = ((r.y + Math.floor(j / scale)) * fr.w + (r.x + Math.floor(i / scale))) * 4, o = (j * c.width + i) * 4; img.data[o] = fr.data[so]; img.data[o + 1] = fr.data[so + 1]; img.data[o + 2] = fr.data[so + 2]; img.data[o + 3] = 255; }
    cx.putImageData(img, 0, 0); return postCanvas(name, c);
  }
  /** a scalar field (w×h, values 0‥255 after ×gain) as a grey ×scale image */
  async function postField(name, field, w, h, gain = 1, scale = 3) {
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height);
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const v = Math.max(0, Math.min(255, Math.round(field[Math.floor(j / scale) * w + Math.floor(i / scale)] * gain))); const o = (j * c.width + i) * 4; img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255; }
    cx.putImageData(img, 0, 0); return postCanvas(name, c);
  }
  const mean = a => { let s = 0; for (const v of a) s += v; return s / Math.max(1, a.length); };
  const box3 = (src, w, h) => { const out = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const y = j + dj, x = i + di; if (x < 0 || y < 0 || x >= w || y >= h) continue; s += src[y * w + x]; n++; } out[j * w + i] = s / n; } return out; };

  // ------------------------------------------------------------------ the run
  const T = {
    VARIANTS, SCENES, res: {}, refs: {},
    async boot() {
      for (let i = 0; i < 300 && !(window.__engine && window.__runFrames && document.getElementById('view')?.clientWidth > 0); i++) await yieldTask();
      if (!window.__errs) { window.__errs = []; E().device.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
      window.__testVisible = true; window.__menu?.close(); window.__pauseLoop = true;
      if (scale0 === null) scale0 = S().renderScale;
      return `tj ready ${E().width}x${E().height} → ${E().outWidth}x${E().outHeight} scale ${scale0} port ${window.__shotPort}`;
    },
    apply: applyVariant,
    /** after a preset hop: take the tier's own render scale as the variants' base (noTaau / allOff still pin 1.0) */
    rescale() { scale0 = S().renderScale; return scale0; },
    /** stage scene `sc` (pin, park, hygiene) and settle `warm` frames under the current variant */
    async stage(scName, opts = {}) {
      const sc = SCENES[scName]; if (!sc) throw new Error('scenes: ' + Object.keys(SCENES).join(' '));
      window.__menu?.close(); window.__stage(sc.pin[0], sc.pin[1]); window.__perf.still();
      sc.setup(opts);
      window.__runFrames(4, 1 / 60); await window.__perf.settle();   // (game steps: fixture / weather state reaches the frame)
      return sc;
    },
    /** ONE variant of ONE scene: stage, warm, resetClock(+seedOff), the scripted frames with per-frame drive → numbers (+ crops / boil map when opts.shots) */
    async run(scName, variant, opts = {}) {
      const { shots = true, seedOff = 0, dt = 1 / 60, tag = '', ref = 'allOff', keepFrames = false } = opts;
      const as = opts.as || variant;   // the result's key (a variant + extra settings under its own name)
      if (opts.extra?.settings) { T.saved = T.saved || {}; for (const k of Object.keys(opts.extra.settings)) if (!(k in T.saved)) T.saved[k] = S()[k]; }
      const vinfo = applyVariant(variant, opts.extra || {});
      const sc = await T.stage(scName, opts);
      const warm = opts.warm ?? sc.warm, frames = opts.frames ?? sc.frames;
      // warm under the drive's frame-0 state (renders or steps as the scene runs), then the clocks back to a known point so every variant draws the same jitter / dice sequence
      sc.drive(0, opts, sc);
      let time = 200;
      for (let i = 0; i < warm; i++) { await oneFrame(sc.mode, dt, time); time += dt; }
      // (__resetClock also snaps the follow camera to Sam: one game step puts the pin's view back before anything renders; then the counters to the run's seed)
      window.__resetClock(); fakeHidden = true; try { window.__runFrames(2, dt, []); } finally { fakeHidden = false; } await window.__perf.settle();
      E().frameIdx = seedOff; E().passes.resetClocks(); sc.drive(0, opts, sc); time = 300;
      for (let i = 0; i < 6; i++) { await oneFrame(sc.mode, dt, time); time += dt; }   // (a few frames past the reset: the first frame after it re-seeds TAAU's phase etc.)
      let fr0 = null; const rects = {}; const names = Object.keys(sc.tiles);
      const acc = {}; const drive = []; const perFrame = {}; const keep = {}; const ring = {};   // ring: the boil window's per-frame tile lumas
      const refKey = `${scName}:${ref}:${tag}`; const refFrames = T.refs[refKey]; const isRef = as === ref; const store = isRef ? [] : null;
      for (const n of names) { acc[n] = null; perFrame[n] = { mean: [], absDelta: [], hp: [], rmseRef: [] }; ring[n] = []; }
      let prev = {};
      for (let k = 0; k < frames; k++) {
        drive.push(sc.drive(k, opts, sc));
        if (opts.orbitDeg && window.__cam?.pin) { window.__cam.pin.yaw += opts.orbitDeg * DEG; if (sc.mode === 'render') window.__cam.update(dt, G().followPos(), null); }   // opts.orbitDeg: the pinned camera turns this much per frame through the run (the in-motion take; a render-mode scene applies the pin by hand)
        await oneFrame(sc.mode, dt, time); time += dt;
        const fr = await readback();
        if (!fr0) { fr0 = fr; for (const n of names) { const [p, w, h] = sc.tiles[n]; rects[n] = tileRect(p, w, h, fr); } }
        const frameStore = {};
        // opts.lin: a getter of linear rgba16f texture(s) at INTERNAL res (e.g. () => [P.dS[0], P.dS[1]]) → per tile per frame the mean luminance over the tile's footprint (summed over the list)
        let linTex = null; if (opts.lin) { linTex = []; for (const t of opts.lin()) linTex.push(await window.__perf.readTexture(t)); }
        for (const n of names) {
          const r = rects[n]; if (!r) continue;
          if (linTex) { const t0 = linTex[0]; const kx = t0.w / fr.w, ky = t0.h / fr.h; const x0 = Math.floor(r.x * kx), y0 = Math.floor(r.y * ky), w = Math.max(1, Math.floor(r.w * kx)), h = Math.max(1, Math.floor(r.h * ky)); let s = 0; for (const t of linTex) for (let j = 0; j < h; j++) { let o = ((y0 + j) * t.w + x0) * 4; for (let i = 0; i < w; i++, o += 4) s += 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; } (perFrame[n].lin = perFrame[n].lin || []).push(+(s / (w * h)).toExponential(4)); }
          const L = tileLumas(fr, r); const N = L.length;
          if (!acc[n]) acc[n] = { s1: new Float64Array(N), s2: new Float64Array(N), mn: new Float32Array(N).fill(1e9), mx: new Float32Array(N).fill(-1e9), byLevel: new Map(), n: 0 };
          const a = acc[n]; a.n++;
          let m = 0; for (let i = 0; i < N; i++) { const v = L[i]; a.s1[i] += v; a.s2[i] += v * v; m += v; } m /= N;
          perFrame[n].mean.push(+m.toFixed(3));
          if (k >= sc.boil[0] && k < sc.boil[1]) { for (let i = 0; i < N; i++) { const v = L[i]; if (v < a.mn[i]) a.mn[i] = v; if (v > a.mx[i]) a.mx[i] = v; } ring[n].push(L); }
          if (prev[n]) { let d = 0; const P = prev[n]; for (let i = 0; i < N; i++) d += Math.abs(L[i] - P[i]); perFrame[n].absDelta.push(+(d / N).toFixed(3)); }
          // spatial high-pass energy (pixel − 3×3 mean): speckle / grain per frame, whatever the history does
          { const b = box3(L, r.w, r.h); let s = 0; for (let i = 0; i < N; i++) { const d = L[i] - b[i]; s += d * d; } perFrame[n].hp.push(+Math.sqrt(s / N).toFixed(3)); }
          // per drive LEVEL (scene A): frames grouped by the panel factor, skipping the transition frame itself → sd within a level = noise, not flicker
          if (scName === 'A' && k > 0 && drive[k] === drive[k - 1]) { const key = String(drive[k]); let g = a.byLevel.get(key); if (!g) { g = { s1: new Float64Array(N), s2: new Float64Array(N), n: 0, means: [] }; a.byLevel.set(key, g); } g.n++; g.means.push(m); for (let i = 0; i < N; i++) { const v = L[i]; g.s1[i] += v; g.s2[i] += v * v; } }
          if (refFrames && refFrames[k] && refFrames[k][n]) { const R = refFrames[k][n]; let s = 0; for (let i = 0; i < N; i++) { const d = L[i] - R[i]; s += d * d; } perFrame[n].rmseRef.push(+Math.sqrt(s / N).toFixed(3)); }
          if (store) frameStore[n] = L;
          prev[n] = L;
        }
        if (store) store.push(frameStore);
        if (shots && sc.cropAt.includes(k)) keep[k] = fr;
        if (keepFrames) (T.lastFrames = T.lastFrames || {})[k] = fr;
      }
      if (store) T.refs[refKey] = store;
      // ---- reduce
      const out = { scene: scName, variant: as, base: variant, extra: opts.extra || null, ...vinfo, res: [E().width, E().height, E().outWidth, E().outHeight], frames, drive, tiles: {}, shots: [] };
      for (const n of names) {
        const a = acc[n]; if (!a) continue; const N = a.s1.length;
        let sd = 0, boil = 0, boilP95; const bm = new Float32Array(N);
        for (let i = 0; i < N; i++) { const m = a.s1[i] / a.n; sd += Math.sqrt(Math.max(0, a.s2[i] / a.n - m * m)); bm[i] = Math.max(0, a.mx[i] - a.mn[i]); boil += bm[i]; }
        const sorted = Float32Array.from(bm).sort(); boilP95 = sorted[Math.floor(0.95 * (N - 1))];
        const lv = {}; for (const [key, g] of a.byLevel) { let s = 0; for (let i = 0; i < N; i++) { const m = g.s1[i] / g.n; s += Math.sqrt(Math.max(0, g.s2[i] / g.n - m * m)); } lv[key] = { frames: g.n, sdWithin: +(s / N).toFixed(3), meanOfMeans: +mean(g.means).toFixed(2), sdOfMeans: +Math.sqrt(mean(g.means.map(x => (x - mean(g.means)) ** 2))).toFixed(3) }; }
        const pf = perFrame[n];
        out.tiles[n] = { rect: rects[n], sdAll: +(sd / N).toFixed(3), meanAbsDelta: +mean(pf.absDelta).toFixed(3), boilMean: +(boil / N).toFixed(2), boilP95: +boilP95.toFixed(2), hpMean: +mean(pf.hp).toFixed(3), byLevel: lv,
          rmseRefMean: pf.rmseRef.length ? +mean(pf.rmseRef).toFixed(3) : null, mean: pf.mean, absDelta: pf.absDelta, hp: pf.hp, rmseRef: pf.rmseRef, lin: pf.lin || null };
        if (shots) { out.shots.push(await postField(`tj_${scName}${tag}_${as}_${n}_boil`, bm, rects[n].w, rects[n].h, 4, 3)); }
      }
      if (shots) for (const k of Object.keys(keep)) for (const n of names) if (rects[n]) out.shots.push(await postCrop(`tj_${scName}${tag}_${as}_${n}_f${String(k).padStart(2, '0')}`, keep[k], rects[n], 3));
      sc.teardown();
      // extra settings back to what they were (applyVariant only knows the four switches + the scale)
      if (opts.extra?.settings && T.saved) for (const k of Object.keys(opts.extra.settings)) S()[k] = T.saved[k];
      applyVariant('v3');
      ((T.res[scName + tag] = T.res[scName + tag] || {}))[as] = out;
      return out;
    },
    /** every variant of a scene, reference first (fire-and-forget: poll __tj.res / __tj.busy) */
    go(scName, opts = {}) {
      const { variants = ['allOff', 'v3', 'noRestir', 'legacyDn', 'noFroxel', 'noTaau', 'taauOnly'] } = opts;
      T.busy = { scene: scName, at: 'start', done: [] }; T.err = null;
      (async () => { try { for (const v of variants) { const [as, base, extra] = Array.isArray(v) ? v : [v, v, null]; T.busy.at = as; await T.run(scName, base, { ...opts, as, extra: extra ? { settings: extra } : opts.extra }); T.busy.done.push(as); } T.busy.at = 'done'; } catch (e) { T.err = String(e?.stack || e); T.busy.at = 'error'; } })();
      return 'started ' + scName + ' × ' + variants.map(v => Array.isArray(v) ? v[0] : v).join(',');
    },
    /** the attribution table for a scene: one row per variant, per tile sd / |Δ| / boil / hp / rmse-vs-ref (+ per-level noise for A) */
    table(scName, tag = '') {
      const R = T.res[scName + tag]; if (!R) return 'no results for ' + scName + tag;
      const rows = [];
      for (const [v, out] of Object.entries(R)) {
        for (const [n, t] of Object.entries(out.tiles)) {
          const lv = Object.entries(t.byLevel || {}).map(([k, g]) => `L${k}: sdIn ${g.sdWithin} μ ${g.meanOfMeans}±${g.sdOfMeans}`).join(' · ');
          rows.push(`${v.padEnd(9)} ${n.padEnd(11)} sd ${String(t.sdAll).padEnd(6)} |Δ| ${String(t.meanAbsDelta).padEnd(6)} boil ${String(t.boilMean).padEnd(6)} p95 ${String(t.boilP95).padEnd(6)} hp ${String(t.hpMean).padEnd(6)} rmse ${String(t.rmseRefMean).padEnd(6)} ${lv}`);
        }
      }
      return rows.join('\n');
    },
    /** per-frame tile means of every variant of a scene beside the drive (the lag / pumping signature) */
    curves(scName, tile, tag = '') {
      const R = T.res[scName + tag]; if (!R) return null; const out = { drive: null };
      for (const [v, o] of Object.entries(R)) { out.drive = out.drive || o.drive; out[v] = o.tiles[tile]?.mean; }
      return out;
    },
    /** save __tj.res (numbers only) as docs/perf/<name>.json through the shot sink */
    async save(name) { const port = Number(window.__shotPort) || 5174; const slim = JSON.parse(JSON.stringify(T.res)); const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(slim), headers: { 'Content-Type': 'application/json' } }); return r.status; },
    setPanel, drivePattern, applyVariant, oneFrame, readback, tileRect, postCrop, postField,
  };
  window.__tj = T;
  return 'tj ready: __tj.{boot, run(scene, variant, opts), go(scene), table(scene), curves(scene, tile), save(name)} scenes ' + Object.keys(SCENES).join(' ');
})();
