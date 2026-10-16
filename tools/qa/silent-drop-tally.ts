// What a defender dropped in silence costs today, counted over a pair-sneak pool (tools/qa/pair-sneak.ts --out <dir>): which way each squad's net first went to
// 'contact' (its own men's eyes, their ears, or only a man dropping with a mate at home), what the mates of a man dropped unnoticed could have known at that
// moment, what follows the call and when, how the runs end by the first call's cause, and the same seeds solo against pair with a bootstrap interval.
//   bun run tools/qa/silent-drop-tally.ts <dir> [--arms solo,pair] [--examples 4] [--boot 4000] [--json out.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2); const dir = resolve(argv[0] ?? 'pair-sneak-runs'); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const EX = Number(flag('--examples') ?? 4), BOOT = Number(flag('--boot') ?? 4000), wantArms = (flag('--arms') ?? 'solo,pair').split(',').filter(Boolean), JSON_OUT = flag('--json');
type Run = any;
const runs = new Map<string, Map<string, Map<number, Run>>>();   // scn → arm → seed → run
for (const f of readdirSync(dir)) { const m = f.match(/^(.+)\.(solo|pair|pairloud|pairhold|pairlate)\.jsonl$/); if (!m || !wantArms.includes(m[2])) continue;
  for (const l of readFileSync(resolve(dir, f), 'utf8').split('\n')) { if (!l.trim()) continue; let r: Run; try { r = JSON.parse(l); } catch { continue; }
    if (!runs.has(m[1])) runs.set(m[1], new Map()); const A = runs.get(m[1])!; if (!A.has(m[2])) A.set(m[2], new Map()); A.get(m[2])!.set(r.seed, r); } }
const ORDER = ['block-squads', 'warehouse-four', 'compound-four', 'barracks-four'];
const scns = [...runs.keys()].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
const pct = (n: number, d: number) => d ? `${Math.round(100 * n / d)}%` : '—';
const nd = (n: number, d: number) => `${n} (${pct(n, d)})`;
const med = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : NaN; };
const q = (xs: number[], p: number) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] : NaN; };
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—';
const row = (...c: (string | number)[]) => `| ${c.join(' | ')} |`;
const head = (...c: string[]) => { console.log(row(...c)); console.log(row(...c.map(() => '---'))); };
const ok = (r: Run) => r.cls !== 'error';
const CLS = ['ghost', 'turned', 'looked', 'spotted', 'loud', 'dead', 'stalled'];
const out: any = { dir, levels: {} };

// ---- one run, read
/** the squad net's first call, and what it was made on */
function firstCall(r: Run) { const C = (r.m.calls ?? []).filter((c: any) => c.called); return C[0] ?? null; }
/** the drop a call was made on, with what the mates of that man had at that moment */
function dropOf(r: Run, c: any) { return c?.drop ? (r.m.dropLog ?? []).find((d: any) => d.who === c.drop.who) ?? null : null; }
/** could a mate have known? a living squad mate FACING the man with a line as he dropped (inside his view cone, within 16 m) and the man lit enough to be
 *  seen there by the game's own body rule (the place's own light on him at visibility 0.22 or more, nothing carried counted, or a mate within 2 m) · facing him with a line but he stood in the dark · a line but nobody facing ·
 *  no line, but a mate was roused already (had heard or seen something) · nothing at all */
type Knew = 'seen' | 'dark' | 'line' | 'roused' | 'nothing';
const KNEW: Knew[] = ['nothing', 'roused', 'line', 'dark', 'seen'];
const KNEW_WORDS: Record<Knew, string> = { nothing: 'no mate had a line to him or had noticed anything', roused: 'no line, but a mate was already roused', line: 'a mate had a line, none was facing him', dark: 'a mate was facing him with a line, he was in the dark', seen: 'a mate was facing him with a line, he was lit' };
function matesKnew(d: any): Knew { const M = d?.mates ?? [];
  if (M.some((x: any) => (x.cone === undefined || d.lit === undefined) && x.los)) return 'line';   // (a row from before the tool recorded facing: counted as a line only — re-run it)
  if (M.some((x: any) => x.cone && ((d.lit ?? 0) >= 0.22 || x.d < 2))) return 'seen'; if (M.some((x: any) => x.cone)) return 'dark'; if (M.some((x: any) => x.los)) return 'line';
  return M.some((x: any) => x.aw >= 0.45 || x.state === 'alert' || x.state === 'search' || x.state === 'suspicious') ? 'roused' : 'nothing'; }
