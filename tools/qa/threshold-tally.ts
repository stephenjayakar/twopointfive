// THE THRESHOLD'S BEFORE AND AFTER — tables out of playthrough.ts's JSON (its Tally: a row per door order, a row per defender's death), one COLUMN per file,
// every column over the same scenarios and seeds (a run missing from any column is dropped from all of them, and said):
//   bun run tools/qa/playthrough.ts --seeds 1-48 --json before.json                       today's entry (bang and clear while there is a can, else open and clear; F in a rescue)
//   PT_TOOL=threshold bun run tools/qa/playthrough.ts --seeds 1-48 --json step.json       the threshold, stepping in by itself
//   PT_TOOL=hold bun run tools/qa/playthrough.ts --seeds 1-48 --json hold.json            the threshold held, the commander saying what next
//   bun run tools/qa/threshold-tally.ts --col "today=before.json" --col "step in by itself=step.json" --col "hold, then told=hold.json" [--md] [--by-scn] [--windows 8] [--boot 4000]
// The first column is the one the others are set against: the DIFFERENCE rows are paired by (scenario, seed) with a 95 % interval from a bootstrap over the
// pairs, resampled inside each scenario (its own seeded dice: the same files give the same table). An interval that holds 0 is not a difference.
// exit 0 · 2 = bad flags / an unreadable file
import { readFileSync } from 'node:fs';
import type { RunOut, EntryOut } from './playthrough.ts';

const argv = process.argv.slice(2), md = argv.includes('--md'), byScn = argv.includes('--by-scn');
const flagAll = (n: string) => argv.flatMap((a, i) => a === n ? [argv[i + 1]] : []), flag = (n: string) => flagAll(n)[0];
const KNOWN = ['--col', '--md', '--by-scn', '--boot', '--blind', '--windows'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const BOOT = Number(flag('--boot') ?? 4000), BLIND = Number(flag('--blind') ?? 12), WINDOW = Number(flag('--windows') ?? 0);   // (--blind: cells of floor that make a blind pocket — DOORTOOLS.thrPocket)
interface Col { name: string; runs: Map<string, RunOut> }
const cols: Col[] = [];
for (const c of flagAll('--col')) { const k = c.indexOf('='); if (k < 0) { console.error(`--col name=file.json (got '${c}')`); process.exit(2); }
  try { const runs = JSON.parse(readFileSync(c.slice(k + 1), 'utf8')).runs as RunOut[]; cols.push({ name: c.slice(0, k), runs: new Map(runs.map(r => [`${r.scn}:${r.seed}`, r])) }); }
  catch (e) { console.error(`${c.slice(k + 1)}: ${e instanceof Error ? e.message : e}`); process.exit(2); } }
if (!cols.length) { console.error('no columns — --col "name=file.json" (the first is the one the others are set against)'); process.exit(2); }

// the runs every column has
const all = [...new Set(cols.flatMap(c => [...c.runs.keys()]))], keys = all.filter(k => cols.every(c => c.runs.has(k) && c.runs.get(k)!.end !== 'error'));
const scns = [...new Set(keys.map(k => k.split(':')[0]))];
const WELL = new Set(['taken', 'rescued']);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0), mean = (xs: number[]) => xs.length ? sum(xs) / xs.length : NaN;
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—', pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';
const WORDS: Record<string, string> = { bangClear: 'bang and clear', openClear: 'open and clear', threshold: 'threshold', thresholdHold: 'threshold, held', outside: 'clear from outside', charge: 'charge' };
const went = (e: EntryOut) => e.cross !== null, ended = (e: EntryOut) => e.t1 !== null;

