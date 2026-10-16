// REGISTRY IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/registry.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts registry-gwot`.
// ITS OWN PLACE: a provincial records office — tiled public floors, dark varnish, no accent paint. What it alone has: TILES and WAYFINDING LINES. The red line
// is the public's way (the gallery to the counter and the registrar's door: the fast line), the blue line the clerks' (the serpentine through the stacks to the
// sorting room: the long one) — the level's one decision, painted on its floor.
import { build as buildPlain, NOTES as PLAIN_NOTES, REGISTRY_ROOMS, REGISTRY_ROWS } from './registry';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'registry-gwot';
export const DRESS_AS = 'registry';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = REGISTRY_ROOMS;
const SKIN: Skin = {
  wall: 'render', house: 'render', inner: 'whitewash', frameOut: 'woodGrey', frameIn: 'woodGrey', dado: 'blanketBrown',
  floor: { stone: 'slab', lino: 'slab', carpet: 'canvas' },
  metals: ['woodGrey', 'iron', 'galv'], patches: 4,
  // (the rescue names no rooms: the registrar's office is the one room that is lived in — the level's only wainscot and its only patterned rug)
  rooms: [{ id: 'office', bounds: R.office }, { id: 'hall', bounds: R.hall }, { id: 'gallery_corridor', bounds: R.gallery }], noRug: /./, rugs: { office: 'afghan' },
  dress: (G, _level, T) => {
    const M = lookMarks(T), tile = (x: number, z: number) => { const fa = T.floorAt(x, z); return fa ? T.tone(fa, 0.62) : null; };
    // TILES on the public floors: the lobby, the gallery, the hall (never the reading room: a dark square on its floor reads as a man through the glass)
    const lobbyRug = (x: number, z: number) => Math.abs(x - 7.0) < 1.9 && Math.abs(z - 14.7) < 1.4, runner = (_x: number, z: number) => Math.abs(z - 11.4) < 0.55;
    const tl = tile(7, 8), tg = tile(12, 10.3), th = tile(26.5, 8);
    if (tl) M.checker(R.lobby.x0, R.lobby.z0, R.lobby.x1, R.lobby.z1, 0.97, tl, lobbyRug);
    if (tg) M.checker(R.gallery.x0, R.gallery.z0, R.gallery.x1, R.gallery.z1, 0.97, tg, runner);
    if (th) M.checker(R.hall.x0, R.hall.z0, R.hall.x1, R.hall.z1, 0.97, th);
    // THE RED LINE: from the front door, down both sides of the gallery, to the counter and to the registrar's door
    const red = P.drumRed, blue = P.drumBlue;
    M.path([[4.6, 14.7], [8.6, 14.7], [8.6, 10.4], [24.9, 10.4], [24.9, 7.0]], 0.12, red);
    M.path([[10.1, 12.42], [28.3, 12.42], [28.3, 6.0], [28.9, 6.0]], 0.12, red);
    M.seg(24.7, 6.85, 27.7, 6.85, 0.16, P.stencil);                                           // 'wait here', a stride short of the counter
    // THE BLUE LINE: the clerks' way — through the stacks' west door, round the open end of every row, to the sorting room's door
    M.path([[8.6, 14.7], [8.6, 18.0], [11.6, 18.0], [11.6, 21.9], [15.0, 21.9], [15.0, 14.9], [18.6, 14.9], [18.6, 21.9], [22.2, 21.9], [22.2, 14.9], [26.5, 14.9], [26.5, 16.2], [28.9, 16.2]], 0.12, blue);
    // ROW NUMBERS at each row's open end
    REGISTRY_ROWS.forEach((row, i) => { const south = row.z0 < 14; M.glyph(String(i + 1), row.x, south ? row.z1 + 0.75 : row.z0 - 0.75, 0.8, P.stencil); });
    // a dark foot under the reading room's glass, on both faces: the pane is found from above by the band under it
    G.skirt('x', 10, 10.7, 14.3, 1, 'woodGrey', 0.5, 0.12); G.skirt('x', 10, 10.7, 14.3, -1, 'woodGrey', 0.5, 0.12);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
