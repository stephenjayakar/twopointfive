// WHAT THE BALLISTIC SHIELD DOES TO A RUN, COUNTED (game/shield.ts): playthrough.ts's scripted player over the same seeds with the squad's cards set one way per ARM,
// read PAIRED by seed. A handful of seeds is noise: the default is 144 an arm.
//   bun run tools/qa/shield-tally.ts [--scn room-clear-four] [--seeds 1-144] [--arms none,shield1,pistol1] [--jobs 4] [--json out.json] [--reuse earlier.json]
// (--reuse: arms already in an earlier --json of the same scenario and seeds are read from it, not played again — only for arms the change since cannot have
//  touched. Exit 1 on any run that threw or any part that did not come back.)
// ARMS (teammate 1 is the first of the staged team; 'none' is the build as issued):
//   none          every card as issued
//   shield1       teammate 1 carries the shield (so a pistol), leads the stack, goes in first                     shield2: the same on teammate 2
//   pistol1       teammate 1 carries a pistol and NO shield — the control that says what the plate does over what losing his rifle does
//   shield1-rear  the shield, but he neither takes the lead's mark nor goes first (SHIELD.first off)
//   shield1-dumb  the shield against defenders who never learn it (SHIELD.aimLow and SHIELD.retarget off): what their coming down under it costs him
// Per arm: runs won, men up of men staged, how often the seat's man (teammate 1 or 2) lived, mean seconds; rounds the plate stopped, defenders who came down
// under it / went to another man, entries he led, and where the rounds that dropped him came from. Then, against the first arm, the paired difference in men up
// and in the seat's survival with a bootstrap 95 % interval over seeds (2000 resamples, its own seeded dice).
import { ROOT } from './headless.ts';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const argv = process.argv.slice(2), arg = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const scn = arg('scn', 'room-clear-four'), arms = arg('arms', 'none,shield1,pistol1').split(','), jobs = Math.max(1, Number(arg('jobs', '4')));
const seedsOf = (s: string) => s.split(',').flatMap(p => { const [a, b] = p.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_x, i) => a + i); });
const seeds = seedsOf(arg('seeds', '1-144'));
process.env.TPS_SHIELD ??= '1';   // (the shield is out of the page since 10-15: this tool counts what it does, on either stand)
const ARMS: Record<string, { seat: number; set: (K: any, SHIELD: any) => void }> = {
  none: { seat: 1, set: () => {} },
  shield1: { seat: 1, set: K => K.kitSet(1, 'shield', true) }, shield2: { seat: 2, set: K => K.kitSet(2, 'shield', true) },
  pistol1: { seat: 1, set: K => K.kitSet(1, 'weapon', 'pistol') },
  'shield1-rear': { seat: 1, set: (K, S) => { K.kitSet(1, 'shield', true); S.first = false; } },
  'shield1-dumb': { seat: 1, set: (K, S) => { K.kitSet(1, 'shield', true); S.aimLow = false; S.retarget = false; } },
};
for (const a of arms) if (!ARMS[a]) { console.log(`shield-tally: no arm '${a}' — one of ${Object.keys(ARMS).join(', ')}`); process.exit(2); }
interface Row { arm: string; seed: number; end: string; t: number; team: number; of: number; hostiles: number; hostilesOf: number; seatUp: boolean; seat: string; stats: Record<string, number>; lost: { deg: number; y: number; dist: number; by: string }[]; why?: string }

if (argv.includes('--child')) {
  const K = await import(`${ROOT}/src/game/kit.ts`), SH = await import(`${ROOT}/src/game/shield.ts`), { play } = await import('./playthrough.ts');
  SH.SHIELD.on = true;   // (out of the page since 10-15: the word above holds it in under a stand-up, this before one — an arm sets its card first)
  const shipped = { ...SH.SHIELD }, rows: Row[] = [], arm = arg('arm', 'none'), A = ARMS[arm];
  const log = console.log, err = console.error, warn = console.warn;
  for (const seed of seeds) {
    K.kitLoad(null, '?noslots'); K.kitReset();   // (the free rows: a shield ADDED to the issued kit, as these arms were always counted — under the pouches rule it is a trade, kit.ts kitLoadout('shield'))
    Object.assign(SH.SHIELD, shipped); A.set(K, SH.SHIELD);
    for (const k of Object.keys(SH.SHIELD_STATS)) SH.SHIELD_STATS[k] = 0; SH.SHIELD_LOG.length = 0;
    console.log = console.error = console.warn = () => {};
    let r: any; try { r = await play(scn, seed, 300); } finally { console.log = log; console.error = err; console.warn = warn; }
    const man = K.KIT_STAGED.ops[A.seat - 1];
    rows.push({ arm, seed, end: r.end, t: r.t, team: r.team, of: r.of, hostiles: r.hostiles, hostilesOf: r.hostilesOf, seatUp: !!man && man.state !== 'dead', seat: man?.callsign ?? '?', stats: { ...SH.SHIELD_STATS }, lost: SH.SHIELD_LOG.map((x: any) => ({ deg: x.deg, y: x.y, dist: x.dist, by: x.by })), ...(r.end === 'error' ? { why: String(r.why).split('\n')[0] } : {}) });
  }
  writeFileSync(arg('out', ''), JSON.stringify(rows)); process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'shield-tally-')), all: Row[] = []; let lostParts = 0;
