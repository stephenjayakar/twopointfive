// The render-fixes lane's GPU-side proofs, each a subcommand run against a dev server in a PRIVATE headless Chrome (tools/qa/cdp.ts):
//   bun run tools/qa/rfix-proofs.ts r101 [base=http://localhost:5246]   — light meter + a fixed probe point across a high → low → high preset hop (review R10.1)
//   bun run tools/qa/rfix-proofs.ts pool  [base]                        — texture-pool bytes / keys across high → low → (10 s) → resize (R1.1 / R1.3)
//   bun run tools/qa/rfix-proofs.ts identity [base] [tag]               — __png-style frame hashes of fixed views (decals + glass star, lot, lobby) from a fresh ?paused boot
//   bun run tools/qa/rfix-proofs.ts validate [base]                     — every preset booted with an error scope + uncapturederror over ~120 frames incl. a hop and a resize
// Sandbox OFF (Chrome + loopback). Numbers print as JSON lines; nothing is written unless a subcommand says so.
import { Cdp } from './cdp';
import { officePane } from './office-pane.ts';

const cmd = process.argv[2] ?? 'r101';
const base = process.argv[3] ?? 'http://localhost:5246';
const port = Number(process.env.CDP_PORT) || (9300 + Math.floor(Math.random() * 600));

/** the in-page prelude every proof shares: serialized stepping, seeded restart, parked guards */
const PRELUDE = `
  window.__testVisible = true;
  window.step = async (n = 1) => { const dev = __engine.device; for (let i = 0; i < n; i++) { __runFrames(1); await dev.queue.onSubmittedWorkDone(); await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); } };
  window.seed = (s = 12345) => { let a = s >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  window.calm = (pin, player) => { const g = __game; g.restartEncounter(); const r = __stage(pin, { park: true, player }); for (const c of [g.player.char, ...g.guards.map(x => x.char)]) c.anim.phase = 0; __engine.settings.grain = 0; return r; };
`;

async function boot(c: Cdp, query: string) {
  await c.open(`${base}/?paused&mute&${query}`);
  await c.eval(`window.__ready.then(() => 1)`, { timeoutMs: 120000 });
  for (let i = 0; i < 100; i++) { if (await c.eval(`document.querySelector('#view').clientWidth > 0`)) break; await new Promise(r => setTimeout(r, 100)); }
  await c.eval(PRELUDE + `__menu.close(); 1`);
}

async function r101() {
  const c = await Cdp.launch({ port });
  try {
    await boot(c, 'quality=high&onegrid=0');   // (ONE CACHE GRID off: high ↔ low must cross probe grids for this proof to swap a parked one in — with it on no preset hop does)
    // Sam where the bounce is a real share of his meter (the lobby, lit stone), a fixed probe point beside him; guards' torches out so nothing moving lights him
    const trace = await c.eval(`(async () => {
      seed(7); calm({ look: [9.0, 0, 17.0], yaw: 0.6, pitch: -1.0, dist: 9 }, { pos: [9.0, 0, 17.0], yaw: 0 }); await step(40);
      const rows = []; const P = [9.6, 1.0, 17.6];
      const sample = async (tag, n) => { for (let i = 0; i < n; i++) { __game.lightQuery('rfixP', P); await step(1); const m = __game.lightAt('playerChest'), p = __game.lightAt('rfixP'); rows.push({ tag, i, chest: m ?? null, point: p ?? null, grid: __engine.rc.cfg.nx + 'x' + __engine.rc.cfg.ny + 'x' + __engine.rc.cfg.nz, priming: __engine.rc.priming, parked: __engine.rcParked.join(',') }); } };
      await sample('high', 12);
      __quality.pin('low');  await sample('low', 24);
      __quality.pin('high'); await sample('high2', 24);
      return rows;
    })()`, { timeoutMs: 300000 });
    for (const r of trace) console.log(JSON.stringify(r));
    // summary: steady value per phase = median of its last 8 rows; dip = min over the phase's rows 2..12 relative to that steady value
    const phases = ['high', 'low', 'high2'];
    const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    for (const key of ['chest', 'point'] as const) {
      const line: string[] = [];
      for (const ph of phases) {
        const rows = trace.filter((r: any) => r.tag === ph && r[key] != null);
        const steady = med(rows.slice(-8).map((r: any) => r[key]));
        const early = rows.slice(2, 12).map((r: any) => r[key]);
        const lo = Math.min(...early), hi = Math.max(...early);
        line.push(`${ph}: steady ${steady.toFixed(4)} early[min ${lo.toFixed(4)} max ${hi.toFixed(4)}] dip ${((1 - lo / steady) * 100).toFixed(1)} %`);
      }
      console.log(`R10.1 ${key}: ` + line.join(' | '));
    }
    if (c.errors.length) console.log('page errors:', JSON.stringify(c.errors));
  } finally { await c.close(); }
}

