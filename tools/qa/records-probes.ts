// The records office (levels/records.json ← tools/levels/records.ts) checked headless, with counts:
//   bun run tools/qa/records-probes.ts [data|boot|stacks|structure|walk|all] [--overlay out.json]
//   data       the file is what the generator gives now, validates, and stays small beside the office
//   boot       the whole Game stands up on it and steps
//   stacks     every door, both faces: the pair's stack marks (orders.ts stackPosts — a man on each jamb, or a file), and where a charge would be set from, the
//              stand-off (doortools.ts standoffPosts)
//   structure  the room clear's rooms / doors / marks for this level (RECORDS_STRUCTURE) against roomclear.ts checkStructure, the authored placement's facing
//              rule (records: one man per door), and every mark's distance to its door against the charge's reach
//   walk       the real player, on the puppet's strings, walked along nav paths into every room and pushed through every door from both faces (the one lock
//              is asserted first, then taken off for the walk)
// A line per check, `- PASS —` / `- FAIL —`; exit 1 on any FAIL. `--overlay` writes rooms + marks + stack posts for tools/qa/level-plan.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { isLived } from '../../src/scene/lived.ts';

type V3 = [number, number, number];
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { RECORDS_ROOMS, RECORDS_STRUCTURE, RECORDS_START } = await import(`${ROOT}/tools/levels/records.ts`);
const { checkStructure, placeDefenders } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);

const FILE = `${ROOT}/levels/records.json`;
const argv = process.argv.slice(2);
const which = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--overlay') ?? 'all';
const overlayOut = argv.includes('--overlay') ? argv[argv.indexOf('--overlay') + 1] : null;
let fails = 0, checks = 0;
const check = (ok: boolean, what: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); return ok; };
const f2 = (v: number) => v.toFixed(2);
const at = (p: number[]) => `(${f2(p[0])}, ${f2(p[2] ?? p[1])})`;

const text = readFileSync(FILE, 'utf8');
const stand = async () => { const W: any = await standUp({ level: loadLevel(parseLevelData(text)) }); return W; };
/** a door's faces in compass words: side ±1 of doors.ts side() → which way that face looks */
const faceOf = (d: any, side: 1 | -1) => { const th = d.def.closedDir, n = [-Math.sin(th) * side, Math.cos(th) * side]; return n[0] > 0.5 ? 'east' : n[0] < -0.5 ? 'west' : n[1] > 0.5 ? 'south' : 'north'; };
/** which face of the SHUT leaf's line a point is on (doors.ts side() reads the leaf where it has swung to) */
const sideOf = (d: any, p: number[]) => { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]) >= 0 ? 1 : -1; };
/** a floor point `out` metres off a door's middle on face `side` */
const offDoor = (d: any, side: 1 | -1, out: number): V3 => { const th = d.def.closedDir; return [d.frameCentre[0] - Math.sin(th) * side * out, 0, d.frameCentre[2] + Math.cos(th) * side * out]; };

