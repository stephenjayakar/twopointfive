// EVERY STACK MARK IS BY ITS DOOR — over every squad mission's level, every door, both faces, the squad's full count:
//   bun run tools/qa/stack-marks-check.ts [scenario ids…] [--off]
// A stack place is picked by a line from the doorway's front (orders.ts stackPostsOn). A line that runs exactly along the seam where two boxes of one wall
// abut passes between them, and the place can land on free floor BEYOND that wall: a mark eleven metres' walk from the door it is a mark for (the barracks'
// gallery door, once its leaf was a real 0.86 m: the man dealt that mark walked away from the door at the go and came in last). ORDERS.seamM asks the line
// a hand's width to either side as well. Held here, for the whole squad, for one pair of four and for one man: from every mark the squad's own path search reaches the doorway's front in no more than 2.5 times the
// crow's flight plus a metre.   --off = the one line, as it was: must fail (exit 1) on the barracks.
// AND WITH THE DOOR LEFT OPEN: the door's own leaf, swung out over one jamb, cuts the line to that jamb's places, so both of a pair file on the other
// jamb — and the second man's place there was handed out unasked: beyond the next wall on the office's stair door and the records room's fire exit, a
// hundred metres' walk away (ORDERS.secondFloor asks it for floor like every other). Held here: with the leaf standing at its stop, every mark a face is
// dealt is by its door too.   --off must fail on both.
// NOT held here, counted and listed: a face that stacks shut and answers 'no room on that door' with its own leaf open (a corner at the other jamb). That
// refusal is the doors-like-real-doors branch's to answer (its own-leaf rule, tools/qa/stack-own-check.ts there).
// exit 0 = every mark is by its door · 1 = a mark a long walk off (listed) · 2 = no such scenario
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { stage } = await import(`${ROOT}/tools/qa/bang-tally.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const argv = process.argv.slice(2), OFF = argv.includes('--off'), names = argv.filter(a => !a.startsWith('--'));
const known: string[] = SCENARIOS.map((s: any) => s.id), ids = names.length ? names : known;
for (const id of ids) if (!known.includes(id)) { console.error(`no scenario '${id}' (known: ${known.join(', ')})`); process.exit(2); }
const log = console.log; let far = 0, all = 0, faces = 0, refused = 0;
for (const id of ids) {
  console.log = () => {}; let S: any; try { S = await stage(id, 1); } finally { console.log = log; }
  if (OFF) { ORDERS.seamM = 0; ORDERS.secondFloor = false; }   // (after the staging: it puts the knob tables back as shipped)
  DOORWAY.oneWay = true;   // (the page's doors: a leaf has one stop)
  const g = S.g, men = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead'); let mine = 0, bad = 0, shutFaces = 0, none = 0;
  const near = (d: any, side: 1 | -1, P: any[], how: string) => {
    const c = d.frameCentre, th = d.def.closedDir, n = [-Math.sin(th) * side, Math.cos(th) * side], front: [number, number, number] = [c[0] + n[0] * ORDERS.jambOut, 0, c[2] + n[1] * ORDERS.jambOut];
    for (const p of P) { const from = g.col.nav.isBlocked(p.pos[0], p.pos[2]) ? g.orders.freeSpot(p.pos) ?? p.pos : p.pos, path = g.col.nav.findPath(from, front); let len = 0, prev = from;   // (a mark on no floor is walked to as near as the floor lets him)
      for (const q of path ?? []) { len += Math.hypot(q[0] - prev[0], q[2] - prev[2]); prev = q; }
      const crow = Math.hypot(p.pos[0] - front[0], p.pos[2] - front[2]); mine++;
      if (!path || len > crow * 2.5 + 1) { bad++; log(`  FAIL ${id} ${d.def.name} ${side > 0 ? '+' : '-'}${how}: the mark (${p.pos[0].toFixed(2)}, ${p.pos[2].toFixed(2)}) is ${path ? len.toFixed(1) + ' m' : 'no'} walk from the doorway's front, ${crow.toFixed(1)} m as the crow flies`); } } };
  // (the whole squad, and — the four's T, then a door order — one pair of it and one man of it)
  const crews: [any[], string][] = men.length > 2 ? [[men, ''], [men.slice(0, 2), ' pair'], [men.slice(0, 1), ' one']] : [[men, ''], [men.slice(0, 1), ' one']];
  for (const d of g.doors.list) { const a0 = d.angle, stops = [d.maxA, d.minA].filter((a: number) => Math.abs(a) > 0.3);
    for (const side of [1, -1] as const) for (const [M, who] of crews) {
      d.angle = 0; d.place(); const P: any[] | null = g.orders.stackPosts(d, side, M); if (!P) continue; near(d, side, P, who); shutFaces++;
      for (const a of stops) { d.angle = a; d.place(); const Q: any[] | null = g.orders.stackPosts(d, side, M);
        if (!Q) { none++; log(`  note ${id} ${d.def.name} ${side > 0 ? '+' : '-'}${who}: a stack with the door shut, 'no room on that door' with it standing open`); } else near(d, side, Q, who + ' (open)'); } }
    d.angle = a0; d.place(); }
  log(`${bad ? 'FAIL' : 'PASS'}  ${id.padEnd(18)} ${mine} marks on ${g.doors.list.length} doors, ${shutFaces} faces stacked shut${none ? `, ${none} of them refused open` : ''}`); far += bad; all += mine; faces += shutFaces; refused += none;
}
log(`\n${all} stack marks over ${ids.length} missions${OFF ? ' (--off: the one line and the second place unasked, as it was)' : ''}: ${far} a long walk from their door · ${faces} door faces: ${refused} refused with the door open (not held here)`);
if (far) process.exit(1); log('=== stack-marks-check: ALL PASS ==='); process.exit(0);
