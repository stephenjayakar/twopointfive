// THE DISTRICT POLICE POST — a level for one man sneaking: a walled mud-brick post at night, a main building of seven rooms off one corridor, a generator
// shed, a guard hut at the gate, two pickups under a tin canopy, a radio mast behind the radio room and an impound of seized vehicles down the east wall.
// No story: a place, a thing to take, a way out. Six beats are authored; a run mans five of them (the plain file mans all six).
//   bun run tools/levels/export.ts police-post      → levels/police-post.json (its footstep `surfaces`, its scenarios.quiet block; no room clear in it)
//   bun run tools/qa/quiet-check.ts police-post.json  the quiet block against the built floor, every deal started
//   bun run tools/qa/quiet-light.ts police-post       the light a sneaking man stands in, on paper
//   bun run tools/qa/quiet-plan.ts police-post --png  the plan picture: beats, starts, places, ways out, the cameras' cones
//   bun run tools/qa/solo-night.ts --level police-post.json --quiet --plan careful,sneak,walk --out short --seeds 1-12      the scripted player against it
//   QUIET_VARIANT=1,0,0 bun run tools/levels/export.ts police-post     → levels/police-post-v100.json: ONE deal (spot, patrol set, start), a scratch file
//   page: ?levelFile=police-post.json&quiet   (&quiet=N pins the deal)
//
// THE ONE IDEA — HANDS. Every door that matters is locked, and the only ring of keys is on the desk sergeant's belt. Most men have the armoury pad's four
// digits in their heads (the two hard ones give nothing while calm). Or you kneel four seconds a lock in the corridor, where a man walks. Or the breaker:
// cut the power and the sergeant, the ring on his belt, is the man who walks out to the shed to put it back.
//   · THE LOCKS: the four corridor doors of the rooms worth having — cells, radio room, commander's office, duty room — and the east side door (keyed on
//     its impound face) are on ONE key ('post'), keyed on their outer face (from inside every one of them opens freely). THE ARMOURY HAS NO CORRIDOR DOOR:
//     its doorway is bricked up, and its only door is from the radio room, on a keypad (pad_armoury; it opens INTO the armoury, a thumb-turn on that side).
//     The radio room and the office are joined by a free door. So one lock picked (radio or office) gives two of the three places the thing can be, and
//     the armoury wants the pad's digits on top of that — out of a man's mouth — or a boot on the pad door, which the floor hears.
//   · THE RING: only the desk man's route carries the key (`keys: ['post']`; every other route `keys: []` — staff open every lock whatever they carry, `keys`
//     only decides what a questioned man can hand over). Grab him and ask (Space behind him, then the question row): 'mine's on my belt', and every 'post'
//     door then opens to the player like to staff — no pick, no kneeling. He is behind the counter in the lit duty room 25 s, 14 s at the filing cabinet in its
//     north-west corner with his back to the room (the grab), tries the corridor door's handle, and goes out of the front door for a look at the gate: the front door (free, on the forecourt, under the camera) or the duty room's own
//     bunk-room door (free, from the dark bunk room) is the way to his back.
//   · THE DIGITS: the sentry, the sergeant, the yard man and the generator man give the pad's code when asked (the corridor man and the man off watch are
//     hard: nothing while calm; every set has the sentry and the sergeant). With it the armoury opens from the radio room — itself behind a 'post' lock.
//   · THE CLOCK: a man taken does not answer the net, and is asked after in about a minute. The first pair of hands starts it.
//
//            x 4    9   13       18     23    27    31    36
//        z 4 +-[gate_n]-----------------------------------+
//            | canopy  ☼pool   back strip   (M)mast  tarps|
//            | 2 trucks                                wreck
//          8 |  ☼yard   tank+------+------+-----+--[w]-+  ║|
//            | (lit)   | cells|armry kp radio rd office|  ║|   THE IMPOUND: the wreck against the east wall,
//         12 |         +--c---+------+--r--+---o--+       |   a bay each side of the east gate (bulb_impound over the north one)
//            | (dark)    porch    c o r r i d o r   side_e == gate_e  → OUT
//       14.5 |         +-----d------+--b---+---s--+  ▪▪   |
//  gate_w == | hesco   | duty room  db bunk bs store store_e bikes|
//   START    |         |  (desk)    |  room | (dark)|     |
//       18.5 |         +----front---+------+------+       |
//       19.5 +-shed-+=ys=+  forecourt   ☼gate  +-hut-+     |
//            |   (B) se   bags                 hw    |     |
//       z 24 +---------+-----------[ main gate ]----+------+
//                                    (x 19..22)
//   kp the keypad door · [w] the office window · =ys= the yard wall and its leaf yard_sw · se the shed's door · (B) the breaker, on the shed's south wall
//
// THE WAYS IN (four openings in the wall): the MAIN GATE on the south (3 m, its leaves standing open) under lamp_gate, the guard hut a stride inside it, the
// camera over the front door panning the forecourt; the WEST GATE (a leaf; the yard inside it is dark as far as the porch); the NORTH GATE at the motor
// pool's mouth (a leaf, under lamp_pool and lamp_yard); the EAST GATE, into the impound — the base way out (the engine's exit test faces east).
// THE WAYS THROUGH THE BUILDING: the west porch (an open doorway on the corridor's west end: a look passes it both ways), the front door into the duty room,
// the east side door on the corridor's east end, the store's own door onto the impound, and the commander's office window on the back strip (a look and a
// round pass, a man does not). The dark way to the corridor is the store's door and the store / bunk room, both dark and both free.
// THE THING TO TAKE ('the case file'): the evidence locker in the armoury (under the room's one small lamp, cam_server on it — on its own battery: the
// breaker does not blind it), the commander's safe, or the radio table.
// THE LIGHTS: three yard lamps (lamp_gate over the forecourt, lamp_yard thrown north over the motor pool's mouth, lamp_pool on the north gate), the impound's
// bulb just inside the east gate; ceiling panels lit in the corridor's west end, the duty room, the shed, and one small lamp each over the locker and the
// radio set; dark: cells, bunk, store, office, the corridor's east tube — ALL ON THE MAINS: the breaker takes every one of them and cam_yard. Three battery
// things stay: the hut's lantern, the commander's desk lamp, cam_server. THE BREAKER is on the generator shed's SOUTH wall, inside (on the west wall — the
// perimeter's — the man sent to reset it was sent to a point inside that wall); the shed's door is on the forecourt, and the generator man spends a third of
// his beat in there on two sets of three. A tripped breaker is reset by the nearest calm man: the desk sergeant, ring on his belt, on 10 of 12 moments tried (the generator man when he is out there already) — eleven seconds of dark.
// THE SIX BEATS (POST_ROUTES below, one line each there): yard (the horseshoe round the wall) · gate (the sentry) · corridor (two uneven laps: the east end first, the
// porch, 48 s by his cot; then the lap again and 12 s) · generator (the bunk room ↔ the shed, by the front door) · desk (THE KEYS: the counter, the filing cabinet, the corridor door's handle, a look out of the front
// door) · bunk (the man off watch: a smoke by the impound, the store, the bunk room's stove). THE THREE SETS (QUIET.patrols): the corridor man is on EVERY set (without him
// a blind upright walk finished unseen on 4 seeds of 12) — 0 yard, gate, corridor, generator, desk · 1 yard, gate, corridor, bunk, desk · 2 gate, corridor,
// bunk, generator, desk: everyone is indoors — the yards are free and the building is full.
// DEVICES: cam_yard (over the front door, panning from the yard wall's leaf to the main gate, 12 s a sweep; mains), cam_server (the armoury; battery), pad_armoury (the armoury ↔
// radio door). (The corridor's tripwire is gone: a shin-high laser is not a mud-brick police post's. Nothing replaces it but the corridor man.)
// LANDMARKS: THE MAST (the lattice radio mast and its dish behind the radio room, on the back strip) and THE IMPOUND (the east yard).
// BODY NOOKS (dark with every lamp burning and on nobody's beat; not tried with a body): the cells' anteroom; between the two pickups under the canopy;
// behind the tarped pallets in the yard's north-east corner; the store on set 0.
// REPLAY: three starts (west gate · north wall · east wall), three spots, three exits (east · north · west), three patrol sets.
//
// HOW IT WAS TUNED (tools/qa/solo-night.ts, the scripted player; the level moved, never the tool) — kept from the first build, do not undo blindly:
//   - the lamps (the compound's 260 cd / 65° lit the whole yard: now 120 cd / 34–48°); lamp_yard turned north off the gate → porch line;
//   - the shed's door from its north wall to its east, then the yard wall: the generator man saw the west gate from the forecourt on 9 seeds of 12;
//   - the yard man from a loop through yard_sw to a horseshoe that comes down the west yard in plain view;
//   - the desk man off the corridor (he came out of the duty door beside the armoury's): his key stop is INSIDE the duty room;
//   - the radio man (he lived in two of the three rooms the thing can be in) for the man off watch; the office door hung on its east jamb (the open leaf
//     shut the safe off from the script); the corridor man given his walk FIRST and his rest after, so a blind crossing of the porch meets him.
// Round two (10-10): the armoury's corridor doorway bricked up (hands or a boot, no third way); the corridor man's two uneven laps, the east end first (a blind walk in by the side door met nobody with the doors left open); the sergeant's cabinet
// stop; side_e on the key; cam_yard's sweep; each man of the bunk room a place of his own; the bastion moved off the yard man's line; the blue band.
// The polish pass (10-10): the lock graph and the ring; the corridor man on every set; the impound; the breaker moved; the generator man's and the man off
// watch's waits; the tripwire retired; the whole post rebuilt in the GWOT look kit on the same wall lines, blockers and lights.
//
// LIMITS IT IS BUILT INSIDE: the world is 40 × 28 m, the wall stands on x 4 / 36, z 4 / 24 and the 4 m outside it is the approach. needs.ts NEED_SPOTS and
// qrf.ts QRF_MARKS are the office's coordinates on this base. In the GWOT look kit (src/scene/gwotKit.ts). Units: metres. +X east, +Z south, +Y up.
// NOT SEEN DRAWN: laid out on paper and checked headless (validator, level-lint, quiet-check, quiet-light, the scripted solo night); nobody has looked at it on a GPU.
import type { Vec3 } from '../../src/math/vec';
import type { DeviceDef, Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { SurfacesData } from '../../src/scene/levelData';
import type { LevelScenarios, QuietData, Rect, ResponseData } from '../../src/scene/scenarios';
import { officeKit, normalize3, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_PART, type GwotMat } from '../../src/scene/gwotKit';
import type { MarkFace, MarkPal } from '../../src/scene/markings';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NOTES = 'The district police post at night, for one man sneaking: every door that matters is locked on one key and the only ring is on the desk sergeant\'s belt; most men know the armoury pad\'s code, and the armoury has no other door; or a lock is picked in the corridor a man walks, or the breaker brings the ring out to the shed. A perimeter wall with a lit main gate, two side gates and the east gate into the impound (the way out), a main building of seven rooms off one corridor, a generator shed with the breaker, a guard hut, two pickups under a canopy, the radio mast on the back strip. Six beats authored, five manned a deal; two cameras, a keypad door. In the GWOT look kit. Regenerate: bun run tools/levels/export.ts police-post';
export const MATERIALS = GWOT_MATERIALS;

/** The floor inside each space's walls (shells 0.24 thick, partitions 0.12). */
export const POST_ROOMS: Record<'cells' | 'armoury' | 'radio' | 'office' | 'corridor' | 'duty' | 'bunk' | 'store' | 'shed' | 'hut', Rect> = {
  cells: { x0: 13.12, x1: 17.94, z0: 8.12, z1: 11.94 },
  armoury: { x0: 18.06, x1: 22.94, z0: 8.12, z1: 11.94 },
  radio: { x0: 23.06, x1: 26.94, z0: 8.12, z1: 11.94 },
  office: { x0: 27.06, x1: 30.88, z0: 8.12, z1: 11.94 },
  corridor: { x0: 13.12, x1: 30.88, z0: 12.06, z1: 14.44 },
  duty: { x0: 13.12, x1: 19.94, z0: 14.56, z1: 18.38 },
  bunk: { x0: 20.06, x1: 25.94, z0: 14.56, z1: 18.38 },
  store: { x0: 26.06, x1: 30.88, z0: 14.56, z1: 18.38 },
  shed: { x0: 4.12, x1: 9.38, z0: 19.62, z1: 23.88 },
  hut: { x0: 22.62, x1: 26.38, z0: 21.12, z1: 23.88 },
};
const R = POST_ROOMS;
/** the level's own names for the floor no spot is in (scenarios.places: a radio line, a checkpoint row and the debrief say WHERE by these — rooms first,
 *  then the yards; a point in two is the first listed). THE MAST and THE IMPOUND are the two a man would say on the radio. */
/** what a row calls the doors (scenarios.doorNames — game/doornames.ts; no bearing in a name): the level lists no rooms, so the gates are named by what is behind them
 *  (the impound's as RESPONSE names it) and the outbuildings' and the block's own outside doors by what they are */
const DOOR_NAMES = [{ door: 'gate_e', name: 'impound gate' }, { door: 'gate_n', name: 'motor pool gate' }, { door: 'gate_w', name: 'side yard gate' }, { door: 'side_e', name: 'corridor end door' }, { door: 'store_e', name: 'store back door' }, { door: 'shed_e', name: 'generator shed door' }, { door: 'hut_w', name: 'gate hut door' }, { door: 'yard_sw', name: 'forecourt to side yard door' }];
const PLACES = { areas: [
  { name: 'cells', bounds: R.cells }, { name: 'corridor', bounds: R.corridor }, { name: 'duty room', bounds: R.duty }, { name: 'bunk room', bounds: R.bunk }, { name: 'store', bounds: R.store },
  { name: 'generator shed', bounds: R.shed }, { name: 'gate hut', bounds: R.hut }, { name: 'motor pool', bounds: { x0: 4.12, x1: 8.9, z0: 4.12, z1: 9.2 } },
  { name: 'mast', bounds: { x0: 22.5, x1: 27.5, z0: 4.12, z1: 7.88 } },
  { name: 'back strip', bounds: { x0: 9, x1: 31.1, z0: 4.12, z1: 7.88 } }, { name: 'west yard', bounds: { x0: 4.12, x1: 12.88, z0: 9.3, z1: 19.4 } },
  { name: 'forecourt', bounds: { x0: 9.6, x1: 31, z0: 18.62, z1: 23.88 } }, { name: 'impound', bounds: { x0: 31.12, x1: 35.88, z0: 4.12, z1: 23.88 } },
] };

/** THE SIX BEATS (level.routes: the union of every patrol set; a set mans five). Every waypoint with a wait is where he stands and looks, facing the way he
 *  came to it. `keys`: what a questioned man can hand over — the ring is the desk man's alone. */
export const POST_ROUTES: PatrolRoute[] = [
  // the perimeter walker, a horseshoe: gate → south-east corner → up the impound's lane → north-east corner → back strip, past the mast → motor pool → down
  // the west yard to the yard wall, and back the way he came. He comes into the west yard from the NORTH, in plain view the length of it, never through the
  // yard wall's leaf (tried as a full loop through that leaf: he stepped out of it five metres from a man crossing lamp_yard's pool)
  { name: 'yard', keys: [], points: [[20.5, 0, 22.4], [22.25, 0, 20.25], [27.6, 0, 19.9], [33.3, 0, 21.2], [33.4, 0, 16.5], [33.4, 0, 6.2], [22.0, 0, 6.0], [12.2, 0, 6.4], [9.6, 0, 10.4], [10.0, 0, 17.4], [9.6, 0, 10.4], [12.2, 0, 6.4], [22.0, 0, 6.0], [33.4, 0, 6.2], [33.4, 0, 16.5], [33.3, 0, 21.2], [27.6, 0, 19.9], [22.25, 0, 20.25]], wait: [4, 0, 0, 3, 0, 3, 0, 3, 0, 4, 0, 0, 0, 3, 0, 3, 0, 0] },
  // the sentry: the hut, the gate's inside, a look out through it, a look up the lane at the front door
  { name: 'gate', keys: [], points: [[24.6, 0, 22.5], [21.2, 0, 22.4], [20.5, 0, 25.2], [20.5, 0, 21.2]], wait: [12, 5, 6, 4] },
  // the corridor man: out of the bunk room at once → the corridor's west stop (ten seconds looking at the porch) → its east end → forty seconds on a
  // bunk. He passes all three of the north rooms' doors: a man on a knee at a lock is his to find. (Tried with the rest first: a blind crossing of the
  // porch then met nobody)
  // TWO LAPS IN ONE ROUTE, uneven: out of the store to the corridor's EAST end first (eight seconds facing the side door: a blind walk in from the impound
  // opens it in his face), down to the porch and straight back, forty-eight seconds by his cot; then the lap again and twelve — a man who counted the first
  // rest is wrong about the second. A careful man who lets him finish that first look has the corridor to himself for most of a minute. The
  // see-saw holds: while he walks the bunk room is one man short, while he rests the corridor is empty
  { name: 'corridor', keys: [], points: [[24.6, 0, 16.8], [29.6, 0, 13.25], [18.0, 0, 13.25], [24.6, 0, 16.8], [29.6, 0, 13.25], [18.0, 0, 13.25], [24.6, 0, 16.8]], wait: [2, 8, 2, 48, 4, 10, 12] },
  // the generator man: twenty-five seconds in the bunk room → through the duty room and out the front → twenty in the generator shed (nobody checks a
  // generator every fifty seconds) → back the same way
  { name: 'generator', keys: [], points: [[21.3, 0, 16.8], [14.0, 0, 20.6], [7.6, 0, 21.4]], wait: [25, 0, 20] },   // (by his own cot: no two men begin on one spot)
  // THE DESK MAN — THE KEYS: behind the counter, at the cabinet, across the room to try the corridor door's handle (he never opens it: tried as desk ↔
  // cells, he came out of that door three metres from the armoury's and looked down the lit end of the corridor at the porch), then out of the front door
  // for a look at the gate. His is the only ring: the stop by the 'duty' door is what puts a keyed door on his beat (dialogue.ts keyedDoorOn, 2.5 m)
  // HIS JOB: 25 s facing east over the counter with the front door, the duty door and the bunk-room door in his cone; 14 s at the filing cabinet in the
  // north-west corner with his back to the room (THE GRAB); the handle; the porch
  { name: 'desk', keys: ['post'], points: [[13.7, 0, 16.4], [14.5, 0, 16.4], [14.0, 0, 15.5], [18.3, 0, 15.5], [16.9, 0, 19.8]], wait: [0, 25, 14, 5, 6] },
  // the man off watch: he BEGINS at his smoke by the impound, looking at the east gate (a first point a stride short of it: a beat's first wait is not
  // stood), then in by the store's yard door → the store → a bunk → out again. Long and uneven (his old 29 s shuttle read as a metronome). From the east
  // start the game's fair-opening rule walks him on down his beat (his first point is inside ten metres of that start). He never opens a corridor door on his own beat; he is the nearest calm man to all three holders, so
  // he is the one sent when the thing is missed
  // (tried as a radio man — office → radio room → the corridor's east end: he lived in two of the three rooms the thing can be in)
  { name: 'bunk', keys: [], points: [[32.2, 0, 16.1], [33.2, 0, 15.6], [28.4, 0, 16.4], [25.1, 0, 15.6], [31.7, 0, 16.5]], wait: [0, 16, 21, 37, 0] },   // (his bunk-room stop is the stove)
];

/** scenarios.quiet for this level. spots[0] + exits[0] is `level.mission` (exits[0] faces east), starts[0] is `level.playerSpawn`, and `level.routes` is
 *  every route the sets name (the plain boot mans all six; a quiet mission's seed deals one set of five). Only spots[0] has its own camera (cam_server). */
export const QUIET: QuietData = {
  thing: 'the case file',
  starts: [
    { sam: [2.0, 0, 19.4], samYaw: Math.PI / 2, name: 'the west gate' },
    { sam: [12.5, 0, 1.8], samYaw: 0, name: 'the north wall' },
    { sam: [38.0, 0, 18.6], samYaw: Math.PI, name: 'the east wall' },
  ],
  spots: [
    { place: 'the armoury', area: R.armoury, door: 'armoury_side', holder: 'the evidence locker', rackIndex: 0, front: [20.5, 1.0, 8.77], halfW: 0.3 },
    { place: "the commander's office", area: R.office, door: 'office', holder: "the commander's safe", rackIndex: 1, front: [27.75, 1.0, 8.77], halfW: 0.3 },
    { place: 'the radio room', area: R.radio, door: 'radio', holder: 'the radio table', rackIndex: 2, front: [25.0, 1.0, 8.92], halfW: 0.3 },
  ],
  exits: [
    { name: 'the east gate', door: 'gate_e', x: 36.0, z: 14.4, out: [1, 0] },
    { name: 'the north gate', door: 'gate_n', x: 9.9, z: 4.0, out: [0, -1] },
    { name: 'the west gate', door: 'gate_w', x: 4.0, z: 16.9, out: [-1, 0] },
  ],
  patrols: [
    ['yard', 'gate', 'corridor', 'generator', 'desk'],     // 0 — the first deal: the yard walked, a man to and from the shed; the store and the bunk room empty for most of a minute at a time
    ['yard', 'gate', 'corridor', 'bunk', 'desk'],          // 1 — the man off watch in the dark way in, and out of the store's door for his smoke; nobody goes to the generator
    ['gate', 'corridor', 'bunk', 'generator', 'desk'],     // 2 — everyone is indoors: the yards are free, the building is full
  ],
  needs: {
    coffee: { name: 'the kettle in the gate hut', pos: [25.0, 0, 22.4], face: Math.PI },
    smoke: { name: 'outside the main gate', pos: [22.6, 0, 25.5], face: 0.6 },
    water: { name: 'the water tank', pos: [10.6, 0, 9.2], face: Math.PI / 2 },
    stretch: { name: 'the forecourt', pos: [14.0, 0, 20.5], face: 0, loop: [[12.8, 0, 21.8], [15.4, 0, 22.7], [14.0, 0, 20.5]] },
  },
};
/** QUIET_VARIANT=spot,patrolSet,start — CHECKING ONLY: that deal, with level.routes cut down to the one set, written to levels/police-post-v<spot><set><start>.json
 *  (a scratch file, not committed) so the scripted player can be run against one deal. Unset = the committed file: spot 0, start 0, all six routes. */
const VARIANT = process.env.QUIET_VARIANT ? process.env.QUIET_VARIANT.split(',').map(x => Number(x) || 0) : null;
/** scenarios.response (game/qrf.ts, tools/qa/response-check.ts): WHO COMES WHEN THIS PLACE GOES LOUD, and by which gate. Every mark is outside the wall or a
 *  stride inside it; yaws are Character yaws (forward = [sin, 0, cos]: Math.PI looks up the plan, toward the building). */
export const RESPONSE: ResponseData = {
  why: 'A district post with a radio room and an army picket down the road: shots here are heard on a net somebody answers, and the picket walks in by a gate.',
  site: 'the post', at: 'at the post', team: 'the picket', tag: 'PICKET',
  men: [3, 4], eta: [50, 90],
  ways: [
    { name: 'the main gate', coming: 'coming in by the main gate', clear: 'nobody on the forecourt',
      muster: [[20.0, 0, 25.7], [21.0, 0, 25.7], [20.0, 0, 26.7], [21.0, 0, 26.7]],
      entry: [[20.3, 0, 21.3], [21.2, 0, 22.3], [19.4, 0, 22.3], [20.3, 0, 23.1]], entryFace: [Math.PI, Math.PI - 0.8, Math.PI + 0.8, Math.PI] },
    { name: 'the impound gate', door: 'gate_e', coming: 'coming in by the impound gate', clear: 'nobody among the seized trucks',
      muster: [[37.4, 0, 13.7], [37.4, 0, 14.8], [38.4, 0, 13.7], [38.4, 0, 14.8]],
      entry: [[33.4, 0, 14.2], [33.5, 0, 13.1], [34.2, 0, 15.3], [35.0, 0, 14.25]], entryFace: [-Math.PI / 2, Math.PI, 0, -Math.PI / 2] },
  ],
  // the second lift, if the first is shot to pieces: two men who do not come in — they stand outside the gates he would leave by
  posts: [
    { name: 'outside the main gate', pos: [20.4, 0, 26.6], yaw: Math.PI, sweep: [[20.4, 1, 22.0], [15.0, 1, 25.6]] },
    { name: 'outside the impound gate', pos: [37.8, 0, 14.25], yaw: -Math.PI / 2, sweep: [[34.0, 1, 14.25], [37.8, 1, 9.0]] },
  ],
  outside: [[38.6, 0, 26.6], [39.2, 0, 25.4]],
};

export const NAME = VARIANT ? `police-post-v${VARIANT[0]}${VARIANT[1] ?? 0}${VARIANT[2] ?? 0}` : 'police-post';

export function build(): { level: Level; scenarios?: LevelScenarios; groups: string[]; surfaces: SurfacesData; quiet: QuietData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, M = G.M, H = WORLD.ceilingY;
  const { grp, add, slab, ceilingPanel, doorFrame, lights, switchables } = K;
  const HALF = Math.PI / 2;
  const SPOT = QUIET.spots[VARIANT?.[0] ?? 0] ?? QUIET.spots[0], START = QUIET.starts[VARIANT?.[2] ?? 0] ?? QUIET.starts[0], EXIT = QUIET.exits[0];
  const SET = VARIANT ? QUIET.patrols![VARIANT[1] ?? 0] ?? QUIET.patrols![0] : null;
  const ROUTES = SET ? SET.map(n => POST_ROUTES.find(r => r.name === n)!) : POST_ROUTES;

  // ---------------- the post's own pieces, in the kit's paints (every one a plain static: feet, sight, rounds and sound meet it) ----------------
  const dark = [{ mul: 0.55 } as MarkPal];
  /** a tarped pallet of stores, 1.0 m: a static block a man can kneel behind */
  const pallet = (x: number, z: number, w: number, d: number, tarp: GwotMat = 'canvas') => { const b = G.piece(x, z, 0);
    b(0, 0, 0, 0.12, w / 2, d / 2, M.woodGrey); b(0, 0, 0.12, 0.97, w / 2 - 0.04, d / 2 - 0.04, M.ply); b(0, 0, 0.97, 1.0, w / 2 - 0.02, d / 2 - 0.02, M[tarp]); };
  /** a steel locker, 2 m, 0.98 × 0.6: a door seam and a vent on both faces */
  const locker = (x: number, z: number, alongX: boolean, mat: GwotMat = 'olive') => { const h: Vec3 = alongX ? [0.49, 1.0, 0.3] : [0.3, 1.0, 0.49];
    const seam = (f: MarkFace) => G.face(f, 'coarse', dark, (i, j, W, Hc) => i === Math.floor(W / 2) || (j >= Hc - 7 && j < Hc - 3 && j % 2 === 0 && Math.abs(i - W / 4) < 3) || (j >= Hc - 7 && j < Hc - 3 && j % 2 === 0 && Math.abs(i - 3 * W / 4) < 3) ? 1 : 0, 0, 1);
    return add({ c: [x, 1.0, z], h, ...M[mat], ...G.marksOf(h, alongX ? [...seam('+z'), ...seam('-z')] : [...seam('+x'), ...seam('-x')]) }); };
  /** a steel shelf unit w × d × 2 m, four shelves, stores on three of them */
  const rack = (x: number, z: number, w: number, d: number, yaw: number, loads: GwotMat[] = ['olive', 'sack', 'coyote']) => { const b = G.piece(x, z, yaw);
    for (const s of [-1, 1]) b(s * (w / 2 - 0.02), 0, 0, 2.0, 0.02, d / 2, M.galv);
    for (let i = 0; i < 4; i++) { const y = 0.15 + 0.6 * i; b(0, 0, y - 0.015, y + 0.015, w / 2, d / 2, M.galv); if (i < 3) b((i % 2 ? -0.15 : 0.12) * w, 0, y + 0.015, y + 0.32, w * 0.22, d * 0.4, M[loads[i % loads.length]]); } };
  /** a plank bench, 1.4 × 0.4 × 0.45 */
  const bench = (x: number, z: number, yaw: number) => { const b = G.piece(x, z, yaw); b(0, 0, 0.39, 0.45, 0.7, 0.2, M.poplar); for (const s of [-0.6, 0.6]) b(s, 0, 0, 0.39, 0.03, 0.18, M.woodGrey); };
  /** a steel filing cabinet, 0.46 × 0.6 × 1.32, drawers on local −Z */
  const cabinet = (x: number, z: number, yaw: number) => { const b = G.piece(x, z, yaw);
    b(0, 0, 0, 1.32, 0.23, 0.3, M.galv, G.mk(G.face('-z', 'base', dark, (i, j, W, Hc) => j % Math.floor(Hc / 3) === 0 || (j % Math.floor(Hc / 3) === Math.floor(Hc / 6) && Math.abs(i - W / 2) < 3) ? 1 : 0, 0, 1))); };

  // ---------------- ground: dust to the world's edge, packed earth inside the wall, gravel under the canopy and through the gate ----------------
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });                                   // the whole world's ground: every ray and every foot lands on something
  G.ground(4, 4, 36, 24, 'dirt');                                                       // the yard: packed earth, wall to wall
  G.ground(4.12, 4.12, 8.9, 9.2, 'gravel', 0.006);                                      // the motor pool's hardstanding
  G.ruts(20.5, 27.9, 20.5, 20.9);                                                       // the track in through the main gate, as far as the barrier
  G.patch(6.4, 6.6, 2.6, 1.6, 'oil', 0.2); G.patch(34.6, 10.4, 1.8, 1.2, 'oil', -0.3); G.patch(14.6, 20.4, 2.6, 1.6, 'damp', 0.3); G.patch(33.0, 14.6, 2.4, 1.4, 'damp', 0.1);
  grp('floors');
  G.ground(13, 8, 31, 18.5, 'mudFloor');                                                // the building: beaten earth under every room
  G.ground(13.12, 12.06, 30.88, 14.44, 'slab', 0.006);                                  // … and the corridor poured over it (2 mm proud)
  G.ground(4.12, 19.62, 9.38, 23.88, 'slab'); G.ground(22.62, 21.12, 26.38, 23.88, 'slab');   // the shed, the hut

  // ---------------- roofs (light-only: the camera looks through them) — FOUR, the most the weather counts ----------------
  grp('ceiling');
  const roof = { flags: BoxFlag.NoPrimary };
  slab(12.9, H, 7.9, 31.1, H + 0.2, 18.6, [0.5, 0.47, 0.41], roof);    // the main building
  slab(3.9, H, 19.4, 9.6, H + 0.2, 24.1, [0.36, 0.35, 0.33], roof);    // the generator shed
  slab(22.4, H, 20.9, 26.6, H + 0.2, 24.1, [0.36, 0.35, 0.33], roof);  // the guard hut
  slab(3.9, H, 3.9, 8.9, H + 0.12, 9.2, [0.3, 0.31, 0.3], roof);       // the motor pool's tin canopy

  // ---------------- the perimeter wall (mud brick, 0.24, to the roofs' height and coped: nobody sees or shoots over it) ----------------
  // (every doorway on this level is 1.2 m wide and cut 0.2 m before a whole or a half metre: the nav grid's half-metre cells then have a free one in it)
  grp('walls.perimeter');
  G.yardWallX(4, 3.88, 36.12, 'mud', [{ a: 9.3, b: 10.5, y0: 0, y1: 2.2 }], H);          // north: the north gate, at the motor pool's mouth
  G.yardWallX(24, 3.88, 36.12, 'mud', [{ a: 19, b: 22, y0: 0, y1: H }], H);              // south: the main gate, 3 m, open to the sky
  G.yardWallZ(4, 4.12, 23.88, 'mud', [{ a: 16.3, b: 17.5, y0: 0, y1: 2.2 }], H);         // west: the west gate, north of the generator shed
  G.yardWallZ(36, 4.12, 23.88, 'mud', [{ a: 13.8, b: 15.0, y0: 0, y1: 2.2 }], H);        // east: the east gate — the way out
  G.gate(20.5, 24, 'x', 3.0, 1, 'paintBlue', 88, H);                                    // the main gate's two sheet-steel leaves, swung OUT and left open
  G.skirt('x', 4, 10.6, 35.8, 1); G.skirt('z', 36, 4.2, 13.7, -1); G.skirt('z', 36, 15.1, 23.8, -1); G.skirt('z', 4, 9.3, 16.2, 1); G.skirt('x', 24, 9.7, 18.6, -1); G.skirt('x', 24, 26.7, 35.8, -1);

  // ---------------- the main building's shell (cement render over brick, 0.24) ----------------
  grp('walls.building');
  G.wallX(8, 12.88, 31.12, 'render', [{ a: 28.6, b: 30.2, y0: 1.0, y1: 2.2 }]);          // north: the commander's window onto the back strip (unglazed: shutters open)
  G.wallX(18.5, 12.88, 31.12, 'render', [{ a: 16.3, b: 17.5, y0: 0, y1: 2.2 }]);         // south: the front door into the duty room
  G.wallZ(13, 8.12, 18.38, 'render', [{ a: 12.8, b: 14.0, y0: 0, y1: 2.2 }]);            // west: the porch — an open doorway on the corridor's end, its leaf long gone
  G.wallZ(31, 8.12, 18.38, 'render', [{ a: 12.8, b: 14.0, y0: 0, y1: 2.2 }, { a: 15.8, b: 17.0, y0: 0, y1: 2.2 }]);   // east: the side door on the corridor's other end, and the store's own door
  G.skirt('x', 8, 13.0, 31.0, -1);  G.skirt('z', 13, 8.2, 12.7, -1); G.skirt('z', 13, 14.1, 18.4, -1); G.skirt('z', 31, 8.2, 12.7, 1); G.skirt('z', 31, 17.1, 18.4, 1);

  // POLICE BLUE, from the ground up: the building's south face and the south wall's outside either side of the main gate
  G.dado('x', 18.5, 13.0, 16.2, 1); G.dado('x', 18.5, 17.6, 31.0, 1); G.dado('x', 24, 4.0, 18.8, 1); G.dado('x', 24, 22.2, 36.0, 1);

  // ---------------- the partitions (whitewash, 0.12), all solid ----------------
  grp('walls.interior');
  // the corridor's north wall z=12: cells (x 14.8..16), radio room (x 24.3..25.5), office (x 28.8..30) — and NO door on the armoury: its corridor doorway is
  // bricked up (with it there the pad's digits were worth nothing: one pick in the corridor opened the room)
  G.partX(12, 13.12, 30.88, 'whitewash', [{ a: 14.8, b: 16.0 }, { a: 24.3, b: 25.5 }, { a: 28.8, b: 30.0 }]);
  // the corridor's south wall z=14.5: duty room (x 17.8..19), bunk room (x 22.3..23.5), store (x 27.8..29)
  G.partX(14.5, 13.12, 30.88, 'whitewash', [{ a: 17.8, b: 19.0 }, { a: 22.3, b: 23.5 }, { a: 27.8, b: 29.0 }]);
  G.partZ(18, 8.12, 11.94, 'whitewash');                             // cells | armoury
  G.partZ(23, 8.12, 11.94, 'whitewash', [{ a: 9.3, b: 10.5 }]);      // armoury | radio room: the keypad door
  G.partZ(27, 8.12, 11.94, 'whitewash', [{ a: 9.3, b: 10.5 }]);      // radio room | office
  G.partZ(20, 14.56, 18.38, 'whitewash', [{ a: 15.8, b: 17.0 }]);    // duty room | bunk room
  G.partZ(26, 14.56, 18.38, 'whitewash', [{ a: 15.8, b: 17.0 }]);    // bunk room | store
  // the corridor's police-blue dado, both walls, door to door
  for (const [a, b] of [[13.15, 14.7], [16.1, 24.2], [25.6, 28.7], [30.1, 30.85]]) G.dado('x', 12, a, b, 1, 'paintBlue', GW_PART);
  for (const [a, b] of [[13.15, 17.7], [19.1, 22.2], [23.6, 27.7], [29.1, 30.85]]) G.dado('x', 14.5, a, b, -1, 'paintBlue', GW_PART);

  // ---------------- the outbuildings' own walls (mud, 0.24; their other sides are the perimeter wall) ----------------
  grp('walls.outbuildings');
  G.wallX(19.5, 4.12, 9.62, 'mud');                                                     // the generator shed's north wall, blind: nobody comes round its corner onto the west gate
  G.wallZ(9.5, 19.62, 23.88, 'mud', [{ a: 20.8, b: 22.0, y0: 0, y1: 2.2 }]);            // … its east wall and its door, onto the forecourt's dark end
  // the yard wall from the shed's corner to the building's, and its gate leaf: the forecourt and the west yard do not see each other (tried without: the
  // generator man, coming out of the front door for the shed, looked the length of the west yard at the west gate and shot the careful player there on 9 seeds of 12)
  G.wallX(19.5, 9.62, 13.0, 'mud', [{ a: 11.3, b: 12.5, y0: 0, y1: 2.2 }]); G.wallZ(12.88, 18.62, 19.38, 'mud');
  G.wallX(21, 22.38, 26.62, 'block');                                                   // the hut's north wall
  G.wallZ(22.5, 21.12, 23.88, 'block', [{ a: 21.8, b: 23.0, y0: 0, y1: 2.2 }]);         // … its west wall and the door onto the gate
  G.wallZ(26.5, 21.12, 23.88, 'block');                                                 // … its east wall
  for (const [px, pz] of [[8.75, 9.13], [8.75, 4.2], [4.3, 9.13]]) add({ c: [px, H / 2, pz], h: [0.06, H / 2, 0.06], ...M.galv });   // the canopy's posts

  // ---------------- the yard ----------------
  grp('yard');
  G.pickup(6.72, 5.2, 0, 'truckTan', { mount: true }); G.pickup(6.72, 8.1, 0, 'truckWhite');   // the technical and the duty truck, nose-out under the canopy: the gap between them (z 6.1..7.2) is dark and nobody's beat
  G.hesco(6.2, 14.4, 2, HALF); G.hesco(7.3, 13.9, 1, 0);                                // a dog-leg of bastions inside the west gate: a blind for the gate from the north
  G.waterTank(11.9, 9.2, 'plasticBlue', 0.9);                                           // the water tank off the building's north-west corner
  G.hesco(17.1, 21.3, 2, 0); G.hesco(23.4, 19.3, 1, 0);                                 // the gate's chicane: bastions west of the lane, one east of it
  G.jersey(20.5, 20.2, 1, 0);                                                           // a jersey barrier across the lane, short of the front door: vehicles stop, men walk round
  G.sandbags(18.45, 22.5, 1.6, HALF, 4);                                                // a low sandbag return off the chicane, facing the gate (crouch cover, under the lamp)
  G.tWall(17.7, 26.3, 2, HALF); G.tWall(23.3, 26.3, 2, HALF);                           // blast walls either side of the approach, outside the gate
  pallet(35.2, 4.8, 1.1, 1.1, 'tarpBlue'); pallet(34.1, 4.75, 1.0, 1.0); G.drum(35.45, 5.95, 'drumBlue');   // the tarped pallets in the north-east corner: behind them is dark
  G.drum(32.2, 18.9, 'drumRed'); G.drum(32.85, 18.9, 'rust');                           // fuel drums off the store's corner
  pallet(11.3, 22.9, 1.2, 1.0);                                                         // against the south wall between the shed and the gate
  G.jerryCan(12.3, 16.4, 0.3); G.jerryCan(31.7, 9.2, -0.3, 'jerryYellow'); G.gasBottle(27.6, 7.55);   // loose things, a leaf's length clear of every door and off every patrol line
  { const b = G.piece(15.0, 19.15, 0); b(0, 0, 0, 0.18, 0.22, 0.22, M.block); b(0, 0, 0.18, 5.2, 0.03, 0.03, M.galv); b(0.33, 0, 4.55, 5.1, 0.3, 0.008, M.paintGreen); }   // the flag pole by the front door
  G.bush(1.6, 12.4, 1.0); G.bush(7.2, 1.7, 0.8); G.bush(30.4, 2.0, 1.1); G.bush(38.3, 8.6, 0.9); G.bush(14.6, 26.4, 0.8); G.bush(29.0, 26.2, 1.0);

  // ---------------- THE MAST: the radio room's lattice mast and its dish, on the back strip against the building's north wall ----------------
  grp('mast');
  { const b = G.piece(25.0, 7.2, 0);
    b(0, 0, 0, 0.14, 0.55, 0.55, M.block);                                              // its pad (a walk-over)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(sx * 0.3, sz * 0.3, 0.14, 7.2, 0.03, 0.03, M.galv);
    for (let y = 1.2; y < 7.0; y += 1.4) { b(0, 0, y, y + 0.04, 0.44, 0.02, M.galv, {}, Math.PI / 4); b(0, 0, y + 0.05, y + 0.09, 0.44, 0.02, M.galv, {}, -Math.PI / 4); }
    b(0, 0, 7.2, 7.26, 0.36, 0.36, M.iron); b(0, 0, 7.26, 7.95, 0.015, 0.015, M.iron);     // the head and the whip
    b(-1.25, 0.3, 0, 1.1, 0.4, 0.26, M.olive, G.mk(G.face('-z', 'base', dark, (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) === 1 || i === Math.floor(W / 2) ? 1 : 0, 0, 1))); }   // the battery cabinet at its foot (a kneeling man's cover)
  G.satDish(26.4, 7.45, 0.5, 1.6); G.woodPile(16.6, 4.6, 0, 1.4);
  // the back strip's housekeeping, against the walls and off the walker's line (z 6.0..6.4): water barrels at the cells' wall, the wash line on the north wall
  G.drum(14.3, 7.5, 'drumBlue'); G.drum(14.95, 7.5, 'drumBlue'); G.washLine(18.2, 4.75, 21.4, 4.75, 4);

  // ---------------- THE IMPOUND: seized vehicles down the east wall — a wreck north of the east gate, crates and two motorbikes south of it; the bay each
  // side of the gate is where a man waits out the walker (from the north behind the wreck's tail, from the south behind the crates) ----------------
  grp('impound');
  G.pickup(34.93, 9.6, HALF, 'truckRed', { load: 'crates' });                           // nose to the north, hard against the wall: x 34.0..35.85, z 7.1..12.1
  G.tyres(35.4, 6.7, 2);
  G.crates(34.75, 16.2, 0, 3, 'coyote'); G.drum(35.52, 16.2, 'olive');                  // the south bay's wall: z 16.0..16.5, to the chest of a crouched man
  G.motorbike(35.0, 17.35, Math.PI - 0.6, 'truckRed'); G.motorbike(35.0, 18.3, Math.PI - 0.6, 'plasticBlue');
  G.tyres(31.6, 15.0, 3);                                                               // between the building's two east doors
  // the impound's one bulb, on a bracket just inside the east gate, over the north bay: on the mains
  add({ c: [35.62, 2.98, 13.2], h: [0.26, 0.02, 0.02], ...M.iron });
  G.bulb(35.45, 13.2, 'bulb_impound', 'exterior', true, 1.4);

  // ---------------- the cells (x 13..18, z 8..12): an anteroom on the corridor door, two cages behind bars ----------------
  grp('cells');
  for (let i = 0; i < 30; i++) add({ c: [13.2 + i * 0.16, 1.25, 10.0], h: [0.014, 1.25, 0.014], ...M.iron });   // the bars: a look passes, a man does not
  add({ c: [15.53, 2.55, 10.0], h: [2.41, 0.05, 0.03], ...M.iron }); add({ c: [15.53, 0.03, 10.0], h: [2.41, 0.03, 0.03], ...M.iron });
  add({ c: [15.5, H / 2, 9.04], h: [0.03, H / 2, 0.92], ...M.whitewash });               // the wall between the two cages
  G.cot(14.2, 8.6, 0, false); G.cot(16.8, 8.6, 0, false);
  bench(13.6, 11.0, HALF);
  ceilingPanel(15.5, 11.0, false, 'cells');

  // ---------------- the armoury (x 18..23): no corridor door (bricked up), the keypad door from the radio room, the camera ----------------
  grp('armoury');
  locker(20.5, 8.45, true, 'olive');                                                    // THE EVIDENCE LOCKER, on the north wall: its face is spot 0's point
  rack(18.42, 9.8, 2.4, 0.5, HALF, ['olive', 'coyote', 'olive']);                       // the long-gun rack on the west wall
  G.crates(22.55, 11.3, HALF, 3);                                                       // ammunition crates in the south-east corner
  ceilingPanel(20.5, 8.95, true, 'armoury', false, 0.5, 0.3, [4, 4.3, 4.8]);   // one small lamp over the locker: the room's corners and its door are dark, the thing itself is lit

  // ---------------- the radio room (x 23..27): the set on the north wall, doors west (keypad), east (the office) and south ----------------
  grp('radio');
  G.table(25.0, 8.55, 1.6, 0.7, 0);
  add({ c: [25.0, 0.96, 8.42], h: [0.34, 0.2, 0.16], ...M.olive });                     // THE RADIO SET: spot 2's point is the table's edge under it
  add({ c: [25.5, 1.5, 8.3], h: [0.01, 0.5, 0.01], ...M.galv });
  add({ c: [25.55, 0.765, 8.7], h: [0.15, 0.012, 0.11], ...M.rugCream });               // the log
  G.plasticChair(24.0, 9.0, 0.6); cabinet(26.6, 11.5, 0);
  ceilingPanel(25.0, 9.05, true, 'radio', false, 0.5, 0.3, [4, 4.3, 4.8]);   // one small lamp over the set, as over the locker: the door end of the room is dark

  // ---------------- the commander's office (x 27..31): the safe, the desk and its battery lamp, the window north ----------------
  grp('office');
  add({ c: [27.75, 0.55, 8.45], h: [0.36, 0.55, 0.3], ...M.iron });                     // THE SAFE, on the north wall west of the window: spot 1
  G.table(29.5, 10.1, 1.6, 0.8, 0, 'poplar'); G.plasticChair(29.5, 9.3, Math.PI, 'plasticBlue');
  add({ c: [29.0, 0.765, 10.1], h: [0.15, 0.012, 0.11], ...M.rugCream });
  add({ c: [30.05, 0.78, 10.0], h: [0.07, 0.03, 0.07], ...M.paintGreen });              // the desk lamp's foot
  const dl = add({ c: [30.05, 0.93, 10.0], h: [0.05, 0.12, 0.05], ...M.plasticWhite, emissive: [5, 3.6, 1.6], flags: BoxFlag.NoShadow });
  lights.push({ kind: 'point', pos: [30.05, 1.12, 10.0], dir: [0, -1, 0], color: [1.0, 0.72, 0.36], intensity: 2.5, range: 3.5, innerDeg: 0, outerDeg: 0, name: 'lamp_desk', group: 'office', enabled: true, volumetric: 0, fixtureBox: dl, radius: 0.06, mains: false });   // battery: it burns through a blackout
  G.rug(28.8, 10.6, 2.4, 1.6, 'afghan', 0.03);
  ceilingPanel(28.4, 10.4, false, 'office');

  // ---------------- the corridor (z 12..14.5): poured, bare, eighteen metres; lit at its west end, dark from the armoury's door east ----------------
  grp('corridor');
  ceilingPanel(15.6, 13.25, true, 'corridor', false, 1.2, 0.3, [7, 6.8, 6.2]); ceilingPanel(27.6, 13.25, false, 'corridor', false, 1.2, 0.3, [7, 6.8, 6.2]);   // the east tube is dead (the Lights panel or a restrike can bring it back): the corridor is lit at the porch end only

  // ---------------- the duty room (x 13..20, z 14.5..18.5): the front desk, the front door south, doors north (corridor) and east (bunk room) ----------------
  grp('duty');
  add({ c: [15.5, 0.55, 16.4], h: [0.28, 0.55, 0.7], ...M.poplar }); add({ c: [15.5, 1.12, 16.4], h: [0.34, 0.025, 0.76], ...M.woodGrey });   // the counter: the desk man stands west of it
  add({ c: [15.5, 1.157, 16.1], h: [0.15, 0.012, 0.11], ...M.rugCream }); add({ c: [15.5, 1.22, 16.75], h: [0.1, 0.075, 0.14], ...M.olive });   // the day book, the desk set
  cabinet(13.5, 15.0, -HALF); bench(18.9, 18.05, 0); G.plasticChair(13.7, 17.8, 0.8);
  ceilingPanel(16.6, 16.4, true, 'duty', false, 1.2, 0.6, [8, 7.6, 6.8]);

  // ---------------- the bunk room (x 20..26): dark; doors west (duty), east (store) and north ----------------
  grp('bunk');
  G.cot(21.3, 17.9, 0); G.cot(24.6, 17.9, 0, true, 'blanketBrown');
  locker(24.9, 14.92, true, 'galv'); locker(21.2, 14.92, true, 'galv');
  G.trunk(22.95, 18.05, 0, 'paintBlue'); G.stove(25.66, 15.0);
  G.rug(23.0, 16.5, 2.4, 1.4, 'felt', -0.02);
  ceilingPanel(23.0, 16.2, false, 'bunk');

  // ---------------- the store (x 26..31): dark; shelves and pallets; its own door onto the impound ----------------
  grp('store');
  rack(28.4, 18.08, 3.0, 0.5, 0, ['sack', 'olive', 'coyote']);
  pallet(26.75, 17.75, 1.0, 0.9); pallet(30.3, 15.1, 0.9, 0.8, 'tarpBlue'); G.jerryCan(27.2, 15.0, -0.3);
  ceilingPanel(28.4, 16.4, false, 'store');

  // ---------------- the generator shed (x 4..9.5, z 19.5..24): the set, its fuel, THE BREAKER on the south wall ----------------
  // (the man sent to reset it walks to breaker.pos + (−0.4, −0.9): the panel has to be on a wall with floor to its north. On the west wall — the
  //  perimeter's — that point was inside the wall)
  grp('shed');
  G.generator(6.2, 23.2, 0);                                                            // against the south wall, its panel to the room
  G.drum(4.52, 20.6, 'drumRed'); G.drum(4.52, 21.25, 'rust'); G.jerryCan(5.3, 20.1, 0.4);
  const brk = add({ c: [8.3, 1.35, 23.84], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [8.12, 1.62, 23.79], h: [0.015, 0.015, 0.01], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add({ c: [8.3, 2.35, 23.85], h: [0.03, 0.64, 0.03], ...M.galv });                     // its conduit to the roof
  ceilingPanel(6.8, 21.3, true, 'shed', true, 0.6, 0.6, [5, 4.6, 3.8]);

  // ---------------- the guard hut (x 22.5..26.5, z 21..24): a table with the kettle, a chair, a stove, a battery lantern ----------------
  grp('hut');
  G.table(25.2, 21.55, 1.6, 0.6, 0); add({ c: [24.7, 0.85, 21.5], h: [0.08, 0.1, 0.08], ...M.tin }); G.plasticChair(26.0, 22.5, 0.4);
  ceilingPanel(24.5, 22.6, true, 'hut', false, 0.4, 0.4, [4, 3.4, 2.4]);
  switchables[switchables.length - 1].mains = false;                                    // the lantern: the hut is lit through a blackout

  // ---------------- what goes dark when the thing is taken (game.ts rackTargets: the switchables named rack<rackIndex>_leds) — a tell-tale on each holder ----------------
  grp('objective');
  for (const s of QUIET.spots) { const f = s.front, led = add({ c: [f[0] + 0.2, 1.45, f[2] + 0.006], h: [0.03, 0.012, 0.004], ...M.plasticBlack, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
    switchables.push({ name: `rack${s.rackIndex}_leds`, boxes: [led], group: 'objective', on: true, baseEmissive: [0.3, 4, 0.6], mains: false }); }

  // ---------------- yard lamps and the moon: the lamps are on the MAINS here (the breaker takes the yard too) ----------------
  // (the compound's lamp — 260 cd through a 65° cone — read as one bright sheet over a 9 m yard on quiet-light: nowhere to go round. These are tighter and
  //  dimmer, a pool of about 3.5 m each)
  grp('exterior.lamps');
  const lampAt = (x: number, z: number, name: string, dir: Vec3, outerDeg = 42, intensity = 120) => {
    const yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], ...M.galv });
    add({ c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, ...M.galv });
    add({ c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, ...M.iron });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, ...M.plasticWhite, emissive: [40, 24, 7], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: normalize3([dir[0] * 0.35, -1, dir[2] * 0.35]), color: [1.0, 0.62, 0.22], intensity, range: 14, innerDeg: outerDeg - 14, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: true, broad: true });
  };
  lampAt(18.4, 23.55, 'lamp_gate', [0, 0, -1], 48);              // inside the main gate, over the forecourt and the front door
  lampAt(9.0, 12.4, 'lamp_yard', [0, 0, -1], 40);                // in the west yard, thrown NORTH over the motor pool's mouth and the perimeter walker's turn: the straight line from the west gate to the porch passes south of its pool, in the bastions' shadow (tried thrown south across that line: the walker, coming down the yard behind the bastions, saw the careful player step into it)
  lampAt(11.6, 6.4, 'lamp_pool', [-0.5, 0, -0.866], 34);         // at the motor pool's mouth, aimed at the north gate: the foot of the building's north wall stays dark
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  grp('beacons');
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number) => {
    add({ c: [x, H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    const dome = add({ c: [x, H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x, H - 0.3, z], box: dome });
  };
  beacon(22.0, 13.25); beacon(6.8, 22.4);

  // ---------------- doors. THE LOCK GRAPH: the four corridor doors of the rooms worth having (the armoury has none) and side_e are on the one key 'post', keyed on the OUTER face ----------------
  // (keySide is the sign of doors.ts Doors.side on the face that wants the key: for a leaf in a wall along x hung with closedDir 0 the south face is +1; the
  //  office's leaf is hung the other way round (closedDir π), so its south face is −1; the duty room is SOUTH of the corridor, so its corridor face is −1)
  const X = 0, Z = HALF;   // closedDir: a leaf in a wall that runs along x / along z
  const POST = { locked: true, lock: 'post' } as const;
  const doorDefs: LevelDoorDef[] = [
    // the main building
    { name: 'front', hinge: [16.32, 18.5], closedDir: X, width: 1.16, exterior: true },                      // forecourt → the duty room: free, lit, under the camera — the way to the desk man's back
    { name: 'side_e', hinge: [31.0, 12.82], closedDir: Z, width: 1.16, exterior: true, ...POST, keySide: -1 },   // on the key, keyed on its IMPOUND face (east = −1 for a leaf hung along z); free from the corridor                     // the corridor's east end → the impound
    { name: 'store_e', hinge: [31.0, 15.82], closedDir: Z, width: 1.16, exterior: true },                    // the store → the impound: the dark way in
    { name: 'cells', hinge: [14.82, 12.0], closedDir: X, width: 1.16, ...POST, keySide: 1 },
    { name: 'radio', hinge: [24.32, 12.0], closedDir: X, width: 1.16, ...POST, keySide: 1 },
    { name: 'office', hinge: [29.98, 12.0], closedDir: Math.PI, width: 1.16, ...POST, keySide: -1 },   // hung on its EAST jamb: open, the leaf lies against the desk's side of the room and the way to the safe is clear
    { name: 'duty', hinge: [17.82, 14.5], closedDir: X, width: 1.16, ...POST, keySide: -1 },  // locked against the corridor: from the duty room it opens freely
    { name: 'bunk', hinge: [22.32, 14.5], closedDir: X, width: 1.16 },
    { name: 'store', hinge: [27.82, 14.5], closedDir: X, width: 1.16 },
    // the armoury's second door, on the KEYPAD (devices below): bolted, its pad on the radio-room face of the partition (keySide −1: the radio room is this
    // leaf's east side); from the armoury it is a thumb-turn
    { name: 'armoury_side', hinge: [23.0, 9.32], closedDir: Z, width: 1.16, locked: true, lock: 'pad_armoury', keySide: -1, swing: 1 },   // swing +1: it opens INTO the armoury (a boot from the radio room is then a boot on its push face)
    { name: 'radio_office', hinge: [27.0, 9.32], closedDir: Z, width: 1.16 },                // free: one lock picked gives both rooms
    { name: 'duty_bunk', hinge: [20.0, 15.82], closedDir: Z, width: 1.16 },                  // free: from the dark bunk room to the desk man's side
    { name: 'bunk_store', hinge: [26.0, 15.82], closedDir: Z, width: 1.16 },
    // the outbuildings
    { name: 'shed_e', hinge: [9.5, 20.82], closedDir: Z, width: 1.16, exterior: true },
    { name: 'hut_w', hinge: [22.5, 21.82], closedDir: Z, width: 1.16, exterior: true },
    { name: 'yard_sw', hinge: [11.32, 19.5], closedDir: X, width: 1.16 },                    // the forecourt ↔ the west yard
    // the wall's three gates (the main gate's leaves are scenery)
    { name: 'gate_w', hinge: [4.0, 16.32], closedDir: Z, width: 1.16, exterior: true },
    { name: 'gate_n', hinge: [9.32, 4.0], closedDir: X, width: 1.16, exterior: true },
    { name: 'gate_e', hinge: [36.0, 13.82], closedDir: Z, width: 1.16, exterior: true },
  ];
  // (`exterior` on every leaf that opens onto a yard, the building's and the outbuildings' as well as the wall's: the page ships with door closers off, and a
  //  calm man pulls to behind him only the doors that are locked or exterior — without it the front door stood open after the first man through. The yard
  //  wall's leaf is between two yards and is nobody's to shut. Their FRAMES are cut the thick way: they stand in 0.24 walls)
  const THICK = new Set(['front', 'side_e', 'store_e', 'shed_e', 'hut_w', 'yard_sw']);
  for (const d of doorDefs) doorFrame(THICK.has(d.name) ? { ...d, exterior: true } : d);

  // ---------------- devices (game/devices.ts): two cameras and the keypad ----------------
  const devices: DeviceDef[] = [
    // over the front door, looking south across the forecourt at the main gate and panning: the lit way in is watched; the west yard and the back never are
    { kind: 'camera', name: 'cam_yard', pos: [16.9, 2.75, 18.68], yaw: 0.35, pitch: -0.35, sweep: [-1.2, 0.6], sweepPeriod: 12, fovDeg: 60, range: 11, mains: true },
    // the armoury's south-east corner, fixed on the locker — on its own battery: the breaker does not blind the armoury
    { kind: 'camera', name: 'cam_server', pos: [22.75, 2.6, 11.75], yaw: -2.5, pitch: -0.32, fovDeg: 80, range: 8, mains: false },
    // the armoury ↔ radio door's pad, on the radio-room face of the partition beside the latch jamb
    { kind: 'keypad', name: 'pad_armoury', pos: [23.075, 1.4, 10.66], yaw: HALF, door: 'armoury_side', code: '4082' },
  ];

  // ---------------- the terminal (the last boxes of the post itself, so that nothing above takes a new number) ----------------
  // the post's one terminal, on the footlocker between the cots (game/doze.ts: a man with a short wait in this room sits to it — the chair is the lived-in room's —
  // switches it on, and off again when he gets up). BUILT OFF: the room is as dark as it was until somebody is at it. On the mains like everything else here.
  grp('bunk');
  K.monitor(22.95, 18.18, Math.PI, false, 0.4, true, true);

  // ---------------- LIVED-IN ROOMS (src/scene/lived.ts — one switch; off = the post as it was) ----------------
  // What makes each room of the post ITS room, as the office's rooms are: a use you can name from above, a thing only that room has, the clutter of that use, its own
  // floor piece, something to shove. Every box below is in group 'lived.<room>' and every prop is named 'lived.<room>.<n>', and they are the LAST boxes / props of the
  // level (tools/levels/export.ts holds it). Nothing above is moved. Rules kept: nothing solid within 1.1 m of a door's line, on an authored point, on a patrol leg or
  // in front of a holder; nothing over a table's height off a wall, so no sight line changes; NO new light (one amber dial on the radio set glows and lights nothing).
  {
    const W = G.piece(0, 0, 0), DEC = { flags: BoxFlag.NoShadow }, QTR = Math.PI / 4;
    type Cell = (i: number, j: number, w: number, h: number) => number;
    const pal = (...n: GwotMat[]): MarkPal[] => n.map(k => ({ albedo: P[k] }));
    const art = (f: MarkFace, res: 'coarse' | 'base' | 'fine', p: MarkPal[], fn: Cell) => G.mk(G.face(f, res, p, fn, 0, 2));
    const hh = (a: number, b: number) => (Math.imul(a + 7, 73856093) ^ Math.imul(b + 3, 19349663)) >>> 0;
    const spans: [number, string][] = [];
    const room = (n: string) => { spans.push([K.props.length, n]); grp(`lived.${n}`); };
    /** a sheet / a ledger lying on a surface whose top is y (the office's paper: the destruction finds it by shape) */
    const paper = (x: number, z: number, y: number, w = 0.3, d = 0.22, yaw = 0) => add({ c: [x, y + 0.005, z], h: [w / 2, 0.005, d / 2], yaw, albedo: [0.86, 0.86, 0.82], flags: BoxFlag.NoShadow });
    /** a small thing standing on a surface whose top is y */
    const thing = (x: number, z: number, y: number, hx: number, hy: number, hz: number, m: GwotMat, yaw = 0) => add({ c: [x, y + hy, z], h: [hx, hy, hz], yaw, ...M[m] });
    const glass = (x: number, z: number, y: number) => thing(x, z, y, 0.022, 0.035, 0.022, 'tin');
    /** a small round: two squares 45° apart */
    const rnd = (x: number, z: number, y0: number, y1: number, r: number, m: GwotMat) => { W(x, z, y0, y1, r, r, M[m]); W(x, z, y0 + 0.002, y1 - 0.004, r * 0.96, r * 0.96, M[m], {}, QTR); };
    const floor = (x: number, z: number, w: number, d: number, m: GwotMat, yaw = 0, y = 0.012) => G.patch(x, z, w, d, m, yaw, y);
    /** PROP (bin): a bucket */
    const bucket = (x: number, z: number, m: GwotMat = 'tin') => K.prop('bin', x, z, 0, 2, [{ off: [0, 0.14, 0], h: [0.11, 0.14, 0.11], yaw: 0, albedo: M[m].albedo }, { off: [0, 0.14, 0], h: [0.11, 0.138, 0.11], yaw: QTR, albedo: M[m].albedo }], [0.12, 0.12]);
    const frame: Cell = (i, j, w, h) => Math.min(i, w - 1 - i, j, h - 1 - j) === 0 ? 1 : 0;

    // THE CELLS — lock-up: bedding and a slop bucket in each cage, days scratched on the wall, a booking board with painted feet, the prisoners' things in a cubby
    room('cells');
    floor(14.3, 9.45, 1.9, 0.7, 'straw'); W(16.75, 9.5, 0, 0.16, 0.38, 0.08, M.straw, {}, 0.12);   // the west cage is lived in; the east one's mat is rolled: nobody in it tonight
    W(13.85, 8.6, 0.42, 0.5, 0.42, 0.3, M.blanketBrown);
    W(15.22, 9.72, 0, 0.26, 0.11, 0.11, M.tin, {}, QTR); floor(15.0, 9.55, 0.5, 0.4, 'damp', 0.3, 0.02);
    floor(15.5, 10.0, 4.8, 0.24, 'iron', 0, 0.014);                                                        // the bars' sill: a dark iron strip the width of the room, so the cages read as cages from above
    W(13.95, 9.82, 0, 0.02, 0.1, 0.1, M.tin); W(14.2, 9.84, 0, 0.08, 0.035, 0.035, M.tin);                  // a plate and a cup pushed back to the bars
    W(16.35, 10.2, 0, 0.04, 0.05, 0.12, M.rubber, {}, 0.2); W(16.5, 10.22, 0, 0.04, 0.05, 0.12, M.rubber, {}, -0.1);   // sandals left outside the east cage
    W(14.1, 8.127, 0.95, 1.45, 0.4, 0.006, M.whitewash, { ...DEC, ...art('+z', 'base', [{ mul: 0.5 }], (i, j, w, h) => j > 1 && j < h - 2 && j % 9 < 6 && i % 8 < 5 && i % 2 === 0 ? 1 : 0) });   // the days, in fives
    W(17.932, 10.6, 0.3, 2.0, 0.006, 0.3, M.rugCream, { ...DEC, ...art('-x', 'coarse', pal('plasticBlack'), (i, j) => j % 4 === 0 || (j % 2 === 0 && i < 3) ? 1 : 0) });   // the booking board: a height scale
    floor(17.5, 10.5, 0.3, 0.12, 'stencil'); floor(17.5, 10.72, 0.3, 0.12, 'stencil');                     // … and the two painted feet in front of it
    W(17.78, 11.5, 0, 1.2, 0.15, 0.35, M.poplar, art('-x', 'coarse', [{ mul: 0.45 }, ...pal('sack', 'paintBlue')], (i, j) => i % 5 === 0 || j % 6 === 0 ? 1 : j % 6 < 4 ? [0, 2, 3, 0, 2][hh(Math.floor(i / 5), Math.floor(j / 6)) % 5] : 0));   // the cubby of prisoners' things
    W(17.78, 11.35, 1.2, 1.36, 0.12, 0.14, M.sack); W(17.78, 11.68, 1.2, 1.26, 0.05, 0.12, M.rubber);
    G.plasticChair(17.35, 11.5, -HALF, 'plasticGreen');                                                    // the jailer's stool

    // THE ARMOURY — gun room: hard, dark and in lines. A comb of long guns on the bricked south wall, the armourer's bench with a rifle stripped on a cloth, a yellow line boxing the locker
    room('armoury');
    W(20.0, 11.86, 0.9, 0.96, 1.2, 0.06, M.poplar); W(20.0, 11.8, 0, 0.1, 1.2, 0.12, M.poplar);
    for (let i = 0; i < 7; i++) W(19.0 + i * 0.33, 11.72, 0.1, 1.05, 0.02, 0.1, M.iron);
    G.table(19.9, 10.55, 1.4, 0.7, 0, 'woodGrey');
    W(19.9, 10.55, 0.75, 0.758, 0.6, 0.27, M.olive);
    W(19.95, 10.5, 0.758, 0.8, 0.4, 0.022, M.iron); W(19.42, 10.5, 0.758, 0.81, 0.11, 0.03, M.poplar);    // barrel and receiver, the stock off it
    W(20.15, 10.68, 0.758, 0.79, 0.03, 0.06, M.iron, {}, 0.5); W(19.72, 10.7, 0.758, 0.772, 0.1, 0.012, M.iron, {}, -0.2);
    thing(20.55, 10.3, 0.75, 0.035, 0.06, 0.035, 'jerryYellow');                                          // the oil can
    W(19.0, 10.95, 0, 0.18, 0.15, 0.09, M.olive, art('+y', 'fine', pal('stencil'), (i, j, w, h) => i > 1 && i < w - 2 && j > 1 && j < h - 2 && i % 2 === 0 ? 1 : 0));   // an open tin of rounds
    for (let i = 0; i < 3; i++) { W(20.2 + i * 0.3, 8.43 + (i % 2) * 0.06, 2.0, 2.09, 0.11, 0.075, M.blanketBrown, {}, (i - 1) * 0.15); W(20.2 + i * 0.3, 8.5, 2.09, 2.096, 0.04, 0.03, M.whitewash, DEC); }   // tagged bricks on the locker
    floor(19.9, 11.2, 1.4, 0.45, 'rubber');
    K.prop('cardboard', 21.15, 10.6, 0.45, 8, [{ off: [0, 0.15, 0], h: [0.3, 0.15, 0.2], yaw: 0, albedo: M.olive.albedo }], [0.3, 0.2]);   // one loose ammunition crate

    // THE RADIO ROOM — signals: three doors leave it no floor, so it is said on the table and the walls: batteries and their cable, a headset, a field telephone, handsets on charge, the district on the wall
    room('radio');
    for (const y of [0, 0.22]) W(26.02, 8.38, y, y + 0.22, 0.17, 0.16, M.plasticBlack, art('+y', 'fine', pal('drumRed', 'tin'), (i, j, w, h) => j === 2 && (i === 3 || i === w - 4) ? 1 : j === 2 && i > 3 && i < w - 4 ? 2 : 0));
    W(26.02, 8.128, 0.44, 2.6, 0.012, 0.006, M.plasticBlack, DEC); W(25.5, 8.128, 2.0, 2.6, 0.012, 0.006, M.plasticBlack, DEC);
    thing(24.45, 8.68, 0.75, 0.07, 0.03, 0.06, 'plasticBlack'); thing(24.38, 8.36, 0.75, 0.1, 0.07, 0.07, 'coyote');
    thing(25.68, 8.38, 0.75, 0.03, 0.045, 0.03, 'tin'); thing(25.2, 8.76, 0.75, 0.05, 0.012, 0.05, 'tin');
    paper(24.85, 8.76, 0.75, 0.2, 0.26, 0.2);
    for (let i = 0; i < 2; i++) thing(25.42 + i * 0.11, 8.42, 0.75, 0.025, 0.07, 0.02, 'plasticBlack');
    W(24.0, 8.127, 1.15, 1.85, 0.5, 0.006, M.rugCream, { ...DEC, ...art('+z', 'coarse', pal('scrub', 'paintBlue', 'drumRed'), (i, j, w, h) => { const u = i / w, v = j / h; return Math.min(i, w - 1 - i, j, h - 1 - j) === 0 ? 0 : (i === Math.floor(w * 0.6) && j === Math.floor(h * 0.55)) || (i === Math.floor(w * 0.3) && j === Math.floor(h * 0.3)) ? 3 : Math.abs(v - 0.35 - 0.18 * Math.sin(u * 6)) < 0.05 ? 2 : Math.sin(u * 7 + v * 3) + Math.cos(v * 9 - u * 2) > 0.9 ? 1 : 0; }) });
    G.rug(25.0, 9.5, 1.6, 1.0, 'mat');
    add({ c: [24.86, 1.0, 8.584], h: [0.03, 0.018, 0.004], ...M.plasticBlack, emissive: [3, 1.6, 0.3], flags: BoxFlag.NoShadow });   // the set's dial: it glows, it lights nothing
    floor(25.25, 9.16, 1.6, 0.1, 'plasticBlack', 0.14, 0.03); floor(26.02, 8.92, 0.1, 0.78, 'plasticBlack', 0, 0.03); floor(25.2, 7.55, 0.1, 0.75, 'plasticBlack', -0.45, 0.16);   // the cable: set → batteries, and out along the pad to the mast
    W(25.98, 8.36, 0.44, 0.452, 0.1, 0.03, M.whitewash); thing(25.95, 8.3, 0.452, 0.025, 0.005, 0.05, 'plasticBlack', 0.3); thing(26.06, 8.42, 0.452, 0.025, 0.005, 0.05, 'paintBlue', -0.2);   // a strip of sockets on the batteries, two phones charging off it
    K.prop('cardboard', 25.5, 9.3, 0.5, 2, [{ off: [0, 0.1, 0], h: [0.16, 0.1, 0.12], yaw: 0, albedo: M.ply.albedo }], [0.16, 0.12]);

    // THE COMMANDER'S OFFICE: a sideboard with the tea things, the flag in the corner, a portrait over the safe, two telephones and a stamp on the desk, the ledgers
    room('office');
    W(30.66, 9.0, 0, 0.8, 0.21, 0.6, M.poplar, art('-x', 'coarse', [{ mul: 0.6 }], (i, j, w, h) => i === (w >> 1) || j === h - 3 ? 1 : 0));
    W(30.64, 8.75, 0.8, 0.812, 0.14, 0.2, M.tin); thing(30.64, 8.66, 0.812, 0.04, 0.12, 0.04, 'paintGreen'); glass(30.6, 8.8, 0.812);
    paper(30.66, 9.32, 0.8, 0.3, 0.22, 0.1);
    W(30.68, 8.26, 0, 0.06, 0.1, 0.1, M.iron); W(30.68, 8.26, 0.06, 2.3, 0.015, 0.015, M.poplar);
    W(30.52, 8.27, 1.6, 2.25, 0.16, 0.008, M.drumRed, art('+z', 'coarse', pal('plasticBlack', 'paintGreen'), (i, j, w) => i < w / 3 ? 1 : i >= 2 * w / 3 ? 2 : 0));
    W(27.75, 8.127, 1.45, 2.0, 0.2, 0.006, M.poplar, { ...DEC, ...art('+z', 'coarse', pal('rugCream', 'plasticBlack'), (i, j, w, h) => Math.min(i, w - 1 - i, j, h - 1 - j) < 1 ? 0 : Math.hypot(i - (w - 1) / 2, j - h * 0.62) < 2.2 || (j < h * 0.42 && Math.abs(i - (w - 1) / 2) < 3) ? 2 : 1) });
    thing(29.95, 10.32, 0.75, 0.09, 0.035, 0.07, 'plasticBlack'); thing(29.72, 10.36, 0.75, 0.08, 0.03, 0.06, 'paintCream');
    thing(28.85, 9.85, 0.75, 0.035, 0.035, 0.035, 'poplar'); W(28.98, 9.84, 0.75, 0.765, 0.07, 0.05, M.rugNavy);
    paper(29.42, 9.95, 0.75, 0.3, 0.22, 0.1); paper(29.44, 9.97, 0.76, 0.3, 0.22, -0.15); glass(29.74, 9.88, 0.75);
    thing(30.17, 10.38, 0.75, 0.09, 0.04, 0.09, 'paintBlue');                                              // his cap
    W(27.39, 11.765, 0, 1.6, 0.31, 0.165, M.poplar, art('-z', 'coarse', [{ mul: 0.5 }, ...pal('drumRed', 'paintGreen')], (i, j, w, h) => i === 0 || i === w - 1 || j % 8 === 0 ? 1 : j % 8 < 6 && i % 2 === 0 ? [2, 3, 0, 3, 2, 0][hh(i, Math.floor(j / 8)) % 6] : 0));   // the ledgers
    K.prop('plant', 28.55, 8.42, 0, 3, [{ off: [0, 0.14, 0], h: [0.12, 0.14, 0.12], yaw: 0, albedo: M.tin.albedo }, { off: [0, 0.46, 0], h: [0.18, 0.18, 0.18], yaw: QTR, albedo: M.scrub.albedo }], [0.14, 0.14]);

    // THE CORRIDOR — bare on purpose: the armoury's old doorway in raw block with what the mason left, a bench for those waiting, the notices, the water jar, mud at the porch
    room('corridor');
    W(20.5, 12.074, 0, 2.1, 0.6, 0.006, M.block, { ...DEC, ...art('+z', 'coarse', [{ mul: 0.7 }], (i, j) => j % 4 === 0 || (i + ((j >> 2) % 2) * 4) % 8 === 0 ? 1 : 0) });
    W(20.2, 12.2, 0, 0.2, 0.2, 0.1, M.block); W(20.4, 12.2, 0.2, 0.4, 0.2, 0.1, M.block, {}, 0.12); W(21.0, 12.22, 0, 0.27, 0.11, 0.11, M.tin, {}, 0.3);
    bench(15.4, 14.24, 0);
    W(20.4, 14.3, 0, 0.27, 0.1, 0.1, M.drumRed, {}, 0.2); W(20.75, 14.3, 0, 0.27, 0.1, 0.1, M.drumRed, {}, -0.3);                    // fire buckets
    W(22.2, 12.074, 1.25, 1.95, 0.6, 0.006, M.ply, { ...DEC, ...art('+z', 'coarse', [{ albedo: [0.86, 0.86, 0.82] }, ...pal('drumRed', 'plasticBlack')], (i, j, w, h) => i % 6 === 0 || j % 7 === 0 || i === w - 1 || j === h - 1 ? 0 : hh(Math.floor(i / 6), Math.floor(j / 7)) % 5 === 0 ? 0 : j % 7 === 5 ? (hh(Math.floor(i / 6), Math.floor(j / 7)) % 4 === 1 ? 2 : 3) : 1) });   // the notice board
    W(27.15, 12.074, 1.2, 1.8, 0.42, 0.006, M.plasticBlack, { ...DEC, ...art('+z', 'coarse', [{ albedo: [0.86, 0.86, 0.82] }], (i, j, w, h) => i > 0 && i < w - 1 && j > 0 && j < h - 1 && j % 2 === 0 && (i === 5 || hh(i, j) % 3 !== 0) && i % 6 !== 4 ? 1 : 0) });   // the duty roster, in chalk
    W(25.6, 14.2, 0, 0.5, 0.17, 0.17, M.poplar); rnd(25.6, 14.2, 0.5, 0.86, 0.15, 'mudDark'); W(25.6, 14.2, 0.86, 0.88, 0.1, 0.1, M.poplar); thing(25.6, 14.2, 0.88, 0.03, 0.035, 0.03, 'tin');   // the water jar on its stand, a cup on the lid
    floor(25.6, 13.9, 0.6, 0.35, 'damp');
    floor(13.9, 13.4, 0.9, 0.5, 'dirt', 0.2); floor(15.0, 13.2, 0.7, 0.4, 'dirt', -0.15); floor(16.2, 13.35, 0.5, 0.3, 'dust', 0.1);

    // THE DUTY ROOM — front desk: the clerk's desk and typewriter, the key board behind the counter (hooks, few keys: the ring is on a belt), the files, the wanted men, a line the public stops at
    room('duty');
    G.table(13.85, 17.2, 1.3, 0.55, 0);
    thing(13.55, 17.22, 0.75, 0.16, 0.06, 0.13, 'plasticBlack'); W(13.55, 17.1, 0.87, 0.9, 0.15, 0.02, M.whitewash);
    paper(14.05, 17.25, 0.75, 0.22, 0.3, 0.15); paper(14.32, 17.08, 0.75, 0.3, 0.22, -0.1); paper(14.33, 17.09, 0.76, 0.3, 0.22, 0.05);
    W(13.127, 16.4, 1.3, 1.8, 0.006, 0.45, M.poplar, { ...DEC, ...art('+x', 'coarse', pal('iron', 'stencil'), (i, j) => j % 3 === 1 && i % 3 === 1 ? (hh(i, j) % 6 === 0 ? 2 : 1) : 0) });
    W(13.21, 17.2, 1.3, 1.33, 0.085, 0.5, M.poplar); for (let i = 0; i < 4; i++) thing(13.21, 16.86 + i * 0.15, 1.33, 0.07, 0.13, 0.028, i === 3 ? 'drumRed' : 'paintBlue');
    W(14.5, 18.373, 1.3, 1.85, 0.55, 0.006, M.whitewash, { ...DEC, ...art('-z', 'coarse', pal('plasticBlack', 'drumRed'), (i, j, w, h) => { const c = i % 7, r = j; return c === 6 || r === 0 || r === h - 1 ? 0 : Math.hypot(c - 2.5, r - h * 0.62) < 1.6 ? 1 : r === 2 ? 2 : r < h * 0.4 && c > 0 && c < 5 && r % 2 === 0 ? 1 : 0; }) });   // the wanted men
    thing(15.62, 16.45, 1.145, 0.03, 0.08, 0.02, 'plasticBlack'); paper(15.42, 16.42, 1.145, 0.2, 0.28);
    G.rug(14.35, 16.3, 1.2, 1.7, 'felt'); G.rug(16.9, 17.95, 1.0, 0.6, 'mat');
    floor(16.1, 16.5, 0.08, 3.5, 'paintBlue');
    W(18.75, 16.7, 0.012, 0.02, 0.85, 0.5, M.straw, { ...DEC, ...art('+y', 'coarse', [{ mul: 0.72 }], (i, j) => j % 2 ? 1 : 0) }, 0.06);   // the reed mat petitioners wait on
    K.prop('cardboard', 14.75, 17.85, -0.25, 4, [{ off: [0, 0.14, 0], h: [0.2, 0.14, 0.15], yaw: 0, albedo: M.ply.albedo }, { off: [0, 0.285, 0], h: [0.17, 0.005, 0.12], yaw: 0, albedo: [0.86, 0.86, 0.82] }], [0.2, 0.15]);   // a carton of files

    // THE BUNK ROOM — sleeping: each man's own things: boots at the cot's foot, a red quilt, tunics on the pegs, a tea crate with a hand of cards, a prayer mat laid skew
    room('bunk');
    W(22.95, 17.4, 0, 0.42, 0.26, 0.26, M.ply, art('+y', 'coarse', [{ mul: 0.6 }], frame));
    paper(22.86, 17.36, 0.42, 0.17, 0.2, 0.3); glass(23.06, 17.3, 0.42); glass(23.1, 17.5, 0.42); thing(22.82, 17.56, 0.42, 0.05, 0.05, 0.05, 'iron');
    W(22.0, 17.42, 0, 0.18, 0.05, 0.13, M.rubber, {}, 0.1); W(22.13, 17.4, 0, 0.18, 0.05, 0.13, M.rubber, {}, -0.1);
    W(21.6, 17.92, 0.47, 0.53, 0.45, 0.3, M.rugRed, art('+y', 'coarse', pal('rugCream'), (i, j) => (i + j) % 4 === 0 ? 1 : 0), 0.2);
    W(22.95, 18.372, 1.75, 1.8, 2.4, 0.008, M.poplar, DEC);
    for (const [x, m] of [[21.0, 'paintBlue'], [21.5, 'blanketGrey'], [24.6, 'coyote']] as [number, GwotMat][]) W(x, 18.366, 1.08, 1.75, 0.2, 0.012, M[m], DEC);
    W(23.6, 16.2, 0.026, 0.034, 0.3, 0.55, M.rugGreen, { ...DEC, ...art('+y', 'coarse', pal('rugCream'), (i, j, w, h) => Math.min(i, w - 1 - i, j, h - 1 - j) === 1 || (j > h * 0.6 && Math.abs(i - (w - 1) / 2) + (j - h * 0.6) * 0.5 < 3 && Math.abs(i - (w - 1) / 2) + (j - h * 0.6) * 0.5 > 2) ? 1 : 0) }, 0.4);
    G.plasticChair(23.75, 17.3, HALF);

    // THE STORE — rations: pale, soft and heaped. Yellow oil tins in a block, flour sacks, folded blankets, an onion sack, a bale of uniform cloth on the rack
    room('store');
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) W(28.55 + i * 0.28, 17.33 + k * 0.26, 0, 0.3, 0.12, 0.1, M.jerryYellow, art('+y', 'fine', [{ mul: 0.5 }], (a, b, w, h) => Math.hypot(a - w * 0.3, b - h * 0.5) < 1.6 ? 1 : 0));
    W(27.78, 17.16, 0, 0.19, 0.38, 0.225, M.sack, {}, 0.06); W(27.8, 17.63, 0, 0.19, 0.38, 0.225, M.sack, {}, -0.08);   // two flour sacks flat on the floor (under 0.2 m: a man steps over them, and the nav grid agrees)
    W(29.55, 17.35, 0, 0.12, 0.28, 0.33, M.woodGrey); for (let k = 0; k < 4; k++) W(29.55, 17.35, 0.12 + k * 0.12, 0.24 + k * 0.12, 0.26, 0.31, M[k % 2 ? 'blanketBrown' : 'blanketGrey'], k === 3 ? art('+y', 'coarse', [{ mul: 0.6 }], (i, j, w) => i === 2 || i === w - 3 ? 1 : 0) : {});
    W(29.22, 16.98, 0, 0.4, 0.13, 0.12, M.sack); W(29.22, 16.98, 0.4, 0.44, 0.1, 0.09, M.prodRed);
    W(27.6, 18.08, 1.965, 2.2, 0.35, 0.2, M.paintBlue, art('+y', 'coarse', pal('sack'), (i, j, w) => i === 3 || i === w - 4 ? 1 : 0));
    floor(27.9, 16.75, 0.8, 0.35, 'whitewash', 0.2);
    K.prop('cardboard', 28.75, 17.04, 0.1, 4, [{ off: [0, 0.2, 0], h: [0.22, 0.2, 0.18], yaw: 0, albedo: M.ply.albedo }], [0.22, 0.18]);

    // THE GENERATOR SHED — power: the fitter's bench and vice on the north wall, his tools on the board, a drip tray, sawdust on the oil, the cable to the breaker
    room('shed');
    G.table(6.9, 19.95, 1.6, 0.55, 0, 'woodGrey');
    thing(7.5, 20.08, 0.75, 0.08, 0.07, 0.06, 'iron'); thing(6.4, 19.95, 0.75, 0.16, 0.08, 0.1, 'paintRust');
    thing(6.85, 19.85, 0.75, 0.05, 0.08, 0.05, 'jerryYellow');
    W(7.1, 20.08, 0.75, 0.765, 0.12, 0.09, M.rubber); W(6.75, 20.1, 0.75, 0.758, 0.14, 0.015, M.galv, DEC, 0.3);
    W(6.9, 19.627, 1.1, 1.8, 0.7, 0.006, M.ply, { ...DEC, ...art('+z', 'coarse', pal('plasticBlack'), (i, j, w, h) => j > 1 && j < h - 2 && i % 4 === 1 && j % 7 < 3 + hh(i, Math.floor(j / 7)) % 3 ? 1 : 0) });
    W(6.2, 22.55, 0, 0.05, 0.45, 0.2, M.tin); W(6.2, 22.55, 0.05, 0.056, 0.4, 0.16, M.oil, DEC);
    floor(6.5, 21.8, 0.9, 0.6, 'oil', 0.3); floor(5.3, 21.2, 0.8, 0.5, 'straw', -0.2);
    W(7.35, 23.8, 0.01, 0.04, 0.72, 0.02, M.plasticBlack, DEC);
    W(4.34, 23.3, 0, 0.9, 0.2, 0.5, M.galv); thing(4.34, 23.05, 0.9, 0.09, 0.07, 0.09, 'genYellow'); thing(4.34, 23.32, 0.9, 0.09, 0.07, 0.09, 'paintRust'); thing(4.34, 23.58, 0.9, 0.07, 0.1, 0.07, 'drumBlue');
    W(7.9, 23.1, 0.006, 0.05, 0.4, 0.3, M.woodGrey, { ...DEC, ...art('+y', 'coarse', [{ mul: 0.5 }], (i) => i % 3 === 2 ? 1 : 0) });
    bucket(8.05, 20.0, 'drumRed');

    // THE GATE HUT — sentry post: a narrow cot with a red quilt, the stove, a carrom game on the table mid-play, the visitors' book, a transistor radio
    room('hut');
    W(24.9, 23.63, 0.3, 0.38, 0.8, 0.25, M.canvas); for (const s of [-0.7, 0.7]) W(24.9 + s, 23.63, 0, 0.3, 0.03, 0.22, M.woodGrey);
    W(24.6, 23.63, 0.38, 0.45, 0.45, 0.24, M.olive, art('+y', 'coarse', pal('coyote'), (i) => i === 2 || i === 3 ? 1 : 0)); W(25.5, 23.63, 0.38, 0.46, 0.15, 0.2, M.sack);
    G.stove(26.08, 23.58); thing(26.04, 23.58, 0.64, 0.07, 0.06, 0.07, 'tin');
    W(25.3, 21.55, 0.75, 0.77, 0.2, 0.2, M.rugCream, art('+y', 'base', pal('plasticBlack', 'drumRed'), (i, j, w, h) => (i < 2 || i > w - 3) && (j < 2 || j > h - 3) ? 1 : Math.min(i, w - 1 - i, j, h - 1 - j) === 0 ? 1 : hh(i, j) % 23 === 0 ? 2 : hh(i, j) % 29 === 0 ? 1 : 0));   // the carrom board
    paper(25.75, 21.62, 0.75, 0.3, 0.22, 0.1);
    thing(25.75, 21.38, 0.75, 0.1, 0.07, 0.035, 'paintRust'); W(25.83, 21.38, 0.89, 1.2, 0.006, 0.006, M.galv);
    W(26.372, 23.0, 0.9, 1.7, 0.008, 0.2, M.blanketGrey, DEC);                                             // his greatcoat on the wall
    G.rug(24.6, 22.5, 1.2, 0.8, 'kilim');
    K.prop('cardboard', 23.85, 23.6, 0.3, 4, [{ off: [0, 0.07, -0.06], h: [0.26, 0.07, 0.06], yaw: 0, albedo: M.woodGrey.albedo }, { off: [0, 0.07, 0.07], h: [0.24, 0.07, 0.06], yaw: 0, albedo: M.poplar.albedo }, { off: [0.02, 0.2, 0], h: [0.25, 0.06, 0.06], yaw: 0, albedo: M.woodGrey.albedo }], [0.26, 0.13]);   // a bundle of stove wood

    // THE MOTOR POOL — vehicle bay: the fuel point south of the canopy (two drums on a cradle, the hand pump), painted bays, a spare wheel, a bonnet off and leaning; the gap between the trucks stays empty
    room('motorpool');
    G.drumDown(4.62, 9.9, HALF, 'drumRed'); G.drumDown(4.62, 10.62, HALF, 'drumRed');
    W(4.62, 9.9, 0.58, 1.2, 0.02, 0.02, M.iron); W(4.78, 9.9, 1.16, 1.2, 0.14, 0.015, M.iron);
    rnd(8.55, 6.7, 0, 0.18, 0.19, 'rubber'); W(8.55, 6.7, 0.18, 0.19, 0.09, 0.09, M.galv);
    W(4.17, 6.65, 0, 1.0, 0.03, 0.45, M.truckWhite);
    W(5.3, 9.58, 0, 0.16, 0.2, 0.1, M.paintRust);           // the red toolbox
    W(5.9, 9.75, 0, 0.08, 0.22, 0.16, M.tin); W(5.9, 9.75, 0.08, 0.084, 0.19, 0.13, M.oil, DEC);          // the drain pan
    G.tyres(4.6, 11.6, 2);

    // THE BACK STRIP — the wash place and the cold cook-pit: a slab and basin by the water barrels, ewers, a black pot on three stones by the wood, the mast's feed, the commander's flowers under his window
    room('back');
    W(15.95, 7.45, 0, 0.1, 0.45, 0.35, M.block); W(15.78, 7.45, 0.1, 0.19, 0.17, 0.17, M.tin);
    W(16.22, 7.55, 0.1, 0.36, 0.07, 0.07, M.plasticBlue); W(16.24, 7.3, 0.1, 0.36, 0.07, 0.07, M.plasticGreen);
    floor(15.95, 6.95, 1.2, 0.4, 'damp', 0.05);
    for (const [dx, dz] of [[-0.2, -0.1], [0.2, -0.1], [0, 0.22]]) W(14.3 + dx, 4.75 + dz, 0, 0.14, 0.08, 0.08, M.block, {}, dx * 2);
    rnd(14.3, 4.77, 0.14, 0.4, 0.17, 'plasticBlack'); floor(14.3, 5.15, 0.9, 0.5, 'tWall', 0.2);
    G.tandoor(15.25, 4.72); floor(14.75, 4.24, 2.1, 0.2, 'oil', 0, 0.014);
    W(22.3, 7.45, 0.55, 0.6, 0.6, 0.3, M.glassDark, art('+y', 'coarse', pal('galv'), (i, j, w, h) => i % 6 === 0 || j === (h >> 1) ? 1 : 0)); for (const sx of [-0.5, 0.5]) W(22.3 + sx, 7.45, 0, 0.55, 0.02, 0.25, M.galv);   // a donor's sun panel, wired to the mast's cabinet
    W(30.5, 4.7, 0, 1.9, 0.02, 0.58, M.tin); W(31.5, 4.7, 0, 1.9, 0.02, 0.58, M.tin); W(30.76, 5.28, 0, 1.9, 0.28, 0.02, M.tin);   // THE LATRINE: three sheets of tin on the north wall, a squat slab, a ewer
    W(31.0, 4.62, 0, 0.06, 0.3, 0.32, M.block, art('+y', 'base', pal('plasticBlack'), (i, j, w, h) => Math.abs(i - (w >> 1)) < 2 && Math.abs(j - (h >> 1)) < 3 ? 1 : 0)); W(31.3, 5.05, 0, 0.26, 0.06, 0.06, M.plasticBlue);
    G.wire(25.0, 7.2, 25.0, 7.88, 2.6);
    for (let i = 0; i < 3; i++) W(28.9 + i * 0.5, 7.74, 0, 0.18, 0.08, 0.08, M.tin, art('+y', 'fine', pal(i % 2 ? 'prodRed' : 'scrub', 'scrub'), (a, b, w, h) => Math.min(a, w - 1 - a, b, h - 1 - b) < 1 ? 0 : (a + b) % 3 === 0 ? 2 : 1));

    // THE WEST YARD — off duty: a volleyball net and a scratched court under the yard lamp, the ball, a bench against the building, boots left at the porch. The gate-to-porch line stays bare
    room('westyard');
    W(7.2, 9.9, 0, 2.3, 0.04, 0.04, M.woodGrey); W(7.2, 12.3, 0, 2.3, 0.04, 0.04, M.woodGrey);          // the net runs north-south; the court lies east-west, twice as long as wide
    W(7.2, 11.1, 1.45, 2.25, 0.006, 1.16, M.whitewash, { ...DEC, ...art('+x', 'coarse', [{ mul: 0.25 }], (i, j, w, h) => j === h - 1 || j === 0 ? 0 : (i % 2 === 0 && j % 2 === 0) ? 0 : 1) });
    floor(5.0, 11.1, 0.07, 2.2, 'whitewash'); floor(9.4, 11.1, 0.07, 2.2, 'whitewash'); floor(7.2, 10.0, 4.47, 0.07, 'whitewash'); floor(7.2, 12.2, 4.47, 0.07, 'whitewash');
    G.charpoy(12.42, 16.2, HALF, 'blanketGrey');
    for (let i = 0; i < 2; i++) W(12.72, 14.22 + i * 0.13, 0, 0.14, 0.12, 0.05, M.rubber, {}, (i - 1) * 0.1);
    K.prop('bin', 8.45, 10.6, 0, 0.5, [{ off: [0, 0.11, 0], h: [0.1, 0.1, 0.1], yaw: 0, albedo: M.whitewash.albedo }, { off: [0, 0.11, 0], h: [0.1, 0.098, 0.1], yaw: QTR, albedo: M.whitewash.albedo }], [0.11, 0.11]);   // the ball

    // THE FORECOURT — parade front: whitewashed stones round the flag and up the lane, a bench against the blue wall, a bicycle, a rumble strip inside the gate
    room('forecourt');
    for (const a of [20, 65, 110, 155, 200, 245, 290, 335]) W(15.0 + 0.45 * Math.cos(a * Math.PI / 180), 19.15 + 0.45 * Math.sin(a * Math.PI / 180), 0, 0.1, 0.07, 0.07, M.whitewash, {}, a * 0.03);
    for (const z of [20.9, 22.3, 23.7]) W(19.42, z, 0, 0.1, 0.07, 0.07, M.whitewash, {}, z);
    W(28.1, 18.8, 0, 0.62, 0.31, 0.02, M.rubber); W(29.1, 18.8, 0, 0.62, 0.31, 0.02, M.rubber); W(28.6, 18.8, 0.4, 0.75, 0.4, 0.015, M.paintGreen); W(28.22, 18.8, 0.9, 0.94, 0.02, 0.2, M.iron); W(28.82, 18.8, 0.86, 0.9, 0.1, 0.05, M.rubber);   // a bicycle against the wall
    W(20.5, 23.2, 0, 0.07, 1.25, 0.13, M.rubber, art('+y', 'coarse', pal('stencil'), (i) => i % 6 < 3 ? 1 : 0));
    bucket(14.0, 19.35, 'drumRed');

    // THE IMPOUND — seized vehicles: painted bays, a yellow and white taxi up on blocks in the south-east corner, a clamp on the wreck, a numbered stake at the wreck's bay, a loose tyre
    room('impound');
    W(34.95, 21.6, 0.3, 0.85, 0.85, 1.95, M.jerryYellow, art('+y', 'coarse', pal('whitewash'), (i, j, w, h) => j > h * 0.3 && j < h * 0.7 ? 1 : 0));
    W(34.95, 21.7, 0.85, 1.35, 0.78, 1.0, M.whitewash, G.mk([...G.face('-x', 'coarse', pal('glassDark'), (i, j, w, h) => j > 1 && i > 0 && i < w - 1 && i !== (w >> 1) ? 1 : 0, 0, 2), ...G.face('+z', 'coarse', pal('glassDark'), (i, j, w, h) => j > 1 && i > 0 && i < w - 1 ? 1 : 0, 0, 1), ...G.face('-z', 'coarse', pal('glassDark'), (i, j, w, h) => j > 1 && i > 0 && i < w - 1 ? 1 : 0, 0, 1)]));
    for (const x of [34.3, 35.6]) for (const z of [20.25, 22.95]) W(x, z, 0, 0.3, 0.2, 0.1, M.block);
    W(34.95, 21.7, 1.35, 1.43, 0.14, 0.06, M.jerryYellow);
    for (const [x, z] of [[33.93, 11.8]]) { W(x, z, 0, 0.9, 0.015, 0.015, M.woodGrey); W(x, z, 0.9, 1.1, 0.01, 0.12, M.rugCream, art('-x', 'base', pal('plasticBlack'), (i, j, w, h) => j > 1 && j < h - 2 && (i === 3 || i === 6) ? 1 : 0)); }
    floor(33.97, 8.45, 0.05, 1.0, 'iron', 0.05, 0.02); thing(33.96, 7.98, 0.3, 0.035, 0.045, 0.02, 'jerryYellow');   // a chain through the pickup's wheel and a brass padlock
    floor(34.72, 17.85, 0.05, 1.15, 'iron', 0.12, 0.02); thing(34.66, 17.85, 0.02, 0.035, 0.045, 0.02, 'jerryYellow');   // the two motorbikes chained together
    K.prop('bin', 34.4, 12.85, 0, 9, [{ off: [0, 0.1, 0], h: [0.3, 0.1, 0.3], yaw: 0, albedo: M.rubber.albedo }, { off: [0, 0.1, 0], h: [0.3, 0.098, 0.3], yaw: QTR, albedo: M.rubber.albedo }], [0.31, 0.31]);

    // the lived props take their room's name (lived.<room>.<n>): the loader leaves them out with the switch off
    spans.push([K.props.length, '']);
    for (let s = 0; s + 1 < spans.length; s++) for (let i = spans[s][0], n = 0; i < spans[s + 1][0]; i++, n++) K.props[i].name = `lived.${spans[s][1]}.${K.props[i].kind}${n}`;
  }

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors: doorDefs,
    devices,
    breaker: { pos: [8.3, 1.35, 23.68], boxes: [brk, brkLed] },
    beacons,
    playerSpawn: [...START.sam],
    routes: ROUTES.map(r => ({ ...r, points: r.points.map(p => [...p] as Vec3), wait: [...r.wait], ...(r.keys ? { keys: [...r.keys] } : {}) })), chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // spots[variant] + exits[0]. exfilX is a stride past the east gate's frame (out = east of it, inside the frame's width)
    mission: { serverRoom: { ...SPOT.area }, entryDoor: SPOT.door, rack: { index: SPOT.rackIndex, front: [...SPOT.front], halfW: SPOT.halfW }, exfilDoor: EXIT.door, exfilX: EXIT.x + 0.6, exfilZ: EXIT.z, exfilOut: [...EXIT.out] },
  };

  // ---------------- what is underfoot (game/floor.ts: which step sounds, and how far it carries to their ears) ----------------
  // The yard is packed earth ('asphalt' is the nearest of the six). The building's beaten floor is 'lino'; the CORRIDOR is poured concrete — 'stone', the
  // loudest floor there is, on the short way: a walking step carries 5.2 m along it — and the commander's rug and the bunk room's are 'carpet' (2 m).
  const surfaces: SurfacesData = {
    building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt',
    zones: [
      { id: 'corridor', mat: 'stone', x0: 13, z0: 12, x1: 31, z1: 14.5 },
      { id: 'office', mat: 'carpet', x0: 27, z0: 8, x1: 31, z1: 12 },
      { id: 'bunk', mat: 'carpet', x0: 20, z0: 14.5, x1: 26, z1: 18.5 },
      { id: 'building', mat: 'lino', x0: 13, z0: 8, x1: 31, z1: 18.5 },
      { id: 'shed', mat: 'stone', x0: 4, z0: 19.5, x1: 9.5, z1: 24 },
      { id: 'hut', mat: 'stone', x0: 22.5, z0: 21, x1: 26.5, z1: 24 },
      { id: 'motorpool', mat: 'stone', x0: 4, z0: 4, x1: 8.9, z1: 9.2 },
    ],
  };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the north gate from outside the wall (the second start's side), the motor
  // pool's two pickups under their canopy behind it.
  const scenarios = !VARIANT ? { quiet: QUIET, places: PLACES, response: RESPONSE, kitView: { ways: [{ door: 'gate_n', ref: [12.5, 1.8], side: 1 }] }, doorNames: DOOR_NAMES } as LevelScenarios : undefined;
  return { level, ...(scenarios ? { scenarios } : {}), groups: trace.groups, surfaces, quiet: QUIET };
}
