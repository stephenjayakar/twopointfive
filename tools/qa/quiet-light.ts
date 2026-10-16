// A QUIET LEVEL ON PAPER — the level stood up headless and drawn as the light a sneaking man would stand in, with the checks a level made for sneaking alone
// has to hold before anybody plays it. A measuring tool: nothing of the game is edited.
//   bun run tools/qa/quiet-light.ts <name> [--cell 0.5] [--blackout] [--off lamp_a,lamp_b] [--no-map]
//     <name>      levels/<name>.json
//     --blackout  the map with everything on the mains out (the breaker thrown)
//     --off       the map with these named lights / switchables out (shot, or under the OCP)
// THE MAP: one character a cell, north up. '#' a cell no man can stand in; else the light meter's reading for a man STANDING there (the CPU estimate of the
// direct light at chest and head through the game's own curve — guards.ts lightEstimateAt, Game.visibilityOf; the men's torches left out): ' ' under 0.08
// (dark: unseen past arm's reach) · '.' to 0.3 · ':' to 0.6 · '*' above (lit: seen across the yard). Over it: S the spawn · O the thing to take · X the way
// out · a digit = a waypoint of that route (1 = routes[0]) · c a camera · k a keypad · B the breaker.
// THE CHECKS (PASS / FAIL lines; exit 1 on a FAIL): every route waypoint is a free nav cell and every leg of every lap has a path; no man of the shift starts
// inside 8 m of the spawn with a line to it; the objective room, the thing's face and the way out are reached on foot from the spawn; the short way from the
// spawn to the objective crosses LIGHT (a level where the straight walk is dark asks nothing) and a way to the objective room exists that is dark all along (a level with no dark way
// cannot be ghosted); the level's own roofs are four or fewer; the shift is 4 to 6.
// NO GPU: no bounce light and no moon on the estimate — a lit room reads darker here than on the page, and "dark" here is the page's dimmest, not black.
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const name = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--cell', '--off'].includes(argv[i - 1])));
const { standUp, ROOT } = await import('./headless.ts');
if (!name || !existsSync(resolve(ROOT, 'levels', `${name}.json`))) { console.error('usage: bun run tools/qa/quiet-light.ts <name> [--cell 0.5] [--blackout] [--off a,b] [--no-map]   (levels/<name>.json)'); process.exit(2); }
const CELL = Number(flag('--cell') ?? 0.5), OFF = new Set((flag('--off') ?? '').split(',').filter(Boolean));
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { roofsOf } = await import(`${ROOT}/src/game/weather.ts`);

const log = console.log; console.log = console.warn = () => { };
const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8'))) });
console.log = log;
const g = W.game, level = W.level, nav = g.col.nav, M = level.mission;
for (let i = 0; i < 30; i++) W.step(1 / 60);
// the lights put out for this map: the breaker's (everything on the mains), and the named ones
const out: string[] = [];
for (const t of g.targets as any[]) { const kill = OFF.has(t.name) || (has('--blackout') && t.mains !== false && t.kind !== 'device'); if (kill) { t.broken = true; out.push(t.name); } }
if (has('--blackout') && g.blackout) { try { const { setBlackout } = await import(`${ROOT}/src/game/lighting.ts`); setBlackout(g, true); } catch { /* an older build: the targets broken above stand in */ } }
for (let i = 0; i < 240; i++) W.step(1 / 60);

type P3 = [number, number, number];
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const any = () => true;   // every carried light skipped: the PLACE's light
const vis = (x: number, z: number): number => g.visibilityOf(Math.max(lightEstimateAt(g, [x, 1.2, z], any), lightEstimateAt(g, [x, 1.6, z], any)));
const free = (p: number[]) => !nav.isBlocked(p[0], p[2]);
const path = (a: number[], b: number[]): number[][] | null => nav.findPath([a[0], 0, a[2]], [b[0], 0, b[2]], 20000);
const len = (p: number[][]) => { let s = 0; for (let i = 1; i < p.length; i++) s += flat(p[i - 1], p[i]); return s; };
const lit = (p: number[][], bar: number) => { let n = 0, k = 0; for (let i = 1; i < p.length; i++) { const d = flat(p[i - 1], p[i]), m = Math.max(1, Math.ceil(d / 0.25)); for (let j = 0; j < m; j++) { const u = (j + 0.5) / m, x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, z = p[i - 1][2] + (p[i][2] - p[i - 1][2]) * u; n++; if (vis(x, z) > bar) k++; } } return n ? k / n : 0; };