/** the bucket a run's first squad call falls in */
function firstBucket(r: Run): string { const c = firstCall(r); if (!c) return 'no squad ever called contact';
  if (c.cause === 'drop') return !c.drop.unnoticed ? 'a man dropping who had noticed the team' : `a man dropping unnoticed · ${KNEW_WORDS[matesKnew(dropOf(r, c))]}`;
  if (c.cause === 'eyes') return c.rousedBefore === 0 ? 'eyes · a glimpse, before any defender had noticed' : 'eyes · after a defender had noticed';
  if (c.cause === 'ears') return 'ears · a loud thing in its rooms';
  return 'other'; }
const BUCKETS = [...KNEW.map(k => `a man dropping unnoticed · ${KNEW_WORDS[k]}`), 'a man dropping who had noticed the team', 'eyes · a glimpse, before any defender had noticed', 'eyes · after a defender had noticed', 'ears · a loud thing in its rooms', 'other', 'no squad ever called contact'];
const isDropFirst = (r: Run) => firstCall(r)?.cause === 'drop';
const isSilentDropFirst = (r: Run) => { const c = firstCall(r); return c?.cause === 'drop' && c.drop.unnoticed; };
/** squad events of a run, flat */
const events = (r: Run) => (r.squads ?? []).flatMap((s: any) => (s.events ?? []).map((e: any) => ({ ...e, squad: s.name })));

// ---- bootstrap over seeds, paired
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function boot(d: number[], seed = 1): [number, number, number] { const n = d.length; if (!n) return [NaN, NaN, NaN]; const R = rng(seed), m = d.reduce((a, b) => a + b, 0) / n, xs: number[] = [];
  for (let i = 0; i < BOOT; i++) { let s = 0; for (let j = 0; j < n; j++) s += d[Math.floor(R() * n)]; xs.push(s / n); } xs.sort((a, b) => a - b); return [m, xs[Math.floor(0.025 * BOOT)], xs[Math.floor(0.975 * BOOT)]]; }
const pp = (x: number) => Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}` : '—';
const ci = (b: [number, number, number]) => `${pp(b[0])} pts (95 % ${pp(b[1])} to ${pp(b[2])})`;
function share(R: Run[], f: (r: Run) => boolean, seed = 7): string { const d = R.map(r => f(r) ? 1 : 0), b = boot(d, seed); return `${(d as number[]).reduce((a, c) => a + c, 0)} of ${R.length} = ${(100 * b[0]).toFixed(0)}% (95 % ${(100 * b[1]).toFixed(0)}–${(100 * b[2]).toFixed(0)})`; }

console.log(`# silent-drop tally · ${dir}\n`);

console.log('## 1 · How the runs end\n');
head('map', 'arm', 'runs', ...CLS, 'Sam down', 'every defender down', 'median s to Sam down', 'defenders left, median');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(ok), n = R.length, c = (k: string) => R.filter(r => r.cls === k).length;
  console.log(row(scn, arm, n, ...CLS.map(k => nd(c(k), n)), share(R, r => r.samDown), nd(R.filter(r => r.finished).length, n), f1(med(R.filter(r => r.samDown).map(r => r.m.samDownAt ?? r.t))), `${f1(med(R.map(r => r.hostiles)))} of ${R[0]?.hostilesOf}`));
  (out.levels[scn] ??= {})[arm] = { n, cls: Object.fromEntries(CLS.map(k => [k, c(k)])), samDown: R.filter(r => r.samDown).length, finished: R.filter(r => r.finished).length }; }
const errs = scns.flatMap(scn => [...runs.get(scn)!].flatMap(([arm, S]) => [...S.values()].filter(r => !ok(r)).map(r => `${scn}:${r.seed} ${arm}`)));
if (errs.length) console.log(`\nerrors (${errs.length}, left out of every table): ${errs.slice(0, 12).join(', ')}`);

