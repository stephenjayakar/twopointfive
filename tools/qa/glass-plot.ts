// 2D PLOTS OF THE GLASS FRACTURE PATTERN (pattern v2) — the pane-local (u, v) picture of what src/game/glassPattern.ts cuts and src/game/glassbreak.ts lets go, drawn
// headless (no GPU). THE CRACKS ARE THE SHADER'S REFERENCE ITSELF: GP.gpCrackAt(sites, run, web, u, v) asked at every pixel (darkness = its w × a smoothstep over ~1.2 px
// of its d) and, on a dicing tempered pane, GP.gpDiceEdge — rasterised to an RGBA PNG (the tiny encoder below) laid over the piece fills as a data-URI <image>. So a plot
// shows what the game would draw, and the model can be judged and tuned without booting a page:
//   bun run tools/qa/glass-plot.ts [--out DIR] [--only name[,name]] [--quiet]
// Stands the game up once (godMode, chaos 0.5, tune.glassBreak on), then per SCENARIO: glassBreak.reset() + setType (re-wholes the pane), a scripted list of rounds / a
// blast through glass.ts glassImpact / GlassBreak.blast with frames stepped between, and one SVG per captured moment + an index.html laying them out in groups.
// Reading a plot: pale blue-green = glass · black = gone (the polygons of gpFragments / gpDicePoly) · ORANGE = an intact piece the support rule (heldSet) does not hold
// (about to fall) · red cross = where a round landed (red ring = a blast's nearest point). ~500 px a metre, v up. Laminated: glass and cracks only (it never opens).
// Every capture is also CHECKED (a ' ! ' line per finding; they do not fail the run — they are for the maintainer): pieces' areas sum to the pane once run · no two pieces
// overlap · gpClassify (what the shader asks) agrees with the polygons (what the support rule walks) on a 1 cm lattice · nb is symmetric · the dice clumps' polygons tile
// the pane and gpDiceClump agrees with them on the same lattice · at a 'settled' capture no intact piece is unheld and none is an island cut off from the frame; and,
// reported (' · ' lines, not wrong by themselves): what HANGS and how big, sill pieces whose centre is not over their footing, how SLENDER the daggers are.
// Exit 0 with one line per file written; deterministic (nothing here draws a die).
//
// PNGs + contact sheets (headless Chromium through Playwright; the helper lives outside the repo — it only loads index.html / each SVG and screenshots):
//   node /tmp/scratch/svg2png.cjs <DIR>
//   → <DIR>/<name>.png per SVG and <DIR>/sheet-<group>.png per group (chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }),
//     playwright from /opt/node-tools/node_modules/playwright).
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { standUp, ROOT } from './headless.ts';
import { CONF_PANE } from './office-pane.ts';
import type { GpFrag, GpCrack, Pt } from '../../src/game/glassPattern.ts';
import type { PaneState, GlassType } from '../../src/game/glassbreak.ts';

const { glassImpact } = await import(`${ROOT}/src/game/glass.ts`);
const { GLASSBREAK } = await import(`${ROOT}/src/game/glassbreak.ts`);
const GP = await import(`${ROOT}/src/game/glassPattern.ts`);

const argv = process.argv.slice(2); const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = resolve(arg('--out') ?? '/tmp/scratch/plots');
const ONLY = arg('--only')?.split(','); const QUIET = argv.includes('--quiet');
mkdirSync(OUT, { recursive: true });
const DT = 1 / 60, OFFICE_PANE = CONF_PANE;

const W = await standUp(); const game: any = W.game; const gb: any = game.glassBreak;
game.godMode = true; game.tune.chaos = 0.5; game.tune.glassBreak = true;
for (let i = 0; i < 5; i++) W.step(DT);
let released = 0, plotted = -1; gb.onRelease = (f: { pane: number }) => { if (f.pane === plotted) released++; };   // (counts the plotted pane's fragments; also keeps the stand-in's debris out of the pool)

