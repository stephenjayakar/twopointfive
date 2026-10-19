// RAIN SHOWS IN FRONT OF A WALL'S OUTER FACE AND OVER ITS TOP — the check behind the scene prelude's RAIN_WALLS (src/render/frame.ts rainWallsConfig; on,
// ?norainwalls at boot = as it was; picture only: no game table, nothing for a recording to carry).
//   bun run tools/qa/probes.ts rainwalls        (family `weather`)        RAINWALLS_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-19, a depot's yard in the rain: "rain isn't showing up on top of walls properly". The rain is hidden from a pixel whose surface is indoors,
// and indoors was the roofs' bare rectangles: a level's own roof is its ceiling slab grown by centimetres, over the walls, so every outer wall's face, the door
// in it and the wall's top showed no rain and the streaks over the yard stopped dead at the wall behind them. The rule now asked: is the point UNDER the roofs,
// 0.2 m or more inside them on every side (common.wgsl wxUnderRoof).
// WHAT THIS CAN AND CANNOT SAY. No shader runs here. The rule is written again below (`under`) and the shader's own function is held to it BY ITS TEXT, with the
// two places that ask it and the ring's own gate; the copy is then asked over every level's roofs AS THE RENDERER HAS THEM (the first two whole, the third and
// fourth packed to 0.2 m) and every level's walls. A change to those shader lines is a red line here, not a silent pass. What the picture looks like is the
// page's to show (tools/qa/weather-look.cjs).
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './headless.ts';
export async function rainWallsCheck(): Promise<boolean> {
  const BRK = process.env.RAINWALLS_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== rainwalls: rain shows in front of a wall's outer face and over its top${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8');
  const common = read('common.wgsl'), vol = read('volumetrics.wgsl'), draw = read('particles_draw.wgsl'), pc = read('particles_common.wgsl');
  const IN = Number(/const WX_WALL_IN: f32 = ([0-9.]+);/.exec(common)?.[1]);
  const body = (/fn wxUnderRoof\(p: vec2f\) -> bool \{\n([\s\S]*?)\n\}/.exec(common)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const WANT = 'if (!wxRoofed(p)) { return false; } if (!WX_KINDS) { return true; } if (frame.cardCfg.y == 0u) { return true; } let d = WX_WALL_IN; return wxRoofed(p + vec2f(d, d)) && wxRoofed(p + vec2f(-d, d)) && wxRoofed(p + vec2f(d, -d)) && wxRoofed(p - vec2f(d, d));';
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`); const CY: number = WORLD.ceilingY;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { roofsOf } = await import(`${ROOT}/src/game/weather.ts`), { packRect, unpackRect } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  type Bx = { c: number[]; h: number[] };
  /** a level's roofs as the renderer has them under its own storm (weather.ts ownRoofs), and its boxes */
  const levelOf = (file: string) => { const boxes: Bx[] = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))).boxes;
    return { boxes, roofs: (roofsOf(boxes) as number[][]).map((r, i) => i < 2 ? r : unpackRect(packRect(r)) as number[]) }; };
  /** the shader's rule again: wxRoofed (the bare rectangles) and wxUnderRoof (own = the level's own roofs in force: the packed words are not 0) */
  const roofed = (R: number[][], x: number, z: number) => R.some(r => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3]);
  const under = (R: number[][], x: number, z: number, own = true) => roofed(R, x, z) && (!own || (roofed(R, x + IN, z + IN) && roofed(R, x - IN, z + IN) && roofed(R, x + IN, z - IN) && roofed(R, x - IN, z - IN)));
  const RULE = !BRK, shown = (R: number[][], x: number, z: number) => !roofed(R, x, z) || (RULE && !under(R, x, z));   // the two gates' own expression
  /** a level's outer walls: a ceiling-high wall with open sky half a metre off one long face and a roof half a metre past the other — [outer face, inner face, a floor point 10 cm in from the inner face] */
  const outerWalls = (L: { boxes: Bx[]; roofs: number[][] }) => { const out: { o: number[]; i: number[]; f: number[] }[] = [];
    for (const b of L.boxes) { const c = b.c, h = b.h; if (h[1] < 1 || c[1] + h[1] < CY - 0.01) continue;
      const ax = h[0] < 0.2 && h[2] > 0.3 ? 0 : h[2] < 0.2 && h[0] > 0.3 ? 2 : -1; if (ax < 0) continue; const t = h[ax];
      for (const s of [-1, 1]) { const at = (d: number) => ax === 0 ? [c[0] + s * d, c[2]] : [c[0], c[2] + s * d]; const sky = at(t + 0.5), deep = at(-t - 0.5);
        if (!roofed(L.roofs, sky[0], sky[1]) && roofed(L.roofs, deep[0], deep[1])) out.push({ o: at(t), i: at(-t), f: at(-t - 0.1) }); } }
    return out; };
  // (1) the depot, where he stood
  { const L = levelOf('depot.json'), W = outerWalls(L); let face = 0, inner = 0, floor = 0, oldHid = 0;
    for (const w of W) { if (shown(L.roofs, w.o[0], w.o[1])) face++; if (!shown(L.roofs, w.i[0], w.i[1])) inner++; if (!shown(L.roofs, w.f[0], w.f[1])) floor++; if (roofed(L.roofs, w.o[0], w.o[1])) oldHid++; }
    verdict(L.roofs.length >= 1 && W.length >= 8 && face === W.length && inner === W.length && floor === W.length && oldHid >= W.length - 2,
      'the depot\'s outer walls: rain shows in front of the outer face of every one, and not in front of its inner face or the floor at its foot',
      `${L.roofs.length} roof(s), ${W.length} outer walls: outer face shown ${face}, inner face dry ${inner}, the floor 10 cm inside dry ${floor} (the bare rectangles hid the outer face of ${oldHid})`); }
  // (2) every level: the faces, and no bare floor let into the rain
  { let walls = 0, face = 0, inner = 0, oldHid = 0, levels = 0, bare = 0, worst = '', worstA = 0; const miss: string[] = [], wetIn: string[] = [];
    for (const file of readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).sort()) {
      let L; try { L = levelOf(file); } catch { continue; } if (!L.roofs.length) continue; levels++;
      const W = outerWalls(L); let f = 0, i = 0;
      for (const w of W) { walls++; if (shown(L.roofs, w.o[0], w.o[1])) { face++; f++; } if (!shown(L.roofs, w.i[0], w.i[1])) { inner++; i++; } if (roofed(L.roofs, w.o[0], w.o[1])) oldHid++; }
      if (f < W.length) miss.push(`${file.replace('.json', '')} ${W.length - f}/${W.length}`); if (i < W.length) wetIn.push(`${file.replace('.json', '')} ${W.length - i}/${W.length}`);
      // ground the old rule kept dry and this one shows rain in front of, that no box stands on (a wall, the sill under a window, a frame — and 7 cm round it, the roof's own pad): m² on a 5 cm grid
      const tall = L.boxes.filter(b => b.c[1] + b.h[1] > 0.3 && b.c[1] - b.h[1] < CY - 0.3); let a = 0; const G = 0.05;
      for (const r of L.roofs) for (let x = r[0] + G / 2; x < r[2]; x += G) for (let z = r[1] + G / 2; z < r[3]; z += G) {
        if (x > r[0] + 0.5 && x < r[2] - 0.5 && z > r[1] + 0.5 && z < r[3] - 0.5) { z = Math.max(z, r[3] - 0.5 - G / 2); continue; }   // (the middle of a rectangle is under it by the rule's own words: only its rim is walked)
        if (!shown(L.roofs, x, z) || L.roofs.indexOf(r) !== L.roofs.findIndex(q => x >= q[0] && z >= q[1] && x <= q[2] && z <= q[3])) continue;
        if (!tall.some(b => Math.abs(x - b.c[0]) <= b.h[0] + 0.07 && Math.abs(z - b.c[2]) <= b.h[2] + 0.07)) a += G * G; }
      bare += a; if (a > worstA) { worstA = a; worst = file.replace('.json', ''); } }
    verdict(levels >= 20 && walls >= 150 && face >= 0.85 * walls && inner >= 0.97 * walls && oldHid >= 0.85 * walls && bare / levels < 0.5 && worstA < 4,
      'every level under its own roofs: rain shows in front of nearly every outer wall\'s face, in front of next to no inner face, and next to no bare ground is let into it',
      `${levels} levels, ${walls} outer walls (the bare rectangles hid ${oldHid} faces): outer face shown ${face}, inner face dry ${inner} · ground newly in front of the rain with nothing standing on it (a doorway's threshold, the strip a packed roof reaches past its wall's face, the rim of a roof that stands on no wall): ${bare.toFixed(1)} m² in all, most on ${worst} ${worstA.toFixed(2)} m² · faces still hidden (a third or fourth roof is packed to 0.2 m, rounded outward): ${miss.join(', ') || 'none'} · inner faces shown: ${wetIn.join(', ') || 'none'}`); }
  // (3) where two slabs of one building meet, and the office's own two rectangles
  { const two = [[4, 4, 12, 10.93], [4, 10.81, 12, 20]]; let seam = 0, n = 0; for (let x = 4.5; x < 11.6; x += 0.25) for (let z = 10.5; z < 11.3; z += 0.05) { n++; if (!shown(two, x, z)) seam++; }
    const office = [[4, 4, 36, 24], [1.1, 9.33, 4, 12.87]]; let same = 0, m = 0; for (let x = 0.05; x < 40; x += 0.37) for (let z = 0.05; z < 28; z += 0.37) { m++; if (under(office, x, z, false) === roofed(office, x, z)) same++; }
    verdict(seam === n && same === m, 'the strip where two roof slabs of one building meet is under the roof, and on the office\'s own two rectangles (no kind in force) the rule is the bare rectangle',
      `two slabs overlapping 12 cm: ${seam} of ${n} points across the seam dry · the office's rectangles: ${same} of ${m} points as the bare test says`); }
  // (4) who asks, and the switch
  { const F = await import(`${ROOT}/src/render/frame.ts`) as any, was = F.rainWallsConfig.on; let onT = '', offT = '';
    try { F.rainWallsConfig.on = true; onT = F.scenePrelude(); F.rainWallsConfig.on = false; offT = F.scenePrelude(); } finally { F.rainWallsConfig.on = was; }
    const main = readFileSync(`${ROOT}/src/main.ts`, 'utf8');
    const asked = /if \(depth >= 1\.0 \|\| outdoorsXZ\(Pend\.xz\) \|\| \(RAIN_WALLS && !wxUnderRoof\(Pend\.xz\)\)\) \{/.test(vol) && /else if \(RAIN_WALLS && rainOverWall\(Pend\)\) \{ \}[^\n]*\n\s*else if \(!rainOutdoors\(Pend\.xz\)\) \{ discard; \}/.test(draw) && /fn rainOverWall\(P: vec3f\) -> bool \{\s*let p = P\.xz;\s*return !wxUnderRoof\(p\) && /.test(pc);
    const rings = /if \(depth < 1\.0 && outdoorsXZ\(Pend\.xz\)\) \{ let sp = splashAt\(Pend\);/.test(vol);
    verdict(was === true && body === WANT && IN === 0.2 && asked && rings && /const RAIN_WALLS: bool = true;/.test(onT) && /const RAIN_WALLS: bool = false;/.test(offT) && /q\.has\('norainwalls'\)\) rainWallsConfig\.on = false;/.test(main),
      'the shader\'s rule is the one asked here; the lattice rain and the particle rain both ask it and a ring is drawn on open ground only; the prelude carries the constant, on as the page boots, and ?norainwalls lowers it before the shaders are built',
      `wxUnderRoof's text as held ${body === WANT} · drawn in ${IN} m · both gates ask ${asked} · rings behind the old test ${rings} · on at import ${was} · in the prelude on ${/const RAIN_WALLS: bool = true;/.test(onT)}, off ${/const RAIN_WALLS: bool = false;/.test(offT)} · the page's flag ${/norainwalls/.test(main)}`); }
  console.log(`=== rainwalls: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