/** R10.1 second half: a WORLD invalidation (the daylight swap) must reach a PARKED grid — park high's grid by pinning low, swap the day in, converge, pin high again:
 *  the grid coming back must read the day on its first frames, not blend night → day over seven. */
async function r101b() {
  const c = await Cdp.launch({ port });
  try {
    await boot(c, 'quality=high');
    const trace = await c.eval(`(async () => {
      seed(7); calm({ look: [9.0, 0, 17.0], yaw: 0.6, pitch: -1.0, dist: 9 }, { pos: [9.0, 0, 17.0], yaw: 0 }); await step(40);
      const rows = []; const P = [9.6, 1.0, 17.6];
      const sample = async (tag, n) => { for (let i = 0; i < n; i++) { __game.lightQuery('rfixP', P); await step(1); rows.push({ tag, i, chest: __game.lightAt('playerChest') ?? null, point: __game.lightAt('rfixP') ?? null, grid: __engine.rc.cfg.nx + 'x' + __engine.rc.cfg.ny, day: __daylight() }); } };
      await sample('nightHigh', 8);
      __quality.pin('low'); await sample('nightLow', 12);          // high's grid parked holding the NIGHT field
      __daylight(true);     await sample('dayLow', 16);            // the world changes while it is parked
      __quality.pin('high'); await sample('dayHigh', 24);          // it comes back: must read the day at once
      __daylight(false);    await sample('nightHigh2', 16);       // and the live grid must drop the day at once the other way
      return rows;
    })()`, { timeoutMs: 300000 });
    for (const r of trace) console.log(JSON.stringify(r));
    const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    for (const key of ['chest', 'point'] as const) {
      const line: string[] = [];
      for (const ph of ['dayLow', 'dayHigh', 'nightHigh2']) {
        const rows = trace.filter((r: any) => r.tag === ph && r[key] != null);
        const steady = med(rows.slice(-8).map((r: any) => r[key]));
        const early = rows.slice(2, 8).map((r: any) => r[key]);   // rows 0–1 still carry the previous phase's readbacks (probe latency)
        line.push(`${ph}: steady ${steady.toFixed(4)} early[${early.map((v: number) => v.toFixed(4)).join(' ')}] worst |Δ| ${(Math.max(...early.map((v: number) => Math.abs(1 - v / steady))) * 100).toFixed(1)} %`);
      }
      console.log(`R10.1b ${key}: ` + line.join(' | '));
    }
    if (c.errors.length) console.log('page errors:', JSON.stringify(c.errors));
  } finally { await c.close(); }
}

