// CUT BOXES — what they cost, measured in the page (scene/cut.ts; the contract: docs/internal/cut-boxes-contract.md; the numbers: docs/internal/cut-cost.md).
//   boot  http://localhost:5173/?paused&mute&quality=high&cutboxes      then in the console (cut pieces are on in the page by default; ?nocutboxes = the boxes as before):
//   await import('/qa/cut-cost.js'); await __cc.run()
// run() stages each case from the same seeded restart, times SERIALIZED frames (each awaited through onSubmittedWorkDone, so nothing overlaps and the timer resolves) in
// interleaved A/B rounds, and prints ONE table: per case and config the GPU union of the compute passes (engine.timer.unionMs — CLAUDE.md 'GPU timing'), the wall ms per
// frame (which also holds the raster, whose timestamps mean nothing on Metal) and the passes that trace. Configs:
//   cut      the case as the build stands it: pieces drawn cut and met cut by every ray
//   plain    the SAME pieces with their cut record taken off (Box.cut = undefined: each is its whole fitted box) — same count, same places: the difference is the cut alone
//   none     no test pieces at all (the synthetic pool only): what the pieces themselves cost, cut or not
//   ship     (the calm case, a build with the two program sets — render/cutSwap.ts, the default) the frame as it SHIPS: with nothing cut alive it dispatches the boot's
//            programs, which have no cut rule — its row against `offText` is the claim 'a calm room pays nothing' (Δ 0 by construction: the same programs);
//            `cut` there PINS the set with the rule (what a room pays while a piece is alive, and what every frame paid before the swap)
//   offText  the tracing pipelines with CUT_BOXES false (pinned under the two-set build; recompiled through __hotCommon under ?cutprograms=boot; the calm case only) — the price of the branch in the ray test when no box is cut.
//            (the g-buffer, the probe, composite's side ray keep the boot's text: a build booted with ?nocutboxes is the whole truth — run() there prints the same table
//            with `plain` only, and tools/qa/cut-cost-run.cjs alternates two such pages frame by frame)
//   gate     (opt-in: run({ gate: true }), the calm case) the tracing pipelines recompiled with the per-box bit test put BEHIND a frame-level word that is always 0
//            (frame.flags bit 31): if the calm cost stays, a per-frame 'any cut box' gate is shown to buy nothing where this runs. A test text, never shipped.
// Also here, hardware-independent: counts() (boxes, cut boxes, planes, vertices drawn, cut-table bytes uploaded a frame) and census() — a CPU walk of the frame's ray
// classes (camera rays, shadow rays to every light in reach, cosine gather rays) counting how many reach a cut test and how many planes those tests read.
// Cases: calm (nothing broken) · pool (64 __cut.test pieces, the debris cap at high) · worst (the pool + 260 small fragments + 40 edge plates, every one cut: 364 records) · blast / glass (the real emitters, when the build has them: game/breakTable.ts,
// game/shards.ts). Nothing here touches Math.random beyond seeding it; the pieces' places come from a hash.
(() => {
  const E = () => window.__engine, G = () => window.__game, C = () => window.__cut, DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const sorted = a => [...a].filter(Number.isFinite).sort((x, y) => x - y);
  const q = (a, p) => { const b = sorted(a); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
  const med = a => q(a, 0.5);
  const hash01 = n => { let x = (n | 0) * 0x9E3779B1; x ^= x >>> 16; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'present'];   // render passes: their stamps span the drawable wait on Metal (never in the union)
  const TRACERS = ['direct', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'rc', 'probe', 'volFroxel', 'volumetrics', 'particles'];
  const cutOn = () => !!(C() && C().on);

  // ---- views + staging --------------------------------------------------------------------------------------------------------------------------------------------
  const VIEWS = {
    calm:  { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 },     // the cubicles' still (the P0–P3 identity view): nothing broken
    pool:  { look: [19.8, 0, 14.6], yaw: -20 * DEG, pitch: 50 * DEG, dist: 7 },    // the middle aisle from 7 m: 64 pieces on a 2.6 m disc
    blast: { look: [19.8, 0, 14.6], yaw: -20 * DEG, pitch: 50 * DEG, dist: 7 },    // (replaced by the emitters' own pins below when they exist)
    glass: { look: [7, 0, 20.5], yaw: 90 * DEG, pitch: 40 * DEG, dist: 7 },
  };
  let seeded = false, T = 0;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const OPT = { smoke: true };   // smoke: false = the solver held off for the whole run (a software adapter cannot build it, and the blast's dust would open a domain)
  /** the clean slate every case starts from: seeded restart, guards parked, the player out of the picture, the camera pinned */
  function slate(view) {
    window.__pauseLoop = true; window.__testVisible = true; window.__menu?.close(); seed();
    restore(); hidden = null; C()?.clear();
    G().restartEncounter();
    if (!OPT.smoke) { try { window.__smoke.params.enabled = false; } catch { /* no solver */ } }
    const r = window.__stage(VIEWS[view] ?? view, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
    for (const gd of G().guards) { gd.flashlight.enabled = false; gd.lightDeadUntil = 1e9; }
    T = G().time;
    return r;
  }
  /** the synthetic pool: n test pieces on a disc — lumps (8 planes), wedges (1), shards (3), snapped planks (2) in rubble-like shares, or all lumps = the worst record */
  function poolPieces(n = 64, at = VIEWS.pool.look, mix = 'mixed', radius = 2.6) {
    const kinds = mix === 'lumps' ? ['lump'] : ['lump', 'wedge', 'lump', 'shard', 'lump', 'snap', 'lump', 'shard', 'wedge', 'lump'];
    for (let i = 0; i < n; i++) {
      const a = hash01(i * 3 + 1) * Math.PI * 2, r = radius * Math.sqrt(hash01(i * 3 + 2));
      const g = 0.45 + 0.25 * hash01(i * 5 + 9);
      C().test([at[0] + r * Math.cos(a), 0, at[2] + r * Math.sin(a)], kinds[i % kinds.length], { yaw: hash01(i * 3 + 3) * Math.PI * 2, scale: 0.6 + 0.8 * hash01(i * 7 + 5), albedo: [g + 0.08, g + 0.05, g] });
    }
  }
  /** the WORST the contract allows a blast to leave (no cap below the world's boxes): the full pool + ~260 small look fragments + ~40 edge plates, every one carrying
   *  a record and every one met by rays — 364 cut boxes. Fragments: fist-sized, 1–3 planes, strewn over a 3.6 m disc; plates: two rows standing along a 6 m line. */
  function worstPieces(at = VIEWS.pool.look, nSmall = 260, nPlates = 40) {
    poolPieces(64, at, 'mixed', 2.6);
    const small = ['wedge', 'shard', 'snap', 'shard', 'wedge'];
    for (let i = 0; i < nSmall; i++) {
      const a = hash01(7000 + i * 3) * Math.PI * 2, r = 3.6 * Math.sqrt(hash01(7001 + i * 3)), g = 0.5 + 0.3 * hash01(7002 + i * 3);
      C().test([at[0] + r * Math.cos(a), 0, at[2] + r * Math.sin(a)], small[i % small.length], { yaw: hash01(9000 + i) * Math.PI * 2, scale: 0.14 + 0.2 * hash01(9500 + i), albedo: [g, g, g - 0.03] });
    }
    const per = Math.max(1, nPlates >> 1);
    for (let i = 0; i < nPlates; i++) {
      const k = i % per, row = (i / per) | 0;
      C().test([at[0] - 3 + 6 * (k + 0.5) / per, row * 1.15, at[2] - 2.3], i % 2 ? 'lump' : 'shard', { yaw: (hash01(9900 + i) - 0.5) * 0.5, scale: 0.9, albedo: [0.7, 0.68, 0.64] });
    }
  }
  // the real emitters' recipes (set by cut-cost-emitters.js when the build carries them; each: (game, engine) → counts, stepping game.update itself)
  const EMIT = window.__ccEmit || (window.__ccEmit = {}); const STAGED = {};
  /** the real emitters' recipes (tools/qa/cut-cost-recipes.js), registered when this build carries the break table's hooks on the debris pool; the glass case wants the
   *  page booted with ?glassbreak too (the holes are a boot-time shader const: without it the plates lie under panes still drawn whole) */
  async function emitters() {
    try { if (!('breaks' in G().destr.debris)) return 'this build has no cut emitters: calm + pool only'; } catch { return 'no destruction here'; }
    if (!EMIT.blast) { const R = await import('/qa/cut-cost-recipes.js'); EMIT.blast = { pin: R.PINS.blast, stage: (g, e) => R.stageBlast(g, e) }; EMIT.glass = { pin: R.PINS.glass, stage: (g, e) => R.stageGlass(g, e) }; window.__ccRecipes = R; }
    return 'blast, glass';
  }
  /** stage one case; returns what stands */
  async function stage(name, opts = {}) {
    if (name === 'calm') { slate('calm'); }
    else if (name === 'pool') { slate(opts.view ?? 'pool'); poolPieces(opts.n ?? 64, (VIEWS[opts.view ?? 'pool']).look, opts.mix ?? 'mixed', opts.radius ?? 2.6); }
    else if (name === 'worst') { slate('pool'); worstPieces(VIEWS.pool.look, opts.small ?? 260, opts.plates ?? 40); }
    else if (EMIT[name]) { if (EMIT[name].pin) VIEWS[name] = EMIT[name].pin; slate(name); const r = await EMIT[name].stage(G(), E()); window.__stage(VIEWS[name], {}); if (r) { STAGED[name] = r; console.log('cut-cost stage ' + name, JSON.stringify(r)); } }
    else throw new Error(`cut-cost: no case '${name}' in this build (calm, pool, worst${Object.keys(EMIT).map(k => ', ' + k).join('')})`);
    window.__runFrames(1, 1 / 60); await settle();   // one game frame: the pieces enter the frame's dynamics, the world is packed
    T = G().time;
    return counts();
  }
  async function settle() { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); }

  // ---- the cut on / off the SAME pieces ---------------------------------------------------------------------------------------------------------------------------
  let saved = null;
  /** take the cut record off every box the world lists (each then is its whole box); restore() puts the very arrays back */
  function strip() { if (saved) return 0; saved = new Map(); for (const b of E().world.all) if (b.cut !== undefined && b.cut.length > 0) { saved.set(b, b.cut); b.cut = undefined; } return saved.size; }
  function restore() { if (!saved) return 0; const n = saved.size; for (const [b, c] of saved) b.cut = c; saved = null; return n; }
  /** hide / show the synthetic pool's pieces (config 'none') */
  let hidden = null;
  async function hidePool(on) {
    const fx = G().fx;
    if (on && !hidden) { hidden = []; for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl > 1e11) hidden.push(fx.splice(i, 1)[0]); window.__runFrames(1, 1 / 60); await settle(); }
    else if (!on && hidden) { for (const m of hidden.reverse()) fx.push(m); hidden = null; window.__runFrames(1, 1 / 60); await settle(); }
  }
  /** the tracing pipelines recompiled with CUT_BOXES true / false (needs the dev server: __hotCommon fetches the shader text) */
  let textMode = null;   // 'on' | 'off' | 'gate'
  /** common.wgsl with the cut hook behind a frame word that is never set (the 'gate' config) */
  async function gatedCommon() {
    const src = await (await fetch('/qa/shader/common.wgsl', { cache: 'no-store' })).text();
    const a = 'if (CUT_BOXES) { if ((b.flags & GEO_CUT) != 0u) {', b = 'if (CUT_BOXES) { if ((frame.flags & 2147483648u) != 0u && (b.flags & GEO_CUT) != 0u) {';
    if (src.split(a).length !== 2) throw new Error('cut-cost: the cut hook in common.wgsl is not where the gate test expects it');
    return src.replace(a, b);
  }
  async function text(mode) {
    if (mode === true) mode = 'on'; else if (mode === false) mode = 'off';
    if (!cutOn()) return 'this build was booted without the switch: its text is the off text';
    const P = C().programs;
    if (P && P.swap) {   // A CALM ROOM PAYS NOTHING (render/cutSwap.ts): this build holds BOTH sets of the tracing programs — pin one (or, 'ship', leave the frame's own rule: the cut set only while a cut piece a ray can meet is alive)
      if (mode === 'gate') throw new Error("cut-cost: the 'gate' text is a test of the one-set build — boot with ?cutprograms=boot for it");
      if (!(await P.ready)) console.error('cut-cost: the second set of programs did not compile — every config below runs the boot programs', P.info);
      P.force = mode === 'on' ? 'cut' : mode === 'off' ? 'base' : null; textMode = mode; await settle();
      return mode;
    }
    if (mode === 'ship') mode = 'on';   // (the one-set build ships its boot text: the rule in every ray program)
    if (textMode === null) textMode = 'on';
    if (textMode === mode) return mode;
    const cfg = C().mod.cutConfig; const t0 = performance.now(); const swapWas = cfg.swap; cfg.swap = false;
    cfg.on = mode !== 'off'; let r; try { r = await window.__hotCommon(mode === 'gate' ? await gatedCommon() : ''); } finally { cfg.on = true; cfg.swap = swapWas; }   // (the CPU keeps the boot's switch: only the prelude built inside the swap reads the other value)
    textMode = mode; await settle();
    if (r && !r.ok) console.error('cut-cost: the hot swap failed', JSON.stringify(r.failed));
    const msg = `${mode} text in ${(performance.now() - t0).toFixed(0)} ms${r && !r.ok ? ' — FAILED' : ''}`; console.log('cut-cost   ' + msg);
    return msg;
  }
  const CONFIG = {
    ship:    async () => { await hidePool(false); restore(); await text('ship'); },
    cut:     async () => { await hidePool(false); restore(); await text(true); },
    plain:   async () => { await hidePool(false); strip(); await text(true); },
    none:    async () => { restore(); await hidePool(true); await text(true); },
    offText: async () => { await hidePool(false); restore(); await text(false); },
    gate:    async () => { await hidePool(false); restore(); await text('gate'); },
  };

  // ---- timing -------------------------------------------------------------------------------------------------------------------------------------------------------
  /** one serialized offscreen render of the staged scene (no game step): { wall, union, sum, passes } in ms */
  async function frame1() {
    const e = E(), t = e.timer; const before = t.resolved; const w0 = performance.now();
    e.render(window.__cam, T, 1 / 60, false); T += 1 / 60;
    await e.device.queue.onSubmittedWorkDone(); const wall = performance.now() - w0;
    await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.enabled && t.resolved === before; k++) await yieldTask();
    const passes = {}; let sum = 0; const ok = t.enabled && t.resolved !== before;
    if (ok) for (const [k, v] of t.lastFrame) { passes[k] = v; if (!RP.includes(k)) sum += v; }
    return { wall, union: ok ? t.unionMs(RP) : NaN, sum: ok ? sum : NaN, passes };
  }
  /** `n` timed frames of a config after `warm` untimed ones (the histories re-converge on the changed shapes) */
  async function sample(config, n = 8, warm = 3) {
    if (!CONFIG[config]) throw new Error('cut-cost: no config ' + config);
    await CONFIG[config]();
    for (let i = 0; i < warm; i++) await frame1();
    const rows = []; for (let i = 0; i < n; i++) rows.push(await frame1());
    return rows;
  }
  function summarise(rows) {
    const o = { n: rows.length, union: +med(rows.map(r => r.union)).toFixed(3), unionLo: +q(rows.map(r => r.union), 0.25).toFixed(3), unionHi: +q(rows.map(r => r.union), 0.75).toFixed(3),
      wall: +med(rows.map(r => r.wall)).toFixed(3), wallLo: +q(rows.map(r => r.wall), 0.25).toFixed(3), wallHi: +q(rows.map(r => r.wall), 0.75).toFixed(3), sum: +med(rows.map(r => r.sum)).toFixed(3), passes: {} };
    const names = new Set(); for (const r of rows) for (const k of Object.keys(r.passes)) names.add(k);
    for (const k of names) o.passes[k] = +med(rows.map(r => r.passes[k] ?? 0)).toFixed(3);
    return o;
  }
  /** interleaved rounds over `configs` on the staged scene: A B · B A · A B … */
  async function ab(configs, { rounds = 2, n = 8, warm = 3 } = {}) {
    const acc = {}; for (const c of configs) acc[c] = [];
    for (let r = 0; r < rounds; r++) for (const c of (r % 2 ? [...configs].reverse() : configs)) { const rows = await sample(c, n, warm); acc[c].push(...rows); console.log(`cut-cost   round ${r} ${c}: wall ${rows.map(x => x.wall.toFixed(1)).join(' ')} · union ${rows.map(x => Number.isFinite(x.union) ? x.union.toFixed(2) : '-').join(' ')}`); }
    await CONFIG[configs.includes('cut') ? 'cut' : configs[0]]();
    const out = {}; for (const c of configs) out[c] = summarise(acc[c]);
    return out;
  }

  // ---- hardware-independent counts ----------------------------------------------------------------------------------------------------------------------------------
  /** what the last upload listed: boxes, cut boxes and planes (statics / dynamics), the planes-per-box histogram, vertices the g-buffer draws, cut-table bytes a frame */
  function counts() {
    const w = E().world, all = w.all, nS = w.statics.length; const hist = new Array(9).fill(0);
    let cutS = 0, cutD = 0, planes = 0, lo = 1 << 30, hi = -1;
    for (let i = 0; i < all.length; i++) { const c = all[i].cut; if (c === undefined || c.length === 0) continue; const k = Math.min(8, c.length); hist[k]++; planes += k; if (i < nS) cutS++; else { cutD++; if (i < lo) lo = i; if (i > hi) hi = i; } }
    const drawnCut = w.visibleCutCount | 0, drawnPlain = w.visibleCount | 0;
    return { on: cutOn(), boxes: all.length, statics: nS, dynamics: all.length - nS, cutStatics: cutS, cutDynamics: cutD, planes, planesHist: hist.slice(1).join(' '),
      drawnPlain, drawnCut, vertices: drawnPlain * 36 + drawnCut * 84, verticesIfPlain: (drawnPlain + drawnCut) * 36,
      cutBytesPerFrame: cutOn() && hi >= lo ? (hi - lo + 1) * (C().mod.CUT_STRIDE ?? 8) * 16 : 0,   // the dynamics' index range of the cut table, re-sent every frame (BoxWorld.upload); statics only when re-cut
      debris: (() => { try { return G().destr.debris.list.length; } catch { return null; } })(), debrisCap: E().settings.debrisCap };
  }
  // the uncut slab of box b against ro + t·rd over [0, tmax] (rayBoxCut's frame change): true = a GPU ray on this line reaches the cut loop of a cut box
  function slabHit(b, ro, rd, tmax) {
    const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2]; let ox, oy, oz, dx, dy, dz;
    if (b.rot) {
      const R = b.rot, qx = -R[0], qy = -R[1], qz = -R[2], qw = R[3];
      let tx = 2 * (qy * pz - qz * py), ty = 2 * (qz * px - qx * pz), tz = 2 * (qx * py - qy * px);
      ox = px + qw * tx + (qy * tz - qz * ty); oy = py + qw * ty + (qz * tx - qx * tz); oz = pz + qw * tz + (qx * ty - qy * tx);
      const vx = rd[0], vy = rd[1], vz = rd[2];
      tx = 2 * (qy * vz - qz * vy); ty = 2 * (qz * vx - qx * vz); tz = 2 * (qx * vy - qy * vx);
      dx = vx + qw * tx + (qy * tz - qz * ty); dy = vy + qw * ty + (qz * tx - qx * tz); dz = vz + qw * tz + (qx * ty - qy * tx);
    } else { const cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0); ox = cs * px - sn * pz; oy = py; oz = sn * px + cs * pz; dx = cs * rd[0] - sn * rd[2]; dy = rd[1]; dz = sn * rd[0] + cs * rd[2]; }
    let t0 = 0, t1 = tmax; const h = b.h;
    { const inv = 1 / (dx || 1e-20); let a = (-h[0] - ox) * inv, c = (h[0] - ox) * inv; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false; }
    { const inv = 1 / (dy || 1e-20); let a = (-h[1] - oy) * inv, c = (h[1] - oy) * inv; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false; }
    { const inv = 1 / (dz || 1e-20); let a = (-h[2] - oz) * inv, c = (h[2] - oz) * inv; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false; }
    return true;
  }
  /** THE RAY CENSUS (CPU; the staged scene's own boxes, camera and lights): for a grid of screen pixels the camera ray, a shadow segment to every enabled light in reach
   *  of the point it shows (weighted as the direct pass draws them: ∝ intensity · N·L ∕ d²) and `gather` cosine rays off it — how many of each cross the UNCUT slab of a
   *  cut box (= reach isectCut: the only place a ray pays) and how many planes those tests read. An upper estimate for shadow rays (an any-hit walk may stop first; a
   *  closest-hit walk prunes by its best t, used here). Needs the cut records ON the boxes: call it in config 'cut'. */
  function census({ step = 8, gather = 4, far = 40 } = {}) {
    const e = E(), w = e.world, cam = window.__cam, all = w.all; const cv = document.getElementById('view'); const W = cv.clientWidth, H = cv.clientHeight;
    const cuts = [], drawn = [];   // cuts: the cut boxes a RAY can meet (not NoShadow — a glass plate on the floor is NoShadow: drawn cut, met by no ray); drawn: the ones the raster draws
    for (let i = 0; i < all.length; i++) { const b = all[i]; if (b.cut === undefined || b.cut.length === 0) continue; if (!(b.flags & 2)) cuts.push(b); if (!(b.flags & 1)) drawn.push(b); }
    const lights = e.lights.lights.filter(l => l.enabled && l.intensity > 0);
    const reach = (ro, rd, tmax, list = cuts) => { let tests = 0, planes = 0; for (const b of list) if (slabHit(b, ro, rd, tmax)) { tests++; planes += Math.min(8, b.cut.length); } return [tests, planes]; };
    const R = { pixels: 0, sky: 0, showCut: 0, primary: { rays: 0, tests: 0, planes: 0, touched: 0 }, shadow: { rays: 0, w: 0, tests: 0, planes: 0, touched: 0 }, gather: { rays: 0, tests: 0, planes: 0, touched: 0 } };
    let serial = 1;
    for (let y = step >> 1; y < H; y += step) for (let x = step >> 1; x < W; x += step) {
      const { ro, rd } = cam.ray((x + 0.5) / W, (y + 0.5) / H); R.pixels++;
      const hit = w.raycast(ro, rd, 200, 1, 0, true);   // (what the raster shows: NoPrimary skipped, NoShadow pieces seen — a blown wall's look pieces with them: withLook)
      { const [t, p] = reach(ro, rd, hit ? hit.t + 1e-3 : 200, drawn); R.primary.rays++; R.primary.tests += t; R.primary.planes += p; if (t) R.primary.touched++; }
      if (!hit) { R.sky++; continue; }
      const hb = all[hit.index]; if (hb && hb.cut !== undefined && hb.cut.length > 0) R.showCut++;
      const n = hit.n, P = [ro[0] + rd[0] * hit.t + n[0] * 0.02, ro[1] + rd[1] * hit.t + n[1] * 0.02, ro[2] + rd[2] * hit.t + n[2] * 0.02];
      for (const L of lights) {
        let d, dist;
        if (L.kind === 2) { d = [-L.dir[0], -L.dir[1], -L.dir[2]]; dist = 60; }
        else { const v = [L.pos[0] - P[0], L.pos[1] - P[1], L.pos[2] - P[2]]; dist = Math.hypot(v[0], v[1], v[2]); if (dist > L.range || dist < 1e-3) continue; d = [v[0] / dist, v[1] / dist, v[2] / dist]; }
        const nl = n[0] * d[0] + n[1] * d[1] + n[2] * d[2]; if (nl <= 0) continue;
        const wgt = L.kind === 2 ? L.intensity * nl : L.intensity * nl / Math.max(dist * dist, 0.05);
        const [t, p] = reach(P, d, dist); R.shadow.rays++; R.shadow.w += wgt; R.shadow.tests += t * wgt; R.shadow.planes += p * wgt; if (t) R.shadow.touched += wgt;
      }
      // cosine rays about n
      const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let tx = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]]; const tl = Math.hypot(tx[0], tx[1], tx[2]); tx = [tx[0] / tl, tx[1] / tl, tx[2] / tl];
      const bt = [n[1] * tx[2] - n[2] * tx[1], n[2] * tx[0] - n[0] * tx[2], n[0] * tx[1] - n[1] * tx[0]];
      for (let k = 0; k < gather; k++) {
        const u1 = hash01(serial++), u2 = hash01(serial++), r = Math.sqrt(u1), ph = u2 * Math.PI * 2, lx = r * Math.cos(ph), lz = r * Math.sin(ph), ly = Math.sqrt(Math.max(0, 1 - u1));
        const d = [tx[0] * lx + n[0] * ly + bt[0] * lz, tx[1] * lx + n[1] * ly + bt[1] * lz, tx[2] * lx + n[2] * ly + bt[2] * lz];
        const gh = w.raycast(P, d, far, undefined, 0, true); const [t, p] = reach(P, d, gh ? gh.t + 1e-3 : far);
        R.gather.rays++; R.gather.tests += t; R.gather.planes += p; if (t) R.gather.touched++;
      }
    }
    const per = (c, den) => ({ rays: c.rays, share: +(c.touched / den).toFixed(4), testsPerRay: +(c.tests / den).toFixed(4), planesPerRay: +(c.planes / den).toFixed(4) });
    return { cutBoxes: cuts.length, cutDrawn: drawn.length, lights: lights.length, pixels: R.pixels, showCutShare: +(R.showCut / R.pixels).toFixed(4),
      primary: per(R.primary, R.primary.rays), shadow: per(R.shadow, R.shadow.w || 1), gather: per(R.gather, R.gather.rays || 1) };
  }

  // ---- the one-minute run ---------------------------------------------------------------------------------------------------------------------------------------------
  const fmt = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—';
  /** stage each case, time it, print one table. opts: { cases, rounds, n, warm, swap (the calm case's offText config: default on with the switch), smoke, census } */
  async function run(opts = {}) {
    const { rounds = 4, n = 30, warm = 8, swap = cutOn(), doCensus = true } = opts; if (opts.smoke !== undefined) OPT.smoke = !!opts.smoke;
    await emitters(); const avail = ['calm', 'pool', 'worst', ...Object.keys(EMIT)]; const cases = opts.cases ?? avail;
    const e = E(); const t0 = performance.now(); const out = { when: new Date().toISOString(), on: cutOn(), adapter: e.gpu?.adapterInfo ?? null, preset: window.__quality?.current ?? null, res: `${e.width}×${e.height} → ${e.outWidth ?? e.width}×${e.outHeight ?? e.height}`, timer: !!e.timer.enabled, rounds, n, warm, cases: {} };
    const rows = [];
    for (const name of cases) {
      const c0 = await stage(name, opts[name] ?? {}); console.log(`cut-cost ${name}: staged, ${c0.cutStatics + c0.cutDynamics} cut boxes, ${c0.planes} planes, ${c0.dynamics} dynamic boxes`); const configs = !cutOn() ? ['plain'] : name === 'calm' ? (swap ? (C().programs?.swap ? ['ship', 'cut', 'offText'] : opts.gate ? ['cut', 'offText', 'gate'] : ['cut', 'offText']) : ['cut']) : name === 'pool' || name === 'worst' ? ['cut', 'plain', 'none'] : ['cut', 'plain'];
      const cen = doCensus && cutOn() && name !== 'calm' ? census(opts.census ?? {}) : null;
      const r = await ab(configs, { rounds, n, warm });
      out.cases[name] = { counts: c0, staged: STAGED[name] ?? null, census: cen, configs: r };
      const base = r.plain ?? r.offText ?? null;
      for (const cfg of configs) { const s = r[cfg];
        rows.push({ case: name, config: cfg, 'cut boxes': cfg === 'cut' ? c0.cutStatics + c0.cutDynamics : 0, planes: cfg === 'cut' ? c0.planes : 0, 'union ms': fmt(s.union), 'IQR': `${fmt(s.unionLo)}–${fmt(s.unionHi)}`, 'wall ms': fmt(s.wall),
          'Δ union vs plain/off': base && s !== base ? `${s.union - base.union >= 0 ? '+' : ''}${fmt(s.union - base.union)} (${fmt((s.union / base.union - 1) * 100, 1)} %)` : '', 'Δ wall': base && s !== base ? `${s.wall - base.wall >= 0 ? '+' : ''}${fmt(s.wall - base.wall)}` : '',
          direct: fmt(s.passes.direct), gather: fmt(s.passes.gather), reflect: fmt(s.passes.reflect), rc: fmt(Object.entries(s.passes).filter(([k]) => /^rc/.test(k)).reduce((a, [, v]) => a + v, 0)), gbuffer: fmt(s.passes.gbuffer) });
      }
    }
    await text(C()?.programs?.swap ? 'ship' : true); restore(); await hidePool(false); C()?.clear();
    out.secs = +((performance.now() - t0) / 1000).toFixed(1); out.res = `${e.width}×${e.height} → ${e.outWidth ?? e.width}×${e.outHeight ?? e.height}`;
    out.table = rows; window.__ccLast = out;
    console.log(`cut-cost · switch ${out.on ? 'ON' : 'off'} · ${out.preset} ${out.res} · ${out.adapter ?? ''} · ${out.secs} s`);
    console.table(rows);
    for (const [k, c] of Object.entries(out.cases)) if (c.census) console.log(`census ${k}: ${c.census.cutDrawn} cut boxes drawn (${c.census.cutBoxes} a ray can meet) · ${(c.census.showCutShare * 100).toFixed(1)} % of pixels show one, ${(c.census.primary.share * 100).toFixed(1)} % lie inside one's uncut bounds · rays reaching a cut test — shadow ${(c.census.shadow.share * 100).toFixed(1)} %, gather ${(c.census.gather.share * 100).toFixed(1)} % (planes read per ray ${c.census.primary.planesPerRay} / ${c.census.shadow.planesPerRay} / ${c.census.gather.planesPerRay})`);
    return out;
  }

  window.__cc = { VIEWS, OPT, EMIT, STAGED, emitters, stage, slate, poolPieces, strip, restore, hidePool, text, CONFIG, frame1, sample, summarise, ab, counts, census, run, med, q, get on() { return cutOn(); } };
  return 'cut-cost ready: await __cc.run()  ·  __cc.{stage, ab, sample, counts, census}';
})();
