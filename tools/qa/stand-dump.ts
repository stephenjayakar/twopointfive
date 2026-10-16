// WHAT A STAND-UP LEFT EVERY SWITCH AT: the whole knob registry (src/game/knobs.ts), Game.tune and the sandbox flags, spelled so that two dumps compare as JSON
// (a non-finite number, a function or a class instance is a word, not a hole). The page gives the same shape off window.__knobs (tools/qa/shipped-page.cjs), so a
// harness stand and the page's can be laid side by side — which is how the shipped profile (src/host/profile.ts) is held to the page.
//   bun run tools/qa/stand-dump.ts [--query 'levelFile=compound.json&roomclear&squad4'] [--out f.json]      (TPS_PROFILE=shipped in front = the shipped stand)
//   bun run tools/qa/stand-dump.ts --diff a.json b.json                                                     every row the two differ in; exit 1 if any
import { readFileSync, writeFileSync } from 'node:fs';

export type StandDump = { tables: Record<string, unknown>; tune: unknown; flags: Record<string, unknown> };
/** keep in step with the page's copy in tools/qa/shipped-page.cjs */
export const spell = (v: any): unknown => typeof v === 'number' && !Number.isFinite(v) ? `#${v}` : v === undefined ? '#undefined' : typeof v === 'function' ? '#fn' : Array.isArray(v) ? v.map(spell)
  : v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.keys(v).map(k => [k, spell(v[k])])) : v !== null && typeof v === 'object' ? `#${v.constructor && v.constructor.name}` : v;
export function standDump(g: any, registry: Record<string, unknown>): StandDump {
  return { tables: spell(registry) as Record<string, unknown>, tune: spell(g.tune), flags: { godMode: g.godMode, aiEnabled: g.aiEnabled, infiniteAmmo: g.infiniteAmmo, quietUtility: g.quietUtility, touring: g.touring } };
}
/** every leaf the two dumps differ in: [path, a, b] */
export function dumpDiff(a: StandDump, b: StandDump): [string, unknown, unknown][] {
  const rows: [string, unknown, unknown][] = [];
  const walk = (path: string, x: any, y: any) => {
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(path ? `${path}.${k}` : k, x[k], y[k]); }
    else if (JSON.stringify(x) !== JSON.stringify(y)) rows.push([path, x, y]);
  };
  walk('', a.tables, b.tables); walk('tune', a.tune, b.tune); walk('flags', a.flags, b.flags);
  return rows;
}

if (import.meta.main) {
  const argv = process.argv.slice(2), arg = (n: string) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1] ?? null; };
  if (argv[0] === '--diff') {
    const [a, b] = [argv[1], argv[2]].map(f => JSON.parse(readFileSync(f, 'utf8')) as StandDump), rows = dumpDiff(a, b);
    for (const [p, x, y] of rows) console.log(`${p}\t${JSON.stringify(x)}\t${JSON.stringify(y)}`);
    console.log(`${rows.length} rows differ`); process.exit(rows.length ? 1 : 0);
  }
  // --profile shipped | frozen: THIS run's stand whatever the invoking shell exported — every word the stands read is cleared first (src/host/standEnv.ts), which must
  // happen before the game loads (the dynamic imports below), since some modules read their word as they load
  { const prof = arg('--profile'); if (prof !== null) { if (prof !== 'shipped' && prof !== 'frozen') { console.error(`--profile ${prof}: shipped | frozen`); process.exit(2); }
      const { STAND_ENV } = await import('../../src/host/standEnv.ts'); for (const k of STAND_ENV) delete process.env[k]; process.env.TPS_PROFILE = prof; } }
  const { standUp, ROOT } = await import('./headless.ts');
  const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
  const query = arg('--query') ?? '', out = arg('--out');
  let level: any; { const lf = new URLSearchParams(query).get('levelFile'); if (lf) {   // (as playthrough.ts levelOfFile and the page: an office-family file gets the office's script)
    const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
    const data = parseLevelData(readFileSync(`${ROOT}/levels/${lf}`, 'utf8')); level = isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); } }
  const log = console.log; console.log = () => { /* the stand-up's own lines */ };
  const W = await standUp(level ? { level } : {});
  if (query) { const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const r = await startFromQuery(W.game, new URLSearchParams(query)); if (r?.why) { console.log = log; console.error(`start refused — ${r.why}`); process.exit(2); } }
  console.log = log;
  const d = { profile: process.env.TPS_PROFILE ?? 'frozen', query, ...standDump(W.game, knobRegistry()) };
  if (out) { writeFileSync(out, JSON.stringify(d, null, 1)); console.log(`${out}: ${Object.keys(d.tables).length} tables`); } else console.log(JSON.stringify(d, null, 1));
  process.exit(0);
}
