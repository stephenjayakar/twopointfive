// THE DEPOT — a motor pool at night: three huts round a floodlit yard, and a dark signals hut and a store's hatch that look across it.
// A level generator in the scenario levels' shape (tools/levels/test-rooms.ts is the template; rebuild/scenario-levels/contract.md the how-to):
//   bun run tools/levels/export.ts depot [--check]     → levels/depot.json (+ levels/depot-gwot.json), with its `scenarios.roomClear` block
//   page: ?levelFile=depot.json&roomclear&squad4       · headless: bun run tools/qa/probes.ts depot
//
// ONE PROBLEM, in a sentence: THE SIGNALS HUT AND THE STORE'S HATCH HOLD THE LIT YARD IN A CROSSFIRE FROM THE DARK, AND THE HUT'S OWN DOOR — AND THE
// MAINS — ARE AT ITS BACK.
// What is placed by hand, and why (seed 0 = each room's first `garrison` marks in the order they are written below; five men):
//   · the YARD is lit by floodlights on the mains (two on the hut's walls, one over the yard's mouth); the crew room's obvious door opens on it;
//   · the SIGNALS HUT (comms room, two men, dark) stands out into the yard. Its windows have no glass. One man at its WEST slit looks the length of the yard
//     onto the crew room's door; the other at its EAST slit looks over the aerial park, which a third floodlight lights. Its only door is on the far side,
//     through the generator room, and the mains panel is in there on the wall;
//   · the STORE (two men, dark) has an issue hatch in its yard wall: one man covers the crew room's door through it from the other side of the yard, the
//     other the battery room's door and the middle of the yard;
//   · the CREW ROOM (one man) is lit: he is the one a stack on the yard door would be fighting while guns it cannot see into shoot it in the back.
// The obvious plan — in by the main gate, across the yard, stack on the crew room — is stood in floodlight between the slit and the hatch.
// The answers the floor is cut for (none free), and they are different fights:
//   · ROUND THE BACK: from the east gate, the gap in the park's wall, the lane behind the signals shelter, a metre in the east slit's sight past the
//     shelter's nose, the generator room's door; then the mains, and the hut's own door at the watchers' backs. With the light out the yard is nobody's; left on, every way
//     from the north bar to the store is across it, under the hatch.
//   · THE STORES' WAY: along the south bar's wall, behind the truck, to the workshop's side door — a few lit metres and a stack in the west slit's
//     sight, out of the hatch's; then the bay, and the store's bay door behind the hatch (one man has his back to it, the other has it at the edge of
//     his eye). The price is that door, and the way on: the crew room's door is still under the west slit, and the hut is still to take, lights on.
// The two nests cover each other's blind sides: the west slit sees the south bar's wall as far as the hatch's jamb, the hatch sees the hut's south
// window. What neither sees is the store's wall east of the hatch.
// The second start (the east gate) is a different problem: the near door is the store's yard door, and it is an arm's length from the hatch.
// The tool it rewards: the mains. Everything is readable from either gate before anybody is in range: the floodlights and what they light, the dark
// slits and the hatch that look at the lit doors, the hut with no door on the yard, the truck and the workshop's door past it, the gap in the park's
// wall and the shelter behind it.
//
//   z 4   +--------+------------+------+---------+----------+-----------+
//         | duty   |  A crew    | wash | battery |generator 5          |
//         | office |   room    a_e     2         4          |  aerial   |
//   z 9.5 +---1----+----a_s-----+------+----3----+#--b_n----+   park    |
//         |                                      W  B comms E  (lit) [] |
//    gate →            THE YARD (floodlit)       W   hut    E        [] |
//   z 15  |                                      +---SS-----+--------[]gap
//         |                                        mouth                |
//   z18.5 +--------+---------6--+--HH--c_n-+                            8
//         | tyre   |  workshop  c_w  C     |       east yard            |
//         | store  7    bay     |   store  |                            |
//   z 24  +--------+------------+----------+----------------------------+
//         x 4      9           18         24        29.5               36
//         (W, E, S = the hut's glassless windows · HH = the store's issue hatch · # = the mains panel, in the generator room · [] = the signals shelter ·
//          gap = no gate, a way through. The held rooms' doors carry their ids; the rest are named for what they join, no compass letter in them:
//          1 duty · 2 wash_to_battery · 3 battery_to_yard · 4 battery_to_generator · 5 generator_to_park · 6 bay_to_yard · 7 tyres_to_bay · 8 back_gate)
//
// ITS OWN SHELL (as the compound has): a walled yard, three roofs. Nothing of the office's stair tower or fire exit is here.
// NO BREACH PLAN: there is no F drill — all four teammates are the order menu's from the first frame (the structure's `team` says where they start).
// Only the old demo's kit (src/scene/officeGen.ts officeKit: its walls, doors, furniture, lights, palette and markings). Units: meters. +X east, +Z south, +Y up.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect, ResponseData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import { livedKit } from './livedKit';

export const NAME = 'depot';
export const NOTES = 'The depot: a motor pool at night. Three huts round a floodlit yard inside a wall; the dark signals hut and the store\'s hatch hold the lit yard between them, and the hut\'s own door and the mains are at its back. One floor, box geometry only, the office\'s kit. Regenerate: bun run tools/levels/export.ts depot';

/** The spaces: the floor inside each one's walls. The ONE place a room's rectangle is typed — the structure's bounds and the probes' measures both read it. */
export const DEPOT_ROOMS: Record<'duty' | 'a' | 'wash' | 'battery' | 'generator' | 'b' | 'tyres' | 'bay' | 'c' | 'yard' | 'east' | 'aerials', Rect> = {
  duty: { x0: 4.12, x1: 8.94, z0: 4.12, z1: 9.38 },
  a: { x0: 9.06, x1: 15.44, z0: 4.12, z1: 9.38 },             // the crew room (held)
  wash: { x0: 15.56, x1: 18.94, z0: 4.12, z1: 9.38 },
  battery: { x0: 19.06, x1: 23.94, z0: 4.12, z1: 9.38 },
  generator: { x0: 24.06, x1: 29.38, z0: 4.12, z1: 9.38 },
  b: { x0: 24.12, x1: 29.38, z0: 9.62, z1: 14.88 },           // the comms room, the signals hut (held)
  tyres: { x0: 4.12, x1: 8.94, z0: 18.62, z1: 23.88 },
  bay: { x0: 9.06, x1: 17.94, z0: 18.62, z1: 23.88 },
  c: { x0: 18.06, x1: 23.88, z0: 18.62, z1: 23.88 },          // the store (held)
  yard: { x0: 4.12, x1: 23.88, z0: 9.62, z1: 18.38 },
  east: { x0: 24.12, x1: 35.88, z0: 15.12, z1: 23.88 },
  aerials: { x0: 29.62, x1: 35.88, z0: 4.12, z1: 14.88 },
};

