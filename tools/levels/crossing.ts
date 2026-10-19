// THE BORDER CROSSING — a level for TWO men sneaking (the player and one partner, silent from the first frame): a road through a walled checkpoint at night,
// the customs house north of it and the lot the pair comes in by south of it. No story: a place, a thing to take, a way out.
// THE LEVEL'S ONE IDEA: TWO MEN WHO WATCH EACH OTHER — nobody crosses by the lane until both drop on one word.
// Seven beats are authored (the game has seven names for a level's men); a deal mans five or six.
//   bun run tools/levels/export.ts crossing          → levels/crossing.json (its footstep `surfaces`, its scenarios.quiet block; no room clear in it)
//   bun run tools/qa/quiet-check.ts crossing.json     the quiet block against the built floor, every deal started
//   bun run tools/qa/quiet-light.ts crossing          the light a sneaking man stands in, on paper
//   bun run tools/qa/quiet-pair.ts --level crossing.json --seeds 1-48      the scripted pair beside the same run alone
//   bun run tools/qa/quiet-plan.ts crossing --png     the plan picture: beats, starts, places, ways out, the cameras' cones
//   page: ?levelFile=crossing.json&quiet&squad=1   (&quiet=N pins the deal)
//
//        x 4      8       13       19       25       31       36
//   z 4  +--[gate_n]------+--------+--------+--------+--------+
//        | west yard      |records | office |impound | east   |
//        | (dark, nobody's= (cab)  |desk safe o (locker)= yard  == gate_ne
//        |  beat) pickup  |  dark  | lit cam|  dim   |        |
//  z 9.5 |                +--r-----+--o-----+--i-----+ crates |
//        |                 forecourt             ☼bulb    ▮    |
// z 12.4 +----+ gap +---------------+ mouth  +-------------[fence_e]--+   the kerb wall (2.4 m), run out to the world's edge either side
//    === |shut  ☼boom         ☼  ▬▬▬SCREEN▬▬▬  ☼                ☼bulb c  shut| ===   the road (shut vehicle gates both ends)
// z 16.4 |gate     ▬▬▬▬     ▬▬▬▬▬▬▬▬▬     ▬▬                  HESCO      gate|
//   16.6 +-door-+        [W]+===THE BOX===+[E]                       == gate_e
//        | boom  = hut_e    +=============+                           |
//        | hut  |   pickup                        pickup    +--------+
//     20 +------+                                           = shed   |
//  gate_w ==                                                | (B)    |
//   z 24 +----------------[gate_s]--------------------------+--------+
//   [W] [E] the two lane men's marks, off the box's two ends · ▬ kerb barriers (knee high) · SCREEN the blast walls across the lane's mouth · ▮ a blast
//   wall at the forecourt's east end · c cam_east · (B) the breaker · = a leaf in a z-wall · == a foot gate
//
// THE THREE CROSSINGS (each is one way of several; none is the only way):
//  1 THE LANE, the short way — TWO MEN IN SIGHT OF EACH OTHER. The inspection lane under two sodium lamps, and THE BOX: a seized blue container set down on
//    the south kerb (x 17.5 to 23.5). A man stands off each end of it (laneW at 16.7, 17.2 · laneE at 24.3, 17.2), each lit by his own lamp, each looking
//    north-east / north-west over the lane with his mate in the corner of his eye along the box's north face. They are IN STEP: seventy seconds on their
//    marks together, nine off them together (a few paces outward along the kerb to the end of the beat and back round by the lot). The lot behind them is dark (the lamps' rims
//    fall at their heels), and the box hides the floor at each man's back from the other man — but not the man. Drop one and the other watches him fall, or
//    finds him lying under his lamp a breath later. What the two do: the partner is sent round to one man's back (X on him, 1) and says 'set'; a bare F is
//    refused while the mate is looking — 'hold. he has eyes on him' — so the player goes up the box's other side to the other man's back himself, gives F and
//    F again, and puts his own hands on with the partner's: both go down on one beat (pairorders.ts PAIR.gripBody: a man with the partner's hands on him
//    calls no body in). A stack of crates off each end of the box turns the way to each back into a diagonal from the lot: straight up his spine, not across
//    his shoulder. Across the lane's mouth, out on the road, stands a BLAST SCREEN (x 17.5 to 23.5): the lane men see the lane and each other and nothing
//    of the forecourt, and whoever goes through the mouth walks round the screen's end under their lamps. Alone the lane is not a way: it is another crossing.
//  2 THE WEST END — A LIT CROSSING ONE MAN WATCHES. Lamp_boom lights the road in front of the gap in the kerb wall; the boom man stands on the kerb outside
//    his hut's road doorway twenty-six seconds at a time looking across it, then goes in to the stove for eighteen. The hut has a back door on the dark lot
//    (hut_e). The lot's west pocket is sealed from the rest of the lot (a T-wall, a HESCO run): from the west wicket this is the way on. What the two do: one
//    watches him (X on him, 2) or takes him from the back door while the other crosses and picks the records room's west door (rec_w, four seconds on a knee
//    in the west yard, which is nobody's beat). Alone it is the eighteen seconds he spends at the stove.
//  3 THE EAST END — A CAMERA AND A DOOR. The leaf in the kerb wall (fence_e) is locked, under a small bulb, and cam_east (on a battery: the breaker does not
//    take it) looks along the wall at whoever kneels there. The OCP puts the camera out for nine seconds and the pick takes four, and on two sets the road
//    walker ('east') is at the road's east end: thirty seconds at the chicane with his back to the door, six by the gate looking at it. His back is under
//    the door's bulb: he is a man to WATCH, not one to take. A HESCO on the south kerb hides the pocket inside the east wicket from him, and a blast wall at
//    the forecourt's east end hides the floor inside the door from the forecourt man. What the two do: the partner watches the walker (X on him, 2) while
//    the player does the camera and the lock. Alone the nine seconds have to fall inside the thirty.
// THE HOUSE: three rooms in a row against the north wall, each with a door on the forecourt; the office and the impound are joined inside (off_imp), the
// records room is not, and there is an end door on either yard (rec_w locked and dark; imp_e). The office's forecourt door is under a burning bulb and NOT
// locked (the clerk is in). THE CLERK sits at his desk on the office's north wall, seventy-five seconds at a time, his back to the door (four and a half
// metres behind him) and the safe in the corner of his eye — then through to the impound's shelf for the ledger (eight) and back. Two do it with a man
// sent to his back from the door; alone it is the walk to the ledger. THE FORECOURT MAN stands forty seconds at the impound's door looking east along the
// house's face, six at the office's door looking west.
// THE THING ('the manifest') is in one of three places a run: the office safe (cam_server on it, the room lit, the clerk in it), the records room's
// grey cabinet (dark), the impound's property locker.
// THE LIGHTS: three road lamps, the forecourt's bulbs, the fence door's bulb, the office tube, the impound's bulb and the shed's tube are on the MAINS —
// the breaker is in the generator shed in the lot's south-east corner, on the pair's own side of the road (the south walker goes in there). The boom hut's
// lantern and cam_east are not. Every one is a target for the OCP or a round.
// THE SEVEN BEATS (CROSSING_ROUTES below) and THE THREE SETS (QUIET.patrols): the two lane men and the boom man are on every set; the others are dealt.
// Every man starts his lap at its first waypoint on the first frame (the game deals no phase): the lane men are on their marks from about the tenth second.
// REPLAY: three starts (outside the south gate, in the lorry park · outside the east wicket · outside the west wicket, by the tea stall: all south of the
// road), three places for the thing, three sets, five ways out (north gate · south gate · east wicket · east yard gate · west wicket), all open every run.
// In the GWOT look kit (src/scene/gwotKit.ts). Units: metres. +X east, +Z south, +Y up. NOT SEEN ON A GPU: laid out on paper, checked headless, one still on the software renderer.
import type { Vec3 } from '../../src/math/vec';
import type { DeviceDef, Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { KitViewData, LevelScenarios, QuietData, Rect, ResponseData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { livedQuiet } from './lived-quiet';

export const NAME = 'crossing';
export const NOTES = 'The border crossing at night, for two men sneaking. Its one idea: two lane men who watch each other along a seized container on the kerb, each with his back to the dark lot — nobody crosses the lane until both drop on one word. Also: a boom man watching the lit west crossing from his hut, a locked fence door under a battery camera at the east end, a blast screen across the far mouth of the lane, a customs house of three rooms north of the road, a lot and the generator shed south of it. Seven beats authored, five or six manned a deal. Regenerate: bun run tools/levels/export.ts crossing';
export const MATERIALS = GWOT_MATERIALS;

/** the floor inside each room's walls */
export const CROSSING_ROOMS: Record<'records' | 'office' | 'impound' | 'hut' | 'shed', Rect> = {
  records: { x0: 13.12, x1: 18.94, z0: 4.12, z1: 9.38 },
  office: { x0: 19.06, x1: 24.94, z0: 4.12, z1: 9.38 },
  impound: { x0: 25.06, x1: 30.88, z0: 4.12, z1: 9.38 },
  hut: { x0: 4.12, x1: 7.88, z0: 16.72, z1: 19.88 },
  shed: { x0: 30.12, x1: 35.88, z0: 19.62, z1: 23.88 },
};
const R = CROSSING_ROOMS;

/** THE SEVEN BEATS (seven and no more: a level's men are named off game.ts CALLSIGNS by route, which holds seven). A waypoint with a wait is where he stands and looks, facing the way he came to it — so a mark is come at from the side he is to look from.
 *  ON THE FIRST LAP a man stands on waypoint 0 from the first frame and has not come to it from anywhere (he faces down his first leg): so the long stands — the lane men's marks, the clerk's desk, the road
 *  walker's chicane — are waypoint 1 or later, come at on the first lap as on every other. (The forecourt man's first six seconds and the south walker's first eight face the other way: short, and left.) */
export const CROSSING_ROUTES: PatrolRoute[] = [
  // the lane's west man: a few paces west along the kerb to the end of his beat (the bastion line: four seconds there, his back to his mate), then back
  // round by the lot so that he comes onto his mark off the box's west end facing NORTH-EAST — seventy seconds there with the lane in front of him, his mate in the corner of his eye along the box's face, and the dark
  // lot and the box's end at his back
  { name: 'laneW', points: [[14.3, 0, 17.5], [15.6, 0, 18.4], [16.7, 0, 17.2]], wait: [4, 0, 70] },
  // the lane's east man, the mirror of it and IN STEP with him: the two are on their marks together and off them together (nine seconds in the seventy-nine)
  { name: 'laneE', points: [[26.7, 0, 17.5], [25.4, 0, 18.4], [24.3, 0, 17.2]], wait: [4, 0, 70] },
  // the boom man: twenty-six seconds on the kerb outside his hut's road doorway, looking across the lit crossing, and in to the stove with his back to it (eighteen)
  { name: 'boom', points: [[6.0, 0, 15.9], [6.3, 0, 15.2], [6.0, 0, 17.4], [6.4, 0, 18.8], [6.0, 0, 17.4]], wait: [26, 0, 0, 18, 0] },
  // the road walker: up and down the road's east end past the fence door — thirty seconds in the lee of the chicane's east wall, facing WEST at the gap
  // between its two walls (the one way along the road for a man or a truck: he sees the gap, not the road beyond it; his back to the fence door, the gate
  // and the wicket's pocket; the floor behind him is under the door's bulb, so he is watched, not taken), six looking east by the gate
  { name: 'east', points: [[33.6, 0, 14.2], [30.3, 0, 14.6]], wait: [6, 30] },
  // the forecourt man, north of the road: forty seconds at the impound's door looking EAST along the house's face (the office's door is behind him), six at
  // the office's door looking west — he turns short of the east yard (the fence door's lock is out of his hearing, and a blast wall hides the floor inside it)
  { name: 'yard', points: [[23.6, 0, 10.6], [27.4, 0, 10.6]], wait: [6, 40] },
  // the clerk: seventy-five seconds at his desk on the office's north wall — facing it, the door four and a half metres behind him, the safe in the corner of
  // his eye — then through the inner door for the ledger on the impound's shelf (eight) and back. He comes to the desk from the room's middle, facing north
  { name: 'clerk', points: [[20.9, 0, 7.0], [20.6, 0, 5.6], [22.6, 0, 7.3], [26.5, 0, 7.4], [22.6, 0, 7.3]], wait: [0, 75, 0, 8, 0] },
  // the south walker, on the pair's own side: eight seconds in the generator shed, out of its door to the pickup parked tail to the south wall — six seconds
  // at its side with his eyes on the load — and back: a short lap, so the lot's east end is never his for long
  { name: 'south', points: [[32.4, 0, 21.4], [29.4, 0, 21.7], [28.6, 0, 22.2]], wait: [8, 0, 6] },
];

/** scenarios.quiet: spots[0] + exits[0] is `level.mission`, starts[0] is `level.playerSpawn`, `level.routes` is every beat (a run mans one set of five or six).
 *  THE FIRST OF EACH LIST IS THE MISSION, SET BY HAND (an unpinned visit plays starts[0] · spots[0] · patrols[0]; the rest stay reachable by ?quiet=N) — keep it so:
 *    the south gate (the lane and its two lit men straight ahead, the long dark way to the east door off to the right, the west pocket walled off) ·
 *    the office safe (the one place with a second problem behind the crossing: the clerk's back and the lens on the safe) ·
 *    set 0 (nobody in the lot behind the pair, nobody on the forecourt: the lane's two men ARE the problem, and the road walker is what the east door costs).
 *  Measured (tools/qa/quiet-pair.ts, scripted, build 53406430): alone or with the partner only following nobody gets across; the double lands 5 of 6 and ends unseen;
 *  the east door with the partner on the walker 4 of 4. Set 2 in its place leaves the east door to the camera alone (a free way round); set 1 empties the office. */
export const QUIET: QuietData = {
  thing: 'the manifest',
  starts: [
    { name: 'the lorry park gate', sam: [15.9, 0, 25.9], samYaw: Math.PI, mate: [17.0, 0, 26.3] },
    { name: 'the ditch wicket', sam: [37.9, 0, 17.9], samYaw: -Math.PI / 2, mate: [38.4, 0, 19.0] },
    { name: 'the tea stall wicket', sam: [2.1, 0, 21.9], samYaw: Math.PI / 2, mate: [1.6, 0, 23.0] },
  ],
  spots: [
    { place: 'the customs office', area: R.office, door: 'office', holder: 'the office safe', rackIndex: 0, front: [23.4, 1.0, 4.78], halfW: 0.3 },
    { place: 'the records room', area: R.records, door: 'records', holder: 'the grey cabinet', rackIndex: 1, front: [15.0, 1.0, 4.78], halfW: 0.4 },
    { place: 'the impound', area: R.impound, door: 'impound', holder: 'the property locker', rackIndex: 2, front: [29.4, 1.0, 4.75], halfW: 0.4 },
  ],
  exits: [
    { name: 'the customs yard gate', door: 'gate_n', x: 7.9, z: 4.0, out: [0, -1] },
    { name: 'the lorry park gate', door: 'gate_s', x: 15.9, z: 24.0, out: [0, 1] },
    { name: 'the ditch wicket', door: 'gate_e', x: 36.0, z: 17.9, out: [1, 0] },
    { name: 'the impound yard gate', door: 'gate_ne', x: 36.0, z: 7.0, out: [1, 0] },
    { name: 'the tea stall wicket', door: 'gate_w', x: 4.0, z: 21.9, out: [-1, 0] },
  ],
  patrols: [
    ['laneW', 'laneE', 'boom', 'east', 'clerk'],              // 0 — the road walked, the clerk in: nobody north of the road but him
    ['laneW', 'laneE', 'boom', 'east', 'yard', 'south'],     // 1 — a man behind the pair in the lot and one on the forecourt; the office empty
    ['laneW', 'laneE', 'boom', 'south', 'clerk', 'yard'],    // 2 — nobody walks the road: the east door is the camera's alone; the forecourt walked
  ],
  needs: {
    coffee: { name: 'the kettle in the boom hut', pos: [6.2, 0, 19.1], face: -Math.PI / 2 },
    smoke: { name: 'the east gate', pos: [35.3, 0, 15.9], face: Math.PI },
  },
};

/** scenarios.response (game/qrf.ts, tools/qa/response-check.ts): WHO COMES WHEN THE CROSSING GOES LOUD. The road's vehicle gates are welded for the night, so
 *  they come on foot from the house's side, by one of its two yard gates. Character yaws (forward = [sin, 0, cos]: 0 looks down the plan, toward the road). */
export const RESPONSE: ResponseData = {
  why: 'A border post: the company that mans it sleeps in its lines up the road, with a duty section dressed and a telephone to the customs house.',
  site: 'the crossing', at: 'at the crossing', team: 'the duty section', tag: 'SECTION',
  men: [3, 4], eta: [60, 100],
  ways: [
    { name: 'the customs yard gate', door: 'gate_n', coming: 'coming in by the customs yard', clear: 'nobody in the yard beside records',
      muster: [[7.2, 0, 2.8], [8.3, 0, 2.8], [7.2, 0, 1.8], [8.3, 0, 1.8]],
      entry: [[7.4, 0, 6.3], [6.2, 0, 5.6], [8.3, 0, 5.6], [7.4, 0, 5.0]], entryFace: [0, -0.5, 0.5, 0] },
    { name: 'the impound yard gate', door: 'gate_ne', coming: 'coming in by the impound yard', clear: 'nobody among the crates',
      muster: [[37.3, 0, 6.8], [37.3, 0, 7.8], [38.4, 0, 6.8], [38.4, 0, 7.8]],
      entry: [[32.6, 0, 7.2], [33.6, 0, 6.0], [32.6, 0, 8.6], [33.6, 0, 7.2]], entryFace: [-Math.PI / 2, Math.PI, 0, -Math.PI / 2] },
  ],
  // the second lift: two men who stand outside the gates the pair would leave by
  posts: [
    { name: 'outside the lorry park gate', pos: [15.75, 0, 25.7], yaw: Math.PI, sweep: [[15.75, 1, 23.0], [10.0, 1, 25.5]] },
    { name: 'outside the wicket', pos: [37.6, 0, 17.75], yaw: -Math.PI / 2, sweep: [[35.0, 1, 17.75], [37.6, 1, 21.0]] },
  ],
  outside: [[38.6, 0, 26.8], [39.2, 0, 25.6]],
  // the level has no named floor beyond its three rooms: what a section sent here would walk round and look at
  sweep: [
    { name: 'the records room', pos: [16.0, 0, 6.8] }, { name: 'the customs office', pos: [22.0, 0, 6.8] }, { name: 'the impound', pos: [27.8, 0, 8.6] },
    { name: 'the forecourt', pos: [20.5, 0, 10.6] }, { name: 'the impound yard', pos: [32.6, 0, 7.6] }, { name: 'the lane', pos: [20.5, 0, 17.0] },
    { name: 'the boom hut', pos: [6.2, 0, 18.0] }, { name: 'the lorry park', pos: [16.0, 0, 21.5] }, { name: 'the shed', pos: [33.0, 0, 21.5] },
  ],
};

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;
  const roof = { flags: BoxFlag.NoPrimary };

  // ---------------- ground: dust to the horizon, packed dirt inside the wall, the road and its concrete pad, a concrete apron before the house ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(4, 4, 36, 24, 'dirt');
  G.ground(0, 12.8, 40, 16.4, 'gravel', 0.006);                                  // the road, wall to wall and on out of the world
  G.ground(14, 12.8, 27, 16.4, 'slab', 0.008);                                   // the inspection pad under the lane lamps
  G.ground(13, 9.62, 31, 12.28, 'slab', 0.006);                                  // the forecourt
  G.ruts(1, 14.0, 13.6, 14.0); G.ruts(27.4, 15.2, 39, 15.2);
  G.patch(20.6, 15.7, 1.6, 1.0, 'oil', 0.2); G.patch(10.4, 21.0, 2.6, 1.8, 'dust', 0.3); G.patch(26.0, 22.4, 3.0, 1.6, 'dust', -0.2);
  grp('floors');
  G.ground(13, 4, 31, 9.5, 'slab', 0.006); G.ground(4, 16.6, 8, 20, 'mudFloor', 0.006); G.ground(30, 19.5, 36, 24, 'slab', 0.006);

  // ---------------- roofs (light-only): the house, the boom hut, the shed ----------------
  grp('ceiling');
  slab(12.9, H, 3.9, 31.1, H + 0.2, 9.6, [0.5, 0.47, 0.41], roof);
  slab(3.9, H, 16.5, 8.1, H + 0.2, 20.1, [0.36, 0.35, 0.33], roof);
  slab(29.9, H, 19.4, 36.1, H + 0.2, 24.1, [0.36, 0.35, 0.33], roof);

  // ---------------- the perimeter wall (2.4 m, coped) with its five foot gates; the road's two vehicle gates stand shut ----------------
  grp('walls.perimeter');
  G.yardWallX(4, 3.88, 12.88, 'mud', [{ a: 7.3, b: 8.5, y0: 0, y1: 2.2 }]);       // north, west of the house: the north gate
  G.yardWallX(4, 31.12, 36.12, 'mud');                                           // north, east of the house
  G.yardWallX(24, 3.88, 29.88, 'mud', [{ a: 15.3, b: 16.5, y0: 0, y1: 2.2 }]);    // south: the south gate
  G.yardWallZ(4, 4.12, 13.0, 'mud');                                             // west, north of the road
  G.yardWallZ(4, 20.12, 23.88, 'mud', [{ a: 21.3, b: 22.5, y0: 0, y1: 2.2 }]);    // west, south of the boom hut: the west wicket
  G.yardWallZ(36, 4.12, 13.0, 'mud', [{ a: 6.4, b: 7.6, y0: 0, y1: 2.2 }]);                                            // east, north of the road
  G.yardWallZ(36, 16.2, 19.38, 'mud', [{ a: 17.3, b: 18.5, y0: 0, y1: 2.2 }]);    // east, south of the road: the east wicket
  for (const [x, z] of [[4, 13.0], [4, 16.2], [36, 13.0], [36, 16.2], [4, 4], [36, 4], [4, 24], [12.9, 24], [22, 24]] as const) G.pier(x, z);
  // the two vehicle gates: sheet steel, shut and chained for the night (statics: nobody comes in by the road)
  for (const x of [4, 36]) { add({ c: [x, 1.1, 13.82], h: [0.035, 1.1, 0.8], ...G.M.paintGreen }); add({ c: [x, 1.1, 15.38], h: [0.035, 1.1, 0.8], ...G.M.paintGreen }); add({ c: [x, 2.24, 14.6], h: [0.05, 0.04, 1.6], ...G.M.iron }); }
  G.skirt('x', 24, 4, 15.2, -1); G.skirt('x', 24, 16.6, 29.8, -1); G.skirt('z', 4, 4.2, 12.9, 1); G.skirt('z', 36, 4.2, 6.76, -1); G.skirt('z', 36, 7.74, 12.9, -1);   // (the east wall's foot stops at the yard gate's frame either side: it ran across the opening)

  // ---------------- the kerb wall between the road and the customs side (block, 2.4 m): the west gap, the lane's mouth, the fence door ----------------
  grp('walls.kerb');
  G.yardWallX(12.4, 4.12, 35.88, 'block', [{ a: 7.3, b: 9.0, y0: 0, y1: 2.4 }, { a: 18.8, b: 22.2, y0: 0, y1: 2.4 }, { a: 32.3, b: 33.5, y0: 0, y1: 2.2 }]);
  for (const x of [7.3, 9.0, 18.8, 22.2]) G.pier(x, 12.4, 2.4, 'block');
  G.yardWallX(12.4, 0, 3.88, 'block'); G.yardWallX(12.4, 36.12, 40, 'block'); G.yardWallX(24, 0, 3.88, 'mud');   // THE BORDER: the same line run out to the world's edge either side, so the road is crossed inside the wall or not at all

  // ---------------- the customs house (cement render; its north wall stands on the perimeter's line) ----------------
  grp('walls.house');
  G.wallX(4, 12.88, 31.12, 'render');
  G.wallX(9.5, 12.88, 31.12, 'render', [{ a: 14.3, b: 15.5 }, { a: 21.3, b: 22.5 }, { a: 27.3, b: 28.5 }]);   // the three forecourt doors
  G.wallZ(13, 4.12, 9.38, 'render', [{ a: 5.3, b: 6.5 }]);                        // west: the records room's own door on the west yard
  G.wallZ(31, 4.12, 9.38, 'render', [{ a: 5.3, b: 6.5 }]);                        // east: the impound's door on the east yard
  G.partZ(19, 4.12, 9.38, 'whitewash');                                           // records | office: no door (the clerk's way to the records room is round by the forecourt)
  G.partZ(25, 4.12, 9.38, 'whitewash', [{ a: 6.8, b: 8.0 }]);                     // office | impound
  G.dado('x', 9.5, 13.2, 14.2, 1, 'paintGreen'); G.dado('x', 9.5, 15.6, 21.2, 1, 'paintGreen'); G.dado('x', 9.5, 22.6, 27.2, 1, 'paintGreen'); G.dado('x', 9.5, 28.6, 30.9, 1, 'paintGreen');

  // ---------------- the boom hut (block; its west wall is the perimeter's line): a road doorway with no leaf, a back door on the lot ----------------
  grp('walls.hut');
  G.wallZ(4, 16.48, 20.12, 'block');
  G.wallX(16.6, 4.12, 8.12, 'block', [{ a: 5.3, b: 6.7, y0: 0, y1: 2.2 }]);       // the road doorway: he stands in it
  G.wallZ(8, 16.72, 19.88, 'block', [{ a: 18.3, b: 19.5 }]);                      // the back door (hut_e)
  G.wallX(20, 4.12, 8.12, 'block');
  // ---------------- the generator shed (block; its east and south walls stand on the perimeter's line) ----------------
  grp('walls.shed');
  G.wallX(19.5, 29.88, 36.12, 'block'); G.wallZ(30, 19.62, 23.88, 'block', [{ a: 20.8, b: 22.0 }]);
  G.wallX(24, 29.88, 36.12, 'block'); G.wallZ(36, 19.38, 23.88, 'block');

  // ---------------- the road: the boom (raised for the night), kerb barriers, the night barrier at the west end, a blast-wall chicane at the east ----------------
  grp('road');
  add({ c: [10.3, 0.55, 16.5], h: [0.09, 0.55, 0.09], ...G.M.paintRust }); add({ c: [10.3, 2.5, 16.37], h: [0.04, 1.45, 0.04], ...G.M.paintCream, flags: BoxFlag.NoShadow });   // the boom's post and its arm, up
  G.jersey(13.42, 16.5, 1, 0); G.jersey(20.5, 16.5, 2, 0); G.jersey(26.6, 16.5, 1, 0);         // the south kerb: knee-high, with a gap (and his lamp's pole) at each lane man's mark — each gap wide enough to walk through beside a man standing on his mark
  G.tWall(20.5, 14.4, 5, 0);                                                                   // THE SCREEN: blast walls across the lane's mouth, two strides out on the road (x 17.5..23.5) — from their marks the lane men see the lane and each other, nothing of the forecourt; the way through the mouth is round its end
  G.tWall(12.5, 14.6, 3, HALF);                                                                // the night barrier: blast walls across the road east of the boom — the boom's end and the lane do not see each other
  G.tWall(34.9, 12.9, 1, 0);                                                                   // a blast wall segment by the east gate
  G.tWall(27.0, 13.8, 2, HALF); G.tWall(29.0, 15.7, 2, HALF);                                  // the east chicane: two blast walls staggered across the road, which also cut the east end's view of the lane
  G.drum(4.7, 13.3, 'drumBlue');
  G.hesco(32.05, 16.9, 3, 0);                                                                   // a bastion run on the south kerb at the east end (clear of the east wicket's leaf, which opens inward): the road walker on his beat does not see into the pocket inside the wicket

  // ---------------- the lot, south of the road: the pair's own side — dark, with things to move behind ----------------
  grp('lot');
  G.container(20.5, 18.85, 0, 'paintBlue');                                       // THE BOX — x 17.47..23.53, z 17.63..20.07: a seized container set down on the south kerb between the two lane men's marks.
                                                                                  // Each man sees the other along its north face; neither sees round its end to the floor at the other's back
  G.pickup(12.2, 19.4, 0.1, 'truckWhite', { load: 'sacks' });
  G.pickup(27.0, 21.3, HALF, 'truckTan', { load: 'drums' });                      // tail (and its load of drums) to the south wall, nose to the road, clear of the east man's way round to his mark
  G.hesco(10.0, 22.9, 2, 0); G.sandbags(11.6, 17.5, 1.8, 0, 4);                    // bags on the kerb east of the boom
  G.tWall(13.3, 17.05, 1, HALF); add({ c: [13.3, 0.95, 18.03], h: [0.03, 0.95, 0.4], ...G.M.ply }); G.hesco(13.3, 22.05, 3, HALF);   // (one wall section hard against the kerb's barrier — no eye-high slit past its end — and a sheet of ply stood between it and the truck's wing)
                    // a bastion line with the truck in it, kerb to south wall: the hut's end of the lot is its own pocket — from the west wicket the way on is the west crossing
  G.crates(15.6, 20.6, 0.2, 2); G.crates(21.6, 21.9, -0.3, 2, 'coyote'); G.crates(19.4, 22.3, 0.15, 3); G.tyres(28.9, 23.2, 3); G.drums(24.6, 23.3, 3);
  G.crates(16.9, 19.0, 0.1, 2); G.crates(24.1, 19.0, -0.1, 2);                    // a stack off each end of the box: the way to a lane man's back is a diagonal from the lot, up his spine
  G.sacks(14.4, 23.3, 0.1, 3); G.jerryCan(29.4, 20.3, 0.4); G.bush(20.6, 23.4, 0.9);

  // ---------------- outside the wall: what each way in is known by ----------------
  grp('outside');
  G.container(24.6, 26.5, 0, 'paintRust'); const lorryPark0 = K.boxes.length; G.crates(11.4, 26.4, 0.2, 3); G.tyres(12.9, 25.3, 2); const lorryPark1 = K.boxes.length;      // the lorry park, outside the south gate: a box waiting its turn, a pallet's worth of crates
  G.stall(1.5, 18.6, HALF, 2.2, 'tarpBlue'); G.handcart(1.9, 14.7, 0.15, 'sacks');                     // the tea stall, outside the west wicket; a cart left at the shut road gate
  G.motorbike(38.1, 14.7, HALF + 0.2); G.drums(38.4, 16.9, 2); G.bush(38.7, 21.6, 1.0);               // the east road: a bike left at the shut gate, the ditch's scrub
  // ---------------- the west yard (north of the road): impounded things, dark ----------------
  grp('yard.west');
  G.pickup(10.0, 8.2, HALF, 'truckRed');                                          // nose to the north wall, a door's width off the records room's west door
  G.motorbike(5.3, 9.6, 0.3); G.tyres(5.0, 5.0, 3); G.drums(5.2, 11.4, 2); G.crates(11.9, 11.6, 0, 2); G.rubble(6.2, 7.2, 0.7, 6);
  // ---------------- the east yard: the cage's overflow ----------------
  grp('yard.east');
  G.crates(35.1, 5.0, 0, 3); G.crates(35.1, 6.4, HALF, 2, 'coyote'); G.sacks(34.9, 8.4, 0.1, 3); G.drums(35.2, 11.4, 2); G.hesco(34.6, 10.0, 1, HALF);
  // ---------------- the forecourt: the inspection table against the kerb wall ----------------
  grp('forecourt');
  G.table(26.4, 11.85, 1.8, 0.7, 0); G.plasticChair(27.9, 11.7, 2.0); G.sacks(29.8, 11.7, 0, 2); G.crates(16.6, 11.8, 0, 1);
  G.crates(23.6, 11.8, 0.1, 1);
  G.tWall(31.0, 11.7, 1, HALF);                                                   // a blast wall at the forecourt's east end, against the kerb wall: the floor inside the fence door is not seen from the house's face

  // ---------------- the records room (dark): shelves of ledgers, the grey cabinet on the north wall ----------------
  grp('records');
  add({ c: [15.0, 0.7, 4.46], h: [0.45, 0.7, 0.3], ...G.M.galv });                // THE GREY CABINET: spot 1
  G.crates(17.9, 4.7, 0, 3, 'coyote'); G.table(17.6, 8.6, 1.6, 0.7, 0); G.plasticChair(16.6, 8.0, 0.4); G.trunk(13.6, 8.6, HALF, 'paintGreen'); G.trunk(13.6, 7.6, HALF, 'paintBlue');
  G.tube(16.0, 6.8, true, 'records', false);
  // ---------------- the office (lit): the safe, the clerk's desk, the camera on both ----------------
  grp('office');
  add({ c: [23.4, 0.55, 4.46], h: [0.36, 0.55, 0.3], ...G.M.iron });              // THE SAFE: spot 0
  G.table(20.6, 4.75, 1.6, 0.7, 0); G.plasticChair(21.9, 5.2, 2.4, 'plasticBlue'); G.trunk(24.3, 8.8, 0, 'paintCream');   // the desk on the north wall (he stands at it facing the wall), his chair pushed back
  G.rug(22.2, 7.6, 2.4, 1.6, 'kilim');
  G.tube(22.0, 6.4, true, 'office', true);
  // ---------------- the impound: seized things on the floor, the property locker on the north wall, one small bulb ----------------
  grp('impound');
  add({ c: [29.4, 1.0, 4.44], h: [0.49, 1.0, 0.3], ...G.M.olive });               // THE PROPERTY LOCKER: spot 2
  G.crates(26.0, 4.7, 0, 3); G.sacks(26.1, 8.7, 0, 4); G.drums(30.2, 8.6, 2); G.cot(27.2, 5.0, 0, false);
  G.bulb(28.2, 7.2, 'bulb_impound', 'impound', true, 9);
  // ---------------- the boom hut: a cot, the kettle, a lantern on its own fuel ----------------
  grp('hut');
  G.cot(4.75, 18.0, HALF); G.lowTable(5.0, 19.45, 0); G.lantern(5.0, 19.45, 'lantern_hut', 'hut', 0.3); G.stove(7.3, 19.55);
  // ---------------- the generator shed: the set, its fuel, THE BREAKER on the east wall ----------------
  grp('shed');
  G.generator(33.2, 23.2, 0); G.drums(31.0, 23.2, 2); G.jerryCan(34.8, 20.2, 0.3, 'jerryYellow');
  const brk = add({ c: [35.84, 1.35, 21.6], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [35.79, 1.62, 21.42], h: [0.01, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  G.tube(33.0, 21.4, true, 'shed', true);

  // ---------------- what goes dark when the thing is taken: a tell-tale on each holder (the switchables named rack<rackIndex>_leds) ----------------
  grp('objective');
  for (const s of QUIET.spots) { const f = s.front, led = add({ c: [f[0] + 0.2, 1.3, f[2] + 0.006], h: [0.03, 0.012, 0.004], ...G.M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
    switchables.push({ name: `rack${s.rackIndex}_leds`, boxes: [led], group: 'objective', on: true, baseEmissive: [0.3, 4, 0.6], mains: false }); }

  // ---------------- lights: three sodium lamps on the road (mains), bulbs on the forecourt and the fence door, the moon ----------------
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3, outerDeg = 42, intensity = 120, lean = 0.35) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], ...G.M.galv });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, ...G.M.galv });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, ...G.M.iron });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, ...G.M.plasticWhite, emissive: [40, 24, 7], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: norm([dir[0] * lean, -1, dir[2] * lean]), color: [1.0, 0.62, 0.22], intensity, range: 14, innerDeg: outerDeg - 14, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: true, broad: true });
  };
  lampAt(17.1, 16.5, 'lamp_lane_w', [0, 0, -1], 40, 120, 0.3);   // the lane's two lamps stand in the south kerb's barrier line and throw north over the lane: a lane man's mark is
  lampAt(23.9, 16.5, 'lamp_lane_e', [0, 0, -1], 40, 120, 0.3);   // on his lamp's rim (he is lit, to his mate and to anyone), and the lot a stride behind him is not
  lampAt(10.7, 16.5, 'lamp_boom', [-0.6, 0, -0.8], 38, 120, 0.35);   // on the south kerb east of the boom, thrown north-west over the crossing and the gap in the kerb wall
  grp('lights');
  G.bulb(21.9, 10.3, 'bulb_office', 'forecourt', true, 14); G.bulb(27.9, 10.3, 'bulb_impound_door', 'forecourt', false); G.bulb(14.9, 10.3, 'bulb_records', 'forecourt', false);
  G.bulb(32.9, 13.1, 'bulb_fence', 'fence', true, 7);
  G.wire(21.9, 10.3, 27.9, 10.3, 2.95); G.wire(14.9, 10.3, 21.9, 10.3, 2.95); G.wire(32.9, 12.5, 32.9, 13.1, 2.95);
  for (const x of [14.9, 21.9, 27.9]) G.wire(x, 9.62, x, 10.3, 2.95);                    // the forecourt's string is tied back to the house's face over each door
  add({ c: [32.9, 2.71, 12.46], h: [0.02, 0.26, 0.02], ...G.M.galv });                    // a bracket on the kerb wall's coping for the fence door's bulb
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(22.0, 8.6); beacon(33.0, 20.2);

  // ---------------- doors (closedDir 0: the leaf runs +x from the hinge, in a wall along x · π/2: +z, in a wall along z) ----------------
  const X = 0, Z = HALF;
  const doorDefs: LevelDoorDef[] = [
    { name: 'records', hinge: [14.32, 9.5], closedDir: X, width: 1.16 },
    { name: 'office', hinge: [21.32, 9.5], closedDir: X, width: 1.16 },                 // the lit way in: not locked (the clerk is in, or has left it so: on the set without him the room is the camera's and the forecourt man's) — open it under the bulb, or come round
    { name: 'impound', hinge: [27.32, 9.5], closedDir: X, width: 1.16 },
    { name: 'rec_w', hinge: [13.0, 5.32], closedDir: Z, width: 1.16, locked: true },                  // the dark way in, off the west yard
    { name: 'imp_e', hinge: [31.0, 5.32], closedDir: Z, width: 1.16 },
    { name: 'off_imp', hinge: [25.0, 6.82], closedDir: Z, width: 1.16 },
    { name: 'fence_e', hinge: [32.32, 12.4], closedDir: X, width: 1.16, locked: true },               // the kerb wall's leaf at the east end: the camera's door
    { name: 'hut_e', hinge: [8.0, 18.32], closedDir: Z, width: 1.16 },                                // the boom hut's back door, on the lot
    { name: 'shed_w', hinge: [30.0, 20.82], closedDir: Z, width: 1.16 },
    // the wall's five foot gates: the only `exterior` leaves
    { name: 'gate_n', hinge: [7.32, 4.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'gate_s', hinge: [15.32, 24.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'gate_e', hinge: [36.0, 17.32], closedDir: Z, width: 1.16, exterior: true },
    { name: 'gate_ne', hinge: [36.0, 6.42], closedDir: Z, width: 1.16, exterior: true },
    { name: 'gate_w', hinge: [4.0, 21.32], closedDir: Z, width: 1.16, exterior: true },
  ];
  const THICK = new Set(['records', 'office', 'impound', 'rec_w', 'imp_e', 'fence_e', 'hut_e', 'shed_w']);   // leaves in 0.24 walls that are not the perimeter's: their frames are cut the thick way
  for (const d of doorDefs) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- devices: the fence door's camera on its own battery, the office's on the mains ----------------
  const devices: DeviceDef[] = [
    // on the kerb wall's road face west of the fence door, looking east along the wall at whoever stands at the leaf
    { kind: 'camera', name: 'cam_east', pos: [30.2, 2.6, 12.62], yaw: 1.25, pitch: -0.42, fovDeg: 60, range: 5.5, mains: false },
    // the office's south-east corner, fixed on the safe and the inner door
    { kind: 'camera', name: 'cam_server', pos: [24.7, 2.6, 9.15], yaw: -2.85, pitch: -0.32, fovDeg: 80, range: 8, mains: true },
  ];

  furnish(K, G);                                                                  // LAST: what makes each place somebody's (lived.* — the tail of every list)

  const S0 = QUIET.spots[0], E0 = QUIET.exits[0];
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices,
    breaker: { pos: [35.68, 1.35, 21.6], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [...QUIET.starts[0].sam],
    routes: CROSSING_ROUTES.map(r => ({ ...r, points: r.points.map(p => [...p] as Vec3), wait: [...r.wait] })), chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    mission: { serverRoom: { ...S0.area }, entryDoor: S0.door, rack: { index: S0.rackIndex, front: [...S0.front], halfW: S0.halfW }, exfilDoor: E0.door, exfilX: E0.x, exfilZ: E0.z, exfilOut: [...E0.out] },
  };

  // ---------------- what is underfoot: earth and gravel are 'asphalt' (the nearest of the six), slabs 'stone' (the loudest: the forecourt and the pad carry) ----------------
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'office_rug', mat: 'carpet', x0: 21.0, z0: 6.8, x1: 23.4, z1: 8.4 },
      { id: 'house', mat: 'stone', x0: 13, z0: 4, x1: 31, z1: 9.5 },
      { id: 'forecourt', mat: 'stone', x0: 13, z0: 9.5, x1: 31, z1: 12.4 },
      { id: 'pad', mat: 'stone', x0: 14, z0: 12.8, x1: 27, z1: 16.4 },
      { id: 'hut', mat: 'stone', x0: 4, z0: 16.6, x1: 8, z1: 20 },
      { id: 'shed', mat: 'stone', x0: 30, z0: 19.5, x1: 36, z1: 24 },
    ],
  };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the south gate from the lorry park, where the pair starts — the
  // lot's pickup and the seized blue box over the wall behind them. The pallet of crates and the two tyres left outside the gate (`G.crates(11.4, 26.4 …)`,
  // `G.tyres(12.9, 25.3 …)` above) stand where the file of five forms, so they are out of the picture: by id, as the export numbers them (the kit's list is the file's, box for box).
  // FOR THE PICTURE ONLY (`add`: the mission never loads these): only `exterior` lamps stay lit in a picture and the lane's are 8 m off, so the strip behind the
  // gate was black, and what makes this a crossing (the booms, the lane) is under the tiles. So the picture gets a work bulb on a pole against the wall,
  // past the HESCO column (over its first cell, at 30, the cell's top burned white on the page still), and a spare boom — the lane's own post and arm (`add` at 10.3, 16.5 above), its arm down along the HESCO column, banded red.
  // The camera sees the tops of things there, not the floor: both stand over 1 m. Never seen on a GPU.
  const kitAdd: NonNullable<KitViewData['ways'][number]['add']> = {
    boxes: [
      { id: 'kv_pole', group: 'kv.lamp', c: [12.45, 1.2, 23.8], h: [0.035, 1.2, 0.035], material: 'galv' },
      { id: 'kv_arm', group: 'kv.lamp', c: [12.45, 2.38, 23.52], h: [0.025, 0.025, 0.3], material: 'galv' },
      { id: 'kv_fix', group: 'kv.lamp', c: [12.45, 2.3, 23.25], h: [0.06, 0.06, 0.06], material: 'plasticWhite', emissive: [40, 24, 7], flags: ['NoShadow'] },
      { id: 'kv_boom_post', group: 'kv.boom', c: [12.2, 0.55, 23.15], h: [0.09, 0.55, 0.09], material: 'paintRust' },
      { id: 'kv_boom_arm', group: 'kv.boom', c: [12.2, 1.02, 22.2], h: [0.04, 0.04, 1], material: 'paintCream', flags: ['NoShadow'] },   // 2 m of arm: at 2.9 its far end ran under the cards
      ...[22.8, 22.2, 21.6].map((z, i) => ({ id: `kv_boom_band${i}`, group: 'kv.boom', c: [12.2, 1.02, z] as Vec3, h: [0.045, 0.045, 0.14] as Vec3, material: 'prodRed', flags: ['NoShadow' as const] })),
      { id: 'kv_boom_rest', group: 'kv.boom', c: [12.2, 0.45, 21.3], h: [0.05, 0.45, 0.05], material: 'paintRust' },
    ],
    lamps: [{ id: 'kv_bulb', kind: 'point', pos: [12.45, 2.2, 23.25], dir: [0, -1, 0], color: [1, 0.62, 0.22], intensity: 14, range: 7, innerDeg: 0, outerDeg: 180, group: 'kv', enabled: true, volumetric: 0.05, radius: 0.06, mains: false, fixture: 'kv_fix' }],
  };
  // (FOUND, not typed: an unnamed box has its place in the file for an id, so a box added earlier in this generator would turn a typed list onto other boxes.
  //  The eleven are what those two calls laid, counted off the kit's list either side of them; a count that is not eleven throws.)
  if (lorryPark1 - lorryPark0 !== 11) throw new Error(`crossing: the gear screen's way hides the 11 boxes of the lorry park's crates and tyres and the two calls laid ${lorryPark1 - lorryPark0}`);
  const lorryParkOut = Array.from({ length: lorryPark1 - lorryPark0 }, (_, k) => `box_${String(lorryPark0 + k).padStart(4, '0')}`);
  const kitView: KitViewData = { ways: [{ door: 'gate_s', ref: [15.9, 25.9], side: -1, hide: lorryParkOut, add: kitAdd }] };
  // what a row calls the doors (scenarios.doorNames — game/doornames.ts; no bearing in a name): the level lists no rooms, so each is named by what it is known by above —
  // the two gates the duty section comes by as RESPONSE names them, the rest by what stands outside or which wall the leaf is in
  const doorNames = [{ door: 'off_imp', name: 'customs office to impound door' }, { door: 'gate_n', name: 'customs yard gate' }, { door: 'gate_ne', name: 'impound yard gate' }, { door: 'gate_s', name: 'lorry park gate' }, { door: 'gate_w', name: 'tea stall wicket' }, { door: 'gate_e', name: 'ditch wicket' }, { door: 'fence_e', name: 'kerb wall door' }, { door: 'hut_e', name: 'boom hut back door' }, { door: 'rec_w', name: 'records yard door' }, { door: 'imp_e', name: 'impound yard door' }, { door: 'shed_w', name: 'shed door' }];
  return { level, scenarios: { quiet: QUIET, response: RESPONSE, kitView, doorNames }, groups: trace.groups, surfaces };
}

