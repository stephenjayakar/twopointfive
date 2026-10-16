// THE LONG HALL IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/hall.ts's barrack wing, box for box, in other clothes — tools/levels/gwotSkin.ts says what
// may change (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts hall`.
// ITS OWN PLACE: a border scouts' company wing — pale mud plaster outside, cream distemper in, bare slab underfoot, a rug in the bunks and one in the ready room.
// What it alone has: THE RANGE CARD. The men who hold the hall have paced it out and painted it on the floor in the company's pale sky blue: a firing line across the
// far end, in front of where they stand; a line across the hall every five metres from it with its distance, written to be read from their end; and the two
// limits of their arc, which run from the firing line down the whole hall, out through the front door's jambs and end on the twenty-metre line on the porch.
// The floor between those two lines is what the far guns see: indoors it is the hall, outside it is the strip nobody stands on when 'front' opens.
// No accent paint on a wall.
import { build as buildPlain, NOTES as PLAIN_NOTES } from './hall';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'hall-gwot';
export const DRESS_AS = 'hall';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
/** the company's pale sky blue. The palette has no paint this pale (its blues are deep ones), so it is a colour of this file's own and only decals wear it; the outside door's paint is this,
 *  darker: src/scene/look.ts LOOK_DOORS */
const SKY: Vec3 = [0.25, 0.55, 0.72];
/** the firing line (x), the hall's two walls' faces (z), the line of the front door (z) and half its opening */
const FIRE_X = 27.6, HALL_Z0 = 12.92, HALL_Z1 = 15.08, DOOR_Z = 14.25, DOOR_HALF = 0.45, FRONT_X = 9;
const SKIN: Skin = {
  wall: 'mudLight', house: 'mudLight', inner: 'paintCream', frameOut: 'woodGrey', frameIn: 'woodGrey', dado: null, ground: 'dust', verge: 'scrub', patches: 5,
  floor: { lino: 'slab' },
  noRug: /kit|store|hall/, rugs: { bunks: 'kilim', ready: 'baluch' }, metals: ['iron', 'olive', 'galv'],
  dress: (_G, _level, T) => {
    const M = lookMarks(T), worn = T.tone(SKY, 0.8), Q = Math.PI / 2;
    // THE FIRING LINE, across the hall in front of the far end
    M.seg(FIRE_X, HALL_Z0, FIRE_X, HALL_Z1, 0.14, SKY);
    // A LINE EVERY FIVE METRES from it, each with its distance beside it (top toward the front door: read from the far end)
    for (const m of [5, 10, 15]) {
      const x = FIRE_X - m;
      M.seg(x, HALL_Z0, x, HALL_Z1, 0.06, worn);
      M.word(String(m), x + 0.5, 13.3, 0.5, worn, Q);
    }
    // THE LIMITS OF THE ARC: from the firing line through the front door's two jambs and on to the twenty-metre line on the porch
    const far = FIRE_X - 20, k = (FIRE_X - far) / (FIRE_X - FRONT_X), dz = DOOR_HALF * k;
    for (const s of [-1, 1]) M.seg(FIRE_X, DOOR_Z, far, DOOR_Z + s * dz, 0.05, worn);
    M.seg(far, DOOR_Z - dz - 0.25, far, DOOR_Z + dz + 0.25, 0.06, worn);
    M.word('20', far + 0.5, DOOR_Z - dz - 0.75, 0.5, worn, Q);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