let fails = 0; const pass = (ok: boolean, what: string, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fails++; return ok; };
const note = (s: string) => console.log(`  note  ${s}`);

// ───────────── the map
const nx = Math.round(WORLD.max[0] / CELL), nz = Math.round(WORLD.max[2] / CELL), grid: string[][] = [], V: number[][] = [];
for (let j = 0; j < nz; j++) { grid.push([]); V.push([]); for (let i = 0; i < nx; i++) { const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL; if (nav.isBlocked(x, z)) { grid[j].push('#'); V[j].push(-1); continue; } const v = vis(x, z); V[j].push(v); grid[j].push(v < 0.08 ? ' ' : v < 0.3 ? '.' : v < 0.6 ? ':' : '*'); } }
const put = (p: number[], ch: string) => { const i = Math.floor(p[0] / CELL), j = Math.floor(p[2] / CELL); if (grid[j]?.[i] !== undefined) grid[j][i] = ch; };
level.routes.forEach((r: any, i: number) => { for (const p of r.points) put(p, String((i + 1) % 10)); });
for (const d of level.devices ?? []) put(d.kind === 'laser' ? d.from : d.pos, d.kind === 'camera' ? 'c' : d.kind === 'keypad' ? 'k' : 'l');
put(level.breaker.pos, 'B'); put(M.rack.front, 'O'); put([M.exfilX, 0, M.exfilZ], 'X'); put(level.playerSpawn, 'S');
if (!has('--no-map')) {
  console.log(`\n${name}: the light a standing man is in${out.length ? ` with ${out.length} lights out (${has('--blackout') ? 'the breaker thrown' : [...OFF].join(', ')})` : ''} — ' ' dark · '.' dim · ':' lit · '*' bright · '#' solid   (${CELL} m a cell)`);
  console.log('     ' + Array.from({ length: nx }, (_, i) => (i * CELL) % 4 === 0 ? String(Math.round(i * CELL)).padEnd(1) : ' ').join('').replace(/(\d)(\d) /g, '$1$2').slice(0, nx));
  for (let j = 0; j < nz; j++) console.log(`${String((j * CELL) % 2 === 0 ? j * CELL : '').padStart(4)} ${grid[j].join('')}`);
}

// ───────────── the checks
console.log(`\n${name}: checks`);
{ // (a file that carries scenarios.quiet deals one patrol SET a run: the shift is a set's men, not every route in the file)
  const sets: string[][] | undefined = level.scenarios?.quiet?.patrols, sizes = sets?.length ? sets.map(x => x.length) : [level.routes.length];
  pass(sizes.every(n => n >= 4 && n <= 6), 'the shift is four to six men', `${sets?.length ? `${sets.length} patrol sets of ${sizes.join(' / ')} from ` : ''}${level.routes.length} routes, ${(level.civilians ?? []).length} civilians`); }
