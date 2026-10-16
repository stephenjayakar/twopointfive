// THE REGISTRY — the hostage rescue's level: one lit gallery straight to the room, two rooms you may run past, and a long dark locked way round to its other door.
// A level generator in the scenario levels' shape (tools/levels/test-rooms.ts is the template; rebuild/scenario-levels/contract.md the how-to):
//   bun run tools/levels/export.ts registry [--check]   → levels/registry.json, with its `scenarios.rescue` block
//   page: ?levelFile=registry.json&rescue                · headless: bun run tools/qa/probes.ts registry
//
// The idea it playtests (the levels goal's assumption, not the maintainer's words): THE CLOCK DECIDES WHAT YOU SKIP. The captor's clock starts on the team's
// first step; the hostages are at the far end; and between the team and their door are two rooms the gallery passes. What the layout does about it:
//   · THE FAST LINE is the gallery: ~25 m on foot from the team's mark to the main door, lit, straight. It passes the READING ROOM (a glass front: one look
//     on the run says what is in it) and the COPY ROOM (a blind wall and a shut door: nothing says what is in it but opening it);
//   · the copy room has a SECOND DOOR, onto the hall the team stacks in, and it has been left STANDING OPEN: from the dark inside it there is a line straight
//     onto the men stacked on the main door. One of the captors' men is in one of those two rooms (the rescue's own coin), and his mark in the copy room is on
//     that line: the glass answers which room, for whoever looked — nobody behind the glass means he is behind the blind wall;
//   · the hall has its own man behind the registry counter at its north end, under the one panel burning in there, gun on the gallery's mouth;
//   · THE LONG LINE is the stacks: ~46 m to the side door, dark, round four rows of 2 m shelving. Its two doors (out of the lobby, into the sorting room) are
//     LOCKED against the commander — locks stop only him, so what they charge is his time: a pick is 4.2 s and quiet, a boot is a second and the floor hears
//     it. The stacks' door onto the hall locks from the hall's side: no short cut from the gallery, a way round to the main door from the stacks.
//
//          x 4      10          17          24      29          36
//      z 4 +--------+-----------+-----------+-------+-----------+
//          |        |  READING  |   COPY    |counter o REGISTRAR |      o  = 'office', the MAIN door (the hall's north end; locked)
//          |        |  ROOM     |   ROOM    | HALL   |(hostages) |
//          |        |           |          ch        |           |      ch = 'copy_hall' (standing open)
//          | LOBBY  +=glass=-r--+----c------+        |           |      r = 'reading'   c = 'copy'
//          |           the GALLERY  ───────►         |           |
//          |        +-------------------------sh-----+----os-----+ z 12.8   sh = 'stacks_hall' (locks from the hall)   os = 'office_side' (the SIDE door)
//   front ==  team  |   |       |       |           so  SORTING  |      so = 'sorting' (locked)
//          |        sw  |   |   |   |   |   THE      |           == fire_exit     sw = 'stacks_w' (locked)
//          |        |   |   |   |   |   |  STACKS    |           |
//     z 24 +--------+-------+-------+----------------+-----------+
//
// The shell is the office's (exterior walls on x 4 / 36, z 4 / 24) so what the game still keys to that footprint — the weather's INTERIOR rectangle, the world
// bounds typed into the shaders — holds without a change. The footstep surface map is still game/floor.ts's, the OFFICE's rectangles in code, whatever level
// is loaded: the floors below are painted for the picture, a step here sounds as the office's floor at that spot does.
// Only the old demo's kit (src/scene/officeGen.ts officeKit: its walls, doors, glass, furniture, lights, palette and markings). Units: meters. +X east, +Z south, +Y up.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, Rect } from '../../src/scene/scenarios';
import { officeKit, normalize3 as norm, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { livedPieces, INK, h01 } from './livedPieces';

export const NAME = 'registry';
export const NOTES = 'The registry: a lobby, a lit gallery past a glass-fronted reading room and a blind copy room to the registrar\'s office, and a long dark way round through the stacks to its side door. The hostage rescue\'s level, built from the office kit. Regenerate: bun run tools/levels/export.ts registry';

/** The spaces: the floor inside each one's walls. The ONE place a room's rectangle is typed — the structure's bounds and the probes' walks both read it. */
export const REGISTRY_ROOMS: Record<'lobby' | 'gallery' | 'reading' | 'copy' | 'hall' | 'office' | 'stacks' | 'sorting', Rect> = {
  lobby: { x0: 4.12, x1: 9.94, z0: 4.12, z1: 23.88 },
  gallery: { x0: 10.06, x1: 23.94, z0: 10.06, z1: 12.74 },
  reading: { x0: 10.06, x1: 16.94, z0: 4.12, z1: 9.94 },
  copy: { x0: 17.06, x1: 23.94, z0: 4.12, z1: 9.94 },
  hall: { x0: 24.06, x1: 28.94, z0: 4.12, z1: 12.74 },
  office: { x0: 29.06, x1: 35.88, z0: 4.12, z1: 12.74 },
  stacks: { x0: 10.06, x1: 28.94, z0: 12.86, z1: 23.88 },
  sorting: { x0: 29.06, x1: 35.88, z0: 12.86, z1: 23.88 },
};
/** The stacks' shelving rows (x of each, and the z run it fills): alternately off the north wall and off the south, so the way through is a serpentine. */
export const REGISTRY_ROWS: { x: number; z0: number; z1: number }[] = [
  { x: 13.2, z0: 12.9, z1: 19.9 }, { x: 16.8, z0: 16.9, z1: 23.9 }, { x: 20.4, z0: 12.9, z1: 19.9 }, { x: 24.0, z0: 16.9, z1: 23.9 },
];

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest; picture only). The rescue starts the team 3 m INSIDE the
 *  front door, and from in there a picture looks out; from the forecourt the one thing that is this building's — the scribe's pitch, his table and typewriter
 *  under a faded umbrella — stands on the floor the men walk, south of the door and between Sam and the camera. So the way is a bespoke set: THE FRONT ITSELF,
 *  where it stands (the west wall on x 4, the same leaf on the same hinge, the lobby's red floor, its door mat and exit sign, a panel burning over the
 *  forms desk — both brought to the wedge of lobby the camera sees, behind the wall the stack stands on), with the pitch moved up the wall past the stack's last
 *  man, against the wall, without its umbrella (a canopy up there is cut by the frame), and the lobby panel lit. Boxes name their paint 'look|plain' (the first the file's palette holds), so the one block serves the look file too. No pane: the set has no glass. */
const REGISTRY_KITVIEW: KitViewData = {
  sets: { front: { ref: [1, 14.75],
    doors: [{ id: 'rg_front', hinge: [4, 14.32], closedDir: Math.PI / 2, width: 0.86, exterior: true }],
    boxes: [
    { id: 'rg_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'dust|asphalt' },
    { id: 'rg_wall_n', c: [4, 1.5, 9.15], h: [0.12, 1.5, 5.15], material: 'render|concrete' },
    { id: 'rg_wall_s', c: [4, 1.5, 19.6], h: [0.12, 1.5, 4.4], material: 'render|concrete' },
    { id: 'rg_lintel', c: [4, 2.525, 14.75], h: [0.12, 0.475, 0.45], material: 'render|concrete' },
    { id: 'rg_floor', c: [7, 0.002, 14], h: [3, 0.002, 10], material: 'stone', flags: ['Gloss'] },
    { id: 'rg_red', c: [7.03, 0.006, 14], h: [2.86, 0.0035, 9.83], albedo: [0.5, 0.15, 0.11], flags: ['NoShadow'] },
    { id: 'rg_mat', c: [4.36, 0.016, 14.7], h: [0.2, 0.0035, 0.55], albedo: [0.06, 0.06, 0.065], flags: ['NoShadow'] },
    { id: 'rg_back', c: [10, 1.5, 14], h: [0.06, 1.5, 10], material: 'wall' },
    { id: 'rg_ceiling', c: [7, 3.1, 14], h: [3.1, 0.1, 10.1], material: 'ceiling', flags: ['NoPrimary'] },
    { id: 'rg_panel', c: [5.3, 2.98, 12.5], h: [0.6, 0.02, 0.3], material: 'white', emissive: [11, 10.5, 9.5], flags: ['NoPrimary'] },
    { id: 'rg_exit', c: [4.14, 2.47, 14.7], h: [0.02, 0.12, 0.3], material: 'white', emissive: [0.3, 3.2, 0.6] },
    { id: 'rg_step', c: [3.6, 0.004, 14.75], h: [0.28, 0.003, 0.55], albedo: [0.62, 0.6, 0.55], flags: ['NoShadow'] },   // the worn step: paint, so the doorway's floor stays free
    // the forms lobby, behind the wall the stack stands on: the public's writing desk (a ridge down its middle, three stacks of forms a side — pink, lemon,
    // white) and the number dispenser on its post
    { id: 'rg_desk', group: 'rg.lobby', c: [5.2, 0.475, 12.3], h: [0.32, 0.475, 1.3], material: 'poplar|wood' },
    { id: 'rg_ridge', group: 'rg.lobby', c: [5.2, 1.0, 12.3], h: [0.03, 0.05, 1.3], material: 'woodDark' },
    { id: 'rg_forms_a', group: 'rg.lobby', c: [5.03, 0.98, 11.5], h: [0.11, 0.03, 0.24], albedo: [0.86, 0.58, 0.64], flags: ['NoShadow'] },
    { id: 'rg_forms_b', group: 'rg.lobby', c: [5.03, 0.985, 12.3], h: [0.11, 0.035, 0.24], albedo: [0.9, 0.82, 0.42], flags: ['NoShadow'] },
    { id: 'rg_forms_c', group: 'rg.lobby', c: [5.03, 0.975, 13.1], h: [0.11, 0.025, 0.24], albedo: [0.9, 0.89, 0.84], flags: ['NoShadow'] },
    { id: 'rg_forms_d', group: 'rg.lobby', c: [5.37, 0.985, 11.5], h: [0.11, 0.035, 0.24], albedo: [0.9, 0.89, 0.84], flags: ['NoShadow'] },
    { id: 'rg_forms_e', group: 'rg.lobby', c: [5.37, 0.975, 12.3], h: [0.11, 0.025, 0.24], albedo: [0.86, 0.58, 0.64], flags: ['NoShadow'] },
    { id: 'rg_forms_f', group: 'rg.lobby', c: [5.37, 0.98, 13.1], h: [0.11, 0.03, 0.24], albedo: [0.9, 0.82, 0.42], flags: ['NoShadow'] },
    { id: 'rg_post', group: 'rg.lobby', c: [4.5, 0.55, 13.75], h: [0.03, 0.55, 0.03], material: 'galv|metal' },
    { id: 'rg_tickets', group: 'rg.lobby', c: [4.5, 1.24, 13.75], h: [0.12, 0.14, 0.1], albedo: [0.75, 0.12, 0.1] },
    // the scribe's pitch, up the wall from the stack and against it: the folding table with the typewriter and his paper on it, and his stool (no umbrella:
    // the ground the camera sees beside the wall is under a metre wide up there, and a canopy is cut by the frame's edge)
    { id: 'rg_table', group: 'rg.pitch', c: [3.4, 0.68, 9.9], h: [0.25, 0.02, 0.4], material: 'poplar|wood' },
    { id: 'rg_leg_a', group: 'rg.pitch', c: [3.2, 0.33, 9.56], h: [0.025, 0.33, 0.025], material: 'galv|metal' },
    { id: 'rg_leg_b', group: 'rg.pitch', c: [3.6, 0.33, 9.56], h: [0.025, 0.33, 0.025], material: 'galv|metal' },
    { id: 'rg_leg_c', group: 'rg.pitch', c: [3.2, 0.33, 10.24], h: [0.025, 0.33, 0.025], material: 'galv|metal' },
    { id: 'rg_leg_d', group: 'rg.pitch', c: [3.6, 0.33, 10.24], h: [0.025, 0.33, 0.025], material: 'galv|metal' },
    { id: 'rg_typer', group: 'rg.pitch', c: [3.42, 0.745, 9.74], h: [0.15, 0.045, 0.17], material: 'asphalt' },
    { id: 'rg_carriage', group: 'rg.pitch', c: [3.52, 0.815, 9.74], h: [0.04, 0.025, 0.2], material: 'metal' },
    { id: 'rg_sheet', group: 'rg.pitch', c: [3.56, 0.9, 9.74], h: [0.02, 0.09, 0.105], albedo: [0.9, 0.89, 0.84], flags: ['NoShadow'] },
    { id: 'rg_paper', group: 'rg.pitch', c: [3.44, 0.72, 10.1], h: [0.105, 0.02, 0.15], albedo: [0.9, 0.89, 0.84], flags: ['NoShadow'] },
    { id: 'rg_form', group: 'rg.pitch', c: [3.25, 0.704, 10.12], h: [0.075, 0.004, 0.105], yaw: 0.3, albedo: [0.9, 0.82, 0.42], flags: ['NoShadow'] },
    { id: 'rg_stool', group: 'rg.pitch', c: [3.45, 0.42, 9.3], h: [0.16, 0.02, 0.16], material: 'woodDark' },
    { id: 'rg_stem', group: 'rg.pitch', c: [3.45, 0.2, 9.3], h: [0.025, 0.2, 0.025], material: 'black' },
  ],
    // the lobby's ceiling panel, lit: a set carries its own lamps, and without one the forms desk stands in the dark
    lights: [{ id: 'rg_lamp', kind: 'spot', pos: [5.3, 2.9, 12.5], dir: [0, -1, 0], color: [1, 0.95, 0.86], intensity: 30, range: 8, innerDeg: 60, outerDeg: 110,
      group: 'rg', enabled: true, volumetric: 0, radius: 0.15, mains: false, broad: true, fixture: 'rg_panel' }] } },
  ways: [{ door: 'rg_front', set: 'front', pane: false }] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = REGISTRY_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, rug, plant, bin, cabinet, papers, wallArt, bench, shelf, ceilingPanel, doorFrame, lights, switchables } = K;
  /** a table: a top on four legs (static — a mark may stand beside it, nobody pushes it) */
  function table(x: number, z: number, w: number, d: number, top: Vec3 = C.woodDark) {
    add({ c: [x, 0.72, z], h: [w / 2, 0.03, d / 2], albedo: top });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add({ c: [x + lx * (w / 2 - 0.08), 0.35, z + lz * (d / 2 - 0.08)], h: [0.04, 0.35, 0.04], albedo: C.metal });
  }
  /** a copier: a waist-high body with a darker lid (the office printer's two boxes, scaled) */
  function copier(x: number, z: number) {
    add({ c: [x, 0.5, z], h: [0.4, 0.5, 0.35], albedo: C.white }); add({ c: [x, 1.05, z], h: [0.34, 0.05, 0.3], albedo: [0.15, 0.15, 0.16] });
  }

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  slab(0, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });
  grp('floors');
  const polished = { flags: BoxFlag.Gloss };
  slab(4, -0.1, 4, 36, 0.001, 24, C.carpet);                    // whole interior base (thin top at y=0): the rooms keep it
  slab(4, 0, 4, 10, 0.004, 24, C.stone, polished);              // the lobby: stone, wall to wall
  slab(10, 0, 10, 24, 0.004, 12.8, C.lino, polished);           // the gallery
  slab(24, 0, 4, 29, 0.004, 12.8, C.lino, polished);            // the hall it ends in
  slab(10, 0, 12.8, 29, 0.004, 24, [0.2, 0.21, 0.24], { rough: 0.35 });   // the stacks: sealed grey (the server room's floor)

  grp('ceiling');
  slab(3.9, H, 3.9, 36.1, H + 0.2, 24.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // exterior walls (t = 0.24). Windows on the south and west walls only (the moon stands south-west), sills at 0.9 m; the north rooms have none.
  grp('walls.exterior');
  const ext = C.concrete;
  wallX(4, 3.88, 36.12, 0.24, ext);                                                                              // north: blind
  wallX(24, 3.88, 36.12, 0.24, ext, [
    { a: 5.4, b: 8.6, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' },                                           // the lobby
    { a: 18.0, b: 19.2, y0: 1.6, y1: 2.4, glass: 'whole' }, { a: 25.6, b: 27.6, y0: 1.6, y1: 2.4, glass: 'whole' },   // the stacks: high lights between the rows
    { a: 30.6, b: 33.6, y0: 0.9, y1: 2.4, mullions: 2, glass: 'whole' },                                         // the sorting room
  ]);
  // west x=4: the front door (z 14.1..15.3) the team came in by — midway between the gallery's mouth and the stacks' door — and the lobby's two windows
  wallZ(4, 4, 24, 0.24, ext, [{ a: 5.6, b: 9.6, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }, { a: 14.1, b: 15.3, y0: 0, y1: 2.2 }, { a: 17.4, b: 20.4, y0: 0.9, y1: 2.4, mullions: 2, glass: 'whole' }]);
  // east x=36: the sorting room's fire exit (z 20.0..21.2)
  wallZ(36, 4, 24, 0.24, ext, [{ a: 20.0, b: 21.2, y0: 0, y1: 2.2 }]);

  // ---------------- interior partitions (t = 0.12). ONE is glazed: the reading room's front on the gallery. Every other wall hides what is behind it. ----------------
  grp('walls.interior');
  const iw = C.wall;
  // lobby | the rest, x=10: the gallery's mouth open wall to wall (z 10.06..12.74), the stacks' west door (z 17.4..18.6)
  wallZ(10, 4.12, 23.88, 0.12, iw, [{ a: 10.06, b: 12.74, y0: 0, y1: 2.6 }, { a: 17.4, b: 18.6 }]);
  // the gallery's north wall z=10: the reading room's glass (x 10.7..14.3, sill 0.5 m) and door (x 14.8..16.0); the copy room's door (x 19.4..20.6) in a blind wall
  wallX(10, 10.06, 23.94, 0.12, iw, [{ a: 10.7, b: 14.3, y0: 0.5, y1: 2.5, mullions: 3, glass: 'whole', tint: C.glass }, { a: 14.8, b: 16.0 }, { a: 19.4, b: 20.6 }]);
  // reading | copy, x=17: solid
  wallZ(17, 4.12, 9.94, 0.12, iw);
  // copy | hall, x=24 north of the gallery: the copy room's second door (z 8.4..9.6), left standing open — across the hall from where a stack on the main
  // door stands, and not to be seen from the gallery. South of z 10 the gallery runs into the hall unbroken.
  wallZ(24, 4.12, 10.06, 0.12, iw, [{ a: 8.4, b: 9.6 }]);
  // the gallery's and the hall's south wall z=12.8 (the stacks behind it): the hall's door into the stacks (x 24.6..25.8, beside the gallery's mouth)
  wallX(12.8, 10.06, 28.94, 0.12, iw, [{ a: 24.6, b: 25.8 }]);
  // hall | registrar and stacks | sorting, x=29: the MAIN door (z 5.4..6.6, the hall's far end); the sorting room's door (z 15.6..16.8)
  wallZ(29, 4.12, 23.88, 0.12, iw, [{ a: 5.4, b: 6.6 }, { a: 15.6, b: 16.8 }]);
  // registrar | sorting, z=12.8: the SIDE door (x 32.0..33.2)
  wallX(12.8, 29.06, 35.88, 0.12, iw, [{ a: 32.0, b: 33.2 }]);

  // ---------------- the lobby (x 4..10): where the team forms up, inside the front door, midway between the two ways on: the gallery's lit mouth to the
  // north-east and the stacks' door to the south-east, under the one panel left burning in here ----------------
  grp('lobby');
  bench(4.7, 6.4, Math.PI / 2); bench(4.7, 8.4, Math.PI / 2);                                // waiting benches under the north window
  plant(4.7, 4.7); plant(9.4, 23.3);
  desk(7.0, 21.6, 2.2, 0.8, Math.PI); monitor(7.0, 21.7, Math.PI, false); chair(7.0, 22.5, 0); papers(7.6, 0.76, 21.6, 0.3);   // the enquiries desk at the south end
  cabinet(4.55, 22.2, Math.PI / 2); cabinet(4.55, 22.8, Math.PI / 2);
  wallArt(9.925, 1.6, 7.0, 1.8, 1.0, [0.2, 0.35, 0.3], false);                               // notice board on the partition north of the mouth
  wallArt(9.925, 1.6, 15.2, 1.4, 0.9, [0.3, 0.26, 0.2], false);
  rug(7.0, 14.7, 3.0, 2.0, [0.3, 0.2, 0.18]);
  ceilingPanel(7.0, 7.5, false, 'lobby'); ceilingPanel(8.6, 18.0, true, 'lobby', false, 1.2, 0.6, [4, 3.8, 3.4]);
  add({ c: [4.14, 2.47, 14.7], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the front door

  // ---------------- the gallery (z 10..12.8): bare, lit, 2.68 m wide. The fast line ----------------
  grp('gallery');
  ceilingPanel(13.0, 11.4, true, 'gallery', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(20.5, 11.4, true, 'gallery', false, 1.2, 0.3, [7, 6.8, 6.4]);
  rug(17, 11.4, 12.0, 0.9, [0.26, 0.27, 0.22]);                                              // the runner down its middle (a decal)
  wallArt(13.0, 1.6, 12.735, 1.4, 0.9, [0.22, 0.28, 0.36], true); wallArt(17.5, 1.6, 12.735, 1.4, 0.9, [0.36, 0.3, 0.2], true); wallArt(22.0, 1.6, 12.735, 1.4, 0.9, [0.2, 0.3, 0.26], true);

  // ---------------- the READING ROOM (x 10..17, z 4..10): glass on the gallery; a reading lamp's worth of light left on ----------------
  // What a look through the glass must answer is 'is a man in here': the table is low, the shelving is on the walls, the one tall thing stands in a corner.
  grp('reading');
  table(13.4, 7.2, 2.6, 1.1); chair(12.6, 6.3, 0); chair(14.2, 6.3, 0); chair(12.6, 8.1, Math.PI); chair(14.2, 8.1, Math.PI);
  papers(13.0, 0.76, 7.1, 0.4); papers(14.0, 0.76, 7.35, -0.2);
  shelf(11.6, 4.45, 2.6, 0.45, 0, 4, 1.9); shelf(14.6, 4.45, 2.6, 0.45, 0, 4, 1.9);          // reference shelving on the north wall
  cabinet(16.5, 4.5, 0); bin(16.5, 9.4);
  ceilingPanel(13.4, 7.0, true, 'reading', false, 1.2, 0.6, [5, 4.8, 4.3]);

  // ---------------- the COPY ROOM (x 17..24, z 4..10): blind, dark, two doors — 'copy' on the gallery, 'copy_hall' on the hall (open, its leaf swung in
  // against the room). Its south-east corner (between the two doors) is bare: the roamer's mark is there, on the line through the open door ----------------
  grp('copy');
  copier(18.6, 4.6); copier(19.8, 4.6);                                                       // two copiers on the north wall
  add({ c: [22.4, 0.45, 4.5], h: [1.2, 0.45, 0.35], albedo: C.white, ...mk(MD.cupboardMarks([1.2, 0.45, 0.35], '+z', 3, TX)) }); add({ c: [22.4, 0.92, 4.5], h: [1.25, 0.03, 0.38], albedo: [0.2, 0.2, 0.22] });   // a counter, north-east
  table(20.2, 7.4, 1.6, 0.9, C.white); papers(20.0, 0.76, 7.3, 0.1);                          // the collating table in the middle of the floor
  cardboardBox(17.6, 9.3, 0.5, 0.2); cardboardBox(17.65, 8.6, 0.45, 0.6);                     // paper stock in the south-west corner
  shelf(17.42, 6.4, 1.8, 0.45, Math.PI / 2, 4, 1.9);
  ceilingPanel(20.4, 7.0, false, 'copy');

  // ---------------- the HALL (x 24..29, z 4..12.8): the gallery's end. The MAIN door is at the far end of its east wall, the registry counter across the
  // north end with a panel over it (a man behind it is lit: seen as soon as he sees). The walls beside every door are bare ----------------
  grp('hall');
  add({ c: [26.2, 0.5, 5.5], h: [1.3, 0.5, 0.3], albedo: C.woodDark, ...mk(MD.cupboardMarks([1.3, 0.5, 0.3], '+z', 3, TX)) }); add({ c: [26.2, 1.03, 5.5], h: [1.36, 0.03, 0.36], albedo: C.white });   // the registry counter across the north end (1.06 m: a man behind it shows head and shoulders); its east end is the way round it
  cabinet(24.5, 4.5, 0);
  bench(27.4, 12.42, 0);                                                                      // one bench on the south wall, east of the stacks' door
  wallArt(28.935, 1.6, 10.6, 1.2, 0.8, [0.3, 0.26, 0.2], false);
  ceilingPanel(26.2, 5.6, true, 'hall', false, 1.2, 0.6, [7, 6.8, 6.4]); ceilingPanel(26.5, 10.4, false, 'hall');
  add({ c: [28.9, 2.47, 6.0], h: [0.02, 0.1, 0.34], albedo: C.white, emissive: [0.9, 0.85, 0.7] });   // the lit plate over the registrar's door

  // ---------------- the REGISTRAR'S OFFICE (x 29..36, z 4..12.8): the hold room. Main door west (z 5.4..6.6), side door south (x 32..33.2) ----------------
  grp('office');
  desk(33.6, 6.6, 2.0, 0.9, 0); monitor(33.6, 6.5, 0, true); chair(33.6, 5.7, 0); papers(34.2, 0.76, 6.7, 0.3);   // the registrar's desk, facing the south wall
  cabinet(35.45, 9.6, -Math.PI / 2); cabinet(35.45, 10.2, -Math.PI / 2); cabinet(35.45, 10.8, -Math.PI / 2);     // filing on the east wall
  add({ c: [30.5, 0.22, 12.3], h: [1.0, 0.22, 0.42], albedo: [0.3, 0.12, 0.1] }); add({ c: [30.5, 0.6, 12.63], h: [1.0, 0.35, 0.1], albedo: [0.3, 0.12, 0.1] });   // a couch on the south wall, west of the side door
  bin(35.3, 12.2);
  wallArt(32.6, 1.7, 4.135, 1.6, 0.9, [0.24, 0.3, 0.38], true);
  ceilingPanel(32.5, 8.4, true, 'office', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- the STACKS (x 10..29, z 12.8..24): four rows of 2 m shelving, alternately off the north and south walls. The safe line ----------------
  // Solid units (the cupboard's box, 1 m a bay, doors marked on both faces): nothing sees through a row, a man walks round its open end.
  grp('stacks');
  for (const row of REGISTRY_ROWS) for (let z = row.z0 + 0.5; z < row.z1; z += 1)
    add({ c: [row.x, 1.0, z], h: [0.3, 1.0, 0.49], albedo: [0.33, 0.36, 0.38], rough: 0.5, ...mk([...MD.cupboardMarks([0.3, 1.0, 0.49], '+x', 2, TX), ...MD.cupboardMarks([0.3, 1.0, 0.49], '-x', 2, TX)]) });
  cardboardBox(10.6, 23.3, 0.55, 0.2); cardboardBox(10.65, 13.5, 0.5, 0.5); cardboardBox(28.4, 23.3, 0.55, -0.3);
  add({ c: [22.2, 0.45, 23.4], h: [0.5, 0.45, 0.3], albedo: C.metal });                       // a library step-trolley parked on the south wall
  ceilingPanel(11.6, 18.0, false, 'stacks'); ceilingPanel(18.6, 18.0, false, 'stacks'); ceilingPanel(26.5, 18.0, false, 'stacks');

  // ---------------- the SORTING ROOM (x 29..36, z 12.8..24): the side door's room. Its north end (in front of the side door) is bare ----------------
  grp('sorting');
  table(32.6, 19.6, 2.4, 1.2, C.white); papers(32.2, 0.76, 19.5, 0.3); papers(33.0, 0.76, 19.8, -0.4);
  cardboardBox(35.3, 23.2, 0.6, 0.2); cardboardBox(35.35, 23.25, 0.45, 0.7, 0.6); cardboardBox(34.4, 23.3, 0.5, -0.2);
  shelf(31.4, 23.5, 2.6, 0.5, 0, 4, 2.0);
  cabinet(35.45, 15.6, -Math.PI / 2); cabinet(35.45, 16.2, -Math.PI / 2);
  // mains breaker panel on the east wall, north end (OCP it for a temporary blackout, shoot it for a permanent one)
  const brk = add({ c: [35.84, 1.35, 14.2], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [35.79, 1.62, 14.02], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [35.84, 2.3, 14.2], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });
  ceilingPanel(32.5, 18.0, false, 'sorting');
  add({ c: [35.86, 2.47, 20.6], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the fire exit

  // ---------------- exterior: the moon, the only light outdoors ----------------
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---------------- emergency beacons (dark until the blackout): the gallery, the hall, the stacks ----------------
  grp('beacons');
  const beacons: { pos: Vec3; box: number }[] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(17, 11.4); beacon(26.5, 7.6); beacon(18.6, 20.6);

  // ---------------- doors (closedDir 0: the leaf runs +x from the hinge, in a wall along x; π/2: +z, in a wall along z) ----------------
  const doors: LevelDoorDef[] = [
    { name: 'reading', hinge: [14.82, 10.0], closedDir: 0, width: 1.16, swing: 1 },   // the room's one door opens out into the gallery, like 'copy': a roamer posted in here cannot wedge it
    { name: 'copy', hinge: [19.42, 10.0], closedDir: 0, width: 1.16, swing: 1 },   // opens out into the gallery: no wedge inside the room holds it (tools/qa/second-way-check.ts)
    { name: 'copy_hall', hinge: [24.0, 8.42], closedDir: Math.PI / 2, width: 1.16, angle: 1.3, closer: false },    // left standing open, into the copy room: whoever is in there sees the main door through it
    { name: 'office', hinge: [29.0, 5.42], closedDir: Math.PI / 2, width: 1.16, locked: true },                    // (keyed from the hall, as the office's manager's door is from its corridor)
    { name: 'office_side', hinge: [32.02, 12.8], closedDir: 0, width: 1.16 },
    // THE LONG WAY IS LOCKED, each door keyed from the side the team comes to it by: a pick is 4.2 s and quiet, a boot is a second and the floor hears it. (The
    // teammates carry keys like any unit, so a lock stops Sam, not them — the price is his.) The hall's door into the stacks is keyed from the HALL: no short cut
    // to the side door from the gallery, but it opens from the stacks.
    { name: 'stacks_w', hinge: [10.0, 17.42], closedDir: Math.PI / 2, width: 1.16, locked: true },
    { name: 'stacks_hall', hinge: [24.62, 12.8], closedDir: 0, width: 1.16, locked: true, keySide: -1 },
    { name: 'sorting', hinge: [29.0, 15.62], closedDir: Math.PI / 2, width: 1.16, locked: true },
    { name: 'front', hinge: [4.0, 14.12], closedDir: Math.PI / 2, width: 1.16, exterior: true },
    { name: 'fire_exit', hinge: [36.0, 20.02], closedDir: Math.PI / 2, width: 1.16, exterior: true },
  ];
  for (const d of doors) doorFrame(d);

  // ---------------- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<thing>'; LAST, after every kept thing) ----------------
  // A provincial records office, and its things are the clerk's: open folios, pigeonholes, taped bundles, sacks. Each room by what only it has — the lobby is the
  // PUBLIC's (a writing desk island with trays of pink, yellow and white forms), the reading room the READERS' (green-shaded lamps down the table, a card catalogue
  // with its drawers pulled), the copy room MACHINES (a sorter's comb, a guillotine, white reams banded blue, toner on the floor), the hall the COUNTER's three worn
  // positions, the registrar's office OXBLOOD and brass (a vitrine with the founding register, a samovar), the stacks their ROW TOPS (one colour of bundle a row),
  // the sorting room a GRID of cells and canvas sacks. The gallery stays bare but for what was dropped in it. Nothing stands on a line the look paints
  // (registry-gwot.ts: red z 10.4 / 12.42 / x 24.9 / 28.3 / 8.6, the wait line z 6.85, the blue serpentine, the row numbers); everything is 1.05 m or lower but
  // the bundles on the rows' own tops; nothing lies on a surface the dressing deals on (tools/levels/dress.ts) but in the gaps between its things, unyawed.
  { const P = livedPieces({ add, grp, prop: K.prop }, C as unknown as Parameters<typeof livedPieces>[1]), W = Math.PI / 2, E = -Math.PI / 2, S = Math.PI, drawn = { flags: BoxFlag.NoShadow };
    const PINK: Vec3 = [0.86, 0.58, 0.64], LEMON: Vec3 = [0.9, 0.82, 0.42], GREEN: Vec3 = [0.06, 0.4, 0.2], TONER: Vec3 = [0.03, 0.03, 0.035], ROW_TOPS: Vec3[] = [INK.manila, INK.cream, [0.3, 0.3, 0.46], [0.09, 0.09, 0.1]];
    // lobby — the FORMS LOBBY: the public's writing desk as an island north of the gallery's mouth (a ridge down its middle, three trays of forms a side),
    // the number dispenser on its post, a wet-umbrella mat inside the front door; 'closed' and the fee tin on the enquiries desk
    P.room('lobby');
    P.floor(7.03, 14.0, 5.72, 19.66, [0.5, 0.15, 0.11], 0.003, 0.006);
    { const L = P.counter(7.0, 8.6, 2.6, 0.8, 0, 0.95, C.woodDark, C.woodDark); L.box(0, 0.95, 0, 2.6, 0.1, 0.06, C.woodDark);
      [PINK, LEMON, C.white].forEach((c, i) => { for (const s of [-1, 1]) { const lx = s * (i - 1) * 0.74; L.box(lx, 0.95, s * 0.22, 0.5, 0.03, 0.3, C.metal); L.box(lx, 0.98, s * 0.22, 0.44, 0.02 + 0.012 * ((i + (s > 0 ? 1 : 0)) % 3), 0.26, c); } });
      L.box(-1.16, 0.95, 0.22, 0.12, 0.025, 0.1, INK.navy);                                                                   // the ink pad
      L.box(1.72, 0, 0, 0.56, 1.0, 0.56, C.red); L.box(1.72, 1.0, 0, 0.62, 0.05, 0.62, LEMON); }   // take a number
    { const L = P.at(7.0, 18.6, 0); L.box(0, 0, 0, 0.96, 0.44, 3.2, C.wood); L.box(0, 0.44, 0, 0.08, 0.4, 3.2, C.woodDark); }   // the waiting bench, back to back down the middle of the floor
    P.floor(4.36, 14.7, 0.4, 1.1, INK.rubber);
    P.loose('umbrellas', 'cardboard', 4.5, 16.6, 0.2, 5, [P.part(0, 0, 0, 0.3, 0.5, 0.3, C.metal), P.part(-0.06, 0.1, -0.05, 0.05, 0.8, 0.05, INK.navy, 0.3), P.part(0.07, 0.1, 0.04, 0.05, 0.75, 0.05, C.black, 0.5), P.part(0, 0.1, 0.08, 0.05, 0.85, 0.05, INK.oxblood)], [0.16, 0.16]);
    P.loose('chair', 'chair', 8.9, 20.7, -2.2, 9, [P.part(0, 0.42, 0, 0.44, 0.05, 0.44, C.chair), P.part(0, 0.47, 0.2, 0.44, 0.45, 0.05, C.chair), P.part(0, 0, 0, 0.4, 0.42, 0.06, C.black), P.part(0, 0, 0, 0.06, 0.42, 0.4, C.black)]);
    // gallery — bare, and it stays bare: ONE incident on the runner by the copy room's wall, a file that burst as somebody ran (five sheets, its buff cover, a shoe).
    // All of it drawn only: nothing to trip the fast line
    P.room('gallery');
    P.floor(17, 11.4, 12.04, 0.94, [0.5, 0.36, 0.1], 0.001, 0.0225);
    { const L = P.at(22.0, 11.4, 0.5);
      ([[-0.3, -0.3, 0.2], [0.1, -0.1, -0.5], [0.35, 0.28, 0.9], [-0.15, 0.4, 1.4], [0.55, -0.36, -0.2]] as const).forEach(([lx, lz, a], i) => L.sheet(lx, 0.03 + i * 0.002, lz, 0.21, 0.3, P.tone(INK.paper, 0.94 + 0.06 * h01(i, 7)), a));
      L.sheet(-0.62, 0.03, 0.08, 0.5, 0.36, INK.manila, 0.3); L.box(1.1, 0, 0.42, 0.1, 0.08, 0.27, C.black, 0.8, drawn); L.box(0.75, 0, -0.3, 0.34, 0.2, 0.16, LEMON, -0.5, drawn); }
    // reading room — the READERS': a pale green drugget under the table (pale: the room is read through its glass), four green-shaded lamps in a row down the
    // table with registers open under them, the card catalogue on the east wall with two drawers pulled out, the atlas open on its lectern on the west wall
    P.room('reading');
    P.floor(13.4, 7.2, 4.4, 3.0, [0.5, 0.62, 0.5]);
    for (let i = 0; i < 4; i++) { const L = P.at(12.3 + i * 0.733, 6.88, 0); L.box(0, 0.75, 0, 0.1, 0.02, 0.1, INK.brass); L.box(0, 0.77, 0, 0.025, 0.2, 0.025, INK.brass); L.box(0, 0.97, 0, 0.42, 0.07, 0.15, GREEN); }
    P.ledger(13.2, 0.75, 7.53, S, true, INK.navy); P.ledger(14.4, 0.75, 7.53, S, true, INK.navy);
    { const L = P.at(13.8, 7.62, 0.5); L.box(0, 0.75, 0, 0.09, 0.012, 0.09, INK.brass); L.box(0.1, 0.75, 0, 0.12, 0.012, 0.025, C.woodDark);            // the magnifier
      for (let i = 0; i < 2; i++) add({ c: [12.18 + i * 0.13, 0.755, 7.58 + (i % 2) * 0.08], h: [0.05, 0.004, 0.035], albedo: i === 1 ? LEMON : INK.paper, flags: BoxFlag.NoShadow }); }   // call slips
    { const L = P.counter(16.66, 7.0, 1.2, 0.5, E, 1.05, C.wood, C.woodDark);                                                                     // the card catalogue
      for (let i = 0; i < 3; i++) L.box(-0.36 + i * 0.36, 1.05, 0, 0.07, 0.006, 0.4, INK.cream);
      L.box(-0.3, 0.6, 0.46, 0.15, 0.1, 0.44, C.wood); L.box(-0.3, 0.7, 0.46, 0.11, 0.012, 0.4, INK.cream); L.box(0.24, 0.8, 0.41, 0.15, 0.1, 0.34, C.wood); L.box(0.24, 0.9, 0.41, 0.11, 0.012, 0.3, INK.paper); }
    { const L = P.counter(10.38, 7.6, 0.9, 0.5, W, 1.0, C.woodDark, C.wood); L.box(0, 1.0, 0, 0.8, 0.02, 0.44, INK.navy);                           // the atlas
      L.box(-0.19, 1.02, 0, 0.36, 0.015, 0.4, INK.cream); L.box(0.19, 1.02, 0, 0.36, 0.015, 0.4, INK.paper); L.box(0.2, 1.035, -0.03, 0.24, 0.004, 0.18, [0.4, 0.55, 0.7]); }
    P.trolley(10.42, 8.95, W, [INK.navy, INK.baize, INK.manila, INK.navy, INK.oxblood]); P.stool(16.0, 5.3);
    // copy room — the DUPLICATING ROOM: machines and blue. A blue anti-static floor wall to wall, toner spilt before the copiers, the sorter's comb of bins
    // east of the second copier, white reams banded blue on a pallet in the north-west corner, the guillotine and stepped collating piles on the table, the
    // screw press on the counter. The south-east corner (the roamer's mark, the line through the open door) stays bare
    P.room('copy');
    P.floor(20.5, 7.03, 6.7, 5.66, [0.15, 0.21, 0.34], 0.014, 0.006);
    P.floor(19.25, 5.45, 1.0, 0.5, TONER, 0.3, 0.01); P.floor(19.65, 5.8, 0.5, 0.45, TONER, -0.5, 0.012);
    
    { const L = P.at(20.62, 4.6, 0); L.box(-0.2, 0, -0.1, 0.05, 1.0, 0.5, C.metal);
      for (let i = 0; i < 7; i++) { const d = 0.66 - i * 0.07; L.box(0.02, 0.14 + i * 0.125, -0.35 + d / 2, 0.34, 0.012, d, i % 2 ? C.white : C.metal); } }
    { const L = P.at(17.62, 4.72, 0); L.box(0, 0, 0, 0.96, 0.1, 0.7, C.wood);
      for (let i = 0; i < 6; i++) { const lx = (i % 3 - 1) * 0.3, lz = (i < 3 ? -0.5 : 0.5) * 0.32, h = i === 1 || i === 5 ? 0.4 : 0.2; L.box(lx, 0.1, lz, 0.27, h, 0.28, C.white); if (i % 2 === 0 || i === 5) L.box(lx, 0.1 + h, lz, 0.07, 0.004, 0.285, INK.blueprint); } }
    { const L = P.at(19.62, 7.58, 0); L.box(0, 0.75, 0, 0.36, 0.03, 0.34, INK.baize); L.box(0, 0.78, -0.1, 0.36, 0.004, 0.012, INK.cream);   // the guillotine
      L.box(0.02, 0.784, 0, 0.5, 0.03, 0.035, C.metal, 0.75); L.box(0.2, 0.8, -0.19, 0.07, 0.04, 0.07, C.black); }
    for (let i = 0; i < 5; i++) add({ c: [20.08 + i * 0.19, 0.75 + (0.015 + 0.016 * i) / 2, 7.72], h: [0.07, (0.015 + 0.016 * i) / 2, 0.07], albedo: i === 1 || i === 3 ? INK.blueprint : C.white });   // collating piles, stepped
    add({ c: [20.85, 0.755, 7.15], h: [0.105, 0.005, 0.15], albedo: INK.blueprint, flags: BoxFlag.NoShadow });
    for (const x of [18.6, 19.8]) { add({ c: [x, 1.115, 4.45], h: [0.34, 0.015, 0.15], albedo: INK.blueprint }); add({ c: [x + 0.05, 1.103, 4.74], h: [0.105, 0.003, 0.15], albedo: C.white, flags: BoxFlag.NoShadow }); }   // lids half up, a sheet on each glass
    P.loose('waste', 'cardboard', 17.45, 7.82, 0.4, 3, [P.part(0, 0, 0, 0.4, 0.45, 0.4, C.black), P.part(0.03, 0.45, -0.02, 0.28, 0.06, 0.24, INK.paper, 0.5), P.part(-0.07, 0.5, 0.05, 0.18, 0.05, 0.2, C.white, -0.4)], [0.2, 0.2]);
    // hall — the REGISTRY COUNTER: its three positions (two low dividers, a stamp tree each, the day ledger at the east one — all in the gaps between the
    // dressing's papers), a coir strip before it worn pale where three people stand, the form shelf on the west wall, the clerk's stool
    P.room('hall');
    P.floor(26.5, 8.43, 4.78, 8.52, [0.15, 0.3, 0.32], 0.003, 0.006);
    P.floor(26.2, 6.17, 2.7, 0.56, [0.34, 0.25, 0.15], 0.014, 0.0145);                 // (over the look's tiles, whose tops are at 0.0138)
    for (const x of [25.3, 26.2, 27.1]) { P.floor(x, 6.17, 0.52, 0.3, [0.72, 0.64, 0.48], 0.12, 0.0165); P.floor(x + 0.02, 6.2, 0.3, 0.44, [0.72, 0.64, 0.48], 0.5, 0.017); }
    for (const x of [25.46, 26.45]) add({ c: [x, 1.16, 5.5], h: [0.02, 0.1, 0.33], albedo: C.woodDark });
    for (const [x, z] of [[24.95, 5.66], [26.98, 5.26]]) { add({ c: [x, 1.07, z], h: [0.05, 0.01, 0.05], albedo: INK.iron }); add({ c: [x, 1.12, z], h: [0.012, 0.04, 0.012], albedo: INK.iron }); add({ c: [x, 1.17, z], h: [0.055, 0.012, 0.055], albedo: C.woodDark }); }
    add({ c: [25.93, 1.0725, 5.74], h: [0.05, 0.0125, 0.05], albedo: INK.navy });                                              // (the middle position's is an ink pad: the counter man's aim line crosses here)
    add({ c: [27.42, 1.08, 5.4], h: [0.11, 0.02, 0.16], albedo: INK.navy }); add({ c: [27.42, 1.103, 5.36], h: [0.07, 0.003, 0.03], albedo: INK.cream });
    { const L = P.counter(24.23, 6.8, 0.84, 0.28, W, 1.05, C.woodDark, C.wood); [INK.manila, INK.paper, INK.cream, INK.manila].forEach((c, i) => L.box(-0.3 + i * 0.2, 1.05, 0, 0.16, 0.02 + 0.01 * (i % 2), 0.2, c)); }
    P.stool(27.3, 4.7);
    P.floor(26.2, 9.8, 0.1, 4.0, LEMON, 0.014, 0.0145);   // the queue's line down the floor (the look stencils its own 'wait here' across its head)
    // registrar's office — OXBLOOD AND BRASS, all low: carpet wall to wall, the vitrine on the east wall with the founding register open under its glass, two
    // armchairs before the desk, the samovar on its table by the north wall; on the desk the blotter, the seal press, wax, ribbon-tied deeds, two telephones.
    // What happened here: a blanket and water bottles between the hostages, a chair on its side
    P.room('office');
    P.floor(32.47, 8.43, 6.6, 8.4, [0.27, 0.09, 0.08], 0.014, 0.006);
    { const L = P.counter(35.43, 8.65, 1.2, 0.8, E, 0.9, C.woodDark, C.woodDark); L.box(0, 0.9, 0, 1.08, 0.004, 0.66, INK.baize);   // (a metre south of the desk's corner: the way out of the hostages' corner)
      L.box(0, 0.904, 0, 0.86, 0.02, 0.6, INK.brass); L.box(-0.19, 0.924, 0, 0.36, 0.012, 0.5, INK.cream); L.box(0.19, 0.924, 0, 0.36, 0.01, 0.5, INK.paper);
 }
    { const L = P.table(31.0, 4.5, 0.7, 0.5, 0, C.woodDark, C.woodDark, 0.6); L.box(0, 0.6, 0, 0.56, 0.015, 0.38, INK.brass);                     // the samovar
      for (const a of [0, Math.PI / 4]) L.box(-0.08, 0.615, 0, 0.2, 0.3, 0.2, INK.brass, a); L.box(-0.08, 0.915, 0, 0.08, 0.07, 0.08, INK.copper); L.box(0.18, 0.615, 0.02, 0.1, 0.07, 0.1, C.white); }
    { const L = P.at(31.4, 10.6, 0.6); L.box(0, 0, 0, 0.44, 0.44, 0.06, C.chair); L.box(0, 0, 0.25, 0.44, 0.05, 0.45, C.chair); for (const s of [-1, 1]) L.box(s * 0.18, 0.27, -0.2, 0.04, 0.04, 0.36, C.black); }   // a chair on its side
    P.floor(33.75, 4.72, 1.2, 0.8, [0.3, 0.33, 0.48], 0.2, 0.012);
    for (const [x, z] of [[33.5, 4.45], [34.0, 4.4]]) add({ c: [x, 0.11, z], h: [0.035, 0.11, 0.035], albedo: INK.bottle, flags: BoxFlag.NoShadow });
    add({ c: [33.6, 0.765, 6.3], h: [0.25, 0.005, 0.13], albedo: INK.baize, flags: BoxFlag.NoShadow });                                              // the blotter
    { const L = P.at(34.35, 6.32, 0); L.box(0, 0.76, 0, 0.14, 0.04, 0.14, INK.iron); L.box(0, 0.8, 0, 0.07, 0.1, 0.07, INK.iron); for (const a of [-1, 1]) L.box(0, 0.9, 0, 0.34, 0.015, 0.05, INK.brass, a * Math.PI / 4); L.box(-0.24, 0.76, 0, 0.03, 0.03, 0.1, C.red); }   // the seal press, a stick of wax
    for (const z of [6.88]) { add({ c: [32.9, 0.79, z], h: [0.15, 0.03, 0.05], albedo: INK.cream }); add({ c: [32.9 + (z - 6.9), 0.791, z], h: [0.02, 0.032, 0.052], albedo: C.red }); }   // deeds tied in ribbon
    P.phone(33.35, 0.76, 6.92, S); P.phone(34.48, 0.76, 6.95, S, INK.oxblood);
    P.armchair(32.9, 8.0, 0, INK.cream); P.armchair(33.7, 8.05, 0.12, INK.cream);                                         // (a man's width left between them and the vitrine: the hostages' way south)
    // stacks — THE ROW TOPS: taped bundles lying on every row's top, one colour a row (1 buff, 2 cream under red tape, 3 slate, 4 black: you know your aisle from
    // above), and one incident an aisle: a ladder laid down along row 2's east face, files fanned out of row 3's west face, a bucket under a leak by the south window,
    // the clerk's carrel on the south wall; two trolleys parked tight against rows, off the blue line
    P.room('stacks');
    P.floor(19.5, 18.37, 18.66, 10.9, [0.13, 0.13, 0.14], 0.002, 0.006);
    REGISTRY_ROWS.forEach((row, r) => { for (let i = 0; i < 5; i++) { const z = row.z0 + 0.9 + i * 1.3 + (h01(i, r) - 0.5) * 0.2, x = row.x + (h01(i, r + 4) - 0.5) * 0.06, hz = 0.44 + 0.1 * h01(i, r + 9);
      add({ c: [x, 2.06, z], h: [0.25, 0.06, hz], albedo: ROW_TOPS[r] }); if (r === 1) add({ c: [x, 2.123, z], h: [0.253, 0.003, 0.05], albedo: C.red }); } });
    P.ladder(17.46, 0, 20.5, W, 2.4);                                                                       // the ladder, laid down along the row's foot (boxes do not lean)
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.42, r = 0.4 + 0.14 * (i % 3); P.floor(20.08 - r * Math.cos(a), 16.5 + r * Math.sin(a), 0.34, 0.24, [INK.manila, INK.paper, ROW_TOPS[2]][i % 3], a, 0.006 + i * 0.002); }
    P.floor(26.8, 21.5, 1.1, 0.8, [0.075, 0.08, 0.1], 0.5, 0.0095); P.floor(27.15, 21.15, 0.6, 0.5, [0.075, 0.08, 0.1], -0.4, 0.0125); P.bucket(26.8, 21.5);
    { const L = P.table(26.6, 23.5, 1.0, 0.6, S, C.wood, C.woodDark); for (const s of [-1, 1]) L.box(s * 0.53, 0, 0, 0.03, 1.05, 0.68, C.woodDark); L.box(0, 0.74, -0.32, 1.06, 0.31, 0.03, C.woodDark); }   // the carrel
    P.ledger(26.6, 0.74, 23.48, S, false, TONER); P.stool(26.6, 22.85);
    P.trolley(13.78, 15.5, W, [INK.manila, INK.manila, INK.cream, INK.manila]); P.trolley(23.43, 20.5, W, [C.black, INK.iron, C.black, INK.iron]);
    // sorting room — THE GRID AND THE SACKS: a hessian-brown floor, the open-top sorting frame on the west wall (two rows of eight cells, each filled to its own
    // height), three canvas sacks hanging open on their frame by the south shelf, the platform scale with a parcel on it; red and blue wire trays (the two lines'
    // colours) and tied bundles on the table, brown-paper offcuts under it. The north end, before the side door, stays bare
    P.room('sorting');
    P.floor(32.47, 18.37, 6.6, 10.9, [0.3, 0.25, 0.17], 0.014, 0.006);
    for (const [x, z, w, d, a] of [[31.5, 20.9, 0.7, 0.3, 0.4], [34.2, 19.2, 0.6, 0.25, 1.2]]) P.floor(x, z, w, d, [0.52, 0.4, 0.25], a, 0.012);
    { const L = P.at(29.38, 19.2, W); L.box(0, 0, 0, 2.4, 0.8, 0.6, C.woodDark); for (const s of [-1, 1]) { L.box(0, 0.8, s * 0.285, 2.4, 0.25, 0.03, C.wood); L.box(s * 1.185, 0.8, 0, 0.03, 0.25, 0.54, C.wood); }
      for (let i = 0; i < 16; i++) if (i !== 3 && i !== 5 && i !== 10 && i !== 12 && i !== 15) L.box(-1.03 + (i >> 1) * 0.295, 0.8, ((i & 1) - 0.5) * 0.27, 0.235, 0.04 + 0.18 * h01(i, 5), 0.2, [INK.paper, INK.cream, INK.manila, C.white, LEMON][Math.floor(h01(i, 6) * 5)]); }
    { const L = P.at(33.38, 23.45, S); for (const s of [-1, 1]) L.box(0, 0.85, s * 0.2, 1.3, 0.04, 0.04, C.metal);
      for (let i = 0; i < 3; i++) { L.box((i - 1) * 0.42, 0, 0, 0.38, 0.8, 0.36, INK.canvas); L.box((i - 1) * 0.42, 0.8, 0, 0.27, 0.006, 0.25, i === 1 ? INK.paper : P.tone(INK.canvas, 0.35)); } }
    { const L = P.at(29.5, 21.5, W); L.box(0, 0, 0.05, 0.6, 0.08, 0.5, C.metal); L.box(0, 0, -0.25, 0.06, 0.95, 0.06, C.metal); L.box(0, 0.95, -0.22, 0.26, 0.1, 0.12, C.white);   // the platform scale
      L.box(0.05, 0.08, 0.08, 0.34, 0.22, 0.26, C.cardboard, 0.3); }
    for (const [x, z, c] of [[32.55, 19.3, C.red], [33.45, 19.45, GREEN], [31.65, 20.02, C.red]] as [number, number, Vec3][]) { add({ c: [x, 0.775, z], h: [0.2, 0.025, 0.17], albedo: c }); add({ c: [x, 0.804, z], h: [0.15, 0.004, 0.13], albedo: INK.paper }); }
    for (let i = 0; i < 2; i++) { add({ c: [33.27 + i * 0.22, 0.79, 20.02], h: [0.08, 0.04, 0.12], albedo: INK.manila }); add({ c: [33.27 + i * 0.22, 0.79, 20.02], h: [0.082, 0.042, 0.012], albedo: C.woodDark }); }
    add({ c: [33.62, 0.8, 19.12], h: [0.05, 0.05, 0.05], yaw: 0.6, albedo: [0.6, 0.5, 0.3] });                         // a ball of twine
    P.loose('barrow', 'cardboard', 35.2, 18.0, E, 14, [P.part(0, 0, 0.1, 0.5, 0.05, 0.4, C.metal), P.part(-0.22, 0, -0.1, 0.04, 1.05, 0.04, C.metal), P.part(0.22, 0, -0.1, 0.04, 1.05, 0.04, C.metal), P.part(0, 0.9, -0.1, 0.5, 0.04, 0.04, C.metal), P.part(0, 0.05, 0.08, 0.4, 0.6, 0.3, INK.canvas)], [0.28, 0.25]);
    for (const [x, z, a] of [[34.2, 22.45, 0.3], [34.95, 22.6, -0.5]]) P.loose('sack', 'cardboard', x, z, a, 8, [P.part(0, 0, 0, 0.8, 0.3, 0.52, INK.canvas), P.part(-0.04, 0.3, 0, 0.52, 0.1, 0.36, P.tone(INK.canvas, 1.08)), P.part(0.44, 0.06, 0, 0.1, 0.12, 0.12, P.tone(INK.canvas, 0.8))]);
    // forecourt — THE SCRIBE'S PITCH south of the front door: a petition writer's folding table and typewriter under a faded umbrella (drawn only: it roofs
    // nothing), his stool
    P.room('forecourt');
    P.table(2.6, 16.4, 0.8, 0.5, 0.1, C.wood, C.metal, 0.7); P.typewriter(2.6, 0.7, 16.4, E);
    add({ c: [2.1, 1.0, 17.6], h: [0.02, 1.0, 0.02], albedo: C.metal }); for (const [a, c, r] of [[0.1, [0.6, 0.16, 0.12], 0.75], [0.1 + Math.PI / 4, INK.cream, 0.42]] as [number, Vec3, number][]) add({ c: [2.1, a < 0.5 ? 2.0 : 2.03, 17.6], h: [r, 0.015, r], yaw: a, albedo: c, flags: BoxFlag.NoShadow });
    P.stool(2.8, 17.15);
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [35.7, 1.35, 14.2], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [7.0, 0, 14.7],
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the rescue brings its own cast
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the rescue stands the mission still): the registrar's office, a point on its
    // east wall's filing, the fire exit
    mission: { serverRoom: { ...R.office }, entryDoor: 'office', rack: { index: 0, front: [34.9, 1.0, 10.2], halfW: 0.3 }, exfilDoor: 'fire_exit', exfilX: 36.5, exfilZ: 20.6 },
  };

  // ---------------- what the hostage rescue takes from this level ----------------
  const MAIN: Vec3 = [29.1, 1.1, 6.0];     // the point on the registrar's main door the men inside keep their guns on
  const scenarios: LevelScenarios = {
    rescue: {
      team: { sam: [7.0, 0, 14.7], samYaw: Math.PI / 2, ops: [[5.6, 0, 13.9], [5.6, 0, 15.5]], opsYaw: Math.PI / 2 },
      room: { name: "registrar's office", where: 'end of the gallery', door: 'office', bounds: R.office, lights: 'office', doorAim: MAIN },
      side: { door: 'office_side', hold: [32.6, 0, 12.7], from: { door: 'sorting', bounds: R.sorting } },
      hostages: [{ pos: [34.9, 0, 5.0], face: 3.6 }, { pos: [32.6, 0, 4.9], face: 3.3 }],
      captor: { pos: [33.8, 0, 10.6], aimAt: MAIN },
      doorMan: { inside: { pos: [30.4, 0, 9.4], aimAt: MAIN }, outside: { pos: [26.2, 0, 4.7], aimAt: [24.4, 1.1, 11.0] } },
      // the rescue stands ONE roamer, on mark 0 or mark 1 by its own coin: the copy room (behind the blind wall, in the dark, looking out of its open hall
      // door at where a stack on the main door stands) or the reading room (behind the glass, under its lamp)
      roamers: [{ pos: [22.4, 0, 9.4], aimAt: [28.4, 1.1, 7.5] }, { pos: [11.6, 0, 5.6], aimAt: [15.4, 1.1, 9.9] }],
      flow: {
        corridor: { x0: 10.06, x1: 28.94, z0: 10.06, z1: 12.74 },
        regions: [{ id: 'reading', door: null, rect: R.reading }, { id: 'copy', door: null, rect: R.copy }],
        route: [
          { id: 'reading', name: 'reading room', short: 'reading', region: 'reading', kind: 'glass', door: 'reading', at: [15.4, 0, 10.0], mark: [14.5, 0, 12.15], watch: [13.2, 1.1, 7.0], half: 0.55, north: true, call: 'glass left.', side: 'left', look: 0.9 },
          { id: 'copy', name: 'copy room', short: 'copy', region: 'copy', kind: 'door', door: 'copy', at: [20.0, 0, 10.0], mark: [19.1, 0, 12.15], watch: [20.0, 1.05, 10.0], half: 0.55, north: true, call: 'door left.', side: 'left', look: 0.4 },
        ],
        hold: { ahead: 9, xMax: 27.5, z: 11.4 },
      },
    },
  };
  scenarios.kitView = REGISTRY_KITVIEW;
  // THE FLOOR, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it): this level has no room-clear structure, so without
  // these a line that says where ('holding …') had only the OFFICE's words for it — the captor 'holding the server room' in the registrar's office
  scenarios.places = { areas: [{ name: "registrar's office", bounds: { ...R.office } }, { name: 'reading room', bounds: { ...R.reading } }, { name: 'copy room', bounds: { ...R.copy } }, { name: 'hall', bounds: { ...R.hall } }, { name: 'gallery', bounds: { ...R.gallery } }, { name: 'lobby', bounds: { ...R.lobby } }, { name: 'stacks', bounds: { ...R.stacks } }, { name: 'sorting room', bounds: { ...R.sorting } }] };
  return { level, scenarios, groups: trace.groups };
}
