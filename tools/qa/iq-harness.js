// IMAGE-QUALITY program (docs/internal/image-quality.md): the pane-side instrument that grades ONE renderer configuration on one preset — sharpness still /
// motion (the sharp lane's captures, graded offline by sharp-metrics.py), CRAWL (edge-following temporal statistics through a pinned orbit), NOISE (temporal sd of
// still tiles + the ReSTIR dim-penumbra grain of the flickering desk + the lamp-lit floor's crawl), the DYNAMIC-LIGHT scenes of the temporal-jank lane (flicker /
// lightning / torch sweep) and calm COST — under whatever `engine.settings` hold when it is called. Variants are named settings bundles (VARIANTS below); a battery
// = boot → apply(variant) → the instruments → save(json). Dev only: `await import('/qa/iq-harness.js'); await __iq.boot()` on a `?paused&quality=<p>&mute` boot.
//   __iq.apply(name)              settings bundle over the boot defaults (apply('main') = back to them)
//   __iq.crawl(view)              20-frame 0.3°/frame orbit ending on the view's yaw; per frame per world-space edge: profiles across the projected edge → width (10–90 %),
//                                 t50 vs the projected geometric edge; → { widthMotion (px, mean over frames of the per-frame median), posSd (px: temporal sd of the edge's
//                                 sub-pixel position in edge-following coordinates = the crawl), bandSd (normalised luma sd within ±1 px of the edge, likewise), tile hp }
//   __iq.noise()                  still temporal sd (30 renders) of world-anchored tiles on v1 / v3 / cubicles / corridor + tjank A desk lit / dim grain (sq4) + tjank D floor crawl
//   __iq.dyn()                    tjank A (game pattern), B, C summaries — the regression check for the dynamic-light fixes
//   __iq.sharp(tag)               __sh.capAll(tag): the six PNGs sharp-metrics.py grades (docs/shots/ab/sh_<tag>_*)
//   __iq.cost(n)                  calm cubicles still, serialized: union med / p95 + per-pass medians
//   __iq.battery(tag, parts)      all of the above in one fire-and-forget run → __iq.res[tag], posted as docs/perf/iq-<tag>.json
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  if (!window.__sh) { await import('/qa/sharp-harness.js'); for (let i = 0; i < 100 && !window.__sh; i++) await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); }
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  const mean = a => { let s = 0, n = 0; for (const v of a) { if (v === null || v === undefined || Number.isNaN(v)) continue; s += v; n++; } return n ? s / n : NaN; };
  const med = a => { const b = [...a].filter(v => v !== null && !Number.isNaN(v)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const sdOf = a => { const b = a.filter(v => v !== null && v !== undefined && !Number.isNaN(v)); if (b.length < 2) return NaN; const m = mean(b); return Math.sqrt(b.reduce((s, v) => s + (v - m) ** 2, 0) / b.length); };
  const r3 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : +v.toFixed(3);
  // every scripted GAME step renders offscreen exactly once (main.ts presents a burst's last frame only when the document is visible): document.hidden is pinned TRUE for the page's life —
  // re-asserted before every step, because tjank-scenes.js (imported later for the dynamic-light scenes) installs its own getter over the same property
  function pinHidden() { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); } catch (e) { /* */ } }
  pinHidden();
  async function gameStep(dt = 1 / 60) { pinHidden(); window.__runFrames(1, dt, []); await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) throw new Error('no offscreen frame'); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return { w: fr.w, h: fr.h, data: fr.data }; }

  // ------------------------------------------------------------------ variants: settings bundles over the boot defaults
  let S0 = null;   // the settings as the preset left them at boot (apply() starts from these every time)
  const KEEP = ['renderScale', 'maxInternalHeight'];   // (a variant may set the scale explicitly; otherwise the tier's own)
  const VARIANTS = {
    main: {},                                                     // this tree's defaults = main @ 6551c66 + the port with sharp direct off
    old: { taau: false, restir: false, denoiser: 'legacy', froxelVol: false, rtReflect: false, detail: 0, renderScale: 1.0 },   // THE OLD RENDERER (pre-v3 chain, native rows, FXAA)
    sharp: { sharpDirect: true },                                 // B: decoupled resolution
    s085: { renderScale: 0.85 }, s09: { renderScale: 0.9 }, s10: { renderScale: 1.0 }, s077: { renderScale: 0.77 }, s067: { renderScale: 0.67 }, s07: { renderScale: 0.7 }, s06: { renderScale: 0.6 },   // A: resolution policy
    sharp085: { sharpDirect: true, renderScale: 0.85 }, sharp09: { sharpDirect: true, renderScale: 0.9 },
    noMotion: { taauMotionAlpha: 0, taauSharpenMotion: 0 },      // C1's own A/B: tjank's motion terms off
    // C2: history reconstruction under motion (taau.wgsl histSharp = Catmull-Rom + k·(CR − bilinear) while resampled) ± a tighter clip under motion
    c2h05: { taauHistSharp: 0.5 }, c2h1: { taauHistSharp: 1.0 }, c2h1c: { taauHistSharp: 1.0, taauMotionClip: 0.5 }, c2clip: { taauMotionClip: 0.5 },
    // C3: GBAA + jitter off + the TAA as a noise pass — needs a 1 : 1 resolve (sharp direct below scale 1, or scale 1.0 itself); motion weight variants
    c3: { sharpDirect: true, gbaa: true, taauPhases: 0 }, c3a7: { sharpDirect: true, gbaa: true, taauPhases: 0, taauMotionAlpha: 0.7 }, c3a1: { sharpDirect: true, gbaa: true, taauPhases: 0, taauMotionAlpha: 1.0 },
    c3u: { gbaa: true, taauPhases: 0 },                              // (ultra / any scale-1.0 boot: no sharp direct to run)
    c3h: { sharpDirect: true, gbaa: true, taauPhases: 0, taauHistSharp: 1.0 },   // C3 + C2's de-blur
    sharpNoJit: { sharpDirect: true, taauPhases: 0 },               // C3 minus GBAA (what the jitter was buying at 1 : 1)
    // C4: GBAA under the jittered upscaling resolve (the low tiers keep TAAU) ± sharp direct
    c4: { gbaa: true }, c4s: { gbaa: true, sharpDirect: true },
    // D: ReSTIR dim-penumbra grain — the estimator's existing levers first
    d_r5: { restirRays: 5 }, d_r6: { restirRays: 6 }, d_m8: { restirHistory: 8 }, d_m30: { restirHistory: 30 }, d_spAll: { restirSpatialAll: true }, d_sp5: { restirSpatial: 5, restirSpatialAll: true },
    d_noKD: { restirKnownDark: false }, d_aud1: { restirAudit: 1.0 }, d_gradOff: { restirGradient: false }, d_coh: { restirCoherent: true }, d_leader: { restir: false },
    // E: motion identity off (= main's index rule) for the churn scene
    e_nomv: { motionIds: false },
    // the finalists (docs/internal/image-quality.md §3): C2 = the history de-blur; C3jh = sharp direct + GBAA + decoupled jitter + de-blur; c3u = GBAA + jitter off at scale 1.0 (ultra: no internal / output split to decouple)
    c2h05: { taauHistSharp: 0.5 }, mainh: { taauHistSharp: 0.5 },
    c3n: { sharpDirect: true, gbaa: true, taauPhases: 0, taauAlpha: 0.06 }, c3h: { sharpDirect: true, gbaa: true, taauPhases: 0, taauAlpha: 0.06, taauHistSharp: 0.5 },
    c3j: { sharpDirect: true, gbaa: true, sharpDecouple: true }, c3jh: { sharpDirect: true, gbaa: true, sharpDecouple: true, taauHistSharp: 0.5 },
    c3u: { renderScale: 1.0, gbaa: true, taauPhases: 0, taauAlpha: 0.06, taauHistSharp: 0.5 }, c3j09: { renderScale: 0.9, sharpDirect: true, gbaa: true, sharpDecouple: true, taauHistSharp: 0.5 }, c3j085: { renderScale: 0.85, sharpDirect: true, gbaa: true, sharpDecouple: true, taauHistSharp: 0.5 },
    c4s: { sharpDirect: true, gbaa: true }, c4sh: { sharpDirect: true, gbaa: true, taauHistSharp: 0.5 }, c4h: { gbaa: true, taauHistSharp: 0.5 },
    spAll: { restirSpatialAll: true },
    // E2 proxies (global history caps — what a velocity-aware cap would do locally, applied everywhere): the calm-noise price of trading lag this way
    e2cap6: { dnShadowCap: 6 }, e2m8: { restirHistory: 8 }, e2both: { dnShadowCap: 6, restirHistory: 8 }, c3jhSp: { sharpDirect: true, gbaa: true, sharpDecouple: true, taauHistSharp: 0.5, restirSpatialAll: true },
  };
  function apply(name, extra = {}) {
    const v = typeof name === 'string' ? VARIANTS[name] : name; if (!v) throw new Error('variants: ' + Object.keys(VARIANTS).join(' '));
    const s = S(); if (!S0) S0 = JSON.parse(JSON.stringify(s));
    for (const k of Object.keys(S0)) { if (typeof S0[k] === 'object' && S0[k] !== null) continue; s[k] = S0[k]; }   // scalars back to the boot defaults (flags / arrays are never touched by a variant)
    for (const [k, val] of Object.entries({ ...v, ...extra })) { if (!(k in s)) throw new Error('unknown setting ' + k); s[k] = val; }
    if (window.__tj) window.__tj.rescale?.();
    return { name: typeof name === 'string' ? name : 'custom', scale: s.renderScale, sharp: s.sharpDirect, taau: s.taau, restir: s.restir, dn: s.denoiser, froxel: s.froxelVol, gbaa: s.gbaa ?? null, phases: s.taauPhases };
  }
  function describe() { const s = S(); const e = E(); return { res: [e.width, e.height, e.outWidth, e.outHeight], q: window.__quality?.current, scale: s.renderScale, sharp: s.sharpDirect, sharpLive: e.sharpOn, taau: s.taau, phases: s.taauPhases, restir: s.restir, dn: s.denoiser, froxel: s.froxelVol, rt: s.rtReflect, gbaa: s.gbaa ?? null, motionIds: s.motionIds ?? null, motionA: s.taauMotionAlpha, sharpen: s.taauSharpen, sharpenMotion: s.taauSharpenMotion, restirRays: s.restirRays, errs: (window.__errs || []).slice(0, 3) }; }

  // ------------------------------------------------------------------ CRAWL: edge-following statistics through the orbit
  // World-space edges (a → b along the edge; found by projecting the level's boxes onto the sharp lane's hand-placed pixel edges — docs/internal/image-quality.md §1):
  const EDGES = {
    v3: [
      { name: 'partTop', a: [22.5, 1.4, 15.16], b: [23.7, 1.4, 15.16], R: 5 },     // the blue spine partition's top, its far edge against the dark floor beyond (a thin bright strip: THE crawl case)
      { name: 'partTopN', a: [22.5, 1.4, 15.24], b: [23.7, 1.4, 15.24], R: 5 },    // the same strip's near edge (top face | side face)
      { name: 'kbFar', a: [21.62, 0.782, 15.76], b: [21.98, 0.782, 15.76], R: 5 },  // desk A's keyboard, far edge on the desk
    ],
    v1: [
      { name: 'kbTop', a: [26.32, 0.782, 6.31], b: [26.68, 0.782, 6.31], R: 6 },    // the manager's keyboard, far edge: lit desk | key plate
      { name: 'deskFront', a: [25.9, 0.76, 6.75], b: [27.1, 0.76, 6.75], R: 5 },   // the desk's near top edge against the dark floor
      { name: 'kbShadow', a: [26.33, 0.762, 6.505], b: [26.67, 0.762, 6.495], R: 9, kind: 'contact' },   // the keyboard's CONTACT shadow on the desk (lamp side): a soft-but-hard edge — the spatial-reuse bias check, never in the box median
    ],
  };
  const TILES_MOTION = { v3: [['desk', 560, 360, 340, 200], ['penumbra', 1330, 470, 150, 130]], v1: [['litDesk', 560, 440, 300, 200], ['penumbra', 620, 380, 140, 80]] };   // the sharp lane's tiles (1777×1000 output px)
  /** world point → OUTPUT-frame pixel position, SUB-PIXEL (top-left origin, pixel centres at .5): the camera's unjittered view-projection of the frame just rendered. (__perf.projectOut
   *  rounds to whole pixels — a line laid between rounded endpoints jumps half a pixel a frame, which is exactly the quantity measured here.) */
  function projectF(p, fr) {
    const vp = window.__cam.viewProj; const x = p[0], y = p[1], z = p[2];
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0) return null;
    return [(cx / cw * 0.5 + 0.5) * fr.w, (0.5 - cy / cw * 0.5) * fr.h];
  }
  function bilLuma(fr, x, y) {
    x -= 0.5; y -= 0.5;   // (pixel CENTRES sit at .5 in the projected frame; the readback's sample k covers [k, k+1))
    const x0 = Math.floor(x), y0 = Math.floor(y); if (x0 < 0 || y0 < 0 || x0 + 1 >= fr.w || y0 + 1 >= fr.h) return NaN;
    const fx = x - x0, fy = y - y0; const o = (y0 * fr.w + x0) * 4, o2 = o + fr.w * 4;
    return (luma(fr.data, o) * (1 - fx) + luma(fr.data, o + 4) * fx) * (1 - fy) + (luma(fr.data, o2) * (1 - fx) + luma(fr.data, o2 + 4) * fx) * fy;
  }
  /** profiles across the projected edge pa→pb (output px): per profile { width (10–90 % px), t50 (px from the geometric line, signed along the normal), q at −1/0/+1 px } */
  function edgeProfiles(fr, pa, pb, R = 5, step = 0.25) {
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1]; const ln = Math.hypot(dx, dy); if (ln < 4) return [];
    const ux = dx / ln, uy = dy / ln; const nx = -uy, ny = ux;
    const N = Math.max(8, Math.floor(ln / 3)); const ts = []; for (let t = -R; t <= R + 1e-6; t += step) ts.push(t);
    const m = Math.max(2, Math.floor(1.5 / step)); const out = [];
    for (let k = 0; k < N; k++) {
      const f = (k + 0.5) / N; const cx = pa[0] + dx * f, cy = pa[1] + dy * f;
      const p = ts.map(t => bilLuma(fr, cx + nx * t, cy + ny * t)); if (p.some(Number.isNaN)) { out.push(null); continue; }
      let lo = 0, hi = 0; for (let i = 0; i < m; i++) { lo += p[i]; hi += p[p.length - 1 - i]; } lo /= m; hi /= m;
      if (Math.abs(hi - lo) < 6) { out.push(null); continue; }
      let sign = 1; if (hi < lo) { sign = -1; for (let i = 0; i < p.length; i++) p[i] = -p[i]; const t = lo; lo = -t; hi = -hi; }
      const q = p.map(v => (v - lo) / (hi - lo));
      let i50 = -1; for (let i = 0; i < q.length; i++) if (q[i] >= 0.5) { i50 = i; break; }
      if (i50 <= 0) { out.push(null); continue; }
      let i10 = -1; for (let i = i50; i > 0; i--) if (q[i - 1] < 0.1 && q[i] >= 0.1) { i10 = i; break; }
      let i90 = -1; for (let i = i50; i < q.length; i++) if (q[i - 1] < 0.9 && q[i] >= 0.9) { i90 = i; break; }
      if (i10 < 0 || i90 < 0) { out.push(null); continue; }
      const cross = (i, lv) => ts[i - 1] + (ts[i] - ts[i - 1]) * (lv - q[i - 1]) / Math.max(q[i] - q[i - 1], 1e-6);
      const t10 = cross(i10, 0.1), t90 = cross(i90, 0.9), t50 = cross(i50, 0.5);
      const at = t => { const x = (t + R) / step; const i0 = Math.floor(x); const fx = x - i0; return i0 + 1 < q.length ? q[i0] * (1 - fx) + q[i0 + 1] * fx : q[q.length - 1]; };
      out.push({ width: t90 - t10, t50, contrast: (hi - lo) * sign, band: [at(t50 - 1), at(t50), at(t50 + 1)], bandGeo: [at(-1), at(0), at(1)] });
    }
    return out;
  }
  const hpRms = (fr, x, y, w, h) => {   // high-pass RMS (pixel − 3×3 mean) of luma in an output-px tile
    const L = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L[j * w + i] = luma(fr.data, ((y + j) * fr.w + x + i) * 4);
    let s = 0, n = 0; for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { let m = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) m += L[(j + dj) * w + i + di]; m /= 9; const d = L[j * w + i] - m; s += d * d; n++; }
    return Math.sqrt(s / Math.max(1, n));
  };
  /** THE ORBIT: stage `view`, settle at the arc's start, then n game frames turning ddeg each, the last landing on the view's own yaw; every frame read back and graded along the world edges.
   *  opts.still = n frames WITHOUT turning (the same statistics at rest: what part of posSd / bandSd is plain temporal noise) */
  async function crawl(view = 'v3', opts = {}) {
    const { n = 20, ddeg = 0.3, settle = 24, still = false, keepLast = true } = opts;
    const sh = window.__sh; const v = sh.VIEWS[view]; const yaw1 = v.pin.yaw; const edges = EDGES[view] || [];
    await sh.go(view, settle);
    sh.stage(view, still ? yaw1 : yaw1 - n * ddeg * DEG); await __perf.step(2); await __perf.render(settle);
    const per = edges.map(() => []); const hp = {}; for (const [nm] of (TILES_MOTION[view] || [])) hp[nm] = [];
    let last = null;
    for (let i = 1; i <= n; i++) {
      sh.stage(view, still ? yaw1 : yaw1 - (n - i) * ddeg * DEG);
      await gameStep();
      const fr = await readback(); last = fr; const sx = fr.w / 1777, sy = fr.h / 1000;
      edges.forEach((e, ei) => { const pa = projectF(e.a, fr), pb = projectF(e.b, fr); per[ei].push(pa && pb ? edgeProfiles(fr, pa, pb, e.R * sx) : []); });
      for (const [nm, x, y, w, h] of (TILES_MOTION[view] || [])) hp[nm].push(hpRms(fr, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy)));
    }
    // reduce: per edge — widths per frame (median over profiles) → mean; per profile the temporal sd of t50 and of the band values → mean over profiles
    const out = { view, mode: still ? 'still' : 'motion', n, ddeg, res: [E().width, E().height, E().outWidth, E().outHeight], edges: {}, tiles: {} };
    edges.forEach((e, ei) => {
      const frames = per[ei]; const N = Math.max(...frames.map(f => f.length), 0);
      const wPerFrame = frames.map(f => med(f.filter(Boolean).map(p => p.width)));
      const posSd = [], posSdLin = [], bandSd = [], bandGeoSd = [], widthSd = [], lag = [];
      for (let j = 0; j < N; j++) {
        const t50s = frames.map(f => f[j] ? f[j].t50 : null); if (t50s.filter(x => x !== null).length < n * 0.6) continue;
        // the crawl = how much the luma edge wanders about the GEOMETRIC edge (projected exactly, sub-pixel, every frame): the temporal sd of t50 as is (posSd), and about a straight-line fit in
        // time (posSdLin: a lag that drifts smoothly through the take is not crawl); the mean of t50 = how far the picture's edge trails the geometry (lag, signed along the profile)
        const ks = [], ys = []; t50s.forEach((t, k) => { if (t !== null) { ks.push(k); ys.push(t); } });
        const km = mean(ks), ym = mean(ys); let sxy = 0, sxx = 0; for (let q = 0; q < ks.length; q++) { sxy += (ks[q] - km) * (ys[q] - ym); sxx += (ks[q] - km) ** 2; } const slope = sxx > 0 ? sxy / sxx : 0;
        posSd.push(sdOf(ys)); lag.push(ym);
        posSdLin.push(Math.sqrt(mean(ks.map((k, q) => (ys[q] - (ym + slope * (k - km))) ** 2))));
        widthSd.push(sdOf(frames.map(f => f[j] ? f[j].width : null)));
        for (let b = 0; b < 3; b++) { bandSd.push(sdOf(frames.map(f => f[j] ? f[j].band[b] : null))); bandGeoSd.push(sdOf(frames.map(f => f[j] ? f[j].bandGeo[b] : null))); }
      }
      const lastF = frames[frames.length - 1] || [];
      out.edges[e.name] = { widthMotion: r3(mean(wPerFrame)), widthLast: r3(med(lastF.filter(Boolean).map(p => p.width))), widthSd: r3(mean(widthSd)), posSd: r3(mean(posSd)), posSdLin: r3(mean(posSdLin)), lag: r3(mean(lag)), bandSd: r3(mean(bandSd)), bandGeoSd: r3(mean(bandGeoSd)), profiles: N, used: posSd.length, contrast: r3(mean(lastF.filter(Boolean).map(p => Math.abs(p.contrast)))), widths: wPerFrame.map(r3) };
    });
    for (const nm of Object.keys(hp)) out.tiles[nm] = { hpMean: r3(mean(hp[nm])), hpLast: r3(hp[nm][hp[nm].length - 1]) };
    if (keepLast) I.lastFrame = last;
    return out;
  }

  // ------------------------------------------------------------------ NOISE: still tiles (world-anchored) + the two ReSTIR residual cases
  const NOISE_VIEWS = {
    v1: { pin: null /* __sh view */, tiles: { footPenumbra: [[26.55, 0.76, 6.05], 140, 80], litDesk: [[26.5, 0.77, 6.42], 300, 180], kbContact: [[26.5, 0.76, 6.47], 200, 60] } },
    v3: { pin: null, tiles: { desk: [[21.9, 0.77, 15.9], 320, 190], chairPen: [[23.6, 0.02, 16.9], 150, 130], carpet: [[22.6, 0.02, 17.6], 260, 160] } },
    // (tiles anchored by a 2-vector = OUTPUT px at 1000 rows on these fixed pins — placed off a capture; a 3-vector = a world point)
    cub: { pin: [{ look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } }], tiles: { deskLit: [[1075, 118], 280, 140], chairPen: [[600, 800], 260, 180], midFloor: [[900, 660], 300, 150], cartonTop: [[880, 520], 120, 90] } },   // P3's cubicles still: the lit desk (monitor + keyboard), a chair's broad penumbra, the worn lane + the carton's shadow, the carton's marked top
    cor: { pin: [{ look: [27.4, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 8 }, { park: true, player: { pos: [22.0, 0, 11.2], yaw: 1.57, holstered: true, invisible: true } }], tiles: { lino: [[820, 450], 320, 180], cabShadow: [[420, 780], 300, 150] } },   // the corridor lino under the panels; the cabinets' hard shadow edge on it
    brk: { pin: [{ look: [29.1, 0, 14.3], yaw: 0, pitch: 50 * DEG, dist: 6.5 }, { park: true, player: { pos: [22.0, 0, 11.2], yaw: 1.57, holstered: true, invisible: true } }], tiles: { vendLino: [[850, 450], 360, 200], farLino: [[1400, 620], 300, 200], vendFront: [[870, 100], 500, 180] } },   // the two vending fronts on the lino (ReSTIR's two-colour case + their reflections), the dim multi-light lino beyond, the pixel-art fronts themselves
  };
  function tileRect(p, w, h, fr) { const k = fr.h / 1000; const q = p.length === 2 ? [Math.round(p[0] * k), Math.round(p[1] * k)] : __perf.projectOut(p); if (!q) return null; const tw = Math.round(w * k), th = Math.round(h * k); return { x: Math.max(0, Math.min(fr.w - tw, q[0] - (tw >> 1))), y: Math.max(0, Math.min(fr.h - th, q[1] - (th >> 1))), w: tw, h: th }; }
  async function stageNoise(name, settle = 60) {
    const nv = NOISE_VIEWS[name]; window.__menu?.close();
    if (nv.pin) window.__stage(nv.pin[0], nv.pin[1]); else window.__sh.stage(name);
    __perf.still(); await __perf.step(6); __perf.still(); await __perf.render(settle);
  }
  /** per-pixel temporal sd of luma over `frames` still renders, per tile of view `name` → { tile: { sd, sdLow, p99, meanL, absDelta } } — sdLow = the sd of an 8-frame running mean (the SLOW part:
   *  crawl / blotches that drift; frame-to-frame grain averages out of it), absDelta = mean |Δ| between consecutive frames (≈ 1.13 × sd for white noise, ≪ sd for crawl) */
  async function tileNoise(name, frames = 30) {
    await stageNoise(name);
    const nv = NOISE_VIEWS[name]; let rects = null; const acc = {}; let prev = null; const dsum = {}; const RING = 8;
    for (let f = 0; f < frames; f++) {
      await __perf.render(1); const fr = await readback();
      if (!rects) { rects = {}; for (const [tn, [p, w, h]] of Object.entries(nv.tiles)) rects[tn] = tileRect(p, w, h, fr); }
      const cur = {};
      for (const [tn, r] of Object.entries(rects)) {
        if (!r) continue; const n = r.w * r.h;
        if (!acc[tn]) { acc[tn] = { s1: new Float64Array(n), s2: new Float64Array(n), ring: [], rsum: new Float64Array(n), l1: new Float64Array(n), l2: new Float64Array(n), ln: 0 }; dsum[tn] = { d: 0, c: 0 }; }
        const a = acc[tn]; const L = new Float32Array(n);
        for (let j = 0; j < r.h; j++) { let o = ((r.y + j) * fr.w + r.x) * 4; for (let i = 0; i < r.w; i++, o += 4) { const v = luma(fr.data, o); const k = j * r.w + i; L[k] = v; a.s1[k] += v; a.s2[k] += v * v; } }
        a.ring.push(L); for (let k = 0; k < n; k++) a.rsum[k] += L[k];
        if (a.ring.length > RING) { const old = a.ring.shift(); for (let k = 0; k < n; k++) a.rsum[k] -= old[k]; }
        if (a.ring.length === RING) { for (let k = 0; k < n; k++) { const m = a.rsum[k] / RING; a.l1[k] += m; a.l2[k] += m * m; } a.ln++; }
        cur[tn] = L; if (prev && prev[tn]) { let d = 0; for (let k = 0; k < n; k++) d += Math.abs(L[k] - prev[tn][k]); dsum[tn].d += d / n; dsum[tn].c++; }
      }
      prev = cur;
    }
    const out = {};
    for (const [tn, a] of Object.entries(acc)) {
      const n = a.s1.length; const sds = new Float32Array(n); let ml = 0, sl = 0;
      for (let k = 0; k < n; k++) { const m = a.s1[k] / frames; ml += m; sds[k] = Math.sqrt(Math.max(0, a.s2[k] / frames - m * m)); if (a.ln > 1) { const lm = a.l1[k] / a.ln; sl += Math.sqrt(Math.max(0, a.l2[k] / a.ln - lm * lm)); } }
      const sorted = Float32Array.from(sds).sort();
      out[tn] = { sd: r3(mean(sds)), sdLow: r3(a.ln > 1 ? sl / n : null), p99: r3(sorted[Math.floor(0.99 * (n - 1))]), meanL: r3(ml / n), absDelta: r3(dsum[tn].d / Math.max(1, dsum[tn].c)), rect: rects[tn] };
    }
    return out;
  }
  async function ensureTj() { if (!window.__tj) { await import('/qa/tjank-scenes.js'); for (let i = 0; i < 100 && !window.__tj; i++) await yieldTask(); await window.__tj.boot(); } pinHidden(); window.__tj.rescale(); }
  /** the tjank variant whose four switches (restir / denoiser / froxel / taau) match the CURRENT settings — tj's run() re-applies them by name, so a variant of ours with one of them off must run
   *  under the matching tj name or it would be measured with the switch back on (every other setting persists through tj's run untouched) */
  function tjVariant() {
    const s = S(); const key = `${s.restir ? 1 : 0}${s.denoiser === 'v3' ? 1 : 0}${s.froxelVol ? 1 : 0}${s.taau ? 1 : 0}`;
    return ({ '1111': 'v3', '0111': 'noRestir', '1011': 'legacyDn', '1101': 'noFroxel', '1110': 'noTaau', '0001': 'taauOnly', '0000': 'allOff' })[key] ?? 'v3';
  }
  /** the noise battery: still tiles on five views + tjank A (sq4) desk / rugN lit · dim grain + tjank D lamp-lit floor crawl — all under the CURRENT settings */
  async function noise(opts = {}) {
    const { views = ['v1', 'v3', 'cub', 'cor', 'brk'], frames = 30, tj = true } = opts;
    const out = { tiles: {}, desc: describe() };
    for (const v of views) out.tiles[v] = await tileNoise(v, frames);
    if (tj) {
      await ensureTj(); const T = window.__tj;
      const keep = { restir: S().restir, denoiser: S().denoiser, froxelVol: S().froxelVol, taau: S().taau, renderScale: S().renderScale };
      const tv = tjVariant();
      // the GRAIN at rest: scene A's tube held STEADY at its dim level (0.15) and at full — the sd within a level then is the estimator's own noise on the desk / rug / chair under it, with none of a
      // strobe's transition dynamics mixed in (dyn() runs the strobing patterns for the tracking numbers)
      const Ad = await T.run('A', tv, { shots: false, pattern: 'steady', level: 0.15, frames: 40, as: 'iqDim' });
      const Al = await T.run('A', tv, { shots: false, pattern: 'steady', level: 1, frames: 40, as: 'iqLit' });
      const D = await T.run('D', tv, { shots: false, as: 'iq' });
      Object.assign(S(), keep);   // (tj's applyVariant('v3') forces the four switches ON: a variant that had one off gets it back)
      const lv = (t, key) => t?.byLevel?.[key]?.sdWithin ?? null; const mm = (t, key) => t?.byLevel?.[key]?.meanOfMeans ?? null;
      out.deskGrain = { lit: lv(Al.tiles.desk, '1'), dim: lv(Ad.tiles.desk, '0.15'), litMean: mm(Al.tiles.desk, '1'), dimMean: mm(Ad.tiles.desk, '0.15'), steady: true };
      out.rugN = { lit: lv(Al.tiles.rugN, '1'), dim: lv(Ad.tiles.rugN, '0.15'), litMean: mm(Al.tiles.rugN, '1'), dimMean: mm(Ad.tiles.rugN, '0.15') };
      out.chairN = { lit: lv(Al.tiles.chairN, '1'), dim: lv(Ad.tiles.chairN, '0.15') };
      out.floorGlass = { sd: D.tiles.floorGlass?.sdAll ?? null, absDelta: D.tiles.floorGlass?.meanAbsDelta ?? null, desks: D.tiles.desks?.sdAll ?? null };
    }
    return out;
  }
  /** the dynamic-light scenes (tjank A game pattern, B, C) under the current settings → the tracking numbers the tjank doc tabulates */
  async function dyn(opts = {}) {
    await ensureTj(); const T = window.__tj; const out = { desc: describe() };
    const keep = { restir: S().restir, denoiser: S().denoiser, froxelVol: S().froxelVol, taau: S().taau, renderScale: S().renderScale };
    const tv = tjVariant();
    const A = await T.run('A', tv, { shots: false, pattern: 'game', as: 'iq' });
    const lv = (t, key) => t?.byLevel?.[key] ?? {};
    out.A = { rugN: { lit: lv(A.tiles.rugN, '1').meanOfMeans, dim: lv(A.tiles.rugN, '0.15').meanOfMeans, sdLit: lv(A.tiles.rugN, '1').sdWithin, sdDim: lv(A.tiles.rugN, '0.15').sdWithin }, desk: { lit: lv(A.tiles.desk, '1').meanOfMeans, dim: lv(A.tiles.desk, '0.15').meanOfMeans, sdLit: lv(A.tiles.desk, '1').sdWithin, sdDim: lv(A.tiles.desk, '0.15').sdWithin } };
    Object.assign(S(), keep);
    if (opts.B !== false) { const B = await T.run('B', tv, { shots: false, as: 'iq' }); Object.assign(S(), keep); const fg = B.tiles.floorGlass.mean, dk = B.tiles.desks.mean; out.B = { floorGlass: fg.slice(3, 13).map(r3), flash: r3(fg[4]), second: r3(fg[10]), desksFlash: r3(dk[4]), desksNext: r3(dk[5]) }; }
    if (opts.C !== false) { const C = await T.run('C', tv, { shots: false, as: 'iq' }); Object.assign(S(), keep); const hz = C.tiles.haze.mean; out.C = { hazeMid: [24, 26, 28, 30, 32, 34].map(k => r3(hz[k])), boxArrive: [2, 4, 6, 8, 10].map(k => r3(C.tiles.box.mean[k])), beamFloorSd: C.tiles.beamFloor.sdAll }; }
    return out;
  }
  const sharp = tag => window.__sh.capAll(tag);
  // ------------------------------------------------------------------ PAGE CROPS: ×3 stills + a 3-frame motion strip of the telling regions, under the current settings
  /** crop `w×h` output px (at 1000 rows) centred on world point p of readback fr, ×scale nearest → posted as <name>.jpg */
  async function cropAt(name, fr, p, w, h, scale = 3) {
    const k = fr.h / 1000; const q = p.length === 2 ? [p[0] * k, p[1] * k] : projectF(p, fr); if (!q) return null;
    const cw = Math.round(w * k), ch = Math.round(h * k); const x = Math.max(0, Math.min(fr.w - cw, Math.round(q[0] - cw / 2))), y = Math.max(0, Math.min(fr.h - ch, Math.round(q[1] - ch / 2)));
    return __perf.crop(name, x, y, cw, ch, scale, 0.9, fr);
  }
  const PAGE_CROPS = {
    v3: [['partTop', [23.1, 1.4, 15.2], 110, 80], ['kb', [21.8, 0.78, 15.83], 130, 90], ['chairPen', [23.6, 0.02, 16.9], 150, 110]],
    v1: [['kbV1', [26.5, 0.78, 6.36], 150, 100], ['contact', [26.5, 0.76, 6.47], 150, 80]],
  };
  /** stills (settled `settle`) + the last three MOVING frames of the orbit for view v3 / v1, and the vending fronts still: iqp_<tag>_<crop>_{s,m1,m2,m3}.jpg */
  async function pageCrops(tag, opts = {}) {
    const { settle = 100, n = 20, ddeg = 0.3 } = opts; const sh = window.__sh; const out = [];
    for (const view of ['v3', 'v1']) {
      const v = sh.VIEWS[view]; const yaw1 = v.pin.yaw;
      await sh.go(view, settle); let fr = await readback();
      for (const [nm, p, w, h] of PAGE_CROPS[view]) out.push(await cropAt(`iqp_${tag}_${nm}_s`, fr, p, w, h));
      sh.stage(view, yaw1 - n * ddeg * DEG); await __perf.step(2); await __perf.render(24);
      for (let i = 1; i <= n; i++) { sh.stage(view, yaw1 - (n - i) * ddeg * DEG); await gameStep(); if (i > n - 3) { fr = await readback(); for (const [nm, p, w, h] of PAGE_CROPS[view]) out.push(await cropAt(`iqp_${tag}_${nm}_m${i - (n - 3)}`, fr, p, w, h)); } }
    }
    { const nv = NOISE_VIEWS.brk; window.__stage(nv.pin[0], nv.pin[1]); __perf.still(); await __perf.step(6); __perf.still(); await __perf.render(settle); const fr = await readback(); out.push(await cropAt(`iqp_${tag}_vend_s`, fr, [880, 105], 300, 200, 2)); out.push(await cropAt(`iqp_${tag}_vendLino_s`, fr, [850, 450], 300, 180, 3)); }
    return out;
  }
  async function cost(n = 30, warm = 10) { await __pf.stageStill(); await __perf.render(20); return window.__sh.cost(n, warm); }
  /** save any object as docs/perf/<name>.json through the shot sink */
  async function save(name, obj) { const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } }); return r.status; }
  const I = {
    VARIANTS, EDGES, NOISE_VIEWS, res: {}, busy: null, err: null, lastFrame: null,
    async boot() { const b = await window.__sh.boot(); if (!S0) S0 = JSON.parse(JSON.stringify(S())); window.__pauseLoop = true; return { ...b, port: window.__shotPort }; },
    apply, describe, crawl, noise, dyn, sharp, cost, save, tileNoise, edgeProfiles, gameStep, readback, pageCrops, cropAt, projectF: (p, fr) => projectF(p, fr),
    /** everything for one variant on this boot's preset, fire-and-forget: parts ⊂ ['crawl','still','sharp','noise','dyn','cost']; → __iq.res[tag] (+ docs/perf/iq-<tag>.json) */
    battery(tag, variant = 'main', parts = ['crawl', 'still', 'sharp', 'noise', 'dyn', 'cost'], extra = {}) {
      I.busy = { tag, at: 'start' }; I.err = null;
      (async () => {
        try {
          const out = { ...(I.res[tag] || {}), tag, variant, applied: apply(variant, extra), q: window.__quality?.current, t0: performance.now() };   // (parts accumulate: a later battery on the same tag adds to / refreshes what an earlier one measured)
          out.desc = describe();
          if (parts.includes('crawl')) { I.busy.at = 'crawl'; out.crawl = { v3: await crawl('v3'), v1: await crawl('v1') }; }
          if (parts.includes('still')) { I.busy.at = 'still'; out.still = { v3: await crawl('v3', { still: true }), v1: await crawl('v1', { still: true }) }; }
          if (parts.includes('sharp')) { I.busy.at = 'sharp'; out.sharp = await sharp(tag); }
          if (parts.includes('noise')) { I.busy.at = 'noise'; out.noise = await noise(); }
          if (parts.includes('dyn')) { I.busy.at = 'dyn'; out.dyn = await dyn(); }
          if (parts.includes('cost')) { I.busy.at = 'cost'; out.cost = await cost(); }
          if (parts.includes('crops')) { I.busy.at = 'crops'; out.crops = await pageCrops(tag); }
          out.errs = (window.__errs || []).slice(0, 5); out.ms = Math.round(performance.now() - out.t0);
          I.res[tag] = out; I.busy.at = 'saving'; out.saved = await save('iq-' + tag + '.' + parts.join('+'), out); I.busy.at = 'done';   // (one file per battery: tools/qa/iq-report.py merges every iq-<tag>.*.json of a tag, so a page reload never costs an earlier part)
        } catch (e) { I.err = String(e?.stack || e); I.busy.at = 'error'; }
      })();
      return 'started ' + tag;
    },
    /** several batteries back to back: [[tag, variant, parts?, extra?], …] */
    batteries(list) {
      I.queue = { list: list.map(x => x[0]), done: [], at: null }; I.err = null;
      (async () => {
        for (const [tag, variant, parts, extra] of list) {
          I.queue.at = tag; I.battery(tag, variant, parts ?? undefined, extra ?? {});
          while (I.busy && !['done', 'error'].includes(I.busy.at)) { for (let k = 0; k < 50; k++) await yieldTask(); }
          if (I.busy.at === 'error') { I.queue.at = 'error:' + tag; return; }
          I.queue.done.push(tag);
        }
        I.queue.at = 'done';
      })();
      return 'queued ' + list.length;
    },
    /** compact text of a result */
    /** A WHOLE TIER in one fire-and-forget call (poll __iq.tierAt): batteries → chaos scenes (goAll list) → the stress-minute A/B pairs [[nameA, nameB], …] → saved as
     *  iq-<tier>-stress.json { pairs: [{a, b, A, B, res, text}] }. The stress scene rearranges the game (QRF, smoke, rain), so it runs LAST and the page is spent after it. */
    tier(tier, { batteries: bl = [], chaos = [], stress = [] } = {}) {
      I.tierAt = 'batteries'; I.tierErr = null;
      (async () => {
        try {
          for (const [tag, variant, parts, extra] of bl) {
            I.tierAt = 'battery ' + tag; I.battery(tag, variant, parts, extra || {});   // (battery is fire-and-forget: wait on its busy flag like batteries() does)
            while (I.busy && !['done', 'error'].includes(I.busy.at)) { for (let k = 0; k < 50; k++) await yieldTask(); }
            if (I.busy.at === 'error') throw new Error('battery ' + tag + ': ' + I.err);
          }
          if (chaos.length) {
            if (!window.__chaos) { await import('/qa/chaos-scenes.js'); for (let i = 0; i < 200 && !window.__chaos; i++) await yieldTask(); }
            await window.__chaos.boot(); I.tierAt = 'chaos';
            window.__chaos.goAll(tier, chaos);
            while (window.__chaos.all.at !== 'done' && window.__chaos.all.at !== 'error') { for (let i = 0; i < 50; i++) await yieldTask(); }
            if (window.__chaos.err) throw new Error('chaos: ' + window.__chaos.err);
          }
          if (stress.length) {
            I.tierAt = 'stress setup';
            if (!window.__stress) { await import('/qa/stress-scene.js'); for (let i = 0; i < 200 && !window.__stress; i++) await yieldTask(); }
            I.apply(stress[0][0]); await window.__stress.setup({ fight: false });
            const pairs = [];
            for (const [a, b] of stress) { I.tierAt = `stress ${a} vs ${b}`; const r = await window.__sh.stressAB(() => I.apply(a), () => I.apply(b), { blocks: 4, per: 70 }); pairs.push({ a, b, ...r }); await save(`iq-${tier}-stress`, { tier, pairs }); }
          }
          I.tierAt = 'done';
        } catch (e) { I.tierErr = String(e?.stack || e); I.tierAt = 'error'; }
      })();
      return 'tier ' + tier + ' started';
    },
    text(tag) {
      const r = I.res[tag]; if (!r) return 'no result ' + tag;
      const L = [`${tag} (${r.variant}) ${r.q} ${JSON.stringify(r.desc?.res)} scale ${r.desc?.scale} sharp ${r.desc?.sharp} gbaa ${r.desc?.gbaa} phases ${r.desc?.phases} — ${r.ms} ms, errs ${r.errs?.length}`];
      for (const mode of ['crawl', 'still']) if (r[mode]) for (const v of Object.keys(r[mode])) { const c = r[mode][v]; L.push(`${mode} ${v}: ` + Object.entries(c.edges).map(([n, e]) => `${n} w ${e.widthMotion}/${e.widthLast} pos ${e.posSd} band ${e.bandSd}`).join(' · ') + ' | ' + Object.entries(c.tiles).map(([n, t]) => `${n} hp ${t.hpMean}`).join(' ')); }
      if (r.noise) { L.push('noise: ' + Object.entries(r.noise.tiles).map(([v, ts]) => v + ' ' + Object.entries(ts).map(([n, t]) => `${n} ${t.sd}`).join(' ')).join(' | ')); L.push(`grain desk lit/dim ${r.noise.deskGrain?.lit}/${r.noise.deskGrain?.dim} rugN ${r.noise.rugN?.lit}/${r.noise.rugN?.dim} floorGlass ${r.noise.floorGlass?.sd}`); }
      if (r.dyn) L.push(`dyn A rugN ${r.dyn.A.rugN.lit}/${r.dyn.A.rugN.dim} sd ${r.dyn.A.rugN.sdLit}/${r.dyn.A.rugN.sdDim} · B flash ${r.dyn.B?.flash} 2nd ${r.dyn.B?.second} desks ${r.dyn.B?.desksFlash} · C haze ${r.dyn.C?.hazeMid?.join(' ')}`);
      if (r.cost) L.push(`cost ∪ ${r.cost.unionMed} (p95 ${r.cost.unionP95}) Σ ${r.cost.sumMed} wall ${r.cost.wallMed} @${r.cost.res} · ` + Object.entries(r.cost.passes).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(' '));
      return L.join('\n');
    },
  };
  window.__iq = I;
  return 'iq harness ready: await __iq.boot(); __iq.battery(tag, variant) → __iq.res / __iq.text(tag)';
})();
