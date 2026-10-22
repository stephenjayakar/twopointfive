// TRAIN-SILENT — Training 7, "Quiet, as two": a quiet mission WITH ONE PARTNER (game/quiet.ts squad 1: the pair rules and the silent posture held on for the
// run). THE WELL COURT AND THE BACK GATE, the darkest corner of the compound: the moon, one lamp over the pump, one lantern on the watch's tea table.
// Each of the quiet pair's orders done once: he follows low in your steps, the squad's posture (loud and back to silent), a spot in the dark, 'watch him',
// 'take him on your mark', the wait for "set", F, fall in, hold — then THE CLOSER: two men of the watch in ONE lantern's light, 4.6 m apart, the near one
// watching the far one's back. Drop the far one alone and the near one has him lit in front of him; so the partner sets up behind the far man (at the gate)
// and your own hands on the near one (by the watch house's door) are the mark.
//
//        x 8        15             23.5              32
//   z 6  ┌──────────┬──pump────────┬─────────────────┐
//        │ garden   │  G1 ↑ (lamp) │  ┌watch house┐  │      G1 looks at the pump, lit by the court's one lamp
//        │    A     │              │  │ red trunk │  │
//  gate_w           │   the well   │  └──door─────┘  gate_e   G2 (the near one) looks across the lantern at G3's back; G3 (the far one), 4.6 m on, looks out at the gate;
//        │  (safe)  │      B       │    G2 → ☼ G3 ↗  │      ☼ = the one lantern, on the tea table between them
//        │          ┴  crates      ┴        C        │      the way on is round each wall's SOUTH end, in the dark, at every man's back
//   z 22 └───────────────────────────────────────────┘
//
//   bun run tools/levels/export.ts train-silent [--check]      → levels/train-silent.json
//   bun run tools/qa/quiet-check.ts train-silent.json          the quiet block against the built floor
//   bun run tools/qa/lesson-check.ts train-silent              the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-silent                the scripted player through every step to the debrief
//   page: ?levelFile=train-silent.json&quiet&squad=1     (&nolesson: the same level as its mission alone)
import type { KitViewData, LessonData, LessonTest, QuietData, Rect } from '../../src/scene/scenarios';
import { trainGround, TRAIN_MATERIALS, EXIT_W, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';
import { livedTrain } from './lived-train';

export const NAME = 'train-silent';
export const NOTES = 'Training 7, quiet as two: the well court and the back gate. A walled yard in three parts (a garden, the well with its pump, the watch house by the back gate), three guards on posts with their backs to the dark, the last two in one lantern\'s light. One partner under the pair rules. Regenerate: bun run tools/levels/export.ts train-silent';
export const MATERIALS = TRAIN_MATERIALS;

/** the first yard, inside the west gate: nobody looks into it */
const YARD_A: Rect = { x0: 8.6, x1: 14.6, z0: 6.6, z1: 21.6 };
/** the dark south of the middle yard, behind the first guard */
const DARK_B: Rect = { x0: 16.2, x1: 23.0, z0: 15.0, z1: 21.6 };
/** …and the strip of it round the first wall's south end */
const ROUND_B: Rect = { x0: 15.4, x1: 23.0, z0: 18.2, z1: 21.6 };

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set on the yard's west gate
 *  (train-ground-kitview.ts). From the gate as it stands the picture's column holds the garden's bean row and no more. So the well court is brought up to it:
 *  the well under its frame, the hand pump on its slab, the bean row a stride further in, the water butt where it stands, the water cart. Every piece is this level's own box as exported
 *  (levels/train-silent.json), moved; the ids are the set's (ts_). */
const SHELL = yardGateShell('ts');
const SILENT_KITVIEW: KitViewData = {
  sets: { well: { ...SHELL,
    lights: [{ id: 'ts_lamp_post', kind: 'spot', pos: [11.2, 3.37, 12.3], dir: [0, -1, 0], color: [1, 0.86, 0.6], intensity: 90, range: 9, innerDeg: 30, outerDeg: 52, group: 'ts', enabled: true, volumetric: 0.2, radius: 0.1, mains: false, fixture: 'ts_019' }],
    boxes: [...SHELL.boxes,
      { id: 'ts_001', group: 'ts.well', c: [9.3, 0.4, 10.6], h: [0.7, 0.4, 0.7], material: 'mud' },
      { id: 'ts_002', group: 'ts.well', c: [9.3, 0.395, 10.6], h: [0.7, 0.395, 0.7], yaw: 0.785, material: 'mud' },
      { id: 'ts_003', group: 'ts.well', c: [9.3, 0.83, 10.6], h: [0.76, 0.03, 0.76], material: 'mudLight' },
      { id: 'ts_004', group: 'ts.well', c: [9.3, 0.865, 10.6], h: [0.45, 0.005, 0.45], material: 'rubber' },
      { id: 'ts_005', group: 'ts.well', c: [8.68, 0.95, 10.6], h: [0.05, 0.95, 0.05], material: 'woodGrey' },
      { id: 'ts_006', group: 'ts.well', c: [9.92, 0.95, 10.6], h: [0.05, 0.95, 0.05], material: 'woodGrey' },
      { id: 'ts_007', group: 'ts.well', c: [9.3, 1.95, 10.6], h: [0.75, 0.05, 0.05], material: 'woodGrey' },
      { id: 'ts_008', group: 'ts.pump', c: [9.8, 0.05, 12.4], h: [0.7, 0.05, 0.7], material: 'block' },
      { id: 'ts_009', group: 'ts.pump', c: [9.8, 0.012, 12.4], h: [1.4, 0.003, 1.2], yaw: 0.3, material: 'damp', flags: ['NoShadow'] },
      { id: 'ts_010', group: 'ts.pump', c: [10.1, 0.013, 12.2], h: [0.85, 0.003, 0.65], yaw: -0.5, material: 'damp', flags: ['NoShadow'] },
      { id: 'ts_011', group: 'ts.pump', c: [9.8, 0.525, 12.4], h: [0.06, 0.425, 0.06], material: 'paintGreen' },
      { id: 'ts_012', group: 'ts.pump', c: [9.8, 1.015, 12.4], h: [0.08, 0.065, 0.08], material: 'paintGreen' },
      { id: 'ts_013', group: 'ts.pump', c: [9.48, 1.04, 12.4], h: [0.3, 0.02, 0.02], material: 'iron' },
      { id: 'ts_014', group: 'ts.pump', c: [9.97, 0.69, 12.4], h: [0.12, 0.03, 0.03], material: 'paintGreen' },
      { id: 'ts_015', group: 'ts.pump', c: [10.14, 0.23, 12.45], h: [0.13, 0.13, 0.13], material: 'plasticBlue' },
      { id: 'ts_016', group: 'ts.lamp', c: [11.2, 1.755, 11.7], h: [0.04, 1.755, 0.04], material: 'galv' },
      { id: 'ts_017', group: 'ts.lamp', c: [11.2, 3.485, 12], h: [0.025, 0.025, 0.26], material: 'galv' },
      { id: 'ts_018', group: 'ts.lamp', c: [11.2, 3.46, 12.3], h: [0.2, 0.05, 0.2], material: 'plasticBlack' },
      { id: 'ts_019', group: 'ts.lamp', c: [11.2, 3.4, 12.3], h: [0.12, 0.012, 0.12], material: 'plasticWhite', emissive: [40, 34, 22], flags: ['NoShadow'] },
      { id: 'ts_020', group: 'ts.beans', c: [10.9, 0.8, 7.62], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_021', group: 'ts.beans', c: [10.9, 0.8, 8.42], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_022', group: 'ts.beans', c: [10.9, 0.8, 9.22], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_023', group: 'ts.beans', c: [10.9, 0.8, 10.02], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_024', group: 'ts.beans', c: [10.9, 0.8, 10.82], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_025', group: 'ts.beans', c: [10.9, 0.8, 11.62], h: [0.02, 0.8, 0.02], material: 'poplar', flags: ['NoShadow'] },
      { id: 'ts_026', group: 'ts.beans', c: [10.9, 0.9, 9.62], h: [0.04, 0.5, 2.02], material: 'scrub', flags: ['NoShadow'] },
      { id: 'ts_027', group: 'ts.butt', c: [8.55, 0.425, 11.9], h: [0.234, 0.425, 0.234], material: 'drumBlue' },
      { id: 'ts_028', group: 'ts.butt', c: [8.55, 0.4235, 11.9], h: [0.234, 0.4235, 0.234], yaw: 0.7854, material: 'drumBlue' },
      { id: 'ts_029', group: 'ts.butt', c: [8.55, 0.853, 11.9], h: [0.15, 0.003, 0.15], material: 'plasticBlue', flags: ['NoShadow'] },
      { id: 'ts_030', group: 'ts.cart', c: [10.95, 0.53, 16], h: [0.45, 0.03, 0.85], material: 'woodGrey' },
      { id: 'ts_031', group: 'ts.cart', c: [10.43, 0.32, 16], h: [0.04, 0.32, 0.32], material: 'rubber' },
      { id: 'ts_032', group: 'ts.cart', c: [11.47, 0.32, 16], h: [0.04, 0.32, 0.32], material: 'rubber' },
      { id: 'ts_033', group: 'ts.cart', c: [10.62, 0.525, 17.275], h: [0.03, 0.025, 0.425], material: 'woodGrey' },
      { id: 'ts_034', group: 'ts.cart', c: [11.28, 0.525, 17.275], h: [0.03, 0.025, 0.425], material: 'woodGrey' },
      { id: 'ts_035', group: 'ts.cart', c: [10.95, 0.25, 17.63], h: [0.36, 0.25, 0.03], material: 'woodGrey' },
      { id: 'ts_036', group: 'ts.cart', c: [10.95, 0.85, 15.6], h: [0.29, 0.29, 0.4], material: 'drumBlue' },
      { id: 'ts_037', group: 'ts.cart', c: [10.95, 0.85, 16.44], h: [0.29, 0.29, 0.4], material: 'plasticBlue' },
      { id: 'ts_038', group: 'ts.cart', c: [10.95, 0.66, 15.17], h: [0.04, 0.04, 0.03], material: 'tin', flags: ['NoShadow'] },
    ] } },
  ways: [{ door: 'ts_gate', set: 'well', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;

  const P = (x: number, z: number): [number, number, number] => [x, 0, z];
  const LAMP = P(28.5, 13.3), POST = P(19.4, 9.4), DOOR = P(25.8, 14.6), GATE = P(30.4, 14.6);

  // ---- A, the garden inside the west gate: a wall shuts it off from the rest; the way on is round the wall's south end. No light of its own ----
  grp('yard.a');
  G.yardWallZ(15, 6, 18); G.pier(15, 18);
  // two dug beds, watered: the big one where the moon reaches (the walls' shadow takes z over 18.4 and x under 10.2), each planted in rows ACROSS
  G.patch(10.9, 9.6, 3.8, 5.0, 'damp'); G.patch(10.9, 17.0, 3.2, 3.4, 'damp');
  for (const z of [7.8, 8.7, 9.6, 10.5, 11.4]) G.patch(10.9, z, 3.2, 0.22, 'scrub', 0, 0.02);
  for (const z of [16.0, 16.7, 17.4, 18.1]) G.patch(10.9, z, 2.6, 0.22, 'scrub', 0, 0.02);
  G.bush(12.3, 12.5); G.bush(10.7, 12.8, 0.9); G.bush(13.9, 7.3, 1.1); G.bush(12.9, 17.9, 1.2); G.bush(12.0, 19.8, 0.9);   // (all off the line gate → the wall's end)
  G.charpoy(13.4, 9.4, HALF);
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);
  // outside the west wall, across the track's verge: the last lesson's white house and its dish (nobody walks there)
  grp('outside.west');
  G.wallX(9.8, 2.2, 6.0, 'render', [], 2.6); G.wallZ(2.2, 6.6, 9.8, 'render', [], 2.6); G.satDish(5.2, 9.0, 0, 2.2);

  // ---- B, the well: THE PUMP on the north wall under the court's one lamp; the first guard stands at it, his back to the dark south ----
  grp('yard.b');
  G.yardWallZ(23.5, 6, 18); G.pier(23.5, 18);
  T.lamp(20.9, 7.6, 'lamp_post');
  G.pump(19.5, 7.7); G.patch(19.3, 8.6, 3.6, 2.2, 'damp'); G.jerryCan(20.5, 8.3, 0.3, 'plasticBlue');
  { const b = G.piece(17.5, 7.4, 0);                                                                      // THE WELL HEAD: a mud ring, its rim, the black of the shaft, two posts and the windlass bar
    b(0, 0, 0, 0.8, 0.7, 0.7, G.M.mud); b(0, 0, 0, 0.79, 0.7, 0.7, G.M.mud, {}, 0.785); b(0, 0, 0.8, 0.86, 0.76, 0.76, G.M.mudLight); b(0, 0, 0.86, 0.87, 0.45, 0.45, G.M.rubber);
    b(-0.62, 0, 0, 1.9, 0.05, 0.05, G.M.woodGrey); b(0.62, 0, 0, 1.9, 0.05, 0.05, G.M.woodGrey); b(0, 0, 1.9, 2.0, 0.75, 0.05, G.M.woodGrey); }
  // the runnel: the well waters the garden. A thin wet line from the pump's apron down the court, round the wall's end and into the bed (the player's own way, drawn)
  G.patch(19.3, 14.2, 0.3, 9.3, 'damp', 0, 0.016); G.patch(15.9, 18.7, 7.1, 0.3, 'damp', 0, 0.016);
  G.rubble(19.0, 12.0, 0.3, 3); G.rubble(19.6, 16.6, 0.3, 3); G.rubble(17.4, 18.4, 0.3, 3);
  G.crates(17.0, 16.4, 0.1, 3, 'woodGrey');                                                               // (the partner's dark: a stack of old boxes ...)
  { const b = G.piece(20.6, 14.2, 0); b(0, 0, 0, 0.6, 1.2, 0.25, G.M.block); b(0, 0, 0.6, 0.61, 1.1, 0.17, G.M.damp); }   // ... and a stone trough the runnel fills

  // ---- C, the back gate: the watch house (its door south) with the radio and the red trunk; the watch's tea table and their one lantern outside it ----
  const HUT = T.hut({ x0: 24.6, z0: 7.0, x1: 28.6, z1: 10.6, doors: [{ name: 'hut', side: 's', at: 26.0 }] });
  grp('hut.room');
  G.rug(26.5, 9.3, 1.6, 1.2, 'felt'); G.trunk(27.95, 8.6, HALF, 'paintRust');
  G.table(25.65, 7.62, 1.5, 0.7); G.plasticChair(25.5, 8.5, 0);
  { const b = G.piece(25.35, 7.56, 0);                                                                    // the watch's radio: a set, its handset, its whip
    b(0, 0, 0.75, 1.0, 0.2, 0.13, G.M.olive); b(0.14, 0.05, 1.0, 1.55, 0.008, 0.008, G.M.iron); b(0.34, 0.08, 0.75, 0.79, 0.05, 0.1, G.M.plasticBlack); }
  G.lantern(26.2, 7.6, 'lantern_hut', 'hut', 0.75);
  grp('yard.c');
  G.lowTable(LAMP[0] + 0.3, LAMP[2], 0); G.lantern(LAMP[0], LAMP[2], 'lantern_door', 'exterior', 0.3);    // THE lantern, on the watch's tea table: both men of the closer stand at its pool's edge
  G.plasticChair(28.9, 12.45, Math.PI); G.rug(28.5, 13.5, 3.0, 2.0, 'mat', 0.06);   // the watch's mat under their tea table: the closer's stage
  // a broken length of old wall a pace behind the gate's man: the door's man sees HIM past its end, and nothing of the floor at his back (the partner's way in)
  G.yardWallZ(29.0, 14.95, 17.4); G.pier(29.0, 17.4); G.rubble(28.9, 18.3, 0.7, 7);
  G.woodPile(30.4, 21.0, 0, 1.4);
  G.dado('x', 10.6, 24.7, 26.3, 1, 'paintRust'); G.dado('x', 10.6, 27.2, 28.5, 1, 'paintRust');           // the watch house wears its trunk's colour either side of its door (the hut's `at` is the opening's LOW end: the fitted doorway is 26.3‥27.2)
  // outside the back gate, the way home: a pickup waiting nose-out beside the track, its ruts, a checkpoint's two stubs (nobody walks there; the track is clear)
  grp('outside.east');
  G.pickup(36.9, 10.2, Math.PI - 0.15, 'truckTan'); G.ruts(36.2, 12.0, 39.4, 13.3, 'damp'); G.hesco(33.75, 11.6, 1, 0); G.hesco(33.75, 16.4, 1, 0);

  // ---- three guards, each ON A POST: he stands at the first point looking at the second for the whole lesson (a stride out and back once an hour) ----
  // THE CLOSER'S TWO stand either side of the tea table's lantern, 4.6 m apart, both lit by it. THE DOOR'S MAN LOOKS EAST, straight at the gate's man's back:
  // a standing man's eyes sweep about 57 deg either way and his cone is 58 deg, so what is dead ahead of him is ALWAYS in his view: the gate's man put down
  // alone lies lit in front of him. THE GATE'S MAN LOOKS NORTH-EAST, out at the gate: the door's man is 135 deg round behind him, past anything his sweep reaches
  // (115 deg) -- with both looking north (the first build) his glance caught the grab at the door, lit, on two seeds in five, a second before the partner had him.
  // So the grab at the door is never seen, the partner's man never gets to turn, and the double on the mark ends clean on every seed.
  // (4.6 m, not 3: two calm men inside 4.5 m of each other turn face to face and chat -- dialogue.ts AMBIENT.pairM -- and a back that turns is no back to teach on)
  const routes = [
    // (a man spawned on a point at a nav cell's edge takes one step onto the cell and stands as that step turned him — x = n + 0.5 did it to the gate's man and
    //  to the pump's: print c.bodyYaw a second in before trusting a new point's facing)
    { name: 'post', points: [POST, P(POST[0], 8.2)], wait: [3600, 0] },             // looks north, at the pump
    { name: 'door', points: [DOOR, P(DOOR[0] + 1.4, DOOR[2])], wait: [3600, 0] },   // looks east: the lantern, and the back of the man at the gate
    { name: 'gate', points: [GATE, P(GATE[0] + 1.0, GATE[2] - 1.0)], wait: [3600, 0] },   // looks north-east, out at the back gate
  ];

  const front: [number, number, number] = [27.55, 1.0, 8.6];
  const quiet: QuietData = {
    thing: 'the radio codes',
    radioCheck: false,   // no radio check on this shift: a reader slower than the net's ninety seconds found the posts the lines name empty
    starts: [{ name: 'the track', sam: [5.2, 0, 14.0], samYaw: HALF, mate: [4.1, 0, 14.9] }],
    spots: [{ place: 'the watch house', area: { ...HUT }, door: 'hut', holder: 'the red trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT_E, EXIT_W],
    patrols: [['post', 'door', 'gate']],
  };
  // every step from the first order on has a way through for a player who did it another way: a man put down early, by his own hands or anybody's (`men
  // down N`), and — the partner lost (`mate` is false for ever with nobody on his feet, and no `pair` row comes), or the watch simply walked round — the
  // watch house reached (`stage drive`): the row is then the mission's own again
  const down = (n: number): LessonTest => ({ is: 'men', down: n }), alone: LessonTest = { is: 'stage', stage: 'drive' };
  const any = (...of: LessonTest[]): LessonTest => ({ is: 'any', of }), all = (...of: LessonTest[]): LessonTest => ({ is: 'all', of });
  const at1 = (p: number[]): [number, number, number] => [p[0], 1, p[2]];
  const lesson: LessonData = {
    title: 'Quiet, as two',
    steps: [
      { id: 'follow', line: 'Your partner will follow you. Lead him in through the gate',
        done: all({ is: 'in', area: { ...YARD_A } }, { is: 'mate', area: { ...YARD_A } }), hold: 0.3, at: [11.5, 1, 14] },
      { id: 'loud', line: 'X on the ground, then press 5 to have him go loud',
        done: { is: 'flag', flag: 'silent', value: false } },
      { id: 'silent', line: 'X on the ground, then press 5 again to go silent. He\'ll hold his fire',
        done: { is: 'flag', flag: 'silent' } },
      { id: 'round', line: 'Press C to crouch, and lead him around the end of the wall',
        done: { is: 'in', area: { ...ROUND_B } }, at: [16.6, 1, 20.2] },
      { id: 'send', line: 'X on dark ground ahead, then press 1 to have him wait there',
        done: any(all({ is: 'did', what: 'order:pairDark' }, { is: 'mate', area: { ...DARK_B }, away: 2.5 }), alone), hold: 0.5, at: [20.5, 1, 18.6] },
      { id: 'watch', line: 'X on the guard at the pump, then press 2 to have your partner watch him',
        done: any({ is: 'did', what: 'order:pairWatch' }, down(1), alone), at: at1(POST) },
      { id: 'mark', line: 'X on the guard, then press 1 to have your partner sneak up behind him',
        done: any({ is: 'did', what: 'order:pairMark' }, down(1), alone), at: at1(POST) },
      { id: 'set', line: 'Wait until he says "set"',
        done: any({ is: 'pair', what: 'set' }, { is: 'pair', what: 'go' }, down(1), alone), at: at1(POST) },
      { id: 'go', line: 'Press F and he\'ll take the guard down',
        done: any(all({ is: 'pair', what: 'go:F' }, { is: 'pair', what: 'down' }), down(1), alone), at: at1(POST) },
      { id: 'back', line: 'X on the ground, then press 3 to have him fall in behind you',
        done: any(all({ is: 'did', what: 'order:fallIn' }, { is: 'mate', by: 3 }), alone), hold: 0.3 },
      { id: 'hold', line: 'X on the ground, then press 4 to have him hold. Go on alone',
        done: any(all({ is: 'did', what: 'order:hold' }, { is: 'mate', away: 4 }), alone), at: [26.2, 1, 19.8] },
      { id: 'mark2', line: 'One guard is watching the other\'s back. X on the far one, then press 1',
        done: any({ is: 'did', what: 'order:pairMark' }, down(2), alone), at: at1(GATE) },
      { id: 'set2', line: 'Wait for "set" in the dark behind the near one',
        done: any({ is: 'pair', what: 'set' }, { is: 'pair', what: 'go' }, down(2), alone), at: [24.1, 1, 14.9] },
      // (the partner's man down is `men down 2`, not the pair's own 'down' row: a man who turns at the last pace is finished off under another row; a grab made
      //  BEFORE "set" was its own mark a step ago, so a man in his arm with two down is the same deed done early)
      { id: 'hands', line: 'Press Space behind him to grab him. Your partner will take the other one down',
        done: any(all({ is: 'pair', what: 'go:hands' }, down(2)), all({ is: 'flag', flag: 'holding' }, down(2)), down(3), alone), at: at1(DOOR) },
      { id: 'sleep', line: 'Right-click to choke him out, then keep still',
        done: any(down(3), alone) },
    ],
  };
  // the fuse box on the INSIDE of the east wall: the shell's default sits where the man sent to it walks out of the gate and round the wall
  T.breakerAt(31.84, 8.0, 'w');

  const out = T.finish({
    spawn: [5.2, 0, 14.0], routes,
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, lesson, kitView: SILENT_KITVIEW },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The well court and the yards either
// side of it: in the kitchen garden a pollarded mulberry, cold frames, bean canes, tools on the wall and the water butt; at the well THE WATER
// CART parked along the wall (this corner's signature, stood again by the pump outside lesson 6), clay jars drying on a mud bench, the
// washing slab; in the watch house the duty board, a map, capes on their pegs, crates and the radio's battery; at the back gate a
// sentry box, the search table and the boom laid up on the wall. The dark south of the well court, the floor at the gate man's back
// and every post's sight line are as they were; no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('garden');
  rd(13.9, 12.0, 0.14, 0, 1.45, 'woodGrey'); bx(13.74, 11.84, 14.06, 12.16, 1.45, 1.6, 'woodGrey', L.NS);       // the mulberry, pollarded: a short trunk, its knuckle, a small crown
  for (const [x0, z0, x1, z1, y0, y1] of [[13.5, 11.62, 14.3, 12.38, 1.6, 1.95], [13.34, 11.86, 13.74, 12.3, 1.5, 1.82], [14.06, 11.7, 14.48, 12.12, 1.52, 1.86], [13.72, 11.8, 14.1, 12.2, 1.95, 2.08]]) bx(x0, z0, x1, z1, y0, y1, 'scrub', L.NS);   // (drawn only, nothing over 2.1 m: it hides nobody under the camera and puts no new moon shadow on the bed)
  bx(8.3, 19.7, 9.5, 20.5, 0, 0.18, 'poplar'); bx(8.36, 19.76, 9.44, 20.44, 0.18, 0.186, 'scrub', L.NS);        // two cold frames
  bx(8.3, 20.7, 9.5, 21.5, 0, 0.18, 'poplar'); bx(8.36, 20.76, 9.44, 21.44, 0.18, 0.186, 'damp', L.NS);
  for (let i = 0; i < 6; i++) bx(9.58, 7.6 + i * 0.8, 9.62, 7.64 + i * 0.8, 0, 1.6, 'poplar', L.NS);            // bean canes (drawn only: the bed is walked)
  bx(9.56, 7.6, 9.64, 11.64, 0.4, 1.4, 'scrub', L.NS);
  for (const [a, m, w] of [[13.3, 'iron', 0.16], [13.52, 'iron', 0.22], [13.74, 'woodGrey', 0.3]] as const) { hung('x', 6, a, a + 0.04, 1, 0.1, 1.4, 'woodGrey', 0.03); hung('x', 6, a - w / 2 + 0.02, a + w / 2 + 0.02, 1, 0.02, 0.2, m, 0.03, 0.03); }   // spade, hoe, rake
  rd(8.55, 11.9, 0.26, 0, 0.85, 'drumBlue'); bx(8.4, 11.75, 8.7, 12.05, 0.85, 0.856, 'plasticBlue', L.NS);      // the water butt
  L.bucket(13.1, 10.9, 'galv', 'plasticBlue'); L.chest(8.9, 19.2, 0.2, 'poplar', 0.3, 0.1, 0.2, 'scrub');       // a watering can, a tray of seedlings

  L.place('well');
  L.waterCart(15.95, 11.6, 1);                                                                                  // THE WATER CART
  L.plank(21.9, 6.3, 23.3, 6.75, 0.3, 'mud', 'mud');                                                            // jars drying on the mud bench
  for (const x of [22.15, 22.6, 23.05]) rd(x, 6.52, 0.17, 0.3, 0.72, 'mudDark');
  rd(23.05, 7.6, 0.2, 0, 0.55, 'mud'); rd(23.05, 8.2, 0.2, 0, 0.55, 'mudDark');
  bx(21.5, 12.9, 22.7, 13.7, 0, 0.1, 'slab'); bx(21.6, 13.0, 21.9, 13.3, 0.1, 0.14, 'whitewash', L.NS); flat(21.3, 12.7, 22.9, 13.9, 'damp', 0.022);   // the washing slab
  L.bucket(22.3, 10.2, 'galv', 'plasticBlue'); L.pot(22.75, 10.35, 'mud');

  L.place('watchhouse');
  bx(27.5, 7.16, 28.4, 7.7, 0, 0.4, 'olive'); bx(27.6, 7.2, 28.3, 7.6, 0.4, 0.7, 'poplar');                     // ration crates
  bx(26.7, 7.2, 27.1, 7.5, 0, 0.28, 'plasticBlack'); bx(26.74, 7.24, 27.06, 7.3, 0.28, 0.3, 'jerryYellow', L.NS);   // the radio's battery
  hung('x', 7.0, 26.6, 27.9, 1, 1.2, 1.95, 'whitewash', 0.012);                                                 // the duty board
  for (let i = 0; i < 4; i++) hung('x', 7.0, 26.7, 27.8, 1, 1.35 + i * 0.14, 1.37 + i * 0.14, 'rubber', 0.006, 0.012);
  hung('z', 28.6, 9.3, 10.3, -1, 1.2, 1.9, 'paintCream', 0.012); hung('z', 28.6, 9.45, 10.0, -1, 1.4, 1.75, 'paintGreen', 0.006, 0.012);   // a map of the district
  hung('z', 24.6, 8.9, 9.3, 1, 0.9, 1.75, 'olive', 0.05); hung('z', 24.6, 9.45, 9.85, 1, 0.95, 1.75, 'coyote', 0.05);   // rain capes
  L.stool(24.95, 9.2);

  L.place('backgate');
  bx(30.95, 10.4, 31.8, 10.46, 0, 2.1, 'paintGreen'); bx(30.95, 11.24, 31.8, 11.3, 0, 2.1, 'paintGreen'); bx(31.74, 10.46, 31.8, 11.24, 0, 2.1, 'paintGreen');   // the sentry box
  bx(30.9, 10.35, 31.85, 11.35, 2.1, 2.18, 'tin'); bx(31.4, 10.5, 31.7, 11.2, 0.4, 0.45, 'woodGrey');
  for (const z of [17.2, 20.4]) bx(31.7, z, 31.86, z + 0.06, 0.85, 0.95, 'iron');                               // the boom, laid up on the wall
  L.row(31.72, 16.9, 'z', 8, 0.5, 0.1, 0, 0.95, 1.05, ['truckRed', 'whitewash']);
  L.table(29.3, 6.3, 30.5, 6.85, 0.75, 'ply');                                                                  // the search table and its book
  bx(29.5, 6.45, 29.85, 6.7, 0.75, 0.79, 'paintRust'); bx(30.1, 6.5, 30.2, 6.6, 0.75, 0.87, 'iron');
  hung('z', 32, 11.6, 12.4, -1, 1.3, 1.9, 'truckRed', 0.015); hung('z', 32, 11.75, 12.25, -1, 1.55, 1.65, 'whitewash', 0.006, 0.015);   // STOP
  L.bucket(30.75, 6.6, 'drumRed', 'sandbag'); L.stool(29.0, 7.2);

  L.place('beyond');
  L.loft(6.9, 8.4);                                                                                             // the white house's pigeons, past the west wall
  L.done();
}
