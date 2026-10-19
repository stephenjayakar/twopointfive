// THE RELAY STATION: a quiet level for TWO (the player and one partner). A hilltop comms relay of the 2010s wars at night: a walled compound, an antenna
// mast whose two floodlights wash the face of the hut block, a comms hut full of equipment racks joined to an ops room, a generator shed with the breaker,
// a bunk hut, a fuel point, two pickups. No story: a place, a thing to take ("the crypto drive"), four gates.
// THE LEVEL'S ONE IDEA: THE LONG WAY ROUND — both doors of the hut block are watched from the far side of the light. One of the two goes round to the watcher in
// the dark; the other is already at the door when he drops. (The border crossing is two men down on one beat; this is one man down and one man through.)
//   bun run tools/levels/export.ts quiet-relay [--check]     → levels/quiet-relay.json
//   bun run tools/qa/quiet-check.ts quiet-relay.json         the scenarios.quiet block against the built floor, every deal
//   bun run tools/qa/quiet-light.ts quiet-relay              the light a sneaking man stands in, on paper
//   bun run tools/qa/quiet-pair.ts --level quiet-relay.json --seeds 1-48      the scripted pair beside the same run alone
//   page: ?levelFile=quiet-relay.json&quiet&squad=1          (&quiet=N pins the deal; without &squad=1 it is played alone)
//
//          x 4        10    14        20        27  29        36
//    z 4   +----------+--------------[gate_n]---------+--------+
//          | bunk hut b  s  back strip (dark; the walker's beat)| fuel point: canopy,
//          | L  cots  |                                 pallets| drums, a pickup  (lamp)
//    z 9   +----------+     +-----------------------+          |
//          |  wash line     | COMMS HUT c  OPS ROOM |  dishes  == gate_e   (dark)
//  gate_w ==  hesco   tank  | racks  R  o  table  S |  pickup  |
//   (dark) |  west yard     | (lamp,cam)| radio (lamp)|  east  |
//    z14.5 |   (dark)       +--[comms]--+--[ops]----+T yard    |
//          | ☼lamp            bulb+cam   L I T   F A C E  T (dark)|   the two floods are ON THE MAST and throw NORTH: the block's face,
//          |   ↘             · · · the mast yard, lit · · ·  T  |   both doors and the yard before them are lit
//    z19.5 +--[shed]--+        ▫ guy     MAST☼☼    ▫ guy        |
//          | gen  (B) |  south band (DARK)   ▫ guy    P         |   P the picket, looking north out of the dark past the wall's end
//          |          |      ╞═══ the gate's blast wall ═══╡    |   behind the wall: a dark alley from the wicket to the picket's back
//    z 24  +----------+-------------[gate_s]-------------------+
//                       W ← ← ← A  (lamp)                     a pickup
//                         barrier            barrier          the road (dark past the lamp)
//   R the rack (spot 0) · S the safe (spot 1) · L the locker (spot 2) · (B) the breaker · c 'comms_ops' the door between the two rooms
//   P the picket's stand · A the gate man's stand, W the far end of his beat · s the bunk man's smoke · T the T-walls off the ops room's corner
//
// THE LONG WAY ROUND (each numbered thing is one way in of several):
//
// 1. THE LIT FACE AND THE PICKET. The mast's two floods (flood_w, flood_e: on the mains) throw north: the hut block's south face, its two doors ('comms',
//    'ops') and the yard in front of them are lit from the block's west corner to the T-walls off its east one. Those two doors are the only doors the
//    block has. Behind the mast everything is dark, and in that dark, at the east end of the gate's blast wall, stands the picket (26.8, 21.3): the best
//    part of two minutes at a time looking NORTH across the yard, his head sweeping: the face and both doors are at the west end of each sweep, then a few paces east and back round. A man at
//    either door is a lit man in front of him. His back is the mouth of the alley behind the blast wall: seven T-wall sections inside the wicket, parallel
//    to the compound wall, with a dark alley a man and a half wide between the two — the far side of the whole yard from the doors. THE PAIR: one waits at
//    the yard's dark edge (the block's west corner; behind the T-walls off its east corner; the blast wall's west end); the other is sent round by the
//    dark — down the west yard and along the alley, in by the wicket, or down the east yard — to the picket's back (X on him, 1; F when he says 'set'),
//    and the first is across the light and at the door while the picket is still going down. ALONE: go round to the picket yourself and come all the way
//    back; or the breaker (the shed's door is under lamp_west) and a man coming to reset it; or shoot a flood and cross its half; or the ten seconds he
//    is off his stand, once in two minutes. THE CLOCK ON IT (the engine's, every level's): the net's radio check, a minute and a half apart — a man who
//    does not answer is looked for on his route. A picket dropped just after a check buys a minute and a half; one dropped just before buys ten seconds.
//
// 2. THE GATE AND THE ALLEY. The compound's main gate is shut for the night; its wicket (gate_s, x 19.4 to 20.6) is the way in off the road, and it opens
//    into the alley behind the blast wall: a man coming in turns along the wall to one end or the other, unseen from the yard (the gate lamp hangs outside the
//    wall: the alley is dark). West is the yard's dark edge; east is the picket's back. The gate man stands at A (18.6, 25.0) under lamp_gate facing EAST, the
//    wicket a stride in front of him, twenty-two seconds at a time, then walks six metres west along the wall and looks down the road for fourteen. From
//    the road start he is looking at you. THE PAIR: the partner goes round — the road's dark south edge, behind the two barriers — to his back; the player
//    is at the wicket when he drops. ALONE: the twenty-odd seconds he is off west, or a side gate.
//
// 3. THE COMMS HUT'S DOOR: A CAMERA, A LOCK AND THE PICKET'S EYE. 'comms' (x 16.3 to 17.5 in the block's south wall) is locked (the pick: 4.2 s kneeling)
//    in the floods' light and under bulb_comms, with cam_door on the wall beside it (on its own battery). THE PAIR: with the picket down, the camera goes
//    out (the OCP: nine seconds) and the lock is four seconds on a knee. ALONE: all of it on the picket's clock, or the ops room's door and the door
//    between the rooms. Inside, cam_server (mains) watches the racks from the hut's south-east corner under lamp_comms.
//
// THE OPS ROOM: the ops man is indoors — thirty-five seconds at the radio desk with his back to both of the room's doors, then round the map table to the safe.
// THE WALKER has the block's back: eight seconds at the back strip's west end looking at the bunk hut, along the strip, ten seconds at the pallets
// looking down the east yard, and back. He does not come round to the lit face (that is the picket's) — but a man left lying on the strip is found by him.
// (His west stand is a few strides from the bunk man's smoke: when the two coincide they stop and talk — the game's own chatter — and their clocks hold while they do.)
// THE WAYS IN: gate_s (2) · gate_w (dark inside; the lamp there is turned on the shed's door) · gate_n (dark, onto the back strip: the walker's beat, and
// no door of the block's opens on it) · gate_e (dark; the fuel man stands by it on one set). THE WAYS TO THE RACKS AND THE SAFE: 'comms' and 'ops', both
// on the lit face (1, 3); the door between the rooms.
// THE BUNK HUT (spot 2): the bunk man is on every set and cannot sleep — fifty seconds smoking at the north wall outside his door with his back to it,
// then in to his cot for twelve, and out again. The hut is empty most of the time; its door is four strides behind a man who looks about him.
// THE LIGHTS: on the MAINS (the breaker in the shed takes them all): flood_w, flood_e, lamp_gate, lamp_west, bulb_comms, lamp_comms, lamp_ops, lamp_fuel,
// lamp_shed, cam_server. On their own: lantern_bunk, cam_door, the holders' tell-tales. Every named light is a target for a round or the OCP.
// THE SEVEN BEATS (RELAY_ROUTES, one line each there) and THE THREE SETS (QUIET.patrols): the gate man, the picket, the ops man, the walker and the bunk
// man are on every set: 0 is those five · 1 adds the generator man: twelve seconds in the shed at his set (the breaker at his elbow), then out to the alley's west mouth to look east down it for
// eight — the long way round has an eye on it (the floor at the picket's back is at its far end; the wall hides the picket himself from him) and the breaker has a keeper · 2 adds the fuel man, a second eye on the picket's back from the east, who
// will also find him lying there. Every man starts his lap at its first waypoint on the first frame: the picket is on his stand from the second second.
// HAND-SET: the mission is the first of each list — the west track, the rack in the comms hut, set 0. The other deals stay in the file (?quiet=N):
// three starts (the west track · the north slope · the road itself, in the dark east of the pickup left on it: from there the gate man is looking
// your way and the wicket is the short way in), three spots (the rack in the comms hut · the safe in the ops room · the locker in the bunk hut), three sets,
// four ways out (east · west · north · the wicket), all open every run.
//
// NOT SEEN ON A GPU: laid out on paper and checked headless (validator, level-lint, quiet-check, quiet-light, the scripted solo night and pair), one still
// on the software renderer. Nobody has played it. In the GWOT kit (src/scene/gwotKit.ts): walls, ground, furniture and yard pieces are the kit's; the mast, the racks, the
// safe, the locker and the lamps are this file's own boxes in the kit's paint. Units: metres. +X east, +Z south, +Y up.
import type { Vec3 } from '../../src/math/vec';
import type { DeviceDef, Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, QuietData, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { livedQuiet } from './lived-quiet';

export const NAME = 'quiet-relay';
export const NOTES = 'The relay station at night, for a pair sneaking: a walled hilltop compound, an antenna mast whose two floodlights wash the face of the hut block (a comms hut joined to an ops room), a generator shed with the breaker, a bunk hut, a fuel point, two pickups. Its one idea: the long way round — both doors are on the lit face, watched by a picket in the dark behind the mast; one of the pair goes round by the alley behind the gate\'s blast wall to his back while the other waits at the door. Seven beats authored, five or six manned a deal; two cameras; four gates. Regenerate: bun run tools/levels/export.ts quiet-relay';
/** the kit's palette goes into the file's `materials` (tools/levels/export.ts) */
export const MATERIALS = GWOT_MATERIALS;

/** The floor inside each roofed space's walls (shells 0.24 thick, the partition 0.12). */
export const RELAY_ROOMS: Record<'comms' | 'ops' | 'bunk' | 'shed', Rect> = {
  comms: { x0: 14.12, x1: 19.94, z0: 9.12, z1: 14.38 },
  ops: { x0: 20.06, x1: 26.88, z0: 9.12, z1: 14.38 },
  bunk: { x0: 4.12, x1: 9.88, z0: 4.12, z1: 8.88 },
  shed: { x0: 4.12, x1: 9.38, z0: 19.62, z1: 23.88 },
};
const R = RELAY_ROOMS;

/** THE SEVEN BEATS (level.routes: the union of every patrol set; seven and no more — a level's men are named off game.ts CALLSIGNS by route, which holds seven). A waypoint with a wait is where he stands and looks; he faces the way he arrived.
 *  ON THE FIRST LAP a man stands on waypoint 0 from the first frame and has not 'arrived' from anywhere (he faces down his first leg, or wherever a settling step leaves him): so every long stand
 *  here is waypoint 1 or later, behind a lead-in waypoint with no wait a stride short of it, and is come at on the first lap as on every other. (The walker's and the fuel man's short first stands are not.)
 *  The route called 'mast' is the generator man's (it keeps its first name: sets and traces say 'mast'). */
export const RELAY_ROUTES: PatrolRoute[] = [
  // the gate man, outside on the road: stands at A under the gate lamp facing east (he arrives from the west), the wicket a stride in front of him; six
  // metres out west along the wall, fourteen seconds looking down the road, and back. His back is the dark road west of the lamp — from the road start,
  // the far side of him
  { name: 'gate', points: [[17.4, 0, 25.0], [18.6, 0, 25.0], [12.6, 0, 25.2]], wait: [0, 22, 14] },
  // THE PICKET: in the dark behind the mast, at the east end of the gate's blast wall: a hundred and ten seconds looking NORTH across the yard, his head
  // sweeping — the lit face of the hut block and both of its doors are at the west end of each sweep — then a few paces east and back round by the lead-in.
  // His back is the east mouth of the alley behind the blast wall: the far side of the light from the doors
  // (THE LAP STARTS ON THE LEAD-IN, a stride and a half due SOUTH of the stand: he is on his stand looking north from the second second of a run and has looked nowhere
  //  else first. It used to start at the east end of the few paces: ten seconds looking south-west and west before the first stand, and a partner ordered to his
  //  back in that time — pairorders.ts goes for the back of the way a man MOSTLY faces — was sent to his EAST side, across the dark band in front of him and
  //  into the near field of his eye when he looked north. THE LEAD-IN IS DUE SOUTH ON PURPOSE: a standing man keeps the yaw of the leg he walked in by
  //  (guards.ts never turns him on a stand), and pairorders.ts calls the floor inside 2.4 m of a man whose head sweeps watched, all but 25 degrees either
  //  side of dead astern. From the south-east (27.6, 22.4) he faced 36 to 51 degrees west of north and the strip behind the blast wall came out 45 degrees off
  //  his stern: an early order onto him never set. From due south the strip is inside the free wedge and the first order sets. The price: the lit door is
  //  53 degrees off his axis, so on his own (door camera out) he is about a second slower onto a man there.)
  { name: 'picket', points: [[26.8, 0, 22.66], [26.8, 0, 21.3], [29.4, 0, 21.2]], wait: [0, 110, 4] },
  // the ops man, indoors: thirty-five seconds at the radio desk with his back to the room and both of its doors, round the map table to the safe, and back
  { name: 'ops', points: [[22.7, 0, 12.4], [25.2, 0, 13.3], [22.7, 0, 12.4], [25.7, 0, 10.9], [25.7, 0, 10.3]], wait: [0, 35, 0, 0, 6] },
  // the walker: the block's back, there and back — eight seconds at the back strip's west end looking at the bunk hut, along the strip, ten seconds at the
  // pallets looking down the east yard. Not the lit face: that is the picket's
  { name: 'walker', points: [[16.6, 0, 7.4], [27.0, 0, 7.8], [28.7, 0, 9.6]], wait: [8, 0, 10] },
  // the fuel man: the pump under the canopy's lamp → the east gate's inside → down the east wall to the pickup's tail, eight seconds looking WEST along the
  // south band — the picket's back is in his eye from there (the second eye, from the east); the blast wall keeps the alley and the wicket out of it
  { name: 'fuel', points: [[31.6, 0, 9.3], [34.3, 0, 12.8], [34.4, 0, 19.3], [32.7, 0, 19.3]], wait: [10, 6, 0, 8] },
  // the generator man: twelve seconds in the shed facing his set (he comes in by the door, the breaker at his elbow) → out of the shed's door → along the
  // south band to the west mouth of the alley behind the blast wall, eight seconds looking EAST down it — the wicket and the floor at the picket's back
  // are in his eye from there (the eye on the long way round; the wall hides the picket himself) → back in
  { name: 'mast', points: [[6.8, 0, 20.1], [6.8, 0, 21.2], [6.8, 0, 18.6], [16.9, 0, 22.9], [6.8, 0, 18.6]], wait: [0, 12, 0, 8, 0] },
  // the bunk man, off watch and not sleeping: out of his door and up to the north wall for a smoke (fifty seconds, his back to the hut's door and the
  // yard), in to his cot for twelve, and out again. (The first waypoint is a stride south of the smoke so that he comes onto it facing the wall.)
  { name: 'bunk', points: [[13.8, 0, 7.0], [13.8, 0, 5.3], [8.4, 0, 5.6]], wait: [0, 50, 12] },
];

/** scenarios.quiet. spots[0] + exits[0] is `level.mission`, starts[0] is `level.playerSpawn`; `level.routes` is every route the sets name. */
export const QUIET: QuietData = {
  thing: 'the crypto drive',
  starts: [
    // HAND-SET (the first of each list IS the mission; the others stay reachable by ?quiet=N): the west track. The west gate is dark inside; the short walk east from it
    // runs onto the lit face in the picket's eye; the block's west corner is the place to wait; the alley behind the blast wall is the partner's long way round; the
    // shed and its breaker are the other answer, a few strides south under lamp_west
    { name: 'the track', sam: [1.8, 0, 16.6], samYaw: Math.PI / 2, mate: [1.8, 0, 17.8] },
    { name: 'the slope', sam: [24.6, 0, 1.8], samYaw: 0, mate: [25.8, 0, 1.6] },
    { name: 'the road', sam: [35.2, 0, 27.1], samYaw: -Math.PI / 2, mate: [36.4, 0, 27.2] },
  ],
  spots: [
    { place: 'the comms hut', area: R.comms, door: 'comms', holder: 'the middle rack', rackIndex: 0, front: [16.0, 1.0, 9.77], halfW: 0.4, wired: true },   // (on the station's network: pulled, it drops off a board and a man is sent — game/takecheck.ts; a safe and a locker tell nobody)
    { place: 'the ops room', area: R.ops, door: 'ops', holder: 'the safe', rackIndex: 1, front: [25.9, 1.0, 9.77], halfW: 0.3 },
    { place: 'the bunk hut', area: R.bunk, door: 'bunk', holder: 'the steel locker', rackIndex: 2, front: [4.77, 1.0, 6.5], halfW: 0.3 },
  ],
  exits: [
    { name: 'the dish gate', door: 'gate_e', x: 36.0, z: 11.9, out: [1, 0] },
    { name: 'the track gate', door: 'gate_w', x: 4.0, z: 13.9, out: [-1, 0] },
    { name: 'the back strip gate', door: 'gate_n', x: 22.9, z: 4.0, out: [0, -1] },
    { name: 'the wicket', door: 'gate_s', x: 20.0, z: 24.0, out: [0, 1] },
  ],
  patrols: [
    ['gate', 'picket', 'ops', 'walker', 'bunk'],                    // 0: the picket alone on the light
    ['gate', 'picket', 'ops', 'walker', 'mast', 'bunk'],            // 1: an eye on the long way round (the generator man, at the alley's west mouth)
    ['gate', 'picket', 'ops', 'walker', 'fuel', 'bunk'],            // 2: a second eye on it from the east (the fuel man, at the east yard's south end)
  ],
};

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY, M = G.M;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;
  const DOOR = { y0: 0, y1: 2.2 };

  // ---------------- ground ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });                    // the hilltop: every ray and every foot lands on something
  G.ground(4, 4, 36, 24, 'dirt');                                        // packed earth inside the wall
  G.ground(0, 24.13, 40, 28, 'gravel');                                  // the road along the south wall
  G.ground(14.6, 14.63, 28.4, 20.4, 'gravel', 0.006);                    // the mast yard
  G.ruts(2, 26.2, 38, 26.2); G.ruts(29.6, 20.2, 31.4, 12.4);
  G.patch(8.0, 15.0, 2.6, 1.8, 'dust', 0.3); G.patch(31.6, 12.0, 1.6, 1.0, 'oil', 0.4); G.patch(24.0, 6.4, 3.0, 1.6, 'dust', -0.2); G.patch(32.4, 8.9, 1.4, 0.8, 'oil', 0.2);
  grp('floors');
  G.ground(14, 9, 27, 14.5, 'slab', 0.006);                              // the hut block: a poured slab
  G.ground(4, 4, 10, 9, 'mudFloor', 0.006);                              // the bunk hut: beaten earth
  G.ground(4, 19.5, 9.5, 24, 'slab', 0.006);                             // the generator shed
  G.ground(29.6, 4.13, 35.87, 8.5, 'slab', 0.006);                       // the fuel point's pad

  // ---------------- roofs (light-only: the camera looks through them): four ----------------
  grp('ceiling');
  const roof = { flags: BoxFlag.NoPrimary, rough: 0.9 };
  slab(13.9, H, 8.9, 27.1, H + 0.2, 14.6, P.render, roof);               // the hut block
  slab(3.9, H, 3.9, 10.1, H + 0.2, 9.1, P.mudLight, roof);               // the bunk hut
  slab(3.9, H, 19.4, 9.6, H + 0.2, 24.1, P.render, roof);                // the generator shed
  slab(29.5, H, 4.1, 35.9, H + 0.12, 8.5, P.tin, roof);                  // the fuel point's tin canopy

  // ---------------- the compound wall (2.4 m, coped; to the roof where a hut stands against it) and its four leaves ----------------
  // (every doorway is 1.2 m wide and cut 0.2 m before a whole or a half metre: the nav grid's half-metre cells then have a free one in it)
  grp('walls.yard');
  G.wallX(4, 3.88, 10.12, 'mud');                                                        // north, behind the bunk hut
  G.yardWallX(4, 10.12, 36.12, 'mud', [{ a: 22.3, b: 23.5, ...DOOR }]);                  // north: gate_n onto the back strip
  G.wallX(24, 3.88, 9.62, 'mud');                                                        // south, behind the shed
  G.yardWallX(24, 9.62, 36.12, 'mud', [{ a: 19.4, b: 20.6, ...DOOR }]);                  // south: the wicket in the shut main gate
  G.wallZ(4, 4.12, 9.12, 'mud');                                                         // west, behind the bunk hut
  G.yardWallZ(4, 9.12, 19.38, 'mud', [{ a: 13.3, b: 14.5, ...DOOR }]);                   // west: gate_w
  G.wallZ(4, 19.38, 23.88, 'mud');                                                       // west, behind the shed
  G.yardWallZ(36, 4.12, 23.88, 'mud', [{ a: 11.3, b: 12.5, ...DOOR }]);                  // east: gate_e
  for (const [x, z] of [[18.3, 24], [21.7, 24], [36, 4], [36, 24], [28, 24], [13, 24], [36, 17], [16, 4], [29.2, 4], [4, 11.4], [4, 16.6]] as const) G.pier(x, z);
  // the main gate's two sheet-metal leaves, shut and barred for the night: paint on the wall either side of the wicket, both faces
  for (const side of [1, -1] as const) { G.skirt('x', 24, 18.54, 19.36, side, 'paintBlue', 2.2); G.skirt('x', 24, 20.64, 21.46, side, 'paintBlue', 2.2); }
  G.skirt('x', 24, 9.7, 18.0, 1); G.skirt('x', 24, 22.0, 36, 1); G.skirt('z', 4, 9.2, 13.2, -1); G.skirt('z', 4, 14.6, 19.3, -1); G.skirt('x', 4, 10.2, 22.2, 1); G.skirt('x', 4, 23.6, 29.0, 1);   // the damp foot of the wall

  // ---------------- the hut block: the comms hut (west) and the ops room (east) under one roof ----------------
  grp('walls.block');
  G.wallX(9, 13.88, 27.12, 'render');                                                      // north: no door — the block's two doors are both on the lit face
  G.wallX(14.5, 13.88, 27.12, 'render', [{ a: 16.3, b: 17.5, ...DOOR }, { a: 22.3, b: 23.5, ...DOOR }]);   // south: 'comms' and 'ops', onto the mast yard
  G.wallZ(14, 9.12, 14.38, 'render'); G.wallZ(27, 9.12, 14.38, 'render');
  G.partZ(20, 9.12, 14.38, 'whitewash', [{ a: 10.3, b: 11.5 }]);                          // comms | ops: 'comms_ops'
  G.skirt('x', 14.5, 14, 16.2, 1); G.skirt('x', 14.5, 17.6, 22.2, 1); G.skirt('x', 14.5, 23.6, 27, 1);
  // ---------------- the bunk hut (north-west corner) and the generator shed (south-west corner): their other sides are the compound wall ----------------
  grp('walls.huts');
  G.wallX(9, 3.88, 10.12, 'mud'); G.wallZ(10, 4.12, 8.88, 'mud', [{ a: 6.3, b: 7.5, ...DOOR }]);        // the bunk hut: its door east, onto the back strip's west end
  G.wallX(19.5, 3.88, 9.62, 'block', [{ a: 6.3, b: 7.5, ...DOOR }]); G.wallZ(9.5, 19.62, 23.88, 'block');   // the shed: its door north, onto the dark west yard

  // ---------------- this file's own pieces, in the kit's paint ----------------
  /** an equipment rack, 0.8 wide, 2 m: its face on +z (north-wall racks) or +x (west-wall racks): panels, a row of tell-tales */
  const rack = (x: number, z: number, faceX = false) => {
    const h: Vec3 = faceX ? [0.3, 1.0, 0.4] : [0.4, 1.0, 0.3];
    add({ c: [x, 1.0, z], h, ...M.olive });
    for (let k = 0; k < 4; k++) { const y = 0.45 + k * 0.42;
      add({ c: faceX ? [x + 0.303, y, z] : [x, y, z + 0.303], h: faceX ? [0.004, 0.16, 0.34] : [0.34, 0.16, 0.004], ...(k % 2 ? M.plasticBlack : M.iron), flags: BoxFlag.NoShadow }); }
  };
  /** a lamp on a pole thrown along `dir` (an XZ unit vector): a tight pool, on the mains */
  const lampAt = (x: number, z: number, name: string, dir: [number, number], outerDeg = 42, intensity = 120, height = 5.05, color: Vec3 = [1.0, 0.62, 0.22], tilt = 0.35) => {
    const yawL = Math.atan2(dir[0], dir[1]), dx = dir[0], dz = dir[1];
    add({ c: [x, (height + 0.15) / 2, z], h: [0.05, (height + 0.15) / 2, 0.05], ...M.galv });
    add({ c: [x + dx * 0.28, height + 0.19, z + dz * 0.28], h: [0.035, 0.035, 0.32], yaw: yawL, ...M.galv });
    add({ c: [x + dx * 0.55, height + 0.17, z + dz * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, ...M.plasticBlack });
    const head = add({ c: [x + dx * 0.55, height + 0.1, z + dz * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, ...M.plasticWhite, emissive: [color[0] * 40, color[1] * 40, color[2] * 40], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dx * 0.55, height, z + dz * 0.55], dir: norm([dx * tilt, -1, dz * tilt]), color, intensity, range: 14, innerDeg: outerDeg - 14, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: true, broad: true });
  };
  /** a shaded lamp hung under a roof or on a wall bracket, straight down: a small pool, on the mains */
  const downLamp = (x: number, y: number, z: number, name: string, group: string, outerDeg = 48, intensity = 22) => {
    add({ c: [x, y + 0.07, z], h: [0.1, 0.02, 0.1], ...M.tin, flags: BoxFlag.NoShadow });
    const fb = add({ c: [x, y + 0.02, z], h: [0.04, 0.03, 0.04], ...M.plasticWhite, emissive: [30, 21, 11], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, y - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.7, 0.42], intensity, range: 7, innerDeg: outerDeg - 16, outerDeg, name, group, enabled: true, volumetric: 0.2, fixtureBox: fb, radius: 0.06, mains: true });
  };

  // ---------------- the comms hut (x 14..20): racks on the north and west walls, a bench, the camera ----------------
  grp('room.comms');
  rack(15.1, 9.45); rack(16.0, 9.45); rack(16.9, 9.45);                                  // the middle one is THE RACK: spot 0
  rack(14.45, 11.7, true); rack(14.45, 12.6, true);
  add({ c: [15.55, 2.3, 9.3], h: [1.3, 0.03, 0.12], ...M.galv }); add({ c: [14.3, 2.3, 11.2], h: [0.12, 0.03, 2.0], ...M.galv });   // cable trays over the racks
  G.table(18.9, 13.5, 1.6, 0.7, 0);                                                      // the bench in the south-east corner, under the camera
  add({ c: [18.6, 0.87, 13.55], h: [0.3, 0.12, 0.2], ...M.olive }); add({ c: [19.3, 0.83, 13.5], h: [0.16, 0.08, 0.14], ...M.coyote });   // a set and a battery box on it
  G.plasticChair(18.4, 12.5, 2.6, 'plasticGreen');
  G.crates(14.75, 13.9, 0, 2);
  downLamp(16.4, H - 0.12, 10.9, 'lamp_comms', 'comms', 52, 24);                         // over the racks' fronts: the door end of the hut and its corners are dark
  // ---------------- the ops room (x 20..27): the map table, the radio desk, the safe ----------------
  grp('room.ops');
  G.table(24.6, 12.0, 1.8, 1.0, 0, 'ply');
  add({ c: [24.6, 0.757, 12.0], h: [0.7, 0.004, 0.4], ...M.whitewash, flags: BoxFlag.NoShadow });   // the map
  add({ c: [25.9, 0.55, 9.45], h: [0.36, 0.55, 0.3], ...M.iron });                        // THE SAFE, on the north wall: spot 1
  G.table(26.42, 13.2, 1.6, 0.7, HALF);                                                   // the radio desk on the east wall
  add({ c: [26.5, 0.92, 13.0], h: [0.18, 0.17, 0.3], ...M.olive }); add({ c: [26.5, 0.83, 13.6], h: [0.14, 0.08, 0.12], ...M.plasticBlack });
  G.plasticChair(25.8, 12.4, HALF); G.plasticChair(22.2, 9.75, 0.3, 'plasticBlue');                        // his chair pushed back from the set (he stands at it); the other by the cot, off his way to the safe
  G.trunk(20.55, 13.9, HALF, 'paintGreen');
  G.cot(23.6, 9.6, 0, false);                                                             // the duty cot against the north wall
  downLamp(24.8, H - 0.12, 12.2, 'lamp_ops', 'ops', 46, 22);                              // over the map table: the room's west end (its two doors: 'ops' and the one through to the comms hut) is dark
  // ---------------- the bunk hut (x 4..10, z 4..9): three cots, the steel locker, a lantern ----------------
  grp('room.bunk');
  G.cot(5.3, 4.6, 0); G.cot(8.5, 4.6, 0, true, 'blanketBrown'); G.cot(5.3, 8.4, 0, false);
  add({ c: [4.45, 1.0, 6.5], h: [0.3, 1.0, 0.49], ...M.olive });                          // THE STEEL LOCKER, on the west wall across from the door: spot 2
  add({ c: [4.754, 1.0, 6.5], h: [0.004, 0.9, 0.01], ...M.plasticBlack, flags: BoxFlag.NoShadow });
  G.trunk(9.3, 8.5, 0, 'paintBlue'); G.lantern(9.3, 8.5, 'lantern_bunk', 'bunk', 0.4);
  G.rug(7.3, 6.6, 2.4, 1.6, 'felt');
  // ---------------- the generator shed (x 4..9.5, z 19.5..24): the set, its fuel, THE BREAKER on the west wall ----------------
  grp('room.shed');
  G.generator(7.3, 23.1, 0); G.drum(8.95, 22.6, 'drumRed'); G.drum(8.95, 21.9, 'rust'); G.jerryCan(5.0, 23.4, 0.3); G.jerryCan(5.5, 23.5, -0.2, 'jerryYellow');
  const brk = add({ c: [4.16, 1.35, 21.4], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [4.21, 1.62, 21.22], h: [0.01, 0.015, 0.015], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [4.16, 2.3, 21.4], h: [0.03, 0.6, 0.03], ...M.iron, flags: BoxFlag.NoShadow });
  downLamp(6.9, H - 0.12, 21.5, 'lamp_shed', 'shed', 52, 22);

  // ---------------- the fuel point (north-east corner): a tin canopy, drums, a pickup taking fuel, a berm ----------------
  grp('fuel');
  for (const [px, pz] of [[29.7, 8.3], [35.6, 8.3], [29.7, 4.35]] as const) add({ c: [px, H / 2, pz], h: [0.05, H / 2, 0.05], ...M.galv });   // the canopy's posts
  G.pickup(32.7, 6.5, Math.PI, 'truckTan', { load: 'drums' });
  G.drums(30.3, 4.55, 2); G.drum(35.5, 4.6, 'drumRed'); G.drum(35.5, 5.3, 'drumBlue'); G.drumDown(34.6, 8.0, 0.2);
  G.jerryCan(30.3, 8.0, 0.4); G.jerryCan(30.8, 8.1, -0.3, 'jerryYellow');
  G.hesco(28.6, 6.0, 3, HALF);                                                            // the berm between the fuel and the back strip
  downLamp(32.6, H - 0.1, 8.0, 'lamp_fuel', 'fuel', 54, 26);                              // under the canopy's south edge, over the pump side of the pickup

  // ---------------- the mast and its yard ----------------
  grp('mast');
  const MX = 22.9, MZ = 18.2;
  G.ground(MX - 1.5, MZ - 1.5, MX + 1.5, MZ + 1.5, 'slab', 0.012);                       // its pad
  add({ c: [MX, 0.15, MZ], h: [0.5, 0.15, 0.5], ...M.slab });                             // its footing
  // three guys to anchor blocks out in the yard: from above the mast is the hub of a three-spoked wheel, and every place in the yard is 'east of the mast' or 'behind it'
  // (a box turns about the vertical only: each guy runs level to a stay post on its block)
  for (const [ax, az] of [[18.6, 17.3], [26.3, 17.4], [23.6, 20.9]] as const) { G.blocks(ax, az, Math.atan2(-(az - MZ), ax - MX), 2); add({ c: [ax, 1.66, az], h: [0.03, 1.26, 0.03], ...M.galv }); G.wire(MX, MZ, ax, az, 2.9); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) add({ c: [MX + sx * 0.3, 4.05, MZ + sz * 0.3], h: [0.03, 3.75, 0.03], ...M.galv });
  for (let k = 0; k < 6; k++) { const y = 1.4 + k * 1.25;
    add({ c: [MX, y, MZ - 0.3], h: [0.3, 0.02, 0.02], ...M.galv }); add({ c: [MX, y, MZ + 0.3], h: [0.3, 0.02, 0.02], ...M.galv });
    add({ c: [MX - 0.3, y, MZ], h: [0.02, 0.02, 0.3], ...M.galv }); add({ c: [MX + 0.3, y, MZ], h: [0.02, 0.02, 0.3], ...M.galv }); }
  add({ c: [MX + 0.42, 6.6, MZ], h: [0.05, 0.45, 0.16], ...M.plasticWhite }); add({ c: [MX - 0.42, 6.0, MZ], h: [0.05, 0.45, 0.16], ...M.plasticWhite }); add({ c: [MX, 5.2, MZ - 0.44], h: [0.3, 0.3, 0.05], ...M.tin });   // panels and a dish
  add({ c: [MX, 7.84, MZ], h: [0.04, 0.04, 0.04], ...M.plasticBlack, emissive: [6, 0.5, 0.3], flags: BoxFlag.NoShadow });   // the obstruction light
  G.wire(MX, MZ - 0.3, 17.2, 14.6, 2.85); G.wire(MX, MZ - 0.3, 25.0, 14.6, 2.85);
  grp('yard');
  G.sandbags(16.4, 18.9, 2.0, 0, 4);                                                      // crouch cover on the lit yard's dark west edge
  G.crates(34.0, 21.4, 0.2, 2); G.drums(33.6, 23.0, 2);
  // the ops room's corner: three T-wall sections run south off the block's south-east corner — the floor behind them (three or four metres of the east yard) is out of the floods and out
  // of the picket's eye, and the lit face ends at them; further east the yard is lit again (the floods past the block's corner, the fuel lamp's rim)
  G.tWall(27.4, 16.4, 3, HALF);
  G.satDish(13.3, 11.6, 1.2); G.satDish(29.9, 10.1, -1.9, 2.0); G.satDish(30.1, 11.6, -1.2); G.waterTank(12.7, 10.0, 'plasticBlue', 1.1);
  G.hesco(6.4, 12.3, 2, 0);                                                               // a blind inside the west gate, from the north
  G.crates(8.8, 16.9, 0.3, 2, 'coyote'); G.tyres(4.8, 18.4, 3); G.washLine(5.4, 10.4, 8.8, 10.4, 4);
  // THE GATE'S BLAST WALL: seven T-wall sections inside the wicket, parallel to the compound wall — a man coming in by the wicket turns along it to one end or
  // the other and is not seen from the yard doing it (nor is the gate lamp); the picket stands at its east end with the alley's mouth at his back
  G.tWall(21.9, 22.0, 7, 0);
  G.sandbags(26.0, 20.5, 1.6, 0, 3);                                                      // the picket's post: three courses of bags before his stand, off the wall's east end
  G.sandbags(15.0, 22.9, 1.8, 0, 4); G.blocks(31.2, 23.3, 0.1, 2);
  G.pickup(31.4, 16.4, HALF, 'truckWhite', { load: 'crates' });                           // parked nose-north in the east yard
  G.crates(35.0, 18.0, HALF, 3); G.tyres(35.2, 20.4, 2); G.drumDown(29.0, 22.9, 0.4);
  G.woodPile(11.2, 4.7, 0); G.drum(13.8, 4.43, 'drumRed'); G.plasticChair(13.0, 4.65, 0.4);   // the smoking place at the north wall: a drum for the ends, a chair nobody sits in
  G.rubble(12.4, 17.6, 0.8, 7);
  grp('road');
  G.jersey(17.2, 26.75, 1, 0); G.jersey(22.8, 26.75, 1, 0);                               // the checkpoint's two barriers: the dark way across the road is behind them
  G.pickup(32.0, 25.3, Math.PI, 'truckWhite');                                            // left on the road for the night, against the wall: the road start is behind it and the way west passes south of it
  G.bush(2.4, 22.6, 1.1); G.bush(37.6, 9.0); G.bush(14.0, 2.0, 0.9); G.bush(31.0, 2.2, 1.2); G.bush(2.2, 7.4); G.rubble(37.4, 15.0, 0.9, 8);

  // ---------------- what goes dark when the thing is taken (game.ts rackTargets: the switchables named rack<rackIndex>_leds): a tell-tale on each holder ----------------
  grp('objective');
  for (const s of QUIET.spots) { const f = s.front, onX = s.rackIndex === 2;
    const led = add({ c: onX ? [f[0] + 0.006, 1.45, f[2] + 0.2] : [f[0] + 0.2, 1.45, f[2] + 0.006], h: onX ? [0.004, 0.012, 0.03] : [0.03, 0.012, 0.004], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
    switchables.push({ name: `rack${s.rackIndex}_leds`, boxes: [led], group: 'objective', on: true, baseEmissive: [0.3, 4, 0.6], mains: false }); }

  // ---------------- the lamps (all on the mains: the breaker takes every one) and the moon ----------------
  grp('exterior.lamps');
  lampAt(MX - 0.3, MZ - 0.3, 'flood_w', [-0.6, -0.8], 38, 210, 5.5, [0.92, 0.96, 1.0], 0.7);   // the two floods, ON THE MAST and thrown NORTH: the hut block's whole south face, both of its
  lampAt(MX + 0.3, MZ - 0.3, 'flood_e', [0.6, -0.8], 38, 210, 5.5, [0.92, 0.96, 1.0], 0.7);    // doors and the yard before them are lit; everything behind the mast — the south band, the picket — is not
  lampAt(21.1, 24.3, 'lamp_gate', [-0.74, 0.673], 40, 70, 3.3, [1.0, 0.62, 0.22], 0.2);                             // over the wicket, outside: the gate man's stand and the wicket, nothing behind them
  lampAt(4.4, 15.7, 'lamp_west', [0.55, 0.835], 38, 90, 4.2);                             // on the west wall, thrown south-east at the shed's door (the breaker's): the west gate's inside, north of it, is dark
  { const fb = add({ c: [16.9, 2.52, 14.7], h: [0.05, 0.04, 0.07], ...M.plasticWhite, emissive: [30, 21, 11], flags: BoxFlag.NoShadow });   // the bulb over the comms hut's door
    lights.push({ kind: 'spot', pos: [16.9, 2.46, 14.78], dir: norm([0, -1, 0.12]), color: [1.0, 0.7, 0.42], intensity: 16, range: 6, innerDeg: 34, outerDeg: 52, name: 'bulb_comms', group: 'comms_door', enabled: true, volumetric: 0.2, fixtureBox: fb, radius: 0.05, mains: true }); }
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(22.0, 13.4); beacon(6.2, 22.0);

  // ---------------- doors (closedDir 0: the leaf runs +x from the hinge in a wall along x; π/2: +z in a wall along z) ----------------
  const doors: LevelDoorDef[] = [
    // the comms hut's own door: locked (the men carry its key), no closer: once open it stands open, a tell for the picket and nothing to slam on the way out
    { name: 'comms', hinge: [16.32, 14.5], closedDir: 0, width: 1.16, locked: true, closer: false },
    { name: 'ops', hinge: [22.32, 14.5], closedDir: 0, width: 1.16 },                    // the ops room's door on the lit face
    { name: 'comms_ops', hinge: [20.0, 10.32], closedDir: HALF, width: 1.16 },           // between the two rooms
    { name: 'bunk', hinge: [10.0, 6.32], closedDir: HALF, width: 1.16 },
    { name: 'shed', hinge: [6.32, 19.5], closedDir: 0, width: 1.16 },
    // the wall's four leaves: the only `exterior` ones
    { name: 'gate_e', hinge: [36.0, 11.32], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'gate_w', hinge: [4.0, 13.32], closedDir: HALF, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [22.32, 4.0], closedDir: 0, width: 1.16, exterior: true },
    { name: 'gate_s', hinge: [19.42, 24.0], closedDir: 0, width: 1.16, exterior: true },
  ];
  // (`exterior` is for the leaves in the COMPOUND wall: wind.ts gives each a gust; the huts' outside doors stand in 0.24 walls too, so their FRAMES are cut the thick way)
  const THICK = new Set(['comms', 'ops', 'bunk', 'shed']);
  for (const d of doors) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- devices: two cameras ----------------
  const devices: DeviceDef[] = [
    // on the block's south wall east of the comms hut's door, looking back along the face at it: on its own battery (the breaker does not take it). It sees a LIT man: the floods and bulb_comms are its eyes (the breaker takes both)
    { kind: 'camera', name: 'cam_door', pos: [18.7, 2.7, 14.7], yaw: -1.3, pitch: -0.55, fovDeg: 64, range: 6, mains: false },
    // the comms hut's south-east corner, fixed on the racks and the door between the rooms
    { kind: 'camera', name: 'cam_server', pos: [19.7, 2.6, 14.14], yaw: -2.35, pitch: -0.32, fovDeg: 80, range: 8, mains: true },
  ];

  furnish(K, G);                                                                          // LAST: what makes each place somebody's (lived.* — the tail of every list)

  const SPOT = QUIET.spots[0], START = QUIET.starts[0], EXIT = QUIET.exits[0];
  // THE PICKET WALKS ONTO HIS STAND FROM DUE SOUTH (see his route): his standing yaw is that leg's, and the way to his back depends on it
  const picket = RELAY_ROUTES.find(r => r.name === 'picket')!;
  if (Math.abs(picket.points[0][0] - picket.points[1][0]) > 0.05 || picket.points[0][2] < picket.points[1][2] + 1)
    throw new Error("quiet-relay: the picket's lead-in must be due south of his stand (he stands facing north; an early order onto him never sets otherwise)");
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices,
    breaker: { pos: [4.32, 1.35, 21.4], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [START.sam[0], 0, START.sam[2]],
    routes: RELAY_ROUTES.map(r => ({ ...r, points: r.points.map(p => [...p] as Vec3), wait: [...r.wait] })), chokepoints: [], clearPlans: [],
    sky: { zenith: [0.012, 0.02, 0.045], horizon: [0.04, 0.045, 0.07] },
    // the level's own mission in the shape every level file carries: spots[0] and exits[0], as game/quiet.ts writes a deal
    mission: { serverRoom: { ...SPOT.area }, entryDoor: SPOT.door, rack: { index: SPOT.rackIndex, front: [...SPOT.front] as Vec3, halfW: SPOT.halfW }, exfilDoor: EXIT.door, exfilX: EXIT.x, exfilZ: EXIT.z, exfilOut: [EXIT.out[0], EXIT.out[1]] },
  };

  // ---------------- what is underfoot (game/floor.ts): the six materials have no word for earth: 'asphalt' for dirt and gravel, 'stone' for a slab or a
  //                  beaten floor, 'carpet' for the bunk hut's felt ----------------
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'bunk_rug', mat: 'carpet', x0: 6.1, z0: 5.8, x1: 8.5, z1: 7.4 },
      { id: 'block', mat: 'stone', x0: 14, z0: 9, x1: 27, z1: 14.5 },
      { id: 'bunk', mat: 'stone', x0: 4, z0: 4, x1: 10, z1: 9 },
      { id: 'shed', mat: 'stone', x0: 4, z0: 19.5, x1: 9.5, z1: 24 },
      { id: 'fuel', mat: 'stone', x0: 29.6, z0: 4, x1: 36, z1: 8.5 },
      { id: 'mast_pad', mat: 'stone', x0: 21.4, z0: 16.7, x1: 24.4, z1: 19.7 },
    ],
  };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the west gate from the track (the first start's side), the west yard's
  // lamp and the generator shed over the wall behind the pair.
  // FOR THE PICTURE ONLY (`add`: the mission never loads these): the yard's west lamp lights the near side of the gate and the strip behind the wall was black,
  // and what makes this a relay (the mast, the dishes) is under the tiles. So the picture gets a work bulb on a pole against the wall and A SPARE SECTION OF
  // THE MAST stood on a block plinth up the wall from it: the mast's own legs, rungs, panels, dish and red light (`grp('mast')` above), 3.4 m of it. (A
  // dish alone on a cradle read as a blank white board on the page still: this format's dish is a square plate.) The camera sees the tops of things there,
  // not the floor. THE BULB STANDS 1.5 m UP THE WALL FROM THE GATE, NOT BY IT: at 0.25 m from the jamb its light falls through a blown gate on Sam's place
  // (what the AI senses is what the picture shows); from here every line to a place of the pair meets the wall. (The page check's no-alarm row is red on
  // this gate's charge and wall rows WITH AND WITHOUT these pieces, at build 78cc3abb: not this block's.) THE PLINTH IS 0.64 m TALL because
  // tools/qa/lived-check.ts walks an added box whose centre is within 0.3 m of the floor as a place a man goes. Never seen on a GPU.
  const KX = 4.85, KZ = 10.45, kvMast: NonNullable<NonNullable<KitViewData['ways'][number]['add']>['boxes']> = [
    { id: 'kv_mast_plinth', group: 'kv.mast', c: [KX, 0.32, KZ], h: [0.28, 0.32, 0.28], material: 'block' },
    ...([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz], k) => ({ id: `kv_mast_leg${k}`, group: 'kv.mast', c: [KX + sx * 0.18, 2.02, KZ + sz * 0.18] as Vec3, h: [0.025, 1.38, 0.025] as Vec3, material: 'galv' })),
    ...[1.1, 1.75, 2.4, 3.05].flatMap((y, k) => [
      { id: `kv_mast_rung${k}n`, group: 'kv.mast', c: [KX, y, KZ - 0.18] as Vec3, h: [0.18, 0.018, 0.018] as Vec3, material: 'galv' },
      { id: `kv_mast_rung${k}s`, group: 'kv.mast', c: [KX, y, KZ + 0.18] as Vec3, h: [0.18, 0.018, 0.018] as Vec3, material: 'galv' },
      { id: `kv_mast_rung${k}w`, group: 'kv.mast', c: [KX - 0.18, y, KZ] as Vec3, h: [0.018, 0.018, 0.18] as Vec3, material: 'galv' },
      { id: `kv_mast_rung${k}e`, group: 'kv.mast', c: [KX + 0.18, y, KZ] as Vec3, h: [0.018, 0.018, 0.18] as Vec3, material: 'galv' }]),
    { id: 'kv_mast_panel_e', group: 'kv.mast', c: [KX + 0.29, 2.95, KZ], h: [0.05, 0.36, 0.13], material: 'plasticWhite' },
    { id: 'kv_mast_panel_w', group: 'kv.mast', c: [KX - 0.29, 2.5, KZ], h: [0.05, 0.36, 0.13], material: 'plasticWhite' },
    { id: 'kv_mast_dish', group: 'kv.mast', c: [KX, 1.75, KZ + 0.26], h: [0.26, 0.26, 0.04], material: 'tin' },
    { id: 'kv_mast_horn', group: 'kv.mast', c: [KX, 1.75, KZ + 0.42], h: [0.025, 0.025, 0.12], material: 'plasticBlack' },
    { id: 'kv_mast_light', group: 'kv.mast', c: [KX, 3.44, KZ], h: [0.04, 0.04, 0.04], material: 'plasticBlack', emissive: [6, 0.5, 0.3], flags: ['NoShadow' as const] },
  ];
  const kitAdd: NonNullable<KitViewData['ways'][number]['add']> = {
    boxes: [
      { id: 'kv_pole', group: 'kv.lamp', c: [4.2, 1.2, 11.8], h: [0.035, 1.2, 0.035], material: 'galv' },
      { id: 'kv_arm', group: 'kv.lamp', c: [4.47, 2.38, 11.8], h: [0.3, 0.025, 0.025], material: 'galv' },
      { id: 'kv_fix', group: 'kv.lamp', c: [4.75, 2.3, 11.8], h: [0.06, 0.06, 0.06], material: 'plasticWhite', emissive: [40, 24, 7], flags: ['NoShadow'] },
      ...kvMast,
    ],
    lamps: [{ id: 'kv_bulb', kind: 'point', pos: [4.75, 2.2, 11.8], dir: [0, -1, 0], color: [1, 0.62, 0.22], intensity: 13, range: 7, innerDeg: 0, outerDeg: 180, group: 'kv', enabled: true, volumetric: 0.05, radius: 0.06, mains: false, fixture: 'kv_fix' }],
  };
  const kitView: KitViewData = { ways: [{ door: 'gate_w', ref: [1.8, 16.6], side: -1, add: kitAdd }] };
  // what a row calls the four ways through the wall (scenarios.doorNames — game/doornames.ts; no bearing in a name): by what is outside or just inside each
  const doorNames = [{ door: 'gate_s', name: 'wicket' }, { door: 'gate_w', name: 'track gate' }, { door: 'gate_n', name: 'back strip gate' }, { door: 'gate_e', name: 'dish gate' }];
  return { level, scenarios: { quiet: QUIET, kitView, doorNames }, groups: trace.groups, surfaces };
}