console.log('\n## 2 · What the squad net\'s FIRST contact call of a run was made on\n');
console.log('The first time any squad goes to contact. "noticed" = a defender at awareness 0.5 or more, or alert / searching. A line = an unblocked sight line from a living squad mate to the man as he dropped.\n');
for (const arm of wantArms) { console.log(`### ${arm}\n`); head('first call made on', ...scns, 'all', 'seeds that show it');
  const per = new Map<string, Map<string, number[]>>(); let N = 0; const tot = new Map<string, number>();
  for (const scn of scns) { const S = runs.get(scn)!.get(arm); if (!S) continue; tot.set(scn, 0); for (const r of S.values()) { if (!ok(r)) continue; N++; tot.set(scn, tot.get(scn)! + 1); const b = firstBucket(r); if (!per.has(b)) per.set(b, new Map()); const P = per.get(b)!; if (!P.has(scn)) P.set(scn, []); P.get(scn)!.push(r.seed); } }
  for (const b of BUCKETS) { const P = per.get(b); if (!P) continue; const all = [...P.values()].reduce((a, s) => a + s.length, 0);
    console.log(row(b, ...scns.map(s => nd(P.get(s)?.length ?? 0, tot.get(s) ?? 0)), nd(all, N), scns.filter(s => P.has(s)).map(s => `${s}:${P.get(s)!.sort((x, y) => x - y).slice(0, EX).join('/')}`).join(' · ')));
    for (const s of scns) ((out.levels[s] ??= {})[arm] ??= {}).first = { ...(out.levels[s][arm].first ?? {}), [b]: P.get(s)?.length ?? 0 }; }
  console.log(row('**any man dropping**', ...scns.map(s => { const R = [...(runs.get(s)!.get(arm)?.values() ?? [])].filter(ok); return share(R, isDropFirst); }), '', ''));
  console.log(row('**a man dropping unnoticed**', ...scns.map(s => { const R = [...(runs.get(s)!.get(arm)?.values() ?? [])].filter(ok); return share(R, isSilentDropFirst); }), '', ''));
  console.log(''); }

console.log('## 3 · How runs end, by what the first call was made on\n');
head('map', 'arm', 'first call', 'runs', 'Sam down', 'ghost', 'spotted', 'loud', 'median s call → first man sent (reinforce)', 'median s call → another squad\'s word', 'median s call → first gunshot of theirs', 'median s call → Sam down');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(ok);
  for (const [name, f] of [['a man dropping unnoticed', isSilentDropFirst], ['a man dropping who had noticed', (r: Run) => isDropFirst(r) && !isSilentDropFirst(r)], ['eyes', (r: Run) => firstCall(r)?.cause === 'eyes'], ['ears', (r: Run) => firstCall(r)?.cause === 'ears'], ['none', (r: Run) => !firstCall(r)]] as [string, (r: Run) => boolean][]) { const G = R.filter(f); if (!G.length) continue;
    const dt = (g: (r: Run, c: any) => number | null | undefined) => f1(med(G.map(r => { const c = firstCall(r); if (!c) return NaN; const x = g(r, c); return x === null || x === undefined ? NaN : x - c.t; }).filter(x => x >= -0.11)));
    console.log(row(scn, arm, name, G.length, nd(G.filter(r => r.samDown).length, G.length), ...['ghost', 'spotted', 'loud'].map(k => G.filter(r => r.cls === k).length),
      dt((r, c) => events(r).find((e: any) => e.squad === c.squad && e.what === 'reinforce' && e.t >= c.t - 0.11)?.t), dt((r, c) => events(r).find((e: any) => e.squad !== c.squad && ['barricade', 'flank', 'help', 'ready', 'stand to', 'contact'].includes(e.what) && e.t >= c.t - 0.11)?.t),
      dt((r, c) => (r.m.firstLoud && r.m.firstLoud.src === 'theirs' ? r.m.firstLoud.t : null)), dt(r => r.m.samDownAt))); } }

console.log('\n## 4 · Every defender dropped by the team before anything loud, and what his squad did that frame\n');
console.log('One row per map and arm; a "silent drop" = the man had not noticed the team (awareness under 0.5, not alert / searching) and nothing loud had happened in the run yet.\n');
head('map', 'arm', 'silent drops', 'his squad already in contact', 'squad calls contact that frame · on the drop', '… on eyes that same frame', 'no call · no mate of his at home', 'no call · he was away from home', 'no call · other', ...KNEW.map(k => `of the drop calls: ${KNEW_WORDS[k]}`), 'rows from before the tool recorded facing and light');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; let n = 0, already = 0, onDrop = 0, onEyes = 0, noMate = 0, away = 0, other = 0, old = 0; const kn: Record<string, number> = { nothing: 0, roused: 0, line: 0, dark: 0, seen: 0 };
  for (const r of S.values()) { if (!ok(r)) continue; for (const d of r.m.dropLog ?? []) { if (!d.unnoticed || d.firstLoud || d.by === 'theirs') continue; n++;
    const c = (r.m.calls ?? []).find((c: any) => c.called && c.squad === d.squad && Math.abs(c.t - d.t) < 0.11);
    if (c && c.was !== 'contact') { if (c.cause === 'drop') { onDrop++; kn[matesKnew(d)]++; if (d.lit === undefined) old++; } else onEyes++; }
    else if (d.state === 'contact') already++; else if (!d.home) away++; else if (!d.mateHome) noMate++; else other++; } }
  console.log(row(scn, arm, n, nd(already, n), nd(onDrop, n), nd(onEyes, n), nd(noMate, n), nd(away, n), nd(other, n), ...KNEW.map(k => nd(kn[k], onDrop)), old));
  ((out.levels[scn] ??= {})[arm] ??= {}).silentDrops = { n, already, onDrop, onEyes, noMate, away, other, knew: kn }; }

