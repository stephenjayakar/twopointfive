// QUIET RUNS, ONE SWITCH ARM AGAINST ANOTHER, SEED FOR SEED — the tables of two tagged pair-sneak pools (tools/qa/pair-sneak.ts --out <dir> --tag X) laid
// beside each other: how the runs end, the paired differences with their bootstrap intervals, how far a quiet run gets before a squad is in contact, how
// the first man dropped was found out, the first thing to go wrong, what the radio check did, and the seeds that show the best and the worst of it.
//   bun run tools/qa/quiet-switch-tally.ts <dir> --a off --b on [--adir <dir of the A rows>] [--examples 3] [--json out.json]
// A row's tag is its file's: <map>.<solo|pair>.<tag>.jsonl (`--a -` = untagged files). A seed's LAST row counts; only seeds both sets hold are read.
// It only reads rows: m.dropLog / m.calls / squads[].events (the silent-drop tags) must be in them.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const dirB = resolve(argv[0] ?? 'pair-sneak-runs'), dirA = resolve(flag('--adir') ?? dirB), TA = flag('--a') ?? 'off', TB = flag('--b') ?? 'on', EX = Number(flag('--examples') ?? 3);
type Run = any; type Pool = Map<string, Map<string, Map<number, Run>>>;   // map → arm → seed → row
function load(dir: string, tag: string): Pool { const P: Pool = new Map();
  for (const f of readdirSync(dir)) { const m = f.match(/^(.+?)\.(solo|pair)(?:\.(.+))?\.jsonl$/); if (!m || (m[3] ?? '-') !== tag) continue;
    for (const l of readFileSync(resolve(dir, f), 'utf8').split('\n')) { if (!l.trim()) continue; let r: Run; try { r = JSON.parse(l); } catch { continue; }
      if (!P.has(m[1])) P.set(m[1], new Map()); const A = P.get(m[1])!; if (!A.has(m[2])) A.set(m[2], new Map()); A.get(m[2])!.set(r.seed, r); } }
  return P; }
const PA = load(dirA, TA), PB = load(dirB, TB);
const ORDER = ['block-squads', 'warehouse-four', 'compound-four', 'barracks-four'], maps = [...PB.keys()].filter(k => PA.has(k)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)), ARMS = ['solo', 'pair'];
/** the pairs of one map and arm: the seeds both sets hold, neither an errored run */
function pairs(map: string, arm: string): [Run, Run][] { const A = PA.get(map)?.get(arm), B = PB.get(map)?.get(arm); if (!A || !B) return [];
  return [...A.keys()].filter(s => B.has(s)).sort((x, y) => x - y).map(s => [A.get(s), B.get(s)] as [Run, Run]).filter(([a, b]) => a.cls !== 'error' && b.cls !== 'error'); }

// ───────────────────────────── a row's reading (pair-sneak-tally.ts's own classes and causes)
const worst0 = (r: Run) => Math.max(0, ...Object.values(r.m?.aw ?? {}) as number[]);
const hot0 = (r: Run) => !!r.m?.hot && r.m.hot.alert + r.m.hot.search > 0;
const cls2 = (r: Run): string => r.cls === 'error' ? 'error' : r.samDown ? 'dead' : r.m.firstLoud ? 'loud' : hot0(r) || worst0(r) > 0.75 ? 'spotted' : r.m.rousedN > 0 ? 'looked' : r.m.hot.suspicious > 0 ? 'turned' : r.finished ? 'ghost' : 'stalled';
const CLS = ['ghost', 'turned', 'looked', 'spotted', 'loud', 'dead', 'stalled'];
const RANK: Record<string, number> = { ghost: 6, turned: 5, looked: 4, stalled: 3.5, spotted: 3, loud: 2, dead: 1, error: 0 };
function cause(r: Run): string { const F = r.m.first; if (!F) return 'nothing went wrong';
  if (F.how === 'loud') return `loud: ${F.src} ${F.kind}`;
  const note = (F.notes ?? []).join(' | '), seen = F.sawAgo !== null && F.sawAgo !== undefined && F.sawAgo < 0.6, heard = F.heard && F.heard.ago < 0.6, lately = F.heard && F.heard.ago < 4;
  const whose = (s: string) => s === 'drop' ? "a dropped man's weapon" : s === 'mate' ? "the partner's" : s === 'sam' ? "Sam's" : s === 'theirs' ? 'their own' : s === 'world' ? "the world's" : s;
  if (seen && (F.foe === 'mate' || F.foe === 'sam')) return `${F.foe === 'mate' ? 'partner' : 'Sam'} seen${lately ? ' (a noise had him half up)' : ''}`;
  if (heard) return `${whose(F.heard.src)} ${F.heard.kind} heard`;
  if (/\[squads\]|reinforce|dig-in|plants|rall/.test(note)) return 'their own word (no defender saw or heard it)';
  return 'unclear'; }
