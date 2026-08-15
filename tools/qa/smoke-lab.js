// SMOKE COST LAB (ported from perf/smoke-scale, docs/internal/smoke-perf.md §0) — the in-page instruments behind that notebook's numbers, minus what only lived on the fire prototype
// (fire scenes, the TRACE_VARIANT counters / stub / mips). Dev only:
//   boot `?paused&quality=<p>&mute`, then  await import('/qa/smoke-lab.js'); await __slReady; await __sl.boot()  → window.__sl
// What it does:
//   * SCENES   __sl.scene('S1'…) stages a deterministic smoke situation from the game's own framing over the cubicle desk pod (seeded dice, a restart, the shift parked, Sam parked
//              invisible, AI off): S0 nothing · S1 one canister · K3 three canisters · K6 six · K8 eight (the wide framing) · S1off = S1 with the camera on the lobby (domains live,
//              no ray on screen crosses them). `dev` seconds of game steps grow the plumes, then the field is FROZEN (smoke.params.frozen: the solver holds still AND still renders —
//              render-side A/Bs then compare the very same voxels) unless {live: true}.
//   * FRAMES   __sl.frames(n) = n serialized still renders (engine.render of the current state + onSubmittedWorkDone + a MessageChannel yield — the dev notes 'GPU timing') → per-pass
//              arrays + the compute UNION per frame; {still:false} steps the game instead (solver-side variants). __sl.ab(apply, variants) interleaves K variants round-robin with a
//              rotating start and reports per-pass / union medians + quartiles per variant, and drops CONTENDED rounds (this GPU is shared: a round is kept only when every variant sits
//              within tol of its own quietest round); __sl.aa() = the same config twice (must agree within ~2 %).
//   * PROFILE  __sl.profile() = the pass table of the staged scene under: as is · smoke shadows off (flag 64) · smoke render off (flag 8) · numSmoke forced 0 (domains live, the
//              renderer told there are none) — which pass pays what for the plume's PRESENCE vs its SAMPLES.
//   * BEFORE / AFTER  __sl.before() installs, through __hotCommon, the live common.wgsl with the shadow-ray transmittance put back to what main ran before the port (the REF block of
//              src/render/shaders/smoke_lab.wgsl: the unmasked eight-sample walk for every light consumer, the full-box mask for the volumetric paths); __sl.after() puts the bundled text
//              back. __sl.CONFIGS.before / exact / after / afterS4 = the scaling curve's columns (exact = the port with calmCells 0, after = + calmCells ½).
//   * EXACT    __sl.exact() = the lab kernel (smoke_lab.wgsl): N random shadow segments through main's function and the one now compiled → bitwise mismatch counters + first offenders;
//              __sl.stepsError(4) = the same kernel comparing fewer samples against eight → mean / max |ΔT|, bias; __sl.boxWords() reads the solver's per-domain occupied-brick boxes back
//              and checks them against the box its own occupancy bits imply (and shows how much of each domain box the shadow rays still visit).
//   * PIXELS   __sl.png(name) / crop / diff / tileLum via /qa/perf-harness.js (__perf) on this lane's shot sink (window.__shotPort); __sl.d2pass({calm}) = the calm-domain rule's look
//              and cost, ONE config per FRESH boot (two stagings in one page never compare — the fixtures flicker on the game clock); __sl.identityPass() = the cross-build hashes.
(async () => {
  let readyRes; window.__slReady = new Promise(r => { readyRes = r; });
  if (!window.__perf) await import('/qa/perf-harness.js');
  const E = () => window.__engine, G = () => window.__game, D = () => window.__engine.device, C = () => window.__cam, SM = () => window.__smoke;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'present'];
  const DEG = Math.PI / 180;
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const st = a => { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); const q = f => s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; const m = a.reduce((x, y) => x + y, 0) / a.length; return { med: +q(0.5).toFixed(3), p25: +q(0.25).toFixed(3), p75: +q(0.75).toFixed(3), p95: +q(0.95).toFixed(3), min: +s[0].toFixed(3), mean: +m.toFixed(3), n: a.length }; };
  const f16 = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); };
  // ---- the views (the desk-pod framings + a lobby view for 'domains live, none on screen') ----
  const VIEWS = {
    top:   { look: [22.3, 0.5, 14.1], yaw: 60 * DEG, pitch: 52 * DEG, dist: 8.5 },     // the game's framing of the desk pod
    wide:  { look: [22.5, 0.5, 14.5], yaw: 60 * DEG, pitch: 55 * DEG, dist: 12.5 },   // further out: three pods, room for eight plumes
    close: { look: [22.2, 0.75, 13.95], yaw: -110 * DEG, pitch: 40 * DEG, dist: 5.2 },
    lobby: { look: [8.4, 0, 17.0], yaw: 30 * DEG, pitch: 50 * DEG, dist: 9 },          // nothing of the cubicles on screen
  };
  const PARK_PLAYER = { pos: [14, 0, 20], yaw: 1.57, crouch: true, holstered: true, invisible: true };
  // plume spots: K* canisters — ≥ 4 m apart so each takes its own 3.5 m coarse domain
  const SPOTS = { K1: [22.4, 0, 14.2], K2: [18.2, 0, 12.4], K3: [26.6, 0, 16.4], K4: [21.0, 0, 18.6], K5: [29.4, 0, 12.8], K6: [17.6, 0, 17.8], K7: [25.0, 0, 19.6], K8: [30.2, 0, 17.4] };
  const SCENES = {
    S0:    { note: 'no smoke: the desk pod at night from the game\'s framing', view: 'top', cans: [] },
    S1:    { note: 'ONE canister before the desk (one coarse 3.5 m domain)', view: 'top', cans: ['K1'] },
    K3:    { note: 'THREE canisters (three coarse domains)', view: 'top', cans: ['K1', 'K2', 'K3'] },
    K6:    { note: 'SIX canisters, the wide framing', view: 'wide', cans: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'] },
    K8:    { note: 'EIGHT canisters, the wide framing', view: 'wide', cans: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'] },
    S1off: { note: 'S1\'s canister live, the camera on the LOBBY: no ray on screen crosses the domain', view: 'lobby', cans: ['K1'] },
  };
  const SL = {
    log: [], VIEWS, SPOTS, SCENES,
    shotPort: window.__shotPort || 5321,
    cur: null, time: 100,
    errs: [], armed: false,
    arm() { if (SL.armed) return; SL.armed = true; D().addEventListener('uncapturederror', ev => { SL.errs.push(ev.error.message); }); },
    async settle() { await D().queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); },
    /** unserialized game steps in chunks (fast-forward) */
    async ff(secs, dt = 1 / 60) { const n = Math.max(1, Math.round(secs / dt)); for (let i = 0; i < n; i += 30) { window.__runFrames(Math.min(30, n - i), dt); await yieldTask(); } await SL.settle(); },
    /** n serialized still renders of the current game state (nothing steps; frame.time advances) */
    async render(n = 1) { for (let i = 0; i < n; i++) { E().render(C(), SL.time, 1 / 60, false); SL.time += 1 / 60; await SL.settle(); } },
    /** n serialized game steps */
    async step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { window.__runFrames(1, dt); await SL.settle(); } },
    view(name) { const v = VIEWS[name] ?? name; return window.__stage(v, {}); },
    /** Stage scene `name` (or a { note, view, cans } literal): opts { dev = 8 (s of game time the plumes grow), live = false (freeze the field after dev), canDur = 900 (canister seconds), restart = true } */
    async scene(name, opts = {}) {
      const sc = typeof name === 'string' ? SCENES[name] : name; if (!sc) throw new Error('scenes: ' + Object.keys(SCENES).join(' '));
      const label = typeof name === 'string' ? name : (sc.name ?? 'custom');
      const { dev = 8, live = false, canDur = 900, restart = true, settle = 20 } = opts;
      if (!(document.getElementById('view')?.clientWidth > 0)) throw new Error('#view has no size: front the tab / take a screenshot first (or __sl.boot())');
      SL.arm(); window.__testVisible = true; window.__shotPort = SL.shotPort; window.__menu?.close();
      const g = G(), sm = SM();
      sm.params.frozen = false;
      if (restart) { Math.random = mulberry32(4242); g.restartEncounter(); }   // (restartEncounter → resetLevelState → smoke.clearAll)
      else sm.clearAll();
      window.__stage(VIEWS[sc.view] ?? sc.view, { park: true, player: PARK_PLAYER });
      g.aiEnabled = false;
      for (const c of [g.player.char, ...g.guards.map(x => x.char)]) c.anim.phase = 0;
      window.__perf.still();
      await SL.ff(0.3);
      const lit = [];
      for (const k of sc.cans) { const p = SPOTS[k] ?? k; sm.spawnCanister([p[0], 0, p[2]], canDur); lit.push(Array.isArray(k) ? k.join(',') : k); }
      await SL.ff(dev);
      if (!live) sm.params.frozen = true;
      SL.cur = label; SL.curOpts = { dev, live };
      await SL.step(2); await SL.render(settle);
      const s = SL.state();
      const line = `${label}: ${sc.note ?? ''} · ${E().width}x${E().height} ${window.__quality?.current} · lights ${s.lights} · smoke ${s.domains} dom (${s.classes}) ${live ? 'LIVE' : 'FROZEN'} after ${dev} s · bricks render ${s.bricksRender}/${s.bricksTotal} · lit ${lit.join(' ')}`;
      SL.log.push(line); return line;
    },
    state() {
      const sm = SM(), e = E(); const live = sm.domains.filter(d => d.live);
      return { domains: live.length, numSmoke: e.smoke.count, classes: live.map(d => d.cls[0] + d.index).join(''), periods: live.map(d => d.period ?? 1).join(''), frozen: sm.params.frozen, calmCells: sm.params.calmCells, steps: e.settings.smokeShadowSteps, bricksRender: sm.stats.bricksRender, bricksTotal: sm.stats.bricksTotal, bricksScalar: sm.stats.bricksScalar, vmax: +sm.stats.vmax.toFixed(2), emitters: sm.stats.emitters, lights: e.lights.activeCount, res: [e.width, e.height], preset: window.__quality?.current, flags: e.settings.flags, common: SL.commonTag ?? 'bundled', errs: SL.errs.slice(-3) };
    },
    // ------------------------------------------------------------------ frame timing ------------------------------------------------------------------
    PASSES: ['direct', 'softblur', 'gather', 'temporal', 'smoke', 'volFroxel', 'volumetrics', 'reflect', 'rc c0', 'particles', 'probe', 'compS', 'sharpU', 'taau'],
    /** n serialized frames after `warm` → { passes: {name: [ms…]}, union: [ms…], sum: [ms…] } (still = renders; else game steps) */
    async frames(n = 30, opts = {}) {
      const { warm = 6, still = true, dt = 1 / 60 } = opts;
      const t = E().timer; const per = {}; const union = [], sum = [];
      for (let i = 0; i < warm + n; i++) {
        const before = t.resolved;
        if (still) await SL.render(1); else { window.__runFrames(1, dt); await SL.settle(); }
        for (let k = 0; k < 400 && t.resolved === before; k++) { if ((k & 15) === 15) await D().queue.onSubmittedWorkDone(); await yieldTask(); }
        if (i < warm || t.resolved === before) continue;
        let s = 0; for (const [k, v] of t.lastFrame) { if (RP.includes(k)) continue; s += v; (per[k] ??= []).push(v); }
        sum.push(s); union.push(t.unionMs(RP));
      }
      return { passes: per, union, sum };
    },
    /** one take: per-pass medians of the current state → flat row { union, direct, … , domains, bricks } */
    async take(label = '', opts = {}) {
      const { n = 40, warm = 6, still = true } = opts;
      const f = await SL.frames(n, { warm, still });
      const row = { label, union: st(f.union)?.med, unionP25: st(f.union)?.p25, unionP75: st(f.union)?.p75, sum: st(f.sum)?.med };
      for (const p of SL.PASSES) if (f.passes[p]) row[p] = st(f.passes[p]).med;
      const s = SL.state(); row.domains = s.domains; row.numSmoke = s.numSmoke; row.bricksRender = s.bricksRender; row.lights = s.lights; row.n = f.union.length;
      return row;
    },
    /** interleaved K-variant A/B: `rounds` × (each variant in rotating order: apply(v) → warm → n frames) → per-round per-variant union medians, then a POST-HOC CONTENTION FILTER — this GPU is
     *  shared with other lanes' pages, and their work only ever ADDS time: a round is kept only if EVERY variant's union median in it is within `tol` of that variant's fastest round
     *  (the quietest rounds are the truest); the kept rounds' frames are pooled → per-pass / union medians + quartiles per variant + text. Also reported: per variant the MIN over
     *  rounds of the round medians (the contention-robust estimator), kept/total, and `refUnion` (opts) — a known-quiet union for variants[0]: rounds where it ran > tol over that are
     *  dropped too, and the text says how far the kept reference sits from it. */
    async ab(apply, variants, opts = {}) {
      const { rounds = 6, n = 20, warm = 8, still = true, passes = SL.PASSES, tol = 0.05, quiet = false, refUnion = null, minKeep = 2 } = opts;
      const R = [];   // per round: per variant { per, union, sum }
      for (let r = 0; r < rounds; r++) {
        const rnd = variants.map(() => ({ per: {}, union: [], sum: [] }));
        for (let k = 0; k < variants.length; k++) {
          const vi = (k + r) % variants.length;
          await apply(variants[vi]);
          const f = await SL.frames(n, { warm, still });
          const P = rnd[vi]; for (const [name, a] of Object.entries(f.passes)) (P.per[name] ??= []).push(...a); P.union.push(...f.union); P.sum.push(...f.sum);
        }
        R.push(rnd);
        SL.status = `ab round ${r + 1}/${rounds}: ${rnd.map((P, i) => variants[i] + ' ' + (st(P.union)?.med ?? NaN).toFixed(2)).join(' · ')}`;
      }
      await apply(variants[0]);
      const meds = R.map(rnd => rnd.map(P => st(P.union)?.med ?? Infinity));
      const minMed = variants.map((_, i) => Math.min(...meds.map(m => m[i])));
      const refFloor = refUnion ?? minMed[0];
      const keep = meds.map(m => m.every((x, i) => x <= minMed[i] * (1 + tol)) && m[0] <= Math.min(refFloor, minMed[0]) * (1 + tol) + 1e-9);
      let kept = keep.map((k, r) => k ? r : -1).filter(r => r >= 0);
      if (kept.length < minKeep) { const order = meds.map((m, r) => [r, m.reduce((s, x, i) => s + x / minMed[i], 0)]).sort((a, b) => a[1] - b[1]); kept = order.slice(0, Math.min(minKeep, rounds)).map(x => x[0]); }   // (too few clean rounds: take the quietest minKeep by summed relative excess and SAY so)
      const pool = variants.map(() => ({ per: {}, union: [], sum: [] }));
      for (const r of kept) for (let i = 0; i < variants.length; i++) { const P = pool[i], Q = R[r][i]; for (const [name, a] of Object.entries(Q.per)) (P.per[name] ??= []).push(...a); P.union.push(...Q.union); P.sum.push(...Q.sum); }
      const out = { variants, res: [E().width, E().height], preset: window.__quality?.current, scene: SL.cur, per: {}, union: pool.map(P => st(P.union)), sum: pool.map(P => st(P.sum)), minMed: minMed.map(x => +x.toFixed(3)), roundMeds: meds.map(m => m.map(x => +x.toFixed(2))), kept, keptN: kept.length, rounds, contended: kept.length < Math.max(minKeep, Math.ceil(rounds / 2)), refUnion, refExcessPct: refUnion ? +((minMed[0] / refUnion - 1) * 100).toFixed(1) : null };
      for (const p of passes) { const row = pool.map(P => st(P.per[p])); if (row.some(x => x)) out.per[p] = row; }
      // per-pass minimum-of-round-medians too (robust per pass)
      out.perMin = {}; for (const p of passes) { const row = variants.map((_, i) => { const ms = R.map(rnd => st(rnd[i].per[p])?.med).filter(x => x !== undefined); return ms.length ? +Math.min(...ms).toFixed(3) : null; }); if (row.some(x => x !== null)) out.perMin[p] = row; }
      const fmt = (row) => row.map((x, i) => x ? `${String(variants[i]).padStart(4)}: ${x.med.toFixed(2)} (${x.p25.toFixed(2)}–${x.p75.toFixed(2)})` : `${variants[i]}: -`).join('   ');
      const lines = [];
      for (const [p, row] of Object.entries(out.per)) { const b = row[0]?.med; lines.push(`${p.padEnd(11)} ${fmt(row)}` + (b ? '   Δ ' + row.map(x => x ? (x.med - b >= 0 ? '+' : '') + (x.med - b).toFixed(2) : '-').join(' / ') : '')); }
      lines.push(`${'UNION'.padEnd(11)} ${fmt(out.union)}   Δ ${out.union.map(x => x ? (x.med - out.union[0].med >= 0 ? '+' : '') + (x.med - out.union[0].med).toFixed(2) : '-').join(' / ')}   Δ% ${out.union.map(x => x ? ((x.med / out.union[0].med - 1) * 100).toFixed(1) : '-').join(' / ')}`);
      lines.push(`${'UNION min'.padEnd(11)} ${minMed.map((x, i) => `${String(variants[i]).padStart(4)}: ${x.toFixed(2)}`).join('   ')}   Δ ${minMed.map(x => (x - minMed[0] >= 0 ? '+' : '') + (x - minMed[0]).toFixed(2)).join(' / ')}`);
      for (const p of ['direct', 'smoke', 'volFroxel', 'volumetrics']) if (out.perMin[p]) lines.push(`${(p + ' min').padEnd(11)} ${out.perMin[p].map((x, i) => `${String(variants[i]).padStart(4)}: ${x === null ? '-' : x.toFixed(2)}`).join('   ')}   Δ ${out.perMin[p].map(x => x === null || out.perMin[p][0] === null ? '-' : (x - out.perMin[p][0] >= 0 ? '+' : '') + (x - out.perMin[p][0]).toFixed(2)).join(' / ')}`);
      lines.push(`${SL.cur ?? '?'} · ${out.res.join('x')} ${out.preset} · kept ${kept.length}/${rounds} rounds × ${n} frames (tol ${tol})${out.contended ? ' · CONTENDED (fewer than half the rounds clean)' : ''}${refUnion ? ` · ref floor ${refUnion} (${out.refExcessPct >= 0 ? '+' : ''}${out.refExcessPct} %)` : ''} · ${still ? 'still renders' : 'game steps'} · rounds: ${meds.map((m, r) => (keep[r] || kept.includes(r) ? '' : 'x') + m[0].toFixed(1)).join(' ')}`);
      out.text = lines.join('\n');
      if (!quiet) SL.log.push(out.text);
      SL.status = 'ab done';
      return out;
    },
    /** fire-and-forget: run `fn` in the background, result / error in __sl.jobs[name] (poll __sl.status / __sl.jobs[name].done) — the javascript tool need not hold the call open */
    job(name, fn) { const j = { name, done: false, t0: performance.now() }; SL.jobs[name] = j; (async () => { try { j.result = await fn(); } catch (e) { j.error = String(e?.stack ?? e).slice(0, 800); } j.done = true; j.secs = +((performance.now() - j.t0) / 1000).toFixed(0); })(); return `job ${name} started`; },
    jobs: {}, status: '',
    /** contention check: the same configuration twice — the union medians must agree within ~2 % */
    async aa(opts = {}) { const r = await SL.ab(async () => {}, ['A', 'A2'], { rounds: 2, n: 30, quiet: true, ...opts }); const u = r.union; r.aaPct = u[0] && u[1] ? +Math.abs((u[1].med / u[0].med - 1) * 100).toFixed(2) : null; r.clean = r.aaPct !== null && r.aaPct < 2.5; return r; },
    /** wait for a quiet GPU: aa() until clean (≤ tries) */
    async quiet(tries = 6, opts = {}) { let a = null; for (let i = 0; i < tries; i++) { a = await SL.aa(opts); if (a.clean) break; } return { clean: a.clean, aaPct: a.aaPct, union: a.union.map(x => x && x.med) }; },
    // ------------------------------------------------------------------ the profile by switches ------------------------------------------------------------------
    /** apply one of the profile configurations: 'ref' | 'noShadow' (flag 64 off) | 'noRender' (flag 8 off) | 'noSmoke' (numSmoke 0: the renderer told there is none — still renders only) | 'both' (8 + 64 off) */
    cfg(name) {
      const S = E().settings; const F = { Smoke: 8, SmokeShadows: 64 };
      S.flags = (S.flags | F.Smoke | F.SmokeShadows) >>> 0;
      if (SL._count0 !== undefined) { E().smoke.count = SL._count0; SL._count0 = undefined; }
      if (name === 'noShadow' || name === 'both') S.flags = (S.flags & ~F.SmokeShadows) >>> 0;
      if (name === 'noRender' || name === 'both') S.flags = (S.flags & ~F.Smoke) >>> 0;
      if (name === 'noSmoke') { SL._count0 = E().smoke.count; E().smoke.count = 0; }
      return name;
    },
    /** THE PROFILE of the staged (frozen) scene: interleaved still-render A/B over ref / noShadow / noRender / both / noSmoke → per pass, what the smoke's SHADOW-RAY TRANSMITTANCE costs
     *  (ref − noShadow), what the MARCH + froxel J cost (ref − noRender), and what its mere PRESENCE costs (both − noSmoke: every consumer's per-ray domain loop with nothing to sample) */
    async profile(opts = {}) {
      const { rounds = 6, n = 20, useMin = true } = opts;
      const r = await SL.ab(v => SL.cfg(v), ['ref', 'noShadow', 'noRender', 'both', 'noSmoke'], { rounds, n, warm: 8, still: true, quiet: true, refUnion: opts.refUnion ?? null });
      SL.cfg('ref');
      const med = (p, i) => (useMin ? r.perMin[p]?.[i] : r.per[p]?.[i]?.med) ?? null; const u = i => (useMin ? r.minMed[i] : r.union[i]?.med) ?? null;
      const cols = ['union', ...Object.keys(r.per)];
      const val = (p, i) => p === 'union' ? u(i) : med(p, i);
      const table = {}; for (const p of cols) table[p] = { ref: val(p, 0), noShadow: val(p, 1), noRender: val(p, 2), both: val(p, 3), noSmoke: val(p, 4), shadowRays: dlt(val(p, 0), val(p, 1)), marchAndJ: dlt(val(p, 0), val(p, 2)), presence: dlt(val(p, 3), val(p, 4)), total: dlt(val(p, 0), val(p, 4)) };
      function dlt(a, b) { return a === null || b === null ? null : +(a - b).toFixed(3); }
      const lines = [`PROFILE ${SL.cur} (${SCENES[SL.cur]?.note}) · ${r.res.join('x')} ${r.preset} · ${SL.state().domains} domains · kept ${r.keptN}/${rounds} rounds × ${n} (${useMin ? 'MIN of round medians' : 'pooled medians'})${r.contended ? ' · CONTENDED' : ''}`, 'pass          ref  noShad noRend   both noSmoke │ shadow-ray T  march+J  presence   TOTAL smoke'];
      for (const p of cols) { const t = table[p]; if (t.ref === null) continue; const f = x => x === null ? '   -  ' : x.toFixed(2).padStart(6); lines.push(`${p.padEnd(12)}${f(t.ref)} ${f(t.noShadow)} ${f(t.noRender)} ${f(t.both)} ${f(t.noSmoke)} │ ${f(t.shadowRays)}      ${f(t.marchAndJ)}   ${f(t.presence)}   ${f(t.total)}`); }
      const out = { scene: SL.cur, table, ab: r, text: lines.join('\n') };
      SL.log.push(out.text);
      return out;
    },
    // ------------------------------------------------------------------ before / after: main's transmittance through __hotCommon ------------------------------------------------------------------
    /** the common.wgsl text now on disk (the dev server serves src/render/shaders under /qa/shader/) */
    async commonDisk() { return (await fetch('/qa/shader/common.wgsl', { cache: 'no-store' })).text(); },
    /** the REF block of the lab kernel: main's smokeDensityAt / smokeTransmittance before the port, verbatim under *Ref names */
    async refBlock() {
      const src = await SL.labSource();
      const a = src.indexOf('// ---- the REFERENCE'), b = src.indexOf('/** one random segment');
      if (a < 0 || b < a) throw new Error('smoke_lab.wgsl: REF block markers not found');
      return src.slice(a, b);
    },
    /** BEFORE = the port undone in the shader text: every light consumer's smokeTransmittance back on main's unmasked eight-sample walk (the REF block), and smokeSegment's occupied-box test opened
     *  to the full box, so smokeTransIn / smokeTransCoarse (vol_common.wgsl) are main's full-box-mask walks again statement for statement. Installed into every tracing pipeline (__hotCommon). */
    async beforeSource() {
      let src = await SL.commonDisk();
      const one = 'fn smokeTransmittance(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { return smokeTransmittanceN(ro, rd, tmax, smokeShadowSteps()); }';
      if (!src.includes(one)) throw new Error('common.wgsl: the smokeTransmittance one-liner is not the text this lab knows — update beforeSource()');
      src = src.replace(one, 'fn smokeTransmittance(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { return smokeTransmittanceRef(ro, rd, tmax); }\n' + await SL.refBlock());
      const sub = 'if (all(sl < sh) && ts.x <= ts.y && ts.y > 0.0 && ts.x < tmax) { sp.mask |= 1u << i; }';
      if (!src.includes(sub)) throw new Error('common.wgsl: smokeSegment\'s occupied-box line is not the text this lab knows — update beforeSource()');
      src = src.replace(sub, 'sp.mask |= 1u << i;   // BEFORE: every crossed FULL box, as vol_common\'s smokeTransIn had it');
      return src;
    },
    async before() { const r = await window.__hotCommon(await SL.beforeSource()); if (!r.ok) throw new Error('hotCommon(before) failed: ' + JSON.stringify(r.failed).slice(0, 1500)); SL.commonTag = 'before'; return { ok: true, tag: 'before', ms: r.ms, warnings: r.warnings }; },
    /** AFTER = the bundled common.wgsl back in every tracing pipeline ('' → the boot text; pass 'disk' to compile the file on disk instead) */
    async after(which = '') { const r = await window.__hotCommon(which === 'disk' ? null : ''); if (!r.ok) throw new Error('hotCommon(after) failed: ' + JSON.stringify(r.failed).slice(0, 1500)); SL.commonTag = which === 'disk' ? 'disk' : 'bundled'; return { ok: true, tag: SL.commonTag, ms: r.ms, warnings: r.warnings }; },
    /** re-fetch one module from disk behind the current common: 'restir' | 'direct' | 'froxel' | 'vol' | 'gather' | 'reflect' */
    async hot(which) { const f = { restir: window.__hotRestir, direct: window.__hotDirect, froxel: window.__hotFroxel, vol: window.__hotVol, gather: window.__hotGather, reflect: window.__hotReflect }[which]; if (!f) throw new Error('hot: restir direct froxel vol gather reflect'); const r = await f(); if (!r.ok) throw new Error(which + ': ' + JSON.stringify(r.messages).slice(0, 1200)); return r; },
    /** the standard BEFORE / AFTER configs: before = main's transmittance + the solver's schedule as it was; exact = the port with calmCells 0; after = + calm domains at ¼‥½ rate; afterS4 = + 4 shadow samples */
    CONFIGS: {
      before:  { name: 'before', apply: async () => { if (SL.commonTag !== 'before') await SL.before(); SM().params.calmCells = 0; E().settings.smokeShadowSteps = 8; } },
      exact:   { name: 'exact', apply: async () => { if ((SL.commonTag ?? 'bundled') !== 'bundled') await SL.after(); SM().params.calmCells = 0; E().settings.smokeShadowSteps = 8; } },
      after:   { name: 'after', apply: async () => { if ((SL.commonTag ?? 'bundled') !== 'bundled') await SL.after(); SM().params.calmCells = 0.5; E().settings.smokeShadowSteps = 8; } },
      afterS4: { name: 'afterS4', apply: async () => { if ((SL.commonTag ?? 'bundled') !== 'bundled') await SL.after(); SM().params.calmCells = 0.5; E().settings.smokeShadowSteps = 4; } },
    },
    /** frame-cost A/B of BEFORE vs AFTER on the current (frozen) scene: interleaved hot swaps, still renders */
    async abPort(opts = {}) { return SL.ab(v => SL.CONFIGS[v].apply(), ['before', 'exact'], { rounds: 5, n: 20, ...opts }); },
    // ------------------------------------------------------------------ the solver's box words ------------------------------------------------------------------
    /** For every live domain: the occupied-brick box the solver wrote behind its occupancy bits (renderOccPack → the word common.wgsl smokeSubWord reads), the box those BITS imply (min / max set
     *  brick), whether the two agree, and the fraction of the domain box the shadow rays still have to visit. A frozen scene reads a matched set. */
    async boxWords() {
      const sm = SM(), dev = D(); const n = 4 * (16 * 8 + 8);
      const rd = dev.createBuffer({ size: n, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = dev.createCommandEncoder(); enc.copyBufferToBuffer(sm.occBuf, 0, rd, 0, n); dev.queue.submit([enc.finish()]);
      await rd.mapAsync(GPUMapMode.READ); const u = new Uint32Array(rd.getMappedRange().slice(0)); rd.unmap(); rd.destroy();
      const out = [];
      for (const d of sm.domains) {
        if (!d.live) continue;
        const w = u[128 + d.index] >>> 0; const valid = (w >> 18) & 1;
        const gpuLo = [w & 7, (w >> 3) & 7, (w >> 6) & 7], gpuHi = [(w >> 9) & 7, (w >> 12) & 7, (w >> 15) & 7];
        const lo = [8, 8, 8], hi = [-1, -1, -1]; let set = 0;
        for (let b = 0; b < 512; b++) { if (!((u[d.index * 16 + (b >> 5)] >>> (b & 31)) & 1)) continue; set++; const B = [b & 7, (b >> 3) & 7, b >> 6]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], B[k]); hi[k] = Math.max(hi[k], B[k]); } }
        const bitsLo = set ? lo : [7, 7, 7], bitsHi = set ? hi : [0, 0, 0];
        const agree = valid === 1 && bitsLo.every((v, k) => v === gpuLo[k]) && bitsHi.every((v, k) => v === gpuHi[k]);
        const frac = set ? ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1)) / 512 : 0;
        out.push({ index: d.index, cls: d.cls, valid, setBricks: set, gpuLo, gpuHi, bitsLo, bitsHi, agree, boxFrac: +frac.toFixed(3), worldLo: bitsLo.map((b, k) => +(d.origin[k] + b * 8 * d.voxel).toFixed(2)), worldHi: bitsHi.map((b, k) => +(d.origin[k] + (b + 1) * 8 * d.voxel).toFixed(2)) });
      }
      out.text = `boxWords ${SL.cur}: ` + out.map(o => `d${o.index}${o.cls[0]} ${o.agree ? '✔' : '✘'} bricks ${o.setBricks} box [${o.gpuLo}]–[${o.gpuHi}] = ${(100 * o.boxFrac).toFixed(0)} % of the domain`).join(' · ');
      SL.log.push(out.text); return out;
    },
    // ------------------------------------------------------------------ the lab kernel (src/render/shaders/smoke_lab.wgsl): exactness + sample-count error statistics ------------------------------------------------------------------
    N_THREADS: 1 << 18,
    async labSource() { SL._labSrc ??= await (await fetch('/qa/shader/smoke_lab.wgsl', { cache: 'no-store' })).text(); return SL._labSrc; },
    reloadLab() { SL._labSrc = null; SL.pipes = {}; },
    pipes: {},
    ensureLab() {
      if (SL.labLayout) return;
      const d = D();
      SL.labLayout = d.createBindGroupLayout({ label: 'smokeLab', entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ] });
      SL.labPL = d.createPipelineLayout({ bindGroupLayouts: [E().sceneLayout, SL.labLayout] });
      SL.labParams = d.createBuffer({ label: 'smokeLabParams', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      SL.labWords = 64 + 24 * 8;
      SL.labOut = d.createBuffer({ label: 'smokeLabOut', size: SL.labWords * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      SL.labRead = d.createBuffer({ label: 'smokeLabRead', size: SL.labWords * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      SL.labBG = d.createBindGroup({ layout: SL.labLayout, entries: [{ binding: 0, resource: { buffer: SL.labParams } }, { binding: 1, resource: { buffer: SL.labOut } }] });
    },
    hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); },
    /** the lab pipeline behind the CURRENT scene prelude (whatever common __hotCommon last installed; under 'before' the prelude already carries the REF block, so the kernel's copy is cut) */
    async labPipe() {
      SL.ensureLab();
      const pre = window.__scenePrelude(false);
      let body = await SL.labSource();
      if (pre.includes('fn smokeTransmittanceRef(')) body = body.replace(await SL.refBlock(), '// (REF block supplied by the prelude: the BEFORE common is installed)\n');
      const src = pre + '\n' + body;
      const key = SL.hashStr(src);
      if (SL.pipes[key]) return SL.pipes[key];
      const d = D(); const mod = d.createShaderModule({ code: src, label: 'smokeLab' });
      const info = await mod.getCompilationInfo(); const off = pre.split('\n').length;
      const errs = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum - off}:${m.linePos} ${m.message} · ${(src.split('\n')[m.lineNum - 1] || '').trim().slice(0, 120)}`);
      if (errs.length) throw new Error('smoke_lab.wgsl:\n' + errs.slice(0, 8).join('\n'));
      const pipe = await d.createComputePipelineAsync({ label: 'smokeLab', layout: SL.labPL, compute: { module: mod, entryPoint: 'main' } });
      SL.pipes[key] = pipe; return pipe;
    },
    /** the sampling box: the live domains' hull grown by `grow` m (y clamped to the room) */
    labBox(grow = 2.5) {
      const live = SM().domains.filter(d => d.live); if (!live.length) throw new Error('no live smoke domain');
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const d of live) { const sz = 64 * d.voxel; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], d.origin[k]); hi[k] = Math.max(hi[k], d.origin[k] + sz); } }
      return { lo: [lo[0] - grow, Math.max(0.05, lo[1] - 0.5), lo[2] - grow], hi: [hi[0] + grow, Math.min(3.3, hi[1] + 0.5), hi[2] + grow] };
    },
    /** one lab dispatch → the ten counters + the log; p = { seed, reps, mode, stepsA, stepsB } */
    async labRun(p) {
      const pipe = await SL.labPipe(); const d = D();
      E().render(C(), SL.time, 1 / 60, false); SL.time += 1 / 60; await SL.settle();   // (the frame block + scene group hold THIS state)
      const box = SL.labBox(p.grow ?? 2.5);
      const u = new Uint32Array(16); const f = new Float32Array(u.buffer);
      u[0] = p.seed ?? 1; u[1] = SL.N_THREADS; u[2] = p.reps ?? 8; u[3] = p.mode ?? 0;
      f[4] = box.lo[0]; f[5] = box.lo[1]; f[6] = box.lo[2]; f[7] = 0; f[8] = box.hi[0]; f[9] = box.hi[1]; f[10] = box.hi[2]; f[11] = 0;
      u[12] = 0; u[13] = 0; u[14] = p.stepsA ?? 8; u[15] = p.stepsB ?? 8;
      d.queue.writeBuffer(SL.labParams, 0, u);
      const enc = d.createCommandEncoder({ label: 'smokeLab' });
      enc.clearBuffer(SL.labOut, 0, SL.labWords * 4);
      const pass = enc.beginComputePass({ label: 'smokeLab' });
      pass.setPipeline(pipe); pass.setBindGroup(0, E().sceneBindGroup()); pass.setBindGroup(1, SL.labBG);
      pass.dispatchWorkgroups(Math.ceil(SL.N_THREADS / 64)); pass.end();
      enc.copyBufferToBuffer(SL.labOut, 0, SL.labRead, 0, SL.labWords * 4);
      d.queue.submit([enc.finish()]);
      await d.queue.onSubmittedWorkDone();
      await SL.labRead.mapAsync(GPUMapMode.READ); const w = new Uint32Array(SL.labRead.getMappedRange().slice(0)); SL.labRead.unmap();
      const wf = new Float32Array(w.buffer);
      const nLog = Math.min(24, w[6]); const log = [];
      for (let k = 0; k < Math.min(nLog, 8); k++) { const o = 64 + k * 8; const ab = w[o + 7]; log.push({ ro: [wf[o], wf[o + 1], wf[o + 2]].map(x => +x.toFixed(3)), tmax: +wf[o + 3].toFixed(3), rd: [wf[o + 4], wf[o + 5], wf[o + 6]].map(x => +x.toFixed(4)), a: +f16(ab & 0xffff).toFixed(5), b: +f16(ab >>> 16).toFixed(5) }); }
      return { rays: w[0], mismatches: w[1], over1e6: w[2], over1e3: w[3], maxAbs: wf[4], smoky: w[5], sumAbs: w[7] / 1e6, sumRef: w[8] / 1e3, sumVar: w[9] / 1e3, log, box };
    },
    /** EXACTNESS of the shadow-ray transmittance now compiled (common.wgsl smokeTransmittanceN at 8 samples) against main's function before the port (smokeTransmittanceRef in the lab kernel):
     *  `runs` × 2 M random segments per mode (0 between random points of the grown hull, 1 toward the frame's lights, 2 into the domain boxes from around them) → totals + verdict */
    async exact(opts = {}) {
      const { runs = 3, reps = 8, modes = [0, 1, 2] } = opts;
      if ((SL.commonTag ?? 'bundled') === 'before') throw new Error('exact(): the BEFORE common is installed — __sl.after() first (the kernel would compare main with main)');
      const tot = { rays: 0, mismatches: 0, over1e6: 0, over1e3: 0, smoky: 0, maxAbs: 0 }; const rows = []; let log = [];
      for (const mode of modes) for (let r = 0; r < runs; r++) {
        const x = await SL.labRun({ seed: 17 + r * 31 + mode * 7, reps, mode });
        rows.push({ mode, r, rays: x.rays, mismatches: x.mismatches, smoky: x.smoky, maxAbs: x.maxAbs });
        tot.rays += x.rays; tot.mismatches += x.mismatches; tot.over1e6 += x.over1e6; tot.over1e3 += x.over1e3; tot.smoky += x.smoky; tot.maxAbs = Math.max(tot.maxAbs, x.maxAbs);
        if (x.log.length && log.length < 8) log.push(...x.log);
      }
      const out = { ...tot, exact: tot.mismatches === 0, smokyFrac: +(tot.smoky / Math.max(1, tot.rays)).toFixed(4), rows, log, scene: SL.cur, state: SL.state() };
      out.text = `exact ${SL.cur} (${out.state.domains} domains${out.state.frozen ? ' frozen' : ' LIVE'}, common ${out.state.common}): ${(tot.rays / 1e6).toFixed(1)} M segments, ${(100 * out.smokyFrac).toFixed(1)} % through smoke → ${tot.mismatches} bitwise mismatches (${tot.over1e6} > 1e-6, ${tot.over1e3} > 1e-3, max |Δ| ${tot.maxAbs.toExponential(2)}) ${out.exact ? '✔ BIT-EXACT' : '✘ DIFFERS'}`;
      SL.log.push(out.text); return out;
    },
    /** sample-count ERROR statistics: transmittance at stepsB samples against stepsA (default the eight of always) over random segments toward the lights (mode 1) and into the boxes (mode 2)
     *  → mean |Δ|, max |Δ|, mean signed bias over the segments that meet smoke, and the fraction over 1e-3 */
    async stepsError(stepsB, opts = {}) {
      const { stepsA = 8, runs = 2, reps = 8, modes = [1, 2] } = opts;
      let rays = 0, smoky = 0, sumAbs = 0, maxAbs = 0, sumRef = 0, sumVar = 0, n3 = 0;
      for (const mode of modes) for (let r = 0; r < runs; r++) {
        const x = await SL.labRun({ seed: 5 + r * 13 + mode * 3, reps, mode: mode | 16, stepsA, stepsB });
        rays += x.rays; smoky += x.smoky; sumAbs += x.sumAbs; maxAbs = Math.max(maxAbs, x.maxAbs); sumRef += x.sumRef; sumVar += x.sumVar; n3 += x.over1e3;
      }
      const out = { stepsA, stepsB, rays, smoky, meanAbsErr: +(sumAbs / Math.max(1, smoky)).toFixed(5), maxAbsErr: +maxAbs.toFixed(4), meanRef: +(sumRef / Math.max(1, smoky)).toFixed(4), meanVar: +(sumVar / Math.max(1, smoky)).toFixed(4), bias: +((sumVar - sumRef) / Math.max(1, smoky)).toFixed(5), fracOver1e3: +(n3 / Math.max(1, smoky)).toFixed(4), scene: SL.cur };
      out.text = `stepsError ${SL.cur}: T(${stepsB} smp) vs T(${stepsA} smp) over ${(smoky / 1e6).toFixed(2)} M smoky segments of ${(rays / 1e6).toFixed(1)} M: mean |ΔT| ${out.meanAbsErr} · max ${out.maxAbsErr} · bias ${out.bias >= 0 ? '+' : ''}${out.bias} (mean T ref ${out.meanRef}) · ${(100 * out.fracOver1e3).toFixed(1)} % differ > 1e-3`;
      SL.log.push(out.text); return out;
    },
    // ------------------------------------------------------------------ pixels ------------------------------------------------------------------
    async readback() { return window.__perf.readback(); },
    async png(name, fr = null) { window.__shotPort = SL.shotPort; return window.__perf.png(name, fr); },
    async crop(name, x, y, w, h, scale = 3, fr = null) { window.__shotPort = SL.shotPort; return window.__perf.crop(name, x, y, w, h, scale, 0.95, fr); },
    hash(fr) { return window.__perf.hash(fr); },
    diff(a, b) { return window.__perf.diff(a, b); },
    /** luminance statistics of readback `fr` inside tile (x, y, w, h): mean, and vs a reference readback: mean abs / max abs / rel mean error */
    tileLum(fr, x, y, w, h, ref = null) {
      let s = 0, sr = 0, ea = 0, em = 0; const W = fr.w;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * W + (x + i)) * 4; const L = 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; s += L; if (ref) { const R = 0.2126 * ref.data[o] + 0.7152 * ref.data[o + 1] + 0.0722 * ref.data[o + 2]; sr += R; const e = Math.abs(L - R); ea += e; if (e > em) em = e; } }
      const n = w * h; const out = { tile: [x, y, w, h], mean: +(s / n).toFixed(3) };
      if (ref) { out.refMean = +(sr / n).toFixed(3); out.meanAbsErr = +(ea / n).toFixed(3); out.maxAbsErr = +em.toFixed(1); out.relMeanErr = +((s - sr) / Math.max(1e-6, sr)).toFixed(4); }
      return out;
    },
    /** world point → readback pixel */
    projectOut(p) { return window.__perf.projectOut(p); },
    // ------------------------------------------------------------------ the calm-domain rule's LOOK (D2) + cross-build identity: ONE pass per FRESH BOOT ------------------------------------------------------------------
    // Two stagings inside one page never compare: the cubicles' flickering fixtures, the haze clock and the TAAU phase all key on the game / render clocks and the frame index, which the
    // first run has advanced by the time the second starts (a first cut, `drift()`, compared them and measured the clocks). Everything from a fresh `?paused` boot IS deterministic
    // (docs/internal/smoke-perf.md §8: hash-identical across two builds), so the recipe is: navigate afresh → `await __sl.boot()` → `__sl.d2pass({calm})` per config (or `identityPass()`
    // per build), and compare the PNGs / hashes it leaves on the sink by name (T for T, view for view).
    /** Stage `scene` LIVE (canisters of `canDur` s, `dev` s of steps) under smoke.params.calmCells = `calm`, then at each game time in `times` (s after staging): `n` serialized game steps →
     *  the smoke / direct pass and union medians, the domains' periods and visible-smoke speeds, per-domain mass, a still → its hash + a PNG `<prefix>_<scene>_t<T>_c<calm>` on the sink. */
    async d2pass(opts = {}) {
      const { scene = 'K3', calm = 0.5, canDur = 10, dev = 12, times = [0, 2, 4, 6, 8, 10, 14, 20], prefix = 'sd2', n = 30 } = opts;
      const sm = SM(); sm.params.calmCells = calm;
      const line = await SL.scene(scene, { dev, live: true, canDur, settle: 8 });
      const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
      const out = { calm, line, rows: [] }; let t = 0;
      for (const T of times) {
        if (T > t) { await SL.ff(T - t); t = T; }
        const f = await SL.frames(n, { warm: 4, still: false }); t += (n + 4) / 60;
        await SL.render(2); const fr = await SL.readback();
        const live = sm.domains.filter(d => d.live);
        const row = { T, periods: SL.state().periods, vmaxS: live.map(d => +d.bricks.vmaxS.toFixed(2)), mass: live.map(d => +d.mass.toFixed(1)), scalarBricks: live.map(d => d.bricks.scalar), smokeMs: +med(f.passes.smoke || []).toFixed(3), directMs: +med(f.passes.direct || []).toFixed(3), union: +med(f.union).toFixed(3), hash: SL.hash(fr), skipped: sm.stats.skipped };
        row.png = await SL.png(`${prefix}_${SL.cur}_t${T}_c${calm}`, fr);
        out.rows.push(row);
      }
      out.frameIdx = E().frameIdx;
      out.text = [`D2 PASS ${scene} calm ${calm} (canisters ${canDur} s, staged ${dev} s): T · periods · vmaxS · smoke / direct / union ms · hash`, ...out.rows.map(r => `t${String(r.T).padEnd(3)} p ${r.periods} v ${r.vmaxS.join('/')} · ${r.smokeMs.toFixed(2)} / ${r.directMs.toFixed(2)} / ${r.union.toFixed(2)} · ${r.hash}`)].join('\n');
      SL.log.push(out.text); return out;
    },
    /** CROSS-BUILD IDENTITY pass (run the same call on the pre-port build served beside and on the port, each from a fresh boot): stage `scene` FROZEN with calmCells 0, then hash the still
     *  after 40 / +20 / +20 renders and 12-render takes of the direct-only (3), indirect-only (4), volumetric (5), specular (10) and final views again → { hashes… } to compare by eye. */
    async identityPass(opts = {}) {
      const { scene = 'S1', dev = 8, views = [3, 4, 5, 10, 0, 0] } = opts;
      const sm = SM(); if (sm.params.calmCells !== undefined) sm.params.calmCells = 0;
      const line = await SL.scene(scene, { dev, settle: 20 });
      const out = { line, port: location.port, v0: [], views: {} };
      for (const k of [40, 20, 20]) { await SL.render(k); const fr = await SL.readback(); out.v0.push(SL.hash(fr)); if (out.v0.length === 1) out.png = await SL.png(`sl_id_${SL.cur}_${location.port}`, fr); }
      const S = E().settings;
      for (const dv of views) { S.debugView = dv; await SL.render(12); (out.views['v' + dv] ??= []).push(SL.hash(await SL.readback())); }
      S.debugView = 0; await SL.render(2); out.frameIdx = E().frameIdx;
      out.text = `identity ${SL.cur} :${out.port} → v0 ${out.v0.join(' ')} · ` + Object.entries(out.views).map(([k, v]) => `${k} ${v.join(' ')}`).join(' · ') + ` · frame ${out.frameIdx}`;
      SL.log.push(out.text); return out;
    },
    // ------------------------------------------------------------------ the scaling curve ------------------------------------------------------------------
    /** union / direct / smoke vs live domain count for each config, LIVE (game steps: the solver counts). opts: { counts = [0,1,2,3,4,6,8], state = 'active' (dev 8 s, sources running) |
     *  'hanging' (canisters of 10 s measured 12 s after they end), configs = [{ name, apply }], rounds = 3, n = 20, view = 'wide' } → rows per count */
    async curve(opts = {}) {
      const { counts = [0, 1, 2, 3, 4, 6, 8], state = 'active', configs, rounds = 3, n = 20, view = 'wide', tag = '' } = opts;
      if (!configs?.length) throw new Error('curve: configs [{name, apply}]');
      const rows = [];
      for (const N of counts) {
        const cans = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'].slice(0, N);
        const line = await SL.scene({ name: `_curve${N}`, note: `curve K${N} ${state}`, view, cans }, state === 'hanging' ? { dev: 22, live: true, canDur: 10 } : { dev: 8, live: true, canDur: 900 });
        SL.status = `curve K${N} ${state}: measuring`;
        const byName = {}; configs.forEach(c => { byName[c.name] = c; });
        const r = await SL.ab(v => byName[v].apply(), configs.map(c => c.name), { rounds, n, warm: 4, still: false, quiet: true, passes: ['smoke', 'direct', 'volFroxel', 'volumetrics', 'gather', 'softblur'] });
        await configs[0].apply();
        const row = { N, domains: SL.state().domains, line, kept: r.keptN, contended: r.contended, roundMeds: r.roundMeds };
        configs.forEach((c, i) => { row[c.name] = { union: r.minMed[i], unionMed: r.union[i]?.med, direct: r.perMin.direct?.[i], smoke: r.perMin.smoke?.[i] ?? 0, froxel: r.perMin.volFroxel?.[i], march: r.perMin.volumetrics?.[i], gather: r.perMin.gather?.[i], softblur: r.perMin.softblur?.[i] }; });
        rows.push(row);
        SL.log.push(`curve K${N} ${state} (${row.domains} dom): ` + configs.map(c => `${c.name} ∪${row[c.name].union?.toFixed(2)} d${row[c.name].direct?.toFixed(2)} s${(row[c.name].smoke ?? 0).toFixed(2)}`).join(' · ') + (r.contended ? ' CONTENDED' : ''));
        await SL.save(`smoke-curve-K-${state}${tag ? '-' + tag : ''}-${window.__quality?.current}`, { preset: window.__quality?.current, res: [E().width, E().height], kind: 'K', state, configs: configs.map(c => c.name), rows });
      }
      const out = { preset: window.__quality?.current, res: [E().width, E().height], kind: 'K', state, configs: configs.map(c => c.name), rows };
      out.text = [`CURVE K ${state} · ${out.res.join('x')} ${out.preset} · min-of-round union / direct / smoke per config`, 'N dom  ' + configs.map(c => c.name.padEnd(22)).join(''), ...rows.map(w => `${String(w.N).padStart(1)} ${String(w.domains).padStart(3)}  ` + configs.map(c => { const x = w[c.name]; return `${(x.union ?? NaN).toFixed(2)} / ${(x.direct ?? NaN).toFixed(2)} / ${(x.smoke ?? 0).toFixed(2)}`.padEnd(22); }).join('') + (w.contended ? '  (contended)' : ''))].join('\n');
      SL.log.push(out.text);
      return out;
    },
    // ------------------------------------------------------------------ fidelity stills ------------------------------------------------------------------
    /** for each config: apply → `frames` still renders (histories converge) → readback kept in SL.stillSet[name] + a PNG `<prefix>_<name>` on the sink. The scene must be FROZEN. */
    async stills(configs, opts = {}) {
      const { frames = 48, prefix = 'sp' } = opts; SL.stillSet = SL.stillSet || {};
      const out = {};
      for (const c of configs) { await c.apply(); await SL.render(frames); const fr = await SL.readback(); SL.stillSet[c.name] = fr; out[c.name] = { png: await SL.png(`${prefix}_${SL.cur}_${c.name}`, fr), hash: SL.hash(fr) }; }
      await configs[0].apply();
      return out;
    },
    /** crops (x, y, w, h in readback px) of every still in SL.stillSet, ×scale, named <prefix>_<scene>_<tile>_<config>.jpg, + luminance error of each vs `ref` inside the tile */
    async cropAll(tiles, opts = {}) {
      const { scale = 3, prefix = 'sp', ref = 'L0S8' } = opts; const out = {};
      const R = SL.stillSet?.[ref];
      for (const [tname, t] of Object.entries(tiles)) {
        out[tname] = {};
        for (const [cname, fr] of Object.entries(SL.stillSet || {})) {
          await SL.crop(`${prefix}_${SL.cur}_${tname}_${cname}`, t[0], t[1], t[2], t[3], scale, fr);
          out[tname][cname] = SL.tileLum(fr, t[0], t[1], t[2], t[3], cname === ref ? null : R);
        }
      }
      return out;
    },
    /** POST a JSON result to this lane's shot server (docs/perf/<name>.json) */
    async save(name, obj) { const r = await fetch(`http://localhost:${SL.shotPort}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj) }); return r.status; },
  };
  /** after a navigation: hooks up, the pane sized, menu closed, GPU errors collected */
  SL.boot = async (cssW = 1280, cssH = 720) => {
    await window.__ready;
    const v = document.getElementById('view');
    if (!(v.clientWidth > 0)) { v.style.width = cssW + 'px'; v.style.height = cssH + 'px'; document.body.style.minWidth = cssW + 'px'; document.body.style.minHeight = cssH + 'px'; SL.forcedSize = [cssW, cssH]; }
    for (let i = 0; i < 200 && !(v.clientWidth > 0); i++) await yieldTask();
    SL.arm(); window.__testVisible = true; window.__shotPort = SL.shotPort; window.__menu?.close();
    window.__runFrames(2, 1 / 60); await SL.settle();
    return { view: [v.clientWidth, v.clientHeight], hidden: document.hidden, preset: window.__quality?.current, res: [E().width, E().height], out: [E().outWidth, E().outHeight] };
  };
  window.__sl = SL; readyRes(SL);
  return 'smoke lab ready: __sl.{boot,scene,state,frames,take,ab,aa,quiet,profile,cfg,before,after,abPort,boxWords,exact,stepsError,d2pass,identityPass,png,crop,curve,stills,cropAll,save}';
})();