// ---------------------------------------------------------------- panes
/** pane-local (u, v) → world on the mid-plane, and the pane's normal — GlassBreak.toWorld / normalOf without a PaneState (none exists before the first blow) */
function frameOf(bi: number) {
  const b = game.level.boxes[bi]; const uAxis = b.h[0] >= b.h[2] ? 0 : 2; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const at = (u: number, v: number): [number, number, number] => { const lx = uAxis === 0 ? u : 0, lz = uAxis === 0 ? 0 : u; return [b.c[0] + cs * lx + sn * lz, b.c[1] + v, b.c[2] - sn * lx + cs * lz]; };
  const n: [number, number, number] = uAxis === 0 ? [sn, 0, cs] : [cs, 0, -sn];
  return { b, hu: b.h[uAxis] as number, hv: b.h[1] as number, at, n };
}
let wide = -1, wideA = 0;
for (const bi of game.engine.world.glassStatics as number[]) { if (!gb.typeOfPane(bi)) continue; const f = frameOf(bi); const a = 4 * f.hu * f.hv; if (a > wideA + 1e-9) { wideA = a; wide = bi; } }
{ const f = frameOf(wide); console.log(`widest pane: box ${wide} at (${f.b.c.map((x: number) => x.toFixed(2)).join(', ')}) ${(2 * f.hu).toFixed(2)} × ${(2 * f.hv).toFixed(2)} m = ${wideA.toFixed(2)} m², breaks as ${gb.typeOfPane(wide)} by default`); }

// ---------------------------------------------------------------- scenarios
type Step = { hit: [number, number, number?] } | { frac: [number, number, number?] } | { blast: [number, number, number]; power: number } | { wait: number } | { cap: string; settled?: boolean };
interface Scenario { name: string; group: string; pane: number; type: GlassType; steps: Step[] }
const rounds = (pts: [number, number][], gap: number): Step[] => pts.flatMap((p, k) => (k ? [{ wait: gap }, { hit: p }] : [{ hit: p }]) as Step[]);
const A1: Step[] = [{ hit: [-0.1, -0.2] }], A2: Step[] = [...A1, { wait: 0.5 }, { hit: [0.2, 0.3] }], A3: Step[] = [...A2, { wait: 0.5 }, { hit: [-0.25, 0.5] }];
const L5 = rounds([[-0.1, -0.2], [0.2, 0.3], [-0.25, 0.5], [0.15, -0.6], [-0.05, 0.05]], 0.3);
const N9 = rounds([[-0.1, -0.2], [0.2, 0.3], [-0.25, 0.5], [0.3, -0.55], [-0.36, -0.75], [0.38, 0.8], [0.02, 0.78], [-0.33, 0.08], [0.1, -0.86]], 0.4);
const SCENARIOS: Scenario[] = [
  { name: 'annealed-1', group: 'annealed', pane: OFFICE_PANE, type: 'annealed', steps: [...A1, { cap: '' }] },
  { name: 'annealed-2', group: 'annealed', pane: OFFICE_PANE, type: 'annealed', steps: [...A2, { cap: '' }] },
  { name: 'annealed-3-run', group: 'annealed', pane: OFFICE_PANE, type: 'annealed', steps: [...A3, { wait: 0.05 }, { cap: 'a' }, { wait: 0.45 }, { cap: 'b' }, { wait: 1.0 }, { cap: 'c', settled: true }] },
  { name: 'annealed-6', group: 'annealed', pane: OFFICE_PANE, type: 'annealed', steps: [...A3, { wait: 1.5 }, { hit: [0.3, -0.55] }, { wait: 0.5 }, { hit: [-0.36, -0.75] }, { wait: 0.5 }, { hit: [0.38, 0.8] }, { wait: 2 }, { cap: '', settled: true }] },
  { name: 'annealed-9', group: 'annealed', pane: OFFICE_PANE, type: 'annealed', steps: [...N9, { wait: 2.5 }, { cap: '', settled: true }] },
  { name: 'annealed-rifle', group: 'misc', pane: OFFICE_PANE, type: 'annealed', steps: [{ hit: [-0.1, -0.2, 2.6] }, { wait: 0.05 }, { cap: 'a' }, { wait: 0.45 }, { cap: 'b' }, { wait: 1.5 }, { cap: 'c', settled: true }] },
  { name: 'annealed-soft', group: 'misc', pane: OFFICE_PANE, type: 'annealed', steps: [{ hit: [-0.1, -0.2, 0.3] }, { cap: '' }] },
  { name: 'tempered-dice', group: 'tempered', pane: OFFICE_PANE, type: 'tempered', steps: [{ hit: [0.1, -0.3] }, { wait: 0.02 }, { cap: 'a' }, { wait: 0.1 }, { cap: 'b' }, { wait: 0.1 }, { cap: 'c' }, { wait: 0.28 }, { cap: 'd', settled: true }] },
  { name: 'laminated-1', group: 'laminated', pane: OFFICE_PANE, type: 'laminated', steps: [...A1, { cap: '' }] },
  { name: 'laminated-5', group: 'laminated', pane: OFFICE_PANE, type: 'laminated', steps: [...L5, { cap: '' }] },
  { name: 'annealed-blast', group: 'blast', pane: OFFICE_PANE, type: 'annealed', steps: [{ blast: [7.6, 1.0, 10.9], power: 1 }, { wait: 0.05 }, { cap: 'a' }, { wait: 0.45 }, { cap: 'b' }, { wait: 1.5 }, { cap: 'c', settled: true }] },
  { name: 'laminated-blast', group: 'blast', pane: OFFICE_PANE, type: 'laminated', steps: [{ blast: [7.6, 1.0, 10.3], power: 1 }, { wait: 0.05 }, { cap: 'a' }, { wait: 1.95 }, { cap: 'b', settled: true }] },
  { name: 'wide-annealed-4', group: 'wide', pane: wide, type: 'annealed', steps: [{ frac: [-0.5, -0.2] }, { wait: 0.5 }, { frac: [0.1, 0.3] }, { wait: 0.5 }, { frac: [0.55, -0.4] }, { wait: 0.5 }, { frac: [-0.15, -0.6] }, { wait: 2 }, { cap: '', settled: true }] },
];
const GROUPS: [string, string][] = [['annealed', 'Annealed (interior partition, 1 × 2 m): rounds 1 → 6, and nine'], ['tempered', 'Tempered: one round, the dice wave'], ['laminated', 'Laminated: the web that holds'],
  ['blast', 'Blast (power 1) beside the pane'], ['misc', 'A rifle round (energy 2.6) · a soft blow (0.3)'], ['wide', 'The widest pane, annealed, four rounds']];

