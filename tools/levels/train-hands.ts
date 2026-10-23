// TRAIN-HANDS — Training 2, "Hands": THE KITCHEN COURT, where the garrison eats. What the player's hands do to a man, each done once, and ONE idea under all of
// it: make him come to me, and take him where I chose. The pistol out and away again, the low whistle through the kitchen hatch that brings the cook round to it
// (V) while the player waits in the wood store beside it, the grab from behind, a question put to the man held, the choke, his body dragged into the wood store, the knockout with the right button on the baker at
// the tandoor — then the last man, who WATCHES the one gap in the wall and cannot be walked up behind: back to the wall in the dark corner beside the gap (Q), a whistle, and the
// knife as he comes through. Then the key in the store's door, the ration book out of the blue trunk, and away by a gate. A quiet mission (game/quiet.ts) alone,
// with a `scenarios.lesson` block (game/lesson.ts). Three men, each minding something warm: that is why their backs are turned and their eyes are spoiled.
//
//        x 8   10      13.6      18          24          28      32
//   z 6  ┌──────────────╥───────────────────────────────────────────────┐
//        │ the wood store║                             ┌──the store───┐  │   outside the west wall: the motor pool's white pickup (lesson 1)
//        │  (hide here)  ║      swept mud floor     door│ sacks  trunk │  │   outside the east wall: the generator yard's yellow set (lesson 3)
//        │   ════════╗  door                            └──────────────┘  │
//        │         hatch ║ A→ table, stove (the pole lamp)               │      A: the cook, under the one lamp, behind a wall with a hatch in it;
//  gate_w   ↑ he comes   ║                                               gate_e    whistled at, he walks out of the kitchen's open side, through
//        │  ↑  ══════════╩═════════ wall ══════════╗                     │         the gap and back up past the gate to the hatch
//        │  wash    B→ (tandoor, its glow)  wood   ║   lantern           │      B: the baker, his face to the tandoor's glow
//        │  line                                  gap  ←C     charpoy    │      C: the watchman, his eyes on the gap: the man you bring to you
//        │  pump                                   ║                     │
//   z 22 └─────────────────────────────────────────╨─────────────────────┘
//
//   bun run tools/levels/export.ts train-hands [--check]     → levels/train-hands.json
//   bun run tools/qa/lesson-check.ts train-hands             the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-hands               the scripted player through every step to the debrief
//   page: ?levelFile=train-hands.json&quiet       (&nolesson: the same level as its mission alone)
import type { KitViewData, LessonData, QuietData, Rect } from '../../src/scene/scenarios';
import { BoxFlag } from '../../src/scene/boxes';
import { trainGround, TRAIN_MATERIALS, EXIT_W, EXIT_E, HALF } from './train-ground';
import { yardGateShell } from './train-ground-kitview';
import { livedTrain } from './lived-train';

export const NAME = 'train-hands';
export const NOTES = 'Training 2, hands: the kitchen court. A cook at his table behind a wall with a hatch, a baker at the tandoor, a watchman on the one gap; the cook\'s store with the ration book. Regenerate: bun run tools/levels/export.ts train-hands';
export const MATERIALS = TRAIN_MATERIALS;

/** the wood store: the passage north of the cross wall, out of the yard's way — where the first man's body is to be left */
const DARK: Rect = { x0: 10.2, x1: 13.4, z0: 6.2, z1: 9.4 };
/** where the player waits in it for the cook to come and look: three strides from the hatch through the store's doorway, behind its wall */
const HIDE: [number, number, number] = [11.6, 0, 8.5];
/** the gap in the wall that parts the south yard (x 24): its middle, and where the hatch in the cook's wall is stood at */
const GAP: [number, number, number] = [24.0, 0, 18.4], HATCH: [number, number, number] = [12.9, 0, 11.1];
/** the corner to wait for the last man in: south of the gap on the player's side, between its jamb and the wing wall — out of the moon (the wing wall's shadow)
 *  and out of what he sees through the gap from his post (the jamb) */
