// GWOT-YARD: the GWOT kit's SHOWROOM (src/scene/gwotKit.ts) — NOT a level to play for its own sake and not in the missions list. A walled family compound with
// a two-room guest house, a rendered store, a yard and the road outside, with EVERY piece of the kit stood in it once, so the kit can be exported, linted,
// loaded and looked at (?levelFile=gwot-yard.json&solo). It is also the kit's worked example: a map thread reads this file next to the guide
// (rebuild/play-style-levels/look/read-first.md) and copies the calls.
//
//        x 8  10             15.5        20                    32
//   z 6  ┌────┬──────────────┬───────────┬─────────────────────┐
//        │    │  guest room  nm  sleeping│   washing   tank    │
//   z 12 │    └──n_w───win───┴────n_e────┘  pump  oven         │      the guest house: two rooms off the yard, joined by 'nm'
//  gate_w            the yard: pickup, cart, generator, cover                'gate_w' (west wall): the way in on foot
//   z 16 │                                  ┌──────s_n─────────┤
//        │  drums   pickup        sandbags s_w      store      │      the store: 's_n' and 's_w' off the yard
//   z 22 └───────────────[ the gate ]───────┴──────────────────┘      the vehicle gate (south wall, x 18.5‥21.5): two leaves standing open
//           stalls ·  hesco      the road: gravel, barriers, a technical
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_PART } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'gwot-yard';
export const NOTES = 'The GWOT kit\'s showroom: a walled compound with every piece of src/scene/gwotKit.ts in it once. Regenerate: bun run tools/levels/export.ts gwot-yard';
/** the kit's palette goes into the file's `materials` (tools/levels/export.ts) */
export const MATERIALS = GWOT_MATERIALS;

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;

  // ---- ground: dust to the horizon, packed dirt inside the wall, a gravel road outside the gate ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(8, 6, 32, 22, 'dirt');
  G.ground(0, 23.2, 40, 27.2, 'gravel');
  G.patch(20, 21.0, 3.6, 2.6, 'gravel'); G.patch(13.5, 14.5, 3.2, 2.0, 'dust', 0.3); G.patch(26.5, 11.0, 2.6, 1.8, 'dust', -0.4); G.patch(14.4, 19.5, 1.3, 0.8, 'oil', 0.3);
  G.ruts(20, 27.2, 20, 20.6); G.ruts(20, 20.4, 16.6, 19.4); G.ruts(2, 25.2, 38, 25.2);
  grp('floors');
  G.ground(10, 6, 20, 12, 'mudFloor', 0.006);                                   // the guest house: beaten earth under the rugs
  G.ground(24, 16, 32, 22, 'slab', 0.006);                                      // the store: a bare slab
  grp('ceiling');
  slab(9.9, H, 5.9, 20.1, H + 0.2, 12.1, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(23.9, H, 15.9, 32.1, H + 0.2, 22.1, P.render, { flags: BoxFlag.NoPrimary, rough: 0.9 });

  // ---- the compound wall (2.4 m, coped), its foot gate and its vehicle gate ----
  grp('walls.yard');
  G.yardWallX(6, 7.88, 9.88); G.yardWallX(6, 20.12, 32.12);                                             // north, either side of the house
  G.yardWallX(22, 7.88, 23.88, 'mud', [{ a: 18.5, b: 21.5, y0: 0, y1: 2.4 }]);                          // south, the vehicle gate
  G.yardWallZ(8, 6, 22, 'mud', [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }]);                                 // west, the foot gate
  G.yardWallZ(32, 6, 15.88);                                                                            // east, down to the store
  for (const [x, z] of [[8, 6], [8, 22], [32, 6], [26, 6], [14, 22], [8, 10], [8, 18], [32, 11]] as const) G.pier(x, z);
  G.gate(20, 22, 'x', 3.0, -1, 'paintBlue', 80);
  G.skirt('x', 22, 8, 18.3, 1); G.skirt('x', 22, 21.7, 32, 1); G.skirt('z', 8, 6, 13.3, -1); G.skirt('z', 8, 14.7, 22, -1); G.skirt('x', 6, 20.2, 32, 1);   // the damp foot of the wall
  // ---- the guest house (mud-brick, against the north wall) ----
  grp('walls.house');
  G.wallX(6, 9.88, 20.12, 'mud');
  G.wallX(12, 9.88, 20.12, 'mud', [{ a: 12, b: 13.2 }, { a: 14.2, b: 15.0, y0: 1.0, y1: 2.0 }, { a: 17, b: 18.2 }]);   // two doors and a small window
  G.wallZ(10, 6.12, 11.88, 'mud'); G.wallZ(20, 6.12, 11.88, 'mud');
  G.partZ(15.5, 6.12, 11.88, 'mudLight', [{ a: 8.4, b: 9.5 }]);
  G.dado('x', 6, 10.12, 15.44, 1); G.dado('z', 10, 6.12, 11.88, 1); G.dado('x', 12, 10.12, 11.98, -1); G.dado('z', 15.5, 9.52, 11.88, -1, 'paintBlue', GW_PART);   // the guest room's painted dado
  G.dado('x', 6, 15.56, 19.88, 1, 'paintGreen'); G.dado('z', 20, 6.12, 11.88, -1, 'paintGreen');
  G.skirt('x', 12, 10, 11.98, 1); G.skirt('x', 12, 13.22, 16.98, 1); G.skirt('x', 12, 18.22, 20, 1);
  // ---- the store (cement render, in the south-east corner) ----
  grp('walls.store');
  G.wallX(22, 23.88, 32.12, 'render'); G.wallZ(32, 15.88, 22, 'render');
  G.wallX(16, 23.88, 32, 'render', [{ a: 26, b: 27.2 }]);
  G.wallZ(24, 16.12, 21.88, 'render', [{ a: 18.3, b: 19.5 }]);   // (the slot a hand's width north of where it was drawn: its real door (doorSize.ts) then stands clear of the sandbags outside)

  // ---- the guest room: rugs, floor cushions round the walls, tea, a stove ----
  grp('room.guest');
  G.rug(12.7, 9.1, 3.0, 3.2, 'afghan'); G.rug(14.6, 10.9, 1.2, 0.8, 'felt', 0.2);
  G.toshak(10.55, 8.0, 1.9, HALF); G.toshak(10.55, 10.2, 1.9, HALF, 'rugNavy', 'rugRed'); G.toshak(12.3, 6.55, 1.9, 0); G.toshak(14.3, 6.55, 1.9, 0, 'rugNavy', 'rugRed');
  G.lowTable(12.7, 9.1, 0); G.lantern(12.42, 9.1, 'lantern_guest', 'guest', 0.3);
  G.stove(14.95, 11.4); G.wallHanging('z', 15.5, 7.3, -1, 'baluch', 1.2, 0.8, GW_PART);
  // ---- the sleeping room: a rope bed, two cots, trunks ----
  grp('room.sleep');
  G.rug(17.6, 9.3, 1.6, 2.4, 'kilim');
  G.charpoy(18.6, 6.75, 0); G.cot(16.0, 10.75, HALF); G.cot(19.4, 9.6, HALF, true, 'blanketBrown');
  G.trunk(16.1, 6.5, 0, 'paintGreen'); G.trunk(19.55, 11.5, HALF, 'paintBlue'); G.plasticChair(19.3, 8.0, 2.2, 'plasticGreen');
  // ---- the store: crates, sacks, fuel, a table ----
  grp('room.store');
  G.crates(30.9, 16.6, 0, 3); G.crates(29.8, 16.6, 0, 1, 'coyote'); G.crates(31.4, 18.4, HALF, 2);
  G.sacks(25.0, 21.2, 0, 4); G.sacks(26.1, 21.3, 0.2, 2);
  G.drums(30.4, 20.4, 4); G.jerryCan(28.9, 21.5, 0.2); G.jerryCan(28.5, 21.55, -0.1, 'jerryYellow'); G.jerryCan(28.1, 21.5, 0.4, 'jerryYellow'); G.gasBottle(27.5, 21.5);
  G.table(28.0, 18.6, 1.6, 0.75, 0); G.plasticChair(27.6, 19.4, Math.PI); G.plasticChair(28.5, 17.8, 0.2); G.chairAs(26.3, 19.6, 2.4, 'plasticBlue');
  G.tyres(24.6, 16.6, 3); G.rug(28.0, 19.0, 2.4, 1.6, 'mat');

  // ---- the yard ----
  grp('yard');
  G.pickup(14.4, 19.5, 0.12, 'truckWhite', { load: 'drums' });
  G.sandbags(22.7, 20.3, 2.4, HALF, 4); G.sandbags(21.6, 18.95, 1.7, 0, 4);                       // the gate post: an L of bags
  G.motorbike(15.4, 12.75, 0.05);
  G.handcart(10.6, 16.6, 0.5, 'sacks');
  G.drums(8.9, 20.3, 3); G.drumDown(11.0, 21.2, 0.3); G.tyres(8.8, 18.5, 2); G.blocks(12.8, 21.4, 0.1, 2); G.rubble(9.0, 7.2, 0.9, 9);
  G.crates(18.3, 15.2, 0.3, 2); G.sacks(21.2, 15.6, 0.1, 3);
  G.generator(30.6, 13.6, HALF); G.jerryCan(29.5, 12.7, 0.6); G.jerryCan(29.6, 14.6, 1.2, 'jerryYellow');
  G.wire(30.6, 13.6, 28, 16, 2.75); G.wire(30.6, 13.6, 20, 11.9, 2.75);
  G.waterTank(30.6, 7.5, 'plasticBlue', 1.1); G.pump(23.0, 9.2, 0.4);
  G.tandoor(21.5, 11.1); G.woodPile(21.2, 7.2, HALF);
  G.charpoy(24.6, 13.0, 0.25, null); G.plasticChair(26.2, 12.4, -2.2); G.plasticChair(25.2, 14.3, 2.9, 'plasticGreen');
  G.washLine(24.6, 7.3, 28.9, 7.3, 5);
  G.satDish(20.55, 12.6, 0.6); G.gasBottle(21.0, 12.4, 'paintBlue');
  // ---- outside: the road, a checkpoint, two stalls, blast walls ----
  grp('road');
  G.hesco(16.9, 23.0, 2, 0); G.hesco(23.4, 23.0, 1, 0);
  G.jersey(12.5, 25.9, 1, 0.45); G.jersey(27.5, 24.4, 1, 0.45);
  G.pickup(31.0, 25.6, Math.PI, 'truckTan', { mount: true });
  G.stall(10.6, 23.45, Math.PI, 2.2, 'tarpBlue'); G.stall(13.4, 23.45, Math.PI, 1.7, 'rugRed');
  G.tWall(34.4, 13.5, 4, HALF); G.container(4.6, 9.4, HALF, 'paintRust');
  G.bush(5.2, 20.2); G.bush(35.0, 21.6, 1.3); G.bush(3.4, 4.6, 0.9); G.bush(25.0, 3.6, 1.1); G.rubble(34.6, 8.0, 1.0, 8, 'block');

  // ---- lights: a bulb a room, a lantern at the tea, a tube in the store, a floodlight over the yard, the moon ----
  grp('lights');
  G.bulb(13.2, 8.2, 'bulb_guest', 'guest', true); G.bulb(17.7, 9.0, 'bulb_sleep', 'sleep', false);
  G.tube(28.0, 18.6, true, 'store', true);
  grp('exterior.lamps');
  G.floodLight(31.6, 15.2, [-1, -0.25], 'flood_yard', true);
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the breaker (the store's north wall, inside) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [30.0, 1.35, 16.16], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [29.82, 1.62, 16.21], h: [0.015, 0.015, 0.01], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [17.7, H - 0.06, 10.6], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [17.7, H - 0.19, 10.6], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along a z-wall; π/2: +z along an x-wall) ----
  const doors: LevelDoorDef[] = [
    { name: 'gate_w', hinge: [8.0, 13.42], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'n_w', hinge: [12.02, 12.0], closedDir: 0, width: 1.16 },
    { name: 'n_e', hinge: [17.02, 12.0], closedDir: 0, width: 1.16 },
    { name: 'nm', hinge: [15.5, 8.42], closedDir: HALF, width: 1.06 },
    { name: 's_n', hinge: [26.02, 16.0], closedDir: 0, width: 1.16 },
    { name: 's_w', hinge: [24.0, 18.32], closedDir: HALF, width: 1.16 },
  ];
  for (const d of doors) doorFrame(d);

  const STORE: Rect = { x0: 24.12, x1: 31.88, z0: 16.12, z1: 21.88 };
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [30.0, 1.35, 16.3], boxes: [brk, brkLed] },
    beacons: [{ pos: [17.7, H - 0.3, 10.6], box: dome }],
    playerSpawn: [5.6, 0, 14.0],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    // the stealth mission's three places, because the level format wants them
    mission: { serverRoom: { ...STORE }, entryDoor: 's_n', rack: { index: 0, front: [30.9, 1.0, 17.4], halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: 6.5, exfilZ: 14.0, exfilOut: [-1, 0] },   // (out is WEST through gate_w)
  };
  // ---- what is underfoot (game/floor.ts): the six footstep materials have no word for earth — 'asphalt' is the nearest (hard, gritty, carries) — so the yard and the
  //      road are asphalt, the beaten-earth house floor and the store's slab stone, and the rugs carpet (gwotKit.ts GWOT_SURFACE says which is which)
  const surfaces: SurfacesData = {
    building: { x0: 8, x1: 32, z0: 6, z1: 22 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'guest_rug', mat: 'carpet', x0: 11.2, z0: 7.5, x1: 14.2, z1: 10.7 },
      { id: 'sleep_rug', mat: 'carpet', x0: 16.8, z0: 8.1, x1: 18.4, z1: 10.5 },
      { id: 'house', mat: 'stone', x0: 10, z0: 6, x1: 20, z1: 12 },
      { id: 'store', mat: 'stone', x0: 24, z0: 16, x1: 32, z1: 22 },
    ],
  };
  // what a row calls the doors (scenarios.doorNames — game/doornames.ts; no bearing in a name): the yard has no mission of its own, so this is its one block
  return { level, scenarios: { doorNames: [{ door: 'gate_w', name: 'foot gate' }, { door: 'n_w', name: 'guest room door' }, { door: 'n_e', name: 'sleeping room door' }, { door: 's_n', name: 'store door' }, { door: 's_w', name: 'store side door' }] }, groups: trace.groups, surfaces };
}