async function data() {
  console.log('=== records data ===');
  const ex = Bun.spawnSync(['bun', 'run', `${ROOT}/tools/levels/export.ts`, 'records', '--check'], { cwd: ROOT });   // the one exporter's own stale test
  check(ex.exitCode === 0, `levels/records.json is what the generator gives now (tools/levels/export.ts records --check: exit ${ex.exitCode})`);
  const d = parseLevelData(text); const errs = validateLevelData(d);
  check(errs.length === 0, `the level validator: ${errs.length} error(s)${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : ''}`);
  const office = parseLevelData(readFileSync(`${ROOT}/levels/office.json`, 'utf8'));
  // (small = the BUILT floor: walls, doors, fixed furniture. The lived-in things (src/scene/lived.ts, group lived.<room>: 301 of this file's 571 boxes) are
  //  dressing a profile can leave out, and the office authors none under that tag, so they are counted apart and not against the bound)
  const built = (x: any): number => x.boxes.filter((b: any) => !isLived(b.group)).length, small = (x: any): boolean => built(x) < office.boxes.length / 2 && x.lights.length <= office.lights.length;
  check(small(d), `small: ${built(d)} built boxes (+ ${d.boxes.length - built(d)} lived-in things = ${d.boxes.length}) · ${d.lights.length} lights · ${d.switchables.length} switchables · ${d.doors.length} doors (the office: ${built(office)} built of ${office.boxes.length} · ${office.lights.length} · ${office.switchables.length} · ${office.doors.length})`);
  check(!small(office) && !small({ ...d, boxes: [...d.boxes, ...office.boxes.slice(0, Math.ceil(office.boxes.length / 2) - built(d))] }), 'the same measure bites: the office is not small by it, nor this floor with enough built boxes added to reach half the office');
  const B = RECORDS_ROOMS, inWorld = Object.values(B).every((r: any) => r.bounds.x0 > WORLD.min[0] && r.bounds.x1 < WORLD.max[0] && r.bounds.z0 > WORLD.min[2] && r.bounds.z1 < WORLD.max[2]);
  check(inWorld, 'every room lies inside the 40 × 28 m world');
  const names = new Set(d.doors.map((x: any) => x.id)); const named = Object.values(B).flatMap((r: any) => r.doors as string[]);
  check(named.every(n => names.has(n)) && [...names].every(n => named.includes(n as string)), `the rooms' door lists and the level's ${names.size} doors are the same names`);
}

async function boot() {
  console.log('=== records boot ===');
  const W = await stand(); const g = W.game;
  let threw = ''; try { for (let i = 0; i < 300; i++) W.step(1 / 60); } catch (e: any) { threw = String(e?.message ?? e); }
  check(!threw, `the Game stands up on the level and steps 300 frames${threw ? ' — threw: ' + threw : ''}`);
  check(g.doors.list.length === 8 && g.guards.length === 0, `${g.doors.list.length} doors, ${g.guards.length} patrolling staff (none: the level has no routes)`);
  const p = g.player.char.pos; check(Math.hypot(p[0] - RECORDS_START[0], p[2] - RECORDS_START[2]) < 0.6 && !g.col.nav.isBlocked(p[0], p[2]), `Sam stands at the start ${at(p)} on free floor`);
  check(!!g.orders && !!g.doorTools && !!g.roomClear, 'the orders, the door tools and the room clear are constructed');
}

async function stacks(overlay: any) {
  console.log('=== records stacks ===');
  const W = await stand(); const g = W.game; for (let i = 0; i < 30; i++) W.step(1 / 60);
  g.teleportPlayer([2, 0, 2]);
  const men: any[] = [{ state: 'x' }, { state: 'x' }];
  let faces = 0, jambs = 0, files = 0, none = 0, standoffs = 0;
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    faces++;
    const P = g.orders.stackPosts(d, side, men); const so = g.doorTools.standoffPosts(d, side, 2);
    const kind = !P ? 'NONE' : P.filter((p: any) => p.lead).length === 2 ? 'a man on each jamb' : 'a file on one jamb';
    if (!P) none++; else if (kind.startsWith('a man')) jambs++; else files++;
    if (so) standoffs++;
    const free = !!P && P.every((p: any) => !g.col.nav.isBlocked(p.pos[0], p.pos[2])) && Math.hypot(P[0].pos[0] - P[1].pos[0], P[0].pos[2] - P[1].pos[2]) > 0.5;
    check(free, `${d.def.name} ${faceOf(d, side)} face: ${kind}${P ? ' ' + P.map((p: any) => at(p.pos)).join(' ') : ''} · charge stand-off ${so ? so.map((p: any) => at(p.pos)).join(' ') : 'none'}`);
    for (const p of P ?? []) overlay.posts.push({ pos: p.pos });
  }
  check(none === 0, `${faces} door faces: ${jambs} with a man on each jamb, ${files} with a file, ${none} with no stack`);
  // a charge is set from the face the team comes at: every door that can take one (not steel) has a stand-off on its outer / hall / key face
  const outer: Record<string, V3> = { front: [13, 0, 24], office: [11.6, 0, 15], records_hall: [15.1, 0, 15], records_west: [8, 0, 8.6], strong_room: [16, 0, 10.5], staff_hall: [24.6, 0, 15], staff_east: [32, 0, 9] };
  let ok = 0; const lacking: string[] = [];
  for (const [name, from] of Object.entries(outer)) { const d = g.doors.byName(name); if (d && g.doorTools.standoffPosts(d, g.doors.side(d, from), 2)) ok++; else lacking.push(name); }
  check(lacking.length === 0, `a charge has a stand-off on the approach face of ${ok} of ${Object.keys(outer).length} wooden doors${lacking.length ? ' — none at ' + lacking.join(', ') : ''} (${standoffs} of ${faces} faces in all; the fire exit is steel and takes none)`);
}

