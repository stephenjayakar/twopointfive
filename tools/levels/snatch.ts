// THE SNATCH: a mud-brick house in a walled yard, held by five men around ONE unarmed man the team has to take ALIVE (src/game/snatch.ts — the overlay on
// this level's room clear; the block `scenarios.snatch` below is what switches it on). The idea the level is built for: the moment the floor goes loud he
// runs for the nearest way out, and his wing has two doors to the open air — the back door (north) and his own side door (east) — which both lead round to
// ONE back gate in the yard's north-east corner. Go in the front with everybody and he is through that gate before the first room is taken; put a pair on the
// back gate first and he meets rifles whichever door he came out of, and gives up.
//
//        x 7        12        18   20        26        32
//   z 3  ┌──────────────────────────────────────────────┐
//        │  back alley                               ░░░│ back gate (east wall, z 4.5‥6) → the way out
//   z 8  │         ┌──────back─┬────────────────┐       │
//        │         │ back room │   HIS ROOM   side      │      his ─ the door between the back room and his room
//   z 13 │         ├─back_room─┴───┬────────────┤  side │      back_room ─ main room | back room
//        │         │  main room kitchen kitchen │  yard │      kitchen   ─ main room | kitchen
//   z 18 │         └─────front─────┴────────────┘       │
//        │                courtyard                     │
//   z 23 └────────────────┤ south gate ├────────────────┘
//                          the team starts here (x 16, z 25.4)
//
// Built from the 2010s kit (src/scene/gwotKit.ts): flat colours, boxes only. Regenerate: bun run tools/levels/export.ts snatch
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_PART } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'snatch';
export const NOTES = 'The snatch: a house in a walled yard, eight men around one unarmed man to take alive; two doors of his wing lead to one back gate, and a dark hut with two men in it stands on that gate. Regenerate: bun run tools/levels/export.ts snatch';
/** the kit's palette goes into the file's `materials` (tools/levels/export.ts) */
export const MATERIALS = GWOT_MATERIALS;

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;

  // ---- ground: dust to the horizon, packed dirt inside the yard wall, the track up to the south gate ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(7, 3, 32, 23, 'dirt');
  G.ground(13, 23.2, 19, 28, 'gravel');
  G.patch(16, 21.4, 3.4, 2.4, 'gravel'); G.patch(29.2, 12.5, 2.4, 3.6, 'dust', 0.2); G.patch(21.5, 5.2, 4.2, 1.8, 'dust', -0.1); G.patch(10.6, 20.4, 1.3, 0.8, 'oil', 0.3);
  G.ruts(16, 28, 16, 21.4);
  grp('floors');
  G.ground(12, 8, 26, 18, 'mudFloor', 0.006);                                    // the house: beaten earth under the rugs
  G.ground(29, 6.6, 31.76, 10.4, 'mudFloor', 0.006);                               // the gate hut
  grp('ceiling');
  slab(11.9, H, 7.9, 26.1, H + 0.2, 18.1, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(28.86, H, 6.46, 31.9, H + 0.2, 10.54, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });

  // ---- the yard wall (2.4 m, coped): the south gate the team comes in by, the back gate he runs for ----
  grp('walls.yard');
  G.yardWallX(3, 6.88, 32.12);                                                                             // north
  G.yardWallX(23, 6.88, 32.12, 'mud', [{ a: 14.5, b: 17.5, y0: 0, y1: 2.4 }]);                             // south, the vehicle gate
  G.yardWallZ(7, 3, 23);                                                                                   // west
  G.yardWallZ(32, 3, 23, 'mud', [{ a: 4.5, b: 6.0, y0: 0, y1: 2.4 }]);                                     // east, the back gate: a gap, its leaf long gone
  for (const [x, z] of [[7, 3], [7, 23], [32, 3], [32, 23], [14.5, 23], [17.5, 23], [32, 6.1], [7, 13], [32, 14]] as const) G.pier(x, z);
  G.gate(16, 23, 'x', 3.0, -1, 'paintBlue', 80);
  G.skirt('x', 23, 7, 14.4, -1); G.skirt('x', 23, 17.6, 32, -1); G.skirt('z', 7, 3, 23, 1); G.skirt('x', 3, 7, 32, 1);   // the damp foot of the wall, inside

  // ---- the house (mud-brick): four rooms, three doors to the open air ----
  grp('walls.house');
  G.wallX(8, 11.88, 26.12, 'mud', [{ a: 16.4, b: 17.6 }]);                                                 // north: the back door
  G.wallX(18, 11.88, 26.12, 'mud', [{ a: 15.4, b: 16.6 }]);                                                // south: the front door
  G.wallZ(12, 8.12, 17.88, 'mud');                                                                         // west
  G.wallZ(26, 8.12, 17.88, 'mud', [{ a: 10, b: 11.2 }]);                                                   // east: his side door
  G.partX(13, 12.12, 25.88, 'mudLight', [{ a: 14, b: 15.2 }]);                                             // main room, kitchen | back room, his room
  G.partZ(20, 13.06, 17.88, 'mudLight', [{ a: 15, b: 16.2 }]);                                             // main room | kitchen
  G.partZ(18, 8.12, 12.94, 'mudLight', [{ a: 10, b: 11.2 }]);                                              // back room | his room
  G.dado('x', 13, 12.12, 13.9, 1); G.dado('x', 13, 15.3, 19.94, 1); G.dado('z', 12, 13.06, 17.88, 1);      // the main room's blue dado
  G.dado('x', 8, 18.06, 25.88, 1, 'paintGreen'); G.dado('z', 26, 8.12, 9.9, -1, 'paintGreen'); G.dado('z', 26, 11.3, 12.94, -1, 'paintGreen');   // his room's green one

  // ---- the main room: where the guards sit — rugs, cushions round two walls, tea, a stove, their kit in a corner ----
  grp('room.main');
  G.rug(16.4, 15.5, 3.0, 2.2, 'afghan'); G.rug(13.6, 16.9, 1.2, 0.8, 'felt', 0.15);
  G.toshak(12.55, 15.3, 1.9, HALF); G.toshak(17.7, 13.45, 1.9, 0, 'rugNavy', 'rugRed');
  G.lowTable(17.5, 15.1, 0); G.stove(19.35, 13.6);
  G.trunk(12.6, 13.55, HALF, 'paintGreen'); G.crates(19.3, 17.35, 0, 2);
  G.wallHanging('z', 12, 16.9, 1, 'baluch', 1.0, 0.7);
  // ---- the kitchen: a table under the wall, water, flour, gas ----
  grp('room.kitchen');
  G.table(23.2, 13.55, 1.6, 0.75, 0); G.gasBottle(25.5, 13.5); G.plasticChair(22.4, 14.5, 0.3);
  G.sacks(25.3, 17.3, 0, 3); G.drums(21.0, 17.35, 2); G.jerryCan(22.2, 17.55, 0.2, 'jerryYellow'); G.jerryCan(22.6, 17.5, -0.1, 'jerryYellow');
  G.rug(23.2, 15.6, 2.0, 1.4, 'mat');
  // ---- the back room: the store, and one cot for whoever has the night ----
  grp('room.back');
  G.crates(12.8, 8.7, 0, 3); G.crates(13.95, 8.7, 0, 2, 'coyote'); G.sacks(12.7, 12.35, 0, 4);
  G.cot(12.75, 10.5, HALF, false, 'blanketBrown'); G.tyres(15.6, 8.6, 2);
  // ---- his room: the good rug, a rope bed, his papers on a table, tea by a lantern ----
  grp('room.his');
  G.rug(22.2, 10.5, 3.2, 2.4, 'afghan'); G.wallHanging('x', 8, 23.6, 1, 'baluch', 1.2, 0.8);
  G.toshak(21.6, 8.45, 1.9, 0); G.lowTable(22.2, 9.6, 0); G.lantern(21.92, 9.6, 'lantern_his', 'his', 0.3);
  G.charpoy(22.9, 12.4, 0); G.trunk(25.4, 8.6, HALF, 'paintBlue');
  G.table(19.5, 12.5, 1.3, 0.7, 0); G.plasticChair(19.5, 11.75, Math.PI, 'plasticGreen');

  // ---- the gate hut (mud-brick, hard by the back gate): one man with the night, his door on the gate, an open window on the passage up the side yard ----
  grp('walls.hut');
  G.wallX(6.6, 28.88, 31.88, 'mud', [{ a: 29.8, b: 31.0 }]);                                               // north: its door, a stride from the back gate
  G.wallX(10.4, 28.88, 31.88, 'mud');                                                                       // south
  G.wallZ(29, 6.72, 10.28, 'mud', [{ a: 7.7, b: 8.7, y0: 1.0, y1: 1.9 }]);                                  // west: the window, no glass in it
  G.wallZ(31.76, 6.72, 10.28, 'mud');                                                                       // east, against the yard wall
  grp('room.hut');
  G.cot(30.4, 9.85, 0, false, 'blanketGrey'); G.trunk(31.3, 7.2, HALF, 'paintGreen'); G.plasticChair(29.6, 7.25, 1.9);
  G.lantern(29.4, 9.1, 'lantern_hut', 'hut', 0, false); G.rug(30.4, 8.2, 1.4, 1.0, 'mat');

  // ---- the yard: their truck, a low wall of bags inside the gate, what a household leaves outside ----
  grp('yard');
  G.pickup(10.4, 20.2, 0.1, 'truckWhite', { load: 'sacks' });
  G.sandbags(20.2, 21.0, 2.2, 0, 3); G.drums(24.6, 21.9, 3); G.woodPile(9.2, 16.2, HALF);
  G.washLine(8.6, 9.5, 8.6, 14.2, 4); G.tandoor(10.4, 12.4);
  G.generator(30.9, 16.2, HALF); G.jerryCan(30.9, 17.4, 0.6); G.wire(30.9, 16.2, 26, 15.5, 2.75);
  G.charpoy(29.9, 20.6, 0.2, null); G.plasticChair(28.4, 21.2, -2.2);
  G.waterTank(23.0, 7.25, 'plasticBlue', 1.1); G.rubble(9.4, 4.5, 0.8, 8); G.tyres(13.0, 7.4, 2); G.blocks(28.6, 3.6, 0.1, 2);
  grp('outside');
  G.bush(4.6, 20.4); G.bush(35.2, 21.0, 1.2); G.bush(3.6, 6.2, 0.9); G.bush(24.0, 1.4, 1.1); G.rubble(35.4, 9.2, 1.0, 8, 'block');
  G.hesco(11.6, 24.4, 2, 0); G.jersey(21.4, 25.6, 1, 0.4);

  // ---- lights: a bulb in the rooms the guards use, his lantern, a floodlight over the courtyard, the moon; the side yard is lit by the generator's lamp; the back alley, the hut and the back gate behind it are dark ----
  grp('lights');
  G.bulb(16.2, 15.6, 'bulb_main', 'main', true); G.bulb(23.0, 15.6, 'bulb_kitchen', 'kitchen', true); G.bulb(15.0, 10.5, 'bulb_back', 'back', false); G.bulb(22.4, 11.0, 'bulb_his', 'his', false);
  G.floodLight(7.5, 21.8, [1, -0.2], 'flood_yard', true);
  G.floodLight(31.5, 17.9, [-0.45, -1], 'flood_east', true);   // the generator's own lamp, up the side yard: the short way to the back gate is lit and the hut's window looks onto it; the hut itself sits dark
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the breaker (the main room's south wall, inside) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [13.4, 1.35, 17.84], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [13.22, 1.62, 17.79], h: [0.015, 0.015, 0.01], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [16, H - 0.06, 14.2], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [16, H - 0.19, 14.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along a z-wall; π/2: +z along an x-wall) ----
  const doors: LevelDoorDef[] = [
    { name: 'front', hinge: [15.42, 18.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'back', hinge: [16.42, 8.0], closedDir: 0, width: 1.16, exterior: true, swing: -1 },   // opens out into the back alley: the one outside door of the house no wedge inside holds, and the inner doors carry on from the back room (tools/qa/second-way-check.ts)
    { name: 'side', hinge: [26.0, 10.02], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'back_room', hinge: [14.02, 13.0], closedDir: 0, width: 1.16 },
    { name: 'kitchen', hinge: [20.0, 15.02], closedDir: HALF, width: 1.16, swing: 1 },   // opens into the main room, and the hut's door outward: each is its room's one door, and no wedge inside holds a door that opens away (tools/qa/second-way-check.ts)
    { name: 'his', hinge: [18.0, 10.02], closedDir: HALF, width: 1.16 },
    { name: 'hut', hinge: [29.82, 6.6], closedDir: 0, width: 1.16, exterior: true, swing: -1 },
  ];
  for (const d of doors) doorFrame(d);

  // the rooms' floors inside their walls
  const MAIN: Rect = { x0: 12.12, x1: 19.94, z0: 13.06, z1: 17.88 }, KITCHEN: Rect = { x0: 20.06, x1: 25.88, z0: 13.06, z1: 17.88 };
  const HUT: Rect = { x0: 29.12, x1: 31.64, z0: 6.72, z1: 10.28 };
  const BACK: Rect = { x0: 12.12, x1: 17.94, z0: 8.12, z1: 12.94 }, HIS: Rect = { x0: 18.06, x1: 25.88, z0: 8.12, z1: 12.94 };

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [13.4, 1.35, 17.7], boxes: [brk, brkLed] },
    beacons: [{ pos: [16, H - 0.3, 14.2], box: dome }],
    playerSpawn: [16, 0, 25.4],
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the room clear brings its own cast
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still): his room, a point on its north wall, the front door
    mission: { serverRoom: { ...HIS }, entryDoor: 'his', rack: { index: 0, front: [23.6, 1.0, 8.5], halfW: 0.3 }, exfilDoor: 'front', exfilX: 16.0, exfilZ: 18.6, exfilOut: [0, 1] },
  };

  const FRONT: Vec3 = [16.0, 1.1, 17.9], MB_S: Vec3 = [14.6, 1.1, 13.1], MB_N: Vec3 = [14.6, 1.1, 12.9], MK: Vec3 = [20.1, 1.1, 15.6];
  const BACK_D: Vec3 = [17.0, 1.1, 8.1], HIS_W: Vec3 = [17.9, 1.1, 10.6], HIS_E: Vec3 = [18.1, 1.1, 10.6], SIDE: Vec3 = [25.9, 1.1, 10.6], HUT_D: Vec3 = [30.4, 1.1, 6.7];
  const scenarios: LevelScenarios = {
    // THE ROOM CLEAR the snatch runs over: four rooms and the gate hut, eight men. No breach plan on this level, so the structure says where the team starts (outside the south gate).
    roomClear: {
      name: 'the house', maxMen: 8,
      team: { sam: [16, 0, 25.4], samYaw: Math.PI, ops: [[15, 0, 26.3], [17, 0, 26.3], [15, 0, 27.2], [17, 0, 27.2]], opsYaw: Math.PI },
      rooms: [
        { id: 'main', name: 'main room', bounds: MAIN, garrison: 2,
          doors: [{ id: 'front', from: 'courtyard' }, { id: 'back_room', from: 'back room' }, { id: 'kitchen', from: 'kitchen' }],
          marks: [
            { pos: [18.6, 0, 14.6], watch: 'front', aimAt: FRONT },
            { pos: [13.5, 0, 14.5], watch: 'front', aimAt: FRONT },
            { pos: [18.0, 0, 16.9], watch: 'back_room', aimAt: MB_S },
          ] },
        { id: 'kitchen', name: 'kitchen', bounds: KITCHEN, garrison: 2,
          doors: [{ id: 'kitchen', from: 'main room' }],
          marks: [
            { pos: [24.8, 0, 15.2], watch: 'kitchen', aimAt: MK },
            { pos: [24.0, 0, 16.6], watch: 'kitchen', aimAt: MK },
          ] },
        { id: 'back', name: 'back room', bounds: BACK, garrison: 1,
          doors: [{ id: 'back_room', from: 'main room' }, { id: 'back', from: 'back alley' }, { id: 'his', from: 'his room' }],
          marks: [
            { pos: [13.9, 0, 10.0], watch: 'back_room', aimAt: MB_N },
            { pos: [15.4, 0, 11.8], watch: 'back', aimAt: BACK_D },
          ] },
        { id: 'his', name: 'his room', bounds: HIS, garrison: 1,
          doors: [{ id: 'his', from: 'back room' }, { id: 'side', from: 'side yard' }],
          marks: [
            { pos: [24.6, 0, 9.5], watch: 'his', aimAt: HIS_E },
            { pos: [19.3, 0, 9.0], watch: 'side', aimAt: SIDE },
          ] },
        { id: 'hut', name: 'gate hut', bounds: HUT, garrison: 2,
          doors: [{ id: 'hut', from: 'side yard' }],
          marks: [
            { pos: [31.0, 0, 8.5], watch: 'hut', aimAt: HUT_D },
            { pos: [29.8, 0, 8.8], watch: 'hut', aimAt: [28.6, 1.4, 8.2] },
          ] },
      ],
    },
    // THE MAN (game/snatch.ts): he keeps to his room while the floor is quiet; the back gate is his way out, the front gate the long one through the team
    snatch: {
      man: { name: 'Daoud', pos: [23.2, 0, 10.7], face: -HALF, tint: [0.66, 0.62, 0.52], tint2: [0.3, 0.27, 0.22], points: [[23.2, 0, 10.7], [20.6, 0, 11.6]], wait: [45, 20] },
      exits: [{ name: 'the back gate', pos: [33.4, 0, 5.25] }, { name: 'the front gate', pos: [16, 0, 24.6] }],
    },
    places: { areas: [
      { name: 'the courtyard', bounds: { x0: 7.2, x1: 31.8, z0: 18.2, z1: 22.8 } }, { name: 'the back alley', bounds: { x0: 7.2, x1: 26, z0: 3.2, z1: 7.8 } },
      { name: 'the side yard', bounds: { x0: 26.2, x1: 31.8, z0: 3.2, z1: 18.2 } }, { name: 'the wash yard', bounds: { x0: 7.2, x1: 11.8, z0: 7.8, z1: 18.2 } },
    ] },
  };
  // ---- what is underfoot (game/floor.ts): the yard is 'asphalt' (the nearest the six have to earth), the house's beaten floor stone, the rugs carpet
  const surfaces: SurfacesData = {
    building: { x0: 12, x1: 26, z0: 8, z1: 18 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'main_rug', mat: 'carpet', x0: 14.9, z0: 14.4, x1: 17.9, z1: 16.6 },
      { id: 'his_rug', mat: 'carpet', x0: 20.6, z0: 9.3, x1: 23.8, z1: 11.7 },
      { id: 'house', mat: 'stone', x0: 12, z0: 8, x1: 26, z1: 18 },
      { id: 'hut', mat: 'stone', x0: 29, z0: 6.6, x1: 31.76, z1: 10.4 },
    ],
  };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the level's own south gate, where the team starts. Its two
  // blue leaves stand folded open, so the way is anchored on the opening between the gate piers, and the courtyard and the house's front are seen through it.
  // The stack is on the wall west of the gate (`side`), where the two earth-filled baskets outside the wall stand: they are out of this picture (`hide`: the
  // camera's own test takes them out whichever side the stack is on), and with them the rest of what lies outside the wall.
  // (the picture's lamp is hung on the gate pier at the stack's end of the opening: left to be measured it hangs over the anchor's middle, which on a gap is open air)
  scenarios.kitView = { ways: [{ span: [[14.72, 23], [17.28, 23]], side: -1, hide: ['outside'], light: { porch: { offset: [1.61, 0.77, 2.38], aim: [3.2, 1.6, 0], fixture: { at: [1.61, 0.27, 2.25], half: [0.17, 0.045, 0.05], glow: 5 } } } }] };
  return { level, scenarios, groups: trace.groups, surfaces };
}
function norm(v: Vec3): Vec3 { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