/** R1.1: the reflection set must go back to the pool once the pass has been off RT_IDLE_FRAMES (600), and a resize after that must not touch it. */
async function pool() {
  const c = await Cdp.launch({ port });
  try {
    await boot(c, 'quality=high');
    const rows = await c.eval(`(async () => {
      const P = __engine.passes, pool = __engine.pool;
      const snap = (tag) => ({ tag, preset: __quality.preset ?? __quality.name, rtOn: P.rtOn, rtEverOn: P.rtEverOn, refl: P.refl ? P.refl.width + 'x' + P.refl.height : null, hist: P.reflHist.length, rw: P.rw, parkedMB: +(pool.parkedBytes / 1048576).toFixed(1), keys: pool.keyCount ?? null, lastRealloc: P.lastRealloc });
      const out = []; __runFrames(10); out.push(snap('high +10'));
      __quality.pin('low'); __runFrames(10); out.push(snap('low +10'));
      __runFrames(560); out.push(snap('low +570'));
      __runFrames(60); out.push(snap('low +630'));
      __engine.settings.renderScale = 0.8; __runFrames(5); out.push(snap('low resized ×0.8'));
      __quality.pin('high'); __runFrames(5); out.push(snap('high again +5'));
      return out;
    })()`, { timeoutMs: 580000 });
    for (const r of rows) console.log(JSON.stringify(r));
    if (c.errors.length) console.log('page errors:', JSON.stringify(c.errors));
  } finally { await c.close(); }
}

/** Identity: FNV hashes of deterministic stills, ONE FRESH BOOT PER VIEW (the fixtures' flicker, the haze clock and the TAAU phase all key on the frame index). Views:
 *  'marks' = the conference glass with a crack star per pane + a scorch + 80 seeded bullet marks on the floor / walls (decals.wgsl through the g-buffer AND the composite's glass path),
 *  'lot' = the lit car park from above (froxel beams, rain off), 'lobby' = the polished lobby floor (RT reflections + markings). Same call sequence on two builds → same hashes. */