/** what a set of runs adds up to (one column's cell values) */
function tally(rs: RunOut[]) {
  const E = rs.flatMap(r => r.entries ?? []), K = rs.flatMap(r => r.kills ?? []), L = rs.flatMap(r => r.losses ?? []), modelled = E.filter(e => went(e) && e.cells > 0);
  const lossAt = (a: string) => L.filter(l => l.at === a).length;
  // a man lost going in: behind a can (one went off for that door's order) or with none
  let inCan = 0, inDry = 0; for (const r of rs) for (const l of r.losses ?? []) { if (l.at !== 'entry') continue; const e = (r.entries ?? []).filter(x => x.door === l.door && x.t0 <= l.t).pop(); if (e && e.bangs > 0) inCan++; else inDry++; }
  const wentE = E.filter(went);
  // the men lost at the door before anyone was across, against their own death rows: the door order's phase he died in, what his eyes had of his killer
  let doorWork = 0, doorDark = 0; for (const r of rs) for (const l of r.losses ?? []) { if (l.at !== 'door') continue; const d = (r.deaths ?? []).find(x => x.who === l.who && Math.abs(x.t - l.t) < 0.2); if (!d) continue;
    if (d.door === 'thr' || d.door === 'pocket' || d.door === 'stack') doorWork++; if (d.meter < 0.1) doorDark++; }
  return {
    runs: rs.length, well: rs.filter(r => WELL.has(r.end)).length, bad: rs.filter(r => r.end === 'wiped' || r.end === 'lost').length,
    stalled: rs.filter(r => r.end === 'stalled').length, error: rs.filter(r => r.end === 'error').length,
    up: sum(rs.map(r => r.team)), of: sum(rs.map(r => r.of)),
    host: sum(rs.map(r => r.hostages?.[0] ?? 0)), hostOf: sum(rs.map(r => r.hostages?.[1] ?? 0)),
    theirsDown: sum(rs.map(r => r.hostilesOf - r.hostiles)), theirsOf: sum(rs.map(r => r.hostilesOf)),
    out: K.filter(k => k.where === 'outside').length, in: K.filter(k => k.where === 'inside').length, open: K.filter(k => k.where === 'open').length, pre: K.filter(k => k.pre).length, kills: K.length,
    entries: E.length, crossed: E.filter(went).length, lostAtDoor: sum(E.map(e => e.lost)),
    tools: [...new Set(E.map(e => e.tool))].sort().map(k => `${E.filter(e => e.tool === k).length} ${WORDS[k] ?? k}`).join(' · '),
    secs: E.filter(ended).map(e => e.t1! - e.t0), toCross: E.filter(went).map(e => e.cross! - e.t0), held: E.filter(e => e.held !== undefined).map(e => e.held!),
    bangs: sum(rs.map(r => r.bangs ?? 0)), modelled: modelled.length, blind: modelled.filter(e => e.blind >= BLIND).length, blindMan: modelled.filter(e => e.blind >= BLIND && e.blindMen > 0).length,
    blindShare: mean(modelled.map(e => e.blind / e.cells)),
    inCan, inDry, wentCan: wentE.filter(e => e.bangs > 0).length, wentDry: wentE.filter(e => !e.bangs).length,
    lDoor: lossAt('door'), lEntry: lossAt('entry'), lLater: lossAt('later') + lossAt('none'), doorWork, doorDark,
    runSecs: mean(rs.map(r => r.t)), refused: sum(rs.map(r => r.refused.length)), told: rs.flatMap(r => r.told ?? []),
  };
}
type T = ReturnType<typeof tally>;

/** paired difference against the first column, with a 95 % bootstrap interval over the (scenario, seed) pairs, resampled inside each scenario */
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function paired(c: Col, ks: string[], of: (r: RunOut) => number): string {
  const base = cols[0], d = ks.map(k => of(c.runs.get(k)!) - of(base.runs.get(k)!)), tot = sum(d);
  const groups = [...new Set(ks.map(k => k.split(':')[0]))].map(s => ks.map((k, i) => k.startsWith(s + ':') ? i : -1).filter(i => i >= 0));
  const rnd = seeded(0x51ab + ks.length), boots: number[] = [];
  for (let b = 0; b < BOOT; b++) { let s = 0; for (const g of groups) for (let i = 0; i < g.length; i++) s += d[g[(rnd() * g.length) | 0]]; boots.push(s); }
  boots.sort((a, b) => a - b); const lo = boots[Math.floor(BOOT * 0.025)], hi = boots[Math.ceil(BOOT * 0.975) - 1];
  const sg = (x: number) => (x > 0 ? '+' : '') + x; return `${sg(tot)} (${sg(lo)} to ${sg(hi)})${lo > 0 || hi < 0 ? '' : ' ·'}`;
}