const cs = (x: number) => Math.round(x * 100);   // (stamps are r2 of the run clock: compared in whole hundredths, never as floats)
/** AT ONCE: a contact inside this of a drop is the drop seen as it happened (the squads' own log prints such a sighting as '0.0' or '0.1 s after he dropped') */
const ONCE = 0.15;
/** the first frame any squad was in contact (run seconds), or null */
const contactT = (r: Run): number | null => { const c = (r.m.calls ?? []) as any[]; return c.length ? Math.min(...c.map(x => x.t)) : null; };
const drops = (r: Run): any[] => r.m.dropLog ?? [];
const downBefore = (r: Run, T: number | null) => drops(r).filter(d => T === null || cs(d.t) < cs(T) - cs(ONCE)).length;   // (a man whose fall WAS the contact, or was seen as he fell, is not 'down before it')
const downBeforeContact = (r: Run) => downBefore(r, contactT(r));
const downBeforeWrong = (r: Run) => downBefore(r, r.m.first ? r.m.first.t : null);
/** first drop → first contact: 'none' (no man dropped), 'before' (a squad was in contact before any man dropped), 'never' (no squad ever was), or seconds */
const gap = (r: Run): number | 'none' | 'before' | 'never' => { const d = drops(r)[0], T = contactT(r); if (!d) return 'none'; if (T === null) return 'never'; return cs(T) < cs(d.t) ? 'before' : Math.max(0, +(T - d.t).toFixed(2)); };
const gapBucket = (r: Run): string => { const x = gap(r); return x === 'none' ? 'no man dropped' : x === 'before' ? 'a squad in contact before any drop' : x === 'never' ? 'no squad ever in contact' : x <= ONCE ? 'as he dropped (inside 0.15 s)' : x <= 3 ? '0.15 to 3 s later' : x <= 10 ? '3 to 10 s later' : x <= 30 ? '10 to 30 s later' : 'over 30 s later'; };
const GAPS = ['no man dropped', 'a squad in contact before any drop', 'as he dropped (inside 0.15 s)', '0.15 to 3 s later', '3 to 10 s later', '10 to 30 s later', 'over 30 s later', 'no squad ever in contact'];
/** how the FIRST man dropped was found out by his own squad, read off that squad's own log (enemysquads.ts events) and the tool's call tags */
function found(r: Run): string { const d = drops(r)[0]; if (!d) return 'no man dropped';
  const Tany = contactT(r); if (Tany !== null && cs(Tany) < cs(d.t)) return 'a squad was in contact before any drop';
  const Q = (r.squads ?? []).find((q: any) => q.name === d.squad);
  // (the squads' own log stamps to a tenth of a second: its rows are matched to the tool's hundredths with that much slack)
  const ev = ((Q?.events ?? []) as any[]).filter(e => e.t >= d.t - 0.11).sort((a, b) => a.t - b.t);
  const callsQ = ((r.m.calls ?? []) as any[]).filter(c => c.squad === d.squad && cs(c.t) >= cs(d.t)), tq = callsQ.length ? callsQ[0].t : null;
  // (dropLog's `state` is read after the drop's own frame: a squad whose contact IS this drop already reads 'contact'. Already in contact = it read so with no fresh call on that frame)
  if (d.state === 'contact' && !(tq !== null && cs(tq) - cs(d.t) <= 2 && callsQ[0].was !== 'contact')) return 'his squad was already in contact';
  const w = ev.filter(e => e.t <= (tq ?? Infinity) + 0.11), has = (what: string, re: RegExp) => w.find(e => e.what === what && re.test(e.why)), who = d.who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heard = has('check', new RegExp(`where ${who} stands`)), asked = has('asks', new RegExp(`from ${who}:`)), went = has('looks', new RegExp(`where ${who} stood`)), seen = has('found', new RegExp(`has ${who} in sight`)), looker = has('found', new RegExp(`sent to look, has ${who} down`)), shot = has('found', new RegExp(`dropped ${who}$`));
  const nosign = has('no sign', new RegExp(`^${who} is (not where he stood|on the net again)|no way to ${who}'s post`)), other = w.find(e => e.what === 'found' && e !== seen && e !== looker && e !== shot), wiped = ev.find(e => e.what === 'down');
  const age = seen ? Number((seen.why.match(/([\d.]+) s after he dropped/) ?? [])[1]) : NaN;
  if (!r.sq?.radioCheck) { if (tq === null) return d.home && d.mateHome ? 'never (off: no call though a mate was at home)' : 'nobody to miss him (outside his rooms, or no mate at home)';
    const c = callsQ[0]; if (tq - d.t > ONCE) return 'the team was met later (eyes or noise)'; return c.cause === 'drop' ? 'the drop itself, that frame (nobody saw or heard it)' : c.cause === 'call' ? 'that frame, at the end of a man\'s call' : c.cause === 'eyes' ? 'that frame, with eyes on the team' : c.cause === 'ears' ? 'that frame, with a loud thing heard' : 'that frame (cause not read)'; }
  // how it ended when no man of the squad saw HIS body: another man's body seen, the team met, the squad wiped, no sign, or the run over
  const tail = () => looker || seen ? 'the body seen' : tq !== null ? (other ? "another man's body seen first" : 'the team met first (eyes or noise)') : nosign ? 'no sign' : wiped ? 'every man of his squad dropped first' : 'the run ended first';
  if (shot) return 'a mate heard the shot';
  if (seen && age <= 0.1) return 'seen as he fell';
  if (heard && asked) return `heard, asked by name${went ? ', men walked' : ''}: ${tail()}`;
  if (heard) return `heard (not yet asked): ${tail()}`;
  if (asked) return `the check missed him${went ? ', men walked' : ''}: ${tail()}`;
  if (seen) return 'the body seen later (nobody heard, nobody asked)';
  if (tq !== null) return other ? "never by his own drop: another man's body seen first" : 'never by his own drop: the team was met first (eyes or noise)';
  if (!d.home || !d.mateHome) return 'nobody to miss him (outside his rooms, or no mate at home)';
  return wiped ? 'never: every man of his squad dropped first' : r.t - d.t < 60 ? 'never: the run ended inside one check beat' : 'NEVER, squad alive over 60 s'; }
