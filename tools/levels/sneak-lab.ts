// SNEAK-LAB: the floor the close-in on a man is tuned on — tools/levels/kit-yard.ts's floor, wall for wall (a walled yard, a bunkhouse of two rooms, a store),
// lit so that every step reads, with SIX MEN each walking one case of the last three metres to a man's back (game/stalk.ts):
//   'stander'  a man who stands by the south wall with his back to the yard                      the creep at its plainest
//   'beat'     a man who walks the long straight of the yard and back                            catching a man who is walking away, and one who turns round at the end
//   'loop'     a man who walks round the concrete block                                          a corner every few metres: he turns out of the rear arc again and again
//   'rooms'    a man who walks through the bunkhouse, in by one door and out by the other        a door between Sam and him, and a wall
//   'corner'   a man who comes down the west alley and round the bunkhouse's corner into the yard  the corner to wait at
//   'store'    a man who shifts between three places in the store                                a room to come into behind him
// NOT a level to play for its own sake and not in the start card's table: the page opens it as the sneak lab (src/host/sneaklab.ts — the lab's own panel of live
// numbers, the men put back by a button, 'they can't notice you').
//   bun run tools/levels/export.ts sneak-lab [--check]     → levels/sneak-lab.json
//   page: /sneaklab   (= ?levelFile=sneak-lab.json&solo&sneaklab)
import type { Level } from '../../src/scene/level';
import type { LevelScenarios } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { normalize3 as norm } from '../../src/scene/officeGen';
import { build as buildYard } from './kit-yard';

export const NAME = 'sneak-lab';
export const NOTES = 'The sneak lab: the kit yard (tools/levels/kit-yard.ts) lit, with six men each walking one case of the close-in. Regenerate: bun run tools/levels/export.ts sneak-lab';

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const Y = buildYard(), level = Y.level;
  // ---- the six beats (points are free floor; wait = seconds stood at each) ----
  level.routes = [
    { name: 'stander', points: [[11.0, 0, 18.6], [11.6, 0, 18.6]], wait: [45, 45] },
    { name: 'beat', points: [[17.0, 0, 14.2], [30.5, 0, 14.2]], wait: [3, 3] },
    { name: 'loop', points: [[16.5, 0, 17.0], [21.0, 0, 17.0], [21.0, 0, 20.6], [16.5, 0, 20.6]], wait: [0, 2, 0, 2] },
    { name: 'rooms', points: [[13.6, 0, 13.0], [13.6, 0, 9.0], [20.6, 0, 9.4], [20.6, 0, 13.0]], wait: [2, 0, 0, 2] },
    { name: 'corner', points: [[9.0, 0, 7.4], [9.0, 0, 13.2], [12.2, 0, 13.4]], wait: [4, 0, 4] },
    { name: 'store', points: [[24.2, 0, 18.4], [30.4, 0, 20.2], [28.4, 0, 17.4]], wait: [6, 6, 6] },
  ];
  // ---- light to read every step by: a high moon and two floods over the yard (bare lights: a lab, not a place) ----
  for (const l of level.lights) if (l.name === 'moon') { l.intensity = 2.6; l.dir = norm([0.3, -0.85, -0.42]); }
  for (const [name, x, z] of [['lab_west', 13.0, 17.0], ['lab_mid', 22.0, 13.6]] as const)
    level.lights.push({ kind: 'spot', pos: [x, 6.5, z], dir: [0, -1, 0], color: [1.0, 0.9, 0.74], intensity: 300, range: 24, innerDeg: 50, outerDeg: 78, name, group: 'exterior', enabled: true, volumetric: 0, radius: 0.2, mains: false, broad: true });
  level.sky = { zenith: [0.03, 0.05, 0.09], horizon: [0.07, 0.085, 0.12] };
  // ---- Sam starts inside the foot gate, a few metres behind the man who stands ----
  level.playerSpawn = [9.0, 0, 16.0];
  return { level, scenarios: { doorNames: Y.scenarios.doorNames }, groups: Y.groups, surfaces: Y.surfaces };
}
