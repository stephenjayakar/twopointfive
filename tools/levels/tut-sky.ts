// THE FIRST TUTORIAL MISSION: a squad led from above (levels/tut-sky.json; `bun run tools/levels/export.ts tut-sky`).
// The player is nobody on the floor: he is over the squad, and all he has is the view and the squad's command key. The place is the pass's halt
// (tools/levels/pass.ts, box for box) under the same snow, with what this mission adds on the road: the squad's two pickups stopped in the west of it,
// a roadblock and a gun truck in the east of it with its head lamps down the road.
// FOUR BEATS, one new thing at a time (game/rails.ts locks the rest; levels/tut-sky.script.ts stages the fire):
//   the road      the squad is behind its trucks under fire from the roadblock. Turn the view, zoom it, shift it; then the command key on the yard
//                 takes the squad through the gate under its own smoke.
//   indoors       what is behind a door is not known until it opens (the fog of war is on from the first step). The command key on a door stacks them; the word sends them in. Twice: the tea room, the kitchen.
//   the wall      the orders' menu: a charge on the store's wall from the kitchen, and the word blows it.
//   the dark      the command key on the breaker sends a man to throw it; night vision; the last room taken in the dark; back to the trucks.
// Nobody is lost: a teammate who would go down is on a knee for a few seconds (rails.respawn). The checkpoints are the beats' first steps and no others.
import { build as buildPass, NOTES as PASS_NOTES, MATERIALS as PASS_MATERIALS, PASS_SCENARIOS, PASS_ROOMS } from './pass';
import type { Vec3 } from '../../src/math/vec';
import type { LessonData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import { normalize3 as norm } from '../../src/scene/officeGen';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'tut-sky';
export const DRESS_AS = 'pass';
export const MATERIALS = PASS_MATERIALS;
export const NOTES = `The first tutorial mission, on the pass's halt: the squad's two pickups in the west of the road, a roadblock and a gun truck in the east of it. ${PASS_NOTES ?? ''}`;

const HALF = Math.PI / 2, R = PASS_ROOMS;
// ---- the road, west: the squad's two pickups where they stopped, one behind the other across the two lanes, noses to the roadblock ----
const TRUCK_A = { x: 12.9, z: 24.4, yaw: 0.1 }, TRUCK_B = { x: 11.3, z: 26.6, yaw: -0.14 };
/** the squad, two in file behind each truck's tail */
const OPS: Vec3[] = [[9.7, 0, 24.5], [8.6, 0, 24.7], [8.1, 0, 26.7], [7.0, 0, 26.6]];
/** where the player stands on a stand without the frame (a plain room clear): on the road behind his men */
const SAM: Vec3 = [5.4, 0, 25.6];
/** …and with it: out of the picture, behind the lean-to's back wall, in nobody's line */
export const SKY_PARK: Vec3 = [2.4, 0, 3.0];
// ---- the road, east: the roadblock (two low walls of sandbags across the lanes), the gun truck in front of the south one ----
const GUN_TRUCK = { x: 25.2, z: 26.4, yaw: Math.PI - 0.07 };
// (the three men of the roadblock are the level's script's: levels/tut-sky.script.ts POSTS, behind the sandbags below)

// the yard behind the lorry, inside the gate: where the first order takes them
const YARD_IN: Rect = { x0: 12.3, x1: 21.6, z0: 17.4, z1: 21.9 };
const YARD_MARK: Vec3 = [17.6, 0.02, 20.4];
/** the kitchen's wall to the store, clear of the range and of the door's frame: where the charge goes · this mission's mains box, on the house's
 *  yard wall between the tea room's window and the kitchen's door, where the view from the road side sees it (the halt's own is at the back of the lean-to,
 *  behind a wall from there) · the road by the trucks */
const PASS_DOOR: Vec3 = [21.8, 1.0, 6.75], INNER_DOOR: Vec3 = [32.25, 1.0, 10.8], WALL_MARK: Vec3 = [27.95, 1.1, 9.4], BREAKER: Vec3 = [22.6, 1.35, 11.32], TRUCKS_MARK: Vec3 = [9.6, 0.02, 25.6];
const ROAD_BACK: Rect = { x0: 4.6, x1: 15.0, z0: 22.6, z1: 29.0 };
const TEA_IN: Vec3 = [17.25, 1.1, 10.9], PASS_W: Vec3 = [21.9, 1.1, 6.75], KITCHEN_IN: Vec3 = [25.25, 1.1, 10.9], STORE_E: Vec3 = [28.1, 1.1, 8.25], BUNK_IN: Vec3 = [28.2, 1.1, 13.75];

/** THE HOUSE: five men, each room's marks exactly its garrison (the page deals a room's men from its marks: with no spare mark every try is this one).
 *  Nobody stands at a window: the yard behind the lorry is safe ground, and each room is met at its door. */
const STRUCTURE: StructureData = {
  name: 'the halt',
  wallCharges: 3,
  team: { sam: SAM, samYaw: HALF, ops: OPS, opsYaw: HALF },
  rooms: [
    { id: 'tea', name: 'tea room', bounds: R.tea.bounds, garrison: 2, doors: [{ id: 'tea', from: 'yard' }, { id: 'pass', from: 'kitchen' }],
      marks: [{ pos: [18.6, 0, 6.9], watch: 'tea', aimAt: TEA_IN }, { pos: [13.4, 0, 6.4], watch: 'pass', aimAt: PASS_W }] },
    { id: 'kitchen', name: 'kitchen', bounds: R.kitchen.bounds, garrison: 1, doors: [{ id: 'kitchen', from: 'yard' }, { id: 'back', from: 'back' }, { id: 'pass', from: 'tea room' }, { id: 'store', from: 'store' }],
      marks: [{ pos: [26.6, 0, 6.9], watch: 'kitchen', aimAt: KITCHEN_IN }] },
    { id: 'store', name: 'store', bounds: R.store.bounds, garrison: 1, doors: [{ id: 'store', from: 'kitchen' }, { id: 'inner', from: 'bunk room' }],
      marks: [{ pos: [33.0, 0, 10.2], watch: 'store', aimAt: STORE_E }] },
    { id: 'bunk', name: 'bunk room', bounds: R.bunk.bounds, garrison: 1, doors: [{ id: 'bunk', from: 'yard' }, { id: 'inner', from: 'store' }],
      marks: [{ pos: [32.0, 0, 15.6], watch: 'bunk', aimAt: BUNK_IN }] },
  ],
  squads: [
    { id: 'house', name: 'House', rooms: ['tea', 'kitchen'], rally: [18.0, 0, 7.6], barricade: ['tea'] },
    { id: 'lines', name: 'Lines', rooms: ['store', 'bunk'], rally: [30.2, 0, 15.8], barricade: ['bunk'] },
  ],
};

/** THE STEPS. A line is a verb and a key, eight words at most. One new action a step; done by the deed. */
const LESSON: LessonData = {
  title: 'A squad, from above',
  // (the fog of war from the first step: nobody is seen in a room the squad has not looked into. The road is seen from the first truck's cab — the man left with
  //  the trucks — so the roadblock is in the picture while the squad is still behind its tails)
  rails: { allow: [], respawn: 5, fog: true, orders: ['move', 'stack', 'go', 'walltools', 'wallCharge', 'work'], sky: { park: SKY_PARK, reach: 22, eye: { at: [13.3, 1.9, 25.4], yaw: HALF, fov: 100 } } },
  steps: [
    // ---- the road ----
    { id: 'turn', line: 'Hold [Ctrl], move the mouse: turn the view', allow: ['camera'], cue: 'ambush', checkpoint: 'the road', done: { is: 'view', turned: 40 } },
    { id: 'zoom', line: '[Ctrl] and scroll: zoom out', allow: ['zoom'], done: { is: 'view', zoomed: 1.2 } },
    { id: 'pan', line: '[W] [A] [S] [D]: look down the road', allow: ['pan'], done: { is: 'view', panned: 7 } },
    { id: 'move', line: '[B] on the yard: move them in', allow: ['order'], cue: 'break', at: YARD_MARK, done: { is: 'squad', area: YARD_IN }, hold: 0.6 },
    { id: 'gate', line: 'They hold the gate. Watch it', at: [19.5, 0.02, 22.0], done: { is: 'cue', name: 'roadblock' } },
    // ---- indoors ----
    { id: 'stack', line: '[B] on the door: stack up', cue: 'indoors', checkpoint: 'the yard', at: [17.0, 1.0, 11.2], done: { is: 'any', of: [{ is: 'stackOn', door: 'tea', set: true }, { is: 'taken', room: 'tea' }, { is: 'squad', area: R.tea.bounds, n: 3 }] } },
    { id: 'go', line: '[F]: send them in', allow: ['word'], at: [17.0, 1.0, 11.2], done: { is: 'any', of: [{ is: 'taken', room: 'tea' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.tea.bounds, n: 3 }] }] }, hold: 1.5 },
    { id: 'kitchen', line: 'The kitchen: [B] on its door, then [F]', checkpoint: 'the tea room', at: PASS_DOOR, done: { is: 'any', of: [{ is: 'taken', room: 'kitchen' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.kitchen.bounds, n: 3 }] }] }, hold: 1.5 },   // (a second tap of the command key sends a stack in with no word: the room taken is the step done, however they went)
    // ---- the wall ---- (a door is where a room expects them. The store taken by its door is the honest other way past both steps)
    { id: 'charge', line: '[X] on the wall, then [5], [3]', allow: ['menu', 'ring'], cue: 'wall', checkpoint: 'the kitchen', at: WALL_MARK, done: { is: 'any', of: [{ is: 'flag', flag: 'chargeClear' }, { is: 'taken', room: 'store' }, { is: 'squad', area: R.store.bounds, n: 3 }] }, hold: 0.4 },   // (the word's line waits for the squad to stand off: a charge blown with men beside it blinds them)
    { id: 'blow', line: '[F]: blow it', at: WALL_MARK, done: { is: 'any', of: [{ is: 'taken', room: 'store' }, { is: 'squad', area: R.store.bounds, n: 3 }] }, hold: 1.5 },
    // ---- the dark ----
    { id: 'breaker', line: '[B] on the breaker: lights out', cue: 'dark', checkpoint: 'the store', at: BREAKER, done: { is: 'flag', flag: 'dark' } },
    { id: 'nv', line: '[N]: night vision', allow: ['nvg'], cue: 'nv', done: { is: 'flag', flag: 'nv' } },
    { id: 'bunk', line: 'The last room: [B] on its door, then [F]', at: INNER_DOOR, done: { is: 'any', of: [{ is: 'taken', room: 'bunk' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.bunk.bounds, n: 3 }] }] }, hold: 1.5 },
    { id: 'out', line: '[B] on the trucks: back to the road', cue: 'out', at: TRUCKS_MARK, done: { is: 'squad', area: ROAD_BACK }, hold: 1 },
  ],
};