/** every man dropped at home with a mate at home, his squad not in contact then nor ever after, no body of his found, and the squad up for over 60 s more:
 *  a squad that should have missed him (one beat of the check is 48 s at the most, the ask 4 s on, the walk 4 s after) and did not. A man lost on the squad's
 *  errand (its log's own 'lost' row: the go-round sends the next man to his spot) is not one of these */
function unlearned(r: Run): any[] { return drops(r).filter(d => { if (!d.home || !d.mateHome) return false;
  const Q = (r.squads ?? []).find((q: any) => q.name === d.squad); if (!Q) return false; const E = (Q.events as any[]), who = d.who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = E.filter(e => e.t < d.t - 0.11 && (e.what === 'contact' || e.what === 'quiet')).pop(); if (before?.what === 'contact') return false;
  if (((r.m.calls ?? []) as any[]).some(c => c.squad === d.squad && cs(c.t) >= cs(d.t))) return false;
  if (E.some(e => e.t >= d.t - 0.11 && (e.what === 'contact' || (['found', 'asks', 'looks', 'no sign', 'lost'].includes(e.what) && new RegExp(`${who}(\\D|$)`).test(e.why))))) return false;
  const end = E.find(e => e.what === 'down')?.t ?? r.t; return end - d.t > 60; }); }
/** the four buckets of the brief */
const found4 = (s: string) => /^seen as he fell|that frame|the drop itself|heard the shot/.test(s) ? 'at once (seen as he fell, or the old rule)' : /^heard/.test(s) ? 'a mate heard the fall' : /^the check/.test(s) ? "the squad's check" : /^the body seen later/.test(s) ? 'body seen later' : /before any drop|already in contact/.test(s) ? 'contact came first' : /^no man/.test(s) ? 'no man dropped' : 'never by the drop';
/** what the check did in a run (switch on) */
function activity(r: Run) { const E = ((r.squads ?? []) as any[]).flatMap(q => (q.events as any[]).map(e => ({ ...e, squad: q.name, end: (q.events as any[]).find((x: any) => x.what === 'down')?.t ?? r.t }))); const n = (f: (e: any) => boolean) => E.filter(f).length;
  const looks = E.filter(e => e.what === 'looks'), judged = looks.filter(e => e.end - e.t > 45);   // (a walk is judged only where its squad had men up for 45 s after it)
  // a walk with no logged end: no body found, no 'no sign', no contact of that squad, no second walk in the 45 s after. A looker dropped on his way, or turned back by news of the team, logs nothing either: a flag here is a seed to read, not a verdict
  const stuck = judged.filter(e => !E.some(x => x.squad === e.squad && x.t > e.t && x.t <= e.t + 45 && ['found', 'no sign', 'contact', 'looks'].includes(x.what)));
  const late = (e: any) => Number((e.why.match(/([\d.]+) s after he dropped/) ?? [])[1]) > 0.1;
  return { routine: n(e => e.what === 'check' && e.why.includes('radio check')), heard: n(e => e.what === 'check' && e.why.includes('heard something')), asks: n(e => e.what === 'asks'), looks: looks.length, judged: judged.length, lookFound: n(e => e.what === 'found' && e.why.includes('sent to look')), seenFound: n(e => e.what === 'found' && e.why.includes('in sight')), seenLate: n(e => e.what === 'found' && e.why.includes('in sight') && late(e)), nosign: n(e => e.what === 'no sign'), glimpse: n(e => e.what === 'glimpse'), stuck: stuck.length }; }
