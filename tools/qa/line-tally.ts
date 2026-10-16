// THE TABLES of tools/qa/line-watch.ts — a friend in a teammate's line of fire, per level, out of play-through JSON:
//   PT_LINE=1 bun run tools/qa/playthrough.ts --seeds 1-144 --jobs 4 --json runs.json
//   (or: sh tools/qa/line-runs.sh <dir> — one file a run, resumable)
//   bun run tools/qa/line-tally.ts <runs.json | dir> [more …] [--min 0.25] [--seeds 12] [--only 1-24] [--json tally.json] [--slim runs-slim.json]
// Seconds are man-seconds summed over the runs (every blocked frame counts); an EPISODE is counted from `--min` seconds up (a friend crossing a line for
// a few frames is not a stretch anybody would see). A hit is a kill in this game, so 'killed' is the only harm; `after` = inside 3 s of a stretch's end.
// Two files that hold the same scenario and seed: the first read stands (a re-run is never counted twice).
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LineEp, LineOut, LineDeath } from './line-watch.ts';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!files.length) { console.error('line-tally.ts <runs.json> [more.json …] [--min 0.25] [--seeds 12] [--json out.json]'); process.exit(2); }
const MIN = Number(flag('--min') ?? 0.25), NSEED = Number(flag('--seeds') ?? 12);
if (!(MIN >= 0) || !Number.isInteger(NSEED) || NSEED < 0) { console.error('--min wants seconds (0 or more), --seeds how many replay rows a level (a whole number; the seeds read are --only a-b)'); process.exit(2); }
type Run = { scn: string; seed: number; end: string; t: number; team: number; of: number; line?: LineOut; digest?: string };
const runs: Run[] = []; const seen = new Set<string>();
const SEEDS = flag('--only') ? (w => w.length === 1 ? [w[0], w[0]] : w)(flag('--only')!.split('-').map(Number)) : null;
if (SEEDS && !(SEEDS.length === 2 && SEEDS.every(Number.isFinite))) { console.error('--only wants a seed or a range: 7, 1-24'); process.exit(2); }   // --only 1-24: those seeds alone (a first cut out of a folder still filling)
const load = (f: string): Run[] => { if (statSync(f).isDirectory()) return readdirSync(f).filter(n => n.endsWith('.json')).sort().flatMap(n => load(resolve(f, n)));
  let j: any; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { return []; }   // (a file still being written)
  return Array.isArray(j.runs) ? j.runs : j.scn ? [j] : []; };
for (const f of files) for (const r of load(f)) { const k = `${r.scn}:${r.seed}`; if (seen.has(k) || (SEEDS && (r.seed < SEEDS[0] || r.seed > SEEDS[1]))) continue; seen.add(k); runs.push(r); }
const ORDER = ['night-breach', 'room-clear-pair', 'room-clear-four', 'hostage-rescue', 'rescue-registry', 'records-pair', 'depot-four', 'block-four', 'block-squads', 'warehouse-four', 'compound-four', 'barracks-four'];
runs.sort((a, b) => ORDER.indexOf(a.scn) - ORDER.indexOf(b.scn) || a.seed - b.seed);
const scns = [...new Set(runs.map(r => r.scn))];
const f1 = (x: number) => x.toFixed(1), f0 = (x: number) => String(Math.round(x)), pc = (a: number, b: number) => b > 0 ? `${Math.round(100 * a / b)}%` : '—';
const row = (c: (string | number)[]) => `| ${c.join(' | ')} |`, head = (c: string[]) => [row(c), `|${'---|'.repeat(c.length)}`];
const sum = <T>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const q = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
const L: string[] = [], J: Record<string, unknown> = {};

const of = (s: string) => runs.filter(r => (s === 'ALL' || r.scn === s) && r.line && r.end !== 'error');   // (a run that threw is half a run: named above, in no table)
const epsOf = (rs: Run[]) => rs.flatMap(r => r.line!.eps.map(e => ({ r, e })));
const dsOf = (rs: Run[]) => rs.flatMap(r => r.line!.deaths.map(d => ({ r, d })));
const mover = (e: LineEp) => { const st = e.step ?? 0; return e.walk >= e.drift + e.still + st ? 'walk' : st >= e.still && st >= e.drift ? 'step' : e.still >= e.drift ? 'still' : 'drift'; };
const FEET: Record<string, string> = { walk: 'walking on an order', still: 'planted, still', drift: 'planted, drifting', step: 'on a step of the fight\'s own' };
const samWas = (e: LineEp) => e.samPost >= e.samWalk + e.samOff ? 'post' : e.samWalk >= e.samOff ? 'walk' : 'off';
const hurt = (e: LineEp) => e.out !== 'ok';

