// What the trace grid's "globals" (huge boxes slab-tested once per ray before the DDA) and its thin horizontal slabs (floor finishes, and in general
// the surface a ray starts from) cost per ray, and what settings.gridSlabs (frame flag 1048576) saves: (b) a per-global segment/AABB reject on all
// three axes with a 5 mm pad instead of the y-only 4 cm test, (a) the per-cell height span judged 3.5 cm tighter at both ends (an effective 5 mm item
// pad, no data change). Measured on a CPU port of common.wgsl's three trace functions (traceClosest / occluded / occludedT) over the REAL packed grid
// the game uploads, for ray sets shaped like the passes that trace (final gather, direct shadow rays, secondary shadow rays at cascade / gather hits,
// cascade intervals, volumetric in-scattering, exterior). Arithmetic is f64 on f32-rounded inputs: this validates the culling LOGIC and counts work;
// bit-level exactness is argued above traceClosest in common.wgsl and A/B'd on the GPU (final / direct-only / indirect-only must be identical).
//   bun run tools/qa/grid-globals.ts [--rays N] [--only <set-name prefix>] [--shrink <m>] [--gpad <m>]
// (--shrink / --gpad override the uploaded span shrink / rebuild the global bounds with another pad: past 0.040 / below 0 the modes DO start to
// disagree on the nasty and cascade sets — the sim can see a wrong cull, and that is where the logic's edge sits; the shipped 0.035 / +0.005 stand
// 5 mm inside it, against < 0.4 mm of GPU float differences.)
// Prints the globals with their sizes, the biggest grid footprints, items per occupied cell and the thin-slab share of the item slots; then per ray set
// and per mode — today · globals (b alone) · shrink (a alone) · slabs (a+b: what the flag switches on) · nocull (every global, no height cull at all) —
// global slab tests per ray (and how many answer "hit"), grid box tests per ray (and how many land on thin slabs / miss), cells walked, and a check that
// every mode returns the same answer for every ray.
import { standUp, ROOT } from './headless';

