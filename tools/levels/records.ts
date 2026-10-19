// THE RECORDS OFFICE — the level the PAIR room clear is played on (levels/records.json ← bun run tools/levels/export.ts records). One idea: THE DOOR IS THE
// DECISION. Four held rooms, small enough that two teammates and the player are the right team, laid out so that every room is a choice of which way in and
// which door tool — and so that no one habit answers all of them:
//   front office  1 man, a desk lamp and a screen, the first room on a QUIET floor: the front door from the dark lot (a glass sidelight to look through first)
//                 or the hall door. Plain open-and-clear is fine here.
//   records       2 men, LIT, round a full-height island of shelving: a door on the hall and a back door onto the dark west yard, each raking ONE lane, a
//                 window on each lane to read them through. At home one man watches each door. The far door is the way in on the man who is not watching it.
//   strong room   1 man, dark, ONE door, locked, and it opens off RECORDS — it is taken with records still at your back. The charge's room.
//   staff room    1 man, lit: a hall door under the hall's one lit panel, and an east door whose stack stands in a street lamp's light in front of a glass
//                 sidelight. The hall door wants a bang; the back door is worse than it looks until the lamp is dealt with.
//   the hall      20 × 4 m: three room doors and the fire exit, so a pair on one door has one open flank to cover.
// Built ONLY from the old demo's kit (scene/levelKit.ts: the office's walls, glass, doors, furniture, lights). The building stands inside the rectangle the
// office's building stood in (x 4‥36, z 4‥24), so the constants that still assume that footprint (weather's INTERIOR, the footstep map) treat it as indoors.
// Plan, +x east, +z south, metres:
//
//          x=10            x=18     x=22.5          x=30
//   z=7    +-----WWWWWW----+--------+----WWW--------+        north yard (grass, dark)
//     dL-> d   RECORDS     | STRONG |  STAFF ROOM   d <- dK      * street lamp, lit
//          |    #######    d<-dC    |  (lit)        g  sidelight
//     W->  W    (lit)      | ROOM   |               |
//   z=13   +--------dR-----+--------+---dD----------+
//     W->  W   HALL: one panel lit, over dD         d  dE fire exit (steel)
//   z=17   +--dB--------+---------------------------+
//          |  FRONT     |
//          |  OFFICE    W        the yard: a parked car, dark
//   z=22.5 +----dS-g----+        dS = the front door, g = its glass sidelight
//               the team comes from the dark lot to the south, from behind a parked car
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag } from '../../src/scene/boxes';
import type { Level } from '../../src/scene/level';
import type { LevelScenarios, StructureData, ResponseData } from '../../src/scene/scenarios';
import * as K from '../../src/scene/levelKit';
import { livedPieces, INK, h01 } from './livedPieces';

export const NAME = 'records';
export const NOTES = 'The records office: the pair room clear\'s own level. Four held rooms; every room is a choice of door and door tool. Kit pieces only. Regenerate: bun run tools/levels/export.ts records';

/** Names and rectangles a scenario hangs on (the probes' walk, the plan drawing): the rooms INSIDE their walls, and the doors each is entered by.
 *  Data about the level, kept beside the generator that makes them true. */
export const RECORDS_ROOMS = {
  front:   { name: 'front office', bounds: { x0: 10.12, x1: 16.88, z0: 17.06, z1: 22.38 }, doors: ['front', 'office'] },
  records: { name: 'records',      bounds: { x0: 10.12, x1: 17.94, z0: 7.12,  z1: 12.94 }, doors: ['records_hall', 'records_west', 'strong_room'] },
  strong:  { name: 'strong room',  bounds: { x0: 18.06, x1: 22.44, z0: 7.12,  z1: 12.94 }, doors: ['strong_room'] },
  staff:   { name: 'staff room',   bounds: { x0: 22.56, x1: 29.88, z0: 7.12,  z1: 12.94 }, doors: ['staff_hall', 'staff_east'] },
  hall:    { name: 'hall',         bounds: { x0: 10.12, x1: 29.88, z0: 13.06, z1: 16.94 }, doors: ['office', 'records_hall', 'staff_hall', 'fire_exit'] },
} as const;
/** where the team forms up: the dark lot south of the front door, behind the parked car */
export const RECORDS_START: Vec3 = [13.0, 0, 26.9];

/** THE ROOM CLEAR on this level (the file's `scenarios.roomClear` block — scene/scenarios.ts StructureData: the rooms a defender holds, their ways in, how many
 *  men, where they may stand and which door each watches from there; and where the team starts, for this level has no breach plan and so no F drill). Five men:
 *  front office 1, records 2, strong room 1, staff room 1. A mark's place implies its facing — a man stands across the room from the door he fears — and the
 *  first `garrison` marks of a room are the authored placement (seed 0): in records one man per door. The door between records and the strong room is a way
 *  into BOTH (as the office's server ↔ manager door is). The team's marks carry four men: the pair's two first, two more for the four. */