const NOOK: [number, number, number] = [23.45, 0, 19.4];

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set (train-ground-kitview.ts). The west gate has under 2 m of floor
 *  behind it (the mid wall's post) and the motor pool's pickup parked where the file forms; the east gate shows a bare strip. So: this yard's west wall and
 *  gate as they stand, the man on the track outside, and behind the wall the kitchen court's own thing — the tandoor on its plinth with its ember lit, the soot
 *  up the wall, split wood and flour sacks beside it (built here to the measure of the level's own tandoor). Paint by this level's own material names. */
const SHELL = yardGateShell('th');
const HANDS_KITVIEW: KitViewData = {
  sets: { court: { ...SHELL,
    lights: [{ id: 'th_glow', kind: 'point', pos: [9.15, 0.82, 11.5], dir: [0, -1, 0], color: [1, 0.45, 0.16], intensity: 5, range: 3.4, innerDeg: 0, outerDeg: 180, group: 'th', enabled: true, volumetric: 0.3, radius: 0.12, mains: false, fixture: 'th_ember' }],
    boxes: [...SHELL.boxes,
    {id: 'th_floor', c: [9.9, 0.004, 11.2], h: [1.75, 0.004, 2.2], material: 'mudFloor', flags: ['NoShadow']},
    {id: 'th_plinth', group: 'th.tandoor', c: [9.15, 0.07, 11.5], h: [0.7, 0.07, 0.95], material: 'mud'},
    {id: 'th_oven_0', group: 'th.tandoor', c: [9.15, 0.28, 11.5], h: [0.43, 0.28, 0.18], material: 'mudDark'},
    {id: 'th_oven_1', group: 'th.tandoor', c: [9.15, 0.27, 11.5], h: [0.43, 0.27, 0.18], yaw: 0.7854, material: 'mudDark'},
    {id: 'th_oven_2', group: 'th.tandoor', c: [9.15, 0.27, 11.5], h: [0.43, 0.27, 0.18], yaw: 1.5708, material: 'mudDark'},
    {id: 'th_oven_3', group: 'th.tandoor', c: [9.15, 0.27, 11.5], h: [0.43, 0.27, 0.18], yaw: 2.3562, material: 'mudDark'},
    {id: 'th_ember', group: 'th.tandoor', c: [9.15, 0.56, 11.5], h: [0.2, 0.01, 0.2], albedo: [0.05, 0.02, 0.01], emissive: [10, 3.4, 0.5], flags: ['NoShadow']},
    {id: 'th_soot', group: 'th.tandoor', c: [8.126, 1.15, 11.5], h: [0.003, 1.15, 1.0], material: 'damp', flags: ['NoShadow']},
    {id: 'th_ash', group: 'th.tandoor', c: [9.25, 0.012, 11.5], h: [0.75, 0.004, 0.7], yaw: 0.4, material: 'damp', flags: ['NoShadow']},
    {id: 'th_wood_0', group: 'th.wood', c: [8.75, 0.07, 9.7], h: [0.65, 0.07, 0.3], yaw: 1.5708, material: 'woodGrey'},
    {id: 'th_wood_1', group: 'th.wood', c: [8.73, 0.21, 9.7], h: [0.65, 0.07, 0.23], yaw: 1.5708, material: 'woodGrey'},
    {id: 'th_wood_2', group: 'th.wood', c: [8.79, 0.35, 9.7], h: [0.65, 0.07, 0.16], yaw: 1.5708, material: 'woodGrey'},
    {id: 'th_sack_0', group: 'th.tandoor', c: [9.2, 0.1, 12.95], h: [0.38, 0.1, 0.23], yaw: 0.09, material: 'sack'},
    {id: 'th_sack_1', group: 'th.tandoor', c: [10.0, 0.1, 12.9], h: [0.38, 0.1, 0.23], yaw: 0.09, material: 'sack'},
    {id: 'th_sack_2', group: 'th.tandoor', c: [9.6, 0.3, 12.93], h: [0.38, 0.1, 0.23], yaw: 1.63, material: 'sack'},
  ] } },
  ways: [{ door: 'th_gate', set: 'court', side: -1, pane: false }] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  T.breakerAt(31.84, 8.0, 'w');   // on the east wall's inside face, north-east corner: the man sent to it has floor to stand on (the shell's default faces south off the north wall, and the errand's mark is then outside the yard)

  // ---- the west yard inside the gate, dark: the cook's bay wall with its hatch, the wood store beside it to wait in ----
  grp('yard.west');
  G.yardWallZ(13.6, 6.12, 14.8, 'mud', [{ a: 10.3, b: 11.9, y0: 1.35, y1: 2.1 }]);   // the cook's bay is east of this wall, shut to the west from the outer wall down: the kitchen hatch to whistle through. His only way to it is out of the kitchen's open side, through the gap, and back up past the gate
  G.dado('z', 13.6, 10.0, 12.2, -1, 'paintBlue');   // the hatch's surround, painted: what marks it in a dark wall (a lantern on its sill lit the man standing at it — the cook turned to the whistle and saw him)
  G.yardWallX(9.6, 10.0, 12.3); G.pier(10.0, 9.6); G.pier(12.3, 9.6);   // the wood store behind this wall, its doorway hard by the hatch (x 12.3..13.6): the player's side of the yard, off the way the cook comes
  G.woodPile(11.3, 6.75, 0, 1.8); G.woodPile(9.3, 6.8, 0, 1.0);
  { const b = G.piece(12.9, 7.0, 0.3); b(0, 0, 0, 0.38, 0.2, 0.2, G.M.woodGrey); }   // the chopping block
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);
  // the wash place, out where the moon shows it: a slab, two drums cut low for tubs, the water cans, the wet round them; the line of washing down the wall
  // (all under 0.9 m and south of the way along the middle wall: nobody's line of sight or walk meets it)
  G.washLine(8.75, 16.9, 8.75, 21.3, 5);
  G.ground(10.5, 16.5, 12.7, 18.3, 'slab'); G.patch(11.6, 17.5, 1.8, 1.2, 'damp', 0.2);
  for (const [x, z] of [[11.1, 17.5], [11.95, 17.75]]) { const b = G.piece(x, z, 0); b(0, 0, 0, 0.45, 0.27, 0.27, G.M.drumBlue); b(0, 0, 0, 0.45, 0.27, 0.27, G.M.drumBlue, {}, 0.785); b(0, 0, 0.45, 0.455, 0.22, 0.22, G.M.tin); }
  G.jerryCan(12.3, 17.0, 0.3, 'jerryYellow'); G.jerryCan(12.45, 17.45, -0.2, 'jerryYellow');

  // ---- the kitchen (the north bay): a swept mud floor, the one pole lamp, the cook at his table under it facing east ----
  grp('bay.north');
  G.ground(13.72, 6.12, 22.88, 14.68, 'mudFloor');
  T.lamp(18.0, 11.2, 'lamp_bay');
  G.table(17.5, 11.5, 1.6, 0.75, HALF);
  { const b = G.piece(17.5, 11.5, HALF);   // on the table: a two-ring stove with a pot on it, a board
    b(-0.38, 0, 0.75, 0.82, 0.27, 0.2, G.M.iron); b(-0.5, 0, 0.82, 1.0, 0.11, 0.11, G.M.tin); b(0.42, 0, 0.75, 0.77, 0.24, 0.17, G.M.poplar); }
  G.gasBottle(17.45, 14.15); G.jerryCan(18.3, 14.3, 0.4, 'genYellow');
  G.sacks(20.9, 7.3, 0.2, 3); G.sacks(21.9, 7.2, 1.2, 2); G.lowTable(17.4, 7.0, 0, true);
  G.handcart(19.0, 7.5, HALF, 'produce');   // the day's vegetables, by the flour
  // colour under the cook's lamp: a mat, and on it three trays of produce (walk-overs)
  G.rug(19.9, 11.3, 1.8, 1.2, 'mat', 0.05);
  { const b = G.piece(19.9, 11.3, 0.05); b(-0.56, 0, 0, 0.16, 0.25, 0.175, G.M.prodRed); b(0, 0, 0, 0.16, 0.25, 0.175, G.M.prodGreen); b(0.56, 0, 0, 0.16, 0.25, 0.175, G.M.prodOrange); }
  // ---- the wall across the yard's middle, and the one that parts the south yard in two (a gap to walk through) ----
  grp('walls.mid');
  G.yardWallX(14.8, 10.4, 24); G.pier(10.4, 14.8);
  G.yardWallZ(24, 14.8, 22, 'mud', [{ a: 17.8, b: 19.0, y0: 0, y1: 2.2 }]); G.pier(24, 14.8);
  // THE WING WALL, west from the gap's south side: the moon stands in the south-west, so the wall the player's back was on (the gap wall's west face) was in
  // full moonlight: 57 % on his meter on the page, and the last man saw him the moment he was through (a player's tape, 10-13; the CPU's meter leaves the moon
  // out and read 0 there). North of this wall is its shadow: the corner between it and the gap's south jamb, the gap's mouth, and the way across to them
  G.yardWallX(19.9, 19.6, 23.88); G.pier(19.6, 19.9);
  G.dado('z', 24, 19.02, 19.78, -1, 'paintBlue'); G.dado('x', 19.9, 22.7, 23.88, -1, 'paintBlue');   // the corner to wait in, painted
  // ---- THE TANDOOR against the middle wall: the bread oven on its mud step, its fire the only light this side; the wood for it, the flour ----
  grp('tandoor');
  const OVEN: [number, number] = [20.2, 15.6];
  G.ground(16.4, 14.94, 21.46, 17.5, 'mudFloor');   // the swept floor of the oven corner
  { const b = G.piece(OVEN[0], OVEN[1], 0); b(0, 0.05, 0, 0.14, 0.95, 0.62, G.M.mud); }   // the step it stands on (a walk-over)
  G.tandoor(OVEN[0], OVEN[1]);
  G.skirt('x', 14.8, 19.2, 21.2, 1, 'damp', 2.3); G.patch(19.4, 16.3, 1.6, 1.0, 'damp', 0.3);   // soot up the wall behind it, ash on the floor before it (drawn only)
  { const fb = T.add({ c: [OVEN[0], 0.562, OVEN[1]], h: [0.2, 0.01, 0.2], albedo: [0.05, 0.02, 0.01], emissive: [10, 3.4, 0.5], flags: BoxFlag.NoShadow });   // the coals in its mouth
    T.lights.push({ kind: 'point', pos: [OVEN[0], 0.82, OVEN[1]], dir: [0, -1, 0], color: [1.0, 0.45, 0.16], intensity: 3.6, range: 2.7, innerDeg: 0, outerDeg: 180, name: 'ember', group: 'exterior', enabled: true, volumetric: 0.3, fixtureBox: fb, radius: 0.12, mains: false }); }
  G.yardWallZ(21.6, 14.8, 17.4); G.pier(21.6, 17.4);   // the oven's east wall: it keeps the wind off the fire — and the fire's light, and what lies in it, out of the watchman's sight through the gap
  G.woodPile(22.6, 15.3, 0, 1.4); G.sacks(17.6, 17.1, 0.1, 2);
  // ---- the watchman's end (south-east): his bed, his tea, his lantern ----
  grp('bay.south');
  G.charpoy(29.9, 20.6, 0); G.lowTable(26.6, 16.6, HALF, true); G.lantern(27.3, 16.5, 'lantern_east', 'exterior', 0);

  // ---- the cook's store against the north wall: its door on the west, the trunk at the far end ----
  const HUT = T.hut({ x0: 23, z0: 7.2, x1: 28, z1: 12, doors: [{ name: 'hut', side: 'w', at: 9.0, extra: { locked: true, lock: 'hut', keySide: 1 } }] });   // locked from the yard: its key is on the cook's belt
  G.dado('z', 23, 7.3, 8.98, -1, 'paintBlue'); G.dado('z', 23, 10.22, 11.9, -1, 'paintBlue');   // the store wears its trunk's colour either side of its door
  grp('hut.room');
  G.trunk(27.4, 9.6, HALF, 'paintBlue'); G.sacks(25.0, 7.85, 0, 3); G.sacks(26.3, 7.8, 0.1, 2); G.crates(26.4, 11.5, 0, 2, 'poplar');
  G.lantern(24.3, 11.0, 'lantern_hut', 'hut', 0);   // by the door: when it opens, the store's light falls out west across the dark kitchen

  // ---- continuity, outside the walls (nobody walks there): the motor pool's technical to the west, the generator yard's set to the east ----
  grp('outside');
  G.pickup(3.9, 10.2, 0.12, 'truckWhite', { mount: true });
  G.generator(35.9, 10.2, 0.2); G.patch(36.4, 10.9, 1.6, 1.2, 'oil', 0.5);

  // ---- three men. The cook and the baker each walk two strides east from their first mark and stand there for the night, their backs to the west and their
  //      faces to their work; the watchman walks two strides WEST and stands facing the gap ----
  const post = (name: string, x: number, z: number, dx = 1.8) => ({ name, points: [[x - dx, 0, z], [x, 0, z]] as [number, number, number][], wait: [0, 3600] });
  const routes: { name: string; points: [number, number, number][]; wait: number[]; keys?: string[] }[] = [post('north', 16.2, 11.2), post('south', OVEN[0] - 1.4, OVEN[1]), post('east', 27.4, 18.4, -1.8)];
  // the cook keeps the store: its door is the last mark of his round (he stands the night out before he gets to it) and its key is on his belt —
  // what a question put to him gives up (game/dialogue.ts: a keyed door within 2.5 m of his route's line, its lock in his keys)
  routes[0].points.push([21.4, 0, 9.6]); routes[0].wait.push(0); routes[0].keys = ['hut'];

  const front: [number, number, number] = [27.0, 1.0, 9.6];
  const quiet: QuietData = {
    thing: 'the ration book',
    radioCheck: false,   // no radio check on this shift: a reader slower than the net's ninety seconds found the posts the lines name empty
    starts: [{ name: 'the track', sam: [5.2, 0, 14.0], samYaw: HALF }],
    spots: [{ place: 'the cook\'s store', area: { ...HUT }, door: 'hut', holder: 'the blue trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT_E, EXIT_W],
    patrols: [['north', 'south', 'east']],
  };
  const down = (n: number) => ({ is: 'men', down: n });
  const lesson: LessonData = {
    title: 'Hands',
    steps: [
      // (a step whose deed can be made impossible — the man shot before he is grabbed, choked before he gives his key, knifed where the blow was asked —
      //  also passes on the men being down all the same, so the lesson always reaches its end)
      { id: 'draw', line: 'Press 1 to draw the pistol', done: { is: 'flag', flag: 'gun' } },
      { id: 'holster', line: 'Press E to put the pistol away. You need empty hands to grab someone', done: { is: 'flag', flag: 'holstered' } },
      // the whistle is tied to the PLACE, not the stance: run headless, a crouched whistle at the hatch brings the cook as surely as a standing one (the yard
      // wall is open to the sky: it carries over the top), but one blown back at the gate reaches nobody. A man who whistled and took him early passes all three
      { id: 'window', line: 'Go in quietly. Stop at the hatch in the wall', done: { is: 'any', of: [{ is: 'near', at: HATCH, r: 1.0 }, down(1)] }, hold: 0.3, at: [13.0, 1, 11.0] },
      { id: 'whistle', line: 'Press V to whistle the cook out, then hide at the mark right away', ringLine: 'Hold Space and press 5 to whistle the cook out, then hide at the mark right away', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'did', what: 'event:whistle' }, { is: 'near', at: HATCH, r: 1.3 }] }, { is: 'did', what: 'chron:grab' }, { is: 'flag', flag: 'holding' }, down(1)] }, at: [13.0, 1, 11.0] },
      { id: 'clear', line: 'Hide at the mark now. The cook is coming around through the gate', done: { is: 'any', of: [{ is: 'in', area: { x0: 10.2, x1: 12.3, z0: 6.2, z1: 9.3 } }, { is: 'did', what: 'chron:grab' }, { is: 'flag', flag: 'holding' }, down(1)] }, at: [HIDE[0], 1, HIDE[2]] },
      // (no line before it is true: 'he gives up' came up the moment the player hid, twenty seconds before the cook had — a player trusted it, went, and was shot.
      //  The wait is its own step, done when the cook is calm again; a man who took him early passes both)
      { id: 'wait', line: 'Stay still. The cook will come to the hatch and take a look', done: { is: 'any', of: [{ is: 'calm', route: 'north' }, { is: 'did', what: 'chron:grab' }, { is: 'flag', flag: 'holding' }, down(1)] }, at: [HIDE[0], 1, HIDE[2]] },
      { id: 'grab', line: 'The cook gave up looking. Go around behind him and press Space to grab him', done: { is: 'any', of: [{ is: 'did', what: 'chron:grab' }, { is: 'flag', flag: 'holding' }, down(1)] }, at: [12.4, 1, 11.6] },
      { id: 'question', line: 'Press Space to question him. Keep asking until he gives up his key', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'did', what: 'chron:interrogated' }, { is: 'did', what: 'chron:keyTaken' }] }, down(1)] } },
      // (the deed, not the way to it: with a man in the arm the right button chokes — close.ts CLOSE.heldClicks, on in the page — and the row's way still does)
      { id: 'choke', line: 'Right-click to choke him out, then stay still', done: { is: 'any', of: [{ is: 'downed', how: 'choke' }, down(1)] } },
      // (drag, hide: the body may already lie in the wood store — carried there by whatever the drag is tonight — and both steps then pass)
      { id: 'drag', line: 'Press Space at the body to grab it', done: { is: 'any', of: [{ is: 'flag', flag: 'dragging' }, { is: 'body', area: { ...DARK } }] } },
      { id: 'hide', line: 'Drag the body into the woodshed, out of sight, and press Space to let go', done: { is: 'body', area: { ...DARK } }, at: [11.8, 1, 8.0] },
      { id: 'knockout', line: 'Sneak up behind the guard at the tandoor and right-click to knock him out', done: down(2), at: [OVEN[0] - 2.0, 1, OVEN[1]] },
      // the last man faces the only way in: he is brought through it. The wall hold is a wall of the dark corner (the marker stands in it)
      { id: 'wall', line: 'The last guard is watching the gap. Put your back to the wall in the dark corner beside it', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'flag', flag: 'wall' }, { is: 'near', at: NOOK, r: 1.0 }] }, down(3)] }, at: [NOOK[0], 1, NOOK[2]] },
      { id: 'lure', line: 'Press V to whistle the guard over. Stay still and let him come through', ringLine: 'Hold Space and press 5 to whistle the guard over. Stay still and let him come through', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'did', what: 'event:whistle' }, { is: 'near', at: GAP, r: 2.6 }] }, down(3)] } },
      { id: 'knife', line: 'When the guard comes through, step in and left-click to kill him with the knife', done: down(3) },
      { id: 'unlock', line: 'The storeroom is locked. Press Space at its door to unlock it', done: { is: 'any', of: [{ is: 'did', what: 'act:unlock' }, { is: 'door', door: 'hut', state: 'open' }] }, at: [23.0, 1, 9.6] },
      { id: 'take', line: 'Tap Space at the blue trunk, then stay still', done: { is: 'stage', stage: 'exfil' }, at: front },
    ],
  };
  const out = T.finish({
    spawn: [5.2, 0, 14.0], routes,
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    scenarios: { quiet, lesson, kitView: HANDS_KITVIEW },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The kitchen court as a place that feeds
// a garrison: THE CAULDRONS on their hearth in the bay (this corner's signature, stood again outside the walls of lessons 1 and 3), a
// pot rail and a serving bench with the samovar; the mess table and its benches under the south wall; a drying rack by the wash place;
// ghee tins, tea chests, jars and chillies in the cook's store; the watchman's brazier, his dog's kennel and the kitchen garden.
// Nothing solid stands in the wood store's dark, at the hatch, in the gap, or on any walk a lesson's line leans on; no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('kitchen');
  L.cauldrons(14.14, 7.75, 1, 3);                                                                               // THE CAULDRONS, west wall of the bay
  hung('z', 13.6, 6.7, 8.8, 1, 0.4, 1.7, 'mudDark', 0.01);                                                      // soot up the wall
  flat(14.52, 6.8, 15.0, 8.7, 'blanketGrey', 0.022);                                                            // raked ash
  bx(15.0, 6.2, 15.05, 6.25, 0, 1.9, 'woodGrey'); bx(16.5, 6.2, 16.55, 6.25, 0, 1.9, 'woodGrey');               // the pot rail
  bx(15.05, 6.21, 16.5, 6.24, 1.87, 1.9, 'iron', L.NS);
  L.row(15.15, 6.2, 'x', 5, 0.2, 0.05, 0.07, 1.45, 1.86, ['tin', 'iron', 'tin', 'rust', 'tin'], L.NS);
  L.table(19.4, 14.06, 21.4, 14.62, 0.8, 'poplar');                                                             // the serving bench
  rd(19.75, 14.34, 0.13, 0.8, 1.22, 'tin'); bx(19.72, 14.31, 19.78, 14.37, 1.22, 1.34, 'tin');                   // the samovar
  rd(20.3, 14.3, 0.12, 0.8, 0.9, 'whitewash');                                                                  // plates
  bx(20.55, 14.4, 21.3, 14.58, 0.8, 0.82, 'tin'); L.row(20.6, 14.2, 'x', 5, 0.08, 0.08, 0.05, 0.8, 0.88, ['whitewash', 'paintBlue']);
  L.stool(15.2, 8.0); L.pot(15.0, 9.7);

  L.place('mess');
  flat(12.9, 20.1, 18.5, 21.86, 'mudFloor', 0.022);
  L.table(13.3, 20.72, 18.1, 21.38, 0.74, 'woodGrey');                                                          // the long table
  L.plank(13.4, 20.28, 18.0, 20.54, 0.42); L.plank(13.4, 21.56, 18.0, 21.82, 0.42);                              // its benches
  for (let i = 0; i < 5; i++) bx(13.7 + i * 0.95, 20.8, 13.92 + i * 0.95, 21.02, 0.74, 0.76, 'tin');             // five places laid
  bx(15.4, 20.95, 16.1, 21.3, 0.74, 0.78, 'poplar'); bx(15.45, 21.0, 16.05, 21.25, 0.78, 0.84, 'straw');         // the bread board
  rd(14.6, 21.2, 0.08, 0.74, 0.98, 'tin'); rd(17.2, 21.2, 0.08, 0.74, 0.98, 'tin');                             // water jugs
  L.row(16.4, 21.15, 'x', 4, 0.07, 0.07, 0.08, 0.74, 0.83, ['whitewash', 'paintBlue']);
  L.pot(18.6, 21.4, 'straw'); L.chest(12.85, 21.5, 0, 'poplar');                                              // the bread basket

  L.place('wash');
  L.rack(10.6, 18.75, 12.4, 19.15, 0.95, [0.45, 0.92], 'poplar');                                               // the drying rack
  L.row(10.75, 18.82, 'x', 6, 0.03, 0.26, 0.1, 0.92, 1.18, ['tin', 'whitewash']);
  rd(11.95, 18.95, 0.14, 0.92, 1.08, 'iron'); rd(10.95, 18.95, 0.16, 0.45, 0.62, 'tin'); rd(11.5, 18.95, 0.13, 0.45, 0.6, 'iron');
  L.bucket(12.95, 18.95, 'plasticGreen', 'plasticBlue');

  L.place('woodstore');                                                                                         // drawn only: the dark stays the lesson's
  flat(12.42, 7.42, 12.62, 7.52, 'poplar', 0.022, 0.5); flat(12.7, 7.62, 12.86, 7.7, 'poplar', 0.022, -0.4); flat(13.12, 7.46, 13.3, 7.56, 'poplar', 0.022, 1.1); flat(12.52, 6.62, 12.66, 6.7, 'poplar', 0.022, 0.2);
  bx(12.3, 7.86, 12.95, 7.9, 0.02, 0.05, 'woodGrey', L.NS, 0.5); bx(12.3, 7.66, 12.4, 7.78, 0.02, 0.07, 'iron', L.NS, 0.5);   // the axe, where it was dropped

  L.place('store');
  flat(24.5, 10.25, 26.3, 11.1, 'straw', 0.03);
  bx(27.14, 7.36, 27.84, 8.06, 0, 0.34, 'jerryYellow'); bx(27.2, 7.42, 27.82, 7.74, 0.34, 0.66, 'jerryYellow'); bx(27.5, 7.78, 27.82, 8.02, 0.34, 0.66, 'tin');   // ghee tins
  bx(27.2, 11.3, 27.84, 11.84, 0, 0.5, 'ply'); bx(27.3, 11.36, 27.8, 11.82, 0.5, 0.95, 'ply');                   // tea chests
  bx(24.9, 11.62, 26.9, 11.86, 1.3, 1.33, 'woodGrey');                                                          // a shelf of jars over the crates
  L.row(25.0, 11.66, 'x', 7, 0.14, 0.16, 0.12, 1.33, 1.55, ['prodRed', 'tin', 'prodYellow', 'prodGreen', 'tin', 'prodOrange', 'whitewash']);
  for (const a of [26.75, 26.95, 27.15]) hung('x', 7.2, a, a + 0.1, 1, 1.25, 1.95, 'prodRed', 0.05);            // chillies drying
  rd(23.6, 7.68, 0.22, 0, 0.5, 'mudDark'); rd(23.6, 7.68, 0.12, 0.5, 0.54, 'woodGrey');                         // the water jar
  rd(24.15, 7.62, 0.2, 0, 0.26, 'straw'); bx(24.02, 7.5, 24.28, 7.74, 0.26, 0.3, 'prodYellow', L.NS);           // a basket of onions
  L.chest(27.5, 8.6, 0.1, 'jerryYellow', 0.16, 0.17, 0.16, 'tin');

  L.place('watch');
  rd(27.7, 15.5, 0.2, 0, 0.36, 'iron'); bx(27.58, 15.38, 27.82, 15.62, 0.36, 0.366, 'blanketGrey', L.NS); rd(27.7, 15.5, 0.09, 0.37, 0.52, 'tin');   // his brazier and kettle
  bx(30.9, 21.1, 31.75, 21.8, 0, 0.55, 'woodGrey'); bx(30.85, 21.05, 31.77, 21.84, 0.55, 0.6, 'tin'); bx(30.885, 21.3, 30.9, 21.6, 0.05, 0.42, 'rubber', L.NS);   // the dog's kennel
  rd(30.5, 21.5, 0.1, 0, 0.07, 'tin', L.NS); bx(30.3, 21.1, 30.34, 21.14, 0, 0.25, 'iron', L.NS); flat(30.3, 21.11, 30.9, 21.13, 'iron', 0.022);
  bx(31.25, 19.1, 31.65, 19.5, 0, 0.3, 'woodGrey'); rd(31.45, 19.3, 0.2, 0.3, 0.78, 'mudDark');                 // the water jar on its stand
  flat(29.3, 19.95, 29.4, 20.12, 'rubber', 0.03); flat(29.46, 19.97, 29.56, 20.14, 'rubber', 0.03);             // his shoes by the bed
  flat(28.5, 6.5, 30.3, 10.9, 'damp', 0.022);                                                                   // the kitchen garden
  for (const x of [28.8, 29.4, 30.0]) bx(x - 0.12, 6.7, x + 0.12, 10.7, 0.02, 0.16, 'scrub', L.NS);
  bx(30.35, 6.3, 30.39, 7.9, 0.03, 0.07, 'woodGrey', L.NS);
  L.stool(28.3, 16.3); L.bucket(30.6, 8.2, 'galv', 'plasticBlue');

  L.place('beyond');
  L.hoist(6.2, 7.6);                                                                                            // the motor pool's hoist, past the west wall
  L.spools(36.6, 7.4);                                                                                          // the generator yard's cable, past the east wall
  L.done();
}
