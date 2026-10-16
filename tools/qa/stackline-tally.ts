// THE DOOR'S LINE, COUNTED — tables out of playthrough.ts's JSON run with PT_STACKLINE=1 (tools/qa/stackline-watch.ts): one column per file, the first is the
// one the others are set against, over the (scenario, seed) keys every column has.
//   PT_STACKLINE=1 bun run tools/qa/playthrough.ts --scn … --seeds 1-12 --json on.json
//   PT_STACKLINE=1 bun run tools/qa/playthrough.ts --scn … --seeds 1-12 --set '{"STACKLINE":{"on":false}}' --json off.json
//   bun run tools/qa/stackline-tally.ts off=off.json on=on.json[+more.json] [--deaths]
// What it prints (markdown): per scenario and column — men walking up to a door (a 'stack' mark or a door tool's own; walks of under WALK_M metres are the
// same marks dealt again and are left out): walks, seconds walking, seconds in the door's line and the floor on them (m²·s) with the leaves as they stood
// and with every leaf away, walks that crossed the opening · stacks (those with a walk in them): asked, formed (every man on his mark, gun on his watch),
// seconds to form (median, worst), not formed when the run ended · teammates lost while of such an order, walking up / on their marks, and how many of those
// by a round through the door's own opening · the run's ends: won, teammates up. Then, over all levels, the losses through the opening by what the man was
// doing: under 'stack' or a door tool, and whether the door already stood open when that order took him (a door the team opened itself, or a threshold
// held on purpose, is not a walk up to an open door). --deaths lists every such loss.
// exit 0 · 2 = bad flags / an unreadable file / a file run without the watcher
import { readFileSync } from 'node:fs';
import type { RunOut } from './playthrough.ts';
import type { WalkOut, StackOut, LineDeath } from './stackline-watch.ts';

type Run = RunOut & { stackline?: { walks: WalkOut[]; stacks: StackOut[]; deaths: LineDeath[] } };
const args = process.argv.slice(2), DEATHS = args.includes('--deaths'), specs = args.filter(a => a !== '--deaths');
if (!specs.length || specs.some(s => s.startsWith('--') || !s.includes('='))) { console.error('usage: stackline-tally.ts name=file.json[+file.json] … [--deaths]'); process.exit(2); }
const cols = specs.map(s => { const eq = s.indexOf('='), runs = new Map<string, Run>();
  for (const f of s.slice(eq + 1).split('+')) { let j: { runs: Run[] }; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: ${(e as Error).message}`); process.exit(2); }
    for (const r of j.runs) if (r.end !== 'error') runs.set(`${r.scn}:${r.seed}`, r); }
  return { name: s.slice(0, eq), runs }; });
const keys = [...cols[0].runs.keys()].filter(k => cols.every(c => c.runs.has(k)));
if (!keys.length) { console.error('no (scenario, seed) is in every column'); process.exit(2); }
if (cols.some(c => keys.some(k => !c.runs.get(k)!.stackline))) { console.error('a run has no stackline block: run playthrough.ts with PT_STACKLINE=1'); process.exit(2); }
const scns = [...new Set(keys.map(k => k.slice(0, k.lastIndexOf(':'))))];
const WALK_M = 0.3;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0), f1 = (x: number) => x.toFixed(1), med = (xs: number[]) => xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN;
function row(name: string, ks: string[], c: typeof cols[number]): string {
  const rs = ks.map(k => c.runs.get(k)!), W = rs.flatMap(r => r.stackline!.walks).filter(w => w.m >= WALK_M), S = rs.flatMap(r => r.stackline!.stacks).filter(s => s.formed === null || s.formed >= 0.3), D = rs.flatMap(r => r.stackline!.deaths);
  const formed = S.filter(s => s.formed !== null), late = S.filter(s => s.formed === null && s.end === 'run'), walkD = D.filter(d => d.phase === 'walk'), onD = D.filter(d => d.phase === 'stacked');
  return `| ${name} | ${c.name} | ${rs.length} | ${W.length} | ${f1(sum(W.map(w => w.secs)))} | ${f1(sum(W.map(w => w.now)))} | ${Math.round(sum(W.map(w => w.nowM2s)))} | ${f1(sum(W.map(w => w.geo)))} | ${Math.round(sum(W.map(w => w.geoM2s)))} | ${W.filter(w => w.crossed).length} | ${S.length} | ${formed.length} | ${f1(med(formed.map(s => s.formed!)))} | ${f1(Math.max(0, ...formed.map(s => s.formed!)))} | ${late.length} | ${walkD.length} (${walkD.filter(d => d.through).length}) | ${onD.length} (${onD.filter(d => d.through).length}) | ${rs.filter(r => (r.end === 'taken' || r.end === 'rescued')).length} | ${sum(rs.map(r => r.team))} of ${sum(rs.map(r => r.of))} |`;
}
console.log(`${keys.length} runs in every column\n`);
console.log('| level | build | runs | walks up | s walking | s in the line | m²·s | s (leaves away) | m²·s (leaves away) | crossed the opening | stacks | formed | s to form, median | worst | not formed at the end | lost walking up (through the opening) | lost on the marks (through it) | won | teammates up |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of [...scns, 'ALL']) for (const c of cols) console.log(row(s, s === 'ALL' ? keys : keys.filter(k => k.startsWith(s + ':')), c));
console.log('\n| build | lost through the opening | under stack, the door stood open when ordered | under stack, it was shut then | under a door tool, open when ordered | under a door tool, shut then | of them walking / on the mark |\n|---|---|---|---|---|---|---|');
for (const c of cols) { const D = keys.flatMap(k => c.runs.get(k)!.stackline!.deaths).filter(d => d.through), was = (d: LineDeath) => d.leaf0 === undefined ? null : d.leaf0 === 'open' || d.leaf0 === 'off', n = (st: boolean, op: boolean) => D.filter(d => (d.order === 'stack') === st && was(d) === op).length;
  console.log(`| ${c.name} | ${D.length} | ${n(true, true)} | ${n(true, false)} | ${n(false, true)} | ${n(false, false)} | ${D.filter(d => d.phase === 'walk').length} / ${D.filter(d => d.phase === 'stacked').length}${D.some(d => was(d) === null) ? ` (${D.filter(d => was(d) === null).length} from a run made before the watcher kept the order)` : ''} |`); }
if (DEATHS) for (const c of cols) { console.log(`\n${c.name}: teammates lost while of a stack`);
  for (const k of keys) for (const d of c.runs.get(k)!.stackline!.deaths) console.log(`- ${k} ${f1(d.t)} s · ${d.who} ${d.phase === 'walk' ? 'walking up to' : 'on his mark at'} ${d.door}${d.order ? ` (${d.order})` : ''} · leaf ${d.leaf}${d.leaf0 ? `, ${d.leaf0} when ordered` : ''} · killer ${d.by ?? '?'} ${d.beyond ? 'beyond it' : 'on his own side'}${d.through ? ', through the opening' : ''} · ${d.cells} cells of their floor on him · ${f1(d.depth)} m off the frame, ${f1(d.toMark)} m short of his mark`); }