export const RECORDS_STRUCTURE: StructureData = {
  name: 'records office',
  wayOut: true,   // (hard only — game/pressure.ts PRESSURE.wayOut: the hunters hold the lost room's doors from back off them)
  team: { sam: RECORDS_START, samYaw: Math.PI, ops: [[12.0, 0, 27.0], [14.0, 0, 27.0], [11.0, 0, 27.0], [15.0, 0, 27.0]], opsYaw: Math.PI },
  // the second way in (ROOMCLEAR.way): the dark west side, on the records room's own outside door instead of the front office's
  starts: [{ sam: [6.4, 0, 8.6], samYaw: Math.PI / 2, ops: [[5.2, 0, 7.6], [5.2, 0, 9.6], [4.0, 0, 7.6], [4.0, 0, 9.6]], opsYaw: Math.PI / 2 }],
  rooms: [
    { id: 'front', name: 'front office', bounds: { ...RECORDS_ROOMS.front.bounds }, garrison: 1,
      doors: [{ id: 'front', from: 'south lot' }, { id: 'office', from: 'hall' }],
      marks: [
        { pos: [15.5, 0, 18.5], watch: 'front', aimAt: [13.0, 1.1, 22.4] },          // behind the duty desk, in the screen's glow, on the front door
        { pos: [14.6, 0, 21.3], watch: 'office', aimAt: [11.6, 1.1, 17.1] },         // his back to the sidelight, on the hall door: the man a look through the glass catches out
        { pos: [11.3, 0, 19.6], watch: 'front', aimAt: [13.0, 1.1, 22.4] },          // the west wall, on the front door
      ] },
    { id: 'records', name: 'records', bounds: { ...RECORDS_ROOMS.records.bounds }, garrison: 2,
      doors: [{ id: 'records_hall', from: 'hall' }, { id: 'records_west', from: 'west yard' }, { id: 'strong_room', from: 'strong room' }],
      marks: [
        { pos: [17.3, 0, 8.0], watch: 'records_west', aimAt: [10.1, 1.1, 8.6] },     // the north-east corner: the length of the north lane at the back door
        { pos: [10.9, 0, 12.2], watch: 'records_hall', aimAt: [15.1, 1.1, 12.9] },   // the south-west corner, beside the west window: the south lane at the hall door
        { pos: [16.4, 0, 8.9], watch: 'records_west', aimAt: [10.1, 1.1, 8.6] },     // the north lane's east end
        { pos: [17.3, 0, 12.2], watch: 'records_hall', aimAt: [15.1, 1.1, 12.9] },   // the south-east corner, the hard corner east of the hall door
        { pos: [11.2, 0, 11.3], watch: 'records_west', aimAt: [10.1, 1.1, 8.6] },    // the west lane, up it at the back door
        { pos: [12.6, 0, 12.0], watch: 'records_hall', aimAt: [15.1, 1.1, 12.9] },   // the south lane, west of the hall door
      ] },
    { id: 'strong', name: 'strong room', bounds: { ...RECORDS_ROOMS.strong.bounds }, garrison: 1,
      doors: [{ id: 'strong_room', from: 'records' }],
      marks: [
        { pos: [19.4, 0, 10.5], watch: 'strong_room', aimAt: [18.1, 1.1, 10.5] },    // square behind his one door (inside the charge's reach)
        { pos: [18.9, 0, 12.2], watch: 'strong_room', aimAt: [18.1, 1.1, 10.5] },    // the hard corner south of it (inside it too)
        { pos: [21.2, 0, 10.2], watch: 'strong_room', aimAt: [18.1, 1.1, 10.5] },    // the far wall (outside it: the charge blinds him, it does not put him down)
      ] },
    { id: 'staff', name: 'staff room', bounds: { ...RECORDS_ROOMS.staff.bounds }, garrison: 1,
      doors: [{ id: 'staff_hall', from: 'hall' }, { id: 'staff_east', from: 'east side' }],
      marks: [
        { pos: [24.3, 0, 8.0], watch: 'staff_hall', aimAt: [24.6, 1.1, 12.9] },      // the north wall by the screen, across the room from the hall door (the north window looks at him)
        { pos: [23.9, 0, 11.2], watch: 'staff_east', aimAt: [29.9, 1.1, 9.0] },      // the west side, down the room at the east door
        { pos: [28.9, 0, 12.2], watch: 'staff_hall', aimAt: [24.6, 1.1, 12.9] },     // the south-east corner, along the wall at the hall door
      ] },
  ],
};

/** the parked car's boxes, by the ids the export writes (body, cabin, roof, wheels, lamps): what the front door's kit view takes out of ITS picture — it stands
 *  between that camera and the men. (tools/qa/kitview-page.cjs holds each id to a box of the car's footprint: a level edit that renumbers them is red there.) */
const CAR = ['box_0212', 'box_0213', 'box_0214', 'box_0215', 'box_0216', 'box_0217', 'box_0218', 'box_0219', 'box_0220', 'box_0221', 'box_0222'];
/** THE RECORDS OFFICE'S RESPONSE TEAM (scene/scenarios.ts ResponseData; game/qrf.ts RESPONSE.raid — `bun run tools/qa/response-check.ts` stands every mark
 *  on the built floor). A raid's team: it stands with the defenders. WHY HERE: the front office is 'the first room on a QUIET floor' — a night desk, a lamp,
 *  a screen, and a telephone. Gunfire the desk hears, and a few seconds to dial, is a patrol car on its way; the desk taken first and quietly, from the dark
 *  lot, and nobody calls. Two men, never more: this is the pair's level. */
