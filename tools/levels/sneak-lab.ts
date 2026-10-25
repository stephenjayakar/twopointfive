// SNEAK-LAB: the floor the close-in on a man is tuned on — tools/levels/kit-yard.ts's floor, wall for wall (a walled yard, a bunkhouse of two rooms, a store),
// lit so that every step reads, with SIX MEN each walking one case of the last three metres to a man's back (game/stalk.ts), and outside its walls two dark places
// with men of their own for slipping past them, the lab's third and fourth scenarios (src/host/sneaklab.ts SCENES):
//   'stander'  a man who stands in the south of the yard with his back to the gate                      the creep at its plainest
//   'beat'     a man who walks the long straight of the yard and back                            catching a man who is walking away, and one who turns round at the end
//   'loop'     a man who walks round the concrete block                                          a corner every few metres: he turns out of the rear arc again and again
//   'rooms'    a man who walks through the bunkhouse, in by one door and out by the other        a door between Sam and him, and a wall
//   'corner'   a man who comes down the west alley and round the bunkhouse's corner into the yard  the corner to wait at
//   'store'    a man who shifts between three places in the store                                a room to come into behind him
//   'room_*'   three men in the dark room east of the yard: two round the shelves, one up its far aisle   no line to wait out, only gaps to take
//   'hall_*'   two men up and down the dark corridor west of the yard, three niches off it        a man coming at you with nowhere to go but in
// NOT a level to play for its own sake and not in the start card's table: the page opens it as the sneak lab (src/host/sneaklab.ts — the lab's own panel of live
// numbers, the men put back by a button, 'they can't notice you').
//   bun run tools/levels/export.ts sneak-lab [--check]     → levels/sneak-lab.json
//   page: /sneaklab   (= ?levelFile=sneak-lab.json&solo&sneaklab)
import type { Level } from '../../src/scene/level';
import type { LevelScenarios } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { normalize3 as norm } from '../../src/scene/officeGen';
import { build as buildYard } from './kit-yard';
import { OFFICE_PALETTE } from '../../src/scene/officeGen';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'sneak-lab';
export const NOTES = 'The sneak lab: the kit yard (tools/levels/kit-yard.ts) lit, with six men each walking one case of the close-in, and a dark room and a dark corridor to slip through. Regenerate: bun run tools/levels/export.ts sneak-lab';

