// A MAN WHO LEAVES A LOST ROOM STAYS IN THE BUILDING — the check behind roomfight.ts `ROOMFIGHT.fallBackIn`.
// The fault it holds shut: a defender who gives his room up goes out by a door nothing has come at and holds it from the far side. For the warehouse's dock
// that door was dock_s, whose far side is the lot: he was planted out there and held the building from outside it (2 of 48 runs with a searching commander).
//   bun run tools/qa/fallback-in-check.ts [--scn warehouse-four] [--level levels/warehouse.json] [--seeds 3,7 | 1-12] [--want 2] [--upto 24 | 48 with --off] [--cap 100] [--off]
// What it does: plays each seed as the page ships it with the commander who searches (tools/qa/ships.ts --trace, PT_SEARCH=1, PT_NOTES=1) and reads every
// `falls back through <door> to <x>,<z>` note: the spot he was sent to hold the door from. Read against the level FILE (not the game's own test), that spot
// must not be out of the building: outside the rectangle round the structure's rooms (scenarios.roomClear.rooms' bounds) with no roof slab over it (a box
// at least 2 m across whose underside is 2.5 m up or more).
//   --level  the level file, when the scenario's name is not its file's (block-squads → levels/block-squads.json is found; the office's scenarios have no
//            structure in a file and cannot be asked here)
//   --off   plays with the rule off (`--set '{"ROOMFIGHT":{"fallBackIn":false}}'`): the fault as it was — expected to FAIL (exit 1), the proof that it can
// The seeds: NONE ARE NAMED. Which deals hold a fall-back moves with every change to the fight (the four once named here — 1, 26, 40, 42 — stopped holding
// one, and the check then looked at nothing), so with no --seeds it FINDS its own, as haulhome-check.ts does: seeds 1, 2, 3 … three at a time until `--want`
// men have fallen back through a door (under --off: until one has fallen back out of the building), `--upto` seeds at the most. The seeds that held one are
// printed, so a rerun can name them. --seeds plays exactly those and nothing else. (When this was written the search stopped at seed 15 with the rule on —
// fall-backs in 6 and 14 — and at seed 36 with it off: Tango 8 out through dock_n to the lot in seed 35, where the rule on keeps both of that run's fall-backs
// inside. Off, the fault is rarer than a fall-back, hence the longer reach.)
// exit 0 = somebody fell back and nobody fell back out of the building · 1 = somebody did, a run errored, or nobody fell back at all (NO VERDICT) · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--scn', '--level', '--seeds', '--want', '--upto', '--cap', '--off'].includes(a)) { console.error(`unknown flag ${a} (--scn --level --seeds --want --upto --cap --off)`); process.exit(2); }
const scn = flag('--scn') ?? 'warehouse-four', cap = flag('--cap') ?? '100', off = argv.includes('--off');
const levelPath = resolve(import.meta.dir, '../..', flag('--level') ?? `levels/${scn.replace(/-(four|pair)$/, '')}.json`);
const asked = flag('--seeds'), want = Number(flag('--want') ?? 2), upto = Number(flag('--upto') ?? (argv.includes('--off') ? 48 : 24));
const seeds = (asked ?? `1-${upto}`).split(',').flatMap(s => { const m = /^(\d+)-(\d+)$/.exec(s); if (!m) return [Number(s)]; const out: number[] = []; for (let k = +m[1]; k <= +m[2]; k++) out.push(k); return out; });
if (!(want >= 1) || !(upto >= 1)) { console.error('bad --want / --upto'); process.exit(2); }
if (!seeds.length || seeds.some(s => !Number.isFinite(s))) { console.error('bad --seeds'); process.exit(2); }

