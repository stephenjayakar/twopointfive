// Regenerate levels/office.json from the legacy procedural generator (src/scene/officeGen.ts buildOfficeProcedural): run it ONCE, convert the Level it
// returns to level data (src/scene/levelLoad.ts levelToData — ids, flag names, palette materials, editor groups), validate, and write the file in the
// canonical one-entity-per-line format (src/scene/levelData.ts serializeLevelData). Then prove the file is the level: parse it back, load it
// (loadLevel) and diff the result against the generator's Level field by field — the export refuses to write a file that does not reproduce it.
//   bun run tools/level-export.ts            write levels/office.json (+ print counts, sizes, digest)
//   bun run tools/level-export.ts --check    write nothing; exit 1 if levels/office.json is missing or differs from what the generator gives now
//   bun run tools/level-export.ts --out path write elsewhere
//   bun run tools/level-export.ts --relief   write levels/office-relief.json: the office WITHOUT the markings lane (no markings, face relief kept as boxes = main's level; ?level=relief)
//   bun run tools/level-export.ts --texel 0.02   write levels/office-t20.json: the marking bitmaps generated for a 2 cm base texel (the review page's world-resolution strip; ?levelFile=office-t20.json)
import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '..');
const { buildOfficeProcedural, OFFICE_PALETTE, OFFICE_FINISH } = await import(`${ROOT}/src/scene/officeGen.ts`);
const { levelToData, loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { validateLevelData, serializeLevelData, parseLevelData, levelDataDigest, structuralDiff, canonicalLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { FINISHES, BUILDING, GRASS_EDGE } = await import(`${ROOT}/src/game/floor.ts`);

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const RELIEF = argv.includes('--relief');
const TEXEL = argv.includes('--texel') ? parseFloat(argv[argv.indexOf('--texel') + 1]) : undefined;
const defaultOut = RELIEF ? 'levels/office-relief.json' : TEXEL !== undefined ? `levels/office-t${Math.round(TEXEL * 1000)}.json` : 'levels/office.json';
const OUT = resolve(ROOT, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : defaultOut);

// 1. the procedural level, with the editor group of every box recorded on the side
const trace = { groups: [] as string[] };
const level = buildOfficeProcedural(trace, RELIEF ? { markings: false, demote: false } : TEXEL !== undefined ? { texel: TEXEL } : {});
if (trace.groups.length !== level.boxes.length) throw new Error(`trace: ${trace.groups.length} groups for ${level.boxes.length} boxes`);

// 2. annotations the runtime Level has no slot for: the palette as materials, the footstep surface map (floor.ts owns it today — mirrored here and
//    cross-checked by tools/qa/level-probes.ts), one floor, the traceable world bounds
const materials: Record<string, { albedo: [number, number, number]; rough?: number; metal?: boolean }> = {};
{ const seen = new Map<string, string>();
  for (const [name, alb] of Object.entries(OFFICE_PALETTE as Record<string, [number, number, number]>)) {
    const k = alb.join(','); if (seen.has(k)) console.warn(`palette: '${name}' has the same albedo as '${seen.get(k)}' — boxes of that colour will be written as '${seen.get(k)}'`); else seen.set(k, name);
    materials[name] = { albedo: [alb[0], alb[1], alb[2]], ...((OFFICE_FINISH as Record<string, { rough: number; metal?: boolean }>)[name] ?? {}) };   // + the finish (rough / metal) the reflection pass reads, where the palette names one
  } }
const zoneIds = ['corridor_lino', 'lobby_stone', 'server_tile', 'breakroom_lino'];
if (FINISHES.length !== zoneIds.length) throw new Error('floor.ts FINISHES changed: name the zones here');
const surfaces = {
  building: { ...BUILDING }, grassEdge: GRASS_EDGE, inside: 'carpet', outside: 'asphalt', verge: 'grass',
  zones: FINISHES.map((f: any, i: number) => ({ id: zoneIds[i], mat: f.mat, x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, notes: f.room })),
};
const data = levelToData(level, {
  name: 'office',
  materials, surfaces, boxGroups: trace.groups,
  floors: [{ id: 'f0', name: 'ground floor', y: 0, ceiling: WORLD.ceilingY }],
  meta: { bounds: { min: [...WORLD.min], max: [...WORLD.max] }, generator: 'src/scene/officeGen.ts buildOfficeProcedural → tools/level-export.ts', notes: 'The night-shift office: one floor, box geometry only. Regenerated from the legacy generator until the editor (lane G1b) takes over; hand edits survive only if the generator is retired first.', ...(TEXEL !== undefined ? { markTexel: TEXEL } : {}) },
});

// 3. validate + serialize
const errs = validateLevelData(data);
if (errs.length) { console.error(`validateLevelData: ${errs.length} error(s)\n  ${errs.slice(0, 30).join('\n  ')}`); process.exit(1); }
const text = serializeLevelData(data);

// 4. the proof: text → LevelData → Level must be the generator's Level, field for field (and the data must survive its own round trip)
const parsed = parseLevelData(text);
const dataDiffs: string[] = []; const nData = structuralDiff(canonicalLevelData(data), parsed, dataDiffs);
const reloaded = loadLevel(parsed);
if (TEXEL !== undefined) (level as any).markTexel = TEXEL;   // (the file's meta carries it; the loader hands it back on the Level)
const levelDiffs: string[] = []; const nLevel = structuralDiff(level, reloaded, levelDiffs);
if (nData || nLevel) {
  console.error(`export REFUSED: the file would not reproduce the level — ${nLevel} Level diff(s), ${nData} data diff(s)`);
  for (const d of [...levelDiffs, ...dataDiffs].slice(0, 20)) console.error('  ' + d);
  process.exit(1);
}

// 5. report / write
const digest = levelDataDigest(parsed);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const counts = `boxes ${data.boxes.length} · props ${data.props.length} · lights ${data.lights.length} · switchables ${data.switchables.length} · doors ${data.doors.length} · routes ${data.routes.length} · chokepoints ${data.chokepoints.length} · clear plans ${data.plans.roomClear.length}${data.plans.breach ? ' + breach' : ''} · beacons ${data.beacons.length} · materials ${Object.keys(data.materials).length}`;
const inline = data.boxes.filter((b: any) => b.albedo).length, pinned = data.props.filter((p: any) => p.half || p.height).length;
console.log(`office → ${counts}`);
console.log(`  ${inline}/${data.boxes.length} boxes keep an inline albedo (no palette match); ${pinned}/${data.props.length} props pin their footprint; groups: ${[...new Set(trace.groups)].length}`);
console.log(`  ${text.split('\n').length - 1} lines, ${kb(text.length)} · digest ${digest} · reload identical to the generator (0 diffs)`);
if (CHECK) {
  if (!existsSync(OUT)) { console.error(`--check: ${OUT} does not exist`); process.exit(1); }
  const cur = readFileSync(OUT, 'utf8');
  if (cur !== text) {
    const curDigest = (() => { try { return levelDataDigest(parseLevelData(cur)); } catch { return 'unparseable'; } })();
    console.error(`--check: ${OUT} is STALE (file digest ${curDigest}, generator ${digest}) — run bun run tools/level-export.ts`); process.exit(1);
  }
  console.log(`--check: ${OUT} is up to date`);
} else {
  mkdirSync(resolve(OUT, '..'), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
