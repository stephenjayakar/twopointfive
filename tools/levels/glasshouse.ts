// THE GLASSHOUSE — one idea: GLASS IS NOT COVER (levels/glasshouse.json ← bun run tools/levels/export.ts glasshouse). A district seed station at night: one
// whitewashed block building whose whole front is glazed (the glasshouse, a long room of seedling benches behind six tall panes, 0.3 m off the ground to
// 2.4) and whose inside walls between the glasshouse, the lab and the office are glass from 0.5 m to 2.4. Seven men. The forecourt is floodlit off the eaves
// and the glazed rooms are dark, so whoever walks onto the forecourt is seen from three rooms at once by men he cannot see, and their rounds come through
// the panes (game/glasspen.ts; a pane is a toll, not a wall). The other three sides are blank block wall. The store, on the back, is the one room with no
// glass in any wall; it has its own door on the dark back lot, and a row of seed racks stands between that room and its door to the lab.
// TWO WAYS IN (scenarios.roomClear.team / starts[0]), BOTH IN THE DARK AND OUT OF EVERY DEFENDER MARK'S SIGHT: the side of the building, round the corner
// from the glass (stepping onto the lit forecourt in front of the panes is the player's own decision); or the back lot, on the back door.
//
//        x 10          18          24          30
//   z 3        team, way 2 (x 14)          the back lot: dark, a blank wall
//   z 8  +======back=R===+===========+===========+
//        | B        R  store         g           |      B = the breaker, inside the store      g = glass, 0.5 m to 2.4
//        |  STORE   R    |    LAB    g  OFFICE   |      R = the seed racks (floor to beams): they run from the back wall to 1.4 m short of the wall
//        |          R    |        office         |          the glasshouse is behind, so the way round them is at the far end from both store doors
//   z 13 +----------.----+---ggg--lab--+--ggggg--+      team, way 1 (x 33, z 13 to 16): the dark side of the building
//        |   benches        GLASSHOUSE     benches  |
//   z 18 +==GGGGGGGGGGG==#=front=#==GGGGGGGGGGG==+  T   G = the glazed front, six panes · # = 1.8 m of block either side of the front door · T = the water tank
//          * lamp        the forecourt (lit)   * lamp
//
// Built from the 2010s kit (src/scene/gwotKit.ts) on the office kit's walls and panes: flat colours, boxes only; no second look file.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, type GwotOpening } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'glasshouse';
export const NOTES = 'The glasshouse: a seed station whose front and inside partitions are glass, seven men in four rooms, a blank back wall with the back door into the store. The forecourt is floodlit, the glazed rooms dark. Two ways in, both from the dark and out of sight: the side of the building round the corner from the glass, and the back lot. Regenerate: bun run tools/levels/export.ts glasshouse';
/** the kit's palette goes into the file's `materials` (tools/levels/export.ts) */
export const MATERIALS = GWOT_MATERIALS;

const HALF = Math.PI / 2;
// the rooms' floors inside their walls
const HOUSE: Rect = { x0: 10.12, x1: 29.88, z0: 13.06, z1: 17.88 }, STORE: Rect = { x0: 10.12, x1: 17.94, z0: 8.12, z1: 12.94 };
const LAB: Rect = { x0: 18.06, x1: 23.94, z0: 8.12, z1: 12.94 }, OFFICE: Rect = { x0: 24.06, x1: 29.88, z0: 8.12, z1: 12.94 };
export const GLASSHOUSE_ROOMS = { glasshouse: { name: 'glasshouse', bounds: HOUSE }, lab: { name: 'lab', bounds: LAB }, office: { name: 'office', bounds: OFFICE }, store: { name: 'store', bounds: STORE } } as const;
/** WAY 1: the side of the building, round the corner from the glazed front: outside the lamps' cones and behind blank wall from every mark (the check holds
 *  both). WAY 2: the back lot, on the back door. */