const DEG = Math.PI / 180;
/** the conference partition's three east sheets (c.x 10.75, 11.85, 12.95 on z = 10), BY WHERE THEY STAND: they were boxes 112‥114 until the door-size export of 10-10 moved them one along */
const CONF_EAST = [officePane(10.75, 10), officePane(11.85, 10), officePane(12.95, 10)];
const VIEWS: Record<string, { q: string; js: string; midAt?: number; mid?: string }> = {
  marks: { q: 'quality=high', js: `calm({ look: [15, 0, 11.1], yaw: 90 * ${DEG}, pitch: 30 * ${DEG}, dist: 6 }, { pos: [14.5, 0, 11.0], yaw: 0, holstered: true });
    __marks.test();                                   // 23 rounds' marks on the corridor's south wall dead ahead of him (chest height, by the lit panel)
    for (const bi of [${CONF_EAST}]) __glass.hit(bi, [__game.level.boxes[bi].c[0] + 0.12, 1.3 + 0.15 * (bi - ${CONF_EAST[0]}), 10.0], [0.2, -0.05, -1]);   // stars on the conference panes (the corridor's north side)
    __marks.bang([13.6, 0, 11.1]); __marks.bang([15.2, 0, 11.4]); __marks.bang([16.8, 0, 10.8]); __marks.random(60, 3);
    __game.teleportPlayer([30, 0, 20]);` },           // (and out of the frame)
  lot: { q: 'quality=high', js: `calm({ look: [20, 0, 31], yaw: 180 * ${DEG}, pitch: 50 * ${DEG}, dist: 14 }, { pos: [30, 0, 20], yaw: 0, invisible: true });` },
  lobby: { q: 'quality=high', js: `calm({ look: [15, 0, 11.1], yaw: 90 * ${DEG}, pitch: 30 * ${DEG}, dist: 6 }, { pos: [6.5, 0, 15.0], yaw: 1.0, invisible: true });` },   // (p4's corridor pin: polished lino, RT reflections, markings)
  marksLow: { q: 'quality=low', js: '' },   // (filled below: the marks view at low — no RT reflections, the fragment composite path)
  // a lightning stroke over the lot mid-sequence: the one TRANSIENT light alive → gather_common's per-hit subtraction walk runs (review R2.2: from the first transient's slot instead of 0 —
  // must hash as main WITH the walk live, not only in a still where it is skipped); hashed 3 frames into the flash
  strike: { q: 'quality=high', js: `calm({ look: [20, 0, 31], yaw: 180 * ${DEG}, pitch: 50 * ${DEG}, dist: 14 }, { pos: [30, 0, 20], yaw: 0, invisible: true });`, midAt: 37, mid: `__weather.strike({ bearing: 3.5, elevDeg: 35, distKm: 1.2, peak: 40 });` },
  strikeIn: { q: 'quality=high', js: `calm({ look: [15, 0, 11.1], yaw: 90 * ${DEG}, pitch: 30 * ${DEG}, dist: 6 }, { pos: [30, 0, 20], yaw: 0, invisible: true });`, midAt: 37, mid: `__weather.strike({ bearing: 3.5, elevDeg: 35, distKm: 1.2, peak: 40 });` },   // (the corridor: indoor bounce hits on screen while the stroke is alive)
};
VIEWS.marksLow.js = VIEWS.marks.js;
/** the last __perf.readback() → JPEG file, encoded in the page through a 2D canvas (optionally a crop [x, y, w, h] scaled ×k nearest — the tiles the notebook judges) */
async function saveReadback(c: Cdp, file: string, crop?: [number, number, number, number], k = 1) {
  const url = await c.eval(`(async () => {
    const fr = await __perf.readback(); const [cx, cy, cw, ch] = ${crop ? JSON.stringify(crop) : '[0, 0, fr.w, fr.h]'}; const k = ${k};
    const src = document.createElement('canvas'); src.width = fr.w; src.height = fr.h;
    const id = new ImageData(new Uint8ClampedArray(fr.data.buffer, fr.data.byteOffset, fr.w * fr.h * 4), fr.w, fr.h); src.getContext('2d').putImageData(id, 0, 0);
    const out = document.createElement('canvas'); out.width = cw * k; out.height = ch * k; const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, cx, cy, cw, ch, 0, 0, cw * k, ch * k);
    return out.toDataURL('image/jpeg', 0.9);
  })()`, { timeoutMs: 60000 });
  await Bun.write(file, Buffer.from(String(url).split(',')[1], 'base64'));
}
async function identity() {
  const tag = process.argv[4] ?? '';
  const which = (process.argv[5] ?? Object.keys(VIEWS).join(',')).split(',');
  const out: Record<string, string> = {};
  for (const name of which) {
    const v = VIEWS[name]; if (!v) { console.log('unknown view', name); continue; }
    const c = await Cdp.launch({ port: port + 1 + which.indexOf(name) });
    try {
      await boot(c, v.q);
      const r = await c.eval(`(async () => {
        await import('/qa/perf-harness.js');
        seed(99); ${v.js}
        __engine.settings.grain = 0; __engine.settings.debugView = ${Number(process.env.DV) || 0}; window.__resetClock(); seed(100);
        await step(${v.midAt ?? 40}); ${v.mid ?? ''} await step(${40 - (v.midAt ?? 40)});
        await __perf.render(1); const fr = await __perf.readback();
        return { hash: __perf.hash(fr), res: [fr.w, fr.h], decals: __game.decals.count, cracks: __glass.cracks ?? null, transient: __engine.lights.lights.filter(l => (l.ttl >= 0 || l.transient) && l.enabled).length, firstT: __engine.lights.firstTransientSlot ?? null, nLights: __engine.lights.activeCount, q: __quality.preset ?? __quality.name ?? null, scale: __engine.settings.renderScale };
      })()`, { timeoutMs: 300000 });
      out[name] = r.hash; console.log(JSON.stringify({ tag, view: name, ...r, errors: c.errors.filter((e: string) => !/404/.test(e)) }));
      if (process.env.SHOT) await saveReadback(c, `docs/shots/rfix_${name}${tag ? '_' + tag : ''}.jpg`);   // the hashed readback itself as a JPEG (the headless compositor does not show the WebGPU canvas to Page.captureScreenshot)
    } finally { await c.close(); }
  }
  console.log(`IDENTITY ${tag}: ` + Object.entries(out).map(([k, h]) => `${k}=${h}`).join(' '));
}