L.push(`runs read: ${runs.length} (${scns.length} scenarios; ${runs.filter(r => !r.line).length} without the watcher's record, left out) · did not end by the scenario's rules: ${runs.filter(r => r.end === 'error').length} error (in no table), ${runs.filter(r => r.end === 'stalled').length} stalled · an episode = ${MIN} s or more`); L.push('');

// 1 — how often, how long, what it cost
L.push('### How often, how long, what it cost'); L.push('');
L.push(...head(['level', 'runs', 'man-s up', 'with a man to shoot', 'a friend in the line', 'of it', 'and ready to fire', 'episodes', 'runs with one ≥ 1 s', 'median s', 'p90 s', 'longest s', 'team deaths', 'blocked 0.5 s+ of his last 3', 'blocked under 0.5 s of them', 'an open line only', 'no man to shoot in them']));
const T1: Record<string, unknown> = {};
for (const s of [...scns, 'ALL']) { const rs = of(s); if (!rs.length) continue; const eps = epsOf(rs).filter(x => x.e.secs >= MIN), ds = dsOf(rs), len = eps.map(x => x.e.secs);
  const up = sum(rs, r => r.line!.up), eng = sum(rs, r => r.line!.engaged), bl = sum(rs, r => r.line!.blocked), rd = sum(rs, r => r.line!.ready), n = (c: string) => ds.filter(x => x.d.cls === c).length;
  const long = new Set(eps.filter(x => x.e.secs >= 1).map(x => x.r.seed + x.r.scn)).size;
  const w = (f: (d: LineDeath) => boolean) => ds.filter(x => f(x.d)).length, dB = w(d => d.blk >= 0.5), db = w(d => d.blk > 0 && d.blk < 0.5), dO = w(d => d.blk === 0 && d.open > 0), dN = w(d => d.blk === 0 && d.open === 0);
  L.push(row([s, rs.length, f0(up), f0(eng), f1(bl), pc(bl, eng), f1(rd), eps.length, `${long} (${pc(long, rs.length)})`, f1(q(len, 0.5)), f1(q(len, 0.9)), f1(Math.max(0, ...len)), ds.length, `${dB} (${pc(dB, ds.length)})`, db, dO, dN]));
  T1[s] = { runs: rs.length, up, engaged: eng, blocked: bl, ready: rd, episodes: eps.length, runsLong: long, median: q(len, 0.5), p90: q(len, 0.9), longest: Math.max(0, ...len), deaths: ds.length, dBlocked: dB, dBrief: db, dOpen: dO, dNone: dN, atDeath: { blocked: n('blocked'), after: n('after'), open: n('engaged'), none: n('none') } }; }
J.often = T1; L.push('');

// 2 — the rate: deaths per 100 man-seconds, by the state he was in on the frame he dropped
L.push('### Deaths per 100 man-seconds, by what the teammate had on his last living frame'); L.push('');
L.push(...head(['level', 'a friend in his line', 'his man and an open line', 'no man to shoot']));
for (const s of [...scns, 'ALL']) { const rs = of(s); if (!rs.length) continue; const ds = dsOf(rs), n = (c: string) => ds.filter(x => x.d.last === c).length;
  const up = sum(rs, r => r.line!.up), eng = sum(rs, r => r.line!.engaged), bl = sum(rs, r => r.line!.blocked);
  const rate = (k: number, secs: number) => secs > 0 ? `${(100 * k / secs).toFixed(1)} (${k} in ${f0(secs)} s)` : '—';
  L.push(row([s, rate(n('blocked'), bl), rate(n('open'), Math.max(0, eng - bl)), rate(n('none'), Math.max(0, up - eng))])); }
L.push('');

// 2b — the deaths with half a second or more of their last three blocked: by whom, and what he was doing
L.push('### The teammates who died with 0.5 s or more of their last 3 s blocked'); L.push('');
L.push(...head(['level', 'deaths', 'mostly by Sam', 'mostly by a mate', 'walking on an order', 'planted, still', 'planted, drifting', 'gun lowered', 'killed by the man he was on', 'by another man', 'under fall in', 'under a stack order', 'other orders']));
const T2: Record<string, unknown> = {};
for (const s of [...scns, 'ALL']) { const rs = of(s); if (!rs.length) continue; const ds = dsOf(rs).map(x => x.d).filter(d => d.blk >= 0.5), n = (f: (d: LineDeath) => boolean) => ds.filter(f).length;
  L.push(row([s, ds.length, n(d => d.blkSam >= d.blk / 2), n(d => d.blkSam < d.blk / 2), n(d => d.feet === 'walk'), n(d => d.feet === 'still'), n(d => d.feet === 'drift'), n(d => d.low), n(d => d.onKiller), n(d => !d.onKiller), n(d => d.order.startsWith('fallIn')), n(d => d.order.startsWith('stack')), n(d => !d.order.startsWith('fallIn') && !d.order.startsWith('stack'))]));
  T2[s] = { deaths: ds.length, bySam: n(d => d.blkSam >= d.blk / 2), byMate: n(d => d.blkSam < d.blk / 2), walk: n(d => d.feet === 'walk'), still: n(d => d.feet === 'still'), drift: n(d => d.feet === 'drift'), low: n(d => d.low), onKiller: n(d => d.onKiller) }; }