export const RESPONSE: ResponseData = {
  why: 'A records office in town at night, with a night desk in the front office and a telephone on it: gunfire the desk hears is a call, and a patrol car comes, off the street or round by the back lane. The desk taken first and quietly (the first room, from the dark lot) and nobody calls.',
  site: 'the records office', at: 'at the records office', team: 'the night patrol', tag: 'UNIT', men: [2, 2], eta: [50, 90],
  raid: { room: 'front' },
  ways: [
    { name: 'the street', coming: 'coming in off the street', clear: 'nobody on the street side',
      muster: [[37.6, 0, 15.3], [37.6, 0, 14.1], [37.6, 0, 16.5], [38.6, 0, 15.3]],
      entry: [[32.4, 0, 15.3], [33.4, 0, 14.4], [33.4, 0, 16.2], [34.4, 0, 15.3]], entryFace: [-Math.PI / 2, -Math.PI / 2 + 0.8, -Math.PI / 2 - 0.8, -Math.PI / 2] },
    { name: 'the back lane', coming: 'coming round by the back lane', clear: 'nobody in the back yard',
      muster: [[20.5, 0, 1.6], [19.4, 0, 1.6], [21.6, 0, 1.6], [20.5, 0, 0.7]],
      entry: [[20.5, 0, 5.4], [19.5, 0, 4.5], [21.5, 0, 4.5], [21.0, 0, 2.6]], entryFace: [0, 0.8, -0.8, 0] },
  ],
};
/** what the playtest scenarios take from this level: the room clear (pair or four). No rescue, no night breach: it is not their level. */
export const RECORDS_SCENARIOS: LevelScenarios = { roomClear: RECORDS_STRUCTURE, response: RESPONSE,
  // the floor nobody holds, by name (scene/scenarios.ts PlacesData — words only): what a line on their net calls a spot that is no room of the structure
  places: { areas: [{ name: RECORDS_ROOMS.hall.name, bounds: { ...RECORDS_ROOMS.hall.bounds } }] },
  // the start page's picture of the team at the way-in door (scene/scenarios.ts KitViewData, src/host/kitView.ts; picture only), per way in as the starts are:
  // the south lot's front door with the worked-out camera and lamp and its slots written down; the dark west side's the same way (no pin: one worked-out camera rule for both)
  // (Sam's slot is 1.8 m from each door's middle, further off the wall than the worked-out 1.2 m: a door charge's moment goes off beside him — host/kitView.ts KIT_VIEW_STAGE.samClear)
  // (what the plan — src/host/kitViewPlan.ts — would otherwise MEASURE and get a different picture from, written down as this level's own: the stack was laid out
  //  0.9 m apart (`slotGap`: spread to the picture's spacing), the yard's lived things stay in the front picture (`show`), and the front fill stands at its full 6.5 m
  //  though the lot's far kerb is nearer than that)
  kitView: { ways: [
    { door: 'front', side: -1, hidePaint: ['look'], hide: CAR, show: ['lived.yard'], slotGap: 0.9, light: { fill: { offset: [0, 6.62, 2.0] } }, slots: [[14.45, 23.9, -125], [12.37, 23.32, 90], [11.47, 23.32, 90], [10.57, 23.32, 90], [15.4, 23.7, -90]] },   // (the stack on the hinge's side: the yard's sign stands along the wall on the other; the fifth man clear of its post; Sam as far off the wall as the floor is free — the parked car is out of the picture, not off the nav grid — and along it for the rest)
    { door: 'records_west', side: -1, hidePaint: ['look'], slotGap: 0.9, slots: [[8.45, 9.7, 145], [9.2, 8.0, 0], [9.2, 7.1, 0], [9.2, 6.2, 0], [9.2, 10.6, 180]] },
  ] } };

