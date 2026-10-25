// TUT-PLAN — the tutorial's plan mode mission, "On the radio": ONE WALLED POST, AND NOBODY OF THE PLAYER'S IS ON ITS FLOOR. The four do everything:
// the mission is plan mode's own orders (game/planmode.ts) and nothing else, so every stop is a thing ONE order to everybody cannot do and a plan can.
// Nobody could say that of another level: here the player has no man, no feet and no trigger, only the view and the two buttons.
// THE SEAT (10-23, the maintainer: "i think having the 2nd tutorial is fine, but we should remove the player character" · "and then 4th tutorial
// teaches entering and exiting plan mode"): the frame's sky seat with the mode held up (`rails.sky.plan`, rails.ts RAILS.skyUp) — the player is parked
// outside the wall, out of the picture and every sense, the mode is up from the first tick and no key puts it down, and its view starts on the four and
// goes where the walk keys take it. Before that day he knelt at the gate with the handset, and for a few hours walked to three spots behind the squad.
//
//        x 5     9  11    15        21 22  24.5              32.5  35
//   z 5  ┌────────────────────── back gate ───────────────────────┐
//        │               ┌─────────┐  ╎                           │
//        │               │guardroom│side    ▬barrier     blocks▮  road
//        │               │  (2)    │door        B ↑       A →     gate
//   z 11 │               └──door───┘  ╎                           │
//  track │      ▮blocks                    ┌─front──────────────┐ │   the lane (2)
//  gate  │      the four                   │  the hall    ▮gun  │ │   comes by the back gate,
//        │  ▭ their truck                  │   (2)        bags  │ │   the road (2) by the road gate
//   z 19 │                                 └────────────back────┘ │
//   z 23 └────────────────────────────────────────────────────────┘
//
// THE HAND PLACEMENT, AND WHY
//   · the guardroom is the EASY room with two doors on two walls: the first plan is only the mechanics — a pair on each door, one word — and it wins
//     because two men cannot watch two doors.
//   · the hall is the room one stack loses. Its gun sits behind bags at the far end and looks down the room's length at the front door: men who come in
//     by it are taken from the side. The back door is at the gunner's shoulder. A pair on each, sent by one word, and the gun is turned to the wrong door.
//   · then more come, by the two gates at once: a pair behind the bags facing the road gate, a pair behind the barrier facing the back gate. A way
//     to face is plan mode's right drag, and two gates are the reason to want two of them.
//   · THE FOUR START inside the track gate by their truck, behind blocks no door and no gate of the post has a line to, and hold there until the first
//     order (the seat's own rule: with nobody to fall in on, a man with no order holds where the mission stood him).
//
//   bun run tools/levels/export.ts tut-plan [--check]      → levels/tut-plan.json
//   bun run tools/qa/lesson-check.ts tut-plan               the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts tut-plan                 the scripted player through every step
//   page: ?levelFile=tut-plan.json&roomclear=1&squad4
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LessonData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'tut-plan';
export const NOTES = 'The tutorial\'s plan mode mission: a walled post led from above with plan mode held up and nobody of the player\'s on the floor. Two doors at once, a gun turned to the wrong door, two gates covered. Regenerate: bun run tools/levels/export.ts tut-plan';
export const MATERIALS = GWOT_MATERIALS;

const HALF = Math.PI / 2;
const YARD: Rect = { x0: 5, x1: 35, z0: 5, z1: 23 };
type Side = 'n' | 's' | 'e' | 'w';
interface HutDoor { name: string; side: Side; at: number; extra?: Partial<LevelDoorDef> }
interface HutSpec { x0: number; z0: number; x1: number; z1: number; kind?: 'mud' | 'mudLight' | 'render' | 'block'; doors: HutDoor[]; floor?: 'mudFloor' | 'slab' }

