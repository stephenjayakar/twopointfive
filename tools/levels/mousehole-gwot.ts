// MOUSEHOLE IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/mousehole.ts's clinic, box for box, in other clothes — tools/levels/gwotSkin.ts says what may
// change (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts mousehole`.
// ITS OWN PLACE: a district clinic — cement render outside, whitewash in, bare slab underfoot. What it alone has: THE QUEUE. A dashed line in the clinic's teal
// runs the length of the corridor from the porch to a 'wait here' box under the duty room's hatch (the lane the hatch gun looks down, read off the ground), with
// a standing square in front of each room's door, and a teal cross on the porch. No accent paint on a wall.
import { build as buildPlain, NOTES as PLAIN_NOTES, MOUSEHOLE_ROOMS } from './mousehole';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'mousehole-gwot';
export const DRESS_AS = 'mousehole';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = MOUSEHOLE_ROOMS;
/** the clinic's teal. The palette has no paint of this hue, so it is a colour of this file's own and only decals wear it; the outside door's paint is this,
 *  darker: src/scene/look.ts LOOK_DOORS */
const TEAL: Vec3 = [0.07, 0.3, 0.29];
const SKIN: Skin = {
  wall: 'render', house: 'render', inner: 'whitewash', frameOut: 'woodGrey', frameIn: 'poplar', dado: null, ground: 'dust', verge: 'dirt', patches: 5,
  floor: { carpet: 'slab', lino: 'slab', stone: 'slab' },
  noRug: /ward|exam|store|corridor/, metals: ['galv', 'tin', 'plasticWhite', 'iron'],
  rooms: [{ id: 'corridor', bounds: R.corridor.bounds }],
  dress: (_G, _level, T) => {
    const M = lookMarks(T), worn = T.tone(TEAL, 0.8);
    // THE QUEUE: porch → the hatch, a stride off the benches on the south wall
    M.dashed(9.6, 17.6, 25.2, 17.6, 0.08, worn, 0.7, 0.5);
    M.path([[25.2, 17.6], [26.1, 17.6], [26.1, 16.4]], 0.08, worn);
    // WAIT HERE: the box under the hatch
    M.outline(25.5, 15.3, 26.7, 16.3, 0.08, TEAL);
    // one at a time: a standing square in front of each room's door
    for (const x of [12.05, 18.05, 24.05]) M.outline(x - 0.5, 15.25, x + 0.5, 16.05, 0.06, worn);
    // THE CROSS on the porch
    M.fill(7.3, 16.2, 7.8, 17.7, TEAL); M.fill(6.8, 16.7, 8.3, 17.2, TEAL);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