/** THE DEPOT'S RESPONSE TEAM (scene/scenarios.ts ResponseData; game/qrf.ts RESPONSE.raid — `bun run tools/qa/response-check.ts` stands every mark on the
 *  built floor). A raid's team: it stands with the defenders. WHY HERE: the signals hut is this level's one problem already — the answer the floor is cut for
 *  is round the back to the hut and the mains — and a motor pool's trucks are out on the road with an escort the hut talks to. So the hut is also what
 *  calls: gunfire its men hear, and a few seconds to say so, brings the escort back to one of the depot's own two gates. The hut taken first, nobody calls. */
export const RESPONSE: ResponseData = {
  why: 'A motor pool has trucks out on the road at night with an armed escort, and the signals hut is what talks to them: gunfire the hut hears brings the escort back to one of the depot\'s own two gates. The hut taken first (the level\'s own answer, round the back) and nobody calls.',
  site: 'the depot', at: 'at the depot', team: 'the convoy escort', tag: 'ESCORT', men: [2, 3], eta: [50, 90],
  raid: { room: 'comms' },
  ways: [
    // the main gate: no leaf, the road outside it — in on the lit yard's mouth
    { name: 'the main gate', coming: 'coming in by the main gate', clear: 'nobody in the gateway',
      muster: [[1.6, 0, 14], [1.6, 0, 12.9], [1.6, 0, 15.1], [0.7, 0, 14]],
      entry: [[7.4, 0, 14], [6.4, 0, 13], [6.4, 0, 15], [5.4, 0, 14]], entryFace: [Math.PI / 2, Math.PI / 2 - 0.8, Math.PI / 2 + 0.8, Math.PI / 2] },
    // the back gate: the leaf in the east wall, onto the east yard
    { name: 'the back gate', door: 'back_gate', coming: 'coming in by the back gate', clear: 'nobody by the back gate',
      muster: [[37.6, 0, 17.4], [37.6, 0, 16.2], [37.6, 0, 18.6], [38.7, 0, 17.4]],
      entry: [[32.6, 0, 17.4], [33.8, 0, 16.4], [33.8, 0, 18.4], [34.8, 0, 17.4]], entryFace: [-Math.PI / 2, -Math.PI / 2 + 0.8, -Math.PI / 2 - 0.8, -Math.PI / 2] },
  ],
};

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = DEPOT_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, bin, cabinet, papers, bench, shelf, car, ceilingPanel, doorFrame, lights, switchables } = K;
  const NS = BoxFlag.NoShadow;
  /** a pallet of crates: a static block a man can kneel behind (1.0 m: under the eye line of a standing man, so it hides nobody who is not crouched) */
  function pallet(x: number, z: number, w: number, d: number, yaw = 0) {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], yaw, albedo: C.woodDark });
    add({ c: [x, 0.56, z], h: [w / 2 - 0.04, 0.44, d / 2 - 0.04], yaw, albedo: C.cardboard, ...mk(MD.cartonMarks([w / 2 - 0.04, 0.44, d / 2 - 0.04], TX)) });
  }
  /** a steel locker, 1.9 m: against a wall that runs along X (`alongX`) or along Z */
  function locker(x: number, z: number, alongX: boolean) {
    add({ c: [x, 0.95, z], h: alongX ? [0.3, 0.95, 0.24] : [0.24, 0.95, 0.3], albedo: [0.3, 0.33, 0.3], rough: 0.5, metal: true });
  }

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  grp('floors');
  const floor = (x0: number, z0: number, x1: number, z1: number, alb: Vec3, extra: Partial<Box> = {}) => slab(x0, 0, z0, x1, 0.004, z1, alb, extra);
  const polished = { flags: BoxFlag.Gloss };
  const HARD: Vec3 = [0.23, 0.23, 0.22];
  slab(4, -0.1, 4, 36, 0.001, 24, HARD);                        // the hardstanding: the whole of the yard inside the wall (thin top at y=0)
  floor(4, 4, 19, 9.5, C.lino, polished);                      // duty office, crew room, wash room: lino
  floor(19, 4, 29.5, 9.5, C.stone);                            // battery room, generator room: sealed concrete
  floor(24, 9.5, 29.5, 15, [0.2, 0.21, 0.24], { rough: 0.35 });   // the comms room's raised floor
  floor(4, 18.5, 24, 24, C.stone);                             // tyre store, bay, store

  grp('ceiling');
  // three roofs, each a slab at ceiling height over its building and nothing over the yards (the weather's rain, a man's wet coat and the wind read these)
  slab(3.9, H, 3.9, 29.62, H + 0.2, 9.62, C.ceiling, { flags: BoxFlag.NoPrimary });        // the north bar
  slab(23.88, H, 9.62, 29.62, H + 0.2, 15.12, C.ceiling, { flags: BoxFlag.NoPrimary });    // the signals hut
  slab(3.9, H, 18.38, 24.12, H + 0.2, 24.1, C.ceiling, { flags: BoxFlag.NoPrimary });      // the south bar

  // the yard wall (t=0.24): the main gate in the west wall (3 m, its leaves chained back: an opening, no door), a small gate in the east wall into the
  // east yard. The north wall is blind. The north and south walls are also the back walls of the two bars
  grp('walls.exterior');
  const ext = C.concrete;
  wallX(4, 3.88, 36.12, 0.24, ext);
  wallX(24, 3.88, 36.12, 0.24, ext);
  wallZ(4, 4, 24, 0.24, ext, [{ a: 12.5, b: 15.5, y0: 0, y1: H }]);
  wallZ(36, 4, 24, 0.24, ext, [{ a: 16.8, b: 18.0 }]);
  // the main gate's two leaves, folded back flat on the inside of the wall
  add({ c: [4.2, 1.1, 11.72], h: [0.03, 1.05, 0.75], albedo: [0.2, 0.22, 0.2], metal: true, rough: 0.6 });
  add({ c: [4.2, 1.1, 16.28], h: [0.03, 1.05, 0.75], albedo: [0.2, 0.22, 0.2], metal: true, rough: 0.6 });
  // the wall between the aerial park and the east yard, and the gap in it by the east wall: the ONLY way into the park, and so to the signals hut's back.
  // The gap opens on the lane behind the signals shelter
  wallX(15, 29.62, 35.88, 0.24, ext, [{ a: 34.3, b: 35.7, y0: 0, y1: H }]);

  // ---------------- the huts' own walls (0.24 where a face is on a yard, 0.12 between two rooms) ----------------
  grp('walls.huts');
  const hut = C.partTan, iw = C.wall;
  const OPEN_W = { y0: 0.95, y1: 2.1 };                         // a window with no glass in it: shutters back, a man's chest and head over the sill
  // the north bar's yard wall, z=9.5: the duty office's door, the crew room's, the battery room's — and, east of x 24, the wall between the generator room
  // and the signals hut with the hut's ONLY door in it
  wallX(9.5, 4.12, 29.38, 0.24, hut, [{ a: 5.8, b: 7.0 }, { a: 11.8, b: 13.0 }, { a: 20.8, b: 22.0 }, { a: 25.3, b: 26.5 }]);
  // the bar's partitions: duty | crew is SOLID (the crew room has no way in from the gatehouse); crew | wash, wash | battery, battery | generator each a door
  wallZ(9, 4.12, 9.38, 0.12, iw);
  wallZ(15.5, 4.12, 9.38, 0.12, iw, [{ a: 6.3, b: 7.5 }]);
  wallZ(19, 4.12, 9.38, 0.12, iw, [{ a: 6.3, b: 7.5 }]);
  wallZ(24, 4.12, 9.38, 0.12, iw, [{ a: 6.3, b: 7.5 }]);
  // the bar's east end and the hut's east wall, x=29.5: the generator room's outside door onto the aerial park, and the hut's EAST WINDOW over the park —
  // the walk from the gap to that door is across it
  wallZ(29.5, 4.12, 15.12, 0.24, hut, [{ a: 6.3, b: 7.5 }, { a: 12.1, b: 13.5, ...OPEN_W }]);
  // the signals hut's west wall (the slit that looks down the yard at the crew room's door) and its south wall (a window on the mouth: nobody's on the hand placement)
  wallZ(24, 9.62, 15.12, 0.24, hut, [{ a: 11.2, b: 12.6, ...OPEN_W }]);
  wallX(15, 23.88, 29.62, 0.24, hut, [{ a: 24.2, b: 25.0, ...OPEN_W }]);
  // the south bar's yard wall, z=18.5: the workshop's side door (past the roller door, and past the truck), the store's issue hatch (a counter in the
  // wall, no glass), the store's door. The tyre store has no door on the yard: it is a room off the bay
  wallX(18.5, 4.12, 24.12, 0.24, hut, [{ a: 15.8, b: 17.0 }, { a: 19.4, b: 21.4, y0: 1.0, y1: 2.0 }, { a: 22.3, b: 23.5 }]);
  wallZ(24, 18.38, 23.88, 0.24, hut);                                                       // its east end: blind
  wallZ(9, 18.62, 23.88, 0.12, iw, [{ a: 20.3, b: 21.5 }]);                                 // tyre store | bay
  wallZ(18, 18.62, 23.88, 0.12, iw, [{ a: 20.3, b: 21.5 }]);                                // bay | store

  // ---------------- the duty office (x 4..9, z 4..9.5): NOT held — the gatehouse, lit, its door on the yard beside the gate ----------------
  grp('duty');
  desk(6.6, 5.0, 1.6, 0.8, 0); monitor(6.6, 4.9, 0, false); chair(6.6, 5.9, 0); papers(7.1, 0.76, 5.1, 0.2);
  cabinet(4.5, 5.2, Math.PI / 2); cabinet(4.5, 5.8, Math.PI / 2);
  bench(8.55, 7.2, -Math.PI / 2);
  ceilingPanel(6.5, 6.4, true, 'duty', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- room A, the crew room (x 9..15.5, z 4..9.5): HELD, one man, lit ----------------
  // Two doors: a_s on the yard (the obvious one, and the watched one), a_e into the wash room — the indoor way, from the generator room's end of the bar.
  // Lockers stand along the north wall, a bench on the west one; the middle of the floor is the table's (lived).
  grp('room_a');
  locker(10.3, 4.42, true); locker(10.92, 4.42, true); locker(11.54, 4.42, true); locker(12.16, 4.42, true);
  bench(9.45, 6.6, Math.PI / 2);
  bin(15.1, 8.9);
  ceilingPanel(12.2, 6.7, true, 'room_a', false, 1.2, 0.6, [8, 7.6, 6.9]);


  // ---------------- the wash room (x 15.5..19): NOT held, dark — a way through ----------------
  grp('wash');
  add({ c: [17.25, 0.42, 4.45], h: [1.2, 0.42, 0.26], albedo: C.white, rough: 0.3 });        // the trough sink on the north wall
  add({ c: [17.25, 1.15, 4.2], h: [1.2, 0.03, 0.03], albedo: C.metal, flags: NS });          // its pipe and taps
  for (const x of [16.2, 16.95]) add({ c: [x, 1.0, 8.75], h: [0.03, 1.0, 0.6], albedo: C.wallDark });   // two stall partitions on the south wall
  ceilingPanel(17.25, 6.9, false, 'wash');

  // ---------------- the battery room (x 19..24): NOT held, dark — the charging benches, a door on the yard ----------------
  grp('battery');
  shelf(21.5, 4.5, 3.4, 0.5, 0, 3, 1.5);                                                      // the charging bench on the north wall
  pallet(23.3, 8.6, 0.9, 1.0);
  ceilingPanel(21.5, 6.9, false, 'battery');

  // ---------------- the generator room (x 24..29.5, z 4..9.5): NOT held, dark — the way to the signals hut's door ----------------
  grp('generator');
  add({ c: [27.0, 0.55, 4.85], h: [1.0, 0.55, 0.5], albedo: [0.28, 0.3, 0.2], rough: 0.6, metal: true });     // the set, on the north wall
  add({ c: [26.3, 1.25, 4.6], h: [0.18, 0.15, 0.18], albedo: C.metal });                                   // its air filter
  add({ c: [27.8, 2.05, 4.3], h: [0.05, 0.95, 0.05], albedo: [0.2, 0.2, 0.2], flags: NS });                // the exhaust, up through the roof
  add({ c: [28.9, 0.45, 8.9], h: [0.29, 0.45, 0.29], albedo: [0.42, 0.15, 0.1] }); add({ c: [28.3, 0.45, 9.0], h: [0.29, 0.45, 0.29], albedo: [0.42, 0.15, 0.1] });   // fuel drums in the south-east corner
  ceilingPanel(26.8, 7.0, false, 'generator');
  // THE MAINS: the breaker panel on the generator room's west wall, beside the set it switches (OCP it for a temporary blackout, shoot it for a permanent
  // one). It is behind the signals hut, on the back way in: whoever goes round the back owns the light before a door is opened.
  const brk = add({ c: [24.1, 1.35, 8.4], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [24.15, 1.62, 8.22], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: NS });
  add({ c: [24.1, 2.3, 8.4], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: NS });

  // ---------------- room B, the comms room — THE SIGNALS HUT (x 24..29.5, z 9.5..15): HELD, two men, dark ----------------
  // One door (b_n, from the generator room). Three glassless windows: a slit west, down the yard; a slit east, over the aerial park; a narrow one south, in the
  // corner the hatch looks at, onto the mouth and the store's door. The floor by the windows is bare: the men at them stand at the wall. The sets are racked on the north wall east of the
  // door; the operator's desk is in the middle.
  grp('room_b');
  const DRIVE_RACK = 1; let rackFront: Vec3 = [28.95, 1.1, 10.68];
  for (let i = 0; i < 2; i++) {
    const x = 28.2 + i * 0.75, z = 10.15;
    const slots: { u: number; y: number; amber: boolean }[] = [];
    for (let u = 0; u < 10; u++) { if (((u * 7 + i * 3) % 5) > 1) continue; slots.push({ u, y: 0.32 + u * 0.178, amber: (u + i) % 7 === 3 }); }
    const rackBody = add({ c: [x, 1.05, z], h: [0.33, 1.05, 0.5], albedo: [0.06, 0.06, 0.07], rough: 0.3, ...mk(MD.rackMarks([0.33, 1.05, 0.5], slots.map(sl => ({ v: sl.y - 1.05, amber: sl.amber })), TX)) });
    if (i === DRIVE_RACK) rackFront = [x, 1.1, z + 0.53];
    if (slots.length) switchables.push({ name: `rack${i}_leds`, boxes: [rackBody], group: 'server_leds', on: true, baseEmissive: [0, 0, 0], flicker: i === 0, mains: false });
  }
  desk(27.0, 12.7, 1.6, 0.8, 0, C.metal); monitor(26.6, 12.6, 0, false); chair(26.7, 13.45, 0);
  papers(27.55, 0.76, 12.5, 0.4); papers(27.3, 0.76, 12.95, -0.25);   // the signals log and a message pad (and paper for a firefight to throw about: loudchaos-probes.ts loudLevels wants six sheets a loud level)
  cabinet(28.95, 14.45, -Math.PI / 2);

  // ---------------- the tyre store (x 4..9, z 18.5..24): NOT held, dark — a room off the bay, no door on the yard ----------------
  grp('tyres');
  shelf(6.5, 23.5, 3.6, 0.5, 0, 3, 1.8);
  shelf(4.5, 21.6, 0.5, 2.4, 0, 3, 1.8);

  // ---------------- the bay (x 9..18): NOT held, dark — the workshop. Its roller door on the yard is down; its side door is beside it, east of the truck
  // in the yard; the way through is that door → the bay → the store. The floor from the side door to the store's door is bare; a truck stands over the
  // pit against the south wall.
  grp('bay');
  car(13.4, 22.7, 0, [0.24, 0.235, 0.14]);
  bench(16.8, 23.55, Math.PI);
  cabinet(17.55, 22.6, -Math.PI / 2);
  ceilingPanel(13.5, 21.0, false, 'bay');

  // ---------------- room C, the store (x 18..24, z 18.5..24): HELD, two men, dark ----------------
  // Two doors: c_n on the yard's east mouth (an arm's length from the hatch), c_w from the bay (behind the hatch: one man's back to it, the edge of the other's eye). The hatch in its yard wall
  // has a shelf for a counter; two rows of racking run north–south in the south half.
  grp('room_c');
  add({ c: [20.4, 0.98, 18.7], h: [1.0, 0.02, 0.1], albedo: C.woodDark });                    // the hatch's counter, a shelf on the wall's inside
  shelf(20.0, 22.4, 0.5, 2.2, 0, 4, 2.0); shelf(21.8, 22.4, 0.5, 2.2, 0, 4, 2.0);
  pallet(23.3, 23.2, 0.9, 1.0);

  // ---------------- the yards ----------------
  grp('yard');
  car(12.6, 16.3, 0, [0.24, 0.235, 0.14]);                                                    // a truck on the south side of the yard, nose east, off the roller door: a man's width between it and the wall
  add({ c: [31.5, 3.0, 12.0], h: [0.06, 3.0, 0.06], albedo: C.metal });                       // the radio mast in the aerial park
  for (const [dx, dz] of [[0.9, 0], [-1.2, 1.2], [-1.2, -1.2]]) add({ c: [31.5 + dx / 2, 2.0, 12.0 + dz / 2], h: [0.012, 2.0, 0.012], albedo: C.metal, flags: NS });   // (its guys, drawn only)
  // THE SIGNALS SHELTER: a radio cabin on its trailer, backed up to the park's wall beside the gap. It is the walk's cover: the lane between it and the east
  // wall is out of the hut's east slit, and what the slit still sees is a metre of the walk past the shelter's nose; the door itself is hidden by the slit's own jamb.
  add({ c: [33.4, 1.3, 12.55], h: [0.7, 1.0, 2.25], albedo: [0.2, 0.23, 0.17], name: 'signals_shelter' });           // the cabin
  add({ c: [33.4, 0.24, 12.55], h: [0.62, 0.06, 2.3], albedo: [0.1, 0.1, 0.1] });                                   // its chassis
  for (const [wx, wz] of [[32.8, 13.6], [34.0, 13.6], [32.8, 11.5], [34.0, 11.5]]) add({ c: [wx, 0.3, wz], h: [0.08, 0.3, 0.3], albedo: [0.04, 0.04, 0.045] });   // wheels
  add({ c: [33.4, 0.28, 9.85], h: [0.04, 0.04, 0.45], albedo: [0.1, 0.1, 0.1] });                                   // the drawbar, nose north
  for (const [x, z] of [[27.2, 22.9], [27.95, 23.15], [27.3, 23.55]]) add({ c: [x, 0.45, z], h: [0.29, 0.45, 0.29], albedo: [0.42, 0.15, 0.1] });   // the fuel point's drums, far side of the east yard

  // ---------------- lights ----------------
  grp('lights');
  // THE FLOODLIGHTS are on the SIGNALS HUT, thrown out and down over the yard and the mouth: the hut's windows are the dark behind its own lamps. On the
  // MAINS (the panel is in the generator room). (dx, dz) = the way a head faces, a unit axis.
  const flood = (x: number, z: number, dx: number, dz: number, name: string, aim: Vec3 = [dx, -0.5, dz], intensity = 300) => {
    add({ c: [x + dx * 0.1, 2.95, z + dz * 0.1], h: [0.03 + Math.abs(dx) * 0.07, 0.03, 0.03 + Math.abs(dz) * 0.07], albedo: C.metal });
    const head = add({ c: [x + dx * 0.26, 2.95, z + dz * 0.26], h: [dx ? 0.06 : 0.16, 0.1, dz ? 0.06 : 0.16], albedo: C.metal, emissive: [34, 31, 24], flags: NS });
    lights.push({ kind: 'spot', pos: [x + dx * 0.36, 2.92, z + dz * 0.36], dir: normalize3(aim), color: [1.0, 0.92, 0.78], intensity, range: 26, innerDeg: 40, outerDeg: 68,
      name, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.16, broad: true });
  };
  flood(23.88, 11.9, -1, 0, 'flood_w', [-1, -0.42, -0.12], 420);         // over the west window: the length of the yard, onto the north bar's doors
  flood(25.8, 15.12, 0, 1, 'flood_s', [-0.15, -0.5, 1]);                 // on the south wall: the mouth and the store's yard door
  flood(29.62, 12.8, 1, 0, 'flood_e', [1, -0.5, -0.3], 150);             // over the east window: the aerial park (the lane behind the shelter is in its shadow)
  // what burns with the mains out is on batteries and too dim for a bare eye: the mast's red obstruction lamp
  { const lamp = add({ c: [31.5, 6.04, 12.0], h: [0.06, 0.06, 0.06], albedo: C.red, emissive: [6, 0.4, 0.2], flags: NS });
    lights.push({ kind: 'point', pos: [31.5, 6.1, 12.0], dir: [0, -1, 0], color: [1.0, 0.16, 0.1], intensity: 6, range: 34, innerDeg: 0, outerDeg: 180,
      name: 'mast_lamp', group: 'mast', enabled: true, volumetric: 0, fixtureBox: lamp, radius: 0.06, mains: false }); }
  // a thin moon: the dark outside the wall is dark (the page's meter counts the moon; a bright one reads half lit to a bare eye)
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.05, range: 1e6, innerDeg: 0, outerDeg: 0,
    name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: NS | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: NS | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(12.4, 7.6);                            // the crew room
  beacon(13.5, 20.2);                           // the bay

  // door leaves + frames (the kit's frame: jambs, head, the two stops in the leaf's plane). SWINGS: every held room has one door hung to open OUT of it
  // (tools/qa/second-way-check.ts: no wedge holds that one) — a_e into the wash room, b_n into the generator room, c_w into the bay; the yard doors open in.
  const X = 0, Z = Math.PI / 2;
  const doorDefs: LevelDoorDef[] = [
    { name: 'a_s', hinge: [11.82, 9.5], closedDir: X, width: 1.16, swing: -1 },             // the yard → the crew room; opens in
    { name: 'a_e', hinge: [15.5, 6.32], closedDir: Z, width: 1.16, swing: -1 },             // the crew room ↔ the wash room; opens out, into the wash room
    { name: 'b_n', hinge: [25.32, 9.5], closedDir: X, width: 1.16, swing: -1 },             // the generator room → the signals hut; opens out, into the generator room
    { name: 'c_n', hinge: [22.32, 18.5], closedDir: X, width: 1.16, swing: 1 },             // the yard's east mouth → the store; opens in
    { name: 'c_w', hinge: [18.0, 20.32], closedDir: Z, width: 1.16, swing: 1 },             // the bay → the store; opens out, into the bay
    { name: 'duty', hinge: [5.82, 9.5], closedDir: X, width: 1.16, swing: -1 },              // the yard → the duty office
    { name: 'wash_to_battery', hinge: [19.0, 6.32], closedDir: Z, width: 1.16 },                        // the wash room ↔ the battery room
    { name: 'battery_to_yard', hinge: [20.82, 9.5], closedDir: X, width: 1.16, swing: -1 },            // the yard → the battery room
    { name: 'battery_to_generator', hinge: [24.0, 6.32], closedDir: Z, width: 1.16 },                       // the battery room ↔ the generator room
    { name: 'generator_to_park', hinge: [29.5, 6.32], closedDir: Z, width: 1.16, swing: 1 },              // the aerial park → the generator room; opens in
    { name: 'bay_to_yard', hinge: [15.82, 18.5], closedDir: X, width: 1.16, swing: 1 },               // the yard → the bay; opens in
    { name: 'tyres_to_bay', hinge: [9.0, 20.32], closedDir: Z, width: 1.16 },                      // the tyre store ↔ the bay
    { name: 'back_gate', hinge: [36.0, 16.82], closedDir: Z, width: 1.16, exterior: true },    // the east gate, into the east yard
  ];
  // the doors in the huts' 0.24 m yard walls get the outside doors' deep frames (the back gate has them by being `exterior`: the wind's gusts come through it and the open main gate)
  const THICK = new Set(['a_s', 'b_n', 'c_n', 'duty', 'battery_to_yard', 'generator_to_park', 'bay_to_yard']);
  for (const d of doorDefs) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- LIVED IN (src/scene/lived.ts: every box below is in a group 'lived.<room>', every prop named 'lived.<room>.…' — the loader leaves them all out
  // with the switch off, and then this is the depot above, box for box). What makes each space ITS place, as the office's rooms are: a motor pool and its signals
  // hut. Rules kept: nothing solid within 1.1 m of a door's line or in a leaf's sweep, nothing solid on the wall a file stacks on beside a jamb, nothing on a
  // mark or a start or over 1.1 m across a mark's line to its door or out of its window, the lanes between doors bare. No light, nothing lit.
  // LAST in the lists on purpose (tools/levels/export.ts): the lived boxes are the tail of the boxes, the lived props the tail of the props.
  {
    const L = livedKit(K), P = L.P, IRON: Vec3 = [0.13, 0.13, 0.14], HAZ: Vec3 = [0.72, 0.58, 0.1], PALE: Vec3 = [0.84, 0.83, 0.76];

    // ---- THE DUTY OFFICE — the gatehouse: the key board, the vehicle log open on the desk, a kettle, the duty man's coat. Whoever was on the gate is not here
    L.room('duty');
    L.hung(7.6, 4.15, true, 1.0, 1.2, 1.9, C.woodDark); for (let k = 0; k < 6; k++) L.hung(7.2 + k * 0.16, 4.18, true, 0.03, 1.5 - (k % 2) * 0.2, 1.62 - (k % 2) * 0.2, P.brass, 0.02);   // the key board, six hooks
    L.table(8.45, 4.6, 0.7, 0.5, 0, C.woodDark, 0.6); L.thing(8.3, 0.6, 4.6, 0.07, 0.09, 0.07, C.metal); L.mug(8.62, 0.6, 4.55); L.mug(8.6, 0.6, 4.72, P.enamelBlue);   // the tea table: the kettle, two mugs
    L.hung(8.9, 5.2, false, 0.46, 1.0, 1.75, P.oliveDrab); L.hung(8.9, 5.8, false, 0.46, 1.05, 1.75, P.hiVis);             // coats on the east wall
    L.hung(4.15, 7.6, false, 1.4, 1.2, 2.0, PALE); for (let k = 0; k < 4; k++) L.hung(4.17, 7.1 + k * 0.33, false, 0.22, 1.3, 1.9, k % 2 ? P.paper : [0.75, 0.72, 0.6], 0.02);   // the notice board: standing orders, the roster
    L.stool(4.6, 7.2); L.bucket(4.5, 7.8);
    L.mat(5.75, 8.4, 6.75, 9.36, P.rubberMat);                                                                   // the door mat

    // ---- THE CREW ROOM — the drivers' room: a card school on the table, the stove and its kettle, boots drying, coveralls on the wall
    L.room('crew');
    L.table(12.0, 6.5, 1.5, 0.8, 0, C.woodDark); L.thing(12.0, 0.74, 6.5, 0.66, 0.004, 0.32, [0.45, 0.1, 0.09]);   // the table, a red cloth on it
    for (const [x, z, yw] of [[11.6, 6.4, 0.3], [11.85, 6.6, -0.5], [12.3, 6.35, 0.9], [12.5, 6.62, 0.1]] as const) L.sheet(x, 0.75, z, 0.07, 0.1, yw);   // the hands, face down
    L.mug(11.45, 0.75, 6.7); L.mug(12.6, 0.75, 6.25, P.enamelBlue); L.thing(12.05, 0.75, 6.5, 0.05, 0.02, 0.05, P.brass);   // mugs, the pot
    L.stool(13.1, 6.5); L.stool(12.1, 7.4); L.chair(12.0, 5.75, Math.PI); L.chair(10.9, 6.6, -Math.PI / 2);
    L.thing(9.5, 0, 4.6, 0.26, 0.36, 0.26, IRON); L.thing(9.5, 0.72, 4.45, 0.05, 1.1, 0.05, IRON); L.thing(9.5, 0.72, 4.62, 0.09, 0.07, 0.09, C.metal);   // the stove in the north-west corner, its pipe, the kettle
    L.mat(9.12, 5.0, 9.9, 5.5, P.rubberMat); for (const z of [5.1, 5.3]) L.thing(9.4, 0.022, z, 0.13, 0.075, 0.05, C.black);   // boots drying by it
    L.hung(13.2, 4.15, true, 0.46, 0.9, 1.75, P.enamelBlue); L.hung(13.8, 4.15, true, 0.46, 0.95, 1.75, P.oliveDrab);          // coveralls on the north wall
    for (const x of [10.3, 11.54]) L.thing(x, 1.9, 4.42, 0.13, 0.08, 0.15, P.oliveDrab);                         // helmets on the lockers
    L.hung(9.09, 7.9, false, 1.1, 1.2, 1.9, PALE);                                                               // the trip board on the west wall
    L.mat(11.75, 8.5, 12.75, 9.36, P.rubberMat);

    // ---- THE WASH ROOM — towels, a mirror over the trough, a duckboard, a bucket and mop
    L.room('wash');
    L.hung(17.25, 4.15, true, 1.6, 1.3, 1.8, [0.5, 0.56, 0.6]);                                                  // the mirror
    L.duckboard(16.2, 4.75, 18.3, 5.35, 5);
    L.hung(18.9, 4.9, false, 0.4, 1.0, 1.6, PALE); L.hung(18.9, 5.45, false, 0.4, 1.05, 1.6, [0.6, 0.3, 0.25]);   // towels
    L.bucket(15.95, 8.9); L.thing(15.75, 0, 9.1, 0.02, 0.7, 0.02, C.woodDark);                                    // bucket and mop
    L.thing(16.3, 0.84, 4.45, 0.05, 0.02, 0.035, [0.8, 0.75, 0.5]);                                              // soap

    // ---- THE BATTERY ROOM — batteries in rows on duckboards, the charger, cables, distilled water
    L.room('battery');
    L.duckboard(20.5, 4.95, 22.5, 5.6, 4);
    for (let k = 0; k < 4; k++) L.crate(20.9 + k * 0.4, 5.27, 0.3, 0.5, 0.26, 0, IRON, 0.05);
    L.thing(23.55, 0, 4.6, 0.22, 0.45, 0.2, [0.3, 0.33, 0.3]);                                                   // the charger, on the floor at the bench's end
    L.hung(21.5, 4.15, true, 2.4, 1.75, 1.8, C.black, 0.03);                                                     // its cable run
    L.jerryCans(19.4, 4.5, 2, Math.PI / 2, PALE);
    L.hung(23.9, 8.6, false, 0.7, 1.2, 1.8, HAZ);                                                                // the acid warning board

    // ---- THE GENERATOR ROOM — the set's drip tray, a funnel and cans, the tool box, the log on its clip
    L.room('generator');
    L.mat(25.8, 5.36, 28.2, 5.7, P.oilDark, 0.02);
    L.jerryCans(25.0, 4.5, 3, 0); L.thing(25.6, 0, 5.0, 0.09, 0.12, 0.09, C.metal);                              // cans and the funnel
    L.looseCrate(28.7, 4.7, 0.5, 0.35, 0.3, 0.2, P.enamelBlue);                                                   // the tool box
    L.hung(29.35, 8.5, false, 0.3, 1.2, 1.6, P.paper, 0.02);                                                      // the running log
    L.hung(27.0, 4.15, true, 0.8, 1.6, 2.0, HAZ);                                                                 // DANGER — it starts by itself

    // ---- THE SIGNALS HUT — the watch: the log on the desk, the field telephone on the ammunition box, the frequency board, a flask
    L.room('comms');
    L.thing(26.2, 0.34, 14.55, 0.11, 0.06, 0.08, P.oliveDrab); L.thing(26.2, 0.46, 14.55, 0.1, 0.02, 0.025, C.black);   // the field telephone and its handset, on the ammunition box
    L.thing(26.65, 0, 14.6, 0.04, 0.12, 0.04, P.oliveDrab);                                                        // a flask on the floor by it
    L.hung(24.15, 10.25, false, 1.0, 1.1, 2.0, PALE); for (let k = 0; k < 4; k++) L.hung(24.17, 9.88 + k * 0.25, false, 0.18, 1.25 + (k % 3) * 0.12, 1.85, k % 2 ? P.paper : P.enamelBlue, 0.02);   // the net diagram and frequency cards
    L.thing(26.2, 0, 14.55, 0.2, 0.17, 0.2, P.oliveDrab);                                                         // an ammunition box against the south wall, lid shut
    L.mat(25.3, 9.64, 26.3, 10.5, P.rubberMat);

    // ---- THE TYRE STORE — ranks of tyres on rubber, a jack, chalked sizes
    L.room('tyres');
    L.mat(7.6, 22.0, 8.92, 23.2, P.rubberMat); L.tyres(8.3, 22.6, 4);
    L.mat(5.4, 21.9, 6.6, 23.1, P.rubberMat); L.tyres(6.0, 22.5, 2);
    L.thing(4.7, 0, 19.3, 0.3, 0.09, 0.12, P.oxide);                                                              // the trolley jack
    L.hung(4.15, 19.9, false, 0.9, 1.2, 1.8, C.black); L.hung(4.17, 19.9, false, 0.6, 1.4, 1.46, PALE, 0.02);     // the size board, chalked

    // ---- THE BAY — the workshop: the pit under the truck with its hazard edge, the tool trolley, oil, the roller door down, coveralls, a wheel off
    L.room('bay');
    L.mat(11.6, 22.2, 15.2, 23.2, P.oilDark, 0.012);                                                              // the pit (its boards down), under the truck
    L.mat(11.4, 21.72, 15.4, 21.8, HAZ, 0.02);
    L.hung(13.0, 18.66, true, 4.0, 0.06, 2.7, [0.36, 0.37, 0.36], 0.05);                                          // the roller door, down
    for (const y of [0.7, 1.35, 2.0]) L.hung(13.0, 18.7, true, 4.0, y, y + 0.05, [0.2, 0.2, 0.21], 0.02);
    L.looseCrate(10.2, 22.2, 0.7, 0.45, 0.8, 0, P.oxide);                                                          // the tool trolley
    L.tyres(10.0, 23.3, 1); L.drum(10.9, 23.4); L.cone(10.6, 19.2);
    L.mat(15.9, 22.4, 16.9, 23.4, P.oilDark, 0.015);
    L.hung(9.09, 22.6, false, 0.46, 0.95, 1.75, P.enamelBlue); L.hung(9.09, 23.2, false, 0.46, 0.9, 1.75, P.enamelBlue);

    // ---- THE STORE — the quartermaster's: the ledger on the hatch counter, cartons on the racking, jerry cans, a crate
    L.room('store');
    L.sheet(19.9, 1.0, 18.7, 0.3, 0.18, 0); L.thing(20.9, 1.0, 18.68, 0.03, 0.05, 0.03, P.brass);                 // the issue ledger, the bell
    L.jerryCans(23.5, 22.2, 3, Math.PI / 2); L.crate(22.9, 22.5, 0.5, 0.4, 0.4);
    L.carton(18.5, 22.6, 0.45, -0.2);
    L.hung(23.85, 19.6, false, 0.5, 1.3, 1.8, PALE, 0.02);                                                         // the stock list
    L.mat(22.3, 18.64, 23.3, 19.5, P.rubberMat);

    // ---- THE YARD — chocks under the truck, cones on the turning circle's edge, the gate's drop bar
    L.room('yard');
    for (const x of [11.2, 14.1]) add({ c: [x, 0.06, 17.9], h: [0.12, 0.06, 0.09], albedo: HAZ, flags: NS });
    L.cone(8.6, 16.6); L.cone(8.6, 11.4);
    L.thing(4.5, 0, 16.9, 0.06, 0.06, 0.7, IRON);                                                                  // the gate's drop bar, lying by its leaf
    L.mat(11.0, 15.8, 14.2, 16.0, P.oilDark, 0.012);
    L.hung(17.0, 9.64, true, 1.2, 1.4, 2.0, PALE); L.hung(17.0, 9.66, true, 0.9, 1.6, 1.68, [0.6, 0.12, 0.1], 0.02);   // the speed-limit board on the bar's wall

    // ---- THE EAST YARD — the fuel point: cans, a NO SMOKING board on the wall, sand buckets; scrap along the south wall
    L.room('east');
    L.mat(26.6, 22.4, 28.6, 23.7, P.oilDark, 0.02);
    L.jerryCans(29.2, 23.5, 4, 0);
    L.hung(28.0, 23.85, true, 1.4, 1.5, 2.0, PALE); L.hung(28.0, 23.83, true, 1.1, 1.65, 1.85, [0.6, 0.12, 0.1], 0.02);
    L.bucket(30.3, 23.4, [0.6, 0.12, 0.1]); L.bucket(30.7, 23.4, [0.6, 0.12, 0.1]);
    L.thing(33.4, 0, 23.2, 1.1, 0.3, 0.45, P.oxide, 0.1); L.tyres(34.9, 23.2, 3); L.thing(32.2, 0, 22.9, 0.5, 0.08, 0.5, IRON, 0.5);   // a stripped chassis rail, tyres, a wheel hub

    // ---- THE AERIAL PARK — the mast's guys' pickets, a cable drum by the hut, spare mast sections against the wall
    L.room('aerials');
    for (const [dx, dz] of [[0.9, 0], [-1.2, 1.2], [-1.2, -1.2]]) L.thing(31.5 + dx, 0, 12.0 + dz, 0.04, 0.15, 0.04, IRON);
    L.thing(30.05, 0, 14.45, 0.4, 0.4, 0.25, C.woodDark); L.thing(30.05, 0.1, 14.45, 0.15, 0.3, 0.27, C.black);        // the cable drum
    for (let k = 0; k < 3; k++) L.thing(32.6, 0.05 + k * 0.09, 4.3 + k * 0.08, 2.2, 0.035, 0.035, PALE);           // spare mast sections along the north wall
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors: doorDefs, devices: [],
    breaker: { pos: [24.2, 1.35, 8.4], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [2.6, 0, 14.0],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's places, because the level format wants them (the scenario stands the mission still): the hut, its door, a rack, the east gate
    mission: { serverRoom: { ...R.b }, entryDoor: 'b_n', rack: { index: DRIVE_RACK, front: rackFront, halfW: 0.33 }, exfilDoor: 'back_gate', exfilX: 36.8, exfilZ: 17.4 },
  };

  // ---------------- the room clear: three held rooms, five men, EACH ROOM'S MARKS IN THE ORDER THEY ARE FILLED ----------------
  // (the first `garrison` marks of each room are who stands there on seed 0: the level as authored. The rest are for a reroll.)
  const scenarios: LevelScenarios = {
    roomClear: {
      name: 'the depot',
      // outside the main gate, on the road in: the four in the dark either side, Sam in the gate's spill of light, all out of every watcher's range —
      // the yard is read from here
      team: { sam: [2.6, 0, 14.0], samYaw: Math.PI / 2, ops: [[2.2, 0, 11.8], [2.2, 0, 10.6], [2.2, 0, 16.2], [2.2, 0, 17.4]], opsYaw: Math.PI / 2 },
      // the dark east side: outside the east gate. The near door from here is the store's yard door — the one beside the hatch; the gap into the park is the other way
      starts: [{ sam: [38.0, 0, 19.4], samYaw: -Math.PI / 2, ops: [[37.6, 0, 20.8], [38.6, 0, 20.8], [37.6, 0, 22.0], [38.6, 0, 22.0]], opsYaw: -Math.PI / 2 }],
      rooms: [
        { id: 'crew', name: 'crew room', bounds: { ...R.a }, garrison: 1,
          doors: [{ id: 'a_s', from: 'the yard' }, { id: 'a_e', from: 'wash room' }],
          marks: [
            { pos: [14.7, 0, 4.9], watch: 'a_s', aimAt: [12.3, 1.1, 9.3] },          // the north-east corner: across the room onto the yard door, and beside the wash room's
            { pos: [10.6, 0, 5.5], watch: 'a_e', aimAt: [15.4, 1.1, 6.8] },          // the north-west corner: the length of the room onto the wash room's door
            { pos: [13.6, 0, 8.7], watch: 'a_e', aimAt: [15.4, 1.1, 6.8] },          // the south wall east of the yard door
            { pos: [13.0, 0, 5.0], watch: 'a_s', aimAt: [12.3, 1.1, 9.3] },          // the north wall, past the lockers
          ] },
        { id: 'comms', name: 'comms room', bounds: { ...R.b }, garrison: 2,
          doors: [{ id: 'b_n', from: 'generator room' }],
          marks: [
            { pos: [24.5, 0, 11.9], watch: 'b_n', aimAt: [12.6, 1.1, 12.4] },        // THE WEST SLIT, close up to it: the crew room's door, and the south bar's wall as far as the hatch's jamb
            { pos: [28.9, 0, 12.8], watch: 'b_n', aimAt: [34.8, 1.1, 8.2] },         // THE EAST SLIT: past the shelter's nose, the metre of the walk from the gap that the shelter does not cover
            { pos: [24.6, 0, 14.2], watch: 'b_n', aimAt: [23.3, 1.1, 18.1] },        // the south window: onto the mouth and the store's yard door
            { pos: [27.2, 0, 14.2], watch: 'b_n', aimAt: [25.9, 1.1, 9.7] },         // the south wall: the length of the hut onto his own door
          ] },
        { id: 'store', name: 'store', bounds: { ...R.c }, garrison: 2,
          doors: [{ id: 'c_n', from: 'the yard' }, { id: 'c_w', from: 'bay' }],
          marks: [
            { pos: [21.05, 0, 19.45], watch: 'c_n', aimAt: [12.9, 1.1, 10.3] },      // THE HATCH, its east end: across the yard onto the crew room's door (the bay's door at the edge of his eye, left and behind)
            { pos: [20.15, 0, 19.45], watch: 'c_n', aimAt: [20.6, 1.1, 10.4] },      // THE HATCH, its west end: straight up the yard onto the battery room's door and the hut's corner
            { pos: [23.4, 0, 20.75], watch: 'c_w', aimAt: [18.2, 1.1, 20.75] },      // the east wall: the lane's length onto the bay's door
            { pos: [18.6, 0, 19.4], watch: 'c_n', aimAt: [22.7, 1.1, 18.7] },        // the north-west corner, beside the bay door's jamb: on the yard door
          ] },
      ],
    },
  };
  // the open floor's names (src/game/dialogue.ts: a held room is its own name; these are for everywhere a held room is not)
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): both ways are the level's own. The main gate has no leaf
  // (its two are chained back on the inside of the wall), so the first way is anchored on the opening itself, post to post: the stack on the wall north of it,
  // the yard and its floodlight through it. The second is the back gate's leaf in the east wall.
  // (the picture's lamp is hung on the wall at the stack's end of the opening: left to be measured it hangs over the anchor's middle, which on a gap is open air)
  scenarios.kitView = { ways: [{ span: [[4, 12.5], [4, 15.5]], side: -1, light: { porch: { offset: [1.7, 0.67, 2.4], aim: [3.2, 1.6, 0], fixture: { at: [1.7, 0.17, 2.27], half: [0.17, 0.045, 0.05], glow: 5 } } } }, { door: 'back_gate' }] };
  scenarios.response = RESPONSE;
  scenarios.places = { areas: [
    { name: 'yard', bounds: { ...R.yard } }, { name: 'east yard', bounds: { ...R.east } }, { name: 'aerial park', bounds: { ...R.aerials } },
    { name: 'duty office', bounds: { ...R.duty } }, { name: 'wash room', bounds: { ...R.wash } }, { name: 'battery room', bounds: { ...R.battery } },
    { name: 'generator room', bounds: { ...R.generator } }, { name: 'tyre store', bounds: { ...R.tyres } }, { name: 'bay', bounds: { ...R.bay } },
  ] };
  // what a step sounds like (src/game/floor.ts): the hardstanding inside the wall and the road outside it are asphalt, the huts lino or sealed concrete
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'bar_west', mat: 'lino', x0: 4, z0: 4, x1: 19, z1: 9.5 }, { id: 'bar_east', mat: 'stone', x0: 19, z0: 4, x1: 29.5, z1: 9.5 },
      { id: 'hut', mat: 'lino', x0: 24, z0: 9.5, x1: 29.5, z1: 15 }, { id: 'south_bar', mat: 'stone', x0: 4, z0: 18.5, x1: 24, z1: 24 },
    ],
  };
  return { level, scenarios, groups: trace.groups, surfaces };
}
