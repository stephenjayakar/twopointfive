// The particle-rain prototype's in-page rig (docs/review/particle-rain.html): the fixed views V1‥V5, the storm forced to one seed / rate / wind, deterministic staging
// (everyone parked, animation phases zeroed, Math.random seeded, the recycler reseeded), settle-with-GPU-sync, lossless captures to the lane's own sink (:5209), the serialized
// cost take, the filmstrip and the TAA smear map takes. Dev only. On a `?paused&quality=<p>&mute` boot (add `&prain` for the hybrid, or flip __rain.on) with #view visible:
//     await import('/qa/prain-harness.js'); await __pr.stage('lot'); await __pr.png('x'); await __pr.cost()
(() => {
  const E = () => window.__engine, G = () => window.__game, W = () => window.__weather;
  const DEG = Math.PI / 180;
  const yieldCh = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  /** mulberry32 for Math.random while staging (emitters draw from it) */
  const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const P = {
    port: 5209,
    /** the views: pin = the camera verbatim, player = where Sam stands (yaw), lampW = the west street lamp (off in the level) switched on, sub = what the view is for */
    views: {
      lot:    { pin: { look: [16.5, 0, 25.4], yaw: -22 * DEG, pitch: 55 * DEG, dist: 21 }, player: { pos: [13.5, 0, 25.9], yaw: Math.PI * 0.5 }, sub: 'V1 · the south lot from the follow camera: Sam by the red car facing the sodium lamp — parallax, the lit cone, the building\'s shadow edge across the rain' },
      exit:   { pin: { look: [37.0, 1.0, 19.3], yaw: 1.7, pitch: 34 * DEG, dist: 10.5 }, player: { pos: [30, 0, 8], invisible: true }, sub: 'V2 · the east strip by the fire exit from low over the lot: drops END on the pallet stack and the bulkhead housing; drips off the roof\'s rim (top of frame) and the housing; the east lamp\'s cone' },
      car:    { pin: { look: [11.4, 0, 26.6], yaw: 0.25, pitch: 47 * DEG, dist: 7.5 }, player: { pos: [30, 0, 8], invisible: true }, sub: 'V2b · close on the red car: drops end ON its roof and bonnet, drips run off its edges, splashes on the asphalt round it' },
      glass:  { pin: { look: [4.6, 0, 19.2], yaw: Math.PI * 0.5, pitch: 40 * DEG, dist: 9.5 }, player: { pos: [7.0, 0, 20.5], yaw: -Math.PI * 0.5 }, lampW: true, sub: 'V3 · out through the lobby frontage from indoors (the west lamp switched on): rain only outside, streaks behind the glass, drips off the roof rim past the panes' },
      sam:    { pin: { look: [17.3, 0.4, 25.9], yaw: -0.4, pitch: 36 * DEG, dist: 5.2 }, player: { pos: [17.3, 0, 25.9], yaw: 2.3 }, sub: 'V5 · Sam standing in the rain in the lamp\'s cone, close: drops end on his head and shoulders as splashes; the wet coat is his own' },
      strike: { pin: { look: [16.5, 0, 25.4], yaw: -22 * DEG, pitch: 55 * DEG, dist: 21 }, player: { pos: [13.5, 0, 25.9], yaw: Math.PI * 0.5 }, sub: 'V4 · the lot under a lightning stroke (bearing south-west, 0.5 km): the streaks flash-lit with the ground' },
      // v2's judging views: a fixed TORCH beam across the east strip by the fire exit seen from low over the lot (backlit streaks in the beam), and the lamp seen from LOW toward it (the forward lobe)
      torch:  { pin: { look: [37.8, 1.0, 21.5], yaw: Math.PI + 0.12, pitch: 15 * DEG, dist: 5.5 }, player: { pos: [30, 0, 8], invisible: true }, torch: { pos: [39.4, 1.35, 26.0], dir: [-0.3, -0.27, -1] }, sub: 'V6 · a torch beam (the guards\' hand-torch numbers, fixed) down the east strip past the fire exit, from low over the lot: the streaks crossing the beam, backlit toward the lens' },
      lamplow:{ pin: { look: [16.0, 1.2, 24.6], yaw: -1.05, pitch: 14 * DEG, dist: 9.5 }, player: { pos: [13.5, 0, 25.9], yaw: Math.PI * 0.5 }, sub: 'V7 · the sodium lamp from head height across the lot, looking INTO it through the rain: the forward lobe (streaks between the eye and the lamp flare)' },
    },
    torchLight: null,
    /** the fixed test torch (= froxel-scenes.js's: the guards' hand torch as a static kind-1 light, owner 0) — made once, parked off unless the view asks for it */
    installTorch() {
      if (P.torchLight) return P.torchLight;
      P.torchLight = E().lights.add({ name: 'prainTorch', group: 'test', kind: 1, pos: [0, -50, 0], dir: [0, -1, 0], color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70 });
      return P.torchLight;
    },
    /** v2: the rain's LOOK presets by name — 'v1' (grey isotropic scatter, no glint / refraction / spread, plumb fall, raw lattice shear) or 'v2' (PRAIN's defaults) — or a partial table */
    look(which) {
      const R = window.__rain; if (!R || !R.setLook) return null;
      if (which === 'v1') return R.setLook({ iso: 1, fwdK: 0, glintK: 0, gain: 1, tailKeep: 0, refract: 0, lenJit: 0, brightJit: 0, minPx: 0.75, maxPx: 64, boostCap: 1, nearFadeM: 2, beadAmp: 0, windK: 0, latticeLean: 0, sheetAmp: 0 });
      if (which === 'v2' || !which) return R.resetLook();
      return R.setLook(which);
    },
    /** stage view `name`: pin the camera, park everybody, place Sam, force the storm (no strokes unless `storm`), zero the animation phases, seed Math.random + the recycler */
    async stage(name, o = {}) {
      const v = P.views[name]; if (!v) throw new Error('no view ' + name);
      window.__testVisible = true; window.__shotPort = P.port;
      if (window.__menu?.close) window.__menu.close();
      const g = G(), w = W();
      g.aiEnabled = false;
      window.__stage(v.pin, { park: true, player: { holstered: true, invisible: false, crouch: false, ...v.player, ...(o.player || {}) } });
      const lw = g.targets.find(t => t.name === 'street_lamp_w'); if (lw) lw.on = !!v.lampW;
      { const tl = P.installTorch(); const T = o.torch || v.torch; if (T) { tl.pos = [...T.pos]; const d = T.dir; const l = Math.hypot(d[0], d[1], d[2]) || 1; tl.dir = [d[0] / l, d[1] / l, d[2] / l]; tl.enabled = true; } else { tl.enabled = false; tl.pos = [0, -50, 0]; } }
      w.setEnabled(true); w.seed(o.seed ?? 4242); w.storm = o.storm ?? 0; w.rainRate = o.rate ?? 0.55; w.wind = [o.windX ?? 1.1, o.windZ ?? 0.45];
      if (window.__wind?.set) window.__wind.set({ gusts: !!o.gusts });   // (v2: the wind's gusting is a noise of the GAME clock, which a stage does not rewind — off for a still so two takes agree; the gust strip asks for it)
      Math.random = seeded(o.mseed ?? 99);
      if (window.__rain) window.__rain.seed(o.rseed ?? 7);
      E().particles?.clear();
      for (const c of [g.player.char, ...g.guards.map(x => x.char), ...(g.civilians || []).map(x => x.char)]) c.anim.phase = 0;
      window.__resetClock();
      window.__runFrames(2, 1 / 60);
      return { view: name, sub: v.sub, prain: !!E().settings.particleRain };
    },
    /** n frames, each followed by a GPU drain + one macrotask (serialized: timings resolve, readbacks land) */
    async settle(n = 60, dt = 1 / 60, keys = []) { const dev = E().device; for (let i = 0; i < n; i++) { window.__runFrames(1, dt, keys); await dev.queue.onSubmittedWorkDone(); await yieldCh(); } },
    async png(name) { window.__shotPort = P.port; return window.__png('ab/' + name); },
    async shot(name, q = 0.93) { window.__shotPort = P.port; return window.__shot('prain/' + name, q); },
    /** the pair for a view: today (particleRain off) and hybrid (on), same staging / seed / frame count — names <tag>-today / <tag>-hybrid */
    async pair(view, tag = view, o = {}) {
      const S = E().settings; const out = {};
      for (const [k, on] of [['today', false], ['hybrid', true]]) {
        S.particleRain = on; await P.stage(view, o); await P.settle(o.settle ?? 150);
        if (o.pre) await o.pre(k);
        out[k] = await P.shot(`${tag}-${k}`); out[k + 'Rain'] = window.__rain?.summary();
      }
      return out;
    },
    /** v2: warm the recycler up after a boot — the first two stages after a boot differ from every later one (the drip lines and the ring settle), so identity pairs stage twice first */
    async warm() { await P.stage('lot'); await P.settle(60); await P.stage('lot'); await P.settle(60); return true; },
    /** v2: the LOOK pair at a view — the same staging / seed / frame count under the 'v1' look and under v2's defaults (or `looks` by name / table): names <tag>-v1 / <tag>-v2 */
    async abLook(view, tag = view, o = {}) {
      const S = E().settings; S.particleRain = true; const out = {}; const looks = o.looks || ['v1', 'v2'];
      for (const k of looks) {
        P.look(k); await P.stage(view, o); await P.settle(o.settle ?? 150);
        if (o.pre) await o.pre(k);
        const nm = typeof k === 'string' ? k : (k.name || 'x');
        out[nm] = await P.shot(`${tag}-${nm}`, o.q ?? 0.97); out[nm + 'Rain'] = window.__rain?.summary();
      }
      P.look('v2');
      return out;
    },
    /** a filmstrip: n shots `every` frames apart after the view is staged + settled (names <tag>-f0‥) */
    async strip(view, tag, n = 6, every = 2, o = {}) {
      const S = E().settings; S.particleRain = o.on ?? true; await P.stage(view, o); await P.settle(o.settle ?? 150);
      const out = []; for (let i = 0; i < n; i++) { if (i) await P.settle(every); out.push(await P.shot(`${tag}-f${i}`, 0.9)); }
      return out;
    },
    /** the TAA smear take: after settling, m consecutive lossless frames (names ab/<tag>-s0‥) — the smear map is their per-pixel max − min offline; `react` overrides settings.particleRainReact for the take */
    async smear(view, tag, m = 8, react = null, o = {}) {
      const S = E().settings; const keep = S.particleRainReact; S.particleRain = o.on ?? true; if (react !== null) S.particleRainReact = react;
      await P.stage(view, o); await P.settle(o.settle ?? 150);
      const out = []; for (let i = 0; i < m; i++) { if (i) await P.settle(1); out.push(await P.png(`${tag}-s${i}`)); }
      S.particleRainReact = keep; return out;
    },
    /** serialized cost take over n frames after `warm`: union mean / p95 + per-pass means (compute passes; render passes excluded) */
    async cost(n = 40, warm = 20, keys = []) {
      const e = E(), dev = e.device, tm = e.timer; const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown'];
      e.particlesTimeDraw = true;   // 'pdraw' = the particles' render pass (informational: render-pass stamps on Metal are not load — kept OUT of the union, quoted beside it)
      await P.settle(warm, 1 / 60, keys);
      const unions = [], walls = [], per = new Map();
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        window.__runFrames(1, 1 / 60, keys); await dev.queue.onSubmittedWorkDone(); await yieldCh();
        walls.push(performance.now() - t0);
        unions.push(tm.unionMs ? tm.unionMs(RP) : NaN);
        for (const [k, v] of tm.results.entries()) { if (/^(composite|post|fxaa|gbuffer|gdown)$/.test(k)) continue; per.set(k, (per.get(k) || 0) + v); }
      }
      e.particlesTimeDraw = false;
      const srt = [...unions].sort((a, b) => a - b); const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const passes = {}; for (const [k, v] of per) passes[k] = +(v / n).toFixed(3);
      const ps = e.particles?.stats;
      return { union: +mean(unions).toFixed(3), p95: +srt[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(3), wall: +mean(walls).toFixed(2), passes, size: `${e.width}x${e.height}→${e.outWidth}x${e.outHeight}`, particles: ps ? { alive: ps.alive, live: [...ps.live], born: ps.born, rain: e.particles.rainStats ? { ...e.particles.rainStats } : null } : null, rain: window.__rain ? window.__rain.summary() : null };
    },
    /** interleaved cost A/B at the staged view: today / hybrid / today / hybrid …, `reps` blocks of n frames each → means per variant */
    async costAB(view, reps = 3, n = 30, o = {}) {
      const S = E().settings; const res = { today: [], hybrid: [] };
      await P.stage(view, o);
      for (let r = 0; r < reps; r++) for (const [k, on] of [['today', false], ['hybrid', true]]) { S.particleRain = on; res[k].push(await P.cost(n, o.warm ?? 45, o.keys || [])); }
      const mean = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3);
      const agg = k => { const rs = res[k]; const names = new Set(); for (const r of rs) for (const nme of Object.keys(r.passes)) names.add(nme); const passes = {}; for (const nme of names) passes[nme] = mean(rs.map(x => x.passes[nme] || 0)); return { union: mean(rs.map(x => x.union)), p95: mean(rs.map(x => x.p95)), wall: mean(rs.map(x => x.wall)), passes, size: rs[0].size, particles: rs[rs.length - 1].particles, rain: rs[rs.length - 1].rain }; };
      const blocks = k => res[k].map(x => ({ union: x.union, p95: x.p95, wall: x.wall, particles: x.passes.particles || 0, volumetrics: x.passes.volumetrics || 0 }));
      return { view, preset: window.__quality?.current, today: agg('today'), hybrid: agg('hybrid'), blocks: { today: blocks('today'), hybrid: blocks('hybrid') } };
    },
  };
  /** v2: interleaved cost at a staged view over THREE variants — today (particle rain off), the v1 look, the v2 look — `reps` blocks of n serialized frames each → means / medians per variant */
  P.costLook = async (view = 'lot', reps = 3, n = 30, o = {}) => {
    const S = E().settings; const res = { today: [], v1: [], v2: [] };
    await P.stage(view, o);
    for (let r = 0; r < reps; r++) for (const k of ['today', 'v1', 'v2']) {
      S.particleRain = k !== 'today'; if (k !== 'today') P.look(k);
      res[k].push(await P.cost(n, o.warm ?? 45, o.keys || []));
    }
    P.look('v2'); S.particleRain = true;
    const mean = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3);
    const med = a => { const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length / 2)].toFixed(3); };
    const agg = k => { const rs = res[k]; const names = new Set(); for (const r of rs) for (const nme of Object.keys(r.passes)) names.add(nme); const passes = {}; for (const nme of names) passes[nme] = mean(rs.map(x => x.passes[nme] || 0)); return { union: mean(rs.map(x => x.union)), unionMed: med(rs.map(x => x.union)), p95: mean(rs.map(x => x.p95)), wall: mean(rs.map(x => x.wall)), passes, size: rs[0].size, particles: rs[rs.length - 1].particles, rain: rs[rs.length - 1].rain, blocks: rs.map(x => ({ union: x.union, p95: x.p95, particles: x.passes.particles || 0, pdraw: x.passes.pdraw || 0, volumetrics: x.passes.volumetrics || 0, alive: x.particles ? x.particles.alive : 0 })) }; };
    return { view, preset: window.__quality?.current, copy: window.__rain?.sceneCopy, today: agg('today'), v1: agg('v1'), v2: agg('v2') };
  };
  /** the cost table over the five presets at one view: apply the preset (auto off), warm, interleaved today / hybrid blocks — fire and forget into window.__prTiers */
  P.tiers = async (view = 'lot', names = ['ultra', 'high', 'medium', 'low', 'verylow'], reps = 2, n = 30) => {
    const Q = window.__quality; const out = { view, rows: [] }; window.__prTiers = out;
    for (const nm of names) { Q.auto = false; Q.apply(nm); await P.settle(30); const r = await P.costAB(view, reps, n, { warm: 40 }); r.preset = nm; out.rows.push(r); out.done = out.rows.length; }
    out.finished = true; return out;
  };
  /** IDENTITY (merge prep): one config per FRESH boot — paste / import this file on a `?paused&quality=<p>&mute[&norain2]` boot of EITHER tree (it needs nothing of the rain's own
   *  hooks), call `await __pr.identity(tag)`; it stages each view from scratch (seeded restart, storm forced, gusts off, a debris burst so the gameplay rings are live), steps `frames`,
   *  renders once at frame.time 100 and FNV-hashes the readback → window.__prIdent = { tag, preset, views: { name: hash }, res }. Compare the hashes across boots / trees by name. */
  P.identity = async (tag = 'x', o = {}) => {
    const frames = o.frames ?? 60; const views = o.views ?? ['lot', 'exit', 'glass'];
    const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldCh(); await yieldCh(); };
    const hash = a => { let h = 0x811c9dc5; for (let i = 0; i < a.data.length; i++) { if ((i & 3) === 3) continue; h ^= a.data[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
    window.__testVisible = true; window.__prIdent = null;
    if (window.__menu?.close) window.__menu.close();
    Math.random = seeded(4242); G().restartEncounter(); window.__runFrames(1, 1 / 60); await settle();
    const out = { tag, preset: window.__quality?.current, particleRain: !!E().settings.particleRain, views: {}, res: null };
    for (const vn of views) {
      const v = P.views[vn]; const g = G(), w = W();
      g.aiEnabled = false;
      window.__stage(v.pin, { park: true, player: { holstered: true, invisible: false, crouch: false, ...v.player } });
      const lw = g.targets.find(t => t.name === 'street_lamp_w'); if (lw) lw.on = !!v.lampW;
      w.setEnabled(true); w.seed(4242); w.storm = 0; w.rainRate = 0.55; w.wind = [1.1, 0.45];
      if (window.__wind?.set) window.__wind.set({ gusts: false });
      Math.random = seeded(99); if (window.__rain?.seed) window.__rain.seed(7);
      E().particles?.clear();
      for (const c of [g.player.char, ...g.guards.map(x => x.char), ...(g.civilians || []).map(x => x.char)]) c.anim.phase = 0;
      E().passes.grain = 0;
      for (let i = 0; i < 6; i++) { window.__runFrames(1, 1 / 60); await settle(); }
      window.__resetClock();
      if (window.__particles?.test) window.__particles.test('debris', [v.pin.look[0] + 1.0, 0.6, v.pin.look[2] + 0.5]);   // the gameplay rings live in the frame (chips landing and lying there): the rain ring past them must not move a byte of theirs
      for (let i = 0; i < frames; i++) { window.__runFrames(1, 1 / 60); if ((i & 7) === 7) await settle(); }
      await settle();
      E().render(window.__cam, 100, 1 / 60, false); await settle();
      const fr = await E().readbackFrame(); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      out.views[vn] = hash(fr); out.res = [fr.w, fr.h];
      if (o.png) { const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h; const d = new Uint8ClampedArray(fr.data.length); d.set(fr.data); for (let i = 3; i < d.length; i += 4) d[i] = 255; c.getContext('2d').putImageData(new ImageData(d, fr.w, fr.h), 0, 0); const blob = await new Promise(res => c.toBlob(b => res(b), 'image/png')); await fetch(`http://localhost:${P.port}/shot?name=${encodeURIComponent('ab/' + tag + '_' + vn)}`, { method: 'POST', body: blob }).catch(() => null); }
    }
    window.__prIdent = out; return out;
  };
  window.__pr = P;
})();
