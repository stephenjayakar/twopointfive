// Turn the stress harness's interleaved A/B result (tools/qa/stress-scene.js `__stress.ab(...)` posted to the shot server as docs/perf/<name>.json, or saved by
// hand) into the Phase 0 gate table: per pass mean · p95 · max for A (caps off) and B (caps on), Σ compute, and the deltas.
//   bun run tools/qa/stress-report.ts docs/perf/p0c-ab-high-r1.json [more.json …] [--raw]
// Frames another GPU client visibly shared are dropped first (a fixed-cost pass — bloom — reading over 4× its own median or 0.4 ms: the M4 Max's bloom is
// 0.07–0.13 ms alone whatever the scene); --raw keeps them. The result files carry per-frame arrays for exactly this (result.A.raw / result.B.raw).
import { readFileSync } from 'fs';
type Stat = { n: number; mean: number; p50: number; p95: number; max: number } | null;
type Raw = { sums: number[]; passes: Record<string, number[]>; smoke?: number[]; pslots?: number[] };
type Rec = { frames: number; missed: number; preset: string; res: [number, number]; sum: Stat; passes: Record<string, Stat>; ctx: Record<string, Stat>; raw?: Raw };
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const keepRaw = process.argv.includes('--raw');
if (!files.length) { console.error('usage: bun run tools/qa/stress-report.ts <ab.json> … [--raw]'); process.exit(2); }
const stat = (a: number[]): Stat => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: m, p50: s[Math.floor(0.5 * (s.length - 1))], p95: s[Math.floor(0.95 * (s.length - 1))], max: s[s.length - 1] }; };
/** recompute a pool's stats from its raw arrays, dropping contended frames (unless --raw); returns null if the file predates raw arrays */
function filtered(R: Rec): { rec: Rec; dropped: number } | null {
  const raw = R.raw; if (!raw || keepRaw) return null;
  const bloom = raw.passes.bloom ?? []; const med = stat(bloom)?.p50 ?? 0; const thr = Math.max(0.4, 4 * med);
  const keep = raw.sums.map((_, i) => (bloom[i] ?? 0) <= thr);
  const pick = (a: number[]) => a.filter((_, i) => keep[i]);
  const passes: Record<string, Stat> = {}; for (const [k, a] of Object.entries(raw.passes)) passes[k] = stat(pick(a));
  return { rec: { ...R, sum: stat(pick(raw.sums)), passes, frames: keep.filter(Boolean).length }, dropped: keep.length - keep.filter(Boolean).length };
}
const f2 = (v: number | undefined) => v === undefined ? '     -' : v.toFixed(2).padStart(6);
const pct = (a?: number, b?: number) => (a && b !== undefined) ? `${(100 * (b / a - 1)).toFixed(0).padStart(4)}%` : '    -';
const row = (k: string, a: Stat, b: Stat) => `  ${k.padEnd(12)} ${f2(a?.mean)} ${f2(a?.p95)} ${f2(a?.max)}  | ${f2(b?.mean)} ${f2(b?.p95)} ${f2(b?.max)}  | ${pct(a?.mean, b?.mean)} ${pct(a?.p95, b?.p95)} ${pct(a?.max, b?.max)}`;
for (const file of files) {
  const D = JSON.parse(readFileSync(file, 'utf8')) as { A: Rec; B: Rec; setup?: string; capsOn?: string; fight?: boolean };
  let { A, B } = D; let note = '';
  const fa = filtered(A), fb = filtered(B);
  if (fa && fb) { A = fa.rec; B = fb.rec; note = ` · contended frames dropped: ${fa.dropped} / ${fb.dropped}`; } else if (!keepRaw) note = ' · (no raw arrays in this file: unfiltered)';
  console.log(`\n${file}\n${B.preset} ${B.res.join('×')} · ${D.fight === false ? 'GATE take (no fight)' : 'TORTURE take (fight)'} · A (caps OFF) ${A.frames} frames / B (caps ON) ${B.frames} frames${note} · ${D.capsOn ?? ''}\n${D.setup ?? ''}`);
  console.log(`  context: lights ${A.ctx.lights?.mean}/${B.ctx.lights?.mean} · smoke domains ${A.ctx.smoke?.mean}/${B.ctx.smoke?.mean} (max ${A.ctx.smoke?.max}/${B.ctx.smoke?.max}) · particle slots ${A.ctx.pslots?.mean}/${B.ctx.pslots?.mean}`);
  console.log('  pass            OFF mean  p95    max  |  ON mean   p95    max  |  Δmean  Δp95  Δmax');
  console.log(row('Σ compute', A.sum, B.sum));
  const keys = [...new Set([...Object.keys(A.passes), ...Object.keys(B.passes)])].sort((x, y) => (B.passes[y]?.mean ?? 0) + (A.passes[y]?.mean ?? 0) - (B.passes[x]?.mean ?? 0) - (A.passes[x]?.mean ?? 0));
  for (const k of keys) console.log(row(k, A.passes[k], B.passes[k]));
  const v = B.passes.volumetrics; if (v) console.log(`  targets: vol p95 ≤ 2× median → ${v.p95.toFixed(2)} vs ${(2 * v.p50).toFixed(2)} ${v.p95 <= 2 * v.p50 ? 'OK' : 'MISS'} · vol worst ≤ 6 → ${v.max.toFixed(2)} ${v.max <= 6 ? 'OK' : 'MISS'} · particles worst ≤ 3 → ${(B.passes.particles?.max ?? 0).toFixed(2)} ${(B.passes.particles?.max ?? 0) <= 3 ? 'OK' : 'MISS'} · Σ p95 ${pct(A.sum?.p95, B.sum?.p95)} (want ≤ −30 %)`);
}
