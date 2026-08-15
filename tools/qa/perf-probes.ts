// The pure parts of the renderer perf / noise pass (docs/internal/perf-2026-08-10.md): the torch bounce card's geometry (a CPU twin of cards.wgsl's
// lane 0), its energy bookkeeping (the cone-flux closed form the shader's 64 stratified samples estimate, and the 4-point quadrature the gather evaluates,
// both against brute-force integration of the true spot profile on a wall), the card nomination (lights.ts cardSlotsFor), and the flag / settings table
// (bits distinct, defaults off, the frame block sized for the card slots). The GPU halves are verified by measurement (the doc's protocol); this is what
// can be held without one.   bun run tools/qa/perf-probes.ts   (also `probes.ts perf`)
import { ROOT } from './headless';

const { FrameFlags, FRAME_BYTES, MAX_CARDS, writeFrame, noWeather } = await import(`${ROOT}/src/render/frame.ts`);
const { cardSlotsFor } = await import(`${ROOT}/src/render/lights.ts`);
const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
const { PRESETS } = await import(`${ROOT}/src/ui/quality.ts`);

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => scale(a, 1 / len(a));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

let fails = 0;
/** failures so far (probes.ts prints the family verdict off it) */
export const perfProbeFailures = () => fails;
const check = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); };

// ================================================================ cards.wgsl, lane 0: the claim disc from the axis hit ================================================================
// (the constants are the shader's; keep them in step)
const CARD_TMAX = 6.0, CARD_RMAX = 1.0, CARD_COS_GRAZE = 0.25;
/** The card's claim disc for a spot at `pos` along unit `dir` with outer-cone cosine `cosOuter`, whose axis meets a surface at distance t with unit normal n
 *  (facing the light): { C, R } — or null when cards.wgsl builds none (too far, grazing, no cone). */
export function cardDisc(pos: V3, dir: V3, cosOuter: number, t: number, n: V3): { C: V3; R: number } | null {
  if (!(cosOuter > 0.3) || !(t <= CARD_TMAX)) return null;
  const cosInc = dot(n, scale(dir, -1));
  if (cosInc <= CARD_COS_GRAZE) return null;
  const tanO = Math.sqrt(Math.max(1 - cosOuter * cosOuter, 0)) / cosOuter;
  return { C: add(pos, scale(dir, t)), R: Math.min(CARD_RMAX, 1.15 * t * tanO / cosInc) };
}
/** radiant flux (W per unit colour) a spot of on-axis intensity I0 puts through its whole cone: ∫ I0·smoothstep(cosO, cosI, μ) dω = π·I0·(2 − cosI − cosO) */
export const coneFlux = (I0: number, cosI: number, cosO: number) => Math.PI * I0 * (2 - cosI - cosO);