export const GLASSHOUSE_FRONT: Vec3 = [33.0, 0, 15.5], GLASSHOUSE_BACK: Vec3 = [14, 0, 3.4];
// chest-high points the marks' guns rest on: the forecourt through the front panes (one bank, the other), and the doors' inner faces, each on the middle of
// its doorway AS HUNG (the kit fits a 0.9 m doorway inside the 1.2 m slot drawn below: the exported file's hinge + half its width). THE STORE'S DOOR TO THE
// LAB IS AT THE BACK-WALL END OF ITS WALL, never the glasshouse end: the camera looks down from the front of the building, and a door within about 1.9 m
// behind a full-height wall that runs across its view is never drawn — no cursor finds it (tools/qa/doormenu-probes.ts 'the cursor on a door as drawn')
const LOT_W: Vec3 = [15.2, 1.1, 22.0], LOT_E: Vec3 = [24.8, 1.1, 22.0], LOT_LAB: Vec3 = [14.0, 1.1, 22.0], FRONT_IN: Vec3 = [20.25, 1.1, 17.8];
const LAB_S: Vec3 = [22.75, 1.1, 13.1], LAB_N: Vec3 = [22.75, 1.1, 12.9], STORE_E: Vec3 = [18.1, 1.1, 8.75];
const OFFICE_E: Vec3 = [24.1, 1.1, 11.25], BACK_IN: Vec3 = [14.25, 1.1, 8.2], RACK_END: Vec3 = [15.85, 1.1, 12.2];

/** THE ROOM CLEAR (scene/scenarios.ts StructureData). Seven men: glasshouse 3, lab 2, office 1, store 1.
 *  THE HAND PLACEMENT (roomclear.ts placeDefenders: seed 0 / attempt 1 = each room's first `garrison` marks IN FILE ORDER; the page deals it on every try).
 *  The problem, in one sentence: men in the dark watch a floodlit forecourt through glass that stops no round.
 *  (The answers: come in through a wall that is not glass — the back door, or a hole of your own in the blank end wall — or put the light out.)
 *  · THE FORECOURT (the obvious plan: the short walk along the lit panes to the front door) is under four guns in three rooms from the first pane on:
 *    glasshouse 1 at the end by the side yard and glasshouse 2 at the far end, each through its own bank (a crossfire down the forecourt's length); lab 1 and
 *    office 1 at their own glass, through two panes each. All four stand in the dark; the forecourt is floodlit. What says so before contact: the lamps.
 *  · THEIR BACK (answer A: the back door into the store, the one room with no glass) costs too: the store's man stands under the store's own bulb, a fair
 *    first kill from the dark back lot, but the squad then stands in that light — the breaker is on the wall by the back door: the lamps' conduit runs round the
 *    building to a meter box outside it, and the store's vent shows the bulb — and the store's door into the lab is under two guns on two lines: lab 2 from the
 *    far side of the lab, glasshouse 3 through the lab's pane (Front's rear man, looking into the lab). A spare office mark has a third line through its pane.
 *  · THE BLANK END WALL (answer B: the wall charge the mission issues, `wallCharges`, from the side yard where way 1 starts) opens the glasshouse at its end:
 *    glasshouse 1 stands three metres inside it (stunned by the charge, not floored), and the fight is down the room's length against glasshouse 2 and 3, with
 *    the Back squad free to come round.
 *  SQUADS: Front (the glasshouse) stays at its glass, whatever is hit: with one pool every contact in the store drew all seven through the store's door into
 *  the racks, and every plan that began at the back door was one and the same fight (12 seeds, hard: 46 of 48 teammates up from way 1). Back (lab, office,
 *  store) is free: what it does is the AI's call. */
