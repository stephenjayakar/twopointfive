// The tables of tools/qa/handle-watch.ts: where the AI opened doors from, over a batch of tools/qa/playthrough.ts runs (its --json).
//   bun run tools/qa/handle-tally.ts <batch.json> [<batch2.json> …]        one table per file
//   bun run tools/qa/handle-tally.ts --pair <before.json> <after.json>     + the smell check side by side (ends, smells by kind, per level)
// A leaf pushed or pulled open whose named opener (Door.lastWho) stood more than STALE_M from its handle was not opened by him: a body's contact, or a hand,
// reaches no further — a name left on it from an earlier touch (a leaf swinging back by itself, a second man on it): counted as nobody's. So is a 'push' or a 'bash' from the face a leaf opens into: from there a body can only push it TO (a leaf
// a hair ajar being shut — the watcher before its direction test logged those).
// 'judged' = every opening by a man of the AI that was not a kick (a kick is taken from where the kick stands); 'at the handle' = handle-watch.ts's ok.
import { readFileSync } from 'node:fs';
import type { RunOut } from './playthrough.ts';
import type { HandleRow } from './handle-watch.ts';

const STALE_M = 1.7, LONG_M = 1.5, HANDLE_REACH_TXT = '1.0';
const args = process.argv.slice(2), pair = args[0] === '--pair', files = pair ? args.slice(1) : args;
if (!files.length) { console.error('usage: handle-tally.ts [--pair] <batch.json> …'); process.exit(2); }
const load = (f: string): RunOut[] => JSON.parse(readFileSync(f, 'utf8')).runs;
const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(0)}%` : '–';
const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const doingOf = (r: HandleRow) => r.doing.replace(/:lead$/, ' (lead)').replace(/^op:(\w+):(\w+)/, 'door order · $2').replace(/^order:(\w+)\*?/, 'order · $1').replace(/:unit/, '').replace(/:scripted/, ' (scripted)');

function table(name: string, runs: RunOut[]) {
  const rows: (HandleRow & { scn: string; seed: number })[] = []; let player = 0, nobody = 0, stale = 0, pass = 0, passOpener = 0; const stats = new Map<string, number>();
  for (const r of runs) { const h = (r as any).handle; if (!h) continue; player += h.player; nobody += h.nobody; pass += h.passThrough; passOpener += (h.pass ?? []).filter((p: any) => p.opener).length;
    for (const x of h.rows as HandleRow[]) { if ((x.how !== 'shove' && x.reach > STALE_M) || (x.face === 'pull' && (x.how === 'push' || x.how === 'bash'))) { stale++; continue; } rows.push({ ...x, scn: r.scn, seed: r.seed }); } for (const [k, v] of Object.entries(h.stats ?? {})) bump(stats, k, v as number); }
  const ai = rows.filter(r => r.side !== 'civilian'), judged = ai.filter(r => r.how !== 'kick'), ok = judged.filter(r => r.ok);
  console.log(`\n== ${name}: ${runs.length} runs · ${rows.length + player + nobody + stale} openings from shut — the AI's men ${ai.length} (kicks ${ai.length - judged.length}), civilians ${rows.length - ai.length}, the player's ${player}, nobody's ${nobody + stale}`);
  console.log(`   judged ${judged.length} · AT THE HANDLE ${ok.length} (${pct(ok.length, judged.length)}) · not ${judged.length - ok.length}`);
  const cut = (title: string, key: (r: HandleRow) => string) => { const m = new Map<string, [number, number, Map<string, number>]>();
    for (const r of judged) { const k = key(r), e = m.get(k) ?? [0, 0, new Map()]; e[0]++; if (r.ok) e[1]++; else bump(e[2], r.why); m.set(k, e); }
    console.log(`   by ${title}:`); for (const [k, [n, o, why]] of [...m].sort((a, b) => b[1][0] - a[1][0])) console.log(`     ${k.padEnd(34)} ${String(n).padStart(4)} · at the handle ${String(o).padStart(4)} (${pct(o, n).padStart(4)})${why.size ? ' · not: ' + [...why].map(([w, c]) => `${w} ${c}`).join(', ') : ''}`); };
  cut('side', r => r.side); cut('face · how', r => `${r.face} face · ${r.how}`); cut('what he was doing', r => `${r.side} · ${doingOf(r)}`); cut('level', r => (r as any).scn);
  const pullRows = judged.filter(r => r.face === 'pull');
  const long = judged.filter(r => !r.ok && r.why === 'far' && r.face === 'pull' && r.how === 'pull' && !r.sweep && r.reach <= LONG_M && r.along >= r.W / 2);
  console.log(`   of those not: ${long.length} at the LONG REACH (a door in a corner: pulled from the handle half, clear of its sweep, ${HANDLE_REACH_TXT}‥${LONG_M} m from the handle) · ${judged.length - ok.length - long.length} anywhere else`);
  console.log(`   on the pull face ${pullRows.length}: in the sweep ${pullRows.filter(r => r.sweep).length} · clear of it ${pullRows.filter(r => !r.sweep).length}`);
  console.log(`   the leaf came round THROUGH a living man of the AI ${pass} times — ${passOpener} of them its own opener`);
  if (stats.size) console.log(`   handleside.ts: ${[...stats].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const bad = judged.filter(r => !r.ok); if (bad.length && bad.length <= 40) { console.log('   not at the handle:'); for (const r of bad) console.log(`     ${(r as any).scn}:${(r as any).seed} ${r.t}s ${r.door} ${r.how} ${r.face} face · ${r.who} (${r.side}, ${r.doing}) · ${r.along}/${r.W} m, ${r.off} off, reach ${r.reach}${r.sweep ? ', in the sweep' : ''} · ${r.why}`); }
}
function smells(name: string, runs: RunOut[]) {
  const by = new Map<string, { n: number; taken: number; team: number; of: number; t: number; kinds: Map<string, number> }>(); const kinds = new Set<string>();
  for (const r of runs) { const e = by.get(r.scn) ?? { n: 0, taken: 0, team: 0, of: 0, t: 0, kinds: new Map() }; e.n++; if (r.end === 'taken') e.taken++; e.team += r.team; e.of += r.of; e.t += r.t; for (const s of r.smells) { bump(e.kinds, s.kind); kinds.add(s.kind); } by.set(r.scn, e); }
  return { name, by, kinds };
}
for (const f of files) table(f.split('/').pop()!, load(f));
if (pair && files.length >= 2) {
  const A = smells('before', load(files[0])), B = smells('after', load(files[1])), kinds = [...new Set([...A.kinds, ...B.kinds])].sort(), watch = ['stuck', 'hung', 'stalled', 'wrongway'];
  console.log(`\n== the smell check, before → after (${files[0].split('/').pop()} → ${files[1].split('/').pop()})`);
  console.log(`   ${'level'.padEnd(18)} runs   taken        team up      mean secs    ${watch.join('  ')}   all smells`);
  let tot = [0, 0, 0, 0];
  for (const scn of new Set([...A.by.keys(), ...B.by.keys()])) { const a = A.by.get(scn), b = B.by.get(scn); if (!a || !b) continue; tot[0] += a.taken; tot[1] += b.taken; tot[2] += a.n; tot[3] += b.n;
    const all = (e: typeof a) => [...e.kinds.values()].reduce((x, y) => x + y, 0);
    console.log(`   ${scn.padEnd(18)} ${String(a.n).padStart(2)}/${String(b.n).padEnd(2)}  ${String(a.taken).padStart(2)} → ${String(b.taken).padEnd(2)}   ${(a.team / a.n).toFixed(2)} → ${(b.team / b.n).toFixed(2)}   ${(a.t / a.n).toFixed(0).padStart(3)} → ${(b.t / b.n).toFixed(0).padEnd(3)}   ${watch.map(k => `${a.kinds.get(k) ?? 0}→${b.kinds.get(k) ?? 0}`.padEnd(k.length + 1)).join(' ')}  ${all(a)} → ${all(b)}`); }
  console.log(`   taken ${tot[0]}/${tot[2]} → ${tot[1]}/${tot[3]}`);
  console.log(`   smells by kind: ${kinds.map(k => { let x = 0, y = 0; for (const e of A.by.values()) x += e.kinds.get(k) ?? 0; for (const e of B.by.values()) y += e.kinds.get(k) ?? 0; return `${k} ${x}→${y}`; }).join(' · ')}`);
}