J.blockedDeaths = T2; L.push('');

// 3 — who the friend is, and what the commander was doing
L.push('### Who stood in the line'); L.push('');
L.push(...head(['level', 'blocked s', 'by Sam', 'by a mate', 'by another (a hostage)', 'Sam: stood at his post', '… of it still', 'Sam: walking his errand', 'Sam: stepping off a line', 'at his post: driver saw him, a spot free', '… walled both sides', '… driver did not see him in it', 'deaths (0.5 s+ of the last 3 blocked): by Sam', 'by a mate', 'by another', 'really in the way s', 'past the man s']));
const T3: Record<string, unknown> = {};
for (const s of [...scns, 'ALL']) { const rs = of(s); if (!rs.length) continue; const all = epsOf(rs).map(x => x.e), ds = dsOf(rs).filter(x => x.d.blk >= 0.5);
  const bl = sum(rs, r => r.line!.blocked), a = (k: keyof LineEp) => sum(all, e => e[k] as number), dk = (k: string) => ds.filter(x => (k === 'Sam' ? x.d.blkSam >= x.d.blk / 2 : k === 'mate' ? x.d.blkMate > x.d.blk / 2 : x.d.blkSam < x.d.blk / 2 && x.d.blkMate <= x.d.blk / 2)).length;
  const stillPost = sum(all.filter(e => e.kind === 'Sam'), e => Math.min(e.samPost, e.samStill));
  L.push(row([s, f1(bl), `${f1(a('bySam'))} (${pc(a('bySam'), bl)})`, `${f1(a('byMate'))} (${pc(a('byMate'), bl)})`, `${f1(a('byOther'))} (${pc(a('byOther'), bl)})`, `${f1(a('samPost'))} (${pc(a('samPost'), bl)})`, f1(stillPost), f1(a('samWalk')), f1(a('samOff')), f1(a('samFree')), f1(a('samBoxed')), f1(a('samUnseen')), dk('Sam'), dk('mate'), dk('other'), `${f1(a('tight'))} (${pc(a('tight'), bl)})`, `${f1(a('past'))} (${pc(a('past'), bl)})`]));
  T3[s] = { blocked: bl, bySam: a('bySam'), byMate: a('byMate'), byOther: a('byOther'), samPost: a('samPost'), samPostStill: stillPost, samWalk: a('samWalk'), samOff: a('samOff'), samFree: a('samFree'), samBoxed: a('samBoxed'), samUnseen: a('samUnseen'), deathsSam: dk('Sam'), deathsMate: dk('mate'), deathsOther: dk('other') }; }
J.who = T3; L.push('');

// 4 — what the blocked teammate was doing, and what the game did about it
L.push('### What the blocked teammate was doing, and what the game did'); L.push('');
L.push(...head(['level', 'walking on an order s', 'planted, still s', 'planted, drifting s', 'on the fight\'s own step s', 'gun lowered s', 'another man open to shoot s', 'episodes', 'side step taken', 'side step tried, no spot', 'let go for a shooter', 'feet held short', 'none of them', 'ended: line cleared', 'threat dropped', 'lost sight / no shot', 'switched man', 'he died']));
for (const s of [...scns, 'ALL']) { const rs = of(s); if (!rs.length) continue; const all = epsOf(rs).map(x => x.e), eps = all.filter(e => e.secs >= MIN), a = (k: keyof LineEp) => sum(all, e => e[k] as number), n = (f: (e: LineEp) => boolean) => eps.filter(f).length;
  L.push(row([s, f1(a('walk')), f1(a('still')), f1(a('drift')), f1(a('step')), f1(a('low')), f1(a('alt')), eps.length, n(e => e.stepOk > 0), n(e => e.stepNo > 0 && !e.stepOk), n(e => e.letGo > 0), n(e => e.short > 0), n(e => !e.stepOk && !e.stepNo && !e.letGo && !e.short && !e.aiStep),
    n(e => e.end === 'clear'), n(e => e.end === 'threatDown'), n(e => e.end === 'lostSight' || e.end === 'noShot'), n(e => e.end === 'switched' || e.end === 'letGo'), n(e => e.end === 'dead')])); }
L.push('');

