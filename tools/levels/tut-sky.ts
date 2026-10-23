// THE FIRST TUTORIAL MISSION: a squad led from above (levels/tut-sky.json; `bun run tools/levels/export.ts tut-sky`), on a place made for it:
// THE TUNNEL STATION. The road over the pass goes into the mountain here, and the men who keep the tunnel open in winter live beside its mouth: one long
// range under the cut rock (the tea room, the kitchen, the store), a bunkhouse across the yard on the road, a court behind it for the generator and the fuel,
// and a wide yard between them where the plough lorry stands by the grit heap. One gate onto the road.
// THE SENTENCE NOBODY COULD SAY OF ANOTHER LEVEL: the road ends in a hole in the mountain with a gun truck's lamps in front of it, and the only way off the
// road is the station's gate.
// THE PLAYER IS NOBODY ON THE FLOOR: he is over the squad, and all he has is the view and the squad's command key. So everything here is laid out to be read
// from above, with room for four men wherever four men are sent: a road long enough to look down, a gateway three metres wide, a yard nine metres deep, rooms
// seven metres deep with their doors on the walls the view looks at, and two metres of plain wall on each side of every door.
// FOUR BEATS, one new thing at a time (game/rails.ts locks the rest; levels/tut-sky.script.ts stages the fire):
//   the road      the squad is behind its two pickups under fire from the roadblock at the tunnel's mouth. Turn the view, zoom it, shift it; then the
//                 command key on the yard takes the squad through the gate under its own smoke, and the roadblock comes for the gate.
//   indoors       what is behind a door is not known until it opens (the fog of war is on from the first step). The command key on a door stacks them; the
//                 word sends them in. Twice: the tea room, the kitchen.
//   the wall      the orders' menu: a charge on the store's wall from the kitchen, and the word blows it.
//   the dark      the command key on the mains box sends a man to throw it: every lamp on the mains goes, the station's emergency beacons turn red over the
//                 snow, and the bunkhouse sends two men across the yard behind their torches. Night vision; the last room taken in the dark; back to the trucks.
// Nobody is lost: a teammate who would go down is on a knee for a few seconds (rails.respawn). The checkpoints are the beats' first steps and no others.
// THE HAND PLACEMENT: every room's marks are exactly its garrison (the page deals a room's men from its marks: with no spare mark every try is this one).
// Nobody stands at a window and every window is shuttered for the storm: the yard is safe ground once the gate is held, and each room is met at its door.
//
//        x 4            14            22          29            36  37.6
//   z 0   rock  rock  rock  (the cut: the mountain behind the range)   rock
//   z 4  +=============+=============+===========+ - - - - - - -+
//        |  TEA ROOM   p   KITCHEN   s   STORE   |  THE COURT   |          p = 'pass'   s = 'store' (locked)
//        |   stove     |    oven     |  (sacks,  |  generator   |
//        |             |           X |   fuel)   |  under tin   |          X = where the charge goes
//   z 11.5+=W==tea==W==+==kitchen=B=W+===========+  the tank    |          B = the mains box   W = a window, shuttered
//        |          wood                            (the alley)  |
//   z 13.5| brazier         THE YARD             +=====bunk=====+
//        |                                       b  BUNKHOUSE   |          b = 'bunk'
//        | grit      (ruts)   [ the plough lorry ]W   stove     |
//   z 20 +=========[ GATE ]======================+==============+     +==+
//   z 21.4 trucks A      smoke                    sandbags              the
//          trucks B  →       THE ROAD        gun truck ←  sandbags      tunnel
//   z 25.6 - - - - - the plough's bank, the rail, the drop - - - -     +==+
//
// THE SNOW IS IN THE FILE (group 'snow.*'), laid by hand as the pass's is and with the same pieces: ground, drifts a man wades, banks that stop him (against
// a wall, never within 1.4 m of a door), caps on the tops of things, trodden paths, ruts. What FALLS is the weather's (src/game/weatherKinds.ts, by name).
// THE LIGHT: a thin moon on snow and pools of warm light. ON THE MAINS (the generator in the court; the box on the kitchen's yard wall throws them all): the
// bulbs of the four rooms, the lamps over the kitchen's and the bunkhouse's doors, the lamp over the gate, the lamps of the tunnel's mouth, the light behind
// the shutters. ON THEIR OWN FUEL: the brazier in the yard, two stoves, the bread oven, the lanterns, the gun truck's head lamps. ON A BATTERY, and only when
// the mains are out: five red beacons (the yard wall, the bunkhouse, the gate, the tea room, the tunnel's mouth).
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { LessonData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, type GwotOpening } from '../../src/scene/gwotKit';
import { SNOW_PALETTE, SNOW_FINISH, SNOW_MATERIALS, type SnowMat } from '../../src/scene/gwotPalette';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'tut-sky';
export const MATERIALS = { ...GWOT_MATERIALS, ...SNOW_MATERIALS };
export const NOTES = 'The first tutorial mission, on a place of its own: the tunnel station, a walled road-keepers\' post beside a tunnel\'s mouth on a pass road, at night, in winter. The squad\'s two pickups in the west of the road, a roadblock and a gun truck at the tunnel in the east of it; seven men in four rooms round a wide yard under snow. Regenerate: bun run tools/levels/export.ts tut-sky';

const HALF = Math.PI / 2;
// ---- the rooms' floors inside their walls ----
const TEA: Rect = { x0: 4.12, x1: 13.94, z0: 4.12, z1: 11.38 }, KITCHEN: Rect = { x0: 14.06, x1: 21.94, z0: 4.12, z1: 11.38 };
const STORE: Rect = { x0: 22.06, x1: 28.88, z0: 4.12, z1: 11.38 }, BUNK: Rect = { x0: 29.12, x1: 35.88, z0: 13.62, z1: 19.88 };
export const SKY_ROOMS = { tea: { name: 'tea room', bounds: TEA }, kitchen: { name: 'kitchen', bounds: KITCHEN }, store: { name: 'store', bounds: STORE }, bunk: { name: 'bunk room', bounds: BUNK } } as const;
const R = SKY_ROOMS;
/** the middle of each doorway, on a walk-grid cell (x or z ending .25 / .75) */
const DOOR = { tea: 9.25, kitchen: 17.25, pass: 6.25, store: 7.25, bunk: 16.25 } as const;
/** the gateway in the yard's wall on the road */
const GATE = { a: 13, b: 16, z: 20 } as const;

// ---- the road, west: the squad's two pickups where they stopped, one behind the other across the two lanes, noses to the roadblock ----
const TRUCK_A = { x: 9.4, z: 22.4, yaw: 0.1 }, TRUCK_B = { x: 7.8, z: 24.6, yaw: -0.14 };
/** the squad, two in file tight behind each truck's tail (on a knee there until its first order: rails.sky.low) */
const OPS: Vec3[] = [[6.45, 0, 22.5], [5.55, 0, 22.6], [4.85, 0, 24.7], [3.95, 0, 24.6]];
/** where the player stands on a stand without the frame (a plain room clear): on the road behind his men */
const SAM: Vec3 = [1.9, 0, 23.6];
/** …and with it: out of the picture, outside the yard's blind wall, in nobody's line */
export const SKY_PARK: Vec3 = [2.0, 0, 9.0];
// ---- the road, east: the roadblock (two low walls of sandbags across the lanes), the gun truck in front of the south one, the tunnel behind them ----
const GUN_TRUCK = { x: 29.2, z: 24.4, yaw: Math.PI - 0.07 };
const PORTAL_X = 37.6;
// (the three men of the roadblock are the level's script's: levels/tut-sky.script.ts POSTS, behind the sandbags below)
/** THE PLOUGH LORRY, the yard's one big thing: parked across the east half of the yard in front of the bunkhouse, its blade toward the gateway. Local +X is its nose */
const LORRY = { x: 24.0, z: 15.6, yaw: Math.PI - 0.05 };   // (a lane a man walks on each side of it, never a pocket he is posted in — and it stands in the line from the mains box, and from most of the yard, to the bunkhouse's door: what comes out of that door in the dark is seen first as light round its tail)

// the yard inside the gate: where the first order takes them
const YARD_IN: Rect = { x0: 4.4, x1: 20.5, z0: 12.2, z1: 19.7 };
const YARD_MARK: Vec3 = [11.4, 0.02, 16.4];
/** the kitchen's wall to the store, clear of the door's frame and of everything that stands in the kitchen: where the charge goes · the mains box on the
 *  kitchen's yard wall, between its door and its window, where the view sees it · the road by the trucks */
const TEA_DOOR: Vec3 = [DOOR.tea - 0.25, 1.0, 11.7], PASS_DOOR: Vec3 = [13.8, 1.0, DOOR.pass], BUNK_DOOR: Vec3 = [28.8, 1.0, DOOR.bunk], WALL_MARK: Vec3 = [21.95, 1.1, 9.6], BREAKER: Vec3 = [19.3, 1.35, 11.82], TRUCKS_MARK: Vec3 = [6.1, 0.02, 23.6];
/** the squad's charge on the kitchen's wall is seen whichever way its men face (they stand off with their backs to it): a lookout in the kitchen, on the wall */
const WALL_EYE = { at: [19.4, 1.6, 9.6] as Vec3, yaw: HALF, fov: 100 };
const ROAD_BACK: Rect = { x0: 1.1, x1: 11.5, z0: 20.6, z1: 27.0 };
// chest-high points the marks' guns rest on: each door's inner face on the middle of its doorway
const TEA_IN: Vec3 = [DOOR.tea, 1.1, 11.4], PASS_W: Vec3 = [13.9, 1.1, DOOR.pass], KITCHEN_IN: Vec3 = [DOOR.kitchen, 1.1, 11.4], STORE_E: Vec3 = [22.1, 1.1, DOOR.store], BUNK_IN: Vec3 = [29.2, 1.1, DOOR.bunk];