const old: Row[] = arg('reuse', '') ? JSON.parse(readFileSync(arg('reuse', ''), 'utf8')).rows : [];
for (const arm of arms) {
  const kept = old.filter(r => r.arm === arm && seeds.includes(r.seed)); if (kept.length === seeds.length) { all.push(...kept); console.log(`  (${arm}: ${kept.length} runs reused from ${arg('reuse', '')})`); continue; }
  const parts = Array.from({ length: Math.min(jobs, seeds.length) }, (_x, j) => seeds.filter((_s, i) => i % jobs === j));
  const t0 = Date.now();
  const done = await Promise.all(parts.map(async (part, j) => {
    const out = join(dir, `${arm}-${j}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--child', '--arm', arm, '--scn', scn, '--seeds', part.join(','), '--out', out], { stdout: 'ignore', stderr: 'pipe', env: process.env });
    const code = await pr.exited; if (code !== 0) { console.log(`shield-tally: ${arm} part ${j} exited ${code}: ${(await new Response(pr.stderr).text()).split('\n').slice(-4).join(' | ')}`); lostParts++; return [] as Row[]; }
    return JSON.parse(readFileSync(out, 'utf8')) as Row[];
  }));
  all.push(...done.flat());
  console.log(`  (${arm}: ${done.flat().length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const WIN = new Set(['taken', 'rescued']);
function dice(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function boot(d: number[]): [number, number, number] { const n = d.length, R = dice(20261008), means: number[] = []; if (!n) return [NaN, NaN, NaN];
  for (let k = 0; k < 2000; k++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(R() * n)]; means.push(s / n); } means.sort((a, b) => a - b);
  return [d.reduce((a, b) => a + b, 0) / n, means[Math.floor(0.025 * 2000)], means[Math.floor(0.975 * 2000)]]; }
const f2 = (x: number) => x.toFixed(2), pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(0)} %` : '-';
const by = (arm: string) => all.filter(r => r.arm === arm && r.end !== 'error');
console.log(`\nSHIELD-TALLY · ${scn} · seeds ${arg('seeds', '1-144')} (${seeds.length}) · arms ${arms.join(', ')}`);
console.log('arm | runs | won | men up | seat lived | mean s | rounds in the plate (runs with any) | came down under it | went to another man | entries led | errors');
for (const arm of arms) { const R = by(arm), n = R.length, sum = (f: (r: Row) => number) => R.reduce((s, r) => s + f(r), 0);
  console.log(`${arm} | ${n} | ${R.filter(r => WIN.has(r.end)).length} (${pct(R.filter(r => WIN.has(r.end)).length, n)}) | ${sum(r => r.team)}/${sum(r => r.of)} (${f2(sum(r => r.team) / Math.max(1, n))} a run) | ${R.filter(r => r.seatUp).length} (${pct(R.filter(r => r.seatUp).length, n)}) | ${f2(sum(r => r.t) / Math.max(1, n))} | ${sum(r => r.stats.stopped)} (${R.filter(r => r.stats.stopped > 0).length}) | ${sum(r => r.stats.low)} | ${sum(r => r.stats.retargets)} | ${sum(r => r.stats.led)} | ${all.filter(r => r.arm === arm && r.end === 'error').length}`);
  const L = R.flatMap(r => r.lost); if (L.length) { const front = L.filter(x => Math.abs(x.deg) <= 35), low = front.filter(x => x.y < 0.5), high = front.filter(x => x.y >= 1.7);
    console.log(`    the shield man was dropped ${L.length} times: ${L.length - front.length} from outside his front arc (more than 35° round) · ${low.length} from the front under the plate (below 0.5 m) · ${high.length} from the front over it (1.7 m up and more) · ${front.length - low.length - high.length} from the front through neither (a line round the plate's edge) · median range ${f2(L.map(x => x.dist).sort((a, b) => a - b)[L.length >> 1])} m`); }
}
const base = arms[0];
for (const arm of arms.slice(1)) { const A = new Map(by(base).map(r => [r.seed, r])), pairs = by(arm).filter(r => A.has(r.seed)).map(r => [A.get(r.seed)!, r] as const);
  const [m, lo, hi] = boot(pairs.map(([a, b]) => b.team - a.team)), [sm, slo, shi] = boot(pairs.map(([a, b]) => +b.seatUp - +a.seatUp)), [wm, wlo, whi] = boot(pairs.map(([a, b]) => +WIN.has(b.end) - +WIN.has(a.end))), [tm, tlo, thi] = boot(pairs.map(([a, b]) => b.t - a.t));
  console.log(`${arm} − ${base}, paired over ${pairs.length} seeds: men up ${m >= 0 ? '+' : ''}${f2(m)} a run [${f2(lo)}, ${f2(hi)}] · the seat's man lives ${sm >= 0 ? '+' : ''}${f2(sm)} [${f2(slo)}, ${f2(shi)}] · runs won ${wm >= 0 ? '+' : ''}${f2(wm)} [${f2(wlo)}, ${f2(whi)}] · seconds ${tm >= 0 ? '+' : ''}${f2(tm)} [${f2(tlo)}, ${f2(thi)}]`); }
for (const r of all.filter(r => r.end === 'error')) console.log(`ERROR ${r.arm}:${r.seed} ${r.why}`);
if (arg('json', '')) writeFileSync(arg('json', ''), JSON.stringify({ scn, seeds: arg('seeds', '1-144'), arms, rows: all }));
if (lostParts) console.log(`shield-tally: ${lostParts} part(s) did not come back — the tables above are short`);
process.exit(all.some(r => r.end === 'error') || lostParts ? 1 : 0);
