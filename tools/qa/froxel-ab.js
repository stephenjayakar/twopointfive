// Interleaved A/B over the staged stress minute (tools/qa/stress-scene.js) recording what the froxel lane's tables need per frame: the volumetric TOTAL
// (Σ of every timed pass whose name starts with 'vol' — volFroxel + volumetrics by default, or volInject + volTemporal + volInteg + volumetrics with
// engine.passes.froxelSplitTiming on), the union of the compute passes' GPU intervals (timer.unionMs), Σ compute, and every pass — ABBA block order,
// serialized frames, the orbit running throughout, exactly as __stress.ab does. On a `?paused&quality=<p>&mute` boot with #view visible:
//     await import('/qa/stress-scene.js'); await import('/qa/froxel-ab.js');
//     await __stress.setup({ fight: false });                                   // or true = the torture take
//     const S = __engine.settings; const r = await __froxab.ab(() => { S.froxelVol = false; }, () => { S.froxelVol = true; }, { blocks: 6, per: 100 });
//     __froxab.table(r)
// Long takes: start without awaiting and poll __froxab.progress.
(() => {
  const E = () => window.__engine, C = () => window.__cam;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RENDER = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'taau', 'present'];
  const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return { n: a.length, mean: +m.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
  const F = {
    progress: { block: 0, of: 0 },
    /** one serialized frame; → { vol, union, sum, per } or null when the timer readback did not resolve */
    async frame(dt = 1 / 60) {
      const e = E(), t = e.timer;
      const before = t.resolved;
      window.__runFrames(1, dt);
      await e.device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
      for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
      if (t.resolved === before) return null;
      let vol = 0, sum = 0; const per = {};
      for (const [k, ms] of t.lastFrame) { if (RENDER.includes(k)) continue; sum += ms; if (k.startsWith('vol')) vol += ms; per[k] = ms; }
      return { vol, sum, union: t.unionMs(RENDER), per };
    },
    async ab(applyA, applyB, opts = {}) {
      const { blocks = 6, per = 100, dt = 1 / 60, warm = 4, orbit = true } = opts;
      const e = E(), cam = C(), S = window.__stress;
      if (S && !cam.pin) cam.pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      const pools = [0, 1].map(() => ({ vol: [], union: [], sum: [], per: {}, missed: 0, smoke: [], lights: [] }));
      F.progress = { block: 0, of: blocks };
      for (let b = 0; b < blocks; b++) for (let vv = 0; vv < 2; vv++) {
        const v = (b & 1) ? 1 - vv : vv;                              // A B, B A, A B … — neither variant is systematically the later half of a pair
        (v === 0 ? applyA : applyB)();
        const P = pools[v];
        for (let i = 0; i < per + warm; i++) {
          if (orbit && cam.pin && S) cam.pin.yaw += S.orbitDeg * Math.PI / 180;
          const f = await F.frame(dt);
          if (i < warm) continue;                                   // (a flip re-makes / restarts things: let it settle)
          if (!f) { P.missed++; continue; }
          P.vol.push(f.vol); P.sum.push(f.sum); P.union.push(f.union);
          for (const k in f.per) (P.per[k] ??= []).push(f.per[k]);
          P.smoke.push(window.__smoke?.stats?.live ?? 0); P.lights.push(e.lights.activeCount);
        }
        F.progress = { block: b + 1, of: blocks };
      }
      applyA();
      // frames another GPU client visibly shared are dropped (tools/qa/stress-report.ts's rule: a fixed-cost pass — bloom — over 4× its own median or 0.4 ms); the raw arrays stay
      const shape = P => {
        const bloom = P.per.bloom ?? []; const med = bloom.length ? stat(bloom).p50 : 0; const thr = Math.max(0.4, 4 * med);
        const keep = P.vol.map((_, i) => (bloom[i] ?? 0) <= thr); const pick = a => a.filter((_, i) => keep[i]);
        const passes = {}; for (const k in P.per) passes[k] = stat(pick(P.per[k]));
        return { vol: stat(pick(P.vol)), union: stat(pick(P.union)), sum: stat(pick(P.sum)), missed: P.missed, dropped: keep.length - keep.filter(Boolean).length, smoke: stat(P.smoke), lights: stat(P.lights), passes,
                 rawStats: { vol: stat(P.vol), union: stat(P.union) }, raw: { vol: P.vol.map(x => +x.toFixed(3)), union: P.union.map(x => +x.toFixed(3)), bloom: bloom.map(x => +x.toFixed(3)) } };
      };
      return { A: shape(pools[0]), B: shape(pools[1]), preset: window.__quality?.current, res: [e.width, e.height], fight: S?.fight };
    },
    /** EVERY TIER in one boot, the same staged minute each (as tools/qa/v3-gate.js runAll): restartEncounter → apply the preset → __stress.setup({ fight }) →
     *  ab(march, froxel). opts: { presets, fight, blocks, per }. Start it un-awaited and poll `progress` / `results`; → { [preset]: ab result }. */
    async runAll(opts = {}) {
      const { presets = ['high', 'ultra', 'medium', 'low', 'verylow'], fight = false, blocks = 6, per = 100 } = opts;
      const S = E().settings;
      F.results = {}; F.status = { phase: 'starting', preset: null, done: [] };
      for (const p of presets) {
        F.status = { ...F.status, phase: 'staging', preset: p };
        try {
          window.__pauseLoop = true;
          S.froxelVol = true;
          window.__game.restartEncounter(); window.__menu?.close?.(); window.__runFrames(2, 1 / 60);
          window.__quality.auto = false; window.__quality.apply(p); window.__runFrames(4, 1 / 60);
          if (window.__cam) window.__cam.pin = null;
          await window.__stress.setup({ fight });
          F.status = { ...F.status, phase: 'ab' };
          const r = await F.ab(() => { S.froxelVol = false; }, () => { S.froxelVol = true; }, { blocks, per });
          r.grid = window.__froxel ? { ...window.__froxel.grid } : null; r.setup = window.__stress.log[window.__stress.log.length - 1];
          F.results[p] = r; F.status.done.push(p);
        } catch (e) { F.results[p] = { error: String(e.stack || e.message).slice(0, 300) }; F.status.done.push(p + '!'); }
      }
      F.status = { ...F.status, phase: 'done', preset: null };
      return F.results;
    },
    /** compact per-tier summary of runAll's results: march → froxel, vol mean/p95/max, union mean/p95/max */
    summary() {
      const out = {};
      for (const [p, r] of Object.entries(F.results || {})) {
        if (!r || r.error) { out[p] = { error: r && r.error }; continue; }
        const v = x => [x.vol.mean, x.vol.p95, x.vol.max], u = x => [x.union.mean, x.union.p95, x.union.max];
        out[p] = { res: r.res.join('x'), grid: r.grid && `${r.grid.w}x${r.grid.h}x${r.grid.d} k${r.grid.k} ${r.grid.mb}MB`, marchVol: v(r.A), froxelVol: v(r.B), marchUnion: u(r.A), froxelUnion: u(r.B), smoke: [r.B.smoke.mean, r.B.smoke.max], lights: r.B.lights.mean, frames: [r.A.vol.n, r.B.vol.n], dropped: [r.A.dropped, r.B.dropped], unfilteredVolP95: [r.A.rawStats?.vol.p95, r.B.rawStats?.vol.p95] };
      }
      return out;
    },
    /** the two rows the lane's report quotes: vol mean/p95/max · union mean/p95/max · Σ p95, A then B */
    table(r) {
      const row = (n, x) => `${n.padEnd(8)} vol ${x.vol.mean.toFixed(2)} / ${x.vol.p95.toFixed(2)} / ${x.vol.max.toFixed(2)}   union ${x.union.mean.toFixed(1)} / ${x.union.p95.toFixed(1)} / ${x.union.max.toFixed(1)}   Σ p95 ${x.sum.p95.toFixed(1)}   (${x.vol.n} frames${x.dropped ? `, ${x.dropped} contended dropped` : ''}, smoke ${x.smoke.mean}/${x.smoke.max} dom, lights ${x.lights.mean}; unfiltered vol p95 ${x.rawStats ? x.rawStats.vol.p95.toFixed(2) : '?'})`;
      return `${r.preset} ${r.res.join('×')} ${r.fight ? 'TORTURE' : 'gate'}\n${row('A', r.A)}\n${row('B', r.B)}`;
    },
  };
  window.__froxab = F;
})();
