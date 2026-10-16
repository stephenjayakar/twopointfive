// THE SQUAD MAPS JUDGED — tables out of playthrough.ts / ships.ts JSON for the question 'is this mission worth playing': one ARM per label (a map and its
// switches), its outcome, its stragglers' clock, what the fight looked like on both sides, and each arm against a base arm seed for seed.
//   bun run tools/qa/squad-maps-table.ts <label>=<file>[+<file>…][:lo-hi][@scenario] [<label>=…] [--base <label>] [--only outcome,tail,last,fight,men,pair] [--boot 4000]
// What it prints (markdown):
//   OUTCOME   runs · taken (share, Wilson 95 %) · wiped · stalled (the cap, or the script ran out) · error · the length of a taken run (p50 / p90) · teammates up
//             at the end (mean over every run, and over the taken ones) · runs with nobody lost · taken with one man left
//   TAIL      the stragglers: runs that got their side down to three · of those taken / wiped / stalled · three left → end over the taken ones (p50 / p90 /
//             mean), the share over a minute and over two, its legs (3 → 2, 2 → 1, 1 → end; medians), the tail's share of the run · the tail counted to the
//             stop for runs that never ended (a floor) · where the last three stood as the clock started (own room / another / open floor; holding or moving),
//             metres each walked after, seconds until the team first had eyes on each
//   FIGHT     their side: defenders dropped per run, by where the killer stood (outside the room, inside, open floor), dropped on their mark still holding,
//             dropped never having been alerted (the 'dumb' count), who left his mark, the squads' own moves per run by kind; our side: teammates lost per
//             run by when (at the door, going in, later), killed by a man more than 75° off their gun, by a frag, the top man's share of the kills
//   MEN       per run means of the watcher's smells by kind
//   PAIR      every arm against --base over the seeds both ran: taken either side, the difference in taken share and in teammates up with a 95 % interval
//             (paired bootstrap over seeds), the same for the tail counted to the stop
// A bystander's arithmetic: nothing here plays anything. exit 0 · 2 = bad flags / an unreadable file
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2); const bad = (why: string): never => { console.error(why); process.exit(2); };
const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const BOOT = +(flag('--boot') ?? 4000), BASE = flag('--base'), ONLY = (flag('--only') ?? 'outcome,tail,last,fight,men,pair').split(',');
type Run = any; type Arm = { label: string; runs: Run[]; cap: number };
const arms: Arm[] = [];
for (const a of argv) { const m = /^([\w.+-]+)=(.+?)(?::(\d+)-(\d+))?(?:@([\w-]+))?$/.exec(a); if (!m || a.startsWith('--')) continue; const runs: Run[] = []; let cap = 0;
  for (const f of m[2].split('+')) { let j: any; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { bad(`${f}: ${(e as Error).message}`); } cap = Math.max(cap, j.cap ?? 0); runs.push(...(j.runs ?? j)); }
  const lo = m[3] ? +m[3] : -Infinity, hi = m[4] ? +m[4] : Infinity; arms.push({ label: m[1], runs: runs.filter(r => r.seed >= lo && r.seed <= hi && (!m[5] || r.scn === m[5])), cap }); }
if (!arms.length) bad('squad-maps-table.ts <label>=<file>[+<file>…][:lo-hi][@scenario] … [--base <label>] [--only outcome,tail,fight,men,pair]');

const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), k = p * (s.length - 1), i = Math.floor(k); return s[i] + (k - i) * ((s[i + 1] ?? s[i]) - s[i]); };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const f0 = (x: number) => Number.isFinite(x) ? String(Math.round(x)) : '—', f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—', f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
const pct = (n: number, of: number) => of ? `${Math.round(100 * n / of)} %` : '—';
function wilson(k: number, n: number): string { if (!n) return '—'; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return `${Math.round(100 * (c - h))}–${Math.round(100 * (c + h))} %`; }
const table = (title: string, head: string[], rows: (string | number)[][]) => { console.log(`\n### ${title}\n`); console.log(`| ${head.join(' | ')} |`); console.log(`|${head.map(() => '---').join('|')}|`); for (const r of rows) console.log(`| ${r.join(' | ')} |`); };
const taken = (r: Run) => r.end === 'taken', stopT = (r: Run, cap: number) => r.end === 'stalled' ? Math.max(r.t, cap || r.t) : r.t;
const live = (a: Arm) => a.runs.filter(r => r.end !== 'error');