function table(title: string, ks: string[]) {
  const C = cols.map(c => tally(ks.map(k => c.runs.get(k)!))), rows: [string, (t: T, c: Col, i: number) => string][] = [
    ['runs', t => `${t.runs}`],
    ['ended well (rooms taken / hostages out)', t => `${t.well}`],
    ['squad wiped / rescue lost', t => `${t.bad}`],
    ['stalled (ran out the clock)', t => `${t.stalled}${t.error ? ` + ${t.error} threw` : ''}`],
    ['teammates up at the end', t => `${t.up} of ${t.of}`],
    ['  against today, same seeds (95 %)', (_t, c, i) => i ? paired(c, ks, r => r.team) : ''],
    ['teammates lost', t => `${t.of - t.up}`],
    ['  at the door, nobody across yet · going in and the 10 s after · later', t => `${t.lDoor} · ${t.lEntry} · ${t.lLater}`],
    ['  of those at the door: stacked or working it from the jambs · by a man under 0.1 on his own meter', t => `${t.doorWork} · ${t.doorDark}`],
    ...(C.some(t => t.hostOf) ? [
      ['hostages alive at the end', (t: T) => `${t.host} of ${t.hostOf}`] as [string, (t: T, c: Col, i: number) => string],
      ['  against today, same seeds (95 %)', (_t: T, c: Col, i: number) => i ? paired(c, ks, r => r.hostages?.[0] ?? 0) : ''] as [string, (t: T, c: Col, i: number) => string]] : []),
    ['defenders down', t => `${t.theirsDown} of ${t.theirsOf}`],
    ['  in a room, shot from outside it', t => `${t.out} (${pct(t.out, t.out + t.in)} of those in rooms)`],
    ['  in a room, shot by a man in it with him', t => `${t.in}`],
    ['  out on open floor (corridors, halls)', t => `${t.open}`],
    ["  a door's own room, before anyone had crossed", t => `${t.pre}`],
    ['door orders given · that went in', t => `${t.entries} · ${t.crossed}`],
    ['  went in behind a can · with no can', t => `${t.wentCan} · ${t.wentDry}`],
    ['  teammates lost going in: behind a can · with no can', t => `${t.inCan} · ${t.inDry}`],
    ['  by tool', t => t.tools],
    ['seconds a door, order to end (median · mean)', t => `${f1(median(t.secs))} · ${f1(mean(t.secs))}`],
    ['seconds to the first man across (median)', t => f1(median(t.toCross))],
    ['seconds working it from the jambs (median)', t => t.held.length ? f1(median(t.held)) : '—'],
    ['seconds a run (mean)', t => `${Math.round(t.runSecs)}`],
    ['bangs spent (a run)', t => `${t.bangs} (${f1(t.bangs / t.runs)})`],
    [`went in with ${BLIND}+ cells (${BLIND / 4} m²) nobody saw or banged`, t => `${t.blind} of ${t.modelled} (${pct(t.blind, t.modelled)})`],
    ['  … with a defender standing on that floor', t => `${t.blindMan} of ${t.modelled} (${pct(t.blindMan, t.modelled)})`],
    ['  floor unseen and unbanged at the crossing (mean)', t => Number.isFinite(t.blindShare) ? `${Math.round(100 * t.blindShare)} %` : '—'],
    ...(C.some(t => t.told.length) ? [['told: bang, then step in · step in · bang refused · nothing to tell', (t: T) => t.told.length ? `${t.told.filter(x => x === 'bang').length} · ${t.told.filter(x => x === 'step').length} · ${t.told.filter(x => x === 'bang refused').length} · ${t.told.filter(x => x === 'ended first' || x === 'not holding' || x === 'step refused').length}` : ''] as [string, (t: T, c: Col, i: number) => string]] : []),
    ['orders refused', t => `${t.refused}`],
  ];
  const cells = rows.map(([name, f]) => [name, ...C.map((t, i) => f(t, cols[i], i))]);
  console.log(md ? `\n**${title}**\n` : `\n${title}`);
  if (md) { console.log(`| | ${cols.map(c => c.name).join(' | ')} |`); console.log(`|---|${cols.map(() => '---|').join('')}`); for (const r of cells) console.log(`| ${r[0].replace(/^ {2}/, '&nbsp;&nbsp;')} | ${r.slice(1).join(' | ')} |`); }
  else { const w = [Math.max(...cells.map(r => r[0].length)) + 2, ...cols.map((c, i) => Math.max(c.name.length, ...cells.map(r => r[i + 1].length)) + 3)];
    console.log([''.padEnd(w[0]), ...cols.map((c, i) => c.name.padEnd(w[i + 1]))].join('')); for (const r of cells) console.log(r.map((x, i) => x.padEnd(w[i])).join('')); }
}