// 5 — the cross: friend × the teammate's feet, with the harm
L.push('### The cross (all levels): who was in the line × what the teammate\'s feet were doing'); L.push('');
L.push(...head(['friend in the line', 'teammate', 'episodes', 'blocked s', 'median s', 'threat\'s muzzle on him (share of s)', 'rounds past him', 'side step taken', 'killed while blocked', 'killed inside 3 s after', '… by the masked man']));
{ const all = epsOf(of('ALL')); const T5: unknown[] = [];
  const kinds: [string, (e: LineEp) => boolean][] = [['Sam, at his post', e => e.kind === 'Sam' && samWas(e) === 'post'], ['Sam, walking his errand', e => e.kind === 'Sam' && samWas(e) === 'walk'], ['Sam, stepping off a line', e => e.kind === 'Sam' && samWas(e) === 'off'], ['a mate, still', e => e.kind === 'mate' && e.mateStill >= e.secs / 2], ['a mate, moving', e => e.kind === 'mate' && e.mateStill < e.secs / 2], ['another (a hostage)', e => e.kind === 'other']];
  for (const [kn, kf] of kinds) for (const mv of ['walk', 'still', 'drift', 'step']) { const es = all.map(x => x.e).filter(e => e.secs >= MIN && kf(e) && mover(e) === mv); if (!es.length) continue;
    const secs = sum(es, e => e.secs);
    L.push(row([kn, FEET[mv], es.length, f1(secs), f1(q(es.map(e => e.secs), 0.5)), pc(sum(es, e => e.onMe), secs), sum(es, e => e.shotsAt), es.filter(e => e.stepOk > 0).length, es.filter(e => e.out === 'killed').length, es.filter(e => e.out === 'killedAfter').length, es.filter(e => hurt(e) && e.byThreat).length]));
    T5.push({ friend: kn, feet: mv, episodes: es.length, secs, killed: es.filter(e => e.out === 'killed').length, after: es.filter(e => e.out === 'killedAfter').length, byThreat: es.filter(e => hurt(e) && e.byThreat).length }); }
  J.cross = T5; }
L.push('');

// 6 — by order
L.push('### By the order he was under when it began (all levels)'); L.push('');
L.push(...head(['order', 'door order\'s phase', 'episodes', 'blocked s', 'by Sam s', 'by a mate s', 'killed (blocked + after)']));
{ const all = epsOf(of('ALL')).map(x => x.e).filter(e => e.secs >= MIN); const g = new Map<string, LineEp[]>(); for (const e of all) { const k = `${e.order}|${e.door ?? '—'}`; let b = g.get(k); if (!b) g.set(k, b = []); b.push(e); }
  for (const [k, es] of [...g].sort((a, b) => sum(b[1], e => e.secs) - sum(a[1], e => e.secs)).slice(0, 18)) L.push(row([...k.split('|'), es.length, f1(sum(es, e => e.secs)), f1(sum(es, e => e.bySam)), f1(sum(es, e => e.byMate)), es.filter(hurt).length])); }
L.push('');

// 7 — replay seeds
L.push(`### Seeds to replay (bun's; up to ${NSEED} a level, deaths first, then the longest stretches)`); L.push('');
L.push(...head(['run', 'second', 'who (where)', 'on (where), m', 'friend in the line (where)', 'blocked s', 'his feet', 'order', 'what happened']));
const picks: unknown[] = [];
for (const s of scns) { const es = epsOf(of(s)).filter(x => x.e.secs >= MIN).sort((a, b) => (hurt(b.e) ? 1 : 0) - (hurt(a.e) ? 1 : 0) || b.e.secs - a.e.secs).slice(0, NSEED);
  for (const { r, e } of es) { L.push(row([`${r.scn}:${r.seed}`, f1(e.t), `${e.who} (${e.at})`, `${e.threat} (${e.threatAt}), ${e.d}`, `${e.friend}${e.kind === 'Sam' ? ', ' + samWas(e) : ''} (${e.friendAt})`, f1(e.secs), mover(e), `${e.order}${e.door ? ' · door ' + e.door : ''}`, e.out === 'ok' ? `nothing (ended ${e.end})` : `${e.out === 'killed' ? 'killed' : 'killed after'} at ${e.killT} by ${e.by}${e.byThreat ? ' (the masked man)' : ''}`]));
    picks.push({ run: `${r.scn}:${r.seed}`, ...e }); } }
J.picks = picks;

console.log(L.join('\n'));
if (flag('--slim')) writeFileSync(flag('--slim')!, JSON.stringify({ runs: runs.map(r => ({ scn: r.scn, seed: r.seed, end: r.end, t: r.t, team: r.team, of: r.of, digest: r.digest, line: r.line })) }));   // (the watcher's record alone, a run a row: what the tables are made of)
if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify(J, null, 1));
