// THE WAREHOUSE — a big many-room floor for the four squad, in the Door Kickers mould: one racked hall with long lanes, a loading dock on its east side, and a
// ring of small rooms (plant room, lockers, break room, tool cage, shipping office, two offices) off an L-shaped service corridor that runs round the hall's
// north and west sides. The team starts OUTSIDE, in the dark off the south-west corner, and there is a way in on every face of the building.
// A level generator in the scenario levels' shape (tools/levels/block.ts is what it was cut from; rebuild/scenario-levels/contract.md the how-to):
//   bun run tools/levels/export.ts warehouse [--check]     → levels/warehouse.json, with its `scenarios.roomClear` block
//   page: ?levelFile=warehouse.json&roomclear&squad4       · headless: bun run tools/qa/scenario-level-probes.ts levels/warehouse.json --only data,four
//
//              x 4      10        17          25      30       36
//         z 4  +--plant_ext--------+--window---+-------+--------+
//              | plant  | lockers  lb  break   | cage  co ship. |
//         z 8  +--p_s---+----l_s---+---b_s-----+--c_s--+--o_s---+
//   fire_exit ==        N O R T H   C O R R I D O R              |
//         z 11 +--------+  +------------h_n------------+--d_n---+
//              | mgr's  |W |  ===A===   ===A===        |        == dock_n
//              | office mgr_e                         hd_n      |
//         z 17 +--off---+C |      H  A  L  L           | D O C K| (shutters, down)
//              | front  |O h_sw                        |        |
//              | office fo_e ==B==   ====B====        hd_s      == dock_s
//         z 24 +--------+=staff=-----------------------+--------+
//                 TEAM (outside, south-west)
//
// WAYS IN, one on every face: `staff` (south, into the west corridor's foot, between the front office and the hall's south-west door), `fire_exit` (west, the
// north corridor's west end), `plant_ext` (north, straight into the plant room), `dock_n` and `dock_s` (east, the dock's two personnel doors beside the shutters).
// THE LOOP: west corridor → north corridor → d_n → the dock → hd_n / hd_s → the hall → h_sw → west corridor (and the hall's own north door h_n cuts it in two).
// Whoever is fought in the hall can be come round on by either corridor; whoever stacks on a corridor door has a hall door at his back. The apron outside is a
// second, wider loop for both sides.
// THE HALL: two rows of pallet racking run east-west (A north, B south), each in two lengths with a 2 m cross gap, the gaps staggered. Three lanes of 3 to 4 m run
// the hall's length: the dock doors and the west door look straight down them. A racking bay is loaded full (nobody sees or shoots through), low (a man kneels
// behind it and stands to see over), high (legs show under it) or empty; pallets and one tall crate stand in the middle lane.
// ELEVEN DEFENDERS IN FOUR SQUADS, by the rooms they hold (`scenarios.roomClear.squads`, the squads part's format: rebuild/enemy-squads/squad-format.md).
// A squad sends men out only with two to spare past one a room (enemysquads.ts), so who can LEAVE is the level's own decision:
//   office (3)  the front office 2, the manager's office 1 — one to spare: they lock down and hold
//   floor (3)   the hall — two to spare: a pair can come round
//   dock (3)    the dock — two to spare: a pair can come round
//   stores (2)  the shipping office 1, the tool cage 1 — never leave their rooms
// Eleven is what the squads schema commit stages (2d7a19d: SQUAD_MAX_MEN); with Sam and the four that is all sixteen characters the skinning holds.
// The plant room, the lockers and the break room are held by nobody: rooms the fog keeps shut until somebody looks, and the north side's way round.
//
// The shell is the office's (exterior walls on x 4 / 36, z 4 / 24): the weather's INTERIOR rectangle and the world bounds typed into the shaders hold without a
// change. No stair tower: the response team is gated off under the scenarios — but game/weather.ts still types the office's tower in as ANNEX (x 1.1..4,
// z 9.33..12.87), and the fire exit opens beside it: in the storm that patch of the west verge stays dry and the door lets no gust in. Known, left: the only
// doorway the north corridor's end can take is this one, and the rectangle is not a level's to move. The footstep surface map is still the office's (game/floor.ts), as on every level.
// NO BREACH PLAN: no F drill — all four teammates are the order menu's from the first frame. Only the old demo's kit (src/scene/officeGen.ts officeKit).
// Units: meters. +X east, +Z south, +Y up.
// NOT SEEN DRAWN: laid out on paper and checked headless (validator, level-lint, the scenario probes, scripted play-throughs); nobody has looked at it on a GPU.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import { livedKit } from './livedKit';

export const NAME = 'warehouse';
export const NOTES = 'The warehouse: a racked hall and a loading dock ringed by small rooms off an L-shaped service corridor, a way in on every face, the team starting outside. Eleven defenders in three squads (floor, dock, office). For the four man squad. One floor, box geometry only, the office\'s shell and kit. Regenerate: bun run tools/levels/export.ts warehouse';

/** The spaces: the floor inside each one's walls. The ONE place a room's rectangle is typed. */
export const WAREHOUSE_ROOMS: Record<'plant' | 'lockers' | 'brk' | 'cage' | 'ship' | 'ncorr' | 'wcorr' | 'mgr' | 'front' | 'hall' | 'dock', Rect> = {
  plant: { x0: 4.12, x1: 9.94, z0: 4.12, z1: 7.94 },
  lockers: { x0: 10.06, x1: 16.94, z0: 4.12, z1: 7.94 },
  brk: { x0: 17.06, x1: 24.94, z0: 4.12, z1: 7.94 },
  cage: { x0: 25.06, x1: 29.94, z0: 4.12, z1: 7.94 },
  ship: { x0: 30.06, x1: 35.88, z0: 4.12, z1: 7.94 },
  ncorr: { x0: 4.12, x1: 35.88, z0: 8.06, z1: 10.94 },
  wcorr: { x0: 10.06, x1: 12.94, z0: 10.94, z1: 23.88 },
  mgr: { x0: 4.12, x1: 9.94, z0: 11.06, z1: 16.94 },
  front: { x0: 4.12, x1: 9.94, z0: 17.06, z1: 23.88 },
  hall: { x0: 13.06, x1: 29.94, z0: 11.06, z1: 23.88 },
  dock: { x0: 30.06, x1: 35.88, z0: 11.06, z1: 23.88 },
};
/** THE SQUADS, in the squads part's format (/rebuild/enemy-squads/squad-format.md, stable 2026-10-07): which of the structure's rooms each holds — its men are
 *  those rooms' garrisons — and where it regroups (a mark of one of its rooms). `barricade` is left at its default: every door of a squad's
 *  rooms but the one joining two of its own (`off`, `co`). `mayLeave` is the default (free to leave) for all but the Stores, who stay (`mayLeave: false`). What a squad DOES is the AI's. */
export const WAREHOUSE_SQUADS: { id: string; name: string; rooms: string[]; rally: Vec3; mayLeave?: boolean }[] = [
  { id: 'office', name: 'Office', rooms: ['front', 'mgr'], rally: [7.0, 0, 19.9] },          // 3 in two rooms: the two offices by the staff door — the first the team meets; one to spare, so they hold
  { id: 'floor', name: 'Floor', rooms: ['hall'], rally: [19.0, 0, 17.2] },                   // 3 in one room: the hall, among the racking; two of them can leave it
  { id: 'dock', name: 'Dock', rooms: ['dock'], rally: [33.6, 0, 15.6] },                     // 3 in one room: the dock; two of them can leave it
  { id: 'stores', name: 'Stores', rooms: ['ship', 'cage'], rally: [34.4, 0, 7.2], mayLeave: false },   // 2: the north-east corner's two rooms; they stay in them
];