// ---------------------------------------------------------------- geometry helpers (the tool's own; glassPattern.ts keeps its clip private)
function clipHalf(pts: Pt[], nx: number, ny: number, d: number): Pt[] {   // keep n·p ≤ d
  const out: Pt[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length]; const da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const areaOf = (pts: Pt[]) => { let a = 0; for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
/** area two convex anticlockwise polygons share */
function overlap(A: Pt[], B: Pt[]): number {
  let P = A.slice();
  for (let k = 0; k < B.length && P.length >= 3; k++) { const p = B[k], q = B[(k + 1) % B.length]; const ex = q[0] - p[0], ey = q[1] - p[1]; P = clipHalf(P, ey, -ex, ey * p[0] - ex * p[1]); }
  return P.length >= 3 ? Math.abs(areaOf(P)) : 0;
}
/** signed distance OUTSIDE a convex anticlockwise polygon (≤ 0 inside) — the worst half-plane */
function outside(pts: Pt[], u: number, v: number): number {
  let m = -Infinity;
  for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; const ex = q[0] - p[0], ey = q[1] - p[1]; const L = Math.hypot(ex, ey); if (L < 1e-9) continue; m = Math.max(m, (ey * (u - p[0]) - ex * (v - p[1])) / L); }
  return m;
}
/** a convex piece's longest extent and its width across that (m): the slenderness of a dagger */
function slender(pts: Pt[]): { len: number; wid: number } {
  let len = 0, ax = 1, ay = 0;
  for (const p of pts) for (const q of pts) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d > len) { len = d; ax = (q[0] - p[0]) / d; ay = (q[1] - p[1]) / d; } }
  let lo = Infinity, hi = -Infinity; for (const p of pts) { const t = -ay * p[0] + ax * p[1]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  return { len, wid: hi - lo };
}
const pid = (f: { i: number; b: number; s: number }) => `${f.i}:${f.b}:${f.s}`;
const fx = (x: number) => x.toFixed(3);
const cm2 = (a: number) => `${(a * 1e4).toFixed(0)} cm²`;

