// ONE COMMAND FOR A MAP — given a map's name, everything that can be checked about it without a GPU, with a verdict:
//   bun run tools/qa/map-check.ts <name> [--seeds 1-24] [--jobs 4] [--cap 300] [--no-runs] [--json <prefix>]
//     <name>     a level's name (levels/<name>.json), its file, or its row's id in src/scene/scenarioList.ts
//     --seeds    the scripted four's seeds, the same range on Standard and on Hard (default 1-24: 48 runs, about three minutes on four cores).
//                24 seeds says 'it runs and ends'; a balance call wants 144 (tools/qa/lost-men.ts on the two JSON files reads the interval)
//     --no-runs  the structural checks only (a few seconds)
//     --json     keep the runs: <prefix>.standard.json and <prefix>.hard.json (playthrough.ts's own files, for lost-men.ts / threshold-tally.ts)
// WHAT IT CHECKS, in order (each line a PASS / FAIL / NOTE):
//   file       levels/<name>.json parses and validates (LevelData v1); its generator tools/levels/<name>.ts, when there is one, still gives that file
//   lint       src/editor/lint.ts (the editor's own): errors fail, warnings are counted
//   footsteps  the level's own `surfaces` block (game/floor.ts reads it: which footstep, how far it carries), or a note that it falls back to the office's map
//   size       it fits the world the renderer is built round (40 × 28 m, y ≤ 8 m), and the frame's tables: boxes, lights, characters, glass panes
//   structure  game/roomclear.ts checkStructure on the stood-up game: team start, marks, doors, defenders that fit
//   squads     scenarios.roomClear.squads against rebuild/enemy-squads/squad-format.md's rules (rooms in exactly one squad, ids that exist, rally and
//              arrival points a man can stand on, the men that fit) — the game ignores the block until the behaviour lands; this is the only check of it today
//   nav        every room reached on foot, by the guards' own path search, from every way in: the team's start, the level's spawn, both sides of every
//              outside door, and the far side of every door that leads into a held room from floor nobody holds
//   card       its row in THE ONE TABLE (scenarioList.ts SCENARIOS) is drawn on the start card by the real ui/menu.ts and its link stages the map with the
//              four; with no row yet: the row to paste (a NOTE — the runs below go by the file)
//   runs       the scripted four (tools/qa/playthrough.ts) over the seeds on Standard and on Hard: men up of the men sent (total, 24-seed blocks), how the
//              runs ended, the errors. A run that THREW fails the map; a run that stalled (the scripted commander ran out of things to do) is a NOTE with
//              its trace command, and a FAIL past one run in twelve; who wins never fails anything
//   exit 0 = every check passed · 1 = a FAIL (listed again at the end) · 2 = no such map / unknown flag (nothing run)
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { mapName, barricadeOf, loadMap } from './map-plan.ts';
import { entryOf } from './playthrough.ts';
import { El, withDom, missionRows } from './scenario-picker-probes.ts';

