// TRAIN-GROUND: the Training group's shared floor (not a level: no NAME, never exported by itself). Every lesson level (tools/levels/train-*.ts) stands on the
// same walled compound in the GWOT kit (src/scene/gwotKit.ts) — a 24 × 16 m yard, a foot gate in the west wall and one in the east — and adds its own huts,
// cover, lights, men and its `scenarios` blocks. One shell so a lesson's file is its rooms and its steps, and seven lessons read as one place.
//
//        x 8                                                      32
//   z 6  ┌────────────────────────────────────────────────────────┐
//        │                                                        │
//  gate_w  (z 14)            the lesson's own floor               gate_e  (z 14)
//        │                                                        │
//   z 22 └────────────────────────────────────────────────────────┘
//
//   const T = trainGround();                    the shell: ground, the yard wall, both gates, the moon, a breaker, a beacon
//   T.hut({ … })                                a room: four walls, a floor, a roof, its doors cut and hung → its inside rect
//   T.lamp(x, z, name)                          a yard lamp: a 7 m pool of light to walk round (bun run tools/qa/light-map.ts <name> draws what is lit)
//   T.G.crates(…) / T.G.sandbags(…) …           the kit's pieces (the guide: rebuild/play-style-levels/look/read-first.md)
//   return T.finish({ spawn, routes, mission, scenarios: { quiet, lesson } });
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { LevelScenarios, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

/** every lesson level exports this as its MATERIALS (tools/levels/export.ts writes the kit's palette into the file) */
export const TRAIN_MATERIALS = GWOT_MATERIALS;
/** the yard inside the wall */
export const YARD: Rect = { x0: 8, x1: 32, z0: 6, z1: 22 };
export const HALF = Math.PI / 2;
/** where a lesson starts unless it says otherwise: on the road outside the west gate, facing it */
export const START_W: Vec3 = [5.6, 0, 14.0];
/** the two gates as a quiet mission's ways out (scenarios.quiet.exits) */
export const EXIT_W = { name: 'the track gate', door: 'gate_w', x: 7.2, z: 14.0, out: [-1, 0] as [number, number] };
export const EXIT_E = { name: 'the far gate', door: 'gate_e', x: 32.8, z: 14.0, out: [1, 0] as [number, number] };

type WallKind = 'mud' | 'mudLight' | 'render' | 'block';
export interface HutDoor { name: string; side: 'n' | 's' | 'e' | 'w'; /** where the opening STARTS along the wall (x for n / s, z for e / w); it is 1.2 m wide */ at: number; extra?: Partial<LevelDoorDef> }
export interface HutSpec { x0: number; z0: number; x1: number; z1: number; kind?: WallKind; doors: HutDoor[]; /** a window hole per entry: { side, at (start along the wall), w? (0.8) } — eyes and rounds pass, men do not */ windows?: { side: 'n' | 's' | 'e' | 'w'; at: number; w?: number }[]; floor?: 'mudFloor' | 'slab'; roof?: boolean }

export function trainGround() {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];
  let huts = 0;

  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(YARD.x0, YARD.z0, YARD.x1, YARD.z1, 'dirt');
  G.ground(0, 12.6, 8, 15.4, 'gravel'); G.ground(32, 12.6, 40, 15.4, 'gravel');   // the track up to either gate
  grp('walls.yard');
  const gap = [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }];
  G.yardWallX(YARD.z0, 7.88, 32.12); G.yardWallX(YARD.z1, 7.88, 32.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gap); G.yardWallZ(YARD.x1, YARD.z0, YARD.z1, 'mud', gap);
  for (const [x, z] of [[8, 6], [8, 22], [32, 6], [32, 22], [20, 6], [20, 22]] as const) G.pier(x, z);
  doors.push({ name: 'gate_w', hinge: [8.0, 13.42], closedDir: HALF, width: 1.16, exterior: true }, { name: 'gate_e', hinge: [32.0, 13.42], closedDir: HALF, width: 1.16, exterior: true });
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // the mains breaker and one emergency beacon (the game's blackout wants both): on the north wall's inside face unless the lesson moves the breaker
  let breaker: Level['breaker'] | null = null;
  /** put the breaker on a wall: `c` = the panel's centre 4 cm proud of the face, `out` = the way it faces (the side a man stands); `fumble` = seconds a man
   *  sent to it works at it before the mains come back (left out: the game's own 2.2) */
  const breakerAt = (x: number, z: number, out: 'n' | 's' | 'e' | 'w', fumble?: number) => {
    grp('breaker');
    const alongX = out === 'n' || out === 's', s = out === 's' || out === 'e' ? 1 : -1;
    const brk = add({ c: [x, 1.35, z], h: alongX ? [0.28, 0.36, 0.04] : [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
    const led = add({ c: alongX ? [x - 0.18, 1.62, z + s * 0.05] : [x + s * 0.05, 1.62, z - 0.18], h: [0.015, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
    breaker = { pos: alongX ? [x, 1.35, z + s * 0.14] : [x + s * 0.14, 1.35, z], boxes: [brk, led], ...(fumble !== undefined ? { fumble } : {}) };
  };
  grp('beacons');
  add({ c: [20.3, 2.28, 6.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [20.3, 2.16, 6.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  const LAMP_ARM = 0.6;
  /** A yard LAMP: a pole with a shaded head throwing a POOL straight down (about 7 m across the ground at the default cone) and little past it — a thing to walk
   *  round, where the kit's floodLight washes a whole yard. A fixture like any other: a round or the OCP puts it out; `mains` = the breaker takes it too. */
  const lamp = (x: number, z: number, name: string, o: { on?: boolean; mains?: boolean; height?: number; outerDeg?: number; intensity?: number; group?: string } = {}) => {
    const h = o.height ?? 3.4, on = o.on ?? true;
    // the pole stands LAMP_ARM north of the head, which hangs off an arm: the light is under the head with nothing solid round it (a light inside its own pole is
    // a lint error: its shadow rays would start in the dark), and the pole's thin shadow falls north, away from the pool's middle
    add({ c: [x, (h + 0.11) / 2, z - LAMP_ARM], h: [0.04, (h + 0.11) / 2, 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.085, z - LAMP_ARM / 2], h: [0.025, 0.025, LAMP_ARM / 2 - 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...GWOT_MATERIALS.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...GWOT_MATERIALS.plasticWhite, emissive: on ? [40, 34, 22] : [0, 0, 0], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.86, 0.6], intensity: o.intensity ?? 90, range: 9, innerDeg: (o.outerDeg ?? 52) - 22, outerDeg: o.outerDeg ?? 52, name, group: o.group ?? 'exterior', enabled: on, volumetric: 0.2, fixtureBox: fb, radius: 0.1, mains: o.mains ?? false });
  };

  /** A room: shell walls on the rect's lines, a floor, a roof, each door's 1.2 m opening cut and its leaf hung (hinge at the opening's low end). Returns the
   *  room's inside rect (the walls' inner faces) — a quiet spot's `area`, a lesson's `in` test. */
  const hut = (h: HutSpec): Rect => {
    const kind = h.kind ?? 'mud', n = huts++, t = GW_SHELL / 2;
    grp(`hut${n}.floor`); G.ground(h.x0, h.z0, h.x1, h.z1, h.floor ?? 'mudFloor', 0.006);
    if (h.roof !== false) { grp(`hut${n}.roof`); slab(h.x0 - 0.1, H, h.z0 - 0.1, h.x1 + 0.1, H + 0.2, h.z1 + 0.1, kind === 'render' ? P.render : P.mudLight, { flags: BoxFlag.NoPrimary, rough: 0.95 }); }
    grp(`hut${n}.walls`);
    const holes = (side: 'n' | 's' | 'e' | 'w') => [
      ...h.doors.filter(d => d.side === side).map(d => ({ a: d.at, b: d.at + 1.2 })),
      ...(h.windows ?? []).filter(w => w.side === side).map(w => ({ a: w.at, b: w.at + (w.w ?? 0.8), y0: 1.0, y1: 2.0 })),
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

  /** The level, put together: doors framed, the breaker placed if the lesson did not, the footstep map. `mission` is the plain night's three places every level
   *  file carries (a quiet lesson: its spot and its first exit; a loud one: any room and a gate). */
  const finish = (o: { spawn: Vec3; routes?: PatrolRoute[]; mission: Level['mission']; scenarios: LevelScenarios; level?: Partial<Level> }): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } => {
    if (!breaker) breakerAt(30.6, 6.16, 's');
    for (const d of doors) doorFrame(d);
    const level: Level = {
      boxes: K.boxes, props: K.props, lights, switchables, doors, devices: [],
      breaker: breaker!, beacons: [{ pos: [20.3, 2.05, 6.3], box: dome }],
      playerSpawn: o.spawn, routes: o.routes ?? [], chokepoints: [], clearPlans: [],
      sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
      mission: o.mission, ...o.level,
    };
    const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
    // WHAT A ROW CALLS THE GROUND'S TWO GATES (scenarios.doorNames — game/doornames.ts; no bearing in a name): the one off the track and the one across the ground.
    // A level on this ground that knows a gate by something of its own writes its own row for it, and that row stands; its other rows are kept beside these.
    const own = o.scenarios.doorNames ?? [], gates = [{ door: 'gate_w', name: 'track gate' }, { door: 'gate_e', name: 'far gate' }].filter(g => !own.some(r => r.door === g.door));
    return { level, scenarios: { ...o.scenarios, doorNames: [...gates, ...own] }, groups: trace.groups, surfaces };
  };
  return { K, G, P, H, trace, grp, add, slab, lights, switchables, doors, zones, hut, lamp, breakerAt, finish };
}