interface BoxRow { c: [number, number, number]; h: [number, number, number] }
let level: { boxes?: BoxRow[]; scenarios?: { roomClear?: { rooms?: { bounds: { x0: number; x1: number; z0: number; z1: number } }[] } } };
try { level = JSON.parse(readFileSync(levelPath, 'utf8')); } catch { console.error(`cannot read ${levelPath}`); process.exit(2); }
const rooms = level.scenarios?.roomClear?.rooms ?? [];
if (!rooms.length) { console.error(`${levelPath} has no structure (scenarios.roomClear.rooms)`); process.exit(2); }
const x0 = Math.min(...rooms.map(r => r.bounds.x0)), x1 = Math.max(...rooms.map(r => r.bounds.x1)), z0 = Math.min(...rooms.map(r => r.bounds.z0)), z1 = Math.max(...rooms.map(r => r.bounds.z1));
const roofs = (level.boxes ?? []).filter(b => b.c[1] - b.h[1] >= 2.5 && b.h[0] >= 1 && b.h[2] >= 1);
const outside = (x: number, z: number) => !(x >= x0 && x <= x1 && z >= z0 && z <= z1) && !roofs.some(b => Math.abs(x - b.c[0]) <= b.h[0] && Math.abs(z - b.c[2]) <= b.h[2]);

interface Row { seed: number; who: string; t: number; door: string; at: string }
const bad: Row[] = [], held = new Set<number>(), played: number[] = []; let falls = 0, failed = false;
const one = async (seed: number) => {
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--partial', '--trace', `${scn}:${seed}`, '--cap', cap, ...(off ? ['--set', '{"ROOMFIGHT":{"fallBackIn":false}}'] : [])], { stdout: 'pipe', stderr: 'ignore', env: { ...process.env, PT_NOTES: '1', PT_SEARCH: '1' } });
  const text = await new Response(pr.stdout).text(); await pr.exited;
  if (!/\n\S+:\d+ (taken|wiped|stalled) at /.test(text)) { failed = true; console.log(`- FAIL — ${scn}:${seed} did not play (${text.trim().split('\n').pop()?.slice(0, 160)})`); return; }
  for (const line of text.split('\n')) {
    const m = /^\s*([\d.]+)\s+» ([^:]+): falls back through (\S+)(?: to (-?[\d.]+),(-?[\d.]+))?/.exec(line); if (!m) continue;   // (the room fight's notes as they are made)
    if (m[4] === undefined) { failed = true; console.log(`- FAIL — ${scn}:${seed}: this build's fall-back note carries no spot (a build from before the rule)`); return; }
    falls++; held.add(seed); if (outside(+m[4], +m[5])) bad.push({ seed, who: m[2], t: +m[1], door: m[3], at: `${m[4]}, ${m[5]}` });
  }
};
// Three at a time, a whole wave before the next is asked for: which seeds a search plays never hangs on which run came home first.
const found = () => asked === undefined && (off ? bad.length >= 1 : falls >= want);
for (let i = 0; i < seeds.length && !found(); i += 3) { const wave = seeds.slice(i, i + 3); played.push(...wave); await Promise.all(wave.map(one)); }

console.log(`fallback-in-check · ${scn} · ${asked === undefined ? `searched seeds ${played[0]}‥${played[played.length - 1]}` : `seeds ${played.join(',')}`} · ${cap} s each · the rule ${off ? 'OFF (the fault as it was)' : 'as shipped'}`);
console.log(`  ${falls} men fell back through a door${held.size ? ` (seeds ${[...held].sort((a, b) => a - b).join(',')})` : ''}`);
for (const r of bad) console.log(`- FAIL — seed ${r.seed}: ${r.who} fell back through ${r.door} at ${r.t} s to (${r.at}), out of the building`);
if (!falls) { failed = true; console.log(`- NO VERDICT — nobody fell back through a door in ${played.length} runs: the check looked at nothing${asked === undefined ? ' (--upto asks more seeds)' : ''}`); }
else if (off && !bad.length && !failed) console.log(`  the rule is off and nobody fell back out of the building: these ${played.length} runs do not show the fault`);
if (!bad.length && !failed) console.log(`- PASS — nobody fell back out of the building (${falls} fall-backs)`);
process.exit(bad.length || failed ? 1 : 0);
