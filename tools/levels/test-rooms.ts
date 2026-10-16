// TEST-ROOMS: the tiny level the scenario probes run on (tools/qa/scenario-level-probes.ts) — NOT a level to play for its own sake. Three rooms off one short
// hall and a lobby the team starts in, built from the office's own kit (src/scene/officeGen.ts officeKit: its walls, doors, furniture, lights and palette —
// no new art), 20 × 14 m inside the 40 × 28 m world. It exists to prove that the room clear (pair and four) and the hostage rescue stage, are walked and
// finish on a level that is not the office, with everything they need coming from this file's `scenarios` block (src/scene/scenarios.ts).
//
//        x 10        17  19            30
//   z 8  ┌────────────────┬─────────────┐
//        │  A  west room   ab  B  east   │      A | B: the side door 'ab' (x 19, z 10‥11.1)
//   z 13 ├───a────────────┴────b────────┤      doors 'a' (x 14‥15.2) and 'b' (x 24‥25.2) off the hall's north side
//        │            the hall  ───────► │      (the rescue's route runs west → east along it: +x, as the flow reads a corridor)
//  z 15.4├─ arch ──┬──c─────────────────┤      the lobby's arch (x 11‥13.6); door 'c' (x 19.4‥20.6) off the hall's south side
//        │  lobby  │      C  south room  exit   'exit': C's outside door on the east wall (z 19‥20.2)
//   z 22 └─────────┴────────────────────┘
//
// A LEVEL TASK COPIES THIS FILE: `build()` returns the Level, the scenarios block and the editor groups; `bun run tools/levels/export.ts <name>` writes
// levels/<name>.json from it and refuses a file that does not load back to the same level. (rebuild/scenario-levels/contract.md is the how-to.)
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect } from '../../src/scene/scenarios';
import { officeKit, normalize3 as norm, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'test-rooms';
export const NOTES = 'A tiny test level for the scenario probes: three rooms off one hall and a lobby, built from the office kit. Regenerate: bun run tools/levels/export.ts test-rooms';

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, wallX, wallZ, desk, monitor, chair, cabinet, shelf, bench, plant, cardboardBox, ceilingPanel, doorFrame, lights, switchables } = K;

  // ---- ground, floor finishes, ceiling ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);                        // the whole world's ground: every ray and every foot lands on something
  grp('floors');
  slab(10, -0.1, 8, 30, 0.001, 22, C.carpet);                     // the building's base finish
  slab(10, 0, 13, 30, 0.004, 15.4, C.lino, { flags: BoxFlag.Gloss });   // the hall
  slab(10, 0, 15.4, 17, 0.004, 22, C.stone, { flags: BoxFlag.Gloss });  // the lobby
  grp('ceiling');
  slab(9.9, H, 7.9, 30.1, H + 0.2, 22.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // ---- walls: exterior 0.24 thick, partitions 0.12 (the office's own two) ----
  grp('walls.exterior');
  wallX(8, 9.88, 30.12, 0.24, C.concrete);                                                         // north
  wallX(22, 9.88, 30.12, 0.24, C.concrete, [{ a: 11.5, b: 15.5, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }]);   // south: the lobby's window
  wallZ(10, 8, 22, 0.24, C.concrete);                                                              // west
  wallZ(30, 8, 22, 0.24, C.concrete, [{ a: 19, b: 20.2, y0: 0, y1: 2.2 }]);                        // east: C's outside door
  grp('walls.interior');
  wallX(13, 10.12, 29.88, 0.12, C.wall, [{ a: 14, b: 15.2 }, { a: 24, b: 25.2 }]);                 // hall | A, B
  wallX(15.4, 10.12, 29.88, 0.12, C.wall, [{ a: 11, b: 13.6, y0: 0, y1: 2.5 }, { a: 19.4, b: 20.6 }]);   // hall | lobby (the arch), C
  wallZ(19, 8.12, 12.94, 0.12, C.wall, [{ a: 10, b: 11.1 }]);                                      // A | B, with the side door
  wallZ(17, 15.46, 21.88, 0.12, C.wall);                                                           // lobby | C

  // ---- furniture: enough in each room to break a line and give a mark something to stand beside ----
  grp('room.a');
  desk(12.2, 9.4, 1.6, 0.8, 0); monitor(12.2, 9.3, 0, false); chair(12.2, 10.2, Math.PI);
  cabinet(17.9, 8.6, 0); shelf(10.5, 11.6, 1.6, 0.4, Math.PI / 2, 4, 1.9);
  grp('room.b');
  desk(26.6, 9.3, 1.8, 0.85, 0); monitor(26.6, 9.2, 0, true); chair(26.6, 10.15, Math.PI);
  cabinet(21.0, 8.6, 0); cabinet(29.3, 12.3, -Math.PI / 2);
  add({ c: [22.4, 0.22, 8.75], h: [0.9, 0.22, 0.42], albedo: [0.3, 0.12, 0.1] }); add({ c: [22.4, 0.6, 8.42], h: [0.9, 0.35, 0.1], albedo: [0.3, 0.12, 0.1] });   // a couch along the north wall
  grp('room.c');
  add({ c: [24.5, 0.72, 19.0], h: [1.3, 0.03, 0.6], albedo: C.woodDark }); for (const [lx, lz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) add({ c: [24.5 + lx, 0.35, 19.0 + lz], h: [0.04, 0.35, 0.04], albedo: C.metal });   // a table
  chair(24.0, 18.0, 0); chair(25.2, 20.0, Math.PI);
  shelf(18.6, 21.5, 2.4, 0.45, 0, 4, 1.9); cardboardBox(28.9, 21.0, 0.5, 0.2); cardboardBox(28.8, 16.4, 0.45, 0.6);
  grp('lobby');
  bench(10.6, 17.2, Math.PI / 2); plant(16.2, 21.2);

  // ---- lights: one panel a space, on where a night floor would leave one burning (the scenarios' own 'room lights' knobs name the groups) ----
  grp('lights');
  ceilingPanel(14.5, 10.5, false, 'room_a'); ceilingPanel(24.5, 10.5, true, 'room_b', false, 1.2, 0.6, [7, 6.8, 6.4]); ceilingPanel(23.5, 18.7, false, 'room_c');
  ceilingPanel(15, 14.2, true, 'hall', false, 1.2, 0.3); ceilingPanel(25, 14.2, false, 'hall', false, 1.2, 0.3); ceilingPanel(13.5, 18.7, false, 'lobby');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the breaker (the hall's east end) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [29.84, 1.35, 14.2], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [29.79, 1.62, 14.02], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [20, H - 0.06, 14.2], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [20, H - 0.19, 14.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors: a leaf in every doorway but the arch (closedDir 0: the leaf runs +x from the hinge along a z-wall; π/2: +z along an x-wall) ----
  const doors: LevelDoorDef[] = [
    { name: 'a', hinge: [14.02, 13.0], closedDir: 0, width: 1.16 },
    { name: 'b', hinge: [24.02, 13.0], closedDir: 0, width: 1.16 },
    { name: 'c', hinge: [19.42, 15.4], closedDir: 0, width: 1.16 },
    { name: 'ab', hinge: [19.0, 10.02], closedDir: Math.PI / 2, width: 1.06 },
    { name: 'exit', hinge: [30.0, 19.02], closedDir: Math.PI / 2, width: 1.16, exterior: true },
  ];
  for (const d of doors) doorFrame(d);

  // the rooms' floors inside their walls
  const A: Rect = { x0: 10.12, x1: 18.94, z0: 8.12, z1: 12.94 }, B: Rect = { x0: 19.06, x1: 29.88, z0: 8.12, z1: 12.94 }, Cr: Rect = { x0: 17.06, x1: 29.88, z0: 15.46, z1: 21.88 };

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [29.7, 1.35, 14.2], boxes: [brk, brkLed] },
    beacons: [{ pos: [20, H - 0.3, 14.2], box: dome }],
    playerSpawn: [12.3, 0, 19.6],
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the scenarios bring their own casts
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the scenarios stand the mission still): room A, a point on its west wall, the outside door
    mission: { serverRoom: { ...A }, entryDoor: 'a', rack: { index: 0, front: [10.6, 1.0, 9.0], halfW: 0.3 }, exfilDoor: 'exit', exfilX: 30.5, exfilZ: 19.6 },
  };

  // ---- what the scenarios take from this level ----
  const DOOR_B: Vec3 = [24.6, 1.1, 12.9];   // the point on the hostage room's hall door the men inside keep their guns on
  const scenarios: LevelScenarios = {
    // THE ROOM CLEAR: A, B and C, four men. No breach plan on this level, so the structure says where the team starts (the lobby) — with four marks, for the four.
    roomClear: {
      name: 'test rooms',
      team: { sam: [12.3, 0, 17.6], samYaw: Math.PI, ops: [[11.3, 0, 18.6], [13.3, 0, 18.6], [11.3, 0, 20.0], [13.3, 0, 20.0]], opsYaw: Math.PI },
      rooms: [
        { id: 'a', name: 'west room', bounds: A, garrison: 1,
          doors: [{ id: 'a', from: 'hall' }, { id: 'ab', from: 'east room' }],
          marks: [
            { pos: [16.4, 0, 9.6], watch: 'a', aimAt: [14.6, 1.1, 12.9] },
            { pos: [11.4, 0, 12.0], watch: 'a', aimAt: [14.6, 1.1, 12.9] },
            { pos: [13.2, 0, 11.2], watch: 'ab', aimAt: [18.9, 1.1, 10.55] },
          ] },
        { id: 'b', name: 'east room', bounds: B, garrison: 2,
          doors: [{ id: 'b', from: 'hall' }, { id: 'ab', from: 'west room' }],
          marks: [
            { pos: [28.4, 0, 10.6], watch: 'b', aimAt: [24.6, 1.1, 12.9] },
            { pos: [21.2, 0, 12.0], watch: 'ab', aimAt: [19.1, 1.1, 10.55] },
            { pos: [22.6, 0, 10.2], watch: 'b', aimAt: [24.6, 1.1, 12.9] },
          ] },
        { id: 'c', name: 'south room', bounds: Cr, garrison: 1,
          doors: [{ id: 'c', from: 'hall' }, { id: 'exit', from: 'outside' }],
          marks: [
            { pos: [27.6, 0, 19.2], watch: 'c', aimAt: [20.0, 1.1, 15.5] },
            { pos: [18.4, 0, 18.6], watch: 'c', aimAt: [20.0, 1.1, 15.5] },
          ] },
      ],
    },
    // THE HOSTAGE RESCUE: the hostages in B (its hall door 'b', its side door 'ab' from A), the team in the lobby, the route along the hall past A's door and C's.
    rescue: {
      team: { sam: [12.3, 0, 17.6], samYaw: Math.PI, ops: [[11.3, 0, 18.6], [13.3, 0, 18.6]], opsYaw: Math.PI },
      room: { name: 'east room', where: 'far end of the hall', door: 'b', bounds: B, lights: 'room_b', doorAim: DOOR_B },
      side: { door: 'ab', hold: [19.1, 0, 10.55], from: { door: 'a', bounds: A } },
      hostages: [{ pos: [28.7, 0, 9.0], face: 0 }, { pos: [24.4, 0, 8.9], face: 0.3 }],
      captor: { pos: [27.6, 0, 11.4], aimAt: DOOR_B },
      doorMan: { inside: { pos: [21.4, 0, 9.9], aimAt: DOOR_B }, outside: { pos: [28.6, 0, 14.2], aimAt: [18, 1.1, 14.2] } },
      roamers: [{ pos: [26.8, 0, 17.4], aimAt: [20.0, 1.1, 15.5] }, { pos: [16.4, 0, 9.6], aimAt: [14.6, 1.1, 12.9] }],
      flow: {
        corridor: { x0: 10.12, x1: 29.88, z0: 13.06, z1: 15.34 },
        regions: [{ id: 'a', door: null, rect: A }, { id: 'c', door: null, rect: Cr }],
        route: [
          { id: 'a', name: 'west room', short: 'west', region: 'a', kind: 'door', door: 'a', at: [14.6, 0, 13.0], mark: [13.7, 0, 14.75], watch: [14.6, 1.05, 13.0], half: 0.55, north: true, call: 'door left.', side: 'left', look: 0.4 },
          { id: 'c', name: 'south room', short: 'south', region: 'c', kind: 'door', door: 'c', at: [20.0, 0, 15.4], mark: [19.1, 0, 13.65], watch: [20.0, 1.05, 15.4], half: 0.55, north: false, call: 'door right.', side: 'right', look: 0.4 },
        ],
        hold: { ahead: 9, xMax: 28, z: 14.2 },
      },
    },
  };
  return { level, scenarios, groups: trace.groups };
}
