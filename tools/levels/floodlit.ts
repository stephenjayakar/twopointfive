// THE FLOODLIT YARD — one idea: OWN THE DARK (levels/floodlit.json ← bun run tools/levels/export.ts floodlit). A walled compound on an overcast night. The
// team forms up outside the wall, in the dim edge of the gate posts' lamps (lived things: below); between the gate and the building lie eleven metres of open yard under three floodlights on the building's
// eaves, and the rooms' open windows look straight down it at the gate. The floodlights and every bulb in the building hang on the MAINS; the mains breaker
// is in the generator shed on the OUTSIDE of the west wall, a short walk from the start to a door with a lamp over it. Throw it (Sam's own row, or the squad's 'work' order
// on the panel) and the yard is black: the defenders carry no lights and no goggles, the team has goggles. NOBODY COMES TO PUT THE LIGHTS BACK ON: a room
// clear pins its defenders to their marks (lighting.ts hands one of them the errand and he says so; he does not walk). THE SHED IS EMPTY ON PURPOSE: with
// one of the seven holding it (tried, 24 shipped seeds a way) the fight for it is heard, the building's men come out to it, and the team wins 21 of 24 with
// the lights ON and 22 of 24 with them out — the dark stopped mattering. The trial is rebuild/missions/new/floodlit-shed-held.patch in the project files.
// What is left burning with the mains out is on batteries and too dim for a bare eye: a red obstruction lamp on the radio mast on the front wall (the yard's
// tubes need something to amplify — headless the stand-in meter has no moon and no bounce) and a hurricane lantern in each room (so a man who walks in
// beside one can still be seen and fought at arm's length: the dark is an edge, not a switch that ends the fight; their strength, 6, is the mission's dial —
// at 4 the dark cost 11 teammates of 96 over 24 shipped seeds, at 6 it costs 34, at 8 38, and the yard taken lit costs 54 and a third of the runs). No emergency beacons. The MOON is an
// overcast night's 0.04: the page's meter counts it (probe.wgsl sums kind-2 lights) where the headless stand-in does not, and at the kit's 0.9 the yard
// with the mains out read about half lit to a bare eye there (floodlit-check asks nvg.ts nvgPlaceLight, which counts the moon, for that reason).
// CHECKED WITH THE FOUR ONLY: bun run tools/qa/scenario-level-probes.ts levels/floodlit.json --only data,four --seeds 3,4,5,6,7,8 — the level is not tuned
// for a pair (a pair crossing the lit yard is wiped on most of that probe's seeds; that is the level's point, not a fault to tune away). WHEN THIS WAS
// WRITTEN the probe's default seeds were 1,2,3 and seed 2 was red with the four: the last defender left by the store's back door and stood in the dark
// strip east of the building, and that probe's driver has no hunt (it ran to its time cap with one teammate up). playthrough.ts's commander hunts him:
// 48 of 48 shipped runs ended. ON THE BUILD OF 3752969b (10-14, frozen stand) the default is seeds 0,1,2,3 (0 = the level's own marks) and the four
// takes the floor on all four (seed 2 at 51.8 s, one teammate up); the pair is wiped on 0, 1 and 2 and takes it on 3, which the probe does not ask of it.
// Built from the kit (scene/levelKit.ts). Plan, +x east, +z south, metres:
//
//        x=4     x=9         x=16    x=22      x=27.5 x=31    x=36
//   z=4  +=======================================================+   the compound wall, 2.6 m
//        |              back strip (dark)          dB             |   dB = the store's back door
//   z=6  |       +-----------+-------+----------+---d--+         |
//        |       |  GUARD    | HALL  |  RADIO   |STORE |         |
//        |       |  ROOM     d       d  ROOM    d      |         |
//   z=13 |       +---WWWW----+--dF---+--WWWW----+------+         |   W = an open window (no glass), dF = the front door
//   +----+        *         *         *      <- floodlights on the eaves, on the mains
//   |SHED|                    THE YARD (lit)
//   | G  |                                                        |   G = the generator; the shed's east wall is the compound wall
//   |B   |                                                        |   B = the breaker, on the inside of the shed's south wall
//   +--dS+ dW        [pickup]                    [drums]          |   dS = the shed's one door (south, outside the wall) · dW = the west foot gate
//   z=24 +=================+   GATE   +===========================+
//          team               x 18.5‥21.5      (a lamp on each gate post, facing out, and one over dS: on the mains like the floodlights)
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag } from '../../src/scene/boxes';
import type { Level } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import * as K from '../../src/scene/levelKit';
import { livedPieces, INK } from './livedPieces';

