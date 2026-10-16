// THE OFFICE RESCUE, ARM AGAINST ARM — tables out of playthrough.ts's JSON for the question the 'holdglass' rule is asked (silent.ts silentGlassHolds): does a
// squad that holds its fire through the conference glass rescue as often and bring as many teammates home, and is a loud squad the same run it was?
//   bun run tools/qa/holdglass-tally.ts --col "today=a.json" --col "rule=b.json" [--pair today:rule …] [--same today:rule …] [--boot 4000]
// One row per --col: runs, rescued, hostages alive, teammates up, the second the floor first went loud (playthrough's def.loudAt), runs with a defender shot in
// the first 10 s, runs with a teammate lost. --pair A:B = B against A over the seeds both have: rescued and teammates up, the difference with a 95 % interval
// (paired bootstrap over seeds, its own seeded dice) and how many runs ended differently. --same A:B = how many (scenario, seed) keys have the same run digest
// AND the same movement digest in both (PT_DIGEST=1 runs) — the first that differ are named.
// exit 0 · 1 = a --same pair differs · 2 = bad flags / an unreadable file
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const bad = (why: string): never => { console.error(why); process.exit(2); };
const flags = (n: string) => args.flatMap((a, i) => a === n ? [args[i + 1] ?? bad(`${n} wants a value`)] : []);
for (let i = 0; i < args.length; i += 2) if (!['--col', '--pair', '--same', '--boot'].includes(args[i])) bad(`unknown flag '${args[i]}' (known: --col --pair --same --boot)`);
const BOOT = +(flags('--boot')[0] ?? 4000);
type Run = { scn: string; seed: number; end: string; t: number; team: number; of: number; hostages?: [number, number]; kills?: { t: number; who: string; by: string }[]; losses?: unknown[]; def?: { loudAt?: number | null }; digest?: string; digestMove?: string };
const cols = new Map<string, Map<string, Run>>();
for (const spec of flags('--col')) {
  const eq = spec.indexOf('='); if (eq < 0) bad(`--col wants name=file, got '${spec}'`);
  let runs: Run[] = []; try { runs = JSON.parse(readFileSync(spec.slice(eq + 1), 'utf8')).runs; } catch (e) { bad(`cannot read ${spec.slice(eq + 1)}: ${(e as Error).message}`); }
  cols.set(spec.slice(0, eq), new Map(runs.filter(r => r.end !== 'error').map(r => [`${r.scn}:${r.seed}`, r])));
}
if (!cols.size) bad('no --col');
const col = (n: string) => cols.get(n) ?? bad(`no column '${n}' (have: ${[...cols.keys()].join(', ')})`);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const med = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const won = (r: Run) => r.end === 'rescued' || r.end === 'taken' ? 1 : 0;

console.log('| arm | runs | won | hostages alive | teammates up | floor loud at (median s) | never loud | a defender shot before 10 s | runs with a teammate lost |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [name, m] of cols) {
  const R = [...m.values()]; const loud = R.map(r => r.def?.loudAt).filter((x): x is number => typeof x === 'number');
  const H = R.filter(r => r.hostages);
  console.log(`| ${name} | ${R.length} | ${sum(R.map(won))} | ${H.length ? `${sum(H.map(r => r.hostages![0]))} of ${sum(H.map(r => r.hostages![1]))}` : '—'} | ${sum(R.map(r => r.team))} of ${sum(R.map(r => r.of))} | ${loud.length ? med(loud).toFixed(1) : '—'} | ${R.length - loud.length} | ${R.filter(r => (r.kills ?? []).some(k => k.t < 10)).length} | ${R.filter(r => r.team < r.of).length} |`);
}

function dice(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function interval(d: number[]): [number, number] {
  const rnd = dice(20261008), n = d.length, tot: number[] = [];
  for (let b = 0; b < BOOT; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[(rnd() * n) | 0]; tot.push(s); }
  tot.sort((x, y) => x - y); return [tot[Math.floor(BOOT * 0.025)], tot[Math.ceil(BOOT * 0.975) - 1]];
}
const signed = (x: number) => (x > 0 ? '+' : '') + x;
for (const spec of flags('--pair')) {
  const [a, b] = spec.split(':'); const A = col(a), B = col(b); const keys = [...A.keys()].filter(k => B.has(k));
  const dW = keys.map(k => won(B.get(k)!) - won(A.get(k)!)), dT = keys.map(k => B.get(k)!.team - A.get(k)!.team), dH = keys.map(k => (B.get(k)!.hostages?.[0] ?? 0) - (A.get(k)!.hostages?.[0] ?? 0));
  const diff = keys.filter(k => { const x = A.get(k)!, y = B.get(k)!; return x.end !== y.end || x.team !== y.team || Math.abs(x.t - y.t) > 0.05; }).length;
  const line = (what: string, d: number[]) => { const [lo, hi] = interval(d); return `${what} ${signed(sum(d))} (95 % ${signed(lo)} to ${signed(hi)})`; };
  console.log(`\n**${b} against ${a}**, ${keys.length} seeds both ran: ${line('won', dW)} · ${line('hostages alive', dH)} · ${line('teammates up', dT)} · ${diff} of ${keys.length} runs end differently (end, second or teammates)`);
}
let differs = false;
for (const spec of flags('--same')) {
  const [a, b] = spec.split(':'); const A = col(a), B = col(b); const keys = [...A.keys()].filter(k => B.has(k));
  const noDigest = keys.filter(k => !A.get(k)!.digest || !B.get(k)!.digest).length;
  const off = keys.filter(k => A.get(k)!.digest !== B.get(k)!.digest || A.get(k)!.digestMove !== B.get(k)!.digestMove);
  if (off.length || noDigest || !keys.length) differs = true;
  console.log(`\n**${b} = ${a}?** ${keys.length - off.length} of ${keys.length} runs have the same run digest and movement digest${noDigest ? ` (${noDigest} runs carry no digest: run with PT_DIGEST=1)` : ''}${off.length ? ` · first that differ: ${off.slice(0, 6).join(', ')}` : ''}`);
}
process.exit(differs ? 1 : 0);
