// TRAIN-PAIRS — Training 6, "Two pairs, two doors, one word": THE WHITE HOUSE, the headman's house — the one whitewashed building of the compound, its two
// door faces whitewashed, a rust dado round the door RED takes and a blue one round BLUE's, a dish at its corner, a garden, a grain store. A ROOM CLEAR with the four (game/roomclear.ts over this file's
// `scenarios.roomClear`; no breach plan, so there is no F drill: F is only ever the word) with a `scenarios.lesson` block (game/lesson.ts).
// THE ORDER: the simple thing first — a walk up to the grain store, all four on its one door (B, then F) — then the commander's mark off the house's south-west corner, fall
// in, and who the next order goes to (T: gold → red → blue): a pair on each of the house's two doors, and the LAST key of the lesson is the one word that
// sends both in on the same frame. The house has the yard's only bulb and the yard no lamp: on the word both leaves swing and an L of light falls west
// and south across black ground.
//
//        x 8        12      16.5          23.5  25.5     30.5 32
//   z 6  ┌──────────────────────────────────────────────────────┐
//        │  (garden)         ┌─────────────┐ dish               │
//        │   red  ►   hut_w  ║  the white  │                    │      the white house (room id `hut`): a door on its WEST wall and one on its SOUTH
//  gate_w   SAM              │ house (2)   │ rope bed           gate_e
//        │   blue ►          └────hut_s────┘                    │
//        │            ▂ the mark                ┌─store_n─┐     │      the grain store (room id `store`): one door, on its north wall
//        │   (garden beds)                      │ (1 man) │     │
//   z 22 └──────────────────────────────────────┴─────────┴─────┘
//
//   bun run tools/levels/export.ts train-pairs [--check]     → levels/train-pairs.json
//   bun run map:check train-pairs                            the structure against the floor, and the scripted four through it
//   bun run tools/qa/lesson-check.ts train-pairs             the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-pairs               the scripted commander through every step to 'structure taken'
//   page: ?levelFile=train-pairs.json&roomclear=1&squad4     (&nolesson: the same level as its room clear alone)
import type { Vec3 } from '../../src/math/vec';
import type { LessonData, Rect, StructureData } from '../../src/scene/scenarios';
import { GW_SHELL } from '../../src/scene/gwotKit';
import { trainGround, TRAIN_MATERIALS, EXIT_E, HALF, YARD } from './train-ground';
import { livedTrain } from './lived-train';

export const NAME = 'train-pairs';
export const NOTES = 'Training 6, two pairs, two doors, one word: the white house (a door on two walls) in its garden, a grain store, three defenders. Regenerate: bun run tools/levels/export.ts train-pairs';
export const MATERIALS = TRAIN_MATERIALS;

