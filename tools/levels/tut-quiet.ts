// THE LEDGER — the tutorial's quiet mission: one line through a money changer's shop on a snowing night, alone, and each stretch of it is ONE tool and one
// small thrill. The level is made for this mission and for nothing else (no shared yard under it): a shop off a bazaar street, its forecourt behind a street
// wall, a lane along its side, a back court where a man keeps a fire in a drum, and the town standing close round it — shuttered fronts and stalls on the
// street, the neighbours' upper windows over the back wall. Snow lies on all of it (the level's own weather: src/game/weatherKinds.ts SNOW_LEVELS).
//
//      x 0      8      12.5      16.5    20        25.5        30.5 32        40
//   z 2 ┌───────┬──────────── the neighbours' backs, a lit window ────────────┬────────┐
//       │ shops ├────────┬───────────────────────────────────────────┬─┤ a       │
//       │ shut  │        │ strong- │ clerk's  │   hall   │   store    │ │ neigh-  │   the shop, west to east:
//       │       │ fore-  │  room  pad  table  │   beam   │  (the old  │ │ bour's  │     strongroom     a door on a keypad (the code is in a man's head), the safe
//       │ stalls  court  ├────────┘           │    ╎   man   mud wing) │ │ house   │     counting room  a counter the length of it, the one way round at its far end
//       │  the   gate (lamp) front ══ counter ════╡    ╎   (open)      │ │ and     │     hall           where the men live; a beam at the chest; the mains box
//       │ street│        │   clients' side  (open) box    │   back    │ │ yard    │     store          dark; its back door is on a cylinder (it picks)
//  16.5 │ (ruts)│        └────────────────────┴──────────┴──╧─────────┴─┤         │
//       │       │  the lane: a trodden path along the wall  ·  ╎ the walk │         │   the lane        fresh snow, one trodden path along the shop's wall
//       │ stall │                       ════ the long wall ════╗  court  │         │   the long wall   head high; the only way between lane and court is the walk
//       │       │      firewood, a cart        (the hide)    ╎ (fire, lamp)        │   the court       swept to the slab, a fire in a drum, a lamp
//  z 22 │       └────────────────────────────────────────────────────────┴─────────┤
//       │           stalls against the wall · the alley behind (ruts, a lantern)    │
//  z 28 └────────────────────────────────────────────────────────────────────────────┘
//
// THE LINE (scenarios.lesson; tools/qa/lessons/tut-quiet.ts plays it by input alone):
//   the lane        light: out of the porch lamp, round the shop's corner, along the trodden path to the mark.
//   the long wall   sound, then hands: a whistle at the mark and the player steps behind the long wall. The back court's man leaves his fire and comes the
//                   long way round, along the walk on the wall's other side, to where the sound was, and stands looking at it with his back to the wall's
//                   end. Round the end, a grab from the dark; he is asked, and gives the strongroom's code; then the choice: out cold, or the knife.
//   the back door   a lock picked in the long wall's shadow, the court's lamp and fire a wall away and nobody left to watch.
//   the store       the dark corner beside a lit doorway: the hall's man stands a stride inside it with his back turned. On a knee, out of the dark into
//                   the light behind him: the knife. A walking step he would hear; a crouched one he does not.
//   the hall        a beam at the chest (under it on a knee), a beam at the shins across the counting room's doorway (nothing goes under that): the mains.
//   the set piece   night vision, the box: every lamp and the shin beam die. The clerk is the nearest man to the box and has the longest walk to it,
//                   round the counter's far end: ten seconds of him coming, in green, his light ahead of him. The player is in the niche by the doorway,
//                   behind its stub of wall; the man comes through, walks past it to the box and works there with his back to it (this level's box
//                   takes seven seconds, breaker.fumble). Taken there, the shop is the player's: the first man's code opens the strongroom, the safe, out by the front door.
//
// THE TWO HALVES. Everything up to the back door is hands and senses, out of doors (light, a sound, a grab, a question, a lock); everything past it is the
// shop's own tools, indoors (a beam, the mains, night vision, a code, a safe). The level is cut on that line too: the cross wall and the back door.
//
// WHY EACH TIMED BEAT IS BUILT AS IT IS: a line is read before it is obeyed. A beat with a clock (a man coming) has its whole instruction in the line that
// is up BEFORE the clock starts ('whistle here, then hide'; 'the box, then behind the wall'), and the man's walk is long enough for the next line to be read
// while he is on his way: the long wall in the lane, the long counter in the shop. Nothing asks for a reaction inside two seconds.
//
// THREE MEN, each with one beat. A fourth (inside the front door) was taken out: seven metres from the box through an open doorway he heard the clerk go
// down and turned his light on the player, and nothing in the room could hide that.
//
// SNOW AND LIGHT. The moon is thin and stands low behind the shop from where the camera looks (the number is the pass's, the snow level tuned on a GPU: snow
// is the brightest ground there is). What lights the night is what burns: the porch lamp and the court's lamp (the mains), the fire in the court's drum and
// two lanterns left on stall counters (their own fuel: they stay when the mains go). Every wall between a flame and the player's line is higher than the
// flame: the fire and the lanterns light the falling snow and the walls' far sides, never the lane, the walk or the back door (worked out in the file, where
// each is placed). UNDERFOOT: fresh snow is the soft quiet floor ('grass'); the street, the alley, the trodden paths and the swept court are hard ('asphalt');
// the rooms are 'stone', as they were. The mission's whole walking line lies on path, court and floor.
//
// WHAT IS KEPT FROM THE FIRST BUILD, to the centimetre: the shop's walls and doors, the low walls, both lamps, the beams, the box, the pad, the safe and
// every mark the lesson and its scripted player name (TQ). What is new is the place they stand in.
import type { Vec3 } from '../../src/math/vec';
import type { LessonData, LevelScenarios, QuietData, Rect } from '../../src/scene/scenarios';
import type { DeviceDef, Level, LevelDoorDef } from '../../src/scene/level';
import type { SurfacesData } from '../../src/scene/levelData';
import { BoxFlag } from '../../src/scene/boxes';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_MATERIALS, GW_SHELL, type GwotMat, type WallKind } from '../../src/scene/gwotKit';
import { SNOW_PALETTE, SNOW_FINISH, SNOW_MATERIALS, type SnowMat } from '../../src/scene/gwotPalette';
import { WORLD } from '../../src/scene/world';

export const NAME = 'tut-quiet';
export const NOTES = 'The tutorial\'s quiet mission, the ledger: a money changer\'s shop off a bazaar street on a snowing night, alone. One line: out of the porch lamp and along the trodden path in the lane, a man whistled from his fire round a wall the player stands behind and taken from behind for the strongroom\'s code, a picked back door, a knife from the dark into a lit room, a beam passed on a knee, then the mains: the clerk comes round his counter to the box in the dark and is taken at it, and the code opens the strongroom. Generated by tools/levels/tut-quiet.ts.';
export const MATERIALS = { ...GWOT_MATERIALS, ...SNOW_MATERIALS };

