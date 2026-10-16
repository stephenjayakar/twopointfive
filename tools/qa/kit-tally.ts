// What a squad's kit does to a run, counted: the scripted player of playthrough.ts over a few seeds with the cards set one way.
//   bun run tools/qa/kit-tally.ts <issued|quiet|loud|bare|pistols|nolight|nonvg> [--scn room-clear-four] [--seeds 1-6]
// (bare = the issued squad with every suppressor off; pistols = suppressed pistols, lights and goggles kept; nolight / nonvg = that one row off on all four.)
// One line per run and a total: runs taken, men up of men staged, the mean seconds. A handful of seeds says which way a kit leans, not by how much.
import { ROOT } from './headless.ts';
const K = await import(`${ROOT}/src/game/kit.ts`);
const { play } = await import('./playthrough.ts');
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const squad = process.argv[2] ?? 'issued', scn = arg('scn', 'room-clear-four'), [s0, s1] = arg('seeds', '1-6').split('-').map(Number);
const all = (f: (i: number) => void) => { for (let i = 1; i < K.KIT_MEMBERS; i++) f(i); };
const SQUADS: Record<string, () => void> = {
  issued: () => {}, quiet: () => { for (let i = 0; i < K.KIT_MEMBERS; i++) K.kitPreset(i, 'quiet'); }, loud: () => { for (let i = 0; i < K.KIT_MEMBERS; i++) K.kitPreset(i, 'loud'); },
  bare: () => all(i => K.kitSet(i, 'suppressed', false)), pistols: () => all(i => K.kitSet(i, 'weapon', 'pistol')),
  nolight: () => all(i => K.kitSet(i, 'light', false)), nonvg: () => all(i => K.kitSet(i, 'nvg', false)),
};
if (!SQUADS[squad]) { console.log(`kit-tally: no squad '${squad}' — one of ${Object.keys(SQUADS).join(', ')}`); process.exit(2); }
K.kitLoad(null, '?noslots'); SQUADS[squad]();   // (the free rows, so 'loud' stays the set these numbers were first counted with — one more stun canister on every man; under the pouches rule the sets are the table's loadouts: kit.ts kitLoadout)
let up = 0, of = 0, won = 0, secs = 0, n = 0, errors = 0;
for (let seed = s0; seed <= (s1 ?? s0); seed++) {
  const r: any = await play(scn, seed, 300);
  if (r.end === 'error') { errors++; console.log(`${scn}:${seed} ${squad} ERROR ${r.why.split('\n')[0]}`); continue; }
  n++; up += r.team; of += r.of; secs += r.t; if (r.end === 'taken' || r.end === 'rescued') won++;
  console.log(`${scn}:${seed} ${squad} ${r.end} ${r.t} s · team ${r.team}/${r.of} · hostiles left ${r.hostiles}/${r.hostilesOf}`);
}
console.log(`KIT-TALLY ${JSON.stringify({ squad, scn, seeds: `${s0}-${s1 ?? s0}`, runs: n, won, up, of, meanSecs: n ? +(secs / n).toFixed(1) : 0, errors, cards: K.KIT.members.slice(1).map((_m: unknown, k: number) => K.kitWords(k + 1)) })}`);
process.exit(errors ? 1 : 0);