// ---------------------------------------------------------------- LIVED-IN ROOMS ----------------------------------------------------------------
// What each place of the crossing is FOR, seen from above (src/scene/lived.ts: every box here is in a group `lived.<place>`, every prop is named
// `lived.<place>.<what>`, all of it the tail of the lists and left out with the switch off). No light and no change to one: the hiding dark is the level.
// Outdoors everything is low or against a wall — the lane is a lit kill zone and the lot is the pair's cover as it was dealt.
// A SOLID thing's top is either under 0.2 m (feet and the nav grid both pass over it) or over 0.25 (both go round): between the two a body is stopped by floor the grid calls free.
function furnish(K: ReturnType<typeof officeKit>, G: ReturnType<typeof gwotKit>): void {
  const L = livedQuiet(K, G.M);
  const SPINES = ['paintRust', 'paintGreen', 'rugNavy', 'rugMadder', 'paintBlue', 'rugOchre'] as const;

  // ---- THE RECORDS ROOM = the ledger archive: a wall of ledgers, a rack of them standing in the floor, the card index by the grey cabinet ----
  L.room('records');
  L.shelf(18.74, 6.7, 2.6, 0.36, 1.5, false, 3);                                                    // the east wall's shelves
  for (let i = 0; i < 5; i++) L.on(18.74, 5.66 + i * 0.52, 1.5, 1.7 + 0.03 * (i % 3), 0.14, 0.21, SPINES[i]);
  L.s(18.74, 6.7, 0.9, 1.12, 0.12, 1.1, 'sack');
  L.s(16.9, 6.5, 0, 1.2, 0.28, 0.8, 'woodGrey');                                                     // the rack in the floor, ledgers stood along its top
  for (let i = 0; i < 5; i++) L.s(16.9, 5.86 + i * 0.32, 1.2, 1.4 + 0.03 * ((i + 1) % 3), 0.24, 0.13, SPINES[(i + 2) % 6]);
  L.s(16.3, 4.39, 0, 1.0, 0.6, 0.23, 'woodGrey');                                                    // the card index: a chest of small drawers, one left open
  L.s(16.7, 4.78, 0.62, 0.76, 0.17, 0.16, 'woodGrey'); L.d(16.7, 4.78, 0.76, 0.775, 0.14, 0.13, 'whitewash');
  L.s(16.0, 4.4, 1.0, 1.08, 0.1, 0.07, 'whitewash'); L.s(16.55, 4.4, 1.0, 1.07, 0.12, 0.05, 'plasticBlack');
  L.d(17.4, 8.6, 0.75, 0.765, 0.33, 0.22, 'paintRust'); L.paper(17.24, 8.6, 0.765, 0, 0.3, 0.4); L.paper(17.56, 8.6, 0.765, 0, 0.3, 0.4);   // on the table: a ledger left open, two more, the ink
  L.s(18.05, 8.45, 0.75, 0.83, 0.15, 0.2, 'paintGreen'); L.s(18.03, 8.47, 0.83, 0.9, 0.14, 0.19, 'rugMadder', 0.25); L.s(16.95, 8.8, 0.75, 0.78, 0.06, 0.04, 'plasticBlack');
  L.mat(14.9, 7.0, 0.9, 3.6, 'sack'); L.line(14.5, 5.2, 14.5, 8.8, 0.06, 'rugMadder'); L.line(15.3, 5.2, 15.3, 8.8, 0.06, 'rugMadder');     // a coir runner, door to cabinet
  L.d(16.4, 6.95, 0, 0.22, 0.17, 0.24, 'whitewash'); L.d(16.4, 6.95, 0.22, 0.226, 0.03, 0.25, 'paintRust'); L.d(16.42, 6.25, 0, 0.16, 0.16, 0.22, 'paintCream', 0.15);   // manifests tied in bundles, on the floor by the rack
  L.prop('chair', 'stool', 17.15, 5.3, 0.2, 3, [L.part(0, 0, 0.3, 0, 0.13, 0.13, 'woodGrey'), L.part(0, 0.3, 0.34, 0, 0.17, 0.17, 'poplar')]);
  L.carton('ledgers', 16.0, 5.7, 0.1, 0.5, 0.36, 0.3, 'coyote', 'paintRust');

  // ---- THE OFFICE = the passport desk: the typewriter and the stamps, a sorting rack of pigeonholes, the flag, a bench for whoever is made to wait ----
  L.room('office');
  L.s(19.3, 6.95, 0, 0.8, 0.22, 0.9, 'woodGrey'); L.s(19.17, 6.95, 0.8, 1.5, 0.09, 0.9, 'woodGrey');   // the sorting rack on the west wall
  for (let i = 0; i < 5; i++) L.s(19.38, 6.2 + i * 0.375, 0.8, 0.9 + 0.03 * (i % 2), 0.1, 0.12, (['whitewash', 'paintBlue', 'paintCream', 'paintRust', 'whitewash'] as const)[i]);
  L.s(20.5, 4.72, 0.75, 0.87, 0.2, 0.17, 'plasticBlack'); L.d(20.5, 4.58, 0.87, 1.0, 0.13, 0.008, 'whitewash'); L.s(20.5, 4.6, 0.87, 0.91, 0.22, 0.03, 'iron');   // the typewriter, a sheet in it
  L.s(21.1, 4.55, 0.75, 0.8, 0.14, 0.05, 'woodGrey'); L.s(21.1, 4.55, 0.8, 0.86, 0.12, 0.025, 'paintRust');                                                // the stamp rack
  L.s(19.98, 4.9, 0.75, 0.81, 0.07, 0.1, 'paintGreen'); L.s(20.0, 4.88, 0.81, 0.85, 0.07, 0.1, 'rugMadder', 0.3); L.mug(21.25, 4.95, 0.75, 'prodOrange', 0.035, 0.09);   // passports held back, his tea
  L.d(20.6, 4.135, 1.2, 1.9, 0.6, 0.012, 'woodGrey'); L.d(20.35, 4.15, 1.45, 1.8, 0.14, 0.004, 'whitewash'); L.d(20.85, 4.15, 1.3, 1.6, 0.11, 0.004, 'prodYellow');   // the notice board over the desk
  L.s(19.35, 9.05, 0, 0.08, 0.15, 0.15, 'block'); L.s(19.35, 9.05, 0.08, 2.1, 0.025, 0.025, 'woodGrey');                                                   // the flag in the corner
  L.d(19.52, 9.05, 1.87, 2.05, 0.15, 0.012, 'paintGreen'); L.d(19.52, 9.05, 1.69, 1.87, 0.15, 0.012, 'whitewash'); L.d(19.52, 9.05, 1.51, 1.69, 0.15, 0.012, 'paintRust');   // (cloth: drawn only — the lowest band hangs at 1.51)
  L.bench(24.68, 4.95, 1.3, false); L.s(24.68, 4.7, 0.44, 0.62, 0.13, 0.22, 'paintRust');           // the waiting bench, a suitcase left on it
  L.line(19.7, 5.9, 23.0, 5.9, 0.07, 'prodYellow'); L.mat(21.9, 9.0, 0.9, 0.5, 'rubber');                                                                    // the line nobody crosses unasked; the door mat
  L.pail('bin', 19.75, 5.4, 'plasticBlack', 'whitewash');
  L.carton('parcels', 19.75, 8.3, 0.2, 0.44, 0.34, 0.26, 'coyote', 'whitewash');

  // ---- THE IMPOUND = seized goods: a trestle of cloth and cigarettes under the bulb with the tally book, a platform scale, chalked bays round each pile ----
  L.room('impound');
  L.mat(28.3, 6.6, 2.5, 1.3, 'tarpBlue');                                                                                                                    // laid out on a tarp
  L.s(28.3, 6.6, 0.7, 0.74, 0.9, 0.3, 'ply'); L.s(27.6, 6.6, 0, 0.7, 0.04, 0.26, 'woodGrey'); L.s(29.0, 6.6, 0, 0.7, 0.04, 0.26, 'woodGrey');
  for (let i = 0; i < 3; i++) L.s(27.66 + i * 0.21, 6.6, 0.74, 0.92, 0.09, 0.26, (['rugMadder', 'rugNavy', 'rugOchre'] as const)[i]);                        // bolts of cloth
  L.s(28.6, 6.55, 0.74, 0.86, 0.2, 0.14, 'whitewash'); L.d(28.6, 6.55, 0.86, 0.866, 0.2, 0.04, 'paintRust'); L.d(29.0, 6.6, 0.74, 0.755, 0.12, 0.17, 'paintGreen');   // cartons of cigarettes; the tally book
  L.s(27.0, 6.05, 0, 0.1, 0.25, 0.3, 'iron'); L.s(27.0, 5.8, 0.1, 0.95, 0.035, 0.035, 'iron'); L.s(27.0, 5.8, 0.95, 1.1, 0.14, 0.05, 'paintCream'); L.s(27.0, 6.08, 0.1, 0.3, 0.2, 0.24, 'sack');   // the scale, a sack on it
  const bay = (x0: number, z0: number, x1: number, z1: number) => { L.line(x0, z0, x1, z0, 0.04, 'whitewash'); L.line(x0, z1, x1, z1, 0.04, 'whitewash'); L.line(x0, z0, x0, z1, 0.04, 'whitewash'); L.line(x1, z0, x1, z1, 0.04, 'whitewash'); };
  bay(25.5, 8.05, 26.75, 9.3); bay(29.65, 8.1, 30.8, 9.3);                                                                                                  // chalk round the sacks and the drums
  L.s(26.85, 5.0, 0.42, 0.6, 0.3, 0.2, 'whitewash'); L.d(26.85, 5.0, 0.6, 0.606, 0.3, 0.05, 'paintRust'); L.s(27.6, 5.0, 0.42, 0.54, 0.25, 0.18, 'paintCream');   // more cartons, dumped on the cot
  L.carton('television', 27.3, 7.9, 0.1, 0.5, 0.4, 0.42, 'coyote', 'plasticBlack', 7);
  L.carton('radios', 30.2, 7.72, 0, 0.4, 0.3, 0.26, 'coyote', 'prodRed');

  // ---- THE BOOM HUT = the gate man's own: his STOP paddle and vest on the cot, the field phone and the gate log on a crate, tins on a shelf ----
  L.room('hut');
  L.s(7.45, 17.0, 0, 0.45, 0.3, 0.22, 'woodGrey'); L.s(7.45, 17.0, 0.45, 0.57, 0.12, 0.09, 'olive'); L.d(7.45, 17.0, 0.57, 0.6, 0.1, 0.025, 'plasticBlack'); L.paper(7.2, 17.05, 0.45, 0.2, 0.2, 0.28, 'paintCream');
  L.rnd(4.72, 17.82, 0.47, 0.49, 0.17, 'paintRust', false); L.d(4.72, 17.82, 0.49, 0.495, 0.12, 0.03, 'whitewash'); L.d(4.72, 18.1, 0.47, 0.49, 0.02, 0.14, 'poplar');   // the paddle: on the blanket (top 0.47), south of the pillow
  L.d(4.76, 18.55, 0.47, 0.5, 0.2, 0.25, 'prodOrange');                                                       // the vest
  L.d(6.2, 19.8, 1.2, 1.24, 0.5, 0.08, 'poplar'); for (let i = 0; i < 3; i++) L.d(5.9 + i * 0.3, 19.8, 1.24, 1.36, 0.06, 0.06, (['prodRed', 'prodGreen', 'prodYellow'] as const)[i]);
  L.d(7.845, 17.6, 0.9, 1.7, 0.03, 0.22, 'coyote');                                                                                                                 // his coat on the wall
  L.mat(5.6, 18.2, 0.9, 1.2, 'blanketGrey'); L.line(5.15, 17.6, 6.05, 17.6, 0.06, 'rugMadder'); L.line(5.15, 18.8, 6.05, 18.8, 0.06, 'rugMadder');                  // a felt mat
  L.stool('stool', 6.85, 17.05, 0.3);

  // ---- THE GENERATOR SHED = the lamp store: a ladder, a reel of orange cable, a row of spare lamp heads on a shelf, a duckboard at the breaker ----
  L.room('shed');
  L.d(32.6, 19.82, 0, 0.06, 1.4, 0.02, 'poplar'); L.d(32.6, 20.12, 0, 0.06, 1.4, 0.02, 'poplar'); for (let i = 0; i < 4; i++) L.d(31.55 + i * 0.7, 19.97, 0.01, 0.05, 0.02, 0.15, 'poplar');
  L.s(35.2, 23.2, 0, 0.06, 0.36, 0.36, 'ply'); L.rnd(35.2, 23.2, 0.06, 0.5, 0.26, 'prodOrange'); L.oct(35.2, 23.2, 0.5, 0.56, 0.5, 'ply');   // the reel: the top flange is what is seen (an octagon, clear of both walls); the foot and the drum are under it
  const sy = L.shelf(35.66, 20.45, 1.1, 0.4, 1.3, false, 3)[2];
  L.s(35.66, 20.15, sy, sy + 0.12, 0.17, 0.13, 'iron'); L.d(35.66, 20.15, sy + 0.12, sy + 0.125, 0.13, 0.1, 'plasticWhite'); L.s(35.66, 20.5, sy, sy + 0.14, 0.14, 0.1, 'paintCream'); L.rnd(35.66, 20.8, sy, sy + 0.07, 0.13, 'prodOrange');
  for (let i = 0; i < 3; i++) { L.s(35.66, 20.13 + i * 0.32, 0.8, 1.0, 0.13, 0.11, 'galv'); L.d(35.526, 20.13 + i * 0.32, 0.83, 0.97, 0.004, 0.085, 'glassDark'); }   // three lamp heads in a row, dark glass to the room
  L.mat(32.3, 22.4, 1.3, 0.9, 'oil', 0.3); L.d(32.2, 22.45, 0, 0.05, 0.28, 0.2, 'galv');                                                                             // what the set drips, and the tray that misses it
  L.mat(35.3, 21.6, 0.6, 0.9, 'poplar');
  L.own(G.jerryCan(31.6, 22.3, 0.3), 'fuel');

  // ---- THE WEST YARD = the vehicle impound: numbered bays, seized white goods along the wall, bicycles, a SEIZED board ----
  L.room('yard_west');
  L.s(4.46, 6.4, 0, 1.5, 0.3, 0.3, 'plasticWhite');                                                               // a fridge
  L.s(4.46, 7.1, 0, 0.85, 0.3, 0.3, 'whitewash'); L.d(4.765, 7.1, 0.3, 0.6, 0.004, 0.14, 'glassDark');                                                             // a washing machine
  L.s(4.46, 7.8, 0, 0.85, 0.3, 0.3, 'paintCream'); L.d(4.4, 7.68, 0.85, 0.86, 0.2, 0.07, 'plasticBlack'); L.d(4.4, 7.92, 0.85, 0.86, 0.2, 0.07, 'plasticBlack');    // a cooker
  L.line(8.9, 5.6, 8.9, 10.9, 0.08, 'whitewash'); L.line(11.1, 5.6, 11.1, 10.9, 0.08, 'whitewash'); L.line(6.9, 8.0, 6.9, 10.9, 0.08, 'whitewash');                // the bays
  L.s(10.3, 12.12, 0.48, 0.54, 0.5, 0.02, 'paintBlue'); L.s(9.75, 12.12, 0, 0.64, 0.32, 0.02, 'rubber'); L.s(10.85, 12.12, 0, 0.64, 0.32, 0.02, 'rubber');         // a bicycle against the kerb wall
  L.s(10.8, 12.12, 0.9, 0.94, 0.03, 0.14, 'iron'); L.s(10.05, 12.12, 0.8, 0.86, 0.1, 0.05, 'plasticBlack');
  L.d(10.8, 12.12, 0.64, 0.9, 0.012, 0.012, 'iron'); L.d(10.05, 12.12, 0.54, 0.8, 0.012, 0.012, 'iron');                                                           // the stem and the seat post
  L.d(6.0, 10.6, 0, 0.05, 0.5, 0.02, 'paintGreen', 0.5); L.oct(5.6, 10.82, 0, 0.04, 0.3, 'rubber', false); L.oct(6.42, 10.36, 0, 0.04, 0.3, 'rubber', false);     // another, flat on the ground
  L.mat(10.0, 11.5, 1.3, 0.9, 'oil', 0.2);
  L.s(11.6, 9.0, 0, 1.3, 0.03, 0.03, 'woodGrey'); L.s(11.6, 9.0, 0.9, 1.3, 0.25, 0.015, 'whitewash'); L.d(11.6, 9.0, 1.14, 1.24, 0.25, 0.02, 'paintRust');           // the board
  L.carton('carton', 12.3, 8.6, 0.1, 0.5, 0.4, 0.34, 'coyote', 'sack');
  L.tyre('tyre', 5.5, 8.6, 0.2);

  // ---- THE EAST YARD = the dog run: a kennel on the north wall, the chain and its stake, the circle it has worn, the handler's bench ----
  L.room('yard_east');
  L.s(33.0, 4.6, 0, 0.7, 0.5, 0.42, 'ply'); L.s(33.0, 4.62, 0.7, 0.78, 0.58, 0.5, 'tin'); L.d(33.0, 5.024, 0.05, 0.5, 0.18, 0.004, 'plasticBlack');
  L.oct(33.3, 6.9, 0.016, 0.03, 1.15, 'dust', false);
  L.line(33.0, 5.1, 33.3, 6.9, 0.035, 'iron', 0.034); L.s(33.3, 6.95, 0, 0.19, 0.03, 0.03, 'iron');
  L.mat(33.0, 5.38, 0.9, 0.5, 'straw', 0, 0.034); L.rnd(32.55, 5.75, 0, 0.07, 0.13, 'galv', false);
  L.s(34.0, 4.5, 0, 0.45, 0.22, 0.3, 'sack'); L.d(34.0, 4.5, 0.45, 0.456, 0.12, 0.16, 'prodRed');
  L.bench(31.34, 8.8, 1.1, false); L.d(31.34, 8.6, 0.44, 0.47, 0.1, 0.16, 'rubber'); L.d(33.95, 7.7, 0, 0.09, 0.045, 0.045, 'prodRed');                            // a muzzle on the bench, a ball
  L.pail('water', 32.65, 6.25, 'plasticBlue');
  L.carton('tins', 34.2, 5.3, 0.3, 0.4, 0.3, 0.24, 'coyote', 'prodRed');

  // ---- THE FORECOURT = the queue: a bench on the house wall, a painted lane to the office door, a rail, a suitcase open on the inspection table ----
  L.room('forecourt');
  L.bench(18.4, 9.82, 2.6, true); L.s(17.6, 9.82, 0.44, 0.64, 0.2, 0.13, 'rugMadder'); L.s(19.2, 9.8, 0.44, 0.68, 0.045, 0.045, 'paintGreen');
  L.line(21.3, 9.7, 21.3, 12.2, 0.07, 'prodYellow'); L.line(22.5, 9.7, 22.5, 12.2, 0.07, 'prodYellow'); for (let i = 0; i < 3; i++) L.line(21.55, 10.5 + i * 0.6, 22.25, 10.5 + i * 0.6, 0.1, 'prodYellow');
  L.mat(21.9, 10.95, 1.06, 2.5, 'dust');                                                                                                                     // worn pale by feet
  L.s(22.8, 10.95, 0, 0.95, 0.035, 0.035, 'iron'); L.s(22.8, 12.1, 0, 0.95, 0.035, 0.035, 'iron'); L.s(22.8, 11.52, 0.84, 0.88, 0.015, 0.56, 'prodRed');
  L.s(25.95, 11.85, 0.75, 0.87, 0.3, 0.2, 'paintRust'); L.s(25.95, 12.07, 0.75, 1.1, 0.3, 0.015, 'paintRust'); L.d(25.95, 11.84, 0.87, 0.9, 0.26, 0.16, 'rugNavy'); L.d(26.03, 11.8, 0.9, 0.915, 0.12, 0.1, 'whitewash');
  L.s(26.9, 11.9, 0.75, 0.97, 0.3, 0.14, 'olive'); L.d(26.45, 11.62, 0.75, 0.77, 0.3, 0.015, 'iron'); L.d(26.8, 11.62, 0.75, 0.775, 0.09, 0.07, 'glassDark');     // a duffel; the mirror on a stick
  L.carton('suitcase', 28.5, 11.3, 0.4, 0.6, 0.4, 0.22, 'paintBlue', 'plasticBlack', 6);
  L.pail('bin', 19.85, 10.08, 'plasticGreen', 'whitewash');

  // ---- THE LANE = the inspection pad: a hatched bay behind the screen, stop bars, the spike strip and the hump — paint and rubber, nothing to stand behind ----
  L.room('lane');
  L.line(18.0, 15.0, 23.0, 15.0, 0.08, 'prodYellow'); L.line(18.0, 16.05, 23.0, 16.05, 0.08, 'prodYellow'); L.line(18.0, 15.0, 18.0, 16.05, 0.08, 'prodYellow'); L.line(23.0, 15.0, 23.0, 16.05, 0.08, 'prodYellow');
  for (let i = 0; i < 4; i++) L.line(18.3 + i * 1.2, 16.0, 19.1 + i * 1.2, 15.05, 0.07, 'prodYellow');
  L.line(14.7, 13.0, 14.7, 16.2, 0.25, 'whitewash'); L.line(26.3, 13.0, 26.3, 16.2, 0.25, 'whitewash');
  L.d(15.5, 14.6, 0, 0.05, 0.12, 1.5, 'iron');
  L.d(25.4, 14.6, 0, 0.06, 0.2, 1.7, 'plasticBlack'); for (let i = 0; i < 4; i++) L.d(25.4, 13.3 + i * 0.87, 0.06, 0.064, 0.2, 0.16, 'prodYellow');
  const cone = (what: string, x: number, z: number) => L.prop('bin', what, x, z, 0, 1.5, [L.part(0, 0, 0.03, 0, 0.16, 0.16, 'prodOrange'), L.part(0, 0.03, 0.3, 0, 0.09, 0.09, 'prodOrange'), L.part(0, 0.3, 0.38, 0, 0.065, 0.065, 'whitewash'), L.part(0, 0.38, 0.5, 0, 0.04, 0.04, 'prodOrange')]);
  cone('cone_w', 17.3, 15.55); cone('cone_e', 23.7, 15.55);

  // ---- THE LOT = the drivers' rest in the west pocket: a rope bed, a cold brazier between two blocks, their cloth and cards on the ground (the way in from the
  //      west wicket, z 21.9, carries paint only); by the white truck a fuel can and a chock ----
  L.room('lot');
  L.s(7.3, 23.25, 0.3, 0.38, 0.95, 0.4, 'poplar'); L.d(7.3, 23.25, 0.38, 0.39, 0.88, 0.33, 'sack'); L.s(6.4, 23.25, 0, 0.42, 0.04, 0.38, 'poplar'); L.s(8.2, 23.25, 0, 0.42, 0.04, 0.38, 'poplar');
  L.s(6.68, 23.25, 0.38, 0.48, 0.18, 0.25, 'rugMadder'); L.d(7.75, 23.25, 0.39, 0.42, 0.38, 0.34, 'blanketBrown');
  L.oct(7.0, 20.75, 0, 0.3, 0.22, 'iron'); L.d(7.0, 20.75, 0.3, 0.305, 0.15, 0.15, 'blanketGrey');
  L.s(6.4, 20.6, 0, 0.19, 0.2, 0.1, 'block', 0.5); L.s(7.55, 20.9, 0, 0.19, 0.2, 0.1, 'block', -0.4);
  L.mat(7.3, 21.6, 1.4, 1.0, 'rugRed', 0.1); for (let i = 0; i < 2; i++) L.d(7.1 + i * 0.22, 21.55 + 0.06 * i, 0.03, 0.036, 0.04, 0.055, 'whitewash', 0.4 * i);
  L.rnd(7.75, 21.8, 0.03, 0.04, 0.14, 'galv', false); L.d(7.7, 21.8, 0.04, 0.12, 0.03, 0.03, 'prodOrange'); L.d(7.82, 21.76, 0.04, 0.12, 0.03, 0.03, 'prodOrange');
  L.s(8.05, 22.55, 0, 0.19, 0.12, 0.07, 'plasticBlack');
  L.pail('pail', 8.45, 23.0, 'galv');
  L.own(G.jerryCan(11.9, 20.7, 0.1, 'jerryYellow'), 'can'); L.chock('chock', 11.3, 20.44, 0.1);                                                                     // the white truck's: a can by its sill, a chock behind the front wheel
  L.carton('melons', 5.9, 22.6, 0.2, 0.5, 0.36, 0.24, 'woodGrey', 'prodGreen');

  // ---- OUTSIDE THE WALL: the tea stall's bench and samovar, and the border's striped post ----
  L.room('outside');
  L.bench(3.7, 18.6, 1.6, false); L.d(3.7, 18.2, 0.44, 0.52, 0.03, 0.03, 'prodOrange'); L.d(3.7, 18.9, 0.44, 0.52, 0.03, 0.03, 'prodOrange');
  L.s(2.95, 17.45, 0, 0.5, 0.2, 0.2, 'block'); L.rnd(2.95, 17.45, 0.5, 0.95, 0.13, 'galv'); L.s(2.95, 17.45, 0.95, 1.15, 0.04, 0.04, 'iron');
  L.s(19.0, 26.9, 0, 0.4, 0.07, 0.07, 'whitewash'); L.s(19.0, 26.9, 0.4, 0.8, 0.07, 0.07, 'paintRust'); L.s(19.0, 26.9, 0.8, 1.2, 0.07, 0.07, 'whitewash');
  L.own(G.plasticChair(3.2, 19.75, 0.6, 'plasticGreen'), 'chair');
}
