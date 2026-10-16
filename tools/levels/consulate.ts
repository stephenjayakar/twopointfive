// THE CONSULATE — the four's hostage rescue: three hostages at the far end of a floor of rooms the squad has no time to clear, in a room one stack cannot take.
// A level generator in the scenario levels' shape (tools/levels/test-rooms.ts is the template; rebuild/scenario-levels/contract.md the how-to):
//   bun run tools/levels/export.ts consulate [--check]   → levels/consulate.json, with its `scenarios.rescue` block
//   page: ?levelFile=consulate.json&rescue&squad=4        · headless: bun run tools/qa/probes.ts consulate
//
// The idea it playtests (this goal's assumption, on the maintainer's words 'high risk hostage rescue situations where you do need to flow a lot more, go dynamic,
// selective clearance along the way' and 'a four person squad as two pairs'): THE SQUAD SPENDS ITS MEN, NOT ITS TIME. The captor's clock starts on the team's
// first step and nothing on the way may be cleared room by room. What the layout does about it:
//   · THE WAY IN is one corridor, 3 m wide and lit, with FOUR rooms off it — two a side, staggered. Three of the captors' men are somewhere in five places
//     (the rescue's own draw at each staging), so no room is known empty. Each room says what it can from the corridor: the VISA OFFICE has a glass front (one
//     look on the run), the WAITING ROOM a wide open arch (a look sees most of it, not its back corners), the RECORDS ROOM and the KITCHEN a shut door each
//     (nothing but opening it says). A room passed is a room behind you: what four men buy is a man left on each opening that matters while the rest go on;
//   · the records room has a SECOND DOOR, onto the hall the main stack stands in, left STANDING OPEN (the registry's trick, kept: a mark in the dark with a
//     line onto the stack);
//   · THE HOSTAGE ROOM is the consul's office: one room in two halves, a wall across it with a gap at the west end. The MAIN door (off the hall) opens on the
//     north half, where a second gun watches it; the hostages and the captor are in the SOUTH half, behind the wall — a stun charge through the main door does
//     not reach him, and the gap is a second doorway to fight through while his clock runs. The SIDE door opens on the south half straight at him, from the
//     BACK OFFICE across the hall's end — a room the team has to go INTO (it may hold one of the three). One pair on each door, one word: both halves at once.
//
//          x 4      10          17          24        29             36
//      z 4 +--------+-----------+-----------+---------+--------------+
//          |        |   VISA    |  RECORDS  | counter o  CONSUL'S    |      o  = 'suite', the MAIN door (the hall's north end; locked)
//          |        |  OFFICE   |   ROOM    |  HALL   |  OFFICE      |
//          | LOBBY  |           |          rh         |  (north)     |      rh = 'records_hall' (standing open)
//     z 10 |        +=glass=-v--+----r------+         |      +-------+ z 12 (the wall across it; the gap is at its west end)
//          |           the CORRIDOR  ───────►         |              |      v = 'visa'   r = 'records'
//   z 13.2 |        +---[arch]--+-------k---+----b----+  (south)     |      k = 'kitchen'   b = 'back'
//          |  team  |  WAITING  |  KITCHEN  |  BACK   s   hostages   |      s = 'suite_side' (the SIDE door)
//   front ==        |   ROOM    |          kb OFFICE  |              |      kb = 'kitchen_back'
//          |        |           |           |         +--------------+ z 20
//          |        |           |           |         st   STORE     == fire_exit      st = 'store'
//     z 24 +--------+-----------+-----------+---------+--------------+
//
// 'Manageable with four' as the depot held it: the corridor and the hall are ≥ 3 m and bare; every door a stack forms on has ≥ 1.9 m of clear floor past a jamb
// on the side it is taken from; the hostage room's two doors are 11 m apart on one wall (one screen), their stacks out of each other's line.
// The shell is the office's (exterior walls on x 4 / 36, z 4 / 24) so what the game still keys to that footprint — the weather's INTERIOR rectangle, the world
// bounds typed into the shaders — holds without a change. The footstep surface map is still game/floor.ts's, the OFFICE's rectangles in code.
// LIGHT is the cue and the balance: the lobby, most of the corridor, the records room and the back office are dark (a team in them is hard to see), the rooms that
// hold a man show him under a panel (visa, kitchen, a dim waiting room, the suite), and the hall's north end — where a stack on the main door stands — is lit.
// All lit, the scripted four lost more than half their men on the way in; this way round the approach is the team's and the doors are the fight.
// Only the old demo's kit (src/scene/officeGen.ts officeKit: its walls, doors, glass, furniture, lights, palette and markings). Units: meters. +X east, +Z south, +Y up.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LevelScenarios, Rect } from '../../src/scene/scenarios';
import { officeKit, normalize3 as norm, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { livedPieces, INK } from './livedPieces';

export const NAME = 'consulate';
export const NOTES = 'The consulate: a lobby, a 3 m corridor past four rooms (a glass front, an open arch, two shut doors) to a hall, and the consul\'s office in two halves with a door on each. The four-person hostage rescue\'s level, built from the office kit. Regenerate: bun run tools/levels/export.ts consulate';

/** The spaces: the floor inside each one's walls. The ONE place a room's rectangle is typed — the rescue's bounds, its regions and the probes all read it. */
export const CONSULATE_ROOMS: Record<'lobby' | 'corridor' | 'visa' | 'records' | 'hall' | 'suite' | 'waiting' | 'kitchen' | 'back' | 'store', Rect> = {
  lobby: { x0: 4.12, x1: 9.94, z0: 4.12, z1: 23.88 },
  corridor: { x0: 10.06, x1: 23.94, z0: 10.06, z1: 13.14 },
  visa: { x0: 10.06, x1: 16.94, z0: 4.12, z1: 9.94 },
  records: { x0: 17.06, x1: 23.94, z0: 4.12, z1: 9.94 },
  hall: { x0: 24.06, x1: 28.94, z0: 4.12, z1: 13.14 },
  suite: { x0: 29.06, x1: 35.88, z0: 4.12, z1: 19.94 },
  waiting: { x0: 10.06, x1: 16.94, z0: 13.26, z1: 23.88 },
  kitchen: { x0: 17.06, x1: 23.94, z0: 13.26, z1: 23.88 },
  back: { x0: 24.06, x1: 28.94, z0: 13.26, z1: 23.88 },
  store: { x0: 29.06, x1: 35.88, z0: 20.06, z1: 23.88 },
};
/** the wall across the consul's office: its z, and the x its west end stops at (the gap runs from the room's west wall to here) */
export const CONSULATE_SPLIT = { z: 12.0, x0: 31.4 };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = CONSULATE_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, rug, plant, bin, cabinet, papers, wallArt, bench, shelf, ceilingPanel, doorFrame, lights, switchables } = K;
  /** a table: a top on four legs (static — a mark may stand beside it, nobody pushes it) */
  function table(x: number, z: number, w: number, d: number, top: Vec3 = C.woodDark) {
    add({ c: [x, 0.72, z], h: [w / 2, 0.03, d / 2], albedo: top });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add({ c: [x + lx * (w / 2 - 0.08), 0.35, z + lz * (d / 2 - 0.08)], h: [0.04, 0.35, 0.04], albedo: C.metal });
  }
  /** a low coffee table (knee high: nothing hides behind it) */
  function lowTable(x: number, z: number, w: number, d: number) { add({ c: [x, 0.36, z], h: [w / 2, 0.03, d / 2], albedo: C.woodDark }); add({ c: [x, 0.165, z], h: [w / 2 - 0.1, 0.165, d / 2 - 0.1], albedo: C.black }); }
  /** a waist-high counter with a darker top, its cupboard doors on `face` */
  function counter(x: number, z: number, hw: number, hd: number, face: '+x' | '-x' | '+z' | '-z', body: Vec3 = C.white, top: Vec3 = [0.2, 0.2, 0.22]) {
    add({ c: [x, 0.45, z], h: [hw, 0.45, hd], albedo: body, ...mk(MD.cupboardMarks([hw, 0.45, hd], face, 3, TX)) }); add({ c: [x, 0.92, z], h: [hw + 0.04, 0.03, hd + 0.03], albedo: top });
  }
  /** a couch: a seat and a back along local +z (yaw 0 = its back to the south) */
  function couch(x: number, z: number, hw: number, back: 'n' | 's' | 'e' | 'w', albedo: Vec3 = [0.3, 0.12, 0.1]) {
    const alongX = back === 'n' || back === 's', s = back === 's' || back === 'e' ? 1 : -1;
    add({ c: [x, 0.22, z], h: alongX ? [hw, 0.22, 0.42] : [0.42, 0.22, hw], albedo });
    add({ c: alongX ? [x, 0.6, z + s * 0.33] : [x + s * 0.33, 0.6, z], h: alongX ? [hw, 0.35, 0.1] : [0.1, 0.35, hw], albedo });
  }

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  slab(0, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });
  grp('floors');
  const polished = { flags: BoxFlag.Gloss };
  slab(4, -0.1, 4, 36, 0.001, 24, C.carpet);                    // whole interior base (thin top at y=0): the rooms keep it
  slab(4, 0, 4, 10, 0.004, 24, C.stone, polished);              // the lobby: stone, wall to wall
  slab(10, 0, 10, 24, 0.004, 13.2, C.lino, polished);           // the corridor
  slab(24, 0, 4, 29, 0.004, 13.2, C.lino, polished);            // the hall it ends in
  slab(17, 0, 13.2, 24, 0.004, 24, [0.3, 0.31, 0.3], { rough: 0.3 });     // the kitchen: sealed tile
  slab(29, 0, 4, 36, 0.004, 20, C.carpetBlue);                  // the consul's office: the good carpet

  grp('ceiling');
  slab(3.9, H, 3.9, 36.1, H + 0.2, 24.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // exterior walls (t = 0.24). Windows on the south and west walls only (the moon stands south-west), sills at 0.9 m; the north and east walls are blind.
  grp('walls.exterior');
  const ext = C.concrete;
  wallX(4, 3.88, 36.12, 0.24, ext);                                                                              // north: blind
  wallX(24, 3.88, 36.12, 0.24, ext, [
    { a: 5.4, b: 8.6, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' },                                           // the lobby
    { a: 11.6, b: 15.4, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' },                                         // the waiting room
    { a: 19.2, b: 21.8, y0: 1.6, y1: 2.4, glass: 'whole' },                                                      // the kitchen: a high light over the counter
    { a: 25.4, b: 27.6, y0: 0.9, y1: 2.4, mullions: 2, glass: 'whole' },                                         // the back office
  ]);
  // west x=4: the front door (z 18.0..19.2) the team came in by — south of the corridor's mouth, out of its line — and the lobby's two windows
  wallZ(4, 4, 24, 0.24, ext, [{ a: 5.6, b: 9.0, y0: 0.9, y1: 2.4, mullions: 3, glass: 'whole' }, { a: 12.4, b: 15.4, y0: 0.9, y1: 2.4, mullions: 2, glass: 'whole' }, { a: 18.0, b: 19.2, y0: 0, y1: 2.2 }]);
  // east x=36: the store's fire exit (z 21.4..22.6)
  wallZ(36, 4, 24, 0.24, ext, [{ a: 21.4, b: 22.6, y0: 0, y1: 2.2 }]);

  // ---------------- interior partitions (t = 0.12). ONE is glazed: the visa office's front on the corridor. Every other wall hides what is behind it. ----------------
  grp('walls.interior');
  const iw = C.wall;
  // lobby | the rest, x=10: the corridor's mouth open wall to wall (z 10.06..13.14)
  wallZ(10, 4.12, 23.88, 0.12, iw, [{ a: 10.06, b: 13.14, y0: 0, y1: 2.6 }]);
  // the corridor's north wall z=10: the visa office's glass (x 10.7..14.3, sill 0.5 m) and door (x 14.8..16.0); the records room's door (x 19.4..20.6) in a blind wall
  wallX(10, 10.06, 23.94, 0.12, iw, [{ a: 10.7, b: 14.3, y0: 0.5, y1: 2.5, mullions: 3, glass: 'whole', tint: C.glass }, { a: 14.8, b: 16.0 }, { a: 19.4, b: 20.6 }]);
  // the corridor's south wall z=13.2: the waiting room's arch (x 12.4..14.6, no leaf), the kitchen's door (x 21.15..22.35, across from the records door — set so a nav cell's centre stands in the opening: this wall runs down a row of cell centres)
  wallX(13.2, 10.06, 23.94, 0.12, iw, [{ a: 12.4, b: 14.6, y0: 0, y1: 2.3 }, { a: 21.15, b: 22.35 }]);
  // visa | records, x=17 north; waiting | kitchen, x=17 south: solid
  wallZ(17, 4.12, 9.94, 0.12, iw);
  wallZ(17, 13.26, 23.88, 0.12, iw);
  // records | hall, x=24 north of the corridor: the records room's second door (z 8.4..9.6), left standing open — across the hall from where a stack on the
  // main door stands, and not to be seen from the corridor. Between z 10 and 13.2 the corridor runs into the hall unbroken.
  wallZ(24, 4.12, 10.06, 0.12, iw, [{ a: 8.4, b: 9.6 }]);
  // kitchen | back office, x=24 south: the kitchen's back door (z 20.4..21.6)
  wallZ(24, 13.14, 23.88, 0.12, iw, [{ a: 20.4, b: 21.6 }]);
  // the hall's south wall z=13.2 (the back office behind it): its door (x 26.0..27.2)
  wallX(13.2, 24.06, 28.94, 0.12, iw, [{ a: 26.0, b: 27.2 }]);
  // hall and back office | consul's office and store, x=29: the MAIN door (z 5.4..6.6, the hall's far end), the SIDE door (z 16.4..17.6), the store's (z 21.2..22.4)
  wallZ(29, 4.12, 23.88, 0.12, iw, [{ a: 5.4, b: 6.6 }, { a: 16.4, b: 17.6 }, { a: 21.2, b: 22.4 }]);
  // consul's office | store, z=20: solid
  wallX(20, 29.06, 35.88, 0.12, iw);
  // THE WALL ACROSS THE CONSUL'S OFFICE, z=12: from the east wall to x 31.4 — the gap (x 29.06..31.4) is at the west end, beside neither door
  wallX(CONSULATE_SPLIT.z, CONSULATE_SPLIT.x0, 35.88, 0.12, iw);

  // ---------------- the lobby (x 4..10): where the team forms up, inside the front door, south of the corridor's mouth and out of its line ----------------
  grp('lobby');
  bench(4.7, 6.4, Math.PI / 2); bench(4.7, 8.4, Math.PI / 2);                                // waiting benches under the north window
  plant(4.7, 4.7); plant(9.4, 23.3);
  desk(7.2, 21.8, 2.2, 0.8, Math.PI); monitor(7.2, 21.9, Math.PI, false); chair(7.2, 22.7, 0); papers(7.8, 0.76, 21.8, 0.3);   // the enquiries desk at the south end
  cabinet(4.55, 22.4, Math.PI / 2); cabinet(4.55, 23.0, Math.PI / 2);
  wallArt(9.925, 1.6, 7.0, 1.8, 1.0, [0.2, 0.35, 0.3], false);                               // notice board on the partition north of the mouth
  wallArt(9.925, 1.6, 16.6, 1.4, 0.9, [0.3, 0.26, 0.2], false);
  rug(7.0, 15.4, 3.0, 2.4, [0.3, 0.2, 0.18]);
  ceilingPanel(7.0, 7.5, false, 'lobby'); ceilingPanel(8.4, 17.6, false, 'lobby');
  add({ c: [4.14, 2.47, 18.6], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the front door

  // ---------------- the corridor (z 10..13.2): bare, lit, 3.08 m wide. The only way in ----------------
  grp('corridor');
  ceilingPanel(13.2, 11.6, false, 'corridor'); ceilingPanel(20.6, 11.6, true, 'corridor', false, 1.2, 0.3, [3, 2.9, 2.7]);
  rug(17, 11.6, 12.0, 0.9, [0.26, 0.22, 0.3]);                                               // the runner down its middle (a decal)
  wallArt(18.0, 1.6, 10.065, 1.2, 0.8, [0.36, 0.3, 0.2], true); wallArt(18.0, 1.6, 13.135, 1.4, 0.9, [0.2, 0.3, 0.26], true);

  // ---------------- the VISA OFFICE (x 10..17, z 4..10): glass on the corridor; its lamp left on ----------------
  // What a look through the glass must answer is 'is a man in here': the table is low, the shelving is on the walls, the one tall thing stands in a corner.
  grp('visa');
  table(13.4, 7.2, 2.6, 1.1); chair(12.6, 6.3, 0); chair(14.2, 6.3, 0); chair(12.6, 8.1, Math.PI); chair(14.2, 8.1, Math.PI);
  papers(13.0, 0.76, 7.1, 0.4); papers(14.0, 0.76, 7.35, -0.2);
  shelf(11.6, 4.45, 2.6, 0.45, 0, 4, 1.9); shelf(14.6, 4.45, 2.6, 0.45, 0, 4, 1.9);          // forms shelving on the north wall
  cabinet(16.5, 4.5, 0); bin(16.5, 9.4);
  ceilingPanel(13.4, 7.0, true, 'visa', false, 1.2, 0.6, [5, 4.8, 4.3]);

  // ---------------- the RECORDS ROOM (x 17..24, z 4..10): blind, the darkest room on the floor (one low lamp at its west end), two doors — 'records' on the
  // corridor, 'records_hall' on the hall (open, its leaf swung in against the room). Its south-east corner (between the two doors) is bare: a mark is there,
  // on the line through the open door ----------------
  grp('records');
  cabinet(18.2, 4.5, 0); cabinet(18.8, 4.5, 0); cabinet(19.4, 4.5, 0); cabinet(20.0, 4.5, 0);   // filing along the north wall
  counter(22.4, 4.5, 1.2, 0.35, '+z');
  table(20.2, 7.4, 1.6, 0.9, C.white); papers(20.0, 0.76, 7.3, 0.1);                          // the sorting table in the middle of the floor
  cardboardBox(17.6, 9.3, 0.5, 0.2); cardboardBox(17.65, 8.6, 0.45, 0.6);                     // boxed files in the south-west corner
  shelf(17.42, 6.4, 1.8, 0.45, Math.PI / 2, 4, 1.9);
  ceilingPanel(18.6, 6.6, false, 'records');

  // ---------------- the HALL (x 24..29, z 4..13.2): the corridor's end. The MAIN door is at the far end of its east wall, a counter across the north end with
  // a panel over it (a man behind it is lit: seen as soon as he sees). The walls beside every door are bare ----------------
  grp('hall');
  add({ c: [26.2, 0.5, 5.5], h: [1.3, 0.5, 0.3], albedo: C.woodDark, ...mk(MD.cupboardMarks([1.3, 0.5, 0.3], '+z', 3, TX)) }); add({ c: [26.2, 1.03, 5.5], h: [1.36, 0.03, 0.36], albedo: C.white });   // the reception counter across the north end (1.06 m: a man behind it shows head and shoulders); its east end is the way round it
  cabinet(24.5, 4.5, 0);
  wallArt(28.935, 1.6, 10.2, 1.2, 0.8, [0.3, 0.26, 0.2], false);
  ceilingPanel(26.2, 5.6, true, 'hall', false, 1.2, 0.6, [7, 6.8, 6.4]); ceilingPanel(26.5, 10.6, false, 'hall');
  add({ c: [28.9, 2.47, 6.0], h: [0.02, 0.1, 0.34], albedo: C.white, emissive: [0.9, 0.85, 0.7] });   // the lit plate over the consul's door

  // ---------------- the CONSUL'S OFFICE (x 29..36, z 4..20): the hold room, in two halves. NORTH (z 4..12): his desk, the main door west (z 5.4..6.6).
  // SOUTH (z 12..20): the sitting room — the hostages along its east wall, the side door west (z 16.4..17.6). The wall between them (z 12) stops at x 31.4 ----------------
  grp('suite');
  desk(33.6, 6.4, 2.0, 0.9, 0); monitor(33.6, 6.3, 0, true); chair(33.6, 5.5, 0); papers(34.2, 0.76, 6.5, 0.3);   // the consul's desk, facing the room
  cabinet(35.45, 10.2, -Math.PI / 2); cabinet(35.45, 10.8, -Math.PI / 2);                    // filing on the east wall, north half
  shelf(33.6, 11.62, 2.6, 0.45, Math.PI, 4, 1.9);                                            // bookshelves on the dividing wall's north face
  wallArt(32.6, 1.7, 4.135, 1.6, 0.9, [0.24, 0.3, 0.38], true);
  couch(31.2, 19.5, 1.0, 's');                                                               // the south half: a couch on the south wall, west end
  lowTable(31.2, 18.3, 1.2, 0.6);
  shelf(33.9, 12.38, 2.6, 0.45, 0, 4, 1.9);                                                  // and on its south face
  bin(35.3, 19.4);
  rug(32.6, 15.6, 3.6, 2.4, [0.34, 0.16, 0.14]);
  ceilingPanel(32.5, 8.2, true, 'suite', false, 1.2, 0.6, [6, 5.7, 5.2]); ceilingPanel(32.5, 16.0, true, 'suite', false, 1.2, 0.6, [5, 4.7, 4.2]);

  // ---------------- the WAITING ROOM (x 10..17, z 13.2..24): an open arch on the corridor, benches round the walls, the middle of the floor bare. A look
  // through the arch sees the middle; the corners either side of it and the far south end want a step in ----------------
  grp('waiting');
  bench(10.5, 16.6, Math.PI / 2); bench(10.5, 19.0, Math.PI / 2);                            // along the west wall
  bench(16.5, 16.6, -Math.PI / 2); bench(16.5, 19.0, -Math.PI / 2);                          // and the east
  lowTable(13.5, 18.6, 1.4, 0.7); papers(13.3, 0.4, 18.6, 0.3);
  plant(10.6, 23.3); plant(16.4, 13.8);
  wallArt(16.935, 1.6, 21.6, 1.6, 1.0, [0.22, 0.28, 0.36], false);
  rug(13.5, 18.6, 3.4, 2.6, [0.22, 0.26, 0.2]);
  ceilingPanel(13.5, 16.4, true, 'waiting', false, 1.2, 0.6, [3.4, 3.2, 2.9]);

  // ---------------- the KITCHEN (x 17..24, z 13.2..24): a shut door on the corridor, a back door into the back office. Counters on the west and south walls,
  // a table in the middle; the floor between the two doors is bare ----------------
  grp('kitchen');
  counter(17.5, 17.0, 0.35, 1.6, '+x'); counter(17.5, 20.6, 0.35, 1.4, '+x');               // along the west wall
  add({ c: [17.55, 0.95, 22.9], h: [0.4, 0.95, 0.4], albedo: C.white, rough: 0.35 });        // the fridge in the south-west corner
  counter(20.4, 23.45, 1.6, 0.35, '-z');                                                     // under the south window
  table(20.3, 18.4, 1.6, 0.9, C.white); chair(19.4, 18.4, Math.PI / 2); chair(21.2, 18.4, -Math.PI / 2);
  bin(23.5, 23.3);
  ceilingPanel(20.4, 17.6, true, 'kitchen', false, 1.2, 0.6, [3.6, 3.5, 3.3]);

  // ---------------- the BACK OFFICE (x 24..29, z 13.2..24): the side door's room. Three doors and a fourth to the store: its floor is kept bare for the stack ----------------
  grp('back');
  desk(26.5, 23.2, 2.0, 0.8, Math.PI); monitor(26.5, 23.3, Math.PI, false); papers(27.1, 0.76, 23.2, 0.2);   // a desk under the south window
  cabinet(24.5, 13.75, Math.PI); cabinet(25.1, 13.75, Math.PI);                              // filing on the north wall, west of its door
  cardboardBox(24.6, 23.3, 0.5, 0.2);
  ceilingPanel(26.5, 18.6, false, 'back');

  // ---------------- the STORE (x 29..36, z 20..24): the fire exit and the mains ----------------
  grp('store');
  shelf(32.0, 23.5, 2.6, 0.5, 0, 4, 2.0);
  cardboardBox(35.3, 20.6, 0.6, 0.2); cardboardBox(34.5, 20.55, 0.5, -0.2);
  // mains breaker panel on the east wall (OCP it for a temporary blackout, shoot it for a permanent one)
  const brk = add({ c: [35.84, 1.35, 23.2], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [35.79, 1.62, 23.02], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [35.84, 2.3, 23.2], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });
  ceilingPanel(32.5, 22.0, false, 'store');
  add({ c: [35.86, 2.47, 22.0], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit sign over the fire exit

  // ---------------- exterior: the moon, the only light outdoors ----------------
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---------------- emergency beacons (dark until the blackout): the corridor, the hall, the back office ----------------
  grp('beacons');
  const beacons: { pos: Vec3; box: number }[] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(17, 11.6); beacon(26.5, 8.0); beacon(26.5, 20.4);

  // ---------------- doors (closedDir 0: the leaf runs +x from the hinge, in a wall along x; π/2: +z, in a wall along z) ----------------
  const doors: LevelDoorDef[] = [
    { name: 'visa', hinge: [14.82, 10.0], closedDir: 0, width: 1.16, swing: 1 },   // the room's one door opens out into the corridor: no wedge inside the room holds it (tools/qa/second-way-check.ts)
    { name: 'records', hinge: [19.42, 10.0], closedDir: 0, width: 1.16, swing: 1 },   // opens out into the corridor, like 'visa': a man posted in the records room cannot wedge both of its doors
    { name: 'records_hall', hinge: [24.0, 8.42], closedDir: Math.PI / 2, width: 1.16, angle: 1.3, closer: false },   // left standing open, into the records room: whoever is in there sees the main door through it
    { name: 'kitchen', hinge: [21.17, 13.2], closedDir: 0, width: 1.16 },
    { name: 'kitchen_back', hinge: [24.0, 20.42], closedDir: Math.PI / 2, width: 1.16 },
    { name: 'back', hinge: [26.02, 13.2], closedDir: 0, width: 1.16 },
    { name: 'suite', hinge: [29.0, 5.42], closedDir: Math.PI / 2, width: 1.16, locked: true },                       // (keyed from the hall, as the office's manager's door is from its corridor)
    { name: 'suite_side', hinge: [29.0, 16.42], closedDir: Math.PI / 2, width: 1.16 },
    { name: 'store', hinge: [29.0, 21.22], closedDir: Math.PI / 2, width: 1.16 },
    { name: 'front', hinge: [4.0, 18.02], closedDir: Math.PI / 2, width: 1.16, exterior: true },
    { name: 'fire_exit', hinge: [36.0, 21.42], closedDir: Math.PI / 2, width: 1.16, exterior: true },
  ];
  for (const d of doors) doorFrame(d);

  // ---------------- LIVED IN (src/scene/lived.ts: group 'lived.<room>', props 'lived.<room>.<thing>'; off = the level as it was) ----------------
  // A town-house consulate, not an office: flags, rope posts, gilt and round things, the tea service, luggage. Every room low enough to fight across; the consul's two
  // halves and the visa section (read through its glass) lowest of all. Nothing here lights anything; the rooms' light is said with colour.
  {
    const P = livedPieces({ add: K.add, grp: K.grp, prop: K.prop }, OFFICE_PALETTE), Q = Math.PI / 4, NS = { flags: BoxFlag.NoShadow };
    const gilt = INK.brass, wine: Vec3 = INK.oxblood, tea: Vec3 = [0.5, 0.26, 0.08], turq: Vec3 = [0.1, 0.5, 0.5];
    /** a round thing: two squares, one turned an eighth */
    const round = (x: number, y0: number, z: number, s: number, h: number, a: Vec3, extra = {}) => { const L = P.at(x, z, 0); L.box(0, y0, 0, s, h, s, a, 0, extra); L.box(0, y0, 0, s, h - 0.004, s, a, Q, extra); };
    /** a rope post standing in its socket */
    const post = (x: number, z: number) => { P.at(x, z, 0).box(0, 0, 0, 0.09, 0.95, 0.09, gilt, Q); };
    /** the rope between two posts (drawn only) */
    const rope = (x0: number, z0: number, x1: number, z1: number) => { const dx = x1 - x0, dz = z1 - z0; P.at((x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(dz, dx)).box(0, 0.78, 0, Math.hypot(dx, dz) - 0.1, 0.05, 0.05, wine, 0, NS); };
    /** a rope post knocked over: loose */
    const fallen = (x: number, z: number, yaw: number) => P.loose('post', 'cardboard', x, z, yaw, 6, [P.part(0, 0, 0, 0.92, 0.08, 0.08, gilt), P.part(-0.47, 0, 0, 0.03, 0.24, 0.24, gilt)]);
    /** a flag on a standing pole, the cloth hanging out toward +x in three bands (drawn only), seen from above as three stripes */
    const flag = (x: number, z: number, a: Vec3, b: Vec3, c: Vec3) => { const L = P.at(x, z, 0); L.box(0, 0, 0, 0.07, 2.3, 0.07, gilt, Q);
      L.box(0.13, 1.75, 0, 0.14, 0.5, 0.5, a, 0, NS); L.box(0.27, 1.3, 0, 0.14, 0.5, 0.5, b, 0, NS); L.box(0.41, 0.85, 0, 0.14, 0.5, 0.5, c, 0, NS); };
    /** a suitcase standing or lying: loose */
    const suitcase = (x: number, z: number, yaw: number, a: Vec3) => P.loose('suitcase', 'cardboard', x, z, yaw, 9, [P.part(0, 0, 0, 0.6, 0.42, 0.2, a), P.part(0, 0.42, 0, 0.16, 0.03, 0.04, C.black)]);

    // THE LOBBY: the public's roped lane on every other brass socket, two posts knocked flat, the two flags on the west pier on the corridor's own axis, the bag search
    const giltChair = (x: number, z: number, yaw: number) => P.loose('chair', 'cardboard', x, z, yaw, 5, [P.part(0, 0, 0, 0.44, 0.45, 0.44, gilt), P.part(0, 0.45, 0, 0.38, 0.04, 0.38, C.red), P.part(0, 0.45, -0.2, 0.44, 0.45, 0.05, gilt)]);

    P.room('lobby');
    for (const [x, z] of [[5.95, 19.5], [7.85, 19.5], [9.75, 19.5], [9.75, 17.6], [9.75, 13.8], [6.9, 17.7], [8.8, 17.7], [8.8, 13.9]]) post(x, z);
    rope(5.95, 19.5, 7.85, 19.5); rope(9.75, 19.5, 9.75, 17.6); rope(6.9, 17.7, 8.8, 17.7);
    fallen(9.25, 15.75, 0.5); fallen(8.15, 17.15, -0.9);
    flag(4.42, 10.95, C.red, C.white, INK.baize); flag(4.42, 12.25, INK.navy, INK.yellow, INK.navy);
    P.table(9.58, 21.0, 0.6, 1.4);
    { const L = P.at(9.58, 21.0, 0); L.box(0, 0.74, -0.32, 0.5, 0.13, 0.36, wine); L.box(0.24, 0.87, -0.32, 0.03, 0.34, 0.36, wine); L.box(-0.02, 0.87, -0.32, 0.3, 0.02, 0.24, INK.cream);
      L.box(0.02, 0.74, 0.52, 0.06, 0.03, 0.3, C.black, 0.5); }
    P.tray(9.56, 0.74, 21.22, 0);
    round(6.75, 0.76, 21.6, 0.09, 0.06, gilt);
    suitcase(5.55, 7.4, 0.3, INK.navy);

    // THE CORRIDOR: the state runner, a bust on a plinth flat against the north wall by the mouth (the passage's own piece: 1.05 m, under the visa section's sill), one
    // half-moon console on the south wall, and the tea that was on its way when it started
    P.room('corridor');
    { const L = P.at(17.7, 12.99, 0); L.box(0, 0, 0, 1.0, 0.8, 0.28, C.woodDark); L.box(0, 0, -0.2, 0.6, 0.8, 0.12, C.woodDark); L.box(0, 0.8, -0.03, 1.04, 0.03, 0.36, C.wood); }
    round(17.7, 0.83, 12.98, 0.14, 0.22, INK.cream); P.at(17.7, 12.98, 0).box(0, 1.05, 0, 0.2, 0.06, 0.2, C.red, Q);
    P.floor(21.0, 12.55, 0.52, 0.34, C.metal, 0.4, 0.0155); P.floor(21.3, 12.4, 0.95, 0.58, P.tone(tea, 0.6), 0.25, 0.013); P.floor(21.38, 12.37, 0.52, 0.8, P.tone(tea, 0.6), 0.9, 0.0135);

    for (const x of [11.3]) { const L = P.at(x, 10.28, 0);   /* one bust, by the mouth: two more down the passage squeezed the file (a teammate in a mate's muzzle on 7 of 16 scripted runs) */ L.box(0, 0, 0, 0.5, 0.75, 0.36, C.woodDark); L.box(0, 0.75, 0, 0.3, 0.3, 0.3, C.white, Q); }

    // THE VISA SECTION, read through its glass: all of it under the sill — four booths made by a low screen on the table, passports in piles, the photo corner
    P.room('visa');
    P.floor(13.5, 7.03, 6.78, 5.72, [0.4, 0.46, 0.53], 0.003, 0.006);
    { const L = P.at(13.4, 7.2, 0); L.box(0, 0.75, -0.34, 2.4, 0.28, 0.07, C.white);
      for (const x of [-0.6, 0, 0.6]) L.box(x, 0.75, -0.46, 0.06, 0.28, 0.16, C.white);
      L.box(0.95, 0.75, 0.05, 0.09, 0.05, 0.125, INK.navy); L.box(1.1, 0.75, 0.05, 0.09, 0.07, 0.125, wine);
    }
    P.stamps(13.5, 0.75, 7.12, 0);
    { const L = P.at(10.06, 6.2, Math.PI / 2); L.box(0, 0, 0.04, 1.2, 1.04, 0.05, C.white); }
    P.floor(10.78, 6.2, 1.2, 1.3, INK.cream, 0.014, 0.011); P.floor(10.6, 6.08, 0.26, 0.1, INK.navy, 0.014, 0.0165); P.floor(10.6, 6.32, 0.26, 0.1, INK.navy, 0.014, 0.0165);
    { const L = P.at(11.5, 6.2, 0); L.box(0, 0, 0, 0.34, 0.03, 0.34, C.black); L.box(0, 0.03, 0, 0.06, 0.82, 0.06, C.black); L.box(0, 0.85, 0, 0.16, 0.14, 0.22, C.black); L.box(-0.1, 0.89, 0, 0.06, 0.06, 0.08, gilt); }
    P.stool(10.62, 5.62); P.crate(10.6, 8.9, 0.45, 0.2, C.cardboard, INK.paper, 'forms');

    // THE CIPHER ROOM: the safe standing open, the machine's paper tape run out across the floor, and what they had time to burn
    P.room('records');
    P.floor(20.5, 7.03, 6.78, 5.72, [0.27, 0.13, 0.24], 0.003, 0.006);
    P.safe(20.75, 4.5, 0);
    { const L = P.at(20.75, 4.5, 0); L.box(-0.44, 0.08, 0.7, 0.09, 1.1, 0.7, INK.enamel, 0.25); L.box(0.1, 1.25, 0, 0.32, 0.06, 0.24, C.red); }
    P.table(23.55, 6.0, 0.72, 1.6, 0, C.metal, C.black, 0.76);
    { const L = P.at(23.55, 6.0, 0); L.box(0.03, 0.76, -0.42, 0.42, 0.22, 0.46, C.black); L.box(-0.06, 0.98, -0.42, 0.2, 0.03, 0.12, INK.manila);
      L.box(0.05, 0.76, 0.42, 0.36, 0.26, 0.5, INK.enamel); L.box(-0.12, 0.84, 0.42, 0.03, 0.1, 0.1, gilt, Q); }
    P.floor(22.75, 6.75, 0.9, 0.13, C.white, -1.1, 0.012); P.floor(22.3, 7.35, 0.9, 0.13, C.white, 0.5, 0.014); P.floor(21.75, 7.85, 0.9, 0.13, C.white, -0.9, 0.016);
    { const L = P.at(17.36, 7.72, 0); L.box(0, 0, 0, 0.4, 0.62, 0.34, C.metal); L.box(0, 0.62, 0, 0.3, 0.02, 0.05, C.black); }
    P.floor(17.9, 7.8, 0.55, 0.42, INK.manila, 0.5, 0.012);
    round(21.75, 0, 5.5, 0.34, 0.5, C.metal); P.at(21.75, 5.5, 0).box(0, 0.5, 0, 0.26, 0.012, 0.26, C.black, Q, NS);
    P.floor(21.8, 5.6, 1.0, 0.85, C.black, 0.5, 0.008);
    P.loose('pouch', 'cardboard', 20.9, 5.95, 0.5, 4, [P.part(0, 0, 0, 0.5, 0.22, 0.34, INK.canvas), P.part(0, 0.22, 0, 0.12, 0.02, 0.34, INK.hivis)]);
    P.loose('pouch', 'cardboard', 21.5, 6.55, -0.9, 4, [P.part(0, 0, 0, 0.5, 0.22, 0.34, INK.canvas), P.part(0, 0.22, 0, 0.12, 0.02, 0.34, INK.hivis)]);
    P.loose('chair', 'chair', 22.75, 6.0, 0.4, 7, [P.part(0, 0, 0, 0.45, 0.46, 0.45, C.black), P.part(0.2, 0.46, 0, 0.06, 0.4, 0.42, C.black)]);

    // THE RECEPTION HALL: carpet wall to wall and almost nothing on it — flowers behind the counter, the visitors' book, a gilt urn, two gilt chairs
    P.room('hall');
    P.floor(26.5, 8.63, 4.78, 8.92, [0.1, 0.27, 0.18], 0.003, 0.006); P.floor(26.6, 10.1, 1.1, 5.9, INK.cream, 0.003, 0.016);
    { const L = P.at(25.12, 4.36, 0); L.box(0, 0, 0, 0.4, 0.9, 0.4, C.woodDark); L.box(0, 1.14, 0, 0.46, 0.14, 0.46, C.white, Q); L.box(0, 1.28, 0, 0.2, 0.06, 0.2, C.red); }
    round(25.12, 0.9, 4.36, 0.2, 0.24, gilt);
    P.table(24.4, 6.5, 0.5, 0.6); P.ledger(24.4, 0.74, 6.5, Math.PI / 2);
    P.at(28.58, 12.76, 0).box(0, 0, 0, 0.4, 0.5, 0.4, C.white); round(28.58, 0.5, 12.76, 0.3, 0.5, gilt);
    giltChair(25.5, 6.75, Math.PI); giltChair(26.7, 6.75, Math.PI);

    // THE CONSUL'S SUITE — north half his study (flag, globe, green leather, the red telephone), south half the sitting room (a hearth, tea, the blanket they sit on)
    P.room('suite');
    flag(35.45, 4.5, C.red, C.white, INK.baize);
    P.at(29.5, 8.35, 0).box(0, 0, 0, 0.5, 0.45, 0.5, C.woodDark); for (let i = 0; i < 4; i++) P.at(29.5, 8.35, 0).box(0, 0.45, 0, 0.62, 0.5 - i * 0.003, 0.62 * Math.tan(Math.PI / 8), INK.cream, i * Q); P.at(29.5, 8.35, 0).box(0.04, 0.95, 0.02, 0.3, 0.012, 0.2, INK.baize, 0.5);
    { const L = P.at(31.45, 4.6, 0); L.box(0, 0, 0.08, 2.2, 0.42, 0.7, C.plant); L.box(0, 0, -0.3, 2.2, 0.85, 0.18, C.plant); L.box(-1.02, 0.42, 0.08, 0.16, 0.2, 0.7, C.plant); L.box(1.02, 0.42, 0.08, 0.16, 0.2, 0.7, C.plant); }
    P.phone(34.3, 0.76, 6.18, 0, C.red); P.phone(34.0, 0.76, 6.18, 0);
    P.armchair(32.9, 7.55, 0, INK.baize); P.armchair(34.3, 7.55, 0, INK.baize);
    { const L = P.at(34.0, 19.72, 0); L.box(0, 0, 0, 1.6, 1.2, 0.4, C.white); L.box(0, 1.2, -0.04, 1.8, 0.06, 0.5, C.woodDark); L.box(0, 1.26, 0, 0.2, 0.2, 0.12, gilt);
      L.box(0, 0, -0.21, 0.8, 0.7, 0.02, C.black, 0, NS); L.box(0, 0, -0.75, 1.5, 0.12, 0.04, gilt, 0, NS); }
    P.floor(34.0, 19.0, 2.1, 1.0, C.black, 0.014, 0.012);
    P.floor(35.1, 14.8, 0.8, 3.8, INK.canvas, 0.014, 0.014);
    { const L = P.at(35.62, 14.8, 0); L.box(0, 0, -1.3, 0.44, 0.09, 0.44, C.red, 0.3, NS); L.box(0, 0, 1.5, 0.44, 0.09, 0.44, turq, 0.5, NS); }
    P.at(31.2, 18.3, 0).box(0, 0.39, 0, 0.42, 0.02, 0.3, C.metal); round(31.12, 0.41, 18.3, 0.12, 0.13, turq);
    P.armchair(33.0, 17.75, 0.15); giltChair(33.2, 16.5, 1.2); P.bucket(32.98, 19.55, C.black, 'scuttle');

    // THE WAITING ROOM — a vitrine of gifts under the window, the children's corner, the brochure rack, somebody's case left by a bench
    P.room('waiting');
    P.floor(13.5, 18.57, 6.78, 10.52, [0.2, 0.33, 0.36], 0.003, 0.006);
    P.counter(13.5, 23.52, 2.4, 0.6, Math.PI, 0.9, C.woodDark, INK.cream);
    round(12.8, 0.9, 23.52, 0.24, 0.22, turq); round(14.2, 0.9, 23.52, 0.2, 0.3, gilt);
    P.floor(11.25, 21.6, 1.5, 1.5, INK.yellow, 0.014, 0.014);
    { const L = P.at(11.25, 21.6, 0); L.box(-0.4, 0, -0.35, 0.18, 0.18, 0.18, C.red, 0.4, NS); L.box(-0.2, 0, 0.3, 0.18, 0.18, 0.18, INK.navy, 0.9, NS); L.box(0.35, 0, -0.1, 0.18, 0.18, 0.18, INK.baize, 0.2, NS); L.box(0.4, 0, 0.45, 0.3, 0.1, 0.14, turq, 1.1, NS); }
    { const L = P.at(16.74, 21.0, 0); L.box(0, 0, 0, 0.3, 1.0, 1.0, C.woodDark); L.box(0, 1.0, -0.32, 0.24, 0.012, 0.26, C.red, 0, NS); L.box(0, 1.0, 0, 0.24, 0.012, 0.26, turq, 0, NS); L.box(0, 1.0, 0.32, 0.24, 0.012, 0.26, gilt, 0, NS); }
    { const L = P.at(13.5, 18.6, 0); L.sheet(0.42, 0.395, -0.1, 0.22, 0.3, turq, 0.3); }
    suitcase(11.3, 17.85, 0.25, C.cardboard); P.bucket(11.5, 13.75, INK.navy, 'umbrellas');

    // THE TEA KITCHEN — a six-ring range on the east wall with copper pots, a rubber mat before it, the sink, the tray laid for three, the dresser
    P.room('kitchen');
    P.floor(20.5, 18.57, 6.78, 10.52, [0.4, 0.2, 0.14], 0.003, 0.006);
    { const L = P.at(23.52, 16.7, 0); L.box(0, 0, 0, 0.76, 0.9, 2.0, C.metal); L.box(0, 0.9, 0, 0.7, 0.03, 1.9, C.black); }
    round(23.42, 0.93, 16.05, 0.34, 0.2, INK.copper); round(23.46, 0.93, 16.75, 0.26, 0.14, INK.copper); P.kettle(23.42, 0.93, 17.35, 0, C.red);
    P.floor(22.6, 16.7, 0.7, 2.0, INK.rubber);
    { const L = P.at(19.67, 23.45, 0); L.box(0, 0.95, 0, 0.56, 0.03, 0.4, C.metal); }
    { const L = P.at(20.3, 18.62, 0); L.box(0, 0.75, 0, 0.44, 0.02, 0.24, C.metal); }
    P.counter(23.62, 18.6, 1.2, 0.5, -Math.PI / 2, 0.9, C.wood, C.white);
    P.kettle(23.62, 0.9, 18.25, 0); P.mugs(23.62, 0.9, 18.8, Math.PI / 2, 3, [C.white, INK.navy, C.white]);
    P.bucket(23.5, 14.9, C.red, 'gas'); P.trolley(18.7, 21.7, Math.PI / 2); P.crate(22.7, 23.4, 0.45, 0.1, C.wood, null, 'onions');

    // THE TYPISTS' OFFICE — one long bench down the west wall under blue blotters, three machines, the copy basket, balls of paper on the floor (the east wall stays bare)
    P.room('back');
    P.floor(26.5, 18.57, 4.78, 10.52, [0.42, 0.35, 0.24], 0.003, 0.006);
    P.counter(24.42, 16.7, 3.6, 0.66, Math.PI / 2, 0.74, C.woodDark, INK.blueprint);
    P.typewriter(24.42, 0.74, 15.5, Math.PI / 2); P.typewriter(24.42, 0.74, 16.7, Math.PI / 2); P.typewriter(24.42, 0.74, 17.9, Math.PI / 2);
    P.sheets(24.42, 0.745, 16.1, 0.2, 2); P.tray(24.42, 0.74, 17.3, Math.PI / 2);
    P.floor(25.5, 19.0, 0.12, 0.12, INK.paper, 0.5);
    P.counter(27.0, 19.0, 1.3, 0.7, 0, 0.76, C.woodDark, C.wood);
    { const L = P.at(27.0, 19.0, 0); L.box(-0.3, 0.76, 0, 0.5, 0.3, 0.42, C.black); L.box(-0.3, 1.06, 0, 0.34, 0.012, 0.3, INK.blueprint, 0, NS); L.box(0.36, 0.76, 0, 0.3, 0.14, 0.42, C.white); }
    P.stool(25.2, 15.5, C.chair); P.stool(25.25, 16.75, C.chair); P.stool(25.2, 17.9, C.chair);

    // THE FUNCTION STORE — the reception's carpets rolled on the rack's bottom shelf, the lectern, stacked gilt chairs under a dust sheet, flag poles, folded trestles
    P.room('store');
    P.floor(32.47, 21.97, 6.72, 3.72, [0.27, 0.3, 0.2], 0.003, 0.006);
    { const L = P.at(32.0, 23.5, 0); L.box(0, 0.17, -0.11, 2.4, 0.26, 0.26, C.red); L.box(0, 0.17, 0.13, 2.2, 0.22, 0.22, turq); }   // (ON the south wall's rack, between its posts: along the north wall they lay on the marks a stack takes on either of the store's doors)
    { const L = P.at(30.5, 20.5, 0); L.box(0, 0, 0, 0.5, 1.15, 0.4, C.woodDark); }
    { const L = P.at(32.0, 22.9, 0); L.box(0, 0, 0, 2.4, 0.07, 0.3, C.white); L.box(0, 0.07, 0, 0.5, 0.012, 0.32, C.red); }
    P.floor(34.3, 23.35, 1.5, 0.9, INK.canvas);
    for (const x of [34.0, 34.6]) { const L = P.at(x, 23.45, 0); L.box(0, 0, 0, 0.48, 1.1, 0.48, C.red); L.box(0, 1.1, 0, 0.4, 0.02, 0.4, gilt, 0, NS); }
    { const L = P.at(30.05, 23.7, 0); L.box(0, 0, 0, 1.0, 0.75, 0.1, C.wood); }
    P.crate(31.6, 21.08, 0.45, 0.2, C.wood, null, 'wine'); giltChair(33.6, 22.95, 0.6);

    // THE FRONT STEP: a clipped bay in a white tub either side of the door, 4.7 m off its middle: clear of the mat, the leaf and the whole of the wall south of
    // the door, where four stack in file (their marks run to z 22.3; at 3 m off the door the south tub stood on the third man's)
    P.room('street');
    for (const z of [13.9, 23.3]) { const L = P.at(3.35, z, 0); L.box(0, 0, 0, 0.56, 0.5, 0.56, C.white); L.box(0, 0.5, 0, 0.46, 0.5, 0.46, C.plant, Q); }
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [35.7, 1.35, 23.2], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [7.2, 0, 15.4],
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the rescue brings its own cast
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the rescue stands the mission still): the consul's office, a point on its
    // east wall's filing, the fire exit
    mission: { serverRoom: { ...R.suite }, entryDoor: 'suite', rack: { index: 0, front: [34.9, 1.0, 10.5], halfW: 0.3 }, exfilDoor: 'fire_exit', exfilX: 36.5, exfilZ: 22.0 },
  };

  // ---------------- what the hostage rescue takes from this level ----------------
  const MAIN: Vec3 = [29.1, 1.1, 6.0];     // the point on the consul's main door the men in the north half keep their guns on
  const SIDE: Vec3 = [29.1, 1.1, 17.0];    // … and on the side door, the south half's
  const scenarios: LevelScenarios = {
    rescue: {
      // the four: the red pair in front, the blue pair a stride behind (rescue.ts stages team.ops[0..3] in the squad's own order)
      team: { sam: [7.2, 0, 15.4], samYaw: Math.PI / 2, ops: [[5.9, 0, 14.7], [5.9, 0, 16.1], [4.85, 0, 14.7], [4.85, 0, 16.1]], opsYaw: Math.PI / 2 },
      room: { name: "consul's office", where: 'end of the corridor', door: 'suite', bounds: R.suite, lights: 'suite', doorAim: MAIN },
      side: { door: 'suite_side', hold: [29.1, 0, 17.0], from: { door: 'back', bounds: R.back }, pair: true },
      hostages: [{ pos: [35.2, 0, 13.2], face: -Math.PI / 2 }, { pos: [35.2, 0, 14.8], face: -Math.PI / 2 }, { pos: [35.2, 0, 16.4], face: -1.9 }],
      // the captor stands with the hostages in the south half, his gun on the side door — the one door he can see
      captor: { pos: [34.3, 0, 18.4], aimAt: SIDE },
      doorMan: { inside: { pos: [30.4, 0, 10.6], aimAt: MAIN }, outside: { pos: [27.7, 0, 7.8], aimAt: [24.6, 1.1, 11.4] } },   // (out on the route: a sentry by the consul's door under the hall's panel, his gun on the corridor's mouth — NOT down the corridor's length: a set rifle on an 18 m straight run took the whole file as it came)
      // a second gun who never leaves the room: the north half, on the main door
      guards: [{ pos: [34.5, 0, 9.0], aimAt: MAIN }],
      // FIVE places, THREE men (cast.roamers; which three is drawn at each staging): the records room (in the dark, looking out of its open hall door at where
      // a stack on the main door stands) · the visa office (behind the glass, under its lamp) · the back of the waiting room · the kitchen · the back office
      // (the side door's own room)
      roamers: [
        { pos: [22.4, 0, 9.4], aimAt: [28.4, 1.1, 7.5] },
        { pos: [13.2, 0, 5.5], aimAt: [15.4, 1.1, 9.9] },
        { pos: [15.6, 0, 22.0], aimAt: [13.5, 1.1, 13.4] },
        { pos: [18.9, 0, 15.6], aimAt: [21.75, 1.1, 13.4] },
        { pos: [26.9, 0, 21.4], aimAt: [26.6, 1.1, 13.4] },
      ],
      cast: { roamers: 3 },
      flow: {
        corridor: { x0: 10.06, x1: 28.94, z0: 10.06, z1: 13.14 },
        regions: [{ id: 'visa', door: null, rect: R.visa }, { id: 'waiting', door: null, rect: R.waiting }, { id: 'records', door: null, rect: R.records }, { id: 'kitchen', door: null, rect: R.kitchen }],
        route: [
          { id: 'waiting', name: 'waiting room', short: 'waiting', region: 'waiting', kind: 'doorway', door: null, at: [13.5, 0, 13.2], mark: [12.6, 0, 10.7], watch: [13.6, 1.1, 15.4], half: 1.1, north: false, call: 'opening right.', side: 'right', look: 0.9 },
          { id: 'visa', name: 'visa office', short: 'visa', region: 'visa', kind: 'glass', door: 'visa', at: [15.4, 0, 10.0], mark: [14.5, 0, 12.5], watch: [13.2, 1.1, 7.0], half: 0.55, north: true, call: 'glass left.', side: 'left', look: 0.9 },
          { id: 'records', name: 'records room', short: 'records', region: 'records', kind: 'door', door: 'records', at: [20.0, 0, 10.0], mark: [19.1, 0, 12.5], watch: [20.0, 1.05, 10.0], half: 0.55, north: true, call: 'door left.', side: 'left', look: 0.4 },
          { id: 'kitchen', name: 'kitchen', short: 'kitchen', region: 'kitchen', kind: 'door', door: 'kitchen', at: [21.75, 0, 13.2], mark: [20.85, 0, 10.7], watch: [21.75, 1.05, 13.2], half: 0.55, north: false, call: 'door right.', side: 'right', look: 0.4 },
        ],
        hold: { ahead: 9, xMax: 27.5, z: 11.6 },
      },
    },
  };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest; picture only): the front door the team came in by, from the
  // street side (`ref`: the rescue starts them 4.6 m INSIDE it, and from in there the picture looks out). Everything else is measured: the stack falls on the blank
  // wall north of the door, the lobby's two-light window just past its last man.
  scenarios.kitView = { ways: [{ door: 'front', ref: [1, 18.75] }] };
  // THE FLOOR, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it)
  scenarios.places = { areas: [{ name: "consul's office", bounds: { ...R.suite } }, { name: 'visa office', bounds: { ...R.visa } }, { name: 'records room', bounds: { ...R.records } }, { name: 'waiting room', bounds: { ...R.waiting } }, { name: 'kitchen', bounds: { ...R.kitchen } }, { name: 'back office', bounds: { ...R.back } }, { name: 'hall', bounds: { ...R.hall } }, { name: 'corridor', bounds: { ...R.corridor } }, { name: 'lobby', bounds: { ...R.lobby } }, { name: 'store', bounds: { ...R.store } }] };
  return { level, scenarios, groups: trace.groups };
}
