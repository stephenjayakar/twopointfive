// KIT-YARD: the map kit's own throwaway — NOT a level to play for its own sake, and not in the start card's table. A walled yard with two small buildings,
// two gates and three rooms to take, there so that tools/qa/map-check.ts and tools/qa/map-plan.ts have a map that is none of the office's shell to be
// proved on: outside doors as ways in, a team that starts outside the wall, open ground between the buildings, and a `squads` block in the format of
// rebuild/enemy-squads/squad-format.md (two squads that hold rooms and one that arrives later by the south gate).
//
//        x 8  10          17          24                 32
//   z 6  ┌────┬───────────┬───────────┬──────────────────┐
//        │    │  bunks    nm  radio   │                  │      the bunkhouse: two rooms off the yard ('n_w', 'n_e'), joined by 'nm'
//   z 12 │    └────n_w────┴────n_e────┘                  │
//  gate_w                    the yard                    │      'gate_w' (west wall, z 13.4‥14.6): the team starts outside it
//   z 16 │                          ┌────────s_n─────────┤
//        │                         s_w      store        │      the store: 's_n' and 's_w' off the yard
//   z 22 └──────────────gate_s──────┴────────────────────┘      'gate_s' (south wall, x 19.4‥20.6): the late squad's way in
//
// A MAP THREAD COPIES tools/levels/block.ts (a real map) or this file (the smallest that passes): `build()` returns the Level, the scenarios block and the
// editor groups; `bun run tools/levels/export.ts <name>` writes levels/<name>.json; `bun run tools/qa/map-check.ts <name>` says whether it holds.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'kit-yard';
export const NOTES = 'The map kit\'s throwaway test map: a walled yard, two buildings, three rooms, three squads. Regenerate: bun run tools/levels/export.ts kit-yard';

