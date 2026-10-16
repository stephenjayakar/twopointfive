// RAY-TRAVERSAL LAB (ported from exp/trace-perf, docs/internal/trace-perf.md) — the in-page instruments behind every number in that notebook. Dev only:
//   boot `?paused&quality=<p>&mute[&trace=N]`, then  await import('/qa/trace-lab.js'); await __tlReady  → window.__tl
// ON MAIN only the reference walk exists: the branch's traversal variants (V1‥V8, H1) were negative results and were not merged, so __tl.variants is {…: [0]} and the
// selectors call occluded / occludedT / traceClosest directly. To price the NEXT traversal idea: add `fn occludedV<N> / occludedTV<N> / traceClosestV<N>` copies to
// common.wgsl (+ rename today's bodies …V0 and add three thin `switch (TRACE_VARIANT)` dispatchers under the old names, as the branch did), `__tl.use(N)`, then bench /
// exact / abVariants against 0 — refresh() finds the V-suffixed functions by itself.
// What it does:
//   * SCENES  __tl.scene('B1'…'B5') stages the notebook's fixed views (B4 pulls in /qa/stress-scene.js, B5 swaps daylight in).
//   * FRAMES  __tl.frames(n) = n serialized still renders (engine.render of the CURRENT game state, each followed by onSubmittedWorkDone + a MessageChannel yield —
//             CLAUDE.md 'GPU timing') → per-pass arrays + the compute UNION per frame; __tl.ab(apply, variants) interleaves K variants round-robin (rotating start)
//             and reports per-pass / union medians; __tl.aa() is the contention check (the same variant twice must agree within ~2 %).
//   * VARIANTS __hotCommon(src?, variant?) (main.ts) installs an edited common.wgsl and/or TRACE_VARIANT into EVERY tracing pipeline without a reboot; __tl.use(v) is the
//             short form. The lab's own kernels (src/render/shaders/trace_lab.wgsl, served from disk, never bundled) are compiled behind the same prelude + selector functions
//             generated here from __tl.variants (which V-suffixed copies exist in the common text under test).
//   * MICRO   __tl.points('camera'|'level') traces the receiver points once; __tl.bench({cls, fn, variants, reps}) times N·reps rays of one class through one query per variant
//             (timestamp query round the lab's own compute pass, interleaved, medians) → Mrays/s; __tl.exact({cls, fn, a, b}) runs A and B on the same rays in the same thread
//             → disagreement counters (must be 0 for an 'exact' variant) + the first offending rays; __tl.profile({cls}) = the reference walk's counters per ray.
//   * IDENTITY __tl.idHash('B1') = the deterministic capture protocol (seeded Math.random before the first frame, staged, phases zeroed, fixed serialized step/render counts,
//             grain 0) → FNV hash of the final frame; run it first thing on a fresh boot per variant (?trace=N) and compare.
(async () => {
  let readyRes; window.__tlReady = new Promise(r => { readyRes = r; });   // `await import('/qa/trace-lab.js'); await __tlReady;` — the module body below awaits other imports before __tl exists
  if (!window.__perf) await import('/qa/perf-harness.js');
  const E = () => window.__engine, G = () => window.__game, D = () => window.__engine.device, C = () => window.__cam;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'];
  const DEG = Math.PI / 180;
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const st = a => { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); const q = f => s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; const m = a.reduce((x, y) => x + y, 0) / a.length; return { med: +q(0.5).toFixed(3), p25: +q(0.25).toFixed(3), p75: +q(0.75).toFixed(3), p95: +q(0.95).toFixed(3), min: +s[0].toFixed(3), mean: +m.toFixed(3), n: a.length }; };
  const CLS = { ao: 0, light: 1, sun: 2, gather: 3, reflect: 4, random: 5, column: 6, panel: 7, lightC: 8, gatherB: 9, gatherB2: 10, gatherQ: 11, gatherH: 12 };
  const FN = { occluded: 0, occludedT: 1, traceClosest: 2, none: 9 };
  const PROF_NAMES = ['globTest', 'globSkip', 'cells', 'cellRunSkip', 'cellMaskRej', 'cellList', 'items', 'itemYCull', 'itemOwner', 'slab', 'slabHit', 'capSphere', 'capTest', 'ansGlobal', 'ansGrid', 'ansCaps', 'ansMiss', 'cellEmptyList', 'slabRot', 'slabYaw', 'exitIterSum'];
  const TL = {
    log: [],
    shotPort: window.__shotPort || 5174,   // the capture sink for crops / PNGs / JSON results (tools/shot-server.ts; a lane sets window.__shotPort to its own before importing)
    /** variant ids that exist as V-suffixed functions in the common text under test, per query (the selectors are generated from this; refresh() re-derives it) */
    variants: { occluded: [0], occludedT: [0], traceClosest: [0] },
    // ------------------------------------------------------------------ scenes ------------------------------------------------------------------
    SCENES: {
      B1: { note: 'cubicles at night, follow-camera height (many small lights + panels)', pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, stage: { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } } },
      B2: { note: 'corridor under the panels, three torch guards + Sam in view (capsules / mesh in play)', pin: { look: [26.5, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 9 },
            stage: { park: true, guards: [{ i: 0, pos: [24.2, 0, 10.9], yaw: Math.PI, torch: true, aimPitch: -0.25 }, { i: 1, pos: [27.4, 0, 11.4], yaw: Math.PI / 2, torch: true, aimPitch: -0.2 }, { i: 2, pos: [30.2, 0, 10.5], yaw: -Math.PI / 2, torch: true, aimPitch: -0.3 }], player: { pos: [22.3, 0, 11.2], yaw: 1.57, holstered: true, invisible: false } } },
      B3: { note: 'lobby stone + the frontage glass (long rays, glass, gloss)', pin: { look: [8.4, 0, 17.0], yaw: 30 * DEG, pitch: 50 * DEG, dist: 9 }, stage: { park: true, player: { pos: [30.8, 0, 9.0], yaw: 3.1, holstered: true, invisible: true } } },
      B4: { note: 'the stress minute staged (QRF lights, smoke, rain), camera pinned mid-floor — __stress.setup({fight:false})', stress: true },
      B5: { note: 'DAYLIGHT: the corridor + east offices under the sun (kind-2 shadow rays from every pixel)', daylight: true, pin: { look: [27.4, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 10 },
            stage: { park: true, guards: [{ i: 0, pos: [25.5, 0, 10.9], yaw: Math.PI, torch: false }, { i: 1, pos: [29.5, 0, 11.2], yaw: -Math.PI / 2, torch: false }], player: { pos: [22.3, 0, 11.2], yaw: 1.57, holstered: true, invisible: false } } },
    },
    cur: null,
    async scene(name, opts = {}) {
      const { settle = 30, renders = 30 } = opts;
      const sc = TL.SCENES[name]; if (!sc) throw new Error('scenes: ' + Object.keys(TL.SCENES).join(' '));
      if (!(document.getElementById('view')?.clientWidth > 0)) throw new Error('#view has no size: front the tab / take a screenshot first');
      window.__testVisible = true; window.__shotPort = TL.shotPort; window.__menu?.close();
      if (TL.cur && TL.SCENES[TL.cur]?.daylight && !sc.daylight) window.__daylight(false);
      if (sc.stress) {
        if (!window.__stress) await import('/qa/stress-scene.js');
        if (TL.stressStaged !== true) { TL.log.push(await window.__stress.setup({ fight: false })); TL.stressStaged = true; }
        else { C().pin = { look: [...window.__stress.center], yaw: window.__stress.yaw0, pitch: window.__stress.pitch, dist: window.__stress.dist }; }
      } else {
        if (sc.daylight) window.__daylight(true);
        window.__stage(sc.pin, sc.stage);
      }
      window.__perf.still();
      await window.__perf.step(settle);
      await TL.render(renders);
      TL.cur = name;
      return `${name}: ${sc.note} · ${E().width}x${E().height} ${window.__quality?.current} · lights ${E().lights.activeCount} · chars ${E().world.charCount} · boxes ${E().world.all.length} (dyn ${E().world.dynamics.length}) · smoke ${window.__smoke?.stats?.live ?? 0}`;
    },
    // ------------------------------------------------------------------ frame timing ------------------------------------------------------------------
    async settle() { await D().queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); },
    time: 100,
    /** n serialized still renders of the current game state (nothing steps; frame.time advances) */
    async render(n = 1) { for (let i = 0; i < n; i++) { E().render(C(), TL.time, 1 / 60, false); TL.time += 1 / 60; await TL.settle(); } },
    /** n serialized frames after `warm` → { passes: {name: [ms…]}, union: [ms…], sum: [ms…] } (still = renders; else game steps) */
    async frames(n = 30, opts = {}) {
      const { warm = 6, still = true } = opts;
      const t = E().timer; const per = {}; const union = [], sum = [];
      for (let i = 0; i < warm + n; i++) {
        const before = t.resolved;
        if (still) await TL.render(1); else { window.__runFrames(1, 1 / 60); await TL.settle(); }
        for (let k = 0; k < 400 && t.resolved === before; k++) { if ((k & 15) === 15) await D().queue.onSubmittedWorkDone(); await yieldTask(); }
        if (i < warm || t.resolved === before) continue;
        let s = 0; for (const [k, v] of t.lastFrame) { if (RP.includes(k)) continue; s += v; (per[k] ??= []).push(v); }
        sum.push(s); union.push(t.unionMs(RP));
      }
      return { passes: per, union, sum };
    },
    PASSES: ['direct', 'gather', 'rc c0', 'rc c1', 'rc c2', 'rc c3', 'volFroxel', 'volumetrics', 'reflect', 'particles', 'softblur', 'temporal'],
    /** interleaved K-variant A/B: rounds × (for each variant, in a rotating order: apply(v) → warm → n frames), pooled → per-pass medians per variant + union/sum medians + text */
    async ab(apply, variants, opts = {}) {
      const { rounds = 3, n = 30, warm = 8, still = true, passes = TL.PASSES } = opts;
      const pool = variants.map(() => ({ per: {}, union: [], sum: [] }));
      for (let r = 0; r < rounds; r++) {
        for (let k = 0; k < variants.length; k++) {
          const vi = (k + r) % variants.length;
          await apply(variants[vi]);
          const f = await TL.frames(n, { warm, still });
          const P = pool[vi]; for (const [name, a] of Object.entries(f.passes)) (P.per[name] ??= []).push(...a); P.union.push(...f.union); P.sum.push(...f.sum);
        }
      }
      await apply(variants[0]);
      const out = { variants, res: [E().width, E().height], preset: window.__quality?.current, scene: TL.cur, per: {}, union: pool.map(P => st(P.union)), sum: pool.map(P => st(P.sum)) };
      for (const p of passes) { const row = pool.map(P => st(P.per[p])); if (row.some(x => x)) out.per[p] = row; }
      const rc = pool.map(P => { const names = ['rc c0', 'rc c1', 'rc c2', 'rc c3', 'rc dice']; const m = Math.min(...names.map(nm => (P.per[nm] || []).length)); if (!isFinite(m) || m === 0) return null; const a = []; for (let i = 0; i < m; i++) a.push(names.reduce((s, nm) => s + P.per[nm][i], 0)); return st(a); });
      if (rc.some(x => x)) out.per.rcSum = rc;
      const fmt = (row) => row.map((x, i) => x ? `${String(variants[i]).padStart(3)}: ${x.med.toFixed(2)} (${x.p25.toFixed(2)}–${x.p75.toFixed(2)})` : `${variants[i]}: -`).join('   ');
      const lines = [];
      for (const [p, row] of Object.entries(out.per)) { const b = row[0]?.med; lines.push(`${p.padEnd(11)} ${fmt(row)}` + (b ? '   Δ% ' + row.map(x => x ? ((x.med / b - 1) * 100).toFixed(1) : '-').join(' / ') : '')); }
      lines.push(`${'union'.padEnd(11)} ${fmt(out.union)}   Δ% ${out.union.map(x => x ? ((x.med / out.union[0].med - 1) * 100).toFixed(1) : '-').join(' / ')}`);
      lines.push(`${'sum'.padEnd(11)} ${fmt(out.sum)}`);
      lines.push(`${TL.cur ?? '?'} · ${out.res.join('x')} ${out.preset} · rounds ${rounds} × ${n} frames`);
      out.text = lines.join('\n');
      return out;
    },
    /** switch every tracing pipeline to TRACE_VARIANT v of the common text on disk (or `src`) */
    async use(v, src) { const r = await window.__hotCommon(src === undefined ? (window.__traceConfig.common ?? null) : src, v); if (!r.ok) throw new Error('hotCommon failed: ' + JSON.stringify(r.failed).slice(0, 800)); TL.pipes = {}; return r; },
    /** frame-cost A/B of traversal variants on the current scene: __hotCommon per variant, interleaved */
    async abVariants(variants = [0, 1], opts = {}) { return TL.ab(v => TL.use(v), variants, opts); },
    /** contention check: the same configuration measured twice as if it were two variants — the medians must agree within ~2 % */
    async aa(opts = {}) { const r = await TL.ab(async () => {}, ['A', 'A′'], { rounds: 2, n: 30, ...opts }); const u = r.union; r.aaPct = u[0] && u[1] ? +Math.abs((u[1].med / u[0].med - 1) * 100).toFixed(2) : null; r.clean = r.aaPct !== null && r.aaPct < 2.5; return r; },
    // ------------------------------------------------------------------ lab kernels ------------------------------------------------------------------
    N_POINTS: 262144, PTS_W: 1024, N_THREADS: 1 << 20,
    pipes: {},           // key `${variantConst}|${textHash}` → { pipe }
    /** the common text under test = what the engine's prelude is built from right now */
    commonText() { return window.__commonSource(); },
    /** re-derive which V-suffixed variants exist in the common text (fills TL.variants) */
    refresh() {
      const src = TL.commonText(); const v = { occluded: new Set([0]), occludedT: new Set([0]), traceClosest: new Set([0]) };
      for (const m of src.matchAll(/\bfn (occludedT|occluded|traceClosest)V(\d+)\s*\(/g)) v[m[1]].add(+m[2]);
      TL.variants = { occluded: [...v.occluded].sort((a, b) => a - b), occludedT: [...v.occludedT].sort((a, b) => a - b), traceClosest: [...v.traceClosest].sort((a, b) => a - b) };
      TL.hasV0 = /\bfn occludedV0\s*\(/.test(src);
      return TL.variants;
    },
    /** the selector functions the lab kernels call: a switch over the variants present (v not present → the reference) */
    selectors() {
      TL.refresh();
      const name = (q, v) => (v === 0 && !TL.hasV0) ? q : `${q}V${v}`;
      const mk = (q, ret, args) => `fn ${q}Sel(v: u32, ro: vec3f, rd: vec3f, tmax: f32, skip: u32) -> ${ret} {\n  switch (v) {\n` + TL.variants[q].filter(x => x !== 0).map(x => `    case ${x}u: { return ${name(q, x)}(${args}); }\n`).join('') + `    default: { return ${name(q, 0)}(${args}); }\n  }\n}\n`;
      return mk('occluded', 'bool', 'ro, rd, tmax, skip') + mk('occludedT', 'f32', 'ro, rd, tmax, skip') + mk('traceClosest', 'Hit', 'ro, rd, tmax, skip');
    },
    async labSource() { TL._labSrc ??= await (await fetch('/qa/shader/trace_lab.wgsl', { cache: 'no-store' })).text(); return TL._labSrc; },
    reloadLab() { TL._labSrc = null; TL.pipes = {}; },
    ensureLayout() {
      if (TL.layout) return;
      const d = D();
      TL.layout = d.createBindGroupLayout({ label: 'traceLab', entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float', viewDimension: '2d' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'depth', viewDimension: '2d' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'uint', viewDimension: '2d' } },
      ] });
      TL.pl = d.createPipelineLayout({ bindGroupLayouts: [E().sceneLayout, TL.layout] });
      const ptsH = Math.ceil(TL.N_POINTS * 2 / TL.PTS_W);
      const mkTex = (label) => d.createTexture({ label, size: [TL.PTS_W, ptsH], format: 'rgba32float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
      TL.ptsTex = mkTex('labPts'); TL.ptsDummy = mkTex('labPtsDummy');   // (a texture may not be sampled and stored in one dispatch: the dummy takes whichever role is idle)
      TL.paramsBuf = d.createBuffer({ label: 'labParams', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      TL.outWords = 256 + TL.N_THREADS;
      TL.outBuf = d.createBuffer({ label: 'labOut', size: TL.outWords * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      TL.readBuf = d.createBuffer({ label: 'labRead', size: TL.outWords * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      TL.qs = d.createQuerySet({ type: 'timestamp', count: 2 });
      TL.qResolve = d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      TL.qRead = d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      TL.gbKey = null;
    },
    /** the two bind groups (points: writes ptsTex; bench: reads it), re-made whenever the g-buffer's views changed (a resize / preset hop re-creates them) */
    bindGroups() {
      const d = D(), gb = E().gbuffer; const key = gb.depthView;
      if (TL.gbKey === key && TL.bgPoints) return;
      const gbe = [{ binding: 4, resource: gb.depthView }, { binding: 5, resource: gb.normalView }, { binding: 6, resource: gb.idView }];
      TL.bgPoints = d.createBindGroup({ layout: TL.layout, entries: [{ binding: 0, resource: { buffer: TL.paramsBuf } }, { binding: 1, resource: TL.ptsDummy.createView() }, { binding: 2, resource: { buffer: TL.outBuf } }, { binding: 3, resource: TL.ptsTex.createView() }, ...gbe] });
      TL.bgBench = d.createBindGroup({ layout: TL.layout, entries: [{ binding: 0, resource: { buffer: TL.paramsBuf } }, { binding: 1, resource: TL.ptsTex.createView() }, { binding: 2, resource: { buffer: TL.outBuf } }, { binding: 3, resource: TL.ptsDummy.createView() }, ...gbe] });
      TL.gbKey = key;
    },
    hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); },
    /** the lab pipeline compiled with `const TRACE_VARIANT = v` behind the CURRENT common text (+ selectors + trace_lab.wgsl); cached per (v, text) */
    async pipe(v = 0) {
      TL.ensureLayout();
      const pre0 = window.__scenePrelude(false);
      const pre = pre0.replace(/const TRACE_VARIANT: u32 = \d+u;/, `const TRACE_VARIANT: u32 = ${v | 0}u;`);
      const src = pre + '\n' + TL.selectors() + '\n' + await TL.labSource();
      const key = v + '|' + TL.hashStr(src);
      if (TL.pipes[key]) return TL.pipes[key];
      const d = D(); const mod = d.createShaderModule({ code: src, label: 'traceLab' + v });
      const info = await mod.getCompilationInfo(); const off = pre.split('\n').length;
      const errs = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum - off}:${m.linePos} ${m.message} · ${(src.split('\n')[m.lineNum - 1] || '').trim().slice(0, 120)}`);
      if (errs.length) throw new Error('trace_lab.wgsl:\n' + errs.slice(0, 8).join('\n'));
      const pipe = await d.createComputePipelineAsync({ label: 'traceLab' + v, layout: TL.pl, compute: { module: mod, entryPoint: 'main' } });
      TL.pipes[key] = pipe; return pipe;
    },
    writeParams(p) {
      const u = new Uint32Array(16);
      u[0] = p.mode; u[1] = p.cls ?? 0; u[2] = TL.N_POINTS; u[3] = p.nThreads ?? TL.N_THREADS; u[4] = p.seed ?? 1; u[5] = p.reps ?? 1; u[6] = p.fnSel ?? 0; u[7] = p.va ?? 0; u[8] = p.vb ?? 0; u[9] = TL.PTS_W; u[10] = p.coh ?? 1; u[11] = p.stride ?? 1;
      D().queue.writeBuffer(TL.paramsBuf, 0, u);
    },
    /** one lab dispatch: → { ms (GPU, timestamp pair round the pass), words?: Uint32Array (the out buffer, when read = true) } */
    async dispatch(pipe, params, opts = {}) {
      const { read = true, points = false, clear = true } = opts;
      const d = D(); TL.writeParams(params); TL.bindGroups();
      const threads = points ? TL.N_POINTS : (params.nThreads ?? TL.N_THREADS);
      const enc = d.createCommandEncoder({ label: 'traceLab' });
      if (clear) enc.clearBuffer(TL.outBuf, 0, 256 * 4);
      const pass = enc.beginComputePass({ label: 'traceLab', timestampWrites: { querySet: TL.qs, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } });
      pass.setPipeline(pipe); pass.setBindGroup(0, E().sceneBindGroup()); pass.setBindGroup(1, points ? TL.bgPoints : TL.bgBench);
      pass.dispatchWorkgroups(Math.ceil(threads / 64)); pass.end();
      enc.resolveQuerySet(TL.qs, 0, 2, TL.qResolve, 0); enc.copyBufferToBuffer(TL.qResolve, 0, TL.qRead, 0, 16);
      if (read) enc.copyBufferToBuffer(TL.outBuf, 0, TL.readBuf, 0, TL.outWords * 4);
      d.queue.submit([enc.finish()]);
      await d.queue.onSubmittedWorkDone();
      await TL.qRead.mapAsync(GPUMapMode.READ); const q = new BigInt64Array(TL.qRead.getMappedRange().slice(0)); TL.qRead.unmap();
      const ms = Number(q[1] - q[0]) / 1e6;
      let words = null;
      if (read) { await TL.readBuf.mapAsync(GPUMapMode.READ); words = new Uint32Array(TL.readBuf.getMappedRange().slice(0)); TL.readBuf.unmap(); }
      return { ms, words };
    },
    /** trace the receiver points for the current scene: 'camera' (the g-buffer's own distribution) or 'level' (floor/desk tops + walls level-wide) */
    async points(mode = 'camera', seed = 1) {
      E().render(C(), TL.time, 1 / 60, false); TL.time += 1 / 60; await TL.settle();   // (a render first: the frame uniforms / scene buffers hold THIS view)
      const pipe = await TL.pipe(0);
      const r = await TL.dispatch(pipe, { mode: mode === 'level' ? 1 : 0, seed }, { points: true, read: false });
      // count valid points by reading the texture back (once; cheap)
      const d = D(); const ptsH = Math.ceil(TL.N_POINTS * 2 / TL.PTS_W); const bpr = TL.PTS_W * 16;
      const rb = d.createBuffer({ size: bpr * ptsH, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = d.createCommandEncoder(); enc.copyTextureToBuffer({ texture: TL.ptsTex }, { buffer: rb, bytesPerRow: bpr }, [TL.PTS_W, ptsH]); d.queue.submit([enc.finish()]);
      await rb.mapAsync(GPUMapMode.READ); const f = new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy();
      let valid = 0, caps = 0, up = 0; for (let i = 0; i < TL.N_POINTS; i++) { const o = i * 8; if (f[o + 3] > 0.5) { valid++; if (f[o + 7] > 1.5) caps++; if (f[o + 5] > 0.9) up++; } }
      TL.ptsMode = mode; TL.ptsInfo = { mode, valid, validFrac: +(valid / TL.N_POINTS).toFixed(3), onCapsules: caps, upFacingFrac: +(up / Math.max(1, valid)).toFixed(3), ms: +r.ms.toFixed(2) };
      return TL.ptsInfo;
    },
    sumWords(words, nThreads) { let ok = 0, hit = 0, ck = 0; for (let i = 0; i < nThreads; i++) { const w = words[256 + i]; ok += w >>> 24; hit += (w >>> 16) & 255; ck = (ck + (w & 0xffff)) >>> 0; } return { ok, hit, ck }; },
    /** MICRO-BENCH: rays of class `cls` through query `fn` for each variant (interleaved `runs` times) → per variant { ms med, Mrays/s, hitFrac, checksum }.
     *  opts: { cls = 'light', fn = (occludedT for light/sun/panel, traceClosest for gather/reflect, occluded otherwise), variants = TL.variants[fn], reps = 4, runs = 5, nThreads } */
    async bench(opts = {}) {
      const cls = CLS[opts.cls ?? 'light']; if (cls === undefined) throw new Error('cls: ' + Object.keys(CLS).join(' '));
      const fnName = opts.fn ?? ({ light: 'occludedT', lightC: 'occludedT', sun: 'occludedT', panel: 'occludedT', gather: 'traceClosest', gatherB: 'traceClosest', gatherB2: 'traceClosest', gatherQ: 'traceClosest', gatherH: 'traceClosest', reflect: 'traceClosest' }[opts.cls ?? 'light'] ?? 'occluded');
      const fnSel = FN[fnName]; if (fnSel === undefined) throw new Error('fn: ' + Object.keys(FN).join(' '));
      TL.refresh();
      const variants = opts.variants ?? (fnName === 'none' ? [0] : TL.variants[fnName]);
      const reps = opts.reps ?? 4, runs = opts.runs ?? 5, nThreads = opts.nThreads ?? TL.N_THREADS, seed = opts.seed ?? 7, coh = opts.coh ?? 1, stride = opts.stride ?? 1;
      if (!TL.ptsInfo) await TL.points('camera');
      const pipes = {}; for (const v of variants) pipes[v] = await TL.pipe(v);
      const emptyPipe = await TL.pipe(variants[0]);
      // warm-up (clocks up, caches warm): one untimed run per variant + the empty query
      for (const v of variants) await TL.dispatch(pipes[v], { mode: 10, cls, fnSel, reps, nThreads, seed, coh, stride }, { read: false });
      const times = {}; const info = {};
      const emptyMs = [];
      for (let r = 0; r < runs; r++) {
        for (let k = 0; k < variants.length; k++) {
          const v = variants[(k + r) % variants.length];
          const res = await TL.dispatch(pipes[v], { mode: 10, cls, fnSel, reps, nThreads, seed, coh, stride }, { read: r === 0 });
          (times[v] ??= []).push(res.ms);
          if (res.words) info[v] = TL.sumWords(res.words, nThreads);
        }
        const er = await TL.dispatch(emptyPipe, { mode: 10, cls, fnSel: 9, reps, nThreads, seed, coh, stride }, { read: r === 0 });
        emptyMs.push(er.ms); if (er.words) info.empty = TL.sumWords(er.words, nThreads);
      }
      const rays = info[variants[0]]?.ok ?? 0; const eMed = st(emptyMs).med;
      const out = { cls: opts.cls ?? 'light', fn: fnName, reps, runs, nThreads, coh, stride, rays, raysPerThread: +(rays / nThreads).toFixed(2), points: TL.ptsInfo?.mode, scene: TL.cur, emptyMs: eMed, per: {} };
      const v0 = variants[0];
      for (const v of variants) {
        const s = st(times[v]); const net = Math.max(s.med - eMed, 1e-3);
        // PAIRED speed-up: per run r the two takes sit next to each other in time, so net(v0, r) / net(v, r) cancels clock / contention drift; median over runs
        const ratios = times[v].map((t, r) => Math.max(times[v0][r] - eMed, 1e-3) / Math.max(t - eMed, 1e-3));
        const rs = st(ratios);
        out.per[v] = { ms: s.med, msP25: s.p25, msP75: s.p75, netMs: +net.toFixed(3), mrays: +(rays / net / 1000).toFixed(1), mraysGross: +(rays / s.med / 1000).toFixed(1), speedup: rs.med, speedupP25: rs.p25, speedupP75: rs.p75, hitFrac: info[v] ? +(info[v].hit / Math.max(1, info[v].ok)).toFixed(4) : null, ck: info[v]?.ck };
      }
      const b = out.per[v0];
      out.text = `${out.cls}/${fnName} · ${(rays / 1e6).toFixed(2)} M rays (${out.raysPerThread}/thread, hit ${b.hitFrac})${coh > 1 ? ' · coh ' + coh : ''}${stride > 1 ? ' · stride ' + stride : ''} · empty ${eMed.toFixed(2)} ms · ${runs} runs\n` + variants.map(v => { const p = out.per[v]; return `  V${v}: ${p.ms.toFixed(2)} ms (net ${p.netMs.toFixed(2)}) → ${p.mrays} Mrays/s${v !== v0 ? `  paired ×${p.speedup.toFixed(3)} (${p.speedupP25.toFixed(3)}–${p.speedupP75.toFixed(3)}) = ${((p.speedup - 1) * 100).toFixed(1)} % faster` : ''}${p.ck !== b.ck ? '  ⚠ checksum differs' : ''}`; }).join('\n');
      return out;
    },
    /** the standard battery: every class through its natural query, per variant → rows */
    async benchAll(opts = {}) {
      const rows = {}; const classes = opts.classes ?? ['ao', 'light', 'panel', 'sun', 'column', 'gather', 'reflect', 'random'];
      for (const c of classes) { try { rows[c] = await TL.bench({ ...opts, cls: c }); } catch (e) { rows[c] = { error: String(e.message || e) }; } }
      rows.text = classes.map(c => rows[c].text ?? `${c}: ${rows[c].error}`).join('\n');
      return rows;
    },
    /** EXACTNESS: variants a vs b of query `fn` on the same rays of class `cls` → counters (all zero = bit-exact over these rays) + the first offending rays */
    async exact(opts = {}) {
      const cls = CLS[opts.cls ?? 'light']; const fnName = opts.fn ?? 'occluded'; const fnSel = FN[fnName];
      const a = opts.a ?? 0, b = opts.b ?? 1, reps = opts.reps ?? 4, nThreads = opts.nThreads ?? TL.N_THREADS, seed = opts.seed ?? 3;
      if (!TL.ptsInfo) await TL.points('camera');
      const pipe = await TL.pipe(0);
      const res = await TL.dispatch(pipe, { mode: 20, cls, fnSel, reps, nThreads, seed, va: a, vb: b }, { read: true });
      const w = res.words; const S = TL.sumWords(w, nThreads);
      const f32 = new Float32Array(w.buffer);
      const nLog = Math.min(16, w[14]); const log = [];
      const h2f = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 5.96e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); };
      for (let k = 0; k < nLog; k++) { const o = 64 + k * 8; log.push({ ro: [f32[o], f32[o + 1], f32[o + 2]].map(x => +x.toFixed(4)), tmax: +f32[o + 3].toFixed(4), rd: [f32[o + 4], f32[o + 5], f32[o + 6]].map(x => +x.toFixed(5)), a: +h2f(w[o + 7] & 0xffff).toFixed(4), b: +h2f(w[o + 7] >>> 16).toFixed(4) }); }
      const out = { cls: opts.cls ?? 'light', fn: fnName, a, b, rays: S.ok, hits: S.hit, disBool: w[8], disT: w[9], disIdx: w[10], disN: w[11], tSmall: w[12], maxDt: f32[13], exact: w[8] + w[9] + w[10] + w[11] === 0, log, ms: +res.ms.toFixed(1), scene: TL.cur, points: TL.ptsInfo?.mode };
      out.text = `exact ${fnName} V${a} vs V${b} on ${out.cls}: ${(S.ok / 1e6).toFixed(2)} M rays, ${S.hit} hits → bool ${w[8]} · t ${w[9]} · idx ${w[10]} · n ${w[11]} (sub-1e-4 t diffs ${w[12]}, max |Δt| ${f32[13].toExponential(2)}) ${out.exact ? '✔ EXACT' : '✘ DIFFERS'}`;
      return out;
    },
    /** the exactness battery for variant b against the reference: every query × the classes that matter → all rows + a verdict */
    async exactAll(b, opts = {}) {
      const rows = []; const combos = opts.combos ?? [['occluded', 'ao'], ['occluded', 'light'], ['occluded', 'random'], ['occluded', 'column'], ['occluded', 'sun'], ['occludedT', 'light'], ['occludedT', 'panel'], ['occludedT', 'sun'], ['traceClosest', 'gather'], ['traceClosest', 'reflect'], ['traceClosest', 'random'], ['traceClosest', 'light']];
      for (const [fn, cls] of combos) { if (!TL.variants[fn].includes(b)) continue; rows.push(await TL.exact({ ...opts, fn, cls, a: opts.a ?? 0, b })); }
      const total = rows.reduce((s, r) => s + r.rays, 0); const bad = rows.filter(r => !r.exact);
      return { b, rows, totalRays: total, exact: bad.length === 0, text: rows.map(r => r.text).join('\n') + `\n= V${b}: ${(total / 1e6).toFixed(1)} M rays, ${bad.length ? 'NOT exact in ' + bad.map(r => r.fn + '/' + r.cls).join(' ') : 'EXACT everywhere'}` };
    },
    /** PROFILE: the reference any-hit walk with counters on rays of class `cls` → per-ray averages */
    async profile(opts = {}) {
      const cls = CLS[opts.cls ?? 'light']; const reps = opts.reps ?? 2, nThreads = opts.nThreads ?? (1 << 18), seed = opts.seed ?? 5; const closest = !!opts.closest;
      if (!TL.ptsInfo) await TL.points('camera');
      const pipe = await TL.pipe(0);
      const res = await TL.dispatch(pipe, { mode: closest ? 31 : 30, cls, fnSel: 0, reps, nThreads, seed }, { read: true });
      const w = res.words; const S = TL.sumWords(w, nThreads); const rays = Math.max(1, S.ok);
      const c = {}; PROF_NAMES.forEach((n, i) => { c[n] = w[16 + i]; });
      const per = {}; for (const [k, v] of Object.entries(c)) per[k] = +(v / rays).toFixed(3);
      const out = { cls: opts.cls ?? 'light', rays: S.ok, hitFrac: +(S.hit / rays).toFixed(4), totals: c, perRay: per, scene: TL.cur, points: TL.ptsInfo?.mode };
      out.answers = { global: +(c.ansGlobal / rays).toFixed(4), grid: +(c.ansGrid / rays).toFixed(4), caps: +(c.ansCaps / rays).toFixed(4), miss: +(c.ansMiss / rays).toFixed(4) };
      out.text = `profile ${closest ? 'traceClosest' : 'occluded'}/${out.cls}: ${(S.ok / 1e6).toFixed(2)} M rays, hit ${out.hitFrac} (global ${out.answers.global} · grid ${out.answers.grid} · caps ${out.answers.caps} · miss ${out.answers.miss})\n` +
        `  per ray: cells ${per.cells} (run-skipped ${per.cellRunSkip}, mask-rejected ${per.cellMaskRej}, list loaded ${per.cellList}, empty list ${per.cellEmptyList}) · items fetched ${per.items} (y-culled ${per.itemYCull}, owner-skipped ${per.itemOwner}) · slab tests ${per.slab} (yawed ${per.slabYaw}, rot ${per.slabRot}, hit ${per.slabHit}) · globals tested ${per.globTest} skipped ${per.globSkip} · capsule spheres ${per.capSphere} capsule tests ${per.capTest} · mean DDA iterations ${per.exitIterSum}`;
      return out;
    },
    async profileAll(opts = {}) { const rows = {}; for (const c of (opts.classes ?? ['ao', 'light', 'panel', 'sun', 'column', 'gather', 'random'])) rows[c] = await TL.profile({ ...opts, cls: c }); rows.text = Object.values(rows).map(r => r.text).join('\n'); return rows; },
    // ------------------------------------------------------------------ identity ------------------------------------------------------------------
    /** deterministic capture of scene `name` from a FRESH `?paused` boot (nothing else run first): → { hash, w, h } */
    async idHash(name = 'B1', opts = {}) {
      const { steps = 12, renders = 24 } = opts;
      Math.random = mulberry32(4242);
      window.__testVisible = true; window.__menu?.close();
      const sc = TL.SCENES[name]; if (!sc || sc.stress) throw new Error('idHash scenes: B1 B2 B3 B5');
      if (sc.daylight) window.__daylight(true);
      window.__stage(sc.pin, sc.stage); window.__perf.still();
      for (let i = 0; i < steps; i++) { window.__runFrames(1, 1 / 60); await TL.settle(); }
      window.__perf.still();
      TL.time = 100; await TL.render(renders);
      const fr = await window.__perf.readback();
      return { scene: name, hash: window.__perf.hash(fr), w: fr.w, h: fr.h, variant: window.__traceConfig.variant, preset: window.__quality?.current, res: [E().width, E().height] };
    },
    /** the same, for several scenes in one boot (each staged after the previous: fine for comparing boots that run the same list) */
    async idHashes(names = ['B1', 'B3', 'B2'], opts = {}) { const out = {}; for (const n of names) out[n] = (await TL.idHash(n, opts)).hash; out.variant = window.__traceConfig.variant; out.preset = window.__quality?.current; out.res = [E().width, E().height]; return out; },
    /** post the last readback as a PNG / a crop to this lane's shot server */
    png(name) { window.__shotPort = TL.shotPort; return window.__perf.png(name); },
    crop(name, x, y, w, h, scale = 3) { window.__shotPort = TL.shotPort; return window.__perf.crop(name, x, y, w, h, scale); },
  };
  /** after a navigation: hooks up, the pane given a size if it has none (a never-displayed pane keeps #view at 0×0 — an explicit CSS size makes the engine render at the preset's cap),
   *  the menu closed, GPU errors collected in window.__errs. Nothing is stepped or rendered here (idHash wants the first frame to be its own). */
  TL.boot = async (cssW = 1280, cssH = 720) => {
    await window.__ready;
    const v = document.getElementById('view');
    if (!(v.clientWidth > 0)) { v.style.width = cssW + 'px'; v.style.height = cssH + 'px'; document.body.style.minWidth = cssW + 'px'; document.body.style.minHeight = cssH + 'px'; TL.forcedSize = [cssW, cssH]; }
    for (let i = 0; i < 200 && !(v.clientWidth > 0); i++) await yieldTask();
    if (!window.__errs) { window.__errs = []; D().addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
    window.__testVisible = true; window.__shotPort = TL.shotPort; window.__menu?.close();
    return { view: [v.clientWidth, v.clientHeight], hidden: document.hidden, variant: window.__traceConfig?.variant, preset: window.__quality?.current };
  };
  /** POST a JSON result to this lane's shot server (docs/perf/<name>.json) */
  TL.save = async (name, obj) => { const r = await fetch(`http://localhost:${TL.shotPort}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj) }); return r.status; };
  /** THE SCENE MATRIX: for each preset, for each scene: stage → contention check → interleaved A/B of the named CONFIGS (each = { variant, strata }) → per-pass medians.
   *  Fire-and-forget: progress in TL.mx.status, results in TL.mx.results (also POSTed as docs/perf/trace-matrix-<preset>.json per preset). On main the two configs are the
   *  reference walk with iid / stratified gather directions (settings.gatherStrata); a traversal experiment adds { variant: N } rows once its V-suffixed walks exist. */
  TL.CONFIGS = {
    ref:      { variant: 0, strata: false, note: 'the reference walk, iid gather directions' },
    strata:   { variant: 0, strata: true, note: 'E8: tile-coherent stratified gather directions (settings.gatherStrata)' },
  };
  TL.applyConfig = async (name) => { const c = TL.CONFIGS[name]; if (!c) throw new Error('config ' + name); window.__gs.on = !!c.strata; if (window.__traceConfig.variant !== c.variant || TL.mxDirty) { await TL.use(c.variant); TL.mxDirty = false; } };
  TL.matrix = (opts = {}) => {
    const { presets = ['high'], scenes = ['B1', 'B3', 'B2', 'B5'], configs = ['ref', 'strata'], rounds = 3, n = 30, tag = '' } = opts;
    TL.mx = { status: 'starting', results: {}, log: [] };
    (async () => {
      for (const p of presets) {
        window.__quality.auto = false; window.__quality.apply(p); TL.mxDirty = true; await TL.render(6);
        TL.mx.results[p] = { res: [E().width, E().height], scenes: {} };
        for (const sc of scenes) {
          TL.mx.status = `${p} ${sc} staging`;
          try {
            const info = await TL.scene(sc);
            let aa = null; for (let i = 0; i < 8; i++) { TL.mx.status = `${p} ${sc} aa#${i}`; aa = await TL.aa({ rounds: 2, n: 20 }); if (aa.clean) break; }
            TL.mx.status = `${p} ${sc} ab`;
            const r = await TL.ab(TL.applyConfig, configs, { rounds, n, warm: 8 });
            const pick = (k) => (r.per[k] || []).map(x => x && x.med);
            TL.mx.results[p].scenes[sc] = { info, aa: aa && aa.aaPct, clean: aa && aa.clean, union: r.union.map(x => x && x.med), unionP25: r.union.map(x => x && x.p25), unionP75: r.union.map(x => x && x.p75), direct: pick('direct'), gather: pick('gather'), rcSum: pick('rcSum'), froxel: pick('volFroxel'), reflect: pick('reflect'), particles: pick('particles'), text: r.text };
            TL.mx.log.push(`${p} ${sc}: union ${r.union.map(x => x && x.med.toFixed(2)).join(' / ')} (aa ${aa && aa.aaPct} %)`);
          } catch (e) { TL.mx.results[p].scenes[sc] = { error: String(e.message || e).slice(0, 300) }; TL.mx.log.push(`${p} ${sc}: ERROR ${String(e.message || e).slice(0, 120)}`); }
          await TL.save(`trace-matrix${tag ? '-' + tag : ''}-${p}`, { preset: p, configs, configNotes: configs.map(c => TL.CONFIGS[c]), rounds, n, ...TL.mx.results[p] }).catch(() => {});
        }
      }
      await TL.applyConfig('ref');
      TL.mx.status = 'done';
    })().catch(e => { TL.mx.status = 'error: ' + String(e.stack || e).slice(0, 400); });
    return 'matrix started: poll __tl.mx.status / __tl.mx.log';
  };
  window.__tl = TL; readyRes(TL);
  return 'trace lab ready: __tl.{boot,scene,frames,ab,aa,use,abVariants,points,bench,benchAll,exact,exactAll,profile,profileAll,idHash,idHashes}';
})();
