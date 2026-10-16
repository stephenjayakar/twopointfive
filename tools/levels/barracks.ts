// THE BARRACKS — a two wing building round a yard, for the four against eleven in three squads. A U plan: two long wings of small rooms, each off its own
// gallery, joined at the west by a link block with the mess hall; the yard between the wings is open to the sky and both galleries look onto it through
// UNGLAZED openings (a waist-high wall, posts, nothing in them: a man in one gallery sees and shoots a man in the other, or in the yard). The outside windows
// of the rooms are glass: looked through, never shot through.
//   bun run map:export barracks      → levels/barracks.json, with its `scenarios.roomClear` block
//   bun run map:check barracks       · bun run map:plan barracks --png      · page: ?levelFile=barracks.json&roomclear&squad4
//
//        x 4          12.25      18.25    23.25  27.25             36
//   z 4  +-----k_out--+----------+--------+------+-----------------+
//        |  galley    | bunks 1 n12 bunks 2| arms |    day room     |      NORTH WING: four rooms off the north gallery
//  8.25  +---k_hall---+---n1-----+---n2---+--n3--+--n4a-------n4b--+
//        |           h_n   ng_w    n o r t h   g a l l e r y  ng_e   n_end
// 10.75  |            +==open==n_yard==open=====open=====open======+
//        |            |                                            |
//  front |  mess    h_yard             t h e   y a r d            gate (an arch, no leaf)     the team starts outside the south-east corner
//        |  hall      |                                            |
// 17.25  |            +==open=====open==s_yard==open=====open======+
//        |           h_s   sg_w    s o u t h   g a l l e r y  sg_e   s_end
// 19.75  +---o_hall---+----s1------+---s2----+---s3---+----s4------+
//        | duty      o_s1 bunks 3  | bunks 4 | bunks 5 s34  wash   |      SOUTH WING: four rooms off the south gallery
//   z 24 +------------+------------+---------+--------+------------+
//        x 4          12.25        19.25     25.25    30.25        36
//
// WAYS IN (seven leaves and the arch): the front door on the link's west face, the galley's back door on the north face, an end door on each wing (east face),
// a door from each gallery and from the mess hall onto the yard, and the yard's own arch in the east wall. THE LOOP: north gallery → mess hall → south gallery
// → across the yard and back; a second, tighter one through the duty office (mess hall → o_hall → o_s1 → bunks 3 → s1 → south gallery → h_s).
// FIRE DOORS: two cross walls with a door in each cut every gallery in three (ng_w, ng_e, sg_w, sg_e), so no straight run of gallery is much longer than eleven
// metres. Without them the scripted four were shot from both ends of a 23 m gallery walking to their second room (24 seeds, Standard: 10 runs won; with, 15).
// ELEVEN DEFENDERS IN THREE SQUADS, a wing each and the link (rebuild/enemy-squads/squad-format.md): Charlie the south wing (bunks 5, bunks 3), Bravo the link
// (mess hall, galley), Alpha the north wing (the day room and the post at the north gallery's east end). Six rooms stand EMPTY (wash room, bunks 4, duty office, bunks 1, bunks 2, armoury): behind a shut door
// an empty room and a held one read the same.
// The shell is the office's rectangle (outer walls on x 4 / 36, z 4 / 24): the weather's 'indoors' rectangle is typed to it, so the rooms are dry — and so is the
// yard, which the weather also takes for indoors (no rain falls in it). Only the old demo's kit (src/scene/officeGen.ts officeKit). Units: metres. +X east, +Z south.
// NOT SEEN DRAWN: laid out on paper and checked headless (map:check); nobody has looked at it on a GPU.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, PlacesData, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import { livedKit } from './livedKit';

export const NAME = 'barracks';
export const NOTES = 'The barracks: two wings of small rooms, each off a gallery that looks onto the yard through unglazed openings, joined by a link block with the mess hall. Eleven defenders in three squads (a wing each and the link), seven doors and an arch in from outside. For the four man squad. One floor, box geometry only, the office\'s rectangle and kit. Regenerate: bun run map:export barracks';

// THE WALL LINES. Outer walls stand on whole metres (the office's rectangle); every inner line stands on a QUARTER metre, in the middle of a nav cell, so a
// wall costs the half-metre grid one row and a 2.3 m gallery keeps four.
const X0 = 4, X1 = 36, Z0 = 4, Z1 = 24;
const LX = 12.25;                    // link block | wings and yard
const NZ = 8.25, NY = 10.75;         // north rooms | north gallery | yard
const SY = 17.25, SZ = 19.75;        // yard | south gallery | south rooms
const N12 = 18.25, N23 = 23.25, N34 = 27.25;   // the north wing's partitions
const NG_FIRE = [17.25, 24.75], SG_FIRE = [17.25, 25.75];   // the galleries' fire doors: cross walls between the yard-side openings and the room doors
const S12 = 19.25, S23 = 25.25, S34 = 30.25;   // the south wing's

/** The spaces: the floor inside each one's walls. What the scenario data and the marks below read. */
export const BARRACKS_ROOMS: Record<'galley' | 'hall' | 'duty' | 'bunks1' | 'bunks2' | 'arms' | 'day' | 'bunks3' | 'bunks4' | 'bunks5' | 'wash' | 'ngal' | 'sgal' | 'yard', Rect> = {
  galley: { x0: X0 + 0.12, x1: LX - 0.06, z0: Z0 + 0.12, z1: NZ - 0.06 },
  hall: { x0: X0 + 0.12, x1: LX - 0.12, z0: NZ + 0.06, z1: SZ - 0.06 },
  duty: { x0: X0 + 0.12, x1: LX - 0.06, z0: SZ + 0.06, z1: Z1 - 0.12 },
  bunks1: { x0: LX + 0.06, x1: N12 - 0.06, z0: Z0 + 0.12, z1: NZ - 0.06 },
  bunks2: { x0: N12 + 0.06, x1: N23 - 0.06, z0: Z0 + 0.12, z1: NZ - 0.06 },
  arms: { x0: N23 + 0.06, x1: N34 - 0.06, z0: Z0 + 0.12, z1: NZ - 0.06 },
  day: { x0: N34 + 0.06, x1: X1 - 0.12, z0: Z0 + 0.12, z1: NZ - 0.06 },
  bunks3: { x0: LX + 0.06, x1: S12 - 0.06, z0: SZ + 0.06, z1: Z1 - 0.12 },
  bunks4: { x0: S12 + 0.06, x1: S23 - 0.06, z0: SZ + 0.06, z1: Z1 - 0.12 },
  bunks5: { x0: S23 + 0.06, x1: S34 - 0.06, z0: SZ + 0.06, z1: Z1 - 0.12 },
  wash: { x0: S34 + 0.06, x1: X1 - 0.12, z0: SZ + 0.06, z1: Z1 - 0.12 },
  ngal: { x0: LX + 0.06, x1: X1 - 0.12, z0: NZ + 0.06, z1: NY - 0.12 },
  sgal: { x0: LX + 0.06, x1: X1 - 0.12, z0: SY + 0.12, z1: SZ - 0.06 },
  yard: { x0: LX + 0.12, x1: X1 - 0.12, z0: NY + 0.12, z1: SY - 0.12 },
};