for (const [i, r] of (level.routes as any[]).entries()) {
  const bad = r.points.filter((p: number[]) => !free(p)); let legs = 0, m = 0, broken = '';
  for (let k = 0; k < r.points.length; k++) { const a = r.points[k], b = r.points[(k + 1) % r.points.length]; if (r.points.length < 2) break; const p = path(a, b); if (!p) { broken = `${k}→${(k + 1) % r.points.length}`; break; } legs++; m += len([a, ...p]); }
  const waits = (r.wait as number[]).reduce((a, b) => a + b, 0);
  pass(!bad.length && !broken, `route ${i + 1} '${r.name}': ${r.points.length} waypoints on free floor, every leg walkable`, bad.length ? `in a solid: ${bad.map((p: number[]) => `(${p[0]}, ${p[2]})`).join(' ')}` : broken ? `no path on leg ${broken}` : `${m.toFixed(0)} m a lap, ${waits.toFixed(0)} s of pauses, about ${(m / g.tune.guardWalk + waits).toFixed(0)} s round`);
}
{ const S = level.playerSpawn, near = (g.guards as any[]).filter(x => flat(x.char.pos, S) < 8 && !g.col.segmentBlocked([x.char.pos[0], 1.6, x.char.pos[2]], [S[0], 1.2, S[2]]));
  pass(free(S), 'the spawn is free floor', `(${S[0]}, ${S[2]})`);
  pass(!near.length, 'nobody of the shift starts inside 8 m of the spawn with a line to it', near.map((x: any) => `${x.callsign} at ${flat(x.char.pos, S).toFixed(1)} m`).join(', ')); }
const R = M.serverRoom, entry = g.doors.byName(M.entryDoor), exit = g.doors.byName(M.exfilDoor), S = level.playerSpawn as P3;
pass(!!entry, `the objective's door '${M.entryDoor}' is on the level`); pass(!!exit, `the way out '${M.exfilDoor}' is on the level`);
const mid: P3 = [(R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2];
let stand: P3 | null = null; for (const [dx, dz] of [[0, 0.65], [0, -0.65], [0.65, 0], [-0.65, 0], [0, 0.9], [0, -0.9]]) { const q: P3 = [M.rack.front[0] + dx, 0, M.rack.front[2] + dz]; if (free(q) && path(S, q)) { stand = q; break; } }
pass(!!stand, 'the thing to take has a place to stand at its face, reached from the spawn', stand ? `(${stand[0].toFixed(2)}, ${stand[2].toFixed(2)})` : `nothing free within 0.9 m of (${M.rack.front[0]}, ${M.rack.front[2]})`);
pass(!!stand && stand[0] > R.x0 && stand[0] < R.x1 && stand[2] > R.z0 && stand[2] < R.z1, 'that place is inside the objective room');
const ex: P3 = [M.exfilX + 0.9, 0, M.exfilZ];
{ const p = path(stand ?? mid, ex); pass(!!p, 'the way out is reached on foot from the objective', p ? `${len(p).toFixed(0)} m` : `no path to (${ex[0]}, ${ex[2]})`); }
pass(S[0] < M.exfilX || Math.abs(S[2] - M.exfilZ) >= 1.8, 'the spawn is not already past the way out');
// the short way in, and a dark way in. The dark way: the same search over a grid that prices light (a cell's cost × (1 + 40 · visibility)): Dijkstra on this tool's own cells.
if (stand) {
  const short = path(S, stand)!; const f = lit([S, ...short], 0.3);
  pass(f > 0.12, 'the short way in crosses light', `${len([S, ...short]).toFixed(0)} m, ${(f * 100).toFixed(0)}% of it lit past 0.3`);
  const idx = (i: number, j: number) => j * nx + i, cost = new Float64Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
  const s = idx(Math.floor(S[0] / CELL), Math.floor(S[2] / CELL)), t = idx(Math.floor(stand[0] / CELL), Math.floor(stand[2] / CELL)); cost[s] = 0;
  const heap: [number, number][] = [[0, s]];
  while (heap.length) { let bi = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k; const [c, u] = heap.splice(bi, 1)[0]; if (done[u]) continue; done[u] = 1; if (u === t) break; const ui = u % nx, uj = (u - ui) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const i = ui + di, j = uj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz || V[j][i] < 0) continue; if (di && dj && (V[uj][i] < 0 || V[j][ui] < 0)) continue;
      const w = Math.hypot(di, dj) * CELL * (1 + 40 * Math.max(0, V[j][i] - 0.08)), v = idx(i, j); if (c + w < cost[v]) { cost[v] = c + w; from[v] = u; heap.push([c + w, v]); } } }
  if (from[t] < 0 && t !== s) pass(false, 'a dark way in exists', 'the cell search found no way at all');
  else { const cells: number[][] = []; for (let u = t; u >= 0; u = from[u]) { const i = u % nx, j = (u - i) / nx; cells.unshift([(i + 0.5) * CELL, 0, (j + 0.5) * CELL]); if (u === s) break; }
    // (lit metres INSIDE the objective room are the room's own lamp — his to put out from the door — and are told apart: the way TO the room is what must be dark)
    let worst = 0, litM = 0, roomM = 0; for (const c of cells) { const v = vis(c[0], c[2]), inRoom = c[0] > R.x0 && c[0] < R.x1 && c[2] > R.z0 && c[2] < R.z1; if (inRoom) { if (v > 0.3) roomM += CELL; continue; } worst = Math.max(worst, v); if (v > 0.3) litM += CELL; }
    pass(litM <= 2.0, 'a dark way to the objective room exists (shut doors taken as open, no lights put out)', `${len(cells).toFixed(0)} m against the short way's ${len([S, ...short]).toFixed(0)}; ${litM.toFixed(1)} m of it lit past 0.3 before the room, its brightest cell ${worst.toFixed(2)}${roomM ? `; ${roomM.toFixed(1)} m lit inside the room itself` : ''}`); }
}
{ const roofs = roofsOf(level.boxes); let n = 0; for (const b of level.boxes as any[]) { const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1]; if (y0 >= WORLD.ceilingY - 0.25 && y1 <= WORLD.ceilingY + 0.45 && b.h[0] >= 0.45 && b.h[2] >= 0.45) n++; }
  pass(n <= 4, 'four roofs or fewer (a picked weather keeps the four largest dry)', `${n} roof slabs, ${roofs.length} kept`); }
{ const T = (g.targets as any[]).filter(t => t.kind !== 'device'), mains = T.filter(t => t.mains !== false);
  note(`${T.length} lights a round or the OCP puts out (${mains.length} on the mains: the breaker's), ${(level.devices ?? []).length} devices: ${(level.devices ?? []).map((d: any) => `${d.kind} ${d.name}`).join(', ') || 'none'}`);
  note(`lights: ${T.map(t => `${t.name}${t.mains === false ? ' (battery)' : ''}${t.factor > 0 ? '' : ' (off)'}`).join(', ')}`); }