if (ONLY.includes('outcome')) table('Outcome', ['arm', 'runs', 'taken', '95 %', 'wiped', 'stalled', 'error', 'taken secs p50', 'p90', 'up /run (all)', 'up /run (taken)', 'nobody lost', 'taken with 1 up', 'theirs left when not taken (mean)'],
  arms.map(a => { const rs = live(a), tk = rs.filter(taken), nt = rs.filter(r => !taken(r));
    return [a.label, a.runs.length, `${tk.length} (${pct(tk.length, rs.length)})`, wilson(tk.length, rs.length), rs.filter(r => r.end === 'wiped').length, rs.filter(r => r.end === 'stalled').length, a.runs.length - rs.length,
      f0(q(tk.map(r => r.t), 0.5)), f0(q(tk.map(r => r.t), 0.9)), f2(mean(rs.map(r => r.team))), f2(mean(tk.map(r => r.team))), rs.filter(r => r.of && r.team === r.of).length, tk.filter(r => r.team === 1).length, f1(mean(nt.map(r => r.hostiles)))]; }));

if (ONLY.includes('tail')) {
  table('Stragglers: their side down to three, until the end', ['arm', 'reached 3 left', 'then taken', 'then wiped', 'then stalled', '3 → end p50', 'p90', 'mean', 'over 60 s', 'over 120 s', '3 → 2 p50', '2 → 1 p50', '1 → end p50', '1 → end p90', 'tail share of run p50', '3 → stop, every run p50 (floor)', 'p90'],
    arms.map(a => { const rs = live(a).filter(r => r.endgame?.t3 != null), tk = rs.filter(r => taken(r) && r.endgame.end != null); const E = (r: Run) => r.endgame;
      const tail = tk.map(r => E(r).end - E(r).t3), all = rs.map(r => (taken(r) && E(r).end != null ? E(r).end : stopT(r, a.cap)) - E(r).t3);
      return [a.label, `${rs.length} of ${live(a).length}`, tk.length, rs.filter(r => r.end === 'wiped').length, rs.filter(r => r.end === 'stalled').length, f0(q(tail, 0.5)), f0(q(tail, 0.9)), f0(mean(tail)), pct(tail.filter(x => x > 60).length, tail.length), pct(tail.filter(x => x > 120).length, tail.length),
        f0(q(tk.filter(r => E(r).t2 != null).map(r => E(r).t2 - E(r).t3), 0.5)), f0(q(tk.filter(r => E(r).t1 != null && E(r).t2 != null).map(r => E(r).t1 - E(r).t2), 0.5)), f0(q(tk.filter(r => E(r).t1 != null).map(r => E(r).end - E(r).t1), 0.5)), f0(q(tk.filter(r => E(r).t1 != null).map(r => E(r).end - E(r).t1), 0.9)),
        pct(q(tk.map(r => (E(r).end - E(r).t3) / r.t), 0.5) * 100, 100), f0(q(all, 0.5)), f0(q(all, 0.9))]; }));
  table('The last three as the clock starts, and after', ['arm', 'men', 'in own room', 'another room', 'open floor', 'holding', 'moving', 'free', 'set on a wedged door', 'in the team\'s sight', 'walked after, m (mean)', 'walked < 2 m', 'eyes on him after, s p50', 'p90', 'never seen'],
    arms.map(a => { const men = live(a).flatMap(r => (r.endgame?.men3 ?? []).map((m: any) => ({ ...m, t3: r.endgame.t3 }))); const n = men.length, c = (f: (m: any) => boolean) => pct(men.filter(f).length, n);
      const saw = men.filter(m => m.sawAt != null).map(m => Math.max(0, m.sawAt - m.t3));
      return [a.label, n, c(m => m.where === 'own'), c(m => m.where === 'other'), c(m => m.where === 'open'), c(m => m.mode === 'hold'), c(m => m.mode === 'move'), c(m => m.mode !== 'hold' && m.mode !== 'move'), c(m => m.set), c(m => m.seen), f1(mean(men.map(m => m.walked ?? 0))), c(m => (m.walked ?? 0) < 2), f0(q(saw, 0.5)), f0(q(saw, 0.9)), c(m => m.sawAt == null)]; }));
}

