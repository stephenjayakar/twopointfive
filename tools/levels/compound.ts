// THE COMPOUND — a walled compound for the four squad, in the Door Kickers mould: a perimeter wall with three ways through it, yard on every side of a main
// house of eight rooms off one corridor, and three outbuildings (a garage, a shed, a guard hut) the yard has to be crossed past. Eight held rooms, twenty-four
// leaves, four squads of defenders.
// A level generator in the scenario levels' shape (tools/levels/block.ts is what it was cut from; rebuild/scenario-levels/contract.md the how-to):
//   bun run map:export compound     → levels/compound.json, with its `scenarios.roomClear` block (rooms + squads) and its footstep `surfaces`
//   bun run map:check compound      → the kit's one check (validator, lint, structure, squads, nav from every way in, footsteps, start card, seeded runs)
//   page: ?levelFile=compound.json&roomclear&squad4     (the start card's row 'The compound')
//
// What it is for (the enemy-squads goal: "trying some door kickers like maps", "cover all flanks methodically and break down a structure room by room … door
// charges, flashbangs, and external clearance"):
//   · THE WALL has three ways through. The MAIN GATE on the south (3 m, no leaf) is the obvious one: under the one lamp that is lit, with the guard hut a stride
//     inside it and the house's front door across the forecourt. The WEST GATE and the NORTH GATE are a leaf each, in the dark. The team starts OUTSIDE the
//     south-west corner, nearer the west gate, with the outside strip walkable all the way round: which gate, and whether the pairs split, is the first decision.
//   · THE YARD is ground to cross, in four pieces: the FORECOURT (south: main gate, hut, front door, the garage's east door), the WEST YARD (west gate, the shed,
//     the garage's north door, the sala's west door; a cistern and a low wall to kneel behind), the BACK STRIP (2.5 m, dark: north gate, the shed's east door, the
//     pantry's back door, the kitchen's window) and the EAST ALLEY (3 m, dark: the back bedroom's window; it ends at the hut's east door). A yard wall with a gate
//     leaf (yard_sw) joins forecourt and west yard; the hut's wall shuts the forecourt off the alley. So the house can be walked round — through leaves — and a
//     man who leaves an outbuilding can come across the yard behind a team working a door.
//   · THE HOUSE (20 × 12.5 m): four rooms north of a 3 m corridor, four south of it. THREE outside doors — front into the hall, the sala's west door, the back
//     door into the pantry (nobody holds the hall or the pantry: each is a foothold with two inner doors) — and TWO unglazed window openings on the dark sides
//     (the kitchen north, the back bedroom east): a round and a look pass through them, a man does not — external clearance. No held room has a window onto the
//     two approach yards (tried: a man at the sala's window shot the team at the gate, eleven metres off, before a door was touched). FOUR LOOPS inside:
//     corridor → kitchen → pantry → corridor, corridor → bunk room → back bedroom → corridor, corridor → office → spare room → corridor, corridor → sala →
//     hall → corridor. Small rooms (the pantry 3 × 5, the hall 3 × 4.3) and two big ones (the sala 8 × 4.3, the garage 6.3 × 5.8).
//   · FOUR SQUADS, ELEVEN MEN (scenarios.roomClear.squads — scene/scenarios.ts SquadData, rebuild/enemy-squads/squad-format.md): YARD = the shed (FOUR men:
//     the guard room) and the garage (one: the bait) — five in two rooms, so the one squad with men to spare, and all four of the shed cross the yard to the
//     garage when it is hit; GATE = the hut's one man, who stays at his gate (mayLeave false); WEST = the kitchen and the sala, one a room, nobody to spare;
//     KEEP = the office, the bunk room and the back bedroom, who do not leave (mayLeave false) and may wedge only their corridor doors. Yard 5, gate 1, west 2,
//     keep 3.
//   · PLACED BY HAND (the authored-levels goal: one problem, the same on every try — placement seed 0 / attempt 1 = each room's first `garrison` marks in file
//     order, so the ORDER of a room's marks below is the placement). THE PROBLEM: two lit outbuildings face each other across the dark yard the team must
//     cross; the near one (the garage) is bait and the far one (the shed) is the guard room, and whichever door is stacked on has the other at its back.
//     TALLIED (tools/qa/plan-fights.ts: a scripted commander on the shipped headless stand, hard, placement 0, 24 seeds; taken · teammates up of 96) —
//     THE OBVIOUS PLAN, the garage first (the near door from the west gate): 11 · 19: the garage falls for nothing and the shed's four arrive by the west yard
//     and the forecourt door. The sala's west door first: 17 · 36 (the garage's man on the forecourt, behind the stack). ANSWER A, the shed first with a
//     stun canister through its back-strip door: 21 · 62 (with no canisters, 12 seeds: 3 · 4 of 48). ANSWER B, the north gate, the BREAKER in the pantry and
//     goggles, then the shed from the strip: 23 · 68 (the same without the breaker 22 · 43). The yard's rooms and the house's west end are on the mains; the
//     KEEP's three rooms are NOT (`mains: false` on their panels: with them dark the office's man shot first into a lit doorway and the breaker cost men).
//     The rooms are listed HOUSE FIRST (the way-1 objective marker stands on the first uncleared room in file order: it must not point at the answer).
//     WHAT IS READABLE FROM EITHER GATE: every held room has its light on (the pantry and the spare room, dark, are empty; the corridor and the front hall
//     are lit and walked through, not held); the kitchen's one man watches the pantry door, his back to the window.
//
//              x 4      9.5   13        18.5 21.5       27          33  36
//          z 4 +--------+-----------------------[gate_n]--------------+
//              | shed   se      back strip (dark)                     |
//          8.5 +--ss----+   +---[ww]--+-pb-+--------+----------+      |
//              |            | kitchen kp pan| bunk  ab  back   [w]    |
//              |  cistern   |         |try  | room  | bedroom  | east |
//         11.5 |            +---ks----+-ps--+--as---+------bs--+ alley|
//              |  west    ‖ |        c o r r i d o r           |(dark)|
//      gate_w ==  yard    ‖ +-sn------+-hn--+---on---+----cn---+      |
//    TEAM      |           sw  sala   se hall| office oc spare |      |
//      ▴    18 +---gn---+   |         |     |        |  room  |      |
//         18.5 |        +ysw+---------+front+--------+----+---+      |
//              | garage ge       forecourt                |   |      |
//              |  (car) |   (pickup)          lamp ☼      hw hut he   |
//         z 24 +--------+----------------------[ main gate ]+---+-----+
//                                                 (x 22..25)
//
// HOW IT WAS TUNED (the scripted four, Standard, 16 seeds a layout — tools/qa/playthrough.ts; the record and the 144-seed tallies are in
// rebuild/enemy-squads/map-compound.md): the first layout (team at the main gate, an open garage bay, a hall open to the corridor, a door on the corridor's east
// end, windows on the sala and the office) left 2 men in 10 standing: two thirds of the defenders run at the first bang, and in open ground they arrive from
// every side at once. What moved it: the team start by the dark gate (the outbuildings fall first, the house is met from one end), doors instead of open mouths
// onto the forecourt, no window onto an approach, the back door into a room nobody holds — and the squads a yard apart, so a team that keeps moving meets
// them one at a time.
//
// LIMITS IT IS BUILT INSIDE (not lifted here): the world is 40 × 28 m (scene/world.ts — the trace grid, the nav grid and the shaders' bounds), so the wall
// stands on the office's own shell line (x 4 / 36, z 4 / 24) and the 4 m outside it is the team's approach. weather.ts INTERIOR is that same rectangle: it
// rains OUTSIDE the wall and not in the yard, nobody gets wet in it, and the storm's wind stops at the wall. weather.ts ANNEX (x 1.1..4, z 9.33..12.87: the
// office's stair tower) is a dry patch on the grass outside the west wall; the west gate is cut south of it. destruction.ts takes the same rectangle for
// "indoors": at chaos above 0 a burst in the YARD can drop a ceiling tile out of the sky and raise drywall dust (the room clear's own chaos setting decides
// whether that is ever seen). The light list holds 64 with every man's torch in it: the level keeps to a handful of fixtures. With eleven defenders, five of
// the team and Sam the light probe is asked for more queries a frame than it answers (49 against 32: Sam's own meter is the one dropped) and only the first 8
// characters cast shadow proxies — both are the enemy-count ceiling's to lift, not a map's.
// Only the old demo's kit (src/scene/officeGen.ts officeKit). Units: meters. +X east, +Z south, +Y up.
// NOT SEEN DRAWN: laid out on paper and checked headless (validator, level-lint, the scenario probes, scripted play-throughs); nobody has looked at it on a GPU.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { SurfacesData } from '../../src/scene/levelData';
import type { KitViewData, LevelScenarios, PlacesData, Rect, StructureData } from '../../src/scene/scenarios';
import { officeKit, normalize3, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import * as MD from '../../src/scene/markingDefaults';
import { WORLD } from '../../src/scene/world';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import { livedKit } from './livedKit';

export const NAME = 'compound';
export const NOTES = 'The compound: a perimeter wall with a lit main gate and two dark side gates, yard all round a main house of eight rooms off one corridor (three outside doors, two open windows, four loops inside), and a garage, a shed and a guard hut across the yard. Eight held rooms, four squads. For the four man squad, who start outside the wall. One floor, box geometry only, the office\'s kit. Regenerate: bun run map:export compound';

/** the men in each held room: eleven, the most a room clear stages (scene/scenarios.ts SQUAD_MAX_MEN) */
export const GARRISON: Record<string, number> = {
  shed: 4, garage: 1, hut: 1,        // YARD: the shed 4 + the garage 1 (the guard room and the bait). The hut's one man is a squad of his own, GATE: he stays
  kitchen: 1, sala: 1,               // WEST: 2, one a room, nobody to spare
  office: 1, bunk: 1, back: 1,       // KEEP: 3, off the mains
};

/** The spaces: the floor inside each one's walls. Typed once, here: the roomClear block's bounds and the mission's room are spread from it. (House and outbuilding shells are 0.24 thick, partitions 0.12.) */
export const COMPOUND_ROOMS: Record<'kitchen' | 'pantry' | 'bunk' | 'back' | 'corridor' | 'sala' | 'hall' | 'office' | 'spare' | 'shed' | 'garage' | 'hut', Rect> = {
  kitchen: { x0: 13.12, x1: 18.44, z0: 6.62, z1: 11.44 },
  pantry: { x0: 18.56, x1: 21.44, z0: 6.62, z1: 11.44 },
  bunk: { x0: 21.56, x1: 26.94, z0: 6.62, z1: 11.44 },
  back: { x0: 27.06, x1: 32.88, z0: 6.62, z1: 11.44 },
  corridor: { x0: 13.12, x1: 32.88, z0: 11.56, z1: 14.44 },
  sala: { x0: 13.12, x1: 20.94, z0: 14.56, z1: 18.88 },
  hall: { x0: 21.06, x1: 23.94, z0: 14.56, z1: 18.88 },
  office: { x0: 24.06, x1: 28.44, z0: 14.56, z1: 18.88 },
  spare: { x0: 28.56, x1: 32.88, z0: 14.56, z1: 18.88 },
  shed: { x0: 4.12, x1: 9.38, z0: 4.12, z1: 8.38 },
  garage: { x0: 4.12, x1: 10.38, z0: 18.12, z1: 23.88 },
  hut: { x0: 26.12, x1: 30.38, z0: 21.12, z1: 23.88 },
};

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest). This is the start page's first mission, so its
 *  picture is the first one a player sees. THE WEST GATE is the level's own: the leaf in the mud wall, the stack along the wall north of it, and behind the
 *  wall the west yard — the garden's rows and the cistern. THE NORTH GATE is a bespoke set, and a near copy: on the level the strip behind that gate is 2.26 m
 *  to the house's back wall, 1.92 m of it floor, and a can thrown through the gate wants 2 m (kitViewPlan's `inside`). The set is that gate with the house's
 *  wall stood half a metre further back: the wall, the blue frame, the house's back wall with its rooms behind it, their lights on (every held room's is).
 *  The strip's washing line and cans, and the rooms' beds, are stood where the picture's camera sees them over a 3 m wall, not at its foot. Its boxes name their paint 'look|plain': the first the file's
 *  palette holds, so this one block serves the look file too. */