const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lintLevel, formatLint } = await import(`${ROOT}/src/editor/lint.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { floorAt } = await import(`${ROOT}/src/game/floor.ts`);
const { BoxFlag, MAX_GLASS } = await import(`${ROOT}/src/scene/boxes.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { MAX_CHARS } = await import(`${ROOT}/src/anim/characters.ts`);
const { MAX_QUERIES } = await import(`${ROOT}/src/render/probe.ts`);
const { SCENARIOS, entryOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const SCN: any = await import(`${ROOT}/src/scene/scenarios.ts`), { scenarioQuery } = SCN;
const { checkStructure } = await import(`${ROOT}/src/game/roomclear.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);

/** squad-format.md's ceiling on defenders alive at once, and what THIS checkout's game stages (roomclear.ts checkStructure): 8 at b8ffda2, 11 once the squads'
 *  schema commit is in the tree (scene/scenarios.ts SQUAD_MAX_MEN — its validator and checkStructure then check a squads block too: SCHEMA) */
const SQUAD_MAX_MEN = 11, SCHEMA = typeof SCN.SQUAD_MAX_MEN === 'number', STAGED_MAX_MEN: number = SCHEMA ? SCN.SQUAD_MAX_MEN : 8, TEAM = 5;
/** of the 4096 boxes a frame, what a map's statics may take: the rest is doors, furniture, every man's kit, debris, tracers (the office: 782 statics, ~450 moving at its loudest) */
const STATIC_BUDGET = 3300;
/** a stalled run is a NOTE with its trace command; more than one in this many of an arm's runs FAILS the map */
const STALL_ONE_IN = 12;

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--seeds', '--jobs', '--cap', '--no-runs', '--json'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const arg = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--seeds', '--jobs', '--cap', '--json'].includes(argv[i - 1])));
const name = arg ? mapName(arg) : null;
// (a row's id names its level AND that row: a pair's row is checked with the pair. Only room clears: the breach and the rescue have their own probes)
const rowArg: any = arg ? SCENARIOS.find((e: any) => e.id === arg) : null;
if (rowArg && rowArg.kind !== 'roomclear') { console.error(`map-check checks a room clear: '${arg}' is a ${rowArg.kind} row — give the level's name, or a room clear's id (${SCENARIOS.filter((e: any) => e.kind === 'roomclear').map((e: any) => e.id).join(', ')})`); process.exit(2); }
if (!name) { console.error(`usage: bun run tools/qa/map-check.ts <name> [--seeds 1-24] [--jobs 4] [--cap 300] [--no-runs] [--json <prefix>]${arg ? `\nno map '${arg}' — levels/<name>.json, or a room clear's id (${SCENARIOS.filter((e: any) => e.kind === 'roomclear').map((e: any) => e.id).join(', ')}); a path must be this checkout's levels/<name>.json` : ''}`); process.exit(2); }
const FILE = `${name}.json`, PATH = resolve(ROOT, 'levels', FILE);

const fails: string[] = []; let notes = 0;
const pass = (what: string, detail = '') => console.log(`- PASS — ${what}${detail ? ` · ${detail}` : ''}`);
const fail = (what: string, detail = '') => { fails.push(what); console.log(`- FAIL — ${what}${detail ? ` · ${detail}` : ''}`); };
const note = (what: string) => { notes++; console.log(`  NOTE — ${what}`); };
const verdict = (ok: boolean, what: string, detail = '') => (ok ? pass : fail)(what, detail);
const head = (s: string) => console.log(`\n=== map-check ${name}: ${s} ===`);
const quietly = async <T>(fn: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; } };
const f1 = (n: number) => n.toFixed(1);

// ───────────────────────────────────────────────────────────── file ──
head('file');
let data: any;
try { data = JSON.parse(readFileSync(PATH, 'utf8')); } catch (e) { fail(`levels/${FILE} is JSON`, (e as Error).message); console.log(`\n=== map-check ${name}: FAIL (the file does not read) ===`); process.exit(1); }
{ const v: string[] = validateLevelData(data).map((e: any) => typeof e === 'string' ? e : `${e.path ?? ''} ${e.msg ?? JSON.stringify(e)}`.trim());
  verdict(v.length === 0, `levels/${FILE} validates (LevelData v1)`, v.length ? `${v.length} error(s): ${v.slice(0, 6).join(' | ')}` : `${(data.boxes ?? []).length} boxes, ${(data.doors ?? []).length} doors, ${(data.lights ?? []).length} lights`);
  if (v.length) { console.log(`\n=== map-check ${name}: FAIL (the file does not validate; nothing else was run) ===`); process.exit(1); } }
// (a generator is tools/levels/<name>.ts, or one under another file name whose NAME is this map's: blocksquads.ts → block-squads)
const GEN = existsSync(resolve(ROOT, 'tools/levels', `${name}.ts`)) ? name : readdirSync(resolve(ROOT, 'tools/levels')).filter(f => f.endsWith('.ts') && f !== 'export.ts').find(f => new RegExp(`export const NAME\\s*=\\s*['"]${name}['"]`).test(readFileSync(resolve(ROOT, 'tools/levels', f), 'utf8')))?.replace(/\.ts$/, '');
if (GEN) {
  const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/levels/export.ts'), GEN, '--check'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const out = (await new Response(p.stdout).text() + await new Response(p.stderr).text()).trim().split('\n').pop() ?? ''; await p.exited;
  verdict(p.exitCode === 0, `its generator tools/levels/${GEN}.ts gives this file`, p.exitCode === 0 ? '' : out);
} else note(`no generator under tools/levels/ for '${name}': the file is its own source`);

// ───────────────────────────────────────────────────────────── lint ──
head('lint');
{ const side = PATH.replace(/\.json$/, '.lint.json'); let allow: any; if (existsSync(side)) { try { allow = JSON.parse(readFileSync(side, 'utf8')).allow; } catch { /* the CLI says so */ } }
  const r = lintLevel(data, { allow }), lines: string[] = formatLint(r);
  verdict(!r.errors, `level lint (the editor's): ${r.errors} error(s), ${r.warnings} warning(s)`, lines[0]);
  for (const l of lines.slice(1, r.errors ? 40 : 13)) console.log(`    ${l.trim()}`);
  if (!r.errors && lines.length > 13) console.log(`    … ${lines.length - 13} more line(s): bun run tools/qa/level-lint.ts levels/${FILE}`); }

// ───────────────────────────────────────────────────────────── stand it up ──
const level: any = loadMap(name);
const RC: any = level.scenarios?.roomClear, rooms: any[] = RC?.rooms ?? [], squads: any[] = RC?.squads ?? [];
let W: any, g: any, stoodErr = '';
try { W = await quietly(() => standUp({ uploadEvery: 4, level })); g = W.game; } catch (e: any) { stoodErr = String(e?.message ?? e); }

// ───────────────────────────────────────────────────────────── footsteps ──
head('footsteps (what is underfoot: which step sounds, and how far it carries to their ears)');
{ const S = data.surfaces, at = (p: number[]) => floorAt(p as any, S), mid = (r: any): number[] => [(r.bounds.x0 + r.bounds.x1) / 2, 0, (r.bounds.z0 + r.bounds.z1) / 2];
  const under = [...rooms.map(r => `${r.name} ${at(mid(r))}`), ...(RC?.team?.sam ? [`team start ${at(RC.team.sam)}`] : [])].join(' · ');
  if (!S) note(`no surfaces block: footsteps take the OFFICE's map on this level (carpet across x 4‥36, z 4‥24 with the office's lino, stone and tile patches; asphalt outside, grass where x or z < 3.2)${under ? ` — here: ${under}` : ''}. A map declares its own with a surfaces block: tools/levels/kit-yard.ts`);
  else {
    const B = S.building, lo = WORLD.min, hi = WORLD.max, dead = (S.zones ?? []).filter((z: any) => z.x1 < B.x0 || z.x0 > B.x1 || z.z1 < B.z0 || z.z0 > B.z1).map((z: any) => z.id);
    pass(`its own footstep map: ${S.inside} inside x ${B.x0}‥${B.x1}, z ${B.z0}‥${B.z1}, ${S.zones.length} zone(s) over it (${S.zones.map((z: any) => `${z.id} ${z.mat}`).join(', ') || 'none'}); ${S.outside} outside${S.grassEdge > 0 ? `, ${S.verge} where x or z < ${S.grassEdge}` : ''}`, under);
    verdict(B.x0 >= lo[0] && B.x1 <= hi[0] && B.z0 >= lo[2] && B.z1 <= hi[2], 'its building rectangle is inside the world');
    verdict(dead.length === 0, 'every zone touches the building rectangle (outside it only the ground materials are read)', dead.length ? `never read: ${dead.join(', ')}` : '');
  } }

// ───────────────────────────────────────────────────────────── size ──
head('size (the renderer is built round one 40 × 28 m floor: a map fits it today)');
{ const lo = WORLD.min, hi = WORLD.max, EPS = 0.011;
  const ext = (b: any): [number, number] => { const c = Math.abs(Math.cos(b.yaw ?? 0)), n = Math.abs(Math.sin(b.yaw ?? 0)); return [c * b.h[0] + n * b.h[2], n * b.h[0] + c * b.h[2]]; };   // (a yawed box's footprint)
  const out = level.boxes.filter((b: any) => { if (b.flags & BoxFlag.NoShadow) return false; const [ex, ez] = ext(b); return b.c[0] - ex < lo[0] - EPS || b.c[0] + ex > hi[0] + EPS || b.c[2] - ez < lo[2] - EPS || b.c[2] + ez > hi[2] + EPS; });
  verdict(out.length === 0, `every box inside x ${lo[0]}‥${hi[0]}, z ${lo[2]}‥${hi[2]} m (past the edge nothing is ray traced, walked or lit)`, out.length ? `${out.length} outside, the first at (${out[0].c.map((v: number) => +v.toFixed(2)).join(', ')})` : '');
  const tall = level.boxes.filter((b: any) => !(b.flags & BoxFlag.NoShadow) && b.c[1] + b.h[1] > hi[1] + EPS);
  verdict(tall.length === 0, `nothing above y ${hi[1]} m (the trace volume's top)`, tall.length ? `${tall.length} boxes` : '');
  const ceil = level.boxes.filter((b: any) => !(b.flags & BoxFlag.NoShadow) && b.c[1] - b.h[1] > WORLD.ceilingY + 0.5 && b.c[1] + b.h[1] <= hi[1]).length;
  if (ceil > 12) note(`${ceil} box(es) wholly above ${WORLD.ceilingY + 0.5} m: one storey is what the light culling, the bounce and the smoke know`);
  const statics = level.boxes.length;
  verdict(statics <= STATIC_BUDGET, `${statics} static boxes of ${WORLD.maxBoxes} a frame (statics and moving boxes share it; a map's share is ${STATIC_BUDGET})`);
  const panes = level.boxes.filter((b: any) => b.flags & BoxFlag.Glass).length;
  if (panes > MAX_GLASS) note(`${panes} glass panes: only the ${MAX_GLASS} nearest the camera are tinted, mirrored and cracked`); else pass(`${panes} glass panes of ${MAX_GLASS}`);
  const men = rooms.reduce((n: number, r: any) => n + (r.garrison ?? 0), 0), late = squads.reduce((n: number, q: any) => n + (q.arrive ? q.arrive.men ?? (q.arrive.spawn ?? []).length : 0), 0);
  const cap = RC?.maxMen ?? Math.max(men, 5), alive = Math.min(cap, men + late), bodies = TEAM + men + late;
  if (RC) {
    verdict(TEAM + alive <= MAX_CHARS, `${TEAM + alive} characters alive at most (Sam, the four, ${alive} of theirs) of ${MAX_CHARS} skinned`, `${men} in the rooms${late ? ` + ${late} arriving later` : ''}${RC.maxMen ? `, at most ${RC.maxMen} at once` : ''}`);
    if (bodies > MAX_CHARS) note(`${bodies} characters over the whole run, bodies included, against ${MAX_CHARS} skinned: the late squad needs the dead cleared before it comes (the behaviour's job, not the file's)`);
    if (TEAM + alive > 8) note(`${TEAM + alive} characters: only 8 cast ray shadows and show in reflections (the team first, then their men in spawn order)`);
  }
}

// ───────────────────────────────────────────────────────────── structure ──
head('structure');
if (stoodErr) fail('the game stands up on this level (headless)', stoodErr);
else if (!RC && level.scenarios?.quiet) { pass('the game stands up on this level (headless)', `${g.doors.list.length} doors, ${g.props.props.length} loose props`); note('no room clear structure: this is a quiet mission\'s level (scenarios.quiet) — its block is held by `bun run tools/qa/quiet-check.ts <name>.json`'); }
else if (!RC) fail('the level has a room clear structure (scenarios.roomClear)', 'none: add the block (see levels/block.json and tools/levels/block.ts)');
else {
  pass('the game stands up on this level (headless)', `${g.doors.list.length} doors, ${g.props.props.length} loose props, nav grid ${g.col.nav.W} × ${g.col.nav.H} cells of ${g.col.nav.cell} m`);
  const bad: string[] = checkStructure(g, RC);
  verdict(bad.length === 0, `the room clear's structure '${RC.name}': ${rooms.length} rooms, ${rooms.reduce((n, r) => n + r.garrison, 0)} defenders, ${rooms.reduce((n, r) => n + r.marks.length, 0)} marks, team start ${RC.team ? 'given' : 'MISSING'}`, bad.length ? `${bad.length} problem(s)` : '');
  for (const b of bad) console.log(`    ${b}`);
  const thin = rooms.filter(r => r.marks.length <= r.garrison).map(r => r.name);
  if (thin.length) note(`${thin.join(', ')}: no more marks than men, so every seed stands them on the same spots (give a room spare marks and a reseed deals another placement)`);
}

// ───────────────────────────────────────────────────────────── squads ──
head('squads (rebuild/enemy-squads/squad-format.md)');
if (!RC) note('no structure, so no squads');
else if (!squads.length) note('no scenarios.roomClear.squads block: the defenders play as one garrison, as on every map before squads');
else if (!g) fail('squads can be checked', 'the game did not stand up');
else {
  const bad: string[] = [], nav = g.col.nav, roomById = new Map(rooms.map(r => [r.id, r])), inB = (p: number[], B: any) => p[0] >= B.x0 && p[0] <= B.x1 && p[2] >= B.z0 && p[2] <= B.z1;
  const KEYS = ['id', 'name', 'rooms', 'rally', 'barricade', 'mayLeave', 'arrive'];
  const seen = new Map<string, string>(), sids = new Set<string>(), asides: string[] = [];
  const men = rooms.reduce((n, r) => n + r.garrison, 0), cap: number = RC.maxMen ?? 5;   // (maxMen absent = five, as checkStructure reads it)
  const doorSides = (d: any): number[][] => { const c = d.frameCentre, nx = -Math.sin(d.def.closedDir), nz = Math.cos(d.def.closedDir); return [[c[0] + nx * 0.9, 0, c[2] + nz * 0.9], [c[0] - nx * 0.9, 0, c[2] - nz * 0.9]]; };
  for (const q of squads) {
    const who = `squad '${q.id ?? '?'}'`;
    if (typeof q.id !== 'string' || !q.id) bad.push('a squad has no id'); else if (sids.has(q.id)) bad.push(`${who}: its id is used twice`); else sids.add(q.id);
    for (const k of Object.keys(q)) if (!KEYS.includes(k)) bad.push(`${who}: unknown field '${k}' (${KEYS.join(', ')})`);
    if (q.name !== undefined && (typeof q.name !== 'string' || !q.name)) bad.push(`${who}: name is a non-empty string`);
    if (q.mayLeave !== undefined && typeof q.mayLeave !== 'boolean') bad.push(`${who}: mayLeave is true or false`);
    if (q.rooms !== undefined && !Array.isArray(q.rooms)) bad.push(`${who}: rooms is a list of room ids`);
    const mine: string[] = Array.isArray(q.rooms) ? q.rooms : [];
    if (q.arrive) { if (mine.length) bad.push(`${who}: a squad that arrives later holds no rooms`); }
    else if (!mine.length) bad.push(`${who}: holds no room and does not arrive later`);
    for (const id of mine) { if (!roomById.has(id)) bad.push(`${who}: no room '${id}' (${rooms.map(r => r.id).join(', ')})`); else if (seen.has(id)) bad.push(`room '${id}' is in two squads (${seen.get(id)}, ${q.id})`); else seen.set(id, q.id); }
    const held = mine.map(id => roomById.get(id)).filter(Boolean) as any[];
    if (q.rally) { const p = q.rally;
      if (!Array.isArray(p) || p.length !== 3 || p[1] !== 0) bad.push(`${who}: rally is a floor point [x, 0, z]`);
      else { if (nav.isBlocked(p[0], p[2])) bad.push(`${who}: its rally (${p[0]}, ${p[2]}) is not floor a man can stand on`);
        if (!q.arrive && !held.some(r => inB(p, r.bounds))) bad.push(`${who}: its rally (${p[0]}, ${p[2]}) is in none of its rooms`); } }
    if (q.barricade !== undefined && !Array.isArray(q.barricade)) bad.push(`${who}: barricade is a list of door ids`);
    if (Array.isArray(q.barricade)) for (const id of q.barricade) { if (!g.doors.byName(id)) bad.push(`${who}: barricades '${id}', which is no door of the level`); else if (!held.some(r => r.doors.some((d: any) => d.id === id))) bad.push(`${who}: barricades '${id}', which is no door of its rooms`); }
    if (q.arrive) { const A = q.arrive, d = g.doors.byName(A.door);
      if (!d) bad.push(`${who}: arrives by '${A.door}', which is no door of the level`); else if (!d.def.exterior) asides.push(`${who} arrives by '${A.door}', which is not an outside door (exterior: true): the format means a late squad to come from outside the building; the validator does not hold it`);
      if (!Number.isInteger(A.men) || A.men < 1) bad.push(`${who}: arrive.men is its headcount, a whole number of 1 or more`);
      else if (A.men > cap) bad.push(`${who}: ${A.men} men can never fit maxMen ${cap}`);
      for (const k of Object.keys(A)) if (!['door', 'spawn', 'men'].includes(k)) bad.push(`${who}: unknown field 'arrive.${k}' (door, spawn, men)`);
      if (!Array.isArray(A.spawn) || !A.spawn.length) bad.push(`${who}: arrive.spawn is a list of floor points`);
      else { if (A.men > A.spawn.length) bad.push(`${who}: ${A.men} men arrive on ${A.spawn.length} spawn point(s)`);
        A.spawn.forEach((p: number[], i: number) => { const at = `${who} spawn ${i} (${p[0]}, ${p[2]})`;
          if (nav.isBlocked(p[0], p[2])) bad.push(`${at}: not floor a man can stand on`);
          else { if (rooms.some(r => inB(p, r.bounds))) bad.push(`${at}: inside a room to take (a late squad comes from outside them)`);
            if (d && !doorSides(d).some(s => !nav.isBlocked(s[0], s[2]) && nav.findPath(p, s))) bad.push(`${at}: no way on foot to its door '${A.door}'`); } }); } }
  }
  for (const r of rooms) if (!seen.has(r.id)) bad.push(`room '${r.id}' is in no squad (with a squads block, every room is in exactly one)`);
  if (RC.maxMen !== undefined && !(Number.isInteger(RC.maxMen) && RC.maxMen >= 1 && RC.maxMen <= SQUAD_MAX_MEN)) bad.push(`maxMen ${RC.maxMen}: a whole number of men, at most ${SQUAD_MAX_MEN}`);
  if (men > cap) bad.push(`${men} men in the rooms against maxMen ${RC.maxMen === undefined ? 'absent (five)' : cap}`);
  verdict(bad.length === 0, `${squads.length} squad(s): ${squads.map(q => `${q.name ?? q.id} (${q.arrive ? `arrives by ${q.arrive.door}, ${q.arrive.men ?? q.arrive.spawn?.length} men` : `${(q.rooms ?? []).join(' + ')}, ${(q.rooms ?? []).reduce((n: number, id: string) => n + (roomById.get(id)?.garrison ?? 0), 0)} men, wedges ${barricadeOf(q, rooms).join(', ') || 'nothing'}${q.mayLeave === false ? ', stays' : ''}`})`).join(' · ')}`, bad.length ? `${bad.length} problem(s)` : '');
  for (const b of bad) console.log(`    ${b}`);
  for (const a of asides) note(a);
  if (men > STAGED_MAX_MEN) note(`${men} defenders: this checkout's game stages at most ${STAGED_MAX_MEN} (roomclear.ts checkStructure, and the structure check above says so) — the squads' schema commit lifts it to ${SQUAD_MAX_MEN}`);
  note(SCHEMA ? 'this checkout\'s validator and checkStructure hold a squads block too (file and structure above): this section asks the same rules again, so it reads the same on a tree without them'
    : 'the game at this commit does not read squads, and its validator does not check them: this section and the plan picture are what hold the block to its format');
}

// ───────────────────────────────────────────────────────────── nav ──
head('nav (every room, from every way in, by the guards\' own path search)');
if (g && RC && rooms.length) {
  const nav = g.col.nav, plen = (p: number[][]) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]); return s; };
  const target = (r: any): number[] | null => { for (const m of r.marks) if (!nav.isBlocked(m.pos[0], m.pos[2])) return m.pos; const c = [(r.bounds.x0 + r.bounds.x1) / 2, 0, (r.bounds.z0 + r.bounds.z1) / 2]; return nav.isBlocked(c[0], c[2]) ? null : c; };
  const ways: { label: string; pos: number[] | null; why?: string }[] = [];
  if (RC.team) ways.push({ label: 'team start', pos: RC.team.sam });
  ways.push({ label: 'level spawn', pos: level.playerSpawn });
  const sides = (d: any): [number[], number[]] => { const c = d.frameCentre, nx = -Math.sin(d.def.closedDir), nz = Math.cos(d.def.closedDir); return [[c[0] + nx, 0, c[2] + nz], [c[0] - nx, 0, c[2] - nz]]; };
  const roomNames = new Set(rooms.map(r => r.name));
  // (the nav grid has no doors in it: a leaf is a thing a man opens. One the team can NEVER open — steel and locked: no pick row, a boot does nothing — is a wall to it)
  const shut = (d: any) => !!(d.def.steel && d.def.locked), sealedDoors = g.doors.list.filter(shut);
  const inDoor = (d: any, x: number, z: number) => Math.hypot(x - d.frameCentre[0], z - d.frameCentre[2]) < d.def.width * 0.5 + 0.3;
  const through = (path: number[][]) => { for (let i = 1; i < path.length; i++) { const A = path[i - 1], B = path[i], n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[2] - A[2]) / 0.25));
    for (let k = 0; k <= n; k++) { const x = A[0] + (B[0] - A[0]) * k / n, z = A[2] + (B[2] - A[2]) * k / n, d = sealedDoors.find((q: any) => inDoor(q, x, z)); if (d) return d; } } return null; };
  const dear = sealedDoors.length ? (ix: number, iz: number) => sealedDoors.some((d: any) => inDoor(d, (ix + 0.5) * nav.cell, (iz + 0.5) * nav.cell)) ? 1e4 : 1 : undefined;
  for (const d of g.doors.list) if (d.def.exterior && !shut(d)) sides(d).forEach((p, i) => ways.push({ label: `${d.def.name} (outside door, side ${'ab'[i]}${d.def.locked ? ', locked' : ''})`, pos: nav.isBlocked(p[0], p[2]) ? null : p, why: 'no floor a man can stand on within a metre of that side' }));
  for (const r of rooms) for (const rd of r.doors) { if (roomNames.has(rd.from)) continue; const d = g.doors.byName(rd.id); if (!d || d.def.exterior) continue;
    const inR = (p: number[]) => p[0] >= r.bounds.x0 && p[0] <= r.bounds.x1 && p[2] >= r.bounds.z0 && p[2] <= r.bounds.z1; const far = sides(d).find(p => !inR(p));
    if (far && !ways.some(w => w.label.startsWith(`${rd.id} `))) ways.push({ label: `${rd.id} (from ${rd.from})`, pos: nav.isBlocked(far[0], far[2]) ? null : far, why: `no floor on its ${rd.from} side` }); }
  const cols = rooms.map(r => r.name), wide = Math.max(...ways.map(w => w.label.length), 10);
  console.log(`    ${''.padEnd(wide)}  ${cols.map(c => c.slice(0, 12).padStart(12)).join(' ')}     (metres on foot; — = no way)`);
  let unreached = 0, sealed = 0; const lost: string[] = [];
  for (const w of ways) {
    if (!w.pos) { sealed++; console.log(`    ${w.label.padEnd(wide)}  ${w.why}`); continue; }
    const row = rooms.map(r => { const t = target(r); if (!t) return null; const p = nav.findPath(w.pos!, t, 6000, dear); return p && !through([w.pos!, ...p]) ? plen([w.pos!, ...p]) : null; });
    row.forEach((v, i) => { if (v === null) { unreached++; lost.push(`${w.label} → ${cols[i]}`); } });
    console.log(`    ${w.label.padEnd(wide)}  ${row.map(v => (v === null ? '—' : f1(v)).padStart(12)).join(' ')}`);
  }
  verdict(unreached === 0, `every room is reached on foot from every way in (${ways.length - sealed} ways in × ${rooms.length} rooms)`, unreached ? `${unreached} with no way: ${lost.slice(0, 8).join(' · ')}${lost.length > 8 ? ' …' : ''}` : '');
  const outside = g.doors.list.filter((d: any) => d.def.exterior), dead = outside.filter((d: any) => sides(d).every(p => nav.isBlocked(p[0], p[2])));
  if (dead.length) fail('every outside door has floor on at least one side', dead.map((d: any) => d.def.name).join(', '));
  else if (sealed) note(`${sealed} door side(s) with no floor a metre off the frame (the world's edge, a landing, a wall): not a way in, not counted`);
  if (sealedDoors.length) note(`${sealedDoors.map((d: any) => d.def.name).join(', ')}: steel and locked — never opens to the team, so it is no way in and no walk above goes through it`);
  { const locked = g.doors.list.filter((d: any) => d.def.locked && !shut(d)).map((d: any) => d.def.name); if (locked.length) note(`locked (the team picks or kicks them): ${locked.join(', ')}`); }
  if (!outside.length) note('no door is marked exterior: the ways in are the team\'s start and the doors off the floor nobody holds');
  { let far = 0, farWho = '', cut: string[] = [];   // room to room, both ways: where their men go when a room calls, and what a flank walks
    for (const A of rooms) for (const B of rooms) { if (A === B) continue; const a = target(A), b = target(B); if (!a || !b) continue; const p = nav.findPath(a, b);
      if (!p) cut.push(`${A.name} → ${B.name}`); else { const L = plen([a, ...p]); if (L > far) { far = L; farWho = `${A.name} → ${B.name}`; } } }
    if (rooms.length > 1) verdict(cut.length === 0, 'every room reaches every other room on foot', cut.length ? `no way: ${cut.slice(0, 8).join(' · ')}` : `the longest walk ${f1(far)} m (${farWho})`); }
  note(`the path search gives up after 6,000 nodes, here as in the game (the grid is ${nav.W} × ${nav.H} cells): on a map that fills the world a long way round can run out — a — above is a wall with no door, or a walk too far round`);
} else note('no structure stood up: nothing to walk');

