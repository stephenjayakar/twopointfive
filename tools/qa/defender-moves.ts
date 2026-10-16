// WHAT THE DEFENDERS DID, counted — playthrough.ts JSONs (their `defs` / `def` blocks: DefWatch) read back as tables: how a set of runs ended, how many of
// their men ever left a post and when, where and how they died, who dropped the teammates (a man on his post, or one off it on the hunt), how many rooms
// still had a man at home when the team got to their door, and whether a cleared room was ever taken back.
//   bun run tools/qa/defender-moves.ts <runs.json> [more.json …] [--scn id] [--seeds 1-144]
//   bun run tools/qa/defender-moves.ts --pair <before.json> <arm.json> [more arms …] [--scn id] [--seeds 1-144]
// Reads only; one block per file. A file made before DefWatch (no `defs`) prints its outcomes and says so.
import { readFileSync } from 'node:fs';
import type { RunOut, DefOut } from './playthrough.ts';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && (argv[i - 1] === '--scn' || argv[i - 1] === '--seeds')));
if (!files.length) { console.error('usage: bun run tools/qa/defender-moves.ts <runs.json> [more.json …] [--scn id] [--seeds a-b]'); process.exit(2); }
for (const a of argv) if (a.startsWith('--') && !['--scn', '--seeds', '--pair'].includes(a)) { console.error(`unknown flag ${a} (known: --scn id, --seeds a-b, --pair)`); process.exit(2); }
if (flag('--seeds') !== undefined && !/^\d+(-\d+)?$/.test(flag('--seeds')!)) { console.error(`--seeds ${flag('--seeds')}: one number or a-b`); process.exit(2); }
if (!files.length || (argv.includes('--pair') && files.length < 2)) { console.error('usage: defender-moves.ts <runs.json> [more.json …] [--scn id] [--seeds a-b]   |   --pair <before.json> <arm.json> [more arms …]'); process.exit(2); }
const scn = flag('--scn'), sr = flag('--seeds')?.split('-').map(Number);
/** a run that ended well (lost-men.ts's WELL) · a run whose worker left no result is in no column */
const well = (r: RunOut) => r.end === 'taken' || r.end === 'rescued', ran = (r: RunOut) => r.end !== 'error';
const pct = (n: number, of: number) => of ? `${Math.round(100 * n / of)} %` : '—';
const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.round(p * (s.length - 1))]; };
const med = (xs: number[]) => q(xs, 0.5), f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—';
const spread = (xs: number[]) => `${f1(med(xs))} (${f1(q(xs, 0.1))} to ${f1(q(xs, 0.9))})`;
const hist = (xs: number[], keys: number[]) => keys.map(k => `${k}: ${xs.filter(x => x === k).length}`).join(' · ') + (xs.some(x => !keys.includes(x)) ? ` · other: ${xs.filter(x => !keys.includes(x)).length}` : '');
const rallied = (d: DefOut) => d.notes.some(n => n[1].startsWith('goes to the fight'));
const fellBack = (d: DefOut) => d.notes.some(n => n[1].startsWith('falls back'));
const tookCover = (d: DefOut) => d.notes.some(n => n[1].startsWith('takes cover'));
/** how a man stood when something happened to him: on his post, off it but still in his room, or out of it (and in which of the fight's modes) */
const stance = (x: { fromMark: number; mode: string; home: boolean }) => x.mode === 'none' ? 'not a posted man (a roamer)' : x.home ? (x.fromMark < 1.5 ? 'on his post' : 'off his post, in his room') : x.mode === 'free' ? 'out of his room, on the hunt' : x.mode === 'move' ? 'out of his room, falling back' : 'out of his room, holding where he got to';
const STANCES = ['on his post', 'off his post, in his room', 'out of his room, on the hunt', 'out of his room, falling back', 'out of his room, holding where he got to', 'not a posted man (a roamer)'];