async function structure(overlay: any) {
  console.log('=== records structure ===');
  const W = await stand(); const g = W.game; for (let i = 0; i < 30; i++) W.step(1 / 60);
  const S = RECORDS_STRUCTURE;
  const bad: string[] = checkStructure(g, S);
  const marks = S.rooms.reduce((n: number, r: any) => n + r.marks.length, 0), men = S.rooms.reduce((n: number, r: any) => n + r.garrison, 0);
  check(bad.length === 0, `roomclear.ts checkStructure: ${bad.length} problem(s) over ${S.rooms.length} rooms, ${men} defenders, ${marks} marks${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
  check(S.rooms.filter((r: any) => r.doors.length > 1).length >= 3, `${S.rooms.filter((r: any) => r.doors.length > 1).length} of ${S.rooms.length} held rooms have more than one way in (${S.rooms.map((r: any) => `${r.name} ${r.doors.length}`).join(', ')})`);
  // the authored placement (seed 0): records has one man on each of its two outer doors
  const home = placeDefenders(0, 1, S).filter((p: any) => p.room === 'records').map((p: any) => p.watch).sort();
  check(home.join() === 'records_hall,records_west', `the authored placement puts one records man on each door (${home.join(' + ')})`);
  // every two-door room: at least a third of its marks watch each of its outer doors
  for (const R of S.rooms) { const outerDoors = R.doors.map((d: any) => d.id).filter((id: string) => !(R.id === 'records' && id === 'strong_room')); if (outerDoors.length < 2) continue;
    const n = (id: string) => R.marks.filter((m: any) => m.watch === id).length;
    check(outerDoors.every((id: string) => n(id) * 3 >= R.marks.length), `${R.name}: its marks watch ${outerDoors.map((id: string) => `${id} ×${n(id)}`).join(', ')} of ${R.marks.length}`); }
  // a mark faces the door it stands ACROSS from: farther from the door it watches than the room's other marks' doors are on average is too strong a rule — the
  // simple one: no mark stands within 1.5 m of the door it watches unless the room has only that door
  let near = 0; for (const R of S.rooms) for (const m of R.marks) { const d = g.doors.byName(m.watch); if (R.doors.length > 1 && d && Math.hypot(m.pos[0] - d.frameCentre[0], m.pos[2] - d.frameCentre[2]) < 1.5) near++; }
  check(near === 0, `no mark in a room with a choice of doors stands within 1.5 m of the door it watches (${near})`);
  // the strong room and the charge: which marks the blast puts down (within knockM of the doorway's middle)
  const sr = S.rooms.find((r: any) => r.id === 'strong')!, d = g.doors.byName('strong_room');
  const dist = sr.marks.map((m: any) => Math.hypot(m.pos[0] - d.frameCentre[0], m.pos[2] - d.frameCentre[2]));
  check(dist.filter((x: number) => x < DOORTOOLS.knockM).length >= 2 && dist.every((x: number) => x < DOORTOOLS.stunM), `strong room marks at ${dist.map(f2).join(' / ')} m from the door: ${dist.filter((x: number) => x < DOORTOOLS.knockM).length} of ${dist.length} inside the charge's ${DOORTOOLS.knockM} m knock-down, all inside its ${DOORTOOLS.stunM} m stun`);
  check(g.doors.lockedOut(d, [16, 0, 10.5]) && !g.doors.lockedOut(d, [20, 0, 10.5]), 'the strong room door is locked against the records side and free from inside');
  // dealt placements: every seed's five men stand on five different marks
  let dup = 0; for (let seed = 1; seed <= 200; seed++) { const P = placeDefenders(seed, 1, S); if (new Set(P.map((p: any) => `${p.room}:${p.mark}`)).size !== P.length || P.length !== men) dup++; }
  check(dup === 0, `seeds 1‥200 each deal ${men} men onto ${men} different marks`);
  const both = (w: string) => { let n = 0; for (let seed = 1; seed <= 200; seed++) { const P = placeDefenders(seed, 1, S).filter((p: any) => p.room === 'records'); if (P.every((p: any) => p.watch === w)) n++; } return n; };
  console.log(`  (records over seeds 1‥200: both men on the hall door ${both('records_hall')}, both on the west door ${both('records_west')}, one on each ${200 - both('records_hall') - both('records_west')})`);
  for (const R of S.rooms) { overlay.rooms.push({ name: R.name, bounds: R.bounds }); R.marks.forEach((m: any, i: number) => overlay.marks.push({ pos: m.pos, aimAt: m.aimAt, label: i < R.garrison ? '●' : '' })); }
  overlay.rooms.push({ name: RECORDS_ROOMS.hall.name, bounds: RECORDS_ROOMS.hall.bounds });
}

async function walk() {
  console.log('=== records walk ===');
  const W = await stand(); const g = W.game; for (let i = 0; i < 30; i++) W.step(1 / 60);
  const nav = g.col.nav, pos = () => g.player.char.pos as V3;
  const sr = g.doors.byName('strong_room'); check(sr.locked, 'strong room door: locked as authored (taken off for the walk)'); sr.locked = false;
  g.godMode = true; g.aiEnabled = false; let skipped = 0;
  /** the puppet walked down a nav path to `goal`; frames taken, or −1. The GOAL is stood on (0.3 m) or the walk fails; a waypoint on the way is only a direction, and one
   *  he is wedged short of (the grid knows no furniture: a chair pushed up against its table can sit on the cell) is given up for the next after 0.7 s of going
   *  nowhere — the game's own men do as much (guards.ts followPath's progress watchdog), this walker had no such sense */
  const walkTo = (goal: V3, maxFrames = 1800): number => {
    const path = nav.findPath(pos(), goal) ?? [goal]; let frames = 0; const wps = [...path, goal];
    for (let i = 0; i < wps.length; i++) { const wp = wps[i]; g.puppet = { goal: [wp[0], 0, wp[2]], aim: null }; let from = pos().slice(), still = 0;
      while (Math.hypot(pos()[0] - wp[0], pos()[2] - wp[2]) > 0.3) { W.step(1 / 60); if (++frames > maxFrames) { g.puppet = null; return -1; }
        if (Math.hypot(pos()[0] - from[0], pos()[2] - from[2]) > 0.05) { from = pos().slice(); still = 0; } else if (++still > 42 && i < wps.length - 1) { skipped++; break; } } }
    g.puppet = null; return frames;
  };
  const inRoom = (r: any) => { const p = pos(); return p[0] > r.bounds.x0 && p[0] < r.bounds.x1 && p[2] > r.bounds.z0 && p[2] < r.bounds.z1; };
  // 1. every door, pushed through from both faces: put down 1.3 m off one face, walk to 1.3 m off the other
  let through = 0, tries = 0;
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    tries++; d.reset?.(); if (d === sr) sr.locked = false;
    const a = offDoor(d, side, 1.3), b = offDoor(d, -side as 1 | -1, 1.3);
    g.teleportPlayer(a); for (let i = 0; i < 20; i++) W.step(1 / 60);
    g.puppet = { goal: b, aim: null }; let frames = 0; while (Math.hypot(pos()[0] - b[0], pos()[2] - b[2]) > 0.3 && frames < 600) { W.step(1 / 60); frames++; } g.puppet = null;
    const ok = frames < 600 && sideOf(d, pos()) === -side;
    if (ok) through++;
    check(ok, `${d.def.name}: through it from its ${faceOf(d, side)} face in ${(frames / 60).toFixed(1)} s${ok ? '' : ' — stopped at ' + at(pos())}`);
    for (let i = 0; i < 90; i++) W.step(1 / 60);
  }
  check(through === tries, `${through} of ${tries} crossings (8 doors × 2 faces)`);
  // 2. one tour on foot from the start: every room entered, by nav path, pushing the doors on the way
  for (const d of g.doors.list) d.reset?.(); sr.locked = false;
  g.teleportPlayer([RECORDS_START[0], 0, RECORDS_START[2]]); for (let i = 0; i < 20; i++) W.step(1 / 60);
  const R = RECORDS_ROOMS; let entered = 0, secs = 0; const legs: [string, any, V3][] = [
    ['front office', R.front, [12.6, 0, 20.6]], ['hall', R.hall, [13.5, 0, 15]], ['records (south lane)', R.records, [13, 0, 11.7]], ['records (north lane)', R.records, [14, 0, 8.3]],
    ['strong room', R.strong, [20.3, 0, 10.4]], ['records (west lane)', R.records, [11.2, 0, 10]], ['hall (east end)', R.hall, [27, 0, 15]], ['staff room', R.staff, [27.5, 0, 11.6]], ['front office again', R.front, [11.6, 0, 19]],
  ];
  for (const [name, room, goal] of legs) { const f = walkTo(goal); const ok = f >= 0 && inRoom(room); if (ok) entered++; if (f > 0) secs += f / 60;
    check(ok, `walked to the ${name} ${at(goal)} in ${f < 0 ? '—' : (f / 60).toFixed(1) + ' s'}${ok ? '' : ' — ended at ' + at(pos())}`); }
  check(entered === legs.length, `${entered} of ${legs.length} legs of the tour (all four held rooms and the hall), ${secs.toFixed(0)} s on foot${skipped ? ` · ${skipped} waypoint(s) on the way given up wedged on furniture, here and at the doors above` : ''}`);
  // 3. every mark is reachable on foot from the start, and so is the outside face of every exterior door
  let reach = 0, total = 0; const lost: string[] = [];
  for (const room of RECORDS_STRUCTURE.rooms) for (const m of room.marks) { total++; if (nav.findPath([RECORDS_START[0], 0, RECORDS_START[2]], m.pos)) reach++; else lost.push(`${room.name} ${at(m.pos)}`); }
  check(reach === total, `${reach} of ${total} defender marks have a nav path from the start${lost.length ? ' — not ' + lost.join(', ') : ''}`);
  const outs: [string, V3][] = [['front', [13, 0, 23.6]], ['records_west', [8.9, 0, 8.6]], ['staff_east', [31.1, 0, 9]], ['fire_exit', [31.1, 0, 15]]];
  const ringOk = outs.filter(([, p]) => nav.findPath([RECORDS_START[0], 0, RECORDS_START[2]], p)).length;
  check(ringOk === outs.length, `${ringOk} of ${outs.length} exterior doors are reached round the OUTSIDE from the start (the walk round is open)`);
}

const overlay: any = { rooms: [], marks: [], posts: [], start: RECORDS_START };
const run: Record<string, () => Promise<void>> = { data, boot, stacks: () => stacks(overlay), structure: () => structure(overlay), walk };
if (which !== 'all' && !run[which]) { console.error(`unknown probe '${which}' — one of: ${Object.keys(run).join(', ')}, all`); process.exit(2); }
for (const name of which === 'all' ? Object.keys(run) : [which]) {
  try { await run[name](); } catch (e: any) { fails++; console.log(`- FAIL — ${name} threw: ${e?.stack ?? e}`); }
}
if (overlayOut) writeFileSync(overlayOut, JSON.stringify(overlay));
console.log(fails ? `=== records-probes ${which}: ${fails} FAILED of ${checks} ===` : `=== records-probes ${which}: ALL PASS (${checks} checks) ===`);
process.exit(fails ? 1 : 0);
