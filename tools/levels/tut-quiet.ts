// THE LEDGER — the tutorial's quiet mission: one line through a money changer's house at night, alone, and each stretch of it is ONE tool and one small thrill.
// It stands on the shared walled yard (tools/levels/train-ground.ts, GWOT kit) and is not a Training level: a real small mission with one way through.
//
//        x 8      12.5      16.5    20        25.5        30.5 32
//   z 6  ┌────────┬───────────────────────────────────────────┬─┐
//        │        │ strong- │ clerk's  │   hall   │   store    │ │     the house, west to east:
//        │ fore-  │  room  pad  table  │   beam   │            │ │       strongroom     a door on a keypad (the code is in a man's head), the safe
//  gate_w  court  ├────────┘           │    ╎   man            │ │       counting room  a counter the length of it, the one way round at its far end
//        │ (lamp) front ══ counter ════╡    ╎   (open)         │ │       hall           lit; a beam at the chest; the mains box by the counting room's doorway
//        │        │   clients' side  (open) box    │   back    │ │       store          dark; its back door is on a cylinder (it picks)
//   16.5 │        └────────────────────┴──────────┴──╧─────────┴─┤
//        │  the lane: the house's shadow      ·  ╎ the walk       │     the lane        the moon stands behind the house: its shadow lies along the wall
//        │                       ════ the long wall ════╗  court  │     the long wall   head high; the only way between lane and court is the walk
//        │                             (the hide)    ╎   (lamp)   │                     between it and the house
//   z 22 └────────────────────────────────────────────────────────┘
//
// THE LINE (scenarios.lesson; tools/qa/lessons/tut-quiet.ts plays it by input alone):
//   the lane        light: out of the porch lamp, round the house's corner, along its shadow to the mark.
//   the long wall   sound, then hands: a whistle at the mark and the player steps behind the long wall. The back court's man comes the long way round, along
//                   the walk on the wall's other side, to where the sound was, and stands looking at it with his back to the wall's end. Round the end, a
//                   grab from the dark; he is asked, and gives the strongroom's code; then the choice: out cold, or the knife.
//   the back door   a lock picked in the long wall's shadow, the court's lamp a wall away and nobody left to watch.
//   the store       the dark corner beside a lit doorway: the hall's man stands a stride inside it with his back turned. On a knee, out of the dark into
//                   the light behind him: the knife. A walking step he would hear; a crouched one he does not.
//   the hall        a beam at the chest (under it on a knee), a beam at the shins across the counting room's doorway (nothing goes under that): the mains.
//   the set piece   night vision, the box: every lamp and the shin beam die. The clerk is the nearest man to the box and has the longest walk to it,
//                   round the counter's far end: ten seconds of him coming, in green, his light ahead of him. The player is in the niche by the doorway,
//                   behind its stub of wall; the man comes through, walks past it to the box and works there with his back to it (this level's box
//                   takes seven seconds, breaker.fumble). Taken there, the house is the player's: the first man's code opens the strongroom, the safe, out by the front door.
//
// WHY EACH TIMED BEAT IS BUILT AS IT IS: a line is read before it is obeyed. A beat with a clock (a man coming) has its whole instruction in the line that
// is up BEFORE the clock starts ('whistle here, then hide'; 'the box, then behind the wall'), and the man's walk is long enough for the next line to be read
// while he is on his way: the long wall in the lane, the long counter in the house. Nothing asks for a reaction inside two seconds.
//
// THREE MEN, each with one beat. A fourth (inside the front door) was taken out: seven metres from the box through an open doorway he heard the clerk go
// down and turned his light on the player, and nothing in the room could hide that.
//
// THE MOON stands low in the north-west, behind the house from where the camera looks: the lane is the house's shadow. The night is the level's own (a quiet
// level's default is dry: rain would drown the whistle).
import type { LessonData, QuietData, Rect } from '../../src/scene/scenarios';
import type { DeviceDef } from '../../src/scene/level';
import { BoxFlag } from '../../src/scene/boxes';
import { normalize3 as norm } from '../../src/scene/officeGen';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { trainGround, TRAIN_MATERIALS, EXIT_W, HALF } from './train-ground';

