// lightwork/cascade — a preload AFTER tools/qa/framecost-hooks.ts (FC_GPU=1): a CPU COUNT of what the light cache (render/rc.ts, the radiance cascades) asks of the
// GPU on a frame of a scripted play — per level its probe rays (exact: probes × directions), and, by SAMPLING LW_RAYS of them through the CPU raycast, how many
// start inside the world, how many hit something, and how many SHADOW rays those hits then cost (rc.wgsl hitRadiance → common.wgsl directIrradiance: one per light
// that reaches the hit's cell by its reach row and gives ≥ settings.secMinE there unshadowed). One JSON line a sampled frame to LW_OUT.
//
// A MODEL of the count, not the pass: the CPU raycast stands in for the GPU's (the same boxes: statics, leaves, props — no pane, no character proxy), the dice are this file's own (a seeded
// mulberry32 — never the game's), and nothing is timed. Good to a few percent on rays, which is all the page quotes it for.
import { appendFileSync, writeFileSync } from 'node:fs';
import { WORLD } from '../../../src/scene/world';
import { reachLevel } from '../../../src/render/reach';
import { BoxFlag } from '../../../src/scene/boxes';
import { afterFrame } from './hook';
const OUT = process.env.LW_OUT ?? '/dev/stdout', EVERY = Number(process.env.LW_EVERY ?? 600), RAYS = Number(process.env.LW_RAYS ?? 4000);
const MIN_E = (process.env.LW_MINE ?? '0.006,0.02').split(',').map(Number);   // the secMinE values to count under (the first is High's)
if (OUT !== '/dev/stdout') writeFileSync(OUT, '');
let seed = 0x9e3779b9; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const octDecode = (u: number, v: number): [number, number, number] => { const fx = u * 2 - 1, fz = v * 2 - 1; let x = fx, y = 1 - Math.abs(fx) - Math.abs(fz), z = fz; const t = Math.min(1, Math.max(0, -y)); x += x >= 0 ? -t : t; z += z >= 0 ? -t : t; const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
/** common.wgsl evalLight at P with normal N, off the uploaded record (16 floats at o): its LARGEST colour channel — the measure directIrradiance holds against secMinE */
const evalMax = (f: Float32Array, u: Uint32Array, o: number, P: number[], N: number[]): number => {
  const kind = u[o + 3] & 255, col = Math.max(f[o + 8], f[o + 9], f[o + 10]);
  if (kind === 2) { const c = -(N[0] * f[o + 4] + N[1] * f[o + 5] + N[2] * f[o + 6]); return c > 0 ? col * c : 0; }
  const dx = f[o] - P[0], dy = f[o + 1] - P[1], dz = f[o + 2] - P[2], d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2), range = f[o + 7];
  if (d > range) return 0;
  const x = d / range, w = Math.min(1, Math.max(0, 1 - x * x * x * x)); let att = w * w / Math.max(d2, f[o + 15] * f[o + 15]);
  const cd = -(dx * f[o + 4] + dy * f[o + 5] + dz * f[o + 6]) / d;
  if (kind === 1) { const co = f[o + 11], ci = f[o + 12]; if (cd < co) return 0; const s = Math.min(1, Math.max(0, (cd - co) / (ci - co))); att *= s * s * (3 - 2 * s); }
  else if (kind === 3) { if (cd <= 0) return 0; att *= cd; }
  const c = (N[0] * dx + N[1] * dy + N[2] * dz) / d;
  return c > 0 && att > 0 ? col * att * c : 0;
};
afterFrame((W, n) => {
  if (n % EVERY) return;
  const { engine, game } = W, cfg = engine.rc.cfg, LS = engine.lights, f = new Float32Array(LS.data as ArrayBuffer), u = new Uint32Array(LS.data as ArrayBuffer);   // (LightSet.data: the uploaded records, 16 words a slot)
  const live = LS.lights.filter((l: any) => (l.slot ?? -1) >= 0 && !(l.ttl >= 0 || l.transient));   // (directIrradiance skips transient lights)
  const periods: number[] = engine.settings.rcPeriods ?? [1, 1, 1, 1], reachOn = engine.settings.lightReach !== false;
  const levels: any[] = [];
  for (let k = 0; k < cfg.cascades; k++) {
    const dims = [Math.ceil(cfg.nx / (1 << k)), cfg.ny, Math.ceil(cfg.nz / (1 << k))], D = cfg.d0 << k, rays = dims[0] * dims[1] * dims[2] * D * D;
    const t0 = cfg.interval0 * (4 ** k - 1) / 3, tLen = cfg.interval0 * 4 ** k, sp = [WORLD.rcSize[0] / dims[0], WORLD.rcSize[1] / dims[1], WORLD.rcSize[2] / dims[2]];
    let inside = 0, hits = 0; const shadow = MIN_E.map(() => 0), scored = { n: 0 };
    for (let s = 0; s < RAYS; s++) {
      const P0 = [WORLD.rcMin[0] + (Math.floor(rnd() * dims[0]) + 0.5) * sp[0], WORLD.rcMin[1] + (Math.floor(rnd() * dims[1]) + 0.5) * sp[1], WORLD.rcMin[2] + (Math.floor(rnd() * dims[2]) + 0.5) * sp[2]];
      const dir = octDecode((Math.floor(rnd() * D) + rnd()) / D, (Math.floor(rnd() * D) + rnd()) / D);
      const ro: [number, number, number] = [P0[0] + dir[0] * t0, P0[1] + dir[1] * t0, P0[2] + dir[2] * t0];
      if (ro.some((v, a) => v < WORLD.min[a] || v > WORLD.max[a])) continue;
      inside++;
      const hit = engine.world.raycast(ro, dir, tLen, BoxFlag.NoShadow | BoxFlag.Glass); if (!hit) continue;   // (the skip flags = what the GPU's trace grid leaves out: NoShadow boxes and panes — the NoPrimary ceiling IS in it)
      hits++;
      const P = [ro[0] + dir[0] * hit.t, ro[1] + dir[1] * hit.t, ro[2] + dir[2] * hit.t], cx = Math.floor((P[0] - WORLD.min[0]) / WORLD.gridCell), cz = Math.floor((P[2] - WORLD.min[2]) / WORLD.gridCell);
      const inGrid = cx >= 0 && cz >= 0 && cx < WORLD.gridW && cz < WORLD.gridH, ci = cz * WORLD.gridW + cx;
      for (const l of live) {
        const mask = l.kind === 2 ? l.reachDir : l.reach;
        if (reachOn && inGrid && mask && reachLevel(mask, ci) === 0) continue;
        scored.n++;
        const E = evalMax(f, u, l.slot * 16, P, hit.n);
        for (let m = 0; m < MIN_E.length; m++) if (E >= MIN_E[m]) shadow[m]++;
      }
    }
    const k1 = rays / RAYS;
    levels.push({ level: k, probes: dims[0] * dims[1] * dims[2], dirs: D * D, rays, interval: [+t0.toFixed(2), +(t0 + tLen).toFixed(2)], period: periods[Math.min(k, periods.length - 1)] || 1,
      insideShare: +(inside / RAYS).toFixed(3), hitShare: +(hits / RAYS).toFixed(3), hits: Math.round(hits * k1), lightsScored: Math.round(scored.n * k1), shadowRays: shadow.map(v => Math.round(v * k1)) });
  }
  appendFileSync(OUT, JSON.stringify({ f: n, t: +game.time.toFixed(2), lights: live.length, held: live.filter((l: any) => l.owner).length, minE: MIN_E, levels,
    total: { rays: levels.reduce((a, l) => a + l.rays, 0), hits: levels.reduce((a, l) => a + l.hits, 0), shadowRays: MIN_E.map((_, m) => levels.reduce((a, l) => a + l.shadowRays[m], 0)) } }) + '\n');
});
