// THE TWO CHARGES — a small level for ONE idea: two timed charges in rooms well apart, both on one clock (75 s) that two pairs working both wings at once
// beat with room to spare and the whole squad going to one and then the other beats less than half the time (red to one wing, blue to the other: T, then
// the door orders — or the player takes a charge himself and sends the four to the other). Rooms, doors and charges are named 1 and 2, the numbers the look
// file paints at the doors: the HUD has no compass. A low house of five rooms: a hall along the front, and off it two
// wings, each a room and the workshop behind it where a charge stands on the bench. TWO WAYS TO EACH CHARGE: through the hall and the wing's room (two doors,
// the room's men met on the way), or round the outside of the house to the workshop's own back door in its end wall (one door — and the room's men behind you
// while you work). The wings share no door: from one charge to the other is back through the hall, or round the house.
//
//          x=6        x=12          x=20          x=28        x=34
//   z=7    +----------+-------------+-------------+-----------+
//          | WEST     |  WEST       |  EAST       | EAST      |
//          | WORKSHOP d  ROOM       |  ROOM       d WORKSHOP  |      d = a door · the charges stand on the benches on the north wall
//   (back) d charge 1 |             |             | charge 2  d (back)
//   z=13   +----------+----d--------+--------d----+-----------+
//          |                 HALL (nobody holds it)           |
//   z=17   +--WW--------------------d(front)-------------WW---+
//                       the team forms up in the dark lot to the south
//
// What makes the idea true is in the file's `scenarios.defuse` block (scene/scenarios.ts DefuseData, read by game/defuse.ts): the two charges and the one clock.
// The room clear is the level's `scenarios.roomClear` as on any level. Regenerate: bun run tools/levels/export.ts defuse
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag } from '../../src/scene/boxes';
import type { Level } from '../../src/scene/level';
import type { DefuseData, KitViewData, LevelScenarios, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import * as K from '../../src/scene/levelKit';
import { livedPieces, INK } from './livedPieces';

export const NAME = 'defuse';
export const NOTES = 'The two charges: a defuse mission\'s own level. Two wings off one hall, a timed charge on the bench in the far room of each, one clock for both. Kit pieces only. Regenerate: bun run tools/levels/export.ts defuse';

/** The rooms INSIDE their walls and the doors each is entered by: data about the level, kept beside the generator that makes them true. */
export const DEFUSE_ROOMS = {
  wshop: { name: 'workshop 1', bounds: { x0: 6.12,  x1: 11.94, z0: 7.12,  z1: 12.94 }, doors: ['shop_1', 'back_1'] },
  wroom: { name: 'room 1',     bounds: { x0: 12.06, x1: 19.94, z0: 7.12,  z1: 12.94 }, doors: ['hall_1', 'shop_1'] },
  eroom: { name: 'room 2',     bounds: { x0: 20.06, x1: 27.94, z0: 7.12,  z1: 12.94 }, doors: ['hall_2', 'shop_2'] },
  eshop: { name: 'workshop 2', bounds: { x0: 28.06, x1: 33.88, z0: 7.12,  z1: 12.94 }, doors: ['shop_2', 'back_2'] },
  hall:  { name: 'hall',          bounds: { x0: 6.12,  x1: 33.88, z0: 13.06, z1: 16.88 }, doors: ['front', 'hall_1', 'hall_2'] },
} as const;
/** where the team forms up: the dark lot south of the front door */
export const DEFUSE_START: Vec3 = [20.0, 0, 22.4];

/** the bench a charge stands on: its middle on the north wall, and the point on the charge a hand goes to */
const BENCH_Z = 7.47, BENCH_D = 0.7, BENCH_TOP = 0.76, WEST_X = 8.5, EAST_X = 31.5;
const chargeAt = (x: number): Vec3 => [x, BENCH_TOP + 0.08, BENCH_Z + 0.18];

/** THE ROOM CLEAR (scene/scenarios.ts StructureData): four held rooms, two men in each — the room in front of each workshop and the workshop itself.
 *  A mark's place implies its facing: a man stands across the room from the door he fears. No breach plan, so no F drill: the team's start is here. */
export const DEFUSE_STRUCTURE: StructureData = {
  name: 'the house', maxMen: 8,
  team: { sam: DEFUSE_START, samYaw: Math.PI, ops: [[19.0, 0, 23.4], [21.0, 0, 23.4], [18.0, 0, 23.4], [22.0, 0, 23.4]], opsYaw: Math.PI },
  rooms: [
    { id: 'wroom', name: 'room 1', bounds: { ...DEFUSE_ROOMS.wroom.bounds }, garrison: 2,
      doors: [{ id: 'hall_1', from: 'hall' }, { id: 'shop_1', from: 'workshop 1' }],
      marks: [
        { pos: [18.9, 0, 8.0], watch: 'hall_1', aimAt: [15.0, 1.1, 12.9] },     // the far corner from both doors, on the hall door
        { pos: [13.0, 0, 7.9], watch: 'hall_1', aimAt: [15.0, 1.1, 12.9] },     // the north-west corner, beside the workshop's door
        { pos: [19.0, 0, 12.1], watch: 'hall_1', aimAt: [15.0, 1.1, 12.9] },    // the hard corner east of the hall door, along its wall
      ] },
    { id: 'wshop', name: 'workshop 1', bounds: { ...DEFUSE_ROOMS.wshop.bounds }, garrison: 2,
      doors: [{ id: 'shop_1', from: 'room 1' }, { id: 'back_1', from: 'outside' }],
      marks: [
        { pos: [7.0, 0, 12.2], watch: 'shop_1', aimAt: [11.9, 1.1, 10.0] },     // the south-west corner, across the room from the inside door (the back door's hard corner)
        { pos: [7.5, 0, 8.9], watch: 'shop_1', aimAt: [11.9, 1.1, 10.0] },      // by the crates on the west wall, on the inside door
        { pos: [11.2, 0, 12.2], watch: 'back_1', aimAt: [6.1, 1.1, 10.5] },     // the hard corner south of the inside door, on the back door across the room
      ] },
    { id: 'eroom', name: 'room 2', bounds: { ...DEFUSE_ROOMS.eroom.bounds }, garrison: 2,
      doors: [{ id: 'hall_2', from: 'hall' }, { id: 'shop_2', from: 'workshop 2' }],
      marks: [
        { pos: [21.1, 0, 8.0], watch: 'hall_2', aimAt: [25.0, 1.1, 12.9] },
        { pos: [27.0, 0, 7.9], watch: 'hall_2', aimAt: [25.0, 1.1, 12.9] },
        { pos: [21.0, 0, 12.1], watch: 'hall_2', aimAt: [25.0, 1.1, 12.9] },
      ] },
    { id: 'eshop', name: 'workshop 2', bounds: { ...DEFUSE_ROOMS.eshop.bounds }, garrison: 2,
      doors: [{ id: 'shop_2', from: 'room 2' }, { id: 'back_2', from: 'outside' }],
      marks: [
        { pos: [32.7, 0, 12.2], watch: 'shop_2', aimAt: [28.1, 1.1, 10.0] },
        { pos: [32.5, 0, 8.9], watch: 'shop_2', aimAt: [28.1, 1.1, 10.0] },
        { pos: [28.8, 0, 12.2], watch: 'back_2', aimAt: [33.9, 1.1, 10.5] },
      ] },
  ],
};

/** THE IDEA (scene/scenarios.ts DefuseData — game/defuse.ts): the two charges and their one clock. The clock is set where two pairs working both wings at once
 *  have room to spare and the whole squad working one and then the other only sometimes makes it (tools/qa/defuse-run.ts measures both). The names are the
 *  numbers painted at the workshop doors: the HUD has no compass and the camera turns. */
export const DEFUSE_CHARGES: DefuseData = {
  secs: 75, workSecs: 6,
  devices: [
    { id: 'one', name: 'charge 1', pos: chargeAt(WEST_X), n: [0, 1] },
    { id: 'two', name: 'charge 2', pos: chargeAt(EAST_X), n: [0, 1] },
  ],
};

// THE TEAM & KIT PICTURE (scenarios.kitView): a set of the house's own front, on the front wall's own line and door. The real door plans clean, but the
// thing the level is about (the firing wire down the hall, the charges in the back rooms) is out of the picture's reach behind it: the set brings the
// wire, its battery plate, a charge and the bench it was built on to the wall the stack stands on, under one warm bulb.
const COPPER: [number, number, number] = [0.46, 0.21, 0.07];
const DEFUSE_KITVIEW: KitViewData = {
  sets: { front: { ref: [20.25, 20],
    doors: [{ id: 'df_front', hinge: [19.82, 17], closedDir: 0, width: 0.86, exterior: true }],
    boxes: [
      { id: 'df_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'dust|asphalt' },
      { id: 'df_wall_w', c: [12.91, 1.5, 17], h: [6.91, 1.5, 0.12], material: 'mud|concrete' },
      { id: 'df_wall_e', c: [27.34, 1.5, 17], h: [6.66, 1.5, 0.12], material: 'mud|concrete' },
      { id: 'df_lintel', c: [20.25, 2.525, 17], h: [0.43, 0.475, 0.12], material: 'mud|concrete' },
      { id: 'df_floor', c: [20, 0.002, 14.94], h: [14, 0.002, 1.94], material: 'slab|lino' },
      { id: 'df_back', c: [20, 1.5, 12.94], h: [14, 1.5, 0.06], material: 'whitewash|wall' },
      { id: 'df_end_w', c: [5.94, 1.5, 14.94], h: [0.06, 1.5, 2.06], material: 'whitewash|wall' },
      { id: 'df_end_e', c: [34.06, 1.5, 14.94], h: [0.06, 1.5, 2.06], material: 'whitewash|wall' },
      { id: 'df_ceiling', c: [20, 3.1, 14.94], h: [14.1, 0.1, 2.1], material: 'ceiling', flags: ['NoPrimary'] },
      { id: 'df_flex', c: [17.6, 2.705, 15.7], h: [0.008, 0.295, 0.008], material: 'black', flags: ['NoShadow'] },
      { id: 'df_bulb', c: [17.6, 2.36, 15.7], h: [0.04, 0.05, 0.04], material: 'white', emissive: [30, 22, 12], flags: ['NoShadow'] },
      // (as drawn on the software adapter, a low thing within about 0.3 m of the wall's inside is behind the wall's top: these stand 0.4 m and more off it)
      // a runner, a little redder than the hall's own paint, and on it the firing wire (twin leads) down the hall to the battery plate, then across to the charge at the wall
      { id: 'df_runner', c: [17, 0.006, 15.45], h: [9, 0.0035, 0.4], albedo: [0.3, 0.12, 0.09], flags: ['NoShadow'] },
      { id: 'df_lead_a', c: [13.2, 0.013, 15.41], h: [5.1, 0.004, 0.015], albedo: COPPER, flags: ['NoShadow'] },
      { id: 'df_lead_b', c: [13.2, 0.013, 15.49], h: [5.1, 0.004, 0.015], albedo: COPPER, flags: ['NoShadow'] },
      { id: 'df_plate', c: [18.3, 0.014, 15.45], h: [0.2, 0.005, 0.15], material: 'iron|metal', flags: ['NoShadow'] },
      { id: 'df_cell', c: [18.3, 0.06, 15.45], h: [0.1, 0.045, 0.06], material: 'black' },
      { id: 'df_lead_c', c: [18.26, 0.013, 15.83], h: [0.015, 0.004, 0.23], albedo: COPPER, flags: ['NoShadow'] },
      { id: 'df_lead_d', c: [18.34, 0.013, 15.83], h: [0.015, 0.004, 0.23], albedo: COPPER, flags: ['NoShadow'] },
      { id: 'df_charge', group: 'df.charge', c: [18.3, 0.17, 16.22], h: [0.17, 0.17, 0.17], albedo: [0.2, 0.17, 0.11] },
      { id: 'df_led', group: 'df.charge', c: [18.3, 0.352, 16.22], h: [0.05, 0.012, 0.05], material: 'black', emissive: [12, 0.8, 0.4], flags: ['NoShadow'] },
      // the bench it was built on, up the wall from the charge: a spool of the wire, tins of the stuff, a sheet; two fuel cans by its leg
      { id: 'df_bench', group: 'df.bench', c: [15.9, 0.8, 16.5], h: [0.7, 0.025, 0.28], material: 'poplar|wood' },
      { id: 'df_leg_a', group: 'df.bench', c: [15.25, 0.39, 16.5], h: [0.03, 0.39, 0.26], material: 'woodDark' },
      { id: 'df_leg_b', group: 'df.bench', c: [16.55, 0.39, 16.5], h: [0.03, 0.39, 0.26], material: 'woodDark' },
      { id: 'df_spool', group: 'df.bench', c: [16.2, 0.9, 16.44], h: [0.09, 0.075, 0.09], albedo: COPPER },
      { id: 'df_tin_a', group: 'df.bench', c: [15.5, 0.89, 16.54], h: [0.07, 0.065, 0.07], material: 'tin|metal' },
      { id: 'df_tin_b', group: 'df.bench', c: [15.68, 0.89, 16.4], h: [0.07, 0.065, 0.07], material: 'tin|metal' },
      { id: 'df_sheet', group: 'df.bench', c: [15.95, 0.828, 16.46], h: [0.105, 0.003, 0.15], yaw: 0.3, albedo: [0.9, 0.89, 0.84], flags: ['NoShadow'] },
      { id: 'df_can_a', group: 'df.bench', c: [17.05, 0.23, 16.38], h: [0.17, 0.23, 0.085], albedo: [0.78, 0.6, 0.1] },
      { id: 'df_can_b', group: 'df.bench', c: [17.5, 0.23, 16.38], h: [0.17, 0.23, 0.085], albedo: [0.78, 0.6, 0.1] },
      // outside, past the last man of the stack: a water drum against the wall (the set's own: the lot has none)
      { id: 'df_drum', group: 'df.lot', c: [15.3, 0.44, 17.45], h: [0.28, 0.44, 0.28], material: 'drumBlue|partBlue' },
    ],
    // the hall's bare bulb, warm: a set carries its own lamps, and without one the hall behind the wall is black
    lights: [{ id: 'df_lamp', kind: 'point', pos: [17.6, 2.33, 15.7], dir: [0, -1, 0], color: [1, 0.7, 0.42], intensity: 24, range: 7, innerDeg: 0, outerDeg: 180,
      group: 'df', enabled: true, volumetric: 0, radius: 0.06, mains: false, fixture: 'df_bulb' }] } },
  ways: [{ door: 'df_front', set: 'front', pane: false, light: { porch: { intensity: 9, color: [1, 0.66, 0.36] }, fill: { intensity: 3.2 } } }] };

export const DEFUSE_SCENARIOS: LevelScenarios = { roomClear: DEFUSE_STRUCTURE, defuse: DEFUSE_CHARGES, kitView: DEFUSE_KITVIEW,
  places: { areas: [{ name: DEFUSE_ROOMS.hall.name, bounds: { ...DEFUSE_ROOMS.hall.bounds } }] } };

/** What tools/levels/export.ts writes levels/defuse.json from: the Level, the file's scenarios block, the editor group of every box. */
export function build(opts: K.KitOpts = {}): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const k = K.newKit(opts); const C = K.KIT_PALETTE;
  const EXT = K.WALL_EXT, INT = K.WALL_INT, R = DEFUSE_ROOMS;
  const win = (a: number, b: number, mullions = 1): K.Opening => ({ a, b, y0: 0.9, y1: 2.4, mullions, glass: 'whole' });

  // ---------------- ground ----------------
  K.grp(k, 'ground');
  K.slab(k, 0, -0.25, 0, 40, 0, 28, C.asphalt);
  K.slab(k, 0, 0, 0, 40, 0.01, 6.88, C.grass, { flags: BoxFlag.NoShadow });   // the back of the house: rough ground
  K.grp(k, 'floors');
  K.slab(k, 6, -0.1, 7, 34, 0.001, 17, C.carpet);
  K.floorFinish(k, R.hall.bounds.x0, R.hall.bounds.z0, R.hall.bounds.x1, R.hall.bounds.z1, C.lino, K.POLISHED);
  K.floorFinish(k, R.wshop.bounds.x0, R.wshop.bounds.z0, R.wshop.bounds.x1, R.wshop.bounds.z1, [0.2, 0.21, 0.24], { rough: 0.35 });
  K.floorFinish(k, R.eshop.bounds.x0, R.eshop.bounds.z0, R.eshop.bounds.x1, R.eshop.bounds.z1, [0.2, 0.21, 0.24], { rough: 0.35 });
  K.grp(k, 'ceiling');
  K.ceiling(k, 5.9, 6.9, 34.1, 17.1);

  // ---------------- walls ----------------
  K.grp(k, 'walls.exterior');
  const ext = C.concrete;
  K.wallX(k, 7, 5.88, 34.12, EXT, ext);                                    // north: blank — the benches stand against it
  // west and east, the ends of the house: each workshop's own back door, hung to open OUTWARD — no wedge holds it, so a workshop's men can shut the inside
  // door alone and the way round the house stays a way in (tools/qa/second-way-check.ts)
  K.wallZ(k, 6, 7.12, 16.88, EXT, ext, [K.doorAt(k, 'back_1', 'z', 6, 9.9, { exterior: true, swing: 1 })]);
  K.wallZ(k, 34, 7.12, 16.88, EXT, ext, [K.doorAt(k, 'back_2', 'z', 34, 9.9, { exterior: true, swing: -1 })]);
  // south z=17: the front door in the middle, a window onto the hall at each end
  K.wallX(k, 17, 5.88, 34.12, EXT, ext, [win(8.6, 10.2), K.doorAt(k, 'front', 'x', 17, 19.4, { exterior: true }), win(29.8, 31.4)]);
  K.grp(k, 'walls.interior');
  const iw = C.wall;
  // the rooms | the hall, z=13: one door into each wing
  K.wallX(k, 13, 6.12, 33.88, INT, iw, [K.doorAt(k, 'hall_1', 'x', 13, 14.4), K.doorAt(k, 'hall_2', 'x', 13, 24.4)]);
  // each workshop | its room, x=12 and x=28: one door each; the two wings | each other, x=20: blank
  K.wallZ(k, 12, 7.12, 12.94, INT, iw, [K.doorAt(k, 'shop_1', 'z', 12, 9.4)]);
  K.wallZ(k, 28, 7.12, 12.94, INT, iw, [K.doorAt(k, 'shop_2', 'z', 28, 9.4)]);
  K.wallZ(k, 20, 7.12, 12.94, INT, iw);

  // ---------------- the workshops: the bench on the north wall (the charge stands on it — game/defuse.ts draws it), a bare bulb over it ----------------
  for (const [id, x] of [['wshop', WEST_X], ['eshop', EAST_X]] as const) {
    K.grp(k, id);
    K.desk(k, x, BENCH_Z, 1.8, BENCH_D, 0, C.woodDark);
    K.bulb(k, x, 9.6, `${id}_bulb`, id, true, 24);
  }
  K.grp(k, 'wshop'); K.shelf(k, 9.0, 12.62, 1.6, 0.5, 0, 3, 1.6);   // (on the south wall: the end walls carry the back doors)
  K.grp(k, 'eshop'); K.shelf(k, 31.0, 12.62, 1.6, 0.5, 0, 3, 1.6);

  // ---------------- the two rooms in front of them: where the house's people live ----------------
  K.grp(k, 'wroom');
  K.desk(k, 16.4, 9.6, 1.6, 0.8, 0); K.chair(k, 16.4, 10.4, 0); K.chair(k, 16.4, 8.8, Math.PI);   // a table in the middle of the room: the only cover in it
  K.bulb(k, 16.0, 10.2, 'wroom_bulb', 'wroom', true, 22);
  K.grp(k, 'eroom');
  K.sofa(k, 23.6, 7.6, 0); K.cabinet(k, 20.5, 10.6, Math.PI / 2);
  K.bulb(k, 24.0, 10.2, 'eroom_bulb', 'eroom', true, 22);

  // ---------------- the hall: lit at the front door, dark toward both ends ----------------
  K.grp(k, 'hall');
  K.ceilingPanel(k, 20.0, 15.0, true, 'hall'); K.ceilingPanel(k, 10.0, 15.0, false, 'hall'); K.ceilingPanel(k, 30.0, 15.0, false, 'hall');
  K.bench(k, 17.4, 16.6, 0);
  const breaker = K.breakerPanel(k, [22.4, 1.35, 13.06], [0, 1]);
  K.beacon(k, 12.0, 15.0); K.beacon(k, 28.0, 15.0);

  // ---------------- the lot ----------------
  K.grp(k, 'lot');
  K.car(k, 26.4, 20.6, 0.08, [0.3, 0.27, 0.2]);
  K.car(k, 12.6, 21.2, Math.PI - 0.1, [0.2, 0.22, 0.26]);
  K.streetLamp(k, 20.0, 26.6, 'street_lamp', [0, 0, -1], false);   // out: the team forms up in the dark
  K.moon(k);

  // ---------------- lived-in (src/scene/lived.ts: the TAIL of every list) ----------------
  {
    const P = livedPieces({ add: b => K.add(k, b), grp: n => K.grp(k, n), prop: (...a) => K.prop(k, ...a) }, C);
    // the west workshop: where the charges are put together — tins of the stuff on the bench's end, a crate of it by the wall, a stool pulled out
    P.room('wshop');
    P.tins(7.95, BENCH_TOP + 0.005, 7.4, 0, 2, 0.3, C.metal, null); P.sheets(9.1, BENCH_TOP + 0.005, 7.42, 0.2, 2);
    P.crate(6.6, 8.0, 0.55, 0.1); P.crate(11.55, 8.3, 0.45, -0.2, C.wood, C.white, 'case'); P.stool(9.9, 8.5);
    P.floor(8.6, 10.2, 2.6, 1.8, [0.3, 0.16, 0.13]);
    P.sack(10.9, 7.5, 0.2);
    // the east workshop: the same trade, the other man's bench — wire, a kettle, his boots by the door
    P.room('eshop');
    P.tins(32.05, BENCH_TOP + 0.005, 7.4, 0, 2, 0.3, C.metal, null); P.kettle(30.85, BENCH_TOP + 0.005, 7.4, 0.3);
    P.crate(33.4, 8.0, 0.55, -0.1); P.stool(30.1, 8.5); P.bucket(33.0, 7.55);
    P.floor(31.4, 10.2, 2.6, 1.8, [0.16, 0.2, 0.3]);
    P.boots(28.7, 7.5, 0, 2);
    // the west room: they eat here — mugs and a kettle on the table, sacks against the wall, a rug
    P.room('wroom');
    P.mugs(16.1, 0.775, 9.5, 0, 3); P.kettle(16.9, 0.775, 9.7, 0.4);
    P.floor(16.4, 9.6, 3.4, 2.6, [0.32, 0.2, 0.14]);
    P.sack(19.4, 9.6, Math.PI / 2); P.sack(19.42, 10.4, Math.PI / 2 + 0.2); P.crate(12.7, 12.3, 0.5, 0.1);
    P.hooks(17.6, 7.13, 0, 3, 1.6, [INK.canvas, INK.navy, INK.canvas]);
    // the east room: they sleep here — a chest, an armchair, coats on the wall
    P.room('eroom');
    P.chest(27.35, 12.6, 0.9, 0.5, 0, 0.9, 3);
    P.armchair(22.5, 12.2, Math.PI - 0.3); P.hooks(25.8, 7.13, 0, 3, 1.6, [INK.navy, INK.canvas, INK.canvas]);
    P.floor(24.0, 10.2, 3.0, 2.2, [0.2, 0.3, 0.24]);
    // the hall: kept bare — it is the way between the wings and every second in it is the clock's
    P.room('hall');
    P.boots(16.4, 16.6, Math.PI, 3); P.crate(7.0, 13.6, 0.5, 0.2); P.crate(33.1, 13.6, 0.5, -0.2);
    P.floor(20.0, 15.0, 24.0, 1.2, [0.3, 0.17, 0.14], 0.006, 0.006);
  }

  const level: Level = K.kitLevel(k, {
    playerSpawn: DEFUSE_START,
    routes: [],
    breaker,
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the room clear stands that mission still): the east room, a point on its
    // north wall, and out by the front door to the south
    mission: { serverRoom: { ...R.eroom.bounds }, entryDoor: 'hall_2', rack: { index: 0, front: [25.6, 1.0, 7.5], halfW: 0.3 }, exfilDoor: 'front', exfilX: 20.0, exfilZ: 17.6, exfilOut: [0, 1] },
  });
  // ---------------- what is underfoot (game/floor.ts: which footstep sounds, and how far it carries to their ears) — the slabs under 'ground' and 'floors'
  // above, rect for rect. `building` is the whole world so the plan is all zones (first match wins): outside every zone is the lot's asphalt.
  // The workshops' dark finish is the paint the office lays on its server room's raised floor; here it is a workshop's hard floor, so 'stone'.
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'back', mat: 'grass', x0: 0, z0: 0, x1: 40, z1: 6.88 },                                   // the rough ground behind the house
      { id: 'hall', mat: 'lino', x0: R.hall.bounds.x0, z0: R.hall.bounds.z0, x1: R.hall.bounds.x1, z1: R.hall.bounds.z1 },
      { id: 'workshop_1', mat: 'stone', x0: R.wshop.bounds.x0, z0: R.wshop.bounds.z0, x1: R.wshop.bounds.x1, z1: R.wshop.bounds.z1 },
      { id: 'workshop_2', mat: 'stone', x0: R.eshop.bounds.x0, z0: R.eshop.bounds.z0, x1: R.eshop.bounds.x1, z1: R.eshop.bounds.z1 },
      { id: 'house', mat: 'carpet', x0: 6, z0: 7, x1: 34, z1: 17 },                                   // the house's carpet base: rooms 1 and 2
    ],
  };
  return { level, scenarios: DEFUSE_SCENARIOS, groups: k.groups, surfaces };
}