/** `more`: a floor built on this one adds its own boxes with the same kit (tools/levels/sneak-lab.ts) */
export function build(more?: (K: ReturnType<typeof officeKit>) => void): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, wallX, wallZ, desk, monitor, chair, cabinet, shelf, bench, cardboardBox, ceilingPanel, doorFrame, lights, switchables } = K;

  // ---- ground, floors, roofs (the yard has none: open sky) ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  grp('floors');
  slab(10, 0, 6, 24, 0.004, 12, C.lino, { flags: BoxFlag.Gloss });      // the bunkhouse
  slab(22, 0, 16, 32, 0.004, 22, C.carpet);                              // the store
  grp('ceiling');
  slab(9.9, H, 5.9, 24.1, H + 0.2, 12.1, C.ceiling, { flags: BoxFlag.NoPrimary });
  slab(21.9, H, 15.9, 32.1, H + 0.2, 22.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // ---- the yard's wall, with its two gates ----
  grp('walls.exterior');
  wallX(6, 7.88, 32.12, 0.24, C.concrete);                                                        // north
  wallX(22, 7.88, 32.12, 0.24, C.concrete, [{ a: 19.4, b: 20.6, y0: 0, y1: 2.2 }]);               // south, the south gate
  wallZ(8, 6, 22, 0.24, C.concrete, [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }]);                      // west, the west gate
  wallZ(32, 6, 22, 0.24, C.concrete);                                                             // east
  // ---- the bunkhouse (against the north wall) and the store (in the south-east corner) ----
  grp('walls.bunkhouse');
  wallX(12, 9.88, 24.12, 0.24, C.concrete, [{ a: 13, b: 14.2 }, { a: 20, b: 21.2 }]);            // its south wall: a door into each room
  wallZ(10, 6.12, 12, 0.24, C.concrete); wallZ(24, 6.12, 12, 0.24, C.concrete);
  wallZ(17, 6.12, 11.88, 0.12, C.wall, [{ a: 8.4, b: 9.5 }]);                                     // bunks | radio
  grp('walls.store');
  wallX(16, 21.88, 32, 0.24, C.concrete, [{ a: 25, b: 26.2 }]);
  wallZ(22, 16, 21.88, 0.24, C.concrete, [{ a: 18.4, b: 19.6 }]);

  // ---- furniture: something to break a line in every room and across the yard ----
  grp('room.bunks');
  bench(10.6, 8.0, Math.PI / 2); bench(10.6, 10.4, Math.PI / 2); cabinet(16.4, 6.6, 0);
  grp('room.radio');
  desk(21.6, 6.9, 1.8, 0.8, 0); monitor(21.6, 6.8, 0, true); chair(21.6, 7.8, Math.PI); cabinet(23.4, 10.6, -Math.PI / 2);
  grp('room.store');
  shelf(27.4, 21.5, 2.6, 0.45, 0, 4, 1.9); shelf(31.5, 18.4, 2.0, 0.45, Math.PI / 2, 4, 1.9); cardboardBox(23.2, 20.8, 0.5, 0.3); cardboardBox(29.6, 17.2, 0.45, 0.7);
  grp('yard');
  add({ c: [15.0, 0.5, 15.2], h: [1.1, 0.5, 0.5], albedo: C.concrete });                          // a low block of concrete to fight from
  add({ c: [19.0, 0.5, 18.6], h: [0.5, 0.5, 1.0], albedo: C.concrete });
  cardboardBox(27.6, 13.4, 0.55, 0.2); cardboardBox(12.2, 19.6, 0.5, 0.5);

  // ---- lights: a panel a room, one lamp over the yard, the moon ----
  grp('lights');
  ceilingPanel(13.5, 9.0, true, 'bunks'); ceilingPanel(20.5, 9.0, false, 'radio'); ceilingPanel(27.0, 19.0, true, 'store');
  grp('exterior.lamps');
  { const x = 31.4, z = 14.0, dir: Vec3 = [-1, 0, 0], yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, 5.24, z], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: [40, 24, 7], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z], dir: [dir[0] * 0.35, -1, 0], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name: 'yard_lamp', group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true }); }
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the breaker (the store's north wall, inside) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [30.0, 1.35, 16.16], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [29.82, 1.62, 16.21], h: [0.015, 0.015, 0.01], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [20.5, H - 0.06, 10.6], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [20.5, H - 0.19, 10.6], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along a z-wall; π/2: +z along an x-wall). The two gates are the OUTSIDE doors ----
  const doors: LevelDoorDef[] = [
    { name: 'gate_w', hinge: [8.0, 13.42], closedDir: Math.PI / 2, width: 1.16, exterior: true },
    { name: 'gate_s', hinge: [19.42, 22.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'n_w', hinge: [13.02, 12.0], closedDir: 0, width: 1.16 },
    { name: 'n_e', hinge: [20.02, 12.0], closedDir: 0, width: 1.16 },
    { name: 'nm', hinge: [17.0, 8.42], closedDir: Math.PI / 2, width: 1.06 },
    { name: 's_n', hinge: [25.02, 16.0], closedDir: 0, width: 1.16 },
    { name: 's_w', hinge: [22.0, 18.42], closedDir: Math.PI / 2, width: 1.16 },
  ];
  for (const d of doors) doorFrame(d);
  more?.(K);

  const BUNKS: Rect = { x0: 10.12, x1: 16.94, z0: 6.12, z1: 11.88 }, RADIO: Rect = { x0: 17.06, x1: 23.88, z0: 6.12, z1: 11.88 }, STORE: Rect = { x0: 22.12, x1: 31.88, z0: 16.12, z1: 21.88 };

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [30.0, 1.35, 16.3], boxes: [brk, brkLed] },
    beacons: [{ pos: [20.5, H - 0.3, 10.6], box: dome }],
    playerSpawn: [5.6, 0, 14.0],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still)
    mission: { serverRoom: { ...RADIO }, entryDoor: 'n_e', rack: { index: 0, front: [23.4, 1.0, 9.0], halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: 6.5, exfilZ: 14.0 },
  };

  // ---- the room clear, with its squads ----
  const roomClear: StructureData & { squads: unknown[] } = {
    name: 'kit yard', maxMen: 8,
    team: { sam: [5.6, 0, 14.0], samYaw: Math.PI / 2, ops: [[6.6, 0, 12.9], [6.6, 0, 15.1], [4.6, 0, 12.9], [4.6, 0, 15.1]], opsYaw: Math.PI / 2 },
    rooms: [
      { id: 'bunks', name: 'bunks', bounds: BUNKS, garrison: 2,
        doors: [{ id: 'n_w', from: 'yard' }, { id: 'nm', from: 'radio room' }],
        marks: [
          { pos: [15.8, 0, 8.4], watch: 'n_w', aimAt: [13.6, 1.1, 11.84] },
          { pos: [12.4, 0, 6.8], watch: 'n_w', aimAt: [13.6, 1.1, 11.84] },
          { pos: [12.6, 0, 9.4], watch: 'nm', aimAt: [16.94, 1.1, 8.95] },
        ] },
      { id: 'radio', name: 'radio room', bounds: RADIO, garrison: 2,
        doors: [{ id: 'n_e', from: 'yard' }, { id: 'nm', from: 'bunks' }],
        marks: [
          { pos: [18.4, 0, 6.8], watch: 'n_e', aimAt: [20.6, 1.1, 11.84] },
          { pos: [22.8, 0, 9.0], watch: 'nm', aimAt: [17.06, 1.1, 8.95] },
          { pos: [19.6, 0, 9.6], watch: 'n_e', aimAt: [20.6, 1.1, 11.84] },
        ] },
      { id: 'store', name: 'store', bounds: STORE, garrison: 2,
        doors: [{ id: 's_n', from: 'yard' }, { id: 's_w', from: 'yard' }],
        marks: [
          { pos: [30.4, 0, 20.2], watch: 's_n', aimAt: [25.6, 1.1, 16.16] },
          { pos: [24.2, 0, 21.2], watch: 's_n', aimAt: [25.6, 1.1, 16.16] },
          { pos: [28.4, 0, 19.0], watch: 's_w', aimAt: [22.16, 1.1, 19.0] },
        ] },
    ],
    // (rebuild/enemy-squads/squad-format.md: the game at this commit does not read it; map-check.ts holds it to its rules, map-plan.ts draws it)
    squads: [
      { id: 'north', name: 'North', rooms: ['bunks', 'radio'], rally: [19.6, 0, 8.6] },
      { id: 'store', name: 'Store', rooms: ['store'], rally: [26.4, 0, 19.2], barricade: ['s_w'], mayLeave: false },
      { id: 'late', name: 'Late', arrive: { door: 'gate_s', spawn: [[19.4, 0, 24.6], [20.6, 0, 24.6]], men: 2 } },
    ],
  };
  // ---- what is underfoot (game/floor.ts: which footstep sounds, and how far it carries to their ears). `building` is the floor the zones are laid over — here
  //      the whole walled yard, asphalt — and each zone a rectangle of another finish, the first that holds a point winning. Without this block a map gets the
  //      OFFICE's map: carpet across x 4‥36, z 4‥24, its yard included.
  const surfaces: SurfacesData = {
    building: { x0: 8, x1: 32, z0: 6, z1: 22 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'bunkhouse', mat: 'lino', x0: 10, z0: 6, x1: 24, z1: 12 },
      { id: 'store', mat: 'carpet', x0: 22, z0: 16, x1: 32, z1: 22 },
    ],
  };
  return { level, scenarios: { roomClear, doorNames: [{ door: 'gate_w', name: 'foot gate' }, { door: 'gate_s', name: 'road gate' }] }, groups: trace.groups, surfaces };
}
