// THE WALL-CHARGE FRAME, BY FUNCTION — reads a sampling profile taken over tools/qa/blast-frame.ts --mark and cuts its samples into the blast frame (the
// trigger's call + the update it lands in) and the frames after it, by the marker functions that tool burns between them.
//   bun --cpu-prof --cpu-prof-interval=100 --cpu-prof-dir=<dir> --cpu-prof-name=x.cpuprofile run tools/qa/blast-frame.ts --scn depot-four --passes 1 --mark
//   bun run tools/qa/blast-frame-prof.ts <dir>/x.cpuprofile [--frame 0] [--top 40] [--under <function>]
//   --frame k   which frame after the trigger (0 = the blast frame, default; 1‥ = the ones after; `all` = 0‥4 summed)
//   --under fn  only the samples with `fn` on their stack (then the table is what runs UNDER it)
// Two tables: SELF ms by function, and INCLUSIVE ms by function (a function counted once a sample however deep it recurses). The profiler slows the run by about
// half: read the shares here, the milliseconds from a run without it.
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2), file = argv.find(a => !a.startsWith('--') && a.endsWith('.cpuprofile')); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
if (!file) { console.error('usage: blast-frame-prof.ts <file.cpuprofile> [--frame k|all] [--top N] [--under fn]'); process.exit(2); }
const P = JSON.parse(readFileSync(file, 'utf8')), TOP = Number(flag('--top') ?? 40), WANT = flag('--frame') ?? '0', UNDER = flag('--under');
const node = new Map<number, any>(P.nodes.map((n: any) => [n.id, n])), parent = new Map<number, number>(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const nameOf = (n: any) => { const f = n.callFrame, u = String(f.url ?? '').replace(/^.*\/(src|tools)\//, '$1/'); return `${f.functionName || '(anonymous)'} ${u}:${f.lineNumber}`; };
const stackOf = (id: number): number[] => { const s: number[] = []; for (let x: number | undefined = id; x !== undefined; x = parent.get(x)) s.push(x); return s; };
const has = (id: number, fn: string) => stackOf(id).some(x => node.get(x).callFrame.functionName === fn);
// the samples in order; a marker's run of samples closes a frame
type Seg = { self: Map<string, number>; incl: Map<string, number>; ms: number };
const blasts: Seg[][] = []; let cur: Seg[] | null = null, seg: Seg | null = null, inMark = false;
P.samples.forEach((id: number, i: number) => { const dt = (P.timeDeltas[i] ?? 0) / 1000;
  const begin = has(id, '__BLAST_MARK_BEGIN__'), frame = has(id, '__BLAST_MARK_FRAME__');
  if (begin) { if (!inMark) { cur = []; blasts.push(cur); seg = null; } inMark = true; return; }
  if (frame) { if (!inMark && seg) seg = null; inMark = true; return; }
  if (inMark) { inMark = false; if (cur) { seg = { self: new Map(), incl: new Map(), ms: 0 }; cur.push(seg); } }
  if (!seg) return;
  const st = stackOf(id); if (UNDER && !st.some(x => node.get(x).callFrame.functionName === UNDER)) return;
  seg.ms += dt; const top = nameOf(node.get(id)); seg.self.set(top, (seg.self.get(top) ?? 0) + dt);
  const seen = new Set<string>(); for (const x of st) { const n = nameOf(node.get(x)); if (seen.has(n)) continue; seen.add(n); seg.incl.set(n, (seg.incl.get(n) ?? 0) + dt); if (UNDER && node.get(x).callFrame.functionName === UNDER) break; }
});
// (each blast's last segment runs on to the next blast or the end of the run: dropped)
for (const b of blasts) b.pop();
const pick = (b: Seg[]): Seg[] => WANT === 'all' ? b.slice(0, 5) : [b[Number(WANT)]].filter(Boolean);
const self = new Map<string, number>(), incl = new Map<string, number>(); let ms = 0, n = 0;
for (const b of blasts) { const S = pick(b); if (!S.length) continue; n++; for (const s of S) { ms += s.ms; for (const [k, v] of s.self) self.set(k, (self.get(k) ?? 0) + v); for (const [k, v] of s.incl) incl.set(k, (incl.get(k) ?? 0) + v); } }
if (!n) { console.error('no marked blast in this profile (was the run made with --mark?)'); process.exit(1); }
console.log(`${n} blasts · frame ${WANT}${UNDER ? ` under ${UNDER}` : ''}: ${(ms / n).toFixed(2)} ms a blast under the profiler (${blasts.map(b => pick(b).reduce((a, s) => a + s.ms, 0).toFixed(1)).join(' ')})`);
const table = (title: string, m: Map<string, number>) => { console.log(`\n${title}`); for (const [k, v] of [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP)) console.log(`  ${(v / n).toFixed(2).padStart(6)} ms  ${(100 * v / ms).toFixed(1).padStart(5)} %  ${k}`); };
table('INCLUSIVE (ms a blast)', incl); table('SELF (ms a blast)', self);