/** eyeball a view: the whole frame + ×3 nearest crops (args: view name, then crops as x,y,w,h;…) → docs/shots/rfix_<view>_look*.jpg */
async function look() {
  const name = process.argv[4] ?? 'marks'; const v = VIEWS[name]; if (!v) throw new Error('unknown view ' + name);
  const crops = (process.argv[5] ?? '').split(';').filter(Boolean).map(t => t.split(',').map(Number) as [number, number, number, number]);
  const c = await Cdp.launch({ port });
  try {
    await boot(c, v.q);
    await c.eval(`(async () => { await import('/qa/perf-harness.js'); seed(99); ${v.js} __engine.settings.grain = 0; window.__resetClock(); seed(100); await step(40); await __perf.render(1); return 1; })()`, { timeoutMs: 300000 });
    await saveReadback(c, `docs/shots/rfix_${name}_look.jpg`);
    for (let i = 0; i < crops.length; i++) await saveReadback(c, `docs/shots/rfix_${name}_look_c${i}.jpg`, crops[i], 3);
    console.log('wrote', 1 + crops.length, 'files; errors:', JSON.stringify(c.errors.filter((e: string) => !/404/.test(e))));
  } finally { await c.close(); }
}

/** GPU validation: each preset booted fresh with an uncapturederror listener + a validation error scope round ~120 frames that include a preset hop (and back), a render-scale
 *  resize, a daylight round trip (R10.1's boost bakes), a lightning stroke (R2.2's walk) and a __resetClock mid-run (R2.7); 0 errors expected everywhere. */
async function validate() {
  const tiers = (process.argv[4] ?? 'verylow,low,medium,high,ultra').split(',');
  let bad = 0;
  for (const tier of tiers) {
    const c = await Cdp.launch({ port: port + 20 + tiers.indexOf(tier) });
    try {
      await boot(c, `quality=${tier}`);
      const r = await c.eval(`(async () => {
        const dev = __engine.device; const errs = [];
        dev.addEventListener('uncapturederror', (e) => errs.push('uncaptured: ' + (e.error && e.error.message || e)));
        dev.pushErrorScope('validation'); dev.pushErrorScope('out-of-memory');
        seed(5); calm({ look: [15, 0, 11.1], yaw: ${90 * DEG}, pitch: ${30 * DEG}, dist: 6 }, { pos: [14.5, 0, 11.0], yaw: 0 });
        __marks.test(); __marks.bang([13.6, 0, 11.1]); __glass.hit(${CONF_EAST[1]}, [12.0, 1.4, 10.0], [0.2, 0, -1]);
        await step(20);
        const other = '${tier}' === 'low' ? 'high' : 'low'; __quality.pin(other); await step(15); __quality.pin('${tier}'); await step(15);   // a hop across cascade grids and back (R10.1's re-prime + boost, R1.1's set)
        __engine.settings.renderScale = Math.max(0.5, __engine.settings.renderScale - 0.15); await step(10);                          // a resize
        __daylight(true); await step(8); __daylight(false); await step(8);                                                             // the light rig swapped both ways (invalidateWorldCache)
        __weather.strike({ bearing: 3.5, elevDeg: 35, distKm: 1.2, peak: 40 }); await step(6);                                        // a transient alive (the gather's subtraction walk)
        window.__resetClock(); await step(6);                                                                                           // R2.7
        __stage({ look: [30, 0, 20], yaw: 0, pitch: ${50 * DEG}, dist: 12 }, {}); await step(6);                                        // a camera CUT (R2.8's froxel restart) 
        for (const v of [3, 4, 9, 13, 0]) { __engine.settings.debugView = v; await step(2); }                                          // a few debug views and back
        await step(20);
        const oom = await dev.popErrorScope(); const val = await dev.popErrorScope();
        return { frames: __engine.frameIdx, scope: [val && val.message, oom && oom.message].filter(Boolean), uncaptured: errs, preset: __quality.preset ?? __quality.name ?? null };
      })()`, { timeoutMs: 580000 });
      const pageErrs = c.errors.filter((e: string) => !/404/.test(e));
      const n = r.scope.length + r.uncaptured.length + pageErrs.length; bad += n;
      console.log(JSON.stringify({ tier, ...r, pageErrs, verdict: n ? 'FAIL' : 'PASS' }));
    } finally { await c.close(); }
  }
  console.log(`VALIDATE: ${bad ? bad + ' errors — FAIL' : 'ALL PASS (0 GPU / page errors)'} over ${tiers.join(', ')}`);
  if (bad) process.exitCode = 1;
}

