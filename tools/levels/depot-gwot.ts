// DEPOT IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/depot.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts depot-gwot`.
// ITS OWN PLACE: an old army motor pool and its signals hut — cream over oxide red, oil black. What it alone has: VEHICLES AND LETTERED DOORS. Each held
// room's letter is painted on the ground at its doors (A the crew room, B the signals hut — at its one door, and again on the yard under the window that
// has no door beside it — C the store), the yard has its parking bays, the stop line at the gate and a keep-clear box at the store's hatch, the bay its
// inspection pit. No green, no mud.
import { build as buildPlain, NOTES as PLAIN_NOTES, DEPOT_ROOMS } from './depot';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'depot-gwot';
export const DRESS_AS = 'depot';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = DEPOT_ROOMS;
const SKIN: Skin = {
  wall: 'tWall', house: 'tWall', inner: 'paintCream', frameOut: 'paintRust', frameIn: 'woodGrey', dado: 'paintRust',
  floor: { carpet: 'slab', stone: 'slab', lino: 'block' }, noRug: /./, rugs: { crew: 'mat' },
  metals: ['olive', 'rust', 'drumRed', 'iron'],
  rooms: [{ id: 'duty', bounds: R.duty }],
  dress: (G, _level, T) => {
    const M = lookMarks(T), paint = T.tone(P.stencil, 0.92), Y = P.genYellow, K = P.iron;
    // THE LETTERS: A the crew room (its yard door, its wash-room door), B the signals hut (its one door, from the generator room — and on the yard under its
    // west window, where a door would be), C the store (its yard door, its bay door)
    M.glyph('A', 12.25, 10.7, 0.85, paint); M.glyph('A', 16.5, 6.75, 0.85, paint);
    M.glyph('B', 25.75, 8.3, 0.85, paint); M.glyph('B', 22.9, 11.9, 0.85, paint);
    M.glyph('C', 22.75, 17.4, 0.85, paint); M.glyph('C', 16.9, 20.75, 0.85, paint);
    // THE YARD: the stop line inside the gate, two parking bays on the south side, a keep-clear box in front of the store's hatch, the ruts in from the road
    M.seg(4.7, 12.6, 4.7, 15.4, 0.14, paint);
    M.outline(9.6, 15.5, 15.6, 18.3, 0.12, paint, 'n'); M.outline(15.6, 15.5, 19.0, 18.3, 0.12, paint, 'n');
    M.outline(19.3, 17.3, 21.5, 18.3, 0.07, paint); for (let x = 19.5; x < 21.3; x += 0.6) M.seg(x, 18.25, x + 0.35, 17.35, 0.06, paint);
    G.ruts(0.6, 14.0, 9.0, 14.0, 'oil'); G.patch(12.4, 16.9, 1.5, 1.0, 'oil', 0.1); G.patch(17.2, 16.8, 1.1, 0.8, 'oil', 1.3); G.patch(15.0, 12.6, 0.9, 0.7, 'oil', 0.2);
    // THE BAY: the inspection pit's hazard edge, drawn round the truck that stands over it
    M.hazard(10.9, 21.55, 15.9, 21.7, Y, K); M.hazard(10.9, 21.7, 11.1, 23.7, Y, K, 0.25); M.hazard(15.7, 21.7, 15.9, 23.7, Y, K, 0.25);
    // THE EAST YARD: the fuel point's bund
    M.outline(26.4, 22.2, 28.8, 23.86, 0.1, Y);
    // THE SIGNALS HUT: the darker anti-static floor round the desk
    { const fa = T.floorAt(27, 12.6); if (fa) M.fill(25.7, 11.7, 28.4, 13.7, T.tone(fa, 0.78)); }
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