/** THE STATION: seven men. The tea room two, the kitchen one, the store one behind its lock, the bunkhouse three: the two of them nearest its door are the
 *  ones the script walks to the mains box behind their torches when the lights go (levels/tut-sky.script.ts 'torches'), the third keeps the room. */
const STRUCTURE: StructureData = {
  name: 'the station', maxMen: 7,
  wallCharges: 3,
  team: { sam: SAM, samYaw: HALF, ops: OPS, opsYaw: HALF },
  rooms: [
    { id: 'tea', name: 'tea room', bounds: R.tea.bounds, garrison: 2, doors: [{ id: 'tea', from: 'yard' }, { id: 'pass', from: 'kitchen' }],
      marks: [{ pos: [10.9, 0, 6.6], watch: 'tea', aimAt: TEA_IN }, { pos: [5.3, 0, 5.3], watch: 'pass', aimAt: PASS_W }] },
    { id: 'kitchen', name: 'kitchen', bounds: R.kitchen.bounds, garrison: 1, doors: [{ id: 'kitchen', from: 'yard' }, { id: 'pass', from: 'tea room' }, { id: 'store', from: 'store' }],
      marks: [{ pos: [20.4, 0, 5.6], watch: 'kitchen', aimAt: KITCHEN_IN }] },
    { id: 'store', name: 'store', bounds: R.store.bounds, garrison: 1, doors: [{ id: 'store', from: 'kitchen' }],
      marks: [{ pos: [27.2, 0, 9.8], watch: 'store', aimAt: STORE_E }] },   // (off every line a round for the kitchen's man can take through the partition: the store is a room the squad has to open)
    { id: 'bunk', name: 'bunk room', bounds: R.bunk.bounds, garrison: 3, doors: [{ id: 'bunk', from: 'yard' }],
      // (all three against their own door's wall, out of every line through the doorway from the yard: a door that opens shows the yard nobody)
      marks: [{ pos: [29.8, 0, 15.0], watch: 'bunk', aimAt: BUNK_IN }, { pos: [29.8, 0, 17.4], watch: 'bunk', aimAt: BUNK_IN }, { pos: [30.0, 0, 18.6], watch: 'bunk', aimAt: BUNK_IN }] },
  ],
  squads: [
    { id: 'house', name: 'House', rooms: ['tea', 'kitchen'], rally: [9.0, 0, 7.4], barricade: ['tea'] },
    // (the Lines keep to their rooms: the bunkhouse does not cross the yard for the store's fight, so the men who come out with torches when the lights go
    //  are the first of it the squad meets)
    { id: 'lines', name: 'Lines', rooms: ['store', 'bunk'], rally: [32.4, 0, 16.4], mayLeave: false },
  ],
};

/** THE STEPS. A line is a verb and a key, eight words at most. One new action a step; done by the deed. */
const LESSON: LessonData = {
  title: 'A squad, from above',
  // (NO FOG OF WAR on this mission: the maintainer, after two plays in which the squad's own wall charge went off unseen, "maybe we just remove fog of war
  //  entirely from this mission?". He leads from above here and the first lesson is the view: everything on the floor is in the picture. The seat's lookout
  //  and the wall steps' `eye` are kept for the day the fog comes back: with four men up and the lookout in, the fog's five eyes were full and the wall's
  //  eye never got one, which is why the blast stayed hidden)
  rails: { allow: [], respawn: 5, fog: false, lasers: false, orders: ['move', 'stack', 'go', 'walltools', 'wallCharge', 'work'], sky: { park: SKY_PARK, reach: 26, low: true, eye: { at: [9.8, 1.9, 23.4], yaw: HALF, fov: 100 } } },
  steps: [
    // ---- the road ----
    { id: 'turn', line: 'Hold [Ctrl] and move the mouse to turn the view', allow: ['camera'], cue: 'ambush', checkpoint: 'the road', done: { is: 'view', turned: 40 } },
    { id: 'zoom', line: 'Hold [Ctrl] and scroll to zoom out', allow: ['zoom'], done: { is: 'view', zoomed: 1.2 } },
    { id: 'pan', line: 'Use [W] [A] [S] [D] to look down the road', allow: ['pan'], cue: 'smoke', done: { is: 'view', panned: 7 } },
    { id: 'move', line: 'Press [B] on the yard to move them in', after: { line: 'They\'re using the smoke to get to the yard' }, allow: ['order'], cue: 'break', at: YARD_MARK, done: { is: 'squad', area: YARD_IN }, hold: 0.6 },
    { id: 'gate', line: 'They\'re holding the gate. The enemies from the roadblock are coming', at: [14.5, 0.02, 19.9], done: { is: 'cue', name: 'roadblock' } },   // (no hold: with the roadblock already down when the squad sets, the line never comes up)
    // ---- indoors ----
    { id: 'stack', line: 'Press [B] on the door to stack up', after: { line: 'They\'re stacking up on the door' }, explain: { title: 'Doors', text: 'The way into a room is usually its door. Point at a door and press [B] to stack the squad up beside it.\nThey\'ll wait there until you say go.' }, cue: 'indoors', checkpoint: 'the yard', at: TEA_DOOR, done: { is: 'any', of: [{ is: 'stackOn', door: 'tea', set: true }, { is: 'taken', room: 'tea' }, { is: 'squad', area: R.tea.bounds, n: 3 }] } },
    { id: 'go', line: 'Press [F] to send them in', after: { word: 'They\'re going in' }, allow: ['word'], at: TEA_DOOR, done: { is: 'any', of: [{ is: 'taken', room: 'tea' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.tea.bounds, n: 3 }] }] }, hold: 1.5 },
    { id: 'kitchen', line: 'Press [B] on the kitchen door, then [F]', after: { line: 'Press [F] to send them in', word: 'They\'re taking the kitchen' }, checkpoint: 'the tea room', at: PASS_DOOR, done: { is: 'any', of: [{ is: 'taken', room: 'kitchen' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.kitchen.bounds, n: 3 }] }] }, hold: 1.5 },   // (a second tap of the command key sends a stack in with no word: the room taken is the step done, however they went)
    // ---- the wall ---- (a door is where a room expects them)
    { id: 'charge', line: '[X] on the wall', after: { line: 'They\'re putting the charge on the wall', on: ['wallCharge'] }, explain: { title: 'Walls', text: 'The store is locked, and the enemies inside are watching the door anyway.\nA charge on the wall will get your squad in where nobody\'s waiting.' }, menuLine: 'Press [5], then [3] for a charge', pageLine: 'Press [3] for a charge', noTap: 'Keep [B] held down', eye: WALL_EYE, allow: ['menu', 'ring'], cue: 'wall', checkpoint: 'the kitchen', at: WALL_MARK, done: { is: 'any', of: [{ is: 'flag', flag: 'chargeClear' }, { is: 'taken', room: 'store' }, { is: 'squad', area: R.store.bounds, n: 3 }] }, hold: 0.4 },   // (the word's line waits for the squad to stand off: a charge blown with men beside it blinds them)
    { id: 'blow', line: 'Press [F] to blow it', after: { word: 'They\'re going through the wall' }, eye: WALL_EYE, at: WALL_MARK, done: { is: 'any', of: [{ is: 'taken', room: 'store' }, { is: 'squad', area: R.store.bounds, n: 3 }] }, hold: 1.5 },
    // ---- the dark ---- (the card says what light is to both sides before the lights go; what the bunkhouse then does is the showing of it)
    { id: 'breaker', line: 'Press [B] on the breaker box to cut the lights', after: { line: 'A buddy team is going for the breaker box' }, explain: { title: 'Light', text: 'Enemies can only fight what they can see. In the dark they\'ll slow down and turn on flashlights.\nYour squad has night vision, so cut the lights and you\'ll own the dark.' }, cue: 'dark', checkpoint: 'the store', at: BREAKER, done: { is: 'flag', flag: 'dark' } },
    { id: 'nv', line: 'Press [N] to turn on night vision', allow: ['nvg'], cue: 'nv', done: { is: 'flag', flag: 'nv' } },
    { id: 'torches', line: 'They\'re using flashlights, so you can see where they are', cue: 'torches', at: [27.6, 0.02, 13.2], done: { is: 'cue', name: 'torches' } },
    { id: 'bunk', line: 'Press [B] on the last room\'s door, then [F]', after: { line: 'Press [F] to send them in', word: 'They\'re taking the last room' }, at: BUNK_DOOR, done: { is: 'any', of: [{ is: 'taken', room: 'bunk' }, { is: 'all', of: [{ is: 'word' }, { is: 'squad', area: R.bunk.bounds, n: 3 }] }] }, hold: 1.5 },
    { id: 'out', line: 'Press [B] on the trucks to pull them back to the road', after: { line: 'They\'re falling back to the trucks' }, cue: 'out', onWay: { nv: false, run: true }, at: TRUCKS_MARK, done: { is: 'squad', area: ROAD_BACK }, hold: 1 },
  ],
};

