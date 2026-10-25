// Character = animated mannequin instance: locomotion/upper-body animation graph, procedural aim twist,
// world placement, bone queries and RT proxy boxes — and, once dead, a ragdoll (ragdoll.ts) that poses the same skeleton.
import { SideMap, rollbackRoot } from '../math/side';
import { Mat4, Quat, Vec3, m4, quat, v3, clamp, damp, wrapAngle, lerp, smoothstep } from '../math/vec';
import { hyp4 } from '../math/vec';
import { GltfCharacter, Clip } from '../anim/gltf';
import { NodeOverride, Pose, PoseFK, SkeletonInstance, TwistSpec, blendPose, buildMask, restPose, rotateLocal, rotateModel, sampleClip, setModelRot, twoBoneIK } from '../anim/skeleton';
import { Ragdoll, RagdollWorld, RAG } from './ragdoll';
import { RIG, unAdj, holsterFrameOf, slingFrontHand, BIGRIG, bigBackOf, carbineGrip } from './rigProps';   // (read inside methods only — sheathFist, kitSpot, bigLayer — never by a top-level statement: the game's one import cycle)
import { hyp2, hyp3 } from '../math/vec';
import { WALLSNAP } from './wallsnap';
import { STEALTHPOSE, type StealthFeed } from './stealthpose';   // (read inside methods only: the game's one import cycle)
import type { GunLook } from './gunlook';
import { feedPath, feedLive, type FeedKey } from './gunreload';   // (read inside methods only: the game's one import cycle)
import type { GunModelId } from './weapons';
import { INHAND, BELT_TORCH, InHandWord } from './inhand';   // (a leaf: the switch and its numbers)
import { GUNHAND } from './gunhand';   // (a leaf: the switch and its keys)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

export type UpperMode = 'none' | 'relaxed' | 'aim' | 'torch';
/** Procedural ready postures layered over the locomotion (see CharacterAnimator.stance). */
export type Stance = 'none' | 'highReady' | 'lowReady' | 'stack' | 'wall';
/** The long gun's four carriages (see LONG / CharacterAnimator.longGun): the calm two-hand carry, the long-gun low ready, shouldered on the aim, the high port. */
export type LongStance = 'patrolLong' | 'lowLong' | 'shoulder' | 'portLong';
export const LONG_STANCES: LongStance[] = ['patrolLong', 'lowLong', 'shoulder', 'portLong'];
/** Left-hand signals (CharacterAnimator.signal). */
export type SignalKind = 'hold' | 'go' | 'rally' | 'squeeze' | 'aside';
/** The idle tells of a man about to leave his route for a need (CharacterAnimator.tell — game/needs.ts): a look at his watch, a rub at the back of his neck. */
export type TellKind = 'watch' | 'neck';
/** the takedown strike's clip (strike): 'cross' = Punch_Cross, the rear hand — the blow there always was; 'jab' = Punch_Jab, the lead hand (a man taken from the front) */
export type StrikeKind = 'cross' | 'jab';
/** the takedown's own moves over a strike (takedown.ts; CharacterAnimator.blow): the elbow chop from behind · the palm heel from a side / the front · the knife
 *  from behind with the free hand over his mouth · the knife swept in from a side · the throat slash from the front */
export type BlowStyle = 'chop' | 'palm' | 'mouth' | 'sweep' | 'slash';
/** how a man put down quietly falls (Character.fallAs, read once by ragdollize): folds forward, knees then face · topples stiff the way he was hit · stands a
 *  beat, then knees, sits, rolls · goes down where he stood, lowered */
export type FallStyle = 'fold' | 'topple' | 'sink' | 'cut' | 'slump';
/** what the man a takedown is done to shows on his feet (CharacterAnimator.taken): arched back onto a shoulder · head snapped down, shoulders hunched, knees going ·
 *  head snapped back */
export type TakenStyle = 'arch' | 'hunch' | 'snap';
/** Sam's READY pose in an open hands-on window (ready / readyLayer): 'grab' = the left arm reaching for the man's neck, the right hand cocked at the lower chest ·
 *  'grabGun' = the same reach off the pistol's support hand, the gun hand left on its aim · 'strike' = a compact guard, the right fist by the jaw with its elbow out ·
 *  'seat' = both hands forward and down onto a seated man */
export type ReadyKind = 'grab' | 'grabGun' | 'strike' | 'seat';
/** The grab-from-behind beat both figures share (player.ts Hold / Guard.held): the reach (grab), the hold itself, the choke (arm variant) or the pistol-whip (gun
 *  variant), the knife drawn across his throat (kill: the arm variant; HOLD.kill). */
export type HoldPhase = 'grab' | 'held' | 'choke' | 'whip' | 'kill';
/** Which hold it is — set at the grab by what was in Sam's hand, swapped by E with the man already in the arm (player.ts swapHold): 'arm' — both hands on the
 *  man, the knife in the right fist (the pistol rides the thigh); 'gun' — the left forearm across his throat as before, the Five-seveN in the right hand up
 *  beside his head (fired past him, or brought down on it). */
export type HoldVariant = 'arm' | 'gun';
/** What the controller tells each figure's layer every frame of a hold (CharacterAnimator.holdPose = Sam, .heldPose = the man): the phase and the seconds into
 *  it, and the variant (absent = 'arm'; a change of it mid-hold is eased by the layers themselves — the hand-over, HOLD.secs.swap). Sam's gun hold also carries
 *  how far the pistol is presented off the man's head to fire past him (gunOut 0‥1, eased by the controller) and the pitch it is presented at (rad, + up: the
 *  aim). The man's carries how rattled he is (0‥1, the dialogue engine's agitation — the struggle's amplitude, so body and mouth agree) and the seconds since
 *  a round last went past his ear (shot; absent / < 0 = none lately). */
export interface HoldPose { /** seconds since the stalk's step in landed (HOLD.yank), unset = no yank */ yank?: number; /** seconds into the stalk's step in (HOLD.lunge), unset = no step */ step?: number; /** where the man's root is in the world while the grab's reach lasts (HOLD.catch: the arm's keys ride him; fed only with HOLD.catchShape up) */ man?: Vec3; /** m Sam has gone back with the man in the stalk's haul so far (HOLD.catch.samFeet: his feet step it; fed only with STALK.yankWith up) */ pull?: number; phase: HoldPhase; t: number; variant?: HoldVariant; gunOut?: number; gunPitch?: number; low?: number; kill?: boolean; beats?: boolean; /** the choke's haul (HOLD.haul), as takedown.ts takeHaul has it this frame; absent = off */ haul?: boolean; /** the grab's disarm (HOLD.disarm; game/disarm.ts feeds both poses while the move runs, absent = none): seconds since the grab began · Sam's alone: the man's gun hand as it was last posed (WORLD; held where it was once the gun is taken) and whether a gun came out of it */ strip?: StripPose; }
export interface StripPose { t: number; at?: Vec3; }
/** armed: his right hand still has the pistol in it (a man grabbed with it drawn) — the raised hand stays a fist round it instead of opening */
/** low (both poses, 0‥1; absent = 0 = the choke held standing to its end): how much of HOLD.lower the choke shows — as he goes limp Sam sinks with him and lays him toward the floor */
/** kill / beats (both poses): takedown.ts's two hold halves as the controller has them this frame (takeKill / takeBeats) — absent = what takedownTick last left in HOLD_SHOW */
export interface HeldPose { /** as HoldPose.yank */ yank?: number; /** m he has been hauled back by the stalk's yank so far (HOLD.catch.feet; fed only with HOLD.catchShape up) */ pull?: number; phase: HoldPhase; t: number; agitation: number; variant?: HoldVariant; /** no knife in the hold (game/close.ts CLOSE.noKnife): his right hand is on the arm, not up and open beside his head (HOLD.bareGrip) */ bare?: boolean; shot?: number; armed?: boolean; low?: number; kill?: boolean; beats?: boolean; haul?: boolean; strip?: StripPose; }
/** A hand on the door leaf he is pushing open (game.ts handsOnDoors feeds it, CharacterAnimator.doorLayer poses it): p = the spot on the leaf face for the palm
 *  (WORLD), n = that face's unit normal out toward him (world), w = 0‥1 intent — 1 while he pushes, 0 to take the hand off; the layer eases either way and keeps
 *  the last spot to ease out from — hand = which one game.ts wants on it (0 left, 1 right: the leaf's free-edge side if that hand is empty, else the left; the
 *  layer still refuses a right hand that has the pistol or a torch in it; −1 = not settled yet: square up to the door but keep both hands where they are). */
export interface DoorPush { p: Vec3; n: Vec3; w: number; hand: 0 | 1 | -1; holdOnly?: boolean; reach?: boolean; }   // holdOnly: standing in the swing of a leaf its closer rests on him — the hand may go up if he already faces it, but the controller must not turn him to it
/** HANDS AT WORK ON A THING (game/handwork.ts feeds it — CharacterAnimator.work; workLayer): one pose for every verb that has a man stand at something and use
 *  his hands on it. p = the spot on the thing (WORLD), n = out of its face toward him (world, unit, level), t / dur = the verb's own clock (s; t past dur = it is
 *  done and the hand is coming away), hand = 0 to keep the right out of it (the caller knows it holds something the animator poses no layer for). Per kind:
 *  'keys' — a forefinger on a keypad: four presses on the beats workKeyBeat gives, at `keys` (m right / up of p on the face, as he sees it; the code's own);
 *  'charge' — a slab pressed flat onto a face and smoothed down, then the fingers at its cap; 'lever' — a fist over a handle, thrown at the end (dir +1 down,
 *  −1 up); 'take' — the fingers into a slot, a grip, and the thing drawn out toward him, then put away at his hip. */
export type WorkKind = 'keys' | 'charge' | 'lever' | 'take';
export interface WorkPose { kind: WorkKind; p: Vec3; n: Vec3; t: number; dur: number; keys?: readonly (readonly [number, number])[]; dir?: number; hand?: 0; }
/** …its numbers: s before the first key (the hand's way there), m from the wrist joint to the forefinger's tip, m the tip hovers off a key and the key's face stands
 *  off p, m a lever's handle travels either side of p */
export const WORK = { keyLead: 0.2, tipLen: 0.215, hover: 0.022, keyOff: 0.03, lever: 0.035 };
/** when key k (0‥3) of a code is pressed, on a verb `dur` long */
export const workKeyBeat = (k: number, dur: number) => WORK.keyLead + (k + 0.5) * (dur - WORK.keyLead) / 4;
/** THE TORCH ↔ SIDEARM SWAP (CharacterAnimator.carry; swapLayer): what the gun hand carries, and the move between the two — s to draw / to put the gun away, and the
 *  fractions of either at which the first thing is out of the hand and the second is in it */
export type CarryKind = 'torch' | 'weapon' | null;
export const SWAP = { draw: 0.6, stow: 0.8, away: 0.3, take: 0.5, lag: 0.2 };   // (lag: the longest any one man keeps what he has before his hand starts, s — each man his own share of it, so a floor that goes up a step does not swap every hand on one frame)
const NO_KEYS: readonly (readonly [number, number])[] = [[0, 0]];
/** Both hands on a body he is taking hold of, hauling or setting down (hands.ts feeds it): the WORLD spots for the left and right wrist — the two limbs of the
 *  body he has, wherever the ragdoll has them — how far the trunk bows down to them (rad) and how closed the fingers are (0 open … 1 round an ankle). */
export interface HaulPose { l: Vec3; r: Vec3; bow: number; grip: number; /** how much of the RIGHT hand is on it (default 1; 0 = that arm is his own: a body carried on the left shoulder under the left arm) · how much he looks at his hands (default 0.7) · rad his trunk tips to his right, away from a load on the left shoulder (default 0) */ rw?: number; look?: number; tilt?: number; }
/** The hold's contact constants (docs/internal/grab-interrogate-design.md §3). The two roots are locked HOLD.dist apart on ONE facing, so a point on the other man
 *  is a constant in each figure's own model space (x = the figure's left, y up, z ahead of its root) — no bone hand-off between the characters. Timings are the
 *  controller's too (player.ts reads secs). First-pass numbers off the mannequin's measured joints; the viewer will get a page to tune them like RIG. */
export const HOLD = {
  /** A held man drops his gun (game rule, player.ts startGrab): as the arm goes round, the weapon in his hand is knocked out of it and lies on the floor like any
   *  dropped gun (combat.ts dropFromHand, quietly), its light sputtering out there; his hands stay empty for the whole hold and through whatever ends it. The one
   *  exit that leaves him on his feet (player.ts handBack: Sam put down with him in the arm, or a cancel) has him take it up again there and then, his stagger `regrab` seconds
   *  longer. Off = he kept it in his fist through the hold, as before. ON in the page (?nogundrop), off here and on the frozen stand (TPS_HOLDDROP=1). */
  dropGun: false, regrab: 0.9,
  /** A HOLD WITH NO KNIFE (HeldPose.bare, fed by player.ts under game/close.ts CLOSE.noKnife): the held man's right hand was half up beside his head, open, palm
   *  forward — frozen under a blade. With no blade it was a pale open hand waving over the pair, the brightest thing on screen. It is on the arm across his
   *  throat instead, fingers hooked over it: this much of the choke's own clawing station, without the clawing (0 = the raised hand, as before). */
  bareGrip: 0.9,
  /** …and he is HAULED BACK onto the arm, not stood beside it (judged on stills from the game's camera: upright, Sam hid him and only his two elbows showed
   *  either side of Sam's head). `bareArch`° more arch over the spine while he has his feet, his elbows carried down (`bareElbow` of the way to hanging). And
   *  THE YANK (HoldPose / HeldPose.yank = seconds since Sam's step in landed, fed by player.ts with the stalk's grab): for `in` s his chest goes back `arch`°
   *  further and Sam sits `sink` m into it, held `hold` s, let out over `out` s — the pose's share of the haul back (stalk.ts STALK.yank moves the pair). */
  bareArch: -11, bareElbow: 0.6, yank: { arch: -11, sink: 0.09, in: 0.07, hold: 0.05, out: 0.32 },
  /** THE SPRING BEFORE THE LUNGE (the fourth pass; `HoldPose.step` = seconds into the stalk's step in): his hips dip `dip` m and sit `back` m for a few
   *  frames as the step begins — [in, hold, out] s — so the lunge comes off something. And THE HOLD IS ALIVE (bare hands only): once he is held the pair
   *  shifts its weight from foot to foot, `sway.m` m at the hips each way every `sway.secs` s, the held man a little more and `sway.twist`° through his
   *  shoulders against the arm, scaled up by his agitation. (The stalk's polish: DOWN in this table — dip, back, sway.m, sway.twist, apart, wayShape, and
   *  yank.arch at the bare arch's own — and written up by holdPolish below with the page's numbers.) */
  lunge: { dip: 0, back: 0, t: [0.035, 0.03, 0.1] as [number, number, number] }, sway: { m: 0, secs: 1.9, twist: 0, his: 1.5, in: 0.6, out: 8 }, apart: { side: 0, tip: 0 }, wayShape: false,
  /** THE CATCH HAS A SHAPE (the eighth pass, bare hands; measured bone by bone with tools/qa/stalk-pose.ts and judged on stills from the game's camera).
   *  What it mends, and with what:
   *  · THE ARM WENT PAST HIS EAR. The reach's lead hand rode the step in at its own shoulder's height plus a hand: by the time the arm closed it was 20 cm ahead
   *    of the man's face at 1.55 m, and from above that is an arm over a head. The hold's own arm now has the left hand from the grab's first frames (whole by
   *    `armIn` of the reach; the reach's pose is let go over `readyOut` of it, not READY_BARE.out) and takes it from where the reach had it over his left
   *    shoulder beside the neck (`via`) and round the front of the throat (`over`) at the shares `at` of the hand's clock — both below his jaw, and both RIDING
   *    THE MAN, not Sam: HoldPose.man is where he is, so the hand goes round a neck that is where it is while the step in is still landing.
   *  · HE DID NOT KNOW HE WAS HIT. The man stood as he was until the arch came on. `jolt`: from `t[0]` s into the grab his shoulders come up `clav`° and his
   *    chest goes FORWARD `fwd`° off a `dip` m give of the knees and his head is left behind it (`head`°: chin up, which the camera overhead sees; a nod it
   *    does not), whole at `t[1]`, held to `t[2]`, gone by `t[3]` — as the yank takes him back. `fling`: his hands fly out from his sides (`to`, mirrored, at
   *    the share `at` of their clock) before they come onto the arm, and his arms are the hold's own over `armIn` of the reach.
   *  · THE HOLD WAS ONE BODY. Both men stood upright, hips over heels, 27 cm apart: one blob from above. The man is HAULED OFF HIS FEET'S LINE: his hips `hips` m
   *    ahead of where they stood with the trunk reclined about his own neck, sat `sink` m down into the arm (which goes down with him), his feet `heels` m out in front; Sam sits `seat` m
   *    [back, down, to his left: his head is beside the man's, not in it] behind him, his rear foot `brace` m [back, out], `seatLean`° more over him; he
   *    sits `yankSit` of HOLD.yank.sink into the yank (the man is coming down into the arm himself). And through the yank (HeldPose.pull = how far he
   *    has been hauled) his feet LAG: each stays where it stood on the floor and comes after him over its own `feet` [from, to] s since the step landed, lifted
   *    `lift` m on the way — the front one dragged along with him, the rear one planted and then stepped back.
   *  One switch, `catchShape`: DOWN here and on the frozen stand, up with the stalk's polish (holdPolish). The numbers stand the same on both stands. */
  catchShape: false,
  catch: { via: [0.17, 1.49, 0.21] as Vec3, over: [0.08, 1.465, 0.38] as Vec3, at: [0.42, 0.74] as [number, number], armIn: 0.3, readyOut: [0, 0.3] as [number, number],
           jolt: { t: [0.07, 0.13, 0.24, 0.36] as [number, number, number, number], fwd: 12, head: -16, clav: 6, dip: 0.03 }, fling: { t: [0.24, 0.47] as [number, number], land: [0.73, 0.86] as [number, number], to: [[0.44, 1.08, 0.14], [-0.36, 1.27, 0.08]] as Vec3[], drift: [0.03, 0.05, -0.04] as Vec3, armIn: [0.05, 0.2] as [number, number] },
           sink: 0.12, hips: 0.13, heels: [0.17, 0.27] as [number, number], seat: [0.07, 0.05, 0.06] as Vec3, seatLean: 7, brace: [0.15, 0.12] as [number, number], braceLift: 0.06, yankSit: 0.5, feet: [[0, 0.17], [0.15, 0.36]] as [number, number][], lift: 0.07, samFeet: [[0.04, 0.2], [0, 0.12]] as [number, number][], samLift: 0.05, settle: 0.4 },
  /** THE BODY LANDS (the ninth pass, bare hands, the stalk's grab; judged on stills from the game's camera: "Sam covers a metre, but the guard's feet, hips and
   *  chest stay nailed down. Only his arms fling. He then bends smoothly"). The seat came on by a smoothstep over the reach's last fifth of a second, so the
   *  moment Sam's chest meets his back had no beat of its own. From the step's landing (HoldPose / HeldPose .yank, the yank's own clock: `t` s — in from, whole
   *  at, held to, gone by) the man's hips are driven `hips` m further ahead of where the seat has them, about his own neck as the seat's are (the arm has his
   *  neck: his shoulders go back with the haul and his hips are left behind it), off a `dip` m give of his knees, and his head is given back `head` of that further recline (1 = it stays where the arm has it: left to go back with his
   *  trunk it went 4 cm into Sam's); Sam HEAVES: his hips come `samIn` m in
   *  under the man and `samDip` m down and his chest goes back `heave`° (driven forward into the man's back instead, his head went 3 cm into the man's),
   *  and both come back out as the seat takes them. Nothing without a
   *  landing (a grab with no step in has no yank's clock) or with `hitShape` down, and it leaves with the arm's share of the hold when the gun is drawn — as it is here and on the frozen stand; up with the
   *  stalk's polish (holdPolish). */
  hitShape: false,
  /** …AND HE IS LAID DOWN AHEAD OF SAM (the ninth pass; `layAhead` m, 0 = as it was). The choke's end is the 'sink' fall (fallGuide): onto his knees, then flat
   *  on his front — and flat, his pelvis stayed where it knelt and his legs were drawn out straight BEHIND it, 85 cm back along the floor: under Sam, who stood
   *  with a boot on the man's shin. A kneeling man who goes onto his face pivots about his knees, and Sam lets him down away from himself: the pelvis is led
   *  that much further along his facing, two fifths of it as he goes to his knees and the rest as he is laid flat, so his feet lie clear ahead of Sam's toes
   *  whichever way the fall's die tips him. takedown.ts setFall asks the level for the room, a strip as wide as his shoulders and as long as the lay and the
   *  whole of him: half the lay where only that much is clear, none where a wall, a desk or a low crate is in the way. The choke's end only — the knife from
   *  behind falls as it did. DOWN here and on the frozen stand; up (0.9) with the stalk's polish (holdPolish). */
  layAhead: 0,
  hit: { t: [0, 0.04, 0.07, 0.22] as [number, number, number, number], hips: 0.15, dip: 0.03, head: 1, heave: 12, samIn: 0.05, samDip: 0.06 },
  /** THE GRAB DISARMS HIM (game rule and pose; the rule is game/disarm.ts, begun by player.ts startGrab). With `dropGun` on, the gun in his hand is no longer
   *  knocked out of it on the grab's first frame: as the left arm goes round his throat Sam's right hand goes to it, has it out of his fist `strip.take` seconds
   *  in, tears it out and down to his own right side and lets it fall from a low hand at `strip.drop`: it lands dead, where Sam put it, beside the pair. The
   *  pistol hold (Sam's right hand has his own gun) raps it out of the man's hand with the frame on its way up to his head instead: it falls from where the man
   *  held it. The hold itself is what it was: he is `held` on the same frame, by the same clock. Off = the gun leaves his hand on the first frame, thrown clear
   *  with a roll of the dice, as before. ON in the page (?disarm=0), off here and on the frozen stand (TPS_DISARM=1, with TPS_HOLDDROP=1). */
  disarm: false,
  /** THE DISARM LEADS (game rule; disarm.ts `lead`). The maintainer, of the grab: "you really want a disarm and then a grab, right?" — and in the footage he
   *  works from the gun is the first thing to move: it is out of the man's hands before the arm is round his neck. With the two beats above the take fell at
   *  `strip.take` 0.2 s, the same moment the arm closed. With this on the move's own clock runs AHEAD of the hold's until the gun is let go: it is out of his
   *  fist `first.take` s after the grab begins (Sam's right hand comes up at it from the crouch as he rises) and let fly at `first.drop`, where `strip.take` and
   *  `strip.drop` had them, and from there the hand comes home at the pace it always did — so the order is the strip, then the arm (which lands when it did),
   *  and the catch's voice is kept for the arm's landing, `first.catch` s in, behind the strip's. Only for a grab that has a gun to take. Off = the two at
   *  once, as before. ON in the page (?stripfirst=0), off here and on the frozen stand (TPS_STRIPFIRST=1); under `disarm`. */
  stripFirst: false, first: { take: 0.16, drop: 0.3, catch: 0.26 },
  /** …its numbers. Seconds from the grab's first frame: `take` Sam's hand has the gun (it leaves the man's) · `out` it is torn out to the side · `drop` he lets
   *  it go · `knife` the knife is in that fist (it is drawn as the hand comes back up over the man's shoulder, not before) · `home` the hand is back at its
   *  station on him and the move is over · `free` the man's wrist is let go of · `up` his hand is where the hold has it. The man, his own model space: `meet` =
   *  where his gun hand is thrown to as the arm lands — out beside his ribs, elbow flared, inside Sam's reach (in front of his belly no arm reaches it from
   *  behind him) — and `torn` where the wrench drags it. Sam, his: `over` = his wrist from the man's (over the top of the gun, a hand behind it), `wrench` = the
   *  tear from there (out to his right, down, back toward himself), `low` where he lets it go (a straight arm at his right thigh), `yaw`° his chest goes with
   *  the tear; `rap` = the pistol hold's wrist from the man's as the frame comes down on it; `hold` m from Sam's wrist to the gun's middle along his hand,
   *  [pistol, rifle]; `pitch`° the muzzle is down as he takes it · carries it out · lets it go. The fall: `rest` the bounce it lands with (dead), `push` m/s
   *  it leaves the hand at [out to his right, down], turning flat at `spin` rad/s. SECOND PASS (judged on stills from the game's camera): the gun was let go
   *  from a low hand at his thigh and fell straight down — it read as SET down, slid down his leg like a cane and lay under his right foot. He now tears it
   *  out to a straight arm at his right (`low`), his chest going with it (`yaw`), and lets it fly from there: it lands most of a metre clear of the pair at
   *  the same moment as before (the sounds' beats are the fall's time, which is unchanged). THIRD PASS: let go from a thigh-high hand with the muzzle down it
   *  still read as a drop behind him — he lets it go earlier (`drop`) from a LEVEL arm, the gun level, and the arm stays out `follow` s after it. FOURTH PASS
   *  (10-24, the maintainer's own beats, set by ear on the listening page: "strip: new 2 at 0.25 s · gun down: in the game at 0.70 s"): the take later
   *  (`take` 0.2 → 0.26), the tear in two thirds of the time (`out` 0.34 → 0.35, `drop` 0.42 → 0.41: the strip's own click is 0.13 s into it, just before he
   *  lets go), and THE FALL IS TIMED: `fall` s from the hand to what lies under the landing place (disarm.ts letGo: he throws it down as hard as that takes,
   *  about 1.9 m/s from a level arm where the fixed push was 1.05), so the knock is on one frame for a pistol or a carbine, Sam crouched or standing, on
   *  either stand's poses (a fixed down push landed a frame early on the frozen stand's). COUNTED IN FRAMES OF THE PAGE, where the grab begins inside an
   *  update (the catch is heard on that frame and this move's clock already reads one step at its end): the strip is 15 frames after the catch (0.25 s) and
   *  the knock 42 (0.70 s; it was 0.80). `take` and `drop` sit in the middle of the frame they must fall in, and 0.311 is the middle of the falls that land
   *  18 frames after the let-go (0.303 to 0.318). `fall` 0 or absent = the fixed push, as a recording from before it has it (journal.ts). With `stripFirst`
   *  up he lets go sooner and the fall is longer by that many whole frames, so the knock is on the same frame from the grab's start in either order. `push`
   *  down is still what a gun rapped out, stopped at a wall or let fall with no hold leaves at. `free` follows `take` (the man's hand is held torn until
   *  it). The sounds' page rows hold the same times (sounds/catalog.ts; grabvoice-check takes him by the key, as the page does, and ties them to the frame). */
  strip: { take: 0.26, out: 0.35, drop: 0.41, follow: 0.1, knife: 0.7, home: 0.95, free: 0.36, up: 0.68,
           meet: [-0.36, 1.15, 0.05] as Vec3, torn: [-0.47, 1.06, -0.05] as Vec3,
           over: [0, 0.035, -0.05] as Vec3, wrench: [-0.15, -0.1, -0.2] as Vec3, low: [-0.66, 1.2, -0.08] as Vec3, yaw: -16,
           rap: [0.02, 0.08, -0.03] as Vec3, hold: [0.08, 0.02] as [number, number], pitch: [12, 25, 15] as Vec3, rest: 0.05, push: [1.3, 1.05] as [number, number], fall: 0.311, spin: 5 },
  /** A held man faces where the hold faces him, whoever else has a say in his facing (game rule): the night showcase's calm defenders are turned to their marks
   *  every frame while the room fight does not own them (nightbreach.ts) — and that turned a man in Sam's arm too, after the hold had placed him, so through a
   *  turn his chest twisted away from Sam's by up to half a circle. On = a held man is skipped there. Off = as before. ON in the page (?holdyaw=0), off here and
   *  on the frozen stand (TPS_HOLDYAW=1). */
  oneFacing: false,
  /** his root this far dead ahead of Sam's, both on Sam's facing: chest to his back — any further and no arm reaches round a throat with the forearm ACROSS it
   *  (the mannequin's upper arm is 0.27: the elbow has to sit on his left collarbone) */
  dist: 0.27,
  /** seconds: the reach before he is held · Space held this long on his row starts the choke (arm) / the whip (gun) · of tightening before he goes limp · from the
   *  pistol coming off his head to it landing behind his ear (the strike arrives AT this instant; Space up sooner and it never does) · E with him in the arm: the
   *  draw / the holstering — the right hand goes back over his shoulder, changes tools there and comes in with the other (holdLayer, SWAP_RATE), and for this
   *  long the row starts nothing (player.ts swapHold's lockout: no round, no question, no choke, no whip) · the knife across his throat, from the free hand
   *  leaving for his mouth to him let go of (the cut lands HOLD.kill.hit of the way in) */
  secs: { grab: 0.45, chokeHold: 0.35, choke: 2.6, whip: 0.6, swap: 0.3, kill: 1.3 },
  // ---- Sam, his model space (the man's root sits at [0, 0, dist]; his neck joint stands about [0, 1.43, dist − 0.02], the front of his throat ~7 cm ahead of that)
  throat: [-0.11, 1.44, 0.35] as Vec3,        // left wrist: past the middle of the throat to its far side, the forearm's line a finger off the throat — so it lies across it, elbow on his left collarbone
  viaL: [0.38, 1.42, 0.22] as Vec3, overL: [0.16, 1.52, 0.33] as Vec3,   // …reached round the OUTSIDE of his left shoulder and OVER his collarbone onto the throat (the grab's mid keys), never through him
  tight: [-0.08, 1.45, 0.33] as Vec3,         // the choke: the elbow closes, the wrist comes back a finger toward Sam's own chest (the throat gives; the spine behind it does not)
  lean: 8, chokeLean: -4,                     // degrees over the three spine joints: chest onto his back · leaning back to finish it
  headPitch: 6,                               // chin down a touch (the side the head goes and its yaw are the knife's, below: the blade hand has the right)
  brace: 2.5,                                 // degrees of roll Sam's trunk sways AGAINST the man's thrashing through a choke (he is what the man is fighting)
  // ---- the knife (the arm variant's right hand; rigProps.knifeBoxes draws it out of the fist's thumb side, edge to the palm): held, the fist rides just ahead of
  //      his own left wrist at the right-front of the man's throat with the blade laid level across the front of it under the chin — a finger proud of the
  //      choking forearm, which keeps the throat itself — edge in toward the neck, tip a hand past its left side, the elbow up over the man's right shoulder.
  //      Committing to the choke the blade comes OFF him (you do not put a man out with steel under his jaw, and his chin is about to drop onto that arm): the
  //      fist goes down onto the front of his right shoulder and turns thumb-up, so the blade stands up and out past the right of his head, clear of everyone.
  //      Directions are [left, up, ahead], normalized on use; `blade` = where the tip points, `back` = out of the back of the hand (squared to the blade on use).
  knife: {
    hand: [-0.165, 1.555, 0.36] as Vec3, blade: [1, 0, 0.12] as Vec3, back: [0, 0.28, 0.96] as Vec3,  // held: wrist over the blade line, the fist beside his right jaw (knuckles down, back of the hand up-forward → the flat lies all but level, the tip just past the left of his neck, toed a touch forward)
    via: [-0.40, 1.50, 0.04] as Vec3,                                                                // the grab: up behind and outside his right shoulder, then in over it — never through him
    offHand: [-0.24, 1.45, 0.26] as Vec3, offBlade: [-0.35, 0.75, 0.56] as Vec3, offBack: [-0.9, -0.3, 0] as Vec3,   // the choke: fist on the front of his right shoulder, blade up-forward-out (the knuckles come out forward-down, as a hand clamped there would)
    offSecs: 0.4,                                                                                    // about how long the blade takes to come off him once the choke starts (a spring; twice that coming back from an aborted one)
    side: -8, headYaw: 19,                                                                           // Sam's head carried out to the LEFT of the man's, looking past his left ear (as the gun hold: the right is the weapon hand's)
    clav: 5,                                                                                         // right clavicle up with the raised knife arm (°)
  },
  // ---- the man, his own model space (Sam's forearm crosses in front of his throat: elbow about [0.15, 1.46, 0.02], wrist [-0.11, 1.44, 0.08])
  restL: [0.14, 1.47, 0.04] as Vec3,          // left wrist, held: the hand draped OVER the forearm where it comes off his own left collarbone, fingers hanging down its front (clear of the blade's tip) — open, not hooked round it: frozen, not fighting…
  clawL: [0.09, 1.39, 0.13] as Vec3,          // …and where it claws from once the choke bites: just below and ahead of the forearm, hooked up and back over it
  raisedR: [-0.36, 1.53, 0.06] as Vec3,       // right wrist, held: the hand half up beside his head, open, palm forward — 'easy…' (a pistol he was grabbed with stays in the fist, at the ceiling)
  viaUp: [-0.38, 1.20, 0.12] as Vec3,         // the grab: both come up from wherever they were, the right round the outside
  clawR: [-0.12, 1.38, 0.15] as Vec3,         // right wrist in the choke: onto the forearm too, both hands fighting it
  hang: [[0.27, 0.98, 0.14], [-0.27, 0.98, 0.14]] as Vec3[],     // limp: the hands fall away (left, right)
  arch: -5, chinUp: -9, aside: 8, clavUp: 8,  // degrees: spine arched back over three joints, head pulled back and tipped away to his left (off the blade hand, throat bared), shoulders hunched up
  loll: 26, lollRoll: 11,                     // degrees the head drops forward / tips as he goes
  // the choke's LOWERING (takedown.ts TAKEDOWN.lower → HoldPose.low / HeldPose.low; 0 = none of it): over the last stretch of the choke, as he goes limp, the
  // man goes down onto his heels with his trunk folding forward and Sam sinks with him, bowed over him, the arm still round his neck — lowered, never dropped.
  // `from` … `by` = the shares of the (eased) choke it starts at and is all the way down by; `up` = the spring (1/s) both come back up on when the choke is eased off (down, they follow the clock). The man: `sink` / `fwd` m the pelvis goes down / away from Sam over pinned feet, `hip` / `fold` degrees
  // his pelvis and his spine pitch forward, `hang` = how far his hanging hands' marks go down / forward (further down and his arm runs out mid-way: the elbow snaps straight in a frame). Sam: `samSink` m of pelvis over pinned feet with the knees
  // spread by `samKnees` (the man is between them) and `samFwd` m of it toward the man, `samLean` degrees more over him, `samLook` of that left on his head (he
  // looks down at the man), `samArm` = how far the arm round the neck and the hand on his shoulder follow the neck (down, forward). FITTED TO THE SKELETON, the two
  // halves together: with these the hand stays within 1.5 cm of where it sat on his neck standing, all the way down, and the arm never past 0.91 of its reach —
  // more sink for the man, or less for Sam, and the arm runs out (the hand slides up off his neck onto his face).
  lower: { from: 0.6, by: 1, up: 7, sink: 0.4, fwd: 0.05, hip: 8, fold: 20, hang: [0.56, 0.26] as [number, number],
           samSink: 0.3, samFwd: 0.06, samKnees: 0.55, samLean: 38, samLook: 0.45, samArm: [0.5, 0.22] as [number, number] },
  // THE KILL FROM THE HOLD (phase 'kill', the arm variant; takedown.ts TAKEDOWN.kill — off, or the gun variant: the phase is drawn as 'held'). Shares of the
  // clock (secs.kill): by `wind` Sam's free hand is off the throat and clamped over the man's mouth, his head hauled back onto Sam's shoulder, and the blade is
  // set at the far side of his neck; the fist is drawn back across — the throat's middle at `hit` — and on OUT wide to Sam's right by `out`, elbow up (what the
  // camera overhead reads); he stands cut for the beat between `hit` and `go`, his hands at his throat; from `go` his knees give and he goes forward and down,
  // let down by the hand that has come onto his shoulder, never dropped — and Sam GOES WITH HIM, sinking and bowed over him, on his feet. Both layers follow an
  // eased copy of the clock (hdKc / heKc). Let go of, Sam comes up off him at `after` 1/s while he stands still (holdOutRate).
  // Sam, his model space: `mouth` → `chest` → `collar` = the left wrist's stations (over his mouth; across his chest for the beat he still stands; on the top
  // of his far shoulder as he folds forward out of the arm — the hand that lets him down); `set` → `across` → `wide`
  // = the knife fist's path, `low` where it settles after (blade / back as HOLD.knife's); lean° back into the haul · forward over him after, chest yaw° loading
  // left · through with the cut, `samSink` m of pelvis over pinned feet, `look`° the head goes down after him.
  // The man, his own: `reach` = his wrists FLUNG forward as the hand takes his mouth (left, right — a startle, out of the two men's outline from above, and
  // his right arm out from under the blade's way; in at his neck they read as the choke), `clutch` = at his own throat after the cut; chin° / arch° hauled
  // back, the head's jolt° [yaw, pitch] as the blade goes across, `sink` / `fwd` m and `hip` / `fold`° as he goes, `hang` as HOLD.lower's.
  kill: { wind: 0.21, hit: 0.30, out: 0.48, go: 0.46, after: 7,
          mouth: [0.07, 1.6, 0.36] as Vec3, chest: [-0.1, 1.28, 0.36] as Vec3, collar: [0.14, 0.98, 0.5] as Vec3,
          set: [0.06, 1.48, 0.29] as Vec3, across: [-0.2, 1.48, 0.33] as Vec3, wide: [-0.62, 1.40, 0.04] as Vec3, low: [-0.34, 1.05, 0.2] as Vec3,
          wideBlade: [0.55, -0.15, 0.8] as Vec3, wideBack: [-0.2, 0.95, 0.2] as Vec3,
          lean: [-12, 20] as [number, number], yaw: [16, -34] as [number, number], samSink: 0.22, look: 24,
          reach: [[0.28, 1.28, 0.32], [-0.30, 1.30, 0.34]] as Vec3[], clutch: [[0.05, 1.41, 0.1], [-0.05, 1.4, 0.11]] as Vec3[],
          chin: -27, arch: -12, jolt: [-12, -7] as [number, number], sink: 0.34, fwd: 0.08, hip: 8, fold: 36, hang: [0.2, 0.2] as [number, number] },
  // THE CHOKE'S BEATS, off the clips (takedown.ts TAKEDOWN.chokeBeats; off = the choke as it was) — shares of the eased choke: `clamp` = over which both his hands
  // come onto the forearm (a quarter second in, where they took 0.8 s), `off` = over which they come OFF it and fall, before the lowering starts (they fell
  // with it, through it), `tipBy` = over which his head tips `tip`° to the side before it comes forward; eased off, the hands go back the way they came on a
  // spring of their own, `back` 1/s (the choke's clock is back at rest in a tenth of a second: his arms are not). `lower` = HOLD.lower's table as the beats
  // have it (both layers read this one with the half on, that one with it off — which keeps what every older digest has): started a touch earlier and all the
  // way down by 85 %, so the last third of a second is HELD at the bottom, and deeper — his fold, Sam's lean and sink — the arm's follow refitted to it (the
  // hand within 1.5 cm of where it sat on his neck, the arm to 0.94 of its reach). `after` = 1/s Sam comes up off him once he is out, while he stands still.
  beats: { clamp: [0.03, 0.14] as [number, number], off: [0.41, 0.6] as [number, number], tipBy: [0.5, 0.62] as [number, number], tip: 32, back: 7, after: 2.6,
           lower: { from: 0.58, by: 0.85, up: 7, sink: 0.4, fwd: 0.05, hip: 8, fold: 38, hang: [0.56, 0.26] as [number, number],
                    samSink: 0.38, samFwd: 0.06, samKnees: 0.55, samLean: 48, samLook: 0.45, samArm: [0.52, 0.29] as [number, number] } },
  // THE CHOKE'S HAUL (takedown.ts TAKEDOWN.haul; off = the choke as it was). The maintainer, 10-22: "the choking animation needs to be more intense. in chaos
  // theory sam has him in a chokehold and then lifts him up and back out of the air a bit when choking". Off the clips (the choke seen from the front): a tenth
  // of a second in Sam straightens and hauls him up, the man's head forced back into his chest, and leans back through the squeeze; the man is arched back
  // onto him, hips ahead of his shoulders. Shares of the eased choke: `in` over which it comes on (a third of a second: quicker and a finger of his passes 5 cm in a frame), `out` over which he is
  // set back on his feet — as his hands come off the arm, done by half way, before the lowering takes him down; let go of early it comes down at `down` 1/s. Sam: `samLean`° more over the spine (back, over planted feet — his head goes
  // some 15 cm back, FURTHER than the man's, or the two heads meet: lifted 11 cm with Sam's hips pushed forward under the lean the man's cap covered Sam's head),
  // `samArm` [up, back] m his two hands go with the man's neck. The man: his pelvis `lift` m up and `back` m toward Sam (under 0: FORWARD, with
  // Sam's — his hips ahead of his shoulders, which go back with Sam's chest: tipped back from the shoulders the two heads met) and tipped `recline`°, `arch`°
  // more arch and `chin`° more chin; his feet come `feet` [up, forward] m off where they stood, toes down `toes`°, and kick `kick`
  // [forward, up] m with the fight. Pose only — but both men's head and chest bones move with it (sight lines and the light meter read Sam's).
  haul: { in: [0.02, 0.14] as [number, number], out: [0.38, 0.52] as [number, number], down: 7, samLean: -26, samArm: [0.07, 0.08] as [number, number],
          lift: 0.09, back: -0.08, recline: -14, arch: -4, chin: -6, feet: [0.11, 0.18] as [number, number], toes: 30, kick: [0.07, 0.05] as [number, number] },
  sag: [0.02, 0.06] as [number, number],      // m the pelvis sinks onto the knees: held … out on his feet at the end of the choke (no further: the arm under his jaw carries him until it lets go)
  breath: { hz: 0.7, pitch: 1.6, clav: 2.2 }, // held: hard breathing — chest heave (°, upper spine) and the shoulders lifting with each breath, at this rate
  // the choke's fight (heldLayer): an envelope on the eased choke amount — up fast as the arm closes, spent as he goes — driving a 2–3 Hz thrash of the trunk and
  // head, the hands clawing up and down the forearm, the knees pumping; all off the figure's own desynced clock (deterministic), all pose-only
  struggle: { rise: 0.1, fadeFrom: 0.35, fadeTo: 0.92, yaw: 7, roll: 6, head: 9, claw: 0.035, dip: 0.018, hz: [2.3, 3.1, 1.9] as Vec3 },
  // ---- the gun variant (HoldVariant 'gun'): the left arm exactly as above; the right hand keeps the Five-seveN. Measured, not wished: wrist to the can's mouth is
  //      0.43 m and his temple stands 0.36 m ahead of Sam's shoulder, so a muzzle pressed INTO the temple folds the arm double behind Sam's own ear — instead the
  //      forearm lies over the man's right shoulder and the can runs along his right temple a few centimetres off the skin, mouth just ahead of his brow, toed in
  //      and tipped down at his head: 'gun to his head' from the game's camera, and already pointing past him when it fires. Sam's head goes out to the LEFT here
  //      (the gun has the right). Directions are model-space [left, up, ahead] and get normalized on use.
  gun: {
    hand: [-0.20, 1.53, 0.15] as Vec3, bore: [0.21, -0.10, 0.97] as Vec3,        // at rest: wrist over his right shoulder, bore toed in ~12° and down ~6° across his temple
    outHand: [-0.24, 1.53, 0.17] as Vec3,                                         // presented to fire past him: a hand further out and forward, bore dead ahead at the aim's pitch (HoldPose.gunPitch)
    kickPitch: 6, kickBack: 0.03,                                                 // recoil: muzzle flip (°) and the hand coming back (m), ~35 ms up, ~0.2 s down (the drawn pistol rides the aim while the shot plays, like every carry's: keep the flip to what the wrist shows)
    viaA: [-0.42, 1.24, 0.06] as Vec3, viaB: [-0.40, 1.50, 0.02] as Vec3,         // the grab: the gun hand swung out wide to the right and up round him — never through his back
    viaBore: [0.1, 0.6, 0.8] as Vec3,                                             // …muzzle high while it travels
    windHand: [-0.36, 1.68, -0.04] as Vec3, windBore: [-0.15, 0.8, 0.58] as Vec3, // the whip: cocked back, up and out (muzzle skyward)…
    hitHand: [-0.10, 1.62, 0.15] as Vec3, hitBore: [0.5, 0.3, 0.8] as Vec3,       // …and brought down onto the skull behind his right ear (the frame just ahead of and below the wrist is what lands: it meets the bone, the boxes say so)
    thruHand: [-0.06, 1.50, 0.20] as Vec3,                                        // follow-through past the contact as he drops out of the arm (played on the layer's way out)
    lean: 5, side: -8, headYaw: 19, headPitch: 4,                                 // Sam: less chest on him; head carried out to the left, looking past the man's LEFT ear
    windYaw: -8, hitYaw: 5,                                                       // chest loading back to the right in the wind-up, coming through with the strike (°)
    clav: 7,                                                                      // right clavicle up with the raised gun arm (°)
    // the man, his own model space
    handsUp: [[0.27, 1.43, 0.31], [-0.34, 1.41, 0.29]] as Vec3[],                 // hands half raised in front of his shoulders, palms forward (the torch / pistol in the right points at the ceiling)
    aside: 13, awayYaw: 6, chinUp: -6,                                            // head tipped and turned away to his left off the can at his right temple, chin not so high
    duck: { yaw: 5, roll: 9, pitch: 10, hunch: 6, secs: 0.45 },                   // the flinch when a round goes past his ear (°, and how long it takes to come back)
    knock: { yaw: 24, roll: 16, pitch: 18 },                                      // the head going with the blow over the strike's last 0.1 s (seeds the ragdoll's head that way)
  },
};
/** the whip's shape inside HOLD.secs.whip: wound up by WIND, the strike leaving at STRIKE and ARRIVING at secs.whip (fast, like the kick meeting the door); the
 *  follow-through runs THRU past it while the layer eases out */
const WHIP_WIND = 0.36, WHIP_STRIKE = 0.42, WHIP_THRU = 0.14;
/** the hold's hand-over spring (both layers' eased share of the variant, 0 = arm ↔ 1 = gun, when E changes it mid-hold): at 14 it passes ½ — where the tools
 *  change hands behind the man's shoulder — about 0.12 s after the key and is all but across by HOLD.secs.swap */
const SWAP_RATE = 14;
/** which of takedown.ts's hold halves the two layers show where the pose itself does not say (HoldPose / HeldPose .kill / .beats, which win): takedownTick writes
 *  them once a frame — a frame late, and one table for every Game — the kill from the hold as a move of its own · the choke's beats. Off = that phase drawn as it was. */
/** the stalk's polish in the hold's table (the fourth pass: the shaped way in, the spring before the lunge, the sway, the room between the heads, the shallower
 *  arch), put DOWN — the numbers a recording from before it gets (journal.ts) and the page's ?stalkpolish=0 (stalk.ts stalkPolish), and what the table itself and the frozen stand have — or UP, to the page's */
const HOLD_POLISH_UP = { wayShape: true, catchShape: true, hitShape: true, layAhead: 0.9, dip: 0.06, back: 0.035, m: 0.014, twist: 2.4, side: 7, tip: 8, arch: -5 } as const;   // (THE PAGE'S NUMBERS — a tuned one goes here, not in the table: HOLD itself has them down, as the frozen stand does)
const HOLD_POLISH_DOWN = { wayShape: HOLD.wayShape, catchShape: HOLD.catchShape, hitShape: HOLD.hitShape, layAhead: HOLD.layAhead, dip: HOLD.lunge.dip, back: HOLD.lunge.back, m: HOLD.sway.m, twist: HOLD.sway.twist, side: HOLD.apart.side, tip: HOLD.apart.tip, arch: HOLD.yank.arch } as const;   // (the table's own, read once as this file loads: the one place the down numbers are written)
export function holdPolish(up: boolean) {
  const U = up ? HOLD_POLISH_UP : HOLD_POLISH_DOWN; HOLD.wayShape = U.wayShape; HOLD.catchShape = U.catchShape; HOLD.hitShape = U.hitShape; HOLD.layAhead = U.layAhead; HOLD.lunge.dip = U.dip; HOLD.lunge.back = U.back; HOLD.sway.m = U.m; HOLD.sway.twist = U.twist;
  HOLD.apart.side = U.side; HOLD.apart.tip = U.tip; HOLD.yank.arch = U.arch;
}
export const HOLD_SHOW = { kill: false, beats: false };
rollbackRoot('character.HOLD_SHOW', HOLD_SHOW);   // (written by takedownTick once a frame, read by the hold's layers on the next)
/** the kill's eased clock (hdKc / heKc): after the hold's own by a spring this stiff, its target led by the spring's lag so the cut lands where HOLD.kill.hit
 *  says; back out of a cancelled one at the slower rate */
const KILL_RATE = 40, KILL_BACK = 9;
/** the disarm's clock on the way IN (HOLD.strip, both layers' hand paths): the hand leaves gently and is at speed as it lands on the gun at `take` — past it, the clock itself */
const stripIn = (t: number, take: number): number => { if (t >= take) return t; const x = t / take; return take * x * x * (2 - x); };
function killEase(s: Spring, on: boolean, t: number, dt: number): number {
  return clamp(s.step(on ? clamp((t + 2 / KILL_RATE) / HOLD.secs.kill, 0, 1) : 0, on ? KILL_RATE : KILL_BACK, dt), 0, 1);
}
/** the rate (1/s) Sam's hold layer lets go at once the controller has: 16 as ever — but out of the kill, or a choke run to its end, he was down over the man
 *  with a hand on him, and comes up at HOLD.kill.after / HOLD.beats.after for as long as he stands IDLE; the first step takes it back to 16, and so does
 *  anything else he is told to do (`busy`: CharacterAnimator.holdBusy) — control is his the whole time, only the pose lingers. The arm variant's, each behind its half. */
function holdOutRate(last: HoldPose, speed: number, busy: boolean): number {
  if (busy || last.variant === 'gun') return 16;
  const slow = last.phase === 'kill' && (last.kill ?? HOLD_SHOW.kill) ? HOLD.kill.after : last.phase === 'choke' && last.t > 0.9 * HOLD.secs.choke && (last.beats ?? HOLD_SHOW.beats) ? HOLD.beats.after : 16;
  return slow === 16 ? 16 : lerp(slow, 16, smoothstep(0.1, 0.6, Math.abs(speed)));
}

export interface AnimParams { walkSpeed: number; jogSpeed: number; crouchSpeed: number; sprintSpeed: number; }
export const defaultAnimParams: AnimParams = { walkSpeed: 1.06, jogSpeed: 3.3, crouchSpeed: 0.72, sprintSpeed: 4.7 };
/** gait selection by ground speed (m/s), independent of the clips' natural speeds above: the walk cycle carries everything up to walkTop (fading in from a
 *  standstill over walkIn0‥walkIn1), the run takes over by jogAt (the guards' chase speed), the sprint clip from there to sprintSpeed */
export const BLEND = { walkIn0: 0.12, walkIn1: 0.55, walkTop: 1.6, jogAt: 2.7 };
/** how much of the run clip's pelvis bounce survives (its authored 23 cm crest-to-trough is twice a real jog's) */
export const BOB = { keep: 0.55 };   // (a field, not a bare const: the gait lab turns it live)
export const BOB_KEEP = 0.55;      // the authored default, for reference
/** the run clip's stride warp at a full jog: feet travel this fraction of the clip's fore-aft excursion (the cadence rises by its inverse to keep the ground speed);
 *  held right through the hand-off to the sprint (whose own feet are warped below), so the two blended runs' legs agree */
export const RUN_WARP = { stride: 0.62 };
/** the sprint clip's stride warp: Sprint_Loop is an all-out sprint — its planted toe sweeps back at 8.86 m/s mid-stance at rate 1 (tools/qa/gait.ts natural),
 *  ~8.2 averaged over the frames the toe is at the floor — played at sprintSpeed 4.7 with the cycle at rate s / 4.7, i.e. 3.0 steps/s at 4.7 m/s: a runner's
 *  cadence already, but a stride for nearly twice the ground, so every plant slid the foot a third of a metre back along the floor (gait.ts: slip 2.8 m/s,
 *  drift 0.33 m). Its ankles travel this fraction of the clip's fore-aft excursion about the gait's middle — 4.7 over that floor-level sweep, where gait.ts's
 *  driven slip bottoms out (0.10 m/s, drift 1.3 cm; 0.53 = 4.7 / 8.86 holds the deepest instant instead and reads 0.26) — at the clip's own cadence: the rate
 *  is NOT raised by 1/K as the jog's is, the sprint's cadence was right and its stride was not. A taste knob: larger = a longer leg for that much slide
 *  (0.65 slides 0.5 m/s, unwarped 1.0 was the 2.8). */
export const SPRINT_WARP = { stride: 0.57 };
/** the run's stance linger. Even stride-warped, the jog's planted toe sweeps back at ~1.8× the ground it is played over (the warp keeps the cadence, so the
 *  foot's speed through its ~15 % of stance is what the clip's 5.9 m/s bound gave it: gait.ts slip 2.0 m/s at 3.3, 2.2 at the guards' 2.7 chase), so:
 *  - the cycle is SAMPLED at a phase that dwells over each plant and hurries through the flights — rate 1 − depth at mid-stance, 1 + depth mid-flight, flat
 *    about both (a cos θ − cos 3θ ⁄ 9 wave, θ twice a cycle), mean 1, so cadence, stride and anything keyed to `phase` are untouched — which brings the
 *    stance foot down to about the ground's speed and holds it there for a quarter of the cycle instead of a seventh (the crouch's deliberate linger is
 *    the same re-timing with a sine and a body surge; this one wants no surge — the slow-down IS the correction);
 *  - and through each foot's stance window (coming on across heel-strike, full through mid-stance, let go as the toe peels off) the stance toe is put on
 *    the floor and carried back at exactly the ground's speed (runPlant: the leg re-solved under it, sole and knee plane as authored), taking out what
 *    the re-timing leaves — the few centimetres it ends up off the cycle's own toe ride into the swing and bleed away there.
 *  Both go by the jog's share of the pose (the sprint's own warp already holds the floor at 4.7; the walk needs none). `depth` sizes the re-timing and SWITCHES
 *  the pin — any depth > 0 has the pin at its full weight, depth 0 = both off = the cycle as it was, so the lab's 'stance linger 0' is an honest before/after
 *  (gait.ts states at depth 0 → 0.42, jog 3.3 / chase 2.7: slip 1.9 / 2.2 m/s → 0.03 / 0.07, stance 5 / 3 % → 22 %, cadence and stride unchanged; the pin
 *  alone with no re-timing read 0.08 / 0.13). The soft knee (SOFT_KNEE) rides the same jog share but is its own layer with its own switch. */
export const RUN_LINGER = {
  depth: 0.42,
  on: [-0.085, -0.04] as [number, number],   // the pin comes on across heel-strike (phase off mid-stance: the toe 3 cm up → on the floor)…
  off: [0.065, 0.105] as [number, number],   // …and lets go as the toe peels off (still down at +0.065, 7 cm up by +0.105), so it leaves the floor at the floor's speed
  bleed: 0.09,                               // s: the fore-aft offset the toe is left holding at toe-off decays with this time constant up the swing (gone by the next strike)
};
/** gaze stabiliser: target eye-line elevation below level per gait (°), the share of the pitch error taken out, and of the fast yaw wobble */
export const GAZE_EL = { stand: 4, crouch: 9, sprint: 12 }; export const GAZE = { keep: 0.8, yawDamp: 0.7 };   // walk / crouch = the clips' MEASURED natural ground speed (tools/qa/gait.ts: the planted toe's backward velocity — 1.06 and 0.72 m/s; the old 1.45 / 1.05 skated the planted foot 37 % / 46 % of every stride); jog / sprint sit near their clips' excursion-matched speeds already
/** A MAN WHO HAS RUN BREATHES HARD, AND IT SHOWS (the maintainer, 10-19: "characters should breathe more forcefully when sprinting (e.g. on snow levels)").
 *  The game had two breaths and no third: the chest's (the life layer below) and, on a snow level, the steam off the mouth (snowBreath.ts). There is no breath
 *  SOUND and none is made here. With `on`, both of the two are stronger with effort — a sprint, and the while after it — and neither is touched at rest:
 *    THE CHEST (lifeLayer): blown he heaves `chestAmp` × the resting turn at `chestRate` Hz (it was LIFE.breathAmpRun 2.6 at breathRateRun 0.62), is blown in
 *      `chestUp` s of a run past 3.2 m/s (it was 4) and has his wind back in `chestDown` s (it was 8). Running, the gait still carries the chest as it did.
 *    THE STEAM (snowBreath.ts, picture only): blown he breathes every `every` s (it was SNOWBREATH.everyHard 1.3), each breath `puffs` records of `count`
 *      puffs (3 of 5) thrown at `jet` × the resting speed (1.3) and `size` × its size (hardK 1.5; its opacity is full from half effort either way), leaving with `carry` of his own velocity (0.6);
 *      blown in `up` s (effortUp 4), his wind back in `down` s (effortDown 12). Each is the resting number at effort 0 and this one at 1, straight between.
 *  Effort is what it was: his ground speed and nothing else (no stamina exists and none is made); a teammate never sprints: at his fastest walk (2.2 m/s, a little over where effort begins) his steam is a seventh of the way to blown, and his chest's is the resting one (it wants 3.2 m/s).
 *  OFF here and on the frozen stand (TPS_HARDBREATH=1); ON in the page (?hardbreath=0). Check: tools/qa/hardbreath-check.ts (HARDBREATH_BREAK=1). */
export const HARDBREATH = { on: false, chestAmp: 4.2, chestRate: 0.9, chestUp: 2.5, chestDown: 12, every: 0.95, puffs: 4, count: 9, jet: 3.2, size: 2.0, carry: 0.85, up: 2.5, down: 14 };
/** The life layer's and the foot lock's amplitudes and timings — fields, so the gait lab (src/gaitlab.ts, /gait) can turn them with the figure in view.
 *  `on` scales the whole life layer (0 = the pose as the clips have it); every default here is the authored value. */
export const LIFE = {
  on: 1,
  breathRate: 0.25, breathRateRun: 0.62,   // Hz at rest → after hard running
  breathAmp: 1, breathAmpRun: 2.6,         // × the chest / shoulder breathing turns (≈ 1° at rest)
  massGain: 0.011, massBack: 0.035, massFwd: 0.03, massDip: 0.004, massDipMax: 0.025,   // pelvis fore-aft offset per m/s² (clamped back / forward), and the dip
  tipGain: 0.9, tipBack: 5, tipFwd: 6,     // trunk tip ° per m/s², clamps
  restAfter: 1.6, shiftMin: 4, shiftSpan: 5, shiftTravel: 0.028, shiftIn: 3.2, shiftOut: 9,   // weight shift: still this long before it starts (s), period min + span (s), pelvis travel (m), spring rates in / out
  hipDrop: 2.2, spineCounter: 1.4, neckCounter: 0.6,   // ° per unit shift
};
/** the toe bone's height with the sole flat on the floor: the mesh's sole is 1.47 cm under the toe bone in bind pose, and the standing idle rides the toe
 *  bone at 1.5 cm — i.e. on the floor. Anything that 'floors' a foot floors the toe bone to THIS, not to 0 (that sinks the shoe 1.5 cm into the slab). */
export const TOE_FLOOR_Y = 0.0147;
/** Soft knee: the run clip's push-off key has the leg dead straight (knee 180° at key 0, the other leg at the half cycle) and linear key interpolation
 *  makes that a corner — the knee bangs into lock for a frame and folds at ~1000°/s straight after: the 'keyframe where the knee spazzes'. Past `from`
 *  of the leg's full length the hip→ankle reach is eased so it approaches `to` asymptotically instead (an IK re-solve of the leg toward the same ankle,
 *  pulled in a centimetre or two along hip→ankle); the foot's orientation is kept. Applied to the assembled run pose with the run's weight. */
export const SOFT_KNEE = { on: 1, from: 0.95, to: 0.985 };
/** The walk clip is sampled this far ahead of the shared locomotion phase so its foot plants line up with the jog's (measured left mid-stance: Walk_Loop
 *  0.337, Jog_Fwd_Loop 0.117, Sprint_Loop 0.148 of a cycle). The walk↔jog blend at 2–3 m/s (a jogging player, a chasing guard) is joint by joint; out of
 *  phase by 0.22 of a cycle it mixed the walk's mid-stance leg with the jog's dead-straight push-off leg and the knee came out 25 cm sideways for a frame,
 *  twice a cycle — the knee 'spazzing' at jog and chase speeds (tools/qa: knee 19–22 cm lateral jump/frame at 2.4–2.7 m/s, 4 cm at 3.3, 1.7 at a walk). */
export const WALK_PHASE = 0.22;
export const FEET = { on: 1, swing: 0.22, lift: 0.045, dist: 0.11, turnDeg: 26, pivot: 2.2, lagCapDeg: 55 };   // the standing foot lock: step duration (s), arc height (m), re-step distance (m) / body turn (°), planted-sole pivot rate (rad/s), max lag behind the body (°)

const N = {
  hips: 'DEF-hips', spine1: 'DEF-spine.001', spine2: 'DEF-spine.002', spine3: 'DEF-spine.003', neck: 'DEF-neck', head: 'DEF-head',
  upperArmL: 'DEF-upper_arm.L', forearmL: 'DEF-forearm.L', handL: 'DEF-hand.L', upperArmR: 'DEF-upper_arm.R', forearmR: 'DEF-forearm.R', handR: 'DEF-hand.R',
  thighL: 'DEF-thigh.L', shinL: 'DEF-shin.L', footL: 'DEF-foot.L', toeL: 'DEF-toe.L', thighR: 'DEF-thigh.R', shinR: 'DEF-shin.R', footR: 'DEF-foot.R', toeR: 'DEF-toe.R',
  shoulderL: 'DEF-shoulder.L', shoulderR: 'DEF-shoulder.R', middle1R: 'DEF-f_middle.01.R', middle1L: 'DEF-f_middle.01.L',
};
const DEGR = Math.PI / 180;
/** a goggle nod shown as a LIFT of the head (the look under a door: nodLift's reader): as big less a little whichever way the nod went, and smooth through nothing */
const nodLift = (n: number) => 2 * DEGR - Math.hypot(n, 2 * DEGR);
const AX: Vec3 = [1, 0, 0], AY: Vec3 = [0, 1, 0], AZ: Vec3 = [0, 0, 1];
/** model-axis rotations: pitch (+ = bow forward), yaw (+ = turn to the figure's left), roll (+ = left shoulder up) */
const qPitch = (a: number) => quat.axisAngle(AX, a), qYaw = (a: number) => quat.axisAngle(AY, a), qRoll = (a: number) => quat.axisAngle(AZ, a);

/** STEALTH POSES (game/stealthpose.ts → CharacterAnimator.stealthLayer / stealthPicture): Sam's hands-empty crouch. Places in his own frame (left, up, forward —
 *  metres) for the LEFT arm, the right mirrors `left`. `idle`: each wrist hangs `fwd` in front of its own knee (never behind the front knee + `lead`), `below` the
 *  higher knee and no lower than `floor`, `out` beside the knee; `walk`: the forward hand (opposite the forward foot, read off the feet `stride` apart) goes to
 *  `fwd` off the knees, the other to `back` off its own shoulder, elbow behind him (`tuck`), eased at `rate`; `creep`: the free hand's lead off the front knee, low; `cable`: the look under
 *  a door (the POSE itself: `bones`, the capsules and his eye go down with him) — pelvis `sink`, shoulders `round`ed in (°), the right wrist at `gap` (x, height; `short` of the leaf), the left by its
 *  knee (`knee`), body out over `out` s and the head over `headOut`, the gaze kept `ahead` m in front of the head (never straight down). `inSecs` / `outSecs`: the arms' weight, a straight ramp shown through a smoothstep (no first-frame jump either way). First-pass numbers placed against stick strips. */
const STEALTH = {
  inSecs: 0.4, outSecs: 0.27, round: 10,
  idle: { out: 0.05, below: 0.1, fwd: 0.11, lead: 0.05, floor: 0.2, pole: [0.8, -0.05, -0.6] as Vec3, fing: [-0.12, -0.9, 0.4] as Vec3, back: [0.45, 0.25, 0.85] as Vec3, curl: 0.2, thumb: 0.15, spread: 0.3 },
  walk: { stride: 0.6, rate: 12, fwd: [0.0, -0.02, 0.18] as Vec3, back: [0.05, -0.3, -0.26] as Vec3, flarePole: 0.5, tuck: 0.55 },
  rise: { down: 5 },
  creep: { at: [-0.04, -0.2, 0.27] as Vec3, floor: 0.22, rate: 9, swing: 0.25 },
  cable: { sink: 0.05, round: 15, gap: [-0.07, 0.11] as [number, number], short: 0.1, knee: [0.07, -0.05, 0.1] as Vec3, out: 0.45, headOut: 0.18, undo: 28, ahead: 0.3, nodMax: 82 },
};
/** Critically damped follower (value + velocity): unlike damp() it also eases IN, so a posture change starts as softly as it ends. w ≈ 6 / settle time. */
class Spring {
  v = 0; constructor(public x = 0) {}
  step(target: number, w: number, dt: number) { const y = this.x - target, j = this.v + y * w, e = Math.exp(-w * dt); this.x = target + (y + j * dt) * e; this.v = (this.v - j * w * dt) * e; return this.x; }
}
/** The choke's lowering (HOLD.lower) on its way down follows its clock; let go of (the choke eased off, the half switched off) it comes back up on a spring of
 *  its own, `up` 1/s — the choke's own clock is back at rest in a tenth of a second, and nobody stands up out of a squat that fast. */
function lowerEase(s: Spring, target: number, up: number, dt: number): number {
  if (target >= s.x) { s.x = target; s.v = 0; return target; }
  return Math.max(target, s.step(target, up, dt));
}
/** The haul's amount (HOLD.haul): the choke's own curve while it runs — its in and its out are eased already, and past the out it is exactly nothing —
 *  and let down on a spring, `down` 1/s, when the choke is let go of in the middle of one. */
function haulEase(s: Spring, on: boolean, target: number, down: number, dt: number): number {
  if (on) { s.x = target; s.v = 0; return target; }
  if (s.x <= 1e-4) { s.x = 0; s.v = 0; return 0; }
  return Math.max(0, s.step(0, down, dt));
}
/** One hand-animated channel of a one-shot: Catmull-Rom through (time s, value) keys — passes through every key with a continuous slope (no stop-start at the
 *  keys, a little natural overshoot between them), flat at the first and last key, clamped outside. */
type Keys = readonly (readonly [number, number])[];
function curve(t: number, K: Keys): number {
  const n = K.length; if (t <= K[0][0]) return K[0][1]; if (t >= K[n - 1][0]) return K[n - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const t0 = K[i][0], p0 = K[i][1], t1 = K[i + 1][0], p1 = K[i + 1][1]; const h = t1 - t0, u = (t - t0) / h;
  const m0 = i > 0 ? (p1 - K[i - 1][1]) / (t1 - K[i - 1][0]) : 0, m1 = i + 2 < n ? (K[i + 2][1] - p0) / (K[i + 2][0] - t0) : 0;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * h * m1;
}
/** the same spline for a keyed model-space vector (hand paths, palm / finger directions): one segment search, Catmull-Rom per component */
type Keys3 = readonly (readonly [number, readonly number[]])[];
function curve3(t: number, K: Keys3): Vec3 {
  const n = K.length; if (t <= K[0][0]) { const p = K[0][1]; return [p[0], p[1], p[2]]; } if (t >= K[n - 1][0]) { const p = K[n - 1][1]; return [p[0], p[1], p[2]]; }
  let i = 0; while (t > K[i + 1][0]) i++;
  const t0 = K[i][0], t1 = K[i + 1][0], P0 = K[i][1], P1 = K[i + 1][1], Km = i > 0 ? K[i - 1] : null, Kp = i + 2 < n ? K[i + 2] : null;
  const h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
  const a = 2 * u3 - 3 * u2 + 1, b = (u3 - 2 * u2 + u) * h, c = 3 * u2 - 2 * u3, d = (u3 - u2) * h;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const m0 = Km ? (P1[k] - Km[1][k]) / (t1 - Km[0]) : 0, m1 = Kp ? (Kp[1][k] - P0[k]) / (Kp[0] - t0) : 0;
    out[k] = a * P0[k] + b * m0 + c * P1[k] + d * m1;
  }
  return out;
}
/** sampleClip(clip, 0, false, out) for the clips the aim layer samples there every frame: that call writes fixed numbers (each track's first key, read off the clip alone —
 *  a sample never reads the pose it writes) into fixed slots, so they are found once per clip — sampled into a pose of NaNs: a slot still NaN afterwards is one the clip
 *  does not key — and replayed: the same floats into the same slots, the rest of `out` left as it stands, exactly as the sample leaves it. */
const AT0 = new SideMap<Clip, { at: Int32Array; v: Float32Array }>('character.AT0'); AT0.asMemo();   // (read off the clip alone, a thing of the character file every game shares)
function sampleAt0(clip: Clip, out: Pose) {
  let e = AT0.get(clip);
  if (!e) {
    const p = new Pose(out.numNodes); p.data.fill(NaN); sampleClip(clip, 0, false, p);
    const at: number[] = []; for (let i = 0; i < p.data.length; i++) if (p.data[i] === p.data[i]) at.push(i);
    e = { at: Int32Array.from(at), v: Float32Array.from(at, i => p.data[i]) }; AT0.set(clip, e);
  }
  const d = out.data, at = e.at, v = e.v; for (let k = 0; k < at.length; k++) d[at[k]] = v[k];
}
/** `p` with the difference between two poses laid on it by w: each joint turned on, in its own frame, by what takes `from` to `to` (from⁻¹ · to, the shortest
 *  way, eased from none by w), its origin moved by their difference; scales left as p's. `only`: the joints it is done for (any share at all — the caller's own
 *  masked blend takes the share, as it does of a blended clip); the rest are skipped. Where p is `from` this is blendPose(from, to, w) on those joints but for
 *  rounding. (MOVES.snap: a clip's recoil onto a pose the clip was not keyed from.) */
function addPoseDelta(p: Pose, from: Pose, to: Pose, w: number, only: Float32Array) {
  if (w <= 0) return;
  const P = p.data, A = from.data, B = to.data;
  for (let i = 0, n = p.numNodes; i < n; i++) {
    if (only[i] <= 0) continue;
    const o = i * 10; for (let c = 0; c < 3; c++) P[o + c] += (B[o + c] - A[o + c]) * w;
    const ax = -A[o + 3], ay = -A[o + 4], az = -A[o + 5], aw = A[o + 6], bx = B[o + 3], by = B[o + 4], bz = B[o + 5], bw = B[o + 6];
    let dx = aw * bx + ax * bw + ay * bz - az * by, dy = aw * by - ax * bz + ay * bw + az * bx, dz = aw * bz + ax * by - ay * bx + az * bw, dw = aw * bw - ax * bx - ay * by - az * bz;
    if (dw < 0) { dx = -dx; dy = -dy; dz = -dz; dw = -dw; }
    dx *= w; dy *= w; dz *= w; dw = 1 + (dw - 1) * w;
    const px = P[o + 3], py = P[o + 4], pz = P[o + 5], pw = P[o + 6];
    const x = pw * dx + px * dw + py * dz - pz * dy, y = pw * dy - px * dz + py * dw + pz * dx, z = pw * dz + px * dy - py * dx + pz * dw, ww = pw * dw - px * dx - py * dy - pz * dz;
    const l = hyp4(x, y, z, ww) || 1; P[o + 3] = x / l; P[o + 4] = y / l; P[o + 5] = z / l; P[o + 6] = ww / l;
  }
}
/** IK pole for an arm from a swivel angle: the direction square to the shoulder→hand offset `h` at angle `psi` in the basis (b1 = `ref` made ⊥ h, b2 = ĥ × b1).
 *  `ref` is a fixed direction the hand never points along (or against), so the basis — and with it the elbow — turns continuously wherever the hand goes. */
function swivelPole(h: Vec3, ref: Vec3, psi: number): Vec3 {
  const hn = v3.normalize(h); const b1 = v3.normalize(v3.mad(ref, hn, -v3.dot(ref, hn))); const b2 = v3.cross(hn, b1);
  return v3.mad(v3.scale(b1, Math.cos(psi)), b2, Math.sin(psi));
}
/** those references for the right / left arm: across the body, a little up and back — ≥ 44° off every bearing either hand takes in the clips and layers here */
const SWIV_REF_R: Vec3 = [0.92, 0.276, -0.276], SWIV_REF_L: Vec3 = [-0.92, 0.276, -0.276];
/** cubic Hermite segment with explicit end slopes (a one-shot phase that must arrive at speed — the kick meeting the door — instead of easing in) */
function hermite(t: number, t0: number, p0: number, m0: number, t1: number, p1: number, m1: number): number {
  const h = t1 - t0, u = clamp((t - t0) / h, 0, 1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * h * m1;
}
/** smooth 0→1→0 window: rises over [a,b], falls over [c,d] (smoothstep flanks) */
const bump = (t: number, a: number, b: number, c: number, d: number) => smoothstep(a, b, t) * (1 - smoothstep(c, d, t));

/** The continuous shape a stance drives toward (springs interpolate between these, so high ↔ low ↔ stack morph instead of cross-fading through the base pose).
 *  Hand offsets are from the chest joint (spine.003) along MODEL axes — the gun is carried relative to the body but kept level in the world, so a crouched or
 *  leaning torso does not point it at the floor. Angles in degrees here, converted on use. */
interface StanceShape {
  fwd: number; up: number; side: number;   // right-hand (gun hand) position: m ahead of / above / to the figure's left of the chest joint
  pitch: number;                           // muzzle elevation (+ up)
  lean: number;                            // forward lean spread over the three spine joints
  headPitch: number;                       // + = chin down (after the lean is countered: the head stays level on target by itself)
  tuck: number;                            // 0 elbows where the mocap leaves them … 1 pulled down and in against the ribs
  blade: number; headYaw: number;          // stack only, mirrored by stackSide: pelvis yaw toward the wall (upper spine counters ⅔ of it), head yaw toward the door
  squat: number;                           // m the pelvis settles onto bent knees (feet stay planted)
}
/** The back-to-the-wall hold's numbers (wallBody / wallArms; the game's Q) — the one place to tune its pose from. Its frame is the WALL, not the legs: distances
 *  are off the wall PLANE into the room (the figure's root stands WALL_ROOT_OFF = 0.45 off it; the controller says which way the wall faces each frame,
 *  anim.wallYaw: square behind him parked, up to 55° round while the legs are turned to sidle), 'along' / 'toward side' is along the wall the way stackSide says
 *  he looks, leads and peeks, angles are degrees. Reading joint distances against the mannequin's flesh (measured off the skinned mesh): the seat is ≈ 0.10
 *  behind the hips joint, the shoulder blades ≈ 0.16 behind the chest joint (spine.003), the back of the skull ≈ 0.15 behind the head joint, a heel 0.06 behind
 *  its ankle, a flat palm ≈ 0.04 off its wrist — so 'back on the wall' is hips ≈ 0.12 and chest ≈ 0.16 off the plane, and the JOINTS' line up the back leans a
 *  few degrees toward the room while the flesh line is plumb against the plaster. The hands are always free here: the game holsters the pistol for the hold. */
const WALL_GAIT_REST = 0.55;   // the step clock at rest: the left sole near the end of its bearing, the right just down — the feet apart, each on its own side (either way he looks)
/** anim.lean at 1: `deg` ° of side-bend over spine1‥3 (the head goes about a hand and a half across, the gun with it), `level` of it taken back out at the
 *  neck and head, eased at `rate` /s */
export const LEAN_POSE = { deg: 28, level: 0.5, rate: 9 };
export const WALL_POSE = {
  /** hips joint off the plane (m): parked standing (the seat a finger off the plaster), parked crouched, sidling (the walking legs want the pelvis nearer them) */
  back: [0.135, 0.125, 0.21] as [number, number, number],
  /** the spine's line (spine.001 → neck) off vertical toward the room (°), standing / crouched: + lays this mannequin's deeper upper back ON the wall above a seat
   *  that is on it too (the squat's straighter pelvis wants a little more to bring the blades out of the plaster) */
  lean: [4.5, 7] as [number, number],
  /** pelvis settled onto soft knees (m): standing, crouched (over the crouch clip's own squat) */
  drop: [0.03, 0.02] as [number, number],
  /** chest let round toward the lead side (°) — a small counter-turn under the turned head; the shoulder line stays within a few degrees of the wall */
  chestTurn: 8,
  /** head yaw off the wall normal toward the lead side (°): looking along the wall the way he is going; and chin down a touch (°) */
  gaze: 58, headPitch: 3,
  /** parked ankle spots [along the wall from the root toward the lead side (m), off the plane (m), toes opened toward that side (°)]; lead = the lead side's foot.
   *  Standing: heels a hand off the wall, the feet a foot-length apart, the lead foot a little forward and opened the way he looks. Crouched: a compact squat, the
   *  feet under the knees a little out from the wall, thighs together; the trail foot keeps this share of the crouch clip's raised heel (0 = flat). */
  feet: { lead: [0.16, 0.21, 25] as Vec3, trail: [-0.14, 0.16, 8] as Vec3, leadCrouch: [0.19, 0.31, 30] as Vec3, trailCrouch: [-0.15, 0.27, 12] as Vec3, trailHeel: 0.5 },
  /** sidling: the walk cycle's footfalls are pulled toward a line this far off the plane (m) by this share of their spread across it — a narrower shuffle under a
   *  body that stays on the wall; ALONG the wall they are untouched (the planted foot keeps the ground's speed: no skate added) */
  slide: { line: 0.36, narrow: 0.6 },
  /** the hands, palms flat back against the wall 'feeling' it: wrists ± this far along from the hips joint (standing / crouched), this far above it (standing /
   *  crouched), this proud of the plane (the palm's thickness), fingers pointing down and this much out along the wall; the lead hand drawn in this far at
   *  full peek (its palm stays on the plaster short of the corner) */
  hands: { along: 0.25, alongCrouch: 0.29, up: 0.02, upCrouch: 0.12, off: 0.06, out: 0.35, peekIn: 0.10 },
  /** elbow pole: out along the wall, a little into the room (never into the plaster), a little down — soft elbows close to the body */
  elbow: { out: 0.9, room: 0.35, down: 0.3 },
  /** the corner PEEK at wallPeek 1 — the tuned lean-out, kept as it was: the spine side-bent toward the edge (°), the pelvis carried along the wall onto the lead
   *  foot (m) and tipped 3° with it, and — REPLACING chestTurn / gaze / lean as the peek comes in — the chest round toward the edge (°), the head's yaw off the
   *  normal (°; the controller cranes the neck WALL_PEEK_LOOK further and swings the camera out), the spine's tilt toward the room (°: rolling out on the look-side
   *  shoulder blade brings the spine off the wall a hand) */
  peek: { lean: 19, shift: 0.09, turn: 26, gaze: 70, tilt: 7 },
  // ---- THE CROUCHED HOLD, MENDED (WALLSNAP.pose, on with the feel pass; off = every number above alone). Two faults read off the maintainer's recording:
  //      the wrists pinned a hand over the hips folded the arms to 75° and winged the elbows 0.8 m apart, and the turned crouch cycle on the move left the
  //      wall-side foot clamped at the face with its shin flat on the floor, the other half a metre out in the room, both skating.
  /** the hands with the mend on: metres out along the wall from the hips and above the hip joint (standing / crouched), the elbow's pole (as `elbow`) */
  mend: { along: [0.24, 0.235] as [number, number], up: [0.0, 0] as [number, number], elbow: { out: 0.5, room: -0.3, down: 0.2 }, splay: 0.08, sway: 0.025,
    /** the HANDS (the maintainer's still of the standing hold from above: two fanned gloves out at his hips). Fingers together (`fan`: the knuckles' spread, − = closed
     *  from the rest hand's own fan), a resting hand's small curl index → little, the thumb turned up into the palm's plane (`thumbIn`°
     *  about the fingers' axis, the door hand's own turn: at rest it hangs palm-ward of the hand, which with the palm to the wall is IN the plaster); with `up` at the hip joint, no higher, the arms hang nearly
     *  straight, the elbows back toward the plaster (`elbow.room` < 0), not cocked out into the room */
    fan: -0.3, curl: [0.1, 0.12, 0.16, 0.22] as readonly number[], thumb: 0.1, thumbIn: 40 },
  /** THE SIDLE'S OWN STEP (by `share`, standing / crouched: 0 = the turned clip's feet, as they were): a SIDE step — the lead side's foot reaches and plants,
   *  the other closes up to it and does not pass it. Each foot has its own side of him along the wall (`apart` m from the hips: the right foot to his right, the
   *  left to his left) and its own track off the face (the lead side's foot on `near`, the other on `far`; ankle, m; standing / crouched); steps of `step` m on a
   *  clock of the hold's own (ground speed over the step, so a planted sole stays where it is planted), each sole down for `duty` of its cycle, travelling
   *  duty × step either way of its own place (+ `ahead` toward the lead side, both feet). The ankles are 2 × apart − step apart along the wall at the closest
   *  (keep apart ≥ step / 2: closer and they cross) and 2 × apart + step at the widest. Lifted `lift` m in the swing, the heel up `heel` degrees as it trails;
   *  toes `toe` degrees round from square-out toward the lead side (the trail foot half that); knees poled `kneeRoom` of the way from the legs' own facing to
   *  square-out; the pelvis carried level at `hips` m (before the hold's drop) with `bob` m of dip at each double support. */
  gait: { share: [1, 1] as [number, number], step: [0.36, 0.34] as [number, number], duty: 0.6, ahead: [0.02, 0.05] as [number, number], apart: [0.21, 0.22] as [number, number],
          near: [0.17, 0.2] as [number, number], far: [0.3, 0.36] as [number, number], lift: [0.07, 0.06] as [number, number], heel: [22, 24] as [number, number],
          toe: [40, 30] as [number, number], kneeRoom: [0.2, 0.45] as [number, number], hips: [0.875, 0.5] as [number, number], bob: [0.02, 0.012] as [number, number] },
};
const STANCES: Record<Exclude<Stance, 'none'>, StanceShape> = {
  highReady: { fwd: 0.25, up: 0.15, side: -0.05, pitch: 8, lean: 7, headPitch: 2, tuck: 0.85, blade: 0, headYaw: 0, squat: 0.015 },
  lowReady: { fwd: 0.30, up: -0.215, side: -0.07, pitch: -42, lean: 3, headPitch: 1, tuck: 0.3, blade: 0, headYaw: 0, squat: 0 },
  stack: { fwd: 0.19, up: 0.13, side: -0.03, pitch: 22, lean: 9, headPitch: 4, tuck: 1, blade: 22, headYaw: 14, squat: 0.07 },
  // the wall hold poses itself from WALL_POSE (wallBody / wallArms); these are only the shared spring channels a stack ↔ wall cross-fade morphs the CARRY through
  // (the player never shows them: his hold comes and goes from 'none', under the master weight alone)
  wall: { fwd: 0.19, up: 0.13, side: -0.03, pitch: 22, lean: WALL_POSE.lean[0], headPitch: WALL_POSE.headPitch, tuck: 1, blade: 0, headYaw: 0, squat: 0 },
};
/** the wall hold's frame: how far off the wall plane the figure's root stands (player.ts: BODY_R + WALL_GAP = 0.42 + 0.03). Which way the wall faces is not
 *  assumed — the controller says so each frame (anim.wallYaw), since it turns the legs away from flat to sidle. */
const WALL_ROOT_OFF = 0.45;
/** The long gun's carriages (rifles, docs/internal/sc20k-design.md §3.2 — the guards' carbine today, Sam's SC-20K on the same solve later). The weapon hangs off the
 *  RIGHT hand (rigProps draws it along Character.gunDir from bones.handR, as it draws the pistol), so a carriage is: where the trigger hand's WRIST sits off the chest
 *  joint along MODEL axes (m: side + = the figure's left, up, fwd — off the chest joint and not the shoulder, so the walk's shoulder swing and the crouch's hunch never
 *  reach the weapon: only the trunk's own centimetre of bob does, as with the pistol carries) — or, by `anchor` (0 → 1), off the gun SHOULDER joint instead, for the
 *  carriage that fires: the trigger hand then keeps station on the shoulder whatever clip is under it, so the bore runs down the shoulder's own line to the target,
 *  which is the line the AI reads (guards.ts clearShot) — and the point swings about the shoulders with the aim's share of the pitch either way, as an arm pointing
 *  up or down carries the hand; which way the bore points — a pitch of its own (°, + up) plus `aimK` of
 *  the character's aim pitch (1 = the light on the gun goes exactly where the AI points it, 0 = a fixed carry) and a yaw off the chest's heading (°, + = muzzle to the
 *  figure's left; the chest twist toward the aim turns the whole carriage as it turns the pistol's); how the trunk sets to it — the upper spine bladed (°, − = gun
 *  shoulder back, taken back out at the neck so the eyes stay on the heading) and leant; the head on the stock (°: yaw − = toward the gun shoulder, pitch + = down,
 *  roll + = ear to the stock); which way each elbow heads (model-space directions for the IK's swivel, and how hard it is held there); how much of the carry's
 *  idle sway shows; and `steady` (0 → 1): how much of the trunk's side-to-side rock in the gait is kept OUT of the trigger hand's point for a figure that steadies
 *  its long gun (CharacterAnimator.longSteady — Sam; the arms take the rock up and the gun rides the shoulders' mean line, LONG_STEADY). The SUPPORT hand is not
 *  placed by the shape at all: it is solved onto the weapon's handguard point (CharacterAnimator.longGrip, from RIG.carbine)
 *  from wherever the trigger hand actually got to, so the two hands cannot part — and if that reach is beyond the support arm on some torso, the gun comes back to
 *  where it can be held (longArms). Springs morph between the four exactly as the pistol stances' do. First-pass numbers off the mannequin's measured joints (upper
 *  arm 0.274, forearm 0.273: 0.55 of reach from each shoulder joint); the viewer is where they get tuned. */
export interface LongShape {
  side: number; up: number; fwd: number; anchor: number;
  pitch: number; aimK: number; yaw: number;
  blade: number; lean: number;
  headYaw: number; headPitch: number; headRoll: number;
  elbowR: Vec3; elbowL: Vec3; poleW: number;
  sway: number; steady: number;
}
export const LONG: Record<LongStance, LongShape> = {
  // calm patrol: both hands on, the gun low and close across the front — trigger hand ahead of the right hip pocket, muzzle down along the aim's own dip (the AI hangs a
  // calm man's aim 20° down: with the 8° here the light pools on the floor a couple of metres out, where the hand torch's does) and a touch left, shoulders bladed to it
  patrolLong: { side: -0.245, up: -0.16, fwd: 0.13, anchor: 0, pitch: -42, aimK: 0, yaw: 20, blade: -8, lean: 0, headYaw: 0, headPitch: 0, headRoll: 0, elbowR: [-0.45, -1, -0.5], elbowL: [0.35, -1, -0.3], poleW: 0.65, sway: 1, steady: 0.5 },   // (maintainer's hand offsets from the viewer; then slung LOW: belly height, muzzle 42° into the floor whatever the aim does, 20° across the body — a calm carry, not the pistol's two-hand ready with a rifle in it)
  // the long-gun low ready (a colleague in the line, the drill's formations; the player's SPRINT with the rifle): stock up at the shoulder, muzzle put 40° into the floor whatever the aim does, elbows in
  lowLong: { side: -0.165, up: -0.085, fwd: 0.2, anchor: 0.05, pitch: -40, aimK: 0.05, yaw: 24, blade: -10, lean: 2, headYaw: 0, headPitch: 2, headRoll: 0, elbowR: [-0.55, -1, -0.35], elbowL: [0.4, -1, -0.1], poleW: 0.75, sway: 0.25, steady: 1 },   // (maintainer's viewer pass, 08-08; sway 0.6 → 0.25 and steadied for the player's run with it)
  // shouldered: stock in the pocket, bore dead on the aim (yaw AND pitch: the drawn weapon, its light and the shot all follow Character.aimDir there), support arm long
  // under the handguard, firing elbow lifted, cheek toward the comb, leaning into it — over the aim clip's trunk whoever asks for it (update(): a shouldered long gun IS
  // the aim). Anchored on the gun SHOULDER (anchor 1: the wrist 27 cm dead ahead of that joint along the aim, whatever the aim clip does with the shoulders):
  // the AI reads its line of fire shoulder → target (guards.ts clearShot) and the round flies muzzle → target — one line, as with the pistol at arm's length, or a
  // jamb the shoulder clears takes every round (the soak's man planted at the break-room door firing into the leaf for six seconds)
  shoulder: { side: -0.15, up: -0.015, fwd: 0.255, anchor: 0.5, pitch: -2, aimK: 1, yaw: 0, blade: -36, lean: 4, headYaw: -10, headPitch: 6, headRoll: 7, elbowR: [-0.8, -1, -0.2], elbowL: [0.6, -1, 0.35], poleW: 0.6, sway: 0.1, steady: 1 },   // (maintainer's viewer pass 08-09: nearer in and further inboard, anchored half way between chest and gun shoulder; then sway 0.3 → 0.1 and fully steadied: the player carries it here whenever it is in his hands)
  // high port (stacked on a door, the kick, moving through a doorway): the gun across the chest, muzzle up 50° past the left shoulder, butt down by the right hip
  portLong: { side: -0.115, up: -0.15, fwd: 0.19, anchor: 0, pitch: 50, aimK: 0, yaw: 35, blade: 0, lean: 0, headYaw: 0, headPitch: 0, headRoll: 0, elbowR: [-0.7, -0.8, -0.3], elbowL: [0.9, -0.6, 0.1], poleW: 0.75, sway: 0.5, steady: 0.7 },   // (maintainer's viewer pass, 08-08)
};
/** The same four carriages CROUCHED — standing and crouching tune separately (the maintainer's viewer pass). The solve blends the two tables channel by channel by
 *  the crouch actually shown (update(): crouchPose 0 → LONG, 1 → LONG_CROUCH) BEFORE the carriage springs, so dropping into a crouch mid-aim eases like a change of
 *  carriage; player and guards alike (a rifleman ducks under fire). Shipped as a copy of LONG's numbers, so nothing moves until it is tuned — the viewer's Long gun
 *  (crouched) group edits it and *copy LONG table* pastes both tables back as literals over these two statements. */
export const LONG_CROUCH: Record<LongStance, LongShape> = {
  patrolLong: cloneShape(LONG.patrolLong),
  lowLong: cloneShape(LONG.lowLong),
  shoulder: cloneShape(LONG.shoulder),
  portLong: cloneShape(LONG.portLong),
};
function cloneShape(s: LongShape): LongShape { return { ...s, elbowR: [...s.elbowR] as Vec3, elbowL: [...s.elbowL] as Vec3 }; }
/** a LongShape flattened into spring channels (CharacterAnimator.lg.ch), and the indices back into it */
function longFlat(s: LongShape): number[] { return [s.side, s.up, s.fwd, s.pitch, s.aimK, s.yaw, s.blade, s.lean, s.headYaw, s.headPitch, s.headRoll, s.elbowR[0], s.elbowR[1], s.elbowR[2], s.elbowL[0], s.elbowL[1], s.elbowL[2], s.poleW, s.sway, s.anchor, s.steady]; }
/** the carriage's spring targets for the posture shown: LONG's channels toward LONG_CROUCH's by the crouch weight (0 standing … 1 crouched) */
function longTargets(stance: LongStance, crouchW: number): number[] {
  const a = longFlat(LONG[stance]); if (crouchW <= 1e-4) return a;
  const b = longFlat(LONG_CROUCH[stance]); const w = clamp(crouchW, 0, 1);
  for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * w;
  return a;
}
/** GUN HAND (gunhand.ts `longReload`): A LONG GUN'S RELOAD CARRY. Through its magazine change a long gun is held the way a rifle is worked, not played through the
 *  pistol's reload clip: the trigger hand keeps the grip, the stock comes in under the shoulder, the muzzle a little up and across so the well stands where the
 *  support hand can get at it; the head goes down to the well as the empty comes out and comes back up once the fresh one is seated. The carriage he is in (LONG)
 *  goes toward these numbers by the carry's weight and back to itself by the end of the beat — LONG's units and axes, the gun and the head only: the trunk keeps
 *  the carriage's own blade and lean. `at`: the trigger hand's wrist off the CHEST joint [side, up, fwd], whatever the carriage's own anchor (one place to work a
 *  gun, inside the support arm's reach on every carriage). `box`: a magazine ahead of the grip (the carbines); `back`: the bullpup's, behind it (the muzzle less
 *  far up: its well is under his own forearm). `head`: ° — toward the gun side, down. Seconds: `in` to come to the carry from the reload's first frame, `out` to
 *  go back, done `end` before the beat is; the head starts down `headIn` before the empty goes and is up `headOut` after the fresh one seats. `rate`: 1/s, the
 *  fastest either weight moves (a beat taken away mid-change eases out at it). First-pass numbers off the measured reach — not through the maintainer's viewer
 *  pass. */
export const LONG_RELOAD = {
  box: { at: [-0.15, -0.075, 0.19] as Vec3, pitch: 20, aimK: 0, yaw: 12 },
  back: { at: [-0.16, -0.06, 0.21] as Vec3, pitch: 12, aimK: 0, yaw: 4 },
  head: { yaw: -10, pitch: 22, roll: 0 },
  in: 0.35, out: 0.35, end: 0.06, headIn: 0.3, headOut: 0.3, rate: 8,
};
const LC = { side: 0, up: 1, fwd: 2, pitch: 3, aimK: 4, yaw: 5, blade: 6, lean: 7, headYaw: 8, headPitch: 9, headRoll: 10, elbowR: 11, elbowL: 14, poleW: 17, sway: 18, anchor: 19, steady: 20, count: 21 };
/** THE LOW READY PULLED IN FOR A WALL (CharacterAnimator.gunWall, written by game/gunwall.ts; 0 = every carriage exactly as it was): the low ready puts a
 *  long gun's muzzle half a metre ahead of his feet and a pistol's 43 cm, and a man can stand with his centre 30 cm off a wall — so the low ready alone still
 *  draws the muzzle in the plaster. By gunWall the low carriages' spring TARGETS go toward these: the trigger hand in against the chest and down, the bore
 *  steep into the floor at his toes and nearly square to him (a rifle carried muzzle-down in front of the body; a pistol flat to the chest, 'sul') — at 1 the
 *  muzzle is inside his own collision circle. `long`: the long gun's channels (LONG's units; lowLong and the calm patrolLong both go there). `pistol`: the
 *  pistol stance's (STANCES' units; the low ready only). First-pass numbers off the measured reach — not through the maintainer's viewer pass. */
export const WALL_TUCK = {
  long: { side: -0.165, up: -0.245, fwd: 0.185, pitch: -76, yaw: 15, aimK: 0, elbowR: [-0.75, -1, -0.45] as Vec3, elbowL: [0.6, -1, -0.25] as Vec3 },
  pistol: { fwd: 0.2, up: -0.19, pitch: -70, tuck: 0.8 },
  /** gunWall 1‥2: the hand drawn this much further back again, metres (a torso twisted hard round carries the whole carriage forward of his feet) */
  over: 0.12,
};
/** SAM SPRINTS WITH BOTH HANDS ON THE PISTOL (the maintainer, 10-25: "sprinting with pistol animation is weird, should keep two hands on it and at low
 *  ready, like rifle sprinting animation"). A sprint took the pistol's layer off (`upper` 'none'), so the gun rode a pumping fist while the rifle's sprint
 *  is the long gun's low ready in both hands. With `on`, a figure told `runReady` (player.ts: the sprint, the pistol in his hand) and in no stance of its own
 *  takes the pistol's LOW READY over the running legs — the stance every man moving between doors already has, arms only — drawn in toward the belt as a
 *  runner carries it: the low ready's spring targets go to these (STANCES' units; fwd / up from the pelvis, pitch in degrees, tuck 0‥1). Off, or the
 *  input never raised (every guard, every teammate, the frozen stand): the animator as it was, to the bit. First numbers, off the capsule strips. */
export const RUNREADY = { on: false, fwd: 0.24, up: -0.185, pitch: -50, tuck: 0.6 };

/** a long carriage's targets pulled toward WALL_TUCK.long by w (0‥1), in place */
function longTuck(t: number[], gunWall: number): void {
  const w = clamp(gunWall, 0, 1), T = WALL_TUCK.long, to = (i: number, v: number) => { t[i] += (v - t[i]) * w; };
  to(LC.side, T.side); to(LC.up, T.up); to(LC.fwd, T.fwd); to(LC.pitch, T.pitch); to(LC.yaw, T.yaw); to(LC.aimK, T.aimK);
  for (let k = 0; k < 3; k++) { to(LC.elbowR + k, T.elbowR[k]); to(LC.elbowL + k, T.elbowL[k]); }
  t[LC.fwd] -= clamp(gunWall - 1, 0, 1) * WALL_TUCK.over;
}
/** Steadying a long gun against the gait, for a figure whose CharacterAnimator.longSteady is up (Sam — player.ts armRifle; the guards' riflemen carry theirs as they
 *  did) and by the carriage's `steady`: the trigger hand's anchor follows the trunk's side-to-side through a two-pole low-pass of time constant `tau` (s) instead of
 *  frame by frame — the crouch-walk rocks the chest ±6 cm and the walk ±3, once a stride: that stays in the trunk and the arms take it up, the gun riding the
 *  shoulders' mean line as a shooter's does, while the weight settling onto one foot over a second at rest still carries it — and, at a run un-aimed (the sprint's
 *  low ready), `runYaw` of the shoulder line's pumping (±25° in the run clips, whose arms drive) is taken back out down the spine: both hands are on the weapon, so
 *  the shoulders are held to it and the legs do the running (longArms / longBody). Viewer: Long gun ▸ steady rows. */
export const LONG_STEADY = { tau: 0.5, runYaw: 0.85 };
/** the trigger hand's pull back along the bore while a shot plays (m; ~35 ms up, 0.2 s down — the drawn weapon rides the hand, so this is what the carbine's recoil shows) */
const LONG_KICK_BACK = 0.03;
/** THE LOUD DEMO'S MOTION PASS (MOVES) — what a firefight shows that the stealth game never had to: a rifle that RECOILS (the gun driven back into the shoulder, the
 *  muzzle climbing, the trunk rocked — controlled by a trained man, climbing away from an untrained one), the bang TOSSED underhand off the support hand with the
 *  rifle still in the other (the teams' "throw" was a pointing chop), a stun charge that leaves a man bent away from it with his forearm over his eyes for as long
 *  as he is blind (it was one twitch, then a statue), a FLINCH (a duck: head down and away, knees soft) that is not the same clip as taking a HIT (the torso knocked
 *  along the round), a walk that tells the two sides apart (the team sunk onto bent knees and leaning into the gun, gliding; the defenders upright, shoulders
 *  swinging, elbow out), falls that do not all go over backwards, and the stack's shoulder squeeze. Every part has its own switch and `on` is the master:
 *  **on = 0 is the animator exactly as it was** (every new branch below is behind `mvOn`, the old statements untouched) — the headless harness stands up with it
 *  off (host/standup.ts), so every frozen digest holds; the page has it on, `?nomoves` puts it off. Poses feed the game (the muzzle rides the hand, hit columns
 *  ride the hips and chest), so ON is a different simulation in the small — see rebuild/characters-loud/animations/notes.md. */
export const MOVES = { on: 1, recoil: 1, toss: 1, dazzle: 1, flinch: 1, gait: 1, fall: 1, squeeze: 1,
  /** THE SECOND PASS (rebuild/cast-faces-and-moves/moves/notes.md) — looks laid on states the game already has. `reload`, `bound` and `clutch` move ARMS ONLY that
   *  nothing in the fight reads (a rifleman's support arm; an unarmed civilian's two): the trunk, the head, the trigger hand and with them the muzzle, the bore, the
   *  eyes and the hit columns are bit for bit what they were, so these are on with the pass. `entry` lowers a teammate's muzzle past a friend's back — the muzzle is
   *  the game's own (rounds leave it, the line-of-fire tests start at it), so it is a different simulation in the small: OFF — tallied over 144 seeds (CLAUDE.md, the MOVES second pass): no mission is measurably better for it, The block leans worse, and the bore still ends on the friend.
   *  `entryEyes` (a part of `entry`, nothing without it): the dipped man still LOOKS where he is going — guards.ts's eyes-on-the-sights test reads his gun line
   *  as if it were not dipped (`sightsLift`). The weapon light stays down with the muzzle, as a real one does. */
  reload: 1, bound: 1, clutch: 1, entry: 0, entryEyes: 0,
  /** the clutch's FOLD: a man knocked about and still up stays doubled over the hurt, swaying, for as long as the game roots him — the TRUNK and head, so not
   *  arms-only (his hit columns and a lowered gun move with it; he fires nothing while rooted). NOT on with the pass: 0 = it comes up with the wounds switch and
   *  only with it (FOLD_WITH below — wounds off, the trunk of a staggered man is the base's), 1 = on by itself (`?fold`), -1 = never (`?fold=0`). */
  fold: 0,
  /** THE SNAP SHOT (a pistol fired from the relaxed carry; the same trade when the aim is raised or let go by hand). The carry and the two-hand aim are two
   *  layers eased on two clocks (9 and 14 a second), so while they traded neither had the arm and the base clip's HANGING arm came through from under both: a
   *  ninth of it on the fire frame (the wrist 10 cm in that one frame) and a third of it on the way back to the carry (16 cm in a frame, the hand dipping 20 cm
   *  and more toward the thigh and up again). On: the layers TRADE — the carry stays whole under the aim until the aim has covered it, the aim stays until the
   *  carry is back under it — and the aim comes in from rest over its first frames instead of a fifth of the way at once (MV.snap). And a shot along a PITCHED
   *  aim keeps its pitch: the shot clip is keyed level, so blended in whole it lifted hands, trunk and head to the level pose for the length of every such shot
   *  (aimed at his feet: the wrist 47 cm up in three frames, down again after) — its recoil alone is laid on the pitched pose instead; a level shot is the clip
   *  to the bit. What the round is does not move: it leaves on its own frame from where the muzzle stood before the pose did (combat.ts fireWeapon reads it
   *  ahead of the animator) toward its target, and the drawn bore is the aim's own line (Character.gunDir = aimDir()) — fired from rest it is the same round to
   *  the bit, with the aim up the same to a micron (moves-snap holds both); one fired while the layers are still trading leaves from the hand's new path, a
   *  few cm off the old.
   *  Like the rest of MOVES it is a different simulation in the small: the pistol man's hands, chest and head (a guard's eyes ride his head, a torch its hand)
   *  are where the new trade has them. Pistol in the hands only (no long gun shown, no share of one mid-swap: a rifleman's pitched shot still takes the level
   *  clip's trunk). `?snap=0` off. */
  snap: 1,
  /** THE CROUCH WALK CARRIED LEVEL (the maintainer, twice: "the crouch walk animation looks like waddling"). Measured off Crouch_Fwd_Loop as the game drives it
   *  (side to side over a cycle, against the standing walk): the feet come down 33 cm apart on 17.5 cm of hip (the walk: 18), the knees 32–38 cm apart, the
   *  pelvis rolls 15° peak to peak (5°) and the whole trunk tips with it, 16° (6°) — so the head rides 17–18 cm from side to side (6 cm), once a stride, and at
   *  the player's crouch pace that is nearly twice a second. A wide base with the trunk rocked over each foot in turn is what a waddle IS. On: the cycle's own
   *  pelvis roll and the trunk's side lean are taken most of the way back out (MV.steady: the weight goes over the planted foot by the hips' few cm of travel,
   *  as in the walk, not by tipping the body), the feet come down nearer his middle and the knees track over them. Fore and aft nothing moves: stride, cadence,
   *  the planted foot's ground speed, the pelvis's height and the deliberate layer's stride and surge are the cycle's own. By the crouch walk's share of the
   *  pose only — a still crouch, the kneel and every upright gait are untouched. Anybody who crouch-walks (Sam, a sneaking partner). Like the rest of MOVES a
   *  different simulation in the small: his head and hands are a few cm from where the rocking had them. `?steady=0` off. SETTING 2 (`?steady=2`; never
   *  the default) also rides him HIGHER through the cycle — the pelvis up to `MV.steady.rise` off the kneel wherever both legs can pay it out, so the rear knee
   *  no longer drops to a hand off the floor on every step. That one is NOT a look-only change: the eyes that look for him read his head and chest bones, and
   *  a head 7 cm higher is 7 cm more of him over low cover.
   *  AND THE SPRINT WITH THE RIFLE (the maintainer, after the crouch walk: "sprint animation still has some waddling") — see `steadyRun` below. */
  steady: 1,
  /** THE RIFLE SPRINT WITHOUT THE SIDE ROLL (needs `steady`; `?steady=0` puts it off with the rest — a key of its own ONLY so a recording from before it,
   *  whose MOVES row has `steady` and not this, replays on the trunk it was recorded with: journal.ts; no URL flag, no Tab row). A figure that steadies its
   *  long gun (longSteady: Sam, and every teammate carrying the issue rifle) has the run clip's shoulder twist taken back out down the spine so the shoulders
   *  stay on the weapon (longBody, LONG_STEADY.runYaw). That was done about the model's upright — and a SPRINTER's trunk is pitched ~25° forward, so ±25° of
   *  twist about ITS line less ±25° about the upright left the whole trunk rolling ±11° and the head 17 cm from side to side, three steps a second (hands
   *  empty the same sprint moves the head 1.7 cm). On, by the SPRINT's share of the pose (0 at and under the jog's speed), the twist is taken out about the
   *  trunk's own line and the neck is handed it back: head 4–5 cm, trunk lean 2°, legs to the bit and the gun where they were. Only a sprinter changes, and
   *  with a rifle in both hands that is the player: a teammate tops out under the jog's speed and his run is the old hold to the bit. */
  steadyRun: 1 };
/** who else raises the fold while MOVES.fold is 0: wounds.ts hands its switch in (this file reads no game table) */
export const FOLD_WITH = { on: (): boolean => false };
const foldOn = (too = false) => MOVES.on > 0.5 && MOVES.clutch > 0.5 && (MOVES.fold > 0.5 || (MOVES.fold === 0 && (too || FOLD_WITH.on())));   // (`too`: the figure's own `foldToo` — condition.ts raises the fold with its switch as wounds.ts does with its own)
export function setMoves(on: boolean) { MOVES.on = on ? 1 : 0; }
try { const q = new URLSearchParams(location.search); if (q.has('moves')) MOVES.on = q.get('moves') !== '0' ? 1 : 0; if (q.has('nomoves')) MOVES.on = 0; if (q.has('entry')) { MOVES.entry = q.get('entry') !== '0' ? 1 : 0; MOVES.entryEyes = q.get('entry') === 'eyes' ? 1 : 0; } if (q.has('fold')) MOVES.fold = q.get('fold') !== '0' ? 1 : -1; if (q.has('snap')) MOVES.snap = q.get('snap') !== '0' ? 1 : 0; if (q.has('steady')) MOVES.steady = q.get('steady') === '0' ? 0 : q.get('steady') === '2' ? 2 : 1; } catch { /* no page (the harness) */ }
const mvOn = (k: keyof typeof MOVES) => MOVES.on > 0.5 && MOVES[k] > 0.5;
/** THE HAND PASS (MOVES — CharacterAnimator.handsPass; rides the master switch, no switch of its own): every standing clip in the library keys both hands as one
 *  clenched FIST, so a man with nothing in his hands walked about with two. After every other layer, and on the FINGER AND THUMB JOINTS ONLY (never the hand, the
 *  wrist or the arm: the joints' own origins — the knuckle the bore is measured to among them — do not move, so the muzzle, the props and every hit column are the
 *  same numbers), the share of each digit that is still that library fist is opened into a RELAXED hand: fingers gently curled, a little more from index to pinky,
 *  the thumb loose beside the index — `curl` (0 straight ‥ 1 fist, as hand() takes them), `thumb`, `spread`; `thumbBend` = degrees more on each of the thumb's two
 *  outer joints and `thumbClose` = degrees its root is brought in toward the fingers' line (it stood out of the hand as one straight peg the length of the index); `vary` / `sideVary` / `fingerVary` = how far one
 *  man's hands differ from the next man's, his left from his right and one finger from its neighbour (dealt off his id by desync's hash, never Math.random).
 *  What is left alone: a hand a layer has shaped (hand() notes how far its target stands from the hand under it, and the pass yields by how much of that the pose
 *  shows — a layer half blended in gets half), a hand closed round a gun, a torch or a can (the pistol / long-gun / torch weights, `grip`), the crouch clips' own
 *  open hands (`far`: a digit this many degrees off where the locomotion left it is somebody else's) — but for the THUMB, which those clips hold out of the hand
 *  as a straight peg: `thumbOwn` = the share of the relaxed hand's thumb a hand that is not the library's fist takes (0 = the clip's thumb as it was). `trig…`: a DRILLED man's (trained ≥ trigTrained) index lies
 *  straight along the frame of the gun in his hand until he fires — on the trigger for `trigHold` s after each round — index joints only. */
export const HAND = { can: { curl: [0.56, 0.58, 0.62, 0.68], thumb: 0.3 }, curl: [0.3, 0.35, 0.41, 0.48], thumb: 0.38, thumbIn: 34, thumbBend: 15, thumbClose: 10, thumbOwn: 1, spread: -0.15, vary: 0.05, sideVary: 0.035, fingerVary: 0.025, far: 45,
  trig: [6, 10, 6], trigSpread: 6, trigTrained: 0.6, trigHold: 0.7 };
/** the angle (rad) between the unit quaternions at a[i‥i+3] and b[k‥k+3] */
const qAng = (a: ArrayLike<number>, i: number, b: ArrayLike<number>, k: number) => { const d = Math.abs(a[i] * b[k] + a[i + 1] * b[k + 1] + a[i + 2] * b[k + 2] + a[i + 3] * b[k + 3]); return d >= 1 ? 0 : 2 * Math.acos(d); };
/** d[o‥o+3] ← d[o‥o+3] · (x, y, z, w)^f — a joint's local rotation turned on by the share f of a further local rotation, in place */
function qTurnBy(d: Float32Array, o: number, x: number, y: number, z: number, w: number, f: number) {
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const th = Math.acos(Math.min(1, w)); let sc = f, cw = 1; if (th > 1e-4) { sc = Math.sin(f * th) / Math.sin(th); cw = Math.cos(f * th); }
  x *= sc; y *= sc; z *= sc; const qx = d[o], qy = d[o + 1], qz = d[o + 2], qw = d[o + 3];
  d[o] = qw * x + qx * cw + qy * z - qz * y; d[o + 1] = qw * y - qx * z + qy * cw + qz * x; d[o + 2] = qw * z + qx * y - qy * x + qz * cw; d[o + 3] = qw * cw - qx * x - qy * y - qz * z;
}
/** d[o‥o+3] turned the share f of the way to the local rotation at t[k‥k+3], in place */
function qTurnTo(d: Float32Array, o: number, t: ArrayLike<number>, k: number, f: number) {
  const cx = -d[o], cy = -d[o + 1], cz = -d[o + 2], cw = d[o + 3];   // conj(q) · target
  qTurnBy(d, o, cw * t[k] + cx * t[k + 3] + cy * t[k + 2] - cz * t[k + 1], cw * t[k + 1] - cx * t[k + 2] + cy * t[k + 3] + cz * t[k], cw * t[k + 2] + cx * t[k + 1] - cy * t[k] + cz * t[k + 3], cw * t[k + 3] - cx * t[k] - cy * t[k + 1] - cz * t[k + 2], f);
}
/** MOVES.entry's lane (THE rule, for the game and the strips alike): something (dx, dz) from a man stands before his muzzle — within arm's length-and-a-half
 *  down the line his GUN points (gunYaw) and inside a body's half-width of it */
export function inDipLane(dx: number, dz: number, gunYaw: number): boolean { const L = MV2.dip.lane, fx = Math.sin(gunYaw), fz = Math.cos(gunYaw), along = dx * fx + dz * fz; return along > L[0] && along < L[1] && Math.abs(dx * fz - dz * fx) < L[2]; }
/** MOVES.reload's marks on a long gun, off the trigger hand's wrist in the gun's frame (QA reads them: the probes hold the hand to them and to rigProps' magazine) */
export const reloadMarks = (back: boolean) => back ? MV2.reload.back : MV2.reload.box;
/** a weapon's reload beat as the animator takes it (weapons.ts WeaponDef.reload is one): seconds to the magazine out / the fresh one in / the handle; `rack: null` = no handle this time */
/** (`keep` s: the old magazine has rounds in it and is PUT AWAY at this time, not dropped — the hand goes by the dump pouch on its way to a fresh one; `hand`:
 *  the support hand works this change on a PISTOL too — both dealt by game/kitanim.ts, absent = as it was) */
export interface ReloadBeat { dur: number; out?: number; in_?: number; rack?: number | null; keep?: number; hand?: boolean;
  /** the beat is taken as it stands, none of the magazine change's floors (gunreload.ts shellPlan: a tube gun's reload made for the shells that go in — one
   *  shell is home 0.36 s after the hand gets there, and its own stations keep the hand's path in order) */
  exact?: boolean }
/** WOUNDS (game/wounds.ts): the two poses a man down and out of the fight is played in. `clip` = the library clip whose way down it is; `rate` = its speed;
 *  `hold` = the stretch of the clip (s) he is held in, breathed across at `breath` rad/s; `in` = s the layer takes over the graph; `head` = degrees his chin
 *  comes toward his chest once he is down (on his back: his head up off the floor, looking at it). */
export const WOUND_POSE: Record<'knee' | 'back', { clip: string; rate: number; hold: [number, number]; breath: number; in: number; head: number }> = {
  knee: { clip: 'Fixing_Kneeling', rate: 1.15, hold: [0.86, 1.0], breath: 1.6, in: 0.14, head: 14 },
  back: { clip: 'Death01', rate: 1, hold: [1.42, 1.54], breath: 1.3, in: 0.12, head: 44 },
};
/** where a wounded man's hand presses his ribs: off the lower chest joint, trunk frame [across to his left, up, forward] — on a man doubled over a knee this is the flank under the gun arm */
const WOUND_AT: Vec3 = [-0.05, 0.03, 0.15];
/** The second pass's numbers (MOVES.reload / bound / clutch / entry). Points on the gun are in the GUN's frame off the trigger hand's wrist, as rigProps draws the
 *  weapon (x the figure's left, y up out of the receiver, z along the bore), and are the support hand's WRIST: `mag` = the hand round the magazine where it stands
 *  in the well, `strip` = with it clear of the gun, `handle` → `pull` = the charging handle taken and drawn. `box` = the short carbine (the curved box ahead of the
 *  grip, rocked out forward; the handle on the right, reached under the gun), `back` = the bullpup (the box behind the grip straight down out of the hull, the
 *  handle on the left of the fore-end). `pouch` = where the fresh one comes from: [off the pelvis: a belt, the untrained man's; off the chest joint: the vest's front]. */
const MV2 = {
  reload: {
    box: { mag: [0.085, -0.17, 0.125] as Vec3, strip: [0.09, -0.26, 0.15] as Vec3, handle: [0.05, -0.08, 0.07] as Vec3, pull: [0.05, -0.08, -0.03] as Vec3, hf: [-0.7, 0.6, 0.1] as Vec3, hb: [0.5, -0.5, 0.6] as Vec3 },
    back: { mag: [0.085, -0.15, -0.115] as Vec3, strip: [0.09, -0.23, -0.17] as Vec3, handle: [0.1, 0.01, 0.17] as Vec3, pull: [0.1, 0.01, 0.08] as Vec3, hf: [-0.9, 0.1, 0.3] as Vec3, hb: [0, 1, 0] as Vec3 },
    pouch: [[0.15, 0.04, 0.215], [0.1, -0.03, 0.195]] as [Vec3, Vec3],
    pole: [0.7, -0.6, -0.25] as Vec3, poleW: 0.7,
    fumble: 0.055,   // m: how far off the well an untrained man's fresh magazine lands before he backs it off and finds it (× 1 − trained; a drilled man: none)
    tap: 0.11,       // m: the untrained man's hand comes off the seated magazine and slaps it home from below before he goes for the handle (× 1 − trained)
    flare: { off: [0.12, 0.12, -0.03] as Vec3, tap: [0.13, 0.04, 0] as Vec3, pole: [1, 0.35, -0.2] as Vec3 },   // the untrained man's elbow on the miss and on the slap (× 1 − trained): backing the magazine off the lip his hand comes away by `off`, winding up the slap by `tap` (m, trunk frame: to his left, up, forward), and the elbow swings out toward `pole` — carried outboard of the trunk's outline, where the side view and the game camera both see it
    fling: 0.06,     // m: the hand let go of the handle carries on back off it — further for the untrained (+ 0.1 × (1 − trained)); nobody rides it forward
    rate: 14,        // 1/s: how fast the arm lets go of the change when it is stopped short (cancelled, a throw, a signal)
  },
  /** a figure kept down. `back`, in the trunk's own frame (up the spine, across the shoulders, out of the chest): the wrists behind the pelvis. `head`, in the HEAD's
   *  frame off the head joint (up its crown, across it, back from its gaze; the skull tops out ~0.28 up and its back stands ~0.07 behind): the wrists either side of the
   *  back of the crown — above a bun — with `elbow` = how far back of square the elbows are held (trunk frame) */
  bound: { rate: 6, back: { up: 0.07, out: 0.045, behind: 0.15, curl: [0.64, 0.7, 0.76, 0.82], thumb: 0.7 }, head: { up: 0.2, out: 0.095, behind: 0.065, elbow: -0.2, curl: [0.28, 0.32, 0.36, 0.4], knuckle: [16, 5], thumb: 0.3 } },
  clutch: { rate: 7, at: [-0.14, 0.12, 0.12] as Vec3, pole: [1, -0.05, -0.35] as Vec3,   // (the hand UP and ACROSS onto the far ribs, the elbow out where the game camera sees it: at the old point — WOUND_AT below — it sat at the belt, hidden under the trunk)
    fold: { rate: 6, pitch: 24, pitchToo: 34, head: 20, drop: 0.05, sway: 3, hz: 1 } },   // ° of trunk fold and head down held for the whole stagger, m the pelvis sinks, ° of roll he sways through at hz (`at` / `pole`: off the lower chest joint, trunk frame [across to his left, up, forward])
  /** A MAN'S CONDITION (condition.ts deals `hurt` and `shaken`). HURT, held for as long as he is: ° of trunk hunch, ° of lean over the side he favours, ° of head
   *  down, m the pelvis sinks, ° he sways through at hz standing; `brace` = how much of the trunk's share comes out with the gun in his shoulder (the trunk
   *  carries the gun: a hunch held under an aim would point it at the floor; the lean is about the bore and stays, and `headBrace` of the head's share comes
   *  out so his eye stays behind the sights). `step…`: on top, at the top of each stride onto that side — the short heavy step:
   *  ° more hunch, ° of roll over it, ° the trunk turns into it, ° the head drops, m the pelvis dips and goes across. `arm`: the support hand goes back to his
   *  ribs (the clutch's own arm) by this much of `hurt` whenever the gun is not in his shoulder. */
  hurt: { rate: 4, pitch: 11, lean: 8, head: 9, headBrace: 0.5, drop: 0.025, sway: 1.5, hz: 0.45, brace: 0.7, stepPitch: 5, stepRoll: 10, stepYaw: 5, stepHead: 4, stepDrop: 0.04, stepSide: 0.06, arm: 1 },
  /** SHAKEN, by how much fire is on him: ° of trunk hunch (less `brace` of it under an aim), ° the head comes down between the shoulders, m he sinks */
  shaken: { rateIn: 12, rateOut: 3, pitch: 11, head: 18, drop: 0.1, brace: 0.75 },
  /** the muzzle past a friend's back: the bore put down by `pitch` degrees with the stock still in the shoulder, the trigger hand a little down and back with it */
  dip: { pitch: -36, down: 0.035, back: 0.02, rateIn: 13, rateOut: 9, lane: [0.25, 1.9, 0.34] },
};
/** TURN WEIGHT (the maintainer, 10-08: "the AI look crisp when clearing rooms, but i wonder if they're rotating too quickly. needs to feel realistic and reflect
 *  weapon weight"). Measured first (tools/qa/turn-rates.ts, playthrough.ts's usual entry): a teammate's muzzle came round at a flat 458 °/s (guards.ts PACE.turn)
 *  from a standing start and stopped dead on the point — 90° in 0.2 s, a half turn in 0.4 — with spikes past 800 °/s when his own eyes gave him the point; bodies
 *  at a flat 290‥340 °/s; the defenders' muzzles at a flat 344 °/s. No frame of any of it spent getting up to speed or coming off it: that is what read as too quick.
 *  With this on, what the AI WRITES into Character.bodyYaw / aimYaw each frame is a wish, and Character.update brings the body and the gun round to it as masses:
 *  a top rate and an acceleration, braking early enough to stop ON the point (never past it — the settle is the coming off speed), both scaled by the HANDLING of
 *  what he carries (weapons.ts WeaponDef.handling: 1 = a pistol in the hand, lower = longer and heavier) and the acceleration by how drilled he is (`green` × for
 *  an untrained man: he is later getting it moving and softer stopping it; his top rate is the weapon's). The yaws the game then reads — sights, the fire gates'
 *  facing tests, the weapon light, the next frame's own easing — are the turned ones: one model, the picture and the fight agree.
 *    aim / aimAcc   rad/s and rad/s² the muzzle comes round about his waist, at handling 1
 *    body / bodyAcc the same for his feet; `bodyShare` = how much of the weapon's handling the body turn takes (a man pivots his own mass too)
 *    lead / leadRate  his EYES go first: the neck turns up to `lead` rad toward the wish ahead of the gun (eased at leadRate /s) and comes back as the gun arrives
 *    jump           m moved in one frame that is a staging, not a walk: the yaws are taken as written
 *  **on = 0 (or Character.turn.on false) is the yaws exactly as written** — the harness stands up with it off (host/standup.ts; TPS_TURN=1 turns it on for any
 *  headless tool), the page has it on, `?noturn` / `?turn=0` puts it off. Sam, civilians, a held man and a showcase's cast are never weighed (game.ts).
 *  HOW HEAVY is `TURN_FEEL` — three sets of the four rates, `?turn=light|medium|heavy` in the page. `light` is what TURN ships with: counted over whole scripted
 *  play-throughs (144 seeds a level) it is the one that leaves how the fights end where they were (a quarter turn with the team's rifle 0.22 s where it was 0.20,
 *  the one-frame snaps gone); `medium` (0.28 s) and `heavy` (0.37 s) read heavier and cost the team men in the four-man room clear. */
export const TURN_FEEL = {
  light: { aim: 11, aimAcc: 150, body: 7, bodyAcc: 60 },
  medium: { aim: 8.75, aimAcc: 75, body: 6, bodyAcc: 40 },
  heavy: { aim: 7, aimAcc: 50, body: 5, bodyAcc: 30 },
};
export const TURN = { on: 1, ...TURN_FEEL.light, bodyShare: 0.5, green: 0.6, lead: 0.6, leadRate: 16, jump: 0.75 };
/** THE one reading of the turn switch, for the page's `?turn=`, the native host's `--turn` and the harness's `TPS_TURN`: `0` | `1` | a TURN_FEEL name (on, at
 *  those rates), then any `,key=number` pairs over TURN's own keys; an empty head = `dflt`. False (and a console warning) when it was not understood — the head
 *  is then `dflt`, so a mistyped name is never quietly somebody else's setting without a word. */
export function setTurn(spec: string, dflt: 0 | 1 = 1): boolean {
  const [head, ...pairs] = spec.split(','), T = TURN as Record<string, number>; let ok = true;
  if (Object.hasOwn(TURN_FEEL, head)) Object.assign(TURN, TURN_FEEL[head as keyof typeof TURN_FEEL], { on: 1 });
  else if (head === '0' || head === '1') TURN.on = Number(head);
  else { TURN.on = dflt; ok = head === ''; }
  for (const kv of pairs) { const [k, v] = kv.split('='); if (Object.hasOwn(T, k) && v !== undefined && v !== '' && Number.isFinite(Number(v))) T[k] = Number(v); else ok = false; }
  if (!ok) console.warn(`turn weight: '${spec}' not understood (0 | 1 | ${Object.keys(TURN_FEEL).join(' | ')}, then ,key=number) — ${turnFeel()}`);
  return ok;
}
/** which setting is live, in words (the boot line, the probes): off, a TURN_FEEL name, or 'own numbers' */
export function turnFeel(): string {
  if (TURN.on <= 0.5) return 'off';
  for (const [n, f] of Object.entries(TURN_FEEL)) if (f.aim === TURN.aim && f.aimAcc === TURN.aimAcc && f.body === TURN.body && f.bodyAcc === TURN.bodyAcc) return n;
  return 'own numbers';
}
try {
  const q = new URLSearchParams(location.search), v = q.get('turn');
  if (v !== null) { setTurn(v); console.info(`turn weight: ${turnFeel()}`); }
  if (q.has('noturn')) TURN.on = 0;
} catch { /* no page (the harness) */ }
/** one frame of a mass coming round: `w` its rate now, `err` what is left (signed), top rate `wMax`, acceleration `acc` → [the step, the rate after it] */
function turnStep(w: number, err: number, wMax: number, acc: number, dt: number): [number, number] {
  const a = Math.abs(err); if (a < 1e-5) return [err, 0];
  const s = err < 0 ? -1 : 1, wt = s * Math.min(wMax, Math.sqrt(2 * acc * a));   // (the fastest it may be going with this much left to stop in)
  let nw = w + clamp(wt - w, -acc * dt, acc * dt); if (s * nw > s * wt) nw = wt;  // … and never faster than that: it does not carry past the point
  const d = nw * dt; return s * d >= a ? [err, s * Math.min(wMax, a / dt)] : [d, nw];
}
/** what mvPre hands the trunk layer: anything to do at all, the trained glide's weight (moving), the untrained share, the trained standing share */
interface MvGait { live: boolean; g: number; u: number; st: number; }
const MV_NONE: MvGait = { live: false, g: 0, u: 0, st: 0 };
/** The motion pass's numbers. Pairs are [untrained, trained], read by CharacterAnimator.trained (0 … 1; the game sets it per side — game.ts). First-pass values
 *  judged on pose strips (tools/qa/pose-strip.ts), not yet on a GPU. */
export const MV = {
  recoil: {
    back: [0.06, 0.04] as const,         // m the gun comes back along the bore per round
    backTau: [0.09, 0.055] as const,     // s it takes to come forward again (1/e)
    climb: [0.9, 0.4] as const,          // ° of muzzle climb per round (kept small: the defenders' blind burst flies along the drawn bore, and from above the climb is the least of what shows) …
    climbTau: [0.2, 0.1] as const,       // … and how fast it is pulled back down: at 10 rounds a second an untrained burst walks up ~2°, a trained one sits under 1°
    yaw: [1.3, 0.35] as const,           // ° the muzzle is thrown sideways per round (alternating, mostly to the gun side)
    rock: [3.4, 1.5] as const,           // ° the upper trunk is rocked back per round
    shoulder: [5, 2.6] as const,         // ° the gun shoulder is driven back per round (the upper spine's yaw)
    rockTau: [0.16, 0.085] as const,
    head: [2.2, 0.6] as const,           // ° the head is jarred per round
  },
  flinch: { amp: [1, 0.38] as const, dur: [0.7, 0.42] as const, pitch: 15, head: 14, away: 11, drop: 0.055, side: 0.03 },
  hit: { dur: 0.6, pitch: 17, yaw: 19, roll: 5, shove: 0.045, drop: 0.025 },
  dazzle: { amp: [1, 0.6] as const, hunch: 21, away: 24, roll: 5, head: 20, headAway: 22, drop: 0.065, back: 0.04, swayX: 0.022, swayZ: 0.016, rateIn: 11, rateOut: 4.5,
    handDrop: 0.038, handOut: 0.105, handTilt: 0.05, handRoll: 0.6, handPole: [0.45, -1, 0.35] as Vec3 },   // the hand over the eyes, from the eye point: m BELOW it and m out in front — under a hat's brim or a helmet's rim, which sit at the brow (level with the eyes and 3 cm nearer it came up through them on the cast's meshes); how far the fingers point up across the face; how far the palm is rolled down (the forearm comes up from below, so a palm square to the face bent the wrist ~60° sideways: rolled, most of that is flexion); and where the elbow hangs (low: the forearm comes up from under a wide brim, not in through its side)
  gait: {
    drop: 0.035, aimDrop: 0.025,         // m the trained pelvis sinks moving / standing on the gun
    bob: 0.65,                           // share of the walk's pelvis bob taken out for a trained man
    lean: 5, aimLean: 5,                 // ° the trained trunk leans into it moving / shouldered (over the carriage's own 4°)
    elbowIn: 0.42,                       // the trained elbows' poles pulled in under the gun
    slouchSway: 5.5, slouchRoll: 2.2,    // ° the untrained shoulders swing / rock with the stride
    back: 4.5, chin: 5,                  // ° the untrained man stands back off his gun shouldered, head up off the stock
    wing: 0.85,                          // the untrained firing elbow's pole lifted out sideways
  },
  /** MOVES.snap, the pistol's carry ⇄ aim trade: `in` = the share of its usual first step a rising aim takes from rest, back to the whole step by weight `ease`;
   *  `cover` = the weight band of the layer coming over (or coming back under) across which the other one is let go; `under` = the rate (1/s) more a carry
   *  comes back at while the aim still hides it */
  snap: { in: 0.5, ease: 0.2, cover: [0.5, 0.95] as [number, number], under: 30 },
  /** MOVES.steady, the crouch walk carried level (steadyLayer) — shares TAKEN OUT of the cycle's own SWING about its mean, at any weight of the crouch walk in
   *  the pose: `roll` of the pelvis's roll (the hip joints' line off level; the trunk comes with it, and where the pose keeps the cycle's own spine — hands
   *  empty — the chest is handed the same turn back, so shoulders the cycle carried level stay level), `sway` of the hips' own side-to-side travel; `feet` = how
   *  far apart the ankles come down, as a share of the clip's (0.7: 33 cm → 23); `knee` = the share of each knee's sideways set off its hip that is taken out
   *  (the plane the leg bends in swung that far toward straight fore and aft), × `kneeLow` for a knee within a hand of the floor. The narrowed base and the
   *  swung-in knees are for the plain crouch walk: they fade out as the layers after this one sink the pelvis by `deep` (m: from → to; the near-a-threat
   *  sneak and the close-in creep — a rear knee swung in under a pelvis sunk that far went through the floor) and under a stance that re-plants the legs
   *  (stanceBody sends the knees out over the toes: on a narrowed base they came 4 cm lower). The level pelvis stays in all of them — and, sunk, a low knee
   *  is set `kneeOut` of its sideways set further OUT, which hands back the 7 mm the levelled pelvis alone took off it.
   *  Setting 2 only: `rise` = how far the pelvis is carried up off the kneel (m), never by more than leaves each leg at `reach` of its full length with its
   *  ankle where it is, eased in and out at `riseRate` (1/s) */
  steady: { roll: 0.7, sway: 0.3, feet: 0.7, knee: 0.5, kneeLow: 0.5, deep: [0.03, 0.05], kneeOut: 0.25, rise: 0.07, reach: 0.95, riseRate: 8 },
};
/** the support-hand toss (tossItem): seconds from the call to the hand letting go by default, and what follows the release */
export const TOSS_RELEASE = 0.14, TOSS_AFTER = 0.66;
/** the shortest release tossItem takes: for the callers whose can is already in the air on the frame they call (the ordered door, the response team) — a flick, the hand a twelfth of a second behind the can */
export const TOSS_QUICK = 0.08;
/** the flinch's envelope over its own length (0‥1) and the hit's over seconds (it ends at MV.hit.dur) */
const MV_FLINCH_ENV: [number, number][] = [[0, 0], [0.14, 1], [0.34, 0.9], [0.7, 0.22], [1, 0]];
const MV_HIT_ENV: [number, number][] = [[0, 0], [0.07, 1], [0.16, 0.8], [0.32, 0.28], [0.45, -0.07], [0.6, 0]];
/** THE START (startleFrom): a man who has just SEEN something he did not expect — not the duck from a round (the flinch folds him down and away) and not a blow
 *  (the hit knocks him along it): he JOLTS. The trunk rears back off the thing and turns a little toward it, the head snaps round to it with the chin up, the
 *  weight goes back off it over planted feet with the knees giving, and the arms that are not on a long gun fly out from his sides — shoulders up, elbows wide,
 *  forearms half raised — then all of it comes back as he gathers himself. Big and long for an untrained man, a twitch for a trained one. `amp` / `dur` by
 *  training (0 → 1); the angles in degrees, the shifts in metres; `env` over its own length (0‥1): there in a tenth of it, held, let go. */
const MV_STARTLE = { amp: [1, 0.5] as const, dur: [0.65, 0.45] as const, rear: 10, turn: 8, lean: 3, head: 9, headTurn: 32, back: 0.075, drop: 0.035,
  gunAmp: 0.7, gunRear: 0.5, gunBack: 1, behindTurn: 1.8, behindHead: 0.8, behindPitch: 0.5,
  shrug: 11, wide: [30, 19] as const, raise: [56, 40] as const, env: [[0, 0], [0.12, 1], [0.4, 0.86], [0.72, 0.18], [1, 0]] as [number, number][] };
/** where a carriage's trigger-hand point swings about when the aim pitches (model, off the chest joint): between the shoulder joints — a hand ahead of them rises with
 *  the muzzle and drops back under it, as an arm pointing does (longArms) */
export const LONG_PIVOT: Vec3 = [0, 0.13, -0.06];
/** the most the gun is brought back for the support arm's reach (m) */
const LONG_PULL_MAX = 0.06;
/** the furthest out (to the figure's right of the chest joint, m) a shoulder-anchored carriage follows the gun shoulder: the aim clip's shoulder sits at 0.20–0.21,
 *  the calm clips' easy shoulders at 0.24 and swinging — followed out there, the handguard leaves the support arm's reach */
const LONG_ANCHOR_SIDE_MAX = 0.215;
/** Deliberate movement and the crouch's centre of gravity by pace (CharacterAnimator.deliberate, sneakLayer). */
export const SNEAK = {
  stride: 0.282,                                 // deliberate 1, crouched: the stride this much longer and the cadence this much lower (1 / 0.78): the planted foot keeps its ground speed
  paceStride: 0.10,                              // full crouch pace: the stride a further 10 % longer, NOT paid for in cadence (the clip's stance runs slow of the ground as it is; this closes a little of that)
  linger: 0.16,                                  // deliberate 1: the sampled phase runs 1 ± this about the true rate — slowest just after each plant, quickest mid-swing
  surge: 0.7,                                    // the share of the nominal ground-per-cycle the clip's stance really covers: sizes the fore-aft ride that keeps the planted foot's speed through the linger
  drop: 0.04, paceDrop: 0.03, softDrop: 0.01,   // pelvis lower (m): deliberate crouch-walking · full crouch pace · deliberate upright
  lean: 5, paceLean: 1.5,                        // torso further over (°, spread hips-first up the spine; the neck takes it all back out)
  gunIn: [0, -0.07, -0.06] as Vec3, gunInStand: [0, -0.03, -0.03] as Vec3,   // two-hand carry, crouched / upright: the gun hand this far [left, up, fwd] of where the clip has it — down and back toward the lap — the support hand rigid with it
  handIn: 0.10,                                  // free hands: each this far in toward the thighs (m; never across the middle), 2 cm down, 3 back — half of it upright
};
/** HE WATCHES A MAN, AND GIVES HIM ROOM AS HE PASSES (watchLayer; game/samlook.ts feeds `watchAt` / `slipAt`. The looks only: nothing reads them back).
 *  THE LOOK: the head goes to the point — the chest a little, the neck, the head (`share`) — as far off the chest's line as `yaw`° and `up` / `down`° of
 *  pitch; the angle follows the point at `rate` 1/s (a man swapped for another is a turn of the head, not a cut) and the whole comes and goes at `wRate`.
 *  THE SLIP: crouched beside a man, by how near he is (`slipK`): the trunk tips `lean`° away from him with the head brought level back out of it, the pelvis
 *  comes `drop` m lower and `away` m off his side over feet left where they were, and the arm on his side goes out low toward him, the hand open (`armOut` m
 *  out from the shoulder, `armDown` m under it, at `armW` of the arm; none of it for a man dead ahead or dead behind — `armSide`, his bearing's sideways
 *  share where it begins and is whole). A hand with something in it is left alone. Eased at `slipRate`. BETWEEN TWO MEN (`slipLean` under 1: they pull on
 *  him from both sides) the lean, the step aside and the arm go by that share, and he sinks `squeeze` of the drop further: he gets small, and tips into nobody. */
export const WATCH = {
  yaw: 72, down: 28, up: 22, share: [0.14, 0.34, 0.52] as [number, number, number], rate: 6, wRate: 5,
  lean: 9, drop: 0.035, away: 0.03, armOut: 0.32, armDown: 0.42, armW: 0.7, armSide: [0.2, 0.55] as [number, number], slipRate: 5, squeeze: 0.6,
};
/** THE FAST CROUCH WALK'S LOOK (CharacterAnimator.dash; the rule and its pace are player.ts CROUCHRUN): at 2.5 m/s the crouch cycle as it stands takes 3.5 steps
 *  a second on a 1.44 m stride — a wound-up toy. By `dash` the stride is this much longer and the cadence that much lower (the planted foot keeps the ground's
 *  speed, as the deliberate retime's does), the pelvis a little lower to pay for the reach and the trunk further over its knees, the head brought level back
 *  out of it. Eased in and out at `rate` (1/s). Nothing here runs at dash 0. */
export const DASH = { stride: 0.3, drop: 0.03, lean: 7, rate: 7 };
/** kick timing (s): total (the last ~0.25 s is the weight settling forward off the re-planted foot), and the instant the sole meets the door */
const KICK_DUR = 1.0; export const KICK_IMPACT = 0.38;
/** the swing foot is back on the floor by this time */
const KICK_PLANT = 0.72;
const SIGNAL_DUR: Record<SignalKind, number> = { hold: 0.9, go: 0.95, rally: 1.3, squeeze: 0.9, aside: 1.15 };
/** the tells' lengths (s): the watch comes up, is read ~0.6 s, goes down; the neck rub takes a little longer (game/needs.ts keys its telegraph off neither: they are looks, not events) */
export const TELL_DUR: Record<TellKind, number> = { watch: 1.05, neck: 1.35 };
/** THE READY POSES (readyLayer) — looks, read from a camera 55° overhead with the figure ~40 px tall: what counts is an arm out ahead of the body or an elbow out to
 *  its side, not a wrist. Vectors are (to his LEFT, up, forward) in the SHOULDERS' frame (forward = square to the shoulder line), metres off
 *  that arm's shoulder joint; the reaching hands' are in that frame turned to face the point. Per kind: `lean` ° the upper spine bows toward the point (neck and
 *  head levelled back out of it), `blade` ° the trunk is turned left shoulder forward over spine1‥3 (the head kept on the man), `clav` ° the left clavicle comes
 *  forward with a reach. LEFT hand: `reach` = it goes for readyAt — `frac` of the way from the shoulder, its level run held inside `r`, its height off the shoulder
 *  (frac × the point's + `bias`) inside `dy`, the whole never past READY_REACH of the arm; `h0` / `y0` stand in for a point nobody gave (straight ahead) — or
 *  `at`, a fixed spot. `pole` = where the elbow points, `fing` / `back` = the fingers' line and the back of the hand (handRot), `curl` / `thumb` / `spread` = the
 *  fingers (hand(): 0 open … 1 a fist; each finger a little more than the last). RIGHT hand: `knife` = it goes to the knife on his chest and rests on it (REACH
 *  below); false = it is left to whatever has it (the pistol on its aim). */
interface ReadyHand { pole: Vec3; fing: Vec3; back: Vec3; curl: number; thumb: number }
interface ReadyShape {
  lean: number; blade: number; clav: number;
  L: ReadyHand & { spread: number; reach?: { frac: number; r: [number, number]; dy: [number, number]; bias: number; h0: number; y0: number }; at?: Vec3 };
  knife: boolean;
}
/** THE READY POSES (CharacterAnimator.ready → readyLayer) = THE TELL: inside reach of a man, hands empty, Sam's RIGHT hand goes to the knife sheathed on his
 *  left chest and RESTS on the hilt (it does not draw: the knife leaves the sheath only in a lethal blow — knifeBlow), the elbow carried out to the right front
 *  where a camera overhead sees it; the LEFT arm says which move is open:
 *    grab    — behind him: the left arm up for his neck, open.
 *    grabGun — the same reach, lower, with the pistol up in the right hand: the gun keeps its aim, only the support hand leaves it (no hand on the knife).
 *    strike  — any other side: left shoulder forward, the left hand open ahead of the chest (the check hand).
 *    seat    — behind a seated man: the trunk over him, the left hand down for his collar. */
const READY: Record<ReadyKind, ReadyShape> = {
  grab: { lean: 5, blade: 0, clav: 8, knife: true,
    L: { reach: { frac: 0.65, r: [0.36, 0.46], dy: [-0.06, 0.14], bias: 0, h0: 0.75, y0: 0.05 }, pole: [0.8, -0.6, -0.1], fing: [-0.1, 0.15, 1], back: [0.9, 0.45, 0], curl: 0.16, thumb: 0.1, spread: 0.4 } },
  grabGun: { lean: 0, blade: 0, clav: 6, knife: false,
    L: { reach: { frac: 0.65, r: [0.36, 0.46], dy: [-0.16, 0.04], bias: -0.07, h0: 0.75, y0: 0.05 }, pole: [0.8, -0.6, -0.1], fing: [-0.1, 0.1, 1], back: [0.9, 0.45, 0], curl: 0.16, thumb: 0.1, spread: 0.4 } },
  strike: { lean: 3, blade: 13, clav: 0, knife: true,
    L: { at: [-0.1, -0.12, 0.3], pole: [0.6, -1, -0.2], fing: [-0.15, 0.55, 1], back: [0.8, 0.5, 0], curl: 0.4, thumb: 0.35, spread: 0.15 } },
  seat: { lean: 9, blade: 0, clav: 6, knife: true,
    L: { reach: { frac: 0.7, r: [0.3, 0.42], dy: [-0.36, -0.12], bias: -0.04, h0: 0.6, y0: -0.28 }, pole: [0.7, -0.5, -0.3], fing: [0, -0.35, 1], back: [0.5, 0.8, 0], curl: 0.22, thumb: 0.15, spread: 0.35 } },
};
/** SAM REACHES FOR HIS KNIFE (the tell's right hand; readyLayer → sheathFist): the hand's clock runs IN over `in` s and OUT over `out` s, linear — its weight in
 *  the arm is the clock's alone, shoulder → elbow → hand a little apart (reachShown = the hand's). The fist closes on the sheathed handle exactly where rigProps
 *  draws it (RIG.sheath.at through RIG.knife.grip, in the chest joint's frame: it rides the trunk's lean, twist and breath), fingers `curl`ed round it; `pole` =
 *  where the elbow points in that frame ((left, up, forward): straight out to his right) plus `poleUp` of the WORLD's up ([standing, crouched]) — a wing out past the right shoulder,
 *  the silhouette's change from above, standing or with the trunk hung forward over a crouch. */
const REACH = { in: 0.3, out: 0.32, pole: [-1, 0, -0.1] as Vec3, poleUp: [0.35, 0.5], curl: [0.62, 0.68, 0.72, 0.76], thumb: 0.6 };
/** THE LETHAL BLOW's knife hand (strike(kind, true) → knifeBlow), over the punch clip that carries the body: keys by REAL seconds since the hand was on the hilt
 *  (it gets there in `snap` s × however far off it was). `clear` = the first / last stop, the knife drawn DOWN out of the sheath's mouth along its own line and a
 *  little off the chest ([m down the line, m off the chest]; `tClear` after the start, and that long before `end`); then `keys`: {t, at, blade, fing, pole} — the
 *  wrist off the RIGHT shoulder joint, (left, up, forward) in his own frame turned onto the man (readyAt, within `az` rad), where the BLADE points (out of the
 *  fist's thumb side: a hammer grip), the line wrist → knuckles (squared to the blade) and the elbow's pole; `end` = back on the hilt, the knife home. The reach
 *  is capped at `reach` of the arm. knifeShown is true strictly between the hilt and the hilt. `hit` = when the blade is on him (the callers' beat; the probes).
 *    cross — from behind, the build's cross beat: out to the left front, then a backhand cut across at neck height as the clip's right shoulder comes through.
 *    jab   — from the front, the jab clip's short beat: cocked at the right hip, then a stab up under the ribs.  */
interface BlowKey { t: number; at: Vec3; blade: Vec3; fing: Vec3; pole: Vec3 }
const KNIFE_BLOW: { snap: number; tClear: number; clear: [number, number]; az: number; reach: number; fade: number } & Record<StrikeKind, { end: number; hit: number; keys: BlowKey[] }> = {
  snap: 0.16, tClear: 0.06, clear: [0.14, 0.05], az: 0.7, reach: 0.96, fade: 0.12,
  cross: { end: 0.6, hit: 0.27, keys: [
    { t: 0.16, at: [0.27, 0.0, 0.3], blade: [0.1, 0.9, 0.5], fing: [0.7, 0.1, 0.6], pole: [-0.5, -0.8, 0.1] },
    { t: 0.27, at: [-0.05, 0.03, 0.5], blade: [-0.1, 0.8, 0.6], fing: [0.2, 0, 1], pole: [-0.7, -0.7, 0] },
    { t: 0.36, at: [-0.22, -0.06, 0.36], blade: [-0.4, 0.8, 0.45], fing: [-0.2, -0.1, 1], pole: [-0.8, -0.6, -0.1] } ] },
  jab: { end: 0.52, hit: 0.24, keys: [
    { t: 0.15, at: [-0.02, -0.32, 0.08], blade: [0, 0.5, 1], fing: [0.05, -0.5, 0.8], pole: [-0.5, -0.3, -0.8] },
    { t: 0.24, at: [0.12, -0.2, 0.56], blade: [0, 1, 0.8], fing: [0.2, 0.1, 1], pole: [-0.6, -0.8, -0.1] },
    { t: 0.33, at: [0.0, -0.28, 0.2], blade: [0, 0.6, 1], fing: [0.05, -0.4, 0.9], pole: [-0.5, -0.5, -0.7] } ] },
};
/** the knife from the FRONT as the reference throws it (blow('slash') picks it in place of KNIFE_BLOW's stab; same clock, same frame it lands on): the fist
 *  loaded at the far hip, whipped up and across the throat, finishing high on the knife's own side */
const KNIFE_SLASH: { end: number; hit: number; keys: BlowKey[] } = { end: 0.52, hit: 0.24, keys: [
  { t: 0.14, at: [0.30, -0.38, 0.12], blade: [-0.3, 0.6, 0.7], fing: [0.6, -0.3, 0.6], pole: [-0.3, -0.6, -0.6] },
  { t: 0.24, at: [0.10, -0.08, 0.62], blade: [-0.6, 0.5, 0.6], fing: [0.1, 0, 1], pole: [-0.7, -0.6, 0] },
  { t: 0.34, at: [-0.46, 0.30, 0.30], blade: [-0.8, 0.5, 0.2], fing: [-0.7, 0.3, 0.6], pole: [-0.8, -0.5, -0.2] },
  { t: 0.42, at: [-0.46, 0.28, 0.28], blade: [-0.8, 0.5, 0.2], fing: [-0.7, 0.3, 0.6], pole: [-0.8, -0.5, -0.2] } ] };
/** the knife from BEHIND as the reference does it (blow('mouth')): never seen from the front — the fist carried low past his own hip and driven into the small
 *  of the man's back, held there while the other hand has his mouth, drawn as he is let down */
const KNIFE_BACK: { end: number; hit: number; keys: BlowKey[] } = { end: 0.6, hit: 0.27, keys: [
  { t: 0.15, at: [-0.02, -0.40, -0.04], blade: [0, 0.25, 1], fing: [0, -1, 0.25], pole: [-0.4, 0, -1] },
  { t: 0.27, at: [0.08, -0.34, 0.33], blade: [0, 0.2, 1], fing: [0, -0.9, 0.35], pole: [-0.4, -0.2, -1] },
  { t: 0.44, at: [0.08, -0.36, 0.31], blade: [0, 0.2, 1], fing: [0, -0.9, 0.35], pole: [-0.4, -0.2, -1] } ] };
/** A TAKEDOWN'S OWN MOVE over the strike (blow(); game/takedown.ts) — per style: the share of his crouch the move stands him up by through the wind-up and the
 *  hit (every one of the reference's opens with a rise) · the share of the punch clip kept under it (a chop and a palm heel are not a punch) · how far of his
 *  arm's length a hand may be sent. TAKEN = the man it is done to (taken()): how far his knees give while he is still on his feet · s the reaction lasts. */
const BLOW = {
  rise: { chop: 0.85, palm: 0.6, mouth: 0.9, sweep: 0.8, slash: 0.7 } as Record<BlowStyle, number>,
  clip: { chop: 0.25, palm: 0.35, mouth: 1, sweep: 1, slash: 1 } as Record<BlowStyle, number>,
  reach: 0.98, fist: [0.92, 0.95, 0.95, 0.95], open: [0.08, 0.06, 0.08, 0.12], loose: [0.25, 0.3, 0.3, 0.35], cup: [0.35, 0.35, 0.4, 0.45],
  /** THE LEGS under it (blowLegs): by contact the rear foot is drawn in to `gap` m behind the front one (lifted `lift` on the way) and the pelvis comes up and
   *  over the feet (`fwd` of the way) until the shorter leg is `straight` of its length (≤ `up` m) — he stands INTO the blow; let go over `out` s after it */
  legs: { gap: 0.2, lift: 0.05, straight: 0.985, up: 0.4, fwd: 0.6, out: 0.4 },
  /** AFTER IT (`tail` s past the move's end, Sam's only): he does not stand there — the crouch shown sinks to `sink` by the style and he stays down over the
   *  man (a pose: the game's own crouch is not written), let go as he walks off (`walk` m/s: from, gone by); the hand over the mouth goes down with the man */
  tail: 1.0, sink: { chop: 0.8, palm: 0.6, mouth: 1, sweep: 0.75, slash: 0.75 } as Record<BlowStyle, number>, walk: [0.4, 1.5],
};
const TAKEN = { sag: { arch: 0.1, hunch: 0.65, snap: 0.15 } as Record<TakenStyle, number>, secs: 1.0 };
/** live = where the hands go NOW (takedown.ts marks(), asked every frame until contact: the attacker is still closing to his station when the move begins) */
interface BlowRun { style: BlowStyle; t: number; hit: number; end: number; tail: number; rise: boolean; at: Vec3; at2: Vec3 | null; live: (() => [Vec3, Vec3 | null]) | null }
export interface BlowOpts { hit?: number; end?: number; live?: (() => [Vec3, Vec3 | null]) | null; rise?: boolean; tail?: boolean }
/** THE CLOSE-IN MODE's carriage (CharacterAnimator.creep → creepLayer) — [standing, crouched] where there are two: the pelvis sunk (`drop`, m) and set back a
 *  little under the lean (`back`), the spine bowed forward (`lean` °, hips first; the head levelled back out and put on creepAt), the shoulders rounded
 *  (`round` ° of each clavicle forward), and both hands up off the thighs ahead of the hips, elbows bent — the left the higher, as the lead hand ((left, up,
 *  forward) off its own shoulder, as READY's). Rates in / out per second; `gaitIn` / `gaitOut` s = the held gait's own share coming and going. */
const CREEP = {
  in: 6, out: 5, gaitIn: 0.2, gaitOut: 0.4,
  drop: [0.09, 0.03], back: [0.03, 0.01], lean: [14, 6], round: 10, look: 0.85,
  /** LOWER, HANDS DOWN (stalk.ts STALK.low feeds `low`, 0‥1 by the distance to the man's back, its shape as `lowShape` and `handsDown`): the shown share
   *  of it eases in and out at `rate` 1/s, and lets go at `up` when a grab springs him out of it. Nothing at 0, which is all the animator has unless fed. */
  low: { rate: 8, up: 24 },
  /** ARMS OUT AND LOW (stalk.ts STALK.wide feeds `wide`, 0‥1, and its shape as `wideShape` [out, down, ahead of the shoulder, the left's lead, m]): in at `in` 1/s
   *  (slowly, and only while he moves faster than `still` m/s: stopped, the pose is a held frame), out at `out` (fast). The elbow out and back (`pole`, unless fed
   *  `widePole`), fingers ahead and down (`fing`), the
   *  back of the hand up (`back`), an open hand. Left arm, `lead` m further ahead; the right is its mirror, as far back. The footage's creep: elbows bent and
   *  back, the upper arms hanging, the hands open by the knees with the left a little ahead (not flung out sideways: from above that read as wings). */
  wide: { in: 5, out: 14, still: 0.03, pole: [0.75, 0.1, -0.65] as Vec3, fing: [0.3, -0.5, 0.8] as Vec3, back: [0.15, 0.9, 0.35] as Vec3, curl: 0.1, thumb: 0.15, spread: 0.55 },
  /** WEIGHT IN IT (stalk.ts STALK.heft feeds `heft` and `heftShape`): his trunk and arms carried by his legs, not held over them. Read off his own feet, so a stop
   *  holds it where the step stopped: `stride` m between the feet ahead is the whole of the step, `lift` m of one foot over the other all his weight on the other,
   *  `run` m/s his full speed. Each follows on a spring (rate 1/s, damping): the trunk (`trunk`) a beat behind the feet, the arms (`arm`) a beat behind the trunk, so
   *  they carry past a stop and settle back; `body` his weight going from foot to foot, `go` his speed as his body feels it. The hand ahead goes `out` of the
   *  swing further out, and either way `up` of it higher, as a hung weight does at each end of its swing. `breath` ° at `breathHz`, standing still. */
  heft: { stride: 0.75, lift: 0.1, run: 1.6, trunk: [11, 0.7] as [number, number], arm: [7, 0.55] as [number, number], body: [9, 0.75] as [number, number], go: [5, 0.5] as [number, number], out: 0.15, up: 0.3, breath: 1.3, breathHz: 0.32, dt: 1 / 30 },
  L: { at: [-0.05, -0.27, 0.3] as Vec3, atC: [0.0, -0.17, 0.3] as Vec3, pole: [0.7, -0.6, -0.5] as Vec3, fing: [-0.2, 0.35, 1] as Vec3, back: [0.7, 0.7, 0] as Vec3, curl: 0.32, thumb: 0.25, spread: 0.2 },
  R: { at: [0.05, -0.33, 0.27] as Vec3, atC: [0.0, -0.21, 0.28] as Vec3, pole: [-0.7, -0.6, -0.5] as Vec3, fing: [0.2, 0.3, 1] as Vec3, back: [-0.7, 0.7, 0] as Vec3, curl: 0.38, thumb: 0.3, spread: 0.15 },
};
const READY_RATE = 12, READY_REACH = 0.85, READY_AZ: [number, number] = [0.5, 0.9];
/** THE WAY IN WITH BARE HANDS (readyLayer's 'grab' when nothing of his is a knife — noKnife, game/close.ts CLOSE.noKnife; fed by distance under stalk.ts's tell).
 *  With no hilt for the right hand the pose was one straight arm and whatever the crouch left the other doing: two open hands held out at a man's back. This is
 *  a man about to take somebody, with BOTH hands going for the one target: the LEFT out ahead of its own shoulder at the height of the man's neck (never
 *  higher than `L.dy` over the shoulder — over his own head it read, from above, as a wave), elbow down and in, the hand cupped, not splayed; the RIGHT up
 *  nearly level with it a hand's width inside its own shoulder, elbow down. The first pass had the left elbow carried out level and the right hand low at
 *  his hip: one claw overhead and a hand too small to see. Vectors as READY's; `R.at` is off the right shoulder; `L.r` = the level run's bounds, never
 *  nearer than `L.short` m to the point itself (at a metre the hands were in his back); `L.frac` of the height to his neck (the knife's reach: 0.65). */
const READY_BARE = {
  L: { pole: [0.32, -0.93, -0.2] as Vec3, fing: [-0.2, 0.3, 1] as Vec3, back: [0.8, 0.55, -0.1] as Vec3, curl: 0.1, thumb: 0.28, spread: 0.05, frac: 0.9, dy: 0.3, r: [0.4, 0.54] as [number, number], short: 0.32 },
  R: { at: [0.1, -0.3, 0.2] as Vec3, pole: [-0.4, -0.9, -0.25] as Vec3, fing: [0.15, 0.2, 1] as Vec3, back: [-0.85, 0.5, 0] as Vec3, curl: 0.14, thumb: 0.3 },
  /** THE WAY IN HAS A SHAPE, NOT ONLY A WEIGHT (the fourth pass: fed part of the reach — stalk.ts's tell, `readyAmt` under 1 — the pose was the whole reach at
   *  part weight, so both arms were up and out from two metres off and the last metre changed nothing: a sleepwalker). By the amount `a` he is fed: the pose's
   *  WEIGHT is whole by `by` of it — he is a man with his lead hand out LOW, at `low` m off his shoulder's height and `near` m ahead of it — and from `lift[0]`
   *  to `lift[1]` of it that hand comes UP and OUT to the neck; the right hand has no share before `right[0]` and all of it at `right[1]`: it comes off his
   *  ribs only for the last stretch. Fed the whole reach (a man in reach, no tell) every one of these is 1: the pose as it was. */
  way: { by: 0.4, low: -0.2, near: 0.32, lift: [0.3, 1] as [number, number], right: [0.62, 0.97] as [number, number], rate: 12, drop: 14 },
  /** …and INTO THE GRAB the pose is not dropped (it was, at 8 /s, with the hold's own arms still a quarter in: the left hand fell back to his own shoulder
   *  before it went round the throat). It stays up and is let go over `out` of the grab's reach [from, to] — the hand out ahead of him is carried past the
   *  man's neck by the step in and the hold's arm closes it across the throat from there; the right hand's share is gone by `outR` of the reach (the disarm
   *  has that hand on the gun at HOLD.strip.take). */
  out: [0.25, 0.8] as [number, number], outR: 0.3,
};
/** …and the two hands AS THEY FIRST STOOD, before the fourth pass shaped them (the lead hand's pole, fingers, curl and spread; the right hand's place, pole,
 *  fingers and curl): what HOLD.wayShape off draws — the polish down (holdPolish), so the page's ?stalkpolish=0 and the frozen stand show the reach they had.
 *  The bare-handed reach wherever it shows, a stalk on or not. tools/qa/stalk-check.ts holds these eight to the letter. */
export const READY_BARE_WAS = {
  L: { ...READY_BARE.L, pole: [0.5, -0.85, -0.2] as Vec3, fing: [-0.2, 0.12, 1] as Vec3, curl: 0.3, spread: 0.12 },
  R: { ...READY_BARE.R, at: [0.07, 0, 0.4] as Vec3, pole: [-0.5, -0.85, -0.25] as Vec3, fing: [0.15, 0.05, 1] as Vec3, curl: 0.34 },
};
/** THE REACH GOES UP (CharacterAnimator.readyUp, fed by game/close.ts CLOSE.reachUp; 0 = every pose as it was). A crouched Sam behind a STANDING man: the
 *  grab's reach is measured off his own shoulder, which at the crouch is at the man's belt — the open hand went to the small of his back and Sam's face to
 *  his seat. With the point more than `over` m ([none, all of it]) above the left shoulder: the trunk comes UP out of its crouched bow by `rise` degrees over
 *  spine1‥3 (the head let back `look` of it, so the eyes go up to the neck), the hand's height off the shoulder may reach `dy` (the level run pulled in to
 *  `r`), the fingers' line tips up by `fing`, the hand's way there (and the pose's way out when he steps back) takes `slow` as long again (it is that much further), and the whole comes in at `rate` 1/s from the reach as it was. The grab's tell only: 'grabGun' keeps the pistol's aim and 'seat' is under him. anim.crouch does not change, so what reads it (the men's detect rate, the fog's eye height) is as it was; his HEAD BONE is about 0.19 m higher and his chest 0.04, which the men's sight lines and the light meter do read. */
const READY_UP = { over: [0.25, 0.45] as [number, number], rise: 38, look: 0.5, dy: 0.36, r: [0.32, 0.42] as [number, number], fing: 0.3, slow: 0.8, rate: 6 };
/** KIT HANDLING — the hand's half (the maintainer, 10-10: "better animations for equipping and unequipping kit. like rifle for sam goes on his back, pistol in
 *  holster, knife, etc."). rigProps KitDraw is the drawer's half; game/kitanim.ts deals both, for Sam. NOTHING here runs unless kitSwap() is called, a reload is
 *  handed a `hand` / `keep` beat, or closeK is fed: every pose is otherwise what it was.
 *  A SWAP (kitSwap(from, to) → kitLayer) is the right hand's errand, by IK over whatever the layers under it pose: the item in the fist is carried to where it
 *  LIVES and left there (`stow` s), the empty hand goes on to where the next one lives (`reach` s) and brings it up into the pose underneath (`draw` s) — or just
 *  comes back (`away`). An item changed for another is hurried (`swapK` ×); between the shoulder and the hip the empty hand has `far` s more. Where things live:
 *    pistol  the thigh holster — the wrist exactly where the holstered gun's own frame (rigProps holsterFrameOf) wants a hand that holds it
 *    rifle   `apex`: the fist over the right shoulder with the muzzle down his back (off the right shoulder joint, trunk frame [to his left, up, forward]); the
 *            hand is there by `apexAt` of the stow and waits while the rifle goes down onto the sling (the drawer carries it: kitStow) — and the reverse coming off
 *    can     `belt`: a pouch on the right front of the belt (off the pelvis, trunk frame)
 *    knife   the sheath on his chest (sheathFist: the fist closed on the handle where rigProps draws it)
 *  `arc` = how far the hand's path bows out at its middle (trunk frame) so it goes ROUND the body, `cross` the same for an empty hand going from one place to the
 *  next. The support hand: with a gun coming it waits at `rest` (off its own shoulder) and joins over the last `1 − join` of the draw; a gun put away with no gun after it, it lets go of over `letGo` s; otherwise it is left alone. */
export type KitItem = 'pistol' | 'rifle' | 'can' | 'knife';
/** A SMOKE's arm (smokeLayer; the rule and its switch are game/smokebreak.ts, which this file must not import: it would be evaluated in the middle of this
 *  one in the page's bundle): the wrist's place in the HEAD's frame [his left, up, forward] off the head joint, the fingers' and the back of the hand's
 *  directions in that frame, the elbow's pole in the body's, a shrug of the shoulder °, the fingers' curl; `rate` = the most of the way the hand goes in a
 *  second, `away` = the same once something else has taken the arm. FIRST-PASS numbers, never seen in the renderer. Authored data. */
export const SMOKEARM = { at: [0.075, -0.15, 0.125] as Vec3, fingers: [-0.55, 0.8, -0.1] as Vec3, back: [0.35, 0.1, 0.9] as Vec3, pole: [0.7, -0.6, 0.35] as Vec3, shrug: 5,
  curl: [0.3, 0.34, 0.6, 0.66] as [number, number, number, number], thumb: 0.3, rate: 1.9, away: 3 };
export const KIT = {
  stow: { pistol: 0.3, rifle: 0.54, can: 0.26, knife: 0.34 } as Record<KitItem, number>,
  reach: { pistol: 0.17, rifle: 0.28, can: 0.16, knife: 0.2 } as Record<KitItem, number>,
  draw: { pistol: 0.26, rifle: 0.43, can: 0.2, knife: 0.2 } as Record<KitItem, number>,
  away: 0.22, swapK: 0.8, far: 0.28, apexAt: 0.85, slingAt: 0.55, join: 0.35, letGo: 0.3,
  apex: { at: [-0.03, 0.1, -0.19] as Vec3, fing: [0.35, -0.75, -0.55] as Vec3, back: [0, -0.2, -1] as Vec3, pole: [-1, 0.25, 0] as Vec3 },
  /** WHAT AN ARM CAN DO (the maintainer, 10-10, of rifle → grenade: "nonphysical for some joints + really fast"; tools/qa/kitanim-joints.ts measures every change
   *  against these): the errand's wrist never comes nearer its own shoulder than leaves the elbow `elbowMin`° open — a path that cuts past the shoulder goes
   *  ROUND it —, the hand is never bent more than `wristMax`° off its forearm (eased in from `wristKnee`°; what it carries turns with it), a rifle is laid along the hand
   *  over the first `rollIn` of the hand's trip to the shoulder (0.35 for the rest) and comes back onto the aim over the last `rollIn` of the trip down, the empty hand going
   *  between shoulder and hip bows out by `crossFar`, and while a rifle is on its way the trunk under the arms re-stands at `trunk` 1/s (the aim's own 14 squared
   *  the chest 10° on the key's frame) with the long gun's carriage eased in, not taken at once. */
  elbowMin: 44, wristKnee: 46, wristMax: 66, rollIn: 0.5, over: [-0.03, 0.34, 0.22] as Vec3, up: [-0.14, 0.22, 0.14] as Vec3, top: { fing: [0, 1, 0.25] as Vec3, back: [-0.8, 0, 0.6] as Vec3 }, trunk: 6,
  belt: { at: [-0.15, 0.04, 0.13] as Vec3, fing: [0.25, -0.9, 0.2] as Vec3, back: [-0.5, 0, 0.85] as Vec3, pole: [-1, -0.1, -0.5] as Vec3 },
  holsterPole: [-0.7, 0.15, -1] as Vec3, sheathPole: 0.9,
  rest: [0.03, -0.36, 0.2] as Vec3,
  arc: { pistol: [-0.05, 0, 0.05], rifle: [-0.1, 0.2, 0], can: [-0.03, 0, 0.05], knife: [0, 0, 0.05] } as Record<KitItem, Vec3>,
  cross: [-0.16, 0, 0.1] as Vec3,
  /** THE RIFLE ON A SLING IN FRONT (a loud kit; anim.kitFront — rigProps SLING_FRONT is where it hangs, and the hand's place there is read off it): let down
   *  out of the shoulder and let go of, taken up again by the grip. Its own, shorter, times (no trip over the shoulder, no `far`); `handAt` / `slingAt` as
   *  apexAt / slingAt above; `arc` = the bow of the way down (ahead of him: clear of the chest rig); `pole` = the elbow, down and out by his right side. */
  front: { stow: 0.36, reach: 0.2, draw: 0.32, handAt: 0.8, slingAt: 0.45, arc: [0, 0.02, 0.07] as Vec3, pole: [-0.75, -0.55, -0.4] as Vec3 },
  /** NIGHT VISION flipped down / up (nvFlip; the maintainer, 10-10: "should have animations for putting on and taking off night vision. if hands are busy it's a
   *  nod of the head for flicking on and off. otherwise hand does it."). hand: the LEFT hand goes up to the goggles (reach), carries them down / up (the flip
   *  window, s from the start) and comes away (out); `up` / `down` = the wrist's place with the goggles up / down in the HEAD's frame [his left, up, forward]
   *  off the head joint, `fingers` / `back` = the fingers' and the back of the hand's directions in that frame, `pole` the elbow's in the body's, a shrug of the
   *  shoulder °, the fingers' curl; rate = the most the arm's share may change a second, away = the same once something else has taken the arm mid-flip (it
   *  has all of it inside 1 / away s; the reach is as long as it is because a hand that goes from the hip to the brow any quicker moves faster than a hand does). nod: the
   *  head alone — on = [a small tip back first, the dip that drops them] °, off = [a small dip, the toss that throws them up] (+ = chin down), pre / peak = when
   *  each is at its most, s; the goggles move in `flip`. FIRST-PASS numbers, never seen in the renderer. */
  nv: {
    hand: { dur: 0.92, reach: 0.38, out: 0.36, flip: [0.38, 0.52] as [number, number], up: [0.084, 0.178, 0.1] as Vec3, down: [0.086, 0.08, 0.12] as Vec3, fingers: [-0.75, 0.6, 0.1] as Vec3, back: [0.55, 0.1, 0.83] as Vec3,
      pole: [0.7, -0.6, 0.35] as Vec3, shrug: 8, curl: [0.45, 0.5, 0.55, 0.6] as [number, number, number, number], thumb: 0.35, rate: 4.2, away: 2.6, clear: 6 },
    nod: { dur: 0.36, pre: 0.07, peak: 0.18, flip: [0.12, 0.22] as [number, number], on: [-5, 19] as [number, number], off: [7, -15] as [number, number], carry: 0.12 },
  },
  fist: [0.62, 0.68, 0.72, 0.76], open: [0.26, 0.3, 0.34, 0.38],
  /** A PISTOL's magazine change, the support hand's (pistolReloadArm; marks in the gun's frame off the trigger wrist — x his left, y up out of the slide, z the
   *  bore — and the support hand's WRIST): `well` = the palm under the butt, `strip` = clear of it with the magazine, `slide` → `pull` = over the back of the slide
   *  and run; `pouch` = the fresh ones (left front of the belt), `dump` = where a magazine with rounds left in it is put away (left hip, behind; both guns'), `via` = the way there, out ROUND his side and not through his belly — all off the
   *  pelvis, trunk frame. */
  mag: { well: [0.085, -0.125, -0.005] as Vec3, strip: [0.09, -0.21, -0.02] as Vec3, slide: [0.05, 0.07, -0.02] as Vec3, pull: [0.05, 0.07, -0.085] as Vec3,
    pouch: [0.17, 0.03, 0.12] as Vec3, dump: [0.21, 0.0, -0.13] as Vec3, via: [0.31, 0.14, 0.1] as Vec3, pole: [0.75, -0.55, -0.3] as Vec3, poleW: 0.7,
    wf: [-0.75, 0.55, 0.3] as Vec3, wb: [0.3, -0.75, 0.55] as Vec3, sf: [-1, -0.15, 0.1] as Vec3, sb: [0, 1, 0] as Vec3 },
  /** CLOSER THAN EVER BY DISTANCE (closeK 0 = just inside the mode … 1 = in reach; the maintainer, 10-10: "sam's hand looks pretty static. and it should be
   *  reaching for his knife … sam's state vary continuously with his distance to the enemy"): `far` = the share of the carriage (the drop, the bow, the rounded
   *  shoulders) he has at the mode's edge — all of it in reach; the right hand goes from CREEP.R's spot to hover `hover` m off the hilt (bowed out by `bow`,
   *  trunk frame, on the way); THE LEFT HAND STAYS WITH THE CROUCH (the maintainer, 10-10: "sam's left hand should also mostly be for the crouching animation and then only
   *  reach out for the enemy when quite close (like when his hand is fully on the knife)"): `left` = the share of the carriage's raised lead hand the left arm takes
   *  on the way in (the rest is the clip's own arm), `lead` = how far that hand comes up and out with the distance, and in reach its move for the man (readyLayer)
   *  starts only once the right hand's clock is `leftAt` of the way onto the hilt, over `leftIn` s (back over `leftOut`); `rate` 1/s = how fast the shown state follows the distance; and the hands are alive:
   *  fingers working at `flex` Hz by `flexAmp` of curl, the wrists drifting `drift` m, the fist on the hilt re-seating its grip every `regrip` s. */
  close: { far: 0.4, hover: 0.045, bow: [-0.02, 0.01, 0.035] as Vec3, lead: [0, 0, 0] as Vec3, left: 0.3, leftAt: 0.85, leftIn: 0.24, leftOut: 0.2, rate: 7, flex: 0.55, flexAmp: 0.1, drift: 0.008, regrip: 1.7, curl: 0.5 },
};
/** the eased numbers' layout (CharacterAnimator.rd): the two hands' offsets off their shoulders (model axes), poles, fingers / backs, then the scalars */
const RD = { l: 0, r: 3, lPole: 6, rPole: 9, lFing: 12, lBack: 15, rFing: 18, rBack: 21, lean: 24, blade: 25, wR: 26, lCurl: 27, lThumb: 28, lSpread: 29, rCurl: 30, rThumb: 31, clav: 32, into: 33, up: 35 }, RD_N = 36;
/** Overhand throw timing (s): the whole one-shot, and the instant the canister leaves the hand — the hand passing in front of the head at its fastest, at the end
 *  of the delivery. player.ts spawns the item at exactly THROW_RELEASE into the wind-up (pendingThrow), so a beat that clicks at T has its can in the air at
 *  T + THROW_RELEASE. Phases: wind-up 0 → 0.165 (top of the backswing), delivery → 0.28 = release, follow-through → ~0.48, recovery → 0.75. (Any earlier and
 *  the delivery is under four frames at 60 Hz — the hand covers its 0.7 m between two pictures and reads as a cut, not a whip; the wind-up from a hanging arm
 *  is already as brisk as one can look.) */
export const THROW_DUR = 0.75; export const THROW_RELEASE = 0.28;
const THROW_TOP = 0.165;
/** The throw's body English, degrees / metres over time, every channel starting and ending at zero (it goes straight into the pose at full weight). Yaw + = to
 *  the figure's left = the way a right-hander unwinds; the chest curve is the TOTAL turn of the shoulders, the pelvis its own share (the spine makes up the
 *  difference) — the pelvis turns back ≈ 25 ms before the shoulders do, and both go through square and past it before settling. */
const THR = {
  chestYaw: [[0, 0], [0.07, -9], [THROW_TOP, -26], [0.19, -25], [0.225, -14], [0.26, -3], [0.30, 6], [0.36, 10], [0.48, 7], [0.62, 2], [THROW_DUR, 0]] as Keys,
  pelvisYaw: [[0, 0], [0.07, -3.5], [0.145, -9], [0.17, -8], [0.21, 1], [0.25, 6.5], [0.31, 8], [0.44, 6], [0.60, 1.5], [THROW_DUR, 0]] as Keys,   // leads: turning back from 0.145 s (the chest from 0.17), through square by the release
  pitch: [[0, 0], [THROW_TOP, -4], [THROW_RELEASE, 4], [0.38, 9], [0.48, 7], [0.62, 2], [THROW_DUR, 0]] as Keys,          // + = forward: a touch of arch loading up, then over the front leg
  roll: [[0, 0], [THROW_TOP, 3], [THROW_RELEASE, -7], [0.38, -8], [0.48, -4], [0.66, 0], [THROW_DUR, 0]] as Keys,          // + = left shoulder up: the trunk tips off to the glove side as the arm comes over
  pelX: [[0, 0], [THROW_TOP, -0.02], [0.30, 0.025], [0.48, 0.02], [0.70, 0], [THROW_DUR, 0]] as Keys,                      // weight onto the back (right) foot, then across onto the front one
  pelY: [[0, 0], [THROW_TOP, -0.015], [THROW_RELEASE, -0.01], [0.40, -0.02], [0.58, -0.008], [THROW_DUR, 0]] as Keys,
  pelZ: [[0, 0], [THROW_TOP, -0.03], [THROW_RELEASE, 0.02], [0.39, 0.045], [0.54, 0.03], [THROW_DUR, 0]] as Keys,
  clavUp: [[0, 0], [THROW_TOP, 9], [THROW_RELEASE, 7], [0.40, 3], [0.62, 0], [THROW_DUR, 0]] as Keys,                     // scapula up with the raised arm…
  clavFwd: [[0, 0], [THROW_TOP, -4], [THROW_RELEASE, 5], [0.39, 8], [0.54, 3], [0.70, 0], [THROW_DUR, 0]] as Keys,          // …back in the wind-up, thrown forward through the release
  // right (throwing) hand from its shoulder joint, model axes [left, up, forward], from the top of the backswing (up behind the head, elbow folded to ≈ 80°) on: the
  // elbow leads and the hand lays back, then comes over the top past the head, fastest through the release out in front (elbow opening to ≈ 120°), down and across
  // to the left hip. The way up (hanging under the lifting elbow, then out behind it) and the way back (round beside the thigh) are built per frame off the live
  // hand of the pose underneath (throwLayer)
  handR: [[THROW_TOP, [-0.19, 0.21, -0.20]], [0.205, [-0.21, 0.27, -0.10]], [0.245, [-0.16, 0.27, 0.14]],
    [THROW_RELEASE, [-0.06, 0.16, 0.42]], [0.31, [0.06, -0.08, 0.47]], [0.37, [0.13, -0.27, 0.37]], [0.44, [0.16, -0.35, 0.28]], [0.50, [0.14, -0.38, 0.29]]] as Keys3,
  // where the right ELBOW goes meanwhile, as a swivel angle about the shoulder→hand line (degrees, see swivelPole: measured in a basis built off a reference
  // direction the hand never points along, so the pole is square to the reach by construction and cannot flip however the hand sweeps past the elbow's
  // bearing). Each key was solved offline for the elbow spot wanted against the hand key of its time: swung out sideways and up to shoulder height while the
  // hand still hangs below it (−103°), straight out at the top with the forearm cocked up behind (−176°), forward and high leading the delivery (−149°), level
  // through the release (−185°), turning over above the hand's line through the follow-through (−235°), back out behind the body coming down (−105°)
  swivR: [[0, -62], [0.06, -103], [0.125, -166], [THROW_TOP, -176], [0.205, -149], [0.245, -184.6], [THROW_RELEASE, -184.6], [0.31, -232.9], [0.37, -240.9], [0.44, -234.7], [0.50, -214.4], [0.62, -105.4], [THROW_DUR, -62]] as Keys,
  fingR: [[0, [0, -1, 0.15]], [0.07, [-0.1, -0.75, -0.65]], [0.115, [0, 0.6, -0.8]], [THROW_TOP, [0.15, 1, -0.35]], [0.23, [0.1, 1, -0.5]], [THROW_RELEASE, [0.05, 0.75, 0.65]], [0.32, [0.1, -0.35, 0.95]], [0.38, [0.3, -0.75, 0.6]], [0.48, [0.25, -1, 0.25]], [0.62, [0.05, -1, 0]], [THROW_DUR, [0, -1, 0.15]]] as Keys3,   // fingers: cocked back under the can at the top, laid back as the elbow leads, over the top and flicked past straight at the release, hanging after
  backR: [[0, [-1, 0, 0]], [0.07, [-1, 0.1, -0.2]], [0.115, [-0.8, -0.1, -0.6]], [THROW_TOP, [-0.3, -0.3, -1]], [0.23, [-0.4, -0.4, -0.9]], [THROW_RELEASE, [-0.2, 0.5, -0.8]], [0.32, [-0.3, 0.9, 0.3]], [0.38, [-0.6, 0.5, 0.6]], [0.48, [-0.7, 0.1, 0.7]], [0.62, [-1, 0, 0.2]], [THROW_DUR, [-1, 0, 0]]] as Keys3,   // back of the hand: palm forward behind the head, turning over (pronating) through the follow-through
  // left (balance) hand from its shoulder joint: up loosely toward the target, then pulled in to the ribs as the right comes through (ends built off the live hand too)
  handL: [[0.17, [0.10, -0.06, 0.44]], [0.24, [0.10, -0.12, 0.38]], [0.31, [0.06, -0.28, 0.22]], [0.40, [0.05, -0.33, 0.18]], [0.52, [0.07, -0.40, 0.13]]] as Keys3,
  swivL: [[0, 83], [0.09, 136.5], [0.17, 149.2], [0.24, 156.6], [0.31, 142], [0.40, 134.9], [0.52, 123.3], [0.63, 106.8], [THROW_DUR, 83]] as Keys,   // left elbow, same scheme (mirrored reference): down and out under the reach, winging out and back for the tuck
  fingL: [[0, [0, -1, 0.15]], [0.09, [0.1, -0.4, 0.9]], [0.17, [0.05, 0.15, 1]], [0.25, [0.1, 0.35, 0.9]], [0.33, [0.15, 0.6, 0.8]], [0.52, [0.1, 0.3, 0.9]], [0.63, [0.1, -0.7, 0.6]], [THROW_DUR, [0, -1, 0.15]]] as Keys3,
  backL: [[0, [1, 0, 0]], [0.09, [0.5, 0.8, 0.3]], [0.17, [0.3, 1, -0.1]], [0.25, [0.7, 0.7, -0.2]], [0.33, [1, 0.1, -0.3]], [0.52, [1, 0.2, -0.2]], [0.63, [1, 0.2, 0]], [THROW_DUR, [1, 0, 0]]] as Keys3,
};
/** A THROW READS ITS DISTANCE (the maintainer, 10-16, over a can thrown at a wall two steps off with the full wind-up: "we should have different animations
 *  based on how far you're throwing something"). throwItem's `dist` = metres over the floor from the thrower to where the arc ends; with `on` (off in the
 *  module and on the frozen stand, TPS_THROWBY=1; on in the page, ?nothrowby = one swing for every throw) it picks the swing. Three reads on ONE CLOCK — the
 *  can leaves every one of them at THROW_RELEASE, and where it starts and how it flies are the thrower's, not the swing's:
 *   · under `toss` m, and thrown under `tossFast` m/s over the floor (a hard throw a wall stops two steps off is no toss: it is the shortest overhand) — an
 *     UNDERHAND TOSS (THR_LOW): the arm swings back past the hip and through, the wrist never above the shoulder; the backswing is `tossMin` of its size at
 *     arm's length, all of it at `toss` m (drawn in toward `tossPivot`, off the shoulder: the hanging hand). From a hand up in front of him (a gun) there is
 *     no backswing to whip into: past what `tossIn` m/s reaches by the top, the hand drops on one arc to the swing's low point and scoops from there. The
 *     other arm is left to the pose underneath, or, up on a gun's support grip, is let down to hang (TOSS_HANG) for the swing;
 *   · from `toss` to `full` m — the overhand SHORT-ARMED: the body's turn, lean and weight shift from `turnMin` of their size up to all of it, the hand's path
 *     drawn in toward `pivot` (out beside the shoulder: the hand cocks no further back than the ear) from `armMin` of its size up to all of it — but back at
 *     its authored size for `through` s either side of the release, so it lets go where the whole throw does and the path has no corner — the balance arm's
 *     path and turn toward the pose underneath from `offMin`, the crouched sit-up from `sit`, by a smoothstep of the distance;
 *   · `full` m and over — the overhand as authored. No distance told, or the switch off, is that too, bit for bit.
 *  With the switch on the fist also drops its can the frame the thrown one is in the air (combat.ts: `throwing` runs three frames past the release).
 *  The body the picture shows is the body the guards see and shoot at (one model): a toss keeps a crouched head down where the overhand sits him up.
 *  UNTUNED by eye (nobody has seen these on a GPU). */
export const THROW_BY = { on: false, toss: 3, tossFast: 7.3, tossIn: 4, tossMin: 0.6, through: 0.07, tossPivot: [-0.07, -0.46, 0.08] as Vec3, full: 10, turnMin: 0.4, armMin: 0.5, offMin: 0.45, sit: 0.6, pivot: [-0.2, 0.06, 0.18] as Vec3 };
/** The underhand toss, THR's body and right-arm channels key for key (same axes, same clock: the hand lets go at THROW_RELEASE; the backswing tops out
 *  earlier, at TOSS_TOP, so the swing through is no faster than the overhand's): the knees give and the trunk bows as the arm goes back, the weight comes
 *  through onto the front foot with the swing; the hand goes back past the hip, down by the thigh at its lowest, and lets go RISING, at chest height out in
 *  front just under the shoulder — as near as an underhand swing gets to where the can starts (the thrower's throw origin, shoulder height) — then follows through open, palm up;
 *  the elbow stays behind and under the hand's line (swivel solved offline against each hand key, as THR's). The balance arm is left to the pose underneath. */
const TOSS_TOP = 0.10, TOSS_LOW = 0.165;
/** where a toss lets the balance arm down to when it is up in front of him: hanging by his side, off its shoulder joint */
const TOSS_HANG: Vec3 = [0.10, -0.47, -0.02];
const THR_LOW = {
  chestYaw: [[0, 0], [0.05, -4], [TOSS_TOP, -9], [0.17, -5], [0.25, 1], [0.36, 5], [0.55, 2], [THROW_DUR, 0]] as Keys,
  pelvisYaw: [[0, 0], [0.09, -4], [0.16, -1], [0.24, 2], [0.40, 3], [0.60, 0.5], [THROW_DUR, 0]] as Keys,
  pitch: [[0, 0], [0.11, 9], [0.20, 7], [0.29, 1], [0.40, -2], [0.60, 0], [THROW_DUR, 0]] as Keys,
  roll: [[0, 0], [TOSS_TOP, 3], [0.22, 2], [0.45, 0], [THROW_DUR, 0]] as Keys,
  pelX: [[0, 0], [TOSS_TOP, -0.012], [THROW_RELEASE, 0.012], [0.50, 0.006], [THROW_DUR, 0]] as Keys,
  pelY: [[0, 0], [0.12, -0.045], [0.20, -0.035], [0.31, 0], [0.42, 0.005], [0.60, 0], [THROW_DUR, 0]] as Keys,
  pelZ: [[0, 0], [TOSS_TOP, -0.015], [THROW_RELEASE, 0.03], [0.50, 0.015], [THROW_DUR, 0]] as Keys,
  clavUp: [[0, 0], [TOSS_TOP, -3], [0.30, 5], [0.60, 0], [THROW_DUR, 0]] as Keys,
  clavFwd: [[0, 0], [TOSS_TOP, -5], [THROW_RELEASE, 6], [0.50, 2], [THROW_DUR, 0]] as Keys,
  handR: [[TOSS_TOP, [-0.13, -0.41, -0.32]], [TOSS_LOW, [-0.10, -0.53, -0.02]], [0.225, [-0.07, -0.36, 0.37]], [THROW_RELEASE, [-0.05, -0.08, 0.50]], [0.34, [-0.04, -0.06, 0.52]], [0.46, [-0.04, -0.08, 0.49]]] as Keys3,
  swivR: [[0, -62], [TOSS_TOP, -78.8], [0.165, -82.2], [0.225, -107.2], [THROW_RELEASE, -121.9], [0.34, -122.7], [0.46, -121.7], [0.62, -84], [THROW_DUR, -62]] as Keys,
  fingR: [[0, [0, -1, 0.15]], [0.06, [0, -0.95, -0.3]], [TOSS_TOP, [-0.1, -0.8, -0.6]], [0.165, [0, -1, 0]], [0.225, [0, -0.7, 0.7]], [THROW_RELEASE, [0, -0.1, 1]], [0.34, [0, 0.2, 1]], [0.46, [0, 0.1, 1]], [0.62, [0, -0.8, 0.55]], [THROW_DUR, [0, -1, 0.15]]] as Keys3,
  backR: [[0, [-1, 0, 0]], [0.06, [-1, 0, -0.1]], [TOSS_TOP, [-0.9, 0.1, -0.4]], [0.165, [-0.6, -0.1, -0.8]], [0.225, [-0.35, -0.7, -0.6]], [THROW_RELEASE, [-0.25, -0.95, -0.1]], [0.34, [-0.25, -0.95, 0.15]], [0.46, [-0.4, -0.9, 0.1]], [0.62, [-0.9, -0.3, 0]], [THROW_DUR, [-1, 0, 0]]] as Keys3,
};

/** THE BIG SLOT'S TOOLS IN HIS HANDS (CharacterAnimator.bigTool → bigLayer; the maintainer, 10-15, over Door Kickers 2 footage: "the character should have a
 *  hammer on their back, they put away their gun, equip the hammer, wind up, and then hit the door in one motion"). game/bigkit.ts owns the beat and its clock;
 *  this is what a body does with those times — a function of the record, never a clock of its own. rigProps BIGRIG is the drawer's half (where the tool rides on
 *  his back, how it lies in the fists) and the two read the same numbers for the fists' places on the handle.
 *  The shares are of `equip` (and of `stow`, run backwards): his gun has left his hands by `hide` (hideHeldItem), the right fist is over his shoulder on the tool
 *  by `grab`, the tool leaves his back for the fist over `take` (bigK), the left hand is on it over `join`; stowing, it is on his back again by `put`, the left
 *  hand is off it by `unjoin` and his own gun shows again from `show`. `arc` = how far the right fist bows out round the shoulder on its way (trunk frame: his
 *  left, up, forward), `wait` = where the left hand waits meanwhile, off its own shoulder.
 *  `snug` (the record's own word, bigkit.ts BIGSLOT.snug) = the four shares that keep each thing in a hand while it is off him: his own gun is let go as his
 *  hands leave it (it was carried a third of the way to his shoulder, the other hand 15 to 30 cm off it), and the tool changes between his back and his fist
 *  while the fist is THERE (`take` round `grab`; back onto him over the last `1 - putAt` of `put`) — it was drawn part way between the two for a quarter of the
 *  move, up to 10 cm out of a fist already on its way down. The shares above them are the build before's.
 *  THE HAMMER, as (g, d): g = the right fist's grip off the right shoulder joint, d = the handle's line, butt → head. `ready`: held across him, head up by the
 *  right shoulder (legs free: nothing of the trunk or the feet). A blow's window (`windup` s before it lands, never reaching back past the blow before): raised
 *  to `wound` over `raise` of what the swing leaves, held, then the swing — the last `swing` share of the window, kept between swingMin and swingMax s — over the
 *  top (`over`) into the point struck, the head ON it at the blow's time, and `rebound` s back off it. Body: the chest turned away and the weight back wound up
 *  (yaw / pelYaw / pitch °, back m — off the chest squared onto the point, `face` of the way), through and over the front foot at the blow; `far` = the reach (m, pelvis to the point) over which he leans in further;
 *  `butt` = where the butt end wants to be at the blow, off the pelvis toward the point [to its left, up, toward it]; `stance` = each foot's step out for it.
 *  THE SHOTGUN: the stock in the right shoulder's pocket (`pocket`, off that joint), the bore on the point; bladed (`yaw` / `pelYaw` °), a little over it
 *  (`pitch`); each shell a kick (`kick` m back up the bore, `climb` ° of muzzle, over `kickIn` s, gone in about three `kickOut`).
 *  FIRST-PASS numbers, placed against headless stick strips (tools/qa/bigmoves-strip.ts); never seen in the renderer. */
const BIGMOVE = {
  hide: 0.28, grab: 0.5, take: [0.47, 0.82], join: [0.65, 0.96], put: 0.58, putAt: 0.45, unjoin: 0.28, show: 0.85,
  snug: { hide: 0.06, take: [0.44, 0.56], putAt: 0.8, show: 0.94 },
  arc: [-0.16, 0.12, 0.04] as Vec3, wait: [-0.1, -0.34, 0.2] as Vec3,
  hammer: {
    ready: { g: [0.06, -0.1, 0.34] as Vec3, d: [-0.42, 0.9, -0.1] as Vec3 },
    wound: { g: [-0.12, 0.2, -0.05] as Vec3, d: [-0.45, 0.3, -0.84] as Vec3 },
    over: { g: [0.04, 0.14, 0.24] as Vec3, d: [-0.08, 0.93, 0.36] as Vec3 },
    grabAt: 0.1, raise: 0.6, swing: 0.38, swingMin: 0.1, swingMax: 0.2, rebound: 0.25, settle: 0.5,
    butt: [0.18, 0.05, 0.18] as Vec3, far: [0.6, 1.1] as [number, number],
    woundBody: { yaw: -50, pelYaw: -17, pitch: -7, back: 0.09, side: -0.03 },
    blowBody: { yaw: 16, pelYaw: 7, pitch: 15, pitchFar: 11, fwd: 0.07, fwdFar: 0.08, drop: 0.03 },
    face: 1, drop: 0.035, stance: { l: [0.06, 0.07] as [number, number], r: [-0.07, -0.1] as [number, number], lift: 0.025 },
  },
  shotgun: { pocket: [0.035, -0.05, 0.06] as Vec3, yaw: -22, pelYaw: -10, pitch: 6, kick: 0.08, climb: 12, kickIn: 0.04, kickOut: 0.13, kickPitch: -6, shove: 0.035 },
  fist: [0.74, 0.8, 0.84, 0.88], open: [0.26, 0.3, 0.34, 0.38],
};
/** how long a blow or a shell that has LANDED is followed through before the tool may start back (s): the table's own numbers — the game's clock asks here
 *  (bigkit.ts), so the stow never starts inside the rebound */
export const bigRebound = (kind: 'hammer' | 'shotgun'): number => (kind === 'hammer' ? BIGMOVE.hammer.rebound : BIGMOVE.shotgun.kickIn + BIGMOVE.shotgun.kickOut);
/** bigTool: his hands are off his own gun for it this frame (hideHeldItem) — from `hide` of the equip until `show` of the stow */
export function bigOff(B: { t: number; equip: number; stow: number; end: number; snug?: boolean }): boolean {
  if (!(B.t >= 0)) return false;
  const S = B.snug ? BIGMOVE.snug : BIGMOVE;
  if (B.end >= 0 && B.t >= B.end) return (B.t - B.end) / Math.max(1e-3, B.stow) < S.show;
  return B.t >= S.hide * B.equip;
}
/** a unit direction turned k of the way to another (the short way round) */
function dirMix(a: Vec3, b: Vec3, k: number): Vec3 { return k <= 0 ? a : k >= 1 ? b : v3.normalize(quat.rotate(quat.slerp([0, 0, 0, 1], quat.fromTo(a, b), k), a)); }

/** Animation graph producing a local pose + twist list each frame. */
/** Where a ray enters a vertical column (centre cx,cz, radius r, y from bot to top) — through its side, its top or its bottom; −1 for a miss, an origin inside it, or beyond tmax. */
function columnEntry(ro: Vec3, rd: Vec3, tmax: number, cx: number, cz: number, r: number, bot: number, top: number): number {
  const ox = ro[0] - cx, oz = ro[2] - cz; const a = rd[0] * rd[0] + rd[2] * rd[2]; const bq = ox * rd[0] + oz * rd[2]; const c = ox * ox + oz * oz - r * r;
  let c0 = -Infinity, c1 = Infinity;                       // the ray's span inside the infinite column
  if (a < 1e-8) { if (c > 0) return -1; }                   // straight up or down: inside it all the way, or never
  else { const disc = bq * bq - a * c; if (disc < 0) return -1; const sq = Math.sqrt(disc); c0 = (-bq - sq) / a; c1 = (-bq + sq) / a; }
  let s0 = -Infinity, s1 = Infinity;                       // … and inside the bot-to-top slab
  if (Math.abs(rd[1]) < 1e-8) { if (ro[1] < bot || ro[1] > top) return -1; }
  else { s0 = (bot - ro[1]) / rd[1]; s1 = (top - ro[1]) / rd[1]; if (s0 > s1) { const w = s0; s0 = s1; s1 = w; } }
  const tIn = Math.max(c0, s0), tOut = Math.min(c1, s1);
  if (tIn > tOut || tIn < 0 || tIn > tmax) return -1;
  return tIn;
}

export class CharacterAnimator {
  pose: Pose; private pA: Pose; private pB: Pose; private pC: Pose; private pUpper: Pose; private rest: Pose; private pAim: Pose;
  twists: TwistSpec[] = [];
  params: AnimParams = { ...defaultAnimParams };
  // inputs (set by controller each frame)
  speed = 0;                 // ground speed (m/s)
  reverse = false;           // play locomotion backwards (backpedal)
  crouchTarget = 0;          // 0 stand, 1 crouch
  upper: UpperMode = 'none';
  aimYawOffset = 0;          // chest yaw relative to body (rad)
  aimPitch = 0;              // rad, positive = up
  lookYawExtra = 0;          // additional head/neck yaw (looking around)
  lookPitchExtra = 0;        // additional head/neck pitch, + = chin down (the kit figure's alone — ui/kitFigure.ts: nothing in the game sets it, and 0 adds no twist)
  /** TURN (Character.turnWeigh): how far his wish is ahead of where his gun has got to, eased — the neck carries it, so the head is on a new point before the muzzle (rad; 0 with the weight off) */
  turnLead = 0;
  /** Ready posture layered under the aim layer (aim / firing still win): 'highReady' pistol up under the eye line, elbows in, leaning into it — pieing a corner,
   *  covering a door; 'lowReady' a conventional low ready: arms out and down, hands at belt height ~30 cm ahead of the pelvis, muzzle depressed ~42°, elbows soft,
   *  shoulders easy — moving between doors; 'stack' bladed to the wall on `stackSide`, compressed high ready,
   *  knees soft, head on the door. Arms only above the waist (legs keep the locomotion), eased in/out ≈ 0.3 s and morphing between kinds; composes with
   *  aimYawOffset (the chest twist turns the whole carry) and with walking / crouching (the gun stays level).
   *  'wall' is the player's back-to-the-wall hold (Q) and a body of its own (wallBody / wallArms, WALL_POSE): seat and shoulder blades on the wall behind
   *  (wallYaw), feet gathered under him along it, head turned along it toward stackSide, both palms flat back on the plaster either side of the hips (the
   *  hands are always free: the game holsters the pistol for the hold); crouched, a compact squat with the back still on the wall; sidling, the torso stays
   *  on the wall over the walking legs; wallPeek leans it out past the wall's end. In and out ≈ 0.2 s. */
  stance: Stance = 'none';
  /** which side the wall is on for 'stack': +1 = the figure's right, −1 = its left (mirrors blade, head and gun offset). For 'wall' (the wall is BEHIND): the way
   *  along it he looks and leads — +1 = to his right — which side the head turns, the gun comes up, the lead foot steps out and a peek leans. Flips ease (sprung). */
  stackSide: -1 | 1 = 1;
  /** 'wall' only: yaw of the wall's outward normal (into the room) off the figure's front, rad, + = to its left. 0 = the wall square behind him (parked); the
   *  controller turns the legs toward the direction of travel to sidle and says so here — the torso above is kept flat to the wall whatever the legs do. */
  wallYaw = 0;
  /** 'wall' only, 0…1: peeking round the wall's end on stackSide — the upper body leans out along the wall past the edge, the pelvis shifts onto the lead foot,
   *  the chest comes round a little (the neck's extra crane is the controller's lookYawExtra); the gun goes with the chest. Ramped by the controller, eased here too. */
  wallPeek = 0;
  /** A LEAN round an edge with the gun up, −1‥1 (+ = toward his own right): the trunk side-bent over hips that stay where they are, so the head and the gun
   *  go past a jamb his hips are still behind (LEAN_POSE; doortools.ts thrLean — a teammate cutting a doorway from outside). The AI's only: the player's own
   *  look round a wall's end is the 'wall' stance's wallPeek. 0 = nothing of it, his pose what it was to the bit. Eased here. */
  lean = 0;
  private leanSm = 0;
  /** WALLSNAP (wallsnap.ts; all four stand at their rest values with the switch off, and then nothing below reads differently): `wallTake` = the take's progress
   *  0‥1 while he is being eased onto the wall (−1 = none) — the feet stay where they stood in the world and STEP onto the hold's spots one after the other instead
   *  of sliding there under the blend; `wallHit` = the landing's settle 0‥1 (the pelvis dips, the head tips back toward the plaster); `stanceOut` = the rate the
   *  stance weight leaves at (0 = the stance's own); `stackPress` = 'stack' only, SIGNED metres the whole figure stands toward the wall (+ = the wall on his
   *  stackSide +1 hand; its shoulder to the plaster: the body's circle keeps the root further out than a shoulder is wide), eased here. `stanceIn` = the rate
   *  the hold's pose comes on at while he holds a wall (WALLSNAP.slow; 0 = its own: 22 on the back hold, the stance's 13 on the stack). */
  wallTake = -1; wallHit = 0; stanceOut = 0; stackPress = 0; stanceIn = 0;
  private stackPressSm = 0; private wallGait = WALL_GAIT_REST; private wtkHold = false;   // (the press as shown: eased toward stackPress · the feet kept on the hold's spots from the end of a take until the pose's weight has caught up)
  /** …and where his soles stood, in the world, the frame the take began (the controller's: the joints as last drawn) — null = wherever this frame's pose has them */
  wallTakeFeet: { L: { p: Vec3; yaw: number }; R: { p: Vec3; yaw: number } } | null = null;
  private wtk: { L: { p: Vec3; yaw: number }; R: { p: Vec3; yaw: number }; first: 0 | 1; last: number } | null = null;
  /** Player: working a lock — forces the crouch, both hands come up to `lockpickAt` (pick in the right, tension wrench in the left) with small irregular wrist
   *  work, shoulders hunched, head in close and cocked. The pistol is not posed (the game holsters it). Eased in/out ≈ 0.35 s. */
  lockpick = false;
  /** the keyway in MODEL space (x to the figure's left, y up, z ahead of its root): default = just under a lever handle (doors.ts: 1.0 m), 0.45 m ahead */
  lockpickAt: Vec3 = [0.02, 0.96, 0.45];
  /** 0…1: how deliberately he moves — the game raises it as a living guard who has not yet clocked him comes close (game.ts threatProximity). The LOOK only,
   *  ground speed untouched: crouch-walking, the cycle is retimed longer and slower (cadence × 0.78 at 1, the stride warped longer by as much at the feet so the
   *  planted foot keeps exactly the ground it had), a linger over each plant with the body hanging back then coming on, the pelvis ~4 cm lower, the torso a
   *  few degrees further over with the head kept level, the arms drawn in to the body; walking upright, only the arms and a centimetre of knee. Eased in here
   *  (~0.4 s either way), so a guard flipping to alert relaxes it without a pop. Independent of it, the crouch also sits lower and steps longer as its pace
   *  comes up (sneakLayer). */
  deliberate = 0;
  /** the world point his head goes to, at this strength 0…1 (WATCH; null = none) · the man he gives room to, and by how much 0…1 */
  watchAt: Vec3 | null = null; watchK = 0; slipAt: Vec3 | null = null; slipK = 0; slipLean = 1;
  /** read back by the checks: the look's weight and yaw (rad) as shown, the slip's weight */
  watchShown = { w: 0, yaw: 0, slip: 0, lean: 1 };
  /** 0 / 1: Shift held in a crouch (player.ts CROUCHRUN) — the crouch walk's long, low stride (DASH). Not only a look: the cadence is the cycle's, and a footfall is filed off the cycle. */
  dash = 0;
  /** Player: he has a man from behind (player.ts updateHold) — the phase of it and the seconds into that phase; null = not. The layer (holdLayer) eases itself in
   *  and out on a spring, so the controller just sets and clears this: left arm round the man's throat, right hand clamped on his far shoulder, chest to his back,
   *  looking past his ear; the reach of the grab and the elbow closing for the choke are shaped off phase / t. The legs stay the cycle's.
   *  variant 'gun': the right hand keeps the pistol up beside the man's head instead (HOLD.gun) — presented forward by gunOut to fire past him (a shot's recoil is
   *  taken here, not by the aim clip), swung down behind his ear through 'whip'. */
  holdPose: HoldPose | null = null;
  /** Guard: he is the man being held (guards.ts held branch, posed by player.ts updateHold): arched back onto the arm with his chin up, left hand clawing at the
   *  forearm across his throat, the torch hand up and out (its beam on the ceiling), a struggle that grows with his agitation; through the choke his knees go, both
   *  hands come to the arm, then he hangs. Eased in / out on its own spring like holdPose; the legs walk at the pair's speed.
   *  variant 'gun': hands half raised instead, the head tipped away off the can at his temple, a duck when a round goes past it, and the head going with the blow
   *  at the end of 'whip'. */
  heldPose: HeldPose | null = null;
  /** A hand on the door he is pushing open (see DoorPush; doorLayer): set while he pushes a leaf and for a moment after, null otherwise. The free arm goes palm-flat
   *  onto the face he is pushing, eased in ≈ 0.15 s / out ≈ 0.25 s on the layer's own springs (doorHands() reads them back). */
  doorPush: DoorPush | null = null;
  /** Hands at work on a thing (see WorkPose; workLayer): FED EVERY FRAME the verb runs and taken — nulled — by update(), so a verb that stops feeding has let go.
   *  The layer eases in and out on its own springs and comes away from the last spot it was given. */
  work: WorkPose | null = null;
  /** What the gun hand is to carry (a guard's torch or his sidearm — guards.ts inHand), fed every frame like `work` (undefined = nobody asks: no swap, the hand holds
   *  what the rule says on the frame). A change between the two is a MOVE of the hand (swapLayer); swapHeld() is what it visibly holds meanwhile. */
  carry: CarryKind | undefined = undefined;
  /** how long THIS man keeps what he has before a swap of his starts, s (handwork.ts deals each man his own share of SWAP.lag; 0 = on the frame). For the eye only:
   *  the rule of what he carries, his first round and his bore do not wait on it, and a round fired meanwhile starts the move at once */
  swapLag = 0;
  /** Player: the body in his hands (see HaulPose; haulLayer): set while he reaches for it, lifts it, hauls it and sets it down, null otherwise — the layer eases
   *  in and out on its own spring and lets go from the last spots it was given. */
  haul: HaulPose | null = null;
  /** Rifles (docs/internal/sc20k-design.md §3): the figure carries a long gun in both hands — the guards' carbine. While set, the pistol carry (carryArms) and the aim
   *  clip's ARMS are replaced by the long-gun solve (longArms) every frame whatever upper / stance say, since the weapon never leaves the two hands: eased in and out
   *  on its own spring (a viewer toggle, a later draw / sling), and the wall hold, the holds, lock work, a hand on a door and the one-shots that own the arms
   *  (reload, hit, throw, the signal's left arm) still play over it. Which carriage (LONG): longStance if forced (viewer, scripts), else derived from what the pistol
   *  man would be doing — upper 'aim' or a shot playing → 'shoulder'; stance lowReady → 'lowLong'; highReady / stack / a kick → 'portLong'; anything else →
   *  'patrolLong' — so the AI writes upper / stance exactly as it does for a pistol and the rifleman follows. */
  longGun = false;
  longStance: LongStance | null = null;
  /** a wall (a leaf, a desk) stands inside the low ready's reach in front of him: 0 none ‥ 1 at his chest (‥ 2: and his torso turned into it) — how far the low carriages are pulled in (WALL_TUCK).
   *  game/gunwall.ts writes it every frame its rule is on; nothing else does, and at 0 nothing here is touched. */
  gunWall = 0;
  /** RUNREADY (player.ts, asked every frame): he is sprinting with the pistol in his hand — the low ready over the run, while no stance of his own is up */
  runReady = false;
  /** where the SUPPORT hand takes the long gun, in the trigger hand's gun frame (x the figure's left, y up out of the receiver, z along the bore, from the wrist):
   *  the left wrist's point and the fingers' / back-of-hand directions. rigProps.carbineGrip(RIG) works them out from RIG.carbine (its group adj + gripL) and
   *  whoever arms the figure writes them here (game.ts each frame, the viewer live); the defaults are RIG's shipped numbers */
  longGrip: { wrist: Vec3; fingers: Vec3; back: Vec3 } = { wrist: [0.1, 0.02, 0.24], fingers: [-0.6, 0.45, 0.65], back: [0.45, -0.85, -0.25] };
  /** Rifles: steady the long gun against the gait, 0 (the guards' riflemen, as they were) … 1 (Sam: player.ts armRifle, the viewer's Sam ▸ rifle scenes) — by the
   *  carriage's `steady` the trunk's lateral rock is kept out of the trigger hand's point, and at a run un-aimed the shoulder line is held to the weapon instead of
   *  pumping with the run clip (LONG_STEADY). Whoever arms the figure writes it with longGun. */
  longSteady = 0;
  /** output: the carriage on show this frame (null = no long gun in the hands) — the viewer's HUD line, the probes */
  longShown: LongStance | null = null;
  /** Output: whatever the right hand holds (pistol / canister) should not be drawn this frame — the hands are more than half way onto the lock tools (lockpick
   *  layer weight > 0.5) or BOTH round a held man (the hold layer > 0.5 on its knife side, holdGunSide false: the pistol rides the thigh; the gun side keeps it in
   *  the hand). Whoever draws the hand props (game.ts handProps, the viewer) reads this and shows an empty hand + the holstered sidearm instead. */
  hideHeldItem = false;
  /** HIS OWN GUN IS OUT OF HIS HANDS FOR A TWO-HANDED JOB (game/workstow.ts writes it every frame of one, a teammate's alone; false = his hands are his own): the
   *  work hands take the right as an empty hand whatever it carried, and a long gun's two keep nothing back. Read by workLayer and its gate only. */
  stowed = false;
  /** THE BIG SLOT'S TOOL IN HIS HANDS (bigkit.ts writes it every frame of the beat; null = his hands are his own). All times in seconds on the beat's own
   *  clock `t` (0 = his hands leave his gun). `equip` s: gun away, the tool into both hands. `blows`: the times each blow LANDS (hammer) / each shell goes
   *  (shotgun); a blow is wound up over the `windup` s before it. `end` ≥ 0: from then, `stow` s put the tool back and his hands return to his gun.
   *  `at`: the world point struck or shot (the lock, about a metre up the leaf). The pose is a function of this record and of the pose underneath, nothing
   *  else (bigLayer; BIGMOVE): the animator keeps no clock of its own for it, and never clears it — whoever wrote it nulls it. `snug`: the shares that keep
   *  his gun and the tool in a hand on the way (BIGMOVE.snug; absent = the build before's). */
  bigTool: { kind: 'hammer' | 'shotgun'; t: number; equip: number; windup: number; stow: number; blows: number[]; end: number; at: Vec3; snug?: boolean } | null = null;
  /** Output, for the drawer (combat.ts handProps → rigProps bigBoxes): where the big slot's tool is this frame — 0 on his back, 1 in his hands, between = on its
   *  way from one to the other. 0 whenever bigTool is null. While his hands are off his own gun for it hideHeldItem above is raised too. */
  bigK = 0;
  /** the drawer's word back (combat.ts handProps, a frame behind): something else lies across his back, the tool rides this many metres further off it
   *  (rigProps bigClearOf; 0 = nothing under it) — the hand that goes for the handle reaches that far */
  bigClear = 0;
  /** PACK SIDE (packside.ts; combat.ts handProps says it, as `bigClear`): the hammer stands at the side of the pack he wears — its grip point and its handle's
   *  line (butt → head) in the CHEST JOINT's own space, where the drawer has it. null = across his back, as ever */
  bigSide: { o: Vec3; z: Vec3 } | null = null;
  /** … how much of the right fist's place this frame is the hammer's place on his back, 0‥1 (bigLayer), and how far up the handle from its frame's origin the fist holds it */
  bigAtBack = 0; bigGrab = 0;
  /** Output: which side the hold's right hand is posed for this frame — false the knife fist (the arm hold), true the pistol grip (the gun hold). It is the
   *  variant's, snapped as a hold begins; when E changes the variant with the man already in the arm (player.ts swapHold) it flips as the eased hand-over
   *  passes half way, the fist then back behind the man's shoulder (holdLayer) — so the NEW tool only appears in the fist there (combat.ts handProps draws the
   *  knife by it, hideHeldItem above puts the pistol in the hand by it); the old one left on the key's frame with the variant / the holster flag. */
  holdGunSide = false;
  /** Viewer / debug: when set the graph is bypassed and this one clip plays raw over the rest pose (no layers, no twists) — for eyeballing
   *  the library's clips with the props attached. `time` advances by dt·rate inside update(). */
  rawClip: { clip: Clip; time: number; rate: number; loop: boolean } | null = null;
  /** A whole-body ACTION clip laid over the finished graph with an eased weight (game/civilians.ts: the late worker seated at his desk — Sitting_Idle_Loop — the
   *  cleaner kneeling at a bin — Fixing_Kneeling — a woman on the phone or telling a guard what she saw — Idle_Talking_Loop): `clip` by the library's name, looping
   *  or not, played at `rate`; `in` / `out` = seconds the weight takes to come and go. Set it and the clip fades in over everything (locomotion, life, the carries);
   *  clear it and the graph has the figure back over `out`. Nothing at all of it runs for a figure that has never been given one (every man on the floor and Sam:
   *  the layer is not so much as looked at while `act` is null and its weight is spent), so no other pose moves by a bit. Unknown clip names are ignored. */
  act: { clip: string; loop?: boolean; rate?: number; in?: number; out?: number } | null = null;
  /** DOZING (game/doze.ts — read only inside the action clip's layer, so nothing of it runs for a figure that has no `act`): how far a seated man has nodded off,
   *  0‥1 asked, eased here (slow down, quick up): the upper back rounds, the chin comes down onto the chest and a little to one side, and it all rides a slow breath. */
  slump = 0; private slumpW = 0;
  /** WOUNDS (game/wounds.ts — nothing of it runs for a figure that has never been given one): a man DOWN AND OUT OF THE FIGHT, played off the library's own clips.
   *  `pose` 'knee' = he sinks onto one knee, doubled over (Fixing_Kneeling's way down, held there) · 'back' = his leg goes and he ends on his back with a knee
   *  drawn up (Death01's fall, held short of its flat end — a dead man is the ragdoll's, never this). `at` = where the support hand presses: the ribs (the cast
   *  goal's hand to the ribs, at WOUND_AT) or the thigh. `settled` = start him already down (a checkpoint's man). Cleared → the graph has him back at once. */
  wound: { pose: 'knee' | 'back'; at: 'ribs' | 'thigh'; settled?: boolean; clock?: number } | null = null;
  private wdT = 0; private wdW = 0; private wdClip: Clip | null = null; private wdPose = '';
  /** output: the wound layer's weight this frame (0 = none of it in the pose) and how far down he is (0 on his feet … 1 on the floor) — the probes read them */
  get woundShown(): number { return this.wdW; }
  /** the layer's own clock, s since he started down (a checkpoint files it: his breath comes back where it was) */
  get woundClock(): number { return this.wdT; }
  get woundDown(): number { const wd = this.wound; if (!wd || !this.wdClip) return 0; const K = WOUND_POSE[wd.pose]; return clamp(this.wdT * K.rate / K.hold[0], 0, 1); }
  /** the action layer's clock, its eased weight, and the clip it last resolved (kept through the fade-out after `act` is cleared) */
  private actT = 0; private actW = 0; private actClip: Clip | null = null; private actName = ''; private actOut = 0.35;
  /** output: the action layer's weight this frame (0 = none of it in the pose) — the probes read it */
  get actShown(): number { return this.actW; }
  // internal state
  phase = 0;                 // normalized locomotion phase
  crouch = 0;
  private upperW = { relaxed: 0, aim: 0, torch: 0 };
  private tuK = 0;   // GUNHAND.whistle: the raised torch's own clock, 0 down ‥ 1 up, linear (torchUpLayer eases it; 0 with the rule off)
  private shootT = -1; private hitT = -1; private reloadT = -1; private throwT = -1; private strikeT = -1;
  private steadyMean: [number, number] | null = null;   // MOVES.steady: the crouch cycle's own mean pelvis roll (rad) and hips' sideways set (m), measured once (steadyLayer)
  private crWalk = 0;   // the crouch walk's share of this frame's pose (crouch shown × the cycle's weight in it): what MOVES.steady levels
  private steadyUp = 0;   // MOVES.steady setting 2: how far the pelvis is ridden up this frame (m), eased — 0 and never stepped at any other setting
  private snapShot = false;   // MOVES.snap: this shot's recoil is laid on the pitched aim — settled on its fire frame and kept for its length (a long gun's share coming or going mid-shot does not change how the shot is posed)
  /** MOVES: how drilled this figure is, 0 (never held one before) … 1 (an operator); 0.5 = neither (the gait is the clips' own). game.ts sets it per side. */
  trained = 0.5;
  /** MOVES: blinded by a stun charge that went off at world `from` — held by the controller for as long as he is (k 1 → 0 eases him back up); null = not */
  dazzle: { from: Vec3; k: number } | null = null;
  /** MOVES state: recoil (decaying sums the rounds add to), the flinch / hit / toss clocks with their directions (model space), the dazzle's eased weight */
  private mvs = { back: 0, climb: 0, yaw: 0, rock: 0, sho: 0, head: 0, n: 0,
    flT: -1, flK: 1, flKTo: 1, flSoft: false, flD: [0, 0, 1] as Vec3, stT: -1, stD: [0, 0, 1] as Vec3, htT: -1, htD: [0, 0, -1] as Vec3, htSide: 1, tsT: -1, tsRel: TOSS_RELEASE, armL: 0,
    dz: new Spring(), dzD: [0, 0, 1] as Vec3, dzT: 0, dzSd: 0, glide: new Spring(), hipY: NaN, cf: new Spring(), cfT: 0, hu: new Spring(), huT: 0, sk: new Spring() };
  /** a MOVES reaction has the trunk and head this frame (the life layer, the tells and the gaze stabiliser stand aside as they do for the old one-shots) */
  private get mvBusy() { const m = this.mvs; return m.flT >= 0 || m.stT >= 0 || m.htT >= 0 || m.dz.x > 0 || m.cf.x > 0; }
  /** …that also has his ARMS: all of them but a soft duck (a round going close: both hands stay where they are, so the hand's errand goes on under it) */
  private get mvHands() { const m = this.mvs; return (m.flT >= 0 && !m.flSoft) || m.stT >= 0 || m.htT >= 0 || m.dz.x > 0 || m.cf.x > 0; }
  /** MOVES (second pass, inputs — nothing reads them with the pass off). `reloadBack`: the long gun in his hands is a bullpup (the magazine BEHIND the grip: the
   *  FN2000) — where the support hand goes for it. `bound`: an unarmed figure kept down — 1 = wrists tied behind the back (a hostage), 2 = hands on the head (told
   *  to stay down). `clutch`: 0‥1, the support hand pressed to the body (a man knocked about and still on his feet). `dip`: 0‥1, a friend's back is in front of the
   *  muzzle at arm's length — the gun comes down past him (MOVES.entry). game.ts / civilians.ts deal them every frame. */
  reloadBack = false; bound: 0 | 1 | 2 = 0; clutch = 0; dip = 0;
  /** A MAN'S CONDITION (condition.ts deals these every frame; all at rest with its switch off, and then nothing reads them). `hurt` 0‥1: a blast reached him and
   *  he is still up — the hunch he keeps, the short heavy step, the hand back at his ribs when the gun is out of his shoulder; `hurtSide`: the side he favours
   *  (1 = his left). `shaken` 0‥1: fire on him — head down between the shoulders. `foldToo`: the clutch's fold is his whatever the wounds switch says. */
  hurt = 0; hurtSide: 1 | -1 = -1; shaken = 0; foldToo = false;
  /** the long gun in his hands is fed by a box MAGAZINE (every row but a tube-fed shotgun, whose shells go in one at a time): false = no magazine change is mimed */
  reloadMag = true;
  /** …and the reload's clock, dealt each frame by whoever OWNS the weapon's beat (game.ts: a guard's reloadT — which stands still while he is not on his man — and a
   *  room-fight teammate's): seconds into `reloadRow`, −1 = none. The hand then shows that beat and nothing else: one clock, the game's. Without it (Sam, the viewer)
   *  the hand runs on reload()'s own. */
  reloadAt = -1; reloadRow: ReloadBeat | null = null;
  /** EACH GUN FED ITS OWN WAY (gunreload.ts feedDeal, every frame beside `reloadMag`; null with gunlook.ts GUNLOOK off or a row with no model, and then nothing
   *  below is read): the model of the long gun in his hands — where the support hand's stations are and what it does at them (a belt box, shells one at a time,
   *  the MP7's magazine up the grip) — and what this reload puts in: `feedN` rounds, `feedPort` = begun with nothing in the gun. */
  feed: GunModelId | null = null; feedN = 0; feedPort = false;
  private rlT = -1; private rlB = { dur: 1.6, out: 0.43, in_: 1.04, rack: 1.36, pull: true, keep: -1, hand: false, fresh: 0.7 }; private rlSrc: ReloadBeat | null = null;
  /** GUN HAND (`longReload`): the long gun's reload carry — `k` the gun's share of LONG_RELOAD, `h` the head's; `ch` the carriage's channels with those shares
   *  taken (what longBody / longArms pose from while either is up; the springs themselves are never written). Both 0 with the switch off: the springs, to the bit. */
  private rlc = { k: 0, h: 0, ch: null as { x: number }[] | null, at: -1, still: 0 };
  /** what that carry shows this frame (QA; nothing reads them) */
  rlShown = { carry: 0, head: 0 };
  // ---- KIT HANDLING (KIT above; dealt by game/kitanim.ts for Sam — a man nobody calls kitSwap on, hands a kit beat or feeds closeK has none of it)
  private kit: { t: number; from: KitItem | null; to: KitItem | null; tA: number; tR: number; D: number; s0: number; roll0: number; re: boolean; front: boolean; cap: { r: Vec3; rq: Quat; l: Vec3; lq: Quat; mr: Vec3 | null; ml: Vec3 | null; mf: Vec3 | null; mb: Vec3 | null } } | null = null;
  /** KIT, input: the rifle lives on a sling in FRONT of him, not across his back (kitanim.ts kitSlingFront — read when a swap begins) — and how far it is
   *  swung forward onto his thighs there this frame, rad (kitSlingRest: the hand goes to the grip where the rifle LIES, as the drawer has it) */
  kitFront = false; kitRest = 0;
  /** OUT, while a swap runs: what is in the right fist this frame (null = nothing; undefined = no swap: it is whatever the game's state says), how far the gun in
   *  it is from the hand to its stowed place (rigProps KitDraw.pistol / .rifle) and how much of its frame is the hand's own (KitDraw.roll) */
  kitHold: KitItem | null | undefined = undefined; kitStow = 0; kitRoll = 0;
  /** How the gun lies in a hand whose wrist the errand held inside what a wrist bends (hand-local: limited⁻¹ · asked); null = as the hand lies. The drawer's. */
  kitLie: Quat | null = null;
  /** OUT: a pistol's magazine change under a kit beat is being worked — 0‥1, how far the drawn gun goes with the HAND that tips it up (Character.gunDir) and not
   *  the aim's line (0 = as ever: an aimed pistol is drawn along the aim) */
  kitGunFree = 0;
  /** IN: closer than ever by distance, 0‥1 (KIT.close) — or −1 = not dealt: the carriage and the hands exactly as they were */
  closeK = -1; private clK = 0; private clT = 0; private clL = 0;
  private mv2 = { bd: new Spring(), bdK: 1 as 1 | 2, cl: new Spring(), dip: new Spring(), rw: new Spring(), rlAt: 0 };
  private mv2Mask: [Float32Array, Float32Array] | null = null;
  /** what the second pass shows this frame (QA / the strips; nothing reads them) */
  mv2Shown = { reload: 0, bound: 0, clutch: 0, dip: 0 };
  /** the pose UNDER the second pass's arms (mvArms: reload / clutch / bound), on the frames they show anything — else null. They are looks; what the game seeds from
   *  his body (the ragdoll: Character.ragdollize) is taken from this, so a hostage shot with her wrists tied falls exactly as she falls with the layer off. */
  armsPre: Pose | null = null; private armsBuf: Pose | null = null;
  /** MOVES.entryEyes: the pitch (radians, ≥ 0) the entry dip has taken off the bore this frame — guards.ts canSeeChar adds it back before asking whether his
   *  eyes are on his sights, so a muzzle put down past a friend's back does not take his look down with it. 0 with the switch off, and whenever nothing is dipped.
   *  It is the dip longArms ASKED for: a layer that takes the trigger arm afterwards (the reload clip, a hit) shows another bore, and the lift is then off by that much. */
  sightsLift = 0;
  private kickT = -1; private kickHit = false; private sigT = -1; private sigKind: SignalKind = 'hold'; private sigSide = 1;
  /** the idle tells (tell / tellLayer): the clock of the one playing (−1 none), which it is, and the arm envelope it showed last frame (0‥1 — read back by the QA
   *  probes as 'the tell is on him', game/needs.ts never reads it) */
  private tellT = -1; private tellK: TellKind = 'watch'; tellShown = 0;
  /** which clip the strike in progress plays (strike(kind); back to 'cross' wherever strikeT is cleared) */
  private strikeK: StrikeKind = 'cross';
  /** THE READY POSE (game/close.ts closeTick deals both EVERY frame for Sam and for nobody else): `ready` = a hands-on move is open on a man from where he stands —
   *  which pose says so (ReadyKind), null = no window; `readyAt` = the WORLD point the hand is going for (the man's neck / upper back), null = straight ahead of the
   *  shoulders. While `ready` stays null and the weight is spent nothing of it runs: not a float of any other figure — or of Sam outside a window — is touched.
   *  readyShown (output, the probes): the weight the layer put into this frame's pose, 0‥1 — it eases IN at 10/s and OUT at 8/s (never popped: a suppressed pose
   *  is still on its way down for a quarter of a second, and this is that), 0 once it is gone. */
  ready: ReadyKind | null = null; readyAt: Vec3 | null = null; readyShown = 0;
  /** the reach goes up for a man who stands over him (READY_UP; game/close.ts feeds it — 0, as a man nobody feeds has it: every pose as it was) */
  readyUp = 0;
  /** HOW MUCH OF THE POSE IS ASKED FOR (1 = all of it, as a caller who feeds nothing has it). game/close.ts feeds it under stalk.ts's tell: the arm comes up
   *  with the DISTANCE to the man's back, so the way in is one move from the crouch's carriage to the grab — and stands where it is when he stops · `rise` 0‥1 =
   *  how far he is up out of his crouch for the man he is closing on (0 unless fed: the crouch as it was) */
  readyAmt = 1; rise = 0;
  /** sunk this far below the carriage for the man he is closing on, 0‥1 (0 unless fed — stalk.ts's tell under STALK.low; CREEP.low is its shape) */
  low = 0; private lowS = 0; /** its shape as fed: [drop m, back m, lean °] */ lowShape: [number, number, number] = [0, 0, 0];
  /** STALK.wide (fed by close.ts with the sink, closing on a man from behind): his arms out wide and low, 0‥1, and the shape as fed [out, down, ahead m] — the share shown is eased */
  wide = 0; wideShape: [number, number, number, number] = [0, 0, 0, 0]; widePole: Vec3 | null = null; private wideS = 0;
  /** TAP TO STEP (tapstep.ts): how far through this step the legs are, −1 = no steps · the step's count · the way the cycle runs. The legs go from wherever they stand to the next plant, and in between stand where they are: taken over from a creep let go of, they do not move at all */
  tapU = -1; tapN = 0; tapWay: 1 | -1 = 1; private tapSeen = -1; private tapFrom = 0; private tapTo = 0; private tapWas = -1;
  heft = 0; /** its shape as fed: [twist °, swing m, weight over the foot m, lean °, dip m, surge] */ heftShape: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]; private hf = { s: 0, sv: 0, a: 0, av: 0, w: 0, wv: 0, v: 0, vv: 0, t: 0 };
  /** …and with it (STALK.low): this share of the carriage's raised hands is given up, at any distance — his hands stay down by his knees, the crouch's own (0 = the carriage as it was) */ handsDown = 0;
  /** …and the SPRING out of it (close.ts closeTick, through a stalk's grab): the rate he comes up out of the crouch at (0 = the animator's own 10) */ spring = 0;
  /** sunk this far into the crouch whatever his stance (0 unless fed — stalk.ts's wait at a corner: a man coiled on a wall) */
  coil = 0;
  // the close-in mode (the caller sets `creep` each frame he is in it; `creepAt` = the nearest man's chest, for the head
  // and trunk to attend to): `creepShown` = the eased weight in the pose. THE KNIFE: `reachShown` = the eased weight of
  // the right hand on the sheathed knife's hilt (the tell: a ready pose with the hands empty; ≥ 0.9 a quarter second after
  // it goes on, under 0.1 a quarter second after it goes off) — the knife stays in its sheath; `knifeShown` = the knife is
  // OUT, in the right fist, this frame (combat.ts draws it off this): only inside a LETHAL blow (strike(kind, true)), from
  // the frame it leaves the sheath to the frame it is back. Never set / never thrown = the animator as it was, bit for bit.
  creep = false; creepAt: Vec3 | null = null; creepShown = 0; knifeShown = false; reachShown = 0;
  /** Input: he carries no knife (close.ts CLOSE.noKnife, set by combat.ts each frame for the player): no hand goes to a hilt in the tell or the close-in carriage,
   *  the reaching arm waits on nothing, and with a man in his arm the right hand is clamped on the man's shoulder (the choke's own station) from the first. */
  noKnife = false;
  private crT = 0; private crV = 0; private crPace = 0; private crW = 0;   // the held gait's clock (0‥1, linear) · the root's own travel speed this frame · the crouch pace it holds at a stop · the stance's eased weight
  private crPh: [number, number] | null = null;                           // the cycle's phase (mod ½) with both feet down and widest apart: the walk's, the crouch-walk's (creepPlant)
  private bw: BlowRun | null = null; private tk: { style: TakenStyle; t: number; delay: number; off: number } | null = null; private kbSlash = false; private kbBack = false; private bwRise = 0;   // a takedown's own move under way (blow()) · what is being done to him (taken()) · the knife's keys are the slash's
  private rcT = 0; private strikeLeth = false; private kbR0 = 0; private kbT = 0; private rcInv: Quat | null = null;   // the reach's clock (0 off ‥ 1 on the hilt; REACH) · the blow under way is the knife's · the reach's weight when it was thrown · its own clock, real seconds · the chest joint's rest rotation, inverted (sheathFist)
  /** …its eased weight, the kind and the point last asked for (what it eases OUT as once the game has cleared them), whether the layer ran last frame (else its
   *  numbers snap), and the pose's own numbers eased at READY_RATE so a change of kind — or of man — crosses over instead of popping (readyLayer's layout) */
  private rdOutR = 1; private rdA = 1; private hdFrom: Vec3 | null = null; private hdCaught = false; private heSpan = 0; private rdHandL: Vec3 | null = null; private hdFix: { tgt: Vec3; pole: Vec3; poleW: number; rot: Quat; w: number; rw: number } | null = null; private hdSw = 0; private heSw = 0; private readyW = 0; private readyK: ReadyKind = 'grab'; private rdAt: Vec3 | null = null; private rdLive = false; private rd = new Float64Array(RD_N);
  private idleT = 0;   // (desynced per figure by desync(id))
  /** stance follow-through: master weight + one spring per shape channel (blade / headYaw / side carry the stackSide sign) */
  private st = { w: new Spring(), fwd: new Spring(STANCES.highReady.fwd), up: new Spring(STANCES.highReady.up), side: new Spring(STANCES.highReady.side), pitch: new Spring(STANCES.highReady.pitch), lean: new Spring(STANCES.highReady.lean), headPitch: new Spring(0), tuck: new Spring(STANCES.highReady.tuck), blade: new Spring(0), headYaw: new Spring(0), squat: new Spring(0) };
  /** the wall hold's own followers: wl = how much of the stance weight is the WALL's body / arms rather than the carries' (1 while 'wall' is held, so stack ↔ wall
   *  cross-fade and none ↔ wall rides the master weight alone); side = stackSide made continuous (a flip sweeps head, hands and feet across instead of popping
   *  them); peek = wallPeek eased; park = standing on the hold's own foot spots (1) vs the cycle's feet (0), by ground speed — quick off them, slower back on */
  private wst = { wl: new Spring(), side: new Spring(1), peek: new Spring(), park: new Spring(1) };
  private stanceSeen: Stance = 'highReady'; private lpW = new Spring(); private lpT = 0; private hlW = new Spring(); private hlLast: HaulPose | null = null;
  /** the long gun: master weight (follows longGun), the carriage last followed (null = the channels have never been set: snap), one spring per LongShape channel, how
   *  far the gun is being held back of the carriage's point for the support arm's reach (model space: taken up at once, let out at 2/s, capped — longArms), the two
   *  poles of the anchor's steadied side-to-side (model x, NaN = take it where it is: LONG_STEADY.tau) and this frame's run share (jog + sprint of the pose, 0 crouched) */
  private lg = { w: new Spring(), seen: null as LongStance | null, ch: Array.from({ length: LC.count }, () => new Spring()), pull: [0, 0, 0] as Vec3, lat: [NaN, NaN] as [number, number], run: 0, sprint: 0 };
  /** was longGun set last frame? — the long-gun solve snaps weight AND channels on its rising edge, not only once the last draw has fully decayed (review 08-10 #14) */
  private lgArmedWas = false;
  /** the hold's two layers: master weights (sprung on holdPose / heldPose being set), the last inputs seen (what the layer eases OUT from once the controller has
   *  cleared them), the man's eased choke amount (an aborted choke lets his knees and hands come back instead of snapping), Sam's eased 'blade off him'
   *  amount (hdKn: the knife hand between its throat station and its shoulder station — sprung, so easing off a choke brings the blade back without a pop), and
   *  each figure's eased share of the VARIANT (hdGv / heGv, 0 = arm ↔ 1 = gun: snapped to it as a hold begins — hdOn / heOn say whether the pose was set last
   *  frame — and sprung across at SWAP_RATE when E changes it mid-hold, so Sam's right hand is handed over and the man's hands re-settle instead of popping) */
  private hdW = new Spring(); private hdLast: HoldPose = { phase: 'held', t: 0 }; private hdKn = new Spring(); private hdGv = new Spring(); private hdOn = false; private hdCk = new Spring(); private hdLo = new Spring(); private hdKc = new Spring(); private hdHu = new Spring(); private heHu = new Spring();
  private heW = new Spring(); private heLast: HeldPose = { phase: 'held', t: 0, agitation: 0 }; private heCk = new Spring(); private heGv = new Spring(); private heOn = false; private heLo = new Spring(); private heLk = new Spring(); private heKc = new Spring(); private heBo = new Spring(); private heBc = new Spring(); private heHr: [Quat | null, Quat | null] = [null, null];
  /** the door hand (doorLayer): one weight spring per arm (a change of hand cross-fades), the last spot fed (what the arm eases out from once game.ts stops feeding),
   *  which arm is wanted, and the reach test's hysteresis */
  private dp = { wL: new Spring(), wR: new Spring(), last: null as DoorPush | null, right: false, reachOK: false, tw: new Spring() };   // (tw: how much of the aim's chest twist is let go — the shoulders squared to the door — while a push is live)
  /** handwork: the work pose last fed and whether it was fed this frame, the s it carries on by itself past its end (workAfter), the two arms' weights and reach
   *  hysteresis, the chest's squaring to the thing, which hand works and whether the other is on it too, the weight shown; the swap's clock (t < 0: none), what it
   *  goes from and to, and what the rule last said; the radio hand's time left and weight */
  private wk = { last: null as WorkPose | null, fed: false, after: 0, wL: new Spring(), wR: new Spring(), okL: false, okR: false, tw: new Spring(), main: 1 as 0 | 1, two: false, shown: 0 };
  private sw = { cur: undefined as CarryKind | undefined, from: null as CarryKind, to: null as CarryKind, t: -1, dur: 1, shown: false, wait: -1, belt: 0 };
  /** the pose with the right arm as it stood UNDER the swap, on a frame the swap moved it (null otherwise): what the muzzle and the bore are read off (Character.update),
   *  so a line of fire and a round's start are where they are with the swap off — the hand's trip past the belt is for the eye */
  handPre: Pose | null = null; private swBuf: Pose | null = null; private handBuf: Pose | null = null; private underBuf: Pose | null = null;
  /** the pose UNDER every look-only arm layer that showed this frame (the moves' second pass: armsPre; the swap's gun arm: handPre) — what a body that falls is
   *  seeded from, so who lies where is the same with those layers on or off; null when none showed */
  underPose(): Pose | null { const a = this.armsPre, h = this.handPre; if (!a || !h) return a ?? h; blendPose(a, h, 1, this.armROnly, this.underBuf ??= new Pose(a.numNodes)); return this.underBuf; }
  private rx = { left: 0, w: new Spring() };
  /** STEALTH POSES: what the game fed this frame (stealthpose.ts stealthFeed; null = nothing fed: the layer is never entered) · the layer's own eased state, made the first time it is fed */
  stealth: StealthFeed | null = null;
  private sp: { wA: number; t: number; cr: number; fl: number; lead: number; fz: number; sw: number; wC: number; wH: number; pic: Pose | null; picOn: boolean; nodUp?: boolean } | null = null;
  /** `deliberate` eased; and the crouch walk's gait numbers its retime needs (measured off Crouch_Fwd_Loop at construction): the fore-aft middle of the ankles'
   *  travel — the stride is warped about it — and the phase the linger centres on (just after a foot is set down; the other plant is half a cycle on) */
  private dlb = new Spring(); private gait = { mid: -0.15, linger: 0.08 };
  private dashW = 0;   // `dash` eased (DASH.rate)
  private wt = { w: 0, yaw: 0, pitch: 0, sw: 0, sx: 0, sz: 1, side: 0 as 0 | 1, sl: 1 };   // watchLayer: the look's weight and angles, the slip's weight, the man's bearing (model, level) and the arm that has him
  private jogHipsY = new Float32Array(64); private jogHipsMean = 0.9; private jogMid = -0.1;   // (constructor: the run clip's pelvis height by phase, and where its ankles' fore-aft travel is centred — the stride warp scales about it)
  private runK = 1;                                                       // this frame's run stride warp (1 = none)
  private sprintMid = -0.1; private sprintFloorY = 0.09;                  // (constructor, off Sprint_Loop: the fore-aft middle of its ankles' travel, and their lowest height — sprintShape warps about the one and eases heights about the other)
  /** Jog_Fwd_Loop's loop seam: the keyed channels whose last key does not meet their first (the pelvis 23 mm apart, the legs 1–3°), as (Pose.data offset,
   *  first − last: a translation, or the axis / angle of last⁻¹·first) — sampleJog spreads each linearly round the cycle so phase 1 runs straight into phase 0 */
  private jogSeam: { o: number; d?: Vec3; axis?: Vec3; ang?: number }[] = [];
  /** the runs' stances, measured off the raw jog and sprint clips at construction (stanceOf): mid-stance phase per foot — the toe on the floor and sweeping
   *  back — and the two folded onto the half-cycle. Blended by the sprint's share each frame: RUN_LINGER dwells about `c`, runPlant pins each foot about its own */
  private runGait = { jog: { c: 0.117, cL: 0.117, cR: 0.617 }, sprint: { c: 0.153, cL: 0.133, cR: 0.672 } };
  /** runPlant's state: per foot the fore-aft offset the pinned toe carries off the cycle's (grows while it holds the ground, bleeds off once the window
   *  is not full) and the cycle's toe z last frame (NaN = not seen yet); and the pin's weight — the run's share at once on the way up, let down over ~0.1 s,
   *  so a dead stop from a run leaves the stance foot standing where it was planted while the body stops over it instead of handing it back mid-stride */
  private plantL = { dev: 0, pz: NaN }; private plantR = { dev: 0, pz: NaN }; private plantW = 0;
  private gz = { pitch: 0, yawRef: 0, yawInit: false, w: 0 };            // gaze stabiliser state: eased pitch correction, the slow reference the head's yaw wobble is measured against, its eased weight
  private life = { breath: 0, exert: 0, prevS: 0, accel: 0, mass: new Spring(), massV: new Spring(), stillT: 0, shiftT: 4, shiftSide: 1 as -1 | 1, shift: new Spring(), yawPrev: NaN, yawRate: 0, prevPos: [NaN, 0, 0] as Vec3, rootV: 0, gate: 0, shiftN: 0 };   // (breath / shiftT / shiftSide / idleT are desynced from the character id by desync(): deterministic per figure, so the capture recipe still gives bit-identical boots)   // idle life + weight: breathing phase / exertion, speed history → an acceleration-driven pelvis 'mass' spring, the at-rest weight shift's clock / side / spring, body-yaw rate
  /** planted feet at rest (lifeLayer): each foot locked to a WORLD spot and yaw while he stands, stepping across to where the pose wants it once the body has
   *  turned or shifted out from over it — one foot at a time, a quick lifted arc — so turning on the spot is stepped round, not skated. w: the lock's weight. */
  private feet = { w: 0, gate: 0, L: { p: [0, 0, 0] as Vec3, yaw: 0, swing: -1, from: [0, 0, 0] as Vec3, fromYaw: 0 }, R: { p: [0, 0, 0] as Vec3, yaw: 0, swing: -1, from: [0, 0, 0] as Vec3, fromYaw: 0 }, next: 0 as 0 | 1 };   // gate: the lock's own one-shot gate — only the KICK has the legs (update(), review #18)
  /** the controller's world placement this frame (Character.update feeds both): the animator poses in model space but plants feet in the world */
  bodyYawIn = 0; posIn: Vec3 = [0, 0, 0];
  /** throw: where each hand ended up last frame (offset from its shoulder joint, model axes) — a throw re-triggered mid-swing carries on from there instead of
   *  from the pose underneath — and that carried-in start while it applies */
  private thrLast: { r: Vec3; l: Vec3 } | null = null; private thrCarry: { r: Vec3; l: Vec3 } | null = null;
  /** this throw's read of its distance (THROW_BY, set by throwItem): `thrLow` ≥ 0 = an underhand toss of that size (0‥1), −1 = the overhand, at `thrFar` of its size (0‥1; 1 = as authored); `thrHang` = how far a toss lets the other hand down (0‥1, read off the pose underneath on the throw's first frame; −1 = not read yet) */
  private thrLow = -1; private thrFar = 1; private thrHang = -1; private thrHit0 = 0;
  /** GUNHAND.throwFree (gunhand.ts; set by throwItem): this throw is the FREE hand's — he had a long gun in his hands as it began, so the swing is the left arm's
   *  (the authored one, mirrored) and the trigger hand keeps the gun, lowered, through it. Never set with the switch off. */
  private thrOff = false;
  /** the standing idle's foot placement (model space, constant over the loop): where a kick plants both feet, soles as the clip has them */
  private idleFeet: { L: Vec3; R: Vec3; rL: Quat; rR: Quat };
  /** per kick: where the feet were when it started (the support foot is held from the first frame, the swing foot's path starts from its own spot) */
  private kickFrom: { L: Vec3; rL: Quat; R: Vec3; rR: Quat } | null = null;
  /** per kick: the leg that swings — 'right' (the rear leg: every kick the game has thrown so far) or its mirror image 'left' (kickDoor({ leg: 'left' }): the
   *  breach's point man boots the leaf beside its handle off the leg nearer the doorway, weight on the wall-side foot he then steps back onto) */
  private kickLeg: 'left' | 'right' = 'right';
  private clips: Record<string, Clip>;
  private upperMask: Float32Array; private armRMask: Float32Array; private headMask: Float32Array; private armsMask: Float32Array; private dynMask: Float32Array;
  /** one arm each, clavicle to fingertips (the door hand) */
  private armLOnly: Float32Array; private armROnly: Float32Array;
  /** the aim clip's mask less both arms (upperMask − armsMask): the rifleman takes the clip's trunk and head and keeps the long gun's own arms */
  private torsoMask: Float32Array;
  private fk: PoseFK;
  /** per hand: rotation from handRot's construction frame to the bone's rest axes; gun hand: its local axis that is 'up' when the aim clip holds the pistol level */
  private handFix: Quat[]; private gripUp: Vec3;
  /** head-local direction that is 'looking straight ahead' (taken from the standing idle, whose head is not at the bone's rest angle) */
  private gazeLocal: Vec3;
  /** inverse of the chest joint's (spine.003) rest model rotation: current · this takes rest-pose model axes to where the chest points them now (its facing / its left) */
  private chestRestInv: Quat; private headRestInv: Quat;
  /** finger joints [side L=0/R=1][finger index,middle,ring,pinky][joint 0..2] and thumbs [side][joint] */
  private fingers: number[][][]; private thumbs: number[][];
  /** THE HAND PASS (HAND; handsPass). Input: `grip[side]` — this hand (L = 0 / R = 1) is closed round something the animator poses no layer for (combat.ts
   *  handProps: the can in Sam's fist; game.ts: whatever a guard has in his hand — the patrol's torch hangs in the walk clip's own fist) — nothing reads it with MOVES off. State, per side: the 15 digit joints (thumb, then index ‥ pinky, three each), the
   *  library's fist on them and the crouch clip's distance from it per digit, the turn from that fist to THIS man's relaxed hand (built off `seed` — desync's —
   *  on first use), where the locomotion left the digits this frame (`base`: before any layer), how far the nearest hand() target of the frame stood from that
   *  (`note`, per digit; Infinity = no layer set this hand), the eased grip input, the index's eased share of 'off the trigger' and the seconds since his last round */
  grip: [boolean, boolean] = [false, false];
  /** the right fist holds a CAN (combat.ts handProps, only under the kit's grip fit — kitanim.ts KITANIM.grips): the fingers stand open round its width (HAND.can)
   *  where the library's fist would close through it. Fingers only, read by nothing. */
  gripCan = false;
  private hn = { nodes: [] as Int32Array[], fist: [] as Float32Array[], own: [] as Float32Array[], open: [] as Float32Array[], trig: new Float32Array(12), thumb: [new Float32Array(12), new Float32Array(12)], base: [new Float32Array(60), new Float32Array(60)],
    note: [new Float32Array(5), new Float32Array(5)], seed: 0, built: NaN, quiet: false, grip: [0, 0], off: 1, fired: 9, gun: 0 };
  nodes: Record<keyof typeof N, number>;

  constructor(public ch: GltfCharacter) {
    const n = ch.nodes.length;
    this.pose = new Pose(n); this.pA = new Pose(n); this.pB = new Pose(n); this.pC = new Pose(n); this.pUpper = new Pose(n); this.pAim = new Pose(n); this.rest = restPose(ch, new Pose(n));
    for (const p of [this.pose, this.pA, this.pB, this.pC, this.pUpper, this.pAim]) p.copy(this.rest);
    const need = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Idle_Torch_Loop', 'Hit_Chest', 'Sprint_Loop', 'Pistol_Reload', 'Punch_Cross'];   // (no death clip: dying hands the skeleton to the ragdoll, Character.ragdollize; no throw clip: the library's only cast is left-handed, the throw is procedural — throwLayer)
    this.clips = {};
    for (const k of need) { const c = ch.clips.get(k); if (!c) throw new Error('missing clip ' + k); this.clips[k] = c; }
    { const j = ch.clips.get('Punch_Jab'); if (j) this.clips.Punch_Jab = j; }   // (optional: strike('jab') plays the cross on a library without it)
    this.nodes = {} as Record<keyof typeof N, number>;
    for (const [k, name] of Object.entries(N)) { const i = ch.nodeByName.get(name); if (i === undefined) throw new Error('missing node ' + name); (this.nodes as Record<string, number>)[k] = i; }
    const node = (name: string) => { const i = ch.nodeByName.get(name); if (i === undefined) throw new Error('missing node ' + name); return i; };
    this.fingers = ['L', 'R'].map(s => ['f_index', 'f_middle', 'f_ring', 'f_pinky'].map(f => [1, 2, 3].map(j => node(`DEF-${f}.0${j}.${s}`))));
    this.thumbs = ['L', 'R'].map(s => [1, 2, 3].map(j => node(`DEF-thumb.0${j}.${s}`)));
    this.hn.nodes = [0, 1].map(s => Int32Array.from([...this.thumbs[s], ...this.fingers[s].flat()]));
    this.upperMask = buildMask(ch, [{ name: N.spine1, w: 0.3, subtree: false }, { name: N.spine2, w: 0.65, subtree: false }, { name: N.spine3, w: 1, subtree: true }]);
    this.armRMask = buildMask(ch, [{ name: N.shoulderR, w: 1, subtree: true }, { name: N.spine3, w: 0.25, subtree: false }]);
    this.headMask = buildMask(ch, [{ name: N.neck, w: 1, subtree: true }]);
    this.armsMask = buildMask(ch, [{ name: N.shoulderL, w: 1, subtree: true }, { name: N.shoulderR, w: 1, subtree: true }]);   // both clavicles down to the fingertips: the procedural carries / lock work
    this.armLOnly = buildMask(ch, [{ name: N.shoulderL, w: 1, subtree: true }]); this.armROnly = buildMask(ch, [{ name: N.shoulderR, w: 1, subtree: true }]);   // one arm at a time: the hand on a door
    this.torsoMask = this.upperMask.map((w, i) => this.armsMask[i] > 0 ? 0 : w);                                          // the aim clip's trunk + head without its arms (the long gun keeps its own)
    this.dynMask = new Float32Array(n);                                                                                      // the signals' left-arm mask, rebuilt per frame with staggered weights (shoulder → elbow → hand)
    this.fk = new PoseFK(ch); { const nd = this.nodes; this.fkLegs = this.fkList([nd.hips, nd.thighL, nd.shinL, nd.footL, nd.toeL, nd.thighR, nd.shinR, nd.footR, nd.toeR]); this.fkArms = this.fkList([nd.spine3, nd.upperArmR, nd.forearmR, nd.handR, nd.middle1R, nd.upperArmL, nd.forearmL, nd.handL]); this.fkHead = this.fkList([nd.head]); }
    sampleClip(this.clips.Pistol_Aim_Neutral, 0, false, this.pAim);   // the two-hand grip every pistol carry below is built from (static clip)
    this.fk.run(this.rest); this.chestRestInv = quat.conj(this.fk.rot[this.nodes.spine3]); this.headRestInv = quat.conj(this.fk.rot[this.nodes.head]);
    this.handFix = [this.nodes.handL, this.nodes.handR].map(h => { const r = this.fk.rot[h]; const F = v3.normalize(quat.rotate(r, AY)); const B = v3.normalize(v3.mad(AY, F, -v3.dot(AY, F))); return quat.mul(quat.conj(quat.fromBasis(v3.cross(F, B), F, B)), r); });   // rest = T-pose, palms down: fingers along local +Y, back of the hand facing model +Y
    this.fk.run(this.pAim); this.gripUp = quat.rotate(quat.conj(this.fk.rot[this.nodes.handR]), AY);
    { const p = new Pose(n).copy(this.rest); sampleClip(this.clips.Idle_Loop, 0, false, p); const fk = this.fk.run(p); const nd = this.nodes;
      this.gazeLocal = quat.rotate(quat.conj(fk.rot[nd.head]), AZ);
      // the hand pass: the fist the standing clips key on every digit, and how far the crouch clip's own (open) hand stands from it, digit by digit
      const H = this.hn, grab = (q: Pose) => H.nodes.map(ns => { const a = new Float32Array(60); ns.forEach((i, k) => a.set(q.rot(i), k * 4)); return a; });
      H.fist = grab(p); const pc = new Pose(n).copy(this.rest); sampleClip(this.clips.Crouch_Idle_Loop, 0, false, pc); const cr = grab(pc);
      H.own = [0, 1].map(sd => Float32Array.from([0, 1, 2, 3, 4], g => Math.max(10 * DEGR, (qAng(cr[sd], g * 12, H.fist[sd], g * 12) + qAng(cr[sd], g * 12 + 4, H.fist[sd], g * 12 + 4) + qAng(cr[sd], g * 12 + 8, H.fist[sd], g * 12 + 8)) / 3)));
      this.idleFeet = { L: v3.copy(fk.pos[nd.footL]), R: v3.copy(fk.pos[nd.footR]), rL: [...fk.rot[nd.footL]] as Quat, rR: [...fk.rot[nd.footR]] as Quat }; }
    { // the crouch walk's gait for the deliberate retime (sneakLayer): where the ankles' fore-aft travel is centred, and where in the cycle each toe comes down
      // flat (its height back within a centimetre of the floor after the swing) — the linger sits a little after that, the two plants folded onto one half-cycle
      const p = new Pose(n).copy(this.rest), cf = this.clips.Crouch_Fwd_Loop, nd = this.nodes, M = 48;
      let zmin = 1e9, zmax = -1e9; const ty: number[][] = [[], []];
      for (let i = 0; i < M; i++) {
        sampleClip(cf, cf.duration * i / M, true, p); const fk = this.fk.run(p);
        for (const f of [nd.footL, nd.footR]) { zmin = Math.min(zmin, fk.pos[f][2]); zmax = Math.max(zmax, fk.pos[f][2]); }
        ty[0].push(fk.pos[nd.toeL][1]); ty[1].push(fk.pos[nd.toeR][1]);
      }
      const plants: number[] = [];
      ty.forEach((ys, side) => { const lo = Math.min(...ys) + 0.01; for (let i = 0; i < M; i++) if (ys[(i + M - 1) % M] > lo && ys[i] <= lo) { plants.push(i / M - 0.5 * side); break; } });
      if (zmax > zmin) this.gait.mid = (zmin + zmax) / 2;
      if (plants.length) { let sx = 0, cy = 0; for (const ph of plants) { sx += Math.sin(4 * Math.PI * ph); cy += Math.cos(4 * Math.PI * ph); } this.gait.linger = ((Math.atan2(sx, cy) / (4 * Math.PI)) + 0.07 + 1) % 0.5; }   // (circular mean on the half-cycle, + the linger's lag behind the plant)
    }
    { // the run clip's loop seam: its last key does not meet its first (pelvis 23 mm higher, thighs / shins / feet 1–3° off — a hitch once a cycle at phase 0).
      // Each keyed channel's gap is kept as first − last and spread linearly round the cycle at sample time (sampleJog), which closes the loop exactly
      const cj = this.clips.Jog_Fwd_Loop, a = new Pose(n).copy(this.rest), b = new Pose(n).copy(this.rest);
      sampleClip(cj, 0, false, a); sampleClip(cj, cj.duration, false, b);
      for (const tr of cj.tracks) {
        if (tr.path === 0) { const d = v3.sub(a.pos(tr.node), b.pos(tr.node)); if (v3.len(d) > 5e-4) this.jogSeam.push({ o: tr.node * 10, d }); }
        else if (tr.path === 1) {
          let q = quat.mul(quat.conj(b.rot(tr.node)), a.rot(tr.node)); if (q[3] < 0) q = [-q[0], -q[1], -q[2], -q[3]];
          const s = hyp3(q[0], q[1], q[2]), ang = 2 * Math.atan2(s, q[3]);
          if (ang > 0.3 * DEGR) this.jogSeam.push({ o: tr.node * 10 + 3, axis: [q[0] / s, q[1] / s, q[2] / s], ang });
        }
      } }
    { // the run clip's pelvis height round its cycle (64 samples, model up) and its mean: the clip bounds 23 cm crest to trough — twice a jog's — so the
      // locomotion blend flattens the run's share of the bob toward its mean (BOB_KEEP of it kept), read off this table by phase. The same pass finds where its
      // ankles' fore-aft travel is centred (the stride warp scales about it) and each foot's stance — the toe within 2 cm of its lowest and sweeping back —
      // whose circular-mean centre is what the run's linger dwells about and runPlant pins about (runGait)
      const p = new Pose(n).copy(this.rest), nd = this.nodes, M = 64; let sum = 0;
      let zmin = 1e9, zmax = -1e9; const ty: number[][] = [[], []], tz: number[][] = [[], []];
      for (let i = 0; i < M; i++) {
        this.sampleJog(i / M, p); const fk = this.fk.run(p); this.jogHipsY[i] = fk.pos[nd.hips][1]; sum += this.jogHipsY[i];
        for (const f of [nd.footL, nd.footR]) { zmin = Math.min(zmin, fk.pos[f][2]); zmax = Math.max(zmax, fk.pos[f][2]); }
        ty[0].push(fk.pos[nd.toeL][1]); ty[1].push(fk.pos[nd.toeR][1]); tz[0].push(fk.pos[nd.toeL][2]); tz[1].push(fk.pos[nd.toeR][2]);
      }
      this.jogHipsMean = sum / M; if (zmax > zmin) this.jogMid = (zmin + zmax) / 2;
      this.runGait.jog = this.stanceOf(ty, tz) ?? this.runGait.jog; }
    { // the sprint clip likewise: where its ankles' fore-aft travel is centred (sprintShape's stride warp scales about it) and their lowest height (its heights ease
      // about that, so the planted foot stays at the clip's own floor), and its stances (a little later in the cycle than the jog's: runPlant's windows follow
      // the two runs' blend). Its pelvis bounds 13 cm — what the flattened jog's comes to — so that is left alone.
      const p = new Pose(n).copy(this.rest), cs = this.clips.Sprint_Loop, nd = this.nodes, M = 64;
      let zmin = 1e9, zmax = -1e9, ymin = 1e9; const ty: number[][] = [[], []], tz: number[][] = [[], []];
      for (let i = 0; i < M; i++) {
        sampleClip(cs, cs.duration * i / M, true, p); const fk = this.fk.run(p);
        for (const f of [nd.footL, nd.footR]) { zmin = Math.min(zmin, fk.pos[f][2]); zmax = Math.max(zmax, fk.pos[f][2]); ymin = Math.min(ymin, fk.pos[f][1]); }
        ty[0].push(fk.pos[nd.toeL][1]); ty[1].push(fk.pos[nd.toeR][1]); tz[0].push(fk.pos[nd.toeL][2]); tz[1].push(fk.pos[nd.toeR][2]);
      }
      if (zmax > zmin) this.sprintMid = (zmin + zmax) / 2; if (ymin < 1e8) this.sprintFloorY = ymin;
      this.runGait.sprint = this.stanceOf(ty, tz) ?? this.runGait.sprint; }
    this.phase = simRandom();
  }
  /** desynchronise the idle / life clocks per figure, deterministically (Character passes its id): a room of guards must not breathe and fidget in step,
   *  and two boots with the same ids must pose identically (the pixel-A/B capture recipe) */
  desync(seed: number) {
    const h = (k: number) => { let x = Math.imul(((seed + 1) * 2654435761) ^ (k * 40503), 2246822519) >>> 0; x ^= x >>> 15; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
    this.idleT = h(1) * 20; this.life.breath = h(2) * 6.28; this.life.shiftT = 2 + h(3) * 5; this.life.shiftSide = h(4) < 0.5 ? -1 : 1;
    this.hn.seed = seed;   // (the hand pass: whose relaxed hands these are — built on first use)
  }

  fire() {
    this.shootT = 0; this.hn.fired = 0;   // (the hand pass: his finger is on the trigger — nothing else reads it)
    if (this.longGun && mvOn('recoil')) {   // MOVES: each round adds to the recoil's decaying sums (update() bleeds them off, longArms / recoilTrunk show them)
      const m = this.mvs, R = MV.recoil, T = clamp(this.trained, 0, 1), k = (p: readonly [number, number]) => lerp(p[0], p[1], T);
      const h = ((m.n * 2654435761) >>> 0) / 4294967296; m.n++;   // (the figure's own round count, hashed: no dice)
      m.back = Math.min(m.back + k(R.back), k(R.back) * 1.35); m.climb += k(R.climb) * (0.8 + 0.4 * h); m.yaw += k(R.yaw) * (h < 0.7 ? -1 : 1) * (0.5 + h);
      m.rock += k(R.rock); m.sho += k(R.shoulder); m.head += k(R.head);
    }
  }
  hit() { this.hitT = 0; }
  /** startle: same recoil as taking a round (Hit_Chest layer), no damage implied */
  flinch() { if (mvOn('flinch')) this.flinchFrom(null); else this.hit(); }
  /** MOVES: rounds going past — a DUCK away from where they come from (`toward`: world direction from him to the source; null = his front): head down and turned
   *  off it, trunk folded over the gun, knees soft; both hands stay on the weapon. Big and slow for an untrained man, a dip of the head for a trained one.
   *  With the pass off this is the old flinch (the Hit_Chest twitch). */
  flinchFrom(toward: Vec3 | null, k = 1, soft = false) {
    if (!mvOn('flinch')) { if (!soft) this.hitT = 0; return; }   // (a soft duck is nothing without the pass: the old clip is a hit reaction, and every round would start it again)
    const m = this.mvs, D = lerp(MV.flinch.dur[0], MV.flinch.dur[1], clamp(this.trained, 0, 1));
    // `k`: how much of the duck this round is worth, `soft`: it leaves the hand's errand alone (game/flinch.ts). A nearer round while one shows deepens it — eased, never a jump — and a farther one does not lift him; one hard start makes the whole duck hard
    if (m.flT >= 0) { m.flKTo = Math.max(m.flKTo, k); if (!soft) m.flSoft = false; }
    if (m.flT >= 0 && m.flT < 0.34 * D) return;   // (already down: a burst is one duck)
    // re-startled on the way back up: straight back down from where he is — the clock goes to the point on the way DOWN that shows what he shows now, and the side he ducked to stays his
    if (m.flT >= 0) { m.flT = 0.14 * D * clamp(curve(m.flT / D, MV_FLINCH_ENV), 0, 1); return; }
    m.flD = toward ? this.flatModel(toward, [0, 0, 1]) : [0, 0, 1]; m.flT = 0; m.flK = m.flKTo = k; m.flSoft = soft;
  }
  /** the duck at a round is showing (0 = not, else how much of the whole untrained duck: its envelope × his training's share × what the round was worth) */
  get flinchShown(): number { const m = this.mvs, T = clamp(this.trained, 0, 1); return m.flT >= 0 ? clamp(curve(m.flT / lerp(MV.flinch.dur[0], MV.flinch.dur[1], T), MV_FLINCH_ENV), 0, 1) * lerp(MV.flinch.amp[0], MV.flinch.amp[1], T) * m.flK : 0; }
  /** MOVES: the START of a man who has just seen what he did not expect (`toward`: world direction from him to it; null = his front) — the jolt back off it,
   *  the head snapped round to it, the arms flung out from his sides (MV_STARTLE). One at a time: a second call while the first still shows is the same start.
   *  With the pass off this is the old flinch (the Hit_Chest twitch). Presentation only: what it buys the man who caused it is the caller's (game/startle.ts). */
  startleFrom(toward: Vec3 | null) {
    if (!mvOn('flinch')) { this.hitT = 0; return; }
    const m = this.mvs; if (m.stT >= 0) return;
    m.stD = toward ? this.flatModel(toward, [0, 0, 1]) : [0, 0, 1]; m.stT = 0;
  }
  /** the start is showing (0 = not, else how much of it: its envelope) */
  get startleShown(): number { const m = this.mvs; return m.stT >= 0 ? clamp(curve(m.stT / lerp(MV_STARTLE.dur[0], MV_STARTLE.dur[1], clamp(this.trained, 0, 1)), MV_STARTLE.env), 0, 1) : 0; }
  /** MOVES: a round that went home on a man who stays up (`along`: the world direction the round was travelling; null = from his front): the torso knocked along
   *  it and twisted off the struck shoulder, the pelvis shoved, the head lagging — then he fights back to where he was. Off = the old Hit_Chest clip. */
  hitFrom(along: Vec3 | null) {
    if (!mvOn('flinch')) { this.hitT = 0; return; }
    const m = this.mvs;
    // a second round while the first still has him: the blow restarts from the lean he shows (the clock goes to that point of the knock; its direction stays the first's while any of it shows)
    const e0 = m.htT >= 0 ? clamp(curve(m.htT, MV_HIT_ENV), 0, 1) : 0;
    m.htT = 0.07 * e0; if (e0 > 0.15) return;   // (… until it has all but left him: a blow from the other side while he still leans would throw the trunk across in a frame)
    m.htD = along ? this.flatModel(along, [0, 0, -1]) : [0, 0, -1];
    m.htSide = Math.abs(m.htD[0]) > 0.3 ? Math.sign(m.htD[0]) : (m.n++ & 1 ? 1 : -1);
  }
  /** MOVES: the support hand's underhand TOSS (a stun charge round a door frame): the left hand comes off the fore-end, dips beside the hip, swings through and
   *  lets go `release` s after the call, follows through open toward the throw and goes back to the gun — the rifle never leaves the trigger hand. Left arm and a
   *  little trunk only, so it layers over any carriage, standing or walking. Off = the pointing chop the teams used to make (signal 'go'). */
  tossItem(release = TOSS_RELEASE) {
    if (!mvOn('toss')) { this.signal('go'); return; }
    const m = this.mvs; if (m.tsT >= 0) return; m.tsT = 0; m.tsRel = clamp(release, 0.08, 0.6);
  }
  get tossing() { return this.mvs.tsT >= 0; }
  /** a world direction, flattened, in the figure's un-twisted model frame (fallback when it has no length) */
  private flatModel(w: Vec3, fb: Vec3): Vec3 { const d = this.toModelD([w[0], 0, w[2]]); const l = hyp2(d[0], d[2]); return l > 1e-4 ? [d[0] / l, 0, d[2] / l] : fb; }
  /** takedown strike (full upper body, brief): Punch_Cross — or, `kind` 'jab', the library's Punch_Jab played the same way (the lead hand: a man taken from the
   *  front); a tree whose library has no jab plays the cross. `lethal` = the KNIFE's blow: the same clip carries the body and the left arm, the right hand draws
   *  the knife from the sheath on his chest (straight out if it was resting on the hilt), cuts / stabs and puts it back inside the clip (knifeBlow, KNIFE_BLOW;
   *  knifeShown while it is out). Without it nothing of that runs: the blow the build always played, to the bit. */
  strike(kind: StrikeKind = 'cross', lethal = false) { this.strikeT = 0; this.strikeK = kind; this.kbSlash = this.kbBack = false; this.bw = null; this.bwRise = 0; if (lethal || this.strikeLeth) { this.strikeLeth = lethal; this.kbR0 = this.reachShown; this.kbT = 0; this.knifeShown = false; } }
  /** the blow under way is the knife's (strike(kind, true)) — false once its clip has ended */
  get strikeLethal() { return this.strikeT >= 0 && this.strikeLeth; }
  get striking() { return this.strikeT >= 0; }
  /** A TAKEDOWN'S OWN MOVE (game/takedown.ts, right after the strike() it rides): `at` = where the blow lands, `at2` = where the free hand goes (world points
   *  on the man), landing `hit` s in and over by `end`; with `vic` both points ride his neck / head as he moves (the blow's until it lands). Poses only: the
   *  game's own clock still says when he is out. */
  blow(style: BlowStyle, at: Vec3, at2: Vec3 | null = null, o: BlowOpts = {}) {
    this.bw = { style, t: 0, hit: o.hit ?? 0.28, end: o.end ?? 0.62, tail: o.tail ? BLOW.tail : 0, rise: o.rise ?? true, at: v3.copy(at), at2: at2 ? v3.copy(at2) : null, live: o.live ?? null };
    this.kbSlash = style === 'slash'; this.kbBack = style === 'mouth';
  }
  /** the move called off (the man stepped out of the hands; the order ended): eased out from where it is, never snapped */
  blowCancel() { const B = this.bw; if (!B) return; B.end = Math.min(B.end, B.t + 0.18); B.tail = 0; B.live = null; }
  /** the man it was being done to, let go of: his reaction eases out over a fifth of a second (one not yet begun never begins) */
  takenCancel() { const T = this.tk; if (!T) return; if (T.t - T.delay <= 0) this.tk = null; else if (T.off < 0) T.off = 0; }
  /** …AND THE MAN IT IS DONE TO, while he is still on his feet: from `delay` s on he arches back onto the knife man's shoulder / hunches under a blow from
   *  behind, knees going / his head snaps back off one from in front. Eases out by itself after TAKEN.secs (he is mostly a ragdoll long before). */
  taken(style: TakenStyle, delay = 0) { this.tk = { style, t: 0, delay, off: -1 }; }
  get blowing() { return this.bw !== null; }
  /** the reload one-shot (Pistol_Reload over the upper body), retimed to take `dur` seconds — the weapon's own beat: the Five-seveN's 1.6, the SC-20K's 2.4 */
  reload(dur = 1.6, beat?: ReloadBeat) {
    this.reloadT = 0; this.reloadDur = Math.max(0.3, dur);
    this.rlBeat(beat ?? { dur: this.reloadDur }); this.rlSrc = null; this.rlT = 0;   // (MOVES: the support hand's magazine change runs over the weapon's own beat — out / in / rack where the game's reload has them; no beat given = the clip's length)
  }
  /** the hand's keys off a weapon's beat (floors: its path needs them in order whatever it is handed — every weapon row is well inside them); `rack: null` = a round
   *  is still chambered, so the handle is left alone */
  private rlBeat(b: ReloadBeat) {
    const B = this.rlB, D = Math.max(0.3, b.dur);
    if (b.exact && b.out !== undefined && b.in_ !== undefined) { B.out = b.out; B.in_ = b.in_; B.pull = b.rack !== null && b.rack !== undefined; B.rack = b.rack ?? D; B.dur = D; B.hand = false; B.keep = -1; B.fresh = (B.out + B.in_) * 0.5; return; }
    B.out = Math.max(0.15, b.out ?? D * 0.27); B.in_ = Math.max(B.out + 0.6, b.in_ ?? D * 0.65); B.pull = b.rack !== null; B.rack = Math.max(B.in_ + 0.2, b.rack ?? D * 0.85); B.dur = Math.max(D, B.pull ? B.rack + 0.25 : B.in_ + 0.5);
    B.hand = b.hand === true; B.keep = b.keep !== undefined ? clamp(b.keep, B.out + 0.25, B.in_ - 0.4) : -1;
    B.fresh = B.keep >= 0 ? B.keep + (B.in_ - B.keep) * 0.3 : B.hand ? B.out + (B.in_ - B.out) * 0.4 : (B.out + B.in_) * 0.5;   // when the hand is at the fresh magazines
  }
  /** KIT: begin a change of what is in the right fist — `from` away to where it lives, then `to` out from where IT lives (either may be null: nothing in the
   *  hand before / after). Called mid-swap, what the hand actually has at that moment is what goes away first. Returns the seconds until `to` is up (0 = nothing
   *  to play). The caller draws his kit by kitHold / kitStow / kitRoll while it runs. Asked mid-reach for nothing after all, the empty hand eases back (`away`);
   *  `same` = another of the very item in the fist (a can of another kind): put away, the next one out. */
  kitSwap(from: KitItem | null, to: KitItem | null, shown?: { r: Vec3; l: Vec3; fingers: Vec3; back: Vec3 }, same = false): number {
    const K = KIT; let s0 = 0, roll0 = 0, re = false;
    if (this.kit) { from = this.kitHold ?? null; s0 = from ? this.kitStow : 0; roll0 = from ? this.kitRoll : 0; }
    if (from === to && !(same && !this.kit && to)) { if (!this.kit) { this.kitCancel(); return 0; } re = to !== null; from = null; }   // (asked back for the very thing that was on its way out: up again from where the hand is)
    const front = this.kitFront, Fr = K.front, sec = (T: Record<KitItem, number>, it: KitItem, f: number) => front && it === 'rifle' ? f : T[it];   // (a rifle on a sling in front: its own times)
    const q = from && to ? K.swapK : 1, far = !front && from && to && (from === 'rifle') !== (to === 'rifle') ? K.far : 0;   // (shoulder ↔ hip: the long way round)
    const tA = from ? sec(K.stow, from, Fr.stow) * q : 0, tR = to && !re ? tA + (sec(K.reach, to, Fr.reach) + far) * q : tA, D = to ? tR + sec(K.draw, to, Fr.draw) * q * (re ? 0.6 : 1) : tA + K.away + (from === 'rifle' && !front ? K.far : 0);
    // where the hands are NOW — from the pose as last shown, so the errand starts on the picture, not on whatever the pose under it has already jumped to on
    // the key's frame: the wrists and the right hand's lie as DRAWN (`shown`: the world's, the chest twist in them — changing guns re-stands the whole trunk under the arms, so a
    // start kept off the shoulders would swing with it), else off their shoulders in the trunk's frame; the hand's turn off the chest's either way
    const fk = this.fk, nd = this.nodes; fk.run(this.pose);
    const F = this.trunkFrame(), qi = quat.conj(fk.rot[nd.spine3]), loc = (a: Vec3, o: Vec3): Vec3 => { const d = v3.sub(a, o); return [v3.dot(d, F.left), v3.dot(d, F.up), v3.dot(d, F.fwd)]; };
    const cap = { r: loc(fk.pos[nd.handR], fk.pos[nd.upperArmR]), rq: quat.mul(qi, fk.rot[nd.handR]), l: loc(fk.pos[nd.handL], fk.pos[nd.upperArmL]), lq: quat.mul(qi, fk.rot[nd.handL]),
      mr: shown ? this.toModelP(shown.r) : null, ml: shown ? this.toModelP(shown.l) : null, mf: shown ? this.toModelD(shown.fingers) : null, mb: shown ? this.toModelD(shown.back) : null };
    this.kit = { t: 0, from, to, tA, tR, D, s0, roll0, re, front, cap };
    this.kitHold = from ?? (re ? to : null); this.kitStow = s0; this.kitRoll = roll0;
    return D;
  }
  /** KIT: the swap dropped where it stands (something else has the arms: a hold, lock work, a throw, a blow, a hit): the kit is where the game says, at once */
  kitCancel() { this.kit = null; this.kitHold = undefined; this.kitStow = this.kitRoll = 0; this.kitLie = null; }
  get kitBusy(): boolean { return this.kit !== null; }
  get nvBusy(): boolean { return this.nv !== null; }
  // ---- KIT: the goggles flipped down / up (KIT.nv) — by the left hand when it is free, else by a nod of the head. Asked by the game on the key's frame
  //      (kitanim.ts kitNv); never asked = nothing here runs and nvShown stays undefined.
  private nv: { t: number; hand: boolean; down: boolean; k0: number; c0: number } | null = null;
  private nvArm = 0; private nvNod = 0; private nvA = 0;   // (the arm's share of the goggle reach · the nod's pitch this frame, rad, + = chin down · the pitch the head was really posed with: the nod's, but for the look under a door, which poses it its own way)
  private nvTw: [number, number, number, number] = [0, 0, 0, 0];   // (last frame's neck / head twists, yaw and pitch: the look and the gaze stabiliser turn the head AFTER the layers, and the hand goes to where the goggles are drawn)
  /** while a flip runs: where the goggles are, 0 up on the brow … 1 down over the eyes (the drawer's in-between frame — rigProps gogglesBoxes); undefined = no
   *  flip under way: they are where the game says */
  nvShown: number | undefined = undefined;
  /** the goggles go down (or up): by the left hand if `hand`, else a nod. A flip already under way is turned round from where the goggles are; a hand already
   *  up there stays up (the clip is joined where its reach has the arm as high as it is). */
  nvFlip(down: boolean, hand: boolean) {
    const H = KIT.nv.hand, k0 = this.nvShown ?? (down ? 0 : 1); let t = 0;
    if (hand && this.nv?.hand && this.nvArm > 0.02) { let a = 0, b = H.reach; for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (smoothstep(0, H.reach, m) < this.nvArm) a = m; else b = m; } t = a; }
    this.nv = { t, hand, down, k0, c0: this.nv ? this.nvNod : 0 }; this.nvShown = k0;   // (c0: a nod cut short by this press is let go of over KIT.nv.nod.carry, not dropped in a frame)
  }
  /** the flip let go of where it is (he is down, a show has the stage): the goggles are where the game says */
  /** SMOKING (game/smokebreak.ts, which alone writes it): how far the LEFT hand is asked up to the mouth, 0‥1 — eased here at a hand's pace (smokeLayer) and
   *  given up the frame anything else has the arm. null = nobody asked: nothing of the layer runs for a figure that was never told to smoke. */
  smoke: number | null = null;
  private smokeArm = 0;
  nvCancel() { this.nv = null; this.nvArm = 0; this.nvNod = 0; this.nvA = 0; this.nvShown = undefined; }
  /** KIT: the errand under way has the rifle in it (going to the sling or coming off it) */
  private get kitRifle(): boolean { const k = this.kit; return !!k && (k.from === 'rifle' || k.to === 'rifle'); }
  /** KIT: the support hand's magazine work can be shown at all (it is the MOVES' reload layer) */
  get kitHandsOn(): boolean { return MOVES.on > 0.5 && MOVES.reload > 0.5; }
  /** KIT: a magazine change as the drawer needs it — is the magazine out of the gun, and is one in the support hand (the kept one on its way to the pouch, the
   *  fresh one on its way to the well). null = no change shown. */
  get reloadShow(): { out: boolean; hand: boolean } | null {
    if (!(this.mv2Shown.reload > 0.5)) return null;
    const B = this.rlB, t = this.mv2.rlAt;
    return { out: t >= B.out && t < B.in_, hand: (B.keep >= 0 && t >= B.out && t < B.keep) || (t >= B.fresh + 0.04 && t < B.in_) };
  }
  /** the change the support hand is SHOWING, as its beat and where it is on it (gunreload.ts reloadShow / reloadHandBoxes work a gun's own feeding out from this
   *  and nothing else: no state of their own). null = no change shown. */
  get feedClock(): { t: number; dur: number; out: number; in_: number; rack: number; pull: boolean; keep: number; fresh: number } | null {
    if (!(this.mv2Shown.reload > 0.5)) return null;
    const B = this.rlB; return { t: this.mv2.rlAt, dur: B.dur, out: B.out, in_: B.in_, rack: B.rack, pull: B.pull, keep: B.keep, fresh: B.fresh };
  }
  /** (MOVES: the hand's own clock stops where it is and the arm eases back to the gun from there — mvArms) */
  cancelReload() { this.reloadT = -1; this.rlT = -1; }
  private reloadDur = 1.6;
  /** Overhand throw off the right hand, THROW_DUR s, layered over whatever the legs are doing (standing, crouched, walking): torso and pelvis wind away and
   *  unwind hips-first, the hand comes up behind the head and whips past it — the item should leave it at THROW_RELEASE — then follows through down across
   *  the body and eases back to the pose beneath. Re-triggering mid-swing starts the new wind-up from where the hands are. `dist` (m over the floor to where the
   *  arc ends) picks the swing that reads that far — an underhand toss close in, the overhand short-armed in the middle, all of it far out (THROW_BY, with its
   *  switch on); `speed` (m/s over the floor it leaves at, where the caller knows it) keeps a hard throw from being a toss; no distance = the overhand as
   *  authored. The clock is the same for every one of them. GUNHAND.throwFree: begun with a long gun in the hands it is the LEFT hand's — the same swing
   *  mirrored, the gun kept in the trigger hand at the low ready (`thrOff`, throwLayer). */
  throwItem(dist?: number, speed?: number) {
    this.thrCarry = this.throwT >= 0 && this.thrLast ? { r: v3.copy(this.thrLast.r), l: v3.copy(this.thrLast.l) } : null; this.throwT = 0;
    this.thrOff = GUNHAND.on && GUNHAND.throwFree && this.longGun;
    this.thrLow = -1; this.thrFar = 1; this.thrHang = -1; this.thrHit0 = Math.max(clamp(this.mvs.cf.x, 0, 1), clamp(this.mvs.dz.x, 0, 1));   // (how far a fold or a blinding already has him as the swing starts: throwLayer gives way only to what lands after)
    if (THROW_BY.on && dist !== undefined && dist === dist) { const lo = THROW_BY.toss, hi = Math.max(THROW_BY.full, lo + 0.01);
      if (dist < lo && !(speed !== undefined && speed >= THROW_BY.tossFast)) this.thrLow = clamp(dist / lo, 0, 1); else this.thrFar = smoothstep(lo, hi, dist); }
  }
  get reloading() { return this.reloadT >= 0; }
  /** which swing the throw under way is (THROW_BY), null when not throwing — for the checks and the viewer's status line */
  get throwRead(): 'toss' | 'short' | 'full' | null { return this.throwT < 0 ? null : this.thrLow >= 0 ? 'toss' : this.thrFar < 1 ? 'short' : 'full'; }
  /** the item is still in the hand (up to a hair past THROW_RELEASE): hand props keep drawing it, a beat waits with the re-draw */
  get throwing() { return this.throwT >= 0 && this.throwT < THROW_RELEASE + 0.05; }
  /** the throw one-shot is playing at all (wind-up through recovery) */
  get inThrow() { return this.throwT >= 0; }
  /** GUNHAND.throwFree: the throw under way is the free (left) hand's — the long gun is still in the trigger hand: the drawer puts the can in the LEFT fist, the
   *  thing leaves from that hand, and IN HAND's long hold stays on the grip through it */
  get throwOff(): boolean { return this.throwT >= 0 && this.thrOff; }
  /** how much of the pistol's AIM clip the pose shows this frame, 0‥1 (the eased weight — `upper` flips on a frame): Character.inHandPass turns the gun hand onto the aim line by it */
  get aimShown(): number { return this.upperW.aim; }
  /** GUNHAND.whistle (gunhand.ts): how far the torch is UP in the hand that holds it, 0‥1 — 0 with the rule off. Character.inHandPass reads which way round
   *  the fist is on the torch by it: thumb to the lens in the low carry, thumb to the tail cap once it is raised */
  get torchUp(): number { return this.tuK; }
  /** GUNHAND.longReload: his long gun is off its line and his eyes are down at its magazine well — not on his sights, whatever carriage it is in (guards.ts
   *  canSeeChar asks before it lays his eye on his aim; fogofwar.ts gazeOf blends by `rlShown` instead, so the cone swings). False with the rule off. */
  get atWell(): boolean { return Math.max(this.rlc.k, this.rlc.h) > 0.5; }
  /** IN HAND (inhand.ts): nothing but the aim or the carry has the gun arm this frame — no hold, errand, swap, one-shot or look-only move over it. Character.inHandPass
   *  turns a pistol's or a torch's hand only then (and eases out otherwise): it does not fight a pose that has somewhere else to put that hand */
  get gunArmOwn(): boolean {
    return !(this.holdPose || this.heldPose || this.haul || this.lockpick || this.act || this.wound || this.kit !== null || this.sw.shown || this.hideHeldItem || this.throwT >= 0 || this.strikeT >= 0
      || this.hitT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.tellT >= 0 || this.mvBusy || this.mvs.tsT >= 0);
  }
  /** seconds into the throw, −1 when not throwing (THROW_RELEASE is the instant the hand lets go) */
  get throwTime() { return this.throwT; }
  get shooting() { return this.shootT >= 0 && this.shootT < 0.35; }
  /** Front kick at door-handle height off the rear (right) leg, 1.0 s, full body (locomotion is faded out under it and any stance stands up square — call it on
   *  a standing character): weight onto the left leg — held where it stood from the first frame — and a knee-up chamber (0–0.27 s), the drive (sole meets the
   *  door at KICK_IMPACT = 0.38 s, ~0.75 m ahead of the root, ~0.9 m up), recoil with the pelvis riding back so the foot re-plants under the hip (≈0.72 s) on the
   *  idle's own spot, then the weight settles forward. The pelvis counter-rotates and leans back, the pistol is pulled into a compressed high ready throughout.
   *  `leg: 'left'` throws the same kick mirrored — off the LEFT leg, the weight on the right (kickBody mirrors every lateral offset, yaw and roll and swaps the
   *  legs); the default right-leg kick is untouched by it. */
  kickDoor(opts: { leg?: 'left' | 'right' } = {}) { if (this.kickT < 0) { this.kickT = 0; this.kickHit = false; this.kickFrom = null; this.kickLeg = opts.leg ?? 'right'; } }
  get kicking() { return this.kickT >= 0; }
  /** which leg the kick in progress (or the last one) swings */
  get kickingLeg(): 'left' | 'right' { return this.kickLeg; }
  /** seconds into the kick, −1 when not kicking (KICK_IMPACT is the contact instant) */
  get kickTime() { return this.kickT; }
  /** true for exactly one update — the one in which the sole reached the door: swing the door / play the crack on this */
  get kickImpact() { return this.kickHit; }
  /** Left-hand signal, ~1 s, left arm only (the gun hand is untouched, so it layers over any carry or aim): 'hold' fist up beside the head, 'go' knife hand raised
   *  then chopped forward to point the way, 'rally' open hand circling above the head, 'aside' the open hand pushed twice at chest height
   *  ("off my line": showwhy.ts) — out to his own left, or with `side` -1 across his front to his right: the way he wants the man gone. Ignored while one is
   *  still playing. */
  signal(kind: SignalKind, side: 1 | -1 = 1) { if (kind === 'squeeze' && !mvOn('squeeze')) kind = 'hold'; if (this.sigT < 0) { this.sigT = 0; this.sigKind = kind; this.sigSide = side; } }
  get signalling() { return this.sigT >= 0; }
  /** His left hand is his own this frame: what leaves the gun arm its own (gunArmOwn below: no signal or tell still playing, no throw, reload, hit, blow,
   *  hold, lock, kit, wound), no kick or flash in his eyes, and none of the left hand's own layers out (showwhy.ts asks before it has him signal: a gesture
   *  is never laid over hands at work). */
  get signalFree(): boolean {
    return this.gunArmOwn && this.kickT < 0 && !this.dazzle && this.reloadAt < 0 && this.rlT < 0   // (… nor a magazine change on the game's own clock, which is no clip of this file's)
      && this.rx.w.x < 0.02 && this.wk.wL.x < 0.02 && this.dp.wL.x < 0.02 && !this.nv?.hand;   // (… nor the hand on the handset, at work on a thing, out to a door leaf, or at the goggles)
  }
  /** An idle tell, the LEFT arm and the head only (the right hand keeps the torch / the pistol grip, so it layers over the calm carry like a signal does): 'watch' —
   *  the forearm comes up across the chest, turned over, and the head drops to read it (~1 s); 'neck' — the hand goes to the back of the neck and works at it, the
   *  chest lifting a little into the stretch, the head tipping away (~1.3 s). Ignored while one is still playing (or a signal is: they share the arm). game/needs.ts
   *  plays them on a man about to leave his route; nothing else reads them. */
  tell(kind: TellKind) { if (this.tellT < 0 && this.sigT < 0) { this.tellT = 0; this.tellK = kind; } }
  /** drop a tell where it is (the trip it belonged to was broken off: the arm is the aim's / the flinch's from this frame) */
  cancelTell() { this.tellT = -1; this.tellShown = 0; }
  get telling() { return this.tellT >= 0; }
  /** which tell is playing (or played last) */
  get tellKind(): TellKind { return this.tellK; }

  update(dt: number) {
    const P = this.params; const c = this.clips; const nd = this.nodes;
    if (this.rawClip) {   // raw clip preview: rest pose underneath so nodes the clip does not key stay sane; one-shots cancelled (nothing here would ever finish them)
      const r = this.rawClip; r.time += dt * r.rate;
      this.pose.copy(this.rest); sampleClip(r.clip, r.time, r.loop, this.pose); this.twists.length = 0;
      this.shootT = this.hitT = this.reloadT = this.throwT = this.strikeT = this.kickT = this.sigT = this.tellT = -1; this.tellShown = 0; this.strikeK = 'cross'; this.readyW = 0; this.readyShown = 0; this.rdLive = false; this.crT = this.crW = this.creepShown = this.rcT = this.reachShown = 0; this.knifeShown = this.strikeLeth = false; this.kickHit = false; this.hideHeldItem = false; this.thrCarry = this.thrLast = null; this.bigK = 0; this.bigUnder = false;
      this.dp.wL.x = this.dp.wL.v = this.dp.wR.x = this.dp.wR.v = this.dp.tw.x = this.dp.tw.v = 0; this.dp.last = null;
      this.mvReset(); this.hwReset(); this.armsPre = null; this.bw = this.tk = null; this.kbSlash = this.kbBack = false; this.bwRise = 0;
      return;
    }
    // ---- one-shot clocks that shape the base graph (kick fades locomotion out under itself)
    const kt = this.kickT; const wK = kt >= 0 ? bump(kt, 0, 0.12, KICK_DUR - 0.2, KICK_DUR) : 0;   // locomotion fade under the kick
    const wKbody = kt >= 0 ? 1 - smoothstep(KICK_DUR - 0.2, KICK_DUR, kt) : 0;                      // the kick's body layer: full from the first frame (its curves and foot targets all start where the body is), eased off at the end
    const wKstand = kt >= 0 ? bump(kt, 0, 0.2, KICK_DUR - 0.3, KICK_DUR) : 0;                       // a stance's squat / blade / lean standing up square for the kick
    const wKslow = kt >= 0 ? bump(kt, 0, 0.3, KICK_DUR - 0.3, KICK_DUR) : 0;                        // what the arms and a crouch follow (hanging arms need longer than 0.1 s to find the gun)
    const wLp = clamp(this.lpW.step(this.lockpick ? 1 : 0, 17, dt), 0, 1);
    if (this.haul) this.hlLast = this.haul; else if (this.hlW.x < 0.003) this.hlLast = null;
    const wHl = this.hlLast ? clamp(this.hlW.step(this.haul ? 1 : 0, 16, dt), 0, 1) : 0;   // both hands on a body (hands.ts): ≈ 0.35 s onto it, the same off
    if (this.holdPose) this.hdLast = this.holdPose; else if (this.hdLast.phase === 'whip' && this.hdLast.t < HOLD.secs.whip + 1) this.hdLast = { ...this.hdLast, t: this.hdLast.t + dt };   // (what the layers ease out from once the controller lets go — a whip that has landed plays its follow-through on the way out)
    if (this.heldPose) this.heLast = this.heldPose;
    const thruWhip = !this.holdPose && this.hdLast.phase === 'whip' && this.hdLast.t >= HOLD.secs.whip && this.hdLast.t < HOLD.secs.whip + WHIP_THRU;   // (a whip that landed keeps the layer up through its follow-through, then lets go)
    const wHd = clamp(this.hdW.step(this.holdPose || thruWhip ? 1 : 0, this.holdPose ? 16 : holdOutRate(this.hdLast, this.speed, this.holdBusy()), dt), 0, 1),   // (out of a kill or a finished choke he comes up off the man slowly for as long as he stands where he is)
      wHe = clamp(this.heW.step(this.heldPose ? 1 : 0, 16, dt), 0, 1);
    // each figure's eased share of the variant (0 = arm ↔ 1 = gun): the variant's own the frame a hold begins, sprung across when E changes it with the man already
    // in the arm (player.ts swapHold) — holdLayer hands the right fist over behind his shoulder by it, heldLayer re-settles the man's hands and head by it
    { const gvT = (this.holdPose ?? this.hdLast).variant === 'gun' ? 1 : 0; if (this.holdPose && !this.hdOn) { this.hdFrom = null; this.hdCaught = false; this.hdGv.x = gvT; this.hdGv.v = 0; this.hdCk.x = 0; this.hdCk.v = 0; this.hdKc.x = 0; this.hdKc.v = 0; this.hdLo.x *= wHd; this.hdLo.v = 0; this.hdHu.x *= wHd; this.hdHu.v = 0; } else { this.hdGv.step(gvT, SWAP_RATE, dt); if (!this.holdPose && this.hdOn && this.hdLo.x > 0) this.hdLo.x = Math.min(1, this.hdLo.x / Math.max(wHd, 0.05)); } this.hdOn = !!this.holdPose;
      const heT = (this.heldPose ?? this.heLast).variant === 'gun' ? 1 : 0; if (this.heldPose && !this.heOn) { this.heGv.x = heT; this.heGv.v = 0; this.heLk.x = 0; this.heLk.v = 0; this.heKc.x = 0; this.heKc.v = 0; this.heBo.x = 0; this.heBo.v = 0; this.heBc.x = 0; this.heBc.v = 0; this.heLo.x *= wHe; this.heLo.v = 0; this.heHu.x *= wHe; this.heHu.v = 0; this.heHr[0] = this.heHr[1] = null; } else { this.heGv.step(heT, SWAP_RATE, dt); if (!this.heldPose && this.heOn && this.heLo.x > 0) this.heLo.x = Math.min(1, this.heLo.x / Math.max(wHe, 0.05)); } this.heOn = !!this.heldPose; }
    // (a fresh hold starts the lowering's CLOCKS over, whatever the last one — on this man or by this arm — ended on. What is still SHOWN of it is hdLo / heLo × the layer's weight while the
    //  layer fades and the spring alone while a hold is up, so the weight is folded into the spring at the grab — and back out when a hold lets go — and what shows carries over and only
    //  comes up: zeroed here it was a one-frame pop of up to 28 cm on a grab a few frames after a choke; left as it was, the weight came back at 16 /s under a spring leaving at 7 and
    //  he squatted a second time, up to 14 cm)
    this.holdGunSide = this.hdGv.x >= 0.5;                        // which tool the hold's right hand has (the knife below ½, the pistol from there: they change hands behind the man's shoulder)
    const gunHold = wHd > 0.003 && this.holdGunSide;             // the pistol stays in the hand through this hold: drawn, lit if it was, and a shot's recoil is the hold layer's (not the two-handed aim clip's)
    this.hideHeldItem = wLp > 0.5 || wHl > 0.5 || (wHd > 0.5 && !gunHold) || (this.bigTool !== null && bigOff(this.bigTool));   // hands on the lock tools, or both on a held man: the pistol rides the thigh — or off his gun for the big slot's tool (BIGMOVE: never with bigTool null)
    { const Wd = CREEP.wide, want = clamp(this.wide, 0, 1), inn = want >= this.wideS;   // (CREEP.wide: slow in — and only while he moves: a stop is a held frame of the move — fast out)
      if (!inn || Math.abs(this.speed) > Wd.still) this.wideS = want || this.wideS > 1e-3 ? damp(this.wideS, want, inn ? Wd.in : Wd.out, dt) : 0; }
    this.lowS = this.low > 0 || this.lowS > 1e-3 ? damp(this.lowS, clamp(this.low, 0, 1), this.low <= 0 && this.spring > 0 ? CREEP.low.up : CREEP.low.rate, dt) : 0;   // (CREEP.low: the shown share of it — eased, so a stalk taken up or let go by another man does not snap)
    this.crouch = damp(this.crouch, Math.max(this.crouchTarget, clamp(this.coil, 0, 1), this.lockpick ? 1 : 0) * (1 - (this.lockpick ? 0 : clamp(this.rise, 0, 1))), this.spring > 0 ? this.spring : 10, dt);   // (rise: 0 unless fed — stalk.ts's tell)
    const s = Math.abs(this.speed) * (1 - wK);
    const crouchPose = this.bw || this.tk ? this.takePre(dt, this.crouch * (1 - wKslow)) : this.crouch * (1 - wKslow);   // the crouch actually shown (the kick stands him up; so does a takedown's own move, and the man it lands on sags)
    // ---- deliberate movement (`deliberate`, eased here) and the crouch's centre of gravity by pace — the shares everything below reads (sneakLayer):
    //      Dl = deliberate AND crouch-walking (retime, stride, linger, the 4 cm, the lean), pace = creep → full crouch pace (the 3 cm and the longer step),
    //      soft = deliberate walking upright (a centimetre of knee), armsIn = deliberate at all (a little even planted, the rest with movement). The wall
    //      hold keeps its own body and feet: all but the arms let go by its share of the pose (last frame's springs — this frame's are stepped further down).
    const D = clamp(this.dlb.step(clamp(this.deliberate, 0, 1), 15, dt), 0, 1);
    const offWall = 1 - clamp(this.st.w.x, 0, 1) * clamp(this.wst.wl.x, 0, 1);
    // THE HELD GAIT (creep): gH = its share (0 = none of this runs). Under it the cycle is never let go of for the idle — the walk's (crouched, the crouch-walk's)
    // pose stands at whatever phase the feet have reached, the phase is advanced by the ground the ROOT actually covered (crV: a tap moves the stride on by that
    // much and it stays there; pressed against a wall it does not march), and what the sneak layer shapes by pace is held at the pace he last moved at.
    const gH = this.creep || this.crT > 0 ? this.creepGait(dt) : 0;
    let mv = smoothstep(0.15, 0.5, s), paceS = smoothstep(0.38, 0.95, s / P.crouchSpeed);
    if (gH > 0) { if (this.crV > 0.05 && s > 0.05) this.crPace = damp(this.crPace, paceS, 10, dt); mv = lerp(mv, 1, gH); paceS = lerp(paceS, this.crPace, gH); } else this.crPace = paceS;
    const Dl = D * mv * offWall * crouchPose, pace = paceS * mv * offWall * crouchPose, soft = D * mv * offWall * (1 - crouchPose);
    const armsIn = D * offWall * lerp(0.4, 1, mv);
    const dsh = this.dash > 0 || this.dashW > 0.002 ? (this.dashW = clamp(damp(this.dashW, clamp(this.dash, 0, 1), DASH.rate, dt), 0, 1)) * mv * offWall * crouchPose : (this.dashW = 0);
    const strideD = (1 + SNEAK.stride * D * mv * offWall) * (1 + DASH.stride * dsh);   // the crouch cycle's cadence comes down by this and its stride goes up by it (× crouch: the rate lerp below, the pose in sneakLayer)
    // ---- locomotion (stand) ----
    // weights among idle / walk / jog by speed
    // The GAIT is chosen by ground speed on its own thresholds (BLEND), separate from the clips' natural speeds (P.*Speed) that set the phase RATE:
    // a brisk 1.6 m/s is still every bit a walk (played quicker), not a fifth of a run; and a slow prowl keeps the whole walk cycle at a lazy cadence
    // instead of half-dissolving into the idle (which used to freeze the stride while the ground kept moving — measured skate at 0.8 m/s: 22 cm/s).
    let wWalk = 0, wJog = 0, wSprint = 0;
    if (s <= BLEND.walkTop) wWalk = smoothstep(BLEND.walkIn0, BLEND.walkIn1, s);
    else if (s <= BLEND.jogAt) { wJog = smoothstep(0, 1, (s - BLEND.walkTop) / (BLEND.jogAt - BLEND.walkTop)); wWalk = 1 - wJog; }
    else { wSprint = clamp((s - BLEND.jogAt) / (P.sprintSpeed - BLEND.jogAt), 0, 1); wJog = 1 - wSprint; }
    let wIdle = 1 - wWalk - wJog - wSprint;
    if (gH > 0) { const hold = wIdle * gH; wWalk += hold; wIdle -= hold; }   // (the held gait: the idle's share is the walk's)
    // phase advance: rate so that feet match ground speed (natural clip speed = P.walkSpeed / P.jogSpeed / P.sprintSpeed)
    // the run clip is a bounding stride (its feet cover the ground of ~6 m/s at rate 1): at a jog its stride is warped shorter at the feet (jogShape below, K < 1)
    // and the cycle turned over faster by 1/K, so the feet keep matching the ground while the cadence comes up to a runner's instead of a long slow lope. The warp
    // comes in with the jog's weight against the walk (whose shared rate it would drag up) and then STAYS through the sprint hand-off: the sprint clip's feet are
    // warped shorter still (sprintShape), so a jog let back out to its full bound would put a hump in the leg spread and a dip in the cadence half way up.
    const Kj = wJog > 0.001 ? clamp(lerp(1, RUN_WARP.stride, wJog + wSprint), RUN_WARP.stride, 1) : 1; this.runK = Kj;
    const rateWalk = (s / P.walkSpeed) / c.Walk_Loop.duration, rateJog = (s / P.jogSpeed) / c.Jog_Fwd_Loop.duration / Kj, rateCrouch = (s / P.crouchSpeed) / c.Crouch_Fwd_Loop.duration / strideD, rateSprint = (s / P.sprintSpeed) / c.Sprint_Loop.duration;
    const wsum = Math.max(1e-3, wWalk + wJog + wSprint);
    let rate = (wWalk * rateWalk + wJog * rateJog + wSprint * rateSprint) / wsum;
    rate = lerp(rate, rateCrouch, this.crouch);
    if (s < 0.05) rate = 0;
    if (gH > 0) rate = lerp(rate, lerp((wWalk / (P.walkSpeed * c.Walk_Loop.duration) + wJog / (P.jogSpeed * c.Jog_Fwd_Loop.duration * Kj) + wSprint / (P.sprintSpeed * c.Sprint_Loop.duration)) / wsum, 1 / (P.crouchSpeed * c.Crouch_Fwd_Loop.duration * strideD), this.crouch) * this.crV, gH);   // (cycles per metre × the metres a second the root really made: the stride moves on with the ground and stops with it)
    this.phase = (this.phase + dt * rate * (this.reverse ? -1 : 1) + 100) % 1;
    if (this.tapU >= 0 && gH > 0) {   // (tapstep.ts: the stride belongs to the step)
      if (this.tapWas < 0) { this.tapSeen = this.tapN; this.tapFrom = this.tapTo = this.phase; }
      else if (this.tapN !== this.tapSeen) { this.tapSeen = this.tapN; const p = this.creepPlant()[1], w = this.tapWay, off = ((this.phase - p) % 0.5 + 0.5) % 0.5, go = w > 0 ? 0.5 - off : off; this.tapFrom = this.phase; this.tapTo = this.phase + w * (go < 0.2 ? go + 0.5 : go); }   // (a short way to the next plant is no step: the one after)
      this.phase = (this.tapFrom + (this.tapTo - this.tapFrom) * clamp(this.tapU, 0, 1) + 100) % 1; }
    this.tapWas = gH > 0 ? this.tapU : -1;
    if (WALLSNAP.on && WALLSNAP.pose) {   // the wall hold's own step clock (wallBody: WALL_POSE.gait) — SIGNED along the wall (his right +), so a reversal walks the same soles back; parked it rests where the lead foot is just down and the other about to leave
      if (this.stance === 'wall') this.wallGait = (this.wallGait + dt * s * this.stackSide * (this.reverse ? -1 : 1) / (2 * lerp(WALL_POSE.gait.step[0], WALL_POSE.gait.step[1], clamp(this.crouch, 0, 1))) + 100) % 1;
      else this.wallGait = WALL_GAIT_REST;   // (stopped ON the wall it stands where it stopped until the parked spots have the feet whole — wallBody puts it back to rest then: no sole jumps under a stop)
    }
    this.idleT += dt;
    // the linger (deliberate, crouched): the cycle is SAMPLED at a phase eased about the true one — slow just after each foot comes down, quick through the
    // swings, the mean rate untouched (so footfalls, and anything else keyed to `phase`, keep their count) — and the lower body rides a matching fore-aft
    // surge (sneakLayer) so the planted foot holds its ground speed through it: the body hangs back over the foot just set down, then comes on
    // The run's stance linger (RUN_LINGER) is the same re-timing about the run's mid-stance, deeper and flat-bottomed (cos θ − cos 3θ ⁄ 9: rate 1 − aR over each
    // plant, 1 + aR through each flight), with no surge — there the slow-down itself is what brings the stance foot down to the ground's speed. It is on by the
    // jog's share of the pose: nothing while the walk still has most of it (a sixth of jog rides the walk's timing), full from there to where the sprint has
    // two thirds, nothing left by the full sprint (whose own warp holds the floor); the crouch has its own above, and the two only meet for the few frames of a
    // run dropping into a crouch, where their sum still leaves the rate positive. The stance it centres on slides from the jog's to the sprint's with the blend.
    const aL = SNEAK.linger * Dl, th = 4 * Math.PI * (this.phase - this.gait.linger);
    const wRun = smoothstep(0.08, 0.45, wJog) * (1 - crouchPose), aR = RUN_LINGER.depth * wRun, rg = this.runGait, thR = 4 * Math.PI * (this.phase - lerp(rg.jog.c, rg.sprint.c, wSprint));
    this.lg.run = smoothstep(0.08, 0.45, wJog + wSprint) * (1 - crouchPose); this.lg.sprint = wSprint * (1 - crouchPose);   // the run's share of the pose, jog through sprint: what a steadied long gun holds the shoulders against (longBody)
    const ph = aL > 1e-5 || aR > 1e-5 ? (this.phase - aL / (4 * Math.PI) * Math.sin(th) - aR * (Math.sin(thR) - Math.sin(3 * thR) / 27) / (8 / 9) / (4 * Math.PI) + 1) % 1 : this.phase;
    const surge = aL > 1e-5 ? -aL * SNEAK.surge * strideD * (1 + SNEAK.paceStride * pace) * P.crouchSpeed * c.Crouch_Fwd_Loop.duration / (4 * Math.PI) * Math.sin(th) * (this.reverse ? -1 : 1) : 0;   // (ground per cycle = stride factor × the clip's own; × the share of it the clip's stance really covers)
    // stand pose (the idle is not sampled when the cycle's pose is about to replace ALL of it: blendPose at a weight ≥ 1 copies every float of every node from pB over pA,
    // nothing reads pA in between, and a sample writes nothing but its pose — at a full walk / run that is one clip of the two not evaluated)
    if (!(wWalk + wJog + wSprint > 0.001 && 1 - wIdle >= 1)) sampleClip(c.Idle_Loop, this.idleT, true, this.pA);
    if (wWalk + wJog + wSprint > 0.001) {
      if (wSprint > 0.001) {
        this.sampleJog(ph, this.pB); this.jogShape(this.pB, ph);                                             // the same flattened, stride-warped run the walk→jog branch shows (no seam crossing BLEND.jogAt)
        sampleClip(c.Sprint_Loop, ph * c.Sprint_Loop.duration, true, this.pC); this.sprintShape(this.pC);    // the sprint's own stride warp, on its pose before the two runs blend
        blendPose(this.pB, this.pC, wSprint, null, this.pB);
      } else {
        sampleClip(c.Walk_Loop, (ph + WALK_PHASE) * c.Walk_Loop.duration, true, this.pB);   // phase-aligned to the jog it blends with (WALK_PHASE)
        if (wJog > 0.001) {
          this.sampleJog(ph, this.pC);
          this.jogShape(this.pC, ph);
          blendPose(this.pB, this.pC, wJog, null, this.pB);
        }
      }
      blendPose(this.pA, this.pB, 1 - wIdle, null, this.pA);
    }
    if (wRun > 1e-3 && SOFT_KNEE.on > 0.5) this.softKnees(this.pA, wRun);   // ease the push-off leg short of dead straight (see SOFT_KNEE — its own switch, not the linger's) before the plant re-solves the stance leg
    // the run's stance feet pinned to the floor and the ground's speed through each stance window (after the whole stand pose is together: it re-solves the
    // stance leg under whatever the blend made of it; the crouch blend, the life layer and the stances that follow keep the feet where they find them).
    // RUN_LINGER.depth 0 switches the pin off with the re-timing (its doc: 0 = the cycle as it was) — a foot let go that way bleeds its offset off like a stop's
    const wPin = RUN_LINGER.depth > 0 ? wRun : 0;
    this.plantW = wPin >= this.plantW ? wPin : this.plantW * Math.exp(-dt / 0.04); if (this.plantW < 1e-3) this.plantW = 0;
    if (this.plantW > 0 || this.plantL.dev !== 0 || this.plantR.dev !== 0) this.runPlant(ph, s, dt, this.plantW, wSprint); else this.plantL.pz = this.plantR.pz = NaN;   // (a foot let go mid-swing by a stop still bleeds its offset off; at rest the layer is skipped outright — walk, crouch and sprint pose exactly as they did)
    // ---- stance springs (run always: they hold the shape the arms morph through; the master weight is what comes and goes)
    const st = this.st, ws = this.wst; const SW = 13;   // 90 % there in 0.3 s, soft at both ends
    const runLow = this.runReady && this.stance === 'none', stance: Stance = runLow ? 'lowReady' : this.stance;   // (RUNREADY: the sprint's low ready is a stance nobody set — false, and `stance` his own, wherever the input is not raised)
    const held: Stance = kt >= 0 && kt < 0.55 ? 'highReady' : stance;   // the kick pulls whatever carry is up into the compressed high ready (an extended low ready would meet the knee), handing back for the plant
    const shape = held !== 'none' ? STANCES[held] : null; const side = this.stackSide;
    const wWas = Math.max(clamp(st.w.x, 0, 1), wKslow);   // the weight the last frame showed (read before stepping: one 60 Hz step from nothing already carries the master past the snap threshold below)
    const wSt = clamp(st.w.step(stance !== 'none' ? 1 : 0, stance === 'none' && this.stanceOut > 0 ? this.stanceOut : this.stanceIn > 0 && stance !== 'none' ? this.stanceIn : stance === 'wall' || this.stanceSeen === 'wall' ? 22 : SW, dt), 0, 1);   // the master weight follows the stance itself (a kick from no stance shows the carry through wKslow); on and off the wall in ~0.2 s
    if (this.stanceOut > 0 && (stance !== 'none' || wSt < 0.02)) this.stanceOut = 0;   // (the wall's quick way out is for THAT exit: gone once the pose is, or once another stance is asked for)
    if (this.stackPress !== this.stackPressSm) this.stackPressSm += clamp(this.stackPress - this.stackPressSm, -0.9 * dt, 0.9 * dt);   // (WALLSNAP: the press walks across at 0.9 m/s — a turn-about is a quarter second of it, never a frame)
    const armed = this.upper === 'relaxed' || this.upper === 'aim' || this.shootT >= 0;   // the pistol is in the hand (the door hand must then be the left)
    const parkNow = 1 - smoothstep(0.12, 0.7, s);                                          // the wall hold: standing on its own foot spots (1) or on the cycle's feet (0)
    if (shape) {
      const snap = wWas < 0.02 && this.stanceSeen !== held;   // taking a shape from (next to) nothing: start AT it rather than morphing from the last one under a rising weight
      if (snap) {
        for (const [k, sp] of Object.entries(st)) if (k !== 'w') { sp.v = 0; sp.x = k === 'blade' ? -side * shape.blade : k === 'headYaw' ? -side * shape.headYaw : k === 'side' ? shape.side - 0.02 * side * (shape.blade / 22) : (shape as unknown as Record<string, number>)[k]; }
        for (const sp of Object.values(ws)) sp.v = 0; ws.wl.x = held === 'wall' ? 1 : 0; ws.side.x = side; ws.peek.x = clamp(this.wallPeek, 0, 1); ws.park.x = parkNow;
      }
      this.stanceSeen = held;
      const gw = held === 'lowReady' && this.gunWall > 1e-4 ? clamp(this.gunWall, 0, 1) : 0, TP = WALL_TUCK.pistol, gwo = gw ? clamp(this.gunWall - 1, 0, 1) * WALL_TUCK.over : 0;   // (the low ready pulled in for a wall: WALL_TUCK — 0, the shape's own numbers to the bit)
      const RR = runLow && held === 'lowReady' ? RUNREADY : shape;   // (the sprint's low ready: the same stance drawn in — `shape` itself everywhere else)
      st.fwd.step(gw ? lerp(RR.fwd, TP.fwd, gw) - gwo : RR.fwd, SW, dt); st.up.step(gw ? lerp(RR.up, TP.up, gw) : RR.up, SW, dt); st.side.step(shape.side - 0.02 * side * (shape.blade / 22), SW, dt); st.pitch.step(gw ? lerp(RR.pitch, TP.pitch, gw) : RR.pitch, SW, dt);
      st.lean.step(shape.lean, SW, dt); st.headPitch.step(shape.headPitch, SW, dt); st.tuck.step(gw ? lerp(RR.tuck, TP.tuck, gw) : RR.tuck, SW, dt);
      st.blade.step(-side * shape.blade, SW * 0.8, dt); st.headYaw.step(-side * shape.headYaw, SW, dt); st.squat.step(shape.squat, SW * 0.8, dt);   // (yaw + = to the figure's left; side + = wall on its right)
      ws.wl.step(held === 'wall' ? 1 : 0, this.stanceIn > 0 && held === 'wall' ? this.stanceIn : 22, dt); ws.side.step(side, SW, dt); ws.peek.step(clamp(this.wallPeek, 0, 1), 20, dt);   // (wl at the wall's own brisker rate; the peek is already ramped by the controller)
      ws.park.step(parkNow, parkNow < ws.park.x ? 30 : 12, dt);   // off the spots briskly when he sets off (the feet must be the cycle's within a stride), back onto them over ~0.3 s when he stops — a shuffle into place, not a skate
    }
    const wCarry = Math.max(wSt, wKslow);   // the kick pulls the gun into the compressed carry whatever the stance
    const wl = clamp(ws.wl.x, 0, 1);        // …of which the wall hold's share — of the STANCE weight: read as wSt · wl everywhere (a hold that comes and goes from 'none', the player's, leaves wl standing at 1 by design while wSt carries it out; read bare it switched the carries and the long gun off for good after his first wall — the rifle hung from one hand)
    // ---- the long gun's carriage (rifles): which of the four the pistol man's upper / stance / kick amount to (or the forced one), its channels following at the
    //      stances' rate — set straight AT the first carriage taken from nothing, morphing between them after — and the master weight following longGun itself
    let wLg = 0, lgWant: LongStance | null = null;
    if (this.longGun || this.lg.w.x > 0.002) {
      const want: LongStance = this.thrOff && this.throwT >= 0 && this.throwT < THROW_DUR - 0.25 && this.shootT < 0 ? 'lowLong'   // (GUNHAND.throwFree: one hand on it while the other throws — the gun comes down to the low ready for the swing, and back up over the recovery as the aim does; a round that leaves inside the swing has it in the shoulder, as every shot does)
        : this.longStance ?? (this.upper === 'aim' || this.shootT >= 0 ? 'shoulder' : held === 'lowReady' ? 'lowLong' : held === 'highReady' || held === 'stack' ? 'portLong' : 'patrolLong');
      const wLgWas = clamp(this.lg.w.x, 0, 1);
      const drew = this.longGun && (this.lg.seen === null || wLgWas < 1 && !this.lgArmedWas);   // the rising edge of longGun: a weapon put in the hands from nothing OR re-armed while the last draw's weight was still easing out (E-E, 2→1→2, a short wall hug — review 08-10 #14: it floated level off a hanging wrist for 9–16 frames)
      if (drew) { if (!this.kitRifle) { this.lg.w.x = 1; this.lg.w.v = 0; } this.lg.lat[0] = this.lg.lat[1] = NaN; }   // (KIT: a rifle the hand is still bringing off the sling — its carriage comes in under the errand, eased)   // a weapon put in the hands from nothing (a fresh man armed, the viewer's toggle) is held at once — the prop appears that frame too; only letting go of it eases (and its steadied line starts where the trunk is)
      wLg = clamp(this.lg.w.step(this.longGun ? 1 : 0, SW, dt), 0, 1); this.lgArmedWas = this.longGun;
      const tgt = longTargets(want, crouchPose); const chs = this.lg.ch;   // ← the posture blend: LONG (standing) toward LONG_CROUCH by the crouch shown, ahead of the springs
      if (this.gunWall > 1e-4 && (want === 'lowLong' || want === 'patrolLong')) longTuck(tgt, this.gunWall);   // (… and the low carriages pulled in for a wall: WALL_TUCK)
      if (drew || this.lg.seen === null || (wLgWas < 0.02 && this.lg.seen !== want)) {
        const from = this.lg.seen === null && want === 'shoulder' && wSt * wl > 0.1 ? longTargets('lowLong', crouchPose) : tgt;   // drawn off the sling the frame he steps off a wall (the player): it comes UP into the shoulder through the low ready while the hold still has his body — the low ready's point is inside the support arm's reach with the shoulders still square to the plaster, the shouldered one is not for a tenth of a second (the hand trailed the fore-end by 20 cm)
        chs.forEach((sp, i) => { sp.x = from[i]; sp.v = 0; });
      } else chs.forEach((sp, i) => sp.step(tgt[i], SW, dt));
      this.lg.seen = want; this.longShown = wLg > 0.5 ? want : null; if (this.longGun) lgWant = want;
      this.reloadCarry(dt, want);
    } else { this.lg.seen = null; this.longShown = null; this.rlc.k = this.rlc.h = this.rlShown.carry = this.rlShown.head = 0; }
    const wWallArms = wSt * wl * (this.stance === 'wall' ? 1 : 1 - wLg);   // the wall hold's claim on the ARMS: its share of the stance while it is held; coming off it, a long gun back in the hands (the player's, drawn off the sling the frame he steps away) takes them back at once rather than through the hold's fifth of a second out — the weapon is drawn in the hand from that frame, so the hands are on it from that frame (the body still peels off the plaster at the hold's own rate: wallBody)
    // crouch pose (the kick stands him up: crouchPose above)
    if (crouchPose > 0.001) {
      const wMove = gH > 0 ? lerp(clamp(s / (P.crouchSpeed * 0.6), 0, 1), 1, gH) : clamp(s / (P.crouchSpeed * 0.6), 0, 1);   // (the held gait: the crouch-walk's pose at a stand too)
      if (!(wMove >= 1)) sampleClip(c.Crouch_Idle_Loop, this.idleT, true, this.pB);   // (at the full crouch pace the cycle's pose replaces every float of it, as the stand pose's idle above)
      if (wMove > 0.001) { sampleClip(c.Crouch_Fwd_Loop, ph * c.Crouch_Fwd_Loop.duration, true, this.pC); blendPose(this.pB, this.pC, wMove, null, this.pB); }
      blendPose(this.pA, this.pB, crouchPose, null, this.pA); this.crWalk = crouchPose * wMove;
    } else this.crWalk = 0;
    // ---- MOVES: the crouch walk carried level — the cycle's roll and wide base most of the way out (steadyLayer). HERE, on the bare locomotion with the cycle's
    //      own sample still in pC: under the foot lock (a held stride is pinned where THIS leaves the soles), the upper-body layers (a gun's carry replaces the
    //      spine it would otherwise hand the chest back through), the stances and the arms
    { const sw = mvOn('steady') ? this.crWalk * offWall : 0;
      if (MOVES.steady > 1.5 || this.steadyUp > 0) { this.steadyUp = damp(this.steadyUp, MOVES.steady > 1.5 ? MV.steady.rise * sw : 0, MV.steady.riseRate, dt); if (this.steadyUp < 1e-5 && sw <= 0.003) this.steadyUp = 0; }
      if (sw > 0.003 || this.steadyUp > 0) { const sq = wSt * (1 - wl) * (1 - wKstand);
        const sunk = smoothstep(MV.steady.deep[0], MV.steady.deep[1], SNEAK.drop * Dl + SNEAK.paceDrop * pace + lerp(CREEP.drop[0], CREEP.drop[1], crouchPose) * clamp(this.crW, 0, 1));   // (by how far the layers after this one will sink the pelvis)
        this.steadyLayer(sw > 0.003 ? sw : 0, (1 - smoothstep(0, 0.01, (Math.max(0, st.squat.x) + Math.abs(st.blade.x) * 0.003) * sq)) * (1 - sunk), sunk); } }
    if (MOVES.on > 0.5) {   // the hand pass: where the locomotion has left every digit, before any layer shapes a hand (handsPass measures what they did against it)
      const H = this.hn, d = this.pA.data;
      for (let sd = 0; sd < 2; sd++) { const ns = H.nodes[sd], b = H.base[sd]; for (let k = 0; k < 15; k++) { const o = ns[k] * 10 + 3; b[k * 4] = d[o]; b[k * 4 + 1] = d[o + 1]; b[k * 4 + 2] = d[o + 2]; b[k * 4 + 3] = d[o + 3]; } H.note[sd].fill(Infinity); }
    }
    // ---- life: breathing, the body's mass on starts / stops, the weight shifting foot to foot at rest (under every stance / hold / one-shot: they weigh it out) —
    //      and the standing foot lock, which the stances / holds / lockpick weigh out the same way (they have the whole body) but of the one-shots only the KICK
    //      does: the flinch (Hit_Chest) and the cross (Punch_Cross) are upper-body clips and the throw re-plants the pose's own feet, so through those the planted
    //      soles stay where they are — let go with the rest of the layer, feet lagging the body by the usual 20-odd degrees skated 12 cm back under the pose at
    //      1.8 m/s on every flinch or throw after a turn (review #18; tools/qa/gait.ts transitions, the one-shot row: 126 mm → under a millimetre)
    { const body = (1 - wSt) * (1 - wHd) * (1 - wHe) * (1 - wLp);
      const hard = kt >= 0 || this.throwT >= 0 || this.hitT >= 0 || this.strikeT >= 0 || this.mvBusy ? 0 : 1;   // one-shots that have the body's life motion: eased in and out (rate 12), so the weight shift hands over instead of vanishing in a frame
      this.life.gate = damp(this.life.gate, hard, 12, dt);
      this.feet.gate = damp(this.feet.gate, kt >= 0 ? 0 : 1, 12, dt);                            // the lock's own gate: the kick alone (same easing, so a kick from rest poses exactly as it did)
      this.lifeLayer(dt, s, crouchPose, body * this.life.gate, body * this.feet.gate); }
    // ---- upper body layers ----
    const tgt = { relaxed: this.upper === 'relaxed' ? 1 : 0, aim: this.upper === 'aim' ? 1 : 0, torch: this.upper === 'torch' ? 1 : 0 };
    if ((this.shootT >= 0 || lgWant === 'shoulder') && wHd <= 0.003) { tgt.aim = 1; tgt.relaxed = 0; tgt.torch = 0; }   // (any hold layer up — either side, or mid-swap — keeps the two-hand aim clip out: a round fired past a held man is holdLayer's own kick of the gun hand; keying this off the EASED gun side let Pistol_Shoot blend in over the hold for ~0.1 s when E swapped gun→arm inside a shot — review finding)   // a long gun SHOULDERED is the aim whoever asked for the carriage (the player forces it whenever the rifle is in his hands): the aim clip's trunk under it — square, steady at a walk or a run — is what its blade / lean / head were tuned over, and what keeps the fore-end inside the support arm's reach on the move (over the run clip's own trunk, pumping ±25°, the hand came off it)
    if (this.throwT >= 0 && this.throwT < THROW_DUR - 0.25) tgt.aim = 0;   // the throwing arm has the upper body: the aim clip fades out under the wind-up (≈ 0.15 s at rate 14) and comes back up over the recovery
    const snapR = this.upperW.relaxed, snapA = this.upperW.aim, snapT = this.upperW.torch;   // (MOVES.snap, below: the three as they stood)
    this.upperW.relaxed = damp(this.upperW.relaxed, tgt.relaxed, 9, dt);
    this.upperW.aim = damp(this.upperW.aim, tgt.aim, this.kitRifle ? KIT.trunk : 14, dt);   // (KIT: a rifle on its way to or from the sling — the trunk follows the hands, not the key)
    this.upperW.torch = damp(this.upperW.torch, tgt.torch, 9, dt);
    if (this.shootT === 0) this.snapShot = wLg <= 0 && mvOn('snap');   // (the fire frame: fire() set the clock, the tail of this section runs it)
    if (wLg <= 0 && mvOn('snap')) {   // the pistol's carry and its aim TRADE (MOVES.snap): this frame's steps above, taken only as far as the other layer covers for them — the base clip's hanging arm never shows between the two
      const u = this.upperW, S = MV.snap, over = (x: number) => smoothstep(S.cover[0], Math.max(S.cover[1], S.cover[0] + 1e-6), x);
      if (tgt.aim > 0) {   // the aim coming up — from rest over its first frames, the carry (or the torch) whole under it until it is most of the way
        if (u.aim > snapA) u.aim = lerp(snapA, u.aim, lerp(clamp(S.in, 0, 1), 1, smoothstep(0, S.ease || 1e-6, snapA)));
        const k = over(u.aim);
        if (u.relaxed < snapR) u.relaxed = lerp(snapR, u.relaxed, k);
        if (u.torch < snapT) u.torch = lerp(snapT, u.torch, k);
      } else if (snapA > 0.003 && (tgt.relaxed > 0 || tgt.torch > 0)) {   // …and let go for a carry: that carry comes back under it first (the quicker for being out of sight), and the aim stays until it has
        const hid = Math.max(0, S.under) * over(snapA);
        const back = tgt.relaxed > 0 ? (u.relaxed = damp(u.relaxed, 1, hid, dt)) : (u.torch = damp(u.torch, 1, hid, dt));   // (the carry he is going back TO: the other one, still fading from before the aim, covers for nothing)
        if (u.aim < snapA) u.aim = lerp(snapA, u.aim, over(back));
      }
    }
    if (this.upperW.relaxed > 0.003) { sampleClip(c.Pistol_Idle_Loop, this.idleT, true, this.pUpper); blendPose(this.pA, this.pUpper, this.upperW.relaxed, this.upperMask, this.pA); }
    const tu = GUNHAND.on && GUNHAND.whistle;   // (gunhand.ts: the torch comes up in the hand that holds it)
    this.tuK = tu ? clamp(this.tuK + (tgt.torch > 0 ? dt : -dt) / 0.4, 0, 1) : 0;
    if (this.upperW.torch > 0.003) { sampleClip(c.Idle_Torch_Loop, this.idleT, true, this.pUpper); blendPose(this.pA, this.pUpper, this.upperW.torch, tu ? this.torsoMask : this.upperMask, this.pA); }   // (with the rule the clip's trunk and head only: of its arms the raised one is the EMPTY one)
    if (this.tuK > 0) this.torchUpLayer(smoothstep(0, 1, this.tuK));
    // ---- deliberate movement / the crouch's centre of gravity (legs, pelvis, torso, arms) — over the finished locomotion and its clip arms, under every stance,
    //      one-shot and aim layer below (they read the feet where this leaves them, and pose the arms over these when they have them)
    if (Dl > 0.002 || pace > 0.002 || soft > 0.002 || armsIn > 0.003 || dsh > 0.002) this.sneakLayer(Dl, pace, soft, armsIn, surge, dsh);
    // ---- MOVES: the recoil's sums bled off, and how each side carries itself — the trained pelvis sunk onto bent knees (here, under the stances and the arms; the
    //      trunk's share goes in beside the long gun's own, mvTrunk)
    const mvG = MOVES.on > 0.5 ? this.mvPre(dt, mv * offWall * (1 - crouchPose), (1 - crouchPose) * offWall * (1 - wKslow)) : MV_NONE;
    // ---- procedural: stance body (pelvis blade, lean, head), then the kick (pelvis + legs), then the pistol carry arms — in that order so the hands are solved
    //      against the chest where it finally is. The wall hold has its own body and arms (wallBody / wallArms), sharing the stance weight by wl.
    if (wSt * (1 - wl) > 0.003) this.stanceBody(wSt * (1 - wl), s, wKstand);
    if (wSt * wl > 0.003) this.wallBody(wSt * wl);
    if (kt >= 0) this.kickBody(kt, wKbody);
    if (wCarry * (1 - wSt * wl) * (1 - wLg) > 0.003) this.carryArms(wCarry * (1 - wSt * wl), kt);   // (× (1 − wLg): skipped outright once a long gun is fully in the hands — the long-gun solve below poses over it either way)
    if (wLg * (1 - wWallArms) > 0.003) {   // the long gun: trunk set to the carriage (all but the aim layer's share: that comes on top of the aim clip's trunk, below; and short of the wall hold's body), then both arms onto the weapon (short of the wall hold's arms)
      if (mvG.live) this.mvTrunk(wLg * (1 - wSt * wl) * (1 - this.upperW.aim), mvG, false);
      this.longBody(wLg * (1 - wSt * wl) * (1 - this.upperW.aim), this.lg.run, this.lg.sprint);
      if (this.upperW.aim < 0.995) this.longArms(wLg * (1 - wWallArms), kt, dt, false, this.upperW.aim <= 0.003);   // (fully on the aim, the pass after the aim clip poses the arms alone)
    }
    if (wWallArms > 0.003) this.wallArms(wWallArms);
    if (wLp > 0.003) this.lockpickLayer(wLp);
    if (wHd > 0.003) this.holdLayer(wHd, dt); else { this.hdKn.x = 0; this.hdKn.v = 0; this.hdCk.x = 0; this.hdCk.v = 0; this.hdLo.x = 0; this.hdLo.v = 0; this.hdKc.x = 0; this.hdKc.v = 0; this.hdHu.x = 0; this.hdHu.v = 0; }   // (a hold that begins finds the blade AT the throat station, whatever the last one ended on)
    if (wHe > 0.003) this.heldLayer(wHe, dt); else { this.heLo.x = 0; this.heLo.v = 0; this.heLk.x = 0; this.heLk.v = 0; this.heKc.x = 0; this.heKc.v = 0; this.heBo.x = 0; this.heBo.v = 0; this.heBc.x = 0; this.heBc.v = 0; this.heHu.x = 0; this.heHu.v = 0; this.heHr[0] = this.heHr[1] = null; }
    // the chest twist the SkeletonInstance applies after this pose (pushed at the end of update()): worked out here already because the door hand — a WORLD spot —
    // has to be posed through its inverse (doorLayer), and the twist pushes below must then use these very numbers
    const y0 = this.aimYawOffset * (1 - wSt * wl * (1 - this.upperW.aim)); const p = this.aimPitch * (this.upperW.aim);   // (back to the wall, the controller's idle chest twist is the hold's to place — flat, the head turned instead — until he actually aims)
    // ---- a hand on the door he is pushing open (doorPush): the free arm only, over the clip arms / the carry it takes the hand from, under the aim clip and the
    //      one-shots that follow (so it stands down as the aim comes up rather than solve an arm the two-hand aim then owns); off under the holds, lock work,
    //      the wall hold and the kick / throw / cross / reload (their hands are spoken for). While it is live and the door is ahead of the hips the aim's chest
    //      twist is let go (dp.tw, ≈ ¼ s either way) — the shoulders square to the wood: an arm only reaches a door in front of the chest, and the controller's aim
    //      can be anywhere, a cursor behind him included — with the neck and head keeping what a neck can of it (±40°) so the eyes stay on the aim
    let y = y0, headKeep = 0;
    { const D = this.doorPush; if (D) this.dp.last = D;
      const gate = (1 - wSt * wl) * (1 - wHd) * (1 - wHe) * (1 - wLp) * (1 - this.upperW.aim) * (kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.reloadT >= 0 ? 0 : 1);
      const intent = D ? clamp(D.w, 0, 1) * gate : 0;
      const square = intent > 0.003 && gate > 0.5 && this.toModelP(D!.p)[2] > 0.1 ? 1 : 0;
      const tw = clamp(this.dp.tw.step(square, square ? 24 : 14, dt), 0, 1);
      y = y0 * (1 - tw * (1 - this.upperW.aim)); headKeep = clamp(y0 - y, -0.7, 0.7);   // (the aim keeps its share as it comes up: a snap shot mid-push has the chest — so the gun, the rail light and the flash — on the round's line, not the door's)
      this.doorLayer(dt, intent, armed, y, -p * 0.35); }
    // ---- hands at work on a thing (work — handwork.ts): the pose fed since the last frame is taken here; while it is live and the thing is ahead of the hips the
    //      aim's chest twist is let go as it is for a door (wk.tw) and the head goes with the chest, onto the thing; the swap's clock is read off `carry` the same way
    //      (a dt-0 call is a RE-BAKE of this frame's pose — a prop or a leaf moved him after his update: it takes nothing, the feeds wait for the next real frame)
    { const K = this.wk, bake = dt <= 0;
      if (!bake) { if (this.work) { K.last = this.work; K.fed = true; K.after = 0; } else if (K.after > 0 && K.last) { K.after -= dt; K.last = { ...K.last, t: Math.max(K.last.t, K.last.dur) + dt }; K.fed = true; } else K.fed = false;
        this.work = null; }
      if (K.last) { const sq = K.fed && wSt * wl < 0.5 && this.toModelP(K.last.p)[2] > 0.1 ? 1 : 0; const tw = clamp(K.tw.step(sq, sq ? 24 : 14, dt), 0, 1);
        if (tw > 0.003) { const yk = y0 * (1 - tw * (1 - this.upperW.aim)); if (Math.abs(yk) < Math.abs(y)) { y = yk; headKeep *= 1 - tw; } } }
      else { K.tw.x = K.tw.v = 0; }
      const S = this.sw, want = bake ? S.cur : this.carry; if (!bake) this.carry = undefined; S.shown = false; S.belt = 0;
      if (bake) { /* as it stood */ }
      else if (want === undefined) { S.cur = undefined; S.t = S.wait = -1; }
      else if (S.cur === undefined) { S.cur = want; S.t = S.wait = -1; }
      else if (want !== S.cur) {
        if (want && S.cur && S.t < 0) { if (S.wait < 0) S.wait = this.swapLag;
          if (S.wait > 0 && this.shootT < 0) S.wait = Math.max(0, S.wait - dt);   // (his own beat before the hand starts: he shows what he had — swapHeld — until it has run)
          else { S.from = S.cur; S.to = want; S.t = 0; S.dur = want === 'weapon' ? SWAP.draw : SWAP.stow; S.cur = want; S.wait = -1; } }
        else { S.t = S.wait = -1; S.cur = want; } }
      else S.wait = -1; }   // (a hand emptied or filled from nothing — the grab, the floor — and a change of mind mid-move are on the frame, as they were)
    if (wHl > 0.003 && (this.haul || !this.holdPose)) this.haulLayer(wHl, y, -p * 0.35);   // both hands on the body he has hold of — after the door hand (he has none to spare: game.ts feeds no door push while he hauls)
    if (this.upperW.aim > 0.003) {
      // pitch: blend aim down/neutral/up (assume ±45° extremes), remainder handled by twist
      const pn = clamp(this.aimPitch / (45 * Math.PI / 180), -1, 1);
      sampleAt0(c.Pistol_Aim_Neutral, this.pUpper);
      if (pn > 0.01) { sampleAt0(c.Pistol_Aim_Up, this.pB); blendPose(this.pUpper, this.pB, pn, null, this.pUpper); }
      else if (pn < -0.01) { sampleAt0(c.Pistol_Aim_Down, this.pB); blendPose(this.pUpper, this.pB, -pn, null, this.pUpper); }
      if (this.shootT >= 0) {
        const w = this.shootT < 0.04 ? this.shootT / 0.04 : clamp(1 - (this.shootT - 0.3) / 0.3, 0, 1);
        if (this.snapShot && Math.abs(pn) > 0.01) {   // MOVES.snap, a shot along a pitched aim: the clip is keyed level, so blended in whole it took the hands UP to the level pose for the length of the shot (at his feet: 47 cm in three frames, and back down after) — its recoil alone, laid on the pitched pose (level, below: the clip itself, to the bit)
          this.pB.copy(this.pAim); sampleClip(c.Pistol_Shoot, this.shootT, false, this.pB); addPoseDelta(this.pUpper, this.pAim, this.pB, w, this.upperMask);   // (pAim: the level aim the clip is keyed from, under the slots it does not key)
        } else { sampleClip(c.Pistol_Shoot, this.shootT, false, this.pB); blendPose(this.pUpper, this.pB, w, null, this.pUpper); }
      }
      if (wLg <= 0) blendPose(this.pA, this.pUpper, this.upperW.aim, this.upperMask, this.pA);
      else {   // the rifleman: the aim clip's trunk and head as ever, its pistol ARMS only by what the long gun has not got of them (nothing, once it is in the hands) —
               // then the carriage's own trunk set and both arms solved onto the weapon afresh against the trunk the clip has just moved (torso + arms masks = upperMask node for node)
        blendPose(this.pA, this.pUpper, this.upperW.aim, this.torsoMask, this.pA);
        blendPose(this.pA, this.pUpper, this.upperW.aim * (1 - wLg), this.armsMask, this.pA);
        const gate = wLg * (1 - wHd) * (1 - wHe) * (1 - wLp);   // (yielding to the holds and lock work as the pass at the carry did by running before them, and to the wall hold: the trunk by its body's share, the arms by its arms')
        if (gate * (1 - wWallArms) > 0.003) { if (mvG.live) this.mvTrunk(gate * (1 - wSt * wl) * this.upperW.aim, mvG, true); this.longBody(gate * (1 - wSt * wl) * this.upperW.aim); this.longArms(gate * (1 - wWallArms), kt, dt, true, true); }
      }
    }
    if (this.shootT >= 0) { this.shootT += dt; if (this.shootT > c.Pistol_Shoot.duration) this.shootT = -1; }   // (the shot's clock runs whether or not the aim clip shows it — the gun hold takes its recoil off it instead)
    if (this.sigT >= 0) { this.signalLayer(this.sigT); this.sigT += dt; if (this.sigT > SIGNAL_DUR[this.sigKind]) this.sigT = -1; }
    if (this.tellT >= 0) {   // the idle tells: skipped (the clock still runs out) under anything that has the arms or the head — a hold either way, lock work, the kick, a throw, the cross, a flinch, a reload, the two-hand aim coming up (CONTACT mid-tell), a signal ordered over it
      if (wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.reloadT >= 0 || this.upperW.aim > 0.003 || this.sigT >= 0 || this.mvBusy || this.mvs.tsT >= 0) this.tellShown = 0; else this.tellLayer(this.tellT);
      this.tellT += dt; if (this.tellT > TELL_DUR[this.tellK]) { this.tellT = -1; this.tellShown = 0; }
    }
    if (this.wk.last || this.sw.t >= 0 || this.rx.left > 0 || this.rx.w.x > 0.003) {   // handwork (handwork.ts): the swap (right arm), the work hands, the radio hand (left) — each stood down, eased, by whatever has the arms
      const taken = wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || wHl > 0.003 || kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.mvHands || this.mvs.tsT >= 0 || wSt * wl > 0.003;
      const rifleUp = this.longGun && this.upperW.aim > 0.3 && !this.stowed;   // (a shouldered long gun keeps both hands — but one let go of for the job: workstow.ts)
      if (this.sw.t >= 0) this.swapLayer(dt, taken, y, -p * 0.35);
      this.workLayer(dt, !taken && !rifleUp, armed && !this.stowed, y, -p * 0.35);
      this.radioLayer(dt, !taken && !rifleUp && this.tellT < 0 && this.shootT < 0 && !this.wk.fed && this.wk.shown < 0.003);
    }
    if (this.creep || this.crW > 0) {   // the close-in mode's carriage: under the ready pose (whose arms win), let go of — eased — by whatever else has the body or the arms
      const busy = wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || kt >= 0 || this.throwT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.tellT >= 0 || this.mvBusy || this.mvs.tsT >= 0 || wSt * wl > 0.003 || this.longGun || wLg > 0.003;
      const want = this.creep && !busy ? 1 : 0;
      this.crW = Math.abs(want - this.crW) < 0.01 ? want : this.crW + (want - this.crW) * Math.min(1, dt * (want ? CREEP.in : CREEP.out));
      const gun = clamp(this.upperW.relaxed + this.upperW.aim + this.upperW.torch + wCarry, 0, 1);   // the right hand has something: that arm is its carry's / its aim's
      if (this.closeK >= 0) { this.clK = this.crW > 0.003 ? this.clK + (clamp(this.closeK, 0, 1) - this.clK) * (1 - Math.exp(-KIT.close.rate * dt)) : clamp(this.closeK, 0, 1); this.clT += dt; }   // (KIT.close: the shown closeness follows the distance; first frame of the mode: taken as dealt)
      if (this.crW > 0.003) this.creepLayer(this.bw ? this.crW * (1 - this.bwRise) : this.crW, 1 - Math.max(clamp(this.upperW.aim, 0, 1), wCarry), 1 - gun, y, -p * 0.35, dt); else this.creepShown = 0;
    }
    if (this.watchAt || this.slipAt || this.wt.w > 0 || this.wt.sw > 0) {   // WATCH: over the locomotion and the creep's carriage (whose own look gives way by this one's share — creepLayer), let go of by whatever else has the body
      const busy = wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || wHl > 0.003 || kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.tellT >= 0 || this.mvBusy || this.bw || this.tk;
      const gunW = clamp(this.upperW.relaxed + this.upperW.aim + this.upperW.torch + wCarry, 0, 1);
      this.watchLayer(dt, busy ? 0 : 1 - clamp(this.upperW.aim, 0, 1), 1 - Math.max(clamp(this.upperW.aim, 0, 1), wCarry), 1 - gunW, y, -p * 0.35);
    } else { this.watchShown.w = 0; this.watchShown.yaw = 0; this.watchShown.slip = 0; this.watchShown.lean = 1; }
    if (this.stealth || this.sp) this.stealthLayer(dt, wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || wHl > 0.003 || kt >= 0 || this.throwT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.tellT >= 0 || this.hitT >= 0 || this.strikeT >= 0 || this.bw !== null || this.tk !== null || this.clutch > 0 || this.bound !== 0 || this.mvBusy || this.mvs.tsT >= 0 || this.mvs.armL > 0 || wSt * wl > 0.003 || wWallArms > 0.003 || this.longGun || wLg > 0.003 || this.kit !== null || !!this.nv?.hand || !!this.act || !!this.wound || !!this.dazzle || this.wk.fed || this.wk.shown > 0.003 || this.dp.wL.x > 0.003 || this.dp.wR.x > 0.003 || this.rx.w.x > 0.003 || this.upperW.relaxed + this.upperW.aim + this.upperW.torch + wCarry > 0.003, crouchPose, crouchPose > 0.001 ? this.crWalk / crouchPose : 0, y, -p * 0.35);   // STEALTH POSES (stealthpose.ts): Sam's hands-empty crouch — over the crouch and the close-in carriage, under the ready tell; out, eased, for anything else that has his arms
    if (this.bw) this.blowLegs(this.bw);   // (a takedown's own move stands him into the man: the lunge's rear foot drawn in, the knees near straight)
    if (this.ready || this.readyW > 0 || this.rcT > 0) {   // the ready pose (Sam in an open hands-on window): over the carries and the aim clip — 'grabGun' takes the support hand OFF a pistol that is up, so the aim does not veto it — under the one-shots below; stood down, eased, by whatever has the arms: a hold either way, lock work, the kick, a throw, the strike itself, a flinch, a reload, a signal, a tell, a MOVES reaction or toss
      const held = wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || kt >= 0 || this.throwT >= 0 || this.hitT >= 0 || this.reloadT >= 0 || this.sigT >= 0 || this.tellT >= 0 || this.mvHands || this.mvs.tsT >= 0;   // (what has the arms, the blow apart)
      const amt = clamp(this.readyAmt, 0, 1), shaped = HOLD.wayShape && this.noKnife && this.ready === 'grab' && !this.grip[1] && amt < 1;   // (READY_BARE.way: fed a part, the weight is whole early and the pose itself goes by the amount)
      this.rdA = this.readyW > 0.003 ? damp(this.rdA, this.ready ? amt : this.rdA, READY_BARE.way.rate, dt) : amt;
      const busy = held || this.strikeT >= 0 || this.bw !== null, want = this.ready && !busy ? (shaped ? smoothstep(0, READY_BARE.way.by, amt) : amt) : 0;   // (readyAmt: 1 unless fed)
      if (this.ready) { this.readyK = this.ready; this.rdAt = this.readyAt; }
      const gIn = this.noKnife && this.readyW > 0 && this.holdPose?.phase === 'grab' && this.readyK === 'grab' ? clamp(this.holdPose.t / HOLD.secs.grab, 0, 1) : -1;   // (READY_BARE.out: the bare-handed way in is let go BY the grab's reach, not dropped under it)
      this.rdOutR = gIn >= 0 && this.holdPose?.strip ? 1 - smoothstep(0, READY_BARE.outR, gIn) : 1;   // (no gun to take: the right hand goes from the reach straight to its station on him, with the left)
      if (gIn >= 0) { const O = HOLD.catchShape && this.holdPose?.variant !== 'gun' ? HOLD.catch.readyOut : READY_BARE.out; this.readyW = Math.min(this.readyW, 1 - smoothstep(O[0], O[1], gIn)); } else   // (HOLD.catch: the hold's own arm has the hand from the first frames)
      this.readyW = Math.abs(want - this.readyW) < 0.01 ? want : this.readyW + (want - this.readyW) * Math.min(1, dt * (want ? 10 : busy ? 8 : HOLD.wayShape && this.noKnife && this.readyK === 'grab' ? READY_BARE.way.drop : 8 / (1 + READY_UP.slow * this.rd[RD.up])));   // (READY_UP: a hand that went up has further to come down when he steps out of reach — 8 unless fed, and 8 when a move takes the arms: the grab's own clocks are what they were)
      // the reach's clock: on with a live pose whose right hand is free for the knife — and kept on THROUGH the knife's own blow (the hand comes back to the hilt it left); off with anything else: a plain blow takes the hand off the hilt empty
      { const on = (want > 0 && READY[this.readyK].knife && !this.noKnife && !this.grip[1]) || (this.strikeT >= 0 && this.strikeLeth && !held && !!this.ready);
        this.rcT = clamp(this.rcT + (on ? dt / REACH.in : -dt / REACH.out), 0, 1); }
      if (this.readyW > 0.003 || this.rcT > 0) this.readyLayer(this.readyW, this.readyK, want > 0, dt, y, -p * 0.35); else { this.readyShown = this.reachShown = 0; this.rdLive = false; if (!this.ready) this.rdAt = null; }
    }
    this.catchFix();
    if (this.kit) {   // KIT: the right hand's errand between what was in it and what will be — over the carries, the aim and the close-in poses; dropped by whatever else takes the arms (a body in both hands among them: hands.ts); NOT by the wall hold — its arms are the pose the errand starts from and ends on
      if (this.holdPose || this.heldPose || this.haul || this.lockpick || kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.mvHands || this.mvs.tsT >= 0 || this.act || this.wound) this.kitCancel();
      else this.kitLayer(dt, y, -p * 0.35);
    } else if (this.kitHold !== undefined) this.kitCancel();
    this.kitGunFree = 0;
    if (this.reloadT >= 0 && GUNHAND.on && GUNHAND.longReload && this.longGun) {   // GUN HAND: a long gun's reload is its carriage's own move (reloadCarry) — the pistol's clip is left out of the pose; its clock runs on as it did, so everything that asks `reloading` hears what it heard
      const d = c.Pistol_Reload.duration; this.reloadT += dt * (d / this.reloadDur); if (this.reloadT > d) this.reloadT = -1;
    } else if (this.reloadT >= 0) {
      sampleClip(c.Pistol_Reload, this.reloadT, false, this.pB);
      const d = c.Pistol_Reload.duration; const w = clamp(Math.min(this.reloadT / 0.12, (d - this.reloadT) / 0.15), 0, 1);
      if (this.rlB.hand && !this.longGun) this.kitGunFree = w;
      blendPose(this.pA, this.pB, w, this.upperMask, this.pA);
      this.reloadT += dt * (d / this.reloadDur); if (this.reloadT > d) this.reloadT = -1;   // retimed to the weapon's beat (reload(dur): 1.6 s for the pistol — what it always was — 2.4 for the SC-20K)
    }
    if (this.throwT >= 0) { this.throwLayer(this.throwT); this.throwT += dt; if (this.throwT > THROW_DUR) { this.throwT = -1; this.thrCarry = this.thrLast = null; } }
    let wStrike = 0, bwTrunk = false;   // (the hand pass: a punch keeps its fists)
    if (this.strikeT >= 0) {
      const sc = this.strikeK === 'jab' ? c.Punch_Jab ?? c.Punch_Cross : c.Punch_Cross;   // (the cross: the clip, the rate and the weights it always had)
      sampleClip(sc, this.strikeT, false, this.pB);
      const d = sc.duration; const w = clamp(Math.min(this.strikeT / 0.05, (d - this.strikeT) / 0.15), 0, 1); wStrike = w;
      blendPose(this.pA, this.pB, this.bw ? w * BLOW.clip[this.bw.style] : w, this.upperMask, this.pA);
      if (this.bw) { this.blowTrunk(this.bw); bwTrunk = true; }   // (the trunk first: the knife's keys hang off the shoulder as it stands)
      if (this.strikeLeth) this.knifeBlow(this.strikeK, dt, d / 1.15, y, -p * 0.35);   // (the knife's blow: the right arm over the clip — nothing of it without the flag)
      this.strikeT += dt * 1.15; if (this.strikeT > d) { this.strikeT = -1; this.strikeK = 'cross'; }
    }
    if (this.strikeLeth && this.strikeT < 0) this.strikeLeth = this.knifeShown = false;   // (its clip over — or cut short: the knife is home)
    if (this.bw) { if (!bwTrunk) this.blowTrunk(this.bw); wStrike = Math.max(wStrike, this.blowArms(this.bw, y, -p * 0.35)); }   // (a takedown's own move: on its own clock, so it may outlast the punch under it)
    if (this.tk) this.takenLayer(this.tk);
    if (this.hitT >= 0) {
      sampleClip(c.Hit_Chest, this.hitT, false, this.pB);
      const w = clamp(1 - Math.abs(this.hitT / c.Hit_Chest.duration - 0.3) / 0.7, 0, 1) * 0.8;
      blendPose(this.pA, this.pB, w, this.upperMask, this.pA);
      this.hitT += dt; if (this.hitT > c.Hit_Chest.duration) this.hitT = -1;
    }
    // ---- THE BIG SLOT'S TOOL (bigTool; BIGMOVE): the hammer or the breaching shotgun in both hands, over every arm pose and one-shot above — the game's own beat,
    //      on the game's clock. Nothing of it for a man whose bigTool is null: not a number read, his pose what it was to the bit
    this.bigAtBack = 0; if (this.bigTool) this.bigLayer(this.bigTool, y, -p * 0.35); else { this.bigK = 0; this.bigUnder = false; }
    // ---- A LEAN round an edge (anim.lean): the trunk rolled about the figure's fore-aft line over spine1‥3, the arms and the gun with it — the bore keeps its
    //      heading and goes across with the head — and the neck and head brought part of the way back so the eyes stay near level
    if (this.lean !== 0 || this.leanSm !== 0) {
      const L = LEAN_POSE, want = clamp(this.lean, -1, 1); this.leanSm += (want - this.leanSm) * Math.min(1, L.rate * dt); if (want === 0 && Math.abs(this.leanSm) < 0.01) this.leanSm = 0;
      const r = this.leanSm * L.deg * DEGR;
      if (r !== 0) { this.turn(this.pA, this.nodes.spine1, qRoll(r * 0.3)); this.turn(this.pA, this.nodes.spine2, qRoll(r * 0.35)); this.turn(this.pA, this.nodes.spine3, qRoll(r * 0.35));
        this.turn(this.pA, this.nodes.neck, qRoll(-r * L.level * 0.5)); this.turn(this.pA, this.nodes.head, qRoll(-r * L.level * 0.5)); }
    }
    // ---- MOVES: the reactions that take the whole upper body WITH the weapon (the trunk turned rigidly under the arms, so the hands stay on the gun): the flinch,
    //      the hit, the stun charge's hunch (+ its forearm over the eyes) — and the support hand's toss
    if (MOVES.on > 0.5) {
      const gate = (1 - wHd) * (1 - wHe) * (1 - wLp) * (1 - wHl) * (1 - wSt * wl) * (1 - wKslow); this.mvs.armL = 0;   // (both hands on a body yield like the lock tools: a reaction turning the trunk would take them off the limbs they hold)
      if (this.mvBusy || this.mvs.tsT >= 0 || this.dazzle || (this.clutch > 0 && foldOn(this.foldToo)) || this.hurt > 0 || this.shaken > 0 || this.mvs.hu.x !== 0 || this.mvs.sk.x !== 0) this.mvPost(dt, gate);
      const n = this.mv2;
      if (this.rlT >= 0 || this.reloadAt >= 0 || this.bound !== 0 || this.clutch > 0 || this.hurt > 0 || n.rw.x !== 0 || n.bd.x !== 0 || n.cl.x !== 0) {
        const pre = (this.armsBuf ??= new Pose(this.pA.numNodes)).copy(this.pA), o = this.mv2Shown; this.mvArms(dt, gate);
        this.armsPre = o.reload > 0 || o.bound > 0 || o.clutch > 0 ? pre : null;
      } else this.armsPre = null;
    } else { this.armsPre = null; if (this.mvLive) this.mvReset(); }
    // kick clock (impact flag is for this one FRAME: a zero-dt re-bake of the pose within it — game.ts after a leaf shoved him, the probes' pose refresh — advances
    // nothing and must not eat an impact the frame's real step raised before its reader got to it; review B7.8)
    if (dt > 0) { this.kickHit = false; if (kt >= 0) { const nt = kt + dt; this.kickHit = kt < KICK_IMPACT && nt >= KICK_IMPACT; this.kickT = nt > KICK_DUR ? -1 : nt; } }
    this.lpT += dt;
    // ---- the whole-body ACTION clip (act — game/civilians.ts: seated at a desk, kneeling at a bin, on the phone), over everything above with its eased weight;
    //      not so much as looked at for a figure that has none and never had (every guard, Sam): their pose is what it was, to the bit
    let wAct = 0;
    if (this.act || this.actW > 0) wAct = this.actLayer(dt);
    if (this.armsPre && wAct > 0) blendPose(this.armsPre, this.pB, wAct, null, this.armsPre);   // (the action clip goes over the pose under the arms too: pB still holds its sample)
    // ---- MOVES: a crouched man's toes stay out of the floor (toesUp): the foot joint alone, the ankle where everything above left it
    if (MOVES.on > 0.5 && crouchPose > 0.003) this.toesUp(crouchPose);
    if (this.wound || this.wdW > 0) { wAct = Math.max(wAct, this.woundLayer(dt)); this.armsPre = null; }   // WOUNDS (game/wounds.ts): a man down and out of the fight — over everything, like an action clip; never looked at for a man who has no wound
    // ---- MOVES: the hand pass (HAND) — last of all, finger and thumb joints only: an empty hand no layer has shaped is a relaxed hand, not the clips' fist. What
    //      holds a gun keeps its grip: the pistol's two hands (the idle / aim clips, the carries built from them), the long gun's, the torch's fist
    if (MOVES.on > 0.5) {
      const gun = Math.max(this.upperW.relaxed, this.upperW.aim, wLg, wCarry * (1 - wSt * wl) * (armed ? 1 : 0));
      this.handsPass(dt, Math.max(wStrike, gun), Math.max(wStrike, gun, this.upperW.torch), Math.max(this.upperW.relaxed, this.upperW.aim, wLg) * (1 - wHd) * (1 - wHe) * (1 - wLp) * (1 - wWallArms) * (1 - wAct) * (this.throwT >= 0 || this.reloadT >= 0 || wStrike > 0 ? 0 : 1) * (this.bigTool && this.bigTool.kind === 'hammer' && bigOff(this.bigTool) ? 0 : 1));   // (… nor a straight trigger finger on a fist that is round the hammer's handle)
      if (this.gripCan && this.grip[1] && this.throwT < 0) this.hand(this.pA, 1, HAND.can.curl, HAND.can.thumb);   // (a can in the fist: fingers round its width)
    }
    // ---- KIT: the goggles flipped by hand (the left arm, over everything: it is asked only of a free hand, and gives the arm up the frame something takes it) or by a nod (the head joint alone, a pitch in his gaze's own upright plane)
    if (this.nv) this.nvLayer(dt, wHd < 0.05 && wHe < 0.05 && wLp < 0.05 && wHl < 0.05 && wLg < 0.05 && wWallArms < 0.05 && wAct <= 0 && wStrike <= 0 && kt < 0 && this.throwT < 0 && this.reloadT < 0 && this.hitT < 0 && this.tellT < 0
      && this.upperW.aim < 0.3 && !this.kit && !this.ready && !this.wound && !this.dazzle && !this.mvBusy && this.mvs.armL <= 0 && this.mvs.tsT < 0 && this.dp.wL.x < 0.05 && !this.wk.fed && this.wk.shown < 0.05);
    // ---- A SMOKE (game/smokebreak.ts): the left hand up to the mouth and down again, asked only of a free hand as the goggles' flip is — never looked at for a figure nobody told to smoke
    if (this.smoke !== null || this.smokeArm > 0) this.smokeLayer(dt, !this.nv && wHd < 0.05 && wHe < 0.05 && wLp < 0.05 && wHl < 0.05 && wLg < 0.05 && wWallArms < 0.05 && wAct <= 0 && wStrike <= 0 && kt < 0 && this.throwT < 0 && this.reloadT < 0 && this.hitT < 0 && this.tellT < 0
      && this.upperW.aim < 0.3 && !this.kit && !this.ready && !this.wound && !this.dazzle && !this.mvBusy && this.mvs.armL <= 0 && this.mvs.tsT < 0 && this.dp.wL.x < 0.05 && !this.wk.fed && this.wk.shown < 0.05);   // (dp.wL: the hand that goes out to a leaf he walks into is the door's; wk: a hand at work on a thing is the work's — handwork.ts)
    const nod = this.nvNod, nodIn = !!this.sp && STEALTHPOSE.nod; this.nvA = nod;   // (a goggle nod: tipped onto the head here — but where the look under a door is drawn the LOOK poses it, after its own look at the gap, which measured the head with the nod on and took it back out: the goggles swung on a still head. STEALTHPOSE.nod off = that, as it was)
    if (nod !== 0 && !nodIn) this.nvTip(this.pA, nod);
    if (this.sp) { this.stealthPicture(dt); const pic = this.sp.picOn ? this.sp.pic : null; if (pic) this.pA.copy(pic); else if (nod !== 0 && nodIn) { this.nvA = this.sp.nodUp ? nodLift(nod) : nod; this.nvTip(this.pA, this.nvA); } }   // (a lift begun in the look ends a lift, though he is out of the look by then. STEALTH POSES: the look under a door — the pose itself, so `bones`, the capsules, his gaze, a ragdoll's seed and what is bolted to him all go down with what is drawn)
    this.pose.copy(this.pA);
    if (this.sw.shown && this.swBuf) blendPose(this.pA, this.swBuf, 1, this.armROnly, this.handPre = this.handBuf ??= new Pose(this.pA.numNodes)); else this.handPre = null;
    if (this.bigUnder && this.bigBuf) this.handPre = this.bigBuf;   // (the hammer in his fists: the bore and the muzzle are read off the WHOLE pose under the layer — where his own gun's hand was before the swing turned his trunk; a gun's line is not read off a fist that swings a sledge, nor carried round by the trunk that swings it. underPose() seeds a falling body from it too. Never with bigTool null)
    // ---- procedural twists ----
    this.twists.length = 0;
    // Gaze stabiliser (head level and steady while the body works under it — the vestibular reflex the clips lack): the crouch and run clips look 34° at the
    // floor and the run swings the head 10° side to side; measured off the finished pose, the neck (40 %) and head (60 %) take GAZE_KEEP of the pitch error
    // toward a per-gait target elevation and damp the yaw wobble against a ½ s reference of itself (slow, meant head turns pass; the bob does not). Out of
    // the way of everything that poses the head on purpose: stances, the holds, the kick / throw / hit one-shots, the aim clip, death.
    { const wantW = (1 - wSt) * (1 - wHd) * (1 - wHe) * (1 - wLp) * (1 - this.upperW.aim) * (1 - wAct) * (kt >= 0 || this.throwT >= 0 || this.hitT >= 0 || this.strikeT >= 0 || this.bw !== null || this.tk !== null || this.reloadT >= 0 || this.rlc.h > 0 || this.tellT >= 0 || this.mvBusy || this.wk.shown > 0.02 || this.rx.w.x > 0.02 || this.bigTool !== null ? 0 : 1);   // (the lockpick's look at the keyway, the reload's glance at the gun and the tells' look at the watch / into the stretch are authored looks: left alone; so is an action clip's seated / kneeling head — and the long gun's own look down at its well, GUN HAND, which runs on the game's beat past the clip's clock)
      this.gz.w = damp(this.gz.w, wantW, 10, dt);
      if (this.gz.w > 0.01) {
        this.fkPart(this.pA, this.fkHead); const fk = this.fk; const g = quat.rotate(fk.rot[nd.head], this.gazeLocal);   // (the head's chain alone: nothing else is read)
        const el = Math.asin(clamp(g[1], -1, 1)) + this.nvA, gyaw = Math.atan2(g[0], g[2]);   // (+ nvA, the nod as posed: a goggle nod is a meant tip of the head — measured without it, or the stabiliser takes most of it back out through the neck)
        // (a man's condition bows his head on purpose — MV2.hurt, MV2.shaken: the eye line this keeps goes down with those looks by what they pose, or with the
        //  gun carried it took four fifths of the bow back out through the neck; at rest both weights are 0 and the target is the gait's own)
        const bow = (MV2.hurt.pitch + MV2.hurt.head) * clamp(this.mvs.hu.x, 0, 1) + (MV2.shaken.pitch + MV2.shaken.head) * clamp(this.mvs.sk.x, 0, 1);
        const targetEl = -(GAZE_EL.stand + (GAZE_EL.crouch - GAZE_EL.stand) * crouchPose + (GAZE_EL.sprint - GAZE_EL.stand) * wSprint * (1 - crouchPose) + bow) * DEGR;
        const wantPitch = clamp((el - targetEl) * GAZE.keep, -30 * DEGR, 30 * DEGR);   // (twist pitch + = chin down: looking too far down, el < target, gives a negative — chin-up — correction)
        this.gz.pitch = damp(this.gz.pitch, wantPitch, 25, dt);
        if (!this.gz.yawInit) { this.gz.yawRef = gyaw; this.gz.yawInit = true; }
        this.gz.yawRef += wrapAngle(gyaw - this.gz.yawRef) * clamp(dt / 0.5, 0, 1);           // ½ s reference: what the head 'means' to look at
        const yawFix = clamp(-wrapAngle(gyaw - this.gz.yawRef) * GAZE.yawDamp, -12 * DEGR, 12 * DEGR);
        const w = this.gz.w;
        this.twists.push({ node: nd.neck, yaw: yawFix * 0.4 * w, pitch: this.gz.pitch * 0.4 * w });
        this.twists.push({ node: nd.head, yaw: yawFix * 0.6 * w, pitch: this.gz.pitch * 0.6 * w });
      } else { this.gz.yawInit = false; this.gz.pitch = damp(this.gz.pitch, 0, 10, dt); }
    }
    const look = this.turnLead !== 0 ? this.lookYawExtra + headKeep + this.turnLead : this.lookYawExtra + headKeep;   // (turnLead: his eyes go to a new point ahead of his gun — TURN, 0 with it off; y / p: the chest twist, worked out above the door hand — doorLayer inverts exactly these; headKeep: the share of it the door hand took off the chest, kept on the neck)
    this.twists.push({ node: nd.spine1, yaw: y * 0.25, pitch: 0 });
    this.twists.push({ node: nd.spine2, yaw: y * 0.35, pitch: 0 });
    this.twists.push({ node: nd.spine3, yaw: y * 0.40, pitch: -p * 0.35 });
    if (Math.abs(look) > 1e-3) { this.twists.push({ node: nd.neck, yaw: look * 0.4, pitch: 0 }); this.twists.push({ node: nd.head, yaw: look * 0.6, pitch: 0 }); }
    if (this.lookPitchExtra !== 0) { this.twists.push({ node: nd.neck, yaw: 0, pitch: this.lookPitchExtra * 0.4 }); this.twists.push({ node: nd.head, yaw: 0, pitch: this.lookPitchExtra * 0.6 }); }
    if (this.nv || this.smoke !== null) {   // (KIT.nv, and a smoke: what turns the head after the layers, kept for the hand's reach next frame)
      const w = this.nvTw; w[0] = w[1] = w[2] = w[3] = 0;
      for (const t of this.twists) { if (t.node === nd.neck) { w[0] += t.yaw; w[1] += t.pitch; } else if (t.node === nd.head) { w[2] += t.yaw; w[3] += t.pitch; } }
    }
  }

  /** The whole-body action clip over the finished pA (see `act`): the clip resolved by name once per name (an unknown name plays nothing), its clock run at its
   *  rate, the weight eased toward 1 while one is set and back to 0 over `out` once it is cleared (the last clip and its loop flag kept for that fade), blended in
   *  over every node with a smoothstep of the weight. Returns the weight it used (0 = the pose untouched). pB is free scratch here: every layer that borrows it has run. */
  private actLoop = true;
  private actLayer(dt: number): number {
    const a = this.act;
    if (a) { if (a.clip !== this.actName) { this.actName = a.clip; this.actClip = this.ch.clips.get(a.clip) ?? null; this.actT = 0; } this.actOut = a.out ?? 0.35; this.actLoop = a.loop !== false; }
    const target = a && this.actClip ? 1 : 0;
    const secs = target ? Math.max(0.02, a!.in ?? 0.3) : Math.max(0.02, this.actOut);
    this.actW = target ? Math.min(1, this.actW + dt / secs) : Math.max(0, this.actW - dt / secs);
    if (this.actW <= 0) { if (!a) { this.actName = ''; this.actClip = null; this.actT = 0; } return 0; }
    const clip = this.actClip; if (!clip) return 0;
    this.actT += dt * (a?.rate ?? 1);
    this.pB.copy(this.rest); sampleClip(clip, this.actT, this.actLoop, this.pB);
    const x = this.actW; const w = x * x * (3 - 2 * x);
    blendPose(this.pA, this.pB, w, null, this.pA);
    if (this.slump > 0 || this.slumpW > 0) {   // (doze.ts: a man asleep in his chair)
      const ds = this.slump - this.slumpW; this.slumpW += ds > 0 ? Math.min(ds, dt / 1.6) : Math.max(ds, -dt / 0.35);
      const s = this.slumpW * w; if (s > 1e-4) { const nd = this.nodes, br = Math.sin(this.actT * 1.75);
        this.fk.run(this.pA); this.turn(this.pA, nd.spine3, qPitch((10 + 1.5 * br) * DEGR * s)); this.turn(this.pA, nd.neck, qPitch(17 * DEGR * s)); this.turn(this.pA, nd.head, quat.mul(qPitch((25 + br) * DEGR * s), qRoll(8 * DEGR * s))); }
    }
    return w;
  }
  /** The wounded man's pose over the finished pA (see `wound`): the clip's own way down at its rate, then a slow breath back and forth across the hold window
   *  (never on to the clip's end), blended over every node; once he is most of the way down the support hand goes to the wound and — on his back — his head comes
   *  up off the floor to look at it. Returns the weight it used. pB is free scratch here, as for the action clip. */
  private woundLayer(dt: number): number {
    const wd = this.wound; if (!wd) { this.wdW = 0; this.wdT = 0; this.wdClip = null; this.wdPose = ''; return 0; }
    const K = WOUND_POSE[wd.pose];
    if (this.wdPose !== wd.pose) { this.wdPose = wd.pose; this.wdClip = this.ch.clips.get(K.clip) ?? null; this.wdT = wd.settled ? Math.max(K.hold[0] / K.rate, wd.clock ?? K.hold[0] / K.rate + 1) : 0; if (wd.settled) this.wdW = 1; }
    const clip = this.wdClip; if (!clip) return 0;
    this.wdT += dt; this.wdW = Math.min(1, this.wdW + dt / K.in);
    const t = this.wdT * K.rate, tt = t < K.hold[0] ? t : lerp(K.hold[0], K.hold[1], 0.5 - 0.5 * Math.cos((t - K.hold[0]) / K.rate * K.breath));
    this.pB.copy(this.rest); sampleClip(clip, tt, false, this.pB);
    const x = this.wdW, w = x * x * (3 - 2 * x), nd = this.nodes;
    blendPose(this.pA, this.pB, w, null, this.pA);
    const down = smoothstep(K.hold[0] * 0.5, K.hold[0], t) * w;
    if (down > 0.003) {
      if (K.head !== 0) { this.fk.run(this.pA); this.turn(this.pA, nd.neck, qPitch(K.head * 0.45 * DEGR * down)); this.turn(this.pA, nd.head, qPitch(K.head * 0.55 * DEGR * down)); }
      this.woundLimbs(down, wd);
    }
    return w;
  }
  /** the limbs the clip does not pose as a hurt man's: the support hand pressed to the wound — the ribs under the gun arm (WOUND_AT) or the top of the
   *  near thigh — and, on his back, that leg's knee drawn up off the floor and the gun hand in on his belly instead of flung out behind his head */
  private woundLimbs(w: number, wd: { pose: 'knee' | 'back'; at: 'ribs' | 'thigh' }) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    pB.copy(pA); fk.run(pB);
    if (wd.pose === 'back') {
      const h = fk.pos[nd.thighL], f = fk.pos[nd.footL];
      twoBoneIK(fk, pB, nd.thighL, nd.shinL, nd.footL, [h[0] + (f[0] - h[0]) * 0.56, f[1] + 0.02, h[2] + (f[2] - h[2]) * 0.56], [0, 1, 0], 1, null);
    }
    const F = this.trunkFrame(), tk = (o: Vec3, x: number, y: number, z: number): Vec3 => v3.mad(v3.mad(v3.mad(o, F.left, x), F.up, y), F.fwd, z);
    const p = wd.at === 'ribs' ? tk(fk.pos[nd.spine1], WOUND_AT[0], WOUND_AT[1], WOUND_AT[2]) : v3.mad(v3.mad(v3.lerp(fk.pos[nd.thighL], fk.pos[nd.shinL], wd.pose === 'back' ? 0.5 : 0.42), F.fwd, 0.085), F.left, 0.02);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, [0.6, -0.7, -0.3], 0.7, this.handRot(0, v3.mad(v3.scale(F.left, -1), F.up, -0.25), v3.mad(F.fwd, F.up, 0.2)));
    this.hand(pB, 0, [0.3, 0.34, 0.38, 0.42], 0.3, 0.2);
    if (wd.pose === 'back') {
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tk(fk.pos[nd.spine1], -0.07, -0.04, 0.13), v3.mad(v3.scale(F.left, -1), F.up, -0.6), 0.8, this.handRot(1, v3.mad(F.left, F.up, -0.2), F.fwd));
      this.hand(pB, 1, [0.25, 0.3, 0.34, 0.38], 0.25, 0.2);
    }
    blendPose(pA, pB, w, null, pA);
  }
  /** seconds into the action clip now playing (0 with none) — the probes, and a caller timing a one-shot such as 'Interact' */
  get actTime(): number { return this.actClip ? this.actT : 0; }

  // ================================================================ MOVES (the loud demo's motion pass — see MOVES / MV)
  private mvOut: MvGait = { live: false, g: 0, u: 0, st: 0 };
  private get mvLive() { const m = this.mvs; return m.flT >= 0 || m.stT >= 0 || m.htT >= 0 || m.tsT >= 0 || m.dz.x !== 0 || m.dz.v !== 0 || m.cf.x !== 0 || m.hu.x !== 0 || m.sk.x !== 0 || m.back + m.climb + Math.abs(m.yaw) + m.rock + m.sho + m.head > 0 || m.glide.x !== 0 || this.rlT >= 0 || this.mv2.rw.x !== 0 || this.mv2.bd.x !== 0 || this.mv2.cl.x !== 0 || this.mv2.dip.x !== 0; }
  private mvReset() { const m = this.mvs; m.back = m.climb = m.yaw = m.rock = m.sho = m.head = 0; m.flT = m.stT = m.htT = m.tsT = -1; m.dz.x = m.dz.v = 0; m.dzT = 0; m.cf.x = m.cf.v = 0; m.cfT = 0; m.hu.x = m.hu.v = 0; m.huT = 0; m.sk.x = m.sk.v = 0; m.glide.x = m.glide.v = 0; m.hipY = NaN; const n = this.mv2, o = this.mv2Shown; this.rlT = -1; n.rw.x = n.rw.v = n.bd.x = n.bd.v = n.cl.x = n.cl.v = n.dip.x = n.dip.v = 0; o.reload = o.bound = o.clutch = o.dip = 0; this.sightsLift = 0; }
  /** Before the stances and the arms: bleed the recoil's sums off (each at its own rate, by training), and the pelvis's share of how a side carries itself — a
   *  trained man with a long gun sinks onto bent knees when he moves (and a little when he stands on the gun) and most of the walk's bob is taken out, the feet
   *  IK'd back exactly where the cycle has them (the sneak layer's way: pole weight 0, so at no drop this is the identity). `moveW` = moving, upright, off the wall;
   *  `standW` = upright, off the wall. Returns what the trunk layer (mvTrunk) needs. */
  private mvPre(dt: number, moveW: number, standW: number): MvGait {
    const m = this.mvs, o = this.mvOut, R = MV.recoil, T = clamp(this.trained, 0, 1), k = (p: readonly [number, number]) => lerp(p[0], p[1], T);
    const sum = m.back + m.climb + Math.abs(m.yaw) + m.rock + m.sho + m.head;
    if (sum > 0) {
      if (sum < 1e-4) m.back = m.climb = m.yaw = m.rock = m.sho = m.head = 0;
      else { const eb = Math.exp(-dt / k(R.backTau)), ec = Math.exp(-dt / k(R.climbTau)), er = Math.exp(-dt / k(R.rockTau)); m.back *= eb; m.climb *= ec; m.yaw *= ec; m.rock *= er; m.sho *= er; m.head *= er; }
    }
    { const dp = this.mv2.dip, want = mvOn('entry') && this.longGun ? clamp(this.dip, 0, 1) : 0;   // MOVES.entry: the muzzle down past a friend's back, and up again the moment he is clear of it
      if (want > 0 || dp.x !== 0) { dp.step(want, want > dp.x ? MV2.dip.rateIn : MV2.dip.rateOut, dt); if (want === 0 && dp.x < 0.01) dp.x = dp.v = 0; }
      this.mv2Shown.dip = clamp(dp.x, 0, 1); this.sightsLift = 0; }   // (longArms writes this frame's lift when it dips the bore)
    o.g = o.u = o.st = 0;
    if (mvOn('gait')) {
      const lgw = clamp(this.lg.w.x, 0, 1), tw = smoothstep(0.5, 1, this.trained), Gt = MV.gait;
      o.g = clamp(m.glide.step(tw * moveW * lgw, 9, dt), 0, 1); o.u = (1 - smoothstep(0, 0.5, this.trained)) * lgw * standW; o.st = tw * lgw * standW;
      const drop = Gt.drop * o.g + Gt.aimDrop * o.st * this.upperW.aim * (1 - o.g);
      if (drop > 2e-4 || o.g > 0.003) {
        const pA = this.pA, nd = this.nodes, fk = this.fk; this.fkPart(pA, this.fkLegs);   // (hips + legs: what this and mvHips read)
        const hy = fk.pos[nd.hips][1]; m.hipY = Number.isFinite(m.hipY) ? m.hipY + (hy - m.hipY) * (1 - Math.exp(-dt / 0.35)) : hy;
        const flat = clamp((m.hipY - hy) * Gt.bob * o.g, -0.03, 0.03);
        this.mvHips([0, flat - drop, 0]);
      } else m.hipY = NaN;
    }
    o.live = o.g > 0.003 || o.u > 0.003 || o.st > 0.003 || m.rock > 1e-4 || m.sho > 1e-4;
    return o;
  }
  /** The trunk's share, straight into pA right before the long gun's own trunk set (longBody) on each of its two passes — so the arms are then solved onto the
   *  weapon against the trunk where this leaves it and the bore stays where the carriage puts it. The carry pass: the trained lean into the walk (hips first, the
   *  head levelled back out), the untrained shoulders swinging and rocking with the stride. The aim pass: the trained man further over his gun, the untrained one
   *  stood back off it with his head up. Both: the recoil — the gun shoulder driven back and the chest rocked, the head jarred. */
  private mvTrunk(w: number, o: MvGait, aimPass: boolean) {
    if (w < 0.003) return;
    const pA = this.pA, nd = this.nodes, m = this.mvs, Gt = MV.gait;
    let lean = 0, chin = 0, sway = 0, roll = 0;
    if (aimPass) { lean = Gt.aimLean * o.st + Gt.lean * 0.5 * o.g - Gt.back * o.u; chin = Gt.chin * o.u; }
    else { lean = Gt.lean * o.g; const ph = 2 * Math.PI * this.phase, mw = smoothstep(0.2, 0.8, Math.abs(this.speed)); sway = Gt.slouchSway * o.u * mw * Math.sin(ph); roll = Gt.slouchRoll * o.u * mw * Math.cos(ph); }
    lean *= DEGR * w; chin *= DEGR * w; sway *= DEGR * w; roll *= DEGR * w;
    if (Math.abs(lean) > 1e-5) {
      this.turn(pA, nd.spine1, qPitch(lean * 0.45)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.2));
      this.turn(pA, nd.neck, qPitch(-lean * 0.4)); this.turn(pA, nd.head, qPitch(-lean * 0.6));
    }
    if (Math.abs(sway) + Math.abs(roll) > 1e-5) {
      const q = (kk: number) => quat.mul(qYaw(sway * kk), qRoll(roll * kk));
      this.turn(pA, nd.spine2, q(0.45)); this.turn(pA, nd.spine3, q(0.55)); this.turn(pA, nd.neck, qYaw(-sway * 0.4)); this.turn(pA, nd.head, qYaw(-sway * 0.4));
    }
    if (chin > 1e-5) { this.turn(pA, nd.neck, qPitch(-chin * 0.4)); this.turn(pA, nd.head, qPitch(-chin * 0.6)); }
    if (mvOn('recoil') && (m.rock > 1e-4 || m.sho > 1e-4)) {
      const q = (kk: number) => quat.mul(qYaw(-m.sho * DEGR * w * kk), qPitch(-m.rock * DEGR * w * kk));
      this.turn(pA, nd.spine2, q(0.4)); this.turn(pA, nd.spine3, q(0.6));
      const hq = (kk: number) => quat.mul(qYaw(m.sho * 0.6 * DEGR * w * kk), qPitch((m.rock * 0.6 - m.head) * DEGR * w * kk));   // the head keeps most of its line, and is jarred back off the stock
      this.turn(pA, nd.neck, hq(0.4)); this.turn(pA, nd.head, hq(0.6));
    }
  }
  /** MOVES, the second pass — arms the fight does not read, AFTER every other layer, and only by what the first pass's own arm work leaves (`mvs.armL`: a blinded
   *  man's forearm over his eyes and a toss have the support arm whole — the toss is posed on the arm exactly as it was without this pass, so the hand a can leaves
   *  is where it always was) and a hand signal leaves. Neither the trunk, the head nor a rifleman's trigger hand is touched: the muzzle, the bore, the eyes and the
   *  hit columns come out bit for bit as they went in. `gate`: what the holds, lock work, the wall hold and the kick leave of the body. */
  private mvArms(dt: number, gate: number) {
    const n = this.mv2, o = this.mv2Shown, m = this.mvs;
    const free = gate * (1 - m.armL) * (this.sigT >= 0 ? 1 - smoothstep(0, 0.08, this.sigT) : 1), busy = this.sigT >= 0 || this.tellT >= 0 || m.tsT >= 0;
    // ---- the long gun's magazine change: the support hand to the well, the empty stripped, a fresh one fetched and seated, the handle run, back to the fore-end
    { let live = false;
      if (this.reloadAt >= 0 && this.reloadRow) { if (this.rlSrc !== this.reloadRow) { this.rlBeat(this.reloadRow); this.rlSrc = this.reloadRow; } n.rlAt = this.reloadAt; this.rlT = -1; live = true; }
      else if (this.rlT >= 0) { n.rlAt = this.rlT; live = true; this.rlT += dt; if (this.rlT > this.rlB.dur) this.rlT = -1; }
      const pist = this.rlB.hand && !this.longGun && this.reloadT >= 0;   // (KIT: a pistol's change the game handed a `hand` beat — the support hand works it over the reload clip's raised gun, for as long as that clip runs)
      const want = live && (pist || (mvOn('reload') && this.longGun && (this.reloadMag || (this.feed !== null && feedLive())))) && !busy && this.throwT < 0 && this.strikeT < 0 && !this.bigTool ? 1 : 0;   // (stopped short — cancelled, the gun re-dealt, a throw: the arm eases back from where the hand was)
      if (want > 0 || n.rw.x !== 0) { n.rw.step(want, MV2.reload.rate, dt); if (want === 0 && n.rw.x < 0.01) n.rw.x = n.rw.v = 0; }
      const D = this.rlB.dur, w = bump(n.rlAt, 0, 0.1, D - 0.24, D - 0.02) * clamp(n.rw.x, 0, 1) * free * (pist ? 1 : smoothstep(0.3, 0.9, clamp(this.lg.w.x, 0, 1)));
      o.reload = w > 0.003 ? w : 0; if (o.reload > 0) { if (pist) this.pistolReloadArm(n.rlAt, w); else this.reloadArm(n.rlAt, w); } }
    // ---- a man knocked about and still up: the support hand off the gun and pressed to his ribs
    { const rest = this.hurt > 0 ? clamp(this.hurt, 0, 1) * MV2.hurt.arm * (1 - smoothstep(0.1, 0.5, this.upperW.aim)) * (this.throwT < 0 && this.strikeT < 0 && !this.bigTool ? 1 : 0) : 0;   // (hurt: the hand goes back to his ribs whenever the gun is out of his shoulder and the hand has no other work)
      const want = mvOn('clutch') && o.reload === 0 && !busy ? clamp(Math.max(this.clutch, rest), 0, 1) : 0;
      if (want > 0 || n.cl.x !== 0) { n.cl.step(want, MV2.clutch.rate, dt); if (want === 0 && n.cl.x < 0.01) n.cl.x = n.cl.v = 0; }
      o.clutch = clamp(n.cl.x, 0, 1) * free; if (o.clutch > 0.003) this.clutchArm(o.clutch); else o.clutch = 0; }
    // ---- kept down: a hostage's wrists behind her back, hands on the head for somebody told to stay where he is (nothing in the hands: both arms)
    { const on = mvOn('bound') && this.bound !== 0 && !this.longGun, want = on && (n.bd.x < 0.02 || n.bdK === this.bound) ? 1 : 0;   // (one pose to the other: down first, then up into it)
      if (on && n.bd.x < 0.02) n.bdK = this.bound as 1 | 2;
      if (want > 0 || n.bd.x !== 0) { n.bd.step(want, MV2.bound.rate, dt); if (want === 0 && !on && n.bd.x < 0.01) n.bd.x = n.bd.v = 0; }
      o.bound = clamp(n.bd.x, 0, 1) * free; if (o.bound > 0.003) this.boundArms(o.bound, n.bdK); else o.bound = 0; }
  }
  /** the trunk's own frame off the joints of `fk` (current): across the shoulders to his left, up the spine, out of the chest */
  private trunkFrame(): { left: Vec3; up: Vec3; fwd: Vec3 } {
    const nd = this.nodes, fk = this.fk;
    const up = v3.normalize(v3.sub(fk.pos[nd.spine3], fk.pos[nd.hips])); let left = v3.sub(fk.pos[nd.upperArmL], fk.pos[nd.upperArmR]); left = v3.normalize(v3.mad(left, up, -v3.dot(left, up)));
    return { left, up, fwd: v3.cross(left, up) };
  }
  /** the support arm from the upper arm down (the collar bone stays the clip's), or both arms */
  private armMask(both: boolean): Float32Array {
    if (!this.mv2Mask) { const nd = this.nodes, mk = (roots: number[]) => { const a = new Float32Array(this.dynMask.length); const set = (i: number) => { a[i] = 1; for (const c of this.ch.nodes[i].children) set(c); }; roots.forEach(set); return a; };
      this.mv2Mask = [mk([nd.upperArmL]), mk([nd.upperArmL, nd.upperArmR])]; }
    return this.mv2Mask[both ? 1 : 0];
  }
  private reloadArm(t: number, w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, B = this.rlB, R = MV2.reload, T = clamp(this.trained, 0, 1);
    const own = this.feed ? feedPath(this.feed, B, this.feedN, this.feedPort) : null;   // (a gun fed its own way — gunreload.ts: the hand's stations, or a magazine gun's own marks; null with that switch off)
    const K = own && 'marks' in own ? own.marks ?? R.box : this.reloadBack ? R.back : R.box;
    pB.copy(pA); fk.run(pB);
    // the gun's frame where the trigger hand has it NOW (the clip's raised gun, the carriage it comes back down to): the support hand works on the weapon as drawn
    const pR = fk.pos[nd.handR], d = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR));
    let yW = v3.mad(AY, d, -d[1]); yW = v3.len(yW) > 1e-4 ? v3.normalize(yW) : [0, 0, -1]; const xW = v3.cross(yW, d);
    const dir = (p: readonly number[]): Vec3 => [xW[0] * p[0] + yW[0] * p[1] + d[0] * p[2], xW[1] * p[0] + yW[1] * p[1] + d[1] * p[2], xW[2] * p[0] + yW[2] * p[1] + d[2] * p[2]];
    const at = (p: readonly number[]): Vec3 => v3.add(pR, dir(p));
    const cur = v3.copy(fk.pos[nd.handL]), rot0 = [...fk.rot[nd.handL]] as Quat;
    const F = this.trunkFrame(), tk = (o: Vec3, p: Vec3): Vec3 => v3.mad(v3.mad(v3.mad(o, F.left, p[0]), F.up, p[1]), F.fwd, p[2]);
    // GUN HAND: the clip squared the shoulders over the belt, so "off the pelvis, trunk frame" was the belt's own frame; the carriage that now stays through a
    // long gun's change blades them (36° at the shoulder), which would carry the hip's pouches round with the chest — those points go by the hips' own line
    let hk = (p: Vec3): Vec3 => tk(fk.pos[nd.hips], p);
    if (GUNHAND.on && GUNHAND.longReload && this.longGun) { const l = v3.sub(fk.pos[nd.thighL], fk.pos[nd.thighR]), hl = v3.normalize(v3.mad(l, F.up, -v3.dot(l, F.up))), hf = v3.cross(hl, F.up), H = fk.pos[nd.hips];
      hk = p => v3.mad(v3.mad(v3.mad(H, hl, p[0]), F.up, p[1]), hf, p[2]); }
    const pouch = T > 0.5 ? tk(fk.pos[nd.spine2], R.pouch[1]) : hk(R.pouch[0]);
    if (own && 'keys' in own) { this.feedArm(t, w, own.keys, at, dir, pouch, F, cur, rot0); return; }
    const o = B.out, i = B.in_, r = B.rack, D = B.dur, h = (o + i) * 0.5;
    const mag = at(K.mag), strip = at(K.strip), hd = at(K.handle), pl = at(K.pull);
    // the empty comes straight down out of the well and is let go there (`strip`: a hand's width under it — dropped, not thrown); the fresh one comes up from under.
    // An untrained man's lands on the lip beside the well (`hit`), is backed off, then found; seated, he slaps it home; and the handle let go, the hand flies on back.
    const wob = R.fumble * (1 - T), fum = wob > 0.004, hp = fum ? h - 0.1 : h, lw = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const FL = R.flare, slap = fum && B.pull && r - i >= 0.4, fl = fum ? (1 - T) * Math.max(bump(t, i - 0.36, i - 0.22, i - 0.09, i + 0.02), slap ? bump(t, i + 0.07, i + 0.15, i + 0.19, i + 0.27) : 0) : 0;
    const hit = v3.mad(v3.mad(v3.mad(mag, yW, -0.035), xW, wob * 1.2), d, wob * 1.6), off = fum ? tk(lw(hit, strip, 0.65), v3.scale(FL.off, 1 - T)) : hit, tapP = slap ? tk(v3.mad(mag, yW, -R.tap * (1 - T)), v3.scale(FL.tap, 1 - T)) : mag;
    const over = v3.mad(v3.mad(pl, d, -(R.fling + 0.1 * (1 - T))), xW, 0.04 + 0.05 * (1 - T));
    const kp = B.keep, fr = B.fresh, dump = kp >= 0 ? hk(KIT.mag.dump) : pouch;   // (KIT: a magazine with rounds in it goes to the dump pouch on the hip before the hand goes for a fresh one)
    const p = curve3(t, [[0, cur], [Math.max(0.1, o - 0.2), mag], [o, mag], [o + 0.12, strip], ...(kp >= 0 ? [[(o + 0.05 + kp) * 0.5, hk(KIT.mag.via)], [kp - 0.07, dump], [kp + 0.05, dump], [fr, pouch], [fr + 0.1, pouch]] : [[hp, pouch], [hp + 0.12, pouch]]) as [number, Vec3][],
      ...(fum ? [[Math.max(hp + 0.13, i - 0.3), hit], [i - 0.14, off]] : [[i - 0.16, strip]]) as [number, Vec3][], [i, mag], [i + 0.08, mag],   // (the max: rlBeat's floor in_ − out ≥ 0.6 alone leaves the lip key 0.02 s before the pouch's; the shipped rows have a second between them and never reach it)
      ...(B.pull ? [...(fum && r - i >= 0.4 ? [[i + 0.17, tapP], [i + 0.25, mag]] : []), [r - 0.1, hd], [r, hd], [r + 0.08, pl], [r + 0.17, over]] : [[i + 0.42, cur]]) as [number, Vec3][], [D - 0.03, cur]]);
    // the hand: round the magazine from its front (fingers across it, palm toward him), fingers down into the pouch, hooked on the handle
    const mf = dir([-1, 0.15, 0.1]), mb = dir([0.1, -0.35, 1]), pf: Vec3 = v3.mad(v3.mad(v3.scale(F.up, -0.9), F.left, -0.3), F.fwd, 0.1), pb: Vec3 = v3.mad(F.fwd, F.left, 0.3), hf = dir(K.hf), hb = dir(K.hb);
    const hq = kp >= 0 ? kp - 0.07 : hp, hr = kp >= 0 ? fr + 0.1 : hp + 0.12;   // (the hand is down at the pouches from the first of them to the last)
    const f = curve3(t, [[Math.max(0.1, o - 0.2), mf], [o + 0.12, mf], [hq, pf], [hr, pf], [i - 0.24, mf], [i + 0.08, mf], ...(B.pull ? [[r - 0.1, hf], [r + 0.16, hf]] as [number, Vec3][] : [])]);
    const b = curve3(t, [[Math.max(0.1, o - 0.2), mb], [o + 0.12, mb], [hq, pb], [hr, pb], [i - 0.24, mb], [i + 0.08, mb], ...(B.pull ? [[r - 0.1, hb], [r + 0.16, hb]] as [number, Vec3][] : [])]);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, fl > 0 ? lw(R.pole, FL.pole, fl) : R.pole, R.poleW, this.handRot(0, f, b));
    const grip = kp >= 0 ? Math.max(bump(t, o - 0.12, o - 0.02, kp - 0.02, kp + 0.06), bump(t, fr, fr + 0.08, i + 0.04, i + 0.12)) : bump(t, o - 0.12, o - 0.02, i + 0.04, i + 0.12), hook = B.pull ? bump(t, r - 0.14, r - 0.04, r + 0.14, r + 0.22) : 0, c = (k: number) => lerp(0.3, k, Math.max(grip, hook));
    this.hand(pB, 0, [c(0.62), c(0.68), c(0.72), c(0.78)], lerp(0.3, 0.6, grip), 0.1 * (1 - grip));
    const wr = bump(t, 0, 0.12, D - 0.26, D - 0.05); if (wr < 0.999) { fk.run(pB); setModelRot(pB, nd.handL, quat.slerp(rot0, fk.rot[nd.handL], wr), fk.parentRot(pB, nd.handL)); }
    blendPose(pA, pB, w, this.armMask(false), pA);
  }
  /** A GUN FED ITS OWN WAY (gunreload.ts feedPath: a belt gun's cover, box and tray; a tube gun's shells, a trip each): the support hand through `keys` — a wrist
   *  station each, in the gun's frame as reloadArm has it (`at`, `dir`), or at the pouch — and back to where it was. The same solve, mask and ease as the
   *  magazine change; the trigger hand, the gun and the body are not touched. */
  private feedArm(t: number, w: number, keys: readonly FeedKey[], at: (p: readonly number[]) => Vec3, dir: (p: readonly number[]) => Vec3, pouch: Vec3, F: { left: Vec3; up: Vec3; fwd: Vec3 }, cur: Vec3, rot0: Quat) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, R = MV2.reload, D = this.rlB.dur, n = keys.length;
    if (n < 2) return;
    // the hand: round a thing from its front (fingers across it, palm toward him) · flat on top of the gun (fingers across it, the back of the hand up) · fingers down into the pouch
    const fs = { mag: dir([-1, 0.15, 0.1]), top: dir([-1, 0, 0.15]), pouch: v3.mad(v3.mad(v3.scale(F.up, -0.9), F.left, -0.3), F.fwd, 0.1) }, bs = { mag: dir([0.1, -0.35, 1]), top: dir([0.1, 1, 0.1]), pouch: v3.mad(F.fwd, F.left, 0.3) };
    const P: [number, Vec3][] = [[0, cur]], Fk: [number, Vec3][] = [], Bk: [number, Vec3][] = [];
    for (const k of keys) { P.push([k.t, k.at === 'pouch' ? pouch : at(k.at)]); Fk.push([k.t, fs[k.how]]); Bk.push([k.t, bs[k.how]]); }
    const end = keys[n - 1].t; if (end + 0.1 < D - 0.3) P.push([D - 0.3, P[P.length - 1][1]]); P.push([Math.max(D - 0.03, end + 0.02), cur]);   // (the hand rests where its last work was until the weapon is nearly done, then back to the gun)
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, curve3(t, P), R.pole, R.poleW, this.handRot(0, curve3(t, Fk), curve3(t, Bk)));
    let g = t <= keys[0].t ? keys[0].grip * smoothstep(keys[0].t - 0.12, keys[0].t, t) : keys[n - 1].grip * (1 - smoothstep(end, end + 0.12, t));
    for (let i = 0; i + 1 < n; i++) if (t > keys[i].t && t <= keys[i + 1].t) { g = lerp(keys[i].grip, keys[i + 1].grip, (t - keys[i].t) / (keys[i + 1].t - keys[i].t)); break; }
    const c = (k: number) => lerp(0.3, k, g);
    this.hand(pB, 0, [c(0.62), c(0.68), c(0.72), c(0.78)], lerp(0.3, 0.6, g), 0.1 * (1 - g));
    const wr = bump(t, 0, 0.12, D - 0.26, D - 0.05); if (wr < 0.999) { fk.run(pB); setModelRot(pB, nd.handL, quat.slerp(rot0, fk.rot[nd.handL], wr), fk.parentRot(pB, nd.handL)); }
    blendPose(pA, pB, w, this.armMask(false), pA);
  }
  /** KIT: a PISTOL's magazine change, the support hand's (KIT.mag), over the reload clip's pose in pA — the trigger hand, the gun and the body stay the clip's.
   *  An EMPTY gun: the hand comes to the butt as the magazine drops free, goes straight to the belt for a fresh one, seats it with the heel of the palm and comes
   *  over the top to run the slide. A magazine with rounds left (`keep`): the hand takes it out of the gun, puts it away at the hip, then the fresh one — and with
   *  a round still chambered the slide is left alone. Keys on the weapon's own beat (rlB: out / keep / in_ / rack). */
  private pistolReloadArm(t: number, w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, B = this.rlB, M = KIT.mag;
    pB.copy(pA); fk.run(pB);
    const pR = fk.pos[nd.handR], d = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR));
    let yW = v3.mad(AY, d, -d[1]); yW = v3.len(yW) > 1e-4 ? v3.normalize(yW) : [0, 0, -1]; const xW = v3.cross(yW, d);
    const dir = (q: readonly number[]): Vec3 => [xW[0] * q[0] + yW[0] * q[1] + d[0] * q[2], xW[1] * q[0] + yW[1] * q[1] + d[1] * q[2], xW[2] * q[0] + yW[2] * q[1] + d[2] * q[2]];
    const at = (q: readonly number[]): Vec3 => v3.add(pR, dir(q));
    const cur = v3.copy(fk.pos[nd.handL]), rot0 = [...fk.rot[nd.handL]] as Quat;
    const F = this.trunkFrame(), tk = (o: Vec3, q: Vec3): Vec3 => v3.mad(v3.mad(v3.mad(o, F.left, q[0]), F.up, q[1]), F.fwd, q[2]);
    const pouch = tk(fk.pos[nd.hips], M.pouch), dump = tk(fk.pos[nd.hips], M.dump);
    const o = B.out, i = B.in_, r = B.rack, D = B.dur, kp = B.keep, fr = B.fresh;
    const well = at(M.well), strip = at(M.strip), sl = at(M.slide), pl = at(M.pull), seat = v3.mad(well, yW, 0.012);   // (seated: the heel of the palm drives it the last centimetre)
    const p = curve3(t, [[0, cur], [Math.max(0.08, o - 0.14), well], [o, well], [o + 0.1, strip],
      ...(kp >= 0 ? [[(o + 0.04 + kp) * 0.5, tk(fk.pos[nd.hips], M.via)], [kp - 0.06, dump], [kp + 0.05, dump]] : []) as [number, Vec3][], [fr, pouch], [fr + 0.09, pouch], [i - 0.13, strip], [i, seat], [i + 0.07, well],
      ...(B.pull ? [[r - 0.09, sl], [r, sl], [r + 0.07, pl], [r + 0.15, v3.mad(pl, yW, 0.03)]] : [[i + 0.3, cur]]) as [number, Vec3][], [D - 0.03, cur]]);
    const wf = dir(M.wf), wb = dir(M.wb), sf = dir(M.sf), sb = dir(M.sb), pf: Vec3 = v3.mad(v3.mad(v3.scale(F.up, -0.9), F.left, -0.25), F.fwd, 0.15), pb: Vec3 = v3.mad(F.fwd, F.left, 0.4);
    const hq = kp >= 0 ? kp - 0.06 : fr, hr = fr + 0.09;
    const f = curve3(t, [[Math.max(0.08, o - 0.14), wf], [o + 0.1, wf], [hq, pf], [hr, pf], [i - 0.2, wf], [i + 0.07, wf], ...(B.pull ? [[r - 0.09, sf], [r + 0.14, sf]] as [number, Vec3][] : [])]);
    const b = curve3(t, [[Math.max(0.08, o - 0.14), wb], [o + 0.1, wb], [hq, pb], [hr, pb], [i - 0.2, wb], [i + 0.07, wb], ...(B.pull ? [[r - 0.09, sb], [r + 0.14, sb]] as [number, Vec3][] : [])]);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, M.pole, M.poleW, this.handRot(0, f, b));
    const grip = Math.max(kp >= 0 ? bump(t, o - 0.08, o, kp - 0.02, kp + 0.06) : 0, bump(t, fr, fr + 0.08, i - 0.02, i + 0.06)), pinch = B.pull ? bump(t, r - 0.1, r - 0.02, r + 0.08, r + 0.16) : 0, c = (k: number) => lerp(0.25, k, Math.max(grip, pinch));
    this.hand(pB, 0, [c(0.6), c(0.66), c(0.7), c(0.76)], lerp(0.3, 0.65, Math.max(grip, pinch)), 0.1 * (1 - grip));
    const wr = bump(t, 0, 0.1, D - 0.22, D - 0.05); if (wr < 0.999) { fk.run(pB); setModelRot(pB, nd.handL, quat.slerp(rot0, fk.rot[nd.handL], wr), fk.parentRot(pB, nd.handL)); }
    blendPose(pA, pB, w, this.armMask(false), pA);
  }
  private clutchArm(w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, C = MV2.clutch;
    pB.copy(pA); fk.run(pB);
    const F = this.trunkFrame(), p = v3.mad(v3.mad(v3.mad(fk.pos[nd.spine1], F.left, C.at[0]), F.up, C.at[1]), F.fwd, C.at[2]);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, C.pole, 0.7, this.handRot(0, v3.mad(v3.scale(F.left, -1), F.up, -0.25), v3.mad(F.fwd, F.up, 0.2)));
    this.hand(pB, 0, [0.3, 0.34, 0.38, 0.42], 0.3, 0.2);
    blendPose(pA, pB, w, this.armMask(false), pA);
  }
  private boundArms(w: number, kind: 1 | 2) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, K = MV2.bound;
    pB.copy(pA); fk.run(pB);
    const F = this.trunkFrame(), tk = (o: Vec3, x: number, y: number, z: number): Vec3 => v3.mad(v3.mad(v3.mad(o, F.left, x), F.up, y), F.fwd, z);
    const tv = (x: number, y: number, z: number): Vec3 => tk([0, 0, 0], x, y, z);
    if (kind === 1) {   // wrists crossed in the small of the back, palms out, elbows back and a little out
      const B = K.back, o = fk.pos[nd.hips];
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tk(o, -B.out * 0.4, B.up, -B.behind), tv(0.8, 0.1, -0.6), 0.8, this.handRot(0, tv(-0.75, -0.6, -0.1), tv(0, 0, 1)));
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tk(o, B.out * 0.4, B.up + 0.02, -B.behind - 0.02), tv(-0.8, 0.1, -0.6), 0.8, this.handRot(1, tv(0.75, -0.6, -0.1), tv(0, 0, 1)));
      this.hand(pB, 0, B.curl, B.thumb); this.hand(pB, 1, B.curl, B.thumb);   // a loose half fist each: open, the two hands fanned out either side of the wrists like claws
    } else {            // fingers laced on the crown, elbows wide
      // (in the HEAD's own frame — up its crown, forward along its gaze — not the trunk's: kept down, the head is bowed, and hands placed off the trunk's forward
      //  came to the temples with the forearms across the face. The wrists stand behind the ears, the open hands lie on the back of the skull with the fingers
      //  toward each other, the elbows out to the sides and a little back.)
      const H = K.head, hr = fk.rot[nd.head], hu = quat.rotate(hr, AY); let hf = quat.rotate(hr, this.gazeLocal); hf = v3.normalize(v3.mad(hf, hu, -v3.dot(hf, hu))); const hl = v3.cross(hu, hf);
      const o = v3.mad(v3.mad(fk.pos[nd.head], hu, H.up), hf, -H.behind), hk = (x: number, y: number, z: number): Vec3 => v3.mad(v3.mad(v3.scale(hl, x), hu, y), hf, z);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.mad(o, hl, H.out), tv(1, -0.15, H.elbow), 0.9, this.handRot(0, hk(-0.84, 0.5, 0.04), hk(0.2, 0.75, -0.6)));
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.mad(o, hl, -H.out), tv(-1, -0.15, H.elbow), 0.9, this.handRot(1, hk(0.84, 0.5, 0.04), hk(-0.2, 0.75, -0.6)));
      this.hand(pB, 0, H.curl, H.thumb, 0.25); this.hand(pB, 1, H.curl, H.thumb, 0.25);   // open hands, the fingers a little apart: laced, not fists…
      for (const sd of [0, 1]) for (const f of this.fingers[sd]) pB.setRot(f[0], quat.normalize(quat.mul(pB.rot(f[0]), quat.axisAngle(AX, H.knuckle[sd] * DEGR))));   // …and bent down at the knuckles onto the crown (`knuckle`° per SIDE, left then right — the right palm already lies lower on the skull, and at the left's angle its fingertips sank in: the palm rests on the back of the skull, and straight off it the fingers stood clear of the head like sticks)
    }
    blendPose(pA, pB, w, this.armMask(true), pA);
  }
  /** After every other layer: the reactions that move the whole upper body with the weapon in it. The flinch, the hit and the stun charge's hunch add up into one
   *  trunk rotation (spread up the spine, the arms and the gun carried rigidly: the hands do not part) and one shove of the pelvis with the feet IK'd back where
   *  they stood; the head takes its own share on top. Then the arms that leave the gun: the blinded man's support forearm across his eyes, and the toss. `gate`:
   *  what the holds, lock work, the wall hold and the kick leave of the body. */
  /** the pelvis moved by `d` (model space) with both feet held where the pose under it has them (fk must be current for pA — its legs at least: fkLegs) */
  private mvHips(d: Vec3) {
    const pA = this.pA, nd = this.nodes, fk = this.fk;
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    this.shift(pA, nd.hips, d); this.fkPart(pA, this.fkLegs);
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true);
  }
  private mvPost(dt: number, gate: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, m = this.mvs, T = clamp(this.trained, 0, 1), k = (p: readonly [number, number]) => lerp(p[0], p[1], T);
    let pitch = 0, yaw = 0, roll = 0, hp = 0, hy = 0, drop = 0, sx = 0, sz = 0;
    if (m.flT >= 0) {
      m.flK += (m.flKTo - m.flK) * Math.min(1, dt * 12);
      const F = MV.flinch, D = k(F.dur), e = curve(m.flT / D, MV_FLINCH_ENV) * k(F.amp) * m.flK * gate;
      const sd = m.flD[0] >= 0 ? 1 : -1, lat = Math.min(1, Math.abs(m.flD[0]) * 1.6);
      pitch += F.pitch * e * (0.65 + 0.35 * Math.max(0, m.flD[2])); yaw -= sd * F.away * e * lat; roll += sd * 3 * e * lat;
      hp += F.head * e; hy -= sd * F.away * e * lat; drop += F.drop * e; sx -= m.flD[0] * F.side * e; sz -= m.flD[2] * F.side * e;
      m.flT += dt; if (m.flT > D) m.flT = -1;
    }
    let stw = 0, stn = 1;   // the start's arms: how far they are flung out this frame, and the side the thing is on (below, after the trunk)
    if (m.stT >= 0) {
      const S = MV_STARTLE, D = k(S.dur), lw = clamp(this.lg.w.x, 0, 1), d = m.stD;
      const e = curve(m.stT / D, S.env) * lerp(k(S.amp), Math.max(k(S.amp), S.gunAmp), lw) * gate;   // (both hands on a long gun: the trunk has to say all of it, so a trained man's is not halved away)
      const bh = clamp(-d[2], 0, 1), sd = d[0] >= 0 ? 1 : -1, lat = bh > 0 ? 1 : Math.min(1, Math.abs(d[0]) * 1.6);   // (a thing behind him: he comes ROUND to it — a turn, not a shove in the back)
      pitch -= S.rear * (1 + S.gunRear * lw) * e * d[2] * (d[2] < 0 ? S.behindPitch : 1); yaw += sd * S.turn * (1 + S.behindTurn * bh) * e * lat; roll -= sd * S.lean * e * lat;   // (reared back off a thing in front, pitched a little on away from one behind; turned and tipped toward the side it is on)
      hp -= S.head * e * Math.max(0.3, d[2]); hy += sd * S.headTurn * (1 + S.behindHead * bh) * e * lat; drop += S.drop * e; sx -= d[0] * S.back * (1 + S.gunBack * lw) * e; sz -= d[2] * S.back * (1 + S.gunBack * lw) * e;
      stw = e; stn = sd; m.stT += dt; if (m.stT > D) m.stT = -1;   // (the curve never goes under zero: his head is his eye, and a start that ended leaning in toward the thing saw round a jamb the man standing straight does not)
    }
    if (m.htT >= 0) {
      const H = MV.hit, d = m.htD, e = curve(m.htT, MV_HIT_ENV) * gate;
      const fz = d[2] <= 0 ? 1 : -1, tp = d[2] * H.pitch * e, ty = m.htSide * fz * H.yaw * e * (0.4 + 0.6 * Math.abs(d[2]));
      pitch += tp; yaw += ty; roll += (m.htSide * fz * H.roll * Math.abs(d[2]) - d[0] * H.roll * 2) * e;
      hp -= tp * 0.5; hy -= ty * 0.5; drop += H.drop * Math.abs(e); sx += d[0] * H.shove * e; sz += d[2] * H.shove * e;
      m.htT += dt; if (m.htT > H.dur) m.htT = -1;
    }
    const Z = MV.dazzle, dzT = this.dazzle && mvOn('dazzle') ? clamp(this.dazzle.k, 0, 1) : 0;
    if (this.dazzle) m.dzD = this.flatModel(v3.sub(this.dazzle.from, this.posIn), m.dzD);
    m.dz.step(dzT, dzT > m.dz.x ? Z.rateIn : Z.rateOut, dt); if (dzT === 0 && m.dz.x < 0.02) { m.dz.x = 0; m.dz.v = 0; }
    const dzw = clamp(m.dz.x, 0, 1) * k(Z.amp) * gate;
    if (m.dz.x <= 0) m.dzSd = 0; else if (m.dzSd === 0) m.dzSd = m.dzD[0] >= 0 ? 1 : -1;   // (the side he turns away to is chosen once, as it goes off: he sweeps while blind, and a live sign flipped the whole pose as the charge crossed dead ahead)
    let gunP: Vec3 | null = null, gunR: Quat | null = null;
    if (dzw > 0.003) {
      m.dzT += dt; const sd = m.dzSd || 1;
      pitch += Z.hunch * dzw; yaw -= sd * Z.away * dzw; roll += sd * Z.roll * dzw; hp += Z.head * dzw; hy -= sd * Z.headAway * dzw; drop += Z.drop * dzw;
      sx += (-m.dzD[0] * Z.back + Z.swayX * Math.sin(m.dzT * 3.1)) * dzw; sz += (-m.dzD[2] * Z.back + Z.swayZ * Math.sin(m.dzT * 2.3 + 1)) * dzw;
    } else m.dzT = 0;
    // the clutch's fold (MOVES.fold): knocked about and still on his feet, he stays doubled over the hurt and sways for as long as the game roots him — the hit's own
    // rock is gone in half a second, and a man upright again with a hand at his belt read as a low ready
    // (under the blinded hunch the fold gives way by the hunch's own weight — the two never add to more than one fold)
    let cfw = 0;
    { const Fd = MV2.clutch.fold, want = this.clutch > 0 && foldOn(this.foldToo) ? clamp(this.clutch, 0, 1) * (1 - clamp(dzw, 0, 1)) : 0;
      if (want > 0 || m.cf.x !== 0) { m.cf.step(want, Fd.rate, dt); if (want === 0 && m.cf.x < 0.01) m.cf.x = m.cf.v = 0; }
      const cf = clamp(m.cf.x, 0, 1) * gate; cfw = cf;
      if (cf > 0.003) { m.cfT += dt; const s = Math.sin(m.cfT * 2 * Math.PI * Fd.hz); pitch += (this.foldToo ? Fd.pitchToo : Fd.pitch) * cf; roll += Fd.sway * s * cf; hp += Fd.head * cf; drop += Fd.drop * cf; sx += 0.012 * s * cf; } else m.cfT = 0; }
    // A MAN'S CONDITION (condition.ts deals `hurt` and `shaken`: both 0 with its switch off, and then neither block does anything). Under the fold and the
    // blinded hunch both give way by those weights — never two folds added.
    //   HURT: he keeps a hunch over the side he favours and sways a little standing; on the move every stride onto that side is short and heavy — the pelvis
    //   dips and goes across, the trunk rolls and turns into it, the head drops. With the gun in his shoulder he braces: most of the trunk's hunch comes out (the lean stays: it is about
    //   the bore).
    { const H = MV2.hurt, want = clamp(this.hurt, 0, 1), under = (1 - clamp(dzw, 0, 1)) * (1 - cfw);
      if (want > 0 || m.hu.x !== 0) { m.hu.step(want, H.rate, dt); if (want === 0 && m.hu.x < 0.01) m.hu.x = m.hu.v = 0; }
      const hu = clamp(m.hu.x, 0, 1) * gate * under;
      if (hu > 0.003) {
        const sd = this.hurtSide, aimW = clamp(this.upperW.aim, 0, 1), brace = 1 - H.brace * aimW, mw = smoothstep(0.15, 0.7, Math.abs(this.speed));
        const st = Math.max(0, -sd * Math.sin(2 * Math.PI * this.phase)), step = st * st * mw;   // (0‥1 once a cycle: the stride onto the side he favours — the walk plants his right foot on the sine's positive half)
        m.huT += dt; const br = Math.sin(m.huT * 2 * Math.PI * H.hz) * (1 - mw);
        pitch += (H.pitch + H.stepPitch * step) * brace * hu; roll -= sd * (H.lean + H.stepRoll * step + H.sway * br) * hu; yaw += sd * H.stepYaw * step * brace * hu;
        hp += (H.head * (1 - H.headBrace * aimW) + H.stepHead * step) * hu; drop += (H.drop + H.stepDrop * step) * hu; sx += sd * H.stepSide * step * hu;
      } else m.huT = 0;
      //   SHAKEN: the head comes down between the shoulders and he sinks a little, for as long as the fire is on him
      const K = MV2.shaken, wantK = clamp(this.shaken, 0, 1);
      if (wantK > 0 || m.sk.x !== 0) { m.sk.step(wantK, wantK > m.sk.x ? K.rateIn : K.rateOut, dt); if (wantK === 0 && m.sk.x < 0.01) m.sk.x = m.sk.v = 0; }
      const sk = clamp(m.sk.x, 0, 1) * gate * under;
      if (sk > 0.003) { pitch += K.pitch * (1 - K.brace * clamp(this.upperW.aim, 0, 1)) * sk; hp += K.head * sk; drop += K.drop * sk; } }
    const ts = m.tsT, R = m.tsRel, TD = R + TOSS_AFTER;
    if (ts >= 0) {   // the toss's body English: the left shoulder goes back with the hand, then through with it; a dip of the knees under the swing
      const wind = curve(ts, [[0, 0], [R * 0.8, 1], [R + 0.03, 0.2], [R + 0.2, -1], [R + 0.4, -0.6], [TD, 0]]) * gate;
      yaw += 9 * wind; pitch += 5 * Math.max(0, -wind) + 2 * Math.max(0, wind); drop += 0.02 * Math.abs(wind);
    }
    if (drop > 2e-4 || Math.abs(sx) + Math.abs(sz) > 2e-4) { fk.run(pA); this.mvHips([sx, -drop, sz]); }
    // a blinded man's GUN stays on the line it had (the trigger hand holds it out at the door while the rest of him turns away): the defenders' blind burst flies
    // along the drawn bore (nightbreach.ts blindTurn), and a hunch that carried the rifle down with the trunk took the burst away from them
    if (dzw > 0.003 && this.lg.w.x > 0.02) { fk.run(pA); gunP = v3.copy(fk.pos[nd.handR]); gunR = [...fk.rot[nd.handR]] as Quat; }
    if (Math.abs(pitch) + Math.abs(yaw) + Math.abs(roll) > 1e-3) {
      const q = (ky: number, kp: number) => quat.mul(qYaw(yaw * DEGR * ky), quat.mul(qRoll(roll * DEGR * ky), qPitch(pitch * DEGR * kp)));
      this.turn(pA, nd.spine1, q(0.3, 0.4)); this.turn(pA, nd.spine2, q(0.35, 0.35)); this.turn(pA, nd.spine3, q(0.35, 0.25));
    }
    if (Math.abs(hp) + Math.abs(hy) > 1e-3) {
      const q = (kk: number) => quat.mul(qYaw(hy * DEGR * kk), qPitch(hp * DEGR * kk));
      this.turn(pA, nd.neck, q(0.4)); this.turn(pA, nd.head, q(0.6));
    }
    if (stw > 0.003) {   // the start's arms: shoulders up (a long gun's too: its hands are put back on it below), elbows wide and forearms half raised by what a long gun leaves of them — the arm on the thing's side thrown up more, the far one out less
      const S = MV_STARTLE, a = stw * (1 - clamp(this.lg.w.x, 0, 1));
      for (const [sh, up, fo, sg] of [[nd.shoulderL, nd.upperArmL, nd.forearmL, 1], [nd.shoulderR, nd.upperArmR, nd.forearmR, -1]] as const) {
        const far = sg * stn < 0 ? 1 : 0;
        this.turn(pA, sh, qRoll(sg * S.shrug * DEGR * stw));
        if (a > 0.003) { this.turn(pA, up, qRoll(sg * S.wide[far] * DEGR * a)); this.turn(pA, fo, qPitch(-S.raise[far] * DEGR * a)); }
      }
    }
    const setSub = (mk: Float32Array, i: number, wv: number) => { mk[i] = wv; for (const c of this.ch.nodes[i].children) setSub(mk, c, wv); };
    if (gunP && gunR) {
      pB.copy(pA); fk.run(pB); twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, gunP, [-0.3, -1, -0.4], 0.6, gunR);
      const mk = this.dynMask; mk.fill(0); setSub(mk, nd.upperArmR, smoothstep(0.003, 0.15, dzw) * smoothstep(0.02, 0.6, this.lg.w.x)); blendPose(pA, pB, 1, mk, pA);   // (… by how much of a long gun he has up: the hold eases in with it)
    }
    if (dzw > 0.003) {   // blinded: the support hand leaves the fore-end and goes flat over the eyes — wrist by the near eye, fingers across to the far one, palm in
      pB.copy(pA); this.turn(pB, nd.shoulderL, qRoll(9 * DEGR)); fk.run(pB);
      const hr = fk.rot[nd.head], gz = quat.rotate(hr, this.gazeLocal), up = quat.rotate(hr, AY), left = v3.cross(up, gz);
      const eyes = v3.mad(v3.mad(fk.pos[nd.head], up, 0.1), gz, 0.08);
      const at = v3.mad(v3.mad(v3.mad(eyes, gz, Z.handOut), left, 0.04), up, 0.006 * Math.sin(m.dzT * 4.3) - Z.handDrop);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, at, Z.handPole, 0.85, this.handRot(0, v3.mad(v3.scale(left, -1), up, Z.handTilt), v3.mad(gz, up, Z.handRoll)));
      this.hand(pB, 0, [0.22, 0.28, 0.34, 0.4], 0.3, 0.3);
      const wz = smoothstep(0.08, 0.6, dzw), mk = this.dynMask; mk.fill(0); setSub(mk, nd.shoulderL, wz); blendPose(pA, pB, 1, mk, pA); m.armL = Math.max(m.armL, wz);
    }
    if (ts >= 0) {   // the toss: the support hand off the gun, down beside the hip, through and up, back to the gun (shoulder-relative path; its ends are the live hand)
      pB.copy(pA); fk.run(pB);
      const sh = v3.copy(fk.pos[nd.upperArmL]), cur = v3.sub(fk.pos[nd.handL], sh), rot0 = [...fk.rot[nd.handL]] as Quat;
      const wk = clamp(R / 0.3, 0.5, 1), back = v3.lerp(cur, [0.07, -0.47, -0.1], wk);   // (a quick release winds up less)
      const mid = v3.lerp(cur, back, 0.5); mid[0] += 0.08 * wk; mid[2] += 0.06 * wk;   // (on the way down the hand swings OUT round the pouches on his front, not through them)
      const off = curve3(ts, [[0, cur], [R * 0.36, mid], [R * 0.72, back], [R, [0.04, -0.43, 0.15]], [R + 0.1, [-0.02, -0.2, 0.45]], [R + 0.22, [-0.04, 0.0, 0.5]], [R + 0.4, [-0.03, -0.05, 0.46]], [TD, cur]]);
      const fing = curve3(ts, [[0, [0, -0.7, 0.7]], [R * 0.72, [0, -1, 0.1]], [R, [0, -0.8, 0.6]], [R + 0.1, [0, -0.15, 1]], [R + 0.22, [-0.05, 0.3, 1]], [TD, [0, -0.2, 1]]]);
      const bk = curve3(ts, [[0, [0.5, -0.6, -0.5]], [R, [0.3, -0.5, -0.8]], [R + 0.12, [0.25, -1, -0.2]], [TD, [0.3, -1, 0]]]);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(sh, off), [0.7, -0.45, -0.55], 0.8, this.handRot(0, fing, bk));
      const open = smoothstep(R - 0.02, R + 0.04, ts), recup = smoothstep(R + 0.35, TD, ts), c = (grip: number, flat: number, cup: number) => lerp(lerp(grip, flat, open), cup, recup);
      this.hand(pB, 0, [c(0.6, 0.05, 0.5), c(0.65, 0.08, 0.55), c(0.7, 0.1, 0.6), c(0.78, 0.14, 0.68)], c(0.7, 0.1, 0.35), 0.25 * open * (1 - recup));
      const wA = bump(ts, 0, 0.05, TD - 0.2, TD) * gate, mk = this.dynMask; m.armL = Math.max(m.armL, bump(ts, 0, 0.05, TD - 0.2, TD)); mk.fill(0); setSub(mk, nd.shoulderL, wA); mk[nd.shoulderL] = 0;
      // the wrist's rotation eases from / back to the grip it had on the gun at the ends (the path does the same for its position)
      const wr = bump(ts, 0, 0.08, TD - 0.22, TD - 0.04); if (wr < 0.999) { fk.run(pB); setModelRot(pB, nd.handL, quat.slerp(rot0, fk.rot[nd.handL], wr), fk.parentRot(pB, nd.handL)); }
      blendPose(pA, pB, 1, mk, pA);
      m.tsT += dt; if (m.tsT > TD) m.tsT = -1;
    }
  }

  // ================================================================ procedural layers
  // Conventions (see skeleton.ts): everything is posed in the un-twisted model space of the local pose (+Z the figure's front, +X its left, +Y up); the aim /
  // look twists are applied afterwards by the SkeletonInstance and turn these layers with the chest like they turn the clips. Body offsets are added straight
  // into pA scaled by the layer weight (a rotation × w is still a rotation); limbs that must reach a point are IK-solved on a copy and blended in through a mask.

  /** fk.run() for a FEW nodes: `list` (fkList: the wanted joints and every ancestor of theirs, in the skeleton's own parent-first order) gets PoseFK.run's arithmetic, operand
   *  for operand, so those nodes hold exactly the numbers a full run would give them; the rest of fk is left as the last run had it. For a layer that reads only those joints
   *  before its next full run — twoBoneIK counts: on entry it reads its three joints and the upper one's rotation, then runs the whole skeleton itself. */
  private fkPart(pose: Pose, list: Int32Array) {
    const d = pose.data, nodes = this.ch.nodes, rot = this.fk.rot, pos = this.fk.pos;
    for (let k = 0; k < list.length; k++) {
      const i = list[k]; const par = nodes[i].parent; const o = i * 10; const q = rot[i], p = pos[i];
      const rx = d[o + 3], ry = d[o + 4], rz = d[o + 5], rw = d[o + 6];
      if (par < 0) { q[0] = rx; q[1] = ry; q[2] = rz; q[3] = rw; p[0] = d[o]; p[1] = d[o + 1]; p[2] = d[o + 2]; continue; }
      const pr = rot[par], pp = pos[par];
      const qx = pr[0], qy = pr[1], qz = pr[2], qw = pr[3]; const v0 = d[o], v1 = d[o + 1], v2 = d[o + 2];
      const tx = 2 * (qy * v2 - qz * v1), ty = 2 * (qz * v0 - qx * v2), tz = 2 * (qx * v1 - qy * v0);
      const t0 = v0 + qw * tx + (qy * tz - qz * ty), t1 = v1 + qw * ty + (qz * tx - qx * tz), t2 = v2 + qw * tz + (qx * ty - qy * tx);
      q[0] = qw * rx + qx * rw + qy * rz - qz * ry; q[1] = qw * ry - qx * rz + qy * rw + qz * rx; q[2] = qw * rz + qx * ry - qy * rx + qz * rw; q[3] = qw * rw - qx * rx - qy * ry - qz * rz;
      p[0] = pp[0] + t0; p[1] = pp[1] + t1; p[2] = pp[2] + t2;
    }
  }
  /** the nodes fkPart must compute for `ends` to come out current: each of them and all its ancestors, parents first (ch.order's order) */
  private fkList(ends: number[]): Int32Array {
    const nodes = this.ch.nodes; const want = new Uint8Array(nodes.length);
    for (const e of ends) for (let i = e; i >= 0; i = nodes[i].parent) want[i] = 1;
    return Int32Array.from(this.ch.order.filter(i => want[i]));
  }
  /** fkPart lists: the hips and both legs down to the toes (the layers that read the feet and solve the legs), the chest joint with both arms down to the wrists and the gun
   *  hand's knuckle (the carries, the long gun), the head (the gaze) */
  private fkLegs!: Int32Array; private fkArms!: Int32Array; private fkHead!: Int32Array;
  /** turn node i (and its subtree) about model axes, in place */
  private turn(pose: Pose, i: number, q: Quat) { rotateModel(pose, i, q, this.fk.parentRot(pose, i)); }
  /** shift node i's origin by a model-space offset (the hips: its parent 'root' is the Z-up armature frame) */
  private shift(pose: Pose, i: number, off: Vec3) { const l = quat.rotate(quat.conj(this.fk.parentRot(pose, i)), off); const p = pose.pos(i); pose.setPos(i, [p[0] + l[0], p[1] + l[1], p[2] + l[2]]); }
  /** curl the four fingers (0 straight … 1 fist) and set the thumb (0 alongside … 1 folded over the fist) of one hand, from the rest (straight) hand */
  private hand(pose: Pose, side: 0 | 1, curl: readonly number[], thumb: number, spread = 0) {
    const J = [72, 92, 62];   // full-fist flexion per knuckle (°)
    this.fingers[side].forEach((f, fi) => f.forEach((node, j) => {
      let q = quat.axisAngle(AX, curl[fi] * J[j] * DEGR);
      if (j === 0 && spread) q = quat.mul(quat.axisAngle(AZ, (fi - 1.2) * spread * (side ? 1 : -1) * 9 * DEGR), q);   // fan about the knuckle's palm-normal axis
      pose.setRot(node, quat.normalize(quat.mul(this.rest.rot(node), q)));
    }));
    const th = this.thumbs[side], TJ = [30, 25, 45];   // thumb: swings across under the fingers joint by joint
    th.forEach((node, j) => pose.setRot(node, quat.normalize(quat.mul(this.rest.rot(node), quat.axisAngle(AX, thumb * TJ[j] * DEGR)))));
    if (MOVES.on > 0.5 && !this.hn.quiet) {   // the hand pass's note: a layer has set this hand — how far its shape stands from where the locomotion left each digit (the nearest of the frame's)
      const H = this.hn, ns = H.nodes[side], b = H.base[side], nt = H.note[side], d = pose.data;
      for (let g = 0; g < 5; g++) { const k = g * 3; nt[g] = Math.min(nt[g], (qAng(d, ns[k] * 10 + 3, b, k * 4) + qAng(d, ns[k + 1] * 10 + 3, b, k * 4 + 4) + qAng(d, ns[k + 2] * 10 + 3, b, k * 4 + 8)) / 3); }
    }
  }
  /** MOVES, crouched (weight `w` = the crouch shown): the crouch clip kneels on the ball of the rear foot — heel up, the foot bone straight down — while that
   *  ankle stands at its standing height, so the toe went 8 cm UNDER the floor (the shoe sunk to the laces, its shadow proxy below the ground line; in the game as
   *  it was too). The ankle is where the simulation has it (bones.foot — reach, footfalls) and is not moved: the FOOT JOINT alone is turned about the ankle until
   *  the toe is back on the floor, laid away from the knee along the shin's own heading (the kneeling foot stretched back, instep down) unless the foot already
   *  points somewhere along the ground. A toe at or above the floor is not touched; nothing but the foot joint's rotation (and so the toe under it) changes. */
  private toesUp(w: number) {
    const nd = this.nodes, fk = this.fk.run(this.pA);
    for (const [shin, foot, toe] of [[nd.shinL, nd.footL, nd.toeL], [nd.shinR, nd.footR, nd.toeR]] as const) {
      const a = fk.pos[foot], t = fk.pos[toe]; if (t[1] >= TOE_FLOOR_Y - 1e-4) continue;
      const d = v3.sub(t, a), L = v3.len(d), dy = TOE_FLOOR_Y - a[1]; if (L < 1e-4 || Math.abs(dy) >= L) continue;   // (an ankle further off the floor than the foot is long: nothing a turn can do)
      const k = fk.pos[shin]; let hx = d[0] / L, hz = d[2] / L; const bx = a[0] - k[0], bz = a[2] - k[2], bl = Math.hypot(bx, bz);
      if (bl > 1e-4) { const own = Math.hypot(hx, hz), kb = 0.35 * (1 - own) * (1 - own); hx += bx / bl * kb; hz += bz / bl * kb; }   // (a foot already lying along the ground keeps its own heading: only one standing on end is laid back off the shin)
      const hl = Math.hypot(hx, hz); if (hl < 1e-4) continue;
      const r = Math.sqrt(L * L - dy * dy), to: Vec3 = [hx / hl * r, dy, hz / hl * r];
      const q = quat.slerp([0, 0, 0, 1], quat.fromTo(v3.scale(d, 1 / L), v3.scale(to, 1 / L)), clamp(w, 0, 1));
      this.pA.setRot(foot, quat.normalize(quat.mul(quat.conj(fk.rot[this.ch.nodes[foot].parent]), quat.mul(q, fk.rot[foot]))));
    }
  }
  /** this man's relaxed hands (HAND), as the turn from the library's fist on each digit joint — and the index laid straight, for the trigger hand */
  private handsBuild() {
    const H = this.hn, seed = H.seed, p = new Pose(this.pA.numNodes).copy(this.rest);   // (its own scratch, once a man: the layers' pB keeps what they left in it)
    const h = (k: number) => { let x = Math.imul(((seed + 1) * 2654435761) ^ (k * 40503), 2246822519) >>> 0; x ^= x >>> 15; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296 * 2 - 1; };
    H.quiet = true; H.open = [];
    for (let sd = 0; sd < 2; sd++) {
      const man = HAND.vary * h(40) + HAND.sideVary * h(41) * (sd ? 1 : -1);
      this.hand(p, sd as 0 | 1, HAND.curl.map((c, fi) => clamp(c + man + HAND.fingerVary * h(42 + sd * 4 + fi), 0.05, 0.9)), clamp(HAND.thumb + 0.1 * h(50 + sd), 0, 1), HAND.spread + 0.06 * h(52 + sd));
      { const t0 = this.thumbs[sd][0]; p.setRot(t0, quat.normalize(quat.mul(quat.axisAngle(AY, (sd ? 1 : -1) * HAND.thumbIn * DEGR), p.rot(t0)))); }   // the thumb up toward the palm's plane, about the fingers' axis (the hand bone's +Y — its parent's frame): at rest it hangs well palm-ward of the fingers, an open hand held as if round a glass
      { const th = this.thumbs[sd], t0 = th[0], along = quat.rotate(p.rot(t0), AY), ax = v3.cross(along, AY), al = v3.len(ax);   // …brought in toward the fingers' line (both in the hand bone's frame), and its two outer joints bent: a thumb at rest is not a peg
        if (al > 1e-4 && HAND.thumbClose) p.setRot(t0, quat.normalize(quat.mul(quat.axisAngle(v3.scale(ax, 1 / al), HAND.thumbClose * DEGR), p.rot(t0))));
        let up = p.rot(t0); if (HAND.thumbBend) for (const j of [1, 2]) {   // (each outer joint turned toward the fingers' line too, about the axis square to both — `up` = the joint above it in the hand's frame)
          const d = quat.rotate(quat.mul(up, p.rot(th[j])), AY), bx = v3.cross(d, AY), bl = v3.len(bx);
          if (bl > 1e-4) p.setRot(th[j], quat.normalize(quat.mul(quat.axisAngle(quat.rotate(quat.conj(up), v3.scale(bx, 1 / bl)), HAND.thumbBend * DEGR), p.rot(th[j]))));
          up = quat.mul(up, p.rot(th[j])); } }
      const ns = H.nodes[sd], f = H.fist[sd], o = new Float32Array(60);
      for (let k = 0; k < 15; k++) o.set(quat.mul(quat.conj([f[k * 4], f[k * 4 + 1], f[k * 4 + 2], f[k * 4 + 3]]), p.rot(ns[k])), k * 4);
      H.open.push(o);
      for (let k = 0; k < 3; k++) H.thumb[sd].set(p.rot(ns[k]), k * 4);   // (the relaxed thumb itself, joint by joint: what a hand that is not the fist is turned to — thumbOwn)
    }
    this.fingers[1][0].forEach((node, j) => { let q = quat.axisAngle(AX, HAND.trig[j] * DEGR); if (j === 0) q = quat.mul(quat.axisAngle(AZ, -HAND.trigSpread * DEGR), q); H.trig.set(quat.normalize(quat.mul(this.rest.rot(node), q)), j * 4); });
    H.quiet = false; H.built = seed;
  }
  /** THE HAND PASS (HAND): `fullL` / `fullR` = how much of each hand is closed round something (0 = empty); `gunR` = how much of a gun the right hand has, with
   *  nothing else at work on it. Digit joints of pA only. */
  private handsPass(dt: number, fullL: number, fullR: number, gunR: number) {
    const H = this.hn, d = this.pA.data, far = HAND.far * DEGR;
    if (H.built !== H.seed) this.handsBuild();
    for (let sd = 0; sd < 2; sd++) {
      H.grip[sd] = damp(H.grip[sd], this.grip[sd] ? 1 : 0, 14, dt);
      const free = (1 - clamp(sd ? fullR : fullL, 0, 1)) * (1 - H.grip[sd]); if (free <= 0.003) continue;
      const ns = H.nodes[sd], fist = H.fist[sd], open = H.open[sd], b = H.base[sd], nt = H.note[sd], own = H.own[sd];
      for (let g = 0; g < 5; g++) {
        const k = g * 12, o0 = ns[g * 3] * 10 + 3, o1 = ns[g * 3 + 1] * 10 + 3, o2 = ns[g * 3 + 2] * 10 + 3;
        const fistK = 1 - clamp((qAng(b, k, fist, k) + qAng(b, k + 4, fist, k + 4) + qAng(b, k + 8, fist, k + 8)) / 3 / (own[g] * 0.85), 0, 1); if (fistK <= 0.003 && g > 0) continue;   // how much of the hand under the layers is the library's fist (none of it, crouched: that clip's hand is its own)
        const moved = (qAng(d, o0, b, k) + qAng(d, o1, b, k + 4) + qAng(d, o2, b, k + 8)) / 3, D = nt[g] < Infinity ? nt[g] : far;
        const lay = 1 - (D < 0.03 ? (nt[g] < Infinity ? 1 : 0) : clamp(moved / D, 0, 1)), f = fistK * free * lay;   // …less what a layer has made of it
        if (f > 0.003) { qTurnBy(d, o0, open[k], open[k + 1], open[k + 2], open[k + 3], f); qTurnBy(d, o1, open[k + 4], open[k + 5], open[k + 6], open[k + 7], f); qTurnBy(d, o2, open[k + 8], open[k + 9], open[k + 10], open[k + 11], f); }
        if (g === 0) { const t = (1 - fistK) * free * lay * HAND.thumbOwn, T = H.thumb[sd];   // the THUMB of a hand that is not the fist (the crouch clips' open hand holds it out straight): to the relaxed hand's thumb
          if (t > 0.003) { qTurnTo(d, o0, T, 0, t); qTurnTo(d, o1, T, 4, t); qTurnTo(d, o2, T, 8, t); } }
      }
    }
    // the trigger hand's index, a drilled man's: straight along the frame until he fires, on the trigger while he does and for a moment after
    H.fired += dt; const offT = H.fired < HAND.trigHold ? 0 : 1; H.off = damp(H.off, offT, offT < H.off ? 40 : 9, dt);
    H.gun = damp(H.gun, clamp(gunR, 0, 1), 18, dt);   // eased: the caller's gate for a throw / reload / strike is a step, and the finger snapped between straight and the clip's curl in a frame
    const tr = H.gun * smoothstep(HAND.trigTrained, HAND.trigTrained + 0.1, this.trained) * H.off;
    if (tr > 0.003) this.fingers[1][0].forEach((node, j) => { const o = node * 10 + 3, t = H.trig, k = j * 4;
      const cx = -d[o], cy = -d[o + 1], cz = -d[o + 2], cw = d[o + 3];   // conj(q) · target: the turn from where the joint is to the straight finger
      qTurnBy(d, o, cw * t[k] + cx * t[k + 3] + cy * t[k + 2] - cz * t[k + 1], cw * t[k + 1] - cx * t[k + 2] + cy * t[k + 3] + cz * t[k], cw * t[k + 2] + cx * t[k + 1] - cy * t[k] + cz * t[k + 3], cw * t[k + 3] - cx * t[k] - cy * t[k + 1] - cz * t[k + 2], tr); });
  }
  /** Model rotation for a hand given where its fingers point (`f`) and which way the back of the hand faces (`b`, made ⊥ f) — calibrated per side from the rest
   *  pose (T-pose, palms down), so one description fits either hand. */
  private handRot(side: 0 | 1, f: Vec3, b: Vec3): Quat {
    const F = v3.normalize(f); const B = v3.normalize(v3.mad(b, F, -v3.dot(b, F)));
    return quat.mul(quat.fromBasis(v3.cross(F, B), F, B), this.handFix[side]);
  }

  /** Turn neck (40 %) and head (60 %) so the gaze — the head direction that looks dead ahead in the standing idle — points at `target` (model space) from
   *  where the eyes are; limited to what a neck does (±40° yaw, −35…+45° pitch), scaled by w, with an optional roll (head cocked) on top. */
  private lookAt(pose: Pose, target: Vec3, w: number, roll = 0) {
    const nd = this.nodes, fk = this.fk; fk.run(pose);
    const hr = fk.rot[nd.head]; const gaze = quat.rotate(hr, this.gazeLocal); const eyes = v3.mad(v3.mad(fk.pos[nd.head], quat.rotate(hr, AY), 0.1), gaze, 0.08);
    const want = v3.normalize(v3.sub(target, eyes));
    const yawE = clamp(wrapAngle(Math.atan2(want[0], want[2]) - Math.atan2(gaze[0], gaze[2])), -0.7, 0.7);
    const pitchE = clamp(Math.asin(clamp(gaze[1], -1, 1)) - Math.asin(clamp(want[1], -1, 1)), -0.6, 0.8);   // + = look further down = pitch forward
    const look = (k: number) => quat.mul(qYaw(yawE * k * w), qPitch(pitchE * k * w));
    this.turn(pose, nd.neck, look(0.4)); this.turn(pose, nd.head, roll ? quat.mul(qRoll(roll), look(0.6)) : look(0.6));
  }
  /** where a bending knee should head: forward, a quarter of the way toward the line of the (often turned-out) foot, and a little up */
  private kneePole(footRot: Quat): Vec3 { const f = quat.rotate(footRot, AY); const h = v3.normalize([f[0], 0, f[2] + 1e-6]); return v3.normalize([h[0] * 0.25, 0.5, h[2] * 0.25 + 0.75]); }
  /** Stance, body half: pelvis bladed toward the wall and settled a few cm onto soft knees — over feet that are IK-pinned back exactly where the locomotion has
   *  them (so nothing slides: standing, the legs twist and bend under a turning pelvis; walking, the cycle's foot placement is untouched) — the upper spine
   *  countering ⅔ of the blade, a forward lean spread hips-first up the spine with the head levelled back onto the target, and the stance's own head yaw / chin.
   *  `stand` (0…1, the kick) takes the blade and the squat out and halves the lean: a kick is thrown standing square to the door. */
  private stanceBody(w: number, speed: number, stand: number) {
    const pA = this.pA, nd = this.nodes, st = this.st, fk = this.fk;
    const blade = st.blade.x * DEGR * w * (1 - stand) * lerp(1, 0.5, smoothstep(0.3, 1.3, speed)); const drop = Math.max(0, st.squat.x) * w * (1 - stand);
    const replant = Math.abs(blade) > 1e-4 || drop > 1e-4;
    let fL: Vec3 | null = null, fR: Vec3 | null = null, rL: Quat | null = null, rR: Quat | null = null;
    if (replant) { this.fkPart(pA, this.fkLegs); fL = v3.copy(fk.pos[nd.footL]); fR = v3.copy(fk.pos[nd.footR]); rL = [...fk.rot[nd.footL]] as Quat; rR = [...fk.rot[nd.footR]] as Quat; }
    if (Math.abs(blade) > 1e-4) {
      this.turn(pA, nd.hips, qYaw(blade));                                                   // pelvis toward the wall…
      this.turn(pA, nd.spine1, qYaw(-blade * 0.25)); this.turn(pA, nd.spine2, qYaw(-blade * 0.25)); this.turn(pA, nd.spine3, qYaw(-blade * 0.15));   // …chest comes ⅔ of the way back
    }
    if (drop > 1e-4) { this.shift(pA, nd.hips, [0, -drop, 0]); this.turn(pA, nd.hips, qPitch(drop * 40 * DEGR)); }   // sit a little into the knees, pelvis tipping forward with it (≈3° at 7 cm)
    const lean = st.lean.x * DEGR * w * (1 - 0.5 * stand);
    this.turn(pA, nd.spine1, qPitch(lean * 0.45)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.2));   // hips lead, chest follows
    const hp = st.headPitch.x * DEGR * w, hy = st.headYaw.x * DEGR * w, unl = lean + drop * 40 * DEGR;
    this.turn(pA, nd.neck, quat.mul(qYaw(hy * 0.4), qPitch(-unl * 0.4 + hp * 0.4))); this.turn(pA, nd.head, quat.mul(qYaw(hy * 0.6), qPitch(-unl * 0.6 + hp * 0.6)));   // level the head back out of the lean, then the stance's own chin / door look
    if (replant) {   // feet back where they were, soles as they were, knees sent out over the toes
      this.fkPart(pA, this.fkLegs);
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL!, this.kneePole(rL!), 0.6, rL!);
      twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR!, this.kneePole(rR!), 0.6, rR!, true);
    }
    if (this.stackPressSm !== 0) this.shift(pA, nd.hips, [-this.stackPressSm * w * (1 - stand), 0, 0]);   // WALLSNAP: the whole figure, feet and all, a hand nearer the wall on stackSide (+ = on his right; model +x is his left)
  }

  /** Deliberate movement and the crouch's centre of gravity by pace (`deliberate`; the shares come from update(): Dl = deliberate × crouch-walking, pace = creep →
   *  full crouch pace, soft = deliberate × walking upright, armsIn = the arms' share, surge = this frame's fore-aft ride of the lower body).
   *  - Legs: the crouch cycle is time-sampled and in place (its pelvis keys no travel), so there is no root motion to counter-scale against the lower cadence —
   *    the stride is warped at the feet instead: each ankle is IK-held where the cycle has it, sole as it was, with its fore-aft travel scaled about the
   *    gait's middle (gait.mid) by the same factor the cadence came down by (SNEAK.stride: the planted foot moves back exactly as fast as it did, so nothing
   *    is added to whatever the clip itself slides), and by a little more with pace (paceStride, cadence untouched: that share only closes some of the
   *    clip's own shortfall). Both feet and the pelvis ride `surge` together (the sampled phase lingers after each plant — update() — and this is what
   *    keeps the planted foot's ground speed through it, and what reads as the body hanging back over the foot just set down, then coming on).
   *  - Pelvis: lower (4 cm deliberate + 3 cm at full pace crouched — the knees, bent past 90° down there, just fold further; 1 cm upright, over feet
   *    re-planted where they were, so the knees soften instead of the soles sinking), tipped forward a touch as it settles.
   *  - Torso: a few degrees further over, hips first up the spine, the neck and head taking all of it (and the pelvis tip) back out: the eyes stay where
   *    they were. Left to the aim clip while aiming.
   *  - Arms (IK on a copy, in through the arms mask, the two schemes blended by the relaxed weight so drawing / holstering carries over): the pistol idle's
   *    two-hand hold comes down and back toward the lap with the elbows to the ribs, the support hand moved rigidly with the gun hand so the grip holds;
   *    free hands come in toward the thighs, a shade down and back, elbows following. Whatever poses the arms after this (the carries, the wall, lock
   *    work, aim, a throw, a reload) does so over it. */
  /** The run clip as the game shows it: its 23 cm bounce flattened toward the mean by phase (BOB_KEEP kept), and — at a jog — its bounding stride warped shorter
   *  at the feet about the gait's middle (runK, set with the phase rate above so the ground speed holds). Applied wherever the run is sampled. */
  private jogShape(pose: Pose, ph: number) {
    const nd = this.nodes;
    const fi = ph * 64, i0 = Math.floor(fi) & 63, fr = fi - Math.floor(fi); const hy = this.jogHipsY[i0] * (1 - fr) + this.jogHipsY[(i0 + 1) & 63] * fr;
    this.shift(pose, nd.hips, [0, -(hy - this.jogHipsMean) * (1 - BOB.keep), 0]);
    if (this.runK < 0.999) {
      const fk = this.fk; this.fkPart(pose, this.fkLegs); const K = this.runK, m = this.jogMid;
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const tgt = (f: Vec3): Vec3 => [f[0], f[1] * lerp(1, K, 0.5), m + (f[2] - m) * K];
      twoBoneIK(fk, pose, nd.thighL, nd.shinL, nd.footL, tgt(fL), this.kneePole(rL), 0, rL);
      twoBoneIK(fk, pose, nd.thighR, nd.shinR, nd.footR, tgt(fR), this.kneePole(rR), 0, rR, true);
    }
  }
  /** The sprint clip as the game shows it: its stride warped at the ankles about the gait's middle by SPRINT_WARP.stride — the fraction of its ~8 m/s bound
   *  that the 4.7 m/s it is played at covers, so the planted foot holds the floor at the clip's own cadence — heights eased half way with it (as the jog's
   *  are) but about the ankles' floor rather than the ground plane, so the stance foot keeps the clip's height instead of sinking a few centimetres further;
   *  soles and knee planes as authored. Applied to the sprint pose before it blends with the (jog-shaped) run. */
  private sprintShape(pose: Pose) {
    const K = SPRINT_WARP.stride; if (K > 0.999) return;
    const nd = this.nodes, fk = this.fk; this.fkPart(pose, this.fkLegs); const m = this.sprintMid, y0 = this.sprintFloorY, Ky = lerp(1, K, 0.5);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const tL0 = fk.pos[nd.toeL][1] - fL[1], tR0 = fk.pos[nd.toeR][1] - fR[1];   // toe height off the ankle as authored this frame (the foot's pitch is kept, so this carries over)
    const tgt = (f: Vec3, toeOff: number): Vec3 => { let y = y0 + (f[1] - y0) * Ky; if (y + toeOff < TOE_FLOOR_Y) y = TOE_FLOOR_Y - toeOff; return [f[0], y, m + (f[2] - m) * K]; };   // (never an ankle so low its toe goes through the floor — the clip's stance foot points down and its eased height used to bury the toe 5 cm at 4.7 m/s)
    twoBoneIK(fk, pose, nd.thighL, nd.shinL, nd.footL, tgt(fL, tL0), this.kneePole(rL), 0, rL);
    twoBoneIK(fk, pose, nd.thighR, nd.shinR, nd.footR, tgt(fR, tR0), this.kneePole(rR), 0, rR, true);
  }
  /** A run clip's stances from its toes round the cycle (heights ty[side][i], fore-aft tz[side][i], M samples): per foot the circular mean of the samples with
   *  the toe within 2 cm of its lowest and travelling back, and the two folded onto the half-cycle (they sit half a cycle apart to within a sample or two);
   *  null if either foot never qualifies */
  private stanceOf(ty: number[][], tz: number[][]): { c: number; cL: number; cR: number } | null {
    const M = ty[0].length;
    const cs = ty.map((ys, k) => { const lo = Math.min(...ys) + 0.02; let sx = 0, cx = 0, m = 0; for (let i = 0; i < M; i++) if (ys[i] <= lo && tz[k][(i + 1) % M] < tz[k][(i + M - 1) % M]) { sx += Math.sin(2 * Math.PI * i / M); cx += Math.cos(2 * Math.PI * i / M); m++; } return m ? (Math.atan2(sx, cx) / (2 * Math.PI) + 1) % 1 : NaN; });
    if (!Number.isFinite(cs[0]) || !Number.isFinite(cs[1])) return null;
    const c = (Math.atan2(Math.sin(4 * Math.PI * cs[0]) + Math.sin(4 * Math.PI * cs[1]), Math.cos(4 * Math.PI * cs[0]) + Math.cos(4 * Math.PI * cs[1])) / (4 * Math.PI) + 1) % 0.5;
    return { c, cL: cs[0], cR: cs[1] };
  }
  /** Jog_Fwd_Loop sampled at phase ph (0‥1, looping) with its loop seam closed: every channel whose last key misses its first carries (ph − ½) × the gap, so
   *  the last frame runs straight into the first — the 23 mm of pelvis height and the degree or three of leg become a drift round the whole cycle far too
   *  slow to see, instead of a hitch at phase 0 (gait.ts seam: a 28 mm pelvis pop once a cycle). Every game sample of the run goes through here. */
  private sampleJog(ph: number, out: Pose) {
    const cj = this.clips.Jog_Fwd_Loop; sampleClip(cj, ph * cj.duration, true, out);
    const k = ph - Math.floor(ph) - 0.5, d = out.data;
    for (const s of this.jogSeam) {
      if (s.d) { d[s.o] += s.d[0] * k; d[s.o + 1] += s.d[1] * k; d[s.o + 2] += s.d[2] * k; }
      else { const q = quat.mul([d[s.o], d[s.o + 1], d[s.o + 2], d[s.o + 3]], quat.axisAngle(s.axis!, s.ang! * k)); d[s.o] = q[0]; d[s.o + 1] = q[1]; d[s.o + 2] = q[2]; d[s.o + 3] = q[3]; }
    }
  }
  /** SOFT_KNEE: re-solve each leg toward its own ankle with the hip→ankle reach eased below full extension (weight w). */
  private softKnees(pose: Pose, w: number) {
    const nd = this.nodes, fk = this.fk; this.fkPart(pose, this.fkLegs);
    let cur = false;   // (fk whole and current once a solve has run: the next may say so)
    for (const [thigh, shin, foot] of [[nd.thighL, nd.shinL, nd.footL], [nd.thighR, nd.shinR, nd.footR]] as const) {
      const ph = fk.pos[thigh], pk = fk.pos[shin], pa = fk.pos[foot];
      const L = v3.dist(ph, pk) + v3.dist(pk, pa), d = v3.dist(ph, pa), r = d / L;
      if (r <= SOFT_KNEE.from) continue;
      const span = SOFT_KNEE.to - SOFT_KNEE.from, x = (r - SOFT_KNEE.from) / span;
      const rEased = SOFT_KNEE.from + span * (1 - Math.exp(-x));                 // slope 1 at `from`, → `to` asymptotically
      const rNew = r + (rEased - r) * w;
      const ar = [...fk.rot[foot]] as Quat;
      const tgt: Vec3 = [ph[0] + (pa[0] - ph[0]) * rNew / r, ph[1] + (pa[1] - ph[1]) * rNew / r, ph[2] + (pa[2] - ph[2]) * rNew / r];
      twoBoneIK(fk, pose, thigh, shin, foot, tgt, this.kneePole(ar), 0, ar, cur); cur = true;   // (leaves fk current: the full run that followed here rewrote the same numbers)
    }
  }
  /** The run's stance feet (RUN_LINGER, weight wRun): through each foot's stance window of the SAMPLED phase about its own mid-stance (sliding from the jog's to
   *  the sprint's with their blend) — easing on over R.on across heel-strike, full through mid-stance, easing off over R.off as the toe peels off — the toe is
   *  put on the floor and carried back at exactly the ground's speed. Per foot it keeps a fore-aft offset off the cycle's own toe that takes up, by w, whatever
   *  the cycle's toe does beyond the ground's −s·dt, and that bleeds away (time constant R.bleed) wherever the window is not full — so the toe comes to rest
   *  onto the floor, holds it, leaves it at the floor's speed, and the few centimetres it is then off the cycle ride into the swing and are gone by the next
   *  strike; the toe's height goes to the floor by w; and the leg is re-solved to the ankle that puts the toe there with the sole as the cycle has it (pole
   *  weight 0: outside the windows with nothing left to bleed this is skipped, and update() skips the layer outright at wRun 0 or R.depth 0). Model space, straight
   *  ahead — the cycle itself only runs along the figure's front; a backpedal (reverse) carries the toe forward instead. */
  private runPlant(ph: number, s: number, dt: number, wRun: number, wSprint: number) {
    const nd = this.nodes, fk = this.fk, pA = this.pA, R = RUN_LINGER, g = this.runGait;
    const dz = (this.reverse ? 1 : -1) * s * dt;   // the ground under him this frame, model z
    this.fkPart(pA, this.fkLegs);
    const legs: [number, number, number, number, number, { dev: number; pz: number }][] = [[nd.thighL, nd.shinL, nd.footL, nd.toeL, lerp(g.jog.cL, g.sprint.cL, wSprint), this.plantL], [nd.thighR, nd.shinR, nd.footR, nd.toeR, lerp(g.jog.cR, g.sprint.cR, wSprint), this.plantR]];
    let cur = false;
    for (const [thigh, shin, foot, toe, c, st] of legs) {
      let x = ph - c; x -= Math.round(x);            // −½ ‥ ½ about this foot's mid-stance
      const w = bump(x, R.on[0], R.on[1], R.off[0], R.off[1]) * wRun;
      const tp = fk.pos[toe];
      const miss = Number.isFinite(st.pz) ? dz - (tp[2] - st.pz) : 0; st.pz = tp[2];   // what the cycle's toe did this frame beyond the ground's own travel (a jump of 20 cm+ is a phase someone reset, not motion: let it go)
      st.dev = clamp((st.dev + (Math.abs(miss) < 0.2 ? miss : 0) * w) * Math.exp(-(1 - w) * dt / Math.max(R.bleed, 1e-3)), -0.25, 0.25);   // (bleed 0 = gone within the frame; the max() keeps w = 1, bleed = 0 off 0/0)   // holds the ground by w; what it is left holding as the toe comes off bleeds away up the swing
      if (w < 1e-3 && Math.abs(st.dev) < 5e-4) { st.dev = 0; continue; }
      const ap = fk.pos[foot], ar = [...fk.rot[foot]] as Quat;
      twoBoneIK(fk, pA, thigh, shin, foot, [ap[0], ap[1] - (tp[1] - TOE_FLOOR_Y) * w, ap[2] + st.dev], this.kneePole(ar), 0, ar, cur); cur = true;   // the ankle that puts the toe at [x, floor + (y − floor)·(1 − w), z + dev], sole unchanged — floored to the sole's level, not through it
    }
  }
  /** Idle life and weight, procedural, per-character desynced:
   *  - breathing: chest and shoulders on a slow sinus (4 s at rest), deeper and quicker for a while after hard running (exertion decays over ~8 s);
   *  - mass: the pelvis rides an acceleration-driven spring — it hangs back a couple of centimetres and the trunk tips into a start, carries on and dips
   *    at a stop, overshooting once — so speed changes read as a body being moved rather than a cursor;
   *  - weight shift: standing still for a couple of seconds, the pelvis settles a few centimetres over one foot with the hip dropped on the free side and
   *    the shoulders countering, changing feet every 4–9 s; gone the moment he moves.
   *  Feet are IK-held where the pose had them, so none of it slides a sole. `w` gates the life motion out under stances / holds / one-shots; `wF` gates the
   *  standing foot LOCK out — the same but for the upper-body one-shots, through which the planted soles hold (update() builds both). */
  private lifeLayer(dt: number, s: number, crouchPose: number, w: number, wF: number) {
    const L = this.life, pA = this.pA, nd = this.nodes, fk = this.fk;
    // clocks
    { const yin = this.bodyYawIn; if (!Number.isFinite(L.yawPrev)) L.yawPrev = yin; const yr = dt > 0 ? wrapAngle(yin - L.yawPrev) / dt : 0; L.yawPrev = yin; L.yawRate = damp(L.yawRate, clamp(yr, -8, 8), 8, dt); }
    // the root's OWN planar motion (the controller moves pos with speed 0 in the takedown lunge / the grab reach / a colleague's shove, and teleports jump it):
    // 'standing' below asks both the commanded speed and this; a jump of more than half a metre in a frame is a teleport — the feet re-lock where they land
    let teleported = false;
    { const pp = L.prevPos, P0 = this.posIn; if (!Number.isFinite(pp[0])) { L.prevPos = v3.copy(P0); } else { const d = hyp2(P0[0] - pp[0], P0[2] - pp[2]); teleported = d > 0.5; L.rootV = dt > 0 && !teleported ? damp(L.rootV, Math.min(d / dt, 8), 14, dt) : teleported ? 0 : L.rootV; L.prevPos = v3.copy(P0); } }
    const HB = HARDBREATH.on ? HARDBREATH : null;   // (blown he heaves deeper, quicker and for longer: off = the four numbers as they were)
    L.exert = clamp(L.exert + (s > 3.2 ? dt / (HB ? HB.chestUp : 4) : -dt / (HB ? HB.chestDown : 8)), 0, 1);
    const bRate = lerp(LIFE.breathRate, HB ? HB.chestRate : LIFE.breathRateRun, L.exert), bAmp = lerp(LIFE.breathAmp, HB ? HB.chestAmp : LIFE.breathAmpRun, L.exert) * lerp(1, 0.35, clamp(s / 2, 0, 1)) * LIFE.on;   // running, the gait's own motion carries the chest
    L.breath = (L.breath + dt * bRate * 2 * Math.PI) % (2 * Math.PI);
    const accel = dt > 0 ? (s - L.prevS) / dt : 0; L.prevS = s; L.accel = damp(L.accel, clamp(accel, -12, 12), 10, dt);
    L.mass.step(clamp(-L.accel * LIFE.massGain, -LIFE.massBack, LIFE.massFwd) * LIFE.on, 9, dt);            // fore-aft pelvis offset target: back under acceleration, forward (carrying on) under braking
    L.massV.step(clamp(-Math.abs(L.accel) * LIFE.massDip, -LIFE.massDipMax, 0) * LIFE.on, 10, dt);   // and a dip either way
    L.stillT = s < 0.12 && Math.abs(L.yawRate) < 0.5 ? L.stillT + dt : 0;
    const resting = L.stillT > LIFE.restAfter && LIFE.on > 0 && !(this.crT > 0.5) ? 1 : 0;   // (not under the held gait: stopped mid-stride he stays as he stopped — the breath is all that moves)
    if (resting) { L.shiftT -= dt; if (L.shiftT <= 0) { L.shiftSide = L.shiftSide > 0 ? -1 : 1; L.shiftN++; L.shiftT = LIFE.shiftMin + ((L.shiftN * 0.618034) % 1) * LIFE.shiftSpan; } }   // (4–9 s, a golden-ratio sequence: irregular but deterministic)
    L.shift.step(resting * L.shiftSide, resting ? LIFE.shiftIn : LIFE.shiftOut, dt);          // −1 … +1: over the left / right foot (eases over ~0.8 s, snaps back out in ~0.25 s when he moves)
    if (wF < 0.003) this.feet.w = 0;        // the LOCK gated out (a stance / hold has the body, or the kick the legs): released here so that coming back it re-locks where the feet ARE, not where they stood before the hold walked off with him
    if (w < 0.003 && wF < 0.003) return;    // …and the life motion with it: nothing to pose, nothing to hold
    // remember the feet, pose the body, put the feet back
    this.fkPart(pA, this.fkLegs); const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;   // (the legs alone, here and after the life motion: all this layer reads of fk before the leg solves at its end run the whole skeleton — fkPart)
    if (w >= 0.003) {   // the life motion itself — weighed out on its own under an upper-body one-shot (a flinch, the cross, a throw) while the lock below holds the soles
      const br = Math.sin(L.breath), br2 = Math.sin(L.breath - 0.6);       // shoulders trail the chest a little
      const sh = L.shift.x * w * Math.min(1, LIFE.on), side = LIFE.shiftTravel * sh * (1 - 0.5 * crouchPose);
      const off: Vec3 = [side, L.massV.x * w + 0.004 * bAmp * br * w - Math.abs(sh) * 0.006, L.mass.x * w * (1 - 0.4 * crouchPose)];
      this.shift(pA, nd.hips, off);
      if (Math.abs(sh) > 1e-3) { this.turn(pA, nd.hips, qRoll(-sh * LIFE.hipDrop * DEGR)); this.turn(pA, nd.spine2, qRoll(sh * LIFE.spineCounter * DEGR)); this.turn(pA, nd.neck, qRoll(sh * LIFE.neckCounter * DEGR)); }   // hip drops on the free side, shoulders and head counter
      const tip = clamp(L.accel * LIFE.tipGain, -LIFE.tipBack, LIFE.tipFwd) * DEGR * w * (1 - 0.5 * crouchPose) * LIFE.on;   // trunk tips into a start, back on a stop
      if (Math.abs(tip) > 1e-4) { this.turn(pA, nd.spine1, qPitch(tip * 0.5)); this.turn(pA, nd.spine2, qPitch(tip * 0.3)); this.turn(pA, nd.neck, qPitch(-tip * 0.5)); }
      const bp = bAmp * w * DEGR; this.turn(pA, nd.spine2, qPitch(-0.5 * bp * br)); this.turn(pA, nd.spine3, qPitch(-0.4 * bp * br2)); this.turn(pA, nd.neck, qPitch(0.5 * bp * br2));   // chest lifts and opens on the in-breath, the head stays put
      for (const sd of [nd.shoulderL, nd.shoulderR]) if (sd !== undefined) this.turn(pA, sd, qRoll((sd === nd.shoulderL ? 1 : -1) * 0.9 * bp * br2));
      this.fkPart(pA, this.fkLegs);
    }
    // ---- feet: planted in the WORLD while he stands (the pose's own spots, fL / fR, are where each foot WANTS to be; a locked foot stays where it was put
    //      down until the body has turned or shifted out from over it, then steps across in a lifted 0.22 s arc — one foot at a time), released into the
    //      cycle's feet as he moves off. Model ↔ world through the controller's pos / yaw fed in this frame.
    const F = this.feet; const standing = Math.max(s, L.rootV) < 0.22 && wF > 0.5 && FEET.on > 0.5 && !(this.crT > 0 && this.crT < 1) ? 1 : 0;   // (a body being lunged half a metre with speed 0 is not standing)   // (nor is one whose held gait is coming or going: the feet cross between the idle's spots and the stride's with the blend — locked, the half metre between a crouch's two poses was a re-lock, a pop)
    const wWas = F.w; F.w = damp(F.w, standing, standing ? 12 : 16 + 40 * L.rootV, dt);   // (released as fast as the body is being moved: a lunge at 3 m/s lets go in a couple of frames, so no foot is left a stride behind at full stretch)
    if (w < 0.003 && F.w <= 0.01) return;   // nothing was posed and no lock is up (an upper-body one-shot on the move): the pose stands exactly as it is
    const cy = Math.cos(this.bodyYawIn), sy = Math.sin(this.bodyYawIn), P0 = this.posIn;
    const toWorld = (m: Vec3): Vec3 => [P0[0] + m[0] * cy + m[2] * sy, P0[1] + m[1], P0[2] - m[0] * sy + m[2] * cy];
    const toModel = (wp: Vec3): Vec3 => { const dx = wp[0] - P0[0], dz = wp[2] - P0[2]; return [dx * cy - dz * sy, wp[1] - P0[1], dx * sy + dz * cy]; };
    const footYaw = (r: Quat) => { const f = quat.rotate(r, AY); return Math.atan2(f[0], f[2]); };   // the foot bone's Y runs along the foot (see kneePole)
    let tL = fL, tR = fR, qL = rL, qR = rR;
    if (F.w > 0.01) {
      const want = { L: { p: toWorld(fL), yaw: this.bodyYawIn + footYaw(rL) }, R: { p: toWorld(fR), yaw: this.bodyYawIn + footYaw(rR) } };
      const relock = wWas <= 0.01 || teleported || v3.distXZ(F.L.p, want.L.p) > 0.45 || v3.distXZ(F.R.p, want.R.p) > 0.45;   // just came to rest, teleported, or either foot left impossibly far: lock both where they ARE (no half-metre lunges, no swing from the old room)
      if (relock) { for (const k of ['L', 'R'] as const) { F[k].p = v3.copy(want[k].p); F[k].yaw = want[k].yaw; F[k].swing = -1; } }
      const SWING = FEET.swing, LIFT = FEET.lift, DIST = FEET.dist, TURN = FEET.turnDeg * DEGR, PIVOT = FEET.pivot, LAG_CAP = FEET.lagCapDeg * DEGR;   // PIVOT rad/s: a planted sole may turn on the spot this fast (a mouse flick swings the body at 7–14 rad/s; one 0.22 s step at a time cannot keep up, a pivoting sole reads fine, a leg wound 130° under the hips does not)
      const farOf = (k: 'L' | 'R') => v3.distXZ(F[k].p, want[k].p) > DIST || Math.abs(wrapAngle(F[k].yaw - want[k].yaw)) > TURN;
      for (const k of ['L', 'R'] as const) {
        const ok2 = k === 'L' ? 'R' : 'L'; const f = F[k], o = F[ok2], wt = want[k];
        if (f.swing < 0) {
          let errYaw = wrapAngle(wt.yaw - f.yaw);
          if (Math.abs(errYaw) > LAG_CAP) { f.yaw += Math.sign(errYaw) * (Math.abs(errYaw) - LAG_CAP); errYaw = Math.sign(errYaw) * LAG_CAP; }   // never wound further than LAG_CAP behind the body, however fast it is flicked round: past that the sole simply turns with him
          if (Math.abs(errYaw) > TURN) f.yaw += Math.sign(errYaw) * Math.min(Math.abs(errYaw) - TURN, PIVOT * dt);   // and pivots gently in place beyond what a step will soon take out
          const myTurn = F.next === (k === 'L' ? 0 : 1);
          if (farOf(k) && o.swing < 0 && (myTurn || !farOf(ok2))) { f.swing = 0; f.from = v3.copy(f.p); f.fromYaw = f.yaw; F.next = k === 'L' ? 1 : 0; }
        }
        if (f.swing >= 0) {
          f.swing += dt / SWING; const e = smoothstep(0, 1, Math.min(1, f.swing));
          f.p = v3.lerp(f.from, wt.p, e); f.p[1] = wt.p[1] + Math.sin(Math.PI * Math.min(1, f.swing)) * LIFT; f.yaw = f.fromYaw + wrapAngle(wt.yaw - f.fromYaw) * e;
          if (f.swing >= 1) { f.swing = -1; f.p = v3.copy(wt.p); f.yaw = wt.yaw; }
        }
      }
      const mk = (k: 'L' | 'R', restP: Vec3, restR: Quat): [Vec3, Quat] => {
        const f = F[k]; const mp = toModel(f.p); const p: Vec3 = v3.lerp(restP, mp, F.w);
        const dyaw = wrapAngle((f.yaw - this.bodyYawIn) - footYaw(restR)) * F.w; return [p, quat.mul(qYaw(dyaw), restR)];
      };
      [tL, qL] = mk('L', fL, rL); [tR, qR] = mk('R', fR, rR);
    }
    // put the feet back. The knee is steered over the toes (pole 0.6) only as far as the feet are LOCKED — a planted foot under a turning, shifting body needs
    // it; in locomotion the clip's own knee plane is right, and at the run's dead-straight push-off the foot points steeply down, its flattened yaw is
    // anyone's guess, and the swivel flung the knee 25 cm sideways for a frame twice a cycle (the 'knee spaz' at jog / chase speeds, tools/qa knee probes)
    const poleW = this.crT > 0 ? 0.6 * F.w * (1 - smoothstep(0, 1, this.crT)) : 0.6 * F.w;   // (not under the held gait: a stride stopped mid-step keeps the knees the cycle gave it)
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tL, this.kneePole(qL), poleW, qL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tR, this.kneePole(qR), poleW, qR, true);
  }
  private sneakLayer(Dl: number, pace: number, soft: number, armsIn: number, surge: number, dsh = 0) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, S = SNEAK;
    const K = (1 + S.stride * Dl) * (1 + S.paceStride * pace) * (1 + DASH.stride * dsh);
    const drop = S.drop * Dl + S.paceDrop * pace + S.softDrop * soft + DASH.drop * dsh;
    const tip = drop * 25 * DEGR;                                                    // ≈ 1.75° at 7 cm
    const lean = (S.lean * Dl + S.paceLean * pace + DASH.lean * dsh) * DEGR * (1 - this.upperW.aim);
    if (K > 1.0005 || drop > 2e-4 || Math.abs(surge) > 2e-4) {
      this.fkPart(pA, this.fkLegs);
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const m = this.gait.mid; const tgt = (f: Vec3): Vec3 => [f[0], f[1], m + (f[2] - m) * K + surge];
      this.shift(pA, nd.hips, [0, -drop, surge]); if (tip > 1e-5) this.turn(pA, nd.hips, qPitch(tip));
      this.fkPart(pA, this.fkLegs);   // feet: where the cycle had them but for the longer stride and the surge, soles as they were, in the clip's own knee plane (pole weight 0: at no stride / drop / surge this is the identity, so the layer fades to exactly nothing)
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tgt(fL), this.kneePole(rL), 0, rL);
      twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tgt(fR), this.kneePole(rR), 0, rR, true);
    }
    if (lean + tip > 1e-5) {
      this.turn(pA, nd.spine1, qPitch(lean * 0.45)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.2));   // hips lead, chest follows
      const unl = lean + tip; this.turn(pA, nd.neck, qPitch(-unl * 0.4)); this.turn(pA, nd.head, qPitch(-unl * 0.6));                          // …and the head comes level back out of all of it
    }
    if (armsIn > 0.003) {
      pB.copy(pA); this.fkPart(pB, this.fkArms);
      const cr = clamp(this.crouch, 0, 1), r = clamp(this.upperW.relaxed, 0, 1), k = lerp(0.5, 1, cr);
      const pR0 = v3.copy(fk.pos[nd.handR]), pL0 = v3.copy(fk.pos[nd.handL]); const rR0 = [...fk.rot[nd.handR]] as Quat, rL0 = [...fk.rot[nd.handL]] as Quat;
      const gunR = v3.add(pR0, v3.lerp(S.gunInStand, S.gunIn, cr));
      const freeR: Vec3 = [pR0[0] + Math.min(S.handIn, Math.max(0, -pR0[0])) * k, pR0[1] - 0.02 * k, pR0[2] - 0.03 * k];   // (the right hand lives at −x: in = toward the middle, never past it)
      const freeL: Vec3 = [pL0[0] - Math.min(S.handIn, Math.max(0, pL0[0])) * k, pL0[1] - 0.02 * k, pL0[2] - 0.03 * k];
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(freeR, gunR, r), v3.lerp([-0.05, 0.4, -1], [-0.12, -1, -0.5], r), lerp(0.35, 0.7, r), rR0);   // elbow: back and a shade out hanging; down and in on the gun
      const gunL = v3.add(fk.pos[nd.handR], v3.sub(pL0, pR0));                                                                                                // the support hand rigid with wherever the gun hand actually got to
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.lerp(freeL, gunL, r), v3.lerp([0.05, 0.4, -1], [0.2, -1, -0.35], r), lerp(0.35, 0.7, r), rL0, true);
      blendPose(pA, pB, clamp(armsIn, 0, 1), this.armsMask, pA);
    }
  }

  /** MOVES.steady (weight `w` = the crouch walk's share of the pose; called on the bare locomotion, the cycle's own sample of this frame still in pC): the
   *  cycle rocks the whole body over each foot in turn — the pelvis rolled, the trunk tipped with it, the feet a third of a metre apart — which from above is
   *  a waddle. No clock, no state: this frame's SWING is the cycle's own sample against the cycle's own mean (it carries him a few degrees over a dropped hip
   *  throughout — a posture, not a rock; the stances were posed on it and the crouch idle stands like it, so neither that mean nor whatever else is blended
   *  into the pose is touched, at any weight), and MV.steady's shares of it come out: the pelvis's roll at the hips — the whole body with it, and the chest
   *  handed the same turn back at the top of the spine (hands empty the cycle's spine already keeps the shoulders level over the rolling pelvis: they stay so;
   *  a gun's carry replaces that joint afterwards and the trunk then rides the levelled pelvis) —, a little of the hips' own sideways travel; then both ankles
   *  are put back where the cycle had them fore-aft and in height, nearer his middle, soles as they were, and the knees swung in over them. */
  private steadyLayer(w: number, base = 1, sunk = 0) {
    const pA = this.pA, nd = this.nodes, fk = this.fk, K = MV.steady;
    const rollNow = () => { const a = fk.pos[nd.thighL], b = fk.pos[nd.thighR]; return Math.atan2(a[1] - b[1], a[0] - b[0]); };
    if (!this.steadyMean) {   // the cycle's own mean carriage, measured once off the clip (pUpper: nothing holds a pose in it between layers)
      const clip = this.clips.Crouch_Fwd_Loop, N = 24, P = this.pUpper; let roll = 0, x = 0;
      for (let i = 0; i < N; i++) { sampleClip(clip, i / N * clip.duration, true, P); this.fkPart(P, this.fkLegs); roll += rollNow(); x += fk.pos[nd.hips][0]; }
      this.steadyMean = [roll / N, x / N];
    }
    this.fkPart(this.pC, this.fkLegs);
    const dRoll = rollNow() - this.steadyMean[0], dX = fk.pos[nd.hips][0] - this.steadyMean[1];   // this frame's swing: the cycle's sample off the cycle's mean
    this.fkPart(pA, this.fkLegs);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const tL = fk.pos[nd.thighL], tR = fk.pos[nd.thighR], sL = fk.pos[nd.shinL], sR = fk.pos[nd.shinR];
    const oL: Vec3 = [sL[0] - tL[0], sL[1] - tL[1], sL[2] - tL[2]], oR: Vec3 = [sR[0] - tR[0], sR[1] - tR[1], sR[2] - tR[2]]; const yL = sL[1], yR = sR[1];   // each knee's set off its hip, and its height, as the cycle has them
    const a = dRoll * K.roll * w, sx = dX * K.sway * w;
    if (Math.abs(a) > 1e-6) { this.turn(pA, nd.hips, qRoll(-a)); this.turn(pA, nd.spine3, qRoll(a)); }   // (both about the model's fore-aft axis: the chest, neck, head and arms end the frame turned exactly as the pose had them)
    if (Math.abs(sx) > 1e-6) this.shift(pA, nd.hips, [-sx, 0, 0]);
    const kx = 1 - (1 - K.feet) * w * base;
    this.fkPart(pA, this.fkLegs);
    const aL: Vec3 = [fL[0] * kx, fL[1], fL[2]], aR: Vec3 = [fR[0] * kx, fR[1], fR[2]];
    if (this.steadyUp > 0) {   // … and (setting 2) ridden higher: the pelvis up off the kneel, by as much as BOTH legs can pay out with the ankles where they are (a leg never past `reach` of its length)
      let up = this.steadyUp;
      for (const [hip, knee, foot, at] of [[nd.thighL, nd.shinL, nd.footL, aL], [nd.thighR, nd.shinR, nd.footR, aR]] as const) { const h = fk.pos[hip], len = (v3.dist(h, fk.pos[knee]) + v3.dist(fk.pos[knee], fk.pos[foot])) * K.reach;
        const hx = h[0] - at[0], hy = h[1] - at[1], hz = h[2] - at[2], q = len * len - hx * hx - hz * hz; up = Math.min(up, q > 0 ? Math.sqrt(q) - hy : 0); }
      if (up > 1e-5) { this.shift(pA, nd.hips, [0, up, 0]); this.fkPart(pA, this.fkLegs); }
    }
    const kn = K.knee * w * base, ko = K.kneeOut * w * sunk, hL = smoothstep(0.10, 0.22, yL), hR = smoothstep(0.10, 0.22, yR), kL = 1 - kn * lerp(K.kneeLow, 1, hL) + ko * (1 - hL), kR = 1 - kn * lerp(K.kneeLow, 1, hR) + ko * (1 - hR);   // the knees swung in over the ankles (less of it for one a hand off the floor)
    const pL: Vec3 = [oL[0] * kL, oL[1], oL[2]], pR: Vec3 = [oR[0] * kR, oR[1], oR[2]];
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, aL, pL, 1, rL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, aR, pR, 1, rR, true);
  }

  /** Both arms onto the pistol: the right (gun) hand at chest + [side, up, fwd] (model axes), the muzzle at `pitch` and level in roll, the left hand keeping the
   *  exact hold it has in Pistol_Aim_Neutral (both hands are moved by one rigid transform of the clip's grip, so the support hand never leaves the gun); elbows
   *  swivelled down-and-in by `tuck`. Solved on a copy seeded with the aim clip's shoulders / hands / fingers, blended in through the arms mask. A little sway
   *  and, during a kick, a pump of the gun toward the chest keep it from reading as a still. */
  private carryArms(w: number, kickT: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, st = this.st, fk = this.fk, t = this.idleT;
    pB.copy(pA); blendPose(pB, this.pAim, 1, this.armsMask, pB);   // current body, aim-clip arms
    this.fkPart(pB, this.fkArms);   // (chest joint + both arms: all that is read before the first solve runs the whole skeleton — the left wrist's rotation, read live below, included)
    const chest = fk.pos[nd.spine3];
    const pR0 = fk.pos[nd.handR], pL0 = fk.pos[nd.handL]; const rR0 = fk.rot[nd.handR], rL0 = fk.rot[nd.handL];
    const g0 = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR0));   // the clip's bore axis as posed on this spine (Character.gunDir's definition)
    // where the gun goes: sway (slow figure-eight, mm) + kick pump
    const pump = kickT >= 0 ? 0.05 * bump(kickT, 0.15, 0.36, 0.5, 0.85) : 0;
    const fwd = st.fwd.x - pump, up = st.up.x + 0.004 * Math.sin(t * 2.1) + 0.02 * pump, sidew = st.side.x + 0.005 * Math.sin(t * 1.3 + 0.6);
    const pitch = (st.pitch.x + 0.8 * Math.sin(t * 1.7 + 1.1)) * DEGR + pump * 4, yaw = 0.6 * Math.sin(t * 1.1) * DEGR + st.blade.x * DEGR * 0.2;   // (stack: bore drifts a touch toward the door edge)
    const gd: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    // rigid motion of the grip: rotation D (shortest arc bore → wanted bore, then unroll so the sights stay up), translation to the wanted hand point
    const D = this.gripTurn(g0, rR0, gd, AY);
    const pR: Vec3 = [chest[0] + sidew, chest[1] + up, chest[2] + fwd];
    const grip = quat.rotate(D, v3.sub(pL0, pR0));   // support wrist relative to the gun wrist, turned with the gun
    const tuck = st.tuck.x;
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, pR, [-0.12 - 0.6 * (1 - tuck), -1, -0.5], 0.4 + 0.55 * tuck, quat.mul(D, rR0));
    const pL = v3.add(fk.pos[nd.handR], grip);        // from where the gun hand actually got to (an extended carry can sit at the edge of reach on some torsos: the hands must not part)
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, pL, [0.2 + 0.6 * (1 - tuck), -1, -0.35], 0.4 + 0.5 * tuck, quat.mul(D, rL0), true);   // (the support arm reaches across, so its elbow sits a little wider)
    blendPose(pA, pB, w, this.armsMask, pA);
  }
  /** The rotation that carries the aim clip's grip (bore `g0`, gun hand at model rotation `rR0`) onto the wanted bore `gd`: the shortest arc, then unrolled about
   *  the bore so the pistol's top strap faces `upRef` as nearly as the bore allows (AY: sights up, a level carry). */
  private gripTurn(g0: Vec3, rR0: Quat, gd: Vec3, upRef: Vec3): Quat {
    let D = quat.fromTo(g0, gd);
    const up0 = quat.rotate(quat.mul(D, rR0), this.gripUp);
    const want = v3.sub(upRef, v3.scale(gd, v3.dot(upRef, gd))), cur = v3.sub(up0, v3.scale(gd, v3.dot(up0, gd)));
    if (v3.len(want) > 1e-4 && v3.len(cur) > 1e-4) { const wn = v3.normalize(want), cn = v3.normalize(cur); D = quat.mul(quat.axisAngle(gd, Math.atan2(v3.dot(v3.cross(cn, wn), gd), v3.dot(cn, wn))), D); }
    return D;
  }
  /** which row of LONG_RELOAD this gun's carry takes (`reloadBack` is the second movement pass's input: nobody's with that pass off) */
  private rlRow() { return this.reloadBack && MOVES.on > 0.5 && !(this.feed !== null && feedLive()) ? LONG_RELOAD.back : LONG_RELOAD.box; }   // (a gun with a model of its own is never the bullpup: gunreload.ts)
  /** the carriage's channels as they are posed: the springs' own — or, while a reload carry is up (GUN HAND), those with its share of LONG_RELOAD taken */
  private lgChannels(): readonly { x: number }[] { const C = this.rlc; return (C.k > 0 || C.h > 0) && C.ch ? C.ch : this.lg.ch; }
  /** GUN HAND (`longReload`), once a frame after the carriage's springs: how much of the reload carry (LONG_RELOAD) the long gun shows, and the channels with it
   *  taken. The clock is the one the magazine change runs on (mvArms): the game's own where it deals one (a guard's beat, a room-fight teammate's — reloadAt), else
   *  reload()'s beat. Up over the beat's first `in` seconds, down by its end: the gun is on its carriage again before a round can leave it. A low carriage pulled in for
   *  a wall (gunWall) keeps to its tuck — the muzzle stays out of the plaster, the hands do the change there. Nothing with the switch off. */
  private reloadCarry(dt: number, want: LongStance) {
    const C = this.rlc, S = this.rlShown;
    if (!(GUNHAND.on && GUNHAND.longReload)) { C.k = C.h = S.carry = S.head = 0; return; }
    const R = LONG_RELOAD, B = this.rlB; let t = -1, D = 0, out = B.out, in_ = B.in_;
    if (this.longGun) {
      if (MOVES.on > 0.5) {   // (the hand's own clock, as mvArms picks it — which runs after this and moves rlT on: both read this frame's)
        if (this.reloadAt >= 0 && this.reloadRow) { t = this.reloadAt; D = Math.max(0.3, this.reloadRow.dur); }
        else if (this.rlT >= 0) { t = this.rlT; D = B.dur; }
      } else if (this.reloadT >= 0) { D = this.reloadDur; t = this.reloadT * (D / this.clips.Pistol_Reload.duration); out = D * 0.27; in_ = D * 0.65; }   // (no movement pass, no hand, nothing of a beat read: the clip's clock, which runs on under the carry, and rlBeat's own shares of it)
    }
    // a beat that stands still (a guard's counts down only while he is at his fire: guards.ts tickReloadBeat — off his man it waits) or hands with other work (a
    // signal, a tell, a throw, a strike, a tool: what takes the hand off the change in mvArms) puts the gun back on its carriage; it comes up again as the change goes on
    C.still = t >= 0 && t === C.at ? C.still + dt : 0; C.at = t;
    if (C.still > 0.25 || this.sigT >= 0 || this.tellT >= 0 || this.mvs.tsT >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.bigTool) t = -1;
    const tuck = want === 'lowLong' || want === 'patrolLong' ? clamp(this.gunWall, 0, 1) : 0;
    const kT = t >= 0 ? bump(t, 0, R.in, D - R.end - R.out, D - R.end) * (1 - tuck) : 0;
    const hT = t >= 0 ? bump(t, Math.max(0, out - R.headIn), Math.max(0.05, out - 0.05), Math.min(in_ + 0.1, D - R.end - R.headOut), Math.min(in_ + 0.1 + R.headOut, D - R.end)) : 0;
    const step = Math.max(0, R.rate * dt); C.k += clamp(kT - C.k, -step, step); C.h += clamp(hT - C.h, -step, step);
    S.carry = C.k; S.head = C.h;
    if (C.k > 0 || C.h > 0) {
      const ch = this.lg.ch, X = (C.ch ??= Array.from({ length: LC.count }, () => ({ x: 0 }))), G = this.rlRow();
      for (let i = 0; i < LC.count; i++) X[i].x = ch[i].x;
      const to = (i: number, v: number, w: number) => { X[i].x += (v - X[i].x) * w; };
      to(LC.pitch, G.pitch, C.k); to(LC.aimK, G.aimK, C.k); to(LC.yaw, G.yaw, C.k);   // (the hand's point itself is longArms': off the chest joint, clear of the carriage's anchor and its steadied line)
      to(LC.headYaw, R.head.yaw, C.h); to(LC.headPitch, R.head.pitch, C.h); to(LC.headRoll, R.head.roll, C.h);
    }
  }
  /** The long gun, trunk half (weight w): the upper spine bladed toward the gun and taken back out at the neck, a lean spread hips-first with the head levelled out of
   *  it, and the head set to the stock — the carriage channels' current values (LONG), straight into pA. Runs before longArms so the shoulders are where the arms
   *  will be solved from. `run` (the pose's jog + sprint share, the carry pass only): a figure that steadies its long gun (longSteady) first has the run clip's pumping
   *  of the shoulder line — measured off the pose, ±25° with the arms that drive it — taken LONG_STEADY.runYaw of the way back out down the spine, so the shoulders
   *  stay on the weapon both hands hold and the legs do the running (the walk's few degrees are its own and stay). `sprint` (the sprint's share alone): by that
   *  much the twist is measured and taken out about the trunk's own line instead of the model's upright (MOVES.steadyRun) — at 0, every jog, the hold as it was. */
  private longBody(w: number, run = 0, sprint = 0) {
    if (w < 0.003) return;
    const pA = this.pA, nd = this.nodes, ch = this.lgChannels();
    const hold = run * clamp(this.longSteady, 0, 1) * LONG_STEADY.runYaw * w;
    if (hold > 0.003) {
      this.fkPart(pA, this.fkArms); const fk = this.fk; const a = fk.pos[nd.upperArmL], b = fk.pos[nd.upperArmR];
      const lv = mvOn('steady') && mvOn('steadyRun') ? clamp(sprint, 0, 1) : 0;   // (by the SPRINT's share of the pose: a jog — every teammate's run, who never sprints — is held as it always was, to the bit)
      if (lv > 0) {   // MOVES.steady + MOVES.steadyRun: … about the TRUNK'S OWN LINE. A runner's trunk is pitched forward (the sprint clip's: ~25°) and its pumping is a twist about that line; taken out about the model's upright instead (below), what was left of ±25° of twist about a line 25° off upright was ±11° of the whole trunk rolling side to side — the head 17 cm across, three steps a second: the sprint's waddle with the rifle in his hands. The line runs spine1 → between the clavicle ROOTS (rigid on the chest: the arm ends they carry pump up and down with the arms and would rock the line itself); the twist is still read at the shoulder joints, which the gun hangs from; and the neck is handed the twist back, so the head keeps the clip's own carriage (the clip counter-turns it against a trunk twist that is no longer there)
        const ca = fk.pos[nd.shoulderL], cb = fk.pos[nd.shoulderR], u = v3.sub(v3.lerp(ca, cb, 0.5), fk.pos[nd.spine1]), ul = v3.len(u);
        if (ul > 1e-4) { const un = v3.scale(u, 1 / ul), s = v3.sub(a, b), sp = v3.mad(s, un, -v3.dot(s, un)), ref: Vec3 = [1 - un[0] * un[0], -un[0] * un[1], -un[0] * un[2]];   // (the shoulder line and the figure's own left, both square to the trunk's line)
          const ty = Math.atan2(v3.dot(v3.cross(ref, sp), un), v3.dot(ref, sp)) * hold * lv;   // the twist about it off square, the share of it to take out
          if (Math.abs(ty) > 1e-4) { this.turn(pA, nd.spine1, quat.axisAngle(un, -ty * 0.3)); this.turn(pA, nd.spine2, quat.axisAngle(un, -ty * 0.35)); this.turn(pA, nd.spine3, quat.axisAngle(un, -ty * 0.35)); this.turn(pA, nd.neck, quat.axisAngle(un, ty)); } }
      }
      if (lv < 1) {
      const sy = Math.atan2(b[2] - a[2], a[0] - b[0]) * hold * (1 - lv);   // the shoulder line's yaw off square (+ = turned to the figure's left), the share of it to take out (both shares are read off the pose as the clip left it)
      if (Math.abs(sy) > 1e-4) { this.turn(pA, nd.spine1, qYaw(-sy * 0.3)); this.turn(pA, nd.spine2, qYaw(-sy * 0.35)); this.turn(pA, nd.spine3, qYaw(-sy * 0.35)); }
      }
    }
    const blade = ch[LC.blade].x * DEGR * w, lean = ch[LC.lean].x * DEGR * w;
    const hy = ch[LC.headYaw].x * DEGR * w, hp = ch[LC.headPitch].x * DEGR * w, hr = ch[LC.headRoll].x * DEGR * w;
    if (Math.abs(blade) > 1e-5) { this.turn(pA, nd.spine2, qYaw(blade * 0.4)); this.turn(pA, nd.spine3, qYaw(blade * 0.6)); this.turn(pA, nd.neck, qYaw(-blade * 0.5)); this.turn(pA, nd.head, qYaw(-blade * 0.5)); }
    if (Math.abs(lean) > 1e-5) {
      this.turn(pA, nd.spine1, qPitch(lean * 0.45)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.2));
      this.turn(pA, nd.neck, qPitch(-lean * 0.4)); this.turn(pA, nd.head, qPitch(-lean * 0.6));
    }
    if (Math.abs(hy) + Math.abs(hp) + Math.abs(hr) > 1e-5) { this.turn(pA, nd.neck, quat.mul(qYaw(hy * 0.4), qPitch(hp * 0.4))); this.turn(pA, nd.head, quat.mul(qRoll(hr), quat.mul(qYaw(hy * 0.6), qPitch(hp * 0.6)))); }
  }
  /** The long gun, arms (weight w): the trigger hand's wrist put at the carriage's [side, up, fwd] (model axes) off the chest joint — or, by its `anchor`, off the gun
   *  shoulder joint (kept no further out than the aim clip's) — swung about the shoulders with the aim's share of the pitch, holding the weapon's grip exactly as it
   *  holds the pistol's (the aim clip's hand turned onto the wanted bore, receiver up — gripTurn); the bore at the carriage's yaw / pitch plus its share of the aim
   *  pitch; both point and bore LESS what the chest twist adds after this pose (−0.35 × aim pitch × the aim layer's weight, about the chest joint: update()), so
   *  shouldered the bore comes out dead on Character.aimDir and down the gun shoulder's own line to the target; then the support hand solved onto the weapon's grip
   *  point (longGrip, in the gun's frame) from where the trigger hand actually got to, palm up under the handguard, fingers round it. Should the support arm fall
   *  short (a long carriage on a swung-back shoulder), the whole gun is brought back by the shortfall (capped) and both re-solved — the trigger arm has the slack,
   *  so the hands do not part — and that hold-back is kept (lg.pull, `keep`) and let out over half a second, so a stride that runs short once a cycle does not pump
   *  the gun. A little sway, the kick's pump toward the chest and a shot's pull back along the bore ride on top. Solved on a copy seeded with the aim clip's shoulder
   *  set and grips, blended in through the arms mask — or, on the pass after the aim clip (yieldDoor), arm by arm short of whatever a hand on a door still holds. */
  private longArms(w: number, kickT: number, dt: number, yieldDoor: boolean, keep: boolean) {
    if (w < 0.003) return;
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, ch = this.lgChannels(), t = this.idleT, G = this.longGrip;
    pB.copy(pA); blendPose(pB, this.pAim, 1, this.armsMask, pB);   // current body, the aim clip's clavicles / trigger grip / fingers to start from
    this.fkPart(pB, this.fkArms);   // (chest joint + the arms: all that is read before solve()'s first twoBoneIK runs the whole skeleton)
    const chest = v3.copy(fk.pos[nd.spine3]);
    const pR0 = v3.copy(fk.pos[nd.handR]); const rR0 = [...fk.rot[nd.handR]] as Quat;
    const g0 = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR0));   // the clip's bore as posed on this spine (Character.gunDir's definition: wrist → middle finger)
    // the bore, model space
    const sway = ch[LC.sway].x, a = this.upperW.aim;
    const rcl = mvOn('recoil'), mvs = this.mvs;   // MOVES: the recoil's climb and sideways throw on the bore, its drive back along it in place of the fixed pull
    const yaw = (ch[LC.yaw].x + 0.6 * sway * Math.sin(t * 1.1) + (rcl ? mvs.yaw : 0)) * DEGR;
    const dipW = this.mv2Shown.dip;   // MOVES.entry (0 unless that switch is on): the stock stays in the shoulder, the muzzle goes down past the man in front
    const pitch0 = clamp((ch[LC.pitch].x + 0.8 * sway * Math.sin(t * 1.7 + 1.1) + (rcl ? mvs.climb : 0)) * DEGR + this.aimPitch * (ch[LC.aimK].x - 0.35 * a), -1.35, 1.35);
    const dipK = dipW > 0 ? dipW * (1 - smoothstep(0.3, 0.6, pitch0)) : 0;   // (only ever DOWN, and only from a gun that is about level: a muzzle already lower stays where it is, one carried high is over him already)
    const pitch = dipK > 0 ? lerp(pitch0, Math.min(pitch0, MV2.dip.pitch * DEGR), dipK) : pitch0;
    if (dipK > 0 && w > 0.99 && mvOn('entryEyes')) this.sightsLift = pitch0 - pitch;   // (only while this pass has the whole gun: part-way into a hold, or with the wall arms, the bore shown is not this one)
    const cp = Math.cos(pitch); const d: Vec3 = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
    const rR = quat.mul(this.gripTurn(g0, rR0, d, AY), rR0);
    // the gun's own frame about that bore, as rigProps builds it to draw the weapon (frameFrom(hand, gunDir, −gunUnder)): y up out of the receiver, x to the figure's left
    let yW = v3.mad(AY, d, -d[1]); yW = v3.len(yW) > 1e-4 ? v3.normalize(yW) : [Math.cos(yaw), 0, -Math.sin(yaw)]; const xW = v3.cross(yW, d);
    const inGun = (p: Vec3): Vec3 => [xW[0] * p[0] + yW[0] * p[1] + d[0] * p[2], xW[1] * p[0] + yW[1] * p[1] + d[1] * p[2], xW[2] * p[0] + yW[2] * p[1] + d[2] * p[2]];
    // the trigger hand: the carriage's point off the chest joint (+ sway), pumped toward the chest by a kick, pulled back along the bore by a shot — swung about the
    // shoulders' pivot (LONG_PIVOT) by the aim's share of the pitch, the way an arm pointing up or down carries the hand with it (so a shouldered gun stays on the
    // gun shoulder's own line to the target whatever the pitch: guards.ts clearShot reads that line), and, like the bore, turned back by what the chest twist
    // will add about the chest joint after this pose
    const kick = this.shootT >= 0 ? (this.shootT < 0.035 ? this.shootT / 0.035 : Math.max(0, 1 - (this.shootT - 0.035) / 0.2)) : 0;
    const pump = kickT >= 0 ? 0.04 * bump(kickT, 0.15, 0.36, 0.5, 0.85) : 0;
    const kA = clamp(ch[LC.anchor].x, 0, 1); const anchor = v3.lerp(chest, fk.pos[nd.upperArmR], kA);   // off the chest joint … off the gun shoulder (the clip's own, as it will show)
    anchor[0] = Math.max(anchor[0], chest[0] - LONG_ANCHOR_SIDE_MAX);   // (a wide, easy shoulder set — the calm clips' — would carry the whole gun out with it, past the support arm's reach: no further out than the aim clip's own shoulder)
    // steadied against the gait (longSteady × the carriage's `steady`): the anchor's side-to-side followed through a two-pole low-pass (LONG_STEADY.tau) instead of
    // frame by frame — the trunk's rock once a stride (±6 cm at the chest crouch-walking, ±3 walking) stays in the trunk and the arms take it up, the gun riding the
    // shoulders' mean line; the weight going onto one foot at rest, a second's business, still carries it. The poles always follow (so a carriage or a switch coming
    // on finds them current); only the pass whose arms stay on show (keep) moves them on.
    { const L = this.lg.lat; let l0 = L[0], l1 = L[1];
      if (!Number.isFinite(l0) || !Number.isFinite(l1)) l0 = l1 = anchor[0];
      else { const k = 1 - Math.exp(-dt / Math.max(1e-3, LONG_STEADY.tau)); l0 += (anchor[0] - l0) * k; l1 += (l0 - l1) * k; }
      if (keep) { L[0] = l0; L[1] = l1; }
      const iso = clamp(ch[LC.steady].x, 0, 1) * clamp(this.longSteady, 0, 1);
      if (iso > 1e-3) anchor[0] = lerp(anchor[0], l1, iso); }
    const off: Vec3 = [anchor[0] - chest[0] + ch[LC.side].x + 0.004 * sway * Math.sin(t * 1.3 + 0.6), anchor[1] - chest[1] + ch[LC.up].x + 0.003 * sway * Math.sin(t * 2.1), anchor[2] - chest[2] + ch[LC.fwd].x - pump];   // (chest-relative from here on)
    if (this.rlc.k > 0) { const k = this.rlc.k, at = this.rlRow().at; off[0] += (at[0] - off[0]) * k; off[1] += (at[1] - off[1]) * k; off[2] += (at[2] - off[2]) * k; }   // (GUN HAND: the reload carry's own point)
    { const py = lerp(LONG_PIVOT[1], anchor[1] - chest[1], kA), pz = lerp(LONG_PIVOT[2], anchor[2] - chest[2], kA);   // the swing's pivot: between the shoulders … the gun shoulder itself
      const th = this.aimPitch * ch[LC.aimK].x, ry = off[1] - py, rz = off[2] - pz;                       // about it: up with the muzzle raised, down and back with it lowered
      off[1] = py + ry * Math.cos(th) + rz * Math.sin(th); off[2] = pz - ry * Math.sin(th) + rz * Math.cos(th);
      const ph = -0.35 * this.aimPitch * a, oy = off[1], oz = off[2];                                       // less the twist's tilt of the whole trunk about the chest joint
      off[1] = oy * Math.cos(ph) + oz * Math.sin(ph); off[2] = -oy * Math.sin(ph) + oz * Math.cos(ph); }
    let pR: Vec3 = v3.add(chest, off);
    if (dipK > 0) { pR[1] -= MV2.dip.down * dipK; pR[2] -= MV2.dip.back * dipK; }
    if (rcl) { if (mvs.back > 1e-5) pR = v3.mad(pR, d, -mvs.back); } else if (kick > 0) pR = v3.mad(pR, d, -LONG_KICK_BACK * kick);
    const poleR: Vec3 = [ch[LC.elbowR].x, ch[LC.elbowR + 1].x, ch[LC.elbowR + 2].x], poleL: Vec3 = [ch[LC.elbowL].x, ch[LC.elbowL + 1].x, ch[LC.elbowL + 2].x], pw = clamp(ch[LC.poleW].x, 0, 1);
    if (mvOn('gait')) {   // MOVES: the elbows by training, shouldered — a drilled man's tucked in under the gun, an untrained man's firing elbow winged out level with the shoulder
      const tw = smoothstep(0.5, 1, this.trained) * a, uw = (1 - smoothstep(0, 0.5, this.trained)) * a, Gt = MV.gait;
      poleR[0] += Gt.elbowIn * tw; poleL[0] -= Gt.elbowIn * 0.8 * tw; poleR[1] += Gt.wing * uw; poleR[0] -= 0.25 * uw;
    }
    const rL = this.handRot(0, inGun(G.fingers), inGun(G.back));
    const solve = (at: Vec3): Vec3 => {   // → how far the support hand fell short of its point (zero when it reached)
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, at, poleR, pw, rR);
      const pL = v3.add(fk.pos[nd.handR], inGun(G.wrist));   // from where the trigger hand actually got to
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, pL, poleL, pw, rL, true);
      return v3.sub(fk.pos[nd.handL], pL);
    };
    // out of the support arm's reach (the walk's shoulder swung back under a long carriage): the gun comes back to where it can be held — at once, so the hands never
    // part, and let out again over half a second (2/s), so a reach that comes and goes with the stride holds the gun near its most demanding point instead of pumping
    // it the whole way, without one carriage's shortfall riding into the next; and never more than LONG_PULL_MAX — past that the support hand is let fall short of
    // the handguard by the rest (a finger's gap there, sooner than the stock floating a hand off the shoulder)
    // (keep: only the pass whose arms end up on show holds anything over — the pass at the carry while the aim clip is coming up poses against a trunk about to change)
    const P: Vec3 = keep ? this.lg.pull : v3.copy(this.lg.pull); const m = solve(v3.add(pR, P));
    if (v3.len(m) > 5e-4) {   // still short with what is held: take up the rest now (capped), and pose there
      P[0] += m[0]; P[1] += m[1]; P[2] += m[2]; const l = v3.len(P); if (l > LONG_PULL_MAX) { const k = LONG_PULL_MAX / l; P[0] *= k; P[1] *= k; P[2] *= k; }
      solve(v3.add(pR, P));
    } else if (keep) { const k = Math.exp(-2 * dt); P[0] *= k; P[1] *= k; P[2] *= k; }   // reached: let a little out for next frame (short again there, it is taken straight back)
    this.hand(pB, 0, [0.5, 0.55, 0.6, 0.68], 0.35);   // the support hand cupped round the handguard
    if (yieldDoor) { const dl = clamp(this.dp.wL.x, 0, 1), dr = clamp(this.dp.wR.x, 0, 1); blendPose(pA, pB, w * (1 - dl), this.armLOnly, pA); blendPose(pA, pB, w * (1 - dr), this.armROnly, pA); }
    else blendPose(pA, pB, w, this.armsMask, pA);
  }

  /** The wall hold, body half ('wall', weight w — everything below scales with it, so the way in and out is the master spring's), to WALL_POSE's numbers. In
   *  the WALL's frame (n = its normal into the room at anim.wallYaw off the figure's front, tr = along it to his right; 'side' = the way he leads):
   *  - the spine is first blended toward the standing idle's own (joint by joint), which takes the crouch clip's hunch and the walk's shoulder swing / lean out of
   *    whatever is underneath, then MEASURED and put: the chest square to the wall but for a small counter-turn toward the lead side (`chestTurn`; update()
   *    meanwhile scales the controller's idle chest twist off, so nothing but a real aim turns the chest off the wall), the spine's line `lean` off vertical so
   *    seat and shoulder blades both lie on the plaster, a crouch's pelvis tilt taken back at the pelvis; the peek side-bends it toward the edge and takes the
   *    chest turn, the tilt and the head over to its own tuned numbers (WALL_POSE.peek) as it comes in;
   *  - the pelvis is carried back to `back` off the plane (nearer the walking legs on the move), settled a little onto the knees, turned a third of the way
   *    back to flat while the legs are turned to sidle, and shifted along the wall onto the lead foot by the peek;
   *  - the head is turned `gaze` off the normal along the wall toward the lead side (measured from the wall, not the chest — whatever the chest gives, the neck
   *    makes up, within ±80° of it, the controller's peek crane counted in), levelled, chin a touch down, half un-tilted out of a peek's side bend; under the aim
   *    layer it hands back to the aim clip;
   *  - the feet are IK-planted: parked, on the hold's own spots — gathered under him along the wall, heels a hand off it, the lead foot a little forward and
   *    opened the way he looks (crouched: a compact squat, feet under the knees) — and on the move where the turned walk cycle has them, narrowed toward the wall
   *    (`slide`); blended by ground speed, swept across (with a small lift) when the side flips, and never through the face. */
  private wallBody(w: number) {
    const pA = this.pA, pC = this.pC, nd = this.nodes, fk = this.fk, ws = this.wst, P = WALL_POSE, K = P.peek;
    const cr = clamp(this.crouch, 0, 1), s = clamp(ws.side.x, -1, 1), pk = clamp(ws.peek.x, 0, 1), e = pk * pk * (3 - 2 * pk);
    const park = clamp(ws.park.x, 0, 1);                                            // 1 parked … 0 sidling (by ground speed, eased: update())
    const aimW = this.upperW.aim;
    const ny = this.wallYaw; const n: Vec3 = [Math.sin(ny), 0, Math.cos(ny)], tr: Vec3 = [-n[2], 0, n[0]];   // wall normal (into the room) and his right along the wall, model space
    // ---- what is underneath: the clip's feet (targets on the move, and what the parked spots blend from)
    fk.run(pA);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    // ---- 1. spine toward the standing idle's, joint by joint (a rotation blend, so at w it is part way there — not a snap)
    pC.copy(this.rest); sampleClip(this.clips.Idle_Loop, this.idleT, true, pC);
    for (const [i, k] of [[nd.spine1, 0.9], [nd.spine2, 0.9], [nd.spine3, 0.9], [nd.neck, 0.85], [nd.head, 0.85], [nd.shoulderL, 0.7], [nd.shoulderR, 0.7]] as [number, number][])
      pA.setRot(i, quat.nlerp(pA.rot(i), pC.rot(i), k * w));
    // ---- 2. pelvis: a third of the way back to flat under turned legs, back onto the wall, down a little, and along the wall onto the lead foot in a peek
    if (park > 0.995 || w < 0.01) this.wallGait = WALL_GAIT_REST;                   // (parked whole: the step clock back to rest, unseen — the spots have the feet)
    const G = P.gait, gShare = WALLSNAP.on && WALLSNAP.pose ? lerp(G.share[0], G.share[1], cr) : 0, gw = gShare * (1 - park) * w;   // the sidle's own step: its share of the feet, and of the pelvis on the move
    if (gw > 1e-4) {   // (under its own step the pelvis is carried, not rocked by a cycle the feet no longer follow: the idles' own pelvis, standing ↔ crouched)
      const pB = this.pB; pB.copy(this.rest); sampleClip(this.clips.Crouch_Idle_Loop, this.idleT, true, pB);
      pA.setRot(nd.hips, quat.nlerp(pA.rot(nd.hips), quat.nlerp(pC.rot(nd.hips), pB.rot(nd.hips), cr), gw));
    }
    fk.run(pA);
    const hips = fk.pos[nd.hips];
    const backOff = lerp(lerp(P.back[0], P.back[1], cr), P.back[2], 1 - park);       // hips joint off the plane
    const out = v3.dot(hips, n) - (-WALL_ROOT_OFF + backOff);                        // + = further out in the room than wanted
    const drop = lerp(P.drop[0], P.drop[1], cr) + 0.006 * (1 - park) * (1 - gShare) * (1 - Math.cos(this.phase * 4 * Math.PI)) + WALLSNAP.dip * this.wallHit;   // (a touch of bob on the move, twice a cycle)
    this.shift(pA, nd.hips, v3.add(v3.add(v3.scale(n, -out * w), [0, -drop * w, 0]), v3.scale(tr, s * K.shift * e * w)));
    if (gw > 1e-4) {   // …level at the step's own height, dipping at each double support, and no sway along the wall
      const lvl = lerp(G.hips[0], G.hips[1], cr) - lerp(G.bob[0], G.bob[1], cr) * 0.5 * (1 + Math.cos((this.wallGait - 0.05) * 4 * Math.PI));
      this.shift(pA, nd.hips, v3.add([0, (lvl - hips[1]) * gw, 0], v3.scale(tr, -v3.dot(hips, tr) * gw)));
    }
    this.turn(pA, nd.hips, quat.mul(quat.axisAngle(n, s * 3 * DEGR * e * w), qYaw(ny * 0.33 * w)));   // (about n: + tips the pelvis toward his right)
    // ---- 3. the spine measured and put, twice over (the three corrections nudge one another): the chest's facing to n but for the counter-turn toward the lead
    //         side (the peek's own turn toward the edge taking over as it comes in), less whatever of the controller's chest twist is still to be applied after
    //         this pose while the hold is part way in (an aim's share is left to turn the chest) — then the spine's line to `lean` toward the room (the peek's
    //         tilt taking over) and to the peek's side bend
    const chestYawOf = () => { const l = quat.rotate(quat.mul(fk.rot[nd.spine3], this.chestRestInv), AX); return Math.atan2(-l[2], l[0]); };   // yaw of the chest's own left axis: 0 = square to the figure's front, + = turned to its left
    const shoulderYawOf = () => { const a = fk.pos[nd.upperArmL], b = fk.pos[nd.upperArmR]; return Math.atan2(b[2] - a[2], a[0] - b[0]); };     // the same yaw read through the two shoulder joints: what the camera sees of 'parallel to the wall', the clips' uneven clavicles counted in
    const axN: Vec3 = [n[2], 0, -n[0]];   // up × n: + about it bows toward the room (about n itself: + tips toward his right)
    let hipShare = 0;
    const twist = this.aimYawOffset * (1 - w * (1 - aimW));   // the chest twist update() will still apply after this pose: the hold scales the controller's idle twist off (an aim's share stays)
    const turnDeg = lerp(P.chestTurn, K.turn, e), leanDeg = lerp(lerp(P.lean[0], P.lean[1], cr), K.tilt, e), gazeDeg = lerp(P.gaze, K.gaze, e);   // toward side / toward the room / toward side: the hold's own, handed to the peek's as it comes in
    for (let pass = 0; pass < 2; pass++) {
      fk.run(pA);
      const dy = wrapAngle(ny - s * turnDeg * DEGR - (twist - this.aimYawOffset * aimW) - lerp(shoulderYawOf(), chestYawOf(), e)) * w;   // (yaw − = toward his right; side + = leads right; the hold squares the SHOULDER LINE to the wall, the peek was tuned on the chest's facing; the aim's share is the aim's to turn the chest with)
      this.turn(pA, nd.spine1, qYaw(dy * 0.3)); this.turn(pA, nd.spine2, qYaw(dy * 0.35)); this.turn(pA, nd.spine3, qYaw(dy * 0.35));
      fk.run(pA);
      const d = v3.sub(fk.pos[nd.neck], fk.pos[nd.spine1]);
      const tiltN = Math.atan2(v3.dot(d, n), d[1]), tiltT = Math.atan2(v3.dot(d, tr), d[1]);   // toward the room / toward his right, off vertical
      const dN = (leanDeg * DEGR - tiltN) * w, dT = (s * K.lean * DEGR * e - tiltT) * w;   // (peeking, the chest comes round pivoting on the look-side shoulder blade: it rolls ON the wall, so the spine comes off it a hand)
      const hs = clamp(dN, -0.45 * cr - hipShare, 0.45 * cr - hipShare); hipShare += hs;   // a crouch clip's forward pelvis tilt comes back AT the pelvis (up to ~25° in all): the back un-rounds from the bottom, not by arching the lumbar
      if (Math.abs(hs) > 1e-5) this.turn(pA, nd.hips, quat.axisAngle(axN, hs));
      const rest = dN - hs;
      this.turn(pA, nd.spine1, quat.mul(quat.axisAngle(n, dT * 0.5), quat.axisAngle(axN, rest * 0.6)));
      this.turn(pA, nd.spine2, quat.mul(quat.axisAngle(n, dT * 0.3), quat.axisAngle(axN, rest * 0.4)));
      this.turn(pA, nd.spine3, quat.axisAngle(n, dT * 0.2));
    }
    // ---- 4. head: gaze along the wall toward side, from the wall (whatever the chest gives, the neck makes up — within ±80° of the chest, the controller's crane
    //         counted in), level, chin down a touch; the peek's own yaw and half un-tilted out of its side bend in a peek; handed to the aim clip under the aim layer
    fk.run(pA);
    { const hw = w * (1 - aimW);
      const g = quat.rotate(fk.rot[nd.head], this.gazeLocal); const gy = Math.atan2(g[0], g[2]);
      const chestYaw = chestYawOf();
      let want = ny - s * gazeDeg * DEGR - twist;   // (whatever chest twist is still to come turns the head with it; lookYawExtra cranes the neck on top — the controller's peek)
      const lk = this.lookYawExtra; want = chestYaw - lk + clamp(wrapAngle(want + lk - chestYaw), -80 * DEGR, 80 * DEGR);   // a neck turns ~80° off the chest, crane included
      const dyaw = wrapAngle(want - gy) * hw;
      const el = Math.asin(clamp(g[1], -1, 1)); const dpitch = (el + (P.headPitch - WALLSNAP.nod * this.wallHit) * DEGR) * hw;   // + = look further down
      const gh = v3.normalize([g[0], 0, g[2] + 1e-6]); const axP: Vec3 = [gh[2], 0, -gh[0]];  // up × gaze: + about it nods down
      const unroll = -s * K.lean * DEGR * e * 0.5 * hw;
      const q = (k: number) => quat.mul(quat.axisAngle(n, unroll * k), quat.mul(qYaw(dyaw * k), quat.axisAngle(axP, dpitch * k)));
      this.turn(pA, nd.neck, q(0.4)); this.turn(pA, nd.head, q(0.6)); }
    // ---- 5. feet: parked, the hold's own spots (lead = the side foot); on the move the clip's, narrowed toward the wall; blended by `park`; a flip of side sweeps
    //         them across with a lift; the face stops a heel either way
    const F = P.feet, I = this.idleFeet; const u = (1 + s) / 2;   // u: 1 = the right foot leads (side + = his right)
    const spot = (lead: boolean, right: boolean): { p: Vec3; yaw: number } => {   // parked spot in the wall frame for one role of one foot: `a` is authored toward the side this role implies for it
      const a = v3.lerp(lead ? F.lead : F.trail, lead ? F.leadCrouch : F.trailCrouch, cr); const sg = right === lead ? 1 : -1;   // the right foot leads when side is +1 and trails when it is −1 (the left, the reverse)
      return { p: v3.add(v3.scale(tr, sg * a[0]), v3.scale(n, a[1] - WALL_ROOT_OFF)), yaw: -sg * a[2] * DEGR };             // (tr = his right; yaw + = toes to his left)
    };
    const mv = (1 - park) * w * (1 - gShare);   // the sidle's share: how much the narrowing applies (the hold's own step keeps its own tracks)
    // the hold's own step (WALL_POSE.gait): where this sole is on its track at the step clock's phase, its rotation, and where its knee points
    const gaitFoot = (right: boolean, rIdle: Quat, yIdle: number): { p: Vec3; r: Quat; pole: Vec3 } => {
      const S = lerp(G.step[0], G.step[1], cr), D = G.duty, half = D * S, f = (this.wallGait + (right ? 0.5 : 0)) % 1;
      let a: number, up = 0;
      if (f < D) a = half * (1 - 2 * f / D);                           // down: carried back under him at the ground's own speed
      else { const q = (f - D) / (1 - D), q2 = q * q, q3 = q2 * q, m = -2 * S * (1 - D);   // up: back to the front, leaving and landing at the ground's speed (a Hermite between the two ends of the stance)
        a = (2 * q3 - 3 * q2 + 1) * -half + (q3 - 2 * q2 + q) * m + (-2 * q3 + 3 * q2) * half + (q3 - q2) * m; up = Math.sin(Math.PI * q); }
      const heel = lerp(G.heel[0], G.heel[1], cr) * DEGR * smoothstep(0.1, 1, -a * clamp(s * 2, -1, 1) / half);   // (the heel comes up as the sole trails behind the way he goes; eased through a flip of side)
      const lw = right ? u : 1 - u, off = lerp(lerp(G.far[0], G.far[1], cr), lerp(G.near[0], G.near[1], cr), lw);
      const yawAbs = ny - s * lerp(G.toe[0], G.toe[1], cr) * DEGR * (0.5 + 0.5 * lw), h: Vec3 = [Math.sin(yawAbs), 0, Math.cos(yawAbs)];
      const BALL = 0.12;                                               // ankle → ball of the foot along the sole (m): the heel rises about the ball
      const al = a + s * lerp(G.ahead[0], G.ahead[1], cr) + (right ? 1 : -1) * lerp(G.apart[0], G.apart[1], cr);   // (its own side of him: the lead foot reaches, the other closes up and does not pass)
      const p: Vec3 = [tr[0] * al + n[0] * (off - WALL_ROOT_OFF) + h[0] * BALL * (1 - Math.cos(heel)), yIdle + lerp(G.lift[0], G.lift[1], cr) * up + BALL * Math.sin(heel), tr[2] * al + n[2] * (off - WALL_ROOT_OFF) + h[2] * BALL * (1 - Math.cos(heel))];
      const fwd = quat.rotate(rIdle, AY), yaw0 = Math.atan2(fwd[0], fwd[2]);
      const r = quat.normalize(quat.mul(quat.axisAngle([h[2], 0, -h[0]], heel), quat.mul(qYaw(wrapAngle(yawAbs - yaw0)), rIdle)));
      const kr = lerp(G.kneeRoom[0], G.kneeRoom[1], cr), d = v3.normalize([n[0] * kr, 0, (1 - kr) + n[2] * kr]);   // the knee: from the legs' own facing (model +z) toward square-out
      return { p, r, pole: v3.normalize([h[0] * 0.25 + d[0] * 0.75, 0.5, h[2] * 0.25 + d[2] * 0.75]) };
    };
    const gL = gShare > 0 ? gaitFoot(false, I.rL, I.L[1]) : null, gR = gShare > 0 ? gaitFoot(true, I.rR, I.R[1]) : null;
    const footTarget = (right: boolean, fClip0: Vec3, rClip0: Quat, rIdle: Quat, yIdle: number, full = false): { p: Vec3; r: Quat } => {
      const gf = right ? gR : gL, gk = gf ? gShare * w : 0;           // (the cycle's sole, or by its share the hold's own step's)
      const fClip = gf ? v3.lerp(fClip0, gf.p, gk) : fClip0, rClip = gf ? quat.nlerp(rClip0, gf.r, gk) : rClip0;
      const lw = right ? u : 1 - u;                                     // how much this foot is the lead foot right now
      const L = spot(true, right), T = spot(false, right);
      const p = v3.lerp(T.p, L.p, lw); const yawRel = lerp(T.yaw, L.yaw, lw);
      const onToes = cr * (1 - lw) * F.trailHeel;                      // the crouched trail foot keeps a share of the crouch clip's raised heel (his weight is back on the wall); a lead foot, and any standing foot, is flat (the idle's sole)
      p[1] = lerp(yIdle, fClip[1], onToes) + 0.04 * (1 - s * s) * ((ws.side.v > 0) === right ? 1 : 0.25) + 0.08 * park * (1 - park) * (0.4 + 0.6 * lw);   // (mid-flip: the foot about to lead steps, the other shuffles; settling onto the spots from the cycle: a low step, the lead foot's the clearer)
      const base = quat.nlerp(rIdle, rClip, onToes);
      const fwd = quat.rotate(base, AY); const yaw0 = Math.atan2(fwd[0], fwd[2]);   // the foot bone's +Y runs heel → toes
      const r = quat.normalize(quat.mul(qYaw(wrapAngle(ny + yawRel - yaw0)), base));
      const k = full ? 1 : park * (this.wtkHold ? 1 : w);
      let q = v3.lerp(fClip, p, k);
      if (mv > 1e-4) { const offC = v3.dot(q, n) + WALL_ROOT_OFF; q = v3.mad(q, n, (P.slide.line + (offC - WALL_ROOT_OFF) * P.slide.narrow - offC) * mv); }   // sidling: the footfall pulled toward the slide line — across the wall only, its travel along it untouched
      const into = -WALL_ROOT_OFF + 0.11 - v3.dot(q, n);                          // the wall stops a heel: a footfall of the turned cycle that would swing through the face slides along it instead (ankle ≥ 11 cm proud: the heel is 6 behind it)
      return { p: into > 0 ? v3.mad(q, n, into * w) : q, r: quat.nlerp(rClip, r, k) };
    };
    if (this.wallTake >= 0 && this.wallTake < 1) this.wtkHold = true; else if (this.wtkHold && (w >= 0.98 || this.stance !== 'wall')) this.wtkHold = false;   // (a short take ends before the pose's weight is whole: the soles stay where they stepped to)
    const tL = footTarget(false, fL, rL, I.rL, I.L[1]), tR = footTarget(true, fR, rR, I.rR, I.R[1]);
    if (this.wallTake >= 0 && this.wallTake < 1) {   // WALLSNAP — the take: each sole stays where it stood in the WORLD (the body gliding and turning over it) until its turn, then steps to the hold's spot in a low arc — the far one first, the other closing as the back lands; never left further behind than a leg reaches
      const tk = this.wallTake, cy = Math.cos(this.bodyYawIn), sy = Math.sin(this.bodyYawIn), P0 = this.posIn;
      const toWorld = (m: Vec3): Vec3 => [P0[0] + m[0] * cy + m[2] * sy, P0[1] + m[1], P0[2] - m[0] * sy + m[2] * cy];
      const footYaw = (r: Quat) => { const f = quat.rotate(r, AY); return Math.atan2(f[0], f[2]); };
      const sL = footTarget(false, fL, rL, I.rL, I.L[1], true), sR = footTarget(true, fR, rR, I.rR, I.R[1], true);
      if (!this.wtk || tk < this.wtk.last) this.wtk = { L: this.wallTakeFeet?.L ?? { p: toWorld(fL), yaw: this.bodyYawIn + footYaw(rL) }, R: this.wallTakeFeet?.R ?? { p: toWorld(fR), yaw: this.bodyYawIn + footYaw(rR) }, first: v3.distXZ(fL, sL.p) >= v3.distXZ(fR, sR.p) ? 0 : 1, last: tk };
      const K = this.wtk; K.last = tk;
      const step = (a: { p: Vec3; yaw: number }, sp: { p: Vec3; r: Quat }, rClip: Quat, t0: number, t1: number, out: { p: Vec3; r: Quat }) => {
        const q = clamp((tk - t0) / (t1 - t0), 0, 1), e = q * q * (3 - 2 * q);
        const m = this.toModelP(a.p); const dx = m[0] - sp.p[0], dz = m[2] - sp.p[2], dl = Math.hypot(dx, dz), mx = WALLSNAP.stepTrail;
        if (t0 > 0 && dl > mx) { m[0] = sp.p[0] + dx * mx / dl; m[2] = sp.p[2] + dz * mx / dl; }   // (the foot still WAITING is dragged once the body has left it a leg's reach behind; the one already stepping flies from where it stood)
        out.p = v3.lerp(m, sp.p, e); out.p[1] += WALLSNAP.stepLift * Math.sin(Math.PI * q);
        out.r = quat.nlerp(quat.normalize(quat.mul(qYaw(wrapAngle(a.yaw - this.bodyYawIn - footYaw(rClip))), rClip)), sp.r, e);
      };
      const A: [number, number] = [0, 0.58], B: [number, number] = [0.42, 1];   // (the further foot goes at once — a half turn has it a metre to travel — the other waits, then closes as the back lands)
      step(K.L, sL, rL, ...(K.first === 0 ? A : B), tL); step(K.R, sR, rR, ...(K.first === 1 ? A : B), tR);
    } else if (this.wtk) this.wtk = null;
    fk.run(pA);
    const poleOf = (t: { r: Quat }, gf: { pole: Vec3 } | null): Vec3 => gf && gw > 1e-4 ? v3.normalize(v3.lerp(this.kneePole(t.r), gf.pole, gw)) : this.kneePole(t.r);
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tL.p, poleOf(tL, gL), 0.6, tL.r);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tR.p, poleOf(tR, gR), 0.6, tR.r, true);
  }

  /** The wall hold, arms (weight w through the arms mask), against the body wallBody left. The hands are always free here (the game holsters the pistol for the
   *  hold): both palms flat back against the wall 'feeling' it, a little behind the body line either side of the hips at hip height — the wrists IK'd ONTO the
   *  plane WALL_POSE.hands.off proud of it, ± hands.along from the hips joint, so they slide along the plaster with him and go with a peek's carried pelvis —
   *  fingers down and a little out along the wall, spread flat; elbows soft, poled out along the wall and a touch into the room (never into it) — with the mend (`WALL_POSE.mend`) the fingers together, the arms hanging, the elbows poled back toward the wall. The two arms are
   *  one description mirrored, so a flip of side moves nothing; a peek draws the lead hand in a little (hands.peekIn) so its palm stays on the plaster short of
   *  the corner he leans past. Solved from the arms as the locomotion has them (clavicles and all), so the way in and out is a plain blend. */
  private wallArms(w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, ws = this.wst, P = WALL_POSE, H = P.hands, E = P.elbow;
    const cr = clamp(this.crouch, 0, 1), s = clamp(ws.side.x, -1, 1), pk = clamp(ws.peek.x, 0, 1), e = pk * pk * (3 - 2 * pk);
    const ny = this.wallYaw; const n: Vec3 = [Math.sin(ny), 0, Math.cos(ny)], tr: Vec3 = [-n[2], 0, n[0]];   // wall normal (into the room) and his right along the wall, model space
    pB.copy(pA); fk.run(pB);
    const M = WALLSNAP.on && WALLSNAP.pose ? P.mend : null;   // (the mend: the wrists down beside the hips, so the arms hang instead of folding)
    const hips = fk.pos[nd.hips]; const hx = hips[0], hy = hips[1] + (M ? lerp(M.up[0], M.up[1], cr) : lerp(H.up, H.upCrouch, cr)), hz = hips[2];
    const along0 = M ? lerp(M.along[0], M.along[1], cr) - M.sway * Math.cos(this.wallGait * 2 * Math.PI) * (1 - clamp(ws.park.x, 0, 1)) * lerp(P.gait.share[0], P.gait.share[1], cr) : lerp(H.along, H.alongCrouch, cr);   // (on the hold's own step the palms slide a little apart and together with the feet)
    const EO = M ? M.elbow : E, splay = M ? M.splay : H.out;
    for (const side of [0, 1] as const) {   // 0 = left, 1 = right
      const sg = side ? 1 : -1;              // tr is his right: the right hand goes +tr, the left −tr
      const along = along0 - H.peekIn * e * (side ? 1 + s : 1 - s) / 2;   // (the lead side's hand — the right's share of leading is (1 + s) / 2 — comes in with the peek)
      const p: Vec3 = [hx + tr[0] * sg * along, hy, hz + tr[2] * sg * along];
      const onto = (-WALL_ROOT_OFF + H.off) - v3.dot(p, n); p[0] += n[0] * onto; p[2] += n[2] * onto;   // carried square onto the plane, the wrist `off` proud of it (the palm lies on the face)
      const r = this.handRot(side, [tr[0] * sg * splay, -1, tr[2] * sg * splay], n);                    // fingers down and out along the wall, back of the hand to the room
      const pole: Vec3 = [tr[0] * sg * EO.out + n[0] * EO.room, -EO.down, tr[2] * sg * EO.out + n[2] * EO.room];
      if (side) twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, p, pole, 0.9, r); else twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, pole, 0.9, r);
      if (M) { this.hand(pB, side, M.curl, M.thumb, M.fan);     // (mended: a resting hand laid back on the wall, fingers together…
        this.turn(pB, this.thumbs[side][0], quat.axisAngle(quat.rotate(fk.rot[side ? nd.handR : nd.handL], AY), sg * M.thumbIn * DEGR)); }   // …the thumb beside the index, out of the plaster)
      else this.hand(pB, side, [0.05, 0.06, 0.08, 0.12], 0.1, 0.5);   // flat and a little spread on the wall
    }
    blendPose(pA, pB, w, this.armsMask, pA);
  }

  /** The kick, body half (arms are carryArms' business): pelvis shift / dip / drive / lean-back / counter-yaw / hike as overlapping curves, spine and head
   *  counter so the eyes stay on the door, right foot flown along a chamber → strike → recoil → plant path by IK (knee up and forward), left foot IK-held from
   *  the first frame with its sole flat. Every curve starts at zero and both foot targets start where the feet are, so the layer goes in at full weight with
   *  no fade (nothing under it can slide); it is eased off over the last 0.2 s, by when it has brought everything back onto the idle. Feet: the support foot
   *  is held where the kick found it and — if that is not the idle's spot (taken from a walk or a crouch) — set down on it in one short step while the other
   *  knee comes up; the swing foot's path starts from its own spot and lands on the idle's, so what the layer hands back is exactly the pose beneath it. The
   *  pelvis rides the door's reaction back so that the landing foot is under the hip, then the weight settles forward again with both soles planted.
   *  kickLeg 'left' is the same kick seen in a mirror: left foot flown, right foot held. */
  private kickBody(t: number, w: number) {
    const pA = this.pA, pC = this.pC, nd = this.nodes, fk = this.fk, F = this.idleFeet;
    // the mirror (kickLeg 'left'): m flips every lateral offset, yaw and roll below (a product with 1 is exact, so the right-leg kick computes bit for bit what it
    // always did), and the swing / planted legs and their idle spots swap sides
    const left = this.kickLeg === 'left'; const m = left ? -1 : 1;
    const [thS, shS, ftS] = left ? [nd.thighL, nd.shinL, nd.footL] : [nd.thighR, nd.shinR, nd.footR];   // the swing leg…
    const [thP, shP, ftP] = left ? [nd.thighR, nd.shinR, nd.footR] : [nd.thighL, nd.shinL, nd.footL];   // …and the planted one
    fk.run(pA);
    const K = this.kickFrom ??= { L: v3.copy(fk.pos[nd.footL]), rL: [...fk.rot[nd.footL]] as Quat, R: v3.copy(fk.pos[nd.footR]), rR: [...fk.rot[nd.footR]] as Quat };
    const FS = left ? F.L : F.R, FSr = left ? F.rL : F.rR, FP = left ? F.R : F.L, FPr = left ? F.rR : F.rL;   // idle spots / sole rotations: swing, planted
    const KS = left ? K.L : K.R, KP = left ? K.R : K.L, KPr = left ? K.rR : K.rL;                              // where the kick found them
    pC.copy(pA);
    // pelvis: onto the standing leg (left, +X — mirrored: right, −X), a small dip, drive through, lean back against the leg's mass, swing hip forward, swing side
    // hiked; after the hit it is carried back (~12 cm behind its idle spot at the plant: the landing heel is under the hip) and comes forward again as the weight is shared out
    const sx = m * curve(t, [[0, 0], [0.22, 0.05], [0.5, 0.045], [KICK_PLANT, 0.03], [1.0, 0]]);
    const sy = curve(t, [[0, 0], [0.2, -0.02], [0.38, -0.01], [0.55, -0.02], [KICK_PLANT, -0.03], [1.0, 0]]);
    const sz = curve(t, [[0, 0], [0.16, -0.015], [0.38, 0.09], [0.46, 0.04], [0.6, -0.06], [KICK_PLANT, -0.12], [0.86, -0.07], [1.0, 0]]);
    const tilt = curve(t, [[0, 0], [0.16, 4], [0.4, -19], [0.56, -9], [KICK_PLANT, -2], [0.86, 1.5], [1.0, 0]]) * DEGR;   // + = forward: crunch into the chamber, lay back against the drive, sit back onto the plant, settle
    const hyaw = m * curve(t, [[0, 0], [0.2, -3], [0.4, 9], [0.6, 4], [0.9, 0]]) * DEGR;                                 // + = right hip forward (the swing hip: mirrored, the left)
    const roll = m * curve(t, [[0, 0], [0.25, -5], [0.5, -4], [KICK_PLANT, -1], [0.9, 0]]) * DEGR;                        // − = right side of the pelvis up (the swing side: mirrored, the left)
    this.shift(pC, nd.hips, [sx, sy, sz]);
    this.turn(pC, nd.hips, quat.mul(qYaw(hyaw), quat.mul(qRoll(roll), qPitch(tilt))));
    // spine: a little more lay-back at the strike low down, shoulders squared against the hip yaw, head back onto the door
    const lay = curve(t, [[0, 0], [0.2, 3], [0.39, -8], [0.47, -3.5], [0.6, -2.5], [0.85, 0]]) * DEGR;   // the jolt of the hit comes back up the spine
    this.turn(pC, nd.spine1, quat.mul(qYaw(-hyaw * 0.3), quat.mul(qRoll(-roll * 0.4), qPitch(lay)))); this.turn(pC, nd.spine2, quat.mul(qYaw(-hyaw * 0.3), quat.mul(qRoll(-roll * 0.4), qPitch(lay * 0.7))));
    this.turn(pC, nd.spine3, qYaw(-hyaw * 0.2));
    this.turn(pC, nd.neck, qPitch(-(tilt + lay * 1.7) * 0.45)); this.turn(pC, nd.head, qPitch(-(tilt + lay * 1.7) * 0.55));
    fk.run(pC);
    // swing foot (the right; mirrored, the left): model-space path = a moving origin (its own spot → the idle's over the chamber; the same point when kicked from
    // the idle) + offsets: forward and up under the rising knee from the first frame (no hanging back), strike ~0.86 m up / 0.75 m ahead of the root, recoil, plant on the idle's spot
    const o = v3.lerp(KS, FS, smoothstep(0, 0.3, t)); const down = t < KICK_PLANT ? 1 : 0;   // (past the plant the offsets are exactly zero: the trailing phantom keys only shape the arrival, which is firm, not eased)
    const cx = -0.07 * m - FS[0];   // the drive comes in toward the centre line from the (wide, turned-out) idle spot: 7 cm short of it on the swing leg's own side
    const ox = down * curve(t, [[0, 0], [0.12, cx * 0.15], [0.26, cx * 0.6], [0.38, cx], [0.5, cx * 0.8], [0.64, cx * 0.3], [KICK_PLANT, 0], [1.0, 0]]);
    // up + out in three pieces: chamber (spline; the phantom key past 0.26 only sets the hand-off slope), drive (Hermite that ARRIVES fast: ~9 m/s into the
    // door, levelling off into a horizontal thrust), and from the impact on (spline starting at rest: ~50 ms on the door as it gives, recoil, re-plant)
    const TC = 0.26, TI = KICK_IMPACT;
    const oy = down * (t < TC ? curve(t, [[0, 0], [0.08, 0.03], [0.17, 0.14], [TC, 0.4], [0.32, 0.635]]) : t < TI ? hermite(t, TC, 0.4, 3.3, TI, 0.76, 0.5)
      : curve(t, [[TI, 0.76], [0.43, 0.75], [0.5, 0.58], [0.62, 0.24], [KICK_PLANT, 0], [1.0, 0]]));
    const oz = down * (t < TC ? curve(t, [[0, 0], [0.1, 0.04], [0.17, 0.13], [TC, 0.3], [0.32, 0.745]]) : t < TI ? hermite(t, TC, 0.3, 4.1, TI, 1.02, 9)
      : curve(t, [[TI, 1.02], [0.43, 1.0], [0.5, 0.68], [0.62, 0.26], [KICK_PLANT, 0], [1.0, 0]]));
    // the idle stands left foot forward: kicked off that (lead) leg the same offsets would meet the door a foot's length early and deep. So the mirrored swing is
    // drawn back by the feet's stagger through the chamber and the drive — the knee comes up and BACK, the sole meets the leaf the same 0.75 m ahead of the root
    // the rear-leg kick does — and let out again for the plant on its own (forward) spot. Exactly 0 for the right leg: nothing it computes changes.
    const lead = left ? F.L[2] - F.R[2] : 0;
    const target: Vec3 = [o[0] + ox, Math.max(o[1] + oy, FS[1]), o[2] + oz - lead * bump(t, 0, TC, 0.5, KICK_PLANT)];
    const kneeUp: Vec3 = [-0.04 * m, 0.5, 1];   // knee points up-and-ahead through the swing
    twoBoneIK(fk, pC, thS, shS, ftS, target, kneeUp, bump(t, 0.04, 0.2, 0.62, 0.8), null);
    // ankle: toes drop as the knee comes up, heel drives through the door, relax (about the foot's own hinge — the rig's two feet share the hinge's sense, so the
    // same angles serve the mirror); then the sole is levelled onto the idle's for the plant
    rotateLocal(pC, ftS, quat.axisAngle(AX, curve(t, [[0, 0], [0.2, 14], [0.34, -16], [0.42, -18], [0.58, 4], [0.68, 0]]) * DEGR));
    const flat = smoothstep(0.6, KICK_PLANT, t);
    if (flat > 0) setModelRot(pC, ftS, quat.nlerp(quat.mul(fk.rot[shS], pC.rot(ftS)), FSr, flat), fk.rot[shS]);
    // planted foot (the left; mirrored, the right): held from the first frame; if the kick found it off the idle's spot it is set down there in one short low step (0–0.24 s) and stays
    const e = smoothstep(0, 0.24, t); const far = clamp(hyp2(KP[0] - FP[0], KP[2] - FP[2]) / 0.2, 0, 1);
    const pin = v3.lerp(KP, FP, e); pin[1] += 0.05 * Math.sin(Math.PI * e) * far;
    fk.run(pC);
    twoBoneIK(fk, pC, thP, shP, ftP, pin, this.kneePole(FPr), 0.6 * smoothstep(0, 0.15, t), quat.nlerp(KPr, FPr, e));
    blendPose(pA, pC, w, null, pA);
  }

  /** Left-hand signals: the gesture arm is IK-posed against the current body each frame (so the hand holds its place by the head while the torso moves) and blended
   *  in with staggered per-segment envelopes — shoulder first, then elbow, then hand — and out the same way, so nothing starts or stops together. */
  private signalLayer(t: number) {
    const kind = this.sigKind, D = SIGNAL_DUR[kind]; const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    if (kind === 'go') {   // body English on the chop: the upper spine goes a few degrees with the hand — left shoulder forward and a touch down, chest tipping into it —
      const ft = curve(t, [[0.22, 0], [0.46, 1], [0.62, 0.5], [0.9, 0]]);   // arriving with the chop (0.46), giving back half while the hand holds, gone before the arm comes down
      if (ft > 1e-3) {
        const q = (k: number) => quat.mul(qYaw(-3.5 * DEGR * ft * k), quat.mul(qRoll(-2 * DEGR * ft * k), qPitch(2.5 * DEGR * ft * k)));
        this.turn(pA, nd.spine2, q(0.4)); this.turn(pA, nd.spine3, q(0.6));
        this.turn(pA, nd.neck, q(-0.3)); this.turn(pA, nd.head, q(-0.4));   // the eyes stay on where the hand is sending people (head keeps ~30 % of the turn)
      }
    }
    pB.copy(pA); fk.run(pB);
    const sh = fk.pos[nd.upperArmL];   // shoulder joint (model)
    let hand: Vec3, handRot: Quat, pole: Vec3, clav = 0, curl: number[], thumb: number, spread = 0;
    // hands are described by where the fingers point and which way the back of the hand faces (handRot)
    if (kind === 'hold') {
      // fist snaps up beside the head, palm forward; tiny settle drift while held
      const settle = 0.006 * Math.sin(t * 5.5) * bump(t, 0.3, 0.4, 0.6, 0.7);
      hand = [sh[0] + 0.14, sh[1] + 0.19 + settle, sh[2] + 0.16]; handRot = this.handRot(0, [0.12, 1, 0.12], [0, 0.05, -1]); pole = [1, -0.4, 0.35]; clav = 8;
      curl = [1, 1, 1, 1]; thumb = 1;
    } else if (kind === 'go') {
      // knife hand comes up by the ear (0 → 0.28), chops over and down to point the way (→ 0.46, overshoot, settle), holds, returns
      const u = t;
      const hx = curve(u, [[0, 0.1], [0.28, 0.1], [0.46, 0.04], [0.95, 0.04]]), hy = curve(u, [[0, 0.2], [0.28, 0.22], [0.36, 0.2], [0.46, -0.02], [0.54, 0.015], [0.95, 0.01]]), hz = curve(u, [[0, 0.1], [0.28, 0.08], [0.38, 0.3], [0.46, 0.43], [0.95, 0.42]]);
      hand = [sh[0] + hx, sh[1] + hy, sh[2] + hz];
      const chop = smoothstep(0.28, 0.46, u);   // fingers: up by the ear → forward and a little down at full chop; palm: facing the head → facing right/down
      handRot = this.handRot(0, v3.lerp([0.1, 1, 0.25], [0.05, -0.18, 1], chop), v3.lerp([1, 0, -0.2], [0.6, 0.8, 0.1], chop)); pole = [1, -0.35, 0.1]; clav = 7 * (1 - 0.6 * chop);
      curl = [0.05, 0.08, 0.12, 0.18]; thumb = 0.3; spread = 0;
    } else if (kind === 'squeeze') {
      // MOVES — the stack's "ready": the hand goes forward onto the shoulder of the man ahead (there by 0.28 s), squeezes twice, and comes back to the fore-end
      const sq = bump(t, 0.3, 0.36, 0.4, 0.47) + bump(t, 0.52, 0.58, 0.62, 0.69);
      hand = [sh[0] - 0.1, sh[1] + 0.04 - 0.012 * sq, sh[2] + 0.5 + 0.008 * sq]; handRot = this.handRot(0, [-0.15, -0.3, 1], [0.1, 1, 0.3]); pole = [0.8, -0.6, -0.1]; clav = 3;
      curl = [0.3 + 0.4 * sq, 0.34 + 0.4 * sq, 0.38 + 0.4 * sq, 0.42 + 0.4 * sq]; thumb = 0.15 + 0.5 * sq; spread = 0.2;
    } else if (kind === 'aside') {
      // "off my line": the open hand comes off the fore-end to chest height in front of him, palm turned the way he wants the man gone, and pushes that way
      // twice (there by 0.36 s and again by 0.72), then goes back to the gun — the gun hand keeps the gun where it was, low. To his own left the arm goes
      // out wide to his side (the camera is overhead: a hand that only turns at the wrist is not seen from there); to his right it sweeps across his front.
      const push = bump(t, 0.22, 0.36, 0.42, 0.56) + bump(t, 0.6, 0.72, 0.78, 0.94);
      if (this.sigSide >= 0) { hand = [sh[0] + 0.02 + 0.4 * push, sh[1] - 0.12 + 0.05 * push, sh[2] + 0.3 - 0.14 * push]; handRot = this.handRot(0, [0.2 + 0.35 * push, 0.8, 0.55], [-1, 0.1, 0.2]); pole = [0.9, -0.7, -0.1]; }
      else { hand = [sh[0] - 0.02 - 0.3 * push, sh[1] - 0.1 + 0.04 * push, sh[2] + 0.36 + 0.04 * push]; handRot = this.handRot(0, [-0.2 - 0.3 * push, 0.8, 0.55], [1, 0.1, 0.2]); pole = [0.8, -0.8, 0]; }
      clav = 3;
      curl = [0.04, 0.06, 0.08, 0.12]; thumb = 0.25; spread = 0.3;
    } else {
      // open hand goes up over the head and circles (≈2.2 Hz, the forearm coning from the elbow), then comes down
      const circ = bump(t, 0.16, 0.32, D - 0.42, D - 0.26); const ph = (t - 0.16) * 2.2 * Math.PI * 2;
      hand = [sh[0] + 0.08 + 0.12 * Math.cos(ph) * circ, sh[1] + 0.36 - 0.02 * circ * (1 - Math.cos(ph * 2)), sh[2] + 0.08 + 0.12 * Math.sin(ph) * circ];
      handRot = this.handRot(0, [0.35 * Math.cos(ph) * circ, 1, 0.1 + 0.35 * Math.sin(ph) * circ], [-0.2, 0, -1]); pole = [1, 0.05, 0.3]; clav = 14;
      curl = [0.1, 0.15, 0.2, 0.3]; thumb = 0.2; spread = 0.6;
    }
    if (clav) this.turn(pB, nd.shoulderL, qRoll(clav * DEGR));   // scapula comes up with a raised arm
    fk.run(pB);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, hand, pole, 0.85, handRot);
    this.hand(pB, 0, curl, thumb, spread);
    // staggered envelopes: in — clavicle/upper arm lead, forearm +50 ms, hand +90 ms; out — same order, the hand trailing last
    const tin = 0.2, tout = 0.26, e = D;
    const seg = (lag: number) => bump(t, lag, lag + tin, e - tout + lag * 0.6 - 0.06, e - 0.06 + lag * 0.6);
    const m = this.dynMask; m.fill(0);
    const wUp = seg(0), wFore = seg(0.05), wHand = seg(0.09);
    m[nd.shoulderL] = wUp; m[nd.upperArmL] = wUp; m[nd.forearmL] = wFore;
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); }; setSub(nd.handL, wHand);
    blendPose(pA, pB, 1, m, pA);
  }
  /** KIT.nv: one frame of a goggle flip over the finished pA. Advances the clip, says where the goggles are (nvShown), poses the left arm at them while the hand
   *  has the job and `free` says nothing else wants it (a hand flip whose arm is taken before the goggles have moved becomes a nod), and tips the head for a
   *  nod: the HEAD joint alone, about the level axis square to his gaze — the joint stays where it is and the way he faces on the plan does not turn, so what the game
   *  reads off his head (where his eye is, which way his gaze goes) is the same with a nod on it. pB is free scratch here. */
  /** A SMOKE's arm (see `smoke`; the numbers are SMOKEARM): the left wrist to a place in front of the mouth, in the head's frame as it will be
   *  DRAWN (the goggle flip's own arithmetic, nvLayer), blended over the arm alone by how far up it has got. pB is scratch. */
  private smokeLayer(dt: number, free: boolean) {
    const K = SMOKEARM, want = this.smoke !== null && free ? clamp(this.smoke, 0, 1) : 0, step = (free ? K.rate : K.away) * dt;
    this.smokeArm += clamp(want - this.smokeArm, -step, step);
    if (this.kit) this.smokeArm = 0;
    if (this.smokeArm <= 0.004) { if (want <= 0) this.smokeArm = 0; return; }
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, x = this.smokeArm, e = x * x * (3 - 2 * x), tw = this.nvTw;
    fk.run(pA);
    const twq = (y: number, p: number): Quat => { let q = quat.yaw(y); if (p !== 0) q = quat.mul(quat.axisAngle(quat.rotate(q, [1, 0, 0]), p), q); return q; };
    const Tn = twq(tw[0], tw[1]), hr = quat.mul(twq(tw[2], tw[3]), quat.mul(Tn, quat.mul(fk.rot[nd.head], this.headRestInv)));
    const nk = fk.pos[nd.neck], hp = v3.add(nk, quat.rotate(Tn, v3.sub(fk.pos[nd.head], nk)));
    const X = quat.rotate(hr, [1, 0, 0]), Y = quat.rotate(hr, [0, 1, 0]), Z = quat.rotate(hr, [0, 0, 1]);
    const inHead = (p: Vec3): Vec3 => [X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2], X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2], X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2]];
    pB.copy(pA); this.turn(pB, nd.shoulderL, qRoll(K.shrug * DEGR)); fk.run(pB);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(hp, inHead(K.at)), K.pole, 0.85, this.handRot(0, inHead(K.fingers), inHead(K.back)));
    this.hand(pB, 0, K.curl, K.thumb);
    const m = this.dynMask; m.fill(0); m[nd.shoulderL] = e; m[nd.upperArmL] = e; m[nd.forearmL] = e;
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); }; setSub(nd.handL, e);
    blendPose(pA, pB, 1, m, pA);
  }
  private nvLayer(dt: number, free: boolean) {
    const n = this.nv!, N = KIT.nv, H = N.hand, O = N.nod;
    if (n.hand && !free && n.t < H.flip[0]) { n.hand = false; n.t = 0; n.c0 = this.nvNod; }   // (c0: what is left of a nod this flip cut short starts its let-go again from where it has got to — kept whole it came back at full size)
    n.t += dt; const D = n.hand ? H.dur : O.dur, fw = n.hand ? H.flip : O.flip;
    this.nvShown = n.k0 + ((n.down ? 1 : 0) - n.k0) * smoothstep(fw[0], fw[1], n.t);
    const want = n.hand && free ? bump(n.t, 0, H.reach, D - H.out, D) : 0, step = (n.hand && free ? H.rate : this.reloadT >= 0 || this.rlT >= 0 || this.dp.wL.x >= 0.05 ? H.clear : H.away) * dt;   // (a magazine change wants the hand NOW: it is clear of the arm before the old magazine leaves the gun — and so does a leaf he walks into)
    this.nvArm += clamp(want - this.nvArm, -step, step);
    if (this.kit) this.nvArm = 0;   // (a kit change starts both hands from where they are DRAWN — kitSwap — so it has taken the arm over whole: easing out on top of it would lift the hand twice)
    if (n.t >= D && this.nvArm < 0.004) { this.nvCancel(); return; }
    if (this.nvArm > 0.004) {
      const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, e = this.nvArm, k = this.nvShown, tw = this.nvTw;
      fk.run(pA);
      // the head as it will be DRAWN: the twists the skeleton applies after the layers (the look, the gaze stabiliser), as last frame had them
      const twq = (y: number, p: number): Quat => { let q = quat.yaw(y); if (p !== 0) q = quat.mul(quat.axisAngle(quat.rotate(q, [1, 0, 0]), p), q); return q; };
      const Tn = twq(tw[0], tw[1]), hr = quat.mul(twq(tw[2], tw[3]), quat.mul(Tn, quat.mul(fk.rot[nd.head], this.headRestInv)));
      const nk = fk.pos[nd.neck], hp = v3.add(nk, quat.rotate(Tn, v3.sub(fk.pos[nd.head], nk)));
      const X = quat.rotate(hr, [1, 0, 0]), Y = quat.rotate(hr, [0, 1, 0]), Z = quat.rotate(hr, [0, 0, 1]);
      const inHead = (p: Vec3): Vec3 => [X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2], X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2], X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2]];
      pB.copy(pA); this.turn(pB, nd.shoulderL, qRoll(H.shrug * DEGR)); fk.run(pB);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(hp, inHead(v3.lerp(H.up, H.down, k))), H.pole, 0.85, this.handRot(0, inHead(H.fingers), inHead(H.back)));
      this.hand(pB, 0, H.curl, H.thumb);
      const m = this.dynMask; m.fill(0); m[nd.shoulderL] = e; m[nd.upperArmL] = e; m[nd.forearmL] = e;
      const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); }; setSub(nd.handL, e);
      blendPose(pA, pB, 1, m, pA);
    }
    const a = n.down ? O.on : O.off;
    const nod = (n.hand ? 0 : (a[0] * bump(n.t, 0, O.pre, O.pre, O.pre * 2) + a[1] * bump(n.t, O.pre, O.peak, O.peak, D)) * DEGR) + n.c0 * (1 - smoothstep(0, O.carry, n.t));
    this.nvNod = nod;   // (posed by update(), right after this — or, in the look under a door, by the look: nvTip)
  }
  /** a goggle nod's tip of the HEAD joint on `pose` (+ = chin down): about the level axis square to where he faces — the head as it will be DRAWN, twists and all,
   *  as nvLayer's arm has it — so the gaze stays in its own upright plane */
  private nvTip(pose: Pose, nod: number, G = this.nvHead(pose)) {
    const hd = this.nodes.head, z = quat.rotate(quat.mul(G, this.headRestInv), [0, 0, 1]), l = Math.hypot(z[0], z[2]);
    const ax: Vec3 = l > 1e-4 ? [z[2] / l, 0, -z[0] / l] : quat.rotate(quat.mul(G, this.headRestInv), [1, 0, 0]);
    pose.setRot(hd, quat.normalize(quat.mul(pose.rot(hd), quat.axisAngle(quat.rotate(quat.conj(G), ax), nod))));
  }
  /** the head joint's rotation on `pose` as it will be DRAWN (the chest's and the aim's twists on top of the pose's own) */
  private nvHead(pose: Pose): Quat {
    const fk = this.fk, tw = this.nvTw; fk.run(pose);
    const twq = (y: number, p: number): Quat => { let q = quat.yaw(y); if (p !== 0) q = quat.mul(quat.axisAngle(quat.rotate(q, [1, 0, 0]), p), q); return q; };
    return quat.mul(twq(tw[2], tw[3]), quat.mul(twq(tw[0], tw[1]), fk.rot[this.nodes.head]));
  }
  /** The idle tells (tell): LEFT arm IK-posed against the body as it stands this frame and blended in shoulder → elbow → hand like the signals, the head (and for
   *  the stretch a little of the upper spine) turned straight into the pose by the same envelope. 'watch': the forearm comes up level across the lower chest, the
   *  wrist turned over so its back faces the eyes, and the gaze goes down onto it (lookAt: neck and head, within a neck's limits); held ~0.6 s. 'neck': the hand
   *  goes round to the back-left of the neck, elbow up and forward, and works up and down it a couple of centimetres at ~2.5 Hz while the chest lifts three
   *  degrees into the stretch and the head tips forward and away; ~1.3 s. The right arm, the legs, the feet's lock and the torch's beam (off the chest heading) are
   *  untouched — it plays over the calm carry, the low ready or the long gun's support hand alike (that hand comes off the fore-end for the second and goes back). */
  private tellLayer(t: number) {
    const kind = this.tellK, D = TELL_DUR[kind]; const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    const tin = kind === 'watch' ? 0.2 : 0.26, tout = kind === 'watch' ? 0.28 : 0.34;
    const env = bump(t, 0, tin, D - tout, D);   // the body's share (head, chest): one smooth window over the whole tell
    if (env <= 1e-4) { this.tellShown = 0; return; }
    fk.run(pA);
    if (kind === 'watch') {
      // the wrist's spot first (off the shoulder as the body has it now), then the eyes onto it: down and a touch left — the authored look the gaze stabiliser leaves alone
      const sh = fk.pos[nd.upperArmL];
      const wrist: Vec3 = [sh[0] - 0.21, sh[1] - 0.21, sh[2] + 0.21];   // (the hand joint IS the wrist: just this side of the breastbone, lower-chest height, a forearm's length ahead)
      this.lookAt(pA, [wrist[0] + 0.03, wrist[1] + 0.02, wrist[2] + 0.01], 0.9 * env);   // …and the eyes onto the watch on the back of it
      pB.copy(pA); fk.run(pB);
      this.turn(pB, nd.shoulderL, qRoll(3 * DEGR * env)); fk.run(pB);
      // forearm level across the chest: fingers to the figure's right and a shade up, the back of the hand turned up toward the face; elbow out to the left and down
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, wrist, [1, -0.55, 0.18], 0.85, this.handRot(0, [-1, 0.14, 0.12], [0.05, 0.9, -0.42]));
      this.hand(pB, 0, [0.35, 0.4, 0.45, 0.5], 0.4);   // a loose half-open hand
    } else {
      // the stretch: chest up a few degrees (spread over the two upper spine joints), the head forward and tipped right, away from the working hand
      this.turn(pA, nd.spine2, qPitch(-1.6 * DEGR * env)); this.turn(pA, nd.spine3, qPitch(-1.8 * DEGR * env));
      this.turn(pA, nd.neck, quat.mul(qPitch(5 * DEGR * env), qRoll(-3 * DEGR * env))); this.turn(pA, nd.head, quat.mul(qPitch(9 * DEGR * env), quat.mul(qRoll(-6 * DEGR * env), qYaw(-4 * DEGR * env))));
      pB.copy(pA); fk.run(pB);
      this.turn(pB, nd.shoulderL, qRoll(12 * DEGR * env)); fk.run(pB);   // the scapula comes up with the raised elbow
      const nk = fk.pos[nd.neck]; const rub = 0.018 * Math.sin((t - tin) * 2 * Math.PI * 2.5) * bump(t, tin, tin + 0.15, D - tout - 0.1, D - tout);
      const hand: Vec3 = [nk[0] + 0.085, nk[1] + 0.035 + rub, nk[2] - 0.075];   // round on the back-left of the neck, working up and down it
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, hand, [0.75, 0.35, 0.8], 0.9, this.handRot(0, [-0.55, 0.35, -0.75], [0.45, 0.55, 0.55]));
      this.hand(pB, 0, [0.5, 0.55, 0.6, 0.65], 0.5);   // fingers curled onto the neck
    }
    // staggered envelopes, as the signals: in — clavicle / upper arm lead, forearm +50 ms, hand +90 ms; out in the same order, the hand trailing
    const seg = (lag: number) => bump(t, lag, lag + tin, D - tout + lag * 0.6 - 0.06, D - 0.06 + lag * 0.6);
    const m = this.dynMask; m.fill(0);
    const wUp = seg(0), wFore = seg(0.05), wHand = seg(0.09);
    m[nd.shoulderL] = wUp; m[nd.upperArmL] = wUp; m[nd.forearmL] = wFore;
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); }; setSub(nd.handL, wHand);
    blendPose(pA, pB, 1, m, pA);
    this.tellShown = wUp;
  }
  /** the held gait for a checkpoint (savestate.ts PlayerSnap.heldGait): the walk's phase is in a file, and under the close-in mode it is these that advance it
   *  — a load that began the gait again from nothing put his first footfalls frames off the save's. Nothing to say outside the mode. */
  heldGaitSnap(): number[] | undefined { return this.crT > 0 || this.crW > 0 ? [this.crT, this.crW, this.crPace, this.creep ? 1 : 0] : undefined; }
  heldGaitBack(a: unknown): void {
    if (!Array.isArray(a) || a.length !== 4 || !a.every(x => typeof x === 'number' && Number.isFinite(x))) return;
    this.crT = clamp(a[0], 0, 1); this.crW = clamp(a[1], 0, 1); this.crPace = Math.max(0, a[2]); this.creep = a[3] === 1;
  }
  /** The held gait's share this frame (update(), creep): a linear clock in over CREEP.gaitIn, out over CREEP.gaitOut, eased — and crV, the speed the ROOT itself
   *  made since the last frame (the controller's pos, as the life layer reads it: a jump of half a metre is a teleport, not travel), which is what the phase
   *  is advanced by under it. */
  private creepGait(dt: number): number {
    if (this.crT <= 0 && Math.abs(this.speed) < 0.05) {   // the mode begun at a stand: the stride he is put in is one with both feet down (whatever phase his last walk left — a foot in the air as often as not — is not a way to stand; stopped IN the mode he keeps the frame he stopped on)
      const p = this.creepPlant()[this.crouchTarget > 0.5 ? 1 : 0]; this.phase = (p + Math.round((this.phase - p) * 2) / 2 + 2) % 1;
    }
    this.crT = clamp(this.crT + (this.creep ? dt / CREEP.gaitIn : -dt / CREEP.gaitOut), 0, 1);
    const pp = this.life.prevPos, P0 = this.posIn; const d = Number.isFinite(pp[0]) ? hyp2(P0[0] - pp[0], P0[2] - pp[2]) : 0;
    this.crV = dt > 0 && d <= 0.5 ? Math.min(d / dt, 8) : 0;
    return smoothstep(0, 1, this.crT);
  }
  /** [walking, crouch-walking]: the phase, mod half a cycle, at which the clip stands widest with both feet on the floor — found once, off the clips themselves */
  private creepPlant(): [number, number] {
    if (this.crPh) return this.crPh;
    const nd = this.nodes, fk = this.fk, c = this.clips;
    const find = (clip: Clip, off: number): number => { let best = 0, score = -Infinity;
      for (let i = 0; i < 96; i++) { sampleClip(clip, (i / 96 + off) * clip.duration, true, this.pC); this.fkPart(this.pC, this.fkLegs); const a = fk.pos[nd.toeL], b = fk.pos[nd.toeR], sc = Math.abs(a[2] - b[2]) - 4 * Math.abs(a[1] - b[1]); if (sc > score) { score = sc; best = i / 96; } }
      return best % 0.5; };
    return this.crPh = [find(c.Walk_Loop, WALK_PHASE), find(c.Crouch_Fwd_Loop, 0)];
  }
  /** THE CLOSE-IN MODE's carriage (creep / CREEP): weight `w` (update()'s eased crW). The body straight into pA — the pelvis sunk and set back with the feet put
   *  back where the gait has them (the clip's own knee plane, as the sneak layer), the spine bowed forward hips first (not under the aim clip, whose trunk is
   *  the bore's), the head levelled back out of it and turned onto creepAt (a WORLD point, through the twist's inverse) — then the shoulders rounded and the
   *  hands brought up ahead of the hips by IK on a copy, in the shoulders' frame: the left by `wL`, the right by `wR` (0 with the pistol in it: the gun arm is
   *  its carry's or its aim's). Runs after the aim clip and the carries, before the ready pose. */
  /** WATCH (the table's note): `free` = what nothing else has of the head and trunk, wL / wR = of each arm */
  private watchLayer(dt: number, free: number, wL: number, wR: number, twY: number, twP: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, W = WATCH, T = this.wt, un = this.untwist(twY, twP);
    // ---- the slip: pelvis, trunk, the arm on his side
    const sWant = this.slipAt ? clamp(this.slipK, 0, 1) * free * clamp(this.crouch, 0, 1) : 0;
    T.sw = Math.abs(sWant - T.sw) < 0.003 ? sWant : damp(T.sw, sWant, W.slipRate, dt);
    if (this.slipAt) { const m = un(this.toModelP(this.slipAt)), L = hyp2(m[0], m[2]); if (L > 1e-4) { T.sx = m[0] / L; T.sz = m[2] / L; } if (T.side === 0 ? T.sx < -0.2 : T.sx > 0.2) T.side = T.sx > 0 ? 0 : 1;
      const lw = clamp(this.slipLean, 0, 1); T.sl = Math.abs(lw - T.sl) < 0.003 ? lw : damp(T.sl, lw, W.slipRate, dt); }   // (between two men the lean goes and he only gets smaller: `squeeze`)
    if (T.sw > 0.003) {
      const k = T.sw * T.sw * (3 - 2 * T.sw), kl = k * T.sl, kd = k * (1 + W.squeeze * (1 - T.sl));
      { this.fkPart(pA, this.fkLegs);
        const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
        this.shift(pA, nd.hips, [-T.sx * W.away * kl, -W.drop * kd, 0]);
        this.fkPart(pA, this.fkLegs);
        twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true); }
      const roll = T.sx * W.lean * DEGR * kl;   // (about his forward line: + tips the trunk to his right, away from a man on his left)
      this.turn(pA, nd.spine1, qRoll(roll * 0.4)); this.turn(pA, nd.spine2, qRoll(roll * 0.35)); this.turn(pA, nd.spine3, qRoll(roll * 0.25));
      this.turn(pA, nd.neck, qRoll(-roll * 0.4)); this.turn(pA, nd.head, qRoll(-roll * 0.6));
      const side = T.side, sgn = side === 0 ? 1 : -1, wArm = (side === 0 ? wL : wR) * kl * W.armW * smoothstep(W.armSide[0], W.armSide[1], sgn * T.sx);
      if (wArm > 0.003) {
        pB.copy(pA); fk.run(pB);
        const sh = fk.pos[side === 0 ? nd.upperArmL : nd.upperArmR], at: Vec3 = [sh[0] + T.sx * W.armOut, sh[1] - W.armDown, sh[2] + T.sz * W.armOut];
        const fing = v3.normalize([T.sx * 0.75, -0.55, T.sz * 0.75] as Vec3), rot = this.handRot(side, fing, [-T.sx * 0.3, 1, -T.sz * 0.3]);
        twoBoneIK(fk, pB, side === 0 ? nd.upperArmL : nd.upperArmR, side === 0 ? nd.forearmL : nd.forearmR, side === 0 ? nd.handL : nd.handR, at, [sgn * 0.5, -0.3, -0.8], 0.6, rot);
        this.hand(pB, side, [0.12, 0.15, 0.18, 0.22], 0.15, 0.35);
        const m = this.dynMask; m.fill(0); const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
        setSub(side === 0 ? nd.shoulderL : nd.shoulderR, wArm);
        blendPose(pA, pB, 1, m, pA);
      }
    }
    // ---- the look
    const wWant = this.watchAt ? clamp(this.watchK, 0, 1) * free : 0;
    T.w = Math.abs(wWant - T.w) < 0.003 ? wWant : damp(T.w, wWant, W.wRate, dt);
    if (this.watchAt && wWant > 0) {
      fk.run(pA);
      const hr = fk.rot[nd.head], gaze = quat.rotate(hr, this.gazeLocal), eyes = v3.mad(v3.mad(fk.pos[nd.head], quat.rotate(hr, AY), 0.1), gaze, 0.08);
      const want = v3.normalize(v3.sub(un(this.toModelP(this.watchAt)), eyes));
      const yawE = clamp(wrapAngle(Math.atan2(want[0], want[2]) - Math.atan2(gaze[0], gaze[2])), -W.yaw * DEGR, W.yaw * DEGR);
      const pitchE = clamp(Math.asin(clamp(gaze[1], -1, 1)) - Math.asin(clamp(want[1], -1, 1)), -W.up * DEGR, W.down * DEGR);   // + = further down
      if (T.w < 0.01) { T.yaw = yawE; T.pitch = pitchE; } else { T.yaw = damp(T.yaw, yawE, W.rate, dt); T.pitch = damp(T.pitch, pitchE, W.rate, dt); }   // (a look that begins is on its man from its first frame: only its weight comes up)
    } else if (T.w <= 0) { T.yaw = 0; T.pitch = 0; }
    if (T.w > 0.003) {
      const yw = T.yaw * T.w, pw = T.pitch * T.w, S = W.share, rest = S[1] + S[2];
      this.turn(pA, nd.spine3, qYaw(yw * S[0]));
      this.turn(pA, nd.neck, quat.mul(qYaw(yw * S[1]), qPitch(pw * S[1] / rest))); this.turn(pA, nd.head, quat.mul(qYaw(yw * S[2]), qPitch(pw * S[2] / rest)));
    }
    this.watchShown.w = T.w; this.watchShown.yaw = T.yaw * T.w; this.watchShown.slip = T.sw; this.watchShown.lean = T.sl;
  }
  private creepLayer(w: number, wL: number, wR: number, twY: number, twP: number, dt: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, C = CREEP, cr = clamp(this.crouch, 0, 1);
    const ck = this.closeK >= 0 ? this.clK : -1, KC = KIT.close, cke = ck < 0 ? 0 : ck * ck * (3 - 2 * ck);   // (KIT.close: how close he is, eased — −1 = not dealt, the carriage as it was)
    const e = w * w * (3 - 2 * w) * (ck < 0 ? 1 : lerp(KC.far, 1, cke)), free = 1 - clamp(this.upperW.aim, 0, 1);
    const lo = this.lowS, LS = this.lowShape; let ws = 0;
    if (this.handsDown > 0) { const hd = clamp(this.handsDown, 0, 1), k = 1 - hd * (1 - this.wideS); ws = k > 1e-4 ? clamp(hd * this.wideS / k, 0, 1) : 0; wL *= k; wR *= k; }   // (CREEP.low: lower, and — at any distance — the raised hands let down; CREEP.wide: what is left of the arms is out wide and low, `ws` of it)
    const WD = C.wide, WS = this.wideShape, HS = this.heftShape, gw = this.heft > 0 ? clamp(this.heft, 0, 1) * this.wideS * e : 0; let hs = 0, ha = 0, hw = 0, hg = 0;   // (CREEP.heft: his stride, the arms' share of it, his weight's side, his surge)
    { this.fkPart(pA, this.fkLegs);
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      if (gw > 0) { const Hf = this.hf, HC = C.heft, h = Math.min(dt, HC.dt); Hf.t += dt; const spring = (x: number, v: number, to: number, W: [number, number]): [number, number] => { const nv = v + (W[0] * W[0] * (to - x) - 2 * W[1] * W[0] * v) * h; return [x + nv * h, nv]; };   // (CREEP.heft: read off the feet as they are under him, each a beat behind the last)
        [Hf.s, Hf.sv] = spring(Hf.s, Hf.sv, clamp((fL[2] - fR[2]) / HC.stride, -1, 1), HC.trunk); [Hf.a, Hf.av] = spring(Hf.a, Hf.av, Hf.s, HC.arm);
        [Hf.w, Hf.wv] = spring(Hf.w, Hf.wv, clamp((fR[1] - fL[1]) / HC.lift, -1, 1), HC.body); [Hf.v, Hf.vv] = spring(Hf.v, Hf.vv, clamp(Math.abs(this.speed) / HC.run, 0, 1), HC.go);
        hs = Hf.s * gw; ha = Hf.a * gw; hw = Hf.w * gw; hg = (clamp(Math.abs(this.speed) / HC.run, 0, 1) - Hf.v) * gw * HS[5]; }   // (hg: + he is setting off, his body not yet with him; − stopping, it carries on)
      this.shift(pA, nd.hips, [hw * HS[2], -(lerp(C.drop[0], C.drop[1], cr) + LS[0] * lo) * e - Math.abs(hs) * HS[4], -(lerp(C.back[0], C.back[1], cr) + LS[1] * lo) * e * free]);
      this.fkPart(pA, this.fkLegs);
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true); }
    const lean = (lerp(C.lean[0], C.lean[1], cr) + LS[2] * lo + HS[3] * gw - hg * 9 + (gw > 0 ? C.heft.breath * gw * Math.sin(this.hf.t * Math.PI * 2 * C.heft.breathHz) : 0)) * DEGR * e * free;
    if (gw > 0) { const tw = hs * HS[0] * DEGR, rl = hw * HS[0] * 0.3 * DEGR;   // (CREEP.heft: the shoulders come round against the step and over the foot he is on; the head stays where it was looking)
      this.turn(pA, nd.spine1, quat.mul(qYaw(tw * 0.25), qRoll(rl * 0.3))); this.turn(pA, nd.spine2, quat.mul(qYaw(tw * 0.35), qRoll(rl * 0.35))); this.turn(pA, nd.spine3, quat.mul(qYaw(tw * 0.4), qRoll(rl * 0.35)));
      this.turn(pA, nd.neck, quat.mul(qYaw(-tw * 0.5), qRoll(-rl * 0.5))); this.turn(pA, nd.head, quat.mul(qYaw(-tw * 0.5), qRoll(-rl * 0.5))); }
    if (lean > 1e-5) {
      this.turn(pA, nd.spine1, qPitch(lean * 0.4)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.25));
      this.turn(pA, nd.neck, qPitch(-lean * 0.4)); this.turn(pA, nd.head, qPitch(-lean * 0.5));   // (a tenth of it left in the head: he looks out from under his brow)
    }
    { const lw = C.look * e * free * (1 - clamp(this.wt.w, 0, 1)); if (this.creepAt && lw > 0.003) { fk.run(pA); this.lookAt(pA, this.untwist(twY, twP)(this.toModelP(this.creepAt)), lw); } }   // (WATCH: his head is handed to that layer by its own eased share — last frame's, it runs after this one — so the two cross over and never both have it whole)
    if (wL <= 0.003 && wR <= 0.003) { this.creepShown = w; return; }
    pB.copy(pA); const rnd = C.round * DEGR * e;
    if (wL > 0.003) this.turn(pB, nd.shoulderL, qYaw(-rnd)); if (wR > 0.003) this.turn(pB, nd.shoulderR, qYaw(rnd));
    fk.run(pB);
    const sl = v3.copy(fk.pos[nd.upperArmL]), sr = v3.copy(fk.pos[nd.upperArmR]);
    let fx = -(sl[2] - sr[2]), fz = sl[0] - sr[0]; { const L = hyp2(fx, fz) || 1; fx /= L; fz /= L; }
    const sq = (v: Vec3): Vec3 => [fz * v[0] + fx * v[2], v[1], fz * v[2] - fx * v[0]];   // (left, up, forward) off the shoulder line → model axes
    const m = this.dynMask; m.fill(0);
    const wUp = smoothstep(0, 0.75, w), wFore = smoothstep(0.08, 0.88, w), wHand = smoothstep(0.16, 1, w);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    // KIT.close, the hands alive: a slow working of the fingers and a drift of the wrists on the layer's own clock (two rates per hand, never in step)
    const lt = this.clT * Math.PI * 2 * KC.flex, flL = ck < 0 ? 0 : KC.flexAmp * (0.6 * Math.sin(lt) + 0.4 * Math.sin(lt * 1.63 + 1.1)), flR = ck < 0 ? 0 : KC.flexAmp * (0.6 * Math.sin(lt * 1.21 + 2.3) + 0.4 * Math.sin(lt * 0.71 + 0.4));
    const drift = (ph: number): Vec3 => ck < 0 ? [0, 0, 0] : [KC.drift * Math.sin(lt * 0.83 + ph), KC.drift * Math.sin(lt * 1.17 + ph * 1.7), KC.drift * 0.6 * Math.sin(lt * 0.61 + ph * 0.6)];
    if (wL > 0.003) { const H = C.L; let pole = H.pole, fing = H.fing, back = H.back, cu = H.curl, th = H.thumb, sp = H.spread;
      let at = v3.add(v3.mad(v3.lerp(H.at, H.atC, cr), KC.lead, cke), v3.scale(drift(0), ck < 0 ? 1 : 1 / Math.max(0.38, lerp(KC.left, 1, ws))));   // (the drift at its full size through the part of this arm the layer has)
      if (ws > 0) { const sw = -ha * HS[1], HC = C.heft; at = v3.lerp(at, [WS[0] + sw * HC.out, -WS[1] + Math.abs(sw) * HC.up, WS[2] + WS[3] + sw - hg * 0.1], ws); pole = v3.lerp(pole, this.widePole ?? WD.pole, ws); fing = v3.lerp(fing, WD.fing, ws); back = v3.lerp(back, WD.back, ws); cu = lerp(cu, WD.curl, ws); th = lerp(th, WD.thumb, ws); sp = lerp(sp, WD.spread, ws); }   // (CREEP.wide: out to its side, and still — the wide hand has no drift: a stop is a held frame)
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(sl, sq(at)), sq(pole), 0.8, this.handRot(0, sq(fing), sq(back)));
      this.hand(pB, 0, [cu + flL, cu + 0.05 + flL * 0.9, cu + 0.1 + flL * 0.8, cu + 0.15 + flL * 0.7], th + flL * 0.5, sp);
      const lw = wL * (ck < 0 ? 1 : lerp(KC.left, 1, ws));   // (KIT.close: most of this arm is left to the crouch under it — it goes for the man only in reach, the tell's own reach)
      m[nd.shoulderL] = m[nd.upperArmL] = wUp * lw; m[nd.forearmL] = wFore * lw; setSub(nd.handL, wHand * lw); }
    if (wR > 0.003) { const H = C.R;
      let a0 = v3.add(v3.lerp(H.at, H.atC, cr), drift(2.1)), p0 = H.pole, fing = H.fing, back = H.back, curl = H.curl, thb = H.thumb, spr = H.spread * (1 - cke);
      if (ws > 0) { const mir = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];   // (CREEP.wide: the left's mirror)
        const sw = ha * HS[1], HC = C.heft; a0 = v3.lerp(a0, [-WS[0] - sw * HC.out, -WS[1] + Math.abs(sw) * HC.up, WS[2] - WS[3] + sw - hg * 0.1], ws); p0 = v3.lerp(p0, mir(this.widePole ?? WD.pole), ws); fing = v3.lerp(fing, mir(WD.fing), ws); back = v3.lerp(back, mir(WD.back), ws); curl = lerp(curl, WD.curl, ws); thb = lerp(thb, WD.thumb, ws); spr = lerp(spr, WD.spread, ws); }
      let at = v3.add(sr, sq(a0)), rot = this.handRot(1, sq(fing), sq(back)), pole = sq(p0);
      if (ck >= 0 && !this.grip[1] && !this.noKnife) {   // the knife hand by distance: from its guard up across the chest to hover off the hilt — where the reach (readyLayer) closes it on the handle
        const S = this.sheathFist(0, KC.hover);
        { const cp = cke + (ck - cke) * 0.5; at = v3.add(v3.mad(v3.lerp(at, S.at, cp), sq(KC.bow), Math.sin(Math.PI * cke)), v3.scale(sq(drift(2.1)), cke)); }   // (the travel half-eased: an eased-only one sat still over the first metre in, and the hand must be seen to go with every step)
        rot = quat.slerp(rot, S.rot, cke); pole = v3.lerp(pole, S.pole, cke); curl = lerp(H.curl, KC.curl, cke);
      }
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, at, pole, 0.8, rot);
      if (!this.grip[1]) this.hand(pB, 1, [curl + flR, curl + 0.05 + flR * 0.9, curl + 0.1 + flR * 0.8, curl + 0.15 + flR * 0.7], thb + flR * 0.5, spr);
      m[nd.shoulderR] = m[nd.upperArmR] = wUp * wR; m[nd.forearmR] = wFore * wR; setSub(nd.handR, wHand * wR); }
    blendPose(pA, pB, 1, m, pA);
    this.creepShown = w;
  }
  /** STEALTH POSES — the arms of Sam's hands-empty crouch (stealthpose.ts has what each part is). ARMS ONLY, clavicle to fingertips, by IK on a copy and blended
   *  in through dynMask, plus the idle's sway: the pelvis a centimetre to each side with the feet held where they were. The trunk and the head joint are not
   *  turned and the pelvis is never sunk, so `bones.head` / `bones.chest` stay within the sway of the pose under it. `busy` = something the animator knows has
   *  his arms or body; `fed.free` = the game's half of the same question. The weight is a straight ramp (STEALTH.inSecs in, outSecs out: gone inside 0.3 s) shown through a smoothstep, so it neither starts nor ends with a jump. */
  private stealthLayer(dt: number, busy: boolean, crouchPose: number, wMove: number, twY: number, twP: number) {
    const S = this.sp ??= { wA: 0, t: 0, cr: crouchPose, fl: 0, lead: 0, fz: 0, sw: 0, wC: 0, wH: 0, pic: null, picOn: false };
    const f = this.stealth, K = STEALTH, P = STEALTHPOSE, pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    const want = f && f.free && !busy ? 1 : 0;
    S.wA = clamp(S.wA + (want ? dt / K.inSecs : -dt / K.outSecs), 0, 1); const wA = S.wA * S.wA * (3 - 2 * S.wA);
    // RISE: the arms' own crouch — down with him at once (the elbows flaring for as long as he is still sinking), up after him over riseSecs
    const dc = crouchPose - S.cr;
    if (!P.rise || dc >= 0) { S.fl += ((P.rise && dt > 0 ? clamp(dc / dt * 0.35, 0, 1) : 0) - S.fl) * Math.min(1, dt * 12); S.cr = P.rise ? Math.min(crouchPose, S.cr + dt * K.rise.down) : crouchPose; }
    else { S.cr = Math.max(crouchPose, S.cr - dt / Math.max(0.05, P.riseSecs)); S.fl += (0 - S.fl) * Math.min(1, dt * 12); }
    S.t += dt;
    const cs = this.creepShown, wm = clamp(wMove, 0, 1), up = S.cr * S.cr * (3 - 2 * S.cr);
    const mix = lerp(P.idle ? 1 : 0, P.walk ? 1 : 0, wm), W = wA * up * Math.max(mix, P.creep ? cs : 0);
    if (S.wA <= 0.003 || up <= 0.003) { S.lead = 0; return; }
    this.fkPart(pA, this.fkLegs);
    // IDLE: never a held frame — the weight goes foot to foot, the feet where they were
    const sway = P.idle ? wA * up * (1 - wm) * (1 - cs) * crouchPose : 0;
    if (sway > 0.003) {
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const ph = S.t * 2 * Math.PI / Math.max(0.5, P.swaySecs);
      this.shift(pA, nd.hips, [P.swayM * sway * Math.sin(ph), 0, P.swayM * 0.35 * sway * Math.sin(ph * 2 + 0.6)]);
      this.fkPart(pA, this.fkLegs);
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true);
    }
    if (W <= 0.003) { S.lead = 0; return; }
    pB.copy(pA); const rnd = K.round * DEGR * W;
    this.turn(pB, nd.shoulderL, qYaw(-rnd)); this.turn(pB, nd.shoulderR, qYaw(rnd));
    fk.run(pB);
    const un = this.untwist(twY, twP);
    const kL = fk.pos[nd.shinL], kR = fk.pos[nd.shinR], kHi = Math.max(kL[1], kR[1]), kZ = Math.max(kL[2], kR[2]);
    const fzL = fk.pos[nd.footL][2], fzR = fk.pos[nd.footR][2];
    S.sw += ((P.walk ? clamp((fzR - fzL) / K.walk.stride, -1, 1) * wm : 0) - S.sw) * Math.min(1, dt * K.walk.rate); const s = S.sw;   // WALK: + = the right foot ahead, so the LEFT hand comes forward
    // CREEP: the free hand leads its own foot — out as the left foot comes off the floor and forward, held while the foot is under it, back as he passes over it
    { const vz = dt > 0 ? (fzL - S.fz) / dt : 0; S.fz = fzL;
      const tgt = P.creep && cs > 0.003 ? (vz > 0.15 ? 1 : clamp((fzL + 0.25) / 0.55, 0, 1)) : 0; S.lead += (tgt - S.lead) * Math.min(1, dt * K.creep.rate); }
    const lt = S.t * 2 * Math.PI / Math.max(0.5, P.swaySecs), dr = P.driftM * (1 - wm);
    const m = this.dynMask; m.fill(0);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    const I = K.idle;
    for (let side = 0; side < 2; side++) {
      const sg = side === 0 ? 1 : -1, kn = side === 0 ? kL : kR, a = sg * s;
      const up_ = side === 0 ? nd.upperArmL : nd.upperArmR, fo = side === 0 ? nd.forearmL : nd.forearmR, ha = side === 0 ? nd.handL : nd.handR, sh = side === 0 ? nd.shoulderL : nd.shoulderR;
      const wArm = W * (1 - this.readyW) * (side === 0 ? (P.creep ? 1 - cs * this.wideS * clamp(this.handsDown, 0, 1) : 1 - cs) : 1 - cs);   // (the knife hand is the close-in mode's; the tell takes either when it wants it; CREEP.wide: with his arms out the left is the creep's too)
      if (wArm <= 0.003) continue;
      const S0 = fk.pos[up_], L = (hyp3(fk.pos[fo][0] - S0[0], fk.pos[fo][1] - S0[1], fk.pos[fo][2] - S0[2]) + hyp3(fk.pos[ha][0] - fk.pos[fo][0], fk.pos[ha][1] - fk.pos[fo][1], fk.pos[ha][2] - fk.pos[fo][2])) * 0.97;
      const d1 = dr * Math.sin(lt * 0.83 + side * 2.1), d2 = dr * Math.sin(lt * 1.31 + side * 1.3 + 0.7), d3 = dr * Math.sin(lt * 0.57 + side * 0.9 + 1.9);
      let T = un([kn[0] + sg * I.out + d1, Math.max(I.floor, kHi - I.below) + d2, Math.max(kn[2] + I.fwd, kZ + I.lead) + d3]);
      if (a > 0) T = v3.lerp(T, un([kn[0] * 0.6 + sg * K.walk.fwd[0], Math.max(I.floor, kHi + K.walk.fwd[1]), kZ + K.walk.fwd[2]]), a);
      else if (a < 0) T = v3.lerp(T, [S0[0] + sg * K.walk.back[0], S0[1] + K.walk.back[1], S0[2] + K.walk.back[2]], -a);
      if (side === 0 && cs > 0.003 && P.creep) { const C = K.creep, back: Vec3 = [S0[0] + K.walk.back[0], S0[1] + K.walk.back[1] + 0.06, S0[2] + K.walk.back[2] * C.swing];
        T = v3.lerp(T, v3.lerp(back, un([kL[0] * 0.5 + C.at[0], Math.max(C.floor, kHi + C.at[1]), kZ + C.at[2]]), S.lead), cs); }
      { const dx = T[0] - S0[0], dy = T[1] - S0[1], dz = T[2] - S0[2], D = hyp3(dx, dy, dz); if (D > L) T = [S0[0] + dx * L / D, S0[1] + dy * L / D, S0[2] + dz * L / D]; }   // (beyond the arm: reached toward, never locked out)
      const flare = S.fl * K.walk.flarePole, bk = Math.max(0, -a) * K.walk.tuck;   // (the back arm's elbow goes BEHIND him, not out)
      twoBoneIK(fk, pB, up_, fo, ha, T, [sg * (I.pole[0] + flare - bk), I.pole[1] + flare * 0.5 + bk * 0.4, I.pole[2] - bk], 0.8, this.handRot(side as 0 | 1, [sg * I.fing[0], I.fing[1], I.fing[2]], [sg * I.back[0], I.back[1], I.back[2]]));
      this.hand(pB, side as 0 | 1, [I.curl, I.curl + 0.04, I.curl + 0.08, I.curl + 0.12], I.thumb, I.spread);
      m[sh] = m[up_] = m[fo] = wArm; setSub(ha, wArm);
    }
    blendPose(pA, pB, 1, m, pA);
  }
  /** STEALTH POSES — the look under a door with the wand (stealthpose.ts CABLE), built on a copy of the finished pose and then MADE the pose (update(), right
   *  before `pose` is written): what is drawn is what the game reads — `bones`, the capsules, his gaze, a ragdoll's seed, the things bolted to him. So for the
   *  look his head is that much lower than the lock work's kneel (never higher). `lockpick` and its clocks are untouched. He stays in the squat, shuffles
   *  `cableStep` of pose in, the trunk folds (the lock work's sit-up taken back out + `cableBow`), the head bows at the foot of the leaf — its gaze kept short of
   *  straight down, where its yaw has no bearing —, shoulders in, the right wrist low at the gap, the left by its knee. In over `cableIn`; out with the head first. */
  private stealthPicture(dt: number) {
    const S = this.sp!, f = this.stealth, K = STEALTH.cable, P = STEALTHPOSE, nd = this.nodes, fk = this.fk;
    const want = !!f && f.cable && this.lockpick;
    S.wC = clamp(S.wC + (want ? dt / Math.max(0.05, P.cableIn) : -dt / K.out), 0, 1); S.wH = clamp(S.wH + (want ? dt / Math.max(0.05, P.cableIn) : -dt / K.headOut), 0, 1);
    if (this.nvNod === 0) S.nodUp = undefined;
    if (S.wC <= 0.003) { S.picOn = false; return; }
    const pic = S.pic ??= new Pose(this.pA.numNodes), pB = this.pB; pic.copy(this.pA);
    const e = S.wC * S.wC * (3 - 2 * S.wC), eh = S.wH * S.wH * (3 - 2 * S.wH), at = this.lockpickAt;
    this.shift(pic, nd.hips, [0, 0, P.cableStep * e]);   // (the shuffle in: all of him, feet and all)
    { this.fkPart(pic, this.fkLegs);
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      this.shift(pic, nd.hips, [0, -K.sink * e, 0]); this.fkPart(pic, this.fkLegs);
      twoBoneIK(fk, pic, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL); twoBoneIK(fk, pic, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true); }
    const bow = (K.undo * clamp(this.lpW.x, 0, 1) + P.cableBow) * DEGR * e;
    this.turn(pic, nd.spine1, qPitch(bow * 0.36)); this.turn(pic, nd.spine2, qPitch(bow * 0.39)); this.turn(pic, nd.spine3, qPitch(bow * 0.25));
    this.turn(pic, nd.neck, qPitch(-bow * 0.25 * (1 - eh))); this.turn(pic, nd.head, qPitch(-bow * 0.3 * (1 - eh)));   // (on the way out the head is level again before the back is)
    this.turn(pic, nd.shoulderL, qYaw(-K.round * DEGR * e)); this.turn(pic, nd.shoulderR, qYaw(K.round * DEGR * e));
    fk.run(pic); this.lookAt(pic, [0, 0.04, Math.max(at[2] + 0.05, fk.pos[nd.head][2] + K.ahead)], eh);
    if (P.nod && this.nvNod !== 0) {   // (a goggle nod under way is posed HERE, after the look at the gap. Bowed over the gap his gaze is some 80° down: a chin-down nod from there goes through straight down and the head rolls over. So a nod that starts with the look's head mostly in is a LIFT of the head off the gap and back, as big; one the look came in over stays the chin-down nod it began as, kept short of straight down. Which is settled once a nod — blended by the look's weight the two cancel half way in. The head joint alone turns: bones.head stays where the look has it)
      const n = this.nvNod; S.nodUp ??= eh > 0.3; let a = n;
      if (S.nodUp) a = nodLift(n);   // (the nod's small counter-move first is a small lift too)
      const G = this.nvHead(pic); if (!S.nodUp && n > 0) a = Math.min(n, Math.max(0, K.nodMax * DEGR - Math.asin(clamp(-quat.rotate(quat.mul(G, this.headRestInv), [0, 0, 1])[1], -1, 1))));
      this.nvTip(pic, a, G); this.nvA = a;
    }
    pB.copy(pic); fk.run(pB);
    const kL = fk.pos[nd.shinL];
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, [K.gap[0], K.gap[1], at[2] - K.short], [-0.6, 0.1, -0.75], 0.8, this.handRot(1, [0.05, -0.35, 0.94], [-0.3, 0.9, 0.3]));
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, [kL[0] + K.knee[0], kL[1] + K.knee[1], kL[2] + K.knee[2]], [0.8, 0, -0.6], 0.8, this.handRot(0, [-0.15, -0.85, 0.5], [0.45, 0.25, 0.85]));
    this.hand(pB, 1, [0.5, 0.6, 0.7, 0.75], 0.5); this.hand(pB, 0, [0.2, 0.24, 0.28, 0.32], 0.15, 0.3);
    blendPose(pic, pB, e, this.armsMask, pic);
    S.picOn = true;
  }
  /** The chest twist update() has the SkeletonInstance apply AFTER this pose (yaw twY spread .25 / .35 / .4 over spine1‥3, pitch twP at spine3), run backwards for a
   *  point: where to pose something below spine3 for it to END UP at H. doorLayer's own construction (it keeps its copy: its numbers are frozen by its probes);
   *  fk must be current on the pose asked about. No twist = the point itself. */
  private untwist(twY: number, twP: number): (H: Vec3) => Vec3 {
    if (!twY && !twP) return (H: Vec3) => H;
    const nd = this.nodes, fk = this.fk;
    const E1 = qYaw(twY * 0.25), E2 = qYaw(twY * 0.35); let E3 = qYaw(twY * 0.4);
    if (twP) { const right = quat.rotate(E3, AX); E3 = quat.mul(quat.axisAngle(right, twP), E3); }
    const iE1 = quat.conj(E1), iE2 = quat.conj(E2), iE3 = quat.conj(E3);
    const P1 = v3.copy(fk.pos[nd.spine1]), P2 = fk.pos[nd.spine2], P3 = fk.pos[nd.spine3];
    const P2t = v3.add(quat.rotate(E1, v3.sub(P2, P1)), P1);
    const P3t = v3.add(quat.rotate(E2, v3.sub(v3.add(quat.rotate(E1, v3.sub(P3, P1)), P1), P2t)), P2t);
    return (H: Vec3): Vec3 => { const x1 = v3.add(quat.rotate(iE3, v3.sub(H, P3t)), P3t); const x2 = v3.add(quat.rotate(iE2, v3.sub(x1, P2t)), P2t); return v3.add(quat.rotate(iE1, v3.sub(x2, P1)), P1); };
  }
  /** … and run FORWARDS: where a point posed below spine3 ENDS UP after that twist, and where spine2 itself does (it turns with spine1's share alone). The same
   *  construction; fk current on the pose asked about. */
  private twisted(twY: number, twP: number): { at: (H: Vec3) => Vec3; spine2: Vec3 } {
    const nd = this.nodes, fk = this.fk;
    if (!twY && !twP) return { at: (H: Vec3) => H, spine2: v3.copy(fk.pos[nd.spine2]) };
    const E1 = qYaw(twY * 0.25), E2 = qYaw(twY * 0.35); let E3 = qYaw(twY * 0.4);
    if (twP) { const right = quat.rotate(E3, AX); E3 = quat.mul(quat.axisAngle(right, twP), E3); }
    const P1 = v3.copy(fk.pos[nd.spine1]), P2 = fk.pos[nd.spine2], P3 = fk.pos[nd.spine3];
    const P2t = v3.add(quat.rotate(E1, v3.sub(P2, P1)), P1);
    const P3t = v3.add(quat.rotate(E2, v3.sub(v3.add(quat.rotate(E1, v3.sub(P3, P1)), P1), P2t)), P2t);
    return { spine2: P2t, at: (H: Vec3): Vec3 => { const x1 = v3.add(quat.rotate(E1, v3.sub(H, P1)), P1); const x2 = v3.add(quat.rotate(E2, v3.sub(x1, P2t)), P2t); return v3.add(quat.rotate(E3, v3.sub(x2, P3t)), P3t); } };
  }
  /** untwist's rotation alone, for a direction (a hand's fingers / back that must END UP pointing somewhere after the chest twist) */
  private untwistDir(twY: number, twP: number): (d: Vec3) => Vec3 {
    if (!twY && !twP) return (d: Vec3) => d;
    const E1 = qYaw(twY * 0.25), E2 = qYaw(twY * 0.35); let E3 = qYaw(twY * 0.4);
    if (twP) { const right = quat.rotate(E3, AX); E3 = quat.mul(quat.axisAngle(right, twP), E3); }
    const q = quat.mul(quat.conj(E1), quat.mul(quat.conj(E2), quat.conj(E3)));
    return (d: Vec3): Vec3 => quat.rotate(q, d);
  }
  /** KIT: where the right wrist is, how the hand lies and where the elbow points with `it` in the fist AT THE PLACE IT LIVES (KIT's list) — off the pose `fk`
   *  holds, in the pose's own space (the leg- and belt-borne places taken back through the chest twist still to come: `un` / `und`) */
  private kitSpot(it: KitItem, dirT: (p: Vec3) => Vec3, un: (p: Vec3) => Vec3, und: (d: Vec3) => Vec3, front = false): { at: Vec3; rot: Quat; pole: Vec3 } {
    const fk = this.fk, nd = this.nodes, K = KIT;
    if (it === 'knife') return this.sheathFist();
    if (it === 'rifle' && front) { const H = slingFrontHand(undefined, this.kitRest); return { at: v3.add(fk.pos[nd.spine2], dirT(H.at)), rot: this.handRot(1, dirT(H.fing), dirT(H.back)), pole: dirT(K.front.pole) }; }
    if (it === 'rifle') { const A = K.apex; return { at: v3.add(fk.pos[nd.upperArmR], dirT(A.at)), rot: this.handRot(1, dirT(A.fing), dirT(A.back)), pole: dirT(A.pole) }; }
    if (it === 'can') { const B = K.belt; return { at: un(v3.add(fk.pos[nd.hips], dirT(B.at))), rot: this.handRot(1, und(dirT(B.fing)), und(dirT(B.back))), pole: dirT(B.pole) }; }
    const P = unAdj(holsterFrameOf(fk.pos[nd.thighR], fk.pos[nd.shinR], fk.pos[nd.hips], AZ), RIG.pistol.adj);   // the hand that holds the gun as it stands in the holster
    return { at: un(P.o), rot: this.handRot(1, und(P.z), und(v3.scale(P.x, -1))), pole: dirT(K.holsterPole) };
  }
  /** KIT: the swap's frame (KIT's doc; kitSwap). Both arms by IK on a copy of pA, whole from the upper arm down: the path begins on the hand as the pose under
   *  it had it when the swap began (kept body-relative: off its shoulder in the trunk's frame) and ends on the hand of the pose under it NOW, so it needs no
   *  cross-fade either end. Sets kitHold / kitStow / kitRoll for the drawer, then steps the clock. */
  private kitLayer(dt: number, twY: number, twP: number) {
    const k = this.kit!, K = KIT, pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    pB.copy(pA); fk.run(pB);
    const F = this.trunkFrame(), q3 = [...fk.rot[nd.spine3]] as Quat;
    const dirT = (q: Vec3): Vec3 => [F.left[0] * q[0] + F.up[0] * q[1] + F.fwd[0] * q[2], F.left[1] * q[0] + F.up[1] * q[1] + F.fwd[1] * q[2], F.left[2] * q[0] + F.up[2] * q[1] + F.fwd[2] * q[2]];
    type Spot = { at: Vec3; rot: Quat; pole?: Vec3 };
    const sR = v3.copy(fk.pos[nd.upperArmR]), sL = v3.copy(fk.pos[nd.upperArmL]);
    const uR: Spot = { at: v3.copy(fk.pos[nd.handR]), rot: [...fk.rot[nd.handR]] as Quat }, uL: Spot = { at: v3.copy(fk.pos[nd.handL]), rot: [...fk.rot[nd.handL]] as Quat };
    const un = this.untwist(twY, twP), und = this.untwistDir(twY, twP), rifle = k.from === 'rifle' || k.to === 'rifle', elbowU = v3.copy(fk.pos[nd.forearmR]);
    const st: Spot = { at: k.cap.mr ? un(k.cap.mr) : v3.add(sR, dirT(k.cap.r)), rot: k.cap.mf && k.cap.mb ? this.handRot(1, und(k.cap.mf), und(k.cap.mb)) : quat.mul(q3, k.cap.rq) };
    const spot = (it: KitItem): Spot => this.kitSpot(it, dirT, un, und, k.front);
    const back = rifle && !k.front, rarc = k.front ? K.front.arc : K.arc.rifle;   // (the rifle's home: over the shoulder onto his back, or let down on its sling in front)
    const e3 = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    const eh = (u: number) => { u = clamp(u, 0, 1); return 0.5 * (u + u * u * (3 - 2 * u)); };   // (the elbow of a rifle errand: half of it at a steady rate, so it does not all move with the hand at the top of its speed)
    const mix = (a: Spot, b: Spot, e: number, arc?: Vec3, via?: Quat): Spot => ({ at: arc ? v3.mad(v3.lerp(a.at, b.at, e), dirT(arc), Math.sin(Math.PI * e)) : v3.lerp(a.at, b.at, e),
      rot: via ? quat.slerp(quat.slerp(a.rot, via, e), quat.slerp(via, b.rot, e), e) : quat.slerp(a.rot, b.rot, e) });
    const top = back ? this.handRot(1, dirT(K.top.fing), dirT(K.top.back)) : undefined;   // (the empty hand going over the shoulder leads with its fingers: turned straight from hanging to the grip on his back it would pass through fingers-down on a forearm pointing up)
    const t = k.t, ap = clamp(k.front ? K.front.handAt : K.apexAt, 0.05, 0.95), sl = clamp(k.front ? K.front.slingAt : K.slingAt, 0.05, ap); let tg: Spot, pole: Vec3 | null = null, poleW = 0, hold: KitItem | null = null, stow = 0, roll = 0, grip = 0, join = 0, free = 0;
    if (k.from && t < k.tA) {                 // the item in the fist to where it lives
      const it = k.from, u = t / k.tA, hu = it === 'rifle' ? clamp(u / ap, 0, 1) : u, e = e3(hu), S = spot(it);
      tg = mix(st, S, e, it === 'rifle' ? rarc : K.arc[it]); pole = S.pole ?? null; poleW = 0.85 * (rifle ? eh(hu) : e3(hu * 1.6));
      hold = it; grip = 1; roll = Math.max(smoothstep(0, it === 'rifle' ? K.rollIn : 0.35, hu), k.roll0);
      stow = Math.max(k.s0, it === 'rifle' ? e3((u - sl) / (1 - sl)) : it === 'pistol' ? smoothstep(0.65, 1, u) : 0);
    } else if (k.to && t < k.tR) {            // the empty hand to where the next one lives
      const u = (t - k.tA) / Math.max(1e-3, k.tR - k.tA), e = e3(u), A = k.from ? spot(k.from) : st, S = spot(k.to);
      tg = mix(A, S, e, back ? (k.from ? K.over : K.up) : k.to === 'rifle' ? rarc : k.from ? K.cross : K.arc[k.to], top); pole = S.pole ?? null; poleW = 0.85 * (k.from ? 1 : rifle ? eh(u) : e3(u * 1.6));
      if (rifle && k.from && A.pole && pole) pole = v3.lerp(A.pole, pole, eh(u));   // (shoulder ↔ hip: the elbow goes with the hand, not ahead of it)
      grip = smoothstep(0.65, 1, u);
    } else if (k.to) {                        // …and up with it into the pose underneath
      const it = k.to, u = (t - k.tR) / Math.max(1e-3, k.D - k.tR), S = k.re ? st : spot(it);
      const hu = it === 'rifle' && !k.re ? clamp((u - (1 - ap)) / ap, 0, 1) : u, e = e3(hu);
      tg = mix(S, uR, e, k.re ? undefined : it === 'rifle' ? rarc : K.arc[it]); pole = S.pole ?? null; poleW = 0.85 * (1 - (rifle ? eh(hu) : e3(hu * 1.25)));
      hold = it; grip = 1; join = smoothstep(K.join, 1, hu);
      roll = k.re ? k.roll0 * (1 - smoothstep(0.4, 1, hu)) : 1 - smoothstep(it === 'rifle' ? 1 - K.rollIn : 0.65, 1, hu);
      free = e;
      stow = k.re ? k.s0 * (1 - smoothstep(0, 0.6, u)) : it === 'rifle' ? 1 - e3(u / (1 - sl)) : it === 'pistol' ? 1 - smoothstep(0, 0.35, u) : 0;
    } else {                                  // nothing next: the emptied hand back to the pose underneath
      const u = (t - k.tA) / Math.max(1e-3, k.D - k.tA), e = e3(u), A = k.from ? spot(k.from) : st;
      tg = mix(A, uR, e, back && k.from === 'rifle' ? K.over : undefined, k.from === 'rifle' ? top : undefined); pole = A.pole ?? null; poleW = 0.85 * (1 - e); grip = 1 - smoothstep(0, 0.45, u); free = e;
    }
    if (rifle && pole) {   // a rifle's errand: the elbow exactly where its pole says, the pole itself led over from where the pose underneath has the elbow (a part-weighted
      // pole turns the elbow BY A SHARE of the angle to it, and with the wrist passing close over the shoulder that angle swings through a half turn: the elbow jumped)
      const ax = v3.sub(uR.at, sR), al = v3.len(ax), eb = v3.sub(elbowU, sR); let pu = al > 1e-4 ? v3.mad(eb, ax, -v3.dot(eb, ax) / (al * al)) : eb;
      pu = v3.len(pu) > 1e-3 ? v3.normalize(pu) : v3.normalize(pole);
      const w = clamp(poleW / 0.85, 0, 1), pn = v3.normalize(pole), m = v3.lerp(pu, pn, w);
      pole = v3.len(m) > 1e-3 ? v3.normalize(m) : pn; poleW = 1;
    }
    // what an arm can do (KIT.elbowMin / wristMax), by how much of the hand is the errand's and not the pose's under it — none on the first frames (the start is
    // the hand as it was shown) nor as it lands (the end is the pose underneath, whatever that asks of the wrist)
    const own = rifle ? clamp(t / 0.12, 0, 1) * (1 - free * free) : 0; this.kitLie = null;
    if (own > 0) {
      const la = v3.len(v3.sub(fk.pos[nd.forearmR], fk.pos[nd.upperArmR])), lb = v3.len(v3.sub(fk.pos[nd.handR], fk.pos[nd.forearmR]));
      const rMin = Math.sqrt(Math.max(0, la * la + lb * lb - 2 * la * lb * Math.cos(K.elbowMin * Math.PI / 180))) * own;
      const d = v3.sub(tg.at, sR), dl = v3.len(d);
      if (dl < rMin) tg = { at: v3.mad(sR, dl > 1e-4 ? v3.scale(d, 1 / dl) : dirT([-0.4, 0.2, 0.9]), rMin), rot: tg.rot };
    }
    // the support hand, with a gun coming: off whatever it had to wait in front of him, onto the gun late
    const gunNext = k.to === 'pistol' || k.to === 'rifle'; let tl: Spot | null = null;
    const sL0 = (): Spot => ({ at: k.cap.ml ? un(k.cap.ml) : v3.add(sL, dirT(k.cap.l)), rot: quat.mul(q3, k.cap.lq) });
    if (gunNext) { const s0 = sL0(); tl = mix(mix(s0, { at: v3.add(sL, dirT(K.rest)), rot: s0.rot }, e3(t / 0.22)), uL, join); }
    else if (t < K.letGo) { join = e3(t / K.letGo); tl = mix(sL0(), uL, join); }   // …and no gun coming (a gun going away, or a draw called off with the support hand already out in front waiting): it lets go and falls away, not snapped off
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tg.at, pole, pole ? poleW : 0, tg.rot);
    if (own > 0) {   // the wrist: the hand's line brought back toward its forearm's where the path asked more of it than a wrist bends
      const fa = v3.sub(fk.pos[nd.handR], fk.pos[nd.forearmR]), fl = v3.len(fa), fg = quat.rotate(quat.mul(tg.rot, quat.conj(this.handFix[1])), [0, 1, 0]);
      if (fl > 1e-4) { const fd = v3.scale(fa, 1 / fl), ang = Math.acos(clamp(v3.dot(fd, fg), -1, 1)), kn = K.wristKnee * Math.PI / 180, mx = Math.max(kn + 0.01, K.wristMax * Math.PI / 180);
        if (ang > kn) { const want = kn + (mx - kn) * (1 - Math.exp(-(ang - kn) / (mx - kn))), ax = v3.cross(fg, fd), al = v3.len(ax);
          if (al > 1e-4) { const lim = quat.mul(quat.axisAngle(v3.scale(ax, 1 / al), (ang - want) * own), tg.rot);
            twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tg.at, pole, pole ? poleW : 0, lim); this.kitLie = quat.mul(quat.conj(lim), tg.rot); } } }
    }
    { const c = (i: number) => lerp(K.open[i], K.fist[i], grip); this.hand(pB, 1, [c(0), c(1), c(2), c(3)], lerp(0.25, 0.6, grip), 0.1 * (1 - grip)); }
    if (tl) twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tl.at, null, 0, tl.rot);
    const m = this.dynMask; m.fill(0);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    setSub(nd.upperArmR, 1); if (tl) { setSub(nd.upperArmL, 1); setSub(nd.handL, 1 - join); m[nd.handL] = 1; }   // (the support hand's fingers go back to the pose's as it joins)
    blendPose(pA, pB, 1, m, pA);
    this.kitHold = hold; this.kitStow = stow; this.kitRoll = roll;
    k.t += dt; if (k.t >= k.D) this.kit = null;   // (this frame's outputs stand; the next frame's update lets go of them)
  }
  /** THE READY POSE (ready / READY) — a small layer, not an animation: Sam standing (or crouched) in an open hands-on window, saying so with his body before the
   *  row is read. Weight `w` (update()'s eased readyW), `live` = still asked for (else it is on its way out: the numbers stand, only the weight goes). First the
   *  TRUNK, straight into pA by the weight: the upper spine bowed toward the man (spine2 / spine3; the neck and head levelled back out of it so the eyes stay on
   *  him) and, for the guard, the whole spine bladed left shoulder forward (the head turned back by as much). Then the ARMS by IK on a copy against that body, in
   *  the SHOULDERS' frame as it now stands — so standing, crouched, walking or under the aim clip the hands sit where they do relative to his own shoulders — and
   *  blended in shoulder → elbow → hand through dynMask: the LEFT always; the RIGHT by the kind's share ('grabGun' none: the pistol stays on its aim and only the
   *  support hand leaves it — this runs after the aim clip and the carries, so the hand it takes off the gun is the hand that shows). The REACH (grab / grabGun /
   *  seat) goes for readyAt, a WORLD point: brought in through posIn / bodyYawIn and the inverse of the chest twist still to come (untwist), so the aim's yaw does
   *  not carry the hand round off the man; READY has how far. A right fist that holds a can (grip[1]) keeps the fingers it has. Every number is eased (rd, at
   *  READY_RATE; snapped on the frame the layer starts, and the right hand's whenever it had no share), so grab ↔ strike ↔ seat — or the nearest man changing —
   *  crosses over rather than pops. twY / twP: the twist's numbers, as doorLayer takes them. */
  /** HOLD.catch, the arm's last word: the layers that run after the hold's (the crouch he is still rising out of, the creep's lean and drop, the reach on its
   *  way out) move his trunk under an arm already solved — the hand came round 10 cm under its keys. So the left hand is put ON the hold's target here, after
   *  them, coming over from wherever they left it in the grab's first frames; and while the reach is up with no hold, where it has the hand is noted — the
   *  grab's path starts there (holdLayer: hdFrom). Nothing runs with HOLD.catchShape down, or with a knife or a gun in the hold. */
  private catchFix() {
    const X = this.hdFix; this.hdFix = null;
    if (!HOLD.catchShape || !this.noKnife) { this.rdHandL = null; return; }
    const pA = this.pA, nd = this.nodes, fk = this.fk;
    if (X) { fk.run(pA); const r0 = [...fk.rot[nd.handL]] as Quat; twoBoneIK(fk, pA, nd.upperArmL, nd.forearmL, nd.handL, v3.lerp(fk.pos[nd.handL], X.tgt, X.w), X.pole, X.poleW, quat.nlerp(r0, X.rot, X.rw)); }
    else if (!this.holdPose) { if (this.readyW > 0.003 && this.readyK === 'grab') { fk.run(pA); this.rdHandL = v3.copy(fk.pos[nd.handL]); } else this.rdHandL = null; }
  }
  private readyLayer(w: number, kind: ReadyKind, live: boolean, dt: number, twY: number, twP: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, K = READY[kind], c = this.rd;
    const k = !this.rdLive ? 1 : live ? 1 - Math.exp(-READY_RATE * dt) : 0;
    const ease = (i: number, v: number, q = k) => { c[i] += (v - c[i]) * q; }, ease3 = (i: number, v: Vec3, q = k) => { ease(i, v[0], q); ease(i + 1, v[1], q); ease(i + 2, v[2], q); };
    const get3 = (i: number): Vec3 => [c[i], c[i + 1], c[i + 2]];
    const e = w * w * (3 - 2 * w);
    // ---- the trunk: which way the man is from the chest (flat, within a radian of dead ahead), the bow toward him, the guard's blade
    fk.run(pA);
    const wp = this.rdAt ? this.toModelP(this.rdAt) : null;
    { let a = 0; if (wp) { const g = this.untwist(twY, twP)(wp), o = fk.pos[nd.spine3]; a = clamp(Math.atan2(g[0] - o[0], g[2] - o[2]), -1, 1); }
      ease(RD.into, Math.sin(a)); ease(RD.into + 1, Math.cos(a)); ease(RD.lean, K.lean * DEGR); ease(RD.blade, K.blade * DEGR); ease(RD.clav, K.clav * DEGR);
      if (!this.rdLive) c[RD.up] = 0;   // (READY_UP: never snapped — it comes in from the reach as it was, at its own rate)
      if (this.readyUp > 0 || c[RD.up] > 1e-4) { const to = this.readyUp > 0 && wp && kind === 'grab' ? this.readyUp * smoothstep(READY_UP.over[0], READY_UP.over[1], this.untwist(twY, twP)(wp)[1] - fk.pos[nd.upperArmL][1]) : 0;   // (the grab alone: a pistol that is up keeps its aim — 'grabGun' — and a seated man is under him)
        ease(RD.up, to, live ? 1 - Math.exp(-READY_UP.rate * dt) : 0); if (to === 0 && c[RD.up] < 1e-4) c[RD.up] = 0; } }   // (READY_UP: how far over his own shoulder the point is)
    const lean = c[RD.lean] * e, blade = c[RD.blade] * e, hi = c[RD.up] * e;
    if (lean > 1e-4) {
      const ax = v3.normalize(v3.cross(AY, [c[RD.into], 0, c[RD.into + 1] + 1e-6]));   // (bowing toward +Z is + about +X = up × Z)
      this.turn(pA, nd.spine2, quat.axisAngle(ax, lean * 0.45)); this.turn(pA, nd.spine3, quat.axisAngle(ax, lean * 0.55));
      this.turn(pA, nd.neck, quat.axisAngle(ax, -lean * 0.45)); this.turn(pA, nd.head, quat.axisAngle(ax, -lean * 0.55));
    }
    if (hi > 1e-4) {   // (READY_UP: up out of the crouch's bow toward the man who stands over him)
      const ax = v3.normalize(v3.cross(AY, [c[RD.into], 0, c[RD.into + 1] + 1e-6])), r = hi * READY_UP.rise * DEGR;
      this.turn(pA, nd.spine1, quat.axisAngle(ax, -r * 0.3)); this.turn(pA, nd.spine2, quat.axisAngle(ax, -r * 0.35)); this.turn(pA, nd.spine3, quat.axisAngle(ax, -r * 0.35));
      this.turn(pA, nd.neck, quat.axisAngle(ax, r * READY_UP.look * 0.45)); this.turn(pA, nd.head, quat.axisAngle(ax, r * READY_UP.look * 0.55));
    }
    if (blade > 1e-4) {   // (− yaw swings his left shoulder toward +Z)
      this.turn(pA, nd.spine1, qYaw(-blade * 0.25)); this.turn(pA, nd.spine2, qYaw(-blade * 0.35)); this.turn(pA, nd.spine3, qYaw(-blade * 0.4));
      this.turn(pA, nd.neck, qYaw(blade * 0.4)); this.turn(pA, nd.head, qYaw(blade * 0.6));
    }
    // ---- the arms, on a copy: the left clavicle forward with a reach, then the shoulders' frame as it stands
    pB.copy(pA); fk.run(pB);
    if (c[RD.clav] * e > 1e-4) { this.turn(pB, nd.shoulderL, qYaw(-c[RD.clav] * e)); fk.run(pB); }
    const sl = v3.copy(fk.pos[nd.upperArmL]), sr = v3.copy(fk.pos[nd.upperArmR]);
    let fx = -(sl[2] - sr[2]), fz = sl[0] - sr[0]; { const L = hyp2(fx, fz) || 1; fx /= L; fz /= L; }   // forward, square to the shoulder line (his left = (fz, 0, −fx))
    const bare = this.noKnife && kind === 'grab' && !this.grip[1];   // (READY_BARE: nothing of his is a knife — both hands are the move's)
    if (live) {
      const arm = v3.dist(sl, fk.pos[nd.forearmL]) + v3.dist(fk.pos[nd.forearmL], fk.pos[nd.handL]);
      let az = 0, h = 0, up = 0, oL: Vec3; const R = K.L.reach;
      const frame = (v: Vec3, t: number): Vec3 => { const ct = Math.cos(t), st = Math.sin(t), l = v[0] * ct + v[2] * st, f = v[2] * ct - v[0] * st; return [fz * l + fx * f, v[1], fz * f - fx * l]; };   // (left, up, forward) in the shoulders' frame turned t toward his left → model axes
      if (wp) { const g = this.untwist(twY, twP)(wp), d = v3.sub(g, sl), a = d[0] * fx + d[2] * fz, b = d[0] * fz - d[2] * fx; h = hyp2(a, b); up = d[1]; if (h > 0.05) az = clamp(Math.atan2(b, a), -READY_AZ[0], READY_AZ[1]); }   // where the man is off the left shoulder: level run, height, bearing off square (+ = his left)
      if (R) {
        if (!wp) { h = R.h0; up = R.y0; }
        const q = c[RD.up];   // (READY_UP: 0 unless fed — the bounds as they were)
        const WY = READY_BARE.way, lift = bare && HOLD.wayShape ? smoothstep(WY.lift[0], WY.lift[1], this.rdA) : 1;   // (1 unless fed a part of the reach)
        oL = bare ? frame([0, lerp(WY.low, clamp(READY_BARE.L.frac * up + R.bias, R.dy[0], READY_BARE.L.dy), lift), lerp(WY.near, clamp(R.frac * h, READY_BARE.L.r[0], Math.max(READY_BARE.L.r[0], Math.min(READY_BARE.L.r[1], h - READY_BARE.L.short))), lift)], az)   // (READY_BARE: out ahead of his own shoulder, never over his head)
          : frame([0, clamp(R.frac * up + R.bias, R.dy[0], lerp(R.dy[1], READY_UP.dy, q)), clamp(R.frac * h, lerp(R.r[0], READY_UP.r[0], q), lerp(R.r[1], READY_UP.r[1], q))], az);
        const l = v3.len(oL), cap = READY_REACH * arm; if (l > cap) oL = v3.scale(oL, cap / l);
      } else oL = frame(K.L.at!, az);   // (a fixed spot is still turned to face him: the guard's lead hand is out toward the man)
      const B = bare ? (HOLD.wayShape ? READY_BARE.L : READY_BARE_WAS.L) : K.L;
      ease3(RD.l, oL); ease3(RD.lPole, frame(B.pole, az)); ease3(RD.lFing, frame(c[RD.up] > 1e-4 ? [B.fing[0], B.fing[1] + READY_UP.fing * c[RD.up], B.fing[2]] : B.fing, az)); ease3(RD.lBack, frame(B.back, az));
      ease(RD.lCurl, B.curl); ease(RD.lThumb, B.thumb); ease(RD.lSpread, B.spread);
      if (bare) { const R2 = HOLD.wayShape ? READY_BARE.R : READY_BARE_WAS.R, kr = c[RD.wR] < 1e-3 ? 1 : k;   // (the right hand's numbers snap when it had no share: it comes in from the arm as it is, by the weight)
        ease3(RD.r, frame(R2.at, az), kr); ease3(RD.rPole, frame(R2.pole, az), kr); ease3(RD.rFing, frame(R2.fing, az), kr); ease3(RD.rBack, frame(R2.back, az), kr); ease(RD.rCurl, R2.curl, kr); ease(RD.rThumb, R2.thumb, kr); }
      ease(RD.wR, bare ? 1 : 0);
    }
    else if (!this.rdLive) c[RD.wR] = 0;
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(sl, get3(RD.l)), get3(RD.lPole), 0.85, this.handRot(0, get3(RD.lFing), get3(RD.lBack)));
    { const q = c[RD.lCurl]; this.hand(pB, 0, [q, q + 0.04, q + 0.08, q + 0.12], c[RD.lThumb], c[RD.lSpread]); }
    // ---- the right hand on the knife (REACH): u = the reach's clock, the arm's share its alone (not the pose's weight: the hand that leaves the hilt is seen
    //      leaving it after the rest of the pose has gone). The fist closes on the sheathed handle where rigProps draws it; the knife stays where it is.
    const wRb = this.rcT > 0 ? 0 : c[RD.wR] * this.rdOutR * (HOLD.wayShape ? smoothstep(READY_BARE.way.right[0], READY_BARE.way.right[1], this.rdA) : 1);   // (READY_BARE.way: the right hand comes off his ribs for the last stretch only)
    if (wRb > 1e-3) {   // (READY_BARE: the right hand low and ahead of his hip — never under a hand that is on a hilt)
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.add(sr, get3(RD.r)), get3(RD.rPole), 0.85, this.handRot(1, get3(RD.rFing), get3(RD.rBack)));
      const q = c[RD.rCurl]; this.hand(pB, 1, [q, q + 0.04, q + 0.08, q + 0.12], c[RD.rThumb]);
    }
    const u = this.rcT;
    if (u > 0) {
      const S = this.sheathFist();
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, S.at, S.pole, 0.9, S.rot);
      if (this.closeK >= 0) {   // (KIT.close: the fist on the hilt is alive — every `regrip` s the fingers let go a little, little finger first, and close again; the thumb shifts with them)
        const KC = KIT.close, ph = (this.clT % KC.regrip) / KC.regrip, g = (d: number) => bump(ph, 0.55 + d, 0.66 + d, 0.72 + d, 0.86 + d);
        this.hand(pB, 1, [REACH.curl[0] - 0.14 * g(0.06), REACH.curl[1] - 0.2 * g(0.04), REACH.curl[2] - 0.26 * g(0.02), REACH.curl[3] - 0.3 * g(0)], REACH.thumb - 0.25 * g(0.03));
      } else
      this.hand(pB, 1, REACH.curl, REACH.thumb);   // a fist round the handle (the hold's own)
    }
    // staggered, as the signals: the clavicle / upper arm lead, the forearm and the hand a little behind — in, and out in the same order
    const m = this.dynMask; m.fill(0);
    const wUp = smoothstep(0, 0.75, w), wFore = smoothstep(0.08, 0.88, w), wHand = smoothstep(0.16, 1, w);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    let lg = 1;   // KIT.close: the left arm's move for the man waits for the right hand to be on the hilt (a pistol in that hand: no wait — the reach is all the tell there is)
    if (this.closeK >= 0 && K.knife && !this.noKnife) { const KC = KIT.close; if (!this.rdLive) this.clL = 0; this.clL = clamp(this.clL + (live && u >= KC.leftAt ? dt / (KC.leftIn * (1 + READY_UP.slow * c[RD.up])) : -dt / KC.leftOut), 0, 1);   /* (READY_UP: the longer way up takes that much longer — 1 unless fed) */ lg = this.clL * this.clL * (3 - 2 * this.clL); }
    m[nd.shoulderL] = wUp * lg; m[nd.upperArmL] = wUp * lg; m[nd.forearmL] = wFore * lg; setSub(nd.handL, wHand * lg);
    this.reachShown = smoothstep(0.16, 1, u);
    if (u > 0) { m[nd.shoulderR] = m[nd.upperArmR] = smoothstep(0, 0.75, u); m[nd.forearmR] = smoothstep(0.08, 0.88, u); setSub(nd.handR, this.reachShown); }
    else if (wRb > 1e-3) { m[nd.shoulderR] = m[nd.upperArmR] = wUp * wRb; m[nd.forearmR] = wFore * wRb; setSub(nd.handR, wHand * wRb); }
    blendPose(pA, pB, 1, m, pA);
    this.readyShown = w; this.rdLive = true;
  }
  /** THE HAND ON THE HILT (REACH; rigProps RIG.sheath — the one record the drawn sheath and this hand share): off the pose `fk` holds, the right wrist's spot,
   *  the fist's rotation and the elbow's pole (model space) with the fist closed on the sheathed handle — the knife's own line through the fist's thumb side,
   *  the back of the hand off the chest, the grip's middle (RIG.knife.grip) on the handle's. The chest joint's frame: its rotation off the rest pose's, so the
   *  twist still to come carries hand and sheath together. `pull` m back down the knife's line, `off` m further off the chest: the way out of the sheath. */
  private sheathFist(pull = 0, off = 0): { at: Vec3; rot: Quat; pole: Vec3 } {
    const fk = this.fk, nd = this.nodes, S = RIG.sheath, G = RIG.knife.grip;
    if (!this.rcInv) { const f = new PoseFK(this.ch); f.run(restPose(this.ch, new Pose(this.ch.nodes.length))); this.rcInv = quat.conj(f.rot[nd.spine3]); }
    const q = quat.mul(fk.rot[nd.spine3], this.rcInv);
    const T = v3.normalize(quat.rotate(q, S.along)), B0 = quat.rotate(q, S.out), B = v3.normalize(v3.mad(B0, T, -v3.dot(B0, T))), F = v3.cross(T, B);
    const h = v3.mad(v3.mad(v3.add(fk.pos[nd.spine3], quat.rotate(q, S.at)), T, -pull), B, off);
    return { at: v3.mad(v3.mad(v3.mad(h, F, -G.fwd), B, G.palm), T, -G.side), rot: this.knifeRot(T, B), pole: v3.mad(v3.normalize(quat.rotate(q, REACH.pole)), AY, lerp(REACH.poleUp[0], REACH.poleUp[1], clamp(this.crouch, 0, 1))) };
  }
  /** a takedown's clocks, ahead of the pose (update, where the crouch shown is decided): the move's and the reaction's own seconds, the blow's points riding
   *  the man, and the crouch they leave — the attacker RISES out of it through the wind-up and the hit (never under a ceiling: BlowRun.rise), then SINKS to a
   *  crouch over the man for the move's tail instead of standing there; the man it lands on SAGS */
  private takePre(dt: number, cp: number): number {
    const B = this.bw, T = this.tk;
    if (!B) this.bwRise = 0;
    if (B) {
      B.t += dt;
      if (B.t >= B.end + B.tail) { this.bw = null; this.bwRise = 0; }
      else {
        if (B.live && (B.t < B.hit || B.style === 'mouth')) { const [a, a2] = B.live(); if (B.t < B.hit) B.at = a; if (a2) B.at2 = a2; }
        this.bwRise = B.rise ? BLOW.rise[B.style] * bump(B.t, 0, 0.6 * B.hit, B.hit + 0.1, B.end) : 0; cp *= 1 - this.bwRise;
        if (B.tail > 0) cp = Math.max(cp, BLOW.sink[B.style] * this.blowTail(B));
      }
    }
    if (T) {
      T.t += dt; const u = T.t - T.delay; if (T.off >= 0) T.off += dt;
      if (u >= TAKEN.secs || T.off >= 0.2) this.tk = null;
      else if (u > 0) cp = Math.max(cp, TAKEN.sag[T.style] * smoothstep(0, 0.3, u) * (1 - smoothstep(0.6, TAKEN.secs, u)) * (T.off < 0 ? 1 : 1 - T.off / 0.2));
    }
    return cp;
  }
  /** how far into the move's TAIL he is, 0‥1: in from just after the hit to a little past the move's end, held, out over its last 0.45 s — and let go of as he walks off */
  private blowTail(B: BlowRun): number {
    const X = B.end + B.tail;
    return bump(B.t, B.hit + 0.08, B.end + 0.1, X - 0.45, X) * (1 - smoothstep(BLOW.walk[0], BLOW.walk[1], Math.abs(this.speed)));
  }
  /** …the LEGS (on pA, ahead of everything the move does above the hips): the close-in carriage holds him in a long lunge — by contact the rear foot has been
   *  drawn in under him and both knees are near straight, the pelvis up and over the feet: he stands INTO the man. The feet's own places otherwise; let go
   *  after the move's end (the sink of the tail takes over through the crouch shown). Nothing where he may not rise. */
  private blowLegs(B: BlowRun) {
    if (!B.rise) return;
    const L = BLOW.legs, u = smoothstep(0, 0.85 * B.hit, B.t), w = u * (1 - smoothstep(B.hit + 0.12, B.end + (B.tail > 0 ? 0.05 : 0), B.t)); if (w < 0.003) return;
    const pA = this.pA, nd = this.nodes, fk = this.fk; this.fkPart(pA, this.fkLegs);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const back = fL[2] < fR[2] ? fL : fR, front = back === fL ? fR : fL, dz = front[2] - back[2] - L.gap;
    if (dz > 0) { back[2] += dz * w; back[1] += (front[1] - back[1]) * w * 0.8 + L.lift * 4 * u * (1 - u) * Math.min(1, dz / 0.25); }   // (…and its heel comes down as it lands)
    const hp = fk.pos[nd.hips], hz = ((fL[2] + fR[2]) / 2 - hp[2]) * L.fwd * w;
    let up = L.up;
    for (const [th, sh, ft, f] of [[nd.thighL, nd.shinL, nd.footL, fL], [nd.thighR, nd.shinR, nd.footR, fR]] as [number, number, number, Vec3][]) {
      const a = fk.pos[th], len = (v3.dist(a, fk.pos[sh]) + v3.dist(fk.pos[sh], fk.pos[ft])) * L.straight, hx = a[0] - f[0], hzz = a[2] + hz - f[2], q = len * len - hx * hx - hzz * hzz;
      up = Math.min(up, q > 0 ? Math.sqrt(q) - (a[1] - f[1]) : 0);
    }
    this.shift(pA, nd.hips, [0, Math.max(0, up) * w, hz]); this.fkPart(pA, this.fkLegs);
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0, rR, true);
  }
  /** …the TRUNK's share of the move, on pA (every one is delivered by the body, the arm its last link): the chop rears back and round onto the cocked fist,
   *  then folds well down after it and stays over him; the palm heel loads low and drives up through, the chest opening behind the locked arm; the hand over
   *  the mouth leans in, hauls back, then bends over the man as he is let down; the slash unwinds across and up */
  private blowTrunk(B: BlowRun) {
    const t = B.t, H = B.hit, E = B.end, out = 1 - smoothstep(E - 0.2, E, t), nd = this.nodes, pA = this.pA; let pt = 0, yw = 0;
    const tl = B.tail > 0 ? this.blowTail(B) : 0;
    if (B.style === 'chop') { pt = -10 * bump(t, 0.05, 0.5 * H, 0.75 * H, H) + 40 * smoothstep(0.75 * H, H + 0.14, t) * Math.max(out, 0.55 * tl); yw = -16 * bump(t, 0, 0.5 * H, 0.72 * H, H) + 18 * smoothstep(0.72 * H, H + 0.04, t) * out; }
    else if (B.style === 'palm') { pt = 14 * bump(t, 0, 0.45 * H, 0.7 * H, H) - 14 * bump(t, 0.8 * H, H + 0.08, E - 0.14, E) + 14 * tl; yw = -14 * bump(t, 0, 0.45 * H, 0.7 * H, H) + 24 * smoothstep(0.7 * H, H + 0.06, t) * out; }
    else if (B.style === 'mouth') pt = 8 * bump(t, 0, 0.12, H - 0.06, H) - 8 * bump(t, H - 0.04, H + 0.08, H + 0.2, E) + 34 * tl;
    else if (B.style === 'slash') { pt = -8 * smoothstep(H, H + 0.1, t) * out + 12 * tl; yw = 14 * bump(t, 0, 0.5 * H, 0.7 * H, H) - 26 * smoothstep(0.7 * H, H + 0.08, t) * out; }
    else pt = 5 * bump(t, 0, 0.5 * H, H, H + 0.12) + 12 * tl;
    if (!pt && !yw) return;
    const q = quat.mul(qYaw(yw * 0.5 * DEGR), qPitch(pt * 0.5 * DEGR));
    this.turn(pA, nd.spine2, q); this.turn(pA, nd.spine3, q); this.turn(pA, nd.neck, qPitch(-pt * 0.5 * DEGR));
  }
  /** …and the ARMS, by IK on a copy of pA (the knife styles' right arm is knifeBlow's own). The RIGHT: chop — the fist cocked behind the ear with the ELBOW the
   *  high point, held, then hammered down onto `at` and on down his back; palm — loaded low at his own centre, the heel of the open hand driven up onto `at`
   *  and through, the arm LOCKED OUT above head height. The LEFT: chop — flat on his back at `at2`, measuring, until the blow lands; mouth — over his mouth
   *  at `at2`, riding his head for the length of the knife's work and DOWN with him as he is lowered; the rest — thrown straight back and down, locked. The
   *  eyes stay on the mark. A gun arm at the aim keeps its gun (the layer gives way to it). Returns the layer's weight (the hand pass leaves its hands alone). */
  private blowArms(B: BlowRun, twY: number, twP: number): number {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, t = B.t, H = B.hit, E = B.end, st = B.style;
    const free = 1 - clamp(this.upperW.aim, 0, 1), X = E + B.tail;
    const wAll = smoothstep(0, 0.5 * H, t) * (1 - smoothstep(E - 0.16, E, t)) * free;
    if (wAll <= 0 && !(st === 'mouth' && t < X)) return 0;
    pB.copy(pA); fk.run(pB);
    const un = this.untwist(twY, twP), T = un(this.toModelP(B.at)), T2 = B.at2 ? un(this.toModelP(B.at2)) : null;
    const sl = v3.copy(fk.pos[nd.upperArmL]), sr = v3.copy(fk.pos[nd.upperArmR]);
    const armR = v3.dist(sr, fk.pos[nd.forearmR]) + v3.dist(fk.pos[nd.forearmR], fk.pos[nd.handR]), armL = v3.dist(sl, fk.pos[nd.forearmL]) + v3.dist(fk.pos[nd.forearmL], fk.pos[nd.handL]);
    const cap = (s: Vec3, p: Vec3, arm: number): Vec3 => { const o = v3.sub(p, s), l = v3.len(o), c = BLOW.reach * arm; return l > c ? v3.mad(s, o, c / l) : p; };
    const lock = (s: Vec3, d: Vec3, arm: number): Vec3 => v3.mad(s, v3.normalize(d), BLOW.reach * arm);   // the arm thrown out straight along d
    const m = this.dynMask; m.fill(0);
    const setSub = (j: number, wv: number) => { m[j] = wv; for (const ch of this.ch.nodes[j].children) setSub(ch, wv); };
    if ((st === 'chop' || st === 'palm') && wAll > 0) {
      type AK = { t: number; at: Vec3; f: Vec3; b: Vec3; pole: Vec3 };
      const thru = v3.sub(T, sr);
      const keys: AK[] = st === 'chop' ? [
        { t: 0.5 * H, at: v3.add(sr, [0.02, 0.12, -0.14]), f: [0.2, 0.3, -0.9], b: [-1, 0, 0], pole: [-0.7, 1, -0.4] },
        { t: 0.72 * H, at: v3.add(sr, [0.03, 0.13, -0.17]), f: [0.2, 0.3, -0.9], b: [-1, 0, 0], pole: [-0.7, 1, -0.4] },
        { t: H, at: cap(sr, T, armR), f: [0.1, -0.45, 0.9], b: [-1, 0.2, 0], pole: [-0.8, 0.1, -0.3] },
        { t: H + 0.1, at: cap(sr, v3.add(T, [0, -0.32, 0.06]), armR), f: [0.1, -0.8, 0.6], b: [-1, 0.2, 0], pole: [-0.8, -0.2, -0.4] },
        { t: H + 0.22, at: cap(sr, v3.add(T, [0, -0.5, 0.1]), armR), f: [0.1, -0.9, 0.4], b: [-1, 0.2, 0], pole: [-0.8, -0.2, -0.5] },
      ] : [
        { t: 0.5 * H, at: v3.add(sr, [0.16, -0.34, 0.2]), f: [0, 0.9, 0.3], b: [0, 0.3, -0.9], pole: [-0.4, -0.7, -0.5] },
        { t: H, at: cap(sr, T, armR), f: [0, 0.9, -0.3], b: [0, -0.3, -0.9], pole: [-0.5, -0.8, -0.2] },
        { t: H + 0.09, at: lock(sr, [thru[0] * 0.6, Math.max(thru[1], 0) + 0.34, Math.max(thru[2], 0.1) * 0.9], armR), f: [0, 0.8, -0.5], b: [0, -0.5, -0.8], pole: [-0.5, -0.8, -0.2] },
        { t: E - 0.14, at: lock(sr, [thru[0] * 0.5, Math.max(thru[1], 0) + 0.4, Math.max(thru[2], 0.1) * 0.8], armR), f: [0, 0.8, -0.5], b: [0, -0.5, -0.8], pole: [-0.5, -0.8, -0.2] },
      ];
      let i = 0; while (i < keys.length - 1 && t >= keys[i + 1].t) i++;
      const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b === a || t <= a.t ? 0 : clamp((t - a.t) / (b.t - a.t), 0, 1), e = b.t === H ? u * u : u * u * (3 - 2 * u);   // (into the hit it only gathers speed)
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(a.at, b.at, e), v3.lerp(a.pole, b.pole, e), 0.85, quat.slerp(this.handRot(1, a.f, a.b), this.handRot(1, b.f, b.b), e));
      this.hand(pB, 1, st === 'chop' ? BLOW.fist : BLOW.open, st === 'chop' ? 0.6 : 0.2);
      m[nd.shoulderR] = m[nd.upperArmR] = m[nd.forearmR] = wAll; setSub(nd.handR, wAll);
    }
    let wL = 0;
    if (st === 'chop' && T2) {
      wL = bump(t, 0.04, 0.5 * H, H - 0.02, H + 0.15) * free; fk.run(pB);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, cap(sl, T2, armL), [0.6, -0.7, -0.2], 0.8, this.handRot(0, [0, 1, 0.2], [0, 0.2, -1]));
      this.hand(pB, 0, BLOW.open, 0.2);
    } else if (st === 'mouth' && T2) {
      wL = bump(t, 0.03, 0.14, B.tail > 0 ? X - 0.5 : E - 0.18, B.tail > 0 ? X - 0.2 : E - 0.04) * free * (B.tail > 0 && t > E ? 1 - smoothstep(BLOW.walk[0], BLOW.walk[1], Math.abs(this.speed)) : 1); fk.run(pB);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, cap(sl, T2, armL), [0.8, -0.5, 0], 0.8, this.handRot(0, [-1, 0, 0.1], [0.1, 0, 1]));
      this.hand(pB, 0, BLOW.cup, 0.3);
    } else if (st !== 'chop' && st !== 'mouth') {
      wL = bump(t, 0.4 * H, H, E - 0.2, E) * free; fk.run(pB);
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, lock(sl, [0.16, -0.72, -0.68], armL), [0.5, 0.2, -0.8], 0.6, this.handRot(0, [0.15, -0.7, -0.7], [1, 0.2, 0.1]));
      this.hand(pB, 0, BLOW.loose, 0.3);
    }
    if (wL > 0) { m[nd.shoulderL] = m[nd.upperArmL] = m[nd.forearmL] = wL; setSub(nd.handL, wL); }
    blendPose(pA, pB, 1, m, pA);
    if (wAll > 0) { fk.run(pA); this.lookAt(pA, T, 0.6 * wAll); }
    return Math.max(wAll, wL);
  }
  /** the man a takedown is done to, still on his feet (taken()): head, trunk and — hauled back — his arms; pitch only: where he looks on the plan does not turn */
  private takenLayer(T: { style: TakenStyle; t: number; delay: number; off: number }) {
    const u = T.t - T.delay; if (u <= 0) return;
    const out = (1 - smoothstep(0.6, TAKEN.secs, u)) * (T.off < 0 ? 1 : 1 - smoothstep(0, 0.2, T.off)), nd = this.nodes, pA = this.pA, D = DEGR;
    if (T.style === 'arch') {   // hauled back onto the knife man's shoulder: the whole back bowed, the head right over, the arms flung out in front of him
      const a = smoothstep(0, 0.1, u) * out, r = smoothstep(0.02, 0.16, u) * out;
      this.turn(pA, nd.spine1, qPitch(-8 * a * D)); this.turn(pA, nd.spine2, qPitch(-10 * a * D)); this.turn(pA, nd.spine3, qPitch(-10 * a * D)); this.turn(pA, nd.neck, qPitch(-10 * a * D)); this.turn(pA, nd.head, qPitch(-16 * a * D));
      this.turn(pA, nd.upperArmL, qPitch(-38 * r * D)); this.turn(pA, nd.upperArmR, qPitch(-34 * r * D)); this.turn(pA, nd.forearmL, qPitch(-30 * r * D)); this.turn(pA, nd.forearmR, qPitch(-36 * r * D));
    } else if (T.style === 'hunch') {   // struck on the base of the skull: the chin snaps to the chest, the shoulders come up round it, the trunk follows
      const s = smoothstep(0, 0.06, u) * out, b = smoothstep(0, 0.2, u) * out;
      this.turn(pA, nd.spine2, qPitch(8 * b * D)); this.turn(pA, nd.spine3, qPitch(8 * b * D)); this.turn(pA, nd.neck, qPitch(16 * s * D)); this.turn(pA, nd.head, qPitch(26 * s * D));
      this.turn(pA, nd.shoulderL, qRoll(10 * s * D)); this.turn(pA, nd.shoulderR, qRoll(-10 * s * D));
    } else {   // the heel of a hand under the chin: the head goes back, the trunk after it
      const s = smoothstep(0, 0.05, u) * out, b = smoothstep(0, 0.18, u) * out;
      this.turn(pA, nd.spine2, qPitch(-4.5 * b * D)); this.turn(pA, nd.spine3, qPitch(-4.5 * b * D)); this.turn(pA, nd.neck, qPitch(-12 * s * D)); this.turn(pA, nd.head, qPitch(-18 * s * D));
    }
  }
  /** THE KNIFE'S BLOW (strike(kind, true); KNIFE_BLOW) — the right arm over the punch clip's pose in pA, by IK on a copy: to the hilt (at once if the tell had
   *  it there: kbR0), the knife drawn down out of the sheath, through the kind's keys — eased key to key, the wrist's spots off the right shoulder as the clip
   *  carries it, turned onto the man —, back to the sheath's mouth and home; then the arm goes back to whatever the pose under it has (the hand resting on the
   *  hilt while the tell is still up) over the last `fade` s of the clip. `total` = the clip's length in real seconds; the keys are squeezed to fit a shorter
   *  one. knifeShown: true while the fist is anywhere but on the hilt. twY / twP as readyLayer's. */
  private knifeBlow(kind: StrikeKind, dt: number, total: number, twY: number, twP: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, KB = KNIFE_BLOW, K = this.kbSlash ? KNIFE_SLASH : this.kbBack ? KNIFE_BACK : KB[kind];
    const t0 = KB.snap * (1 - this.kbR0), fit = Math.min(1, Math.max(0.2, total - KB.fade - t0 - 0.035) / K.end), t = (this.kbT - t0) / fit;   // key time: 0 = on the hilt, K.end = back on it
    this.kbT += dt;
    pB.copy(pA); fk.run(pB);
    const sl = fk.pos[nd.upperArmL], sr = v3.copy(fk.pos[nd.upperArmR]), arm = v3.dist(sr, fk.pos[nd.forearmR]) + v3.dist(fk.pos[nd.forearmR], fk.pos[nd.handR]);
    let az = 0; if (this.rdAt) { const g = this.untwist(twY, twP)(this.toModelP(this.rdAt)), mx = (sl[0] + sr[0]) / 2, mz = (sl[2] + sr[2]) / 2; if (hyp2(g[0] - mx, g[2] - mz) > 0.05) az = clamp(Math.atan2(g[0] - mx, g[2] - mz), -KB.az, KB.az); }
    const ca = Math.cos(az), sa = Math.sin(az), fr = (v: Vec3): Vec3 => [v[0] * ca + v[2] * sa, v[1], v[2] * ca - v[0] * sa];   // (left, up, forward) turned az toward his left → model axes
    const stop = (i: number): { at: Vec3; rot: Quat; pole: Vec3 } => {   // 0 hilt · 1 clear of the sheath · 2‥ the keys · then clear · hilt
      const n = K.keys.length;
      if (i <= 0 || i >= n + 3) return this.sheathFist();
      if (i === 1 || i === n + 2) return this.sheathFist(KB.clear[0], KB.clear[1]);
      const k = K.keys[i - 2]; let o = fr(k.at); const l = v3.len(o), cap = KB.reach * arm; if (l > cap) o = v3.scale(o, cap / l);
      const T = fr(k.blade); return { at: v3.add(sr, o), rot: this.knifeRot(T, v3.cross(fr(k.fing), T)), pole: fr(k.pole) };
    };
    const n = K.keys.length, ts = [0, KB.tClear, ...K.keys.map(k => k.t), K.end - KB.tClear, K.end];
    let i = 0; while (i < n + 2 && t >= ts[i + 1]) i++;
    const a = stop(i), b = stop(Math.min(i + 1, n + 3)), e = i >= n + 3 || t <= 0 ? 0 : smoothstep(ts[i], ts[i + 1], t);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(a.at, b.at, e), v3.lerp(a.pole, b.pole, e), 0.9, quat.slerp(a.rot, b.rot, e));
    this.hand(pB, 1, REACH.curl, REACH.thumb);
    const under = this.rcT > 0 ? this.reachShown : 0;   // what the arm goes back to: the hand on the hilt, or nothing of this
    const w = lerp(under, 1, Math.max(this.kbR0, smoothstep(0, t0 || 1e-6, this.kbT)) * (1 - smoothstep(total - KB.fade, total, this.kbT)));
    const m = this.dynMask; m.fill(0);
    const setSub = (j: number, wv: number) => { m[j] = wv; for (const ch of this.ch.nodes[j].children) setSub(ch, wv); };
    m[nd.shoulderR] = m[nd.upperArmR] = m[nd.forearmR] = w; setSub(nd.handR, w);
    blendPose(pA, pB, 1, m, pA);
    this.knifeShown = t > 0 && t < K.end;
  }
  /** Lock work: over the forced crouch the back un-rounds enough to bring the eyes up level with the keyway (the crouch clip alone would leave the head below
   *  the hands), shoulders come up round the ears, and the head is aimed at the lock (look-at on neck + head) and cocked; both hands are IK'd to the keyway — a
   *  model-space point, so the body's breathing moves around still hands: right = the pick, raking / jiggling in an irregular 2–3 Hz rhythm, left = the tension
   *  wrench at the bottom of the keyway with a slow pressure wobble; now and then a pin sets (the pick pauses, the wrench gives a little). */
  private lockpickLayer(w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, t = this.lpT; const at = this.lockpickAt;
    // body, additive × w: extend the crouch clip's rounded spine so the torso sits up toward the lock, shoulders up, then aim the head
    const ext = 28 * DEGR * w;
    this.turn(pA, nd.spine1, qPitch(-ext * 0.36)); this.turn(pA, nd.spine2, qPitch(-ext * 0.39)); this.turn(pA, nd.spine3, qPitch(-ext * 0.25));
    this.turn(pA, nd.neck, qPitch(ext * 0.45)); this.turn(pA, nd.head, qPitch(ext * 0.55));   // (the clip cranes the neck to look ahead from the crouch; sitting up, that crane comes off first)
    this.turn(pA, nd.shoulderL, qRoll(10 * DEGR * w)); this.turn(pA, nd.shoulderR, qRoll(-10 * DEGR * w));
    this.lookAt(pA, at, w, 9 * DEGR * w);
    pB.copy(pA); fk.run(pB);
    // irregular rhythm: a frequency-wobbled rake plus a faster jiggle that comes and goes; every few seconds a pin 'sets' (brief pause + twist of the wrench)
    const rake = Math.sin(t * 2 * Math.PI * 2.3 + 1.4 * Math.sin(t * 2.1)), jig = Math.sin(t * 2 * Math.PI * 3.6) * (0.5 + 0.5 * Math.sin(t * 0.9 + 2));
    const setEv = smoothstep(0.7, 1, Math.sin(t * 1.7) * Math.sin(t * 0.61 + 1));   // sparse 0…1 blips
    const work = 1 - 0.8 * setEv;
    // wrists sit a hand's length back from the door face: the pick reaches the keyway from below-right, the wrench hand lower and to the left
    const pick: Vec3 = [at[0] - 0.04, at[1] - 0.035 + 0.004 * jig * work, at[2] - 0.135 + 0.01 * rake * work];
    const wrench: Vec3 = [at[0] + 0.05, at[1] - 0.075, at[2] - 0.125];
    // right hand: fingers forward into the lock, back of the hand up-and-right (pinch grip on the pick), rolling with the rake
    const rollR = (11 * rake * work + 4 * jig * work - 8 * setEv) * DEGR;
    const bR = quat.rotate(quat.axisAngle(AZ, rollR), v3.normalize([-0.6, 1, 0]));
    const rotR = this.handRot(1, [-0.1, 0.15, 1], bR);
    // left hand: below the keyway, fingers forward-up-right holding the wrench, palm up-ish; slow pressure wobble + the give when a pin sets
    const rollL = (3 * Math.sin(t * 2 * Math.PI * 0.55) + 7 * setEv) * DEGR;
    const fL = v3.normalize([-0.4, 0.5, 1]); const bL = quat.rotate(quat.axisAngle(fL, rollL), v3.normalize([0.35, -1, 0.55]));
    const rotL = this.handRot(0, fL, bL);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, pick, [-0.45, -1, -0.45], 0.75, rotR);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, wrench, [0.3, -1, -0.45], 0.75, rotL, true);
    this.hand(pB, 1, [0.55, 0.7, 0.9, 0.95], 0.75);   // pick pinched between thumb and index, the rest folded
    this.hand(pB, 0, [0.75, 0.8, 0.85, 0.85], 0.6);   // wrapped round the wrench
    blendPose(pA, pB, w, this.armsMask, pA);
  }

  /** Both hands on a body (haul, weight w — hands.ts has the timings): the trunk bows down toward the grip (spine1‥3, the neck and head levelled part of the way
   *  back so he watches what he has hold of), then both arms by IK on a copy — each wrist to its WORLD spot, brought in through posIn / bodyYawIn and the inverse
   *  of the chest twist still to come (untwist) — fingers along the reach and down, backs of the hands up and out, elbows out and back, the fingers closed by the
   *  pose's `grip`; blended in clavicle to fingertips through armsMask. A spot beyond the arm's span is simply reached toward (the IK stops short of lock-out). */
  private haulLayer(w: number, twY: number, twP: number) {
    const H = this.hlLast; if (!H) return;
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    const bow = H.bow * w, rw = clamp(H.rw ?? 1, 0, 1), look = H.look ?? 0.7, tilt = (H.tilt ?? 0) * w;
    if (bow > 1e-4) {
      this.turn(pA, nd.spine1, qPitch(bow * 0.4)); this.turn(pA, nd.spine2, qPitch(bow * 0.35)); this.turn(pA, nd.spine3, qPitch(bow * 0.25));
      this.turn(pA, nd.neck, qPitch(-bow * 0.3)); this.turn(pA, nd.head, qPitch(-bow * 0.3));
    }
    if (Math.abs(tilt) > 1e-4) { this.turn(pA, nd.spine2, qRoll(tilt * 0.5)); this.turn(pA, nd.spine3, qRoll(tilt * 0.5)); this.turn(pA, nd.neck, qRoll(tilt * 0.8)); this.turn(pA, nd.head, qRoll(tilt * 0.8)); }   // the load on his left shoulder: trunk and head tipped off it
    fk.run(pA); const un = this.untwist(twY, twP);
    const tl = un(this.toModelP(H.l)), tr = un(this.toModelP(H.r));
    if (look > 0.01) { const at = v3.lerp(tl, tr, 0.5 * rw); at[2] += 0.45; this.lookAt(pA, at, w * look); }   // (a stride beyond his hands: a grip straight under his eyes has no bearing, and the look's yaw flipped side to side with the walk's sway)
    pB.copy(pA); fk.run(pB);
    const g = clamp(H.grip, 0, 1);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tr, [-0.7, -0.25, -0.65], 0.75, this.handRot(1, [0.12, -0.55, 0.83], [-0.45, 1, 0.5]));
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tl, [0.7, -0.25, -0.65], 0.75, this.handRot(0, [-0.12, -0.55, 0.83], [0.45, 1, 0.5]), true);
    this.hand(pB, 1, [g * 0.85, g * 0.9, g * 0.95, g], g * 0.7); this.hand(pB, 0, [g * 0.85, g * 0.9, g * 0.95, g], g * 0.7);
    if (rw >= 0.999) blendPose(pA, pB, w, this.armsMask, pA);
    else { blendPose(pA, pB, w, this.armLOnly, pA); if (rw > 0.003) blendPose(pA, pB, w * rw, this.armROnly, pA); }
  }

  /** the controller's world placement ↔ the un-twisted model space the layers pose in (posIn / bodyYawIn, fed by Character.update): a point, and a direction */
  private toModelP(wp: Vec3): Vec3 { const cy = Math.cos(this.bodyYawIn), sy = Math.sin(this.bodyYawIn), P0 = this.posIn; const dx = wp[0] - P0[0], dz = wp[2] - P0[2]; return [dx * cy - dz * sy, wp[1] - P0[1], dx * sy + dz * cy]; }
  private toModelD(wd: Vec3): Vec3 { const cy = Math.cos(this.bodyYawIn), sy = Math.sin(this.bodyYawIn); return [wd[0] * cy - wd[2] * sy, wd[1], wd[0] * sy + wd[2] * cy]; }
  /** the door hand's eased weights per arm (0‥1) and which arm is the wanted one — for whoever wants to know a hand is on a leaf (the QA probe; hand props one day) */
  doorHands(): { L: number; R: number; right: boolean } { return { L: clamp(this.dp.wL.x, 0, 1), R: clamp(this.dp.wR.x, 0, 1), right: this.dp.right }; }

  /** A hand on the door leaf he is pushing open (doorPush — game.ts knows which leaf, which face, whether he is pushing, and which hand it would rather; the weight
   *  is this layer's own springs: in ≈ 0.15 s, out ≈ 0.25 s, a change of hand cross-fading one arm out as the other comes in). The FREE arm only: the wanted one
   *  unless that is the right and the right has the pistol (armed) or a torch in it, or is throwing — then the left. Nothing (the weight runs out) when the wrist's
   *  spot is behind that shoulder or beyond what the arm spans with the lean's help (asked ≤ 0.56 m off the shoulder joint, let go past 0.585; the arm is 0.55):
   *  he is pushing with his body then. A long reach LEANS him into it — the spine bows a few degrees toward the door and that clavicle comes forward, straight
   *  into pA by the weight, so the shoulder gains the best part of a hand — then the arm is IK'd on a copy against the body as it now is and blended in through
   *  its own mask (clavicle to fingertips): wrist a hand's length below the spot and 3.5 cm proud of the face (the skin's palm depth) so the flat palm lies ON
   *  it, fingers up and out (away from his middle) along the leaf, back of the hand toward him, fingers open and the thumb laid alongside them, elbow down and
   *  out. Nor from too near: inside 0.2 m of the shoulder (a crouch leans it onto the leaf) there is no push in an arm. The spot is a WORLD point: it comes in through posIn /
   *  bodyYawIn AND through the inverse of the chest twist update() has the SkeletonInstance apply after this pose (yaw twY spread .25 / .35 / .4 over spine1‥3,
   *  pitch twP at spine3 — each turning the subtree about that joint), or the aim yaw would carry the hand round off the door with the chest. */
  private doorLayer(dt: number, intent: number, armed: boolean, twY: number, twP: number) {
    const S = this.dp, L = S.last, nd = this.nodes, fk = this.fk, pA = this.pA, pB = this.pB;
    if (!L) { S.wL.x = S.wL.v = S.wR.x = S.wR.v = 0; S.reachOK = false; return; }   // never fed (or the viewer's raw clip wiped it): nothing to pose, nothing to ease
    const live = intent > 0.003, wWas = clamp(Math.max(S.wL.x, S.wR.x), 0, 1);
    if (!live && wWas <= 0.003) { S.reachOK = false; return; }
    if (live && L.hand >= 0) S.right = L.hand === 1 && !armed && this.upper !== 'torch' && this.throwT < 0;   // (game.ts only asks for a right it knows to be empty; the pistol / torch / throw veto is belt and braces)
    // the chest twist still to come, and its inverse: E1 / E2 / E3 at spine1‥3 (SkeletonInstance.update's construction: yaw about model +Y, then pitch about the
    // yawed X), each pivoting its subtree at that joint's ALREADY-TWISTED origin — so a hand posed at h ends up at E3·(E2·(E1·(h − P1) + P1 − P2ᵗ) + P2ᵗ − P3ᵗ) + P3ᵗ;
    // run backwards, that is where to pose it for it to end up at the door. Directions and the hand's rotation just take (E3·E2·E1)⁻¹. Rigid on everything
    // below spine3, so shoulder-to-spot distances measured un-twisted are the real ones. The pivots are read off pA as it stands (pivots() again after the lean).
    const E1 = qYaw(twY * 0.25), E2 = qYaw(twY * 0.35); let E3 = qYaw(twY * 0.4);
    if (twP) { const right = quat.rotate(E3, AX); E3 = quat.mul(quat.axisAngle(right, twP), E3); }
    const iE1 = quat.conj(E1), iE2 = quat.conj(E2), iE3 = quat.conj(E3), iAll = quat.conj(quat.mul(E3, quat.mul(E2, E1)));
    const unD = (D: Vec3): Vec3 => quat.rotate(iAll, D);
    const pivots = (): ((H: Vec3) => Vec3) => {   // (fk current on pA)
      const P1 = v3.copy(fk.pos[nd.spine1]), P2 = fk.pos[nd.spine2], P3 = fk.pos[nd.spine3];
      const P2t = v3.add(quat.rotate(E1, v3.sub(P2, P1)), P1);
      const P3t = v3.add(quat.rotate(E2, v3.sub(v3.add(quat.rotate(E1, v3.sub(P3, P1)), P1), P2t)), P2t);
      return (H: Vec3): Vec3 => { const x1 = v3.add(quat.rotate(iE3, v3.sub(H, P3t)), P3t); const x2 = v3.add(quat.rotate(iE2, v3.sub(x1, P2t)), P2t); return v3.add(quat.rotate(iE1, v3.sub(x2, P1)), P1); };
    };
    // the hand's frame on the leaf per arm, model space: n out of the face toward him, fingers f up and ~25° out along the face (away from his middle on that
    // arm's side: +X is his left), and the wrist target under the palm spot — the palm's middle sits ~8 cm up the hand from the wrist joint, and the mesh's palm
    // surface lies 3.5 cm palm-ward of the bone line (measured off the skin), so the bone line rides 3.5 cm proud of the face for the palm to lie ON it
    const n0 = v3.normalize(this.toModelD(L.n)), p0 = this.toModelP(L.p), n = unD(n0);
    const fOf = (side: 0 | 1): Vec3 => { let t0 = v3.cross(AY, n0); if (v3.len(t0) < 1e-4) t0 = [1, 0, 0]; t0 = v3.normalize(t0); if ((side ? -1 : 1) * t0[0] < 0) t0 = v3.scale(t0, -1); return unD(v3.normalize(v3.add(v3.scale(AY, 0.9), v3.scale(t0, 0.42)))); };
    const wristOf = (pTgt: Vec3, f: Vec3): Vec3 => v3.mad(v3.mad(pTgt, n, 0.035), f, -0.08);
    const arm: 0 | 1 = S.right ? 1 : 0; const ua0 = S.right ? nd.upperArmR : nd.upperArmL;
    // ---- the lean into a long reach, off the un-leaned pose: how far the wrist spot is from that shoulder → the spine bows toward the door (about up × into-it,
    //      hips first, 8° at most) by last frame's weight; the head is levelled back out of it here (the gaze stabiliser after would only take most of it)
    fk.run(pA);
    let unP = pivots(); const f = fOf(arm);
    const d0 = v3.dist(fk.pos[ua0], wristOf(unP(p0), f));
    const lean = 8 * DEGR * smoothstep(0.4, 0.55, d0) * wWas;
    if (lean > 1e-4) {
      const into: Vec3 = v3.normalize([-n0[0], 0, -n0[2] + 1e-6]); const ax: Vec3 = v3.cross(AY, into);   // (bowing toward +Z is + about +X = up × Z)
      this.turn(pA, nd.spine1, quat.axisAngle(ax, lean * 0.4)); this.turn(pA, nd.spine2, quat.axisAngle(ax, lean * 0.35)); this.turn(pA, nd.spine3, quat.axisAngle(ax, lean * 0.25));
      this.turn(pA, nd.neck, quat.axisAngle(ax, -lean * 0.45)); this.turn(pA, nd.head, quat.axisAngle(ax, -lean * 0.55));
      fk.run(pA); unP = pivots();
    }
    const pTgt = unP(p0);
    // ---- which arm is up, and can it reach: the wrist spot within what the arm spans once leaned (asked inside 0.56 of the shoulder joint as it now is — un-leaned
    //      while the hand is still down, so the lean then leaves the elbow soft — let go past 0.585, a finger past full stretch) and ahead of it; else he pushes
    //      with his body and the hand stays off
    let tgtL = 0, tgtR = 0;
    if (live && L.hand >= 0) {   // (−1: game.ts has not settled which hand — he is still coming round to the door: nothing rises yet)
      const sh = fk.pos[ua0], wr = wristOf(pTgt, f); const d = v3.dist(sh, wr), ahead = wr[2] - sh[2];
      const far = L.reach ? 0.45 : 0;   // (reach — hands.ts, a door worked by hand: the arm goes out to a leaf a stride off too, as far as it spans, and meets it as it comes)
      S.reachOK = S.reachOK ? d < 0.585 + far && d > 0.16 && ahead > 0.02 : d < 0.56 + far && d > 0.2 && ahead > 0.06;   // (nor with the shoulder itself on the leaf: no arm pushes from inside a hand's length)
      if (S.reachOK) { if (S.right) tgtR = intent; else tgtL = intent; }
    } else S.reachOK = false;
    const rate = (t: number, x: number) => t > x ? 40 : 26;   // ≈ 0.15 s in, 0.25 s out (Spring: ≈ 6 / settle time)
    const wL = clamp(S.wL.step(tgtL, rate(tgtL, S.wL.x), dt), 0, 1), wR = clamp(S.wR.step(tgtR, rate(tgtR, S.wR.x), dt), 0, 1);
    // ---- the arm(s): the TARGET travels with the eased weight — from wherever the pose beneath has the wrist (the swinging walk hand, the support hand on the gun)
    //      in a line to the spot on the door and back — with the hand's turn, the elbow's swivel and the clavicle's reach riding the same ease, and the joint blend
    //      itself only let go over the last quarter (by when the solve is all but the pose beneath: at e → 0 the IK is the identity). A weight blend alone would
    //      swing the hand from door to gun grip through joint space — an arc out through the leaf.
    for (const side of [0, 1] as const) {
      const e = side ? wR : wL; if (e < 0.003) continue;
      const fs = side === arm ? f : fOf(side); const wrist = wristOf(pTgt, fs);
      pB.copy(pA);
      const shN = side ? nd.shoulderR : nd.shoulderL, ua = side ? nd.upperArmR : nd.upperArmL, fa = side ? nd.forearmR : nd.forearmL, hd = side ? nd.handR : nd.handL;
      fk.run(pB);
      const live0 = v3.copy(fk.pos[hd]), rot0: Quat = [...fk.rot[hd]] as Quat;
      const far = smoothstep(0.38, 0.54, v3.dist(fk.pos[ua], wrist)) * e;
      if (far > 1e-3) { this.turn(pB, shN, quat.mul(qYaw((side ? 1 : -1) * 10 * DEGR * far), qRoll((side ? -1 : 1) * 3 * DEGR * far))); fk.run(pB); }   // the shoulder reaches too: clavicle forward (its tip swings toward +Z: − yaw on the left, + on the right) and a touch up
      const pole: Vec3 = [(side ? -1 : 1) * 0.4, -1, -0.35];   // elbow DOWN (below the wrist), out to the arm's side, a shade back — body-relative, so NOT un-twisted: it turns with the chest as an elbow does
      twoBoneIK(fk, pB, ua, fa, hd, v3.lerp(live0, wrist, e), pole, e, quat.nlerp(rot0, this.handRot(side, fs, n), e));   // back of the hand toward him = palm flat on the face he pushes
      this.hand(pB, side, [0.1, 0.1, 0.15, 0.2], 0.1, 0.35);                                                                       // open, the fingers a little apart…
      this.turn(pB, this.thumbs[side][0], quat.axisAngle(quat.rotate(fk.rot[hd], AY), (side ? 1 : -1) * 40 * DEGR * e));          // …and the thumb up into the palm's plane: at rest it hangs 8 cm palm-ward of it (down and forward off a T-posed hand), which flat on a door is 4 cm into the wood — 40° about the fingers' axis (the hand bone's +Y) lays it alongside the index
      blendPose(pA, pB, smoothstep(0, 0.25, e), side ? this.armROnly : this.armLOnly, pA);
    }
  }

  // ================================================================ HANDWORK (game/handwork.ts feeds all three; nothing here knows what the thing is)
  private hwReset() { const K = this.wk, S = this.sw, R = this.rx; K.last = null; K.fed = false; K.after = 0; K.wL.x = K.wL.v = K.wR.x = K.wR.v = K.tw.x = K.tw.v = 0; K.okL = K.okR = false; K.shown = 0; S.cur = undefined; S.t = S.wait = -1; R.left = 0; R.w.x = R.w.v = 0; this.work = null; this.carry = undefined; S.shown = false; this.handPre = null; }
  /** what the work hands are doing — for the props, the clocks that wait on the hand, the probes: the pose last fed (null once it has run out), the working hand's
   *  eased weight, which hand that is and whether the other is on the thing too */
  workInfo(): { pose: WorkPose | null; w: number; hand: 0 | 1; two: boolean } { const K = this.wk; return { pose: K.last, w: K.shown, hand: K.main, two: K.two }; }
  /** the verb is done: the pose carries on by itself for `secs` past its end (a thing taken is put away, a hand comes off a lever) */
  workAfter(secs: number) { if (this.wk.last) this.wk.after = secs; }
  /** a line over the radio: the left hand goes up to the handset at his collar for about `secs` (asked again while it is up: it stays up) */
  radio(secs: number) { this.rx.left = Math.max(this.rx.left, clamp(secs, 0.8, 3)); }
  /** 0‥1: how far the radio hand is up */
  get radioShown(): number { return clamp(this.rx.w.x, 0, 1); }
  /** what the gun hand VISIBLY holds: `rule` (what the game says he carries) unless a swap is running — then the thing he had until the hand has put it away,
   *  nothing while it crosses from the belt to the holster (or back), the other from when the hand has it */
  swapHeld(rule: CarryKind): CarryKind { const S = this.sw; if (S.t < 0) return rule && S.cur && S.cur !== rule ? S.cur : rule;   // (the rule changed after this frame's pose was taken: the move starts next frame, from what he has)
    const a = S.t / S.dur; return a < SWAP.away ? S.from : a < SWAP.take ? null : S.to; }
  /** the swap's progress 0‥1 (−1: none running) and what it goes to */
  /** how far the swap's hand is at the torch on his belt this frame, 0‥1 (swapLayer; for the eye: Character.inHandPass draws the hand out to where the torch hangs) */
  get swapBelt(): number { return this.sw.belt; }
  swapInfo(): { a: number; to: CarryKind; pending: boolean } { const S = this.sw; return { a: S.t < 0 ? -1 : S.t / S.dur, to: S.to, pending: S.wait >= 0 }; }

  /** THE TORCH ↔ SIDEARM SWAP — a small layer over the right arm, not an animation: the hand goes down to the belt (the torch hangs there) and the holster on the
   *  thigh, in the order the change needs — torch away THEN the gun, or the gun away THEN the torch — and comes back up into whatever the pose beneath has for
   *  what it now holds (the aim, the low ready, the torch's carry: the rule turned those on the frame, as ever; this only takes the hand the long way round). A
   *  round leaving mid-draw has the gun in the hand and all but up by construction (the clock jumps): nobody shoots later for it. Stood down by anything else
   *  that has the arm. Both spots hang off the pelvis, so they come in through the inverse of the chest twist. */
  private swapLayer(dt: number, taken: boolean, twY: number, twP: number) {
    const S = this.sw, nd = this.nodes, fk = this.fk, pA = this.pA, pB = this.pB;
    if (taken) { S.t = -1; return; }
    if (this.shootT >= 0 && S.to === 'weapon') S.t = Math.max(S.t, S.dur * 0.85);
    S.t += dt; if (S.t >= S.dur) { S.t = -1; return; }
    const a = S.t / S.dur, e = bump(a, 0, SWAP.away * 0.85, SWAP.take + 0.08, 0.98); if (e <= 0.003) return;
    fk.run(pA); const un = this.untwist(twY, twP);
    const hp = fk.pos[nd.hips], th = fk.pos[nd.thighR];
    const belt = un([hp[0] - 0.13, hp[1] + 0.1, hp[2] + 0.12]), hol = un([th[0] - 0.1, th[1] + 0.06, th[2] + 0.01]);   // the wrist over the torch's ring at the front of the right hip · over the sidearm's grip on the thigh
    const first = S.to === 'weapon' ? belt : hol, second = S.to === 'weapon' ? hol : belt, k = smoothstep(SWAP.away - 0.04, SWAP.take, a);
    const P = v3.lerp(first, second, k); S.belt = e * (S.to === 'weapon' ? 1 - k : k);
    pB.copy(pA); fk.run(pB);
    const live0 = v3.copy(fk.pos[nd.handR]), rot0: Quat = [...fk.rot[nd.handR]] as Quat;
    this.turn(pB, nd.shoulderR, qRoll(4 * DEGR * e)); fk.run(pB);   // (the shoulder drops a little with the reach down)
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(live0, P, e), [-0.5, 0.15, -1], e, quat.nlerp(rot0, this.handRot(1, [0.05, -1, 0.15], [-0.75, 0, 0.6]), e));   // fingers down onto it, the back of the hand out to his right; the elbow back
    this.hand(pB, 1, [0.72, 0.78, 0.82, 0.85], 0.5);
    (this.swBuf ??= new Pose(pA.numNodes)).copy(pA); S.shown = true;
    blendPose(pA, pB, smoothstep(0, 0.25, e), this.armROnly, pA);
  }

  /** HANDS AT WORK ON A THING (work — see WorkPose): built like the door hand. The hand that is FREE does it — his right when that is empty (no pistol, torch,
   *  long gun, can; not mid-swap), else his left, a long gun's support hand included — and for 'charge' / 'take' the other joins it when both are empty. Nothing
   *  (the weight runs out) while the wrist's spot is behind that shoulder or beyond what the arm spans with the lean's help: whoever feeds this walks him to the
   *  thing first. A thing below the shoulders BOWS him to it and a long reach leans him in (spine, by last frame's weight, the head levelled back out and then
   *  turned onto the thing); then each arm is solved on a copy — the target travelling with the eased weight from wherever the pose beneath has the wrist, as the
   *  door hand's does — and blended in through its own mask. The spot is a WORLD point: in through posIn / bodyYawIn and the inverse of the chest twist. */
  private workLayer(dt: number, free: boolean, armed: boolean, twY: number, twP: number) {
    const K = this.wk, L = K.last, nd = this.nodes, fk = this.fk, pA = this.pA, pB = this.pB;
    if (!L) { K.shown = 0; return; }
    const live = K.fed && free, wWas = clamp(Math.max(K.wL.x, K.wR.x), 0, 1);
    if (!live && wWas <= 0.003) { K.wL.x = K.wL.v = K.wR.x = K.wR.v = 0; K.okL = K.okR = false; K.shown = 0; if (!K.fed && K.tw.x < 0.003) K.last = null; return; }
    const done = L.t > L.dur;
    if (live && !done) {   // (which hands: settled while the verb runs, kept while it comes away)
      const rFree = L.hand !== 0 && !armed && this.upper !== 'torch' && (!this.longGun || this.stowed) && (!this.grip[1] || this.stowed) && this.throwT < 0 && this.sw.t < 0;
      K.main = rFree ? 1 : 0; K.two = (L.kind === 'charge' || L.kind === 'take') && rFree;
    }
    const main = K.main, t = L.t, dur = L.dur;
    fk.run(pA);
    const p0 = this.toModelP(L.p), n0 = v3.normalize(this.toModelD(L.n));
    // ---- the body: bowed to a low thing, leaned into a long reach (by last frame's weight; the head levelled back out of both), the eyes onto it
    const ua0 = main ? nd.upperArmR : nd.upperArmL;
    const into: Vec3 = v3.normalize([-n0[0], 0, -n0[2] + 1e-6]), ax: Vec3 = v3.cross(AY, into);
    const bow1 = 30 * DEGR * smoothstep(0.3, 0.8, (fk.pos[nd.upperArmL][1] + fk.pos[nd.upperArmR][1]) / 2 - p0[1]), lean1 = 14 * DEGR * smoothstep(0.42, 0.66, v3.dist(fk.pos[ua0], v3.mad(p0, n0, 0.12)));
    const body = (pose: Pose, bow: number, lean: number) => { const q = (s: number) => quat.mul(quat.axisAngle(ax, lean * s), qPitch(bow * s));
      this.turn(pose, nd.spine1, q(0.4)); this.turn(pose, nd.spine2, q(0.35)); this.turn(pose, nd.spine3, q(0.25)); this.turn(pose, nd.neck, q(-0.4)); this.turn(pose, nd.head, q(-0.4)); };
    let shFull: [Vec3, Vec3] | null = null;   // where the shoulders WILL be once he has bowed and leaned in: what the reach is asked of while the hands are still coming up
    if (live && !done && wWas < 0.97 && bow1 + lean1 > 1e-4) { pB.copy(pA); body(pB, bow1, lean1); fk.run(pB); shFull = [v3.copy(fk.pos[nd.upperArmL]), v3.copy(fk.pos[nd.upperArmR])]; }
    const ease = wWas * (done ? smoothstep(dur + 0.3, dur, t) : 1), bow = bow1 * ease, lean = lean1 * ease;
    if (bow + lean > 1e-4) body(pA, bow, lean);
    if (shFull || bow + lean > 1e-4) fk.run(pA);
    const un = this.untwist(twY, twP);
    const pT = un(p0), nT = v3.normalize(v3.sub(un(v3.add(p0, n0)), pT));
    let r0 = v3.cross(AY, n0); r0 = v3.len(r0) < 1e-4 ? [-1, 0, 0] : v3.normalize(r0);   // the thing's right as he sees it (model −X is his right)
    const rT = v3.normalize(v3.sub(un(v3.add(p0, r0)), pT)), uT = v3.cross(nT, rT);
    const at = (x: number, y: number, off: number): Vec3 => v3.mad(v3.mad(v3.mad(pT, rT, x), uT, y), nT, off);
    if (!done) this.lookAt(pA, at(0, 0, 0), 0.75 * wWas);
    fk.run(pA);
    // ---- what each hand does, by kind: the wrist's spot, where the fingers point and the back of the hand faces, the fingers themselves
    type Shape = { wrist: Vec3; f: Vec3; b: Vec3; curl: number[]; thumb: number; spread: number; body?: boolean };
    const mix = (A: Shape, B: Shape, k: number): Shape => k <= 0 ? A : k >= 1 ? B : { wrist: v3.lerp(A.wrist, B.wrist, k), f: v3.lerp(A.f, B.f, k), b: v3.lerp(A.b, B.b, k), curl: A.curl.map((c, i) => lerp(c, B.curl[i], k)), thumb: lerp(A.thumb, B.thumb, k), spread: lerp(A.spread, B.spread, k), body: B.body };
    const flat = (side: 0 | 1, x: number, y: number, off: number): Shape => { const f = v3.normalize(v3.add(v3.scale(uT, 0.9), v3.scale(rT, (side ? 1 : -1) * 0.42))); return { wrist: v3.mad(v3.mad(at(x, y, off), nT, 0.035), f, -0.08), f, b: nT, curl: [0.1, 0.1, 0.15, 0.2], thumb: 0.1, spread: 0.35 }; };   // a palm on the face (the door hand's numbers)
    const tips = (side: 0 | 1, x: number, y: number, off: number): Shape => { const f = v3.normalize(v3.add(v3.scale(nT, -1), v3.scale(uT, -0.3))); return { wrist: v3.mad(at(x, y, off), f, -0.17), f, b: v3.normalize(v3.add(uT, v3.scale(rT, (side ? 1 : -1) * 0.25))), curl: [0.12, 0.12, 0.16, 0.2], thumb: 0.25, spread: 0.3 }; };   // the same push from further off: the arm long, the fingers' pads on it from a little above
    const pushOn = (side: 0 | 1, x: number, y: number, off: number): Shape => { const A = flat(side, x, y, off), sh = shFull?.[side] ?? fk.pos[side ? nd.upperArmR : nd.upperArmL]; return mix(A, tips(side, x, y, off), smoothstep(0.48, 0.56, v3.dist(sh, A.wrist))); };   // palm flat where the shoulder is near enough for it, else the long arm
    const poke = (side: 0 | 1, x: number, y: number, off: number, curl: number[], thumb: number): Shape => { const f = v3.normalize(v3.add(v3.scale(nT, -1), v3.scale(uT, 0.25))); return { wrist: v3.mad(at(x, y, off), f, -WORK.tipLen), f, b: v3.normalize(v3.add(uT, v3.scale(rT, side ? 0.3 : -0.3))), curl, thumb, spread: 0 }; };   // a forefinger's tip at a spot, the wrist behind and a little under it
    const shape = (side: 0 | 1): Shape => {
      const sg = side ? 1 : -1, lead = side === main;
      switch (L.kind) {
        case 'keys': {
          const keys = L.keys && L.keys.length ? L.keys : NO_KEYS; let kx = keys[0][0], ky = keys[0][1], press = 0;
          for (let k = 0; k < 4; k++) { const tk = workKeyBeat(k, dur), key = keys[k % keys.length]; if (k) { const gl = smoothstep(tk - 0.19, tk - 0.06, t); kx = lerp(kx, key[0], gl); ky = lerp(ky, key[1], gl); } press += bump(t, tk - 0.07, tk - 0.005, tk + 0.03, tk + 0.1); }
          return poke(side, kx, ky, WORK.keyOff + WORK.hover * (1 - press), [0.03, 0.8, 0.88, 0.92], 0.8);
        }
        case 'charge': {
          const u = t / dur, rub = 0.014 * Math.sin(t * 6.5) * bump(u, 0.12, 0.25, 0.5, 0.6);
          if (!lead) return pushOn(side, sg * 0.05, -0.025 - rub, 0.022);   // the other hand holds it to the face
          const press = pushOn(side, K.two ? sg * 0.05 : 0, 0.01 + rub, 0.022);
          return mix(press, poke(side, 0.012 * Math.sin(t * 9), 0.1, 0.03, [0.25, 0.35, 0.85, 0.9], 0.15), smoothstep(0.6, 0.72, u));   // …then the fingers at the cap on its top edge
        }
        case 'lever': {
          const dir = L.dir ?? 1, thr = smoothstep(dur - 0.26, dur - 0.1, t), jig = dur > 1.2 ? bump(t, 0.45, 0.55, 0.62, 0.8) + bump(t, 1.0, 1.1, 1.17, 1.35) : 0;
          const G = at(0, dir * (WORK.lever * (1 - 2 * thr) - 0.012 * jig), 0.05), f = v3.normalize(v3.add(v3.scale(nT, -1), v3.scale(uT, -0.2)));
          return { wrist: v3.mad(v3.mad(G, nT, 0.075), uT, 0.03), f, b: uT, curl: [0.7, 0.75, 0.75, 0.75], thumb: 0.55, spread: 0 };   // a fist over the handle from above
        }
        default: {   // 'take'
          const u = clamp(t / dur, 0, 1), out = 0.05 + 0.17 * smoothstep(0.55, 0.96, u) + 0.004 * Math.sin(t * 13) * bump(u, 0.15, 0.25, 0.9, 1);
          const G = at(K.two ? sg * 0.045 : 0, 0, out), g = smoothstep(0.12, 0.22, u) * 0.6;
          const hold: Shape = { wrist: v3.mad(G, nT, 0.085), f: v3.scale(nT, -1), b: v3.normalize(v3.add(v3.scale(rT, sg * 0.85), v3.scale(uT, 0.5))), curl: [g, g, g + 0.05, g + 0.1], thumb: 0.45, spread: 0.1 };   // fingers in, palms toward each other, thumbs up
          if (!done || !lead) return hold;
          const hp = fk.pos[nd.hips]; const hip = un([hp[0] - sg * 0.17, hp[1] + 0.08, hp[2] + 0.1]);   // put away: the hand carries it down to the pouch at the front of that hip
          return mix(hold, { wrist: hip, f: [0, -1, 0.2], b: [-sg * 0.9, 0, 0.3], curl: [0.6, 0.6, 0.65, 0.7], thumb: 0.45, spread: 0, body: true }, smoothstep(dur, dur + 0.3, t));
        }
      }
    };
    // ---- which arms are up, and can each reach (asked inside 0.57 m of the shoulder joint and ahead of it, let go past 0.6; the put-away is on his own body)
    const sides: (0 | 1)[] = K.two ? [0, 1] : [main];
    let tgtL = 0, tgtR = 0;
    if (live) for (const side of sides) {
      if (done && side !== main) continue;   // (the other hand lets go once the thing is out)
      const sh = fk.pos[side ? nd.upperArmR : nd.upperArmL], S = shape(side), shF = shFull?.[side]; let d = v3.dist(sh, S.wrist), ahead = S.wrist[2] - sh[2];
      if (shF) { const dF = v3.dist(shF, S.wrist); if (dF < d) { d = dF; ahead = Math.max(ahead, S.wrist[2] - shF[2]); } }
      const was = side ? K.okR : K.okL, ok = S.body || (was ? d < 0.6 && d > 0.14 && ahead > 0.0 : d < 0.57 && d > 0.18 && ahead > 0.04);
      if (side) K.okR = ok; else K.okL = ok;
      if (ok) { if (side) tgtR = 1; else tgtL = 1; }
    }
    const rate = (tg: number, x: number) => tg > x ? 26 : 22;
    const wL = clamp(K.wL.step(tgtL, rate(tgtL, K.wL.x), dt), 0, 1), wR = clamp(K.wR.step(tgtR, rate(tgtR, K.wR.x), dt), 0, 1);
    K.shown = main ? wR : wL;
    for (const side of [0, 1] as const) {
      const e = side ? wR : wL; if (e < 0.003) continue;
      const S = shape(side);
      pB.copy(pA); fk.run(pB);
      const shN = side ? nd.shoulderR : nd.shoulderL, ua = side ? nd.upperArmR : nd.upperArmL, fa = side ? nd.forearmR : nd.forearmL, hd = side ? nd.handR : nd.handL;
      const live0 = v3.copy(fk.pos[hd]), rot0: Quat = [...fk.rot[hd]] as Quat;
      const far = smoothstep(0.38, 0.54, v3.dist(fk.pos[ua], S.wrist)) * e;
      if (far > 1e-3) { this.turn(pB, shN, quat.mul(qYaw((side ? 1 : -1) * 10 * DEGR * far), qRoll((side ? -1 : 1) * 3 * DEGR * far))); fk.run(pB); }   // the shoulder reaches too (the door hand's turn)
      twoBoneIK(fk, pB, ua, fa, hd, v3.lerp(live0, S.wrist, e), [(side ? -1 : 1) * 0.45, -1, -0.3], e, quat.nlerp(rot0, this.handRot(side, S.f, S.b), e));   // elbow down and out
      this.hand(pB, side, S.curl, S.thumb, S.spread);
      blendPose(pA, pB, smoothstep(0, 0.25, e), side ? this.armROnly : this.armLOnly, pA);
    }
  }

  /** THE TORCH UP IN THE HAND THAT HOLDS IT (GUNHAND.whistle, gunhand.ts; upper 'torch': a guard answering a whistle). The library's Idle_Torch_Loop is keyed for a
   *  torch in the LEFT hand — a fist out ahead of the chest, thumb up — and ours is in the right, so its arms showed an empty fist raised and the torch left
   *  hanging. With the rule the clip gives the trunk and the head only: the left arm stays the legs' clip's, and the right comes up to an overhand hold — the fist
   *  ahead of its own shoulder, forearm up, the back of the hand out to his right, so the torch lies level through the fist with its lens out of the little-finger
   *  side (the way a man holds a torch up to look along it; thumb to the lens, a forearm that high would point it at the ceiling). Shoulder-relative, so it rides
   *  the chest twist as an arm does, and so does the light: the torch and its lens are placed off this wrist (rigProps.ts rigTorchPos). Up and down on a clock of
   *  its own (`tuK`, 0.4 s, eased at both ends): the hand turns right over on the way, and at the carry weight's own rate that was 20° in a frame. */
  private torchUpLayer(e: number) {
    const nd = this.nodes, fk = this.fk, pA = this.pA, pB = this.pB;
    pB.copy(pA); fk.run(pB);
    const sh = fk.pos[nd.upperArmR], live0 = v3.copy(fk.pos[nd.handR]), rot0: Quat = [...fk.rot[nd.handR]] as Quat;
    const wrist: Vec3 = [sh[0] - 0.07, sh[1] + 0.04, sh[2] + 0.22];
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(live0, wrist, e), [-0.3, -1, 0], e, quat.nlerp(rot0, this.handRot(1, [0, 0.92, 0.38], [-1, 0.1, 0]), e));   // the elbow down and a little out
    blendPose(pA, pB, smoothstep(0, 0.25, e), this.armROnly, pA);
  }

  /** A HAND TO THE RADIO (radio(); rx): the left hand up to the handset clipped at his left collar, thumb on the switch, the head turned and tipped to it — while
   *  his line is on the net. The left arm and the head only: the right keeps whatever it has (a pistol stays up one-handed; a long gun's support hand comes off
   *  the fore-end and goes back, as for a tell). Shoulder-relative, so it rides the chest twist as an arm does. */
  private radioLayer(dt: number, free: boolean) {
    const R = this.rx, nd = this.nodes, fk = this.fk, pA = this.pA, pB = this.pB;
    R.left = Math.max(0, R.left - dt);
    const want = R.left > 0 && free ? 1 : 0;
    const w = clamp(R.w.step(want, want ? 20 : 15, dt), 0, 1);
    if (w <= 0.003) { if (!want) R.w.x = R.w.v = 0; return; }
    const hw = w * (1 - this.upperW.aim);   // (the head tips to the handset only as far as his gun is down: a man with his sights up keeps his eyes — and what they see — where they were)
    if (hw > 0.003) { this.turn(pA, nd.neck, quat.mul(qYaw(9 * DEGR * hw), qPitch(5 * DEGR * hw))); this.turn(pA, nd.head, quat.mul(qRoll(-5 * DEGR * hw), quat.mul(qYaw(13 * DEGR * hw), qPitch(8 * DEGR * hw)))); }
    pB.copy(pA); fk.run(pB);
    this.turn(pB, nd.shoulderL, qRoll(7 * DEGR * w)); fk.run(pB);
    const sh = fk.pos[nd.upperArmL]; const live0 = v3.copy(fk.pos[nd.handL]), rot0: Quat = [...fk.rot[nd.handL]] as Quat;
    const wrist: Vec3 = [sh[0] - 0.035, sh[1] - 0.115, sh[2] + 0.15];   // under and ahead of the collar on that side: the fingers come up onto the handset
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.lerp(live0, wrist, w), [0.75, -1, 0.1], w, quat.nlerp(rot0, this.handRot(0, [-0.4, 0.82, -0.4], [0.3, 0.3, 0.9]), w));
    this.hand(pB, 0, [0.4, 0.5, 0.6, 0.65], 0.2);
    blendPose(pA, pB, smoothstep(0, 0.25, w), this.armLOnly, pA);
  }

  /** Sam holding a man from behind (holdPose, weight w — HOLD has the numbers): over whatever the legs are doing, the torso comes forward to the man's back (leaning
   *  back instead to finish a choke, and swaying against the man's fight through it), the head carried out to the left of his and turned to look past his left ear;
   *  then both arms by IK against that body — the left wrist past the far side of his throat so the forearm lies across it (drawn back toward Sam's own chest as
   *  the choke closes), the right fist holding the KNIFE level across the front of his throat (HOLD.knife: rigProps draws the blade out of that fist), taken off
   *  him and stood up out past his right shoulder while the choke is on. The grab REACHES: each wrist travels from wherever the pose beneath has it, round the
   *  outside of the man (a bowed mid key), onto its point, the left leading. Targets move, never the weight, so nothing pops between phases; the knife hand's
   *  two stations ride their own spring (hdKn); in and out of the whole thing rides the master spring.
   *  A change of variant mid-hold (E: player.ts swapHold) rides hdGv, the eased share of it (gv, 0 = arm ↔ 1 = gun): the few body numbers that differ are
   *  lerped by it, and the right hand is HANDED OVER — the fist pulls back out over the man's right shoulder to where either grab comes in from (N.via /
   *  G.viaB, a finger apart), the tools change there as gv passes ½ (holdGunSide, read by whoever draws the props), and the other grip comes in to its own
   *  station, the pistol muzzle-high on the way as in its grab; through the middle the two arm solves cross-fade in joint space, both all but at that point,
   *  so the turn of the wrist from one grip to the other never pops. */
  private holdLayer(w: number, dt: number) {
    const H = this.holdPose ?? this.hdLast, K = HOLD; const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk;
    const ph = H.phase, t = H.t, gunV = H.variant === 'gun', G = K.gun, N = K.knife, F = K.struggle;   // gunV: the variant proper — what the choke, the whip and the flinch key off; gv below is its eased share of the POSE
    const gv = clamp(this.hdGv.x, 0, 1);
    const ug = ph === 'grab' ? clamp(t / K.secs.grab, 0, 1) : 1;                              // the reach, 0 → 1
    const CS = K.catchShape && this.noKnife, CT = K.catch, CR = CS && !gunV && ph === 'grab';   // (HOLD.catch: the bare arm hold's eighth pass. CS = the seat, which gives way to a gun by gv, its EASED share — keyed off the variant itself it dropped whole on the frame of a swap, his hips 10 cm and the man's 18. CR = the reach round his neck, the arm variant's grab)
    const ck = ph === 'choke' && !gunV ? smoothstep(0, K.secs.choke * 0.75, t) : 0;           // the elbow closing
    const knE = clamp(this.hdKn.step(ph === 'choke' ? 1 : 0, ph === 'choke' ? 6 / N.offSecs : 3 / N.offSecs, dt), 0, 1), kn = this.noKnife ? 1 : knE;   // the blade coming off him for the choke (and back, slower, off an aborted one) — never on in a gun hold, which has no choke
    const fight = knE * (ph === 'choke' ? 1 - smoothstep(F.fadeFrom, F.fadeTo, t / K.secs.choke) : 1);                  // what Sam braces against: the man's fight (heldLayer's envelope, near enough), spent as he goes — carried on kn so easing off lets it down gently
    const wnd = ph === 'whip' ? smoothstep(0, WHIP_WIND, t) : 0;                                                     // the whip: cocked back (and it stays cocked under the strike's blend: wind → hit is one straight whip of the hand)…
    const stk = ph === 'whip' ? (t < WHIP_STRIKE ? 0 : hermite(t, WHIP_STRIKE, 0, 0, K.secs.whip, 1, 7)) : 0;      // …brought down, ARRIVING fast (≈ 2 m/s at the bone)…
    const thru = ph === 'whip' ? smoothstep(K.secs.whip, K.secs.whip + WHIP_THRU, t) : 0;                            // …and on through as he drops (the layer lets go after it)
    // the disarm (HOLD.strip; game/disarm.ts feeds it while the move runs, and only to a hold that is up): the right hand's own errand through the grab and the hold's first beat
    const SP = this.holdPose?.strip ?? null, ST = K.strip, sT = SP ? SP.t : 0, sArm = !!SP && !gunV && sT < ST.home;
    // the kill (HOLD.kill): the free hand to his mouth (kW) · the blade drawn across and out wide (kS) · the arm coming down across his chest (kC) · letting him down (kA)
    const KL = K.kill, kk = killEase(this.hdKc, (H.kill ?? HOLD_SHOW.kill) && ph === 'kill' && !gunV, t, dt), kOn = kk > 1e-4;
    const kW = kOn ? smoothstep(0, KL.wind, kk) : 0, kS = kOn ? smoothstep(KL.hit - 0.07, KL.out, kk) : 0, kC = kOn ? smoothstep(KL.hit + 0.05, KL.hit + 0.3, kk) : 0, kA = kOn ? smoothstep(KL.go, 1, kk) : 0;
    // ---- body English straight into pA: lean over the three spine joints (hips lead), head yaw / pitch on neck + head, levelled back out of the lean; the gun hold
    //      keeps less chest on him, its whip loads the chest back then brings it through; the arm hold sways a couple of degrees against the choke's fight
    const eBody = smoothstep(0.15, 0.9, ug);
    // the lowering (HOLD.lower): on an eased copy of the choke's clock, as the man's own (heldLayer's heCk) — an eased-off choke stands both back up over half a second
    const LW = (H.beats ?? HOLD_SHOW.beats) ? K.beats.lower : K.lower, lck = clamp(this.hdCk.step(ph === 'choke' && !gunV ? clamp(t / K.secs.choke, 0, 1) : 0, ph === 'choke' ? 30 : 9, dt), 0, 1);
    const lo = lowerEase(this.hdLo, (H.low ?? 0) > 0 ? clamp(H.low!, 0, 1) * smoothstep(LW.from, LW.by, lck) : 0, LW.up, dt) * (1 - clamp(this.hdGv.x, 0, 1)), lw = this.holdPose ? 1 : w;   // (× the arm hold's share, as the man's: a gun drawn mid-rise stands both up together; lw = the layer's weight only while it fades: with a hold up the weight is in the spring, see where hdOn is set)
    // the haul (HOLD.haul): up and back with him as the arm closes, set down again before the lowering — on the same eased clock; let go of early, eased down
    const HU = K.haul, hu = haulEase(this.hdHu, !!H.haul && ph === 'choke' && !gunV, smoothstep(HU.in[0], HU.in[1], lck) * (1 - smoothstep(HU.out[0], HU.out[1], lck)), HU.down, dt) * (1 - clamp(this.hdGv.x, 0, 1)) * lw, hauled = hu > 1e-4;
    const yk = H.yank !== undefined && this.holdPose ? bump(H.yank, 0, K.yank.in, K.yank.in + K.yank.hold, K.yank.in + K.yank.hold + K.yank.out) : 0;   // (HOLD.yank: he sits into the haul)
    const HT = K.hit, hbS = K.hitShape && CS && H.yank !== undefined ? bump(H.yank, HT.t[0], HT.t[1], HT.t[2], HT.t[3]) * (1 - gv) * w : 0;   // (HOLD.hit: his chest lands on the man's back)
    const LG = K.lunge, dipW = H.step !== undefined && this.holdPose && ph === 'grab' ? bump(H.step, 0, LG.t[0], LG.t[0] + LG.t[1], LG.t[0] + LG.t[1] + LG.t[2]) : 0;   // (HOLD.lunge: the spring before it)
    const swS = (this.hdSw = this.noKnife && this.holdPose && ph === 'held' ? Math.sin(t / K.sway.secs * 2 * Math.PI) * smoothstep(0, K.sway.in, t) : damp(this.hdSw, 0, K.sway.out, dt)) * (1 - gv) * w;   // (HOLD.sway: weight from foot to foot — let go of over a few frames when the hold becomes something else, never dropped)
    const swOn = K.sway.m !== 0 && (1 - gv) * w > 1e-4 && (this.noKnife && this.holdPose && ph === 'held' ? smoothstep(0, K.sway.in, t) > 1e-4 : Math.abs(this.hdSw) > 1e-4);   // (the sway is ON, whatever its sine reads this tick: asked by the sine's own value, the leg solve below dropped out for the one tick in each half swing that lands on zero, and a knee jumped 3 cm and back)
    const seatF = CS ? (ph === 'grab' ? smoothstep(0.55, 1, ug) : 1) * (1 - gv) * w : 0, seat = seatF * (1 - clamp(lo, 0, 1)) * (1 - clamp(hu, 0, 1));   // (seatF: the FEET's share — where the seat set his rear foot it stays through the lowering and the haul: given up with the rest it slid 19 cm across the floor as he went down)
    // (HOLD.catch.seat, of `seat`: sat back behind him — given up to the lowering and the haul, which have their own fitted places, and to a gun's share)
    const PS = H.pull !== undefined && H.yank !== undefined ? H.pull * w : 0, lagS = (i: number) => PS > 1e-4 ? smoothstep(CT.samFeet[i][0], CT.samFeet[i][1], H.yank!) : 1, eSL = lagS(0), eSR = lagS(1), lagOn = PS * (1 - Math.min(eSL, eSR)) > 1e-4;   // (HOLD.catch.samFeet: he goes back with the man in the haul and his feet STEP it, the rear one first — slid with his root they skated 28 cm at one height)
    const legW = CS ? lerp(0.6 * clamp(8 * Math.max(seatF, lo, kA, yk, dipW, hbS, swOn ? 1 : 0, 20 * PS * (1 - Math.min(eSL, eSR))), 0, 1), 0.6, gv) : 0.6;   // (…and with it the knees' swivel comes on with whatever asks for the solve and goes with it: at a whole 0.6 from its first frame a knee moved 2 cm where the solve began or ended)
    if (lo > 1e-4 || kA > 1e-4 || yk > 1e-4 || ((LG.dip !== 0 || LG.back !== 0) && dipW > 1e-4) || swOn || seatF > 1e-4 || lagOn || hbS > 1e-4) {   // (a clock with nothing to move enters nothing: with the polish down the legs are as they were)   // he sinks with him: pelvis down over feet pinned where they stand, knees out to either side of the man (the kill: a hand's breadth, to let him down)
      fk.run(pA);
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      this.shift(pA, nd.hips, kA > 1e-4 ? [0, -LW.samSink * lo * lw - KL.samSink * kA * w, LW.samFwd * lo * lw] : [K.sway.m * swS + CT.seat[2] * seat, -LW.samSink * lo * lw - K.yank.sink * yk * w * (CS ? CT.yankSit : 1) - LG.dip * dipW - CT.seat[1] * seat - HT.samDip * hbS, LW.samFwd * lo * lw - LG.back * dipW - CT.seat[0] * seat + HT.samIn * hbS]); fk.run(pA);
      const pole = (r: Quat, sx: number): Vec3 => { const k = this.kneePole(r); return v3.normalize([k[0] + sx * LW.samKnees * lo, k[1], k[2]]); };
      const stepS = (f: Vec3, e: number): Vec3 => lagOn ? [f[0], f[1] + CT.samLift * Math.sin(Math.PI * e) * Math.min(1, PS / 0.1), f[2] + PS * (1 - e)] : f, sL = stepS(fL, eSL), sR = stepS(fR, eSR);
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, sL, pole(rL, 1), legW, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, seatF > 1e-4 ? [sR[0] - CT.brace[1] * seatF, sR[1] + (ph === 'grab' ? CT.braceLift * Math.sin(Math.PI * smoothstep(0.55, 1, ug)) * seatF : 0), sR[2] - CT.brace[0] * seatF] : sR, pole(rR, -1), legW, rR, true);   // (HOLD.catch.brace: the rear foot back and out under the seat)
    }
    const ckE = (H.low ?? 0) > 0 ? Math.max(ck, smoothstep(0, 0.75, lck)) : ck;   // (with the lowering on, a choke EASED OFF lets the trunk and the arm back out on the eased clock: the choke's own lets go in a frame, and his head went 8 cm with it; ck itself all the way in — the eased clock trails it)
    const lean0 = lerp(lerp(K.lean, G.lean, gv), K.chokeLean, ckE) * DEGR * w * eBody;
    const lean1 = lo > 1e-4 ? lean0 + LW.samLean * lo * DEGR * lw : lean0;
    const lean2 = kOn ? lean1 + (KL.lean[0] * kW * (1 - kA) + KL.lean[1] * kA) * DEGR * w : lean1;
    const lean = (hauled ? lean2 + HU.samLean * hu * DEGR : lean2) + CT.seatLean * seat * DEGR - HT.heave * hbS * DEGR;   // (the kill: back into the haul on his head, then forward after him)   // (HOLD.catch.seat: over him from further back)
    const brace = K.brace * Math.sin(this.idleT * 2 * Math.PI * F.hz[2] + 0.7) * fight * DEGR * w;   // (nothing unless the choke is on: fight rides kn)
    const side = (lerp(N.side, G.side, gv) - (this.noKnife ? K.apart.side * (1 - gv) : 0)) * DEGR * w * eBody + brace;   // (HOLD.apart: further out the way N.side already carries his head)   // (+ roll = left shoulder up = the head carried out to the right)
    const yawW = (G.windYaw * wnd * (1 - stk) + G.hitYaw * (stk - thru)) * DEGR * w + (sArm ? ST.yaw * bump(sT, ST.take - 0.05, ST.out - 0.02, ST.out + 0.06, ST.drop + 0.14) * DEGR * w : 0);   // (the whip's: zero the rest of the time — and the disarm's: the right shoulder goes back with the gun as it is torn out)
    const yawB = kOn ? yawW + (KL.yaw[0] * kW * (1 - kS) + KL.yaw[1] * kS * (1 - 0.5 * kA)) * DEGR * w : yawW;   // (the kill's: the chest loads left and comes through to the right with the blade)
    this.turn(pA, nd.spine1, quat.mul(qYaw(yawB * 0.3), qPitch(lean * 0.45))); this.turn(pA, nd.spine2, quat.mul(qYaw(yawB * 0.35), quat.mul(qRoll(side * 0.4), qPitch(lean * 0.35)))); this.turn(pA, nd.spine3, quat.mul(qYaw(yawB * 0.35), quat.mul(qRoll(side * 0.6), qPitch(lean * 0.2))));
    const hy = lerp(N.headYaw, G.headYaw, gv) * DEGR * w * eBody - yawB, hp = (lerp(K.headPitch, G.headPitch, gv) * DEGR - lean) * w * eBody + (lo > 1e-4 ? LW.samLook * LW.samLean * lo * DEGR * lw : 0) + (kOn ? KL.look * kA * DEGR * w : 0);   // (the head stays where it looks while the chest loads and comes through under it)
    this.turn(pA, nd.neck, quat.mul(qRoll(side * 0.8 - brace), quat.mul(qYaw(hy * 0.4), qPitch(hp * 0.4)))); this.turn(pA, nd.head, quat.mul(qRoll(-side * 0.9), quat.mul(qYaw(hy * 0.6), qPitch(hp * 0.6))));   // (the head un-tips itself: eyes level, out beside his — and rides the bracing sway out)
    this.turn(pA, nd.shoulderL, qRoll(5 * DEGR * w * eBody)); this.turn(pA, nd.shoulderR, qRoll(-lerp(N.clav * (1 - 0.6 * kn), G.clav + 4 * wnd * (1 - stk), gv) * DEGR * w * eBody));   // the choking shoulder comes up and round; the weapon arm's clavicle up with it (less once the knife hand is down on his shoulder)
    // ---- arms on a copy, against the body as it now is
    pB.copy(pA); fk.run(pB);
    const liveL = v3.copy(fk.pos[nd.handL]), liveR = v3.copy(fk.pos[nd.handR]); const rL0 = [...fk.rot[nd.handL]] as Quat, rR0 = [...fk.rot[nd.handR]] as Quat;
    const limp0 = ph === 'choke' && !gunV ? smoothstep(0.62 * K.secs.choke, 0.95 * K.secs.choke, t) : 0, limp = (H.low ?? 0) > 0 ? Math.max(limp0, smoothstep(0.62, 0.95, lck)) : limp0;   // (the man's own going-limp clock, heldLayer's: as his knees give the arm goes down with him — it is what holds him up)
    const give: Vec3 = lo > 1e-4 ? [0, -(K.sag[1] - K.sag[0]) * limp - LW.samArm[0] * lo, 0.025 * limp + LW.samArm[1] * lo] : [0, -(K.sag[1] - K.sag[0]) * limp, 0.025 * limp];   // (+ the lowering: the arm goes down with his neck)
    if (hauled) { give[1] += HU.samArm[0] * hu; give[2] -= HU.samArm[1] * hu; }   // (the haul: the arm goes up and back with his neck)
    if (seat > 1e-4) give[1] -= CT.sink * seat / Math.max(w, 1e-3);
    if (hbS > 1e-4) give[1] -= HT.dip * hbS / Math.max(w, 1e-3);   // (HOLD.hit: his knees give under the landing, and the arm goes down with his neck)   // (HOLD.catch: he is sat down into the arm, and the arm is where his neck is)
    const holdL = v3.add(v3.lerp(K.throat, K.tight, ckE), give), holdR = v3.add(v3.lerp(N.hand, N.offHand, kn), give);   // (the knife hand: at his throat ↔ down on his shoulder)
    let tgtL: Vec3, tgtR: Vec3;
    if (ph === 'grab') {   // round the outside of him and on: the left leads (0 → 0.75 of the reach), the right follows (0.2 → 1)
      const uL = smoothstep(0, 0.75, ug), uR = smoothstep(0.2, 1, ug);
      if (CR) {   // HOLD.catch: over his left shoulder beside the neck and round the front of the throat — keys that ride the MAN (off: how far he still is from his station, across and ahead), from where the reach had the hand
        const m = H.man ? this.toModelP(H.man) : null, off: [number, number] = m ? [clamp(m[0], -0.3, 0.3), clamp(m[2] - K.dist, -0.12, 0.45)] : [0, 0], on = (p: Vec3): Vec3 => [p[0] + off[0], p[1], p[2] + off[1]];
        if (!this.hdFrom) this.hdFrom = v3.copy(this.rdHandL ?? liveL);   // (where the reach had the hand on the frame before, as it was DRAWN — after every layer, the crouch's own among them)
        tgtL = curve3(uL, [[0, this.hdFrom], [CT.at[0], on(CT.via)], [CT.at[1], on(CT.over)], [1, on(holdL)]]);
      } else tgtL = curve3(uL, [[0, liveL], [0.4, K.viaL], [0.72, K.overL], [1, holdL]]);
      tgtR = curve3(uR, [[0, liveR], [0.55, N.via], [1, holdR]]);
    } else { tgtL = holdL; tgtR = holdR; }
    if (kOn) {   // the kill: the left hand up over his mouth, then down across his chest and on down with him; the knife fist set at the far side of his neck, drawn across and out wide
      tgtL = v3.lerp(v3.lerp(tgtL, KL.mouth, kW), v3.lerp(KL.chest, KL.collar, smoothstep(0.3, 1, kA)), kC);
      tgtR = v3.lerp(kS > 0 ? curve3(kS, [[0, KL.set], [0.4, KL.across], [1, KL.wide]]) : v3.lerp(tgtR, KL.set, kW), KL.low, smoothstep(0.3, 1, kA));
    }
    // hands: the left's fingers run on across the throat to his right and hook back round it, palm to the neck (back of the hand forward); the right is the fist round
    // the knife's handle, turned so the blade out of its thumb side lies where the station wants it (knifeRot)
    const rotHoldL = this.handRot(0, [-1, 0.12, -0.4], [0.1, 0.35, 1]);
    const eL = ph === 'grab' ? smoothstep(0.1, 0.7, ug) : 1, eR = ph === 'grab' ? smoothstep(0.3, 0.95, ug) : 1;
    const csG = CR, uLc = csG ? smoothstep(0, 0.75, ug) : 1, rotReach = csG ? this.handRot(0, [-0.3, 0.1, 1], [0.75, 0.6, -0.1]) : rotHoldL, lv = this.holdPose ? 1 : w;   // (lv: a hold dropped mid-reach lets the arm go WITH the layer's weight — kept whole on the frozen key the hand hung there and then jumped 70 cm)   // (HOLD.catch: the hand stays a reaching hand — fingers ahead — until it is past his shoulder, and only then turns across the throat; turned from the first frame its fingers went through his neck on the way round)
    const rotL = csG ? quat.nlerp(quat.nlerp(rL0, rotReach, smoothstep(0, CT.armIn, ug)), rotHoldL, smoothstep(CT.at[0], 0.95, uLc)) : quat.nlerp(rL0, rotHoldL, eL);
    if (csG) { const pole = v3.lerp([0.3, -0.92, 0.15], [0.55, 0.25, 0.85], smoothstep(0.62, 1, uLc)), aIn = smoothstep(0, CT.armIn, ug);   // (the elbow under the wrist and close to him until the hand is round the front of the throat — carried out level it was a wing beside his head — then up onto his collarbone)
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tgtL, pole, 0.95 * aIn, rotL);
      this.hdCaught = true; this.hdFix = { tgt: tgtL, pole, poleW: 0.95 * aIn, rot: quat.nlerp(rotReach, rotHoldL, smoothstep(CT.at[0], 0.95, uLc)), w: smoothstep(0, 0.1, ug) * lv, rw: aIn * lv };   // (catchFix, after the layers that still move his trunk)
    } else {
    if (this.hdCaught && CS && !gunV && ph === 'held' && this.holdPose && !kOn && t < CT.settle) { const f = 1 - smoothstep(0, CT.settle, t); this.hdFix = { tgt: tgtL, pole: [0.55, 0.25, 0.85], poleW: 0.95, rot: rotHoldL, w: f, rw: f }; } else if (ph !== 'grab') this.hdCaught = false;   // (…and let go of over the hold's first frames: the layers under it are still easing out, and dropped on the phase's frame the hand hopped 1.6 cm. hdCaught: the held that FOLLOWS the catch only — a choke eased off comes back to 'held' at t 0 too)
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tgtL, kOn ? v3.lerp(v3.lerp([0.55, 0.25, 0.85], [0.9, 0.35, 0.3], kW), [0.85, -0.45, 0.3], kC) : [0.55, 0.25, 0.85], 0.95 * eL, rotL); }   // elbow forward and a little left, up on his left collarbone: the upper arm over his shoulder, the forearm level across the throat
    const open = 1 - (ph === 'grab' ? smoothstep(0.5, 1, ug) : 1);   // fingers close as the hands arrive
    const cl = (a: number) => lerp(a, 0.08, open);
    this.hand(pB, 0, [cl(0.5), cl(0.58), cl(0.64), cl(0.68)], lerp(0.55, 0.1, open), open * 0.4);
    // ---- the right hand: the knife fist below gv ½, the gun hand above — one or the other from a grab's first frame; between only for the beat of a hand-over
    //      (see above): xg cross-fades the two arm solves through the middle, backK / backG say how far each grip is withdrawn toward the hand-over point
    const xg = smoothstep(0.3, 0.7, gv);
    const backK = ph === 'grab' ? 0 : smoothstep(0, 0.55, gv), backG = ph === 'grab' ? 0 : 1 - smoothstep(0.45, 1, gv);   // (a grab reaches in along its own variant's path: nothing to withdraw)
    if (xg < 1) {   // the knife fist
      const eRk = ph === 'grab' ? smoothstep(0.5, 1, ug) : 1;   // the fist keeps the blade pointing ahead (out of the hanging hand's thumb side) round the outside of him, and only turns it across once it is coming in over the shoulder — in front of his face, never through the side of his head
      const rotK = quat.nlerp(this.knifeRot(N.blade, N.back), this.knifeRot(N.offBlade, N.offBack), kn);
      const rotR = quat.nlerp(rR0, kS > 0 ? quat.nlerp(rotK, this.knifeRot(KL.wideBlade, KL.wideBack), kS) : rotK, eRk);
      const poleK = v3.lerp([-0.9, 0.15, -0.4], [-0.8, -0.55, -0.3], kn);
      const baseR = v3.lerp(tgtR, N.via, backK), poleR = kS > 0 ? v3.lerp(poleK, [-0.85, 0.5, -0.5], kS) : poleK;
      if (sArm) {
        // THE DISARM: one path for the wrist, keyed in seconds — round the outside of him onto the gun in his hand (wherever the man's own layer has it: SP.at,
        // his wrist as last posed), over the top of it; torn out to the right, down and back toward Sam's own hip; let go at the thigh; then up behind the man's
        // shoulder, where either grab comes in from, and onto its station on him. The hand turns over as it tears (the twist that breaks his grip), opens to let
        // the gun fall, and is the knife's fist again only once the knife is in it.
        const M = v3.add(SP!.at ? this.untwist(this.aimYawOffset, -this.aimPitch * this.upperW.aim * 0.35)(this.toModelP(SP!.at)) : [ST.meet[0], ST.meet[1], ST.meet[2] + K.dist], ST.over), back = lerp(ST.drop, ST.home, 0.45);   // (un-twisted: the chest is still coming round from wherever he was looking, and the hand must land on the gun all the same)
        const p = curve3(stripIn(sT, ST.take), [[0, liveR], [ST.take * 0.55, [lerp(liveR[0], M[0], 0.5) - 0.07, lerp(liveR[1], M[1], 0.6), lerp(liveR[2], M[2], 0.45)]], [ST.take, M], [ST.out, v3.add(M, ST.wrench)], [ST.drop, ST.low], [ST.drop + ST.follow, ST.low], [Math.max(back, ST.drop + ST.follow + 0.06), N.via], [ST.home, baseR]]);
        const u1 = smoothstep(ST.take * 0.3, ST.take, sT), u2 = smoothstep(ST.take, ST.out, sT), u3 = smoothstep(ST.out, ST.drop, sT), u4 = smoothstep(ST.drop + 0.08, ST.home - 0.06, sT);
        const rGrip = this.handRot(1, [0.3, -0.5, 0.8], [-0.25, 0.9, 0.3]), rTear = this.handRot(1, [-0.2, -0.8, 0.55], [-0.9, 0.25, 0.3]), rLow = this.handRot(1, [0.05, -1, 0.15], [-1, 0, 0.1]);   // over the top of the gun, fingers round it · rolled out, the back of the hand to the right · hanging at the thigh
        const grip = smoothstep(ST.take - 0.05, ST.take + 0.02, sT) * (1 - smoothstep(ST.drop, ST.drop + 0.07, sT)), fist = smoothstep(ST.knife - 0.12, ST.knife, sT), cu = (a: number) => lerp(lerp(0.14, 0.7, grip), a, fist);
        twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, p, v3.lerp([-0.95, -0.3, -0.2], poleR, u4), lerp(0.95 * smoothstep(0, 0.1, sT), 0.9 * Math.max(eR, 0.3), u4), quat.nlerp(quat.nlerp(quat.nlerp(quat.nlerp(rR0, rGrip, u1), rTear, u2), rLow, u3), rotR, u4));
        this.hand(pB, 1, [cu(0.62), cu(0.68), cu(0.72), cu(0.76)], lerp(lerp(0.15, 0.5, grip), 0.6, fist), 0.25 * (1 - grip) * (1 - fist));
      } else {
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, baseR, poleR, 0.9 * Math.max(eR, 0.3), rotR);   // elbow out to the right and UP — over the man's shoulder — for the throat; down and back once the fist is on the shoulder
      this.hand(pB, 1, [0.62, 0.68, 0.72, 0.76], 0.6);   // a fist round the handle from the first frame: the knife is in it the moment the reach begins
      }
    }
    if (xg > 0) {
      // ---- the gun hand: the right arm re-seeded from the aim clip (its grip and trigger finger — the pistol prop was tuned against that hand), then one rigid turn of
      //      that grip onto the wanted bore (gripTurn: sights up) and the wrist IK'd to its station; through the grab it comes from wherever the carry had it, wide
      //      round his right side with the muzzle high, so nothing sweeps his back. Solved on a scratch copy while the knife fist still has a share of the arm.
      const P = xg < 1 ? this.pC : pB; if (P !== pB) P.copy(pB);
      const m = this.dynMask; m.fill(0); const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); }; setSub(nd.shoulderR, 1); m[nd.shoulderR] = 0;   // (the clavicle stays the body's: posed above)
      blendPose(P, this.pAim, 1, m, P); fk.run(P);
      const pR0 = fk.pos[nd.handR], rAim: Quat = [...fk.rot[nd.handR]] as Quat; const g0 = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR0));   // the clip's bore as posed on this body
      const gLive = v3.normalize(quat.rotate(quat.mul(rR0, quat.conj(rAim)), g0));                                                             // …and where the carry underneath actually has it pointing
      const out = clamp(H.gunOut ?? 0, 0, 1) * (1 - wnd), pitch = H.gunPitch ?? 0;
      const kick = this.shootT >= 0 ? bump(this.shootT, 0, 0.035, 0.06, 0.24) : 0;   // recoil: up in ~35 ms, back down over ~0.2 s
      // wrist station and bore by phase (a hand-over in progress draws the station back toward its point over his shoulder, muzzle high: backG)
      const rest = v3.lerp(v3.lerp(G.hand, G.outHand, out), G.viaB, backG);
      let hand: Vec3, bore: Vec3;
      const boreRest = v3.normalize(v3.lerp(v3.lerp(G.bore, [0, Math.sin(pitch), Math.cos(pitch)], out), G.viaBore, backG));
      if (ph === 'grab') {
        const uR = smoothstep(0.1, 1, ug);
        hand = SP && SP.at && gunV   // (the disarm, the pistol hold's: the frame comes down on the man's gun wrist on its way round and up to his head)
          ? (() => { const R = v3.add(this.untwist(this.aimYawOffset, -this.aimPitch * this.upperW.aim * 0.35)(this.toModelP(SP.at!)), ST.rap), g = K.secs.grab; return curve3(stripIn(t, ST.take), [[0, liveR], [ST.take, R], [lerp(ST.take, g, 0.35), G.viaA], [lerp(ST.take, g, 0.7), G.viaB], [g, rest]]); })()
          : curve3(uR, [[0, liveR], [0.38, G.viaA], [0.7, G.viaB], [1, rest]]);
        bore = v3.normalize(curve3(uR, [[0, gLive], [0.5, G.viaBore], [1, boreRest]]));
      } else if (ph === 'whip') {
        hand = v3.lerp(v3.lerp(v3.lerp(rest, G.windHand, wnd), G.hitHand, stk), G.thruHand, thru);
        bore = v3.normalize(v3.lerp(v3.lerp(v3.lerp(boreRest, G.windBore, wnd), G.hitBore, stk), G.bore, thru));
      } else { hand = rest; bore = boreRest; }
      if (kick > 0) {   // the muzzle flips up about the wrist and the hand comes back along the bore
        const upK = Math.sin(G.kickPitch * DEGR * kick); bore = v3.normalize([bore[0], bore[1] + upK, bore[2]]);
        hand = v3.mad(v3.add(hand, [0, 0.01 * kick, 0]), bore, -G.kickBack * kick);
      }
      const D = this.gripTurn(g0, rAim, bore, AY);
      const eG = ph === 'grab' ? smoothstep(0.05, 0.6, ug) : 1;   // (the first frames of the reach: still mostly the carry's own hand)
      const rotR = quat.nlerp(rR0, quat.mul(D, rAim), eG);
      const pole = v3.lerp([-1, -0.35, -0.45], [-0.7, 0.2, -0.7], wnd * (1 - stk));   // elbow out to the right and a little down; up and back as it cocks
      twoBoneIK(fk, P, nd.upperArmR, nd.forearmR, nd.handR, hand, pole, 0.9 * Math.max(eG, 0.3), rotR);
      if (P !== pB) blendPose(pB, P, xg, this.armROnly, pB);   // (the clavicle is the same on both: only the arm below it moves with the cross-fade)
    }
    blendPose(pA, pB, w, this.armsMask, pA);
    if (csG && this.holdPose && w < 1) { const wL = Math.max(w, smoothstep(0, 0.1, ug)); if (wL > w) blendPose(pA, pB, (wL - w) / (1 - w), this.armLOnly, pA); }   // (HOLD.catch: the left arm is the hold's own before the layer's weight has come in — its path starts where the reach had the hand, so nothing jumps)
    if (SP && sT < ST.out && w < 1) { const wS = Math.max(w, smoothstep(0, 0.8 * ST.take, sT)); if (wS > w) blendPose(pA, pB, (wS - w) / (1 - w), this.armROnly, pA); }   // (the disarm: the hand is ON the gun at `take`, a tenth of a second before the layer's own weight has come in — its path starts at the live hand, so nothing jumps)
  }

  /** The held man (heldPose, weight w). Body into pA: the spine arched back onto the arm and the head pulled back chin-up (both giving way to a forward loll as a
   *  choke takes him), shoulders hunched, a struggle — shoulder roll, a twist, now and then a jerk — whose size is his agitation, and the pelvis sinking onto soft
   *  knees (a couple of centimetres held, a hand's breadth by the end of a choke; heCk eases it either way so easing off a choke stands him back up) over feet
   *  IK-pinned where the cycle has them; hard breathing while he is held, and through a choke a FIGHT (HOLD.struggle) — trunk and head thrashing, knees pumping —
   *  that rises as the arm closes and is spent as he goes. Arms on a copy through the arms mask: held, the left laid on the forearm at his throat and the right
   *  half up beside his head, open (a pistol he was grabbed with stays in it); choked, both clawing at the forearm; going, both falling away. During the grab they
   *  come up from wherever they were. A change of variant mid-hold (Sam draws / holsters, E) rides heGv, the eased share of it: the numbers that differ and the
   *  arm targets are blended by it, so his hands re-settle over the beat instead of popping. */
  private heldLayer(w: number, dt: number) {
    const H = this.heldPose ?? this.heLast, K = HOLD; const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, tt = this.idleT;
    const ph = H.phase, t = H.t, ag = clamp(H.agitation, 0, 1), G = K.gun, F = K.struggle, TAU = 2 * Math.PI;
    const gv = clamp(this.heGv.x, 0, 1);   // 0 = the arm at his throat ↔ 1 = the gun at his head (eased across a mid-hold change)
    const ug = ph === 'grab' ? clamp(t / K.secs.grab, 0, 1) : 1;
    const ck = clamp(this.heCk.step(ph === 'choke' ? clamp(t / K.secs.choke, 0, 1) : 0, ph === 'choke' ? 30 : 9, dt), 0, 1);   // follows the choke closely, comes back off an aborted one over ~half a second
    const limp = smoothstep(0.62, 0.95, ck);                                                    // going: the arch and the struggle give way, the head lolls, the hands fall
    const eIn = smoothstep(0.05, 0.6, ug);                                                     // the startle coming on through the grab
    const CS = K.catchShape && !!H.bare, CT = K.catch, JT = CT.jolt, CR = CS && H.variant !== 'gun' && ph === 'grab';   // (HOLD.catch: the bare arm hold's eighth pass — CS his seat, given up to a gun by gv, the eased share; CR the arm variant's grab: the jolt and his hands)
    const jl = CR ? bump(t, JT.t[0], JT.t[1], JT.t[2], JT.t[3]) * w : 0;       // the jolt: he is hit from behind before he is hauled back
    const HT = K.hit, hb = K.hitShape && CS && H.yank !== undefined ? bump(H.yank, HT.t[0], HT.t[1], HT.t[2], HT.t[3]) * (1 - gv) * w : 0;   // (HOLD.hit: Sam's chest lands on his back — the yank's clock, so nothing in a grab with no step in)
    const shot = H.shot !== undefined && H.shot >= 0 ? bump(H.shot, 0, 0.05, 0.12, G.duck.secs) * w : 0;   // a round just went past his ear: he ducks off it (only the gun hold fires one; the flinch outlives a holstering by its own half second)
    const knock = ph === 'whip' ? smoothstep(K.secs.whip - 0.1, K.secs.whip, t) * w : 0;                      // the pistol landing behind his right ear: the head goes with it (and the ragdoll is seeded going that way)
    // the kill (HOLD.kill), on his own eased copy of its clock: hauled back by the hand on his mouth (kW) · the jolt as the blade goes across (kJ) · his hands at
    // his throat (kT) and falling (kF) · the head coming forward (kL) · the knees giving, gathering speed (kG: the fall takes it from there)
    const KL = K.kill, kk = killEase(this.heKc, (H.kill ?? HOLD_SHOW.kill) && ph === 'kill' && H.variant !== 'gun', t, dt), kOn = kk > 1e-4;
    const kW = kOn ? smoothstep(0, KL.wind, kk) : 0, kJ = kOn ? bump(kk, KL.hit - 0.03, KL.hit + 0.02, KL.hit + 0.08, KL.hit + 0.24) : 0, kT = kOn ? smoothstep(KL.hit, KL.hit + 0.14, kk) : 0;
    const kF = kOn ? smoothstep(0.58, 1, kk) : 0, kL = kOn ? smoothstep(KL.hit + 0.12, 0.9, kk) : 0, kG = kOn ? clamp((kk - KL.go) / (1 - KL.go), 0, 1) ** 2 * w : 0;   // (kG alone carries the layer's weight: it moves the pelvis and the fold outright; the others sit inside terms that are weighted already)
    // ---- restlessness: amplitude by agitation (bigger through the grab, gone as he goes limp; smaller with a gun at his head — he holds still for it), and now and
    //      then a tug at the arm (a jerk of the trunk, the left hand hauling down on the forearm) every 3–6 s
    const A = (0.35 + 0.65 * ag) * (1 - limp) * (ph === 'grab' ? 1.4 : 1) * lerp(1, 0.55, gv) * w * (kOn ? 1 - kL : 1);
    const period = 3 + 3 * (0.5 + 0.5 * Math.sin(Math.floor(tt / 4.5) * 12.9898));           // a jerk every 3–6 s (re-dealt each spell), 0.2 s long
    const jerk = bump(tt % period, 0, 0.06, 0.14, 0.24) * (1 - limp) * w * (0.5 + 0.5 * ag) * (kOn ? 1 - Math.max(kW, kL) : 1);
    // ---- the choke's fight (arm variant; the gun hold has no choke): an envelope on the EASED choke amount — up fast as the arm closes, spent as he goes, and let
    //      down gently by heCk if Sam eases off — driving a 2–3 Hz thrash of trunk and head, the hands clawing at the forearm, the knees pumping. Three sines off
    //      his own desynced clock: deterministic, and no two men fight alike.
    const S = smoothstep(0, F.rise, ck) * (1 - smoothstep(F.fadeFrom, F.fadeTo, ck)) * (1 - gv) * w;
    const s1 = Math.sin(tt * TAU * F.hz[0] + 0.4), s2 = Math.sin(tt * TAU * F.hz[1] + 1.3), s3 = Math.sin(tt * TAU * F.hz[2] + 2.1);
    const roll = (4 * Math.sin(tt * TAU * 0.7) * A + 5 * jerk + F.roll * s3 * S) * DEGR, yawS = (3 * Math.sin(tt * TAU * 0.45 + 1) * A - 7 * jerk + F.yaw * (0.65 * s1 + 0.35 * s2) * S) * DEGR;
    // ---- hard breathing while he is held (the fight and the going take it over): the chest heaving back and the shoulders lifting on each breath
    const br = (0.5 - 0.5 * Math.cos(tt * TAU * K.breath.hz)) * (1 - limp) * (1 - 0.7 * S) * lerp(1, 0.6, gv) * w * eIn * (kOn ? 1 - kL : 1);
    // the haul (HOLD.haul), on his own eased copy of the choke: up and back onto Sam as the arm closes, set down before he is lowered
    const HU = K.haul, hu = haulEase(this.heHu, !!H.haul && ph === 'choke', smoothstep(HU.in[0], HU.in[1], ck) * (1 - smoothstep(HU.out[0], HU.out[1], ck)), HU.down, dt) * (1 - gv) * (this.heldPose ? 1 : w), hauled = hu > 1e-4;
    // ---- body: feet noted first (re-planted after the pelvis sinks), then arch / hunch / head
    fk.run(pA);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const drop = (lerp(K.sag[0], K.sag[1], ck) + 0.02 * shot + F.dip * (0.5 + 0.5 * Math.sin(tt * TAU * 1.3)) * S) * w * eIn + JT.dip * jl;   // (the knees pumping under the fight, giving toward its end)
    if (drop > 1e-4) { this.shift(pA, nd.hips, [0, -drop, 0]); this.turn(pA, nd.hips, qPitch(drop * 40 * DEGR)); }
    if (hauled) { this.shift(pA, nd.hips, [0, HU.lift * hu, -HU.back * hu]); this.turn(pA, nd.hips, qPitch(HU.recline * hu * DEGR)); }
    { const sw = (this.heSw = H.bare && this.heldPose && ph === 'held' ? Math.sin(t / K.sway.secs * 2 * Math.PI) * smoothstep(0, K.sway.in, t) : damp(this.heSw, 0, K.sway.out, dt)) * (1 - gv) * (1 - limp) * w;   // (HOLD.sway: his weight goes from foot to foot with Sam's, and he twists against the arm)
      if (H.bare) this.turn(pA, nd.neck, qRoll(K.apart.tip * DEGR * w * (1 - gv) * (1 - limp) * (1 - clamp(hu, 0, 1)) * (ph === 'grab' ? smoothstep(0.3, 1, t / K.secs.grab) : 1)));   // (HOLD.apart: his head tips away from Sam's — two heads, seen from above; eased out under the gun's share and the haul, as they ease)
      if (Math.abs(sw) > 1e-4) { this.shift(pA, nd.hips, [K.sway.m * K.sway.his * sw, 0, 0]); this.turn(pA, nd.spine2, qYaw(K.sway.twist * (0.6 + 0.8 * clamp(H.agitation, 0, 1)) * sw * DEGR)); } }
    // the lowering (HOLD.lower): as he goes limp he is let down onto his heels, the trunk folding forward under the arm that still has his neck
    const lk = clamp(this.heLk.step(ph === 'choke' ? clamp(t / K.secs.choke, 0, 1) : 0, ph === 'choke' ? 30 : 9, dt), 0, 1);   // heCk's twin, the lowering's own: reset as a hold begins (heCk never was, and the hold's old sink keeps it so)
    const BT = K.beats, bt = H.beats ?? HOLD_SHOW.beats;
    const LW = bt ? BT.lower : K.lower, lo0 = lowerEase(this.heLo, (H.low ?? 0) > 0 ? clamp(H.low!, 0, 1) * smoothstep(LW.from, LW.by, lk) : 0, LW.up, dt), lo = lo0 * (1 - gv) * (this.heldPose ? 1 : w);   // (the layer's weight only while it fades, as Sam's)
    const bOff = lowerEase(this.heBo, bt ? smoothstep(BT.off[0], BT.off[1], lk) : 0, BT.back, dt), bIn = lowerEase(this.heBc, bt ? smoothstep(BT.clamp[0], BT.clamp[1], lk) : 0, BT.back, dt), tipU = bt ? smoothstep(BT.tipBy[0], BT.tipBy[1], lk) : 0, bTip = tipU * (1 - limp) * (1 - gv);   // the choke's beats: his hands off the arm, his head to the side, before he is lowered — on lk, the clock a fresh hold starts over (on heCk a man re-grabbed after a choke broken off began with his hands already off the arm)
    const limpA = Math.max(limp, lo0, kF, bOff);   // his ARMS hang for as long as he is down: let back up (the choke eased off) they come back to Sam's forearm with him, not in the tenth of a second the choke's clock takes
    // HOLD.catch: hauled off his feet's line — sat `sink` m down into the arm (which goes down with his neck: holdLayer's give), the hips ahead of where they
    // stood with the trunk reclined about his own neck (the turn's angle is the one that puts the neck back), the feet out in front; and through the yank
    // each foot stays where it stood on the floor and comes after him. Given up to the lowering and the haul, which have their own fitted places.
    const sit = CS ? (ph === 'grab' ? smoothstep(0.55, 1, ug) : 1) * (1 - gv) * (1 - clamp(lo0, 0, 1)) * (1 - clamp(hu, 0, 1)) * (this.heldPose ? 1 : w) : 0, off = sit * (1 - limp), sitF = CS ? (ph === 'grab' ? smoothstep(0.55, 1, ug) : 1) * (1 - gv) * (this.heldPose ? 1 : w) : 0;   // (sitF: his FEET's share — where the seat set his heels they stay as he goes limp, is lowered or hauled: given up with the rest they slid 12 cm back under him)
    const foot = (i: number): Vec3 => { if (!CS) return [0, 0, 0]; const P = (H.pull ?? 0) * (1 - limp) * (1 - gv), e = H.yank !== undefined && this.heldPose ? smoothstep(CT.feet[i][0], CT.feet[i][1], H.yank) : 1, lag = P * (1 - e), rest = CT.heels[i] * sitF; return [0, P > 1e-4 ? CT.lift * Math.sin(Math.PI * e) * Math.min(1, P / 0.1) : 0, Math.max(lag, rest)]; };
    const offL = foot(0), offR = foot(1), offOn = offL[2] > 1e-4 || offR[2] > 1e-4;
    let hitRec = 0;   // (HOLD.hit: how much further the landing reclines him than the seat does, rad — his head is given that much back, it stays where the arm has it)
    if (sit > 1e-4 || hb > 1e-4) { if (!this.heSpan) { fk.run(pA); this.heSpan = Math.max(0.2, fk.pos[nd.neck][1] - fk.pos[nd.hips][1]); } const span = this.heSpan, ahead = CT.hips * off + HT.hips * hb, rec = Math.asin(clamp(ahead / span, 0, 0.6)), rec0 = Math.asin(clamp(CT.hips * off / span, 0, 0.6)); hitRec = rec - rec0; this.shift(pA, nd.hips, [0, -CT.sink * sit - HT.dip * hb + span * (Math.cos(rec0) - Math.cos(rec)), ahead]); this.turn(pA, nd.hips, qPitch(-rec)); }   // (HOLD.hit: driven further ahead as the body lands, about the same neck — and up by what the further recline would lower that neck: it is in the arm, and left to drop it went 9 cm out from under the forearm)
    if (lo > 1e-4) { this.shift(pA, nd.hips, [0, -LW.sink * lo, LW.fwd * lo]); this.turn(pA, nd.hips, qPitch(LW.hip * lo * DEGR)); }
    if (kG > 1e-4) { this.shift(pA, nd.hips, [0, -KL.sink * kG, KL.fwd * kG]); this.turn(pA, nd.hips, qPitch(KL.hip * kG * DEGR)); }
    const arch0 = (kOn ? lerp(lerp(lerp(K.arch, 2, limp), KL.arch, kW), 2, kL) : lerp(K.arch, 2, limp)) * DEGR * w * eIn + G.duck.pitch * DEGR * 0.5 * shot;
    const ykH = H.yank !== undefined && this.heldPose ? bump(H.yank, 0, K.yank.in, K.yank.in + K.yank.hold, K.yank.in + K.yank.hold + K.yank.out) : 0;
    const archB = H.bare ? (K.bareArch * (1 - limp) * (1 - gv) * eIn + K.yank.arch * ykH) * DEGR * w : 0;   // (HOLD.bareArch / yank: hauled back onto the arm. Under the lifted choke it STAYS: faded as the haul came in, his neck slid 5 cm along the forearm — so the two heads are 3 cm nearer at the haul's height than with a knife in the hand, 19 cm against 22)
    const arch = ((hauled ? arch0 + HU.arch * hu * DEGR : arch0) + archB) * (1 - jl) + JT.fwd * jl * DEGR;     // (HOLD.catch.jolt: forward first)   // arched back → the arch just gone as he goes (his neck stays in the crook of the arm: it is what holds him up — the head lolls over it, the knees give under it)
    const heave = -K.breath.pitch * br * DEGR;
    this.turn(pA, nd.spine1, quat.mul(qYaw(yawS * 0.3), qPitch(arch * 0.3))); this.turn(pA, nd.spine2, quat.mul(qYaw(yawS * 0.4), quat.mul(qRoll(roll * 0.4), qPitch(arch * 0.35 + heave * 0.4)))); this.turn(pA, nd.spine3, quat.mul(qYaw(yawS * 0.3), quat.mul(qRoll(roll * 0.6), qPitch(arch * 0.35 + heave * 0.6))));
    const clav = (K.clavUp * eIn * (1 - limp) + G.duck.hunch * shot + K.breath.clav * br) * DEGR * w + JT.clav * jl * DEGR; this.turn(pA, nd.shoulderL, qRoll(clav + 3 * s1 * S * DEGR)); this.turn(pA, nd.shoulderR, qRoll(-clav + 3 * s2 * S * DEGR));   // (the shoulders working against the arm, out of step)
    const aside = lerp(K.aside, G.aside, gv), chinUp = lerp(K.chinUp, G.chinUp, gv);
    const chin0 = kOn ? lerp(lerp(lerp(chinUp, K.loll, limp), KL.chin, kW), K.loll, kL) + KL.jolt[1] * kJ : lerp(chinUp, K.loll, limp);   // (the kill: hauled back onto Sam's shoulder, a jolt further as the blade goes across, then forward onto his chest)
    const chin1 = chin0 * DEGR * w * eIn - drop * 40 * DEGR + (G.duck.pitch * shot + G.knock.pitch * knock + F.head * 0.35 * s3 * S) * DEGR - heave;
    const chin = (hauled ? chin1 + HU.chin * hu * DEGR : chin1) * (1 - jl) + JT.head * jl * DEGR + HT.head * hitRec;   // (the head nods against the heave: the eyes stay put while the chest works)
    const hr = (K.lollRoll * limp - aside * (1 - limp) * eIn * (kOn ? 1 - kW : 1) * (1 - tipU) + (kOn ? K.lollRoll * kL : 0) + (bt ? BT.tip * bTip : 0) + 3 * Math.sin(tt * 3.1) * A + F.roll * 0.7 * s1 * S - G.duck.roll * shot - G.knock.roll * knock) * DEGR * w;   // (− roll: his head tips out to his left — off the blade hand at his throat, or off the can at his right temple; ducked further off a shot, knocked that way by the whip)
    const hyw = (6 * Math.sin(tt * 1.7 + 2) * A + 9 * jerk + F.head * (0.6 * s2 + 0.4 * s3) * S + G.awayYaw * eIn * gv + G.duck.yaw * shot + G.knock.yaw * knock + (kOn ? KL.jolt[0] * kJ * w : 0)) * DEGR;
    this.turn(pA, nd.neck, quat.mul(qYaw(hyw * 0.4), quat.mul(qRoll(hr * 0.4), qPitch(chin * 0.45)))); this.turn(pA, nd.head, quat.mul(qYaw(hyw * 0.6), quat.mul(qRoll(hr * 0.6), qPitch(chin * 0.55))));
    if (lo > 1e-4) { const f = LW.fold * lo * DEGR; this.turn(pA, nd.spine1, qPitch(f * 0.3)); this.turn(pA, nd.spine2, qPitch(f * 0.35)); this.turn(pA, nd.spine3, qPitch(f * 0.35)); }
    if (kG > 1e-4) { const f = KL.fold * kG * DEGR; this.turn(pA, nd.spine1, qPitch(f * 0.3)); this.turn(pA, nd.spine2, qPitch(f * 0.35)); this.turn(pA, nd.spine3, qPitch(f * 0.35)); }
    if (hauled) {   // off his feet: they come up and forward off where they stood, toes down, kicking with the fight
      const toe = qPitch(HU.toes * hu * DEGR), kf = HU.kick[0] * S * hu, ku = HU.kick[1] * S * hu;
      const tL: Vec3 = [fL[0], fL[1] + HU.feet[0] * hu + ku * (0.5 + 0.5 * s2) + offL[1], fL[2] + HU.feet[1] * hu + kf * s1 + offL[2]], tR: Vec3 = [fR[0], fR[1] + HU.feet[0] * hu + ku * (0.5 - 0.5 * s2) + offR[1], fR[2] + HU.feet[1] * hu - kf * s1 + offR[2]];
      fk.run(pA); twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tL, this.kneePole(rL), 0.6, quat.mul(toe, rL)); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tR, this.kneePole(rR), 0.6, quat.mul(toe, rR), true);
    } else if (offOn) { fk.run(pA); twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, v3.add(fL, offL), this.kneePole(rL), 0.6, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, v3.add(fR, offR), this.kneePole(rR), 0.6, rR, true); }
    else if (drop > 1e-4 || lo > 1e-4 || kG > 1e-4 || hb > 1e-4) { fk.run(pA); twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0.6, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0.6, rR, true); }
    const hgY = kG > 1e-4 ? LW.hang[0] * lo + KL.hang[0] * kG : LW.hang[0] * lo, hgZ = kG > 1e-4 ? LW.hang[1] * lo + KL.hang[1] * kG : LW.hang[1] * lo, dn = lo > 1e-4 || kG > 1e-4;
    const hangL: Vec3 = dn ? [K.hang[0][0], K.hang[0][1] - hgY, K.hang[0][2] + hgZ] : K.hang[0], hangR: Vec3 = dn ? [K.hang[1][0], K.hang[1][1] - hgY, K.hang[1][2] + hgZ] : K.hang[1];   // (his hands hang from where his shoulders now are)
    // ---- arms: the arm hold's set (gv 0) and / or the gun hold's (gv 1) — one of them nearly always; both, blended, for the beat of a mid-hold change
    pB.copy(pA); fk.run(pB);
    const liveL = v3.copy(fk.pos[nd.handL]), liveR = v3.copy(fk.pos[nd.handR]); const rL0 = [...fk.rot[nd.handL]] as Quat, rR0 = [...fk.rot[nd.handR]] as Quat;
    type ArmSet = { tgtL: Vec3; tgtR: Vec3; rotL: Quat; rotR: Quat; poleL: Vec3; poleR: Vec3; curlL: number[]; curlR: number[]; thumbL: number; thumbR: number; spreadL: number; spreadR: number };
    const armHold = (): ArmSet => {
      // held: the left hand laid on the forearm by his collarbone (hauling down on it with each tug), the right half up beside his head, open, palm forward, shaking
      // a little — frozen, pleading, not fighting. The choke changes that (cIn, on the eased amount, so easing off puts them back): both hands come clawing at the
      // forearm, working up and down it out of step at the fight's rate; then they fall away as he goes.
      const cIn = Math.max(bt ? bIn : smoothstep(0.04, 0.3, ck), kW);   // (the kill: both come up at the hand on his mouth as they do at the arm)
      const cR = H.bare ? Math.max(cIn, K.bareGrip) : cIn;   // (HOLD.bareGrip: no blade at his throat to freeze him — his right hand is on the arm from the start)
      const cwL = kOn ? v3.lerp(K.clawL, v3.lerp(KL.reach[0], KL.clutch[0], kT), kW) : K.clawL, cwR = kOn ? v3.lerp(K.clawR, v3.lerp(KL.reach[1], KL.clutch[1], kT), kW) : K.clawR;   // (…and go to his own throat once it is cut)
      const hv: Vec3 | null = hauled || sit > 1e-4 ? [0, HU.samArm[0] * hu - CT.sink * sit, -HU.samArm[1] * hu] : null, clL = hv ? v3.add(cwL, hv) : cwL, clR = hv ? v3.add(cwR, hv) : cwR;   // (the haul: his hands go with the forearm they are on)
      const claw = (o: number): Vec3 => [F.claw * 0.6 * Math.sin(tt * TAU * 1.7 + o) * S, F.claw * Math.sin(tt * TAU * 2.6 + o) * S, F.claw * 0.4 * Math.sin(tt * TAU * 2.6 + o + 1) * S];
      const snk = CT.sink * sit;   // (HOLD.catch: the forearm his hands are on has gone down with his neck)
      const rest: Vec3 = [K.restL[0], K.restL[1] - 0.03 * jerk - snk, K.restL[2] - 0.02 * jerk];
      const up: Vec3 = [K.raisedR[0] + 0.01 * Math.sin(tt * TAU * 1.1) * A, K.raisedR[1] + 0.012 * Math.sin(tt * TAU * 0.9 + 1) * A + 0.03 * jerk - snk, K.raisedR[2] + 0.01 * Math.cos(tt * TAU * 0.6) * A];
      const cl = lerp(0.62, 0.82, 0.5 + 0.5 * Math.sin(tt * TAU * 2.6)) * S + 0.65 * (1 - S);   // clawing: the fingers working
      return {
        tgtL: v3.lerp(v3.lerp(rest, v3.add(clL, claw(0)), cIn), hangL, limpA),
        tgtR: v3.lerp(v3.lerp(up, v3.add(clR, claw(Math.PI)), cR), hangR, limpA),
        // hands: the left palm-down over the top of the forearm, fingers down its front (→ hooked up and back over it from below, back of the hand forward, once it claws); the right
        // fingers up and palm forward beside his head (→ hooked over the forearm from his right)
        rotL: quat.nlerp(this.handRot(0, [-0.25, -0.8, 0.5], [0, 0.55, 0.8]), this.handRot(0, [-0.5, 0.6, -0.6], [0.2, 0.5, 0.85]), cIn),
        rotR: quat.nlerp(this.handRot(1, [-0.2, 1, 0.1], [-0.15, 0.1, -1]), this.handRot(1, [0.5, 0.55, -0.6], [-0.2, 0.5, 0.85]), cR),
        poleL: H.bare ? v3.lerp(v3.lerp([1, -0.9, 0.3], [1, -0.5, 0.55], cIn), [0.45, -1, 0.35], K.bareElbow) : v3.lerp([1, -0.9, 0.3], [1, -0.5, 0.55], cIn), poleR: H.bare ? v3.lerp(v3.lerp([-0.8, -1, 0.15], [-1, -0.6, 0.5], cR), [-0.45, -1, 0.35], K.bareElbow) : v3.lerp([-0.8, -1, 0.15], [-1, -0.6, 0.5], cR),   // elbows: down at his left side, coming forward for the clawing; down and out under the raised hand, coming in and up for the arm
        curlL: [0.25, 0.3, 0.32, 0.35].map(a => lerp(lerp(a, cl, cIn), 0.2, limpA)), thumbL: lerp(0.15, 0.3, cIn), spreadL: 0,
        curlR: H.armed ? [0.75, 0.8, 0.8, 0.8].map(a => lerp(a, 0.35, limpA)) : [0.08, 0.1, 0.12, 0.18].map(a => lerp(lerp(a, cl, cR), 0.25, limpA)),   // (a pistol he was grabbed with stays in the fist — pointing at the ceiling out of the raised hand — until killGuard takes it)
        thumbR: H.armed ? 0.6 : lerp(0.05, 0.3, cR), spreadR: H.armed ? 0 : 0.7 * (1 - cR),   // the raised hand's fingers splayed
      };
    };
    const gunHold = (): ArmSet => {
      // the gun at his head: both hands half up in front of the shoulders, palms forward, trembling with the struggle, jerked in when a round goes past; whatever
      // the right holds (torch, pistol) points at the ceiling out of the raised fist
      const trem = 0.012 * Math.sin(tt * TAU * 1.1) * A, U = G.handsUp;
      const openL = Math.max(limpA, 0.85), fist = 1 - limpA * 0.7;
      return {
        tgtL: v3.lerp([U[0][0] - 0.03 * shot, U[0][1] + trem + 0.05 * shot + 0.03 * jerk, U[0][2] - 0.04 * shot], K.hang[0], limpA),
        tgtR: v3.lerp([U[1][0] + 0.03 * shot + 0.03 * Math.sin(tt * 0.8) * A, U[1][1] - trem + 0.05 * shot + 0.04 * jerk, U[1][2] - 0.04 * shot + 0.02 * Math.cos(tt * 0.6) * A], K.hang[1], limpA),
        rotL: this.handRot(0, [0.15, 1, 0.2], [0.1, 0.15, -1]), rotR: this.handRot(1, [-0.15, 1, 0.2], [-0.1, 0.15, -1]),   // fingers up, palms forward
        poleL: [0.8, -1, 0.2], poleR: [-0.8, -1, 0.2],   // elbows down and a little out
        curlL: [lerp(0.6, 0.15, openL), lerp(0.7, 0.2, openL), lerp(0.75, 0.25, openL), lerp(0.8, 0.3, openL)], thumbL: lerp(0.3, 0.15, openL), spreadL: 0.35,
        curlR: [0.2 + 0.55 * fist, 0.25 + 0.55 * fist, 0.3 + 0.55 * fist, 0.3 + 0.55 * fist], thumbR: 0.2 + 0.4 * fist, spreadR: 0,   // (never quite open: the pistol stays in it until killGuard takes it)
      };
    };
    const a = gv < 1 ? armHold() : null, b = gv > 0 ? gunHold() : null;
    const Z: ArmSet = a && b ? {
      tgtL: v3.lerp(a.tgtL, b.tgtL, gv), tgtR: v3.lerp(a.tgtR, b.tgtR, gv), rotL: quat.nlerp(a.rotL, b.rotL, gv), rotR: quat.nlerp(a.rotR, b.rotR, gv),
      poleL: v3.lerp(a.poleL, b.poleL, gv), poleR: v3.lerp(a.poleR, b.poleR, gv), curlL: a.curlL.map((c, i) => lerp(c, b.curlL[i], gv)), curlR: a.curlR.map((c, i) => lerp(c, b.curlR[i], gv)),
      thumbL: lerp(a.thumbL, b.thumbL, gv), thumbR: lerp(a.thumbR, b.thumbR, gv), spreadL: lerp(a.spreadL, b.spreadL, gv), spreadR: lerp(a.spreadR, b.spreadR, gv),
    } : (a ?? b)!;
    let tgtL = Z.tgtL, tgtR = Z.tgtR;
    if (CR) { const FL = CT.fling, way = (live: Vec3, i: number, end: Vec3): Vec3 => { const n = FL.land[i]; return curve3(clamp(ug / n, 0, 1), [[0, live], [FL.t[0] / n, FL.to[i]], [FL.t[1] / n, v3.add(FL.to[i], FL.drift)], [1, end]]); };
      // (HOLD.catch.fling: both hands fly out from his sides first — what the camera overhead sees of a man who has been hit — hang there a tenth of a second, one
      // higher than the other, and come onto the arm from there one after the other)
      tgtL = way(liveL, 0, tgtL); tgtR = way(liveR, 1, tgtR); }
    else if (ph === 'grab') { tgtL = v3.lerp(liveL, tgtL, smoothstep(0.15, 0.7, ug)); tgtR = curve3(smoothstep(0.05, 0.85, ug), [[0, liveR], [0.5, K.viaUp], [1, tgtR]]); }
    // the disarm (HOLD.strip): his gun hand is thrown out beside his ribs as the arm lands — where Sam's hand takes the gun out of it — dragged after the wrench,
    // let go of, and only then comes up to where the hold has it; the fist round the gun opens as the gun leaves it, not in a frame
    const SP = this.heldPose?.strip ?? null, ST = K.strip, sT = SP ? SP.t : 0, sOn = !!SP && sT < ST.home;
    if (sOn) tgtR = curve3(stripIn(sT, ST.take), [[0, liveR], [ST.take, ST.meet], [ST.take + 0.06, ST.torn], [ST.free, ST.torn], [ST.up, Z.tgtR]]);
    // limp, both hang palm-in
    const rotHangL = this.handRot(0, [0.1, -1, 0.15], [1, 0, 0.1]), rotHangR = this.handRot(1, [-0.1, -1, 0.15], [-1, 0, 0.1]);
    const eA = ph === 'grab' ? smoothstep(0.1, 0.75, ug) : 1;
    // (let back up out of the lowering the blend spends a third of a second between the hang and the hold, whose rotations are all but opposite: which way round
    //  it goes is then the way it went the frame before — the shorter way changes sides as the hold's own rotation moves, and the hand flipped over in a frame)
    const toHang = (q: Quat, h: Quat, prev: Quat | null): Quat => {
      const mix = (s: number): Quat => quat.normalize([lerp(q[0], h[0] * s, limpA), lerp(q[1], h[1] * s, limpA), lerp(q[2], h[2] * s, limpA), lerp(q[3], h[3] * s, limpA)]);
      const c = quat.nlerp(q, h, limpA); if (!prev) return c;
      const o = mix(quat.dot(q, h) < 0 ? 1 : -1);
      return Math.abs(quat.dot(o, prev)) > Math.abs(quat.dot(c, prev)) ? o : c;
    };
    const kept = lo0 > 1e-4 || kF > 1e-4 || bOff > 1e-4;
    const rotL = toHang(quat.nlerp(rL0, Z.rotL, eA), rotHangL, kept ? this.heHr[0] : null);
    const rotR = toHang(quat.nlerp(rR0, Z.rotR, sOn ? smoothstep(ST.take, ST.up, sT) : eA), rotHangR, kept ? this.heHr[1] : null);
    this.heHr[0] = kept ? rotL : null; this.heHr[1] = kept ? rotR : null;
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tgtL, Z.poleL, 0.85 * eA, rotL);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tgtR, Z.poleR, sOn ? Math.max(0.85 * eA, 0.9 * smoothstep(0, 0.1, sT) * (1 - smoothstep(ST.up, ST.home, sT))) : 0.85 * eA, rotR);
    this.hand(pB, 0, Z.curlL, Z.thumbL, Z.spreadL);
    if (sOn) { const op = smoothstep(ST.take, ST.take + 0.1, sT); this.hand(pB, 1, [0.75, 0.8, 0.8, 0.8].map((a, i) => lerp(a, Z.curlR[i], op)), lerp(0.6, Z.thumbR, op), Z.spreadR * op); }
    else this.hand(pB, 1, Z.curlR, Z.thumbR, Z.spreadR);
    const wA = CR ? Math.max(w * eA + w * (1 - eA) * 0.35, smoothstep(CT.fling.armIn[0], CT.fling.armIn[1], ug) * (this.heldPose ? 1 : w)) : w * eA + w * (1 - eA) * 0.35;   // (HOLD.catch.fling: his arms are the move's before the layer's weight is in — their paths start at his own hands)
    blendPose(pA, pB, wA, this.armsMask, pA);   // (the first frames of the grab: mostly still his own arms)
    if (sOn && wA < 1) { const wS = Math.max(wA, smoothstep(0, 0.8 * ST.take, sT) * (1 - smoothstep(ST.up, ST.home, sT))); if (wS > wA) blendPose(pA, pB, (wS - wA) / (1 - wA), this.armROnly, pA); }   // (…but his gun arm is where the disarm wants it by `take`)
  }
  /** Out of a hold, with the layer still on its way out: has he been told to do ANYTHING since it let go (holdOutRate: the slow way up is for a man left standing
   *  idle)? The gun raised to aim, a round, a reload, a throw, a blow, a kick, a signal, a hit taken, the kit, a lock, a body, a thing worked, a door, a
   *  stance, the hands-on ready or the creep, a wound, a scripted act — or any change from what the hold itself had him carry on its last frame (a gun drawn
   *  or raised, the long gun taken up, a crouch: a kit that puts a gun straight back in his hands when the hold ends gets no slow way up at all).
   *  Latched until the next hold: a tap that starts the arms on their way does not hand them back. */
  private hdIdle = { upper: 'none' as UpperMode, long: false, crouch: 0, carry: undefined as CarryKind | undefined }; private hdBusy = false;
  private holdBusy(): boolean {
    const I = this.hdIdle;
    if (this.holdPose) { I.upper = this.upper; I.long = this.longGun; I.crouch = this.crouchTarget; I.carry = this.carry; this.hdBusy = false; return false; }
    if (this.hdBusy || this.hdW.x <= 0.003) return this.hdBusy;
    this.hdBusy = this.upper !== I.upper || this.longGun !== I.long || this.crouchTarget !== I.crouch || this.carry !== I.carry
      || this.shootT >= 0 || this.reloadT >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.kickT >= 0 || this.sigT >= 0 || this.bw !== null || this.kit !== null
      || this.lockpick || !!this.haul || !!this.work || !!this.doorPush || this.stance !== 'none' || !!this.ready || this.creep || !!this.wound || !!this.act;
    return this.hdBusy;
  }
  /** The knife fist (holdLayer): the right hand's rotation from where the BLADE is to point (`blade`: out of the fist's thumb side — rigProps.knifeBoxes lays it
   *  along that axis, edge to the palm side) and which way the back of the hand faces (`back`, squared to the blade here); the knuckles then run blade × back. */
  private knifeRot(blade: Vec3, back: Vec3): Quat {
    const T = v3.normalize(blade); const B = v3.normalize(v3.mad(back, T, -v3.dot(back, T)));
    return this.handRot(1, v3.cross(T, B), B);
  }

  /** bigLayer's: the pose under it, and whether update() reads the gun hand's line off that pose this frame (a hammer in the fist) */
  private bigBuf: Pose | null = null; private bigUnder = false;
  /** THE BIG SLOT'S TOOL IN HIS HANDS (bigTool; BIGMOVE's doc has the phases and the numbers). The trunk and the feet first, straight into pA — nothing of either
   *  while he only carries the hammer ready or is still fetching it: his legs are his own — the feet IK-pinned back where the locomotion has them (stepped out
   *  into a wider stance for a blow), the head turned back onto the point. Then both arms by IK on a copy, whole from the upper arm down: each hand's path begins
   *  on the hand of the pose underneath and ends on it, so the layer needs no cross-fade to get in or out. The HAMMER is posed as its own line — the right fist's
   *  grip and the handle's direction, mixed between the keyed lines and, for the blow, solved so that the HEAD is on the point — and the fists are then laid on
   *  that line: the right where the line says, thumb toward the head; the left `BIGRIG.hammer.hands` down the handle from where the right fist really got to (an
   *  arm at full stretch stops short: the tool is drawn off the right fist, so the left stays on it). The SHOTGUN: the stock in the shoulder's pocket, the bore
   *  on the point, the support hand on the handguard point off the trigger wrist as it got to (rigProps carbineGrip). The point is a WORLD point: in through
   *  posIn / bodyYawIn and the inverse of the chest twist still to come (untwist). Sets bigK and bigUnder. */
  private bigLayer(B: NonNullable<CharacterAnimator['bigTool']>, twY: number, twP: number) {
    const M = BIGMOVE, pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, ham = B.kind === 'hammer';
    const t = B.t, stowing = B.end >= 0 && t >= B.end, us = stowing ? clamp((t - B.end) / Math.max(1e-3, B.stow), 0, 1) : 0;
    this.bigUnder = false;
    if (!(t >= 0) || us >= 1) { this.bigK = 0; return; }
    const e3 = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    // ---- the beat as shares: the blow being wound up (wind, then its swing 0‥1), the one that has just landed (hit, falling off over the rebound), a shell's
    //      kick, and how far his feet are planted for it (held between two blows of one beat)
    let prev = -Infinity, next = Infinity; for (const b of B.blows) { if (b <= t) prev = Math.max(prev, b); else if (!(B.end >= 0 && b > B.end)) next = Math.min(next, b); }
    let wind = 0, sw = 0, hit = 0, kick = 0, plant = 0;
    if (ham) { const H = M.hammer;
      if (next < Infinity) { const ws = Math.max(next - B.windup, prev), D = next - ws;   // (a window never reaches back past the blow before it)
        if (t >= ws && D > 1e-3) { const SW = Math.min(clamp(H.swing * D, H.swingMin, H.swingMax), D * 0.6); wind = e3((t - ws) / Math.max(1e-3, (D - SW) * H.raise)); sw = clamp((t - (next - SW)) / SW, 0, 1); } }
      if (prev > -Infinity) hit = 1 - e3((t - prev) / H.rebound);
      plant = Math.max(wind, prev > -Infinity ? (next < Infinity ? 1 : 1 - e3((t - prev) / H.settle)) : 0);
    } else if (prev > -Infinity) { const r = t - prev, S = M.shotgun; kick = r < S.kickIn ? r / S.kickIn : Math.exp(-(r - S.kickIn) / S.kickOut); }
    if (stowing) { const k = 1 - e3(us / (M.put * 0.5)); wind *= k; sw *= k; plant *= k; }
    const ue = Math.max(clamp(t / Math.max(1e-3, B.equip), 0, 1), wind);   // (a blow asked for before the tool is out: it comes out with the wind-up)
    const eb = e3((ue - M.grab) / (1 - M.grab)), inHands = stowing ? Math.min(eb, 1 - e3(us / M.put)) : eb, es = Math.pow(sw, 1.8);   // (the swing ARRIVES fast: no ease into the door)
    { const S = B.snug ? M.snug : M; this.bigK = smoothstep(S.take[0], S.take[1], ue) * (stowing ? 1 - smoothstep(M.put * S.putAt, M.put, us) : 1); }
    if (ham) { (this.bigBuf ??= new Pose(pA.numNodes)).copy(pA); this.bigUnder = true; }
    // ---- where the point is from where he stands (model space; its bearing off the pelvis, level)
    fk.run(pA);
    const at0: Vec3 = Number.isFinite(B.at[0] + B.at[1] + B.at[2]) ? this.toModelP(B.at) : [0, 1, 0.8];
    let tx = at0[0] - fk.pos[nd.hips][0], tz = at0[2] - fk.pos[nd.hips][2]; const reach = hyp2(tx, tz); if (reach > 1e-3) { tx /= reach; tz /= reach; } else { tx = 0; tz = 1; }
    const tdir: Vec3 = [tx, 0, tz], tleft: Vec3 = [tz, 0, -tx], psi = clamp(Math.atan2(tx, tz), -1, 1);
    const turnTo = (() => { const f = this.trunkFrame().fwd; return clamp(wrapAngle(psi - Math.atan2(f[0], f[2])), -1.2, 1.2); })();   // what squares the chest AS THE POSE UNDER IT HAS IT onto the point (the idle stands bladed: wound up from there he was turned twice)
    // ---- the trunk (yaw + = to his left, as the throw's; the lean is toward the point) and the pelvis under it, by how still he stands
    const still = 1 - smoothstep(0.2, 1.0, Math.abs(this.speed));
    let chestYaw = 0, pelYaw = 0, pitch = 0, shF = 0, shS = 0, drop = 0;
    if (ham) { const H = M.hammer, W = H.woundBody, I = H.blowBody, aW = wind * (1 - es), aI = Math.max(hit, es), far = smoothstep(H.far[0], H.far[1], reach);
      chestYaw = plant * turnTo * H.face + (aW * W.yaw + aI * I.yaw) * DEGR; pelYaw = (plant * turnTo * H.face * 0.4 + (aW * W.pelYaw + aI * I.pelYaw) * DEGR) * still;
      pitch = (aW * W.pitch + aI * (I.pitch + far * I.pitchFar)) * DEGR; shF = (aI * (I.fwd + far * I.fwdFar) - aW * W.back) * still; shS = aW * W.side * still; drop = (plant * H.drop + aI * I.drop) * still;
    } else { const S = M.shotgun; chestYaw = inHands * (turnTo + S.yaw * DEGR); pelYaw = inHands * (turnTo * 0.3 + S.pelYaw * DEGR) * still; pitch = (inHands * S.pitch + kick * S.kickPitch) * DEGR; shF = -S.shove * kick * still; }
    if (Math.abs(chestYaw) + Math.abs(pelYaw) + Math.abs(pitch) + Math.abs(shF) + Math.abs(shS) + drop > 1e-5) {
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const axT = v3.cross(AY, tdir), seg = (k: number) => quat.mul(qYaw((chestYaw - pelYaw) * k), quat.axisAngle(axT, pitch * k));   // (the pelvis turn carries the whole spine; the spine joints add the rest)
      this.shift(pA, nd.hips, [tdir[0] * shF + tleft[0] * shS, -drop, tdir[2] * shF + tleft[2] * shS]);
      this.turn(pA, nd.hips, qYaw(pelYaw));
      this.turn(pA, nd.spine1, seg(0.3)); this.turn(pA, nd.spine2, seg(0.35)); this.turn(pA, nd.spine3, seg(0.35));
      const hq = (k: number) => quat.mul(qYaw(-chestYaw * 0.8 * k), quat.axisAngle(axT, -pitch * 0.8 * k));   // the head: back out of most of it (the look below puts the eyes on the point)
      this.turn(pA, nd.neck, hq(0.4)); this.turn(pA, nd.head, hq(0.6));
      if (ham && plant > 0) { const St = M.hammer.stance, k = plant * still, up = St.lift * Math.sin(Math.PI * plant) * still;   // a wider stance for the blow, the left foot toward the point: stepped out to, not slid
        fL[0] += (tleft[0] * St.l[0] + tdir[0] * St.l[1]) * k; fL[2] += (tleft[2] * St.l[0] + tdir[2] * St.l[1]) * k; fL[1] += up;
        fR[0] += (tleft[0] * St.r[0] + tdir[0] * St.r[1]) * k; fR[2] += (tleft[2] * St.r[0] + tdir[2] * St.r[1]) * k; fR[1] += up; }
      fk.run(pA);   // feet back where the locomotion has them, soles as they were
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0.6, rL);
      twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0.6, rR);
    }
    const lookW = ham ? plant : inHands; if (lookW > 0.003) { fk.run(pA); this.lookAt(pA, this.untwist(twY, twP)(at0), 0.8 * lookW); }
    // ---- the arms, by IK on a copy against the body as it now stands
    pB.copy(pA); fk.run(pB);
    const F = this.trunkFrame(), dirT = (q: readonly number[]): Vec3 => [F.left[0] * q[0] + F.up[0] * q[1] + F.fwd[0] * q[2], F.left[1] * q[0] + F.up[1] * q[1] + F.fwd[1] * q[2], F.left[2] * q[0] + F.up[2] * q[1] + F.fwd[2] * q[2]];
    type Spot = { at: Vec3; rot: Quat; f?: Vec3; b?: Vec3 };
    const sR = v3.copy(fk.pos[nd.upperArmR]), sL = v3.copy(fk.pos[nd.upperArmL]), un = this.untwist(twY, twP), Hp = un(at0), arc = dirT(M.arc);
    const uR: Spot = { at: v3.copy(fk.pos[nd.handR]), rot: [...fk.rot[nd.handR]] as Quat }, uL: Spot = { at: v3.copy(fk.pos[nd.handL]), rot: [...fk.rot[nd.handL]] as Quat };
    const mix = (a: Spot, b: Spot, e: number, bow?: Vec3): Spot => e <= 0 ? a : e >= 1 ? b : { at: bow ? v3.mad(v3.lerp(a.at, b.at, e), bow, Math.sin(Math.PI * e)) : v3.lerp(a.at, b.at, e), rot: quat.slerp(a.rot, b.rot, e) };
    let backR: Spot, held: Spot, leftOn: (wr: Vec3) => Spot;
    if (ham) { const H = M.hammer, R = BIGRIG.hammer, G = R.grip;
      type Line = { g: Vec3; d: Vec3 };
      const off = (S: { g: Vec3; d: Vec3 }): Line => ({ g: v3.add(sR, dirT(S.g)), d: v3.normalize(dirT(S.d)) });
      const mixL = (a: Line, b: Line, k: number, bow?: Vec3): Line => k <= 0 ? a : k >= 1 ? b : { g: bow ? v3.mad(v3.lerp(a.g, b.g, k), bow, Math.sin(Math.PI * k)) : v3.lerp(a.g, b.g, k), d: dirMix(a.d, b.d, k) };
      // a fist on the line at g: the handle through it, thumb toward the head; the knuckles lead away from that shoulder (so the wrist follows the forearm), squared to the handle
      const fist = (side: 0 | 1, g: Vec3, d: Vec3, sh: Vec3): Spot => { let h = v3.add(v3.sub(g, sh), dirT([side ? -0.03 : 0.03, 0, 0.02])); h = v3.mad(h, d, -v3.dot(h, d)); if (v3.len(h) < 1e-3) h = v3.cross(d, F.up);
        const f = v3.normalize(h), b = side ? v3.cross(f, d) : v3.cross(d, f); return { at: v3.mad(v3.mad(g, f, -G.fwd), b, G.palm), rot: this.handRot(side, f, b), f, b }; };
      // on his back, as the drawer has it (BIGRIG.hammer.back, through the back's own frame off THIS pose's joints): the fist takes it just under the head
      // (… and, BIGSLOT.snug: the drawer's joints are the ones AFTER the chest twist still to come — his hips and thighs stay, his shoulders turn. Turned far, aiming
      //  across himself as he walks off, the fist stopped 13 cm wide of a tool it was to put back. So: the back's frame as it WILL be, and the place that ENDS UP there)
      const tw = B.snug && (twY || twP) ? this.twisted(twY, twP) : null, uaL = fk.pos[nd.upperArmL], uaR = fk.pos[nd.upperArmR];
      const bkW = bigBackOf(fk.pos[nd.hips], tw ? tw.spine2 : fk.pos[nd.spine2], fk.pos[nd.thighL], fk.pos[nd.thighR], tw ? tw.at(uaL) : uaL, tw ? tw.at(uaR) : uaR, R.back, this.bigClear);   // (… with whatever else lies across his back under it: the drawer's own word)
      const bk = tw ? { o: un(bkW.o), z: this.untwistDir(twY, twP)(bkW.z) } : bkW;
      const backL: Line = { g: v3.mad(bk.o, bk.z, R.headAt - H.grabAt), d: bk.z }, readyL = off(H.ready), woundL = off(H.wound), overL = off(H.over);
      // the blow: the head ON the point, the butt end by the pelvis on the point's own side
      const hp = fk.pos[nd.hips], b0: Vec3 = [hp[0] + tleft[0] * H.butt[0] + tdir[0] * H.butt[2], hp[1] + H.butt[1], hp[2] + tleft[2] * H.butt[0] + tdir[2] * H.butt[2]];
      const di = v3.normalize(v3.sub(Hp, b0)), blowL: Line = { g: v3.mad(Hp, di, -R.headAt), d: di };
      let U = mixL(backL, readyL, eb, arc);
      if (hit > 0) U = mixL(U, blowL, hit);
      if (stowing) U = mixL(U, backL, e3(us / M.put), arc);
      let L = mixL(U, woundL, wind);
      if (sw > 0) L = mixL(mixL(L, overL, es), mixL(overL, blowL, es), es);   // over the top and down into it
      backR = fist(1, backL.g, backL.d, sR); held = fist(1, L.g, L.d, sR);
      // (packside.ts: how much of the fist's place this frame is the tool's place ON HIS BACK, and how far up the handle it holds it — Character.packSidePass carries the DRAWN hand from there to the side of his pack)
      { let wb = (1 - eb) * (1 - hit); if (stowing) wb += (1 - wb) * e3(us / M.put); wb *= (1 - wind) * (sw > 0 ? (1 - es) * (1 - es) : 1);
        this.bigAtBack = ue < M.grab ? e3(ue / M.grab) : stowing && us > M.put ? 1 - e3((us - M.put) / (1 - M.put)) : wb; this.bigGrab = R.headAt - H.grabAt; }
      leftOn = (wr: Vec3) => { const g = v3.mad(v3.mad(wr, held.f!, G.fwd), held.b!, -G.palm); return fist(0, v3.mad(g, L.d, -R.hands), L.d, sL); };
    } else { const S = M.shotgun, C = RIG.carbine, adj = C.adj?.off ?? [0, 0, 0], LG = carbineGrip(), A = KIT.apex;
      backR = { at: v3.add(sR, dirT(A.at)), rot: this.handRot(1, dirT(A.fing), dirT(A.back)) };   // (the rifle's own place over the shoulder: the fist there, the muzzle down his back)
      const pk = v3.add(sR, dirT(S.pocket)); let z = v3.normalize(v3.sub(Hp, pk)), yu = v3.mad(AY, z, -z[1]); yu = v3.len(yu) > 1e-3 ? v3.normalize(yu) : F.fwd;
      if (kick > 0) { const a = kick * S.climb * DEGR, cs = Math.cos(a), sn = Math.sin(a), z1 = v3.add(v3.scale(z, cs), v3.scale(yu, sn)); yu = v3.sub(v3.scale(yu, cs), v3.scale(z, sn)); z = z1; }
      const x = v3.cross(yu, z), inG = (p: readonly number[]): Vec3 => [x[0] * p[0] + yu[0] * p[1] + z[0] * p[2], x[1] * p[0] + yu[1] * p[1] + z[1] * p[2], x[2] * p[0] + yu[2] * p[1] + z[2] * p[2]];
      const wr0 = v3.add(pk, inG([-adj[0], -adj[1], -C.stockTop.l0 - adj[2] - kick * S.kick]));   // the trigger wrist that puts the butt (the stock's rear end, through the group's own offset) in the pocket
      const up0: Spot = { at: wr0, rot: this.handRot(1, z, inG([-0.8, 0.6, 0])) };
      held = mix(backR, up0, inHands, arc);
      leftOn = (wr: Vec3) => ({ at: v3.add(wr, inG(LG.wrist)), rot: this.handRot(0, inG(LG.fingers), inG(LG.back)) });
    }
    const r = ue < M.grab ? mix(uR, backR, e3(ue / M.grab), arc) : stowing && us > M.put ? mix(backR, uR, e3((us - M.put) / (1 - M.put)), arc) : held;
    const own = e3(ue / 0.2) * (stowing ? 1 - e3((us - M.put) / (1 - M.put)) : 1);   // how much of the elbows is the layer's: none at either end (the pose's own under it)
    const high = smoothstep(-0.18, 0.1, r.at[1] - sR[1]);   // a hand up by the shoulder: the elbow out and up, not folded into the ribs
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, r.at, dirT(v3.lerp([-0.5, -0.8, -0.3], [-1, 0.3, -0.1], high)), 0.85 * own, r.rot);
    const j = smoothstep(M.join[0], M.join[1], ue) * (stowing ? 1 - smoothstep(0, M.unjoin, us) : 1);
    let l = mix(uL, { at: v3.add(sL, dirT(M.wait)), rot: this.handRot(0, dirT([-0.25, -0.35, 0.9]), dirT([0.35, 0.9, 0.25])) }, e3(ue / 0.3));   // let go of his gun, waiting in front of him
    if (j > 0) l = mix(l, leftOn(v3.copy(fk.pos[nd.handR])), e3(j));
    if (stowing) l = mix(l, uL, e3((us - M.unjoin * 0.5) / (0.92 - M.unjoin * 0.5)));
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, l.at, dirT([0.5, -0.85, -0.15]), 0.6 * own, l.rot);
    { const gr = smoothstep(M.grab - 0.15, M.grab, ue) * (stowing ? 1 - smoothstep(M.put, M.put + 0.12, us) : 1), c = (i: number, k: number) => lerp(M.open[i], M.fist[i], k);
      this.hand(pB, 1, [c(0, gr), c(1, gr), c(2, gr), c(3, gr)], lerp(0.25, 0.6, gr)); this.hand(pB, 0, [c(0, j), c(1, j), c(2, j), c(3, j)], lerp(0.25, 0.6, j)); }
    const m = this.dynMask; m.fill(0);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    setSub(nd.upperArmR, 1); setSub(nd.upperArmL, 1);
    blendPose(pA, pB, 1, m, pA);
  }

  /** The overhand throw (THR / THROW_*): body English straight into pA — pelvis carried back onto the right foot then through onto the left, turning away and
   *  unwinding ≈ 35 ms ahead of the shoulders (the spine makes up the rest of the chest's turn: −26° at the top of the backswing, +10° past square in the
   *  follow-through), a little arch then a lean over the front leg, the trunk tipping off to the glove side as the arm comes over, the right scapula up and
   *  thrown forward, the head countering most of it so the eyes stay on the target; the feet IK-pinned back where the locomotion has them (standing, the legs
   *  twist under the turning pelvis; walking, the cycle is untouched). Crouched, the torso comes up out of the crouch clip's hunch to throw and the legs' share
   *  is halved; moving, it shrinks too. Then both arms by IK against that body: the right hand along a shoulder-relative path — the elbow swinging out and up
   *  with the hand hanging under it, the forearm cocking up behind the head (the top), the elbow leading forward while the hand lays back, over the top past the
   *  head to the release point out in front (its fastest, ≈ 10 m/s, through THROW_RELEASE), on down across to the left hip and back beside the right thigh —
   *  with the elbow's swivel, the palm and a finger release keyed along it; the left comes up loosely at the target and tucks in to the ribs. Both paths begin
   *  and end on the live hand positions of the pose underneath, so the layer needs no cross-fade to get in or out (the arm weights only soften the elbow
   *  hand-over at each end). */
  private throwLayer(t: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, BY = THROW_BY;
    // which swing (throwItem): the underhand toss, or the overhand at its size — `full` = as authored, every number below untouched
    const low = this.thrLow >= 0, full = !low && this.thrFar >= 1, T = low ? THR_LOW : THR;
    // GUNHAND.throwFree (thrOff): the free hand's throw — the same swing, MIRRORED: the trunk winds the other way, the left arm takes the right arm's path (built
    // below in the right arm's own terms off the left hand's mirrored start, and mirrored back as it is solved) and the right arm is not touched: it is the long
    // hold's, the gun in it. `sx` = −1 then; +1 (every product below exact) otherwise
    const off = this.thrOff, sx = off ? -1 : 1, mir = (p: readonly number[]): Vec3 => [-p[0], p[1], p[2]];
    // a blast that folds or blinds him MID-swing takes the swing: its arms and body English give way by how far the fold's and the blinded hunch's own weights have
    // risen since it began (zero on a man in neither, so `give` is 1 and nothing below moves; a throw begun already blind, or in the tail of either, is swung whole)
    const hit = Math.max(clamp(this.mvs.cf.x, 0, 1), clamp(this.mvs.dz.x, 0, 1)), h0 = this.thrHit0;
    const give = BY.on && hit > h0 ? 1 - clamp((hit - h0) / Math.max(1 - h0, 0.25), 0, 1) : 1;
    const kS = low ? lerp(BY.tossMin, 1, this.thrLow) : full ? 1 : lerp(BY.turnMin, 1, this.thrFar), kT = kS * give, kA = low ? kS : full ? 1 : lerp(BY.armMin, 1, this.thrFar), piv = low ? BY.tossPivot : BY.pivot;
    const cr = clamp(this.crouch, 0, 1), legK = (1 - 0.5 * cr) * (1 - 0.4 * smoothstep(0.3, 1.5, Math.abs(this.speed)));   // the legs' share: halved on bent knees, less again on the move
    // ---- what is underneath: feet to re-plant, and each hand from its shoulder (the paths' live end keys)
    fk.run(pA);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const uR = v3.sub(fk.pos[nd.handR], fk.pos[nd.upperArmR]), uL = v3.sub(fk.pos[nd.handL], fk.pos[nd.upperArmL]);
    const gunP = off ? v3.copy(fk.pos[nd.handR]) : null, gunQ = off ? [...fk.rot[nd.handR]] as Quat : null;   // (thrOff: where the long hold has the trigger hand, before the trunk winds)
    // ---- body English (every curve is zero at both ends: full weight throughout)
    const chestYaw = curve(t, T.chestYaw) * DEGR * kT * sx, pelYaw = curve(t, T.pelvisYaw) * DEGR * legK * kT * sx, spYaw = chestYaw - pelYaw;   // the pelvis turn carries the whole spine; the spine joints add the rest
    const pitch = curve(t, T.pitch) * DEGR * kT, roll = curve(t, T.roll) * DEGR * kT * sx;
    const ext = low ? 0 : 18 * DEGR * cr * bump(t, 0, 0.12, 0.5, THROW_DUR) * (full ? 1 : lerp(BY.sit, 1, this.thrFar)) * give;   // crouched: sit up out of the clip's hunch to get the arm over (as lockpickLayer un-rounds the back), chest first
    this.shift(pA, nd.hips, [curve(t, T.pelX) * legK * kT * sx, curve(t, T.pelY) * legK * kT, curve(t, T.pelZ) * legK * kT]);
    this.turn(pA, nd.hips, qYaw(pelYaw));
    const seg = (k: number, kp: number, ke: number) => quat.mul(qYaw(spYaw * k), quat.mul(qRoll(roll * k), qPitch(pitch * kp - ext * ke)));
    this.turn(pA, nd.spine1, seg(0.3 + 0.12 * cr, 0.4, 0.25)); this.turn(pA, nd.spine2, seg(0.35 + 0.13 * cr, 0.35, 0.3)); this.turn(pA, nd.spine3, seg(0.35 - 0.25 * cr, 0.25, 0.45));   // (the crouch clip lays the chest joint almost flat: there the turn is taken lower down, where the spine is still upright enough to twist about the vertical)
    const hy = -chestYaw * 0.85, hr = -roll * 0.7, hp = -pitch * 0.8 + ext;   // head: stays on the target (keeps 15 % of the turn), levelled out of the lean and the tilt, craned back down out of the sit-up
    this.turn(pA, nd.neck, quat.mul(qYaw(hy * 0.4), quat.mul(qRoll(hr * 0.4), qPitch(hp * 0.45)))); this.turn(pA, nd.head, quat.mul(qYaw(hy * 0.6), quat.mul(qRoll(hr * 0.6), qPitch(hp * 0.55))));
    this.turn(pA, off ? nd.shoulderL : nd.shoulderR, quat.mul(qYaw(curve(t, T.clavFwd) * DEGR * kT * sx), qRoll(-curve(t, T.clavUp) * DEGR * kT * sx)));
    fk.run(pA);   // feet back where the locomotion has them, soles as they were
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0.6, rL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0.6, rR);
    // ---- arms, IK'd on a copy against the body as it now is
    pB.copy(pA); fk.run(pB);
    const shR = v3.copy(fk.pos[nd.upperArmR]), shL = v3.copy(fk.pos[nd.upperArmL]); const cin = this.thrCarry;
    const lowK = 1 - 0.45 * cr;   // crouched: the follow-through stays up off the front knee
    const lift = (K: Keys3) => K.map(([kt, p]) => [kt, [p[0], p[1] < -0.25 ? -0.25 + (p[1] + 0.25) * lowK : p[1], p[2]]] as const);
    // a shorter throw: the hand's path drawn in toward its pivot — but it lets go where it lets go: a toss from its swing through on is as authored, and the
    // overhand's path comes back to its authored size over `through` s either side of the release (it is the wind-up and the tail that are small, with no corner)
    const near = (K: Keys3): Keys3 => full ? K : K.map(([kt, p]) => { const k = low ? (kt > TOSS_LOW ? 1 : kA) : lerp(kA, 1, 1 - smoothstep(0, BY.through, Math.abs(kt - THROW_RELEASE))); return [kt, [piv[0] + (p[0] - piv[0]) * k, piv[1] + (p[1] - piv[1]) * k, piv[2] + (p[2] - piv[2]) * k]] as const; });
    const uT = off ? mir(uL) : uR;   // the throwing hand under the layer, in the right arm's terms
    const r0 = off ? mir(cin?.l ?? uL) : cin?.r ?? uR, l0 = cin?.l ?? uL;
    let kR = lift(near(T.handR));
    if (low) {   // a toss from a hand that is nowhere near his hip (a gun up in front of him): no backswing it would have to be whipped into — the further the
      // authored top is past what `tossIn` m/s reaches by its time, the more the hand just drops, on one arc, to the swing's low point and scoops from there
      const top = kR[0][1], bot = kR[1][1], d = Math.hypot(top[0] - r0[0], top[1] - r0[1], top[2] - r0[2]), s = smoothstep(0.5, 1, BY.tossIn * TOSS_TOP / Math.max(d, 1e-6));
      if (s < 1) kR = [[kR[0][0], [lerp(lerp(r0[0], bot[0], 0.6), top[0], s), lerp(lerp(r0[1], bot[1], 0.6), top[1], s), lerp(lerp(r0[2], bot[2], 0.6) - 0.06, top[2], s)]], ...kR.slice(1)];
    }
    // the balance arm: all of its reach only for the full throw — a shorter overhand draws its path, and the hand's turn with it, in toward the pose underneath
    // (from `offMin`). A toss has no use for it: the arm is left to the pose underneath (no weight at all), unless that has the hand up in front of him (a
    // gun's support grip) — then it is let down to hang by his side; which, is read once, on the throw's first frame (`thrHang`)
    if (low && !off && this.thrHang < 0) this.thrHang = smoothstep(-0.38, -0.28, uL[1]) * smoothstep(0.15, 0.28, uL[2]);
    const kB = full ? 1 : lerp(BY.offMin, 1, this.thrFar), offG = low ? this.thrHang : 0, hangY = TOSS_HANG[1] < -0.25 ? -0.25 + (TOSS_HANG[1] + 0.25) * lowK : TOSS_HANG[1];
    const offAt: Vec3 = [lerp(uL[0], TOSS_HANG[0], offG), lerp(uL[1], hangY, offG), lerp(uL[2], TOSS_HANG[2], offG)];
    const kL: Keys3 = low ? [[0.32, offAt], [0.42, offAt]] : full ? lift(THR.handL) : lift(THR.handL.map(([kt, p]) => [kt, [uL[0] + (p[0] - uL[0]) * kB, uL[1] + (p[1] - uL[1]) * kB, uL[2] + (p[2] - uL[2]) * kB]] as const));
    // the ends of each path hang off the live hand: part way toward the first / from the last authored point, bowed out round the body — so an arm that starts
    // forward (walking), low and wide (crouched) or mid-swing (re-triggered) takes no detour through a waypoint that only suits the standing idle
    const via = (a: readonly number[], b: readonly number[], s: number, bow: Vec3): Vec3 => [lerp(a[0], b[0], s) + bow[0], lerp(a[1], b[1], s) + bow[1], lerp(a[2], b[2], s) + bow[2]];
    const topR = kR[0][1], endR = kR[kR.length - 1][1], reachL = kL[0][1], endL = kL[kL.length - 1][1];
    const offR = low ? curve3(t, [[0, r0], [0.05, via(r0, topR, 0.5, [-0.02, 0, -0.01])], ...kR, [0.62, via(endR, uT, 0.55, [-0.03, 0, 0.04])], [THROW_DUR, uT]])   // (the toss: straight back past the hip and round again, no detour)
      : curve3(t, [[0, r0], [0.06, via(r0, topR, 0.35, [-0.075 * kA, -0.015 * kA, 0.02 * kA])], [0.125, via(r0, topR, 0.75, [-0.11 * kA, 0.03 * kA, -0.09 * kA])], ...kR, [0.62, via(endR, uT, 0.55, [-0.10, 0.02, -0.02])], [THROW_DUR, uT]]);   // (up: hanging below the lifting elbow, then out behind it at shoulder height before it cocks up over it)
    const offL = curve3(t, [[0, l0], [0.09, low ? via(l0, reachL, 0.2, [0, 0, 0]) : via(l0, reachL, 0.5, [0.04, 0, 0.02])], ...kL, [0.63, via(endL, uL, 0.5, low ? [0, 0, 0] : [0.03, 0, 0.02])], [THROW_DUR, uL]]);
    if (off) { const o = mir(offR); twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(shL, o), swivelPole(o, SWIV_REF_L, -curve(t, T.swivR) * DEGR), 1, this.handRot(0, mir(curve3(t, T.fingR)), mir(curve3(t, T.backR)))); }
    else twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.add(shR, offR), swivelPole(offR, SWIV_REF_R, curve(t, T.swivR) * DEGR), 1, this.handRot(1, curve3(t, T.fingR), curve3(t, T.backR)));
    // (thrOff) the gun does not swing with the trunk: the trigger hand stays where the long hold had it, turned as it was — the gun is drawn upright off that hand
    // (rigProps carbineFrame), so a hand rolled over with the shoulders would come off its grip — and the arm bends in the plane it has. LOWERED: a crouched low
    // ready has the hand out level with the shoulder; through the swing it is let down to a hand's length under it
    if (gunP) { const dn = Math.max(0, gunP[1] - (shR[1] - 0.12)) * bump(t, 0, 0.12, THROW_DUR - 0.2, THROW_DUR);
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, [gunP[0], gunP[1] - dn, gunP[2]], null, 0, gunQ); }
    // (a toss's other arm: at weight only while it is let down, or while a throw re-triggered mid-swing hands it back to the pose underneath)
    const wToss = off ? 0 : low ? Math.max(offG, cin ? 1 - smoothstep(0, 0.15, t) : 0) : 1;   // (… and none at all for the hand that has the gun)
    if (wToss > 0) {
      const f0 = THR.fingL[0][1], b0 = THR.backL[0][1], fT = low ? f0 : curve3(t, THR.fingL), bT = low ? b0 : curve3(t, THR.backL), sT = low ? THR.swivL[0][1] : curve(t, THR.swivL);   // (a toss: the elbow hangs; the hand keeps the turn it has on its forearm)
      const part = (a: readonly number[], b: readonly number[]): Vec3 => [lerp(a[0], b[0], kB), lerp(a[1], b[1], kB), lerp(a[2], b[2], kB)];
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(shL, offL), swivelPole(offL, SWIV_REF_L, (full || low ? sT : lerp(THR.swivL[0][1], sT, kB)) * DEGR), 1, low ? null : full ? this.handRot(0, fT as Vec3, bT as Vec3) : this.handRot(0, part(f0, fT), part(b0, bT)));
    }
    // fingers: closed round the can, sprung open at the release, hanging loose after; the left hand firms up as it tucks in
    const open = smoothstep(THROW_RELEASE - 0.025, THROW_RELEASE + 0.03, t), loose = smoothstep(0.34, 0.49, t);
    const cR = (grip: number, flat: number, hang: number) => lerp(lerp(grip, flat, open), hang, loose);
    this.hand(pB, off ? 0 : 1, [cR(0.5, 0.05, 0.25), cR(0.55, 0.08, 0.3), cR(0.62, 0.12, 0.35), cR(0.7, 0.15, 0.42)], cR(0.7, 0.1, 0.3));
    const firm = bump(t, 0.22, 0.32, 0.5, 0.64); const cL = (a: number) => lerp(a, a + 0.25, firm);
    if (!low && !off) this.hand(pB, 0, [cL(0.3), cL(0.35), cL(0.4), cL(0.45)], lerp(0.3, 0.6, firm));
    // ---- in through per-arm masks (clavicle subtrees): full weight but for a short hand-over of the elbow at each end; a carried-in restart is already at weight
    const wR = (cin ? 1 - smoothstep(0.62, THROW_DUR, t) : bump(t, 0, 0.06, 0.62, THROW_DUR)) * give, wL = (cin ? 1 - smoothstep(0.57, 0.72, t) : bump(t, 0, 0.09, 0.57, 0.72)) * wToss * give;
    const m = this.dynMask; m.fill(0);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    if (off) { setSub(nd.shoulderL, wR); setSub(nd.shoulderR, 1); } else { setSub(nd.shoulderR, wR); setSub(nd.shoulderL, wL); } m[nd.shoulderR] = 0; m[nd.shoulderL] = 0;   // (the clavicles themselves are already posed in pA; pB carries the same turn)
    blendPose(pA, pB, 1, m, pA);
    fk.run(pA); this.thrLast = { r: v3.sub(fk.pos[nd.handR], fk.pos[nd.upperArmR]), l: v3.sub(fk.pos[nd.handL], fk.pos[nd.upperArmL]) };
  }
}

/** Skeleton joints the ragdoll steers, parent-first: [node, parent row (−1 = the rigid trunk), from-particle, to-particle]. Each gets the smallest rotation (relative
 *  to its parent's) that turns its bind direction onto the particle direction; joints not listed (spine in-betweens, clavicles, hands, feet, fingers, face) keep their
 *  death-frame local transform and ride along. */
const RAG_LIMBS: [keyof typeof N, number, number, number][] = [
  ['thighL', -1, RAG.hipL, RAG.kneeL], ['shinL', 0, RAG.kneeL, RAG.ankL], ['thighR', -1, RAG.hipR, RAG.kneeR], ['shinR', 2, RAG.kneeR, RAG.ankR],
  ['upperArmL', -1, RAG.shoL, RAG.elbL], ['forearmL', 4, RAG.elbL, RAG.handL], ['upperArmR', -1, RAG.shoR, RAG.elbR], ['forearmR', 6, RAG.elbR, RAG.handR],
  ['neck', -1, RAG.neck, RAG.head],
];
/** Character.bones key each particle is seeded from (position + velocity estimate); head and hands are then offset from theirs (skull centre, mid-palm). */
const RAG_BONE: Record<keyof typeof RAG, string> = { pelvis: 'hips', spine: 'spine2', neck: 'neck', head: 'head', shoL: 'upperArmL', shoR: 'upperArmR', elbL: 'forearmL', elbR: 'forearmR', handL: 'handL', handR: 'handR', hipL: 'thighL', hipR: 'thighR', kneeL: 'shinL', kneeR: 'shinR', ankL: 'footL', ankR: 'footR' };
const RAG_BONES: string[] = []; for (const k of Object.keys(RAG) as (keyof typeof RAG)[]) RAG_BONES[RAG[k]] = RAG_BONE[k];   // in particle order
interface RagDrive { pose: Pose; ov: (NodeOverride | undefined)[]; hips: NodeOverride; hipsRot0: Quat; rot0: Quat[]; dir0: Vec3[]; delta: Quat[]; limbOv: NodeOverride[]; synced: boolean; }
/** a fall that is LED for its first moments (ragdollize, every FallStyle): particles of the body — the neck and the pelvis, so the rigid trunk; for the cut
 *  throat the hands — held on paths of their own for under a second (he stands a beat and sits back; he is let down onto his knees, curled over them; he goes
 *  over stiff as a plank), then let go with the fall's own small shove. World-fixed, the dice untouched, never saved (a save waits for a body still falling). */
interface GuidePin { i: number; t0: number; off: number; at: (t: number) => Vec3; }
interface FallGuide { t: number; end: number; pins: GuidePin[]; release: (rag: Ragdoll) => void; }
/** a sleeping body's breath (Character.breathe): the joints the PICTURE moves and where they stood, model space */
interface Breath { t: number; due: number; chest: number; at: Vec3; rot: Quat; hold: number[]; holdOv: NodeOverride[]; saved: (NodeOverride | undefined)[]; }

export interface CharacterDesc { id: number; tint: Vec3; tint2: Vec3; pos: Vec3; yaw: number; }

/** one shadow-proxy record [a, r, b] of Character.capsules(): the segment a → c, its far end carried `extendB` (m) further along it */
function capRec(a: Vec3, c: Vec3, r: number, extendB = 0): number[] {
  let bx = c[0], by = c[1], bz = c[2];
  if (extendB > 0) { const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2]; const l = hyp3(dx, dy, dz) || 1; bx += dx / l * extendB; by += dy / l * extendB; bz += dz / l * extendB; }   // (= v3.normalize(v3.sub(c, a)) × extendB, over scalars)
  return [a[0], a[1], a[2], r, bx, by, bz];
}
// the shoe: heel to past the toe along the SOLE (the foot bone is the ankle, 10 cm up; the toe bone rides 1.5 cm up with the sole on the floor), radius
// 3.3 cm about a centreline 3.3 cm above the sole so the proxy meets the floor the shoe stands on — no lit sliver under it — and follows the foot's pitch
function capSole(foot: Vec3, toe: Vec3): number[] {
  const up = TOE_FLOOR_Y; const heel: Vec3 = [foot[0] - (toe[0] - foot[0]) * 0.35, Math.min(foot[1], toe[1] - up + 0.033 + (foot[1] - toe[1]) * 0.15), foot[2] - (toe[2] - foot[2]) * 0.35];
  const tip: Vec3 = [toe[0], toe[1] - up + 0.033, toe[2]];
  return capRec(heel, tip, 0.033, 0.06);
}
export class Character {
  id: number; tint: Vec3; tint2: Vec3;
  pos: Vec3; vel: Vec3 = [0, 0, 0];
  bodyYaw: number; aimYaw: number; aimPitch = 0;
  anim: CharacterAnimator; skel: SkeletonInstance;
  world: Mat4 = m4.create();
  radius = 0.3;
  alive = true;
  /** cached bone world positions (updated in update()) */
  bones: Record<string, Vec3> = {};
  /** where his feet stood (x, z) when `bones` / `muzzle` were last read: they are a frame old to whoever reads them before his update (game/gunwall.ts moves them on by his step since) */
  bonesAt: [number, number] = [0, 0];
  gunDir: Vec3 = [0, 0, 1]; muzzle: Vec3 = [0, 0, 0]; chestDir: Vec3 = [0, 0, 1];
  /** metres along gunDir from the wrist to the muzzle: the row's (weapons.ts WeaponDef.muzzleAhead — 0.26 for a pistol; whoever hands him a weapon writes it —
   *  or, for a man dealt the carbine over his sidearm row (game.ts, tune.carbineGuards), rigProps.carbineMuzzleAhead's 0.5 off the drawn prop).
   *  The round, the flash, the laser and armThrough all start at `muzzle`. */
  muzzleAhead = 0.26;
  /** wet from the rain (game/wet.ts drives all three once a frame; game.ts hands them to the renderer per skin instance — gbuffer.wgsl CharInst.wet): the COAT
   *  0 dry ‥ 1 soaked (darker fabric under a glossy film), the BEADS 0‥1 (drops standing on him and running down him — up fast in the rain, run off in
   *  seconds out of it), and the rain rate those drops were fed at (their density and pace). A fresh Character is dry.
   *  `wetLine` = how far UP him the coat reaches, in bind-pose metres above the sole (Infinity = all of him: the rain's; a wading depth = the water lane's — wet.ts
   *  wetLineRow hands it to gbuffer.wgsl CharInst.wetK3 with the wicking band above it); the coat's level applies below it and nothing above. */
  wet = 0; beads = 0; wetRain = 0; wetLine = Infinity;
  /** THE CAST (anim/gltf.ts loadGltfCast): the parts of the cast mesh this man wears, as a bit mask — 0 on the mannequin (everything drawn, as ever). game/cast.ts picks it by his side
   *  the first time he is drawn; the viewer sets it by hand. Looks only. */
  parts = 0;
  private restChestInv: Quat; private restHeadInv: Quat;
  /** the right hand's own axes (hand-bone local): out of the back of the hand, and across the knuckles toward the thumb / index side — read off the rest pose
   *  (T-pose, palms down: back = model up squared to the fingers, thumb side = back × fingers); the fingers themselves run along the bone's local +Y */
  private handRBack: Vec3; private handRThumb: Vec3; private handLBack: Vec3; private handLThumb: Vec3;
  /** IN HAND (inhand.ts): the frame a gun is rigid in, in the right hand bone's own axes — the wrist → middle knuckle line (the bore's) and the thumb side squared to it
   *  (the gun's top): gripFrameR. Read off the rest pose. */
  private handRBore: Vec3 = [0, 1, 0]; private handRTop: Vec3 = [0, 0, 1];
  /** IN HAND, the drawer's word (combat.ts handProps, a frame behind as `anim.gripCan` is): what it has put in his right hand — inHandPass moves that hand for it */
  inHand: InHandWord | null = null;
  /** GUN LOOKS (gunlook.ts GUNLOOK): which of his guns are drawn as models of their own — written each step by whoever deals his guns (game.ts for a
   *  teammate, player.ts for the player, the kit screen for its figure), read by rigProps.ts. null (the switch off, or nobody wrote it): every gun as its group draws it */
  gunLook: GunLook | null = null;
  /** …the word the pass is showing (a new KIND of thing waits for the old one's turn to ease out), how far in it is (0 = the skeleton is as the animator posed
   *  it), and the gun hand's rotation as the animator had it while the pass has turned it (handFrameR(true): what a game rule asks for) */
  private inHandCur: InHandWord | null = null; inHandK = 0; private simHandR: Quat | null = null;
  private inHandOv: (NodeOverride | undefined)[] | null = null;
  /** last frame's bones (and the dt between): the ragdoll is seeded with the body's own momentum — a guard shot mid-stride carries on forward as he folds */
  private prevBones: Record<string, Vec3> = {}; private prevDt = 0;
  /** …and last frame's joints UNDER the look-only arms (the animator's armsPre), on a frame they showed — null otherwise: what the ragdoll takes its momentum from */
  private simBones: Record<string, Vec3> | null = null; private prevSim: Record<string, Vec3> | null = null;
  private gunHand: [Vec3, Vec3] | null = null;   // (wrist, middle knuckle under the swap's look-only arm — see CharacterAnimator.handPre)
  /** once dead: the particle body that owns the pose (see ragdollize / updateRagdoll); `pos` then tracks the pelvis, `bodyYaw` stays what it was */
  ragdoll: Ragdoll | null = null; private rd: RagDrive | null = null;
  /** HOW THE NEXT QUIET FALL GOES (takedown.ts sets it on the frame before he is put down; ragdollize reads it once and clears it): null = the build's one fall */
  fallAs: FallStyle | null = null;
  /** …where whoever put him down stood (the fall leads him AWAY from there; null = along the shove's own line) · no room that way: the fall keeps to where he stands. Read and cleared with fallAs. */
  fallFrom: Vec3 | null = null; fallTight = false; /** m the 'sink' fall lays his pelvis further along his facing (HOLD.layAhead; takedown.ts setFall) */ fallAhead = 0;
  /** a body that sleeps BREATHES while this is set (takedown.ts, every frame, for a man out cold): breaths a second · m the chest rises · s it comes in over.
   *  The picture's joints only — the skeleton is posed again, `bones` (what the game reads), the particles and the capsules stand. */
  breathe: { breathHz: number; breathRise: number; breathIn: number } | null = null;
  private guide: FallGuide | null = null; private br: Breath | null = null;
  /** turn weight (TURN, above): whether this man's yaws are weighed, the handling of what he carries and how drilled he is — game.ts writes it every frame */
  turn = { on: false, h: 1, k: 0 };
  private tn: { body: number; aim: number; wb: number; wa: number; ib: number; ia: number; x: number; z: number } | null = null;

  constructor(public ch: GltfCharacter, d: CharacterDesc) {
    this.id = d.id; this.tint = d.tint; this.tint2 = d.tint2; this.pos = v3.copy(d.pos); this.bodyYaw = d.yaw; this.aimYaw = d.yaw;
    this.anim = new CharacterAnimator(ch); this.anim.desync(d.id ?? 0); this.skel = new SkeletonInstance(ch);
    // rest-pose chest rotation for "facing" extraction
    const rp = restPose(ch, new Pose(ch.nodes.length)); this.skel.update(rp, m4.create(), null);
    this.restChestInv = quat.conj(this.skel.globalRot[this.anim.nodes.spine3]);
    this.restHeadInv = quat.conj(this.skel.globalRot[this.anim.nodes.head]);
    { const hr = this.skel.globalRot[this.anim.nodes.handR], hi = quat.conj(hr); const f = v3.normalize(quat.rotate(hr, [0, 1, 0])); const b = v3.normalize(v3.mad([0, 1, 0], f, -f[1]));
      this.handRBack = quat.rotate(hi, b); this.handRThumb = quat.rotate(hi, v3.cross(b, f));
      const k = v3.sub(this.skel.nodePos(this.anim.nodes.middle1R), this.skel.nodePos(this.anim.nodes.handR));   // (the knuckle hangs off the hand bone by a fixed offset: one line in the hand's frame in every pose)
      if (v3.len(k) > 1e-4) { this.handRBore = v3.normalize(quat.rotate(hi, k)); const t = v3.mad(this.handRThumb, this.handRBore, -v3.dot(this.handRThumb, this.handRBore)); if (v3.len(t) > 1e-3) this.handRTop = v3.normalize(t); } }
    { const hr = this.skel.globalRot[this.anim.nodes.handL], hi = quat.conj(hr); const f = v3.normalize(quat.rotate(hr, [0, 1, 0])); const b = v3.normalize(v3.mad([0, 1, 0], f, -f[1]));
      this.handLBack = quat.rotate(hi, b); this.handLThumb = quat.rotate(hi, v3.cross(f, b)); }
  }

  forward(): Vec3 { return [Math.sin(this.bodyYaw), 0, Math.cos(this.bodyYaw)]; }
  aimDir(): Vec3 { const cp = Math.cos(this.aimPitch); return [Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp]; }
  /** The right hand's frame in the WORLD as posed this frame: `fingers` wrist → knuckles, `back` out of the back of the hand, `thumb` across the knuckles toward
   *  the thumb / index side (back × fingers). What a thing gripped in the fist is laid out in — rigProps.knifeBoxes: the blade out of the thumb side. */
  handFrameR(sim = false): { fingers: Vec3; back: Vec3; thumb: Vec3 } {   // (`sim`: as the ANIMATOR posed it — a game rule's; without, as it is drawn: inhand.ts)
    const r = quat.mul(quat.yaw(this.bodyYaw), sim && this.simHandR ? this.simHandR : this.skel.globalRot[this.anim.nodes.handR]);
    return { fingers: quat.rotate(r, [0, 1, 0]), back: quat.rotate(r, this.handRBack), thumb: quat.rotate(r, this.handRThumb) };
  }
  /** IN HAND (inhand.ts): the frame a gun in the right hand is RIGID in, in the world as the hand is DRAWN this frame — `bore` along the wrist → middle knuckle line,
   *  `top` the thumb side squared to it. The drawer's (rigProps.pistolFrame): a pistol laid out in it is in the fist whatever the arm does. */
  gripFrameR(): { bore: Vec3; top: Vec3 } {
    const r = quat.mul(quat.yaw(this.bodyYaw), this.skel.globalRot[this.anim.nodes.handR]);
    return { bore: quat.rotate(r, this.handRBore), top: quat.rotate(r, this.handRTop) };
  }
  /** How a gun carried on a kit errand lies off the right hand as posed, in the world: the turn from the hand's own frame to the one the errand asked of it
   *  before the wrist was held inside what a wrist bends (anim.kitLie). null = it lies as the hand does. The drawer's (rigProps.kitGunFrame). */
  kitLieWorld(): Quat | null {
    const d = this.anim.kitLie; if (!d) return null;
    const r = quat.mul(quat.yaw(this.bodyYaw), this.skel.globalRot[this.anim.nodes.handR]);
    return quat.mul(quat.mul(r, d), quat.conj(r));
  }
  /** the left hand's, the same way (its thumb side = fingers × back) */
  handFrameL(): { fingers: Vec3; back: Vec3; thumb: Vec3 } {
    const r = quat.mul(quat.yaw(this.bodyYaw), this.skel.globalRot[this.anim.nodes.handL]);
    return { fingers: quat.rotate(r, [0, 1, 0]), back: quat.rotate(r, this.handLBack), thumb: quat.rotate(r, this.handLThumb) };
  }
  /** The CHEST's frame in the world as posed this frame: origin the chest joint (bones.chest), `left` / `up` / `fwd` = his own left, up and front carried by
   *  that joint's rotation off the rest pose — rigid with the upper trunk through every lean, twist and breath. What a thing strapped to his chest is laid out
   *  in (rigProps.sheathBoxes: the knife's sheath); null before his first update. */
  chestFrame(): { o: Vec3; left: Vec3; up: Vec3; fwd: Vec3 } | null {
    const o = this.bones.chest; if (!o) return null;
    const r = quat.mul(quat.yaw(this.bodyYaw), quat.mul(this.skel.globalRot[this.anim.nodes.spine3], this.restChestInv));
    return { o, left: quat.rotate(r, [1, 0, 0]), up: quat.rotate(r, [0, 1, 0]), fwd: quat.rotate(r, [0, 0, 1]) };
  }

  update(dt: number) {
    if (this.ragdoll) { this.updateRagdoll(dt); return; }
    if (this.turn.on && TURN.on > 0.5 && dt > 0 && !this.anim.wound) this.turnWeigh(dt);   // (a man down wounded turns to nothing: wounds.ts dropped his turn as he went)
    else {   // not weighed — or a dt-0 bake: a RE-BAKE in place (game.ts updateProps, a frozen clock: his yaws untouched since they were handed back, or put back to the wish by turnBegin and not rewritten) keeps his turn going; a staging (yaws rewritten, or moved) takes them as written and the next frame starts from them
      const T = this.tn;
      if (T && dt <= 0 && this.turn.on && TURN.on > 0.5 && (this.bodyYaw === T.body || this.bodyYaw === T.ib) && (this.aimYaw === T.aim || this.aimYaw === T.ia) && hyp2(this.pos[0] - T.x, this.pos[2] - T.z) <= TURN.jump) { this.bodyYaw = T.body; this.aimYaw = T.aim; }
      else if (T) this.tn = null;
      if (this.anim.turnLead !== 0 && !this.tn) { const l = dt > 0 ? damp(this.anim.turnLead, 0, TURN.leadRate * 2.5, dt) : 0; this.anim.turnLead = Math.abs(l) < 1e-4 ? 0 : l; }   // (the neck's lead eases out, it does not pop — bar a staging)
    }
    this.anim.aimYawOffset = clamp(wrapAngle(this.aimYaw - this.bodyYaw), -1.9, 1.9);
    this.anim.aimPitch = this.aimPitch;
    this.anim.bodyYawIn = this.bodyYaw; this.anim.posIn = this.pos;   // (the animator poses in model space but plants standing feet in the world: it needs where the body is and which way it faces)
    this.anim.update(dt);
    m4.fromTRS(this.world, this.pos, quat.yaw(this.bodyYaw), [1, 1, 1]);
    { const hp = this.anim.handPre, n = this.anim.nodes;   // the gun hand under the torch ↔ sidearm swap (handwork.ts), while it shows: what the bore and the muzzle are read off (readBones)
      if (hp) { this.skel.update(hp, this.world, this.anim.twists); this.gunHand = [m4.transformPoint(this.world, this.skel.nodePos(n.handR)), m4.transformPoint(this.world, this.skel.nodePos(n.middle1R))]; } else this.gunHand = null; }
    { const pre = this.anim.underPose(); if (dt > 1e-5) this.prevSim = this.simBones;   // the joints under the moves' look-only arms, while they show: the ragdoll's seed (ragdollize), in step with bones / prevBones
      if (pre) { this.skel.update(pre, this.world, this.anim.twists); this.simBones = this.joints({}); } else this.simBones = null; }
    this.skel.update(this.anim.pose, this.world, this.anim.twists);
    this.readBones(dt);
    if (INHAND.on) this.inHandPass(dt); else { this.inHandK = 0; this.simHandR = this.inHandCur = null; if (this.inHandOv) this.inHandOv.length = 0; }
    if (this.anim.bigSide && this.anim.bigAtBack > 0) this.packSidePass();
  }

  /** PACK SIDE (packside.ts): the hand that goes for the hammer on his back goes to it AT THE SIDE OF HIS PACK, where the drawer has it. THE PICTURE ONLY, as
   *  inHandPass is and after it: the animator takes the fist to the tool's place across a bare back (bigLayer — the pose the game reads, so it stays); the drawn
   *  fist is carried the rest of the way, rigidly with the handle's line from that place to the pack's side, by how much of its place this frame is the back's
   *  (`anim.bigAtBack`). `bones`, `gunDir` and `muzzle` were read before it; the pose is not written. */
  private packSidePass() {
    const an = this.anim, n = an.nodes, sk = this.skel, b = this.bones, sd = an.bigSide!, w = an.bigAtBack;
    if (!(b.hips && b.spine2 && b.thighL && b.thighR && b.upperArmL && b.upperArmR)) return;
    const qi = quat.conj(quat.yaw(this.bodyYaw));
    const old = bigBackOf(b.hips, b.spine2, b.thighL, b.thighR, b.upperArmL, b.upperArmR, BIGRIG.hammer.back, an.bigClear);   // where the simulation's fist went: across his back (the world, as the drawer had it before the rule)
    const g0 = quat.rotate(qi, v3.sub(v3.mad(old.o, old.z, an.bigGrab), this.pos)), d0 = quat.rotate(qi, old.z);
    const r3 = sk.globalRot[n.spine3], d1 = quat.rotate(r3, sd.z), g1 = v3.mad(v3.add(sk.nodePos(n.spine3), quat.rotate(r3, sd.o)), d1, an.bigGrab);   // … and where the tool is: the chest joint's own space (combat.ts hammerSide)
    let q = quat.fromTo(v3.normalize(d0), v3.normalize(d1)); if (w < 1) q = quat.slerp([0, 0, 0, 1], q, w);
    const R = sk.nodePos(n.handR), g = sk.globalRot[n.handR], ov = this.inHandOv ??= [];
    this.simHandR ??= [g[0], g[1], g[2], g[3]];   // (handFrameR(true), what a kit swap starts from: the hand as the animator had it, as inHandPass keeps it)
    this.reachOv(ov, true, v3.add(v3.lerp(g0, g1, w), quat.rotate(q, v3.sub(R, g0))), quat.normalize(quat.mul(q, [g[0], g[1], g[2], g[3]])));
    sk.update(an.pose, this.world, an.twists, ov);
  }
  /** an arm re-solved so its wrist is at `T` (the elbow kept on its side), the hand's rotation `rot` — over the skeleton's own output into `ov`, not the pose
   *  (twoBoneIK writes the pose, which the simulation's next frame starts from) */
  private reachOv(ov: (NodeOverride | undefined)[], right: boolean, T: Vec3, rot: Quat) {
    const n = this.anim.nodes, sk = this.skel, iS = right ? n.upperArmR : n.upperArmL, iE = right ? n.forearmR : n.forearmL, iH = right ? n.handR : n.handL;
    const S = sk.nodePos(iS), E = sk.nodePos(iE), H = sk.nodePos(iH), l1 = v3.len(v3.sub(E, S)), l2 = v3.len(v3.sub(H, E)), st = v3.sub(T, S);
    if (l1 < 1e-3 || l2 < 1e-3 || v3.len(st) < 1e-3) return;
    const dist = clamp(v3.len(st), Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.998), dir = v3.normalize(st), a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    let pole = v3.sub(E, S); pole = v3.mad(pole, dir, -v3.dot(pole, dir));
    if (v3.len(pole) < 1e-4) { pole = v3.mad([0, -1, 0], dir, dir[1]); if (v3.len(pole) < 1e-4) pole = v3.mad([0, 0, -1], dir, dir[2]); }   // (a dead straight arm: the elbow goes down, squared to the reach)
    pole = v3.normalize(pole);
    const E2 = v3.mad(v3.mad(S, dir, a), pole, h), T2 = v3.mad(S, dir, dist);
    ov[iS] = { rot: quat.normalize(quat.mul(quat.fromTo(v3.normalize(v3.sub(E, S)), v3.normalize(v3.sub(E2, S))), sk.globalRot[iS])) };
    ov[iE] = { rot: quat.normalize(quat.mul(quat.fromTo(v3.normalize(v3.sub(H, E)), v3.normalize(v3.sub(T2, E2))), sk.globalRot[iE])), pos: E2 };
    ov[iH] = { rot, pos: T2 };
  }

  /** IN HAND (inhand.ts): the hand that holds a thing put where that thing is and turned onto the line the simulation points it along. THE PICTURE ONLY: the
   *  skeleton is posed a second time with those joints overridden, AFTER `bones`, `gunDir` and `muzzle` were read — the palette the GPU is handed and the hand
   *  frames the drawer reads (handFrameR / handFrameL / gripFrameR) move; nothing the simulation reads does. By the drawer's word (`inHand`):
   *    · a PISTOL: the gun hand's knuckle line onto gunDir by the aim clip's own weight, a support hand that is on the gun carried round with it;
   *    · a TORCH: the fist's thumb line onto the beam and the arm re-solved so the fist is round the torch where the simulation has it;
   *    · a LONG GUN: the trigger hand moved onto its grip.
   *  It comes and goes at INHAND.rate while nothing else has the gun arm (anim.gunArmOwn); on a shot the pistol's hand is on the line at once, in full. */
  private inHandPass(dt: number) {
    const an = this.anim, n = an.nodes, sk = this.skel, W = this.inHand;
    let cur = this.inHandCur; if (W && (!cur || this.inHandK <= 0 || cur.kind === W.kind)) cur = this.inHandCur = W;
    const belt = INHAND.belt ? an.swapBelt : 0;   // (the swap's hand at the torch on his belt: drawn out to where the torch now hangs — below)
    this.simHandR = null;
    const g0 = sk.globalRot[n.handR], hr: Quat = [g0[0], g0[1], g0[2], g0[3]], R = sk.nodePos(n.handR), L = sk.nodePos(n.handL);
    const ov = this.inHandOv ??= []; ov.length = 0;
    const reach = (right: boolean, T: Vec3, rot: Quat) => this.reachOv(ov, right, T, rot);
    this.inHandWord(dt, cur, hr, R, L, ov, reach);
    // THE SWAP'S HAND AT HIS BELT: the animator takes it to where the torch hung before the rule moved the torch outside his clothes (the reach is in the pose the
    // game reads, so it stays); the drawn hand goes the rest of the way out to the torch
    if (belt > 0) { const h = ov[n.handR]; reach(true, v3.mad(h?.pos ?? R, [BELT_TORCH.was[0] - BELT_TORCH.at[0], 0, BELT_TORCH.at[1] - BELT_TORCH.was[1]], belt), h?.rot ?? hr); }
    if (ov.length) { this.simHandR = hr; sk.update(an.pose, this.world, an.twists, ov); }
  }

  /** what the hand does for the thing it holds (inHandPass): the overrides for this frame into `ov`, none when the pass has nothing to say */
  private inHandWord(dt: number, cur: InHandWord | null, hr: Quat, R: Vec3, L: Vec3, ov: (NodeOverride | undefined)[], reach: (right: boolean, T: Vec3, rot: Quat) => void) {
    const an = this.anim, n = an.nodes, sk = this.skel, W = this.inHand;
    if (!cur) { this.inHandK = 0; return; }
    const live = W !== null && W.kind === cur.kind, shown = (!an.inThrow || (an.throwOff && cur.kind === 'long')) && !an.hideHeldItem && !an.kitBusy,   // (GUNHAND.throwFree: a throw off the free hand leaves the trigger hand on its grip)
      fire = live && shown && cur.kind === 'pistol' && an.shooting;
    const want = !live || !shown ? 0 : cur.kind === 'long' ? (an.longShown !== null ? 1 : 0) : fire ? 1 : !an.gunArmOwn ? 0 : cur.kind === 'torch' ? 1 : smoothstep(INHAND.from, INHAND.to, an.aimShown);
    const step = dt > 0 ? INHAND.rate * dt : 1, K = this.inHandK = fire ? 1 : this.inHandK + clamp(want - this.inHandK, -step, step);   // (a dt-0 bake takes it as asked)
    if (K <= 0) { if (!live) this.inHandCur = null; return; }
    const qi = quat.conj(quat.yaw(this.bodyYaw));
    // the line the thing lies along, model space, and the frame it is laid out in (rigProps frameFrom: z the line, y the world's up squared to it)
    const z = v3.normalize(quat.rotate(qi, cur.kind === 'torch' ? cur.beam : cur.kind === 'long' || an.upper === 'aim' || an.shooting ? this.gunDir : this.aimDir()));
    let y: Vec3 = [-z[0] * z[1], 1 - z[1] * z[1], -z[2] * z[1]]; if (v3.len(y) < 1e-3) return; y = v3.normalize(y); const x = v3.cross(y, z);   // (a line straight up or down has no top: the hand is left alone)
    const inF = (d: Vec3): Vec3 => [x[0] * d[0] + y[0] * d[1] + z[0] * d[2], x[1] * d[0] + y[1] * d[1] + z[1] * d[2], x[2] * d[0] + y[2] * d[1] + z[2] * d[2]];
    if (cur.kind === 'long') reach(true, v3.mad(R, inF(cur.by), K), hr);
    else {
      let d: Quat, up = 1;
      if (cur.kind === 'pistol') { const kc = quat.rotate(hr, this.handRBore), tc = quat.rotate(hr, this.handRTop); d = quat.mul(quat.fromBasis(x, y, z), quat.conj(quat.fromBasis(v3.cross(tc, kc), tc, kc))); }
      else if (an.torchUp > 0) {   // (GUNHAND.whistle: the raised torch is held overhand — the thumb to its tail cap; the fist's turn stands down as the arm passes between the two carries)
        d = quat.fromTo(v3.normalize(quat.rotate(hr, this.handRThumb)), v3.scale(v3.normalize(inF(cur.axis)), an.torchUp > 0.5 ? -1 : 1)); up = Math.abs(2 * an.torchUp - 1);
      } else d = quat.fromTo(v3.normalize(quat.rotate(hr, this.handRThumb)), v3.normalize(inF(cur.axis)));   // (the way a thing gripped in the fist points — the short way, the roll about it left as the clip has it)
      if (d[3] < 0) d = [-d[0], -d[1], -d[2], -d[3]];
      const ang = 2 * Math.acos(Math.min(1, d[3]));
      d = ang < 1e-4 ? [0, 0, 0, 1] : quat.slerp([0, 0, 0, 1], d, fire ? 1 : K * Math.min(1, INHAND.wrist * Math.PI / 180 / ang) * up);
      const rot = quat.normalize(quat.mul(d, hr));
      if (cur.kind === 'pistol') {
        ov[n.handR] = { rot };
        // the support hand, when it is on the gun: carried rigidly round the gun hand's wrist with the same turn, its arm re-solved to reach
        const near = 1 - smoothstep(INHAND.both * 0.5, INHAND.both, v3.len(v3.sub(L, R)));
        if (near > 0) { const dl = near < 1 ? quat.slerp([0, 0, 0, 1], d, near) : d; reach(false, v3.add(R, quat.rotate(dl, v3.sub(L, R))), quat.normalize(quat.mul(dl, sk.globalRot[n.handL]))); }
      } else {   // the torch: the hollow of the turned fist onto the point of its body the simulation's wrist and beam put there
        const hol = quat.rotate(rot, v3.mad([0, cur.fwd, 0], this.handRBack, -cur.palm));
        reach(true, v3.mad(R, v3.sub(v3.sub(v3.add(R, inF(cur.at)), hol), R), K), rot);
      }
    }
  }

  /** TURN: bodyYaw / aimYaw as the AI left them this frame are where he WANTS to face (its own easings run on, wish to wish — turnBegin); he comes round to
   *  them as a mass, and the two fields are rewritten with where he has got to: that is what everything else reads until his AI writes again. */
  private turnWeigh(dt: number) {
    const T = this.tn, W = this.turn;
    if (!T || hyp2(this.pos[0] - T.x, this.pos[2] - T.z) > TURN.jump || !Number.isFinite(this.bodyYaw + this.aimYaw)) {
      this.tn = { body: this.bodyYaw, aim: this.aimYaw, wb: 0, wa: 0, ib: this.bodyYaw, ia: this.aimYaw, x: this.pos[0], z: this.pos[2] }; return; }
    if (this.bodyYaw !== T.body) T.ib = this.bodyYaw; if (this.aimYaw !== T.aim) T.ia = this.aimYaw;   // (untouched since they were handed back: the wish stands)
    const h = clamp(W.h, 0.2, 1.5), kk = lerp(TURN.green, 1, clamp(W.k, 0, 1)), hb = lerp(1, h, TURN.bodyShare);
    // his feet: the short way round
    const sb = turnStep(T.wb, wrapAngle(T.ib - T.body), TURN.body * hb, TURN.bodyAcc * hb * kk, dt); T.body = wrapAngle(T.body + sb[0]); T.wb = sb[1];
    // the gun, about his waist: from where it pointed (the body under it has just turned) to where it is wanted, through his FRONT — both ends inside the twist
    // the spine has (the animator's own ±1.9), so a point that passes behind his back swings the gun across his chest instead of through his spine
    // (the wanted end is measured the way the BODY is going round — the wish's own twist plus what the body still has to turn — so a wish snapped past his back
    // does not flip the gun to the far shoulder and back while he comes round)
    const r0 = clamp(wrapAngle(T.aim - T.body), -1.9, 1.9), r1 = clamp(wrapAngle(T.ia - T.ib) + wrapAngle(T.ib - T.body), -1.9, 1.9);
    const sa = turnStep(T.wa, r1 - r0, TURN.aim * h, TURN.aimAcc * h * kk, dt), rr = clamp(r0 + sa[0], -1.9, 1.9); T.wa = rr === r0 + sa[0] ? sa[1] : 0; T.aim = wrapAngle(T.body + rr);   // (speed it still carried the other way stops at the twist's end)
    T.x = this.pos[0]; T.z = this.pos[2];
    this.bodyYaw = T.body; this.aimYaw = T.aim;
    { const ld = clamp(wrapAngle(T.ia - T.aim), -TURN.lead, TURN.lead), was = this.anim.turnLead; this.anim.turnLead = damp(was, ld, Math.abs(ld) < Math.abs(was) ? TURN.leadRate * 2.5 : TURN.leadRate, dt); }   // (it comes off quicker than it goes on: the head does not carry past the point either)
  }
  /** TURN, for a checkpoint (savestate.ts GuardSnap.turn, under SAVETIMELINE.turn): the turn he is in the middle of, or null with no weight on him — where his
   *  weight has let him get to (body, aim), the speeds it carries, where his AI wants him, where he stood when it was weighed, and the neck's lead. Put back on
   *  a fresh man by turnPut, his turn goes on from the frame it was filed on; without it he starts from rest facing where he had got to, and his AI eases from
   *  there, not from its wish. */
  turnSnap(): number[] | null { const T = this.tn; return T && !this.ragdoll ? [T.body, T.aim, T.wb, T.wa, T.ib, T.ia, T.x, T.z, this.anim.turnLead] : null; }
  /** … and put back from a file, which is read as untrusted as the rest of one: nine finite numbers or nothing, the speeds held to what a turn can carry
   *  (turnWeigh's top rates at the best handling there is — a real file's are inside them, so they come back to the bit) and the lead to the neck's own reach. */
  turnPut(s: readonly number[] | null | undefined) {
    if (TURN.on <= 0.5 || !Array.isArray(s) || s.length !== 9 || !s.every((v) => typeof v === 'number' && Number.isFinite(v)) || this.ragdoll) return;   // (the weight off at the load: nobody will carry the turn on — he is the file's yaws, as with no key)
    const wb = TURN.body * 1.5, wa = TURN.aim * 1.5;
    this.tn = { body: s[0], aim: s[1], wb: clamp(s[2], -wb, wb), wa: clamp(s[3], -wa, wa), ib: s[4], ia: s[5], x: s[6], z: s[7] }; this.anim.turnLead = clamp(s[8], -TURN.lead, TURN.lead);
    this.turn.on = true;   // (he was being weighed when it was filed, and a fresh man's `turn` is off until game.ts dealWeapons writes it on his next frame: the loader's bake below comes first, and would drop the turn of a man it reads as not weighed)
  }
  /** the loader's bake of a living man (savestate.ts loadState). With a turn put back he is posed where his weight had got him — what was drawn on the frame the
   *  file was made — and his yaws are then handed back AS FILED: a wish somebody wrote after his own update that frame (two men turning to talk: dialogue.ts
   *  updateAmbient) is still the wish his next frame eases from, as it was in the run that went on. With no turn it is update(0). */
  bakeLoaded() {
    const T = this.tn; if (!T) { this.update(0); return; }
    const b = this.bodyYaw, a = this.aimYaw; this.bodyYaw = T.body; this.aimYaw = T.aim; this.update(0); this.bodyYaw = b; this.aimYaw = a;
    if (!this.tn) this.update(0);   // (the bake read the turn as a staging — he stands further from where it was weighed than a turn is carried: no turn, and he is posed at the yaws he is left with)
  }
  /** TURN let go of (wounds.ts: a man going down wounded stays a posed figure): his yaws become the ones that were drawn, and no turn is carried on */
  turnDrop() { if (this.tn) { this.bodyYaw = this.tn.body; this.aimYaw = this.tn.aim; this.tn = null; } }
  /** TURN: his AI is about to ease his yaws (guards.ts updateGuard's first line) — they read back as it LEFT them, so its easings run from where it wanted
   *  him and not from where his weight has let him get to (an easing fed its own slowed result only ever sees one step ahead: he would crawl). A yaw somebody
   *  has written since (a staging, a mark) is not touched: it is the new wish. Nothing with the weight off — and a man whose weight has just been taken off
   *  (grabbed, a showcase starting) keeps facing where he had got to. */
  turnBegin() { const T = this.tn; if (!T || this.ragdoll || !this.turn.on || TURN.on <= 0.5) return; if (this.bodyYaw === T.body) this.bodyYaw = T.ib; if (this.aimYaw === T.aim) this.aimYaw = T.ia; }
  /** where his GUN is in yaw — for a fire gate that runs inside his own AI update (guards.ts, aim.ts), where aimYaw reads as the wish: he may not fire down a line his
   *  gun has not reached. aimYaw itself with the weight off, and wherever aimYaw is already the turned yaw (everything outside his update). */
  get gunYaw(): number { const T = this.tn; return T && !this.ragdoll ? T.aim : this.aimYaw; }
  /** where his AI wants his body, for an easing that runs outside his own update (roomfight.ts applyWatch); his body yaw itself with the weight off */
  get wantBody(): number { const T = this.tn; return T && this.bodyYaw === T.body ? T.ib : this.bodyYaw; }

  /** the world-space joint positions off the skeleton's current globals, into `b` */
  /** A joint as the GAME reads it: where it is under the moves' look-only arms while one shows (a can leaves the hand the fight has, not one mid magazine change), the
   *  drawn joint otherwise. For a site that takes a position off an arm and feeds it to the simulation. */
  jointUnder(name: string): Vec3 | undefined { return this.simBones?.[name] ?? this.bones[name]; }
  private joints(b: Record<string, Vec3>): Record<string, Vec3> {
    const n = this.anim.nodes; const wp = (node: number): Vec3 => m4.transformPoint(this.world, this.skel.nodePos(node));
    b.hips = wp(n.hips); b.spine2 = wp(n.spine2); b.chest = wp(n.spine3); b.neck = wp(n.neck); b.head = wp(n.head);
    b.upperArmL = wp(n.upperArmL); b.forearmL = wp(n.forearmL); b.handL = wp(n.handL); b.upperArmR = wp(n.upperArmR); b.forearmR = wp(n.forearmR); b.handR = wp(n.handR);
    b.thighL = wp(n.thighL); b.shinL = wp(n.shinL); b.footL = wp(n.footL); b.toeL = wp(n.toeL); b.thighR = wp(n.thighR); b.shinR = wp(n.shinR); b.footR = wp(n.footR); b.toeR = wp(n.toeR);
    b.fingerR = wp(n.middle1R); b.fingerL = wp(n.middle1L);
    b.headTop = v3.add(b.head, [0, 0.2, 0]);
    return b;
  }
  /** World-space joint positions and the derived directions (chest facing, gun axis, muzzle) from the skeleton's current globals. */
  private readBones(dt: number) {
    const n = this.anim.nodes;
    const b = this.bones;
    if (dt > 1e-5 && b.hips) { const pb = this.prevBones; for (const k in b) pb[k] = b[k]; this.prevDt = dt; }   // (a dt-0 re-bake keeps the older sample: it is still one real frame back)
    this.joints(b); this.bonesAt[0] = this.pos[0]; this.bonesAt[1] = this.pos[2];
    // chest facing (rest → current delta applied to model +Z), in world
    const qYaw = quat.yaw(this.bodyYaw);
    const chestDelta = quat.mul(this.skel.globalRot[n.spine3], this.restChestInv);
    this.chestDir = v3.normalize(quat.rotate(quat.mul(qYaw, chestDelta), [0, 0, 1]));
    // gun direction: wrist → middle finger base, muzzle ahead of the hand
    const gh = this.ragdoll ? null : this.gunHand, hR = gh ? gh[0] : b.handR;
    this.gunDir = v3.normalize(v3.sub(gh ? gh[1] : b.fingerR, hR));
    if (!this.ragdoll && (this.anim.upper === 'aim' || this.anim.shooting) && !this.anim.inThrow && this.anim.longShown === null) {
      // when aiming the PISTOL, trust the analytic aim direction more (animation is approximate) — except mid-throw, when the hand (and whatever it holds) is off round
      // the head; a LONG gun's bore is the hands' own line (the sprung carriage puts wrist, knuckles and the support hand on it): snapping the drawn rifle to
      // aimDir instead parted it from the hands at every carriage change for ~0.3 s (review 08-10 #6: 35° at a sprint stop, the fore-end beam jumping)
      const free = this.anim.kitGunFree, ad = this.aimDir();   // (KIT: a magazine change worked by hand — the gun is tipped up in the fist, and stays with the fist whether or not he is aiming)
      this.gunDir = free > 0 ? v3.normalize(v3.lerp(ad, this.gunDir, free)) : ad;          // the prop, the rail light and the shot all share this exact direction
    }
    this.muzzle = v3.mad(hR, this.gunDir, this.muzzleAhead);
  }

  /** Die: stop animating and hand the skeleton to a ragdoll seeded from the current pose (twists baked in) and the bones' velocities, then shove it — a round
   *  along `dir` carries the body that way and pitches it head-first the same way (shot from the front: over backwards, away from the shooter; in the back:
   *  onto its face), knees kicked out so it drops rather than topples like a plank; `quiet` (takedown) is the same fold, gentler, along `dir` = his own
   *  facing. `world` = what it collides with (null: just the floor). */
  ragdollize(world: RagdollWorld | null, dir: Vec3, quiet: boolean) {
    if (this.tn) { this.bodyYaw = this.tn.body; this.aimYaw = this.tn.aim; this.tn = null; }   // (TURN: dropped inside his own update, his yaws are his AI's wish — the body that falls is the one that was drawn)
    if (this.ragdoll) { this.fallAs = null; this.fallFrom = null; this.fallTight = false; this.fallAhead = 0; return; }
    if (!this.bones.hips) this.update(0);
    // the moves' look-only arms (a reload's hand, the hand to the ribs, a hostage's tied wrists) are not what falls: the body is seeded from the pose under them and
    // from that pose's own momentum, so who lies where is the same with those layers on or off (they are let go of on the frame he dies)
    { const under = this.anim.underPose(); if (under) { this.anim.pose.copy(under); this.skel.update(this.anim.pose, this.world, this.anim.twists); this.readBones(0); } }   // (…and the gun arm under a torch ↔ sidearm swap: handwork.ts)
    if (this.inHandK > 0 || this.inHandOv?.length) { this.skel.update(this.anim.pose, this.world, this.anim.twists); this.inHandK = 0; this.simHandR = this.inHandCur = null; if (this.inHandOv) this.inHandOv.length = 0; }   // (inhand.ts: the look-only hands are let go of — the limbs the mesh drive starts from are the ones the particles were read off)
    this.anim.nvCancel();   // (a goggle flip he was in the middle of: the goggles are where the game says, not half way for as long as he lies there)
    this.alive = false; this.vel = [0, 0, 0];
    const n = this.anim.nodes, b = this.bones, pb = this.prevSim ?? this.prevBones, pdt = this.prevDt; const Y = quat.yaw(this.bodyYaw);
    const headUp = quat.rotate(quat.mul(Y, this.skel.globalRot[n.head]), [0, 1, 0]);
    const pts: Vec3[] = RAG_BONES.map(k => v3.copy(b[k]));
    pts[RAG.head] = v3.mad(b.head, headUp, 0.12); pts[RAG.handL] = v3.lerp(b.handL, b.fingerL, 0.5); pts[RAG.handR] = v3.lerp(b.handR, b.fingerR, 0.5);
    const vel: Vec3[] | null = pdt > 1e-5 && pb.hips ? RAG_BONES.map(k => { const v = v3.scale(v3.sub(b[k], pb[k]), 1 / pdt); const l = v3.len(v); return l > 3 ? v3.scale(v, 3 / l) : v; }) : null;   // (capped: an animation pop is not momentum)
    const rag = new Ragdoll(pts, vel, world);
    // the shove, as one rigid motion of the whole body: carried along `dir` and pitched top-first the same way (ω = up × dir turns the head end toward dir),
    // a little random yaw / strength so no two land alike; then the knees are kicked out forward so it drops instead of toppling like a plank
    const f = this.forward(); const j = 0.85 + simRandom() * 0.3, twist = (simRandom() - 0.5) * (quiet ? 0.8 : 1.6);
    const h = v3.normalize([dir[0], 0, dir[2]]); const pitchAxis: Vec3 = [h[2], 0, -h[0]];   // up × h: (up × h) × up = h
    const fall = !quiet && mvOn('fall') ? simRandom() : 0.6;   // MOVES: not every man goes over backwards — about half CRUMPLE where they stand (the legs go, he folds straight down, carried a little), a fifth are SPUN by it; the rest fall as they did (the one extra draw is only taken with the switch on)
    if (!quiet && fall < 0.5) { rag.addRigidVelocity(v3.mad(v3.scale(h, 0.8 * j), [0, -1, 0], 0.9), [pitchAxis[0] * 0.9 * j, twist * 0.6, pitchAxis[2] * 0.9 * j]); rag.addVelocity(RAG.kneeL, f, 2.6); rag.addVelocity(RAG.kneeR, f, 2.2); rag.addVelocity(RAG.pelvis, [0, -1, 0], 1.2); }
    else if (!quiet && fall >= 0.8) { const sp = (twist >= 0 ? 1 : -1) * (2.6 + 1.2 * j); rag.addRigidVelocity(v3.scale(h, 1.5 * j), [pitchAxis[0] * 1.5 * j, sp, pitchAxis[2] * 1.5 * j]); rag.addVelocity(RAG.kneeL, f, 1.2); rag.addVelocity(RAG.kneeR, f, 1.2); }
    else if (!quiet) { rag.addRigidVelocity(v3.scale(h, 1.9 * j), [pitchAxis[0] * 2.2 * j, twist, pitchAxis[2] * 2.2 * j]); rag.addVelocity(RAG.kneeL, f, 1.2); rag.addVelocity(RAG.kneeR, f, 1.2); }
    else if (this.fallAs) this.guide = this.fallGuide(rag, this.fallAs, f, h, j, twist >= 0 ? 1 : -1);   // a takedown's own fall, led for its first moments (FallGuide; updateRagdoll)
    else { rag.addRigidVelocity(v3.scale(h, 0.5 * j), [pitchAxis[0] * 3.2 * j, twist, pitchAxis[2] * 3.2 * j]); rag.addVelocity(RAG.kneeL, h, 1.0); rag.addVelocity(RAG.kneeR, h, 1.0); }
    this.fallAs = null; this.fallFrom = null; this.fallTight = false; this.fallAhead = 0;
    // what the mesh drive needs from the moment of death: the frozen local pose, world rotations of the driven joints, particle directions along them
    const pose = this.skel.bakeLocalRotations(new Pose(this.ch.nodes.length).copy(this.anim.pose));
    const rot0 = RAG_LIMBS.map(([k]) => quat.mul(Y, this.skel.globalRot[n[k]]));
    const dir0 = RAG_LIMBS.map(([, , a, c]) => v3.normalize(v3.sub(pts[c], pts[a])));
    const ov: (NodeOverride | undefined)[] = new Array(this.ch.nodes.length);
    const hips: NodeOverride = { rot: [0, 0, 0, 1], pos: [0, 0, 0] }; ov[n.hips] = hips;
    const limbOv = RAG_LIMBS.map(([k]) => { const o: NodeOverride = { rot: [0, 0, 0, 1] }; ov[n[k]] = o; return o; });
    this.ragdoll = rag; this.rd = { pose, ov, hips, hipsRot0: quat.mul(Y, this.skel.globalRot[n.hips]), rot0, dir0, delta: RAG_LIMBS.map(() => quat.ident()), limbOv, synced: false };
  }

  /** Dead: step the particles, then pose the skeleton off them — hips = the trunk cluster's rotation applied to the death-frame hips (origin at the pelvis
   *  particle), each limb joint = its parent's rotation · the shortest arc taking the parent-relative bind direction onto the particle direction · its
   *  death-frame rotation; everything else follows by FK from the frozen pose. World placement: pelvis ground point + the old yaw, so overrides go in in
   *  model space. A sleeping body costs nothing (bones / skin / capsules stand). */
  private updateRagdoll(dt: number) {
    const rag = this.ragdoll!, rd = this.rd!;
    if (this.guide) this.guideStep(rag, dt);
    rag.step(dt);
    if (rag.sleeping && rd.synced) { if (this.breathe) this.breathFrame(dt, this.breathe); else if (this.br) this.breathEnd(true); return; }
    if (this.br) this.breathEnd(false);
    rd.synced = rag.sleeping;
    const x = rag.x; this.pos = [x[0], 0, x[2]];
    const Y = quat.yaw(this.bodyYaw), Yi = quat.conj(Y);
    m4.fromTRS(this.world, this.pos, Y, [1, 1, 1]);
    const D = rag.rot;
    rd.hips.rot = quat.mul(Yi, quat.mul(D, rd.hipsRot0)); rd.hips.pos = [0, x[1], 0];   // (pelvis − pos is straight up: yaw leaves it alone)
    for (let r = 0; r < RAG_LIMBS.length; r++) {
      const [, parent, a, c] = RAG_LIMBS[r]; const Dp = parent < 0 ? D : rd.delta[parent];
      const d1 = v3.normalize([x[c * 3] - x[a * 3], x[c * 3 + 1] - x[a * 3 + 1], x[c * 3 + 2] - x[a * 3 + 2]]);
      const m = quat.fromTo(rd.dir0[r], quat.rotate(quat.conj(Dp), d1));   // swing only, measured in the parent's frame: no twist accumulates, and turning the whole body turns the limbs with it
      const delta = quat.normalize(quat.mul(Dp, m)); rd.delta[r] = delta;
      rd.limbOv[r].rot = quat.mul(Yi, quat.mul(delta, rd.rot0[r]));
    }
    this.skel.update(rd.pose, this.world, null, rd.ov);
    this.readBones(dt);
  }

  /** A TAKEDOWN'S FALL, as a path for the trunk (FallStyle; takedown.ts picks it by the blow). `f` = his own facing, `h` = the shove's line, `j` = the fall's
   *  one die (its pace), `side` = the other (which way it tips). The trunk is one rigid piece of the ragdoll (its shape is matched over ALL its particles, pinned
   *  or not), so every one of them is led: a frame — where the pelvis is, how the trunk's line has turned from how he stood — and each particle its own place
   *  in it; the head rides the neck with a nod of its own. The legs and arms are the ragdoll's.
   *    fold   hit from behind: the knees go at once and he folds forward over them — knees, then chest onto thighs, curled
   *    sink   let down where he stood (the knife from behind, the choke's end): slower, onto his knees, curled over them, then onto his side
   *    cut    the throat: stands a beat with his hands going to it, then the knees go, he sits back AWAY from the knife and rolls onto his back
   *    topple the palm under the chin: over backward stiff as a plank about his own heels, away from the hand
   *    slump  a seated man: the head and chest go forward and down where he sits */
  private fallGuide(rag: Ragdoll, kind: FallStyle, f: Vec3, h: Vec3, j: number, side: number): FallGuide {
    const P = (i: number): Vec3 => [rag.x[i * 3], rag.x[i * 3 + 1], rag.x[i * 3 + 2]];
    const pv = P(RAG.pelvis), nk = P(RAG.neck), v0 = v3.sub(nk, pv), v0n = v3.normalize(v0), from = this.fallFrom, room = this.fallTight ? 0.2 : 1, ahead = kind === 'sink' ? this.fallAhead : 0;
    const away: Vec3 = from && Math.hypot(pv[0] - from[0], pv[2] - from[2]) > 0.05 ? v3.normalize([pv[0] - from[0], 0, pv[2] - from[2]]) : h;
    const sd: Vec3 = [f[2] * side, 0, -f[0] * side], nodAx: Vec3 = [f[2], 0, -f[0]];   // (up × f: a turn about it takes the top of a thing toward his front)
    const line = (d: Vec3, deg: number): Vec3 => [d[0] * Math.sin(deg * DEGR), Math.cos(deg * DEGR), d[2] * Math.sin(deg * DEGR)];   // the trunk's line, leant `deg` from upright toward d
    type Frame = (t: number) => [Vec3, Quat];
    /** the trunk led from where it is to pelvis `pT` with its line along `vT`: the pelvis over [p0, p1], the turn over [n0, n1] */
    const led = (pT: Vec3, vT: Vec3, p0: number, p1: number, n0: number, n1: number): Frame =>
      t => [v3.lerp(pv, pT, smoothstep(p0, p1, t)), quat.fromTo(v0n, v3.normalize(v3.lerp(v0n, vT, smoothstep(n0, n1, t))))];
    let frame: Frame, end = 0, nod: (t: number) => number = () => 0, release: (r: Ragdoll) => void = () => {};
    const extra: GuidePin[] = [];
    if (kind === 'fold' || kind === 'sink') {
      // onto his knees with the trunk coming forward over them (as far as a hip folds), then down on his front, turned a little onto one shoulder —
      // how this body's trunk rests (its pelvis and spine are thicker than its shoulders), so nothing is left to fall when he is let go: steeper on his
      // side it balances on a shoulder and a hip and takes seconds to tip
      const slow = kind === 'sink', hold = slow ? 0.05 : 0, dur = (slow ? 0.56 : 0.5) * j, lay = slow ? 0.45 : 0.4, tA = hold + dur; end = tA + lay + 0.05;
      const kA = ahead * 0.4, lA = ahead - kA;   // (HOLD.layAhead: two fifths of it as he goes to his knees, the rest as he is laid flat)
      const kneel = led([pv[0] + f[0] * (0.05 * room + kA), 0.36, pv[2] + f[2] * (0.05 * room + kA)], line(f, 62), hold, hold + dur * (slow ? 0.85 : 0.8), hold + dur * (slow ? 0.2 : 0.1), tA);
      const roll = 22 * DEGR * side, flat = line(f, 88), k62 = line(f, 62);
      frame = t => {
        if (t <= tA) return kneel(t);
        const u = smoothstep(tA, tA + lay, t), [p] = kneel(tA), d = v3.normalize(v3.lerp(k62, flat, u));
        return [[p[0] + sd[0] * 0.1 * u * room + f[0] * lA * u, lerp(p[1], 0.135, u), p[2] + sd[2] * 0.1 * u * room + f[2] * lA * u], quat.mul(quat.axisAngle(d, roll * u), quat.fromTo(v0n, d))];   // (HOLD.layAhead: laid down ahead of where he knelt)
      };
      nod = t => (slow ? 22 : 34) * DEGR * smoothstep(0, slow ? 0.3 : 0.07, t) * (1 - 0.7 * smoothstep(tA, tA + lay, t));   // the chin on his chest (struck on the skull's base: at once), and up off it as his face comes to the floor
      if (room === 1) {   // his limbs laid with him, each joint from where it is when the laying down begins: the legs trailing together and straight (lying on its front
        // this body's knee rule lets a knee bend no way but into the floor: a knee drawn out to the side creeps straight again for seconds), the hands up by his head
        const [pE, qE] = frame(tA + lay), at = (i: number): Vec3 => v3.add(pE, quat.rotate(qE, v3.sub(P(i), pv)));
        const lead = (pi: number, e: Vec3) => { let a: Vec3 | null = null; extra.push({ i: pi, t0: tA, off: tA + lay + 0.05, at: t => v3.lerp(a ??= P(pi), e, smoothstep(tA, tA + lay, t)) }); };
        for (const [hipI, kneeI, ankI, shoI, handI] of [[RAG.hipL, RAG.kneeL, RAG.ankL, RAG.shoL, RAG.handL], [RAG.hipR, RAG.kneeR, RAG.ankR, RAG.shoR, RAG.handR]]) {
          const hip = at(hipI), sho = at(shoI), th = v3.dist(P(hipI), P(kneeI)), sh = v3.dist(P(kneeI), P(ankI)), o: Vec3 = v3.normalize([hip[0] - pE[0], 0, hip[2] - pE[2]]);
          const r = Math.sqrt(Math.max(0.01, th * th - (hip[1] - 0.07) ** 2));
          lead(kneeI, [hip[0] - f[0] * r + o[0] * 0.02, 0.07, hip[2] - f[2] * r + o[2] * 0.02]); lead(ankI, [hip[0] - f[0] * (r + sh) + o[0] * 0.04, 0.06, hip[2] - f[2] * (r + sh) + o[2] * 0.04]);
          lead(handI, [sho[0] + f[0] * 0.2 + o[0] * 0.12, 0.05, sho[2] + f[2] * 0.2 + o[2] * 0.12]);
        }
      }
    } else if (kind === 'cut') {
      const beat = 0.28, dur = 0.6 * j; end = beat + dur;
      const sit = led([pv[0] + away[0] * 0.24 * room, 0.27, pv[2] + away[2] * 0.24 * room], line(away, 24), beat, end - 0.05, beat + 0.1 * dur, end);
      frame = t => { const [p, q] = sit(t), k = bump(t, 0, beat * 0.8, beat, beat + 0.2); return [[p[0], p[1] - 0.04 * k, p[2]], q]; };   // (the beat he stands: sagging a little)
      nod = t => 24 * DEGR * bump(t, 0.02, beat, beat + 0.3 * dur, end);
      for (const [i, sg] of [[RAG.handL, 1], [RAG.handR, -1]] as [number, number][]) {   // both hands to the throat for the beat he stands, and on down with him
        const lf: Vec3 = [f[2] * sg, 0, -f[0] * sg];
        extra.push({ i, t0: 0.03, off: beat + 0.55 * dur, at: t => { const [p, q] = frame(t), n = v3.add(p, quat.rotate(q, v0)); return [n[0] + f[0] * 0.1 + lf[0] * 0.05, n[1] - 0.02, n[2] + f[2] * 0.1 + lf[2] * 0.05]; } });
      }
      release = r => { r.addRigidVelocity(v3.scale(away, 0.5 * room), [away[2] * 2.2, 0, -away[0] * 2.2]); r.addVelocity(RAG.head, away, 0.4); };   // back off his seat, away from the knife
    } else if (kind === 'topple') {
      const aL = P(RAG.ankL), aR = P(RAG.ankR), A: Vec3 = [(aL[0] + aR[0]) / 2, 0, (aL[2] + aR[2]) / 2], k: Vec3 = [away[2], 0, -away[0]], dur = 0.34 * j, top = 42 * DEGR, r0 = v3.sub(pv, A); end = dur;
      // (struck from a side he turns as he goes, his back coming round to the floor: a trunk let fall edge-on lands balanced on a shoulder and a hip and takes seconds to tip)
      const nf: Vec3 = [-f[0], 0, -f[2]], tc = clamp(v3.dot(nf, away), -1, 1), tw = Math.min(Math.acos(tc), 100 * DEGR), ty = nf[2] * away[0] - nf[0] * away[2] >= 0 ? 1 : -1;
      frame = t => {   // …about his heels, gathering speed
        const u = clamp(t / dur, 0, 1), q = quat.mul(quat.axisAngle(k, top * u * u), quat.axisAngle([0, ty, 0], tw * smoothstep(0, 1, u)));
        return [v3.add(A, quat.rotate(q, r0)), q];
      };
      if (tw > 0.2) for (const [i, a0] of [[RAG.ankL, aL], [RAG.ankR, aR]] as [number, Vec3][]) {   // (his heels turning under him with it, or the legs end up crossed)
        const r = v3.sub(a0, A); extra.push({ i, t0: 0, off: dur, at: t => v3.add(A, quat.rotate(quat.axisAngle([0, ty, 0], tw * smoothstep(0, 1, clamp(t / dur, 0, 1))), r)) });
      }
      nod = t => -16 * DEGR * smoothstep(0, 0.06, t) * (v3.dot(away, f) < 0 ? 1 : -1);   // the head snapped back off the hand
      const w = 2 * top / dur * 0.8;
      release = r => { r.addRigidVelocity(v3.mad(v3.scale(away, (0.5 + 0.4 * room) * j), [0, -1, 0], 1.0), [k[0] * w, 0, k[2] * w]); r.addVelocity(RAG.head, away, 0.4); };
    } else {
      const dur = 0.6 * j; end = dur;
      frame = led(pv, line(f, 58 * (0.5 + 0.5 * room)), 0, 1, 0, dur);
      nod = t => 24 * DEGR * smoothstep(0, 0.2, t);
      release = r => { r.addVelocity(RAG.head, sd, 0.3); };
    }
    const rigid = (i: number): GuidePin => { const r = v3.sub(P(i), pv); return { i, t0: 0, off: end, at: t => { const [p, q] = frame(t); return v3.add(p, quat.rotate(q, r)); } }; };
    const pins: GuidePin[] = [RAG.pelvis, RAG.spine, RAG.neck, RAG.shoL, RAG.shoR, RAG.hipL, RAG.hipR].map(rigid);
    const rh = v3.sub(P(RAG.head), nk);
    pins.push({ i: RAG.head, t0: 0, off: end, at: t => { const [p, q] = frame(t); return v3.add(v3.add(p, quat.rotate(q, v0)), quat.rotate(q, quat.rotate(quat.axisAngle(nodAx, nod(t)), rh))); } });
    for (const e of extra) pins.push(e);
    for (const q of pins) if (q.t0 <= 0) rag.setPin(q.i, q.at(0));
    return { t: 0, end, pins, release };
  }
  /** a led fall's frame (FallGuide): its pins moved along their paths; at the end it is let go with the fall's own shove — and at once, with none, the moment
   *  anything else takes hold of the body (a haul's pins) */
  private guideStep(rag: Ragdoll, dt: number) {
    const G = this.guide!, t0 = G.t; G.t += dt;
    let taken = false;
    for (let i = 0; i < 16 && !taken; i++) if (rag.isPinned(i)) { let mine = false; for (const q of G.pins) if (q.i === i && t0 >= q.t0 && t0 < q.off) { mine = true; break; } taken = !mine; }
    const done = G.t >= G.end;
    for (const q of G.pins) {
      if (taken || done || G.t >= q.off) { if (t0 >= q.t0 && t0 < q.off) rag.unpin(q.i); }
      else if (G.t >= q.t0) rag.setPin(q.i, q.at(G.t));
    }
    if (taken || done) { this.guide = null; if (done && !taken) G.release(rag); }
  }
  /** A MAN OUT COLD BREATHES (Character.breathe; takedown.ts): the settled body's chest rises and falls. The skeleton alone is posed again — the chest joint
   *  lifted by a slow sine, the shoulders' and the neck's own joints held where they lay so arms and head stay on the floor — and `bones`, the particles and
   *  everything the game reads stand as they slept. */
  private breathFrame(dt: number, k: { breathHz: number; breathRise: number; breathIn: number }) {
    const rd = this.rd!, nd = this.anim.nodes, sk = this.skel;
    let b = this.br;
    if (!b) {
      const at = (i: number): Vec3 => m4.getTranslation(sk.globals[i]), rot = (i: number): Quat => [...sk.globalRot[i]] as Quat;
      const hold = [nd.upperArmL, nd.upperArmR, nd.neck];
      b = this.br = { t: 0, due: 0, chest: nd.spine2, at: at(nd.spine2), rot: rot(nd.spine2), hold, holdOv: hold.map(i => ({ rot: rot(i), pos: at(i) })), saved: [rd.ov[nd.spine2], ...hold.map(i => rd.ov[i])] };
    }
    b.t += dt; b.due -= dt; if (b.due > 0) return; b.due = 1 / 15;   // (a breath is a quarter hertz: the skeleton is posed again fifteen times a second, not every frame)
    const a = k.breathRise * smoothstep(0, Math.max(k.breathIn, 1e-3), b.t) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * k.breathHz * b.t + this.id * 1.7));
    rd.ov[b.chest] = { rot: b.rot, pos: [b.at[0], b.at[1] + a, b.at[2]] };
    for (let i = 0; i < b.hold.length; i++) rd.ov[b.hold[i]] = b.holdOv[i];
    sk.update(rd.pose, this.world, null, rd.ov);
  }
  /** …and stops: the drive's own overrides back (`pose` = the skeleton put back as it slept — not needed when the body has woken and is about to be posed) */
  private breathEnd(pose: boolean) {
    const rd = this.rd!, b = this.br!; this.br = null;
    rd.ov[b.chest] = b.saved[0]; for (let i = 0; i < b.hold.length; i++) rd.ov[b.hold[i]] = b.saved[i + 1];
    if (pose) this.skel.update(rd.pose, this.world, null, rd.ov);
  }

  /** Unit vector pointing 'down' out of the underside of the gun (perpendicular to gunDir, toward the floor for a level gun). */
  gunUnder(): Vec3 {
    const g = this.gunDir; const gu = g[1];                       // g × (g × up) = (g·up) g − up
    const d: Vec3 = [g[0] * gu, g[1] * gu - 1, g[2] * gu];
    return v3.normalize(d);
  }

  /** Head rotation (world): takes rest-pose model-frame vectors (+Z forward, +Y up, +X the figure's left) to where the skull currently points them. */
  headRot(): Quat { return quat.mul(quat.yaw(this.bodyYaw), quat.mul(this.skel.globalRot[this.anim.nodes.head], this.restHeadInv)); }
  /** Head look direction (world). */
  headDir(): Vec3 { return v3.normalize(quat.rotate(this.headRot(), [0, 0, 1])); }

  /** Capsule shadow proxies (segment a→b, radius) in world space + a bounding sphere; consumed by BoxWorld.addCharacterCapsules. */
  capsules(): { caps: number[][]; bound: [number, number, number, number] } {
    const b = this.bones; const cap = capRec, sole = capSole;   // (module functions: the two closures this used to make per call, statement for statement)
    // shoulders: widen the upper torso capsule sideways by using the shoulder line
    const shoulderMid: Vec3 = v3.lerp(b.upperArmL, b.upperArmR, 0.5);
    const caps: number[][] = [
      cap(b.hips, b.spine2, 0.15),                                   // lower torso
      cap(b.spine2, shoulderMid, 0.16),                              // chest
      cap(b.upperArmL, b.upperArmR, 0.07),                           // shoulder line
      cap(b.thighL, b.thighR, 0.11),                                 // pelvis
      cap(b.neck, v3.mad(b.head, quat.rotate(this.headRot(), [0, 1, 0]), 0.13), 0.105),   // neck + head (along the skull's up, so a lying body's head proxy lies with it)
      cap(b.upperArmL, b.forearmL, 0.052), cap(b.forearmL, b.handL, 0.042, 0.09),
      cap(b.upperArmR, b.forearmR, 0.052), cap(b.forearmR, b.handR, 0.042, 0.09),
      cap(b.thighL, b.shinL, 0.075), cap(b.shinL, b.footL, 0.058), sole(b.footL, b.toeL),
      cap(b.thighR, b.shinR, 0.075), cap(b.shinR, b.footR, 0.058), sole(b.footR, b.toeR),
    ];
    // (15 = BoxWorld.CAPS_PER_CHAR — both feet get a shoe: the right one used to be folded into the budget, so nothing forward of the right ankle cast a shadow and
    //  the shoe read as hovering over a lit floor up close)
    const c = v3.lerp(b.hips, b.spine2, 0.5);
    return { caps, bound: [c[0], c[1], c[2], 1.5] };   // generous: sprint strides / raised arms + capsule radii must stay inside the cull sphere
  }

  /** Approximate ray test against the character (capsule-ish: vertical the hips' column (+ the chest's when the trunk leans off it), entered through side, crown or soles). Returns t or -1. */
  /** A point INSIDE the body — the hips' column soles to crown (+ `crownPad` above it: a standing man's muzzle pressed down onto a crouched one), or the chest's
   *  column when the trunk leans off the hips (the same two columns rayHit enters). combat.ts bodyHit's contact shot asks this: a muzzle already in him is a hit where it is. */
  insideBody(p: Vec3, crownPad = 0): boolean {
    if (!this.alive) return false;
    const top = (this.bones.headTop?.[1] ?? this.pos[1] + 1.75) + crownPad, bot = this.pos[1] + 0.05;
    const hips = this.bones.hips, chest = this.bones.spine2;
    const cx = (hips?.[0] ?? this.pos[0]), cz = (hips?.[2] ?? this.pos[2]);
    if (p[1] > bot && p[1] < top && hyp2(p[0] - cx, p[2] - cz) < 0.28) return true;
    if (chest && hips && hyp2(chest[0] - hips[0], chest[2] - hips[2]) > 0.12) {
      const cb = Math.min(hips[1], chest[1]) - 0.12;
      if (p[1] > cb && p[1] < top && hyp2(p[0] - chest[0], p[2] - chest[2]) < 0.25) return true;
    }
    return false;
  }
  rayHit(ro: Vec3, rd: Vec3, tmax: number): number {
    if (!this.alive) return -1;
    const top = (this.bones.headTop?.[1] ?? this.pos[1] + 1.75), bot = this.pos[1] + 0.05;
    const hips = this.bones.hips, chest = this.bones.spine2;
    const cx = (hips?.[0] ?? this.pos[0]), cz = (hips?.[2] ?? this.pos[2]);
    // the body = the column about the hips from soles to crown, entered through the side OR through the crown / the soles (a man stood over a crouched one firing
    // down at him used to put every round through him: the side test alone found no entry from above) — PLUS, when the pose carries the chest away from over the
    // hips (pressed to a wall and leaning, crouched low over the feet, mid-vault), a second column about the CHEST from the hips up: the men aim at the trunk bone
    // (guards.ts), and a trunk leaning 40 cm off the hips' column took round after round through thin air (soak seed 2, 08-13, the QRF at its own door: thirty
    // rounds from 0.7 m, not one home). An origin already inside a column is no entry: bodyHit's contact shot decides that case.
    let t = columnEntry(ro, rd, tmax, cx, cz, 0.28, bot, top);
    if (chest && hips && hyp2(chest[0] - hips[0], chest[2] - hips[2]) > 0.12) {
      const tc = columnEntry(ro, rd, tmax, chest[0], chest[2], 0.25, Math.min(hips[1], chest[1]) - 0.12, top);
      if (tc >= 0 && (t < 0 || tc < t)) t = tc;
    }
    return t;
  }

}
