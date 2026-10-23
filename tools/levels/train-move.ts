// A CHECK'S STAGE, NOT A MISSION: this yard was a Training lesson's level. The seven Training lessons were taken out 2026-10-23 (the tutorial's six missions
// replaced them); the lesson's steps, its row on the mission list and its scripted player are gone. The yard stays because checks owned elsewhere are
// staged on its floor (tools/qa: the hands probes, hands-strip, hands-look, solofog-check, savetimeline-check, sticky-check). Nothing on a menu loads it. What follows describes the floor as it was built for the lesson.
//
// TRAIN-MOVE — Training 1, "Moving unseen": THE MOTOR POOL. Walking, the action key, sprinting (loud, and under a lamp: both meters up), then crouching, the
// wheel and the dark bring both down; back to the wall, the lean, night vision — then past one guard to the dispatcher's hut, the vehicle log out of a trunk,
// and out by the east gate across three metres of light while the guard has his back to it. A quiet mission (game/quiet.ts) alone, with a
// `scenarios.lesson` block (game/lesson.ts) whose steps name each key and move on when the thing is DONE.
//
//        x 8          13        19     22.6   25      28      32
//   z 6  ┌──────────────────────────────────────────────────────┐
//        │  parked row (two pickups, a bike)   ┌────────┐ ▪breaker
//        │                                  hut│ trunk  ╪ back door      the dispatcher's hut: its door on the dark west side, a back door east
//  gate_w   (lamp: a lit pool)                 └────────┘  (lamp)gate_e    a small lamp over the east gate: the guard checks it
//        │                                  ║  [the technical]═► ·
//        │            ┌─container─┐         ║  ·   (a lamp)   · ·          the guard: the gate, then the wheel he minds
//        │            └───────────┘       notch  wheel ·                   the notch: a shelled bite out of the wall, eyes only
//   z 22 └─────────────dark lane────────────╨───────────────────┘
//
//   bun run tools/levels/export.ts train-move [--check]      → levels/train-move.json
//   page: ?levelFile=train-move.json&quiet  
import type { KitViewData, QuietData, Rect } from '../../src/scene/scenarios';
import type { Paint } from '../../src/scene/gwotKit';
import { trainGround, TRAIN_MATERIALS, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';
import { livedTrain } from './lived-train';

export const NAME = 'train-move';
export const NOTES = 'A stage for checks (once Training 1): the motor pool. A lit pool to get out of, a container and a dark lane, one guard between his tea and the lit east gate, the dispatcher\'s hut with the vehicle log. Regenerate: bun run tools/levels/export.ts train-move';
export const MATERIALS = TRAIN_MATERIALS;

/** the lamp's pool inside the west gate: where the sprint is asked for (loud AND lit) */
const POOL: Rect = { x0: 8.6, x1: 14.5, z0: 11.6, z1: 17 };
/** the dark lane's far end, south of the container: where 'into the dark' is judged */
const LANE_END: Rect = { x0: 16.6, x1: 18.9, z0: 20.4, z1: 21.8 };
/** the strip along the container's south face: Q there takes the container, not the yard wall a stride behind him */
const FACE: Rect = { x0: 13.2, x1: 19.7, z0: 20.2, z1: 21.0 };
/** behind the hut: the ground under its east wall, south of the back door. The hut stands between it and every step of the man who comes to look (his way in
 *  and out is the west door), and no lamp reaches it: the east gate's pool starts a stride south of it */
const BEHIND: Rect = { x0: 28.3, x1: 29.2, z0: 9.4, z1: 10.6 };
/** the trunk's paint. G.trunk's type (`Paint`) names the kit's four trunk paints and none is grey; the piece itself only looks the name up in the palette,
 *  where 'blanketGrey' is a plain flat grey — hence the cast (adding a grey to `Paint` is a shared-file change this lesson may not make) */
const GREY = 'blanketGrey' as Paint;

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set on the yard's west gate
 *  (train-ground-kitview.ts). From the gate as it stands the picture's column holds a bare wall: the parked row is three strides too deep for it. So the motor
 *  pool is brought up to the wall: the tan pickup off the parked row with the drums in its bed, the bike, the three drums, the parts rack where it hangs. Every piece is this level's own box as exported
 *  (levels/train-move.json), moved; the ids are the set's (tm_). */
const SHELL = yardGateShell('tm');
const MOVE_KITVIEW: KitViewData = {
  sets: { pool: { ...SHELL,
    lights: [{ id: 'tm_lamp_gate', kind: 'spot', pos: [11, 3.37, 13.6], dir: [0, -1, 0], color: [1, 0.86, 0.6], intensity: 90, range: 9, innerDeg: 30, outerDeg: 52, group: 'tm', enabled: true, volumetric: 0.2, radius: 0.1, mains: false, fixture: 'tm_067' }],
    boxes: [...SHELL.boxes,
      { id: 'tm_001', group: 'tm.rack', c: [8.475, 0.65, 7.03], h: [0.275, 0.65, 0.03], material: 'rust' },
      { id: 'tm_002', group: 'tm.rack', c: [8.475, 0.65, 8.63], h: [0.275, 0.65, 0.03], material: 'rust' },
      { id: 'tm_003', group: 'tm.rack', c: [8.475, 0.65, 10.23], h: [0.275, 0.65, 0.03], material: 'rust' },
      { id: 'tm_004', group: 'tm.rack', c: [8.325, 0.5, 8.6], h: [0.075, 0.05, 1.7], material: 'rust' },
      { id: 'tm_005', group: 'tm.rack', c: [8.49, 0.48, 8.6], h: [0.04, 0.03, 1.5], material: 'galv' },
      { id: 'tm_006', group: 'tm.rack', c: [8.64, 0.475, 8.45], h: [0.06, 0.025, 1.15], material: 'iron' },
      { id: 'tm_007', group: 'tm.rack', c: [8.29, 0.99, 8.625], h: [0.04, 0.04, 1.625], material: 'galv' },
      { id: 'tm_008', group: 'tm.rack', c: [8.51, 0.975, 8.2], h: [0.11, 0.025, 1], material: 'tin' },
      { id: 'tm_009', group: 'tm.rack', c: [8.49, 1.025, 9.75], h: [0.13, 0.075, 0.45], material: 'rust' },
      { id: 'tm_010', group: 'tm.pickup', c: [9.12, 0.37, 11.7], h: [0.37, 0.37, 0.13], yaw: 1.5708, material: 'rubber' },
      { id: 'tm_011', group: 'tm.pickup', c: [10.68, 0.37, 11.7], h: [0.37, 0.37, 0.13], yaw: 1.5708, material: 'rubber' },
      { id: 'tm_012', group: 'tm.pickup', c: [9.12, 0.37, 8.68], h: [0.37, 0.37, 0.13], yaw: 1.5708, material: 'rubber' },
      { id: 'tm_013', group: 'tm.pickup', c: [10.68, 0.37, 8.68], h: [0.37, 0.37, 0.13], yaw: 1.5708, material: 'rubber' },
      { id: 'tm_014', group: 'tm.pickup', c: [9.9, 0.55, 10.2], h: [2.45, 0.25, 0.86], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_015', group: 'tm.pickup', c: [9.9, 0.47, 7.73], h: [0.05, 0.11, 0.88], yaw: 1.5708, material: 'plasticBlack' },
      { id: 'tm_016', group: 'tm.pickup', c: [9.9, 0.47, 12.67], h: [0.05, 0.11, 0.88], yaw: 1.5708, material: 'plasticBlack' },
      { id: 'tm_017', group: 'tm.pickup', c: [9.9, 0.9, 8.45], h: [0.7, 0.1, 0.84], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_018', group: 'tm.pickup', c: [9.9, 0.94, 9.82], h: [0.7, 0.14, 0.86], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_019', group: 'tm.pickup', c: [9.9, 1.29, 9.82], h: [0.64, 0.21, 0.8], yaw: 1.5708, material: 'glassDark' },
      { id: 'tm_020', group: 'tm.pickup', c: [9.9, 1.54, 9.84], h: [0.6, 0.04, 0.78], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_021', group: 'tm.pickup', c: [9.9, 0.815, 11.62], h: [1, 0.015, 0.76], yaw: 1.5708, material: 'plasticBlack' },
      { id: 'tm_022', group: 'tm.pickup', c: [9.07, 0.99, 11.62], h: [1.03, 0.19, 0.03], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_023', group: 'tm.pickup', c: [10.73, 0.99, 11.62], h: [1.03, 0.19, 0.03], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_024', group: 'tm.pickup', c: [9.9, 0.99, 12.62], h: [0.03, 0.19, 0.86], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_025', group: 'tm.pickup', c: [9.9, 0.99, 10.56], h: [0.03, 0.19, 0.86], yaw: 1.5708, material: 'truckTan' },
      { id: 'tm_026', group: 'tm.pickup', c: [9.24, 0.69, 7.77], h: [0.03, 0.07, 0.16], yaw: 1.5708, material: 'plasticWhite' },
      { id: 'tm_027', group: 'tm.pickup', c: [9.18, 0.7, 12.63], h: [0.03, 0.08, 0.1], yaw: 1.5708, material: 'truckRed' },
      { id: 'tm_028', group: 'tm.pickup', c: [10.56, 0.69, 7.77], h: [0.03, 0.07, 0.16], yaw: 1.5708, material: 'plasticWhite' },
      { id: 'tm_029', group: 'tm.pickup', c: [10.62, 0.7, 12.63], h: [0.03, 0.08, 0.1], yaw: 1.5708, material: 'truckRed' },
      { id: 'tm_030', group: 'tm.pickup', c: [9.54, 1.27, 11.05], h: [0.2784, 0.44, 0.1153], yaw: 1.5708, material: 'drumBlue' },
      { id: 'tm_031', group: 'tm.pickup', c: [9.54, 1.269, 11.05], h: [0.2784, 0.439, 0.1153], yaw: 2.3562, material: 'drumBlue' },
      { id: 'tm_032', group: 'tm.pickup', c: [9.54, 1.268, 11.05], h: [0.2784, 0.438, 0.1153], yaw: 3.1416, material: 'drumBlue' },
      { id: 'tm_033', group: 'tm.pickup', c: [9.54, 1.267, 11.05], h: [0.2784, 0.437, 0.1153], yaw: 3.927, material: 'drumBlue' },
      { id: 'tm_034', group: 'tm.pickup', c: [10.26, 1.27, 11.05], h: [0.2784, 0.44, 0.1153], yaw: 1.5708, material: 'drumBlue' },
      { id: 'tm_035', group: 'tm.pickup', c: [10.26, 1.269, 11.05], h: [0.2784, 0.439, 0.1153], yaw: 2.3562, material: 'drumBlue' },
      { id: 'tm_036', group: 'tm.pickup', c: [10.26, 1.268, 11.05], h: [0.2784, 0.438, 0.1153], yaw: 3.1416, material: 'drumBlue' },
      { id: 'tm_037', group: 'tm.pickup', c: [10.26, 1.267, 11.05], h: [0.2784, 0.437, 0.1153], yaw: 3.927, material: 'drumBlue' },
      { id: 'tm_038', group: 'tm.pickup', c: [9.9, 1.27, 11.7], h: [0.2784, 0.44, 0.1153], yaw: 1.5708, material: 'rust' },
      { id: 'tm_039', group: 'tm.pickup', c: [9.9, 1.269, 11.7], h: [0.2784, 0.439, 0.1153], yaw: 2.3562, material: 'rust' },
      { id: 'tm_040', group: 'tm.pickup', c: [9.9, 1.268, 11.7], h: [0.2784, 0.438, 0.1153], yaw: 3.1416, material: 'rust' },
      { id: 'tm_041', group: 'tm.pickup', c: [9.9, 1.267, 11.7], h: [0.2784, 0.437, 0.1153], yaw: 3.927, material: 'rust' },
      { id: 'tm_042', group: 'tm.bike', c: [9.9305, 0.3, 16.905], h: [0.3, 0.3, 0.05], yaw: 0.3, material: 'rubber' },
      { id: 'tm_043', group: 'tm.bike', c: [8.7077, 0.3, 17.2832], h: [0.3, 0.3, 0.05], yaw: 0.3, material: 'rubber' },
      { id: 'tm_044', group: 'tm.bike', c: [9.3191, 0.41, 17.0941], h: [0.2, 0.15, 0.12], yaw: 0.3, material: 'iron' },
      { id: 'tm_045', group: 'tm.bike', c: [9.472, 0.7, 17.0468], h: [0.24, 0.14, 0.12], yaw: 0.3, material: 'truckRed' },
      { id: 'tm_046', group: 'tm.bike', c: [8.9561, 0.71, 17.2064], h: [0.34, 0.09, 0.11], yaw: 0.3, material: 'plasticBlack' },
      { id: 'tm_047', group: 'tm.bike', c: [9.8732, 0.81, 16.9227], h: [0.03, 0.21, 0.03], yaw: 0.3, material: 'galv' },
      { id: 'tm_048', group: 'tm.bike', c: [9.835, 1.02, 16.9345], h: [0.02, 0.02, 0.32], yaw: 0.3, material: 'iron' },
      { id: 'tm_049', group: 'tm.bike', c: [10.0069, 0.86, 16.8813], h: [0.05, 0.08, 0.07], yaw: 0.3, material: 'iron' },
      { id: 'tm_050', group: 'tm.bike', c: [8.4975, 0.68, 17.3482], h: [0.16, 0.02, 0.13], yaw: 0.3, material: 'iron' },
      { id: 'tm_051', group: 'tm.bike', c: [8.9651, 0.32, 17.3711], h: [0.42, 0.04, 0.035], yaw: 0.3, material: 'iron' },
      { id: 'tm_052', group: 'tm.drums', c: [8.8, 0.44, 15.3], h: [0.2784, 0.44, 0.1153], yaw: 0.5364, material: 'drumRed' },
      { id: 'tm_053', group: 'tm.drums', c: [8.8, 0.439, 15.3], h: [0.2784, 0.439, 0.1153], yaw: 1.3218, material: 'drumRed' },
      { id: 'tm_054', group: 'tm.drums', c: [8.8, 0.438, 15.3], h: [0.2784, 0.438, 0.1153], yaw: 2.1072, material: 'drumRed' },
      { id: 'tm_055', group: 'tm.drums', c: [8.8, 0.437, 15.3], h: [0.2784, 0.437, 0.1153], yaw: 2.8926, material: 'drumRed' },
      { id: 'tm_056', group: 'tm.drums', c: [9.44, 0.44, 15.36], h: [0.2784, 0.44, 0.1153], yaw: 0.3281, material: 'rust' },
      { id: 'tm_057', group: 'tm.drums', c: [9.44, 0.439, 15.36], h: [0.2784, 0.439, 0.1153], yaw: 1.1135, material: 'rust' },
      { id: 'tm_058', group: 'tm.drums', c: [9.44, 0.438, 15.36], h: [0.2784, 0.438, 0.1153], yaw: 1.8989, material: 'rust' },
      { id: 'tm_059', group: 'tm.drums', c: [9.44, 0.437, 15.36], h: [0.2784, 0.437, 0.1153], yaw: 2.6843, material: 'rust' },
      { id: 'tm_060', group: 'tm.drums', c: [9.1, 0.44, 15.9], h: [0.2784, 0.44, 0.1153], yaw: 0.5353, material: 'drumBlue' },
      { id: 'tm_061', group: 'tm.drums', c: [9.1, 0.439, 15.9], h: [0.2784, 0.439, 0.1153], yaw: 1.3207, material: 'drumBlue' },
      { id: 'tm_062', group: 'tm.drums', c: [9.1, 0.438, 15.9], h: [0.2784, 0.438, 0.1153], yaw: 2.1061, material: 'drumBlue' },
      { id: 'tm_063', group: 'tm.drums', c: [9.1, 0.437, 15.9], h: [0.2784, 0.437, 0.1153], yaw: 2.8915, material: 'drumBlue' },
      { id: 'tm_064', group: 'tm.lamp', c: [11, 1.755, 13], h: [0.04, 1.755, 0.04], material: 'galv' },
      { id: 'tm_065', group: 'tm.lamp', c: [11, 3.485, 13.3], h: [0.025, 0.025, 0.26], material: 'galv' },
      { id: 'tm_066', group: 'tm.lamp', c: [11, 3.46, 13.6], h: [0.2, 0.05, 0.2], material: 'plasticBlack' },
      { id: 'tm_067', group: 'tm.lamp', c: [11, 3.4, 13.6], h: [0.12, 0.012, 0.12], material: 'plasticWhite', emissive: [40, 34, 22], flags: ['NoShadow'] },
    ] } },
  ways: [{ door: 'tm_gate', set: 'pool', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  /** an oil STAIN (drawn only, on the floor): three overlapping dark patches, so it reads as a spill and not as a rectangle */
  const stain = (x: number, z: number, r: number) => { G.patch(x, z, r * 2, r * 1.3, 'damp', 0.35); G.patch(x + r * 0.45, z + r * 0.3, r * 1.2, r * 1.5, 'damp', -0.5); G.patch(x - r * 0.5, z - r * 0.2, r * 0.9, r * 0.8, 'damp', 1.1); };

  // ---- the west yard, where the vehicles sleep: gravel, ruts, oil; a lamp inside the gate throws a pool he sprints into; the parked row along the
  //      north wall; a container across the south with a dark lane behind it ----
  grp('yard.west');
  G.ground(8.12, 6.12, 22.48, 21.88, 'gravel', 0.007);
  T.lamp(11.2, 14.0, 'lamp_gate');
  G.container(16.0, 19.0, 0);
  // a second container end-on at the first one's east end (an L): the guard's ground has a line through the broken wall, and without this it ran 14 m to
  // the lit pool where a new player stands reading. The lean's own lines (z 19.2 and south of it) pass clear of it
  G.container(19.22, 14.75, HALF, 'rust');   // (butted on the first one's north face: no slit for the lamp to blade through; a duller rust, so the white truck stays the first thing seen)
  G.pickup(12.4, 8.9, HALF, 'truckTan', { load: 'drums' }); G.pickup(16.0, 8.9, HALF, 'truckRed'); G.motorbike(18.9, 7.5, 0.3);
  // the way the trucks come: in by the vehicle gate in the north wall (shut tonight), down the west side, round under the lamp, and backed in to the wall
  G.gate(9.9, 6.15, 'x', 2.6, 1, 'paintGreen', 0);
  G.ruts(9.9, 6.5, 9.9, 12.8, 'oil'); G.ruts(9.9, 12.8, 11.9, 15.0, 'oil');
  G.ruts(12.4, 11.5, 12.4, 14.6, 'oil'); G.ruts(16.0, 11.5, 16.0, 13.0, 'oil'); G.ruts(16.0, 13.0, 13.2, 15.2, 'oil');
  stain(12.9, 12.1, 0.6); stain(15.7, 12.3, 0.5); stain(14.2, 8.3, 0.45); stain(18.7, 8.7, 0.4);
  G.drums(14.2, 10.3, 3); G.jerryCan(14.0, 11.2, 0.3); G.jerryCan(14.45, 11.3, -0.2, 'jerryYellow');   // the fuel, between the two parked trucks: in the lamp's edge, off every path
  G.drumDown(20.9, 7.1, 0.2); G.tyres(21.9, 18.0, 2);
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);
  // ---- the east yard: the dispatcher's hut against the north wall (a table, a chair, the trunk; a BACK DOOR in its east wall, a stride from the trunk, onto
  //      ground nobody walks), and THE TECHNICAL nose to the east gate: the big shape between the hut and the guard's ground ----
  // The back door is the way out when the man comes to look: he is told to hide where he was not shot for it. The strip between the hut and the technical was
  // that place and was neither dark on the page's meter (35 to 57 %: the gate lamp's pool off a white truck) nor out of sight (the man walks past its mouth
  // going in and coming back, and looks down it): a player who sat on the mark was seen at 4 m, twice.
  const HUT = T.hut({ x0: 23, z0: 7.2, x1: 28, z1: 12, doors: [{ name: 'hut', side: 'w', at: 9.0 }, { name: 'hut_back', side: 'e', at: 7.9 }] });
  grp('hut.room');
  G.table(25.4, 7.82); G.plasticChair(25.5, 8.75, 0.15); G.trunk(27.4, 9.6, HALF, GREY); G.lantern(24.95, 7.82, 'lantern_hut', 'hut', 0.75);
  grp('yard.east');
  // a wall between the lane's end and the guard's yard; a shell took a bite out of its top: eyes pass (the lean at the container's end looks through it), men do not
  G.yardWallZ(22.6, 14.6, 22, 'mud', [{ a: 18.2, b: 20.8, y0: 0.9, y1: 2.4 }]); G.pier(22.6, 14.6);
  T.add({ c: [22.6, 1.2, 18.33], h: [0.12, 0.3, 0.13], ...G.M.mud }); T.add({ c: [22.6, 1.05, 18.62], h: [0.12, 0.15, 0.16], ...G.M.mud });   // the bite's ragged north edge
  G.rubble(22.05, 19.5, 0.55, 6); G.rubble(23.2, 19.4, 0.6, 7);
  G.pickup(26.9, 14.5, 0, 'truckWhite', { mount: true }); stain(29.0, 15.75, 0.45); stain(24.1, 15.9, 0.35);
  // a barrier from the technical's nose to the yard wall: the guard's ground is shut off from the gate (he looks at it over the barrier), so his one way
  // to the hut is west, past the truck's tail, and in by its west door
  G.jersey(30.62, 15.0, 1);
  T.lamp(28.8, 17.9, 'lamp_yard');
  T.lamp(30.8, 13.2, 'lamp_exit', { height: 3.0, outerDeg: 38 });   // a small pool over the east gate: the three metres of light the way out crosses
  // the guard's corner: a wheel off a truck that he is minding by lantern light — the wheel and a spare, his toolbox (a poplar crate) with the lantern on it, a chair
  G.tyres(25.65, 21.05, 2); { const b = G.piece(24.9, 20.95, 0); b(0, 0, 0, 0.3, 0.3, 0.2, G.M.poplar); b(0.42, -0.1, 0, 0.05, 0.14, 0.03, G.M.iron); }
  G.lantern(24.9, 20.95, 'lantern_tea', 'exterior', 0.3); G.plasticChair(24.2, 20.9, -HALF);
  G.drums(31.2, 6.85, 2); G.jerryCan(30.4, 6.6, 0.4, 'jerryYellow');
  T.breakerAt(31.84, 8.0, 'w');   // on the east wall by the hut's window: the man sent to check it has floor to stand on (the shell's default sends him outside the wall)
  // ---- outside the east wall: the kitchen court's edge (Training 2's place) — its bread oven and a wash line. Nobody walks there ----
  grp('beyond.east');
  G.tandoor(35.6, 9.4); G.washLine(34.4, 17.6, 38.2, 18.6, 4); stain(35.9, 10.5, 0.6);

  // ---- one guard, between two things he looks at: up to the lit east gate (he arrives walking at it), then back to the wheel he is minding by the south wall (he arrives facing it) ----
  const routes = [{ name: 'yard', points: [[25.2, 0, 17.0], [25.2, 0, 19.8], [29.2, 0, 18.0], [30.6, 0, 16.1]] as [number, number, number][], wait: [0, 6, 0, 5] }];

  const front: [number, number, number] = [27.0, 1.0, 9.6];
  const quiet: QuietData = {
    thing: 'the vehicle log',
    starts: [{ name: 'the track', sam: [2.6, 0, 14.0], samYaw: HALF }],
    spots: [{ place: 'the dispatcher\'s hut', area: { ...HUT }, door: 'hut', holder: 'the grey trunk', rackIndex: 0, front, halfW: 0.3, wired: true }],   // (wired: the lesson's last beat IS the man who comes to look — 'He will come to look. Hide…'; game/takecheck.ts)
    exits: [EXIT_E],
    patrols: [['yard']],
  };
  const out = T.finish({
    spawn: [2.6, 0, 14.0], routes,
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, kitView: MOVE_KITVIEW },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The motor pool as its men left it:
// the fitter's corner under the south wall (bench, tool board, tyre rack and THE HOIST with an engine on its chain — this corner's
// signature, stood again outside the kitchen court's west wall), the dispatcher's hut (parts shelves, batteries on charge, the key
// board), and the parking row (painted bays, a steel rack, a pair of ramps). Nothing here stands in a lesson's area, on the guard's
// walk or in the lane behind the containers; no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('fitters');
  flat(26.9, 20.25, 29.9, 21.25, 'oil');                                                                        // the black ground in front of the bench
  L.table(27.2, 21.28, 29.6, 21.84, 0.9, 'woodGrey', 'iron');                                                   // the bench
  bx(27.3, 21.34, 29.5, 21.8, 0.3, 0.33, 'woodGrey');
  bx(27.4, 21.4, 27.95, 21.76, 0.33, 0.56, 'truckRed'); bx(28.5, 21.4, 29.3, 21.76, 0.33, 0.52, 'rust');         // a tool chest and a gearbox casing under it
  bx(27.34, 21.36, 27.58, 21.56, 0.9, 1.08, 'iron'); bx(27.42, 21.3, 27.52, 21.36, 0.98, 1.04, 'galv');         // the vice
  bx(28.0, 21.46, 28.5, 21.72, 0.9, 1.06, 'drumBlue');                                                          // an open tool box
  bx(28.78, 21.5, 28.93, 21.65, 0.9, 1.1, 'jerryYellow'); bx(29.02, 21.44, 29.17, 21.59, 0.9, 1.05, 'jerryYellow'); // oil tins
  rd(29.4, 21.6, 0.12, 0.9, 0.95, 'tin');                                                                       // a hub cap of nuts
  hung('x', 22, 27.4, 29.4, -1, 1.2, 1.95, 'ply', 0.02);                                                        // the tool board
  for (const [a, w, y0, y1] of [[27.55, 0.05, 1.3, 1.82], [27.75, 0.05, 1.4, 1.82], [27.95, 0.12, 1.5, 1.82], [28.3, 0.3, 1.56, 1.62], [28.43, 0.04, 1.3, 1.56], [28.8, 0.05, 1.35, 1.82], [29.05, 0.2, 1.6, 1.8]])
    hung('x', 22, a, a + w, -1, y0, y1, 'iron', 0.02, 0.02);
  bx(29.9, 21.25, 31.55, 21.31, 0.1, 0.16, 'woodGrey'); bx(29.9, 21.78, 31.55, 21.84, 0.1, 0.16, 'woodGrey');   // the tyre rack: four on their rims
  L.row(30.0, 21.22, 'x', 4, 0.22, 0.64, 0.17, 0.14, 0.8, ['rubber']);
  L.hoist(30.7, 19.5);                                                                                          // THE HOIST
  flat(30.0, 18.95, 31.4, 20.05, 'oil', 0.022);
  bx(29.0, 20.5, 29.5, 20.7, 0, 0.14, 'drumRed'); bx(28.6, 20.58, 29.0, 20.62, 0.1, 0.14, 'iron', L.NS);        // a trolley jack
  L.loose('bin', 26.7, 21.35, 0.3, 9, [{ off: [0, 0.11, 0], h: [0.31, 0.11, 0.31], m: 'rubber' }, { off: [0, 0.224, 0], h: [0.14, 0.004, 0.14], m: 'galv' }]);   // a wheel off its hub
  L.chest(31.35, 20.75, 0.2, 'truckRed');                                                                       // the fitter's own box

  L.place('dispatch');
  flat(23.25, 9.05, 24.45, 10.15, 'rubber');                                                                    // the mat inside the door
  L.rack(25.2, 11.5, 27.4, 11.86, 1.7, [0.35, 0.8, 1.25, 1.7]);                                                 // parts and paper, south wall
  L.row(25.3, 11.56, 'x', 4, 0.16, 0.2, 0.05, 0.35, 0.57, ['jerryYellow', 'jerryYellow', 'olive', 'jerryYellow']);
  bx(26.3, 11.55, 27.2, 11.8, 0.35, 0.6, 'ply');
  L.row(25.3, 11.58, 'x', 5, 0.09, 0.22, 0.02, 0.8, 1.08, ['paintCream', 'paintRust', 'paintGreen', 'paintCream', 'paintBlue']);   // the vehicle books
  bx(26.1, 11.56, 26.5, 11.8, 0.8, 0.98, 'ply'); L.row(26.7, 11.58, 'x', 3, 0.14, 0.2, 0.06, 0.8, 0.95, ['whitewash']);
  bx(25.4, 11.56, 26.0, 11.8, 1.25, 1.4, 'tin'); bx(26.4, 11.58, 27.1, 11.8, 1.25, 1.33, 'rubber');
  bx(23.3, 7.36, 24.5, 7.76, 0, 0.3, 'poplar'); L.row(23.38, 7.42, 'x', 3, 0.3, 0.24, 0.08, 0.3, 0.52, ['plasticBlack']);   // batteries on charge, in the corner by the key board (clear of the back door)
  hung('x', 7.2, 23.5, 24.0, 1, 1.0, 1.3, 'genYellow', 0.1);                                                    // the charger
  hung('z', 23, 7.6, 8.7, 1, 1.25, 1.8, 'ply', 0.02);                                                           // the key board
  for (let i = 0; i < 6; i++) hung('z', 23, 7.7 + i * 0.16, 7.76 + i * 0.16, 1, 1.48, 1.62, 'tin', 0.012, 0.02);
  hung('z', 28, 10.3, 11.3, -1, 1.2, 1.9, 'whitewash', 0.012);                                                  // the duty roster
  for (let i = 0; i < 4; i++) hung('z', 28, 10.4, 11.2, -1, 1.35 + i * 0.13, 1.37 + i * 0.13, 'rubber', 0.006, 0.012);
  rd(23.78, 11.48, 0.3, 0, 0.2, 'rubber'); rd(23.78, 11.48, 0.3, 0.2, 0.4, 'rubber');                           // two spares by the door
  L.stool(26.3, 10.95); L.bucket(24.75, 11.5, 'tin', 'oil');

  L.place('park');
  for (const x of [10.9, 14.25, 17.55]) flat(x - 0.05, 6.4, x + 0.05, 11.6, 'whitewash', 0.022);                // the bays
  [12.4, 16.0].forEach((x, i) => { for (let k = 0; k <= i; k++) flat(x - 0.3 + k * 0.25, 11.75, x - 0.18 + k * 0.25, 12.15, 'whitewash', 0.022); });   // bay one, two (bay three's mouth is the container's end: no tally there)
  for (const z of [7.0, 8.6, 10.2]) bx(8.2, z, 8.75, z + 0.06, 0, 1.3, 'rust');                                 // the steel rack on the west wall
  bx(8.25, 6.9, 8.4, 10.3, 0.45, 0.55, 'rust'); bx(8.45, 7.1, 8.53, 10.1, 0.45, 0.51, 'galv'); bx(8.58, 7.3, 8.7, 9.6, 0.45, 0.5, 'iron');
  bx(8.25, 7.0, 8.33, 10.25, 0.95, 1.03, 'galv'); bx(8.4, 7.2, 8.62, 9.2, 0.95, 1.0, 'tin'); bx(8.36, 9.3, 8.62, 10.2, 0.95, 1.1, 'rust');
  for (const x of [18.0, 19.2]) { bx(x, 9.9, x + 0.4, 10.9, 0, 0.09, 'rust'); bx(x, 8.9, x + 0.4, 9.9, 0, 0.18, 'rust'); }   // a pair of ramps in the empty bay: they climb north, into the bay, their feet toward its mouth (not up at the container's end)
  L.jerry(8.5, 11.0, 0.3, 'jerryYellow');

  L.place('beyond');
  L.cauldrons(37.35, 9.4, 1, 2);                                                                                // the kitchen court's pots, past the east wall
  L.done();
}