// --pair: the first file against each other one, the seeds both ran, by scenario — teammates up, runs won, wipes, and a 95 % interval on the difference in
// teammates up (4000 resamples of the seeds, a fixed stream: the same files give the same interval). A seed is the same run only until a rule touches it
// (four-man-entries/trace.md §2), so the pairing buys little: read the interval, not the difference.
if (argv.includes('--pair') && files.length >= 2) {
  const load = (f: string) => { let r: RunOut[] = JSON.parse(readFileSync(f, 'utf8')).runs; if (scn) r = r.filter(x => x.scn === scn); if (sr) r = r.filter(x => x.seed >= sr[0] && x.seed <= (sr[1] ?? sr[0])); return r.filter(ran); };
  const A = load(files[0]); let st = 0x9E3779B1; const rnd = () => { st = (st + 0x6D2B79F5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const f of files.slice(1)) {
    const B = load(f); console.log(`== ${files[0]}  against  ${f}`);
    for (const id of [...new Set(A.map(r => r.scn))]) {
      const pairs = A.filter(r => r.scn === id).map(a => ({ a, b: B.find(x => x.scn === id && x.seed === a.seed) })).filter((x): x is { a: RunOut; b: RunOut } => !!x.b); if (!pairs.length) continue;
      const sum = (k: (r: RunOut) => number, w: 'a' | 'b') => pairs.reduce((n, x) => n + k(x[w]), 0), d = pairs.map(x => x.b.team - x.a.team), tot = d.reduce((a, b) => a + b, 0);
      const bs: number[] = []; for (let i = 0; i < 4000; i++) { let t = 0; for (let j = 0; j < d.length; j++) t += d[Math.floor(rnd() * d.length)]; bs.push(t); } bs.sort((x, y) => x - y);
      console.log(`  ${id}: ${pairs.length} seeds · teammates up ${sum(r => r.team, 'a')} → ${sum(r => r.team, 'b')} of ${sum(r => r.of, 'a')} (${tot >= 0 ? '+' : ''}${tot}, 95 % interval ${bs[100]} to ${bs[3899]}) · won ${sum(r => +well(r), 'a')} → ${sum(r => +well(r), 'b')} · every teammate down ${sum(r => +(r.team === 0), 'a')} → ${sum(r => +(r.team === 0), 'b')} · all up ${sum(r => +(r.team === r.of), 'a')} → ${sum(r => +(r.team === r.of), 'b')} · run length ${f1(med(pairs.map(x => x.a.t)))} → ${f1(med(pairs.map(x => x.b.t)))} s · same run (end, length, men) ${pairs.filter(x => x.a.end === x.b.end && x.a.t === x.b.t && x.a.team === x.b.team).length}`);
    }
  }
  process.exit(0);
}
for (const file of files) {
  const J = JSON.parse(readFileSync(file, 'utf8')); let runs: RunOut[] = J.runs; const errs = runs.filter(r => !ran(r)).length; runs = runs.filter(ran);
  if (scn) runs = runs.filter(r => r.scn === scn);
  if (sr) runs = runs.filter(r => r.seed >= sr[0] && r.seed <= (sr[1] ?? sr[0]));
  const L: string[] = []; const say = (s = '') => L.push(s);
  say(`== ${file}${scn ? ` · ${scn}` : ''}${sr ? ` · seeds ${sr.join('-')}` : ''}${Object.keys(J.set ?? {}).length ? ` · set ${JSON.stringify(J.set)}` : ''}${J.stackWait ? ` · PT_STACKWAIT ${J.stackWait}` : ''}${J.pause ? ` · PT_PAUSE ${J.pause} (room clears only)` : ''}${J.noise ? ' · PT_NOISE' : ''} · ${runs.length} runs${errs ? ` (+ ${errs} with no result, in no column)` : ''}`);
  if (J.noise) say('(PT_NOISE: every man of theirs heard the staged report a third of a second in. "The first loud thing" below is still the first REAL round, charge or boot; "before anything loud" means before that)');
  for (const id of [...new Set(runs.map(r => r.scn))]) {
    const R = runs.filter(r => r.scn === id), of = R.reduce((n, r) => n + r.of, 0), up = R.reduce((n, r) => n + r.team, 0);
    const won = R.filter(well), wiped = R.filter(r => r.team === 0);
    say(); say(`-- ${id}: ${R.length} runs`);
    say(`ended: ${[...new Set(R.map(r => r.end))].map(e => `${e} ${R.filter(r => r.end === e).length}`).join(' · ')} · teammates up ${up} of ${of} (${(up / R.length).toFixed(2)} a run) · every teammate down in ${wiped.length}`);
    const size = Math.max(...R.map(r => r.of)); say(`teammates up at the end, runs by count: ${hist(R.map(r => r.team), Array.from({ length: size + 1 }, (_, i) => i))}`);
    say(`run length, s: all ${spread(R.map(r => r.t))} · won ${spread(won.map(r => r.t))} · door orders a run ${spread(R.map(r => r.rooms))} (runs by count: ${hist(R.map(r => r.rooms), [0, 1, 2, 3, 4, 5, 6])})`);
    const D = R.filter(r => r.defs && r.def); if (!D.length) { say('(no defender rows in this file: made before DefWatch)'); continue; }
    const loud = D.map(r => r.def!.loudAt).filter((x): x is number => x !== null);
    say(`first round, charge or boot at ${spread(loud)} s · from then to the end ${spread(D.filter(r => r.def!.loudAt !== null).map(r => r.t - r.def!.loudAt!))} s (won runs ${spread(D.filter(r => r.def!.loudAt !== null && well(r)).map(r => r.t - r.def!.loudAt!))})`);
    const all = D.flatMap(r => r.defs!.map(d => ({ d, r })));
    // who moved
    const ral = all.filter(x => rallied(x.d)), fb = all.filter(x => fellBack(x.d)), cv = all.filter(x => tookCover(x.d)), stay = all.filter(x => !rallied(x.d) && !fellBack(x.d) && !tookCover(x.d) && x.d.far < 1.5);
    say(); say(`their men: ${all.length} (${(all.length / D.length).toFixed(1)} a run)`);
    say(`  went to the fight next door: ${ral.length} (${pct(ral.length, all.length)}) · fell back out of a lost room: ${fb.length} · took cover: ${cv.length} · never left the post: ${stay.length} (${pct(stay.length, all.length)})`);
    say(`  ever outside their own room: ${all.filter(x => x.d.leftAt !== null).length} (${pct(all.filter(x => x.d.leftAt !== null).length, all.length)}) · farthest from the mark, m: ${spread(all.map(x => x.d.far))}`);
    say(`  runs by how many went to the fight: ${hist(D.map(r => r.defs!.filter(rallied).length), [0, 1, 2, 3, 4, 5])}`);
    const rdelay = ral.map(x => x.d.notes.find(n => n[1].startsWith('goes to the fight'))![0] - (x.r.def!.loudAt ?? 0));
    say(`  seconds from the first loud thing to setting off: ${spread(rdelay)} · set off inside 10 s of it: ${pct(rdelay.filter(x => x <= 10).length, rdelay.length)} · from setting off to out of his own room: ${spread(ral.filter(x => x.d.leftAt !== null).map(x => x.d.leftAt! - x.d.notes.find(n => n[1].startsWith('goes to the fight'))![0]))}`);
    // what became of the ones who went, and the ones who stayed
    const fate = (xs: typeof all, name: string) => { const dead = xs.filter(x => x.d.dead), kills = xs.reduce((n, x) => n + x.d.kills.length, 0);
      say(`  ${name}: ${xs.length} men · dropped ${dead.length} (${pct(dead.length, xs.length)}) · teammates they dropped ${kills} (${(kills / Math.max(1, xs.length)).toFixed(2)} a man; ${xs.filter(x => x.d.kills.length).length} of them dropped anybody)${dead.length ? ` · lived ${spread(dead.map(x => x.d.dead!.t - (x.r.def!.loudAt ?? 0)))} s past the first loud thing` : ''}`); };
    say(); fate(ral, 'went to the fight'); fate(all.filter(x => !rallied(x.d)), 'did not go'); fate(stay, 'never left the post'); fate(fb, 'fell back'); fate(cv, 'took cover');
    // how strung out the men who go are: when one of them is dropped outside his room, how many others of theirs are out and up at that moment
    {
      const others = (x: typeof all[0], t: number) => x.r.defs!.filter(o => o !== x.d && o.leftAt !== null && o.leftAt <= t && (!o.dead || o.dead.t > t)).length;
      const out = ral.filter(x => x.d.dead && !x.d.dead.home), n = out.map(x => others(x, x.d.dead!.t));
      const offs = D.map(r => r.defs!.filter(rallied).map(d => d.notes.find(m => m[1].startsWith('goes to the fight'))![0])).filter(a => a.length >= 2).map(a => Math.max(...a) - Math.min(...a));
      say(`  strung out: a man who went, dropped outside his room (${out.length}): others of theirs out of their rooms and up at that moment ${hist(n, [0, 1, 2, 3, 4])} · s between the first and the last of a run setting off: ${spread(offs)}`);
      const kn = ral.flatMap(x => x.d.kills.filter(k => !k.home).map(k => others(x, k.t)));
      say(`              a teammate dropped by a man out of his room (${kn.length}): others of theirs out and up then ${hist(kn, [0, 1, 2, 3, 4])}`);
    }
    // deaths of theirs, deaths of the team, by how the defender stood
    const dd = all.filter(x => x.d.dead).map(x => ({ ...x.d.dead!, since: x.d.dead!.t - (x.r.def!.loudAt ?? 0) })), kk = all.flatMap(x => x.d.kills.map(k => ({ ...k, since: k.t - (x.r.def!.loudAt ?? 0) })));
    say(); say(`their men dropped: ${dd.length} of ${all.length} · teammates dropped by them: ${kk.length} (the team lost ${of - up})`);
    say(`  where the defender stood        | he was dropped | he dropped a teammate`);
    for (const s of STANCES) say(`  ${s.padEnd(32)}| ${String(dd.filter(x => stance(x) === s).length).padStart(5)} ${pct(dd.filter(x => stance(x) === s).length, dd.length).padStart(5)}    | ${String(kk.filter(x => stance(x) === s).length).padStart(5)} ${pct(kk.filter(x => stance(x) === s).length, kk.length).padStart(5)}`);
    const B = [[0, 5], [5, 10], [10, 20], [20, 40], [40, 80], [80, 1e9]];
    say(`  seconds past the first loud thing: ${B.map(([a, b]) => `${a}${b > 1e8 ? '+' : `-${b}`}`).join(' | ')}`);
    say(`    their men dropped:              ${B.map(([a, b]) => dd.filter(x => x.since >= a && x.since < b).length).join(' | ')}`);
    say(`    teammates dropped:              ${B.map(([a, b]) => kk.filter(x => x.since >= a && x.since < b).length).join(' | ')}`);
    const K = D.flatMap(r => r.kills ?? []);
    say(`  their men dropped, by where the two stood (the Tally's split): he was out on open floor ${K.filter(k => k.where === 'open').length} · in a room, his killer outside it ${K.filter(k => k.where === 'outside').length} · in a room, his killer in it with him ${K.filter(k => k.where === 'inside').length} · in the room a door order was into, before anybody had crossed ${K.filter(k => k.pre).length}`);
    const W = D.filter(r => r.team === 0); if (W.length) say(`  runs with every teammate down: ${W.length} · their men still up at that moment, runs by count: ${hist(W.map(r => r.hostiles), [1, 2, 3, 4, 5])}`);
    // the doors: who was at home when the order came, and what he was doing
    const snaps = D.flatMap(r => r.def!.doors.map((s, i) => ({ s, r, nth: r.def!.doors.filter((x, j) => j <= i && x.when === 'order').length })));   // (a crossing carries the number of the order it belongs to)
    for (const when of ['order', 'cross'] as const) {
      const S = snaps.filter(x => x.s.when === when), men = S.flatMap(x => x.s.men), home = men.filter(m => m.home);
      say(); say(`door orders, at ${when === 'order' ? 'the order' : 'the first man across'}: ${S.length} · the room's own men up then: ${men.length}, at home ${home.length} · no man of the room at home: ${S.filter(x => !x.s.men.some(m => m.home)).length} (${pct(S.filter(x => !x.s.men.some(m => m.home)).length, S.length)})`);
      say(`  the men at home: ${['patrol', 'suspicious', 'alert', 'search'].map(st => `${st} ${home.filter(m => m.state === st).length}`).join(' · ')} · gun off that door, degrees: ${spread(home.map(m => m.off))} · within 30°: ${pct(home.filter(m => m.off <= 30).length, home.length)} · over 90°: ${pct(home.filter(m => m.off > 90).length, home.length)} · off the mark by 1.5 m or more: ${home.filter(m => m.fromMark >= 1.5).length}`);
      for (const n of [1, 2, 3, 4]) { const N = S.filter(x => x.nth === n); if (N.length) say(`  door order ${n} of a run: ${N.length} · men of the room at home ${N.reduce((a, x) => a + x.s.men.filter(m => m.home).length, 0)} (${(N.reduce((a, x) => a + x.s.men.filter(m => m.home).length, 0) / N.length).toFixed(2)} a door) · of them alert ${N.reduce((a, x) => a + x.s.men.filter(m => m.home && m.state === 'alert').length, 0)}, gun within 30° of the door ${N.reduce((a, x) => a + x.s.men.filter(m => m.home && m.off <= 30).length, 0)}`); }
    }
    // what surprise buys: each door order by what the room's men at home knew when it was given (calm = not alert, awareness under 0.3: they had not heard the team)
    {
      const rows = D.flatMap(r => { const ord = r.def!.doors.filter(s => s.when === 'order'); return (r.entries ?? []).map((e, i) => ({ e, s: ord[i], loud: r.def!.loudAt !== null && ord[i] !== undefined && ord[i].t > r.def!.loudAt! })).filter(x => x.s && x.s.door === x.e.door); });
      const kind = (x: typeof rows[0]) => { const h = x.s.men.filter(m => m.home); return !h.length ? 'nobody at home' : h.every(m => m.state !== 'alert' && m.state !== 'search' && m.aw < 0.3) ? 'at home, calm' : 'at home, roused'; };
      say(); say(`door orders by what the room's men knew at the order (${rows.length} matched to their entry rows):`);
      say(`  ${'the room\'s men'.padEnd(18)}| orders | men sent | lost by its end | a man lost in | their men dropped: from outside · inside · others' | s from order to first man across`);
      for (const k of ['at home, calm', 'at home, roused', 'nobody at home']) { const X = rows.filter(x => kind(x) === k); if (!X.length) continue; const men = X.reduce((n, x) => n + x.e.men, 0), lost = X.reduce((n, x) => n + x.e.lost, 0);
        say(`  ${k.padEnd(18)}| ${String(X.length).padStart(6)} | ${String(men).padStart(8)} | ${String(lost).padStart(6)} ${pct(lost, men).padStart(5)}    | ${pct(X.filter(x => x.e.lost > 0).length, X.length).padStart(5)} of them | ${X.reduce((n, x) => n + x.e.out, 0)} · ${X.reduce((n, x) => n + x.e.in, 0)} · ${X.reduce((n, x) => n + x.e.open, 0)} | ${spread(X.filter(x => x.e.cross !== null).map(x => x.e.cross! - x.e.t0))}`); }
      const first = rows.filter(x => !x.loud), later = rows.filter(x => x.loud);
      say(`  given before anything loud: ${first.length} orders, ${first.reduce((n, x) => n + x.e.lost, 0)} of ${first.reduce((n, x) => n + x.e.men, 0)} men lost by its end · given after: ${later.length} orders, ${later.reduce((n, x) => n + x.e.lost, 0)} of ${later.reduce((n, x) => n + x.e.men, 0)}`);
    }
    // the run's door orders in the order they were given: which door, with what, and what each cost
    {
      const count = (xs: string[]) => [...new Set(xs)].map(k => `${k} ${xs.filter(x => x === k).length}`).join(', ');
      say(); say('door orders by their place in the run:');
      for (let n = 0; ; n++) { const E = D.flatMap(r => r.entries?.[n] ? [r.entries[n]] : []); if (!E.length) break; const men = E.reduce((a, e) => a + e.men, 0), lost = E.reduce((a, e) => a + e.lost, 0);
        say(`  order ${n + 1}: ${E.length} · ${count(E.map(e => e.door))} · ${count(E.map(e => e.tool))} · men sent ${men}, lost by its end ${lost} (${pct(lost, men)}; a man lost in ${pct(E.filter(e => e.lost > 0).length, E.length)} of them) · their men dropped from outside ${E.reduce((a, e) => a + e.out, 0)}, inside ${E.reduce((a, e) => a + e.in, 0)}`); }
    }
    // rooms: cleared with nobody going in, and cleared rooms held again
    const logs = D.map(r => r.def!.rooms), cleared = logs.flatMap(l => l.filter(x => x[1].startsWith('cleared:'))), lost = logs.flatMap(l => l.filter(x => x[1].startsWith('lost:')));
    if (cleared.length || lost.length) { say(); say(`rooms called clear: ${cleared.length} (${(cleared.length / D.length).toFixed(1)} a run) against ${D.reduce((n, r) => n + r.rooms, 0)} door orders · a clear room held again by one of theirs walking in: ${lost.length} times in ${logs.filter(l => l.some(x => x[1].startsWith('lost:'))).length} runs${lost.length ? ` (${[...new Set(lost.map(x => x[1]))].map(w => `${w.slice(5)} ${lost.filter(x => x[1] === w).length}`).join(' · ')})` : ''}`); }
    const sum = (k: 'fight' | 'tactics') => { const o: Record<string, number> = {}; for (const r of D) for (const [a, b] of Object.entries(r.def![k])) o[a] = (o[a] ?? 0) + (b as number); return Object.entries(o).filter(([, v]) => v).map(([a, b]) => `${a} ${b}`).join(' · '); };
    say(); say(`the room fight's own counts, summed: ${sum('fight')}`); say(`the pursuit tactics' own counts, summed: ${sum('tactics') || 'none'}`);
  }
  console.log(L.join('\n')); console.log();
}
