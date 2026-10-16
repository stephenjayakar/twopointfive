// TRAIN-ORDERS — Training 5, "Orders and door tools": commanding a pair. The orders menu on the ground (move, cover, hold, fall in), the usual order on a
// door (stack up), then the door tools on four houses, one each: open and clear · bang and clear · the door held until the
// word · a charge on a locked door, blown on the word.
// A ROOM CLEAR (game/roomclear.ts) for the pair, with a `scenarios.lesson` block (game/lesson.ts) whose steps name each key and move on when the thing is DONE.
//
// THE PLACE: THE QUARTERS, a short gravel street of four one-room houses — the compound's fifth corner (west: the range's T-walls; east: the white house).
// The street is dark and empty (the pair fights in it); the landmark is THE BLUE WATER TANK between the two north houses; each room is its own picture.
// A bulb a room — but the armoury's is out: one lamp over its door, a black room behind it.
//
//        x 8        14       19    22          28.5    32
//   z 6  ┌──────────────────────────────────────────────┐
//        │ sandbags  ┌────────┐tank ┌───────────┐       │      A = the yellow house (a sleeping room) · B = the green house (the guest room)
//        │  ▂▂▂      │   A    │ ◯   │    B      d hut_b_east
//        │           └──dA────┘     └───dB──────┘       │      dA = hut_a (open and clear) · dB = hut_b (bang and clear; the side door will do as well)
//  gate_w  team  ·  ·  ·  the street (gravel)  ·  ·  ·   gate_e
//        │           ┌──dD────┐▌ ┌──dC*─────┐           │      dD = hut_d (held from the door, then F) · dC = hut_c, LOCKED (the charge) · * the one lamp
//        │ rope bed  │   D    │  │    C     │ crates    │      D = the kitchen · C = the armoury · ▌ = the barrier (the commander's cover for the charge)
//   z 22 └───────────└────────┘──└──────────┘───────────┘
//
// Four men hold the four houses, one each, and they STAY in them (a defender squad a house, `mayLeave: false`, no door of theirs to wedge): the street is the
// player's to give orders in, and each fight is the one the lesson sends the pair into.
//
//   bun run tools/levels/export.ts train-orders [--check]    → levels/train-orders.json
//   bun run map:check train-orders --no-runs                 the structure against the built floor
//   bun run tools/qa/lesson-check.ts train-orders            the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts train-orders              the scripted player through every step to 'structure taken'
//   page: ?levelFile=train-orders.json&roomclear=1    (&nolesson: the same level as its room clear alone)
import type { LessonData, LessonTest, StructureData } from '../../src/scene/scenarios';
import { BoxFlag } from '../../src/scene/boxes';
import { trainGround, TRAIN_MATERIALS, EXIT_E, HALF, YARD } from './train-ground';
import { livedTrain } from './lived-train';

export const NAME = 'train-orders';
export const NOTES = 'Training 5, orders and door tools: the quarters, a dark street of four one-room houses with a man in each, a pair to command. Regenerate: bun run tools/levels/export.ts train-orders';
export const MATERIALS = TRAIN_MATERIALS;

