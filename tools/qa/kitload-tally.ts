// What the WEIGHT of a squad's kit does to a run, counted (src/game/kitload.ts): the scripted player of playthrough.ts over a few seeds, every card cut one way.
//   TPS_PROFILE=shipped bun run tools/qa/kitload-tally.ts <issued|lean|light|heavy> [--scn room-clear-four] [--seeds 1-6]
//   issued   every card as it is issued
//   lean     the long guns kept, every pouch and the big slot empty
//   light    a pistol each and nothing else
//   heavy    the long guns, every pouch full (stun and door charges; yours: smoke), a hammer in every big slot
// Put TPS_KITLOAD=0 in front for the same cards with the rule off: the two lines side by side are what the weight alone does (the kit itself is in both).
// One line per run and a total: runs taken, men up of men staged, the mean seconds. A handful of seeds says which way a load leans, not by how much.
import { ROOT } from './headless.ts';
const K = await import(`${ROOT}/src/game/kit.ts`);
const L = await import(`${ROOT}/src/game/kitload.ts`);
const { play } = await import('./playthrough.ts');
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const squad = process.argv[2] ?? 'issued', scn = arg('scn', 'room-clear-four'), [s0, s1] = arg('seeds', '1-6').split('-').map(Number);
const empty = { smoke: 0, bangs: 0, frags: 0, shells: 0, charges: 0, cams: 0, walls: 0, wand: false, big: 'none' };
const cut = (f: (i: number) => Record<string, unknown>) => { for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = { ...K.kitDefault(i), ...f(i) }; };
const SQUADS: Record<string, () => void> = {
  issued: () => {}, lean: () => cut(() => ({ ...empty, weapon: 'rifle' })), light: () => cut(() => ({ ...empty, weapon: 'pistol' })),
  heavy: () => cut(i => ({ ...empty, weapon: 'rifle', big: 'hammer', ...(i ? { bangs: 2, charges: 2 } : { smoke: 4 }) })),
};
if (!SQUADS[squad]) { console.log(`kitload-tally: no squad '${squad}' — one of ${Object.keys(SQUADS).join(', ')}`); process.exit(2); }
K.kitLoad(null, ''); SQUADS[squad]();
let up = 0, of = 0, won = 0, secs = 0, n = 0, errors = 0;
for (let seed = s0; seed <= (s1 ?? s0); seed++) {
  const r: any = await play(scn, seed, 300);
  if (r.end === 'error') { errors++; console.log(`${scn}:${seed} ${squad} ERROR ${r.why.split('\n')[0]}`); continue; }
  n++; up += r.team; of += r.of; secs += r.t; if (r.end === 'taken' || r.end === 'rescued') won++;
  console.log(`${scn}:${seed} ${squad} ${r.end} ${r.t} s · team ${r.team}/${r.of} · hostiles left ${r.hostiles}/${r.hostilesOf}`);
}
const scores = K.KIT.members.map((m: unknown, i: number) => { const s = L.loadOf(i, m); return `${s.mob.toFixed(2)}/${s.con.toFixed(2)}`; });
console.log(`KITLOAD-TALLY ${JSON.stringify({ squad, rule: process.env.TPS_KITLOAD !== '0' && L.KITLOAD.on, scn, seeds: `${s0}-${s1 ?? s0}`, runs: n, won, up, of, meanSecs: n ? +(secs / n).toFixed(1) : 0, errors, scores })}`);
process.exit(errors ? 1 : 0);