// ---------------------------------------------------------------- LIVED-IN ROOMS ----------------------------------------------------------------
// What each place of the station is FOR, seen from above (src/scene/lived.ts: every box here is in a group `lived.<place>`, every prop is named
// `lived.<place>.<what>`, all of it the tail of the lists and left out with the switch off). No light and no change to one: the hiding dark is the level.
// Out of doors nothing stands taller than a man's knee where a flood, the picket or a walker looks: paint, plates in the ground, things against a wall.
// A SOLID thing's top is either under 0.2 m (feet and the nav grid both pass over it) or over 0.25 (both go round): between the two a body is stopped by floor the grid calls free.
function furnish(K: ReturnType<typeof officeKit>, G: ReturnType<typeof gwotKit>): void {
  const L = livedQuiet(K, G.M);

  // ---- THE COMMS HUT = the rack room: a battery bank beside the racks, a rubber mat before them, cables across the floor, a repair on the bench ----
  L.room('comms');
  L.s(18.15, 9.38, 0, 0.5, 0.6, 0.24, 'plasticBlack'); for (let i = 0; i < 4; i++) L.s(17.7 + i * 0.3, 9.38, 0.5, 0.56, 0.1, 0.18, i % 2 ? 'drumBlue' : 'drumRed');   // the battery bank, its cell caps
  L.mat(16.0, 10.3, 3.0, 0.9, 'rubber'); L.line(14.55, 10.78, 17.45, 10.78, 0.06, 'prodYellow'); L.line(14.55, 9.82, 17.45, 9.82, 0.06, 'prodYellow');
  L.line(14.8, 11.7, 15.1, 10.0, 0.04, 'plasticBlack'); L.line(18.3, 13.1, 16.9, 9.8, 0.04, 'prodOrange'); L.line(18.5, 13.1, 18.15, 9.65, 0.04, 'plasticBlack');       // cable runs
  L.d(18.2, 13.28, 0.75, 0.8, 0.08, 0.06, 'plasticBlack'); L.d(19.0, 13.25, 0.75, 0.76, 0.1, 0.07, 'prodGreen'); L.rnd(19.3, 13.25, 0.75, 0.79, 0.045, 'galv', false);   // a headset, a board out of the set, solder
  L.paper(19.55, 13.3, 0.75, 0.2, 0.2, 0.28);
  L.s(15.0, 13.3, 0, 0.19, 0.25, 0.12, 'drumRed'); L.d(15.0, 13.3, 0.19, 0.196, 0.22, 0.09, 'iron'); L.d(15.35, 13.2, 0, 0.02, 0.14, 0.015, 'galv', 0.5);              // the red toolbox, open
  for (let i = 0; i < 3; i++) L.d(19.86 - i * 0.05, 9.2 + i * 0.04, 0, 1.7 + i * 0.1, 0.012, 0.012, 'olive');                                                          // whip aerials stood in the corner
  L.s(19.82, 12.75, 0, 0.5, 0.07, 0.07, 'drumRed'); L.d(19.82, 12.75, 0.5, 0.6, 0.025, 0.025, 'plasticBlack');                                                         // an extinguisher
  L.d(19.932, 12.2, 1.2, 1.8, 0.006, 0.3, 'whitewash'); L.d(19.925, 12.1, 1.55, 1.62, 0.004, 0.22, 'prodRed'); L.d(19.925, 12.25, 1.35, 1.42, 0.004, 0.2, 'paintBlue');   // the frequency chart
  L.d(15.55, 9.32, 2.0, 2.27, 0.02, 0.02, 'plasticBlack'); L.d(14.32, 12.15, 2.0, 2.27, 0.02, 0.02, 'plasticBlack');                                                   // drops from the trays
  L.carton('spares', 17.6, 11.7, 0.2, 0.5, 0.36, 0.32, 'coyote', 'olive');
  L.pail('bin', 19.45, 12.95, 'plasticBlack', 'whitewash');

  // ---- THE OPS ROOM = the watch: the map worked on (arrows, pins, a ruler, tea), the roster over the duty cot, helmets by the door, the log at the set ----
  L.room('ops');
  L.d(24.3, 11.85, 0.762, 0.768, 0.14, 0.03, 'prodRed', 0.5); L.d(24.75, 12.1, 0.762, 0.768, 0.12, 0.03, 'prodRed', -0.3); L.d(24.95, 11.75, 0.762, 0.768, 0.12, 0.03, 'paintBlue', 0.9); L.d(24.15, 12.2, 0.762, 0.768, 0.1, 0.03, 'paintBlue', 0.2);
  L.d(24.9, 12.3, 0.762, 0.77, 0.14, 0.012, 'prodYellow', 0.15); for (let i = 0; i < 3; i++) L.s(24.45 + i * 0.22, 11.95 + 0.12 * (i % 2), 0.761, 0.8, 0.015, 0.015, 'prodRed');
  L.mug(23.83, 11.62, 0.75, 'whitewash'); L.mug(25.38, 12.38, 0.75, 'prodOrange', 0.035, 0.09); L.s(23.85, 12.36, 0.75, 0.87, 0.1, 0.07, 'olive');                       // tea twice, the field telephone
  L.paper(26.3, 12.65, 0.75, 0.1, 0.22, 0.3, 'paintCream'); L.s(26.3, 13.85, 0.75, 1.0, 0.045, 0.045, 'prodGreen');                                                      // the log; his flask
  L.shelf(25.15, 14.15, 0.8, 0.34, 1.0, true, 2); L.s(24.95, 14.15, 1.0, 1.14, 0.12, 0.13, 'olive'); L.s(25.32, 14.15, 1.0, 1.14, 0.12, 0.13, 'coyote'); L.s(25.15, 14.15, 0.3, 0.5, 0.3, 0.13, 'coyote');   // helmets and a vest
  L.d(23.6, 9.135, 1.2, 1.9, 0.7, 0.012, 'plasticWhite'); for (let i = 0; i < 3; i++) L.d(23.3 + i * 0.25, 9.15, 1.72 - i * 0.2, 1.8 - i * 0.2, 0.3, 0.004, (['prodRed', 'prodGreen', 'paintBlue'] as const)[i]);   // the roster
  L.s(23.2, 9.6, 0.42, 0.56, 0.5, 0.26, 'olive'); L.d(24.25, 9.6, 0.42, 0.5, 0.18, 0.24, 'whitewash');                                                                  // a sleeping bag, a pillow
  L.d(21.4, 14.372, 1.0, 2.0, 0.5, 0.006, 'paintCream'); L.d(21.25, 14.364, 1.5, 1.75, 0.12, 0.004, 'prodGreen'); L.d(21.6, 14.364, 1.2, 1.4, 0.1, 0.004, 'paintBlue');   // the wall map
  L.mat(25.6, 13.25, 0.9, 1.3, 'rugGreen');                                                                                                                             // felt under the operator
  L.d(26.872, 13.2, 1.3, 1.9, 0.006, 0.6, 'whitewash'); L.d(26.864, 13.0, 1.65, 1.72, 0.004, 0.3, 'prodRed'); L.d(26.864, 13.35, 1.45, 1.52, 0.004, 0.36, 'plasticBlack');   // call signs over the set
  L.carton('rations', 21.4, 13.0, 0.15, 0.46, 0.34, 0.3, 'coyote', 'prodYellow');
  L.pail('bin', 26.5, 11.9, 'plasticGreen', 'whitewash');

  // ---- THE BUNK HUT = off watch: a home-made barbell and its bench, a crate between the cots with the radio, the wash stand, cards left on the felt ----
  L.room('bunk');
  L.s(7.5, 8.5, 0.3, 0.42, 0.6, 0.16, 'plasticBlack'); L.s(7.0, 8.5, 0, 0.3, 0.05, 0.14, 'iron'); L.s(8.0, 8.5, 0, 0.3, 0.05, 0.14, 'iron');
  L.s(7.5, 8.02, 0.1, 0.14, 0.8, 0.02, 'iron'); L.rnd(6.78, 8.02, 0, 0.19, 0.13, 'slab'); L.rnd(8.22, 8.02, 0, 0.19, 0.13, 'slab');                                      // the bar: a pipe and two tins of concrete
  L.s(6.9, 4.5, 0, 0.45, 0.3, 0.22, 'woodGrey'); L.s(6.8, 4.48, 0.45, 0.6, 0.13, 0.06, 'plasticBlack'); L.d(6.92, 4.48, 0.6, 0.95, 0.006, 0.006, 'galv'); L.mug(7.08, 4.56, 0.45, 'prodRed'); L.d(6.98, 4.33, 0.45, 0.6, 0.07, 0.01, 'paintCream');
  L.s(4.4, 7.5, 0, 0.75, 0.22, 0.28, 'poplar'); L.rnd(4.42, 7.5, 0.75, 0.83, 0.17, 'plasticBlue'); L.d(4.132, 7.5, 1.2, 1.6, 0.006, 0.15, 'glassDark'); L.d(4.14, 7.92, 0.9, 1.4, 0.012, 0.1, 'rugCream');   // basin, mirror, towel
  L.d(6.75, 4.145, 1.0, 1.7, 0.2, 0.025, 'olive'); L.d(7.2, 4.145, 1.05, 1.7, 0.18, 0.025, 'coyote');                                                                    // jackets on the wall
  L.d(9.55, 4.9, 0, 0.2, 0.05, 0.13, 'plasticBlack'); L.d(9.7, 4.92, 0, 0.2, 0.05, 0.13, 'plasticBlack', 0.2);                                                           // boots
  L.mat(9.3, 6.9, 0.7, 1.0, 'plasticGreen');
  L.s(4.8, 8.4, 0.42, 0.75, 0.22, 0.2, 'olive'); L.d(4.8, 8.4, 0.75, 0.756, 0.16, 0.16, 'coyote');                                                                       // a rucksack packed on the spare cot
  L.rnd(7.0, 6.4, 0.03, 0.04, 0.16, 'galv', false); L.d(6.96, 6.4, 0.04, 0.12, 0.03, 0.03, 'prodOrange'); L.paper(7.5, 6.75, 0.03, 0.4, 0.07, 0.1); L.paper(7.68, 6.6, 0.03, -0.3, 0.07, 0.1, 'prodRed');
  L.d(9.872, 5.3, 1.2, 1.8, 0.006, 0.3, 'paintCream');
  L.own(G.plasticChair(4.55, 5.5, 1.9, 'plasticBlue'), 'chair');
  L.carton('parcel', 7.4, 5.25, 0.3, 0.44, 0.32, 0.24, 'coyote', 'rugMadder');

  // ---- THE GENERATOR SHED = the fitter's: a dead engine on a pallet, its parts laid out on a cloth, tins and filters on a steel shelf ----
  L.room('shed');
  L.s(4.65, 20.1, 0, 0.12, 0.45, 0.4, 'poplar'); L.s(4.65, 20.1, 0.12, 0.6, 0.3, 0.25, 'iron'); L.s(4.65, 20.1, 0.6, 0.72, 0.2, 0.18, 'rust'); L.s(4.65, 20.38, 0.25, 0.5, 0.12, 0.03, 'plasticBlack');
  L.mat(5.6, 21.95, 1.3, 0.9, 'canvas', 0.15); L.rnd(5.3, 21.8, 0.03, 0.12, 0.06, 'galv', false); L.d(5.7, 22.1, 0.03, 0.04, 0.16, 0.015, 'iron', 0.6); L.d(5.95, 21.8, 0.03, 0.07, 0.05, 0.03, 'iron', 0.3);
  const sy = L.shelf(9.14, 20.5, 1.5, 0.44, 1.4, false, 3)[2];
  L.s(9.14, 20.0, sy, sy + 0.2, 0.1, 0.08, 'prodRed'); L.s(9.14, 20.3, sy, sy + 0.26, 0.11, 0.11, 'drumBlue'); L.s(9.14, 20.62, sy, sy + 0.18, 0.09, 0.09, 'prodYellow');
  L.rnd(9.14, 20.98, sy, sy + 0.14, 0.09, 'whitewash'); L.s(9.14, 20.5, 0.85, 1.0, 0.16, 0.55, 'coyote'); L.d(8.905, 20.9, 0.5, 1.0, 0.008, 0.12, 'rubber');           // oil, a filter, a carton, a belt hung
  L.d(6.25, 22.6, 0, 0.05, 0.26, 0.2, 'galv');                                                                                                                         // a drain tray, wiped
  L.mat(4.6, 21.4, 0.7, 1.0, 'rubber'); L.line(4.27, 20.92, 4.93, 20.92, 0.06, 'prodYellow'); L.line(4.27, 21.88, 4.93, 21.88, 0.06, 'prodYellow');                     // the mat he stands on to throw the breaker
  L.d(4.15, 20.85, 1.3, 1.5, 0.03, 0.08, 'prodOrange'); L.d(4.135, 22.0, 1.2, 1.5, 0.008, 0.1, 'whitewash');                                                             // ear defenders, the hours sheet
  L.stool('stool', 4.5, 22.6, 0.4);
  L.carton('parts', 8.4, 21.25, -0.2, 0.44, 0.34, 0.28, 'coyote', 'iron');

  // ---- THE FUEL POINT = the pump: a hand pump stood in a drum with its hose, the fire point on the wall, a row of cans, the sand box ----
  L.room('fuel');
  L.oct(31.9, 7.95, 0, 0.88, 0.29, 'drumBlue'); L.s(31.9, 7.95, 0.88, 1.3, 0.03, 0.03, 'iron'); L.s(32.02, 7.95, 1.25, 1.29, 0.14, 0.02, 'prodRed'); L.line(31.9, 7.62, 32.5, 7.35, 0.045, 'plasticBlack');
  L.d(35.872, 6.8, 0.9, 1.7, 0.006, 0.6, 'drumRed'); L.d(35.8, 6.5, 1.0, 1.25, 0.07, 0.1, 'prodRed'); L.d(35.8, 7.1, 1.0, 1.25, 0.07, 0.1, 'prodRed'); L.s(35.72, 7.62, 0, 0.55, 0.08, 0.08, 'drumRed'); L.d(35.72, 7.62, 0.55, 0.65, 0.03, 0.03, 'plasticBlack');
  L.d(33.76, 4.4, 0, 0.03, 0.95, 0.2, 'poplar'); for (let i = 0; i < 5; i++) L.s(33.0 + i * 0.38, 4.4, 0.03, 0.49, 0.08, 0.17, (['olive', 'jerryYellow', 'olive', 'olive', 'paintRust'] as const)[i]);
  L.line(29.7, 8.42, 35.8, 8.42, 0.1, 'prodYellow');
  L.s(29.7, 8.42, 1.4, 1.8, 0.25, 0.012, 'whitewash'); L.d(29.7, 8.436, 1.5, 1.7, 0.09, 0.004, 'prodRed');                                                              // NO SMOKING, on the canopy's post
  L.s(35.55, 8.05, 0, 0.4, 0.18, 0.15, 'ply'); L.d(35.55, 8.05, 0.4, 0.41, 0.15, 0.12, 'dust'); L.d(35.58, 8.05, 0.41, 0.44, 0.02, 0.2, 'poplar', 0.4);                    // sand, and the shovel in it
  L.d(29.166, 6.8, 0, 1.5, 0.012, 0.012, 'poplar');                                                                                                                     // the dipstick
  L.pail('drip', 33.3, 8.0, 'galv');
  L.carton('oil', 31.6, 4.6, 0.1, 0.4, 0.3, 0.26, 'coyote', 'prodYellow');

  // ---- THE MAST YARD = the mast's own ground: cover plates over the feeder trench, the earthing pit, hazard paint on the footing and the stays. Nothing loose: it is lit and watched ----
  L.room('mast');
  for (let i = 0; i < 5; i++) L.mat(23.55 + i * 0.36, 17.2 - i * 0.58, 0.5, 0.5, 'tin', 0.55, 0.014);
  L.oct(21.75, 19.35, 0, 0.03, 0.26, 'iron', false); L.d(21.75, 19.35, 0.03, 0.036, 0.1, 0.02, 'prodYellow');
  for (const [ax, az] of [[18.6, 17.3], [26.3, 17.4], [23.6, 20.9]] as const) L.d(ax, az, 0.9, 1.15, 0.038, 0.038, 'prodYellow');
  L.oct(24.15, 19.3, 0, 0.06, 0.22, 'galv', false);
  L.line(21.5, 16.8, 24.3, 16.8, 0.08, 'prodYellow'); L.line(21.5, 19.6, 24.3, 19.6, 0.08, 'prodYellow'); L.line(21.5, 16.8, 21.5, 19.6, 0.08, 'prodYellow'); L.line(24.3, 16.8, 24.3, 19.6, 0.08, 'prodYellow');
  L.d(22.9, 17.862, 1.2, 1.6, 0.2, 0.008, 'prodYellow');                                                                                                                    // the RF plate, on the lattice's north face

  // ---- THE PICKET'S POST = a man's night on the bags: his flask, his glasses, a poncho, a tin to sit on, sacking underfoot ----
  L.room('picket');
  L.d(25.55, 20.5, 0.6, 0.85, 0.04, 0.04, 'prodGreen'); L.d(25.75, 20.42, 0.6, 0.69, 0.035, 0.035, 'whitewash'); L.d(26.15, 20.5, 0.6, 0.66, 0.08, 0.05, 'plasticBlack'); L.d(26.55, 20.5, 0.6, 0.63, 0.18, 0.2, 'olive');
  L.d(26.15, 21.05, 0, 0.2, 0.15, 0.09, 'olive'); L.mat(26.75, 21.3, 0.8, 0.8, 'sack');

  // ---- THE BACK STRIP = the garden: a vegetable bed against the wall, a scarecrow in a helmet, the rack room's coolers dripping on the block's back wall ----
  L.room('strip');
  L.d(18.6, 5.1, 0, 0.08, 2.0, 0.8, 'mudDark'); for (let i = 0; i < 4; i++) L.d(18.6, 4.55 + i * 0.37, 0.08, 0.16 + 0.03 * (i % 2), 1.8, 0.07, i % 2 ? 'scrub' : 'prodGreen');
  L.d(16.7, 4.4, 0, 0.9, 0.015, 0.015, 'poplar'); L.d(20.5, 5.8, 0, 0.9, 0.015, 0.015, 'poplar');
  L.s(20.2, 4.6, 0, 1.5, 0.03, 0.03, 'poplar'); L.s(20.2, 4.6, 1.15, 1.21, 0.4, 0.025, 'poplar'); L.s(20.2, 4.6, 0.8, 1.2, 0.16, 0.05, 'sack'); L.on(20.2, 4.6, 1.5, 1.64, 0.12, 0.13, 'olive');
  L.s(16.3, 5.6, 0, 0.19, 0.1, 0.14, 'galv'); L.d(16.3, 5.82, 0.14, 0.2, 0.02, 0.1, 'galv'); L.d(17.3, 6.15, 0, 0.03, 0.7, 0.015, 'poplar', 0.2);                      // the can, the hoe
  for (const x of [15.2, 17.0]) { L.s(x, 8.7, 0.3, 0.9, 0.4, 0.17, 'whitewash'); L.d(x, 8.526, 0.38, 0.82, 0.3, 0.004, 'iron'); L.mat(x, 8.3, 0.7, 0.5, 'damp'); }
  L.pail('garden', 16.2, 4.9, 'plasticBlue');
  L.carton('greens', 21.0, 5.7, 0.2, 0.5, 0.36, 0.22, 'woodGrey', 'prodGreen');

  // ---- THE WEST YARD = the wash yard: a tarp shower on the bunk hut's wall, basins on a bench under the hut's wall, wet ground under the line, the burn barrel ----
  L.room('yard_west');
  L.s(8.05, 9.6, 0.2, 1.8, 0.015, 0.47, 'tarpBlue'); L.s(9.05, 9.6, 0.2, 1.8, 0.015, 0.47, 'tarpBlue');                                                               // the stall: two tarp sides, open to the yard (what is drawn is what stops a man)
  L.s(8.05, 10.07, 0, 1.9, 0.025, 0.025, 'poplar'); L.s(9.05, 10.07, 0, 1.9, 0.025, 0.025, 'poplar'); L.s(8.55, 9.45, 1.8, 2.05, 0.5, 0.14, 'plasticBlack'); L.mat(8.55, 9.62, 0.9, 0.85, 'poplar');   // its posts; the tank laid across the tarps' tops
  L.s(7.0, 9.42, 0.5, 0.56, 0.6, 0.2, 'poplar'); L.s(6.55, 9.42, 0, 0.5, 0.1, 0.16, 'block'); L.s(7.45, 9.42, 0, 0.5, 0.1, 0.16, 'block');
  L.rnd(6.7, 9.42, 0.56, 0.66, 0.17, 'plasticBlue', false); L.rnd(7.25, 9.42, 0.56, 0.66, 0.17, 'prodRed', false); L.d(6.98, 9.3, 0.56, 0.6, 0.04, 0.03, 'prodYellow');
  L.mat(7.1, 10.5, 3.2, 0.9, 'damp');
  L.oct(4.7, 11.15, 0, 0.8, 0.28, 'rust'); L.d(4.7, 11.15, 0.8, 0.805, 0.2, 0.2, 'plasticBlack'); L.mat(4.8, 11.2, 1.3, 1.3, 'oil', 0.3);
  L.prop('bin', 'basket', 8.0, 11.0, 0, 2, [L.part(0, 0, 0.32, 0, 0.2, 0.2, 'plasticWhite'), L.part(0, 0.32, 0.38, 0, 0.17, 0.17, 'rugMadder')]);
  L.pail('wash', 9.6, 9.55, 'prodRed');
  L.carton('soap', 5.9, 9.5, 0.3, 0.4, 0.3, 0.22, 'coyote', 'whitewash');

  // ---- THE EAST YARD = dishes and the motor park: a dish taken down and laid on the ground beside its empty cradle, feeders run to the block, a wheel off by the truck, the windsock ----
  L.room('yard_east');
  L.oct(28.8, 12.8, 0, 0.12, 0.6, 'tin', false); L.d(28.8, 12.8, 0.12, 0.2, 0.06, 0.06, 'plasticBlack'); L.d(29.1, 13.2, 0, 0.04, 0.5, 0.015, 'galv', 0.9);
  L.s(29.7, 12.4, 0, 0.12, 0.2, 0.2, 'block'); L.s(29.7, 12.4, 0.12, 1.0, 0.035, 0.035, 'galv'); L.s(29.7, 12.4, 1.0, 1.04, 0.24, 0.03, 'galv'); L.d(29.48, 12.4, 1.04, 1.3, 0.02, 0.02, 'galv'); L.d(29.92, 12.4, 1.04, 1.3, 0.02, 0.02, 'galv');   // the cradle it came off: a post and an empty yoke
  L.line(29.5, 10.3, 27.15, 10.6, 0.04, 'plasticBlack'); L.line(29.7, 11.6, 27.15, 11.2, 0.04, 'plasticBlack');
  L.oct(29.95, 15.0, 0, 0.19, 0.33, 'rubber'); L.d(29.95, 15.0, 0.19, 0.195, 0.14, 0.14, 'galv');
  L.s(30.15, 16.2, 0, 0.19, 0.1, 0.07, 'drumRed'); L.d(29.85, 16.0, 0, 0.03, 0.3, 0.15, 'canvas', 0.2); L.d(29.8, 16.0, 0.03, 0.04, 0.1, 0.012, 'iron', 0.2); L.d(29.92, 15.95, 0.03, 0.04, 0.1, 0.012, 'iron', 0.5);
  L.line(30.25, 13.7, 30.25, 19.1, 0.08, 'whitewash'); L.line(32.55, 13.7, 32.55, 19.1, 0.08, 'whitewash');
  L.s(33.4, 14.4, 0, 0.12, 0.15, 0.15, 'block'); L.s(33.4, 14.4, 0.12, 3.2, 0.03, 0.03, 'galv'); L.s(33.75, 14.4, 2.95, 3.15, 0.33, 0.08, 'prodOrange'); L.d(33.75, 14.4, 2.94, 3.16, 0.06, 0.085, 'whitewash');
  L.chock('chock', 29.7, 16.7, 0.5);
  L.carton('carton', 33.2, 17.2, 0.4, 0.46, 0.34, 0.3, 'coyote', 'sack');

  // ---- THE ROAD AT THE GATE = the checkpoint: a STOP board, a stop line, a crate to sit on, the alarm gong (a shell case hung on the wall), the wall's foot painted red and white ----
  L.room('road');
  L.s(15.4, 24.4, 0, 1.2, 0.025, 0.025, 'galv'); L.s(15.4, 24.4, 1.2, 1.6, 0.2, 0.012, 'prodRed'); L.d(15.4, 24.416, 1.36, 1.44, 0.14, 0.004, 'whitewash');
  L.line(15.9, 24.3, 15.9, 27.8, 0.25, 'whitewash');
  L.s(22.5, 24.5, 0, 0.4, 0.22, 0.18, 'woodGrey'); L.d(22.42, 24.5, 0.4, 0.48, 0.03, 0.03, 'prodOrange'); L.paper(22.6, 24.5, 0.4, 0.3, 0.16, 0.22, 'paintCream');
  for (let i = 0; i < 5; i++) L.s(23.6 + i * 0.8, 24.25, 0, 0.15, 0.38, 0.1, i % 2 ? 'whitewash' : 'prodRed');
  L.d(21.9, 24.17, 1.75, 1.78, 0.02, 0.05, 'iron'); L.d(21.9, 24.19, 1.35, 1.75, 0.045, 0.045, 'jerryYellow'); L.d(22.02, 24.14, 1.3, 1.62, 0.012, 0.012, 'iron');           // the gong: bracket, shell case, the bar to strike it with
  L.own(G.jerryCan(23.0, 24.75, 0.2, 'jerryYellow'), 'water');
  L.own(G.plasticChair(28.4, 24.6, 2.9, 'plasticWhite'), 'chair');
}