/** a row a scenario: teammates up, runs ended well, hostages — every column side by side */
function byScenario() {
  const head = ['scenario', ...cols.map(c => c.name)], rows: string[][] = [];
  for (const s of [...scns, 'all']) { const ks = s === 'all' ? keys : keys.filter(k => k.startsWith(s + ':'));
    rows.push([s, ...cols.map(c => { const t = tally(ks.map(k => c.runs.get(k)!)); return `${t.up} of ${t.of} up · ${t.well} of ${t.runs} well${t.hostOf ? ` · ${t.host} of ${t.hostOf} hostages` : ''}${t.stalled ? ` · ${t.stalled} stalled` : ''}`; })]); }
  console.log(md ? '\n**BY SCENARIO** (teammates up at the end · runs ended well)\n' : '\nBY SCENARIO (teammates up at the end · runs ended well)');
  if (md) { console.log(`| ${head.join(' | ')} |`); console.log(`|${head.map(() => '---|').join('')}`); for (const r of rows) console.log(`| ${r.join(' | ')} |`); }
  else { const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)) + 3); console.log(head.map((h, i) => h.padEnd(w[i])).join('')); for (const r of rows) console.log(r.map((x, i) => x.padEnd(w[i])).join('')); }
}

const seeds = [...new Set(keys.map(k => Number(k.split(':')[1])))].sort((a, b) => a - b);
console.log(`${keys.length} runs a column: ${scns.length} scenarios (${scns.join(', ')}) × seeds ${seeds[0]}–${seeds[seeds.length - 1]}${all.length !== keys.length ? ` — ${all.length - keys.length} runs dropped: not in every column, or one that threw` : ''}`);
for (const c of cols) { const bad = [...c.runs.values()].filter(r => r.end === 'error'); if (bad.length) console.log(`  ${c.name}: ${bad.length} threw (${bad.map(r => `${r.scn}:${r.seed}`).join(', ')})`); }
console.log(`A difference marked · has 0 inside its interval: not a difference these runs can tell.`);
table('ALL SCENARIOS', keys);
const kind = (s: string) => /rescue/.test(s) ? 'rescue' : 'rooms';
for (const k of ['rooms', 'rescue']) { const ks = keys.filter(x => kind(x.split(':')[0]) === k); if (ks.length && ks.length !== keys.length) table(k === 'rooms' ? 'THE ROOM-CLEARING SCENARIOS' : 'THE RESCUES', ks); }
byScenario();
if (byScn) for (const s of scns) table(s, keys.filter(k => k.startsWith(s + ':')));
// --windows N: teammates up in each stretch of N seeds (how far one small set of seeds can sit from the whole)
if (WINDOW > 0) for (const k of ['rooms', 'all']) { const ks0 = keys.filter(x => k === 'all' || kind(x.split(':')[0]) === 'rooms');
  console.log(`\n${md ? '**' : ''}TEAMMATES UP BY ${WINDOW} SEEDS, ${k === 'all' ? 'ALL SCENARIOS' : 'THE ROOM-CLEARING SCENARIOS'}${md ? '**\n' : ''}`);
  if (md) { console.log(`| seeds | ${cols.map(c => c.name).join(' | ')} |`); console.log(`|---|${cols.map(() => '---|').join('')}`); }
  for (let a = seeds[0]; a <= seeds[seeds.length - 1]; a += WINDOW) { const ks = ks0.filter(x => { const n = Number(x.split(':')[1]); return n >= a && n < a + WINDOW; }); if (!ks.length) continue;
    const cells = cols.map(c => { const t = tally(ks.map(x => c.runs.get(x)!)); return `${t.up} of ${t.of} · ${t.well} of ${t.runs} well`; });
    console.log(md ? `| ${a}–${a + WINDOW - 1} | ${cells.join(' | ')} |` : `${a}–${a + WINDOW - 1}`.padEnd(10) + cells.map(x => x.padEnd(30)).join('')); } }