const HALF = Math.PI / 2;
type P3 = [number, number, number];
/** the places the scripted player and the lesson name (tools/qa/lessons/tut-quiet.ts imports these, so a moved wall moves the script) */
/** well down the lane, past the first dark: being here passes the step `dark` whatever the light meter reads */
const DEEP: [number, number, number] = [17.6, 0, 17.7];
export const TQ = {
  start: [9.3, 0, 14.0] as P3,
  dark: [15.2, 0, 17.6] as P3,            // the first dark: round the shop's corner and three strides down the lane, on the path (at the corner itself the snow still
                                          // throws the porch lamp back: the page's meter read 0.41 there against the step's line of 0.45)
  whistle: [21.5, 0, 17.8] as P3,         // where the whistle is blown: on the path, ON THE LINE the court's man walks in by (see `his`)
  his: [22.0, 0, 17.8] as P3,             // where the man who comes to the whistle ends his walk, his back to the long wall's end. He looks at where the sound
                                          // was: with the mark on his own line that is straight ahead, down the lane (0.3 m to one side of his line, as it
                                          // first stood, it was beside him when he stopped: he stood with his light on the shop's wall a step away)
  hide: [23.9, 0, 19.05] as P3,           // behind the long wall, on the lane's side of it: the man who comes stops on the other side of the cross wall
  // THE MAN WHO COMES TO THE WHISTLE DOES NOT WALK TO IT (the level's script stages him: levels/tut-quiet.script.ts). He stops in the back strip a stride
  // short of the cross wall's gap and puts his light through it, down the walk and over the place the sound came from, five metres off: far enough that
  // the prints in the snow there are nothing he could read. Then he turns round, walks back up the strip past the back door to his chair at its far end
  // and has a smoke there, his back to the way he came: against the neighbour's wall beyond him, which the court's lamp lights through the long wall's
  // end, he is a dark shape at the end of a dark strip.
  look: [26.4, 0, 17.75] as P3,           // where he looks from: in line with the gap and the whistle's mark, so his beam goes through the one and over the other
  smoke: [30.3, 0, 17.7] as P3,           // where he smokes, his back to the gap: by his chair, the tin for the ends at its foot. (Two and a half metres past
                                          // the back door's lock: a man put down nearer lies in reach of a hand at the lock, and a body's row comes before a door's)
  backDoor: [27.9, 0, 17.2] as P3,        // the court side of the back door
  nook: [26.1, 0, 14.15] as P3,           // the store's dark corner beside the lit doorway to the hall
  under: [23.2, 0, 12.4] as P3,            // past the chest beam
  box: [22.1, 1.35, 16.2] as P3,          // the mains box: on the hall's own wall, two strides inside the counting room's doorway
  boxAt: [21.65, 0, 15.3] as P3,           // where a hand reaches it from
  wait: [20.45, 0, 13.85] as P3,         // in the niche by the doorway: the man sent to the box walks PAST its wall and stops with his back to its end
  pad: [16.635, 1.3, 11.3] as P3,
  safeFront: [14.5, 1.0, 9.48] as P3,
  beamHigh: 23.6,
};
/** the yard inside the street wall and the back walls */
const YARD: Rect = { x0: 8, x1: 32, z0: 6, z1: 22 };
/** the one way in and out: the gate in the street wall */
const EXIT_W = { name: 'the street gate', door: 'gate_w', x: 7.2, z: 14.0, out: [-1, 0] as [number, number] };

