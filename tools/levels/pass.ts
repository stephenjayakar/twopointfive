// THE PASS — a level MADE FOR SNOW (levels/pass.json ← bun run tools/levels/export.ts pass). A walled caravan stop on a high pass road, at night, in winter:
// a teahouse and truck halt. One range of three rooms along the back wall (the tea room, the kitchen, the store), the bunk room turned down the side from
// the store, an open garage bay and a generator lean-to across the yard, and one gate onto the road. A lorry stands snowed in where it stopped, half through its turn
// inside the gate. Eight men in four rooms.
// THE SNOW IS IN THE FILE, laid by hand below (group 'snow.*'): the ground is snow paint; drifts are banked on the windward side (the wind is off the
// north-west) of the walls, the lorry and whatever stands in the open, deeper in the corners; caps lie on the tops of the yard wall, the gate posts, the
// lorry, the wood, the crates; trodden paths run from the gate to the doors, the ground is cleared to earth at the gate, the tea room's door and the
// generator, and two ruts run in from the road to the lorry's back wheels. Nothing white lies under a roof: a little grey slush is tracked in at each
// outside door. What FALLS is the weather's (src/game/weatherKinds.ts, keyed on this level's name) and no part of this file.
// THE LIGHT is a cold moon on the snow and warm things that burn: the lamp over the gate, a brazier in front of the tea room, bulbs in the tea room, the kitchen and the
// store (the mains: the generator in the lean-to), a stove's glow in the tea room and the bunk room, the bread oven's in the kitchen, lanterns. The tea
// room's two windows, the kitchen's and the bunk room's throw their light out onto the snow.
// TWO WAYS IN (scenarios.roomClear.team / starts[0]), both in the dark and behind a wall from every mark: the road, west of the gate and outside its lamp;
// or the back of the range, outside the wall, on the kitchen's back door.
//
//        x 6      9.5  12                  22          28          34
//   z 2                                way 2 (x 25): the back, dark             (a refuse heap)
//   z 5  +========+----+===================+====back===+===========+
//        | LEAN-TO     |                   |           s           |      lean-to: the generator, the breaker (open to the yard side)
//        | gen  B      |     TEA ROOM      p  KITCHEN  |   STORE   |      p = 'pass'   s = 'store'   i = 'inner'
//   z 9  +--------+    |   stove           |    oven   |           |
//        |             |                   |           |           |
//   z 11 |  (yard)     +=WW===tea===WW=====+==kitchen=W+----i------+      W = a window, 0.9 m to 1.85
//        |                    brazier  wood            |           |
//   z 13.5+===========+   LO                           bunk  BUNK  |
//        |            :     RR      THE YARD           |    ROOM   |
//        |  THE BAY   :       Y  (the lorry, snowed    W   stove   |
//        |  (pickup)  :        \   in half through     |           |
//   z 18 |            :         \   its turn)          +===========+
//   z 20.5+===========+          ruts    sandbags                  |
//   z 22 +==================*====[ GATE ]==========================+      * = the lamp over the gate
//   z 24    way 1 (x 11.6)         the road (packed snow, ruts)       jersey barriers
//
// Built from the 2010s kit (src/scene/gwotKit.ts) on the office kit's walls and panes, plus the snow paints (src/scene/gwotPalette.ts SNOW_PALETTE): flat
// colours, boxes only; no second look file.
// WHAT A SNOW PIECE IS TO A MAN (scene/collision.ts: a static blocks feet and the nav grid only where it stands over 0.2 m):
//   · ground, road, cleared earth  = thin solid slabs at the floor (feet, rounds and light land on them);
//   · paths, ruts, tracked-in slush = decals (NoShadow: drawn and lit, no ray and no collision query sees them);
//   · a DRIFT                       = solid boxes whose top is under 0.2 m (the check holds 0.19; the tallest is 0.18): men wade through it, a round knocks snow out of it;
//   · a BANK                        = a drift with tiers over 0.2 m: it stops feet. Only against a wall or the lorry, never within 1.4 m of a door;
//   · a CAP                         = a decal on the top of a thing: a round goes through it to the thing; where the thing is cover that breaks (the
//                                     wood, a wooden crate) the cap is to the wall engine what every decal on a broken piece is (game/wallbreak.ts `ghosts`).
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, type GwotOpening } from '../../src/scene/gwotKit';
import { SNOW_PALETTE, SNOW_FINISH, SNOW_MATERIALS, type SnowMat } from '../../src/scene/gwotPalette';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'pass';
export const NOTES = 'The pass: a walled teahouse and truck halt on a high pass road, at night, in winter. Eight men in four rooms round a yard under snow; the snow is in the file (ground, drifts, caps, trodden paths, ruts), laid by hand. Two ways in: the road west of the gate, and the back of the kitchen outside the wall. Regenerate: bun run tools/levels/export.ts pass';
/** the kit's palette and the snow paints go into the file's `materials` (tools/levels/export.ts) */
export const MATERIALS = { ...GWOT_MATERIALS, ...SNOW_MATERIALS };

const HALF = Math.PI / 2;
// the rooms' floors inside their walls
const TEA: Rect = { x0: 12.12, x1: 21.94, z0: 5.12, z1: 10.88 }, KITCHEN: Rect = { x0: 22.06, x1: 27.94, z0: 5.12, z1: 10.88 };
const STORE: Rect = { x0: 28.06, x1: 33.88, z0: 5.12, z1: 10.94 }, BUNK: Rect = { x0: 28.12, x1: 33.88, z0: 11.06, z1: 17.88 };
export const PASS_ROOMS = { tea: { name: 'tea room', bounds: TEA }, kitchen: { name: 'kitchen', bounds: KITCHEN }, store: { name: 'store', bounds: STORE }, bunk: { name: 'bunk room', bounds: BUNK } } as const;
/** WAY 1: the road, west of the gate: behind the yard wall from every mark and outside the gate lamp's reach. WAY 2: the back of the range, outside the wall,
 *  on the kitchen's back door: no window, no lamp. */
export const PASS_ROAD: Vec3 = [11.6, 0, 23.7], PASS_BACK: Vec3 = [25.25, 0, 2.6];
/** THE LORRY: where it stands and how. It came in through the gate off the road and was half through its left turn up the yard when it stopped: its tail
 *  2.6 m inside the gateway, its nose to the north-west, at the corner of the bay. So it stands BETWEEN the gateway and the tea room's two windows. */
const LORRY = { x: 17.1, z: 17.0, yaw: Math.PI * 0.75 };
// chest-high points the marks' guns rest on: the yard either side of the lorry through the tea room's two windows, the gateway through the bunk room's, and each door's inner face on the middle of
// its doorway AS HUNG (the kit fits a 0.9 m doorway inside the 1.2 m slot drawn below: the exported file's hinge + half its width)
const YARD_W: Vec3 = [12.7, 1.1, 16.2], YARD_E: Vec3 = [22.4, 1.1, 16.6], GATE_S: Vec3 = [20.0, 1.1, 21.6];
const TEA_IN: Vec3 = [17.25, 1.1, 10.9], PASS_W: Vec3 = [21.9, 1.1, 6.75], PASS_E: Vec3 = [22.1, 1.1, 6.75], BACK_IN: Vec3 = [25.25, 1.1, 5.2], KITCHEN_IN: Vec3 = [25.25, 1.1, 10.9];
const STORE_W: Vec3 = [27.9, 1.1, 8.25], STORE_E: Vec3 = [28.1, 1.1, 8.25], INNER_N: Vec3 = [32.25, 1.1, 10.9], INNER_S: Vec3 = [32.25, 1.1, 11.2], BUNK_IN: Vec3 = [28.2, 1.1, 13.75];