export async function perfCards() {
  console.log('\n# torch bounce cards — geometry, energy, nomination (perf-probes.ts)\n');
  const DEG = Math.PI / 180;
  // ---- geometry: a torch 0.43 m off a wall, level-ish (the doc's scene S1); a grazing beam; a far wall; a point light
  {
    const pos: V3 = [33.0, 0.28, 4.55]; const dir = norm([0, -0.12, -1]); const cosO = Math.cos(19 * DEG);
    const t = (4.12 - pos[2]) / dir[2]; const d = cardDisc(pos, dir, cosO, t, [0, 0, 1])!;
    check(!!d && Math.abs(d.C[2] - 4.12) < 1e-9 && Math.abs(d.R - 1.15 * t * Math.tan(19 * DEG) / -dir[2]) < 1e-9 && d.R > 0.16 && d.R < 0.19, 'S1 torch 0.43 m off the wall → disc on the wall plane, R ≈ 0.17', d ? `t ${t.toFixed(3)}  C (${d.C.map(v => v.toFixed(3)).join(', ')})  R ${d.R.toFixed(3)}` : 'null');
    check(cardDisc(pos, norm([1, 0, -0.2]), cosO, 2, [0, 0, 1]) === null, 'a beam skimming the wall (incidence cos 0.2) builds no card', 'null');
    check(cardDisc(pos, dir, cosO, 6.5, [0, 0, 1]) === null, 'a wall further than CARD_TMAX down the beam builds no card', 'null');
    check(cardDisc(pos, dir, Math.cos(90 * DEG), 1, [0, 0, 1]) === null, 'a light without a real cone (cosOuter ≤ 0.3) builds no card', 'null');
    const far = cardDisc(pos, dir, cosO, 5.0, [0, 0, 1])!; check(far.R === CARD_RMAX, 'the claim radius caps at CARD_RMAX', `t 5 → R ${far.R}`);
  }
  // ---- energy: closed form vs the shader's 64 stratified cone samples vs brute force; the gather's 4-point quadrature vs brute force at receivers near and far
  {
    const I0 = 70, cosI = Math.cos(7 * DEG), cosO = Math.cos(19 * DEG), rho = 0.42;
    const closed = coneFlux(I0, cosI, cosO);
    let est = 0; const NS = 64; const dOmega = 2 * Math.PI * (1 - cosO) / NS;
    for (let j = 0; j < NS; j++) { const u = (j + 0.5) / NS; const cosA = 1 - u * (1 - cosO); est += I0 * smoothstep(cosO, cosI, cosA) * dOmega; }
    check(Math.abs(est / closed - 1) < 0.01, 'the 64 stratified cone samples reproduce the closed-form cone flux π·I0·(2 − cosI − cosO)', `closed ${closed.toFixed(4)} W · 64 samples ${est.toFixed(4)} W (${((est / closed - 1) * 100).toFixed(2)} %)`);
    // brute force: the S1 torch onto the wall plane z = 4.12 (normal +z), floor at y = 0
    const pos: V3 = [33.0, 0.28, 4.55]; const dir = norm([0, -0.12, -1]); const zw = 4.12;
    const NX = 400, NY = 240; const x0 = 32.0, x1 = 34.0, y0 = 0, y1 = 1.2; const dA = ((x1 - x0) / NX) * ((y1 - y0) / NY);
    let flux = 0, phi = 0, mx = 0, my = 0; const cells: { x: number; y: number; L: number }[] = [];
    for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
      const x = x0 + (ix + 0.5) * (x1 - x0) / NX, y = y0 + (iy + 0.5) * (y1 - y0) / NY;
      const v = sub([x, y, zw], pos); const dist = len(v); const u = scale(v, 1 / dist);
      const cosA = dot(u, dir); const f = cosA >= cosI ? 1 : cosA < cosO ? 0 : smoothstep(cosO, cosI, cosA);
      const Ein = I0 * f * Math.max(-u[2], 0) / (dist * dist);
      if (Ein <= 0) continue;
      flux += Ein * dA; const L = rho * Ein / Math.PI; phi += L * dA; mx += L * dA * x; my += L * dA * y; cells.push({ x, y, L });
    }
    check(Math.abs(flux / closed - 1) < 0.005, 'brute force: the flux landing on the wall = the cone flux (all of the cone lands on this wall)', `${flux.toFixed(4)} W vs ${closed.toFixed(4)} W`);
    check(Math.abs(phi / (rho * closed / Math.PI) - 1) < 0.005, 'radiance × area of the lit patch = ρ·Φ/π (what row 2 of the card holds; the GPU wrote 1.821 for this scene)', `${phi.toFixed(4)} vs ${(rho * closed / Math.PI).toFixed(4)}`);
    const Cq: V3 = [mx / phi, my / phi, zw]; let m2 = 0; for (const c of cells) m2 += c.L * dA * ((c.x - Cq[0]) ** 2 + (c.y - Cq[1]) ** 2); const rq = Math.sqrt(m2 / phi);
    const n: V3 = [0, 0, 1]; const T: V3 = [1, 0, 0]; const B = cross(n, T);
    let worst = 0; const rows: string[] = [];
    for (const Q of [[32.5, 0, 5.3], [33.0, 0, 5.0], [32.2, 0, 6.0], [33.5, 0, 4.6], [31.0, 0, 8.0], [33.0, 1.0, 5.5]] as V3[]) {
      const N: V3 = Q[1] > 0 ? [0, 0, -1] : [0, 1, 0];   // the last receiver: a surface facing the wall at 1 m height (a box front)
      let Et = 0; for (const c of cells) { const w = sub([c.x, c.y, zw], Q); const r = len(w); const wd = scale(w, 1 / r); Et += c.L * Math.max(dot(N, wd), 0) * Math.max(-wd[2], 0) / (r * r) * dA; }
      let g = 0; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const s = add(Cq, add(scale(T, Math.cos(a) * rq), scale(B, Math.sin(a) * rq))); const d = sub(s, Q); const r2 = dot(d, d); const L = scale(d, 1 / Math.sqrt(r2)); g += Math.max(dot(N, L), 0) * Math.max(-L[2], 0) / (r2 + 0.5 * rq * rq); }
      const Ec = phi * 0.25 * g; const err = Math.abs(Ec / Et - 1); worst = Math.max(worst, err);
      rows.push(`(${Q.join(', ')}) true ${Et.toFixed(4)} card ${Ec.toFixed(4)} (${((Ec / Et - 1) * 100).toFixed(1)} %)`);
    }
    check(worst < 0.03, 'the gather\'s 4-point card quadrature vs brute-force integration of the true patch, receivers 0.6–4 m off (floor + a facing box front): within 3 %', `Cq (${Cq.map(v => v.toFixed(3)).join(', ')}) rq ${rq.toFixed(3)} · worst ${(worst * 100).toFixed(1)} %\n    ${rows.join('\n    ')}`);
    // and what the ray path's absolute radiance cap (24 W/m²/sr in fgather.wgsl) alone costs the OLD estimator here — the doc's energy argument
    let capped = 0, uncapped = 0; const Q: V3 = [32.5, 0, 5.3];
    for (const c of cells) { const w = sub([c.x, c.y, zw], Q); const r = len(w); const wd = scale(w, 1 / r); const G = Math.max(wd[1], 0) * Math.max(-wd[2], 0) / (r * r) * dA; uncapped += c.L * G; capped += Math.min(c.L, 24) * G; }
    console.log(`  (info) the old ray estimator's absolute cap of 24 on hit radiance alone removes ${((1 - capped / uncapped) * 100).toFixed(0)} % of this bounce at (${Q.join(', ')}): peak patch radiance ${Math.max(...cells.map(c => c.L)).toFixed(1)} W/m²/sr`);
  }
  // ---- nomination: card lights by slot, steady spots only, nearest `max` to the look-at point
  {
    const mk = (o: any) => ({ kind: 1, ttl: -1, card: true, slot: 0, pos: [0, 0, 0], ...o });
    const Ls = [mk({ slot: 3, pos: [10, 0, 0] }), mk({ slot: 5, pos: [1, 0, 0] }), mk({ slot: -1, pos: [0, 0, 0] }), mk({ slot: 7, card: false }), mk({ slot: 8, kind: 0 }), mk({ slot: 9, ttl: 0.1 }), mk({ slot: 11, pos: [4, 0, 0] })];
    const all = cardSlotsFor(Ls, [0, 0, 0], 8), two = cardSlotsFor(Ls, [0, 0, 0], 2);
    check(JSON.stringify(all) === '[3,5,11]' && JSON.stringify(two) === '[5,11]', 'cardSlotsFor: uploaded steady spot card lights only (not un-slotted / non-card / point / transient), list order, nearest-first only when over the cap', `all ${JSON.stringify(all)} · max 2 ${JSON.stringify(two)}`);
  }
  console.log(`\n=== perf-cards: ${fails ? `${fails} FAIL` : 'ALL PASS'} ===`);
}

