// `bun run tools/qa/wallpen-inventory.ts [level.json …]`: what each level holds that a round goes through (src/game/wallpen.ts thinThing) — metres of full-height
// partition against metres of full-height wall a round stops in, the lower thin things by stuff, wooden door leaves against steel. Reads the level as it loads;
// plays nothing. No file named = every level a listed mission plays on.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { standUp, ROOT } = await import('./headless.ts');
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { thinThing } = await import(`${ROOT}/src/game/wallpen.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
let files = process.argv.slice(2);
if (!files.length) { const seen = new Set<string>(); for (const m of ALL_MISSIONS as any[]) { if (m.offList) continue; seen.add(m.level ?? ''); } files = [...seen]; }
console.log('level · full-height walls: m a round goes through / m in all · lower thin things by stuff · door leaves wooden / steel');
for (const f of files) {
  const W: any = await quiet(() => standUp(f ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', f), 'utf8'))) } : {}));
  const g = W.game; let thin = 0, all = 0; const low: Record<string, number> = {};
  g.col.boxes.forEach((b: any, i: number) => {
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic | BoxFlag.Glass)) return; const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1]; const long = Math.max(b.h[0], b.h[2]) * 2, across = Math.min(b.h[0], b.h[2]) * 2; const t = thinThing(g, i);
    if (y0 <= 0.1 && y1 >= 2.2 && long >= 0.5 && across <= 0.6 && long > across * 2) { all += long; if (t) thin += long; }
    else if (t) low[t.stuff] = (low[t.stuff] ?? 0) + 1;
  });
  const steel = g.doors.list.filter((d: any) => d.def.steel).length;
  console.log(`${(f || 'office').padEnd(22)} ${thin.toFixed(0).padStart(4)} / ${all.toFixed(0).padStart(4)} m · ${Object.entries(low).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'} · ${g.doors.list.length - steel} / ${steel}`);
}