/** the drop knob changed something a player could tell (a fall heard, a man asked for, men walking, a body found later than as he fell, no sign) */
const actedDrop = (r: Run) => { const a = activity(r); return a.heard + a.asks + a.looks + a.lookFound + a.seenLate + a.nosign > 0; };
/** the eyes knob held a call back at least once */
const actedEyes = (r: Run) => activity(r).glimpse > 0;
/** the same run: the same ending at the same second with the same men down at the same moments */
const sameRun = (a: Run, b: Run) => a.cls === b.cls && a.end === b.end && a.t === b.t && a.hostiles === b.hostiles && JSON.stringify(drops(a).map(d => [d.t, d.who])) === JSON.stringify(drops(b).map(d => [d.t, d.who])) && JSON.stringify(a.m.first?.t ?? null) === JSON.stringify(b.m.first?.t ?? null) && JSON.stringify((a.m.calls ?? []).map((c: any) => [c.t, c.squad])) === JSON.stringify((b.m.calls ?? []).map((c: any) => [c.t, c.squad])) && a.m.samShots === b.m.samShots && a.m.theirShots === b.m.theirShots && a.m.rousedN === b.m.rousedN;

// ───────────────────────────── numbers
let rs = 0x2545f491; const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
/** the mean of the per-seed differences and its paired bootstrap interval (95 %, 4000 resamples of the seeds) */
function boot(d: number[]): { m: number; lo: number; hi: number } { if (d.length < 8) return { m: mean(d), lo: NaN, hi: NaN }; const B: number[] = [];
  for (let b = 0; b < 4000; b++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[(rnd() * d.length) | 0]; B.push(t / d.length); } B.sort((x, y) => x - y); return { m: mean(d), lo: B[100], hi: B[3899] }; }
const sg = (x: number, k = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(k)}`;
/** clear of zero AS PRINTED: an interval whose printed ends are not both on one side of zero is not called clear */
const clear = (b: { lo: number; hi: number }, k = 2) => +b.lo.toFixed(k) > 0 || +b.hi.toFixed(k) < 0;
/** a paired difference in points of runs (B − A) with its interval; bold when the interval is clear of zero */
const dPts = (P: [Run, Run][], f: (r: Run) => boolean) => { const b = boot(P.map(([a, c]) => (f(c) ? 100 : 0) - (f(a) ? 100 : 0))); const s = `${sg(b.m, 0)} (${sg(b.lo, 0)} to ${sg(b.hi, 0)})`; return clear(b, 0) ? `**${s}**` : s; };
const dNum = (P: [Run, Run][], f: (r: Run) => number, k = 2) => { const b = boot(P.map(([a, c]) => f(c) - f(a))); const s = `${sg(b.m, k)} (${sg(b.lo, k)} to ${sg(b.hi, k)})`; return clear(b, k) ? `**${s}**` : s; };
const row = (...c: (string | number)[]) => `| ${c.join(' | ')} |`, head = (...c: string[]) => { console.log(row(...c)); console.log(row(...c.map(() => '---'))); };
const pct = (n: number, d: number) => d ? `${Math.round(100 * n / d)}%` : '—', f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—', f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
const each = (fn: (map: string, arm: string, P: [Run, Run][]) => void) => { for (const map of maps) for (const arm of ARMS) { const P = pairs(map, arm); if (P.length) fn(map, arm, P); } };
const J: any = { a: TA, b: TB, cells: {} as Record<string, any> };

console.log(`# quiet runs · '${TA}' (A) against '${TB}' (B), the same seeds\n`);
{ const a = [...PA.values()].flatMap(m => [...m.values()].flatMap(s => [...s.values()])), b = [...PB.values()].flatMap(m => [...m.values()].flatMap(s => [...s.values()]));
  const sw = (R: Run[]) => [...new Set(R.map(r => r.sq ? `drop ${r.sq.radioCheck ? 'on' : 'off'}, eyes ${r.sq.noticedEyes ? 'on' : 'off'}` : 'not tagged'))].join(' / '), cf = (R: Run[]) => [...new Set(R.map(r => r.careful ? 'careful' : 'plain'))].join(' / ');
  console.log(`A: ${a.length} rows, script ${cf(a)}, switch as the rows say: ${sw(a)}. B: ${b.length} rows, script ${cf(b)}, switch: ${sw(b)}. Errored rows: A ${a.filter(r => r.cls === 'error').length}, B ${b.filter(r => r.cls === 'error').length}.\n`); }