const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { BoxWorld, BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const NR = Number(arg('--rays', '20000')); const ONLY = arg('--only', '');

const Wd = await standUp();
for (let i = 0; i < 5; i++) Wd.step(1 / 60);
const world = Wd.engine.world;
const W = WORLD.gridW, H = WORLD.gridH, N = W * H, CB = N + 1;
const cells: Uint32Array = world.cellStart, items: Uint32Array = world.items, itemsB: number = world.infoData[23];
const { MAT_STRIDE } = await import(`${ROOT}/src/scene/boxes.ts`);
const geoF: Float32Array = world.geoF32, geoU: Uint32Array = world.geoU32, mat: Float32Array = world.matData, infoF: Float32Array = world.infoF32, infoU: Uint32Array = world.infoData;
const globals: number[] = world.globals;
const f = Math.fround;
const SHRINK = f(Number(arg('--shrink', String(infoF[89] || 0.035))));   // SceneInfo.grid.y as uploaded (WORLD.gridYPad − BoxWorld.ITEM_PAD_KEEP), else the intended 3.5 cm
type V3 = [number, number, number];

// ================================================================ static picture ================================================================
const THIN = 0.02;   // "thin horizontal slab": h.y ≤ 2 cm (floor finishes 2 mm, shelf boards 15 mm, keyboards 12 mm)
const cellsOf = (b: any) => { const [ex, ez] = BoxWorld.footprint(b); const x0 = Math.max(0, Math.floor(b.c[0] - ex)), x1 = Math.min(W - 1, Math.floor(b.c[0] + ex)), z0 = Math.max(0, Math.floor(b.c[2] - ez)), z1 = Math.min(H - 1, Math.floor(b.c[2] + ez)); return { x0, x1, z0, z1, area: x1 < x0 || z1 < z0 ? 0 : (x1 - x0 + 1) * (z1 - z0 + 1) }; };
const desc = (b: any) => `c (${b.c.map((v: number) => v.toFixed(2)).join(', ')})  h (${b.h.map((v: number) => v.toFixed(3)).join(', ')})  y [${(b.c[1] - BoxWorld.heightExtent(b)).toFixed(3)}, ${(b.c[1] + BoxWorld.heightExtent(b)).toFixed(3)}]${b.name ? '  ' + b.name : ''}`;
console.log(`boxes: ${world.statics.length} static + ${world.dynamics.length} dynamic; grid ${W}×${H}; ${itemsB} item slots; ${globals.length} globals (footprint > 96 cells, max 16):`);
for (const gi of globals) { const b = world.all[gi]; const cf = cellsOf(b); console.log(`  #${String(gi).padStart(4)}  ${String(cf.area).padStart(4)} cells  ${desc(b)}`); }
let occ = 0, thinSlots = 0, decalSlots = 0;
for (let c = 0; c < N; c++) if (cells[c + 1] > cells[c]) occ++;
for (let k = 0; k < itemsB; k++) { const hy = geoF[items[k] * 8 + 5]; if (hy <= THIN) thinSlots++; if (hy <= 0.005) decalSlots++; }
console.log(`occupied cells ${occ}/${N}; items per occupied cell ${(itemsB / occ).toFixed(2)} (busiest ${world.gridStats.maxPerCell}); item slots on thin slabs (h.y ≤ ${THIN * 100} cm): ${thinSlots} (${(100 * thinSlots / itemsB).toFixed(1)} %), on decals (h.y ≤ 5 mm): ${decalSlots} (${(100 * decalSlots / itemsB).toFixed(1)} %)`);
const per: { i: number; area: number; b: any }[] = [];
for (let i = 0; i < world.all.length; i++) { const b = world.all[i]; if ((b.flags & BoxFlag.NoShadow) || globals.includes(i)) continue; const cf = cellsOf(b); if (cf.area) per.push({ i, area: cf.area, b }); }
per.sort((a, b) => b.area - a.area);
console.log('largest grid footprints:'); for (const p of per.slice(0, 12)) console.log(`  #${String(p.i).padStart(4)}  ${String(p.area).padStart(4)} cells  ${desc(p.b)}${p.b.h[1] <= THIN ? '  ← thin slab' : ''}`);

// ================================================================ the traversal (port of common.wgsl) ================================================================
const YQ0 = f(WORLD.gridY0), YQS = f(WORLD.gridYLevels / (WORLD.gridY1 - WORLD.gridY0)), YQMAX = WORLD.gridYLevels - 1;
const half = (hb: number) => { const s = (hb & 0x8000) ? -1 : 1, e = (hb >> 10) & 31, m = hb & 1023; return e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15); };
const stats = { globalTests: 0, globalHits: 0, boxTests: 0, thinTests: 0, thinMisses: 0, cells: 0, cellLoads: 0, itemLoads: 0 };   // cellLoads = second-word (item range) loads; itemLoads = packed item words read
const safeInv = (v: number) => Math.abs(v) < 1e-20 ? 1e20 : f(1 / v);
function quatRot(q: number[], v: V3): V3 { const tx = 2 * (q[1] * v[2] - q[2] * v[1]), ty = 2 * (q[2] * v[0] - q[0] * v[2]), tz = 2 * (q[0] * v[1] - q[1] * v[0]); return [v[0] + q[3] * tx + (q[1] * tz - q[2] * ty), v[1] + q[3] * ty + (q[2] * tx - q[0] * tz), v[2] + q[3] * tz + (q[0] * ty - q[1] * tx)]; }
function isectBox(ro: V3, rd: V3, bi: number, tmax: number): [number, number] {
  const o = bi * 8; const c: V3 = [geoF[o], geoF[o + 1], geoF[o + 2]]; const rot = geoU[o + 3]; const h: V3 = [geoF[o + 4], geoF[o + 5], geoF[o + 6]]; const flags = geoU[o + 7];
  const p: V3 = [f(ro[0] - c[0]), f(ro[1] - c[1]), f(ro[2] - c[2])];
  let lo: V3, ld: V3;
  if (flags & 64) { const m = bi * MAT_STRIDE; const q = [mat[m + 8], mat[m + 9], mat[m + 10], mat[m + 11]]; const qi = [-q[0], -q[1], -q[2], q[3]]; lo = quatRot(qi, p).map(f) as V3; ld = quatRot(qi, rd).map(f) as V3; }
  else { const cx = half(rot & 0xffff), cy = half(rot >>> 16); lo = [f(f(cx * p[0]) - f(cy * p[2])), p[1], f(f(cy * p[0]) + f(cx * p[2]))]; ld = [f(f(cx * rd[0]) - f(cy * rd[2])), rd[1], f(f(cy * rd[0]) + f(cx * rd[2]))]; }
  const inv = [safeInv(ld[0]), safeInv(ld[1]), safeInv(ld[2])];
  const tmn: number[] = [], tmx: number[] = [];
  for (let a = 0; a < 3; a++) { const tA = f(f(-h[a] - lo[a]) * inv[a]), tB = f(f(h[a] - lo[a]) * inv[a]); tmn[a] = Math.min(tA, tB); tmx[a] = Math.max(tA, tB); }
  const tN = Math.max(tmn[0], tmn[1], tmn[2]), tF = Math.min(tmx[0], tmx[1], tmx[2]);
  if (tN > tF || tF < 0 || tN > tmax) return [-1, 0];
  if (tN < 0) return [0, 7];
  let code = 4 + (ld[2] > 0 ? 1 : 0);
  if (tN === tmn[0]) code = ld[0] > 0 ? 1 : 0; else if (tN === tmn[1]) code = 2 + (ld[1] > 0 ? 1 : 0);
  return [tN, code];
}
const perBox = { tests: new Uint32Array(world.all.length), misses: new Uint32Array(world.all.length) };   // per box index, for the mode being run (reset per mode; reported for 'slabs')
const gridBoxTest = (ro: V3, rd: V3, bi: number, tmax: number) => { stats.boxTests++; const r = isectBox(ro, rd, bi, tmax); perBox.tests[bi]++; if (r[0] < 0) perBox.misses[bi]++; if (geoF[bi * 8 + 5] <= THIN) { stats.thinTests++; if (r[0] < 0) stats.thinMisses++; } return r; };
const owner = (bi: number) => (geoU[bi * 8 + 7] >> 8) & 0xff;
const skips = (own: number, skip: number) => own !== 0 && (own === (skip & 0xff) || own === ((skip >> 8) & 0xff));
const gridYq = (y: number) => Math.floor(Math.min(Math.max(f(f(y - YQ0) * YQS), 0), YQMAX));
const sliceMask = (qlo: number, qhi: number) => { const slo = Math.floor(qlo / 10), shi = Math.floor(qhi / 10); return ((0xffffff >>> (23 - (shi - slo))) << slo) >>> 0; };