// ================================================================ flags / settings / frame block ================================================================
export async function perfFlags() {
  console.log('\n# perf pass flags — bits, defaults, presets, frame block (perf-probes.ts)\n');
  const before = fails;
  const vals = Object.entries(FrameFlags) as [string, number][];
  const distinct = new Set(vals.map(([, v]) => v)).size === vals.length && vals.every(([, v]) => v > 0 && (v & (v - 1)) === 0);
  check(distinct, 'every FrameFlags value is a distinct single bit', vals.map(([k, v]) => `${k}=${v}`).join(' '));
  check(FrameFlags.BounceCards === 33554432 && FrameFlags.DirectSeedHold === 67108864 && FrameFlags.GiAdaptiveHist === 134217728, 'BounceCards = 1<<25, DirectSeedHold = 1<<26, GiAdaptiveHist = 1<<27 (1<<22 / 1<<24 went to Decals / Particles since; bits 0‥30 are all owned now — bit 31, the sign bit, is the only one left: frame-layout prints the table)', `${FrameFlags.BounceCards} ${FrameFlags.DirectSeedHold} ${FrameFlags.GiAdaptiveHist}`);
  const S = defaultSettings();
  check(S.torchBounceCards === false && S.directSeedHold === false && S.giAdaptiveHistory === false, 'defaults: torchBounceCards off, directSeedHold off, giAdaptiveHistory off', `${S.torchBounceCards} ${S.directSeedHold} ${S.giAdaptiveHistory}`);
  const placed = Object.entries(PRESETS).map(([n, p]: [string, any]) => `${n}:${p.cards === undefined ? '—' : p.cards ? 'on' : 'off'}`).join(' ');
  console.log(`  (info) preset placement of the cards: ${placed}`);
  // the frame block: writeFrame's card words land inside FRAME_BYTES and read back
  const buf = new ArrayBuffer(FRAME_BYTES); const ident = new Float32Array(16); ident[0] = ident[5] = ident[10] = ident[15] = 1;
  const base: any = { viewProj: ident, invViewProj: ident, prevViewProj: ident, camPos: [0, 0, 0], camDir: [0, 0, -1], time: 0, dt: 0.016, width: 16, height: 16, frameIdx: 0, numLights: 0, flags: 0, exposure: 1, skyZenith: [0, 0, 0], skyHorizon: [0, 0, 0], hazeDensity: 0, rcInterval0: 1, rcC0Dims: [1, 1, 1], rcNumCascades: 1, rcD0: 4, rcFrameParity: 0, numSmoke: 0, debugView: 0, indirectScale: 1, emissiveScale: 1, volSteps: 8, capColor: [0, 0, 0, 0], post: [0, 0, 0, 1], rcJitter: [0.5, 0.5], directCfg: [1, 1, 1, 0], directAdaptiveMin: 2, numTransient: 0, secMinE: 0.01, lossyCfg: [2, 2, 0, 0], weather: noWeather(), glassCfg: [1, 1, 1, 0], volCfg: [0, 0, 0, 0], froxelA: [0.5, 56, 2, 0], froxelB: [0, 0, 0, 0], froxelC: [0, 0, 0, 0], prevCamPos: [0, 0, 0], froxelPrevNear: 0.5, rtCfg: [0.45, 1, 0.7, 0], matCfg: [1, 1, 60, 0], p5Cfg: [0, 0, 0, 0], jitter: [0, 0, 0, 0], markCfg: [0, 1, 1, 1], sharpCfg: [0, 0, 0, 0], sharpCfgB: [0, 0, 0, 0], sharpCfgC: [0, 0, 0, 0], rigCfg: [0, 20, 1, 0.006], rigCfgB: [1, 24, 0.0015, 0.012] };
  let threw = ''; try { writeFrame(buf, { ...base, cardSlots: [5, 9, 13, 2, 40, 41, 42, 43, 44] }); } catch (e) { threw = String((e as Error).message ?? e); }
  const u = new Uint32Array(buf);
  check(!threw && FRAME_BYTES >= 464 && FRAME_BYTES % 16 === 0 && u[104] === MAX_CARDS && u[108] === 5 && u[111] === 2 && u[115] === 43, 'FRAME_BYTES ≥ 464, 16-aligned: cardCfg.x @416 = count (capped at MAX_CARDS), cardSlots words 108‥115 (tools/qa/frame-layout.ts holds the whole table against common.wgsl)', `${threw ? `writeFrame threw: ${threw} · ` : ''}count ${u[104]} slots ${Array.from(u.slice(108, 116)).join(',')}`);
  writeFrame(buf, { ...base, cardSlots: [] }); check(u[104] === 0, 'no cards → cardCfg.x = 0 (the builder is not dispatched, the gather touches nothing)', `${u[104]}`);
  console.log(`\n=== perf-flags: ${fails - before ? `${fails - before} FAIL` : 'ALL PASS'} ===`);
}