// ---------------------------------------------------------------- the checks
function check(st: PaneState, tag: string, settled: boolean): string[] {
  const bad: string[] = []; const info = (s: string) => { if (!QUIET) console.log(`   · ${tag}: ${s}`); };
  const pane = 4 * st.hu * st.hv; const stepM = 0.01;
  if (st.dice) {   // tempered: the clumps' polygons tile the pane, and gpDiceClump (the shader's question) agrees with them
    const D: any = st.dice; const polys = new Map<number, Pt[]>(); let a = 0, nEmpty = 0, minA = Infinity, maxA = 0;
    for (let r = 0; r < D.rows; r++) for (let c = 0; c < D.cols; c++) { const P: Pt[] = GP.gpDicePoly(D, c, r); polys.set(r * D.cols + c, P); const ar = P.length >= 3 ? Math.abs(areaOf(P)) : 0; if (ar < 1e-7) nEmpty++; a += ar; minA = Math.min(minA, ar); maxA = Math.max(maxA, ar); }
    if (Math.abs(a - pane) > 1e-5) bad.push(`dice clumps' areas sum to ${a.toFixed(5)} m², the pane is ${pane.toFixed(5)}`);
    if (nEmpty) bad.push(`${nEmpty} dice clumps have no polygon`);
    let nMis = 0; let ex = '';
    for (let v = -st.hv + stepM / 2; v < st.hv; v += stepM) for (let u = -st.hu + stepM / 2; u < st.hu; u += stepM) {
      const k: number = GP.gpDiceClump(D, u, v); const o = outside(polys.get(k) ?? [], u, v);
      if (!(o <= 1e-4)) { nMis++; ex ||= `(${fx(u)}, ${fx(v)}) is clump ${k} (c ${k % D.cols}, r ${Math.floor(k / D.cols)}) by gpDiceClump but ${isFinite(o) ? `${(o * 1000).toFixed(1)} mm outside` : 'has no'} gpDicePoly`; }
    }
    if (nMis) bad.push(`gpDiceClump ≠ gpDicePoly at ${nMis} of the 1 cm lattice points, e.g. ${ex}`);
    if (D.clumps.length !== D.cols * D.rows) bad.push(`${D.clumps.length} clumps listed, the lattice is ${D.cols} × ${D.rows}`);
    if (D.next <= 1) info(`dice: ${D.cols} × ${D.rows} clumps, areas ${cm2(minA)} ‥ ${cm2(maxA)} (mean ${cm2(pane / (D.cols * D.rows))}); keys ${D.clumps[0].key.toFixed(3)} ‥ ${D.clumps[D.clumps.length - 1].key.toFixed(3)} m`);
    return bad;
  }
  if (st.type !== 'annealed' || st.gone || st.sites.length === 0) return bad;
  const frags: GpFrag[] = gb['fragsOf'](st); const by = new Map<number, GpFrag>(); for (const f of frags) by.set(f.fid, f);
  if (st.run) { let a = 0; for (const f of frags) a += f.area; if (Math.abs(a - pane) > 1e-5) bad.push(`areas sum to ${a.toFixed(5)} m², the pane is ${pane.toFixed(5)}`); }
  let nOv = 0;
  for (let x = 0; x < frags.length; x++) for (let y = x + 1; y < frags.length; y++) {
    const A = frags[x], B = frags[y]; if (A.uMax < B.uMin || B.uMax < A.uMin || A.vMax < B.vMin || B.vMax < A.vMin) continue;
    const o = overlap(A.pts, B.pts); if (o > 1e-6) { if (nOv++ < 4) bad.push(`pieces ${pid(A)} and ${pid(B)} OVERLAP by ${(o * 1e4).toFixed(2)} cm² (centres (${fx(A.cen[0])}, ${fx(A.cen[1])}) / (${fx(B.cen[0])}, ${fx(B.cen[1])}))`); }
  }
  if (nOv > 4) bad.push(`… ${nOv} overlapping pairs in all`);
  // gpClassify (the shader's question) against the polygons (the support rule's), on a 1 cm lattice
  let nMis = 0, nNone = 0; let ex = '';
  for (let v = -st.hv + stepM / 2; v < st.hv; v += stepM) for (let u = -st.hu + stepM / 2; u < st.hu; u += stepM) {
    const fid: number = GP.gpClassify(st.sites, st.run, u, v); if (fid < 0) continue;
    const f = by.get(fid);
    if (!f) { nNone++; if (!ex) { const q = GP.gpUnfid(fid); ex = `(${fx(u)}, ${fx(v)}) classifies as ${pid(q)}, which has no polygon`; } continue; }
    if (outside(f.pts, u, v) > 1e-4) { nMis++; if (!ex) { const own = frags.find(g => outside(g.pts, u, v) <= 0); ex = `(${fx(u)}, ${fx(v)}) classifies as ${pid(f)} but lies ${(outside(f.pts, u, v) * 1000).toFixed(1)} mm outside its polygon${own ? ` (inside ${pid(own)}'s)` : ''}`; } }
  }
  if (nMis + nNone) bad.push(`classify ≠ polygons at ${nMis + nNone} of the 1 cm lattice points (${nNone} with no polygon), e.g. ${ex}`);
  const asym: string[] = [];
  for (const f of frags) for (const n of f.nb) { if (n.fid < 0) continue; const o = by.get(n.fid); if (!o) { asym.push(`${pid(f)} names ${pid(GP.gpUnfid(n.fid))}, which has no polygon`); continue; } if (!o.nb.some(m => m.fid === f.fid)) asym.push(`${pid(f)} names ${pid(o)} (edge ${(n.len * 100).toFixed(1)} cm) but not the reverse`); }
  if (asym.length) bad.push(`nb not symmetric in ${asym.length} places: ${asym.slice(0, 5).join(' · ')}`);
  if (st.run) {   // informational: how dagger-like the daggers are (length ÷ width across; real ones are 4 : 1 and up)
    const dg = frags.filter(f => f.b >= 3).map(f => ({ f, ...slender(f.pts) })).filter(x => x.wid > 1e-6); const r = dg.map(x => x.len / x.wid).sort((a, b) => a - b);
    if (r.length) { const fat = dg.filter(x => x.len / x.wid < 1.8).sort((a, b) => b.f.area - a.f.area); info(`${dg.length} daggers, length : width median ${r[r.length >> 1].toFixed(1)} (min ${r[0].toFixed(1)}, max ${r[r.length - 1].toFixed(1)}); ${fat.length} squat (< 1.8)${fat.length ? `, biggest ${fat.slice(0, 3).map(x => `${pid(x.f)} ${cm2(x.f.area)} ${(x.len * 100).toFixed(0)} × ${(x.wid * 100).toFixed(0)} cm`).join(' · ')}` : ''}`); }
  }
  if (settled) {
    const held: Set<number> = gb.heldSet(st); const intact = frags.filter(f => !st.open[f.fid]);
    const un = intact.filter(f => !held.has(f.fid));
    if (un.length) bad.push(`settled, yet ${un.length} intact pieces are unheld (pending ${st.pending.length}): ${un.slice(0, 6).map(f => `${pid(f)} @(${fx(f.cen[0])}, ${fx(f.cen[1])}) ${cm2(f.area)}`).join(' · ')}`);
    // islands: intact pieces with no chain of intact neighbours to the frame or the uncut sheet
    const seen = new Set<number>(); const q: GpFrag[] = [];
    for (const f of intact) if (f.frame.bottom + f.frame.top + f.frame.left + f.frame.right > 1e-4 || f.nb.some(n => n.fid === GP.GP_REMAINDER)) { seen.add(f.fid); q.push(f); }
    while (q.length) { const f = q.pop()!; for (const n of f.nb) { const o = by.get(n.fid); if (o && !st.open[o.fid] && !seen.has(o.fid)) { seen.add(o.fid); q.push(o); } } }
    const isl = intact.filter(f => !seen.has(f.fid));
    if (isl.length) bad.push(`${isl.length} intact pieces FLOAT (no intact chain to the frame): ${isl.slice(0, 6).map(f => `${pid(f)} @(${fx(f.cen[0])}, ${fx(f.cen[1])})`).join(' · ')}`);
    // informational: a piece 'standing on the sill' whose centre of mass is not over its footing (it would tip unless its neighbours keep it)
    const tip = intact.filter(f => f.foot && (f.cen[0] < f.foot[0] - 0.01 || f.cen[0] > f.foot[1] + 0.01));
    if (tip.length) info(`${tip.length} sill pieces are held with their centre NOT over their footing: ${tip.slice(0, 5).map(f => `${pid(f)} ${cm2(f.area)} cen (${fx(f.cen[0])}, ${fx(f.cen[1])}) foot ${fx(f.foot![0])}‥${fx(f.foot![1])}, top v ${fx(f.vMax)}`).join(' · ')}`);
    // informational: what is held with open air (or nothing intact) under every downward-facing crack of it, and no sill — it hangs from its sides / the top
    const hang = intact.filter(f => held.has(f.fid) && !f.foot && !f.nb.some(n => { const o = by.get(n.fid); return n.ny < -0.5 && (n.fid === GP.GP_REMAINDER || (o && !st.open[o.fid])); })).sort((a, b) => b.area - a.area);
    if (hang.length) info(`${hang.length} held pieces HANG (nothing intact under them, not on the sill); biggest ${hang.slice(0, 4).map(f => `${pid(f)} ${cm2(f.area)} @(${fx(f.cen[0])}, ${fx(f.cen[1])}) frame L${fx(f.frame.left)} R${fx(f.frame.right)} T${fx(f.frame.top)}`).join(' · ')}`);
    // informational: enclosed holes — an open piece with no open neighbour chain to another hole's rim is fine; what reads wrong is a hole whose every neighbour is intact
    const lone = frags.filter(f => st.open[f.fid] && f.b >= 3 && f.nb.every(n => n.fid === GP.GP_REMAINDER || !st.open[n.fid]));
    if (lone.length) info(`${lone.length} fallen daggers left a hole ENCLOSED by intact glass: ${lone.slice(0, 5).map(f => `${pid(f)} ${cm2(f.area)} @(${fx(f.cen[0])}, ${fx(f.cen[1])})`).join(' · ')}`);
    const teeth = intact.filter(f => f.b >= 3 && f.frame.bottom + f.frame.top + f.frame.left + f.frame.right > 1e-4);
    info(`left standing: ${intact.length} of ${frags.length} pieces, ${teeth.length} daggers on the frame (sill ${teeth.filter(f => f.foot).length}, top ${teeth.filter(f => f.frame.top > 1e-4).length}, sides ${teeth.filter(f => f.frame.left + f.frame.right > 1e-4).length})`);
  }
  return bad;
}

// ---------------------------------------------------------------- PNG (RGBA 8, one IDAT, filter 0)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b: Uint8Array): number { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Uint8Array) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); b.set(data, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** the crack picture of a pane at S px a metre: gpCrackAt at every pixel centre (nothing inside a hole), gpDiceEdge on the clumps of a dicing pane still in. null = nothing to draw */
function crackRaster(st: PaneState, S: number, w: number, h: number): Buffer | null {
  if (st.gone || (!st.dice && st.sites.length === 0)) return null;
  const px = new Uint8Array(w * h * 4); const web = st.type === 'laminated'; const D: any = st.dice; let any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = -st.hu + (x + 0.5) / S, v = st.hv - (y + 0.5) / S; let a = 0;
    if (D) { if (!D.out[GP.gpDiceClump(D, u, v)]) a = 0.7 * (1 - smooth(0.25, 1.1, GP.gpDiceEdge(u, v, GLASSBREAK.diceGrain, D.seed) * S)); }
    else { const c: GpCrack = GP.gpCrackAt(st.sites, st.run, web, u, v); if (!(c.fid >= 0 && !web && st.open[c.fid])) a = c.w * (1 - smooth(0.3, 1.2, c.d * S)); }
    if (a <= 0.004) continue;
    const o = (y * w + x) * 4; px[o] = 16; px[o + 1] = 44; px[o + 2] = 42; px[o + 3] = Math.round(255 * Math.min(1, a)); any = true;
  }
  return any ? png(w, h, px) : null;
}

// ---------------------------------------------------------------- the SVG
const C = { paper: '#ffffff', glass: '#cfe9e3', hole: '#0b0d10', unheld: '#ff9a2e', frame: '#2b2f36', hit: '#e0201b', text: '#1c1f24', dim: '#5b626c' };
interface Mark { u: number; v: number; kind: 'hit' | 'blast' }
function plot(st: PaneState | null, hu: number, hv: number, marks: Mark[], lines: string[]): string {
  const S = Math.min(500, 1500 / (2 * hu)); const M = 16, TH = 18 * lines.length + 12; const PW = Math.round(2 * hu * S), PH = Math.round(2 * hv * S); const Wd = Math.max(PW + 2 * M, 300), Ht = PH + 2 * M + TH; const ox = Math.round((Wd - PW) / 2);
  const X = (u: number) => (ox + (u + hu) * S).toFixed(1), Y = (v: number) => (M + (hv - v) * S).toFixed(1);
  const poly = (pts: Pt[]) => pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Wd}" height="${Ht}" viewBox="0 0 ${Wd} ${Ht}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="13">`);
  o.push(`<defs><clipPath id="pane"><rect x="${ox}" y="${M}" width="${PW}" height="${PH}"/></clipPath></defs>`);
  o.push(`<rect width="100%" height="100%" fill="${C.paper}"/>`);
  o.push(`<g clip-path="url(#pane)">`);
  o.push(`<rect x="${ox}" y="${M}" width="${PW}" height="${PH}" fill="${st?.gone ? C.hole : C.glass}"/>`);
  const holeAttr = `fill="${C.hole}" stroke="${C.hole}" stroke-width="1.4" stroke-linejoin="round" shape-rendering="crispEdges"`;   // (the stroke closes the hairline seams between neighbouring holes)
  if (st && !st.gone) {
    if (st.dice) { const D: any = st.dice; for (const c of D.clumps) if (D.out[c.k]) { const P: Pt[] = GP.gpDicePoly(D, c.c, c.r); if (P.length >= 3) o.push(`<polygon points="${poly(P)}" ${holeAttr}/>`); } }
    else if (st.type === 'annealed' && st.sites.length) {
      const frags: GpFrag[] = gb['fragsOf'](st); const held: Set<number> = gb.heldSet(st);
      for (const f of frags) if (!st.open[f.fid] && !held.has(f.fid)) o.push(`<polygon points="${poly(f.pts)}" fill="${C.unheld}" fill-opacity="0.6"/>`);
      for (const f of frags) if (st.open[f.fid]) o.push(`<polygon points="${poly(f.pts)}" ${holeAttr}/>`);
    }
    const img = crackRaster(st, S, PW, PH);
    if (img) o.push(`<image x="${ox}" y="${M}" width="${PW}" height="${PH}" xlink:href="data:image/png;base64,${img.toString('base64')}" href="data:image/png;base64,${img.toString('base64')}"/>`);
  }
  for (const m of marks) {
    const x = +X(m.u), y = +Y(m.v);
    if (m.kind === 'hit') o.push(`<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}" stroke="${C.hit}" stroke-width="1.8" fill="none"/>`);
    else o.push(`<circle cx="${x}" cy="${y}" r="8" stroke="${C.hit}" stroke-width="1.8" fill="none"/>`);
  }
  o.push(`</g>`);
  o.push(`<rect x="${ox - 4}" y="${M - 4}" width="${PW + 8}" height="${PH + 8}" fill="none" stroke="${C.frame}" stroke-width="8"/>`);
  lines.forEach((t, k) => o.push(`<text x="${(Wd / 2).toFixed(0)}" y="${PH + 2 * M + 16 + 18 * k}" text-anchor="middle" fill="${k === 0 ? C.text : C.dim}"${k === 0 ? ' font-weight="700"' : ''}>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`));
  o.push(`</svg>`);
  return o.join('\n');
}

