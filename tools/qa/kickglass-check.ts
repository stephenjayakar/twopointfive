// NO BOOT FROM BESIDE A LATCH JAMB IN FRONT OF GLASS (src/game/doors.ts DOORWAY.kickGlass; src/game/doortools.ts bootSpot) — every door of every level
// file, both faces, asked where a squad's lead would boot it from, the side kick on and rounds through glass live, with the rule off and on.
//   bun run tools/qa/kickglass-check.ts [name…] [--list]          (TPS_PROFILE=shipped in front: the page's stand; the rule is raised here on either)
// Every leaf is shut and latched first: a boot is only ever thrown at a door that is (doortools.ts willKick), and the spots are read off the leaf.
//   a  no boot is dealt beside a latch jamb where a rifle reaches the kicker through a pane from the floor beyond the door — this file's own count of the
//      lines (clear to a round, a static in the way of a walk: only a pane is both), GLASSPEN.stackEyes or more as the stack's rule has it — while clearly
//      fewer of them (GLASSPEN.stackLeastK or less) reach the square spot in front of the leaf and there is floor there (else he stays beside the jamb,
//      out of the opening; those faces are counted)
//   b  the rule moves a boot nowhere but square in front of its own leaf, and moves none whose side spot has too few such lines or whose front is no better
//   c  off = the spots as they were: the faces the rule moves are counted and named (--list: each, and each face left beside its jamb), and the levels
//      asked hold at least one
// KICKGLASS_BREAK=1: the rule left off — line a is red (every side spot the levels asked hold in front of a pane with a better front; a set of levels
// with none is red at line c: nothing was proved).
// exit 0 = all lines pass · 1 = a FAIL · 2 = no such level
import { resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const { standUp } = await import(`${ROOT}/tools/qa/headless.ts`);
const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
const { GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);

const argv = process.argv.slice(2), LIST = argv.includes('--list'), BREAK = process.env.KICKGLASS_BREAK === '1';
const all = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).map(f => f.slice(0, -5)).sort();
const names = argv.filter(a => !a.startsWith('--')), todo = names.length ? names : all;
for (const n of todo) if (!existsSync(resolve(ROOT, 'levels', `${n}.json`))) { console.error(`no level file levels/${n}.json`); process.exit(2); }

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const xz = (p: number[]) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`, flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const keep = { fx: GLASSFX.on, pen: GLASSPEN.on, side: DOORWAY.sideKick, glass: DOORWAY.kickGlass };

const inGlass: string[] = [], astray: string[] = [], moved: string[] = [], both: string[] = []; let faces = 0, doors = 0, levels = 0, beside = 0, would = 0;
for (const name of todo) {
  const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8'))) }));
  GLASSFX.on = true; GLASSPEN.on = true; DOORWAY.sideKick = true;   // (after the stand-up: the frozen stand pins all three off)
  const g = W.game, list: any[] = g.doors.list; if (!list.length) continue; levels++; doors += list.length;
  for (const d of list) { d.angle = 0; d.vel = 0; d.latched = true; d.place(); }
  const EYES = GLASSPEN.stackEyes, better = (n: number, f: number, at: number[]) => n >= EYES && f <= GLASSPEN.stackLeastK * n && !g.col.nav.isBlocked(at[0], at[2]);
  // the check's own count: the floor beyond the door (7.5 m deep, 6 m to either hand, chest height), the leaves out of the asking — a line no round stops
  // on but a walk does is a line through a pane
  const lines = (d: any, side: number, p: number[]): number => {
    const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), nx = -uz * side, nz = ux * side, c = d.frameCentre, P = [p[0], 1.3, p[2]];
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = []; let n = 0;
    try { for (let b = 0.75; b <= 7.5; b += 0.75) for (let l = -6; l <= 6; l += 0.75) { const q = [c[0] - nx * b + ux * l, 1.3, c[2] - nz * b + uz * l];
      if (g.col.nav.isBlocked(q[0], q[2])) continue; if (!g.col.shotBlocked(q, P, 0.02, GLASSPEN.stackEnergy) && g.col.solidBlocked(q, P)) n++; } }
    finally { g.col.dynamicBoxes = leaves; }
    return n; };
  for (const d of list) for (const side of [1, -1]) {
    const deal = (on: boolean): { pos: number[]; yaw: number } => { DOORWAY.kickGlass = on; return g.doorTools.bootSpot(d, side); };
    const sq = g.doors.kickSpot(d, doorPt(d, d.def.width - 0.25, 1, side)), was = deal(false), now = deal(!BREAK), tag = `${name} ${d.def.name}${side > 0 ? '+' : '-'}`; faces++;
    const isSide = (s: { pos: number[] }) => flat(s.pos, sq.pos) > 0.05;
    if (isSide(was)) beside++;
    if (isSide(now)) { const n = lines(d, side, now.pos), f = n >= EYES ? lines(d, side, sq.pos) : 0; if (n >= EYES) (better(n, f, sq.pos) ? inGlass : both).push(`${tag}: beside the jamb at ${xz(now.pos)}, ${n} lines through a pane, ${f} onto the front spot`); }
    if (BREAK) { DOORWAY.kickGlass = true; if (flat(g.doorTools.bootSpot(d, side).pos, was.pos) > 1e-6) would++; DOORWAY.kickGlass = false; }
    if (flat(was.pos, now.pos) > 1e-6) { const n = lines(d, side, was.pos), f = lines(d, side, now.pos); moved.push(`${tag}: ${xz(was.pos)} (${n} lines through a pane) → ${xz(now.pos)} (${f})`);
      if (isSide(now) || !better(n, f, now.pos)) astray.push(`${tag}: ${xz(was.pos)} → ${xz(now.pos)}${isSide(now) ? ', not the square spot' : ''}${n < EYES ? `, only ${n} lines through a pane where it stood` : `, ${f} onto the front against ${n}`}`); }
  }
}
GLASSFX.on = keep.fx; GLASSPEN.on = keep.pen; DOORWAY.sideKick = keep.side; DOORWAY.kickGlass = keep.glass;
let failed = false; const line = (ok: boolean, text: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); if (!ok) failed = true; };
const some = (L: string[]) => L.length ? '\n    ' + L.slice(0, LIST ? 999 : 12).join('\n    ') + (L.length > 12 && !LIST ? `\n    … ${L.length - 12} more (--list)` : '') : '';
console.log(`kickglass-check · ${levels} levels with doors · ${doors} doors · ${faces} faces asked, ${beside} with floor for a boot from beside the latch jamb${BREAK ? ' · KICKGLASS_BREAK: the rule left off' : ''}`);
line(!inGlass.length, `a · no boot is dealt beside a latch jamb with ${GLASSPEN.stackEyes} or more lines through a pane onto the kicker where clearly fewer reach the front spot: ${inGlass.length} are${some(inGlass)}`);
line(!astray.length, `b · the rule moves a boot only to the square spot in front of its leaf, and only one that stood in front of a pane with clearly fewer lines onto the front: ${astray.length} otherwise${some(astray)}`);
line(BREAK ? !moved.length && would > 0 : moved.length > 0, `c · ${moved.length} of ${faces} faces boot from the front where they booted from beside the jamb${BREAK ? ` (the rule left off: none may; on, ${would} would${would ? '' : ' — these levels prove nothing'})` : moved.length ? '' : ' — the levels asked hold no such face: nothing proved'} · ${both.length} stay beside a jamb in front of a pane, the front no better${LIST ? some(moved) + (both.length ? '\n  left beside the jamb:' + some(both) : '') : ''}`);
process.exit(failed ? 1 : 0);
