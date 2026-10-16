// GI-IN-MOTION lane (docs/internal/gi-motion.md): the pane-side instrument that reproduces the two shots of the maintainer's 08-10 recording — 'still a bit too much
// noise in motion', analysed frame by frame as the INDIRECT term re-converging under camera / actor motion — and puts numbers on it. Dev only:
//   `await import('/qa/gi-motion.js'); await __gim.boot()` on a `?paused&quality=<tier>&mute` boot of THIS lane's server (it pulls in perf-harness / perf-frames / sharp-harness).
//
//   S1 'window-lit cubicles pan'  night: Sam walks east at his walking pace (the real player under the puppet, 1.55 m/s) across the striped light patch the south window band
//                                 (x 14–18) throws on the cubicle floor — the street lamp's warm pool + the moon, cut by the mullions' diagonal shadows — with the FOLLOW camera
//                                 (released pin: damping 4, aim lead, yaw 160°, pitch 55°, dist 21 = the gameplay framing that shows the patch, the stripes, the desks and the
//                                 unlit floor under the sill) panning after him. Static-in-world floor tiles: inside a dark stripe, the unlit floor by the wall, the unlit aisle.
//   S2 'daylight stack'           `__breach.start()` stepped deterministically to the STACK shot (breach.ts shot 2: pinned low by the break room's west door) while Blue One walks
//                                 the last metres along the wall — the wall behind him is lit by sun bounce + sky only; tile = that wall minus his silhouette ± 8 px.
// Per run: 24 consecutive OUTPUT frames read back losslessly (the offscreen target, exactly what was rendered — no re-render), the camera's unjittered view-projection per frame,
// every actor's screen box per frame. Metrics per tile (a world-space quad sampled on a grid ≈ 1 output px apart, RE-PROJECTED EVERY FRAME through that frame's matrix, so
// the surface is measured, not the pan): BLOTCH FLOW = per-point temporal sd of 8-bit luma over the sequence (mean over points), absolute and ÷ the tile's mean luma;
// BOIL = mean over points of (max − min); BLOTCH SIZE = the half-width (output px) of the autocorrelation of each frame's residual (frame − sequence mean), mean over frames;
// + ×3 nearest crops of three consecutive frames round each tile and the max−min boil map, posted to this lane's shot sink; + the same under debug view 4 (indirect only)
// and 3 (direct only) for attribution. Everything under whatever engine.settings hold (variants = settings bundles, __gim.apply).
//   __gim.boot({ framing })        framing 'ref' = 1280×720 CSS at dpr 2 (high: 1368×770 → 1777×1000, every lane's reference) | 'maint' = the maintainer's window (high: 788×770 → 1024×1000)
//   __gim.apply(name | {…})        settings bundle over the boot defaults ('main', 'old', 'B', 'C', 'BC', … VARIANTS)
//   __gim.s1(opts) / s2(opts)      run a scene → Seq (kept in __gim.seqs[key]); opts.view = 0 | 4 | 3 (composite / indirect only / direct only)
//   __gim.metrics(seq)             per-tile numbers; __gim.crops(seq, tag) posts crops + boil maps + one annotated frame
//   __gim.run(tag, { scenes, views, png })   fire-and-forget: apply → scenes × views → metrics + crops → docs/perf/gim-<tag>.json; poll __gim.busy / __gim.res[tag]
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  if (!window.__sh) { await import('/qa/sharp-harness.js'); for (let i = 0; i < 100 && !window.__sh; i++) await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); }
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  const mean = a => { let s = 0, n = 0; for (const v of a) { if (v === null || v === undefined || Number.isNaN(v)) continue; s += v; n++; } return n ? s / n : NaN; };
  const r3 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : +v.toFixed(3);
  const r2 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : +v.toFixed(2);
  // every scripted GAME step renders offscreen exactly once (main.ts presents a burst's last frame only when the document is visible): document.hidden pinned TRUE for the page's life
  function pinHidden() { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); } catch (e) { /* */ } }
  pinHidden();
  async function gameStep(dt = 1 / 60, keys = []) { pinHidden(); window.__runFrames(1, dt, keys); await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) throw new Error('no offscreen frame'); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return { w: fr.w, h: fr.h, data: fr.data }; }
  let seeded = false;
  function seed(force = false) { if (seeded && !force) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ------------------------------------------------------------------ framings + boot
  const FRAMINGS = { ref: [1280, 720, 2], maint: [1229, 1200, 2] };   // maint: a 2458×2400 device-px window → capH 1000 at high → output 1024×1000, internal ×0.77 = 788×770 (the recording's numbers)
  let framing = 'ref';
  async function boot(opts = {}) {
    framing = opts.framing ?? 'ref';
    for (let i = 0; i < 300 && !(window.__engine && window.__runFrames && document.getElementById('view')); i++) await yieldTask();
    const [cw, ch, dpr] = FRAMINGS[framing]; window.__sh.pinViewport(cw, ch, dpr);
    if (!window.__errs) { window.__errs = []; E().device.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
    window.__testVisible = true; window.__shotPort = window.__shPort ?? (parseInt(location.port, 10) + 1);
    seed(); window.__menu?.close(); window.__pauseLoop = true;
    if (window.__weather) { try { window.__weather.setEnabled(false); } catch { /* */ } }   // the storm's dice would schedule strokes into a capture
    if (opts.grain === undefined || opts.grain === false) E().passes.grain = 0;             // the final blit's FILM GRAIN off (as sharp-harness go() does): it is a per-frame white noise of its own — the same look for every variant, ≈ 0.25 levels of
                                                                                              // temporal sd in the dark tiles — that would sit under every number here as a floor and flatten the ratios between variants; `grain: true` keeps it (the shipped look)
    if (!S0) S0 = JSON.parse(JSON.stringify(S()));
    await gameStep(); await gameStep();   // (two steps: the resize to the pinned viewport happens inside render)
    return { ok: true, framing, res: [E().width, E().height, E().outWidth, E().outHeight], q: window.__quality?.current, port: window.__shotPort, desc: describe() };
  }

  // ------------------------------------------------------------------ variants: settings bundles over the boot defaults
  let S0 = null;
  const OLD = { taau: false, restir: false, denoiser: 'legacy', froxelVol: false, rtReflect: false, detail: 0, renderScale: 1.0, sharpDirect: false, sharpDecouple: false, gbaa: false, taauHistSharp: 0 };   // THE OLD RENDERER (pre-v3 chain at native rows, FXAA, the resolve configuration off)
  const VARIANTS = {
    main: {}, old: OLD,
    // B = the diffuse GI denoised at INTERNAL res (settings.giFullRes; B2 / B3 = fewer internal-res à-trous iterations, the cost tiers), C = young-history gather rays (×3 ultra / high, ×2 medium),
    // A = what the headroom-aware climb settles on for an M4 Max at the maintainer's window (scale, then the gather's divisor — §A of the doc says which rung), and the unions
    B: { giFullRes: true }, B3: { giFullRes: true, giFullIters: 3 }, B2: { giFullRes: true, giFullIters: 2 }, B1: { giFullRes: true, giFullIters: 1 },
    C: { giYoungRays: 3 }, C2: { giYoungRays: 2 }, C4: { giYoungRays: 4 },
    BC: { giFullRes: true, giYoungRays: 3 }, BC2: { giFullRes: true, giYoungRays: 2 }, B2C: { giFullRes: true, giFullIters: 2, giYoungRays: 3 }, B2C2: { giFullRes: true, giFullIters: 2, giYoungRays: 2 },
    A080: { renderScale: 0.80 }, A085: { renderScale: 0.85 }, A090: { renderScale: 0.90 }, A1: { renderScale: 1.0 }, A1g: { renderScale: 1.0, gatherThird: false }, A1gv: { renderScale: 1.0, gatherThird: false, volQuarter: false },
    g2: { gatherThird: false },   // the divisor alone at the tier's own scale (which buys more per ms: pixels or gather density?)
    A085BC: { renderScale: 0.85, giFullRes: true, giYoungRays: 3 }, A1BC: { renderScale: 1.0, giFullRes: true, giYoungRays: 3 }, A1gBC: { renderScale: 1.0, gatherThird: false, giFullRes: true, giYoungRays: 3 },
    mainNoTaaMotion: { taauMotionAlpha: 0, taauSharpenMotion: 0 },   // (reference: how much of the motion flow is the resolve's motion terms letting the frame's own noise through)
    // D = the diffuse client's follow-ups: the clamp-cut history length (dnGiClampCut) and the young-texel à-trous allowance (dnGiYoungWiden), alone and on top of B + C
    D1: { dnGiClampCut: 1.0 }, D2: { dnGiYoungWiden: 2.0 }, CD1: { giYoungRays: 3, dnGiClampCut: 1.0 }, BCD: { giFullRes: true, giYoungRays: 3, dnGiClampCut: 1.0, dnGiYoungWiden: 2.0 }, BCD1: { giFullRes: true, giYoungRays: 3, dnGiClampCut: 1.0 }, BCD2: { giFullRes: true, giYoungRays: 3, dnGiYoungWiden: 2.0 },
    // direct-side diagnostics (not this lane's files — attribution only): the leader / tail estimator instead of ReSTIR, the shadow client's occluder cue off
    dLeader: { restir: false }, dNoMoveCue: { dnShadowMoveCap: 0 },
    // the FLOOR = what the old renderer's calm-in-motion look amounts to inside v3: the leader / tail estimator + the resolve without its motion terms
    floor: { restir: false, taauMotionAlpha: 0.1, taauSharpenMotion: 0 },
    // the direct chain's and the resolve's own rows, retuned for motion (§2b's sweep): c3 = ReSTIR rows only, tOnly = the resolve's motion terms only, c4 = both
    c3: { restirHistory: 6, restirSpatialAll: true, restirPenRays: true },
    tOnly: { taauMotionAlpha: 0.25, taauSharpenMotion: 0.15 },
    c4: { restirHistory: 6, restirSpatialAll: true, restirPenRays: true, taauMotionAlpha: 0.25, taauSharpenMotion: 0.15 },
    c4BC: { restirHistory: 6, restirSpatialAll: true, restirPenRays: true, taauMotionAlpha: 0.25, taauSharpenMotion: 0.15, giFullRes: true, giYoungRays: 3 },
    // DIRECT-LIGHT-IN-MOTION lane (docs/internal/direct-motion.md): settings.restirMotion's three levers over the boot defaults (which carry the motion-calm rows since 08-12) —
    // a = stochastic-bilinear reservoir reprojection, b = motion-scaled confidence, c = spatial reuse under motion; nc* = the same with the motion-calm rows OFF (quality.ts MOTION_CALM_OFF)
    m0: { restirMotion: 0 }, ma: { restirMotion: 1 }, mad: { restirMotion: 1, restirMotionDither: true }, madb: { restirMotion: 3, restirMotionDither: true }, mb: { restirMotion: 2 }, mc: { restirMotion: 4 }, mab: { restirMotion: 3 }, mabc: { restirMotion: 7 },
    calmOff: { restirMotion: 0, restirSpatialAll: false, restirPenRays: false, taauMotionAlpha: 0.4, taauSharpenMotion: 0.3 },
    ncA: { restirMotion: 1, restirSpatialAll: false, restirPenRays: false, taauMotionAlpha: 0.4, taauSharpenMotion: 0.3 }, ncAB: { restirMotion: 3, restirSpatialAll: false, restirPenRays: false, taauMotionAlpha: 0.4, taauSharpenMotion: 0.3 }, ncABC: { restirMotion: 7, restirSpatialAll: false, restirPenRays: false, taauMotionAlpha: 0.4, taauSharpenMotion: 0.3 },
    tA: { restirMotion: 1, restirSpatialAll: false, restirPenRays: false }, tAB: { restirMotion: 3, restirSpatialAll: false, restirPenRays: false }, tABC: { restirMotion: 7, restirSpatialAll: false, restirPenRays: false },   // (the resolve's calm terms kept, ReSTIR's calm pair off: is spatialAll still earning its 0.5 ms once the reprojection follows the surface?)
  };
  function apply(name, extra = {}) {
    const v = typeof name === 'string' ? VARIANTS[name] : name; if (!v) throw new Error('variants: ' + Object.keys(VARIANTS).join(' '));
    const s = S(); if (!S0) S0 = JSON.parse(JSON.stringify(s));
    for (const k of Object.keys(S0)) { if (typeof S0[k] === 'object' && S0[k] !== null) continue; s[k] = S0[k]; }   // scalars back to the boot defaults (flags / arrays untouched)
    for (const [k, val] of Object.entries({ ...v, ...extra })) { if (!(k in s)) throw new Error('unknown setting ' + k); s[k] = val; }
    return describe();
  }
  function describe() { const s = S(); const e = E(); return { res: [e.width, e.height, e.outWidth, e.outHeight], q: window.__quality?.current, framing, scale: s.renderScale, gatherDiv: e.passes.gatherDiv, gw: e.passes.gw, gh: e.passes.gh, sharp: s.sharpDirect, sharpLive: e.sharpOn, taau: s.taau, restir: s.restir, dn: s.denoiser, froxel: s.froxelVol, rt: s.rtReflect, gbaa: s.gbaa ?? null, giFullRes: s.giFullRes ?? null, giYoungRays: s.giYoungRays ?? null, giFullLive: !!(e.passes.giFullOn && e.passes.giF && e.passes.giF.length === 2 && e.passes.giFullRanLast), dnGi: [s.dnGiIters, s.dnGiCap], grain: e.passes.grain, debugView: s.debugView, errs: (window.__errs || []).slice(0, 3) }; }   // (NB read straight after apply(): the engine's sizes / sharpLive / giFullLive catch up on the next frame — `run` records it again after the takes as appliedAfter)

  // ------------------------------------------------------------------ projection + sampling
  /** world point → OUTPUT-frame pixel (sub-pixel, top-left origin, centres at .5) through the 4×4 column-major view-projection `vp` of the frame that was read back */
  function projectVP(vp, p, w, h) {
    const x = p[0], y = p[1], z = p[2];
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 1e-4) return null;
    return [(cx / cw * 0.5 + 0.5) * w, (0.5 - cy / cw * 0.5) * h];
  }
  function bilLuma(fr, x, y) {
    x -= 0.5; y -= 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y); if (x0 < 0 || y0 < 0 || x0 + 1 >= fr.w || y0 + 1 >= fr.h) return NaN;
    const fx = x - x0, fy = y - y0; const o = (y0 * fr.w + x0) * 4, o2 = o + fr.w * 4;
    return (luma(fr.data, o) * (1 - fx) + luma(fr.data, o + 4) * fx) * (1 - fy) + (luma(fr.data, o2) * (1 - fx) + luma(fr.data, o2 + 4) * fx) * fy;
  }
  // the g-buffer's id target as drawn (the OUTPUT-size one under sharp direct, else internal) — no COPY_SRC usage on it, so a four-line kernel of our own reads it into a storage buffer (chaos-scenes.js's)
  let idPipe = null, idBufs = null;
  async function readIds() {
    const gb = E().gbuffer; const tex = (E().sharpOn && gb.idO) ? gb.idO : gb.id; const w = tex.width, h = tex.height; const dev = E().device;
    if (!idPipe) { const mod = dev.createShaderModule({ code: 'struct D { w: u32, h: u32 }; @group(0) @binding(0) var t: texture_2d<u32>; @group(0) @binding(1) var<storage, read_write> o: array<u32>; @group(0) @binding(2) var<uniform> d: D;\n@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) g: vec3u) { if (g.x >= d.w || g.y >= d.h) { return; } o[g.y * d.w + g.x] = textureLoad(t, vec2i(g.xy), 0).x; }' }); idPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } }); }
    if (!idBufs || idBufs.n < w * h) { if (idBufs) { idBufs.st.destroy(); idBufs.rd.destroy(); } idBufs = { n: w * h, st: dev.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }), rd: dev.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), u: dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }) }; }
    dev.queue.writeBuffer(idBufs.u, 0, new Uint32Array([w, h, 0, 0]));
    const bg = dev.createBindGroup({ layout: idPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: tex.createView() }, { binding: 1, resource: { buffer: idBufs.st } }, { binding: 2, resource: { buffer: idBufs.u } }] });
    const enc = dev.createCommandEncoder(); const p = enc.beginComputePass(); p.setPipeline(idPipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end();
    enc.copyBufferToBuffer(idBufs.st, 0, idBufs.rd, 0, w * h * 4); dev.queue.submit([enc.finish()]);
    await idBufs.rd.mapAsync(GPUMapMode.READ); const data = new Uint32Array(idBufs.rd.getMappedRange(0, w * h * 4).slice(0)); idBufs.rd.unmap();
    return { w, h, data };
  }
  /** the ACTOR mask of a frame from its ids: 4×4-output-px blocks holding any character pixel (id bit 28) or a box carried by one (owner byte ≠ 0: rig props, guns, cans), dilated 2 blocks (≥ 8 px) —
   *  what 'his silhouette ± 8 px' means per frame; sampleTile drops points inside it */
  const MB = 4;
  function actorMask(ids, w, h) {
    const bw = Math.ceil(w / MB), bh = Math.ceil(h / MB); const m = new Uint8Array(bw * bh); const kx = ids.w / w, ky = ids.h / h;
    for (let ty = 0; ty < ids.h; ty++) { const oy = Math.min(h - 1, Math.floor(ty / ky)); const by = Math.floor(oy / MB); const row = ty * ids.w; for (let tx = 0; tx < ids.w; tx++) { const id = ids.data[row + tx]; if (id === 0xFFFFFFFF) continue; if ((((id >>> 28) & 1) === 1) || (((id >>> 20) & 0xFF) !== 0)) { const ox = Math.min(w - 1, Math.floor(tx / kx)); m[by * bw + Math.floor(ox / MB)] = 1; } } }
    const d = new Uint8Array(bw * bh); const R = 2;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { if (!m[j * bw + i]) continue; for (let dj = -R; dj <= R; dj++) { const jj = j + dj; if (jj < 0 || jj >= bh) continue; for (let di = -R; di <= R; di++) { const ii = i + di; if (ii < 0 || ii >= bw) continue; d[jj * bw + ii] = 1; } } }
    return { bw, bh, data: d };
  }
  /** screen box (output px, dilated `pad`) round a standing man at `pos`: feet, hips, head + shoulder width across the view */
  function actorBox(vp, pos, w, h, pad = 8) {
    const pts = []; const right = window.__cam ? (() => { const f = window.__cam.forward; const r = [-f[2], 0, f[0]]; const l = Math.hypot(r[0], r[2]) || 1; return [r[0] / l, 0, r[2] / l]; })() : [1, 0, 0];
    for (const yy of [0.0, 0.5, 1.0, 1.5, 1.9]) for (const s of [-0.45, 0, 0.45]) { const q = projectVP(vp, [pos[0] + right[0] * s, yy, pos[2] + right[2] * s], w, h); if (q) pts.push(q); }
    if (!pts.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }

  // ------------------------------------------------------------------ tiles: world-space quads (origin o, edge vectors u, v), sampled on an nu × nv grid fixed at frame 0
  const TILES = {
    // (placed off a 5-cm luma map of the settled floor from this view — the lamp's mullion stripes run x = x_mullion ± 0.27·(24 − z), the moon's + 0.61·(24 − z); Sam's box during the take covers x 14.9‥16.5)
    s1: [
      { name: 'unlit', o: [18.95, 0.012, 22.72], u: [0.5, 0, 0], v: [0, 0, 0.55], note: 'the UNLIT floor east of the window light, by the wall between the two window bands: indirect only (L ≈ 30) — the GI tile' },
      { name: 'lightEdge', o: [18.9, 0.012, 22.1], u: [0.6, 0, 0], v: [0, 0, 0.55], note: "the lamp pool's soft east EDGE crossing dark floor (direct penumbra under pan — a control for 'edges are stable')" },
      { name: 'unlitAisle', o: [19.6, 0.012, 22.1], u: [0.8, 0, 0], v: [0, 0, 0.9], note: 'the unlit floor further east along the wall, south of the second cubicle block' },
      { name: 'stripe', o: [16.95, 0.012, 22.75], u: [0.13, 0, 0], v: [0.165, 0, -0.6], note: "INSIDE the street lamp's shadow of the east mullion (x = 16.67 at the glass): a 12-cm dark stripe on the lit floor, ~10 px across" },
      { name: 'moonStripe', o: [17.3, 0.012, 22.7], u: [0.32, 0, 0], v: [0.31, 0, -0.5], note: "inside the MOON's shadow of the same mullion: lamp-lit, moon-dark (dim, wide)" },
      { name: 'litFloor', o: [14.3, 0.012, 22.5], u: [0.5, 0, 0], v: [0, 0, 0.5], note: 'CONTROL: fully lit floor west of Sam (direct-dominated)' },
      { name: 'sillWall', o: [16.7, 0.15, 23.935], u: [1.3, 0, 0], v: [0, 0.6, 0], note: "the south wall's inner face BELOW the window (faces north: the lamp cannot reach it) — lit by the floor pool's bounce: the GI-dominated tile" },
    ],
    s2: [
      { name: 'wall', o: [27.94, 0.25, 18.35], u: [0, 0, 1.9], v: [0, 1.55, 0], wallX: true, note: "the break room's west wall (x = 27.94 face) behind Blue One, from beside the door frame south; the two operatives' silhouettes ± 8 px excluded per frame" },
      { name: 'wallHigh', o: [27.94, 1.35, 18.4], u: [0, 0, 1.8], v: [0, 0.7, 0], wallX: true, note: 'the upper band of that wall (over his head most frames: nearly nothing excluded)' },
      { name: 'door', o: [27.95, 0.3, 17.15], u: [0, 0, 0.8], v: [0, 1.5, 0], wallX: true, note: 'the shut leaf in the same wall, north of the men (never occluded)' },
    ],
  };
  /** fix a tile's sampling grid from frame 0's projection: ≈ 1 output px per sample along each edge (≥ 8) */
  function gridOf(tile, vp, w, h) {
    const P = (a, b) => projectVP(vp, [tile.o[0] + tile.u[0] * a + tile.v[0] * b, tile.o[1] + tile.u[1] * a + tile.v[1] * b, tile.o[2] + tile.u[2] * a + tile.v[2] * b], w, h);
    const c00 = P(0, 0), c10 = P(1, 0), c01 = P(0, 1), c11 = P(1, 1); if (!c00 || !c10 || !c01 || !c11) return null;
    const lu = (Math.hypot(c10[0] - c00[0], c10[1] - c00[1]) + Math.hypot(c11[0] - c01[0], c11[1] - c01[1])) / 2;
    const lv = (Math.hypot(c01[0] - c00[0], c01[1] - c00[1]) + Math.hypot(c11[0] - c10[0], c11[1] - c10[1])) / 2;
    return { nu: Math.max(8, Math.round(lu)), nv: Math.max(8, Math.round(lv)), pxPerSample: [lu / Math.max(8, Math.round(lu)), lv / Math.max(8, Math.round(lv))] };
  }
  /** sample the tile on its grid in frame f: Float32Array(nu·nv) of luma, NaN where off-screen / inside an actor box */
  function sampleTile(tile, grid, frame, w, h) {
    const { nu, nv } = grid; const out = new Float32Array(nu * nv); const vp = frame.vp; const fr = frame.fr;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = (i + 0.5) / nu, b = (j + 0.5) / nv;
      const p = [tile.o[0] + tile.u[0] * a + tile.v[0] * b, tile.o[1] + tile.u[1] * a + tile.v[1] * b, tile.o[2] + tile.u[2] * a + tile.v[2] * b];
      const q = projectVP(vp, p, w, h); let val = NaN;
      if (q) {
        let inActor = false;
        if (frame.mask) { const bi = Math.floor(q[1] / MB) * frame.mask.bw + Math.floor(q[0] / MB); inActor = q[0] >= 0 && q[1] >= 0 && q[0] < w && q[1] < h && frame.mask.data[bi] === 1; }
        else for (const bx of frame.actors) { if (bx && q[0] >= bx[0] && q[0] <= bx[2] && q[1] >= bx[1] && q[1] <= bx[3]) { inActor = true; break; } }
        if (!inActor) val = bilLuma(fr, q[0], q[1]);
      }
      out[j * nu + i] = val;
    }
    return out;
  }
  /** per-tile statistics over a sequence: blotch flow (temporal sd per point → mean, abs + rel), boil (max−min), blotch size (residual autocorrelation half-width, px), coverage */
  function tileStats(tile, seq) {
    const f0 = seq.frames[0]; const grid = gridOf(tile, f0.vp, seq.w, seq.h); if (!grid) return { name: tile.name, error: 'off screen at frame 0' };
    const n = grid.nu * grid.nv; const T = seq.frames.length;
    const samples = seq.frames.map(fr => sampleTile(tile, grid, fr, seq.w, seq.h));
    // points valid in EVERY frame only (a point that dips under an actor box for a frame would read as boil)
    const valid = new Uint8Array(n).fill(1); for (const s of samples) for (let k = 0; k < n; k++) if (Number.isNaN(s[k])) valid[k] = 0;
    let nValid = 0; for (let k = 0; k < n; k++) nValid += valid[k];
    if (nValid < 16) return { name: tile.name, error: `only ${nValid} points valid in all ${T} frames`, grid };
    const meanP = new Float32Array(n), sdP = new Float32Array(n), rangeP = new Float32Array(n);
    let mL = 0, mSd = 0, mRange = 0, mDelta = 0;
    for (let k = 0; k < n; k++) {
      if (!valid[k]) continue;
      let s1 = 0, s2 = 0, mn = Infinity, mx = -Infinity, dsum = 0;
      for (let t = 0; t < T; t++) { const v = samples[t][k]; s1 += v; s2 += v * v; if (v < mn) mn = v; if (v > mx) mx = v; if (t > 0) dsum += Math.abs(v - samples[t - 1][k]); }
      const m = s1 / T; meanP[k] = m; sdP[k] = Math.sqrt(Math.max(0, s2 / T - m * m)); rangeP[k] = mx - mn;
      mL += m; mSd += sdP[k]; mRange += rangeP[k]; mDelta += dsum / (T - 1);
    }
    mL /= nValid; mSd /= nValid; mRange /= nValid; mDelta /= nValid;
    // the SLOW part: sd of a 6-frame running mean (grain averages out of it; drifting blotches do not)
    let mSdLow = 0; { const R = 6; if (T >= R + 2) { for (let k = 0; k < n; k++) { if (!valid[k]) continue; let l1 = 0, l2 = 0, ln = 0; for (let t = 0; t + R <= T; t++) { let m = 0; for (let r = 0; r < R; r++) m += samples[t + r][k]; m /= R; l1 += m; l2 += m * m; ln++; } const lm = l1 / ln; mSdLow += Math.sqrt(Math.max(0, l2 / ln - lm * lm)); } mSdLow /= nValid; } else mSdLow = NaN; }
    // blotch SIZE: per frame the residual r = frame − sequence mean over the grid; autocorrelation along u and v at lags 0‥12; half-width where it crosses 0.5 (linear interp), in output px
    const acHalf = [];
    for (let t = 0; t < T; t++) {
      const s = samples[t];
      const ac = (lagI, lagJ) => { let num = 0, den = 0; for (let j = 0; j + lagJ < grid.nv; j++) for (let i = 0; i + lagI < grid.nu; i++) { const k = j * grid.nu + i, k2 = (j + lagJ) * grid.nu + i + lagI; if (!valid[k] || !valid[k2]) continue; const a = s[k] - meanP[k], b = s[k2] - meanP[k2]; num += a * b; den += a * a; } return den > 0 ? num / den : NaN; };
      const half = (dirI) => { let prev = 1; for (let l = 1; l <= 12; l++) { const c = dirI ? ac(l, 0) : ac(0, l); if (Number.isNaN(c)) return NaN; if (c < 0.5) return (l - 1) + (prev - 0.5) / Math.max(prev - c, 1e-6); prev = c; } return 12; };
      const hu = half(true) * grid.pxPerSample[0], hv = half(false) * grid.pxPerSample[1];
      acHalf.push(mean([hu, hv]));
    }
    return { name: tile.name, note: tile.note, grid: [grid.nu, grid.nv], pxPerSample: grid.pxPerSample.map(r3), valid: nValid, coverage: r3(nValid / n), meanL: r3(mL), sdAbs: r3(mSd), sdRel: r3(mSd / Math.max(mL, 1e-6)), sdLow: r3(mSdLow), absDelta: r3(mDelta), boil: r3(mRange), boilRel: r3(mRange / Math.max(mL, 1e-6)), sizePx: r3(mean(acHalf)),
      _grid: grid, _mean: meanP, _range: rangeP, _valid: valid };
  }
  function metrics(seq) { const out = { scene: seq.scene, view: seq.view, frames: seq.frames.length, res: [seq.w, seq.h], desc: seq.desc, tiles: {} }; for (const t of TILES[seq.scene]) out.tiles[t.name] = tileStats(t, seq); return out; }
  /** the numbers without the private arrays (what goes into the json) */
  function strip(m) { const o = { ...m, tiles: {} }; for (const [k, t] of Object.entries(m.tiles)) { const c = { ...t }; delete c._grid; delete c._mean; delete c._range; delete c._valid; o.tiles[k] = c; } return o; }

  // ------------------------------------------------------------------ crops + boil maps + an annotated frame → the shot sink
  async function post(name, canvas, type = 'image/jpeg', q = 0.9) { const blob = await new Promise(res => canvas.toBlob(b => res(b), type, q)); const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return `${name} ${canvas.width}x${canvas.height} ${(blob.size / 1024).toFixed(0)} KB → ${r.status}`; }
  function cropCanvas(fr, x, y, w, h, scale) { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(w * scale, h * scale); for (let j = 0; j < h * scale; j++) for (let i = 0; i < w * scale; i++) { const sx = Math.min(fr.w - 1, Math.max(0, x + Math.floor(i / scale))), sy = Math.min(fr.h - 1, Math.max(0, y + Math.floor(j / scale))); const so = (sy * fr.w + sx) * 4, o = (j * w * scale + i) * 4; img.data[o] = fr.data[so]; img.data[o + 1] = fr.data[so + 1]; img.data[o + 2] = fr.data[so + 2]; img.data[o + 3] = 255; } cx.putImageData(img, 0, 0); return c; }
  /** the tile's projected bbox in frame f (output px) */
  function tileBox(tile, vp, w, h) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = projectVP(vp, [tile.o[0] + tile.u[0] * a + tile.v[0] * b, tile.o[1] + tile.u[1] * a + tile.v[1] * b, tile.o[2] + tile.u[2] * a + tile.v[2] * b], w, h); if (!q) return null; x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } return [x0, y0, x1, y1]; }
  async function crops(seq, tag, opts = {}) {
    const { at = [11, 12, 13], scale = 3, pad = 36, frameJpg = true, m = null, prefix = 'gim' } = opts; const out = [];   // (prefix: another lane's crops under its own name — the direct-motion lane posts dmo_*)
    const met = m ?? metrics(seq);
    for (const tile of TILES[seq.scene]) {
      // crop window fixed in the WORLD: the tile's bbox re-projected per frame (so the three crops show the same piece of floor / wall while the camera pans)
      for (const f of at) {
        const fr = seq.frames[f]; if (!fr) continue; const bb = tileBox(tile, fr.vp, seq.w, seq.h); if (!bb) continue;
        const cw = Math.min(seq.w, Math.round(bb[2] - bb[0]) + 2 * pad), chh = Math.min(seq.h, Math.round(bb[3] - bb[1]) + 2 * pad);
        const x = Math.max(0, Math.min(seq.w - cw, Math.round(bb[0]) - pad)), y = Math.max(0, Math.min(seq.h - chh, Math.round(bb[1]) - pad));
        out.push(await post(`${prefix}_${tag}_${seq.scene}v${seq.view}_${tile.name}_f${f}`, cropCanvas(fr.fr, x, y, cw, chh, scale)));
      }
      // boil map: per grid point max − min over the sequence, ×8 grey levels per 8-bit step of range (so a range of 32 saturates), NaN = dark red; nearest ×scale
      const t = met.tiles[tile.name]; if (t && t._grid) {
        const { nu, nv } = t._grid; const c = document.createElement('canvas'); c.width = nu * scale; c.height = nv * scale; const cx = c.getContext('2d'); const img = cx.createImageData(nu * scale, nv * scale);
        for (let j = 0; j < nv * scale; j++) for (let i = 0; i < nu * scale; i++) { const k = Math.floor(j / scale) * nu + Math.floor(i / scale); const o = (j * nu * scale + i) * 4; if (!t._valid[k]) { img.data[o] = 90; img.data[o + 1] = 0; img.data[o + 2] = 0; } else { const v = Math.min(255, Math.round(t._range[k] * 8)); img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; } img.data[o + 3] = 255; }
        cx.putImageData(img, 0, 0); out.push(await post(`${prefix}_${tag}_${seq.scene}v${seq.view}_${tile.name}_boil`, c, 'image/png'));
      }
    }
    if (frameJpg) {   // one mid-sequence frame, half size, the tiles outlined (page orientation)
      const f = seq.frames[at[1] ?? 12] ?? seq.frames[0]; const c = document.createElement('canvas'); c.width = Math.round(seq.w / 2); c.height = Math.round(seq.h / 2); const cx = c.getContext('2d');
      const full = cropCanvas(f.fr, 0, 0, seq.w, seq.h, 1); cx.imageSmoothingQuality = 'high'; cx.drawImage(full, 0, 0, c.width, c.height);
      cx.lineWidth = 2; cx.font = '12px ui-monospace, monospace';
      for (const tile of TILES[seq.scene]) { const bb = tileBox(tile, f.vp, seq.w, seq.h); if (!bb) continue; cx.strokeStyle = '#4df'; cx.strokeRect(bb[0] / 2, bb[1] / 2, (bb[2] - bb[0]) / 2, (bb[3] - bb[1]) / 2); cx.fillStyle = '#4df'; cx.fillText(tile.name, bb[0] / 2, bb[1] / 2 - 3); }
      cx.strokeStyle = '#f84'; for (const bx of f.actors) if (bx) cx.strokeRect(bx[0] / 2, bx[1] / 2, (bx[2] - bx[0]) / 2, (bx[3] - bx[1]) / 2);
      out.push(await post(`${prefix}_${tag}_${seq.scene}v${seq.view}_frame`, c, 'image/jpeg', 0.85));
    }
    return out;
  }
  /** every frame of a sequence as a lossless PNG (docs/shots/ab/gim_<tag>_<scene>_fNN.png) — the raw record; big, so opt-in */
  async function pngs(seq, tag) { const out = []; for (let f = 0; f < seq.frames.length; f++) { const c = cropCanvas(seq.frames[f].fr, 0, 0, seq.w, seq.h, 1); out.push(await post(`gim_${tag}_${seq.scene}v${seq.view}_f${String(f).padStart(2, '0')}`, c, 'image/png')); } return out; }

  // ------------------------------------------------------------------ the scenes
  /** the VIEW a sequence is taken under: 0 = the composite (the real picture: TAAU, sharp direct and all), 'D' = the composite WITHOUT the GI term (settings.indirectScale 0 — everything else, the resolve
   *  included, as in 0: the GI's marginal share of a tile's flow is what 0 has over D), 4 = the indirect-only debug view, 3 = direct-only (both bypass the resolve and sharp direct: the terms naked) */
  let scale0 = null;
  function setView(view) { const s = S(); if (scale0 === null) scale0 = s.indirectScale; if (view === 'D') { s.debugView = 0; s.indirectScale = 0; } else { s.debugView = view; s.indirectScale = scale0; } steadyTubes(); }
  function endView() { const s = S(); s.debugView = 0; if (scale0 !== null) s.indirectScale = scale0; try { for (const t of G().targets || []) if (t.__gimWasFlicker) { t.fluorescentFlicker = true; delete t.__gimWasFlicker; } } catch (e) { /* */ } }   // (the tubes flicker again once a take is over: a by-eye check in the same page sees the game as it is)
  /** hold the fluorescent fixtures STEADY: lighting.ts drops a flickering tube to 15 % at 14 Hz in OCCASIONAL bursts (sin 3.1t + 0.6 sin 7.3t > 1.15) — whichever runs happen to overlap a burst
   *  would measure the strobe's bounce pumping the whole cubicle floor (whole-tile boil ≈ 16 levels, read as '33 % blotch flow' the first evening) instead of the renderer's noise. The strobe is
   *  an authored lighting change (the recording's item (c)), not motion noise: out of every take here. */
  function steadyTubes() { try { for (const t of G().targets || []) if (t.fluorescentFlicker) { t.fluorescentFlicker = false; t.__gimWasFlicker = true; } } catch (e) { /* */ } }
  const S1 = { start: [14.1, 0, 22.65], goal: [26.0, 0, 22.65], yaw: 160 * DEG, pitch: 55 * DEG, dist: 21, settle: 60, still: 40 };   // z 22.65: the walkable strip between the bottom cubicle row (chairs to z 22.25) and the south wall; during the take he crosses x 15.4 → 16.0
  /** capture one frame's record after a game step: readback + the camera's (unjittered) view-projection + actor boxes */
  async function record(actorsOf) {
    const fr = await readback(); const vp = Float32Array.from(window.__cam.viewProj);
    const actors = actorsOf().map(p => actorBox(vp, p, fr.w, fr.h, 8)).filter(Boolean);
    let mask = null; try { if (actorsOf().length) mask = actorMask(await readIds(), fr.w, fr.h); } catch (e) { mask = null; }   // the drawn silhouettes ± 8 px (the boxes stay as the fallback and for the annotated frame)
    return { fr, vp, actors, mask };
  }
  /** S1: fresh encounter state assumed (right after boot, or the caller restarted). Guards parked dark, Sam visible, holstered, walking east under the puppet; the follow camera released
   *  at the gameplay yaw / pitch / distance; `settle` steps of walking before the take (the follow point reaches its steady lag, every history has seen motion), then `frames`. */
  async function s1(opts = {}) {
    const { frames = 24, view = 0, settle = S1.settle, walk = 1, keep = true } = opts;
    const g = G(), cam = window.__cam; window.__menu?.close(); seed();
    if (window.__breach?.active) window.__breach.stop();
    setView(view);
    g.puppet = null;
    window.__stage(null, { park: true, player: { pos: S1.start, yaw: Math.PI / 2, crouch: false, holstered: true, invisible: false } });
    window.__resetClock?.(); seed(true);   // the same jitter / dice / grain sequence and the same Math.random stream every run, whatever ran before in this page
    cam.yaw = S1.yaw; cam.pitch = S1.pitch; cam.distance = cam.desiredDistance = S1.dist; cam.target = [...S1.start]; cam.desired = [...S1.start];
    const cv = E().gpu.canvas; window.__mouse(cv.clientWidth * 0.5, cv.clientHeight * 0.5, 0);   // a neutral aim lead (the follow point leans 18 % toward the cursor's ground point)
    g.player.pace = 1; g.player.nv = false; g.player.nvAmount = 0;
    __perf.still();
    for (let i = 0; i < S1.still; i++) await gameStep();          // stand still first: histories converge on the opening view (as a player pausing before walking on)
    __perf.still();
    g.puppet = { goal: [...S1.goal], aim: null, walk };
    for (let i = 0; i < settle; i++) await gameStep();            // walking: the follow camera reaches its steady lag behind him
    const seq = { scene: 's1', view, w: 0, h: 0, frames: [], desc: describe(), samPath: [] };
    for (let f = 0; f < frames; f++) {
      await gameStep();
      const rec = await record(() => [g.player.char.pos]); seq.w = rec.fr.w; seq.h = rec.fr.h; seq.frames.push(rec); seq.samPath.push(g.player.char.pos.map(r3));
    }
    g.puppet = null;
    seq.camPan = (() => { const a = projectVP(seq.frames[0].vp, [17, 0, 22.3], seq.w, seq.h), b = projectVP(seq.frames[frames - 1].vp, [17, 0, 22.3], seq.w, seq.h); return a && b ? r3(Math.hypot(b[0] - a[0], b[1] - a[1]) / (frames - 1)) : null; })();   // output px per frame a floor point moves on screen
    if (keep) I.seqs[`s1v${view}`] = seq;
    endView();
    return seq;
  }
  /** S1 STILL control: the same view with Sam standing (invisible) and the camera pinned where the pan's middle frame had it — the metric's floor (what a still picture measures) */
  async function s1still(opts = {}) {
    const { frames = 24, view = 0, keep = true } = opts;
    const g = G(); window.__menu?.close(); seed(); if (window.__breach?.active) window.__breach.stop();
    setView(view); g.puppet = null;
    window.__stage({ look: [16.9, 0, 22.35], yaw: S1.yaw, pitch: S1.pitch, dist: S1.dist }, { park: true, player: { pos: [10, 0, 12], yaw: 1.57, holstered: true, invisible: true } });
    window.__resetClock?.(); seed(true);
    __perf.still(); for (let i = 0; i < 60; i++) await gameStep(); __perf.still();
    const seq = { scene: 's1', view, still: true, w: 0, h: 0, frames: [], desc: describe() };
    for (let f = 0; f < frames; f++) { await gameStep(); const rec = await record(() => []); seq.w = rec.fr.w; seq.h = rec.fr.h; seq.frames.push(rec); }
    if (keep) I.seqs[`s1stillv${view}`] = seq;
    endView();
    return seq;
  }
  const S2 = { at: 496 };   // breach frame the take starts after (phase 'stack' from 436: Blue One walks the last metres along the wall through 496–520, planted by ~560)
  /** S2: the breach from a FRESH boot (its cast draws on Math.random at hire; seeded here, phases zeroed) stepped to S2.at, then `frames`. view as s1. A second call in one page re-runs the show
   *  (stop → start): close to, not bit-identical with, the first — use one boot per variant for the composite numbers, re-runs for the debug views. */
  async function s2(opts = {}) {
    const { frames = 24, view = 0, keep = true, at = S2.at } = opts;
    const g = G(); window.__menu?.close(); seed();
    if (window.__breach.active) { window.__breach.stop(); for (let i = 0; i < 5; i++) await gameStep(); }
    setView(view); g.puppet = null;
    window.__stage(null, {});
    window.__resetClock?.(); seed(true);   // the same Math.random stream at the hire and the same jitter / dice sequence every run
    window.__breach.start();
    for (const gd of g.guards) gd.char.anim.phase = 0; g.player.char.anim.phase = 0; __perf.still();
    for (let i = 0; i < at; i++) await gameStep();
    const seq = { scene: 's2', view, w: 0, h: 0, frames: [], desc: describe(), phase0: window.__breach.drill?.phase, opPath: [] };
    for (let f = 0; f < frames; f++) {
      await gameStep();
      const rec = await record(() => g.guards.slice(0, 2).map(gd => gd.char.pos)); seq.w = rec.fr.w; seq.h = rec.fr.h; seq.frames.push(rec); seq.opPath.push(g.guards[0].char.pos.map(r3));   // (the two operatives are in front of the wall; the three hostiles stand behind it, in the room — their boxes must not blank the wall)
    }
    seq.phase1 = window.__breach.drill?.phase;
    window.__breach.stop(); for (let i = 0; i < 3; i++) await gameStep();
    if (keep) I.seqs[`s2v${view}`] = seq;
    endView();
    return seq;
  }

  // ------------------------------------------------------------------ (A) the climb on THIS machine: measure the calm union per rung, then run the real ladder against those numbers
  /** serialized calm-still union (med / p95) at each rung the climb can reach from the current preset: scales from the tier's start to 1.0, then gather ½, then vol ½ → [{ rung, scale, g3, v4, union, p95, passes }] */
  async function costCurve(opts = {}) {
    const { n = 30, warm = 10, extra = {} } = opts; const s = S(); const rows = [];
    apply('main', extra); await __pf.stageStill(); await __perf.render(20);
    const start = s.renderScale; const scales = []; for (let v = start; v < 1.0 + 1e-6; v = +(Math.min(1.0, Math.floor(v / 0.05 + 1e-6) * 0.05 + 0.05)).toFixed(2)) { scales.push(+v.toFixed(2)); if (v >= 1.0 - 1e-6) break; }
    if (scales[scales.length - 1] < 1.0) scales.push(1.0);
    const measure = async (label) => { await __perf.render(warm); const c = await window.__sh.cost(n, 4); rows.push({ rung: label, scale: s.renderScale, g3: s.gatherThird, v4: s.volQuarter, maxH: s.maxInternalHeight, res: `${E().width}×${E().height}→${E().outWidth}×${E().outHeight}`, union: c.unionMed, p95: c.unionP95, sum: c.sumMed, passes: c.passes }); };
    for (const sc of scales) { s.renderScale = sc; await measure(`scale ${sc.toFixed(2)}`); }
    if (s.gatherThird) { s.gatherThird = false; await measure('gather ½'); }
    if (s.volQuarter) { s.volQuarter = false; await measure('vol ½'); }
    apply('main', extra); await __perf.render(4);
    return rows;
  }
  /** the REAL ladder (ui/quality.ts Quality.sample) driven window by window at `fps` with the union looked up from a costCurve() for whatever rung it stands on (+ `slack` ms for what a presented frame
   *  adds over a serialized still) → the log of its changes and where it settles after `secs` */
  function climbSim(curve, opts = {}) {
    const { secs = 90, fps = 60, slack = 0.5 } = opts; const q = window.__quality, s = S();
    const unionOf = () => { const r = curve.find(c => Math.abs(c.scale - s.renderScale) < 0.01 && c.g3 === s.gatherThird && c.v4 === s.volQuarter) ?? curve.filter(c => c.g3 === s.gatherThird && c.v4 === s.volQuarter).sort((a, b) => Math.abs(a.scale - s.renderScale) - Math.abs(b.scale - s.renderScale))[0] ?? curve[curve.length - 1]; return r.union + slack; };
    const wasAuto = q.auto, wasAdaptive = q.adaptive, wasAllowed = q.climbAllowed, wasAim = s.ladderAim; q.auto = false; q.adaptive = true; q.climbAllowed = true; s.ladderAim = 0;   /* (the recorded climb curves are the as-now ladder's: ?aim=asnow; the page's default is hold 60 since 10-10) */ q.calib && (q.calib.done = true);   // (the harness boots under ?quality=, which holds the climb off for the visit — main.ts; the simulation is of a menu-pinned / auto machine, so allow it here and put the flag back)
    apply('main'); q.apply(q.current);
    const log = []; let last = '';
    for (let w = 0; w < secs; w++) { const u = unionOf(); for (let i = 0; i < fps; i++) q.sample(1 / fps, u); const now = `${s.renderScale.toFixed(2)} g3 ${s.gatherThird} v4 ${s.volQuarter} maxH ${s.maxInternalHeight}`; if (now !== last) { log.push({ t: w + 1, state: now, union: u, note: q.lastChange }); last = now; } }
    const settled = { scale: s.renderScale, gatherThird: s.gatherThird, volQuarter: s.volQuarter, maxH: s.maxInternalHeight, union: unionOf(), climb: q.climbState };
    q.auto = wasAuto; q.adaptive = wasAdaptive; q.climbAllowed = wasAllowed; s.ladderAim = wasAim; apply('main'); q.apply(q.current);
    return { settled, log };
  }
  async function save(name, obj) { const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } }); return r.status; }
  const text = (m) => Object.entries(m.tiles).map(([n, t]) => t.error ? `${n}: ${t.error}` : `${n.padEnd(11)} L ${String(t.meanL).padStart(6)}  sd ${t.sdAbs} (${(t.sdRel * 100).toFixed(1)} %)  low ${t.sdLow}  |Δ| ${t.absDelta}  boil ${t.boil}  size ${t.sizePx} px  cov ${t.coverage}`).join('\n');
  const I = {
    VARIANTS, TILES, FRAMINGS, S1, S2, seqs: {}, res: {}, busy: null, err: null,
    boot, apply, describe, s1, s1still, s2, metrics: m => strip(metrics(m)), crops, pngs, save, gameStep, readback, projectVP, text, costCurve, climbSim,
    /** ONE VARIANT, fire-and-forget: apply(variant) → for each scene: view 0 first (the composite — S2's first run of the boot), then the debug views → metrics + crops (+ pngs) → __gim.res[tag], docs/perf/gim-<tag>.json */
    run(tag, opts = {}) {
      const { variant = 'main', extra = {}, scenes = ['s1', 's2'], views = [0, 'D', 4, 3], png = false, still = true, cropsFor = [0, 4, 3], prefix = 'gim', file = 'gim-' } = opts;   // (prefix / file: crops → <prefix>_<tag>_…, numbers → docs/perf/<file><tag>.json — a lane reusing this instrument keeps its own names)
      I.busy = { tag, at: 'start' }; I.err = null;
      (async () => {
        try {
          const out = { tag, variant, extra, applied: apply(variant, extra), q: window.__quality?.current, framing, t0: performance.now(), scenes: {} };
          for (const sc of scenes) for (const v of views) {
            I.busy.at = `${sc} v${v}`;
            const seq = sc === 's1' ? await s1({ view: v }) : await s2({ view: v });
            const m = metrics(seq); const key = `${sc}v${v}`;
            out.scenes[key] = { ...strip(m), samPath: seq.samPath, opPath: seq.opPath, camPan: seq.camPan, phase: [seq.phase0, seq.phase1] };
            if (cropsFor.includes(v)) out.scenes[key].crops = await crops(seq, tag, { m, prefix });
            if (png && v === 0) out.scenes[key].pngs = (await pngs(seq, tag)).length;
            if (sc === 's1' && still && v !== 3 && v !== 'D') { I.busy.at = `${sc}still v${v}`; const sq = await s1still({ view: v }); out.scenes[`s1stillv${v}`] = strip(metrics(sq)); }
            delete I.seqs[key];   // (memory: a sequence is ~170 MB of readbacks)
            out.ms = Math.round(performance.now() - out.t0); I.res[tag] = out; try { await save(file + tag, out); } catch (e) { /* the sink hiccuped: the end-of-run save retries */ }   // partial results survive a pane reset (the shared Browser pane has been closed under running lanes before)
          }
          // the GI's marginal share of each composite tile's flow: what the composite (0) has over the composite-without-GI ('D') in variance terms — sd² additive if the terms' noise is independent
          for (const sc of scenes) { const a = out.scenes[`${sc}v0`], d = out.scenes[`${sc}vD`]; if (!a || !d) continue; const share = {}; for (const [n, t] of Object.entries(a.tiles)) { const u = d.tiles[n]; if (!t || !u || t.error || u.error) continue; const va = t.sdAbs ** 2, vd = u.sdAbs ** 2; share[n] = { sdWithGi: t.sdAbs, sdNoGi: u.sdAbs, giSd: r3(Math.sqrt(Math.max(0, va - vd))), giShareVar: r3(va > 0 ? Math.max(0, va - vd) / va : 0), meanWithGi: t.meanL, meanNoGi: u.meanL }; } out.scenes[`${sc}share`] = share; }
          out.errs = (window.__errs || []).slice(0, 5); out.ms = Math.round(performance.now() - out.t0); out.appliedAfter = describe();   // (the sizes / live flags as they actually were during the takes)
          I.res[tag] = out; I.busy.at = 'saving'; out.saved = await save(file + tag, out); I.busy.at = 'done';
        } catch (e) { I.err = String(e?.stack || e); I.busy.at = 'error'; }
      })();
      return 'started ' + tag;
    },
    /** several runs back to back in THIS boot: [[tag, opts], …] (poll __gim.queue) */
    runs(list) {
      I.queue = { list: list.map(x => x[0]), done: [], at: null }; I.err = null;
      (async () => {
        for (const [tag, opts] of list) {
          I.queue.at = tag; I.run(tag, opts ?? {});
          while (I.busy && !['done', 'error'].includes(I.busy.at)) { for (let k = 0; k < 50; k++) await yieldTask(); }
          if (I.busy.at === 'error') { I.queue.at = 'error:' + tag; return; }
          I.queue.done.push(tag);
        }
        I.queue.at = 'done';
      })();
      return 'queued ' + list.length;
    },
    summary(tag) { const r = I.res[tag]; if (!r) return 'no result ' + tag; return [`${tag} (${r.variant}) ${r.q} ${r.framing} ${JSON.stringify(r.applied?.res)} scale ${r.applied?.scale} gdiv ${r.applied?.gatherDiv} — ${r.ms} ms, errs ${r.errs?.length}`, ...Object.entries(r.scenes).map(([k, m]) => k.endsWith('share') ? `— ${k} (GI's part of the composite flow: sd with / without GI → the GI's own sd, share of variance)\n` + Object.entries(m).map(([n, s]) => `${n.padEnd(11)} ${s.sdWithGi} / ${s.sdNoGi} → gi ${s.giSd} (${(s.giShareVar * 100).toFixed(0)} %)  L ${s.meanWithGi} / ${s.meanNoGi}`).join('\n') : `— ${k}${m.camPan ? ` (pan ${m.camPan} px/f)` : ''}${m.phase ? ` [${m.phase.join('→')}]` : ''}\n` + text(m))].join('\n'); },
  };
  window.__gim = I;
  return 'gi-motion harness ready: await __gim.boot(); __gim.run(tag, {variant}) → __gim.res / __gim.summary(tag)';
})();