// ---------------------------------------------------------------- run
const written: { file: string; group: string; cap: string[] }[] = []; let findings = 0;
for (const sc of SCENARIOS) {
  if (ONLY && !ONLY.includes(sc.name)) continue;
  gb.reset(); gb.setType(OFFICE_PANE, null); if (wide >= 0) gb.setType(wide, null);
  gb.setType(sc.pane, sc.type); released = 0; plotted = sc.pane;
  const F = frameOf(sc.pane); const marks: Mark[] = []; let since = 0; const notes: string[] = [];
  const step = (secs: number) => { const n = Math.max(1, Math.round(secs / DT)); for (let i = 0; i < n; i++) W.step(DT); since += n * DT; };
  for (const s of sc.steps) {
    if ('wait' in s) step(s.wait);
    else if ('hit' in s || 'frac' in s) {
      const [a, b, e = 1] = 'hit' in s ? s.hit : s.frac; const u = 'hit' in s ? a : a * F.hu, v = 'hit' in s ? b : b * F.hv;
      const r = glassImpact(game, sc.pane, F.at(u, v), [-F.n[0], 0, -F.n[2]], e, 1);
      marks.push({ u, v, kind: 'hit' }); since = 0;
      notes.push(`(${u.toFixed(2)}, ${v.toFixed(2)}) e ${e}${r.wasOpen ? ' → through a hole' : r.punched ? ' → punched' : ' → cracked'}`);
    } else if ('blast' in s) {
      const n = gb.blast(s.blast, { power: s.power }); since = 0; notes.push(`blast at (${s.blast.join(', ')}) power ${s.power}: ${n} panes touched`);
      const st: PaneState | undefined = gb.panes.get(sc.pane); if (st) marks.push({ u: st.lastUV[0], v: st.lastUV[1], kind: 'blast' });
    } else {
      const st: PaneState | null = gb.panes.get(sc.pane) ?? null; const name = sc.name + (s.cap ? `-${s.cap}` : ''); const D: any = st?.dice;
      const state = !st ? 'whole' : st.gone ? 'GONE' : D ? `diced · ${D.next}/${D.clumps.length} clumps out` : `${st.sites.length} site${st.sites.length === 1 ? '' : 's'} · ${st.run ? 'RUN' : 'not run'} · energy ${st.energy.toFixed(1)}`;
      const unheld = st && st.type === 'annealed' && !st.gone ? (gb['fragsOf'](st) as GpFrag[]).filter(f => !st.open[f.fid]).length - gb.heldSet(st).size : 0;
      const lines = [`${name}   +${since.toFixed(2)} s${s.settled ? ' (settled)' : ''}`, `${sc.type} · ${state}`,
        `${(100 * gb.openFraction(sc.pane)).toFixed(1)} % open · ${released} fragment${released === 1 ? '' : 's'} out${unheld > 0 ? ` · ${unheld} unheld` : ''}`];
      const file = resolve(OUT, `${name}.svg`); writeFileSync(file, plot(st, F.hu, F.hv, marks, lines));
      written.push({ file: `${name}.svg`, group: sc.group, cap: lines });
      console.log(`wrote ${file}   ${lines[1]} · ${lines[2]}`);
      if (st) for (const b of check(st, name, !!s.settled)) { findings++; console.log(` ! ${name}: ${b}`); }
    }
  }
  if (!QUIET) { for (const n of notes) console.log(`   · ${sc.name}: ${n}`); const st: PaneState | undefined = gb.panes.get(sc.pane); if (st?.log.length) console.log(`   · ${sc.name} log: ${st.log.join(' | ')}`); }
}
gb.reset(); gb.setType(OFFICE_PANE, null); if (wide >= 0) gb.setType(wide, null); gb.onRelease = null;