export const NAME = 'tut-quiet';
export const NOTES = 'The tutorial\'s quiet mission, the ledger: a money changer\'s house at night, alone. One line: out of the lamp into the house\'s shadow, a man whistled round a wall the player stands behind and taken from behind for the strongroom\'s code, a picked back door, a knife from the dark into a lit room, a beam passed on a knee, then the mains: the clerk comes round his counter to the box in the dark and is taken at it, and the code opens the strongroom. Generated by tools/levels/tut-quiet.ts.';
export const MATERIALS = TRAIN_MATERIALS;

type P3 = [number, number, number];
/** the places the scripted player and the lesson name (tools/qa/lessons/tut-quiet.ts imports these, so a moved wall moves the script) */
export const TQ = {
  start: [9.3, 0, 14.0] as P3,
  dark: [13.6, 0, 17.5] as P3,            // the first dark: round the house's corner, in its shadow
  whistle: [21.5, 0, 17.5] as P3,         // where the whistle is blown: against the house, in its shadow
  his: [22.0, 0, 17.5] as P3,             // where the man who comes to the whistle ends his walk, his back to the long wall's end
  hide: [23.9, 0, 19.05] as P3,           // behind the long wall, on the lane's side of it: he walks past on the other side
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

const PLACES = { areas: [
  { name: 'strongroom', bounds: { x0: 12.62, x1: 16.38, z0: 8.62, z1: 12.08 } }, { name: 'counting room', bounds: { x0: 12.62, x1: 19.88, z0: 8.62, z1: 16.38 } },
  { name: 'hall', bounds: { x0: 20.12, x1: 25.38, z0: 8.62, z1: 16.38 } }, { name: 'store', bounds: { x0: 25.62, x1: 30.38, z0: 8.62, z1: 16.38 } },
  { name: 'back court', bounds: { x0: 25.62, x1: 31.88, z0: 16.62, z1: 21.88 } }, { name: 'lane', bounds: { x0: 12.5, x1: 25.38, z0: 16.62, z1: 21.88 } },
  { name: 'forecourt', bounds: { x0: 8.12, x1: 12.5, z0: 6.12, z1: 21.88 } }, { name: 'track', bounds: { x0: 0, x1: 8.12, z0: 0, z1: 28 } },
] };

export function build() {
  const T = trainGround(), { G, grp } = T;
  // the moon behind the house (the shell's stands in the south-west): light falls from the north-west, shadows toward the camera
  { const moon = T.lights.find(l => l.name === 'moon')!; moon.dir = norm([0.28, -0.3, 0.73]); }

  // ---- the house: strongroom and counting room (west), the hall, the store (east) ----
  const HOUSE = T.hut({ x0: 12.5, z0: 8.5, x1: 30.5, z1: 16.5, kind: 'render', floor: 'slab', doors: [
    // the front door: on the latch against the forecourt, free from the counting room (the way out)
    { name: 'front', side: 'w', at: 14.5, extra: { locked: true, keySide: 1 } },
    // the back door, in the back court: a cylinder (it picks)
    { name: 'back', side: 's', at: 27.3, extra: { locked: true } },
  ] });
  grp('house.inner');
  G.wallZ(20, 8.62, 16.38, 'render', [{ a: 14.6, b: 15.8 }]);                      // the counting room's doorway: no leaf, a beam across it at the shins
  G.wallZ(25.5, 8.62, 16.38, 'render', [{ a: 12.0, b: 13.2 }]);                      // the store's doorway: no leaf
  G.wallX(12.2, 12.62, 16.62, 'render'); G.wallZ(16.5, 8.62, 12.08, 'render', [{ a: 9.7, b: 10.9 }]);
  T.doors.push({ name: 'strong', hinge: [16.5, 9.72], closedDir: HALF, width: 1.16, locked: true, lock: 'pad_strong', keySide: -1 });
  const STRONG: Rect = { x0: HOUSE.x0, x1: 16.38, z0: HOUSE.z0, z1: 12.08 };

  grp('house.strong');
  G.bulb(14.5, 10.6, 'bulb_strong', 'strong', false);
  // the safe, against the far wall: an iron box on a plinth, a door plate and a wheel on its face
  T.add({ c: [14.5, 0.06, 9.02], h: [0.5, 0.06, 0.38], ...GWOT_MATERIALS.block });
  T.add({ c: [14.5, 0.67, 9.02], h: [0.44, 0.55, 0.34], ...GWOT_MATERIALS.iron });
  T.add({ c: [14.5, 0.67, 9.37], h: [0.36, 0.46, 0.012], ...GWOT_MATERIALS.galv, flags: BoxFlag.NoShadow });
  T.add({ c: [14.66, 0.72, 9.395], h: [0.07, 0.07, 0.014], ...GWOT_MATERIALS.iron, flags: BoxFlag.NoShadow });
  { const led = T.add({ c: [14.26, 1.04, 9.388], h: [0.03, 0.012, 0.006], ...GWOT_MATERIALS.iron, emissive: [3, 0.4, 0.2], flags: BoxFlag.NoShadow });
    T.switchables.push({ name: 'rack0_leds', boxes: [led], group: 'objective', on: true, baseEmissive: [3, 0.4, 0.2], mains: false }); }
  G.trunk(13.2, 11.3, HALF, 'paintBlue'); G.sacks(15.8, 11.5, 0.2, 3); G.crates(13.1, 9.1, 0, 2, 'olive');

  grp('house.count');
  G.bulb(16.6, 14.2, 'bulb_count', 'count', true);
  G.dado('z', 12.5, 12.34, 14.76, 1, 'paintBlue'); G.dado('z', 12.5, 15.74, 16.36, 1, 'paintBlue');
  G.table(18.4, 9.3, 1.6, 0.7); G.plasticChair(18.4, 10.05, Math.PI);                 // the counting table, in the lobby before the strongroom
  G.rug(16.6, 15.0, 2.6, 1.4, 'afghan'); G.toshak(17.6, 15.95, 1.9, 0); G.lowTable(16.2, 15.9, 0);   // where clients sit and wait
  // THE COUNTER: the length of the room, the clerk's side and the clients' side, the one way round it at its far end by the front door. So the clerk,
  // the nearest man to the mains box by the straight line, has the longest walk to it: time to be read coming, in the dark, round the counter's end
  T.add({ c: [16.89, 0.5, 13.8], h: [2.99, 0.5, 0.26], ...GWOT_MATERIALS.poplar });
  T.add({ c: [16.89, 1.03, 13.8], h: [3.03, 0.03, 0.31], ...GWOT_MATERIALS.poplar });
  G.crates(19.3, 11.5, 0.05, 2, 'ply');

  grp('house.hall');
  G.bulb(23.4, 12.6, 'bulb_hall', 'hall', true);
  // THE MAINS BOX: on the hall's own wall, a stride inside the counting room's doorway. The man sent to it comes through that doorway and stands at it
  // with his back to the room. (The game's fixed spot for the man sent to a panel lies toward −x and −z of it:
  // a box that faces −z with floor before it is stood at alike on both stands)
  T.breakerAt(TQ.box[0], 16.34, 'n', 7); grp('house.hall');   // (seven seconds at it: an old box, his back to the room and his light on the panel)
  // TWO WALLS THE PAGE ASKED FOR. On the page the man who comes to the box carries a light, and a light finds what the dark hid: the hall's man where he
  // fell (the mission teaches no carrying), and anyone flat to a wall in the open (inside 3.5 m a man sees a shape at his elbow). So what hides here is
  // a WALL, as in the lane.  THE SCREEN cuts the hall in two: the lobby with the box, and the back with the beam, the hall's man and his body; from the
  // doorway and from the box nothing of the back can be seen.  THE NICHE is a stub by the doorway: the player waits behind it, the man walks past its
  // end to the box and stops there facing the way he walked, and the player steps out at his back
  G.partZ(22.7, 12.0, 16.38, 'render');
  G.partX(14.4, 20.12, 20.8, 'render');
  G.rug(23.4, 14.2, 2.4, 1.4, 'mat'); G.crates(24.8, 9.2, 0.1, 2, 'olive'); G.plasticChair(24.9, 15.6, -HALF); G.sacks(21.2, 9.3, 0.1, 3); G.trunk(22.6, 9.2, 0, 'paintGreen');

  grp('house.store');
  G.bulb(28.0, 12.4, 'bulb_store', 'store', false);
  G.sacks(29.6, 9.4, 0, 3); G.sacks(28.2, 9.3, 0.1, 3); G.crates(29.7, 11.6, HALF, 3, 'ply'); G.crates(26.4, 9.3, 0.05, 2, 'olive');
  G.drums(29.7, 14.4, 2); G.jerryCan(29.9, 15.8, 0.3); G.trunk(26.3, 15.85, 0, 'paintGreen');

  // ---- the lane and the back court: the cross wall with its gap, the long wall along the house ----
  grp('walls.lane');
  // (these stand LOW, a head high, piers and coping and all under 2 m: a man cannot see over them, and a whistle carries over the top — collision.ts propagate)
  const LOW = 1.8;
  G.yardWallZ(25.5, 16.62, 21.88, 'mud', [{ a: 17.3, b: 18.2, y0: 0, y1: LOW }], LOW);
  // THE LONG WALL: a head-high wall a stride and a half off the house and along it, from the lane through the cross wall into the back court. The way
  // between the lane and the court is the walk between it and the house (the cross wall's gap is in that walk). The man in the court hears a whistle
  // over the walls and has to come the long way: round the wall's far end, along the house, through the gap. The player is by then on the lane's side
  // of the wall, and comes round its near end at his back
  G.yardWallX(18.6, 23.2, 25.38, 'mud', [], LOW); G.pier(23.2, 18.6, LOW - 0.1);
  G.yardWallX(18.6, 25.62, 30.4, 'mud', [], LOW); G.pier(30.4, 18.6, LOW - 0.1);
  G.yardWallZ(12.5, 6.12, 8.38); G.yardWallX(16.5, 30.62, 31.88);                     // the strips behind the house and past its far end are shut off: one way round
  grp('yard');
  T.lamp(10.4, 13.2, 'lamp_porch', { mains: true });
  T.lamp(28.9, 20.9, 'lamp_back', { mains: true });
  G.ground(25.62, 16.62, 31.88, 21.88, 'slab');
  G.waterTank(9.4, 7.4); G.drums(11.1, 7.0, 3); G.motorbike(11.9, 11.6, HALF); G.sacks(9.0, 20.9, 0.1, 3);
  G.patch(10.4, 14.1, 4.0, 1.3, 'damp'); G.patch(17.5, 20.4, 5.0, 1.6, 'damp', 0.05); G.patch(28.0, 20.3, 3.0, 1.2, 'damp', 0.2);
  G.woodPile(16.2, 21.5, 0, 1.6); G.tyres(13.4, 21.3, 3); G.handcart(19.2, 21.2, 0.1, 'sacks'); G.blocks(22.6, 21.4, 0, 2);
  G.generator(31.0, 21.1, HALF); G.gasBottle(30.9, 17.3); G.plasticChair(30.2, 17.2, Math.PI); G.jerryCan(30.3, 21.6, 0.2);
  G.pickup(3.9, 10.4, 0.12, 'truckWhite', { load: 'sacks' });                           // outside the wall, on the track

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
    starts: [{ name: 'the track gate', sam: TQ.start, samYaw: HALF }],
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
  const mark = (p: P3): P3 => [p[0], 1, p[2]];
  const lesson: LessonData = {
    title: 'Unseen',
    // THE FRAME (game/rails.ts). From the first step: the walk, the view, the aim. Each tool is switched on by the step that teaches it and stays on.
    // `rows` = the verbs Space offers here: nothing a step did not teach has a row (a wall charge at the box, the light plate beside the strongroom's
    // door, a body to drag), so a tap is always the thing the line means.
    rails: { allow: ['move', 'camera', 'zoom', 'aim'], rows: ['grab', 'question', 'choke', 'pick', 'push', 'code', 'nocode', 'breakerOff', 'drive'] },
    steps: [
      // ---- the lane: light ----
      { id: 'crouch', line: '[C]: get low', allow: ['crouch'], done: any({ is: 'flag', flag: 'crouch' }, down(1)) },
      { id: 'dark', line: 'Get out of the light', done: any(all(near(TQ.dark, 1.6), { is: 'meter', which: 'light', below: 0.3 }), down(1)), hold: 0.4, at: mark(TQ.dark) },
      { id: 'creep', line: 'Stay in the shadow', cue: 'lane', done: any(near(TQ.whistle, 1.0), ...held, down(1)), at: mark(TQ.whistle) },
      // ---- the long wall: sound, then hands ----
      // (a beat with a clock: the whole instruction is in the line that is up BEFORE the clock starts, the mark on the place the line means now — his own
      // feet for the whistle; the moment it sounds the next line is up with the mark on the hide. A mark on the hide first sent a new player there to whistle.)
      { id: 'whistle', line: '[V]: whistle here. Then hide behind the wall', allow: ['whistle'], checkpoint: 'the lane', done: any(did('event:whistle'), ...held, down(1)), at: mark(TQ.whistle) },
      { id: 'grab', line: 'Hide. When he stops: round the wall, [Space]', allow: ['use'], done: any(...held, down(1)), at: mark(TQ.hide) },
      { id: 'ask', line: '[Space]: ask him the code', done: any(did('chron:codeLearned'), down(1)) },
      { id: 'drop', line: 'Right button: out cold. Left: the knife', allow: ['fire', 'alt'], done: down(1) },
      // ---- the back door: a lock ----
      { id: 'pick', line: '[Space] at the lock. Then keep still', checkpoint: 'the back court', done: any(did('chron:lockPicked'), { is: 'door', door: 'back', state: 'open' }, { is: 'door', door: 'back', state: 'unlocked' }, { is: 'door', door: 'back', state: 'broken' }), at: mark(TQ.backDoor) },
      // ---- the store: a man in the light, the player in the dark ----
      { id: 'nook', line: 'In. Stay in the dark', cue: 'store', done: any(near(TQ.nook, 0.8), down(2)), hold: 0.3, at: mark(TQ.nook) },
      { id: 'strike', line: 'Stay low: he hears a step. Left button', checkpoint: 'the store', done: down(2), at: [24.9, 1, 12.6] },
      // ---- the hall: two beams and the mains ----
      { id: 'under', line: 'Stay low: under the beam', done: any({ is: 'in', area: { x0: 20.12, x1: 23.4, z0: 8.62, z1: 16.38 } }, did('act:breakerOff')), at: mark(TQ.under) },
      // ---- the set piece: the mains ----
      { id: 'nv', line: '[N]: night vision', allow: ['nvg'], checkpoint: 'the hall', done: any({ is: 'flag', flag: 'nv' }, down(3)) },
      { id: 'box', line: '[Space] at the box. Then behind the wall', done: any(did('act:breakerOff'), down(3)), at: mark(TQ.boxAt) },
      { id: 'boxman', line: 'Hide. When he works at the box: strike', done: down(3), at: mark(TQ.wait) },
      { id: 'code', line: '[Space] at the pad: his code', checkpoint: 'the counting room', done: any(did('chron:codeEntered'), { is: 'door', door: 'strong', state: 'open' }, { is: 'door', door: 'strong', state: 'broken' }), at: [17.3, 1, 10.6] },
      { id: 'safe', line: '[Space] at the safe. Keep still', done: { is: 'stage', stage: 'exfil' }, at: front },
      { id: 'out', line: 'Out by the front door', done: any({ is: 'in', area: { x0: 8.12, x1: 12.3, z0: 11.0, z1: 18.0 } }, { is: 'stage', stage: 'done' }), at: [11.4, 1, 15.1] },
    ],
  };
  T.doors.find(d => d.name === 'gate_e')!.locked = true;   // the far gate is no part of this night
  const out = T.finish({
    spawn: TQ.start, routes,
    mission: { serverRoom: { ...STRONG }, entryDoor: 'strong', rack: { index: 0, front, halfW: 0.35 }, exfilDoor: 'gate_w', exfilX: EXIT_W.x, exfilZ: EXIT_W.z, exfilOut: EXIT_W.out },
    scenarios: { quiet, lesson, places: PLACES, doorNames: [{ door: 'front', name: 'front door' }, { door: 'back', name: 'back door' }, { door: 'strong', name: 'strongroom door' }] },
    level: { devices },
  });  return out;
}