// ───────────────────────────────────────────────────────────── card ──
head('start card (the one table: src/scene/scenarioList.ts SCENARIOS)');
let ROW: any = rowArg ?? SCENARIOS.find((e: any) => (e.level ?? null) === (name === 'office' ? null : FILE) && e.kind === 'roomclear' && e.squad === 4);
const listed = !!ROW;
if (!ROW && RC) {
  ROW = entryOf(FILE);   // (the row playthrough.ts plays an unlisted file by: what is staged here is what is run below)
  const title = RC.name[0].toUpperCase() + RC.name.slice(1), blurb = `${rooms.length} rooms held by ${rooms.reduce((n, r) => n + r.garrison, 0)}: take them with the four.`;
  note(`not on the start card: no row for this map in SCENARIOS. The one line to add (an id and a title of its own, a blurb of 20 to 140 characters):\n    { id: '${name}-four', title: '${title}', kind: 'roomclear', squad: 4, level: '${FILE}', untuned: true, blurb: '${blurb}' },\n    until then it plays by URL: ${scenarioQuery(ROW)}`);
}
if (!RC) note('no room clear on this level: no row to draw, nothing to stage');
else if (listed) {
  try {
    const drawn = await withDom('', async () => { const MS = await import(`${ROOT}/src/ui/missions.ts`); const host = new El('DIV'); MS.openMissions({ root: host as any }); const r = missionRows(host, MS.SOLO_NIGHT.id); MS.closeMissions(); return r; });
    const mine = drawn.find(r => r.id === ROW.id);
    verdict(!!mine && mine.href.endsWith(scenarioQuery(ROW)), `its row '${ROW.title}' is drawn on the mission list by ui/missions.ts`, mine ? `${drawn.length} rows · link ${mine.href} · ${mine.team}` : `${drawn.length} rows, none is '${ROW.id}'`);
    verdict(entryOfQuery(scenarioQuery(ROW)) === ROW, 'its link reads back as this row', scenarioQuery(ROW));
  } catch (e: any) { fail('the mission list draws', String(e?.message ?? e)); }
}
if (g && RC && ROW) {
  let why: string | null = 'did not run', team = 0, theirs = 0;
  try { const r = await quietly(() => startFromQuery(g, new URLSearchParams(scenarioQuery(ROW)))); why = r.why; W.step(1 / 60);
    team = g.nightBreach?.ops?.length ?? 0; theirs = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length; } catch (e: any) { why = String(e?.message ?? e); }
  const want = rooms.reduce((n, r) => n + r.garrison, 0);
  verdict(why === null && team === ROW.squad && theirs === want, `picked, it stages with ${ROW.squad === 4 ? 'the four' : 'the pair'}: ${team} teammates, ${theirs} defenders`, why ?? (theirs !== want || team !== ROW.squad ? `${ROW.squad} teammates and ${want} defenders expected` : scenarioQuery(ROW)));
  // (the light meter and the smoke sight lines are asked of the GPU through one probe of MAX_QUERIES a frame: what is asked past it goes unanswered that frame)
  try { const P = g.probe; let n = 0, most = 0; const late = new Set<string>(), q = P.query.bind(P), qs = P.querySegment.bind(P);
    P.query = (...a: any[]) => { if (++n > MAX_QUERIES) late.add(String(a[0]).replace(/\d+/g, '#')); return q(...a); }; P.querySegment = (...a: any[]) => { if (++n > MAX_QUERIES) late.add(String(a[0]).replace(/\d+/g, '#')); return qs(...a); };
    await quietly(() => { for (let i = 0; i < 30; i++) { n = 0; W.step(1 / 60); most = Math.max(most, n); } }); P.query = q; P.querySegment = qs;
    if (most > MAX_QUERIES) note(`${most} probe queries a frame once staged, against ${MAX_QUERIES}: the last ${most - MAX_QUERIES} asked go unanswered every frame on the page (here: ${[...late].join(', ')} — '#' a man's number; 'unitC# / unitH#' a man's own light meter, 'smoke#' a defender's sight line through smoke to Sam)${late.has('playerChest') || late.has('playerHead') ? ` · SAM'S OWN LIGHT METER IS AMONG THEM (game.ts asks it after every unit's): on the page his meter, and how visible he is to every eye, stop updating once the floor is this full` : ''}`);
    else pass(`${most} probe queries a frame once staged, of ${MAX_QUERIES} (the light meter and the smoke sight lines)`);
  } catch (e: any) { note(`probe queries not counted: ${String(e?.message ?? e).split('\n')[0]}`); }
  const L = g.engine?.lights?.lights; if (Array.isArray(L)) { const steady = L.filter((l: any) => l.ttl === undefined || l.ttl < 0).length;
    verdict(steady <= MAX_LIGHTS, `${steady} steady lights registered once staged, of ${MAX_LIGHTS} for the whole map (the level's, every man's torch; flashes and tracers take the rest)`);
    if (steady > MAX_LIGHTS - 6 && steady <= MAX_LIGHTS) note(`${MAX_LIGHTS - steady} light slot(s) left: a late squad's torches will not fit (spawnUnit refuses past ${MAX_LIGHTS}), and flashes and tracers are the first dropped`); }
}

