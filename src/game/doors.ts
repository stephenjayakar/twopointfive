// Hinged doors: leaves that characters push open by walking into them — and, one-way (DOORWAY, below), pull open from the side they open into — with inertia, limit stops,
// a slow hydraulic closer and a latch. Rendered/traced as thin dynamic boxes, so light spills through the gap as
// they swing (radiance cascades pick the change up over a couple of frames). Also used as occluders for guard
// vision, hearing and audio propagation.
import { Vec3, clamp } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import { doorLeafMarks } from '../scene/markingDefaults';
import { LEAF_H } from '../scene/doorSize';

/** ONE-WAY LEAVES (the maintainer, 10-08: "doors could use some work too. only open one direction"). Every door has a hinge jamb, a handle jamb and ONE side it opens
 *  into (Door.swing): its leaf turns through angles of that sign only, 0 (shut, hard on its frame) to its open stop — whoever opens it, from whichever face.
 *  From the far face it is PUSHED as ever; from the face it opens into it is PULLED: a man walking into it there (or using it, easing it, booting it, shoving
 *  it by a drill's own write of Door.vel) brings it round toward himself, and for PULL_SECS the swinging leaf is not felt by the living (it passes them, as a
 *  leaf a keyed man pulls shut passes him — `passers`). Nothing swings it through its frame: a push at the shut leaf from the side it opens into is a pull, a
 *  leaf coming to from open stops on the frame, an angle or a velocity written the wrong way by anybody is turned round (Door.keep / Doors.update).
 *  `oneWay: false` (the page's ?twoway) = the double-acting leaves as they were, instruction for instruction: swing is still dealt, nothing reads it.
 *  THE FRAME HOLDS (`frameHolds`; the maintainer, 10-08: "for doors just make it realistic"). A leaf shut in its frame rests on the frame's stop all the way round on
 *  the face it opens toward: a boot there loads the whole frame, not the keep, and the door does not open (Doors.bootHolds / kickIn — a loud thud, nothing
 *  broken); what does open it from that face is its lock worked or destroyed (a pick, a key, a charge) and then a hand. The same fact from the inside: a wedge
 *  or a dragged desk holds only a door that swings toward the man who put it there (digin.ts). Only with oneWay on, never while a showcase has the stage
 *  (Doors.frameRule); `frameHolds: false` (the page's ?frameholds=0) = a boot at the pull face flings the leaf round toward the kicker and a wedge holds
 *  any door, as they did. */
export const DOORWAY = { oneWay: true,
  /** FIRE EXITS AND OUTSIDE DOORS OPEN OUTWARD (the maintainer, 10-08: "for doors just make it realistic"): a door the level marks `exterior` with a roof over one face
   *  only opens toward the open air (doorswing.ts 'outside' — Door.outward), whatever room it serves; an authored `swing` and a folding stop still speak first.
   *  Read live (Door.swing): false = every door the side the room rules deal it, as before the switch. Nothing reads it with oneWay off.
   *  SHIPS OFF (the doors goal's call, 10-08: a paired look on the barracks' first seeds lost teammates with it on, and nobody has played it): the page's
   *  ?exitsout, the Tab row or `--set '{"DOORWAY":{"exitsOut":true}}'` turns it on. */
  exitsOut: false,
  /** THE FRAME HOLDS: see the head comment. false (?frameholds=0) = a boot at the pull face flings the leaf, a wedge holds any door. */
  frameHolds: true,
  /** A BOOT FROM BESIDE THE DOOR (the maintainer, 10-11: "shouldn't it be possible to kick the door standing on its side?"): a kick may be thrown from beside the
   *  latch jamb, behind the wall, at the lock — Doors.kickSpotSide — so the kicker is never in the opening when the leaf goes. A squad's lead boots from there
   *  wherever the floor allows; the player does when he stands beside the latch jamb (square in front of the leaf it is the square kick, as ever). Off in the
   *  module and on the frozen stand (TPS_SIDEKICK=1), on in the page (?sidekick=0): off = every kick from Doors.kickSpot, as it was. */
  sideKick: false,
  /** … NEVER FROM IN FRONT OF GLASS (the maintainer, 10-13, of a lead booting from beside a latch jamb with a sidelight behind him, lit and shot through it:
   *  "yeah maybe this should force kicking from the front?"): where the spot beside the latch jamb is one a round reaches through a pane from the floor beyond
   *  the door (orders.ts glassEyes — the stack's own 'glass is not cover' question, asked of the kicker's spot: GLASSPEN.stackEyes lines or more), the squad's
   *  lead boots square in front of the leaf, as every kick was before sideKick — where there is floor there and clearly fewer such lines reach it (at most
   *  GLASSPEN.stackLeastK of them: glazing along the whole wall looks onto both, and beside the jamb he is at least out of the opening). The player's own kick is thrown from where he chose to stand, as it was. Nothing to ask with sideKick off or while
   *  rounds stop in glass. Off in the module and on the frozen stand (TPS_KICKGLASS=1), on in the page (?kickglass=0): off = the side spot wherever there is floor. */
  kickGlass: false };
try { const q = new URLSearchParams(location.search); if (q.has('oneway')) DOORWAY.oneWay = q.get('oneway') !== '0'; if (q.has('twoway')) DOORWAY.oneWay = false;
  if (q.has('exitsout')) DOORWAY.exitsOut = q.get('exitsout') !== '0'; if (q.has('exitsin')) DOORWAY.exitsOut = false;
  if (q.has('frameholds')) DOORWAY.frameHolds = q.get('frameholds') !== '0'; } catch { /* no page (the harness) */ }
/** the side kick's stand: metres past the latch edge along the wall, metres off the frame line (0.5 and 0.55 across = the kick's 0.74 m reach to the lock) */
export const SIDE_KICK = { past: 0.3, out: 0.55 };
/** rad/s a pulled leaf is brought round at (a quiet hand — crouched, a silent squad — the slower) · the seconds its swing passes the living. 3.9 coasts it to
 *  about 100 degrees: past square, clear of the doorway it was pulled out of — at 3.2 (use()'s own speed) it stood at 83, and since the doors are real size
 *  (scene/doorSize.ts) a leaf short of square stands in the walk of the man who pulled it */
const PULL_VEL = 3.9, PULL_VEL_QUIET = 2.2, PULL_SECS = 0.7;
/** …after he has pressed on it this long (it does not give that way: a beat of the hand finding the handle) — and never a leaf somebody is swinging INTO him: one
 *  pushed, shoved or booted open inside the last DRIVEN_SECS, or still coming round faster than DRIVEN_VEL, meets him as it always did (it stops against him) */
const PRESS_SECS = 0.08, DRIVEN_SECS = 0.25, DRIVEN_VEL = 0.5;
/** A LEAF STANDING OPEN ON ITS STOP IS A WALL, and a wall stops a man's body at this radius (the walkers' own against the statics: guards.ts; the player's in a
 *  door frame: player.ts bodyR). A leaf that can still turn is felt at the contact's radius, a hand wider — it gives. Since the doors are real size
 *  (scene/doorSize.ts) that hand is the room there is: a 0.86 m leaf square open against a side wall leaves 0.83 m less its own thickness to walk through, and
 *  a man held a hand off it had 7 cm of it to find — he touched it, and a keyed man who touches a leaf on its stop takes it shut (the yank below). */
const STOP_BODY = 0.3;
/** (DoorContact.round) the back of a leaf standing open clear of its doorway, to a man who goes round it: he is moved along it toward its free end at
 *  `ROUND_SLIDE` m/s (a walk); `ROUND_SECS` of men pressed on one leaf's back without a let-up (Door.pressT) and there is no way round (a wall by its tip, a
 *  man in the gap): it turns under him as it does under anyone. Never a leaf turning faster than `ROUND_STILL` rad/s: that one is in somebody's hand. */
const ROUND_SLIDE = 1.5, ROUND_SECS = 1.2, ROUND_STILL = 1.0;
/** a shove written the wrong way on a leaf standing less open than this means OPEN IT (it is mirrored: the writers — doortools, the drills, qrf, kickIn — all
 *  shove a leaf they do not count open yet, up to 1.2‥1.4 rad, away from the man); on one standing wider it is a shove toward shut, and stays */
const SHOVE_OPENS_BELOW = 1.2;
/** a leaf standing nearer its frame than this is home in it: its far face is hard on the stop (DOORWAY.frameHolds — a boot from the face it opens toward) */
const SHUT_HOME = 0.05;

export interface DoorDef {
  name: string;
  hinge: [number, number];        // x, z of the hinge axis
  closedDir: number;               // world angle of the closed leaf (0 → +X, π/2 → +Z)
  width: number;                   // leaf length from the hinge
  height?: number; thickness?: number;
  minAngle?: number; maxAngle?: number;   // swing limits relative to closed (radians)
  angle?: number;                  // initial angle
  /** the side it opens into (DOORWAY): +1 = the CCW side of the closed leaf (positive angles; Doors.side's +1), −1 the other. Absent = dealt from the level
   *  (game/doorswing.ts: into the room it serves, away from the corridor). */
  swing?: 1 | -1;
  albedo?: Vec3;
  closer?: boolean;                // hydraulic closer (default true); false = stays where it was left
  exterior?: boolean;              // opens onto the lot (level.ts): guards tidying doors in a lockdown leave it alone
  /** A keyed lever set: while the leaf is latched it will not open from the `keySide` (the corridor) to anyone without a key — guards carry keys, the player picks
   *  it (Doors.pick) or kicks it in (Doors.kickIn), or takes a key off a man he questions (player.ts takeKey) and it opens to him as it does to them. The room
   *  side is a thumb-turn: it always opens from there, so you can shut yourself in but never lock yourself in. The lock only bites once the latch has caught:
   *  a leaf still swinging to can be caught and pushed like any other. */
  locked?: boolean;
  /** which face carries the cylinder: +1 = the CCW side of the closed leaf (+perp in Doors' side convention — the corridor for every door on the z=10 wall), −1 the other */
  keySide?: 1 | -1;
  /** which key turns it (Door.lockId): absent = FLOOR_KEY, the one key every man on nights carries and every keyed door on this floor takes. A second cylinder
   *  would name its own ('server', say) and want a holder (level.ts PatrolRoute.keys). */
  lock?: string;
  /** a steel fire door in a steel frame (the west stair door — game/qrf.ts): a boot does nothing to it but make a noise (kickIn: no broken keep, no swing, a clang
   *  the men nearby come to look at), and its corridor face has no keyway to pick (player.ts offers no 'pick' row). It opens like any door to a key that fits,
   *  and always from its far side. */
  steel?: boolean;
}
/** the lock every keyed door takes unless its def says otherwise, and the key every guard carries unless his route says otherwise (game.ts Guard.keys) */
export const FLOOR_KEY = 'floor';

