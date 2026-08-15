// Procedural 'photo studio' for the character viewer: a floor, a back wall, two scale references and three lights, expressed as the
// same Level object the office uses so the viewer feeds the Engine exactly the way main.ts does (world.addStatic + lightFromDef).
// Everything sits around the middle of the fixed traceable world (WORLD.min/max, the 1 m ray grid and the cascade volume are sized
// for the office), never at the origin corner. Not meant for Game (no routes / doors / a fake breaker).
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag, makeBox } from './boxes';
import { Level, LightDef } from './level';
import { WORLD } from './world';

export interface Stage extends Level {
  center: Vec3;          // where the mannequin stands (floor level)
  wall: number;          // box index of the back wall (the viewer cuts it down to a lip — Box.cutHeight — when the camera orbits behind it)
  wallZ: number;         // its plane
}

export function buildStage(): Stage {
  const cx = (WORLD.min[0] + WORLD.max[0]) / 2, cz = (WORLD.min[2] + WORLD.max[2]) / 2;   // (20, 14): centre of the grid / probe volume
  const center: Vec3 = [cx, 0, cz];
  const boxes: Box[] = []; const lights: LightDef[] = [];
  const add = (b: Partial<Box> & { c: Vec3; h: Vec3 }) => { boxes.push(makeBox(b)); return boxes.length - 1; };
  const slab = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, albedo: Vec3, extra: Partial<Box> = {}) =>
    add({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], albedo, ...extra });

  // ground everywhere (every downward ray must land on something; a world-sized box becomes a grid 'global'), 2 cm below the stage
  // floor proper so the two never z-fight; the stage floor is a real (traced) 12×12 m slab of lighter concrete with its top at y = 0
  slab(WORLD.min[0], -0.25, WORLD.min[2], WORLD.max[0], -0.02, WORLD.max[2], [0.1, 0.1, 0.11]);
  slab(cx - 6, -0.12, cz - 6, cx + 6, 0, cz + 6, [0.42, 0.41, 0.4]);
  // 1 m floor graduations toward the camera side (thin decals, no rays) — a scale you can read stride length against
  for (let i = -3; i <= 3; i++) add({ c: [cx + i, 0.004, cz + 1.5], h: [0.01, 0.004, 1.5], albedo: [0.62, 0.6, 0.55], flags: BoxFlag.NoShadow });
  // back wall 3 m behind the mannequin: catches the rail-light / torch spot, the muzzle flash and the key light's soft capsule shadow (not the
  // goggle glow: props are raster-only). Cutaway so the viewer can drop it to a lip when the orbit camera goes round the back (BoxFlag.Cutaway +
  // cutHeight: this wall is the last user of that primitive since the office lost its dollhouse walls)
  const wallZ = cz - 3;
  const wall = slab(cx - 5, 0, wallZ - 0.1, cx + 5, WORLD.ceilingY - 0.05, wallZ + 0.1, [0.56, 0.54, 0.5], { flags: BoxFlag.Cutaway, cutHeight: 100 });   // (a top flush with CEIL_Y would get the section-cap tint)
  // scale references off to the sides: a 0.5 m cube and a 1.8 m post (mannequin height)
  add({ c: [cx + 2.6, 0.25, cz - 1.2], h: [0.25, 0.25, 0.25], yaw: 0.35, albedo: [0.58, 0.44, 0.26] });
  add({ c: [cx - 2.4, 0.9, cz - 1.4], h: [0.03, 0.9, 0.03], albedo: [0.3, 0.31, 0.33] });
  for (let k = 1; k <= 3; k++) add({ c: [cx - 2.4, k * 0.5, cz - 1.4], h: [0.06, 0.006, 0.06], albedo: [0.8, 0.8, 0.78], flags: BoxFlag.NoShadow });   // 0.5 m ticks

  // three-point-ish lighting in the game's units: a big soft key (radius ≥ 0.2 puts it in the renderer's 'broad' class: wide, denoised
  // penumbrae), a dim cool fill, a small warm rim from behind so the silhouette separates from the wall. Faint haze beams on the key only.
  lights.push({ kind: 'spot', pos: [cx - 2.6, 3.3, cz + 3.2], dir: v3.normalize([2.6, -2.4, -3.2]), color: [1.0, 0.95, 0.88], intensity: 55, range: 14, innerDeg: 22, outerDeg: 42, name: 'key', group: 'stage', enabled: true, volumetric: 0.12, radius: 0.25 });
  lights.push({ kind: 'point', pos: [cx + 3.2, 2.0, cz + 1.8], dir: [0, -1, 0], color: [0.6, 0.72, 1.0], intensity: 7, range: 10, innerDeg: 0, outerDeg: 180, name: 'fill', group: 'stage', enabled: true, volumetric: 0, radius: 0.3 });
  lights.push({ kind: 'spot', pos: [cx + 1.8, 2.9, cz - 2.3], dir: v3.normalize([-1.8, -1.6, 2.3]), color: [1.0, 0.8, 0.6], intensity: 22, range: 9, innerDeg: 18, outerDeg: 34, name: 'rim', group: 'stage', enabled: true, volumetric: 0.05, radius: 0.08 });

  return {
    boxes, lights, switchables: [], routes: [], doors: [], beacons: [], props: [],
    breaker: { pos: [cx, 1, wallZ], boxes: [wall, wall] },   // Level wants one; nothing reads it here
    mission: { serverRoom: { x0: 0, x1: 0, z0: 0, z1: 0 }, entryDoor: '', rack: { index: 0, front: center, halfW: 0 }, exfilDoor: '', exfilZ: 0, exfilX: 1e9 },   // (same: only Game reads it)
    playerSpawn: center, center, wall, wallZ,
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },   // the office's night sky (rays that leave the stage upward)
  };
}
