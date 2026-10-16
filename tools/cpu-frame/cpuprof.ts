// cpuprof.ts — read a `bun --cpu-prof` .cpuprofile and table it the way a frame-budget question wants:
//   bun tools/cpu-frame/cpuprof.ts <file.cpuprofile> [--under stepFrame] [--top 30] [--by file|fn|line] [--incl <regex>]
// --under NAME   only samples whose stack contains a frame named NAME (e.g. stepFrame = the steady-state frame; without it the boot is in the table)
// --by fn        aggregate self time by function name + file (default; 'line' keeps the line, 'file' folds a whole file)
// --incl REGEX   also print the INCLUSIVE time of every function whose name+file matches (Game.update's sub-sites: `--incl 'game/(guards|player|game)\.ts'`)
// Times are samples × the profile's interval; percentages are of the samples kept (after --under).
import { readFileSync } from 'node:fs';

interface Node { id: number; callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number }; children?: number[]; parent?: number; }
interface Prof { nodes: Node[]; samples: number[]; timeDeltas: number[]; startTime: number; endTime: number; }

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')); if (!file) { console.error('usage: cpuprof.ts <file.cpuprofile> [--under NAME] [--top N] [--by fn|line|file] [--incl REGEX]'); process.exit(2); }
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const under = opt('under', ''), top = Number(opt('top', '30')), by = opt('by', 'fn'), incl = opt('incl', '');

const P: Prof = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map<number, Node>(); for (const n of P.nodes) byId.set(n.id, n);
for (const n of P.nodes) for (const c of n.children ?? []) { const cn = byId.get(c); if (cn) cn.parent = n.id; }
const short = (u: string) => u.replace(/^.*\/(src|tools)\//, '$1/').replace(/^file:\/\//, '');
const key = (n: Node) => { const f = n.callFrame; const fn = f.functionName || '(anonymous)'; const u = short(f.url); return by === 'file' ? u : by === 'line' ? `${fn} ${u}:${f.lineNumber + 1}` : `${fn} ${u}`; };
// per-sample: walk to the root; keep if `under` is on the stack; add self to the leaf's key and inclusive to every distinct key on the stack
const self = new Map<string, number>(), inclM = new Map<string, number>(); let kept = 0, total = 0;
const interval = P.timeDeltas.length ? P.timeDeltas.reduce((a, b) => a + b, 0) / P.timeDeltas.length : 1000;   // µs
const stackKeys = new Set<string>();
for (let i = 0; i < P.samples.length; i++) {
  total++;
  let n = byId.get(P.samples[i]); if (!n) continue;
  const leafKey = key(n); stackKeys.clear(); let ok = !under;
  for (let m: Node | undefined = n; m; m = m.parent !== undefined ? byId.get(m.parent) : undefined) { if (!ok && m.callFrame.functionName === under) ok = true; stackKeys.add(key(m)); }
  if (!ok) continue;
  kept++;
  self.set(leafKey, (self.get(leafKey) ?? 0) + 1);
  for (const k of stackKeys) inclM.set(k, (inclM.get(k) ?? 0) + 1);
}
const ms = (s: number) => (s * interval / 1000).toFixed(1).padStart(8);
const pct = (s: number) => (100 * s / Math.max(1, kept)).toFixed(1).padStart(5);
console.log(`${file}: ${total} samples × ${interval.toFixed(0)} µs${under ? `, ${kept} under ${under} (${(100 * kept / total).toFixed(0)} %)` : ''} — ${(kept * interval / 1000).toFixed(0)} ms kept`);
console.log(`\nSELF time, top ${top} (by ${by}):`);
console.log(`  self%   self ms  incl ms  where`);
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, s]) => console.log(`  ${pct(s)} ${ms(s)} ${ms(inclM.get(k) ?? 0)}  ${k}`));
if (incl) {
  const re = new RegExp(incl);
  console.log(`\nINCLUSIVE time of functions matching /${incl}/ (top ${top}):`);
  console.log(`  incl%   incl ms  self ms  where`);
  [...inclM.entries()].filter(([k]) => re.test(k)).sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, s]) => console.log(`  ${pct(s)} ${ms(s)} ${ms(self.get(k) ?? 0)}  ${k}`));
}
