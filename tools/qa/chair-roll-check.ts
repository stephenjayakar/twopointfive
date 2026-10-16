// AN OFFICE CHAIR ROLLS AND COASTS ON ITS CASTORS — the check of props.ts `CASTOR` (the maintainer: "i'd also expect the chair to have wheels and roll").
//   bun run tools/qa/chair-roll-check.ts            the lines below; exit 0 = all pass, 1 = a line failed
//   CHAIRROLL_BREAK=1 bun run tools/qa/chair-roll-check.ts   the switch left off where the lines ask for it on: must FAIL (the proof the check can)
//   bun run tools/qa/chair-roll-check.ts --doors [door-chair.ts's own arguments]   tools/qa/door-chair.ts with the castors on (a rolling chair still goes through a door)
// The props' own simulation alone (PropSystem.update at 1/60 s over the office's statics), a man's circle (0.3 m, 75 kg) walking into the office's own chair
// on a clear run of floor found in the level. Coast = how far the chair goes on after the man has stopped.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const { PropSystem, CASTOR } = await import(`${ROOT}/src/game/props.ts`);
const BREAK = process.env.CHAIRROLL_BREAK === '1';
if (process.argv.includes('--doors')) { CASTOR.on = true; process.argv = process.argv.filter(a => a !== '--doors'); await import('./door-chair.ts'); }
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { StaticCollision } = await import(`${ROOT}/src/scene/collision.ts`);
const level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/office.json'), 'utf8')));
const col = new StaticCollision(level.boxes);
const CHAIR = level.props.find((p: any) => p.kind === 'chair'), OTHER = level.props.find((p: any) => p.kind !== 'chair');
if (!CHAIR || !OTHER) { console.error('the office has no chair / no other prop to borrow'); process.exit(2); }

/** a run of floor along +x: `len` metres with half a metre clear to either side, then (`wall`) something solid within 3 m more */
function lane(len: number, wall: boolean): [number, number] | null {
  for (let z = 5; z < 23; z += 0.5) for (let x = 5; x + len + (wall ? 3 : 0) < 35.5; x += 0.5) {   // (inside the office's shell: past the map's edge the walk grid is shut with nothing solid there)
    let ok = true;
    for (let d = -0.5; d <= len && ok; d += 0.25) for (const o of [-0.5, 0, 0.5]) if (col.nav.isBlocked(x + d, z + o)) { ok = false; break; }
    if (!ok) continue;
    if (wall) { let hit = false; for (let d = len; d <= len + 3; d += 0.25) if ([-1, -0.5, 0, 0.5, 1].every(o => col.nav.isBlocked(x + d, z + o))) hit = true; if (!hit) continue; }
    return [x, z];
  }
  return null;
}
interface Run { coast: number; secs: number; events: any[]; crossed: boolean; end: [number, number]; asleep: boolean }
/** the man walks +x from (x, z) at `pace` for `walk` metres into the prop stood 0.8 m ahead, then stands; `secs` of it */
function shove(def: any, at: [number, number], pace: number, walk: number, on: boolean, secs = 12): Run {
  CASTOR.on = on; const events: any[] = [];
  const P = new PropSystem([{ ...def, x: at[0] + 0.8, z: at[1], yaw: 0 }], col, (e: any) => events.push(e));
  const c = P.props[0], pos: [number, number, number] = [at[0], 0, at[1]], vel: [number, number, number] = [0, 0, 0];
  let x0 = NaN, tStop = 0, t = 0, crossed = false, px = c.x, pz = c.z;
  for (let f = 0; f < secs * 60; f++) {
    const walking = pos[0] - at[0] < walk; vel[0] = walking ? pace : 0;
    pos[0] += vel[0] / 60; col.collideCircle(pos, 0.3, 0.2, 1.5);
    P.update(1 / 60, [{ pos, vel, radius: 0.3, who: 1, mass: 75, quiet: false }], []);
    t += 1 / 60;
    if (!walking && Number.isNaN(x0)) x0 = c.x;
    if (col.solidBlocked([px, 0.3, pz], [c.x, 0.3, c.z])) crossed = true;
    px = c.x; pz = c.z;
    if (Math.hypot(c.vx, c.vz) > 0.02) tStop = t;
  }
  CASTOR.on = false;
  return { coast: Math.hypot(c.x - x0, 0), secs: tStop, events, crossed, end: [c.x, c.z], asleep: c.asleep };
}