/** DOORS STAY WHERE THEY ARE LEFT (the shipped default; `on: false` = every leaf as it was, by run digest): no leaf has a closer, whatever its def says — an opened
 *  door stands at the angle it was left until a hand (use / crack / pullTo — the player's row, a staff man shutting his own keyed door behind him or tidying in a
 *  lockdown (guards.ts lockdownDoors), a man digging in), a body walking
 *  into it, a boot or a blast moves it. The lock of a keyed door therefore bites again only once somebody SHUTS it (it never springs locked behind a key holder),
 *  and a keyed man pinned by a leaf on its stop, or snagged on its free edge, no longer pulls it to behind him (the old `yank`): he steps through its edge
 *  (Door.passers) and the leaf stays where it stood. A close somebody asked for (Door.closing: pullTo) is still the sprung pull the latch catches.
 *  NOBODY SHUTS A DOOR BY WALKING INTO IT WITHOUT MEANING TO (Door.swept): a leaf a keyed man's BODY alone has brought round to its frame — herded shut ahead of
 *  him as he walks the wall behind it — rests to there, UNLATCHED: no click, and whoever opens it next gets the creak a shut door gives. The latch catches what
 *  a hand shut (pullTo), what the player leaned shut himself, what a man ran into, whatever a boot, a blast or a script sent home. A keyed door is no
 *  exception: its bolt bites once somebody SHUTS it (above), and a man brushing past it has not — a teammate's shoulder never locks Sam out.
 *  NOT while a showcase has the stage (Doors.staged ← Game.touring): those films were choreographed against the closers, beat for beat, and run with them. */
export const DOORSTAY = { on: true };

/** A DOOR SWUNG OR KICKED INTO A MAN THROWS HIM (the maintainer: 'opening a door into the enemy should majorly confuse them' · 'kicking down a door when an
 *  enemy on the side should stun or knock them out'). A leaf DRIVEN OPEN — walked open by a man on its other face, turned by a hand, shoved, flung by a door
 *  order, run through, booted — used to stop dead against whoever stood in its swing, and he held it shut on the man opening it. Now it wins: he is carried
 *  clear ahead of it and along it toward its free end (Doors.update), and what it did to him is handed out on his contact (DoorContact.struck) for doorthrow.ts
 *  to make of it — folded and blind for `pushSecs`, or for `kickSecs` under a BOOT (kickIn, which says so itself: a boot, a breaching shell), and put on a knee by
 *  one that met him before it had turned `floorRad` from where it was booted (he stood right at the door). By behaviour, never by hit points: nothing here
 *  hurts anybody. The same for whoever it meets — a defender, Sam, a teammate, a civilian.
 *  NOT a throw: a leaf eased (a hand slower than `handRate`, a crouched or silent man's body — DoorContact.quiet — or any leaf slower than `minSpeed` where
 *  it meets him), pulled (it passes the living on that side as ever), swinging shut, or one the man walked into himself; a leaf opened short of a boot by a
 *  CALM man (MAN_CALM: staff not alert or searching, any civilian — he opens a door with his hand at a walk: the patrol's round, the cleaner's, throw nobody
 *  and raise no alarm of their own, and a man hidden behind a door stays hidden); a leaf a man of HIS OWN side opened any way short of a boot (the squad's file through a door, a pair's shove into a room
 *  the other pair is already in, are not a brawl — a leaf one of them BOOTS meets him like anyone); a man already folded or just up from it (`again` s: he is carried, not
 *  thrown twice); a showcase on the stage. A man with no floor to be moved onto (his back to a wall) is struck where he stands and the leaf rests on him.
 *  `on`: ON in the page (src/host/profile.ts; ?doorthrow=0 = every leaf stops against a standing man, as it did), OFF here and on the harness's frozen stand
 *  (TPS_DOORTHROW=1). */
export const DOORTHROW = { on: false,
  /** s folded and blind: a leaf pushed, shoved or flung into him · a booted one */
  pushSecs: 2.0, kickSecs: 4.0,
  /** m/s a swinging leaf must still be doing where it meets him (slower, it comes to rest against him as ever) */
  minSpeed: 0.9,
  /** rad/s a hand must turn a leaf at for it to be a push (the silent ease is 0.55; the hand's own push 2.6) */
  handRate: 1.2,
  /** rad a booted leaf may have turned when it meets him for him to have stood right at the door: he goes onto a knee for it */
  floorRad: 0.6,
  /** m/s a leaf carries a thrown man ahead of it at most (a frame's turn beyond that and it rests on him this frame) · m/s he is moved along it toward its free end */
  rate: 9, slide: 1.5,
  /** s after a fold has run out in which no leaf throws him again */
  again: 3.0,
  /** the awareness a man comes back with when the leaf was a foe's (the ring's own: alert) */
  aware: 0.92,
};
/** who last DROVE a leaf open and how (DOORTHROW; Door.drive): `dir` the sign of the turn, `kind` a boot (kickIn) · any other swing written onto it (a shove,
 *  a fling, a shoulder at a run) · a body walking it open · a hand turning it; `t` seconds since; `from` the angle it stood at; `quiet` a crouched, silent or
 *  calm man's; `side` whose man he was when he drove it (MAN_SIDE; 0 nobody's); `rate` rad/s a hand was turning it at, or a body would turn it at by its own
 *  stride — where he stood when the last update ended (`px`, `pz`) to where he pressed it from, over his lever: never the leaf's own turn, which two men
 *  pressing one leaf from both faces see-saw up to anything */
export interface DoorDrive { who: number; dir: 1 | -1; kind: 'boot' | 'swing' | 'body' | 'hand'; t: number; from: number; quiet: boolean; side: number; rate: number; px: number; pz: number; }
/** what Doors.man answers about a man (DOORTHROW): whose he is in the low two bits (1 Sam and his squad · 2 the defenders · 3 a civilian · 0 nobody's) | is he
 *  folded right now (he holds no leaf: one driven at him carries him) | braced (just up from a fold, or in somebody's arm: no throw) | calm (above) */
export const MAN_SIDE = 3, MAN_FOLDED = 4, MAN_BRACED = 8, MAN_CALM = 16;
/** what a driven leaf did to the man it met (DOORTHROW; DoorContact.struck): whose leaf, a boot's or not, did he stand right at it, and the way he was thrown (x, z) */
export interface DoorStrike { door: Door; by: number; hard: boolean; floor: boolean; dir: [number, number]; }

/** weak: a limp thing (a corpse's particle) — it never unlatches or bashes a leaf, and a leaf that someone stronger is pushing this frame, or a latched one,
 *  pushes IT (pos is corrected) instead of yielding; otherwise the leaf rests against it like against anyone (the closer cannot shut a door on a body).
 *  key: staff (guards) — every locked leaf unlatches for them like an unlocked one, and they handle leaves the way staff do (pull one to behind them, take the
 *  blame for what it does, are let through one a colleague is pulling shut). keys: the keys a keyless body carries all the same (the player, off a man he
 *  questioned — Player.keys): a locked leaf whose lock one of them fits (Door.lockId) is no wall to him; nothing else about how leaves treat him changes.
 *  blockedBy (out): the locked leaf that stopped this contact this frame. */
export interface DoorContact { pos: Vec3; radius: number; bash: boolean; who: number; quiet: boolean; weak?: boolean; key?: boolean; keys?: ReadonlySet<string>; blockedBy?: Door | null;
  /** a man of the AI who opens doors by the HANDLE (handleside.ts — game.ts sets it): his body against a leaf on the face it opens into is not his hand on it — the
   *  leaf is a wall to him, as it is to anyone for PRESS_SECS, until he has leaned on it this many seconds (wedged against it with no other way: then as before) */
  hand?: number;
  /** a man who walks ROUND a leaf standing open across his way (doorway.ts DOORMANNERS.leafRound — game.ts sets it for Sam's squad): pressed on its back at a
   *  walk he does not turn it toward shut, he goes along it and round its free end (ROUND_*) */
  round?: boolean;
  /** a RUN at a door that has weight (sprintdoor.ts — game.ts sets it on a sprinting player while SPRINTDOOR is live; absent = every contact as it was): the
   *  rad/s a leaf leaves his shoulder at when he runs it open from its push face, and the rad/s + loudness of one he rips round by the handle from the face it
   *  opens toward (instead of the 7.5 haul at a bash's full noise). bashed / ripped (out): the leaf he did that to this frame (the last of each, where two
   *  leaves meet him in one frame: one cost a frame, never two). */
  run?: { bash: number; rip: number; ripLevel: number }; bashed?: Door | null; ripped?: Door | null;
  /** (out, with bashed) the angle the leaf stood at when his shoulder met it: what `square on` is measured against */
  bashedAt?: number;
  /** DOORTHROW — struck (out): the driven leaf that threw him this frame · moved (out): a leaf carried him this frame (his place is the caller's to settle
   *  against the walls) · man: Doors.man's answer about him, asked once a frame and only when he is at a leaf */
  struck?: DoorStrike | null; moved?: boolean; man?: number; }
/** does this contact's key ring get it through d's lock: staff always, anyone else by a key that fits */
const opens = (c: DoorContact, d: Door) => !!c.key || (!!c.keys && c.keys.has(d.lockId));
/** rattle: the lever tried against a thrown bolt · pick: one click of the pick working · unlock: the cylinder going over and the bolt drawing · kick: a boot through the lock */
export type DoorSound = 'creak' | 'bang' | 'latch' | 'bash' | 'rattle' | 'pick' | 'unlock' | 'kick' | 'clang' | 'thud';   // clang: a boot on a steel door that does not give (DoorDef.steel) · thud: a boot at the face a shut door opens toward — the frame takes it (DOORWAY.frameHolds)
export interface DoorEvent { door: Door; sound: DoorSound; pos: Vec3; who: number; level: number; }
/** A leaf OFF ITS HINGES (doorblast.ts — a blast tore it out of its frame, or gunfire took it apart: DOORSHOT): the loose slab. `p` its centre, `v` its velocity, `a` the world angle of its width axis
 *  (what closedDir + angle was when it went, turned since by `spin`), `tip` 0 (upright) ‥ π/2 (flat on the floor) with its top fallen toward `side` of that axis
 *  (+1 = the CCW normal (−sin a, cos a)), `rest` once it lies still — from then on its box is an ordinary flat yaw-only box and nothing steps it. */
export interface DoorSlab { p: Vec3; v: Vec3; a: number; spin: number; tip: number; tipV: number; side: 1 | -1; rest: boolean; landed: boolean; who: number; t: number; /** the angle the door READS as while off (±π/2: wide open, the way the leaf left) */ ang: number; /** doorblast.ts DOORSHOT: gunfire took the leaf apart and this is its lock rail, lying — half width, half length, and where on it the handles are (absent: the whole leaf) */ bits?: [number, number, number, number]; }