// THE LAST MAN: the defender whose drop ended a taken run — where he was staged, where he dropped (his room, another, open floor; outside the 32 × 20 m rectangle
// every one of these levels is built on = out in the lot), how far from his mark, and the five longest tails with their seeds (the runs to trace)
if (ONLY.includes('last')) {
  const lastOf = (r: Run) => { const ds = (r.defs ?? []).filter((d: any) => d.dead); return ds.length ? ds.reduce((a: any, b: any) => b.dead.t > a.dead.t ? b : a) : null; };
  const out = (p: number[]) => p[0] < 4 || p[0] > 36 || p[1] < 4 || p[1] > 24;
  table('The last man of a taken run', ['arm', 'taken', 'dropped in his own room', 'on his mark (< 1 m)', '> 10 m from his mark', 'outside the building\'s rectangle', 'his home room (most often)', 'longest tails: seed (3 → end s; last man, home, dropped at)'],
    arms.map(a => { const tk = live(a).filter(r => taken(r) && r.endgame?.t3 != null && r.endgame.end != null), L = tk.map(r => ({ r, d: lastOf(r) })).filter(x => x.d), n = L.length, c = (f: (x: any) => boolean) => pct(L.filter(f).length, n);
      const homes: Record<string, number> = {}; for (const x of L) homes[x.d.home ?? '—'] = (homes[x.d.home ?? '—'] ?? 0) + 1;
      const slow = [...L].sort((x, y) => (y.r.endgame.end - y.r.endgame.t3) - (x.r.endgame.end - x.r.endgame.t3)).slice(0, 5);
      return [a.label, n, c(x => x.d.dead.home), c(x => x.d.dead.fromMark < 1), c(x => x.d.dead.fromMark > 10), c(x => out(x.d.dead.at)), Object.entries(homes).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · '),
        slow.map(x => `${x.r.seed} (${f0(x.r.endgame.end - x.r.endgame.t3)}; ${x.d.who}, ${x.d.home}, ${f0(x.d.dead.at[0])},${f0(x.d.dead.at[1])})`).join(' · ')]; }));
}