let bad = 0; const line = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS —' : '- FAIL —'} ${what}`); if (!ok) bad++; };
const open = lane(9, false), blind = lane(2.5, true);
if (!open || !blind) { console.error('no clear run of floor found in the office'); process.exit(2); }
const ON = !BREAK;
const wOff = shove(CHAIR, open, 1.55, 1.0, false), wOn = shove(CHAIR, open, 1.55, 1.0, ON);
const sOff = shove(CHAIR, open, 4.6, 1.0, false), sOn = shove(CHAIR, open, 4.6, 1.0, ON);
console.log(`  a walk's shove (1.55 m/s): as it was ${wOff.coast.toFixed(2)} m, still after ${wOff.secs.toFixed(1)} s · castors ${wOn.coast.toFixed(2)} m, ${wOn.secs.toFixed(1)} s`);
console.log(`  a sprint's shove (4.6 m/s): as it was ${sOff.coast.toFixed(2)} m, ${sOff.secs.toFixed(1)} s · castors ${sOn.coast.toFixed(2)} m, ${sOn.secs.toFixed(1)} s`);
line(wOn.coast > 0.9 && wOn.coast > 1.8 * wOff.coast, `a chair shoved at a walk coasts on (${wOn.coast.toFixed(2)} m against ${wOff.coast.toFixed(2)} m)`);
line(wOn.coast < 3.5 && wOn.secs < 6 && wOn.asleep, `…and stops: inside 3.5 m and 6 s, asleep at the end (${wOn.coast.toFixed(2)} m, ${wOn.secs.toFixed(1)} s)`);
line(sOn.coast > sOff.coast && sOn.coast < 8 && sOn.secs < 9 && sOn.asleep, `a sprint's shove rolls further and still stops inside 8 m and 9 s (${sOn.coast.toFixed(2)} m, ${sOn.secs.toFixed(1)} s)`);
const rolls = wOn.events.filter(e => e.sound === 'roll');
line(rolls.length === 2 && rolls[0].roll === 'start' && rolls[1].roll === 'stop' && rolls.every(e => e.level === 0 && e.who === 1 && e.speed >= 0), `a coasting chair raises 'roll' start then stop, once each, level 0, blamed on who pushed it (${rolls.map(e => e.roll).join(', ') || 'none'})`);
line(rolls.length === 2 && rolls[0].speed > CASTOR.startV && rolls[1].speed < CASTOR.stopV, `…start as it passes ${CASTOR.startV} m/s, stop as it falls under ${CASTOR.stopV} m/s`);
line(wOff.events.every(e => e.sound !== 'roll') && sOff.events.every(e => e.sound !== 'roll'), `switch off: no 'roll' event`);
const k = (r: Run) => `${r.end[0]},${r.end[1]},${r.events.length}`;
const oOff = shove(OTHER, open, 1.55, 1.0, false), oOn = shove(OTHER, open, 1.55, 1.0, ON);
line(k(oOff) === k(oOn), `a prop that is no chair (${OTHER.kind}) ends on the same spot to the bit, castors on or off`);
const hitOn = shove(CHAIR, blind, 4.6, 1.0, ON), hitOff = shove(CHAIR, blind, 4.6, 1.0, false);
if (process.argv.includes('--verbose')) console.log('  wall run', JSON.stringify({ blind, on: { ...hitOn, events: hitOn.events.length }, off: { ...hitOff, events: hitOff.events.length } }));
line(!hitOn.crossed && !hitOff.crossed && hitOn.end[0] - blind[0] < 2.5 + 3 + 0.5 && hitOn.asleep, `rolled at a wall from a sprint it never crosses a solid and comes to rest before it (ends ${(hitOn.end[0] - blind[0]).toFixed(2)} m along)`);
console.log(bad ? `=== chair-roll-check: ${bad} FAILED ===` : '=== chair-roll-check: ALL PASS ===');
process.exit(bad ? 1 : 0);
