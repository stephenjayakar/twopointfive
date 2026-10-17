// THE HEADLESS HALF OF tools/qa/samefight-page.cjs: a replay file the REAL PAGE made is walked again here off its run tape (tools/qa/rerun.ts — the die's seed, the
// page's query and tables, then per step its dt, the player's record and what the game read off the GPU), and the raw bits of the game (src/game/digest.ts rawBits)
// are folded after every step exactly as the page folded its own (`__digest.chain`). Prints one line: SAMEFIGHT {words, steps, …} — the caller compares the words.
//   bun run tools/qa/samefight-rerun.ts <replay.json> <steps the page chained> [every=30]
import { readFileSync } from 'node:fs';
import { rerun } from './rerun.ts';
import type { ReplayFile } from '../../src/replay/format.ts';

const [path, stepsArg, everyArg] = process.argv.slice(2);
if (!path || !stepsArg) { console.log('usage: bun run tools/qa/samefight-rerun.ts <replay.json> <steps> [every]'); process.exit(2); }
const F = JSON.parse(readFileSync(path, 'utf8')) as ReplayFile, steps = Number(stepsArg), every = Number(everyArg ?? 30);
const { rawBits, RAW_BITS_SEED } = await import('../../src/game/digest.ts');
const ticks = (F as { rerun?: { ticks?: number } }).rerun?.ticks ?? 0, from = ticks - steps;   // (the page's chain began this many steps into its tape: a boot steps the game before a script has the hooks)
let word: number = RAW_BITS_SEED, n = 0; const words: string[] = [];
const R = await rerun(F, { toN: ticks, each: (W, f) => { if (f < from) return; word = rawBits(W.game as never, word); if (++n % every === 0) words.push(word.toString(36)); } });
if (R.refuse) { console.log('SAMEFIGHT ' + JSON.stringify({ refuse: R.refuse })); process.exit(3); }
const rep = R.report!;
console.log('SAMEFIGHT ' + JSON.stringify({ words, steps: n, ticks, compared: rep.compared, worst: rep.worst?.metres ?? 0, drift: rep.drift ? `${rep.drift.who} ${rep.drift.metres.toFixed(2)} m at step ${rep.drift.n}` : '', unjournaled: rep.unjournaled, ownSenses: rep.ownSenses, warnings: rep.warnings }));
process.exit(0);