const COMPOUND_KITVIEW: KitViewData = {
  sets: { north: { ref: [24.25, 2],
    doors: [{ id: 'cn_gate', hinge: [23.82, 4], closedDir: 0, width: 0.86, exterior: true }],
    boxes: [
    { id: 'cn_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'dirt|asphalt' },
    { id: 'cn_scrub', c: [20, 0.004, 1.6], h: [20, 0.004, 1.6], material: 'dirt|grass', flags: ['NoShadow'] },
    { id: 'cn_wall_w', c: [13.84, 1.5, 4], h: [9.96, 1.5, 0.12], material: 'mud|concrete' },
    { id: 'cn_wall_head', c: [24.25, 2.52, 4], h: [0.45, 0.48, 0.12], material: 'mud|concrete' },
    { id: 'cn_wall_e', c: [30.41, 1.5, 4], h: [5.71, 1.5, 0.12], material: 'mud|concrete' },
    { id: 'cn_wall_end', c: [36, 1.5, 9], h: [0.12, 1.5, 5], material: 'mud|concrete' },
    { id: 'cn_foot_w', c: [13.84, 0.25, 3.879], h: [9.96, 0.25, 0.001], material: 'mudDark|concrete', flags: ['NoShadow'] },
    { id: 'cn_foot_e', c: [30.41, 0.26, 3.879], h: [5.71, 0.26, 0.001], material: 'mudDark|concrete', flags: ['NoShadow'] },
    { id: 'cn_jamb_w', group: 'cn.gate', c: [23.79, 1.02, 4], h: [0.03, 1.02, 0.13], material: 'paintBlue|metal' },
    { id: 'cn_jamb_e', group: 'cn.gate', c: [24.71, 1.02, 4], h: [0.03, 1.02, 0.13], material: 'paintBlue|metal' },
    { id: 'cn_head', group: 'cn.gate', c: [24.25, 2.06, 4], h: [0.49, 0.05, 0.13], material: 'paintBlue|metal' },
    // the ground a gate wears: trodden earth either side of the sill, and the damp where the cans are filled (the look's; on the plain file they are the ground's
    // own paint, so the two that cross the scrub's edge at z 3.2 are cut there: grass on the scrub, asphalt on the strip at the wall's foot)
    { id: 'cn_worn_out', c: [24.25, 0.011, 2.915], h: [0.65, 0.001, 0.285], material: 'mudFloor|grass', flags: ['NoShadow'] },
    { id: 'cn_worn_sill', c: [24.25, 0.011, 3.565], h: [0.65, 0.001, 0.365], material: 'mudFloor|asphalt', flags: ['NoShadow'] },
    { id: 'cn_worn_in', c: [24.25, 0.011, 5.475], h: [0.65, 0.001, 1.405], material: 'mudFloor|asphalt', flags: ['NoShadow'] },
    { id: 'cn_damp_a', c: [23.24, 0.012, 2.89], h: [1.26, 0.001, 0.31], material: 'damp|grass', flags: ['NoShadow'] },
    { id: 'cn_damp_sill', c: [23.24, 0.012, 3.36], h: [1.26, 0.001, 0.16], material: 'damp|asphalt', flags: ['NoShadow'] },
    { id: 'cn_damp_b', c: [23.24, 0.012, 2.5], h: [0.88, 0.001, 0.35], material: 'damp|grass', flags: ['NoShadow'] },
    // the strip's own things (lived.backstrip): the washing line on its two poles, the water cans, a crate — each stood where the picture's camera sees it
    // over the 3 m wall (the floor shows from 1.3 m behind the wall's inside face; on the level they are at the wall's foot, out of its sight)
    { id: 'cn_pole_a', group: 'cn.line', c: [26.4, 0.88, 5.3], h: [0.03, 0.88, 0.03], material: 'poplar|wood' },
    { id: 'cn_pole_b', group: 'cn.line', c: [28.7, 0.88, 5.3], h: [0.03, 0.88, 0.03], material: 'poplar|wood' },
    { id: 'cn_line', group: 'cn.line', c: [27.55, 1.69, 5.3], h: [1.15, 0.01, 0.005], albedo: [0.3, 0.2, 0.13], flags: ['NoShadow'] },
    { id: 'cn_wash_a', group: 'cn.line', c: [26.87, 1.24, 5.3], h: [0.3, 0.44, 0.02], albedo: [0.78, 0.72, 0.58], flags: ['NoShadow'] },
    { id: 'cn_wash_b', group: 'cn.line', c: [27.47, 1.34, 5.3], h: [0.2, 0.34, 0.02], albedo: [0.14, 0.2, 0.45], flags: ['NoShadow'] },
    { id: 'cn_wash_c', group: 'cn.line', c: [27.97, 1.19, 5.3], h: [0.2, 0.49, 0.02], albedo: [0.72, 0.36, 0.1], flags: ['NoShadow'] },
    { id: 'cn_cans', c: [26.1, 0.42, 6.6], h: [0.23, 0.42, 0.1], albedo: [0.12, 0.25, 0.5] },
    { id: 'cn_crate', c: [29.5, 0.16, 6.5], h: [0.45, 0.16, 0.24], albedo: [0.56, 0.28, 0.12] },
    // the house's back: its north wall (half a metre further off than the level's), the rooms behind it under their own panels, their things along the
    // far wall (what stands against the near one is behind it from here)
    { id: 'cn_house', c: [23.06, 1.5, 7], h: [10.06, 1.5, 0.12], material: 'mud|partTan' },
    { id: 'cn_house_end', c: [33, 1.5, 9.6], h: [0.12, 1.5, 2.48], material: 'mud|partTan' },
    { id: 'cn_house_back', c: [23.06, 1.5, 12.14], h: [10.06, 1.5, 0.06], material: 'whitewash|wall' },
    { id: 'cn_part_a', c: [21.5, 1.5, 9.6], h: [0.06, 1.5, 2.48], material: 'whitewash|wall' },
    { id: 'cn_part_b', c: [27, 1.5, 9.6], h: [0.06, 1.5, 2.48], material: 'whitewash|wall' },
    { id: 'cn_floor', c: [23.06, 0.003, 9.6], h: [9.94, 0.003, 2.48], material: 'mudFloor|lino' },
    { id: 'cn_ceiling', c: [23.06, 3.1, 9.6], h: [10.16, 0.1, 2.7], material: 'ceiling', flags: ['NoPrimary'] },
    { id: 'cn_panel_west', c: [17, 2.98, 9.7], h: [0.6, 0.02, 0.3], material: 'white', emissive: [7, 6.2, 5], flags: ['NoPrimary'] },
    { id: 'cn_panel_bunk', c: [24.2, 2.98, 9.9], h: [0.6, 0.02, 0.3], material: 'white', emissive: [7, 6.2, 5], flags: ['NoPrimary'] },
    { id: 'cn_panel_back', c: [30, 2.98, 9.7], h: [0.6, 0.02, 0.3], material: 'white', emissive: [7, 6.2, 5], flags: ['NoPrimary'] },
    { id: 'cn_cot_a', group: 'cn.bunk', c: [22.7, 0.2, 11.62], h: [0.95, 0.2, 0.42], material: 'paintBlue|metal' },
    { id: 'cn_rug_a', group: 'cn.bunk', c: [22.7, 0.44, 11.62], h: [0.93, 0.04, 0.4], albedo: [0.27, 0.18, 0.12] },
    { id: 'cn_cot_b', group: 'cn.bunk', c: [25.2, 0.2, 11.62], h: [0.95, 0.2, 0.42], material: 'paintBlue|metal' },
    { id: 'cn_rug_b', group: 'cn.bunk', c: [25.2, 0.44, 11.62], h: [0.93, 0.04, 0.4], albedo: [0.4, 0.31, 0.2] },
    { id: 'cn_desk', group: 'cn.back', c: [28.6, 0.73, 11.64], h: [0.8, 0.03, 0.4], material: 'poplar|wood' },
    { id: 'cn_desk_leg_a', group: 'cn.back', c: [27.83, 0.36, 11.64], h: [0.03, 0.36, 0.38], material: 'poplar|wood' },
    { id: 'cn_desk_leg_b', group: 'cn.back', c: [29.37, 0.36, 11.64], h: [0.03, 0.36, 0.38], material: 'poplar|wood' },
    { id: 'cn_bed', group: 'cn.back', c: [31.6, 0.25, 11.24], h: [1, 0.25, 0.8], albedo: [0.33, 0.29, 0.23] },
    { id: 'cn_bed_cover', group: 'cn.back', c: [31.6, 0.54, 11.24], h: [0.98, 0.04, 0.78], albedo: [0.34, 0.12, 0.1] },
    { id: 'cn_mat', group: 'cn.back', c: [30, 0.02, 9.9], h: [1.2, 0.01, 0.8], albedo: [0.3, 0.1, 0.09], flags: ['NoShadow'] },
    // a bulkhead lamp on the house's back wall over the washing line (the level's own lamp on this strip is out). Hung under the perimeter wall's top, so
    // none of it reaches the team outside: the strip is lit, the stack stays under the gate's lamp
    { id: 'cn_lamp_box', c: [27.6, 2.56, 6.82], h: [0.13, 0.05, 0.06], material: 'metal', emissive: [40, 24, 7], flags: ['NoShadow'] },
  ],
    lights: [{ id: 'cn_lamp', kind: 'spot', pos: [27.6, 2.45, 6.7], dir: [-0.1, -1, -0.45], color: [1, 0.62, 0.22], intensity: 40, range: 8, innerDeg: 36, outerDeg: 72, group: 'cn', enabled: true, volumetric: 0.12, radius: 0.12, mains: false, broad: true, fixture: 'cn_lamp_box' }] } },
  ways: [
    { door: 'gate_w', roomLights: 1 },   // (the rooms' own lights left on, as on the set: the garage and the house past the yard are lit rooms, not black ones)
    { door: 'cn_gate', set: 'north', pane: false },
  ] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE as Record<string, Vec3>, H = WORLD.ceilingY, R = COMPOUND_ROOMS;
  const { TX, mk, grp, add, slab, wallX, wallZ, desk, monitor, chair, cardboardBox, rug, bin, cabinet, papers, bench, shelf, plant, car, ceilingPanel, doorFrame, lights, switchables } = K;
  /** a pallet of crates: a static block a man can kneel behind (1.0 m) */
  function pallet(x: number, z: number, w: number, d: number, yaw = 0) {
    add({ c: [x, 0.06, z], h: [w / 2, 0.06, d / 2], yaw, albedo: C.woodDark });
    add({ c: [x, 0.56, z], h: [w / 2 - 0.04, 0.44, d / 2 - 0.04], yaw, albedo: C.cardboard, ...mk(MD.cartonMarks([w / 2 - 0.04, 0.44, d / 2 - 0.04], TX)) });
  }
  /** a steel locker, 2 m: doors on both faces */
  const locker = (x: number, z: number, alongX: boolean) => { const h: Vec3 = alongX ? [0.49, 1.0, 0.3] : [0.3, 1.0, 0.49];
    add({ c: [x, 1.0, z], h, albedo: [0.33, 0.36, 0.38], rough: 0.5, ...mk(alongX ? [...MD.cupboardMarks(h, '+z', 2, TX), ...MD.cupboardMarks(h, '-z', 2, TX)] : [...MD.cupboardMarks(h, '+x', 2, TX), ...MD.cupboardMarks(h, '-x', 2, TX)]) }); };
  /** a table (0.75 m) with nothing under it but two legs */
  const table = (x: number, z: number) => { add({ c: [x, 0.72, z], h: [0.8, 0.03, 0.4], albedo: C.woodDark }); for (const sx of [-0.6, 0.6]) add({ c: [x + sx, 0.35, z], h: [0.04, 0.35, 0.3], albedo: C.metal }); };
  /** a cot: a low frame and a blanket, 1.9 × 0.84 */
  const cot = (x: number, z: number, alongX: boolean, blanket: Vec3 = [0.2, 0.24, 0.18]) => {
    add({ c: [x, 0.2, z], h: alongX ? [0.95, 0.2, 0.42] : [0.42, 0.2, 0.95], albedo: C.metal });
    add({ c: [x, 0.44, z], h: alongX ? [0.93, 0.04, 0.4] : [0.4, 0.04, 0.93], albedo: blanket });
  };
  const DIRT: Vec3 = [0.2, 0.17, 0.13], STUCCO = C.partTan;

  // ---------------- ground ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);                                              // the whole world's ground: every ray and every foot lands on something
  slab(0, 0, 0, 40, 0.01, 3.2, C.grass, { flags: BoxFlag.NoShadow });                   // scrub outside the north and west walls
  slab(0, 0, 3.2, 3.2, 0.01, 28, C.grass, { flags: BoxFlag.NoShadow });
  grp('floors');
  const floor = (x0: number, z0: number, x1: number, z1: number, alb: Vec3, extra: Partial<Box> = {}) => slab(x0, 0, z0, x1, 0.004, z1, alb, extra);
  const polished = { flags: BoxFlag.Gloss };
  slab(4, -0.1, 4, 36, 0.001, 24, DIRT);                                                // the yard: packed earth, wall to wall (thin top at y=0)
  floor(13, 6.5, 33, 19, C.lino, polished);                                             // the house: one tiled floor
  floor(4, 18, 10.5, 24, C.concrete); floor(4, 4, 9.5, 8.5, C.concrete); floor(26, 21, 30.5, 24, C.concrete);   // the garage, the shed, the hut: bare slabs

  // ---------------- roofs (light-only: the camera looks through them, as through the office's ceiling) ----------------
  grp('ceiling');
  const roof = { flags: BoxFlag.NoPrimary };
  slab(12.9, H, 6.4, 33.1, H + 0.2, 19.1, C.ceiling, roof);       // the house
  slab(3.9, H, 17.9, 10.6, H + 0.2, 24.1, C.ceiling, roof);       // the garage
  slab(3.9, H, 3.9, 9.6, H + 0.2, 8.6, C.ceiling, roof);          // the shed
  slab(25.9, H, 20.9, 30.6, H + 0.2, 24.1, C.ceiling, roof);      // the hut

  // ---------------- the perimeter wall (t=0.24, 3 m: nobody sees or shoots over it) ----------------
  // (every doorway on this level is 1.2 m wide and cut 0.2 m before a whole or a half metre: the nav grid's half-metre cells then have a free one in it)
  grp('walls.perimeter');
  const ext = C.concrete;
  wallX(4, 3.88, 36.12, 0.24, ext, [{ a: 23.8, b: 25.0, y0: 0, y1: 2.2 }]);             // north: the north gate, behind the bunk room
  wallX(24, 3.88, 36.12, 0.24, ext, [{ a: 22, b: 25, y0: 0, y1: H }]);                  // south: the main gate, 3 m, open to the sky
  wallZ(4, 4, 24, 0.24, ext, [{ a: 14.3, b: 15.5, y0: 0, y1: 2.2 }]);                   // west: the west gate, between the shed and the garage (south of weather.ts ANNEX, z 9.33..12.87 outside this wall: the office's stair tower, which the storm treats as roofed)
  wallZ(36, 4, 24, 0.24, ext);                                                          // east: blind
  // the main gate's two iron leaves, swung OUT and left open: a sheet of cover on each side of the gap for whoever comes up to it from outside
  add({ c: [21.9, 1.05, 24.87], h: [0.03, 1.05, 0.75], albedo: [0.14, 0.15, 0.16], rough: 0.4, metal: true });
  add({ c: [25.1, 1.05, 24.87], h: [0.03, 1.05, 0.75], albedo: [0.14, 0.15, 0.16], rough: 0.4, metal: true });

  // ---------------- the house's shell (t=0.24) ----------------
  grp('walls.house');
  // north z=6.5: the kitchen's window (x 15.2..17.2), the back door into the pantry (x 19.3..20.5)
  wallX(6.5, 12.88, 33.12, 0.24, STUCCO, [{ a: 15.2, b: 17.2, y0: 1.0, y1: 2.2 }, { a: 19.3, b: 20.5, y0: 0, y1: 2.2 }]);
  // south z=19: the front door into the hall (x 21.8..23) and nothing else: no room looks onto the forecourt
  wallX(19, 12.88, 33.12, 0.24, STUCCO, [{ a: 21.8, b: 23.0, y0: 0, y1: 2.2 }]);
  // west x=13: the sala's west door (z 15.8..17)
  wallZ(13, 6.5, 19, 0.24, STUCCO, [{ a: 15.8, b: 17.0, y0: 0, y1: 2.2 }]);
  // east x=33: the back bedroom's window (z 7.8..9.4); the corridor ends blind
  wallZ(33, 6.5, 19, 0.24, STUCCO, [{ a: 7.8, b: 9.4, y0: 0.9, y1: 2.2 }]);

  // ---------------- the house's partitions (t=0.12), all solid ----------------
  grp('walls.interior');
  const iw = C.wall;
  // the corridor's north wall z=11.5: kitchen (x 15.8..17), pantry (x 19.3..20.5), bunk room (x 22.8..24), back bedroom (x 30.8..32)
  wallX(11.5, 13.12, 32.88, 0.12, iw, [{ a: 15.8, b: 17.0 }, { a: 19.3, b: 20.5 }, { a: 22.8, b: 24.0 }, { a: 30.8, b: 32.0 }]);
  // the corridor's south wall z=14.5: sala (x 14.8..16), hall (x 21.8..23), office (x 25.8..27), spare room (x 30.3..31.5)
  wallX(14.5, 13.12, 32.88, 0.12, iw, [{ a: 14.8, b: 16.0 }, { a: 21.8, b: 23.0 }, { a: 25.8, b: 27.0 }, { a: 30.3, b: 31.5 }]);
  wallZ(18.5, 6.62, 11.44, 0.12, iw, [{ a: 8.3, b: 9.5 }]);       // kitchen | pantry, with the connecting door
  wallZ(21.5, 6.62, 11.44, 0.12, iw);                             // pantry | bunk room
  wallZ(27, 6.62, 11.44, 0.12, iw, [{ a: 8.3, b: 9.5 }]);         // bunk room | back bedroom, with the connecting door
  wallZ(21, 14.56, 18.88, 0.12, iw, [{ a: 15.8, b: 17.0 }]);      // sala | hall, with the door
  wallZ(24, 14.56, 18.88, 0.12, iw);                              // hall | office
  wallZ(28.5, 14.56, 18.88, 0.12, iw, [{ a: 15.8, b: 17.0 }]);    // office | spare room, with the connecting door

  // ---------------- the outbuildings' own walls (t=0.24; their other sides are the perimeter wall) ----------------
  grp('walls.outbuildings');
  wallX(8.5, 4.12, 9.62, 0.24, ext, [{ a: 6.8, b: 8.0, y0: 0, y1: 2.2 }]);              // the shed's south wall and its yard door
  wallZ(9.5, 4.12, 8.5, 0.24, ext, [{ a: 5.3, b: 6.5, y0: 0, y1: 2.2 }]);               // … its east wall and the door onto the back strip
  wallX(18, 4.12, 10.62, 0.24, ext, [{ a: 6.8, b: 8.0, y0: 0, y1: 2.2 }]);              // the garage's north wall and its side door
  wallZ(10.5, 18, 23.88, 0.24, ext, [{ a: 19.8, b: 21.0, y0: 0, y1: 2.2 }]);            // … its east wall and the door onto the forecourt (the roller door beside it is down)
  wallX(18.5, 10.62, 12.88, 0.24, ext, [{ a: 11.3, b: 12.5, y0: 0, y1: 2.2 }]);         // the yard wall between the garage and the house, and its gate: forecourt ↔ west yard
  wallX(21, 25.88, 30.62, 0.24, ext);                                                   // the hut's north wall
  wallZ(26, 21, 23.88, 0.24, ext, [{ a: 21.8, b: 23.0, y0: 0, y1: 2.2 }]);              // … its west wall and the door onto the gate
  wallZ(30.5, 19.12, 23.88, 0.24, ext, [{ a: 21.8, b: 23.0, y0: 0, y1: 2.2 }]);            // … its east wall, run up to the house, and the door into the east alley

  // ---------------- the yard ----------------
  grp('yard');
  car(15.0, 22.98, 0, [0.24, 0.27, 0.24]);                                            // a pickup parked against the south wall, between the garage and the gate
  add({ c: [8.6, 0.7, 12.4], h: [0.8, 0.7, 0.8], albedo: C.concrete });                 // the cistern, in the middle of the west yard (1.4 m: a man kneels behind it)
  add({ c: [8.6, 1.43, 12.4], h: [0.84, 0.03, 0.84], albedo: [0.3, 0.3, 0.32] });
  add({ c: [11.3, 0.5, 13.4], h: [0.15, 0.5, 1.5], albedo: STUCCO });                   // a low wall off the house's west side, short of the sala's door
  pallet(35.2, 16.6, 1.0, 1.2); pallet(33.4, 22.8, 1.2, 1.0);
  bin(17.7, 6.05); bin(12.3, 8.2); cardboardBox(31.2, 20.2, 0.55, 0.3);                 // loose things under the kitchen's window, by the shed's side, at the alley's end
  // (LOOSE THINGS — bins, cartons, chairs a man can shove — stand a leaf's length clear of every door on this level and out of the corridor: walking men
  //  bulldoze them along a wall, and one that ends up in a doorway jams the leaf)
  rug(23.5, 26.0, 2.6, 3.6, DIRT);                                                      // the track through the main gate

  // ---------------- the kitchen (x 13..18.5, z 6.5..11.5): k_s on the corridor, k_p into the pantry; a window north onto the back strip ----------------
  grp('kitchen');
  add({ c: [13.47, 0.45, 9.0], h: [0.35, 0.45, 1.4], albedo: C.white, ...mk(MD.cupboardMarks([0.35, 0.45, 1.4], '+x', 4, TX)) }); add({ c: [13.49, 0.92, 9.0], h: [0.38, 0.03, 1.45], albedo: [0.2, 0.2, 0.22] });   // counter along the west wall
  add({ c: [13.6, 1.0, 7.1], h: [0.42, 1.0, 0.4], albedo: [0.75, 0.75, 0.74] });        // fridge
  table(15.9, 9.3); chair(15.4, 10.15, 0, [0.5, 0.5, 0.48]); chair(16.5, 8.45, Math.PI, [0.5, 0.5, 0.48]); papers(16.1, 0.75, 9.3, 0.4);
  bin(14.5, 11.05); cardboardBox(16.3, 6.95, 0.5, 0.2); chair(13.55, 10.95, 2.4, [0.5, 0.5, 0.48]);          // loose things along the walls
  ceilingPanel(15.8, 8.8, true, 'kitchen', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- the pantry (x 18.5..21.5): p_back from the back strip, k_p from the kitchen, p_s on the corridor. Nobody holds it; nothing loose in it (three doors in 3 m) ----------------
  grp('pantry');
  shelf(21.12, 8.8, 2.6, 0.5, Math.PI / 2, 4, 2.0);
  const brk = add({ c: [18.6, 1.35, 10.4], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [18.65, 1.62, 10.22], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [18.6, 2.3, 10.4], h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });
  ceilingPanel(20.0, 9.2, false, 'pantry');

  // ---------------- the bunk room (x 21.5..27): a_s on the corridor, ab into the back bedroom ----------------
  grp('bunk');
  cot(22.7, 7.15, true); cot(25.2, 7.15, true);
  locker(21.9, 10.0, false);
  chair(24.9, 9.4, 1.0, [0.5, 0.5, 0.48]); cardboardBox(25.5, 11.0, 0.5, 0.2); bin(23.95, 6.95);
  ceilingPanel(24.2, 9.4, true, 'bunk', false, 1.2, 0.6, [7, 6.2, 5.0]);   // ON (the hand placement: every held room is lit — no dark room is held; the same panel, the same size)

  // ---------------- the back bedroom (x 27..33): ab from the bunk room, b_s on the corridor; a window east ----------------
  grp('back');
  add({ c: [31.6, 0.25, 7.6], h: [1.0, 0.25, 0.8], albedo: C.woodDark }); add({ c: [31.6, 0.54, 7.6], h: [0.98, 0.04, 0.78], albedo: [0.34, 0.12, 0.1] });   // the bed, in the north-east corner
  desk(28.6, 7.1, 1.6, 0.8, 0); monitor(28.6, 7.0, 0, true); chair(28.6, 7.95, 0); papers(29.15, 0.76, 7.2, 0.3);
  locker(27.4, 10.6, false);
  rug(30.0, 9.4, 2.4, 1.6, [0.3, 0.1, 0.09]);
  cardboardBox(29.4, 11.05, 0.5, 0.2); chair(32.45, 9.2, -1.2); bin(27.45, 6.95);
  ceilingPanel(30.0, 9.2, true, 'back', false, 1.2, 0.6, [7, 6.2, 5.0]);

  // ---------------- the corridor (z 11.5..14.5): bare floor from the west wall to the east wall ----------------
  grp('corridor');
  cabinet(13.5, 13.0, -Math.PI / 2);
  rug(24.0, 13.0, 15.0, 0.9, [0.26, 0.2, 0.16]);
  ceilingPanel(17.5, 13.0, true, 'corridor', false, 1.2, 0.3, [7, 6.8, 6.4]); ceilingPanel(28.5, 13.0, true, 'corridor', true, 1.2, 0.3, [7, 6.8, 6.4]);

  // ---------------- the sala (x 13..21, z 14.5..19): s_n on the corridor, s_e into the hall, s_w onto the west yard; no window ----------------
  grp('sala');
  add({ c: [14.4, 0.22, 18.45], h: [1.0, 0.22, 0.4], albedo: [0.3, 0.12, 0.1] }); add({ c: [14.4, 0.6, 18.78], h: [1.0, 0.35, 0.08], albedo: [0.3, 0.12, 0.1] });   // a couch on the south wall
  shelf(17.8, 14.88, 2.4, 0.5, 0, 4, 2.0);                                              // a sideboard on the corridor wall
  table(18.4, 18.3); chair(17.2, 18.2, Math.PI / 2, [0.5, 0.5, 0.48]); chair(18.5, 17.45, 0.2, [0.5, 0.5, 0.48]);
  rug(16.6, 16.6, 3.0, 2.0, [0.22, 0.07, 0.07]);
  cardboardBox(15.8, 18.5, 0.55, 0.2); bin(16.45, 18.6); plant(19.45, 14.95);
  ceilingPanel(17.0, 16.6, true, 'sala', false, 1.2, 0.6, [8, 7.2, 6.0]);

  // ---------------- the hall (x 21..24): the front door, hall_n onto the corridor, s_e into the sala. Nobody holds it ----------------
  grp('hall');
  bench(23.55, 17.4, Math.PI / 2);
  ceilingPanel(22.5, 16.8, true, 'hall', false, 1.2, 0.6, [8, 7.6, 6.9]);

  // ---------------- the office (x 24..28.5): o_n on the corridor, oc into the spare room ----------------
  grp('office');
  desk(24.7, 16.8, 1.6, 0.8, Math.PI / 2); monitor(24.6, 16.8, Math.PI / 2, false); chair(25.6, 16.8, Math.PI / 2); papers(24.7, 0.76, 17.3, 1.2);
  cabinet(28.08, 14.9, Math.PI);
  cardboardBox(26.4, 18.5, 0.5, 0.3); bin(25.45, 18.55); chair(26.9, 17.9, 2.0);
  ceilingPanel(26.2, 16.6, true, 'office', false, 1.2, 0.6, [4.5, 6.0, 9.0]);

  // ---------------- the spare room (x 28.5..33): oc from the office, c_n on the corridor. Nobody holds it ----------------
  grp('spare');
  cot(32.4, 17.0, false); cardboardBox(29.2, 18.4, 0.55, 0.2); cardboardBox(29.9, 18.5, 0.45, -0.3); chair(31.4, 18.3, 0.4);
  ceilingPanel(30.7, 16.8, false, 'spare');

  // ---------------- the garage (x 4..10.5, z 18..24): g_n from the west yard, g_e from the forecourt ----------------
  grp('garage');
  car(7.2, 22.5, 0, [0.42, 0.4, 0.36]);                                                 // a car against the south wall: the floor north of it is the room
  desk(5.2, 18.6, 1.8, 0.75, 0); papers(5.5, 0.76, 18.6, 0.2);                          // a workbench on the north wall
  pallet(9.5, 18.8, 1.2, 1.0);
  cardboardBox(4.6, 23.3, 0.5, 0.2); bin(9.9, 23.4); chair(5.3, 19.45, 0);
  ceilingPanel(7.2, 20.0, true, 'garage', false, 1.2, 0.6, [7, 6.8, 6.4]);

  // ---------------- the shed (x 4..9.5, z 4..8.5): shed_s from the west yard, shed_e onto the back strip ----------------
  grp('shed');
  shelf(5.6, 4.45, 2.4, 0.5, 0, 4, 2.0);
  pallet(5.0, 7.6, 1.2, 1.0);
  cardboardBox(7.5, 4.55, 0.55, 0.2); bin(4.42, 6.75);
  ceilingPanel(6.8, 6.3, true, 'shed', false, 1.2, 0.6, [6, 5.6, 5.0]);   // ON (the hand placement: four men awake in it since the second pass, two at first — what tells a team at the gate the shed is held)

  // ---------------- the guard hut (x 26..30.5, z 21..24): hut_w onto the main gate, hut_e into the east alley ----------------
  grp('hut');
  desk(28.2, 21.5, 1.4, 0.6, 0); monitor(28.2, 21.42, 0, true); chair(28.2, 22.25, 0);
  bin(28.2, 23.55);
  ceilingPanel(28.2, 22.9, true, 'hut', false, 0.6, 0.6, [6, 5.6, 5.0]);
  // THE KEEP'S THREE ROOMS ARE OFF THE MAINS (the hand placement, third pass: the same panels, `mains: false` — a generator set of their own). The breaker
  // darkens the yard buildings, the west half and the corridor; the office, the bunk room and the back bedroom stay lit. Tallied: with them on the mains a
  // team that cut the power lost 1.2 men a run going into a black office (its man shot first), and the breaker made every plan worse.
  for (const sw of switchables) if (sw.group === 'office' || sw.group === 'bunk' || sw.group === 'back') sw.mains = false;

  // ---------------- yard lamps and the moon ----------------
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3, on = true) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, albedo: [0.16, 0.17, 0.18] });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: on ? [40, 24, 7] : [0, 0, 0], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: [dir[0] * 0.35, -1, dir[2] * 0.35], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name, group: 'exterior', enabled: on, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true });
  };
  lampAt(21.3, 23.55, 'lamp_gate', [0, 0, -1]);                  // inside the main gate, over the forecourt: the one lamp that burns
  lampAt(4.45, 10.4, 'lamp_west', [1, 0, 0], false);             // on the west wall, over the west yard: out
  lampAt(35.55, 5.0, 'lamp_back', [-1, 0, 0], false);            // the back strip's lamp: out
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(22.5, 12.6); beacon(7.2, 19.2);

  const X = 0, Z = Math.PI / 2;   // closedDir: a leaf in a wall that runs along x / along z
  const doorDefs: LevelDoorDef[] = [
    // the house
    { name: 'front', hinge: [21.82, 19.0], closedDir: X, width: 1.16 },      // forecourt → the hall
    { name: 's_w', hinge: [13.0, 15.82], closedDir: Z, width: 1.16 },        // west yard → the sala
    { name: 'p_back', hinge: [19.32, 6.5], closedDir: X, width: 1.16 },      // back strip → the pantry
    { name: 'k_s', hinge: [15.82, 11.5], closedDir: X, width: 1.16 },                        // corridor → the kitchen
    { name: 'k_p', hinge: [18.5, 8.32], closedDir: Z, width: 1.16, swing: -1 },              // the kitchen ↔ the pantry; opens into the pantry (*)
    { name: 'p_s', hinge: [19.32, 11.5], closedDir: X, width: 1.16 },                        // corridor → the pantry
    { name: 'a_s', hinge: [22.82, 11.5], closedDir: X, width: 1.16 },                        // corridor → the bunk room
    { name: 'ab', hinge: [27.0, 8.32], closedDir: Z, width: 1.16 },                          // the bunk room ↔ the back bedroom
    { name: 'b_s', hinge: [30.82, 11.5], closedDir: X, width: 1.16, swing: 1 },              // corridor → the back bedroom; opens out into the corridor (*): the way in to it and, by ab, to the bunk room
    { name: 's_n', hinge: [14.82, 14.5], closedDir: X, width: 1.16 },                        // corridor → the sala
    { name: 's_e', hinge: [21.0, 15.82], closedDir: Z, width: 1.16 },                        // the hall ↔ the sala
    { name: 'hall_n', hinge: [21.82, 14.5], closedDir: X, width: 1.16 },                     // the hall → the corridor
    { name: 'o_n', hinge: [25.82, 14.5], closedDir: X, width: 1.16 },                        // corridor → the office
    { name: 'oc', hinge: [28.5, 15.82], closedDir: Z, width: 1.16 },                         // the office ↔ the spare room
    { name: 'c_n', hinge: [30.32, 14.5], closedDir: X, width: 1.16 },                        // corridor → the spare room
    // the outbuildings. (*) ANOTHER WAY IN (tools/qa/second-way-check.ts): the kitchen, the garage, the shed and the hut each had two doors that could both stand
    // wedged; the one away from the west gate is hung to open OUT of its room, which no wedge holds. The same for the two bedrooms at the house's east end,
    // which share one such door: the back bedroom's (b_s)
    { name: 'g_n', hinge: [6.82, 18.0], closedDir: X, width: 1.16 },         // west yard → the garage: the door the team comes to first, theirs to wedge
    { name: 'g_e', hinge: [10.5, 19.82], closedDir: Z, width: 1.16, swing: -1 },   // forecourt → the garage; opens out onto the forecourt (*)
    { name: 'shed_s', hinge: [6.82, 8.5], closedDir: X, width: 1.16 },       // west yard → the shed
    { name: 'shed_e', hinge: [9.5, 5.32], closedDir: Z, width: 1.16, swing: -1 },   // back strip → the shed; opens out onto the strip (*)
    { name: 'hut_w', hinge: [26.0, 21.82], closedDir: Z, width: 1.16 },      // the main gate → the hut
    { name: 'hut_e', hinge: [30.5, 21.82], closedDir: Z, width: 1.16, swing: -1 },   // the east alley → the hut; opens out into the alley (*)
    { name: 'yard_sw', hinge: [11.32, 18.5], closedDir: X, width: 1.16 },    // the forecourt ↔ the west yard
    // the wall's two side gates (the main gate has no leaf): the only `exterior` leaves, see below
    { name: 'gate_w', hinge: [4.0, 14.32], closedDir: Z, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [23.82, 4.0], closedDir: X, width: 1.16, exterior: true },
  ];
  // `exterior` is for the two leaves in the PERIMETER wall only: it is what the game reads as "opens onto the weather" (wind.ts gives each one a gust by the
  // office's INTERIOR rectangle, which is this wall's own line; a door of the house stands wholly inside that rectangle and would get one blowing an arbitrary
  // way). The house's and the outbuildings' outside doors stand in 0.24 walls like the gates, so their FRAMES are cut the thick way all the same.
  const THICK = new Set(['front', 's_w', 'p_back', 'g_n', 'g_e', 'shed_s', 'shed_e', 'hut_w', 'hut_e', 'yard_sw']);
  for (const d of doorDefs) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- LIVED IN (src/scene/lived.ts: every box below is in a group 'lived.<place>', every prop named 'lived.<place>.…' — the loader leaves them all
  // out with the switch off, and then this is the compound above, box for box). A FARMER'S WALLED HOUSE THAT A FAMILY STILL LIVES IN: each room is furnished for the
  // family first (the household on the ground: cushions, quilts, trays, sacks, brass and blue tin), and the gunmen are guests — one or two of their things laid on
  // a family thing in a room (a rifle across a flowered blanket, a chest rig on the loom, boots dumped in the shoe hall). Rules kept: nothing within 1.1 m of a
  // door's line or in a leaf's sweep, the wall a pair stacks on beside a jamb stays bare, nothing solid on a mark or across its aim; what lies on marks, lanes
  // and door aprons is drawn only (NoShadow, from the floor up). No light, nothing lit.
  // PAINT IS READ BY THE SIMULATION: an unnamed colour on a solid breaks as sheet metal and a plain grey is a steel cabinet, so cloth on furniture (blankets,
  // pillows, quilts, bundles, sacks' tops) is drawn only, and what is mud or masonry wears the house's own wall paint (partTan: the building, it does not break).
  // THE CAMERA looks north-north-east: a wall hides about 1.9 m of the floor just NORTH of it, and shows its own south and west faces. So what names a room stands
  // against its NORTH or EAST wall, mid floor, or on a tall thing — never on the room's south wall; in the back strip everything is on the OUTER wall.
  // One of each across the level: one tea tray (the sala), one red quilt (the father's bed), one chest rig (the loom), sacks only where grain is kept or weighed.
  // LAST in the lists on purpose (tools/levels/export.ts): the lived boxes are the tail of the boxes, the lived props the tail of the props.
  {
    const L = livedKit(K), P = L.P, NS = BoxFlag.NoShadow;
    const PINK: Vec3 = [0.62, 0.24, 0.33], ORANGE: Vec3 = [0.72, 0.36, 0.1], TEAL: Vec3 = [0.1, 0.33, 0.37], CREAM: Vec3 = [0.78, 0.72, 0.58], COPPER: Vec3 = [0.56, 0.28, 0.12];
    const CLAY: Vec3 = [0.5, 0.3, 0.2], STRAW: Vec3 = [0.7, 0.58, 0.26], HAY: Vec3 = [0.52, 0.5, 0.22], EARTH: Vec3 = [0.24, 0.18, 0.13], BRICK: Vec3 = [0.45, 0.33, 0.23], WETBRICK: Vec3 = [0.3, 0.21, 0.15];
    const SOIL: Vec3 = [0.1, 0.075, 0.05], DUNG: Vec3 = [0.15, 0.11, 0.05], TURMERIC: Vec3 = [0.88, 0.58, 0.04], BREAD: Vec3 = [0.8, 0.66, 0.42], GRAIN: Vec3 = [0.82, 0.68, 0.34];
    const BEDROLL: Vec3 = [0.2, 0.26, 0.17];   // (green and low ON PURPOSE: the look reads it as a blanket and deals it one of its blanket cloths)
    const LEDGER: Vec3 = [0.07, 0.1, 0.09], BROWN: Vec3 = [0.3, 0.2, 0.13];
    /** a box by its corners; `ns` = drawn only */
    const bx = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, a: Vec3, ns = false) => slab(x0, y0, z0, x1, y1, z1, a, ns ? { flags: NS } : {});
    /** a turned box by its centre and half sizes */
    const yb = (x: number, z: number, hx: number, hz: number, y0: number, y1: number, a: Vec3, yaw = 0, ns = false) => add({ c: [x, (y0 + y1) / 2, z], h: [hx, (y1 - y0) / 2, hz], yaw, albedo: a, ...(ns ? { flags: NS } : {}) });
    /** a round thing of radius 0.2 and over (a jar, an oven, a barrel, a wheel lying flat): an OCTAGON — four slabs through the centre 45° apart, each as wide as
     *  the round and tan 22.5° as deep, tops stepped 2 mm so none are coplanar (gwotKit's `round`; two squares 45° apart read as a cog from above) */
    const oct = (x: number, z: number, r: number, y0: number, y1: number, a: Vec3, ns = false) => { for (let k = 0; k < 4; k++) yb(x, z, r * 0.96, r * 0.96 * 0.4142, y0, y1 - 0.002 * k, a, k * Math.PI / 4, ns); };
    /** a small round thing (under 0.2): one square turned a little, as livedKit's drums. Reaches 1.25 r from its centre */
    const pot = (x: number, z: number, r: number, y0: number, y1: number, a: Vec3, ns = false) => yb(x, z, r * 0.9, r * 0.9, y0, y1, a, 0.3, ns);
    /** a pair of shoes left on the floor (drawn only) */
    const pair = (x: number, z: number, yaw: number, a: Vec3 = C.black, long = 0.13) => { const at = K.frameAt(x, z, yaw); for (const s of [-0.06, 0.06]) { const c = at(s, 0, s * 0.3); yb(c[0], c[2], 0.04, long, 0, 0.05, a, yaw, true); } };
    /** a floor cushion (drawn only: it may lie on a mark or in a lane) */
    const cushion = (x0: number, x1: number, z0: number, z1: number, a: Vec3, h = 0.075) => bx(x0, x1, z0, z1, 0, h, a, true);

    // ---- THE KITCHEN — the cook room, and only what a kitchen has: the two-ring range under the window with the pressure cooker and the kettle on it, the gas
    // bottle a hose's length off its end; the cook's mat mid floor (clear of the counter and of the table) with the spice tin and a tray of chillies; copper on
    // the wall. No bread here (the oven yard's), no tins and no sacks (the pantry's). Colour: copper and chilli red
    L.room('kitchen');
    bx(15.2, 15.98, 6.64, 7.19, 0, 0.6, C.partTan); bx(15.24, 15.94, 6.68, 7.15, 0.6, 0.615, C.metal, true);        // the range: a mud-brick base in the wall's own paint, a steel plate on it (drawn only)
    for (const x of [15.42, 15.77]) yb(x, 6.92, 0.13, 0.13, 0.615, 0.622, C.black, 0.3, true);                    // two burner rings
    pot(15.42, 6.92, 0.13, 0.622, 0.84, C.metal, true); bx(15.4, 15.44, 6.72, 6.84, 0.76, 0.8, C.black, true);     // the pressure cooker and its handle (drawn only)
    pot(15.77, 6.9, 0.11, 0.622, 0.8, P.enamelBlue);                                                              // the enamel kettle
    L.mat(14.6, 7.6, 16.2, 8.6, C.wood);                                                                          // the cook's reed mat, in front of the range
    pot(15.0, 8.1, 0.19, 0, 0.09, C.metal, true); for (const [dx, dz, a] of [[-0.07, -0.06, C.red], [0.07, -0.05, TURMERIC], [0, 0.08, BROWN]] as const) yb(15.0 + dx, 8.1 + dz, 0.045, 0.045, 0.09, 0.096, a as Vec3, 0.3, true);   // the spice tin: a steel round, three colours in it
    bx(15.5, 15.95, 7.75, 8.1, 0, 0.03, C.metal, true); bx(15.53, 15.92, 7.78, 8.07, 0.03, 0.045, C.red, true);    // a tray of chillies drying
    L.thing(13.45, 2.0, 7.0, 0.13, 0.08, 0.05, C.black);                                                          // on the fridge: the transistor radio
    for (let k = 0; k < 3; k++) L.hung(17.5 + k * 0.3, 6.642, true, 0.22 - k * 0.03, 1.38, 1.6 - k * 0.03, COPPER, 0.03);   // copper pans on the north wall
    for (let k = 0; k < 2; k++) L.hung(14.55 + k * 0.22, 6.642, true, 0.07, 1.25 + k * 0.1, 1.85, C.red, 0.03);     // strings of chillies
    { K.prop('cardboard', 14.92, 6.76, 0, 9, [{ off: [0, 0.26, 0], h: [0.13, 0.26, 0.13], yaw: 0, albedo: C.red }, { off: [0, 0.57, 0], h: [0.05, 0.05, 0.05], yaw: 0, albedo: C.black }]); L.own('gasbottle'); }   // the gas bottle, a hose's length off the range

    // ---- THE PANTRY — the store: three doors in three metres, so every solid stands against the shelf (its west half is all door: nothing may stand there) —
    // at the shelf's two ENDS, the middle left open to reach the lower shelves. Glazed jars at the north end, the sack pile and the flour bin with its lid ajar
    // at the south end; tins in two sizes, bowls and a jar along the shelf's top (the one shelf top in the level that is dressed); onions, garlic and peppers
    // strung on the north wall. Nothing loose. Colour: jar glaze and tin yellow
    L.room('pantry');
    pot(20.6, 7.9, 0.2, 0, 0.5, CLAY); L.thing(20.6, 0.5, 7.9, 0.1, 0.012, 0.1, C.wood);                           // two storage jars, lidded
    pot(20.6, 8.36, 0.19, 0, 0.42, TEAL); L.thing(20.6, 0.42, 8.36, 0.09, 0.012, 0.09, CREAM);
    bx(20.3, 20.85, 9.26, 9.72, 0, 0.27, C.cardboard); bx(20.33, 20.83, 9.3, 9.68, 0.27, 0.5, P.canvas, true);      // the sack pile (the top sack drawn only)
    bx(20.32, 20.85, 9.76, 10.26, 0, 0.62, C.wood); bx(20.3, 20.87, 9.74, 10.1, 0.62, 0.65, C.woodDark); bx(20.36, 20.81, 10.11, 10.24, 0.62, 0.626, C.white, true);   // the flour bin, its lid ajar, flour showing
    for (const [z, hx, hy, a] of [[7.7, 0.1, 0.13, P.brass], [8.05, 0.06, 0.08, P.brass], [8.45, 0.09, 0.05, P.enamelBlue], [8.85, 0.1, 0.13, P.brass], [9.25, 0.08, 0.11, CLAY], [9.62, 0.06, 0.08, P.brass]] as const)
      L.thing(21.12, 1.965, z, hx, hy, hx, a as Vec3);                                                            // along the shelf's top: ghee tins big and small, enamel bowls, a jar
    for (const [x, a] of [[18.8, ORANGE], [19.05, CREAM], [20.75, C.partRed], [21.0, ORANGE]] as const) L.hung(x, 6.642, true, 0.09, 1.2, 1.85, a as Vec3, 0.03);   // onions, garlic, dried peppers, strung on the north wall

    // ---- THE CORRIDOR — the long passage: the walk stays bare, and the camera sees only its north side, so both solids stand there. The drinking-water jar on
    // its stand by the kitchen's door; a bench against the wall between the sons' and the father's doors with the bread basket and a folded cloth on it; the
    // children's coats on low pegs at the west end, framed photographs, a lamp niche, a child's chalk drawing low on the wall; sandals BESIDE two doors.
    // Colour: the jar's blue
    L.room('corridor');
    bx(13.85, 14.55, 11.6, 12.28, 0, 0.3, C.woodDark); oct(14.2, 11.94, 0.3, 0.3, 0.86, P.enamelBlue); L.thing(14.2, 0.86, 11.94, 0.12, 0.015, 0.12, C.wood);   // the jar, its stand, its lid
    L.hung(13.25, 11.577, true, 0.22, 0.8, 1.4, P.brass, 0.05); L.hung(13.5, 11.577, true, 0.2, 0.85, 1.4, C.chair, 0.05); L.hung(13.71, 11.577, true, 0.14, 1.05, 1.4, CREAM, 0.05);   // small coats and a cap on low pegs
    L.hung(17.7, 11.577, true, 0.36, 1.4, 1.86, C.woodDark, 0.03); L.hung(17.7, 11.585, true, 0.26, 1.46, 1.8, CREAM, 0.034);   // the photographs: two framed …
    L.hung(18.3, 11.577, true, 0.52, 1.35, 1.9, C.black, 0.03); L.hung(18.3, 11.585, true, 0.4, 1.42, 1.83, CREAM, 0.034);
    L.hung(21.6, 11.577, true, 0.44, 1.05, 1.6, BROWN, 0.03); L.hung(21.6, 11.61, true, 0.1, 1.05, 1.27, P.brass, 0.06);   // the niche and its oil lamp (unlit)
    L.hung(26.7, 11.577, true, 0.2, 0.72, 0.92, P.brass, 0.024); L.hung(27.2, 11.577, true, 0.34, 0.3, 0.62, C.white, 0.024); L.hung(27.7, 11.577, true, 0.06, 0.3, 0.72, P.enamelBlue, 0.024);   // chalk, at a child's height: a sun, a house, a man
    bx(28.1, 29.4, 11.6, 11.98, 0.36, 0.4, C.wood); bx(28.14, 28.2, 11.62, 11.96, 0, 0.36, C.wood); bx(29.3, 29.36, 11.62, 11.96, 0, 0.36, C.wood);   // the bench
    pot(28.45, 11.79, 0.15, 0.4, 0.56, STRAW, true); yb(29.0, 11.79, 0.16, 0.12, 0.4, 0.46, CREAM, 0, true);       // on it: the bread basket, a folded cloth (drawn only)
    pair(22.55, 11.72, 0.2, C.black); pair(30.55, 11.72, 0.1, C.woodDark);                                        // sandals left beside the sons' and the father's doors

    // ---- THE SALA — the guest room: two rows of floor cushions with their bolsters facing each other across THE tea table of the level, all on the rug in
    // the room's north half (drawn only but the table: they lie in the lane and cost no cover), in colours that stand off the rug's maroon; six glasses. One
    // of theirs: an ammunition tin pulled up at the table's head as a seventh seat. Colour: mustard and teal on maroon
    L.room('sala');
    bx(16.0, 17.2, 16.05, 16.6, 0.31, 0.35, C.woodDark); bx(16.04, 16.1, 16.09, 16.56, 0, 0.31, C.woodDark); bx(17.1, 17.16, 16.09, 16.56, 0, 0.31, C.woodDark);   // the low tea table, between the rows
    bx(16.22, 16.9, 16.15, 16.51, 0.35, 0.364, P.brass); L.thing(16.36, 0.364, 16.33, 0.06, 0.07, 0.06, C.black);   // tray and pot
    for (let k = 0; k < 6; k++) L.mug(16.54 + (k % 3) * 0.11, 0.364, 16.26 + (k > 2 ? 0.14 : 0), CREAM);           // six glasses: there are guests
    for (let k = 0; k < 3; k++) cushion(15.15, 15.75, 15.62 + k * 0.47, 16.07 + k * 0.47, [P.brass, TEAL, CREAM][k]);   // the west row
    for (let k = 0; k < 3; k++) cushion(17.45, 18.05, 15.62 + k * 0.47, 16.07 + k * 0.47, [ORANGE, P.brass, TEAL][k]);  // the east row
    bx(15.15, 15.3, 15.7, 16.8, 0.075, 0.2, C.chair, true); bx(17.9, 18.05, 15.7, 16.8, 0.075, 0.2, C.chair, true);   // blue bolsters along their backs
    yb(16.6, 15.8, 0.17, 0.1, 0, 0.2, P.oliveDrab, 0.1, true);                                                    // the ammunition tin, at the table's head
    { K.prop('chair', 19.0, 16.4, 0, 3, [{ off: [0, 0.1, 0], h: [0.22, 0.1, 0.11], yaw: 0, albedo: C.chair }]); L.own('bolster'); }
    { K.prop('chair', 14.75, 16.4, 0.3, 2.5, [{ off: [0, 0.07, 0], h: [0.24, 0.07, 0.24], yaw: 0, albedo: ORANGE }]); L.own('cushion'); }

    // ---- THE HALL — the shoe hall: the shoes tell the census. Four small pairs neat on the rack (the only small shoes in the house), five pairs of big boots
    // dumped on the floor (theirs). Colour: boot black on coir
    L.room('hall');
    bx(23.61, 23.91, 15.53, 16.52, 0.22, 0.25, C.wood); bx(23.61, 23.91, 15.53, 16.52, 0.47, 0.5, C.wood); bx(23.6, 23.92, 15.5, 15.53, 0, 0.505, C.wood); bx(23.6, 23.92, 16.52, 16.55, 0, 0.505, C.wood);   // the rack on the east wall
    for (let k = 0; k < 4; k++) yb(23.76, 15.68 + k * 0.23, 0.11, 0.08, 0.5, 0.57, [PINK, C.chair, CREAM, C.red][k], 0, true);   // the family's: small, in a row
    for (const [x, z, w] of [[23.3, 15.7, 0.3], [23.05, 15.95, 1.3], [23.38, 16.1, 2.2], [22.95, 15.62, 0.9], [23.2, 16.75, 1.7]] as const) pair(x, z, w, C.black, 0.15);   // theirs: big, anyhow
    L.mat(21.9, 18.1, 22.9, 18.75, C.cardboard);                                                                  // the door mat
    yb(23.55, 17.05, 0.14, 0.2, 0.45, 0.52, P.canvas, 0, true); yb(23.5, 17.45, 0.08, 0.08, 0.45, 0.51, C.wood, 0, true); L.sheet(23.56, 0.45, 17.8, 0.24, 0.32, 0.1, P.paper);   // on the bench: a shawl, a cap, a newspaper
    L.hung(23.915, 17.0, false, 0.4, 1.0, 1.7, P.canvas); L.hung(23.915, 17.48, false, 0.4, 1.05, 1.7, C.woodDark); L.hung(23.915, 17.96, false, 0.42, 0.95, 1.7, P.oliveDrab);   // coats over it, the last one theirs
    { K.prop('cardboard', 23.2, 16.38, 0, 1.2, [{ off: [0, 0.13, 0], h: [0.08, 0.13, 0.08], yaw: 0, albedo: P.brass }, { off: [0.1, 0.2, 0], h: [0.04, 0.02, 0.02], yaw: 0, albedo: P.brass }]); L.own('ewer'); }

    // ---- THE BUNK ROOM — the sons' room, both cots theirs: a kite and a school book on the first cot's blue blanket, a slate and a small shirt on the second's
    // orange one, a blue satchel on its peg between the cots, the small boy's bedroll on the floor (child sized), a cricket bat. Theirs: one green bedroll with
    // an olive blanket laid mid floor, an ammunition crate in the corner. Nothing on the locker. Colour: school blue, orange and kite yellow
    L.room('bunk');
    yb(22.95, 7.2, 0.6, 0.36, 0.48, 0.52, P.enamelBlue, 0.12, true); yb(21.98, 7.15, 0.14, 0.25, 0.48, 0.56, CREAM, 0, true);   // cot one: its blanket, its pillow (bedding is drawn only)
    yb(23.08, 7.2, 0.21, 0.21, 0.52, 0.53, P.brass, Math.PI / 4, true); yb(23.08, 7.2, 0.21, 0.025, 0.53, 0.536, C.red, Math.PI / 4, true); yb(23.46, 7.4, 0.13, 0.015, 0.52, 0.528, C.red, 0.5, true);   // the kite on it: a yellow diamond, its spar, its tail
    L.sheet(22.48, 0.52, 7.02, 0.2, 0.27, 0.2, P.paper);                                                          // an exercise book
    yb(25.12, 7.12, 0.5, 0.37, 0.48, 0.52, ORANGE, -0.1, true); yb(24.44, 7.15, 0.14, 0.25, 0.48, 0.56, CREAM, 0, true);   // cot two
    yb(25.25, 7.2, 0.16, 0.12, 0.52, 0.53, CREAM, 0.3, true); yb(25.25, 7.2, 0.13, 0.09, 0.53, 0.536, LEDGER, 0.3, true);   // a writing slate in its frame
    yb(25.72, 7.08, 0.13, 0.11, 0.52, 0.56, C.white, -0.2, true);                                                 // a small shirt, folded
    L.crate(26.6, 6.88, 0.56, 0.4, 0.34, 0, P.oliveDrab);                                                         // the ammunition crate in the corner
    bx(22.95, 24.55, 8.5, 9.1, 0, 0.14, BEDROLL, true); bx(23.0, 23.35, 8.56, 9.04, 0.14, 0.2, CREAM, true); yb(24.1, 8.82, 0.4, 0.27, 0.14, 0.17, P.oliveDrab, 0.25, true);   // the guest's bedroll, its pillow, an olive blanket half off (all drawn only: it lies under a mark's aim)
    bx(25.25, 25.75, 7.75, 8.85, 0, 0.12, C.chair, true); bx(25.3, 25.7, 7.8, 8.04, 0.12, 0.17, CREAM, true);     // the small one: child sized (drawn only, like the guest's: it lies a stride straight in from the back room's door, and a chair shoved through that door stopped dead on it with the man behind held in the frame)
    yb(24.82, 8.05, 0.4, 0.05, 0, 0.045, C.wood, 0.5, true);                                                      // the cricket bat
    L.hung(23.95, 6.66, true, 0.32, 0.95, 1.3, P.enamelBlue, 0.08); L.hung(23.95, 6.705, true, 0.32, 1.17, 1.3, P.brass, 0.012); L.hung(23.95, 6.642, true, 0.03, 1.3, 1.6, BROWN, 0.02);   // the school satchel on its peg: bag, flap, strap
    { K.prop('chair', 23.3, 7.95, 0.2, 2.5, [{ off: [0, 0.09, 0], h: [0.25, 0.09, 0.1], yaw: 0, albedo: ORANGE }]); L.own('bolster'); }

    // ---- THE BACK BEDROOM — the father's room: the headboard and THE red quilt folded at the bed's foot, the strapped chest with the cash box on it, one
    // suitcase on the locker, the prayer mat on the rug in the middle of the room (askew: the one thing here not square to the walls) and the book on its stand.
    // Theirs: a handset on the quilt. Nothing loose. Colour: deep red
    L.room('back');
    L.hung(31.6, 6.645, true, 1.9, 0.5, 1.05, C.woodDark, 0.04);                                                  // the headboard
    for (const x of [31.15, 32.05]) yb(x, 7.05, 0.26, 0.16, 0.58, 0.68, CREAM, 0, true);                          // two pillows
    bx(30.65, 32.55, 7.85, 8.36, 0.58, 0.68, C.partRed, true); bx(30.65, 32.55, 8.04, 8.12, 0.68, 0.686, P.brass, true);   // the quilt, a yellow band across it
    yb(31.2, 7.98, 0.035, 0.09, 0.68, 0.74, C.black, 0.2, true);                                                  // the handset
    L.crate(31.45, 8.7, 1.1, 0.4, 0.5, 0, C.woodDark); for (const x of [31.0, 31.9]) bx(x - 0.03, x + 0.03, 8.49, 8.91, 0, 0.53, C.metal, true);   // the strapped chest at the foot of the bed (its straps drawn only)
    yb(31.45, 8.7, 0.15, 0.1, 0.5, 0.66, C.metal, 0, true);                                                       // the cash box on it, between the lid's battens
    bx(27.14, 27.66, 10.3, 10.9, 2.0, 2.2, BROWN, true);                                                          // one suitcase on the locker
    yb(29.95, 9.1, 0.5, 0.31, 0, 0.026, C.partBlue, 0.3, true); yb(29.99, 9.09, 0.3, 0.19, 0, 0.031, CREAM, 0.3, true);   // the prayer mat
    yb(29.35, 9.28, 0.09, 0.13, 0, 0.14, C.wood, 0.3); yb(29.35, 9.28, 0.07, 0.1, 0.14, 0.18, C.plant, 0.3, true);  // the book on its stand, wrapped in green
    L.mat(29.6, 7.6, 30.4, 8.2, CREAM, 0.03);                                                                     // a sheepskin by the bed
    L.hung(30.0, 6.64, true, 0.5, 1.4, 1.85, C.black, 0.03); L.hung(30.0, 6.65, true, 0.36, 1.48, 1.77, CREAM, 0.03);   // a framed verse

    // ---- THE OFFICE — THE SPICE MERCHANT'S WEIGHING ROOM (one story: goods weighed, bagged and sold; nothing here is the gunmen's). The brass balance on its
    // table in the middle of the floor on a sack cloth, a stool at it, turmeric heaped in its low pan against a weight; an open sack of the same with its top
    // rolled down and a scoop in it, three tagged sample sacks in a file. On the NORTH wall, where the camera reads it face on, the wares: two shelves of jars
    // in eight spice colours, the turmeric one of them; east of the door the tally board. On the desk the seed bowls and ONE telephone; the ledgers by it.
    // (East of x 27.4 is the spare room door's own floor: nothing may stand there.) Colour: ledger green-black, brass and turmeric
    L.room('office');
    L.mat(26.1, 15.58, 27.0, 17.14, P.canvas, 0.03);                                                              // the sack cloth (over the look's rug: a hair higher)
    bx(26.3, 26.9, 16.25, 16.75, 0.42, 0.46, C.wood); bx(26.33, 26.39, 16.28, 16.72, 0, 0.42, C.wood); bx(26.81, 26.87, 16.28, 16.72, 0, 0.42, C.wood);   // the balance's table (half a metre behind the desk chair)
    bx(26.58, 26.62, 16.48, 16.52, 0.46, 0.94, P.brass); bx(26.32, 26.88, 16.485, 16.515, 0.9, 0.925, P.brass, true);   // the balance: its post, its beam …
    yb(26.38, 16.5, 0.09, 0.09, 0.6, 0.624, P.brass, 0, true); yb(26.82, 16.5, 0.09, 0.09, 0.52, 0.544, P.brass, 0, true);   // … two pans hung from it (drawn only)
    yb(26.38, 16.5, 0.045, 0.045, 0.624, 0.694, C.black, 0, true); yb(26.82, 16.5, 0.07, 0.07, 0.544, 0.6, TURMERIC, 0.3, true);   // a weight in the high pan, the goods heaped in the low one
    bx(26.46, 26.74, 16.82, 17.1, 0, 0.4, C.woodDark);                                                            // the stool at the scale
    pot(26.6, 15.93, 0.2, 0, 0.3, C.cardboard); yb(26.6, 15.93, 0.21, 0.21, 0.3, 0.37, P.canvas, 0.3, true); yb(26.6, 15.93, 0.15, 0.15, 0.37, 0.385, TURMERIC, 0.3, true); yb(26.64, 15.91, 0.035, 0.1, 0.385, 0.42, C.metal, 0.9, true);   // the open sack by the table: its top rolled down, the goods, a scoop in them
    for (let k = 0; k < 3; k++) { bx(26.0, 26.18, 15.72 + k * 0.22, 15.9 + k * 0.22, 0, 0.19, [P.canvas, C.cardboard, P.canvas][k], true); yb(26.09, 15.81 + k * 0.22, 0.035, 0.05, 0.19, 0.198, P.paper, 0, true); }   // three small sample sacks in a file beside it, a tag on each (drawn only)
    for (let k = 0; k < 4; k++) L.thing(24.42 + (k % 2) * 0.16, 0.76, 16.1 + (k >> 1) * 0.15, 0.06, 0.025, 0.06, [STRAW, C.partRed, CREAM, C.plant][k]);   // seed samples on the desk
    yb(24.5, 16.62, 0.04, 0.075, 0.76, 0.78, C.black, 0.2, true);                                                 // the one telephone, on the desk
    yb(24.49, 15.77, 0.13, 0.15, 0, 0.14, LEDGER, 0.05, true); yb(24.49, 15.77, 0.1, 0.14, 0.14, 0.21, CREAM, 0.1, true); yb(24.49, 15.77, 0.105, 0.02, 0.14, 0.215, C.red, 0.1, true);   // by the desk: ledgers on the floor, papers in red tape on them (drawn only: a mark stands beside)
    for (let j = 0; j < 2; j++) { const y = 0.9 + j * 0.46; bx(24.22, 25.44, 14.56, 14.72, y, y + 0.03, C.wood, true);   // the wares on the north wall: two shelves (clear of the door's leaf) …
      for (let k = 0; k < 4; k++) bx(24.3 + k * 0.3, 24.48 + k * 0.3, 14.58, 14.7, y + 0.03, y + 0.25, ([[ORANGE, BROWN, STRAW, C.red], [TURMERIC, C.partRed, C.plant, CREAM]] as Vec3[][])[j][k], true); }   // … four jars on each, every one a different spice
    L.hung(27.4, 14.577, true, 0.66, 1.15, 1.9, LEDGER, 0.03); for (let k = 0; k < 3; k++) L.hung(27.4 - k * 0.06, 14.585, true, 0.5 - k * 0.12, 1.68 - k * 0.2, 1.72 - k * 0.2, CREAM, 0.034);   // the tally board: three rows chalked

    // ---- THE SPARE ROOM — the weaving room: the ground loom with a carpet a third woven, in the room's north half where the camera has it, the stack of five
    // quilts in the corner; behind the loom the hand sewing machine on the floor and the cradle. Theirs: THE chest rig, dropped on the loom. Colour: every
    // colour — the only room with them (and with pink)
    L.room('spare');
    bx(29.9, 29.98, 15.65, 16.55, 0, 0.3, C.woodDark); bx(31.42, 31.5, 15.65, 16.55, 0, 0.3, C.woodDark);          // the loom's two beams
    bx(29.98, 31.42, 15.72, 16.48, 0.22, 0.26, C.partTan); bx(29.98, 30.5, 15.71, 16.49, 0.26, 0.3, C.carpetRed);    // the warp (undyed), and the woven third
    bx(30.1, 30.16, 15.71, 16.49, 0.3, 0.306, P.brass, true); bx(30.3, 30.36, 15.71, 16.49, 0.3, 0.306, C.partBlue, true);   // its two stripes
    bx(30.9, 30.96, 15.67, 16.53, 0.26, 0.3, C.wood); yb(30.62, 16.1, 0.03, 0.2, 0.26, 0.32, C.wood, 0, true);      // the heddle bar lying on the warp, the comb
    for (const [x, z, r, a] of [[30.75, 15.82, 0.06, PINK], [30.78, 16.36, 0.06, TEAL], [30.66, 16.4, 0.05, P.brass]] as const) yb(x, z, r, r, 0.26, 0.26 + 2 * r, a as Vec3, 0, true);   // wool
    yb(31.18, 16.0, 0.13, 0.18, 0.26, 0.36, P.oliveDrab, 0.3, true); yb(31.18, 16.0, 0.14, 0.03, 0.36, 0.368, C.black, 0.3, true);   // the chest rig, its strap
    for (let k = 0; k < 5; k++) bx(32.2 + k * 0.03, 32.85 - k * 0.03, 15.4 + k * 0.03, 15.98 - k * 0.03, k * 0.17, k * 0.17 + 0.17, [C.partBlue, C.partTan, C.chair, PINK, TEAL][k], k > 2);   // five quilts, each smaller than the one below (the lower three solid in the level's own cloth paints, the top two drawn only)
    L.hung(32.862, 15.7, false, 0.7, 1.15, 1.95, C.carpetRed, 0.03); L.hung(32.85, 15.7, false, 0.7, 1.5, 1.6, P.brass, 0.034);   // a finished rug on the east wall over them
    bx(29.78, 30.36, 16.78, 17.16, 0.12, 0.4, C.wood); bx(29.72, 29.78, 16.74, 17.2, 0, 0.14, C.woodDark); bx(30.36, 30.42, 16.74, 17.2, 0, 0.14, C.woodDark); bx(29.82, 30.32, 16.82, 17.12, 0.4, 0.42, PINK, true);   // the cradle, behind the loom
    bx(30.75, 31.3, 16.72, 16.97, 0, 0.08, C.wood); bx(30.82, 31.18, 16.79, 16.91, 0.08, 0.3, C.black); bx(31.2, 31.24, 16.76, 16.94, 0.1, 0.28, C.metal, true); bx(30.47, 30.78, 16.71, 17.0, 0, 0.03, C.chair, true);   // the hand sewing machine on its board on the floor, its wheel, cloth under the needle
    L.thing(29.7, 0, 16.66, 0.05, 0.05, 0.05, C.partRed, 0.3); L.thing(29.84, 0, 16.64, 0.05, 0.05, 0.05, C.chair); L.thing(29.82, 0.1, 16.64, 0.05, 0.04, 0.05, P.brass, 0.5);   // a child's blocks
    { K.prop('cardboard', 31.75, 16.62, 0, 1.5, [{ off: [0, 0.1, 0], h: [0.15, 0.1, 0.15], yaw: 0, albedo: C.cardboard }, { off: [0, 0.22, 0], h: [0.1, 0.03, 0.1], yaw: 0.5, albedo: PINK }]); L.own('basket'); }

    // ---- THE SHED — the fodder shed, and the animal's stall (it is out in the field): the chaff cutter with a heap of chaff thrown down beside it, its flywheel and blade at the
    // north end and its feed trough open to the south where a man stands to feed it; the manger in the corner with a tether ring and rope, the empty water
    // trough, a dung patch. Colour: straw yellow
    L.room('shed');
    yb(6.82, 5.42, 0.42, 0.3, 0, 0.022, STRAW, 0.5, true); yb(6.5, 5.82, 0.3, 0.22, 0, 0.026, STRAW, -0.4, true); yb(6.95, 5.3, 0.2, 0.15, 0.026, 0.15, STRAW, 0.3, true);   // chaff: a ragged heap thrown down beside the cutter (not a square: the forecourt's grain sheet is the level's yellow rectangle)
    bx(7.3, 7.58, 5.08, 5.66, 0.55, 0.72, C.wood); bx(7.32, 7.56, 5.56, 5.62, 0, 0.55, C.woodDark); bx(7.32, 7.56, 5.16, 5.22, 0, 0.55, C.woodDark); bx(7.34, 7.54, 5.28, 5.68, 0.72, 0.8, STRAW, true);   // the chaff cutter: its feed trough on two frames, straw in it
    add({ c: [7.44, 0.66, 5.02], h: [0.17, 0.4, 0.02], albedo: C.black }); add({ c: [7.44, 0.66, 5.02], h: [0.4, 0.17, 0.016], albedo: C.black, flags: NS }); add({ c: [7.44, 0.66, 5.02], h: [0.3, 0.3, 0.012], albedo: C.black, flags: NS });   // … its flywheel at the trough's north end (three nested slabs: a stepped disc; one solid, two drawn)
    add({ c: [7.44, 0.66, 5.05], h: [0.05, 0.05, 0.012], albedo: P.brass }); add({ c: [7.44, 0.83, 5.052], h: [0.27, 0.035, 0.008], albedo: C.metal, flags: NS }); add({ c: [7.72, 0.66, 4.97], h: [0.03, 0.03, 0.04], albedo: C.wood });   // the hub, the blade, the handle
    bx(4.15, 4.6, 4.76, 5.34, 0, 0.62, C.wood); bx(4.19, 4.56, 4.8, 5.3, 0.62, 0.7, HAY, true);                     // the manger, hay in it
    L.hung(4.135, 5.72, false, 0.1, 0.76, 0.86, C.metal, 0.03); yb(4.5, 5.95, 0.02, 0.33, 0, 0.03, P.canvas, 0.5, true);   // the tether ring, the rope let fall
    bx(4.15, 4.5, 6.0, 6.55, 0, 0.26, C.metal, true); bx(4.19, 4.46, 6.04, 6.51, 0.26, 0.266, C.black, true);       // the water trough, empty (drawn only: a mark stands beside)
    L.mat(4.7, 5.35, 5.2, 6.3, DUNG, 0.026); yb(4.95, 5.65, 0.09, 0.08, 0, 0.06, DUNG, 0.3, true); yb(5.05, 6.05, 0.07, 0.08, 0, 0.05, DUNG, 0.9, true);   // the dung patch
    bx(5.92, 5.96, 5.25, 6.15, 0, 0.045, C.wood, true); yb(5.94, 5.2, 0.1, 0.03, 0, 0.035, C.metal, 0, true); yb(6.5, 5.3, 0.02, 0.2, 0, 0.035, C.metal, 0.8, true);   // a fork and a sickle on the floor by the heap
    { K.prop('cardboard', 5.6, 5.0, 0.1, 6, [{ off: [0, 0.18, 0], h: [0.27, 0.18, 0.2], yaw: 0, albedo: STRAW }]); L.own('bale'); }

    // ---- THE GARAGE — the taxi's lean-to, shared with the household's junk: a roof rack with a tied bundle and a suitcase on the car (the level's one roof
    // load), a child's bicycle stood against the pallet stack by the north wall (drawn only: the east door's line is near), a rope bed stood on its side, flattened
    // cardboard under the engine. Colour: the taxi's yellow, echoed on its roof
    L.room('garage');
    bx(6.0, 7.9, 21.85, 21.9, 1.52, 1.57, C.black); bx(6.0, 7.9, 23.1, 23.15, 1.52, 1.57, C.black);                // the roof rack's rails
    bx(6.3, 7.5, 21.98, 23.02, 1.52, 1.8, P.canvas, true); for (const x of [6.6, 7.2]) bx(x, x + 0.04, 21.97, 23.03, 1.52, 1.81, BROWN, true);   // the bundle on the roof between them, roped (drawn only)
    bx(7.55, 7.86, 22.2, 22.8, 1.52, 1.7, TEAL, true); bx(7.92, 8.06, 22.3, 22.7, 1.52, 1.64, P.brass);             // a suitcase (drawn only), the roof sign
    for (const x of [9.17, 9.83]) { bx(x - 0.22, x + 0.22, 19.3, 19.33, 0, 0.44, C.black, true); bx(x - 0.11, x + 0.11, 19.33, 19.336, 0.11, 0.33, C.concrete, true); }   // the child's bicycle, upright against the pallet stack: two wheels (their middles the wall's grey) …
    bx(9.17, 9.83, 19.305, 19.335, 0.46, 0.51, C.red, true); bx(9.2, 9.38, 19.27, 19.35, 0.51, 0.56, C.black, true);   // … the red top tube, the saddle
    bx(9.8, 9.83, 19.305, 19.335, 0.51, 0.66, C.red, true); bx(9.79, 9.84, 19.265, 19.465, 0.66, 0.7, C.black, true);   // … the stem, the handlebars (wheels on the pallet's foot, saddle and bars on its side)
    bx(4.15, 4.23, 21.95, 22.9, 0, 0.9, C.wood); bx(4.23, 4.25, 22.0, 22.85, 0.08, 0.82, P.canvas, true);          // a rope bed on its side against the wall
    L.mat(8.2, 21.2, 9.55, 21.95, C.cardboard, 0.02);                                                             // flattened cardboard under the engine
    L.hung(4.9, 18.148, true, 0.7, 1.3, 1.9, C.metal, 0.05); L.hung(5.8, 18.142, true, 0.3, 1.4, 1.7, P.canvas);   // the tin bath and a coil of rope on the north wall
    { K.prop('cardboard', 4.6, 21.55, 0, 9, [{ off: [0, 0.1, 0], h: [0.22, 0.1, 0.22], yaw: 0, albedo: C.black }, { off: [0, 0.205, 0], h: [0.1, 0.005, 0.1], yaw: 0, albedo: [0.5, 0.5, 0.48] }]); L.own('wheel'); }
    { K.prop('cardboard', 4.4, 19.6, 0, 4, [{ off: [0, 0.22, 0], h: [0.17, 0.22, 0.08], yaw: 0, albedo: C.red }]); L.own('can'); }

    // ---- THE HUT — THE GATE WATCHMAN'S HUT, told at standing height and outside its door: his board of keys and his greatcoat on the north wall (face on
    // to the camera), a lantern on a nail, a calendar; and OUT at the gate his stool with his stick and a glass of tea on the ground by it, where he sits the
    // day (1.1 m and more off the hut door's line, north of the wall the door's free jamb stacks on). Inside: a brazier and its kettle in the corner (drawn
    // only: the west door's line), his bedding rolled for the day against the north wall with the sheepskin on it (drawn only: the east door's line; a made-up
    // cot does not fit — the desk has the north wall and both ends of it are inside a door's line), the gate ledger on the desk. No gun: he is the family's man.
    // Nothing loose. Colour: blanket brown and key brass
    L.room('hut');
    pot(26.42, 21.42, 0.15, 0, 0.27, C.black, true); yb(26.42, 21.42, 0.09, 0.09, 0.27, 0.282, C.red, 0.3, true); yb(26.42, 21.42, 0.05, 0.05, 0.282, 0.4, C.metal, 0, true);   // the brazier, coals, the kettle
    bx(28.98, 29.52, 21.16, 21.46, 0, 0.3, BROWN, true); bx(29.02, 29.48, 21.18, 21.44, 0.3, 0.36, CREAM, true);   // the bedding, rolled; the sheepskin folded on it
    L.thing(28.72, 0.76, 21.55, 0.11, 0.02, 0.15, LEDGER, 0.1);                                                   // the gate ledger on the desk
    L.hung(29.3, 21.148, true, 0.14, 1.5, 1.8, P.brass, 0.05); L.hung(26.65, 21.137, true, 0.35, 1.4, 1.85, CREAM, 0.03);   // a lantern on a nail, a calendar
    L.hung(27.15, 21.137, true, 0.5, 1.3, 1.62, C.woodDark, 0.03); for (let k = 0; k < 3; k++) L.hung(27.0 + k * 0.15, 21.157, true, 0.05, 1.36, 1.52 - (k % 2) * 0.04, P.brass, 0.01);   // the key board: three keys on it
    L.hung(29.85, 21.142, true, 0.42, 0.75, 1.65, BROWN, 0.04);                                                   // his greatcoat on a peg
    bx(24.55, 24.85, 22.45, 22.75, 0, 0.42, C.wood);                                                              // out at the gate: his stool …
    yb(24.6, 23.05, 0.42, 0.015, 0, 0.03, C.woodDark, 0.3, true); yb(25.0, 22.52, 0.035, 0.035, 0, 0.09, CREAM, 0, true);   // … his stick on the ground by it, a glass of tea

    // ---- THE WEST YARD — the vegetable plot owns it: a dug bed of dark soil with six rows a spade's width apart (down the look's own
    // furrows), tomatoes on the tall rows; the day's picking in two crates and a basket at the rows' end. Beside it the hand pump on the cistern, the hen
    // house on the shed's wall with its hens shut in their run, the handcart of pumpkins. Colour: leaf green and tomato red on black soil
    L.room('westyard');
    bx(7.9, 8.3, 13.26, 13.6, 0, 0.12, C.concrete, true); bx(8.04, 8.16, 13.36, 13.5, 0, 0.95, C.red); bx(7.78, 8.04, 13.4, 13.46, 0.7, 0.76, C.red, true); bx(8.16, 8.5, 13.41, 13.45, 0.9, 0.95, C.red, true);   // the hand pump, painted red: its slab, body, spout and handle (only the body solid)
    L.mat(8.0, 13.62, 9.1, 14.3, C.asphalt);                                                                      // mud at it
    L.mat(4.78, 9.96, 7.72, 13.18, SOIL, 0.007);                                                                  // the dug bed (under the look's furrows)
    for (let r = 0; r < 6; r++) { const x = 5.0 + r * 0.5, tall = r < 3; bx(x - 0.1, x + 0.1, r === 0 ? 11.0 : 10.1 + (r % 2) * 0.2, 13.0 - ((r + 1) % 3) * 0.18, 0, tall ? 0.3 : 0.13, C.plant, true);
      if (tall) yb(x + 0.04, 11.4 + r * 0.6, 0.04, 0.04, 0.3, 0.36, C.red, 0, true); }                          // six rows: three of tomatoes (a red one showing on each), three of low greens
    bx(4.15, 4.75, 8.66, 9.5, 0.15, 0.75, C.wood); bx(4.14, 4.79, 8.64, 9.52, 0.75, 0.8, BROWN); bx(4.17, 4.23, 8.68, 9.48, 0, 0.15, C.woodDark); bx(4.67, 4.73, 8.68, 9.48, 0, 0.15, C.woodDark);   // the hen house on the shed's wall, a rusted sheet for its roof
    bx(5.62, 5.65, 8.64, 9.56, 0, 0.32, C.wood, true); bx(4.79, 5.65, 9.53, 9.56, 0, 0.32, C.wood, true);          // its run: a low fence
    for (const [x, z, w] of [[5.0, 8.9, 0.3], [5.35, 9.25, 1.2], [5.3, 8.85, 2.0]] as const) yb(x, z, 0.09, 0.13, 0, 0.2, C.white, w, true);   // three hens, inside it
    L.crate(5.9, 13.76, 0.5, 0.4, 0.3, 0, C.cardboard); L.thing(5.9, 0.324, 13.76, 0.19, 0.035, 0.14, C.plant);    // the picking: a crate of greens …
    L.crate(6.5, 13.76, 0.46, 0.4, 0.27, 0, C.wood); yb(6.5, 13.76, 0.17, 0.14, 0.294, 0.354, C.red, 0, true);      // … a crate of tomatoes
    bx(12.24, 12.84, 9.3, 10.6, 0.45, 0.55, C.wood); bx(12.17, 12.23, 9.7, 10.2, 0, 0.5, C.black); bx(12.23, 12.8, 9.92, 9.98, 0.22, 0.27, C.black, true);   // the handcart: bed, wheel, axle
    yb(12.54, 9.58, 0.19, 0.19, 0.55, 0.85, ORANGE, 0.3, true); yb(12.52, 10.04, 0.16, 0.16, 0.55, 0.8, ORANGE, 0.3, true); yb(12.56, 10.44, 0.14, 0.14, 0.55, 0.78, C.plant, 0.2, true);   // pumpkins and a melon on it (drawn only)
    yb(5.12, 9.08, 0.09, 0.09, 0, 0.04, C.metal, 0.3, true); yb(4.95, 9.4, 0.08, 0.08, 0, 0.04, CLAY, 0.6, true);   // the hens' feed pan and water dish, inside the run
    L.bucket(8.6, 13.95, C.metal);
    { K.prop('cardboard', 7.1, 13.8, 0, 1.5, [{ off: [0, 0.12, 0], h: [0.15, 0.12, 0.15], yaw: 0, albedo: STRAW }]); L.own('basket'); }

    // ---- THE BACK STRIP — TWO places, the north gate between them, everything on the OUTER wall (the house wall hides its own foot from the camera, and the
    // lane runs along it). WEST of the gate THE BAKERY: the wood pile and the chopping block, the day's flat breads laid out on a cloth on a bench against
    // the wall (raised: on the ground the house wall hid them), the clay oven with soot up the wall above it, its paddle stood against the wall. EAST of the
    // gate (past the wall its free jamb stacks on) THE WASH PLACE: the water barrel, the copper tub, the washing on its line. Under the kitchen's window
    // (the house side) nothing; the gate's own ground bare. Colour: soot and bread west, washing colours east
    L.room('backstrip');
    bx(10.7, 12.2, 4.14, 4.75, 0, 0.2, C.woodDark); bx(10.8, 12.1, 4.16, 4.7, 0.2, 0.34, C.wood); bx(11.0, 11.9, 4.18, 4.6, 0.34, 0.45, C.woodDark);   // the wood pile
    pot(12.85, 4.45, 0.2, 0, 0.4, C.wood); yb(12.85, 4.45, 0.02, 0.2, 0.4, 0.44, C.metal, 0.7, true);              // the block and the axe
    bx(14.3, 15.5, 4.14, 4.52, 0.5, 0.54, C.wood); bx(14.36, 14.5, 4.16, 4.5, 0, 0.5, C.partTan); bx(15.3, 15.44, 4.16, 4.5, 0, 0.5, C.partTan);   // the bread bench: a board on two mud-brick piers, hard on the outer wall
    bx(14.38, 15.42, 4.17, 4.49, 0.54, 0.546, C.white, true);                                                     // a cloth on it …
    for (const [x, r, h, w] of [[14.62, 0.13, 0.05, 0.3], [14.94, 0.13, 0.08, 0.5], [15.24, 0.12, 0.04, 0.1]] as const) yb(x, 4.33, r, r, 0.546, 0.546 + h, BREAD, w, true);   // … and the day's flat breads in three stacks
    oct(16.5, 4.56, 0.42, 0, 0.8, C.cardboard);   /* (the level's mud tan by NAME: an unnamed clay colour would break as sheet metal) */ yb(16.5, 4.56, 0.17, 0.17, 0.8, 0.808, C.black, 0.4, true);         // the oven: a clay drum against the wall, its black mouth
    L.hung(16.5, 4.127, true, 0.7, 0.8, 2.1, C.black, 0.014);                                                     // soot up the wall above it
    bx(17.12, 17.3, 4.125, 4.155, 0, 1.5, C.woodDark, true);                                                      // the paddle, stood against the wall
    oct(27.7, 4.45, 0.24, 0, 0.85, P.enamelBlue);                                                                 // the wash place: the water barrel (a painted drum)
    bx(28.2, 29.1, 4.16, 4.64, 0, 0.32, COPPER);                                                                  // the copper tub
    bx(29.5, 29.56, 4.27, 4.33, 0, 1.75, C.wood); bx(31.8, 31.86, 4.27, 4.33, 0, 1.75, C.wood); bx(29.53, 31.83, 4.295, 4.305, 1.68, 1.7, BROWN, true);   // the washing line, a hand off the wall (inside the tub's own depth: the lane walks clear of it): two posts, the cord (drawn only)
    for (const [x0, x1, y0, a] of [[29.7, 30.3, 0.8, CREAM], [30.4, 30.8, 1.0, C.chair], [30.9, 31.3, 0.7, ORANGE], [31.35, 31.7, 1.1, TEAL]] as const) bx(x0, x1, 4.285, 4.315, y0, 1.68, a as Vec3, true);   // a sheet, a shirt, a shawl, a child's dress on it
    bx(17.55, 17.89, 4.14, 4.3, 0, 0.44, P.brass);                                                                // a yellow oil can against the wall (not loose: the strip is a lane)

    // ---- THE EAST ALLEY — the brick yard: the house is made of this. The earth heap with the spade on it, the wet mixing pit beside it with the bucket, the
    // mould, and twelve mud bricks drying on the ground in rows (drawn only): six still dark, six dried pale; dried bricks stacked on the east wall, and north
    // of them a low wall begun with a string line. Further down, on its own, the latrine: a head-high screen north, a chest-high one west, the compound wall
    // east, open to the south. Colour: wet mud dark
    // on dry mud
    L.room('alley');
    for (let k = 0; k < 14; k++) { if (k === 9 || k === 12) continue; const i = k >> 1, j = k & 1, x = 34.3 + j * 0.72, z = 11.05 + i * 0.52, edge = i === 4;
      bx(x, x + 0.6, z + (edge ? 0.1 : 0), z + (edge ? 0.22 : 0.34), 0, edge ? 0.16 : 0.08, i < 3 ? WETBRICK : BRICK, true); }   // the rows: six dark, six pale, two gaps, one turned on edge
    bx(33.85, 34.15, 11.3, 11.64, 0, 0.09, C.wood, true); bx(33.89, 34.11, 11.34, 11.6, 0.09, 0.094, WETBRICK, true);   // the mould, a brick in it
    bx(33.5, 34.5, 9.25, 10.25, 0, 0.02, BRICK, true); bx(33.62, 34.38, 9.37, 10.13, 0.02, 0.026, SOIL, true);     // the mixing pit: wet mud, a paler trodden rim
    bx(34.6, 35.86, 9.2, 10.4, 0, 0.3, C.woodDark); yb(35.25, 9.8, 0.42, 0.4, 0.3, 0.58, C.woodDark, 0.4);          // the earth heap (dark-wood brown: a blast thuds in it, it does not ring)
    bx(35.22, 35.28, 9.5, 10.14, 0.58, 0.62, C.wood, true); bx(35.14, 35.36, 10.14, 10.38, 0.3, 0.33, C.metal, true);   // the spade laid on it: a pale shaft, the blade
    bx(35.3, 35.86, 7.4, 8.6, 0, 0.5, C.partTan); bx(35.34, 35.84, 7.5, 8.2, 0.5, 0.75, C.partTan);                 // dried bricks, stacked: the house wall's own colour
    bx(34.7, 35.86, 5.5, 5.74, 0, 0.16, C.partTan); bx(35.3, 35.86, 5.5, 5.74, 0.16, 0.26, C.partTan);               // what they are for: a wall begun off the east wall, two courses and part of a third …
    bx(34.4, 34.43, 5.6, 5.63, 0, 0.34, C.wood, true); bx(34.43, 35.86, 5.61, 5.62, 0.3, 0.306, C.white, true);     // … a peg and the mason's string over it
    bx(34.5, 35.88, 19.88, 20.0, 0, 1.8, C.partTan); bx(34.5, 34.62, 20.0, 21.12, 0, 1.2, C.partTan);               // the latrine's mud screens: head high on the north, chest high on the west, OPEN to the south (the camera's side: the plate shows)
    bx(34.95, 35.45, 20.25, 20.75, 0, 0.05, C.concrete, true); bx(35.12, 35.28, 20.4, 20.6, 0.05, 0.056, C.black, true); yb(34.95, 21.3, 0.07, 0.07, 0, 0.22, P.enamelBlue, 0.3, true);   // the plate; the ewer stood outside the way in
    L.bucket(34.75, 10.62, C.metal);                                                                             // the bucket, at the heap's foot (out of the lane)

    // ---- THE FORECOURT — the old man's seat: the rope bed against the house wall under a shade of reed slats on two poles, his water pipe beside it with its
    // hose, his walking stick across the quilt; geraniums in blue oil tins along the wall, a ball by the look's hopscotch; toward the truck, what only a
    // forecourt has room for: threshed grain drying on a sheet, the rake and the winnowing tray on it (drawn only). No tea here (the sala's is the
    // level's tray). Colour: tin blue
    L.room('forecourt');
    bx(18.6, 20.5, 19.14, 20.04, 0.36, 0.44, C.wood); for (const [x, z] of [[18.64, 19.18], [20.46, 19.18], [18.64, 20.0], [20.46, 20.0]] as const) bx(x - 0.035, x + 0.035, z - 0.035, z + 0.035, 0, 0.36, C.wood);   // the rope bed
    bx(18.68, 20.42, 19.22, 19.96, 0.44, 0.446, P.canvas, true); bx(19.75, 20.43, 19.21, 19.97, 0.44, 0.52, C.chair, true); yb(18.9, 19.59, 0.16, 0.26, 0.446, 0.546, CREAM, 0, true);   // its webbing, a blue quilt at its foot, the pillow
    for (const x of [18.5, 19.7]) bx(x, x + 0.06, 20.1, 20.16, 0, 2.0, C.wood);                                   // the shade: two poles …
    bx(18.5, 19.76, 20.1, 20.16, 2.0, 2.05, C.wood, true); for (let k = 0; k < 4; k++) bx(18.56 + k * 0.3, 18.72 + k * 0.3, 19.13, 20.22, 2.05, 2.08, STRAW, true);   // … a beam, four reed slats from it to the wall (gaps: the bed shows)
    pot(18.2, 19.75, 0.15, 0, 0.3, P.brass); bx(18.18, 18.22, 19.73, 19.77, 0.3, 0.75, C.black); L.thing(18.2, 0.75, 19.75, 0.06, 0.05, 0.06, CLAY); bx(18.3, 18.8, 19.98, 20.01, 0, 0.03, C.partRed, true);   // the water pipe: base, stem, bowl, the hose to the bed
    yb(20.0, 19.6, 0.45, 0.015, 0.52, 0.55, C.woodDark, 0.15, true);                                              // his walking stick across the quilt
    for (let k = 0; k < 5; k++) { const x = 14.7 + k * 0.6; bx(x, x + 0.3, 19.15, 19.45, 0, 0.36, P.enamelBlue); bx(x + 0.03, x + 0.27, 19.18, 19.42, 0.36, 0.52, C.plant); yb(x + 0.1 + (k % 2) * 0.08, 19.3, 0.04, 0.04, 0.52, 0.56, C.red, 0, true); }   // geraniums in blue oil tins (east of the side gate's stacking wall)
    L.mat(18.5, 20.06, 20.6, 20.5, EARTH);                                                                        // worn ground at the bed
    L.mat(12.8, 20.3, 15.3, 21.6, P.canvas, 0.012); bx(13.0, 15.1, 20.45, 21.45, 0.012, 0.03, GRAIN, true);          // the second place, toward the truck: threshed grain drying on a sheet …
    bx(14.0, 15.2, 20.9, 20.94, 0.03, 0.06, C.wood, true); bx(13.98, 14.02, 20.7, 21.14, 0.03, 0.07, C.woodDark, true);   // … the rake left on it
    oct(13.4, 21.05, 0.25, 0.03, 0.07, STRAW, true);                                                              // … and the winnowing tray
    L.chair(17.7, 19.6, -Math.PI / 2, C.white);                                                                  // the second seat, drawn up to the pipe
    { K.prop('cardboard', 19.4, 21.6, 0, 0.4, [{ off: [0, 0.1, 0], h: [0.1, 0.1, 0.1], yaw: 0.6, albedo: C.red }]); L.own('ball'); }
  }

  const TEAM = { sam: [2.0, 0, 17.0] as Vec3, samYaw: Math.PI, ops: [[1.4, 0, 18.4], [2.6, 0, 18.4], [1.4, 0, 19.6], [2.6, 0, 19.6]] as Vec3[], opsYaw: Math.PI };
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices: [],
    breaker: { pos: [18.75, 1.35, 10.4], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [...TEAM.sam],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the scenarios stand the mission still): the office, a point on its west wall, the front door, and an exfil line outside the blind east wall (the test is x > exfilX: it must not be a line a man in the house is already past)
    mission: { serverRoom: { ...R.office }, entryDoor: 'o_n', rack: { index: 0, front: [24.4, 1.0, 15.2], halfW: 0.3 }, exfilDoor: 'front', exfilX: 37.0, exfilZ: 14.0 },
  };

  // ---------------- what the room clear takes from this level ----------------
  // Eight held rooms in four squads. Every room gives three or four marks, split between its doors; the first GARRISON[room] of them are the authored placement
  // — HAND-PLACED (the head's 'PLACED BY HAND'): do not reorder a room's marks without meaning to move its men. The marks past the first N are any other seed's.
  // The rooms are WRITTEN here outbuildings first, then the house from its west end to the back bedroom, but that is not the file's order: the list is put
  // HOUSE FIRST below (`roomClear.rooms = [...]`, where the reason is), and it is that order the objective marker walks.
  const men = (id: string) => GARRISON[id];
  const roomClear: StructureData = {
    name: 'the compound', maxMen: 11,
    team: TEAM,
    // THE OTHER WAY IN (`starts`: stood on only when a run asks — the mission sheet's Way in row, ?way=2, or ?way=any for a dealt one): outside the NORTH gate, along the wall east of
    // it. That gate is dark too, and opens on the strip behind the house: the pantry's back door ahead, the shed down the wall to the right, the yard's lamp behind
    starts: [{ sam: [27.0, 0, 2.2], samYaw: -Math.PI / 2, ops: [[28.4, 0, 1.6], [28.4, 0, 2.8], [29.6, 0, 1.6], [29.6, 0, 2.8]], opsYaw: -Math.PI / 2 }],
    rooms: [
      { id: 'shed', name: 'shed', bounds: { ...R.shed }, garrison: men('shed'),
        doors: [{ id: 'shed_s', from: 'west yard' }, { id: 'shed_e', from: 'back strip' }],
        marks: [
          { pos: [8.6, 0, 4.9], watch: 'shed_s', aimAt: [7.4, 1.1, 8.34] },          // PLACED 1: the north-east corner, onto the yard door — and the hard corner of the back-strip door
          { pos: [4.8, 0, 5.8], watch: 'shed_e', aimAt: [9.34, 1.1, 5.9] },          // PLACED 2: the west wall, the length of the shed onto the back-strip door (crossed corners: no door of the shed is free, and neither man stands in the other's line)
          { pos: [6.2, 0, 6.2], watch: 'shed_s', aimAt: [7.4, 1.1, 8.34] },          // PLACED 3: the middle of the floor, onto the yard door
          { pos: [8.7, 0, 7.6], watch: 'shed_e', aimAt: [9.34, 1.1, 5.9] },          // PLACED 4: the hard corner east of the yard door, up the east wall onto the back-strip door
        ] },
      { id: 'garage', name: 'garage', bounds: { ...R.garage }, garrison: men('garage'),
        doors: [{ id: 'g_n', from: 'west yard' }, { id: 'g_e', from: 'forecourt' }],
        marks: [
          { pos: [4.7, 0, 20.6], watch: 'g_e', aimAt: [10.34, 1.1, 20.4] },          // the west wall, the length of the garage onto the forecourt door
          { pos: [9.8, 0, 21.2], watch: 'g_n', aimAt: [7.4, 1.1, 18.16] },           // the hard corner south of the forecourt door, onto the yard door
          { pos: [6.2, 0, 20.9], watch: 'g_n', aimAt: [7.4, 1.1, 18.16] },           // at the car's bonnet
        ] },
      { id: 'hut', name: 'guard hut', bounds: { ...R.hut }, garrison: men('hut'),
        doors: [{ id: 'hut_w', from: 'main gate' }, { id: 'hut_e', from: 'east alley' }],
        marks: [
          { pos: [29.8, 0, 23.3], watch: 'hut_w', aimAt: [26.16, 1.1, 22.4] },       // the south-east corner, the length of the hut onto the gate door
          { pos: [26.7, 0, 23.4], watch: 'hut_e', aimAt: [30.34, 1.1, 22.4] },       // the hard corner south of the gate door, onto the alley door
          { pos: [29.7, 0, 21.6], watch: 'hut_w', aimAt: [26.16, 1.1, 22.4] },       // the north-east corner, past the desk
        ] },
      { id: 'sala', name: 'sala', bounds: { ...R.sala }, garrison: men('sala'),
        doors: [{ id: 's_w', from: 'west yard' }, { id: 's_n', from: 'corridor' }, { id: 's_e', from: 'hall' }],
        marks: [
          { pos: [20.2, 0, 18.2], watch: 's_w', aimAt: [13.16, 1.1, 16.4] },         // PLACED 1: the south-east corner, the length of the room onto the yard door (the obvious door)
          { pos: [13.8, 0, 15.3], watch: 's_e', aimAt: [20.84, 1.1, 16.4] },         // not placed (the sala's garrison is 1; any other seed's): the north-west corner, the length of the room onto the hall door — the hard corner of the yard door. Nobody watches the corridor door
          { pos: [20.3, 0, 15.2], watch: 's_w', aimAt: [13.16, 1.1, 16.4] },         // the north-east corner, north of the hall door
          { pos: [16.4, 0, 17.5], watch: 's_n', aimAt: [15.4, 1.1, 14.66] },         // the middle of the floor, onto the corridor door
        ] },
      { id: 'kitchen', name: 'kitchen', bounds: { ...R.kitchen }, garrison: men('kitchen'),
        doors: [{ id: 'k_s', from: 'corridor' }, { id: 'k_p', from: 'pantry' }],
        marks: [
          { pos: [14.4, 0, 10.4], watch: 'k_p', aimAt: [18.34, 1.1, 8.9] },          // PLACED: the south-west, past the counter, across the room onto the pantry door — the back door's guard (the pantry's back door is the house's), seen from the strip through the window
          { pos: [17.7, 0, 7.5], watch: 'k_s', aimAt: [16.4, 1.1, 11.34] },          // the north-east corner, beside the window, onto the corridor door
          { pos: [17.9, 0, 10.0], watch: 'k_s', aimAt: [16.4, 1.1, 11.34] },         // the hard corner south of the pantry door
          { pos: [14.6, 0, 7.4], watch: 'k_p', aimAt: [18.34, 1.1, 8.9] },           // the north-west corner, off the window's line
        ] },
      { id: 'office', name: 'office', bounds: { ...R.office }, garrison: men('office'),
        doors: [{ id: 'o_n', from: 'corridor' }, { id: 'oc', from: 'spare room' }],
        marks: [
          { pos: [24.6, 0, 18.3], watch: 'o_n', aimAt: [26.4, 1.1, 14.66] },         // the south-west corner, behind the desk
          { pos: [24.6, 0, 15.3], watch: 'oc', aimAt: [28.34, 1.1, 16.4] },          // the north-west corner, onto the spare room's door
          { pos: [27.8, 0, 18.4], watch: 'o_n', aimAt: [26.4, 1.1, 14.66] },         // the south-east corner
        ] },
      { id: 'bunk', name: 'bunk room', bounds: { ...R.bunk }, garrison: men('bunk'),
        doors: [{ id: 'a_s', from: 'corridor' }, { id: 'ab', from: 'back bedroom' }],
        marks: [
          { pos: [26.4, 0, 10.9], watch: 'a_s', aimAt: [23.4, 1.1, 11.34] },         // the south-east corner, along the south wall
          { pos: [22.4, 0, 8.6], watch: 'ab', aimAt: [26.84, 1.1, 8.9] },            // the west side, across the room onto the bedroom door
          { pos: [26.4, 0, 8.05], watch: 'a_s', aimAt: [23.4, 1.1, 11.34] },         // the hard corner north of the bedroom door
        ] },
      { id: 'back', name: 'back bedroom', bounds: { ...R.back }, garrison: men('back'),
        doors: [{ id: 'ab', from: 'bunk room' }, { id: 'b_s', from: 'corridor' }],
        marks: [
          { pos: [32.3, 0, 10.6], watch: 'ab', aimAt: [27.16, 1.1, 8.9] },           // the south-east corner, the length of the room onto the bunk room's door
          { pos: [28.6, 0, 10.7], watch: 'b_s', aimAt: [31.4, 1.1, 11.34] },         // the south side, past the locker, onto the corridor door
          { pos: [29.9, 0, 8.3], watch: 'b_s', aimAt: [31.4, 1.1, 11.34] },          // the middle of the floor
          { pos: [30.0, 0, 7.2], watch: 'ab', aimAt: [27.16, 1.1, 8.9] },            // between the desk and the bed
        ] },
    ],
    // WHO HOLDS WHAT (squad-format.md: the data says who and where, never what a squad does when)
    squads: [
      { id: 'yard', name: 'Yard', rooms: ['garage', 'shed'], rally: [6.2, 0, 20.9] },                             // the two outbuildings on the west yard: the men who come across it (five in two rooms)
      { id: 'gate', name: 'Gate', rooms: ['hut'], rally: [28.2, 0, 22.6], mayLeave: false },                       // the gate guard in his hut: one man, he stays (he used to be the Yard's third room, and its man who came round by the forecourt door of the garage)
      { id: 'west', name: 'West', rooms: ['kitchen', 'sala'], rally: [16.4, 0, 17.5] },                           // the house's west end (two, one a room: they hold it)
      { id: 'keep', name: 'Keep', rooms: ['office', 'bunk', 'back'], rally: [29.9, 0, 8.3], barricade: ['o_n', 'a_s', 'b_s'], mayLeave: false },   // the east end: they stay, and wedge only their corridor doors
    ],
  };
  // THE FILE ORDER OF THE ROOMS is the order the objective marker walks them from the west gate (roomclear.ts firstOpen: the first still held): THE HOUSE FIRST, the
  // sala leading — the marker stands on what the mission is, and names neither outbuilding (it stood on the shed, the first room of one of the answers).
  // A room's own marks keep their order: the placement is theirs.
  roomClear.rooms = ['sala', 'kitchen', 'office', 'bunk', 'back', 'garage', 'shed', 'hut'].map(id => roomClear.rooms.find(r => r.id === id)!);
  // THE FLOOR NOBODY HOLDS, BY NAME (scene/scenarios.ts PlacesData — words only, nothing in the simulation reads it): what a line on their net, a cue or
  // the debrief calls a spot that is no room of the structure. The house's four unheld spaces, then the yard's four pieces as the head describes them
  // (first match wins, the structure's rooms before any of these: the west yard's rectangle may run over the garage's wall).
  const places: PlacesData = { areas: [
    { name: 'front hall', bounds: { ...R.hall } }, { name: 'pantry', bounds: { ...R.pantry } }, { name: 'corridor', bounds: { ...R.corridor } }, { name: 'spare room', bounds: { ...R.spare } },
    { name: 'side yard', bounds: { x0: 4.12, x1: 12.88, z0: 8.62, z1: 19.12 } },
    { name: 'back strip', bounds: { x0: 9.62, x1: 12.88, z0: 4.12, z1: 8.62 } }, { name: 'back strip', bounds: { x0: 12.88, x1: 33.0, z0: 4.12, z1: 6.38 } },
    { name: 'alley', bounds: { x0: 33.12, x1: 35.88, z0: 4.12, z1: 23.88 } }, { name: 'alley', bounds: { x0: 30.62, x1: 33.12, z0: 19.12, z1: 23.88 } },
    { name: 'forecourt', bounds: { x0: 10.5, x1: 30.62, z0: 19.12, z1: 23.88 } },
  ] };
  // what a row calls the doors no room of the structure names (scenarios.doorNames — game/doornames.ts; no bearing in a name)
  const doorNames = [{ door: 'p_back', name: 'pantry back door' }, { door: 'c_n', name: 'spare room door' }, { door: 'hall_n', name: 'corridor-side front hall door' }, { door: 'p_s', name: 'corridor-side pantry door' }, { door: 'yard_sw', name: 'forecourt to side yard door' }, { door: 'gate_w', name: 'side yard gate' }, { door: 'gate_n', name: 'back gate' }];
  const scenarios: LevelScenarios = { roomClear, places, kitView: COMPOUND_KITVIEW, doorNames };
  // ---------------- what is underfoot (game/floor.ts: which step sounds, and how far it carries to their ears) ----------------
  // `building` is everything inside the perimeter wall and its base is the YARD: packed earth, which the six materials have no word for — 'asphalt' is the
  // nearest (hard, a little under lino; 'grass' would hand the team a silent approach the picture does not promise). Over it: the house's tiled floor and the
  // three outbuildings' bare slabs. Outside the wall: the scrub north and west (x or z under 3.2, where the grass slabs are — the team starts on it), asphalt
  // south and east.
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 3.2, inside: 'asphalt', outside: 'asphalt', verge: 'grass',
    zones: [
      { id: 'house', mat: 'lino', x0: 13, z0: 6.5, x1: 33, z1: 19 },
      { id: 'garage', mat: 'stone', x0: 4, z0: 18, x1: 10.5, z1: 24 },
      { id: 'shed', mat: 'stone', x0: 4, z0: 4, x1: 9.5, z1: 8.5 },
      { id: 'hut', mat: 'stone', x0: 26, z0: 21, x1: 30.5, z1: 24 },
    ],
  };
  return { level, scenarios, groups: trace.groups, surfaces };
}
