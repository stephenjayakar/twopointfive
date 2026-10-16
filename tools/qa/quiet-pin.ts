// WHICH `quiet=N` STARTS A GIVEN DEAL — a quiet level's pinned deal is drawn off the pin (game/quiet.ts dealOne), so the pin that stands a chosen start, spot and
// patrol set has to be looked for. This prints the smallest one. A reading tool: nothing of the game is edited.
//   bun run tools/qa/quiet-pin.ts <name> [start/spot/set]      (default 0/0/0: the first of each list — the level's own mission)
//   bun run tools/qa/quiet-pin.ts <name> --all                 every deal the file holds, each with its smallest pin
//   exit 0 = printed · 2 = no such level, no scenarios.quiet block (or one with no starts or spots), or a deal out of the lists' range
// (the three draws below are a COPY of dealOne's: a change to the deal there wants the same change here; quiet-check.ts holds the game's own)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mulberry32 } from '../../src/math/dice.ts';

const ROOT = resolve(import.meta.dir, '../..');
const argv = process.argv.slice(2), name = argv.find(a => !a.startsWith('--') && !/^\d+\/\d+\/\d+$/.test(a)), want = argv.find(a => /^\d+\/\d+\/\d+$/.test(a)) ?? '0/0/0', ALL = argv.includes('--all');
if (!name) { console.error('usage: bun run tools/qa/quiet-pin.ts <name> [start/spot/set] | --all'); process.exit(2); }
let Q: any; try { Q = JSON.parse(readFileSync(resolve(ROOT, 'levels', name.endsWith('.json') ? name : `${name}.json`), 'utf8'))?.scenarios?.quiet; } catch { Q = null; }
if (!Q || !Array.isArray(Q.starts) || !Q.starts.length || !Array.isArray(Q.spots) || !Q.spots.length) { console.error(`quiet-pin: levels/${name} is missing, is not a level file, or carries no scenarios.quiet block with starts and spots`); process.exit(2); }
const nS = Q.starts.length, nP = Q.spots.length, nR = Math.max(1, Q.patrols?.length ?? 1);
// (dealOne's own arithmetic: three draws whatever the lists' lengths)
const dealOf = (pin: number) => { const r = mulberry32((pin | 0) ^ 0x51ed270b), pick = (n: number) => Math.min(n - 1, Math.floor(r() * n)); return `${pick(nS)}/${pick(nP)}/${pick(nR)}`; };
const words = (k: string) => { const [a, b, c] = k.split('/').map(Number); return `${Q.starts[a].name ?? `start ${a}`} · ${Q.spots[b].place} · ${Q.patrols?.length ? `[${Q.patrols[c].join(', ')}]` : 'every route'}`; };
const first = new Map<string, number>();
for (let pin = 0; pin < 20000 && first.size < nS * nP * nR; pin++) { const k = dealOf(pin); if (!first.has(k)) first.set(k, pin); }
if (ALL) { for (const k of [...first.keys()].sort()) console.log(`${k}  quiet=${first.get(k)}  ${words(k)}`); process.exit(0); }
if (!first.has(want)) { console.error(`quiet-pin: ${name} has no deal ${want} (${nS} start(s), ${nP} spot(s), ${nR} patrol set(s))`); process.exit(2); }
console.log(`${want}  quiet=${first.get(want)}  ${words(want)}`);