/** THE ROOM CLEAR (scene/scenarios.ts StructureData). Eight men: the tea room 3, the kitchen 2, the store 1, the bunk room 2.
 *  THE HAND PLACEMENT (roomclear.ts placeDefenders: seed 0 / attempt 1 = each room's first `garrison` marks IN FILE ORDER; the page deals it on every try).
 *  The problem, in one sentence: the yard between the lorry and the doors is white, lit and watched through glass from two sides.
 *  · THE GATE is the one hole in the wall and it is lit, but THE LORRY stands 2.6 m inside it, between it and the tea room's two windows: a team comes in
 *    behind the lorry. Only bunk 1, at the dark bunk room's window, has the gateway, from the side (a low wall of sandbags stands on that side of it).
 *    (It was not so at first: with the lorry up the yard and two men of the tea room at the glass on the gateway, the plain scripted team was down inside
 *    8 to 14 s of the gate on one seed in three. A hole that kills before a decision is no problem to solve.)
 *  · THE YARD (the obvious plan: round the lorry and across to the tea room's door) is the tea room's: tea 1 at the window right of the door on the yard
 *    east of the lorry, tea 2 at the window left of it on the yard west of the lorry, and the bunk room's window behind a team that goes east. What says so
 *    before contact: lit windows on the snow, the brazier burning in front of them, the lantern at the door.
 *  · THE BACK (answer A: way 2, the kitchen's back door, outside the wall) opens on the kitchen's two men, one of them set on that door, with the tea room's
 *    third man on the door between the two rooms: a fight at one door instead of a walk under two windows.
 *  · THE DARK (answer B): the generator and the breaker are in the lean-to across the yard, reached from the gate along the lorry's west side and the bay,
 *    out of the east window and the bunk room's. With the mains out the gate lamp and the bulbs are gone and the tea room is a stove's glow and a lantern;
 *    the brazier still burns in front of it.
 *  SQUADS: House (the tea room and the kitchen) and Lines (the store and the bunk room). What either does when the other is hit is the AI's call. Each may
 *  wedge only its own yard door ('tea', 'bunk'): the kitchen's yard door and its back door are never theirs to shut (tools/qa/second-way-check.ts). */
export const PASS_STRUCTURE: StructureData = {
  name: 'the halt', maxMen: 8,
  team: { sam: PASS_ROAD, samYaw: HALF, ops: [[10.6, 0, 24.5], [12.6, 0, 24.5], [9.8, 0, 25.3], [11.8, 0, 25.3]], opsYaw: HALF },
  starts: [{ sam: PASS_BACK, samYaw: 0, ops: [[24.2, 0, 1.8], [26.3, 0, 1.8], [23.4, 0, 1.1], [27.1, 0, 1.1]], opsYaw: 0 }],
  rooms: [
    { id: 'tea', name: 'tea room', bounds: TEA, garrison: 3,
      doors: [{ id: 'tea', from: 'yard' }, { id: 'pass', from: 'kitchen' }],
      marks: [
        { pos: [19.9, 0, 10.1], watch: 'tea', aimAt: YARD_E },                     // 1: at the window right of the door, on the yard east of the lorry
        { pos: [14.1, 0, 10.2], watch: 'tea', aimAt: YARD_W },                     // 2: at the window left of it, on the yard west of the lorry
        { pos: [13.4, 0, 6.4], watch: 'pass', aimAt: PASS_W },                     // 3: their back: the far corner, on the door from the kitchen
        { pos: [18.6, 0, 6.9], watch: 'tea', aimAt: TEA_IN },                      // (spare) the back of the room, on its yard door
        { pos: [20.3, 0, 8.9], watch: 'pass', aimAt: PASS_W },                     // (spare) off the kitchen's door, on it
      ] },
    { id: 'kitchen', name: 'kitchen', bounds: KITCHEN, garrison: 2,
      doors: [{ id: 'kitchen', from: 'yard' }, { id: 'back', from: 'back' }, { id: 'pass', from: 'tea room' }, { id: 'store', from: 'store' }],
      marks: [
        { pos: [23.6, 0, 9.3], watch: 'back', aimAt: BACK_IN },                    // 1: off the back door's line, on it
        { pos: [26.6, 0, 6.9], watch: 'kitchen', aimAt: KITCHEN_IN },              // 2: the far corner, on the yard door
        { pos: [27.3, 0, 9.4], watch: 'store', aimAt: STORE_W },                   // (spare) on the store's door
        { pos: [26.0, 0, 9.2], watch: 'pass', aimAt: PASS_E },                     // (spare) on the tea room's
      ] },
    { id: 'store', name: 'store', bounds: STORE, garrison: 1,
      doors: [{ id: 'store', from: 'kitchen' }, { id: 'inner', from: 'bunk room' }],
      marks: [
        { pos: [33.0, 0, 10.2], watch: 'store', aimAt: STORE_E },                  // 1: the far corner, on the kitchen's door
        { pos: [29.4, 0, 9.3], watch: 'inner', aimAt: INNER_N },                   // (spare) on the bunk room's
        { pos: [30.6, 0, 6.9], watch: 'store', aimAt: STORE_E },                   // (spare) among the sacks, on the kitchen's
      ] },
    { id: 'bunk', name: 'bunk room', bounds: BUNK, garrison: 2,
      doors: [{ id: 'bunk', from: 'yard' }, { id: 'inner', from: 'store' }],
      marks: [
        { pos: [29.3, 0, 15.7], watch: 'bunk', aimAt: GATE_S },                    // 1: at its window in the dark, across the yard at the gateway from the side
        { pos: [32.0, 0, 15.6], watch: 'bunk', aimAt: BUNK_IN },                   // 2: across the room, on its yard door
        { pos: [29.6, 0, 12.2], watch: 'inner', aimAt: INNER_S },                  // (spare) on the store's door
        { pos: [31.5, 0, 16.6], watch: 'bunk', aimAt: BUNK_IN },                   // (spare) the back of the room, on the yard door
      ] },
  ],
  squads: [
    { id: 'house', name: 'House', rooms: ['tea', 'kitchen'], rally: [18.0, 0, 7.6], barricade: ['tea'] },
    { id: 'lines', name: 'Lines', rooms: ['store', 'bunk'], rally: [30.2, 0, 15.8], barricade: ['bunk'] },
  ],
};
/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): a bespoke set for both ways in — the compound's mud wall
 *  on the road, the wicket in the truck gate under its one lamp, the lorry behind the wall, snow on everything. The level's own two starts stand in the open dark
 *  with no door near them; the set is what the place looks like from the road. */
