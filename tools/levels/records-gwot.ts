// RECORDS IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/records.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts records-gwot`.
// ITS OWN PLACE: a district land office — the counter where a claim is filed, the plan books on their island of shelving, the title deeds behind the one locked
// door, the surveyors' room. Cream wash, black steel frames, and the surveyors' marker MAGENTA, on the ground only. What it alone has: SURVEYORS' MARKS. A closed
// TRAVERSE is chained round the building with a numbered station wherever a pane reads a room, and each station's SIGHT LINE runs on through its glass and across
// the floor to the first thing that stands in it: what that pane shows, drawn (the level's idea — look first, then choose the door — the same from either
// start). The plan books' two lanes are N and S; a bench mark's broad arrow lies at the strong room's door; a north point in the lot. No tiles, no measures.
import { build as buildPlain, NOTES as PLAIN_NOTES, RECORDS_ROOMS } from './records';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'records-gwot';
export const DRESS_AS = 'records';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = RECORDS_ROOMS;
/** the marker paint. The palette (src/scene/gwotPalette.ts) has no paint of this hue, so it is a colour of this file's own and only decals wear it */
const MAGENTA: Vec3 = [0.58, 0.06, 0.36];
/** THE TRAVERSE, clockwise from the front door's sidelight. A station [x, z, toward the wall x, z, from, to] stands 1.2 m off a pane (records.ts's wall openings:
 *  the two sidelights, the five windows); from‥to = metres along its sight line where that line lies on the room's floor, from the wall's inside face (or past
 *  what stands under the pane) to the first thing standing in it, read off records.ts's furniture. A bare [x, z] is a turning point at a corner of the building */