const PLACES = { areas: [
  { name: 'strongroom', bounds: { x0: 12.62, x1: 16.38, z0: 8.62, z1: 12.08 } }, { name: 'counting room', bounds: { x0: 12.62, x1: 19.88, z0: 8.62, z1: 16.38 } },
  { name: 'hall', bounds: { x0: 20.12, x1: 25.38, z0: 8.62, z1: 16.38 } }, { name: 'store', bounds: { x0: 25.62, x1: 30.38, z0: 8.62, z1: 16.38 } },
  { name: 'back court', bounds: { x0: 25.62, x1: 31.88, z0: 16.62, z1: 21.88 } }, { name: 'lane', bounds: { x0: 12.5, x1: 25.38, z0: 16.62, z1: 21.88 } },
  { name: 'forecourt', bounds: { x0: 8.12, x1: 12.5, z0: 6.12, z1: 21.88 } }, { name: 'street', bounds: { x0: 0, x1: 8.12, z0: 0, z1: 28 } },
] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), M = G.M, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const DECAL = BoxFlag.NoShadow;
  type Mat = { albedo: Vec3; rough: number };
  const S = Object.fromEntries((Object.keys(SNOW_PALETTE) as SnowMat[]).map(n => [n, { albedo: SNOW_PALETTE[n], rough: SNOW_FINISH[n].rough }])) as Record<SnowMat, Mat>;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];

  // ================================================================ SNOW: the pieces (as the pass's: tools/levels/pass.ts) ====
  /** a thin solid ground finish in any paint */
  const lay = (x0: number, z0: number, x1: number, z1: number, m: Mat, y = 0.004) => add({ c: [(x0 + x1) / 2, y / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, y / 2, Math.abs(z1 - z0) / 2], ...m });
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
      for (const s of [-track / 2, track / 2]) b(0, s, 0.009, 0.015, L / 2, 0.17, S.snowOld, { flags: DECAL });
    }
  };
  /** a DRIFT (walk-over: nothing of it over 0.19 m): snow blown against the foot of something. (x, z) = its middle, `len` along the thing, `depth` out from
   *  it; `yaw` turns local +Z to point AWAY from the thing (0 = toward +z, π/2 = +x, π = −z, −π/2 = −x). Two steps: a lip, and a crest against the thing. */
  const drift = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.17) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, top * 0.5, len / 2, depth / 2, S.snow); b(len * 0.03, -depth * 0.22, 0, top, len * 0.41, depth * 0.28, S.snow);
  };
  /** a BANK (stops feet: its crest stands over 0.26 m): shovelled snow, or the deep snow of a corner. Same frame as drift(); three steps down from `top` */
  const bank = (x: number, z: number, len: number, depth: number, yaw = 0, top = 0.42) => {
    const b = G.piece(x, z, yaw);
    b(0, 0, 0, 0.16, len / 2, depth / 2, S.snow); b(-len * 0.02, -depth * 0.15, 0, top * 0.62, len * 0.47, depth * 0.35, S.snow); b(len * 0.03, -depth * 0.31, 0, top, len * 0.42, depth * 0.19, S.snow);
  };
  /** DECAL: a CAP of snow on top of a thing whose top is at `y`: w × d, `t` thick (set in from the thing's edges by the caller, so its own colour shows as a rim).
   *  A cap is picture only: no eye, ear, round or boot meets it — a capped wall is as high as it was */
  const cap = (x: number, z: number, w: number, d: number, y: number, yaw = 0, t = 0.05) => G.piece(x, z, yaw)(0, 0, y, y + t, w / 2, d / 2, S.snow, { flags: DECAL });
  /** a cap on a part of a piece standing at (px, pz, pyaw): (lx, lz) in the piece's own frame */
  const capOn = (px: number, pz: number, pyaw: number, lx: number, lz: number, w: number, d: number, y: number, t = 0.05) => G.piece(px, pz, pyaw)(lx, lz, y, y + t, w / 2, d / 2, S.snow, { flags: DECAL });
  /** caps along a wall's coping (its top at `y`: 2.47 on a yard wall, 1.87 on the low ones), in lengths with wind-scoured gaps between them */
  const copingCaps = (axis: 'x' | 'z', line: number, a: number, b: number, y = 2.47) => {
    const lens = [2.3, 1.6, 2.9, 1.2, 2.0, 2.6]; let u = a + 0.06, k = Math.round(a * 7 + line) % lens.length;
    while (u < b - 0.4) { const l = Math.min(lens[k++ % lens.length], b - 0.06 - u), m = u + l / 2; if (axis === 'x') cap(m, line, l, 0.2, y, 0, 0.05 + (k % 3) * 0.012); else cap(line, m, 0.2, l, y, 0, 0.05 + (k % 3) * 0.012); u += l + 0.14 + (k % 2) * 0.1; }
  };
  /** a small thing standing ON something: w × d × h, its foot at height y, centred on (x, z) */
  const thing = (x: number, z: number, y: number, w: number, d: number, h: number, m: Mat, yaw = 0, extra: { flags?: number; emissive?: Vec3 } = {}) => G.piece(x, z, yaw)(0, 0, y, y + h, w / 2, d / 2, m, extra);

  // ================================================================ THE GROUND ====
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, S.snow.albedo, { rough: S.snow.rough });
  lay(0, 0, 7.3, 28, S.snowPacked);                                                            // the street: driven and walked all day
  lay(7.3, 24.9, 40, 27.5, S.snowPacked);                                                      // the alley behind the back wall
  zones.push({ id: 'street', mat: 'asphalt', x0: 0, z0: 0, x1: 7.3, z1: 28 }, { id: 'alley', mat: 'asphalt', x0: 7.3, z0: 24.9, x1: 40, z1: 27.5 });
  ruts([[3.3, 0.3], [3.1, 13.0], [3.25, 27.7]]); ruts([[5.4, 26.2], [20, 26.3], [39.7, 26.1]], 1.7);
  // the court is swept to its slab every morning (a ring of grey slush where the broom stops)
  lay(25.62, 16.62, 31.88, 21.88, S.snowOld, 0.004); G.ground(25.95, 16.62, 31.6, 21.55, 'slab', 0.006);
  zones.push({ id: 'court', mat: 'asphalt', x0: 25.5, z0: 16.5, x1: 32, z1: 22 });
  // the shop's floors: a poured slab under the shop, beaten earth in the old wing
  grp('house.floor');
  G.ground(12.5, 8.5, 25.5, 16.5, 'slab', 0.006); G.ground(25.5, 8.5, 30.5, 16.5, 'mudFloor', 0.006);

  // ================================================================ THE YARD'S WALLS, THE GATE ====
  grp('walls.yard');
  const gap = [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }];
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gap);                                          // the street wall, the gate in it
  G.yardWallZ(YARD.x1, YARD.z0, YARD.z1, 'mud');                                               // the neighbour's wall: no gate
  G.yardWallX(YARD.z0, 7.88, 32.12, 'mud');                                                    // the back wall the neighbours built against
  G.yardWallX(YARD.z1, 7.88, 14.0, 'mud'); G.yardWallX(YARD.z1, 14.0, 21.0, 'block'); G.yardWallX(YARD.z1, 21.0, 32.12, 'mud');   // the alley wall: mended in block
  for (const [x, z] of [[8, 6], [8, 22], [32, 6], [32, 22], [20, 6], [14, 22], [21, 22]] as const) { G.pier(x, z); cap(x, z, 0.42, 0.42, 2.52); }
  doors.push({ name: 'gate_w', hinge: [8.0, 13.42], closedDir: HALF, width: 1.16, exterior: true });
  copingCaps('z', 8, 6.3, 21.7); copingCaps('z', 32, 6.3, 21.7); copingCaps('x', 6, 8.3, 19.7); copingCaps('x', 6, 20.3, 31.7);
  copingCaps('x', 22, 8.3, 13.7); copingCaps('x', 22, 14.3, 20.7); copingCaps('x', 22, 21.3, 31.7);

  // ================================================================ THE LIGHTS ====
  grp('lights');
  // the moon: thin, low, behind the shop from where the camera looks — light falls from the north, shadows lie toward the camera
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.28, -0.3, 0.73]), color: [0.5, 0.68, 1.0], intensity: 0.06, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
  /** embers: a small warm light with a glowing box for its fixture (a shot puts it out), its own fuel */
  const glow = (name: string, group: string, box: { c: Vec3; h: Vec3 }, pos: Vec3, intensity: number, range: number) => {
    const fb = add({ ...box, ...M.rust, emissive: [11, 3.8, 0.9], flags: DECAL });
    lights.push({ kind: 'point', pos, dir: [0, -1, 0], color: [1.0, 0.5, 0.2], intensity, range, innerDeg: 0, outerDeg: 180, name, group, enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.06, mains: false });
  };
  const LAMP_ARM = 0.6;
  /** A yard LAMP: a pole with a shaded head throwing a POOL straight down (about 7 m across the ground) and little past it — a thing to walk round. A fixture
   *  like any other: a round puts it out; `mains` = the breaker takes it too. The pole stands LAMP_ARM north of the head, which hangs off an arm: the light
   *  is under the head with nothing solid round it, and the pole's thin shadow falls away from the pool's middle. Snow lies on the head */
  const lamp = (x: number, z: number, name: string, mains: boolean) => {
    const h = 3.4;
    add({ c: [x, (h + 0.11) / 2, z - LAMP_ARM], h: [0.04, (h + 0.11) / 2, 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.085, z - LAMP_ARM / 2], h: [0.025, 0.025, LAMP_ARM / 2 - 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...GWOT_MATERIALS.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...GWOT_MATERIALS.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.86, 0.6], intensity: 90, range: 9, innerDeg: 30, outerDeg: 52, name, group: 'exterior', enabled: true, volumetric: 0.2, fixtureBox: fb, radius: 0.1, mains });
    cap(x, z, 0.34, 0.34, h + 0.11, 0, 0.04);
  };
  // the mains breaker and one emergency beacon (the game's blackout wants both)
  let breaker: Level['breaker'] | null = null;
  /** the breaker on a wall: the panel's centre 4 cm proud of the face, `out` = the way it faces (the side a man stands); `fumble` = seconds a man sent to it
   *  works at it before the mains come back */
  const breakerAt = (x: number, z: number, out: 'n' | 's', fumble: number) => {
    grp('breaker');
    const s = out === 's' ? 1 : -1;
    const brk = add({ c: [x, 1.35, z], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
    const led = add({ c: [x - 0.18, 1.62, z + s * 0.05], h: [0.015, 0.015, 0.015], ...GWOT_MATERIALS.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
    breaker = { pos: [x, 1.35, z + s * 0.14], boxes: [brk, led], fumble };
  };
  grp('beacons');
  add({ c: [20.3, 2.28, 6.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [20.3, 2.16, 6.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ================================================================ THE SHOP: strongroom and counting room (west), the hall, the store (east) ====
  // The shop proper is rendered and painted; the store is the old mud-brick wing it grew out of. One roof over both (the camera looks through it; the snow
  // stops at it). The doors: the front door is steel, on the latch against the forecourt (no pick, no boot: the short way in is not a way) and free from
  // the counting room (the way out); the back door, in the back court, is on a cylinder (it picks)
  const t = GW_SHELL / 2;
  grp('house.roof'); slab(12.4, H, 8.4, 30.6, H + 0.2, 16.6, GWOT_MATERIALS.render.albedo, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  grp('house.walls');
  G.wallX(8.5, 12.5 - t, 25.5, 'render'); G.wallX(8.5, 25.5, 30.5 + t, 'mud');
  G.wallX(16.5, 12.5 - t, 25.5, 'render'); G.wallX(16.5, 25.5, 30.5 + t, 'mud', [{ a: 27.3, b: 28.5 }]);
  G.wallZ(12.5, 8.5 + t, 16.5 - t, 'render', [{ a: 14.5, b: 15.7 }]); G.wallZ(30.5, 8.5 + t, 16.5 - t, 'mud');
  doors.push({ name: 'front', hinge: [12.5, 14.52], closedDir: HALF, width: 1.16, locked: true, keySide: 1, steel: true });
  doors.push({ name: 'back', hinge: [27.32, 16.5], closedDir: 0, width: 1.16, locked: true });
  zones.unshift({ id: 'house', mat: 'stone', x0: 12.5, z0: 8.5, x1: 30.5, z1: 16.5 });
  const HOUSE: Rect = { x0: 12.5 + t, x1: 30.5 - t, z0: 8.5 + t, z1: 16.5 - t };
  grp('house.inner');
  G.wallZ(20, 8.62, 16.38, 'render', [{ a: 14.6, b: 15.8 }]);                      // the counting room's doorway: no leaf, a beam across it at the shins
  G.wallZ(25.5, 8.62, 16.38, 'render', [{ a: 12.0, b: 13.2 }]);                      // the store's doorway: no leaf
  G.wallX(12.2, 12.62, 16.62, 'render'); G.wallZ(16.5, 8.62, 12.08, 'render', [{ a: 9.7, b: 10.9 }]);
  doors.push({ name: 'strong', hinge: [16.5, 9.72], closedDir: HALF, width: 1.16, locked: true, lock: 'pad_strong', keySide: -1 });
  const STRONG: Rect = { x0: HOUSE.x0, x1: 16.38, z0: HOUSE.z0, z1: 12.08 };
  // what the street sees of it: a dark course at the foot of the render, the shop's board on the lane corner — green, a cream band, three brass coins
  grp('house.face');
  G.skirt('x', 16.5, 12.4, 25.45, 1, 'mudDark');
  add({ c: [14.1, 2.22, 16.628], h: [0.95, 0.3, 0.004], ...M.paintGreen, flags: DECAL }); add({ c: [14.1, 2.22, 16.634], h: [0.86, 0.045, 0.002], ...M.paintCream, flags: DECAL });
  for (const dx of [-0.5, 0, 0.5]) add({ c: [14.1 + dx, 2.39, 16.634], h: [0.07, 0.07, 0.002], ...M.prodYellow, flags: DECAL });

  // ---- the strongroom: the safe, the day's takings waiting to go in it ----
  grp('house.strong');
  G.bulb(14.5, 10.6, 'bulb_strong', 'strong', false);
  G.dado('x', 8.5, 12.64, 16.36, 1, 'paintRust');
  // the safe, against the far wall: an iron box on a plinth, a door plate and a wheel on its face
  add({ c: [14.5, 0.06, 9.02], h: [0.5, 0.06, 0.38], ...GWOT_MATERIALS.block });
  add({ c: [14.5, 0.67, 9.02], h: [0.44, 0.55, 0.34], ...GWOT_MATERIALS.iron });
  add({ c: [14.5, 0.67, 9.37], h: [0.36, 0.46, 0.012], ...GWOT_MATERIALS.galv, flags: BoxFlag.NoShadow });
  add({ c: [14.66, 0.72, 9.395], h: [0.07, 0.07, 0.014], ...GWOT_MATERIALS.iron, flags: BoxFlag.NoShadow });
  { const led = add({ c: [14.26, 1.04, 9.388], h: [0.03, 0.012, 0.006], ...GWOT_MATERIALS.iron, emissive: [3, 0.4, 0.2], flags: BoxFlag.NoShadow });
    switchables.push({ name: 'rack0_leds', boxes: [led], group: 'objective', on: true, baseEmissive: [3, 0.4, 0.2], mains: false }); }
  G.trunk(13.2, 11.3, HALF, 'paintBlue'); G.sacks(15.8, 11.5, 0.2, 3); G.crates(13.1, 9.1, 0, 2, 'olive');
  G.rug(14.5, 10.55, 1.5, 1.0, 'baluch');
  // a steel shelf of cash tins on the street-side wall; bundles counted out on the trunk; two tied money bags beside the safe
  add({ c: [12.84, 0.6, 10.2], h: [0.2, 0.6, 0.48], ...M.galv });
  thing(12.84, 9.92, 1.2, 0.24, 0.2, 0.15, M.paintGreen); thing(12.84, 10.2, 1.2, 0.22, 0.18, 0.12, M.tin, 0.2); thing(12.84, 10.47, 1.2, 0.26, 0.2, 0.16, M.paintRust, -0.1);
  thing(13.18, 11.12, 0.4, 0.09, 0.17, 0.05, M.paintCream, 0.15); thing(13.24, 11.34, 0.4, 0.09, 0.17, 0.05, M.prodGreen, -0.1); thing(13.17, 11.52, 0.4, 0.09, 0.17, 0.08, M.paintCream, 0.3);
  thing(15.5, 8.98, 0, 0.32, 0.3, 0.36, M.canvas, 0.2); thing(15.5, 8.98, 0.36, 0.1, 0.1, 0.06, M.sack, 0.2); thing(15.85, 9.12, 0, 0.28, 0.26, 0.3, M.sack, -0.3);

  // ---- the counting room: the clients' side, the counter, the clerk's side ----
  grp('house.count');
  G.bulb(16.6, 14.2, 'bulb_count', 'count', true);
  G.dado('z', 12.5, 12.34, 14.76, 1, 'paintBlue'); G.dado('z', 12.5, 15.74, 16.36, 1, 'paintBlue'); G.dado('x', 8.5, 16.64, 19.86, 1, 'paintBlue');
  G.table(18.4, 9.3, 1.6, 0.7); G.plasticChair(18.4, 10.05, Math.PI);                 // the counting table, in the lobby before the strongroom
  G.rug(16.6, 15.0, 2.6, 1.4, 'afghan'); G.toshak(17.6, 15.95, 1.9, 0); G.lowTable(16.2, 15.9, 0);   // where clients sit and wait
  // THE COUNTER: the length of the room, the clerk's side and the clients' side, the one way round it at its far end by the front door. So the clerk,
  // the nearest man to the mains box by the straight line, has the longest walk to it: time to be read coming, in the dark, round the counter's end
  add({ c: [16.89, 0.5, 13.8], h: [2.99, 0.5, 0.26], ...GWOT_MATERIALS.poplar });
  add({ c: [16.89, 1.03, 13.8], h: [3.03, 0.03, 0.31], ...GWOT_MATERIALS.poplar });
  add({ c: [16.89, 0.52, 14.064], h: [2.9, 0.4, 0.003], ...M.paintBlue, flags: DECAL }); add({ c: [16.89, 0.86, 14.068], h: [2.9, 0.03, 0.002], ...M.paintCream, flags: DECAL });   // its painted front
  G.crates(19.3, 11.5, 0.05, 2, 'ply');
  // on the counter (its top at 1.06): the scales, the notes he was counting, the day book, the cash box, a glass of tea gone cold
  { const y = 1.06;
    thing(15.3, 13.8, y, 0.16, 0.1, 0.02, M.iron); thing(15.3, 13.8, y + 0.02, 0.024, 0.024, 0.27, M.iron); thing(15.3, 13.8, y + 0.275, 0.36, 0.02, 0.015, M.iron);
    thing(15.15, 13.8, y + 0.09, 0.12, 0.12, 0.012, M.prodYellow); thing(15.45, 13.8, y + 0.07, 0.12, 0.12, 0.012, M.prodYellow); thing(15.45, 13.8, y + 0.082, 0.05, 0.05, 0.03, M.iron);
    thing(16.1, 13.7, y, 0.17, 0.08, 0.05, M.paintCream, 0.1); thing(16.3, 13.86, y, 0.17, 0.08, 0.07, M.prodGreen, -0.2); thing(16.08, 13.92, y, 0.17, 0.08, 0.04, M.paintCream, 0.5); thing(16.52, 13.72, y, 0.17, 0.08, 0.03, M.prodRed, 0.05);
    thing(17.5, 13.8, y, 0.4, 0.28, 0.025, M.paintRust, 0.08); thing(17.5, 13.8, y + 0.025, 0.36, 0.24, 0.006, M.whitewash, 0.08, { flags: DECAL });
    thing(18.7, 13.74, y, 0.3, 0.2, 0.12, M.paintGreen, -0.05); thing(18.7, 13.74, y + 0.12, 0.1, 0.03, 0.015, M.tin, -0.05);
    thing(18.15, 13.92, y, 0.11, 0.15, 0.02, M.plasticBlack, 0.2); thing(14.45, 13.9, y, 0.05, 0.05, 0.07, M.whitewash); }
  // the rate board on the strongroom's wall, facing the clients: a blackboard, a coloured square for each money, its two prices chalked beside it
  { const z = 12.326; add({ c: [14.6, 1.66, z], h: [0.76, 0.44, 0.004], ...M.plasticBlack, flags: DECAL }); add({ c: [14.6, 2.115, z], h: [0.8, 0.02, 0.006], ...M.poplar, flags: DECAL }); add({ c: [14.6, 1.205, z], h: [0.8, 0.02, 0.006], ...M.poplar, flags: DECAL });
    const flags: GwotMat[] = ['prodGreen', 'prodRed', 'paintBlue', 'prodYellow', 'paintCream'];
    flags.forEach((f, k) => { const y = 1.98 - k * 0.16;
      add({ c: [14.02, y, z + 0.006], h: [0.07, 0.045, 0.002], ...M[f], flags: DECAL });
      add({ c: [14.5 - (k % 2) * 0.04, y, z + 0.006], h: [0.16 + (k % 3) * 0.02, 0.014, 0.002], ...M.whitewash, flags: DECAL }); add({ c: [15.02 + (k % 2) * 0.03, y, z + 0.006], h: [0.15 - (k % 2) * 0.03, 0.014, 0.002], ...M.whitewash, flags: DECAL }); });
    // a clock and a calendar beside it
    add({ c: [15.78, 1.95, z], h: [0.13, 0.13, 0.006], ...M.plasticWhite, flags: DECAL }); add({ c: [15.78, 1.98, z + 0.007], h: [0.008, 0.05, 0.002], ...M.plasticBlack, flags: DECAL }); add({ c: [15.81, 1.95, z + 0.007], h: [0.04, 0.008, 0.002], ...M.plasticBlack, flags: DECAL });
    add({ c: [15.78, 1.5, z], h: [0.15, 0.21, 0.004], ...M.whitewash, flags: DECAL }); add({ c: [15.78, 1.66, z + 0.005], h: [0.15, 0.05, 0.002], ...M.prodRed, flags: DECAL }); }
  // the clients' winter corner: a stove with its flue to the roof, a kettle on it, split wood beside it
  G.stove(14.2, 16.0); thing(14.14, 16.0, 0.64, 0.15, 0.15, 0.13, M.tin, 0.4);
  thing(14.86, 16.14, 0, 0.5, 0.22, 0.14, M.woodGrey, 0.06); thing(14.84, 16.12, 0.14, 0.46, 0.2, 0.14, M.woodGrey, -0.1);
  // the clerk's table: two ledgers, the tray of counted bundles, his stamp, his glass; a case of the years' ledgers on the wall behind his chair
  { const y = 0.79;
    thing(17.9, 9.22, y, 0.34, 0.25, 0.05, M.paintRust, 0.1); thing(17.92, 9.24, y + 0.05, 0.32, 0.24, 0.045, M.rugNavy, -0.12);
    thing(18.55, 9.3, y, 0.4, 0.28, 0.02, M.tin); thing(18.45, 9.26, y + 0.02, 0.16, 0.08, 0.05, M.paintCream); thing(18.64, 9.26, y + 0.02, 0.16, 0.08, 0.05, M.prodGreen); thing(18.54, 9.37, y + 0.02, 0.16, 0.08, 0.035, M.paintCream);
    thing(19.0, 9.42, y, 0.06, 0.06, 0.09, M.poplar); thing(18.98, 9.12, y, 0.05, 0.05, 0.07, M.whitewash); }
  add({ c: [19.7, 0.75, 9.9], h: [0.17, 0.75, 0.72], ...M.poplar });
  thing(19.7, 9.45, 1.5, 0.26, 0.34, 0.06, M.paintRust, 0.1); thing(19.7, 9.47, 1.56, 0.25, 0.33, 0.05, M.paintGreen, -0.1); thing(19.7, 9.95, 1.5, 0.24, 0.3, 0.26, M.sack); thing(19.7, 10.38, 1.5, 0.26, 0.34, 0.05, M.rugNavy, 0.25);
  for (let k = 0; k < 3; k++) add({ c: [19.526, 0.36 + k * 0.46, 9.9], h: [0.003, 0.17, 0.66], ...M[(['paintRust', 'rugNavy', 'paintGreen'] as GwotMat[])[k]], flags: DECAL });

  // ---- the hall: where the men live ----
  grp('house.hall');
  G.bulb(23.4, 12.6, 'bulb_hall', 'hall', true);
  G.dado('x', 8.5, 20.14, 25.36, 1, 'paintGreen');
  // THE MAINS BOX: on the hall's own wall, a stride inside the counting room's doorway. The man sent to it comes through that doorway and stands at it
  // with his back to the room. (The game's fixed spot for the man sent to a panel lies toward −x and −z of it:
  // a box that faces −z with floor before it is stood at alike on both stands)
  breakerAt(TQ.box[0], 16.34, 'n', 7); grp('house.hall');   // (seven seconds at it: an old box, his back to the room and his light on the panel)
  // TWO WALLS THE PAGE ASKED FOR. On the page the man who comes to the box carries a light, and a light finds what the dark hid: the hall's man where he
  // fell (the mission teaches no carrying), and anyone flat to a wall in the open (inside 3.5 m a man sees a shape at his elbow). So what hides here is
  // a WALL, as in the lane.  THE SCREEN cuts the hall in two: the lobby with the box, and the back with the beam, the hall's man and his body; from the
  // doorway and from the box nothing of the back can be seen.  THE NICHE is a stub by the doorway: the player waits behind it, the man walks past its
  // end to the box and stops there facing the way he walked, and the player steps out at his back
  G.partZ(22.7, 12.0, 16.38, 'render');
  G.partX(14.4, 20.12, 20.8, 'render');
  G.rug(23.4, 14.2, 2.4, 1.4, 'mat'); G.crates(24.8, 9.2, 0.1, 2, 'olive'); G.plasticChair(24.9, 15.6, -HALF); G.sacks(21.2, 9.3, 0.1, 3); G.trunk(22.6, 9.2, 0, 'paintGreen');
  // a rope bed along the store's wall, its quilt folded and a pillow at the head; tea on a low table beside it; a radio on the trunk, its lamp green in the
  // dark (its own battery: it is the one thing lit in the hall when the mains go); a rug hung on the wall; the corner they cook in
  G.charpoy(24.85, 10.6, HALF, 'rugRed'); thing(24.85, 9.95, 0.44, 0.5, 0.3, 0.08, M.rugCream); G.lowTable(24.02, 10.4, HALF);
  thing(22.62, 9.2, 0.4, 0.32, 0.13, 0.19, M.plasticBlack); thing(22.74, 9.2, 0.59, 0.012, 0.012, 0.32, M.galv); add({ c: [22.52, 0.52, 9.267], h: [0.07, 0.04, 0.002], ...M.tin, flags: DECAL });
  add({ c: [22.71, 0.53, 9.268], h: [0.012, 0.012, 0.003], ...M.plasticBlack, emissive: [0.3, 3.5, 0.5], flags: DECAL });
  G.wallHanging('x', 8.5, 21.85, 1, 'kilim', 1.3, 0.8);
  add({ c: [20.42, 0.4, 10.5], h: [0.28, 0.4, 0.5], ...M.ply });
  thing(20.42, 10.2, 0.8, 0.22, 0.22, 0.15, M.iron, 0.3); thing(20.42, 10.52, 0.8, 0.16, 0.16, 0.14, M.tin, 0.5); thing(20.4, 10.82, 0.8, 0.2, 0.2, 0.05, M.whitewash);
  G.gasBottle(20.45, 11.45);

  // ---- the store: the old wing, dark ----
  grp('house.store');
  G.bulb(28.0, 12.4, 'bulb_store', 'store', false);
  G.sacks(29.6, 9.4, 0, 3); G.sacks(28.2, 9.3, 0.1, 3); G.crates(29.7, 11.6, HALF, 3, 'ply'); G.crates(26.4, 9.3, 0.05, 2, 'olive');
  G.drums(29.35, 14.4, 2); G.jerryCan(29.9, 15.8, 0.3); G.trunk(26.3, 15.85, 0, 'paintGreen');
  // rolled carpets taken against a debt, along the far wall; tins of ghee by the sacks
  thing(30.2, 13.05, 0, 0.28, 1.4, 0.28, M.rugRed); thing(29.9, 13.08, 0, 0.28, 1.34, 0.28, M.rugNavy, 0.03); thing(30.06, 13.02, 0.28, 0.26, 1.28, 0.25, M.rugOchre, -0.02);
  thing(27.2, 9.2, 0, 0.26, 0.26, 0.32, M.prodYellow, 0.1); thing(27.5, 9.24, 0, 0.26, 0.26, 0.32, M.prodYellow, -0.15); thing(27.34, 9.22, 0.32, 0.26, 0.26, 0.32, M.prodYellow, 0.4);

  // ================================================================ THE LANE AND THE BACK COURT: the cross wall with its gap, the long wall along the shop ====
  grp('walls.lane');
  // (these stand LOW, a head high, piers and coping and all under 2 m: a man cannot see over them, and a whistle carries over the top — collision.ts propagate)
  const LOW = 1.8;
  G.yardWallZ(25.5, 16.62, 21.88, 'mud', [{ a: 17.3, b: 18.2, y0: 0, y1: LOW }], LOW);
  // THE LONG WALL: a head-high wall a stride and a half off the shop and along it, from the lane through the cross wall into the back court. The way
  // between the lane and the court is the walk between it and the shop (the cross wall's gap is in that walk). The man in the court hears a whistle
  // over the walls and has to come the long way: round the wall's far end, along the shop, through the gap. The player is by then on the lane's side
  // of the wall, and comes round its near end at his back
  G.yardWallX(18.6, 23.2, 25.38, 'mud', [], LOW); G.pier(23.2, 18.6, LOW - 0.1);
  G.yardWallX(18.6, 25.62, 30.4, 'mud', [], LOW); G.pier(30.4, 18.6, LOW - 0.1);
  G.yardWallZ(12.5, 6.12, 8.38); G.yardWallX(16.5, 30.62, 31.88);                     // the strips behind the shop and past its far end are shut off: one way round
  copingCaps('z', 25.5, 18.3, 21.8, LOW + 0.07); copingCaps('x', 18.6, 23.5, 25.3, LOW + 0.07); copingCaps('x', 18.6, 25.7, 30.1, LOW + 0.07);
  cap(23.2, 18.6, 0.42, 0.42, LOW + 0.02); cap(30.4, 18.6, 0.42, 0.42, LOW + 0.02);

  grp('yard');
  lamp(10.4, 13.2, 'lamp_porch', true);
  lamp(28.9, 20.9, 'lamp_back', true);
  // THE TRODDEN PATHS: the snow says where men walk. From the gate to the front door; and off it round the shop's corner, along the wall, through the walk
  // to the court — the mission's own way. Fresh snow lies everywhere else
  path([[8.25, 14.0], [10.5, 14.3], [12.3, 15.1]], 0.9);
  path([[10.5, 14.3], [11.5, 16.5], [13.3, 17.55], [22.6, 17.8], [25.5, 17.75]], 0.8);
  // the forecourt: the shop's water, its fuel, the clerk's motorbike under the wall, firewood for the stove
  G.waterTank(9.4, 7.4); cap(9.4, 7.4, 0.84, 0.84, 2.2, 0.3, 0.045); G.drums(11.1, 7.0, 3); cap(11.1, 7.0, 0.4, 0.4, 0.88, 0.2, 0.04); cap(11.74, 7.06, 0.4, 0.4, 0.88, 0.5, 0.04); cap(11.4, 7.6, 0.4, 0.4, 0.88, 0.1, 0.04);
  G.motorbike(11.9, 11.6, HALF); capOn(11.9, 11.6, HALF, -0.36, 0, 0.5, 0.2, 0.8, 0.035);
  G.woodPile(9.3, 21.35, 0, 1.8); cap(9.3, 21.35, 1.5, 0.28, 0.42);
  drift(8.44, 9.4, 3.4, 0.62, HALF); drift(8.42, 18.6, 3.2, 0.58, HALF, 0.15); drift(12.1, 9.6, 2.0, 0.5, -HALF, 0.14); bank(8.75, 6.72, 1.1, 1.0, 0);
  // the lane: what a shop keeps behind it. Drifts lie along the foot of the alley wall and of the shop, off the path
  // (a bench under the shop's eave, the winter's split wood stacked under it, where the whistle is blown: it keeps a man off that length of wall. The court's
  //  man walks to where the sound WAS and looks the way he came to it; whistled from against the wall, his last step was at the wall and his light a spot on it)
  thing(21.5, 16.86, 0, 1.7, 0.36, 0.36, M.poplar); thing(21.5, 16.87, 0.36, 1.9, 0.44, 0.06, M.woodGrey); cap(21.45, 16.85, 1.6, 0.3, 0.42, 0, 0.05); drift(20.3, 16.95, 0.9, 0.6, 0.3, 0.15);
  G.woodPile(16.2, 21.5, 0, 1.6); cap(16.2, 21.5, 1.3, 0.28, 0.42); G.tyres(13.4, 21.3, 3); cap(13.4, 21.3, 0.5, 0.5, 0.6, 0.4, 0.04);
  G.handcart(19.2, 21.2, 0.1, 'sacks'); capOn(19.2, 21.2, 0.1, 0, 0, 0.66, 0.42, 0.97, 0.04); G.blocks(22.6, 21.4, 0, 2); cap(22.6, 21.4, 0.68, 0.3, 0.4, 0, 0.04);
  drift(14.6, 21.56, 1.2, 0.62, Math.PI); drift(17.7, 21.56, 0.9, 0.6, Math.PI, 0.15); drift(21.3, 21.55, 1.3, 0.64, Math.PI); drift(24.3, 21.52, 1.7, 0.7, Math.PI, 0.16);
  drift(17.2, 16.86, 5.2, 0.46, 0, 0.15); drift(25.08, 20.7, 1.9, 0.58, -HALF);
  // THE BACK COURT: swept, a fire in a drum where the night man stands (its light is under the walls' tops: the long wall stands between it and the walk, the
  // cross wall between it and the lane — at the back door nothing under 3.5 m is lit by it, at the hide nothing under 2.3), split wood for it against the
  // long wall, a chair, the generator and its fuel, the snow the broom took heaped by the alley wall
  G.drum(28.2, 19.25, 'rust'); glow('fire_court', 'exterior', { c: [28.2, 0.884, 19.25], h: [0.19, 0.006, 0.19] }, [28.2, 1.05, 19.25], 9, 6.5);
  G.woodPile(26.5, 19.08, 0, 1.1); G.plasticChair(29.1, 19.2, -HALF);
  G.generator(31.0, 21.1, HALF); capOn(31.0, 21.1, HALF, -0.1, 0, 1.0, 0.56, 1.0, 0.04); G.gasBottle(31.35, 17.0); G.plasticChair(30.6, 17.02, Math.PI); G.jerryCan(30.3, 21.6, 0.2);
  bank(27.95, 21.5, 1.3, 0.72, Math.PI);   // (nothing at the long wall's far end: the way round it is the night man's only way to the walk)
  // where the night man smokes: by the chair at the strip's far end, a tin for the ends at its foot (the level's script stands him there: TQ.smoke)
  thing(30.15, 16.92, 0, 0.11, 0.11, 0.06, M.tin, 0.3);

  // ================================================================ THE TOWN ROUND IT (nobody goes there: it is what the night is made of) ====
  /** a neighbour's building, seen as its back: a mass `top` high with snow on its flat roof. (Every one stands over 3.5 m: a slab between 2.75 and 3.45 m
   *  is a ROOF to the weather — game/weather.ts roofsOf — and this level has one roof, the shop's) */
  const mass = (x0: number, z0: number, x1: number, z1: number, top: number, kind: WallKind) => {
    const W = G.as(kind, 'concrete');
    add({ c: [(x0 + x1) / 2, top / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, top / 2, (z1 - z0) / 2], albedo: W.albedo, rough: W.rough });
    add({ c: [(x0 + x1) / 2, top + 0.035, (z0 + z1) / 2], h: [(x1 - x0) / 2 - 0.16, 0.035, (z1 - z0) / 2 - 0.16], ...S.snow, flags: DECAL });
  };
  /** a small upper window in a south face at z: lit (a lamp behind a blind: it glows, it lights nothing a man stands in) or dark, with a frame and one bar */
  const pane = (x: number, y: number, z: number, w: number, h: number, lit: boolean) => {
    add({ c: [x, y, z + 0.004], h: [w / 2 + 0.04, h / 2 + 0.04, 0.003], ...M.woodGrey, flags: DECAL });
    add({ c: [x, y, z + 0.008], h: [w / 2, h / 2, 0.002], ...(lit ? { albedo: [0.92, 0.7, 0.42] as Vec3, rough: 0.7, emissive: [4.2, 2.6, 1.0] as Vec3 } : M.glassDark), flags: DECAL });
    add({ c: [x, y, z + 0.011], h: [0.012, h / 2, 0.002], ...M.woodGrey, flags: DECAL });
  };
  grp('town.back');
  mass(8.6, 1.6, 14.6, 5.88, 3.9, 'render'); pane(10.2, 3.1, 5.88, 0.5, 0.4, true); pane(12.9, 3.1, 5.88, 0.5, 0.4, false);
  mass(15.4, 2.6, 22.4, 5.88, 3.5, 'mud'); thing(17.2, 3.6, 3.5, 0.1, 0.1, 0.7, M.tin); thing(20.9, 4.3, 3.5, 0.5, 0.4, 0.34, M.plasticBlue); pane(18.6, 2.95, 5.88, 0.44, 0.34, false);
  mass(23.0, 1.2, 27.6, 5.88, 4.3, 'mudLight'); pane(24.2, 3.3, 5.88, 0.46, 0.4, false); pane(26.3, 3.3, 5.88, 0.46, 0.4, true);
  mass(28.2, 2.2, 33.6, 5.88, 3.6, 'block'); thing(30.4, 3.6, 3.6, 0.1, 0.1, 0.8, M.tin);
  grp('town.east');
  mass(33.0, 7.0, 39.4, 13.6, 3.7, 'mudLight'); pane(35.0, 1.75, 13.6, 0.6, 0.5, true); pane(37.6, 1.75, 13.6, 0.6, 0.5, false);
  G.yardWallX(22, 32.12, 39.88, 'mudLight'); copingCaps('x', 22, 32.5, 39.6);
  G.washLine(33.4, 17.2, 38.6, 17.6, 4); G.tandoor(38.2, 20.2); cap(38.2, 20.2, 0.6, 0.6, 0.55, 0.4, 0.04); G.woodPile(34.6, 21.3, 0, 1.6); cap(34.6, 21.3, 1.3, 0.28, 0.42);
  bank(32.5, 15.5, 2.4, 0.7, HALF, 0.4); drift(36.2, 13.95, 3.0, 0.6, 0);
  // THE STREET: shops shut for the night down its far side (their shutters blue, green and rust), stalls left standing in front of them, one keeper's lantern
  // still burning on his counter; the pickup that brought the day's last load, snow on its bonnet
  grp('town.street');
  G.yardWallZ(0.2, 0.2, 27.8, 'mudLight'); copingCaps('z', 0.2, 0.5, 27.5);
  { const paints: GwotMat[] = ['paintBlue', 'paintGreen', 'paintRust', 'paintBlue', 'paintCream', 'paintGreen'];
    paints.forEach((p, k) => { const z = 2.6 + k * 4.5; add({ c: [0.326, 1.05, z], h: [0.003, 1.05, 1.25], ...M[p], flags: DECAL });
      for (let r = 0; r < 5; r++) add({ c: [0.331, 0.3 + r * 0.4, z], h: [0.002, 0.012, 1.25], albedo: M[p].albedo.map(c => c * 0.6) as Vec3, rough: 0.8, flags: DECAL }); }); }
  G.stall(1.62, 9.3, -HALF, 2.6, 'tarpBlue'); capOn(1.62, 9.3, -HALF, 0, 0.75, 2.5, 0.8, 2.18, 0.045);
  G.stall(1.62, 16.6, -HALF, 2.2, 'rugMadder'); capOn(1.62, 16.6, -HALF, 0, 0.8, 2.1, 0.7, 2.18, 0.045);
  G.stall(1.62, 23.4, -HALF, 2.4, 'canvas'); capOn(1.62, 23.4, -HALF, 0, 0.7, 2.3, 0.86, 2.18, 0.045);
  G.lantern(2.1, 17.2, 'lantern_street', 'exterior', 0.84);
  G.pickup(5.55, 8.4, HALF + 0.05, 'truckWhite', { load: 'sacks' }); capOn(5.55, 8.4, HALF + 0.05, 1.75, 0, 1.2, 1.5, 1.0); capOn(5.55, 8.4, HALF + 0.05, 0.36, 0, 1.0, 1.4, 1.58);
  bank(7.5, 9.2, 4.6, 0.74, -HALF, 0.44); bank(7.52, 18.4, 5.4, 0.7, -HALF, 0.38); drift(0.75, 13.0, 2.6, 0.7, HALF); drift(0.75, 20.0, 2.0, 0.7, HALF, 0.15);
  // THE ALLEY behind the back wall: two stalls put up against it, a handcart, the other lantern
  grp('town.alley');
  G.yardWallX(27.8, 7.4, 39.88, 'mud');
  G.stall(12.0, 23.5, Math.PI, 2.2, 'tarpBlue'); capOn(12.0, 23.5, Math.PI, 0, 0.75, 2.1, 0.8, 2.18, 0.045);
  G.stall(17.3, 23.5, Math.PI, 2.6, 'canvas'); capOn(17.3, 23.5, Math.PI, 0, 0.7, 2.5, 0.86, 2.18, 0.045);
  G.lantern(16.6, 24.0, 'lantern_alley', 'exterior', 0.84);
  G.handcart(22.4, 23.7, 0.25, 'none'); capOn(22.4, 23.7, 0.25, 0, 0, 1.5, 0.8, 0.57, 0.05); G.drums(28.6, 23.0, 2); cap(28.6, 23.0, 0.4, 0.4, 0.88, 0.2, 0.04);
  drift(25.4, 22.45, 3.4, 0.62, 0); drift(31.0, 22.42, 2.2, 0.56, 0, 0.15); bank(36.4, 22.5, 3.0, 0.76, 0);

  // ---- the devices ----
  grp('devices');
  const devices: DeviceDef[] = [
    { kind: 'keypad', name: 'pad_strong', pos: TQ.pad, yaw: HALF, door: 'strong', code: '4213' },
    // a beam at the chest across the hall, on its own battery: under it on a knee
    { kind: 'laser', name: 'beam_high', from: [TQ.beamHigh, 1.3, 8.64], to: [TQ.beamHigh, 1.3, 16.36], mains: false, alarm: 'alarm' },
    // a beam at the shins across the counting room's doorway, on the mains: nothing goes under it
    { kind: 'laser', name: 'beam_low', from: [20.0, 0.35, 14.82], to: [20.0, 0.35, 15.68], mains: true, alarm: 'alarm' },
  ];

  // ---- three men, each with a job. No key on any belt: held and asked (twice: the first answer is a stall), the back court's man gives the pad's code ----
  // each walks a stride or two to his place and stands the night out there, facing the way he walked
  const post = (name: string, from: [number, number], to: [number, number]) => ({ name, points: [[from[0], 0, from[1]], [to[0], 0, to[1]]] as P3[], wait: [0, 3600], keys: [] as string[] });
  const routes = [
    post('hall', [24.9, 12.6], [23.9, 12.6]),          // the hall's man: a stride inside the store's doorway, his back to it, his eyes on the beam and the far door
    post('court', [26.2, 20.8], [27.2, 20.0]),         // the back court's man (the second on the roll: the one who talks soonest): under the court's lamp, the long wall between him and the lane
    post('table', [17.2, 10.2], [18.4, 10.2]),         // the clerk, at the counting table: the nearest man to the mains box
  ];

  const front = TQ.safeFront;
  const quiet: QuietData = {
    thing: 'the ledger',
    radioCheck: false,   // nobody is missed on a clock here: a first night is read at a reader's pace
    starts: [{ name: 'the street gate', sam: TQ.start, samYaw: HALF }],
    spots: [{ place: 'the strongroom', area: { ...STRONG }, door: 'strong', holder: 'the safe', rackIndex: 0, front, halfW: 0.35 }],
    exits: [EXIT_W],
    patrols: [['hall', 'court', 'table']],
  };
  const down = (n: number) => ({ is: 'men', down: n });
  const did = (what: string) => ({ is: 'did', what });
  const any = (...of: object[]) => ({ is: 'any', of });
  const all = (...of: object[]) => ({ is: 'all', of });
  const near = (at: P3, r: number) => ({ is: 'near', at, r });
  const held = [did('chron:grab'), { is: 'flag', flag: 'holding' }];
  const PICKED = any(did('chron:lockPicked'), { is: 'door', door: 'back', state: 'open' }, { is: 'door', door: 'back', state: 'unlocked' }, { is: 'door', door: 'back', state: 'broken' });
  const mark = (p: P3): P3 => [p[0], 1, p[2]];
  const lesson: LessonData = {
    title: 'Unseen',
    // THE FRAME (game/rails.ts). From the first step: the walk, the view, the aim. Each tool is switched on by the step that teaches it and stays on.
    // `rows` = the verbs Space offers here: nothing a step did not teach has a row (a wall charge at the box, the light plate beside the strongroom's
    // door, a body to drag), so a tap is always the thing the line means.
    // (the rows: what the steps teach, AND the plain quiet acts a player tries unasked — shutting a door behind him, easing one open, moving a body out of the
    //  light. The first play on the new level: "nothing in reach to close the door?", at the back door he had just picked. What stays off is what would break
    //  the night: the boot, the hammer, a rattled handle, the mains put back on.)
    rails: { allow: ['move', 'camera', 'zoom', 'aim'], rows: ['grab', 'question', 'choke', 'pick', 'push', 'pull', 'ease', 'drag', 'drop', 'code', 'nocode', 'breakerOff', 'drive'] },
    steps: [
      // ---- the lane: light ----
      { id: 'crouch', line: 'Press [C] to crouch', allow: ['crouch'], done: any({ is: 'flag', flag: 'crouch' }, down(1)) },
      // (the meter's line is 0.45, not the 0.3 it was on bare earth: snow throws the porch lamp's light back, and on the page the mark — round the corner, out of
      //  the lamp's sight — read 0.28 to 0.32 where earth read under 0.2; the lamp itself is 1.0, so 0.45 still means 'out of it')
      // (…and a step never becomes impossible: a renderer whose snow reads brighter than the one this was measured on must not hold him at step 2, so a
      //  player well down the lane has passed it whatever the meter says)
      { id: 'dark', line: 'Get out of the light', done: any(all(near(TQ.dark, 1.6), { is: 'meter', which: 'light', below: 0.45 }), near(DEEP, 1.0), down(1)), hold: 0.4, at: mark(TQ.dark) },
      { id: 'creep', line: 'Stay in the shadows', cue: 'lane', done: any(near(TQ.whistle, 0.7), ...held, down(1)), at: mark(TQ.whistle) },
      // ---- the long wall: sound, then hands ----
      // (a beat with a clock: the whole instruction is in the line that is up BEFORE the clock starts, the mark on the place the line means now — his own
      // feet for the whistle; the moment it sounds the next line is up with the mark on the hide. A mark on the hide first sent a new player there to whistle.)
      // (the whistle has two ways in: its own key where it has one, and on the page the last wedge of the ring his interaction key puts up when it is kept
      // down — `ringLine`; `use` comes on here for that ring, a step before the grab needs it)
      { id: 'whistle', line: 'Press [V] to whistle here, then hide behind the wall', ringLine: 'Hold [Space] and press [5] to whistle, then hide behind the wall', allow: ['whistle', 'use'], checkpoint: 'the lane', done: any(did('event:whistle'), ...held, down(1)), at: mark(TQ.whistle) },
      // (the first play of it on a GPU, with no card and the line "Hide. When he stops: round the wall, [Space]": "not sure what this means". He had hidden,
      //  off the whistle's own line; he could not tell when "stops" is or what the key would do. So the frame's card says the whole beat the moment the
      //  whistle has gone, with the world held while it is read — he looks for about four seconds, which is no time to read in; the line names the deed;
      //  and the mark rides on the man, so where he is and that he has stopped can be seen from behind the wall)
      // (the second play of it on a GPU: the man walked to the whistle's own mark and stood over the player's prints in the snow. "guard seems kinda dumb
      //  that he doesn't notice the footprints. maybe we should make him stop a bit further away and then turn around for a cigarette break"; "he can stop
      //  further off so long as he's covered the spot with his flashlight". So he looks from the far side of the cross wall and then smokes with his back to
      //  its gap: the level's script, TQ.look and TQ.smoke. The `held` cue tells that script the man is the player's now)
      { id: 'grab', line: 'When he lights a smoke, sneak up behind him and press [Space] to grab him', explain: { title: 'Whistle to lure a guard', text: 'He heard that, and he\'s coming to look. Stay behind the wall, out of his light.\nHe\'ll check out the sound and then stop for a smoke, with his back to you. Come around the wall, go up behind him, and press [Space] to grab him.' },
        done: any(...held, down(1)), atMan: 'court' },
      { id: 'ask', line: 'Press [Space] to ask him for the code', cue: 'held', done: any(did('chron:codeLearned'), down(1)) },
      { id: 'drop', line: 'Right click to knock him out, or left click to use the knife', allow: ['fire', 'alt'], done: down(1) },
      // ---- the back door: a lock ----
      // (the same play, at one line — "[Space] at the lock. Then keep still": "'E at the lock' isn't sufficient. we need to introduce the lock picking system
      //  (like via the modal), tell the user they're going to do it, and then show them the controls for doing so"; and of the safe's line: "weird to say
      //  'keep still' -- we should just have a modal explaining interactions and cancelling them when we first introduce them". So: the walk to the door is
      //  its own line; AT the door — the first work that takes time — the frame's card says this lock is his to pick, that such work takes seconds and
      //  what stops it; and no line says 'keep still' again)
      { id: 'door', line: 'Go to the back door', checkpoint: 'the back court', done: any(near(TQ.backDoor, 0.8), { is: 'flag', flag: 'picking' }, PICKED), at: mark(TQ.backDoor) },   // (0.8: the man is taken three strides short of this door)
      { id: 'pick', line: 'Press [Space] at the lock to pick it', explain: { title: 'Picking a lock', text: 'This door is locked. Stand at the lock and press [Space] to pick it.\nPicking a lock, entering a code or opening a safe takes a few seconds. If you move or press [Space] again, you stop.\nThe lock clicks while you work on it, and a guard close by can hear it.' },
        done: PICKED, at: mark(TQ.backDoor) },
      // ---- the store: a man in the light, the player in the dark ----
      { id: 'nook', line: 'Go inside and stay in the dark', cue: 'store', done: any(near(TQ.nook, 0.8), down(2)), hold: 0.3, at: mark(TQ.nook) },
      { id: 'strike', line: 'Stay low so he doesn\'t hear you, then left click to knife him', checkpoint: 'the store', done: down(2), at: [24.9, 1, 12.6] },
      // ---- the hall: two beams and the mains ----
      { id: 'under', line: 'Stay low and go under the laser beam', done: any({ is: 'in', area: { x0: 20.12, x1: 23.4, z0: 8.62, z1: 16.38 } }, did('act:breakerOff')), at: mark(TQ.under) },
      // ---- the set piece: the mains ----
      { id: 'nv', line: 'Press [N] to turn on night vision', allow: ['nvg'], checkpoint: 'the hall', done: any({ is: 'flag', flag: 'nv' }, down(3)) },
      { id: 'box', line: 'Press [Space] at the breaker box, then hide behind the wall', done: any(did('act:breakerOff'), down(3)), at: mark(TQ.boxAt) },
      { id: 'boxman', line: 'Stay hidden until he\'s working at the breaker box, then take him from behind', done: down(3), at: mark(TQ.wait) },
      { id: 'code', line: 'Press [Space] at the keypad to enter his code', checkpoint: 'the counting room', done: any(did('chron:codeEntered'), { is: 'door', door: 'strong', state: 'open' }, { is: 'door', door: 'strong', state: 'broken' }), at: [17.3, 1, 10.6] },
      { id: 'safe', line: 'Press [Space] at the safe to take the ledger', done: { is: 'stage', stage: 'exfil' }, at: front },
      { id: 'out', line: 'Leave by the front door', done: any({ is: 'in', area: { x0: 8.12, x1: 12.3, z0: 11.0, z1: 18.0 } }, { is: 'stage', stage: 'done' }), at: [11.4, 1, 15.1] },
      // (the line stays up to the mission's own end: with the last step done in the forecourt the page fell back to the small objective row at the top)
      { id: 'gate', line: 'Leave through the gate', done: any({ is: 'in', area: { x0: 7.25, x1: 7.9, z0: 13.2, z1: 14.8 } }, { is: 'stage', stage: 'done' }), at: [8.3, 1, 14.0] },
    ],
  };
  for (const d of doors) doorFrame(d);
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices,
    breaker: breaker!, beacons: [{ pos: [20.3, 2.05, 6.3], box: dome }],
    playerSpawn: TQ.start, routes, chokepoints: [], clearPlans: [],
    sky: { zenith: [0.012, 0.02, 0.042], horizon: [0.04, 0.05, 0.075] },
    // (the script's eyes: a man a script walks is run by the script and sees nothing, and a play program may ask of the player only whether he stands in a
    // volume. `tq_walk` = the walk and the back strip, the ground in front of the man as he comes and looks; `tq_beam` = what his light reaches of the lane
    // through the gap, everything but the pocket behind the long wall; `tq_past` = the strip beyond where he smokes, the way he faces)
    volumes: [
      { name: 'tq_walk', kind: 'trigger', c: [27.55, 1, 17.55], h: [4.3, 1, 0.93] },
      { name: 'tq_beam', kind: 'trigger', c: [20.05, 1, 18.4], h: [3.05, 1, 1.78] },
      { name: 'tq_past', kind: 'trigger', c: [31.4, 1, 17.55], h: [0.45, 1, 0.93] },
    ],
    mission: { serverRoom: { ...STRONG }, entryDoor: 'strong', rack: { index: 0, front, halfW: 0.35 }, exfilDoor: 'gate_w', exfilX: EXIT_W.x, exfilZ: EXIT_W.z, exfilOut: EXIT_W.out },
  };
  // WHAT IS UNDERFOOT (game/floor.ts; the six it has; first match wins): the rooms are 'stone'; the court, the street, the alley and the trodden paths are
  // 'asphalt' (the nearest the six have to hard ground); everything else is fresh snow, 'grass' (the soft, quiet one)
  const surfaces: SurfacesData = { building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'grass', outside: 'grass', verge: 'grass', zones };
  const scenarios: LevelScenarios = { quiet, lesson, places: PLACES, doorNames: [{ door: 'gate_w', name: 'street gate' }, { door: 'front', name: 'front door' }, { door: 'back', name: 'back door' }, { door: 'strong', name: 'strongroom door' }] };
  return { level, scenarios, groups: trace.groups, surfaces };
}
