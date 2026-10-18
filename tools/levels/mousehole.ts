// THE CLINIC — the level the mission 'Mousehole' is played on (levels/mousehole.json ← bun run tools/levels/export.ts mousehole). One idea: THE WALLS ARE THE
// WAY IN. A district clinic the size of a house: three small rooms in a row off ONE lit corridor, and at the corridor's end a duty room whose men look down its
// whole length through a glass hatch. Every held room's door opens off that corridor, so every stack on a door stands lit in the post's lane. The rooms share
// thin partitions and the building's north wall is blank and stands on a dark yard: the squad is issued wall charges for the run (scenarios.roomClear.wallCharges,
// game/issue.ts) and makes its own doors — the outer wall into the ward, then partition by partition down the row, into the duty room from its side, behind the
// guns that are on the corridor.
//   ward        1 man. Cots down the west wall, the nurse's table. The north wall (outside: the dark yard) is the first hole.
//   exam room   3 men, lit: the couch, the doctor's desk, a screen on its feet. Shares a partition with the ward and with the store.
//   store       2 men, dark: shelving down the middle, cartons, a chest-high steel cupboard (the stand-off for the last wall). Shares a partition with the duty room.
//   duty room   3 men, dark but for its screens: the desk behind the hatch, the radio racks, the breaker. Its door and its hatch are on the corridor's end; its
//               fire exit on the east side is steel, its lock on the INSIDE face: from the duty room it wants the key, from the east side it opens to a hand
//               (measured: a door charge is refused on steel, and the squad at the second start shoves it and goes in behind the hatch guns).
//   corridor    18 × 3.8 m, lit end to end, the front door off the porch at its west end: three room doors on its north side, the post's door and hatch across its east end.
// Built ONLY from the old demo's kit (scene/levelKit.ts). The building stands inside the rectangle the office's building stood in (x 4‥36, z 4‥24), so the
// constants that still assume that footprint (weather's INTERIOR) treat it as indoors; what is underfoot is the file's own `surfaces` block (the end of build()).
// Plan, +x east, +z south, metres:
//
//               the team forms up here, in the dark north yard
//          x=9          x=15         x=21         x=27         x=33
//   z=7    +============+============+============+============+      = blank outer wall (takes a charge)
//          |   WARD     :   EXAM     :   STORE    :            |      : partition (takes a charge)
//          |            :   (lit)    :            :   DUTY     |
//          |            :            :            :   ROOM     |
//   z=15   +----dW------+----dE------+----dS------+            |
//    porch     CORRIDOR, lit: the post's lane              g   |      g = the hatch (glass), dP = the post's door
//   z=19   +---WWW----------WWW------------------+dP-----------+
//               the south lot: a street lamp on the porch, a parked car
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag } from '../../src/scene/boxes';
import type { Level } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import * as K from '../../src/scene/levelKit';

export const NAME = 'mousehole';
export const NOTES = 'The clinic: the level of the mission Mousehole. Three rooms and a duty room off one lit corridor the duty room covers; blank outer wall and thin partitions for wall charges. Kit pieces only. Regenerate: bun run tools/levels/export.ts mousehole';

/** the rooms INSIDE their walls, and the corridor */
export const MOUSEHOLE_ROOMS = {
  ward:     { name: 'ward',      bounds: { x0: 9.12,  x1: 14.94, z0: 7.12, z1: 14.94 } },
  exam:     { name: 'exam room', bounds: { x0: 15.06, x1: 20.94, z0: 7.12, z1: 14.94 } },
  store:    { name: 'store',     bounds: { x0: 21.06, x1: 26.94, z0: 7.12, z1: 14.94 } },
  post:     { name: 'duty room', bounds: { x0: 27.06, x1: 32.88, z0: 7.12, z1: 18.88 } },
  corridor: { name: 'corridor',  bounds: { x0: 9.12,  x1: 26.94, z0: 15.06, z1: 18.88 } },
} as const;
/** where the team forms up: the dark yard north of the ward's blank wall */
export const MOUSEHOLE_START: Vec3 = [12.0, 0, 3.4];