const PASS_KITVIEW: KitViewData = {
  sets: { gate: { ref: [19, 19],
    doors: [{id: 'ps_wicket', hinge: [18.32, 16], closedDir: 0, width: 0.86, exterior: true}],
    lights: [{id: 'ps_lamp', kind: 'spot', pos: [18.05, 2.84, 16], dir: [0.12, -1, 0.05], color: [1, 0.72, 0.42], intensity: 30, range: 8, innerDeg: 36, outerDeg: 72, group: 'ps', enabled: true, volumetric: 0.15, radius: 0.12, mains: false, broad: true, fixture: 'ps_lamp_box'}],
    boxes: [
    {id: 'ps_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'snow'},
    {id: 'ps_road', c: [20, 0.002, 19], h: [20, 0.002, 1.7], material: 'snowPacked'},
    {id: 'ps_wall_w', c: [12.33, 1.235, 16], h: [5.33, 1.235, 0.12], material: 'mud'},
    {id: 'ps_wall_e', c: [24.17, 1.235, 16], h: [2.83, 1.235, 0.12], material: 'mud'},
    {id: 'ps_post_w', c: [17.83, 1.29, 16], h: [0.17, 1.29, 0.17], material: 'render'},
    {id: 'ps_post_e', c: [21.17, 1.29, 16], h: [0.17, 1.29, 0.17], material: 'render'},
    {id: 'ps_gate_stile', group: 'ps.gate', c: [18.16, 1.15, 16], h: [0.16, 1.15, 0.025], material: 'paintRust'},
    {id: 'ps_gate_head', group: 'ps.gate', c: [18.75, 2.18, 16], h: [0.43, 0.12, 0.025], material: 'paintRust'},
    {id: 'ps_gate_leaf', group: 'ps.gate', c: [20.09, 1.15, 16], h: [0.91, 1.15, 0.025], material: 'paintRust'},
    {id: 'ps_lamp_pole', c: [17.83, 2.72, 16], h: [0.03, 0.14, 0.03], material: 'galv'},
    {id: 'ps_lamp_box', c: [18.0, 2.9, 16], h: [0.2, 0.04, 0.1], material: 'plasticBlack', emissive: [30, 20, 9], flags: ['NoShadow']},
    {id: 'ps_cleared', c: [19.3, 0.002, 16.2], h: [1.9, 0.002, 1.75], material: 'snowOld'},
    {id: 'ps_earth', c: [19.3, 0.003, 16.2], h: [1.45, 0.003, 1.3], material: 'dust'},
    {id: 'ps_rut_a', c: [19.55, 0.012, 16.9], h: [0.17, 0.003, 2.3], material: 'snowOld', flags: ['NoShadow']},
    {id: 'ps_rut_b', c: [20.75, 0.012, 16.9], h: [0.17, 0.003, 2.3], material: 'snowOld', flags: ['NoShadow']},
    {id: 'ps_cap_w', c: [12.33, 2.5, 16], h: [5.33, 0.03, 0.1], material: 'snow', flags: ['NoShadow']},
    {id: 'ps_cap_e', c: [24.17, 2.5, 16], h: [2.83, 0.03, 0.1], material: 'snow', flags: ['NoShadow']},
    {id: 'ps_drift_w', c: [12.6, 0.08, 16.29], h: [4.6, 0.08, 0.17], material: 'snow'},
    {id: 'ps_drift_gate', c: [20.2, 0.07, 16.2], h: [0.75, 0.07, 0.17], material: 'snow'},
    {id: 'ps_lorry_under', group: 'ps.lorry', c: [14.1, 0.37, 14.0], h: [3.1, 0.37, 0.95], yaw: -0.09, material: 'iron'},
    {id: 'ps_lorry_load', group: 'ps.lorry', c: [13.054, 1.345, 13.906], h: [2.05, 0.605, 1.12], yaw: -0.09, material: 'canvas'},
    {id: 'ps_lorry_cab', group: 'ps.lorry', c: [15.743, 1.47, 14.148], h: [0.62, 0.73, 1.1], yaw: -0.09, material: 'truckRed'},
    {id: 'ps_lorry_nose', group: 'ps.lorry', c: [16.938, 1.12, 14.256], h: [0.62, 0.38, 0.98], yaw: -0.09, material: 'truckRed'},
    {id: 'ps_lorry_snow', group: 'ps.lorry', c: [13.054, 2.0, 13.906], h: [1.84, 0.05, 0.96], yaw: -0.09, material: 'snow', flags: ['NoShadow']},
    {id: 'ps_cab_snow', group: 'ps.lorry', c: [15.793, 2.235, 14.153], h: [0.5, 0.035, 0.98], yaw: -0.09, material: 'snow', flags: ['NoShadow']},
  ] } },
  ways: [
    {door: 'ps_wicket', set: 'gate', side: -1, pane: false, light: {porch: {intensity: 0}}},
    {door: 'ps_wicket', set: 'gate', side: -1, pane: false, light: {porch: {intensity: 0}}},
  ] };

export const PASS_SCENARIOS: LevelScenarios = { roomClear: PASS_STRUCTURE, kitView: PASS_KITVIEW,
  places: { areas: [
    { name: 'the yard', bounds: { x0: 12, x1: 28, z0: 11.1, z1: 21.9 } }, { name: 'the yard', bounds: { x0: 6.1, x1: 12, z0: 9.1, z1: 13.4 } }, { name: 'the yard', bounds: { x0: 28, x1: 33.9, z0: 18.1, z1: 21.9 } },
    { name: 'the yard', bounds: { x0: 6.1, x1: 12, z0: 20.6, z1: 21.9 } },
    { name: 'the bay', bounds: { x0: 6.1, x1: 12, z0: 13.6, z1: 20.4 } }, { name: 'the lean-to', bounds: { x0: 6.1, x1: 12, z0: 5.1, z1: 9.1 } },
    { name: 'the road', bounds: { x0: 0, x1: 40, z0: 22.2, z1: 28 } }, { name: 'the back', bounds: { x0: 0, x1: 40, z0: 0, z1: 4.8 } },
  ] } };

/** what a level built ON the halt adds (tools/levels/tut-sky.ts): `kept` runs after the halt's own kept things and before the lived-in tail, with the kit in
 *  hand; `scenarios` and `spawn` stand in for the halt's own. With none of them given the file is the halt, byte for byte. */
export interface PassExtra { kept?: (X: { K: ReturnType<typeof officeKit>; G: ReturnType<typeof gwotKit>; cap: (x: number, z: number, w: number, d: number, y: number, yaw?: number, t?: number) => void }) => void; scenarios?: LevelScenarios; spawn?: Vec3 }
export function build(extra: PassExtra = {}): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY, M = G.M;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const DECAL = BoxFlag.NoShadow;
  type Mat = { albedo: Vec3; rough: number };
  const S = Object.fromEntries((Object.keys(SNOW_PALETTE) as SnowMat[]).map(n => [n, { albedo: SNOW_PALETTE[n], rough: SNOW_FINISH[n].rough }])) as Record<SnowMat, Mat>;
  /** a window: 0.9 m off the floor to 1.85, two panes */
  const win = (a: number, b: number): GwotOpening => ({ a, b, y0: 0.9, y1: 1.85, mullions: 2, glass: 'bay' });
  const zones: SurfacesData['zones'] = [];

  // ================================================================ SNOW: the pieces (see the head for what each is to a man) ====
  /** a thin solid ground finish (as the kit's G.ground, in any paint) */
  const lay = (x0: number, z0: number, x1: number, z1: number, m: Mat, y = 0.004) => add({ c: [(x0 + x1) / 2, y / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, y / 2, Math.abs(z1 - z0) / 2], ...m });
  /** GROUND CLEARED TO EARTH: a rectangle of bare dust inside a ring of grey slush (solid, at the floor); its footsteps are earth's */
  const cleared = (id: string, x0: number, z0: number, x1: number, z1: number, ring = 0.4) => {
    lay(x0 - ring, z0 - ring, x1 + ring, z1 + ring, S.snowOld, 0.004); lay(x0, z0, x1, z1, M.dust, 0.006);
    zones.push({ id, mat: 'asphalt', x0: x0 - ring, z0: z0 - ring, x1: x1 + ring, z1: z1 + ring });
  };
  /** DECAL: a flat mark at the floor, w along local x, d along local z */
  const flat = (x: number, z: number, w: number, d: number, m: Mat, yaw = 0) => add({ c: [x, 0.012, z], h: [w / 2, 0.003, d / 2], yaw, ...m, flags: DECAL });
  let pathN = 0;
  /** DECAL: a TRODDEN PATH through the points, `w` wide: packed snow, darker than the fresh. Its footsteps are the hard ground's (squares of the footstep
   *  map laid along it: the map holds only rectangles on the grid) */
  const path = (pts: [number, number][], w = 0.8, m: Mat = S.snowPacked) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      flat((x0 + x1) / 2, (z0 + z1) / 2, L + (i + 2 < pts.length ? w * 0.5 : 0), w, m, yaw);
      for (let s = 0; s <= L; s += 0.5) { const x = x0 + (x1 - x0) * s / L, z = z0 + (z1 - z0) * s / L; zones.push({ id: `path_${pathN++}`, mat: 'asphalt', x0: x - w / 2, z0: z - w / 2, x1: x + w / 2, z1: z + w / 2 }); }
    }
  };
  /** DECAL: two wheel RUTS through the points, `track` apart: old grey snow pressed into the packed */
  const ruts = (pts: [number, number][], track = 1.96) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0), b = G.piece((x0 + x1) / 2, (z0 + z1) / 2, yaw);
      // (each length laps 0.12 m over the next at a bend — but not past the map: an end that stands ON the level's edge stops there, nothing lies beyond the bounds)
      const lap = (x: number) => x <= 0 || x >= 40 ? 0 : 0.12, e0 = lap(x0), e1 = lap(x1);
      for (const s of [-track / 2, track / 2]) b((e1 - e0) / 2, s, 0.009, 0.015, L / 2 + (e0 + e1) / 2, 0.17, S.snowOld, { flags: DECAL });
    }
  };
  /** a DRIFT (walk-over: nothing of it over 0.19 m): snow blown against the foot of something. (x, z) = its middle, `len` along the thing, `depth` out from
   *  it; `yaw` turns local +Z to point AWAY from the thing (0 = toward +z, π/2 = +x, π = −z, −π/2 = −x). Two steps: a lip, and a crest against the thing. */
  const drift = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.17) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, top * 0.5, len / 2, depth / 2, S.snow); b(len * 0.03, -depth * 0.22, 0, top, len * 0.41, depth * 0.28, S.snow);
  };
  /** a BANK (stops feet: its crest stands over 0.2 m): the deep snow of a windward wall or a corner. Same frame as drift(); three steps down from `top` */
  const bank = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.42) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, 0.16, len / 2, depth / 2, S.snow); b(-len * 0.02, -depth * 0.15, 0, top * 0.62, len * 0.47, depth * 0.35, S.snow); b(len * 0.03, -depth * 0.31, 0, top, len * 0.42, depth * 0.19, S.snow);
  };
  /** DECAL: a CAP of snow on top of a thing whose top is at `y`: w × d, `t` thick (set in from the thing's edges by the caller, so its own colour shows as a rim) */
  const cap = (x: number, z: number, w: number, d: number, y: number, yaw = 0, t = 0.05) => G.piece(x, z, yaw)(0, 0, y, y + t, w / 2, d / 2, S.snow, { flags: DECAL });
  /** caps along a yard wall's coping (its top at 2.47 m), in lengths with wind-scoured gaps between them: `a`‥`b` along the wall at `line` */
  const copingCaps = (axis: 'x' | 'z', line: number, a: number, b: number) => {
    const lens = [2.3, 1.6, 2.9, 1.2, 2.0, 2.6]; let u = a + 0.06, k = Math.round(a * 7 + line) % lens.length;
    while (u < b - 0.4) { const l = Math.min(lens[k++ % lens.length], b - 0.06 - u), m = u + l / 2; if (axis === 'x') cap(m, line, l, 0.2, 2.47, 0, 0.05 + (k % 3) * 0.012); else cap(line, m, 0.2, l, 2.47, 0, 0.05 + (k % 3) * 0.012); u += l + 0.14 + (k % 2) * 0.1; }
  };

  // ---- ground: snow to the edge of the map; the road ploughed and driven (packed); earth and slab under the roofs ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, S.snow.albedo, { rough: S.snow.rough });
  lay(0, 23.3, 40, 26.7, S.snowPacked);                                                       // the road
  grp('floors');
  G.ground(12, 5, 22, 11, 'mudFloor', 0.006);                                                 // the tea room: beaten earth under its rugs
  G.ground(22, 5, 34, 11, 'slab', 0.006);                                                     // the kitchen and the store: a concrete slab
  G.ground(28, 11, 34, 18, 'mudFloor', 0.006);                                                // the bunk room
  G.ground(5.9, 13.4, 12.1, 20.6, 'dirt', 0.006);                                             // the bay: dry earth under its roof, to the eaves
  G.ground(5.9, 4.9, 9.6, 9.1, 'slab', 0.006);                                                // the lean-to
  // THE ROOFS: four slabs, no more (the weather takes a level's four biggest ceiling slabs as its roofs — game/weather.ts roofsOf — and snow falls everywhere
  // else): the range, the bunk room, the bay, the lean-to
  grp('ceiling');
  slab(11.9, H, 4.9, 34.1, H + 0.2, 11.1, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(27.9, H, 11.1, 34.1, H + 0.2, 18.1, P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(5.9, H, 13.4, 12.1, H + 0.2, 20.6, P.tin, { flags: BoxFlag.NoPrimary, rough: 0.6 });
  slab(5.9, H, 4.9, 9.6, H + 0.2, 9.1, P.tin, { flags: BoxFlag.NoPrimary, rough: 0.6 });

  // ---- the buildings: mud brick, dark against the snow ----
  grp('walls.shell');
  G.wallX(5, 11.88, 34.12, 'mud', [{ a: 24.4, b: 25.6 }, { a: 26.5, b: 27.3, y0: 2.3, y1: 2.5 }]);   // the back of the range: blank but for the kitchen's back door and its smoke slit under the beams
  G.wallX(11, 11.88, 28.12, 'mud', [win(13.2, 15.0), { a: 16.4, b: 17.6 }, win(19.2, 21.0), { a: 24.4, b: 25.6 }, win(26.2, 27.4)]);   // its front, on the yard: window, the tea room's door, window | the kitchen's door, its window
  G.wallZ(12, 5.12, 10.88, 'mud');
  G.wallZ(34, 5.12, 17.88, 'mud');
  G.wallZ(28, 11.12, 17.88, 'mud', [{ a: 13.0, b: 14.2 }, win(15.4, 16.8)]);                  // the bunk room on the yard: its door, its window
  G.wallX(18, 27.88, 34.12, 'mud');
  grp('walls.inside');
  G.partZ(22, 5.12, 10.88, 'mudLight', [{ a: 6.0, b: 7.2 }]);                                 // tea room | kitchen: 'pass', at the back-wall end (the camera looks from the front: a door close behind the front wall is never drawn)
  G.partZ(28, 5.12, 10.88, 'mudLight', [{ a: 7.6, b: 8.8 }]);                                 // kitchen | store: 'store' (off the line of 'pass': no look from the tea room through both)
  G.partX(11, 28.12, 33.88, 'mudLight', [{ a: 31.4, b: 32.6 }]);                              // store | bunk room: 'inner'
  G.dado('x', 11, 15.7, 16.7, 1, 'paintRust'); G.dado('x', 11, 17.8, 18.8, 1, 'paintRust');   // the halt's red, on the wall either side of the tea room's door (outside)
  G.dado('z', 28, 12.3, 13.2, -1, 'paintRust'); G.dado('z', 28, 14.3, 15.2, -1, 'paintRust'); // … and the bunk room's
  grp('walls.bay');
  G.wallZ(6, 13.62, 20.38, 'mud'); G.wallX(13.5, 5.88, 12.12, 'mud'); G.wallX(20.5, 5.88, 12.12, 'mud');   // the bay: three walls, open on the yard
  add({ c: [12.0, H / 2, 17.0], h: [0.09, H / 2, 0.09], ...M.woodGrey });                     // the post under its eaves
  grp('walls.leanto');
  G.wallX(5, 5.88, 9.62, 'block'); G.wallZ(6, 5.12, 8.88, 'block'); G.wallX(9, 5.88, 9.62, 'block');   // the lean-to: block, open on the tea room's side
  grp('walls.yard');
  G.yardWallX(5, 9.62, 11.88, 'mud');
  G.yardWallZ(6, 9.12, 13.38, 'mud'); G.yardWallZ(6, 20.62, 21.88, 'mud');
  G.yardWallX(22, 5.88, 34.12, 'mud', [{ a: 18, b: 21, y1: 3 }]);                             // the front, on the road: the gateway
  G.yardWallZ(34, 18.12, 21.88, 'mud');
  G.pier(12.0, 22, 2.4); G.pier(27.0, 22, 2.4);
  G.gate(19.5, 22, 'x', 3.0, 1, 'paintRust', 82);                                             // the gate, standing open onto the road (static leaves)

  // ---- THE LORRY: a two-axle lorry with a canvas tilt, where it stopped when the pass shut (KEPT: it is the yard's one piece of cover, what screens
  // the gateway from the tea room's windows and what the ruts are laid to). Nose toward local +X ----
  grp('lorry');
  const L = G.piece(LORRY.x, LORRY.z, LORRY.yaw);
  for (const lx of [2.2, -1.2, -2.25]) for (const s of [-1, 1]) L(lx, s * 0.98, 0, 0.96, 0.48, 0.15, M.rubber);
  L(-0.1, 0, 0.5, 0.74, 3.1, 0.42, M.iron);                                                   // the chassis
  L(3.42, 0, 0.5, 0.78, 0.06, 1.12, M.iron);                                                  // bumper
  L(2.75, 0, 0.74, 1.5, 0.62, 0.98, M.truckRed);                                              // bonnet
  L(1.55, 0, 0.74, 1.5, 0.62, 1.12, M.truckRed);                                              // the cab: doors
  L(1.55, 0, 1.5, 2.08, 0.58, 1.06, M.glassDark);                                             // … glass
  L(1.5, 0, 2.08, 2.2, 0.62, 1.1, M.truckRed);                                                // … roof
  for (const s of [-1, 1]) L(3.38, s * 0.7, 0.86, 1.02, 0.02, 0.1, M.plasticWhite);           // headlamps (dead)
  L(-1.15, 0, 0.74, 0.9, 2.05, 1.16, M.woodGrey);                                             // the bed
  for (const s of [-1, 1]) L(-1.15, s * 1.14, 0.9, 1.45, 2.05, 0.03, M.poplar);               // sideboards
  L(-3.17, 0, 0.9, 1.45, 0.03, 1.16, M.poplar); L(0.87, 0, 0.9, 1.7, 0.03, 1.16, M.poplar);   // tailboard, headboard
  L(-1.15, 0, 0.9, 1.95, 1.95, 1.06, M.canvas);                                               // the load under its canvas
  grp('snow.lorry');
  L(-1.15, 0, 1.95, 2.05, 1.84, 0.96, S.snow, { flags: DECAL });                              // CAPS: the tilt (deep: it has stood for days),
  L(-1.15, 0, 2.05, 2.11, 1.84, 0.96, S.snow, { flags: DECAL });                              //   a second fall over the first, the whole tilt (one outline: two nested ones read as slabs)
  L(1.5, 0, 2.2, 2.27, 0.55, 1.02, S.snow, { flags: DECAL });                                 //   the cab's roof
  L(2.8, 0, 1.5, 1.555, 0.52, 0.9, S.snow, { flags: DECAL });                                 //   the bonnet
  L(3.72, 0, 0, 0.44, 0.25, 1.0, S.snow);                                                     // BANK (stops feet): the nose stands into the wind; snow is banked on the bumper,
  L(4.12, 0, 0, 0.3, 0.2, 0.9, S.snow);                                                       //   stepping down
  L(4.47, 0, 0, 0.17, 0.2, 0.75, S.snow);                                                     //   to a lip a man wades
  for (const s of [-1, 1]) {
    L(0.3, s * 1.31, 0, 0.3, 2.9, 0.14, S.snow);                                              // BANK: packed in against the wheels down both sides (the wind runs along it),
    L(0.3, s * 1.61, 0, 0.15, 2.6, 0.17, S.snow);                                             //   with a lip a man wades
  }
  L(0.5, 0, 0, 0.3, 1.15, 0.8, S.snow);                                                       // blown in under the body between the axles
  L(-3.55, 0, 0, 0.13, 0.3, 0.9, S.snow);                                                     // DRIFT: the lee of the tail, thin

  // ---- the yard (kept things: what stands in the open) ----
  grp('yard');
  G.woodPile(22.1, 11.47, 0, 1.4);                                                            // the winter's wood, against the range between a window and the kitchen's door
  add({ c: [22.9, 0.16, 12.5], h: [0.22, 0.16, 0.22], yaw: 0.4, ...M.poplar });               // the chopping block
  add({ c: [23.5, 0.05, 12.9], h: [0.22, 0.05, 0.06], yaw: 0.9, ...M.woodGrey }); add({ c: [22.4, 0.05, 13.0], h: [0.2, 0.05, 0.06], yaw: -0.5, ...M.woodGrey });   // split billets (walk-over)
  G.crates(27.5, 17.5, HALF, 3, 'coyote');                                                    // crates under snow against the bunk room, south of its window
  G.drum(27.3, 11.55, 'drumBlue');                                                            // the water drum by the kitchen
  G.sandbags(22.2, 20.9, 1.4, HALF, 4);                                                       // a low wall of sandbags inside the gate, on the bunk room's side of it
  const crate = add({ c: [15.0, 0.15, 11.42], h: [0.45, 0.15, 0.2], ...M.olive });            // a crate by the tea room's door: the lantern stands on it
  void crate;
  G.handcart(13.8, 20.9, 0.0, 'sacks');
  G.tyres(12.7, 21.2, 3);
  grp('road');
  G.jersey(27.5, 24.1, 1, 0.22); G.jersey(31.2, 25.9, 1, -0.18);                              // the halt's chicane on the road
  for (const [x, z, w, d, h, yaw] of [[3.0, 9.4, 0.8, 0.55, 0.6, 0.4], [2.2, 17.2, 0.6, 0.5, 0.45, -0.3], [37.0, 13.6, 0.9, 0.6, 0.7, 0.2], [36.6, 6.2, 0.6, 0.45, 0.4, 0.7], [9.2, 2.0, 0.7, 0.5, 0.5, -0.5], [34.0, 1.8, 0.8, 0.6, 0.55, 0.1], [37.6, 20.6, 0.55, 0.4, 0.35, 0.5]] as const) {
    add({ c: [x, h / 2, z], h: [w / 2, h / 2, d / 2], yaw, ...M.block });                     // field stones off the hill
    cap(x - 0.03, z - 0.02, w - 0.14, d - 0.12, h, yaw, 0.06);
  }
  G.rubble(29.6, 2.9, 0.55, 7, 'tin');                                                        // the cook's refuse heap, out of the back door

  // ================================================================ SNOW: laid by hand ====
  // ---- cleared to earth: the gateway, the tea room's door, the generator; a ring melted round the brazier; the back door's step ----
  grp('snow.cleared');
  cleared('gateway', 18.15, 20.7, 20.85, 23.3, 0.45);
  cleared('tea_door', 16.15, 11.14, 18.35, 12.5, 0.4);
  cleared('generator', 9.75, 5.7, 11.2, 8.7, 0.35);
  cleared('brazier', 19.1, 13.1, 20.1, 14.1, 0.35);
  cleared('kitchen_door', 24.75, 11.14, 25.75, 11.9, 0.3);
  cleared('back_door', 24.75, 4.1, 25.75, 4.86, 0.3);
  // ---- trodden paths: from the gate to each door, between the doors, to the generator and the bay; the cook's path to the refuse heap ----
  grp('snow.paths');
  path([[20.3, 20.5], [21.05, 18.3], [18.3, 14.3], [17.25, 12.9]], 0.9);                        // gate → round the lorry's tail and up its east side → the tea room
  path([[21.05, 18.1], [24.4, 14.6], [25.3, 12.2]], 0.75);                                     // … → the kitchen
  path([[24.6, 14.3], [26.6, 13.75], [27.85, 13.75]], 0.75);                                  // … and the bunk room's door off it
  path([[15.75, 12.0], [11.0, 12.0], [10.6, 9.1]], 0.7);                                       // the tea room → the generator
  path([[18.9, 21.1], [17.3, 21.1], [13.8, 18.9], [12.3, 17.6]], 0.7);                        // gate → down the lorry's west side → the bay
  path([[25.25, 3.8], [25.6, 3.0], [29.0, 2.9]], 0.6);                                         // the back door → the refuse heap
  flat(29.6, 2.9, 1.5, 1.2, S.snowOld, 0.3);                                                  // … ash and slops on the snow
  // ---- ruts: along the road from the east, in through the gate and round to the left, to the lorry's back wheels ----
  grp('snow.ruts');
  ruts([[40, 25.0], [23.6, 25.0], [20.7, 24.3], [19.6, 23.0]]);
  ruts([[19.5, 22.4], [19.45, 20.8], [19.1, 19.4], [LORRY.x - 1.7 * Math.cos(LORRY.yaw), LORRY.z + 1.7 * Math.sin(LORRY.yaw)]]);
  ruts([[0, 25.5], [16.4, 25.5]], 1.7);                                                       // what has passed since, on the road
  // ---- tracked in: grey slush on the floor inside each outside door (nothing white under a roof) ----
  grp('snow.tracked');
  flat(17.25, 10.5, 0.8, 0.55, S.snowOld, 0.08); flat(17.05, 9.9, 0.35, 0.3, S.snowOld, -0.3);
  flat(25.25, 10.5, 0.8, 0.5, S.snowOld, -0.06); flat(25.3, 5.55, 0.75, 0.5, S.snowOld, 0.05);
  flat(28.5, 13.75, 0.5, 0.8, S.snowOld, 0.07);
  flat(11.7, 17.3, 0.5, 1.6, S.snowOld, 0.05); flat(9.3, 7.2, 0.4, 1.3, S.snowOld, -0.04);    // … and at the bay's and the lean-to's open sides
  // ---- caps: the yard wall's coping, its piers, the gate posts; the wood, the crates, the drum, the sandbags; the barriers on the road ----
  grp('snow.caps');
  copingCaps('x', 5, 9.62, 11.88); copingCaps('z', 6, 9.12, 13.38); copingCaps('z', 6, 20.62, 21.88);
  copingCaps('x', 22, 5.88, 11.7); copingCaps('x', 22, 12.3, 17.8); copingCaps('x', 22, 21.2, 26.7); copingCaps('x', 22, 27.3, 34.12); copingCaps('z', 34, 18.12, 21.88);
  cap(12.0, 22, 0.42, 0.42, 2.52, 0, 0.06); cap(27.0, 22, 0.42, 0.42, 2.52, 0, 0.06);         // the piers
  cap(17.83, 22, 0.3, 0.3, 2.58, 0, 0.07); cap(21.17, 22, 0.3, 0.3, 2.58, 0, 0.07);           // the gate posts
  cap(22.1, 11.47, 1.2, 0.3, 0.42, 0, 0.07);                                                  // the wood pile
  cap(22.9, 12.5, 0.34, 0.34, 0.32, 0.4, 0.04);                                               // the chopping block
  cap(27.5, 17.5, 0.3, 0.78, 0.9, 0, 0.07);                                                   // the crates
  cap(27.3, 11.55, 0.36, 0.36, 0.88, 0, 0.05); cap(27.3, 11.55, 0.36, 0.36, 0.878, Math.PI / 4, 0.05);   // the drum's lid (two squares: an octagon's)
  cap(22.2, 20.9, 0.36, 1.2, 0.8, 0, 0.05);                                                   // the sandbags
  cap(14.8, 11.42, 0.42, 0.3, 0.3, 0, 0.04);                                                  // the crate by the door, beside the lantern
  cap(13.8, 20.9, 0.7, 0.45, 0.97, 0.4, 0.05);                                                // the handcart's load
  cap(12.7, 21.2, 0.44, 0.44, 0.6, 0.3, 0.05);                                                // the tyres
  cap(27.5, 24.1, 1.86, 0.2, 0.81, 0.22, 0.05); cap(31.2, 25.9, 1.86, 0.2, 0.81, -0.18, 0.05);   // the barriers
  // ---- BANKS (they stop feet: against a wall, out of every route, none within 1.4 m of a door) ----
  grp('snow.banks');
  bank(9.0, 21.25, 5.7, 1.24, Math.PI, 0.5);                                                  // the corner behind the bay: wall to wall (the wind drops it here)
  bank(25.4, 21.5, 4.2, 0.74, Math.PI, 0.36); bank(30.9, 21.45, 5.8, 0.84, Math.PI, 0.44);    // along the front wall inside, east of the gate, deeper toward the corner
  bank(33.42, 19.6, 2.6, 0.9, -HALF, 0.46);                                                   // … and up the east wall in that corner
  bank(6.5, 11.2, 3.9, 0.74, HALF, 0.4);                                                      // the west wall inside, between the lean-to and the bay
  bank(9.0, 13.0, 5.6, 0.74, Math.PI, 0.42);                                                  // the bay's back wall (it faces the wind)
  bank(11.56, 8.6, 3.6, 0.62, -HALF, 0.36);                                                   // the tea room's end wall, by the lean-to
  bank(8.6, 27.4, 17.0, 1.2, Math.PI, 0.5); bank(30.0, 27.4, 19.6, 1.2, Math.PI, 0.55);       // the plough's bank on the far side of the road
  // ---- DRIFTS (walk-over, 0.19 m and under: wind-laid snow a man wades) ----
  grp('snow.drifts');
  drift(14.0, 11.38, 2.6, 0.5, 0, 0.16); drift(20.0, 11.36, 2.2, 0.46, 0, 0.15);              // under the tea room's two windows (their light falls on it)
  drift(26.9, 11.3, 0.5, 0.36, 0, 0.13);                                                      // under the kitchen's
  drift(27.6, 12.0, 1.5, 0.5, -HALF, 0.16); drift(27.62, 15.9, 1.6, 0.46, -HALF, 0.15);       // the bunk room's wall: north of its door, under its window
  drift(22.1, 11.95, 1.5, 0.4, 0, 0.12);                                                      // against the wood
  drift(27.05, 17.5, 1.0, 0.44, -HALF, 0.14);                                                 // the crates' windward side
  drift(21.7, 20.9, 1.5, 0.46, -HALF, 0.14);                                                  // the sandbags'
  drift(13.7, 20.3, 2.4, 0.5, 0.0, 0.15);                                                     // round the cart and the tyres (clear of the bay's eaves)
  drift(14.9, 21.56, 2.0, 0.6, Math.PI, 0.17);                                                // the front wall inside, west of the gate
  drift(12.42, 17.0, 5.6, 0.5, HALF, 0.12);                                                    // a sill of snow along the bay's eaves, where the roof stops
  drift(9.9, 9.3, 0.5, 0.5, 0, 0.12);                                                         // the lean-to's corner
  drift(12.6, 22.42, 9.6, 0.6, 0, 0.16); drift(27.4, 22.42, 12.0, 0.6, 0, 0.16);              // OUTSIDE: the foot of the front wall, either side of the gateway
  drift(34.4, 12.0, 9.0, 0.6, HALF, 0.15);                                                    // OUTSIDE: the lee wall
  // OUTSIDE, the two windward walls (the whole west wall; the back wall either side of the kitchen's back door). They were BANKS, 0.5 m at the crest: a bank
  // stops feet, so neither wall had floor at its foot and a wall charge on either was refused 'no room at that wall.' end to end (the maintainer, 10-15: "still
  // seeing no room on this wall here"). As deep as a man wades, and no deeper: NO BANK LIES AT THE OUTSIDE FOOT OF A YARD WALL (pass-check's `feet` line).
  drift(5.36, 13.5, 16.4, 1.0, -HALF, 0.18);
  drift(14.6, 4.42, 17.0, 0.9, Math.PI, 0.18); drift(30.8, 4.44, 6.6, 0.86, Math.PI, 0.17);
  drift(27.2, 23.72, 1.9, 0.44, Math.PI + 0.22, 0.14); drift(30.9, 25.5, 1.9, 0.44, Math.PI - 0.18, 0.14);   // the barriers' windward side
  // sastrugi: long low ridges the wind has cut across the open snow, all on one bearing (out of the north-west)
  for (const [x, z, len, d, h] of [[24.2, 19.0, 2.4, 0.5, 0.07], [26.3, 17.2, 1.6, 0.4, 0.06], [22.9, 16.4, 2.0, 0.45, 0.08], [21.6, 13.6, 1.4, 0.36, 0.06], [15.4, 19.1, 1.6, 0.4, 0.07],
    [30.4, 19.8, 2.4, 0.5, 0.08], [25.4, 15.8, 1.4, 0.34, 0.06], [8.4, 10.6, 1.8, 0.4, 0.06],
    [3.2, 4.2, 3.0, 0.6, 0.09], [2.4, 12.8, 2.6, 0.5, 0.08], [3.4, 20.4, 2.2, 0.5, 0.07], [14.6, 1.6, 3.2, 0.6, 0.09], [20.4, 2.6, 2.0, 0.45, 0.07], [31.8, 1.4, 2.6, 0.5, 0.08],
    [37.2, 3.6, 2.4, 0.5, 0.08], [36.8, 9.8, 3.0, 0.55, 0.09], [37.4, 17.2, 2.2, 0.5, 0.07]] as const)
    add({ c: [x, h / 2, z], h: [len / 2, h / 2, d / 2], yaw: -0.62 + ((x * 3 + z) % 1) * 0.16, ...S.snow });

  // ---- lights: the moon; the lamp over the gate, the bulbs in the tea room, the kitchen, the store and the lean-to (the mains); and what burns its own fuel
  // — the brazier, two stoves, the bread oven, the lanterns. The bunk room and the bay have no bulb ----
  grp('lights');
  /** embers: a small warm light with a glowing box for its fixture (a shot puts it out), its own fuel */
  const glow = (name: string, group: string, box: { c: Vec3; h: Vec3 }, pos: Vec3, intensity: number, range: number) => {
    const fb = add({ ...box, ...M.rust, emissive: [11, 3.8, 0.9], flags: DECAL });
    lights.push({ kind: 'point', pos, dir: [0, -1, 0], color: [1.0, 0.5, 0.2], intensity, range, innerDeg: 0, outerDeg: 180, name, group, enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.06, mains: false });
  };
  G.bulb(15.0, 7.8, 'bulb_tea_a', 'tea'); G.bulb(19.4, 8.0, 'bulb_tea_b', 'tea');
  G.bulb(25.0, 8.3, 'bulb_kitchen', 'kitchen');
  G.bulb(31.0, 8.0, 'bulb_store', 'store', true, 14);
  G.bulb(7.9, 7.6, 'bulb_gen', 'leanto', true, 18);
  grp('stoves');
  G.stove(15.6, 7.2); glow('stove_tea', 'tea', { c: [15.6, 0.3, 7.42], h: [0.07, 0.05, 0.012] }, [15.6, 0.32, 7.55], 3.2, 4.5);                 // the tea room's stove (kept: its glow is a light)
  G.stove(30.6, 14.4); glow('stove_bunk', 'bunk', { c: [30.39, 0.3, 14.4], h: [0.012, 0.05, 0.07] }, [30.26, 0.32, 14.4], 3.0, 4.5);             // the bunk room's, its door toward the room's own door
  G.tandoor(22.75, 10.2); glow('oven_kitchen', 'kitchen', { c: [22.75, 0.552, 10.2], h: [0.16, 0.004, 0.16] }, [22.75, 0.7, 10.2], 2.4, 3.5);  // the bread oven's mouth
  G.drum(19.6, 13.6, 'rust'); glow('brazier', 'exterior', { c: [19.6, 0.884, 13.6], h: [0.19, 0.006, 0.19] }, [19.6, 1.05, 13.6], 9, 6.5);     // the brazier in front of the tea room: an oil drum of wood
  grp('lanterns');
  G.lantern(15.26, 11.42, 'lantern_door', 'exterior', 0.3);                                   // on the crate by the tea room's door
  G.lantern(12.6, 6.0, 'lantern_tea', 'tea');                                                 // on the floor in the tea room's far corner
  G.lantern(33.4, 11.5, 'lantern_bunk', 'bunk');                                              // on the floor inside the bunk room
  G.lantern(11.2, 14.1, 'lantern_bay', 'bay');                                                // on the floor at the mouth of the bay
  { add({ c: [20.88, 2.5, 22.0], h: [0.13, 0.015, 0.015], ...M.galv });                       // THE LAMP OVER THE GATE: an arm off the east post, a sodium head over the gateway
    const head = add({ c: [20.68, 2.44, 22.0], h: [0.12, 0.06, 0.12], ...M.plasticBlack, emissive: [30, 20, 9], flags: DECAL });
    lights.push({ kind: 'spot', pos: [20.66, 2.36, 22.0], dir: norm([-0.5, -0.86, 0]), color: [1.0, 0.72, 0.42], intensity: 70, range: 8, innerDeg: 36, outerDeg: 72,
      name: 'lamp_gate', group: 'exterior', enabled: true, volumetric: 0.15, fixtureBox: head, radius: 0.12, broad: true }); }
  // THE MOON IS TWO FIFTHS OF ANOTHER LEVEL'S (0.06 against 0.15): it is snowing, the sky is shut, and snow is the brightest ground paint in the game — at 0.15 a man on it
  // read 0.24 by the page's meter (which counts the moon; the headless one does not), over twice what 'dark' is on every other floor. At 0.06 moonlit snow sends the eye what
  // their moonlit dust does, and the starts read dark by both meters (0.11 at 0.08: over the line) (tools/qa/pass-check.ts, the light)
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.5, 0.68, 1.0], intensity: 0.06, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the mains, where a man can follow them: the generator in the lean-to, a flex slung to the range and one across the yard to the gate's lamp ----
  grp('mains');
  G.generator(7.5, 6.2, 0);
  G.wire(9.6, 7.0, 11.88, 7.0, 2.8); G.wire(8.6, 9.0, 8.6, 13.5, 2.8); G.wire(12.1, 20.3, 21.0, 22.0, 2.62);
  // ---- the breaker (the lean-to's back wall) and one emergency beacon: the game's blackout wants both ----
  grp('breaker');
  const brk = add({ c: [6.16, 1.35, 8.0], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [6.21, 1.62, 7.82], h: [0.01, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [17.6, H - 0.06, 8.6], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [17.6, H - 0.19, 8.6], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along an x-wall; π/2: +z along a z-wall; swing +1 opens toward +z / −x, −1 toward −z / +x).
  // Every id is its room's plain name ----
  const doors: LevelDoorDef[] = [
    // ANOTHER WAY IN (tools/qa/second-way-check.ts): a man wedges only a door that opens toward him, and only one on his squad's list ('tea', 'bunk').
    // 'back' opens OUT behind the range; 'pass' and 'store' open into the kitchen, 'inner' into the store. So with every yard door shut against the team it
    // still walks back → kitchen → tea room, and kitchen → store → bunk room, each door opened by hand from the side it is on.
    // The three yard doors author NO swing: the room rule deals each into its own room (what the lines above need), and the outward rule for outside doors
    // (DOORWAY.exitsOut, off as shipped) can turn them like any other level's — an authored inward side there is what `probes.ts oneway-deal` holds against.
    { name: 'tea', hinge: [16.42, 11.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'kitchen', hinge: [24.42, 11.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'back', hinge: [24.42, 5.0], closedDir: 0, width: 1.16, exterior: true, swing: -1 },
    { name: 'pass', hinge: [22.0, 6.02], closedDir: HALF, width: 1.16, swing: -1 },
    { name: 'store', hinge: [28.0, 7.62], closedDir: HALF, width: 1.16, swing: 1 },
    { name: 'inner', hinge: [31.42, 11.0], closedDir: 0, width: 1.16, swing: -1 },
    { name: 'bunk', hinge: [28.0, 13.02], closedDir: HALF, width: 1.16, exterior: true },
  ];
  for (const d of doors) doorFrame(d);

  extra.kept?.({ K, G, cap });

  // ---- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<kind><n>'; LAST, after every kept thing) ----
  // What each room is for, said by what stands in it: the TEA ROOM is rugs and floor cushions round the stove, low tables with the tea on them, the
  // samovar's table; the KITCHEN the bread oven, a work table, flour in sacks and the water cans; the STORE sacks to the beams, fuel drums and
  // crates under one dim bulb; the BUNK ROOM four cots, a tin trunk and a felt on the floor round its stove; the BAY the halt's pickup, a bench, tyres and a
  // motorbike on dry earth; the LEAN-TO the generator's fuel. Nothing stands within 1.1 m of a door's line, on a defender's mark or in his line.
  { const spans: [number, string][] = [];
    const room = (n: string) => { spans.push([K.props.length, n]); grp(`lived.${n}`); };
    room('tea');
    G.rug(14.6, 8.4, 3.0, 2.0, 'afghan'); G.rug(19.2, 8.3, 2.6, 1.8, 'baluch');
    G.lowTable(14.5, 8.6, 0.1); G.lowTable(19.2, 8.4, -0.15);
    G.toshak(17.2, 5.52, 1.9, 0); G.toshak(12.52, 8.6, 1.9, HALF, 'rugRed', 'rugOchre'); G.toshak(19.4, 6.4, 1.9, 0.0, 'rugNavy', 'rugRed');
    G.table(20.0, 5.55, 1.5, 0.7, 0, 'poplar');                                               // the samovar's table, against the back wall
    add({ c: [19.7, 0.93, 5.5], h: [0.11, 0.18, 0.11], ...M.tin }); add({ c: [19.7, 1.15, 5.5], h: [0.05, 0.04, 0.05], ...M.iron }); add({ c: [20.3, 0.78, 5.55], h: [0.2, 0.03, 0.14], ...M.tin });   // the samovar, a tray of glasses
    G.woodPile(14.0, 5.5, 0, 1.2);                                                            // wood for the stove
    G.gasBottle(18.7, 5.45);                                                                  // the samovar's gas
    G.plasticChair(12.9, 10.0, 2.4, 'plasticGreen'); G.plasticChair(21.3, 9.6, -2.2, 'plasticWhite');
    G.wallHanging('x', 5, 15.9, 1, 'afghan', 1.4, 0.9);
    room('kitchen');
    G.table(22.6, 8.95, 1.0, 0.7, HALF, 'ply');                                               // the work table
    add({ c: [22.55, 0.81, 8.7], h: [0.14, 0.06, 0.14], ...M.iron }); add({ c: [22.6, 0.78, 9.15], h: [0.2, 0.03, 0.14], ...M.poplar });   // a pot, the bread board
    G.table(27.3, 10.4, 0.9, 0.66, 0, 'tin');                                                 // the washing-up, under the window
    G.sacks(27.3, 5.75, 0, 3);                                                                // flour
    G.jerryCan(23.45, 10.62, 0.3, 'plasticBlue'); G.jerryCan(23.4, 10.2, -0.2, 'plasticBlue');
    room('store');
    G.sacks(29.0, 5.72, 0, 4); G.sacks(30.2, 5.72, 0, 3); G.sacks(31.4, 5.75, 0, 4);
    G.drum(33.4, 6.0, 'drumBlue'); G.drum(33.4, 6.7, 'rust', 0.3); G.drum(33.4, 7.4, 'drumRed', 0.1); G.drum(32.72, 5.62, 'olive', 0.5);
    G.crates(33.3, 9.0, HALF, 3); G.crates(29.0, 10.5, 0, 2, 'coyote');
    G.jerryCan(29.9, 10.55, 0.1); G.jerryCan(30.35, 10.5, -0.3, 'jerryYellow');
    room('bunk');
    G.rug(30.9, 13.1, 2.4, 1.6, 'felt');
    G.cot(33.3, 13.25, HALF); G.cot(33.3, 15.45, HALF, true, 'blanketBrown'); G.cot(32.0, 17.45, 0, false); G.cot(29.9, 17.45, 0);
    G.trunk(29.2, 11.5, 0, 'paintRust');
    G.plasticChair(31.4, 13.6, 0.6, 'plasticBlue');
    room('bay');
    G.pickup(9.0, 17.0, 0, 'truckTan');
    G.patch(10.4, 17.1, 1.3, 0.9, 'oil', 0.3);
    G.table(8.0, 14.1, 2.0, 0.7, 0, 'ply');                                                   // the bench
    add({ c: [7.5, 0.83, 14.1], h: [0.18, 0.08, 0.12], ...M.paintRust }); add({ c: [8.4, 0.77, 14.0], h: [0.25, 0.02, 0.05], ...M.iron });   // a tool box, a bar
    G.tyres(11.2, 19.7, 3); G.drums(6.75, 19.55, 2);
    G.motorbike(9.6, 19.7, 0.15);
    G.jerryCan(7.9, 19.6, 0.2);
    room('leanto');
    G.drums(8.6, 5.7, 2); G.jerryCan(6.6, 7.2, 0.4, 'jerryYellow'); G.patch(7.6, 6.9, 1.2, 0.8, 'oil', -0.2);
    spans.push([K.props.length, '']);
    const serial = new Map<string, number>();
    for (let s = 0; s + 1 < spans.length; s++) for (let i = spans[s][0]; i < spans[s + 1][0]; i++) { const key = `lived.${spans[s][1]}.${K.props[i].kind}`, n = serial.get(key) ?? 0; serial.set(key, n + 1); K.props[i].name = `${key}${n}`; }
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [6.3, 1.35, 8.0], boxes: [brk, brkLed] },
    beacons: [{ pos: [17.6, H - 0.3, 8.6], box: dome }],
    playerSpawn: extra.spawn ?? PASS_ROAD,
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the room clear brings its own cast
    sky: { zenith: [0.012, 0.02, 0.042], horizon: [0.04, 0.05, 0.075] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still): the store, a point on its back wall, the tea room's door
    mission: { serverRoom: { ...STORE }, entryDoor: 'store', rack: { index: 0, front: [32.4, 1.0, 5.6], halfW: 0.3 }, exfilDoor: 'tea', exfilX: 17.25, exfilZ: 11.6, exfilOut: [0, 1] },
  };
  // ---- what is underfoot (game/floor.ts; the six it has): fresh snow is 'grass' (the soft, quiet one); the road, the trodden paths, cleared earth and the
  // dry earth under the bay's roof are 'asphalt' (the nearest the six have to hard ground); the rooms' beaten earth and slab are 'stone', the rugs 'carpet'.
  // First match wins: rugs, rooms, then the yard's hard patches (pushed as they were laid above)
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'grass', outside: 'grass', verge: 'grass',
    zones: [
      { id: 'tea_rug_a', mat: 'carpet', x0: 13.1, z0: 7.4, x1: 16.1, z1: 9.4 }, { id: 'tea_rug_b', mat: 'carpet', x0: 17.9, z0: 7.4, x1: 20.5, z1: 9.2 },
      { id: 'bunk_felt', mat: 'carpet', x0: 29.7, z0: 12.3, x1: 32.1, z1: 13.9 },
      { id: 'range', mat: 'stone', x0: 12, z0: 5, x1: 34, z1: 11 }, { id: 'bunk', mat: 'stone', x0: 28, z0: 11, x1: 34, z1: 18 },
      { id: 'bay', mat: 'asphalt', x0: 5.9, z0: 13.4, x1: 12.1, z1: 20.6 }, { id: 'leanto', mat: 'stone', x0: 5.9, z0: 4.9, x1: 9.6, z1: 9.1 },
      { id: 'road', mat: 'asphalt', x0: 0, z0: 23.3, x1: 40, z1: 26.7 },
      ...zones,
    ],
  };
  return { level, scenarios: extra.scenarios ?? PASS_SCENARIOS, groups: trace.groups, surfaces };
}
