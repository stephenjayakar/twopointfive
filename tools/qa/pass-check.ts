// THE PASS's own facts, asked of the level as the game stands it (levels/pass.json: a level made for snow — the snow on the ground is in the file):
//   bun run tools/qa/pass-check.ts          (also `probes.ts pass`; run it under TPS_PROFILE=shipped too)
// 1  the file is what its generator writes (tools/levels/export.ts pass --check)
// 2  ROOFS: exactly four ceiling slabs, all four the weather's (game/weather.ts roofsOf takes four: a fifth would be rained and snowed through)
// 3  NOTHING WHITE UNDER A ROOF: no box in the fresh-snow paint stands under a roof, and the floor under every roof is not snow
// 4  open sky: the share of the ground inside the yard wall that no roof covers (a third or more: the yard is where the snow shows)
// 5  THE PAINT: every snow paint reads as the ground to a round and a blast (asphalt → concrete; never steel, glass, wood or metal), and every box of the
//    'snow.*' groups wears one (or bare earth)
// 6  FEET: every drift is 0.19 m or under (men wade it); every piece of snow that stops feet (over 0.2 m) is 1.4 m or more from every door's leaf;
//    and a man can stand on every square of every trodden path (the footstep map's own squares) and on every teammate's mark of both ways in
// 7  no compass word in any door id, room name, place name or 'from' word a player reads
// 8  both ways in stage: the four on that way's marks, eight defenders in the rooms
// 9  BOTH STARTS ARE UNSEEN: no defender mark sees any of the team's marks, with the doors as staged and with every door leaf taken out (glass is
//    see-through: a window counts). Way 2 stands before the kitchen's back door: with the leaves out the kitchen's own marks are left out of that line
// 10 THE LORRY SCREENS THE GATEWAY from the tea room: no mark of the tea room has a line to the gateway's west two thirds; the bunk room's window has the
//    gateway through glass (a line open with glass see-through and shut with glass solid); and the tea room has the yard on both sides of the lorry
//    through glass
// 11 the light, by the headless stand-in of the meter (guards.ts lightEstimateAt: direct light, no moon, no bounce): the gateway reads lit, both starts dark
// PASS_BREAK=1 = way 1's start is stood in the gateway under its lamp (lines 9 and 11 must fail) and a bank is stood back at the back wall's outside foot (line 6, feet).
// Exit 0 = every line holds, 1 = one does not. Nothing here looks at a picture: never seen on a GPU.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function passCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { nvgPlaceLight } = await import(`${ROOT}/src/game/nvg.ts`);
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { roofsOf } = await import(`${ROOT}/src/game/weather.ts`);
  const { SNOW_PALETTE, gwotSimOf } = await import(`${ROOT}/src/scene/gwotPalette.ts`);
  const { paletteName, surfOf } = await import(`${ROOT}/src/game/particleFx.ts`);
  const { steelGrey, breakClassOf } = await import(`${ROOT}/src/game/furnblast.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  let ok = true;
  const line = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!pass) ok = false; };
  console.log('\n=== pass: four roofs, nothing white under one, snow that reads as ground and stops no door, both starts dark and unseen ===');
  const BREAK = process.env.PASS_BREAK === '1';

  // 1 — the file is fresh
  const fresh = Bun.spawnSync(['bun', 'run', `${ROOT}/tools/levels/export.ts`, 'pass', '--check'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  line(fresh.exitCode === 0, 'levels/pass.json is what tools/levels/pass.ts writes', fresh.exitCode === 0 ? '' : `export --check exit ${fresh.exitCode}`);

  const data = parseLevelData(readFileSync(`${ROOT}/levels/pass.json`, 'utf8'));
  const groups: string[] = (data.boxes as any[]).map(b => b.group ?? '');
  const wayWas = ROOMCLEAR.way, log = console.log;
  const stage = async (way: number) => {
    console.log = () => { };
    try {
      const W = await standUp({ level: loadLevel(data), seed: 1 });
      W.game.godMode = true; ROOMCLEAR.way = way;
      const why: string | undefined = startFromQuery(W.game, '?levelFile=pass.json&roomclear=0&squad4').why;
      for (let i = 0; i < 30; i++) { W.game.player.visibility = 0.05; W.step(1 / 60); }
      return { W, why };
    } finally { console.log = log; }
  };
  try {
    const A = await stage(1), g = A.W.game, S = g.level.scenarios.roomClear, boxes: any[] = g.level.boxes;
    const key = (a: number[]) => a.join(','), SNOW = new Map<string, string>(Object.entries(SNOW_PALETTE).map(([n, a]) => [key(a as number[]), n]));
    const paintOf = (b: any): string | undefined => SNOW.get(key(b.albedo));
    const ext = (b: any) => { const c = Math.abs(Math.cos(b.yaw || 0)), s = Math.abs(Math.sin(b.yaw || 0)); return [b.h[0] * c + b.h[2] * s, b.h[0] * s + b.h[2] * c]; };
    const top = (b: any) => b.c[1] + b.h[1], f2 = (v: number) => v.toFixed(2);

    // 2 — roofs
    const band = boxes.filter(b => b.c[1] - b.h[1] >= WORLD.ceilingY - 0.25 && top(b) <= WORLD.ceilingY + 0.45 && b.h[0] >= 0.45 && b.h[2] >= 0.45);
    const roofs: number[][] = roofsOf(boxes);
    line(band.length === 4 && roofs.length === 4, `roofs: ${band.length} ceiling slabs, ${roofs.length} of them the weather's (four, and none left over)`,
      roofs.map(r => `x ${f2(r[0])}‥${f2(r[2])} z ${f2(r[1])}‥${f2(r[3])}`).join(' · '));
    const slabs = band.map(b => [b.c[0] - b.h[0], b.c[2] - b.h[2], b.c[0] + b.h[0], b.c[2] + b.h[2]]);
    const under = (x: number, z: number) => slabs.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]);

    // 3 — nothing white under a roof
    const white = boxes.map((b, i) => ({ b, i })).filter(({ b, i }) => i > 0 && paintOf(b) === 'snow' && !(b.flags & BoxFlag.NoPrimary)).filter(({ b }) => { const [ex, ez] = ext(b);
      return slabs.some(r => b.c[0] + ex > r[0] + 0.02 && b.c[0] - ex < r[2] - 0.02 && b.c[2] + ez > r[1] + 0.02 && b.c[2] - ez < r[3] - 0.02); });
    /** the paint of what a man stands on at (x, z): the highest drawn top at or under 2 cm */
    const floorPaint = (x: number, z: number) => { let best: any = null; for (const b of boxes) { if (b.flags & BoxFlag.NoPrimary || top(b) > 0.02 || Math.abs(b.c[0] - x) > b.h[0] || Math.abs(b.c[2] - z) > b.h[2] || (b.yaw && Math.abs(Math.sin(b.yaw)) > 1e-6)) continue; if (!best || top(b) > top(best)) best = b; } return best ? paintOf(best) ?? 'other' : 'none'; };
    let bare = 0, asked = 0; for (const r of slabs) for (let x = r[0] + 0.3; x < r[2] - 0.2; x += 0.5) for (let z = r[1] + 0.3; z < r[3] - 0.2; z += 0.5) { asked++; if (floorPaint(x, z) === 'snow') bare++; }
    line(white.length === 0 && bare === 0, 'nothing white under a roof: no box in the fresh-snow paint under a ceiling slab, and no floor point under one that is snow',
      white.length + bare ? `${white.length} snow boxes under a roof (${white.slice(0, 5).map(w => `${groups[w.i]} at ${f2(w.b.c[0])}, ${f2(w.b.c[2])}`).join(' · ')}) · ${bare} of ${asked} floor points` : `${asked} floor points asked under the four roofs`);

    // 4 — open sky inside the wall
    { let n = 0, open = 0; for (let x = 6.25; x < 34; x += 0.5) for (let z = 5.25; z < 22; z += 0.5) { n++; if (!under(x, z)) open++; }
      line(open / n >= 1 / 3, `open sky: ${(100 * open / n).toFixed(0)} % of the ground inside the yard wall has no roof over it (a third or more)`); }

    // 5 — the paint
    const reads = Object.entries(SNOW_PALETTE).map(([n, a]) => ({ n, sim: gwotSimOf(a), name: paletteName(a), surf: surfOf(a), steel: steelGrey(a), cls: breakClassOf(a) }));
    const snowBoxes = boxes.map((b, i) => ({ b, i })).filter(({ i }) => groups[i]?.startsWith('snow.'));
    const odd = snowBoxes.filter(({ b }) => !paintOf(b) && paletteName(b.albedo) !== 'asphalt');
    line(reads.every(r => r.sim === 'asphalt' && r.name === 'asphalt' && r.surf === 'concrete' && !r.steel && r.cls === 'hard') && odd.length === 0 && snowBoxes.length > 100,
      'the snow paints read as the ground to a round and a blast (asphalt → concrete, no steel cabinet), and every box of the snow groups wears one or bare earth',
      `${reads.map(r => `${r.n}: ${r.sim} / ${r.surf}${r.steel ? ' STEEL' : ''}`).join(' · ')} · ${snowBoxes.length} snow boxes${odd.length ? ` · ${odd.length} in another paint` : ''}`);

    // 6 — feet
    const solid = (b: any) => !(b.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass));
    const drifts = snowBoxes.filter(({ b, i }) => groups[i] === 'snow.drifts' && solid(b)), tall = drifts.filter(({ b }) => top(b) > 0.19);
    const stops = boxes.map((b, i) => ({ b, i })).filter(({ b, i }) => i > 0 && solid(b) && ['snow', 'snowPacked', 'snowOld'].includes(paintOf(b) as string) && top(b) > 0.2);
    const leafEnds = g.doors.list.map((d: any) => { const h = d.def.hinge, w = d.def.width, cd = d.def.closedDir; return { name: d.def.name as string, a: [h[0], h[1]], b: [h[0] + Math.cos(cd) * w, h[1] + Math.sin(cd) * w] }; });
    const segDist = (px: number, pz: number, a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz); };
    /** a box's nearest point to a door's leaf, to a few centimetres: its outline walked at 10 cm */
    const boxToDoor = (b: any, D: any) => { let best = 1e9; const cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0);
      for (let u = -b.h[0]; u <= b.h[0] + 1e-9; u += Math.min(0.1, b.h[0] * 2 || 0.1)) for (let v = -b.h[2]; v <= b.h[2] + 1e-9; v += Math.min(0.1, b.h[2] * 2 || 0.1)) best = Math.min(best, segDist(b.c[0] + cs * u + sn * v, b.c[2] - sn * u + cs * v, D.a, D.b));
      return best; };
    const near = stops.map(({ b, i }) => { const d = leafEnds.map((D: any) => ({ D, m: boxToDoor(b, D) })).sort((p: any, q: any) => p.m - q.m)[0]; return { i, b, door: d.D.name as string, m: d.m as number }; }).filter(x => x.m < 1.4);
    const stand = (p: number[]) => { const q: [number, number, number] = [p[0], 0, p[2]]; return !(g.col.collideCircle(q, 0.34, 0.25, 1.5, 1) && Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.005); };
    const pathSq = ((data as any).surfaces?.zones ?? []).filter((z: any) => String(z.id).startsWith('path_')), offPath = pathSq.filter((z: any) => !stand([(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2]));
    const teamMarks = [S.team, ...(S.starts ?? [])].flatMap((T: any) => [T.sam, ...T.ops]), offMark = teamMarks.filter((p: number[]) => !stand(p));
    // (no snow that stops feet at the OUTSIDE foot of the yard's walls, 6‥34 × 5‥22: a wall charge is set from 0.5 m off the face, and a bank there left the whole
    // wall 'no room at that wall.' — the maintainer, 10-15: "still seeing no room on this wall here")
    const plan = (b: any) => { const t = Math.abs(Math.sin(b.yaw || 0)) > 0.7, hx = t ? b.h[2] : b.h[0], hz = t ? b.h[0] : b.h[2]; return { x0: b.c[0] - hx, x1: b.c[0] + hx, z0: b.c[2] - hz, z1: b.c[2] + hz }; };
    if (BREAK) stops.push({ b: { c: [14.6, 0.155, 4.555], h: [7.99, 0.155, 0.315], yaw: Math.PI, flags: 0, albedo: boxes[0].albedo } as any, i: -1 });   // (a bank stood back at the back wall's outside foot, as the file had it: this line must fail)
    const atFoot = stops.filter(({ b }) => { const a = plan(b), inX = a.x1 > 6 && a.x0 < 34, inZ = a.z1 > 5 && a.z0 < 22;
      return (inZ && ((a.x1 > 4.9 && a.x0 < 5.88) || (a.x0 < 35.1 && a.x1 > 34.12))) || (inX && ((a.z1 > 3.9 && a.z0 < 4.88) || (a.z0 < 23.1 && a.z1 > 22.12))); });
    line(drifts.length > 20 && tall.length === 0 && near.length === 0 && atFoot.length === 0 && pathSq.length > 40 && offPath.length === 0 && offMark.length === 0,
      'feet: every drift is 0.19 m or under; no snow that stops feet within 1.4 m of a door\'s leaf or at the outside foot of the yard\'s walls; a man can stand on every square of the trodden paths and on every teammate\'s mark',
      `${drifts.length} drift boxes, the tallest ${f2(Math.max(...drifts.map(({ b }) => top(b))))} m · ${stops.length} boxes of snow over 0.2 m${atFoot.length ? ` (${atFoot.length} AT THE OUTSIDE FOOT OF A YARD WALL: ${atFoot.slice(0, 3).map(x => `${groups[x.i]} at ${f2(x.b.c[0])}, ${f2(x.b.c[2])}`).join(' · ')})` : ' (none at the outside foot of a yard wall)'}${near.length ? `, ${near.length} near a door: ${near.slice(0, 4).map(x => `${groups[x.i]} ${f2(x.m)} m from '${x.door}'`).join(' · ')}` : ', the nearest to a door ' + f2(Math.min(...stops.map(({ b }) => Math.min(...leafEnds.map((D: any) => boxToDoor(b, D)))))) + ' m'} · ${pathSq.length} path squares${offPath.length ? `, ${offPath.length} not standable: ${offPath.slice(0, 4).map((z: any) => `${z.id} (${f2((z.x0 + z.x1) / 2)}, ${f2((z.z0 + z.z1) / 2)})`).join(' · ')}` : ''} · ${teamMarks.length} team marks${offMark.length ? `, ${offMark.length} not standable` : ''}`);

    // 7 — names
    const COMPASS = /(^|[^a-z])(north|south|east|west|n|s|e|w|ne|nw|se|sw)([^a-z]|$)/i;
    const names: string[] = [S.name, ...g.doors.list.map((d: any) => d.def.name), ...S.rooms.flatMap((r: any) => [r.id, r.name, ...r.doors.flatMap((d: any) => [d.id, d.from])]), ...(g.level.scenarios.places?.areas ?? []).map((a: any) => a.name)];
    const bad = [...new Set(names.filter(n => COMPASS.test(String(n).replace(/_/g, ' '))))];
    line(bad.length === 0, 'no compass word in a door id, a room name, a place name or a door\'s "from"', bad.length ? `has one: ${bad.join(', ')}` : [...new Set(names)].join(' · '));

    // 8 — both ways stage
    const B = await stage(2), gb = B.W.game;
    const on = (G: any, T: any) => { const ops = G.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
      const far = Math.max(Math.hypot(G.player.char.pos[0] - T.sam[0], G.player.char.pos[2] - T.sam[2]), ...ops.map((o: any) => Math.min(...T.ops.map((p: number[]) => Math.hypot(o.char.pos[0] - p[0], o.char.pos[2] - p[2])))));
      return { ops: ops.length, far, foes: G.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length }; };
    const a = on(g, S.team), b = on(gb, S.starts[0]);
    line(!A.why && !B.why && a.ops === 4 && b.ops === 4 && a.far < 1.5 && b.far < 1.5 && a.foes === 8 && b.foes === 8, 'both ways in stage: four teammates on that way\'s marks, eight defenders',
      `way 1: ${A.why ?? `${a.ops} teammates, farthest ${a.far.toFixed(2)} m off a mark, ${a.foes} defenders`} · way 2: ${B.why ?? `${b.ops} teammates, farthest ${b.far.toFixed(2)} m off a mark, ${b.foes} defenders`}`);

    // 9 — the two starts: unseen, doors as staged and with every leaf out
    const way1 = BREAK ? { sam: [19.5, 0, 22.6], ops: [[18.8, 0, 23.4], [20.2, 0, 23.4], [18.8, 0, 24.2], [20.2, 0, 24.2]] } : S.team, way2 = S.starts[0];
    const marks = S.rooms.flatMap((r: any) => r.marks.map((m: any, i: number) => ({ id: r.id as string, room: r.name as string, i, eye: [m.pos[0], 1.6, m.pos[2]] as number[] })));
    const places = (T: any) => [T.sam, ...T.ops].flatMap((p: number[]) => [[p[0], 1.2, p[2]], [p[0], 1.6, p[2]]]);
    const col = g.col, say = (L: any[]) => L.map(l => `${l.room} mark ${l.i}`).join(', ') || 'none';
    const leavesOut = <T>(fn: () => T): T => { const was = col.dynamicBoxes; col.dynamicBoxes = []; try { return fn(); } finally { col.dynamicBoxes = was; } };
    const sees = (T: any) => marks.filter((m: any) => places(T).some((p: number[]) => !col.segmentBlocked(m.eye, p)));
    const s1 = sees(way1), s1o = leavesOut(() => sees(way1)), s2 = sees(way2), s2all = leavesOut(() => sees(way2)), s2o = s2all.filter((m: any) => m.id !== 'kitchen'), s2k = s2all.filter((m: any) => m.id === 'kitchen');
    line(s1.length + s1o.length + s2.length + s2o.length === 0, 'both ways in: no defender mark sees any of the team\'s marks, doors shut or every leaf out (way 2 stands before the kitchen\'s back door: there the kitchen\'s own marks are held off by its leaf, every other by the walls)',
      s1.length + s1o.length + s2.length + s2o.length ? `way 1: ${say(s1)} · leaves out: ${say(s1o)} · way 2: ${say(s2)} · leaves out, outside the kitchen: ${say(s2o)}` : `${marks.length} marks asked against ${places(way1).length / 2} places a way, twice · kitchen marks that would see way 2 through the back doorway were its leaf away: ${say(s2k)}`);

    // 10 — the lorry between the gateway and the tea room's windows; the bunk room's window on the gateway; the tea room's on the yard either side
    const gateway: number[][] = []; for (let x = 18.6; x <= 20.4 + 1e-6; x += 0.6) for (let z = 20.6; z <= 21.8 + 1e-6; z += 0.6) for (const y of [1.2, 1.6]) gateway.push([x, y, z]);
    const glassed = (m: any, p: number[]) => !col.segmentBlocked(m.eye, p) && col.solidBlocked(m.eye, p);
    const teaOnGate = marks.filter((m: any) => m.id === 'tea' && gateway.some(p => p[0] < 20 && !col.segmentBlocked(m.eye, p)));
    const bunkOnGate = marks.filter((m: any) => m.id === 'bunk' && gateway.some(p => glassed(m, p)));
    const yardW = [[12.7, 1.2, 16.2], [12.7, 1.6, 16.2]], yardE = [[22.4, 1.2, 16.6], [22.4, 1.6, 16.6]];
    const teaW = marks.filter((m: any) => m.id === 'tea' && yardW.some(p => glassed(m, p))), teaE = marks.filter((m: any) => m.id === 'tea' && yardE.some(p => glassed(m, p)));
    line(teaOnGate.length === 0 && bunkOnGate.length > 0 && teaW.length > 0 && teaE.length > 0, 'the lorry screens the gateway (its west two thirds) from every mark of the tea room; the bunk room has the gateway through glass; the tea room has the yard west and east of the lorry through glass',
      `tea room on the gateway: ${say(teaOnGate)} · bunk room on it through glass: ${say(bunkOnGate)} · tea room on the yard west: ${say(teaW)} · east: ${say(teaE)}`);

    // 11 — the light
    const vis = (p: number[]) => g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]]), lightEstimateAt(g, [p[0], 1.6, p[2]]))) as number;
    const gateL = [[19.5, 0, 21.4], [19.2, 0, 22.2], [20.0, 0, 22.6]].map(vis), w1 = [way1.sam, ...way1.ops].map(vis), w2 = [way2.sam, ...way2.ops].map(vis);
    // … and with the MOON counted, as the page's GPU meter counts it (nvg.ts nvgPlaceLight; the headless estimate above leaves it out): snow is the brightest ground in the game
    const visM = (p: number[]) => g.visibilityOf(Math.max(nvgPlaceLight(g, [p[0], 1.2, p[2]]), nvgPlaceLight(g, [p[0], 1.6, p[2]]))) as number;
    const w1M = [way1.sam, ...way1.ops].map(visM), w2M = [way2.sam, ...way2.ops].map(visM);
    const span = (L: number[]) => `${Math.min(...L).toFixed(2)}‥${Math.max(...L).toFixed(2)}`;
    line(Math.min(...gateL) > GATE_LO && Math.max(...w1) < DARK_HI && Math.max(...w2) < DARK_HI && Math.max(...w1M) < DARK_HI && Math.max(...w2M) < DARK_HI, `the gateway reads over ${GATE_LO}; both ways' starts under ${DARK_HI}, the moon counted or not`,
      `gateway ${span(gateL)} · way 1's start ${span(w1)}, with the moon ${span(w1M)} · way 2's start ${span(w2)}, with the moon ${span(w2M)}`);
    console.log(ok ? '=== pass: ALL PASS ===' : '=== pass: FAILURES above ===');
    return ok;
  } finally { ROOMCLEAR.way = wayWas; console.log = log; }
}
// bounds: read once on both stands (the numbers are in docs/agents/missions.md, the pass's bullet); the two bars are far apart so that no one number passes both.
const GATE_LO = 0.3, DARK_HI = 0.1;

if (import.meta.main) process.exit((await passCheck()) ? 0 : 1);