/** THE ROOM CLEAR on this level. Nine men: ward 1, exam room 3, store 2, duty room 3, each room a section of its own that stays home. The room men stand
 *  across their rooms from the doors they fear, 2.7 m off the blank north wall (past the 2 m a wall charge knocks a man down at). `wallCharges`: what the
 *  squad is issued for the run whatever its cards carry (game/issue.ts) — four walls on the route and one spare.
 *  THE MEN ARE PLACED BY HAND: the room clear's own placement (seed 0, first staging) stands each room's first `garrison` marks IN FILE ORDER, so the order of
 *  each `marks` list below is the placement — moving a mark up or down the list changes who stands.
 *  THE PROBLEM IN ONE SENTENCE: a gun behind a hatch owns the lit corridor every door opens on, and the room he sits in is deeper than a flash reaches.
 *  Doors from the front are the trap (the hatch gun). The walls carry a squad through the three small rooms whichever end it starts from; what is left to
 *  decide is how the duty room is taken — last, through the store's wall, with all three of its guns awake and a turn from the hole, or first, by the fire
 *  exit, under the one lamp in front of a man the canister does not reach. */
export const MOUSEHOLE_STRUCTURE: StructureData = {
  name: 'clinic',
  maxMen: 9,
  wallCharges: 5,
  // each room is its own section and stays in it: when the first room is hit the rest shut, wedge and cover their corridor doors (game/enemysquads.ts)
  squads: [
    { id: 'ward', name: 'Ward', rooms: ['ward'], barricade: ['ward'], mayLeave: false },
    { id: 'exam', name: 'Exam', rooms: ['exam'], barricade: ['exam'], mayLeave: false },
    { id: 'store', name: 'Store', rooms: ['store'], barricade: ['store'], mayLeave: false },
    { id: 'post', name: 'Duty', rooms: ['post'], barricade: ['post'], mayLeave: false },
  ],
  team: { sam: MOUSEHOLE_START, samYaw: 0, ops: [[10.8, 0, 2.6], [13.2, 0, 2.6], [9.8, 0, 1.8], [14.2, 0, 1.8]], opsYaw: 0 },
  // THE OTHER WAY IN (`starts`: stood on only when a run asks — the mission sheet's Way in row, ?way=2): the dark east side, on the duty room's steel fire exit.
  // The door opens to a hand; a man across the room stands square on it under the lamp, and a second covers it from the dark south end (the duty room's marks).
  starts: [{ sam: [36.0, 0, 9.2], samYaw: -Math.PI / 2, ops: [[35.0, 0, 8.0], [35.0, 0, 10.4], [36.4, 0, 7.6], [36.4, 0, 10.6]], opsYaw: -Math.PI / 2 }],
  rooms: [
    { id: 'ward', name: 'ward', bounds: { ...MOUSEHOLE_ROOMS.ward.bounds }, garrison: 1,
      doors: [{ id: 'ward', from: 'corridor' }],
      marks: [
        { pos: [13.6, 0, 9.8], watch: 'ward', aimAt: [12.0, 1.1, 14.9] },       // the north-east quarter, down the room at his door: 2.7 m off the blank wall, past a charge's knock-down
        { pos: [11.2, 0, 10.4], watch: 'ward', aimAt: [12.0, 1.1, 14.9] },      // between the cots and the table
        { pos: [14.3, 0, 12.6], watch: 'ward', aimAt: [12.0, 1.1, 14.9] },      // the east wall, the short way to the door
      ] },
    { id: 'exam', name: 'exam room', bounds: { ...MOUSEHOLE_ROOMS.exam.bounds }, garrison: 3,
      doors: [{ id: 'exam', from: 'corridor' }],
      marks: [
        // PLACED (the first three stand): two on the ward's partition, one across the room. A hole in the WEST wall (the yard's route) takes or folds the two beside
        // it and leaves one gun five metres off; a hole in the EAST wall (the fire exit's route, coming back along the row) is beside one man and leaves two.
        { pos: [20.3, 0, 9.8], watch: 'exam', aimAt: [18.0, 1.1, 14.9] },       // the east wall, 2.7 m off the blank north wall
        { pos: [15.7, 0, 10.4], watch: 'exam', aimAt: [18.0, 1.1, 14.9] },       // the north-west corner, his shoulder on the ward's partition
        { pos: [15.9, 0, 13.9], watch: 'exam', aimAt: [18.0, 1.1, 14.9] },      // the hard corner west of the door
        { pos: [20.2, 0, 12.4], watch: 'exam', aimAt: [18.0, 1.1, 14.9] },      // the east wall (not stood on the placed deal)
      ] },
    { id: 'store', name: 'store', bounds: { ...MOUSEHOLE_ROOMS.store.bounds }, garrison: 2,
      doors: [{ id: 'store', from: 'corridor' }],
      marks: [
        // PLACED (the first two stand): opposite corners. Whichever partition is blown, the blast has the near man and the far one is behind steel — the shelving
        // run for the north-east man when the hole is in the west wall, the chest-high cupboard for the south-west man when it is in the east wall.
        { pos: [26.2, 0, 9.8], watch: 'store', aimAt: [24.0, 1.1, 14.9] },      // the east aisle, 2.7 m off the blank north wall
        { pos: [22.0, 0, 13.5], watch: 'store', aimAt: [24.0, 1.1, 14.9] },     // the south-west corner, south of the cupboards: the hard corner west of his door
        { pos: [21.8, 0, 9.0], watch: 'store', aimAt: [24.0, 1.1, 14.9] },      // the west aisle (not stood on the placed deal)
        { pos: [26.2, 0, 13.6], watch: 'store', aimAt: [24.0, 1.1, 14.9] },     // the hard corner east of the door
      ] },
    { id: 'post', name: 'duty room', bounds: { ...MOUSEHOLE_ROOMS.post.bounds }, garrison: 3,
      doors: [{ id: 'post', from: 'corridor' }, { id: 'fire_exit', from: 'east side' }],
      marks: [
        // The hatch (z 15.3‥16.3) gives a man behind the duty desk a line to the three room doors and the floor in front of each. A line is not the eye:
        // guards.ts cuts every eye off at 16 m, so he notices a man at the exam and store doors and never one at the ward door (17.8 m) or the front door
        // (20.7 m). The duty room starts at x 27: no mark in it is inside 16 m of either.
        // PLACED (the first three stand): ONE NEAR, ONE DEEP, ONE UNDER THE LAMP. The hatch gun keeps the corridor. The man across from the fire exit stands under
        // the room's one lit panel, where anybody at that door sees him first. The third stands in the dark south end, 8.8 m from the fire exit — past the 8 m a
        // stun canister or a wall charge there reaches — with his gun up the room at it: whoever comes in by that door or a hole beside it walks under the lamp
        // in front of a gun he has not flashed. The second hatch gun is not stood.
        // FOUR MARKS FOR THREE MEN, TWO OF THEM HATCH GUNS: whichever three a seed deals, one gun is on the corridor. (A fifth mark, square behind the post's own
        // door, is gone: with it one deal in ten off seed 0 left the hatch empty.) Keep it so: a mark added here that is no hatch gun breaks the rule.
        { pos: [29.8, 0, 16.0], watch: 'post', aimAt: [18.0, 1.1, 15.7] },      // behind the duty desk, square to the hatch: the length of the corridor is his
        { pos: [30.2, 0, 18.0], watch: 'fire_exit', aimAt: [32.9, 1.1, 9.2] },  // the dark south end, up the room at the fire exit: out of a can's reach from that door
        { pos: [28.6, 0, 10.4], watch: 'fire_exit', aimAt: [32.9, 1.1, 9.2] },  // across the room from the fire exit, square on it, under the lamp
        { pos: [30.6, 0, 15.5], watch: 'post', aimAt: [12.0, 1.1, 15.6] },      // a second hatch gun, over the first's shoulder (not stood on the placed deal)
      ] },
  ],
};

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest). The way this level is named for is a WALL: the first way is
 *  a bespoke set — a stretch of the clinic's street wall with the ward behind it, three cots and the cross on the floor. It was anchored on a span of blank wall
 *  (a breach and not a door), and every pick whose kit works a leaf — the hammer, the breaching shotgun, a door charge, the wand, a bang or a frag on order —
 *  stood idle there: the maintainer, of the hammer on this level, "some demos still don't really do anything". So the set has a SIDE DOOR in that wall
 *  (`mh_side`, the wall cut round it with a lintel over) and the way is anchored on it: the stack stands on the same wall, and the wall charge still opens
 *  the wall beside the door (KIT_VIEW_LOOP.wallAt is measured along the stack's wall). Its boxes name their paint 'look|plain': the first the file's palette
 *  holds, so this one block serves the look file too. The second way was the level's own fire exit, which is STEEL (the hammer, the shotgun, a charge and
 *  the wand are refused by it): it is the same set, as the pass's two ways are one gate. */
