// CONSULATE IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/consulate.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts consulate-gwot`.
// ITS OWN PLACE: a neighbouring state's consulate on one floor of a town house — sand plaster inside and out, dark varnish, bare stone and boards, and PLUM CARPET.
// What it alone has: PROTOCOL UNDERFOOT, carpet bound in brass. The public's roped lane from the front door, the star in the lobby, the state runner down the
// corridor, and the hall carpeted wall to wall (a room, not a route: the registry, cut from the same plan, paints a line to its door — this one does not); the same
// carpet comes out as a mat under the consul's SIDE door, and what leads to that one is only the staff's tread, worn into the back office's floor from the hall's door and
// from the kitchen's — the level's one decision (a pair on each door) read off the ground. A brass sill lies in every opening, as long as the opening is wide.
import { build as buildPlain, NOTES as PLAIN_NOTES, CONSULATE_ROOMS, CONSULATE_SPLIT } from './consulate';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'consulate-gwot';
export const DRESS_AS = 'consulate';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = CONSULATE_ROOMS, SPLIT = CONSULATE_SPLIT;
/** the carpets' plum. The palette has no paint of this hue (its reds are the depot's and the registry's), so it is a colour of this file's own and only decals
 *  wear it; the wainscot is the palette's dark madder. The outside doors' paint is this, lighter: src/scene/look.ts LOOK_DOORS */