// Per-global bounds for the reject: what boxes.ts uploads in SceneInfo.globalsB (2 vec4f per global from word 92: min.xyz, max.xyz) when this tree has it,
// else built here the same way (world AABB of the box widened by GLOBAL_PAD + the grid's registration slack).
const gB = new Float32Array(16 * 8); const GPAD = arg('--gpad', '');
if (!GPAD && infoU.length >= 92 + 16 * 8 && globals.length && infoF[92 + 4] > infoF[92]) { gB.set(infoF.subarray(92, 92 + 16 * 8)); console.log('(global bounds: SceneInfo.globalsB as uploaded)'); }
else {
  const p = Number(GPAD || 5e-3) + world.gridStats.slack;
  for (let g = 0; g < globals.length; g++) { const b = world.all[globals[g]]; const [ex, ez] = BoxWorld.footprint(b); const ey = BoxWorld.heightExtent(b); gB.set([b.c[0] - ex - p, b.c[1] - ey - p, b.c[2] - ez - p, 0, b.c[0] + ex + p, b.c[1] + ey + p, b.c[2] + ez + p, 0].map(f), g * 8); }
  console.log(GPAD ? `(global bounds: rebuilt by the script with pad ${GPAD} m)` : '(global bounds: built by the script — boxes.ts does not upload globalsB in this tree)');
}

