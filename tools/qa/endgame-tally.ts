// THE ENDGAME'S TABLES — what tools/qa/playthrough.ts files per run as `endgame` (EndWatch: the second their side was down to three / two / one, the end,
// the last men as each clock starts and after) and `search` (PT_SEARCH=1: the searching commander's moves), added up per ARM (a build and its switches).
//   bun run tools/qa/endgame-tally.ts <label>=<file>[,<file>…] [<label>=…] [--base <label>] [--md] [--json out.json]
//     a file is playthrough's --json (or the same gzipped); an arm's files are its seeds in chunks. --base: every other arm's difference from that one, with a
//     bootstrap interval over the seeds both ran (2000 draws of the seeds, the 2.5th and 97.5th centile) — an interval that holds 0 is no difference shown.
// (the endgame differences are of each arm's own finished runs — not seed against seed: a seed's two runs part ways long before the endgame — so read them with
// `done in 60 s` and the column that counts an unfinished run to the cap, a floor on what it would have taken)
// THE CLOCKS: `two left → end` is the endgame (runs that ended 'taken'); `two left → eyes on one` is the HUNT proper (until the team first has either of the last
// two in its sight); `one left → end` the last man. A run that reached two left and was then wiped, or ran to the cap, has no end: it is counted, never timed —
// read `done in 60 s` (of the runs that reached two left, the share over within a minute) beside the medians, since an arm that wipes more times fewer runs.
import { readFileSync } from 'node:fs';
import type { RunOut, EndMan } from './playthrough.ts';

type Run = RunOut;
const argv = process.argv.slice(2), md = argv.includes('--md'); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const arms: { label: string; runs: Run[]; cap: number }[] = [];
for (const a of argv) { const m = /^([\w.+-]+)=(.+)$/.exec(a); if (!m) continue; const runs: Run[] = []; let cap = 0;
  for (const f of m[2].split(',')) { const raw = readFileSync(f); const j = JSON.parse(f.endsWith('.gz') ? Buffer.from(Bun.gunzipSync(raw)).toString('utf8') : raw.toString('utf8')); if (!Array.isArray(j.runs)) { console.error(`endgame-tally: ${f} is no playthrough --json (no runs)`); process.exit(2); }
    cap = Math.max(cap, j.cap ?? 0); runs.push(...j.runs); }
  arms.push({ label: m[1], runs, cap }); }
if (!arms.length) { console.error('endgame-tally: <label>=<file>[,<file>…] … [--base <label>] [--md] [--json out.json]'); process.exit(2); }

