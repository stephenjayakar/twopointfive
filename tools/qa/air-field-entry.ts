// THE AIR FIELD'S TEST PAGE, the half that runs in the browser (tools/qa/air-field-page.cjs bundles this with `bun build` and loads it in a blank page on the
// software WebGPU adapter). ONLY the solver (src/render/airField.ts): no game, no renderer. It builds the three scenes' cell maps, steps the field under a gusting
// wind and hands the read-back fields, the probe series and the timing to the node half, which asserts and draws.
import { AirField, AIR, AIR_RES } from '../../src/render/airField';

const WORLD_W = 40, WORLD_H = 28;
const W = WORLD_W * AIR_RES, H = WORLD_H * AIR_RES;
type Scene = 'open' | 'gate' | 'yard' | 'court' | 'room' | 'roomdoor';

/** the scenes' geometry in metres, so the node half measures against the same numbers */
const GEO = {
  gate: { wallX: 14, gapZ0: 12.6, gapZ1: 15.6, leafLen: 1.4, leafDeg: 70 },
  room: { box: [15, 10, 25, 18], door: [13.5, 14.5] },   // a roofed room, closed ('room') or with one doorway in its low-x wall ('roomdoor'): the indoor scenes, no ambient wind
  yard: { lorry: [8, 4, 10.5, 10], crate: [14, 14, 15, 15], ell: [18, 16, 22, 22], house: [26, 6, 36, 14], door: [9.6, 10.6] },
  court: { wall: [7, 5, 33, 23], gate: [18, 21], lorry: [10, 14, 16, 16.4] },   // a walled yard under the open sky with one gate in its high-z wall and a lorry in it: the pass's compound (a closed box the wind pushes on)
};

function buildMask(scene: Scene): { mask: Uint8Array; leafTip: [number, number] } {
  const m = new Uint8Array(W * H).fill(254); let leafTip: [number, number] = [0, 0];
  const cell = (i: number, j: number, v: number) => { if (i >= 0 && j >= 0 && i < W && j < H) m[j * W + i] = v; };
  const box = (x0: number, z0: number, x1: number, z1: number, v = 255) => { for (let j = Math.round(z0 * AIR_RES); j < Math.round(z1 * AIR_RES); j++) for (let i = Math.round(x0 * AIR_RES); i < Math.round(x1 * AIR_RES); i++) cell(i, j, v); };
  // a thin solid line, 4-CONNECTED (where it steps diagonally the corner cell is filled too: air does not pass between two cells that only touch at a corner)
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * AIR_RES * 8); let pi = -1, pj = -1;
    for (let k = 0; k <= n; k++) { const t = k / n, i = Math.floor((x0 + (x1 - x0) * t) * AIR_RES), j = Math.floor((z0 + (z1 - z0) * t) * AIR_RES);
      if (pi >= 0 && i !== pi && j !== pj) cell(pi, j, 255); cell(i, j, 255); pi = i; pj = j; }
  };
  if (scene === 'gate') {
    const G = GEO.gate, c = 1 / AIR_RES;
    box(G.wallX, 0, G.wallX + c, G.gapZ0); box(G.wallX, G.gapZ1, G.wallX + c, WORLD_H);
    // the leaf: hinged on the gap's low-z jamb, shut it would lie along +z across the gap; it stands open leafDeg toward +x (the lee)
    const a = G.leafDeg * Math.PI / 180, hx = G.wallX + c * 0.5, hz = G.gapZ0 - c * 0.5; leafTip = [hx + Math.sin(a) * G.leafLen, hz + Math.cos(a) * G.leafLen];
    line(hx, hz, leafTip[0], leafTip[1]);
  } else if (scene === 'yard') {
    const Y = GEO.yard, c = 1 / AIR_RES;
    box(Y.lorry[0], Y.lorry[1], Y.lorry[2], Y.lorry[3]); box(Y.crate[0], Y.crate[1], Y.crate[2], Y.crate[3]);
    box(Y.ell[0], Y.ell[1], Y.ell[0] + c, Y.ell[3]); box(Y.ell[0], Y.ell[3] - c, Y.ell[2], Y.ell[3]);   // an L: one arm across the wind, one along it
    const [hx0, hz0, hx1, hz1] = Y.house; box(hx0, hz0, hx1, hz1, 255); box(hx0 + c, hz0 + c, hx1 - c, hz1 - c, 0);   // walls solid, share 0 under the roof
    box(hx0, Y.door[0], hx0 + c, Y.door[1], 0);   // the doorway, in the windward wall
  } else if (scene === 'court') {
    const C = GEO.court, c = 1 / AIR_RES, [x0, z0, x1, z1] = C.wall;
    box(x0, z0, x1, z0 + c); box(x0, z1 - c, x1, z1); box(x0, z0, x0 + c, z1); box(x1 - c, z0, x1, z1);
    box(C.gate[0], z1 - c, C.gate[1], z1, 254); box(C.lorry[0], C.lorry[1], C.lorry[2], C.lorry[3]);
  } else if (scene === 'room' || scene === 'roomdoor') {
    const R = GEO.room, c = 1 / AIR_RES, [x0, z0, x1, z1] = R.box; box(x0, z0, x1, z1, 255); box(x0 + c, z0 + c, x1 - c, z1 - c, 0);
    if (scene === 'roomdoor') box(x0, R.door[0], x0 + c, R.door[1], 0);
  }
  return { mask: m, leafTip };
}

