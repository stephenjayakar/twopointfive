// The smoke solver's bench (src/smoke/smoke.ts, the brick pool): canisters at fixed places, timed with the serialized-frame protocol (CLAUDE.md "GPU timing"). ONE FRESH BOOT A RUN:
//     /?paused&quality=high&mute                    the pool as it ships (&smokepool=8192 = a pool twice the size, read once before the pipelines are built)
// (It was written to time the pool against the eight boxes it replaced in 2026-10; the boxes' takes are docs/perf/sparse-lab-boxes-*.json, made by this file as it stood at 1530281c.)
// then in the page's console:
//     await import('/qa/sparse-lab.js'); await __spl.run()
// → a table per row (1 / 4 / 8 / 12 canisters, each let run `lead` seconds, the last `take` frames measured), then ONE canister followed through its whole life (40 s, a sample every 2 s: a can
// vents for 32 s and the pool's bill grows with the plume's age), two more rows of 4 canisters (the step's five parts timed apart; direct in place of indirect dispatch) and a JSON file
// downloaded: twopointsix-sparse-lab-sparse-<preset>.json. A part that throws is named under `failed` and the file still comes with everything measured before it; `gpuErrors` = the device's own.
// The pool runs AS IT SHIPS (calm and far bricks wait, fresh smoke first).
// ROUND TWO (same boot, after run() or by itself):
//     await __spl.round2()
// → each lever flipped IN PLACE on a standing field, on / off interleaved (a hanging plume · four burning · the pool full · smoke far from where the camera looks · the camera close in), then the dry
// pool: twelve cans, a thirteenth thrown at the middle of the view ten seconds later, with and without `fresh`, against the same can alone; then a magazine on AUTO, with and without the fine lattice's rule (`fineDecay`, `fineShare`). File: twopointsix-sparse-lab2-<pool>-<preset>.json.
// __spl.asBenched() = every round-two rule off for the rest of the page's life (the pool as round one timed it).
// Plain JS, nothing bundled.
(() => {
  const G = () => window.__game, E = () => window.__engine, S = () => window.__smoke;
  const SHIPPED = { ...(S().sparse ?? {}) };   // (the pool's knobs as this page booted them, before anything here moves one)
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RENDER = new Set(['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']);   // render-pass stamps span the wait for the drawable on Metal
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const p95 = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0; };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;   // (Chrome rounds its timestamps: a mean over the take resolves under that step, a median does not)
  const r2 = x => +x.toFixed(2);

  /** open-floor spots at least `gap` metres apart, nearest the view's middle first (it reads the nav grid alone) */
  function spots(n, centre, gap = 3.2) {
    if (n <= 0) return [];
    const nav = G().col.nav, out = [], c = [];
    for (let z = 2; z < nav.H - 2; z++) for (let x = 2; x < nav.W - 2; x++) {
      let free = true; for (let dz = -2; dz <= 2 && free; dz++) for (let dx = -2; dx <= 2; dx++) if (nav.blocked[(z + dz) * nav.W + x + dx]) { free = false; break; }
      if (free) c.push([(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]);
    }
    c.sort((a, b) => Math.hypot(a[0] - centre[0], a[2] - centre[2]) - Math.hypot(b[0] - centre[0], b[2] - centre[2]));
    for (const p of c) { if (out.every(q => Math.hypot(p[0] - q[0], p[2] - q[2]) >= gap)) out.push(p); if (out.length === n) break; }
    return out;
  }

  const L = {
    view: { look: [20, 0.5, 14], yaw: 0.6, pitch: 1.05, dist: 20 },
    rows: [1, 4, 8, 12], lead: 8, take: 90, dt: 1 / 60, lifeSecs: 40, lifeEvery: 2,
    spots,
    async frame() { window.__runFrames(1, L.dt); await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); },
    stage() {
      window.__testVisible = true; window.__menu?.close(); G().aiEnabled = false;
      window.__stage(L.view, { park: true, player: { pos: [34, 0, 6], invisible: true } });
    },
    /** one row: n canisters, `lead` s of game time, the last `take` frames measured */
    async row(n, opts = {}) {
      const lead = opts.lead ?? L.lead, take = opts.take ?? L.take, s = S(), t = E().timer;
      s.clearAll(); for (let i = 0; i < 4; i++) await L.frame();
      s.stats.peak = 0;   // (the row's own)
      const was = { failed: s.stats.failedTotal };
      const at = spots(n, L.view.look); for (const p of at) s.spawnCanister(p);
      const total = Math.round(lead / L.dt), acc = new Map(), union = [], smoke = [], pool = [];
      for (let f = 0; f < total; f++) {
        await L.frame();
        if (f < total - take) continue;
        let sm = 0;
        for (const [k, v] of t.lastFrame) { if (RENDER.has(k)) continue; if (!acc.has(k)) acc.set(k, []); acc.get(k).push(v); if (k.startsWith('smoke')) sm += v; }
        union.push(t.unionMs([...RENDER])); smoke.push(sm); pool.push(s.stats.pool);
      }
      const passes = {}; for (const [k, v] of acc) passes[k] = r2(med(v));
      const st = s.stats;
      return {
        cans: n, placed: at.length, solverMs: r2(med(smoke)), solverMean: r2(mean(smoke)), solverP95: r2(p95(smoke)), solverTimed: smoke.filter(x => x > 0).length /* frames of the take with a solver stamp: the timer drops a pass over 1 s, as a software GPU's can be */, unionMs: r2(med(union)), unionMean: r2(mean(union)), unionP95: r2(p95(union)),
        bricks: med(pool), stepped: st.stepped, withSmoke: st.bricksScalar, peak: st.peak, refusedBricks: st.failedTotal - was.failed, boxes: st.boxes,
        passes,
      };
    },
    /** ONE canister over its whole life (it vents for `smoke.params.canisterDuration` s, then hangs): the cost against the plume's age, a sample every `every` s = the medians of the frames since the last */
    async life(opts = {}) {
      const secs = opts.lifeSecs ?? L.lifeSecs, every = opts.lifeEvery ?? L.lifeEvery, s = S(), t = E().timer, out = [];
      s.clearAll(); for (let i = 0; i < 4; i++) await L.frame();
      const failed0 = s.stats.failedTotal; for (const p of spots(1, L.view.look)) s.spawnCanister(p);
      const total = Math.round(secs / L.dt), per = Math.max(1, Math.round(every / L.dt)); let union = [], smoke = [];
      for (let f = 1; f <= total; f++) {
        await L.frame();
        let sm = 0; for (const [k, v] of t.lastFrame) if (k.startsWith('smoke')) sm += v;
        union.push(t.unionMs([...RENDER])); smoke.push(sm);
        if (f % per && f !== total) continue;
        out.push({ t: r2(f * L.dt), solverMs: r2(med(smoke)), unionMs: r2(med(union)), withSmoke: s.stats.bricksScalar,
          bricks: s.stats.pool, stepped: s.stats.stepped, refusedBricks: s.stats.failedTotal - failed0 });
        union = []; smoke = []; console.log('one can', JSON.stringify(out[out.length - 1]));
      }
      return out;
    },
    /** n frames as they come: the raw per-frame numbers */
    async takeFrames(n) {
      const t = E().timer, s = S(), o = { union: [], solver: [], stepped: [], pool: [], passes: new Map() };
      for (let f = 0; f < n; f++) {
        await L.frame(); let sm = 0;
        for (const [k, v] of t.lastFrame) { if (RENDER.has(k)) continue; if (k.startsWith('smoke')) sm += v; else { if (!o.passes.has(k)) o.passes.set(k, []); o.passes.get(k).push(v); } }
        o.union.push(t.unionMs([...RENDER])); o.solver.push(sm); o.stepped.push(s.stats.stepped); o.pool.push(s.stats.pool);
      }
      return o;
    },
    /** the pool as round one benched it (commit 3781d45's rules): every brick every frame, reads asked brick by brick, first come at a dry pool, indirect dispatch at any fill */
    BENCHED: { calmMax: 1, farCells: 0, readSkip: false, directAt: 2, fresh: 0, fineDecay: 0, fineShare: 1 },
    asBenched() { Object.assign(S().sparse, L.BENCHED); return { ...S().sparse }; },
    /** one knob of __smoke.sparse (or of opts.table), `on` against `off`, flipped in place on the field as it stands: `rounds` × (settle, take n) each way, interleaved */
    async lever(key, on, off, opts = {}) {
      const k = opts.table ?? S().sparse, was = { ...k }, rounds = opts.rounds ?? 3, n = opts.n ?? 30, settle = opts.settle ?? 8, side = [[], []];
      const put = v => { if (v && typeof v === 'object') Object.assign(k, v); else k[key] = v; };   // (an object = several knobs as one lever)
      try { for (let r = 0; r < rounds; r++) for (const i of [0, 1]) { put(i ? off : on); for (let f = 0; f < settle; f++) await L.frame(); side[i].push(await L.takeFrames(n)); } } finally { Object.assign(k, was); }
      const fold = a => { const all = f => a.flatMap(f), ps = {}; for (const name of a[0].passes.keys()) ps[name] = r2(mean(all(x => x.passes.get(name) ?? [])));
        return { solverMs: r2(mean(all(x => x.solver))), unionMs: r2(mean(all(x => x.union))), unionMed: r2(med(all(x => x.union))), stepped: Math.round(mean(all(x => x.stepped))), bricks: Math.round(mean(all(x => x.pool))), passes: ps }; };
      const A = fold(side[0]), B = fold(side[1]);
      const out = { lever: key, on, off, solver: [A.solverMs, B.solverMs], union: [A.unionMs, B.unionMs], unionMed: [A.unionMed, B.unionMed], stepped: [A.stepped, B.stepped], bricks: [A.bricks, B.bricks], passes: [A.passes, B.passes] };
      console.log(JSON.stringify({ ...out, passes: undefined })); return out;
    },
    async round2(opts = {}) {
      const gpuErrors = [], onErr = e => { if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message ?? e).slice(0, 400)); };
      E().device.addEventListener('uncapturederror', onErr);
      const s = S(), scenes = [], dry = [], failed = [], view0 = L.view;
      const part = async (name, fn) => { try { await fn(); } catch (e) { failed.push({ part: name, error: String(e?.stack ?? e).slice(0, 600) }); console.error('sparse-lab:', name, e); } };
      const run = async secs => { for (let f = 0, n = Math.round(secs / L.dt); f < n; f++) await L.frame(); };
      const CALM = ['calmMax', 4, 1], READ = ['readSkip', true, false], DIRECT = ['directAt', 0.5, 2], FAR = ['farCells', 1, 0], LAX = ['calmCells', s.params.calmCells, 2 * s.params.calmCells, s.params];   // (LAX: not an off switch — the calm bar as it ships against twice as lax)
      const { fresh: _f, fineDecay: _g, fineShare: _h, ...costOff } = L.BENCHED, ALL = ['all three', Object.fromEntries(Object.keys(costOff).map(x => [x, s.sparse[x]])), costOff];   // (calm + far, reads, dispatch together as this page booted them: what round two is worth on a frame; `readSkip` boots off since the Mac's take, so it is the same on both sides here)
      const mid = view0.look, k = opts.k ?? 1;   // (k: every lead × k, for a rig that cannot afford the seconds)
      const SC = [
        { name: 'one can, burnt 6 s, hanging at 14 s', view: view0, cans: () => spots(1, mid), burn: 6, lead: 14, levers: [CALM, LAX, READ, ALL] },
        { name: 'four cans burning, 8 s', view: view0, cans: () => spots(4, mid), lead: 8, levers: [CALM, READ, DIRECT, ALL] },
        { name: 'twelve cans, 8 s: the pool full', view: view0, cans: () => spots(12, mid), lead: 8, levers: [CALM, LAX, READ, DIRECT, ALL] },
        { name: 'four cans 25 m from where the camera looks, 8 s', view: { look: [34, 0.5, 7], yaw: 0.6, pitch: 1.05, dist: 12 }, cans: () => spots(4, [8, 0, 19]), lead: 8, levers: [FAR, CALM, ALL] },
        { name: 'one can, 8 s, the camera 5 m off', view: { look: [mid[0], 0.8, mid[2]], yaw: 0.6, pitch: 0.5, dist: 5 }, cans: () => spots(1, mid), lead: 8, levers: [READ, CALM, ALL] },
      ];
      for (const sc of opts.scenes ? SC.filter((_, i) => opts.scenes.includes(i)) : SC) await part(sc.name, async () => {
        L.view = sc.view; L.stage(); s.clearAll(); await run(0.1);
        for (const p of sc.cans()) s.spawnCanister(p, sc.burn);
        await run(sc.lead * k); console.log(sc.name);
        const row = { scene: sc.name, levers: [] }; scenes.push(row);
        for (const [key, on, off, table] of sc.levers) row.levers.push(await L.lever(key, on, off, { ...opts, table }));
      });
      L.view = view0; L.stage();
      // the dry pool: what a can thrown into a pool full of old smoke gets, against the same can alone
      const at = spots(13, mid), R = 1.6, ages = [1, 2, 3, 4, 6];
      for (const [name, old, fresh] of opts.dry === false ? [] : [['alone', 0, s.sparse.fresh], ['into twelve, fresh smoke first', 12, s.sparse.fresh], ['into twelve, first come', 12, 0]]) await part('dry pool: ' + name, async () => {
        const was = s.sparse.fresh; s.sparse.fresh = fresh;
        try {
          s.clearAll(); await run(0.1); for (const p of at.slice(1, 1 + old)) s.spawnCanister(p);
          await run(10 * k); const before = { bricks: s.stats.pool, free: s.stats.free, mass: Math.round((await s.measure())[0].mass) }, f0 = s.stats.failedTotal;
          s.spawnCanister(at[0]); const row = { what: name, fresh, before, after: [] }; dry.push(row); let t = 0;
          for (const a of ages) { await run((a - t) * k); t = a; const near = (await s.measure(0.02, { at: at[0], r: R }))[0], all = (await s.measure())[0];
            row.after.push({ t: a, bricksNear: near.bricks, smokyNear: near.smoky, massNear: Math.round(near.mass), bricks: s.stats.pool, free: s.stats.free, massAll: Math.round(all.mass), thinUnder: r2(s.stats.thin), refused: s.stats.failedTotal - f0 }); }
          console.log(name, JSON.stringify(row.after));
        } finally { s.sparse.fresh = was; }
      });
      // a magazine on AUTO from the middle of the view: what gun gas takes of the pool and of the frame, with the fine lattice's rule and without
      const mag = [], shots = Math.max(2, Math.round(30 * k));
      for (const [name, knobs] of opts.mag === false ? [] : [['gun gas lets go', { fineDecay: SHIPPED.fineDecay, fineShare: SHIPPED.fineShare }], ['gun gas as first benched, the other rules as they stand', { fineDecay: 0, fineShare: 1 }]]) await part('magazine: ' + name, async () => {
        const was = { ...s.sparse }, chaos = G().tune.chaos; Object.assign(s.sparse, knobs); G().tune.chaos = 0;   // (chaos 0: no impact dust, the gun's own gas alone)
        try {
          window.__stage(L.view, { park: true, player: { pos: [mid[0], 0, mid[2]], yaw: 0 } }); s.clearAll(); await run(0.1);
          const row = { what: name, ...knobs, shots, rows: [] }; mag.push(row); const f0 = s.stats.failedTotal, h0 = s.stats.fineHeldTotal, per = Math.max(1, Math.round(30 * k)); let fired = 0;
          for (let h = 0; h < 16; h++) {   // (half seconds: three of fire, five after)
            const o = { union: [], solver: [], fine: [], pool: [] };
            for (let f = 0; f < per; f++) {
              if (fired < shots && (h * per + f) % 6 === 0) { window.__destr.burst([mid[0] + 12, 1.25, mid[2]], 1); fired++; }
              const t = await L.takeFrames(1); o.union.push(t.union[0]); o.solver.push(t.solver[0]); o.pool.push(s.stats.pool); o.fine.push(s.stats.fineAll);
            }
            row.rows.push({ t: r2((h + 1) * per * L.dt), fired, solverMs: r2(mean(o.solver)), unionMs: r2(mean(o.union)), bricks: Math.max(...o.pool), gunGas: Math.max(...o.fine), refused: s.stats.failedTotal - f0, heldToShare: s.stats.fineHeldTotal - h0 });
          }
          console.log(name, JSON.stringify(row.rows));
        } finally { Object.assign(s.sparse, was); G().tune.chaos = chaos; }
      });
      L.stage();
      await part('clear', async () => { s.clearAll(); await L.frame(); });
      E().device.removeEventListener('uncapturederror', onErr);
      const out = { solver: 'sparse', round: 2, preset: window.__quality?.current ?? null, size: [E().width, E().height], out: [E().outWidth, E().outHeight],
        adapter: E().device.adapterInfo ? `${E().device.adapterInfo.vendor} ${E().device.adapterInfo.architecture}` : null, when: new Date().toISOString(),
        knobs: { ...s.sparse, calmCells: s.params.calmCells, cap: s.grid.cap, memory: s.memory() }, order: '[lever as it ships, lever off]', scenes, dry, mag, failed, gpuErrors };
      for (const sc of scenes) { console.log(sc.scene); console.table(sc.levers.map(({ passes, ...r }) => r)); }
      console.log(failed.length || gpuErrors.length ? `sparse-lab: round two done, ${failed.length} part(s) failed, ${gpuErrors.length} GPU error(s): the file says which` : 'sparse-lab: round two done, nothing failed');
      try {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
        a.download = `twopointsix-sparse-lab2-${out.knobs.cap}-${out.preset ?? 'x'}.json`; a.click();
      } catch { /* headless */ }
      return out;
    },
    async run(opts = {}) {
      const gpuErrors = [], onErr = e => { if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message ?? e).slice(0, 400)); };
      E().device.addEventListener('uncapturederror', onErr);
      const rows = [], extras = [], failed = []; let life = [];
      /** a part that throws costs its own numbers, never the ones already taken */
      const part = async (name, fn) => { try { await fn(); } catch (e) { failed.push({ part: name, error: String(e?.stack ?? e).slice(0, 600) }); console.error('sparse-lab:', name, e); } };
      const say = r => console.log(JSON.stringify({ ...r, passes: undefined }));
      L.stage();
      await part('no smoke', async () => { rows.push(await L.row(0, { lead: opts.baseLead ?? 1.5, take: opts.baseTake ?? 60 })); });
      for (const n of opts.rows ?? L.rows) await part(`${n} cans`, async () => { rows.push(await L.row(n, opts)); say(rows[rows.length - 1]); });
      if ((opts.lifeSecs ?? L.lifeSecs) > 0) await part('one can, whole life', async () => { life = await L.life(opts); });
      if (opts.extras !== false) for (const [name, key, val] of [['parts timed apart', 'split', true], ['direct dispatch', 'indirect', false]]) {
        const k = S().sparse, was = k[key];
        await part(name, async () => { k[key] = val; extras.push({ what: name, ...await L.row(opts.extraCans ?? 4, opts) }); say(extras[extras.length - 1]); });
        k[key] = was;
      }
      await part('clear', async () => { S().clearAll(); await L.frame(); });
      E().device.removeEventListener('uncapturederror', onErr);
      const out = {
        solver: 'sparse', preset: window.__quality?.current ?? null, size: [E().width, E().height], out: [E().outWidth, E().outHeight],
        adapter: E().device.adapterInfo ? `${E().device.adapterInfo.vendor} ${E().device.adapterInfo.architecture}` : null, when: new Date().toISOString(), lead: opts.lead ?? L.lead, take: opts.take ?? L.take,
        knobs: { ...S().sparse, cap: S().grid.cap, memory: S().memory() }, rows, life, extras, failed, gpuErrors,
      };
      console.table(rows.map(({ passes, ...r }) => r)); if (life.length) console.table(life); if (extras.length) console.table(extras.map(({ passes, ...r }) => r));
      console.log(failed.length || gpuErrors.length ? `sparse-lab: done, ${failed.length} part(s) failed, ${gpuErrors.length} GPU error(s): the file says which` : 'sparse-lab: done, nothing failed');
      try {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
        a.download = `twopointsix-sparse-lab-${out.solver}${out.knobs.cap !== 4096 ? out.knobs.cap : ''}-${out.preset ?? 'x'}.json`; a.click();
      } catch { /* headless */ }
      return out;
    },
  };
  window.__spl = L;
})();