console.log('\n## 4b · What reached a squad mate anyway, by the game\'s own senses, when a man dropped unnoticed and his squad called contact on it\n');
console.log('Read off the run\'s hearing log (the first 40 hearings of a run are kept) and the drop\'s row. "Heard" = a living squad mate\'s ears booked Sam\'s or the partner\'s suppressed shot, or the body and weapon falling, from the frame of the drop to 1.5 s after. "Eyes" = a mate had the man in his eye\'s cone with a line as he dropped, and the man stood lit (0.22 or more) or within 2 m.\n');
head('map', 'arm', 'drop calls on an unnoticed man', 'a mate had eyes on him, lit', 'a mate heard the shot', 'a mate heard the fall', 'heard either', 'eyes or ears', 'nothing reached any mate', 'median s drop → first hearing', 'hearing mates left suspicious or more', 'hearing mates still on patrol');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; let n = 0, eyes = 0, shot = 0, fall = 0, either = 0, any = 0, none = 0, susp = 0, calm = 0; const lag: number[] = [];
  for (const r of S.values()) { if (!ok(r)) continue; for (const d of r.m.dropLog ?? []) { if (!d.unnoticed || d.firstLoud || d.by === 'theirs') continue;
    const c = (r.m.calls ?? []).find((c: any) => c.called && c.squad === d.squad && Math.abs(c.t - d.t) < 0.11); if (!c || c.was === 'contact' || c.cause !== 'drop') continue; n++;
    const mates = new Set((d.mates ?? []).map((x: any) => x.who)), H = (r.m.hear ?? []).filter((h: any) => mates.has(h.who) && h.t >= d.t - 0.06 && h.t <= d.t + 1.5);
    const hs = H.some((h: any) => h.kind === 'shot' && (h.src === 'sam' || h.src === 'mate')), hf = H.some((h: any) => h.kind === 'prop' && h.src === 'drop'), e = matesKnew(d) === 'seen';
    if (e) eyes++; if (hs) shot++; if (hf) fall++; if (hs || hf) { either++; lag.push(Math.max(0, Math.min(...H.filter((h: any) => h.kind === 'shot' || h.kind === 'prop').map((h: any) => h.t)) - d.t));
      const by = new Map<string, any>(); for (const h of H) if (h.kind === 'shot' || h.kind === 'prop') by.set(h.who, h); for (const h of by.values()) if (h.state === 'patrol') calm++; else susp++; }
    if (e || hs || hf) any++; else none++; } }
  console.log(row(scn, arm, n, nd(eyes, n), nd(shot, n), nd(fall, n), nd(either, n), nd(any, n), nd(none, n), f1(med(lag)), susp, calm));
  ((out.levels[scn] ??= {})[arm] ??= {}).reached = { n, eyes, shot, fall, either, any, none }; }

console.log('\n## 5 · Every contact call of every squad, by what it was made on (whole runs)\n');
head('map', 'arm', 'calls', 'eyes', 'ears', 'a man dropping', 'other', 'runs with a call on a man dropping unnoticed', 'runs where a call on eyes came before any defender had noticed');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(ok); const C = R.flatMap(r => (r.m.calls ?? []).filter((c: any) => c.called && c.was !== 'contact')); const k = (x: string) => C.filter((c: any) => c.cause === x).length;
  console.log(row(scn, arm, C.length, nd(k('eyes'), C.length), nd(k('ears'), C.length), nd(k('drop'), C.length), nd(k('other'), C.length), share(R, r => (r.m.calls ?? []).some((c: any) => c.called && c.was !== 'contact' && c.cause === 'drop' && c.drop.unnoticed)), share(R, r => (r.m.calls ?? []).some((c: any) => c.called && c.cause === 'eyes' && c.rousedBefore === 0)))); }

