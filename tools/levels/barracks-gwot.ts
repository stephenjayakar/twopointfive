// BARRACKS IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/barracks.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts barracks-gwot`.
// ITS OWN PLACE: a police battalion's lines round a parade square — whitewash and police green over dark packed earth. What it alone has: DRILL AND SPORT
// on the square (a volleyball court, the formation's marks, the path worn corner to corner between the two gallery doors with its whitewashed stones) and
// the rooms' numbers as tally bars on the gallery floors. The square stays dark and bare of anything large and pale: a man crossing it must stand out.
import { build as buildPlain, NOTES as PLAIN_NOTES, BARRACKS_ROOMS } from './barracks';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'barracks-gwot';
export const DRESS_AS = 'barracks';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = BARRACKS_ROOMS;
const SKIN: Skin = {
  wall: 'whitewash', house: 'whitewash', inner: 'render', frameOut: 'paintGreen', frameIn: 'woodGrey', dado: 'paintGreen',
  floor: { concrete: 'dust', grass: 'dirt', lino: 'slab', stone: 'slab', carpet: 'canvas' },
  rooms: [{ id: 'duty', bounds: R.duty }, { id: 'bunks1', bounds: R.bunks1 }, { id: 'bunks4', bounds: R.bunks4 }, { id: 'arms', bounds: R.arms }, { id: 'wash', bounds: R.wash }],
  rugs: { bunks1: 'felt', bunks2: 'mat', bunks3: 'felt', bunks4: 'mat', bunks5: 'felt', day: 'mat', duty: 'mat' },
  pick: c => c.name === 'plant' && c.group === 'yard' ? 'scrub' : undefined,                // (the square's planters: camelthorn, not a clipped hedge)
  dress: (G, _level, T) => {
    const M = lookMarks(T), lime = T.tone(P.whitewash, 0.8), green = P.paintGreen;
    // the VOLLEYBALL COURT at the east end of the square: lime lines, the net's line, the two attack lines
    M.outline(23.1, 12.7, 31.1, 15.3, 0.08, lime); M.seg(27.1, 12.5, 27.1, 15.5, 0.1, lime); M.seg(25.8, 12.7, 25.8, 15.3, 0.06, lime); M.seg(28.4, 12.7, 28.4, 15.3, 0.06, lime);
    // the PATH worn corner to corner between the two gallery doors, edged with whitewashed stones
    { const ax = 19.4, az = 11.3, bx = 23.0, bz = 15.9, cx = 24.4, cz = 16.9, fa = T.floorAt(21, 13.5); if (fa) M.path([[ax, az], [bx, bz], [cx, cz]], 0.8, T.tone(fa, 0.72));
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L; for (let s = 0.5; s < L; s += 0.75) for (const e of [-1, 1]) { const x = ax + ux * s - uz * e * 0.55, z = az + uz * s + ux * e * 0.55; M.fill(x - 0.1, z - 0.1, x + 0.1, z + 0.1, lime); } }
    // the FORMATION's marks in front of the mess hall: three ranks of six
    for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) { const x = 14.3 + i * 0.75, z = 12.3 + k * 0.75; if (Math.abs(x - 16.6) < 0.6 && Math.abs(z - 14.0) < 1.2) continue; M.fill(x - 0.13, z - 0.13, x + 0.13, z + 0.13, lime); }
    // vehicles stop OUTSIDE the arch: the ruts, the stop bar
    G.ruts(39.8, 14.0, 37.3, 14.0); M.seg(37.0, 12.9, 37.0, 15.1, 0.16, lime);
    // ROOM NUMBERS as tally bars on the gallery floor beside each bunk room's door, and a green line along each gallery's yard side
    const bars: [number, number, number][] = [[15.4, 8.95, 1], [21.4, 8.95, 2], [15.4, 19.05, 3], [22.4, 19.05, 4], [27.4, 19.05, 5]];
    for (const [x, z, n] of bars) M.tally(x + 1.15, z, n, green, true, 0.5, 0.09, 0.2);
    M.seg(R.ngal.x0, 10.42, R.ngal.x1, 10.42, 0.1, green); M.seg(R.sgal.x0, 17.58, R.sgal.x1, 17.58, 0.1, green);
    M.hazard(25.5, 8.55, 27.3, 8.85, P.genYellow, P.iron);                                    // the armoury's door: the one hazard band on the post
    // the wash room: the floor wet round its drain
    G.patch(33.0, 22.0, 2.4, 1.7, 'damp', 0.15); G.patch(33.3, 21.8, 1.3, 1.0, 'damp', 0.9, 0.0128); M.fill(32.85, 21.85, 33.15, 22.15, P.iron);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
