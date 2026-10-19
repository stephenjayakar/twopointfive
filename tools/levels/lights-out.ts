// LIGHTS OUT — a quiet mission AS TWO, built so the second man matters: the mains and the door are in two places, and the dark between them is shorter than
// one man's walk. A relay post in a walled yard at night (the shared walled yard of tools/levels/train-ground.ts, GWOT kit). An inner wall cuts the yard in two;
// its only gap is at the north end.
//   WEST of it, the outer yard: the generator shed with the breaker in it (one door on its west face, one on its south face into a fuel cage open to the south). Nobody
//   walks here and no lamp burns here.
//   EAST of it: the house. Its front door is at the end of a lane between the inner wall and the house, under a lamp and a lens. Behind the door, the front
//   hall: a bulb, a lens, and a GRILLE of four beams wall to wall (shin and waist, 0.3 m apart: no way under, over or between, and one more than the OCP can
//   hold dark at once). Behind the hall, the back room with the strongbox, and a steel fire door (no handle outside) onto the east strip and the east gate.
// EVERYTHING ELECTRIC IS ON THE MAINS, and the breaker is the one answer to the grille. But when the mains go, the nearest man walks to the breaker and has
// them back in a quarter of a minute — and the walk from the breaker to the front door, round by the gap, is longer than that, and meets him on the way.
// SO: one of you waits in the dark at the end of the lane, a few strides from the door, and the other throws the breaker ON THE WORD (the orders menu on
// the panel: 'throw the breaker'), then gets out of the shed into the fuel cage before the man sent to it arrives (the menu on the cage floor: 'hold in the dark').
// THE HALL HAS A WINDOW AND A LANTERN: the north side's man keeps the window, looking in. The lantern burns its own fuel, so with the mains out the hall is
// still lit for HIM — but he is the man sent to the breaker (the nearest by the straight line the rule measures), and while he walks nobody looks in. A round
// through the panel puts the mains out for good and brings him back to his window.
// THE BACK ROOM'S DOOR IS LOCKED on its hall face (no key on any belt): 4.2 s on a knee at the keyway, under the lantern, in the window's view (the window
// is 1.2 m wide and the lantern stands at mid-hall for that). The pair picks it inside the dark with the sentry gone; a lone sprint through the hall on
// the sentry's turn, which got out clean before the lock, is shot at the keyway on both deals.
// THREE men: the window's sentry on the north side, one walks the east strip
// past the fire door and the east gate, one keeps the cook fire on the south side.
// Checked and measured by tools/qa/lights-out-run.ts; the page is rebuild/missions/new/duo.md in the project files.
import type { KitViewData, QuietData } from '../../src/scene/scenarios';
import type { DeviceDef } from '../../src/scene/level';
import { BoxFlag } from '../../src/scene/boxes';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { trainGround, TRAIN_MATERIALS, EXIT_W, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';

export const NAME = 'lights-out';
export const NOTES = 'Lights out: a quiet mission as two. A relay post in a walled yard at night: the strongbox is behind a hall with a grille of four beams, a lens and a lamp, all on the mains; the breaker is in a generator shed on the far side of an inner wall, and the man sent to it has the mains back before one man can walk from it to the door. One waits by the door, the other throws the breaker on the word and hides.';
export const MATERIALS = TRAIN_MATERIALS;

type V3 = [number, number, number];
/** the places the scripted players and the checks name (tools/qa/lights-out-run.ts imports these, so a moved wall moves the script) */
export const LIGHTS = {
  breaker: [13.44, 1.35, 16.4] as V3,                     // the panel, on the shed's east wall, inside
  cage: [11.0, 0, 19.4] as V3,                            // where the partner waits and hides: the west end of the fuel cage
  gapWait: [15.1, 0, 9.5] as V3,                         // behind the inner wall, off the gap's line: where the gap is waited for
  gapWest: [15.0, 0, 7.3] as V3, gapEast: [16.9, 0, 7.3] as V3,
  laneTop: [16.8, 0, 9.4] as V3, laneFoot: [16.8, 0, 16.2] as V3, stubEnd: [18.65, 0, 16.35] as V3, nookMouth: [18.65, 0, 17.7] as V3,
  nook: [17.3, 0, 17.9] as V3,                            // where Sam waits: behind the wood store's wall, in the south wall's shadow
  doorFront: [20.3, 0, 16.25] as V3, hallIn: [21.7, 0, 16.25] as V3, hallFar: [23.9, 0, 16.25] as V3, backIn: [25.6, 0, 16.25] as V3,
  safeFront: [27.4, 1.0, 14.18] as V3, safeStand: [27.4, 0, 14.8] as V3,
  fireIn: [29.3, 0, 15.75] as V3, fireOut: [30.8, 0, 15.75] as V3,
  camDoor: [20.84, 2.6, 13.7] as V3, camHall: [24.3, 2.5, 18.9] as V3,
  lampFront: [20.5, 3.4, 15.6] as V3, lampNorth: [24.5, 3.4, 9.6] as V3, lampEast: [30.9, 3.4, 12.6] as V3,
  beams: [22.3, 22.6, 22.9, 23.2],
  window: [22.75, 1.5, 13.2] as V3,                       // the hall's window, in its north wall
  sentry: [22.75, 0, 12.1] as V3, sentryTurn: [22.75, 0, 11.3] as V3,  // the north side's man: at the window looking in, and the one step back he takes now and then
  lantern: [22.75, 0, 15.4] as V3,
};

/** the level's own names for its floor (scenarios.places: control's radio lines, a checkpoint row and the debrief say WHERE by these; rooms first) */
const PLACES = { areas: [
  { name: 'generator shed', bounds: { x0: 10.12, x1: 13.48, z0: 14.92, z1: 18.48 } }, { name: 'fuel cage', bounds: { x0: 10.12, x1: 13.48, z0: 18.72, z1: 20.28 } },
  { name: 'front hall', bounds: { x0: 21.12, x1: 24.38, z0: 13.32, z1: 19.08 } }, { name: 'back room', bounds: { x0: 24.62, x1: 29.88, z0: 13.32, z1: 19.08 } },
  { name: 'wood store', bounds: { x0: 16.12, x1: 18.1, z0: 16.9, z1: 19.2 } },
  { name: 'lane', bounds: { x0: 16.12, x1: 21.0, z0: 13.2, z1: 19.2 } },
  { name: 'cook fire', bounds: { x0: 21.0, x1: 30.0, z0: 19.2, z1: 21.88 } },
  { name: 'back strip', bounds: { x0: 30.0, x1: 31.88, z0: 6.12, z1: 21.88 } },
  { name: 'window side', bounds: { x0: 16.12, x1: 30.0, z0: 6.12, z1: 13.2 } },
  { name: 'outer yard', bounds: { x0: 8.12, x1: 15.88, z0: 6.12, z1: 21.88 } },
  { name: 'front track', bounds: { x0: 0, x1: 8.12, z0: 0, z1: 28 } }, { name: 'back track', bounds: { x0: 31.88, x1: 40, z0: 0, z1: 28 } },
] };

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set on the yard's west gate
 *  (train-ground-kitview.ts). In the level the generator and the breaker stand in a walled shed south of the gate, where the picture cannot see in. So: a lean-to
 *  of the shed's block against the yard wall, open to the gate, with the generator, the breaker on its back wall and the fuel out of the cage. The generator, the breaker's
 *  paint and the drums are this level's own boxes as exported (levels/lights-out.json), moved; the ids are the set's (lo_). */
const SHELL = yardGateShell('lo');
const LIGHTS_OUT_KITVIEW: KitViewData = {
  sets: { shed: { ...SHELL,
    lights: [{ id: 'lo_bulb', kind: 'point', pos: [9.4, 2.25, 11.4], dir: [0, -1, 0], color: [1, 0.68, 0.4], intensity: 26, range: 7, innerDeg: 0, outerDeg: 180, group: 'lo', enabled: true, volumetric: 0.25, radius: 0.06, mains: false, fixture: 'lo_018' }],
    boxes: [...SHELL.boxes,
      { id: 'lo_001', group: 'lo.shed', c: [9.87, 0.006, 12.24], h: [1.75, 0.006, 1.12], material: 'slab', flags: ['NoShadow'] },
      { id: 'lo_002', group: 'lo.shed', c: [9.87, 1.5, 11], h: [1.75, 1.5, 0.12], material: 'block' },
      { id: 'lo_003', group: 'lo.shed', c: [11.5, 1.5, 12.24], h: [0.12, 1.5, 1.12], material: 'block' },
      { id: 'lo_004', group: 'lo.generator', c: [9.3, 0.05, 12.3], h: [0.8, 0.05, 0.4], yaw: 1.5708, material: 'iron' },
      { id: 'lo_005', group: 'lo.generator', c: [9.3, 0.55, 12.3], h: [0.75, 0.45, 0.375], yaw: 1.5708, material: 'genYellow' },
      { id: 'lo_006', group: 'lo.generator', c: [9.45, 1.16, 11.8], h: [0.045, 0.16, 0.045], yaw: 1.5708, material: 'rust' },
      { id: 'lo_007', group: 'lo.generator', c: [9.3, 1.02, 12.65], h: [0.12, 0.02, 0.12], yaw: 1.5708, material: 'iron' },
      { id: 'lo_008', group: 'lo.breaker', c: [10.6, 1.35, 11.16], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45] },
      { id: 'lo_009', group: 'lo.breaker', c: [10.42, 1.62, 11.21], h: [0.015, 0.015, 0.015], material: 'plasticBlack', emissive: [0.3, 4, 0.6], flags: ['NoShadow'] },
      { id: 'lo_010', group: 'lo.fuel', c: [10.2, 0.44, 12.7], h: [0.2784, 0.44, 0.1153], yaw: 0.0846, material: 'drumBlue' },
      { id: 'lo_011', group: 'lo.fuel', c: [10.2, 0.439, 12.7], h: [0.2784, 0.439, 0.1153], yaw: 0.87, material: 'drumBlue' },
      { id: 'lo_012', group: 'lo.fuel', c: [10.2, 0.438, 12.7], h: [0.2784, 0.438, 0.1153], yaw: 1.6554, material: 'drumBlue' },
      { id: 'lo_013', group: 'lo.fuel', c: [10.2, 0.437, 12.7], h: [0.2784, 0.437, 0.1153], yaw: 2.4408, material: 'drumBlue' },
      { id: 'lo_014', group: 'lo.fuel', c: [10.84, 0.44, 12.76], h: [0.2784, 0.44, 0.1153], yaw: 0.5574, material: 'drumBlue' },
      { id: 'lo_015', group: 'lo.fuel', c: [10.84, 0.439, 12.76], h: [0.2784, 0.439, 0.1153], yaw: 1.3428, material: 'drumBlue' },
      { id: 'lo_016', group: 'lo.fuel', c: [10.84, 0.438, 12.76], h: [0.2784, 0.438, 0.1153], yaw: 2.1282, material: 'drumBlue' },
      { id: 'lo_017', group: 'lo.fuel', c: [10.84, 0.437, 12.76], h: [0.2784, 0.437, 0.1153], yaw: 2.9136, material: 'drumBlue' },
      { id: 'lo_018', group: 'lo.bulb', c: [9.4, 2.3, 11.16], h: [0.06, 0.06, 0.04], material: 'plasticWhite', emissive: [30, 21, 11], flags: ['NoShadow'] },
    ] } },
  ways: [{ door: 'lo_gate', set: 'shed', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  const post = (x: number, z: number, y: number) => T.add({ c: [x, y - 0.5, z], h: [0.07, 0.12, 0.16], ...GWOT_MATERIALS.olive });   // a lens's junction box under it (drawn)

  // ---- the inner wall: the yard cut in two, one gap at its north end ----
  grp('inner');
  G.yardWallZ(16, 8.4, 21.88); G.pier(16, 8.4);

  // ---- the generator shed and the fuel cage, in the outer yard ----
  T.hut({ x0: 10, z0: 14.8, x1: 13.6, z1: 18.6, kind: 'block', floor: 'slab', doors: [{ name: 'shed', side: 'w', at: 15.6 }, { name: 'cage', side: 's', at: 12.2 }] });
  grp('shed.room');
  G.generator(10.75, 17.75, HALF); G.jerryCan(11.75, 18.25, 0.2); G.jerryCan(10.45, 15.25, HALF);
  T.breakerAt(LIGHTS.breaker[0], LIGHTS.breaker[2], 'w');
  grp('cage');
  G.yardWallZ(10, 18.6, 20.4); G.yardWallZ(13.6, 18.6, 20.4);
  G.ground(10.14, 18.74, 13.46, 20.26, 'slab');
  G.drums(11.9, 20.0, 2); G.gasBottle(13.2, 20.0);
  grp('outer');
  G.waterTank(9.2, 8.0); G.tyres(15.2, 20.9, 3); G.crates(14.9, 12.4, 0.1, 2, 'olive'); G.motorbike(9.1, 20.6, 0.3);
  G.patch(9.2, 14.0, 2.0, 1.3, 'damp');

  // ---- the lane's foot: a wall across it at the house's south-west corner, and the wood store in the corner behind a stub wall ----
  grp('lane');
  G.yardWallX(19.2, 16.12, 20.88); G.yardWallX(13.2, 17.9, 20.88); G.pier(17.9, 13.2);   // closed at both ends: the way in is the gap by the inner wall at its head
  G.yardWallX(16.9, 16.12, 17.9); G.pier(17.9, 16.9);
  G.woodPile(16.6, 17.5, HALF, 1.0);

  // ---- the house: front hall (west) and back room (east) ----
  const HOUSE = T.hut({ x0: 21, z0: 13.2, x1: 30, z1: 19.2, kind: 'render', floor: 'slab', doors: [
    { name: 'front', side: 'w', at: 15.6 },
    // the fire door: steel, no handle outside (no pick, and a boot only rings it); from inside it opens to a hand
    { name: 'fire', side: 'e', at: 15.0, extra: { locked: true, steel: true, keySide: -1 } },
  // two windows: the back room's on the east strip, and the HALL's on the north side — the sentry's post is under it, and the hall's lantern is his light to
  // see in by when the mains are out
  ], windows: [{ side: 'e', at: 17.7, w: 0.8 }, { side: 'n', at: LIGHTS.window[0] - 0.6, w: 1.2 }] });
  grp('house.inner');
  G.wallZ(24.5, 13.32, 19.08, 'render', [{ a: 15.6, b: 16.8 }]);
  // locked on the hall's face (keySide 1 = the hall): the pick is the time a lone man in the lantern's light does not have
  T.doors.push({ name: 'inner', hinge: [24.5, 15.62], closedDir: HALF, width: 1.16, locked: true, keySide: 1 });
  const BACK = { x0: 24.62, x1: HOUSE.x1, z0: HOUSE.z0, z1: HOUSE.z1 };

  grp('house.hall');
  G.bulb(22.75, 16.2, 'bulb_hall', 'hall', true);
  T.lights.find(l => l.name === 'bulb_hall')!.mains = true;
  G.trunk(21.55, 13.75, 0, 'paintBlue'); G.plasticChair(21.6, 18.5, 0.6);          // west of the grille: the sentry's chair nobody sits in, a trunk
  G.sacks(24.0, 18.5, 0.2, 2);
  G.lantern(LIGHTS.lantern[0], LIGHTS.lantern[2], 'lantern_hall', 'hall', 0, true);   // its own fuel: the one light in the house the breaker does not take

  grp('house.back');
  G.bulb(27.3, 16.3, 'bulb_back', 'back', false);
  // the strongbox, against the north wall: an iron box on a plinth, a door plate and a wheel on its face
  T.add({ c: [27.4, 0.06, 13.72], h: [0.5, 0.06, 0.38], ...GWOT_MATERIALS.block });
  T.add({ c: [27.4, 0.67, 13.72], h: [0.44, 0.55, 0.34], ...GWOT_MATERIALS.iron });
  T.add({ c: [27.4, 0.67, 14.07], h: [0.36, 0.46, 0.012], ...GWOT_MATERIALS.galv, flags: BoxFlag.NoShadow });
  T.add({ c: [27.56, 0.72, 14.095], h: [0.07, 0.07, 0.014], ...GWOT_MATERIALS.iron, flags: BoxFlag.NoShadow });
  // the holder's tell-tale (game.ts rackTargets: the switchable named rack<rackIndex>_leds goes dark when the thing is taken), as on the other quiet levels
  { const led = T.add({ c: [27.16, 1.04, 14.088], h: [0.03, 0.012, 0.006], ...GWOT_MATERIALS.iron, emissive: [3, 0.4, 0.2], flags: BoxFlag.NoShadow });
    T.switchables.push({ name: 'rack0_leds', boxes: [led], group: 'objective', on: true, baseEmissive: [3, 0.4, 0.2], mains: false }); }
  // the signallers' room: the set on its table, bedrolls, the spares
  G.table(25.6, 18.6, 1.6, 0.7); G.plasticChair(25.6, 17.85, Math.PI); G.crates(25.1, 13.8, 0.05, 2, 'olive');
  G.rug(27.2, 16.6, 2.4, 1.6, 'afghan'); G.toshak(28.6, 18.55, 1.9, 0); G.lowTable(27.2, 17.6, 0);
  G.trunk(29.4, 13.8, HALF, 'paintGreen');

  // ---- the yard east of the inner wall: three lamps on the mains, the lane's west edge and the wood store left dark ----
  grp('yard');
  T.lamp(LIGHTS.lampFront[0], LIGHTS.lampFront[2], 'lamp_front', { mains: true, outerDeg: 38 });
  T.lamp(LIGHTS.lampNorth[0], LIGHTS.lampNorth[2], 'lamp_north', { mains: true });
  T.lamp(LIGHTS.lampEast[0], LIGHTS.lampEast[2], 'lamp_east', { mains: true });
  G.lantern(26.3, 21.3, 'lantern_cook', 'cook', 0, true); G.tandoor(24.2, 21.2); G.woodPile(22.4, 21.4, 0, 1.2); G.charpoy(27.9, 21.45, 0); G.gasBottle(25.3, 21.5);
  G.hesco(28.4, 6.72, 2, 0); G.drums(31.3, 7.0, 2); G.sacks(31.3, 21.2, 0.1, 3);
  G.patch(30.9, 14.2, 1.6, 2.4, 'damp');

  // ---- the devices: every one of them on the mains ----
  grp('devices');
  post(20.8, LIGHTS.camDoor[2], LIGHTS.camDoor[1]); post(24.34, 18.94, LIGHTS.camHall[1]);
  const beam = (i: number): DeviceDef => ({ kind: 'laser', name: `beam_hall${i + 1}`, from: [LIGHTS.beams[i], i % 2 ? 0.8 : 0.35, 13.36], to: [LIGHTS.beams[i], i % 2 ? 0.8 : 0.35, 19.04], mains: true });
  const devices: DeviceDef[] = [
    { kind: 'camera', name: 'cam_door', pos: LIGHTS.camDoor, yaw: -0.4, pitch: -0.35, sweep: [-0.75, -0.05], sweepPeriod: 9, fovDeg: 60, range: 5.5, mains: true },
    { kind: 'camera', name: 'cam_hall', pos: LIGHTS.camHall, yaw: -2.71, pitch: -0.35, sweep: [-2.96, -2.46], sweepPeriod: 8, fovDeg: 70, range: 6.5, mains: true },
    beam(0), beam(1), beam(2), beam(3),
  ];

  // ---- the men. No key on any belt ----
  // the north side's man: the sentry at the hall's window — a long look in, a step back to ease his legs, and at the window again. He is always the nearest
  // man to the breaker by the straight line the rule measures, so HE is the one the dark takes off the window: while he walks to the panel nobody looks in.
  // A panel SHOT dead brings him to it and back again, and then he is at his window with the lantern lighting the hall for him and no end to the dark
  // the east walker: the east strip, past the fire door and the east gate, there and back
  // the cook: the fire on the south side and the charpoy beside it
  const P3 = (x: number, z: number): V3 => [x, 0, z];
  const routes = [
    { name: 'north', points: [LIGHTS.sentryTurn, LIGHTS.sentry], wait: [0.5, 20], keys: [] as string[] },
    { name: 'east', points: [P3(31.0, 8.6), P3(31.0, 20.4)], wait: [7, 7], keys: [] as string[] },
    { name: 'cook', points: [P3(26.6, 20.4), P3(29.2, 20.4)], wait: [18, 12], keys: [] as string[] },
    { name: 'north_b', points: [LIGHTS.sentry, LIGHTS.sentryTurn], wait: [20, 0.5], keys: [] as string[] },
    { name: 'east_b', points: [P3(31.0, 20.4), P3(31.0, 8.6)], wait: [7, 7], keys: [] as string[] },
    { name: 'cook_b', points: [P3(29.2, 20.4), P3(26.6, 20.4)], wait: [12, 18], keys: [] as string[] },
  ];

  const front = LIGHTS.safeFront;
  const quiet: QuietData = {
    thing: 'the radio codebook',
    starts: [{ name: 'the front track', sam: [5.2, 0, 14.0], samYaw: HALF, mate: [4.4, 0, 14.9] }],
    spots: [{ place: 'the back room', area: { ...BACK }, door: 'inner', holder: 'the strongbox', rackIndex: 0, front, halfW: 0.35 }],
    exits: [{ ...EXIT_E, name: 'the back gate' }, { ...EXIT_W, name: 'the generator shed gate' }],   // (the ground's two gates, by this level's own names for them)
    patrols: [['north', 'east', 'cook'], ['north_b', 'east_b', 'cook_b']],
  };
  return T.finish({
    spawn: [5.2, 0, 14.0], routes,
    mission: { serverRoom: { ...BACK }, entryDoor: 'inner', rack: { index: 0, front, halfW: 0.35 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, places: PLACES, kitView: LIGHTS_OUT_KITVIEW, doorNames: [{ door: 'gate_w', name: 'generator shed gate' }, { door: 'gate_e', name: 'back gate' }] },
    level: { devices },
  });
}
