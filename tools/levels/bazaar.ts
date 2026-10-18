// THE BAZAAR ROW: a quiet level for one. Two blocks of shuttered shops between a lit street and a back alley, at night, with one passage between the blocks.
//
// THE ONE IDEA: TWO PATROLS TURN ROUND THE TWO BLOCKS LIKE GEARS, AND BOTH COME DOWN THE PASSAGE. The west round ('roundW') walks the west block: down the
// passage, WEST along the street, round the tea house's gable, EAST down the alley and into the passage again. The east round ('roundE') walks the east block
// the other way about: out of the generator room, WEST down the alley, down the passage, EAST along the street, in at the garage's wicket and through the
// garage to the generator room. So on the street a round always walks AWAY from the passage, in the alley he always walks HOME to it, and the passage has one
// of them coming down it about every half minute. The outside of a block is safe only in the gap behind a man — and the way to stay in that gap, or to get
// from one lane to the other without the passage, is THROUGH THE SHOPS: the tea house's kitchen joins the phone shop's workshop, the pharmacy has a side door
// on the passage, its store joins the money changer's office (a lock), the office joins the garage (a keypad).
//
//        x 4        10        16 18        24        30        36
//   z 4  ┌──────────────────────────gate_n──────────────┬──────────┐      the north wall: a foot gate across from the pharmacy's back door
//        │ oven  the alley  (bulb)  ←── roundE     (bulb)  gen room │      'gen_door' — the BREAKER is in the generator room, where roundE starts every lap
//   z 8  ├──tea_back──┬─phone_back─┐  ┌─pharm_back─┬─────────┬─garage_back─┤
//        │  kitchen  t_p workshop  │p │  store    p_h office o_g           │      t_p 'tea_phone' · p_h 'pharm_hawala' (lock) · o_g 'office_garage' (KEYPAD)
//   z 12 ├───arch─────┼─phone_work─┤a ├─pharm_store┼─hawala_office─┤ garage │
//        │ tea house  │ phone shop │s │p_side pharmacy│ money     │ (pickup) │      p_side 'pharm_side': the east block's door on the passage
//   z 16 ├─tea_front──┴[glass]─────┘s.└[glass]─────┴─hawala_front┴─garage_front┤
//    →   │  roundW ──→  (lamp)   the lorry    ←── roundE   (lamp, camera)  gate_e
//   z 22 └──────────────────────────────gate_s────────────────────────────┘
//
// THE GLASS FRONTS COUNT. The phone shop and the pharmacy each burn one small light in the window all night (on the mains: a round, the OCP or the breaker puts
// it out). Each round stops at his block's window and looks in: roundW at the phone shop's, roundE at the pharmacy's. What is done in a front room is done on show.
// LANDMARKS: 'the lorry' (a painted lorry parked along the south wall, mid street), 'the bread oven' (the baker's lean-to and tandoor in the alley), 'the blue
// stall' (the one blue thing standing in the street: the kiosks are green, cream and rust).
// THE NIGHT'S FIRST MINUTE: the east round TRIES THE PHARMACY'S BACK DOOR — across the alley from the north gate — about a quarter of a minute in, his back to
// the gate. Picked from a sweep of ten phases: any later and a blind crouch from the north gate has the safe; this way the man who goes straight for the lit door
// is caught on his knees, and the one who lets the torch go by has the best part of a minute.
// THE THREE SETS DIFFER BEHIND THE SHOPS AS WELL AS IN FRONT: on sets 0 and 1 the money changer's man walks INTO THE OFFICE for a look at the safe; on 1 and 2
// the garage's man smokes outside the generator room's door, looking up the alley as far as the water tank; on 0 and 2 the tea house's man smokes at the
// kitchen door at the alley's other end. On set 2 the office is the camera's alone.
//
// WHAT THE SEED DEALS (QUIET below, rebuild/play-style-levels/quiet-missions/contract.md): one of three starts (behind the north wall at its west end · outside the
// north gate · outside the south gate), one of three places for the thing (the money changer's safe · the phone shop's display case, under its lit window ·
// the garage's steel cabinet, which roundE walks past every lap) and one of three sets of five men: the two rounds are on every set, the other three are dealt
// from the lorry's driver, the money changer's man, the tea house's man, the garage's man and the street's night watchman. All three gates are ways out.
// QUIET_VARIANT=spot,set,start exports ONE deal to levels/bazaar.v<spot><set><start>.json for the checks (never committed).
//
// In the GWOT look kit (src/scene/gwotKit.ts). Units: metres. +X east, +Z south, +Y up. Laid out on paper and proved headless (tools/qa/quiet-light.ts,
// tools/qa/solo-night.ts on every deal); seen drawn once, on the software renderer.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef, DeviceDef, CivilianDef, PatrolRoute } from '../../src/scene/level';
import type { LevelScenarios, QuietData, Rect, ResponseData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

/** one deal for the checks: QUIET_VARIANT=spot,set,start (absent = the committed file: the first of each, every route) */
const VARIANT = (() => { const s = (typeof process !== 'undefined' && process.env.QUIET_VARIANT) || ''; if (!s) return null; const v = s.split(',').map(Number); if (v.length !== 3 || v.some(n => !Number.isInteger(n) || n < 0 || n > 2)) throw new Error(`QUIET_VARIANT=${s}: want spot,set,start, each 0‥2`); return v as [number, number, number]; })();
export const NAME = VARIANT ? `bazaar.v${VARIANT.join('')}` : 'bazaar';
export const NOTES = 'The bazaar row: a quiet level for one. Two blocks of shops between a lit street and a back alley; a patrol walks round each block and both come down the passage between them. Regenerate: bun run tools/levels/export.ts bazaar';
export const MATERIALS = GWOT_MATERIALS;

export function build(): { level: Level; scenarios?: LevelScenarios; groups: string[]; surfaces: SurfacesData; quiet: QuietData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, ceilingPanel, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;
  const M = G.M;
  type Mt = keyof typeof M;
  const roof = { flags: BoxFlag.NoPrimary };
  /** the generator's own dice (never Math.random, never a transcendental: the export must come out the same on any machine) */
  const h01 = (a: number, b: number, c: number) => { let h = (Math.imul(Math.round(a * 100), 73856093) ^ Math.imul(Math.round(b * 100), 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---------------- ground: dust to the horizon, packed dirt between the walls, the street in gravel ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(0, 4, 36, 22, 'dirt');
  G.ground(0, 16.12, 35.88, 21.88, 'gravel', 0.006);                             // the street, out past the row's west end
  G.ruts(0.6, 18.9, 13.4, 18.9); G.ruts(20.6, 19.1, 30.8, 19.1);
  G.patch(8.6, 6.9, 2.2, 1.2, 'damp', 0.2); G.patch(21.2, 6.2, 1.8, 1.4, 'damp', -0.3); G.patch(29.6, 6.4, 2.6, 1.3, 'dust', 0.1); G.patch(16.9, 12.2, 1.2, 2.4, 'damp', 0.05);
  G.patch(17.4, 20.6, 2.2, 1.0, 'oil', 0.1); G.patch(5.0, 18.2, 2.8, 1.6, 'dust', -0.2); G.patch(25.0, 20.6, 3.0, 1.2, 'dust', 0.15);
  G.rubble(1.7, 12.2, 0.7, 6); G.rubble(2.0, 21.2, 0.6, 5); G.bush(1.3, 14.8, 0.9); G.bush(1.5, 5.2, 0.8);
  grp('floors');
  G.ground(4, 12, 10, 16, 'mudFloor', 0.008);                                     // the tea house: beaten earth under its rugs
  G.ground(4, 8, 10, 12, 'slab', 0.008);                                          // its kitchen
  slab(10, 0, 8, 16, 0.008, 16, P.slab, { flags: BoxFlag.Gloss, rough: 0.22 });   // the phone shop and its workshop: the row's one tiled floor, mopped
  G.ground(18, 8, 24, 16, 'slab', 0.008);                                         // the pharmacy and its store
  G.ground(24, 8, 30, 16, 'mudFloor', 0.008);                                     // the money changer's and the office
  G.ground(30, 8, 36, 16, 'slab', 0.008);                                         // the garage
  G.ground(32.5, 4, 36, 8, 'slab', 0.008);                                        // the generator room
  grp('ceiling');   // (three: the west block, the east block, the generator room — the storm reads the largest ceilings as the roofs)
  slab(3.9, H, 7.9, 16.1, H + 0.2, 16.1, [0.5, 0.47, 0.41], roof);
  slab(17.9, H, 7.9, 36.1, H + 0.2, 16.1, [0.5, 0.47, 0.41], roof);
  slab(32.4, H, 3.9, 36.1, H + 0.2, 7.9, [0.36, 0.35, 0.33], roof);

  // ---------------- the walls round the row: north (behind the alley), south (across the street), east (the street's end). The west is open: two mouths ----------------
  grp('walls.exterior');
  G.yardWallX(4, 3.88, 32.38, 'mud', [{ a: 19.8, b: 21.0, y0: 0, y1: 2.2 }]);                        // north: the north gate
  G.wallX(4, 32.38, 36.12, 'block');                                                               // …and the generator room's own north wall on its line
  G.yardWallX(22, 3.88, 36.12, 'mud', [{ a: 21.8, b: 23.0, y0: 0, y1: 2.2 }]);                       // south: the south gate
  G.yardWallZ(36, 16.12, 22, 'mud', [{ a: 18.3, b: 19.5, y0: 0, y1: 2.2 }]);                         // east: the east gate at the street's end
  for (const [x, z] of [[4, 4], [4, 22], [19.5, 4], [21.3, 4], [21.5, 22], [23.3, 22], [36, 18.0], [36, 19.8], [12.6, 22], [30.2, 22], [12.4, 4], [28.4, 4]] as const) G.pier(x, z);
  G.skirt('x', 4, 4.3, 10.3, 1); G.skirt('x', 4, 13.3, 19.2, 1); G.skirt('x', 4, 21.6, 23.1, 1); G.skirt('x', 4, 24.7, 28.1, 1); G.skirt('x', 4, 28.7, 32.3, 1);
  G.skirt('x', 22, 4.3, 12.3, -1); G.skirt('x', 22, 12.9, 14.1, -1); G.skirt('x', 22, 23.6, 29.9, -1); G.skirt('x', 22, 33.5, 35.8, -1);
  // ---------------- the shops: rear wall z 8, front wall z 16, gables x 4 / 16 / 18 / 36, party walls x 10 / 24 / 30, the back-room partitions z 12 ----------------
  grp('walls.shops');
  G.wallX(8, 4, 16, 'mud', [{ a: 6.8, b: 8.0 }, { a: 12.3, b: 13.5 }]);                                                          // tea_back, phone_back
  G.wallX(8, 18, 32.38, 'render', [{ a: 20.3, b: 21.5 }, { a: 28.2, b: 29.2, y0: 1.35, y1: 2.0 }]);                              // pharm_back; the office's high barred window
  G.wallX(8, 32.38, 36, 'render', [{ a: 32.8, b: 34.0 }]);                                                                       // garage_back (into the generator room)
  G.wallX(16, 4, 16, 'mud', [{ a: 6.3, b: 7.5 }, { a: 8.2, b: 9.6, y0: 0.9, y1: 2.2 }, { a: 12.3, b: 13.5 }, { a: 14.0, b: 15.6, y0: 0.9, y1: 2.2, glass: 'whole' }]);   // tea_front + its open window, phone_front + its glass
  G.wallX(16, 18, 36, 'render', [{ a: 18.5, b: 19.9, y0: 0.9, y1: 2.2, glass: 'whole' }, { a: 20.3, b: 21.5 }, { a: 26.3, b: 27.5 }, { a: 28.0, b: 29.6, y0: 1.0, y1: 2.0, mullions: 4, glass: 'whole' }, { a: 31.3, b: 32.5 }]);   // pharmacy glass + pharm_front, hawala_front + its barred glass, garage_front (the wicket in the roller door)
  G.wallZ(4, 7.88, 16.12, 'mud');                                                                    // the tea house's blind gable
  G.wallZ(16, 8.12, 15.88, 'mud');                                                                   // the phone shop's gable on the passage: blind (a door here was tried: it made the display case two doors from the north gate, and a blind walk took it)
  G.wallZ(18, 8.12, 15.88, 'render', [{ a: 13.3, b: 14.5 }]);                                        // the pharmacy's gable: pharm_side
  G.partZ(10, 8.12, 15.88, 'mudLight', [{ a: 9.3, b: 10.5 }]);                                       // tea house | phone shop: tea_phone (kitchen ↔ workshop)
  G.partZ(24, 8.12, 15.88, 'whitewash', [{ a: 9.3, b: 10.5 }]);                                      // pharmacy | money changer: pharm_hawala (store ↔ office)
  G.wallZ(30, 8.12, 15.88, 'render', [{ a: 9.3, b: 10.5 }]);                                         // money changer | garage: office_garage
  G.wallZ(36, 4, 8, 'block'); G.wallZ(36, 8, 16.12, 'render');                                       // the garage's and the generator room's east walls, on the east wall's line
  G.wallZ(32.5, 4.12, 7.88, 'block', [{ a: 5.3, b: 6.5 }]);                                          // the generator room's alley wall: gen_door
  grp('walls.partitions');
  G.partX(12, 4.12, 9.94, 'mudLight', [{ a: 7.8, b: 9.2 }]);                                         // tea house | kitchen: an arch, no leaf
  G.partX(12, 10.06, 15.88, 'whitewash', [{ a: 13.8, b: 15.0 }]);                                    // phone_work
  G.partX(12, 18.12, 23.94, 'whitewash', [{ a: 22.3, b: 23.5 }]);                                    // pharm_store
  G.partX(12, 24.06, 29.88, 'mudLight', [{ a: 25.3, b: 26.5 }]);                                     // hawala_office
  grp('fronts');   // each shop's own paint on the street: a band to the sill, the rolled-down shutters. Paint only, standing on the ground
  G.skirt('x', 16, 4.2, 6.2, 1, 'paintRust', 0.85); G.skirt('x', 16, 7.6, 10.1, 1, 'paintRust', 0.85);                       // the tea house
  G.skirt('x', 16, 11.9, 12.2, 1, 'paintBlue', 0.85); G.skirt('x', 16, 13.6, 15.9, 1, 'paintBlue', 0.85);                    // the phone shop
  G.skirt('x', 16, 18.1, 20.2, 1, 'paintGreen', 0.85); G.skirt('x', 16, 21.6, 22.1, 1, 'paintGreen', 0.85);                  // the pharmacy
  G.skirt('x', 16, 27.6, 30.0, 1, 'paintCream', 0.85);                                                                       // the money changer's
  slab(24.3, 0, 16.124, 26.0, 2.5, 16.16, P.paintCream, { flags: BoxFlag.NoShadow, rough: 0.5 });                             // his shutter, down
  slab(32.9, 0, 16.124, 35.7, 2.5, 16.16, P.galv, { flags: BoxFlag.NoShadow, rough: 0.45 });
  for (const [a, b, paint] of [[4.4, 9.8, P.paintRust], [12.0, 15.8, P.paintBlue], [18.2, 22.0, P.paintGreen], [24.3, 29.8, P.paintCream], [32.9, 35.7, P.paintRust]] as [number, number, Vec3][])
    slab(a, 2.38, 16.125, b, 2.82, 16.17, paint, { rough: 0.5 });                                                             // a signboard over each front, in the shop's paint                                  // the garage's roller door
  G.skirt('x', 8, 4.2, 6.7, -1); G.skirt('x', 8, 8.1, 12.2, -1); G.skirt('x', 8, 18.1, 20.2, -1); G.skirt('x', 8, 21.6, 26.1, -1); G.skirt('x', 8, 27.6, 32.3, -1);   // the damp foot of the rear walls
  G.skirt('z', 16, 8.2, 15.8, 1); G.skirt('z', 18, 8.2, 13.2, -1);                                                           // …and of the passage's

  // ---------------- furniture (own pieces first: a goods rack, the samovar, the range, the display case) ----------------
  /** a goods RACK w × d × hgt: two ends, boards, and whatever the shop sells on them (a full-height blocker, as the shelf it replaces) */
  const rack = (x: number, z: number, w: number, d: number, yaw: number, hgt: number, goods: Mt[]) => {
    const b = G.piece(x, z, yaw), n = Math.max(2, Math.round(hgt / 0.48));
    for (const s of [-1, 1]) b(s * (w / 2 - 0.02), 0, 0, hgt, 0.02, d / 2, M.woodGrey);
    for (let k = 0; k <= n; k++) { const y = k === 0 ? 0.1 : k * hgt / n; b(0, 0, y - 0.03, y, w / 2 - 0.04, d / 2, M.poplar); }
    const m = Math.max(2, Math.round(w / 0.55)), bay = (w - 0.12) / m;
    for (let k = 0; k < n; k++) { const y0 = k === 0 ? 0.1 : k * hgt / n, room = (k + 1) * hgt / n - 0.03 - y0;
      for (let i = 0; i < m; i++) { const r = h01(x + i, z + k, 7); if (r < 0.14) continue;
        b(-w / 2 + 0.06 + (i + 0.5) * bay, 0, y0, y0 + room * (0.55 + 0.4 * h01(x + i, z + k, 9)), bay / 2 - 0.02, d / 2 - 0.03, M[goods[Math.floor(r * 97) % goods.length]]); } }
  };
  grp('room.teahouse');
  G.rug(6.0, 13.4, 2.6, 1.8, 'afghan'); G.rug(8.7, 14.6, 1.6, 1.6, 'baluch');
  G.lowTable(5.3, 13.2, 0); G.lowTable(8.8, 14.6, HALF);
  G.toshak(6.2, 12.5, 1.9, 0); G.toshak(9.45, 13.4, 1.6, HALF, 'rugNavy', 'rugRed');
  { const b = G.piece(4.5, 14.9, 0);                                                               // the samovar's counter on the west wall, and the samovar
    b(0, 0, 0, 1.0, 0.3, 0.8, M.poplar); b(0, -0.3, 1.0, 1.4, 0.14, 0.14, M.tin); b(0, -0.3, 1.4, 1.5, 0.06, 0.06, M.iron); b(0, 0.35, 1.0, 1.06, 0.2, 0.26, M.tin); }
  G.wallHanging('z', 4, 13.2, 1, 'baluch');
  grp('room.kitchen');
  { const b = G.piece(4.5, 9.7, 0); b(0, 0, 0, 0.86, 0.3, 1.1, M.tin); b(0, 0, 0.86, 0.9, 0.3, 1.1, M.iron); b(0, -0.5, 0.9, 1.12, 0.17, 0.17, M.tin); }   // the range, a pot on it
  rack(5.6, 11.68, 1.6, 0.4, 0, 1.9, ['tin', 'sack', 'plasticBlue', 'ply']);
  G.sacks(5.7, 8.7, 0, 2); G.gasBottle(4.6, 11.3);
  grp('room.phoneshop');
  G.table(11.2, 14.0, 1.8, 0.6, HALF); G.plasticChair(10.55, 14.0, -HALF, 'plasticBlue');
  add({ c: [11.2, 0.79, 13.6], h: [0.16, 0.04, 0.2], ...M.plasticBlack });                           // the till
  rack(15.62, 13.6, 1.5, 0.4, HALF, 1.9, ['plasticBlack', 'plasticWhite', 'plasticBlue', 'ply']);
  add({ c: [14.8, 0.35, 15.5], h: [0.75, 0.35, 0.28], ...M.ply, name: 'phone_case' });               // THE DISPLAY CASE under the street window: spot 1
  add({ c: [14.8, 0.8, 15.5], h: [0.75, 0.1, 0.28], ...M.glassDark });
  const caseLed = add({ c: [15.1, 0.8, 15.214], h: [0.012, 0.012, 0.006], ...M.plasticBlack, emissive: [0.3, 3, 0.5], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'rack1_leds', boxes: [caseLed], group: 'server_leds', on: true, baseEmissive: [0.3, 3, 0.5], mains: false });
  grp('room.workshop');
  G.table(14.9, 8.55, 1.6, 0.7, 0);                                                                  // the repair bench
  add({ c: [14.9, 0.762, 8.5], h: [0.17, 0.012, 0.12], ...M.plasticBlack, name: 'bench_laptop' });
  rack(15.62, 10.8, 1.6, 0.4, HALF, 1.9, ['plasticBlack', 'ply', 'tin', 'plasticWhite']);
  G.crates(10.7, 11.3, HALF, 2, 'coyote'); G.trunk(11.6, 8.6, 0, 'paintBlue'); G.plasticChair(14.3, 9.4, Math.PI, 'plasticWhite');
  grp('room.pharmacy');
  G.table(23.3, 14.4, 1.8, 0.6, HALF);                                                               // the counter
  rack(19.8, 12.3, 2.2, 0.4, 0, 2.0, ['plasticWhite', 'paintGreen', 'plasticBlue', 'whitewash']);
  add({ c: [19.2, 0.42, 15.55], h: [0.6, 0.42, 0.24], ...M.plasticWhite });                          // the low cabinet under the window
  grp('room.pharmstore');
  rack(18.42, 10.0, 2.6, 0.45, HALF, 2.0, ['plasticWhite', 'ply', 'paintGreen', 'ply']);             // along the west wall
  rack(19.9, 10.7, 2.0, 0.45, HALF, 2.0, ['ply', 'plasticWhite', 'ply', 'plasticBlue']);             // a second run a stride off it: the aisle between is a pocket
  G.crates(23.2, 8.6, 0, 2, 'coyote'); G.trunk(21.3, 11.55, 0, 'paintGreen');
  grp('room.hawala');
  G.table(28.5, 13.3, 2.4, 0.6, 0);                                                                  // the counter
  G.plasticChair(28.5, 12.55, Math.PI); G.trunk(29.35, 12.45, 0, 'paintCream');
  G.toshak(24.5, 14.4, 1.9, HALF, 'rugNavy', 'rugRed'); G.rug(26.3, 14.2, 2.0, 1.4, 'kilim');
  grp('room.office');
  add({ c: [28.7, 0.6, 8.5], h: [0.35, 0.6, 0.3], ...M.iron, name: 'office_safe' });                 // THE SAFE: spot 0
  const safeLed = add({ c: [28.9, 0.95, 8.805], h: [0.012, 0.012, 0.006], ...M.plasticBlack, emissive: [3, 0.4, 0.2], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'rack0_leds', boxes: [safeLed], group: 'server_leds', on: true, baseEmissive: [3, 0.4, 0.2], mains: false });
  G.table(28.0, 11.3, 1.6, 0.7, 0); G.plasticChair(27.6, 10.6, Math.PI);
  add({ c: [24.55, 0.9, 8.42], h: [0.42, 0.9, 0.26], ...M.galv });                                   // a steel cupboard in the north-west corner
  G.rug(26.6, 10.3, 2.2, 1.4, 'afghan');
  grp('room.garage');
  G.pickup(33.2, 12.6, -HALF, 'truckTan');                                                           // the pickup, nose to the roller door
  G.table(35.3, 13.0, 1.4, 0.6, HALF);
  add({ c: [35.0, 0.9, 8.45], h: [0.5, 0.9, 0.3], ...M.olive, name: 'garage_cabinet' });             // THE STEEL CABINET: spot 2
  const lockerLed = add({ c: [35.3, 1.5, 8.755], h: [0.012, 0.012, 0.006], ...M.plasticBlack, emissive: [3, 2, 0.3], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'rack2_leds', boxes: [lockerLed], group: 'server_leds', on: true, baseEmissive: [3, 2, 0.3], mains: false });
  rack(30.42, 13.3, 2.0, 0.4, HALF, 1.9, ['rubber', 'tin', 'rust', 'drumBlue']);
  G.tyres(35.4, 15.35, 3); G.drum(30.55, 15.35, 'drumBlue'); G.patch(33.2, 10.6, 1.6, 1.0, 'oil', 0.2);
  grp('room.generator');
  G.generator(35.0, 5.0, 0);
  G.jerryCan(33.4, 4.5, 0.2); G.jerryCan(33.85, 4.55, -0.3, 'jerryYellow'); G.patch(34.6, 5.9, 1.2, 0.8, 'oil', 0.4);
  grp('alley');
  // The alley is never seen end to end: four things stand out of its walls to past the middle, north and south by turns, each taller than a man. A torch
  // coming down it shows round one before its owner does; the stretch between two of them is what he can see.
  slab(10.4, 0, 4.12, 12.0, 2.04, 6.3, P.mud, { rough: 0.95 }); slab(10.35, 2.04, 4.12, 12.05, 2.1, 6.35, P.tin, { rough: 0.5 });   // THE BREAD OVEN's lean-to against the north wall (x 10.4‥12)…
  G.tandoor(12.75, 4.75); G.woodPile(9.5, 4.5, 0, 1.4);                                                                            // …the oven itself beside it, and its wood
  slab(14.4, 0, 5.5, 15.6, 1.86, 7.88, P.poplar, { rough: 0.8 }); slab(14.44, 1.86, 5.54, 15.56, 2.0, 7.84, P.woodGrey, { rough: 0.85 });   // pallets stacked to the eaves behind the phone shop (south)
  slab(23.2, 0, 4.12, 24.6, 2.0, 6.3, P.canvas, { rough: 0.9 }); G.sacks(22.7, 4.62, 0, 3);                                         // sacks under a tarpaulin (north), a few left out
  slab(26.2, 0, 5.6, 27.5, 1.0, 7.88, P.mud, { rough: 0.95 });                                                                     // the water tanks on their plinth, west of the office's window (south)
  for (const z of [6.2, 7.3]) { const b = G.piece(26.85, z, 0); b(0, 0, 1.0, 2.04, 0.6, 0.52, M.plasticWhite); b(0, 0, 2.04, 2.1, 0.62, 0.54, M.galv); }
  G.gasBottle(5.0, 7.5); G.jerryCan(22.4, 7.55, 0.3, 'jerryYellow'); G.drum(31.9, 7.45, 'rust');
  grp('passage');
  G.gasBottle(16.4, 8.4, 'drumBlue');
  add({ c: [16.3, 0.5, 11.4], h: [0.05, 0.5, 0.05], ...M.galv }); add({ c: [16.36, 0.94, 11.4], h: [0.11, 0.03, 0.03], ...M.iron });   // a standpipe
  grp('street');
  // The street is cut the same way: a shuttered kiosk out of the shop fronts, the lorry along the south wall, a second kiosk, a loaded cart — north, south,
  // north, south. From any one place a man sees the stretch he is in and a slit of the next.
  const kiosk = (x0: number, x1: number, z1: number, paint: Vec3) => {   // a shuttered kiosk out of the shop fronts: a painted box under a tin lid, its hatch down
    slab(x0, 0, 16.12, x1, 2.4, z1, paint, { rough: 0.5 });
    slab(x0 - 0.1, 2.4, 16.12, x1 + 0.1, 2.46, z1 + 0.25, P.tin, { rough: 0.5 });
    slab(x0 + 0.15, 0.9, z1, x1 - 0.15, 2.1, z1 + 0.03, P.galv, { rough: 0.45 });
    slab(x0 + 0.1, 0.84, z1, x1 - 0.1, 0.9, z1 + 0.2, P.poplar, { rough: 0.8 });
  };
  kiosk(10.2, 11.8, 18.5, P.paintGreen);                                                             // between the tea house and the phone shop's door (north)
  kiosk(22.2, 23.7, 18.5, P.paintCream);                                                             // between the pharmacy's door and the money changer's (north)
  kiosk(30.1, 31.1, 18.2, P.paintRust);                                                              // a third, hard by the garage's wicket: from the wicket to the east gate nobody up the street sees you
  // THE LORRY, nose east along the south wall: a canvas tilt over the bed, a red cab
  slab(14.2, 0.45, 19.5, 18.6, 2.5, 21.88, P.canvas, { rough: 0.9 });
  slab(18.6, 0.45, 19.7, 20.0, 1.25, 21.7, P.truckRed, { rough: 0.5 }); slab(18.7, 1.25, 19.78, 19.9, 1.86, 21.62, P.glassDark, { rough: 0.2 }); slab(18.62, 1.86, 19.72, 19.98, 1.9, 21.68, P.truckRed, { rough: 0.5 });
  for (const x of [15.0, 17.6, 19.4]) for (const z of [19.75, 21.6]) add({ c: [x, 0.3, z], h: [0.36, 0.3, 0.14], ...M.rubber });
  for (const x of [14.9, 15.8, 16.7, 17.6]) slab(x, 2.5, 19.5, x + 0.08, 2.57, 21.88, P.woodGrey, { rough: 0.8 });                // the tilt's hoops
  for (let i = 0; i < 6; i++) slab(14.35 + i * 0.7, 0.95, 19.46, 14.95 + i * 0.7, 1.75, 19.5, [P.paintRust, P.paintCream, P.paintGreen][i % 3], { rough: 0.5 });   // painted panels down the flank
  slab(18.6, 1.9, 19.7, 19.1, 2.5, 21.7, P.paintRust, { rough: 0.5 });                                // the crown board over the cab
  slab(14.14, 0.45, 19.56, 14.2, 1.35, 21.82, P.paintGreen, { rough: 0.5 });                          // the tailboard
  slab(31.6, 0, 19.5, 33.4, 0.55, 21.88, P.poplar, { rough: 0.8 }); slab(31.6, 0.55, 19.5, 33.4, 2.2, 21.88, P.canvas, { rough: 0.9 });   // a loaded cart under a tarpaulin, short of the east gate (south)
  G.pickup(11.6, 20.6, 0, 'truckWhite', { load: 'sacks' });                                          // parked under the west lamp
  G.stall(7.4, 20.6, 0, 2.2, 'tarpBlue'); G.crates(5.6, 21.3, 0.1, 2, 'coyote');                     // THE BLUE STALL: under its awning the lamp does not reach
  G.handcart(29.6, 21.35, Math.PI, 'produce');
  G.crates(23.9, 21.4, HALF, 5, 'coyote');                                                           // a stack of crates inside the south gate: with the lorry's cab the other side, a pocket to read the street from
  G.motorbike(9.9, 17.3, HALF); G.plasticChair(8.9, 16.9, 2.6); G.plasticChair(28.6, 17.0, -2.7, 'plasticBlue');
  G.wire(9.75, 21.2, 9.75, 16.2, 2.95); G.wire(27.0, 21.2, 27.0, 16.2, 2.95);

  // ---------------- lights: the street's two lamps, the door bulbs and the two window lights are on the mains with the shops' panels; the moon is not ----------------
  grp('lights');
  ceilingPanel(6.6, 14.0, true, 'teahouse', false, 1.2, 0.6, [9, 7, 4.2]);
  ceilingPanel(7.0, 10.0, false, 'kitchen');
  ceilingPanel(13.0, 14.0, false, 'phoneshop'); ceilingPanel(13.0, 10.0, false, 'workshop');
  ceilingPanel(21.0, 14.0, false, 'pharmacy'); ceilingPanel(21.6, 10.0, false, 'pharmstore');
  ceilingPanel(26.6, 14.2, true, 'hawala');
  ceilingPanel(27.6, 10.4, true, 'office', false, 0.6, 0.6, [8, 7, 5]);
  ceilingPanel(33.0, 11.6, true, 'garage', true);
  ceilingPanel(34.2, 6.2, false, 'generator');
  const bulbAt = (x: number, y: number, z: number, name: string, group: string, intensity = 14, range = 5, color: Vec3 = [1.0, 0.7, 0.42]) => {
    add({ c: [x, y + 0.2, z], h: [0.02, 0.02, 0.14], ...M.iron, flags: BoxFlag.NoShadow });
    const b = add({ c: [x, y, z], h: [0.04, 0.05, 0.04], ...M.plasticWhite, emissive: [30 * color[0], 31 * color[1], 28 * color[2]], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'point', pos: [x, y - 0.03, z], dir: [0, -1, 0], color, intensity, range, innerDeg: 0, outerDeg: 180, name, group, enabled: true, volumetric: 0.2, fixtureBox: b, radius: 0.06, mains: true });
  };
  bulbAt(7.4, 2.45, 7.7, 'bulb_teaback', 'exterior');                                               // over the kitchen door: the alley's mouth is lit
  bulbAt(20.9, 2.45, 7.7, 'bulb_pharmback', 'exterior', 10, 4.5);                                    // over the pharmacy's back door, across from the north gate: the pick is done in the light
  bulbAt(35.5, 2.45, 17.9, 'bulb_gate', 'exterior', 10, 4.5);                                        // over the east gate: the last four metres out are lit
  bulbAt(32.2, 2.45, 5.9, 'bulb_generator', 'exterior');                                             // over the generator room's door: the breaker is in the light
  bulbAt(14.6, 2.3, 14.9, 'light_phonewindow', 'window_phone', 8, 4.5, [0.8, 0.9, 1.0]);             // the phone shop's window light: the display case is on show to the street
  bulbAt(19.2, 2.3, 15.5, 'light_pharmwindow', 'window_pharm', 5, 3.2, [0.62, 1.0, 0.72]);           // the pharmacy's, green and small: the window and a stride of floor, not the way through from the side door
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], ...M.galv });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, ...M.galv });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, ...M.iron });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, ...M.plasticWhite, emissive: [40, 24, 7], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: [dir[0] * 0.35, -1, dir[2] * 0.35], color: [1.0, 0.62, 0.22], intensity: 220, range: 16, innerDeg: 28, outerDeg: 52, name, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: true, broad: true });
  };
  lampAt(9.2, 21.72, 'lamp_west', [0, 0, -1]);                                                      // over the tea house's and the phone shop's fronts
  lampAt(27.0, 21.72, 'lamp_east', [0, 0, -1]);                                                      // over the money changer's door
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---------------- the breaker (the generator room's east wall) and two battery beacons ----------------
  grp('breaker');
  const brk = add({ c: [35.84, 1.35, 6.9], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [35.79, 1.62, 7.08], h: [0.01, 0.015, 0.015], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(27.0, 13.0); beacon(32.2, 14.6);

  // ---------------- doors (closedDir X: the leaf runs +x from the hinge, its +1 side is south; Z: +z from the hinge, its +1 side is west). A locked leaf is
  //                  locked from its keySide only: every back room opens freely from inside ----------------
  const X = 0, Z = HALF;
  const doorDefs: LevelDoorDef[] = [
    { name: 'gate_e', hinge: [36.0, 18.32], closedDir: Z, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [19.82, 4.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'gate_s', hinge: [21.82, 22.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'tea_front', hinge: [6.32, 16.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'tea_back', hinge: [6.82, 8.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'tea_phone', hinge: [10.0, 9.32], closedDir: Z, width: 1.16 },
    { name: 'phone_front', hinge: [12.32, 16.0], closedDir: X, width: 1.16, exterior: true, locked: true, keySide: 1 },
    { name: 'phone_back', hinge: [12.32, 8.0], closedDir: X, width: 1.16, exterior: true, locked: true, keySide: -1 },
    { name: 'phone_work', hinge: [13.82, 12.0], closedDir: X, width: 1.16 },
    { name: 'pharm_side', hinge: [18.0, 13.32], closedDir: Z, width: 1.16, exterior: true },
    { name: 'pharm_front', hinge: [20.32, 16.0], closedDir: X, width: 1.16, exterior: true, locked: true, keySide: 1 },
    { name: 'pharm_back', hinge: [20.32, 8.0], closedDir: X, width: 1.16, exterior: true, locked: true, keySide: -1 },
    { name: 'pharm_store', hinge: [22.32, 12.0], closedDir: X, width: 1.16 },
    { name: 'pharm_hawala', hinge: [24.0, 9.32], closedDir: Z, width: 1.16, locked: true, keySide: 1 },
    { name: 'hawala_front', hinge: [26.32, 16.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'hawala_office', hinge: [25.32, 12.0], closedDir: X, width: 1.16, locked: true, keySide: 1 },
    { name: 'office_garage', hinge: [30.0, 9.32], closedDir: Z, width: 1.16, locked: true, lock: 'pad_office', keySide: -1 },
    { name: 'garage_front', hinge: [31.32, 16.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'garage_back', hinge: [32.82, 8.0], closedDir: X, width: 1.16, locked: true, keySide: -1 },   // locked on the generator room's face
    { name: 'gen_door', hinge: [32.5, 5.32], closedDir: Z, width: 1.16, exterior: true },
  ];
  const THICK = new Set(['tea_front', 'tea_back', 'phone_front', 'phone_back', 'pharm_side', 'pharm_front', 'pharm_back', 'hawala_front', 'office_garage', 'garage_front', 'garage_back', 'gen_door']);   // leaves in 0.24 walls
  for (const d of doorDefs) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- devices: the street's camera (mains), the office's (battery), the keypad on the garage's side of the office ----------------
  const devices: DeviceDef[] = [
    // over the money changer's door, panning the street in front of it under the east lamp: the front way to the safe is lit AND watched. The lamp out, a round,
    // the OCP or the breaker each blind it
    { kind: 'camera', name: 'cam_street', pos: [26.9, 2.7, 16.22], yaw: 0, pitch: -0.5, sweep: [-0.5, 0.5], sweepPeriod: 10, fovDeg: 66, range: 9, mains: true },
    // inside the office, the south-west corner over the two west doors, fixed on the safe and the garage's door: a step in from either west door is still under
    // it, the safe is not. On a battery: the breaker does not help with this one
    { kind: 'camera', name: 'cam_server', pos: [24.4, 2.6, 11.62], yaw: 2.25, pitch: -0.35, fovDeg: 80, range: 8, mains: false },
    { kind: 'keypad', name: 'pad_office', pos: [30.16, 1.4, 9.14], yaw: HALF, door: 'office_garage', code: '4127' },
  ];

  // ---------------- the shift: seven beats, five manned a run (QUIET.patrols). A waypoint with a wait is where he stands, facing the way he walked to it ----------------
  const W = (x: number, z: number): Vec3 => [x, 0, z];
  const routes: PatrolRoute[] = [
    // THE WEST ROUND, clockwise round the west block: down the passage, up to the phone shop's lit window for a look in, west along the street under the west
    // lamp, round the tea house's gable past both mouths, east down the alley and into the passage again
    { name: 'roundW', points: [W(17.0, 14.6), W(17.0, 17.4), W(14.8, 18.3), W(14.8, 17.1), W(13.0, 18.8), W(5.6, 19.2), W(2.9, 17.0), W(2.9, 8.0), W(5.2, 6.3), W(13.2, 6.6), W(17.0, 6.2), W(17.0, 9.4)],
      wait: [3, 0, 0, 9, 0, 9, 0, 7, 0, 0, 8, 0] },   // (hand-set: his four stands are 14 s longer in all — they were 5, 5, 5, 4 — so that his lap is the east round's, ~86 s, and the
    // two stay half a lap apart lap after lap. With 72 s against 86 s the second lap was not the first: what a player watched from the start mark was no longer true when he moved.)
    // THE EAST ROUND, the other way about round the east block, half a lap out of step. The night starts with him at the generator (the breaker is his): out of
    // its door, west down the alley, TRIES THE PHARMACY'S BACK DOOR — some thirteen seconds in, his back to the north gate — down the passage, up to the
    // pharmacy's window for a look in, east along the street under the camera, in at the garage's wicket, a look at the office's keypad door, and through the
    // garage's back door to the generator again
    // (hand-set: the last stand is 1 s, was 4. His lap with a talk at the lorry in it is then the west torch's 85.7 s (84.7 / 87.8 / 85.6 measured on the
    // shipped stand); without a talk it is 71.9 s. The talks run out after three laps; the needs breaks have begun by then.)
    { name: 'roundE', points: [W(34.2, 6.6), W(31.0, 6.0), W(27.0, 4.9), W(25.4, 6.0), W(22.6, 6.3), W(20.9, 6.3), W(20.9, 7.2), W(17.0, 6.4), W(17.0, 14.0), W(17.6, 18.5), W(19.2, 18.4), W(19.2, 17.2), W(20.9, 17.4), W(23.0, 19.1), W(26.0, 18.4), W(30.6, 18.9), W(31.9, 17.2), W(31.6, 9.9), W(30.9, 9.9), W(33.4, 9.2)],
      wait: [2, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1, 0] },
    // the lorry's driver, awake: up and down the flank of his lorry — a while by the bed looking west down the street, a long while leaning on the cab with
    // his eyes on the passage's mouth and the pharmacy's front and HIS BACK TO THE SOUTH GATE
    // (ON THE FIRST LAP he has not arrived from anywhere: for those first ten seconds he faces EAST along the lorry, down his first leg, not west. Every
    // number of this level was measured that way; a lead-in waypoint would turn him west from the first frame and wants the deals measured again.)
    // (hand-set waits, the original points: 17 s by the bed, 10.75 s at the cab, so his lap is HALF the east torch's own (35.95 of 71.9 s). The east
    // torch comes out of the passage's mouth as he starts back from the cab every lap; on the first three laps they stop and talk there (dialogue.ts
    // AMBIENT: each of the level's three talks is heard once a run, and a talk holds both men, so they stay in step through it). He is then by the bed,
    // his back to the pharmacy, for about 14 s after the torch leaves the shutter: that is the shops route's way across the shop. He must be walking east
    // by t = 20 s: stood by the bed then he is within talking reach of the west torch and the first talk holds the west round up instead.)
    { name: 'lorry', points: [W(16.6, 18.7), W(20.9, 19.2), W(20.3, 18.6)], wait: [17, 0, 10.75] },
    // the money changer's own man: behind the door with his eyes on the office's, INTO THE OFFICE for a look at the safe, out on the step under the lamp
    { name: 'counter', points: [W(26.6, 14.4), W(25.9, 12.8), W(26.4, 10.4), W(25.9, 12.8), W(26.9, 17.2)], wait: [16, 2, 7, 0, 8] },
    // sits in the tea house, smokes at the kitchen door under its bulb looking out of the alley's mouth, looks out of the street's mouth
    // (hand-set waits, same points: his lap is the torches' lap, about 86 s, so he is in the same place each time a torch is. Out on the
    // street's mouth as the west torch goes down the passage, which is when the kitchen is empty; his smoke is over before the west torch
    // comes up the gable; then he stands at the kitchen stove until the west torch has gone by.)
    { name: 'teahouse', points: [W(7.2, 14.6), W(6.9, 17.3), W(7.2, 14.4), W(6.4, 13.8), W(8.5, 10.4), W(6.4, 6.6), W(5.4, 6.7), W(7.4, 7.0), W(8.5, 10.8)], wait: [0, 14, 0, 10, 0, 0, 6, 0, 26.3] },
    // the garage's man: the desk, the pickup, and his smoke OUT OF THE GENERATOR ROOM'S DOOR under its bulb, looking west up the alley as far as the water tank
    { name: 'garage', points: [W(34.6, 11.2), W(31.3, 11.4), W(33.4, 9.2), W(33.3, 6.6), W(31.6, 5.9), W(33.3, 6.6)], wait: [16, 3, 0, 0, 7, 0] },
    // the night watchman of the street's south side: starts with his back to the south gate, the east gate, and back for a long look at the south gate
    { name: 'watchman', points: [W(22.6, 20.4), W(29.0, 20.3), W(34.6, 20.2), W(29.0, 20.2), W(22.4, 20.2)], wait: [0, 0, 7, 2, 8] },
  ];
  const SETS: string[][] = [
    ['roundW', 'roundE', 'lorry', 'counter', 'teahouse'],     // 0 — the lorry's driver on the street, the tea house manned, the money changer's man in and out of the office; the east end is the round's alone
    ['roundW', 'roundE', 'counter', 'garage', 'watchman'],    // 1 — the east end full: the garage's man smoking at the alley's east end, the watchman, the office visited; the tea house is the keeper's alone
    ['roundW', 'roundE', 'teahouse', 'garage', 'watchman'],   // 2 — nobody behind the money changer's door (the office is the camera's alone); both ends of the alley have a smoker
  ];
  // the tea house's keeper, up late: the counter, the tables, the range
  const civilians: CivilianDef[] = [
    { name: 'Karim', kind: 'cleaner', tint: [0.52, 0.47, 0.38], tint2: [0.18, 0.16, 0.14],
      points: [W(5.3, 14.7), W(8.2, 14.2), W(6.0, 13.3), W(5.3, 9.8), W(6.4, 11.0)], wait: [12, 10, 8, 16, 6],
      tasks: ['wipe', 'wipe', 'wipe', 'stand', 'shelf'], face: [-HALF, HALF, -HALF, -HALF, 0] },
  ];

  // ---------------- the quiet block ----------------
  const OFFICE: Rect = { x0: 24.06, x1: 29.88, z0: 8.12, z1: 11.94 }, PHONESHOP: Rect = { x0: 10.06, x1: 15.88, z0: 12.06, z1: 15.88 }, GARAGE: Rect = { x0: 30.12, x1: 35.88, z0: 8.12, z1: 15.88 };
  const quiet: QuietData = {
    thing: 'the sat phone',
    starts: [
      // (hand-set: the mark is OUTSIDE the north wall, by its west end, in the dark. The mud wall is between it and everything that walks — the west round's line
      //  down the gable (x 2.9) never has a line to it — so a player may stand here and watch both torches go round twice before he moves. It was (3.0, 10.0),
      //  against the gable ON the west round's line: he walked over it 36 s in.)
      { sam: [6.2, 0, 2.6], samYaw: 0, name: 'behind the north wall, at its west end' },
      { sam: [20.4, 0, 1.8], samYaw: 0, name: 'outside the north gate' },
      { sam: [22.4, 0, 25.4], samYaw: Math.PI, name: 'outside the south gate' },
    ],
    spots: [
      { place: 'the money changer\'s office', area: OFFICE, door: 'hawala_office', holder: 'the safe', rackIndex: 0, front: [28.7, 1.0, 8.82], halfW: 0.35 },
      { place: 'the phone shop', area: PHONESHOP, door: 'phone_work', holder: 'the display case', rackIndex: 1, front: [14.8, 1.0, 15.2], halfW: 0.6 },
      { place: 'the garage', area: GARAGE, door: 'garage_front', holder: 'the steel cabinet', rackIndex: 2, front: [35.0, 1.0, 8.77], halfW: 0.5 },
    ],
    exits: [
      { name: 'the east gate', door: 'gate_e', x: 36.0, z: 18.9, out: [1, 0], halfW: 1.2 },
      { name: 'the north gate', door: 'gate_n', x: 20.4, z: 4.0, out: [0, -1], halfW: 1.2 },
      { name: 'the south gate', door: 'gate_s', x: 22.4, z: 22.0, out: [0, 1], halfW: 1.2 },
    ],
    patrols: SETS,
    needs: {
      coffee: { name: 'the samovar', pos: [5.2, 0, 14.4], face: -HALF },
      smoke: { name: 'the pallets in the alley', pos: [13.7, 0, 7.2], face: Math.PI },
      water: { name: 'the standpipe', pos: [17.1, 0, 11.4], face: -HALF },
      stretch: { name: 'the street', pos: [24.5, 0, 18.9], face: HALF, loop: [W(24.5, 18.9), W(28.0, 18.8), W(28.0, 19.6), W(21.0, 19.0), W(13.0, 18.6)] },
    },
    phones: [{ name: 'the tea house\'s phone', pos: [5.4, 0, 14.6], face: -HALF }],
    wayouts: [{ name: 'the street\'s west end', pos: [2.6, 0, 19.0], face: -HALF }, { name: 'the alley\'s mouth', pos: [2.6, 0, 6.0], face: -HALF }],
  };

  // ---------------- LIVED-IN ROOMS (src/scene/lived.ts; rebuild/play-style-levels/rooms/read-first.md): what makes each shop, the alley, the passage and the
  //                  street ITS place. Everything below is in a group 'lived.<place>' or named 'lived.<place>.<thing>' and is the TAIL of every list: the
  //                  loader leaves it all out with the switch off. Additions only; nothing above is moved. No emitter: each place says its light with colour.
  //                  Solids keep 1.1 m off every door line, off the patrol legs and off every authored point; what is under 0.25 m is walked over ----------------
  {
    const w = G.piece(0, 0, 0);                                                    // the world's own frame: w(x, z, y0, y1, hx, hz, mat, extra?, yaw?)
    const D = BoxFlag.NoShadow;
    const pal = (n: Mt) => ({ albedo: P[n], rough: M[n].rough });
    type Cell = (i: number, j: number, W: number, Hc: number) => number;
    const edge = (i: number, j: number, W: number, Hc: number) => Math.min(i, W - 1 - i, j, Hc - 1 - j);
    const top = (res: 'fine' | 'base' | 'coarse', pals: (Mt | number)[], fn: Cell, max = 1) => G.mk(G.face('+y', res, pals.map(p => typeof p === 'number' ? { mul: p } : pal(p)), fn, 0, max));
    const side = (f: '+x' | '-x' | '+z' | '-z', pals: (Mt | number)[], fn: Cell, max = 1) => G.mk(G.face(f, 'coarse', pals.map(p => typeof p === 'number' ? { mul: p } : pal(p)), fn, 0, max));
    const fill: Cell = (i, j, W, Hc) => edge(i, j, W, Hc) >= 1 ? 1 : 0;
    const disc = (k: number): Cell => (i, j, W, Hc) => Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2) < W * k ? 1 : 0;
    const rnd = (x: number, z: number, y0: number, y1: number, r: number, mat: Mt, extra: Parameters<typeof w>[7] = {}) => { const s = r * 0.93; w(x, z, y0, y1, s, s, M[mat], extra); w(x, z, y0, y1 - 0.004, s, s, M[mat], {}, Math.PI / 4); };
    /** a plank top on two board ends (three boxes): hx × hz half extents, `hgt` high */
    const bench = (x: number, z: number, hx: number, hz: number, hgt: number, mat: Mt, alongX = true) => {
      w(x, z, hgt - 0.04, hgt, hx, hz, M[mat]);
      for (const s of [-1, 1]) alongX ? w(x + s * (hx - 0.05), z, 0, hgt - 0.04, 0.025, hz - 0.03, M.woodGrey) : w(x, z + s * (hz - 0.05), 0, hgt - 0.04, hx - 0.03, 0.025, M.woodGrey);
    };
    /** a pair of shoes left side by side (one box, the gap between them a marking); `one` = a single shoe */
    const shoes = (x: number, z: number, mat: Mt, yaw = 0, one = false) => w(x, z, 0.024, 0.09, one ? 0.045 : 0.1, 0.13, M[mat], one ? {} : top('base', [0.2], (i, j, W) => i === W / 2 - 1 || i === W / 2 ? 1 : 0), yaw);
    const named = <T extends { name: string }>(place: string, thing: string, p: T) => { p.name = `lived.${place}.${thing}`; return p; };
    const part = (x: number, y0: number, y1: number, z: number, hx: number, hz: number, mat: Mt, yaw = 0, extra: object = {}) => ({ off: [x, (y0 + y1) / 2, z] as Vec3, h: [hx, (y1 - y0) / 2, hz] as Vec3, yaw, albedo: P[mat], ...extra });
    const bucket = (place: string, thing: string, x: number, z: number, mat: Mt, inside: Mt) => named(place, thing, K.prop('bin', x, z, 0, 2.5, [part(0, 0, 0.24, 0, 0.12, 0.12, mat), part(0, 0.24, 0.26, 0, 0.1, 0.1, inside)]));
    const carton = (place: string, thing: string, x: number, z: number, s: number, yaw = 0) => named(place, thing, K.prop('cardboard', x, z, yaw, 1 + 22 * s ** 3, [part(0, 0, s, 0, s / 2, s / 2, 'ply')]));

    // THE TEA HOUSE (guests on the floor): the samovar's teapots, a water pipe by the toshak, shoes left inside the door on a mat, a covered bird cage under the window
    grp('lived.teahouse');
    named('teahouse', 'waterpipe', K.prop('bin', 4.5, 12.5, 0, 3, [part(0, 0, 0.24, 0, 0.1, 0.1, 'plasticBlue'), part(0, 0.24, 0.6, 0, 0.025, 0.025, 'tin'), part(0, 0.6, 0.67, 0, 0.05, 0.05, 'rust')]));
    w(4.86, 12.66, 0.026, 0.034, 0.22, 0.012, M.drumRed, { flags: D }, -0.45);                                   // its hose, on the rug
    w(4.42, 14.27, 1.0, 1.1, 0.05, 0.05, M.paintBlue); w(4.6, 14.3, 1.0, 1.09, 0.045, 0.045, M.whitewash);          // teapots north of the samovar
    w(4.5, 15.61, 1.0, 1.012, 0.16, 0.07, M.tin, top('base', ['whitewash'], (i, j) => i % 3 === 1 && j % 3 === 1 ? 1 : 0));   // the glass tray
    G.rug(9.0, 15.66, 0.8, 0.4, 'mat');
    shoes(8.76, 15.68, 'plasticBlack', 0.08); shoes(9.0, 15.7, 'blanketBrown', -0.1); shoes(9.24, 15.67, 'coyote', 0.05); shoes(9.46, 15.71, 'drumRed', 0.2, true);   // (the red one's pair is on the cobbler's last, out on the street)
    w(9.66, 15.62, 0, 0.34, 0.15, 0.15, M.rugCream, top('coarse', ['rugRed'], (i, j, W, Hc) => edge(i, j, W, Hc) === 1 ? 1 : 0)); w(9.66, 15.62, 0.34, 0.42, 0.09, 0.09, M.rugCream);   // the bird cage under its night cloth
    named('teahouse', 'watercan', G.jerryCan(4.42, 13.85, 0.1, 'plasticBlue'));

    // THE KITCHEN (tea kitchen): five tin kettles in a row on the range, the big black pot, the wash basin and its wet, a chopping table by the arch
    grp('lived.kitchen');
    [[9.62, 0.1], [9.86, 0.088], [10.07, 0.076], [10.26, 0.064], [10.43, 0.052]].forEach(([z, s]) => w(4.5, z, 0.9, 0.9 + s * 1.7, s, s, M.tin, top('base', [0.45], disc(0.2))));
    rnd(4.48, 8.36, 0, 0.42, 0.19, 'plasticBlack', top('coarse', ['rubber'], disc(0.36)));
    w(4.42, 10.98, 0, 0.17, 0.15, 0.13, M.galv, top('coarse', ['damp', 'whitewash'], (i, j, W, Hc) => edge(i, j, W, Hc) < 1 ? 0 : i >= 3 && i <= 4 && j >= 2 && j <= 3 ? 2 : 1));   // the basin, glasses in it
    G.patch(5.5, 11.0, 1.9, 1.0, 'damp', 0.35); G.patch(5.2, 9.7, 0.8, 1.6, 'rubber', 0.03);                                                                     // wet by the basin, soot by the range
    bench(7.25, 11.68, 0.4, 0.2, 0.75, 'poplar');
    w(7.06, 11.66, 0.75, 0.77, 0.15, 0.11, M.woodGrey); w(7.45, 11.7, 0.75, 0.82, 0.13, 0.13, M.straw, top('base', [0.7], (i, j, W, Hc) => Math.abs(Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2) - 3.4) < 0.7 ? 1 : 0));   // the board, a stack of naan
    named('kitchen', 'onions', K.prop('bin', 7.2, 11.72, 0, 3, [part(0, 0, 0.2, 0, 0.14, 0.12, 'straw'), part(0, 0.2, 0.26, 0, 0.11, 0.09, 'prodRed')]));
    named('kitchen', 'waterjar', K.prop('bin', 6.63, 11.73, 0, 9, [part(0, 0, 0.42, 0, 0.13, 0.13, 'mudLight'), part(0, 0, 0.418, 0, 0.13, 0.13, 'mudLight', Math.PI / 4), part(0, 0.42, 0.5, 0, 0.07, 0.07, 'mudDark')]));

    // THE PHONE SHOP (handsets): the charging board and its shelf of phones, solar panels in the corner, a pyramid of boxed handsets, a card spinner, a bright mat
    grp('lived.phoneshop');
    bench(11.3, 12.3, 1.0, 0.17, 0.75, 'ply');
    w(11.3, 12.3, 0.752, 0.76, 0.9, 0.1, M.whitewash, { flags: D, ...top('coarse', ['plasticBlack', 'plasticBlue', 'prodRed'], (i, j, W, Hc) => i % 4 === 1 && j > 0 && j < Hc - 1 ? 1 + (i >> 2) % 3 % 2 : i % 4 === 2 && j === 0 ? 3 : 0, 2) });   // phones on charge
    w(11.3, 12.066, 0.95, 1.75, 1.0, 0.004, M.ply, { flags: D, ...side('+z', ['plasticBlack', 'plasticWhite', 'rust'], (i, j) => { const u = i % 5, v = j % 7; return u >= 1 && u <= 2 && v >= 3 && v <= 5 ? ((i / 5 | 0) + (j / 7 | 0)) % 3 === 0 ? 2 : 1 : u === 1 && v < 3 ? 3 : 0; }, 2) });   // THE CHARGING BOARD
    const panel: Cell = (i, j) => i % 4 === 3 || j % 4 === 3 ? 1 : 0;
    w(10.45, 15.4, 0.01, 0.05, 0.3, 0.45, M.rugNavy, top('coarse', ['plasticBlue'], panel)); w(10.62, 15.32, 0.05, 0.09, 0.3, 0.45, M.rugNavy, top('coarse', ['plasticBlue'], panel), 0.55);   // two solar panels
    w(11.2, 14.56, 0.75, 0.85, 0.2, 0.2, M.plasticWhite, top('coarse', ['plasticBlue'], (i, j) => (i + j) % 2 ? 1 : 0)); w(11.2, 14.56, 0.85, 0.95, 0.1, 0.1, M.prodYellow);   // the pyramid of boxed handsets
    w(11.2, 14.12, 0.752, 0.76, 0.22, 0.15, M.glassDark, { flags: D, ...top('base', ['plasticWhite', 'prodOrange', 'plasticGreen'], (i, j) => i % 3 === 1 && j % 4 >= 1 && j % 4 <= 2 ? 1 + ((i / 3 | 0) + (j / 4 | 0)) % 3 : 0) });   // handsets laid out on the counter
    w(11.2, 13.24, 0.75, 1.02, 0.015, 0.015, M.tin); w(11.2, 13.24, 0.88, 1.04, 0.06, 0.06, M.prodRed, top('base', ['prodYellow', 'plasticGreen'], (i, j) => 1 + ((i >> 1) + (j >> 1)) % 2));   // the top-up card spinner
    w(13.5, 14.0, 0.012, 0.024, 0.8, 0.7, M.prodOrange, { flags: D, ...top('coarse', ['rugCream', 'plasticBlue'], (i, j, W, Hc) => { const e = edge(i, j, W, Hc); return e === 0 ? 2 : e === 1 ? 0 : ((i >> 1) + (j >> 1)) % 2 ? 1 : 0; }, 2) });   // a bright plastic mat (orange: green is the pharmacy's)
    named('phoneshop', 'stool', K.prop('chair', 12.15, 13.75, 0.3, 2.5, [part(0, 0.38, 0.42, 0, 0.16, 0.16, 'jerryYellow'), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(a * 0.13, 0, 0.38, b * 0.13, 0.02, 0.02, 'jerryYellow'))]));
    carton('phoneshop', 'stock', 10.5, 14.72, 0.34, 0.2);

    // THE WORKSHOP (repairs): black and green small things on one bench, dead sets along the south wall, a battery and inverter, a green lino offcut
    grp('lived.workshop');
    w(15.32, 8.5, 0.752, 0.76, 0.3, 0.22, M.plasticBlack, { flags: D, ...top('base', ['plasticGreen', 'tin'], (i, j) => i % 6 >= 1 && i % 6 <= 3 && j % 7 >= 1 && j % 7 <= 4 ? ((i + j) % 5 === 0 ? 2 : 1) : 0) });   // opened handsets: green boards
    w(15.02, 8.76, 0.75, 0.83, 0.03, 0.03, M.iron); w(14.72, 8.74, 0.75, 1.02, 0.015, 0.015, M.tin);                                                               // the iron's stand, the magnifier's arm (unlit)
    w(15.15, 8.126, 1.1, 1.8, 0.5, 0.004, M.ply, { flags: D, ...side('+z', ['iron', 'drumRed'], (i, j, W, Hc) => { if (i % 3 !== 1) return 0; const len = 3 + Math.floor(h01(i, 0, 5) * 7), t = Hc - 2; return j <= t && j > t - len ? (j > t - 2 ? 2 : 1) : 0; }) });   // the tool board
    w(11.36, 11.5, 0, 0.45, 0.28, 0.22, M.plasticBlack, top('coarse', ['iron', 'stencil'], (i, j, W, Hc) => edge(i, j, W, Hc) === 0 ? 0 : (i + j) % 3 === 0 ? 2 : 1), 0.4);   // a gutted television…
    w(11.34, 11.52, 0.45, 0.72, 0.2, 0.16, M.tin, top('coarse', ['glassDark'], fill), 0.4); w(11.96, 11.7, 0, 0.3, 0.24, 0.14, M.poplar, top('coarse', ['tin'], (i, j, W) => i > 0 && i < W / 2 && j % 2 === 1 ? 1 : 0));   // …a set on top of it, a wooden radio
    w(15.6, 9.22, 0, 0.3, 0.2, 0.2, M.ply, top('coarse', ['prodRed', 'plasticBlue', 'plasticBlack'], (i, j, W, Hc) => edge(i, j, W, Hc) === 0 ? 0 : 1 + Math.floor(h01(i, j, 3) * 3)));   // a crate of dead phones
    w(15.62, 9.66, 0, 0.17, 0.09, 0.14, M.plasticBlack, top('base', ['prodRed', 'tarpBlue'], (i, j, W) => j === 1 && i === 1 ? 1 : j === 1 && i === W - 2 ? 2 : 0)); w(15.62, 9.95, 0, 0.15, 0.1, 0.12, M.genYellow);   // a car battery and the inverter
    w(14.7, 9.6, 0.01, 0.016, 0.7, 0.45, M.rugOchre, { flags: D, ...top('coarse', ['plasticBlack'], (i, j, W, Hc) => j === 3 + ((i >> 2) % 2 ? 1 : 0) + (i % 4 === 3 ? 1 : 0) && i > 1 && i < W - 6 || i === W - 6 && j >= 4 && j < Hc - 3 ? 1 : 0) }, 0.15);   // the lino offcut, a cable across it
    named('workshop', 'tube', K.prop('cardboard', 12.42, 11.66, 0.2, 5, [part(0, 0, 0.28, 0, 0.15, 0.14, 'glassDark'), part(0, 0.06, 0.2, 0.18, 0.06, 0.06, 'galv')]));
    named('workshop', 'spool', K.prop('bin', 15.0, 10.25, 0, 3, [part(0, 0, 0.03, 0, 0.14, 0.14, 'poplar'), part(0, 0.03, 0.2, 0, 0.08, 0.08, 'prodRed'), part(0, 0.2, 0.23, 0, 0.14, 0.14, 'poplar')]));

    // THE PHARMACY (chemist): white and green. The balance and cartons on the counter, tins in the window's green light, a waiting bench, the cross, a wheelchair
    grp('lived.pharmacy');
    bench(22.72, 14.3, 0.17, 0.6, 0.45, 'paintGreen', false);
    w(23.34, 14.6, 0.75, 0.84, 0.1, 0.14, M.plasticWhite, top('base', ['plasticGreen'], (i, j, W, Hc) => j === Math.floor(Hc / 2) ? 1 : 0));
    w(23.934, 14.4, 1.3, 2.0, 0.004, 0.35, M.whitewash, { flags: D, ...side('-x', ['plasticGreen'], (i, j, W, Hc) => { const a = Math.abs(i - (W - 1) / 2), b = Math.abs(j - (Hc - 1) / 2); return (a < 1.6 && b < 5) || (b < 1.6 && a < 5) ? 1 : 0; }) });   // the green cross
    w(20.9, 13.95, 0.012, 0.02, 1.0, 0.6, M.plasticWhite, { flags: D, ...top('coarse', ['plasticGreen'], (i, j, W, Hc) => edge(i, j, W, Hc) === 1 ? 1 : 0, 2) });   // the clean mat
    w(18.98, 15.55, 0.84, 0.96, 0.27, 0.13, M.whitewash, top('base', ['stencil'], (i, j) => i % 7 === 6 ? 0 : j % 4 === 1 ? 1 : 0)); w(18.98, 15.55, 0.96, 1.08, 0.17, 0.11, M.whitewash); w(18.98, 15.55, 1.08, 1.2, 0.08, 0.08, M.whitewash);   // a pyramid of formula tins on the window cabinet
    named('pharmacy', 'wheelchair', K.prop('chair', 22.815, 15.57, 0, 14, [part(0, 0.46, 0.5, 0, 0.14, 0.2, 'plasticBlack'), part(0, 0.5, 0.92, 0.2, 0.14, 0.015, 'plasticBlack'), part(-0.16, 0, 0.56, 0.03, 0.02, 0.26, 'rubber'), part(0.16, 0, 0.56, 0.03, 0.02, 0.26, 'rubber'), part(0, 0.1, 0.13, -0.25, 0.13, 0.05, 'galv')]));

    // THE DISPENSARY (treatment room): a cot under a white sheet with its drip stand, the vaccine fridge, a basin on the trunk — white on grey felt
    grp('lived.dispensary');
    for (const z of [9.45, 11.05]) w(21.0, z, 0, 0.4, 0.34, 0.02, M.galv);
    w(21.0, 10.25, 0.4, 0.48, 0.35, 0.95, M.whitewash); w(21.0, 10.97, 0.48, 0.55, 0.2, 0.14, M.plasticWhite); w(21.0, 9.57, 0.48, 0.54, 0.3, 0.2, M.blanketGrey, top('coarse', [0.6], (i, j) => j % 3 === 1 ? 1 : 0));
    w(20.48, 11.0, 0, 0.04, 0.1, 0.08, M.galv); w(20.48, 11.0, 0.04, 1.7, 0.012, 0.012, M.galv); w(20.48, 10.98, 1.42, 1.66, 0.05, 0.02, M.plasticWhite);             // the drip stand at the cot's head, between cot and rack
    w(21.0, 10.25, 0.012, 0.02, 0.6, 1.2, M.plasticGreen, { flags: D, ...top('coarse', ['plasticWhite'], (i, j, W, Hc) => edge(i, j, W, Hc) >= 1 ? 1 : 0) });   // the pharmacy's clean mat, small, under the cot
    w(18.95, 8.4, 0, 1.5, 0.25, 0.26, M.plasticWhite, top('coarse', [0.8], (i, j, W, Hc) => edge(i, j, W, Hc) === 1 ? 1 : 0));   // the vaccine fridge
    w(21.1, 11.55, 0.4, 0.5, 0.13, 0.13, M.whitewash, top('coarse', [0.6], fill));
    G.rug(22.35, 10.1, 1.2, 1.6, 'felt');
    named('dispensary', 'stool', K.prop('chair', 21.8, 10.5, 0.2, 2.5, [part(0, 0.4, 0.44, 0, 0.15, 0.15, 'plasticWhite'), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(a * 0.12, 0, 0.4, b * 0.12, 0.02, 0.02, 'galv'))]));
    bucket('dispensary', 'bucket', 20.47, 11.6, 'galv', 'damp');

    // THE MONEY CHANGER'S (exchange): a teller's grille on the counter, bricks of notes in four colours, the counting machine, the day's rates on the wall
    grp('lived.hawala');
    w(28.5, 13.57, 0.75, 1.1, 1.1, 0.01, M.iron, { flags: D, ...side('+z', [], () => 0) });
    w(27.96, 13.3, 0.75, 0.83, 0.15, 0.12, M.prodGreen); w(27.98, 13.3, 0.83, 0.91, 0.15, 0.12, M.prodYellow, {}, 0.3); w(28.32, 13.3, 0.75, 0.83, 0.15, 0.12, M.prodRed, {}, -0.2); w(28.68, 13.3, 0.75, 0.83, 0.15, 0.12, M.plasticBlue, {}, 0.1);   // bricks of notes, a colour a currency
    w(29.0, 13.28, 0.75, 0.93, 0.12, 0.1, M.plasticWhite, top('base', ['plasticBlack'], (i, j, W, Hc) => j > Hc / 2 && edge(i, j, W, Hc) >= 1 ? 1 : 0));               // the counting machine
    w(27.72, 13.2, 0.75, 0.98, 0.04, 0.04, M.drumRed);                                                    // his thermos
    w(29.874, 14.5, 1.2, 2.0, 0.004, 0.6, M.plasticBlack, { flags: D, ...side('-x', ['whitewash', 'prodYellow'], (i, j, W, Hc) => j === Hc - 2 ? (i > 1 && i < W - 2 ? 2 : 0) : j % 3 !== 1 ? 0 : i >= 2 && i < 8 ? 1 : (i >= 11 && i < 15) || (i >= 17 && i < 22) ? 2 : 0) });   // THE RATE BOARD
    w(29.55, 14.35, 0, 0.45, 0.25, 0.3, M.paintBlue, top('coarse', [0.5, 'stencil'], (i, j, W, Hc) => i === 2 || i === W - 3 ? 1 : Math.abs(i - (W - 1) / 2) < 1 && j < 2 ? 2 : 0));   // the strongbox
    named('hawala', 'chair_a', G.plasticChair(28.1, 14.3, 0, 'plasticBlue')); named('hawala', 'chair_b', G.plasticChair(28.85, 14.36, 0.15, 'plasticBlue'));

    // THE OFFICE (the landlord's ledgers): a low shelf of ledgers the length of the north wall, every shop's key on a board over it, coin sacks by the safe
    grp('lived.office');
    const spines: Cell = (i, j, W, Hc) => j < 1 || j >= Hc - 1 ? 0 : 1 + ((i >> 1) + (h01(i >> 1, 0, 9) > 0.7 ? 1 : 0)) % 3;
    w(26.6, 8.3, 0, 0.9, 1.2, 0.16, M.poplar, G.mk([...G.face('+y', 'coarse', [pal('drumRed'), pal('plasticGreen'), pal('plasticBlack')], spines, 0, 2), ...G.face('+z', 'coarse', [pal('drumRed'), pal('plasticGreen'), pal('plasticBlack')], (i, j, W, Hc) => j % 9 === 0 ? 0 : spines(i, 1, W, 3), 0, 2)]));
    w(25.9, 8.3, 0.9, 0.96, 0.2, 0.12, M.paintGreen, {}, 0.2); w(27.2, 8.32, 0.9, 0.95, 0.18, 0.12, M.drumRed, {}, -0.15);
    w(26.6, 8.126, 1.2, 1.75, 0.6, 0.004, M.poplar, { flags: D, ...side('+z', ['iron', 'stencil'], (i, j) => { const u = i % 4, v = j % 6; return u !== 2 ? 0 : v === 5 ? 1 : (v === 3 || v === 4) && h01(i, j - v, 3) > 0.25 ? 2 : 0; }) });   // THE KEY BOARD
    w(28.07, 8.42, 0, 0.34, 0.2, 0.2, M.sack, top('coarse', ['blanketBrown'], disc(0.2))); w(28.05, 8.4, 0.34, 0.56, 0.14, 0.14, M.sack, top('coarse', ['blanketBrown'], disc(0.25)), 0.5);   // tied sacks of coin
    w(27.86, 11.16, 0.75, 0.8, 0.09, 0.07, M.plasticBlack); w(27.86, 11.16, 0.8, 0.83, 0.11, 0.025, M.plasticBlack, {}, 0.2);                                       // the telephone
    w(28.2, 11.24, 0.752, 0.76, 0.18, 0.12, M.whitewash, { flags: D, ...top('base', [0.5], (i, j, W) => j % 2 === 1 && i > 0 && i < W - 1 && i !== W / 2 ? 1 : 0) });   // the rent book
    w(28.5, 11.1, 0.75, 0.8, 0.07, 0.05, M.paintBlue, top('base', ['plasticGreen', 'stencil'], (i, j, W, Hc) => edge(i, j, W, Hc) === 0 ? 0 : i < W / 2 ? 1 : 2));   // the cash tin, open
    named('office', 'bin', bucket('office', 'bin', 29.28, 11.74, 'plasticBlack', 'whitewash'));
    carton('office', 'files', 25.19, 8.4, 0.34, 0.1);

    // THE GARAGE (mechanic): an engine block on a pallet, a creeper out from under the pickup with a fan of tools, the welding trolley, exhaust pipes, tyre marks
    grp('lived.garage');
    w(35.63, 10.3, 0, 0.12, 0.25, 0.4, M.poplar); w(35.64, 10.3, 0.12, 0.6, 0.2, 0.3, M.iron, top('coarse', ['plasticBlack', 'galv'], (i, j, W, Hc) => j % 3 === 1 && i > 1 && i < W - 2 ? 1 : edge(i, j, W, Hc) === 0 ? 0 : 2)); w(35.64, 9.95, 0.2, 0.5, 0.14, 0.03, M.galv);   // the engine: four bores, the fan
    w(34.3, 12.0, 0.03, 0.09, 0.22, 0.5, M.ply); w(34.3, 11.58, 0.09, 0.14, 0.14, 0.08, M.plasticBlack);                                                           // the creeper
    w(34.72, 11.85, 0.01, 0.016, 0.22, 0.3, M.slab, { flags: D, ...top('coarse', ['galv', 'drumRed'], (i, j, W) => j % 2 === 0 && i > 0 && i < W - 1 - (j >> 1) % 3 ? (i < 3 ? 2 : 1) : 0) });   // tools laid out beside it
    w(35.45, 14.35, 0, 0.14, 0.22, 0.25, M.iron); w(35.36, 14.35, 0.14, 1.1, 0.085, 0.085, M.drumBlue); w(35.56, 14.35, 0.14, 0.98, 0.085, 0.085, M.drumRed); w(35.45, 14.62, 0.14, 0.9, 0.2, 0.015, M.iron);   // the welding trolley, two bottles
    w(35.8, 11.6, 0, 0.08, 0.04, 0.6, M.tin);                                                                        // exhaust pipes along the wall
    for (const x of [32.42, 33.98]) w(x, 15.5, 0.01, 0.016, 0.1, 0.36, M.rubber, { flags: D });                                                                    // tyre marks in from the roller door
    G.patch(34.95, 14.45, 1.1, 1.3, 'oil', 0.1);                                                                                                                 // the floor under the welding
    named('garage', 'oilcan', G.jerryCan(34.25, 15.55, 0.3, 'olive'));
    named('garage', 'drainpan', K.prop('bin', 34.72, 15.52, 0, 4, [part(0, 0, 0.1, 0, 0.2, 0.2, 'iron'), part(0, 0.1, 0.11, 0, 0.17, 0.17, 'plasticBlack')]));

    // THE GENERATOR ROOM: a cable to each shop in that shop's own paint, fanned across the floor from the breaker (the money changer's twice as thick), oil tins, soot
    grp('lived.generator');
    ([['paintRust', 7.22, 0.012], ['paintBlue', 7.36, 0.012], ['paintGreen', 7.5, 0.012], ['paintCream', 7.66, 0.025]] as [Mt, number, number][]).forEach(([m, z, t], k) => w(35.0 - k * 0.08, z, 0.012, 0.024, 0.78 - k * 0.08, t, M[m], { flags: D }, 0.05 * (k - 1.5)));
    w(35.79, 5.8, 0, 0.9, 0.09, 0.35, M.woodGrey); w(35.79, 5.6, 0.9, 1.1, 0.08, 0.07, M.olive); w(35.79, 5.95, 0.9, 1.06, 0.08, 0.1, M.jerryYellow);            // the shelf of oil tins
    w(34.55, 5.62, 0, 0.05, 0.3, 0.16, M.iron, top('coarse', ['plasticBlack'], fill));                                                                             // the drip tray
    w(34.9, 4.126, 1.3, 1.8, 0.3, 0.004, M.genYellow, { flags: D, ...side('+z', ['plasticBlack'], (i, j, W, Hc) => edge(i, j, W, Hc) === 0 || (j >= 5 && j <= 8 && i === 11 - j) || (j === 5 && i >= 5 && i <= 7) || (j >= 1 && j <= 4 && i === 9 - j) ? 1 : 0) });   // the danger board
    w(35.45, 5.62, 0.018, 0.024, 0.25, 0.18, M.rubber, { flags: D }, 0.2);                                                                                         // exhaust soot
    named('generator', 'sandbucket', bucket('generator', 'sandbucket', 35.7, 7.62, 'drumRed', 'sack'));

    // THE PASSAGE (cut-through): a chosen emptiness. Cloths on a line overhead, a gutter to the standpipe, its bucket and broom, a chalk game
    grp('lived.passage');
    G.washLine(16.14, 10.0, 17.86, 10.0, 3, false);
    w(16.3, 9.7, 0.012, 0.018, 0.07, 1.3, M.damp, { flags: D });
    w(16.3, 11.74, 0, 0.17, 0.11, 0.11, M.tin, top('coarse', ['damp'], fill)); w(16.2, 11.1, 0, 1.15, 0.015, 0.015, M.woodGrey); w(16.2, 11.1, 0, 0.16, 0.03, 0.12, M.straw);   // bucket and broom
    w(17.78, 8.8, 0, 0.9, 0.1, 0.45, M.ply, side('-x', [0.6], (i, j, W) => i === Math.floor(W / 2) || j % 6 === 5 ? 1 : 0));                                       // flattened cartons against the wall
    w(17.05, 9.6, 0.009, 0.013, 0.45, 1.0, M.dirt, { flags: D, ...top('coarse', ['whitewash'], (i, j) => { const k = Math.floor(j / 6), v = j % 6; if (k > 5) return 0; const sq = (a: number, b: number) => i >= a && i <= b && (i === a || i === b || v === 0 || v === 5); return k % 2 ? (sq(3, 8) || sq(9, 14) ? 1 : 0) : sq(6, 11) ? 1 : 0; }, 2) });   // a chalk game

    // THE ALLEY (back doors): what each shop throws out names the shop
    grp('lived.alley');
    w(11.2, 5.2, 2.1, 2.13, 0.9, 0.02, M.poplar, { flags: D }, 0.12);                            // the oven: a bread peel up on the lean-to…
    w(8.42, 4.44, 0, 0.45, 0.32, 0.22, M.poplar, top('coarse', ['sack'], (i, j, W, Hc) => edge(i, j, W, Hc) >= 1 && (i % 4 !== 0) ? 1 : 0));                         // …the dough trough…
    w(7.5, 4.46, 0, 0.5, 0.5, 0.2, M.poplar, top('coarse', ['straw', 'rugCream', 'rugRed'], (i, j, W, Hc) => i < W * 0.35 ? (i === 0 || j === 0 || j === Hc - 1 ? 3 : 2) : (i - Math.ceil(W * 0.35)) % 3 !== 2 && j >= 1 && j < Hc - 1 ? 1 : 0, 2));   // …three long naan on a board, the cloth pulled half off them…
    G.patch(8.35, 5.3, 1.7, 0.9, 'sack', 0.1);                                                                                                                     // …and spilt flour
    w(4.5, 7.5, 0, 0.1, 0.22, 0.18, M.blanketGrey, {}, 0.4); G.patch(4.78, 7.3, 1.2, 0.9, 'blanketGrey', 0.15, 0.02);                                              // the tea house: the samovar's ash…
    const caps: Cell = (i, j, W, Hc) => edge(i, j, W, Hc) >= 1 && i % 2 === 1 && j % 2 === 1 ? 1 + (i + j) % 4 % 3 : 0;
    w(5.6, 4.45, 0, 0.3, 0.3, 0.2, M.drumRed, top('coarse', ['prodGreen', 'prodOrange', 'tin'], caps)); w(6.4, 4.47, 0, 0.3, 0.3, 0.2, M.drumBlue, top('coarse', ['prodGreen', 'prodOrange', 'tin'], caps), 0.08);   // …and its bottle crates
    w(15.0, 4.36, 0, 0.14, 0.2, 0.12, M.plasticWhite, { flags: D }, 0.3);                                         // the phone shop: packing foam by the pallets
    w(18.5, 7.58, 0, 0.09, 0.3, 0.22, M.whitewash, top('coarse', ['plasticGreen'], (i, j, W) => i < 2 || i >= W - 2 ? 1 : 0)); w(18.48, 7.6, 0.09, 0.17, 0.24, 0.18, M.whitewash, top('coarse', ['plasticGreen'], (i, j, W, Hc) => { const a = Math.abs(i - (W - 1) / 2), b = Math.abs(j - (Hc - 1) / 2); return (a < 1 && b < 3) || (b < 1 && a < 3) ? 1 : 0; }), 0.25);   // the pharmacy: green-flashed cartons
    rnd(28.7, 7.5, 0, 0.8, 0.27, 'rust', top('coarse', ['plasticBlack'], disc(0.4)));                                                                               // the money changer: a burn barrel under his window (cold)…
    w(28.15, 7.3, 0.012, 0.018, 0.14, 0.1, M.rugCream, { flags: D, ...top('base', ['plasticBlack'], (i, j, W) => i > W * 0.55 ? 1 : 0) }, 0.5);   // …and half-burnt ledger pages
    w(31.0, 7.52, 0, 0.17, 0.3, 0.18, M.rust, top('coarse', ['galv', 'iron'], (i, j) => h01(i, j, 7) > 0.6 ? 1 + (i + j) % 2 : 0), 0.3);                                                          // the garage: scrap by the rust drum

    // THE STREET: every seller his own trade. The kiosks' lids are their stores (decals: nothing up there touches a walk, a sight line or a shadow)
    grp('lived.coppersmith');   // the green kiosk
    const pan = (x: number, z: number, r: number, a: Mt, b: Mt) => w(x, z, 2.462, 2.56, r, r, M.tin, { flags: D, ...top('coarse', [a, b], (i, j, W, Hc) => { const d = Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2); return d < W * 0.3 ? 2 : d < W * 0.5 ? 1 : 0; }) });
    pan(10.62, 16.72, 0.4, 'rugOchre', 'plasticBlack'); pan(11.42, 16.6, 0.3, 'plasticBlack', 'rugOchre'); pan(11.36, 17.3, 0.25, 'rugOchre', 'rust');
    w(11.0, 18.25, 2.462, 2.56, 0.7, 0.05, M.iron, { flags: D });                                   // stovepipes
    w(10.194, 17.9, 1.2, 1.8, 0.004, 0.4, M.paintGreen, { flags: D, ...side('-x', ['rugOchre'], (i, j, W, Hc) => i % 4 === 1 && j > 2 ? (j < 5 ? (i % 4 <= 2 ? 1 : 0) : 1) : i % 4 === 2 && j > 2 && j < 5 ? 1 : 0) });   // ladles on its west face
    rnd(12.12, 18.1, 0, 0.1, 0.27, 'rugOchre', top('base', ['rust', 'plasticBlack'], (i, j, W, Hc) => { const d = Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2); return d < W * 0.22 ? 2 : d < W * 0.36 ? 1 : 0; }));   // his widest pan on the ground at the kiosk's corner, a smaller one in it
    grp('lived.carpets');       // the cream kiosk
    w(22.95, 17.1, 2.462, 2.474, 0.7, 0.85, M.rugRed, { flags: D, ...top('coarse', ['rugNavy', 'rugCream'], (i, j, W, Hc) => { const e = edge(i, j, W, Hc); return e === 0 || e === 2 ? 1 : e === 1 ? 2 : e < 5 ? 0 : (i % 8 < 2 && j % 8 < 2) ? 2 : ((i + 4) % 8 < 2 && (j + 4) % 8 < 2) ? 1 : 0; }, 2) });   // a rug over the lid
    ([['rugRed', 18.16], ['rugOchre', 18.4]] as [Mt, number][]).forEach(([m, z], k) => w(22.95 + (k % 2) * 0.06, z, 2.462, 2.58, 0.6, 0.06, M[m], { flags: D }));   // two rolls
    w(21.82, 17.5, 0.012, 0.022, 0.26, 0.8, M.rugNavy, { flags: D, ...top('coarse', ['rugCream', 'rugOchre'], (i, j, W, Hc) => { const e = edge(i, j, W, Hc); return e === 1 ? 1 : e >= 2 && (i + j) % 4 === 0 ? 2 : 0; }, 2) }); w(21.82, 16.62, 0, 0.14, 0.27, 0.07, M.rugNavy);   // a navy rug half unrolled on the ground beside it, its roll at the wall end
    grp('lived.butcher');       // the rust kiosk, on its west side
    w(30.06, 17.1, 1.86, 1.9, 0.02, 0.8, M.iron, { flags: D }); w(30.04, 17.5, 1.25, 1.86, 0.03, 0.14, M.prodRed, { flags: D });                                     // the hook rail, flat to the kiosk; a side hanging
    rnd(29.76, 17.0, 0, 0.6, 0.22, 'poplar', top('coarse', ['rugMadder'], disc(0.4))); w(29.8, 16.98, 0.6, 0.63, 0.1, 0.03, M.galv, {}, 0.6);                       // the block and the cleaver
    w(29.76, 16.45, 0, 0.1, 0.2, 0.15, M.plasticWhite, top('coarse', ['prodRed'], fill));                                                                           // an enamel tray
    G.patch(29.6, 17.3, 0.9, 1.5, 'rugMadder', 0.1);
    grp('lived.spices');        // the blue stall
    (['rugOchre', 'prodRed', 'prodGreen', 'rugCream'] as Mt[]).forEach((m, k) => { w(8.78, 19.84 + k * 0.3, 0, 0.4, 0.15, 0.15, M.sack); w(8.78, 19.84 + k * 0.3, 0.4, 0.46, 0.12, 0.12, M[m]); });
    w(8.6, 20.2, 1.45, 1.5, 0.012, 0.2, M.tin, { flags: D });                                                                                                      // the hanging balance
    grp('lived.juice');         // the handcart
    w(29.04, 21.35, 0.71, 0.85, 0.25, 0.4, M.prodOrange, top('base', [0.7], (i, j) => (i % 3 === 2) || (j % 3 === 2) ? 1 : 0));                                       // the oranges, heaped over the cart's west end
    w(30.16, 21.35, 0.71, 1.05, 0.08, 0.08, M.iron); w(30.16, 21.35, 1.0, 1.03, 0.03, 0.22, M.galv, {}, 0.5);                                                       // the press
    w(29.55, 21.36, 0.71, 0.8, 0.16, 0.03, M.whitewash, top('base', [0.3], (i) => i % 4 === 3 ? 1 : 0));                                                            // a row of glasses
    named('juice', 'peels', bucket('juice', 'peels', 30.72, 21.52, 'plasticBlue', 'prodOrange'));
    grp('lived.gas');           // the tarped cart: the gas seller's bottles at its tail
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) w(31.14 + a * 0.3, 21.1 + c * 0.31, 0, 0.55, 0.13, 0.13, M[(a + c) % 2 ? 'drumBlue' : 'drumRed'], top('coarse', ['iron'], disc(0.25)));
    grp('lived.cobbler');       // a pitch against the tea house's front, west of its door
    w(4.45, 16.5, 0, 0.17, 0.2, 0.15, M.ply); w(4.86, 16.56, 0, 0.13, 0.04, 0.04, M.iron); w(4.86, 16.56, 0.13, 0.17, 0.045, 0.12, M.drumRed);                         // his box, the last, the red shoe on it
    shoes(5.0, 16.34, 'plasticBlack', 0.1); shoes(5.1, 16.62, 'coyote', -0.15);
    w(4.7, 16.44, 0.012, 0.02, 0.55, 0.3, M.rugCream, { flags: D });                                                                                               // the cloth his pitch is laid out on
    grp('lived.lorry');         // the driver's bedroll on the ground ahead of the cab, his kettle at its end
    w(20.65, 20.9, 0.012, 0.05, 0.3, 0.8, M.rugOchre, { flags: D }, 0.08); w(20.2, 21.5, 0, 0.1, 0.08, 0.08, M.plasticBlack);
  }

  const [vs, vp, vt] = VARIANT ?? [0, 0, 0];
  const spot = quiet.spots[vs], exit0 = quiet.exits[0];
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs, devices, civilians,
    breaker: { pos: [35.6, 1.35, 6.9], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [...quiet.starts[vt].sam] as Vec3,
    routes: VARIANT ? routes.filter(r => SETS[vp].includes(r.name)) : routes,
    chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    // the plain solo night's three places: the first spot and the east gate (the base engine's way out is 'east of exfilX')
    mission: { serverRoom: { ...spot.area }, entryDoor: spot.door, rack: { index: spot.rackIndex, front: [...spot.front] as Vec3, halfW: spot.halfW }, exfilDoor: exit0.door, exfilX: exit0.x + 0.6, exfilZ: exit0.z },
  };
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 22 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'teahouse', mat: 'carpet', x0: 4, z0: 12, x1: 10, z1: 16 },
      { id: 'kitchen', mat: 'tile', x0: 4, z0: 8, x1: 10, z1: 12 },
      { id: 'phoneshop', mat: 'lino', x0: 10, z0: 8, x1: 16, z1: 16 },
      { id: 'pharmacy', mat: 'tile', x0: 18, z0: 8, x1: 24, z1: 16 },
      { id: 'hawala', mat: 'carpet', x0: 24, z0: 8, x1: 30, z1: 16 },
      { id: 'garage', mat: 'stone', x0: 30, z0: 8, x1: 36, z1: 16 },
      { id: 'generator', mat: 'stone', x0: 32.5, z0: 4, x1: 36, z1: 8 },
    ],
  };
  // the level's own names for the floor no spot is in (scenarios.places: a radio line, a checkpoint row and the debrief say WHERE by these — rooms first, a
  // doorway between two is the first listed)
  const places = { areas: [
    { name: 'tea house', bounds: { x0: 4.06, x1: 9.94, z0: 12.06, z1: 15.88 } }, { name: 'kitchen', bounds: { x0: 4.06, x1: 9.94, z0: 8.12, z1: 11.94 } },
    { name: 'workshop', bounds: { x0: 10.06, x1: 15.88, z0: 8.12, z1: 11.94 } }, { name: 'pharmacy', bounds: { x0: 18.12, x1: 23.94, z0: 12.06, z1: 15.88 } },
    { name: "dispensary", bounds: { x0: 18.12, x1: 23.94, z0: 8.12, z1: 11.94 } }, { name: "money changer's", bounds: { x0: 24.06, x1: 29.88, z0: 12.06, z1: 15.88 } },
    { name: 'generator room', bounds: { x0: 32.62, x1: 35.88, z0: 4.12, z1: 7.88 } }, { name: 'passage', bounds: { x0: 16.12, x1: 17.88, z0: 8.12, z1: 15.88 } },
    { name: 'bread oven', bounds: { x0: 8.6, x1: 13.4, z0: 4.12, z1: 7.88 } }, { name: 'lorry', bounds: { x0: 13.6, x1: 20.4, z0: 18.6, z1: 21.88 } },
    { name: 'alley', bounds: { x0: 4.12, x1: 32.4, z0: 4.12, z1: 7.88 } }, { name: 'street', bounds: { x0: 4.12, x1: 35.88, z0: 16.12, z1: 21.88 } },
  ] };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the south gate from the lane outside it (the third start's side), the
  // street's stalls and awnings over the wall behind the man.
  const kitView = { ways: [{ door: 'gate_s', ref: [22.4, 25.4], side: -1 }] };
  // WHO COMES WHEN THE STREET GOES LOUD (scenarios.response — game/qrf.ts, tools/qa/response-check.ts): the town is under curfew and a patrol is never far.
  // It walks in by the street's open end or by a gate; every mark is out past the row or a stride inside it (Character yaws: forward = [sin, 0, cos]).
  const response: ResponseData = {
    why: 'A market street in a town under curfew: the only armed men out at night are the patrol, and gunfire in the bazaar is the one thing they are out for.',
    site: 'the bazaar', at: 'in the bazaar', team: 'the curfew patrol', tag: 'PATROL',
    men: [2, 4], eta: [40, 80],
    ways: [
      { name: 'the open end of the street', coming: 'coming up the street from its open end', clear: 'nobody on the street past the tea house',
        muster: [[1.2, 0, 17.2], [1.2, 0, 18.4], [2.4, 0, 17.2], [2.4, 0, 18.4]],
        entry: [[6.6, 0, 17.8], [5.6, 0, 16.9], [5.6, 0, 18.6], [4.6, 0, 17.8]], entryFace: [Math.PI / 2, Math.PI / 2 + 0.7, Math.PI / 2 - 0.7, Math.PI / 2] },
      { name: 'the street gate', door: 'gate_e', coming: 'coming in by the street gate', clear: 'nobody on the street past the garage',
        muster: [[37.2, 0, 18.2], [37.2, 0, 19.3], [38.2, 0, 18.2], [38.2, 0, 19.3]],
        entry: [[33.6, 0, 18.6], [34.4, 0, 17.6], [34.4, 0, 19.4], [35.0, 0, 18.6]], entryFace: [-Math.PI / 2, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7, -Math.PI / 2] },
      { name: 'the lane gate', door: 'gate_s', coming: 'coming in by the lane gate', clear: 'nobody behind the lorry',
        muster: [[21.7, 0, 23.0], [22.8, 0, 23.0], [21.7, 0, 24.0], [22.8, 0, 24.0]],
        entry: [[22.2, 0, 19.6], [23.2, 0, 20.2], [21.2, 0, 20.2], [22.2, 0, 20.9]], entryFace: [Math.PI, Math.PI - 0.8, Math.PI + 0.8, Math.PI] },
    ],
    posts: [
      { name: 'outside the alley gate', pos: [20.25, 0, 2.6], yaw: 0, sweep: [[20.25, 1, 5.0], [14.0, 1, 2.6]] },
      { name: 'the open end of the street', pos: [2.0, 0, 18.0], yaw: Math.PI / 2, sweep: [[8.0, 1, 18.0], [2.6, 1, 8.0]] },
    ],
    outside: [[38.8, 0, 1.2], [38.8, 0, 2.3]],
  };
  return { level, ...(!VARIANT ? { scenarios: { quiet, places, response, kitView } as unknown as LevelScenarios } : {}), groups: trace.groups, surfaces, quiet };   // (a one-deal scratch file carries no block: its routes are one set's)
}