const b64 = (a: ArrayBufferView): string => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

interface RunOpts {
  scene: Scene; steps: number; dt: number; timeOffset?: number; wind?: number; gust?: number; gustPeriod?: number;
  /** steps (1-based, after that many) at which the whole field is kept */
  snaps?: number[];
  /** cells [i, j] whose velocity is recorded every step over the last `seriesLast` steps */
  probes?: [number, number][]; seriesLast?: number;
  /** then this many steps with the wind at 0, and the field again */
  stillSteps?: number;
  /** local sources (AirField.setSources records of 8), on from the first step */
  sources?: number[][];
  /** then the sources cleared, this many steps, and the field again */
  clearSteps?: number;
  air?: Partial<typeof AIR>;
}

let device: GPUDevice | null = null; const gpuErrors: string[] = [];
async function boot(): Promise<{ adapter: string }> {
  const ad = await navigator.gpu.requestAdapter(); if (!ad) throw new Error('no WebGPU adapter');
  device = await ad.requestDevice(); device.addEventListener('uncapturederror', e => { gpuErrors.push(String((e as GPUUncapturedErrorEvent).error?.message).slice(0, 400)); });
  const info = (ad as unknown as { info?: { vendor?: string; architecture?: string; description?: string } }).info;
  return { adapter: info ? `${info.vendor ?? ''} ${info.architecture ?? ''} ${info.description ?? ''}`.trim() : '?' };
}

async function run(o: RunOpts) {
  const dev = device!; const saved = { ...AIR }; Object.assign(AIR, o.air ?? {});
  const air = new AirField(dev, WORLD_W, WORLD_H); await air.whenReady; const { mask, leafTip } = buildMask(o.scene); air.setCells(mask);
  const view0 = air.view; if (o.sources) air.setSources(new Float32Array(o.sources.flat()), o.sources.length);
  const base = o.wind ?? 2.5, gust = o.gust ?? 0.35, period = o.gustPeriod ?? 8, t0 = o.timeOffset ?? 0;
  const windAt = (t: number): [number, number] => [base * (1 + gust * Math.sin(2 * Math.PI * t / period)), 0];
  const snaps: { step: number; t: number; wind: number; field: string }[] = []; const series: number[][] = (o.probes ?? []).map(() => []);
  const one = (dt: number, time: number, wind: [number, number]) => { const enc = dev.createCommandEncoder(); air.step(enc, dt, time, wind); dev.queue.submit([enc.finish()]); };
  const from = o.steps - (o.seriesLast ?? 0); let ms = 0, timed = 0;
  let t = 0;
  for (let s = 1; s <= o.steps; s++) {
    const snap = o.snaps?.includes(s), probe = !!o.probes && s > from, clock = s % 50 === 0;
    if (clock) await dev.queue.onSubmittedWorkDone();   // (one step in 50 is timed alone: the queue is drained before it and after it)
    const w = windAt(t); const c0 = performance.now(); one(o.dt, t0 + t, w); t += o.dt;
    if (clock) { await dev.queue.onSubmittedWorkDone(); ms += performance.now() - c0; timed++; }
    if (snap || probe) { const f = await air.readBack(); if (snap) snaps.push({ step: s, t, wind: w[0], field: b64(f) });
      if (probe) o.probes!.forEach(([i, j], k) => { series[k].push(f[(j * W + i) * 4], f[(j * W + i) * 4 + 1]); }); }
  }
  let still: string | null = null;
  if (o.stillSteps) { for (let s = 0; s < o.stillSteps; s++) { one(o.dt, t0 + t, [0, 0]); t += o.dt; if (s % 100 === 99) await dev.queue.onSubmittedWorkDone(); } still = b64(await air.readBack()); }
  let cleared: string | null = null;
  if (o.clearSteps) { air.setSources(new Float32Array(0), 0); for (let s = 0; s < o.clearSteps; s++) { one(o.dt, t0 + t, windAt(t)); t += o.dt; if (s % 100 === 99) await dev.queue.onSubmittedWorkDone(); } cleared = b64(await air.readBack()); }
  const out = { w: W, h: H, res: AIR_RES, mask: b64(mask), leafTip, geo: GEO, snaps, series, still, cleared, msPerStep: timed ? ms / timed : 0, dispatches: air.dispatches, iterations: AIR.iterations,
    sameView: view0 === air.view, air: { ...AIR }, gpuErrors: gpuErrors.slice() };
  air.destroy(); Object.assign(AIR, saved); return out;
}

(window as unknown as { __air: unknown }).__air = { boot, run, W, H, GEO };