// ---------------------------------------------------------------- index.html (the contact sheets are screenshots of its .group sections)
const html = [`<!doctype html><meta charset="utf-8"><title>glass fracture plots</title>`,
  `<style>body{margin:16px;background:#fff;color:#1c1f24;font:14px/1.4 system-ui,sans-serif}section.group{display:inline-block;padding:14px 16px 10px;margin:0 0 18px;background:#fff;border:1px solid #d9dce1}`
  + `h2{font-size:17px;margin:0 0 10px}.row{display:flex;gap:14px;align-items:flex-start}figure{margin:0}figcaption{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#5b626c;margin-top:4px;max-width:330px}figcaption b{color:#1c1f24}figure img{display:block;height:var(--h,620px);width:auto}`
  + `.key{font-size:12px;color:#5b626c;margin:8px 0 0}.key b{display:inline-block;width:11px;height:11px;margin:0 4px -1px 12px;border:1px solid #2b2f36}</style>`];
for (const [id, title] of GROUPS) {
  const fs = written.filter(w => w.group === id); if (!fs.length) continue;
  html.push(`<section class="group" id="${id}"${id === 'wide' ? ' style="--h:640px"' : ''}><h2>${title}</h2><div class="row">`);
  for (const f of fs) html.push(`<figure><img src="${f.file}" alt=""><figcaption>${f.cap.map((t, k) => k ? t : `<b>${t}</b>`).join('<br>')}</figcaption></figure>`);
  html.push(`</div><p class="key"><b style="background:${C.glass};margin-left:0"></b>glass<b style="background:${C.hole}"></b>gone<b style="background:${C.unheld}"></b>intact but unheld (about to fall)<span style="color:${C.hit};margin-left:12px">✕</span> a round · <span style="color:${C.hit}">○</span> a blast's nearest point · cracks = gpCrackAt per pixel</p></section><br>`);
}
writeFileSync(resolve(OUT, 'index.html'), html.join('\n')); console.log(`wrote ${resolve(OUT, 'index.html')}`);
console.log(`=== glass-plot: ${written.length} plots, ${findings} model finding${findings === 1 ? '' : 's'} ===`);
process.exit(0);
