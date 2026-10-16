// What a PLAYED firefight does to the level: scripted play-throughs (tools/qa/playthrough.ts play(), the commander on the floor, chaos 0.5, THE ONE SWITCH raised
// here, PT_DESTR=0 leaves it off) with the wall-breaking engine's own counters and its change feed's rows printed after each.
//   bun run tools/qa/wallbreak-play.ts <scenario id>:<seed> [<scenario id>:<seed> …]        e.g. block-squads:3 compound-four:1
import { ROOT } from './headless.ts';
const { play } = await import('./playthrough.ts');
const { WALL_STATS, WALL_LOG } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); DESTRUCTION.on = process.env.PT_DESTR !== '0';   // (playthrough.ts raises it only as the program)
const specs = process.argv.slice(2).filter(a => !a.startsWith('--')); if (!specs.length) specs.push('block-squads:1');
for (const spec of specs) {
  for (const k of Object.keys(WALL_STATS)) (WALL_STATS as Record<string, number>)[k] = 0; (WALL_LOG as string[]).length = 0;
  const [scn, seed] = spec.split(':'); const r = await play(scn, Number(seed ?? 1), 300, false, {});
  const rows: Record<string, number> = {}; for (const l of WALL_LOG as string[]) { const w = l.split(' '); const k = `${w[1]} by ${w[2]}`; rows[k] = (rows[k] ?? 0) + 1; }
  console.log(`WALLPLAY ${spec} ${r.end} at ${r.t} s · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} · ${JSON.stringify(WALL_STATS)} rows ${JSON.stringify(rows)}`);
}
process.exit(0);
