// A MAN WHO GOES FOR FURNITURE STAYS IN HIS ROOM — the check behind digin.ts `DIGIN.braceInRoom` (the brace GOAL rule).
// The fault it holds shut: 'behind the prop' for a carton against an outside wall is the far side of that wall, so the warehouse's dock man walked out into
// the lot for it, was planted there by the room fight, and held the building from outside it for the rest of the run (the squad then hunts an empty building).
//   bun run tools/qa/brace-room-check.ts [--scn warehouse-four] [--seeds 1-3] [--cap 60] [--off] [--hard]
// What it does: plays each seed as the page ships it (tools/qa/ships.ts --trace, PT_NOTES=1) for --cap seconds and reads the timeline. For every defender it
// follows `dig-in: digs in: room A` → a brace start (his shout 'against the door' / 'block that door', logged whether or not anybody hears it) → every
// `plants (…) room B` the room fight gives him until he is done with the furniture (his next dig-in line: wedged, to cover, set, shutting a door). B must be
// A each time: wherever his walk to the furniture and his haul to the door ended, they ended in the room he is digging in.
// Pinned to seeds it was read on: a man a squad's order takes elsewhere mid-haul would read as a failure (none in the default seeds).
//   --hard  ships.ts's --hard (the dig-in runs on every level then, not only the squads' ones)
//   --off   plays with the rule off (`--set '{"DIGIN":{"braceInRoom":false}}'`): the fault as it was — the check is expected to FAIL (exit 1), which is the
//           proof that it can
// exit 0 = every brace walk ended in the man's own room (and at least one man went for furniture) · 1 = one did not, a run errored, or nobody went for
// furniture (NO VERDICT: the check looked at nothing — a rule that stops every brace must not pass) · 2 = bad flags
import { resolve } from 'node:path';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--scn', '--seeds', '--cap', '--off', '--hard'].includes(a)) { console.error(`unknown flag ${a} (--scn --seeds --cap --off --hard)`); process.exit(2); }
const scn = flag('--scn') ?? 'warehouse-four', cap = flag('--cap') ?? '60', off = argv.includes('--off'), hard = argv.includes('--hard');
const seeds = (flag('--seeds') ?? '1-3').split(',').flatMap(s => { const m = /^(\d+)-(\d+)$/.exec(s); if (!m) return [Number(s)]; const out: number[] = []; for (let k = +m[1]; k <= +m[2]; k++) out.push(k); return out; });
if (!seeds.length || seeds.some(s => !Number.isFinite(s))) { console.error('bad --seeds'); process.exit(2); }

interface Row { seed: number; who: string; t: number; room: string; planted: string; at: number }
const out: Row[] = []; let digs = 0, braces = 0, walks = 0, failed = false;
const one = async (seed: number) => {
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--partial', '--trace', `${scn}:${seed}`, '--cap', cap, ...(hard ? ['--hard'] : []), ...(off ? ['--set', '{"DIGIN":{"braceInRoom":false}}'] : [])], { stdout: 'pipe', stderr: 'ignore', env: { ...process.env, PT_NOTES: '1' } });
  const text = await new Response(pr.stdout).text(); await pr.exited;
  if (!/\n\S+:\d+ (taken|wiped|stalled) at /.test(text)) { failed = true; console.log(`- FAIL — ${scn}:${seed} did not play (${text.trim().split('\n').pop()?.slice(0, 160)})`); return; }
  const room = new Map<string, string>(), bracing = new Map<string, { t: number; room: string }>();
  for (const line of text.split('\n')) {
    const m = /^\s*([\d.]+)\s+» ([^:]+): (.*)$/.exec(line); if (!m) continue;      // (the room fight's notes as they are made: in time order)
    const t = +m[1], who = m[2], what = m[3];
    const d = /^dig-in: digs in: room (\S+),/.exec(what); if (d) { room.set(who, d[1]); bracing.delete(who); digs++; continue; }
    if (/^dig-in: shouts \([^)]*\): (block that door\. get something against it!|get that against the door!)/.test(what)) { const r = room.get(who); if (r) { bracing.set(who, { t, room: r }); braces++; } continue; }
    const b = bracing.get(who); if (!b) continue;
    const p = /^plants \([^)]*\) room (\S+) /.exec(what);
    if (p) { walks++; if (p[1] !== b.room) { bracing.delete(who); out.push({ seed, who, t: b.t, room: b.room, planted: p[1], at: t }); } continue; }
    if (/^dig-in: (wedges|to cover on|set on|goes to shut|caught)/.test(what)) bracing.delete(who);   // done with the furniture
  }
};
const queue = [...seeds]; await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { for (let s = queue.shift(); s !== undefined; s = queue.shift()) await one(s); }));

console.log(`brace-room-check · ${scn} · seeds ${seeds.join(',')} · ${cap} s each · ${hard ? 'hard · ' : ''}the rule ${off ? 'OFF (the fault as it was)' : 'as shipped'}`);
console.log(`  ${digs} dig-ins, ${braces} men went for furniture, ${walks} of their walks ended in the run`);
for (const r of out) console.log(`- FAIL — seed ${r.seed}: ${r.who} went for furniture at ${r.t} s digging in room ${r.room} and was planted in room ${r.planted} at ${r.at} s`);
if (!walks) { failed = true; console.log('- NO VERDICT — nobody went for furniture and got anywhere: the check looked at nothing'); }
if (!out.length && !failed) console.log(`- PASS — every walk to the furniture and every haul ended in the man's own room (${walks} walks, ${braces} men)`);
process.exit(out.length || failed ? 1 : 0);