/** R2.8: the froxel ghost across a hard cut — settle 40 frames on the lot's lamp beams, CUT to the corridor, and compare the frame 1 / 2 / 4 / 8 after the cut against the settled
 *  frame 30 after it (mean |Δ| luminance over the frame, and over its top third where the haze sits): a history that follows the cut carries the lot's beams into those frames. */
async function ghost() {
  const c = await Cdp.launch({ port });
  try {
    await boot(c, 'quality=high');
    const r = await c.eval(`(async () => {
      await import('/qa/perf-harness.js');
      seed(9); calm({ look: [20, 0, 31], yaw: ${180 * DEG}, pitch: ${50 * DEG}, dist: 14 }, { pos: [30, 0, 20], yaw: 0, invisible: true }); __engine.settings.grain = 0; window.__resetClock();
      await step(40);
      if (${process.env.GHOST_TURN ? 'true' : 'false'}) __stage({ look: [20, 0, 31], yaw: ${90 * DEG}, pitch: ${50 * DEG}, dist: 14 }, {}); else __stage({ look: [15, 0, 11.1], yaw: ${90 * DEG}, pitch: ${30 * DEG}, dist: 6 }, {});   // GHOST_TURN: the same look point swung 90° at once (frusta overlap: world-space history survives reprojection) — else a 13 m cut to the corridor
      const grab = async () => { await __perf.render(1); const fr = await __perf.readback(); return fr; };
      const frames = {}; let n = 0;
      for (const k of [1, 2, 4, 8, 30]) { await step(k - n); n = k; frames[k] = await grab(); }
      const lum = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
      const ref = frames[30]; const W = ref.w, H = ref.h; const out = {};
      for (const k of [1, 2, 4, 8]) {
        const f = frames[k]; let s = 0, sTop = 0, mx = 0, cnt = 0, cntTop = 0;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const o = (y * W + x) * 4; const d = Math.abs(lum(f.data, o) - lum(ref.data, o)); s += d; cnt++; if (y < H / 3) { sTop += d; cntTop++; } if (d > mx) mx = d; }
        out['f' + k] = { mean: +(s / cnt).toFixed(3), meanTop: +(sTop / cntTop).toFixed(3), max: +mx.toFixed(1) };
      }
      return { out, taaResets: __taa.resets, lastReset: __taa.lastReset, froxAge: __engine.passes.froxels.age };
    })()`, { timeoutMs: 400000 });
    console.log(JSON.stringify(r));
    if (process.env.SHOT) await saveReadback(c, 'docs/shots/rfix_ghost_f30.jpg');
  } finally { await c.close(); }
}

const table: Record<string, () => Promise<void>> = { r101, r101b, pool, identity, look, validate, ghost };
if (!table[cmd]) { console.error('unknown subcommand', cmd, Object.keys(table)); process.exit(2); }
await table[cmd]();
