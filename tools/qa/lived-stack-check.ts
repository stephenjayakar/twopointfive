#!/usr/bin/env bun
// LIVED-IN ROOMS: THE STACK FACES KEEP THEIR MARKS — the check lived-check.ts cannot make (it imports nothing of src/game, and holds only 1.1 m off a door's line).
//   bun run tools/qa/lived-stack-check.ts [scenario,scenario …] [--quiet] [--strict]        (default: every scenario of src/scene/scenarioList.ts SCENARIOS)
// A stack on a door stands along the wall either side of it, up to 3 m off the frame, and in a small room along the next wall too. Furniture there does not stop
// the level playing: the order is REFUSED 'no room on that door' and the team goes round by another door, which no run file shows as a fault of the room.
// What it does: each scenario is staged twice, as the page ships it (TPS_PROFILE=shipped), with the rooms on (TPS_LIVED=1) and off (=0), each in a process of
// its own (the switch is read once, at the stand-up), and every door, both faces, is asked for the marks of a stack of 1 … n of the staged teammates
// (orders.ts stackPosts — the squad's own rule, nothing repeated here). Per scenario:
//   FAIL  a face that dealt a mark for each man, each on the floor, with the rooms OFF deals none, fewer, or one off the floor with them ON (the face and the
//         bare marks are printed: the furniture to move stands on or beside them)
//   PASS  no such face (printed beside, not judged: the faces refused either way — the level's own walls — and the faces whose marks MOVED, each with its
//         bare and its furnished marks; --quiet = their names only)
// A MOVED FACE IS NOT HARMLESS. Furniture near a mark makes the deal fall to another of its layers: every man still gets a mark, on the floor, but elsewhere, and
// the walk to it can be the long one. The barracks' wash-room rack stood by the last places of the file four men take for the first door of the played way in:
// nothing was lost, this check was green, and the first entry came 4.3 s late (19.5 s against 15.3 bare). So: hold the faces on the way to a level's first
// doors EQUAL to the bare ones (--strict = exit 1 on any moved face, for a level meant to have none), and where one is left moved, play the level both ways and
// compare the first entry's time (TPS_LIVED=1|0 tools/qa/ships.ts --scn <id> --seeds 1-2 --json f: runs[].entries[0].t0 is the same on every seed).
// A scenario the staged level has no teammates on, or no doors, is said and not judged. NOT JUDGED AT ALL: lived PROPS (a stool, a loose crate: no deal asks
// about a prop, a man shoves it aside — keep them off the marks by hand), a stack dealt in play with a leaf standing open or a man on a mark (doortools.ts
// dealStack's own cases), the walk TO the marks, a mark the bare level already deals somewhere a man cannot use (only the nav grid's blocked cells are asked,
// in both arms alike), the quiet missions' one partner, the lessons. An authored mark under furniture refuses the scenario's start: that is 'did not stage'.
// Lines are `- PASS — …` / `- FAIL — …` (tools/qa/gate.sh counts them); exit 0 = all pass · 1 = a face lost its marks, a stage threw, the two arms staged
// different teams, or (--strict) a face moved · 2 = bad usage.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const argv = process.argv.slice(2);

type Faces = { id: string; men?: number; doors?: number; out?: Record<string, string>; error?: string };
const lost = (v: string | undefined) => v === undefined || v === 'none' || v === 'off the floor' || v === 'threw' || v.startsWith('short');

if (argv[0] === '--ask') {   // the child: one stand (the env says which), every scenario named, one JSON line each
  const { stage } = await import(`${ROOT}/tools/qa/bang-tally.ts`);
  const log = console.log;
  for (const id of (argv[1] ?? '').split(',')) {
    console.log = () => {}; let S: any;
    try { S = await stage(id, 1); } catch (e) { console.log = log; log(JSON.stringify({ id, error: String(e).slice(0, 160) })); continue; } finally { console.log = log; }
    const g = S.g, men = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead').slice(0, 4), out: Record<string, string> = {};
    for (const d of g.doors.list) for (const side of [1, -1]) for (let n = 1; n <= men.length; n++) { const key = `${d.def.name}${side > 0 ? '+' : '-'} ${n}`;
      let P: any[] | null; try { P = g.orders.stackPosts(d, side, men.slice(0, n)); } catch { out[key] = 'threw'; continue; }
      out[key] = !P ? 'none' : P.length !== n ? `short ${P.length}` : P.some(q => g.col.nav.isBlocked(q.pos[0], q.pos[2])) ? 'off the floor' : P.map(q => `(${q.pos[0].toFixed(2)}, ${q.pos[2].toFixed(2)})`).join(' '); }
    log(JSON.stringify({ id, men: men.length, doors: g.doors.list.length, out }));
  }
  process.exit(0);
}