export const SCENARIOS: LevelScenarios = { roomClear: STRUCTURE, lesson: LESSON,
  places: { areas: [
    { name: 'the yard', bounds: { x0: 4.1, x1: 29.0, z0: 11.6, z1: 19.9 } }, { name: 'the court', bounds: { x0: 29.0, x1: 35.9, z0: 4.1, z1: 13.4 } },
    { name: 'the tunnel', bounds: { x0: 36.6, x1: 40, z0: 20.4, z1: 26.6 } }, { name: 'the road', bounds: { x0: 0, x1: 36.6, z0: 20.2, z1: 28 } },
  ] } };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY, M = G.M;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const DECAL = BoxFlag.NoShadow;
  type Mat = { albedo: Vec3; rough: number };
  const S = Object.fromEntries((Object.keys(SNOW_PALETTE) as SnowMat[]).map(n => [n, { albedo: SNOW_PALETTE[n], rough: SNOW_FINISH[n].rough }])) as Record<SnowMat, Mat>;
  /** a window: 0.9 m off the floor to 1.85, two panes (a sill window: plain glass) */
  const win = (a: number, b: number): GwotOpening => ({ a, b, y0: 0.9, y1: 1.85, mullions: 2, glass: 'bay' });
  /** a doorway's slot in a wall, by its middle */
  const way = (m: number): GwotOpening => ({ a: m - 0.6, b: m + 0.6 });
  /** a vehicle's own frame: local +X its nose */
  const at = (v: { x: number; z: number; yaw: number }, lx: number, y: number, lz: number): Vec3 => { const cs = Math.cos(v.yaw), sn = Math.sin(v.yaw); return [v.x + cs * lx + sn * lz, y, v.z - sn * lx + cs * lz]; };
  const zones: SurfacesData['zones'] = [];

  // ================================================================ SNOW: the pieces ====
  // (what each is to a man — scene/collision.ts: a static blocks feet and the nav grid only where it stands over 0.2 m — is said at the head of
  //  tools/levels/pass.ts, whose pieces these are: ground and cleared earth are thin solid slabs; paths, ruts and slush are decals; a DRIFT tops out under
  //  0.2 m and is waded; a BANK stands over it and stops feet; a CAP is a decal on the top of a thing)
  const lay = (x0: number, z0: number, x1: number, z1: number, m: Mat, y = 0.004) => add({ c: [(x0 + x1) / 2, y / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, y / 2, Math.abs(z1 - z0) / 2], ...m });
  /** GROUND CLEARED TO EARTH: bare dust inside a ring of grey slush (solid, at the floor); its footsteps are earth's */
  const cleared = (id: string, x0: number, z0: number, x1: number, z1: number, ring = 0.4) => {
    lay(x0 - ring, z0 - ring, x1 + ring, z1 + ring, S.snowOld, 0.004); lay(x0, z0, x1, z1, M.dust, 0.006);
    zones.push({ id, mat: 'asphalt', x0: x0 - ring, z0: z0 - ring, x1: x1 + ring, z1: z1 + ring });
  };
  /** DECAL: a flat mark at the floor, w along local x, d along local z */
  const flat = (x: number, z: number, w: number, d: number, m: Mat, yaw = 0) => add({ c: [x, 0.012, z], h: [w / 2, 0.003, d / 2], yaw, ...m, flags: DECAL });
  let pathN = 0;
  /** DECAL: a TRODDEN PATH through the points, `w` wide: packed snow; its footsteps are the hard ground's (squares of the footstep map laid along it) */
  const path = (pts: [number, number][], w = 0.8, m: Mat = S.snowPacked) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      flat((x0 + x1) / 2, (z0 + z1) / 2, L + (i + 2 < pts.length ? w * 0.5 : 0), w, m, yaw);
      for (let s = 0; s <= L; s += 0.5) { const x = x0 + (x1 - x0) * s / L, z = z0 + (z1 - z0) * s / L; zones.push({ id: `path_${pathN++}`, mat: 'asphalt', x0: x - w / 2, z0: z - w / 2, x1: x + w / 2, z1: z + w / 2 }); }
    }
  };
  /** DECAL: two wheel RUTS through the points, `track` apart: old grey snow pressed into the packed (an end ON the map's edge stops there) */
  const ruts = (pts: [number, number][], track = 1.96) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0), b = G.piece((x0 + x1) / 2, (z0 + z1) / 2, yaw);
      const lap = (x: number) => x <= 0 || x >= 40 ? 0 : 0.12, e0 = lap(x0), e1 = lap(x1);
      for (const s of [-track / 2, track / 2]) b((e1 - e0) / 2, s, 0.009, 0.015, L / 2 + (e0 + e1) / 2, 0.17, S.snowOld, { flags: DECAL });
    }
  };
  /** a DRIFT (walk-over: nothing of it over 0.19 m). (x, z) = its middle, `len` along the thing it lies against, `depth` out from it; `yaw` turns local +Z to
   *  point AWAY from the thing (0 = toward +z, π/2 = +x, π = −z, −π/2 = −x). Two steps: a lip, and a crest against the thing */
  const drift = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.17) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, top * 0.5, len / 2, depth / 2, S.snow); b(len * 0.03, -depth * 0.22, 0, top, len * 0.41, depth * 0.28, S.snow);
  };
  /** a BANK (stops feet: its crest stands over 0.2 m). Same frame as drift(); three steps down from `top` */
  const bank = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.42) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, 0.16, len / 2, depth / 2, S.snow); b(-len * 0.02, -depth * 0.15, 0, top * 0.62, len * 0.47, depth * 0.35, S.snow); b(len * 0.03, -depth * 0.31, 0, top, len * 0.42, depth * 0.19, S.snow);
  };
  /** DECAL: a CAP of snow on top of a thing whose top is at `y`: w × d, `t` thick */
  const cap = (x: number, z: number, w: number, d: number, y: number, yaw = 0, t = 0.05) => G.piece(x, z, yaw)(0, 0, y, y + t, w / 2, d / 2, S.snow, { flags: DECAL });
  /** caps along a yard wall's coping (its top at 2.47 m), in lengths with wind-scoured gaps between them */
  const copingCaps = (axis: 'x' | 'z', line: number, a: number, b: number) => {
    const lens = [2.6, 1.4, 3.1, 1.8, 2.2, 1.2]; let u = a + 0.06, k = Math.round(a * 5 + line) % lens.length;
    while (u < b - 0.4) { const l = Math.min(lens[k++ % lens.length], b - 0.06 - u), m = u + l / 2; if (axis === 'x') cap(m, line, l, 0.2, 2.47, 0, 0.05 + (k % 3) * 0.012); else cap(line, m, 0.2, l, 2.47, 0, 0.05 + (k % 3) * 0.012); u += l + 0.16 + (k % 2) * 0.12; }
  };
  /** THE MOUNTAIN: a block of the cut rock, `h` tall, snow lying on its top (set in from its edges: the rock shows as a dark rim) */
  const rock = (x0: number, z0: number, w: number, d: number, h: number, yaw = 0) => {
    // (a turned block is kept whole inside the world: past its edge nothing is traced or lit)
    const ex = (Math.abs(w * Math.cos(yaw)) + Math.abs(d * Math.sin(yaw))) / 2 + 0.03, ez = (Math.abs(w * Math.sin(yaw)) + Math.abs(d * Math.cos(yaw))) / 2 + 0.03;
    const x = Math.min(WORLD.max[0] - ex, Math.max(WORLD.min[0] + ex, x0)), z = Math.min(WORLD.max[2] - ez, Math.max(WORLD.min[2] + ez, z0));
    add({ c: [x, h / 2, z], h: [w / 2, h / 2, d / 2], yaw, ...M.block, albedo: [0.2, 0.21, 0.24] });
    cap(x - 0.04, z - 0.03, Math.max(0.2, w - 0.3), Math.max(0.2, d - 0.26), h, yaw, 0.07);
  };

  // ---- ground: snow to the edge of the map; the road ploughed and driven (packed) into the tunnel; earth and slab under the roofs ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, S.snow.albedo, { rough: S.snow.rough });
  lay(0, 21.0, PORTAL_X, 25.6, S.snowPacked);                                                 // the road
  grp('floors');
  G.ground(4, 4, 14, 11.5, 'mudFloor', 0.006);                                                // the tea room: beaten earth under its rugs
  G.ground(14, 4, 29, 11.5, 'slab', 0.006);                                                   // the kitchen and the store: a concrete slab
  G.ground(29, 13.5, 36, 20, 'mudFloor', 0.006);                                              // the bunkhouse
  G.ground(29.9, 4.1, 35.9, 7.7, 'slab', 0.006);                                              // the generator's slab, under its tin
  G.ground(PORTAL_X, 21.0, 40, 25.8, 'slab', 0.006);                                          // the tunnel's own road: dry concrete from the mouth in
  // THE ROOFS: four slabs, no more (the weather takes a level's four biggest ceiling slabs as its roofs and snow falls everywhere else): the range, the
  // bunkhouse, the generator's tin, the tunnel
  grp('ceiling');
  slab(3.9, H, 3.9, 29.1, H + 0.2, 11.6, P.render, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(28.9, H, 13.4, 36.1, H + 0.2, 20.1, P.block, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  slab(29.9, H, 4.1, 35.9, H + 0.2, 7.7, P.tin, { flags: BoxFlag.NoPrimary, rough: 0.6 });
  slab(PORTAL_X - 0.1, H + 0.05, 20.9, 40, H + 0.25, 25.9, P.block, { flags: BoxFlag.NoPrimary, rough: 0.95 });

  // ---- the buildings: the range rendered and limewashed long ago, the bunkhouse in bare block (it was built later, and it shows) ----
  grp('walls.shell');
  G.wallX(4, 3.88, 29.12, 'render', [{ a: 18.4, b: 19.2, y0: 2.3, y1: 2.5 }]);                 // the back of the range, against the cut: blank but for the kitchen's smoke slit under the beams
  G.wallX(11.5, 3.88, 29.12, 'render', [win(5.4, 7.2), way(DOOR.tea), win(11.2, 13.0), way(DOOR.kitchen), win(20.5, 21.6)]);   // its front, on the yard: window, the tea room's door, window | the kitchen's door, the mains box, its window | the store: blank
  G.wallZ(4, 4.12, 11.38, 'render');
  G.wallZ(29, 4.12, 11.38, 'render');
  G.wallX(13.5, 28.88, 36.12, 'block'); G.wallX(20, 28.88, 36.12, 'block');
  G.wallZ(29, 13.62, 19.88, 'block', [way(DOOR.bunk), win(17.7, 18.9)]);                       // the bunkhouse on the yard: its door, its window
  G.wallZ(36, 13.62, 19.88, 'block');
  grp('walls.inside');
  G.wallZ(14, 4.12, 11.38, 'whitewash', [way(DOOR.pass)]);                                     // tea room | kitchen: 'pass', at the back-wall end (the view looks from the front: a door close behind the front wall is never drawn). A masonry cross wall: the fight for the tea room does not reach the kitchen's man through it
  G.partZ(22, 4.12, 11.38, 'whitewash', [way(DOOR.store)]);                                    // kitchen | store: 'store' (off the line of 'pass': no look from the tea room through both)
  G.dado('x', 11.5, 7.5, 8.5, 1, 'paintGreen'); G.dado('x', 11.5, 10.0, 11.0, 1, 'paintGreen');     // the roads department's green, on the wall either side of the tea room's door (outside)
  G.dado('x', 11.5, 15.4, 16.5, 1, 'paintGreen'); G.dado('x', 11.5, 18.0, 18.8, 1, 'paintGreen');   // … the kitchen's
  G.dado('z', 29, 14.4, 15.5, -1, 'paintGreen'); G.dado('z', 29, 17.0, 17.6, -1, 'paintGreen');     // … and the bunkhouse's
  grp('walls.yard');
  G.yardWallZ(4, 11.62, 19.88, 'block');                                                       // the yard's blind wall
  G.yardWallX(GATE.z, 3.88, 28.88, 'block', [{ a: GATE.a, b: GATE.b, y1: 3 }]);                // the front, on the road: the gateway
  G.yardWallX(4, 29.12, 36.12, 'block'); G.yardWallZ(36, 4.12, 13.38, 'block');                // the court behind the bunkhouse
  G.pier(4.0, GATE.z, 2.4, 'block'); G.pier(8.5, GATE.z, 2.4, 'block'); G.pier(21.0, GATE.z, 2.4, 'block'); G.pier(25.0, GATE.z, 2.4, 'block');
  G.gate((GATE.a + GATE.b) / 2, GATE.z, 'x', 3.0, -1, 'paintGreen', 84);                       // the gate, standing open into the yard (static leaves)
  // ---- THE TUNNEL'S MOUTH: a concrete face across the road at the foot of the rock, the road going in under it ----
  grp('tunnel');
  G.wallZ(PORTAL_X, 18.4, 27.6, 'block', [{ a: 21.1, b: 25.7, y1: 3.0 }], 3.6);                // the face: 3.6 m of it, the mouth 4.6 wide under a beam
  G.wallX(21.0, PORTAL_X + 0.12, 40, 'block'); G.wallX(25.8, PORTAL_X + 0.12, 40, 'block');    // the bore's two walls, as far as the map goes
  add({ c: [PORTAL_X - 0.14, 3.18, 23.4], h: [0.03, 0.2, 1.5], ...M.paintCream });             // the board over the mouth (its name, long since unreadable)
  for (const z of [21.0, 25.8]) add({ c: [PORTAL_X - 0.16, 0.45, z], h: [0.05, 0.45, 0.14], ...M.genYellow });   // the mouth's two yellow fenders
  for (const [k, z] of [[0, 22.2], [1, 24.6]] as const) add({ c: [38.9, 2.93, z], h: [0.5, 0.02, 0.06], ...M.plasticWhite, emissive: [14, 8.4, 3.4], flags: BoxFlag.NoPrimary, name: `tunnel_strip_${k}` });   // sodium strips under the roof (lit boxes; the light is below)

  // ---- THE MOUNTAIN: the cut behind the range, the shoulder over the tunnel, stones off the hill ----
  grp('rock');
  for (const [x, z, w, d, h, yaw] of [
    [2.0, 1.5, 4.4, 3.2, 3.6, 0.08], [6.6, 1.3, 5.0, 2.6, 4.4, -0.05], [11.6, 1.6, 5.4, 3.0, 3.8, 0.06], [16.8, 1.2, 5.2, 2.4, 4.8, -0.04], [21.8, 1.5, 5.0, 3.0, 4.1, 0.05],
    [26.6, 1.3, 4.8, 2.6, 4.6, -0.06], [31.4, 1.5, 5.2, 3.0, 3.9, 0.04], [36.2, 1.6, 4.8, 3.2, 4.9, -0.05],
    [38.6, 5.4, 2.9, 4.8, 4.5, 0.04], [38.5, 10.2, 3.0, 5.0, 4.0, -0.05], [38.6, 15.0, 2.8, 4.8, 4.7, 0.03], [38.75, 19.1, 2.4, 3.2, 5.2, 0],
    [38.8, 26.95, 2.3, 2.0, 5.0, 0],
  ] as const) rock(x, z, w, d, h, yaw);
  for (const [x, z, w, d, h, yaw] of [[1.6, 6.0, 0.8, 0.55, 0.6, 0.4], [2.6, 14.4, 0.6, 0.5, 0.45, -0.3], [1.2, 18.2, 0.9, 0.6, 0.7, 0.2], [37.0, 3.9, 0.6, 0.45, 0.4, 0.7], [36.9, 12.0, 0.7, 0.5, 0.5, -0.5],
    [3.0, 27.2, 1.4, 0.9, 0.8, 0.2], [10.4, 27.4, 1.0, 0.7, 0.6, -0.3], [17.2, 27.3, 1.6, 0.9, 0.9, 0.1], [24.0, 27.4, 0.9, 0.7, 0.55, 0.5], [30.6, 27.3, 1.5, 0.9, 0.85, -0.15], [35.4, 27.4, 1.1, 0.8, 0.7, 0.3]] as const) rock(x, z, w, d, h, yaw);
  rock(39.2, 1.4, 1.5, 2.9, 3.9, 0.03);                                                        // (the cut's corner: closed, no floor behind the rock)

  // ---- THE PLOUGH LORRY (KEPT: the yard's one big thing, and what the gate is held from). A two-axle tipper in the roads department's orange, a blade on
  // its nose, grit in its bed. Nose toward local +X ----
  grp('lorry');
  const L = G.piece(LORRY.x, LORRY.z, LORRY.yaw);
  for (const lx of [2.2, -1.2, -2.25]) for (const s of [-1, 1]) L(lx, s * 0.98, 0, 0.96, 0.48, 0.15, M.rubber);
  L(-0.1, 0, 0.5, 0.74, 3.1, 0.42, M.iron);                                                   // the chassis
  L(3.42, 0, 0.5, 0.78, 0.06, 1.12, M.iron);                                                  // bumper
  L(2.75, 0, 0.74, 1.5, 0.62, 0.98, M.prodOrange);                                            // bonnet
  L(1.55, 0, 0.74, 1.5, 0.62, 1.12, M.prodOrange);                                            // the cab: doors
  L(1.55, 0, 1.5, 2.08, 0.58, 1.06, M.glassDark);                                             // … glass
  L(1.5, 0, 2.08, 2.2, 0.62, 1.1, M.prodOrange);                                              // … roof
  L(1.5, 0, 2.2, 2.3, 0.07, 0.45, M.genYellow);                                               // … the amber bar on it (dead)
  for (const s of [-1, 1]) L(3.38, s * 0.7, 0.86, 1.02, 0.02, 0.1, M.plasticWhite);           // headlamps (dead)
  L(-1.15, 0, 0.74, 0.9, 2.05, 1.16, M.iron);                                                 // the tipper's floor
  for (const s of [-1, 1]) L(-1.15, s * 1.14, 0.9, 1.55, 2.05, 0.03, M.prodOrange);           // its sides
  L(-3.17, 0, 0.9, 1.55, 0.03, 1.16, M.prodOrange); L(0.87, 0, 0.9, 1.8, 0.03, 1.16, M.prodOrange);   // tailboard, headboard
  L(-1.15, 0, 0.9, 1.4, 1.95, 1.06, M.gravel);                                                // the grit
  L(3.75, 0, 0.3, 0.6, 0.3, 0.1, M.iron);                                                     // the blade's arm
  { const n = at(LORRY, 4.12, 0, 0), B = G.piece(n[0], n[2], LORRY.yaw + 0.32);               // THE BLADE, angled to throw the snow off the road's side
    B(0, 0, 0.04, 0.92, 0.07, 1.6, M.prodOrange); B(0.08, 0, 0.04, 0.2, 0.05, 1.6, M.iron); B(-0.02, 0, 0.92, 0.98, 0.1, 1.6, M.iron); }
  grp('snow.lorry');
  L(-1.15, 0, 1.4, 1.5, 1.84, 0.96, S.snow, { flags: DECAL });                                // CAPS: the grit in the bed,
  L(1.5, 0, 2.3, 2.37, 0.55, 1.02, S.snow, { flags: DECAL });                                 //   the cab's roof
  L(2.8, 0, 1.5, 1.555, 0.52, 0.9, S.snow, { flags: DECAL });                                 //   the bonnet
  for (const s of [-1, 1]) {
    L(0.3, s * 1.31, 0, 0.3, 2.9, 0.14, S.snow);                                              // BANK: packed in against the wheels down both sides,
    L(0.3, s * 1.61, 0, 0.15, 2.6, 0.17, S.snow);                                             //   with a lip a man wades
  }
  L(0.5, 0, 0, 0.3, 1.15, 0.8, S.snow);                                                       // blown in under the body between the axles
  L(-3.55, 0, 0, 0.13, 0.3, 0.9, S.snow);                                                     // DRIFT: the lee of the tail, thin
  { const n = at(LORRY, 4.5, 0, 0.2), B = G.piece(n[0], n[2], LORRY.yaw + 0.32); B(0, 0, 0, 0.18, 0.3, 1.5, S.snow); B(0.34, 0, 0, 0.1, 0.2, 1.2, S.snow); }   // the last push of snow still lying in front of the blade (waded)

  // ---- the yard (kept things: what stands in the open) ----
  grp('yard');
  G.woodPile(13.5, 11.97, 0, 1.3);                                                            // the winter's wood, against the range between the tea room's window and the kitchen's door
  add({ c: [12.7, 0.16, 13.1], h: [0.22, 0.16, 0.22], yaw: 0.4, ...M.poplar });               // the chopping block
  add({ c: [13.3, 0.05, 13.5], h: [0.22, 0.05, 0.06], yaw: 0.9, ...M.woodGrey }); add({ c: [12.2, 0.05, 13.6], h: [0.2, 0.05, 0.06], yaw: -0.5, ...M.woodGrey });   // split billets (walk-over)
  G.drum(22.5, 12.05, 'drumBlue');                                                            // the water drum by the kitchen
  G.drums(24.3, 12.1, 3); G.crates(26.6, 12.1, 0, 3, 'coyote');                               // fuel and crates along the store's blank wall, where the lorry backs up to it
  G.sandbags(16.9, 18.9, 1.5, HALF, 4);                                                       // a low wall of sandbags inside the gate, on the lorry's side of it
  add({ c: [7.0, 0.15, 11.92], h: [0.45, 0.15, 0.2], ...M.olive });                           // a crate under the tea room's window: the lantern stands on it
  // THE GRIT HEAP against the road wall west of the gate (the lorry is loaded from it): three steps of gravel, a barrow, two shovels' worth spilt
  G.piece(6.9, 18.9, 0)(0, 0, 0, 0.4, 2.2, 0.85, M.gravel); G.piece(6.8, 19.1, 0)(0, 0, 0.4, 0.75, 1.6, 0.6, M.gravel); G.piece(6.6, 19.3, 0)(0, 0, 0.75, 1.0, 0.9, 0.36, M.gravel);
  G.patch(8.6, 17.6, 2.2, 1.2, 'gravel', 0.3); G.patch(10.2, 18.6, 1.4, 0.9, 'gravel', -0.2);
  G.handcart(9.7, 17.7, 0.5, 'sacks');                                                         // (out from the wall: no pocket of floor behind it)
  G.tyres(4.75, 16.4, 3);
  G.satDish(4.6, 12.4, 2.4, 1.7);
  grp('road');
  G.jersey(24.6, 21.75, 1, 0.16); G.jersey(26.6, 25.2, 1, -0.2);                              // the station's chicane on the road, short of the tunnel
  // the rail along the drop: posts and one steel beam, bent where something left the road once
  for (let x = 1.2; x < 36.5; x += 2.4) add({ c: [x, 0.36, 26.5], h: [0.05, 0.36, 0.05], ...M.galv });
  for (const [x0, x1, z, yaw] of [[0, 17.3, 26.42, 0], [17.5, 21.1, 26.56, -0.07], [21.3, 36.6, 26.42, 0]] as const) add({ c: [(x0 + x1) / 2, 0.6, z], h: [(x1 - x0) / 2, 0.11, 0.02], yaw, ...M.galv });
  // the mains come up the road on poles, and go into the tunnel
  for (const x of [2.6, 13.4, 24.2, 35.0]) { add({ c: [x, 1.66, 26.0], h: [0.07, 1.66, 0.07], ...M.woodGrey }); add({ c: [x, 3.2, 26.0], h: [0.05, 0.05, 0.5], ...M.woodGrey }); }
  G.wire(2.6, 26.0, 13.4, 26.0, 3.22); G.wire(13.4, 26.0, 24.2, 26.0, 3.22); G.wire(24.2, 26.0, 35.0, 26.0, 3.22); G.wire(35.0, 26.0, PORTAL_X, 25.4, 3.2);
  // the sign on the road's side: the tunnel, and what a lorry may weigh in it
  add({ c: [20.2, 0.9, 20.75], h: [0.03, 0.9, 0.03], ...M.galv }); add({ c: [20.2, 1.75, 20.72], h: [0.42, 0.3, 0.02], ...M.paintBlue }); add({ c: [20.2, 1.75, 20.745], h: [0.3, 0.06, 0.004], ...M.paintCream, flags: DECAL });

  // ---- THE ROAD'S TWO PARTIES (kept) ----
  grp('road.squad');
  G.pickup(TRUCK_A.x, TRUCK_A.z, TRUCK_A.yaw, 'truckWhite', { load: 'crates' });
  G.pickup(TRUCK_B.x, TRUCK_B.z, TRUCK_B.yaw, 'truckTan', { load: 'sacks' });
  for (const v of [TRUCK_A, TRUCK_B]) { const c = at(v, 0.36, 0, 0); cap(c[0], c[2], 1.0, 1.3, 1.58, v.yaw, 0.03); }   // a dusting on each cab's roof: they have not stood long
  grp('road.block');
  G.sandbags(33.2, 21.5, 1.5, HALF, 4); G.sandbags(33.6, 24.5, 1.5, HALF, 4);                 // the roadblock: a low wall across each lane, and a gap between them a man walks through (1.5 m: the walk grid wants a clear cell and a half)
  cap(33.2, 21.5, 0.3, 1.3, 0.8, 0, 0.04); cap(33.6, 24.5, 0.3, 1.3, 0.8, 0, 0.04);
  G.drum(34.6, 20.9, 'rust'); G.tyres(35.0, 25.2, 3);
  G.pickup(GUN_TRUCK.x, GUN_TRUCK.z, GUN_TRUCK.yaw, 'truckRed', { mount: true });               // the gun truck, nose down the road
  // its two head lamps, lit: the road between the two parties is theirs (its own battery: the mains box does not reach them; a round puts one out)
  grp('road.lamps');
  for (const [k, lz] of [[0, -0.66], [1, 0.66]] as const) {
    const lens = add({ c: at(GUN_TRUCK, 2.49, 0.69, lz), h: [0.02, 0.06, 0.13], yaw: GUN_TRUCK.yaw, ...M.plasticWhite, emissive: [26, 24, 20], flags: BoxFlag.NoShadow });
    const d = at({ x: 0, z: 0, yaw: GUN_TRUCK.yaw }, 1, 0, 0);
    lights.push({ kind: 'spot', pos: at(GUN_TRUCK, 2.6, 0.69, lz), dir: norm([d[0], -0.035, d[2]]), color: [1.0, 0.93, 0.8], intensity: 120, range: 26, innerDeg: 9, outerDeg: 24,
      name: `gun_truck_lamp_${k}`, group: 'exterior', enabled: true, volumetric: 0.35, fixtureBox: lens, radius: 0.07, mains: false });
  }

  // ---- THE HOUSE IS SHUTTERED FOR THE STORM: boards over its four windows, outside. Nobody in the yard sees into a room, and nobody in a room into the yard:
  // a room is met at its door (and the fog of war has something to hide). A line of the room's light stands between each pair of boards while the mains are up
  grp('shutters');
  const slit = (name: string, group: string, c: Vec3, h: Vec3) => { const b = add({ c, h, ...M.plasticWhite, emissive: [7, 4.4, 2.0], flags: DECAL }); switchables.push({ name, boxes: [b], group, on: true, baseEmissive: [7, 4.4, 2.0] }); };
  for (const [a, b, room] of [[5.4, 7.2, 'tea'], [11.2, 13.0, 'tea'], [20.5, 21.6, 'kitchen']] as const) {
    const m = (a + b) / 2, w = (b - a) / 2;
    for (const s of [-1, 1]) add({ c: [m + s * (w / 2 + 0.035), 1.375, 11.65], h: [w / 2 + 0.01, 0.52, 0.025], ...M.woodGrey });
    add({ c: [m, 1.375, 11.685], h: [w + 0.1, 0.05, 0.02], ...M.poplar });
    slit(`shutter_${room}_${Math.round(a)}`, room, [m, 1.5, 11.66], [0.012, 0.3, 0.012]);
  }
  for (const s of [-1, 1]) add({ c: [28.85, 1.375, 18.3 + s * 0.335], h: [0.025, 0.52, 0.31], ...M.woodGrey });
  add({ c: [28.815, 1.375, 18.3], h: [0.02, 0.05, 0.7], ...M.poplar });
  slit('shutter_bunk', 'bunk', [28.84, 1.5, 18.3], [0.012, 0.3, 0.012]);

  // ================================================================ SNOW: laid by hand ====
  // ---- cleared to earth: the gateway, the three doors on the yard, the ring melted round the brazier, the mains box, the generator ----
  grp('snow.cleared');
  cleared('gateway', GATE.a + 0.15, 19.0, GATE.b - 0.15, 21.2, 0.45);
  cleared('tea_door', 8.15, 11.64, 10.35, 13.0, 0.4);
  cleared('kitchen_door', 16.5, 11.64, 19.9, 12.7, 0.35);                                     // (the kitchen's door and the mains box beside it)
  cleared('bunk_door', 27.6, 15.5, 28.86, 17.0, 0.35);
  cleared('brazier', 11.0, 13.9, 12.0, 14.9, 0.35);
  cleared('generator', 30.2, 7.8, 33.6, 8.9, 0.3);
  // ---- trodden paths: from the gate to each door, between the doors, round to the court ----
  grp('snow.paths');
  path([[14.3, 19.0], [12.6, 16.4], [10.2, 14.2], [9.4, 13.3]], 0.9);                           // gate → the tea room
  path([[14.6, 18.9], [16.0, 15.6], [17.2, 13.0]], 0.8);                                       // gate → the kitchen
  path([[10.6, 12.6], [16.3, 12.4]], 0.7);                                                     // door to door along the range
  path([[19.9, 12.5], [24.0, 13.3], [27.9, 13.6], [28.3, 15.6]], 0.75);                        // the kitchen → up the lane by the store's wall → round the lorry's tail → the bunkhouse
  path([[27.6, 15.3], [28.2, 12.6], [31.0, 12.4], [31.9, 9.2]], 0.7);                           // the bunkhouse → round its corner → the generator
  path([[15.4, 18.4], [17.4, 17.5], [20.6, 17.3]], 0.7);                                       // gate → the lorry's cab
  // ---- ruts: along the road and into the tunnel; in through the gate and round to the lorry ----
  grp('snow.ruts');
  ruts([[0, 22.4], [PORTAL_X, 22.4]], 1.7); ruts([[0, 24.5], [26.0, 24.5]], 1.7);
  ruts([[19.6, 22.6], [16.0, 21.9], [14.7, 20.6]]);
  ruts([[14.5, 20.4], [14.6, 18.6], [15.8, 16.7], [17.8, 15.9], [20.4, 15.7]]);
  // ---- tracked in: grey slush on the floor inside each outside door (nothing white under a roof) ----
  grp('snow.tracked');
  flat(DOOR.tea, 11.0, 0.8, 0.55, S.snowOld, 0.08); flat(9.05, 10.4, 0.35, 0.3, S.snowOld, -0.3);
  flat(DOOR.kitchen, 11.0, 0.8, 0.5, S.snowOld, -0.06);
  flat(29.5, DOOR.bunk, 0.5, 0.8, S.snowOld, 0.07);
  flat(PORTAL_X + 0.9, 23.4, 1.6, 4.2, S.snowOld, 0.02);                                      // … and blown a little way into the tunnel's mouth
  // ---- caps: the walls' copings and piers, the gate posts; what stands in the yard; the road's things ----
  grp('snow.caps');
  copingCaps('z', 4, 11.62, 19.88); copingCaps('x', GATE.z, 4.3, 8.2); copingCaps('x', GATE.z, 8.8, 12.7); copingCaps('x', GATE.z, 16.3, 20.7); copingCaps('x', GATE.z, 21.3, 24.7); copingCaps('x', GATE.z, 25.3, 28.88);
  copingCaps('x', 4, 29.12, 36.12); copingCaps('z', 36, 4.12, 13.38);
  for (const x of [4.0, 8.5, 21.0, 25.0]) cap(x, GATE.z, 0.42, 0.42, 2.52, 0, 0.06);          // the piers
  cap(GATE.a - 0.17, GATE.z, 0.3, 0.3, 2.58, 0, 0.07); cap(GATE.b + 0.17, GATE.z, 0.3, 0.3, 2.58, 0, 0.07);   // the gate posts
  cap(13.5, 11.97, 1.1, 0.3, 0.42, 0, 0.07);                                                  // the wood pile
  cap(12.7, 13.1, 0.34, 0.34, 0.32, 0.4, 0.04);                                               // the chopping block
  cap(22.5, 12.05, 0.36, 0.36, 0.88, 0, 0.05); cap(22.5, 12.05, 0.36, 0.36, 0.878, Math.PI / 4, 0.05);   // the drum's lid (two squares: an octagon's)
  cap(26.6, 12.1, 0.78, 0.3, 0.9, 0, 0.07);                                                   // the crates
  cap(16.9, 18.9, 0.36, 1.3, 0.8, 0, 0.05);                                                   // the sandbags
  cap(6.6, 19.3, 1.5, 0.5, 1.0, 0, 0.06); cap(8.0, 19.0, 0.9, 0.7, 0.4, 0, 0.05);             // the grit heap's top and its shoulder (the face they dig at is bare)
  cap(10.0, 19.0, 0.7, 0.45, 0.97, 0.2, 0.05);                                                // the handcart's load
  cap(4.75, 16.4, 0.44, 0.44, 0.6, 0.3, 0.05);                                                // the tyres
  cap(24.6, 21.75, 1.86, 0.2, 0.81, 0.16, 0.05); cap(26.6, 25.2, 1.86, 0.2, 0.81, -0.2, 0.05);   // the barriers
  cap(20.2, 20.72, 0.8, 0.05, 2.05, 0, 0.04);                                                 // the sign
  cap(PORTAL_X, 19.7, 0.3, 2.3, 3.6, 0, 0.08); cap(PORTAL_X, 26.6, 0.3, 1.6, 3.6, 0, 0.08); cap(PORTAL_X, 23.4, 0.3, 4.4, 3.6, 0, 0.06);   // the tunnel's face
  // ---- BANKS (they stop feet: against a wall, out of every route, none within 1.4 m of a door) ----
  grp('snow.banks');
  bank(4.5, 14.2, 3.0, 0.74, HALF, 0.4);                                                      // the blind wall inside, north of the tyres
  bank(19.2, 19.5, 5.0, 0.7, Math.PI, 0.4); bank(25.6, 19.45, 6.2, 0.8, Math.PI, 0.46);       // along the road wall inside, behind the lorry, deeper toward the bunkhouse's corner
  bank(28.5, 13.0, 0.8, 1.6, -HALF, 0.36);                                                    // the bunkhouse's corner on the alley
  bank(35.4, 10.6, 3.6, 0.9, -HALF, 0.46); bank(32.6, 13.05, 5.4, 0.74, Math.PI, 0.4);        // the court: its lee wall, the bunkhouse's back
  bank(9.0, 26.05, 17.6, 0.62, Math.PI, 0.5); bank(28.0, 26.05, 16.4, 0.62, Math.PI, 0.55);   // the plough's bank along the rail
  bank(18.0, 3.45, 26.0, 0.6, 0, 0.5);                                                        // packed between the cut and the range's back
  G.piece(18.8, 27.36, 0)(0, 0, 0, 0.34, 18.75, 0.6, S.snow);                                 // what the plough throws over the rail: a berm the length of the drop (no floor out there to be sent to)
  // ---- DRIFTS (walk-over, 0.19 m and under: wind-laid snow a man wades) ----
  grp('snow.drifts');
  drift(6.3, 11.88, 2.2, 0.5, 0, 0.16); drift(12.1, 11.86, 1.4, 0.46, 0, 0.15);               // under the tea room's two windows
  drift(21.1, 11.84, 1.2, 0.4, 0, 0.13);                                                      // under the kitchen's
  drift(25.4, 12.5, 4.8, 0.5, 0, 0.14);                                                       // against the drums and the crates
  drift(28.62, 18.4, 1.6, 0.46, -HALF, 0.15); drift(28.62, 14.3, 1.2, 0.46, -HALF, 0.14);     // the bunkhouse's wall: under its window, north of its door
  drift(16.5, 18.9, 1.5, 0.46, -HALF, 0.14);                                                  // the sandbags' windward side
  drift(9.6, 19.56, 6.2, 0.6, Math.PI, 0.17);                                                 // the road wall inside, west of the gate, round the grit
  drift(4.44, 18.2, 3.0, 0.6, HALF, 0.15);                                                    // the blind wall's corner
  drift(8.4, 20.42, 9.0, 0.6, 0, 0.16); drift(22.4, 20.42, 12.4, 0.6, 0, 0.16);               // OUTSIDE: the foot of the road wall, either side of the gateway
  drift(32.5, 20.4, 6.6, 0.56, 0, 0.15);                                                      // … and of the bunkhouse
  drift(3.56, 12.0, 15.6, 0.7, -HALF, 0.18);                                                  // OUTSIDE: the whole windward wall (as deep as a man wades and no deeper: a wall with no floor at its foot takes no charge)
  drift(36.44, 11.0, 13.0, 0.6, HALF, 0.15);                                                  // OUTSIDE: the lee wall
  drift(24.2, 21.4, 1.9, 0.44, Math.PI + 0.16, 0.14); drift(26.3, 24.8, 1.9, 0.44, Math.PI - 0.2, 0.14);   // the barriers' windward side
  drift(37.2, 20.5, 0.7, 1.4, -HALF, 0.16); drift(37.2, 26.2, 0.7, 0.8, -HALF, 0.16);         // the foot of the tunnel's face
  // sastrugi: long low ridges the wind has cut across the open snow, all on one bearing (out of the north-west)
  for (const [x, z, len, d, h] of [[7.2, 15.2, 2.2, 0.5, 0.07], [9.4, 17.0, 1.6, 0.4, 0.06], [19.6, 14.9, 2.0, 0.45, 0.08], [23.4, 13.6, 1.4, 0.36, 0.06], [25.6, 15.4, 2.2, 0.45, 0.07],
    [26.4, 17.6, 1.4, 0.34, 0.06], [5.6, 13.4, 1.6, 0.4, 0.06], [33.0, 10.4, 1.8, 0.4, 0.06],
    [1.8, 11.4, 2.6, 0.5, 0.08], [2.4, 16.6, 2.2, 0.5, 0.07], [1.6, 20.0, 2.0, 0.45, 0.07], [37.2, 8.0, 1.0, 0.4, 0.07], [37.0, 16.4, 1.0, 0.4, 0.07],
    [6.0, 26.95, 2.6, 0.5, 0.08], [13.8, 26.95, 2.2, 0.45, 0.07], [21.0, 26.95, 2.4, 0.5, 0.08], [27.4, 26.95, 2.0, 0.45, 0.07], [33.2, 26.95, 1.8, 0.4, 0.07]] as const)
    add({ c: [x, h / 2, z], h: [len / 2, h / 2, d / 2], yaw: -0.62 + ((x * 3 + z) % 1) * 0.16, ...S.snow });

  // ---- lights ----
  grp('lights');
  /** embers: a small warm light with a glowing box for its fixture (a shot puts it out), its own fuel */
  const glow = (name: string, group: string, box: { c: Vec3; h: Vec3 }, pos: Vec3, intensity: number, range: number) => {
    const fb = add({ ...box, ...M.rust, emissive: [11, 3.8, 0.9], flags: DECAL });
    lights.push({ kind: 'point', pos, dir: [0, -1, 0], color: [1.0, 0.5, 0.2], intensity, range, innerDeg: 0, outerDeg: 180, name, group, enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.06, mains: false });
  };
  /** a sodium lamp on a wall or a post, thrown down and out along `dir`: on the mains, group 'exterior' (the photocell puts it out at midday) */
  const sodium = (name: string, head: Vec3, dir: Vec3, intensity = 60, range = 8) => {
    const fb = add({ c: head, h: [0.12, 0.06, 0.12], ...M.plasticBlack, emissive: [30, 20, 9], flags: DECAL });
    lights.push({ kind: 'spot', pos: [head[0] + dir[0] * 0.05, head[1] - 0.08, head[2] + dir[2] * 0.05], dir: norm(dir), color: [1.0, 0.72, 0.42], intensity, range, innerDeg: 36, outerDeg: 72,
      name, group: 'exterior', enabled: true, volumetric: 0.15, fixtureBox: fb, radius: 0.12, broad: true });
  };
  G.bulb(6.8, 8.2, 'bulb_tea_a', 'tea'); G.bulb(11.4, 7.6, 'bulb_tea_b', 'tea');
  G.bulb(17.6, 7.6, 'bulb_kitchen', 'kitchen');
  G.bulb(25.4, 7.6, 'bulb_store', 'store', true, 14);
  G.bulb(32.5, 16.6, 'bulb_bunk', 'bunk', true, 20);
  G.bulb(32.8, 6.0, 'bulb_gen', 'court', true, 18);
  grp('stoves');
  G.stove(8.4, 6.6); glow('stove_tea', 'tea', { c: [8.4, 0.3, 6.82], h: [0.07, 0.05, 0.012] }, [8.4, 0.32, 6.95], 3.2, 4.5);                    // the tea room's stove (kept: its glow is a light)
  G.stove(33.2, 14.4); glow('stove_bunk', 'bunk', { c: [32.99, 0.3, 14.4], h: [0.012, 0.05, 0.07] }, [32.86, 0.32, 14.4], 3.0, 4.5);            // the bunkhouse's, its door toward the room's own door
  G.tandoor(14.75, 10.6); glow('oven_kitchen', 'kitchen', { c: [14.75, 0.552, 10.6], h: [0.16, 0.004, 0.16] }, [14.75, 0.7, 10.6], 2.4, 3.5);  // the bread oven's mouth
  G.drum(11.5, 14.4, 'rust'); glow('brazier', 'exterior', { c: [11.5, 0.884, 14.4], h: [0.19, 0.006, 0.19] }, [11.5, 1.05, 14.4], 9, 6.5);     // the brazier in the yard: an oil drum of wood, where the gate's watch stands
  grp('lanterns');
  G.lantern(7.3, 11.92, 'lantern_door', 'exterior', 0.3);                                     // on the crate under the tea room's window
  G.lantern(4.6, 10.8, 'lantern_tea', 'tea');                                                 // on the floor in the tea room's corner
  G.lantern(35.4, 19.4, 'lantern_bunk', 'bunk');                                              // on the floor in the bunkhouse's far corner
  grp('lamps');
  add({ c: [GATE.b + 0.05, 2.5, GATE.z], h: [0.13, 0.015, 0.015], ...M.galv }); sodium('lamp_gate', [GATE.b - 0.16, 2.44, GATE.z], [-0.5, -0.86, 0], 70);   // over the gate, an arm off its east post
  sodium('lamp_kitchen', [DOOR.kitchen, 2.56, 11.76], [0, -0.9, 0.44], 46);                   // over the kitchen's door (and the mains box beside it)
  sodium('lamp_bunk', [28.74, 2.56, DOOR.bunk], [-0.44, -0.9, 0], 46);                        // over the bunkhouse's
  sodium('lamp_tunnel', [PORTAL_X - 0.3, 3.3, 23.4], [-0.55, -0.83, 0], 90, 10);              // over the tunnel's mouth, on the roadblock
  lights.push({ kind: 'point', pos: [38.8, 2.7, 23.4], dir: [0, -1, 0], color: [1.0, 0.62, 0.3], intensity: 30, range: 7, innerDeg: 0, outerDeg: 180, name: 'tunnel_bore', group: 'exterior', enabled: true, volumetric: 0.3, radius: 0.1 });   // the bore's own sodium glow
  // THE MOON IS TWO FIFTHS OF ANOTHER LEVEL'S (0.06 against 0.15), as the pass's is and for its reason: snow is the brightest ground paint in the game
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.5, 0.68, 1.0], intensity: 0.06, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the mains, where a man can follow them: the generator under its tin in the court, a flex over the range's roof line to the box on the kitchen's
  // yard wall, one on to the gate's lamp and one to the bunkhouse ----
  grp('mains');
  G.generator(32.4, 5.3, 0);
  G.wire(30.0, 6.4, 29.0, 6.4, 2.8); G.wire(19.3, 11.66, 19.3, 11.9, 2.75); G.wire(19.3, 11.9, GATE.b + 0.1, GATE.z, 2.62); G.wire(19.3, 11.9, 28.86, 15.0, 2.7);
  // ---- THE MAINS BOX on the kitchen's yard wall, a conduit up to the eaves: the breaker a teammate throws ----
  grp('breaker');
  const brk = add({ c: [BREAKER[0], 1.35, 11.665], h: [0.28, 0.36, 0.045], albedo: [0.42, 0.44, 0.45], name: 'mains_box' });
  const brkLed = add({ c: [BREAKER[0] - 0.18, 1.62, 11.715], h: [0.015, 0.015, 0.01], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [BREAKER[0] + 0.16, 2.3, 11.64], h: [0.02, 0.6, 0.02], albedo: [0.3, 0.31, 0.32] });
  // ---- THE EMERGENCY BEACONS: red, on a battery, turning only while the mains are out (game/lighting.ts). Four of the five are out of doors, on brackets a
  // man can see from above: the light a blackout is known by here is red sweeping over snow ----
  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, y: number, z: number, indoors = false) => {
    const f = BoxFlag.NoShadow | (indoors ? BoxFlag.NoPrimary : 0);
    add({ c: [x, y + 0.13, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: f });
    const dome = add({ c: [x, y, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: f });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, y - 0.11, z], box: dome });
  };
  beacon(18.3, 2.72, 11.74);                                                                  // on the range's yard wall, over the mains box
  beacon(28.76, 2.72, 14.8);                                                                  // on the bunkhouse, beside its door
  beacon(GATE.a - 0.17, 2.74, GATE.z);                                                        // on the gate's west post: the yard on one side of it, the road on the other
  beacon(9.0, H - 0.19, 7.8, true);                                                           // in the tea room, under its beams
  beacon(PORTAL_X - 0.2, 3.3, 21.6);                                                          // on the tunnel's face

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along an x-wall; π/2: +z along a z-wall; swing +1 opens toward +z / −x, −1 toward −z / +x).
  // Every id is its room's plain name. 'pass' and 'store' open into the kitchen; the range's two yard doors author no swing (the room rule deals each into its room)
  const hinge = (m: number) => m - 0.58;
  const doors: LevelDoorDef[] = [
    { name: 'tea', hinge: [hinge(DOOR.tea), 11.5], closedDir: 0, width: 1.16, exterior: true },
    { name: 'kitchen', hinge: [hinge(DOOR.kitchen), 11.5], closedDir: 0, width: 1.16, exterior: true },
    { name: 'pass', hinge: [14.0, hinge(DOOR.pass)], closedDir: HALF, width: 1.16, swing: -1 },
    { name: 'store', hinge: [22.0, hinge(DOOR.store)], closedDir: HALF, width: 1.16, swing: 1, locked: true },   // its man has the key, the squad has a charge (the wall beat)
    { name: 'bunk', hinge: [29.0, hinge(DOOR.bunk)], closedDir: HALF, width: 1.16, exterior: true, swing: 1 },   // (hung to open OUT onto the yard: nobody inside can wedge it, and the men who come out of it with torches walk straight out)
  ];
  for (const d of doors) doorFrame(d);

  // ---- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<kind><n>'; LAST, after every kept thing) ----
  // What each room is for, said by what stands in it. The TEA ROOM is where the tunnel's men sit out a storm: rugs and floor cushions round the stove, low
  // tables with the tea on them, the samovar's table, a card table by the window. The KITCHEN is the bread oven, a work table, flour, the water cans. The
  // STORE is what a winter needs: sacks to the beams, fuel, crates, road cones' worth of drums under one dim bulb. The BUNKHOUSE is four cots, a trunk, a felt
  // round its stove and the radio's table. The COURT is the generator and its fuel. Nothing stands within 1.1 m of a door's line, on a defender's mark or in
  // his line, and the kitchen's wall to the store is bare on both faces where the charge goes.
  { const spans: [number, string][] = [];
    const room = (n: string) => { spans.push([K.props.length, n]); grp(`lived.${n}`); };
    room('tea');
    G.rug(7.0, 8.6, 3.0, 2.0, 'afghan'); G.rug(11.4, 8.9, 2.4, 1.8, 'baluch');
    G.lowTable(6.9, 8.8, 0.1); G.lowTable(11.5, 9.0, -0.15);
    G.toshak(7.6, 4.52, 1.9, 0); G.toshak(4.52, 8.2, 1.9, HALF, 'rugRed', 'rugOchre'); G.toshak(12.9, 9.9, 1.9, HALF, 'rugNavy', 'rugRed');
    G.table(11.7, 4.55, 1.5, 0.7, 0, 'poplar');                                               // the samovar's table, against the back wall
    add({ c: [11.4, 0.93, 4.5], h: [0.11, 0.18, 0.11], ...M.tin }); add({ c: [11.4, 1.15, 4.5], h: [0.05, 0.04, 0.05], ...M.iron }); add({ c: [12.0, 0.78, 4.55], h: [0.2, 0.03, 0.14], ...M.tin });   // the samovar, a tray of glasses
    G.woodPile(9.6, 4.5, 0, 1.2);                                                             // wood for the stove
    G.gasBottle(10.6, 4.45);                                                                  // the samovar's gas
    G.plasticChair(5.2, 10.6, 2.4, 'plasticGreen'); G.plasticChair(13.25, 8.4, -1.6, 'plasticWhite');
    G.wallHanging('x', 4, 6.4, 1, 'afghan', 1.4, 0.9);
    room('kitchen');
    G.table(15.0, 8.2, 1.0, 0.7, HALF, 'ply');                                                // the work table
    add({ c: [14.95, 0.81, 7.95], h: [0.14, 0.06, 0.14], ...M.iron }); add({ c: [15.0, 0.78, 8.4], h: [0.2, 0.03, 0.14], ...M.poplar });   // a pot, the bread board
    G.table(17.4, 4.55, 1.4, 0.66, 0, 'tin');                                                 // the washing-up, against the back wall
    G.sacks(15.6, 4.7, 0, 3);                                                                 // flour
    G.jerryCan(18.5, 4.48, 0.3, 'plasticBlue'); G.jerryCan(18.86, 4.52, -0.2, 'plasticBlue');
    G.gasBottle(19.4, 4.5);
    room('store');
    G.sacks(23.2, 4.72, 0, 4); G.sacks(24.4, 4.72, 0, 3); G.sacks(25.6, 4.75, 0, 4);
    G.drum(28.4, 7.4, 'drumBlue'); G.drum(28.4, 8.1, 'rust', 0.3); G.drum(28.4, 8.8, 'drumRed', 0.1); G.drum(28.35, 9.6, 'olive', 0.5);
    G.crates(26.4, 10.9, 0, 3); G.crates(28.3, 10.8, HALF, 2, 'coyote');
    G.jerryCan(24.9, 11.0, 0.1); G.jerryCan(25.3, 10.95, -0.3, 'jerryYellow');
    room('bunk');
    G.rug(32.6, 16.5, 2.4, 1.6, 'felt');
    G.cot(35.3, 14.9, HALF); G.cot(35.3, 17.1, HALF, true, 'blanketBrown'); G.cot(33.6, 19.4, 0, false); G.cot(31.6, 19.45, 0);
    G.trunk(35.25, 18.75, HALF, 'paintGreen');
    G.table(31.3, 14.05, 1.2, 0.66, 0, 'ply');                                                // the radio's table
    add({ c: [31.1, 0.87, 14.0], h: [0.2, 0.12, 0.13], ...M.olive }); add({ c: [31.65, 0.79, 14.1], h: [0.08, 0.04, 0.06], ...M.plasticBlack });   // the set, its handset
    G.plasticChair(31.4, 14.85, 0.1, 'plasticBlue');
    room('court');
    G.drums(34.8, 5.0, 2); G.jerryCan(30.6, 5.0, 0.4, 'jerryYellow'); G.patch(32.6, 6.4, 1.2, 0.8, 'oil', -0.2);
    G.waterTank(34.6, 9.2, 'plasticBlue', 1.1);                                               // the fuel tank on its plinth
    G.woodPile(30.2, 11.0, HALF, 1.4);
    spans.push([K.props.length, '']);
    const serial = new Map<string, number>();
    for (let s = 0; s + 1 < spans.length; s++) for (let i = spans[s][0]; i < spans[s + 1][0]; i++) { const key = `lived.${spans[s][1]}.${K.props[i].kind}`, n = serial.get(key) ?? 0; serial.set(key, n + 1); K.props[i].name = `${key}${n}`; }
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: BREAKER, boxes: [brk, brkLed] },
    beacons,
    playerSpawn: SAM,
    routes: [], chokepoints: [], clearPlans: [],     // nobody patrols it: the room clear brings its own cast
    sky: { zenith: [0.012, 0.02, 0.042], horizon: [0.04, 0.05, 0.075] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still): the store, a point on its back wall, the tea room's door
    mission: { serverRoom: { ...STORE }, entryDoor: 'store', rack: { index: 0, front: [27.0, 1.0, 4.6], halfW: 0.3 }, exfilDoor: 'tea', exfilX: DOOR.tea, exfilZ: 12.1, exfilOut: [0, 1] },
  };
  // ---- what is underfoot (game/floor.ts; the six it has): fresh snow is 'grass' (the soft, quiet one); the road, the trodden paths and cleared earth are
  // 'asphalt'; the rooms' beaten earth and slab are 'stone', the rugs 'carpet'. First match wins: rugs, rooms, then the yard's hard patches
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'grass', outside: 'grass', verge: 'grass',
    zones: [
      { id: 'tea_rug_a', mat: 'carpet', x0: 5.5, z0: 7.6, x1: 8.5, z1: 9.6 }, { id: 'tea_rug_b', mat: 'carpet', x0: 10.2, z0: 8.0, x1: 12.6, z1: 9.8 },
      { id: 'bunk_felt', mat: 'carpet', x0: 31.4, z0: 15.6, x1: 33.8, z1: 17.2 },
      { id: 'range', mat: 'stone', x0: 4, z0: 4, x1: 29, z1: 11.5 }, { id: 'bunk', mat: 'stone', x0: 29, z0: 13.5, x1: 36, z1: 20 },
      { id: 'generator_slab', mat: 'stone', x0: 29.9, z0: 4.1, x1: 35.9, z1: 7.7 }, { id: 'tunnel', mat: 'stone', x0: PORTAL_X, z0: 21.0, x1: 40, z1: 25.8 },
      { id: 'road', mat: 'asphalt', x0: 0, z0: 21.0, x1: PORTAL_X, z1: 25.6 },
      ...zones,
    ],
  };
  return { level, scenarios: SCENARIOS, groups: trace.groups, surfaces };
}
