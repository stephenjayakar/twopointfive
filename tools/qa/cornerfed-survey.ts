// WHICH ROOMS ARE CORNER FED, and what an entry leaves unseen — a survey of every door face of every level file, for the room-clearing rule
// (src/game/doortools.ts: the points of domination, the room's search, the flow on):
//   bun run tools/qa/cornerfed-survey.ts [level.json …] [--all] [--json out.json]
// Per door face that opens on a ROOM (the room fight's own flood, ≤ DOORTOOLS.searchCells): the room's size, the floor to either hand of the door along its
// own wall (a hand under 1 m = the door is at that corner: CORNER FED), the four points an entry of four is dealt, and how much of the room's floor none of
// those points has a line to (what the search has to walk men to). Nothing is judged: it prints the table the rule was written against.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { DOORTOOLS, doorPt, openFloor } = await import(`${ROOT}/src/game/doortools.ts`);

const args = process.argv.slice(2), jsonAt = args.indexOf('--json'), out = jsonAt >= 0 ? args[jsonAt + 1] : null, all = args.includes('--all');
const files = args.filter((a, i) => a.endsWith('.json') && (jsonAt < 0 || i !== jsonAt + 1));
const names = files.length ? files : readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !/lint|registry\.json$|office-/.test(f) || f === 'registry.json');
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const rows: any[] = [];
for (const f of names) {
  let W: any; const log = console.log; console.log = () => {};
  try { W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${f}`, 'utf8'))) }); } catch (e) { console.log = log; console.log(`${f}: ${String(e).slice(0, 120)}`); continue; } finally { console.log = log; }
  const g = W.game, nav = g.col.nav, D = g.doorTools;
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    const into = -side as 1 | -1, Wd = d.def.width, mid = doorPt(d, Wd / 2, 1.0, into), room = g.fight.roomAt(mid);
    if (!room || openFloor(g, room) || nav.isBlocked(mid[0], mid[2])) continue;
    // the floor to either hand along the entry wall, 0.6 m inside it: metres from the jamb to the first cell a man cannot stand on
    const hand = (s: 1 | -1) => { let L = 0; for (; L < 12; L += 0.25) { const p = doorPt(d, Wd / 2 + s * (Wd / 2 + L + 0.25), 0.6, into); if (nav.isBlocked(p[0], p[2]) || g.col.solidBlocked([mid[0], 0.45, mid[2]], [p[0], 0.45, p[2]])) break; } return L; };
    const hi = hand(1), lo = hand(-1);
    let depth = 0; for (; depth < 20; depth += 0.25) { const p = doorPt(d, Wd / 2, depth + 0.5, into); if (nav.isBlocked(p[0], p[2])) break; }
    const pods = D.podsAsWere(d, side, 4) as { pos: number[]; face: number }[];
    let unseen = 0; const cs = nav.cell;
    for (const ci of room.cells) { const q = [(ci % nav.W + 0.5) * cs, 1.0, (((ci / nav.W) | 0) + 0.5) * cs]; if (!pods.some(P => flat(P.pos, q) <= DOORTOOLS.lookM && !g.col.segmentBlocked([P.pos[0], 1.55, P.pos[2]], q))) unseen++; }
    const far = Math.max(0, ...pods.map(P => flat(P.pos, d.frameCentre)));
    rows.push({ level: f.replace('.json', ''), door: d.def.name, side, cells: room.cells.size, hi: +hi.toFixed(2), lo: +lo.toFixed(2), depth: +depth.toFixed(2), corner: Math.min(hi, lo) < 1.0 && Math.max(hi, lo) >= 2.0, pods: pods.map(P => [+P.pos[0].toFixed(1), +P.pos[2].toFixed(1)]), far: +far.toFixed(1), unseen });
  }
}
const show = all ? rows : rows.filter(r => r.corner || r.unseen >= DOORTOOLS.deadCells);
console.log('level · door · face · room cells (¼ m²) · floor to either hand (m) · depth (m) · corner fed · farthest point from the door (m) · cells no point sees');
for (const r of show) console.log(`${r.level.padEnd(16)} ${String(r.door).padEnd(16)} ${r.side > 0 ? '+' : '-'}  ${String(r.cells).padStart(4)}  ${r.hi.toFixed(1).padStart(5)} / ${r.lo.toFixed(1).padEnd(5)} ${r.depth.toFixed(1).padStart(5)}  ${r.corner ? 'CORNER' : '      '}  ${r.far.toFixed(1).padStart(4)}  ${String(r.unseen).padStart(4)}  ${r.pods.map((p: number[]) => `(${p[0]}, ${p[1]})`).join(' ')}`);
console.log(`\n${rows.length} door faces onto rooms · ${rows.filter(r => r.corner).length} corner fed · ${rows.filter(r => r.unseen >= DOORTOOLS.deadCells).length} with ${DOORTOOLS.deadCells}+ cells no entry point sees`);
if (out) writeFileSync(out, JSON.stringify(rows));
process.exit(0);
