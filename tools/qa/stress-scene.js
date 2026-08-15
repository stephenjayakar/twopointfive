// THE renderer stress scenario (docs/internal/renderer-v3.md §2, Phase 0 gate): the loud minute the field recordings found the worst frames in — the QRF
// deployed with lit weapon lights, the shift alerted with torches up, rain 0.55 on the lot, two smoke canisters at the corridor junction, GPU particles from
// the firefight, and the camera orbiting the middle of the floor so every room, the lot and the smoke cross the frame — measured with the serialized-frame
// protocol (the dev notes "GPU timing"): every frame is followed by queue.onSubmittedWorkDone() + a MessageChannel yield, so the per-pass timestamps are the
// frame's own and frames never overlap on the GPU.
//
// Plain JS, nothing bundled. On a `?paused&quality=<preset>&mute` boot, once the hooks exist and #view has a size:
//     await import('/qa/stress-scene.js');            // → window.__stress
//     await __stress.setup();                          // ~25 s of game time: QRF requested (ETA 15 s) → deployed + 6 s, canisters popped, camera pinned
//     const r = await __stress.record(600);            // 600 serialized frames, camera orbiting 0.6°/frame; → per-pass mean / p50 / p95 / max + Σ compute
//     __stress.table(r)                                // one-line-per-pass text table
// A/B in one boot: setup() once, then record() under setting A, record() under B, record() under A again (the scene keeps evolving — the smoke thins, the men
// move — so interleave and compare like with like; `__stress.reseed()` between takes puts the dice back but not the world).
// Determinism: Math.random is replaced by a seeded mulberry32 for the whole page (the AI's dice, the smoke jitter), so two boots stepped the same way stage the
// same fight up to GPU readback timing (smoke domain retirement reads mass back asynchronously — the one thing that can differ between takes).
(() => {
  const G = () => window.__game, E = () => window.__engine, C = () => window.__cam;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RENDER = new Set(['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']);
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const DEG = Math.PI / 180;
  const S = {
    center: [24, 0.5, 16], dist: 20, pitch: 0.96, yaw0: -0.35, orbitDeg: 0.6,
    canisters: [[22.3, 0, 15.2], [26.2, 0, 17.2]],
    log: [],
    reseed(seed = 4242) { Math.random = mulberry32(seed); },
    async settle() { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); },
    /** unserialized game steps in chunks (fast-forward; timings from these frames are not used) */
    ff(frames, chunk = 30) { for (let i = 0; i < frames; i += chunk) window.__runFrames(Math.min(chunk, frames - i), 1 / 60); },
    /** Stage the loud minute. opts: { eta = 15 (s, QRF door), after = 6 (s stepped past deployment), smokeLead = 4 (s the canisters have been going when setup returns),
     *  rain = 0.55, fight = true }. fight = true is the TORTURE take: the shift alerted onto Sam with torches up and Sam standing in the open in god mode, so all
     *  seven men converge and shoot for the whole take (gun smoke keeps 8 domains live, muzzle flashes, tracers, impacts) — about 3× the field recordings' load.
     *  fight = false is the gate as the lead wrote it: the QRF deployed and searching with weapon lights lit, the shift as it was, Sam invisible (nobody fires),
     *  rain, the two canisters, the orbit — the field's loud minute without a firefight parked under the camera. */
    async setup(opts = {}) {
      const { eta = 15, after = 6, smokeLead = 4, rain = 0.55, fight = true } = opts;
      S.fight = fight;
      const g = G(), e = E();
      if (!(document.getElementById('view')?.clientWidth > 0)) throw new Error('#view has no size: front the tab / take a screenshot first');
      window.__testVisible = true;
      S.reseed();
      window.__menu?.close();
      g.godMode = true;
      g.tune.qrf = true; g.tune.qrfEta = eta;
      if (window.__weather) { window.__weather.setEnabled?.(true); window.__weather.rainRate = rain; }
      g.teleportPlayer([S.center[0], 0, S.center[2]]);
      g.player.holstered = !fight;                      // fight: pistol in hand — the shift and the QRF have something to shoot at and be lit by
      g.playerInvisible = !fight;                       // no fight: nobody ever sees him, the element searches the floor with its lights on
      S.ff(2);
      // fight: the shift alerted onto Sam, torches up (the panel's 'alert all')
      if (fight) g.guards.forEach(gd => { if (gd.state !== 'dead') { gd.awareness = 1; gd.lastKnown = [...g.player.char.pos]; } });
      const q = window.__qrf; q.request('panel');
      const t0 = g.time;
      // fast-forward to the door going + `after` s, popping the canisters `smokeLead` s before the end
      const total = Math.round((Math.max(12, eta) + after) * 60); const smokeAt = total - Math.round(smokeLead * 60);
      let f = 0;
      while (f < total) {
        const n = Math.min(30, total - f, f < smokeAt ? smokeAt - f : total - f);
        window.__runFrames(n, 1 / 60); f += n;
        if (f === smokeAt) for (const p of S.canisters) window.__smoke.spawnCanister(p);
        if ((f % 300) === 0) await yieldTask();          // keep the page responsive
      }
      C().pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      window.__runFrames(2, 1 / 60); await S.settle();
      const st = S.state();
      S.log.push(`setup: qrf ${st.qrf} after ${(g.time - t0).toFixed(1)} s · ${st.lights} lights (${st.lit} lit carried) · smoke ${st.smoke} dom · particles ${st.pslots} slots · guards ${st.guards}`);
      return S.log[S.log.length - 1];
    },
    state() {
      const g = G(), e = E();
      let lit = 0; for (const gd of g.guards) if (gd.flashlight?.enabled && gd.state !== 'dead') lit++;
      const P = e.particles;
      return { qrf: g.qrf?.state, lights: e.lights.activeCount, lit, smoke: window.__smoke?.stats?.live ?? 0, pslots: P ? P.liveSlots : 0, palive: P?.stats?.alive ?? 0, guards: g.guards.map(x => x.state).join(','), preset: window.__quality?.label, res: [e.width, e.height], t: +g.time.toFixed(2) };
    },
    /** n serialized frames with the camera orbiting; per-pass arrays → stats. opts: { orbit = true, dt = 1/60, keepYaw = false } */
    async record(n = 600, opts = {}) {
      const { orbit = true, dt = 1 / 60 } = opts;
      const e = E(), t = e.timer, cam = C();
      if (!cam.pin) cam.pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      const per = new Map(); const sums = []; const ctx = { lights: [], smoke: [], pslots: [] };
      let got = 0, missed = 0;
      const st0 = S.state();
      for (let i = 0; i < n; i++) {
        if (orbit) cam.pin.yaw += S.orbitDeg * DEG;
        const before = t.resolved;
        window.__runFrames(1, dt);
        await S.settle();
        for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
        if (t.resolved === before) { missed++; continue; }
        got++;
        let sum = 0;
        for (const [k, v] of t.lastFrame) { if (!per.has(k)) per.set(k, []); per.get(k).push(v); if (!RENDER.has(k)) sum += v; }
        sums.push(sum);
        ctx.lights.push(e.lights.activeCount); ctx.smoke.push(window.__smoke?.stats?.live ?? 0); ctx.pslots.push(e.particles ? e.particles.liveSlots : 0);
      }
      const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: +m.toFixed(3), p50: +s[Math.floor(0.5 * (s.length - 1))].toFixed(3), p95: +s[Math.floor(0.95 * (s.length - 1))].toFixed(3), max: +s[s.length - 1].toFixed(3) }; };
      const passes = {}; for (const [k, a] of per) if (!RENDER.has(k)) passes[k] = stat(a);
      const st1 = S.state();
      return { frames: got, missed, preset: st1.preset, res: st1.res, sum: stat(sums), passes, ctx: { lights: stat(ctx.lights), smoke: stat(ctx.smoke), pslots: stat(ctx.pslots) }, start: st0, end: st1 };
    },
    /** the Phase 0 caps off (= the renderer before them: volLightCap 0 is the old volumetric pass bit for bit, 6144 births = the old ceiling, 8 = every smoke
     *  domain every frame) or as the pinned preset sets them (re-applies the whole preset) */
    caps(on) {
      const St = E().settings;
      if (on) { window.__quality.apply(window.__quality.current); return `caps on: K ${St.volLightCap} every ${St.volShadowEvery} step ${St.volStepVoxels} · births ${St.particleBirths} · smoke full ${window.__smoke.params.fullRateDomains}`; }
      St.volLightCap = 0; St.particleBirths = 6144; window.__smoke.params.fullRateDomains = 8; return 'caps off';
    },
    /** Interleaved A/B over the SAME evolving scene: `blocks` × (`per` frames under A, `per` frames under B), the orbit running throughout; applyA / applyB flip
     *  the settings. → { A: stats, B: stats } shaped like record()'s result (so table() prints either). The scene thins and moves over a minute, so one long take
     *  per variant would compare different minutes; short alternating blocks sample the same stretch for both. */
    async ab(applyA, applyB, opts = {}) {
      const { blocks = 6, per = 100, dt = 1 / 60, warm = 4 } = opts;
      const e = E(), t = e.timer, cam = C();
      if (!cam.pin) cam.pin = { look: [...S.center], yaw: S.yaw0, pitch: S.pitch, dist: S.dist };
      const pools = [{ per: new Map(), sums: [], ctx: { lights: [], smoke: [], pslots: [] }, got: 0, missed: 0 }, { per: new Map(), sums: [], ctx: { lights: [], smoke: [], pslots: [] }, got: 0, missed: 0 }];
      const st0 = S.state();
      for (let b = 0; b < blocks; b++) for (let vv = 0; vv < 2; vv++) {
        const v = (b & 1) ? 1 - vv : vv;                              // A B, B A, A B … — neither variant is systematically the later (heavier or thinner) half of a pair
        (v === 0 ? applyA : applyB)();
        const P = pools[v];
        for (let i = 0; i < per + warm; i++) {
          cam.pin.yaw += S.orbitDeg * DEG;
          const before = t.resolved;
          window.__runFrames(1, dt);
          await S.settle();
          for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
          if (i < warm) continue;                                   // (a settings flip can recreate targets / change divisors: let it settle)
          if (t.resolved === before) { P.missed++; continue; }
          P.got++;
          let sum = 0;
          for (const [k, val] of t.lastFrame) { if (!P.per.has(k)) P.per.set(k, []); P.per.get(k).push(val); if (!RENDER.has(k)) sum += val; }
          P.sums.push(sum);
          P.ctx.lights.push(e.lights.activeCount); P.ctx.smoke.push(window.__smoke?.stats?.live ?? 0); P.ctx.pslots.push(e.particles ? e.particles.liveSlots : 0);
        }
      }
      applyA();
      const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: +m.toFixed(3), p50: +s[Math.floor(0.5 * (s.length - 1))].toFixed(3), p95: +s[Math.floor(0.95 * (s.length - 1))].toFixed(3), max: +s[s.length - 1].toFixed(3) }; };
      const st1 = S.state();
      const shape = P => { const passes = {}, raw = {}; for (const [k, a] of P.per) if (!RENDER.has(k)) { passes[k] = stat(a); raw[k] = a.map(x => +x.toFixed(3)); } return { frames: P.got, missed: P.missed, preset: st1.preset, res: st1.res, sum: stat(P.sums), passes, ctx: { lights: stat(P.ctx.lights), smoke: stat(P.ctx.smoke), pslots: stat(P.ctx.pslots) }, start: st0, end: st1, raw: { sums: P.sums.map(x => +x.toFixed(3)), passes: raw, smoke: P.ctx.smoke, pslots: P.ctx.pslots } }; };   // raw per-frame arrays: tools/qa/stress-report.ts drops frames another GPU client visibly shared (a fixed-cost pass like bloom far over its median)
      return { A: shape(pools[0]), B: shape(pools[1]) };
    },
    /** text table of a record() result: pass mean p50 p95 max (sorted by mean), Σ first */
    table(r) {
      const row = (k, s) => `${k.padEnd(12)} ${s.mean.toFixed(2).padStart(6)} ${s.p50.toFixed(2).padStart(6)} ${s.p95.toFixed(2).padStart(6)} ${s.max.toFixed(2).padStart(6)}  (${s.n})`;
      const lines = [`${r.preset} ${r.res.join('×')} · ${r.frames} frames (${r.missed} missed) · lights ${r.ctx.lights.mean}/${r.ctx.lights.max} smoke ${r.ctx.smoke.mean}/${r.ctx.smoke.max} pslots ${r.ctx.pslots.mean}/${r.ctx.pslots.max}`, 'pass           mean    p50    p95    max', row('Σ compute', r.sum)];
      for (const [k, s] of Object.entries(r.passes).sort((a, b) => b[1].mean - a[1].mean)) lines.push(row(k, s));
      return lines.join('\n');
    },
  };
  window.__stress = S;
  return 'stress scene ready: await __stress.setup(); const r = await __stress.record(600); __stress.table(r)';
})();
