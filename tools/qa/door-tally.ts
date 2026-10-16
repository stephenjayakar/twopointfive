// WHO CROWDS A DOORWAY, BEFORE AND AFTER — tables out of two folders of playthrough.ts runs (tools/qa/door-runs.sh writes one JSON a run; each carries the
// door watcher's counts, tools/qa/door-watch.ts) for the question 'does this build crowd its doorways less than that one, and does the team still win':
//   bun run tools/qa/door-tally.ts <before dir> <after dir> [--seeds lo-hi] [--boot 4000] [--doing 14]
// Only (scenario, seed) keys BOTH folders hold are counted, and a run that ended 'error' is dropped from both. It prints (markdown):
//   OUTCOMES   per scenario: runs, runs won (the place taken / the hostage out), teammates up per run either side, the difference with a 95 % interval
//              (paired bootstrap over the scenario's seeds, seeded dice), and how many of the pairs are the same run by digest
//   CROWDING   per side (the squad · the defenders), per measure: the mean per run either side, the difference with its interval, and after ÷ before —
//              over all scenarios (each run one draw, resampled inside its scenario), then per scenario for the measures that carry the answer
//   SMELLS     playthrough.ts's own per-run smells by kind (stuck, hung, doorway …), and how often each doorway rule acted in the after runs
//   DOING      the same seconds by what the men were under (the door order's phase, the order, the fight AI's state) — where it came from, where it went
// exit 0 · 2 = bad flags / nothing to pair
import { readdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2); const dirs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (dirs.length !== 2) { console.error('door-tally: <before dir> <after dir> [--seeds lo-hi] [--boot N] [--doing N]'); process.exit(2); }
const [LO, HI] = (flag('--seeds') ?? '1-1000000').split('-').map(Number), BOOT = +(flag('--boot') ?? 4000), DOING = +(flag('--doing') ?? 14);
type Run = { scn: string; seed: number; end: string; team: number; of: number; t: number; digest?: string; smells?: { kind: string }[]; doors?: { manners?: Record<string, number>; team: Record<string, number>; theirs: Record<string, number>; doing: Record<string, Record<string, number>> } };
function load(dir: string): Map<string, Run> {
  const m = new Map<string, Run>();
  for (const f of readdirSync(dir)) { if (!f.endsWith('.json')) continue; let r: Run; try { r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
    if (!r || !r.scn || r.end === 'error' || !r.doors || r.seed < LO || r.seed > (HI ?? LO)) continue; m.set(`${r.scn}:${r.seed}`, r); }
  return m;
}
const A = load(dirs[0]), B = load(dirs[1]);
const keys = [...A.keys()].filter(k => B.has(k)).sort();
if (!keys.length) { console.error('door-tally: no (scenario, seed) in both folders'); process.exit(2); }
const scns = [...new Set(keys.map(k => k.split(':')[0]))].sort();
const byScn = new Map<string, string[]>(scns.map(s => [s, keys.filter(k => k.startsWith(s + ':'))]));
// seeded dice (mulberry32): the same table twice
let seed = 0x5eed; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/** mean of f(after) − f(before) per run with a 95 % interval: pairs resampled inside each scenario */
function paired(f: (r: Run) => number, only?: string[]): { a: number; b: number; d: number; lo: number; hi: number; n: number } {
  const groups = (only ?? scns).map(s => byScn.get(s)!.map(k => [f(A.get(k)!), f(B.get(k)!)] as [number, number])).filter(x => x.length);
  const n = groups.reduce((s, x) => s + x.length, 0); let a = 0, b = 0; for (const G of groups) for (const [x, y] of G) { a += x; b += y; }
  const ds: number[] = [];
  for (let i = 0; i < BOOT; i++) { let d = 0; for (const G of groups) for (let j = 0; j < G.length; j++) { const p = G[Math.floor(rnd() * G.length)]; d += p[1] - p[0]; } ds.push(d / n); }
  ds.sort((x, y) => x - y);
  return { a: a / n, b: b / n, d: (b - a) / n, lo: ds[Math.floor(BOOT * 0.025)], hi: ds[Math.min(BOOT - 1, Math.floor(BOOT * 0.975))], n };
}
const f2 = (x: number) => Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
const sg = (x: number) => (x > 0 ? '+' : '') + f2(x);
const won = (r: Run) => r.end === 'taken' || r.end === 'rescued' ? 1 : 0;
const out: string[] = [];
out.push(`# Doorways: ${dirs[0].split('/').pop()} → ${dirs[1].split('/').pop()}`, '', `${keys.length} paired runs over ${scns.length} scenarios (seeds ${Math.min(...keys.map(k => +k.split(':')[1]))}–${Math.max(...keys.map(k => +k.split(':')[1]))}); intervals are 95 %, paired by seed inside each scenario, ${BOOT} resamples.`, '');
out.push('## Outcomes', '', '| scenario | runs | won before | won after | up/run before | up/run after | difference (95 %) | same run |', '|---|---|---|---|---|---|---|---|');
const outcome = (name: string, only?: string[]) => { const ks = (only ?? scns).flatMap(s => byScn.get(s)!); const w = paired(won, only), u = paired(r => r.team, only);
  const same = ks.filter(k => A.get(k)!.digest && A.get(k)!.digest === B.get(k)!.digest).length;
  out.push(`| ${name} | ${ks.length} | ${Math.round(w.a * w.n)} | ${Math.round(w.b * w.n)} | ${f2(u.a)} | ${f2(u.b)} | ${sg(u.d)} (${sg(u.lo)} … ${sg(u.hi)}) | ${same} |`); };
for (const s of scns) outcome(s, [s]); outcome('**all**');
{ const w = paired(won); out.push('', `Runs won, all scenarios: ${Math.round(w.a * w.n)} → ${Math.round(w.b * w.n)} of ${w.n} (${sg(w.d * 100)} points, ${sg(w.lo * 100)} … ${sg(w.hi * 100)}). Run length: ${f2(paired(r => r.t).a)} s → ${f2(paired(r => r.t).b)} s.`); }
const COLS: [string, string][] = [['open2', 'two or more in the opening at once, s'], ['openStand', 'standing in the opening, man-s'], ['openHeld', '… of that on a pinned post'], ['block', 'standing in the opening with a friend wanting through, s'], ['blockEvents', '… times'],
  ['sweepStand', 'standing where a leaf swings, man-s'], ['sweepHeld', '… of that on a pinned post'], ['sweepShut', '… of that at a shut leaf'], ['contact', 'bodies pushing each other by a door, pair-s'], ['contactOpen', '… with one of them in the opening (per door they are by)'], ['shoves', 'shoves by a door, count'],
  ['waitClose', 'waiting at a door under 0.75 m apart, s'], ['wait', 'waiting at a door (two or more on a face), s'], ['contactAll', 'bodies pushing anywhere on the floor, pair-s'], ['cross', 'walks through a frame'], ['near', 'man-s by a door at all']];
for (const side of ['team', 'theirs'] as const) {
  out.push('', `## Crowding · ${side === 'team' ? 'the squad' : 'the defenders'} (per run, all scenarios)`, '', '| measure | before | after | difference (95 %) | after ÷ before |', '|---|---|---|---|---|');
  for (const [c, label] of COLS) { const p = paired(r => r.doors![side][c] ?? 0); out.push(`| ${label} | ${f2(p.a)} | ${f2(p.b)} | ${sg(p.d)} (${sg(p.lo)} … ${sg(p.hi)}) | ${p.a > 0 ? (p.b / p.a).toFixed(2) : '–'} |`); }
  { const ks = keys.filter(k => A.get(k)!.doors![side].wait > 0 && B.get(k)!.doors![side].wait > 0);
    const m = (M: Map<string, Run>) => { let w = 0, s = 0; for (const k of ks) { w += M.get(k)!.doors![side].wait; s += M.get(k)!.doors![side].waitMinSum; } return w ? s / w : 0; };
    out.push(`| closest spacing while waiting, m (time-weighted) | ${f2(m(A))} | ${f2(m(B))} | | |`); }
  const PER = ['open2', 'openStand', 'sweepStand', 'contact', 'shoves', 'waitClose'];
  out.push('', `Per scenario, before → after (per run): ${PER.join(' · ')}`, '', `| scenario | ${PER.join(' | ')} |`, `|---|${PER.map(() => '---').join('|')}|`);
  for (const s of scns) out.push(`| ${s} | ${PER.map(c => { const p = paired(r => r.doors![side][c] ?? 0, [s]); return `${f2(p.a)} → ${f2(p.b)}${p.hi < 0 ? ' ↓' : p.lo > 0 ? ' ↑' : ''}`; }).join(' | ')} |`);
}
{ const DC = ['open2', 'openStand', 'block', 'sweepStand', 'contact', 'waitClose']; const sum = (M: Map<string, Run>) => { const T = new Map<string, Record<string, number>>(); for (const k of keys) for (const [w, v] of Object.entries(M.get(k)!.doors!.doing)) { let t = T.get(w); if (!t) T.set(w, t = {}); for (const [c, x] of Object.entries(v)) t[c] = (t[c] ?? 0) + x; } return T; };
  const TA = sum(A), TB = sum(B), names = [...new Set([...TA.keys(), ...TB.keys()])]; const tot = (T: Map<string, Record<string, number>>, n: string) => DC.reduce((s, c) => s + (T.get(n)?.[c] ?? 0), 0);
  names.sort((x, y) => Math.max(tot(TA, y), tot(TB, y)) - Math.max(tot(TA, x), tot(TB, x)));
  out.push('', `## By what the men were doing (totals over the ${keys.length} pairs, before → after; \`*\` = arrived on his order, \`:held\` = pinned on a post)`, '', `| doing | ${DC.join(' | ')} |`, `|---|${DC.map(() => '---').join('|')}|`);
  for (const n of names.slice(0, DOING)) out.push(`| ${n} | ${DC.map(c => `${(TA.get(n)?.[c] ?? 0).toFixed(0)} → ${(TB.get(n)?.[c] ?? 0).toFixed(0)}`).join(' | ')} |`); }
// the harness's own smells (playthrough.ts SMELLS: a man stuck short of his place, hung, standing in a doorway …): a rule that keeps men off each other must not leave them standing
{ const kinds = [...new Set(keys.flatMap(k => [...(A.get(k)!.smells ?? []), ...(B.get(k)!.smells ?? [])].map(x => x.kind)))].sort(); const n = (r: Run, kind: string) => (r.smells ?? []).filter(x => x.kind === kind).length;
  out.push('', '## The harness\'s smells (per run, all scenarios)', '', '| smell | before | after | difference (95 %) |', '|---|---|---|---|');
  for (const kind of kinds) { const p = paired(r => n(r, kind)); out.push(`| ${kind} | ${f2(p.a)} | ${f2(p.b)} | ${sg(p.d)} (${sg(p.lo)} … ${sg(p.hi)}) |`); }
  { const p = paired(r => (r.smells ?? []).length); out.push(`| **all** | ${f2(p.a)} | ${f2(p.b)} | ${sg(p.d)} (${sg(p.lo)} … ${sg(p.hi)}) |`); } }
{ const M = keys.map(k => B.get(k)!.doors!.manners).filter(Boolean) as Record<string, number>[];
  if (M.length) { const names = Object.keys(M[0]); out.push('', `The doorway rules at work in the after runs (per run, ${M.length} runs): ${names.map(n => `${n} ${f2(M.reduce((s, m) => s + (m[n] ?? 0), 0) / M.length)}`).join(' · ')} (held = a man eased to a stop for a friend at a door · aside = stepped off to a jamb · passed = went anyway after his patience · round = walked round a standing friend · stepped = stepped off an open doorway he was fighting from).`); } }
console.log(out.join('\n'));
