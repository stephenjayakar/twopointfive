// GLASS BREAKING — the port's in-page instrument (docs/internal/glassbreak.md). Plain JS, nothing bundled; on a `?paused&quality=<tier>&mute[&glassbreak]` boot of THIS lane's
// server (:5252; shot sink :5253) once the hooks exist:
//     await import('/qa/glassbreak-scenes.js');           // → window.__gbs
//     await __gbs.proof()                                    // Sam in the corridor puts three FN2000 rounds into one spot of the conference glazing (pane 110): the cell falls as
//                                                            //   shards → docs/shots/gb_proof_* (corridor side pre / hit / fallen / settled, the room side, the carpet + lino)
//     await __gbs.tongue()                                   // five rounds in a row along the pane's foot: the cells go and the tongue above follows (support) → gb_tongue_*
//     await __gbs.cost({ frames: 60, rounds: 3 })            // serialized union / compS / gbuffer medians, interleaved: no pane holed vs three panes holed on screen (same view, same boot)
//     await __gbs.validate()                                 // this boot's presets × debug views 0/1/3/10 with three panes holed: GPU validation scopes + uncaptured errors (run on a
//                                                            //   ?glassbreak boot AND a ?glassbreak=0 boot: the switch is a compile-time const)
//     await __gbs.identityHash()                             // the deterministic still with the conference glazing + a crack star ON SCREEN (FNV of the readback): flag-off vs main
// Every scene puts chaos back, resets glass / destruction and clears particles when it is done. Deterministic staging (Math.random seeded per scene).
await (async () => {   // (top-level await: `await import('/qa/glassbreak-scenes.js')` resolves only once __gbs exists — the nested harness imports are awaited inside)
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__sh) await import('/qa/sharp-harness.js');
  const G = () => window.__game, E = () => window.__engine, C = () => window.__cam, D = () => window.__destr, B = () => window.__glassbreak;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  const shot = (name, q = 0.92) => window.__shot('gb_' + name, q);
  const run = (n, dt = 1 / 60) => window.__runFrames(n, dt);
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown'];
  // pane 110 = the conference partition's second sheet from the west: c (7.5, 1.5, 10), h (0.5, 1, 0.006), yaw 0 → annealed; the corridor runs z 10.06‥12.14 south of it
  const PANE = 110, PX = 7.5, PZ = 10.0;
  const VIEWS = {
    corr:  { look: [7.55, 1.2, 10.0], yaw: 14 * DEG, pitch: 12 * DEG, dist: 1.9 },      // from the corridor (the eye inside it: the corridor is two metres deep), a touch east of square, at chest height: the pane fills the frame
    room:  { look: [7.5, 1.2, 10.05], yaw: 194 * DEG, pitch: 16 * DEG, dist: 2.9 },    // from inside the conference room looking back south through the same pane at the lit corridor
    floor: { look: [7.55, 0.12, 9.55], yaw: 192 * DEG, pitch: 58 * DEG, dist: 2.3 },  // down at the room-side foot of the pane, where the shards land (they fall OUT along the blow: rounds from the corridor put them on the conference carpet)
    wide:  { look: [9.6, 1.1, 10.1], yaw: 24 * DEG, pitch: 22 * DEG, dist: 6.5 },      // three panes (109 · 110 · 111) in one frame for the cost take
  };
  const S = { chaos0: 0.5, on0: false, smoke0: true, lit0: null, log: [] };
  const GROUPS = ['conference', 'corridor'];   // lit for the takes: the room behind the glass and the corridor's own fixtures (a hole reads by the untinted room behind it and the lit rim; shards glint)
  function begin(chaos = 0.5, seed = 5150) {
    const g = G(); window.__testVisible = true; window.__menu?.close(); window.__shotPort = window.__shotPort ?? (parseInt(location.port, 10) + 1);
    Math.random = mulberry32(seed); g.godMode = true; g.clearAftermath(); g.resetGuards(); g.props.reset(); g.repairLights?.();
    S.chaos0 = D().chaos; S.on0 = B().on; D().chaos = chaos; if (!B().on) G().tune.glassBreak = true;   // (the tune only — the persisted switch is left alone; B().on = would save it)
    B().reset(); D().reset(); window.__particles?.clear?.(); g.decals?.clear?.();
    if (window.__weather) { try { window.__weather.setEnabled(false); } catch { /* */ } }
    S.smoke0 = window.__smoke?.params?.enabled ?? true; if (window.__smoke?.params) window.__smoke.params.enabled = false;   // no muzzle smoke for the takes: three rounds from a metre off fog the very pane being shown (the solver off renders none — glass is the subject here)
    S.lit0 = GROUPS.map(gr => [gr, g.targets.filter(t => t.group === gr).map(t => t.on)]); for (const gr of GROUPS) g.setGroup(gr, true);
    return g;
  }
  function end() { const g = G(); D().chaos = S.chaos0; g.tune.glassBreak = S.on0; C().pin = null; if (window.__smoke?.params) window.__smoke.params.enabled = S.smoke0; if (S.lit0) for (const [gr, ons] of S.lit0) g.targets.filter(t => t.group === gr).forEach((t, i) => { if (ons[i] !== undefined && t.on !== ons[i]) g.toggleTarget(t); }); }
  const stage = (view, player) => window.__stage({ ...VIEWS[view] }, { park: true, player: { pos: [PX + 0.9, 0, 11.55], yaw: Math.PI, holstered: false, ...player } });
  /** n FN2000 rounds from Sam's muzzle at p, `every` frames apart (destruction's own burst helper: fireWeapon with the player — raycast → glass.ts glassImpact → glassbreak.impact) */
  function shoot(p, n = 1, every = 7) { return D().burst(p, n, every); }
  const paneRec = () => B().panes().find(p => p.bi === PANE) ?? null;

  /** THE PROOF: three rounds into one spot of pane 110 from the corridor → the cell under them falls as shards. Corridor-side strip pre / after the 3rd round / the cell gone /
   *  settled, then the same hole from inside the room and the shards on the floor. */
  async function proof(opts = {}) {
    const { tag = '', at = [PX + 0.12, 1.32, PZ + 0.006] } = opts; const g = begin(0.5, 5150);
    stage('corr'); g.player.slot = 'rifle'; run(30);
    const out = []; out.push(await shot(`proof${tag}_c0pre`));
    shoot(at, 3, 7); run(2); out.push(await shot(`proof${tag}_c1hit`));            // the third round has just gone in: three stars, the crack network, nothing fallen yet (the think is 0.28 s off)
    run(20); out.push(await shot(`proof${tag}_c2fall`));                            // the cell is out and its shards are in the air / just down
    run(90); out.push(await shot(`proof${tag}_c3settled`));
    const rec = paneRec();
    stage('room'); run(6); out.push(await shot(`proof${tag}_room`));
    stage('floor'); run(6); out.push(await shot(`proof${tag}_floor`));
    const res = { shots: out, pane: rec, stats: { ...B().stats }, debris: D().debris, summary: B().summary(), errs: (window.__errs ?? []).slice(-4) };
    S.log.push(res); end(); return res;
  }
  /** THE TONGUE: five rounds walked along the lower half of the pane a hand apart — from the third on each drops its cell, and the glass left standing over the gap loses its support
   *  and follows a beat later. Strip after each round from the 3rd + settled. */
  async function tongue(opts = {}) {
    const { tag = '' } = opts; const g = begin(0.5, 5151);
    stage('corr'); g.player.slot = 'rifle'; run(30);
    const out = []; const pts = [-0.36, -0.18, 0.0, 0.18, 0.36].map(u => [PX + u, 0.95, PZ + 0.006]);
    for (let r = 0; r < pts.length; r++) { shoot(pts[r], 1, 1); run(24); if (r >= 2) out.push(await shot(`tongue${tag}_r${r + 1}`)); }
    run(60); out.push(await shot(`tongue${tag}_settled`)); run(120); out.push(await shot(`tongue${tag}_late`));
    const res = { shots: out, pane: paneRec(), stats: { ...B().stats }, summary: B().summary() };
    S.log.push(res); end(); return res;
  }
  /** hole three panes (109 · 110 · 111) with three rounds each in one spot, for the cost take / the validation sweep */
  function holeThree() { for (const x of [6.4, 7.6, 8.9]) { shoot([x, 1.3, PZ + 0.006], 3, 2); } run(30); return B().panes().filter(p => p.open > 0).length; }
  /** serialized per-pass medians over `frames` renders of the pinned 'wide' view (CLAUDE.md protocol: onSubmittedWorkDone + a task yield after every frame) */
  async function take(frames, warm = 8) {
    const T = E().timer; const per = {}; const uni = [];
    for (let f = 0; f < warm + frames; f++) {
      const before = T.resolved;
      run(1); await settle();
      for (let k = 0; k < 400 && T.resolved === before; k++) { if ((k & 15) === 15) await E().device.queue.onSubmittedWorkDone(); await yieldTask(); }
      if (f < warm || T.resolved === before) continue;
      const u = T.unionMs(RP); if (Number.isFinite(u) && u > 0) uni.push(u);
      for (const [k, v] of T.lastFrame) { if (!Number.isFinite(v)) continue; (per[k] ??= []).push(v); }
    }
    const med = a => { if (!a || !a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const passes = {}; for (const k of Object.keys(per)) passes[k] = +med(per[k]).toFixed(3);
    let sum = 0; for (const k of Object.keys(passes)) if (!RP.includes(k)) sum += passes[k];
    return { union: +med(uni).toFixed(3), sumCompute: +sum.toFixed(3), passes, n: uni.length };
  }
  /** COST: the 'wide' view (three panes on screen), interleaved rounds of A = every pane whole vs B = three panes holed (a cell or more out of each), same boot, serialized medians */
  async function cost(opts = {}) {
    const { frames = 60, rounds = 3 } = opts; const g = begin(0.5, 5152);
    stage('wide', { invisible: true, holstered: true }); g.player.slot = 'rifle'; run(40);
    const A = [], Bs = [];
    for (let r = 0; r < rounds; r++) {
      B().reset(); D().reset(); g.decals?.clear?.(); window.__particles?.clear?.(); run(30);
      A.push(await take(frames));
      const holed = holeThree(); run(120);   // (let the shards settle and the chips die down: the take is of the HOLES, not of a burst in flight)
      const b = await take(frames); b.holed = holed; Bs.push(b);
    }
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const pick = (arr, k) => { const m = med(arr.map(x => x.passes[k]).filter(Number.isFinite)); return Number.isFinite(m) ? +m.toFixed(3) : null; };
    const keys = [...new Set(A.concat(Bs).flatMap(x => Object.keys(x.passes)))];
    const table = { union: [+med(A.map(x => x.union)).toFixed(3), +med(Bs.map(x => x.union)).toFixed(3)] };
    for (const k of keys) table[k] = [pick(A, k), pick(Bs, k)];
    const res = { q: window.__quality?.current, res: [E().width, E().height, E().outWidth, E().outHeight], frames, rounds, table, A, B: Bs, gpuConst: B().gpu };
    S.log.push(res); end(); return res;
  }
  /** VALIDATION: on THIS boot (the const as compiled), every preset × debug views 0 / 1 / 3 / 10 with three panes holed and shards down: a validation error scope round 12 frames each +
   *  the uncaptured-error list. Returns { ok, rows } */
  async function validate(opts = {}) {
    const { presets = ['verylow', 'low', 'medium', 'high', 'ultra'], views = [0, 1, 3, 10], frames = 12 } = opts; const g = begin(0.5, 5153);
    if (!window.__errs) { window.__errs = []; E().device.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
    stage('wide', { invisible: true, holstered: true }); g.player.slot = 'rifle'; run(20); holeThree(); run(60);
    const rows = []; const q0 = window.__quality?.current;
    for (const p of presets) {
      await window.__quality.apply(p); run(4);
      for (const dv of views) {
        E().settings.debugView = dv; const e0 = window.__errs.length;
        E().device.pushErrorScope('validation');
        run(frames); await settle();
        const err = await E().device.popErrorScope();
        rows.push({ preset: p, view: dv, scope: err ? err.message : null, uncaptured: window.__errs.slice(e0) });
      }
      E().settings.debugView = 0;
    }
    if (q0) await window.__quality.apply(q0);
    const bad = rows.filter(r => r.scope || r.uncaptured.length);
    const res = { ok: bad.length === 0, gpuConst: B().gpu, n: rows.length, bad, rows };
    S.log.push(res); end(); return res;
  }
  /** IDENTITY: the deterministic still (sharp-harness's recipe: seeded, parked, pinned, grain 0, 40 fixed steps, one offscreen render, FNV of the readback) of a view WITH the conference glazing and
   *  one crack star on screen — so composite's glass path and glassMarks are in the hash. Same call on main served beside = the flag-off identity claim. */
  async function identityHash(frames = 40) {
    await window.__sh.boot();
    window.__sh.VIEWS.gb = { pin: { ...VIEWS.wide } };
    // one crack star on pane 110 through glass.ts (a 'hand' hit files no impact when the switch is off / main has no such module — the decal, the sound and the event are the same either side)
    window.__glass.hit(PANE, [PX + 0.1, 1.3, PZ], [0, 0, -1]);
    const r = await window.__sh.identityHash('gb', frames);
    return { ...r, glassbreakGpu: B()?.gpu ?? '(main: no module)', cracks: window.__glass.cracks };
  }
  window.__gbs = { VIEWS, PANE, begin, end, stage, shoot, holeThree, proof, tongue, cost, take, validate, identityHash, get log() { return S.log; } };
  return 'glassbreak scenes ready: __gbs.{proof,tongue,cost,validate,identityHash}';
})();
