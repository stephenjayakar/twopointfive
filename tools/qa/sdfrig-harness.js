// SDF CHARACTER RIG (branch exp/sdf-characters) — the pane-side instrument. Dev only: `await import('/qa/sdfrig-harness.js')` on a `?paused&quality=<preset>&mute` boot
// (pulls in p5-harness.js → perf / pf / p4, and chaos-scenes.js → iq) → window.__sr:
//   V / apply(name)            the variants: cone (round-cone any-hit — what every ray runs since the capsule cleanup, 2026-08-11) · mesh (ultra's mesh shadows) · softA / softM / softMS
//                              (the soft-shadow character visibility: analytic · marched · marched over the smooth union) · smooth (smooth-union closest hit in reflections) · meshRefl.
//                              RETIRED: cap (the 15 hand capsules) and coneLoose (the 1.5 m cull sphere) — the capsule test and the sdfRig / sdfRigTight settings are gone from the
//                              tree (2026-08-11), so those two variants no longer exist here and apply('cap') throws; the recorded batteries (docs/perf/sr-*.json) keep their cap columns,
//                              which sdfrig-page.py labels from the JSON itself
//   views / go(view)           staged stills: lamp (a man under a 6 cm spot 1.25 m up on the corridor lino), torch (chaos P0's fixed torch + a man in its beam), lino (a torch-lit man mirrored in
//                              the corridor lino, low camera), lobby4 (p5's four men on the stone)
//   still(view, variants, {debug, tiles})   crops ×3 per variant of the view's tiles (composite or a debug view) → this lane's sink (window.__shotPort 5189)
//   profile(view, line, variants)           mean luma profile across a shadow edge (world segment a → b, N samples, K renders) per variant → 10–90 % width px, midpoint, plateau levels
//   sdTiles(view, variants)                 temporal sd (8-bit luma) of the view's tiles over 30 still renders per variant
//   costAB(vA, vB, view)                    interleaved serialized per-pass medians + union (p5's costAB) between two variants on a view
//   dyn(scene, variants)                    a chaos scene (P0 / P3 / PL lamp strafe / PT torch sweep) under the history-free reference then each variant: lag / trail / residue rows + crops
//   identityHash(view)                      p5's deterministic-still FNV hash (OFF identity vs main served beside)
//   validate()                              GPU validation sweep: presets × the switches × mesh on/off × debug views
(async () => {
  if (!window.__p5) { await import('/qa/p5-harness.js'); for (let i = 0; i < 300 && !window.__p5; i++) await new Promise(r => setTimeout(r, 20)); }
  if (!window.__chaos) { await import('/qa/chaos-scenes.js'); for (let i = 0; i < 300 && !window.__chaos; i++) await new Promise(r => setTimeout(r, 20)); }
  window.__testVisible = true;
  window.__shotPort = 5189;
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];

  // ---- variants: settings written over BASE (this lane's extras off) — the rest of the renderer as the boot / preset left it. NOTE since the capsule cleanup: no preset apply()
  // clears sdfRigSmooth / charSoftShadow any more, so a variant applied here RIDES INTO any other harness's battery run on the same page — apply('cone') before handing it over
  const BASE = { sdfRigSmooth: false, charSoftShadow: false, charSoftAnalytic: true, charSoftSmooth: false, meshShadows: false, rtMeshHits: false, directHistory: 0.5, taau: true, restirHistory: 20 };
  const V = {
    cone: {},                                                         // the fitted round cones in every ray's character test (the tree's one path; 'cap' / 'coneLoose' retired with the capsule cleanup)
    mesh: { meshShadows: true },                                      // ultra's mesh-traced shadows: the SHAPE reference
    softA: { charSoftShadow: true, charSoftAnalytic: true },          // (iii) analytic per-cone clearance
    softM: { charSoftShadow: true, charSoftAnalytic: false },         // (iii) sphere-marched field, plain union
    softMS: { charSoftShadow: true, charSoftAnalytic: false, charSoftSmooth: true },   // (iii) marched over the smooth union
    smooth: { sdfRigSmooth: true },                                   // (ii) smooth-union closest hit in the reflection pass
    meshRefl: { meshShadows: true, rtMeshHits: true },                // ultra: mesh closest hit in reflections (+ mesh shadows)
    softMesh: { charSoftShadow: true, charSoftAnalytic: true, meshShadows: true },   // soft in the direct pass, mesh everywhere else (what ultra + iii would run)
    // diagnostics: which temporal stage holds a drawn shadow back (each = softA / cone with one history off; BASE puts the three back to 'high')
    softA_noShT: { charSoftShadow: true, charSoftAnalytic: true, directHistory: 0 },
    softA_noTaa: { charSoftShadow: true, charSoftAnalytic: true, taau: false },
    softA_noRsT: { charSoftShadow: true, charSoftAnalytic: true, restirHistory: 1 },
    cone_noShT: { directHistory: 0 },
    cone_noTaa: { taau: false },
  };
  function apply(name, extra = {}) { const v = typeof name === 'string' ? V[name] : name; if (!v) throw new Error('variants: ' + Object.keys(V).join(' ')); Object.assign(S(), BASE, v, extra); return name; }

  // ---- a desk-lamp-like emitter of our own over open lino (kind 1 spot, 6 cm bezel, 1.25 m up, pointing down): the small-emitter case without a desk in the pool
  let lamp = null, torch = null;
  function lampOn(on, pos = [21.7, 1.55, 11.15], dir = [-0.55, -0.83, 0.0]) {
    if (!lamp) { const d = [0.15, -0.97, 0.18]; const l = Math.hypot(...d); lamp = E().lights.add({ name: 'srLamp', group: 'test', kind: 1, pos: [...pos], dir: d.map(x => x / l), color: [1.0, 0.78, 0.5], intensity: 14, range: 7, innerDeg: 35, outerDeg: 65, radius: 0.06, volumetric: 0.3, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 14, card: false }); }
    lamp.pos = [...pos]; { const l = Math.hypot(...dir); lamp.dir = dir.map(x => x / l); } lamp.enabled = on; return lamp;
  }
  function torchOn(on) {   // = chaos-scenes' fixed corridor torch (its numbers), our own record so the two harnesses never fight over one light
    if (!torch) { const d = [-0.26, -0.30, -0.92]; const l = Math.hypot(...d); torch = E().lights.add({ name: 'srTorch', group: 'test', kind: 1, pos: [23.5, 1.05, 11.8], dir: d.map(x => x / l), color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70, card: true }); }
    torch.enabled = on; return torch;
  }
  const park = { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true };
  // ---- views (pin + staging + tiles in OUTPUT px of a 1777×1000 frame, or world-anchored [[x,y,z], w, h])
  const VIEWS = {
    // a man standing 0.9 m west of the small lamp (1.55 m up, 6 cm bezel, tipped west) on the corridor lino, camera above him looking west: his shadow runs 3 m up the corridor —
    // contact-hard at the shoes, a hand's width of penumbra at the head — and his arms' shadows climb both walls
    lamp: { pin: { look: [19.5, 0.05, 11.1], yaw: 88 * DEG, pitch: 58 * DEG, dist: 5.0 }, guards: [{ i: 0, pos: [20.8, 0, 11.15], yaw: -1.57, torch: false }], lights: () => { lampOn(true); torchOn(false); },
      tiles: { near: [[19.95, 0.02, 11.1], 340, 230], mid: [[19.4, 0.02, 11.1], 380, 250], far: [[18.6, 0.02, 11.1], 420, 280], wallS: [[19.6, 0.7, 10.22], 300, 240] },
      // profile lines: from the lit lino south of the shadow INTO it, at three distances up the shadow (0.75 / 1.4 / 2.3 m behind the man: shins · trunk · head end)
      lines: { near: { a: [20.05, 0.02, 10.62], b: [20.05, 0.02, 11.1] }, mid: { a: [19.4, 0.02, 11.84], b: [19.4, 0.02, 11.15] }, far: { a: [18.5, 0.02, 11.86], b: [18.5, 0.02, 11.15] } } },   // (mid / far come in from the NORTH lino: south of the trunk's shadow the arm's shadow leaves only a hand's width of lit floor to start from)
    // the same staging seen from the WEST looking back east at the man (the lamp behind him): the NEAR stretch of the shadow — the shins' — lies between the camera and him
    lampW: { pin: { look: [20.15, 0.1, 11.1], yaw: -88 * DEG, pitch: 42 * DEG, dist: 3.6 }, guards: [{ i: 0, pos: [20.8, 0, 11.15], yaw: -1.57, torch: false }], lights: () => { lampOn(true); torchOn(false); },
      tiles: { near: [[20.3, 0.02, 11.12], 420, 300], feet: [[20.6, 0.02, 11.12], 320, 240] },
      lines: { near: { a: [20.3, 0.02, 10.62], b: [20.3, 0.02, 11.02] }, contact: { a: [20.55, 0.02, 10.7], b: [20.55, 0.02, 10.98] } } },
    // chaos P0's torch fixed in the corridor + a man standing in its beam: his hard shadow on the north wall and the lino behind him
    torch: { pin: { look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, guards: [{ i: 0, pos: [23.15, 0, 11.0], yaw: 1.4, torch: false }], lights: () => { torchOn(true); lampOn(false); },
      tiles: { wall: [[22.95, 0.9, 10.22], 400, 360], lino: [[23.1, 0.02, 10.7], 400, 280] },
      lines: { wall: { a: [23.05, 0.5, 10.21], b: [22.3, 0.5, 10.21] }, wallLow: { a: [23.05, 0.3, 10.21], b: [22.3, 0.3, 10.21] } } },   // (across the man's shadow on the south wall from the lit east side, at two heights; the lino behind him is nearly all shadow — no clean edge to walk)
    // the mirror image of a torch-lit man in the corridor lino (rough 0.22): camera low, looking west along the corridor, the man 3 m off facing it, chaos torch lighting him from behind-left
    lino: { pin: { look: [21.6, 0.45, 10.55], yaw: 90 * DEG, pitch: 13 * DEG, dist: 5.2 }, guards: [{ i: 0, pos: [21.5, 0, 10.45], yaw: 1.57, torch: true, aimPitch: -0.5 }], lights: () => { torchOn(false); lampOn(true, [22.7, 1.6, 11.3], [-0.6, -0.55, -0.45]); },
      tiles: { image: [[22.9, 0.02, 10.45], 480, 300], feet: [[21.95, 0.02, 10.45], 380, 230] } },   // (he stands on the south LINO strip — the runner down the middle is matte carpet — lit from the front by our lamp, torch in hand)
    lobby4: { pin: __p5.VIEWS.lobby4.pin, guards: __p5.VIEWS.lobby4.guards, player: __p5.VIEWS.lobby4.player, groups: ['lobby'], lights: () => { torchOn(false); lampOn(false); },
      tiles: { manA: [1050, 540, 250, 360], shadowA: [[8.9, 0.02, 20.4], 360, 260], stone: [80, 585, 300, 210] } },
  };
  let litGroups = [];
  async function go(name, settle = 40) {
    const v = VIEWS[name]; if (!v) throw new Error('views: ' + Object.keys(VIEWS).join(' '));
    window.__menu?.close();
    window.__stage(v.pin, { park: true, guards: v.guards ?? [], player: v.player ?? park });
    const g = G(); g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); for (const s of v.guards ?? []) { const gd = g.guards[s.i]; if (gd) gd.lightDeadUntil = s.torch ? 0 : 1e9; }
    for (const gr of litGroups) if (!(v.groups ?? []).includes(gr)) g.setGroup(gr, false);
    for (const gr of v.groups ?? []) g.setGroup(gr, true);
    litGroups = [...(v.groups ?? [])];
    v.lights?.();
    __perf.still(); await __perf.step(4); await __perf.render(settle);
    return `${name} staged at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  function rectOf(t, fr) {   // tile spec → OUTPUT px rect
    if (Array.isArray(t[0])) { const q = __perf.projectOut(t[0]); if (!q) return null; const k = fr.h / 1000; const w = Math.round(t[1] * k), h = Math.round(t[2] * k); return { x: Math.max(0, Math.min(fr.w - w, q[0] - (w >> 1))), y: Math.max(0, Math.min(fr.h - h, q[1] - (h >> 1))), w, h }; }
    const sx = fr.w / 1777, sy = fr.h / 1000; return { x: Math.round(t[0] * sx), y: Math.round(t[1] * sy), w: Math.round(t[2] * sx), h: Math.round(t[3] * sy) };
  }
  /** crops ×k of the view's tiles per variant (view staged once; each variant re-settles `settle` renders): sr_<prefix>_<view>_<tile>_<variant>.jpg */
  async function still(view, variants = ['cone', 'mesh'], opts = {}) {
    const { debug = 0, settle = 40, k = 3, prefix = 'st', tiles = null } = opts;
    await go(view, 8); const out = {}; const s = S();
    for (const vn of variants) {
      apply(vn); s.debugView = debug; await __perf.render(settle);
      const fr = await __perf.readback(); out[vn] = [];
      for (const [tn, t] of Object.entries(VIEWS[view].tiles)) { if (tiles && !tiles.includes(tn)) continue; const r = rectOf(t, fr); if (!r) continue; out[vn].push(await __perf.crop(`sr_${prefix}_${view}_${tn}_${vn}${debug ? '_d' + debug : ''}`, r.x, r.y, r.w, r.h, k, 0.92, fr)); }
    }
    s.debugView = 0; apply('cone');
    return out;
  }
  /** whole-frame shot of the current state */
  const shot = (name, q = 0.9) => window.__shot(name, q);

  /** Mean 8-bit luma profile ACROSS a shadow edge: N samples along the world segment a → b (bilinear in the readback), averaged over K settled renders per variant; per variant the
   *  10–90 % transition width in OUTPUT px (of the monotone fit between the two plateaus), the 50 % crossing position (px along the line) and the plateau levels. */
  async function profile(view, line, variants = ['cone', 'mesh', 'softA', 'softM'], opts = {}) {
    const { N = 96, K = 12, settle = 40, debug = 0, stage = true } = opts;
    if (stage) await go(view, 8);
    const s = S(); const out = { line, res: null, rows: {} };
    for (const vn of variants) {
      apply(vn); s.debugView = debug; await __perf.render(settle);
      const acc = new Float64Array(N); let pa = null, pb = null, fr0 = null;
      for (let kk = 0; kk < K; kk++) {
        await __perf.render(1); const fr = await __perf.readback(); fr0 = fr;
        pa = __perf.projectOut(line.a); pb = __perf.projectOut(line.b); if (!pa || !pb) break;
        for (let i = 0; i < N; i++) { const u = i / (N - 1); const x = pa[0] + (pb[0] - pa[0]) * u, y = pa[1] + (pb[1] - pa[1]) * u; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0; const L = (xx, yy) => luma(fr.data, (Math.max(0, Math.min(fr.h - 1, yy)) * fr.w + Math.max(0, Math.min(fr.w - 1, xx))) * 4); acc[i] += L(x0, y0) * (1 - fx) * (1 - fy) + L(x0 + 1, y0) * fx * (1 - fy) + L(x0, y0 + 1) * (1 - fx) * fy + L(x0 + 1, y0 + 1) * fx * fy; }
      }
      if (!pa) { out.rows[vn] = { error: 'off screen' }; continue; }
      const prof = Array.from(acc, v => v / K); const lenPx = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); const pxPer = lenPx / (N - 1);
      // the line runs from the LIT side into the shadow: lit plateau = mean of the first eighth, dark level = the darkest sample (the walk stops there, so a line that comes out
      // the far side of a shin's shadow still measures its near edge); crossings walked from the lit end
      const nE = Math.max(2, Math.floor(N / 8)); const hi = prof.slice(0, nE).reduce((a, b) => a + b, 0) / nE;
      let iMin = 0; for (let i = 1; i < N; i++) if (prof[i] < prof[iMin]) iMin = i; const lo = prof[iMin];
      const at = f => { const lvl = lo + (hi - lo) * f; for (let i = 1; i <= iMin; i++) { const a = prof[i - 1], b = prof[i]; if (a >= lvl && b < lvl) { return (i - 1 + (a - lvl) / (a - b)) * pxPer; } } return NaN; };
      const x90 = at(0.9), x50 = at(0.5), x10 = at(0.1);
      out.rows[vn] = { width1090: +Math.abs(x10 - x90).toFixed(2), mid: +x50.toFixed(2), dark: +lo.toFixed(1), lit: +hi.toFixed(1), lenPx: +lenPx.toFixed(1), mPerPx: +(Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1], line.b[2] - line.a[2]) / lenPx).toFixed(5), prof: prof.map(v => +v.toFixed(1)) };
      out.res = [fr0.w, fr0.h];
    }
    s.debugView = 0; apply('cone');
    out.text = Object.entries(out.rows).map(([k, r]) => `${k.padEnd(9)} width ${r.width1090} px (${(r.width1090 * r.mPerPx * 100).toFixed(1)} cm) · mid ${r.mid} px · ${r.lit} → ${r.dark}`).join('\n');
    return out;
  }
  /** The VISIBILITY profile of the sharp emitter class across a shadow edge: lum(S) ∕ lum(U) of the denoised direct pair (passes.dS[0] / dU[0], linear, internal res — albedo,
   *  the beam's own gradient and the tonemap all cancel) sampled along the world segment a → b, averaged over K renders per variant; the 90 → 10 % width of the fall from
   *  the lit plateau to the darkest point (px of the OUTPUT frame and cm on the line), the 50 % crossing, the plateau levels. The line runs from the lit side into the shadow. */
  async function ratioProfile(view, line, variants = ['cone', 'mesh', 'softA', 'softM'], opts = {}) {
    const { N = 120, K = 12, settle = 40, stage = true, cls = 0 } = opts;
    if (stage) await go(view, 8);
    const out = { line, rows: {} }; const P = E().passes;
    const lenM = Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1], line.b[2] - line.a[2]);
    for (const vn of variants) {
      apply(vn); await __perf.render(settle);
      const acc = new Float64Array(N); let ok = true;
      for (let kk = 0; kk < K && ok; kk++) {
        await __perf.render(1);
        const tS = await __perf.readTexture(P.dS[cls]), tU = await __perf.readTexture(P.dU[cls]);
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1); const q = __perf.project([line.a[0] + (line.b[0] - line.a[0]) * u, line.a[1] + (line.b[1] - line.a[1]) * u, line.a[2] + (line.b[2] - line.a[2]) * u]); if (!q) { ok = false; break; }
          const x = Math.max(0, Math.min(tS.w - 1, Math.round(q[0]))), y = Math.max(0, Math.min(tS.h - 1, Math.round(q[1]))); const o = (y * tS.w + x) * 4;
          const s = 0.2126 * tS.data[o] + 0.7152 * tS.data[o + 1] + 0.0722 * tS.data[o + 2], uu = 0.2126 * tU.data[o] + 0.7152 * tU.data[o + 1] + 0.0722 * tU.data[o + 2];
          acc[i] += uu > 1e-6 ? Math.min(1.5, s / uu) : 1;
        }
      }
      if (!ok) { out.rows[vn] = { error: 'off screen' }; continue; }
      const prof = Array.from(acc, v => v / K);
      const pa = __perf.projectOut(line.a), pb = __perf.projectOut(line.b); const lenPx = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); const pxPer = lenPx / (N - 1);
      // the edge measured is the LAST fall into the darkest point: lo = the darkest sample, hi = the highest sample before it (the lit gap the line crosses, wherever it starts), the
      // crossings walked back from the darkest point — so a line that first crosses an arm's shadow, then lit floor, then the trunk's shadow measures the trunk's edge
      let iMin = 0; for (let i = 1; i < N; i++) if (prof[i] < prof[iMin]) iMin = i; const lo = prof[iMin];
      let iMax = 0; for (let i = 0; i <= iMin; i++) if (prof[i] >= prof[iMax]) iMax = i; const hi = prof[iMax];
      const at = f => { const lvl = lo + (hi - lo) * f; for (let i = iMin; i > iMax; i--) { const a = prof[i - 1], b = prof[i]; if (a >= lvl && b < lvl) return (i - 1 + (a - lvl) / (a - b)) * pxPer; } return NaN; };
      const x90 = at(0.9), x50 = at(0.5), x10 = at(0.1);
      out.rows[vn] = { widthPx: +(x10 - x90).toFixed(2), widthCm: +((x10 - x90) / lenPx * lenM * 100).toFixed(2), midPx: +x50.toFixed(2), midCm: +(x50 / lenPx * lenM * 100).toFixed(2), lit: +hi.toFixed(3), dark: +lo.toFixed(3), lenPx: +lenPx.toFixed(1), prof: prof.map(v => +v.toFixed(3)) };
    }
    apply('cone');
    out.text = Object.entries(out.rows).map(([k, r]) => r.error ? `${k} ${r.error}` : `${k.padEnd(9)} 90→10 width ${r.widthPx} px = ${r.widthCm} cm · 50 % at ${r.midCm} cm along · vis ${r.lit} → ${r.dark}`).join('\n');
    return out;
  }
  /** SILHOUETTE MATCH: over an output-px tile of the view, the shadow MASK of the sharp class (visibility lum(S)∕lum(U) < thr, mean of K renders) per variant against the
   *  reference variant's (mesh): intersection-over-union, the shadowed area relative to the reference's, and the symmetric-difference share of the tile. */
  async function maskIoU(view, tileName, variants = ['cone', 'softA'], opts = {}) {
    const { ref = 'mesh', thr = 0.5, K = 8, settle = 40, cls = 0 } = opts;
    await go(view, 8); const P = E().passes; const fr = await __perf.readback(); const r = rectOf(VIEWS[view].tiles[tileName], fr); if (!r) return { error: 'tile off screen' };
    const kx = E().width / fr.w, ky = E().height / fr.h;   // output px → internal px
    const x0 = Math.floor(r.x * kx), y0 = Math.floor(r.y * ky), w = Math.max(1, Math.floor(r.w * kx)), h = Math.max(1, Math.floor(r.h * ky)); const n = w * h;
    async function maskOf(vn) {
      apply(vn); await __perf.render(settle); const acc = new Float32Array(n);
      for (let kk = 0; kk < K; kk++) { await __perf.render(1); const tS = await __perf.readTexture(P.dS[cls]), tU = await __perf.readTexture(P.dU[cls]);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y0 + j) * tS.w + x0 + i) * 4; const sL = 0.2126 * tS.data[o] + 0.7152 * tS.data[o + 1] + 0.0722 * tS.data[o + 2], uL = 0.2126 * tU.data[o] + 0.7152 * tU.data[o + 1] + 0.0722 * tU.data[o + 2]; acc[j * w + i] += uL > 1e-5 ? Math.min(1.5, sL / uL) : 1; } }
      const m = new Uint8Array(n); let area = 0; for (let i = 0; i < n; i++) { if (acc[i] / K < thr) { m[i] = 1; area++; } } return { m, area };
    }
    const R = await maskOf(ref); const out = { view, tile: tileName, ref, thr, texels: n, refArea: R.area, rows: {} };
    for (const vn of variants) { const Mv = await maskOf(vn); let inter = 0, uni = 0, diff = 0; for (let i = 0; i < n; i++) { const a = Mv.m[i], b = R.m[i]; if (a && b) inter++; if (a || b) uni++; if (a !== b) diff++; } out.rows[vn] = { iou: +(uni ? inter / uni : 1).toFixed(4), areaRel: +(R.area ? Mv.area / R.area : 0).toFixed(4), diffShare: +(diff / n).toFixed(4), area: Mv.area }; }
    apply('cone');
    out.text = `${view}/${tileName} vs ${ref} (vis < ${thr}, ${n} texels, ref area ${R.area}): ` + Object.entries(out.rows).map(([k, q]) => `${k} IoU ${q.iou} · area ×${q.areaRel} · differs on ${(q.diffShare * 100).toFixed(2)} % of the tile`).join(' | ');
    return out;
  }
  /** temporal sd of the view's tiles over `frames` still renders per variant (p5's sd on our rects) */
  async function sdTiles(view, variants = ['cone', 'mesh', 'softA', 'softM'], opts = {}) {
    const { frames = 30, settle = 40 } = opts;
    await go(view, 8); const out = {};
    for (const vn of variants) {
      apply(vn); await __perf.render(settle);
      const fr = await __perf.readback(); out[vn] = {};
      for (const [tn, t] of Object.entries(VIEWS[view].tiles)) { const r = rectOf(t, fr); if (!r) continue; const q = await __p5.sd([r.x * 1777 / fr.w, r.y * 1000 / fr.h, r.w * 1777 / fr.w, r.h * 1000 / fr.h], frames); out[vn][tn] = { meanSd: q.meanSd, p99: q.p99, meanL: q.meanL }; }
    }
    apply('cone');
    out.text = Object.entries(out).filter(([k]) => k !== 'text').map(([vn, o]) => vn.padEnd(9) + ' ' + Object.entries(o).map(([tn, q]) => `${tn} sd ${q.meanSd} (p99 ${q.p99}) L ${q.meanL}`).join(' · ')).join('\n');
    return out;
  }
  /** interleaved serialized cost A/B between two variants on the CURRENT view (stage it first with go()) */
  async function costAB(vA, vB, opts = {}) { return __p5.costAB(async () => apply(vA), async () => apply(vB), { passes: ['direct', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'rc c0', 'probe', 'volFroxel', 'volumetrics', 'particles', 'mesh'], ...opts }); }

  // ---- dynamic scenes injected into chaos-scenes (its history-free reference, its metrics, its crops)
  const CH = window.__chaos;
  CH.SCENES.PL = {   // LAMP STRAFE: the lamp view's man slid ACROSS the corridor (z 10.7 → 11.6, 1.4 m/s) under the small lamp — his 3 m shadow sweeps the lino sideways, a few px a frame at the
    // shoes and ~4× that at the head end (the lever arm): hard-and-slow to soft-and-fast along one shadow
    frames: 40, warm: 40, pin: [{ look: [19.5, 0.05, 11.1], yaw: 88 * DEG, pitch: 58 * DEG, dist: 5.0 }, { park: true, guards: [{ i: 0, pos: [20.8, 0, 10.7], yaw: -1.57, torch: false }], player: park }],
    rois: { near: [870, 750, 800, 380], far: [870, 270, 800, 420] },   // (chaos rects are CENTRE x, centre y, w, h in output px of the 1777×1000 frame: the lino just up-corridor of the man — shins, arms — and the far half — trunk, head, the arms' ends; his own pixels are masked out by the metric)
    setup(g) { lampOn(true); torchOn(false); g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); },
    act(g, k) { const c = g.guards[0].char; if (k > 0) c.pos = [c.pos[0], c.pos[1], c.pos[2] + 1.4 / 60]; return +c.pos[2].toFixed(3); },
    teardown() { lampOn(false); },
    speedOf() { return 1.4; },
  };
  CH.SCENES.PT = {   // TORCH SWEEP past a WALKING man: chaos P0's torch yawing 25° over the take while the man walks through its beam — a hard shadow moving on wall + lino under a moving light
    frames: 40, warm: 40, pin: [{ look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, { park: true, guards: [{ i: 0, pos: [23.9, 0, 11.05], yaw: 3.14, torch: false }], player: park }],
    rois: { beam: [760, 430, 600, 400], wall: [560, 200, 300, 300] },
    setup(g) { torchOn(true); lampOn(false); g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); this.dir0 = null; },
    act(g, k) { const c = g.guards[0].char; if (k > 0) c.pos = [c.pos[0] - 1.4 / 60, c.pos[1], c.pos[2]]; const t = torchOn(true); if (!this.dir0) this.dir0 = [...t.dir]; const a = (-12 + 25 * k / 39) * DEG; const d = this.dir0; const cs = Math.cos(a), sn = Math.sin(a); const nd = [d[0] * cs - d[2] * sn, d[1], d[0] * sn + d[2] * cs]; const l = Math.hypot(...nd); t.dir = nd.map(x => x / l); return +c.pos[0].toFixed(3); },
    teardown() { const t = torchOn(false); if (this.dir0) t.dir = [...this.dir0]; },
    speedOf() { return 1.4; },
  };
  // chaos-scenes' own P0 / P3 use ITS torch; ours must be off for them (and its off for ours: their teardown does that)
  /** a chaos scene under the reference then each variant (name → settings over BASE): the rows chaos.text prints, results in __chaos.res[scene] */
  async function dyn(scene, variants = ['cone', 'mesh', 'softA', 'softM'], opts = {}) {
    if (E().outHeight !== 1000 || Math.abs(E().outWidth - 1777) > 2) throw new Error(`dyn: the output frame is ${E().outWidth}×${E().outHeight}, the ROIs are laid out for 1777×1000 — size the pane (a 1280×720 CSS viewport at dpr 2, quality high)`);
    lampOn(false); torchOn(false);
    // each variant against ITS OWN history-free reference (chaos REF = no TAAU / ReSTIR / temporal reuse, legacy filter with no history, scale 1 — under THIS variant's rig
    // settings, which __iq.apply(REF) leaves alone): graded against one capsule reference, a thinner cone / mesh / drawn shadow's edge crosses a pixel at another FRAME
    // than the capsule's and the shape difference books as lag
    const lines = [];
    for (const vn of variants) {
      Object.assign(S(), BASE, V[vn]); await CH.run(scene, 'ref', { ...opts, as: 'ref_' + vn });
      await CH.run(scene, 'main', { ...opts, as: vn, extra: { ...BASE, ...V[vn] } });
    }
    apply('cone');
    return CH.text(scene + (opts.tag ?? ''));
  }
  /** the STRESS MINUTE A/B (tools/qa/stress-scene.js staged once: `await import('/qa/stress-scene.js'); await __stress.setup({ fight: false })`) between two variants: blocks × per serialized
   *  game frames each, A B / B A interleaved, the orbit advancing throughout → per variant Σ compute + UNION (mean / p50 / p95 / max) and the direct / softblur / gather / reflect means */
  async function stressAB(vA, vB, opts = {}) {
    const { blocks = 4, per = 75, warm = 4 } = opts; const ST = window.__stress; if (!ST) throw new Error('import /qa/stress-scene.js and run __stress.setup() first');
    const e = E(), t = e.timer, cam = window.__cam; const RENDER = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown'];
    if (!cam.pin) cam.pin = { look: [...ST.center], yaw: ST.yaw0, pitch: ST.pitch, dist: ST.dist };
    const pools = [{ sum: [], union: [], per: {} }, { sum: [], union: [], per: {} }];
    for (let b = 0; b < blocks; b++) for (let vv = 0; vv < 2; vv++) {
      const v = (b & 1) ? 1 - vv : vv; apply(v === 0 ? vA : vB); const P = pools[v];
      for (let i = 0; i < per + warm; i++) {
        cam.pin.yaw += ST.orbitDeg * DEG; const before = t.resolved; window.__runFrames(1, 1 / 60); await ST.settle();
        for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
        if (i < warm || t.resolved === before) continue;
        let sum = 0; for (const [k, val] of t.lastFrame) { if (RENDER.includes(k)) continue; sum += val; (P.per[k] = P.per[k] || []).push(val); }
        P.sum.push(sum); P.union.push(t.unionMs ? t.unionMs(RENDER) : sum);
      }
    }
    apply(vA);
    const stat = a => { if (!a || !a.length) return null; const s2 = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: +m.toFixed(3), p50: +s2[Math.floor(0.5 * (s2.length - 1))].toFixed(3), p95: +s2[Math.floor(0.95 * (s2.length - 1))].toFixed(3), max: +s2[s2.length - 1].toFixed(3) }; };
    const shape = P => ({ sum: stat(P.sum), union: stat(P.union), passes: Object.fromEntries(Object.entries(P.per).map(([k, a]) => [k, stat(a)])) });
    const A = shape(pools[0]), B = shape(pools[1]);
    const d = k => (B.passes[k]?.mean ?? 0) - (A.passes[k]?.mean ?? 0);
    return { vA, vB, A, B, res: [e.width, e.height], text: `${vA} → ${vB}: union ${A.union.mean} → ${B.union.mean} (Δ ${(B.union.mean - A.union.mean).toFixed(2)}; p95 ${A.union.p95} → ${B.union.p95}) · Σ ${A.sum.mean} → ${B.sum.mean} · direct Δ ${d('direct').toFixed(2)} · softblur Δ ${d('softblur').toFixed(2)} · gather Δ ${d('gather').toFixed(2)} · reflect Δ ${d('reflect').toFixed(2)}` };
  }
  const identityHash = (view = 'cubicles', frames = 40) => __p5.identityHash(view, frames);
  /** OFF identity on OUR views (one man, our own flicker-free lamp / torch, every group light of the view off, phases zeroed by go()): a fixed sequence from boot →
   *  { view: FNV hash of the LDR frame } — run the same call on the base tree served beside and compare. debug: also hash debug views 3 (direct) / 4 (indirect). */
  async function identitySet(views = ['lampW', 'torch', 'lamp'], frames = 40, debug = [0, 3, 4]) {
    const out = { origin: location.origin, res: null };
    for (const v of views) for (const dv of debug) {
      let s0 = 4242; Math.random = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      await go(v, 0);
      // every light record but ours DARK (the level's fixtures carry per-boot random flicker / restrike phases: with them lit, two boots of one tree do not hash alike once a
      // corridor tube is in reach), and the men's idle clocks pinned
      { const groups = new Set(); for (const l of E().lights.lights) if (l.group && l.group !== 'test') groups.add(l.group); for (const gr of groups) { try { G().setGroup(gr, false); } catch {} } for (const l of E().lights.lights) if (l !== lamp && l !== torch) l.enabled = false; }
      for (const gd of G().guards) { gd.char.anim.phase = 0; if ('idleT' in gd.char.anim) gd.char.anim.idleT = 0; }
      S().debugView = dv; E().passes.grain = 0; window.__resetClock();
      window.__runFrames(frames, 1 / 60); await E().device.queue.onSubmittedWorkDone();
      E().render(window.__cam, 100, 1 / 60, false);
      const fr = await __perf.readback(); out.res = [fr.w, fr.h]; out[`${v}_d${dv}`] = __perf.hash(fr);
    }
    S().debugView = 0; return out;
  }
  /** the same staging, but the frame POSTED losslessly (docs/shots/ab/id_<tag>_<view>_d<dv>.png via __png on our shot port) for a tolerance A/B when two boots of one tree do not hash alike */
  async function identityPng(tag, views = ['lampW', 'torch'], frames = 40, debug = [3, 0]) {
    const out = await identitySet(views, frames, debug); const posted = {};
    for (const v of views) for (const dv of debug) {
      let s0 = 4242; Math.random = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      await go(v, 0);
      { const groups = new Set(); for (const l of E().lights.lights) if (l.group && l.group !== 'test') groups.add(l.group); for (const gr of groups) { try { G().setGroup(gr, false); } catch {} } for (const l of E().lights.lights) if (l !== lamp && l !== torch) l.enabled = false; }
      for (const gd of G().guards) gd.char.anim.phase = 0;
      S().debugView = dv; E().passes.grain = 0; window.__resetClock();
      window.__runFrames(frames, 1 / 60); await E().device.queue.onSubmittedWorkDone();
      window.__shotPort = 5189; posted[`${v}_d${dv}`] = await window.__png(`ab/id_${tag}_${v}_d${dv}`);
    }
    S().debugView = 0; return { hashes: out, posted };
  }
  /** GPU validation sweep: every switch of this lane × mesh on/off × the presets × a few debug views — uncaptured errors + error scopes */
  async function validate(presets = ['ultra', 'high', 'medium', 'low', 'verylow']) {
    const errs = []; const dev = E().device; const onErr = e => errs.push(String(e.error?.message ?? e).slice(0, 200)); dev.addEventListener?.('uncapturederror', onErr);
    const q0 = window.__quality.current; const rows = [];
    for (const p of presets) {
      window.__quality.apply(p); await go('lamp', 4);
      for (const vn of ['cone', 'softA', 'softM', 'softMS', 'smooth', 'mesh', 'softMesh', 'meshRefl']) {
        for (const dv of [0, 3, 4, 14]) {
          dev.pushErrorScope('validation'); apply(vn); S().debugView = dv; await __perf.step(2); await __perf.render(2); const er = await dev.popErrorScope(); S().debugView = 0;
          rows.push({ p, vn, dv, err: er ? er.message.slice(0, 160) : null });
        }
      }
    }
    window.__quality.apply(q0); apply('cone'); dev.removeEventListener?.('uncapturederror', onErr);
    const bad = rows.filter(r => r.err);
    return { presets, checks: rows.length, bad, uncaptured: errs.slice(0, 10), text: `${rows.length} preset × variant × view checks, ${bad.length} validation errors, ${errs.length} uncaptured` };
  }
  /** The lane's whole take at the current preset, fire-and-forget (poll __sr.job): stills (direct-only + composite crops), edge profiles at three distances under the lamp + the torch's wall /
   *  lino, temporal sd, the four dynamic scenes, cost A/Bs on lobby4 + lamp — every part optional (parts), results in __sr.res and docs/perf/sr-<tag>.json */
  function battery(tag, parts = ['stills', 'profiles', 'sd', 'dyn', 'cost', 'refl'], opts = {}) {
    const R = (window.__sr.res[tag] = window.__sr.res[tag] || { tag, q: window.__quality?.current, res: [E().width, E().height, E().outWidth, E().outHeight], t0: Date() });
    const job = window.__sr.job = { tag, at: 'start', done: [], err: null };
    const soft = opts.softVariants ?? ['softA', 'softM'];
    const shape = ['cone', 'mesh'];   // ('cap' left the tree with the capsule cleanup: a battery re-run on this tree measures the cones against the mesh only)
    (async () => {
      try {
        if (parts.includes('stills')) { job.at = 'stills'; R.stills = R.stills || {}; for (const v of ['lampW', 'lamp', 'torch']) { R.stills[v + '_d3'] = await still(v, [...shape, ...soft], { debug: 3, prefix: tag }); R.stills[v] = await still(v, [...shape, ...soft], { debug: 0, prefix: tag }); } job.done.push('stills'); await save('sr-' + tag, R); }
        if (parts.includes('profiles')) { job.at = 'profiles'; R.profiles = R.profiles || {}; for (const [v, ln] of opts.lines ?? [['lampW', 'contact'], ['lampW', 'near'], ['lamp', 'mid'], ['lamp', 'far'], ['torch', 'wall'], ['torch', 'wallLow']]) { job.at = `profiles:${v}:${ln}`; const pr = await ratioProfile(v, VIEWS[v].lines[ln], [...shape, ...soft]); R.profiles[v + '_' + ln] = { text: pr.text, rows: Object.fromEntries(Object.entries(pr.rows).map(([k, r]) => [k, { ...r, prof: undefined }])), profs: Object.fromEntries(Object.entries(pr.rows).map(([k, r]) => [k, r.prof])) }; await save('sr-' + tag, R); } job.done.push('profiles'); }
        if (parts.includes('iou')) { job.at = 'iou'; R.iou = R.iou || {}; for (const [v, tn] of opts.iouTiles ?? [['lamp', 'mid'], ['lamp', 'far'], ['lampW', 'near'], ['torch', 'wall'], ['torch', 'lino']]) { job.at = `iou:${v}:${tn}`; const q = await maskIoU(v, tn, ['cone', 'softA', 'softM']); R.iou[v + '_' + tn] = { text: q.text, rows: q.rows, refArea: q.refArea, texels: q.texels }; await save('sr-' + tag, R); } job.done.push('iou'); }
        if (parts.includes('sd')) { job.at = 'sd'; R.sd = R.sd || {}; for (const v of ['lamp', 'torch']) { const q = await sdTiles(v, [...shape, ...soft]); R.sd[v] = { ...q, text: q.text }; } job.done.push('sd'); await save('sr-' + tag, R); }
        if (parts.includes('dyn')) { job.at = 'dyn'; R.dyn = R.dyn || {}; for (const sc of opts.scenes ?? ['PL', 'PT', 'P0', 'P3']) { job.at = 'dyn:' + sc; R.dyn[sc] = { text: await dyn(sc, [...shape, ...soft], { tag: '_' + tag }), metrics: Object.fromEntries(Object.entries(CH.res[sc + '_' + tag] || {}).map(([vn, o]) => [vn, o.metrics])) }; await save('sr-' + tag, R); } job.done.push('dyn'); }
        if (parts.includes('cost')) { job.at = 'cost'; R.cost = R.cost || {}; for (const v of opts.costViews ?? ['lobby4', 'lamp']) { await go(v, 20); for (const [a, b] of opts.costPairs ?? [['cone', 'softA'], ['cone', 'softM'], ['cone', 'smooth'], ['cone', 'mesh']]) { job.at = `cost:${v}:${a}/${b}`; const r = await costAB(a, b, opts.costOpts ?? {}); R.cost[`${v}:${a}/${b}`] = { A: r.A, B: r.B, dUnionMed: r.dUnionMed, dUnionP95: r.dUnionP95, res: r.res, text: r.text }; await save('sr-' + tag, R); } } job.done.push('cost'); }
        if (parts.includes('refl')) { job.at = 'refl'; R.refl = R.refl || {}; for (const v of ['lino', 'lobby4']) { R.refl[v + '_d14'] = await still(v, ['cone', 'smooth', 'meshRefl'], { debug: 14, prefix: tag }); R.refl[v] = await still(v, ['cone', 'smooth', 'meshRefl'], { debug: 0, prefix: tag }); } job.done.push('refl'); await save('sr-' + tag, R); }
        job.at = 'done'; R.t1 = Date(); await save('sr-' + tag, R);
      } catch (e) { job.err = String(e?.stack || e); job.at = 'error'; }
    })();
    return 'started ' + tag;
  }
  async function save(name, obj) { const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj) }); return `${name}.json → ${r.status}`; }

  window.__sr = { V, VIEWS, BASE, apply, go, still, shot, profile, ratioProfile, maskIoU, sdTiles, costAB, dyn, battery, stressAB, identityHash, identitySet, identityPng, validate, lampOn, torchOn, rectOf, save, res: {}, job: null };
  return 'sdfrig harness ready: __sr.{V,VIEWS,apply,go,still,shot,profile,sdTiles,costAB,dyn,identityHash,validate,lampOn,torchOn,save}';
})();