console.log('\n## 6 · The same seeds, solo against pair\n');
head('map', 'seeds', 'Sam down solo', 'Sam down pair', 'pair − solo, Sam down', 'ghost solo → pair', 'pair − solo, ghost', 'first call on a man dropping unnoticed, solo → pair', 'pair − solo');
for (const scn of scns) { const A = runs.get(scn)!.get('solo'), B = runs.get(scn)!.get('pair'); if (!A || !B) continue; const P: [Run, Run][] = []; for (const [seed, a] of A) { const b = B.get(seed); if (b && ok(a) && ok(b)) P.push([a, b]); }
  const d = (f: (r: Run) => boolean) => P.map(([a, b]) => (f(b) ? 1 : 0) - (f(a) ? 1 : 0)), c = (f: (r: Run) => boolean, i: 0 | 1) => P.filter(p => f(p[i])).length;
  const dead = (r: Run) => r.samDown, ghost = (r: Run) => r.cls === 'ghost';
  console.log(row(scn, P.length, nd(c(dead, 0), P.length), nd(c(dead, 1), P.length), ci(boot(d(dead), 11)), `${c(ghost, 0)} → ${c(ghost, 1)}`, ci(boot(d(ghost), 12)), `${c(isSilentDropFirst, 0)} → ${c(isSilentDropFirst, 1)}`, ci(boot(d(isSilentDropFirst), 13))));
  (out.levels[scn] ??= {}).paired = { n: P.length, deadSolo: c(dead, 0), deadPair: c(dead, 1), dDead: boot(d(dead), 11), ghostSolo: c(ghost, 0), ghostPair: c(ghost, 1), dGhost: boot(d(ghost), 12) }; }

console.log('\n## 7 · Seconds from the start to the first of each thing (medians, 10th–90th)\n');
head('map', 'arm', 'first defender dropped', 'first squad call', 'first defender to notice anything', 'first gunshot of theirs', 'Sam down');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(ok); const sp = (xs: number[]) => `${f1(med(xs))} (${f1(q(xs, 0.1))}–${f1(q(xs, 0.9))}, n ${xs.filter(Number.isFinite).length})`;
  console.log(row(scn, arm, sp(R.map(r => r.m.dropLog?.[0]?.t ?? NaN)), sp(R.map(r => firstCall(r)?.t ?? NaN)), sp(R.map(r => r.m.firstRoused?.t ?? NaN)), sp(R.map(r => r.m.firstLoud?.src === 'theirs' ? r.m.firstLoud.t : NaN)), sp(R.map(r => r.samDown ? r.m.samDownAt ?? r.t : NaN)))); }

console.log('\n## 8 · After a first call made on a man dropping unnoticed: what the rest of the floor did, with nothing seen or heard\n');
console.log('"Roused by the net alone" = a defender who went to awareness 0.5 or more (in practice straight to alert at 0.92) with nothing of the team in his eyes and nothing heard in the last second: his squad sent him, or his squad\'s word planted him on a door. The run log keeps the first 14 rousings of a run.\n');
head('map', 'arm', 'runs', 'defenders roused by the net alone, median (10th–90th)', 'of the first 14 rousings: by the net alone', 'other squads\' first word: barricade', 'flank', 'help', 'none before the run ended', 'the place\'s light on the dropped man (visibility 0–1), median', 'nearest living squad mate, median m');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const G = [...S.values()].filter(ok).filter(isSilentDropFirst); if (!G.length) continue;
  const net = (x: any) => /reinforce|plants|dig-in|hears of|stays|rall/.test(x.note ?? '') && (x.sawAgo === null || x.sawAgo === undefined || x.sawAgo > 1) && (x.ha === null || x.ha === undefined || x.ha > 1);
  const per = G.map(r => (r.m.rousings as any[]).filter(net).length), all = G.reduce((a, r) => a + (r.m.rousings as any[]).length, 0), byNet = per.reduce((a, b) => a + b, 0);
  const words: Record<string, number> = { barricade: 0, flank: 0, help: 0, none: 0 }; let sq = 0;
  for (const r of G) { const c = firstCall(r); for (const s of r.squads ?? []) { if (s.name === c.squad) continue; sq++; const e = (s.events ?? []).find((e: any) => ['barricade', 'flank', 'help'].includes(e.what) && e.t >= c.t - 0.11); words[e ? e.what : 'none']++; } }
  const D = G.map(r => dropOf(r, firstCall(r)));
  console.log(row(scn, arm, G.length, `${f1(med(per))} (${f1(q(per, 0.1))}–${f1(q(per, 0.9))})`, nd(byNet, all), nd(words.barricade, sq), nd(words.flank, sq), nd(words.help, sq), nd(words.none, sq), f1(med(D.map(d => d?.lit ?? NaN)).toString() === 'NaN' ? NaN : med(D.map(d => d?.lit ?? NaN))), f1(med(D.map(d => Math.min(...(d?.mates ?? []).map((x: any) => x.d), Infinity)).filter(Number.isFinite)))));
}