export const GLASSHOUSE_STRUCTURE: StructureData = {
  name: 'the seed station', maxMen: 7,
  wallCharges: 1,                                                                 // one hole: the blank end wall beside way 1 is the place for it (as shipped the kit's cards carry none)
  team: { sam: GLASSHOUSE_FRONT, samYaw: 0, ops: [[32.2, 0, 14.4], [33.8, 0, 14.4], [32.2, 0, 13.4], [33.8, 0, 13.4]], opsYaw: 0 },
  starts: [{ sam: GLASSHOUSE_BACK, samYaw: 0, ops: [[13, 0, 2.5], [15, 0, 2.5], [13, 0, 1.6], [15, 0, 1.6]], opsYaw: 0 }],
  rooms: [
    { id: 'glasshouse', name: 'glasshouse', bounds: HOUSE, garrison: 3,
      doors: [{ id: 'front', from: 'forecourt' }, { id: 'lab', from: 'lab' }],
      marks: [
        { pos: [27.0, 0, 14.3], watch: 'front', aimAt: LOT_E },                    // 1: the end by the side yard, through its bank of panes at the forecourt; 3 m inside the blank end wall (a charge on it stuns him: its knock-down reach is 2 m)
        { pos: [12.0, 0, 14.3], watch: 'front', aimAt: LOT_W },                    // 2: the far end, the same through the other bank
        { pos: [20.5, 0, 14.5], watch: 'lab', aimAt: STORE_E },                    // 3: their back: through the lab's pane, across the lab, on the store's door
        { pos: [16.6, 0, 13.8], watch: 'front', aimAt: FRONT_IN },                 // (spare) the back wall, on the front door
        { pos: [25.0, 0, 15.4], watch: 'lab', aimAt: LAB_S },                      // (spare) on the lab's door
      ] },
    { id: 'lab', name: 'lab', bounds: LAB, garrison: 2,
      doors: [{ id: 'lab', from: 'glasshouse' }, { id: 'store', from: 'store' }, { id: 'office', from: 'office' }],
      marks: [
        { pos: [20.6, 0, 12.2], watch: 'lab', aimAt: LOT_LAB },                    // 1: at its glass: through two panes at the forecourt
        { pos: [22.6, 0, 9.8], watch: 'store', aimAt: STORE_E },                   // 2: the far side of the room, on the store's door: a second line on it, well off glasshouse 3's through the pane
        { pos: [23.2, 0, 9.0], watch: 'lab', aimAt: LAB_N },                       // (spare) the other corner, on the glasshouse's door
        { pos: [19.5, 0, 11.4], watch: 'store', aimAt: STORE_E },                  // (spare) near the store's door, on it (it stood here first: 0.3 m off glasshouse 3's line, two guns on one line)
      ] },
    { id: 'office', name: 'office', bounds: OFFICE, garrison: 1,
      doors: [{ id: 'office', from: 'lab' }],
      marks: [
        { pos: [26.4, 0, 12.2], watch: 'office', aimAt: LOT_E },                   // 1: at its glass: through two panes at the forecourt
        { pos: [28.8, 0, 9.0], watch: 'office', aimAt: OFFICE_E },                 // (spare) the far corner, on its one door
        { pos: [27.2, 0, 9.2], watch: 'office', aimAt: STORE_E },                  // (spare) behind its desk: through the pane, across the lab, on the store's door
      ] },
    { id: 'store', name: 'store', bounds: STORE, garrison: 1,
      doors: [{ id: 'store', from: 'lab' }, { id: 'back', from: 'back lot' }],
      marks: [
        { pos: [12.0, 0, 11.8], watch: 'back', aimAt: BACK_IN },                   // 1: off the back door's line, on it, under the bulb
        { pos: [15.1, 0, 10.6], watch: 'back', aimAt: BACK_IN },                   // (spare) against the racks, on it from the other hand
        { pos: [11.0, 0, 9.5], watch: 'store', aimAt: RACK_END },                  // (spare) the far corner, on the gap at the racks' end: the way round from the lab's door
      ] },
  ],
  squads: [
    { id: 'front', name: 'Front', rooms: ['glasshouse'], rally: [20.5, 0, 14.5], barricade: ['front'], mayLeave: false },   // the three at the glass: they stay, and wedge only the door under the lamps
    { id: 'back', name: 'Back', rooms: ['lab', 'office', 'store'], rally: [19.5, 0, 11.4] },                                // the dark rooms and the store: four in three rooms. The store apart as a squad of one that stays was tried: its man, dug in behind the racks, shot 13 of 48 teammates as the last room
  ],
};
/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): both ways are the station's own walls, nothing built for
 *  the picture. WAY 1 is the hole the mission issues its one wall charge for: a span of the blank end wall over three of that wall's own columns (it is cut in 19
 *  of 0.514 m from z 8.12; the three run 13.26 to 14.80), the stack toward the forecourt — so the camera looks down the dark side yard at the lit corner, and the wedge behind
 *  the wall is the glasshouse's end: the benches of seedling trays under the panes the floodlamps shine through. The span stops there and not a column further
 *  along: the lane beside the stack would end on the water tank's plinth. WAY 2 is the back door from the back lot, the stack on the latch's side, with the
 *  store's own bulb kept burning (`keepLights`: the one lit room of the level, and what its vent shows from that lot): the seed racks stand behind that stretch
 *  of wall. */