// today: y-cull as shipped this morning (globals by their 4 cm y extent, cells / items by the ray's height span as is); globals: (b) alone; shrink: (a) alone;
// slabs: both = FLAG_GRID_SLABS; nocull: FLAG_GRID_YCULL off as well (every global, every registered item).
interface Mode { name: string; g: 'all' | 'y' | 'box'; shrink: number; ycull: boolean }
const MODES: Mode[] = [{ name: 'today', g: 'y', shrink: 0, ycull: true }, { name: 'globals', g: 'box', shrink: 0, ycull: true }, { name: 'shrink', g: 'y', shrink: SHRINK, ycull: true }, { name: 'slabs', g: 'box', shrink: SHRINK, ycull: true }, { name: 'nocull', g: 'all', shrink: 0, ycull: false }];
let M: Mode = MODES[0];
const globalMissesY = (g: number, ylo: number, yhi: number) => infoF[57 + 2 * g] < ylo || infoF[56 + 2 * g] > yhi;
const globalOutside = (g: number, lo: V3, hi: V3) => { const o = g * 8; return gB[o + 4] < lo[0] || gB[o + 5] < lo[1] || gB[o + 6] < lo[2] || gB[o] > hi[0] || gB[o + 1] > hi[1] || gB[o + 2] > hi[2]; };
/** the globals loop shared by all three functions: which globals get slab-tested for a ray over [0, tmax] under the current mode */
function liveGlobals(ro: V3, rd: V3, tmax: number): number[] {
  const far: V3 = [f(ro[0] + f(rd[0] * tmax)), f(ro[1] + f(rd[1] * tmax)), f(ro[2] + f(rd[2] * tmax))];
  const lo: V3 = [Math.min(ro[0], far[0]), Math.min(ro[1], far[1]), Math.min(ro[2], far[2])], hi: V3 = [Math.max(ro[0], far[0]), Math.max(ro[1], far[1]), Math.max(ro[2], far[2])];
  const out: number[] = [];
  for (let g = 0; g < globals.length; g++) {
    if (M.g === 'y' && globalMissesY(g, lo[1], hi[1])) continue;
    if (M.g === 'box' && globalOutside(g, lo, hi)) continue;
    out.push(globals[g]);
  }
  return out;
}
const globalTest = (ro: V3, rd: V3, bi: number, tmax: number) => { stats.globalTests++; const r = isectBox(ro, rd, bi, tmax); perBox.tests[bi]++; if (r[0] >= 0) stats.globalHits++; else perBox.misses[bi]++; return r; };
interface Walk { start: number; end: number; qlo: number; qhi: number }
function gridCell(ci: number, ya: number, yb: number, st: { run: number }): Walk {
  const w = { start: 0, end: 0, qlo: 0, qhi: 255 };
  if (st.run > 0) { st.run--; return w; }
  const w0 = cells[CB + 2 * ci];
  const dist = w0 >>> 24;
  if (dist > 0) { st.run = dist - 1; return w; }
  let m = 0xffffff, need = 1;   // an ordered span needs any of its slices in the cell; a crossed one (shrunk past itself) needs the whole hull
  if (M.ycull) { w.qlo = gridYq(f(Math.min(ya, yb) + M.shrink)); w.qhi = gridYq(f(Math.max(ya, yb) - M.shrink)); m = sliceMask(Math.min(w.qlo, w.qhi), Math.max(w.qlo, w.qhi)); need = w.qlo > w.qhi ? m : 1; }
  if (((w0 & m) >>> 0) < need) return w;
  const w1 = cells[CB + 2 * ci + 1]; stats.cellLoads++; w.start = w1 & 0xffffff; const n = w1 >>> 24; w.end = n === 255 ? cells[ci + 1] : w.start + n;
  return w;
}
function gridItem(k: number, w: Walk): number { stats.itemLoads++; if (!M.ycull) return items[k]; const it = items[itemsB + k]; if ((it >>> 24) < w.qlo || ((it >>> 16) & 255) > w.qhi) return -1; return it & 0xffff; }
const WMIN = WORLD.min, WMAX = WORLD.max;
function bounds(ro: V3, inv: number[]) { let t0 = -Infinity, t1 = Infinity; for (let a = 0; a < 3; a++) { const ta = f(f(WMIN[a] - ro[a]) * inv[a]), tb = f(f(WMAX[a] - ro[a]) * inv[a]); t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb)); } return [t0, t1]; }
function ddaSetup(ro: V3, rd: V3, invRd: number[], tbx: number) {
  const t0 = Math.max(tbx, 0); const p: V3 = [f(ro[0] + f(rd[0] * t0)), f(ro[1] + f(rd[1] * t0)), f(ro[2] + f(rd[2] * t0))];
  const cell = [Math.min(Math.max(Math.floor(p[0]), 0), W - 1), Math.min(Math.max(Math.floor(p[2]), 0), H - 1)];
  const stp = [rd[0] >= 0 ? 1 : -1, rd[2] >= 0 ? 1 : -1]; const tDelta = [f(Math.abs(invRd[0])), f(Math.abs(invRd[2]))];
  const nb = [cell[0] + (rd[0] >= 0 ? 1 : 0), cell[1] + (rd[2] >= 0 ? 1 : 0)];
  const tNext = [Math.abs(rd[0]) < 1e-20 ? 1e30 : f(t0 + f(f(nb[0] - p[0]) * invRd[0])), Math.abs(rd[2]) < 1e-20 ? 1e30 : f(t0 + f(f(nb[1] - p[2]) * invRd[2]))];
  return { t0, cell, stp, tDelta, tNext };
}
const SLACK = infoF[88] / WORLD.gridCell;
function traceClosest(ro: V3, rd: V3, tmaxIn: number, skipOwner: number): string {
  const invRd = [safeInv(rd[0]), safeInv(rd[1]), safeInv(rd[2])];
  const [tbx, tby] = bounds(ro, invRd); if (tbx > tby || tby < 0) return `${tmaxIn},-1,0`;
  const tmax = Math.min(tmaxIn, tby); let ht = tmax, hidx = -1, code = 0, found = false;
  for (const bi of liveGlobals(ro, rd, tmax)) { const r = globalTest(ro, rd, bi, ht); if (r[0] >= 0 && r[0] < ht) { ht = r[0]; hidx = bi; code = r[1]; found = true; } }
  const st = { run: 0 }; const d = ddaSetup(ro, rd, invRd, tbx); let tCell = d.t0; const cell = d.cell, tNext = d.tNext; let tBack = 0;
  for (let iter = 0; iter < 96; iter++) {
    if (tCell > ht) break;
    stats.cells++;
    const ci = cell[1] * W + cell[0];
    const cw = M.ycull ? gridCell(ci, f(ro[1] + f(rd[1] * Math.max(f(tCell - tBack), d.t0))), f(ro[1] + f(rd[1] * ht)), st) : { start: cells[ci], end: cells[ci + 1], qlo: 0, qhi: 255 };
    for (let k = cw.start; k < cw.end; k++) {
      const gi = gridItem(k, cw); if (gi < 0 || skips(owner(gi), skipOwner)) continue;
      const r = gridBoxTest(ro, rd, gi, ht); if (r[0] >= 0 && r[0] < ht) { ht = r[0]; hidx = gi; code = r[1]; found = true; }
    }
    if (tNext[0] < tNext[1]) { tCell = tNext[0]; tNext[0] = f(tNext[0] + d.tDelta[0]); cell[0] += d.stp[0]; tBack = f(d.tDelta[0] * SLACK); } else { tCell = tNext[1]; tNext[1] = f(tNext[1] + d.tDelta[1]); cell[1] += d.stp[1]; tBack = f(d.tDelta[1] * SLACK); }
    if (tCell > tmax || cell[0] < 0 || cell[1] < 0 || cell[0] >= W || cell[1] >= H) break;
  }
  return found ? `${ht},${hidx},${code}` : `${tmaxIn},-1,0`;
}
function occluded(ro: V3, rd: V3, tmaxIn: number, skipOwner: number): string {
  const invRd = [safeInv(rd[0]), safeInv(rd[1]), safeInv(rd[2])];
  const [tbx, tby] = bounds(ro, invRd); if (tbx > tby || tby < 0) return 'false';
  const tmax = Math.min(tmaxIn, tby);
  for (const bi of liveGlobals(ro, rd, tmax)) { const r = globalTest(ro, rd, bi, tmax); if (r[0] >= 0) return 'true'; }
  const st = { run: 0 }; const yEnd = f(ro[1] + f(rd[1] * tmax)); const d = ddaSetup(ro, rd, invRd, tbx); let tCell = d.t0; const cell = d.cell, tNext = d.tNext; let tBack = 0;
  for (let iter = 0; iter < 96; iter++) {
    stats.cells++;
    const ci = cell[1] * W + cell[0];
    const cw = M.ycull ? gridCell(ci, f(ro[1] + f(rd[1] * Math.max(f(tCell - tBack), d.t0))), yEnd, st) : { start: cells[ci], end: cells[ci + 1], qlo: 0, qhi: 255 };
    for (let k = cw.start; k < cw.end; k++) {
      const gi = gridItem(k, cw); if (gi < 0 || skips(owner(gi), skipOwner)) continue;
      const r = gridBoxTest(ro, rd, gi, tmax); if (r[0] >= 0) return 'true';
    }
    if (tNext[0] < tNext[1]) { tCell = tNext[0]; tNext[0] = f(tNext[0] + d.tDelta[0]); cell[0] += d.stp[0]; tBack = f(d.tDelta[0] * SLACK); } else { tCell = tNext[1]; tNext[1] = f(tNext[1] + d.tDelta[1]); cell[1] += d.stp[1]; tBack = f(d.tDelta[1] * SLACK); }
    if (tCell > tmax || cell[0] < 0 || cell[1] < 0 || cell[0] >= W || cell[1] >= H) break;
  }
  return 'false';
}
function occludedT(ro: V3, rd: V3, tmaxIn: number, skipOwner: number): string {
  const invRd = [safeInv(rd[0]), safeInv(rd[1]), safeInv(rd[2])];
  const [tbx, tby] = bounds(ro, invRd); if (tbx > tby || tby < 0) return '-1';
  const tmax = Math.min(tmaxIn, tby);
  for (const bi of liveGlobals(ro, rd, tmax)) { const r = globalTest(ro, rd, bi, tmax); if (r[0] >= 0) return String(r[0]); }
  const st = { run: 0 }; const yEnd = f(ro[1] + f(rd[1] * tmax)); const d = ddaSetup(ro, rd, invRd, tbx); let tCell = d.t0; const cell = d.cell, tNext = d.tNext; let tBack = 0;
  for (let iter = 0; iter < 96; iter++) {
    stats.cells++;
    const ci = cell[1] * W + cell[0];
    const cw = M.ycull ? gridCell(ci, f(ro[1] + f(rd[1] * Math.max(f(tCell - tBack), d.t0))), yEnd, st) : { start: cells[ci], end: cells[ci + 1], qlo: 0, qhi: 255 };
    let best = -1;
    for (let k = cw.start; k < cw.end; k++) {
      const gi = gridItem(k, cw); if (gi < 0 || skips(owner(gi), skipOwner)) continue;
      const r = gridBoxTest(ro, rd, gi, tmax); if (r[0] >= 0 && (best < 0 || r[0] < best)) best = r[0];
    }
    if (best >= 0) return String(best);
    if (tNext[0] < tNext[1]) { tCell = tNext[0]; tNext[0] = f(tNext[0] + d.tDelta[0]); cell[0] += d.stp[0]; tBack = f(d.tDelta[0] * SLACK); } else { tCell = tNext[1]; tNext[1] = f(tNext[1] + d.tDelta[1]); cell[1] += d.stp[1]; tBack = f(d.tDelta[1] * SLACK); }
    if (tCell > tmax || cell[0] < 0 || cell[1] < 0 || cell[0] >= W || cell[1] >= H) break;
  }
  return '-1';
}

