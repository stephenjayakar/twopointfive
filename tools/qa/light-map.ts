// LIGHT-MAP: an ASCII picture of how LIT a standing man is across a level's floor, as the headless stand-in for the light meter has it (guards.ts
// lightEstimateAt → Game.visibilityOf: direct light only, no moon, no bounce — what tools/qa/lesson-run.ts and solo-night.ts feed the player's meter).
//   bun run tools/qa/light-map.ts <name>[.json] [--step 0.5]
// One character a cell: '#' = not floor a man can stand on · 0‥9 = the meter in tenths ('0' under 0.1 … '9' ≥ 0.9) · letters = the first waypoints of each route.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from './headless';
const ROOT = resolve(import.meta.dir, '../..');
const argv = process.argv.slice(2), name = (argv.find(a => !a.startsWith('--')) ?? '').replace(/\.json$/, ''), stepAt = argv.indexOf('--step'), S = stepAt >= 0 ? Number(argv[stepAt + 1]) : 1;
if (!name) { console.error('usage: bun run tools/qa/light-map.ts <name> [--step 0.5]'); process.exit(2); }
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const log = console.log; console.log = console.warn = () => { };
const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8'))), seed: 1 });
W.step(1 / 60); console.log = log;
const g = W.game, nav = g.col.nav;
const marks = new Map<string, string>(); g.level.routes.forEach((r: any, i: number) => r.points.forEach((p: number[]) => marks.set(`${Math.round(p[0] / S)},${Math.round(p[2] / S)}`, String.fromCharCode(97 + i))));
log(`${name}: the light on a standing man, tenths of the meter, ${S} m a cell (x → , z ↓); routes ${g.level.routes.map((r: any, i: number) => `${String.fromCharCode(97 + i)}=${r.name}`).join(' ') || 'none'}`);
log('      ' + Array.from({ length: Math.floor(40 / S) + 1 }, (_, i) => (i * S) % 5 === 0 ? String((i * S / 5) % 10 | 0) : ' ').join('') + '   (a digit every 5 m: 0 5 10 …)');
for (let z = 0; z <= 28; z += S) { let row = '';
  for (let x = 0; x <= 40; x += S) { const m = marks.get(`${Math.round(x / S)},${Math.round(z / S)}`);
    if (nav.isBlocked(x, z)) { row += '#'; continue; }
    const v = g.visibilityOf(Math.max(lightEstimateAt(g, [x, 1.2, z]), lightEstimateAt(g, [x, 1.6, z])));
    row += m ?? String(Math.min(9, Math.floor(v * 10))); }
  log(`${z.toFixed(1).padStart(5)} ${row}`); }