export class Door {
  angle: number; vel = 0; quietT = 10; latched: boolean; lastWho = -1; sinceBash = 10; closing = false;
  /** lock state (see DoorDef.locked): `locked` clears when picked or kicked; `lockBroken` = kicked in (behaves as unlocked for the rest of the encounter, and a calm
   *  guard passing close will notice it once: `noticed`); `pick` = how far the cylinder has been worked 0‥1 (kept a couple of seconds after letting go, then it
   *  drifts back: Doors.update); `rattleT` > 0 just after the handle was tried (marker flash + a hair of leaf shake). All restored by reset(). */
  locked: boolean; lockBroken = false; noticed = false; noticedT = -1000; pick = 0; picking = false; pickIdle = 0; pickClock = 0; pickN = 0; rattleT = 0;   // (noticedT: game time of that notice — evidence ages: guards.ts planClears)
  /** game time a guard last pulled this leaf to / threw its bolt in a lockdown (guards.ts lockdownDoors: one man deals with a door, not all three every pass) */
  guardT = -100;
  /** the keyed men (a bit per contact id, ids < 32) this leaf is passing through right now — each pulled it shut past himself, or walked into it while somebody pulled
   *  it to (Doors.update): until they are apart again the leaf neither feels him nor moves him, and it will not latch inside him. 0 = nobody. */
  passers = 0;
  readonly keySide: 1 | -1;
  /** the key that turns this lock (DoorDef.lock, FLOOR_KEY by default) — what a keyless contact's `keys` and the player's own ring are asked for */
  readonly lockId: string;
  readonly height: number; readonly thick: number;
  /** the swing limits as authored (DoorDef.minAngle / maxAngle): what the leaf's stops are with DOORWAY.oneWay off */
  readonly minAuth: number; readonly maxAuth: number;
  /** THE SIDE IT OPENS INTO (DOORWAY): the sign of every angle it can stand at. +1 = the CCW side of the closed leaf (Doors.side's +1): a point p with
   *  Doors.side(d, p) === d.swing is on its PULL face. Dealt once per level (game/doorswing.ts dealSwings → setSwing), the def's own `swing` first:
   *  `dealt` = the side the room rules give it, `outward` = the open-air side of an outside door (0 = it is not one) — taken while DOORWAY.exitsOut. */
  get swing(): 1 | -1 { return this.outward && DOORWAY.exitsOut ? this.outward : this.dealt; }
  dealt: 1 | -1; outward: 1 | -1 | 0 = 0;
  /** its stops: the authored limits — and, one-way, 0 on the side it does not open into (the frame) */
  get minA(): number { return DOORWAY.oneWay && this.swing > 0 ? 0 : this.minAuth; }
  get maxA(): number { return DOORWAY.oneWay && this.swing < 0 ? 0 : this.maxAuth; }
  /** > 0: being pulled open — the swing toward the men on that side passes the living (Doors.update); the Door.vel the last update / place() left, so a
   *  velocity somebody ELSE has written since (a drill's shove, a kick) is known for one (Doors.update turns a wrong-way opening shove round) */
  pullT = 0; private velSeen = 0; get seenVel(): number { return this.velSeen; }
  /** pressT: how long a living man has pressed on it from the side it opens into, it standing in his way (Doors.update: PRESS_SECS of that and he pulls it);
   *  openT: seconds since somebody last DROVE it open — a push from its other face, a shove, a boot, an easing hand (a leaf being swung into a man is not his to
   *  pull); seenAngle: the angle the last update / place() left (crack() turns it between updates); mirrored: how many times keep() has had to turn an angle
   *  written on the far side round (QA: an opener never causes one) */
  /** DOORSTAY: the swing this leaf is on toward its frame is a keyed man's body's doing and nobody's order — at its frame it rests to, unlatched (update).
   *  Dropped by whatever moves it next that is not such a body: a hand, a boot, a blast, a script, the player's own push */
  swept = false;
  /** DOORTHROW: who last drove it open and how (null: nobody since the reset, or the rule is off) */
  drive: DoorDrive | null = null;
  /** …and has come to rest in its frame that way: to, not latched. To a hand or a body that opens it next it is a shut door all the same — it gives with the creak a latched one gives */
  get restsTo(): boolean { return this.swept && !this.latched && this.angle === 0 && this.vel === 0; }
  pressT = 0; openT = 10; mirrored = 0; private angleSeen = 0; get seenAngle(): number { return this.angleSeen; }
  readonly box: Box; readonly handleBoxes: Box[];
  /** OFF ITS HINGES (doorblast.ts): the leaf is no longer a door — `box` is the loose slab `slab` describes (flying, then flat on the floor: 5 cm of wood no line
   *  of sight, sound, shot or smoke bake meets), update() leaves it alone, no verb moves it, and to everything that reads a door's state it is one standing wide
   *  open with its lock gone (`angle` ±OFF_ANGLE, unlatched, lockBroken): an open doorway. reset() hangs it again. */
  off = false; slab: DoorSlab | null = null;
  /** doorblast.ts DOORSHOT: the rounds' work this leaf has taken, in the wall engine's unit — one count for the whole leaf. reset() clears it. */
  shot = 0;
  /** the hung leaf's half extents and markings (the slab at rest lies under other ones — doorblast.ts; reset() and the fog's remembered leaf put these back) */
  readonly leafH: Vec3; readonly leafMarks: Box['marks'];
  creakArmed = true;
  constructor(readonly def: DoorDef) {
    this.height = def.height ?? LEAF_H; this.thick = def.thickness ?? 0.05;
    this.minAuth = def.minAngle ?? -1.92; this.maxAuth = def.maxAngle ?? 1.92;
    this.dealt = def.swing ?? (Math.sign(def.angle ?? 0) || (this.maxAuth >= -this.minAuth ? 1 : -1)) as 1 | -1;   // (until dealSwings: the way it is authored standing open, else its wider side)
    this.locked = !!def.locked; this.keySide = def.keySide ?? 1; this.lockId = def.lock ?? FLOOR_KEY;
    this.angle = clamp(this.sided(def.angle ?? 0), this.minA, this.maxA); this.latched = Math.abs(this.angle) < 1e-3;
    const leafH: Vec3 = [def.width / 2 - 0.01, this.height / 2, this.thick / 2];
    this.leafH = leafH;
    this.box = makeBox({ c: [0, 0, 0], h: leafH, albedo: def.albedo ?? [0.42, 0.3, 0.19], flags: BoxFlag.Dynamic, name: 'door_' + def.name, ...(def.steel ? { rough: 0.3, metal: true } : { rough: 0.55, marks: doorLeafMarks(leafH) }) });   // finish for the reflection pass (Box.rough): a painted steel fire door has a satin sheen, the veneered leaves only just (ultra); MARKINGS: kick plates both faces + a push plate by the latch (the markings lane — a steel door is its own plate)
    // push plate + lever handle (raster only)
    this.handleBoxes = [0, 1].map(() => makeBox({ c: [0, 0, 0], h: [0.06, 0.012, 0.012], albedo: [0.55, 0.55, 0.52], flags: BoxFlag.Dynamic | BoxFlag.NoShadow, rough: 0.25, metal: true }));
    this.leafMarks = this.box.marks;
    this.frameCentre = [def.hinge[0] + Math.cos(def.closedDir) * def.width * 0.5, 1.0, def.hinge[1] + Math.sin(def.closedDir) * def.width * 0.5];
    this.place();
  }
  /** Leaf centre (1 m up) at the current angle. Read in per-frame loops (interactables, body contacts, every emitted DoorEvent), so it is only recomputed
   *  when the angle has moved — as a fresh array each time, so a caller holding an earlier result keeps the snapshot it always got. */
  get pos(): Vec3 {
    if (this.off) return [this.frameCentre[0], this.frameCentre[1], this.frameCentre[2]];   // (off its hinges: 'the door' is its doorway — the slab on the floor is nobody's to use, and the fog looks for the frame)
    if (this.angle !== this.posAngle) { this.posAngle = this.angle; const u = this.dir(); this.posAt = [this.def.hinge[0] + u[0] * this.def.width * 0.5, 1.0, this.def.hinge[1] + u[1] * this.def.width * 0.5]; }
    return this.posAt;
  }
  private posAngle = NaN; private posAt: Vec3 = [0, 1, 0];
  /** Static doorway centre (where the closed leaf's middle sits). */
  readonly frameCentre: Vec3;
  /** 'Closed enough' that using it means opening it (shared by use() and the HUD prompt). */
  isClosed() { return Math.abs(this.angle) < 0.25; }
  dir(): [number, number] { const a = this.def.closedDir + this.angle; return [Math.cos(a), Math.sin(a)]; }
  /** Back to the level as authored: angle, latch, lock, and everything the encounter did to it (pick progress, a kicked lock, a guard having noticed it). */
  reset() {
    this.shot = 0;
    if (this.off) { this.off = false; this.slab = null; this.box.h = this.leafH; this.box.marks = this.leafMarks; this.box.rot = undefined; for (const hb of this.handleBoxes) hb.rot = undefined; }   // hung again, as authored
    this.angle = clamp(this.sided(this.def.angle ?? 0), this.minA, this.maxA);   // (one-way: a leaf authored standing open the way it is not dealt stands as wide the way it is — as setSwing left it)
    this.vel = 0; this.latched = Math.abs(this.angle) < 1e-3; this.closing = false; this.swept = false; this.quietT = 10; this.sinceBash = 10; this.creakArmed = true; this.lastWho = -1;   // (lastWho too: the fresh encounter's first bang / latch is nobody's yet — it used to keep the last man of the encounter before, review B7.12)
    this.locked = !!this.def.locked; this.lockBroken = false; this.noticed = false; this.noticedT = -1000; this.pick = 0; this.picking = false; this.pickIdle = 0; this.pickClock = 0; this.rattleT = 0; this.guardT = -100; this.passers = 0;
    this.pullT = 0; this.pressT = 0; this.openT = 10; this.drive = null;
    this.place();
  }
  /** Deal the side it opens into (game/doorswing.ts, once per level): a leaf authored standing open the other way is stood as far open this way. */
  setSwing(s: 1 | -1, outward: 1 | -1 | 0 = 0) { this.dealt = s; this.outward = outward; if (DOORWAY.oneWay) { this.keep(); this.latched = Math.abs(this.angle) < 1e-3; this.place(); } }
  /** One-way: an angle on the side it does not open into (written by a script, a staging, an old save) is the same opening on the side it does — and whatever
   *  velocity came with it turns with it. */
  keep() { if (this.angle * this.swing < 0) { this.angle = clamp(-this.angle, this.minA, this.maxA); this.vel = -this.vel; this.mirrored++; } }
  /** an angle (or a turn rate) as this door can have it: one-way, the same opening on the side it opens into (savestate.ts: a file from before it had one) */
  sided(a: number): number { return DOORWAY.oneWay && a * this.swing < 0 ? -a : a; }
  place() {
    if (this.off) return;   // (the slab's box is doorblast.ts's to pose)
    if (DOORWAY.oneWay) this.keep();
    this.velSeen = this.vel; this.angleSeen = this.angle;
    const jig = this.rattleT > 0.35 ? Math.sin(this.rattleT * 90) * 0.005 : 0;   // the handle being tried: the leaf works a hair in its frame (drawn only — dir(), which the contacts read, stays put)
    const P = this.poseAt(this.angle + jig);
    this.box.c = P.c; this.box.yaw = P.yaw;
    this.box.flags = Math.abs(this.angle) < 0.3 ? this.box.flags | BoxFlag.SoundSeal : this.box.flags & ~BoxFlag.SoundSeal;   // an open leaf standing in the room does not seal the doorway acoustically
    for (let s = 0; s < 2; s++) { const hb = this.handleBoxes[s]; hb.c = P.handles[s]; hb.yaw = P.yaw; }
  }
  /** Where the leaf's box and its two handles stand with the leaf at `angle`: place() writes these for the angle it has, and the fog of war (fogofwar.ts) poses
   *  the leaf the team last SAW with it. */
  poseAt(angle: number): { c: Vec3; yaw: number; handles: [Vec3, Vec3] } {
    const w = this.def.width; const [hx, hz] = this.def.hinge;
    const a = this.def.closedDir + angle; const u: [number, number] = [Math.cos(a), Math.sin(a)];
    const yaw = -a;                                             // box local +X maps to world (cos yaw, -sin yaw)
    const n: [number, number] = [-u[1], u[0]]; const off = this.thick / 2 + 0.03;
    const handle = (side: number): Vec3 => [hx + u[0] * (w - 0.14) + n[0] * off * side, 1.0, hz + u[1] * (w - 0.14) + n[1] * off * side];
    return { c: [hx + u[0] * (w * 0.5 + 0.01), this.height / 2 + 0.01, hz + u[1] * (w * 0.5 + 0.01)], yaw, handles: [handle(1), handle(-1)] };
  }
}