const MOUSEHOLE_KITVIEW: KitViewData = {
  sets: { ward: { ref: [20.5, 17], doors: [{id: 'mh_side', hinge: [20.07, 14], closedDir: 0, width: 0.86, exterior: true}], boxes: [
    {id: 'mh_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'dirt|grass'},
    {id: 'mh_floor', c: [18, 0.002, 11.44], h: [6, 0.002, 2.44], material: 'slab|lino'},
    {id: 'mh_wall_w', c: [15.535, 1.5, 14], h: [4.535, 1.5, 0.12], material: 'render|concrete'},
    {id: 'mh_wall_e', c: [22.965, 1.5, 14], h: [2.035, 1.5, 0.12], material: 'render|concrete'},
    {id: 'mh_lintel', c: [20.5, 2.525, 14], h: [0.43, 0.475, 0.12], material: 'render|concrete'},
    {id: 'mh_back', c: [17.3, 1.5, 8.94], h: [5.36, 1.5, 0.06], material: 'whitewash|wall'},
    {id: 'mh_part_a', c: [12, 1.5, 11.44], h: [0.06, 1.5, 2.44], material: 'whitewash|wall'},
    {id: 'mh_part_b', c: [24, 1.5, 11.44], h: [0.06, 1.5, 2.44], material: 'whitewash|wall'},
    {id: 'mh_ceiling', c: [18, 3.1, 11.5], h: [7.1, 0.1, 2.7], material: 'ceiling', flags: ['NoPrimary']},
    {id: 'mh_panel', c: [17.6, 2.98, 11.9], h: [0.6, 0.02, 0.3], material: 'white', emissive: [11, 10.5, 9.5], flags: ['NoPrimary']},
    {id: 'mh_cot_a', group: 'mh.cots', c: [15.9, 0.26, 12.85], h: [0.45, 0.26, 0.98], material: 'plasticWhite|white'},
    {id: 'mh_rug_a', group: 'mh.cots', c: [15.9, 0.535, 12.2], h: [0.44, 0.02, 0.32], material: 'partBlue'},
    {id: 'mh_cot_b', group: 'mh.cots', c: [14.5, 0.26, 12.85], h: [0.45, 0.26, 0.98], material: 'plasticWhite|white'},
    {id: 'mh_rug_b', group: 'mh.cots', c: [14.5, 0.535, 12.2], h: [0.44, 0.02, 0.32], material: 'canvas|partTan'},
    {id: 'mh_cot_c', group: 'mh.cots', c: [13.1, 0.26, 12.85], h: [0.45, 0.26, 0.98], material: 'plasticWhite|white'},
    {id: 'mh_rug_c', group: 'mh.cots', c: [13.1, 0.535, 12.2], h: [0.44, 0.02, 0.32], material: 'partBlue'},
    {id: 'mh_cross_a', c: [17.45, 0.006, 12.6], h: [0.75, 0.002, 0.25], albedo: [0.07, 0.3, 0.29], flags: ['NoShadow']},
    {id: 'mh_cross_b', c: [17.45, 0.007, 12.6], h: [0.25, 0.002, 0.75], albedo: [0.07, 0.3, 0.29], flags: ['NoShadow']},
  ] } },
  ways: [
    {door: 'mh_side', set: 'ward', pane: false, light: {porch: {intensity: 0}, moonScale: 2.4}},
    {door: 'mh_side', set: 'ward', pane: false, light: {porch: {intensity: 0}, moonScale: 2.4}},
  ] };

export const MOUSEHOLE_SCENARIOS: LevelScenarios = { roomClear: MOUSEHOLE_STRUCTURE, kitView: MOUSEHOLE_KITVIEW,
  places: { areas: [{ name: MOUSEHOLE_ROOMS.corridor.name, bounds: { ...MOUSEHOLE_ROOMS.corridor.bounds } }] } };

export function build(opts: K.KitOpts = {}): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const k = K.newKit(opts); const C = K.KIT_PALETTE;
  const EXT = K.WALL_EXT, INT = K.WALL_INT;
  const W = Math.PI / 2, E = -Math.PI / 2, S = Math.PI;
  const win = (a: number, b: number, mullions = 2): K.Opening => ({ a, b, y0: 0.9, y1: 2.4, mullions, glass: 'whole' });
  /** a cot: steel frame, mattress, pillow at its −z end (before the yaw), a folded blanket */
  const cot = (x: number, z: number, yaw: number, blanket: Vec3) => { const p = K.frameAt(x, z, yaw);
    K.add(k, { c: p(0, 0.2, 0), h: [0.45, 0.2, 0.98], yaw, albedo: C.metal });
    K.add(k, { c: p(0, 0.46, 0), h: [0.43, 0.06, 0.95], yaw, albedo: C.white });
    K.add(k, { c: p(0, 0.55, -0.7), h: [0.27, 0.035, 0.16], yaw, albedo: [0.72, 0.72, 0.68] });
    K.add(k, { c: p(0, 0.535, 0.4), h: [0.44, 0.02, 0.45], yaw, albedo: blanket }); };

  // ---------------- ground ----------------
  K.grp(k, 'ground');
  K.slab(k, 0, -0.25, 0, 40, 0, 28, C.asphalt);
  K.slab(k, 0, 0, 0, 40, 0.01, 6.88, C.grass, { flags: BoxFlag.NoShadow });          // the north yard: dark, where the team forms up
  K.slab(k, 33.12, 0, 6.88, 40, 0.01, 28, C.grass, { flags: BoxFlag.NoShadow });     // the east side
  K.grp(k, 'floors');
  K.slab(k, 9, -0.1, 7, 33, 0.001, 19, C.lino);
  K.floorFinish(k, 9.12, 15.06, 26.94, 18.88, C.lino, K.POLISHED);                   // corridor: polished
  K.floorFinish(k, 15.06, 7.12, 20.94, 14.94, [0.36, 0.4, 0.38], K.POLISHED);        // exam room: pale green sheet
  K.floorFinish(k, 21.06, 7.12, 26.94, 14.94, C.stone);                              // store: bare screed
  K.floorFinish(k, 27.06, 7.12, 32.88, 18.88, C.carpet);                             // duty room
  K.grp(k, 'ceiling');
  K.ceiling(k, 8.9, 6.9, 33.1, 19.1);

  // ---------------- walls ----------------
  K.grp(k, 'walls.exterior');
  const ext = C.concrete;
  K.wallX(k, 7, 8.88, 33.12, EXT, ext);                                               // north: blank, on the dark yard — the first hole
  K.wallX(k, 19, 8.88, 33.12, EXT, ext, [win(11.6, 13.6), win(19.0, 21.0)]);          // south: the corridor's two windows onto the lot. A metre clear of the duty room's door, so the camera's own side of the building does not hide that doorway
  K.wallZ(k, 9, 7.12, 18.88, EXT, ext, [K.doorAt(k, 'front', 'z', 9, 16.35, { exterior: true })]);   // west: the front door off the porch, unlocked. A DOOR, not an arch: the corridor is then a room of its own to the squad's books (game/cleared.ts), and a squad that has not been in it is never sent to stand in it (the wall charge's stand-off marks keep to floor the squad holds)
  K.wallZ(k, 33, 7.12, 18.88, EXT, ext, [K.doorAt(k, 'fire_exit', 'z', 33, 8.6, { exterior: true, steel: true, locked: true })]);   // east: the duty room's fire exit — steel, locked on its inside face (from the east side it opens to a hand: the second way in)
  K.grp(k, 'walls.interior');
  const iw = C.wall;
  K.wallX(k, 15, 9.12, 26.94, INT, iw, [K.doorAt(k, 'ward', 'x', 15, 11.4), K.doorAt(k, 'exam', 'x', 15, 17.4), K.doorAt(k, 'store', 'x', 15, 23.4)]);
  K.wallZ(k, 15, 7.12, 14.94, INT, iw);                                               // ward | exam room
  K.wallZ(k, 21, 7.12, 14.94, INT, iw);                                               // exam room | store
  // store + corridor | duty room, x=27: the hatch (glass from the counter's height) and the post's door, both across the corridor's east end
  K.wallZ(k, 27, 7.12, 18.88, INT, iw, [{ a: 15.3, b: 16.3, y0: 0.95, y1: 2.1, glass: 'whole', tint: C.glass }, K.doorAt(k, 'post', 'z', 27, 16.55)]);

  // ---------------- ward (x 9.12‥14.94, z 7.12‥14.94): cots down the west wall, the nurse's table by the door ----------------
  K.grp(k, 'ward');
  cot(9.72, 9.0, 0, C.partBlue); cot(9.72, 11.4, 0, C.partTan); cot(9.72, 13.6, 0, C.partBlue);
  for (const z of [10.2, 12.5]) K.add(k, { c: [9.45, 0.3, z], h: [0.2, 0.3, 0.2], albedo: C.white });   // bedside lockers
  K.desk(k, 13.9, 14.1, 1.3, 0.7, 0, C.white); K.chair(k, 13.9, 13.4, S);            // the nurse's table on the south wall, east of the door
  K.deskLamp(k, 14.35, 14.2, [-1, -0.4], 'ward_lamp', 'ward');
  K.papers(k, 13.7, 0.76, 14.1, 0.2, true);
  K.cabinet(k, 14.6, 10.9, E);                                                        // the drugs cabinet on the east wall, south of where a charge would go
  K.add(k, { c: [12.6, 0.9, 7.3], h: [0.02, 0.9, 0.02], albedo: C.metal }); K.add(k, { c: [12.6, 1.78, 7.3], h: [0.14, 0.02, 0.02], albedo: C.metal });   // a drip stand
  K.bin(k, 11.0, 14.5);
  K.ceilingPanel(k, 11.8, 9.6, false, 'ward'); K.ceilingPanel(k, 11.8, 12.8, false, 'ward');

  // ---------------- exam room (x 15.06‥20.94, z 7.12‥14.94): lit — the couch, the doctor's desk, a folding screen ----------------
  K.grp(k, 'exam');
  K.add(k, { c: [18.0, 0.34, 8.0], h: [0.95, 0.34, 0.35], albedo: C.metal }); K.add(k, { c: [18.0, 0.72, 8.0], h: [0.93, 0.04, 0.33], albedo: [0.1, 0.24, 0.2] });   // the couch on the north wall
  // (the east wall is kept bare from end to end: it is the store's partition, and a squad that sets a charge on it wants the length of it to stand off along)
  K.desk(k, 19.9, 14.45, 1.5, 0.75, 0, C.wood); K.chair(k, 19.9, 13.7, 0); K.chair(k, 18.85, 13.9, 0.5);   // the doctor's desk on the south wall, east of the door; the patient's chair
  K.monitor(k, 20.3, 14.55, S, false);
  K.papers(k, 19.6, 0.76, 14.4, 0.4, true);
  for (const x of [16.1, 16.6]) K.cabinet(k, x, 14.62, 0);                            // records on the south wall, west of the door
  K.add(k, { c: [17.1, 0.85, 9.3], h: [0.6, 0.85, 0.02], albedo: C.white }); K.add(k, { c: [17.95, 0.85, 9.12], h: [0.3, 0.85, 0.02], yaw: 0.6, albedo: C.white });   // the folding screen before the couch (a walking gap west of it: no pocket in the corner the ward's wall opens into)
  K.plant(k, 19.6, 7.5, 0.8); K.bin(k, 15.5, 7.5);
  K.wallArt(k, 18.0, 1.6, 7.135, 1.0, 0.7, [0.8, 0.8, 0.76], true);                  // the eye chart over the couch
  K.ceilingPanel(k, 18.0, 9.4, true, 'exam'); K.ceilingPanel(k, 18.0, 12.6, false, 'exam');

  // ---------------- store (x 21.06‥26.94, z 7.12‥14.94): dark — shelving down the middle, cartons ----------------
  K.grp(k, 'store');
  K.shelf(k, 24.0, 10.2, 3.2, 0.5, W, 4, 1.9);                                        // one run down the middle, north to south: an aisle each side
  // the dispensary cupboards: steel, chest high, across the west aisle's south end. THE STAND-OFF FOR THE DUTY ROOM'S WALL: the floor behind them is out of the line of a
  // charge on the store's east wall, so the four stand off INSIDE the store. Without them the nearest place out of that blast was the lit corridor under the hatch
  // (measured over 24 runs: 41 of 96 teammates up, thirty of the lost shot there by the duty room; with these and the front door, 69). Kept short of the shelving's
  // end: the store's corner men still see the west wall. NOT a solid back on the shelving: tried, it sheltered the store's men from the third hole and lost 18 runs of 24.
  K.add(k, { c: [23.1, 0.6, 12.4], h: [0.9, 0.6, 0.22], albedo: C.metal });             // (chest high: the north-west corner man still sees his door over them)
  K.cardboardBox(k, 26.4, 14.45, 0.5, 0.2); K.cardboardBox(k, 25.8, 14.5, 0.45, -0.3); K.cardboardBox(k, 26.35, 14.4, 0.4, 0.5, 0.5);   // (the south-east corner: the floor behind the cupboards is kept clear)
  K.cardboardBox(k, 25.2, 7.6, 0.5, 0.1); K.cardboardBox(k, 24.6, 7.55, 0.45, 0.4);
  K.add(k, { c: [21.4, 0.5, 7.95], h: [0.3, 0.5, 0.45], albedo: C.white });           // the vaccine fridge in the north-west corner
  K.add(k, { c: [22.4, 0.45, 7.5], h: [0.6, 0.45, 0.3], albedo: C.metal });           // oxygen bottles' crate on the north wall (the east wall is the duty room's partition: kept bare)
  K.ceilingPanel(k, 22.4, 10.8, false, 'store'); K.ceilingPanel(k, 25.6, 10.8, false, 'store');

  // ---------------- duty room (x 27.06‥32.88, z 7.12‥18.88): dark but for its screens — the desk behind the hatch, the radio racks, the breaker ----------------
  K.grp(k, 'post');
  let rackFront: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) { const f = K.rack(k, 30.4 + i * 0.75, 7.66, i, i === 2); if (i === 1) rackFront = f; }   // the radio racks on the north wall, east end
  K.desk(k, 28.5, 15.8, 1.6, 0.8, W, C.woodDark); K.chair(k, 29.25, 15.1, W);          // the duty desk behind the hatch
  K.monitor(k, 28.4, 15.5, W, true);                                                  // its screen, on: it lights whoever sits behind it
  K.sofa(k, 32.4, 11.5, E);                                                           // the cot they take turns on, east wall
  K.desk(k, 31.9, 14.6, 1.4, 0.7, E, C.wood); K.chair(k, 31.2, 14.6, E);              // the table on the east wall: a radio set, a lamp that is off
  K.add(k, { c: [32.1, 0.9, 14.4], h: [0.2, 0.14, 0.3], albedo: C.black });
  for (const z of [13.0, 13.5]) K.cabinet(k, 32.55, z, E);
  K.cardboardBox(k, 32.3, 18.0, 0.45, 0.2);
  const breaker = K.breakerPanel(k, [29.0, 1.35, 7.12], [0, 1]);
  K.ceilingPanel(k, 30.0, 10.4, true, 'post'); K.ceilingPanel(k, 30.0, 14.6, false, 'post');

  // ---------------- corridor (x 9.12‥26.94, z 15.06‥18.88): lit end to end; a bench, nothing to stand behind ----------------
  K.grp(k, 'corridor');
  K.ceilingPanel(k, 12.0, 17.0, true, 'corridor'); K.ceilingPanel(k, 18.0, 17.0, true, 'corridor'); K.ceilingPanel(k, 24.0, 17.0, true, 'corridor');
  K.bench(k, 15.6, 18.62, 0); K.bench(k, 22.6, 18.62, 0);                             // the waiting benches on the south wall, between the windows and past them
  K.wallArt(k, 20.4, 1.5, 15.075, 1.4, 0.8, [0.75, 0.74, 0.7], true);                // the noticeboard between the exam room's door and the partition line
  K.exitSign(k, 9.135, 16.95, false, 'exit_sign_w', 'corridor');
  K.beacon(k, 14.0, 17.0); K.beacon(k, 22.0, 17.0); K.beacon(k, 30.0, 12.5);

  // ---------------- outside ----------------
  K.grp(k, 'exterior');
  K.car(k, 5.6, 20.6, 0.1, [0.74, 0.74, 0.7]);                                        // the clinic's own car on the lot, by the porch
  K.car(k, 20.0, 23.4, Math.PI / 2, [0.2, 0.22, 0.26]);
  K.add(k, { c: [30.5, 0.75, 5.6], h: [0.8, 0.75, 0.8], albedo: [0.2, 0.3, 0.42] });  // the water tank in the north yard's east end
  K.add(k, { c: [35.2, 0.5, 12.0], h: [0.6, 0.5, 0.9], albedo: C.metal });            // the generator on the east side
  K.slab(k, 0, 0, 27.94, 40, 0.32, 28, [0.5, 0.5, 0.47]); K.slab(k, 39.94, 0, 0, 40, 0.32, 27.94, [0.5, 0.5, 0.47]);   // kerbs
  K.grp(k, 'exterior.lamps');
  K.streetLamp(k, 6.6, 16.95, 'street_lamp_porch', [1, 0, 0]);                         // on the porch: whoever walks in the front way walks in lit
  K.moon(k);

  const level: Level = K.kitLevel(k, {
    playerSpawn: MOUSEHOLE_START,
    routes: [],
    breaker,
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the one mission thread, for whoever plays the level outside a scenario: reach the duty room, pull the radio's drive, leave by the fire exit
    mission: { serverRoom: { ...MOUSEHOLE_ROOMS.post.bounds }, entryDoor: 'post', rack: { index: 1, front: rackFront, halfW: 0.33 }, exfilDoor: 'fire_exit', exfilX: 33.6, exfilZ: 9.2 },
  });
  // ---------------- what is underfoot (game/floor.ts: which footstep sounds, and how far it carries to their ears) — the slabs under 'ground' and 'floors'
  // above, rect for rect. `building` is the whole world so the plan is all zones (first match wins): outside every zone is the lot's asphalt.
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'yard', mat: 'grass', x0: 0, z0: 0, x1: 40, z1: 6.88 },                                   // the dark yard the team forms up in
      { id: 'side', mat: 'grass', x0: 33.12, z0: 6.88, x1: 40, z1: 28 },                              // the side the fire exit is on
      { id: 'duty', mat: 'carpet', x0: 27.06, z0: 7.12, x1: 32.88, z1: 18.88 },
      { id: 'store', mat: 'stone', x0: 21.06, z0: 7.12, x1: 26.94, z1: 14.94 },                       // bare screed
      { id: 'clinic', mat: 'lino', x0: 9, z0: 7, x1: 33, z1: 19 },                                    // ward, exam room (sheet) and corridor
    ],
  };
  return { level, scenarios: MOUSEHOLE_SCENARIOS, groups: k.groups, surfaces };
}
