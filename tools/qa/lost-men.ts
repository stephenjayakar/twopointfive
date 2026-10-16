// WHO IS LOST, AND IS IT MORE THAN LUCK — tables out of playthrough.ts's JSON for the question 'this build keeps fewer teammates up than that one': one COLUMN
// per file (or files joined with +, cut to a seed range with :lo-hi), the FIRST column is the one the others are set against.
//   bun run tools/qa/lost-men.ts --col "before=a.json" --col "after=b.json+c.json:1-144" [--scn room-clear-four,depot-four] [--block 24] [--deaths] [--named 1-24] [--boot 4000]
// What it prints (markdown):
//   TOTALS       per scenario and column: runs, won, teammates up, up per run, squads wiped, how many runs ended with 0‥n up, and the total of every whole
//                BLOCK of --block consecutive seeds (1‥block, block+1‥2·block, … — the same seeds in every column; a block with a seed missing is left
//                out) — the spread of those blocks IS the scatter a table of that many seeds has, with no model in it
//   AGAINST      each later column against the first over the (scenario, seed) keys both have: teammates up either side, the difference with a 95 % interval
//                (paired bootstrap inside each scenario, its own seeded dice), the same per --block seeds of each scenario, HOW MANY RUNS ARE THE SAME RUN
//                (end, second, teammates — a change that leaves most runs identical can be weighed on the few it touches; one that leaves none identical
//                has made every run a new draw) and the correlation of teammates-up per seed between the two, taken inside each scenario (near 0: the
//                same seed tells nothing across the change — 'same-seed' cancels no noise and the two columns are two independent samples)
//   --deaths     teammates' deaths per --block runs by man, by the door order he was last a man of and when (LossOut.at), by his order, by 20-second
//                bucket, by whether his killer stood more than 75° off his gun, and by the uncleared opening his killer had walked through (Death.came).
//                A LossOut is every teammate's death; a Death only one whose killer is known and is not of the team — joined by man and second, a loss
//                with no Death row is filed 'killer not recorded'
//   --named a-b  every (scenario, seed) in that range where the first two columns end with different teammates up, each side's lost men by name
// A run that ended 'error' (a worker that left no result: team 0 of 0) is dropped from EVERY column, and said.
// exit 0 · 2 = bad flags / an unreadable file
import { readFileSync } from 'node:fs';
import type { RunOut, Death, LossOut } from './playthrough.ts';