// ================================================================ ray sets shaped like the passes ================================================================
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const randDir = (): V3 => { const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: V3): V3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
const cosineAbout = (n: V3): V3 => { const up: V3 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; const T = norm(cross(up, n)), B = cross(n, T); const r = Math.sqrt(rnd()), a = rnd() * 6.2831853, c = Math.sqrt(Math.max(1 - r * r, 0)); return norm([T[0] * Math.cos(a) * r + B[0] * Math.sin(a) * r + n[0] * c, T[1] * Math.cos(a) * r + B[1] * Math.sin(a) * r + n[1] * c, T[2] * Math.cos(a) * r + B[2] * Math.sin(a) * r + n[2] * c]); };
const lights = Wd.engine.lights.lights.filter((l: any) => l.enabled && l.kind !== 2 && l.intensity > 0);
// Receivers (P, N) as the G-buffer / interval hits see them: what a top-down camera over the interior mostly rasterises is floor (its finish where there
// is one — found by casting down), desk and table tops, and wall faces.
type Recv = { P: V3; N: V3 };
const under = (x: number, z: number): Recv => { const hit = world.raycast([x, 2.0, z], [0, -1, 0], 10, BoxFlag.NoShadow); return { P: [x, hit ? 2.0 - hit.t : 0, z], N: [0, 1, 0] }; };   // whatever is under (x, z) at 2 m: floor finish, desk top, sofa…
const interiorXZ = (): [number, number] => [4.3 + rnd() * 31.4, 4.3 + rnd() * 19.4];
const exteriorXZ = (): [number, number] => { for (;;) { const x = 0.5 + rnd() * 39, z = 0.5 + rnd() * 27; if (!(x > 3.8 && x < 36.2 && z > 3.8 && z < 24.2)) return [x, z]; } };
const wallPoint = (): Recv => { for (;;) { const b = world.all[Math.floor(rnd() * world.statics.length)]; if ((b.flags & BoxFlag.NoShadow) || b.rot || b.h[1] < 0.3 || Math.abs(b.yaw) > 1e-9) continue; const ax = rnd() < 0.5 ? 0 : 2, sg = rnd() < 0.5 ? -1 : 1; const P: V3 = [b.c[0] + (rnd() * 2 - 1) * b.h[0], Math.max(0.05, Math.min(2.9, b.c[1] + (rnd() * 2 - 1) * b.h[1])), b.c[2] + (rnd() * 2 - 1) * b.h[2]]; P[ax] = b.c[ax] + sg * b.h[ax]; const N: V3 = [0, 0, 0]; N[ax] = sg; if (P[0] < 0.2 || P[0] > 39.8 || P[2] < 0.2 || P[2] > 27.8) continue; return { P, N }; } };
/** a light in range on the receiver's side (any side for N = 0), as the scoring loops would hand the shadow ray: direction and tmax = distance − offEnd */
const toLight = (Po: V3, N: V3, offEnd: number): { rd: V3; tmax: number } | null => { for (let tries = 0; tries < 50; tries++) { const li: any = pick(lights); const d: V3 = [li.pos[0] - Po[0], li.pos[1] - Po[1], li.pos[2] - Po[2]]; const dist = Math.hypot(...d); if (dist > li.range || dist < 0.25) continue; const rd: V3 = [d[0] / dist, d[1] / dist, d[2] / dist]; if ((N[0] || N[1] || N[2]) && rd[0] * N[0] + rd[1] * N[1] + rd[2] * N[2] <= 0) continue; return { rd, tmax: dist - offEnd }; } return null; };
type Ray = { ro: V3; rd: V3; tmax: number; fn: 'closest' | 'occ' | 'occT' };
type RaySet = { name: string; note: string; gen: () => Ray | null };
const off = (r: Recv, d: number): V3 => [r.P[0] + r.N[0] * d, r.P[1] + r.N[1] * d, r.P[2] + r.N[2] * d];
const NASTY_DIRS: V3[] = []; for (const sx of [-1, 0, 1]) for (const sy of [-1, -1e-4, 0, 1e-4, 1]) for (const sz of [-1, 0, 1]) if (sx || sy || sz) NASTY_DIRS.push(norm([sx, sy, sz]));
const sets: RaySet[] = [
  { name: 'gather-floor', note: 'final gather from interior floor points (fgather main: Po = P + N·0.02, cosine dirs, 40 m, traceClosest)', gen: () => { const r = under(...interiorXZ()); if (r.P[1] > 0.05) return null; return { ro: off(r, 0.02), rd: cosineAbout(r.N), tmax: 40, fn: 'closest' }; } },
  { name: 'gather-tops', note: 'final gather from whatever is under a random interior (x, z) that is NOT floor — desk / table / counter tops (same recipe)', gen: () => { const r = under(...interiorXZ()); if (r.P[1] <= 0.05) return null; return { ro: off(r, 0.02), rd: cosineAbout(r.N), tmax: 40, fn: 'closest' }; } },
  { name: 'gather-walls', note: 'final gather from wall / partition / furniture side faces (vertical N), cosine dirs', gen: () => { const r = wallPoint(); return { ro: off(r, 0.02), rd: cosineAbout(r.N), tmax: 40, fn: 'closest' }; } },
  { name: 'shadow-floor', note: 'direct-pass shadow rays from interior floor points to a light in range (direct.wgsl: Po = P + N·0.015, tmax = d − 0.03, occludedT)', gen: () => { const r = under(...interiorXZ()); if (r.P[1] > 0.05) return null; const ro = off(r, 0.015); const l = toLight(ro, r.N, 0.03); return l && { ro, ...l, fn: 'occT' }; } },
  { name: 'shadow-tops', note: 'direct-pass shadow rays from desk / table tops', gen: () => { const r = under(...interiorXZ()); if (r.P[1] <= 0.05) return null; const ro = off(r, 0.015); const l = toLight(ro, r.N, 0.03); return l && { ro, ...l, fn: 'occT' }; } },
  { name: 'shadow-walls', note: 'direct-pass shadow rays from wall faces', gen: () => { const r = wallPoint(); const ro = off(r, 0.015); const l = toLight(ro, r.N, 0.03); return l && { ro, ...l, fn: 'occT' }; } },
  { name: 'secondary-floor', note: 'shadow rays at cascade-interval / gather hits on the floor (directIrradiance: Po = P + N·0.01, tmax = d − 0.02, occluded)', gen: () => { const r = under(...interiorXZ()); if (r.P[1] > 0.05) return null; const ro = off(r, 0.01); const l = toLight(ro, r.N, 0.02); return l && { ro, ...l, fn: 'occ' }; } },
  { name: 'secondary-walls', note: 'shadow rays at interval / gather hits on walls (occluded)', gen: () => { const r = wallPoint(); const ro = off(r, 0.01); const l = toLight(ro, r.N, 0.02); return l && { ro, ...l, fn: 'occ' }; } },
  { name: 'cascade', note: 'radiance-cascade intervals: probe lattice points at the 4 layer heights, uniform dirs, [T_n, T_n + 0.6·4^n] for n = 0..3 (traceClosest)', gen: () => { const n = Math.floor(rnd() * 4); const sp = 1 << n; const ro0: V3 = [(Math.floor(rnd() * (40 >> n)) + 0.5) * sp, [0.375, 1.125, 1.875, 2.625][Math.floor(rnd() * 4)], (Math.floor(rnd() * (28 >> n)) + 0.5) * sp]; const rd = randDir(); const t0 = 0.6 * (4 ** n - 1) / 3; const ro: V3 = [ro0[0] + rd[0] * t0, ro0[1] + rd[1] * t0, ro0[2] + rd[2] * t0]; if (ro[0] < 0 || ro[0] > 40 || ro[1] < -0.25 || ro[1] > 8 || ro[2] < 0 || ro[2] > 28) return null; return { ro, rd, tmax: 0.6 * 4 ** n, fn: 'closest' }; } },
  { name: 'volumetric', note: 'in-scattering shadow rays from points in the interior air (y 0.1..2.9) to a light in range (occluded)', gen: () => { const [x, z] = interiorXZ(); const ro: V3 = [x, 0.1 + rnd() * 2.8, z]; const l = toLight(ro, [0, 0, 0], 0.07); return l && { ro, ...l, fn: 'occ' }; } },
  { name: 'exterior-ground', note: 'final gather from car park / lawn ground points (y = 0 + 0.02), cosine-up', gen: () => { const r = under(...exteriorXZ()); return { ro: off(r, 0.02), rd: cosineAbout(r.N), tmax: 40, fn: 'closest' }; } },
  { name: 'exterior-shadow', note: 'direct-pass shadow rays from exterior ground points to the street lamps / anything in range (occludedT)', gen: () => { const r = under(...exteriorXZ()); const ro = off(r, 0.015); const l = toLight(ro, r.N, 0.03); return l && { ro, ...l, fn: 'occT' }; } },
  { name: 'nasty', note: 'cell-centre / on-line origins at slab heights (floor ±, ceiling ±), axis + diagonal + near-horizontal dirs, all three functions — boundary probing', gen: () => ({ ro: [Math.floor(rnd() * 40) + pick([0, 0.5, 0.999]), pick([0.0005, 0.001, 0.002, 0.004, 0.0041, 0.006, 0.01, 0.02, 0.05, 2.96, 3.0, 3.1, 3.2, 3.25, -0.1, -0.2499]), Math.floor(rnd() * 28) + pick([0, 0.5, 0.999])], rd: pick(NASTY_DIRS), tmax: pick([0.3, 1, 4, 12, 40]), fn: pick(['closest', 'occ', 'occT'] as const) }) },
  { name: 'nasty-inside', note: 'origins inside / on the faces of random boxes (many inside walls and furniture), uniform dirs, all three functions', gen: () => { const b = world.all[Math.floor(rnd() * world.statics.length)]; const ro: V3 = [b.c[0] + (rnd() * 2 - 1) * b.h[0], b.c[1] + (rnd() * 2 - 1) * b.h[1], b.c[2] + (rnd() * 2 - 1) * b.h[2]]; if (rnd() < 0.5) { const ax = Math.floor(rnd() * 3); ro[ax] = b.c[ax] + (rnd() < 0.5 ? -1 : 1) * b.h[ax]; } return { ro, rd: randDir(), tmax: 0.5 + rnd() * 30, fn: pick(['closest', 'occ', 'occT'] as const) }; } },
];

