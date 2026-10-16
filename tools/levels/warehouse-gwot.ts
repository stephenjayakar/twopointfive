// WAREHOUSE IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/warehouse.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts warehouse-gwot`.
// ITS OWN PLACE: a bonded customs shed on the ring road — bare block, hazard yellow and black, rust. What it alone has: LOGISTICS PAINT (a hazard band
// across both sides of every hall door, a number on the apron outside each of the five ways in, lane lines along the racks, pallet squares on the marshalling
// floor and the dock, truck bays outside the shutters). No rugs, no dados, no earth indoors.
import { build as buildPlain, NOTES as PLAIN_NOTES, WAREHOUSE_ROOMS } from './warehouse';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P, type GwotMat } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'warehouse-gwot';
export const DRESS_AS = 'warehouse';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = WAREHOUSE_ROOMS;
const LOADS: GwotMat[] = ['sack', 'olive', 'sack', 'tarpBlue', 'olive', 'ply', 'sack', 'olive', 'sack', 'ply'];
const SKIN: Skin = {
  wall: 'block', house: 'block', inner: 'block', frameOut: 'genYellow', frameIn: 'woodGrey', verge: 'gravel', dado: null, noRug: /./,
  floor: { lino: 'slab', concrete: 'slab', carpet: 'canvas' },
  metals: ['rust', 'galv', 'iron', 'genYellow'],
  rooms: [{ id: 'north_corridor', bounds: R.ncorr }, { id: 'west_corridor', bounds: R.wcorr }],   // (the scuffed band along a corridor's walls)
  // THE HALL: its racking's blue uprights and orange beams are a European distribution shed's, its loads taped cartons — here rusted frames, grey timber
  // decks, and on them sacks, olive crates, a tarp-wrapped pallet, plywood cases (each standing for exactly what it was: a carton is still a carton to a round)
  pick: c => { const a = c.b.albedo;
    if (c.name === undefined && a[2] > 0.4 && a[0] < 0.15) return 'rust';
    if (c.name === undefined && a[0] > 0.6 && a[1] < 0.4 && a[2] < 0.1) return 'woodGrey';   // (the racking's orange beams — not the forklift's yellow body, which keeps its colour)
    if (c.name === 'cardboard' && c.y1 - c.y0 > 0.5) return LOADS[(c.i * 7 + 3) % LOADS.length];
    if (c.name === 'wood' && c.y1 - c.y0 > 0.8 && c.thin > 0.7) return 'ply';
    return undefined; },
  dress: (G, _level, T) => {
    const M = lookMarks(T), Y = P.genYellow, K = P.iron, paint = T.tone(P.stencil, 0.92);
    G.ruts(30.0, 26.0, 39.0, 26.0); G.patch(20, 16.6, 1.5, 1.0, 'oil', 0.4); G.patch(20.5, 16.3, 0.9, 0.7, 'oil', 1.2, 0.0125); G.patch(27, 19, 1.3, 0.9, 'oil', 1.1); G.patch(16, 21.4, 2.6, 1.6, 'damp', 0.2);
    // lane lines along the racks' feet, worn through in places
    for (const z of [13.7, 15.3, 18.7, 20.3]) for (let x = 14.4, k = 0; x < 26.4; x += 2.0, k++) { if ((k * 5 + Math.round(z * 10)) % 7 === 0) continue; M.seg(x, z, x + 1.4, z, 0.16, paint); }
    // A HAZARD BAND either side of every door of the hall (and the dock's own north door): where the lanes are entered is what the eye finds first
    const band = (x: number, z: number, wallAlongX: boolean) => { for (const s of [-1, 1]) { if (wallAlongX) M.hazard(x - 0.9, z + s * 0.62 - 0.2, x + 0.9, z + s * 0.62 + 0.2, Y, K); else M.hazard(x + s * 0.62 - 0.2, z - 0.9, x + s * 0.62 + 0.2, z + 0.9, Y, K); } };
    band(13.0, 19.4, false); band(22.4, 11.0, true); band(30.0, 14.4, false); band(30.0, 21.4, false); band(33.4, 11.0, true);
    // THE FIVE WAYS IN, numbered on the apron outside each: the staff door, the fire exit, the plant room's door, the dock's two
    M.glyph('1', 11.4, 25.7, 1.4, paint); M.glyph('2', 2.4, 9.4, 1.4, paint); M.glyph('3', 6.4, 2.4, 1.4, paint); M.glyph('4', 37.7, 13.4, 1.4, paint); M.glyph('5', 37.7, 21.4, 1.4, paint);
    // two TRUCK BAYS outside the shutters, backed up to and driven off a hundred times
    M.outline(36.5, 14.9, 39.9, 17.3, 0.12, paint, 'e'); M.outline(36.5, 17.3, 39.9, 19.7, 0.12, paint, 'e'); G.patch(38.2, 16.1, 1.6, 0.9, 'oil', 0.2); G.patch(38.0, 18.6, 1.2, 0.8, 'oil', -0.3);
    // PALLET SQUARES on the marshalling floor and in the dock, some standing empty, each with its tally
    const sq = (x: number, z: number, n: number) => { M.outline(x - 0.8, z - 0.7, x + 0.8, z + 0.7, 0.07, paint); if (n) M.tally(x, z + 0.95, n, paint, true, 0.3, 0.06, 0.14); };
    sq(27.4, 13.2, 1); sq(27.4, 15.3, 2); sq(27.4, 17.4, 3); sq(27.6, 22.4, 4); sq(34.9, 16.0, 1); sq(34.9, 18.6, 2); sq(32.6, 17.6, 0); sq(32.8, 20.4, 3); sq(32.8, 14.6, 4);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
