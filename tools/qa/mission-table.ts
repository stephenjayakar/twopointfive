// ONE ROW PER (run file, scenario): what a mission's scripted runs came to, for judging missions against each other (the missions goal's verdicts page).
//   bun run tools/qa/mission-table.ts <runs.json> [more.json …] [--md] [--label a,b,…]      (files given the same label are added together as one arm)
// Each file is a `playthrough.ts --json` (or `ships.ts … --json`) output. Columns:
//   runs · ended by the scenario's own rules, by kind (taken / rescued / wiped / lost) · stalled (the script ran out, or the time cap) · error (threw)
//   secs: median and 90th centile of the run's length, over the runs that ended
//   up: teammates alive at the end, mean of the staged (over every run) · none lost: runs that ended with every teammate up
//   theirs left: runs that stopped with defenders still up (a wipe, a stall)
//   last 3 → end: median seconds from their side being down to three until the end (the stragglers' clock), over runs that got there and ended 'taken'
//   alone %: share of the team's man-seconds spent off alone · smells per run (stuck+hung+doorway+behind+block = the 'stands about' kind; unaware; friendly)
//   frags: defenders' grenade bursts per run, and teammates they killed per run
//   hostages: alive of staged, summed (rescues)
// A bystander's arithmetic: nothing here plays anything.
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2), md = argv.includes('--md'); const li = argv.indexOf('--label'); const labels = li >= 0 ? (argv[li + 1] ?? '').split(',') : [];
const files = argv.filter((a, i) => !a.startsWith('--') && !(li >= 0 && i === li + 1));
if (!files.length) { console.error('mission-table.ts <runs.json> [more.json …] [--md] [--label a,b,…]'); process.exit(2); }
const q = (a: number[], p: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const n0 = (x: number) => Number.isFinite(x) ? String(Math.round(x)) : '—', n2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
const head = ['arm', 'scenario', 'runs', 'ended', 'stalled', 'error', 'secs p50', 'p90', 'up (mean of staged)', 'none lost', 'theirs left', 'last 3 → end p50', 'p90', 'alone %', 'stands about /run', 'unaware /run', 'friendly', 'frag bursts /run', 'frag kills /run', 'hostages'];
const rows: string[][] = [];
// (files given the SAME label are one arm: seeds 1-24 and 25-144 of one stand, read as one table row a scenario)
const arms = new Map<string, any[]>();
files.forEach((f, fi) => { const J = JSON.parse(readFileSync(f, 'utf8')); const arm = labels[fi] ?? f.replace(/^.*\//, '').replace(/\.json$/, ''); arms.set(arm, [...(arms.get(arm) ?? []), ...(J.runs ?? J)]); });
arms.forEach((runs, arm) => {
  for (const scn of [...new Set(runs.map(r => r.scn))]) { const rs = runs.filter(r => r.scn === scn), ended = rs.filter(r => r.end !== 'stalled' && r.end !== 'error');
    const kinds = [...new Set(ended.map(r => r.end))].map(e => `${ended.filter(r => r.end === e).length} ${e}`).join(', ');
    const secs = ended.map(r => r.t), of = rs.reduce((a, r) => a + (r.of || 0), 0), up = rs.reduce((a, r) => a + (r.team || 0), 0);
    const tail = rs.filter(r => r.end === 'taken' && r.endgame?.t3 != null && r.endgame?.end != null).map(r => r.endgame.end - r.endgame.t3);
    const sm = (ks: string[]) => rs.reduce((a, r) => a + (r.smells ?? []).filter((x: any) => ks.includes(x.kind)).length, 0) / rs.length;
    const upS = rs.reduce((a, r) => a + (r.upSecs ?? 0), 0), alS = rs.reduce((a, r) => a + (r.aloneSecs ?? 0), 0);
    const hs = rs.filter(r => r.hostages); const fb = rs.reduce((a, r) => a + (r.fragTheirs?.bursts ?? 0), 0), fk = rs.reduce((a, r) => a + (r.fragTheirs?.teamKilled ?? 0), 0);
    rows.push([arm, scn, String(rs.length), `${ended.length} (${kinds})`, String(rs.filter(r => r.end === 'stalled').length), String(rs.filter(r => r.end === 'error').length), n0(q(secs, 0.5)), n0(q(secs, 0.9)),
      of ? `${n2(up / rs.length)} of ${n2(of / rs.length)}` : '—', String(rs.filter(r => r.end !== 'error' && r.of && r.team === r.of).length), String(rs.filter(r => r.hostiles > 0).length), n0(q(tail, 0.5)), n0(q(tail, 0.9)),
      upS ? n0(100 * alS / upS) : '—', n2(sm(['stuck', 'hung', 'doorway', 'behind', 'block'])), n2(sm(['unaware'])), String(rs.reduce((a, r) => a + (r.smells ?? []).filter((x: any) => x.kind === 'friendly').length, 0)),
      n2(fb / rs.length), n2(fk / rs.length), hs.length ? `${hs.reduce((a, r) => a + r.hostages[0], 0)} of ${hs.reduce((a, r) => a + r.hostages[1], 0)}` : '—']); }
});
if (md) { console.log(`| ${head.join(' | ')} |`); console.log(`|${'---|'.repeat(head.length)}`); for (const r of rows) console.log(`| ${r.join(' | ')} |`); }
else { const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length))); for (const r of [head, ...rows]) console.log(r.map((c, i) => c.padEnd(w[i])).join('  ')); }
