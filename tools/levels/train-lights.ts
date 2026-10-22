// TRAIN-LIGHTS — Training 3, "Lights, locks and devices": THE GENERATOR YARD, the compound's power. One idea: everything that sees me runs on something, and I
// can take that away. A lamp shot dark, a lock picked, the man minding the generator grabbed from behind and asked for a pad's code, the OCP on a camera (on its
// own battery: it comes back) and on a tripwire beam, the code typed at the power house's pad, the fuel ledger taken — and then the closer: the breaker box in the
// dark end of the brightest, watched court takes the lamps, the gate's lens and the beam at one keypress, and he stands up and walks out through the black.
// A quiet mission (game/quiet.ts) alone, with a `scenarios.lesson` block (game/lesson.ts) whose steps name each key and move on when the thing is DONE.
//
//        x 8   10        15.5       20.5         26        31 32
//   z 6  ┌────────────────────────────────────────────────────┐
//        │           the north lane: the one guard's beat  ▓GEN▓   the slab pad: the yellow generator, fuel drums, the mast its wire leaves by
//  11.0  ╞══════ door ════════════════════════════════════════╡
//        │ (lamp)     ·  P1   (lamp)   P2 ░ (lamp)    (lamp)  │    ░ = the dark strip down to the alley's mouth
//  gate_w             ║    the court  cam║░        the lit court  ◄cam  gate_e   (locked on the inside: the boot)
//        │            ║                 ║░ ▒brk│ ═════┌──────────┐│   brk = the breaker box in its nook (shaded from lamp and lens by the fin wall)
//        │            ║                 ║ beam ┆  │ power house ││   its door on a keypad, on the alley
//   z 22 └────────────╨─────────────────╨──────┆──┴──────────┴┘
//
//   the WIRES are the legend: generator → mast → breaker → every lamp on the power, the gate's lens, the beam's box, the power house. None to the court's
//   camera (a battery) nor to the lamp inside the west gate (the one to shoot).
//
//   bun run tools/levels/export.ts train-lights [--check]    → levels/train-lights.json
//   bun run tools/qa/lesson-check.ts train-lights            the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-lights              the scripted player through every step to the debrief
//   page: ?levelFile=train-lights.json&quiet     (&nolesson: the same level as its mission alone)
import type { KitViewData, LessonData, QuietData } from '../../src/scene/scenarios';
import type { DeviceDef } from '../../src/scene/level';
import { BoxFlag } from '../../src/scene/boxes';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { trainGround, TRAIN_MATERIALS, EXIT_W, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';
import { livedTrain } from './lived-train';

export const NAME = 'train-lights';
export const NOTES = 'Training 3, lights, locks and devices: the generator yard. A walled yard in three courts, a locked door, a man minding the generator who knows a code, a camera on a battery, a tripwire, the power house on a keypad with the fuel ledger, and a breaker box that takes the lit court, its lens and the beam at once. Regenerate: bun run tools/levels/export.ts train-lights';
export const MATERIALS = TRAIN_MATERIALS;

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set on the yard's west gate
 *  (train-ground-kitview.ts). From the gate as it stands the picture's column holds a bare wall and the lane's. So the compound's power is brought up to it: the
 *  slab's yellow generator, its fuel and the mast its wire leaves by, and the lamp inside the west gate (the one the lesson shoots) on its pole. Every piece is this level's own box as exported
 *  (levels/train-lights.json), moved; the ids are the set's (tl_). */
const SHELL = yardGateShell('tl');
const LIGHTS_KITVIEW: KitViewData = {
  sets: { power: { ...SHELL,
    lights: [{ id: 'tl_lamp_gate', kind: 'spot', pos: [10.3, 3.37, 13.9], dir: [0, -1, 0], color: [1, 0.86, 0.6], intensity: 90, range: 9, innerDeg: 30, outerDeg: 52, group: 'tl', enabled: true, volumetric: 0.2, radius: 0.1, mains: false, fixture: 'tl_025' }],
    boxes: [...SHELL.boxes,
      { id: 'tl_001', group: 'tl.generator', c: [9.8, 0.0024, 11.3], h: [1.6, 0.0024, 2.2], material: 'slab' },
      { id: 'tl_002', group: 'tl.generator', c: [10, 0.05, 11.2], h: [0.8, 0.05, 0.4], yaw: 1.5708, material: 'iron' },
      { id: 'tl_003', group: 'tl.generator', c: [10, 0.55, 11.2], h: [0.75, 0.45, 0.375], yaw: 1.5708, material: 'genYellow' },
      { id: 'tl_004', group: 'tl.generator', c: [10.15, 1.16, 10.7], h: [0.045, 0.16, 0.045], yaw: 1.5708, material: 'rust' },
      { id: 'tl_005', group: 'tl.generator', c: [10, 1.02, 11.55], h: [0.12, 0.02, 0.12], yaw: 1.5708, material: 'iron' },
      { id: 'tl_006', group: 'tl.generator', c: [9.35, 0.012, 11.4], h: [0.25, 0.003, 0.55], yaw: 0.12, material: 'oil', flags: ['NoShadow'] },
      { id: 'tl_007', group: 'tl.generator', c: [8.5, 0.44, 9.55], h: [0.2784, 0.44, 0.1153], yaw: 0.6472, material: 'drumBlue' },
      { id: 'tl_008', group: 'tl.generator', c: [8.5, 0.439, 9.55], h: [0.2784, 0.439, 0.1153], yaw: 1.4326, material: 'drumBlue' },
      { id: 'tl_009', group: 'tl.generator', c: [8.5, 0.438, 9.55], h: [0.2784, 0.438, 0.1153], yaw: 2.218, material: 'drumBlue' },
      { id: 'tl_010', group: 'tl.generator', c: [8.5, 0.437, 9.55], h: [0.2784, 0.437, 0.1153], yaw: 3.0034, material: 'drumBlue' },
      { id: 'tl_011', group: 'tl.generator', c: [9.14, 0.44, 9.61], h: [0.2784, 0.44, 0.1153], yaw: 0.5718, material: 'drumBlue' },
      { id: 'tl_012', group: 'tl.generator', c: [9.14, 0.439, 9.61], h: [0.2784, 0.439, 0.1153], yaw: 1.3572, material: 'drumBlue' },
      { id: 'tl_013', group: 'tl.generator', c: [9.14, 0.438, 9.61], h: [0.2784, 0.438, 0.1153], yaw: 2.1426, material: 'drumBlue' },
      { id: 'tl_014', group: 'tl.generator', c: [9.14, 0.437, 9.61], h: [0.2784, 0.437, 0.1153], yaw: 2.928, material: 'drumBlue' },
      { id: 'tl_015', group: 'tl.generator', c: [8.8, 0.44, 10.15], h: [0.2784, 0.44, 0.1153], yaw: 0.2781, material: 'drumBlue' },
      { id: 'tl_016', group: 'tl.generator', c: [8.8, 0.439, 10.15], h: [0.2784, 0.439, 0.1153], yaw: 1.0635, material: 'drumBlue' },
      { id: 'tl_017', group: 'tl.generator', c: [8.8, 0.438, 10.15], h: [0.2784, 0.438, 0.1153], yaw: 1.8489, material: 'drumBlue' },
      { id: 'tl_018', group: 'tl.generator', c: [8.8, 0.437, 10.15], h: [0.2784, 0.437, 0.1153], yaw: 2.6343, material: 'drumBlue' },
      { id: 'tl_019', group: 'tl.generator', c: [10.8, 1.81, 12.7], h: [0.04, 1.81, 0.04], material: 'galv' },
      { id: 'tl_020', group: 'tl.generator', c: [10.5, 1.02, 12.35], h: [0.461, 0.012, 0.022], yaw: -0.8622, material: 'plasticBlack', flags: ['NoShadow'] },
      { id: 'tl_021', group: 'tl.generator', c: [10.75, 2.26, 12.7], h: [0.018, 1.26, 0.018], material: 'plasticBlack', flags: ['NoShadow'] },
      { id: 'tl_022', group: 'tl.lamp', c: [10.3, 1.755, 13.3], h: [0.04, 1.755, 0.04], material: 'galv' },
      { id: 'tl_023', group: 'tl.lamp', c: [10.3, 3.485, 13.6], h: [0.025, 0.025, 0.26], material: 'galv' },
      { id: 'tl_024', group: 'tl.lamp', c: [10.3, 3.46, 13.9], h: [0.2, 0.05, 0.2], material: 'plasticBlack' },
      { id: 'tl_025', group: 'tl.lamp', c: [10.3, 3.4, 13.9], h: [0.12, 0.012, 0.12], material: 'plasticWhite', emissive: [40, 34, 22], flags: ['NoShadow'] },
    ] } },
  ways: [{ door: 'tl_gate', set: 'power', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  /** a power CABLE strung overhead from (x0, z0) to (x1, z1) at `y` (drawn only: thicker than the kit's wire, so the circuit reads from above) */
  const WIRE_Y = 3.52;
  const cable = (x0: number, z0: number, x1: number, z1: number, y = WIRE_Y) => { const L = Math.hypot(x1 - x0, z1 - z0) || 1; T.add({ c: [(x0 + x1) / 2, y, (z0 + z1) / 2], h: [L / 2, 0.012, 0.022], yaw: Math.atan2(-(z1 - z0), x1 - x0), ...GWOT_MATERIALS.plasticBlack, flags: BoxFlag.NoShadow }); };
  /** a cable's drop down a wall or a pole: from `y0` up to the strung run */
  const drop = (x: number, z: number, y0: number, y1 = WIRE_Y) => T.add({ c: [x, (y0 + y1) / 2, z], h: [0.018, (y1 - y0) / 2, 0.018], ...GWOT_MATERIALS.plasticBlack, flags: BoxFlag.NoShadow });

  // ---- the north lane: a wall the yard's whole length with one locked door in it (the lock to pick); the one guard walks its east half, and stands longest at
  //      its east end, facing the generator he minds, with his back to the door ----
  grp('walls.lane');
  G.yardWallX(11.0, 8, 32, 'mud', [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }]); G.pier(20.5, 11.0);
  // (the wall on a nav cell line, z 11.0, and the opening where the gates have theirs: the 0.5 m grid then has the doorway walkable)
  T.doors.push({ name: 'lane', hinge: [13.42, 11.0], closedDir: 0, width: 1.16, locked: true, swing: -1 });
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);
  // the lane's floor points at the set: the back-filled cable trench from the picked door to the pad, and the fuel pipe along the far wall on its chocks
  // (the pipe's top is 0.13 m: a step over)
  G.patch(21.3, 10.2, 14.6, 0.35, 'damp');
  T.add({ c: [18.5, 0.08, 6.5], h: [9.5, 0.05, 0.05], ...GWOT_MATERIALS.galv });
  for (let x = 10; x <= 27; x += 3.4) T.add({ c: [x, 0.015, 6.5], h: [0.1, 0.015, 0.12], ...GWOT_MATERIALS.block });
  // THE GENERATOR (the yard's landmark): yellow, on a slab pad at the lane's east end, its panel to the west where the man stands; fuel beside it, oil under it
  grp('generator');
  G.ground(28.6, 6.3, 31.8, 10.7, 'slab');
  G.generator(30.4, 8.4, HALF);
  G.patch(29.75, 8.6, 0.5, 1.1, 'oil', 0.12);
  G.drums(28.9, 6.75, 3); G.jerryCan(31.3, 6.6, 0.2); G.jerryCan(31.35, 9.0, 1.4, 'jerryYellow');
  const MAST: [number, number] = [31.2, 9.9];
  T.add({ c: [MAST[0], (WIRE_Y + 0.1) / 2, MAST[1]], h: [0.04, (WIRE_Y + 0.1) / 2, 0.04], ...GWOT_MATERIALS.galv });
  cable(30.6, 9.2, MAST[0], MAST[1], 1.02); drop(MAST[0] - 0.05, MAST[1], 1.0);

  // ---- the west court: a lamp inside the gate (the one to shoot out: a battery lamp, no wire to it), a wall across with a way on at its north end ----
  grp('court.west');
  T.lamp(11.8, 15.4, 'lamp_gate');
  G.yardWallZ(15.5, 14.6, 22); G.pier(15.5, 14.6);
  // the linesman's corner: spare lamp poles laid down (a step over), a cable reel on its side, the blocks left over from the power house
  // (all of it north of z 18.4 and east of x 10.2: south and west of that the yard wall's moon shadow is black)
  for (let k = 0; k < 3; k++) T.add({ c: [10.4 + k * 0.05, 0.045 + (k === 2 ? 0.085 : 0), 11.5 + (k === 2 ? 0.06 : k * 0.12)], h: [1.7, 0.04, 0.04], yaw: 0.02, ...GWOT_MATERIALS.galv });
  G.drumDown(12.9, 17.7, 0.5, 'woodGrey'); G.blocks(10.9, 18.0, 0.1, 2);
  // (the gate lamp runs on its own battery, the box at its pole's foot: no wire comes to it, and the breaker does not take it)
  T.add({ c: [11.8, 0.14, 14.56], h: [0.2, 0.14, 0.13], ...GWOT_MATERIALS.olive }); drop(11.8, 14.76, 0.28, 3.4);

  // ---- the middle court: lit (on the power), and watched by a camera on its east wall (on a battery); the way on is across it, along the lane wall, and
  //      round that wall's end. Its south end is the fuel dump ----
  grp('court.mid');
  T.lamp(18.0, 13.6, 'lamp_court', { mains: true });
  G.yardWallZ(20.5, 13.6, 22); G.pier(20.5, 13.6);
  G.drums(16.5, 16.9, 5); G.drumDown(19.3, 17.7, 0.2); G.patch(17.7, 17.2, 3.4, 1.6, 'oil', 0.1);

  // ---- the east court: THE BRIGHTEST FLOOR ON THE MAP, two lamps and a lens over the gate, all on the power; a dark strip down its west wall to the alley's
  //      mouth; the breaker box in a nook at the dark end, shaded from lamp and lens by a fin of wall; the alley south of a wall with a beam across it, the
  //      power house at its end ----
  grp('court.east');
  T.lamp(25.6, 13.2, 'lamp_court_e', { mains: true });
  T.lamp(29.4, 13.8, 'lamp_exit', { mains: true });
  G.yardWallX(16.6, 22.5, 26);
  // COLOUR IS THE CIRCUIT: what the breaker box feeds burns cold white, the gate lamp on its battery stays warm; and a yellow junction box (the generator's
  // yellow) at the foot of every pole on the power, as the olive box is at the battery lamp's
  for (const [n, jx, jz] of [['lamp_court', 18.0, 13.16], ['lamp_court_e', 25.6, 12.76], ['lamp_exit', 29.4, 13.36]] as const) {
    const l = T.lights.find(x => x.name === n)!; l.color = [0.78, 0.9, 1.0]; T.K.boxes[l.fixtureBox!].emissive = [26, 34, 40];
    T.add({ c: [jx, 0.2, jz], h: [0.15, 0.2, 0.075], ...GWOT_MATERIALS.genYellow });
  }
  G.ground(24.6, 11.14, 31.86, 16.46, 'gravel');   // the lit court's own floor, east of the fin (the dark strip stays earth)
  G.yardWallZ(24.4, 14.7, 16.6); G.pier(24.4, 14.7);
  const BRK: [number, number, number] = [23.4, 1.35, 16.44];
  T.breakerAt(BRK[0], BRK[2], 'n');
  T.add({ c: [22.92, 1.0, 16.42], h: [0.15, 0.2, 0.06], ...GWOT_MATERIALS.genYellow });   // the junction box beside it
  const HUT = T.hut({ x0: 26, z0: 16.6, x1: 31, z1: 21.6, kind: 'block', floor: 'slab', doors: [{ name: 'hut', side: 'w', at: 18.6, extra: { locked: true, lock: 'pad_hut' } }] });
  // the power house wears its trunk's green outside, either side of its door
  G.dado('z', 26, 16.74, 18.56, -1, 'paintGreen'); G.dado('z', 26, 19.84, 21.46, -1, 'paintGreen');
  grp('hut.room');
  G.trunk(30.4, 19.2, HALF, 'paintGreen'); G.tube(28.4, 19.1, true, 'hut'); G.crates(27.0, 17.4, 0.1, 2); G.table(28.6, 21.0, 1.6, 0.7);
  grp('alley');
  // the east gate: locked against the yard (its cylinder inside), opening out — the boot's door
  Object.assign(T.doors.find(d => d.name === 'gate_e')!, { locked: true, swing: -1 });

  const CAM: [number, number, number] = [20.34, 2.7, 14.1], CAM_GATE: [number, number, number] = [31.84, 2.7, 15.2], EMITTER: [number, number, number] = [24.0, 0.35, 16.74], PAD: [number, number, number] = [25.865, 1.3, 18.3];
  // (the court camera's battery: a box on the wall under it — the same olive box as the gate lamp's)
  T.add({ c: [20.3, 2.2, 14.1], h: [0.07, 0.12, 0.16], ...GWOT_MATERIALS.olive });
  const devices: DeviceDef[] = [
    // on the middle court's east wall by the way on, looking back west along the crossing, panning; on its own battery (the breaker does not take it)
    { kind: 'camera', name: 'cam_court', pos: CAM, yaw: -HALF - 0.25, pitch: -0.3, sweep: [-HALF - 0.65, -HALF + 0.15], sweepPeriod: 9, fovDeg: 70, range: 5.6, mains: false },
    // over the east gate, looking west down the lit court: on the power, so the breaker takes it with the lamps. Its reach stops short of the dark strip
    { kind: 'camera', name: 'cam_gate', pos: CAM_GATE, yaw: -HALF, pitch: -0.3, sweep: [-HALF - 0.4, -HALF + 0.4], sweepPeriod: 8, fovDeg: 70, range: 9, mains: true },
    // the power house's lock: a pad on the wall by its door; the code is the guard's to give
    { kind: 'keypad', name: 'pad_hut', pos: PAD, yaw: -HALF, door: 'hut', code: '2514' },
    // a shin-high beam across the alley, wall to wall: nobody steps over it, and there is no way round. On the power
    { kind: 'laser', name: 'beam_alley', from: EMITTER, to: [24.0, 0.35, 21.86], mains: true },
  ];

  // ---- the wires: generator → mast → the breaker box → everything on the power ----
  grp('wires');
  const BX = BRK[0], BZ = 16.46;
  drop(BX, BZ, 1.75);
  cable(MAST[0], MAST[1], BX, BZ);                                   // the feed, over the lane wall and the court
  cable(BX, BZ, 25.6, 13.2); cable(25.6, 13.2, 29.4, 13.8);          // the east court's two lamps, one string
  cable(29.4, 13.8, 31.86, 15.2); drop(31.86, 15.2, 2.8);            // … and on to the lens over the gate
  cable(BX, BZ, 18.0, 13.6);                                         // the middle court's lamp, over the wall
  cable(BX, BZ, 24.0, 16.6); drop(24.0, 16.74, 0.45);                // the beam's box, down the alley face of the wall
  cable(BX, BZ, 26.0, 17.4); drop(26.0, 17.4, 3.0);                  // the power house
  // … and each run's back-filled trench on the floor under it (drawn only): the circuit read off the lit ground
  const trench = (x0: number, z0: number, x1: number, z1: number) => G.patch((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), 0.25, 'damp', Math.atan2(-(z1 - z0), x1 - x0));
  trench(MAST[0], MAST[1], BX, BZ); trench(BX, BZ, 25.6, 13.2); trench(25.6, 13.2, 29.4, 13.8); trench(29.4, 13.8, 31.86, 15.2); trench(BX, BZ, 18.0, 13.6); trench(BX, BZ, 26.0, 17.4);

  // a second emergency beacon, on the lane wall over the east court: when the power goes its red sweeps the floor he walks out across
  grp('beacons');
  T.add({ c: [26.6, 2.28, 11.2], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome1 = T.add({ c: [26.6, 2.16, 11.22], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  T.switchables.push({ name: 'beacon1', boxes: [dome1], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
  const beacons = [{ pos: [20.3, 2.05, 6.3] as [number, number, number], box: T.switchables.find(x => x.name === 'beacon0')!.boxes[0] }, { pos: [26.6, 2.05, 11.34] as [number, number, number], box: dome1 }];

  // ---- the same compound: the kitchen court's tandoor outside the west wall, the range's backstop outside the east ----
  grp('outside');
  G.tandoor(4.8, 9.8); G.woodPile(3.2, 10.2, 0.3, 1.2);
  G.tWall(36.4, 10.4, 3, 0);

  // ---- one guard: the north lane's east half, a stand at each end ----
  // no key on his belt: questioned, the one thing he has to give is the pad's code (and the east gate stays a door to kick)
  const routes = [{ name: 'lane', points: [[27.5, 0, 8.4], [21.5, 0, 8.4]] as [number, number, number][], wait: [20, 0], keys: [] as string[] }];

  const front: [number, number, number] = [30.0, 1.0, 19.2];
  const quiet: QuietData = {
    thing: 'the fuel ledger',
    starts: [{ name: 'the track', sam: [5.2, 0, 14.0], samYaw: HALF }],
    spots: [{ place: 'the power house', area: { ...HUT }, door: 'hut', holder: 'the green trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT_E, EXIT_W],
    patrols: [['lane']],
  };
  const COURT_E = { x0: 20.7, x1: 31.8, z0: 11.2, z1: 16.4 }, ALLEY = { x0: 20.7, x1: 25.9, z0: 16.8, z1: 21.8 };
  // (a player who crossed the watched court WITHOUT the jam, lit and seen, is past it all the same: the camera's two steps let him on)
  const PAST: LessonData['steps'][number]['done'][] = [{ is: 'in', area: COURT_E }, { is: 'in', area: ALLEY }, { is: 'door', door: 'hut', state: 'open' }];
  const lesson: LessonData = {
    title: 'Lights, locks and devices',
    steps: [
      // (a step whose deed can be made impossible — the lock kicked where the pick was asked, the man out cold before he gives the code, the hut booted —
      //  also passes on the door standing open / the man being down, so the lesson always reaches its end)
      { id: 'draw', line: 'Press 1 to draw the pistol', done: { is: 'slot', slot: 'pistol', drawn: true } },
      { id: 'shoot', line: 'Go in, then left-click on the light to shoot it out', done: { is: 'all', of: [{ is: 'did', what: 'chron:lightShot' }, { is: 'target', name: 'lamp_gate', on: false }] }, at: [11.8, 3.4, 15.4] },
      { id: 'pick', line: 'Tap Space at the lock to pick it, then keep still', done: { is: 'any', of: [{ is: 'did', what: 'chron:lockPicked' }, { is: 'door', door: 'lane', state: 'open' }] }, at: [14.0, 1, 11.0] },
      // (grabbed with a gun out the one row is the pistol whip, and the code goes with him: so the hands come first, as a step of their own)
      { id: 'empty', line: 'Press E to put it away. You need empty hands to grab someone', done: { is: 'any', of: [{ is: 'flag', flag: 'holstered' }, { is: 'men', down: 1 }] } },
      { id: 'grab', line: 'When his back is to you, sneak up behind him and press Space to grab him', done: { is: 'any', of: [{ is: 'did', what: 'chron:grab' }, { is: 'flag', flag: 'holding' }, { is: 'men', down: 1 }] }, at: [27.5, 1.4, 8.4] },
      { id: 'ask', line: 'Press Space to question him. Keep asking, because he knows the door code', done: { is: 'any', of: [{ is: 'did', what: 'chron:codeLearned' }, { is: 'men', down: 1 }] }, at: [27.5, 1.4, 8.4] },
      { id: 'choke', line: 'Right-click to choke him out, then keep still', done: { is: 'men', down: 1 } },
      { id: 'return', line: 'Go back out by the door you picked', done: { is: 'in', area: { x0: 8.2, x1: 15.3, z0: 11.2, z1: 21.8 } }, at: [14.0, 1, 11.8] },
      { id: 'ocp', line: 'Press 1, then right-click on the camera to jam it with the OCP', done: { is: 'any', of: [{ is: 'target', name: 'cam_court', on: false }, ...PAST] }, at: CAM },
      { id: 'camera', line: 'Cross while it\'s blind. If it wakes up, right-click on it again', done: { is: 'any', of: PAST }, at: [21.2, 1, 12.2] },
      { id: 'beam', line: 'Once the OCP is charged, right-click on the beam\'s box', done: { is: 'any', of: [{ is: 'target', name: 'beam_alley', on: false }, { is: 'in', area: { x0: 24.4, x1: 25.9, z0: 16.8, z1: 21.5 } }, { is: 'door', door: 'hut', state: 'open' }] }, at: EMITTER },
      // (a jam wears off in seconds: a slow reader finds the beam back on, and the line says what to do then)
      { id: 'cross', line: 'Cross while it\'s out, and right-click again if it comes back', done: { is: 'any', of: [{ is: 'in', area: { x0: 24.4, x1: 25.9, z0: 16.8, z1: 21.5 } }, { is: 'door', door: 'hut', state: 'open' }] }, at: [25.2, 1, 19.2] },
      { id: 'code', line: 'Tap Space at the door to type the code, then keep still', done: { is: 'any', of: [{ is: 'did', what: 'chron:codeEntered' }, { is: 'door', door: 'hut', state: 'open' }] }, at: PAD },
      { id: 'take', line: 'Tap Space at the green trunk, then keep still', done: { is: 'stage', stage: 'exfil' }, at: front },
      { id: 'beam-back', line: 'The beam is back on. Right-click again, then cross', done: { is: 'any', of: [{ is: 'in', area: { x0: 20.7, x1: 23.6, z0: 16.8, z1: 21.8 } }, { is: 'in', area: COURT_E }] }, at: EMITTER },
      // THE CLOSER: the breaker box in the dark end of the lit, watched court takes lamps, lens and beam together (the OCP on the box or the lamps shot out pass it too)
      { id: 'breaker', line: 'One box powers all the lights. Press Space at the breaker box to cut them', done: { is: 'any', of: [{ is: 'did', what: 'act:breakerOff' }, { is: 'target', name: 'lamp_exit', on: false }, { is: 'door', door: 'gate_e', state: 'open' }] }, at: BRK },
      { id: 'walk', line: 'Press N for night vision and walk out through the dark', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'in', area: { x0: 28, x1: 31.8, z0: 12.4, z1: 15.6 } }, { is: 'meter', which: 'light', below: 0.3 }] }, { is: 'door', door: 'gate_e', state: 'open' }] }, at: [30.6, 1, 14] },
      { id: 'kick', line: 'The gate is locked. Hold Space, roll the wheel to kick, then let go', ringLine: 'The gate is locked. Hold Space and press 2 to kick it', done: { is: 'any', of: [{ is: 'door', door: 'gate_e', state: 'broken' }, { is: 'door', door: 'gate_e', state: 'open' }] }, at: [32, 1, 14] },
    ],
  };
  const out = T.finish({
    spawn: [5.2, 0, 14.0], routes,
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, lesson, kitView: LIGHTS_KITVIEW },
    level: { devices, beacons },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). NO LIGHT IS ADDED OR CHANGED HERE: this
// lesson is about the lights. The generator yard as the men who keep the power on left it: the fuel point and the spares rack at the
// lane's dead end and the minder's seat by the set; the linesman's corner in the west court (THE CABLE SPOOLS — this corner's
// signature, stood again outside the walls of lessons 2 and 4 — under the gate lamp, a cross-arm on trestles and his ladder in the dark south of them); the fuel dump under the mid
// court's south wall, out of the camera's reach (drums on a cradle in a bund, the fire point); the power house (a meter board — dials, no switch:
// the breaker box outside is the lesson's — its rubber mat, the battery bank). Nothing here wears the generator's yellow or the
// battery boxes' olive: on this level those two colours say which circuit a thing is on. The lit east court and the alley stay bare: that floor is the lesson.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('lane');
  rd(9.6, 7.25, 0.29, 0, 0.88, 'drumRed'); bx(9.57, 7.22, 9.63, 7.28, 0.88, 1.25, 'iron'); bx(9.63, 7.23, 9.88, 7.27, 1.2, 1.25, 'iron');   // the fuel point: a drum and its hand pump
  bx(8.9, 6.42, 9.0, 6.58, 0.05, 0.25, 'iron'); bx(8.86, 6.4, 8.9, 6.6, 0.06, 0.26, 'drumRed', L.NS);            // the valve at the pipe's end
  bx(9.2, 7.7, 10.0, 8.2, 0, 0.05, 'tin'); rd(9.45, 7.95, 0.1, 0.05, 0.17, 'tin');                               // a drip tray and the measure
  L.rack(8.2, 8.6, 8.62, 10.5, 1.5, [0.4, 0.9, 1.4]);                                                           // the spares rack, west wall
  L.row(8.26, 8.7, 'z', 4, 0.18, 0.3, 0.06, 0.4, 0.62, ['tin', 'tin', 'rust', 'tin']);   // cans (never the generator's yellow nor the battery boxes' olive: on this level those two colours are the circuit)
  L.row(8.26, 8.7, 'z', 5, 0.16, 0.28, 0.06, 0.9, 1.1, ['whitewash', 'whitewash', 'paintRust', 'whitewash', 'whitewash']);   // filters
  bx(8.26, 9.9, 8.56, 10.4, 0.9, 1.02, 'plasticBlack'); bx(8.26, 8.7, 8.5, 9.3, 1.4, 1.5, 'ply'); bx(8.26, 9.5, 8.56, 10.3, 1.4, 1.46, 'rubber');
  for (let i = 0; i < 3; i++) hung('z', 8, 7.0 + i * 0.4, 7.25 + i * 0.4, 1, 1.2, 1.75, 'rubber', 0.02);        // fan belts on their nails
  bx(26.9, 10.3, 27.5, 10.8, 0, 0.45, 'poplar');                                                                // the minder's crate: flask, cup, radio
  rd(27.05, 10.5, 0.06, 0.45, 0.72, 'plasticGreen'); bx(27.3, 10.45, 27.38, 10.53, 0.45, 0.54, 'whitewash'); bx(27.18, 10.62, 27.42, 10.76, 0.45, 0.58, 'plasticBlack');
  L.stool(26.4, 10.5); L.jerry(10.7, 7.0, 0.2, 'tin');

  L.place('linesman');
  L.spools(10.9, 16.2);                                                                                         // THE CABLE SPOOLS: north of the south wall's moon shadow (z over 18.4 is black), in the gate lamp's pool until it is shot out
  bx(9.0, 19.2, 9.08, 19.9, 0, 0.7, 'woodGrey'); bx(10.9, 19.2, 10.98, 19.9, 0, 0.7, 'woodGrey');               // a cross-arm on two trestles, insulators on
  bx(8.8, 19.45, 11.2, 19.6, 0.7, 0.82, 'poplar'); L.row(8.95, 19.47, 'x', 4, 0.11, 0.11, 0.55, 0.82, 0.98, ['whitewash']);
  bx(8.6, 21.4, 11.8, 21.45, 0, 0.06, 'poplar'); bx(8.6, 21.75, 11.8, 21.8, 0, 0.06, 'poplar');                 // his ladder, down along the wall
  for (let i = 0; i < 7; i++) bx(8.9 + i * 0.45, 21.45, 8.94 + i * 0.45, 21.75, 0.01, 0.05, 'poplar');
  hung('z', 8, 19.9, 20.5, 1, 0.9, 1.6, 'rubber', 0.03);                                                        // the climbing belt
  L.loose('bin', 12.3, 21.2, 0, 5, [{ off: [0, 0.07, 0], h: [0.26, 0.07, 0.26], m: 'plasticBlack' }, { off: [0, 0.142, 0], h: [0.1, 0.003, 0.1], m: 'dirt' }]);   // a coil of wire
  L.chest(11.9, 20.3, 0.3, 'poplar', 0.25, 0.14, 0.18, 'whitewash');                                            // a crate of insulators

  L.place('fuel');
  bx(16.0, 20.75, 20.1, 20.85, 0, 0.14, 'block'); bx(16.0, 20.85, 16.1, 21.76, 0, 0.14, 'block'); bx(20.0, 20.85, 20.1, 21.76, 0, 0.14, 'block');   // the bund
  bx(16.4, 21.1, 19.7, 21.2, 0, 0.3, 'woodGrey'); bx(16.4, 21.6, 19.7, 21.7, 0, 0.3, 'woodGrey');               // the cradle, three drums on their sides
  L.row(16.5, 21.0, 'x', 3, 0.6, 0.86, 0.5, 0.3, 0.9, ['drumBlue', 'drumRed', 'rust']);
  for (const x of [16.8, 17.9, 19.0]) bx(x - 0.03, 20.94, x + 0.03, 21.0, 0.36, 0.42, 'tin', L.NS);             // their taps
  flat(16.3, 20.88, 19.6, 21.0, 'oil', 0.022);
  hung('x', 22, 17.3, 18.5, -1, 1.5, 2.0, 'whitewash', 0.015); hung('x', 22, 17.4, 18.4, -1, 1.7, 1.8, 'truckRed', 0.01, 0.015);   // NO SMOKING
  bx(15.64, 18.9, 15.7, 18.96, 0, 1.2, 'drumRed'); bx(15.64, 20.3, 15.7, 20.36, 0, 1.2, 'drumRed'); bx(15.65, 18.96, 15.69, 20.3, 1.14, 1.18, 'drumRed', L.NS);   // the fire point
  L.row(15.66, 19.05, 'z', 3, 0.26, 0.24, 0.18, 0.82, 1.12, ['drumRed'], L.NS);
  bx(15.64, 19.1, 16.1, 20.1, 0, 0.35, 'woodGrey'); bx(15.68, 19.14, 16.06, 20.06, 0.35, 0.356, 'sandbag', L.NS);   // and its sand box
  L.bucket(17.3, 20.3, 'tin', 'oil'); L.bucket(19.6, 20.2, 'galv', 'oil');

  L.place('powerhouse');
  flat(28.3, 17.0, 30.5, 17.8, 'rubber', 0.03);                                                                 // the rubber mat a man stands on to read it
  bx(28.4, 16.74, 30.4, 16.94, 0.25, 2.0, 'tWall'); bx(28.45, 16.76, 28.55, 16.92, 0, 0.25, 'iron'); bx(30.25, 16.76, 30.35, 16.92, 0, 0.25, 'iron');   // THE METER BOARD (dials and a trunk, nothing to throw: the one box that switches anything is the breaker box outside, where the lesson sends him)
  const face = (a: number, b: number, y0: number, y1: number, m: Parameters<typeof bx>[6], p = 0.03) => bx(a, 16.94, b, 16.94 + p, y0, y1, m, L.NS);
  for (let i = 0; i < 4; i++) face(28.6 + i * 0.36, 28.8 + i * 0.36, 1.55, 1.75, 'whitewash', 0.015);           // dials
  face(28.5, 30.3, 0.5, 0.56, 'plasticBlack', 0.02);                                                            // the busbar's trunk
  bx(29.3, 16.78, 29.5, 16.9, 2.0, 2.4, 'plasticBlack');                                                        // the riser to the roof
  bx(30.34, 17.25, 30.86, 18.5, 0, 0.3, 'poplar'); L.row(30.4, 17.32, 'z', 3, 0.32, 0.4, 0.07, 0.3, 0.55, ['plasticBlack']);   // the battery bank
  for (let i = 0; i < 3; i++) bx(30.46, 17.36 + i * 0.39, 30.74, 17.42 + i * 0.39, 0.55, 0.565, 'tin', L.NS);
  rd(26.78, 21.08, 0.27, 0, 0.5, 'plasticBlack'); rd(26.78, 21.08, 0.3, 0.5, 0.54, 'woodGrey');                 // a reel of cable
  hung('x', 21.6, 27.9, 29.3, -1, 1.2, 1.9, 'whitewash', 0.012);                                                // the wiring diagram over the table
  for (let i = 0; i < 3; i++) hung('x', 21.6, 28.0, 29.2, -1, 1.35 + i * 0.18, 1.37 + i * 0.18, 'drumRed', 0.006, 0.012);
  L.stool(29.3, 17.9, 'plasticBlue');
  L.loose('bin', 27.8, 17.05, 0, 4, [{ off: [0, 0.25, 0], h: [0.09, 0.25, 0.09], m: 'drumRed' }, { off: [0, 0.53, 0], h: [0.03, 0.03, 0.03], m: 'plasticBlack' }]);   // the extinguisher

  L.place('beyond');
  L.cauldrons(6.4, 8.2, 1, 2);                                                                                  // the kitchen court's pots, past the west wall
  L.flag(34.4, 9.2);                                                                                            // the range's flag, past the east wall
  L.done();
}