/** m/s at which a leaf may correct a living contact — at its stop, at its hinge post, held against him by somebody on the far face: 12 cm a frame at 60 Hz, more
 *  than anyone walks or runs into it, so ordinary contact is exact, but a leaf swept INTO a man (driven to its stop by a shove near the hinge, kicked through him,
 *  walked open onto him) presses him out over a few frames instead of teleporting him a foot — the 'popped' guard of the QA soak, and the player flung 40 cm a
 *  frame at 20 fps. Bodies (weak contacts) are shoved outright; a leaf LOCKED against the player is exact (see shove). */
const SHOVE_RATE = 7.2;
/** rad/s a push may turn a leaf (a quarter radian a frame at 60 Hz — faster than any kick; the rest of a deep push waits a frame) */
const TURN_RATE = 15;
/** rad a KICKED leaf may turn in one go before the living contacts are asked (Doors.update): 9 rad/s is 0.45 rad in a 20 fps frame — the tip further than a man
 *  is thick — and integrated in one step the leaf's line came out beyond the centre of anybody standing just past it, whereupon the contact pass, reading him on
 *  its other face, helped it on through him (review B7.1). A frame's turn longer than this is walked in steps no longer, stopping short of the first that would
 *  press a standing man, so the leaf comes to rest against him at 20 fps as it does at 60; a turn within it (every kick at 55 fps and up: 9 rad/s ÷ 60 = 0.15) is
 *  the single step it always was — the contact pass has always caught that much (a body is 0.68 across), and every seeded QA night stays the night it was. */
const KICK_SUBSTEP = 0.16;
/** the correction a leaf applies to a living contact this frame: capped (SHOVE_RATE), except `exact` — the locked leaf the player himself is pressing on, which
 *  must stay a wall to him however hard a guard walking into his back presses him onto it (there the penetration is his own stride, never a sweep) */
const shove = (pen: number, dt: number, exact = false) => exact ? pen + 0.001 : Math.min(pen + 0.001, SHOVE_RATE * dt);

/** Doors.swingOf: a door's jambs, the side it opens into and the floor its leaf sweeps. */
export interface DoorSwing {
  /** the hinge jamb and the handle (latch) jamb, on the floor: the two ends of the closed leaf */
  hinge: Vec3; handle: Vec3;
  /** the sign of the angles it opens through (Door.swing): Doors.side(d, p) === swing ⇔ p is on the PULL face */
  swing: 1 | -1;
  /** unit normal (x, z) of the closed leaf, pointing into the side it opens into */
  into: [number, number];
  /** rad from shut to its open stop · the leaf's length · the world angle of the closed leaf (DoorDef.closedDir): it sweeps the sector about `hinge`, radius
   *  `radius`, from `closedDir` round by swing × open */
  open: number; radius: number; closedDir: number;
  /** is the one-way rule on (DOORWAY.oneWay)? Off, the leaf is double-acting as it was and this sweep is only the side the level deals */
  oneWay: boolean;
  /** is the floor point inside the area the leaf sweeps, with `pad` m of slack (a body's radius) */
  sweeps(x: number, z: number, pad?: number): boolean;
}

export class Doors {
  list: Door[];
  constructor(defs: DoorDef[], private emit: (e: DoorEvent) => void) { this.list = defs.map(d => new Door(d)); this.list.forEach((d, i) => { d.box.mkey = MKEY.door + i * 4; d.handleBoxes[0].mkey = MKEY.door + i * 4 + 1; d.handleBoxes[1].mkey = MKEY.door + i * 4 + 2; }); }   // motion identity for the leaf and its handles (scene/boxes.ts MKEY)

  byName(n: string) { return this.list.find(d => d.def.name === n); }

  /** Is `from` on d's PULL face — the side it opens into, where the leaf comes toward you (the other face pushes it away)? Read whatever DOORWAY.oneWay says:
   *  with it off this is only the side the level deals. */
  pullFace(d: Door, from: Vec3): boolean { const c = d.def.closedDir; return ((from[0] - d.def.hinge[0]) * -Math.sin(c) + (from[2] - d.def.hinge[1]) * Math.cos(c)) * d.swing >= 0; }
  /** DOORWAY.frameHolds as it applies right now: one-way leaves, the switch on, no showcase on the stage */
  get frameRule(): boolean { return DOORWAY.oneWay && DOORWAY.frameHolds && !this.staged(); }
  /** WOULD THE FRAME HOLD A BOOT thrown at d from `from` (DOORWAY.frameHolds): the leaf is home in its frame and `from` is on the face it opens toward, where it
   *  rests on the stop all the way round. What kickIn refuses, and what whoever plans a boot (the door tools, Sam's rows, a sprint into it) asks first. */
  bootHolds(d: Door, from: Vec3): boolean { return this.frameRule && !d.off && !d.def.steel && Math.abs(d.angle) < SHUT_HOME && this.pullFace(d, from); }   // (steel has its own answer from either face: kickIn's clang)
  /** THE HOLD TEST for a wedge or dragged furniture put against `d` by a man standing at `from` (digin.ts): it holds only a leaf that opens TOWARD him — the
   *  thing sits in the leaf's path. A door that opens away from him is pulled open from the far side whatever stands behind it. Off (or two-way doors, or a
   *  staged scene) = any door holds, as it was. Read live, never kept: a door's side can be re-dealt under a running game */
  wedgeHolds(d: Door, from: Vec3): boolean { return !this.frameRule || this.pullFace(d, from); }
  /** THE DOOR AS A HINGED THING, for whoever plans round it (the AI's opener going to the handle, the men keeping out of its swing): where its two jambs are,
   *  which side it opens into and the floor its leaf sweeps getting there. Constant per door (nothing here reads the angle it stands at). */
  swingOf(d: Door): DoorSwing {
    const [hx, hz] = d.def.hinge, W = d.def.width, c = d.def.closedDir, S = d.swing; const ux = Math.cos(c), uz = Math.sin(c);
    const open = Math.abs(S > 0 ? d.maxAuth : d.minAuth);
    const seg = (x: number, z: number, a: number) => { const vx = Math.cos(a), vz = Math.sin(a), t = clamp((x - hx) * vx + (z - hz) * vz, 0, W); return Math.hypot(x - hx - vx * t, z - hz - vz * t); };
    return { hinge: [hx, 0, hz], handle: [hx + ux * W, 0, hz + uz * W], swing: S, into: [-uz * S, ux * S], open, radius: W, closedDir: c, oneWay: DOORWAY.oneWay,
      sweeps: (x, z, pad = 0) => {
        const px = x - hx, pz = z - hz, r = Math.hypot(px, pz); if (r > W + pad) return false;
        let th = (Math.atan2(pz, px) - c) * S; th -= Math.round(th / (2 * Math.PI)) * 2 * Math.PI; if (th < 0 && open > Math.PI && th + 2 * Math.PI <= open) th += 2 * Math.PI;   // the point's bearing from the closed leaf, the way it opens
        return (th >= 0 && th <= open) || seg(x, z, c) <= pad || seg(x, z, c + S * open) <= pad;
      } };
  }
  /** a showcase / the tour / the attract reel has the stage (the Game hands this its `touring`): its choreography runs with the closers it was written for */
  staged: () => boolean = () => false;
  /** DOORSTAY as it applies right now: leaves stay where they are left */
  get stay(): boolean { return DOORSTAY.on && !this.staged(); }
  /** (DoorContact.round) how many times a leaf's back has been gone round — one for each unbroken press of it (checks read it) */
  rounds = 0;
  /** does this leaf's hydraulic closer work (what waits on a door swinging to by itself asks this, never def.closer) */
  hasCloser(d: Door): boolean { return !this.stay && d.def.closer !== false; }

  /** Which face of d the point is on: +1 = the CCW side of the leaf (perp > 0 in update()'s convention), −1 the other. */
  side(d: Door, from: Vec3): 1 | -1 { const u = d.dir(); const px = from[0] - d.def.hinge[0], pz = from[2] - d.def.hinge[1]; return u[0] * pz - u[1] * px >= 0 ? 1 : -1; }
  /** The lock is against you: latched, still locked, you are on the keyed side (see DoorDef.locked) — and nothing on your ring fits it (`keys`: Player.keys;
   *  absent = no keys at all). What use / crack / a keyless push run into. */
  lockedOut(d: Door, from: Vec3, keys?: ReadonlySet<string>): boolean { return d.locked && d.latched && this.side(d, from) === d.keySide && !(keys && keys.has(d.lockId)); }
  /** The lock is against you BUT for the key you carry: thrown, latched, its cylinder facing you, and one of `keys` fits — the case the marker words as 'unlock'
   *  and use() puts the key's clack in front of the creak. */
  keyOpens(d: Door, from: Vec3, keys?: ReadonlySet<string>): boolean { return !!keys && keys.has(d.lockId) && this.lockedOut(d, from); }

  /** DOORTHROW: is there floor for a body of radius r at (x, z)? Set by the Game (this file knows no walls); null = anywhere */
  standable: ((x: number, z: number, r: number) => boolean) | null = null;
  /** DOORTHROW: what the Game knows of the man with this id (MAN_SIDE | MAN_FOLDED | MAN_BRACED | MAN_CALM); null = nothing of anybody */
  man: ((who: number) => number) | null = null;
  /** DOORTHROW as it applies right now: the switch on, no showcase on the stage */
  get throws(): boolean { return DOORTHROW.on && !this.staged(); }
  /** would a turn of sign `dir` take d further OPEN (one-way: the way it opens; else away from its frame) */
  private opening(d: Door, dir: number): boolean { return DOORWAY.oneWay ? dir === d.swing : Math.abs(d.angle) < 0.05 || dir * d.angle > 0; }
  /** DOORTHROW: somebody drove d open (Door.drive) */
  private driven(d: Door, who: number, dir: number, kind: DoorDrive['kind'], quiet: boolean, rate: number) {
    const D = d.drive, s = dir >= 0 ? 1 : -1, m = this.man ? this.man(who) : 0;
    if (kind !== 'boot' && m & MAN_CALM) quiet = true;
    if (D && D.who === who && D.dir === s && D.kind === kind) { D.t = 0; D.quiet = quiet; D.rate = rate; D.side = m & MAN_SIDE; if (kind !== 'body' && kind !== 'hand') D.from = d.angle; }   // (a walk or a hand goes on: one drive, from where it began)
    else d.drive = { who, dir: s, kind, t: 0, from: d.angle, quiet, side: m & MAN_SIDE, rate, px: NaN, pz: NaN };
  }
  /** DOORTHROW: a body pressing d open — the drive, at the rate his own stride since the last update would turn it (0 on the first frame of it) */
  private walked(d: Door, c: DoorContact, dir: number, lever: number, dt: number) {
    const D = d.drive, on = D && D.who === c.who && D.kind === 'body' && D.dir === (dir >= 0 ? 1 : -1) && D.t <= 2 * dt + 1e-6 && D.px === D.px;
    this.driven(d, c.who, dir, 'body', c.quiet, on ? Math.min(Math.hypot(c.pos[0] - D!.px, c.pos[2] - D!.pz) / Math.max(dt, 1e-3) / lever, TURN_RATE) : 0);
  }
  /** DOORTHROW: the leaf wins against this man — he is put clear of it (`pen` m along qx, qz) and a little along it toward its free end, if there is floor for
   *  him there and it is no more than a frame's carry. False: he stays, and the leaf rests on him as ever. */
  private carry(c: DoorContact, d: Door, pen: number, dist: number, qx: number, qz: number, perp: number, dt: number): boolean {
    const T = DOORTHROW; if (pen > T.rate * dt) return false;
    const u = d.dir(); let nx = qx, nz = qz, n = dist;
    if (n < 1e-4) { const s = perp >= 0 ? 1 : -1; nx = -u[1] * s; nz = u[0] * s; n = 1; }   // (his centre on the leaf's own line: out of the face he is on)
    const k = (pen + 0.001) / n, sl = T.slide * dt, x = c.pos[0] + nx * k, z = c.pos[2] + nz * k;
    const ok = (px: number, pz: number) => !this.standable || this.standable(px, pz, c.radius);
    if (ok(x + u[0] * sl, z + u[1] * sl)) { c.pos[0] = x + u[0] * sl; c.pos[2] = z + u[1] * sl; }
    else if (ok(x, z)) { c.pos[0] = x; c.pos[2] = z; }
    else return false;
    c.moved = true; return true;
  }

