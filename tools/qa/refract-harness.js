// GLASS REFRACTION (settings.glassRefract, composite.wgsl glassRefractPath) — the pane-side instrument. Dev only: `await import('/qa/refract-harness.js')`
// on a `?paused&quality=<preset>&mute` page (pulls in perf-harness.js) → window.__rf.
//   VIEWS / go(name)        the graded views, staged deterministically (guards parked dark, Sam invisible, phases zeroed, grain off) and settled
//   shot(name) / tiles(v,p) whole frame + the ×4 crops of a view's points of interest → this lane's shot sink (window.__shotPort, 5251 here)
//   ab(view, prefix)        refraction off / on stills of one view: <prefix>_<view>_{off,on}[_<tile>].jpg + the lossless pair's diff numbers
//   cost(view)              interleaved off/on serialized medians: union, Σ compute, compS / composite (the pass the work lands in)
//   identity(views)         FNV hashes of the deterministic stills (main / OFF / ON comparisons: run the same call on each build)
//   validate()              an error scope across presets × sharp on/off × GBAA on/off × debug views with refraction flipped under each
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  window.__testVisible = true;
  window.__shotPort = window.__shotPort || 5251;   // this lane's capture sink (tools/shot-server.ts PORT=5251 in the refract worktree) — never the default :5174, which lands in the main checkout
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  // The graded views. tiles: [name, x, y, w, h] in OUTPUT pixels of a 1777×1000 frame (scaled to the actual output by tiles()). guards: staged torches.
  // (camera.ts: the eye sits at look + (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch) · dist — yaw 0 = from +z looking north-to-south, 90° = from +x looking west)
  const TORCH = [{ i: 0, pos: [25.4, 0, 21.4], yaw: 0.81, torch: true, aimPitch: -0.12, aim: [27.5, 1.15, 23.4] }];   // Kowalski's torch held ON the bottle from the SW (aim: he is made 'suspicious' of that point and holds his light on it — a patrolling man's torch pools on the floor whatever pitch he is staged with)
  const VIEWS = {
    // the water-cooler bottle (the one SOLID glass box: 30 × 40 × 30 cm at (27.5, 1.2, 23.4)) close from the NE: the cabinet's lit top edge and the wall corner pass behind it
    bottle:    { pin: { look: [27.45, 0.95, 23.3], yaw: 200 * DEG, pitch: 42 * DEG, dist: 2.6 }, tiles: [['bottle', 690, 60, 380, 470]], guards: TORCH, groups: ['cubicles'] },
    // the same bottle steeper and nearer from the SE: the cabinet top and the lit floor beyond it through the glass
    bottleTop: { pin: { look: [27.45, 1.0, 23.3], yaw: 155 * DEG, pitch: 58 * DEG, dist: 2.3 }, tiles: [['bottle', 660, 160, 420, 460]], guards: TORCH, groups: ['cubicles'] },
    // the conference partition's east panes (x 10.2‥13.5 at z 10) at a graze from the corridor (incidence ≈ 70°), the room lit: mullions and pane edges over its floor and table
    confGraze: { pin: { look: [9.4, 0.6, 9.4], yaw: 72 * DEG, pitch: 16 * DEG, dist: 5.0 }, tiles: [['paneEdge', 760, 420, 360, 300], ['farPane', 330, 300, 320, 280]], groups: ['conference', 'corridor'] },
    // the same glazing square-on from the corridor's far wall (the panes fill the view: the cost case), the room lit
    confFill:  { pin: { look: [11.85, 1.3, 9.0], yaw: 0 * DEG, pitch: 9.5 * DEG, dist: 3.05 }, tiles: [['mullion', 180, 480, 320, 320], ['chair', 720, 600, 320, 300]], groups: ['conference', 'corridor'] },
    // the lobby frontage from inside by moonlight, looking west and down at the sill and the four panes over the lot
    lobby:     { pin: { look: [4.5, 0.6, 20.2], yaw: 90 * DEG, pitch: 22 * DEG, dist: 5.5 }, tiles: [['frontage', 700, 330, 360, 300], ['sill', 1100, 520, 320, 260]] },
    // the frontage filling the view, square-on and low from x 7 (the other cost case)
    lobbyFill: { pin: { look: [3.0, 1.3, 20.0], yaw: 90 * DEG, pitch: 5.7 * DEG, dist: 4.0 }, tiles: [['mullion', 800, 380, 320, 300]] },
    // the P0–P3 still with no glass on screen (identity / whole-frame cost reference)
    cubicles:  { pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, tiles: [['desk', 760, 380, 320, 240]] },
  };

  let seeded = false; let lit0 = null; let s0 = 4242;
  function seed(again = false) { if (seeded && !again) return; seeded = true; s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  async function go(name, settle = 40, extra = {}) {
    const v = typeof name === 'string' ? VIEWS[name] : name; if (!v) throw new Error('no view ' + name);
    window.__menu?.close(); seed();
    if (!lit0) lit0 = G().targets.map(t => t.on);   // the level's night state of every fixture, taken once: each view starts from it and lights only its own groups (a view never inherits the last one's panels)
    G().targets.forEach((t, i) => { t.on = lit0[i]; });
    for (const g of v.groups ?? []) G().setGroup(g, true);
    window.__stage(v.pin, { park: true, guards: v.guards ?? [], player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true }, ...extra });
    for (const sg of v.guards ?? []) if (sg.aim) { const gd = G().guards[sg.i]; if (gd) { gd.state = 'suspicious'; gd.awareness = 0.5; gd.reactT = 0; gd.searchT = 0; gd.hold = true; gd.lastKnown = [sg.aim[0], sg.aim[1] - 1.0, sg.aim[2]]; } }   // (guards.ts: a held suspicious man watches lastKnown + 1 m from where he stands)
    __perf.still();
    await __perf.step(4);
    await __perf.render(settle);
    return `${typeof name === 'string' ? name : 'view'} staged, ${settle} settled renders at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  async function shot(name, q = 0.9) { return window.__shot(name, q); }
  /** the view's tiles as ×k crops of the last readback: <prefix>_<tile>.jpg */
  async function tiles(view, prefix, k = 4, fr = null) {
    const v = VIEWS[view]; fr = fr ?? await __perf.readback(); const sx = fr.w / 1777, sy = fr.h / 1000; const out = [];
    for (const [tn, x, y, w, h] of v.tiles) out.push(await __perf.crop(`${prefix}_${tn}`, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy), k, 0.92, fr));
    return out;
  }
  /** one named crop of the last readback in 1777×1000 coordinates */
  async function crop(name, x, y, w, h, k = 4) { const fr = await __perf.readback(); const sx = fr.w / 1777, sy = fr.h / 1000; return __perf.crop(name, Math.round(x * sx), Math.round(y * sy), Math.round(w * sx), Math.round(h * sy), k, 0.92, fr); }
  const setR = (on) => { S().glassRefract = !!on; };
  /** refraction OFF then ON on one view: whole frames + tiles under <prefix>_<view>_{off,on}, and the lossless diff of the pair (what moved, where) */
  async function ab(view, prefix = 'refract', settle = 40) {
    const out = {};
    setR(false); await go(view, settle); out.offShot = await shot(`${prefix}_${view}_off`, 0.9); const a = await __perf.readback(); out.offTiles = await tiles(view, `${prefix}_${view}_off`, 4, a);
    setR(true); await go(view, settle); out.onShot = await shot(`${prefix}_${view}_on`, 0.9); const b = await __perf.readback(); out.onTiles = await tiles(view, `${prefix}_${view}_on`, 4, b);
    out.diff = __perf.diff(a, b); out.hashOff = __perf.hash(a); out.hashOn = __perf.hash(b);
    return out;
  }
  /** the same A/B on the DETERMINISTIC still (seeded restart + fixed steps: the staged torch sits identically in both), so the pair differs only where refraction acts:
   *  <prefix>_<view>_{off,on}.jpg + tiles + the lossless PNG pair (docs/shots/ab/) + the diff numbers and the bounding box of what changed */
  async function abStill(view, prefix = 'refract', frames = 30) {
    const out = {};
    window.__particles?.clear?.();   // (particles are pool state that carries across a restart: the second still of a boot would not have the first's)
    const flush = async () => { await still(view === 'cubicles' ? 'lobby' : 'cubicles', 4); };   // both stills start from ANOTHER view's histories (rejected alike), not the ON still from the OFF still's own
    setR(false); await flush(); const a = await still(view, frames); out.offShot = await __perf.png(`${prefix}_${view}_off`, a); await shotOf(`${prefix}_${view}_off`, a); out.offTiles = await tiles(view, `${prefix}_${view}_off`, 4, a);
    setR(true); await flush(); const b = await still(view, frames); out.onShot = await __perf.png(`${prefix}_${view}_on`, b); await shotOf(`${prefix}_${view}_on`, b); out.onTiles = await tiles(view, `${prefix}_${view}_on`, 4, b);
    out.diff = __perf.diff(a, b); out.bbox = diffBox(a, b); out.hashOff = __perf.hash(a); out.hashOn = __perf.hash(b);
    return out;
  }
  /** a whole readback as a JPEG (the offscreen frame — __shot posts the canvas, which a hidden pane may not have presented) */
  async function shotOf(name, fr, q = 0.88) {
    const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h; const d = new Uint8ClampedArray(fr.data.length); d.set(fr.data); for (let i = 3; i < d.length; i += 4) d[i] = 255;
    c.getContext('2d').putImageData(new ImageData(d, fr.w, fr.h), 0, 0);
    const blob = await new Promise(res => c.toBlob(bb => res(bb), 'image/jpeg', q));
    const r = await fetch(`http://localhost:${Number(window.__shotPort) || 5174}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
    return `${name}.jpg ${fr.w}x${fr.h} ${(blob.size / 1024).toFixed(0)} KB → ${r.status}`;
  }
  /** bounding box + count of the pixels two readbacks differ in by more than `thr` */
  function diffBox(a, b, thr = 2) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; const W = a.w;
    for (let i = 0, p = 0; i < a.data.length; i += 4, p++) { const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])); if (d > thr) { n++; const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return n ? { n, x0, y0, x1, y1 } : { n: 0 };
  }
  const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const p95 = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(0.95 * b.length))] : NaN; };
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'];
  /** one serialized offscreen render → { passes, sum, union } */
  async function frame1() {
    const t = E().timer; const before = t.resolved;
    E().render(window.__cam, __perf.time, 1 / 60, false); __perf.time += 1 / 60;
    await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask();
    for (let k = 0; k < 400 && t.resolved === before; k++) await yieldTask();
    const passes = {}; let sum = 0;
    if (t.resolved !== before) for (const [k, v] of t.lastFrame) { passes[k] = v; if (!RP.includes(k)) sum += v; }
    const union = t.unionMs ? t.unionMs(RP) : sum;
    return { passes, sum, union };
  }
  /** interleaved A/B on the CURRENT view: rounds × (warm + n) serialized renders per variant; per-pass medians + Σ + union (median and p95) */
  async function costAB(applyA, applyB, opts = {}) {
    const { rounds = 4, n = 20, warm = 12, passes = ['compS', 'composite', 'sharpU', 'gbaa', 'taau', 'gather', 'temporal', 'direct', 'softblur'] } = opts;
    const acc = { A: { sum: [], union: [], p: {} }, B: { sum: [], union: [], p: {} } };
    for (const k of passes) { acc.A.p[k] = []; acc.B.p[k] = []; }
    for (let r = 0; r < rounds; r++) {
      for (const [tag, apply] of (r % 2 === 0 ? [['A', applyA], ['B', applyB]] : [['B', applyB], ['A', applyA]])) {
        await apply(); await __perf.render(warm);
        for (let i = 0; i < n; i++) { const f = await frame1(); acc[tag].sum.push(f.sum); acc[tag].union.push(f.union); for (const k of passes) acc[tag].p[k].push(f.passes[k] ?? 0); }
      }
    }
    await applyA();
    const row = a => ({ sumMed: +med(a.sum).toFixed(3), sumP95: +p95(a.sum).toFixed(3), unionMed: +med(a.union).toFixed(3), unionP95: +p95(a.union).toFixed(3), ...Object.fromEntries(Object.entries(a.p).map(([k, v]) => [k, +med(v).toFixed(3)])) });
    const A = row(acc.A), B = row(acc.B);
    return { A, B, dUnionMed: +(B.unionMed - A.unionMed).toFixed(3), dSumMed: +(B.sumMed - A.sumMed).toFixed(3), dCompS: +((B.compS ?? 0) - (A.compS ?? 0)).toFixed(3), res: `${E().width}×${E().height}→${E().outWidth}×${E().outHeight}`,
      text: `A(off) Σ ${A.sumMed} ∪ ${A.unionMed} (p95 ${A.unionP95}) compS ${A.compS} · B(on) Σ ${B.sumMed} ∪ ${B.unionMed} (p95 ${B.unionP95}) compS ${B.compS} · Δ∪ ${(B.unionMed - A.unionMed).toFixed(3)} ΔΣ ${(B.sumMed - A.sumMed).toFixed(3)} ΔcompS ${((B.compS ?? 0) - (A.compS ?? 0)).toFixed(3)}` };
  }
  /** refraction off vs on cost on `view` (staged first) */
  async function cost(view, opts = {}) { await go(view, 20); const r = await costAB(() => setR(false), () => setR(true), opts); setR(true); return { view, ...r }; }
  const ID_VIEWS = ['cubicles', 'confGraze', 'lobby', 'bottle', 'confFill'];
  /** one deterministic still of `v`: dice re-seeded, the encounter restarted (the staged man's construction dice), staged, `frames` fixed steps, one offscreen render */
  async function still(v, frames) {
    seed(true); G().restartEncounter(); await go(v, 0); E().passes.grain = 0; window.__resetClock();
    window.__runFrames(frames, 1 / 60); await E().device.queue.onSubmittedWorkDone();
    E().render(window.__cam, 100, 1 / 60, false);
    return __perf.readback();
  }
  /** the deterministic stills' hashes for a set of views under the CURRENT settings — run as the FIRST thing on a fresh `?paused` boot, the same list in the same order, on each
   *  build / setting to compare (main · OFF · ON): the game clock, the weather and the wind advance with every call, so only identical call sequences from boot hash alike */
  async function identity(views = ID_VIEWS, frames = 30) {
    const out = {};
    for (const v of views) out[v] = __perf.hash(await still(v, frames));
    out.res = [E().outWidth, E().outHeight]; out.refract = S().glassRefract ?? '(main)'; out.sharp = E().sharpOn; out.gbaa = E().passes.gbaaOn;
    return out;
  }
  /** the same stills as lossless PNGs too (→ docs/shots/ab/<prefix>_<view>.png) for an offline diff — the same fresh-boot rule */
  async function pngs(prefix, views = ID_VIEWS, frames = 30) {
    const out = {};
    for (const v of views) { const fr = await still(v, frames); out[v] = { hash: __perf.hash(fr), png: await __perf.png(`${prefix}_${v}`, fr) }; }
    out.res = [E().outWidth, E().outHeight]; out.refract = S().glassRefract ?? '(main)'; out.sharp = E().sharpOn; out.gbaa = E().passes.gbaaOn;
    return out;
  }
  /** GPU validation sweep: an error scope + the uncaptured list across presets × sharp × GBAA × debug views, refraction flipped under each */
  async function validate(view = 'bottle') {
    const dev = E().device; const errs = []; const onErr = e => errs.push('uncaptured: ' + e.error.message); dev.addEventListener('uncapturederror', onErr);
    dev.pushErrorScope('validation');
    const s = S(); const steps = []; const Q = window.__quality;
    const stepDo = async (label, fn) => { await fn(); await __perf.render(3); steps.push(label); };
    await go(view, 4);
    const keep = { preset: Q?.current, sharp: s.sharpDirect, gbaa: s.gbaa, scale: s.renderScale };   // (quality.ts Quality.current / apply(name) — applied back at the end: the sweep hops every preset)
    for (const preset of ['ultra', 'high', 'medium', 'low', 'verylow']) {
      await stepDo(preset, () => { Q?.apply?.(preset); });
      for (const r of [false, true]) await stepDo(`${preset} refract ${r}`, () => { s.glassRefract = r; });
    }
    await stepDo('back ' + keep.preset, () => { if (keep.preset) Q?.apply?.(keep.preset); });
    for (const sh of [false, true]) for (const gb of [false, true]) for (const r of [false, true]) await stepDo(`sharp ${sh} gbaa ${gb} refract ${r}`, () => { s.sharpDirect = sh; s.gbaa = gb; s.glassRefract = r; });
    s.sharpDirect = keep.sharp; s.gbaa = keep.gbaa;
    for (const dv of [1, 2, 3, 4, 5, 6, 9, 10, 14, 0]) await stepDo('view' + dv, () => { s.debugView = dv; });
    await stepDo('glass off', () => { s.glass = false; }); await stepDo('glass on', () => { s.glass = true; });
    for (const ior of [1.0, 1.05, 1.33, 2.0, 1.5]) await stepDo('ior ' + ior, () => { s.glassIor = ior; });
    await stepDo('taau off', () => { s.taau = false; }); await stepDo('taau on', () => { s.taau = true; });
    await stepDo('scale 1', () => { s.renderScale = 1.0; }); await stepDo('scale back', () => { s.renderScale = keep.scale; });
    const scope = await dev.popErrorScope(); dev.removeEventListener('uncapturederror', onErr);
    return { steps: steps.length, scope: scope ? scope.message.slice(0, 600) : null, uncaptured: errs.slice(0, 4) };
  }
  window.__rf = { VIEWS, ID_VIEWS, go, shot, shotOf, tiles, crop, ab, abStill, diffBox, cost, costAB, frame1, still, identity, pngs, validate, setR, DEG };
  return 'refract harness ready: __rf.{VIEWS,go,shot,tiles,crop,ab,cost,identity,pngs,validate}';
})();