const args = process.argv.slice(2);
const bad = (why: string): never => { console.error(why); process.exit(2); };
const VALUED = ['--col', '--scn', '--block', '--named', '--boot'], BARE = ['--deaths'];
for (let i = 0; i < args.length; i++) {
  if (BARE.includes(args[i])) continue;
  if (!VALUED.includes(args[i])) bad(`unknown flag '${args[i]}' (known: ${[...VALUED, ...BARE].join(' ')})`);
  if (args[i + 1] === undefined || args[i + 1].startsWith('--')) bad(`${args[i]} wants a value`);
  i++;
}
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const flags = (n: string) => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
const whole = (n: string, dflt: number) => { const v = flag(n); if (v === undefined) return dflt; if (!/^\d+$/.test(v) || +v < 1) bad(`${n} wants a whole number of 1 or more, got '${v}'`); return +v!; };
const BLOCK = whole('--block', 24), BOOT = whole('--boot', 4000);
const range = (s: string): [number, number] => { if (!/^\d+(-\d+)?$/.test(s)) bad(`a seed range is lo-hi, got '${s}'`); const [a, b] = s.split('-').map(Number); return [a, b ?? a]; };
type Col = { name: string; runs: Map<string, RunOut> };
const key = (scn: string, seed: number) => `${scn}:${seed}`;
function load(spec: string): Col {
  const eq = spec.indexOf('='); if (eq < 0) bad(`--col wants name=file[+file][:lo-hi], got '${spec}'`);
  const name = spec.slice(0, eq); let files = spec.slice(eq + 1), lo = 1, hi = Infinity;
  const m = /:(\d+(?:-\d+)?)$/.exec(files); if (m) { [lo, hi] = range(m[1]); files = files.slice(0, m.index); }
  const runs = new Map<string, RunOut>();
  for (const f of files.split('+')) {
    let list: RunOut[] = [];
    try { list = JSON.parse(readFileSync(f, 'utf8')).runs; if (!Array.isArray(list)) throw new Error('no "runs" array (a playthrough.ts --json file is wanted)'); }
    catch (e) { bad(`cannot read ${f}: ${(e as Error).message}`); }
    for (const r of list) if (r.seed >= lo && r.seed <= hi) runs.set(key(r.scn, r.seed), r);
  }
  return { name, runs };
}
const cols = flags('--col').map(load); if (!cols.length) bad('no --col');
const named = flag('--named'); if (named && cols.length < 2) bad('--named sets the first two columns against each other: two --col wanted');
const errors = new Set(cols.flatMap(c => [...c.runs].filter(([, r]) => r.end === 'error').map(([k]) => k)));
for (const c of cols) for (const k of errors) c.runs.delete(k);
if (errors.size) console.log(`(${errors.size} run${errors.size > 1 ? 's' : ''} that ended 'error' in some column dropped from every column: ${[...errors].join(', ')})\n`);
const SCN = (flag('--scn') ?? [...new Set(cols.flatMap(c => [...c.runs.values()].map(r => r.scn)))].join(',')).split(',');
const WELL = new Set(['taken', 'rescued']);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const of = (c: Col, scn: string) => [...c.runs.values()].filter(r => r.scn === scn).sort((a, b) => a.seed - b.seed);
function dice(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the correlation of teammates-up per seed, each scenario's pairs taken about that scenario's own means (two scenarios with different averages would
 *  otherwise read as 'the same seed agrees') */
function corr(per: (readonly [RunOut, RunOut])[][]) {
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of per) { if (!p.length) continue; const mx = sum(p.map(q => q[0].team)) / p.length, my = sum(p.map(q => q[1].team)) / p.length; for (const [a, b] of p) { sxy += (a.team - mx) * (b.team - my); sxx += (a.team - mx) ** 2; syy += (b.team - my) ** 2; } }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
/** 95 % interval of Σ over scenarios of weight × (the summed paired difference), the pairs resampled inside each scenario */
function boot(byScn: number[][], w: number[]): [number, number] {
  const rnd = dice(4000), sims: number[] = [];
  for (let b = 0; b < BOOT; b++) { let t = 0; byScn.forEach((d, s) => { for (let i = 0; i < d.length; i++) t += w[s] * d[(rnd() * d.length) | 0]; }); sims.push(t); }
  sims.sort((a, b) => a - b); return [sims[Math.floor(0.025 * BOOT)], sims[Math.min(BOOT - 1, Math.floor(0.975 * BOOT))]];
}
const sgn = (x: number, d = 0) => (x > 0 ? '+' : '') + x.toFixed(d);

console.log('## Totals\n'); console.log(`| scenario | column | runs | won | up | per run | wiped | runs with 0‥n up | blocks of ${BLOCK} seeds |`); console.log('|---|---|---|---|---|---|---|---|---|');
for (const s of SCN) for (const c of cols) {
  const rs = of(c, s); if (!rs.length) continue;
  const n = Math.max(...rs.map(r => r.of)), dist = Array.from({ length: n + 1 }, (_, k) => rs.filter(r => r.team === k).length), blocks: string[] = [];
  for (let a = Math.floor((rs[0].seed - 1) / BLOCK) * BLOCK + 1; a <= rs[rs.length - 1].seed; a += BLOCK) { const b = Array.from({ length: BLOCK }, (_, i) => c.runs.get(key(s, a + i))); if (b.every(Boolean)) blocks.push(String(sum(b.map(r => r!.team)))); }
  console.log(`| ${s} | ${c.name} | ${rs.length} | ${rs.filter(r => WELL.has(r.end)).length} | ${sum(rs.map(r => r.team))}/${sum(rs.map(r => r.of))} | ${(sum(rs.map(r => r.team)) / rs.length).toFixed(2)} | ${dist[0]} | ${dist.join(' ')} | ${blocks.join(' ') || '—'} |`);
}

if (cols.length > 1) {
  const ref = cols[0];
  console.log(`\n## Against ${ref.name}\n`); console.log(`| column | scenario | seeds | ${ref.name} up | column up | difference (95 %) | per ${BLOCK} seeds | same run | correlation |`); console.log('|---|---|---|---|---|---|---|---|---|');
  for (const c of cols.slice(1)) for (const s of [...SCN, ...(SCN.length > 1 ? ['all'] : [])]) {
    const per = (s === 'all' ? SCN : [s]).map(x => of(c, x).filter(r => ref.runs.has(key(r.scn, r.seed))).map(r => [ref.runs.get(key(r.scn, r.seed))!, r] as const)).filter(p => p.length);
    const pairs = per.flat(); if (!pairs.length) continue;
    const d = per.map(p => p.map(([a, b]) => b.team - a.team)), one = d.map(() => 1), rate = per.map(p => BLOCK / p.length);
    const [lo, hi] = boot(d, one), [rlo, rhi] = boot(d, rate), seeds = per.map(p => p.length);
    const same = pairs.filter(([a, b]) => a.end === b.end && a.t === b.t && a.team === b.team).length;
    console.log(`| ${c.name} | ${s} | ${Math.min(...seeds) === Math.max(...seeds) ? seeds[0] : seeds.join(' + ')} | ${sum(pairs.map(p => p[0].team))}/${sum(pairs.map(p => p[0].of))} | ${sum(pairs.map(p => p[1].team))}/${sum(pairs.map(p => p[1].of))} | ${sgn(sum(d.flat()))} (${sgn(lo)} to ${sgn(hi)}) | ${sgn(sum(d.map((x, i) => sum(x) * rate[i])), 1)} (${sgn(rlo, 1)} to ${sgn(rhi, 1)}) | ${same} of ${pairs.length} | ${sgn(corr(per), 2)} |`);
  }
}

if (args.includes('--deaths')) {
  type Row = { who: string; t: number; d?: Death; l: LossOut };
  const bucket = (t: number) => { const a = Math.floor(t / 20) * 20; return `${String(a).padStart(3, '0')}–${a + 20} s`; };
  const TABLES: [string, (r: Row) => string, boolean?][] = [
    ['man', r => r.who], ['door order · when', r => `${r.l.door ?? '—'} · ${r.l.at}`], ['his order', r => r.d ? r.d.order.split(' (')[0].split(' ·')[0] : 'killer not recorded'],
    ['second', r => bucket(r.t), true], ['killer off his gun', r => !r.d ? 'killer not recorded' : r.d.off > 75 ? 'over 75° (side or back)' : 'under 75°'],
    ['killer came through', r => !r.d ? 'killer not recorded' : r.d.came === undefined ? '(not in this file)' : r.d.came ?? 'no uncleared opening in the 8 s before'],
  ];
  for (const s of SCN) {
    console.log(`\n## Deaths per ${BLOCK} runs · ${s}\n`);
    const rows = cols.map(c => { const rs = of(c, s); return { n: rs.length, rows: rs.flatMap(r => (r.losses ?? []).map((l): Row => ({ who: l.who, t: l.t, l, d: r.deaths?.find(d => d.who === l.who && d.t === l.t) }))) }; });
    for (const [title, by, inOrder] of TABLES) {
      const count = rows.map(c => { const m = new Map<string, number>(); for (const r of c.rows) m.set(by(r), (m.get(by(r)) ?? 0) + 1); return m; });
      const per = (m: Map<string, number>, i: number, k: string) => rows[i].n ? (m.get(k) ?? 0) * BLOCK / rows[i].n : 0;
      const all = [...new Set(count.flatMap(m => [...m.keys()]))].sort((a, b) => sum(count.map((m, i) => per(m, i, b))) - sum(count.map((m, i) => per(m, i, a))));
      const keys = all.slice(0, 10), rest = all.slice(10); if (inOrder) keys.sort();
      console.log(`| ${title} | ${cols.map(c => c.name).join(' | ')} |`); console.log('|---|' + cols.map(() => '---|').join(''));
      for (const k of keys) console.log(`| ${k} | ${count.map((m, i) => rows[i].n ? per(m, i, k).toFixed(1) : '—').join(' | ')} |`);
      if (rest.length) console.log(`| (${rest.length} more) | ${count.map((m, i) => rows[i].n ? sum(rest.map(k => per(m, i, k))).toFixed(1) : '—').join(' | ')} |`);
      console.log('');
    }
  }
}

if (named) {
  const [lo, hi] = range(named), [a, b] = cols;
  const men = (r: RunOut) => (r.losses ?? []).map(l => { const d = r.deaths?.find(x => x.who === l.who && x.t === l.t); return `${l.who} at ${l.t.toFixed(0)} s by ${d?.by ?? 'killer not recorded'} (${d ? d.order.split(' (')[0].split(' ·')[0] + '; ' : ''}${l.door ?? '—'}, ${l.at})`; }).join('; ') || 'nobody';
  console.log(`\n## Seeds ${lo} to ${hi} where ${a.name} and ${b.name} end with different teammates up\n`); console.log(`| scenario | seed | ${a.name} | ${b.name} | lost on ${a.name} | lost on ${b.name} |`); console.log('|---|---|---|---|---|---|');
  for (const s of SCN) for (const r of of(a, s)) {
    const o = b.runs.get(key(s, r.seed)); if (!o || r.seed < lo || r.seed > hi || o.team === r.team) continue;
    console.log(`| ${s} | ${r.seed} | ${r.team} up, ${r.end} ${r.t} s | ${o.team} up, ${o.end} ${o.t} s | ${men(r)} | ${men(o)} |`);
  }
}