// ================================================================ run ================================================================
console.log(`\n${lights.length} lights; ${NR} rays per set; span shrink ${SHRINK} m; modes: ${MODES.map(m => m.name).join(' · ')}\n(columns: global slab tests / ray → of which hit · grid box tests / ray → of which on thin slabs (misses) · cells walked / ray (item-range loads, packed item words read) · all slab tests / ray)`);
let mismatches = 0; const summary: string[] = [];
for (const set of sets.filter(s => !ONLY || s.name.startsWith(ONLY))) {
  const rays: Ray[] = []; let guard = 0;
  while (rays.length < NR && guard++ < NR * 50) { const r = set.gen(); if (r && r.tmax > 0) rays.push({ ...r, ro: r.ro.map(f) as V3, rd: r.rd.map(f) as V3, tmax: f(r.tmax) }); }
  console.log(`\n== ${set.name}: ${set.note}`);
  const results: string[][] = []; const tot: Record<string, string> = {};
  for (const m of MODES) {
    M = m; for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 0; perBox.tests.fill(0); perBox.misses.fill(0);
    const res: string[] = [];
    for (const r of rays) res.push(r.fn === 'closest' ? traceClosest(r.ro, r.rd, r.tmax, 0) : r.fn === 'occ' ? occluded(r.ro, r.rd, r.tmax, 0) : occludedT(r.ro, r.rd, r.tmax, 0));
    results.push(res);
    const n = rays.length; const all = (stats.globalTests + stats.boxTests) / n;
    console.log(`  ${m.name.padEnd(8)} globals ${(stats.globalTests / n).toFixed(2)} → hit ${(stats.globalHits / n).toFixed(2)}   grid ${(stats.boxTests / n).toFixed(2)} → thin ${(stats.thinTests / n).toFixed(2)} (miss ${(stats.thinMisses / n).toFixed(2)})   cells ${(stats.cells / n).toFixed(2)} (ranges ${(stats.cellLoads / n).toFixed(2)}, items ${(stats.itemLoads / n).toFixed(2)})   all ${all.toFixed(2)}`);
    tot[m.name] = all.toFixed(2);
    if (m.name === 'slabs') {   // where the remaining slab tests go: the boxes taking the most of them with the flag on (G = global), and how often that test misses
      const order = Array.from(perBox.tests.keys()).filter(i => perBox.tests[i] > 0).sort((a, b) => perBox.tests[b] - perBox.tests[a]).slice(0, 6);
      console.log('           heaviest boxes: ' + order.map(i => { const b = world.all[i]; return `#${i}${globals.includes(i) ? 'G' : ''} ${(perBox.tests[i] / n).toFixed(2)}/ray (${Math.round(100 * perBox.misses[i] / perBox.tests[i])} % miss, h ${b.h.map((v: number) => +v.toFixed(2)).join('×')})`; }).join('  '));
    }
  }
  summary.push(`${set.name.padEnd(16)} today ${tot.today.padStart(5)}   globals ${tot.globals.padStart(5)}   shrink ${tot.shrink.padStart(5)}   slabs ${tot.slabs.padStart(5)}  (${(100 * (Number(tot.slabs) / Number(tot.today) - 1)).toFixed(0)} %)   nocull ${tot.nocull.padStart(5)}`);
  for (let mi = 1; mi < MODES.length; mi++) { let bad = 0; for (let i = 0; i < rays.length; i++) if (results[mi][i] !== results[0][i]) { if (bad++ < 3) console.log(`  MISMATCH ${MODES[mi].name} ray ${i}: today=${results[0][i]} vs ${results[mi][i]}  ro=${rays[i].ro.map(v => v.toFixed(4))} rd=${rays[i].rd.map(v => v.toFixed(4))} tmax=${rays[i].tmax.toFixed(3)} ${rays[i].fn}`); } if (bad) console.log(`  *** ${bad} mismatches in mode ${MODES[mi].name}`); mismatches += bad; }
}
console.log('\nslab tests per ray (globals + grid) by mode:'); for (const s of summary) console.log('  ' + s);
console.log(mismatches ? `\n*** ${mismatches} MISMATCHES — the modes disagree: NOT exact as simulated` : '\nevery mode returns the same answer for every ray');
process.exit(mismatches ? 1 : 0);