const TRAVERSE: ([number, number, number, number, number, number] | [number, number])[] = [
  [14.25, 23.8, 0, -1, 1.42, 3.7],       // 1 the front door's sidelight: the front office, to the duty desk
  [8.7, 23.8],
  [8.7, 15.0, 1, 0, 1.42, 21.18],        // 2 the hall's end window: the whole length of the hall, to the fire exit
  [8.7, 11.6, 1, 0, 1.42, 9.24],         // 3 the records room's west window: the length of its south lane
  [8.7, 5.7],
  [14.1, 5.7, 0, 1, 1.42, 3.7],          // 4 its north window: across its north lane, to the island
  [25.75, 5.7, 0, 1, 1.42, 3.5],         // 5 the staff room's north window: to the chairs at the table
  [31.3, 5.7],
  [31.3, 10.25, -1, 0, 1.42, 4.3],       // 6 the east door's sidelight: the staff room, to the table (the one station that stands under the street lamp)
  [31.3, 18.3], [18.3, 18.3],
  [18.3, 20.3, -1, 0, 2.1, 8.18],        // 7 the front office's east window: over the bench under it, south of the duty desk, to the west wall
  [18.3, 23.8],
];
const SKIN: Skin = {
  wall: 'paintCream', house: 'paintCream', inner: 'whitewash', frameOut: 'iron', frameIn: 'poplar', dado: 'coyote',
  floor: { lino: 'slab', carpet: 'canvas' }, metals: ['olive', 'galv', 'iron'], patches: 0,   // (no patches: one lay over the chain line)
  // (the two rooms people sit in get the dado; the front office keeps the level's own door mat, the staff room's felt is the floor's own tone: both are seen
  // through glass, where a dark square reads as a man. Records has an island where a rug would lie. The hall takes a corridor's scuffed band.)
  pick: c => c.group === 'front' && c.name === undefined && c.y1 < 0.03 ? 'coyote' : undefined,   // (that mat: coir, not the office's charcoal)
  rooms: [{ id: 'hall', bounds: R.hall.bounds }], noRug: /./, rugs: { front: 'felt', staff: 'felt' },
  dress: (_G, _level, T) => {
    // (two sets of marks: M on the ground, Hi indoors — over the rooms' rugs, whose tops stand at 0.024)
    const M = lookMarks(T), Hi = lookMarks({ ...T, flat: (x, z, w, d, a, yaw = 0, y = 0.011) => T.flat(x, z, w, d, a, yaw, y + 0.0146) }), paint = MAGENTA, chain = T.tone(MAGENTA, 0.8);
    // (an N of its own, two uprights and the diagonal, in the font's 3 : 5: the font's N has no room for a diagonal and reads as an M from above)
    const N = (x: number, z: number, h: number) => { const px = h / 5; for (const s of [-1, 1]) M.seg(x + s * px, z - h / 2, x + s * px, z + h / 2, px, paint); M.seg(x - px, z - h / 2 + px / 2, x + px, z + h / 2 - px / 2, px * 0.9, paint); };
    // THE TRAVERSE: the chain line from point to point, a peg at each; a station is a cross on its peg, its sight line (whole to the foot of the pane, broken across the floor inside) and its number
    let n = 0;
    TRAVERSE.forEach((p, i) => {
      const q = TRAVERSE[(i + 1) % TRAVERSE.length], [x, z] = p;
      M.dashed(x, z, q[0], q[1], 0.06, chain, 1.1, 0.7);
      if (p.length === 2) { M.fill(x - 0.09, z - 0.09, x + 0.09, z + 0.09, paint); return; }
      const [, , tx, tz, a, b] = p;
      // (the surveyor's station: a triangle round its peg, apex toward the pane)
      { const r = 0.5, px = -tz, pz = tx, ax = x + tx * r, az = z + tz * r, bx = x - tx * r * 0.5 + px * r * 0.87, bz = z - tz * r * 0.5 + pz * r * 0.87, cx = x - tx * r * 0.5 - px * r * 0.87, cz = z - tz * r * 0.5 - pz * r * 0.87;
        M.seg(ax, az, bx, bz, 0.07, paint); M.seg(bx, bz, cx, cz, 0.07, paint); M.seg(cx, cz, ax, az, 0.07, paint); M.fill(x - 0.12, z - 0.12, x + 0.12, z + 0.12, paint); }
      M.seg(x + tx * 0.5, z + tz * 0.5, x + tx * 1.0, z + tz * 1.0, 0.05, paint); Hi.dashed(x + tx * a, z + tz * a, x + tx * b, z + tz * b, 0.05, chain, 0.5, 0.5);
      M.glyph(String(++n), x + tx * 0.62 + Math.abs(tz) * 0.62, z + tz * 0.62 + Math.abs(tx) * 0.62, 0.38, paint);   // (small, beside the triangle's apex: four other levels letter their floors large)
    });
    // THE PLAN BOOKS' TWO LANES, one letter each, mid-lane against the island (off every mark a man is dealt, off sight lines 3 and 4): N is the lane the west door
    // rakes, S the lane the hall door opens on
    N(15.0, 8.75, 0.7); M.glyph('S', 13.2, 11.05, 0.7, paint);
    // THE BENCH MARK at the strong room's door, on the records face: the bar and the broad arrow under it, pointing at the one door that is locked
    M.seg(17.4, 10.0, 17.4, 11.0, 0.1, paint); for (const dz of [-0.45, 0, 0.45]) M.seg(16.35 - (dz ? 0 : 0.1), 10.5 + dz, 17.3, 10.5, 0.08, paint);
    // THE NORTH POINT in the open lot: the doors are called by their sides (south lot, west yard, east side)
    { const x = 30; M.seg(x, 25.2, x, 22.0, 0.1, paint); M.seg(x, 21.95, x - 0.5, 22.75, 0.1, paint); M.seg(x, 21.95, x + 0.5, 22.75, 0.1, paint); M.seg(x - 0.6, 23.9, x + 0.6, 23.9, 0.07, paint);
      N(x, 21.15, 0.8); M.glyph('S', x, 26.0, 0.8, paint); }
    // THE PRACTICE PLOTS pegged out in the dead east end of the lot: three parcels in chain, a peg at every corner — a cadastral plan at full size
    { const p: [number, number][] = [[32.6, 19.6], [35.4, 19.9], [35.1, 22.6], [32.4, 22.2], [38.6, 19.5], [38.8, 23.1], [38.5, 26.6], [32.9, 26.3]];
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5], [5, 2], [5, 6], [6, 7], [7, 3]]) M.dashed(p[i][0], p[i][1], p[j][0], p[j][1], 0.06, chain, 0.9, 0.5);
      for (const [x, z] of p) M.fill(x - 0.09, z - 0.09, x + 0.09, z + 0.09, paint); }
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
