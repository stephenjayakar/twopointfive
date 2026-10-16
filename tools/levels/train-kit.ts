// TRAIN-KIT — Training 4, "Guns and the kit": THE RANGE. Three dust lanes from a sandbagged firing point to a T-wall backstop with ply targets, a grenade pit
// in the corner by the west gate, and behind the dividing wall (one door, under a lamp) the armourer's yard with its two men. The quiet tools first, each on the range:
// the pistol at the range lamp (the dark he makes is the dark he fights from), a reload, the weapon light on and off, the holster, smoke into the pit, G, the
// stun can and the frag NAMED and kept in the fist (they are loud), the rifle, its launcher, a ring at a target, the grenade loaded, Z. Then the loud ones, last
// and in rising order: the launcher's grenade onto the pit's far wall (which PUTS THE MEN ON THEIR GUARD, and now and then sends one to look: every bang and
// every rifle round is heard through the whole compound — guards.ts hearingCheck — so no loud tool can be spent before the fight), then in ONE step the burst
// that brings them and the two men through the lit door into the dark he made.
// Then the mission's own end: the range book out of the armourer's trunk and away by a gate. A quiet mission alone with a `scenarios.lesson` block.
//
//        x 8        12.6        17          22            27       32
//   z 6  ┌──────────┬───────────────────────╥─────────────────────┐
//        │  the pit │                tea ·  ║  · man 1's beat ·   │
//        │          │            (lamp) → door ← (lamp)           │
//        └──────────┘                       ║                     │
//  gate_w   start        lane ─ ─ ─ ─ ▮ ║b              (gate) → gate_e
//        │ table ▒ sandbags  lane ─ ─ ─ ─ ▮ ║a bench   ┌────────┐ │
//        │       ▒ the firing point  (lamp) ║c         │ trunk  │ │
//   z 22 └──────────────────────────────────╨k─────────┴────────┘
//
//   bun run tools/levels/export.ts train-kit [--check]      → levels/train-kit.json
//   bun run tools/qa/lesson-check.ts train-kit              the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-kit                the scripted player through every step to the debrief
//   page: ?levelFile=train-kit.json&quiet        (&nolesson: the same level as its mission alone)
import type { KitViewData, LessonData, QuietData } from '../../src/scene/scenarios';
import { trainGround, TRAIN_MATERIALS, EXIT_W, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';
import { livedTrain } from './lived-train';

export const NAME = 'train-kit';
export const NOTES = 'Training 4, guns and the kit: the range inside the west gate (three lanes, a backstop, a lamp to shoot, a grenade pit), two men behind a dividing wall with one lit door, the armourer\'s hut with the range book. Regenerate: bun run tools/levels/export.ts train-kit';
export const MATERIALS = TRAIN_MATERIALS;

/** the three lanes' middles */
const LANES = [15.6, 17.6, 19.6];
/** the firing point (behind the sandbags, under the range lamp), the lamp the first round goes into, the pit, the door the men come by */
export const FIRE: [number, number, number] = [12.2, 0, 17.6];
export const LAMP: [number, number, number] = [14.6, 4.2, 17.6];
export const PIT: [number, number, number] = [10.2, 0.1, 8.0];
/** high on the yard wall past the pit, 11 m from the firing point: a launcher grenade clears the pit's baskets and is armed when it gets there */
export const FAR: [number, number, number] = [10.2, 2.0, 6.2];
export const DOOR: [number, number, number] = [22.0, 1.0, 10.0];
export const TARGET: [number, number, number] = [20.2, 1.2, 17.6];
/** the floor behind the sandbags (the `auto` step's `in`) */
const POINT = { x0: 10.9, x1: 13.3, z0: 15.2, z1: 20.0 };
/** both men down: the honest later state of every step from the cans on (whatever he threw or fired early, the fight it brought is over) */
const BOTH = { is: 'men', down: 2 } as const;
/** the mission already on its way: he has reached the armourer's hut (the honest way past a step whose can is spent) */
const ON = { is: 'stage', stage: 'drive' } as const;

type Kit = ReturnType<typeof trainGround>['G'];
/** a ply target: one board from the floor up, facing west down its lane (a round leaves a real hole in it), on two feet */
function target(G: Kit, x: number, z: number) { const b = G.piece(x, z, 0); b(0, 0, 0, 1.65, 0.012, 0.25, G.M.ply); b(0.06, 0, 0, 0.06, 0.14, 0.04, G.M.woodGrey); }
/** a spare target leaning on the dividing wall's east face */
function spare(G: Kit, x: number, z: number) { const b = G.piece(x, z, 0); b(0, 0, 0, 1.5, 0.012, 0.22, G.M.ply); }

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set (train-ground-kitview.ts), the range as the picture's column can show
 *  it. The lesson starts INSIDE the west gate and the firing point is south of it, where the picture does not look (it shows the three metres behind the wall
 *  on the stack's side, which here is the grenade pit's baskets). So: this yard's west wall and gate as they stand, the man on the track outside, and behind
 *  the wall the range turned to lie along it — the sandbagged firing point a stride inside the gate, three short lanes, the ply targets before a T-wall, the
 *  range lamp over them. Paint by this level's own material names; the gate is the level's gate_w, record for record. */
const SHELL = yardGateShell('tk');
const KIT_KITVIEW: KitViewData = {
  sets: { range: { ...SHELL,
    lights: [{ id: 'tk_lamp', kind: 'spot', pos: [10.75, 3.08, 11.2], dir: [-0.25, -1, 0], color: [1, 0.86, 0.6], intensity: 70, range: 9, innerDeg: 34, outerDeg: 62, group: 'tk', enabled: true, volumetric: 0.2, radius: 0.1, mains: false, fixture: 'tk_lamp_fix' }],
    boxes: [...SHELL.boxes,
    {id: 'tk_bag_00', group: 'tk.point', c: [9.25, 0.1, 12.75], h: [0.62, 0.1, 0.25], material: 'sandbag'},
    {id: 'tk_bag_01', group: 'tk.point', c: [9.55, 0.3, 12.75], h: [0.62, 0.1, 0.24], material: 'sandbag'},
    {id: 'tk_bag_02', group: 'tk.point', c: [9.25, 0.5, 12.75], h: [0.59, 0.1, 0.23], material: 'sandbag'},
    {id: 'tk_bag_10', group: 'tk.point', c: [10.5, 0.1, 12.75], h: [0.62, 0.1, 0.25], material: 'sandbag'},
    {id: 'tk_bag_11', group: 'tk.point', c: [10.8, 0.3, 12.75], h: [0.62, 0.1, 0.24], material: 'sandbag'},
    {id: 'tk_bag_12', group: 'tk.point', c: [10.5, 0.5, 12.75], h: [0.59, 0.1, 0.23], material: 'sandbag'},
    {id: 'tk_pad', c: [9.9, 0.01, 13.35], h: [1.5, 0.004, 0.33], material: 'gravel', flags: ['NoShadow']},
    {id: 'tk_crate_a', group: 'tk.point', c: [12.05, 0.15, 13.1], h: [0.45, 0.15, 0.2], yaw: 0.2, material: 'olive'},
    {id: 'tk_crate_b', group: 'tk.point', c: [12.03, 0.45, 13.08], h: [0.45, 0.15, 0.2], yaw: 0.05, material: 'olive'},
    {id: 'tk_lane_0', c: [8.9, 0.01, 11.4], h: [0.36, 0.004, 1], material: 'dust', flags: ['NoShadow']},
    {id: 'tk_target_0', group: 'tk.targets', c: [8.9, 0.82, 10.3], h: [0.25, 0.82, 0.012], material: 'ply'},
    {id: 'tk_foot_0', group: 'tk.targets', c: [8.9, 0.03, 10.24], h: [0.04, 0.03, 0.14], material: 'woodGrey'},
    {id: 'tk_lane_1', c: [9.9, 0.01, 11.4], h: [0.36, 0.004, 1], material: 'dust', flags: ['NoShadow']},
    {id: 'tk_target_1', group: 'tk.targets', c: [9.9, 0.82, 10.3], h: [0.25, 0.82, 0.012], material: 'ply'},
    {id: 'tk_foot_1', group: 'tk.targets', c: [9.9, 0.03, 10.24], h: [0.04, 0.03, 0.14], material: 'woodGrey'},
    {id: 'tk_lane_2', c: [10.9, 0.01, 11.4], h: [0.36, 0.004, 1], material: 'dust', flags: ['NoShadow']},
    {id: 'tk_target_2', group: 'tk.targets', c: [10.9, 0.82, 10.3], h: [0.25, 0.82, 0.012], material: 'ply'},
    {id: 'tk_foot_2', group: 'tk.targets', c: [10.9, 0.03, 10.24], h: [0.04, 0.03, 0.14], material: 'woodGrey'},
    {id: 'tk_line_0', c: [9.4, 0.02, 11.4], h: [0.04, 0.004, 1], material: 'whitewash', flags: ['NoShadow']},
    {id: 'tk_line_1', c: [10.4, 0.02, 11.4], h: [0.04, 0.004, 1], material: 'whitewash', flags: ['NoShadow']},
    {id: 'tk_backstop', group: 'tk.targets', c: [10, 1, 9.5], h: [1.75, 1, 0.15], material: 'tWall'},
    {id: 'tk_pole', c: [11.75, 1.6, 11.2], h: [0.04, 1.6, 0.04], material: 'galv'},
    {id: 'tk_arm', c: [11.3, 3.2, 11.2], h: [0.45, 0.03, 0.03], material: 'galv'},
    {id: 'tk_lamp_box', c: [10.75, 3.17, 11.2], h: [0.2, 0.05, 0.2], material: 'plasticBlack'},
    {id: 'tk_lamp_fix', c: [10.75, 3.11, 11.2], h: [0.12, 0.01, 0.12], material: 'plasticWhite', emissive: [40, 34, 22], flags: ['NoShadow']},
  ] } },
  ways: [{ door: 'tk_gate', set: 'range', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  T.breakerAt(31.84, 8.0, 'w');   // on the east wall's inside face: the man sent to it stands at (31.3, 7.1), inside the yard (the shell's default sends him to a point north of the wall)

  // ---- the range: three dust lanes from the firing point to the backstop, a lamp down range, the grenade pit in the north-west corner ----
  grp('range.pit');
  G.hesco(10.4, 10.2, 4, 0); G.hesco(12.9, 8.0, 3, HALF);   // chest-high: the floor inside is under the cursor from the firing point, and a burst inside has no line out
  G.patch(10.3, 7.9, 3.6, 2.8, 'damp'); G.patch(10.0, 8.2, 2.2, 1.5, 'oil', 0.5, 0.019);   // the burnt floor of it: darker than the ground, a slick across it
  G.rubble(10.2, 8.4, 0.9, 6); G.motorbike(10.6, 7.0, 0.3, 'rust'); G.drumDown(9.2, 7.6, 0.5);   // a wreck to throw at, under the far wall
  grp('range.point');
  G.patch(12.2, 17.6, 2.2, 5.4, 'gravel');
  G.sandbags(13.6, 17.6, 5.0, HALF, 3);
  G.table(10.2, 19.8, 1.6, 0.75, HALF); G.crates(10.2, 21.2, 0.1, 3); G.crates(11.5, 21.3, -0.12, 2);   // the range table and the ammunition
  grp('range.lanes');
  for (const z of LANES) {
    G.patch(17.4, z, 6.6, 1.0, 'dust');
    target(G, 20.2, z); G.patch(20.2, z, 0.6, 0.6, 'whitewash', 0, 0.019);   // a painted square under each board: from above, three dots at the lanes' ends
  }
  G.patch(17.4, 12.4, 6.6, 1.0, 'damp');   // an old fourth lane, trodden dark: the floor between the lanes and the door is range too
  for (const x of [16.0, 18.4]) G.patch(x, 17.6, 0.12, 5.4, 'whitewash', 0, 0.019);   // the distance marks, painted across the three lanes
  T.lamp(LAMP[0], LAMP[2], 'lamp_range', { height: LAMP[1], outerDeg: 56 });   // the range's one lamp, tall, over the firing line: the firing point stands in its pool until he shoots it out
  G.drums(16.2, 7.0, 3); G.tyres(18.0, 6.9, 2);   // shot-up drums and tyres off old lanes, under the north wall
  grp('range.backstop');
  G.tWall(21.3, 17.4, 6, HALF);   // z 13.8..21.0 against the dividing wall: short of the door and its lamp
  G.skirt('x', 6, 13.6, 20, 1);
  // ---- the dividing wall: the east yard is the men's. One door in it. Their lamp stands square behind it (the door opens: a bar of light on the range's
  // floor); the range's side has a small lamp over the mat: whoever comes through is lit, and comes alone ----
  grp('wall.mid');
  G.yardWallZ(22.0, 6, 22, 'mud', [{ a: 9.4, b: 10.6, y0: 0, y1: 2.2 }]);
  T.doors.push({ name: 'yard_door', hinge: [22.0, 9.42], closedDir: HALF, width: 1.16 });
  G.dado('z', 22.0, 8.2, 9.38, -1, 'paintRust'); G.dado('z', 22.0, 10.62, 11.8, -1, 'paintRust');   // the door wears a colour on the face its lamp shows
  T.lamp(21.0, 9.5, 'lamp_door', { height: 3.0, outerDeg: 38 });   // a doormat of light (its pole stands 0.6 m north: off the men's way and off the line from the firing point)
  // ---- the armourer's yard: his hut against the south wall, his bench on the dividing wall, the tea by the door, the two beats ----
  const HUT = T.hut({ x0: 25.6, z0: 16.4, x1: 30.6, z1: 21.2, floor: 'slab', doors: [{ name: 'hut', side: 'n', at: 27.4 }] });
  G.skirt('z', 25.6, 16.3, 21.3, -1, 'olive', 1.1);   // the hut wears its trunk's colour on the face that shows
  grp('hut.room');
  G.trunk(30.0, 19.0, HALF, 'olive' as 'paintGreen');   // (the cast: the kit's Paint type lists four paints and olive is not one, but the trunk only reads G.M[paint] and the kit's table has `olive`)
  G.table(26.5, 20.5, 1.6, 0.75, 0); G.crates(26.3, 17.3, HALF, 3); G.crates(29.9, 17.1, 0.1, 2);
  G.lantern(26.5, 20.5, 'lantern_hut', 'hut', 0.75);
  grp('yard.east');
  G.table(24.4, 21.4, 1.5, 0.7, 0); G.lantern(24.9, 21.4, 'lantern_bench', 'yard', 0.75); G.plasticChair(23.3, 20.5, 0.6); spare(G, 22.4, 20.3); spare(G, 22.4, 20.9);   // the bench where he mends targets, and two waiting
  G.lowTable(29.6, 7.0, 0); G.crates(28.2, 6.9, 0.1, 2); G.lantern(30.5, 6.9, 'lantern_tea', 'yard', 0);   // the tea under the north wall
  G.crates(23.3, 7.0, 0.2, 2);
  G.lantern(31.3, 16.7, 'lantern_post', 'yard', 0);   // the armourer's lantern outside his hut (his chair is at the bench)
  T.lamp(24.4, 10.0, 'lamp_yard', { outerDeg: 68 });   // square behind the door and wide: the leaf opens and a bar of it falls west across the range's floor
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 22, 32, 1);
  // ---- the compound goes on outside the wall: lesson 3's generator up the track to the west, lesson 5's water tank to the east ----
  grp('outside');
  G.generator(4.2, 9.6, 0.2); G.waterTank(36.2, 9.6);
  // and the next yards' walls run off north and south from this one: NO WAY ROUND outside from gate to gate. The lesson's last step is two men by ONE lit door; with the
  // way round open, a man who saw his mate drop in that door walked the outside of the wall instead and held the west gate's post behind the firing point
  G.yardWallZ(20, 0, 5.88, 'mud'); G.yardWallZ(20, 22.12, 28, 'mud');

  // ---- two men, both beats east of x 24 (the door is seconds away from either: the fight starts when HE is ready, not the moment of the noise): one between
  // the tea under the north wall and a look at the east gate, the armourer between the lantern outside his hut and his bench in the corner. Every stand faces its thing ----
  const routes = [
    { name: 'north', points: [[29.4, 0, 12.0], [29.6, 0, 8.6], [28.6, 0, 11.0], [30.2, 0, 12.9]] as [number, number, number][], wait: [0, 4, 0, 4] },
    { name: 'hut', points: [[29.6, 0, 15.3], [24.2, 0, 15.6], [24.4, 0, 19.8], [24.2, 0, 15.6]] as [number, number, number][], wait: [6, 0, 4, 0] },
  ];

  const front: [number, number, number] = [29.6, 1.0, 19.0];
  const quiet: QuietData = {
    thing: 'the range book',
    starts: [{ name: 'the west gate', sam: [9.6, 0, 14.6], samYaw: HALF }],
    spots: [{ place: "the armourer's hut", area: { ...HUT }, door: 'hut', holder: 'the olive trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT_E, EXIT_W],
    patrols: [['north', 'hut']],
  };
  const lesson: LessonData = {
    title: 'Guns and the kit',
    steps: [
      { id: 'point', line: 'Go to the sandbags: your firing point', done: { is: 'near', at: FIRE, r: 1.6 }, at: FIRE },
      { id: 'draw', line: '1 draws the pistol', done: { is: 'slot', slot: 'pistol', drawn: true } },
      { id: 'fire', line: 'Left button fires at the cursor. Shoot out the lamp', done: { is: 'all', of: [{ is: 'target', name: 'lamp_range', on: false }, { is: 'any', of: [{ is: 'did', what: 'chron:lightShot' }, { is: 'did', what: 'chron:shot' }] }] }, at: LAMP },   // (shot out before the step came up: one more round at it lets him on. The OCP's spell alone does not: the lamp would come back)
      { id: 'reload', line: 'R reloads', done: { is: 'reload' } },
      { id: 'light', line: 'L is the weapon light. It shows you to them too', done: { is: 'flag', flag: 'light' } },
      { id: 'dark', line: 'L again: off. The dark you made is your cover', done: { is: 'flag', flag: 'light', value: false } },
      { id: 'holster', line: 'E puts it away', done: { is: 'flag', flag: 'holstered' } },
      { id: 'smoke', line: '3 is smoke. Left button throws it: into the pit', done: { is: 'any', of: [{ is: 'threw', kind: 'smoke' }, BOTH, ON] }, at: PIT },
      // the two loud cans are NAMED here, in the fist, and kept: thrown, either one brings the men (a bang is heard through the whole compound)
      { id: 'stun', line: '4 is the stun can: it blinds. Loud: not yet', done: { is: 'any', of: [{ is: 'slot', slot: 'flash' }, BOTH] } },
      { id: 'frag', line: '5 is the frag: it kills, you too. Not yet', done: { is: 'any', of: [{ is: 'slot', slot: 'frag' }, BOTH] } },
      { id: 'rifle', line: '2 brings the rifle round', done: { is: 'any', of: [{ is: 'slot', slot: 'rifle', drawn: true }, BOTH] } },
      { id: 'ring', line: 'Right button fires its launcher. A head hit knocks a man out', done: { is: 'any', of: [{ is: 'launcher', on: 'ring', fired: true }, { is: 'flag', flag: 'ringsOut' }, BOTH] }, at: TARGET },   // (the launcher is on the right button from the draw; no ring left: the honest way past)
      { id: 'grenade', line: '2 again flips the launcher to its grenade', done: { is: 'any', of: [{ is: 'launcher', on: 'he40' }, { is: 'flag', flag: 'shellsOut' }, BOTH] } },
      { id: 'auto', line: 'Stay behind the sandbags. Z sets the rifle to auto', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'in', area: POINT }, { is: 'flag', flag: 'auto' }] }, BOTH] }, at: FIRE },
      // the loud ones, last, in rising order. The first says what it does before he presses it. (A burst passes it too: out of grenades, the rifle is the noise.)
      { id: 'he40', line: 'Right button: the grenade, on the far wall. Loud: they hear it', done: { is: 'any', of: [{ is: 'threw', kind: 'he40' }, { is: 'burst', n: 3 }, BOTH] }, at: FAR },
      // ONE line for the burst and the fight: the grenade puts the two men on their guard where they stand, and it is his first rifle round that brings them through
      // the door, seven to eleven seconds behind it. As two steps ('a burst, at the lit door', then 'shoot both men') a player who took more than about six seconds
      // over the second line was shot reading it; now nothing is left to read once the rounds that call them are fired
      { id: 'men', line: 'Hold the left button: a burst at the lit door. It brings both men: shoot them', done: BOTH, at: DOOR },
      // nobody is left to hear: the two loud cans, thrown (from the firing point the pit is past a frag's reach, and its baskets stand between). A can already
      // spent: the mission's own next stage lets him by
      { id: 'stun-throw', line: '4, then Left button: the stun can, into the pit', done: { is: 'any', of: [{ is: 'threw', kind: 'flash' }, ON] }, at: PIT },
      { id: 'frag-throw', line: '5, then Left button: the frag, into the pit. Stay back', done: { is: 'any', of: [{ is: 'threw', kind: 'frag' }, ON] }, at: PIT },
    ],
  };
  const out = T.finish({
    spawn: [9.6, 0, 14.6], routes,
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, lesson, kitView: KIT_KITVIEW },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The range as it is run: THE RED FLAG up
// by the gate (this corner's signature, stood again by the T-walls outside lessons 3 and 5), firing mats and lane plates at the point,
// the clearing barrel and the chalked score board on the west wall, ammunition tins; a rack of falling plates facing the point, the marker's mantlet before it and a pile of shot
// boards under the south wall; in the armourer's yard a rack of rifles waiting to be cleaned, new target boards, the tea bench and the pile
// of empties; in his hut the ammunition shelves and the powder scale on its plinth. Everything in the firing point's area is drawn only, and nothing
// stands in a line of fire a step asks for (lamp, pit, the far lob, the target, the yard door); no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('point');
  for (const z of [15.6, 17.6, 19.6]) { flat(11.5, z - 0.38, 13.2, z + 0.38, 'olive', 0.03); flat(13.95, z - 0.2, 14.25, z + 0.2, 'whitewash', 0.03); }   // firing mats, lane plates
  L.flag(8.75, 11.6);                                                                                           // THE RED FLAG
  bx(8.3, 15.75, 9.0, 15.97, 0, 0.3, 'sandbag'); bx(8.3, 16.35, 9.0, 16.57, 0, 0.3, 'sandbag');                 // the clearing barrel
  rd(8.65, 16.16, 0.26, 0.1, 0.75, 'drumRed'); bx(8.5, 16.01, 8.8, 16.31, 0.75, 0.756, 'sandbag', L.NS);
  hung('z', 8, 17.0, 18.6, 1, 1.0, 1.9, 'iron', 0.02);                                                          // the score board
  hung('z', 8, 17.1, 18.5, 1, 1.74, 1.78, 'whitewash', 0.006, 0.02);
  for (let i = 0; i < 3; i++) hung('z', 8, 17.15, 17.55 + i * 0.3, 1, 1.52 - i * 0.18, 1.58 - i * 0.18, 'whitewash', 0.006, 0.02);
  bx(12.3, 21.25, 13.2, 21.7, 0, 0.26, 'olive'); bx(12.4, 21.3, 13.0, 21.68, 0.26, 0.46, 'olive'); bx(12.5, 21.286, 12.9, 21.3, 0.3, 0.4, 'stencil', L.NS);   // ammunition tins
  L.helmet(11.2, 20.7, 0.4); L.bucket(8.6, 20.3, 'olive', 'jerryYellow');                                       // a helmet left at the point, the bucket of brass

  L.place('butts');
  bx(19.27, 20.3, 19.33, 21.76, 0.24, 0.3, 'iron'); bx(19.07, 20.3, 19.53, 20.36, 0, 0.3, 'iron'); bx(19.07, 21.7, 19.53, 21.76, 0, 0.3, 'iron');   // falling plates on their rail: the rail runs north-south, the plates' faces west to the firing point
  L.row(19.285, 20.4, 'z', 4, 0.26, 0.03, 0.08, 0.3, 0.58, ['whitewash']);
  bx(18.3, 20.3, 18.56, 21.76, 0, 0.62, 'sandbag'); flat(18.6, 20.5, 19.0, 21.5, 'straw', 0.022);               // the marker's mantlet in front of them, and the mat he sits on behind it (south of the third lane: off every line a step asks for)
  bx(19.7, 21.3, 20.5, 21.74, 0, 0.1, 'ply'); bx(19.8, 21.36, 20.4, 21.7, 0.1, 0.18, 'poplar');                 // shot boards, stacked

  L.place('yard');
  bx(22.14, 16.6, 22.5, 16.66, 0, 1.2, 'woodGrey'); bx(22.14, 18.34, 22.5, 18.4, 0, 1.2, 'woodGrey');           // rifles waiting for the rod, racked on the wall
  bx(22.14, 16.66, 22.46, 18.34, 0.1, 0.16, 'woodGrey'); bx(22.14, 16.66, 22.2, 18.34, 0.95, 1.0, 'woodGrey');
  L.row(22.22, 16.8, 'z', 6, 0.07, 0.1, 0.19, 0.16, 1.22, ['iron', 'woodGrey', 'iron', 'iron', 'poplar', 'iron']);
  bx(22.2, 18.7, 23.0, 19.5, 0, 0.1, 'ply'); rd(22.9, 19.75, 0.09, 0, 0.18, 'tin');                             // new boards and the paste pot
  L.plank(26.2, 6.5, 27.6, 6.82, 0.42);                                                                         // the tea bench
  bx(30.95, 18.7, 31.8, 19.5, 0, 0.3, 'olive'); bx(30.95, 19.6, 31.8, 20.4, 0, 0.3, 'poplar'); bx(31.05, 19.0, 31.75, 19.9, 0.3, 0.6, 'olive'); bx(30.95, 20.5, 31.8, 21.6, 0, 0.28, 'poplar');   // the empties
  bx(30.936, 19.0, 30.95, 19.3, 0.1, 0.2, 'stencil', L.NS);
  L.stool(23.1, 17.5); L.toolRoll(22.6, 16.0, 0.3);                                                             // the cleaning roll

  L.place('armoury');
  flat(27.2, 18.0, 29.2, 19.6, 'canvas', 0.03);                                                                 // the ground sheet he strips a gun on
  L.rack(25.76, 18.1, 26.12, 19.8, 1.6, [0.35, 0.85, 1.35]);                                                    // ammunition, west wall
  L.row(25.8, 18.2, 'z', 4, 0.3, 0.26, 0.08, 0.35, 0.55, ['olive']); L.row(25.8, 18.2, 'z', 4, 0.3, 0.26, 0.08, 0.85, 1.05, ['olive', 'olive', 'coyote', 'olive']);
  bx(25.8, 18.25, 26.08, 18.9, 1.35, 1.5, 'ply'); L.row(25.82, 19.1, 'z', 4, 0.1, 0.2, 0.05, 1.35, 1.5, ['iron']);   // magazines up top
  bx(27.6, 20.5, 28.4, 21.04, 0, 0.3, 'block');                                                                 // a block plinth with the powder scale on it (no chest here but the olive trunk: that is the one a step names)
  bx(27.7, 20.6, 28.3, 20.95, 0.3, 0.33, 'tin'); rd(28.0, 20.78, 0.12, 0.33, 0.36, 'tin', L.NS);
  hung('z', 30.6, 19.8, 20.8, -1, 1.0, 1.7, 'coyote', 0.04);                                                    // webbing on the pegs
  L.stool(27.6, 19.3); L.chest(29.7, 20.4, 0.2, 'poplar', 0.2, 0.1, 0.14, 'woodGrey');

  L.place('beyond');
  L.spools(5.2, 7.4);                                                                                           // the generator yard's cable, past the west wall
  L.basins(36.2, 11.9);                                                                                         // the quarters' wash bench, past the east wall
  L.done();
}
