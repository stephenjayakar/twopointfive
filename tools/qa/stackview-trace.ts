// WHERE A STACK STANDS AT AN OPEN DOOR, AND WHAT THE ROOM BEYOND SEES OF IT — a trace, nothing judged.
//   TPS_PROFILE=shipped bun run tools/qa/stackview-trace.ts [level ids…] [--verbose] [--json f]
// Every door of every squad level, each face a squad can stack on: the defenders put down, the squad stood on that face's own floor a walk from the door,
// the door stood OPEN (every other one shut), 'stack up' given, and the marks read as dealt — nobody walks. Per mark, with the play-through watcher's own
// measure (stackline-watch.ts cellsOnLine: cells of the floor beyond the door with a line to the place through the opening, at chest height, the leaves as
// they stand): is it in the line (≥ 3 cells), how much floor has it, how far along the wall from its jamb and how far off the wall it is, and is it on the
// far hand of the opening from where the squad stood (a place a man crosses the front of the opening for).
// Then the FLOOR THERE IS: places hard against the door's own wall on each hand of the opening (a lattice along the wall × off it), on the face's own floor,
// free, a clear walk from the doorway's front — which of them are out of the line, and how far from the jamb the first of them is.
export {};
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { standUp, ROOT } = await import('./headless.ts');
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { farFloor, cellsOnLine, LINE_CELL_M2, LINE_MIN_CELLS } = await import('./stackline-watch.ts');
const { stackRoomProbe, STACKROOM } = await import(`${ROOT}/src/game/stackroom.ts`);
const { sideOf, ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { doorPt, alongOf, offOf } = await import(`${ROOT}/src/game/doortools.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

type V = [number, number, number];
const DT = 1 / 60, args = process.argv.slice(2), VERBOSE = args.includes('--verbose'), JSONF = args.includes('--json') ? args[args.indexOf('--json') + 1] : '';
const OFF = args.includes('--off'), NOHAND = args.includes('--nohand');   // (--off: the open door's stack as it was dealt before STACKROOM.view · --nohand: without its second half)
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), pc = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };
const open = (d: any) => { const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); };

interface MarkRow { cells: number; geo: number; along: number; off: number; far: boolean; lead: boolean; dist: number }
interface FaceRow { level: string; door: string; side: number; width: number; leafOn: 'ours' | 'theirs'; men: number; marks: MarkRow[]; refused: string;
  /** places against the wall out of the line, per hand of the opening (0 = the squad's, 1 = the far one): how many · metres past the jamb to the first · to the n-th (n = men) */
  wall: { n: number; first: number | null; nth: number | null; any: number }[] }
const faces: FaceRow[] = [];

async function level(E: any): Promise<void> {
  Math.random = seeded(0xba46 + 7919);
  const W: any = await hush(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game;
  g.godMode = true; g.playerInvisible = true; if (OFF) STACKROOM.view = false; if (NOHAND) STACKROOM.viewHand = false;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, 'roomclear=1');
  const { why } = await hush(() => startFromQuery(g, new URLSearchParams(q))); if (why) { console.log(`${E.id}: start refused — ${why}`); return; }
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  await hush(() => step(20));
  const O = g.orders, men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 2) return;
  await hush(() => { for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true); step(30); });
  const home: V = [...g.player.char.pos] as V, K = ORDERS;
  const put = (gd: any, p: V, face: V) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); };
  const spotsOf = (d: any, F: any): V[] => { const spots: V[] = []; for (const band of [[9, 16], [5, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length >= men.length) break; if (spots.some(s => flat(s, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); } return spots; };
  let n = 0;
  for (const d of g.doors.list) for (const side of [1, -1] as const) { const F = stackRoomProbe(g, d, side); if (!F.floor) continue; const spots = spotsOf(d, F); if (spots.length < men.length) continue;
    for (const x of g.doors.list) shut(x); open(d);
    await hush(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); step(2); }); g.teleportPlayer(home); men.forEach((m, i) => { put(m, spots[i], d.frameCentre); g.cleared.mark(spots[i]); }); await hush(() => step(3));
    const w = d.def.width as number, far = farFloor(g, d, side) as number[][], mid = spots.reduce((s, p) => s + alongOf(d, p), 0) / spots.length, hand = mid >= w / 2 ? 1 : -1;   // (the hand of the opening the squad stands on: +1 past the latch jamb, −1 past the hinge)
    const swing = Math.sign(d.angle) || 1, leafOn = (d.def.closedDir, sideOf(d, d.tip ? d.tip() : doorPt(d, w * Math.cos(d.angle), w * Math.sin(Math.abs(d.angle)) * swing, 1)) === side) ? 'ours' : 'theirs';
    const refused = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')) as string;
    const row: FaceRow = { level: E.id, door: d.def.name, side, width: w, leafOn: leafOn as any, men: men.length, marks: [], refused: refused || '', wall: [] };
    if (!refused) for (const m of men) { const A = O.of(m); if (!A?.post || sideOf(d, A.post) !== side) continue; const p = A.post as V, [now, geo] = cellsOnLine(g, d, far, p), a = alongOf(d, p);
      row.marks.push({ cells: now, geo, along: a > w ? a - w : a < 0 ? -a : 0, off: offOf(d, p, side), far: (a >= w / 2 ? 1 : -1) !== hand, lead: A.stance === 'stack', dist: flat(p, d.frameCentre) }); }
    // the floor there is, hard against the wall: each hand of the opening, a lattice along the wall (0.3 m steps to 4.2 m past the jamb) × off it (0.35 / 0.45 / 0.55)
    const front: V = doorPt(d, w / 2, K.jambOut, side, 0.45);
    for (const h of [hand, -hand]) { const ok: number[] = []; let any = 0;
      for (let k = 0; k <= 14; k++) { const past = 0.3 + k * 0.3; let best = -1;
        for (const off of [0.35, 0.45, 0.55]) { const p = doorPt(d, h > 0 ? w + past : -past, off, side) as V;
          if (g.col.nav.isBlocked(p[0], p[2]) || !F.has(p) || g.col.solidBlocked(front, [p[0], 0.45, p[2]])) continue; any++;
          const c = cellsOnLine(g, d, far, p)[0]; if (c < LINE_MIN_CELLS) { best = c; break; } }
        if (best >= 0) ok.push(past); }
      // places 0.9 m apart along the wall, the first out of the line
      const picks: number[] = []; for (const a of ok) if (!picks.length || a - picks[picks.length - 1] >= 0.85) picks.push(a);
      row.wall.push({ n: picks.length, first: picks[0] ?? null, nth: picks[men.length - 1] ?? null, any }); }
    faces.push(row); n++;
    if (VERBOSE) console.log(`  ${E.id} ${d.def.name}${side > 0 ? '+' : '−'} w ${f2(w)} leaf ${row.leafOn}${refused ? ` REFUSED (${refused})` : ''}: ${row.marks.map(M => `${M.lead ? 'L' : ''}${M.far ? 'x' : ''}${M.cells}c@${f1(M.along)}/${f2(M.off)}`).join(' ')} · wall ours ${row.wall[0].n} (first ${row.wall[0].first ?? '—'}), far ${row.wall[1].n} (first ${row.wall[1].first ?? '—'})`);
  }
  const L = faces.filter(r => r.level === E.id), M = L.flatMap(r => r.marks);
  console.log(`${E.id} [${E.level ?? 'office.json'}], ${men.length} men: ${n} faces, ${L.filter(r => r.refused).length} refused · ${M.length} marks, ${M.filter(m => m.cells >= LINE_MIN_CELLS).length} in the line (${pc(M.filter(m => m.cells >= LINE_MIN_CELLS).length, M.length)}), ${f1(M.reduce((s, m) => s + m.cells, 0) * LINE_CELL_M2 / Math.max(1, M.length))} m² a mark · ${M.filter(m => m.far).length} across the opening`);
}

const rows: any[] = (ALL_MISSIONS as any[]).filter(E => E.squad), picked = rows.filter(E => !ids.length || ids.includes(E.id));
console.log(`stand: ${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'}${OFF ? ' · the view rule OFF' : NOHAND ? ' · the view rule without its second half' : ''}`);
for (const E of picked) await level(E);
const all = faces.filter(r => !r.refused), M = all.flatMap(r => r.marks), inLine = (m: MarkRow) => m.cells >= LINE_MIN_CELLS, m2 = (L: MarkRow[]) => f1(L.reduce((s, m) => s + m.cells, 0) * LINE_CELL_M2 / Math.max(1, L.length));
console.log(`\nALL: ${faces.length} faces (${faces.length - all.length} refused) · ${M.length} marks`);
console.log(`  in the line: ${M.filter(inLine).length} (${pc(M.filter(inLine).length, M.length)}), ${m2(M)} m² a mark · the lead's: ${pc(M.filter(m => m.lead && inLine(m)).length, M.filter(m => m.lead).length)}, ${m2(M.filter(m => m.lead))} m²`);
console.log(`  metres from the middle of the doorway: ${f2(M.reduce((s, m) => s + m.dist, 0) / Math.max(1, M.length))} a mark, the nearest of a face ${f2(all.reduce((s, r) => s + Math.min(...r.marks.map(m => m.dist), 99), 0) / Math.max(1, all.length))}, the furthest ${f2(all.reduce((s, r) => s + Math.max(...r.marks.map(m => m.dist), 0), 0) / Math.max(1, all.length))}`);
console.log(`  by where the open leaf stands: on the squad's face ${all.filter(r => r.leafOn === 'ours').length} faces, ${pc(all.filter(r => r.leafOn === 'ours').flatMap(r => r.marks).filter(inLine).length, all.filter(r => r.leafOn === 'ours').flatMap(r => r.marks).length)} of marks in the line · beyond ${all.filter(r => r.leafOn === 'theirs').length} faces, ${pc(all.filter(r => r.leafOn === 'theirs').flatMap(r => r.marks).filter(inLine).length, all.filter(r => r.leafOn === 'theirs').flatMap(r => r.marks).length)}`);
console.log(`  across the opening from where the squad stood: ${M.filter(m => m.far).length} marks (${pc(M.filter(m => m.far).length, M.length)}) on ${all.filter(r => r.marks.some(m => m.far)).length} faces · of them in the line ${pc(M.filter(m => m.far && inLine(m)).length, M.filter(m => m.far).length)}`);
for (const lim of [0.45, 0.6, 0.9]) console.log(`  marks by metres off the wall ≤ ${lim}: ${M.filter(m => m.off <= lim + 0.01).length}, in the line ${pc(M.filter(m => m.off <= lim + 0.01 && inLine(m)).length, M.filter(m => m.off <= lim + 0.01).length)}`);
const withLine = all.filter(r => r.marks.some(inLine));
console.log(`  faces with a mark in the line: ${withLine.length} of ${all.length}`);
const fits = (r: FaceRow, both: boolean) => (both ? r.wall[0].n + r.wall[1].n : r.wall[0].n) >= r.men;
console.log(`  … where the wall has places out of the line for EVERY man: on the squad's hand alone ${withLine.filter(r => fits(r, false)).length} · the two hands together ${withLine.filter(r => fits(r, true)).length} · for at least one man ${withLine.filter(r => r.wall[0].n + r.wall[1].n > 0).length} · for none ${withLine.filter(r => r.wall[0].n + r.wall[1].n === 0).length}`);
const firsts = withLine.flatMap(r => r.wall.map(w => w.first).filter((x): x is number => x !== null)).sort((a, b) => a - b), nths = withLine.map(r => r.wall[0].nth).filter((x): x is number => x !== null).sort((a, b) => a - b);
if (firsts.length) console.log(`  metres past the jamb to the first place out of the line: median ${f1(firsts[firsts.length >> 1])}, 90 % within ${f1(firsts[Math.floor(firsts.length * 0.9)])}${nths.length ? ` · to the last man's place on the squad's hand: median ${f1(nths[nths.length >> 1])}` : ''}`);
console.log(`  wall lattice places that are free floor at all, per hand: median ${(() => { const a = all.flatMap(r => r.wall.map(w => w.any)).sort((x, y) => x - y); return a[a.length >> 1]; })()} of 45`);
if (JSONF) writeFileSync(JSONF, JSON.stringify(faces));
process.exit(0);
