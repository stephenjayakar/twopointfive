// TUT-SQUAD — the tutorial's squad mission, "A harder fight": ONE STREET through a walled yard, walked west to east with the four, and every building on it
// is one thing the other side does. Nobody could say that of another level: here the street is the lesson's order, and each stop is staged so the player SEES
// the behaviour once and then answers it.
//
//        x 5      8       13  15.5        22  23.4  27.2      31     35
//   z 5  ┌──────────────────────────── back gate ──────────────────┐
//        │      ┌───────┐   ┌───────────┐ alley ▐    mast,         │  the
//        │      │guard  │   │ workshop  side    ▐    generator     │  picket
//        │      │hut (1)│   │   (1)     door    ▐                  │  (3)
//   z 11 │      └──door─┘   └────door───┘ ▌     ▐                  │
//  track        the street ────────────── ▌wall         ▐nest (2)   road
//  gate   SAM →                           ▌      ▪blocks▐           gate
//   z 16.5      ┌──door─┐    the motor    way ┌──win──win────────┐ │
//        │      │store  │    yard      round  │  the hall (2)   door│
//        │      │  (2)  │                     │                  │ │
//   z 23 └──────┴───────┴─────────────────────┴──────────────────┴─┘
//
// THE HAND PLACEMENT, AND WHY
//   · the guard hut and the store are the two EASY rooms, door to door across the street: one man, then two, each on the mark a door's first man sees.
//   · the workshop has TWO doors on different walls. Its man holds the street door: he hears the stack through the leaf and puts rounds through it. The
//     answer is the side door, at his back: he is still on the door he heard you at.
//   · THE WALL stands across the street: everything west of it is out of the nest's sight, so the first three rooms are learnt with no gun on them. The only
//     way on is round its end, and there the gun looks straight down the street. Rounds past the gunner's head put it down; while it is down a man can make
//     the blocks. The nest is open to the sky: what finishes it is a grenade over the bags.
//   · the hall's door is locked and nobody was issued a charge for it. It is on the far face, in the passage past the nest, so nobody stands at it
//     while the nest is being fought. Its two men stand in the corners of the door's own wall, where the doorway shows nothing and a man who walks in
//     is between them; the one street window looks straight at both. So the room is cleared from outside, through the open window, and only then is the leaf
//     shot down and walked through.
//   · the picket comes by two gates at once: one man by the road gate, in front; two by the back gate, down the alley, behind whoever is still looking at
//     the road. Who comes: the post's own picket, camped up the road (the mast in the yard is what calls it).
//
//   bun run tools/levels/export.ts tut-squad [--check]      → levels/tut-squad.json
//   bun run tools/qa/lesson-check.ts tut-squad               the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts tut-squad                 the scripted player through every step
//   page: ?levelFile=tut-squad.json&roomclear=1&squad4
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LessonData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'tut-squad';
export const NOTES = 'The tutorial\'s squad mission: one street through a walled yard, two easy rooms, then a stop for each thing the other side does. Regenerate: bun run tools/levels/export.ts tut-squad';
export const MATERIALS = GWOT_MATERIALS;

