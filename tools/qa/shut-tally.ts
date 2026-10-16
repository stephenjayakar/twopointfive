// WHAT 'SHUT THAT DOOR' BUYS AND COSTS — tables out of folders of playthrough.ts runs (tools/qa/door-runs.sh writes one JSON a run): the scripted commander
// as he is against the same commander having every open door of each taken room shut before he gathers the team (PT_SHUT=1, game/shutdoor.ts).
//   bun run tools/qa/shut-tally.ts <without dir> <with dir> [more arm dirs …] [--seeds lo-hi] [--boot 4000] [--early 45]
// Every arm is paired with the FIRST folder by (scenario, seed); a pair with a run that ended 'error' is dropped. It prints (markdown), per scenario and arm:
//   pairs · teammates up per run either side and the difference with a 95 % interval (paired bootstrap over the seeds, seeded dice) · squads wiped (nobody
//   up) either side and the difference in wipes per run with its interval · teammates down before --early seconds, per run, the same way · the run's length ·
//   how many pairs are the same run by digest (PT_DIGEST)
// and for an arm that gave the order (its runs carry `shut`): orders given, doors latched, the seconds from the order to the latch (mean, median, worst),
// how many of the latched doors stand open again as the run ends, the seconds it cost a run, and what was refused, by reason.
// exit 0 · 2 = bad flags / nothing to pair
import { readdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2), dirs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
for (const a of args) if (a.startsWith('--') && !['--seeds', '--boot', '--early'].includes(a)) { console.error(`shut-tally: unknown flag ${a} (known: --seeds lo-hi, --boot N, --early secs)`); process.exit(2); }
if (dirs.length < 2) { console.error('shut-tally: <without dir> <with dir> [more arm dirs …] [--seeds lo-hi] [--boot N] [--early secs]'); process.exit(2); }
const [LO, HI] = (flag('--seeds') ?? '1-1000000').split('-').map(Number), BOOT = +(flag('--boot') ?? 4000), EARLY = +(flag('--early') ?? 45);
type Run = { scn: string; seed: number; end: string; team: number; of: number; t: number; digest?: string; refused?: string[]; deaths?: { t: number; who: string }[]; shut?: { door: string; t: number; secs: number; latched: boolean; open?: boolean }[] };
function load(dir: string): Map<string, Run> {
  const m = new Map<string, Run>();
  for (const f of readdirSync(dir)) { if (!f.endsWith('.json')) continue; let r: Run; try { r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
    if (!r || !r.scn || r.end === 'error' || r.seed < LO || r.seed > (HI ?? LO)) continue; m.set(`${r.scn}:${r.seed}`, r); }
  return m;
}
function dice(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / (x.length || 1);
const med = (x: number[]) => { const s = [...x].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
/** the mean of the paired differences with a 95 % percentile interval (the seeds resampled with replacement) */
function paired(d: number[]): string {
  if (!d.length) return '—'; const rnd = dice(20261008), n = d.length, ms: number[] = [];
  for (let b = 0; b < BOOT; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[(rnd() * n) | 0]; ms.push(s / n); }
  ms.sort((a, b) => a - b); const f = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(2);
  return `${f(mean(d))} [${f(ms[Math.floor(BOOT * 0.025)])}, ${f(ms[Math.ceil(BOOT * 0.975) - 1])}]`;
}
const early = (r: Run) => (r.deaths ?? []).filter(x => x.t < EARLY).length;

const A = load(dirs[0]);
let any = false;
for (const dir of dirs.slice(1)) {
  const B = load(dir), keys = [...A.keys()].filter(k => B.has(k)).sort(), scns = [...new Set(keys.map(k => k.split(':')[0]))].sort();
  console.log(`\n## ${dirs[0]} → ${dir}\n`);
  if (!keys.length) { console.log('(no scenario and seed in both folders)'); continue; } any = true;
  console.log(`| scenario | pairs | teammates up: without → with | difference, 95 % | squads wiped: without → with | wipes per run, 95 % | down before ${EARLY} s per run: without → with | difference, 95 % | run length s: without → with | same run by digest |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const scn of [...scns, 'ALL']) { const ks = scn === 'ALL' ? keys : keys.filter(k => k.startsWith(scn + ':')); if (scn === 'ALL' && scns.length < 2) continue;
    const a = ks.map(k => A.get(k)!), b = ks.map(k => B.get(k)!), of = a[0].of;
    const same = ks.filter((_, i) => a[i].digest && a[i].digest === b[i].digest).length;
    console.log(`| ${scn} | ${ks.length} | ${mean(a.map(r => r.team)).toFixed(2)} → ${mean(b.map(r => r.team)).toFixed(2)}${scn === 'ALL' ? '' : ` of ${of}`} (${a.reduce((s, r) => s + r.team, 0)} → ${b.reduce((s, r) => s + r.team, 0)}) | ${paired(a.map((r, i) => b[i].team - r.team))} | ${a.filter(r => r.team === 0).length} → ${b.filter(r => r.team === 0).length} | ${paired(a.map((r, i) => Number(b[i].team === 0) - Number(r.team === 0)))} | ${mean(a.map(early)).toFixed(2)} → ${mean(b.map(early)).toFixed(2)} | ${paired(a.map((r, i) => early(b[i]) - early(r)))} | ${mean(a.map(r => r.t)).toFixed(0)} → ${mean(b.map(r => r.t)).toFixed(0)} | ${same} |`); }
  // the order itself, where the arm gave it
  if (![...B.values()].some(r => r.shut)) continue;
  console.log(`\n| scenario | runs | orders asked | taken | doors latched | seconds to the latch: mean · median · worst | taken orders that never latched | latched doors open again at the run's end | seconds a run spent on it | refused, by reason |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const scn of scns) { const rs = keys.filter(k => k.startsWith(scn + ':')).map(k => B.get(k)!), all = rs.flatMap(r => r.shut ?? []);
    const why = new Map<string, number>(); for (const r of rs) for (const x of r.refused ?? []) { const m = /^shutDoor [^:]*: (.*)$/.exec(x); if (m) { const w = m[1].replace(/^(Red|Blue|Gold) (One|Two) is/, 'a teammate is'); why.set(w, (why.get(w) ?? 0) + 1); } }
    const refused = [...why.values()].reduce((a, b) => a + b, 0), taken = all.length - refused, got = all.filter(x => x.latched && x.secs > 0.05), ok = got.map(x => x.secs);
    console.log(`| ${scn} | ${rs.length} | ${all.length} | ${taken} | ${got.length} | ${ok.length ? `${mean(ok).toFixed(1)} · ${med(ok).toFixed(1)} · ${Math.max(...ok).toFixed(1)}` : '—'} | ${taken - got.length} | ${got.filter(x => x.open).length} of ${got.length} | ${mean(rs.map(r => (r.shut ?? []).reduce((s, x) => s + x.secs, 0))).toFixed(1)} | ${[...why].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} × ${w}`).join(' · ') || 'none'} |`); }
}
process.exit(any ? 0 : 2);