export function build() {
  const T = trainGround(), { G, grp, add } = T;

  // ---- the four houses: windowless (nobody inside sees the street), a bulb in each (the pair sees its man; the armoury's is out) ----
  const A = T.hut({ x0: 14, z0: 7.2, x1: 19, z1: 11.6, doors: [{ name: 'hut_a', side: 's', at: 16.0 }] });
  const B = T.hut({ x0: 22, z0: 7.2, x1: 28.5, z1: 11.6, kind: 'mudLight', doors: [{ name: 'hut_b', side: 's', at: 24.6 }, { name: 'hut_b_east', side: 'e', at: 8.6 }] });
  const C = T.hut({ x0: 20, z0: 16.4, x1: 26, z1: 20.8, kind: 'block', floor: 'slab', doors: [{ name: 'hut_c', side: 'n', at: 22.4, extra: { locked: true, keySide: -1 } }] });
  const D = T.hut({ x0: 13.5, z0: 16.4, x1: 18.5, z1: 20.8, kind: 'mudLight', doors: [{ name: 'hut_d', side: 'n', at: 15.4 }] });
  // ---- four DIFFERENT rooms (the roofs are not drawn: the floors are the picture). Everything in A and B is walk-over or drawn-only; the cover in D and C
  //      stands against the back walls, clear of every defender's mark and of the points an entry is dealt (a door's middle ± 1.7 m, 1.2‥2.2 m inside) ----
  const dadoIn = (r: { x0: number; z0: number; x1: number; z1: number }, paint: 'jerryYellow' | 'paintGreen', s: [number, number], e?: [number, number]) => {
    const dado = (axis: 'x' | 'z', line: number, a: number, b: number, side: 1 | -1) => G.skirt(axis, line, a, b, side, paint, 1.1);   // (G.dado with any of the palette's colours)
    dado('x', r.z0, r.x0 + 0.12, r.x1 - 0.12, 1); dado('z', r.x0, r.z0 + 0.12, r.z1 - 0.12, 1);
    dado('x', r.z1, r.x0 + 0.12, s[0], -1); dado('x', r.z1, s[1], r.x1 - 0.12, -1);
    if (e) { dado('z', r.x1, r.z0 + 0.12, e[0], -1); dado('z', r.x1, e[1], r.z1 - 0.12, -1); } else dado('z', r.x1, r.z0 + 0.12, r.z1 - 0.12, -1);
    // … and the street face, either side of the door
    dado('x', r.z1, r.x0 - 0.12, s[0], 1); dado('x', r.z1, s[1], r.x1 + 0.12, 1);
  };
  grp('huts.rooms');
  // A, THE YELLOW HOUSE: a sleeping room — two ochre mattresses along the side walls, a striped kilim, a yellow dado inside and on the street. (Not blue: the
  // pair are Blue One and Blue Two, and RED / BLUE / GOLD are the next lesson's words for who takes an order.)
  dadoIn({ x0: 14, z0: 7.2, x1: 19, z1: 11.6 }, 'jerryYellow', [16.0, 17.2]);
  G.rug(16.5, 9.2, 2.2, 1.6, 'kilim', 0.04); G.toshak(14.52, 9.7, 1.9, HALF, 'rugOchre', 'rugCream'); G.toshak(18.48, 9.7, 1.9, HALF, 'rugOchre', 'rugCream');
  G.bulb(16.5, 9.4, 'bulb_a', 'hut_a');
  // B, THE GREEN HOUSE: the guest room — mattresses on two walls, a low table with the tea things, a green mat (each lit floor is told from the next at a glance: cream stripes, green, red, and the armoury's black)
  dadoIn({ x0: 22, z0: 7.2, x1: 28.5, z1: 11.6 }, 'paintGreen', [24.6, 25.8], [8.6, 9.8]);
  G.rug(25.2, 9.7, 2.6, 1.8, 'mat', -0.03); G.toshak(25.2, 7.72, 1.9, 0, 'rugGreen', 'rugCream'); G.toshak(22.52, 9.4, 1.9, HALF, 'rugGreen', 'rugCream'); G.lowTable(25.2, 8.5);
  G.bulb(25.2, 9.4, 'bulb_b', 'hut_b');
  // C, THE ARMOURY: block walls, a slab floor, crates along the back wall, a trunk — and its bulb OUT: the one black room on the street behind the one lit
  // door, so when the charge goes the pair's weapon lights are what shows it (map-check: the same 82 of 96 men up, lit or dark)
  G.crates(22.7, 20.42, 0, 3); G.crates(24.0, 20.42, 0, 2); G.trunk(25.5, 20.3, 0, 'paintCream'); G.bulb(23.0, 18.6, 'bulb_c', 'hut_c', false);
  // D, THE KITCHEN: the stove and its gas bottle in one back corner, flour sacks in the other, the red rug to eat on
  G.stove(14.0, 20.3); G.gasBottle(14.62, 20.42); G.sacks(17.85, 20.2, 0, 3); G.rug(16.0, 19.6, 1.8, 1.2, 'afghan', 0.05); G.patch(14.5, 19.6, 0.9, 0.7, 'damp', 0.3);
  G.bulb(16.0, 18.6, 'bulb_d', 'hut_d');

  // ---- the street: gravel the yard's length (the track outside either gate runs on through), dark but for ONE lamp over the armoury's door, and EMPTY — the
  //      pair fights here. The landmark stands in the slot between the yellow house and the green one ----
  grp('street');
  G.ground(8.12, 11.72, 31.88, 16.28, 'gravel', 0.008);
  G.waterTank(20.5, 10.2);
  G.patch(20.5, 11.25, 1.9, 0.8, 'damp');
  // the lamp: a bracket off the armoury's wall over its door (nothing of it under 2.4 m: no nav cell, no line at a man's height), a small pool on the one door
  // that is different from the first second
  add({ c: [23.0, 2.66, 16.07], h: [0.025, 0.025, 0.21], ...MATERIALS.galv });
  add({ c: [23.0, 2.62, 15.82], h: [0.17, 0.045, 0.17], ...MATERIALS.plasticBlack });
  const armLamp = add({ c: [23.0, 2.565, 15.82], h: [0.11, 0.01, 0.11], ...MATERIALS.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
  T.lights.push({ kind: 'spot', pos: [23.0, 2.53, 15.82], dir: [0, -1, 0], color: [1.0, 0.86, 0.6], intensity: 60, range: 7, innerDeg: 20, outerDeg: 42, name: 'lamp_arm', group: 'exterior', enabled: true, volumetric: 0.25, fixtureBox: armLamp, radius: 0.08, mains: false });
  // the commander's cover for the charge: a barrier end on to the kitchen's corner, three and a half metres WEST of the armoury's door (the pair stands off
  // east of it, past the latch) and out of the line through it
  G.jersey(19.5, 15.25, 1, HALF);

  // ---- the ends of the street: cover to send the pair to (west), what a place people sleep in leaves outside (a rope bed, the kitchen's wood) ----
  grp('yard');
  G.sandbags(11.6, 10.7, 2.2, 0, 3);
  G.charpoy(10.6, 20.6, 0); G.woodPile(12.75, 19.4, HALF);
  G.crates(27.0, 18.2, HALF, 3); G.crates(27.0, 19.5, HALF, 2); G.jerryCan(26.5, 20.4, 0.3); G.jerryCan(26.9, 20.5, -0.2);
  G.charpoy(30.2, 20.4, HALF, 'rugOchre'); G.rug(30.2, 9.2, 1.6, 1.0, 'kilim', HALF - 0.04);
  G.skirt('x', 22, 8, 32, -1); G.skirt('x', 6, 8, 32, 1);

  // ---- one compound: the range's backstop (lesson 4) over the west wall, the white house and its dish (lesson 6) over the east ----
  grp('outside');
  G.tWall(4.2, 9.2, 4, HALF); G.patch(5.4, 9.2, 1.6, 4.2, 'dust');
  G.wallX(8.6, 34.48, 38.4, 'render'); G.wallZ(34.6, 8.72, 11.0, 'render'); G.satDish(36.4, 9.4, 0);

  const doorA: [number, number, number] = [16.6, 1.1, 11.5], doorB: [number, number, number] = [25.2, 1.1, 11.5], doorBe: [number, number, number] = [28.4, 1.1, 9.2], doorC: [number, number, number] = [23.0, 1.1, 16.5], doorD: [number, number, number] = [16.0, 1.1, 16.5];
  const roomClear: StructureData = {
    // (the lesson is read at six seconds a line: its men would always get the minute to dig in, and a teammate shot on the word teaches nothing about the order)
    digIn: false,
    name: 'the quarters',
    team: { sam: [10.6, 0, 14.0], samYaw: HALF, ops: [[9.4, 0, 12.9], [9.4, 0, 15.1], [9.0, 0, 11.8], [9.0, 0, 16.2]], opsYaw: HALF },
    rooms: [
      { id: 'a', name: 'yellow house', bounds: { ...A }, garrison: 1, doors: [{ id: 'hut_a', from: 'the street' }],
        marks: [{ pos: [15.0, 0, 8.2], watch: 'hut_a', aimAt: doorA }, { pos: [18.0, 0, 8.2], watch: 'hut_a', aimAt: doorA }] },
      { id: 'b', name: 'green house', bounds: { ...B }, garrison: 1, doors: [{ id: 'hut_b', from: 'the street' }, { id: 'hut_b_east', from: 'the east side' }],
        marks: [{ pos: [23.2, 0, 8.2], watch: 'hut_b', aimAt: doorB }, { pos: [27.4, 0, 10.6], watch: 'hut_b', aimAt: doorB }, { pos: [23.4, 0, 10.4], watch: 'hut_b_east', aimAt: doorBe }] },
      { id: 'd', name: 'kitchen', bounds: { ...D }, garrison: 1, doors: [{ id: 'hut_d', from: 'the street' }],
        marks: [{ pos: [16.2, 0, 18.9], watch: 'hut_d', aimAt: doorD }, { pos: [16.3, 0, 19.5], watch: 'hut_d', aimAt: doorD }] },   // (the back of the room, IN the open door's view: the word's can goes in before the pair does, and they meet him in its flash. A man in a near corner was a pocket too small for the can at a real-size door, and the pair stepped in to a coin's toss)
        // (both marks in the MIDDLE of the back wall, in the band neither jamb man's diagonal reaches: the two who hold stand a metre out and half a metre
        //  wide of the jambs, the west man looking at the east back and the east man at the west back, and a defender on either diagonal — awake since the
        //  first shots, his gun already on the door — met ONE of them alone. From the west back he shot the man who shoved the door as he crossed (the tape);
        //  from the east back, once that man worked the handle from past the latch jamb (handleside.ts HANDLE.toolNear) and no longer saw in, he shot the
        //  hinge-jamb man: 7 of 8 shipped dice. In the middle nobody duels at the hold: they set, the word's can goes in, and they meet him in its flash —
        //  0 lost over 12 shipped dice (four on hard) and 3 on the frozen stand. With the handle rule off (?notoolnear) the old fault is back on hard)
      { id: 'c', name: 'armoury', bounds: { ...C }, garrison: 1, doors: [{ id: 'hut_c', from: 'the street' }],
        marks: [{ pos: [24.4, 0, 17.6], watch: 'hut_c', aimAt: doorC }, { pos: [21.4, 0, 19.8], watch: 'hut_c', aimAt: doorC }] },
    ],
    // a squad a hut, each at home: nobody leaves his hut for a fight next door (one squad over all four would fall back from hut to hut), nobody wedges a
    // door (game/enemysquads.ts)
    squads: [{ id: 'a', name: 'Alpha', rooms: ['a'], mayLeave: false, barricade: [] }, { id: 'b', name: 'Bravo', rooms: ['b'], mayLeave: false, barricade: [] }, { id: 'c', name: 'Charlie', rooms: ['c'], mayLeave: false, barricade: [] },
      { id: 'd', name: 'Delta', rooms: ['d'], mayLeave: false, barricade: [] }],
  };
  // every deed names ITS door (`on`), so an order on the wrong hut moves nothing on; and every step from the first door on has a way through whatever the
  // player did instead — its hut TAKEN some other way (no can or charge left in the kit, a door opened by another tool) passes the step that asked for the tool.
  const taken = (room: string): LessonTest => ({ is: 'taken', room }), gave = (order: string, on: string): LessonTest => ({ is: 'did', what: `order:${order}`, on });
  const or = (...of: LessonTest[]): LessonTest => ({ is: 'any', of }), and = (...of: LessonTest[]): LessonTest => ({ is: 'all', of });
  const bags: [number, number, number] = [11.6, 1, 11.7], barrier: [number, number, number] = [18.7, 1, 15.4];
  const lesson: LessonData = {
    title: 'Orders and door tools',
    steps: [
      // the orders on the ground: the menu opened on the ground by the sandbags STAYS UP for the next line's digit (X again would put it away, and 1 with no
      // menu is his pistol: the line says what to do then); the move passes however it was given (the digit, B, the wheel and Space). Then each line whole by
      // itself (X, then the digit): guns down the street, hold, fall in
      { id: 'menu', line: 'X on the ground by the sandbags opens the orders menu', done: { is: 'flag', flag: 'menu' }, at: bags },
      { id: 'move', line: '1 sends the pair there. Menu gone? X on the ground again', done: { is: 'did', what: 'order:move' }, at: bags },
      { id: 'cover', line: 'X down the street, then 2: the pair covers that way', done: { is: 'did', what: 'order:cover' }, at: [17.0, 1, 14.0] },
      { id: 'hold', line: 'X on the ground, then 4: the pair holds', done: { is: 'did', what: 'order:hold' } },
      { id: 'fallin', line: 'X on the ground, then 3: the pair falls in behind you', done: { is: 'did', what: 'order:fallIn' } },
      // four doors, four ways in
      { id: 'stack', line: 'B on the yellow house\'s door: the pair stacks up beside it', done: or(gave('stack', 'hut_a'), taken('a')), at: doorA },
      { id: 'open', line: 'X on that door, 5, then 1: open and clear', done: or(gave('openClear', 'hut_a'), taken('a')), at: doorA },
      { id: 'in1', line: 'Stay out of the doorway. When they call clear, walk in', done: and(taken('a'), { is: 'in', area: { ...A } }), at: [16.5, 1, 9.4] },
      { id: 'bang', line: 'The green house. X on either door, 5, then 2: stun can first', done: or(gave('bangClear', 'hut_b'), gave('bangClear', 'hut_b_east'), taken('b')), at: doorB },
      { id: 'in2', line: 'When they call clear, walk in', done: and(taken('b'), { is: 'in', area: { ...B } }), at: [25.2, 1, 9.4] },
      // the kitchen is held from the door, then THE WORD (its beat on the door's order: nothing but F on a held door writes it)
      { id: 'thr', line: 'The kitchen. X on its door, 5, then 4: hold at the door', done: or(gave('thresholdHold', 'hut_d'), taken('d')), at: doorD },
      { id: 'word', line: 'When they hold the open door, F gives the word: in they go', done: or({ is: 'word' }, taken('d')), at: doorD },
      { id: 'in3', line: 'When they call clear, walk in', done: and(taken('d'), { is: 'in', area: { ...D } }), at: [16.0, 1, 18.6] },
      // the closer: the one lit door on the street. The marker moves to the barrier once the charge is ordered: the place to watch it from
      { id: 'charge', line: 'The armoury is locked. X on its door, 5, then 3: a charge', done: or(gave('charge', 'hut_c'), taken('c')), at: doorC },
      { id: 'blow', line: 'When the pair has stood back, F gives the word: it blows', done: or({ is: 'door', door: 'hut_c', state: 'broken' }, taken('c')), at: barrier },
      // the pay-off's line while the pair clears the black room (the room clear ends the frame it is called clear, and the row is then the scenario's own:
      // the step still goes by when he walks in, and at once for a player already inside)
      { id: 'in4', line: 'When they call clear, walk in', done: and(taken('c'), { is: 'in', area: { ...C } }), at: [23.0, 1, 18.6] },
    ],
  };
  const front: [number, number, number] = [25.5, 1.0, 19.7];
  const out = T.finish({
    spawn: [10.6, 0, 14.0],
    mission: { serverRoom: { ...C }, entryDoor: 'hut_c', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT_E.x, exfilZ: EXIT_E.z, exfilOut: EXIT_E.out },
    // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the ground's west gate from the track outside it, the
    // street beyond the wall. The lesson starts the pair a few steps INSIDE that gate, so `ref` says which side the picture is taken from.
    scenarios: { roomClear, lesson, places: { areas: [{ name: 'street', bounds: { ...YARD } }] }, kitView: { ways: [{ door: 'gate_w', ref: [5, 14.25] }] } },
  });
  furnish(T);
  return out;
}

// ---- LIVED-IN (src/scene/lived.ts; the group `lived.<place>`, loaded only with the switch on). The quarters as four different houses:
// the sleeping room (coats on a peg rail, folded quilts, a tin trunk), the guest room (a hanging on the wall, bolsters, the water
// pipe), the cookhouse (a rack of pots, plates and jars, the bread board on the rug) and the armoury (a heavy gun on its tripod, a rack
// of rockets, shelves of tins and helmets). Between the first two houses THE WASH BENCH under the tank — this corner's signature, stood
// again by the tank outside lessons 4 and 6. In the yard a pull-up bar and the boot bench, a wash line, a fire ring. The rule the rooms were built on
// holds: in the two houses with defenders at the back wall everything added is walk-over or drawn only, in the other two it stands
// against the back and side walls clear of every mark and of the floor an entry is dealt; 2 m of wall is free beside every jamb on both
// faces; the street stays bare; no light is added.
function furnish(T: ReturnType<typeof trainGround>) {
  const L = livedTrain(T), { bx, rd, flat, hung } = L;

  L.place('sleeping');
  hung('x', 7.2, 15.6, 17.6, 1, 1.78, 1.82, 'woodGrey', 0.06);                                                  // the peg rail and three coats
  ([[15.7, 'blanketBrown'], [16.35, 'olive'], [17.0, 'blanketGrey']] as const).forEach(([a, m]) => hung('x', 7.2, a, a + 0.42, 1, 0.95, 1.75, m, 0.05));
  bx(15.9, 7.36, 16.6, 7.78, 0, 0.17, 'rugRed'); bx(16.65, 7.36, 17.2, 7.78, 0, 0.12, 'blanketBrown');           // quilts folded for the day
  bx(17.4, 7.5, 17.9, 7.8, 0, 0.03, 'tin'); rd(17.55, 7.65, 0.07, 0.03, 0.24, 'tin', L.NS);                      // a tray and the water jug
  hung('z', 19, 9.2, 10.2, -1, 1.3, 1.34, 'woodGrey', 0.14); hung('z', 19, 9.5, 9.7, -1, 1.34, 1.52, 'whitewash', 0.08, 0.02);   // a shelf, the alarm clock
  flat(16.2, 11.1, 16.3, 11.3, 'rubber', 0.03); flat(16.36, 11.12, 16.46, 11.32, 'rubber', 0.03); flat(16.8, 11.08, 16.9, 11.28, 'woodGrey', 0.03);   // sandals at the door
  L.chest(16.5, 8.15, 0, 'paintGreen', 0.3, 0.16, 0.2, 'tin');                                                  // a tin trunk

  L.place('guest');
  hung('x', 7.2, 26.6, 27.8, 1, 1.0, 1.8, 'rugMadder', 0.015); hung('x', 7.2, 26.7, 27.7, 1, 1.1, 1.7, 'rugNavy', 0.008, 0.015); hung('x', 7.2, 26.95, 27.45, 1, 1.25, 1.55, 'rugCream', 0.006, 0.023);   // the hanging
  hung('x', 7.2, 23.1, 23.7, 1, 1.3, 1.75, 'poplar', 0.02); hung('x', 7.2, 23.16, 23.64, 1, 1.36, 1.69, 'paintGreen', 0.006, 0.02);   // a framed verse
  bx(26.4, 7.36, 28.2, 7.7, 0, 0.18, 'rugMadder'); bx(26.5, 7.72, 27.1, 7.98, 0, 0.12, 'rugOchre');             // bolsters along the wall
  rd(26.2, 8.5, 0.08, 0, 0.22, 'tin', L.NS); bx(26.19, 8.49, 26.21, 8.51, 0.22, 0.6, 'iron', L.NS);             // the water pipe by the table
  flat(24.75, 11.1, 24.85, 11.3, 'rubber', 0.03); flat(24.92, 11.12, 25.02, 11.32, 'rubber', 0.03); flat(25.4, 11.1, 25.5, 11.3, 'poplar', 0.03); flat(25.56, 11.08, 25.66, 11.28, 'poplar', 0.03);   // guests' shoes

  L.place('armoury');
  bx(20.56, 17.0, 20.64, 17.08, 0, 0.5, 'iron'); bx(20.5, 16.8, 20.7, 17.4, 0.5, 0.68, 'iron'); bx(20.57, 17.4, 20.63, 17.9, 0.56, 0.62, 'iron');   // the heavy gun on its tripod
  flat(20.3, 16.75, 20.9, 17.35, 'iron', 0.034); bx(20.72, 16.9, 20.95, 17.15, 0, 0.26, 'olive');
  bx(20.14, 18.2, 20.5, 18.26, 0, 0.9, 'woodGrey'); bx(20.14, 19.24, 20.5, 19.3, 0, 0.9, 'woodGrey'); bx(20.14, 18.26, 20.2, 19.24, 0.8, 0.86, 'woodGrey');   // a rack of rockets
  bx(20.2, 18.26, 20.42, 19.24, 0, 0.05, 'woodGrey');                                                           // the foot rail the rockets stand on
  L.row(20.25, 18.34, 'z', 5, 0.09, 0.09, 0.09, 0.05, 1.05, ['olive']); L.row(20.23, 18.32, 'z', 5, 0.13, 0.13, 0.05, 1.05, 1.3, ['paintGreen']);
  L.rack(25.5, 17.4, 25.86, 18.9, 1.5, [0.4, 0.9, 1.4]);                                                        // tins and helmets, east wall — its north end 0.8 m short of the drive's face (25.5, 19.7): the floor a hand reaches the drive from stays free (lived-check)
  L.row(25.54, 17.5, 'z', 4, 0.28, 0.26, 0.07, 0.4, 0.6, ['olive']); L.row(25.54, 17.5, 'z', 4, 0.28, 0.26, 0.07, 0.9, 1.1, ['olive', 'coyote']);
  L.row(25.56, 17.55, 'z', 3, 0.26, 0.24, 0.2, 1.4, 1.56, ['olive']);
  hung('x', 20.8, 24.5, 25.3, -1, 1.2, 1.6, 'whitewash', 0.006);                                                // the tally of what is in the room
  L.chest(25.45, 17.0, 0.2, 'olive', 0.25, 0.12, 0.16, 'olive');

  L.place('cookhouse');
  L.rack(15.2, 20.32, 17.2, 20.66, 1.25, [0.4, 0.85, 1.25], 'poplar');                                          // pots, plates, jars
  rd(15.55, 20.49, 0.14, 0.4, 0.6, 'iron'); rd(16.0, 20.49, 0.12, 0.4, 0.56, 'tin'); rd(16.5, 20.49, 0.15, 0.4, 0.62, 'iron');
  L.row(15.3, 20.38, 'x', 6, 0.03, 0.22, 0.09, 0.85, 1.08, ['tin', 'whitewash']); rd(16.6, 20.49, 0.11, 0.85, 1.0, 'tin'); bx(16.85, 20.38, 17.1, 20.6, 0.85, 1.02, 'prodRed');
  L.row(15.3, 20.4, 'x', 5, 0.14, 0.16, 0.2, 1.25, 1.45, ['prodYellow', 'tin', 'prodGreen', 'tin', 'prodOrange']);
  for (const a of [18.6, 18.82]) hung('z', 18.5, a, a + 0.1, -1, 1.2, 1.9, 'prodRed', 0.05);                    // chillies
  bx(15.6, 19.3, 16.2, 19.7, 0.026, 0.06, 'poplar'); bx(15.7, 19.38, 16.1, 19.62, 0.06, 0.09, 'straw'); bx(16.35, 19.45, 16.75, 19.5, 0.026, 0.07, 'woodGrey'); rd(16.55, 19.85, 0.1, 0.026, 0.08, 'tin');   // the bread board, on the rug
  L.pot(14.85, 19.6);

  L.place('washplace');
  flat(19.3, 6.5, 21.7, 8.0, 'slab', 0.022);
  L.basins(20.5, 7.2);                                                                                          // THE WASH BENCH
  hung('x', 6, 20.2, 20.8, 1, 1.2, 1.7, 'glassDark', 0.015);                                                    // a mirror on the yard wall
  L.bucket(21.3, 8.4, 'tin', 'plasticBlue');

  L.place('yard');
  bx(10.2, 8.46, 10.28, 8.54, 0, 2.3, 'galv'); bx(11.6, 8.46, 11.68, 8.54, 0, 2.3, 'galv'); bx(10.28, 8.48, 11.6, 8.52, 2.2, 2.24, 'iron', L.NS);   // the pull-up bar
  flat(10.0, 8.0, 11.9, 9.0, 'damp', 0.022);                                                                    // … and the ground worn under it
  L.plank(8.9, 6.34, 10.7, 6.62, 0.42); L.plank(11.0, 6.34, 12.8, 6.62, 0.42);                                  // the boot bench along the north wall: tins of polish, brushes, the boots in a line before it
  for (const x of [9.3, 10.1, 11.5, 12.3]) rd(x, 6.48, 0.05, 0.42, 0.45, 'tin', L.NS);
  for (const x of [9.6, 11.9]) bx(x, 6.42, x + 0.16, 6.48, 0.42, 0.46, 'woodGrey', L.NS);
  for (let i = 0; i < 6; i++) { const x = 9.0 + i * 0.66; bx(x, 6.72, x + 0.1, 6.98, 0, 0.14, 'rubber', L.NS); bx(x + 0.14, 6.72, x + 0.24, 6.98, 0, 0.14 - (i % 2) * 0.02, 'rubber', L.NS); }
  L.loose('bin', 12.9, 7.2, 0.3, 1, [{ off: [0, 0.06, 0], h: [0.1, 0.06, 0.08], m: 'tin' }, { off: [0, 0.125, 0], h: [0.07, 0.005, 0.05], m: 'rubber' }]);   // the open tin of dubbin
  bx(8.9, 17.37, 8.96, 17.43, 0, 1.9, 'woodGrey'); bx(12.6, 17.37, 12.66, 17.43, 0, 1.9, 'woodGrey'); bx(8.96, 17.39, 12.6, 17.41, 1.86, 1.88, 'rubber', L.NS);   // the wash line
  L.row(9.4, 17.39, 'x', 5, 0.5, 0.02, 0.15, 1.2, 1.86, ['olive', 'blanketGrey', 'whitewash', 'coyote', 'rugOchre'], L.NS);
  rd(29.8, 17.4, 0.42, 0, 0.08, 'block'); rd(29.8, 17.4, 0.3, 0.08, 0.086, 'rubber', L.NS); rd(29.8, 17.4, 0.1, 0.086, 0.18, 'iron', L.NS);   // the fire ring and two logs to sit on
  bx(28.9, 17.0, 29.15, 17.9, 0, 0.18, 'woodGrey'); bx(30.5, 17.0, 30.75, 17.9, 0, 0.18, 'woodGrey');

  L.place('beyond');
  L.flag(6.6, 7.4);                                                                                             // the range's flag, past the west wall
  L.loft(33.8, 11.5);                                                                                           // the white house's pigeons, past the east wall
  L.done();
}
