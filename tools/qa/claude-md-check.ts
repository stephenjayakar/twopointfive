// CLAUDE.md IS AN INDEX: it is loaded into every agent session, so it must stay small; what it used to hold lives in docs/agents/<area>.md.
//   bun run tools/qa/claude-md-check.ts                 CLAUDE.md is at most 14 KB and 150 lines, and names every docs/agents file; exit 0 / 1
//   bun run tools/qa/claude-md-check.ts --base <rev>    also: every non-empty line of <rev>:CLAUDE.md is in today's CLAUDE.md or docs/agents —
//                                                       as often as it was, and a line the old file had once (and the index does not keep)
//                                                       is in exactly one area file. <rev> for the cut of 2026-10-13: 72a1c0ad
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_BYTES = 14_000, MAX_LINES = 150;   // (12 KB until the writing guide, which the maintainer asked to be in this file, came in)
let fails = 0;
const line = (ok: boolean, text: string) => { if (!ok) fails++; console.log(`  - ${ok ? 'PASS' : 'FAIL'} — ${text}`); };
const linesOf = (text: string) => text.split('\n').map(l => l.trimEnd()).filter(l => l !== '');

const index = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
const dir = join(ROOT, 'docs', 'agents');
const areas = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
const bytes = Buffer.byteLength(index), nLines = index.split('\n').length;
line(bytes <= MAX_BYTES, `CLAUDE.md is ${bytes} bytes (at most ${MAX_BYTES}): new bullets go into docs/agents/<area>.md`);
line(nLines <= MAX_LINES, `CLAUDE.md is ${nLines} lines (at most ${MAX_LINES})`);
const unnamed = areas.filter(f => !index.includes('`' + f + '`'));
line(areas.length > 0 && unnamed.length === 0, `the index names all ${areas.length} docs/agents files${unnamed.length ? ` — missing: ${unnamed.join(', ')}` : ''}`);

const at = process.argv.indexOf('--base');
if (at >= 0) {
  const rev = process.argv[at + 1];
  if (!rev) { console.log('--base wants a revision'); process.exit(2); }
  const old = linesOf(execFileSync('git', ['-C', ROOT, 'show', `${rev}:CLAUDE.md`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const count = (ls: string[]) => { const m = new Map<string, number>(); for (const l of ls) m.set(l, (m.get(l) ?? 0) + 1); return m; };
  const was = count(old), inIndex = count(linesOf(index));
  const perArea = areas.map(f => count(linesOf(readFileSync(join(dir, f), 'utf8'))));
  let lost = 0, split = 0, once = 0; const shown: string[] = [];
  for (const [l, n] of was) {
    const homes = perArea.filter(m => m.has(l)).length;
    const now = (inIndex.get(l) ?? 0) + perArea.reduce((s, m) => s + (m.get(l) ?? 0), 0);
    if (now < n) { lost++; if (shown.length < 5) shown.push(`lost (${now} of ${n}): ${l.slice(0, 110)}`); }
    if (n === 1 && !inIndex.has(l)) { once++; if (homes > 1) { split++; if (shown.length < 5) shown.push(`in ${homes} files: ${l.slice(0, 110)}`); } }
  }
  line(lost === 0, `every non-empty line of ${rev}:CLAUDE.md is still there, as often as it was (${old.length} lines, ${was.size} distinct, ${lost} lost)`);
  line(split === 0, `a line the old file had once is in exactly one area file (${once} such lines, ${split} in more than one)`);
  for (const s of shown) console.log('      ' + s);
}
console.log(fails ? `=== claude-md-check: ${fails} FAILED ===` : '=== claude-md-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