const HALF = Math.PI / 2;
const YARD: Rect = { x0: 5, x1: 35, z0: 5, z1: 23 };
type Side = 'n' | 's' | 'e' | 'w';
interface HutDoor { name: string; side: Side; at: number; extra?: Partial<LevelDoorDef> }
interface HutSpec { x0: number; z0: number; x1: number; z1: number; kind?: 'mud' | 'mudLight' | 'render' | 'block'; doors: HutDoor[]; windows?: { side: Side; at: number; w?: number }[]; floor?: 'mudFloor' | 'slab' }

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
  G.ground(0, 12.6, 5, 15.4, 'gravel'); G.ground(35, 12.6, 40, 15.4, 'gravel');   // the track in, the road out
  G.ground(8, 11.2, 30, 16.3, 'gravel', 0.006);                                    // the street itself
  grp('walls.yard');
  const gateZ = [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }], gateN = [{ a: 24.4, b: 25.6, y0: 0, y1: 2.2 }];
  G.yardWallX(YARD.z0, 4.88, 35.12, 'mud', gateN); G.yardWallX(YARD.z1, 4.88, 35.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gateZ); G.yardWallZ(YARD.x1, YARD.z0, YARD.z1, 'mud', gateZ);
  for (const [x, z] of [[5, 5], [5, 23], [35, 5], [35, 23], [15, 5], [20, 23], [30, 5]] as const) G.pier(x, z);
  doors.push({ name: 'gate_w', hinge: [5.0, 13.42], closedDir: HALF, width: 1.16, exterior: true }, { name: 'gate_e', hinge: [35.0, 13.42], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [24.42, 5.0], closedDir: 0, width: 1.16, exterior: true });
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // the mains breaker (on the hall's street face) and one emergency beacon: the game's blackout wants both
  grp('breaker');
  const brk = add({ c: [34.0, 1.35, 22.84], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const led = add({ c: [33.82, 1.62, 22.79], h: [0.015, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  const breaker: Level['breaker'] = { pos: [34.0, 1.35, 22.7], boxes: [brk, led] };
  grp('beacons');
  add({ c: [20.3, 2.28, 5.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [20.3, 2.16, 5.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  /** a room: shell walls on the rect's lines, a floor, a roof the camera sees through, each door's 1.2 m opening cut and its leaf hung → its inside rect */
  const hut = (h: HutSpec): Rect => {
    const kind = h.kind ?? 'mud', n = huts++, t = GW_SHELL / 2;
    grp(`hut${n}.floor`); G.ground(h.x0, h.z0, h.x1, h.z1, h.floor ?? 'mudFloor', 0.006);
    grp(`hut${n}.roof`); slab(h.x0 - 0.1, H, h.z0 - 0.1, h.x1 + 0.1, H + 0.2, h.z1 + 0.1, kind === 'render' ? P.render : P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 });
    grp(`hut${n}.walls`);
    const holes = (side: Side) => [
      ...h.doors.filter(d => d.side === side).map(d => ({ a: d.at, b: d.at + 1.2 })),
      ...(h.windows ?? []).filter(w => w.side === side).map(w => ({ a: w.at, b: w.at + (w.w ?? 0.8), y0: 1.0, y1: 1.85 })),
    ];
    G.wallX(h.z0, h.x0 - t, h.x1 + t, kind, holes('n')); G.wallX(h.z1, h.x0 - t, h.x1 + t, kind, holes('s'));
    G.wallZ(h.x0, h.z0 + t, h.z1 - t, kind, holes('w')); G.wallZ(h.x1, h.z0 + t, h.z1 - t, kind, holes('e'));
    for (const d of h.doors) {
      const alongX = d.side === 'n' || d.side === 's';
      doors.push({ name: d.name, hinge: alongX ? [d.at + 0.02, d.side === 'n' ? h.z0 : h.z1] : [d.side === 'w' ? h.x0 : h.x1, d.at + 0.02], closedDir: alongX ? 0 : HALF, width: 1.16, ...d.extra });
    }
    zones.push({ id: `hut${n}`, mat: 'stone', x0: h.x0, z0: h.z0, x1: h.x1, z1: h.z1 });
    return { x0: h.x0 + t, x1: h.x1 - t, z0: h.z0 + t, z1: h.z1 - t };
  };

  // ---- the two easy rooms, door to door across the street ----
  const HUT = hut({ x0: 8, z0: 6.5, x1: 13, z1: 11, kind: 'block', floor: 'slab', doors: [{ name: 'guardhut', side: 's', at: 10.0 }] });
  grp('guardhut.room');
  G.cot(12.3, 8.0, HALF); G.trunk(8.6, 7.1, 0); G.table(9.2, 9.9, 1.2, 0.6, HALF); G.plasticChair(9.9, 9.6, -HALF); G.bulb(10.6, 8.6, 'bulb_guardhut', 'guardhut');
  const STORE = hut({ x0: 8, z0: 16.5, x1: 13, z1: 21.5, kind: 'mud', doors: [{ name: 'store', side: 'n', at: 10.0 }] });
  grp('store.room');
  G.sacks(8.7, 20.8, 0, 3); G.sacks(10.0, 20.9, 0.2, 2); G.crates(12.3, 20.7, 0, 2); G.drums(12.3, 17.3, 2); G.lantern(8.5, 17.0, 'lantern_store', 'store', 0);

  // ---- the workshop: two doors on different walls. Its man holds the street door ----
  const SHOP = hut({ x0: 15.5, z0: 6.5, x1: 22, z1: 11, kind: 'render', floor: 'slab', doors: [{ name: 'workshop', side: 's', at: 17.6 }, { name: 'workshop_side', side: 'e', at: 7.4 }] });
  grp('workshop.room');
  G.table(16.2, 7.6, 1.8, 0.7, HALF, 'ply'); G.drum(16.1, 10.4, 'rust'); G.tyres(21.4, 10.4, 3); G.generator(20.2, 10.2, 0);   // (nothing stands between the side door and the man on the street door)
   G.tube(18.8, 8.6, true, 'workshop'); G.jerryCan(20.9, 7.0);

  // ---- the street's furniture: where a pair waits, the barrier, the nest ----
  grp('street');
  G.pickup(14.4, 15.2, 0.06, 'truckWhite', { load: 'sacks' });      // parked off the store's corner: cover on the walk up to the workshop
  G.tWall(23.4, 14.0, 5, HALF);                                     // THE WALL across the street, z 11 … 17: the way on is round its south end, and whoever waits behind it is out of the gun's sight
  G.drums(22.8, 15.2, 2);
  G.hesco(27.6, 15.9, 2, HALF);                                     // the blocks: the next cover, under four metres short of the bags
  grp('nest');
  G.sandbags(31.0, 13.8, 2.8, HALF, 6); G.sandbags(31.9, 12.4, 1.8, 0, 6); G.sandbags(31.9, 15.2, 1.8, 0, 6);   // chest high on three sides: a head over the top is all the street sees
  G.crates(33.4, 12.2, 0.3, 1, 'olive'); G.jerryCan(33.2, 15.4);

  // ---- outside the road gate: a blast wall across the road, as a checkpoint has one. Nothing inside the yard sees past it, the picket's camp least of all ----
  grp('road');
  G.tWall(36.8, 13.4, 5, HALF); G.jersey(38.6, 15.6, 1, 0.3); G.drums(39.0, 12.4, 2); G.tyres(37.6, 6.6, 3);

  // ---- the motor yard, south of the street: nobody holds it ----
  grp('motoryard');
  G.pickup(18.4, 19.6, HALF + 0.2, 'truckRed', { load: 'drums' }); G.tyres(21.6, 21.8, 4); G.tyres(22.3, 21.4, 2); G.drums(15.2, 21.9, 3); G.drumDown(16.6, 17.6, 0.5);
  G.blocks(21.9, 18.2, 0.2, 2); G.ruts(15, 17.5, 22.5, 22, 'dirt'); G.patch(18.6, 19.4, 3.2, 2.2, 'damp', 0.3);

  // ---- the mast and its generator, north of the nest: what calls the picket ----
  grp('mast');
  G.container(31.0, 7.0, 0, 'paintRust'); G.satDish(28.6, 6.4, 0.6, 2.4); G.generator(29.0, 8.8, HALF); G.tWall(27.2, 10.0, 4, HALF);   // (its wall hides the alley's mouth from the nest)
  { const b = G.piece(33.6, 6.2, 0); b(0, 0, 0, 2.95, 0.05, 0.05, G.M.galv); b(0, 0, 2.2, 2.24, 0.5, 0.02, G.M.galv); b(0, 0, 2.6, 2.64, 0.34, 0.02, G.M.galv); }
  G.wire(29.0, 8.8, 33.6, 6.2, 2.5);

  // ---- the hall: a locked door on its far face, in the passage past the nest; a street window that looks at both its men ----
  const HALL = hut({ x0: 25.5, z0: 17, x1: 32.4, z1: 22.2, kind: 'render', floor: 'slab', doors: [{ name: 'hall', side: 'e', at: 18.9, extra: { locked: true, keySide: -1 } }],   // (the lock is on the passage's face)
    windows: [{ side: 'n', at: 30.6, w: 1.0 }] });   // (one window, at the door end: it looks at both corners, and from inside it shows only the nest's own ground)
  grp('hall.room');
  G.rug(29.6, 19.6, 3.0, 2.2, 'afghan'); G.table(28.6, 21.4, 2.0, 0.8, 0, 'ply'); G.plasticChair(28.1, 20.7, 0); G.plasticChair(29.1, 20.7, 0);
  G.toshak(27.0, 19.4, 1.9, HALF, 'rugGreen'); G.trunk(26.2, 17.5, 0, 'paintBlue'); G.tube(29.5, 19.6, true, 'hall');
  grp('yard');
  G.bush(6.2, 6.4); G.bush(6.4, 21.6, 1.2); G.bush(14.2, 6.3); G.bush(23.4, 22.2, 1.1); G.bush(34.2, 10.6);
  G.skirt('x', 23, 5, 35, -1); G.skirt('x', 5, 5, 24.7, 1); G.skirt('x', 5, 25.8, 35, 1);   // (the band stops at the back gate's jambs)

  // ---- what the room clear takes from this level ----
  // (a doorway is the kit's 0.9 m frame inside the 1.2 m hole: its middle is 0.85 m past the door's `at`)
  const D_STORE: Vec3 = [10.85, 1.1, 16.62], D_SHOP: Vec3 = [18.45, 1.1, 10.88], D_HALL: Vec3 = [32.28, 1.1, 19.75], IN_HALL: Vec3 = [31.4, 1.1, 19.75], STREET: Vec3 = [24.6, 1.1, 13.8];
  const D_SIDE: Vec3 = [22.0, 1, 8.25], END: Vec3 = [22.5, 0, 17.5], BLOCKS: Vec3 = [26.6, 0, 16.1], BAGS: Vec3 = [30.2, 0, 13.8], MOUTH: Vec3 = [25.0, 0, 10.6], LANE: Vec3 = [37.4, 1.1, 9.6];   // (the way round the blast wall's end to the road gate: what the picket looks at from its camp)
  // the picket's camp: outside the yard, up the road, behind the wall from everything inside it
  const ROAD: Rect = { x0: 35.3, x1: 39.7, z0: 6.0, z1: 13.0 };
  const roomClear: StructureData = {
    // (a lesson is read at a person's pace: its men would always get the minute to dig in, and its lines lean on them standing where they were put)
    digIn: false, maxMen: 11,
    name: 'the post',
    team: { sam: [6.4, 0, 14.0], samYaw: HALF, ops: [[7.4, 0, 12.9], [6.4, 0, 12.9], [7.4, 0, 15.1], [6.4, 0, 15.1]], opsYaw: HALF },
    rooms: [
      { id: 'guardhut', name: 'the guard hut', bounds: { ...HUT }, garrison: 1, doors: [{ id: 'guardhut', from: 'street' }],
        marks: [{ pos: [9.0, 0, 8.3], watch: 'guardhut', aimAt: [8.4, 1.1, 6.7] }] },   // (his back to the door: the first room is the squad's to win)
      { id: 'store', name: 'the store', bounds: { ...STORE }, garrison: 2, doors: [{ id: 'store', from: 'street' }],
        marks: [{ pos: [8.8, 0, 18.6], watch: 'store', aimAt: [8.3, 1.1, 20.8] }, { pos: [12.2, 0, 19.2], watch: 'store', aimAt: D_STORE }] },   // (one on the door, one counting sacks)
      // one man, on the mark that covers the street door from the far end of the room with the side door at his left shoulder
      { id: 'workshop', name: 'the workshop', bounds: { ...SHOP }, garrison: 1, doors: [{ id: 'workshop', from: 'street' }, { id: 'workshop_side', from: 'alley' }],
        marks: [{ pos: [18.2, 0, 7.3], watch: 'workshop', aimAt: D_SHOP }] },
      // the gunner and his mate behind the bags, both guns down the street: one hit does not end it, one grenade does
      { id: 'nest', name: 'the nest', bounds: { x0: 30.2, x1: 34.6, z0: 11.4, z1: 16.2 }, garrison: 2, doors: [{ id: 'gate_e', from: 'road' }],
        marks: [{ pos: [32.0, 0, 13.3], watch: 'gate_e', aimAt: STREET }, { pos: [32.0, 0, 14.4], watch: 'gate_e', aimAt: STREET }] },
      // two men in the corners of the door's own wall: nobody at the doorway can see them, and whoever walks through it is between them. The street
      // windows look straight at both
      { id: 'hall', name: 'the hall', bounds: { ...HALL }, garrison: 2, doors: [{ id: 'hall', from: 'road' }],
        marks: [{ pos: [31.75, 0, 17.9], watch: 'hall', aimAt: IN_HALL }, { pos: [31.75, 0, 21.4], watch: 'hall', aimAt: IN_HALL }] },
      // the picket, up the road: the level's script keeps it there until the hall has fallen (levels/tut-squad.script.ts)
      { id: 'road', name: 'the road', bounds: { ...ROAD }, garrison: 3, doors: [{ id: 'gate_e', from: 'street' }],
        marks: [{ pos: [38.4, 0, 11.6], watch: 'gate_e', aimAt: LANE }, { pos: [38.8, 0, 9.8], watch: 'gate_e', aimAt: LANE }, { pos: [38.4, 0, 8.0], watch: 'gate_e', aimAt: LANE }] },
    ],
    // a squad a room, and none may leave its room: each stop is its own fight, and nobody walks up the street to an earlier one
    squads: [
      { id: 'hut', name: 'Alpha', rooms: ['guardhut'], mayLeave: false, barricade: [] },
      { id: 'store', name: 'Bravo', rooms: ['store'], mayLeave: false, barricade: [] },
      { id: 'shop', name: 'Charlie', rooms: ['workshop'], mayLeave: false, barricade: [] },
      { id: 'nest', name: 'Delta', rooms: ['nest'], mayLeave: false, barricade: [] },
      { id: 'hall', name: 'Echo', rooms: ['hall'], mayLeave: false, barricade: [] },
      { id: 'picket', name: 'Picket', rooms: ['road'], mayLeave: false, barricade: [] },
    ],
  };

  const taken = (room: string) => ({ is: 'taken', room }), or = (...of: object[]) => ({ is: 'any', of }), and = (...of: object[]) => ({ is: 'all', of });
  const near = (at: Vec3, r = 1.5) => ({ is: 'near', at, r }), gave = (order: string, on?: string) => ({ is: 'did', what: `order:${order}`, ...(on ? { on } : {}) });
  const ALLEY: Rect = { x0: 22.2, x1: 27.0, z0: 5.3, z1: 10.6 };
  // WHAT EACH STEP TEACHES is its line; `cue` starts the level script's beat of that name as the step comes up; `checkpoint` = the frame keeps one as it
  // comes up (the start of a fight, never the middle of one). A key is written by the game's own code letter in brackets: the page draws the player's key.
  const lesson = {
    title: 'A harder fight',
    // (game/rails.ts: what the three missions before this one taught is on from the first step — his own feet, hands and rifle, the view, the squad's key and
    //  the word; the orders menu comes on with the step that asks for it, the frag with its step. A teammate who would go down is on a knee for a few seconds)
    rails: { allow: ['move', 'sprint', 'crouch', 'aim', 'fire', 'reload', 'slot:rifle', 'slot:pistol', 'use', 'order', 'word', 'camera', 'zoom'], respawn: 5 },
    steps: [
      // 1 · two easy rooms: the squad's key on a door, twice
      { id: 'stack-hut', line: '[B] on the guard hut door', done: or({ is: 'stackOn', who: 'all', door: 'guardhut', set: true }, taken('guardhut')), at: [10.85, 1, 11.0] },
      { id: 'go-hut', line: '[B] again: they go in', done: taken('guardhut'), at: [10.85, 1, 11.0] },
      { id: 'stack-store', line: '[B] on the store door', done: or({ is: 'stackOn', who: 'all', door: 'store', set: true }, taken('store')), at: [10.85, 1, 16.5] },
      { id: 'go-store', line: '[B] again. Follow them in', done: and(taken('store'), { is: 'in', area: { ...STORE } }), at: [10.85, 1, 18.6] },
      // 2 · THEY KNOW WHERE YOU WERE: the workshop's man shoots through the door he heard the stack at. The answer is the other door
      { id: 'stack-shop', line: '[B] on the workshop door', done: or({ is: 'stackOn', who: 'all', door: 'workshop', set: true }, taken('workshop')), at: [18.45, 1, 11.0], checkpoint: 'the street' },
      { id: 'side', line: 'He shoots through it. Go round', done: or({ is: 'in', area: ALLEY }, taken('workshop')), at: D_SIDE, cue: 'shop' },
      { id: 'shop', line: '[Space]: open the side door', done: taken('workshop'), at: D_SIDE },
      // 3 · A GUN ON THE STREET: fire puts its head down, and a man moves while it is down. A grenade over the bags ends it
      { id: 'wall', line: "[X], [3]: they follow. To the wall's end", done: or(and(or({ is: 'following' }, gave('fallIn')), near(END, 1.6)), taken('nest')), at: END, checkpoint: 'the wall', allow: ['menu', 'ring'] },
      { id: 'gun', line: 'A gun. Shoot back: it ducks', done: or({ is: 'did', what: 'event:shot', n: 3 }, taken('nest')), at: [31.6, 1.2, 13.8], cue: 'gun' },
      { id: 'blocks', line: 'While it is down: run to the blocks', done: or(near(BLOCKS, 1.3), taken('nest')), at: BLOCKS },
      { id: 'frag', line: '[5], left button: a frag over the bags', done: or({ is: 'threw', kind: 'frag' }, taken('nest')), at: [32.0, 1, 13.8], allow: ['slot:frag'] },
      { id: 'nest', line: 'Take the nest', done: taken('nest'), at: [32.0, 1, 13.8] },
      // 4 · A ROOM CAN BE CLEARED FROM OUTSIDE, AND A DOOR IS NOT A WALL: the men who wait inside the door are shot through a window; then the locked
      //     leaf is shot down, and it is the way in
      { id: 'window', line: 'Two wait inside. Shoot through the window', done: taken('hall'), at: [31.1, 1.4, 16.9], checkpoint: 'the hall' },
      { id: 'lock', line: 'Locked. Shoot the door down', done: or({ is: 'door', door: 'hall', state: 'open' }, { is: 'door', door: 'hall', state: 'unlocked' }), at: [32.6, 1, 19.75] },
      { id: 'hall', line: 'Walk in', done: { is: 'in', area: { ...HALL } }, at: [31.0, 1, 19.75] },
      // 5 · MORE COME, AND NOT ALL BY ONE WAY: one man at the road gate holds your eyes while two walk round to the back gate
      { id: 'bags', line: 'More are coming. Behind the bags', done: or(near(BAGS, 1.6), taken('road')), at: BAGS, checkpoint: 'the bags' },
      { id: 'front', line: 'Hold the road gate', done: or({ is: 'cue', name: 'flank' }, taken('road')), at: [35.0, 1, 14.0], cue: 'picket' },
      { id: 'back', line: 'Behind you! [X] on the alley, then [2]', done: or(gave('cover'), taken('road')), at: MOUTH },
      { id: 'hold', line: 'Finish the picket', done: taken('road'), at: [35.0, 1, 14.0] },
    ],
  } as LessonData;

  for (const d of doors) doorFrame(d);
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices: [],
    breaker, beacons: [{ pos: [20.3, 2.05, 5.3], box: dome }],
    playerSpawn: [6.4, 0, 14.0], routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    mission: { serverRoom: { ...HALL }, entryDoor: 'hall', rack: { index: 0, front: [31.0, 1.0, 19.6], halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: 35.8, exfilZ: 14.0, exfilOut: [1, 0] },
  };
  const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
  const scenarios: LevelScenarios = {
    roomClear, lesson,
    places: { areas: [{ name: 'street', bounds: { x0: 5, x1: 30.2, z0: 11, z1: 16.5 } }, { name: 'alley', bounds: { x0: 22, x1: 27, z0: 5, z1: 11 } }, { name: 'motor yard', bounds: { x0: 13, x1: 25.5, z0: 16.5, z1: 23 } }] },
    doorNames: [{ door: 'gate_w', name: 'track gate' }, { door: 'gate_e', name: 'road gate' }, { door: 'gate_n', name: 'back gate' }, { door: 'workshop_side', name: 'workshop side door' }],
  };
  return { level, scenarios, groups: trace.groups, surfaces };
}