const GLASSHOUSE_KITVIEW: KitViewData = { ways: [
  { span: [[30, 13.25], [30, 14.75]], side: 1 },
  { door: 'back', side: 1, keepLights: ['store'] },
] };
export const GLASSHOUSE_SCENARIOS: LevelScenarios = { roomClear: GLASSHOUSE_STRUCTURE, kitView: GLASSHOUSE_KITVIEW,
  places: { areas: [{ name: 'the forecourt', bounds: { x0: 6, x1: 34, z0: 18.2, z1: 24.4 } }, { name: 'the back lot', bounds: { x0: 6, x1: 34, z0: 1, z1: 7.8 } },
    { name: 'the side yard', bounds: { x0: 30.2, x1: 36, z0: 8, z1: 18.2 } }] } };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const INNER: Vec3 = [0.8, 0.87, 0.83];                                                      // clear float glass (the office kit's partition tint)
  /** the glazed front: one pane per bay, 0.3 m off the ground to 2.4 */
  const bank = (a: number, b: number): GwotOpening => ({ a, b, y0: 0.3, y1: 2.4, mullions: 3, glass: 'bay' });
  /** an inside partition's glass: 0.5 m off the floor to 2.4 */
  const screen = (a: number, b: number, bays: number): GwotOpening => ({ a, b, y0: 0.5, y1: 2.4, mullions: bays, glass: 'bay', tint: INNER });

  // ---- ground: dust to the horizon, the gravel forecourt and the track off it, packed dirt behind ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(8, 18.12, 32, 24.2, 'gravel');
  G.ground(8, 1, 32, 7.88, 'dirt');
  G.patch(20, 21.2, 3.2, 2.2, 'dust', 0.15); G.patch(13.2, 5.6, 2.4, 1.6, 'damp', -0.2); G.patch(26.4, 22.6, 1.2, 0.8, 'oil', 0.4);
  G.ruts(20, 28, 20, 24.2);
  grp('floors');
  G.ground(10, 8, 30, 18, 'slab', 0.006);
  grp('ceiling');
  slab(9.9, H, 7.9, 30.1, H + 0.2, 18.1, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });

  // ---- the building: block walls on three sides, the front glazed either side of 1.8 m of block round the front door ----
  grp('walls.shell');
  G.wallX(8, 9.88, 30.12, 'block', [{ a: 11.9, b: 12.9, y0: 2.25, y1: 2.45 }, { a: 13.4, b: 14.6 }]);   // the back: blank but for the store's door and, beside it, the store's vent: an open slit under the beams, above every eye, that shows from the back lot that a bulb burns inside
  G.wallX(18, 9.88, 30.12, 'whitewash', [bank(11.0, 17.6), { a: 19.4, b: 20.6 }, bank(22.4, 29.0)]);   // the front
  G.wallZ(10, 8.12, 17.88, 'block');
  G.wallZ(30, 8.12, 17.88, 'block');
  grp('walls.inside');
  G.partX(13, 10.12, 29.88, 'whitewash', [screen(19.6, 21.4, 1), { a: 21.9, b: 23.1 }, screen(24.8, 29.2, 2)]);   // glasshouse | store (blank), lab (glass + its door), office (glass). The lab's pane starts 1.6 m along its wall: no line from the glasshouse through it and the store's door reaches the store's own side of the racks
  G.partZ(18, 8.12, 12.94, 'whitewash', [{ a: 8.26, b: 9.46 }]);                             // store | lab: blank, the store's door at the back-wall end (where the camera sees it: the note at STORE_E)
  G.partZ(24, 8.12, 12.94, 'whitewash', [screen(8.5, 10.0, 1), { a: 10.4, b: 11.6 }]);       // lab | office: a pane and the office's door
  G.dado('x', 18, 17.6, 19.4, -1, 'paintGreen'); G.dado('x', 18, 20.6, 22.4, -1, 'paintGreen');   // the station's green, on the block round the front door (inside)
  G.skirt('x', 8, 10, 13.76, -1); G.skirt('x', 8, 14.74, 30, -1); G.skirt('z', 10, 8, 18, -1); G.skirt('z', 30, 8, 18, 1);      // the damp foot of the blank walls, outside (it stops at the back door's frame, 13.76‥14.74: a band run across a doorway reads as a slab standing in it)

  // ---- the seed racks: steel shelving stacked to the beams with sacked seed, down the store 1.9 m inside its lab door, from the back wall to 1.44 m short
  // of the wall the glasshouse is behind. KEPT, not furniture: it is why the store is blind. The lab's door is at the racks' closed end and the way round them
  // at the other, so a line through that door (standing open) and the gap would have to start beyond the lab's own back wall, and the wall the gap ends on
  // is blank. glasshouse-check asks it with every door leaf out: no mark outside the store and no floor point of the
  // lab, the office or the glasshouse (a quarter-metre grid in the lab) sees the store's own side of the racks ----
  grp('store.racks');
  for (const z0 of [8.14, 9.26, 10.38]) {
    const z1 = z0 + 1.12, zc = (z0 + z1) / 2;
    for (const z of [z0 + 0.025, z1 - 0.025]) for (const x of [15.625, 16.075]) add({ c: [x, 1.1, z], h: [0.025, 1.1, 0.025], ...G.M.rust });
    for (const [k, y] of [0.08, 0.6, 1.12, 1.64].entries()) {
      add({ c: [15.85, y, zc], h: [0.25, 0.02, 0.56], ...G.M.ply });
      add({ c: [15.85, y + 0.26, zc], h: [0.23, 0.24, 0.53], ...G.M.sack });
      if (k === 3) add({ c: [15.85, 2.18, zc], h: [0.25, 0.02, 0.56], ...G.M.ply });
    }
  }

  // ---- the forecourt and the back lot (kept things: what stands outside) ----
  grp('forecourt');
  G.pickup(11.6, 22.2, 0.08, 'truckWhite', { load: 'sacks' });
  G.waterTank(31.0, 19.4, 'plasticBlue', 1.1);
  G.blocks(26.6, 21.6, 0.1, 2); G.tyres(8.9, 19.2, 2);
  grp('backlot');
  G.rubble(27.4, 5.2, 0.9, 8, 'block'); G.drumDown(22.2, 6.6, 0.3); G.blocks(9.2, 6.4, 0.2, 3);
  G.bush(5.2, 21.4); G.bush(35.0, 20.2, 1.1); G.bush(33.6, 4.4, 0.9); G.bush(6.2, 3.8, 1.2);

  // ---- lights: two lamps on the eaves flood the forecourt, and the three glazed rooms are kept DARK behind them (the men inside watch a lit forecourt
  // through glass from the dark: with a bulb in every room the first six-seed take had the squad drop four of them through the panes from its start mark
  // inside two seconds); the blind store alone burns a bulb. All on the mains; the back lot has none ----
  grp('lights');
  G.bulb(14.0, 10.5, 'bulb_store', 'store', true);
  for (const [i, x] of [14.3, 25.7].entries()) {
    add({ c: [x, 2.95, 18.2], h: [0.03, 0.03, 0.1], ...G.M.galv });
    const head = add({ c: [x, 2.95, 18.36], h: [0.16, 0.1, 0.06], ...G.M.plasticBlack, emissive: [34, 31, 24], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, 2.92, 18.46], dir: norm([0, -0.75, 0.66]), color: [1.0, 0.92, 0.78], intensity: 220, range: 10, innerDeg: 40, outerDeg: 68,
      name: `lamp_${['a', 'b'][i]}`, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.16, broad: true });
  }
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.15, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the mains, where a man outside can follow them: a galvanised conduit from the two lamps along the front under the eaves, round the corner beside way 1,
  // along the blank end wall and the back wall, and down into the meter box on the outside of the back wall — behind which, inside, is the breaker ----
  grp('mains');
  { const R = 0.015, Y = 2.62, pipe = (c: Vec3, h: Vec3) => add({ c, h, ...G.M.galv });
    for (const x of [14.3, 25.7]) pipe([x, 2.78, 18.135], [R, 0.165, R]);                    // down from each lamp's bracket
    pipe([22.225, Y, 18.135], [7.925, R, R]);                                                 // the front
    pipe([30.135, Y, 13.0], [R, R, 5.15]);                                                    // the end wall
    pipe([20.775, Y, 7.865], [9.375, R, R]);                                                  // the back
    pipe([11.4, 2.12, 7.865], [R, 0.5, R]);                                                   // down to the meter
    add({ c: [11.4, 1.35, 7.83], h: [0.18, 0.27, 0.05], albedo: [0.42, 0.44, 0.45], name: 'meter_box' }); }

  // ---- the breaker (the store's back wall, inside) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [11.4, 1.35, 8.16], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [11.22, 1.62, 8.21], h: [0.015, 0.015, 0.01], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [21, H - 0.06, 15.5], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [21, H - 0.19, 15.5], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along an x-wall; π/2: +z along a z-wall). Every id is its room's plain name ----
  const doors: LevelDoorDef[] = [
    // ANOTHER WAY IN (tools/qa/second-way-check.ts): a man wedges only a door that opens toward him. 'back' opens OUT onto the dark back lot, 'store' into the
    // store and 'office' into the lab, so whatever the seven wedge the squad still walks back lot → store → lab → office / glasshouse opening each door by
    // hand from its own side. 'front', under the floodlights, and 'lab' stay theirs to wedge.
    { name: 'front', hinge: [19.42, 18.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'back', hinge: [13.42, 8.0], closedDir: 0, width: 1.16, exterior: true, swing: -1 },
    { name: 'lab', hinge: [21.92, 13.0], closedDir: 0, width: 1.16 },
    { name: 'store', hinge: [18.0, 8.28], closedDir: HALF, width: 1.16, swing: 1, maxAngle: 1.5 },   // hinged on the corner side: open, the leaf lies along the back wall (its stop short of it)
    { name: 'office', hinge: [24.0, 10.42], closedDir: HALF, width: 1.16, swing: 1 },
  ];
  for (const d of doors) doorFrame(d);

  // ---- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<kind><n>'; LAST, after every kept thing) ----
  // What each room is for, said by what stands in it: the GLASSHOUSE is benches of seedling trays under the front panes, compost in sacks, a hand cart and
  // the watering drums; the LAB is one long bench with a burner's gas bottle, sample crates and a stool; the OFFICE a desk on a kilim, a chair, the station's
  // tin trunk of ledgers and a wall hanging; the STORE sacks to the roof beams and crates. Nothing stands within 1.1 m of a door's line, on a
  // defender's mark or in his line, or on the place a man throws the breaker from. A bench is waist cover; the glass over it is none.
  { const spans: [number, string][] = [];
    const room = (n: string) => { spans.push([K.props.length, n]); grp(`lived.${n}`); };
    const tray = (x: number, z: number, w = 0.62, d = 0.3) => { add({ c: [x, 0.775, z], h: [w / 2, 0.025, d / 2], albedo: P.plasticBlack, rough: 0.6 }); add({ c: [x, 0.83, z], h: [w / 2 - 0.03, 0.03, d / 2 - 0.03], albedo: P.rugGreen, rough: 1 }); };
    room('glasshouse');
    for (const x of [12.2, 14.3, 16.4, 23.6, 25.7, 27.8]) { G.table(x, 17.3, 1.8, 0.8, 0, 'ply'); tray(x - 0.45, 17.2); tray(x + 0.4, 17.4); tray(x - 0.05, 17.42, 0.3, 0.26); }   // the benches under the panes
    G.sacks(10.75, 15.9, HALF, 3); G.sacks(29.25, 16.2, HALF, 2);                             // compost
    G.drums(19.6, 13.55, 2); G.handcart(13.6, 13.75, 0, 'sacks');                             // the watering drums against the back wall, the cart
    G.rug(20.0, 15.6, 2.6, 1.4, 'mat');                                                      // the green mat inside the front door
    G.jerryCan(18.5, 13.4, 0.2, 'jerryYellow');
    room('lab');
    G.table(21.3, 8.58, 1.9, 0.8, 0, 'tin');                                                  // the bench along the back wall
    add({ c: [20.8, 0.83, 8.5], h: [0.2, 0.08, 0.14], albedo: P.plasticWhite, rough: 0.5 }); add({ c: [21.6, 0.79, 8.55], h: [0.3, 0.04, 0.2], albedo: P.ply, rough: 0.9 });   // the balance, a sample board
    G.gasBottle(22.55, 8.5); G.plasticChair(21.2, 9.45, Math.PI, 'plasticGreen');
    G.crates(18.7, 12.45, 0, 2, 'coyote');                                                    // sample crates in the corner by the glasshouse's wall (the back corner is the store's door)
    room('office');
    G.rug(26.6, 10.5, 2.4, 1.7, 'kilim');
    G.table(26.4, 10.3, 1.4, 0.7, 0, 'poplar'); G.chairAs(26.4, 9.6, Math.PI, 'plasticBlue');
    G.trunk(29.3, 11.4, HALF, 'paintGreen'); G.wallHanging('x', 8, 27.0, 1, 'baluch', 1.2, 0.8);
    G.crates(25.2, 8.5, 0, 1);
    room('store');
    G.sacks(10.75, 11.0, HALF, 4); G.sacks(10.8, 12.3, 0, 3);
    G.crates(12.9, 12.45, 0, 3);                                                             // (nothing between the racks' end and the glasshouse's wall: the way round them)
    spans.push([K.props.length, '']);
    const serial = new Map<string, number>();
    for (let s = 0; s + 1 < spans.length; s++) for (let i = spans[s][0]; i < spans[s + 1][0]; i++) { const key = `lived.${spans[s][1]}.${K.props[i].kind}`, n = serial.get(key) ?? 0; serial.set(key, n + 1); K.props[i].name = `${key}${n}`; }
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [11.4, 1.35, 8.3], boxes: [brk, brkLed] },
    beacons: [{ pos: [21, H - 0.3, 15.5], box: dome }],
    playerSpawn: GLASSHOUSE_FRONT,
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the room clear brings its own cast
    sky: { zenith: [0.012, 0.02, 0.04], horizon: [0.035, 0.04, 0.06] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still): the office, a point on its back wall, the front door
    mission: { serverRoom: { ...OFFICE }, entryDoor: 'office', rack: { index: 0, front: [28.2, 1.0, 8.5], halfW: 0.3 }, exfilDoor: 'front', exfilX: 20.0, exfilZ: 18.6, exfilOut: [0, 1] },
  };
  // ---- what is underfoot (game/floor.ts): gravel and dirt outside are 'asphalt' (the nearest the six have to earth); the building stands on a concrete slab
  // ('stone'), lino laid in the lab and the office, the glasshouse's mat a carpet
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'house_mat', mat: 'carpet', x0: 18.7, z0: 14.9, x1: 21.3, z1: 16.3 },
      { id: 'office_rug', mat: 'carpet', x0: 25.4, z0: 9.65, x1: 27.8, z1: 11.35 },
      { id: 'lab', mat: 'lino', x0: 18.06, z0: 8.12, x1: 23.94, z1: 12.94 },
      { id: 'office', mat: 'lino', x0: 24.06, z0: 8.12, x1: 29.88, z1: 12.94 },
      { id: 'slab', mat: 'stone', x0: 10, z0: 8, x1: 30, z1: 18 },
    ],
  };
  return { level, scenarios: GLASSHOUSE_SCENARIOS, groups: trace.groups, surfaces };
}