/** where the corridor's niches open, along it */
const NICHES = [6.4, 13.4, 20.4];

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const C = OFFICE_PALETTE, H = WORLD.ceilingY;
  const Y = buildYard(K => { const { grp, slab, wallX, wallZ, shelf, cardboardBox } = K;
    // ---- the dark corridor: west of the yard's wall, roofed, 2.6 m wide and 26 m long, a niche off it every 7 m (nothing joins it to the yard: the lab puts Sam in it). It runs
    //      up the screen, as the camera looks: along the screen a wall hides the floor behind it ----
    grp('lab.corridor');
    slab(1.6, 0, 1, 5.6, 0.004, 27, C.lino, { flags: BoxFlag.Gloss });
    slab(1.5, H, 0.9, 5.7, H + 0.2, 27.1, C.ceiling, { flags: BoxFlag.NoPrimary });
    wallZ(5.6, 0.88, 27.12, 0.24, C.concrete);
    wallZ(3.0, 0.88, 27.12, 0.24, C.concrete, NICHES.map(a => ({ a, b: a + 1.6, y0: 0, y1: 2.2 })));
    wallX(1, 3.12, 5.48, 0.24, C.concrete); wallX(27, 3.12, 5.48, 0.24, C.concrete);
    for (const a of NICHES) { wallZ(1.6, a - 0.12, a + 1.72, 0.24, C.concrete); wallX(a - 0.12, 1.72, 2.88, 0.12, C.concrete); wallX(a + 1.72, 1.72, 2.88, 0.12, C.concrete); }
    // ---- the dark room: east of the yard's wall, roofed, 6.4 by 20 m, a broken row of tall shelves down its middle and boxes along its walls ----
    grp('lab.darkroom');
    slab(33, 0, 6.5, 39.4, 0.004, 26.5, C.lino);
    slab(32.9, H, 6.4, 39.5, H + 0.2, 26.6, C.ceiling, { flags: BoxFlag.NoPrimary });
    wallZ(33, 6.5, 26.5, 0.24, C.concrete); wallZ(39.4, 6.5, 26.5, 0.24, C.concrete);
    wallX(6.5, 32.88, 39.52, 0.24, C.concrete); wallX(26.5, 32.88, 39.52, 0.24, C.concrete);
    for (const z of [10.5, 16.5, 22.5]) shelf(36.2, z, 3.2, 0.5, Math.PI / 2, 4, 1.9);
    cardboardBox(33.6, 13.4, 0.5, 0.2); cardboardBox(38.8, 19.5, 0.55, 0.6); cardboardBox(33.6, 20.0, 0.5, 0.9); cardboardBox(38.8, 8.4, 0.5, 0.4);
  }), level = Y.level;
  // ---- the six beats (points are free floor; wait = seconds stood at each) ----
  level.routes = [
    { name: 'stander', points: [[13.5, 0, 18.6], [14.1, 0, 18.6]], wait: [45, 45] },
    { name: 'beat', points: [[17.0, 0, 14.2], [30.5, 0, 14.2]], wait: [3, 3] },
    { name: 'loop', points: [[16.5, 0, 17.0], [21.0, 0, 17.0], [21.0, 0, 20.6], [16.5, 0, 20.6]], wait: [0, 2, 0, 2] },
    { name: 'rooms', points: [[13.6, 0, 13.0], [13.6, 0, 9.0], [20.6, 0, 9.4], [20.6, 0, 13.0]], wait: [2, 0, 0, 2] },
    { name: 'corner', points: [[9.0, 0, 7.4], [9.0, 0, 13.2], [12.2, 0, 13.4]], wait: [4, 0, 4] },
    { name: 'store', points: [[24.2, 0, 18.4], [30.4, 0, 20.2], [28.4, 0, 17.4]], wait: [6, 6, 6] },
    { name: 'room_north', points: [[34.4, 0, 8.2], [38.0, 0, 8.2], [38.0, 0, 13.5], [34.4, 0, 13.5]], wait: [2, 0, 2, 0] },
    { name: 'room_south', points: [[38.0, 0, 24.4], [34.4, 0, 24.4], [34.4, 0, 19.5], [38.0, 0, 19.5]], wait: [2, 0, 2, 0] },
    { name: 'room_aisle', points: [[38.0, 0, 14.5], [38.0, 0, 18.6]], wait: [3, 3] },
    { name: 'hall_far', points: [[4.3, 0, 5.0], [4.3, 0, 20.0]], wait: [2, 2] },
    { name: 'hall_near', points: [[4.3, 0, 18.0], [4.3, 0, 3.0]], wait: [3, 3] },
  ];
  // ---- light to read every step by: a high moon and two floods over the yard (bare lights: a lab, not a place) ----
  for (const l of level.lights) if (l.name === 'moon') { l.intensity = 2.6; l.dir = norm([0.3, -0.85, -0.42]); }
  for (const [name, x, z] of [['lab_west', 13.0, 17.0], ['lab_mid', 22.0, 13.6]] as const)
    level.lights.push({ kind: 'spot', pos: [x, 6.5, z], dir: [0, -1, 0], color: [1.0, 0.9, 0.74], intensity: 300, range: 24, innerDeg: 50, outerDeg: 78, name, group: 'exterior', enabled: true, volumetric: 0, radius: 0.2, mains: false, broad: true });
  // ---- the dark places get a dim pool each end of their way through, so that there is something to be seen against ----
  for (const [name, x, z] of [['hall_a', 4.3, 10.5], ['hall_b', 4.3, 18.5], ['room_a', 34.6, 16.5], ['room_b', 37.8, 11.0], ['room_c', 37.8, 22.0]] as const)
    level.lights.push({ kind: 'spot', pos: [x, H - 0.1, z], dir: [0, -1, 0], color: [1.0, 0.78, 0.5], intensity: 14, range: 6, innerDeg: 35, outerDeg: 70, name, group: 'lab', enabled: true, volumetric: 0, radius: 0.1, mains: false });
  level.sky = { zenith: [0.03, 0.05, 0.09], horizon: [0.07, 0.085, 0.12] };
  // ---- Sam starts inside the foot gate, a few metres behind the man who stands ----
  level.playerSpawn = [9.0, 0, 16.0];
  Y.surfaces.zones.push({ id: 'corridor', mat: 'lino', x0: 1.6, z0: 1, x1: 5.6, z1: 27 }, { id: 'darkroom', mat: 'lino', x0: 33, z0: 6.5, x1: 39.4, z1: 26.5 });
  return { level, scenarios: { doorNames: Y.scenarios.doorNames }, groups: Y.groups, surfaces: Y.surfaces };
}