console.log('\n## 9 · This tally\'s "first call" beside pair-sneak-tally\'s "first thing that goes wrong"\n');
console.log('Rows: pair-sneak-tally.ts\'s cause of the first compromise (the first defender to NOTICE, awareness 0.5 or more, or the first loud thing). Columns: what the squad net\'s first contact call was made on. A squad can call before any defender has noticed: a call on a glimpse comes with the caller still at awareness near 0, and the same man usually notices a moment later, which the other tally books as "Sam seen".\n');
const COARSE = ['a man dropping unnoticed', 'a man dropping who had noticed', 'eyes · a glimpse, nobody had noticed', 'eyes · after a defender had noticed', 'ears', 'other', 'no call'];
const coarse = (r: Run) => { const c = firstCall(r); return !c ? COARSE[6] : c.cause === 'drop' ? (c.drop?.unnoticed ? COARSE[0] : COARSE[1]) : c.cause === 'eyes' ? (c.rousedBefore === 0 ? COARSE[2] : COARSE[3]) : c.cause === 'ears' ? COARSE[4] : COARSE[5]; };
/** pair-sneak-tally.ts's own rule, word for word, folded to five rows */
const wrong = (r: Run) => { const F = r.m.first; if (!F) return 'nothing went wrong'; if (F.how === 'loud') return 'something loud first';
  const note = (F.notes ?? []).join(' | '), seen = F.sawAgo !== null && F.sawAgo !== undefined && F.sawAgo < 0.6, heard = F.heard && F.heard.ago < 0.6;
  if (seen) return F.foe === 'mate' ? 'the partner seen' : 'Sam seen'; if (heard) return `${F.heard.src === 'mate' ? 'the partner' : F.heard.src === 'sam' ? 'Sam' : 'something else'} heard`;
  return /\[squads\]|reinforce|dig-in|plants|rall/.test(note) ? 'their own word (no defender saw or heard it)' : 'unclear'; };
for (const arm of wantArms) { console.log(`### ${arm}\n`); head('first thing that goes wrong', ...COARSE, 'runs');
  const R = scns.flatMap(scn => [...(runs.get(scn)!.get(arm)?.values() ?? [])].filter(ok)), W = [...new Set(R.map(wrong))].sort((a, b) => R.filter(r => wrong(r) === b).length - R.filter(r => wrong(r) === a).length);
  for (const w of W) { const G = R.filter(r => wrong(r) === w); console.log(row(w, ...COARSE.map(k => G.filter(r => coarse(r) === k).length), G.length)); }
  console.log(row('**all**', ...COARSE.map(k => R.filter(r => coarse(r) === k).length), R.length)); console.log(''); }
head('map', 'arm', 'runs whose first call was on a glimpse', 'the first defender to notice came after the call', 'seconds from that call to the first notice, median (10th–90th)', 'of those: the first notice was "Sam seen"', '… "their own word"');
for (const scn of scns) for (const arm of wantArms) { const S = runs.get(scn)!.get(arm); if (!S) continue; const G = [...S.values()].filter(ok).filter(r => coarse(r) === COARSE[2]); if (!G.length) continue;
  const gap = G.map(r => r.m.firstRoused ? r.m.firstRoused.t - firstCall(r).t : NaN), after = gap.filter(x => x >= 0);
  console.log(row(scn, arm, G.length, nd(after.length, G.length), `${f1(med(after))} (${f1(q(after, 0.1))}–${f1(q(after, 0.9))})`, nd(G.filter(r => wrong(r) === 'Sam seen').length, G.length), nd(G.filter(r => wrong(r).startsWith('their own word')).length, G.length))); }

if (JSON_OUT) writeFileSync(resolve(JSON_OUT), JSON.stringify(out, null, 1));