console.log('## 1. How the runs end (A → B, runs)\n');
head('map', 'arm', 'seeds', ...CLS.map(c => c === 'looked' ? 'noticed' : c === 'turned' ? 'turned to a noise' : c), 'every defender down', 'the same run in both');
each((map, arm, P) => { const k = (i: 0 | 1, c: string) => P.filter(p => cls2(p[i]) === c).length; const same = P.filter(([a, b]) => sameRun(a, b)).length;
  J.cells[`${map}.${arm}`] = { n: P.length, A: Object.fromEntries(CLS.map(c => [c, k(0, c)])), B: Object.fromEntries(CLS.map(c => [c, k(1, c)])), same };
  console.log(row(map, arm, P.length, ...CLS.map(c => `${k(0, c)} → ${k(1, c)}`), `${P.filter(p => p[0].finished).length} → ${P.filter(p => p[1].finished).length}`, `${same} (${pct(same, P.length)})`)); });

console.log(`\n## 2. The paired difference, B minus A (points of runs; 95 % paired bootstrap interval; bold = clear of zero)\n`);
head('map', 'arm', 'seeds', 'B ends better / same / worse', 'ghost', 'nobody noticed (ghost or turned)', 'nobody on alert (ghost, turned or noticed)', 'loud', 'Sam dead', 'every defender down');
each((map, arm, P) => { let b = 0, s = 0, w = 0; for (const [a, c] of P) { const d = RANK[cls2(c)] - RANK[cls2(a)]; if (d > 0) b++; else if (d < 0) w++; else s++; }
  const inC = (...cs: string[]) => (r: Run) => cs.includes(cls2(r));
  console.log(row(map, arm, P.length, `${b} / ${s} / ${w}`, dPts(P, inC('ghost')), dPts(P, inC('ghost', 'turned')), dPts(P, inC('ghost', 'turned', 'looked')), dPts(P, inC('loud')), dPts(P, inC('dead')), dPts(P, r => r.finished))); });

console.log(`\n## 3. How far the quiet gets (means a run, A → B; the paired difference with its interval)\n`);
head('map', 'arm', 'men down before the first squad contact', 'difference', 'men down before the first thing went wrong', 'difference', 'defenders down at the end', 'difference', 'seconds to the first thing going wrong', 'difference');
each((map, arm, P) => { const A = P.map(p => p[0]), B = P.map(p => p[1]), ab = (f: (r: Run) => number, k = 2) => `${f2(mean(A.map(f)))} → ${f2(mean(B.map(f)))}`;
  const tw = (r: Run) => r.m.first ? r.m.first.t : r.t, dn = (r: Run) => r.hostilesOf - r.hostiles;
  J.cells[`${map}.${arm}`].downBeforeContact = [mean(A.map(downBeforeContact)), mean(B.map(downBeforeContact))];
  console.log(row(map, arm, ab(downBeforeContact), dNum(P, downBeforeContact), ab(downBeforeWrong), dNum(P, downBeforeWrong), ab(dn), dNum(P, dn), `${f1(mean(A.map(tw)))} → ${f1(mean(B.map(tw)))}`, dNum(P, tw, 1))); });

console.log(`\n## 4. From the first man dropped to the first squad in contact (runs, A → B)\n`);
head('map', 'arm', ...GAPS, 'median s, runs where a man dropped first and a squad came to contact');
each((map, arm, P) => { const k = (i: 0 | 1, g: string) => P.filter(p => gapBucket(p[i]) === g).length, md = (i: 0 | 1) => f1(median(P.map(p => gap(p[i])).filter(x => typeof x === 'number') as number[]));
  console.log(row(map, arm, ...GAPS.map(g => `${k(0, g)} → ${k(1, g)}`), `${md(0)} → ${md(1)}`)); });