export const NAME = 'floodlit';
export const NOTES = 'The floodlit yard: a room clear whose one idea is the mains breaker. A lit yard under the windows; the breaker in a shed outside the wall. Kit pieces only. Regenerate: bun run tools/levels/export.ts floodlit';

export const FLOODLIT_ROOMS = {
  west:  { name: 'guard room', bounds: { x0: 9.12,  x1: 15.94, z0: 6.12, z1: 12.88 } },
  hall:  { name: 'hall',      bounds: { x0: 16.06, x1: 21.94, z0: 6.12, z1: 12.88 } },
  east:  { name: 'radio room', bounds: { x0: 22.06, x1: 27.44, z0: 6.12, z1: 12.88 } },
  store: { name: 'store',     bounds: { x0: 27.56, x1: 30.88, z0: 6.12, z1: 12.88 } },
  shed:  { name: 'generator shed', bounds: { x0: 0.72, x1: 3.88, z0: 15.12, z1: 19.38 } },
  yard:  { name: 'yard',      bounds: { x0: 4.12, x1: 35.88, z0: 13.12, z1: 23.88 } },
} as const;
/** where the team forms up: outside the south wall, west of the gate, out of every window's sight (the west gate post's lamp reaches it, dimly: every mark under the goggles' line) */
export const FLOODLIT_START: Vec3 = [9.0, 0, 26.2];
/** the middle of the gate's opening, chest high: what the window men look at */
const GATE: Vec3 = [20.0, 1.1, 24.0];

/** THE ROOM CLEAR (scene/scenarios.ts StructureData). Seven men: guard room 2, hall 2, radio room 2, store 1. The window marks come first in the two window
 *  rooms, so the authored placement (and most deals) has a man at each window looking down the yard at the gate. */
export const FLOODLIT_STRUCTURE: StructureData = {
  name: 'floodlit yard',
  maxMen: 7,
  team: { sam: FLOODLIT_START, samYaw: Math.PI, ops: [[7.8, 0, 26.7], [10.2, 0, 26.7], [6.6, 0, 26.2], [11.4, 0, 26.2]], opsYaw: Math.PI },
  rooms: [
    { id: 'west', name: 'guard room', bounds: { ...FLOODLIT_ROOMS.west.bounds }, garrison: 2,
      doors: [{ id: 'guard_room', from: 'hall' }],
      marks: [
        { pos: [12.6, 0, 12.3], watch: 'guard_room', aimAt: GATE },                         // the window: down the yard at the gate
        { pos: [11.4, 0, 7.0], watch: 'guard_room', aimAt: [15.9, 1.1, 9.6] },              // the far corner, on the room's one door
        { pos: [13.5, 0, 12.3], watch: 'guard_room', aimAt: [4.2, 1.1, 21.8] },             // the window's other side: across the yard at the west foot gate
      ] },
    { id: 'hall', name: 'hall', bounds: { ...FLOODLIT_ROOMS.hall.bounds }, garrison: 2,
      doors: [{ id: 'front', from: 'yard' }, { id: 'guard_room', from: 'guard room' }, { id: 'radio_room', from: 'radio room' }],
      marks: [
        { pos: [19.0, 0, 7.0], watch: 'front', aimAt: [19.0, 1.1, 12.9] },          // the back wall, square on the front door
        { pos: [17.0, 0, 12.2], watch: 'front', aimAt: [18.6, 1.1, 12.6] },         // the hard corner west of it
        { pos: [21.2, 0, 7.4], watch: 'front', aimAt: [19.0, 1.1, 12.9] },          // the north-east corner
      ] },
    { id: 'east', name: 'radio room', bounds: { ...FLOODLIT_ROOMS.east.bounds }, garrison: 2,
      doors: [{ id: 'radio_room', from: 'hall' }, { id: 'store', from: 'store' }],
      marks: [
        { pos: [24.9, 0, 12.3], watch: 'radio_room', aimAt: GATE },                         // the window: down the yard at the gate
        { pos: [26.8, 0, 7.0], watch: 'radio_room', aimAt: [22.1, 1.1, 9.6] },              // the north-east corner, on the hall door
        { pos: [24.2, 0, 12.3], watch: 'radio_room', aimAt: GATE },                         // the window's other side
        { pos: [23.0, 0, 7.0], watch: 'store', aimAt: [27.4, 1.1, 7.8] },              // the north-west corner, on the store's door
      ] },
    { id: 'store', name: 'store', bounds: { ...FLOODLIT_ROOMS.store.bounds }, garrison: 1,
      doors: [{ id: 'store', from: 'radio room' }, { id: 'back', from: 'back strip' }],
      marks: [
        { pos: [30.2, 0, 12.2], watch: 'back', aimAt: [29.0, 1.1, 6.2] },           // the south-east corner, up the room at the back door
        { pos: [30.2, 0, 10.2], watch: 'store', aimAt: [27.6, 1.1, 7.8] },             // the east wall, on the door from the radio room
      ] },
  ],
};

/** THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the level's one idea from where the team stands — the
 *  main gate, which has no leaf: the two posts under their lamps, the stack in the dark along the outside of the wall, and through the opening the yard under
 *  its floodlights. Anchored on the opening, post to post (the team forms up ten metres west of it, on the same
 *  side). The picture hangs no lamp of its own: the two on the gate posts are the level's, and they are lit. */
export const FLOODLIT_KITVIEW: KitViewData = { ways: [{ span: [[18.54, 24], [21.46, 24]], light: { porch: { intensity: 0 } } }] };

export const FLOODLIT_SCENARIOS: LevelScenarios = { roomClear: FLOODLIT_STRUCTURE, kitView: FLOODLIT_KITVIEW,
  places: { areas: [{ name: FLOODLIT_ROOMS.yard.name, bounds: { ...FLOODLIT_ROOMS.yard.bounds } }, { name: FLOODLIT_ROOMS.shed.name, bounds: { ...FLOODLIT_ROOMS.shed.bounds } }] } };

export function build(opts: K.KitOpts = {}): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const k = K.newKit(opts); const C = K.KIT_PALETTE;
  const EXT = K.WALL_EXT, INT = K.WALL_INT, WALL_H = 2.6;
  const hole = (a: number, b: number): K.Opening => ({ a, b, y0: 0.9, y1: 2.2 });   // a window with no glass in it

  // ---------------- ground ----------------
  K.grp(k, 'ground');
  K.slab(k, 0, -0.25, 0, 40, 0, 28, C.asphalt);
  K.slab(k, 4.12, 0, 13.12, 35.88, 0.01, 23.88, [0.34, 0.3, 0.24], { flags: BoxFlag.NoShadow });   // the yard: packed earth
  K.grp(k, 'floors');
  K.slab(k, 9, -0.1, 6, 31, 0.001, 13, C.concrete);
  K.floorFinish(k, 16.06, 6.12, 21.94, 12.88, C.lino);
  K.grp(k, 'ceiling');
  K.ceiling(k, 8.9, 5.9, 31.1, 13.1);
  K.slab(k, 0.5, 2.76, 14.88, 4.0, 2.88, 19.62, C.metal, { flags: BoxFlag.NoPrimary });   // the shed's tin roof, on rafters a hand over the wall tops: seen through from above like every ceiling (rays still meet it), and high enough to be one of the weather's roofs (weather.ts roofsOf: no rain inside)

  // ---------------- the compound wall (x 4‥36, z 4‥24), 2.6 m: the gate in the south side, a foot gate in the west ----------------
  K.grp(k, 'walls.compound');
  const cw: Vec3 = [0.46, 0.42, 0.36];
  K.wallX(k, 4, 3.88, 36.12, EXT, cw, [], {}, WALL_H);
  K.wallX(k, 24, 3.88, 36.12, EXT, cw, [{ a: 18.5, b: 21.5, y0: 0, y1: WALL_H }], {}, WALL_H);
  K.wallZ(k, 4, 4.12, 23.88, EXT, cw, [K.doorAt(k, 'foot_gate', 'z', 4, 21.2, { exterior: true })], {}, WALL_H);
  K.wallZ(k, 36, 4.12, 23.88, EXT, cw, [], {}, WALL_H);
  for (const x of [18.38, 21.62]) K.add(k, { c: [x, 1.4, 24], h: [0.16, 1.4, 0.16], albedo: C.concrete });   // the gate's posts

  // ---------------- the building (x 9‥31, z 6‥13) ----------------
  K.grp(k, 'walls.exterior');
  const ext = C.concrete;
  // (the store's back door opens OUTWARD: no wedge holds it, so the store's men can shut the radio room's door alone — tools/qa/second-way-check.ts)
  K.wallX(k, 6, 8.88, 31.12, EXT, ext, [K.doorAt(k, 'back', 'x', 6, 28.4, { exterior: true, swing: -1 })]);
  K.wallX(k, 13, 8.88, 31.12, EXT, ext, [hole(12, 14), K.doorAt(k, 'front', 'x', 13, 18.4, { exterior: true }), hole(23.5, 25.5)]);
  K.wallZ(k, 9, 6.12, 12.88, EXT, ext);
  K.wallZ(k, 31, 6.12, 12.88, EXT, ext);
  K.grp(k, 'walls.interior');
  const iw = C.wall;
  K.wallZ(k, 16, 6.12, 12.88, INT, iw, [K.doorAt(k, 'guard_room', 'z', 16, 9.0)]);
  K.wallZ(k, 22, 6.12, 12.88, INT, iw, [K.doorAt(k, 'radio_room', 'z', 22, 9.0)]);
  K.wallZ(k, 27.5, 6.12, 12.88, INT, iw, [K.doorAt(k, 'store', 'z', 27.5, 7.2)]);

  // ---------------- the generator shed, outside the west wall (x 0.6‥4, z 15‥19.5): the breaker on the inside of its south wall ----------------
  K.grp(k, 'shed');
  const sw: Vec3 = [0.3, 0.32, 0.3];
  K.wallX(k, 15, 0.48, 3.88, EXT, sw, [], {}, WALL_H);
  K.wallX(k, 19.5, 0.48, 3.88, EXT, sw, [K.doorAt(k, 'shed', 'x', 19.5, 2.4, { exterior: true })], {}, WALL_H);
  K.wallZ(k, 0.6, 15.12, 19.38, EXT, sw, [], {}, WALL_H);
  const breaker = K.breakerPanel(k, [1.5, 1.35, 19.38], [0, -1]);                  // faces north, into the shed (lighting.ts stands its man north of the panel)
  K.add(k, { c: [1.6, 0.45, 15.75], h: [0.75, 0.45, 0.4], albedo: [0.5, 0.42, 0.1] });   // the generator set on its skid, against the north wall
  K.add(k, { c: [1.6, 0.94, 15.75], h: [0.5, 0.04, 0.3], albedo: C.black });
  K.add(k, { c: [2.37, 0.6, 15.75], h: [0.015, 0.02, 0.02], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });   // its running lamp
  K.add(k, { c: [3.45, 0.3, 15.6], h: [0.2, 0.3, 0.2], albedo: C.red });           // a fuel can

  // ---------------- rooms ----------------
  K.grp(k, 'west');                                                                 // the guard room: cots, a table, a hurricane lantern
  for (const z of [7.0, 8.4]) { K.add(k, { c: [9.75, 0.2, z], h: [0.45, 0.2, 0.95 / 2 + 0.2], albedo: [0.28, 0.3, 0.22] }); }
  K.desk(k, 11.2, 10.6, 1.4, 0.8, 0, C.woodDark); K.chair(k, 11.2, 9.9, Math.PI); K.chair(k, 10.3, 11.6, 0.4);
  K.cabinet(k, 15.6, 7.0, -Math.PI / 2);
  K.bulb(k, 12.5, 9.5, 'bulb_west', 'west', true);
  K.grp(k, 'hall');
  K.bench(k, 21.6, 11.2, -Math.PI / 2); K.bin(k, 16.5, 6.6);
  K.bulb(k, 19.0, 9.5, 'bulb_hall', 'hall', true);
  K.grp(k, 'east');                                                                 // the radio room: the set on a bench under the mast, crates
  K.desk(k, 24.6, 6.6, 1.8, 0.7, 0, C.metal); K.monitor(k, 24.2, 6.5, 0, false, 0.76, false); K.chair(k, 24.6, 7.4, 0);
  K.cardboardBox(k, 26.9, 11.9, 0.5, 0.2); K.cardboardBox(k, 26.85, 11.2, 0.45, -0.3);
  K.bulb(k, 24.7, 9.5, 'bulb_east', 'east', true);
  K.grp(k, 'store');
  K.shelf(k, 30.55, 8.6, 2.4, 0.5, Math.PI / 2, 4, 2.0);
  let rackFront: Vec3 = [0, 0, 0];
  rackFront = K.rack(k, 27.9, 10.6, 0, false);                                      // the level's one mission thread hangs on this cabinet: on the west wall, its front (the kit's: +z) on open floor
  K.cardboardBox(k, 29.0, 12.45, 0.5, 0.1);
  K.bulb(k, 29.2, 9.5, 'bulb_store', 'store', true);

  // ---------------- the yard ----------------
  K.grp(k, 'yard');
  K.car(k, 11.0, 19.6, Math.PI / 2 + 0.08, [0.5, 0.47, 0.4]);                       // a pickup, west of the gate's line
  for (const [x, z] of [[27.0, 18.2], [27.7, 18.5], [27.2, 18.95]]) K.add(k, { c: [x, 0.45, z], h: [0.29, 0.45, 0.29], albedo: [0.2, 0.3, 0.42] });   // fuel drums, east of it
  for (let i = 0; i < 3; i++) K.add(k, { c: [16.2 + i * 0.62, 0.3, 13.6], h: [0.3, 0.3, 0.2], albedo: [0.5, 0.45, 0.33] });   // sandbags under the eaves west of the front door
  K.add(k, { c: [21.6, 3.05, 13.3], h: [0.05, 3.05, 0.05], albedo: C.metal });     // the radio mast, up the front wall east of the door

  // ---------------- lights ----------------
  K.grp(k, 'lights');
  // three floodlights on the south eaves, thrown out and down over the yard: on the MAINS (the level's point)
  for (const [i, x] of [11.0, 19.0, 27.5].entries()) {
    K.add(k, { c: [x, 2.95, 13.2], h: [0.03, 0.03, 0.1], albedo: C.metal });
    const head = K.add(k, { c: [x, 2.95, 13.36], h: [0.16, 0.1, 0.06], albedo: C.metal, emissive: [34, 31, 24], flags: BoxFlag.NoShadow });
    k.lights.push({ kind: 'spot', pos: [x, 2.92, 13.46], dir: [0, -0.5, 1], color: [1.0, 0.92, 0.78], intensity: 300, range: 24, innerDeg: 40, outerDeg: 68,
      name: `flood_${['w', 'c', 'e'][i]}`, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.16, broad: true });
  }
  // on batteries, and too dim for a bare eye: the mast's red obstruction lamp over the yard, a hurricane lantern in each room
  { const lamp = K.add(k, { c: [21.6, 6.04, 13.42], h: [0.06, 0.06, 0.06], albedo: C.red, emissive: [6, 0.4, 0.2], flags: BoxFlag.NoShadow });
    k.lights.push({ kind: 'point', pos: [21.6, 6.1, 13.6], dir: [0, -1, 0], color: [1.0, 0.16, 0.1], intensity: 6, range: 34, innerDeg: 0, outerDeg: 180,
      name: 'mast_lamp', group: 'battery', enabled: true, volumetric: 0, fixtureBox: lamp, radius: 0.06, mains: false }); }
  for (const [name, x, z, y] of [['lantern_west', 11.2, 10.6, 0.76], ['lantern_hall', 16.5, 7.4, 0], ['lantern_east', 26.9, 11.55, 0.5], ['lantern_store', 29.0, 12.45, 0.5]] as const) {
    K.add(k, { c: [x, y + 0.02, z], h: [0.06, 0.02, 0.06], albedo: C.black });
    const glass = K.add(k, { c: [x, y + 0.13, z], h: [0.04, 0.09, 0.04], albedo: C.white, emissive: [3, 1.8, 0.6], flags: BoxFlag.NoShadow });
    k.lights.push({ kind: 'point', pos: [x, y + 0.16, z], dir: [0, -1, 0], color: [1.0, 0.6, 0.25], intensity: 6, range: 7, innerDeg: 0, outerDeg: 180,
      name, group: 'battery', enabled: true, volumetric: 0.1, fixtureBox: glass, radius: 0.05, mains: false });
  }
  K.moon(k, undefined, 0.04);                                                       // an overcast night (see the head)

  // ---------------- LIVED IN (src/scene/lived.ts: all of it goes with the switch off — group 'lived.<room>', props 'lived.<room>.<thing>'; LAST, after every kept thing) ----------------
  // A fuel post run by seven men off one generator, and each room is what its men do there: the guard room is where they SLEEP (coats on the wall, boots by
  // the cots, the tea chest and its kettle), the hall is the POST's (fire buckets, the waterproofs by the door they go out of), the radio room has the MAST's
  // spare sections on the wall and the battery crate, the store the SACKS and the bucket, the shed the GENERATOR's (the can crate, a funnel bucket, overalls).
  // The yard stays clear but for two cones inside the gate. Nothing stands within 1.1 m of a door's line, on a defender's mark or in his line, on the place a
  // man throws the breaker from, or on a surface the dressing deals on (tools/levels/dress.ts).
  { const P = livedPieces({ add: b => K.add(k, b), grp: n => K.grp(k, n), prop: (...a) => K.prop(k, ...a) }, C), W = Math.PI / 2;
    P.room('west');
    P.hooks(13.2, 6.13, 0, 3, 1.6, [INK.canvas, INK.navy, INK.canvas]);            // coats on the north wall
    P.boots(9.6, 9.75, W, 2);                                                       // at the foot of the cots
    P.crate(9.6, 12.4, 0.45, 0.1, C.wood, null, 'teachest'); P.kettle(9.6, 0.45, 12.4, 0.6);
    P.room('hall');
    P.rail(18.4, 6.13, 0, 3, 0.95, 0.24, 0.26, 0.24, C.red);                         // fire buckets, clear of the lockers
    P.hooks(20.3, 6.13, 0, 2, 1.6, [INK.hivis, INK.canvas]);                        // the waterproofs
    P.counter(17.35, 7.0, 0.45, 1.7, 0, 1.8, C.metal, C.metal);                      // the post's lockers, end on to the back wall (what they do to the fight: below)
    // THE LOCKERS SHADE THE HALL'S LANTERN (the maintainer's pick of 10-16, "Hall lockers"). The lantern stands on the floor in the corner west of them, so with
    // the mains out it lights the guard room's side and a wedge towards the front door, and the back wall, the far corner and the radio room's door are black
    // to a bare eye (floodlit-check reads both). That shade, not cover, is all they do to the fight; how much it is worth has moved with the goggles' infrared
    // light and is in docs/agents/missions.md. Move the lockers or the lantern and the tallies move.
    P.room('east');
    P.poles(22.12, 1.28, 12.05, W, 3, 1.0, 0.07);                                    // the mast's spare sections, on brackets on the west wall
    P.crate(22.5, 12.45, 0.4, 0.1, C.wood, INK.iron, 'batteries');
    P.room('store');
    P.sack(27.95, 12.3, W); P.sack(28.4, 12.4, W + 0.12);
    P.bucket(30.6, 11.2);
    // LAMPS OUTSIDE THE WALL, lived things too (a LIGHT whose id starts 'lived.', its head a box of the room's group: both go with the switch) and on the
    // MAINS like the floodlights (10-15, the maintainer at the start with the lights on: "lighting looks very flat here"). With the moon at 0.04 and no lamp
    // out there the ground outside the wall had the sky's even fill and nothing else — no pool, no shadow, the men one grey with the wall (the depot and the
    // pass have thin moons too, and lamps outside). The moon stays (it is what keeps the yard black with the mains out); these go out with the floodlights,
    // so the dark is as dark as it was. A bulkhead lamp on the outer face of each gate post, thrown out and along the wall away from the gate, and one over
    // the shed's door. THE GATE LAMPS' STRENGTH IS HELD UNDER THE TEAM'S GOGGLES' LINE: every start mark reads under 0.45 (nvg.ts NVG.darkAt is 0.5 — at 50
    // the five marks read 0.29‥0.62 and the team stood up half goggled, half bare-eyed), Sam's about 0.3. Nobody in the building has a line to a start mark
    // or to the shed's door (tools/qa/floodlit-check.ts asks both). TRIED AND LEFT OUT: a third lamp at the wall's south-west corner to light the team from both sides — it
    // sits 2.6 m from the nearest mark and 5 from Sam's, so any strength that lifts Sam's reading (0.25 → 0.39 at 8) takes the near man over the line (0.53).
    const lamp = (name: string, x: number, y: number, face: number, dir: Vec3, intensity: number, range: number, outerDeg: number, color: Vec3) => {
      const head = K.add(k, { c: [x, y, face + 0.04], h: [0.1, 0.06, 0.04], albedo: C.metal, emissive: [30, 22, 12], flags: BoxFlag.NoShadow });   // on a wall's south face
      k.lights.push({ kind: 'spot', pos: [x, y - 0.04, face + 0.12], dir, color, intensity, range, innerDeg: 30, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.15, fixtureBox: head, radius: 0.08 });
    };
    P.room('shed');
    P.crate(3.4, 16.6, 0.4, 0.2, C.wood, INK.yellow, 'cans');
    P.bucket(0.95, 17.0, C.metal, 'funnel');
    P.hooks(0.73, 17.7, W, 2, 1.6, [INK.canvas, INK.rubber]);                       // overalls on the west wall
    lamp('lived.shed.door_lamp', 2.9, 2.4, 19.62, [0.15, -0.9, 0.4], 30, 8, 75, [1.0, 0.8, 0.55]);
    P.room('yard');
    P.cone(17.9, 23.5); P.cone(22.1, 23.5);                                         // inside the gate, off its opening
    for (const [n, x, sx] of [['w', 18.38, -1], ['e', 21.62, 1]] as const) lamp(`lived.yard.gate_lamp_${n}`, x, 2.46, 24.16, [0.75 * sx, -0.45, 0.35], 17, 16, 70, [1.0, 0.75, 0.45]);
  }

  const level: Level = K.kitLevel(k, {
    playerSpawn: FLOODLIT_START,
    routes: [],
    breaker,
    sky: { zenith: [0.012, 0.02, 0.04], horizon: [0.03, 0.04, 0.065] },
    mission: { serverRoom: { ...FLOODLIT_ROOMS.store.bounds }, entryDoor: 'store', rack: { index: 0, front: rackFront, halfW: 0.33 }, exfilDoor: 'foot_gate', exfilX: 3.5, exfilZ: 21.8, exfilOut: [-1, 0] },
  });
  // ---------------- what is underfoot (game/floor.ts: which footstep sounds, and how far it carries to their ears) — the slabs under 'ground' and 'floors'
  // above. `building` is the whole world so the plan is all zones (first match wins). The yard's packed earth, the shed's floor and the ground outside the
  // wall are 'asphalt' (the nearest the six have to earth); the building stands on a concrete slab ('stone') with lino laid in the hall.
  const surfaces: SurfacesData = {
    building: { x0: 0, x1: 40, z0: 0, z1: 28 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'hall', mat: 'lino', x0: 16.06, z0: 6.12, x1: 21.94, z1: 12.88 },
      { id: 'slab', mat: 'stone', x0: 9, z0: 6, x1: 31, z1: 13 },
    ],
  };
  return { level, scenarios: FLOODLIT_SCENARIOS, groups: k.groups, surfaces };
}
