// The tables of a pair-sneak pool (tools/qa/pair-sneak.ts --out <dir>): how the runs end per level and arm, the same seeds paired solo against pair, what
// the FIRST compromise of each run was and whose doing, what the partner was doing while nothing had gone wrong, and a seed that shows each thing.
//   bun run tools/qa/pair-sneak-tally.ts <dir> [--arms solo,pair] [--examples 3] [--tag X] [--vs TAG]
// ARMS AND TAGS: a file is <scn>.<arm>[.<tag>].jsonl. With no --tag EVERY (arm, tag) in the folder is a column of its own, named `arm` or `arm·tag` (the on and
// the off run of one arm side by side); `--tag X` reads that tag alone (`--tag -`: the untagged files alone), as does --vs (which compares the untagged set against
// one tag, seed for seed). Each row's `sw` (the game's switches the run was played under: pair-sneak.ts) is printed beside its arm.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2); const dir = resolve(argv[0] ?? 'pair-sneak-runs'); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const EX = Number(flag('--examples') ?? 3), wantArms = (flag('--arms') ?? '').split(',').filter(Boolean), TAG0 = flag('--tag'), TAG = TAG0 === '-' ? '' : TAG0 ?? '', ALLTAGS = TAG0 === undefined && !flag('--vs');
const ARMS = 'solo|pair|pairloud|pairhold|pairquiet|pairmark', SEP = '·', baseOf = (k: string) => k.split(SEP)[0], tagOf = (k: string) => k.split(SEP)[1] ?? '';
type Run = any;
const runs = new Map<string, Map<string, Map<number, Run>>>();   // scn → arm → seed → run
for (const f of readdirSync(dir)) { const m = f.match(new RegExp(`^(.+?)\\.(${ARMS})(?:\\.(.+))?\\.jsonl$`)); if (!m || (!ALLTAGS && (m[3] ?? '') !== TAG)) continue; if (wantArms.length && !wantArms.includes(m[2])) continue; if (ALLTAGS && m[3]) m[2] = m[2] + SEP + m[3];
  for (const l of readFileSync(resolve(dir, f), 'utf8').split('\n')) { if (!l.trim()) continue; let r: Run; try { r = JSON.parse(l); } catch { continue; }
    if (!runs.has(m[1])) runs.set(m[1], new Map()); const A = runs.get(m[1])!; if (!A.has(m[2])) A.set(m[2], new Map()); A.get(m[2])!.set(r.seed, r); } }