export function build() {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];
  let huts = 0;

  // ---- the ground, the yard wall and its three gates ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(YARD.x0, YARD.z0, YARD.x1, YARD.z1, 'dirt');
  G.ground(0, 12.6, 5, 15.4, 'gravel'); G.ground(35, 8.6, 40, 11.4, 'gravel');   // the track in, the road out
  G.ground(8, 11.4, 24, 16.4, 'gravel', 0.006);                                  // the yard's worn middle, gate to hall
  // THE GROUND AS THE POST IS USED (a yard of one dirt read as a floor plan from above): the track runs on through its gate to the worn middle; a walked
  // way of gravel from the road gate, which the post has since shut with its bags laid across it, on past the barrier, and another down from the back gate to meet it at the guardroom's side door; and the
  // relay's dish and its generator stand on a poured pad of their own. The stains and the stones that go with them are with the yard's things below
  G.ground(5, 12.6, 8, 15.4, 'gravel', 0.006);
  G.ground(24, 9.0, 35, 11.0, 'gravel', 0.006); G.ground(21.3, 5.1, 22.7, 9.0, 'gravel', 0.006); G.ground(21.3, 9.0, 24, 11.4, 'gravel', 0.006);   // (the last is where the three ways meet, down to the worn middle)
  G.ground(33.1, 15.2, 34.9, 19.3, 'slab', 0.006);
  grp('walls.yard');
  const gateW = [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }], gateE = [{ a: 9.4, b: 10.6, y0: 0, y1: 2.2 }], gateN = [{ a: 21.4, b: 22.6, y0: 0, y1: 2.2 }];
  G.yardWallX(YARD.z0, 4.88, 35.12, 'mud', gateN); G.yardWallX(YARD.z1, 4.88, 35.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gateW); G.yardWallZ(YARD.x1, YARD.z0, YARD.z1, 'mud', gateE);
  for (const [x, z] of [[5, 5], [5, 23], [35, 5], [35, 23], [13, 5], [28, 5], [20, 23]] as const) G.pier(x, z);
  doors.push({ name: 'gate_w', hinge: [5.0, 13.42], closedDir: HALF, width: 1.16, exterior: true }, { name: 'gate_e', hinge: [35.0, 9.42], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [21.42, 5.0], closedDir: 0, width: 1.16, exterior: true });
  // ---- light: a thin moon the hour swaps for its sun, and pools of lamp light — the gate he kneels at, each door the squad is sent to, each gate men come by ----
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.22, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
  G.floodLight(5.6, 11.2, [0.9, 0.42], 'flood_gate', true, 3.6);        // over the track gate, thrown along the yard at the truck and the four
  G.floodLight(34.4, 12.2, [-0.95, -0.3], 'flood_road', true, 3.6);     // by the road gate, thrown west over the ground both gates open onto
  G.lantern(9.3, 15.1, 'lantern_radio', 'yard', 0);                     // his own, at his knee
  G.lantern(22.9, 6.0, 'lantern_back', 'yard', 0);                      // inside the back gate
  G.lantern(23.6, 18.4, 'lantern_well', 'yard', 0);

  // the mains breaker (on the yard's south wall) and one emergency beacon: the game's blackout wants both
  grp('breaker');
  const brk = add({ c: [16.0, 1.35, 22.84], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const led = add({ c: [15.82, 1.62, 22.79], h: [0.015, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  const breaker: Level['breaker'] = { pos: [16.0, 1.35, 22.7], boxes: [brk, led] };
  grp('beacons');
  add({ c: [10.3, 2.28, 5.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [10.3, 2.16, 5.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  /** a room: shell walls on the rect's lines, a floor, a roof the camera sees through, each door's 1.2 m opening cut and its leaf hung → its inside rect */
  const hut = (h: HutSpec): Rect => {
    const kind = h.kind ?? 'mud', n = huts++, t = GW_SHELL / 2;
    grp(`hut${n}.floor`); G.ground(h.x0, h.z0, h.x1, h.z1, h.floor ?? 'mudFloor', 0.006);
    grp(`hut${n}.roof`); slab(h.x0 - 0.1, H, h.z0 - 0.1, h.x1 + 0.1, H + 0.2, h.z1 + 0.1, kind === 'render' ? P.render : P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
    grp(`hut${n}.walls`);
    const holes = (side: Side) => h.doors.filter(d => d.side === side).map(d => ({ a: d.at, b: d.at + 1.2 }));
    G.wallX(h.z0, h.x0 - t, h.x1 + t, kind, holes('n')); G.wallX(h.z1, h.x0 - t, h.x1 + t, kind, holes('s'));
    G.wallZ(h.x0, h.z0 + t, h.z1 - t, kind, holes('w')); G.wallZ(h.x1, h.z0 + t, h.z1 - t, kind, holes('e'));
    for (const d of h.doors) {
      const alongX = d.side === 'n' || d.side === 's';
      doors.push({ name: d.name, hinge: alongX ? [d.at + 0.02, d.side === 'n' ? h.z0 : h.z1] : [d.side === 'w' ? h.x0 : h.x1, d.at + 0.02], closedDir: alongX ? 0 : HALF, width: 1.16, ...d.extra });
    }
    zones.push({ id: `hut${n}`, mat: 'stone', x0: h.x0, z0: h.z0, x1: h.x1, z1: h.z1 });
    return { x0: h.x0 + t, x1: h.x1 - t, z0: h.z0 + t, z1: h.z1 - t };
  };

  // ---- the gate he leads from: his blocks, the four's truck ----
  grp('halt');
  G.hesco(10.0, 14.6, 2, HALF);                                     // HIS blocks: he kneels west of them, and nothing in the post has a line over them to a man on a knee
  G.pickup(9.4, 17.6, 0.05, 'truckWhite', { load: 'crates' });      // the truck they came in
  G.crates(7.0, 16.2, 0.3, 2, 'olive'); G.jerryCan(7.4, 12.2); G.drums(6.2, 19.6, 2);

  // ---- the guardroom: two doors on two walls, two men. The first plan ----
  const GUARD = hut({ x0: 15, z0: 6.5, x1: 21, z1: 11, kind: 'block', floor: 'slab', doors: [{ name: 'guard', side: 's', at: 17.2 }, { name: 'guard_side', side: 'e', at: 7.8 }] });
  grp('guardroom.room');
  G.cot(15.7, 7.6, 0); G.trunk(16.9, 7.0, 0); G.table(19.3, 10.2, 1.2, 0.6, 0); G.plasticChair(19.3, 9.5, 0); G.bulb(18.0, 8.6, 'bulb_guardroom', 'guardroom');
  G.stove(15.55, 10.4); G.gasBottle(20.55, 10.55); G.rug(17.9, 8.7, 2.0, 1.4, 'baluch');

  // ---- the hall: the gun behind its bags at the far end looks down the room at the front door; the back door is at the gunner's shoulder ----
  const HALL = hut({ x0: 24.5, z0: 13, x1: 32.5, z1: 19, kind: 'render', floor: 'slab', doors: [{ name: 'hall', side: 'n', at: 25.4 }, { name: 'hall_back', side: 's', at: 30.0 }] });
  grp('hall.room');
  G.sandbags(30.1, 15.0, 2.4, HALF, 5);                             // across the room, z 13.8 … 16.2: chest high to the front door, nothing to the back one
  G.rug(27.2, 16.2, 3.0, 2.2, 'afghan'); G.toshak(25.4, 17.6, 1.9, HALF, 'rugGreen'); G.trunk(28.4, 18.4, 0, 'paintBlue'); G.crates(32.0, 13.6, 0.2, 1, 'olive');
  G.tube(28.4, 16.0, true, 'hall');
  G.lowTable(26.45, 17.6, HALF); G.table(31.95, 17.3, 1.2, 0.6, HALF);                     // tea by the cushions; the relay's set on its bench by the far wall

  // ---- the ground the two gates open onto: the bags that face the road gate, the barrier that faces the back gate ----
  grp('yard.cover');
  G.sandbags(30.4, 10.25, 2.4, HALF, 5);                            // A: chest-high bags (a rifle goes over them): a pair behind them (west of them) looks east at the road gate
  // B: a pair behind it (south of it) looks north at the back gate. WHERE IT STANDS (a player's tape, 10-22: his click fell 1.25 m west of the mark, the move put
  // the second man in the corner south of the guardroom, the way to face had no line for him there and he stood looking at a wall): a move's places are the
  // squad's own (roomfit.ts: a few steps round the click, a wall at the back), so the post is where a hand that lands a metre and a half off still gets two men
  // who see the gate — clear of that corner to the west (the drums below fill it) and of the hall's front door to the east, whose picture stands over the
  // ground north of it and takes a right click there (clicks swept with `TUTPLAN_POSTB`: docs/agents/missions.md)
  G.jersey(24.0, 9.3, 2, 0);
  grp('yard');
  G.drums(20.7, 11.65, 2);                                          // in the corner south of the guardroom: a man put there by a move to the barrier had the guardroom between him and the back gate
  G.drums(33.6, 6.4, 3); G.tyres(26.6, 6.2, 3); G.woodPile(13.0, 6.2, 0, 1.6); G.waterTank(13.4, 20.6); G.pump(14.9, 20.4, 0); G.blocks(21.4, 20.8, 0.2, 2);
  G.tyres(33.6, 21.6, 4); G.handcart(18.2, 18.6, 0.4, 'sacks'); G.ruts(8, 12.2, 22, 16, 'dirt'); G.patch(13.6, 19.8, 2.6, 1.8, 'damp', 0.2);
  G.bush(6.2, 6.4); G.bush(6.4, 21.6, 1.2); G.bush(33.8, 14.6); G.bush(23.2, 22.2, 1.1);
  // what the post is FOR, and who lives in it: the relay's dish and its generator in the strip behind the hall, a cooking corner by the wood, washing on a line,
  // a bed somebody carried out into the cool, the runner's motorbike by the track gate
  G.satDish(34.1, 16.0, HALF, 2.4); G.generator(34.45, 18.4, HALF); G.wire(32.5, 16.4, 34.1, 16.0, 2.5); G.jerryCan(34.3, 20.0, 0.4);
  G.tandoor(11.2, 6.5); G.sacks(9.4, 6.2, 0.2, 3); G.washLine(16.4, 21.7, 20.2, 21.7, 4); G.charpoy(22.3, 16.4, HALF); G.motorbike(6.7, 10.2, 1.2);
  // what the ground carries of all that (the ground need: no 40 m² of the yard is one bare sheet): oil under the generator on its pad and where the motorbike drips into the dirt (soaked in: the dark of damp, since oil's own paint is no darker than dirt), water thrown out of the hall's
  // back door and off the cooking corner, drips under the washing, the pit behind the hall where the post burns its rubbish, and field stones along the
  // foot of the yard wall where nobody sweeps. Every patch is darker than the ground it lies on and none under a third of it (STYLE.md); the stones are under 0.19 m, stepped over, and clear of the wall's face
  G.patch(34.2, 18.3, 1.2, 1.0, 'oil', 0.2); G.patch(6.9, 10.0, 1.1, 0.8, 'damp', 0.4);
  G.patch(29.2, 20.3, 2.0, 1.3, 'damp', -0.3); G.patch(8.3, 8.3, 1.8, 1.2, 'damp', 0.6); G.patch(18.3, 21.9, 3.2, 0.8, 'damp', 0.05);
  G.patch(25.8, 21.9, 1.7, 1.3, 'damp', 0.5); G.rubble(25.8, 21.9, 0.55, 6, 'mudDark');
  G.rubble(31.6, 21.8, 0.8, 7); G.rubble(29.6, 6.3, 0.8, 7); G.rubble(7.0, 7.6, 0.6, 5); G.rubble(8.6, 21.6, 0.9, 8); G.rubble(6.3, 17.4, 0.5, 5);
  G.skirt('x', 23, 5, 35, -1); G.skirt('x', 5, 5, 21.3, 1); G.skirt('x', 5, 22.7, 35, 1);   // (the band stops at the back gate's jambs)

  // ---- outside the two gates: a blast wall across each way in, as a checkpoint has. Nothing inside the yard sees past them, the men who wait there least of all ----
  grp('checkpoint.east');
  G.tWall(37.2, 10.0, 4, HALF); G.jersey(38.4, 12.6, 1, 0.3); G.drums(39.0, 7.4, 2); G.drumDown(36.2, 6.1, 0.5); G.crates(39.25, 9.8, 0.2, 1); G.plasticChair(39.2, 10.7, -HALF);
  grp('checkpoint.back');
  G.tWall(22.0, 2.6, 4, 0); G.tyres(18.4, 3.2, 3); G.drums(26.2, 2.2, 2);

  // ---- what the room clear takes from this level ----
  const SAM: Vec3 = [8.75, 0, 14.25];
  const WALL: Vec3 = [13.9, 0, 9.25];                                 // the guardroom's blank west wall: where the four wait while the first plan is laid
  const POST_A: Vec3 = [29.25, 0, 10.25], POST_B: Vec3 = [24.0, 0, 10.3];
  const GATE_E: Vec3 = [35.0, 0, 10.0], GATE_N: Vec3 = [22.0, 0, 5.0];
  const ROAD: Rect = { x0: 35.3, x1: 39.7, z0: 5.4, z1: 13.4 }, LANE: Rect = { x0: 17.4, x1: 27.4, z0: 0.4, z1: 4.7 };
  const IN_FRONT: Vec3 = [26.0, 1.1, 13.6];
  const roomClear: StructureData = {
    // (a lesson is read at a person's pace: its men would always get the minute to dig in, and its lines lean on them standing where they were put)
    digIn: false, maxMen: 11,
    name: 'the post',
    team: { sam: SAM, samYaw: HALF, ops: [[11.4, 0, 12.75], [11.4, 0, 13.75], [12.4, 0, 12.75], [12.4, 0, 13.75]], opsYaw: HALF },
    rooms: [
      // two men and two doors: one has his back to both, the other is at the table by the street door's far side
      { id: 'guardroom', name: 'the guardroom', bounds: { ...GUARD }, garrison: 2, doors: [{ id: 'guard', from: 'yard' }, { id: 'guard_side', from: 'yard' }],
        marks: [{ pos: [16.3, 0, 8.6], watch: 'guard', aimAt: [15.3, 1.1, 7.0] }, { pos: [19.4, 0, 8.4], watch: 'guard_side', aimAt: [17.8, 1.1, 10.8] }] },
      // the gunner and the man beside him, behind the bags at the far end, both on the front door
      { id: 'hall', name: 'the hall', bounds: { ...HALL }, garrison: 2, doors: [{ id: 'hall', from: 'yard' }, { id: 'hall_back', from: 'yard' }],
        marks: [{ pos: [31.2, 0, 15.2], watch: 'hall', aimAt: IN_FRONT }, { pos: [31.4, 0, 14.2], watch: 'hall', aimAt: IN_FRONT }] },
      // the men who come: the level's script keeps them outside until the last fight (levels/tut-plan.script.ts)
      { id: 'road', name: 'the road', bounds: { ...ROAD }, garrison: 2, doors: [{ id: 'gate_e', from: 'yard' }],
        marks: [{ pos: [38.4, 0, 8.2], watch: 'gate_e', aimAt: [38.4, 1.1, 6.0] }, { pos: [38.6, 0, 11.8], watch: 'gate_e', aimAt: [38.6, 1.1, 13.0] }] },   // (behind the blast wall: each looks along it at the end he will walk round)
      { id: 'lane', name: 'the lane', bounds: { ...LANE }, garrison: 2, doors: [{ id: 'gate_n', from: 'yard' }],
        marks: [{ pos: [19.6, 0, 1.6], watch: 'gate_n', aimAt: [17.8, 1.1, 1.6] }, { pos: [24.4, 0, 1.6], watch: 'gate_n', aimAt: [26.6, 1.1, 1.6] }] },
    ],
    // a squad a room, and none may leave its room: each stop is its own fight
    squads: [
      { id: 'guard', name: 'Alpha', rooms: ['guardroom'], mayLeave: false, barricade: [] },
      { id: 'hall', name: 'Bravo', rooms: ['hall'], mayLeave: false, barricade: [] },
      { id: 'road', name: 'Road', rooms: ['road'], mayLeave: false, barricade: [] },
      { id: 'lane', name: 'Lane', rooms: ['lane'], mayLeave: false, barricade: [] },
    ],
  };

  const taken = (room: string) => ({ is: 'taken', room }), or = (...of: object[]) => ({ is: 'any', of }), and = (...of: object[]) => ({ is: 'all', of });
  const flag = (f: string) => ({ is: 'flag', flag: f }), stacks = (doors: string[], set = false) => ({ is: 'stacks', doors, ...(set ? { set } : {}) });
  const area = (p: Vec3, r: number): Rect => ({ x0: p[0] - r, x1: p[0] + r, z0: p[2] - r, z1: p[2] + r });
  // (a door's mark is 0.2 m off the leaf's middle, on the side the squad stands: the frame puts an order given near the ring on the door itself)
  const D_GUARD: Vec3 = [17.8, 1, 11.2], D_SIDE: Vec3 = [21.2, 1, 8.4], D_HALL: Vec3 = [26.0, 1, 12.8], D_BACK: Vec3 = [30.6, 1, 19.2];
  const GUARD_VIEW: Vec3 = [17.5, 0, 9.5], HALL_VIEW: Vec3 = [28.0, 0, 15.5], GATES_VIEW: Vec3 = [27.0, 0, 9.5];   // (each is where the view's point has to come near: further from where the view was left than its ring is wide, so no step passes by itself)
  // WHERE THE PLAYER IS PARKED: outside the wall's south-west corner, as far from both gates' roads as the world goes (the road's men wait east, the
  // lane's north). Nobody sees, hears or draws him there (rails.ts, the sky seat) and no order has anything to do with him
  const PARK: Vec3 = [2.0, 0, 25.5];
  const HALL_EYE = { at: [28.4, 1.9, 16.0] as Vec3, yaw: 0, fov: 360 };   // the hall's lookout: the player sees the gunner from the card to the go
  // WHAT EACH STEP TEACHES is its line; `cue` starts the level script's beat of that name as the step comes up; `checkpoint` = the frame keeps one as it
  // comes up. A key is written by the game's own code letter in brackets: the page draws the player's key ([B] is the squad's command key).
  // PLAN MODE'S OWN HANDS ARE ALL HE HAS (game/rails.ts `plan`: with the mode up its Shift, its walk keys and both buttons), and the mode is up for
  // the whole mission (`sky.plan`): no trigger, no feet, no sprint, not the command key's own order — he met that one from above in the mission
  // before this, and here a tap of it would undo a plan — and no key that opens or closes the mode: that is the fourth mission's lesson.
  const lesson = {
    title: 'On the radio',
    rails: { allow: ['plan', 'camera', 'zoom'], respawn: 5, lasers: false, sky: { park: PARK, plan: true } },
    steps: [
      // 1 · ONE PLAN: the view is the hand's, a right-click is an order, the digits pick men (1 to 4 a man, Shift + a digit adds him, 5 everyone: the maintainer,
      // 10-24, "change the tutorial to teach using 1, 2, 3, 4, and 5 to select squad members"), one word sends every stack that waits on it
      { id: 'view', line: 'Use [W] [A] [S] [D] to move the view over to the guardroom', explain: { title: 'Plan mode', text: "You're not on the ground for this one either. You'll watch from above and lead your squad over the radio.\nThis time you'll plan. Tell each teammate what to do, and nobody will go through a door until you say go." },
        done: or({ is: 'planView', at: GUARD_VIEW, r: 4.5 }, taken('guardroom')), at: [18.0, 1, 8.75], checkpoint: 'the gate' },
      { id: 'send', line: 'Right-click next to the guardroom wall to send your squad there', done: or({ is: 'squad', area: { x0: 12.2, x1: 14.9, z0: 6.0, z1: 12.6 }, n: 3 }, stacks(['guard']), stacks(['guard_side']), taken('guardroom')), at: WALL },
      { id: 'pick', line: 'Press [1] to pick a teammate, then hold [Shift] and press [2] to add another', explain: { title: 'Hit two doors at once', text: "The guardroom has two doors, and the guards inside can't watch both.\nPut two teammates on each door, then send them all in at once.\nEvery teammate has a number next to them, and you press that number to pick them." },
        done: or({ is: 'picked', n: 2 }, stacks(['guard', 'guard_side']), taken('guardroom')), at: [13.9, 1, 8.75] },
      { id: 'door1', line: 'Right-click the marked door to stack those two on it', done: or(stacks(['guard']), taken('guardroom')), at: D_GUARD },
      { id: 'pick2', line: 'Now pick the other two the same way, with their numbers', done: or({ is: 'picked', n: 2, free: true }, stacks(['guard', 'guard_side']), taken('guardroom')), at: [13.9, 1, 8.75] },
      { id: 'door2', line: 'Right-click the side door to stack them on it', done: or(stacks(['guard', 'guard_side'], true), taken('guardroom')), at: D_SIDE },
      // (the word's key sends the stacks of the men who are PICKED — planmode.ts chainsOf — and the last two digits picked two: [5] is everyone again)
      { id: 'all', line: 'Press [5] to pick your whole squad again', explain: { title: 'Pick everyone again', text: "When you send them in, only the teammates you've picked will go. Pick all four again so both pairs go in together." }, done: or({ is: 'picked', n: 4 }, taken('guardroom')) },
      { id: 'word', line: 'Press [F] to send both pairs in at once', done: taken('guardroom'), at: [18.0, 1, 8.75], allow: ['word'] },
      // (the two cards that follow a fight he only watches, 'hall' and 'gates', are marked `quiet`: the frame holds each until his squad's fight has been
      //  still for two seconds, to its cap — rails.ts RAILS.cardBeat. The other two cards follow an order or a pick and take the plain beat)
      // 2 · THE ROOM ONE STACK LOSES: the gun looks down the hall at the front door. A pair on each door, and it is turned to the wrong one
      { id: 'hall', line: 'Move the view over the hall', explain: { quiet: true, title: 'A gunner watching the door', text: "There's a gunner at the far end of the hall, and he's aiming at the front door. If your squad only goes in that way, they'll walk right into his fire.\nThe back door is behind him, so put a pair on each door." },
        done: or({ is: 'planView', at: HALL_VIEW, r: 3.5 }, taken('hall')), at: [28.4, 1, 16.0], eye: HALL_EYE, checkpoint: 'the hall' },
      { id: 'front', line: 'Pick two teammates and right-click the front door', done: or(stacks(['hall']), taken('hall')), at: D_HALL, eye: HALL_EYE },
      { id: 'back', line: 'Pick the other two and right-click the back door', done: or(stacks(['hall', 'hall_back'], true), taken('hall')), at: D_BACK, eye: HALL_EYE },
      // (the cue says a stack stands on EACH door: from here whichever leaf moves first, the gun is on the wrong one — levels/tut-plan.script.ts)
      { id: 'all2', line: 'Press [5] to pick your whole squad again', done: or({ is: 'picked', n: 4 }, taken('hall')), eye: HALL_EYE, cue: 'breach' },
      { id: 'word2', line: 'Press [F] to send them in through both doors', done: taken('hall'), at: [28.4, 1, 16.0], eye: HALL_EYE },   // (the lookout stays up through the word: a frame's eye is the player's picture alone — rails.ts RAILS.eyeView — so the squad picks its entry by what its own men have seen. Before that rule the eye was in the squad's fog too, the gunner seen through it made the stack given the word first take a can, and this step went without its lookout for a few builds)
      // 3 · WHICH WAY THEY FACE: more come by two gates at once. A right-click dragged is a place and a way to look
      { id: 'gates', line: 'Move the view out to the yard between the two gates', explain: { quiet: true, title: 'Cover two gates', text: "More enemies are on the way, and they'll come through the road gate and the back gate at the same time.\nRight-click and drag to send teammates to a spot and choose which way they'll face." },
        done: or({ is: 'planView', at: GATES_VIEW, r: 2.5 }, taken('road'), taken('lane')), at: [27.0, 1, 9.5], checkpoint: 'the gates' },
      { id: 'faceA', line: 'Pick two, then right-click behind the sandbags in the yard and drag toward the road gate', done: or(and({ is: 'squad', area: area(POST_A, 2.6), n: 1 }, { is: 'did', what: 'order:cover' }), taken('road')), at: POST_A, toward: GATE_E },
      { id: 'faceB', line: 'Now do the same with the other two, from the barrier toward the back gate', done: or(and({ is: 'squad', area: area(POST_B, 2.6), n: 1 }, { is: 'squad', area: area(POST_A, 2.6), n: 1 }, { is: 'did', what: 'order:cover' }), taken('lane')), at: POST_B, toward: GATE_N },
      { id: 'hold', line: 'Watch your squad hold both gates', done: and(taken('road'), taken('lane')), at: [27.0, 1, 9.5], cue: 'gates' },
    ],
  } as LessonData;
  // (an order that is out: the line is what the men are doing, not the ask again — rails.ts `after`; the word's steps carry only the line after the word)
  const AFTER: Record<string, { line?: string; word?: string }> = {
    send: { line: 'Your squad is on the way' }, door1: { line: "They're stacking up on the door" }, door2: { line: "They'll stack up and wait until you say go" },
    word: { word: 'Both pairs are going in together' }, front: { line: "They're stacking up on the front door" }, back: { line: "They're going around to the back door" },
    word2: { word: 'The pair at the back door is coming in behind the gunner' }, faceA: { line: "They're going to the sandbags to watch the road gate" },
    faceB: { line: "They're going to the barrier to watch the back gate" },
  };
  for (const t of lesson.steps) if (AFTER[t.id]) t.after = AFTER[t.id];

  for (const d of doors) doorFrame(d);
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices: [],
    breaker, beacons: [{ pos: [10.3, 2.05, 5.3], box: dome }],
    playerSpawn: SAM, routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    mission: { serverRoom: { ...HALL }, entryDoor: 'hall', rack: { index: 0, front: [27.0, 1.0, 17.0], halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: 4.2, exfilZ: 14.0, exfilOut: [-1, 0] },
  };
  const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
  const scenarios: LevelScenarios = {
    roomClear, lesson,
    places: { areas: [{ name: 'yard', bounds: { x0: 5, x1: 24.5, z0: 11, z1: 23 } }, { name: 'gates', bounds: { x0: 21, x1: 35, z0: 5, z1: 13 } }] },
    doorNames: [{ door: 'gate_w', name: 'track gate' }, { door: 'gate_e', name: 'road gate' }, { door: 'gate_n', name: 'back gate' }, { door: 'guard', name: 'guardroom door' }, { door: 'guard_side', name: 'guardroom side door' },
      { door: 'hall', name: 'hall front door' }, { door: 'hall_back', name: 'hall back door' }],
  };
  return { level, scenarios, groups: trace.groups, surfaces };
}