// THE TEAM & KIT PICTURE (scenarios.kitView), one way a way in, both on the level's own doors with the rooms lit. The staff door: the anchor alone (the
// office's desk and the apron's paint are the picture). The dock's side door: the apron's stacked crate and carton stood in the lane and the checker's boom
// (post, weight, pole) in the camera's line, so they step out; the yard's lamp post is left standing (it crosses the frame's far corner, not the men). The
// dock's own panels are off and the yard is 2.3 m wide, so the picture's fill lamp hangs INSIDE the dock, over the bays behind the stack's wall, and the
// porch lamp is turned down and cooler (at 15 it burnt the stack out against the block wall and washed the apron's yellow paint into the ground). Its
// wall is 2.3 m long past the jamb and the worked-out file needs 2.65, so the last man stood 0.2 m past the building's corner: the three stack places are
// written, the same file moved 0.23 m toward the door (the first man 0.22 m past the jamb, the last 2 cm inside the corner).
const WAREHOUSE_KITVIEW: KitViewData = { ways: [{ door: 'staff', roomLights: 1 },
  { door: 'dock_s', slots: [null, [36.82, 21.9, -180], [36.82, 23, -180], [36.82, 24.1, -180]], hide: ['box_0738', 'box_0739', 'box_0740', 'box_0741', 'box_0313', 'box_0315'], roomLights: 1,
    light: { porch: { intensity: 7, color: [1, 0.86, 0.7] }, fill: { offset: [1.5, -2.6, 2.8], aim: [1.5, -2.6, 0], intensity: 2, radius: 0.6 } } }] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = WAREHOUSE_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, rug, bin, cabinet, papers, wallArt, bench, shelf, plant, ceilingPanel, doorFrame, lights, switchables } = K;
  const STEEL: Vec3 = [0.33, 0.36, 0.38], ORANGE: Vec3 = [0.62, 0.27, 0.07], BLUE: Vec3 = [0.1, 0.17, 0.42];
  /** a pallet of crates: a static block a man can kneel behind (1.0 m) */
  function pallet(x: number, z: number, w: number, d: number, yaw = 0) {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], yaw, albedo: C.woodDark });
    add({ c: [x, 0.56, z], h: [w / 2 - 0.04, 0.44, d / 2 - 0.04], yaw, albedo: C.cardboard, ...mk(MD.cartonMarks([w / 2 - 0.04, 0.44, d / 2 - 0.04], TX)) });
  }
  /** a tall crate on its pallet (1.9 m): nobody sees over it */
  function crate(x: number, z: number, w: number, d: number) {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], albedo: C.woodDark });
    add({ c: [x, 1.01, z], h: [w / 2 - 0.03, 0.89, d / 2 - 0.03], albedo: C.wood });
  }
  /** a steel locker, 2 m: doors on both faces */
  const locker = (x: number, z: number, alongX: boolean) => { const h: Vec3 = alongX ? [0.49, 1.0, 0.3] : [0.3, 1.0, 0.49];
    add({ c: [x, 1.0, z], h, albedo: STEEL, rough: 0.5, ...mk(alongX ? [...MD.cupboardMarks(h, '+z', 2, TX), ...MD.cupboardMarks(h, '-z', 2, TX)] : [...MD.cupboardMarks(h, '+x', 2, TX), ...MD.cupboardMarks(h, '-x', 2, TX)]) }); };
  /** a table (0.75 m) with nothing under it but two legs */
  const table = (x: number, z: number) => { add({ c: [x, 0.72, z], h: [0.8, 0.03, 0.4], albedo: C.white }); for (const sx of [-0.6, 0.6]) add({ c: [x + sx, 0.35, z], h: [0.04, 0.35, 0.3], albedo: C.metal }); };
  /** PALLET RACKING along x, 1 m deep, 2.4 m tall, one letter a 1.4 m bay from `x0` eastward: orange beams at 1.3 and 2.3 m between blue upright frames, and what
   *  stands in the bay — 'F' full (a load on the floor and one on the first beam: nobody sees or shoots through) · 'L' low (the floor load only, 1.26 m: a man
   *  kneels behind it and stands to see over) · 'U' up (the beam load only: legs show under it) · '.' empty (the frame alone). Nobody walks through a bay. */
  function racking(x0: number, z: number, bays: string) {
    const BAY = 1.4, n = bays.length;
    for (let i = 0; i <= n; i++) add({ c: [x0 + i * BAY, 1.2, z], h: [0.04, 1.2, 0.5], albedo: BLUE, rough: 0.5 });
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * BAY, load = bays[i];
      for (const y of [1.3, 2.3]) add({ c: [x, y, z], h: [BAY / 2 - 0.04, 0.04, 0.5], albedo: ORANGE, rough: 0.5 });
      // (a load fills its bay from upright to upright and from the floor / the beam to the beam above: a sight line is a ray, and a 6 cm slit is a window)
      if (load === 'F' || load === 'L') { const h: Vec3 = [BAY / 2 - 0.04, 0.63, 0.44]; add({ c: [x, 0.63, z], h, albedo: i % 2 ? C.cardboard : C.wood, ...(i % 2 ? mk(MD.cartonMarks(h, TX)) : {}) }); }
      if (load === 'F' || load === 'U') { const h: Vec3 = [BAY / 2 - 0.04, 0.46, 0.44]; add({ c: [x, 1.8, z], h, albedo: i % 2 ? C.wood : C.cardboard, ...(i % 2 ? {} : mk(MD.cartonMarks(h, TX))) }); }
    }
  }

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  slab(0, 0, 0, 3.2, 0.01, 28, C.grass, { flags: BoxFlag.NoShadow });                     // grass verges down the west side and along the north (the office's
  slab(3.2, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });                   // two strips: `surfaces.grassEdge` below is the same 3.2 m)
  grp('floors');
  const floor = (x0: number, z0: number, x1: number, z1: number, alb: Vec3, extra: Partial<Box> = {}) => slab(x0, 0, z0, x1, 0.004, z1, alb, extra);
  const polished = { flags: BoxFlag.Gloss };
  slab(4, -0.1, 4, 36, 0.001, 24, C.concrete);                  // whole interior base (thin top at y=0): the hall, the dock, the plant room and the cage keep it
  floor(4, 8, 36, 11, C.lino, polished);                       // the north corridor
  floor(10, 11, 13, 24, C.lino, polished);                     // the west corridor
  floor(4, 11, 10, 24, C.carpet);                              // the two offices
  floor(10, 4, 25, 8, C.lino, polished);                       // the lockers and the break room
  floor(30, 4, 36, 8, C.carpet);                               // the shipping office

  grp('ceiling');
  slab(3.9, H, 3.9, 36.1, H + 0.2, 24.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // exterior walls (t=0.24). Windows only where a room wants one: the two offices on the west face, the break room on the north (sills at 0.9 m)
  grp('walls.exterior');
  const ext = C.concrete;
  wallX(24, 3.88, 36.12, 0.24, ext, [{ a: 10.8, b: 12.0, y0: 0, y1: 2.2 }]);                                                             // south: the staff door
  wallX(4, 3.88, 36.12, 0.24, ext, [{ a: 5.8, b: 7.0, y0: 0, y1: 2.2 }, { a: 19.5, b: 22.5, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }]);   // north: the plant room's door; the break room's window
  wallZ(4, 4, 24, 0.24, ext, [{ a: 8.8, b: 10.0, y0: 0, y1: 2.2 }, { a: 12.5, b: 15.5, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }, { a: 18.5, b: 21.0, y0: 0.9, y1: 2.4, mullions: 2, glass: 'whole' }]);   // west: the fire exit; the offices' windows
  wallZ(36, 4, 24, 0.24, ext, [{ a: 12.8, b: 14.0, y0: 0, y1: 2.2 }, { a: 20.8, b: 22.0, y0: 0, y1: 2.2 }]);                             // east: the dock's two personnel doors
  // the dock's two roller shutters, down: steel on both faces of the east wall between the doors
  for (const z of [16.0, 18.6]) for (const x of [35.865, 36.135]) add({ c: [x, 1.4, z], h: [0.015, 1.4, 1.1], albedo: STEEL, rough: 0.35 });

  // ---------------- interior partitions (t=0.12), all solid ----------------
  // (every doorway is cut 0.2 m before a whole metre and 1.2 m wide: the nav grid's half-metre cells then give it two free cells, as the block's doors have)
  grp('walls.interior');
  const iw = C.wall;
  // the north rooms' south wall z=8: one door a room onto the north corridor
  wallX(8, 4.12, 35.88, 0.12, iw, [{ a: 6.8, b: 8.0 }, { a: 14.8, b: 16.0 }, { a: 19.8, b: 21.0 }, { a: 26.8, b: 28.0 }, { a: 31.8, b: 33.0 }]);
  wallZ(10, 4.12, 7.94, 0.12, iw);                                 // plant | lockers
  wallZ(17, 4.12, 7.94, 0.12, iw, [{ a: 5.8, b: 7.0 }]);           // lockers | break room: `lb`
  wallZ(25, 4.12, 7.94, 0.12, iw);                                 // break room | cage
  wallZ(30, 4.12, 7.94, 0.12, iw, [{ a: 5.8, b: 7.0 }]);           // cage | shipping office: `co`
  // the north corridor's south wall z=11: the manager's office (blind), the west corridor's mouth open (x 10..13), then the hall's north door and the dock's
  wallX(11, 4.12, 10.06, 0.12, iw);
  wallX(11, 12.94, 35.88, 0.12, iw, [{ a: 21.8, b: 23.0 }, { a: 32.8, b: 34.0 }]);
  // the west corridor: offices on its west side (x=10), the hall on its east (x=13)
  wallZ(10, 11.06, 23.88, 0.12, iw, [{ a: 13.8, b: 15.0 }, { a: 21.8, b: 23.0 }]);
  wallZ(13, 11.06, 23.88, 0.12, iw, [{ a: 18.8, b: 20.0 }]);
  wallX(17, 4.12, 9.94, 0.12, iw, [{ a: 5.8, b: 7.0 }]);           // manager's office | front office: `off`
  // hall | dock, x=30: a door at each end
  wallZ(30, 11.06, 23.88, 0.12, iw, [{ a: 13.8, b: 15.0 }, { a: 20.8, b: 22.0 }]);

  // ---------------- the plant room (x 4..10, z 4..8): p_s on the corridor, plant_ext on the north face ----------------
  grp('plant');
  add({ c: [9.1, 0.95, 5.0], h: [0.55, 0.95, 0.55], albedo: [0.5, 0.5, 0.48], rough: 0.4 });                          // boiler
  add({ c: [9.2, 0.7, 6.7], h: [0.45, 0.7, 0.45], albedo: [0.2, 0.3, 0.45], rough: 0.4 });                            // pressure vessel
  add({ c: [8.2, 2.55, 4.4], h: [1.6, 0.06, 0.06], albedo: C.metal, flags: BoxFlag.NoShadow });                       // pipe run under the ceiling
  add({ c: [9.1, 2.3, 5.0], h: [0.07, 0.4, 0.07], albedo: C.metal, flags: BoxFlag.NoShadow });                        // flue
  // the control cabinet on the north wall, west of the door: the old mission's rack (a placeholder the level format wants)
  const DRIVE_RACK = 0; const slots: { u: number; y: number; amber: boolean }[] = [];
  for (let u = 0; u < 10; u++) { if (((u * 7) % 5) > 1) continue; slots.push({ u, y: 0.32 + u * 0.178, amber: u % 7 === 3 }); }
  const rackBody = add({ c: [4.7, 1.05, 4.75], h: [0.33, 1.05, 0.5], albedo: [0.06, 0.06, 0.07], rough: 0.3, ...mk(MD.rackMarks([0.33, 1.05, 0.5], slots.map(sl => ({ v: sl.y - 1.05, amber: sl.amber })), TX)) });
  const rackFront: Vec3 = [4.7, 1.1, 5.28];
  switchables.push({ name: 'rack0_leds', boxes: [rackBody], group: 'server_leds', on: true, baseEmissive: [0, 0, 0], flicker: true, mains: false });
  const brk = add({ c: [5.2, 1.35, 7.9], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [5.02, 1.62, 7.85], h: [0.015, 0.015, 0.01], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [5.2, 2.3, 7.9], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });
  cardboardBox(4.6, 7.2, 0.5, 0.2);
  ceilingPanel(7.0, 6.0, true, 'plant', true, 1.2, 0.3, [4.5, 6.0, 9.0]);

  // ---------------- the lockers (x 10..17, z 4..8): l_s on the corridor, lb into the break room ----------------
  grp('lockers');
  for (let k = 0; k < 4; k++) locker(10.6 + k, 4.45, true);
  locker(10.4, 6.2, false); locker(10.4, 7.2, false);
  bench(13.0, 6.3, 0);
  bin(16.5, 4.5); cardboardBox(14.4, 4.6, 0.5, 0.3);
  ceilingPanel(13.5, 6.0, false, 'lockers');

  // ---------------- the break room (x 17..25, z 4..8): b_s on the corridor, lb from the lockers; a window on the north face ----------------
  grp('break');
  add({ c: [24.55, 0.45, 5.4], h: [0.35, 0.45, 1.1], albedo: C.white, ...mk(MD.cupboardMarks([0.35, 0.45, 1.1], '-x', 3, TX)) }); add({ c: [24.55, 0.92, 5.4], h: [0.38, 0.03, 1.15], albedo: [0.2, 0.2, 0.22] });   // counter along the east wall
  add({ c: [24.5, 1.0, 7.3], h: [0.4, 1.0, 0.4], albedo: [0.75, 0.75, 0.74] });                                       // fridge
  add({ c: [24.6, 1.1, 4.8], h: [0.25, 0.15, 0.2], albedo: [0.15, 0.15, 0.16] });                                     // microwave
  table(21.4, 5.6); chair(20.3, 5.6, Math.PI / 2, [0.5, 0.5, 0.48]); chair(22.5, 5.6, -Math.PI / 2, [0.5, 0.5, 0.48]); papers(21.6, 0.75, 5.55, 0.5);
  chair(18.4, 7.3, 2.4, [0.5, 0.5, 0.48]); bin(17.5, 4.6);
  add({ c: [18.6, 1.3, 7.92], h: [0.6, 0.4, 0.02], albedo: [0.2, 0.35, 0.3] });                                       // notice board on the south wall
  ceilingPanel(21.0, 6.0, true, 'break', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- the tool cage (x 25..30, z 4..8): c_s on the corridor, co into the shipping office ----------------
  grp('cage');
  shelf(27.0, 4.5, 2.6, 0.5, 0, 4, 2.0);
  shelf(25.42, 6.3, 2.4, 0.5, Math.PI / 2, 4, 2.0);
  desk(29.3, 4.7, 1.0, 0.7, 0, C.metal);                                                                             // a steel bench in the north-east corner
  cardboardBox(25.5, 7.55, 0.5, 0.2);                                                                                // (the corner west of the corridor door, clear of its leaf)
  ceilingPanel(27.5, 6.2, true, 'cage', false, 1.2, 0.3);

  // ---------------- the shipping office (x 30..36, z 4..8): o_s on the corridor's east end, co from the cage ----------------
  grp('shipping');
  desk(34.2, 4.8, 1.6, 0.8, 0); monitor(34.2, 4.7, 0, true); chair(34.2, 5.7, 0); papers(34.75, 0.76, 4.9, 0.3);
  cabinet(31.9, 4.45, Math.PI); cabinet(32.5, 4.45, Math.PI);
  cardboardBox(30.6, 4.7, 0.5, 0.3); bin(35.5, 7.6);
  wallArt(34.3, 1.75, 4.135, 1.4, 0.8, [0.2, 0.3, 0.38], true);
  ceilingPanel(33.0, 6.0, true, 'shipping');

  // ---------------- the north corridor (z 8..11) and the west corridor (x 10..13): bare floor ----------------
  grp('corridors');
  ceilingPanel(8.0, 9.5, true, 'corridor', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(18.0, 9.5, false, 'corridor', false, 1.2, 0.3);
  ceilingPanel(27.0, 9.5, true, 'corridor', true, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(34.6, 9.5, false, 'corridor', false, 1.2, 0.3);
  ceilingPanel(11.5, 15.5, false, 'corridor', false, 0.3, 1.2); ceilingPanel(11.5, 21.0, true, 'corridor', false, 0.3, 1.2, [7, 6.8, 6.4]);
  add({ c: [4.14, 2.47, 9.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });        // exit sign over the fire exit
  add({ c: [11.4, 2.47, 23.86], h: [0.3, 0.12, 0.02], albedo: C.white, emissive: [0.3, 3.2, 0.6] });      // … and over the staff door
  // (NOTHING LOOSE in a corridor or within a leaf's length of a door: men walking the wall bulldoze a carton along it — two of them, set down at x 24, were
  // found 10 m east wedged in the d_n doorway with the team stuck behind the leaf; play-through seed 80 of the first tally)
  wallArt(16.0, 1.6, 10.925, 1.6, 0.9, [0.3, 0.26, 0.2], true);
  add({ c: [12.92, 1.3, 15.5], h: [0.02, 0.4, 0.6], albedo: [0.2, 0.35, 0.3] });                           // notice board on the hall wall

  // ---------------- the manager's office (x 4..10, z 11..17): mgr_e on the west corridor, off into the front office; a window on the west face ----------------
  grp('manager');
  desk(6.6, 12.1, 1.8, 0.8, 0); monitor(6.6, 12.0, 0, true); chair(6.6, 13.0, 0); papers(7.2, 0.76, 12.2, 0.3);
  cabinet(9.55, 11.6, Math.PI / 2); cabinet(9.55, 12.2, Math.PI / 2);
  plant(4.7, 11.7); rug(7.0, 14.6, 3.0, 2.0, C.carpetRed);
  chair(5.0, 13.4, 1.2);                                                                                            // the visitor's chair, by the window
  ceilingPanel(7.0, 14.0, false, 'offices');

  // ---------------- the front office (x 4..10, z 17..24): fo_e on the west corridor, off from the manager's; a window on the west face ----------------
  grp('front');
  desk(8.2, 18.2, 1.6, 0.8, 0); monitor(8.2, 18.1, 0, false); chair(8.2, 19.1, 0);
  desk(6.4, 23.3, 1.8, 0.75, Math.PI); monitor(6.4, 23.4, Math.PI, true); chair(6.4, 22.5, Math.PI); papers(7.0, 0.76, 23.3, 0.2);
  cabinet(9.55, 20.2, Math.PI / 2); cabinet(9.55, 20.8, Math.PI / 2);
  bin(4.5, 23.5); cardboardBox(4.6, 17.6, 0.5, 0.2);
  ceilingPanel(7.0, 20.5, true, 'offices');

  // ---------------- the hall (x 13..30, z 11..24): two rows of racking, three lanes ----------------
  // Row A (z 14..15): x 15.5..19.7 and 21.7..25.9. Row B (z 19..20): x 15.5..18.3 and 20.3..25.9. The cross gaps are 2 m; the two overlap on x 19.7..20.3 only.
  grp('hall');
  racking(15.5, 14.5, 'FLF'); racking(21.7, 14.5, 'LFU');
  racking(15.5, 19.5, 'FU'); racking(20.3, 19.5, 'LFFL');
  pallet(16.0, 11.7, 1.2, 1.0);                                   // the north lane: one pallet on the wall, west of the north door
  pallet(17.2, 16.3, 1.2, 1.0); pallet(23.4, 17.6, 1.0, 1.2);    // the middle lane
  crate(21.0, 16.4, 1.2, 1.2);
  shelf(18.0, 23.5, 2.6, 0.5, 0, 4, 2.0); pallet(22.4, 23.2, 1.2, 1.0);   // the south lane: shelving and a pallet on the south wall
  crate(27.4, 17.4, 1.2, 1.2);                                    // the marshalling floor by the dock wall (x 26..30): a tall crate between the two dock doors' lines …
  // … and a forklift, parked nose west (static: a mast nobody sees through, a body a man kneels behind)
  add({ c: [27.5, 0.5, 19.7], h: [0.75, 0.42, 0.5], albedo: [0.75, 0.55, 0.08], rough: 0.5 }); add({ c: [26.85, 1.1, 19.7], h: [0.06, 1.1, 0.42], albedo: [0.12, 0.12, 0.13] });
  add({ c: [27.8, 1.5, 19.7], h: [0.4, 0.04, 0.45], albedo: [0.12, 0.12, 0.13] }); for (const s of [-0.4, 0.4]) add({ c: [28.15, 1.2, 19.7 + s], h: [0.03, 0.3, 0.03], albedo: [0.12, 0.12, 0.13] });
  cardboardBox(15.4, 23.4, 0.55, 0.2); cardboardBox(29.4, 23.3, 0.55, -0.2); bin(13.5, 11.5);
  ceilingPanel(16.5, 12.5, true, 'hall'); ceilingPanel(26.0, 12.5, false, 'hall');
  ceilingPanel(21.0, 17.0, true, 'hall', true); ceilingPanel(28.2, 16.2, true, 'hall');
  ceilingPanel(17.0, 22.0, false, 'hall'); ceilingPanel(24.5, 22.0, true, 'hall');

  // ---------------- the dock (x 30..36, z 11..24): d_n from the north corridor, hd_n / hd_s from the hall, dock_n / dock_s on the east face ----------------
  grp('dock');
  pallet(34.9, 16.0, 1.2, 1.0); pallet(34.9, 18.6, 1.2, 1.0);    // staged against the shutters
  crate(32.6, 17.6, 1.2, 1.2);                                    // a tall crate in the middle of the floor
  pallet(30.8, 16.6, 1.0, 1.2);
  cardboardBox(34.75, 17.35, 0.55, 0.2); cardboardBox(35.4, 17.3, 0.5, 0.3); bin(35.5, 11.5);   // (both cartons between the shutters' pallets, a nook nobody walks: the first stood in the north-west corner, on the last place of the file four men take along the west wall for the hall door, and wedged there it held the fourth man off his mark)
  add({ c: [33.0, 1.6, 23.86], h: [0.8, 0.45, 0.02], albedo: [0.2, 0.3, 0.38] });                          // a board on the south wall
  ceilingPanel(33.0, 13.6, true, 'dock', false, 1.2, 0.6, [8, 7.6, 6.9]); ceilingPanel(33.0, 21.0, false, 'dock');
  add({ c: [35.86, 2.47, 13.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });      // exit signs over the dock's doors
  add({ c: [35.86, 2.47, 21.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });

  // ---------------- exterior ----------------
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3, on = true) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, albedo: [0.16, 0.17, 0.18] });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: on ? [40, 24, 7] : [0, 0, 0], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: [dir[0] * 0.35, -1, dir[2] * 0.35], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name, group: 'exterior', enabled: on, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true });
  };
  lampAt(38.9, 17.3, 'yard_lamp_e', [-1, 0, 0]);          // over the dock's apron: both dock doors stand in its pool
  lampAt(1.2, 15.5, 'yard_lamp_w', [1, 0, 0]);            // the west face: both offices' windows look onto its strip of verge, and the fire exit stands in it; the team's start and the plant room's door (north face) are past its reach. (It stood on the north side, x 27, until the placement pass: the north is now all dark, the west verge is not a free place to shoot the offices from)
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
  // the dock's apron: two trailers' worth of pallets left out, cover on the way round to the east face
  grp('exterior.yard');
  pallet(38.4, 11.4, 1.2, 1.0); pallet(38.6, 23.0, 1.0, 1.2); crate(38.6, 24.6, 1.2, 1.2);
  pallet(15.0, 26.6, 1.2, 1.0);                                                                      // … and one by the south wall

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(21.0, 9.0); beacon(11.5, 18.0); beacon(20.6, 17.6); beacon(33.0, 17.0);

  const doorDefs: LevelDoorDef[] = [
    // the five ways in
    { name: 'staff', hinge: [10.82, 24.0], closedDir: 0, width: 1.16, exterior: true },         // south face → the west corridor's foot
    { name: 'fire_exit', hinge: [4.0, 8.82], closedDir: Math.PI / 2, width: 1.16, exterior: true },   // west face → the north corridor's west end
    { name: 'plant_ext', hinge: [5.82, 4.0], closedDir: 0, width: 1.16, exterior: true, angle: 0.5, closer: false },   // north face → the plant room; left ajar: the plant room's flickering panel shows through the gap on the dark north side — the way in nobody holds
    { name: 'dock_n', hinge: [36.0, 12.82], closedDir: Math.PI / 2, width: 1.16, exterior: true },    // east face → the dock, north end
    { name: 'dock_s', hinge: [36.0, 20.82], closedDir: Math.PI / 2, width: 1.16, exterior: true },    // east face → the dock, south end
    // the north rooms, onto the north corridor
    { name: 'p_s', hinge: [6.82, 8.0], closedDir: 0, width: 1.16 },                             // the plant room
    { name: 'l_s', hinge: [14.82, 8.0], closedDir: 0, width: 1.16 },                            // the lockers
    { name: 'b_s', hinge: [19.82, 8.0], closedDir: 0, width: 1.16 },                            // the break room
    { name: 'c_s', hinge: [26.82, 8.0], closedDir: 0, width: 1.16 },                            // the tool cage
    { name: 'o_s', hinge: [31.82, 8.0], closedDir: 0, width: 1.16, swing: 1 },                  // the shipping office; opens OUT into the north corridor: no wedge holds it, so the shipping office and the tool cage behind `co` always have a way in (tools/qa/second-way-check.ts). The cage's own door, the one the team comes to first, stays theirs to wedge
    { name: 'lb', hinge: [17.0, 5.82], closedDir: Math.PI / 2, width: 1.16 },                   // the lockers ↔ the break room
    { name: 'co', hinge: [30.0, 5.82], closedDir: Math.PI / 2, width: 1.16 },                   // the tool cage ↔ the shipping office
    // the offices, onto the west corridor
    { name: 'mgr_e', hinge: [10.0, 13.82], closedDir: Math.PI / 2, width: 1.16, swing: -1 },    // the manager's office; opens OUT into the west corridor, for the same reason: the two offices always have a way in, and the front office's door by the staff door stays theirs to wedge
    { name: 'fo_e', hinge: [10.0, 21.82], closedDir: Math.PI / 2, width: 1.16 },                // the front office
    { name: 'off', hinge: [5.82, 17.0], closedDir: 0, width: 1.16 },                            // the manager's office ↔ the front office
    // the hall and the dock
    { name: 'h_sw', hinge: [13.0, 18.82], closedDir: Math.PI / 2, width: 1.16 },                // west corridor → the hall
    { name: 'h_n', hinge: [21.82, 11.0], closedDir: 0, width: 1.16 },                           // north corridor → the hall
    { name: 'hd_n', hinge: [30.0, 13.82], closedDir: Math.PI / 2, width: 1.16 },                // the hall ↔ the dock, north
    { name: 'hd_s', hinge: [30.0, 20.82], closedDir: Math.PI / 2, width: 1.16 },                // the hall ↔ the dock, south
    { name: 'd_n', hinge: [32.82, 11.0], closedDir: 0, width: 1.16 },                           // north corridor → the dock
  ];
  for (const d of doorDefs) doorFrame(d);

  // ---------------- LIVED-IN ROOMS (src/scene/lived.ts: left out by the loader with the switch off) ----------------
  // A bonded customs shed. THE SHED IS GREY AND YELLOW, AND THE ONLY BRIGHT COLOURS IN IT ARE THE THINGS THAT WERE SEIZED, in three places with three jobs: the
  // bulk locked up on the cage's shelf tops, one opened carton on the hall's examining table, and a few small pieces (his cut) beside the chief's safe. Every place gets one thing only it has, the clutter of that use, a floor of its own
  // and something loose. Additions only, the TAIL of the boxes and of the props; no light, nothing lit.
  // WHERE THINGS STAND: the camera looks north-north-east, so what a room is known by stands on its NORTH or EAST wall, mid floor, or on top of tall furniture;
  // a south or west wall takes filler only. Kept clear: 1.1 m off every door line and the leaves' sweeps, 2.1 m of bare wall beside every door's free jamb, the
  // floor inside a held room's doors (nothing over knee height but the two low islands the adviser's paper placed), the defenders' marks and their aim lines.
  // Things a man walks over are drawn only (NoShadow). ONE NOUN, ONE ROOM: one scale (the dock's), one safe and one sofa (the chief's), one wire cage (the lock-up's; its red floor line is drawn once more, round the impounded car, and its red bands the detained container), vests and helmets
  // in the porters' room only, paper in towers and tied bundles in the manifest office only. tools/levels/livedKit.ts has the shared pieces; what only this level has is a few lines here.
  {
    const L = livedKit(K), P = L.P, NS = BoxFlag.NoShadow;
    const YEL: Vec3 = [0.75, 0.55, 0.08], CREAM: Vec3 = [0.78, 0.74, 0.6], BOARD: Vec3 = [0.2, 0.35, 0.3], TEA: Vec3 = [0.75, 0.6, 0.3];
    // what was seized: bolts of cloth, whisky. Nothing the house owns wears these
    const MAG: Vec3 = [0.62, 0.1, 0.38], TURQ: Vec3 = [0.05, 0.45, 0.45], SAFF: Vec3 = [0.88, 0.5, 0.06], AMBER: Vec3 = [0.5, 0.28, 0.06];
    // the forms: white, carbon pink, carbon yellow (pale enough for a burst to scatter them)
    const FORMS: Vec3[] = [P.paper, [0.95, 0.68, 0.72], [0.95, 0.88, 0.5]];
    /** a box by its corners: x0, z0 → x1, z1 on the plan, y0 → y1 up */
    const B = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, albedo: Vec3, flags = 0) => slab(x0, y0, z0, x1, y1, z1, albedo, flags ? { flags } : {});
    /** cloth and paper lying on furniture: drawn only (a solid in a paint the palette does not name would break as steel) */
    const soft = (x: number, y: number, z: number, hx: number, hy: number, hz: number, albedo: Vec3, yaw = 0) => add({ c: [x, y + hy, z], h: [hx, hy, hz], yaw, albedo, flags: NS });
    /** a tower of forms on a surface at `y`: n drawn wads, each a little askew on the one below */
    const tower = (x: number, y: number, z: number, n: number, k: number) => { for (let i = 0; i < n; i++) add({ c: [x, y + 0.025 + i * 0.05, z], h: [0.1, 0.025, 0.14], yaw: (i ? 0.1 : -0.04) + (k % 3) * 0.03, albedo: FORMS[(k + i) % 3], flags: NS }); };

    // ---- plant = the generator room: the yellow set mid floor, its day tanks between boiler and vessel
    L.room('plant');
    B(5.6, 5.5, 6.25, 6.7, 0, 0.1, C.black);                                      // the generator set, mid floor beside the lane (the rack's and the breaker's floor stay free): skid,
    B(5.63, 5.55, 6.22, 6.35, 0.1, 1.15, YEL);                                    // canopy,
    for (const z of [5.66, 5.8, 5.94]) B(5.72, z, 6.13, z + 0.08, 1.15, 1.165, C.black, NS);   // three louvres in its top,
    B(5.68, 6.35, 6.17, 6.66, 0.1, 0.8, C.metal);                                 // the alternator end,
    B(5.75, 6.4, 6.1, 6.62, 0.8, 1.1, STEEL);                                     // its control box,
    L.thing(6.12, 1.15, 5.61, 0.05, 0.025, 0.05, C.red);                          // the filler cap
    B(5.66, 5.57, 5.74, 5.65, 1.15, 2.6, C.black, NS);                            // and the exhaust riser
    L.sheet(5.97, 1.15, 6.2, 0.3, 0.2, 0.08); L.thing(5.74, 1.15, 6.26, 0.07, 0.03, 0.04, P.hiVis);   // the running log (south of the louvres, off them) and the ear defenders on the canopy
    for (const x of [8.9, 9.38]) { B(x, 5.65, x + 0.42, 6.07, 0, 0.85, [0.44, 0.47, 0.44]); B(x + 0.06, 5.71, x + 0.36, 6.01, 0.85, 0.856, C.black, NS); }   // two day tanks
    B(9.84, 5.6, 9.9, 6.2, 0.6, 0.66, C.metal, NS);                               // and their line along the wall
    B(4.125, 5.30, 4.19, 7.90, 2.15, 2.25, C.metal, NS);                          // the cable tray, set → breaker
    B(9.7, 4.12, 9.86, 4.27, 0.9, 1.4, C.red, NS); B(9.75, 4.16, 9.81, 4.22, 1.4, 1.48, C.black, NS);   // the extinguisher, hung on the north wall in the east corner (the bare wall beside the outside door's jamb is the stack's)
    L.mat(4.98, 7.15, 5.70, 7.90, C.white, 0.018); L.mat(5.03, 7.20, 5.65, 7.88, P.rubberMat, 0.024);    // the electrician's mat under the breaker
    L.mat(5.4, 5.3, 6.45, 6.9, [0.3, 0.32, 0.33], 0.02);                                                // chequer plate under the set, and a drip off its south-east corner: a thin streak and a spot, no straight edge
    add({ c: [6.3, 0.012, 7.02], h: [0.33, 0.012, 0.055], yaw: 0.62, albedo: P.oilDark, flags: NS }); add({ c: [6.62, 0.0125, 7.3], h: [0.13, 0.0125, 0.045], yaw: -0.5, albedo: P.oilDark, flags: NS });
    L.drum(8.25, 5.95);

    // ---- lockers = the porters' room: a row of yellow helmets on the locker tops, the level's only vests, flattened cartons to pray on
    L.room('lockers');
    [10.35, 10.85, 11.35, 11.85, 12.35, 13.35, 13.85].forEach((x, k) => L.thing(x, 2.0, 4.48, 0.12, 0.07, 0.14, k === 0 ? C.white : YEL));   // the helmets: the foreman's white, one missing
    soft(12.85, 2.0, 4.45, 0.16, 0.03, 0.12, P.hiVis); soft(10.4, 2.0, 6.2, 0.14, 0.03, 0.18, P.hiVis); L.thing(10.4, 2.0, 7.2, 0.2, 0.12, 0.26, C.chair);   // a vest where it should be, another and a kit bag on the west row
    for (const z of [4.6, 5.15]) L.hung(16.92, z, false, 0.4, 1.0, 1.6, P.hiVis);  // two vests on the east wall
    L.mat(10.8, 4.85, 14.0, 5.55, [0.34, 0.26, 0.17], 0.035); for (const x of [11.58, 12.38, 13.18]) L.mat(x, 4.85, x + 0.05, 5.55, C.black, 0.037);   // the duckboard: one long board (darker than a carton), dark gaps across it
    for (const x of [12.0, 13.4]) { const at = K.frameAt(x, 7.45, 0.1);           // two flattened cartons on clear floor along the south wall, a few degrees off it (the one yaw nothing else here has), sandals at their feet
      add({ c: at(0, 0.008, 0), h: [0.5, 0.008, 0.31], yaw: 0.1, albedo: C.cardboard, flags: NS });
      add({ c: at(0.66, 0.012, 0.06), h: [0.11, 0.012, 0.045], yaw: 0.1, albedo: C.black, flags: NS }); }
    L.thing(12.7, 0.45, 6.3, 0.18, 0.05, 0.14, C.chair); L.thing(12.72, 0.55, 6.3, 0.08, 0.03, 0.09, [0.1, 0.14, 0.3]);   // a folded uniform and its cap on the bench
    add({ c: [10.86, 1.0, 5.94], h: [0.19, 0.9, 0.012], yaw: 0.6, albedo: STEEL }); add({ c: [12.76, 1.0, 4.91], h: [0.012, 0.9, 0.19], yaw: 0.6, albedo: STEEL });   // two locker doors left open
    { K.prop('chair', 15.2, 5.0, 0.4, 4, [{ off: [0, 0.14, 0], h: [0.3, 0.14, 0.16], yaw: 0, albedo: C.chair }]); L.own('kitbag'); }
    L.bucket(14.3, 5.6);

    // ---- brk = the tea room: they sit at tables; red soft-drink crates and blue water bottles on the north wall, stacked chairs, an urn
    L.room('brk');
    add({ c: [20.4, 0.011, 5.7], h: [2.1, 0.011, 0.9], yaw: 0.03, albedo: [0.3, 0.4, 0.5], flags: NS });   // a faded vinyl offcut under the tables
    L.table(18.95, 5.7, 1.0, 0.8, 0, C.white, 0.74);                              // the second table: two glasses, the pot, a newspaper
    L.mug(18.7, 0.74, 5.6, TEA); L.mug(19.15, 0.74, 5.88, TEA); L.thing(18.9, 0.74, 5.48, 0.06, 0.07, 0.06, C.metal); L.sheet(19.22, 0.74, 5.6, 0.3, 0.4, 0.2);
    ([[0, 0.9], [1, 0.6], [2, 0.9]] as [number, number][]).forEach(([k, h]) => { const x = 21.5 + k * 0.46;   // the drink crates under the window's east end, beside the stacked chairs (clear of the second table's chairs), bottle tops showing
      B(x, 4.17, x + 0.42, 4.6, 0, h, C.red); B(x + 0.05, 4.22, x + 0.37, 4.55, h, h + 0.006, C.black, NS); });
    L.thing(22.17, 0.606, 4.38, 0.12, 0.2, 0.12, P.enamelBlue); L.thing(21.3, 0, 4.3, 0.12, 0.2, 0.12, P.enamelBlue); L.thing(21.02, 0, 4.32, 0.12, 0.2, 0.12, P.enamelBlue);   // three water bottles
    B(22.92, 4.17, 23.44, 4.69, 0, 0.5, C.white); B(22.92, 4.17, 23.44, 4.27, 0.5, 1.3, C.white);   // a tower of stacked plastic chairs
    L.thing(24.55, 0.95, 6.2, 0.12, 0.2, 0.12, C.metal);                          // on the counter: the urn, a tray of glasses
    B(24.3, 4.3, 24.75, 4.52, 0.95, 0.96, C.metal, NS); L.mug(24.42, 0.96, 4.41, TEA); L.mug(24.6, 0.96, 4.41, TEA);
    L.thing(24.5, 2.0, 7.3, 0.32, 0.22, 0.3, C.cardboard); L.thing(24.5, 2.44, 7.25, 0.27, 0.09, 0.04, C.black);   // on the fridge: the porters' television, still half in its box
    L.hung(18.45, 4.135, true, 1.5, 1.3, 1.9, C.white, 0.03); L.hung(18.45, 4.156, true, 1.5, 1.75, 1.9, C.partRed, 0.012);   // the calendar
    L.chair(18.95, 4.98, 0); L.chair(18.95, 6.45, Math.PI);
    { K.prop('cardboard', 20.45, 4.45, 0.1, 5, [{ off: [0, 0.15, 0], h: [0.2, 0.15, 0.15], yaw: 0, albedo: C.red }]); L.own('crate'); }

    // ---- cage = the bond lock-up: a padlocked wire cage round what is held (bottles, cigarettes, a boxed screen, each tagged), inside the level's one red line; the bulk of what was seized on the shelf TOPS
    L.room('cage');
    // what is held, on the floor (carried in a piece at a time: the gate takes a carton, not a pallet), mixed, each piece with its paper tag:
    B(26.86, 6.1, 27.2, 6.4, 0, 0.32, C.cardboard); B(26.92, 6.15, 27.14, 6.33, 0.32, 0.4, AMBER, NS); L.sheet(27.13, 0.32, 6.36, 0.08, 0.12, 0.3);   // an opened carton of bottles,
    B(26.86, 6.5, 27.16, 6.7, 0, 0.14, [0.82, 0.68, 0.15]); B(26.9, 6.52, 27.2, 6.62, 0.14, 0.28, [0.1, 0.25, 0.6]); L.sheet(26.98, 0.28, 6.57, 0.08, 0.12, -0.2);   // bricks of cigarette cartons, gold and blue,
    B(27.34, 6.12, 27.48, 6.7, 0, 0.45, C.cardboard); B(27.38, 6.16, 27.44, 6.66, 0.45, 0.52, C.black, NS); B(27.33, 6.3, 27.49, 6.38, 0.52, 0.526, P.paper, NS);   // a boxed screen stood on its edge
    L.papers(29.47, 0.76, 4.52, 0.1);                                              // the register lies open OUTSIDE the cage, on the bench beside the seal press
    // THE CAGE (x 26.75..27.75, z 6.0..6.8: clear of the two aim lines that pass its north-east and south-east corners): four posts a man cannot walk through,
    for (const x of [26.75, 27.69]) for (const z of [6.0, 6.74]) B(x, z, x + 0.06, z + 0.06, 0, 1.8, STEEL);
    for (const [y0, y1] of [[0.9, 0.94], [1.74, 1.8]]) {                           // drawn rails at the waist and the head,
      for (const z of [6.015, 6.755]) B(26.81, z, 27.69, z + 0.03, y0, y1, C.metal, NS);
      for (const x of [26.765, 27.705]) B(x, 6.06, x + 0.03, 6.74, y0, y1, C.metal, NS); }
    for (const x of [26.98, 27.235, 27.49]) B(x, 6.06, x + 0.03, 6.74, 1.76, 1.78, C.black, NS);   // mesh over the top, both ways,
    for (const z of [6.27, 6.5]) B(26.81, z, 27.69, z + 0.03, 1.76, 1.78, C.black, NS);
    for (const x of [27.04, 27.46]) B(x, 6.77, x + 0.03, 6.8, 0.1, 1.74, C.metal, NS);            // the gate leaf in the south face,
    B(27.42, 6.8, 27.56, 6.87, 0.95, 1.1, P.brass, NS); B(27.5, 6.87, 27.57, 6.876, 0.78, 0.95, P.paper, NS);   // its brass padlock and the seal tag
    L.mat(26.6, 5.85, 27.9, 5.93, C.red, 0.02); L.mat(26.6, 6.87, 27.9, 6.95, C.red, 0.02); L.mat(26.6, 5.93, 26.68, 6.87, C.red, 0.02); L.mat(27.82, 5.93, 27.9, 6.87, C.red, 0.02);   // the bond line
    B(25.8, 4.3, 27.0, 4.48, 1.96, 2.14, MAG, NS); B(25.9, 4.52, 27.1, 4.7, 1.96, 2.14, TURQ, NS); B(26.1, 4.4, 27.2, 4.58, 2.14, 2.3, SAFF, NS);   // north shelf top: three bolts of cloth (cloth: drawn only),
    B(27.4, 4.3, 28.2, 4.7, 1.96, 2.45, C.white); B(27.7, 4.294, 27.9, 4.706, 1.96, 2.456, C.chair, NS);                                // boxed television sets
    B(25.2, 5.2, 25.62, 5.7, 1.96, 2.3, C.cardboard); B(25.2, 5.74, 25.62, 6.2, 1.96, 2.26, C.cardboard);                               // west shelf top: whisky cartons,
    B(25.22, 6.3, 25.4, 7.4, 1.96, 2.14, SAFF, NS); B(25.43, 6.4, 25.61, 7.4, 1.96, 2.14, MAG, NS);                                             // two more bolts
    L.thing(29.67, 0.76, 4.5, 0.05, 0.09, 0.06, C.red); B(28.92, 4.42, 29.3, 4.62, 0.76, 0.775, C.metal, NS);   // on the bench: the seal press, a tray of lead seals
    { K.prop('cardboard', 27.7, 5.15, 0.15, 8, [{ off: [0, 0.2, 0], h: [0.25, 0.2, 0.2], yaw: 0, albedo: C.cardboard }, { off: [0.1, 0.2, 0], h: [0.06, 0.206, 0.09], yaw: 0, albedo: P.paper }]); L.own('case'); }

    // ---- ship = the manifest office: PAPER. Tied bundles on open shelves up the north and east walls and stacked on the floor before them, a second clerk's
    // desk as an island with towers of forms, a green lino offcut under it (no other room has one)
    L.room('ship');
    { const TIE = C.cardboard, GREEN: Vec3 = [0.16, 0.27, 0.2];
      L.mat(31.0, 5.3, 32.85, 6.45, GREEN, 0.018);
      L.table(31.9, 5.85, 1.4, 0.7, 0, C.wood, 0.76);
      for (const z of [5.54, 5.92]) B(31.85, z, 32.17, z + 0.24, 0.76, 0.775, C.black, NS);   // an IN tray (full) and an OUT tray (one set) just past the typewriter, 0.6 m from the typist's chair,
      tower(32.01, 0.775, 5.66, 2, 0); tower(32.01, 0.775, 6.04, 1, 2);
      L.thing(32.4, 0.76, 5.85, 0.1, 0.05, 0.13, C.black); L.thing(31.5, 0.76, 6.0, 0.08, 0.03, 0.04, C.woodDark); L.thing(31.5, 0.76, 5.7, 0.05, 0.012, 0.04, C.red);   // the typewriter square in front of the typist's chair at the east end, the stamps and the ink pad beyond the trays
      tower(33.6, 0.76, 4.98, 2, 1); tower(33.6, 0.76, 4.6, 1, 0);                 // the first desk's towers
      // open shelves, floor to head height: the east wall north of the desk's end …
      B(35.45, 4.2, 35.88, 5.7, 0, 1.9, C.woodDark);
      for (const y of [0.3, 0.85, 1.4]) B(35.438, 4.25, 35.45, 5.65, y, y + 0.4, P.paper, NS);
      B(35.5, 4.3, 35.84, 5.6, 1.9, 2.05, P.paper, NS); for (const z of [4.75, 5.2]) B(35.494, z, 35.846, z + 0.04, 1.9, 2.056, TIE, NS);
      // … and the north wall: a full-height bay beside the desk, a hung shelf on over the level's own cabinets (above what the dressing stands on them)
      B(32.85, 4.15, 33.35, 4.5, 0, 1.9, C.woodDark);
      for (const y of [0.3, 0.85, 1.4]) B(32.9, 4.5, 33.3, 4.512, y, y + 0.4, P.paper, NS);
      B(32.9, 4.18, 33.3, 4.47, 1.9, 2.05, P.paper, NS); B(33.08, 4.174, 33.12, 4.476, 1.9, 2.056, TIE, NS);
      B(31.55, 4.13, 32.85, 4.43, 1.8, 1.83, C.woodDark, NS); B(31.6, 4.15, 32.8, 4.41, 1.83, 2.05, P.paper, NS);
      for (const x of [32.0, 32.4]) B(x, 4.144, x + 0.04, 4.416, 1.83, 2.056, TIE, NS);
      // bundles waiting on the floor at the foot of the east shelves (the cabinets' drawers open onto clear floor)
      B(35.5, 5.8, 35.86, 6.12, 0, 0.4, C.cardboard); B(35.5, 5.8, 35.86, 6.12, 0.4, 0.42, P.paper, NS); B(35.494, 5.94, 35.866, 5.98, 0, 0.426, TIE, NS);   // (board backed: a bundle breaks as board)
      B(35.5, 6.18, 35.86, 6.5, 0, 0.26, C.cardboard); B(35.5, 6.18, 35.86, 6.5, 0.26, 0.28, P.paper, NS); B(35.494, 6.32, 35.866, 6.36, 0, 0.286, TIE, NS);
      ([[31.2, 5.0, 0.4], [33.5, 6.6, 0.7]] as [number, number, number][]).forEach(([x, z, yaw], k) => L.sheet(x, 0, z, 0.21, 0.3, yaw, FORMS[k % 3]));   // trodden forms
      L.chair(33.0, 5.85, -Math.PI / 2);                                          // the typist's chair at the east end (the long south side is inside the door's 1.4 m: no seat may stand there)
      { K.prop('cardboard', 33.75, 6.3, 0.2, 4, [{ off: [0, 0.12, 0], h: [0.17, 0.12, 0.22], yaw: 0, albedo: P.paper }, { off: [0, 0.123, 0], h: [0.176, 0.126, 0.025], yaw: 0, albedo: TIE }]); L.own('bundle'); } }

    // ---- mgr = the chief's office: the safe on the north wall and beside it HIS CUT (a few small pieces, none the cage's rolls or boxed sets); the level's one sofa
    L.room('mgr');
    B(7.75, 11.1, 8.45, 11.7, 0, 1.2, [0.15, 0.2, 0.17]);                         // the safe: its door, a brass wheel,
    B(7.8, 11.7, 8.4, 11.712, 0.08, 1.12, [0.1, 0.14, 0.12], NS); B(8.04, 11.712, 8.16, 11.722, 0.56, 0.68, P.brass, NS);
    L.thing(8.0, 1.2, 11.4, 0.14, 0.035, 0.1, [0.3, 0.12, 0.1]); L.thing(8.28, 1.2, 11.38, 0.04, 0.07, 0.04, P.brass);   // a ledger and a brass bell on it
    B(8.55, 11.14, 8.95, 11.5, 0, 0.4, C.cardboard); for (const x of [8.66, 8.78, 8.9]) L.thing(x, 0.4, 11.3, 0.035, 0.11, 0.035, AMBER);   // his cut, between safe and cabinets: an opened carton of bottles,
    B(8.98, 11.14, 9.2, 11.36, 0, 0.3, SAFF); L.thing(9.09, 0.3, 11.25, 0.09, 0.12, 0.09, SAFF, 0.5);                                       // two tins of ghee,
    soft(8.76, 0, 11.63, 0.17, 0.05, 0.1, TURQ, 0.15);                                                                                   // a folded length of cloth
    B(7.12, 11.76, 7.42, 11.96, 0.76, 0.77, C.metal, NS); L.mug(7.2, 0.77, 11.86, TEA); L.mug(7.34, 0.77, 11.86, TEA);   // tea for two on his desk
    L.hung(6.6, 11.075, true, 1.2, 1.5, 2.2, C.woodDark, 0.03); L.hung(6.6, 11.096, true, 1.0, 1.6, 2.1, CREAM, 0.012);   // the portrait behind it
    B(4.15, 14.05, 4.70, 15.69, 0, 0.42, C.chair); B(4.16, 14.06, 4.30, 15.68, 0.42, 0.80, C.chair);   // the sofa, south of the level's own visitor's chair
    for (const z of [14.06, 15.54]) B(4.30, z, 4.69, z + 0.14, 0.42, 0.60, C.chair);
    L.thing(4.44, 0.42, 14.5, 0.1, 0.08, 0.18, C.partRed);
    L.sheet(5.05, 0, 15.05, 0.4, 0.3, 0.4); for (const z of [15.8, 15.94]) B(4.3, z, 4.54, z + 0.1, 0, 0.05, C.woodDark, NS);   // a newspaper and his slippers
    L.stool(7.85, 12.75);                                                         // the caller's stool at the desk's end (clear of the cabinets' drawers)

    // ---- front = the cashier's office: a row of waiting seats, the cashier's counter with its brass grille before the cash desk, the queue's worn strip from
    // the corridor door to it, the copier on the east wall
    L.room('front');
    { B(4.3, 19.34, 4.55, 20.86, 0, 0.38, C.metal);                               // four moulded seats on one rail, 1.56 m
      for (let k = 0; k < 4; k++) { const z = 19.32 + k * 0.4; B(4.2, z, 4.65, z + 0.34, 0.38, 0.45, CREAM); B(4.2, z, 4.27, z + 0.34, 0.45, 0.8, CREAM); } }
    L.sheet(4.44, 0.45, 19.9, 0.22, 0.3, 0.1);                                    // a newspaper left on one
    B(9.25, 18.7, 9.9, 19.4, 0, 1.0, C.white); L.thing(9.58, 1.0, 19.05, 0.26, 0.02, 0.24, [0.3, 0.33, 0.36]); L.sheet(9.58, 1.04, 19.0);   // the copier
    L.thing(8.75, 0.76, 18.2, 0.15, 0.09, 0.15, C.black);                          // on the desk: the till
    // the counter: from the east wall (its end shut by the level's own cabinets) west to x 7.75, where every mark's aim line onto the manager's door passes clear
    // of it (4 cm at the nearest), then the clerk's way in between its end and the cash desk's corner: the flap stood up, the low gate swung open, both drawn
    // only (the floor behind the counter must stay one floor with the room's)
    B(7.75, 19.55, 9.94, 19.88, 0, 0.96, C.woodDark); B(7.72, 19.52, 9.94, 19.89, 0.96, 1.0, CREAM);
    B(7.72, 19.52, 7.94, 19.55, 1.0, 1.9, CREAM, NS); B(7.79, 19.51, 8.7, 19.55, 0.08, 0.92, C.woodDark, NS);   // (the flap stood up on its hinge, the gate swung back against the counter: nobody walks through either)
    for (const x of [7.75, 8.45, 9.2, 9.91]) B(x, 19.86, x + 0.03, 19.89, 1.0, 1.6, P.brass, NS); B(7.75, 19.86, 9.94, 19.89, 1.6, 1.63, P.brass, NS);   // its grille, on the public side
    L.thing(8.3, 1.0, 19.68, 0.1, 0.05, 0.08, C.red);                              // on it: the cash box,
    B(8.5, 19.58, 8.76, 19.82, 1.0, 1.012, C.woodDark, NS);                        // the coin tray, a metal to each cell,
    ([[19.63, P.brass], [19.7, C.metal], [19.77, [0.6, 0.35, 0.2]]] as [number, Vec3][]).forEach(([z, c]) => B(8.53, z - 0.028, 8.73, z + 0.028, 1.012, 1.02, c, NS));
    L.thing(8.9, 1.0, 19.62, 0.012, 0.08, 0.012, C.metal); L.thing(8.92, 1.0, 19.78, 0.04, 0.03, 0.03, C.woodDark);   // the receipt spike, the stamp,
    B(9.04, 19.57, 9.2, 19.61, 1.0, 1.42, C.white, NS);                                                              // the queue's number board
    { const WORN: Vec3 = [0.12, 0.12, 0.14];                                        // the queue's wear, door → counter: three ragged patches, darker than the floor, no straight run
      add({ c: [9.15, 0.01, 22.38], h: [0.7, 0.01, 0.3], yaw: 0.14, albedo: WORN, flags: NS }); add({ c: [8.72, 0.0105, 21.3], h: [0.33, 0.0105, 0.55], yaw: -0.22, albedo: WORN, flags: NS });
      add({ c: [8.55, 0.011, 20.35], h: [0.48, 0.011, 0.3], yaw: 0.09, albedo: WORN, flags: NS }); }
    L.carton(9.45, 17.5, 0.45, 0.2);

    // ---- hall = the bonded floor: the examining table (one opened carton: the only bright things on this floor), the yellow rolling stair on the north wall,
    // the forklift's charger on the wall behind where it is parked, its lead coiled; a pallet of sealed cases held back in a yellow bay on the south wall
    L.room('hall');
    L.table(27.4, 12.9, 1.6, 0.9, 0, C.metal, 0.9);                               // the examining table: a crate opened on it, its lid, straw, what was in it
    B(26.85, 12.5, 27.75, 13.3, 0.9, 0.905, [0.7, 0.6, 0.3], NS); B(27.0, 12.6, 27.6, 13.1, 0.905, 1.22, C.wood); B(27.78, 12.55, 28.14, 13.0, 0.9, 0.93, C.woodDark);
    soft(27.3, 0.905, 13.22, 0.3, 0.05, 0.06, MAG); soft(26.72, 0.9, 12.9, 0.06, 0.05, 0.2, TURQ); soft(27.3, 1.22, 12.85, 0.2, 0.03, 0.15, SAFF);
    B(17.0, 11.12, 17.35, 11.8, 0, 0.5, YEL); B(17.35, 11.12, 17.7, 11.8, 0, 1.0, YEL); B(17.7, 11.12, 18.05, 11.8, 0, 1.5, YEL); B(18.05, 11.12, 18.4, 11.8, 0, 2.0, YEL);   // the rolling stair
    B(18.05, 11.12, 18.4, 11.16, 2.0, 2.5, C.black, NS);
    B(29.64, 18.8, 29.94, 19.6, 0, 1.3, C.metal); B(29.63, 18.95, 29.64, 19.45, 0.8, 1.2, C.black, NS);   // the charger on the dock wall, behind the level's own forklift,
    B(29.6, 19.0, 29.64, 19.3, 0.4, 0.75, C.black, NS);                           // its lead coiled on its side (nothing across the lane)
    B(19.9, 22.62, 21.1, 23.82, 0, 0.12, C.woodDark); B(19.94, 22.66, 21.06, 23.78, 0.12, 0.8, C.cardboard);   // the held pallet, in a bay on the south wall between the level's shelving and its pallet (2.6 m of lane left): plain sealed cases,
    B(20.46, 22.654, 20.54, 23.786, 0.12, 0.806, C.black, NS); B(19.934, 23.18, 21.066, 23.26, 0.12, 0.806, C.black, NS);   // strapped both ways,
    L.mat(19.75, 22.47, 21.25, 22.53, YEL, 0.02); L.mat(19.75, 22.53, 19.81, 23.86, YEL, 0.02); L.mat(21.19, 22.53, 21.25, 23.86, YEL, 0.02);   // the bay's three lines, the shed's own yellow
    for (const x of [15.22, 26.04]) for (const z of [14.43, 19.43]) B(x, z, x + 0.14, z + 0.14, 0, 0.9, YEL);   // a bollard at each rack end
    L.drum(18.9, 11.5); L.drum(19.55, 11.5);

    // ---- dock = the receiving dock: what comes off a truck is tallied at the standing desk, weighed on the level's one scale by the north door, and wheeled
    // off on the sack trucks parked under the south wall's board, the pallet jack beside them
    L.room('dock');
    B(30.15, 17.5, 30.7, 18.7, 0, 0.95, C.wood); B(30.13, 17.48, 30.72, 18.72, 0.95, 1.0, C.black);   // the tally clerk's standing desk (west wall: filler)
    L.papers(30.42, 1.0, 17.9, 0); L.mug(30.5, 1.0, 18.5, TEA);
    L.mat(30.95, 11.4, 32.45, 12.6, C.metal, 0.02);                               // the platform scale in the floor inside the corridor door: plate, white edge (yellow is the held bay's),
    L.mat(30.87, 11.32, 32.53, 11.4, C.white); L.mat(30.87, 12.6, 32.53, 12.68, C.white); L.mat(30.87, 11.4, 30.95, 12.6, C.white); L.mat(32.45, 11.4, 32.53, 12.6, C.white);
    B(31.3, 11.08, 31.55, 11.3, 0, 1.3, C.metal); L.thing(31.425, 1.3, 11.19, 0.15, 0.2, 0.1, C.white);   // its dial post on the north wall
    for (let k = 0; k < 3; k++) { const x = 32.3 + k * 0.5;                        // three sack trucks on the south wall: frame, axle, toe plate
      B(x, 23.77, x + 0.4, 23.87, 0.19, 1.13, YEL); B(x - 0.03, 23.62, x + 0.43, 23.86, 0, 0.19, C.black); B(x + 0.02, 23.4, x + 0.38, 23.62, 0.02, 0.07, C.metal); }
    // the pallet jack, parked west of them: mast against the south wall, forks out into the room and stopping short of the corner mark's line onto the yard's south door
    { K.prop('bin', 31.9, 23.33, 0, 14, [{ off: [-0.14, 0.05, -0.1], h: [0.07, 0.04, 0.45], yaw: 0, albedo: YEL }, { off: [0.14, 0.05, -0.1], h: [0.07, 0.04, 0.45], yaw: 0, albedo: YEL },
        { off: [0, 0.3, 0.42], h: [0.2, 0.3, 0.08], yaw: 0, albedo: YEL }, { off: [0, 0.78, 0.46], h: [0.03, 0.2, 0.03], yaw: 0, albedo: C.black }]); L.own('jack'); }
    L.stool(31.15, 18.1);

    // ---- ncorr = the public corridor: wall-hung only, all on the north wall where the camera sees it. The tariff chart, the day's papers in numbered pigeon
    // holes with a sorting ledge under them, the notice board
    L.room('ncorr');
    L.hung(17.9, 8.075, true, 3.0, 1.0, 1.9, CREAM, 0.03);                         // the tariff chart: three metres of it, a coloured head to each column
    ([[16.75, C.red], [17.5, P.enamelBlue], [18.25, BOARD], [19.0, C.black]] as [number, Vec3][]).forEach(([x, c]) => L.hung(x, 8.106, true, 0.6, 1.72, 1.86, c, 0.012));
    L.hung(24.4, 8.13, true, 2.6, 1.0, 1.75, C.woodDark, 0.14);                   // the pigeon holes: two rows of papers, a brass number strip over them
    for (const y of [1.06, 1.4]) L.hung(24.4, 8.206, true, 2.4, y, y + 0.24, P.paper, 0.012);
    L.hung(24.4, 8.135, true, 2.6, 1.75, 1.81, P.brass, 0.15);
    B(23.1, 8.06, 25.7, 8.28, 0.9, 0.94, C.woodDark, NS);                          // the sorting ledge under them, a hand deep at the waist (drawn only and shallow: a corridor keeps its width), three stacks of forms waiting on it
    [23.5, 24.3, 25.1].forEach((x, k) => B(x, 8.08, x + 0.3, 8.26, 0.94, 1.0 + k * 0.03, FORMS[k], NS));
    L.hung(9.5, 8.075, true, 2.2, 1.1, 1.9, BOARD, 0.03);                         // the notice board
    [8.8, 9.5, 10.2].forEach((x, k) => L.hung(x, 8.096, true, 0.3, 1.3 + (k % 2) * 0.08, 1.75 + (k % 2) * 0.08, k === 1 ? FORMS[2] : P.paper, 0.012));
    // a docket trolley left in the corridor's dead east end, past both doors there (2.5 m from either's line, on nobody's walk). FIXED, not loose: the
    // level's own rule above (nothing loose in a corridor: a carton was once carried into the d_n doorway)
    L.thing(35.5, 0.13, 9.5, 0.28, 0.03, 0.44, C.metal); L.thing(35.5, 0.6, 9.5, 0.28, 0.02, 0.44, C.metal); L.thing(35.5, 0.05, 9.04, 0.28, 0.45, 0.02, C.metal);
    soft(35.5, 0.19, 9.54, 0.2, 0.11, 0.3, P.paper); soft(35.5, 0.64, 9.6, 0.17, 0.08, 0.22, P.paper);

    // ---- wcorr = the staff way: clocking in. The clock between an IN and an OUT rack of cards, the coir mat and wet boot prints from the staff door
    L.room('wcorr');
    L.hung(12.92, 21.0, false, 0.3, 1.5, 1.8, C.white);                           // the clock,
    for (const z of [20.4, 21.6]) { L.hung(12.92, z, false, 0.5, 1.1, 1.7, C.woodDark); L.hung(12.895, z, false, 0.4, z < 21 ? 1.4 : 1.2, 1.6, P.paper, 0.012); }   // the OUT rack (a few cards) and the IN rack (full)
    L.mat(10.85, 22.95, 12.0, 23.8, C.woodDark);                                  // the coir mat inside the staff door
    for (let k = 0; k < 2; k++) { const x = 11.1 + (k % 2) * 0.4, z = 22.5 - k * 0.5; L.mat(x, z, x + 0.12, z + 0.28, P.oilDark, 0.012); }   // boot prints leading in

    // ---- the loading apron, east: chocks in the bays, bumpers under the shutters; the checker's hut on the east edge at the lane's south end, its boom raised
    L.room('apron_e');
    for (const z of [15.1, 17.0, 17.55, 19.45]) B(36.35, z, 36.6, z + 0.15, 0, 0.16, YEL, NS);   // a pair of chocks 1.9 m apart at each bay's head, by the bumpers (stepped over: drawn only)
    for (const z of [15.2, 16.5, 17.8, 19.1]) B(36.152, z, 36.27, z + 0.3, 0.5, 0.9, C.black, NS);
    // the hut at the lane's SOUTH end (trucks come round the south-east corner: the north end is grass), on the yard's east edge, a pale roof, its window on the lane,
    B(39.05, 20.6, 39.95, 21.5, 0, 2.1, C.white); B(38.97, 20.52, 39.99, 21.58, 2.1, 2.3, CREAM); B(39.038, 20.75, 39.05, 21.35, 1.0, 1.7, C.screenOff, NS);
    L.mat(39.2, 20.1, 39.9, 20.58, P.rubberMat);                                  // its mat at its door (north face), clear of the post,
    B(38.72, 20.2, 38.87, 20.35, 0, 1.05, C.white); B(38.87, 20.22, 39.15, 20.33, 0.85, 1.05, C.black, NS);   // the boom: a post west of the mat and its counterweight,
    B(38.6, 20.235, 38.68, 20.315, 1.0, 3.42, C.white, NS); B(38.595, 20.23, 38.685, 20.32, 2.92, 3.42, C.red, NS);   // the pole RAISED at the post (the lane is the other way in: nobody walks through a pole), a red tip

    // ---- the south apron = the impound bay: a saloon under its dust inside a red line, a yellow clamp on its front wheel, the notice on its roof; one motorbike
    L.room('apron_s');
    { const DUST: Vec3 = [0.36, 0.32, 0.26];
      B(18.5, 24.6, 22.9, 26.2, 0.28, 0.8, DUST); B(20.0, 24.68, 21.5, 26.12, 0.8, 1.3, DUST);   // body (bonnet and boot 0.5 m under the roof), cabin,
      B(20.08, 24.78, 21.42, 26.02, 1.3, 1.306, [0.45, 0.41, 0.33], NS);
      B(21.5, 24.72, 21.95, 26.08, 0.8, 1.2, C.screenOff, NS); B(19.65, 24.72, 20.0, 26.08, 0.8, 1.2, C.screenOff, NS);   // dark glass before and behind the roof,
      B(20.5, 25.2, 21.0, 25.55, 1.306, 1.312, P.paper, NS); B(20.5, 25.2, 20.62, 25.55, 1.312, 1.316, C.red, NS);   // the notice (0.5 x 0.35), a red band across its head
      L.mat(18.2, 24.35, 23.2, 24.43, C.red, 0.02); L.mat(18.2, 26.67, 23.2, 26.75, C.red, 0.02); L.mat(18.2, 24.43, 18.28, 26.67, C.red, 0.02); L.mat(23.12, 24.43, 23.2, 26.67, C.red, 0.02);   // the bay's red line: the cage's line again, the same hand
      for (const x of [19.0, 21.8]) for (const z of [24.46, 26.14]) B(x, z, x + 0.6, z + 0.2, 0, 0.6, C.black);   // four wheels, 0.14 m proud of the body
      B(21.72, 26.34, 22.48, 26.58, 0, 0.42, YEL); B(22.0, 26.1, 22.2, 26.4, 0.6, 0.68, YEL, NS); }   // the clamp: a plate against the wheel, an arm over it
    // one motorbike along the wall, life size (1.9 x 0.7): wheels, tank and seat, the bars
    B(24.6, 24.64, 25.2, 24.76, 0, 0.6, C.black); B(25.9, 24.64, 26.5, 24.76, 0, 0.6, C.black); B(25.0, 24.55, 26.1, 24.85, 0.35, 0.85, [0.4, 0.1, 0.08]); B(25.78, 24.35, 25.86, 25.05, 0.95, 1.02, C.black, NS);

    // ---- the quiet side, north and west: a shipping container alone on the north verge; the smokers' bench against the west wall beside the fire exit
    L.room('verge');
    { const EARTH: Vec3 = [0.25, 0.21, 0.15];
      L.mat(14.6, 0.1, 21.7, 2.9, [0.4, 0.38, 0.34], 0.018);                       // THE DETAINED CONTAINER: a gravel hardstanding,
      B(15, 0.3, 21, 2.7, 0, 2.6, P.oxide);
      for (const z of [1.0, 2.0]) B(21, z - 0.03, 21.012, z + 0.03, 0.15, 2.45, C.metal, NS);   // its door bars,
      B(20.55, 0.294, 20.75, 2.706, 0, 2.606, C.red, NS);                          // the customs band round it at the door end (the cage's red: over the roof, down both sides),
      B(21.012, 0.6, 21.02, 2.4, 1.25, 1.4, C.red, NS); B(21.02, 1.44, 21.08, 1.56, 1.1, 1.26, P.brass, NS);   // the seal across its doors and a brass padlock on it
      bench(3.62, 6.9, Math.PI / 2);                                              // THE STAFF'S BENCH, its south end a stride from the fire exit,
      B(3.5, 5.8, 3.76, 6.06, 0, 0.28, C.metal); B(3.53, 5.83, 3.73, 6.03, 0.28, 0.285, C.partTan, NS);   // its bucket of sand at the north end,
      add({ c: [3.5, 0.011, 8.95], h: [0.2, 0.011, 0.5], yaw: 0.3, albedo: EARTH, flags: NS }); add({ c: [3.36, 0.0115, 8.1], h: [0.17, 0.0115, 0.42], yaw: -0.25, albedo: EARTH, flags: NS }); }   // and the wear in the grass from the west exit to the bench's south end, no further: two ragged patches
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices: [],
    breaker: { pos: [5.2, 1.35, 7.8], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [8.0, 0, 26.2],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    mission: { serverRoom: { ...R.plant }, entryDoor: 'p_s', rack: { index: DRIVE_RACK, front: rackFront, halfW: 0.33 }, exfilDoor: 'staff', exfilX: 11.4, exfilZ: 24.6 },
  };

  // ---------------- what the room clear takes from this level ----------------
  // Eleven defenders in six held rooms (maxMen: with Sam and the four that is sixteen characters, all the skinning holds). Every room gives more marks than men,
  // split between its doors. The room order is the order a scripted commander works them, each room's first door the one he tries first: from the staff door the
  // front office, the manager's office through it, the hall by its west door, the dock from the hall, then the two north-east rooms.
  // THE ELEVEN ARE PLACED BY HAND: placement seed 0, attempt 1 (roomclear.ts placeDefenders) stands each room's FIRST `garrison` marks, in the order written here,
  // so the first marks of every room are the level's one authored problem and the rest are spares a seeded deal may still draw. What the hand placement is for:
  //   THE PROBLEM  the building is a ring: whichever door the team fights at, somebody can walk round to its back. The hall's three and the dock's three each
  //                have a pair to send (one squad of one room, two to spare); the offices' three and the two store rooms hold where they are.
  //   THE OBVIOUS  the staff door, the front office, then the hall by its west door: TWO guns wait on that door from the hall's dark south-west corner and its
  //                middle lane, looking at a doorway that stands in the corridor's lit foot. The hall's east doors are the dock's men's business, not the hall's.
  //   THE DOCK     looks OUT and north: a man a yard door, each across the dock's width from his door (the south one's in the dark end, the north one's under
  //                the dock's one lit panel), the third on the north corridor's door — the back of the man on the yard's north door.
  //   THE WINDOWS  a lamp on the west face lights the verge under both offices' windows and the fire exit: the front office's man on the manager's door stands
  //                half turned to his window, so the verge is a place the offices can shoot back at, not a free one. The man on the corridor door stands beside
  //                the pane, not in front of it.
  //   THE DARK     the north side has no lamp and the plant room's outside door stands ajar on its flicker: the breaker is the tool, and the walk to it the price.
  const scenarios: LevelScenarios = {
    roomClear: {
      name: 'the warehouse', maxMen: 11,
      team: { sam: [8.0, 0, 26.2], samYaw: Math.PI / 2, ops: [[9.4, 0, 25.6], [8.6, 0, 25.4], [7.2, 0, 25.4], [6.4, 0, 25.6]], opsYaw: Math.PI / 2 },
      // THE OTHER WAY IN (`starts`: stood on only when a run asks — the mission sheet's Way in row, ?way=2, or ?way=any for a dealt one): the dark off the SOUTH-EAST corner,
      // looking up the loading apron. The apron's lamp lights both dock doors; they are eight metres apart, one pair's each on a single word. Kill the lamp
      // or cross its light. (The first spot tried, outside the plant room's own door at the north-west corner, handed the level its best answer for nothing.)
      starts: [{ sam: [36.6, 0, 26.2], samYaw: Math.PI * 0.75, ops: [[35.2, 0, 25.6], [35.2, 0, 26.8], [34.0, 0, 25.6], [34.0, 0, 26.8]], opsYaw: Math.PI * 0.75 }],
      rooms: [
        { id: 'front', name: 'front office', bounds: { ...R.front }, garrison: 2,
          doors: [{ id: 'fo_e', from: 'west corridor' }, { id: 'off', from: "manager's office" }],
          marks: [
            // placed: one man a door
            { pos: [4.6, 0, 22.6], watch: 'fo_e', aimAt: [9.84, 1.1, 22.4] },       // the west wall SOUTH of the window, square onto the corridor door: beside the pane, where the verge sees him only along the glass
            { pos: [7.0, 0, 19.9], watch: 'off', aimAt: [5.0, 1.1, 18.3] },         // the middle of the floor, half turned: the manager's door on his right hand, the west window and the lit verge beyond it on his left
            // spares
            { pos: [8.9, 0, 23.2], watch: 'fo_e', aimAt: [9.84, 1.1, 22.4] },       // the south-east corner, the hard corner of the corridor door (it stood in the north-west corner, 0.3 m from where the placed man above aims: in his line)
            { pos: [8.4, 0, 21.4], watch: 'off', aimAt: [6.4, 1.1, 17.16] },        // the open floor, onto the manager's door
            { pos: [4.8, 0, 21.6], watch: 'fo_e', aimAt: [9.84, 1.1, 22.4] },       // the west wall at the window's south end, square onto the corridor door
          ] },
        { id: 'mgr', name: "manager's office", bounds: { ...R.mgr }, garrison: 1,
          doors: [{ id: 'off', from: 'front office' }, { id: 'mgr_e', from: 'west corridor' }],
          marks: [
            // (deep and square on: from a corner beside `off` the one man here had a line THROUGH the opened door onto the stack on its far jamb — 33 of his 62
            // kills in the first tally's 144 runs were rounds through that door while the flashbang's fuse burned)
            { pos: [5.2, 0, 14.4], watch: 'mgr_e', aimAt: [9.84, 1.1, 14.4] },      // placed: the west side, square across the dark room onto the corridor door
            { pos: [6.4, 0, 14.1], watch: 'off', aimAt: [6.4, 1.1, 16.84] },        // in front of the desk, square onto the front office's door
            { pos: [7.2, 0, 14.8], watch: 'off', aimAt: [6.4, 1.1, 16.84] },        // on the rug, a step east of square
          ] },
        { id: 'hall', name: 'hall', bounds: { ...R.hall }, garrison: 3,
          doors: [{ id: 'h_sw', from: 'west corridor' }, { id: 'h_n', from: 'north corridor' }, { id: 'hd_n', from: 'dock' }, { id: 'hd_s', from: 'dock' }],
          marks: [
            // placed: two guns on the west door, one down the north lane; the east doors are the dock's
            { pos: [19.0, 0, 17.2], watch: 'h_sw', aimAt: [13.16, 1.1, 19.4] },     // the middle lane, past the row's west end onto the west door
            { pos: [14.0, 0, 22.8], watch: 'h_sw', aimAt: [13.16, 1.1, 19.4] },     // the dark south-west corner, along the west wall onto the west door
            { pos: [14.2, 0, 13.0], watch: 'h_n', aimAt: [22.4, 1.1, 11.16] },      // the north-west corner, under its lit panel, down the north lane onto the north door
            // spares
            { pos: [28.8, 0, 12.2], watch: 'h_n', aimAt: [22.4, 1.1, 11.16] },      // the north-east corner, down the north lane the other way
            { pos: [26.6, 0, 16.0], watch: 'hd_n', aimAt: [29.84, 1.1, 14.4] },     // the marshalling floor, onto the dock's north door
            { pos: [26.4, 0, 22.8], watch: 'hd_s', aimAt: [29.84, 1.1, 21.4] },     // the south lane's east end, under its lit panel, onto the dock's south door
            { pos: [24.6, 0, 16.6], watch: 'hd_n', aimAt: [29.84, 1.1, 14.4] },     // behind the middle lane's pallet, past the row's east end
          ] },
        { id: 'dock', name: 'dock', bounds: { ...R.dock }, garrison: 3,
          doors: [{ id: 'hd_s', from: 'hall' }, { id: 'hd_n', from: 'hall' }, { id: 'd_n', from: 'north corridor' }, { id: 'dock_n', from: 'yard' }, { id: 'dock_s', from: 'yard' }],
          marks: [
            // placed: a man a yard door, each across the dock from his door where a team in the doorway can see him, and one on the north corridor
            { pos: [31.0, 0, 23.0], watch: 'dock_s', aimAt: [35.84, 1.1, 21.4] },   // the south-west corner, in the dock's dark end, across its width onto the yard's south door
            { pos: [31.2, 0, 12.2], watch: 'dock_n', aimAt: [35.84, 1.1, 13.4] },   // the north-west corner, under the dock's one lit panel, the width of the dock onto the yard's north door
            { pos: [35.0, 0, 14.8], watch: 'd_n', aimAt: [33.4, 1.1, 11.16] },      // the east wall by the shutters, onto the corridor door: the back of the man above
            // spares
            { pos: [35.3, 0, 22.1], watch: 'dock_s', aimAt: [35.84, 1.1, 21.4] },   // tucked against the east wall just south of the yard's south door (a stride from whoever steps through: nothing shows him first; 1.2 m clear of the corner mark below — it stood half a metre from it, inside a body's width)
            { pos: [34.8, 0, 23.2], watch: 'hd_s', aimAt: [30.16, 1.1, 21.4] },     // the south-east corner, across the dock onto the hall's south door
            { pos: [33.6, 0, 15.6], watch: 'hd_n', aimAt: [30.16, 1.1, 14.4] },     // the middle of the floor north of the shutters, onto the hall's north door
          ] },
        { id: 'ship', name: 'shipping office', bounds: { ...R.ship }, garrison: 1,
          doors: [{ id: 'o_s', from: 'north corridor' }, { id: 'co', from: 'tool cage' }],
          marks: [
            { pos: [35.0, 0, 6.5], watch: 'o_s', aimAt: [32.4, 1.1, 7.84] },        // the east end, beside the desk, onto the corridor door
            { pos: [34.4, 0, 7.2], watch: 'co', aimAt: [30.16, 1.1, 6.4] },         // the south side, the length of the room onto the cage's door
            { pos: [30.8, 0, 7.2], watch: 'o_s', aimAt: [32.4, 1.1, 7.84] },        // the hard corner west of the corridor door
          ] },
        { id: 'cage', name: 'tool cage', bounds: { ...R.cage }, garrison: 1,
          doors: [{ id: 'co', from: 'shipping office' }, { id: 'c_s', from: 'north corridor' }],
          marks: [
            { pos: [28.6, 0, 5.6], watch: 'c_s', aimAt: [27.4, 1.1, 7.84] },        // placed: by the bench, onto the corridor door
            { pos: [26.2, 0, 5.4], watch: 'co', aimAt: [29.84, 1.1, 6.4] },         // the west side, between the shelving, onto the shipping office's door
            { pos: [29.2, 0, 7.2], watch: 'c_s', aimAt: [27.4, 1.1, 7.84] },        // the south-east corner, along the wall onto the corridor door
          ] },
      ],
      squads: WAREHOUSE_SQUADS.map(q => ({ ...q, rooms: [...q.rooms], rally: [...q.rally] as Vec3 })),
    },
  };
  // WHAT IS UNDERFOOT, rect for rect the floor() calls above: bare concrete (the hall, the dock, the plant room, the cage) rings like stone, the corridors, the
  // lockers and the break room are lino, the three offices carpet; outside asphalt, with the grass verges north and west — the quiet way to two of the doors.
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 3.2, inside: 'stone', outside: 'asphalt', verge: 'grass',
    zones: [
      { id: 'ncorr', mat: 'lino', x0: 4, z0: 8, x1: 36, z1: 11 }, { id: 'wcorr', mat: 'lino', x0: 10, z0: 11, x1: 13, z1: 24 },
      { id: 'offices', mat: 'carpet', x0: 4, z0: 11, x1: 10, z1: 24 }, { id: 'lockers-break', mat: 'lino', x0: 10, z0: 4, x1: 25, z1: 8 },
      { id: 'shipping', mat: 'carpet', x0: 30, z0: 4, x1: 36, z1: 8 },
    ],
  };
  // THE FLOOR NOBODY HOLDS, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it): what a line on their net, a cue or
  // the debrief calls a spot that is no room of the structure
  scenarios.places = { areas: [{ name: 'plant room', bounds: { ...R.plant } }, { name: 'locker room', bounds: { ...R.lockers } }, { name: 'break room', bounds: { ...R.brk } }, { name: 'service corridor', bounds: { ...R.ncorr } }, { name: 'staff corridor', bounds: { ...R.wcorr } }] };
  scenarios.kitView = WAREHOUSE_KITVIEW;
  scenarios.doorNames = [{ door: 'lb', name: 'locker room to break room door' }, { door: 'p_s', name: 'plant room door' }, { door: 'l_s', name: 'locker room door' }, { door: 'b_s', name: 'break room door' }];   // (doorNames: what a row calls the doors no room of the level names — game/doornames.ts; no bearing in a name)
  return { level, scenarios, groups: trace.groups, surfaces };
}
