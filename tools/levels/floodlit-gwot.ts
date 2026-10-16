// THE FLOODLIT YARD IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/floodlit.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says
// what may change (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did.
// `bun run tools/levels/export.ts floodlit` writes both files.
// ITS OWN PLACE: the fuel post of a bush airstrip — blockwork behind a block wall, black steel frames, and aviation ORANGE, on the ground only. What it alone
// has: A LANDING PAD. The yard the floodlights were hung for is a helicopter pad: the ring and its H in the middle of the open ground between the pickup and
// the fuel drums, approach chevrons in through the gate, a wind tee in the dead east end. The pad says, from above, where the open ground is — the eleven
// metres the level is about — and it lies the same whichever way the team comes in. No letters or numbers at doors, no bays, no lanes.
import { build as buildPlain, NOTES as PLAIN_NOTES } from './floodlit';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'floodlit-gwot';
export const DRESS_AS = 'floodlit';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
/** the pad's paint. The palette (src/scene/gwotPalette.ts) has no paint of this hue, so it is a colour of this file's own and only decals wear it */
const ORANGE: Vec3 = [0.74, 0.2, 0.03];
/** the middle of the pad: the open yard between the pickup (x ≤ 13.4) and the drums (x ≥ 26.7), on the gate's line */
const PAD: [number, number] = [20.0, 18.6], PAD_R = 3.2;
const SKIN: Skin = {
  wall: 'block', house: 'render', inner: 'whitewash', frameOut: 'iron', frameIn: 'woodGrey', dado: null,
  floor: { lino: 'slab' }, noRug: /./, metals: ['olive', 'galv', 'iron', 'rust'], patches: 0,   // (no patches: one would lie over the pad)
  dress: (_G, _level, T) => {
    const M = lookMarks(T), white = T.tone(P.plasticWhite, 0.9), [cx, cz] = PAD;
    // THE RING: an octagon, the way a pad is painted with a roller and a string
    { const pts: [number, number][] = []; for (let i = 0; i <= 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push([cx + Math.cos(a) * PAD_R, cz + Math.sin(a) * PAD_R]); } M.path(pts, 0.16, ORANGE); }
    // THE H, read from the gate
    for (const s of [-1, 1]) M.seg(cx + s * 0.8, cz - 1.25, cx + s * 0.8, cz + 1.25, 0.3, white);
    M.seg(cx - 0.8, cz, cx + 0.8, cz, 0.3, white);
    // THE APPROACH: two chevrons in from the gate, pointing at the pad
    for (const z of [23.1, 22.5]) { M.seg(cx - 0.9, z + 0.45, cx, z, 0.14, ORANGE); M.seg(cx + 0.9, z + 0.45, cx, z, 0.14, ORANGE); }
    // THE WIND TEE in the dead east end of the yard: a T on the ground, its stem down the prevailing wind
    { const x = 32.4, z = 20.6; M.seg(x - 0.9, z - 0.8, x + 0.9, z - 0.8, 0.22, white); M.seg(x, z - 0.8, x, z + 1.0, 0.22, white); }
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
