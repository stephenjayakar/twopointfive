// ReSTIR DI lane bench (renderer v3 Phase 2a): `await import('/qa/restir-bench.js')` on a `?paused&quality=<p>&mute` boot → window.__rb.
//   __rb.stage(view)            close the card, pin one of the named views (cubicles / corridor / lobby / lot / breakroom), guards left as they are
//   await __rb.measure(n)       n serialized frames → mean/sd of direct, softblur, union (CLAUDE.md protocol: onSubmittedWorkDone + MessageChannel yields per frame)
//   await __rb.ab(fnA, fnB, r)  interleaved A/B (r rounds of A,B,B,A) → { A, B } means
//   await __rb.diag(view)       debug view 11 / 12 read back from the raw S0 texture over a region → histograms (history M, gradient resets, rays / pixel, taps)
//   await __rb.hot(edit)        hot-swap restir.wgsl with edit(src) applied (string → string); __rb.hot() restores the file as on disk
//   await __rb.slope(groups)    direct ms vs lights: switch the level's light groups off cumulatively (game lighting API), measure each step, restore
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  window.__testVisible = true;
  const E = () => window.__engine, G = () => window.__game;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RENDER = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'taau', 'present'];
  const DEG = Math.PI / 180;
  const VIEWS = {
    cubicles: { look: [23, 0, 19.4], yaw: -20 * DEG, pitch: 55 * DEG, dist: 18 },
    corridor: { look: [20, 0, 9], yaw: 0 * DEG, pitch: 55 * DEG, dist: 16 },
    lobby: { look: [9, 0, 17], yaw: 30 * DEG, pitch: 52 * DEG, dist: 17 },
    lot: { look: [22, 0, 33], yaw: 10 * DEG, pitch: 50 * DEG, dist: 22 },
    breakroom: { look: [33, 0, 15], yaw: -40 * DEG, pitch: 55 * DEG, dist: 13 },
    manager: { look: [27.2, 0, 6.6], yaw: 15 * DEG, pitch: 55 * DEG, dist: 8 },   // the desk lamp's pool + its penumbrae under the desk
    corridorE: { look: [14, 0, 11.1], yaw: 0 * DEG, pitch: 55 * DEG, dist: 10 },   // under the lit corridor panel at x 14
    lotS: { look: [17, 0, 30], yaw: 170 * DEG, pitch: 50 * DEG, dist: 16 },      // the lot under the south street lamp
    server: { look: [31, 0, 8], yaw: 20 * DEG, pitch: 58 * DEG, dist: 12 },
  };
  for (let i = 0; i < 400 && !(window.__engine && window.__game); i++) await yieldTask();   // (imported straight after a navigation: wait for the hooks)
  if (!window.__gpuErrs) { window.__gpuErrs = []; E().device.addEventListener('uncapturederror', ev => window.__gpuErrs.push(ev.error.message)); }
  const B = {
    VIEWS,
    stage(view = 'cubicles', opts = {}) { window.__menu?.close(); const v = typeof view === 'string' ? VIEWS[view] : view; window.__stage(v, opts); window.__runFrames(4, 1 / 60); return v; },
    async frame(dt = 1 / 60) {
      const t = E().timer; const before = t.resolved; window.__runFrames(1, dt); await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
      for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
      return t.resolved !== before;
    },
    async measure(n = 30, warm = 8, dt = 1 / 60) {
      const t = E().timer; const rows = [];
      for (let i = 0; i < n + warm; i++) { const ok = await B.frame(dt); if (!ok || i < warm) continue; const r = {}; for (const [k, v] of t.lastFrame) r[k] = v; r.union = t.unionMs(RENDER); let s = 0; for (const [k, v] of t.lastFrame) if (!RENDER.includes(k)) s += v; r.sum = s; rows.push(r); }
      const st = k => { const a = rows.map(r => r[k] || 0); const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); const s = [...a].sort((x, y) => x - y); return { mean: +m.toFixed(3), sd: +sd.toFixed(3), p95: +s[Math.floor(0.95 * (s.length - 1))].toFixed(3), max: +s[s.length - 1].toFixed(3) }; };
      return { n: rows.length, res: [E().width, E().height], lights: E().lights.activeCount, direct: st('direct'), softblur: st('softblur'), union: st('union'), sum: st('sum') };
    },
    async ab(applyA, applyB, rounds = 2, n = 24) {
      const acc = { A: [], B: [] };
      for (let r = 0; r < rounds; r++) for (const v of (r & 1) ? ['B', 'A', 'A', 'B'] : ['A', 'B', 'B', 'A']) { (v === 'A' ? applyA : applyB)(); acc[v].push(await B.measure(n)); }
      applyA();
      const avg = (arr, k) => +(arr.reduce((x, m) => x + m[k].mean, 0) / arr.length).toFixed(3);
      const shape = arr => ({ direct: avg(arr, 'direct'), softblur: avg(arr, 'softblur'), union: avg(arr, 'union'), sum: avg(arr, 'sum'), takes: arr.map(m => m.direct.mean) });
      return { A: shape(acc.A), B: shape(acc.B), res: [E().width, E().height], lights: E().lights.activeCount };
    },
    /** debug view 11 (history) or 12 (rays) statistics over the region [x0,x1)×[y0,y1) (defaults: the middle of the frame), after `settleFrames` frames */
    async diag(view = 11, region = null, settleFrames = 25) {
      const S = E().settings; const old = S.debugView; S.debugView = view; window.__runFrames(settleFrames, 1 / 60); E().render(window.__cam, 100, 1 / 60, false);
      const t = await window.__perf.readTexture(E().passes.dS[0]); S.debugView = old; window.__runFrames(1, 1 / 60);
      const [x0, y0, x1, y1] = region ?? [Math.floor(t.w * 0.2), Math.floor(t.h * 0.2), Math.floor(t.w * 0.8), Math.floor(t.h * 0.8)];
      const h = [{}, {}, {}]; let n = 0; const sums = [0, 0, 0]; let lit = 0;
      const U = await window.__perf.readTexture(E().passes.dU[0]); const U1 = await window.__perf.readTexture(E().passes.dU[1]);
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const o = (y * t.w + x) * 4; const isLit = (U.data[o] + U.data[o + 1] + U.data[o + 2] + U1.data[o] + U1.data[o + 1] + U1.data[o + 2]) > 1e-4;
        if (!isLit) continue; lit++;
        for (let c = 0; c < 3; c++) { const v = t.data[o + c]; const key = v.toFixed(2); h[c][key] = (h[c][key] || 0) + 1; sums[c] += v; }
        n++;
      }
      const top = hh => Object.entries(hh).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${(v / n * 100).toFixed(0)}%`).join(' ');
      if (view === 12) return { litPixels: n, raysPerPixel: +(sums[0] / n * 6).toFixed(3), tapsPerPixel: +(sums[1] / n * 2 * Math.max(1, S.restirSpatial)).toFixed(3), neighbourShadedFrac: +(sums[2] / n * 2).toFixed(3), raysHist: top(h[0]) };
      return { litPixels: n, M0: top(h[0]), M1: top(h[1]), gradientCut: top(h[2]), meanM0: +(sums[0] / n).toFixed(3), meanM1: +(sums[1] / n).toFixed(3), meanCut: +(sums[2] / n).toFixed(4) };
    },
    async hot(edit = null) {
      const src = await (await fetch('/qa/shader/restir.wgsl', { cache: 'no-store' })).text();
      const v = edit ? edit(src) : src;
      if (edit && v === src) return { ok: false, messages: ['edit changed nothing'] };
      return window.__hotRestir(v);
    },
    /** direct ms vs active light count: switch the level's light GROUPS off one after another (cumulative, through game.setGroup so the lighting update does not put them
     *  back), n frames each; every target's switch restored after. → rows + least-squares ms per light */
    async slope(n = 24, groups = ['monitors', 'server_glow', 'lobby', 'conference', 'corridor', 'breakroom', 'server', 'manager', 'storage', 'devices', 'cubicles', 'exterior']) {
      const g = G(); const was = g.targets.map(t => t.on); const wasL = E().lights.lights.map(l => l.enabled);
      const rows = [];
      const m0 = await B.measure(n); rows.push({ off: 'none', lights: m0.lights, direct: m0.direct.mean, union: m0.union.mean });
      for (const grp of groups) { g.setGroup(grp, false); for (const l of E().lights.lights) if (l.group === grp) l.enabled = false; window.__runFrames(3, 1 / 60); const m = await B.measure(n); rows.push({ off: grp, lights: m.lights, direct: m.direct.mean, union: m.union.mean }); }
      g.targets.forEach((t, i) => { t.on = was[i]; }); E().lights.lights.forEach((l, i) => { l.enabled = wasL[i]; }); window.__runFrames(3, 1 / 60);
      const pts = rows.map(r => [r.lights, r.direct]);
      const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / Math.max(1e-9, pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0));
      return { rows, msPerLight: +slope.toFixed(4), res: [E().width, E().height] };
    },
    /** QUALITY on the current staged (still) scene: for each variant {name, apply} and each tile {name, x, y, w, h}: `warm` offscreen renders, then per-pixel temporal
     *  statistics over `frames` renders (LDR luma sd in 8-bit steps + boil fraction; linear relative sd and MEAN of the filtered direct textures per class — the mean is
     *  the bias check against the 'off' variant), and a ×3 crop of the tile from the last frame posted as p2a_q_<scene>_<tile>_<variant>. */
    async quality(scene, tiles, variants, opts = {}) {
      const { warm = 50, frames = 30 } = opts; const P = window.__perf; P.still();
      const out = {};
      for (const v of variants) {
        v.apply(); await P.render(warm);
        for (const t of tiles) {
          const s0 = await P.temporalStats(t.x, t.y, t.w, t.h, { frames, linear: () => E().passes.dS[0] });
          const s1 = await P.temporalStats(t.x, t.y, t.w, t.h, { frames, linear: () => E().passes.dS[1] });
          await P.render(1); const fr = await P.readback();
          let shot = ''; try { shot = await P.crop(`p2a_q_${scene}_${t.name}_${v.name}`, t.x, t.y, t.w, t.h, 3, 0.92, fr); } catch (e) { shot = 'crop failed: ' + e; }
          (out[t.name] = out[t.name] || {})[v.name] = { ldrSd: +((s0.ldr.sd + s1.ldr.sd) / 2).toFixed(3), boil: +((s0.ldr.boilFrac + s1.ldr.boilFrac) / 2).toFixed(5), sharp: { relSd: s0.lin.relSd, mean: s0.lin.mean }, broad: { relSd: s1.lin.relSd, mean: s1.lin.mean }, shot };
          window.__qpart = window.__qpart || {}; (window.__qpart[scene] = window.__qpart[scene] || {})[t.name + ':' + v.name] = out[t.name][v.name];   // partial results survive a failure further on
        }
      }
      variants[0].apply();
      // bias vs the first variant (the reference): mean ratio per class
      for (const t of tiles) { const ref = out[t.name][variants[0].name]; for (const v of variants.slice(1)) { const o = out[t.name][v.name]; o.meanRatio = { sharp: ref.sharp.mean > 1e-7 ? +(o.sharp.mean / ref.sharp.mean).toFixed(4) : null, broad: ref.broad.mean > 1e-7 ? +(o.broad.mean / ref.broad.mean).toFixed(4) : null }; } }
      return out;
    },
    // ---------------------------------------------------------------- DYNAMICS: response of the estimators to change, frame by frame ----------------------------------------
    /** mean LDR luma of tile t in readback fr */
    tileLuma(fr, t) { let m = 0, n = 0; for (let j = 0; j < t.h; j += 2) for (let i = 0; i < t.w; i += 2) { const o = ((t.y + j) * fr.w + (t.x + i)) * 4; m += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; n++; } return m / n; },
    /** Run `setup()` (stage + settle), then `trigger()`, then `frames` game steps; per frame the tile's mean LDR luma, and at `shots` frames a ×3 crop named p2a_<name>_<variant>_fNN.
     *  → { luma: [...], shots: [...] }. The same call per variant gives the response curves to compare (a door opening, a flash, a light group switching). */
    async dyn(name, variant, tile, setup, trigger, opts = {}) {
      const { frames = 30, shots = [0, 1, 2, 4, 8, 16, 29], dt = 1 / 60, scale = 3 } = opts; const P = window.__perf;
      await setup(); P.still();
      trigger();
      const luma = [], posted = [];
      for (let f = 0; f < frames; f++) {
        window.__runFrames(1, dt); await P.settle();
        if (!document.hidden) { P.time += dt; E().render(window.__cam, P.time, dt, false); await P.settle(); }   // (a scripted step on a hidden pane renders OFFSCREEN — main.ts step — and that frame is what readback returns; a visible pane presented it instead, so re-render offscreen: one extra history frame, alike for every variant)
        const fr = await P.readback();
        luma.push(+B.tileLuma(fr, tile).toFixed(2));
        if (shots.includes(f)) posted.push(await P.crop(`p2a_${name}_${variant}_f${String(f).padStart(2, '0')}`, tile.x, tile.y, tile.w, tile.h, scale, 0.9, fr));
      }
      return { luma, posted };
    },
    /** the storage-room door swung open from the corridor: the bulb's light wedge on the corridor floor, per frame */
    async dynDoor(variant, apply) {
      const g = G(); const d = g.doors.byName('storage');
      const setup = async () => { apply(); B.stage({ look: [32.6, 0, 11.0], yaw: 0, pitch: 62 * DEG, dist: 7 }, { park: true, player: { pos: [22, 0, 11.2], yaw: 1.57, holstered: true, invisible: true } }); d.reset(); d.locked = false; window.__runFrames(6, 1 / 60); await window.__perf.render(50); };
      const tile = { name: 'wedge', x: 0, y: 0, w: 640, h: 420 };   // the doorway (top) and ~2.5 m of corridor floor south of it: the bulb's wedge sweeps across it as the leaf swings
      await setup(); const px = window.__perf.projectOut([32.6, 0, 11.1]); const ow = E().outWidth ?? E().width, oh = E().outHeight ?? E().height; tile.x = Math.max(0, Math.min(ow - tile.w, px[0] - 320)); tile.y = Math.max(0, Math.min(oh - tile.h, px[1] - 210));
      return { tile, ...(await B.dyn('door', variant, tile, async () => {}, () => { g.doors.use(d, [32.5, 0, 11.4], 0); }, { frames: 40, shots: [0, 2, 4, 6, 8, 10, 12, 16, 24, 39], scale: 2 })) };
    },
    /** a muzzle flash (lights.flash, ttl 3 frames) in the dark corridor: the floor round it per frame — it must light at once and leave nothing */
    async dynFlash(variant, apply) {
      const setup = async () => { apply(); B.stage({ look: [24.0, 0, 11.1], yaw: Math.PI * 0.5, pitch: 60 * DEG, dist: 7 }, { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }); window.__runFrames(6, 1 / 60); await window.__perf.render(50); };
      await setup(); const px = window.__perf.projectOut([24.0, 0, 11.1]); const tile = { name: 'flash', x: Math.max(0, px[0] - 200), y: Math.max(0, px[1] - 150), w: 400, h: 300 };
      return { tile, ...(await B.dyn('flash', variant, tile, async () => {}, () => { E().lights.flash([24.0, 1.1, 11.1], [1.0, 0.85, 0.6], 40, 9, 0.05, 0); }, { frames: 10, shots: [0, 1, 2, 3, 4, 6, 9] })) };
    },
    /** a man crossing under the lit corridor panel at x 14 with his torch on: his floor shadow's trailing edge (ghosting) — crops per frame + luma of a strip behind him */
    async dynWalk(variant, apply) {
      const g = G(); const gd = g.guards[0];
      // he stands (converged through the warm-up) at x 13.4 under the panel at x 14, then walks +x at 1.4 m/s from frame 0: the tile holds where his shadow WAS (trailing edge) and where it goes
      const setup = async () => { apply(); B.stage({ look: [14.1, 0, 11.4], yaw: 0, pitch: 62 * DEG, dist: 5.5 }, { park: true, guards: [{ i: 0, pos: [13.4, 0, 11.5], yaw: 0, torch: true, aimPitch: -0.3 }], player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }); window.__runFrames(6, 1 / 60); await window.__perf.render(60); };
      await setup(); const px = window.__perf.projectOut([14.0, 0, 11.5]); const ow = E().outWidth ?? E().width, oh = E().outHeight ?? E().height; const tile = { name: 'walk', x: Math.max(0, Math.min(ow - 560, px[0] - 280)), y: Math.max(0, Math.min(oh - 360, px[1] - 180)), w: 560, h: 360 };
      let x = 13.4;
      const stepMan = () => { x += 1.4 / 60; gd.char.pos = [x, 0, 11.5]; gd.char.vel = [1.4, 0, 0]; };
      // move him during the frames: hook into dyn via a trigger that installs a per-frame mover
      const P = window.__perf; P.still();
      const luma = [], posted = []; const shots = [0, 1, 2, 4, 6, 8, 12, 16, 24, 32];
      for (let f = 0; f < 34; f++) {
        stepMan(); window.__runFrames(1, 1 / 60); await P.settle();
        if (!document.hidden) { P.time += 1 / 60; E().render(window.__cam, P.time, 1 / 60, false); await P.settle(); }
        const fr = await P.readback(); luma.push(+B.tileLuma(fr, tile).toFixed(2));
        if (shots.includes(f)) posted.push(await P.crop(`p2a_walk_${variant}_f${String(f).padStart(2, '0')}`, tile.x, tile.y, tile.w, tile.h, 2, 0.9, fr));
      }
      return { tile, luma, posted };
    },
    /** all switchable groups killed at once, then restored 20 frames later (blackout beacons excluded: a pure many-lights-change): cubicles floor luma per frame + crops */
    async dynSwitch(variant, apply) {
      const g = G();
      const setup = async () => { apply(); B.stage('cubicles', { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } }); window.__runFrames(6, 1 / 60); await window.__perf.render(50); };
      await setup(); const px = window.__perf.projectOut([22.5, 0, 16.5]); const tile = { name: 'switch', x: Math.max(0, px[0] - 200), y: Math.max(0, px[1] - 150), w: 400, h: 300 };
      const groups = ['cubicles', 'monitors', 'corridor', 'lobby'];
      let f0 = 0;
      const res = await B.dyn('switch', variant, tile, async () => {}, () => { for (const grp of groups) g.setGroup(grp, false); }, { frames: 20, shots: [0, 1, 2, 4, 8, 19] });
      const res2 = await B.dyn('switchOn', variant, tile, async () => {}, () => { for (const grp of groups) g.setGroup(grp, true); }, { frames: 24, shots: [0, 1, 2, 4, 8, 23] });
      void f0;
      return { tile, off: res, on: res2 };
    },
    /** LIGHT METER independence: Sam's visibility (game.player.visibility, fed by the irradiance probe pass — its own light loop) at five staged spots, restir on vs off.
     *  Guards parked (torches off) so only the level's static lights count; `settle` frames per spot for the probe's readback latency. → rows + max |Δ| */
    async meter(settle = 40) {
      const g = G(); const S = E().settings; const spots = [[23, 0, 16.3], [14.2, 0, 11.3], [27.0, 0, 6.6], [9, 0, 17], [20, 0, 31]];
      B.stage('cubicles', { park: true, player: { pos: [23, 0, 16.3], yaw: 0, holstered: true, invisible: false } });
      const read = async () => { const rows = []; for (const p of spots) { g.teleportPlayer([p[0], 0, p[2]]); window.__runFrames(settle, 1 / 60); await window.__perf.settle(); window.__runFrames(4, 1 / 60); await window.__perf.settle(); rows.push(+g.player.visibility.toFixed(4)); } return rows; };
      S.restir = false; const off = await read();
      S.restir = true; const on = await read();
      S.restir = false; const off2 = await read();
      S.restir = true;
      let maxD = 0; for (let i = 0; i < spots.length; i++) maxD = Math.max(maxD, Math.abs(on[i] - off[i]), Math.abs(off2[i] - off[i]));
      return { spots, off, on, offAgain: off2, maxAbsDelta: +maxD.toFixed(4) };
    },
    /** deterministic capture for the OFF-identity check: fresh `?paused` boot assumed; parks everyone, resets clocks, steps n frames, hashes the RGBA readback (and posts the PNG as `name` if given) */
    async identityCapture(name = null, n = 24) {
      window.__menu?.close();
      B.stage('cubicles', { park: true, player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } });
      const P = window.__perf; P.still(); if (window.__weather) window.__weather.setEnabled?.(false);
      let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      window.__resetClock(); window.__runFrames(n, 1 / 60); await P.settle();
      E().render(window.__cam, 50, 1 / 60, false); await P.settle();
      const fr = await P.readback(); const hash = P.hash(fr);
      let posted = null; if (name) { try { posted = await P.png(name, fr); } catch (e) { posted = String(e); } }
      return { hash, res: [E().width, E().height], flags: (E().settings.flags >>> 0).toString(16), restir: E().settings.restir, taau: E().settings.taau, posted };
    },
    /** persist a result object as docs/perf/<name>.json through this lane's shot server (its /perf sink) */
    async save(name, obj) { const port = Number(window.__shotPort) || 5174; try { const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } }); return r.status; } catch (e) { return String(e); } },
    /** THE STRESS MINUTE per preset (tools/qa/stress-scene.js), restir OFF vs ON interleaved in blocks over the same evolving scene, per frame: direct, softblur, Σ compute,
     *  the UNION of compute intervals → { preset: { res, lights, off: stats, on: stats } }, saved as it goes (p2a-stress-<preset>). opts: { presets, blocks, per, scale (renderScale
     *  override after the preset applies, e.g. 1.0 for the pre-TAAU pixel count), tag } */
    async stressAll(opts = {}) {
      const { presets = ['high', 'ultra', 'medium', 'low', 'verylow'], blocks = 4, per = 80, warm = 6, scale = null, tag = '' } = opts;
      if (!window.__stress) await import('/qa/stress-scene.js');
      const S = E().settings; const t = E().timer; const out = {};
      const st = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return { n: a.length, mean: +m.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
      for (const p of presets) {
        window.__pauseLoop = true;
        G().restartEncounter(); window.__menu?.close?.(); window.__runFrames(2, 1 / 60);
        window.__quality.auto = false; window.__quality.apply(p); if (scale) S.renderScale = scale; window.__runFrames(4, 1 / 60);
        if (window.__cam) window.__cam.pin = null;
        S.restir = true;
        const setupLine = await window.__stress.setup({ fight: false });
        const pools = { off: { direct: [], softblur: [], sum: [], union: [] }, on: { direct: [], softblur: [], sum: [], union: [] } };
        const cam = window.__cam; const SS = window.__stress;
        for (let b = 0; b < blocks; b++) for (let vv = 0; vv < 2; vv++) {
          const v = (b & 1) ? 1 - vv : vv; const key = v === 0 ? 'off' : 'on';
          S.restir = v === 1;
          for (let i = 0; i < per + warm; i++) {
            cam.pin.yaw += SS.orbitDeg * DEG;
            const before = t.resolved; window.__runFrames(1, 1 / 60); await SS.settle();
            for (let k = 0; k < 50 && t.resolved === before; k++) await yieldTask();
            if (i < warm || t.resolved === before) continue;
            let sum = 0; for (const [k2, val] of t.lastFrame) if (!RENDER.includes(k2)) sum += val;
            const P_ = pools[key]; P_.direct.push(t.lastFrame.get('direct') || 0); P_.softblur.push(t.lastFrame.get('softblur') || 0); P_.sum.push(sum); P_.union.push(t.unionMs(RENDER));
          }
        }
        S.restir = true;
        const shape = P_ => ({ direct: st(P_.direct), softblur: st(P_.softblur), sum: st(P_.sum), union: st(P_.union) });
        out[p] = { res: [E().width, E().height], out: [E().outWidth ?? E().width, E().outHeight ?? E().height], scale: S.renderScale, lights: E().lights.activeCount, setup: setupLine, state: SS.state(), off: shape(pools.off), on: shape(pools.on), tier: { rays: S.restirRays, spatial: S.restirSpatial, history: S.restirHistory } };
        window.__stressPart = out;
        await B.save(`p2a-stress${tag ? '-' + tag : ''}-${p}`, out[p]);
      }
      return out;
    },
    /** a w×h tile centred on world point p in INTERNAL pixels (dS / dU / any screen texture read with __perf.readTexture), clamped to the frame */
    tileAt(name, p, w = 300, h = 300) { const px = window.__perf.project(p); const e = E(); if (!px) return null; return { name, x: Math.max(0, Math.min(e.width - w, px[0] - (w >> 1))), y: Math.max(0, Math.min(e.height - h, px[1] - (h >> 1))), w, h }; },
    /** the same in OUTPUT pixels (the LDR readback's grid under TAAU: crops, tileLuma, __perf.temporalStats) */
    tileOut(name, p, w = 300, h = 300) { const px = window.__perf.projectOut(p); const e = E(); if (!px) return null; const ow = e.outWidth ?? e.width, oh = e.outHeight ?? e.height; return { name, x: Math.max(0, Math.min(ow - w, px[0] - (w >> 1))), y: Math.max(0, Math.min(oh - h, px[1] - (h >> 1))), w, h }; },
    errors() { return window.__gpuErrs.slice(-10); },
  };
  window.__rb = B;
  return 'restir bench ready: __rb.{stage,measure,ab,diag,hot,slope,errors}';
})();