console.log(fails ? `\n=== quiet-light ${name}: ${fails} FAIL ===` : `\n=== quiet-light ${name}: ALL PASS ===`);
// --clock N: the shift's first N seconds with nobody to see (the player made invisible): where each man is every 2 s and which way he looks — the timetable a
// patrol set is tuned against. A man standing still is marked '·'.
if (flag('--clock')) {
  const N = Number(flag('--clock')), E = Number(flag('--every') ?? 2);
  console.log = console.warn = () => { };
  const W2: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8'))) });
  console.log = log;
  const g2 = W2.game; g2.playerInvisible = true; if ('invisible' in g2) g2.invisible = true;
  const arrow = (d: number[]) => '→↘↓↙←↖↑↗'[((Math.round(Math.atan2(d[2], d[0]) / (Math.PI / 4)) % 8) + 8) % 8];
  console.log(`\n${name}: the shift's first ${N} s — (x, z) and the way each man looks; '·' = standing`);
  console.log('   t  ' + (g2.guards as any[]).map((x, i) => `${(level.routes[i]?.name ?? x.name ?? i).toString().padEnd(17)}`).join(''));
  let last = (g2.guards as any[]).map(x => [...x.char.pos]);
  for (let f = 0; f <= N * 60; f++) {
    if (f % (E * 60) === 0) { console.log(`${String(f / 60).padStart(4)}  ` + (g2.guards as any[]).map((x, i) => { const c = x.char, hd = c.headDir ? c.headDir() : c.chestDir, still = flat(c.pos, last[i]) < 0.3; last[i] = [...c.pos]; return `${`(${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)})`.padEnd(13)}${arrow(hd)}${still ? '·' : ' '}  `; }).join('')); }
    W2.step(1 / 60);
  }
}
process.exit(fails ? 1 : 0);
