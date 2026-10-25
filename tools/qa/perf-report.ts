// Turn a perf recording (src/ui/perfrec.ts, F9 in the game → docs/perf/<name>.json or a download) into the tables docs/internal/renderer-v3 was written from.
//   bun run tools/qa/perf-report.ts docs/perf/perf-2026-08-10T….json [--spikes 12] [--pass direct]
//   bun run tools/qa/perf-report.ts <sweep take>.json --md      (a sweep take's feature table as markdown, nothing else)
import { readFileSync } from 'fs';
import { benchReport, type BenchResult } from '../../src/ui/bench';   // a BENCHMARK take (Extras ▸ Benchmark / ?bench, src/ui/bench.ts): the report its card showed, printed first, as the machine's own word
import { stallLines, type StallTake } from './perf-stalls';   // the frames that took several usual frames, and where the file says the time went
import { sweepText, sweepMarkdown, smokeText } from './perf-sweep';   // a SWEEP take (F8, src/ui/perfsweep.ts): a table per feature flipped — printed after the plain tables; --md = that table as markdown, alone
// gpuSum = Σ of per-pass durations; gpuUnion (dumps from 08-10 on) = the union of the passes' intervals on the GPU timeline. Metal runs independent passes side by
// side when the queue is full, so Σ double-counts the overlap (35–55 % of the frame at high / medium in the field — the '7–13 ms cascade bursts' were exactly that:
// docs/internal/p0a-cascades.md). Where a dump has the union, the tables print it beside Σ; budgets and gates should read the UNION.
type Frame = { t: number; dt: number; fps: number; cpu: { update: number; render: number; other: number }; gpu: Record<string, number>; gpuSum: number; gpuUnion?: number; res: [number, number]; eff: number; preset: string; adaptive: boolean; cam: number[]; n: Record<string, number | string> };
type Ev = { t: number; frame: number; kind: string; text: string };
const arg = (k: string, d?: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2]; if (!file || file.startsWith('--')) { console.error('usage: bun run tools/qa/perf-report.ts <dump.json> [--spikes N] [--pass name] [--md]'); process.exit(2); }
const D = JSON.parse(readFileSync(file, 'utf8')) as { note: string; machine: string; commit?: string; query?: string; smokeUnit?: number; dpr: number; startedAt: string; frames: Frame[]; events: Ev[]; settingsAtStart: Record<string, unknown>; settingsAtEnd: Record<string, unknown> };
const F = D.frames; if (!F.length) { console.log('empty recording'); process.exit(0); }
if (process.argv.includes('--md')) { const md = sweepMarkdown(D); console.log(md.length ? md.join('\n') : 'no sweep in this take'); process.exit(0); }
const RENDER = /^(gbuffer|composite|post|fxaa|pdraw)$/;
const benchEv = D.events.find(e => e.kind === 'bench');
if (benchEv) try { console.log(`\n── the benchmark's own report (what its card showed) ──\n${benchReport(JSON.parse(benchEv.text) as BenchResult)}`); } catch { console.log('\n(a bench event that does not parse)'); }
const sweepLines = sweepText(D), EV = D.events.filter(e => e.kind !== 'sweep' && e.kind !== 'bench' && e.kind !== 'long' && e.kind !== 'held'), nLong = D.events.filter(e => e.kind === 'long' || e.kind === 'held').length, nSweep = D.events.filter(e => e.kind === 'sweep').length;   // (a sweep take's segment events are read into the table at the end, not listed)
const stat = (a: number[]) => { if (!a.length) return { n: 0, mean: 0, sd: 0, p50: 0, p95: 0, max: 0, min: 0 }; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length), p50: s[Math.floor(0.5 * (s.length - 1))], p95: s[Math.floor(0.95 * (s.length - 1))], max: s[s.length - 1], min: s[0] }; };
const f1 = (v: number) => v.toFixed(1).padStart(6), f2 = (v: number) => v.toFixed(2).padStart(7);
const dur = F[F.length - 1].t / 1000;
console.log(`\n${D.note}\n${D.machine} · dpr ${D.dpr} · started ${D.startedAt}${D.commit ? ` · commit ${D.commit}` : ''}${D.query ? ` · ${D.query}` : ''} · ${F.length} frames over ${dur.toFixed(1)} s (${(F.length / dur).toFixed(1)} presented fps average)\n`);
// segments by preset + resolution
const segKey = (f: Frame) => `${f.preset} ${f.res[0]}×${f.res[1]} ×${f.eff.toFixed(2)}`;
const segs = new Map<string, Frame[]>(); for (const f of F) { const k = segKey(f); if (!segs.has(k)) segs.set(k, []); segs.get(k)!.push(f); }
const hasUnion = F.some(f => typeof f.gpuUnion === 'number');
console.log(`SEGMENTS (preset · internal res · effective scale): frames | fps mean p5 | wall dt mean p95 max | GPU Σ mean σ p95 max |${hasUnion ? ' GPU UNION mean σ p95 max | Σ−union mean |' : ''} CPU update / render / other`);
for (const [k, fr] of segs) {
  const fps = stat(fr.map(f => f.fps)), dt = stat(fr.map(f => f.dt)), g = stat(fr.map(f => f.gpuSum)), cu = stat(fr.map(f => f.cpu.update)), cr = stat(fr.map(f => f.cpu.render)), co = stat(fr.map(f => f.cpu.other));
  const fpsSorted = [...fr.map(f => f.fps)].sort((a, b) => a - b); const p5 = fpsSorted[Math.floor(0.05 * (fpsSorted.length - 1))];
  const fu = fr.filter(f => typeof f.gpuUnion === 'number'); const u = stat(fu.map(f => f.gpuUnion!)), ov = stat(fu.map(f => f.gpuSum - f.gpuUnion!));
  const unionCols = hasUnion ? (fu.length ? ` ${f2(u.mean)} ${f2(u.sd)} ${f2(u.p95)} ${f2(u.max)} | ${f2(ov.mean)} |` : `   (no union in this segment)          |         |`) : '';
  console.log(`  ${k.padEnd(34)} ${String(fr.length).padStart(5)} | ${f1(fps.mean)} ${f1(p5)} | ${f2(dt.mean)} ${f2(dt.p95)} ${f2(dt.max)} | ${f2(g.mean)} ${f2(g.sd)} ${f2(g.p95)} ${f2(g.max)} |${unionCols} ${f2(cu.mean)} ${f2(cr.mean)} ${f2(co.mean)}`);
}
if (!hasUnion) console.log('  (this dump predates gpuUnion: its Σ double-counts passes the GPU ran side by side — treat Σ p95 / max and any single-pass "burst" beside a large direct pass with suspicion)');
// per-pass table over the whole recording (passes that ran)
const passes = new Set<string>(); for (const f of F) for (const k of Object.keys(f.gpu)) if (!RENDER.test(k)) passes.add(k);
console.log('\nGPU PASSES (compute, ms): mean σ p50 p95 max — frames present');
const rows = [...passes].map(k => { const a = F.map(f => f.gpu[k]).filter((v): v is number => typeof v === 'number'); return [k, stat(a)] as const; }).sort((a, b) => b[1].mean - a[1].mean);
for (const [k, s] of rows) console.log(`  ${k.padEnd(12)} ${f2(s.mean)} ${f2(s.sd)} ${f2(s.p50)} ${f2(s.p95)} ${f2(s.max)}   (${s.n})`);
// contention / sanity: gpuSum (and union) vs wall dt
const busy = F.filter(f => f.dt > 0); const ratio = stat(busy.map(f => f.gpuSum / Math.max(0.1, f.dt)));
const busyU = busy.filter(f => typeof f.gpuUnion === 'number'); const ratioU = stat(busyU.map(f => f.gpuUnion! / Math.max(0.1, f.dt)));
console.log(`\nGPU Σ / wall dt: mean ${ratio.mean.toFixed(2)}${busyU.length ? ` · GPU union / wall dt: mean ${ratioU.mean.toFixed(2)}` : ''} (union ≈1 = GPU-bound; ≪1 = CPU / vsync / another GPU client bound; Σ/wall > 1 = passes overlapped on the GPU and Σ double-counts; if two quiet baselines of the same view differ > 10 % suspect another WebGPU tab)`);
// spikes
const N = Number(arg('spikes', '10')); const pass = arg('pass');
const key = (f: Frame) => pass ? (f.gpu[pass] ?? 0) : f.dt;
const worst = [...F.keys()].sort((a, b) => key(F[b]) - key(F[a])).slice(0, N).sort((a, b) => a - b);
console.log(`\nWORST ${N} FRAMES by ${pass ? `gpu.${pass}` : 'wall dt'}: t(s) frame | dt fps | Σgpu top passes | preset res eff | cam | counts | events within ±1 s`);
for (const i of worst) {
  const f = F[i]; const top = Object.entries(f.gpu).filter(([k]) => !RENDER.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ');
  const ev = EV.filter(e => Math.abs(e.t - f.t) <= 1000).map(e => `${e.kind}:${e.text}`).join(' · ').slice(0, 160);
  console.log(`  ${(f.t / 1000).toFixed(1).padStart(6)} #${String(i).padEnd(5)} | ${f2(f.dt)} ${f1(f.fps)} | Σ${f.gpuSum.toFixed(1)}${typeof f.gpuUnion === 'number' ? ` ∪${f.gpuUnion.toFixed(1)}` : ''} ${top} | ${f.preset} ${f.res.join('×')} ×${f.eff} | ${f.cam.join(',')} | L${f.n.lights} dyn${f.n.dyn} p${f.n.particles} sm${f.n.smoke} ${f.n.guards} qrf:${f.n.qrf} rain${f.n.rain} | ${ev || '—'}`);
}
for (const l of stallLines(D as unknown as StallTake)) console.log(l);
for (const l of smokeText(D)) console.log(l);
if (nSweep) console.log(`\n(a SWEEP take: its ${nSweep} segment events are left out of the list below and read into the table at the end; the tables above cover every frame, flipped ones too)`);
if (nLong) console.log(`\n(${nLong} long frames or tasks the browser reported and holds of the thread the recorder saw are left out of the list below: the STALLS block sets those that fall in a listed stall beside it and counts the rest)`);
console.log(`\nEVENTS (${EV.length}):`); for (const e of EV.slice(0, 60)) console.log(`  ${(e.t / 1000).toFixed(1).padStart(6)} s  #${String(e.frame).padEnd(5)} ${e.kind.padEnd(9)} ${e.text}`); if (EV.length > 60) console.log(`  … ${EV.length - 60} more`);
const changed = Object.keys(D.settingsAtEnd).filter(k => D.settingsAtStart[k] !== D.settingsAtEnd[k]);
if (changed.length) console.log(`\nSETTINGS changed during the recording: ${changed.map(k => `${k} ${D.settingsAtStart[k]} → ${D.settingsAtEnd[k]}`).join(', ')}`);
for (const l of sweepLines) console.log(l);