const QUIET = argv.includes('--quiet'), STRICT = argv.includes('--strict'), names = argv.filter(a => !a.startsWith('--')), named = names[0];
if (names.length > 1 || argv.some(a => a.startsWith('--') && a !== '--quiet' && a !== '--strict')) { console.error('usage: bun run tools/qa/lived-stack-check.ts [scenario,scenario …] [--quiet] [--strict]     (several scenarios = ONE argument, comma separated)'); process.exit(2); }
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const ids: string[] = named ? named.split(',') : SCENARIOS.map((e: any) => e.id);
for (const id of ids) if (!SCENARIOS.some((e: any) => e.id === id)) { console.error(`no scenario '${id}' — ${SCENARIOS.map((e: any) => e.id).join(', ')}`); process.exit(2); }

const ask = (lived: '1' | '0') => Bun.spawn(['bun', 'run', import.meta.path, '--ask', ids.join(',')], { env: { ...process.env, TPS_PROFILE: 'shipped', TPS_LIVED: lived }, stdout: 'pipe', stderr: 'pipe' });
const ASK_CAP_MS = 20 * 60e3;   // a stand that hangs must not hang the gate: the child is killed and its scenarios read 'no answer'
const read = async (p: ReturnType<typeof ask>) => { const m = new Map<string, Faces>(), cap = setTimeout(() => p.kill(), ASK_CAP_MS);
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]); const code = await p.exited; clearTimeout(cap);
  for (const l of out.split('\n')) if (l.startsWith('{')) { const f = JSON.parse(l) as Faces; m.set(f.id, f); }
  if (code !== 0) console.error(`lived-stack-check: an asking process ended with ${code}${err.trim() ? ` — ${err.trim().split('\n').slice(-3).join(' | ').slice(0, 400)}` : ''}`);
  return m; };
const pOn = ask('1'), pOff = ask('0'), [on, off] = await Promise.all([read(pOn), read(pOff)]);

let failed = false;
console.log(`lived-stack-check · ${ids.length} scenario${ids.length === 1 ? '' : 's'} · rooms on against off · ${ROOT}`);
for (const id of ids) { const a = on.get(id), b = off.get(id);
  if (!a?.out || !b?.out) { failed = true; console.log(`- FAIL — ${id}: did not stage (${a?.error ?? b?.error ?? 'no answer'})`); continue; }
  const keys = Object.keys(b.out);
  if (a.men !== b.men) { failed = true; console.log(`- FAIL — ${id}: ${a.men} teammates staged with the rooms on, ${b.men} with them off: the two arms are not the same team`); continue; }
  if (!a.men || !keys.length) { console.log(`- ${id}: ${a.men} teammates, ${a.doors} doors: nothing to ask`); continue; }
  const gone = keys.filter(k => !lost(b.out![k]) && lost(a.out![k])), both = keys.filter(k => lost(b.out![k]) && lost(a.out![k])), moved = keys.filter(k => !lost(b.out![k]) && !lost(a.out![k]) && a.out![k] !== b.out![k]);
  if (gone.length) { failed = true; console.log(`- FAIL — ${id}: ${gone.length} of ${keys.length} stacks lose their marks to the furniture`);
    for (const k of gone) console.log(`    ${k} men: ${a.out[k] ?? 'not asked'} with the rooms on · bare ${b.out[k]}`); }
  else if (STRICT && moved.length) { failed = true; console.log(`- FAIL — ${id}: ${moved.length} of ${keys.length} stacks stand on other marks with the rooms on (--strict; none lost)`); }
  else console.log(`- PASS — ${id}: every stack the bare level deals is dealt with the rooms on (${keys.length} asked on ${a.doors} doors, 1 to ${a.men} men; ${both.length} refused either way, ${moved.length} moved)`);
  if (QUIET && moved.length) console.log(`    moved: ${moved.join(' · ')}`);
  else for (const k of moved) console.log(`    moved · ${k} men: ${a.out[k]} with the rooms on · bare ${b.out[k]}`);
}
process.exit(failed ? 1 : 0);
