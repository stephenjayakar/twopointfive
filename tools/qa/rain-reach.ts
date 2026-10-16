// WHERE A LAMP'S REACH MASK LIGHTS RAIN IT HAS NO LINE TO (a measuring tool; the maintainer, 10-11, the glasshouse at night: "looks like some light leakage for the
// low res rain"). The rain is lit unshadowed by every light whose reach mask (render/reach.ts) holds the streak's 1 m cell, and the mask counts every DOOR as standing
// open: behind a shut outside door a room's bulb lit a wedge of rain out in the yard. volumetrics.wgsl rainLight now asks one shadow ray where the mask is not
// sure (level 1 / 2 cells, carried lights, flashes: frame.ts rainShadowConfig, ?norainshadow = as it was). This prints, per light of a level stood up headless:
// the cells its mask reaches, how many of those are under the open sky, and how many of THOSE have no sight line to the lamp at 0.2 / 1.5 / 3.5 m with the doors as
// they stand (statics + leaves, glass passing) — the cells the ray now darkens. `--map` = the plan (digit = the level on an open-sky cell, + = reached under a
// roof, . = open sky not reached).   bun run tools/qa/rain-reach.ts [--map] [level.json]      (reads only; no verdict)
import { standUp, ROOT } from './headless.ts';
const { reachLevel } = await import(`${ROOT}/src/render/reach.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const l0 = console.log; console.log = () => {}; console.warn = () => {}; console.error = () => {};
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { readFileSync } = await import('node:fs');
const FILE = process.argv.find(a => a.endsWith('.json')) ?? 'glasshouse.json';
const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${FILE}`, 'utf8'))) });
console.log = l0;
const g = W.game ?? W.g; const eng = g.engine;
const lights = (eng.lights?.lights ?? eng.lights?.list ?? []) as any[];
console.log('lights', lights.length, 'ceilingY', WORLD.ceilingY);
const GW = WORLD.gridW, GH = WORLD.gridH;
const up = (x: number, z: number) => g.col.solidBlocked([x, 0.3, z], [x, 9, z]);
for (const [i, l] of lights.entries()) {
  if (!l.reach) { console.log(i, 'kind', l.kind, 'pos', l.pos?.map((v: number) => +v.toFixed(2)), 'NO MASK', l.transient ? 'transient' : ''); continue; }
  let out = 0, tot = 0, outBlocked = 0;
  const rows: string[] = [];
  for (let z = 0; z < GH; z++) { let s = '';
    for (let x = 0; x < GW; x++) { const lv = reachLevel(l.reach, z * GW + x); const sky = !up(x + 0.5, z + 0.5);
      if (lv) { tot++; if (sky) { out++; if (g.col.segmentBlocked(l.pos, [x + 0.5, 1.5, z + 0.5]) && g.col.segmentBlocked(l.pos, [x + 0.5, 3.5, z + 0.5]) && g.col.segmentBlocked(l.pos, [x + 0.5, 0.2, z + 0.5])) outBlocked++; } }
      s += lv ? (sky ? String(lv) : '+') : (sky ? '.' : ' '); }
    rows.push(s); }
  console.log(i, 'kind', l.kind, 'pos', l.pos.map((v: number) => +v.toFixed(2)), 'I', l.intensity ?? l.color, 'range', l.range, 'cells', tot, 'open-sky cells reached', out, 'of those with no sight line at 0.2 / 1.5 / 3.5 m', outBlocked);
  if (process.argv.includes('--map') ) console.log(rows.join('\n'));
}
process.exit(0);
