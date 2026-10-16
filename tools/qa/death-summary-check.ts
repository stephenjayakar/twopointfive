// A DEATH'S SUMMARY LINE IS TRUE — the check on the debrief's one-line summary (src/game/chronicle.ts summaryLine / badgesOf; the missions goal's fault S5a:
// a run on which a guard saw Sam and shot him read 'seen 1 · … · unseen by staff · went down' — the badge was about the CIVILIANS and named the staff).
//   bun run tools/qa/death-summary-check.ts [--seeds 1-2]
// What it does: plays solo-night.ts's walk plan with the night's opening off (TPS_OPENING=0: the quick death the fault was read on) and, for every run that
// ended DOWN (on this plan: a guard's round, fired by a man looking at him), reads the summary: it says 'went down', its 'seen' count is not 0, and none of its
// words says he was unseen ('never seen', 'unseen by staff').
// exit 0 = every such line is true · 1 = one is not, a run errored, or no run ended down (NO VERDICT: the check looked at nothing)
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const seeds = (flag('--seeds') ?? '1-2').split(',').flatMap(s => { const m = /^(\d+)-(\d+)$/.exec(s); if (!m) return [Number(s)]; const out: number[] = []; for (let k = +m[1]; k <= +m[2]; k++) out.push(k); return out; });
let failed = false, looked = 0;
const dir = mkdtempSync(resolve(tmpdir(), 'death-summary-'));
for (const seed of seeds) {
  const f = resolve(dir, `walk-${seed}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'solo-night.ts'), '--one', `walk:${seed}`, '--outfile', f, '--cap', '40'], { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, TPS_OPENING: '0' } }); await pr.exited;
  let r: any = null; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { /* */ }
  if (!r || r.end === 'error' || !r.summary) { failed = true; console.log(`- FAIL — walk:${seed} did not play (${r ? r.why.split('\n')[0] : 'no result file'})`); continue; }
  if (r.end !== 'down') { console.log(`- (walk:${seed} ended ${r.end}: not a death — not looked at)`); continue; }
  looked++;
  const s: string = r.summary, bad = [/never seen/, /unseen by staff/, /seen 0\b/].filter(x => x.test(s)).map(x => String(x)), ok = !bad.length && /went down/.test(s);
  if (!ok) failed = true;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — walk:${seed} (seen ${r.counts?.seen}, down at ${r.downAt} s): "${s.replace(/^twopointsix — /, '')}"${bad.length ? ` — says ${bad.join(', ')}` : ''}`);
}
rmSync(dir, { recursive: true, force: true });
if (!looked && !failed) { console.log('=== death-summary-check: NO VERDICT (no run ended down) ==='); process.exit(1); }
console.log(failed ? '=== death-summary-check: FAILED ===' : '=== death-summary-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
