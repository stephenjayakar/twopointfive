// THE FLOODLIT YARD's own facts, asked of the level as the game stands it (levels/floodlit.json; the mission's one idea is the mains breaker):
//   bun run tools/qa/floodlit-check.ts          (also `probes.ts floodlit`; run it under TPS_PROFILE=shipped too)
// Every place is read TWICE: by the headless stand-in of the light meter (guards.ts lightEstimateAt: direct light, no moon, no bounce — what every
// headless run of the mission plays on) and by nvg.ts nvgPlaceLight, which adds the MOON as the page's GPU meter does (probe.wgsl sums kind-2 lights).
// A place is dark only if both say so.
// 1  lit: a man standing in the gate, and one mid-yard, reads bright. Outside the wall it is by the stand: with the LIVED things in the level (the shipped
//    stand; scene/lived.ts) a lamp burns on each gate post and over the shed's door — every one of the team's five start marks reads under the goggles' line
//    (so the team stands up all goggled, not half and half), Sam's not black, the shed's door bright; with them out (the frozen stand) the start and the
//    shed's door read dark, as they did before there were lamps. On either stand nobody in the building has a line to a start mark or to the shed's door
// 2  the mains out: the yard's crossing points and the start read next to nothing to a bare eye, by both readings, and a tube still reads the yard
// 3  the mains out: each room by its lantern is dim, never black and never bright, and a tube reads it better than the eye (lived things in: the hall is read on its lantern's side,
//    and the next line reads the side its lockers shade: black. Out: the lantern reaches the back wall)
// 4  no emergency beacon on the level; nobody in the building carries a burning light
// 5  the mission's own verb is there: with the squad's 'work' order live (WORK.on, as the page ships; the check raises it on either stand) g.work offers
//    the breaker as 'throw the breaker' with a place to stand inside the shed, and no defender is dealt into the shed
// FLOODLIT_BREAK=1 = the mains are left ON for lines 2 and 3: both must fail.   Exit 0 = every line holds, 1 = one does not.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function floodlitCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { tubeVis, nvgPlaceLight } = await import(`${ROOT}/src/game/nvg.ts`);
  const { WORK } = await import(`${ROOT}/src/game/workthings.ts`);
  const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`);
  let ok = true;
  const line = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!pass) ok = false; };
  console.log('\n=== floodlit: the yard is lit off the mains, and dark with them out by the headless meter and by the page\'s ===');
  const log = console.log, workWas = WORK.on; console.log = () => { };
  let W: any, why: string | undefined;
  try {
    W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/floodlit.json`, 'utf8'))), seed: 1 });
    W.game.godMode = true; WORK.on = true;   // (after the stand-up: the frozen stand pins it off)
    why = startFromQuery(W.game, '?levelFile=floodlit.json&roomclear&squad4').why;
    for (let i = 0; i < 30; i++) { W.game.player.visibility = 0.05; W.step(1 / 60); }
  } finally { console.log = log; }
  const g = W.game;
  try {
    if (why) { line(false, 'the room clear starts', why); return false; }
    const shed = g.level.scenarios.places.areas.find((a: any) => a.name === 'generator shed').bounds;
    const inB = (p: number[], b: any, m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;
    type Spot = [string, number, number];
    const YARD: Spot[] = [['the gate', 20, 23.4], ['mid yard', 20, 18.5], ['yard west', 8, 18], ['the foot gate', 5, 21.8]];
    const EAVES: Spot[] = [['the front door', 19, 13.8], ['under the guard room window', 12.6, 14.2]];
    const OUT: Spot[] = [['the start', 9, 26.2], ['the shed door', 2.9, 20.6]];
    const MARKS: Spot[] = [['Sam\'s mark', 9, 26.2], ['mark 1', 7.8, 26.7], ['mark 2', 10.2, 26.7], ['mark 3', 6.6, 26.2], ['mark 4', 11.4, 26.2]];   // (floodlit.ts FLOODLIT_SCENARIOS team)
    // the hall with the lived things in: its lockers stand between the floor lantern and the room (floodlit.ts), so the lantern's side is read for line 3 and the far side for the line after it
    const ROOMS: Spot[] = [['guard room window', 12.6, 12.3], ['radio room, by the lantern', 26, 10.6], LIVED.on ? ['hall, the lantern\'s side', 17, 10] : ['hall', 19, 9.5], ['store', 29.2, 10.5]];
    const SHADE: Spot[] = [['hall, the back wall mark', 19, 7], ['hall, the far corner mark', 21.2, 7.4], ['hall, at the radio room\'s door', 21.4, 9]];
    // the PLACE's own light: every carried light is left out (a defender on alert burns his gun light across the yard once the mains are out; that is his, not the yard's)
    const read = (L: Spot[]) => L.map(([n, x, z]) => {
      const E = Math.max(lightEstimateAt(g, [x, 1.2, z], () => true), lightEstimateAt(g, [x, 1.6, z], () => true)), M = Math.max(nvgPlaceLight(g, [x, 1.2, z]), nvgPlaceLight(g, [x, 1.6, z]));
      return { n, vis: g.visibilityOf(E) as number, moon: g.visibilityOf(M) as number, tube: tubeVis(g, M) as number }; });
    const row = (r: ReturnType<typeof read>) => r.map(x => `${x.n} ${x.vis.toFixed(2)} / with the moon ${x.moon.toFixed(2)} (tube ${x.tube.toFixed(2)})`).join(' · ');

    const litY = read(YARD), litO = read(OUT), litM = read(MARKS);
    if (LIVED.on) line(litY[0].vis > 0.6 && litY[1].vis > 0.6 && litM.every(x => x.vis < START_HI && x.moon < START_HI) && litM[0].vis > START_LO && litO[1].vis > 0.6,
      `lit, the lamps outside the wall burning (lived things): the gate and the yard read bright, every start mark under ${START_HI} with Sam's over ${START_LO}, the shed door bright`, `${row(litY.slice(0, 2))} · ${row(litM)} · ${row(litO.slice(1))}`);
    else line(litY[0].vis > 0.6 && litY[1].vis > 0.6 && [...litO, ...litM].every(x => x.vis < 0.1 && x.moon < 0.1), 'lit, no lamp outside the wall (the lived things are out): the gate and the yard read bright, the start and the shed door dark by both readings', `${row(litY.slice(0, 2))} · ${row(litO)}`);
    { const seen: string[] = [];
      for (const gd of g.guards) { if (gd.team !== 'hostile' || gd.state === 'dead') continue;
        for (const [n, x, z] of [...MARKS, OUT[1]]) for (const y of [1.2, 1.6]) if (!g.col.segmentBlocked([gd.char.pos[0], 1.6, gd.char.pos[2]], [x, y, z])) { seen.push(`${gd.callsign} → ${n}`); break; } }
      line(seen.length === 0, 'nobody in the building has a line to a start mark or to the shed\'s door', seen.join(' · ')); }

    const th = g.work.things().find((x: any) => x.kind === 'breaker'), words = th ? g.work.words(th) : '';
    if (process.env.FLOODLIT_BREAK !== '1') g.setBlackout(86400, 'hand');
    for (let i = 0; i < 240; i++) { g.player.visibility = 0.05; W.step(1 / 60); }
    const dY = read(YARD), dO = [...read(OUT), ...read(MARKS).slice(1)], dE = read(EAVES), dR = read(ROOMS);
    line([...dY, ...dO].every(x => x.vis < YARD_EYE && x.moon < YARD_EYE) && dY.every(x => x.tube > YARD_TUBE) && dE.every(x => x.moon < EAVES_EYE), `mains out: the yard's crossing and the start read under ${YARD_EYE} to a bare eye, moon counted (under the eaves, in the lanterns' spill, under ${EAVES_EYE}), and a tube reads the yard over ${YARD_TUBE}`, `${row(dY)} · ${row(dO)} · ${row(dE)}`);
    line(dR.every(x => x.moon > ROOM_LO && x.moon < ROOM_HI && x.tube > x.moon + 0.15), `mains out: each room by its lantern reads between ${ROOM_LO} and ${ROOM_HI}, and a tube reads it better than the eye`, row(dR));
    { const dS = read(SHADE);
      if (LIVED.on) line(dS.every(x => x.vis < YARD_EYE && x.moon < YARD_EYE), `mains out, the hall's lockers standing (lived things): beyond them the hall reads under ${YARD_EYE} to a bare eye`, row(dS));
      else line(dS[0].moon > ROOM_LO, `mains out, no lockers (the lived things are out): the hall's lantern reaches its back wall mark (over ${ROOM_LO})`, row(dS)); }
    line(g.level.beacons.length === 0, 'no emergency beacon on the level');
    const lights = g.guards.filter((gd: any) => gd.team === 'hostile' && gd.state !== 'dead' && gd.light?.enabled);
    line(lights.length === 0, 'no defender is issued a torch (a gun light burnt on alert is the man\'s own rule, not the level\'s)', lights.map((gd: any) => gd.callsign).join(', '));
    const inShed = g.guards.filter((gd: any) => gd.team === 'hostile' && gd.state !== 'dead' && inB(gd.char.pos, shed));
    line(inShed.length === 0 && words === 'throw the breaker' && !!th?.stand && inB(th.stand, shed, 0.15), 'the squad\'s own order has the breaker, with a place to stand inside the shed, and nobody holds the shed',
      `in the shed: ${inShed.map((gd: any) => gd.callsign).join(', ') || 'nobody'} · ${th ? `'${words}' from ${th.stand ? `(${th.stand[0].toFixed(1)}, ${th.stand[2].toFixed(1)})` : 'NO PLACE TO STAND'}` : 'no thing offered'}`);
    console.log(ok ? '=== floodlit: ALL PASS ===' : '=== floodlit: FAILURES above ===');
    return ok;
  } finally { WORK.on = workWas; }
}
// what was measured, both stands, the mains out, moon counted: the crossing and the start 0.00‥0.13 (tube 0.22 in the wall's shadow at the foot gate,
// 0.58‥0.68 elsewhere), under the eaves 0.22‥0.41, the rooms 0.40‥0.76 (lanterns at 6) — each bound is that plus a margin
// lit, the lamps outside the wall burning (10-15: the gate posts' at 17, the shed door's at 30): see the line's own print; the goggles' line is nvg.ts NVG.darkAt 0.5
const YARD_EYE = 0.2, EAVES_EYE = 0.5, YARD_TUBE = 0.15, ROOM_LO = 0.3, ROOM_HI = 0.85, START_LO = 0.15, START_HI = 0.45;

if (import.meta.main) process.exit((await floodlitCheck()) ? 0 : 1);