const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), k = p * (s.length - 1), i = Math.floor(k); return s[i] + (k - i) * ((s[i + 1] ?? s[i]) - s[i]); };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—';
const pct = (n: number, of: number) => of ? `${Math.round(100 * n / of)} %` : '—';
const table = (head: string[], rows: (string | number)[][]) => { const out: string[] = [];
  if (md) { out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`); for (const r of rows) out.push(`| ${r.join(' | ')} |`); }
  else { const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length))); out.push(head.map((h, i) => h.padEnd(w[i])).join('  ')); for (const r of rows) out.push(r.map((c, i) => String(c).padEnd(w[i])).join('  ')); }
  return out.join('\n'); };

/** what a man is doing as the clock starts: dug in (holding inside a room) · holding outside (holding on open floor) · hunting (off his post on the fight
 *  AI's hunt) · on the move (walking a leg: a fall-back, a squad's word, a buddy's call) */
export const doing = (m: EndMan) => m.mode === 'free' ? 'hunting' : m.mode === 'move' ? 'on the move' : m.where === 'open' ? 'holding outside' : 'dug in';
interface Row { key: string; searched: boolean; seed: number; end: string; t: number; t3: number | null; t2: number | null; t1: number | null; tEnd: number | null; egSecs: number | null; floorSecs: number | null; huntSecs: number | null; lastSecs: number | null; eg3Secs: number | null; lost2: number; lost3: number; up2: number; up3: number; upEnd: number; wiped2: boolean; wiped3: boolean; floor3Secs: number | null; men2: EndMan[]; dry2: number; doors2: number; walks2: number; hunts2: number; dry: number; doors: number }
const EPS = 0.06;
function rowsOf(runs: Run[]): Row[] {
  return runs.map(r => { const E = r.endgame, t2 = E?.t2 ?? null, t3 = E?.t3 ?? null, tEnd = E?.end ?? null, taken = r.end === 'taken', losses = r.losses ?? [], mv = r.search?.moves ?? [];
    // (found = the team has him in its sight, or — a man dropped by a blast or a round through a wall — the second he went down; times in the file are rounded:
    //  a loss or a move within the rounding of the clock's start is counted after it)
    const saw = (E?.men2 ?? []).map(m => m.sawAt ?? m.downAt).filter((x): x is number => x !== null), after = (t: number | null) => t === null ? [] : mv.filter(m => m.t >= t - EPS);
    const a2 = after(t2);
    return { key: `${r.scn}:${r.seed}`, searched: !!r.search, seed: r.seed, end: r.end, t: r.t, t3, t2, t1: E?.t1 ?? null, tEnd, egSecs: t2 !== null && tEnd !== null && taken ? tEnd - t2 : null, eg3Secs: t3 !== null && tEnd !== null && taken ? tEnd - t3 : null, floorSecs: t2 === null ? null : taken && tEnd !== null ? tEnd - t2 : r.end === 'wiped' ? null : Math.max(0, r.t - t2),
      huntSecs: t2 !== null && saw.length ? Math.max(0, Math.min(...saw) - t2) : t2 !== null && !(E?.men2 ?? []).length ? 0 : null, lastSecs: E?.t1 != null && tEnd !== null && taken ? tEnd - E.t1 : null,
      lost2: t2 === null ? 0 : losses.filter(l => l.t >= t2 - EPS).length, lost3: t3 === null ? 0 : losses.filter(l => l.t >= t3 - EPS).length, up2: E?.up2 ?? 0, up3: E?.up3 ?? 0, upEnd: r.team, wiped2: t2 !== null && r.end === 'wiped', wiped3: t3 !== null && r.end === 'wiped', floor3Secs: t3 === null ? null : taken && tEnd !== null ? tEnd - t3 : r.end === 'wiped' ? null : Math.max(0, r.t - t3), men2: E?.men2 ?? [],
      dry2: a2.filter(m => m.kind === 'room' && m.there === 0).length, doors2: a2.filter(m => m.kind === 'room').length, walks2: a2.filter(m => m.kind === 'walk').length, hunts2: a2.filter(m => m.kind === 'hunt').length,
      dry: mv.filter(m => m.kind === 'room' && m.there === 0).length, doors: mv.filter(m => m.kind === 'room').length }; });
}
const all = arms.map(a => ({ ...a, rows: rowsOf(a.runs) }));
const out: string[] = [], H = (s: string) => out.push('', md ? `### ${s}` : `== ${s} ==`, '');

H('The runs');
out.push(table(['arm', 'runs', 'taken', 'wiped', 'cap/other', 'reached two left', 'whole run s (median, taken)', 'teammates up at the end (of 4 a run)'],
  all.map(a => { const R = a.rows, tk = R.filter(r => r.end === 'taken'); return [a.label, R.length, tk.length, R.filter(r => r.end === 'wiped').length, R.filter(r => r.end !== 'taken' && r.end !== 'wiped').length, R.filter(r => r.t2 !== null).length, f1(q(tk.map(r => r.t), 0.5)), `${R.reduce((n, r) => n + r.upEnd, 0)} of ${a.runs.reduce((n, r) => n + r.of, 0)}`]; })));

H('The endgame clock: two left → the end (runs that ended taken)');
out.push(table(['arm', 'timed', 'median s', 'mean s', 'p75', 'p90', 'longest', 'over 30 s', 'over 60 s', 'done in 60 s, of all that reached two left', 'wiped after two left', 'not over at the cap', 'with those counted to the cap: median s', 'mean s'],
  all.map(a => { const R = a.rows.filter(r => r.t2 !== null), x = R.filter(r => r.egSecs !== null).map(r => r.egSecs!); return [a.label, x.length, f1(q(x, 0.5)), f1(mean(x)), f1(q(x, 0.75)), f1(q(x, 0.9)), f1(x.length ? Math.max(...x) : NaN), pct(x.filter(v => v > 30).length, x.length), pct(x.filter(v => v > 60).length, x.length), pct(x.filter(v => v <= 60).length, R.length), R.filter(r => r.wiped2).length, R.filter(r => r.egSecs === null && !r.wiped2).length, f1(q(R.filter(r => r.floorSecs !== null).map(r => r.floorSecs!), 0.5)), f1(mean(R.filter(r => r.floorSecs !== null).map(r => r.floorSecs!)))]; })));

H('Its parts: the hunt (two left → the team has eyes on one of them), from three left, and the last man');
out.push(table(['arm', 'hunt: median s', 'hunt: mean s', 'hunt: p90', 'in sight as the clock starts', 'neither ever found', 'three left → end: median s', 'mean s', 'one left → end: median s', 'mean s'],
  all.map(a => { const R = a.rows.filter(r => r.t2 !== null), h = R.filter(r => r.huntSecs !== null).map(r => r.huntSecs!), e3 = a.rows.filter(r => r.eg3Secs !== null).map(r => r.eg3Secs!), l = a.rows.filter(r => r.lastSecs !== null).map(r => r.lastSecs!);
    return [a.label, f1(q(h, 0.5)), f1(mean(h)), f1(q(h, 0.9)), pct(h.filter(v => v === 0).length, R.length), R.filter(r => r.huntSecs === null).length, f1(q(e3, 0.5)), f1(mean(e3)), f1(q(l, 0.5)), f1(mean(l))]; })));

H('The peril: teammates lost once two are left');
out.push(table(['arm', 'reached two left', 'teammates up then', 'lost after', 'a run', 'runs that lost a man after', 'wiped after', 'lost after three left'],
  all.map(a => { const R = a.rows.filter(r => r.t2 !== null), up = R.reduce((n, r) => n + r.up2, 0), lost = R.reduce((n, r) => n + r.lost2, 0); return [a.label, R.length, up, `${lost} (${pct(lost, up)})`, (lost / (R.length || 1)).toFixed(2), `${R.filter(r => r.lost2 > 0).length} (${pct(R.filter(r => r.lost2 > 0).length, R.length)})`, R.filter(r => r.wiped2).length, a.rows.reduce((n, r) => n + r.lost3, 0)]; })));

H('From three left (where the last defenders\' switches start to act) to the end');
out.push(table(['arm', 'reached three left', 'taken after', 'wiped after', 'not over at the cap', 'three left → end, taken runs: median s', 'mean s', 'p90', 'longest', 'done in 90 s, of all that reached three left', 'teammates up then', 'lost after', 'a run', 'runs that lost a man after'],
  all.map(a => { const R = a.rows.filter(r => r.t3 !== null), x = R.filter(r => r.eg3Secs !== null).map(r => r.eg3Secs!), up = R.reduce((n, r) => n + r.up3, 0), lost = R.reduce((n, r) => n + r.lost3, 0);
    return [a.label, R.length, R.filter(r => r.end === 'taken').length, R.filter(r => r.wiped3).length, R.filter(r => r.end !== 'taken' && r.end !== 'wiped').length, f1(q(x, 0.5)), f1(mean(x)), f1(q(x, 0.9)), f1(x.length ? Math.max(...x) : NaN), pct(x.filter(v => v <= 90).length, R.length), up, `${lost} (${pct(lost, up)})`, (lost / (R.length || 1)).toFixed(2), `${R.filter(r => r.lost3 > 0).length} (${pct(R.filter(r => r.lost3 > 0).length, R.length)})`]; })));

if (all.some(a => a.runs.some(r => r.lastStand))) {
  H('The last stand, as their side ran it (laststand.ts\'s own counts; runs with a switch on that reached the last few)');
  const med = (xs: number[]) => f1(q(xs, 0.5));
  out.push(table(['arm', 'runs it started in', 'radio checks a run', 'answers a run', 'runs with a room named on the HUD', 'runs with a stand ordered', '… gathered two or more in one room', 'men sent', 'arrived', 'stopped short / met the team / down on the way / no way', 'runs said set', 'order → set: median s', 'three left → order: median s', 'lines on their net a run'],
    all.filter(a => a.runs.some(r => r.lastStand)).map(a => { const L = a.runs.filter(r => r.lastStand && r.lastStand.stats.t0 >= 0).map(r => r.lastStand!), S = L.map(l => l.stats), sum = (k: string) => S.reduce((n, s) => n + (s[k] ?? 0), 0), st = S.filter(s => s.standT >= 0), set = S.filter(s => s.setT >= 0);
      return [a.label, L.length, (sum('checks') / (L.length || 1)).toFixed(1), (sum('answers') / (L.length || 1)).toFixed(1), L.filter(l => l.named.length > 0).length, st.length, S.filter(s => s.gathered > 0).length, sum('sent'), sum('arrived'), `${sum('short')} / ${sum('met')} / ${sum('diedOnWay')} / ${sum('noWay')}`, set.length, med(set.map(s => s.setT - s.standT)), med(st.map(s => s.standT - s.t0)), (sum('lines') / (L.length || 1)).toFixed(1)]; })));
}

H('Where the last two are as the clock starts, and what they are doing (men, two a run)');
out.push(table(['arm', 'men', 'own room', 'another room', 'open floor', 'dug in', '… of them set on a wedged door', 'holding outside', 'hunting', 'on the move', 'in the team\'s sight', 'both in one room', 'nearest teammate m (median)'],
  all.map(a => { const M = a.rows.flatMap(r => r.men2), n = M.length, c = (f: (m: EndMan) => boolean) => `${M.filter(f).length} (${pct(M.filter(f).length, n)})`, pairs = a.rows.filter(r => r.men2.length === 2);
    return [a.label, n, c(m => m.where === 'own'), c(m => m.where === 'other'), c(m => m.where === 'open'), c(m => doing(m) === 'dug in'), M.filter(m => doing(m) === 'dug in' && m.set).length, c(m => doing(m) === 'holding outside'), c(m => doing(m) === 'hunting'), c(m => doing(m) === 'on the move'), c(m => m.seen),
      `${pairs.filter(r => r.men2[0].in !== null && r.men2[0].in === r.men2[1].in).length} of ${pairs.length} runs`, f1(q(M.map(m => m.near), 0.5))]; })));

H('… and after: what the last two then do');
out.push(table(['arm', 'men', 'metres walked (median)', 'walked over 5 m', 'changed room', 'dropped in own room', 'in another room', 'on open floor', 'still up at the end'],
  all.map(a => { const M = a.rows.flatMap(r => r.men2), n = M.length, c = (f: (m: EndMan) => boolean) => `${M.filter(f).length} (${pct(M.filter(f).length, n)})`;
    return [a.label, n, f1(q(M.map(m => m.walked), 0.5)), c(m => m.walked > 5), c(m => m.rooms > 0), c(m => m.downAt !== null && m.downIn !== null && m.downIn === m.home), c(m => m.downAt !== null && m.downIn !== null && m.downIn !== m.home), c(m => m.downAt !== null && m.downIn === null), c(m => m.downAt === null)]; })));

H('The endgame clock by what the last two were doing (runs that ended taken; a run is filed under the slower-to-find kind: hunting > on the move > holding outside > dug in)');
{ const kinds = ['dug in', 'holding outside', 'on the move', 'hunting'], rank = (r: Row) => Math.max(...r.men2.map(m => kinds.indexOf(doing(m))));
  out.push(table(['arm', ...kinds.flatMap(k => [`${k}: runs`, 'median s', 'mean s'])], all.map(a => [a.label, ...kinds.flatMap((_k, i) => { const x = a.rows.filter(r => r.egSecs !== null && r.men2.length && rank(r) === i).map(r => r.egSecs!); return [x.length, f1(q(x, 0.5)), f1(mean(x))]; })]))); }

if (all.some(a => a.runs.some(r => r.search))) {
  H('The searching commander: his moves once two are left (a run)');
  out.push(table(['arm', 'runs', 'door orders', '… on a room with nobody in it', 'walks over unseen floor', 'leads followed', 'whole run: door orders', '… on an empty room'],
    all.filter(a => a.runs.some(r => r.search)).map(a => { const S = a.rows.filter(r => r.searched), R = S.filter(r => r.t2 !== null), n = R.length || 1, s = (f: (r: Row) => number) => (R.reduce((k, r) => k + f(r), 0) / n).toFixed(2), N = S.length || 1;
      return [a.label, R.length, s(r => r.doors2), s(r => r.dry2), s(r => r.walks2), s(r => r.hunts2), (S.reduce((k, r) => k + r.doors, 0) / N).toFixed(2), (S.reduce((k, r) => k + r.dry, 0) / N).toFixed(2)]; })));
  H('… and what he went on, once two are left (moves, all runs)');
  const whys = [...new Set(all.flatMap(a => a.runs.flatMap(r => (r.search?.moves ?? []).filter(m => r.endgame?.t2 != null && m.t >= r.endgame.t2 - EPS).map(m => `${m.kind}:${m.why}`))))].sort();
  out.push(table(['arm', ...whys], all.filter(a => a.runs.some(r => r.search)).map(a => [a.label, ...whys.map(w => a.runs.reduce((k, r) => k + (r.search?.moves ?? []).filter(m => r.endgame?.t2 != null && m.t >= r.endgame.t2 - EPS && `${m.kind}:${m.why}` === w).length, 0))])));
}

const base = all.find(a => a.label === flag('--base'));
if (flag('--base') && !base) { console.error(`endgame-tally: --base ${flag('--base')}: no such arm (${all.map(a => a.label).join(', ')})`); process.exit(2); }
if (base) {
  H(`Against ${base.label}: the difference, with a bootstrap interval over the seeds both ran`);
  let s = 0x2545F491; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const rows: (string | number)[][] = [];
  for (const a of all) { if (a === base) continue; const A = new Map(a.rows.map(r => [r.key, r])), B = new Map(base.rows.map(r => [r.key, r])), seeds = [...A.keys()].filter(k => B.has(k));
    const stat = (f: (rs: Row[]) => number) => { const d = (ks: string[]) => f(ks.map(k => A.get(k)!)) - f(ks.map(k => B.get(k)!)); const boot: number[] = []; for (let i = 0; i < 2000; i++) boot.push(d(seeds.map(() => seeds[Math.floor(rnd() * seeds.length)]))); const v = boot.filter(Number.isFinite);
      return `${f1(d(seeds))} [${f1(q(v, 0.025))}, ${f1(q(v, 0.975))}]`; };
    rows.push([a.label, seeds.length, stat(rs => mean(rs.filter(r => r.egSecs !== null).map(r => r.egSecs!))), stat(rs => q(rs.filter(r => r.egSecs !== null).map(r => r.egSecs!), 0.5)), stat(rs => mean(rs.filter(r => r.floorSecs !== null).map(r => r.floorSecs!))), stat(rs => mean(rs.filter(r => r.huntSecs !== null).map(r => r.huntSecs!))),
      stat(rs => 100 * rs.filter(r => r.t2 !== null && r.egSecs !== null && r.egSecs <= 60).length / (rs.filter(r => r.t2 !== null).length || 1)), stat(rs => rs.reduce((n, r) => n + r.lost2, 0) / (rs.filter(r => r.t2 !== null).length || 1)), stat(rs => rs.reduce((n, r) => n + r.upEnd, 0)), stat(rs => rs.filter(r => r.end === 'taken').length),
      stat(rs => mean(rs.filter(r => r.eg3Secs !== null).map(r => r.eg3Secs!))), stat(rs => rs.reduce((n, r) => n + r.lost3, 0) / (rs.filter(r => r.t3 !== null).length || 1)), stat(rs => rs.filter(r => r.wiped3).length)]); }
  out.push(table(['arm', 'seeds', 'endgame mean s', 'endgame median s', 'endgame mean s, unfinished counted to the cap', 'hunt mean s', 'done in 60 s, points', 'teammates lost after two left, a run', 'teammates up at the end, total', 'runs taken', 'three left → end mean s', 'teammates lost after three left, a run', 'wiped after three left, runs'], rows));
}
console.log(out.join('\n'));
if (flag('--json')) await Bun.write(flag('--json')!, JSON.stringify(all.map(a => ({ label: a.label, cap: a.cap, rows: a.rows })), null, 1));