/** The render-target pool's bookkeeping (render/texpool.ts, review R1.3): a size key never outlives its last parked texture — the ladder walks dozens of sizes a session and the
 *  free-list map used to keep an empty array behind every one of them. A fake device stands in (createTexture → an object with destroy()); acquire / release / evict / age paths all
 *  exercised, `keyCount` checked against the keys that really hold something after every step, and against 0 once everything is evicted. */
export async function perfTexpool() {
  console.log('\n# texture pool — free-list keys follow their contents (perf-probes.ts, review R1.3)\n');
  const before = fails;
  const { TexturePool } = await import(`${ROOT}/src/render/texpool.ts`);
  let destroyed = 0;
  const fakeDevice = { createTexture: (d: any) => ({ label: d.label, width: d.size[0], height: d.size[1], format: d.format, usage: d.usage, destroy() { destroyed++; } }) } as unknown as GPUDevice;
  const pool = new TexturePool(fakeDevice); pool.budget = 1 << 30;
  const desc = (label: string, w: number, h: number) => ({ label, size: [w, h] as [number, number], format: 'rgba16float' as GPUTextureFormat, usage: 12 });
  const trueKeys = () => { let n = 0; for (const [, list] of (pool as any).free as Map<string, unknown[]>) if (list.length) n++; return n; };
  let worst = 0; const note = () => { worst = Math.max(worst, pool.keyCount - trueKeys()); };
  // a ladder walk: 24 sizes × 3 kinds, each acquired, released, re-acquired at the next visit of that size (hits), released again
  const held: any[] = [];
  for (let round = 0; round < 3; round++) for (let s = 0; s < 24; s++) {
    const w = 800 + s * 40, h = 450 + s * 22;
    for (const kind of ['directH0', 'indHist1', 'giMom0']) { const { tex } = pool.acquire(desc(kind, w, h)); held.push([tex, desc(kind, w, h)]); note(); }
    while (held.length > 6) { const [tex, d] = held.shift(); pool.release(tex, d); note(); }
  }
  check(pool.stats.hits > 0 && pool.stats.misses > 0, 'the walk both created and reused targets', `${pool.stats.hits} hits ${pool.stats.misses} misses`);
  check(worst === 0, 'keyCount never exceeds the keys that hold a parked texture (acquire path)', `worst excess ${worst}, now ${pool.keyCount} keys / ${pool.parkedCount} parked`);
  // budget eviction: shrink the budget under what is parked → destroyHead runs; keys must follow
  pool.budget = Math.floor(pool.parkedBytes / 3); pool.evict(); note();
  check(worst === 0 && pool.parkedBytes <= pool.budget, 'budget eviction keeps keys in step and lands under budget', `${pool.keyCount} keys / ${pool.parkedCount} parked, ${(pool.parkedBytes / 1048576).toFixed(1)} MB ≤ ${(pool.budget / 1048576).toFixed(1)} MB`);
  // ageing: everything parked long ago goes
  pool.tick(performance.now() + pool.maxAgeMs + 1); note();
  check(pool.keyCount === 0 && pool.parkedCount === 0 && pool.parkedBytes === 0, 'ageing out everything leaves no keys, no parked bytes', `${pool.keyCount} keys / ${pool.parkedCount} parked / ${pool.parkedBytes} B`);
  for (const [tex, d] of held) pool.release(tex, d); held.length = 0; note();
  pool.evict(true); note();
  check(pool.keyCount === 0 && pool.parkedCount === 0 && worst === 0, 'evict(everything) leaves an empty map', `${pool.keyCount} keys, ${destroyed} textures destroyed in all`);
  console.log(`\ntexpool: ${fails - before ? `${fails - before} FAIL` : 'ALL PASS'}`);
  return fails === before;
}

if (import.meta.main) {
  const which = process.argv[2] ?? 'all';
  if (which === 'cards' || which === 'all') await perfCards();
  if (which === 'flags' || which === 'all') await perfFlags();
  if (which === 'texpool' || which === 'all') await perfTexpool();
  if (fails) process.exitCode = 1;
}
