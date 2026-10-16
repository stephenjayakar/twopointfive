// COMPOUND IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/compound.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts compound-gwot`.
// ITS OWN PLACE: a farmer's walled house that a family still lives in — mud and blue. What it alone has: the HOUSEHOLD on the ground (a vegetable plot the
// cistern waters, fruit and chillies drying on sheets, a rug out to air, the cook fire's ash behind the kitchen, a chalk game by the front door) and patterned
// rugs in every room. No painted lines, no stencils.
import { build as buildPlain, NOTES as PLAIN_NOTES, COMPOUND_ROOMS } from './compound';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'compound-gwot';
export const DRESS_AS = 'compound';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = COMPOUND_ROOMS;
const SKIN: Skin = {
  wall: 'mud', house: 'mud', inner: 'whitewash', frameOut: 'paintBlue', frameIn: 'poplar', dado: 'paintBlue', verge: 'dirt', patches: 6,
  // (every room is dressed, held or not: a rug must not say 'somebody holds this one')
  rooms: [{ id: 'pantry', bounds: R.pantry }, { id: 'spare', bounds: R.spare }, { id: 'hall', bounds: R.hall }, { id: 'corridor', bounds: R.corridor }],
  rugs: { sala: 'afghan', office: 'baluch', bunk: 'kilim', back: 'felt', pantry: 'mat', spare: 'kilim' },
  metals: ['paintBlue', 'rust', 'galv', 'woodGrey', 'paintGreen'],   // (a family's house: no army olive on its shelves)
  // the two cars: a dust-tan pickup and a yellow taxi (never a neutral grey or white on the pickup: a plain grey box is a steel cabinet to a blast — furnblast.ts steelGrey — and it was not one)
  pick: c => { const a = c.b.albedo; if (c.name !== undefined) return undefined; return a[0] === 0.24 && a[1] === 0.27 ? 'truckTan' : a[0] === 0.42 && a[1] === 0.4 && a[2] === 0.36 ? 'jerryYellow' : undefined; },
  dress: (G, _level, T) => {
    const M = lookMarks(T);
    // the track comes in by the MAIN gate (the only one a car fits through) and turns to where the pickup stands
    G.ruts(23.5, 27.4, 23.5, 21.6); G.ruts(23.2, 21.9, 17.8, 22.9);
    G.rug(17.0, 21.0, 2.4, 1.5, 'kilim', 0.12);                                             // a rug beaten and left out in the yard to air
    G.patch(11.0, 9.8, 2.0, 1.4, 'canvas', 0.3); G.patch(11.0, 9.8, 1.5, 0.95, 'prodRed', 0.3, 0.0135);   // chillies drying on a sheet by the kitchen wall
    G.patch(9.7, 10.3, 1.5, 1.1, 'canvas', -0.25); G.patch(9.7, 10.3, 1.05, 0.7, 'prodOrange', -0.25, 0.0135);   // and apricots beside them
    // THE VEGETABLE PLOT in the west yard, north of the west gate: six furrows of turned earth, a row of green down each, and the wet channel from the cistern
    const fa = T.floorAt(6.2, 11.4);
    if (fa) { const earth = T.tone(fa, 0.55);
      for (let i = 0; i < 6; i++) { const x = 5.0 + i * 0.5; M.seg(x, 9.7, x, 13.1, 0.32, earth);
        for (let k = 0; k < 7; k++) { if ((i * 3 + k) % 5 === 0) continue; M.fill(x - 0.08, 9.95 + k * 0.45, x + 0.08, 10.11 + k * 0.45, (i + k) % 3 ? P.prodGreen : P.scrub); } }
      M.path([[7.8, 12.4], [7.75, 13.3], [4.9, 13.3]], 0.14, P.damp); }
    // the cook fire behind the kitchen: ash on the ground, soot up the wall
    G.patch(14.2, 5.35, 1.5, 1.2, 'damp', 0.2); G.patch(14.25, 5.4, 0.8, 0.65, 'oil', 0.7, 0.0128); G.skirt('x', 6.5, 13.7, 14.8, -1, 'iron', 1.25, 0.24);
    // a chalk hopscotch by the front door (thin lines: the one pale thing on this ground)
    { const chalk = T.tone(P.whitewash, 0.85), x = 20.3, s = 0.5; let z = 20.0;
      for (const two of [false, false, true, false, true, false]) { if (two) { M.outline(x - s, z, x, z + s, 0.05, chalk); M.outline(x, z, x + s, z + s, 0.05, chalk); } else M.outline(x - s / 2, z, x + s / 2, z + s, 0.05, chalk); z += s; } }
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