/** What tools/levels/export.ts writes levels/records.json from: the Level, the file's scenarios block, the editor group of every box. */
export function build(opts: K.KitOpts = {}): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const k = K.newKit(opts); const C = K.KIT_PALETTE;
  const EXT = K.WALL_EXT, INT = K.WALL_INT;
  const win = (a: number, b: number, mullions = 2): K.Opening => ({ a, b, y0: 0.9, y1: 2.4, mullions, glass: 'whole' });
  const sidelight = (a: number, b: number): K.Opening => ({ a, b, y0: 0.3, y1: 2.2, glass: 'whole', tint: C.glass });

  // ---------------- ground ----------------
  K.grp(k, 'ground');
  K.slab(k, 0, -0.25, 0, 40, 0, 28, C.asphalt);
  K.slab(k, 0, 0, 0, 40, 0.01, 6.88, C.grass, { flags: BoxFlag.NoShadow });        // north yard
  K.slab(k, 0, 0, 6.88, 9.88, 0.01, 23.1, C.grass, { flags: BoxFlag.NoShadow });   // west yard, down to the lot
  K.grp(k, 'floors');
  K.slab(k, 10, -0.1, 7, 30, 0.001, 17, C.carpet);                               // the bar and the hall: carpet base
  K.slab(k, 10, -0.1, 17, 17, 0.001, 22.5, C.carpet);                              // the front office
  K.floorFinish(k, 10.12, 13.06, 29.88, 16.94, C.lino, K.POLISHED);            // hall
  K.floorFinish(k, 18.06, 7.12, 22.44, 12.94, [0.2, 0.21, 0.24], { rough: 0.35 });   // strong room: anti-static tile (the office server room's)
  K.floorFinish(k, 22.56, 7.12, 29.88, 12.94, C.lino, K.POLISHED);             // staff room
  K.grp(k, 'ceiling');
  K.ceiling(k, 9.9, 6.9, 30.1, 17.1); K.ceiling(k, 9.9, 17.1, 17.1, 22.6);

  // ---------------- walls ----------------
  K.grp(k, 'walls.exterior');
  const ext = C.concrete;
  // north z=7: the records window (onto its north lane), the staff room's small one
  K.wallX(k, 7, 9.88, 30.12, EXT, ext, [win(12.6, 15.6, 3), win(25, 26.5, 1)]);
  // west x=10: the records back door (raking the north lane), the records west window (onto its south lane), the hall's end window
  K.wallZ(k, 10, 7.12, 22.38, EXT, ext, [K.doorAt(k, 'records_west', 'z', 10, 8.0, { exterior: true }), win(11, 12.2, 1), win(14.2, 15.8, 1)]);
  // (the staff room's east door opens OUTWARD, and the front office's and the records room's hall doors open into the HALL: no wedge holds any of the three, so
  //  each of those rooms keeps a way in its men cannot shut — tools/qa/second-way-check.ts. The records room's is its hall door because the team's second start
  //  is on its west one)
  // east x=30: the staff room's east door with its sidelight (a street lamp stands off it), the fire exit at the hall's end (steel: nobody falls back through it)
  K.wallZ(k, 30, 7.12, 16.88, EXT, ext, [K.doorAt(k, 'staff_east', 'z', 30, 8.4, { exterior: true, swing: -1 }), sidelight(9.9, 10.6), K.doorAt(k, 'fire_exit', 'z', 30, 14.4, { exterior: true, steel: true })]);
  // the hall's south wall east of the front office (z=17, onto the yard): blank
  K.wallX(k, 17, 17.12, 30.12, EXT, ext);
  // the front office: east wall x=17 (a window onto the yard), south wall z=22.5 (the front door + its sidelight)
  K.wallZ(k, 17, 16.88, 22.38, EXT, ext, [win(19.2, 21.4, 2)]);
  K.wallX(k, 22.5, 9.88, 17.12, EXT, ext, [K.doorAt(k, 'front', 'x', 22.5, 12.4, { exterior: true }), sidelight(13.9, 14.6)]);
  K.grp(k, 'walls.interior');
  const iw = C.wall;
  // bar | hall, z=13: records and the staff room
  K.wallX(k, 13, 10.12, 29.88, INT, iw, [K.doorAt(k, 'records_hall', 'x', 13, 14.5, { swing: 1 }), K.doorAt(k, 'staff_hall', 'x', 13, 24)]);
  // records | strong room, x=18: the strong room's one door, locked (keyed on the records face); strong room | staff room, x=22.5: blank
  K.wallZ(k, 18, 7.12, 12.94, INT, iw, [K.doorAt(k, 'strong_room', 'z', 18, 9.9, { locked: true })]);
  K.wallZ(k, 22.5, 7.12, 12.94, INT, iw);
  // hall | front office, z=17
  K.wallX(k, 17, 10.12, 16.88, INT, iw, [K.doorAt(k, 'office', 'x', 17, 11.0, { swing: -1 })]);

  // ---------------- front office (x 10.12‥16.88, z 17.06‥22.38): the duty desk, a lamp, a screen ----------------
  K.grp(k, 'front');
  K.desk(k, 14.6, 19.6, 1.6, 0.8, Math.PI);                       // the duty desk: the sitter north of it, looking south at the front door
  K.monitor(k, 14.2, 19.7, Math.PI, true); K.chair(k, 14.6, 18.85, Math.PI);   // the screen is on: it lights whoever is behind the desk
  K.deskLamp(k, 15.15, 19.85, [-0.3, 1], 'duty_lamp', 'front');   // lit: the floor between the desk and the front door
  K.papers(k, 14.75, 0.76, 19.5, 0.3, true);
  for (const z of [17.5, 18.0]) K.cabinet(k, 16.55, z, Math.PI / 2);   // files on the east wall
  K.bench(k, 16.5, 20.3, Math.PI / 2); K.plant(k, 10.55, 22.0, 0.9); K.bin(k, 10.5, 19.0);
  K.rug(k, 13.0, 21.4, 2.2, 1.4, [0.16, 0.17, 0.2]);                // the mat inside the front door
  K.wallArt(k, 14.9, 1.55, 17.075, 1.3, 0.8, [0.14, 0.3, 0.42], true);
  K.ceilingPanel(k, 13.4, 19.7, false, 'front');

  // ---------------- records (x 10.12‥17.94, z 7.12‥12.94): lit, a full-height island of shelving in the middle, a 2.3 m lane all round it ----------------
  K.grp(k, 'records');
  K.shelf(k, 14.0, 9.72, 3.0, 0.52, 0, 5, 2.1); K.shelf(k, 14.0, 10.28, 3.0, 0.52, 0, 5, 2.1);   // two runs back to back …
  K.add(k, { c: [14.0, 1.05, 10.0], h: [1.5, 1.05, 0.03], albedo: C.metal });                    // … on one solid back: no line crosses the island
  for (const x of [11.4, 11.9]) K.cabinet(k, x, 7.45, Math.PI);                // cabinets on the north wall west of the window (clear of the back door's stack)
  for (const x of [16.0, 16.5]) K.cabinet(k, x, 7.45, Math.PI);                // …and east of it
  K.cardboardBox(k, 13.4, 12.55, 0.5, 0.2); K.cardboardBox(k, 12.75, 8.95, 0.45, -0.3);
  K.wallArt(k, 17.925, 1.6, 8.6, 1.2, 0.8, [0.6, 0.55, 0.4], false);
  K.ceilingPanel(k, 12.4, 8.3, true, 'records'); K.ceilingPanel(k, 15.6, 8.3, true, 'records');     // the north lane
  K.ceilingPanel(k, 12.4, 11.7, true, 'records'); K.ceilingPanel(k, 15.6, 11.7, true, 'records');   // the south lane

  // ---------------- strong room (x 18.06‥22.44, z 7.12‥12.94): racks across the back, one locked door off records ----------------
  K.grp(k, 'strong');
  let rackFront: Vec3 = [0, 0, 0];
  for (let i = 0; i < 5; i++) { const f = K.rack(k, 18.75 + i * 0.75, 7.66, i, i === 4); if (i === 2) rackFront = f; }   // five across the north wall, LED faces south; the middle one holds the drive
  K.add(k, { c: [22.05, 0.6, 8.9], h: [0.35, 0.6, 0.45], albedo: C.metal });   // the UPS on the east wall
  K.desk(k, 20.6, 12.55, 1.3, 0.7, 0, C.metal);                     // a steel bench on the south wall
  K.cardboardBox(k, 21.95, 12.4, 0.5, 0.15);
  const breaker = K.breakerPanel(k, [22.44, 1.35, 11.3], [-1, 0]);  // the building's breaker hangs in here: nobody throws it before the room is taken
  K.ceilingPanel(k, 20.25, 10.4, false, 'strong', false, 1.2, 0.6, [4.5, 6.0, 9.0]);

  // ---------------- staff room (x 22.56‥29.88, z 7.12‥12.94): one panel lit, a screen left on ----------------
  K.grp(k, 'staff');
  K.add(k, { c: [22.9, 0.45, 9.9], h: [0.3, 0.45, 1.3], albedo: C.white }); K.add(k, { c: [22.92, 0.915, 9.9], h: [0.33, 0.015, 1.33], albedo: C.woodDark });   // the counter on the west wall
  K.monitor(k, 22.9, 9.4, Math.PI / 2, true, 0.93, false);         // the television on it, on
  K.desk(k, 26.0, 10.4, 1.8, 0.9, 0, C.white);                     // the table
  K.chair(k, 25.6, 9.6, Math.PI); K.chair(k, 26.4, 9.6, Math.PI); K.chair(k, 25.6, 11.2, 0); K.chair(k, 26.5, 11.25, 0.3);
  K.sofa(k, 27.7, 7.75, 0);                                         // on the north wall, east of the window
  K.bin(k, 23.0, 12.5); K.plant(k, 29.4, 11.2, 0.9);
  K.wallArt(k, 27.4, 1.55, 12.925, 1.4, 0.8, [0.55, 0.32, 0.14], true);
  K.ceilingPanel(k, 26.0, 10.0, true, 'staff');                    // lit (measured: in a dark room the pair does not see its man in time whatever the door or the tool — tools/qa/records-runs.ts doors --also … )

  // ---------------- hall (x 10.12‥29.88, z 13.06‥16.94): one panel lit, over the staff room's door; nothing stands in it ----------------
  K.grp(k, 'hall');
  K.ceilingPanel(k, 13.0, 15.0, false, 'hall'); K.ceilingPanel(k, 19.0, 15.0, false, 'hall'); K.ceilingPanel(k, 24.6, 14.6, true, 'hall');
  K.exitSign(k, 29.865, 15.0, false, 'exit_sign_e', 'hall');
  K.wallArt(k, 20.5, 1.5, 16.865, 1.6, 0.9, [0.5, 0.42, 0.3], true);          // the noticeboard on the south wall
  K.beacon(k, 16.5, 15.0); K.beacon(k, 26.5, 15.0); K.beacon(k, 12.0, 11.7);

  // ---------------- outside ----------------
  K.grp(k, 'exterior');
  K.car(k, 22.0, 20.4, 0.06, [0.32, 0.08, 0.07]);                   // the yard in the crook of the L: a parked car, dark
  K.car(k, 14.6, 25.4, Math.PI, [0.2, 0.22, 0.26]);                 // the lot: the car the team forms up behind
  K.slab(k, 0, 0, 27.94, 40, 0.32, 28, [0.5, 0.5, 0.47]); K.slab(k, 39.94, 0, 0, 40, 0.32, 27.94, [0.5, 0.5, 0.47]);   // kerbs on the lot's south and east edges
  K.grp(k, 'exterior.lamps');
  K.streetLamp(k, 33.5, 10.0, 'street_lamp_east', [-1, 0, 0]);     // off the east wall: it lights the stack on the staff room's east door, in front of that door's sidelight
  K.moon(k);

  // ---------------- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<thing>'; LAST, after every kept thing) ----------------
  // A district land office, and its things are the surveyor's: red and white ranging rods, tripods, maps rolled and unrolled, pegs. Each room by what only it has —
  // the front office is the PUBLIC's (the claims ledge, ink, forms: clean), records the PLAN BOOKS (open on a lectern at each end of the island, plan chests under the
  // window), the strong room the DEED VAULT (the steel safe; black deed tins with buff lids), the staff room the FIELD's (the drawing board, the theodolite
  // on its legs, rods on the wall, a map held down with mugs, wet boots). The hall stays bare. Nothing stands on a sight line the look draws (records-gwot.ts TRAVERSE)
  // or on its chain round the building; nothing lies on a surface the dressing deals on (tools/levels/dress.ts) but the staff table's maps, laid between its things.
  { const P = livedPieces({ add: b => K.add(k, b), grp: n => K.grp(k, n), prop: (...a) => K.prop(k, ...a) }, C), W = Math.PI / 2, E = -Math.PI / 2, S = Math.PI;
    // front office — the CLAIMS OFFICE: a plan chest behind the duty desk, the ledge the public write their claims at on the west wall
    P.room('front');
    P.floor(13.5, 19.72, 6.6, 5.2, C.carpetBlue, 0.014, 0.006);                    // the public office's own carpet, wall to wall (under the look's lines)
    P.chest(14.3, 17.43, 1.3, 0.62, 0, 0.9, 5); P.books(14.1, 0.9, 17.4, 0, 9); P.tray(14.74, 0.9, 17.45, 0);   // the forms cabinet behind the duty desk: binders of forms, the in-tray
    P.counter(10.48, 20.58, 2.25, 0.68, W, 1.05, C.woodDark, C.wood);              // the claims counter down the west wall (the east window's sight line along z 20.3 ends at it)
    { const L = P.at(10.48, 20.58, W); L.sheet(0, 1.05, 0, 2.2, 0.64, [0.1, 0.42, 0.2]); for (const lx of [-0.62, 0.3]) L.box(lx, 1.051, 0.16, 0.3, 0.02, 0.2, C.red); }   // its green cloth, the red ink pads
    P.ledger(10.5, 1.06, 21.38, W); P.stamps(10.33, 1.06, 20.02, W); P.stamps(10.4, 1.06, 20.95, W); P.stamps(10.36, 1.06, 20.5, W); P.sheets(10.56, 1.06, 19.72, W, 3); P.sheets(10.36, 1.06, 20.72, W, 2);
    P.coatStand(10.42, 18.5, 0.3);
    P.stool(11.3, 21.25); P.rollBin(16.45, 21.95);
    // records — the PLAN BOOKS: one open on a lectern at each end of the island, ledgers lying on the island's top, two plan chests under the window either
    // side of the north station's sight line (x 14.1), the trolley of volumes to shelve
    P.room('records');
    for (const [x, yaw] of [[15.81, W], [12.19, E]] as const) { P.counter(x, 10.0, 1.0, 0.5, yaw, 1.05, C.woodDark, C.wood); P.planBook(x, 1.05, 10.0, yaw); P.floor(x + (yaw > 0 ? 0.62 : -0.62), 10.0, 0.6, 1.0, [0.5, 0.42, 0.28]); }   // (coir where the reader stands)
    for (let i = 0; i < 8; i++) K.add(k, { c: [12.85 + (i % 4) * 0.74 + (h01(i) - 0.5) * 0.2, 2.09 + (i % 3) * 0.003, i < 4 ? 9.74 : 10.27], h: [0.15, 0.025, 0.19], yaw: (h01(i, 1) - 0.5) * 0.5 + (i % 2 ? W : 0), albedo: [INK.oxblood, INK.baize, INK.manila][i % 3] });   // ledgers on the island's top
    P.chest(13.3, 7.44, 1.26, 0.6, 0, 0.84, 4); P.chest(14.9, 7.44, 1.26, 0.6, 0, 0.84, 4);
    P.plan(13.3, 0.84, 7.44, 1.0, 0.5, -0.03); P.rolls(14.9, 0.84, 7.42, 0, 4, 0.8);
    P.trolley(13.1, 10.92, 0); P.stool(13.3, 8.2);   // (the trolley on the island's south side: the wider lane; the stool at the plan chest)
    // strong room — the DEED VAULT: the safe south of the UPS, deed tins on the racks' tops, on the safe and on the deed rack by the door
    P.room('strong');
    P.floor(20.25, 8.42, 3.7, 0.5, [0.3, 0.31, 0.33], 0.006); P.floor(20.25, 8.74, 3.7, 0.09, INK.yellow, 0.014, 0.012);   // chequer plate along the racks' fronts, and the line nobody without a key stands past
    { const L = P.safe(22.08, 9.82, E, 0.7, 0.66, 1.2, [0.07, 0.34, 0.2]); L.box(0, 1.2, 0, 0.56, 0.01, 0.52, [0.03, 0.12, 0.07]); L.box(0, 1.21, 0.04, 0.28, 0.012, 0.28, INK.brass); L.box(0, 1.222, 0.04, 0.28, 0.004, 0.28, INK.brass, 0.785); L.box(0, 0.62, 0.375, 0.44, 0.05, 0.05, INK.brass); }   // bottle green, the panel and the maker's brass plate on its top, the brass bar handle standing proud of its door
    P.counter(18.23, 8.43, 0.7, 0.28, W, 0.9, C.metal, C.metal); P.tins(18.23, 0.9, 8.43, W, 2, 0.34, INK.manila, null);   // the deed rack (buff lids, a black band: no cross — from above a cross is a first-aid box)
    for (const i of [0, 1, 3]) P.tins(18.75 + i * 0.75, 2.1, 7.5 + (i % 2) * 0.12, 0, 1, 0.38, INK.manila, null);
    P.crate(19.7, 12.6, 0.4, 0.15, C.wood, C.white, 'deeds');
    // staff room — the SURVEYORS' ROOM: the drawing board on the south wall, the theodolite on its legs in the corner, ranging rods over the sofa, the map on the
    // table held down with mugs, hard hats and the kettle on the counter, wet boots
    P.room('staff');
    P.floor(27.3, 12.05, 2.3, 1.7, [0.2, 0.3, 0.24]);
    P.drafting(27.3, 12.38, S, 1.5, 1.0);
    P.tripod(22.98, 7.7, 0.6, INK.hivis);
    P.poles(27.7, 1.28, 7.21, 0, 3, 1.8, 0.07);
    P.hooks(23.6, 7.13, 0, 3, 1.6, [INK.hivis, INK.yellow, INK.hivis]);
    { const L = P.at(26.0, 10.4, 0); L.sheet(0, 0.76, 0.29, 1.5, 0.24, INK.cream); L.sheet(-0.3, 0.764, 0.29, 0.5, 0.16, [0.62, 0.7, 0.55]); L.sheet(0.02, 0.76, -0.2, 0.6, 0.38, INK.blueprint); }   // the map: a long section along the table's edge and a field sheet between the stacks (the exporter refuses a lived thing standing in the dressing)
    P.mugs(25.36, 0.775, 10.72, 0, 1); P.mugs(26.64, 0.775, 10.72, 0, 1, [INK.navy]); P.mugs(26.8, 0.775, 10.0, 0, 1, [INK.enamel]);
    P.kettle(22.9, 0.93, 10.6, W); P.mugs(22.9, 0.93, 10.95, W, 3); P.hat(22.9, 0.93, 8.82, 0.4); P.hat(22.92, 0.93, 10.18, -0.3, INK.hivis);
    P.boots(22.79, 11.6, W, 2);
    P.stool(27.35, 11.5); P.crate(26.52, 7.5, 0.4, 0.2, C.wood, C.white, 'pegs');   // survey pegs
    // hall — kept BARE (the level's fast line, and a sight line down its middle): a bench under the noticeboard, fire buckets on the wall, what the cleaner
    // left at the far end, three claim slips dropped outside the records door
    P.room('hall');
    K.bench(k, 20.5, 16.68, 0);
    { const L = P.rail(19.8, 13.07, 0, 3, 0.95, 0.24, 0.26, 0.24, C.red); for (let i = 0; i < 3; i++) { L.box((i - 1) * 0.34, 0.95, 0.16, 0.24, 0.256, 0.24, C.red, 0.785); L.box((i - 1) * 0.34, 1.21, 0.16, 0.17, 0.008, 0.17, INK.canvas); } }   // fire buckets: round, sand in them
    { const L = P.at(20.5, 16.848, S); for (let i = 0; i < 5; i++) L.face(-0.6 + i * 0.3, 1.18 + (i % 2) * 0.22, 0.02, 0.2, 0.26 - (i % 3) * 0.04, i % 3 ? INK.paper : INK.manila); }   // notices on the board
    { const L = P.at(15.0, 13.5, 0); L.sheet(0, 0.008, 0, 0.21, 0.3, INK.paper, 0.5); L.sheet(0.34, 0.008, 0.18, 0.21, 0.3, INK.paper, -0.3); L.sheet(-0.2, 0.008, 0.36, 0.21, 0.3, INK.manila, 1.2); }
    P.floor(20.0, 15.0, 18.8, 1.3, [0.17, 0.26, 0.2], 0.006, 0.006); P.floor(15.1, 14.25, 1.5, 0.09, INK.yellow, 0.014, 0.012);   // the runner down the hall, the line the public wait behind at the records door
    P.cone(27.6, 16.5); P.bucket(28.2, 16.55, INK.yellow, 'mopbucket');
    // the yards: the gang's stores along the blank wall in the crook of the L, the office's sign and wheel stops on the lot, the practice plots pegged for real,
    // the trig pillar in the north yard, a bicycle and the burn drum on the west side, a bench and the barrow by the east door's lamp, the bins
    P.room('yard');
    for (let i = 0; i < 6; i++) { const L = P.at(24.2 + (i % 3) * 0.3, 17.36 + Math.floor(i / 3) * 0.3); L.box(0, 0, 0, 0.14, 0.6 + (i % 2) * 0.004, 0.14, C.concrete); L.box(0, 0.6 + (i % 2) * 0.004, 0, 0.14, 0.05, 0.14, C.white); }   // boundary marks, white tops
    P.sack(25.6, 17.42, 0.1); P.sack(25.68, 17.46, -0.2, INK.canvas, 0.34); P.sack(26.45, 17.5, 0.3);
    { const L = P.at(16.0, 23.3, 0); for (const sx of [-0.6, 0.6]) L.box(sx, 0, 0, 0.08, 1.5, 0.08, C.woodDark); L.box(0, 0.95, 0, 1.3, 0.5, 0.05, C.white); L.face(0, 1.12, 0.032, 1.0, 0.12, C.black); }   // the office's sign
    for (const x of [19.4, 22.2, 25.0]) K.add(k, { c: [x, 0.06, 23.2], h: [0.8, 0.06, 0.09], albedo: C.concrete });   // wheel stops
    // (the practice plots' corners are records-gwot.ts's: a peg on each, the instrument set up over one, a rod left lying along a chain)
    for (const [x, z] of [[32.6, 19.6], [35.4, 19.9], [35.1, 22.6], [32.4, 22.2], [38.6, 19.5], [38.8, 23.1], [38.5, 26.6], [32.9, 26.3]]) P.peg(x + 0.16, z + 0.05);
    P.tripod(35.4, 19.9, 1.1); P.rod(35.3, 20.6, 35.1, 22.4, 1.8);
    { const L = P.at(20.0, 3.5, 0); L.box(0, 0, 0, 1.0, 0.08, 1.0, C.concrete); L.box(0, 0.08, 0, 0.4, 1.0, 0.4, C.concrete); L.box(0, 1.08, 0, 0.12, 0.02, 0.12, INK.brass); for (let i = 0; i < 5; i++) P.peg(21.2 + i * 1.1, 3.5 + i * 0.12); }   // the trig pillar and its line
    { const L = P.at(9.62, 19.0, W); for (const sx of [-0.5, 0.5]) L.box(sx, 0, 0, 0.62, 0.62, 0.04, INK.rubber); L.box(0, 0.45, 0, 1.0, 0.05, 0.04, C.red); L.box(-0.22, 0.8, 0, 0.22, 0.05, 0.12, C.black); L.box(0.42, 0.86, 0, 0.04, 0.04, 0.46, C.metal); L.box(-0.05, 0, -0.12, 0.05, 0.8, 0.05, C.metal); }   // a bicycle
    { const L = P.at(6.8, 18.5, 0.3); P.floor(6.8, 18.5, 1.6, 1.5, [0.2, 0.2, 0.19], 0.5, 0.013); for (let i = 0; i < 4; i++) L.box(0, 0, 0, 0.56, 0.8 - i * 0.003, 0.56 * Math.tan(Math.PI / 8), [0.3, 0.16, 0.1], i * Math.PI / 4); L.sheet(0.7, 0.014, 0.3, 0.2, 0.26, [0.12, 0.11, 0.1], 0.6); L.sheet(-0.5, 0.014, 0.6, 0.18, 0.22, INK.paper, 1.1); }   // the burn drum on its ash
    K.bench(k, 30.36, 12.2, W);
    P.loose('barrow', 'cardboard', 32.3, 11.9, 0.5, 14, [P.part(0, 0.28, 0, 0.9, 0.24, 0.6, INK.yellow), P.part(0.55, 0, 0, 0.36, 0.36, 0.08, C.black), P.part(-0.68, 0.42, -0.25, 0.5, 0.04, 0.04, C.wood), P.part(-0.68, 0.42, 0.25, 0.5, 0.04, 0.04, C.wood), P.part(-0.3, 0, -0.22, 0.04, 0.28, 0.04, C.metal), P.part(-0.3, 0, 0.22, 0.04, 0.28, 0.04, C.metal), P.part(0, 0.52, 0, 0.5, 0.12, 0.3, C.white)]);
    for (const [x, z] of [[30.42, 17.5], [30.46, 18.1]]) P.loose('dustbin', 'bin', x, z, 0.1, 6, [P.part(0, 0, 0, 0.45, 0.75, 0.45, C.metal), P.part(0, 0.75, 0, 0.5, 0.05, 0.5, P.tone(C.metal, 0.7))]);
  }

  const level: Level = K.kitLevel(k, {
    playerSpawn: RECORDS_START,
    routes: [],
    breaker,
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the one mission thread, for whoever plays the level outside a scenario: reach the strong room, pull the drive, leave by the fire exit
    mission: { serverRoom: { ...RECORDS_ROOMS.strong.bounds }, entryDoor: 'strong_room', rack: { index: 2, front: rackFront, halfW: 0.33 }, exfilDoor: 'fire_exit', exfilX: 30.5, exfilZ: 15.0 },
  });
  return { level, scenarios: RECORDS_SCENARIOS, groups: k.groups };
}
