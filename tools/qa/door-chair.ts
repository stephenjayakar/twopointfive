// A CHAIR SHOVED AT A REAL DOOR GOES THROUGH IT — the check of props.ts `doorways` (a door frame guides shoved furniture through).
//   bun run tools/qa/door-chair.ts [name…] [--off] [--list]
//     name    levels to ask (levels/<name>.json); none = office, compound, barracks, depot, warehouse
//     --off   the guide off (PropSystem.doorways left empty): the plugs as they were — expected to FAIL, which is the proof the check can
//     --list  a row per plugged case
// Between the stops of a real door (src/scene/doorSize.ts) there are 0.83 m; a chair is half a metre across, a man 0.6. For every leaf of the level a man's
// circle (0.3 m, 75 kg, 1.5 m/s) walks the frame's middle line from 1.3 m before it to 1.5 m beyond, on both faces, with an office chair stood 0.6 m before the
// frame — up to 0.2 m off the middle, square and turned — and nothing else on the floor (no leaf: the door stands open or is off). The props' own simulation
// (PropSystem.update) and the men's own push-out of the statics run each 1/60 s. A case PLUGS when six seconds on the man is not 0.8 m past the wall (his whole body out of the frame).
// exit 0 = no door plugs · 1 = a plug (listed with --list) · 2 = no such level
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { StaticCollision } = await import(`${ROOT}/src/scene/collision.ts`);
const { PropSystem } = await import(`${ROOT}/src/game/props.ts`);

const argv = process.argv.slice(2), OFF = argv.includes('--off'), LIST = argv.includes('--list');
const names = argv.filter(a => !a.startsWith('--')), todo = names.length ? names : ['office', 'compound', 'barracks', 'depot', 'warehouse'];
for (const n of todo) if (!existsSync(resolve(ROOT, 'levels', `${n}.json`))) { console.error(`no level file levels/${n}.json`); process.exit(2); }
const office = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/office.json'), 'utf8')));
const CHAIR = office.props.find((p: any) => p.kind === 'chair'); if (!CHAIR) { console.error('the office has no chair to borrow'); process.exit(2); }

let asked = 0; const plugs: string[] = [];
for (const name of todo) {
  const level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')));
  const col = new StaticCollision(level.boxes); let mine = 0, bad = 0;
  for (const d of level.doors) {
    const u: [number, number] = [Math.cos(d.closedDir), Math.sin(d.closedDir)], n: [number, number] = [-u[1], u[0]];
    const mx = d.hinge[0] + u[0] * d.width / 2, mz = d.hinge[1] + u[1] * d.width / 2;
    if ([-1.3, -0.6, 0.6, 1.5].some(o => col.nav.isBlocked(mx + n[0] * o, mz + n[1] * o))) continue;   // (a door with something standing a stride before or beyond it: not this check's)
    for (const side of [1, -1]) for (const a of [-0.2, -0.1, 0, 0.1, 0.2]) for (const yaw of [0, 0.4, 0.785]) {
      const P = new PropSystem([{ ...CHAIR, x: mx - n[0] * side * 0.6 + u[0] * a, z: mz - n[1] * side * 0.6 + u[1] * a, yaw }], col, () => {});
      if (!OFF) P.doorways = [{ cx: mx, cz: mz, ux: u[0], uz: u[1], half: d.width / 2 - 0.02 }];
      const pos: [number, number, number] = [mx - n[0] * side * 1.3, 0, mz - n[1] * side * 1.3], vel: [number, number, number] = [n[0] * side * 1.5, 0, n[1] * side * 1.5];
      const through = () => (pos[0] - mx) * n[0] * side + (pos[2] - mz) * n[1] * side;
      for (let f = 0; f < 360 && through() < 0.8; f++) {
        const gx = mx + n[0] * side * 1.5 - pos[0], gz = mz + n[1] * side * 1.5 - pos[2], gl = Math.hypot(gx, gz) || 1; vel[0] = gx / gl * 1.5; vel[2] = gz / gl * 1.5;   // (he steers at his mark beyond the door, as a path's waypoint)
        pos[0] += vel[0] / 60; pos[2] += vel[2] / 60; col.collideCircle(pos, 0.3, 0.2, 1.5);
        P.update(1 / 60, [{ pos, vel, radius: 0.3, who: 1, mass: 75, quiet: false }], []);
        col.collideCircle(pos, 0.3, 0.2, 1.5);
      }
      asked++; mine++;
      if (through() < 0.8) { bad++; plugs.push(`${name} ${d.name} ${side > 0 ? '+' : '-'} chair ${a >= 0 ? '+' : ''}${a.toFixed(1)} m off the middle, turned ${yaw.toFixed(2)}: the man ${through().toFixed(2)} m past the wall after 6 s`); }
    }
  }
  console.log(`${bad ? 'FAIL' : 'PASS'}  ${name.padEnd(12)} ${mine} cases · ${bad} plugged`);
}
if (LIST) for (const p of plugs) console.log('      ' + p);
console.log(`\n${asked} cases over ${todo.length} levels · ${plugs.length} plugged${OFF ? ' · the guide OFF (props.ts doorways empty)' : ''}`);
if (plugs.length) { console.log(`=== door-chair: ${plugs.length} FAIL ===`); process.exit(1); }
console.log('=== door-chair: ALL PASS ===');