export function build() {
  const T = trainGround(), { G, grp } = T;

  // ---- the white house: the room with two ways in, on different walls. The compound's one rendered, whitewashed building, a blue dado on its two door faces ----
  const HUT = T.hut({ x0: 16.5, z0: 8.5, x1: 23.5, z1: 14.5, kind: 'render', doors: [{ name: 'hut_w', side: 'w', at: 11.0 }, { name: 'hut_s', side: 's', at: 19.8 }] });
  grp('hut.room');
  // the meeting room: floor cushions round the walls, a carpet, the tea table off to the east end (everything a walk-over but the table; nothing on a
  // defender's mark), and the yard's ONE bulb over the carpet
  G.rug(19.8, 11.5, 3.2, 2.4, 'afghan'); G.lowTable(21.3, 11.7, HALF);
  G.toshak(20.9, 9.0, 1.9, 0); G.toshak(18.5, 9.0, 1.4, 0, 'rugGreen'); G.toshak(23.0, 11.8, 1.8, HALF);
  G.bulb(20.0, 11.4, 'bulb_hut', 'hut');
  grp('hut.face');
  // the two faces that show (moonlit, toward the camera) are WHITEWASHED floor to eave, and each door wears the colour of the pair the lesson sends to it,
  // a dado standing just proud of the whitewash: rust round the door RED takes, blue round the door BLUE takes ("the red door", "the blue door")
  const EAVE = T.H - 0.05, PROUD = GW_SHELL + 0.02;
  for (const [a, b] of [[8.4, 10.98], [12.22, 14.6]]) { G.skirt('z', 16.5, a, b, -1, 'whitewash', EAVE); G.dado('z', 16.5, a, b, -1, 'paintRust', PROUD); }
  for (const [a, b] of [[16.4, 19.78], [21.02, 23.6]]) { G.skirt('x', 14.5, a, b, 1, 'whitewash', EAVE); G.dado('x', 14.5, a, b, 1, 'paintBlue', PROUD); }
  G.satDish(24.3, 9.3, 0, 2.2); G.charpoy(24.7, 12.4, HALF);                     // the dish at its north-east corner; a rope bed in the lee of the east wall
  // ---- the grain store: the first room, one door ----
  const STORE = T.hut({ x0: 25.5, z0: 16.5, x1: 30.5, z1: 21.0, kind: 'block', floor: 'slab', doors: [{ name: 'store_n', side: 'n', at: 27.4 }] });
  grp('store.room');
  G.sacks(26.3, 20.3, 0, 3); G.sacks(27.5, 20.4, 0.2, 2); G.sacks(29.0, 20.4, 0, 3); G.lantern(30.0, 20.5, 'lantern_store', 'store', 0);
  G.woodPile(24.9, 19.6, HALF, 1.4); G.handcart(31.25, 17.2, HALF, 'sacks');

  // ---- the garden: beds along the north wall and across the south-west, bushes in them (props: off every path a pair walks), and NO lamp — the house's
  // bulb is the yard's only light ----
  grp('yard');
  T.breakerAt(31.84, 8.0, 'w');
  G.patch(12.2, 7.3, 6.4, 1.3, 'damp');
  for (const x of [27.4, 28.7, 30.0]) { G.patch(x, 9.6, 0.8, 4.4, 'damp'); G.patch(x, 9.6, 0.22, 4.0, 'scrub'); }
  // the trodden paths, each in three overlapping pieces: the gate to the red door, the blue door to the grain store
  G.patch(9.7, 13.55, 3.4, 0.9, 'dust', 0.38); G.patch(12.3, 12.75, 3.4, 1.0, 'dust', 0.3); G.patch(14.9, 12.0, 3.2, 0.8, 'dust', 0.22);
  G.patch(21.8, 15.15, 3.0, 0.8, 'dust', -0.1); G.patch(24.3, 15.55, 3.2, 1.0, 'dust', -0.16); G.patch(26.7, 15.95, 3.0, 0.9, 'dust', -0.22);
  // three crop rows north of the south wall's moon shadow (z over 18.4 is black), running under the commander's mark
  for (const z of [16.2, 17.2, 18.2]) { G.patch(13.0, z, 5.2, 0.8, 'damp'); G.patch(13.0, z, 4.8, 0.22, 'scrub'); }
  G.bush(15.0, 7.2); G.bush(11.6, 7.2, 1.2); G.bush(13.4, 7.4); G.bush(26.3, 7.6, 1.1); G.bush(31.0, 11.4);
  G.bush(10.7, 16.9, 1.1); G.bush(10.9, 18.3); G.bush(21.4, 18.2, 1.2);
  // the commander's mark: a stub of garden wall off the house's corner (knee-high cover)
  { const b = G.piece(15.0, 15.5, 0.78); b(0, 0, 0, 0.75, 1.0, 0.3, G.M.mud); b(0, 0, 0.75, 0.81, 1.04, 0.34, G.M.mudLight); }
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);
  // ---- the rest of the compound, over the wall (nobody walks there): lesson 5's blue tank to the west, lesson 7's pump to the east ----
  grp('outside');
  G.waterTank(4.0, 9.6); G.pump(36.0, 9.6);

  // ---- what the room clear takes from this level: the team inside the west gate, red on the north hand, blue on the south; two men in the house, one in the store ----
  const W: Vec3 = [16.62, 1.1, 11.6], S: Vec3 = [20.4, 1.1, 14.38], N: Vec3 = [28.0, 1.1, 16.62];
  const roomClear: StructureData = {
    // (the lesson is read at six seconds a line: its men would always get the minute to dig in, and a teammate shot on the word teaches nothing about the order)
    digIn: false,
    name: 'the headman\'s house',
    team: { sam: [10.6, 0, 14.0], samYaw: HALF, ops: [[13.0, 0, 12.4], [12.0, 0, 12.4], [13.0, 0, 15.6], [12.0, 0, 15.6]], opsYaw: HALF },
    rooms: [
      // TWO men, on the two marks the house has (as many marks as men: the deal has no choice, every run is this placement). The store's gunfire has them
      // on their feet and aimed when the word comes, and such a man wins against whoever first shows on his line: so NEITHER can see out of a door. Both
      // leaves swing in and stand open across the west side of their openings; each man is in the pocket behind the leaf of the door he watches. The one
      // by the south door is in the sights of the pair at the WEST door from its hold; the one by the west door is seen from no hold at all (a man in the
      // far corner shot the first of each pair as he crossed his opening), and the first man through the south doorway has him across the room
      { id: 'hut', name: 'the white house', bounds: { ...HUT }, garrison: 2,
        doors: [{ id: 'hut_w', from: 'yard' }, { id: 'hut_s', from: 'yard' }],
        marks: [
          { pos: [17.0, 0, 10.5], watch: 'hut_w', aimAt: W },       // behind the west door's open leaf, his back to the north-west corner
          { pos: [18.0, 0, 13.4], watch: 'hut_s', aimAt: S },       // the hard corner west of the south door
        ] },
      { id: 'store', name: 'the grain store', bounds: { ...STORE }, garrison: 1,
        doors: [{ id: 'store_n', from: 'yard' }],
        marks: [
          { pos: [26.3, 0, 17.4], watch: 'store_n', aimAt: N },     // the hard corner west of the door: he sees nobody until they are through it
          { pos: [29.7, 0, 17.4], watch: 'store_n', aimAt: N },     // the hard corner east of it
        ] },
    ],
    // a squad a room, each at home (as lesson 5): on hard nobody comes out into a yard where two pairs stand against doors, nobody wedges a door
    squads: [{ id: 'hut', name: 'Alpha', rooms: ['hut'], mayLeave: false, barricade: [] }, { id: 'store', name: 'Bravo', rooms: ['store'], mayLeave: false, barricade: [] }],
  };

  // every step from the first stack on has a way through whatever the player did instead: F goes to whoever T has selected, so F pressed early with BLUE
  // selected sends blue in alone and a pair on EACH door can then never come — the hut TAKEN some other way passes every step that waited on it
  const taken = (room: string) => ({ is: 'taken', room }), or = (...of: object[]) => ({ is: 'any', of }), and = (...of: object[]) => ({ is: 'all', of });
  // two marks to walk to: short of the grain store, on the trodden path, its door in view (the team starts 17 m from that door); and where the commander
  // stands for the last word, off the house's corner behind a stub of garden wall, both doors in reach of his cursor and neither looking at him
  const UP: Rect = { x0: 21.6, x1: 24.4, z0: 15.2, z1: 17.0 }, UP_AT: Vec3 = [23.0, 0, 16.0];
  const POST: Rect = { x0: 12.6, x1: 15.6, z0: 15.6, z1: 17.6 }, POST_AT: Vec3 = [14.2, 0, 16.5];
  const lesson = {
    title: 'Two pairs, two doors, one word',
    steps: [
      // the simple thing first: all four on one door, one word
      { id: 'up', line: 'Walk to the mark, short of the grain store', done: or({ is: 'in', area: { ...UP } }, taken('store')), at: [UP_AT[0], 1, UP_AT[2]] },
      { id: 'stack-all', line: 'B on the grain store\'s door: all four stack up', done: or({ is: 'stackOn', who: 'all', door: 'store_n' }, taken('store')), at: [28.0, 1, 16.5] },
      { id: 'word-all', line: 'F gives the word: all four go in', done: or({ is: 'word', doors: 1 }, taken('store')) },
      { id: 'post', line: 'Walk back to the mark by the white house', done: or({ is: 'in', area: { ...POST } }, taken('hut')), at: [POST_AT[0], 1, POST_AT[2]] },
      { id: 'fall-in', line: 'When they call clear: X on the ground, then 3', done: or(and(taken('store'), { is: 'following' }), taken('hut')) },
      // then the lesson's name: a pair a door, and the LAST key is the one word that sends both in. T with the cursor on a teammate addresses that one man
      // (and never reaches RED): the lines say where the cursor goes
      { id: 'red', line: 'Cursor on bare ground, then T: RED takes your orders', done: or({ is: 'orderTo', who: 'red' }, taken('hut')) },
      { id: 'stack-red', line: 'X on the red door, then 1: RED stacks up', done: or({ is: 'stackOn', who: 'red', door: 'hut_w' }, taken('hut')), at: [16.5, 1, 11.6] },
      { id: 'blue', line: 'T again, off the men: BLUE', done: or({ is: 'orderTo', who: 'blue' }, taken('hut')) },
      { id: 'stack-blue', line: 'B on the blue door: BLUE stacks up', done: or(and({ is: 'stackOn', who: 'blue', door: 'hut_s' }, { is: 'pairsOn', doors: 2 }), taken('hut')), at: [20.4, 1, 14.5] },
      { id: 'gold', line: 'Not F yet. T, off the men: GOLD, the whole squad', done: or(and({ is: 'orderTo', who: 'all' }, { is: 'pairsOn', doors: 2 }), taken('hut')) },
      { id: 'word', line: 'F gives the word: both pairs go in together', done: or({ is: 'word', doors: 2 }, taken('hut')) },
    ],
  } as LessonData;
  const front: Vec3 = [22.5, 1.0, 11.6];
  const out = T.finish({
    spawn: [10.6, 0, 14.0],
    mission: { serverRoom: { ...HUT }, entryDoor: 'hut_w', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the ground's west gate from the track outside it, the
    // garden beyond the wall. The lesson starts the team INSIDE that gate, so `ref` says which side the picture is taken from; the wash bench outside the wall
    // stands where the card switch walks beside the stack, and is out of this picture (`hide`).
    scenarios: { roomClear, lesson, places: { areas: [{ name: 'garden', bounds: { ...YARD } }] }, kitView: { ways: [{ door: 'gate_w', ref: [5, 14.25], hide: ['lived.beyond'] }] } },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The headman's house and its garden:
// in the meeting room the television in the corner the dish outside feeds, the green cupboard, the hanging and a framed picture; in
// the grain store the big clay jar, sieves on the wall, a sack on its barrow; in the garden THE PIGEON LOFT (this corner's signature,
// stood again by the white walls outside lessons 5 and 7), a row of beehives behind the house, a scarecrow in the crop, a wheelbarrow.
// Nothing stands on a mark, on the floor an entry is dealt, within 2 m of a jamb on either face, or in the two areas the lesson's
// lines name; no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('house');
  bx(22.5, 8.66, 23.3, 9.2, 0, 0.5, 'poplar'); bx(22.5, 8.66, 23.3, 9.2, 0.5, 0.506, 'rugCream', L.NS);          // the television on its cabinet
  bx(22.6, 8.7, 23.2, 8.86, 0.51, 0.95, 'plasticBlack'); bx(22.64, 8.86, 23.16, 8.868, 0.56, 0.9, 'glassDark', L.NS); bx(22.6, 8.95, 22.9, 9.12, 0.51, 0.57, 'tin');
  bx(16.66, 8.66, 17.2, 9.6, 0, 1.85, 'paintGreen'); bx(16.7, 8.7, 17.1, 9.3, 1.85, 2.0, 'tin');                 // the cupboard, a case on top
  bx(17.2, 8.7, 17.21, 9.12, 0.1, 1.75, 'paintCream', L.NS); bx(17.2, 9.14, 17.21, 9.56, 0.1, 1.75, 'paintCream', L.NS);
  hung('x', 8.5, 19.6, 21.4, 1, 1.1, 1.9, 'rugMadder', 0.015); hung('x', 8.5, 19.75, 21.25, 1, 1.22, 1.78, 'rugNavy', 0.008, 0.015); hung('x', 8.5, 20.2, 20.8, 1, 1.38, 1.62, 'rugOchre', 0.006, 0.023);   // the hanging
  hung('z', 23.5, 9.6, 10.3, -1, 1.4, 1.9, 'poplar', 0.02); hung('z', 23.5, 9.68, 10.22, -1, 1.47, 1.83, 'whitewash', 0.006, 0.02);   // a framed picture
  bx(19.5, 11.2, 20.1, 11.7, 0.026, 0.05, 'tin'); L.row(19.6, 11.3, 'x', 3, 0.08, 0.08, 0.07, 0.05, 0.13, ['whitewash']);   // the tea tray on the rug
  bx(18.0, 9.42, 18.6, 9.76, 0, 0.16, 'rugOchre');                                                              // a cushion off the mattress
  L.stool(22.2, 9.75, 'paintGreen');                                                                            // (nothing lived is blue or gold on this level: BLUE and GOLD are who takes an order)

  L.place('store');
  flat(27.0, 18.9, 28.6, 19.7, 'straw', 0.03);                                                                  // spilt grain
  rd(26.08, 19.25, 0.33, 0, 1.15, 'mud'); rd(26.08, 19.25, 0.2, 1.15, 1.2, 'woodGrey');                         // the big grain jar
  hung('z', 30.5, 18.2, 18.9, -1, 1.1, 1.8, 'straw', 0.03); hung('z', 30.5, 19.1, 19.6, -1, 1.2, 1.7, 'woodGrey', 0.03);   // sieves on the wall
  rd(27.3, 19.4, 0.1, 0, 0.18, 'tin'); bx(27.9, 19.2, 28.5, 19.26, 0.03, 0.06, 'woodGrey', L.NS, 0.3);           // the measure and the wooden shovel
  L.loose('cardboard', 30.0, 19.3, Math.PI / 2, 7, [{ off: [0, 0.45, -0.12], h: [0.2, 0.45, 0.02], m: 'rust' }, { off: [0, 0.06, 0.02], h: [0.2, 0.015, 0.14], m: 'rust' }, { off: [0, 0.28, 0.01], h: [0.18, 0.2, 0.11], m: 'sack' }]);   // a sack on its barrow

  L.place('garden');
  L.loft(25.95, 10.4);                                                                                          // THE PIGEON LOFT
  L.plank(18.2, 6.4, 21.3, 6.9, 0.3, 'woodGrey');                                                               // beehives behind the house
  L.row(18.35, 6.44, 'x', 4, 0.5, 0.42, 0.28, 0.3, 0.72, ['whitewash', 'paintGreen', 'paintGreen', 'whitewash']); L.row(18.32, 6.42, 'x', 4, 0.56, 0.46, 0.22, 0.72, 0.76, ['tin']);
  bx(11.87, 17.17, 11.93, 17.23, 0, 1.7, 'woodGrey'); bx(11.4, 17.18, 12.4, 17.22, 1.3, 1.36, 'woodGrey', L.NS);   // the scarecrow, in the middle crop row (north of the south wall's moon shadow)
  bx(11.6, 17.16, 12.2, 17.24, 0.8, 1.38, 'blanketBrown', L.NS); bx(11.75, 17.1, 12.05, 17.3, 1.7, 1.9, 'straw', L.NS);
  bx(9.6, 18.98, 9.64, 19.02, 0, 1.0, 'woodGrey', L.NS); bx(9.54, 18.97, 9.7, 19.03, 0, 0.2, 'iron', L.NS);      // a spade left standing
  L.loose('bin', 9.3, 19.8, 0.4, 9, [{ off: [0, 0.38, 0], h: [0.4, 0.14, 0.28], m: 'paintGreen' }, { off: [0.5, 0.2, 0], h: [0.14, 0.2, 0.04], m: 'rubber' }, { off: [-0.6, 0.42, 0.22], h: [0.3, 0.02, 0.02], m: 'woodGrey' }, { off: [-0.6, 0.42, -0.22], h: [0.3, 0.02, 0.02], m: 'woodGrey' }]);   // the wheelbarrow
  L.bucket(21.75, 6.8, 'galv', 'rubber');

  L.place('beyond');
  L.basins(6.6, 9.2, 1);                                                                                        // the quarters' wash bench, past the west wall
  L.waterCart(37.4, 11.3);                                                                                      // the well court's cart, past the east wall
  L.done();
}
