// THE GLASSHOUSE's own facts, asked of the level as the game stands it (levels/glasshouse.json; the mission's one idea: glass is not cover):
//   bun run tools/qa/glasshouse-check.ts          (also `probes.ts glasshouse`; run it under TPS_PROFILE=shipped too)
// 1  the file is what its generator writes (tools/levels/export.ts glasshouse --check)
// 2  panes: how many, and no more than the renderer lists (MAX_GLASS 32)
// 3  no compass word in any door id, room name, place name or 'from' word a player reads
// 4  both ways in stage: the four on that way's marks, seven defenders in the rooms
// 5  THE FORECOURT: marks of three DIFFERENT rooms each have a line to a point of the forecourt that is open with glass taken as see-through and shut with
//    glass taken as solid (so glass, and nothing else, is what stands between), and along that line a rifle's line of FIRE is open with rounds through glass
//    on (the page's rule; the check raises GLASSPEN.on for these lines on either stand) and shut with the rule off
// 6  WAY 1 (the side of the building): no defender mark sees any of the team's marks, with the doors as staged and with every door leaf taken out
// 7  WAY 2 (the back lot): the same; and for every mark outside the store it is the building's walls alone that shut the line (leaves out)
// 8  THE STORE IS BLIND with its doors open (every leaf taken out): no mark outside it, no floor point of the lab, the office or the glasshouse has a
//    line of sight (glass see-through) to any point of the store's own side of the racks
// 9  the light the idea stands on, by the headless stand-in of the meter (guards.ts lightEstimateAt: direct light, no bounce): the forecourt reads bright;
//    the glazed rooms' marks and BOTH starts read dark (one bar, well under the forecourt's: no number passes both); the blind store reads lit
// GLASSHOUSE_BREAK=1 = way 1's start is stood where it was first built, on the road in front of the glass at the lamps' edge (lines 6 and 9 must fail).
// Exit 0 = every line holds, 1 = one does not.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function glasshouseCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`);
  let ok = true;
  const line = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!pass) ok = false; };
  console.log('\n=== glasshouse: the forecourt is seen and shot through glass, both starts are dark and unseen, the store is blind ===');
  const BREAK = process.env.GLASSHOUSE_BREAK === '1';

  // 1 — the file is fresh
  const fresh = Bun.spawnSync(['bun', 'run', `${ROOT}/tools/levels/export.ts`, 'glasshouse', '--check'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  line(fresh.exitCode === 0, 'levels/glasshouse.json is what tools/levels/glasshouse.ts writes', fresh.exitCode === 0 ? '' : `export --check exit ${fresh.exitCode}`);

  const data = parseLevelData(readFileSync(`${ROOT}/levels/glasshouse.json`, 'utf8'));
  const wayWas = ROOMCLEAR.way, penWas = GLASSPEN.on, log = console.log;
  const stage = async (way: number) => {
    console.log = () => { };
    try {
      const W = await standUp({ level: loadLevel(data), seed: 1 });
      W.game.godMode = true; ROOMCLEAR.way = way;
      const why: string | undefined = startFromQuery(W.game, '?levelFile=glasshouse.json&roomclear=0&squad4').why;
      for (let i = 0; i < 30; i++) { W.game.player.visibility = 0.05; W.step(1 / 60); }
      return { W, why };
    } finally { console.log = log; }
  };
  try {
    const A = await stage(1), g = A.W.game, S = g.level.scenarios.roomClear;
    // 2 — panes
    const panes = (data.boxes as any[]).filter(b => (b.flags ?? []).includes('Glass')).length;
    line(panes > 0 && panes <= 32, `panes: ${panes} (the renderer lists 32)`);
    // 3 — names
    const COMPASS = /(^|[^a-z])(north|south|east|west|n|s|e|w|ne|nw|se|sw)([^a-z]|$)/i;
    const names: string[] = [S.name, ...g.doors.list.map((d: any) => d.def.name), ...S.rooms.flatMap((r: any) => [r.id, r.name, ...r.doors.flatMap((d: any) => [d.id, d.from])]), ...(g.level.scenarios.places?.areas ?? []).map((a: any) => a.name)];
    const bad = [...new Set(names.filter(n => COMPASS.test(String(n).replace(/_/g, ' '))))];
    line(bad.length === 0, 'no compass word in a door id, a room name, a place name or a door\'s "from"', bad.length ? `has one: ${bad.join(', ')}` : [...new Set(names)].join(' · '));

    // 4 — both ways stage
    const B = await stage(2), gb = B.W.game;
    const on = (G: any, T: any) => { const ops = G.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
      const far = Math.max(Math.hypot(G.player.char.pos[0] - T.sam[0], G.player.char.pos[2] - T.sam[2]), ...ops.map((o: any) => Math.min(...T.ops.map((p: number[]) => Math.hypot(o.char.pos[0] - p[0], o.char.pos[2] - p[2])))));
      return { ops: ops.length, far, foes: G.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length }; };
    const a = on(g, S.team), b = on(gb, S.starts[0]);
    line(!A.why && !B.why && a.ops === 4 && b.ops === 4 && a.far < 1.5 && b.far < 1.5 && a.foes === 7 && b.foes === 7, 'both ways in stage: four teammates on that way\'s marks, seven defenders',
      `way 1: ${A.why ?? `${a.ops} teammates, farthest ${a.far.toFixed(2)} m off a mark, ${a.foes} defenders`} · way 2: ${B.why ?? `${b.ops} teammates, farthest ${b.far.toFixed(2)} m off a mark, ${b.foes} defenders`}`);

    // 5 — the forecourt through glass (the level's own collision, doors as staged: shut)
    const way1 = BREAK ? { sam: [20, 0, 25.4], ops: [[19, 0, 26.3], [21, 0, 26.3], [19, 0, 27.2], [21, 0, 27.2]] } : S.team, way2 = S.starts[0];
    const marks = S.rooms.flatMap((r: any) => r.marks.map((m: any, i: number) => ({ id: r.id as string, room: r.name as string, i, eye: [m.pos[0], 1.6, m.pos[2]] as number[] })));
    const places = (T: any) => [T.sam, ...T.ops].flatMap((p: number[]) => [[p[0], 1.2, p[2]], [p[0], 1.6, p[2]]]);
    const grid = (x0: number, x1: number, z0: number, z1: number, step: number, ys: number[]) => { const out: number[][] = []; for (let x = x0; x <= x1 + 1e-6; x += step) for (let z = z0; z <= z1 + 1e-6; z += step) for (const y of ys) out.push([x, y, z]); return out; };
    const col = g.col, rifle = GLASSPEN.energy.aks74u as number;
    const court = grid(12, 28, 19.5, 23.5, 1, [1.2, 1.6]);
    const fireAt = (a: number[], b: number[], on: boolean) => { GLASSPEN.on = on; try { return !col.shotBlocked(a, b, 0.02, rifle); } finally { GLASSPEN.on = penWas; } };
    const thru = marks.filter((m: any) => court.some(p => !col.segmentBlocked(m.eye, p) && col.solidBlocked(m.eye, p) && fireAt(m.eye, p, true) && !fireAt(m.eye, p, false)));
    const openNoGlass = marks.filter((m: any) => court.some(p => !col.solidBlocked(m.eye, p)));
    const rooms = [...new Set(thru.map((m: any) => m.room))];
    const say = (L: any[]) => L.map(l => `${l.room} mark ${l.i}`).join(', ') || 'none';
    line(rooms.length >= 3 && openNoGlass.length === 0,
      'the forecourt: marks of three different rooms have a line to it that is open with glass see-through and shut with glass solid, a rifle\'s fire open along it with rounds through glass on and shut with the rule off',
      `rooms: ${rooms.join(', ') || 'none'} · marks: ${say(thru)} · marks with a line to it through no glass at all: ${say(openNoGlass)}`);

    // 6, 7 — the two starts: unseen, doors as staged and with every leaf out
    const leavesOut = <T>(fn: () => T): T => { const was = col.dynamicBoxes; col.dynamicBoxes = []; try { return fn(); } finally { col.dynamicBoxes = was; } };
    const sees = (T: any) => marks.filter((m: any) => places(T).some((p: number[]) => !col.segmentBlocked(m.eye, p)));
    const s1 = sees(way1), s1o = leavesOut(() => sees(way1));
    line(s1.length === 0 && s1o.length === 0, 'way 1 (the side of the building): no defender mark sees any of the team\'s marks, doors shut or every leaf out',
      s1.length + s1o.length ? `see it: ${say(s1)} · leaves out: ${say(s1o)}` : `${marks.length} marks asked against ${places(way1).length / 2} places, twice`);
    const s2 = sees(way2), s2o = leavesOut(() => sees(way2)).filter((m: any) => m.id !== 'store');
    const s2store = leavesOut(() => sees(way2)).filter((m: any) => m.id === 'store');
    line(s2.length === 0 && s2o.length === 0, 'way 2 (the back lot): no defender mark sees any of the team\'s marks, and for every mark outside the store the walls alone shut the line (every leaf out)',
      s2.length + s2o.length ? `see it: ${say(s2)} · leaves out, outside the store: ${say(s2o)}` : `${marks.length} marks asked · store marks that would see it through the back doorway were its leaf away: ${say(s2store)}`);

    // 8 — the store is blind with its doors open
    const R = (id: string) => S.rooms.find((r: any) => r.id === id).bounds, inset = (b: any, step: number) => grid(b.x0 + 0.2, b.x1 - 0.2, b.z0 + 0.2, b.z1 - 0.2, step, [1.6]);
    const eyes = [...marks.filter((m: any) => m.id !== 'store').map((m: any) => m.eye), ...inset(R('lab'), 0.25), ...inset(R('office'), 0.5), ...inset(R('glasshouse'), 0.5)];
    const own = grid(10.3, STORE_OWN_X, 8.3, 12.8, 0.25, [1.2, 1.6]);
    const leak = leavesOut(() => { const out: string[] = []; for (const e of eyes) { const p = own.find(q => !col.segmentBlocked(e, q)); if (p) out.push(`(${e[0].toFixed(2)}, ${e[2].toFixed(2)}) sees (${p[0].toFixed(2)}, ${p[2].toFixed(2)})`); } return out; });
    line(leak.length === 0, `the store is blind with every door leaf out: no mark outside it and no floor point of the lab, the office or the glasshouse sees its own side of the racks (x up to ${STORE_OWN_X})`,
      leak.length ? `${leak.length} of ${eyes.length} eyes see in: ${leak.slice(0, 6).join(' · ')}` : `${eyes.length} eyes asked against ${own.length} points`);

    // 9 — the light
    const vis = (p: number[]) => g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]]), lightEstimateAt(g, [p[0], 1.6, p[2]]))) as number;
    const glazed = S.rooms.filter((r: any) => r.id !== 'store').flatMap((r: any) => r.marks.map((m: any) => vis(m.pos)));
    const courtL = [[20, 0, 21], [14.3, 0, 20.5], [25.7, 0, 20.5], [17, 0, 20], [23, 0, 20]].map(vis), w1 = [way1.sam, ...way1.ops].map(vis), w2 = [way2.sam, ...way2.ops].map(vis), store = vis([13, 0, 10.5]);
    const f2 = (L: number[]) => `${Math.min(...L).toFixed(2)}‥${Math.max(...L).toFixed(2)}`;
    line(Math.min(...courtL) > COURT_LO && Math.max(...glazed) < DARK_HI && Math.max(...w1) < DARK_HI && Math.max(...w2) < DARK_HI && store > STORE_LO,
      `the forecourt reads over ${COURT_LO}; every mark in a glazed room and both ways' starts under ${DARK_HI}; the store over ${STORE_LO}`,
      `forecourt ${f2(courtL)} · glazed rooms' marks ${f2(glazed)} · way 1's start ${f2(w1)} · way 2's start ${f2(w2)} · store ${store.toFixed(2)}`);
    console.log(ok ? '=== glasshouse: ALL PASS ===' : '=== glasshouse: FAILURES above ===');
    return ok;
  } finally { ROOMCLEAR.way = wayWas; GLASSPEN.on = penWas; console.log = log; }
}
// bounds: the forecourt read 0.49 and up on both stands, the dark places 0.00; the bars are far apart so that no one number passes both.
// STORE_OWN_X: the racks' own face is at x 15.6; the half metre beside it is the way round, not the room's own side.
const COURT_LO = 0.4, DARK_HI = 0.1, STORE_LO = 0.4, STORE_OWN_X = 15.0;

if (import.meta.main) process.exit((await glasshouseCheck()) ? 0 : 1);