const ORDER = ['night-breach', 'room-clear-pair', 'room-clear-four', 'hostage-rescue', 'records-pair', 'rescue-registry', 'depot-four', 'block-four', 'block-squads', 'warehouse-four', 'compound-four', 'barracks-four'];
const scns = [...runs.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const ARM_ORDER = ARMS.split('|'), armCmp = (a: string, b: string) => ARM_ORDER.indexOf(baseOf(a)) - ARM_ORDER.indexOf(baseOf(b)) || tagOf(a).localeCompare(tagOf(b)), armsOf = (scn: string) => [...runs.get(scn)!].sort((a, b) => armCmp(a[0], b[0]));
/** every arm key in the folder, in order · those with a partner */
const KEYS = [...new Set(scns.flatMap(s => [...runs.get(s)!.keys()]))].sort(armCmp), PAIRKEYS = KEYS.filter(k => baseOf(k) !== 'solo');
/** the solo runs a pair arm is read against: the same tag's where the folder has them, else the untagged */
const soloOf = (k: string) => { const t = tagOf(k), s1 = t ? 'solo' + SEP + t : 'solo'; return KEYS.includes(s1) ? s1 : 'solo'; };
const VS = flag('--vs'); const other = new Map<string, Map<string, Map<number, Run>>>();   // --vs TAG: the same pool run another way (a tagged set), compared seed for seed
if (VS) for (const f of readdirSync(dir)) { const m = f.match(new RegExp(`^(.+?)\\.(${ARMS})\\.(.+)\\.jsonl$`)); if (!m || m[3] !== VS) continue;
  for (const l of readFileSync(resolve(dir, f), 'utf8').split('\n')) { if (!l.trim()) continue; let r: Run; try { r = JSON.parse(l); } catch { continue; }
    if (!other.has(m[1])) other.set(m[1], new Map()); const A = other.get(m[1])!; if (!A.has(m[2])) A.set(m[2], new Map()); A.get(m[2])!.set(r.seed, r); } }
/** the worst any defender's awareness got in a run: under 0.5 nobody noticed; 0.5 to 0.75 somebody went to look; over that somebody was on alert */
let rs = 0x2545f491; const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
/** a paired bootstrap interval (95 %) for the mean of per-seed differences */
const boot = (d: number[]) => { if (d.length < 8) return '—'; const B: number[] = []; for (let b = 0; b < 2000; b++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[(rnd() * d.length) | 0]; B.push(t / d.length); } B.sort((x, y) => x - y); return `${Math.round(100 * B[50])} to ${Math.round(100 * B[1949])}`; };
const CLS = ['ghost', 'turned', 'looked', 'spotted', 'loud', 'dead', 'stalled', 'error'];
const CLS_HEAD: Record<string, string> = { ghost: 'ghost (no defender left his calm)', turned: 'a man turned to a noise (suspicious, under 0.5)', looked: 'a man noticed (0.5 or over)', spotted: 'spotted (a man on alert or searching)', loud: 'loud', dead: 'dead (Sam down)', stalled: 'stalled' };
/** How a run ended, read off what was recorded, worst first: dead = Sam down · loud = anything loud (an unsuppressed round, a bang, a boot) · spotted = some
 *  defender went on alert or to search, or his awareness passed 0.75 · looked = some defender NOTICED (awareness 0.5 or over: silent.ts's own bar, where the
 *  partner's held fire is let go) · turned = some defender went suspicious under that bar (he turned to a noise: a suppressed round heard leaves a man a hair
 *  under 0.5, a dropped man's weapon on the floor at 0.45) · ghost = none of that with every defender down · stalled = none of that, not finished.
 *  Rows from before the runner booked states (no m.hot) are read off what they have: the awareness for 'spotted', a 'suspicious' in the hearing log for 'turned'. */
const worst0 = (r: Run) => Math.max(0, ...Object.values(r.m?.aw ?? {}) as number[]);
const hot0 = (r: Run) => !!r.m?.hot && r.m.hot.alert + r.m.hot.search > 0;   // (a defender's STATE went to alert or search, whatever his awareness read; rows from before the runner booked states have only the awareness)
const turned0 = (r: Run) => r.m?.hot ? r.m.hot.suspicious > 0 : (r.m?.hear ?? []).some((h: any) => h.state === 'suspicious') || worst0(r) >= 0.3;
const cls2 = (r: Run): string => r.cls === 'error' ? 'error' : r.samDown ? 'dead' : r.m.firstLoud ? 'loud' : hot0(r) || worst0(r) > 0.75 ? 'spotted' : r.m.rousedN > 0 ? 'looked' : turned0(r) ? 'turned' : r.finished ? 'ghost' : 'stalled';
const pct = (n: number, d: number) => d ? `${Math.round(100 * n / d)}%` : '—';
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—', f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
const row = (...c: (string | number)[]) => `| ${c.join(' | ')} |`;

/** what the first compromise of a run was, and whose doing */
function cause(r: Run): string {
  const F = r.m.first; if (!F) return 'none';
  if (F.how === 'loud') return `loud: ${F.src} ${F.kind}`;
  // seen: a sighting that moved his awareness inside the last 0.6 s (the runner's sawAgo: any sighting, however dim); heard: a noise booked in the last 0.6 s;
  // lately: one in the last 4 s — a noise that left him half up (a suppressed round heard leaves a man a hair under the bar) before a sighting tipped him over
  const note = (F.notes ?? []).join(' | '), seen = F.sawAgo !== null && F.sawAgo !== undefined && F.sawAgo < 0.6, heard = F.heard && F.heard.ago < 0.6, lately = F.heard && F.heard.ago < 4;
  const whose = (s: string) => s === 'drop' ? "a dropped man's weapon:" : s === 'mate' ? "the partner's" : s === 'sam' ? "Sam's" : s === 'theirs' ? 'their own' : s === 'world' ? "the world's" : s;
  if (seen && (F.foe === 'mate' || F.foe === 'sam')) return `${F.foe === 'mate' ? 'partner' : 'Sam'} seen${lately ? ` (${whose(F.heard.src)} noise had him half up)` : ''}`;
  if (heard) return `${whose(F.heard.src)} ${F.heard.kind} heard`;
  if (/\[squads\]|reinforce|dig-in|plants|rall/.test(note)) return 'their own word (no defender saw or heard it)';
  return 'unclear';
}
/** one run's partner part in going wrong, anywhere in the run (not only first) */
function partnerPart(r: Run) { const R = r.m.rousings as any[], m = r.m;
  const eyesOn = (x: any) => x.foe === 'mate' && x.sawAgo !== null && x.sawAgo < 0.6, F = m.mateFirstShot;
  return { seen: R.some(eyesOn), seenFirst: cause(r).startsWith('partner seen'), glimpsed: (m.glMate ?? m.sawMate ?? 0) > 0, heard: R.some(x => x.hs === 'mate' && x.ha !== null && x.ha < 0.6), heardAny: m.heardBy ? Object.keys(m.heardBy).some(k => k.startsWith('mate:')) : (m.hear as any[]).some(h => h.src === 'mate'),
    lit: (m.pre?.mateLit ?? 0) > 0 || !!m.firstRoused?.mate?.lit, door: R.some(x => eyesOn(x) && x.mdoor), firesFirst: m.firstLoud?.src === 'mate', fired: m.mateShots > 0, firedAtCalm: !!F && (F.tgtRoused !== undefined && F.tgtRoused !== null ? !F.tgtRoused : !!F.tgtState && !['alert', 'search', 'dead'].includes(F.tgtState) && (F.tgtAw ?? 1) < 0.5),
    behind: m.first?.mate?.dSam > 8 || (m.pre?.far9 ?? 0) > 0.25, down: r.mateUp === false, blocks: m.blocks > 0, masked: m.shotsMasked > 0 }; }

console.log(`# pair-sneak tally · ${dir}${TAG ? ' · tag ' + TAG : ''}\n`);
console.log('## How the runs end\n'); console.log(row('level', 'arm', 'n', ...CLS.slice(0, 7).map(k => CLS_HEAD[k]), 'every defender down', 'Sam down', 'partner down', 'mean s (finished)')); console.log(row(...Array(14).fill('---')));
for (const scn of scns) for (const [arm, S] of armsOf(scn)) { const R = [...S.values()], n = R.length, c = (k: string) => R.filter(r => cls2(r) === k).length;
  console.log(row(scn, arm, n, ...CLS.slice(0, 7).map(k => `${c(k)} (${pct(c(k), n)})`), pct(R.filter(r => r.finished).length, n), pct(R.filter(r => r.samDown).length, n), baseOf(arm) === 'solo' ? '—' : pct(R.filter(r => r.mateUp === false).length, n), f1(mean(R.filter(r => r.finished).map(r => r.t))))); }
const errs = scns.flatMap(scn => [...runs.get(scn)!].flatMap(([arm, S]) => [...S.values()].filter(r => r.cls === 'error').map(r => `${scn}:${r.seed} ${arm} — ${String(r.why).split('\n')[0]}`)));
if (errs.length) console.log(`\nerrors (${errs.length}): ${errs.slice(0, 8).join(' ; ')}`);

const RANK: Record<string, number> = { ghost: 6, turned: 5, looked: 4, stalled: 3.5, spotted: 3, loud: 2, dead: 1, error: 0 };
for (const other of PAIRKEYS) { const SOLO = soloOf(other); if (!scns.some(s => runs.get(s)!.has(other) && runs.get(s)!.has(SOLO))) continue;
  console.log(`\n## The same seeds, ${SOLO} against ${other}\n`); console.log(row('level', 'pairs', `${other} better`, 'same', `${other} worse`, 'ghost solo→' + other + ' (points, 95 %)', 'nobody noticed (ghost or turned) solo→' + other, 'nobody alerted (ghost, turned or noticed) solo→' + other, 'dead solo→' + other + ' (points, 95 %)', 'loud solo→' + other, `worse seeds (solo→${other})`)); console.log(row(...Array(11).fill('---')));
  for (const scn of scns) { const A = runs.get(scn)!.get(SOLO), B = runs.get(scn)!.get(other); if (!A || !B) continue; let b = 0, s = 0, w = 0, n = 0; const worse: string[] = []; const k = (S: Run[], c: string) => S.filter(r => cls2(r) === c).length; const As: Run[] = [], Bs: Run[] = [];
    for (const [seed, ra] of A) { const rb = B.get(seed); if (!rb) continue; n++; As.push(ra); Bs.push(rb); const d = RANK[cls2(rb)] - RANK[cls2(ra)]; if (d > 0) b++; else if (d < 0) { w++; worse.push(`${seed} ${cls2(ra)}→${cls2(rb)}`); } else s++; }
    const dd = (c: string) => As.map((ra, i) => (c.split('+').includes(cls2(Bs[i])) ? 1 : 0) - (c.split('+').includes(cls2(ra)) ? 1 : 0));
    console.log(row(scn, n, b, s, w, `${k(As, 'ghost')}→${k(Bs, 'ghost')} (${boot(dd('ghost'))})`, `${k(As, 'ghost') + k(As, 'turned')}→${k(Bs, 'ghost') + k(Bs, 'turned')} (${boot(dd('ghost+turned'))})`, `${k(As, 'ghost') + k(As, 'turned') + k(As, 'looked')}→${k(Bs, 'ghost') + k(Bs, 'turned') + k(Bs, 'looked')} (${boot(dd('ghost+turned+looked'))})`, `${k(As, 'dead')}→${k(Bs, 'dead')} (${boot(dd('dead'))})`, `${k(As, 'loud')}→${k(Bs, 'loud')}`, worse.slice(0, 6).join(', '))); } }

// ───────────────────────────── per level: the classes of every (arm, tag), the ghost share with its 95 % interval, the switches each was played under
/** Wilson's 95 % interval for k of n, in percent */
const wilson = (k: number, n: number) => { if (!n) return '—'; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return `${Math.round(100 * Math.max(0, c - h))} to ${Math.round(100 * Math.min(1, c + h))}`; };
/** the switches a set of rows was played under: 'off' · 'pair' (all of them) · the ones that were on · '?' for rows from a runner that kept none · 'MIXED' when the rows disagree */
const swOf = (R: Run[]) => { const S = new Set(R.filter(r => r.cls !== 'error' || r.sw).map(r => { const w = r.sw; if (!w) return '?'; const on = ['orders', 'sneak', 'spotted'].filter(k => w[k]); return on.length === 3 ? (w.pair ? 'pair (all three)' : 'orders+sneak+spotted') : on.length ? on.join('+') : 'off'; })); return S.size === 1 ? [...S][0] : S.size ? `MIXED: ${[...S].join(' / ')}` : '?'; };
console.log('\n## Classes, level by level\n');
for (const scn of scns) { console.log(`### ${scn}\n`); console.log(row('arm', 'tag', 'switches', 'n', ...CLS.slice(0, 7), 'error', 'ghost share (95 %)', 'nobody noticed: ghost or turned (95 %)')); console.log(row(...Array(14).fill('---')));
  for (const [arm, S] of armsOf(scn)) { const R = [...S.values()], G = R.filter(r => r.cls !== 'error'), n = G.length, c = (k: string) => R.filter(r => cls2(r) === k).length, q = c('ghost') + c('turned');
    console.log(row(baseOf(arm), tagOf(arm) || '—', swOf(R), n, ...CLS.slice(0, 7).map(c), c('error'), `${pct(c('ghost'), n)} (${wilson(c('ghost'), n)})`, `${pct(q, n)} (${wilson(q, n)})`)); }
  console.log(''); }

// ───────────────────────────── one arm, two tags (the switches off and on), the same seeds
{ const bases = [...new Set(KEYS.map(baseOf))].filter(b => KEYS.filter(k => baseOf(k) === b).length > 1);
  if (bases.length) { console.log('## The same seeds and the same arm, one tag against another (the switches off → on)\n'); console.log(row('level', 'arm', 'from → to', 'switches', 'pairs', 'better', 'same', 'worse', 'ghost (points, 95 %)', 'nobody noticed: ghost or turned (points, 95 %)', 'nobody alerted: ghost, turned or noticed (points, 95 %)', 'dead (points, 95 %)', 'loud', 'seeds that end worse', 'seeds that end better')); console.log(row(...Array(15).fill('---')));
    const allRows = (k: string) => scns.flatMap(s => [...(runs.get(s)!.get(k)?.values() ?? [])]), isOff = (k: string) => swOf(allRows(k)) === 'off';
    for (const base of bases) { const ks = KEYS.filter(k => baseOf(k) === base).sort((a, b) => (isOff(b) ? 1 : 0) - (isOff(a) ? 1 : 0) || tagOf(a).localeCompare(tagOf(b))), k0 = ks[0];   // (the baseline: the set played with every switch off, else the untagged one)
      for (const k1 of ks.slice(1)) for (const scn of [...scns, 'ALL']) { const As: Run[] = [], Bs: Run[] = [];
        for (const s of scn === 'ALL' ? scns : [scn]) { const A = runs.get(s)!.get(k0), B = runs.get(s)!.get(k1); if (!A || !B) continue; for (const [seed, ra] of A) { const rb = B.get(seed); if (rb && ra.cls !== 'error' && rb.cls !== 'error') { As.push(ra); Bs.push(rb); } } }
        if (!As.length || (scn === 'ALL' && scns.length < 2)) continue; let b = 0, same = 0, w = 0; const worse: string[] = [], better: string[] = [];
        As.forEach((ra, i) => { const d = RANK[cls2(Bs[i])] - RANK[cls2(ra)], tag = `${scn === 'ALL' ? ra.scn + ':' : ''}${ra.seed} ${cls2(ra)}→${cls2(Bs[i])}`; if (d > 0) { b++; better.push(tag); } else if (d < 0) { w++; worse.push(tag); } else same++; });
        const k = (S: Run[], c: string) => S.filter(r => c.split('+').includes(cls2(r))).length, dd = (c: string) => As.map((ra, i) => (c.split('+').includes(cls2(Bs[i])) ? 1 : 0) - (c.split('+').includes(cls2(ra)) ? 1 : 0)), cell = (c: string) => `${k(As, c)}→${k(Bs, c)} (${boot(dd(c))})`;
        console.log(row(scn, base, `${tagOf(k0) || 'untagged'} → ${tagOf(k1) || 'untagged'}`, `${swOf(As)} → ${swOf(Bs)}`, As.length, b, same, w, cell('ghost'), cell('ghost+turned'), cell('ghost+turned+looked'), cell('dead'), `${k(As, 'loud')}→${k(Bs, 'loud')}`, worse.slice(0, 6).join(', '), better.slice(0, 6).join(', '))); } }
    console.log(''); } }

// ───────────────────────────── whose doing the first compromise was
/** sam · partner · drop (a dropped man's weapon on the floor) · theirs (their own noise or word) · world · unclear — 'none': nothing went wrong */
function whose(r: Run): string { const F = r.m.first; if (!F) return 'none';
  const of = (s: string | null | undefined) => s === 'sam' ? 'sam' : s === 'mate' ? 'partner' : s === 'drop' ? 'drop' : s === 'theirs' ? 'theirs' : s === 'world' ? 'world' : 'unclear';
  if (F.how === 'loud') return of(F.src);
  if (F.sawAgo !== null && F.sawAgo !== undefined && F.sawAgo < 0.6 && (F.foe === 'mate' || F.foe === 'sam')) return of(F.foe);
  if (F.heard && F.heard.ago < 0.6) return of(F.heard.src);
  return /\[squads\]|reinforce|dig-in|plants|rall/.test((F.notes ?? []).join(' | ')) ? 'theirs' : 'unclear'; }
{ const W = ['none', 'sam', 'partner', 'drop', 'theirs', 'world', 'unclear'];
  console.log('## Whose doing the first compromise was\n'); console.log(row('level', 'arm', 'n', 'nothing went wrong', 'Sam', 'the partner', "a dropped man's weapon", 'theirs', 'the world', 'unclear', 'seeds: the partner')); console.log(row(...Array(11).fill('---')));
  for (const scn of [...scns, 'ALL']) for (const arm of KEYS) { const R = (scn === 'ALL' ? scns : [scn]).flatMap(s => [...(runs.get(s)!.get(arm)?.values() ?? [])]).filter(r => r.cls !== 'error'); if (!R.length || (scn === 'ALL' && scns.length < 2)) continue;
    const c = (k: string) => R.filter(r => whose(r) === k); console.log(row(scn, arm, R.length, ...W.map(k => `${c(k).length} (${pct(c(k).length, R.length)})`), c('partner').map(r => (scn === 'ALL' ? r.scn + ':' : '') + r.seed).slice(0, EX + 3).join('/'))); }
  console.log(''); }

// ───────────────────────────── the partner as a follower, and what the sneak and the spotted parts did (their own counters)
if (PAIRKEYS.some(k => scns.some(s => [...(runs.get(s)!.get(k)?.values() ?? [])].some(r => r.m?.pre && 'follower' in r.m.pre)))) {
  console.log('## Is the partner a follower while nothing has gone wrong, and what his sneak did\n'); console.log(row('level', 'arm', 'switches', 'runs', 'a FOLLOWER (fall in, no post), share of the calm samples', '…with the squad silent and unbroken', 'under the sneak (sneak.ts sneaking)', 'his order otherwise', 'sneak a run: waits / s waited / crossings / shade / back-offs / cues', 'spotted a run: wary / caught / freezes / slips / steps / cues')); console.log(row(...Array(10).fill('---')));
  for (const scn of scns) for (const arm of PAIRKEYS) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R0 = [...S.values()].filter(r => r.cls !== 'error'), R = R0.filter(r => r.m?.pre && typeof r.m.pre.follower === 'number'); if (!R.length) continue;
    const ords = new Map<string, number>(); for (const r of R) for (const [k, v] of Object.entries(r.m.pre.orders ?? {})) if (k !== 'fallIn') ords.set(k, (ords.get(k) ?? 0) + (v as number) / R.length);
    const SN = R0.filter(r => r.m.sneak), SPT = R0.filter(r => r.m.spottedStats), per = (X: Run[], f: (r: Run) => number) => f1(mean(X.map(f)));
    console.log(row(scn, arm, swOf(R0), R.length, pct(mean(R.map(r => r.m.pre.follower)), 1), pct(mean(R.map(r => r.m.pre.followerSilent)), 1), pct(mean(R.map(r => r.m.pre.sneaking ?? 0)), 1), [...ords].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, 1)}`).join(' · ') || '—',
      SN.length ? ['waits', 'waitS', 'crossings', 'shade', 'backOffs', 'cues'].map(k => per(SN, r => r.m.sneak[k] ?? 0)).join(' / ') : 'off', SPT.length ? ['wary', 'caught', 'freezes', 'slips', 'steps', 'cues'].map(k => per(SPT, r => r.m.spottedStats[k] ?? 0)).join(' / ') : 'off')); }
  console.log(''); }

// ───────────────────────────── pairmark: what the scripted commander's orders came to (pairorders.ts's own PAIR_STATS / PAIR_LOG, summed over the runs)
{ const MK = KEYS.filter(k => baseOf(k) === 'pairmark');
  if (MK.length) { console.log("## pairmark: 'take him · on your mark', as the scripted commander gave it\n");
    console.log(row('level', 'arm', 'runs', 'defenders', 'orders tried', 'given', 'refused (why)', 'set', 'marks', 'taken (out cold by the partner)', 'blown', 'called off by the partner (why)', 'watched holds', 'go anyway', 'the commander gave up (why)', 'no order: not yet / never (why)', 'men Sam shot after a failed order', 's from order to set (mean / median / max)', 'runs with a man taken', 'first thing wrong (kind: runs)')); console.log(row(...Array(20).fill('---')));
    const bag = (R: Run[], k: string) => { const o = new Map<string, number>(); for (const r of R) for (const [a, v] of Object.entries(r.m.mark[k] ?? {})) o.set(a, (o.get(a) ?? 0) + (v as number)); return [...o].sort((a, b) => b[1] - a[1]).map(([a, v]) => `${v} ${a}`).join(' · ') || '0'; };
    for (const scn of [...scns, 'ALL']) for (const arm of MK) { const R = (scn === 'ALL' ? scns : [scn]).flatMap(s => [...(runs.get(s)!.get(arm)?.values() ?? [])]).filter(r => r.cls !== 'error' && r.m?.mark); if (!R.length || (scn === 'ALL' && scns.length < 2)) continue;
      const sum = (k: string) => R.reduce((a, r) => a + (r.m.mark[k] ?? 0), 0), secs = R.flatMap(r => r.m.mark.setSecs as number[]).sort((a, b) => a - b), bad = new Map<string, number>();
      for (const r of R) { const b = r.m.mark.firstBad; if (b) { const w = String(b.what), k = /^(refused|gave up|off):/.test(w) ? w : w.split(':')[0]; bad.set(k, (bad.get(k) ?? 0) + 1); } }
      console.log(row(scn, arm, R.length, R.reduce((a, r) => a + (r.hostilesOf ?? 0), 0), sum('tried'), sum('given'), bag(R, 'refused'), sum('set'), sum('marks'), `${sum('taken')} (${pct(sum('taken'), sum('given'))} of the orders given)`, sum('blown'), bag(R, 'calledOff'), sum('watchedHolds'), sum('anyway'), bag(R, 'gaveUp'), bag(R, 'skipped'), sum('samFallback'), secs.length ? `${f1(mean(secs))} / ${f1(secs[secs.length >> 1])} / ${f1(secs[secs.length - 1])}` : '—', `${R.filter(r => r.m.mark.taken > 0).length} (${pct(R.filter(r => r.m.mark.taken > 0).length, R.length)})`, [...bad].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none')); }
    console.log(''); } }

console.log('\n## The first thing that goes wrong (the first of: a defender notices, something loud)\n');
for (const arm of KEYS) { if (!scns.some(s => runs.get(s)!.has(arm))) continue; const all = new Map<string, { n: number; by: Map<string, number[]> }>(); let N = 0;
  console.log(`### ${arm}\n`); const per = new Map<string, Map<string, number>>();
  for (const scn of scns) { const S = runs.get(scn)!.get(arm); if (!S) continue; per.set(scn, new Map()); for (const r of S.values()) { if (r.cls === 'error') continue; N++; const c = cause(r); per.get(scn)!.set(c, (per.get(scn)!.get(c) ?? 0) + 1); if (!all.has(c)) all.set(c, { n: 0, by: new Map() }); const a = all.get(c)!; a.n++; if (!a.by.has(scn)) a.by.set(scn, []); a.by.get(scn)!.push(r.seed); } }
  const causes = [...all.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log(row('first compromise', 'runs', 'share', ...scns.filter(s => per.has(s)), 'seeds that show it')); console.log(row(...Array(4 + [...per.keys()].length).fill('---')));
  for (const [c, a] of causes) console.log(row(c, a.n, pct(a.n, N), ...scns.filter(s => per.has(s)).map(s => per.get(s)!.get(c) ?? 0), [...a.by.entries()].slice(0, 4).map(([s, seeds]) => `${s}:${seeds.sort((x, y) => x - y).slice(0, EX).join('/')}`).join(' · ')));
  console.log(''); }

for (const arm of PAIRKEYS) { if (!scns.some(s => runs.get(s)!.has(arm))) continue;
  console.log(`## The partner's part, anywhere in the run (${arm})\n`);
  const keys: [string, string][] = [['seenFirst', 'partner seen is the FIRST compromise'], ['seen', 'a defender notices with his eyes on the partner'], ['glimpsed', 'a defender\'s eyes on the partner at all (a sighting that moved his awareness)'], ['heard', 'a defender notices on the partner\'s noise'], ['heardAny', 'a defender hears the partner at all'], ['lit', 'the partner\'s light on'], ['door', 'seen while standing in a doorway'], ['firesFirst', 'the partner makes the first loud noise'], ['fired', 'the partner fires at all'], ['firedAtCalm', 'the partner\'s first round is at a man who had not noticed'], ['behind', 'partner left behind (over 8 m at the first compromise, or over 9 m a quarter of the calm time)'], ['down', 'the partner goes down'], ['blocks', 'Sam stopped by the partner\'s body'], ['masked', 'the partner in Sam\'s line of fire as he presses']];
  console.log(row('what', ...scns.filter(s => runs.get(s)!.has(arm)), 'all', 'seeds')); console.log(row(...Array(3 + scns.filter(s => runs.get(s)!.has(arm)).length).fill('---')));
  for (const [k, label] of keys) { let tot = 0, N = 0; const ex: string[] = []; const cells = scns.filter(s => runs.get(s)!.has(arm)).map(scn => { const R = [...runs.get(scn)!.get(arm)!.values()].filter(r => r.cls !== 'error'); const hit = R.filter(r => (partnerPart(r) as any)[k]); tot += hit.length; N += R.length; if (hit.length) ex.push(`${scn}:${hit.map(r => r.seed).sort((a, b) => a - b).slice(0, EX).join('/')}`); return `${hit.length} (${pct(hit.length, R.length)})`; });
    console.log(row(label, ...cells, `${tot} (${pct(tot, N)})`, ex.slice(0, 4).join(' · '))); }
  console.log(`\n### While nothing had gone wrong yet (${arm}; means over runs with a calm stretch)\n`);
  console.log(row('level', 'calm s', 'partner to Sam m (mean / max)', 'over 6 m', 'over 9 m', 'partner in a defender\'s line', '…in his view cone', '…and Sam is not', 'Sam in a view cone', 'partner standing in a doorway', 'partner nearer the enemy than Sam', 'partner still', 'light meter partner / Sam', 'hold-fire frames')); console.log(row(...Array(14).fill('---')));
  for (const scn of scns) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(r => r.m?.pre && r.m.pre.n > 6), P = (k: string) => mean(R.map(r => r.m.pre[k]));
    console.log(row(scn, f1(P('secs')), `${f1(P('dMean'))} / ${f1(P('dMax'))}`, pct(P('far6'), 1), pct(P('far9'), 1), pct(P('mateLos'), 1), pct(P('mateCone'), 1), pct(P('mateOnlyCone'), 1), pct(P('samCone'), 1), pct(P('mateDoor'), 1), pct(P('mateAhead'), 1), pct(P('mateStill'), 1), `${f2(P('mateVis'))} / ${f2(P('samVis'))}`, f1(mean([...S.values()].map(r => r.silent?.held ?? 0))))); }
  console.log(`\n### Who does the work (${arm})\n`); console.log(row('level', 'Sam kills', 'partner kills', 'Sam rounds', 'partner rounds', 'their rounds', 'doors eased / picked / no quiet way', 'door jammed by a body', 'runs a wedged or steel door stops')); console.log(row(...Array(9).fill('---')));
  for (const scn of scns) { const S = runs.get(scn)!.get(arm); if (!S) continue; const R = [...S.values()].filter(r => r.cls !== 'error'), mm = (f: (r: Run) => number) => f1(mean(R.map(f)));
    console.log(row(scn, mm(r => r.m.samKills), mm(r => r.m.mateKills), mm(r => r.m.samShots), mm(r => r.m.mateShots), mm(r => r.m.theirShots), `${mm(r => r.m.doors.eased)} / ${mm(r => r.m.doors.picked)} / ${mm(r => r.m.doors.refused)}`, `${R.filter(r => r.m.doors.bodyJam).length} (${R.filter(r => r.m.doors.bodyJam).map(r => r.seed).slice(0, 3).join('/')})`, `${R.filter(r => (r.m.doors.noPick ?? []).length).length} (${pct(R.filter(r => (r.m.doors.noPick ?? []).length).length, R.length)}; before any compromise ${R.filter(r => (r.m.doors.noPick ?? []).some((x: any) => !x.afterFirst)).length})`)); }
  console.log(''); }

{ // what the script's own trigger does: every man Sam drops, by what his mates' eyes had of him the moment the trigger was pressed
  const has = scns.some(s => [...runs.get(s)!.values()].some(S => [...S.values()].some(r => r.m?.drops && !Array.isArray(r.m.drops) && r.m.drops.n > 0)));
  if (has) { console.log(`## The men Sam drops, and who was looking\n`); console.log(row('level', 'arm', 'drops a run', 'of men who had not noticed: a mate\'s eyes on him', 'a mate has a line, not facing', 'nobody has a line', 'he had already noticed', 'a round meant for another', 'runs with a watched drop', 'careful: waits a run / s waited / gave in', 'seeds (first watched drop)')); console.log(row(...Array(11).fill('---')));
    for (const scn of scns) for (const [arm, S] of armsOf(scn)) { const R = [...S.values()].filter(r => r.cls !== 'error' && r.m?.drops && !Array.isArray(r.m.drops)); if (!R.length) continue; const sum = (k: string) => R.reduce((a, r) => a + (r.m.drops[k] ?? 0), 0), n = sum('n'), calm = sum('watched') + sum('inLine') + sum('unseen'), W = R.filter(r => r.m.drops.watched > 0), C = R.filter(r => r.m.care?.on);
      console.log(row(scn, arm, f1(n / R.length), `${sum('watched')} of ${calm} (${pct(sum('watched'), calm)})`, pct(sum('inLine'), calm), pct(sum('unseen'), calm), `${sum('roused')} (${pct(sum('roused'), n)})`, `${sum('stray')} (${pct(sum('stray'), n)})`, `${W.length} (${pct(W.length, R.length)})`, C.length ? `${f1(mean(C.map(r => r.m.care.waits)))} / ${f1(mean(C.map(r => r.m.care.waitSecs)))} / ${f1(mean(C.map(r => r.m.care.gaveIn)))}` : '—', W.map(r => r.seed).sort((a, b) => a - b).slice(0, EX).join('/'))); }
    console.log(''); } }

if (VS) { console.log(`## The same seeds run plain and '${VS}'\n`); console.log(row('level', 'arm', 'seeds', 'ghost plain → ' + VS, 'turned', 'noticed', 'spotted', 'loud', 'dead', 'same ending', 'Sam under open sky while calm (' + VS + ')', 'light meter Sam, calm (plain → ' + VS + ')', 'seeds that end worse')); console.log(row(...Array(13).fill('---')));
  for (const scn of scns) for (const [arm, S] of armsOf(scn)) { const O = other.get(scn)?.get(arm); if (!O) continue; const A: Run[] = [], B: Run[] = []; for (const [seed, r] of S) { const o = O.get(seed); if (o) { A.push(r); B.push(o); } } if (!A.length) continue;
    const k = (R: Run[], c: string) => R.filter(r => cls2(r) === c).length, worse = A.map((r, i) => RANK[cls2(B[i])] < RANK[cls2(r)] ? `${r.seed} ${cls2(r)}→${cls2(B[i])}` : '').filter(Boolean);
    console.log(row(scn, arm, A.length, ...['ghost', 'turned', 'looked', 'spotted', 'loud', 'dead'].map(c => `${k(A, c)} → ${k(B, c)}`), A.filter((r, i) => cls2(r) === cls2(B[i])).length, pct(mean(B.filter(r => r.m?.pre).map(r => r.m.pre.samSky ?? 0)), 1), `${f2(mean(A.filter(r => r.m?.pre).map(r => r.m.pre.samVis)))} → ${f2(mean(B.filter(r => r.m?.pre).map(r => r.m.pre.samVis)))}`, worse.slice(0, 5).join(', '))); }
  console.log(''); }
