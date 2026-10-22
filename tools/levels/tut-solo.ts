// TUT-SOLO — the tutorial's solo loud mission, "Alone, loud": THE FUEL HALT. One man, a rifle with a launcher, a pistol, a smoke, a stun can, two frags and
// one door charge, walked along ONE LINE: the road and its shot-up van, the yard gate, the truck court, the arch, the gun court, the shop's locked door, the
// store behind it, and back out the way he came with the halt's code book. One new action a step, each inside a fight that is a size bigger than the last:
// a sentry who cannot see him, a gun that can, a gun's nest for a frag, a door for a charge, a room for a stun can, and two men at his back for the launcher.
//
// THE SENTENCE NOBODY COULD SAY OF ANOTHER LEVEL: every piece of cover on it is the lesson for the key that uses it.
// THE HAND PLACEMENT: the fights are the level's script (levels/tut-solo.script.ts): the five men of the roster are held on their marks until their beat, so the
// first of every list here is the only deal there is. The sentry stands in the gate's line and nowhere near cover; the gun's cone through the arch falls on the
// parked truck and never on the way to the arch's near jamb; the sandbags, the gap and the barrier are one crouch, one smoke and one frag long.
//
//        x 0        9          16              25          30.5        36
//   z 5             ┌──────────┬───────────────┬──────────────────────┐
//         pumps     │  truck   │  nest ▒▒ gun  │ (the generator)      │
//         ▢ ▢       │  court   │               ├───────────┬──────────┤ z 10.5
//   road ═ van ═ gate_w  ▮ sentry  ▒▒▒sandbags▒  gap ▓▓ shop door  shop  ·  store ▣ trunk
//                   │   jersey │ arch          │           │          │
//         start     │  pickup  │               ├───────────┴──────────┤ z 17.5
//   z 23            └──────────┴───────────────┴──────────────────────┘
//
//   bun run tools/levels/export.ts tut-solo [--check]      → levels/tut-solo.json
//   bun run tools/qa/lesson-check.ts tut-solo              the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts tut-solo                the scripted player through every step to the debrief
//   page: ?levelFile=tut-solo.json&quiet&hour=dusk&weather=dust
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { LevelScenarios, LessonData, LessonStep, QuietData, Rect, IssueData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { LAST_IN, LAST_MEN } from '../../levels/tut-solo.script';

export const NAME = 'tut-solo';
export const NOTES = 'The tutorial\'s solo loud mission: a walled fuel halt on a road, walked along one line (road, gate, truck court, arch, gun court, shop, store) and back out. Its fights are staged by levels/tut-solo.script.ts. Regenerate: bun run tools/levels/export.ts tut-solo';
export const MATERIALS = GWOT_MATERIALS;

const HALF = Math.PI / 2;
/** the yard inside its wall, and the two cross walls */
export const YARD: Rect = { x0: 9, x1: 36, z0: 5, z1: 23 };
/** THE LINE the mission is walked along: the yard gate, the arch, the shop's door and the store's doorway are all centred on it (a door's middle sits on a
 *  walk-grid cell: z 14.25, never 14) */
export const AXIS = 14.25;
const DOORWAY = { a: AXIS - 0.6, b: AXIS + 0.6 }, HINGE = AXIS - 0.58;
const ARCH_X = 16, FRONT_X = 25, PART_X = 30.5, ROOM_Z0 = 10.5, ROOM_Z1 = 17.5;

// ---- the marks the level, its script and its scripted player all read ----
/** where he starts, on the road behind the pumps */
export const START: Vec3 = [1.3, 0, 11.6];
/** behind the shot-up van's tail (step 'move') */
export const VAN: Vec3 = [2.7, 0, 14.4];
/** the yard wall beside the gate (the sprint's end, the wall he takes) */
export const WALL: Vec3 = [8.35, 0, 16.2];
/** the sentry, in the gate's line */
export const SENTRY: Vec3 = [13.9, 0, AXIS];
/** the arch's near jamb, out of the gun's cone (step 'crouch') */
export const JAMB: Vec3 = [15.1, 0, 11.5];
/** the far end of the sandbags (step 'low') */
export const BAGS_END: Vec3 = [20.2, 0, 13.6];
/** where the smoke goes: the gap, on the gun's side of it */
export const GAP: Vec3 = [21.7, 0.1, 11.4];
/** behind the barrier (steps 'cross', 'back') */
export const BARRIER: Vec3 = [23.3, 0, 13.9];
/** beside the shop's door: out of the charge's backblast (1.6 m) and out of the doorway's line, which the man inside is looking down (step 'back') */
export const BACK: Vec3 = [23.9, 0, 16.0];
/** the gun's nest and the man on the gun */
export const NEST: Vec3 = [22.6, 0.4, 7.0];
export const GUNNER: Vec3 = [22.7, 0, 6.9];
/** the shop's door (the charge), the man behind it, the doorway to the store (the stun can), the two men in there */
export const SHOP_DOOR: Vec3 = [FRONT_X, 1.0, AXIS];
export const SHOP_MAN: Vec3 = [27.7, 0, AXIS];
export const STORE_DOORWAY: Vec3 = [31.6, 0.2, AXIS];
export const STORE_MEN: Vec3[] = [[33.9, 0, 11.9], [33.6, 0, 16.3]];   // (neither can be seen, or shot, from outside the shop: the two doorways' cone misses both)
/** the trunk the code book is in: the store's far corner, OFF the mission's line (the doorways make that line a gallery the length of the yard) */
export const TRUNK: Vec3 = [35.3, 0, 11.5];
/** THE LAST FIGHT IS BEHIND HIM, AND TO THE RIGHT OF THE SCREEN. The launcher's grenade arms 8 m out, and that is the edge of what the camera shows: only up the
 *  mission's line (east) does the view reach it, clear of the kit panel. So he is sent back to the arch first, and the last two come out through the building
 *  he has just cleared and stand in the shop's doorway, 8.5 m and more from anywhere the arch's line lets him stand: on the screen, armed, one grenade's worth. */
export const ARCH_MOUTH: Vec3 = [16.5, 0, AXIS];
/** the shop's doorway from outside: where the launcher's grenade goes */
export const LAST_COVER: Vec3 = [25.9, 1.0, AXIS];
/** where they stand behind it, and where they come onto the floor: the level's script's own numbers (it is the file the page takes) */
export { LAST_MEN, LAST_IN };
/** the way out: the yard gate he came in by */
export const EXIT = { name: 'the road', door: 'gate_w', x: 8.2, z: AXIS, out: [-1, 0] as [number, number] };

/** THE TUTORIAL FRAME'S KEYS, a step each: `allow` turns actions on for the rest of the mission (from the first step he can walk, and turn and zoom the view as the first mission taught him: `rails.allow`),
 *  `cue` goes to the level's script as the step comes up ('lesson:<cue>'), `checkpoint` names the one save of a beat. Four checkpoints, each where he has
 *  just finished a fight and nobody alive can see him: the gate (the sentry is down), the gun (the nest is out), the shop (its man is down), the store (the
 *  building is his). */
export const FRAME: Record<string, { allow?: string[]; cue?: string; checkpoint?: string }> = {
  move: { cue: 'road' }, sprint: { allow: ['sprint'] }, ready: { allow: ['slot:rifle'] }, wall: { allow: ['wall'], cue: 'cease' }, fire: { allow: ['aim', 'fire'] },
  reload: { allow: ['reload'], checkpoint: 'the gate' }, crouch: { allow: ['crouch'], cue: 'gun' }, low: { cue: 'bags' },
  smoke: { allow: ['slot:smoke'], cue: 'gap' }, cross: { cue: 'blind' }, frag: { allow: ['slot:frag'] },
  pistol: { allow: ['slot:pistol'], checkpoint: 'the gun' }, charge: { allow: ['use', 'ring'] }, blow: { allow: ['word'] }, shop: { cue: 'shop' },
  stun: { allow: ['slot:flash'], cue: 'room', checkpoint: 'the shop' }, store: {},
  take: { checkpoint: 'the store' }, launch: { allow: ['alt'], cue: 'trucks' }, last: { cue: 'loose' },
};

const SHOP: Rect = { x0: FRONT_X, x1: PART_X, z0: ROOM_Z0, z1: ROOM_Z1 }, STORE: Rect = { x0: PART_X, x1: YARD.x1, z0: ROOM_Z0, z1: ROOM_Z1 };

/** HIS KIT (game/kit.ts kitIssue): one of each can the steps ask for and one to spare of what a first throw may waste */
export const ISSUE: IssueData = { members: { '0': { weapon: 'rifle', smoke: 2, bangs: 2, frags: 2, shells: 3, charges: 1 } } };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY, M = GWOT_MATERIALS, t = GW_SHELL / 2;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];

  // ---- the ground: the plain, the road, the forecourt, the yard's three floors ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(0, 12.3, YARD.x0, 15.7, 'gravel');                       // the road, up to the gate
  G.ground(1.6, 7.6, 8.2, 12.2, 'slab');                            // the forecourt under the pumps
  G.ground(YARD.x0, YARD.z0, ARCH_X, YARD.z1, 'dirt');              // the truck court
  G.ground(ARCH_X, YARD.z0, FRONT_X, YARD.z1, 'gravel');            // the gun court
  G.ground(FRONT_X, YARD.z0, YARD.x1, ROOM_Z0, 'dirt'); G.ground(FRONT_X, ROOM_Z1, YARD.x1, YARD.z1, 'dirt');   // the two back lots
  G.ruts(9.6, 13.2, 15.6, 14.8); G.ruts(0.4, 13.2, 8.6, 14.8, 'gravel');

  // ---- the yard wall, the gate in it, the two cross walls ----
  grp('walls.yard');
  const gate = [{ ...DOORWAY, y0: 0, y1: 2.2 }];
  G.yardWallX(YARD.z0, YARD.x0 - 0.12, YARD.x1 + 0.12); G.yardWallX(YARD.z1, YARD.x0 - 0.12, YARD.x1 + 0.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gate); G.yardWallZ(YARD.x1, YARD.z0, ROOM_Z0, 'mud'); G.yardWallZ(YARD.x1, ROOM_Z1, YARD.z1, 'mud');
  for (const [x, z] of [[9, 5], [9, 23], [36, 5], [36, 23], [16, 5], [16, 23], [25, 5], [25, 23]] as const) G.pier(x, z);
  doors.push({ name: 'gate_w', hinge: [YARD.x0, HINGE], closedDir: HALF, width: 1.16, exterior: true, angle: 1.45, closer: false });   // the yard gate stands open: the sentry's line down the road
  grp('walls.arch');
  G.yardWallZ(ARCH_X, YARD.z0, AXIS - 1.6, 'mudLight'); G.yardWallZ(ARCH_X, AXIS + 1.6, YARD.z1, 'mudLight');   // the arch: a truck's width, no leaf
  G.pier(ARCH_X, AXIS - 1.6); G.pier(ARCH_X, AXIS + 1.6);
  G.gate(ARCH_X + 0.06, AXIS, 'z', 3.2, 1, 'paintBlue', 84);
  grp('walls.front');
  G.yardWallZ(FRONT_X, YARD.z0, ROOM_Z0, 'mud'); G.yardWallZ(FRONT_X, ROOM_Z1, YARD.z1, 'mud');

  // ---- the forecourt on the road: two pumps under a tin canopy, the van that was at them ----
  grp('forecourt');
  G.pump(4.0, 9.9, HALF); G.pump(6.2, 9.9, HALF);
  for (const [x, z] of [[2.4, 8.2], [7.6, 8.2], [2.4, 11.6], [7.6, 11.6]] as const) add({ c: [x, 1.6, z], h: [0.05, 1.6, 0.05], ...M.galv });
  slab(2.1, 3.2, 7.9, 7.9, 3.32, 11.9, P.tin, { flags: BoxFlag.NoPrimary, rough: 0.6 });
  G.tube(4.0, 9.9, true, 'exterior', true, true); G.tube(6.2, 9.9, true, 'exterior', true);
  G.drums(2.3, 9.2, 3); G.jerryCan(7.4, 10.6, 0.4); G.jerryCan(7.6, 10.2, -0.2, 'drumRed'); G.tyres(2.2, 11.2, 3);
  G.patch(5.0, 10.4, 3.4, 2.0, 'oil', 0.2, 0.019);
  grp('forecourt.van');
  G.van(4.5, 14.1, HALF + 0.12);                                    // across the road, nose to the plain: his first cover, and what the sentry's rounds chew
  G.patch(4.4, 14.4, 3.0, 4.6, 'oil', 0.1, 0.019); G.rubble(5.9, 15.6, 0.5, 5);

  // ---- the truck court: the sentry's post, a barrier across the gate's line, the parked truck the gun finds ----
  grp('court.truck');
  G.jersey(12.5, AXIS, 2, HALF);
  G.pickup(12.6, 19.2, 0.25, 'truckWhite', { load: 'drums' });
  G.drums(10.2, 21.6, 4); G.tyres(15.2, 21.8, 4); G.crates(10.0, 6.4, 0.1, 3); G.gasBottle(11.0, 6.2); G.gasBottle(11.4, 6.5);
  G.sacks(14.6, 6.5, 0.2, 4); G.patch(12.4, 18.8, 4.2, 2.6, 'oil', 0.3, 0.019);
  G.lantern(14.6, 13.0, 'lantern_sentry', 'yard', 0);
  G.floodLight(9.5, 22.4, [0.6, -0.8], 'flood_court', true, 3.6);

  // ---- the gun court: the nest in the far corner, the sandbags inside the arch, the gap, the barrier before the shop ----
  grp('court.gun');
  G.sandbags(22.6, 8.2, 3.0, 0, 4); G.sandbags(21.0, 7.2, 2.0, HALF, 4);            // the nest: two low walls, the gun between them
  G.crates(24.0, 6.2, 0.1, 2); G.patch(22.6, 7.0, 2.6, 2.0, 'damp');
  G.sandbags(18.6, 12.55, 4.9, 0, 6);                                              // inside the arch, chest high: a crouched man behind them is out of the gun's sight
  G.hesco(23.4, 12.6, 2, 0);                                                       // the barrier before the shop's door
  G.drumDown(17.6, 16.8, 0.4); G.tyres(19.4, 17.4, 2); G.handcart(20.6, 20.4, 0.5, 'sacks'); G.woodPile(17.2, 21.8, 0.1); G.drums(24.2, 21.6, 3);
  G.blocks(17.4, 6.4, 0.1, 3); G.jerryCan(18.2, 6.2, 0.6);
  G.floodLight(24.4, 22.2, [-0.5, -0.86], 'flood_gun', true, 3.6);

  // ---- the shop and the store behind it: one building against the yard's far wall ----
  grp('shop.floor'); G.ground(SHOP.x0, SHOP.z0, STORE.x1, SHOP.z1, 'slab', 0.006);
  grp('shop.roof'); slab(SHOP.x0 - 0.1, H, SHOP.z0 - 0.1, STORE.x1 + 0.1, H + 0.2, SHOP.z1 + 0.1, P.render, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  grp('shop.walls');
  G.wallX(ROOM_Z0, FRONT_X - t, YARD.x1 + t, 'render'); G.wallX(ROOM_Z1, FRONT_X - t, YARD.x1 + t, 'render');
  G.wallZ(FRONT_X, ROOM_Z0 + t, ROOM_Z1 - t, 'render', [{ a: 11.2, b: 12.5, y0: 0.9, y1: 2.0, glass: 'whole' }, DOORWAY, { a: 15.6, b: 16.9, y0: 0.9, y1: 2.0, glass: 'whole' }]);
  G.wallZ(YARD.x1, ROOM_Z0 + t, ROOM_Z1 - t, 'render');
  G.wallZ(PART_X, ROOM_Z0 + t, ROOM_Z1 - t, 'render', [DOORWAY]);   // the doorway to the store: no leaf (a full wall, not a partition: a round that misses in the shop stops in it)
  doors.push({ name: 'shop', hinge: [FRONT_X, HINGE], closedDir: HALF, width: 1.16, locked: true, closer: false });   // (no closer: once it is open the doorway is a line of fire for the rest of the mission)
  G.dado('z', FRONT_X, 10.6, AXIS - 0.5, -1, 'paintGreen'); G.dado('z', FRONT_X, AXIS + 0.5, 17.4, -1, 'paintGreen');
  zones.push({ id: 'shop', mat: 'stone', x0: SHOP.x0, z0: SHOP.z0, x1: STORE.x1, z1: SHOP.z1 });
  grp('shop.room');
  G.table(27.2, 16.6, 1.8, 0.7, 0); G.crates(29.6, 11.2, 0.1, 2); G.plasticChair(26.2, 16.4, 0.2); G.sacks(26.0, 11.2, 0.1, 3);
  G.bulb(27.8, AXIS, 'bulb_shop', 'shop');
  grp('store.room');
  G.trunk(TRUNK[0], TRUNK[2], HALF, 'paintGreen');
  G.crates(35.2, 14.6, 0.1, 3); G.crates(31.4, 16.8, 0.2, 2); G.drums(35.2, 16.8, 2); G.jerryCan(31.2, 11.0, 0.3);
  G.bulb(33.4, AXIS, 'bulb_store', 'store');
  grp('lots');
  G.generator(30.0, 7.4, 0.1); G.waterTank(32.6, 20.6);

  // ---- light: the moon the hour swaps for its sun, a lamp over the gate and one over the shop's door ----
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.62, -0.5, -0.6]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
  const lamp = (x: number, z: number, name: string, h = 3.4, outerDeg = 52) => {
    add({ c: [x, (h + 0.11) / 2, z - 0.6], h: [0.04, (h + 0.11) / 2, 0.04], ...M.galv });
    add({ c: [x, h + 0.085, z - 0.3], h: [0.025, 0.025, 0.26], ...M.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...M.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...M.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.8, 0.5], intensity: 90, range: 9, innerDeg: outerDeg - 22, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.1, mains: false });
  };
  lamp(10.4, 12.2, 'lamp_gate'); lamp(24.4, 17.7, 'lamp_shop', 3.2, 46);   // (its pole clear of the way from beside the door to the doorway)

  // ---- the breaker and the beacon every level carries (the generator's lot, behind the shop: nobody is sent there) ----
  grp('breaker');
  const brk = add({ c: [28.0, 1.35, 10.34], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const led = add({ c: [27.82, 1.62, 10.29], h: [0.015, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [20.5, 2.28, 5.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [20.5, 2.16, 5.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- five men, each on his mark until the script calls his beat (levels/tut-solo.script.ts names them by roster order) ----
  const post = (name: string, p: Vec3, weapon?: PatrolRoute['weapon']): PatrolRoute => ({ name, points: [p, [p[0] + 0.3, 0, p[2] + 0.2]], wait: [600, 600], ...(weapon ? { weapon } : {}) });
  const routes: PatrolRoute[] = [post('sentry', SENTRY), post('gunner', GUNNER, 'pkm'), post('shop', SHOP_MAN), post('store_a', STORE_MEN[0]), post('store_b', STORE_MEN[1])];

  const front: Vec3 = [TRUNK[0] - 0.44, 0.45, TRUNK[2]];
  const quiet: QuietData = {
    thing: 'the code book',
    starts: [{ name: 'the road', sam: START, samYaw: HALF }],
    spots: [{ place: 'the store', area: { x0: STORE.x0 + t, x1: STORE.x1 - t, z0: STORE.z0 + t, z1: STORE.z1 - t }, door: 'shop', holder: 'the green trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT],
    patrols: [routes.map(r => r.name)],
    radioCheck: false,
  };

  const DOWN = (n: number) => ({ is: 'men', down: n } as const);
  const BEHIND: Rect = { x0: 22.3, x1: 24.6, z0: 13.3, z1: 15.3 };
  /** where a smoke can hides the gap from the gun: the court between the two, the gap itself included (a can thrown back the way he came does not pass) */
  const SMOKED: Rect = { x0: 21.4, x1: 24.8, z0: 7.6, z1: 14.9 };   // (from past where the line before left him: a can dropped at his own feet behind the sandbags hides nothing)
  const lesson: LessonData = {
    title: 'Alone, loud',
    rails: { allow: ['move', 'camera', 'zoom'] },
    steps: ([
      // THE ROAD
      { id: 'move', line: '[W] [A] [S] [D]: get behind the van', done: { is: 'near', at: VAN, r: 1.1 }, at: VAN },
      { id: 'sprint', line: 'Hold [Shift]: sprint to the wall', done: { is: 'all', of: [{ is: 'near', at: WALL, r: 1.6 }, { is: 'flag', flag: 'sprint' }] }, at: WALL },
      { id: 'ready', line: '[2]: rifle up', done: { is: 'slot', slot: 'rifle', drawn: true } },
      { id: 'wall', line: 'Walk into the wall: back to it', done: { is: 'flag', flag: 'wall' }, at: WALL },
      { id: 'fire', line: 'Left button: shoot the sentry', done: DOWN(1), at: [SENTRY[0], 1.2, SENTRY[2]] },
      // THE TRUCK COURT
      { id: 'reload', line: '[R]: reload', done: { is: 'reload' } },
      { id: 'crouch', line: '[C]: crouch at the arch', done: { is: 'all', of: [{ is: 'flag', flag: 'crouch' }, { is: 'near', at: JAMB, r: 1.4 }] }, at: JAMB },
      // THE GUN COURT
      { id: 'low', line: 'Stay low: follow the sandbags', done: { is: 'all', of: [{ is: 'flag', flag: 'crouch' }, { is: 'near', at: BAGS_END, r: 1.1 }] }, at: BAGS_END },
      { id: 'smoke', line: '[3], then left button: smoke the gap', done: { is: 'any', of: [{ is: 'threw', kind: 'smoke', area: SMOKED }, DOWN(2)] }, hold: 2.5, at: GAP },
      { id: 'cross', line: 'Cross behind the smoke', done: { is: 'in', area: BEHIND }, at: BARRIER },
      { id: 'frag', line: '[5], then left button: frag the gun', done: DOWN(2), at: NEST },
      // THE SHOP
      { id: 'pistol', line: '[1]: the pistol', done: { is: 'any', of: [{ is: 'slot', slot: 'pistol', drawn: true }, DOWN(5)] } },
      { id: 'charge', line: 'Hold [Space] on the door: pick the charge', done: { is: 'any', of: [{ is: 'door', door: 'shop', state: 'charged' }, { is: 'door', door: 'shop', state: 'open' }] }, at: SHOP_DOOR },
      { id: 'back', line: 'Stand clear, beside the door', done: { is: 'near', at: BACK, r: 0.9 }, at: BACK },
      { id: 'blow', line: '[F]: blow it', done: { is: 'door', door: 'shop', state: 'open' }, at: SHOP_DOOR },
      { id: 'shop', line: 'Lean in: shoot him', done: DOWN(3), at: [SHOP_MAN[0], 1.0, SHOP_MAN[2]] },
      // THE STORE
      { id: 'stun', line: '[4], then left button: stun the store', done: { is: 'any', of: [{ is: 'threw', kind: 'flash', area: STORE }, DOWN(5)] }, at: STORE_DOORWAY },   // (it passes on the bang itself, in the store: the next line is up while they are still folded)
      { id: 'store', line: 'Go in: shoot both', done: DOWN(5), at: [33.6, 1.0, AXIS] },
      { id: 'take', line: '[Space]: take the code book', done: { is: 'stage', stage: 'exfil' }, at: front },
      // THE WAY OUT
      { id: 'rifle', line: '[2]: back to the rifle', done: { is: 'slot', slot: 'rifle', drawn: true } },
      { id: 'load', line: '[2] again: load the grenade', setupLine: '[2], then [2]: load the grenade', done: { is: 'any', of: [{ is: 'launcher', on: 'he40' }, DOWN(7)] } },
      { id: 'leave', line: 'Back to the arch', done: { is: 'any', of: [{ is: 'near', at: ARCH_MOUTH, r: 0.8 }, DOWN(7)] }, at: ARCH_MOUTH },
      // (a grenade that met something short of the 8 m it arms at is a dud: the line stays until one of the two is down, by the grenade or by anything else)
      { id: 'launch', line: 'Behind you. Hold right button, aim, let go', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'threw', kind: 'he40' }, DOWN(6)] }, DOWN(7)] }, at: LAST_COVER },
      { id: 'last', line: 'Shoot the rest', done: DOWN(7), at: LAST_COVER },
      { id: 'out', line: 'Sprint out by the gate', done: { is: 'stage', stage: 'done' }, at: [EXIT.x, 0, EXIT.z] },
    ] as LessonStep[]).map(T => ({ ...T, ...FRAME[T.id] })),
  };

  for (const d of doors) doorFrame(d);
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices: [],
    breaker: { pos: [28.0, 1.35, 10.2], boxes: [brk, led] }, beacons: [{ pos: [20.5, 2.05, 5.3], box: dome }],
    playerSpawn: START, routes, chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    // (the script's eyes: a play program may ask of the player only whether he stands in a volume. The shop door's line outside it, the shop, the store)
    volumes: [
      { name: 'shop_line', kind: 'trigger', c: [FRONT_X - 1.35, 1, AXIS], h: [1.35, 1, 0.6] },
      { name: 'shop_in', kind: 'trigger', c: [(FRONT_X + PART_X) / 2, 1, (ROOM_Z0 + ROOM_Z1) / 2], h: [(PART_X - FRONT_X) / 2 - 0.05, 1, (ROOM_Z1 - ROOM_Z0) / 2] },
      { name: 'store_in', kind: 'trigger', c: [(PART_X + YARD.x1) / 2 + 0.05, 1, (ROOM_Z0 + ROOM_Z1) / 2], h: [(YARD.x1 - PART_X) / 2 - 0.1, 1, (ROOM_Z1 - ROOM_Z0) / 2] },
    ],
    mission: { serverRoom: { x0: SHOP.x0, x1: STORE.x1, z0: SHOP.z0, z1: SHOP.z1 }, entryDoor: 'shop', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: EXIT.x, exfilZ: EXIT.z, exfilOut: EXIT.out },
  };
  const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
  const scenarios: LevelScenarios = { quiet, lesson, issue: ISSUE, doorNames: [{ door: 'gate_w', name: 'yard gate' }, { door: 'shop', name: 'shop door' }] };
  return { level, scenarios, groups: trace.groups, surfaces };
}