for (const [i, tag] of [[0, TA], [1, TB]] as [0 | 1, string][]) {
  console.log(`\n## 5${i ? 'b' : 'a'}. How the first man dropped was found out by his own squad ('${tag}', runs)\n`);
  const all = new Map<string, Map<string, number[]>>(); each((map, arm, P) => { for (const p of P) { const s = found(p[i]); if (!all.has(s)) all.set(s, new Map()); const M = all.get(s)!; const k = `${map}.${arm}`; if (!M.has(k)) M.set(k, []); M.get(k)!.push(p[i].seed); } });
  const cols: string[] = []; each((map, arm) => { cols.push(`${map}.${arm}`); });
  head('how', ...cols.map(c => c.replace('-four', '').replace('-squads', '').replace('.', ' ')), 'all', 'seeds that show it');
  for (const [s, M] of [...all.entries()].sort((a, b) => [...b[1].values()].flat().length - [...a[1].values()].flat().length))
    console.log(row(s, ...cols.map(c => M.get(c)?.length ?? 0), [...M.values()].flat().length, [...M.entries()].slice(0, 4).map(([k, v]) => `${k.split('.')[0]}:${v.slice(0, EX).join('/')} ${k.split('.')[1]}`).join(' · ')));
  console.log(`\nIn four buckets:\n`); const b4 = new Map<string, Map<string, number>>(); each((map, arm, P) => { for (const p of P) { const s = found4(found(p[i])); if (!b4.has(s)) b4.set(s, new Map()); const k = `${map}.${arm}`; b4.get(s)!.set(k, (b4.get(s)!.get(k) ?? 0) + 1); } });
  head('how', ...cols.map(c => c.replace('-four', '').replace('-squads', '').replace('.', ' ')), 'all');
  for (const [s, M] of [...b4.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) console.log(row(s, ...cols.map(c => M.get(c) ?? 0), [...M.values()].reduce((x, y) => x + y, 0)));
}

console.log(`\n## 6. The first thing to go wrong (runs, A → B)\n`);
{ const all = new Map<string, Map<string, [number, number]>>(); const cols: string[] = [];
  each((map, arm, P) => { const k = `${map}.${arm}`; cols.push(k); for (const p of P) for (const i of [0, 1] as const) { const c = cause(p[i]); if (!all.has(c)) all.set(c, new Map()); const M = all.get(c)!; if (!M.has(k)) M.set(k, [0, 0]); M.get(k)![i]++; } });
  head('first compromise', ...cols.map(c => c.replace('-four', '').replace('-squads', '').replace('.', ' ')), 'all');
  const tot = (M: Map<string, [number, number]>, i: 0 | 1) => [...M.values()].reduce((s, v) => s + v[i], 0);
  for (const [c, M] of [...all.entries()].sort((a, b) => tot(b[1], 0) + tot(b[1], 1) - tot(a[1], 0) - tot(a[1], 1))) console.log(row(c, ...cols.map(k => { const v = M.get(k) ?? [0, 0]; return `${v[0]} → ${v[1]}`; }), `${tot(M, 0)} → ${tot(M, 1)}`)); }

console.log(`\n## 6b. What ended the quiet, against the first drop (A → B)\n`);
console.log(`"Went wrong" is the first of: a defender notices (awareness 0.5 or over, or alert / search), something loud. Seconds are from the first man dropped to that moment, over the runs where a man dropped first.\n`);
head('map', 'arm', 'something went wrong before any man dropped (runs)', 'median s from the first drop to the first thing going wrong', 'mean s', 'paired difference in that, runs with a drop first in both', 'wrong within 1 s of the first drop (runs)', 'nothing went wrong after a drop (runs)');
each((map, arm, P) => { const lead = (r: Run): number | 'pre' | 'none' | 'clean' => { const d = drops(r)[0], F = r.m.first; if (!d) return F ? 'pre' : 'none'; if (!F) return 'clean'; return cs(F.t) < cs(d.t) ? 'pre' : +(F.t - d.t).toFixed(2); };
  const L = [0, 1].map(i => P.map(p => lead(p[i]))), num = (i: number) => L[i].filter(x => typeof x === 'number') as number[], k = (i: number, f: (x: any) => boolean) => L[i].filter(f).length;
  const both = P.filter((p, j) => typeof L[0][j] === 'number' && typeof L[1][j] === 'number'), bi = P.map((p, j) => j).filter(j => typeof L[0][j] === 'number' && typeof L[1][j] === 'number'), b = boot(bi.map(j => (L[1][j] as number) - (L[0][j] as number)));
  const ds = `${sg(b.m, 1)} (${sg(b.lo, 1)} to ${sg(b.hi, 1)}; ${both.length} seeds)`;
  console.log(row(map, arm, `${k(0, x => x === 'pre')} → ${k(1, x => x === 'pre')}`, `${f1(median(num(0)))} → ${f1(median(num(1)))}`, `${f1(mean(num(0)))} → ${f1(mean(num(1)))}`, clear(b, 1) ? `**${ds}**` : ds, `${k(0, x => typeof x === 'number' && x <= 1)} → ${k(1, x => typeof x === 'number' && x <= 1)}`, `${k(0, x => x === 'clean')} → ${k(1, x => x === 'clean')}`)); });

console.log(`\n## 6c. The pairing, on every pair: are the two runs' books the same up to the first frame the switch does something?\n`);
console.log(`Each row's stamped books (every drop, every squad call, the first 40 hearings, every noticing) are laid in time order. "The switch acts" = the earlier of A's first squad call and B's first row of its squads' log that is not a routine check (a glimpse not called, a fall heard, a man asked for, men walking, a body found). The books before that moment (less 0.15 s, the log's own rounding) should be the same in both.\n`);
head('map', 'arm', 'pairs', 'books the same up to the switch acting', 'of those: a routine check had been called by then', 'books differ earlier (seeds)');
each((map, arm, P) => { const book = (r: Run) => [...drops(r).map(d => [d.t, 'drop', d.who]), ...((r.m.calls ?? []) as any[]).map(c => [c.t, 'call', c.squad]), ...((r.m.hear ?? []) as any[]).map(h => [h.t, 'hear', `${h.who}:${h.kind}:${h.src}`]), ...((r.m.rousings ?? []) as any[]).map(x => [x.t, 'noticed', x.who])].sort((a: any, b: any) => a[0] - b[0] || String(a[1] + a[2]).localeCompare(String(b[1] + b[2])));
  const act = (a: Run, b: Run) => { const E = ((b.squads ?? []) as any[]).flatMap(q => q.events as any[]).filter(e => ['glimpse', 'asks', 'looks', 'found', 'no sign'].includes(e.what) || (e.what === 'check' && !e.why.includes('radio check'))).map(e => e.t); return Math.min(contactT(a) ?? Infinity, ...E, Math.min(a.t, b.t)); };
  let ok = 0, checked = 0; const bad: string[] = [];
  for (const [a, b] of P) { const T = act(a, b) - 0.15, A = book(a).filter((x: any) => x[0] < T), B = book(b).filter((x: any) => x[0] < T); const same = JSON.stringify(A) === JSON.stringify(B);
    const routineBefore = ((b.squads ?? []) as any[]).flatMap(q => q.events as any[]).some(e => e.what === 'check' && e.why.includes('radio check') && e.t < T);
    if (same) { ok++; if (routineBefore) checked++; } else { let i = 0; while (i < A.length && i < B.length && JSON.stringify(A[i]) === JSON.stringify(B[i])) i++; bad.push(`${a.seed} at ${(A[i] ?? B[i])?.[0]} s`); } }
  console.log(row(map, arm, P.length, `${ok} (${pct(ok, P.length)})`, checked, bad.length ? `${bad.length}: ${bad.slice(0, 8).join(', ')}` : '0')); });

console.log(`\n## 7. What the switch did ('${TB}': totals over the runs; and anything that reads as stuck)\n`);
head('map', 'arm', 'runs', 'runs where the drop knob did something a player could tell', 'runs where the eyes knob held a call', 'routine checks called', 'a fall heard', 'asked by name', 'men walked to a post', '…and found the body from it', 'a body seen by a mate (later than as he fell)', 'no sign', 'glimpses not called', 'walks with no logged end in 45 s, of walks judged (seeds)', 'a man never missed though his squad stood 60 s more (seeds)');
each((map, arm, P) => { const B = P.map(p => p[1]), A = B.map(activity), s = (k: keyof ReturnType<typeof activity>) => A.reduce((x, a) => x + a[k], 0);
  const stuck = B.filter((r, i) => A[i].stuck > 0).map(r => r.seed), never = B.filter(r => unlearned(r).length > 0).map(r => r.seed);
  J.cells[`${map}.${arm}`].stuck = stuck; J.cells[`${map}.${arm}`].never = never;
  console.log(row(map, arm, B.length, `${B.filter(actedDrop).length} (${pct(B.filter(actedDrop).length, B.length)})`, `${B.filter(actedEyes).length} (${pct(B.filter(actedEyes).length, B.length)})`, s('routine'), s('heard'), s('asks'), s('looks'), s('lookFound'), `${s('seenFound')} (${s('seenLate')})`, s('nosign'), s('glimpse'), `${s('stuck')} of ${s('judged')}${stuck.length ? ` (${stuck.slice(0, 8).join('/')})` : ''}`, `${never.length}${never.length ? ` (${never.slice(0, 8).join('/')})` : ''}`)); });

console.log(`\n## 7b. Three things a review of the switch named, counted in the '${TB}' rows\n`);
console.log(`A1 = men sent to look come back with "no sign" though the man lies dead where he dropped (the script never moves a body, so every "not where he stood" about a dead man is one). A2 = the man who asks by name after a fall was heard is not the man who heard it; and of those, the hearer was himself down by then. A3 = men sent to walk to a post after their squad had already been in contact, or after it had its word about the team (barricade / flank / help).\n`);
head('map', 'arm', 'runs', 'walks to a post', '"no sign" endings', 'A1: no sign with the body there (seeds)', 'asked by name after a fall heard', 'A2: asker is not the hearer', '…and the hearer was down by then (seeds)', 'A3: walks after a contact of that squad', 'A3: walks after its word, no contact before (seeds)');
each((map, arm, P) => { const c = { looks: 0, nosign: 0, a1: 0, asks: 0, a2: 0, a2dead: 0, a3c: 0, a3w: 0 }, s1: number[] = [], s2: number[] = [], s3: number[] = [];
  for (const [, r] of P) { const dead = new Map<string, number>(drops(r).map(d => [d.who, d.t] as [string, number]));
    for (const q of (r.squads ?? []) as any[]) { const E = q.events as any[], heard = new Map<string, string>();
      for (const e of E) { let m: RegExpMatchArray | null;
        if (e.what === 'no sign') { c.nosign++; m = e.why.match(/^(Tango \d+) is not where he stood/); if (m && dead.has(m[1])) { c.a1++; s1.push(r.seed); } }
        if (e.what === 'check' && (m = e.why.match(/^(Tango \d+) heard something where (Tango \d+) stands/))) heard.set(m[2], m[1]);
        if (e.what === 'asks' && (m = e.why.match(/^no answer from (Tango \d+): (Tango \d+) asks/)) && heard.has(m[1])) { c.asks++; const h = heard.get(m[1])!; if (h !== m[2]) { c.a2++; if (dead.has(h) && dead.get(h)! < e.t + 0.11) { c.a2dead++; s2.push(r.seed); } } }
        if (e.what === 'looks') { c.looks++; if (E.some(x => x.what === 'contact' && x.t < e.t)) c.a3c++; else if (E.some(x => ['barricade', 'flank', 'help'].includes(x.what) && x.t < e.t)) { c.a3w++; s3.push(r.seed); } } } } }
  const u = (x: number[]) => [...new Set(x)];
  console.log(row(map, arm, P.length, c.looks, c.nosign, `${c.a1}${s1.length ? ` (${u(s1).slice(0, 6).join('/')})` : ''}`, c.asks, c.a2, `${c.a2dead}${s2.length ? ` (${u(s2).slice(0, 6).join('/')})` : ''}`, c.a3c, `${c.a3w}${s3.length ? ` (${u(s3).slice(0, 6).join('/')})` : ''}`)); });

console.log(`\n## 8. Seeds to replay (B against A on the same seed)\n`);
head('map', 'arm', 'B much better (seed: A → B, men down before contact A → B, how B found the first drop)', 'B much worse');
each((map, arm, P) => { const sc = (p: [Run, Run]) => (RANK[cls2(p[1])] - RANK[cls2(p[0])]) * 10 + (downBeforeContact(p[1]) - downBeforeContact(p[0])) + (p[1].hostilesOf - p[1].hostiles - (p[0].hostilesOf - p[0].hostiles)) * 0.1;
  const show = (p: [Run, Run]) => `${p[0].seed}: ${cls2(p[0])} → ${cls2(p[1])}, ${downBeforeContact(p[0])} → ${downBeforeContact(p[1])}, ${found(p[1])}`;
  const S = [...P].sort((x, y) => sc(y) - sc(x)), best = S.filter(p => sc(p) > 0).slice(0, EX), worst = S.reverse().filter(p => sc(p) < 0).slice(0, EX);
  console.log(row(map, arm, best.map(show).join(' · ') || '—', worst.map(show).join(' · ') || '—')); });
if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify(J, null, 1));