// ───────────────────────────────────────────────────────────── runs ──
interface Arm { name: string; runs: any[]; exit: number }
const arms: Arm[] = [];
if (argv.includes('--no-runs')) { head('runs'); note('skipped (--no-runs)'); }
else if (!ROW) { head('runs'); note('no room clear to run'); }
else if (fails.length) { head('runs'); note(`not run: ${fails.length} check(s) above failed, and a map that does not stage tallies nothing`); }
else {
  const seeds = flag('--seeds') ?? '1-24', jobs = flag('--jobs') ?? '4', cap = flag('--cap') ?? '300', scn = listed ? ROW.id : FILE;
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('PT_')));   // (the plain scripted four: none of playthrough.ts's PT_* modes a shell may still carry)
  head(`runs (the scripted four, seeds ${seeds}, Standard then Hard — about 4 s a run on four cores)`);
  const set = (arm: string) => arm === 'hard' ? '{"DIFFICULTY":{"level":"hard"}}' : '{}';
  for (const arm of ['standard', 'hard']) {
    const out = flag('--json') ? `${resolve(process.cwd(), flag('--json')!)}.${arm}.json` : resolve(tmpdir(), `map-check-${process.pid}-${arm}.json`);
    rmSync(out, { force: true });   // (a file from an earlier check must not stand in for this one's)
    const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--scn', scn, '--seeds', seeds, '--jobs', jobs, '--cap', cap, '--set', set(arm), '--json', out], { cwd: ROOT, env, stdout: 'ignore', stderr: 'ignore' });
    await p.exited;
    let runs: any[] = []; if (p.exitCode === 0 || p.exitCode === 1) try { runs = JSON.parse(readFileSync(out, 'utf8')).runs; if (!flag('--json')) rmSync(out); } catch { /* no file: the arm failed whole */ }
    arms.push({ name: arm, runs, exit: p.exitCode ?? 1 });
  }
  const col = (s: string | number, n: number) => String(s).padStart(n);
  console.log(`    ${'defenders'.padEnd(10)}${col('men up', 12)}${col('of', 5)}${col('share', 8)}${col('runs won', 10)}${col('wiped', 7)}${col('stalled', 9)}${col('other', 7)}${col('errors', 8)}${col('mean s', 8)}   24-seed blocks (men up of men sent)`);
  for (const A of arms) {
    const up = A.runs.reduce((n, r) => n + r.team, 0), of = A.runs.reduce((n, r) => n + r.of, 0), won = A.runs.filter(r => r.end === 'taken').length, wiped = A.runs.filter(r => r.end === 'wiped').length;
    const errs = A.runs.filter(r => r.end === 'error'), stalls = A.runs.filter(r => r.end === 'stalled'), other = A.runs.length - won - wiped - errs.length - stalls.length;
    const blocks: string[] = []; for (let i = 0; i < A.runs.length; i += 24) { const B = A.runs.slice(i, i + 24); blocks.push(`${B[0].seed}‥${B[B.length - 1].seed}: ${B.reduce((n, r) => n + r.team, 0)}/${B.reduce((n, r) => n + r.of, 0)}`); }
    console.log(`    ${A.name.padEnd(10)}${col(up, 12)}${col(of, 5)}${col(of ? `${Math.round(100 * up / of)} %` : '—', 8)}${col(`${won}/${A.runs.length}`, 10)}${col(wiped, 7)}${col(stalls.length, 9)}${col(other, 7)}${col(errs.length, 8)}${col(A.runs.length ? f1(A.runs.reduce((n, r) => n + r.t, 0) / A.runs.length) : '—', 8)}   ${blocks.join(' · ')}`);
    const tr = (r: any) => `bun run tools/qa/playthrough.ts --trace ${scn}:${r.seed}${A.name === 'hard' ? ` --set '${set(A.name)}'` : ''}`;
    verdict(A.runs.length > 0 && errs.length === 0, `${A.name}: ${A.runs.length} runs, none threw`, A.runs.length ? errs.slice(0, 4).map(r => `seed ${r.seed}: ${String(r.why).split('\n')[0].slice(0, 160)}`).join(' | ') : `playthrough.ts left no result (exit ${A.exit})`);
    // (a STALL = the scripted commander ran out of things to do with men of theirs still up: one in a block is a place to look, a habit is a map he cannot finish)
    const most = Math.max(1, Math.floor(A.runs.length / STALL_ONE_IN));
    if (stalls.length > most) fail(`${A.name}: at most ${most} of ${A.runs.length} runs stall (one in ${STALL_ONE_IN})`, `${stalls.length} stalled: seeds ${stalls.map(r => r.seed).join(', ')}`);
    for (const r of stalls.slice(0, 6)) note(`${A.name} seed ${r.seed} stalled at ${r.t} s (${String(r.why).split('\n')[0].slice(0, 100)}), ${r.team}/${r.of} of the team up, ${r.hostiles}/${r.hostilesOf} of theirs: ${tr(r)}`);
    for (const r of errs.slice(0, 6)) console.log(`    ${tr(r)}`);
    const ends = [...new Set(A.runs.map(r => r.end))].filter(e => !['taken', 'wiped', 'error', 'stalled'].includes(e)); if (ends.length) note(`${A.name}: other endings: ${ends.map(e => `${e} ×${A.runs.filter(r => r.end === e).length}`).join(', ')}`);
  }
  const [S, H] = arms; if (S?.runs.length && H?.runs.length) {
    const by = new Map(H.runs.map(r => [r.seed, r])), d = S.runs.filter(r => by.has(r.seed)).map(r => by.get(r.seed).team - r.team), sum = d.reduce((a, b) => a + b, 0);
    let s = 0x2545f491; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    const boots = Array.from({ length: 2000 }, () => { let t = 0; for (let i = 0; i < d.length; i++) t += d[(rnd() * d.length) | 0]; return t; }).sort((a, b) => a - b);
    note(`Hard against Standard, seed for seed: ${sum >= 0 ? '+' : ''}${sum} men up over ${d.length} seeds (paired bootstrap 95 %: ${boots[50]} to ${boots[1949]}).${d.length < 144 ? ' Under 144 seeds this is scatter, not a balance reading.' : ''}`);
  }
}

console.log(`\n=== map-check ${name}: ${fails.length ? `FAIL (${fails.length}) — ${fails.join(' · ')}` : `ALL PASS${notes ? ` (${notes} note${notes === 1 ? '' : 's'})` : ''}`} ===`);
process.exit(fails.length ? 1 : 0);