const KIT = PASS_SCENARIOS.kitView!;
export const SCENARIOS: LevelScenarios = { ...PASS_SCENARIOS, roomClear: STRUCTURE, kitView: { ...KIT, ways: KIT.ways.slice(0, 1) }, lesson: LESSON };

export function build() {
  let mains: unknown[] = [];
  const out = buildPass({ scenarios: SCENARIOS, spawn: SAM, kept: ({ K, G, cap }) => {
    const { grp, add, lights } = K, M = G.M;
    // THE MAINS BOX on the yard wall, a conduit up to the eaves: the breaker a teammate throws
    grp('breaker');
    mains = [add({ c: [BREAKER[0], 1.35, 11.165], h: [0.28, 0.36, 0.045], albedo: [0.42, 0.44, 0.45], name: 'mains_box' }),
      add({ c: [BREAKER[0] - 0.18, 1.62, 11.215], h: [0.015, 0.015, 0.01], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow })];
    add({ c: [BREAKER[0] + 0.16, 2.3, 11.14], h: [0.02, 0.6, 0.02], albedo: [0.3, 0.31, 0.32] });
    /** a vehicle's own frame: local +X its nose */
    const at = (v: { x: number; z: number; yaw: number }, lx: number, y: number, lz: number): Vec3 => { const cs = Math.cos(v.yaw), sn = Math.sin(v.yaw); return [v.x + cs * lx + sn * lz, y, v.z - sn * lx + cs * lz]; };
    // THE HALT IS SHUTTERED FOR THE NIGHT: boards over its four windows, outside. Nobody in the yard sees into a room, and nobody in a room into the yard: a room is
    // met at its door (and the fog of war has something to hide: what is behind a door is not known until it opens)
    grp('shutters');
    for (const [a, b] of [[13.2, 15.0], [19.2, 21.0], [26.2, 27.4]] as const) { add({ c: [(a + b) / 2, 1.375, 11.15], h: [(b - a) / 2 + 0.06, 0.52, 0.025], ...M.woodGrey }); add({ c: [(a + b) / 2, 1.375, 11.185], h: [(b - a) / 2 + 0.1, 0.05, 0.02], ...M.poplar }); }
    add({ c: [27.85, 1.375, 16.1], h: [0.025, 0.52, 0.76], ...M.woodGrey }); add({ c: [27.815, 1.375, 16.1], h: [0.02, 0.05, 0.8], ...M.poplar });
    grp('road.squad');
    G.pickup(TRUCK_A.x, TRUCK_A.z, TRUCK_A.yaw, 'truckWhite', { load: 'crates' });
    G.pickup(TRUCK_B.x, TRUCK_B.z, TRUCK_B.yaw, 'truckTan', { load: 'sacks' });
    for (const v of [TRUCK_A, TRUCK_B]) { const c = at(v, 0.36, 0, 0); cap(c[0], c[2], 1.0, 1.3, 1.58, v.yaw, 0.03); }   // a dusting on each cab's roof: they have not stood long
    grp('road.block');
    G.sandbags(29.2, 23.7, 1.7, HALF, 4); G.sandbags(29.6, 26.3, 1.7, HALF, 4);                 // the roadblock: a low wall across each lane, a gap between them
    cap(29.2, 23.7, 0.3, 1.5, 0.8, 0, 0.04); cap(29.6, 26.3, 0.3, 1.5, 0.8, 0, 0.04);
    G.drum(30.6, 22.8, 'rust'); G.tyres(31.0, 27.2, 3);
    G.pickup(GUN_TRUCK.x, GUN_TRUCK.z, GUN_TRUCK.yaw, 'truckRed', { mount: true });               // the gun truck, nose down the road
    // its two head lamps, lit: the road between the two parties is theirs (its own battery: the halt's breaker does not reach them; a round puts one out)
    grp('road.lamps');
    for (const [k, lz] of [[0, -0.66], [1, 0.66]] as const) {
      const lens = add({ c: at(GUN_TRUCK, 2.49, 0.69, lz), h: [0.02, 0.06, 0.13], yaw: GUN_TRUCK.yaw, ...M.plasticWhite, emissive: [26, 24, 20], flags: BoxFlag.NoShadow });
      const d = at({ x: 0, z: 0, yaw: GUN_TRUCK.yaw }, 1, 0, 0);
      lights.push({ kind: 'spot', pos: at(GUN_TRUCK, 2.6, 0.69, lz), dir: norm([d[0], -0.035, d[2]]), color: [1.0, 0.93, 0.8], intensity: 120, range: 24, innerDeg: 9, outerDeg: 24,
        name: `gun_truck_lamp_${k}`, group: 'exterior', enabled: true, volumetric: 0.35, fixtureBox: lens, radius: 0.07, mains: false });
    }
  } });
  out.level.breaker = { pos: BREAKER, boxes: mains as NonNullable<typeof out.level.breaker>['boxes'] };
  // the store is locked from the kitchen: its man has the key, the squad has a charge (the wall beat). The bunk room's inner door is its other way in
  for (const d of out.level.doors) if (d.name === 'store') d.locked = true;
  return out;
}
