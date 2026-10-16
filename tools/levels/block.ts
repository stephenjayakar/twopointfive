// THE BLOCK — a district telephone exchange on the office's shell, for the four man squad. Eight defenders, two to a held room.
//
// THE ONE PROBLEM: every held room turns a corner, and its men are round it.
//
// Four held rooms, each an L: the leg its hall door opens into (the NEAR leg) and a leg round the corner (the FAR leg). The notch of every L is a small room of its
// own that nobody holds — the kitchen, the frame room, the tool crib, the jointers' room — and through it is the room's other door, the HEEL door, which lets in
// on the far leg.
//
//      x 4      11     14.4          20.4         26.6          32.2    36
//  z 4 +--------+------+-------------+------------+-------------+-------+
//      |        | MESS   far leg B *A| BATTERY    |A* B far leg   COMMS |      held rooms (m², near + far leg):
//      |        | near - - - -+-m_k--+ ROOM       +--b_f-+- - - - racks |        mess      25.6 + 19.3 = 45
//      | LOAD-  | leg  | KITCHEN     | 47.5 m²    | FRAME ROOM  | near  |        comms room 28.3 + 18.0 = 46
//      | ING   M|      | 26 m²       |            | 24.5 m²     | leg   |        workshop  29.9 + 17.5 = 47
//   12 | HALL   +-m_s--+----K--------+----T-------+------F------+-b_s-+-+        store     29.8 + 17.6 = 47
//      |   *      THE HALL      *  3.1 m wide, bare        *  fire exit >
// 15.3 | (start +---w_n-------+------+-W----------+-s_n-+---------J-----+      notch rooms (nobody's, each LIT): kitchen 26, frame room 24.5,
//      :  one)  | WORKSHOP  near leg | SWITCH     |STORE| JOINTERS'     |        tool crib 30.7, jointers' room 25
// 18.6 :        +---------------+ -  | ROOM       |near | ROOM 25 m²    |      unheld: battery room 47.5, switch room 57
//      |        | TOOL CRIB   |A   * | 57 m²      |leg  +--------s_j----+ 20.4
//      | (start D 30.7 m²    w_c far |            |     - - far * leg A |
//   24 |  two)  |             |    B |            |                  B  |
//      +-======-+--------====-+------+------------+---==========--------+
//               11            17     20.4         27.2  30.8            36
//                                                         (street lamp, outside the south wall at x 29.5: it throws through the store's window onto its turn)
//   M  the mains: the breaker panel, on the loading hall's face of the mess's wall, beside the hall's mouth and four metres from start one
//   *  an emergency lamp (off the mains, lit when they go): one in every held room's far leg, two in the hall, one in the loading hall
//   THE DOORS NO HELD ROOM OWNS, named for the two places each joins and said so ('kitchen to hall door'; no compass letter in an id that is spoken):
//      K kitchen_to_hall · F frame_to_hall · J jointers_to_hall · D crib_to_loading (start two is on it) — into the four notch rooms;
//      T battery_to_hall · W switch_to_hall — into the two rooms nobody holds. m_s, w_n, b_s, s_n are the held rooms' own hall doors.
//   HEEL DOORS, one a held room, each off its notch room: m_k (kitchen → mess), b_f (frame room → comms room), w_c (tool crib → workshop),
//      s_j (jointers' room → store). The workshop's dividing wall runs 1.3 m past the crib's corner: its turn is a 2.1 m mouth.
//   =  (in the south wall's line) a window: the loading hall's, the tool crib's, and the store's ACROSS ITS TURN.   :  the loading hall's west window.
//      The workshop, the mess and the comms room have none.
//
// PLACED BY HAND (each room's first two marks = the two men of the standard deal; the squads file adds the third):
//   A stands in the far leg with his gun on the TURN — the mouth between the legs: at the leg's far end in the mess, the comms room and the store; MID-LEG, on
//     its west wall, in the workshop (whose turn is the 2.1 m mouth at the leg's head). From the hall door he cannot be seen, and a stun canister thrown through
//     the hall door bursts in the near leg with the corner between it and him: he is not blinded. He stands in a leg whose lamp is out (0.00 on the headless
//     meter) and the men coming to the turn are in the near leg's (0.25‥0.35 at the mess's and the comms room's turn, 0.3 short of the workshop's mouth, 1.0 mid-leg).
//   B stands in the far leg too, out of the turn's line, with his gun on the HEEL door.
//   (the squads file's third man, blocksquads.ts) stands in the near leg's dead corner on the hall door: the one man a can through that door does catch.
//   A room has exactly as many marks as men, so the fresh deal of every visit is this placement.
//   THE EIGHT ARE FOUR SQUADS, one a room, and none leaves its room or wedges a door (BLOCK_SQUADS_HOLD below). As one pool most of them left their marks
//   for the first fight on Hard and every plan became one fight in the hall; as a squad over two rooms the store's pair crossed the hall to the workshop.
// So the obvious plan — stack on the hall door, bang, in — clears an empty leg and then walks round a corner onto a gun that was never flashed.
// TWO ANSWERS, NEITHER FREE:
//   THE HEEL DOOR: go round through the notch room — it opens toward the team (no boot, no wedge holds it) and lets in IN FRONT OF B's gun at short range and
//     beside A (in the workshop, behind him), and the way there is two more doors with the hall, and every other room's men, at the team's back.
//   THE DARK: the breaker is in the loading hall, four metres from where the team forms up. With the mains out every near leg is black down its length (0.00)
//     and each far leg has an emergency lamp: a ROTATING red beam (a 24° half-cone tilted 27° down, 14 m, one turn in 1.9 s). It sweeps the two men under it
//     (peak 0.9 on the meter, about an eighth of each turn) — and sweeps on OUT THROUGH THE TURN, so the last metres of a near leg are not black either: the
//     same beam passes over the team at the turn (peak 0.6‥0.8, as briefly). The comms room's turn has the racks' own lamps besides (off the mains: a steady
//     0.5 at the racks, 0.26 in the turn). So the dark is an edge at three rooms, not a cloak. The STORE is the exception, and shows it: its window is across
//     its turn and a yard lamp stands outside it, so the turn, the south end of the near leg and the west half of the far leg read a steady 1.0 whatever the
//     breaker says, while its own two men stand east of the lamp's throw under the beacon only. The hall's own emergency lamps sweep the team in the hall
//     the whole time.
//   (these numbers are an older build's; the newest, and what the mess table's move did to them, are in docs/agents/levels.md — grep 'THE MESS TABLE')
//   MEASURED (the shipped stand, seeds 1‥12, the four man squad, the scripted commander; won of 12 · men up of 48; Hard and standard play the same run
//   for run, since nobody leaves a room):
//     the hall doors  0 ·  0     the heel doors 12 · 40     the dark, then the hall doors (the store by its heel) 11 · 24
//     the dark, then the heel doors 10 · 29 (Hard)     the second start, heel doors 12 · 37
//     The hall-door plan dies in the MESS's and the WORKSHOP's near legs, at the turn. The heel doors cost their men in the notch rooms on the way to the
//     store's and the comms room's (the jointers' room, the frame room; from the second start, the kitchen). The dark takes the mess, the comms room and
//     (by its heel) the store for two men in twelve runs and loses the rest in the WORKSHOP: its man is 2.3 m from the mouth and one of the pair comes to
//     the near leg, where the lamp's beam finds the team first. The store by its hall door in the dark is NOT measured.
//   Working the HALL door from the threshold is NOT an answer (measured on the floor before the squads): the jambs see the empty leg and the step in still
//   makes the turn. The wall is not one either.
// WHAT IT REWARDS: the mains turn the hall-door plan from a wipe into a win that costs half the team; going round costs less. (The stun canister only
// pays thrown past the turn or through a heel door; thrown through the hall door it bursts in the near leg, which on this file is empty — only the squads
// file stands a man there.)
// READABLE BEFORE CONTACT, from where the team stands: the hall shows nine doors, and the four held rooms' doors sit at the END of their rooms, never the
// middle; the near leg is lit and empty through its door, the dark turn is in plain view from the threshold; every notch room is unheld and LIT (its panel is on
// the mains like the rest), so its door (off the hall; the crib's, off the loading hall) opens on a bright empty room with the heel door in its far wall; the breaker panel is on the wall the
// team starts beside; and the store's window is the END WALL of its near leg — from the store's hall door the team looks down the leg at it and at the yard
// lamp's pool on the floor of the turn, lamps on or out.
// THE SECOND START (the south end of the loading hall) is on the tool crib's door (crib_to_loading): the heel way into the workshop is the first thing in front of
// the team, and the hall — with every hall door on it — is behind them.
//   bun run tools/levels/export.ts block [--check]   → levels/block.json (+ the look's file)
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewWay, LevelScenarios, Rect } from '../../src/scene/scenarios';
import { officeKit, normalize3, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import { livedPieces, INK, h01 } from './livedPieces';


export const NAME = 'block';
export const NOTES = 'The block: a loading hall, a 3 m hall and four held rooms off it, two men to a room. Every held room turns a corner and its men are round it; the notch of each is a small room nobody holds, with the room\'s other door in it. For the four man squad. One floor, box geometry only, the office\'s shell and kit. Regenerate: bun run tools/levels/export.ts block';

/** The scenario's spaces. A held room is an L; its rectangle here is the L's BOUNDING BOX (scene/scenarios.ts takes one rectangle a room), so it also covers
 *  the notch room in its corner. The ONE place these are typed. */
export const BLOCK_ROOMS: Record<'staging' | 'hall' | 'mess' | 'comms' | 'shop' | 'store' | 'battery' | 'switchroom', Rect> = {
  staging: { x0: 4.12, x1: 10.94, z0: 4.12, z1: 23.88 },
  hall: { x0: 11.06, x1: 35.88, z0: 12.06, z1: 15.2 },
  mess: { x0: 11.06, x1: 20.34, z0: 4.12, z1: 11.94 },
  comms: { x0: 26.66, x1: 35.88, z0: 4.12, z1: 11.94 },
  shop: { x0: 11.06, x1: 20.34, z0: 15.32, z1: 23.88 },
  store: { x0: 27.26, x1: 35.88, z0: 15.32, z1: 23.88 },
  battery: { x0: 20.46, x1: 26.54, z0: 4.12, z1: 11.94 },
  switchroom: { x0: 20.46, x1: 27.14, z0: 15.32, z1: 23.88 },
};
/** Every space of the floor as the walls make it, a rectangle each (an L is its two legs): what the look's dado runs round. */
export const BLOCK_SPACES: Rect[] = [
  BLOCK_ROOMS.staging, BLOCK_ROOMS.hall, BLOCK_ROOMS.battery, BLOCK_ROOMS.switchroom,
  { x0: 11.06, x1: 14.34, z0: 4.12, z1: 11.94 }, { x0: 14.34, x1: 20.34, z0: 4.12, z1: 7.34 },      // the mess: near leg, far leg
  { x0: 14.46, x1: 20.34, z0: 7.46, z1: 11.94 },                                                    // the kitchen
  { x0: 32.26, x1: 35.88, z0: 4.12, z1: 11.94 }, { x0: 26.66, x1: 32.26, z0: 4.12, z1: 7.34 },      // the comms room: near leg, far leg
  { x0: 26.66, x1: 32.14, z0: 7.46, z1: 11.94 },                                                    // the frame room
  { x0: 11.06, x1: 20.34, z0: 15.32, z1: 18.54 }, { x0: 17.06, x1: 20.34, z0: 18.66, z1: 23.88 },   // the workshop: near leg, far leg (the dividing wall's stub, x 17.06‥18.3, has a face in each)
  { x0: 11.06, x1: 16.94, z0: 18.66, z1: 23.88 },                                                   // the tool crib
  { x0: 27.26, x1: 30.74, z0: 15.32, z1: 23.88 }, { x0: 30.74, x1: 35.88, z0: 20.46, z1: 23.88 },   // the store: near leg, far leg
  { x0: 30.86, x1: 35.88, z0: 15.32, z1: 20.34 },                                                   // the jointers' room
];
/** Where two of those rectangles are one floor (the turn of each L): no wall there, so no dado. `x`: the line runs along x (it is a z). */
export const BLOCK_MOUTHS: { x: boolean; line: number; a: number; b: number }[] = [
  { x: false, line: 14.34, a: 4.12, b: 7.34 }, { x: false, line: 32.26, a: 4.12, b: 7.34 },
  { x: true, line: 18.6, a: 18.3, b: 20.34 }, { x: false, line: 30.74, a: 20.46, b: 23.88 },
];

/** THE SQUADS FILE'S THREE (scene/scenarios.ts SquadData; blocksquads.ts stands its eleven in them): Alpha the mess, Bravo the workshop and the store,
 *  Charlie the comms room with the drive — Charlie never leaves it. Each rallies in the far leg of a room of its own. */
export const BLOCK_SQUADS = (): NonNullable<NonNullable<LevelScenarios['roomClear']>['squads']> => [
  { id: 'alpha', name: 'Alpha', rooms: ['mess'], rally: [17.6, 0, 5.8] },
  { id: 'bravo', name: 'Bravo', rooms: ['shop', 'store'], rally: [33.0, 0, 22.2] },
  { id: 'charlie', name: 'Charlie', rooms: ['comms'], rally: [29.4, 0, 6.0], barricade: ['b_s'], mayLeave: false },
];
/** THIS FILE'S EIGHT: one squad a room, and none leaves its room or wedges a door — a squad over two rooms sends its men across the hall to the room under
 *  attack, which unmakes the placement as surely as the one pool did. */
export const BLOCK_SQUADS_HOLD = (): NonNullable<NonNullable<LevelScenarios['roomClear']>['squads']> => [
  { id: 'alpha', name: 'Alpha', rooms: ['mess'], rally: [17.6, 0, 5.8], barricade: [], mayLeave: false },
  { id: 'bravo', name: 'Bravo', rooms: ['shop'], rally: [17.6, 0, 20.9], barricade: [], mayLeave: false },
  { id: 'charlie', name: 'Charlie', rooms: ['comms'], rally: [29.4, 0, 6.0], barricade: [], mayLeave: false },
  { id: 'delta', name: 'Delta', rooms: ['store'], rally: [33.0, 0, 22.2], barricade: [], mayLeave: false },
];

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = BLOCK_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, rug, bin, cabinet, papers, wallArt, bench, shelf, ceilingPanel, doorFrame, lights, switchables } = K;
  /** a pallet of crates: a static block a man can kneel behind (1.0 m) */
  function pallet(x: number, z: number, w: number, d: number, yaw = 0) {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], yaw, albedo: C.woodDark });
    add({ c: [x, 0.56, z], h: [w / 2 - 0.04, 0.44, d / 2 - 0.04], yaw, albedo: C.cardboard, ...mk(MD.cartonMarks([w / 2 - 0.04, 0.44, d / 2 - 0.04], TX)) });
  }
  /** a steel locker, 2 m: doors on both faces */
  const locker = (x: number, z: number, alongX: boolean) => { const h: Vec3 = alongX ? [0.49, 1.0, 0.3] : [0.3, 1.0, 0.49];
    add({ c: [x, 1.0, z], h, albedo: [0.33, 0.36, 0.38], rough: 0.5, ...mk(alongX ? [...MD.cupboardMarks(h, '+z', 2, TX), ...MD.cupboardMarks(h, '-z', 2, TX)] : [...MD.cupboardMarks(h, '+x', 2, TX), ...MD.cupboardMarks(h, '-x', 2, TX)]) }); };
  /** a table (0.75 m) with nothing under it but two legs */
  const table = (x: number, z: number) => { add({ c: [x, 0.72, z], h: [0.8, 0.03, 0.4], albedo: C.white }); for (const sx of [-0.6, 0.6]) add({ c: [x + sx, 0.35, z], h: [0.04, 0.35, 0.3], albedo: C.metal }); };

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  slab(0, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });
  slab(0, 0, 3.2, 3.2, 0.01, 28, C.grass, { flags: BoxFlag.NoShadow });
  grp('floors');
  const floor = (x0: number, z0: number, x1: number, z1: number, alb: Vec3, extra: Partial<Box> = {}) => slab(x0, 0, z0, x1, 0.004, z1, alb, extra);
  const polished = { flags: BoxFlag.Gloss };
  slab(4, -0.1, 4, 36, 0.001, 24, C.carpet);                    // whole interior base (thin top at y=0)
  floor(4, 4, 11, 24, C.stone, polished);                      // the loading hall
  floor(11, 12, 36, 15.26, C.lino, polished);                  // the hall
  floor(11, 4, 20.4, 12, C.lino, polished);                    // the mess and its kitchen
  floor(20.4, 4, 26.6, 12, [0.31, 0.31, 0.33], { rough: 0.6 });  // the battery room's screed
  floor(26.6, 4, 36, 12, [0.2, 0.21, 0.24], { rough: 0.35 });  // the comms room's and the frame room's raised floor
  // (the south band keeps the carpet base)

  grp('ceiling');
  slab(3.9, H, 3.9, 36.1, H + 0.2, 24.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // exterior walls (t=0.24): windows on the south and west walls only, sills at 0.9 m (the moon stands south-west)
  grp('walls.exterior');
  const ext = C.concrete;
  wallX(24, 3.88, 36.12, 0.24, ext, [
    { a: 5.5, b: 9.5, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' },                                             // staging
    { a: 14.9, b: 16.7, y0: 0.9, y1: 2.4, mullions: 1, glass: 'whole' }, { a: 28, b: 32, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' },   // the tool crib (the workshop itself has no window: with the mains out it is black); the store, across its turn
  ]);
  wallX(4, 3.88, 36.12, 0.24, ext);                                                                              // north: blind
  wallZ(4, 4, 24, 0.24, ext, [{ a: 10.5, b: 11.7, y0: 0, y1: 2.2 }, { a: 16.5, b: 19.5, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }]);
  // the west stairwell's landing outside that door (officeGen.ts's, box for box: game/qrf.ts QRF_MARKS stands a team in it)
  slab(1.34, 0, 9.57, 3.88, 0.02, 12.63, C.concrete);
  wallX(9.45, 1.1, 3.88, 0.24, ext); wallX(12.75, 1.1, 3.88, 0.24, ext); wallZ(1.22, 9.57, 12.63, 0.24, ext);
  slab(1.1, H, 9.33, 3.88, H + 0.2, 12.87, C.ceiling, { flags: BoxFlag.NoPrimary });
  wallZ(36, 4, 24, 0.24, ext, [{ a: 13, b: 14.2, y0: 0, y1: 2.2 }]);                                            // east: the fire exit at the hall's far end

  // ---------------- interior partitions (t=0.12), all solid ----------------
  grp('walls.interior');
  const iw = C.wall;
  // (every doorway is cut 0.2 m before a whole metre and 1.2 m wide: scene/doorSize.ts hangs the real door in it on a walk-grid cell)
  // the loading hall | everything else, x=11: the hall's mouth open wall to wall, the tool crib's door (crib_to_loading, z 20.8..22.0)
  wallZ(11, 4.12, 23.88, 0.12, iw, [{ a: 12.06, b: 15.2, y0: 0, y1: 2.6 }, { a: 20.8, b: 22.0 }]);
  // the hall's north wall z=12: the mess (m_s), the kitchen (kitchen_to_hall), the battery room (battery_to_hall), the frame room (frame_to_hall), the comms room (b_s)
  wallX(12, 11.06, 35.88, 0.12, iw, [{ a: 12.8, b: 14.0 }, { a: 16.8, b: 18.0 }, { a: 23.8, b: 25.0 }, { a: 29.8, b: 31.0 }, { a: 32.8, b: 34.0 }]);
  // the hall's south wall z=15.26: the workshop (w_n), the switch room (switch_to_hall), the store (s_n), the jointers' room (jointers_to_hall)
  wallX(15.26, 11.06, 35.88, 0.12, iw, [{ a: 13.8, b: 15.0 }, { a: 21.8, b: 23.0 }, { a: 27.8, b: 29.0 }, { a: 34.4, b: 35.6 }]);
  // NORTH BAND. The mess's L round the kitchen: the kitchen's west wall, its north wall with the mess's heel door (m_k)
  wallZ(14.4, 7.34, 11.94, 0.12, iw);
  wallX(7.4, 14.34, 20.46, 0.12, iw, [{ a: 17.8, b: 19.0 }]);
  wallZ(20.4, 4.12, 11.94, 0.12, iw);                                      // mess + kitchen | battery room
  wallZ(26.6, 4.12, 11.94, 0.12, iw);                                      // battery room | comms + frame room
  // the comms room's L round the frame room: the frame room's north wall with the heel door (b_f), its east wall
  wallX(7.4, 26.54, 32.26, 0.12, iw, [{ a: 27.8, b: 29.0 }]);
  wallZ(32.2, 7.34, 11.94, 0.12, iw);
  // SOUTH BAND. The workshop's L round the tool crib: the crib's north wall, its east wall with the heel door (w_c)
  wallX(18.6, 11.06, 18.3, 0.12, iw);                                      // (it runs 1.3 m on past the crib's corner: the turn is a 2.1 m mouth, and most of the far leg is out of the near leg's sight)
  wallZ(17.0, 18.54, 23.88, 0.12, iw, [{ a: 21.8, b: 23.0 }]);
  wallZ(20.4, 15.32, 23.88, 0.12, iw);                                     // workshop | switch room
  wallZ(27.2, 15.32, 23.88, 0.12, iw);                                     // switch room | store
  // the store's L round the jointers' room: that room's west wall, its south wall with the heel door (s_j)
  wallZ(30.8, 15.32, 20.46, 0.12, iw);
  wallX(20.4, 30.74, 35.88, 0.12, iw, [{ a: 33.8, b: 35.0 }]);

  // ---------------- staging (x 4..11): where the team forms up ----------------
  grp('staging');
  bench(5.0, 6.2, Math.PI / 2); bench(5.0, 8.4, Math.PI / 2);
  shelf(7.4, 4.5, 2.6, 0.5, 0, 4, 2.0);
  // THINGS TO WRECK (tools/qa/loudchaos-probes.ts loudLevels: a loud level carries twenty dressing boxes and six sheets of paper): a second bay of racking in
  // the dead corner by the first, for the dressing's binders, and delivery notes left on the two benches. The rooms' own tables are lived things, which the
  // dressing does not see.
  shelf(9.75, 4.5, 2.0, 0.5, 0, 4, 2.0);
  papers(5.0, 0.45, 6.0, 0.1); papers(5.0, 0.45, 8.7, -0.15);
  pallet(5.3, 22.6, 1.2, 1.0); cardboardBox(6.6, 22.9, 0.55, 0.2); cardboardBox(7.2, 23.1, 0.45, -0.3);
  wallArt(10.925, 1.6, 17.4, 1.6, 0.9, [0.2, 0.35, 0.3], false);
  ceilingPanel(7.5, 8.5, false, 'staging'); ceilingPanel(7.5, 19.5, false, 'staging');
  add({ c: [4.14, 2.47, 11.1], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the stair door

  // ---------------- the hall (z 12..15.26): bare floor wall to wall ----------------
  grp('hall');
  ceilingPanel(15, 13.63, true, 'hall', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(22, 13.63, false, 'hall', false, 1.2, 0.3);
  ceilingPanel(29, 13.63, true, 'hall', true, 1.2, 0.3, [7, 6.8, 6.4]);
  add({ c: [35.86, 2.47, 13.6], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the fire exit
  rug(23.5, 13.63, 23.0, 0.9, [0.26, 0.27, 0.22]);

  // ---------------- the mess (an L: near leg x 11..14.4 × z 4..12, far leg x 14.4..20.4 × z 4..7.4) ----------------
  // m_s from the hall into the near leg; m_k from the kitchen into the far leg. The lamp is over the near leg; the far leg's is out; the kitchen's is ON (every
  // notch room's is: the way round by the heel door is a lit, empty room to anyone who opens its door).
  grp('mess');
  locker(14.0, 8.4, false); locker(14.0, 9.4, false);                                                  // the gang's lockers on the near leg's east wall
  add({ c: [11.08, 1.3, 9.2], h: [0.02, 0.4, 0.6], albedo: [0.2, 0.35, 0.3] });                         // notice board
  ceilingPanel(12.7, 9.0, true, 'mess', false, 1.2, 0.6, [8, 7.6, 6.9]); ceilingPanel(17.4, 5.7, false, 'mess');
  grp('kitchen');
  add({ c: [15.0, 1.0, 11.5], h: [0.45, 1.0, 0.4], albedo: [0.75, 0.75, 0.74] });                       // fridge
  ceilingPanel(17.4, 9.7, true, 'kitchen');
  grp('battery');
  ceilingPanel(23.5, 9.6, true, 'battery', false, 1.2, 0.6, [4.5, 6.0, 9.0]);

  // ---------------- the comms room (an L: near leg x 32.2..36 × z 4..12, far leg x 26.6..32.2 × z 4..7.4) ----------------
  // b_s from the hall into the near leg (the racks at its north end, by the turn); b_f from the frame room into the far leg.
  grp('comms');
  const DRIVE_RACK = 1; let rackFront: Vec3 = [33.75, 1.1, 5.28];
  for (let i = 0; i < 4; i++) {
    const x = 33.0 + i * 0.75, z = 4.75;
    const slots: { u: number; y: number; amber: boolean }[] = [];
    for (let u = 0; u < 10; u++) { if (((u * 7 + i * 3) % 5) > 1) continue; slots.push({ u, y: 0.32 + u * 0.178, amber: (u + i) % 7 === 3 }); }
    const rackBody = add({ c: [x, 1.05, z], h: [0.33, 1.05, 0.5], albedo: [0.06, 0.06, 0.07], rough: 0.3, ...mk(MD.rackMarks([0.33, 1.05, 0.5], slots.map(sl => ({ v: sl.y - 1.05, amber: sl.amber })), TX)) });
    if (i === DRIVE_RACK) rackFront = [x, 1.1, z + 0.53];
    let lo = 10, hi = -10; for (const sl of slots) { lo = Math.min(lo, sl.y); hi = Math.max(hi, sl.y); }
    if (slots.length) {
      switchables.push({ name: `rack${i}_leds`, boxes: [rackBody], group: 'server_leds', on: true, baseEmissive: [0, 0, 0], flicker: i % 3 === 0, mains: false });
      const strip = add({ c: [x - 0.222, (lo + hi) / 2, z + 0.506], h: [0.03, (hi - lo) / 2 + 0.06, 0.003], albedo: C.black, emissive: [0.2, 1.9, 0.45], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
      switchables.push({ name: `rack${i}_glow`, boxes: [strip], group: 'server_glow', on: true, baseEmissive: [0.2, 1.9, 0.45], flicker: i % 3 === 0, mains: false });
    }
  }
  cabinet(35.55, 8.4, -Math.PI / 2); cabinet(35.55, 9.0, -Math.PI / 2);
  // THE MAINS INTAKE: the breaker is in the LOADING HALL, on the wall beside the hall's mouth (the loading hall's face of the mess's west wall), four metres
  // from where the team forms up and in nobody's sight: the floor's lamps can be put out before the first door is touched
  grp('staging');
  const brk = add({ c: [10.9, 1.35, 10.0], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [10.85, 1.62, 9.82], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [10.9, 2.3, 10.0], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });
  grp('comms');
  ceilingPanel(34.0, 8.6, true, 'comms', false, 1.2, 0.6, [4.5, 6.0, 9.0]); ceilingPanel(29.4, 5.7, false, 'comms');
  grp('frame');
  ceilingPanel(29.4, 9.7, true, 'frame');

  // ---------------- the workshop (an L: near leg x 11..20.4 × z 15.3..18.6, far leg x 17..20.4 × z 18.6..24) ----------------
  // w_n from the hall into the near leg; w_c from the tool crib into the far leg.
  grp('shop');
  bin(19.9, 15.8);
  ceilingPanel(15.0, 16.9, true, 'shop'); ceilingPanel(18.7, 21.2, false, 'shop');
  grp('crib');
  shelf(14.0, 19.0, 2.6, 0.5, 0, 4, 2.0);                                                              // racking on the crib's north wall
  ceilingPanel(14.0, 21.4, true, 'crib');
  grp('switchroom');
  ceilingPanel(24.7, 16.6, true, 'switchroom', true, 1.2, 0.6, [5, 6, 5]);

  // ---------------- the store (an L: near leg x 27.2..30.8 × z 15.3..24, far leg x 30.8..36 × z 20.4..24) ----------------
  // s_n from the hall into the near leg; s_j from the jointers' room into the far leg.
  grp('store');
  shelf(33.1, 23.55, 1.8, 0.5, 0, 4, 2.0);                                                             // racking on the far leg's south wall
  ceilingPanel(29.0, 18.0, true, 'store', true); ceilingPanel(33.3, 22.2, false, 'store');
  grp('jointers');
  ceilingPanel(33.4, 17.8, true, 'jointers');

  // ---------------- exterior ----------------
  grp('exterior.lamps');
  /** `top`: the post's height (the street's own: 5.2 m) · `lean`: how far the beam leans out from straight down (0.35: a street lamp's pool on the road) */
  const lampAt = (x: number, z: number, name: string, dir: Vec3, on = true, top = 5.2, lean = 0.35) => {
    const yawL = Math.atan2(dir[0], dir[2]), r2 = (v: number) => Math.round(v * 100) / 100;
    add({ c: [x, r2(top / 2), z], h: [0.06, r2(top / 2), 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, r2(top + 0.04), z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    add({ c: [x + dir[0] * 0.55, r2(top + 0.02), z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, albedo: [0.16, 0.17, 0.18] });
    const head = add({ c: [x + dir[0] * 0.55, r2(top - 0.05), z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: on ? [40, 24, 7] : [0, 0, 0], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, r2(top - 0.15), z + dir[2] * 0.55], dir: [dir[0] * lean, -1, dir[2] * lean], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name, group: 'exterior', enabled: on, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true });
  };
  // THE STORE'S LAMP: a yard lamp on a short post before the store's window (x 28‥32, head at 2.4 m), leaning in. A 5.2 m street lamp 2.5 m off the wall throws
  // through that window onto the FLOOR and a man's shins and no higher (the window's head cuts it: read on the headless meter, chest and head dark past 0.8 m
  // in); from 3.25 m it lights a standing man across the turn and the west half of the far leg — and not the store's own two, who stand east of its throw.
  lampAt(29.5, 27.0, 'street_lamp_s', [0, 0, -1], true, 3.4, 0.8);
  lampAt(38.8, 13.6, 'street_lamp_e', [-1, 0, 0]);
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(18.0, 13.2); beacon(30.0, 13.2); beacon(7.5, 14.0);
  // one in every held room's FAR leg, clear of both its men (a beacon is a beam tilted 27° down that turns about the vertical, game.ts: it lights nothing within
  // a metre of its own foot — the store's stood over its B man and never lit him). With the mains out it sweeps the far leg and on out through the turn; the
  // near leg is black down its length but not at the turn (the head comment has the readings)
  beacon(18.4, 5.0); beacon(28.4, 5.0); beacon(19.4, 20.2); beacon(33.2, 21.4);

  // THE IDS: a held room's two doors keep their shorthand (the structure lists them, so game/doornames.ts says them as the rooms they join: 'hall-side mess
  // door'). Every other door's id is SAID as it stands (orders.ts doorIdWords: 'kitchen to hall door'), so it is the two places it joins and carries no compass
  // letter. (doornames.ts shorthandId counts the 'to' as shorthand; the structure lists none of these doors, so nothing renames them.)
  const doorDefs: LevelDoorDef[] = [
    { name: 'm_s', hinge: [12.82, 12.0], closedDir: 0, width: 1.16 },                       // hall → the mess (its near leg)
    { name: 'kitchen_to_hall', hinge: [16.82, 12.0], closedDir: 0, width: 1.16, swing: 1 },               // hall → the kitchen
    { name: 'battery_to_hall', hinge: [23.82, 12.0], closedDir: 0, width: 1.16 },                      // hall → the battery room
    { name: 'frame_to_hall', hinge: [29.82, 12.0], closedDir: 0, width: 1.16, swing: 1 },               // hall → the frame room
    { name: 'b_s', hinge: [32.82, 12.0], closedDir: 0, width: 1.16 },                       // hall → the comms room (its near leg)
    { name: 'w_n', hinge: [13.82, 15.26], closedDir: 0, width: 1.16 },                      // hall → the workshop (its near leg)
    { name: 'switch_to_hall', hinge: [21.82, 15.26], closedDir: 0, width: 1.16 },                     // hall → the switch room
    { name: 's_n', hinge: [27.82, 15.26], closedDir: 0, width: 1.16 },                      // hall → the store (its near leg)
    { name: 'jointers_to_hall', hinge: [34.42, 15.26], closedDir: 0, width: 1.16, swing: -1 },              // hall → the jointers' room
    // THE HEEL DOORS: each opens OUT of its held room into the notch room, so no wedge holds it and no boot opens it — the room always has a second way in
    // (tools/qa/second-way-check.ts), and it is a pull for the team. The held rooms' hall doors stay theirs to wedge. The notch rooms' own doors open OUT of them
    // (to the hall, to the loading hall) for the same reason: a held room's rectangle covers its notch room, so that check takes the notch room for manned too.
    { name: 'm_k', hinge: [17.82, 7.4], closedDir: 0, width: 1.16, swing: 1 } ,              // the kitchen → the mess's far leg
    { name: 'b_f', hinge: [27.82, 7.4], closedDir: 0, width: 1.16, swing: 1 } ,              // the frame room → the comms room's far leg
    { name: 'w_c', hinge: [17.0, 21.82], closedDir: Math.PI / 2, width: 1.16, swing: 1 },   // the tool crib → the workshop's far leg
    { name: 's_j', hinge: [33.82, 20.4], closedDir: 0, width: 1.16, swing: -1 },            // the jointers' room → the store's far leg
    { name: 'crib_to_loading', hinge: [11.0, 20.82], closedDir: Math.PI / 2, width: 1.16, swing: 1 },        // the loading hall → the tool crib (the second start is on it)
    { name: 'fire_exit', hinge: [36.0, 13.02], closedDir: Math.PI / 2, width: 1.16, exterior: true },
    { name: 'stairwell', hinge: [4.0, 10.52], closedDir: Math.PI / 2, width: 1.16, exterior: true, locked: true, lock: 'stairwell', keySide: -1, steel: true },
  ];
  for (const d of doorDefs) doorFrame(d);

  // ---------------- LIVED IN (src/scene/lived.ts: every box below is in group lived.<room>, every prop lived.<room>.<thing>; nothing above this line changed)
  // A district telephone exchange. One family: octagon drums, ladders, grids of cells, coloured cords. Safety yellow is the loading hall's alone.
  {
    const P = livedPieces({ add: K.add, grp: K.grp, prop: K.prop }, C as unknown as Parameters<typeof livedPieces>[1]), A = P.at(0, 0, 0), Q = Math.PI / 4;
    const oct = (x: number, y0: number, z: number, s: number, h: number, col: Vec3) => { A.box(x, y0, z, s, h, s, col); A.box(x, y0, z, s, h - 0.004, s, col, Q); };   // (the turned square a hair lower: no two faces in one plane)
    const octParts = (y0: number, s: number, h: number, col: Vec3) => [P.part(0, y0, 0, s, h, s, col), P.part(0, y0, 0, s, h - 0.004, s, col, Q)];
    // a LARGER round (0.4 m across and more) as a true octagon: four slabs through the centre, 45° apart, each as long as the round and tan 22.5° as wide — two
    // turned squares that size read as a cog from above
    const T8 = Math.tan(Math.PI / 8);
    const oct8 = (x: number, y0: number, z: number, s: number, h: number, col: Vec3) => { for (let i = 0; i < 4; i++) A.box(x, y0, z, s, h - i * 0.003, s * T8, col, i * Q); };
    const oct8Parts = (y0: number, s: number, h: number, col: Vec3) => [0, 1, 2, 3].map(i => P.part(0, y0, 0, s, h - i * 0.003, s * T8, col, i * Q));
    /** a cable drum lying flat: two flanges, the cable between them, the hub's hole on top */
    const drumFlat = (x: number, z: number, r: number, h: number, flange: Vec3, cable: Vec3) => { const s = r * 1.85;
      oct8(x, 0, z, s, 0.06, flange); oct(x, 0.06, z, s * 0.7, h - 0.12, cable); oct8(x, h - 0.06, z, s, 0.06, flange);
      A.box(x, h, z, 0.2, 0.03, 0.2, INK.iron); };
    /** a small drum a man can roll to a door */
    const drumLoose = (x: number, z: number, flange: Vec3, cable: Vec3) => {
      return P.loose('drum', 'cardboard', x, z, h01(Math.round(x * 7 + z), 3), 18, [...oct8Parts(0, 0.62, 0.05, flange), ...octParts(0.05, 0.43, 0.4, cable), ...oct8Parts(0.45, 0.62, 0.05, flange), P.part(0, 0.5, 0, 0.14, 0.02, 0.14, INK.iron)], [0.33, 0.33]); };

    // LOADING HALL: the big drum by the west wall, the long ladder on its brackets, the gang's yellow hats, the duckboard by the benches, the pallet truck
    P.room('staging');
    P.floor(7.53, 14.0, 6.78, 19.7, [0.33, 0.22, 0.18], 0.003, 0.006);   // red-oxide floor paint wall to wall: the loading hall's own
    // the big drum UPRIGHT on its jacks, ready to pay out (the store's drums lie flat): two flanges on edge, the cable between them, the spindle through, yellow jacks
    for (const dz of [-0.46, 0.46]) { A.box(4.95, 0.12, 14.6 + dz, 1.5, 1.5, 0.08, C.wood); A.box(4.95, 0, 14.6 + dz * 1.5, 0.9, 0.9, 0.07, INK.yellow); }
    A.box(4.95, 0.37, 14.6, 1.0, 1.0, 0.84, C.black); A.box(4.95, 0.84, 14.6, 0.07, 0.07, 1.6, INK.iron);
    A.box(5.05, 1.372, 14.55, 0.24, 0.02, 0.32, INK.manila, 0.3); A.box(5.05, 1.392, 14.57, 0.18, 0.012, 0.24, INK.paper, 0.3);   // the delivery board left on it
    oct(4.6, 0, 13.25, 0.3, 0.1, INK.canvas);   // a coil of draw rope
    // yellow bay lines: the drum's bay, the truck's bay
    for (const z of [13.55, 15.65]) P.floor(5.15, z, 2.0, 0.09, INK.yellow, 0.014, 0.012);
    P.floor(6.15, 14.6, 0.09, 2.1, INK.yellow, 0.014, 0.012);
    for (const z of [22.45, 23.55]) P.floor(8.5, z, 2.0, 0.09, INK.yellow, 0.014, 0.012);
    for (const x of [7.5, 9.5]) P.floor(x, 23.0, 0.09, 1.1, INK.yellow, 0.014, 0.012);
    for (const x of [10.56, 10.86]) A.box(x, 0.5, 17.6, 0.05, 0.06, 3.6, C.wood);   // the long ladder, lying on brackets along the partition
    for (let i = 0; i < 8; i++) A.box(10.71, 0.51, 16.0 + i * 0.457, 0.3, 0.03, 0.04, C.wood);
    for (const z of [16.4, 18.8]) A.box(10.72, 0, z, 0.42, 0.5, 0.08, C.metal);
    A.box(4.16, 1.3, 7.34, 0.06, 0.04, 2.0, C.woodDark);
    for (let i = 0; i < 5; i++) A.box(4.27, 1.34, 6.5 + i * 0.42, 0.26, 0.11, 0.22, INK.yellow);   // five yellow hard hats on their pegs
    for (let i = 0; i < 4; i++) P.floor(5.5 + i * 0.22, 7.25, 0.14, 3.2, [0.5, 0.4, 0.25]);   // the duckboard the gang stamps its boots on
    for (const z of [6.0, 8.5]) P.floor(5.83, z, 0.84, 0.1, [0.4, 0.31, 0.19], 0.014, 0.009);
    P.loose('truck', 'cardboard', 8.5, 23.0, 0, 25, [P.part(-0.2, 0, 0.2, 1.0, 0.08, 0.16, INK.yellow), P.part(-0.2, 0, -0.2, 1.0, 0.08, 0.16, INK.yellow), P.part(0.45, 0, 0, 0.3, 0.45, 0.5, INK.yellow), P.part(0.62, 0, 0, 0.06, 1.0, 0.06, INK.iron), P.part(0.62, 1.0, 0, 0.06, 0.04, 0.3, INK.iron)], [0.7, 0.3]);
    drumLoose(5.0, 16.1, C.wood, C.black);

    // THE HALL stays bare: the fire point on the north wall, the cleaner's bucket, the time clock. Nothing else.
    P.room('hall');
    A.face(27.4, 0.8, 12.075, 0.8, 0.7, C.red);
    for (const x of [27.22, 27.58]) A.box(x, 0.95, 12.2, 0.24, 0.26, 0.24, C.red);
    P.bucket(20.4, 12.4, C.metal, 'mop');
    // the trunk's trench: chequer plates down the hall's north side, an orange edge either side
    for (let i = 0; i < 7; i++) P.floor(13.9 + i * 2.96, 12.62, 2.9, 0.56, i % 2 ? [0.3, 0.31, 0.33] : [0.24, 0.25, 0.27], 0.004, 0.006);
    for (const z of [12.3, 12.94]) P.floor(22.8, z, 20.8, 0.07, INK.hivis, 0.004, 0.012);
    { const L = P.at(25.2, 15.02, Math.PI);   // the time clock and the gang's cards, on the south wall between the switch room's door and the store's
      L.box(-0.62, 0, 0, 0.4, 1.5, 0.3, C.woodDark); L.box(-0.62, 1.5, 0, 0.26, 0.012, 0.2, INK.cream); L.box(-0.62, 1.512, 0.02, 0.03, 0.006, 0.12, C.black);
      L.box(0.22, 0, 0.02, 1.1, 1.0, 0.34, C.wood);
      for (let i = 0; i < 14; i++) L.box(-0.2 + (i % 7) * 0.14, 1.0, -0.06 + Math.floor(i / 7) * 0.17, 0.09, 0.03, 0.13, h01(i, 41) < 0.3 ? INK.cream : INK.manila); }

    // LINEMEN'S MESS: the table under red oilcloth in the near leg's far corner, beside the coats over their boots; round the turn the tea counter and its urn.
    // WHERE THE TABLE MAY STAND (nav cells are 0.5 m and a box blocks every cell within 0.3 m of it): not on the west wall south of z 7.5 — the cells
    // x 11.5‥12, z 8‥11.5 are where the third and fourth man of a stack on m_s from inside file up, and with the table there that order was refused 'no room
    // on that door' (tools/qa/lived-stack-check.ts); not within a cell of (11.7, 6.5), the squads file's third man; not under the first coat on the rail
    // (x 11.83‥12.11 at the north wall). So: z 4.5‥5.7 on the west wall.
    P.room('mess');
    P.floor(12.7, 8.03, 3.24, 7.78, [0.36, 0.42, 0.35], 0.004, 0.006); P.floor(17.35, 5.73, 5.94, 3.18, [0.36, 0.42, 0.35], 0.004, 0.006);   // sage lino, both legs
    { const tx = 11.75, tz = 5.1, T = P.at(tx, tz, 0);   // (everything on the table is placed from its centre)
      P.table(tx, tz, 0.8, 1.2, 0, C.wood, C.woodDark, 0.75);
      T.sheet(0, 0.752, 0, 0.74, 1.1, C.red);
      for (const dz of [-0.36, 0, 0.36]) T.sheet(0, 0.758, dz, 0.36, 0.3, C.white);
      for (let i = 0; i < 4; i++) T.box(-0.05 + (h01(i, 11) - 0.5) * 0.12, 0.765, -0.3 + i * 0.14, 0.05, 0.02, 0.1, INK.iron, (h01(i, 12) - 0.5) * 1.4);   // a game of dominoes left standing
      T.box(-0.05, 0.765, 0.34, 0.28, 0.04, 0.4, C.metal); T.box(-0.05, 0.805, 0.34, 0.14, 0.1, 0.26, INK.manila);   // the bread tin
      P.loose('bench', 'cardboard', tx + 0.75, tz + 0.1, Math.PI / 2, 14, [P.part(0, 0.4, 0, 1.0, 0.05, 0.3, C.wood), P.part(-0.4, 0, 0, 0.06, 0.4, 0.26, C.woodDark), P.part(0.4, 0, 0, 0.06, 0.4, 0.26, C.woodDark)], [0.5, 0.15]); }
    P.hooks(12.6, 4.13, 0, 4, 1.6, [INK.hivis, INK.navy, INK.canvas, INK.navy], 0.42);   // the drying corner: wet coats over a row of boots
    P.boots(12.6, 4.45, 0, 2, 0.4);
    P.hat(14.0, 2.0, 8.4, 0.3, C.white); P.hat(14.0, 2.0, 9.5, -0.4, C.white);
    A.box(20.0, 0, 5.0, 0.6, 0.9, 1.6, C.white); A.box(20.0, 0.9, 5.0, 0.64, 0.03, 1.64, [0.2, 0.2, 0.22]);   // the tea counter at the far leg's end
    oct(20.0, 0.93, 4.6, 0.3, 0.42, INK.brass); A.box(20.0, 1.35, 4.6, 0.12, 0.05, 0.12, INK.iron);   // the tea urn
    P.mugs(20.0, 0.93, 5.15, Math.PI / 2, 3, [INK.bottle], 0.13);
    A.box(20.0, 0.93, 5.55, 0.36, 0.06, 0.3, INK.iron);   // a gas ring
    P.floor(19.1, 5.0, 0.9, 1.6, INK.rubber, 0.014, 0.009);   // the mat before it

    // THE KITCHEN (nobody's): the range, the sink, the door into the back of the mess
    P.room('kitchen');
    P.floor(17.4, 9.7, 5.8, 4.4, [0.5, 0.47, 0.4], 0.004, 0.006);   // quarry tile
    A.box(19.95, 0, 9.6, 0.7, 0.9, 1.6, INK.iron);   // the range on the east wall
    oct(19.95, 0.9, 9.2, 0.3, 0.25, C.metal); A.box(19.95, 0.9, 10.0, 0.34, 0.16, 0.34, INK.brass);
    A.box(14.8, 0, 9.4, 0.6, 0.9, 2.4, C.white); A.box(14.8, 0.9, 9.4, 0.64, 0.03, 2.44, C.metal);   // the sink and drainer on the west wall
    P.mugs(14.8, 0.93, 8.7, Math.PI / 2, 4, [C.white], 0.13);
    P.loose('gas', 'cardboard', 19.9, 11.4, 0, 12, [...octParts(0, 0.28, 0.6, C.red), P.part(0, 0.6, 0, 0.08, 0.1, 0.08, INK.brass)], [0.17, 0.17]);

    // THE BATTERY ROOM (nobody's): two banks of glass cells under copper bus bars, each on its blue acid-proof bund; the rectifier; a carboy of acid
    P.room('battery');
    for (const bz of [5.0, 7.2]) {
      P.floor(23.5, bz, 3.1, 1.0, [0.22, 0.42, 0.7], 0.004, 0.006);
      A.box(23.5, 0, bz, 2.6, 0.45, 0.5, C.wood);
      for (let i = 0; i < 5; i++) for (const dz of [-0.12, 0.12]) A.box(22.5 + i * 0.5, 0.45, bz + dz, 0.4, 0.25, 0.2, [0.55, 0.68, 0.6]);
      for (const dz of [-0.12, 0.12]) A.box(23.5, 0.7, bz + dz, 2.4, 0.02, 0.07, INK.copper); }
    oct(25.9, 0, 4.6, 0.3, 0.42, INK.bottle); A.box(25.9, 0.42, 4.6, 0.1, 0.08, 0.1, INK.rubber);
    A.box(26.2, 0, 9.0, 0.5, 1.8, 1.2, [0.33, 0.36, 0.38]);   // the rectifier

    // THE COMMS ROOM: the racks at the near leg's far end (6.5 m up the leg from its hall door); round the turn the cord switchboard with its two stools
    P.room('comms');
    A.box(28.2, 0, 4.27, 2.6, 1.5, 0.3, C.woodDark); A.box(28.2, 0, 4.72, 2.6, 0.76, 0.6, C.woodDark);   // the board: jack field and keyshelf
    A.box(28.2, 1.5, 4.27, 2.5, 0.02, 0.1, INK.brass); A.box(28.2, 0.76, 4.5, 2.5, 0.02, 0.1, INK.iron);   // lamp strip, jack strip
    { const cords: Vec3[] = [C.red, INK.baize, INK.cream];
      for (let i = 0; i < 6; i++) { const x = 27.15 + i * 0.42; A.box(x, 0.76, 4.72, 0.07, 0.02, 0.34, cords[i % 3]); if (i % 2 === 0) A.box(x, 0.76, 4.94, 0.07, 0.05, 0.07, INK.brass); A.box(x + 0.19, 1.52, 4.27, 0.1, 0.02, 0.1, i % 3 ? INK.cream : C.red); } }
    A.box(27.3, 0.78, 4.85, 0.2, 0.04, 0.14, INK.iron); A.box(29.2, 0.78, 4.85, 0.3, 0.03, 0.2, INK.oxblood);   // a headset, the log book
    P.floor(28.2, 5.35, 2.6, 0.8, INK.oxblood);   // the operators' maroon mat
    P.stool(27.6, 5.3); P.stool(28.8, 5.3);
    P.trolley(35.4, 10.3, Math.PI / 2, [INK.copper, INK.iron, INK.cream]);

    // THE FRAME ROOM (nobody's): the distribution frame's ladder of uprights down the east wall, the test desk
    P.room('frame');
    for (let i = 0; i < 6; i++) A.box(31.85, 0, 8.0 + i * 0.52, 0.36, 1.9, 0.06, INK.iron);
    for (const x of [31.71, 31.99]) A.box(x, 1.9, 9.3, 0.05, 0.04, 2.7, INK.iron);
    { const wires: Vec3[] = [INK.hivis, C.red, INK.blueprint]; for (let k = 0; k < 3; k++) A.box(31.78 + k * 0.07, 1.3 + k * 0.2, 9.3, 0.03, 0.02, 2.6, wires[k]); }
    for (let i = 0; i < 3; i++) A.box(31.83, 0.7, 8.26 + i * 1.04, 0.2, 0.5, 0.4, INK.cream);   // terminal blocks
    P.table(27.1, 9.8, 0.7, 1.6, 0, C.wood, C.woodDark, 0.75);
    P.phone(27.1, 0.76, 9.4, 0.3, INK.iron); A.box(27.1, 0.76, 10.1, 0.3, 0.03, 0.4, INK.manila);
    P.stool(27.9, 9.8);

    // REPAIR SHOP: six telephones in a row on the bench, a crossarm of white insulators on two sawhorses; round the turn, bare floor
    P.room('shop');
    P.floor(15.7, 16.93, 9.24, 3.18, [0.37, 0.3, 0.21], 0.004, 0.006); P.floor(18.7, 21.2, 3.24, 5.3, [0.37, 0.3, 0.21], 0.004, 0.006);   // wood-block floor, both legs
    P.counter(18.0, 15.72, 2.8, 0.7, 0, 0.9, C.woodDark, C.wood);
    A.sheet(18.35, 0.903, 15.7, 2.0, 0.5, INK.baize);
    { const sets: Vec3[] = [INK.iron, INK.cream, C.red, INK.bottle, INK.cream, INK.iron]; for (let i = 0; i < 6; i++) P.phone(17.6 + i * 0.3, 0.91, 15.7, (h01(i, 21) - 0.5) * 0.5, sets[i]); }
    A.box(16.82, 0.9, 15.95, 0.16, 0.14, 0.12, INK.iron); A.box(16.82, 1.04, 15.95, 0.06, 0.03, 0.2, C.metal);   // the vise
    A.box(17.0, 0.9, 15.6, 0.4, 0.03, 0.26, C.metal); for (let i = 0; i < 3; i++) A.box(16.88 + i * 0.12, 0.93, 15.6 + (i % 2) * 0.06 - 0.03, 0.09, 0.02, 0.09, INK.brass, 0.4 * i);   // a tray of dials
    { const L = P.at(13.0, 17.9, 0.04);
      for (const lx of [-0.75, 0.75]) { L.box(lx, 0.6, 0, 0.08, 0.06, 0.7, C.wood); L.box(lx, 0, -0.3, 0.06, 0.6, 0.06, C.wood); L.box(lx, 0, 0.3, 0.06, 0.6, 0.06, C.wood); }
      L.box(0, 0.66, 0, 2.2, 0.1, 0.1, C.woodDark);
      for (let i = 0; i < 6; i++) L.box(-0.9 + i * 0.36, 0.76, 0, 0.09, 0.12, 0.09, C.white); }
    P.floor(13.0, 17.9, 2.6, 1.2, [0.5, 0.42, 0.28], 0.04);
    A.box(11.2, 1.2, 17.2, 0.25, 0.04, 1.2, C.wood);   // the spool shelf
    { const wire: Vec3[] = [INK.copper, C.red, INK.blueprint, INK.cream, INK.baize]; for (let i = 0; i < 5; i++) oct(11.2, 1.24, 16.75 + i * 0.23, 0.16, 0.14, wire[i]); }
    P.loose('toolchest', 'cardboard', 19.8, 16.9, 0, 20, [P.part(0, 0, 0, 0.6, 0.7, 0.4, C.red), P.part(0, 0.7, 0, 0.62, 0.04, 0.42, P.tone(C.red, 0.7))], [0.31, 0.21]);
    P.stool(18.0, 16.65);

    // THE TOOL CRIB (nobody's): the drawer chest, climbing irons and rope, the door into the back of the workshop
    P.room('crib');
    A.box(13.4, 0, 23.55, 2.0, 0.9, 0.5, C.red); A.box(13.4, 0.9, 23.55, 2.04, 0.03, 0.54, P.tone(C.red, 0.7));
    A.face(13.4, 1.1, 23.86, 2.4, 0.9, C.woodDark);   // the shadow board
    for (let i = 0; i < 5; i++) A.box(12.5 + i * 0.45, 1.2 + (i % 2) * 0.2, 23.82, 0.08, 0.4, 0.03, i % 2 ? C.metal : INK.iron);
    oct(15.9, 0, 19.5, 0.36, 0.14, INK.canvas);   // a coil of rope
    A.box(11.5, 0, 19.3, 0.3, 0.5, 0.5, INK.canvas);   // a kit bag

    // THE SWITCH ROOM (nobody's): three rows of selector racks, the supervisor's desk
    P.room('switchroom');
    P.floor(23.8, 19.6, 6.6, 8.5, [0.2, 0.24, 0.22], 0.004, 0.006);
    for (const rx of [21.6, 23.6, 25.6]) {
      for (let k = 0; k < 6; k++) A.box(rx, 0, 17.8 + k, 0.5, 2.0, 0.08, INK.iron);
      for (let k = 0; k < 5; k++) A.box(rx, 0.3, 18.3 + k, 0.44, 1.5, 0.84, k % 2 ? INK.cream : [0.62, 0.6, 0.5]);
      A.box(rx, 2.0, 20.3, 0.5, 0.04, 5.08, INK.iron); }
    P.table(26.6, 17.0, 0.8, 1.4, 0, C.wood, C.woodDark, 0.75);
    A.box(26.6, 0.76, 17.0, 0.3, 0.03, 0.4, INK.oxblood);

    // THE CABLE STORE: creosoted poles down the near leg's west wall, a drum lying flat; round the turn the racking and a crate of insulators
    P.room('store');
    P.floor(29.0, 19.6, 3.48, 8.5, [0.17, 0.16, 0.15], 0.004, 0.006); P.floor(33.31, 22.17, 5.14, 3.42, [0.17, 0.16, 0.15], 0.004, 0.006);   // oil-dark screed, both legs
    for (let i = 0; i < 3; i++) A.box(27.5 + i * 0.24, 0, 20.0 + (h01(i, 31) - 0.5) * 0.3, 0.2, 0.19, 5.0, i % 2 ? C.wood : C.woodDark);
    A.box(27.62, 0.19, 19.8, 0.2, 0.2, 4.4, C.wood); A.box(27.86, 0.19, 20.2, 0.2, 0.2, 4.6, C.woodDark);
    A.box(28.16, 0, 18.4, 0.14, 0.12, 0.14, C.wood); A.box(28.16, 0, 21.6, 0.14, 0.12, 0.14, C.wood);   // chocks
    for (const d of [-0.75, 0.75]) { P.floor(29.95, 18.3 + d, 1.5, 0.07, C.white, 0.014, 0.012); P.floor(29.95 + d, 18.3, 0.07, 1.5, C.white, 0.014, 0.012); }   // a painted stack bay
    drumFlat(29.95, 18.3, 0.6, 0.7, C.woodDark, C.metal);
    drumLoose(30.2, 16.3, C.woodDark, INK.blueprint);
    P.loose('insulators', 'cardboard', 35.5, 22.6, 0, 14, [P.part(0, 0, 0, 0.5, 0.4, 0.5, C.woodDark),
      ...[0, 1, 2, 3, 4, 5].map(i => P.part(-0.15 + (i % 3) * 0.15, 0.4, -0.09 + Math.floor(i / 3) * 0.18, 0.1, 0.08, 0.1, C.white))], [0.25, 0.25]);

    // THE JOINTERS' ROOM (nobody's): the bench with the lead pot and the blowlamp, the striped tent folded
    P.room('jointers');
    P.table(31.35, 17.8, 0.7, 2.4, 0, C.wood, C.woodDark, 0.85);
    oct(31.35, 0.86, 17.2, 0.26, 0.2, INK.iron); oct(31.35, 0.86, 18.0, 0.12, 0.22, INK.brass);
    A.box(31.35, 0.86, 18.6, 0.3, 0.05, 0.5, INK.canvas);
    A.box(31.4, 0, 19.7, 0.9, 0.3, 0.6, C.red); A.box(31.4, 0.3, 19.7, 0.3, 0.02, 0.6, C.white);

    // THE STREET: the jointers' striped tent over an open chamber, the linemen's grey van with a ladder on its roof, the pole the district's wires leave by.
    P.room('street');
    A.box(26.5, 0, 26.2, 2.0, 1.25, 1.9, C.red);   // the tent
    for (let i = 0; i < 3; i++) A.box(25.9 + i * 0.6, 1.25, 26.2, 0.3, 0.02, 1.9, C.white);
    for (let i = 0; i < 4; i++) P.floor(28.3, 25.5, 0.8, 0.8 * T8, [0.07, 0.07, 0.08], 0.014 + i * Q, 0.0098 + i * 0.0007);   // the lid drawn aside
    A.box(28.4, 0, 26.6, 1.3, 0.08, 0.08, C.white); A.box(28.4, 0.5, 26.6, 1.3, 0.14, 0.05, C.red); A.box(28.4, 0.64, 26.6, 0.4, 0.02, 0.05, C.white);   // a trestle barrier
    drumFlat(30.3, 26.4, 0.45, 0.6, C.wood, C.black);
    { const L = P.at(12.0, 26.4, 0);   // the van, nose to the west
      L.box(0.7, 0.3, 0, 2.9, 1.65, 1.85, C.metal); L.box(-1.45, 0.3, 0, 1.4, 1.15, 1.8, P.tone(C.metal, 0.8)); L.box(-0.85, 1.45, 0, 0.25, 0.4, 1.6, C.black);
      for (const [wx, wz] of [[-1.5, 0.85], [-1.5, -0.85], [1.4, 0.85], [1.4, -0.85]]) L.box(wx, 0, wz, 0.6, 0.6, 0.2, C.black);
      L.box(0.7, 1.95, 0.35, 2.6, 0.05, 0.05, C.wood); L.box(0.7, 1.95, 0.75, 2.6, 0.05, 0.05, C.wood);
      for (let i = 0; i < 6; i++) L.box(-0.4 + i * 0.44, 1.96, 0.55, 0.04, 0.03, 0.4, C.wood);
      L.box(0.7, 1.95, -0.45, 1.6, 0.12, 0.5, C.red); }   // (and the red jointing box beside the ladder)
    A.box(37.2, 0, 2.6, 0.24, 5.0, 0.24, C.woodDark);   // the pole
    A.box(37.2, 4.3, 2.6, 2.0, 0.1, 0.1, C.wood); A.box(37.2, 4.7, 2.6, 1.6, 0.1, 0.1, C.wood);
    for (let i = 0; i < 4; i++) A.box(36.35 + i * 0.57, 4.4, 2.6, 0.1, 0.1, 0.1, C.white);
    for (let i = 0; i < 3; i++) A.box(36.6 + i * 0.6, 4.8, 2.6, 0.1, 0.1, 0.1, C.white);
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices: [],
    breaker: { pos: [10.8, 1.35, 10.0], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [8.6, 0, 13.6],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    mission: { serverRoom: { x0: 32.26, x1: 35.88, z0: 4.12, z1: 11.94 }, entryDoor: 'b_s', rack: { index: DRIVE_RACK, front: rackFront, halfW: 0.33 }, exfilDoor: 'fire_exit', exfilX: 36.5, exfilZ: 13.6 },
  };


  // ---------------- what the room clear takes from this level ----------------
  // Eight defenders, two to a room (maxMen: the room clear's five lifted for this structure; with Sam and the four that is thirteen characters). A room has
  // EXACTLY TWO marks, so every deal of every visit (ROOMCLEAR.fresh deals the marks afresh) is the placement made by hand (the head comment): A at the far
  // leg's end on the turn, B in the far leg on the heel door. The squads file (blocksquads.ts) adds its third men's marks: the near leg's dead corner. A room's `bounds` is its L's bounding
  // box, the notch room included. Each room's first door is its hall door: the one a commander with no plan tries first. The eight are THREE SQUADS (BLOCK_SQUADS,
  // above): the squads file's, man for man less its third men.
  const scenarios: LevelScenarios = {
    roomClear: {
      name: 'the block', maxMen: 8,
      team: { sam: [8.6, 0, 13.9], samYaw: Math.PI / 2, ops: [[10.2, 0, 12.6], [9.4, 0, 12.6], [8.2, 0, 12.2], [7.4, 0, 12.2]], opsYaw: Math.PI / 2 },
      // the second way in (ROOMCLEAR.way): the south end of the loading hall, on the tool crib's door — the heel way into the workshop first, the hall behind
      starts: [{ sam: [7.8, 0, 18.4], samYaw: Math.PI / 2, ops: [[9.4, 0, 20.2], [8.6, 0, 20.2], [7.4, 0, 19.6], [6.6, 0, 19.6]], opsYaw: Math.PI / 2 }],
      rooms: [
        { id: 'mess', name: 'mess', bounds: { ...R.mess }, garrison: 2,
          doors: [{ id: 'm_s', from: 'hall' }, { id: 'm_k', from: 'kitchen' }],
          marks: [
            { pos: [19.2, 0, 6.6], watch: 'm_s', aimAt: [14.6, 1.1, 5.8] },         // A: the far leg's east end, on the turn
            { pos: [16.4, 0, 4.7], watch: 'm_k', aimAt: [18.4, 1.1, 7.3] },         // B: the far leg's north wall, on the heel door
          ] },
        { id: 'comms', name: 'comms room', bounds: { ...R.comms }, garrison: 2,
          doors: [{ id: 'b_s', from: 'hall' }, { id: 'b_f', from: 'frame room' }],
          marks: [
            { pos: [27.2, 0, 6.6], watch: 'b_s', aimAt: [32.0, 1.1, 5.8] },         // A: the far leg's west end, on the turn
            { pos: [30.3, 0, 4.7], watch: 'b_f', aimAt: [28.4, 1.1, 7.3] },         // B: the far leg's north wall, on the heel door
          ] },
        { id: 'shop', name: 'workshop', bounds: { ...R.shop }, garrison: 2,
          doors: [{ id: 'w_n', from: 'hall' }, { id: 'w_c', from: 'tool crib' }],
          marks: [
            { pos: [17.6, 0, 20.9], watch: 'w_n', aimAt: [18.7, 1.1, 18.9] },       // A: the far leg's west wall, on the turn
            { pos: [19.6, 0, 23.4], watch: 'w_c', aimAt: [17.1, 1.1, 22.4] },       // B: the far leg's far corner, on the heel door
          ] },
        { id: 'store', name: 'store', bounds: { ...R.store }, garrison: 2,
          doors: [{ id: 's_n', from: 'hall' }, { id: 's_j', from: 'jointers\' room' }],
          marks: [
            { pos: [35.4, 0, 21.2], watch: 's_n', aimAt: [31.1, 1.1, 22.2] },       // A: the far leg's east end, on the turn
            { pos: [34.6, 0, 23.3], watch: 's_j', aimAt: [34.4, 1.1, 20.5] },       // B: the far leg's south wall, on the heel door
          ] },
      ],
      squads: BLOCK_SQUADS_HOLD(),   // the eight hold their rooms: nobody walks out, no door is wedged
    },
  };
  // THE FLOOR NOBODY HOLDS, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it). The four notch rooms are not here: an
  // area may not overlap a room's rectangle, and a held room's rectangle is its L's bounding box.
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): both ways in show the block's own kitchen door off the hall —
  // indoors, under the hall's own lamps (no porch lamp, no fill: `roomLights` 1 is said outright, the door being the level's own), the stack on the hinge's side.
  { const way: KitViewWay = { door: 'kitchen_to_hall', side: -1, roomLights: 1, pane: false, light: { porch: { intensity: 0 }, fill: { intensity: 0 } } }; scenarios.kitView = { ways: [way, { ...way }] }; }
  scenarios.places = { areas: [{ name: 'staging area', bounds: { ...R.staging } }, { name: 'hall', bounds: { ...R.hall } },
    { name: 'battery room', bounds: { ...R.battery } }, { name: 'switch room', bounds: { ...R.switchroom } }] };
  return { level, scenarios, groups: trace.groups };
}