// THE TEAM & KIT PICTURE (scenarios.kitView): both ways on the level's own doors, rooms lit (the green gallery floor and the galley are the picture). Both
// faces are in the moon's shadow across a 3.8 m yard, where the worked-out fill is dimmed to a quarter and the far end of the stack stood black: it is written, and turned up the stack. The porch lamp is a cold white tube, so the whitewash reads white and the police green holds. At the end door the lot's parked car
// and carton (group `exterior`) were cut by the frame's edges, so they step out.
const BARRACKS_KITVIEW: KitViewData = { ways: [{ door: 's_end', hide: ['exterior'], roomLights: 1, light: { porch: { intensity: 12, color: [0.82, 0.9, 1] }, fill: { intensity: 3, aim: [1.6, 0.8, 0.9] } } }, { door: 'k_out', roomLights: 1, light: { porch: { intensity: 12, color: [0.82, 0.9, 1] }, fill: { intensity: 3, aim: [1.6, 0.8, 0.9] } } }] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = BARRACKS_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, bin, cabinet, papers, wallArt, bench, car, shelf, ceilingPanel, doorFrame, lights, switchables } = K;

  // ---------------- the pieces the rooms are furnished with ----------------
  /** a cot: a steel frame and a mattress, 0.55 m — low cover a man kneels behind. 1.9 × 0.9 */
  const cot = (x: number, z: number, alongX: boolean) => { const L = 0.95, Wd = 0.45;
    add({ c: [x, 0.2, z], h: alongX ? [L, 0.2, Wd] : [Wd, 0.2, L], albedo: C.metal });
    add({ c: [x, 0.475, z], h: alongX ? [L - 0.03, 0.075, Wd - 0.03] : [Wd - 0.03, 0.075, L - 0.03], albedo: [0.3, 0.33, 0.27] }); };
  /** a steel locker, 2 m: doors on both faces */
  const locker = (x: number, z: number, alongX: boolean) => { const h: Vec3 = alongX ? [0.49, 1.0, 0.3] : [0.3, 1.0, 0.49];
    add({ c: [x, 1.0, z], h, albedo: [0.33, 0.36, 0.38], rough: 0.5, ...mk(alongX ? [...MD.cupboardMarks(h, '+z', 2, TX), ...MD.cupboardMarks(h, '-z', 2, TX)] : [...MD.cupboardMarks(h, '+x', 2, TX), ...MD.cupboardMarks(h, '-x', 2, TX)]) }); };
  /** a mess table (0.75 m) with a bench down each long side. Along z: 1.7 across × 1.6 long */
  const messTable = (x: number, z: number, alongX: boolean) => {
    add({ c: [x, 0.72, z], h: alongX ? [0.8, 0.03, 0.4] : [0.4, 0.03, 0.8], albedo: C.white });
    for (const s of [-0.6, 0.6]) add({ c: alongX ? [x + s, 0.35, z] : [x, 0.35, z + s], h: alongX ? [0.04, 0.35, 0.3] : [0.3, 0.35, 0.04], albedo: C.metal });
    for (const s of [-0.65, 0.65]) { if (alongX) bench(x, z + s, 0); else bench(x + s, z, Math.PI / 2); } };
  /** a pallet of crates: a static block a man can kneel behind (1.0 m) */
  const pallet = (x: number, z: number, w: number, d: number) => {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], albedo: C.woodDark });
    add({ c: [x, 0.56, z], h: [w / 2 - 0.04, 0.44, d / 2 - 0.04], albedo: C.cardboard, ...mk(MD.cartonMarks([w / 2 - 0.04, 0.44, d / 2 - 0.04], TX)) }); };
  /** a concrete planter in the yard, 0.9 m with the shrub: cover from one gallery, none from the other */
  const planter = (x: number, z: number, hx: number, hz: number) => {
    add({ c: [x, 0.3, z], h: [hx, 0.3, hz], albedo: C.concrete });
    add({ c: [x, 0.75, z], h: [hx - 0.08, 0.15, hz - 0.08], albedo: C.plant }); };

  // ---------------- ground & structure ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  slab(0, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });
  slab(0, 0, 3.2, 3.2, 0.01, 28, C.grass, { flags: BoxFlag.NoShadow });
  grp('floors');
  const floor = (r: Rect, alb: Vec3, extra: Partial<Box> = {}) => slab(r.x0, 0, r.z0, r.x1, 0.004, r.z1, alb, extra);
  const polished = { flags: BoxFlag.Gloss };
  slab(X0, -0.1, Z0, X1, 0.001, Z1, C.concrete, { rough: 0.9 });         // the whole rectangle's base, the yard's paving included (thin top at y = 0)
  floor({ x0: X0, x1: LX, z0: NZ, z1: SZ }, C.stone, polished);         // the mess hall
  floor({ x0: X0, x1: LX, z0: Z0, z1: NZ }, [0.2, 0.21, 0.24], { rough: 0.35 });   // the galley
  floor({ x0: X0, x1: LX, z0: SZ, z1: Z1 }, C.carpet);                  // the duty office
  floor({ x0: LX, x1: X1, z0: NZ, z1: NY }, C.lino, polished);          // the galleries
  floor({ x0: LX, x1: X1, z0: SY, z1: SZ }, C.lino, polished);
  floor({ x0: LX, x1: N34, z0: Z0, z1: NZ }, C.lino);                   // the north wing's bunk rooms and armoury
  floor({ x0: N34, x1: X1, z0: Z0, z1: NZ }, C.carpet);                 // the day room
  floor({ x0: LX, x1: S34, z0: SZ, z1: Z1 }, C.lino);                   // the south wing's bunk rooms
  floor({ x0: S34, x1: X1, z0: SZ, z1: Z1 }, [0.2, 0.21, 0.24], { rough: 0.35 });   // the wash room
  slab(16, 0, 12.6, 32, 0.01, 15.4, C.grass, { flags: BoxFlag.NoShadow });          // the yard's lawn

  // the roof over the three blocks (light-only, hidden from the camera); the yard has none
  grp('ceiling');
  slab(X0 - 0.1, H, Z0 - 0.1, X1 + 0.1, H + 0.2, NY + 0.12, C.ceiling, { flags: BoxFlag.NoPrimary });        // north wing, and the link's north end
  slab(X0 - 0.1, H, SY - 0.12, X1 + 0.1, H + 0.2, Z1 + 0.1, C.ceiling, { flags: BoxFlag.NoPrimary });        // south wing, and the link's south end
  slab(X0 - 0.1, H, NY + 0.12, LX + 0.12, H + 0.2, SY - 0.12, C.ceiling, { flags: BoxFlag.NoPrimary });      // the link between them

  // ---------------- outer walls (t = 0.24): glass in every outside window, sills at 0.9 m ----------------
  grp('walls.exterior');
  const ext = C.concrete, win = (a: number, b: number, mullions = 2) => ({ a, b, y0: 0.9, y1: 2.4, mullions, glass: 'whole' as const });
  // north face: the galley's window and back door, a window to bunks 1, bunks 2 and the day room (the armoury is blind)
  wallX(Z0, X0 - 0.12, X1 + 0.12, 0.24, ext, [win(6.2, 7.8), { a: 9.8, b: 11.0 }, win(13.6, 16.4), win(19.6, 22.0), win(29.6, 33.2, 3)]);
  // south face: the duty office, bunks 3, 4, 5 and the wash room
  wallX(Z1, X0 - 0.12, X1 + 0.12, 0.24, ext, [win(6.0, 9.0), win(14.2, 17.8, 3), win(21.0, 23.6), win(26.4, 29.0), win(32.0, 34.4)]);
  // west face: the front door between the mess hall's two windows
  wallZ(X0, Z0, Z1, 0.24, ext, [win(9.6, 12.4), { a: 14.8, b: 16.0 }, win(17.0, 19.0)]);
  // east face: an end door on each gallery, and the yard's arch between them (2.6 m to its lintel, no leaf)
  wallZ(X1, Z0, Z1, 0.24, ext, [{ a: 8.8, b: 10.0 }, { a: 12.5, b: 15.5, y0: 0, y1: 2.6 }, { a: 17.8, b: 19.0 }]);

  // ---------------- the yard's three walls (t = 0.24) ----------------
  grp('walls.yard');
  // The galleries' openings are NOT glazed: a 0.9 m wall, a post, a head at 2.4 m. Sight and rounds cross; feet do not.
  const open = (a: number, b: number) => ({ a, b, y0: 0.9, y1: 2.4, mullions: 2 });
  wallX(NY, LX + 0.12, X1 - 0.12, 0.24, ext, [open(13.6, 16.4), { a: 18.8, b: 20.0 }, open(21.4, 24.2), open(26.0, 28.8), open(30.6, 33.4)]);
  wallX(SY, LX + 0.12, X1 - 0.12, 0.24, ext, [open(13.6, 16.4), open(18.6, 21.4), { a: 23.8, b: 25.0 }, open(26.4, 29.2), open(30.8, 33.6)]);
  // the mess hall's east face onto the yard: its yard door and one window (glass)
  wallZ(LX, NY - 0.12, SY + 0.12, 0.24, ext, [{ a: 12.8, b: 14.0 }, win(14.8, 16.6)]);

  // ---------------- inner partitions (t = 0.12), all solid ----------------
  grp('walls.interior');
  const iw = C.wall;
  // north rooms | mess hall and north gallery, z = 8.25, wall to wall: the galley's hall door, then a door a room (the day room has two)
  wallX(NZ, X0 + 0.12, X1 - 0.12, 0.12, iw, [{ a: 6.8, b: 8.0 }, { a: 14.8, b: 16.0 }, { a: 20.8, b: 22.0 }, { a: 25.8, b: 27.0 }, { a: 28.8, b: 30.0 }, { a: 33.8, b: 35.0 }]);
  // south rooms | mess hall and south gallery, z = 19.75: the duty office's hall door, then a door a room
  wallX(SZ, X0 + 0.12, X1 - 0.12, 0.12, iw, [{ a: 8.8, b: 10.0 }, { a: 14.8, b: 16.0 }, { a: 21.8, b: 23.0 }, { a: 26.8, b: 28.0 }, { a: 32.8, b: 34.0 }]);
  // the link's east wall, x = 12.25, in four pieces round the yard's: galley | bunks 1 · mess hall | north gallery (h_n) · mess hall | south gallery (h_s) · duty office | bunks 3 (o_s1)
  wallZ(LX, Z0 + 0.12, NZ - 0.06, 0.12, iw);
  wallZ(LX, NZ + 0.06, NY - 0.12, 0.12, iw, [{ a: 8.8, b: 10.0 }]);
  wallZ(LX, SY + 0.12, SZ - 0.06, 0.12, iw, [{ a: 17.8, b: 19.0 }]);
  wallZ(LX, SZ + 0.06, Z1 - 0.12, 0.12, iw, [{ a: 21.8, b: 23.0 }]);
  // the north wing's partitions: bunks 1 | bunks 2 (n12, z 5.8..7) · bunks 2 | armoury · armoury | day room
  wallZ(N12, Z0 + 0.12, NZ - 0.06, 0.12, iw, [{ a: 5.8, b: 7.0 }]); wallZ(N23, Z0 + 0.12, NZ - 0.06, 0.12, iw); wallZ(N34, Z0 + 0.12, NZ - 0.06, 0.12, iw);
  // the south wing's: bunks 3 | bunks 4 · bunks 4 | bunks 5 · bunks 5 | wash room (s34, z 21.8..23)
  wallZ(S12, SZ + 0.06, Z1 - 0.12, 0.12, iw); wallZ(S23, SZ + 0.06, Z1 - 0.12, 0.12, iw); wallZ(S34, SZ + 0.06, Z1 - 0.12, 0.12, iw, [{ a: 21.8, b: 23.0 }]);
  // FIRE DOORS: two cross walls in each gallery, a door in each. No straight run of gallery is much longer than eleven metres, and a man coming down one opens a door to do it
  for (const x of NG_FIRE) wallZ(x, NZ + 0.06, NY - 0.12, 0.12, iw, [{ a: 8.8, b: 10.0 }]);
  for (const x of SG_FIRE) wallZ(x, SY + 0.12, SZ - 0.06, 0.12, iw, [{ a: 17.8, b: 19.0 }]);

  // ---------------- the mess hall (x 4..12.25, z 8.25..19.75): the big room, six doors ----------------
  // Two pillars down its middle, four mess tables, the servery on the north wall. front (west) · h_yard (east) · h_n / h_s (the galleries) · k_hall · o_hall.
  grp('hall');
  add({ c: [8.15, H / 2, 12.0], h: [0.25, H / 2, 0.25], albedo: C.concrete }); add({ c: [8.15, H / 2, 16.0], h: [0.25, H / 2, 0.25], albedo: C.concrete });
  messTable(5.9, 11.0, false); messTable(10.2, 11.6, false); messTable(5.9, 17.6, false); messTable(10.2, 16.2, false);
  add({ c: [9.75, 0.5, 8.7], h: [1.15, 0.5, 0.3], albedo: C.white, ...mk(MD.cupboardMarks([1.15, 0.5, 0.3], '+z', 3, TX)) }); add({ c: [9.75, 1.03, 8.7], h: [1.2, 0.03, 0.34], albedo: [0.2, 0.2, 0.22] });   // the servery
  wallArt(4.135, 1.6, 13.6, 1.6, 0.9, [0.2, 0.35, 0.3], false);                                           // notice board beside the front door
  add({ c: [4.14, 2.47, 15.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });      // exit sign over the front door
  chair(5.4, 16.2, 0.6, [0.5, 0.5, 0.48]); bin(4.5, 16.5); cardboardBox(4.6, 12.2, 0.5, 0.2);            // loose things along the walls, clear of every door
  cardboardBox(11.6, 14.6, 0.55, 0.1);
  chair(11.5, 10.6, 2.4, [0.5, 0.5, 0.48]);
  cardboardBox(11.2, 19.35, 0.5, 0.3);
  cardboardBox(6.0, 19.35, 0.5, 0.2);
  // LOOSE THINGS AND DOORS: nothing a man can push stands in a gallery or within a leaf's length (1.7 m of the hinge) of a door on its own side of
  // the wall — on the warehouse map two cartons were walked ten metres down a corridor into a doorway and jammed the leaf for the rest of a run.
  ceilingPanel(6.6, 10.6, true, 'hall'); ceilingPanel(9.8, 14.2, false, 'hall'); ceilingPanel(6.6, 17.6, true, 'hall', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- the galley (x 4..12.25, z 4..8.25): k_hall on the mess hall, k_out on the north face ----------------
  grp('galley');
  add({ c: [4.5, 0.45, 6.2], h: [0.35, 0.45, 1.6], albedo: C.white, ...mk(MD.cupboardMarks([0.35, 0.45, 1.6], '+x', 4, TX)) }); add({ c: [4.5, 0.92, 6.2], h: [0.38, 0.03, 1.65], albedo: [0.2, 0.2, 0.22] });   // counter along the west wall
  add({ c: [7.5, 0.45, 4.5], h: [1.0, 0.45, 0.35], albedo: [0.2, 0.2, 0.22], rough: 0.4 });              // the range under the window
  add({ c: [5.6, 1.0, 4.6], h: [0.45, 1.0, 0.4], albedo: [0.75, 0.75, 0.74] });                          // fridge
  add({ c: [8.6, 0.45, 6.3], h: [0.9, 0.45, 0.45], albedo: C.metal });                                   // the island: steel, waist high
  cardboardBox(11.6, 4.7, 0.5, 0.2); bin(11.7, 5.6); cardboardBox(8.8, 7.7, 0.45, 0.3);
  ceilingPanel(8.0, 6.3, true, 'galley', false, 1.2, 0.6, [4.5, 6.0, 9.0]);

  // ---------------- the duty office (x 4..12.25, z 19.75..24): EMPTY. o_hall on the mess hall, o_s1 into bunks 3 ----------------
  grp('duty');
  desk(6.4, 22.4, 1.8, 0.8, Math.PI / 2); monitor(6.3, 22.4, Math.PI / 2, true); chair(7.3, 22.4, -Math.PI / 2); papers(6.4, 0.76, 21.8, 0.3);
  cabinet(4.5, 20.3, -Math.PI / 2); cabinet(4.5, 20.9, -Math.PI / 2); shelf(10.4, 23.6, 2.4, 0.45, 0, 4, 1.9);
  const brk = add({ c: [4.16, 1.35, 22.6], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [4.21, 1.62, 22.42], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  bin(11.7, 20.1); cardboardBox(11.88, 23.5, 0.5, 0);
  ceilingPanel(8.0, 21.8, false, 'duty');

  // ---------------- the north wing ----------------
  grp('bunks1');   // EMPTY. n1 on the gallery, n12 into bunks 2
  cot(13.4, 4.62, true); cot(16.2, 4.62, true); cot(12.8, 6.9, false); locker(17.85, 7.5, false);
  chair(16.8, 7.4, 0.4, [0.5, 0.5, 0.48]);
  ceilingPanel(15.2, 6.2, false, 'bunks1');
  grp('bunks2');   // EMPTY AND DARK (it was held: its man is the gallery post's second). n2 on the gallery, n12 from bunks 1
  cot(19.9, 4.62, true); cot(22.2, 4.62, true); locker(22.85, 6.6, false);
  chair(21.2, 6.3, -0.4, [0.5, 0.5, 0.48]); cardboardBox(21.05, 5.35, 0.5, 0.2);
  ceilingPanel(20.8, 6.2, false, 'bunks2');   // off: nothing burns in a room nobody holds (it was on while the room was held)
  grp('arms');     // EMPTY: the armoury. One door, no window: racking on three walls, a pallet on the floor
  shelf(25.25, 4.45, 3.2, 0.45, 0, 4, 1.9); shelf(23.62, 6.3, 2.2, 0.45, Math.PI / 2, 4, 1.9); shelf(26.88, 6.0, 2.6, 0.45, Math.PI / 2, 4, 1.9);
  pallet(25.3, 6.2, 1.0, 0.8);
  ceilingPanel(25.3, 7.0, false, 'arms', false, 1.2, 0.3);
  grp('day');      // HELD. Two doors on the gallery (n4a, n4b); a locker off the south wall between them, a table, a settee
                   // (n4b stands 0.9 m off the east wall, so four coming in by it get no east hand and two of their points fall down the door's line, and the
                   // gallery entry by n_end leaves a man on its threshold. Moving it west was tried and taken back — x 33..34.2, and 33.4..34.6: the scripted
                   // squad then lost 8 to 10 more runs in 48. With the door moved the man on n_end's third point is dealt a place 0.5 m on, loses his line
                   // through the yard wall's east opening onto the defender who comes to hold the yard, and that defender's grenade finds the squad bunched
                   // in the gallery's end. Whoever moves this door next: count the runs)
  locker(31.9, 7.68, false);
  add({ c: [31.6, 0.72, 5.4], h: [0.8, 0.03, 0.4], albedo: C.wood }); for (const s of [-0.6, 0.6]) add({ c: [31.6 + s, 0.35, 5.4], h: [0.04, 0.35, 0.3], albedo: C.metal });   // the table
  chair(31.0, 6.2, 0.2, [0.5, 0.5, 0.48]); chair(32.3, 6.2, -0.3, [0.5, 0.5, 0.48]); papers(31.7, 0.75, 5.4, 0.4);
  add({ c: [29.4, 0.22, 4.6], h: [1.0, 0.22, 0.42], albedo: [0.3, 0.12, 0.1] }); add({ c: [29.4, 0.6, 4.28], h: [1.0, 0.35, 0.12], albedo: [0.3, 0.12, 0.1] });   // the settee, its back to the north wall
  shelf(35.5, 5.15, 2.0, 0.45, Math.PI / 2, 4, 1.9);   // on the east wall, up in the north-east corner (z 4.15..6.15). At z 5..7 it took the floor east of n4b: four
                                                       // coming in by that door had no east hand and two of their points fell down the door's line (barracks-check B2)
  cardboardBox(27.75, 5.45, 0.5, 0.2); bin(27.7, 4.6); cardboardBox(34.7, 6.2, 0.55, 0.1); chair(33.2, 5.3, -2.2, [0.5, 0.5, 0.48]);
  ceilingPanel(30.0, 6.0, true, 'day'); ceilingPanel(34.0, 6.2, false, 'day');

  // ---------------- the south wing ----------------
  grp('bunks3');   // HELD. s1 on the gallery, o_s1 from the duty office
  cot(12.8, 20.85, false); cot(14.9, 23.38, true); cot(17.6, 23.38, true); locker(18.85, 20.4, false); locker(18.85, 21.4, false);
  chair(16.8, 20.3, 2.8, [0.5, 0.5, 0.48]); cardboardBox(13.45, 23.45, 0.5, 0.2); bin(12.7, 23.5);
  ceilingPanel(15.6, 21.8, true, 'bunks3');
  grp('bunks4');   // EMPTY. s2 on the gallery
  cot(20.3, 23.38, true); cot(23.2, 23.38, true); cot(19.8, 20.85, false); locker(24.85, 20.4, false); locker(24.85, 21.4, false);
  chair(23.6, 20.4, 2.4, [0.5, 0.5, 0.48]);
  ceilingPanel(22.2, 21.8, false, 'bunks4');
  grp('bunks5');   // HELD. s3 on the gallery, s34 from the wash room
  cot(26.6, 23.38, true); cot(29.1, 20.35, true); locker(25.65, 20.5, false);
  cardboardBox(28.0, 22.6, 0.5, 0.2); bin(28.6, 23.5);
  ceilingPanel(27.8, 21.8, true, 'bunks5', true);
  grp('wash');     // EMPTY. s4 on the gallery, s34 into bunks 5: a trough of basins on the south wall, racking, cartons
  add({ c: [33.4, 0.42, 23.5], h: [1.6, 0.42, 0.32], albedo: C.white }); add({ c: [33.4, 0.86, 23.5], h: [1.64, 0.03, 0.35], albedo: [0.75, 0.75, 0.74] });
  shelf(35.5, 21.0, 2.0, 0.45, Math.PI / 2, 4, 1.9);
  cardboardBox(31.0, 20.3, 0.55, 0.2); cardboardBox(35.45, 23.3, 0.45, -0.3); bin(34.6, 20.2);
  ceilingPanel(33.0, 21.8, false, 'wash');

  // ---------------- the galleries: bare floor (nothing loose: see the mess hall's note), a strip light every eight metres ----------------
  // WHICH BURN: two of the south gallery's three — the west one (x 15.5) outside bunks 3's door, the east one (x 31.0) outside the WASH ROOM, a room east of
  // bunks 5's door s3 (x 26.8), whose own stretch has the dark middle strip (x 22.5) to its west — whoever walks it is lit; the north gallery's are all off: the post at its
  // east end stands dark and looks across the yard at a lit gallery, and nothing burns outside a room nobody holds
  grp('galleries');
  ceilingPanel(16.0, 9.5, false, 'ngal', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(24.0, 9.5, false, 'ngal', false, 1.2, 0.3); ceilingPanel(31.5, 9.5, false, 'ngal', false, 1.2, 0.3, [7, 6.8, 6.4]);
  ceilingPanel(15.5, 18.5, true, 'sgal', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(22.5, 18.5, false, 'sgal', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(31.0, 18.5, true, 'sgal', false, 1.2, 0.3, [7, 6.8, 6.4]);
  add({ c: [35.86, 2.47, 9.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] }); add({ c: [35.86, 2.47, 18.4], h: [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });   // exit signs over the end doors

  // ---------------- the yard: a lawn down its middle, four planters and a cistern to fight from ----------------
  grp('yard');
  planter(16.6, 14.0, 0.4, 1.0); planter(32.0, 14.0, 0.4, 1.0); planter(24.4, 12.0, 1.2, 0.4); planter(27.4, 16.0, 1.2, 0.4);
  add({ c: [21.0, 0.55, 14.8], h: [0.7, 0.55, 0.7], albedo: C.concrete }); add({ c: [21.0, 1.13, 14.8], h: [0.76, 0.03, 0.76], albedo: C.metal });   // the cistern
  bench(14.6, 11.3, 0); bench(30.0, 16.7, 0);

  // ---------------- outside ----------------
  grp('exterior');
  car(38.7, 11.2, Math.PI / 2, [0.2, 0.23, 0.18]);                                                       // a pickup on the east side, off the north end door and the arch's north half
  pallet(37.2, 25.6, 1.2, 1.0);
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3, on = true) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, albedo: [0.16, 0.17, 0.18] });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: on ? [40, 24, 7] : [0, 0, 0], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: [dir[0] * 0.35, -1, dir[2] * 0.35], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name, group: 'exterior', enabled: on, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true });
  };
  lampAt(12.8, 14.4, 'yard_lamp', [1, 0, 0]);          // by the mess hall's yard wall between its door and its window, over the yard's west end: the east end and the arch stay in the moon's light alone
  lampAt(1.8, 13.2, 'front_lamp', [1, 0, 0]);          // over the front door
  lampAt(38.9, 5.2, 'lot_lamp', [-1, 0, 0]);           // the north-east corner: the north end door is lit, the south one is not
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(8.2, 14.0); beacon(22.0, 9.4); beacon(24.0, 18.6);

  // ---------------- doors (closedDir 0: the leaf runs +x from the hinge along an x-wall; π/2: +z along a z-wall). Seven open from outside ----------------
  const dx = (name: string, a: number, z: number, exterior = false): LevelDoorDef => ({ name, hinge: [a + 0.02, z], closedDir: 0, width: 1.16, ...(exterior ? { exterior } : {}) });
  const dz = (name: string, x: number, a: number, exterior = false): LevelDoorDef => ({ name, hinge: [x, a + 0.02], closedDir: Math.PI / 2, width: 1.16, ...(exterior ? { exterior } : {}) });
  const doorDefs: LevelDoorDef[] = [
    dz('front', X0, 14.8, true), dx('k_out', 9.8, Z0, true), dz('n_end', X1, 8.8, true), dz('s_end', X1, 17.8, true),          // from outside the building
    dx('n_yard', 18.8, NY, true), dx('s_yard', 23.8, SY, true), dz('h_yard', LX, 12.8, true),                                 // onto the yard
    dz('h_n', LX, 8.8), dz('h_s', LX, 17.8), dx('k_hall', 6.8, NZ), dx('o_hall', 8.8, SZ), { ...dz('o_s1', LX, 21.8), minAngle: -1.5 },             // the link block's
    dx('n1', 14.8, NZ), dx('n2', 20.8, NZ), { ...dx('n3', 25.8, NZ), maxAngle: 1.3 }, { ...dx('n4a', 28.8, NZ), swing: 1 }, dx('n4b', 33.8, NZ), { ...dz('n12', N12, 5.8), swing: 1 },   // the north wing's
    { ...dx('s1', 14.8, SZ), swing: -1 }, dx('s2', 21.8, SZ), dx('s3', 26.8, SZ), dx('s4', 32.8, SZ), { ...dz('s34', S34, 21.8), swing: -1 },                     // the south wing's
    dz('ng_w', NG_FIRE[0], 8.8), dz('ng_e', NG_FIRE[1], 8.8), dz('sg_w', SG_FIRE[0], 17.8), dz('sg_e', SG_FIRE[1], 17.8),          // the galleries' fire doors
  ];
  // ANOTHER WAY IN (tools/qa/second-way-check.ts): a held room whose two doors could both stand wedged has one hung to open OUT of it, which no wedge holds —
  // the day room's west door n4a (onto the gallery), bunks 2's n12 (into bunks 1's lobby: hung so while bunks 2 was held; the room is empty now and the swing is
  // only how the door hangs), bunks 3's s1 (into its lobby off the south gallery: the duty office
  // behind o_s1 is itself shut when the mess hall wedges o_hall), bunks 5's s34 (into bunks 4's lobby).
  // Two swings are stopped short: o_s1 into bunks 3 (a cot stands past its jamb) and n3 into the gallery (wide open it would cross the fire door's leaf).
  for (const d of doorDefs) doorFrame(d);

  // ---------------- LIVED IN (src/scene/lived.ts: every box below is in a group 'lived.<place>', every prop named 'lived.<place>.…' — the loader leaves them all
  // out with the switch off, and then this is the barracks above, box for box). A police battalion's lines: what makes each room ITS room. The five bunk rooms are
  // told apart by WHO sleeps there, said with one blanket a bed: recruits (brown-grey issue blankets, square, bunks stacked two high on the north wall), sergeants
  // (red quilts, a tunic with chevrons and a peaked cap on each), the standby section (blue blankets thrown back, vest and helmet on every bed), nobody (bare
  // springs, mattresses rolled in ticking), the sick (white sheets, a red cross: bunks 5 is the sick bay). Rules kept: nothing solid or loose within 1.1 m of a
  // door's line or in a leaf's sweep (a loose thing 1.7 m off a hinge), 2.1 m of bare wall beside every jamb that is free today, nothing on a mark or a start,
  // nothing over 1.1 m across a mark's line to its door, nothing drawn-only that could hide a man. NOTHING SOLID OR LOOSE STANDS IN A GALLERY: what the two
  // walks have is drawn only — hung flat on a wall (boards, the bell, the fire buckets, a boot shelf, capes) or paint and mats on the floor. CLOTH: what lies on
  // a bed, a shelf or a stack is drawn only (an unnamed paint on a solid breaks as sheet steel, and the look repaints a plain grey as galvanised); cloth that
  // stands on the floor as cover is C.chair, the soft paint. No light, nothing lit. Held and empty rooms are
  // furnished alike. LAST in the lists on purpose (tools/levels/export.ts): the lived boxes are the tail of the boxes, the lived props the tail of the props.
  {
    const L = livedKit(K), P = L.P, NS = BoxFlag.NoShadow;
    const IRON: Vec3 = [0.13, 0.13, 0.14], TIN: Vec3 = [0.55, 0.56, 0.55], YELLOW: Vec3 = [0.72, 0.58, 0.1];
    const KHAKI: Vec3 = [0.4, 0.35, 0.2];
    const BOILER: Vec3 = [0.46, 0.46, 0.48], QUILT: Vec3 = [0.45, 0.07, 0.07], SERGE: Vec3 = [0.14, 0.17, 0.27], TICK: Vec3 = [0.74, 0.72, 0.64];
    const BLANKET: Vec3 = [0.4, 0.33, 0.25];                                                                     // the issue blanket: brown-grey (a plain grey is steel to the break rules and galvanised to the look)
    /** a thing LAID on a bed, a shelf or a stack: drawn only (y = its foot) */
    const laid = (x: number, y: number, z: number, hx: number, hy: number, hz: number, albedo: Vec3, yaw = 0) => add({ c: [x, y + hy, z], h: [hx, hy, hz], yaw, albedo, flags: NS });
    /** a slab lying on a cot's mattress (cot() above: 1.84 × 0.84, top 0.55): from u0 to u1 of its length (0 = the west / north end), t thick, its foot at y */
    const onCot = (x: number, z: number, alongX: boolean, u0: number, u1: number, t: number, albedo: Vec3, y = 0.55, flags = 0) => {
      const a = -0.9 + u0 * 1.8, b = -0.9 + u1 * 1.8, m = (a + b) / 2, hl = (b - a) / 2;
      return add({ c: alongX ? [x + m, y + t / 2, z] : [x, y + t / 2, z + m], h: alongX ? [hl, t / 2, 0.4] : [0.4, t / 2, hl], albedo, ...(flags ? { flags } : {}) }); };
    /** a second bunk over a cot that runs along x: two end frames, a frame, a mattress (its top at 1.53 m; the mattress is cloth on a bed: drawn only) */
    const upperBunk = (x: number, z: number) => {
      for (const s of [-1, 1]) add({ c: [x + s * 0.935, 0.85, z], h: [0.015, 0.45, 0.43], albedo: C.metal });
      add({ c: [x, 1.34, z], h: [0.95, 0.04, 0.45], albedo: C.metal }); add({ c: [x, 1.455, z], h: [0.92, 0.075, 0.42], albedo: [0.3, 0.33, 0.27], flags: NS }); };
    /** a round pot: one square turned a little (two squares an eighth of a turn apart read as a cog from above) */
    const pot = (x: number, y: number, z: number, r: number, h: number) => { add({ c: [x, y + h / 2, z], h: [r, h / 2, r], yaw: 0.3, albedo: TIN }); };
    /** a motorbike, local +X forward: every part rests on another (wheels 0‥0.6, the engine between them up to the tank, the seat on the rear wheel against the
     *  tank, the bars on the tank's front) */
    const motorbike = (x: number, z: number, yaw: number) => { const at = K.frameAt(x, z, yaw);
      for (const lx of [-0.65, 0.65]) add({ c: at(lx, 0.3, 0), h: [0.3, 0.3, 0.055], yaw, albedo: C.black });
      add({ c: at(0, 0.45, 0), h: [0.36, 0.17, 0.1], yaw, albedo: IRON });                                       // engine: 0.28‥0.62, into both wheels
      add({ c: at(0.18, 0.72, 0), h: [0.24, 0.1, 0.13], yaw, albedo: C.red });                                   // tank: 0.62‥0.82
      add({ c: at(-0.35, 0.7, 0), h: [0.3, 0.1, 0.12], yaw, albedo: C.black });                                  // seat: 0.6‥0.8
      add({ c: at(0.4, 0.87, 0), h: [0.02, 0.05, 0.3], yaw, albedo: IRON }); };                                  // bars: 0.82‥0.92, on the tank's front edge

    // ---- THE GALLEY — the cook house, institutional size: stock pots on the range, a wide pan and the trays on the island, gas, rice, bread
    L.room('galley');
    pot(7.0, 0.9, 4.5, 0.24, 0.34); pot(7.9, 0.9, 4.5, 0.24, 0.34);                                              // two stock pots on the range
    pot(8.15, 0.9, 6.3, 0.24, 0.17);                                                                             // the wide pan on the island
    L.thing(8.95, 0.9, 6.25, 0.17, 0.09, 0.24, [0.66, 0.67, 0.66]);                                              // a stack of steel trays
    for (const z of [4.36, 4.68]) add({ c: [6.275, 0.4, z], h: [0.14, 0.4, 0.14], albedo: C.red });              // gas bottles in the slot between fridge and range
    add({ c: [11.8, 0.135, 6.4], h: [0.34, 0.135, 0.44], albedo: C.cardboard }); laid(11.84, 0.27, 6.36, 0.3, 0.11, 0.4, P.canvas);   // rice on the east wall: cartons, a sack on them (cloth on a stack: drawn only)
    L.duckboard(6.5, 4.95, 7.9, 5.65, 2);                                                                        // in front of the range
    L.thing(4.5, 0.95, 6.95, 0.2, 0.012, 0.15, C.wood); L.thing(4.5, 0.974, 6.95, 0.13, 0.04, 0.11, [0.72, 0.6, 0.4]);   // a bread board on the counter, flat breads stacked
    L.looseCrate(10.45, 7.3, 0.5, 0.36, 0.3); L.bucket(5.2, 5.45, YELLOW);                                       // a vegetable crate, an oil tin

    // ---- THE MESS HALL — rank in one cloth: the officers' table is laid with a cream cloth, the men's have a jug each; tea at the servery
    L.room('hall');
    { const y0 = 0.75, y1 = 0.762, G: Vec3 = [0.78, 0.73, 0.58];                                                   // the cream cloth on the north-west table (in four, round the mug the dressing stands there)
      slab(5.52, y0, 10.22, 6.28, y1, 10.575, G, { flags: NS }); slab(5.52, y0, 10.745, 6.28, y1, 11.78, G, { flags: NS }); slab(5.52, y0, 10.575, 5.635, y1, 10.745, G, { flags: NS }); slab(5.805, y0, 10.575, 6.28, y1, 10.745, G, { flags: NS }); }   // (drawn only: the look repaints a low green solid as a brown blanket, and keeps a drawn-only thing above the floor as authored)
    for (const [x, z] of [[10.2, 10.98], [9.95, 16.2], [5.9, 18.25]] as const) L.thing(x, 0.75, z, 0.06, 0.11, 0.06, TIN);   // a water jug on each of the other three
    for (const z of [8.52, 8.88]) L.thing(10.8, 1.06, z, 0.09, 0.19, 0.09, TIN);                                 // two tea urns at the servery's east end

    // ---- THE DUTY OFFICE — the charge office: the holding bench and its painted box on the north wall (where the camera sees it), the property safe on the
    // south wall east of the desk (2.1 m and more off both doors' jambs, in reach of the man at the desk), the radio table against the west wall between the
    // cabinets and the breaker (one base set), the red telephone at the operator's hand
    L.room('duty');
    add({ c: [5.55, 0.43, 20.07], h: [0.7, 0.02, 0.2], albedo: C.woodDark }); for (const x of [4.91, 6.19]) add({ c: [x, 0.205, 20.07], h: [0.03, 0.205, 0.18], albedo: C.metal });   // the holding bench on the north wall
    L.hung(5.55, 19.83, true, 1.4, 0.95, 1.0, IRON);                                                             // its rail
    L.mat(4.85, 20.3, 6.25, 20.35, C.white); L.mat(4.85, 20.71, 6.25, 20.76, C.white); L.mat(4.85, 20.35, 4.9, 20.71, C.white); L.mat(6.2, 20.35, 6.25, 20.71, C.white);   // the painted box a held man keeps his feet in: an outline
    for (const x of [5.15, 5.95]) add({ c: [x, 0.905, 19.87], h: [0.045, 0.045, 0.012], albedo: TIN, flags: NS });   // handcuffs locked on the rail (hanging from its underside)
    add({ c: [8.6, 0.4, 23.62], h: [0.2, 0.4, 0.22], albedo: IRON });                                            // the property safe, south wall under the window
    L.table(4.42, 21.78, 0.58, 0.95, 0, C.woodDark, 0.74);                                                       // the radio table on the west wall: x 4.13..4.71, z 21.3..22.26
    L.thing(4.32, 0.74, 21.98, 0.17, 0.13, 0.24, P.oliveDrab);                                                   // the base set
    L.thing(4.6, 0.74, 22.08, 0.035, 0.03, 0.1, C.black, 0.3);                                                   // its handset
    L.thing(4.27, 0.74, 21.45, 0.09, 0.03, 0.12, C.black);                                                       // the charger
    L.thing(4.6, 0.74, 21.72, 0.1, 0.015, 0.14, P.paper);                                                      // the occurrence book
    L.thing(4.57, 0.74, 21.43, 0.07, 0.035, 0.09, C.red);                                                        // the red telephone, on the stool's side
    L.stool(5.1, 21.75); L.carton(5.3, 23.4, 0.5, 0.2);                                                          // the operator's stool, lost property

    // ---- BUNKS 1 — the recruits, FIVE BERTHS: bunks stacked two high on the north wall (to 1.57 m), each with its ladder on the long side at the bunk's OUTER
    // end, every bed with its brown-grey blanket; kit laid out on the two uppers and the single (the lowers' lies under the bunk above: not drawn). Foot lockers a
    // good stride (1.04 m) off the bunks in one row of four (the aisle between is open at its east end, 2 m wide), the single's beside his cot; boots toe to a white line
    L.room('bunks1');
    for (const [x, s] of [[13.4, -1], [16.2, 1]] as const) { upperBunk(x, 4.62);
      add({ c: [x + 0.12, 1.545, 4.62], h: [0.7, 0.015, 0.29], albedo: BLANKET, flags: NS }); onCot(x, 4.62, true, 0.16, 1, 0.03, BLANKET, 0.55, NS);  // the blankets, upper and lower (drawn only, as all bedding)
      laid(x - 0.1, 1.56, 4.62, 0.1, 0.03, 0.1, P.oliveDrab);                                                   // a folded shirt laid out on the upper
      const lx = x + s * 0.72;                                                                                   // the ladder: on the long side, at the end away from the other bunk
      for (const dx of [-0.19, 0.19]) add({ c: [lx + dx, 0.66, 5.2], h: [0.02, 0.66, 0.13], albedo: C.metal });
      add({ c: [lx, 0.7, 5.2], h: [0.19, 0.012, 0.04], albedo: C.metal }); }                                     // (one rung drawn)
    onCot(12.8, 6.9, false, 0.16, 1, 0.03, BLANKET, 0.55, NS);                                                   // the west cot's blanket,
    laid(12.8, 0.58, 6.75, 0.1, 0.03, 0.1, P.oliveDrab);                                                         // his shirt on it
    for (const x of [13.65, 14.35, 15.05, 15.75]) add({ c: [x, 0.19, 6.3], h: [0.33, 0.19, 0.19], albedo: C.woodDark });   // four foot lockers in a row a stride off the bunks: the aisle between is entered from the east
    add({ c: [13.6, 0.19, 7.0], h: [0.19, 0.19, 0.33], albedo: C.woodDark });                                    // the fifth beside the single cot
    L.mat(13.9, 7.2, 16.3, 7.27, C.white);                                                                     // the inspection line
    for (let k = 0; k < 5; k++) add({ c: [14.1 + k * 0.5, 0.06, 7.07], h: [0.11, 0.06, 0.12], albedo: C.black, flags: NS });   // five pairs of boots, toes to it
    L.stool(17.38, 4.32);                                                                                        // a stool at the east bunk's end (1.73 m off the door's hinge: a leaf's length and more)

    // ---- BUNKS 2 (empty now; it was held when this was laid) — the sergeants: two beds only, thick red quilts, one pillow each, and RANK where the camera sees it: a pressed tunic laid on each
    // quilt, three white chevrons on its sleeve (drawn only), a peaked cap on each pillow (the red band showing round the crown), ONE polished brown pair of
    // boots a man (at his bed's foot: none at the door); the level's one brass tea tray on a dark red mat beside the east bed (drawn only: the marks' floor is
    // what it was). All of the bedding and what lies on it is drawn only
    L.room('bunks2');
    for (const x of [19.9, 22.2]) { onCot(x, 4.62, true, 0.22, 1, 0.06, QUILT, 0.55, NS); laid(x - 0.68, 0.55, 4.62, 0.13, 0.04, 0.3, C.white);
      add({ c: [x + 0.25, 0.619, 4.6], h: [0.2, 0.008, 0.25], albedo: KHAKI, flags: NS });                       // the tunic,
      add({ c: [x + 0.52, 0.621, 4.72], h: [0.07, 0.008, 0.2], yaw: 0.3, albedo: KHAKI, flags: NS });            // its sleeve laid out,
      for (let k = 0; k < 3; k++) add({ c: [x + 0.53 + k * 0.015, 0.632, 4.7 + k * 0.055], h: [0.06, 0.003, 0.014], yaw: 0.3, albedo: C.white, flags: NS });   // the three chevrons
      laid(x - 0.68, 0.63, 4.5, 0.105, 0.018, 0.105, C.red); laid(x - 0.68, 0.666, 4.5, 0.075, 0.022, 0.075, KHAKI);   // the cap on the pillow: band, crown
      add({ c: [x + 0.68, 0.06, 5.2], h: [0.065, 0.06, 0.11], albedo: [0.1, 0.07, 0.05], flags: NS }); }         // his boots at the bed's foot
    L.mat(21.4, 5.2, 22.15, 5.8, [0.42, 0.1, 0.08], 0.036);                                                     // a dark red mat beside the east bed,
    add({ c: [21.72, 0.049, 5.5], h: [0.2, 0.012, 0.17], albedo: P.brass, flags: NS });                         // the tray on it,
    add({ c: [21.67, 0.111, 5.48], h: [0.05, 0.05, 0.05], albedo: P.enamelBlue, flags: NS });                     // its pot
    L.looseCrate(19.9, 6.75, 0.4, 0.3, 0.28, 0, C.woodDark);                                                     // a trunk, on its own west of the chair

    // ---- THE ARMOURY — the rifle rack back to back with the ammunition pallet, facing the door over the issue line (eight slots, two empty): every run of
    // racking is clear. Tins on the pallet, helmets on the east racking's top, the cleaning mat and the armourer's stool together in the south-west corner, the crates in the north-west one
    L.room('arms');
    add({ c: [25.3, 0.55, 6.63], h: [0.65, 0.55, 0.025], albedo: C.wood }); add({ c: [25.3, 0.07, 6.8], h: [0.64, 0.07, 0.15], albedo: C.wood });   // the rack: back board and butt trough
    for (let k = 0; k < 8; k++) if (k !== 2 && k !== 5) add({ c: [24.74 + k * 0.16, 0.64, 6.74], h: [0.022, 0.5, 0.045], albedo: C.black });   // six rifles, muzzle up
    L.mat(23.9, 7.15, 24.8, 7.95, P.rubberMat);                                                                  // the cleaning mat
    for (const x of [25.0, 25.25, 25.5]) L.thing(x, 1.0, 6.1, 0.09, 0.09, 0.15, P.oliveDrab);                    // three ammunition tins on the pallet
    for (const z of [5.2, 5.9, 6.6]) L.thing(26.88, 1.865, z, 0.12, 0.07, 0.14, [0.2, 0.21, 0.16]);              // helmets on the east racking's top
    add({ c: [23.6, 0.15, 4.935], h: [0.17, 0.15, 0.255], albedo: C.wood }); add({ c: [23.6, 0.44, 4.935], h: [0.15, 0.14, 0.24], albedo: P.oliveDrab });   // a wooden crate, an olive one on it: the north-west corner, between the two rackings' end panels (z 4.67 and 5.20). The south wall west of the door is where four men stack to leave: nothing solid stands on it
    L.mat(24.9, 7.35, 27.1, 7.43, YELLOW);                                                                       // the issue line, between the rack and the door: 0.4 m off the rack's face, room for the armourer on his side of it
    L.stool(24.05, 7.3); L.looseCrate(24.2, 5.0, 0.4, 0.3, 0.2, 0, P.oliveDrab);                                 // the armourer's stool on the mat, 0.6 m from each of the three marks round it (a prop: no check asks about it), a loose ammunition box in the north-west corner

    // ---- THE DAY ROOM (held: touched lightly) — carrom in front of the settee with a stool either side; the level's one television HUNG on the north wall's
    // east end on a bracket (drawn only: the south wall between the two doors is jamb wall, and there its back was to the camera; here its screen faces the
    // camera and the room), two stools before it; the volleyball trophies on a low cabinet beside it
    L.room('day');
    add({ c: [34.95, 1.3, 4.165], h: [0.03, 0.03, 0.045], albedo: IRON, flags: NS });                            // the television's bracket,
    add({ c: [34.95, 1.35, 4.25], h: [0.24, 0.18, 0.04], albedo: C.black, flags: NS }); add({ c: [34.95, 1.35, 4.293], h: [0.21, 0.15, 0.003], albedo: C.screenOff, flags: NS });   // the set, its screen to the south
    add({ c: [29.3, 0.22, 6.0], h: [0.22, 0.22, 0.22], albedo: C.woodDark }); add({ c: [29.3, 0.46, 6.0], h: [0.4, 0.02, 0.4], albedo: C.woodDark }); add({ c: [29.3, 0.487, 6.0], h: [0.35, 0.008, 0.35], albedo: C.wood });   // the carrom board on its stand
    add({ c: [33.72, 0.4, 4.34], h: [0.38, 0.4, 0.2], albedo: C.woodDark });                                      // a low cabinet on the north wall,
    for (const [x, hy] of [[33.47, 0.09], [33.72, 0.14], [33.97, 0.09]] as const) L.thing(x, 0.8, 4.34, 0.07, hy, 0.07, P.brass, 0.3);   // the trophies on it
    L.stool(28.62, 6.0, C.partRed); L.stool(29.98, 6.0);                                                         // two stools at the board
    L.stool(34.0, 5.85); L.stool(35.08, 5.62, C.partRed);                                                        // two before the television

    // ---- BUNKS 3 (held) — the standby section, ready to turn out: two riot shields stood in a floor rack between the south beds with three batons, the third
    // shield (a white band across its face) stood against the north wall under the duty roster where the camera sees it, a pair of boots at each bed's foot
    // toe out, a vest and a helmet on every bed, blue blankets thrown back (bedding and kit on the beds: drawn only), tea on a ring
    L.room('bunks3');
    for (const x of [14.9, 17.6]) { onCot(x, 23.38, true, 0.35, 1, 0.035, SERGE, 0.55, NS);
      laid(x - 0.62, 0.55, 23.38, 0.2, 0.05, 0.16, P.oliveDrab); laid(x - 0.62, 0.65, 23.3, 0.11, 0.07, 0.13, [0.16, 0.17, 0.15]);
      add({ c: [x + 1.1, 0.06, 22.8], h: [0.11, 0.06, 0.12], albedo: C.black, flags: NS }); }                     // his boots
    onCot(12.8, 20.85, false, 0.3, 1, 0.035, SERGE, 0.55, NS);                                                   // the west cot's
    laid(12.8, 0.55, 20.25, 0.16, 0.05, 0.2, P.oliveDrab); laid(12.88, 0.65, 20.25, 0.13, 0.07, 0.11, [0.16, 0.17, 0.15]);
    add({ c: [13.42, 0.06, 20.5], h: [0.12, 0.06, 0.11], albedo: C.black, flags: NS });
    add({ c: [16.25, 0.04, 23.45], h: [0.27, 0.04, 0.2], albedo: C.woodDark });                                  // the shield rack between the two south beds' ends (beside the west bed it stood on the marks four men take to stack on the office door, o_s1)
    for (let k = 0; k < 2; k++) add({ c: [16.25, 0.56, 23.35 + k * 0.16], h: [0.25, 0.5, 0.02], albedo: C.black });   // two shields on edge in it (1.06 m)
    for (let k = 0; k < 3; k++) add({ c: [16.07 + k * 0.18, 0.4, 23.62], h: [0.018, 0.32, 0.018], albedo: C.wood, flags: NS });   // three batons stood in the rack's end
    L.hung(17.6, 19.825, true, 1.4, 1.2, 2.0, C.white, 0.03);                                                    // the duty roster, north wall
    add({ c: [17.6, 0.5, 19.865], h: [0.25, 0.5, 0.02], albedo: C.black, flags: NS });                           // the third shield upright against the wall under it (drawn only),
    add({ c: [17.6, 0.68, 19.888], h: [0.25, 0.07, 0.004], albedo: C.white, flags: NS });                        // the white band across its face
    add({ c: [18.9, 0.25, 22.25], h: [0.24, 0.25, 0.24], albedo: C.wood }); L.thing(18.9, 0.5, 22.25, 0.11, 0.025, 0.11, IRON); L.thing(18.9, 0.55, 22.25, 0.085, 0.075, 0.085, TIN);   // a tea crate on the east wall, a gas ring, the kettle
    L.looseCrate(15.2, 22.55, 0.5, 0.36, 0.3, 0, P.oliveDrab);                                                   // a packed kit box

    // ---- BUNKS 4 — THE BEDDING STORE: the three beds stripped to their springs; the issue table against the south-east, clear of the door's stack
    // with the ledger and a slate of blankets out; spare frames on end against the east wall, mattresses rolled and stood on end in a rank on the west wall,
    // folded blankets in piles of different counts on the west bed (what lies on a bed is drawn only; the rolls and the bale stand on the floor as soft cover)
    L.room('bunks4');
    for (const [x, z, ax] of [[20.3, 23.38, true], [19.8, 20.85, false]] as const) onCot(x, z, ax, 0.24, 1, 0.012, [0.2, 0.2, 0.21]);   // the springs (steel)
    add({ c: [23.2, 0.67, 23.38], h: [0.82, 0.12, 0.39], albedo: TICK, flags: NS });                             // three mattresses stacked flat on the east bed, ticking up:
    add({ c: [23.2, 0.793, 23.38], h: [0.8, 0.003, 0.08], albedo: [0.4, 0.5, 0.68], flags: NS });                // its stripe
    add({ c: [19.56, 0.44, 22.36], h: [0.17, 0.44, 0.54], albedo: C.chair });                                    // three mattresses rolled, on end: what stops a round is one soft block,
    for (const z of [21.99, 22.36, 22.73]) add({ c: [19.56, 0.45, z], h: [0.18, 0.45, 0.185], albedo: TICK, flags: NS });   // inside three rolls of ticking (drawn only, a hair larger: the block never shows)
    add({ c: [25.09, 0.95, 22.4], h: [0.04, 0.95, 0.45], albedo: C.metal }); add({ c: [25.0, 0.93, 22.42], h: [0.04, 0.93, 0.45], albedo: C.metal });   // bed frames on end, east wall south of the lockers
    for (const [z, hy, col] of [[20.3, 0.08, BLANKET], [20.85, 0.16, [0.3, 0.27, 0.2]], [21.4, 0.12, BLANKET]] as const) laid(19.8, 0.562, z, 0.3, hy, 0.2, col as Vec3);   // blankets: piles of four, eight, six
    add({ c: [24.72, 0.3, 23.42], h: [0.38, 0.3, 0.4], albedo: C.chair });                                       // a bale of blue blankets in the south-east corner (soft)
    L.table(24.05, 22.6, 1.1, 0.55, 0, C.wood, 0.74);                                                            // the issue table: x 23.5..24.6, z 22.33..22.88, in front of the spare frames (by the chair it stood between the marks four men take inside the door, s2)
    L.thing(23.9, 0.74, 22.57, 0.16, 0.012, 0.11, P.paper);                                                      // the ledger
    L.thing(24.35, 0.74, 22.6, 0.12, 0.01, 0.15, C.black);                                                      // the slate
    L.carton(20.9, 22.45, 0.5, 0.2);                                                                             // pillow cases

    // ---- BUNKS 5 (held) — THE SICK BAY (the only white sheets and the only red cross in the level): two beds made in white, a brown-grey blanket folded at
    // each foot; the medicine cabinet HUNG on the north wall (drawn only: it stands on no floor), the red cross on its door, facing the camera; a bedside table
    // by the north bed's pillow with the enamel basin and the kidney dish; a cloth screen 0.6 m off the south bed's open side, between it and the door (cover,
    // 1.6 m; a medic stands between screen and bed); a stretcher laid on the floor north of the screen, the first aid box on it
    L.room('bunks5');
    onCot(26.6, 23.38, true, 0.2, 1, 0.03, C.white, 0.55, NS); onCot(26.6, 23.38, true, 0.8, 0.98, 0.05, BLANKET, 0.58, NS); laid(25.83, 0.55, 23.38, 0.12, 0.04, 0.25, C.white);   // the south bed: sheet, the blanket at its foot, pillow
    onCot(29.1, 20.35, true, 0.2, 0.98, 0.03, C.white, 0.55, NS); onCot(29.1, 20.35, true, 0.8, 0.97, 0.05, BLANKET, 0.58, NS); add({ c: [28.36, 0.57, 20.35], h: [0.12, 0.02, 0.25], albedo: C.white, flags: NS });   // the north bed, its head to the west
    L.thing(27.85, 0, 23.5, 0.17, 0.25, 0.14, C.white);                                                          // the dressing trolley at the south bed's foot, under the window (as a bedside table by the north bed's pillow, at (28.4, 21.0), it stood on the marks men take inside s3 and s34; by that bed's middle, on a defender's mark)
    L.thing(27.79, 0.5, 23.5, 0.09, 0.03, 0.09, P.enamelBlue); L.thing(27.95, 0.5, 23.53, 0.035, 0.015, 0.06, TIN, 0.5);   // basin and kidney dish on it
    add({ c: [26.25, 1.6, 19.93], h: [0.3, 0.3, 0.08], albedo: C.white, flags: NS });                            // the medicine cabinet on the north wall, west of the door
    add({ c: [26.25, 1.6, 20.013], h: [0.16, 0.045, 0.003], albedo: C.red, flags: NS }); add({ c: [26.25, 1.6, 20.014], h: [0.045, 0.16, 0.004], albedo: C.red, flags: NS });   // the cross on its door
    add({ c: [26.73, 0.8, 22.33], h: [0.33, 0.8, 0.012], yaw: 0.08, albedo: C.chair }); add({ c: [27.39, 0.8, 22.33], h: [0.33, 0.8, 0.012], yaw: -0.08, albedo: C.chair });   // the screen, two leaves (cloth), 0.6 m off the bed's side
    for (const z of [21.58, 22.02]) add({ c: [26.85, 0.05, z], h: [0.95, 0.02, 0.02], albedo: C.wood, flags: NS });   // the stretcher laid on the floor north of the screen: poles,
    add({ c: [26.85, 0.055, 21.8], h: [0.75, 0.006, 0.21], albedo: P.canvas, flags: NS });                       // canvas,
    add({ c: [26.6, 0.111, 21.8], h: [0.2, 0.05, 0.15], albedo: C.white, flags: NS });                           // the first aid box on it,
    add({ c: [26.6, 0.163, 21.8], h: [0.11, 0.002, 0.035], albedo: C.red, flags: NS }); add({ c: [26.6, 0.164, 21.8], h: [0.035, 0.003, 0.11], albedo: C.red, flags: NS });   // a red cross on its lid, facing up
    L.bucket(25.62, 21.45, P.enamelBlue);

    // ---- THE WASH ROOM — the laundry: the boiler on the east wall with its wood a hand's width clear of it, three galvanised tubs standing FREE with
    // 0.55 m between them and the trough, the scrubbing board across the middle one, a stand pipe over a floor grate (drawn only) with the bucket under the
    // tap, ONE low drying rack hung with washing in the room's east, end on along the shelves' front (cloth; cover to 0.85 m), the dirty pile by the
    // first tub. The west third of the room is kept bare: a second rack at (32.0, 21.1) left a 1.15 m strip between it and the north wall for the whole
    // team to file through to s34's stack, the first entry came 12 s late and the defenders' push caught the team still in bunks 5 (24 shipped seeds: 42
    // teammates of 96 up against 57 without furniture). The one rack stood at (34.5, 21.1) until it was found on the last places of the file four men stand
    // in under the north wall for s34: every mark was still dealt, but elsewhere, and the first entry came 4.3 s late (19.5 s against 15.3; 15.5 from here)
    L.room('wash');
    add({ c: [35.55, 0.8, 22.66], h: [0.25, 0.8, 0.2], albedo: BOILER }); add({ c: [35.55, 2.29, 22.7], h: [0.05, 0.69, 0.05], albedo: IRON }); add({ c: [35.296, 0.35, 22.66], h: [0.004, 0.12, 0.12], albedo: C.black, flags: NS });   // boiler, flue, fire door
    add({ c: [35.55, 0.2, 22.2], h: [0.22, 0.2, 0.11], albedo: C.wood });                                        // split wood stacked north of it, 0.15 m of air between the stack and the boiler's side
    for (const [x, z, a, b] of [[34.95, 21.3, KHAKI, C.partRed]] as const) {     // the rack: the cloth body, and what hangs over it (drawn only)
      add({ c: [x, 0.425, z], h: [0.13, 0.425, 0.5], albedo: C.chair });                                           // end on to the room, along the shelves' front
      add({ c: [x, 0.5, z - 0.26], h: [0.14, 0.362, 0.17], albedo: a as Vec3, flags: NS }); add({ c: [x, 0.48, z + 0.22], h: [0.14, 0.385, 0.2], albedo: b as Vec3, flags: NS }); }
    add({ c: [32.85, 0.43, 22.26], h: [0.11, 0.012, 0.17], yaw: 0.2, albedo: C.wood, flags: NS });               // the scrubbing board
    add({ c: [31.5, 0.07, 22.3], h: [0.22, 0.07, 0.2], yaw: 0.3, albedo: SERGE, flags: NS });                    // dirty washing on the floor by the first tub
    for (const [x, top] of [[32.1, [0.2, 0.3, 0.42]], [32.85, [0.8, 0.8, 0.78]], [33.6, [0.22, 0.23, 0.15]]] as const) {   // the tubs: water, suds, uniforms soaking
      add({ c: [x, 0.2, 22.38], h: [0.3, 0.2, 0.25], albedo: TIN }); add({ c: [x, 0.403, 22.38], h: [0.25, 0.003, 0.2], albedo: top as unknown as Vec3, flags: NS }); }
    add({ c: [34.55, 0.5, 22.62], h: [0.02, 0.5, 0.02], albedo: IRON, flags: NS });                              // the stand pipe
    L.mat(34.3, 22.05, 34.8, 22.57, [0.08, 0.08, 0.09]);                                                         // the floor grate under it
    L.bucket(34.55, 22.32, P.enamelBlue);                                                                        // the bucket under the tap

    // ---- THE NORTH GALLERY — the orders walk. NOTHING STANDS IN A GALLERY BAY but paint: a file of three or four stacking on a gallery door stands down the
    // bay's walls, and a board on legs against the yard wall took those places from two door faces (barracks-check B1). So everything here hangs flat on the
    // ROOMS' wall, drawn only, where the camera sees its face: the orders board in the west bay with the company bell on a bracket beside it, the fire point
    // in the middle bay (a pale board, three red buckets on hooks, an extinguisher, a red square on the floor under it), the fall-in line in the east bay
    L.room('ngal');
    L.hung(13.3, 8.335, true, 1.1, 0.9, 1.8, C.plant);                                                            // the orders board, green baize
    for (const [x, y, w, h] of [[12.95, 1.45, 0.21, 0.3], [13.22, 1.5, 0.21, 0.3], [13.5, 1.42, 0.3, 0.21], [13.1, 1.08, 0.3, 0.21], [13.52, 1.1, 0.21, 0.3]] as const)
      add({ c: [x, y, 8.36], h: [w / 2, h / 2, 0.004], albedo: P.paper, flags: NS });                             // the orders pinned to it
    add({ c: [16.6, 2.0, 8.43], h: [0.02, 0.02, 0.12], albedo: IRON, flags: NS });                                // the bell's bracket
    add({ c: [16.6, 1.84, 8.5], h: [0.09, 0.12, 0.09], albedo: P.brass, flags: NS });                             // the bell
    add({ c: [16.6, 1.52, 8.5], h: [0.008, 0.2, 0.008], albedo: [0.62, 0.55, 0.4], flags: NS });                  // its rope
    L.hung(23.2, 8.335, true, 1.3, 0.85, 1.75, [0.8, 0.78, 0.7]);                                                 // middle bay: the fire point's board
    for (const x of [22.8, 23.1, 23.4]) add({ c: [x, 1.12, 8.44], h: [0.11, 0.12, 0.085], albedo: C.red, flags: NS });   // three sand buckets on their hooks
    add({ c: [23.72, 1.2, 8.42], h: [0.06, 0.25, 0.06], albedo: C.red, flags: NS }); add({ c: [23.72, 1.47, 8.42], h: [0.03, 0.03, 0.03], albedo: C.black, flags: NS });   // the extinguisher
    L.mat(22.55, 8.36, 23.85, 8.95, C.red, 0.027);                                                                // the red keep-clear square under it
    L.mat(26.5, 10.1, 34.5, 10.19, C.white, 0.027);                                                              // east bay: the fall-in line

    // ---- THE SOUTH GALLERY — the boot walk, and like the north one NOTHING STANDS IN IT: on the yard wall's pier in the middle bay (solid wall, x 21.4‥23.8)
    // a boot shelf hung at 0.4 m with the brush box, a polish tin and two pairs of boots on it, two pairs of sandals on the floor under it, two rain capes and a
    // helmet on pegs over it — all drawn only; a grey mat in front of the bedding store's door, a coir runner in the west bay, a wet mop streak in the east one
    L.room('sgal');
    add({ c: [22.3, 0.4, 17.46], h: [0.75, 0.015, 0.09], albedo: C.woodDark, flags: NS });                       // the boot shelf, flat on the pier under the capes
    laid(21.75, 0.415, 17.46, 0.14, 0.06, 0.08, C.wood);                                                         // the brush box on it,
    laid(22.02, 0.415, 17.47, 0.045, 0.015, 0.045, C.black);                                                     // a tin of black polish,
    for (const x of [22.4, 22.78]) laid(x, 0.415, 17.46, 0.1, 0.06, 0.085, C.black);                             // two pairs of boots, toes out
    for (const [x, w] of [[21.85, 0.1], [21.96, 0.1], [22.55, -0.2], [22.66, -0.2]] as const) add({ c: [x, 0.02, 17.52], h: [0.04, 0.02, 0.1], yaw: w, albedo: [0.45, 0.33, 0.2], flags: NS });   // sandals on the floor under the shelf
    L.hung(22.0, 17.39, true, 0.45, 0.95, 1.8, P.oliveDrab); L.hung(22.6, 17.39, true, 0.45, 1.0, 1.8, SERGE); add({ c: [23.25, 1.62, 17.42], h: [0.12, 0.08, 0.05], albedo: [0.16, 0.17, 0.15], flags: NS });   // two capes, a helmet
    L.mat(22.1, 19.3, 22.7, 19.65, [0.4, 0.4, 0.38], 0.027);                                                     // the mat, in front of the door
    L.mat(13.2, 18.2, 16.6, 18.85, [0.5, 0.37, 0.18], 0.027);                                                    // west bay: a coir runner
    L.mat(28.0, 18.0, 30.9, 18.24, [0.2, 0.23, 0.28], 0.027);                                                    // east bay: a wet mop streak

    // ---- THE YARD — the parade square: the flagpole at the lawn's west end, the volleyball posts on the look's court (its net line x 27.1, each post 0.15 m
    // outside a side line; the net down, rolled at a post, the level's one: a net drawn across the yard would hide a man the AI still sees), pull-up bars.
    // Dark and bare of anything large and pale
    L.room('yard');
    add({ c: [17.6, 0.15, 14.0], h: [0.25, 0.15, 0.25], albedo: C.white }); add({ c: [17.6, 3.15, 14.0], h: [0.03, 2.85, 0.03], albedo: C.white }); add({ c: [17.95, 5.72, 14.0], h: [0.32, 0.22, 0.008], albedo: C.plant });   // plinth, pole, the colours
    for (const z of [12.55, 15.45]) add({ c: [27.1, 1.22, z], h: [0.04, 1.22, 0.04], albedo: C.white });         // the net's posts
    laid(27.1, 0, 12.9, 0.1, 0.09, 0.25, [0.75, 0.75, 0.7]);                                                      // the net, rolled at the north one (cloth: drawn only)
    for (const x of [32.2, 34.0]) add({ c: [x, 1.1, 11.35], h: [0.035, 1.1, 0.035], albedo: IRON }); add({ c: [33.1, 2.17, 11.35], h: [0.9, 0.02, 0.02], albedo: IRON });   // pull-up bars, north-east: the east post 2 m west of the wall (at 35.2 it stood 0.25 m off the second mark a pair is dealt at the gallery's end door, n_end)
    { K.prop('cardboard', 29.5, 13.4, 0, 0.5, [{ off: [0, 0.11, 0], h: [0.11, 0.11, 0.11], yaw: 0, albedo: C.white }, { off: [0, 0.11, 0], h: [0.105, 0.105, 0.105], yaw: Math.PI / 4, albedo: C.white }]); L.own('ball'); }   // the volleyball
    L.bucket(20.45, 13.8);                                                                                       // the cistern's bucket

    // ---- OUTSIDE, THE GALLEY'S BACK DOOR — the tea yard, all of it WEST of the door (the second way in stands east of it): the cooker inside burns gas, the
    // wood is for the brick hearth out here, where the big black kettle boils for the whole company
    L.room('back');
    add({ c: [4.8, 0.3, 3.6], h: [0.8, 0.3, 0.25], albedo: C.wood }); add({ c: [4.65, 0.68, 3.62], h: [0.55, 0.08, 0.2], albedo: C.woodDark });   // firewood on the wall west of the window
    add({ c: [5.92, 0.45, 3.58], h: [0.27, 0.45, 0.27], albedo: P.enamelBlue });                                 // the water barrel (the level's one), between the wood and the window
    add({ c: [7.2, 0.2, 3.3], h: [0.2, 0.2, 0.2], albedo: C.woodDark }); add({ c: [7.38, 0.44, 3.3], h: [0.22, 0.015, 0.015], albedo: C.wood, flags: NS });   // the chopping block under the galley's window, 2.4 m off the back door's jamb (the wall beside the door stays bare), the axe in it
    for (const s of [-0.27, 0.27]) add({ c: [4.5 + s, 0.15, 1.7], h: [0.07, 0.15, 0.28], albedo: C.partRed });   // the hearth: two brick cheeks, 2.2 m off the wall,
    add({ c: [4.5, 0.44, 1.7], h: [0.2, 0.14, 0.2], yaw: 0.3, albedo: C.black });                                // the kettle across them
    L.mat(4.1, 1.3, 5.0, 2.1, [0.05, 0.05, 0.05]);                                                               // its ash
    L.looseCrate(5.5, 2.9, 0.5, 0.36, 0.3);                                                                      // a kindling crate

    // ---- OUTSIDE, THE FRONT DOOR — the post: a sentry box out on the verge at the walk's north edge, 2.5 m and more off the door (three sides, no roof: his
    // chair shows inside; open to the SOUTH, onto the walk and whoever comes up it — the wall beside both jambs stays bare), the battalion's sign on the verge
    // with a white cap, a trodden walk from the verge's edge to the door between two rows of whitewashed stones
    L.room('front');
    for (const z of [10.7, 11.9]) add({ c: [2.6, 0.95, z], h: [0.04, 0.95, 0.04], albedo: C.metal });
    add({ c: [2.6, 1.45, 11.3], h: [0.03, 0.4, 0.66], albedo: C.plant });
    add({ c: [2.6, 1.862, 11.3], h: [0.06, 0.012, 0.68], albedo: C.white, flags: NS });                          // its cap
    L.mat(0.05, 14.78, 3.2, 16.02, [0.33, 0.29, 0.2], 0.027);                                                    // the walk
    for (let k = 0; k < 3; k++) for (const z of [14.5, 16.3]) L.thing(0.6 + k * 1.05, 0, z, 0.09, 0.07, 0.08, C.white);
    add({ c: [0.99, 1.0, 13.26], h: [0.445, 1.0, 0.04], albedo: C.plant }); add({ c: [0.59, 0.99, 13.74], h: [0.04, 0.99, 0.44], albedo: C.plant });   // the sentry box: north and west sides,
    add({ c: [1.41, 0.98, 13.74], h: [0.04, 0.98, 0.44], albedo: C.plant });                                       // the east side; open to the SOUTH, on the walk
    L.chair(1.0, 13.7, 0);                                                                             // the sentry's chair, inside it

    // ---- OUTSIDE, THE VEHICLE LOT — a motorbike against the east wall north of the end door, the pickup's bay painted, and THE VEHICLE GATE: the 3 m gap in
    // the east wall has a lifting barrier, RAISED (all of it drawn only: nobody walks into a pole or a post) — a pivot post at the gap's north cheek, the pole
    // standing up from it in red and white, a white stop line on the ground across the gap
    L.room('lot');
    motorbike(36.8, 5.65, Math.PI / 2);
    L.mat(37.46, 9.0, 37.54, 13.4, C.white); L.mat(39.82, 9.0, 39.9, 13.4, C.white);
    add({ c: [36.3, 0.5, 12.3], h: [0.07, 0.5, 0.07], albedo: C.white, flags: NS });                             // the barrier's pivot post,
    add({ c: [36.3, 2.35, 12.3], h: [0.035, 1.5, 0.035], albedo: C.white, flags: NS });                          // the pole, raised (0.85‥3.85 m),
    for (const y of [1.6, 2.8]) add({ c: [36.3, y, 12.3], h: [0.04, 0.3, 0.04], albedo: C.red, flags: NS });     // its red bands
    L.mat(36.2, 12.5, 36.32, 15.5, C.white, 0.027);                                                              // the stop line across the gap
  }

  const START: Vec3 = [38.2, 0, 21.6];
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices: [],
    breaker: { pos: [4.3, 1.35, 22.6], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: START,
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still)
    mission: { serverRoom: { ...R.duty }, entryDoor: 'o_hall', rack: { index: 0, front: [10.4, 1.0, 23.3], halfW: 0.3 }, exfilDoor: 's_end', exfilX: 36.6, exfilZ: 18.4 },
  };

  // ---------------- what the room clear takes from this level ----------------
  // ELEVEN DEFENDERS, PLACED BY HAND. A room's first `garrison` marks, in the order written, are the men who stand there (placement seed 0, the first staging:
  // roomclear.ts placeDefenders); the marks after them are only what another seed may deal. THE PROBLEM, in one sentence: two men on a dark post at the north
  // gallery's east end look across the yard at the lit south gallery — one at the floor in front of the wash room and out through the arch, one square onto
  // bunks 5's door — so the nearest way in, and the door the marker points at, are both walked under guns the team cannot reach from there.
  //   gallery post 2              (31.0, 8.9) THE ARCH MAN: the south gallery from s3's east jamb to s4, the yard's east end, the arch. (32.6, 9.4) THE DOOR MAN:
  //                               IN THE SAME OPENING, east of his mate, across the yard's corner onto s3 — the stack's own door. Both stand in the line of the
  //                               wash room's gallery door: a team that goes in by the wash room has the whole post in front of one doorway (both fall in 2 s),
  //                               a team on s3 has neither. (He stood at (27.0, 9.5), square onto s3 in the next opening west: the men who had taken bunks 5 by
  //                               s3 shot him through that door, the wash room's never saw him, and he was the one who held the north wing against them later:
  //                               72 seeds, the wash room plan 95 of 288 up against the marker's door 111.) n_end and ng_e come in on their flanks
  //   day room 2                  one gun on each of its doors: the room behind the post is nobody's free room
  //   bunks 2                     NOBODY (it was two, then one): its man is the post's second. The north wing west of the fire door is empty and dark
  //   galley 1                    on the back door (k_out) over the island: the other way in starts on a watched door
  //   mess hall 2                 opposite corners, crossing diagonals: every one of the six doors is in somebody's eyes
  //   bunks 3 2                   one gun a door
  //   bunks 5 2                   both on the NORTH side of the room, off the line of the south window: (29.2, 21.4) on the gallery door, (26.4, 21.6) on the wash room's
  // Squads: a wing each and the link. Alpha = the day room + the post, four men in two rooms, so it has a pair to send (enemysquads.ts: a squad with fewer than
  // two men past one a room only ever barricades); it wedges the day room's east door alone.
  const door = (id: string) => doorDefs.find(d => d.name === id)!;
  /** the point a gun rests on for a door, seen from inside room `r`: the middle of the opening, 0.16 m to the room's side of the wall line, chest high */
  const aim = (id: string, r: Rect): Vec3 => { const d = door(id), alongX = d.closedDir === 0, m = (alongX ? d.hinge[0] : d.hinge[1]) + 0.58;
    if (alongX) { const z = d.hinge[1]; return [m, 1.1, z + ((r.z0 + r.z1) / 2 > z ? 0.16 : -0.16)]; }
    const x = d.hinge[0]; return [x + ((r.x0 + r.x1) / 2 > x ? 0.16 : -0.16), 1.1, m]; };
  /** a mark: where he stands, the door of his room he is there for, and what his gun rests on — that door, unless `at` says another point (the sentry's: across the yard) */
  const mark = (r: Rect, x: number, z: number, watch: string, at?: Vec3) => ({ pos: [x, 0, z] as Vec3, watch, aimAt: at ?? aim(watch, r) });
  /** the north gallery's east bay: from the fire door ng_e to the end door */
  const NGAL_E: Rect = { x0: NG_FIRE[1] + 0.06, x1: R.ngal.x1, z0: R.ngal.z0, z1: R.ngal.z1 };
  const roomClear: StructureData = {
    name: 'the barracks', maxMen: 11,
    team: { sam: START, samYaw: Math.PI, ops: [[37.3, 0, 21.4], [39.1, 0, 21.3], [37.4, 0, 22.8], [38.8, 0, 23.0]], opsYaw: Math.PI },
    // THE OTHER WAY IN (`starts`: stood on only when a run asks — the mission sheet's Way in row, ?way=2, or ?way=any for a dealt one): the north-west corner, outside the galley's
    // back door. One man holds the galley; the mess hall is behind it, and from the mess both galleries are taken from their closed ends, not across the yard
    starts: [{ sam: [12.6, 0, 2.0], samYaw: -Math.PI / 2, ops: [[14.0, 0, 1.6], [14.0, 0, 2.6], [15.2, 0, 1.6], [15.2, 0, 2.6]], opsYaw: -Math.PI / 2 }],
    rooms: [
      // ---- Charlie: the south wing ----
      { id: 'bunks5', name: 'bunks 5', bounds: { ...R.bunks5 }, garrison: 2,
        doors: [{ id: 's3', from: 'south gallery' }, { id: 's34', from: 'wash room' }],
        marks: [
          mark(R.bunks5, 29.2, 21.4, 's3'),        // PLACED: beside the wash room's door, out of its line and off the south window's
          mark(R.bunks5, 26.4, 21.6, 's34'),       // PLACED: the west side, across the room onto the wash room's door
          mark(R.bunks5, 25.9, 22.4, 's3'),        // the west wall, past the locker
          mark(R.bunks5, 29.4, 23.2, 's3'),        // the south-east corner, across the cot onto the gallery door
        ] },
      { id: 'bunks3', name: 'bunks 3', bounds: { ...R.bunks3 }, garrison: 2,
        doors: [{ id: 's1', from: 'south gallery' }, { id: 'o_s1', from: 'duty office' }],
        marks: [
          mark(R.bunks3, 17.8, 20.4, 'o_s1'),      // PLACED: the north-east, the long diagonal onto the duty office's door
          mark(R.bunks3, 16.2, 22.4, 's1'),        // PLACED: in front of the south cots, onto the gallery door
          mark(R.bunks3, 18.0, 22.4, 's1'),        // the east wall, south of the lockers
          mark(R.bunks3, 14.2, 20.4, 'o_s1'),      // the hard corner west of the gallery door
        ] },
      // ---- Bravo: the link ----
      { id: 'hall', name: 'mess hall', bounds: { ...R.hall }, garrison: 2,
        doors: [{ id: 'h_s', from: 'south gallery' }, { id: 'h_n', from: 'north gallery' }, { id: 'h_yard', from: 'yard' }, { id: 'front', from: 'outside' }, { id: 'k_hall', from: 'galley' }, { id: 'o_hall', from: 'duty office' }],
        marks: [
          mark(R.hall, 7.4, 18.9, 'h_n'),          // PLACED: the south wall, the length of the hall onto the north gallery's door — the galley's door and the yard's in his cone
          mark(R.hall, 4.9, 9.2, 'h_s'),           // PLACED: the north-west corner, the long diagonal onto the south gallery's door — the office's, the front and the yard's in his cone
          mark(R.hall, 9.0, 12.9, 'front'),        // east of the north pillar, onto the front door
          mark(R.hall, 5.2, 13.4, 'h_yard'),       // the west side, square across the hall onto the yard door
        ] },
      { id: 'galley', name: 'galley', bounds: { ...R.galley }, garrison: 1,
        doors: [{ id: 'k_hall', from: 'mess hall' }, { id: 'k_out', from: 'outside' }],
        marks: [
          mark(R.galley, 5.6, 7.4, 'k_out'),       // PLACED: the south-west, over the island onto the back door
          mark(R.galley, 11.4, 7.4, 'k_hall'),     // the south-east corner, along the wall onto the hall door
          mark(R.galley, 10.6, 6.0, 'k_hall'),     // east of the island
        ] },
      // ---- Alpha: the north wing ----
      { id: 'day', name: 'day room', bounds: { ...R.day }, garrison: 2,
        doors: [{ id: 'n4b', from: 'north gallery' }, { id: 'n4a', from: 'north gallery' }],
        marks: [
          mark(R.day, 34.8, 4.9, 'n4b'),           // PLACED: the north-east corner, straight down onto the east door
          mark(R.day, 27.9, 6.4, 'n4a'),           // PLACED: the west wall, onto the west door
          mark(R.day, 33.0, 6.6, 'n4b'),           // east of the table
          mark(R.day, 30.6, 7.4, 'n4a'),           // west of the locker stub, along the wall
        ] },
      { id: 'ngal_e', name: 'gallery post', bounds: { ...NGAL_E }, garrison: 2,
        doors: [{ id: 'n_end', from: 'outside' }, { id: 'ng_e', from: 'north gallery' }, { id: 'n4b', from: 'day room' }, { id: 'n4a', from: 'day room' }],   // NOT n3, the armoury's: a door a held room lists is hung to open into it, and n3's leaf stops at 1.3 for the armoury's racks — hung into the gallery it left a man no way through from its pull face (probes.ts oneway-men)
        marks: [
          mark(NGAL_E, 31.0, 8.9, 'n_end', [33.0, 1.1, 18.6]),   // PLACED: THE ARCH MAN. Back from the east opening, his gun across the yard on the floor in front of the wash room's door
          mark(NGAL_E, 32.6, 9.4, 'ng_e', [27.6, 1.1, 18.6]),    // PLACED: THE DOOR MAN. In the same opening, east of his mate, across the yard's corner onto bunks 5's door
          mark(NGAL_E, 29.6, 9.9, 'n_end'),                      // by the pier between the two openings, down the gallery onto the end door
        ] },
    ],
    // (rebuild/enemy-squads/squad-format.md) who holds what; what a squad does about it is the AI's. Rally = one of its rooms' marks.
    squads: [
      { id: 'charlie', name: 'Charlie', rooms: ['bunks5', 'bunks3'], rally: [16.2, 0, 22.4] },
      { id: 'bravo', name: 'Bravo', rooms: ['hall', 'galley'], rally: [9.0, 0, 12.9] },
      { id: 'alpha', name: 'Alpha', rooms: ['day', 'ngal_e'], rally: [33.0, 0, 6.6], barricade: ['n4b'] },
    ],
  };

  // ---------------- what is underfoot (game/floor.ts: which footstep sounds, and how far it carries to their ears). First zone that holds a point wins ----------------
  const zone = (id: string, mat: 'carpet' | 'lino' | 'stone' | 'tile' | 'asphalt' | 'grass', r: Rect) => ({ id, mat, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 });
  const surfaces: SurfacesData = {
    building: { x0: X0, x1: X1, z0: Z0, z1: Z1 }, grassEdge: 3.2, inside: 'lino', outside: 'asphalt', verge: 'grass',
    zones: [
      zone('lawn', 'grass', { x0: 16, x1: 32, z0: 12.6, z1: 15.4 }),                    // quiet, and in the open
      zone('yard', 'asphalt', { x0: LX, x1: X1, z0: NY, z1: SY }),                      // rough concrete paving
      zone('hall', 'stone', { x0: X0, x1: LX, z0: NZ, z1: SZ }),
      zone('galley', 'tile', { x0: X0, x1: LX, z0: Z0, z1: NZ }),
      zone('duty', 'carpet', { x0: X0, x1: LX, z0: SZ, z1: Z1 }),
      zone('day', 'carpet', { x0: N34, x1: X1, z0: Z0, z1: NZ }),
      zone('wash', 'tile', { x0: S34, x1: X1, z0: SZ, z1: Z1 }),
      // (the galleries and the bunk rooms: the building's lino)
    ],
  };
  // THE FLOOR NOBODY HOLDS, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it): what a line on their net, a cue or
  // the debrief calls a spot that is no room of the structure
  const places: PlacesData = { areas: [{ name: 'duty office', bounds: { ...R.duty } }, { name: 'bunks 1', bounds: { ...R.bunks1 } }, { name: 'bunks 2', bounds: { ...R.bunks2 } }, { name: 'armoury', bounds: { ...R.arms } }, { name: 'bunks 4', bounds: { ...R.bunks4 } }, { name: 'wash room', bounds: { ...R.wash } }, { name: 'north gallery', bounds: { ...R.ngal } }, { name: 'south gallery', bounds: { ...R.sgal } }, { name: 'yard', bounds: { ...R.yard } }] };
  return { level, scenarios: { roomClear, places, kitView: BARRACKS_KITVIEW }, groups: trace.groups, surfaces };
}