  /** Resolve contacts (mutates contact positions when a door can't yield), integrate swing, closer, latch. */
  update(dt: number, contacts: DoorContact[]) {
    for (const c of contacts) { c.blockedBy = null; if (c.run) { c.bashed = null; c.ripped = null; } if (c.struck) c.struck = null; if (c.moved) c.moved = false; if (c.man !== undefined) c.man = undefined; }
    const T = DOORTHROW, thr = this.throws;
    for (const d of this.list) {
      if (d.off) { d.vel = 0; d.latched = false; d.closing = false; if (d.slab) d.angle = d.slab.ang; continue; }   // off its hinges: no leaf in the frame to swing, latch, close or be walked into — and whatever wrote a swing onto it this frame (a drill's shove, a script) wrote onto nothing
      const [hx, hz] = d.def.hinge; const W = d.def.width; const ht = d.thick / 2;
      const ow = DOORWAY.oneWay, S = d.swing;
      if (d.swept && (d.vel !== d.seenVel || d.angle !== d.seenAngle)) d.swept = false;   // (something has moved it since the last update — a hand, a boot, a blast, a script: no longer a body's sweep)
      let eased = false;   // (one-way) a hand has turned it wider since the last update (crack): to a limp thing in its swing that is a push like any other
      if (ow) {
        d.keep();
        // an OPENING shove somebody wrote since the last update (a drill's `d.vel = fling`, a boot, use() from the face it opens into) that would take it through
        // its frame: the same shove the way it does open — toward him, so its swing passes the living on that side (pullT). A leaf being pulled TO (`closing`)
        // is going the right way already, and so is a shove toward shut on a leaf standing open: the frame stops both (below).
        // A shove the way it opens by the man whose hand is on it (lastWho) from the face it opens into is that same pull; from anyone else it is a leaf DRIVEN open.
        if (d.vel !== d.seenVel && !d.closing && !d.latched) {
          if (d.vel * S < 0) { if (d.angle * S < SHOVE_OPENS_BELOW) { d.vel = -d.vel; d.pullT = PULL_SECS; } }
          else if (d.vel * S > 0) { const by = contacts.find(c => !c.weak && c.who === d.lastWho); if (by && this.pullFace(d, by.pos) && Math.hypot(by.pos[0] - hx, by.pos[2] - hz) < W + 1.2) d.pullT = PULL_SECS; else d.openT = 0; }   // (within reach of it: lastWho can be a hand that touched it long ago)
        }
        if ((d.angle - d.seenAngle) * S > 1e-4) { d.openT = 0; eased = true; }   // eased wider since (crack)
      }
      if (thr) {   // (DOORTHROW) what has been written onto it since the last update: a swing, or a hand's turn (no faster than a body can turn one: a staging's write is nobody's hand) — a boot says so itself (kickIn), a pull passes the living as ever and drives nobody
        const da = d.angle - d.seenAngle, pulled = ow && d.pullT > 0, rate = Math.abs(da) / Math.max(dt, 1e-3);
        if (pulled && d.drive) d.drive = null;   // (a pull is nobody's drive: the leaf it leaves swinging is not the last man's who pushed it)
        if (d.vel !== d.seenVel && d.vel !== 0 && !d.closing && !d.latched && !pulled && this.opening(d, Math.sign(d.vel))) { if (!(d.drive && d.drive.t === 0 && d.drive.kind === 'boot')) this.driven(d, d.lastWho, d.vel, 'swing', false, 0); }
        else if (da !== 0 && rate >= (d.drive?.kind === 'hand' && d.drive.t < DRIVEN_SECS ? 0.5 : 1) * T.handRate && rate <= TURN_RATE && !d.closing && !d.latched && !pulled && this.opening(d, Math.sign(da))) this.driven(d, d.lastWho, da, 'hand', false, rate);
      } else if (d.drive) d.drive = null;
      const kicked = d.sinceBash < 0.6;
      if (kicked && !d.latched) {   // a kicked leaf flies ahead of the runner instead of staying glued to them — a long frame's turn walked in steps of ≤ KICK_SUBSTEP, stopping short of the first that would press a standing man (see the constant): it comes to rest against him instead of out of his far side at 20 fps
        const total = clamp(d.angle + d.vel * dt, d.minA, d.maxA) - d.angle; const n = Math.ceil(Math.abs(total) / KICK_SUBSTEP);
        if (n <= 1) d.angle = clamp(d.angle + d.vel * dt, d.minA, d.maxA);
        else for (let s = 0; s < n; s++) { const a0 = d.angle; d.angle = a0 + total / n; if (this.leafPresses(d, contacts)) { if (!thr) d.angle = a0; break; } }   // (DOORTHROW: it stands AT the first step that presses him — a step is less than a man is thick — and the contact pass below throws him)
      }
      let touched = false, yank = false, pushed = false, bodyBlock = false;   // bodyBlock: a corpse rests against the leaf · pushed: a living contact moved the leaf this frame — resolved first (pass 0), so the weak ones (pass 1) know
      let pushDir = 0, keyTouched = false;   // pushDir: the way a keyed man has already turned the leaf this frame — the player pressing it the other way from the far face meets a held leaf (he is moved, it does not turn back: else the two clamp it between them and he is fed through it a few centimetres a frame); keyTouched: a guard's hands are on it (he takes the blame for what it does, not the player brushing the other face)
      let here = 0;      // the passers (Door.passers) still overlapping the leaf this frame
      let pressed = false;   // (one-way) a living man is pressing on it from the side it opens into, and it is his to pull (Door.pressT)
      let ran = false;       // (sprintdoor.ts) a runner's shoulder flung it open this frame
      let walker: DoorContact | null = null;   // (DOORTHROW) the body that pressed it open this frame: where he ends the update is where his next stride is measured from
      for (let pass = 0; pass < 3; pass++) for (const c of contacts) {   // keyed men first (they hold leaves against the player, above), then the player, then the limp things
        if ((c.weak ? 2 : c.key ? 0 : 1) !== pass) continue;
        // quick reject: outside the swing circle
        const vx = c.pos[0] - hx, vz = c.pos[2] - hz; if (vx * vx + vz * vz > (W + c.radius + 0.1) ** 2) continue;
        if (c.weak && c.pos[1] - c.radius > d.height) continue;   // (a body flung over a leaf — not in this office, but cheap)
        for (let it = 0; it < 3; it++) {
          const u = d.dir(); const px = c.pos[0] - hx, pz = c.pos[2] - hz;
          const along = px * u[0] + pz * u[1]; const perp = u[0] * pz - u[1] * px;   // >0: contact on the CCW side of the leaf
          const t = clamp(along, 0, W); const qx = px - u[0] * t, qz = pz - u[1] * t; const dist = Math.hypot(qx, qz);
          const pen = c.radius + ht - dist; if (pen <= (c.weak ? 0.002 : 0)) break;   // (weak: a settled body resting exactly at the leaf must not be re-shoved a hair every frame — that would keep its ragdoll awake)
          const bit = !c.weak ? this.passBit(c) : 0;
          const man = thr && !c.weak ? (c.man ??= this.man ? this.man(c.who) : 0) : 0, folded = (man & MAN_FOLDED) !== 0;
          if (bit & d.passers) { here |= bit; break; }   // he is stepping through this leaf (see `pulling` below): whichever side of it his centre has got to, it neither feels him nor moves him until they are clear of each other
          if (ow && d.pullT > 0 && !d.latched && !c.weak) { if (bit) { d.passers |= bit; here |= bit; } break; }   // (one-way) a leaf being pulled open: it comes round past the living on the side it opens into — the man pulling it and whoever stands with him — and is not felt until they are clear of it
          if (c.weak && (d.latched || pushed || kicked || eased || (ow && d.pullT > 0))) { const k = pen / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; break; }   // the leaf wins: shove the body (eased: a body lying in its swing used to stop a hand easing it from the push face while a man walking into it, a boot, or the same hand from the pull face moved it — one rule for all of them now)
          // (DOORTHROW) a leaf somebody else DROVE OPEN at him: it wins — before he counts as a hand on it (he is neither blamed for it nor does he stop its swing).
          // Thrown (struck, for doorthrow.ts) if he was standing; carried if he is folded already.
          if (thr && !c.weak && d.drive && d.drive.who !== c.who && !d.closing && along > 0.14 && along < W + c.radius) {
            const D = d.drive, into = perp >= 0 ? 1 : -1, vin = into * d.vel * t, hard = D.kind === 'boot', held = D.kind === 'body' || D.kind === 'hand', fresh = held && D.t < DRIVEN_SECS;   // (held: a body's or a hand's — judged by the man's own rate, never by the speed the leaf has: two men on one leaf see-saw that up to anything)
            if (D.dir !== into) { /* driven the other way: nothing of his */ }
            else if (folded) { if ((vin >= 0.2 || fresh) && this.carry(c, d, pen, dist, qx, qz, perp, dt)) break; }
            else if (!(man & MAN_BRACED) && !D.quiet && (held ? fresh && D.rate * t >= T.minSpeed : vin >= T.minSpeed) && (hard || !D.side || D.side !== (man & MAN_SIDE))) {   // (his own side's leaf: only a boot's)
              const n = dist > 1e-4 ? 1 / dist : 0;
              c.struck = { door: d, by: D.who, hard, floor: hard && Math.abs(d.angle - D.from) < T.floorRad, dir: n ? [qx * n, qz * n] : [-u[1] * into, u[0] * into] };
              if (this.carry(c, d, pen, dist, qx, qz, perp, dt)) break;   // (no floor to be moved onto: struck where he stands, and the leaf rests on him — below, as ever)
            }
          }
          if (c.weak) bodyBlock = true; else { touched = true; if (c.key || !keyTouched) d.lastWho = c.who; if (c.key) keyTouched = true; }   // a corpse against the leaf blocks the closer but is nobody: it neither re-arms the closer's quiet timer (that made the leaf twitch into the body every 2 s and kept its ragdoll awake) nor takes the blame; between a guard and the player on one leaf, the guard's doing
          if (!c.weak && !opens(c, d) && d.locked && d.latched && (perp >= 0 ? 1 : -1) === d.keySide && along > 0.14 && along < W + c.radius) {
            // locked against a body with no key to it: the leaf is a wall. Push them back out, tell the caller which door stopped them (a sprinting player turns that into
            // a kick, game.ts), and let the bolt clack in its keep once per shove — a small noise, but a noise (re-armed with the creak after a moment untouched)
            const k = shove(pen, dt, true) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; c.blockedBy = d;
            if (d.creakArmed && pen > 0.015) { d.creakArmed = false; this.rattle(d, c.who, c.quiet ? 0.08 : 0.12); }
            break;
          }
          // a keyed man and a leaf being pulled shut fast (yank, below — his own pull, usually; a colleague tidying it, sometimes) whose contact would only open it
          // wider: he becomes its `passer` — from here until they are apart the leaf ignores him entirely (above), closing on its spring while he walks through
          // its edge. (Without this the leaf he pulls to swung into him, his own contact pushed it back to its stop, and the two see-sawed a hand apart with him
          // going nowhere — the wedge the QA soak kept finding by the break-room door; and a half-way version, let in but felt again once his centre crossed
          // the leaf line, whipped the leaf through the frame into the far stop with a bang.)
          const limp = folded;   // (DOORTHROW) a folded man takes no handle: he neither pulls a leaf round, nor pulls one to, nor steps through its edge — it rests on him or is put clear of him
          const pulling = c.key && !limp && !c.bash && d.closing && Math.abs(d.angle) > 0.35;
          if (along > 0.14 && along < W + c.radius) {
            // leaf yields: rotate away from the contact about the hinge
            const sgn = perp >= 0 ? -1 : 1; const lever = Math.max(0.18, t);
            // (one-way) pressed toward SHUT by a living man while it stands less than open: he is on the side it opens into and it is in his way — shut in his
            // face, ajar, half open across the doorway he is walking at. He does what anyone does: takes it and brings it round past himself (PULL_VEL, its
            // creak if he unlatched it; quiet hands slower). Never
            // a leaf locked against him (above), never one somebody is swinging into him (DRIVEN_*: that one stops against him, as ever). A leaf standing wider
            // than that is clear of the doorway: pushed from behind it simply turns toward shut. Run into (bash), it is hauled open at once and as loud as a
            // shoulder through it from the other face; walked into, after PRESS_SECS of it not giving.
            const presses = ow && !c.weak && !limp && sgn * S < 0 && d.angle * S < Math.min(1.35, 0.8 * Math.abs(S > 0 ? d.maxA : d.minA)) && d.openT >= DRIVEN_SECS && d.vel * S <= DRIVEN_VEL;
            if (presses) {
              pressed = true; const hauled = c.bash && c.hand === undefined && d.sinceBash > 0.9;
              if (hauled || d.pressT >= (c.hand ?? PRESS_SECS)) {
                if (hauled) { d.latched = false; d.vel = S * (c.run?.rip ?? 7.5); d.sinceBash = 0; if (c.run) c.ripped = d; this.emit({ door: d, sound: 'bash', pos: d.pos, who: c.who, level: c.run?.ripLevel ?? 1.0 }); }   // (c.run — sprintdoor.ts: ripped round by its handle, slower and quieter than the haul, and he is checked for it: game.ts)
                else {
                  if (d.latched || d.restsTo) { d.latched = false; if (d.creakArmed) { this.emit({ door: d, sound: 'creak', pos: d.pos, who: c.who, level: c.quiet ? 0.12 : 0.3 }); d.creakArmed = false; } }
                  d.vel = S * Math.max(d.vel * S, c.quiet ? PULL_VEL_QUIET : PULL_VEL);
                }
                d.closing = false; d.swept = false; d.pullT = PULL_SECS;
                touched = true; pushed = true; if (c.key || !keyTouched) d.lastWho = c.who; if (c.key) keyTouched = true;
                if (bit) { d.passers |= bit; here |= bit; }
                break;
              }
            }
            // (DoorContact.round) the same man behind a leaf standing WIDER than that, in nobody's hand: it used to turn toward shut under him — across the doorway
            // the man ahead of him had just opened, who then pulled it again while the rest of the file pressed it back on him. He goes round it instead: the leaf
            // is a wall to him and he is moved along it toward its free end, where its edge passes him as it does any keyed man (below). The leaf counts the
            // press as any other (pressT — saved with it): ROUND_SECS of men against its back without a frame's let-up and there is no way round — it turns
            // under him as before, and below that angle it is his to pull at once. Never one somebody is pulling to (closing).
            if (c.round && ow && this.stay && !c.bash && !d.latched && !d.closing && sgn * S < 0 && d.angle * S >= Math.min(1.35, 0.8 * Math.abs(S > 0 ? d.maxA : d.minA)) && Math.abs(d.vel) < ROUND_STILL && d.openT >= DRIVEN_SECS) {
              if (!pressed && d.pressT === 0) this.rounds++;
              pressed = true;
              if (d.pressT < ROUND_SECS) { d.vel *= 0.5; const k = shove(pen, dt, true) / Math.max(dist, 1e-4), sl = ROUND_SLIDE * dt; c.pos[0] += qx * k + u[0] * sl; c.pos[2] += qz * k + u[1] * sl; break; }   // (vel: a body soaks up a coasting leaf, as below)
            }
            const maxTurn = TURN_RATE * dt; const raw = sgn * (pen / lever) * 1.05, capped = Math.abs(raw) > maxTurn;   // a body pressed on the leaf right by its hinge whipped the tip through half a radian in one frame — and flung whoever stood in that arc a foot: a quarter radian a frame is already faster than any kick, the rest of the push waits a frame
            const want = d.angle + (capped ? Math.sign(raw) * maxTurn : raw);
            if (pulling && Math.abs(want) > Math.abs(d.angle)) { if (bit) { d.passers |= bit; here |= bit; } yank = true; break; }   // (see above: he keeps pulling, it passes him)
            if (thr && !c.weak && !c.key && pushDir && sgn !== pushDir && !folded && this.opening(d, sgn)) { this.walked(d, c, sgn, lever, dt); walker = c; }   // (DOORTHROW: he is driving it all the same — the man holding it against him is thrown next frame)
            if (!c.weak && !c.key && pushDir && sgn !== pushDir) { const k = shove(pen, dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; break; }   // a guard on the far face is already pushing it his way this frame: to the player it is a held leaf — it moves him, it does not turn back (guards among themselves work it to and fro as ever); at SHOVE_RATE, so a leaf walked open onto him presses him aside over a few frames, and past a man it cannot move (his back to the wall) it swings on through
            const na = clamp(want, d.minA, d.maxA); const moved = na - d.angle;
            if (Math.abs(moved) > 1e-5) {
              const to = d.restsTo;
              if (thr && !c.weak && !folded && this.opening(d, Math.sign(moved)) && !(d.drive && d.drive.who !== c.who && d.drive.t === 0 && d.drive.kind !== 'body')) { this.walked(d, c, moved, lever, dt); walker = c; }   // (DOORTHROW: walked open — never over a swing somebody ELSE wrote onto it this frame)
              if (!c.weak) { pushed = true; if (c.key) pushDir = sgn; if (ow && moved * S > 0) d.openT = 0; d.swept = !!c.key && !c.bash && this.stay && Math.abs(na) < Math.abs(d.angle); }   // (swept: a keyed man's body turning it toward its frame at a walk, with doors that stay as they are left)
              if (d.latched || to) { d.latched = false; if (d.creakArmed && !c.bash) { this.emit({ door: d, sound: 'creak', pos: d.pos, who: c.who, level: c.quiet ? 0.12 : 0.3 }); d.creakArmed = false; } }
              if (c.bash && !(presses && c.hand !== undefined) && d.sinceBash > 0.9 && Math.abs(d.angle) < 1.2) { const open = c.run && (!ow || sgn * S > 0); d.vel = sgn * (open ? c.run!.bash : 7.5); d.sinceBash = 0; if (open) { c.bashed = d; c.bashedAt = d.angle; ran = true; } if (thr && this.opening(d, sgn)) this.driven(d, c.who, sgn, 'swing', false, 0); this.emit({ door: d, sound: 'bash', pos: d.pos, who: c.who, level: 1.0 }); }   // (sprintdoor.ts: a shoulder through it the way it opens — the leaf leads him, and it costs him some of his run, game.ts)
              else if (!kicked && !ran) d.vel = c.weak ? d.vel * 0.5 : d.vel * 0.5 + (moved / Math.max(dt, 1e-3)) * 0.5;   // a body soaks up a coasting leaf; it never sets one going (ran — sprintdoor.ts: the leaf a runner's shoulder has just flung keeps that speed through the rest of this frame's passes; without the rule the 7.5 is halved by the second pass, as it always was)
              d.angle = na;
            }
            if (Math.abs(want - na) > 1e-5 && (na === 0 || pen > c.radius - STOP_BODY)) { // at the stop: door is solid, push the character out — standing OPEN on its stop, as a wall would: by his body (STOP_BODY), not the hand of air a swinging leaf keeps off him
              const k = shove(na === 0 ? pen : pen - Math.max(0, c.radius - STOP_BODY), dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k;
              if (c.key && !limp && !c.bash && !presses && !(ow && na === 0)) { if (!this.stay) yank = true; else if (bit && !d.latched && Math.abs(d.angle) > 0.5) { d.passers |= bit; here |= bit; } }   // (one-way: on its frame there is no other way to take it — he pulls it, above, once it is his to; DOORSTAY: he steps through the edge of a leaf standing OPEN on its stop, and it stays there — never through one whose stop is its frame) …but a man with a key does what anyone would: takes the leaf with him the other way (it swings shut, out of the alley he is trying to use) — else
            }                                      // nav, which cannot see leaves, marches him into it for as long as anyone keeps making noise beyond it (the QA soak's commonest wedge)
            if (capped) break;   // (the capped remainder is next frame's business, not two more goes at it now)
          } else {
            // hinge region (or beyond the tip): behaves like a post — except that a keyed man snagged on the free EDGE of a leaf standing open takes it with him
            // toward shut (same yank as at the stop, below); at the hinge there is nothing to take, that is the frame — and one it is already passing (above) does not fling him
            if (pulling) { if (bit) { d.passers |= bit; here |= bit; } yank = true; break; }
            const k = shove(pen, dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k;
            if (c.key && !limp && !c.bash && along >= W && !d.latched && Math.abs(d.angle) > 0.5) { if (!this.stay) yank = true; else if (bit) { d.passers |= bit; here |= bit; } }
            break;
          }
        }
      }
      d.sinceBash += dt;
      d.passers &= here;   // whoever is clear of it (or never came) is felt again
      if (ow) { d.pressT = pressed ? d.pressT + dt : 0; d.openT += dt; }
      if (yank) { d.closing = true; if (Math.sign(d.angle) * d.vel > -3) d.vel = -Math.sign(d.angle) * 3; d.quietT = 0; }   // pinned at the stop by a keyed man: he pulls it to (see above)
      else if (touched) { d.quietT = 0; d.closing = false; } else if (!bodyBlock) { d.quietT += dt; }
      // free swing with friction, limit stops (a kicked door was already integrated above)
      if ((!touched || kicked || yank) && !d.latched) {
        if (!kicked) d.angle += d.vel * dt;
        d.vel *= Math.exp(-2.2 * dt);
        if (d.angle >= d.maxA || d.angle <= d.minA) {
          const lim = d.angle >= d.maxA ? d.maxA : d.minA; d.angle = lim;
          if (ow && lim === 0) {   // (one-way) come to on its frame: the rebate takes it — a slam if it came fast, no bounce, and the latch below catches it
            if (d.vel * S < -2.5) this.emit({ door: d, sound: 'bang', pos: d.pos, who: d.lastWho, level: Math.min(1, Math.abs(d.vel) / 8) });
            if (d.vel * S < 0) d.vel = 0;
          } else {
          if (Math.abs(d.vel) > 2.5) this.emit({ door: d, sound: 'bang', pos: d.pos, who: d.lastWho, level: Math.min(1, Math.abs(d.vel) / 8) });
          d.vel = Math.sign(lim) * d.vel > 0 ? -d.vel * 0.25 : d.vel;   // bounce only if still moving into the stop
          }
        }
        // hydraulic closer engages after a moment of no contact
        if (((this.hasCloser(d) && d.quietT > 2.0) || d.closing) && !bodyBlock) { const k = d.closing ? 5.0 : 3.0; const acc = -d.angle * k - d.vel * (d.closing ? 4.2 : 3.2); d.vel += acc * dt; }
        if (bodyBlock) d.vel *= Math.exp(-12 * dt);   // resting on a body: the closer gives up pushing and the leaf settles where it is
        if (Math.abs(d.angle) < 0.012 && Math.abs(d.vel) < 0.35 && d.quietT > 0.3 && !d.passers) {   // (never inside a man it is passing: it rests to, unlatched, until he steps clear — latched, his next contact would creak it open and whip it through)
          if (d.swept && !d.closing && this.stay) { d.angle = 0; d.vel = 0; d.creakArmed = true; }   // (DOORSTAY: brought here by a keyed man's body alone — it rests to in its frame and nobody has shut it: no latch, no click, no bolt)
          else {
          d.angle = 0; d.vel = 0; d.latched = true; d.creakArmed = true; d.closing = false; d.swept = false; d.pullT = 0;
          this.emit({ door: d, sound: 'latch', pos: d.pos, who: d.lastWho, level: 0.16 });
          }
        }
      }
      if (d.quietT > 1.2) d.creakArmed = true;
      // the lock: a cylinder nobody is working holds for a couple of seconds, then the pins settle back (a full pick's worth drains in ~4 s); the tried-handle flash runs down
      if (d.picking) { d.picking = false; d.pickIdle = 0; } else if (d.pick > 0) { d.pickIdle += dt; if (d.pickIdle > 2.0) d.pick = Math.max(0, d.pick - dt / 4); }
      if (d.rattleT > 0) d.rattleT = Math.max(0, d.rattleT - dt);
      if (d.pullT > 0) d.pullT = Math.max(0, d.pullT - dt);
      if (d.drive) { const D = d.drive; D.t += dt; if (walker && D.kind === 'body' && D.who === walker.who) { D.px = walker.pos[0]; D.pz = walker.pos[2]; } }   // (DOORTHROW: t is 0 through the update that follows a drive — written since the last one)
      d.place();
    }
  }

  /** Does d's leaf, at the angle it stands, press into any LIVING contact along its face (the same overlap and along-the-leaf window update()'s yield branch uses;
   *  the limp things and the men it is passing through do not count — a kicked leaf shoves a body outright, and a passer is not felt)? The kicked swing's stop test. */
  private leafPresses(d: Door, contacts: DoorContact[]): boolean {
    const [hx, hz] = d.def.hinge; const W = d.def.width; const ht = d.thick / 2; const u = d.dir();
    if (DOORWAY.oneWay && d.pullT > 0) return false;   // (a leaf booted or shoved from the face it opens into comes round past the men there: see DOORWAY)
    for (const c of contacts) {
      if (c.weak) continue;
      const px = c.pos[0] - hx, pz = c.pos[2] - hz; if (px * px + pz * pz > (W + c.radius + 0.1) ** 2) continue;
      const bit = this.passBit(c); if (bit & d.passers) continue;
      const along = px * u[0] + pz * u[1]; if (along <= 0.14 || along >= W + c.radius) continue;
      const t = clamp(along, 0, W); const dist = Math.hypot(px - u[0] * t, pz - u[1] * t);
      if (c.radius + ht - dist > 0) return true;
    }
    return false;
  }

  /** Hold-to-crack: ease a (near-)closed leaf open away from `from`, silently, up to `maxAngle`; the closer stays off while it is being held.
   *  The wedge of light through the gap widens as you inch it — and nobody hears a thing unless you let it swing. (A lock against you: nothing gives —
   *  unless one of `keys` fits it, and then the key goes round with the handle as softly as the rest.) */
  crack(d: Door, from: Vec3, who: number, dt: number, keys?: ReadonlySet<string>, rate = 0.55, maxAngle = 0.6) {
    if (d.off || this.lockedOut(d, from, keys)) return;
    const [hx, hz] = d.def.hinge; const u = d.dir(); const px = from[0] - hx, pz = from[2] - hz; const perp = u[0] * pz - u[1] * px;
    const sgn = DOORWAY.oneWay ? d.swing : Math.abs(d.angle) > 0.02 ? Math.sign(d.angle) : (perp >= 0 ? -1 : 1);
    if (DOORWAY.oneWay && (perp >= 0 ? 1 : -1) === d.swing) d.pullT = Math.max(d.pullT, 0.3);   // eased toward himself: the leaf comes past the hand that has it
    d.latched = false; d.closing = false; d.vel = 0; d.quietT = -1.5; d.lastWho = who;
    if (Math.abs(d.angle) < maxAngle) d.angle = clamp(d.angle + sgn * rate * dt, d.minA, d.maxA);
  }

  /** Player 'use' (a tap on F): closed → swing open away from the user; open → pull/push it shut (closer takes it the last bit fast); locked against you → just
   *  the rattle — or, with a key that fits on your ring (`keys`), the key's clack (KEY_LEVEL) and it swings open like any other: the bolt bites again behind
   *  you when the leaf next latches — by its closer, or, where doors stay as they are left (DOORSTAY), when a hand shuts it. */
  use(d: Door, from: Vec3, who: number, keys?: ReadonlySet<string>) {
    if (d.off) return;   // (no leaf to swing: every verb below is nothing to a doorway whose door lies on the floor)
    if (this.lockedOut(d, from, keys)) { this.rattle(d, who); return; }
    if (this.keyOpens(d, from, keys)) this.emit({ door: d, sound: 'unlock', pos: d.pos, who, level: Doors.KEY_LEVEL });
    const [hx, hz] = d.def.hinge; const u = d.dir(); const px = from[0] - hx, pz = from[2] - hz; const perp = u[0] * pz - u[1] * px;
    if (d.isClosed()) { const sgn = perp >= 0 ? -1 : 1; d.latched = false; d.closing = false; d.vel = sgn * (DOORWAY.oneWay && sgn !== d.swing ? PULL_VEL : 3.2); d.quietT = -1.0;   // (from the face it opens toward this becomes a pull — update() turns it round — and a pull brings the leaf past square: PULL_VEL)
      this.emit({ door: d, sound: 'creak', pos: d.pos, who, level: 0.2 }); }
    else this.pullTo(d, who);
    d.lastWho = who;
  }
  /** Pull a leaf to from wherever it stands, even a hand's breadth ajar (use() would push that one open): a stiff sprung close that the latch catches — works for
   *  hold-open doors too. What a guard tidying up in a lockdown does (guards.ts lockdownDoors). */
  /** a contact's bit in Door.passers: his id's own under 32. DOORSTAY: a keyed man past id 31 — a big squad map's last few units — has one of bits 2‥9, ids
   *  nobody is dealt (Sam is 1, the shift 10 up, units 20 up, civilians 40 up and keyless): sharing `id & 31` gave unit 33 Sam's bit, and a leaf one of the
   *  two was stepping through then did not feel the other. With it off he has none, as ever. */
  private passBit(c: DoorContact): number { return c.who < 0 ? 0 : c.who < 32 ? 1 << c.who : c.key && this.stay ? 1 << (2 + (c.who - 32) % 8) : 0; }
  /** how far a leaf stands open the way a shove of sign `s` (a plan's fling) would send it: what 'already open, leave it' is tested on. One-way, that is simply
   *  how far open it stands — it has one side, and a fling written against it is turned into a pull (update) — so a leaf left wide open is never shoved again:
   *  the old test read such a leaf as 'not open my way', and the shove, past 1.2 rad a shove toward shut, slammed it on its frame in front of the entry. */
  openFor(d: Door, s: number): number { return DOORWAY.oneWay ? Math.abs(d.angle) : d.angle * s; }
  pullTo(d: Door, who: number) { if (d.latched || d.off) return; d.closing = true; d.swept = false; d.vel = -Math.sign(d.angle) * 1.2; d.lastWho = who; }
  /** A hand on the handle from the face it opens into (handleside.ts — the AI's opener, standing at the latch jamb clear of the sweep): exactly what a man
   *  pressing on it there gets in update() — unlatched with its creak, brought round toward him at the pull's pace — asked for outright, without his body in it. */
  pull(d: Door, who: number, quiet = false) {
    if (d.off) return;   // (off its hinges: no leaf in the frame for a hand)
    if (d.latched || d.restsTo) { d.latched = false; if (d.creakArmed) { this.emit({ door: d, sound: 'creak', pos: d.pos, who, level: quiet ? 0.12 : 0.3 }); d.creakArmed = false; } }
    d.closing = false; d.swept = false; d.vel = d.swing * Math.max(d.vel * d.swing, quiet ? PULL_VEL_QUIET : PULL_VEL); d.pullT = PULL_SECS; d.quietT = Math.min(d.quietT, -1); d.lastWho = who;
  }

  // ---------------------------------------------------------------- locks
  /** seconds of actual cylinder work to pick a lock (the plant / hands-up beat before it comes on top: ~4.5 s door to door) */
  static readonly PICK_SECS = 4.2;
  /** hearing levels (GameEvent 'door', see guards.ts hearingCheck: a = level·(1−d/12)·carry must beat 0.08 to register at all, 0.3 awareness = 'huh?'):
   *  a pick click every ~0.7 s at 0.16 walks a patrolling man within ~3 m up to 'huh?' over one full pick and shows as ticks on his marker to ~5 m; the
   *  cylinder going over (0.3, a door creak's worth) tips one at ~4 m; the tried handle (0.12) is a tick at arm's length and nothing across the room, and
   *  a key turning it (KEY_LEVEL, use() with a key that fits) is the same small clack — eased round on a held handle (crack) it is nothing at all. */
  static readonly PICK_LEVEL = 0.16; static readonly UNLOCK_LEVEL = 0.3; static readonly KEY_LEVEL = 0.12;

  /** Try the lever against the bolt: a clack, the leaf working in its frame, the marker flashing 'won't budge' (Door.rattleT). Rate-limited by the flash itself. */
  rattle(d: Door, who: number, level = 0.12) {
    if (d.rattleT > 0 || d.off) return;
    d.rattleT = 0.6; d.lastWho = who; this.emit({ door: d, sound: 'rattle', pos: d.pos, who, level });
  }

  /** Where to work d's lock from `from`'s side: the root half a metre square off the leaf in front of the keyway (under the lever, 14 cm in from the latch edge —
   *  CharacterAnimator.lockpickAt reaches 0.45 m dead ahead), facing the leaf. `stand` = the stand-off (the kick uses the same spot further out). */
  workSpot(d: Door, from: Vec3, stand = 0.5, along = d.def.width - 0.14): { pos: Vec3; yaw: number } {
    const [hx, hz] = d.def.hinge; const u = d.dir(); const s = this.side(d, from); const nx = -u[1] * s, nz = u[0] * s;   // unit normal out of the leaf on `from`'s side
    return { pos: [hx + u[0] * along + nx * stand, 0, hz + u[1] * along + nz * stand], yaw: Math.atan2(-nx, -nz) };        // (Character.forward = [sin yaw, 0, cos yaw]: face back into the leaf)
  }
  /** Where a kick is thrown from: square to the leaf 0.76 m off it (the sole arrives ~0.75 m ahead of the root at KICK_IMPACT), at the runner's own station
   *  along the leaf but kept on its outer half — by the lock, where a kick belongs and the lever arm is longest. */
  kickSpot(d: Door, from: Vec3): { pos: Vec3; yaw: number } {
    const u = d.dir(); const along = (from[0] - d.def.hinge[0]) * u[0] + (from[2] - d.def.hinge[1]) * u[1];
    return this.workSpot(d, from, 0.76, clamp(along, d.def.width * 0.5, d.def.width - 0.18));
  }
  /** The same kick thrown from BESIDE the door (DOORWAY.sideKick): the root past the latch edge, behind the wall on `from`'s face — about where a stack's
   *  jamb man stands — turned to the lock, the sole's three-quarters of a metre from it. Out of the opening and outside the leaf's sweep on either face.
   *  Geometry only: whether there is floor there is the caller's to ask. */
  kickSpotSide(d: Door, from: Vec3): { pos: Vec3; yaw: number } {
    const [hx, hz] = d.def.hinge; const u = d.dir(); const s = this.side(d, from); const nx = -u[1] * s, nz = u[0] * s, W = d.def.width;
    const pos: Vec3 = [hx + u[0] * (W + SIDE_KICK.past) + nx * SIDE_KICK.out, 0, hz + u[1] * (W + SIDE_KICK.past) + nz * SIDE_KICK.out];
    const lx = hx + u[0] * (W - 0.2), lz = hz + u[1] * (W - 0.2);
    return { pos, yaw: Math.atan2(lx - pos[0], lz - pos[2]) };
  }
  /** how far along the frame line from the hinge, and how far off it, a point stands (the callers' test for 'beside the latch jamb') */
  frameCoords(d: Door, p: Vec3): { along: number; off: number } {
    const u = d.dir(), dx = p[0] - d.def.hinge[0], dz = p[2] - d.def.hinge[1];
    return { along: dx * u[0] + dz * u[1], off: Math.abs(-dx * u[1] + dz * u[0]) };
  }

  /** One frame of working the lock (the caller keeps the picker planted at workSpot and decides when he has to break off). Advances Door.pick; the pick clicks
   *  in an uneven ~0.7 s rhythm the room can hear (PICK_LEVEL), and when the cylinder goes over the bolt draws with a louder snap (UNLOCK_LEVEL) and the door
   *  is simply unlocked from then on. Progress survives a pause (see update()). Returns true on the frame it opens. */
  pick(d: Door, who: number, dt: number): boolean {
    if (!d.locked) return true;
    if (d.def.steel) return false;   // (no keyway on the keyed face of a steel fire door: nothing here advances — player.ts never plants a man at one)
    if (d.pick === 0) d.pickClock = 0.3; else if (d.pickIdle > 0.15) d.pickClock = Math.min(d.pickClock, 0.3);   // fresh start, or picked up again after a pause: the first click comes soon
    d.picking = true; d.lastWho = who; d.quietT = 0;                                                              // (hands on the door: the creak / rattle stay disarmed, the closer has nothing to do anyway)
    d.pick = Math.min(1, d.pick + dt / Doors.PICK_SECS);
    d.pickClock -= dt;
    if (d.pickClock <= 0) { d.pickClock = 0.55 + 0.3 * ((++d.pickN * 0.618034) % 1); this.emit({ door: d, sound: 'pick', pos: d.pos, who, level: Doors.PICK_LEVEL }); }
    if (d.pick < 1) return false;
    d.locked = false; d.pick = 0; d.picking = false; d.noticed = false;   // (picked again after they had found it and locked it back up: fresh evidence, worth a fresh remark — guards.ts / squad.ts readDoors)
    this.emit({ door: d, sound: 'unlock', pos: d.pos, who, level: Doors.UNLOCK_LEVEL });
    return true;
  }

  /** A boot beside the lock: the keep tears out of the jamb (lockBroken — it is an unlocked door for the rest of the encounter), the leaf is flung to its stop
   *  harder than any shoulder bash, and the crack of it carries through the whole floor (DoorEvent 'kick' → GameEvent 'kick', heard like a shot). Works on any
   *  leaf the kicker can reach, locked or not; one already standing wide open just gets the noise.
   *  THE FRAME HOLDS (bootHolds): at the face a shut leaf opens toward, the boot lands on a door backed by its frame — a loud thud, the leaf shivering in it
   *  ('won't budge'), the keep whole, the lock still thrown. `lock`: what hit it destroys the LOCK ITSELF rather than driving the leaf (a charge on the keep,
   *  a breaching round): from that face the keep is gone and the leaf not flung — it stands home in its frame, unlocked, for a hand to pull (or for the caller's
   *  own write of Door.vel); from the push face, and with the rule off, the argument changes nothing. Returns whether the door GAVE (false: off its hinges,
   *  steel, or its frame held the boot) — the one answer a caller needs, so nobody asks bootHolds a second time to learn what its kick did. */
  kickIn(d: Door, from: Vec3, who: number, lock = false): boolean {
    if (d.off) return false;
    if (d.def.steel) { d.rattleT = 0.6; d.lastWho = who; this.emit({ door: d, sound: 'clang', pos: d.pos, who, level: 1.0 }); return false; }   // steel in a steel frame: the boot rings off it, the leaf shivers in its frame ('won't budge'), the bolt holds — a loud noise and nothing else
    const held = this.bootHolds(d, from);
    if (held && !lock) { d.rattleT = 0.6; d.lastWho = who; this.emit({ door: d, sound: 'thud', pos: d.pos, who, level: 1.0 }); return false; }   // it opens toward the boot: the whole frame is behind the leaf, and nothing gives — as loud as a boot on steel, and as useless
    if (!d.lockBroken) d.noticed = false;    // a picked lock they had already remarked on, now kicked through: the splintered jamb is news again (a second kick at a broken keep is not)
    d.locked = false; d.lockBroken = true;   // (only a leaf locked against the kicker ever gets kicked: game.ts)
    d.pick = 0; d.latched = false; d.closing = false; d.swept = false; d.quietT = -0.5; d.lastWho = who; d.creakArmed = false;
    if (held) { /* (the lock destroyed from the face it opens toward: nothing drove the leaf — the keep is gone and it stands home in its frame, unlocked; left alone it clicks back onto its latch like any shut door, and a hand opens it from either face) */ }
    else if (Math.abs(d.angle) < 1.4) { d.vel = -this.side(d, from) * 9; d.sinceBash = 0; if (this.throws && this.opening(d, Math.sign(d.vel))) this.driven(d, who, d.vel, 'boot', false, 0); }   // away from the boot (side +1 pushes the leaf CW = negative angle), on the fast 'kicked' path in update()
    this.emit({ door: d, sound: 'kick', pos: d.pos, who, level: 1.0 });
    return true;
  }

  // ---------------------------------------------------------------- off its hinges (doorblast.ts)
  /** THE DOORS' SIDE OF A BLAST — the one call a blast makes about doors, whatever set it off (the destruction engine's blast entry point, a frag, a charge): it
   *  went off at `at`, and takes an ordinary leaf off its hinges inside `tearM` metres of it (0 = this kind of blast never does). Every leaf it reaches by a line
   *  no wall is in comes out of its frame as a loose slab (doorblast.ts doorBlast — steel doors and ones already off are not touched); the doors it took come
   *  back. `who`: the character blamed for the noise. Nothing with the switch off (DOORBLAST.on) or before a Game has given the doors their world. */
  blast(at: Vec3, tearM: number, who: number): Door[] { return this.blaster ? this.blaster(at, tearM, who) : []; }
  /** set by the Game (doorblast.ts needs its collision world, events and audio — this file knows none of them) */
  blaster: ((at: Vec3, tearM: number, who: number) => Door[]) | null = null;
  /** a noise of d's that is not a leaf's own doing (doorblast.ts: the frame letting go = a 'kick', the slab landing = a 'bang') — heard and played as any other */
  sound(d: Door, sound: DoorSound, pos: Vec3, who: number, level: number) { this.emit({ door: d, sound, pos, who, level }); }
  /** told of every leaf that comes off, by whatever road (a blast through blast() above, a charge set on the leaf, gunfire: doorblast.ts DOORSHOT): `fn(door, who, cause)` on the frame it leaves its
   *  frame — for a change feed, a tally, the AI. Returns the unsubscribe. */
  onTorn(fn: (d: Door, who: number, cause: 'blast' | 'fire') => void): () => void { this.tornSubs.push(fn); return () => { const i = this.tornSubs.indexOf(fn); if (i >= 0) this.tornSubs.splice(i, 1); }; }
  torn(d: Door, who: number, cause: 'blast' | 'fire' = 'blast') { for (const fn of [...this.tornSubs]) fn(d, who, cause); }
  private tornSubs: ((d: Door, who: number, cause: 'blast' | 'fire') => void)[] = [];

  /** Insert approach/exit points where a path crosses a doorway so characters take doors head-on and clear the
   *  swung leaf before turning (the leaf can stand perpendicular to the wall at its stop). */
  threadPath(path: Vec3[], start: Vec3, isFree: (x: number, z: number) => boolean = () => true): Vec3[] {
    if (!path.length) return path;
    const out: Vec3[] = []; let prev = start;
    for (const p of path) {
      const ins: { t: number; pts: Vec3[] }[] = [];
      for (const d of this.list) {
        const [hx, hz] = d.def.hinge; const u: [number, number] = [Math.cos(d.def.closedDir), Math.sin(d.def.closedDir)]; const n: [number, number] = [-u[1], u[0]];
        // intersect segment prev→p with the closed-door line (hinge .. hinge+u*W) in 2D
        const ax = prev[0] - hx, az = prev[2] - hz, bx = p[0] - hx, bz = p[2] - hz;
        const da = ax * n[0] + az * n[1], db = bx * n[0] + bz * n[1];
        if (da * db >= 0 || Math.abs(da - db) < 1e-6) continue;
        const t = da / (da - db); const ix = ax + (bx - ax) * t, iz = az + (bz - az) * t; const along = ix * u[0] + iz * u[1];
        if (along < -0.1 || along > d.def.width + 0.1) continue;
        const mid = d.def.width * 0.55; const sgn = da < 0 ? 1 : -1;      // travelling toward +n if da<0
        const cx = hx + u[0] * mid, cz = hz + u[1] * mid;
        const pick = (dists: number[], side: number): Vec3 | null => { for (const dd of dists) { const q: Vec3 = [cx + n[0] * dd * side, 0, cz + n[1] * dd * side]; if (isFree(q[0], q[2])) return q; } return null; };
        // only add points the existing waypoints don't already cover, otherwise the guard overshoots and doubles back in the doorway
        const before = -da * sgn, beyond = db * sgn;                         // how far prev / p sit from the door line along the travel direction (both ≥ 0)
        const pts: Vec3[] = [];
        if (before > 0.75 + 0.5) { const a = pick([0.75, 0.55], -sgn); if (a) pts.push(a); }            // approach square-on
        if (beyond > 1.35 + 0.5) { const b = pick([1.35, 1.1, 0.85, 0.6], sgn); if (b) pts.push(b); }   // clear the leaf before turning
        if (pts.length) ins.push({ t, pts });
      }
      ins.sort((p0, p1) => p0.t - p1.t); for (const i of ins) out.push(...i.pts);                        // in travel order if one leg crosses two doorways
      out.push(p); prev = p;
    }
    return out;
  }

  /** How close (planar, to the leaf centre or the doorway centre) a character must be to use a door (player.ts buildInteractables). */
  static readonly USE_REACH = 1.35;

  boxes(out: Box[]) { for (const d of this.list) { out.push(d.box, d.handleBoxes[0], d.handleBoxes[1]); } }

  /** Leaf boxes, for registering as dynamic occluders with the collision layer. */
  leafBoxes(): Box[] { return this.list.map(d => d.box); }
}