const PLUM: Vec3 = [0.15, 0.035, 0.075];
const SKIN: Skin = {
  wall: 'mudLight', house: 'mudLight', inner: 'mudLight', frameOut: 'blanketBrown', frameIn: 'blanketBrown', dado: 'rugMadder', ground: 'gravel', verge: 'scrub', patches: 4,
  floor: { stone: 'slab', lino: 'slab', carpet: 'blanketBrown', carpetBlue: 'poplar' },   // (the consul's office: bare boards round its two carpets — a fitted carpet in the dark madder read 0.045, a hole in the floor)
  metals: ['woodGrey', 'iron'],
  // (the rescue names no rooms. The wine wainscot goes round the floors a GUEST walks — each has the level's own rug on it, so the skin lays none; the hall's is
  // laid by hand below — and the staff's rooms stay plain: which of them holds a man is drawn at each staging, and no paint says)
  rooms: [{ id: 'lobby', bounds: R.lobby }, { id: 'corridor', bounds: R.corridor }, { id: 'waiting', bounds: R.waiting }, { id: 'suite', bounds: R.suite }],
  noRug: /./, rugs: { lobby: 'afghan', corridor: 'afghan', waiting: 'afghan', suite: 'afghan' },
  // filing cabinets in bare zinc (no army olive in a consulate), the consul's couch in oxblood
  pick: c => { const a = c.b.albedo; if (c.name !== undefined || c.group === 'floors') return undefined; if (c.steel && a[0] < 0.7) return 'galv'; return a[0] === 0.3 && a[1] === 0.12 && a[2] === 0.1 ? 'rugRed' : undefined; },
  dress: (G, level, T) => {
    // (two sets of marks: M on the bare floor, Hi over the level's own rugs — their tops stand at 0.024)
    const M = lookMarks(T), Hi = lookMarks({ ...T, flat: (x, z, w, d, a, yaw = 0, y = 0.011) => T.flat(x, z, w, d, a, yaw, y + 0.0146) });
    const wine = T.tone(PLUM, 1.8), brass = P.rugOchre;
    // A BRASS SILL in every inside opening, as long as the opening is wide: the nine doors, the waiting room's arch, the corridor's mouth — and the gap in the wall
    // across the consul's office, which is a doorway to whoever has to fight through it
    for (const d of level.doors) { if (d.exterior) continue; const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir); M.seg(d.hinge[0], d.hinge[1], d.hinge[0] + ux * d.width, d.hinge[1] + uz * d.width, 0.28, brass); }
    M.seg(12.4, 13.2, 14.6, 13.2, 0.28, brass); M.seg(10.0, R.corridor.z0, 10.0, R.corridor.z1, 0.28, brass); M.seg(R.suite.x0, SPLIT.z, SPLIT.x0, SPLIT.z, 0.28, brass);
    // THE STAR let into the lobby's stone on the corridor's own axis: a man standing on it is standing in the corridor's line
    { const x = 7.0, z = 11.6, q = Math.PI / 4; for (const [s, col] of [[1.7, brass], [1.46, wine]] as const) for (const yaw of [0, q]) T.flat(x, z, s, s, col, yaw, 0.0119 + (s < 1.6 ? 0.0004 : 0) + (yaw ? 0.0002 : 0));
      T.flat(x, z, 0.4, 0.4, brass, q, 0.013); }
    // THE STATE RUNNER: from the star, over the level's own runner, down the corridor to the hall's mouth and no further
    Hi.path([[8.75, 11.6], [23.55, 11.6]], 0.9, wine); Hi.seg(8.3, 11.2, 24.0, 11.2, 0.06, brass); Hi.seg(8.3, 12.0, 24.0, 12.0, 0.06, brass);
    // THE HALL, carpeted wall to wall, one brass line round it broken at each of its doors and at the corridor's mouth: four ways out of one room, none of them drawn
    { const x0 = R.hall.x0 + 0.2, x1 = R.hall.x1 - 0.2, z0 = R.hall.z0 + 0.2, z1 = R.hall.z1 - 0.2, a = x0 + 0.3, b = x1 - 0.3, c = z0 + 0.3, e = z1 - 0.3;
      Hi.fill(x0, z0, x1, z1, wine);
      Hi.seg(a, c, b, c, 0.07, brass); Hi.seg(b, c, b, 5.3, 0.07, brass); Hi.seg(b, 6.7, b, e, 0.07, brass); Hi.seg(a, e, 25.9, e, 0.07, brass); Hi.seg(27.3, e, b, e, 0.07, brass); Hi.seg(a, c, a, 8.3, 0.07, brass); }
    // THE PUBLIC'S LANE: brass sockets for the rope posts, a metre apart, from the front door round the lobby's carpet to the corridor's mouth (and a mat outside the door)
    { const dot = (x: number, z: number) => T.flat(x, z, 0.14, 0.14, brass, Math.PI / 4, 0.0125);
      for (let x = 5.0; x <= 9.76; x += 0.95) dot(x, 19.5); for (let x = 5.0; x <= 8.81; x += 0.95) dot(x, 17.7);
      for (let z = 18.55; z >= 13.3; z -= 0.95) dot(9.75, z); for (let z = 16.75; z >= 13.3; z -= 0.95) dot(8.8, z);
      M.fill(2.9, 18.0, 3.86, 19.2, wine); M.outline(2.9, 18.0, 3.86, 19.2, 0.06, brass, 'e'); }
    // THE STAFF'S TREAD to that mat, worn into the back office's carpet: from the hall's door, and the tea's way from the kitchen table through the kitchen's back door
    { const fb = T.floorAt(26.6, 15.5), fk = T.floorAt(22.5, 20.0);
      if (fb) { const w = T.tone(fb, 0.78); M.path([[26.6, 14.1], [26.6, 17.0], [27.6, 17.0]], 0.6, w); M.path([[24.55, 21.0], [25.2, 21.0], [27.5, 17.8]], 0.6, w); }
      if (fk) M.path([[21.9, 19.2], [23.0, 21.0], [23.45, 21.0]], 0.6, T.tone(fk, 0.78)); }
    // THE SAME CARPET under his SIDE door, a mat and no more (laid after the tread, which stops short of it): the room has two doors and this is the other one
    M.fill(28.0, 16.55, 28.93, 17.45, wine); M.outline(28.0, 16.55, 28.93, 17.45, 0.06, brass, 'e');
    // THE CARPETS, each bound in brass with a lozenge at its middle: the lobby's, the waiting room's and the sitting room's are the level's own rugs covered, and the north half of the
    // consul's office gets the twin of the south half's — neither half is the better dressed
    const carpet = (x: number, z: number, w: number, d: number, loz = true) => { Hi.fill(x - w / 2, z - d / 2, x + w / 2, z + d / 2, wine); Hi.outline(x - w / 2 + 0.14, z - d / 2 + 0.14, x + w / 2 - 0.14, z + d / 2 - 0.14, 0.07, brass);
      if (loz) { T.flat(x, z, 0.62, 0.62, brass, Math.PI / 4, 0.0286); T.flat(x, z, 0.44, 0.44, wine, Math.PI / 4, 0.0288); } };
    carpet(7.0, 15.4, 3.0, 2.4); carpet(13.5, 18.6, 3.4, 2.6, false);   // (the waiting room's: its middle is under the coffee table)
    carpet(32.6, 15.6, 3.6, 2.4); carpet(32.6, 8.9, 3.6, 2.4);
    // the fitted carpet's border, a rectangle to each half of the consul's office: one room, two floors to take
    M.outline(R.suite.x0 + 0.3, R.suite.z0 + 0.3, R.suite.x1 - 0.3, SPLIT.z - 0.36, 0.07, brass); M.outline(R.suite.x0 + 0.3, SPLIT.z + 0.36, R.suite.x1 - 0.3, R.suite.z1 - 0.3, 0.07, brass);
    // the hall's wainscot (no rug of the level's lies there, so the skin would lay one across the carpet: its four walls by hand, between the doors)
    const wains = (axis: 'x' | 'z', line: number, a: number, b: number, side: 1 | -1, t = 0.12) => G.skirt(axis, line, a, b, side, 'rugMadder', 1.1, t);
    wains('x', 4, R.hall.x0, R.hall.x1, 1, 0.24); wains('z', 24, R.hall.z0, 8.4, 1); wains('z', 24, 9.6, 10.06, 1); wains('z', 29, R.hall.z0, 5.4, -1); wains('z', 29, 6.6, R.hall.z1, -1);
    wains('x', 13.2, R.hall.x0, 26.0, -1); wains('x', 13.2, 27.2, R.hall.x1, -1);
    // the panel under the visa office's glass, wine on both faces: the pane is found from above by the band under it
    G.skirt('x', 10, 10.7, 14.3, 1, 'rugMadder', 0.5, 0.12); G.skirt('x', 10, 10.7, 14.3, -1, 'rugMadder', 0.5, 0.12);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
