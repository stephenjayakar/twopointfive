// EVERY DOOR IN EVERY LEVEL, MEASURED — the door size rule's check (src/scene/doorSize.ts), read off the level FILES with the game's own collision and walk grid:
//   bun run tools/qa/door-size.ts [name…] [--list] [--json out.json]
//     name     levels to measure (levels/<name>.json); none = every level file
//     --list   a row per door (default: a line per level, and every FAIL)
// PER LEAF (levels' `doors`): the air between the jamb faces at chest height along the closed leaf's line, the air under the head, the leaf's own width and height,
//   and the walk grid through the frame: the guards' own path search (collision.ts NavGrid.findPath) from a metre out on one side of the wall to a metre out on
//   the other must come through the doorway, not round the building or not at all; and the floor a stride straight out of the frame's middle, on both faces, free.
// PER DOORWAY WITHOUT A LEAF: found by its head — a wall piece that starts at a door's height over floor a man can walk, as long as a door is wide — and held to
//   the same width. Wider openings (arches, gates, shutters: over doorSize.ts DOOR_SIZE.slotMax) are counted, not judged.
// exit 0 = every door and doorway is the rule's size with a free cell in it · 1 = a FAIL (listed) · 2 = no such level
import { resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { StaticCollision } = await import(`${ROOT}/src/scene/collision.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { DOOR_SIZE, LEAF_W, LEAF_H, JAMB_FACE } = await import(`${ROOT}/src/scene/doorSize.ts`);

const argv = process.argv.slice(2), LIST = argv.includes('--list'), jsonAt = argv.indexOf('--json'), JSON_OUT = jsonAt >= 0 ? argv[jsonAt + 1] : null;
const names = argv.filter((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1));
const all = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).map(f => f.slice(0, -5)).sort();
const todo = names.length ? names : all;
for (const n of todo) if (!existsSync(resolve(ROOT, 'levels', `${n}.json`))) { console.error(`no level file levels/${n}.json`); process.exit(2); }

const f2 = (v: number) => v.toFixed(2);
type Row = { level: string; door: string; leaf: boolean; clear: number; head: number; leafW?: number; leafH?: number; off?: number; free?: boolean; sides?: boolean; fails: string[] };
const rows: Row[] = [], fails: string[] = []; let wide = 0;

for (const name of todo) {
  const level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')));
  const col = new StaticCollision(level.boxes), nav = col.nav;
  const air = (p: [number, number, number], d: [number, number, number], max: number) => { const h = col.raycast(p, d, max); return h ? h.t : max; };
  const mine: Row[] = [];
  // ---- the leaves ----
  const leafSpots: [number, number][] = [];
  for (const d of level.doors) {
    const u: [number, number] = [Math.cos(d.closedDir), Math.sin(d.closedDir)], n: [number, number] = [-u[1], u[0]];
    const mx = d.hinge[0] + u[0] * d.width / 2, mz = d.hinge[1] + u[1] * d.width / 2; leafSpots.push([mx, mz]);
    const clear = air([mx, 1.0, mz], [u[0], 0, u[1]], 3) + air([mx, 1.0, mz], [-u[0], 0, -u[1]], 3);
    const head = 0.1 + air([mx, 0.1, mz], [0, 1, 0], 6);
    const leafH = (d as any).height ?? LEAF_H;
    const cx = (Math.floor(mx / nav.cell) + 0.5) * nav.cell, cz = (Math.floor(mz / nav.cell) + 0.5) * nav.cell;
    const off = Math.abs((cx - mx) * u[0] + (cz - mz) * u[1]);
    // the walk grid THROUGH the frame: the guards' own path search from a metre out on one side to a metre out on the other must come through the doorway
    const free = !nav.isBlocked(mx, mz); let sides = false;
    { const A: [number, number, number] = [mx - n[0], 0, mz - n[1]], B: [number, number, number] = [mx + n[0], 0, mz + n[1]], path = nav.findPath(A, B);
      if (path) { let len = 0, far = 0, prev = A; for (const q of path) { len += Math.hypot(q[0] - prev[0], q[2] - prev[2]); far = Math.max(far, Math.hypot(q[0] - mx, q[2] - mz)); prev = q; } sides = len < 3.5 && far < 1.8; } }
    const R: Row = { level: name, door: d.name, leaf: true, clear, head, leafW: d.width, leafH, off, free, sides, fails: [] };
        if (Math.abs(d.width - LEAF_W) > 0.005) R.fails.push(`leaf ${f2(d.width)} m wide, the rule's is ${f2(LEAF_W)}`);
    if (Math.abs(clear - d.width) > 0.03) R.fails.push(`${f2(clear)} m between the jamb faces for a ${f2(d.width)} m leaf`);
    if (head > DOOR_SIZE.head + 0.01 || head < leafH - 0.005) R.fails.push(`${f2(head)} m under the head, the rule's is ${f2(leafH)}‥${f2(DOOR_SIZE.head)}`);
    if (head > leafH + 0.01 + 1e-4) R.fails.push(`a ${((head - leafH - 0.01) * 100).toFixed(1)} cm slot between the shut leaf's top and the head (light passes over the door)`);   // (the leaf stands 1 cm off the floor: doors.ts)
    if (Math.abs(leafH - LEAF_H) > 0.005) R.fails.push(`leaf ${f2(leafH)} m tall, the rule's is ${f2(LEAF_H)}`);
    const stride = [-0.6, 0.6].filter(o => nav.isBlocked(mx + n[0] * o, mz + n[1] * o));   // a stride out of the frame on either face, straight on: free floor (nothing was left standing in front of where the door ended up in its slot)
    if (stride.length) R.fails.push(`the floor a stride ${stride.map(o => o < 0 ? 'behind' : 'before').join(' and ')} the frame's middle is not free`);
    if (!sides) R.fails.push(`the walk grid does not pass through the frame (its middle is ${f2(off)} m off its cell's centre${free ? '' : ', that cell blocked'})`);
    mine.push(R);
  }
  // ---- the doorways with no leaf: a head over walkable floor ----
  level.boxes.forEach((b: any) => {
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic | BoxFlag.Glass) || Math.abs(Math.sin(2 * b.yaw)) > 1e-3) return;
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1]; if (y0 < 1.9 || y0 > 2.3 || y1 < y0 + 0.1) return;
    const sw = Math.abs(Math.sin(b.yaw)) > 0.5, hx = sw ? b.h[2] : b.h[0], hz = sw ? b.h[0] : b.h[2];
    const thin = Math.min(hx, hz), long = Math.max(hx, hz); if (thin > 0.13 || thin < 0.05 || long < 0.3 || long > 2.6) return;
    const u: [number, number] = hx > hz ? [1, 0] : [0, 1], mx = b.c[0], mz = b.c[2];
    if (leafSpots.some(s => Math.hypot(s[0] - mx, s[1] - mz) < 0.5)) return;                                  // a leaf's own head: measured above
    if (col.raycast([mx, y0 - 0.02, mz], [0, -1, 0], y0 - 0.3)) return;                                         // something stands under it (a window's sill, a counter): not a doorway
    const clear = air([mx, 1.0, mz], [u[0], 0, u[1]], 4) + air([mx, 1.0, mz], [-u[0], 0, -u[1]], 4);
    if (Math.abs(clear - 2 * long) > 0.2) return;                                                              // the air under it is not its own opening (a beam over open floor)
    if (clear > DOOR_SIZE.slotMax + 0.01) { wide++; return; }
    const R: Row = { level: name, door: `(no leaf) ${f2(mx)}, ${f2(mz)}`, leaf: false, clear, head: y0, free: !nav.isBlocked(mx, mz), fails: [] };
    if (clear > DOOR_SIZE.gap + 0.01) R.fails.push(`a doorway ${f2(clear)} m wide, the rule's is ${f2(DOOR_SIZE.gap)}`);
    if (y0 > DOOR_SIZE.head + 0.01) R.fails.push(`${f2(y0)} m under the head, the rule's is ${f2(DOOR_SIZE.head)}`);
    if (!R.free) R.fails.push('no free walk cell in the doorway');
    mine.push(R);
  });
  rows.push(...mine);
  const bad = mine.filter(r => r.fails.length), leaves = mine.filter(r => r.leaf), open = mine.filter(r => !r.leaf);
  const span = (xs: number[]) => xs.length ? (Math.min(...xs) === Math.max(...xs) ? f2(xs[0]) : `${f2(Math.min(...xs))}‥${f2(Math.max(...xs))}`) : '—';
  console.log(`${bad.length ? 'FAIL' : 'PASS'}  ${name.padEnd(16)} ${String(leaves.length).padStart(3)} leaves ${span(leaves.map(r => r.leafW!))} × ${span(leaves.map(r => r.leafH!))} · air ${span(leaves.map(r => r.clear))} × ${span(leaves.map(r => r.head))}` +
    ` · middle off its cell ≤ ${f2(Math.max(0, ...leaves.map(r => r.off!)))} · ${open.length} doorways without a leaf ${span(open.map(r => r.clear))}`);
  for (const r of mine) if (LIST || r.fails.length) console.log(`      ${r.fails.length ? 'FAIL' : 'ok  '} ${r.door.padEnd(26)} air ${f2(r.clear)} × ${f2(r.head)}${r.leaf ? ` · leaf ${f2(r.leafW!)} × ${f2(r.leafH!)} · walk grid ${r.sides ? 'through' : 'NOT THROUGH'} (${f2(r.off!)} off its cell)` : ''}${r.fails.length ? ' — ' + r.fails.join('; ') : ''}`);
  for (const r of bad) fails.push(`${name} ${r.door}: ${r.fails.join('; ')}`);
}
const leaves = rows.filter(r => r.leaf);
console.log(`\n${todo.length} levels · ${leaves.length} leaves · ${rows.length - leaves.length} doorways without a leaf · ${wide} wider openings left as drawn · the rule: a ${f2(DOOR_SIZE.gap)} × ${f2(DOOR_SIZE.head)} m hole, a ${f2(LEAF_W)} × ${f2(LEAF_H)} m leaf (${JAMB_FACE * 100} cm of jamb face each side)`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ rule: DOOR_SIZE, rows }, null, 1));
if (fails.length) { console.log(`\n${fails.length} FAIL:`); for (const f of fails) console.log('  ' + f); process.exit(1); }
console.log('=== door-size: ALL PASS ===');
