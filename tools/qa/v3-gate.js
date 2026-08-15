// THE renderer-v3 per-tier gate (the work log ('RENDERER V3 — PROGRAM')): on a `?paused&quality=<p>&mute` boot —
//   await import('/qa/stress-scene.js'); await import('/qa/v3-gate.js'); JSON.stringify(await __v3gate.run({ fight: false }))
// (1) stages the stress minute (__stress.setup), (2) a SERIALIZED take: 300 frames orbiting, per frame Σ compute AND the union of the compute passes'
// GPU intervals (timer.unionMs) → mean/p50/p95/max, (3) a LIVE take: the rAF loop released for `liveSecs` with the orbit driven from a timer and the F9
// recorder running → presented fps mean/p5, wall dt p95/max, gpuUnion p95 from the recorder's frames. Returns one object; the lead compares tiers.
(() => {
  const E = () => window.__engine;
  const RENDER = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'present'];   // render-pass timestamps (unreliable on Metal) — NOT 'taau': the TAAU resolve is a compute pass with honest stamps and real cost, it belongs in Σ and the union
  const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return { n: a.length, mean: +m.toFixed(2), p5: +q(0.05).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const G = {
    async serialized(n = 300) {
      const e = E(), t = e.timer, cam = window.__cam, S = window.__stress;
      if (!cam.pin) cam.pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      const sums = [], unions = [], per = new Map(); let missed = 0;
      for (let i = 0; i < n; i++) {
        cam.pin.yaw += S.orbitDeg * Math.PI / 180;
        const before = t.resolved; window.__runFrames(1, 1 / 60); await e.device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
        for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
        if (t.resolved === before) { missed++; continue; }
        let sum = 0; for (const [k, v] of t.lastFrame) { if (RENDER.includes(k)) continue; sum += v; if (!per.has(k)) per.set(k, []); per.get(k).push(v); }
        sums.push(sum); unions.push(t.unionMs ? t.unionMs(RENDER) : sum);
      }
      const passes = {}; for (const [k, a] of per) passes[k] = stat(a);
      return { frames: sums.length, missed, sum: stat(sums), union: stat(unions), passes };
    },
    async live(secs = 20) {
      const cam = window.__cam, S = window.__stress, R = window.__perfrec;
      if (!cam.pin) cam.pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      const iv = setInterval(() => { cam.pin.yaw += S.orbitDeg * Math.PI / 180 * 1.0; }, 1000 / 60);
      window.__testVisible = true;
      try { R.start('v3-gate live'); } catch (e) {}
      window.__pauseLoop = false;
      await new Promise(r => setTimeout(r, secs * 1000));
      window.__pauseLoop = true; clearInterval(iv);
      let dump = null; try { dump = R.stop(); } catch (e) {}
      const F = (dump && dump.frames) || [];
      const warm = F.slice(Math.min(30, F.length));   // drop the first half second (loop spin-up)
      return { frames: warm.length, fps: stat(warm.map(f => f.fps)), dt: stat(warm.map(f => f.dt)), gpuUnion: stat(warm.map(f => f.gpuUnion ?? f.gpuSum)), gpuSum: stat(warm.map(f => f.gpuSum)), over25: warm.filter(f => f.dt > 25).length, over33: warm.filter(f => f.dt > 33.4).length };
    },
    async run(opts = {}) {
      const { fight = false, n = 300, liveSecs = 20 } = opts;
      const e = E();
      await window.__stress.setup({ fight });
      const ser = await G.serialized(n);
      const live = liveSecs > 0 ? await G.live(liveSecs) : { frames: 0 };
      return { preset: window.__quality.current, res: [e.width, e.height], eff: +e.effectiveScale.toFixed(3), fight, serialized: ser, live, state: window.__stress.state ? window.__stress.state() : null };
    },
  };
  Object.assign(G, {
  /** ALL FIVE TIERS in one boot, the same staged minute each: restartEncounter() (resets the QRF wave, smoke, marks, lights) → apply the preset →
   *  __stress.setup → the serialized take (+ the live take when the page is visible). opts: { presets, fight, n, liveSecs }. → { [preset]: run() result }.
   *  Kick it off without awaiting from an automation tool with a short timeout, poll `__v3gate.status`, read `__v3gate.results`. */
  async runAll(opts = {}) {
    const { presets = ['high', 'ultra', 'medium', 'low', 'verylow'], fight = false, n = 300, liveSecs = (document.hidden ? 0 : 20) } = opts;
    G.results = {}; G.status = { phase: 'starting', preset: null, done: [] };
    for (const p of presets) {
      G.status = { ...G.status, phase: 'staging', preset: p };
      try {
        window.__pauseLoop = true;
        window.__game.restartEncounter(); window.__menu?.close?.(); window.__runFrames(2, 1 / 60);
        window.__quality.auto = false; window.__quality.apply(p); window.__runFrames(4, 1 / 60);
        if (window.__cam) window.__cam.pin = null;
        const r = await G.run({ fight, n, liveSecs: Math.max(0, liveSecs) });
        G.results[p] = r; G.status.done.push(p);
      } catch (e) { G.results[p] = { error: String(e.stack || e.message).slice(0, 300) }; G.status.done.push(p + '!'); }
    }
    G.status = { ...G.status, phase: 'done', preset: null };
    return G.results;
  },
  /** compact per-tier summary of runAll's results (what the lead pastes into STATUS) */
  summary() {
    const out = {};
    for (const [p, r] of Object.entries(G.results || {})) {
      if (!r || r.error) { out[p] = { error: r && r.error }; continue; }
      const S = r.serialized, P = S.passes, pick = k => P[k] ? [P[k].mean, P[k].p95, P[k].max] : null;
      const volSum = ['volumetrics', 'volFroxel', 'volInject', 'volTemporal', 'volInteg'].filter(k => P[k]);   // everything volumetric: the 2D pass + the froxel kernels (renderer v3 phase 2b) — per-frame sums are not kept here, so vol = Σ of the passes' own mean / p95 / max (an upper bound on the true p95 / max)
      out[p] = { res: r.res.join('x'), union: [S.union.mean, S.union.p50, S.union.p95, S.union.max], direct: pick('direct'), vol: volSum.length ? [0, 1, 2].map(i => +volSum.reduce((a, k) => a + pick(k)[i], 0).toFixed(2)) : null, vol2D: pick('volumetrics'), volFroxel: pick('volFroxel'), gather: pick('gather'), softblur: pick('softblur'), smoke: pick('smoke'), live: r.live && r.live.frames ? { fpsMean: r.live.fps.mean, fpsP5: r.live.fps.p5, dtP95: r.live.dt.p95, dtMax: r.live.dt.max, unionP95: r.live.gpuUnion && r.live.gpuUnion.p95, over25: r.live.over25 } : null, lights: r.state && r.state.lights, smokeDomains: r.state && r.state.smoke };
    }
    return out;
  },
  });
  window.__v3gate = G;
})();