if (ONLY.includes('fight')) {
  table('Their side', ['arm', 'dropped /run', 'killer outside the room', 'inside', 'open floor', 'before the entry', 'on his mark (< 1 m)', 'never alerted', 'alert < 1 s before', 'left his mark (> 4 m) /run', 'their kills /run', 'squads\' moves /run'],
    arms.map(a => { const rs = live(a), ks = rs.flatMap(r => r.kills ?? []), ds = rs.flatMap(r => (r.defs ?? []).filter((d: any) => d.dead)), n = ks.length, c = (f: (k: any) => boolean) => pct(ks.filter(f).length, n);
      const ev: Record<string, number> = {}; for (const r of rs) for (const s of r.squads ?? []) for (const e of s.events) if (!['contact', 'down'].includes(e.what)) ev[e.what] = (ev[e.what] ?? 0) + 1;
      return [a.label, f1(n / rs.length), c(k => k.where === 'outside'), c(k => k.where === 'inside'), c(k => k.where === 'open'), c(k => k.pre), pct(ds.filter((d: any) => d.dead.fromMark < 1).length, ds.length), pct(ds.filter((d: any) => d.alertAt == null || d.alertAt > d.dead.t).length, ds.length), pct(ds.filter((d: any) => d.alertAt != null && d.alertAt <= d.dead.t && d.dead.t - d.alertAt < 1).length, ds.length),
        f1(sum(rs.map(r => (r.defs ?? []).filter((d: any) => d.far > 4).length)) / rs.length), f2(sum(rs.map(r => (r.defs ?? []).reduce((s: number, d: any) => s + (d.kills?.length ?? 0), 0))) / rs.length),
        Object.entries(ev).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${f1(v / rs.length)}`).join(' · ') || '—']; }));
  table('Our side', ['arm', 'lost /run', 'at the door', 'going in (+10 s)', 'later', 'no door order', 'killer > 75° off his gun', 'by a frag /run', 'frag bursts /run', 'top man\'s share of kills (mean)', 'entries /run', 'entries that lost a man', 'bangs /run', 'alone %'],
    arms.map(a => { const rs = live(a), ls = rs.flatMap(r => r.losses ?? []), ds = rs.flatMap(r => r.deaths ?? []), n = ls.length, c = (k: string) => pct(ls.filter((l: any) => l.at === k).length, n), en = rs.flatMap(r => r.entries ?? []);
      const top = rs.map(r => { const by: Record<string, number> = {}; for (const k of r.kills ?? []) by[k.by] = (by[k.by] ?? 0) + 1; const v = Object.values(by); return v.length ? Math.max(...v) / sum(v) : NaN; }).filter(Number.isFinite);
      return [a.label, f2(n / rs.length), c('door'), c('entry'), c('later'), c('none'), pct(ds.filter((d: any) => d.off > 75).length, ds.length), f2(sum(rs.map(r => r.fragTheirs?.teamKilled ?? 0)) / rs.length), f2(sum(rs.map(r => r.fragTheirs?.bursts ?? 0)) / rs.length), pct(mean(top) * 100, 100),
        f1(en.length / rs.length), pct(en.filter((e: any) => e.lost > 0).length, en.length), f1(mean(rs.map(r => r.bangs ?? 0))), pct(sum(rs.map(r => r.aloneSecs ?? 0)), sum(rs.map(r => r.upSecs ?? 0)))]; }));
}

if (ONLY.includes('men')) { const kinds = [...new Set(arms.flatMap(a => a.runs.flatMap(r => (r.smells ?? []).map((s: any) => s.kind))))];
  table('The watcher\'s smells, per run', ['arm', ...kinds], arms.map(a => [a.label, ...kinds.map(k => f2(sum(live(a).map(r => (r.smells ?? []).filter((s: any) => s.kind === k).length)) / live(a).length))])); }

if (ONLY.includes('pair') && BASE) { const base = arms.find(a => a.label === BASE) ?? bad(`--base ${BASE}: no such arm`);
  let s = 0x2F6E2B1; const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ci = (d: number[]) => { if (d.length < 2) return '—'; const ms: number[] = []; for (let b = 0; b < BOOT; b++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[(rnd() * d.length) | 0]; ms.push(t / d.length); } return `${f2(q(ms, 0.025))} … ${f2(q(ms, 0.975))}`; };
  const B = new Map(live(base).map(r => [`${r.scn}:${r.seed}`, r]));
  table(`Each arm against ${BASE}, seed for seed (difference = arm − base; an interval that holds 0 shows no difference)`, ['arm', 'seeds both ran', 'taken: base', 'arm', 'only base', 'only arm', 'Δ taken share', '95 %', 'Δ up /run', '95 %', 'Δ secs (both taken)', '95 %', 'Δ 3 → stop (both reached 3)', '95 %', 'same run'],
    arms.filter(a => a !== base).map(a => { const ps = live(a).map(r => [B.get(`${r.scn}:${r.seed}`), r] as [Run, Run]).filter(p => p[0]);
      const dT = ps.map(([b, r]) => +taken(r) - +taken(b)), dU = ps.map(([b, r]) => r.team - b.team), both = ps.filter(([b, r]) => taken(b) && taken(r)), dS = both.map(([b, r]) => r.t - b.t);
      const tl = (r: Run, cap: number) => (taken(r) && r.endgame.end != null ? r.endgame.end : stopT(r, cap)) - r.endgame.t3, e3 = ps.filter(([b, r]) => b.endgame?.t3 != null && r.endgame?.t3 != null), dE = e3.map(([b, r]) => tl(r, a.cap) - tl(b, base.cap));
      return [a.label, ps.length, ps.filter(([b]) => taken(b)).length, ps.filter(([, r]) => taken(r)).length, ps.filter(([b, r]) => taken(b) && !taken(r)).length, ps.filter(([b, r]) => !taken(b) && taken(r)).length, f2(mean(dT)), ci(dT), f2(mean(dU)), ci(dU), f1(mean(dS)), ci(dS), f1(mean(dE)), ci(dE), ps.filter(([b, r]) => b.end === r.end && b.t === r.t && b.team === r.team).length]; })); }
