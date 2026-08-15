// Character = animated mannequin instance: locomotion/upper-body animation graph, procedural aim twist,
// world placement, bone queries and RT proxy boxes — and, once dead, a ragdoll (ragdoll.ts) that poses the same skeleton.
import { Mat4, Quat, Vec3, m4, quat, v3, clamp, damp, wrapAngle, lerp, smoothstep } from '../math/vec';
import { GltfCharacter, Clip } from '../anim/gltf';
import { NodeOverride, Pose, PoseFK, SkeletonInstance, TwistSpec, blendPose, buildMask, restPose, rotateLocal, rotateModel, sampleClip, setModelRot, twoBoneIK } from '../anim/skeleton';
import { Ragdoll, RagdollWorld, RAG } from './ragdoll';

export type UpperMode = 'none' | 'relaxed' | 'aim' | 'torch';
/** Procedural ready postures layered over the locomotion (see CharacterAnimator.stance). */
export type Stance = 'none' | 'highReady' | 'lowReady' | 'stack' | 'wall';
/** The long gun's four carriages (see LONG / CharacterAnimator.longGun): the calm two-hand carry, the long-gun low ready, shouldered on the aim, the high port. */
export type LongStance = 'patrolLong' | 'lowLong' | 'shoulder' | 'portLong';
export const LONG_STANCES: LongStance[] = ['patrolLong', 'lowLong', 'shoulder', 'portLong'];
/** Left-hand signals (CharacterAnimator.signal). */
export type SignalKind = 'hold' | 'go' | 'rally';
/** The idle tells of a man about to leave his route for a need (CharacterAnimator.tell — game/needs.ts): a look at his watch, a rub at the back of his neck. */
export type TellKind = 'watch' | 'neck';
/** The grab-from-behind beat both figures share (player.ts Hold / Guard.held): the reach (grab), the hold itself, the choke (arm variant) or the pistol-whip (gun
 *  variant). */
export type HoldPhase = 'grab' | 'held' | 'choke' | 'whip';
/** Which hold it is — set at the grab by what was in Sam's hand, swapped by E with the man already in the arm (player.ts swapHold): 'arm' — both hands on the
 *  man, the knife in the right fist (the pistol rides the thigh); 'gun' — the left forearm across his throat as before, the Five-seveN in the right hand up
 *  beside his head (fired past him, or brought down on it). */
export type HoldVariant = 'arm' | 'gun';
/** What the controller tells each figure's layer every frame of a hold (CharacterAnimator.holdPose = Sam, .heldPose = the man): the phase and the seconds into
 *  it, and the variant (absent = 'arm'; a change of it mid-hold is eased by the layers themselves — the hand-over, HOLD.secs.swap). Sam's gun hold also carries
 *  how far the pistol is presented off the man's head to fire past him (gunOut 0‥1, eased by the controller) and the pitch it is presented at (rad, + up: the
 *  aim). The man's carries how rattled he is (0‥1, the dialogue engine's agitation — the struggle's amplitude, so body and mouth agree) and the seconds since
 *  a round last went past his ear (shot; absent / < 0 = none lately). */
export interface HoldPose { phase: HoldPhase; t: number; variant?: HoldVariant; gunOut?: number; gunPitch?: number; }
/** armed: his right hand still has the pistol in it (a man grabbed with it drawn) — the raised hand stays a fist round it instead of opening */
export interface HeldPose { phase: HoldPhase; t: number; agitation: number; variant?: HoldVariant; shot?: number; armed?: boolean; }
/** A hand on the door leaf he is pushing open (game.ts handsOnDoors feeds it, CharacterAnimator.doorLayer poses it): p = the spot on the leaf face for the palm
 *  (WORLD), n = that face's unit normal out toward him (world), w = 0‥1 intent — 1 while he pushes, 0 to take the hand off; the layer eases either way and keeps
 *  the last spot to ease out from — hand = which one game.ts wants on it (0 left, 1 right: the leaf's free-edge side if that hand is empty, else the left; the
 *  layer still refuses a right hand that has the pistol or a torch in it; −1 = not settled yet: square up to the door but keep both hands where they are). */
export interface DoorPush { p: Vec3; n: Vec3; w: number; hand: 0 | 1 | -1; holdOnly?: boolean; }   // holdOnly: standing in the swing of a leaf its closer rests on him — the hand may go up if he already faces it, but the controller must not turn him to it
/** The hold's contact constants (docs/internal/grab-interrogate-design.md §3). The two roots are locked HOLD.dist apart on ONE facing, so a point on the other man
 *  is a constant in each figure's own model space (x = the figure's left, y up, z ahead of its root) — no bone hand-off between the characters. Timings are the
 *  controller's too (player.ts reads secs). First-pass numbers off the mannequin's measured joints; the viewer will get a page to tune them like RIG. */
export const HOLD = {
  /** his root this far dead ahead of Sam's, both on Sam's facing: chest to his back — any further and no arm reaches round a throat with the forearm ACROSS it
   *  (the mannequin's upper arm is 0.27: the elbow has to sit on his left collarbone) */
  dist: 0.27,
  /** seconds: the reach before he is held · Space held this long on his row starts the choke (arm) / the whip (gun) · of tightening before he goes limp · from the
   *  pistol coming off his head to it landing behind his ear (the strike arrives AT this instant; Space up sooner and it never does) · E with him in the arm: the
   *  draw / the holstering — the right hand goes back over his shoulder, changes tools there and comes in with the other (holdLayer, SWAP_RATE), and for this
   *  long the row starts nothing (player.ts swapHold's lockout: no round, no question, no choke, no whip) */
  secs: { grab: 0.45, chokeHold: 0.35, choke: 2.6, whip: 0.6, swap: 0.3 },
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
const AX: Vec3 = [1, 0, 0], AY: Vec3 = [0, 1, 0], AZ: Vec3 = [0, 0, 1];
/** model-axis rotations: pitch (+ = bow forward), yaw (+ = turn to the figure's left), roll (+ = left shoulder up) */
const qPitch = (a: number) => quat.axisAngle(AX, a), qYaw = (a: number) => quat.axisAngle(AY, a), qRoll = (a: number) => quat.axisAngle(AZ, a);

/** Critically damped follower (value + velocity): unlike damp() it also eases IN, so a posture change starts as softly as it ends. w ≈ 6 / settle time. */
class Spring {
  v = 0; constructor(public x = 0) {}
  step(target: number, w: number, dt: number) { const y = this.x - target, j = this.v + y * w, e = Math.exp(-w * dt); this.x = target + (y + j * dt) * e; this.v = (this.v - j * w * dt) * e; return this.x; }
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
  patrolLong: { side: -0.245, up: -0.16, fwd: 0.13, anchor: 0, pitch: -42, aimK: 0, yaw: 20, blade: -8, lean: 0, headYaw: 0, headPitch: 0, headRoll: 0, elbowR: [-0.45, -1, -0.5], elbowL: [0.35, -1, -0.3], poleW: 0.65, sway: 1, steady: 0.5 },   // (designer's hand offsets from the viewer; then slung LOW: belly height, muzzle 42° into the floor whatever the aim does, 20° across the body — a calm carry, not the pistol's two-hand ready with a rifle in it)
  // the long-gun low ready (a colleague in the line, the drill's formations; the player's SPRINT with the rifle): stock up at the shoulder, muzzle put 40° into the floor whatever the aim does, elbows in
  lowLong: { side: -0.165, up: -0.085, fwd: 0.2, anchor: 0.05, pitch: -40, aimK: 0.05, yaw: 24, blade: -10, lean: 2, headYaw: 0, headPitch: 2, headRoll: 0, elbowR: [-0.55, -1, -0.35], elbowL: [0.4, -1, -0.1], poleW: 0.75, sway: 0.25, steady: 1 },   // (designer's viewer pass, 08-08; sway 0.6 → 0.25 and steadied for the player's run with it)
  // shouldered: stock in the pocket, bore dead on the aim (yaw AND pitch: the drawn weapon, its light and the shot all follow Character.aimDir there), support arm long
  // under the handguard, firing elbow lifted, cheek toward the comb, leaning into it — over the aim clip's trunk whoever asks for it (update(): a shouldered long gun IS
  // the aim). Anchored on the gun SHOULDER (anchor 1: the wrist 27 cm dead ahead of that joint along the aim, whatever the aim clip does with the shoulders):
  // the AI reads its line of fire shoulder → target (guards.ts clearShot) and the round flies muzzle → target — one line, as with the pistol at arm's length, or a
  // jamb the shoulder clears takes every round (the soak's man planted at the break-room door firing into the leaf for six seconds)
  shoulder: { side: -0.15, up: -0.015, fwd: 0.255, anchor: 0.5, pitch: -2, aimK: 1, yaw: 0, blade: -36, lean: 4, headYaw: -10, headPitch: 6, headRoll: 7, elbowR: [-0.8, -1, -0.2], elbowL: [0.6, -1, 0.35], poleW: 0.6, sway: 0.1, steady: 1 },   // (designer's viewer pass 08-09: nearer in and further inboard, anchored half way between chest and gun shoulder; then sway 0.3 → 0.1 and fully steadied: the player carries it here whenever it is in his hands)
  // high port (stacked on a door, the kick, moving through a doorway): the gun across the chest, muzzle up 50° past the left shoulder, butt down by the right hip
  portLong: { side: -0.115, up: -0.15, fwd: 0.19, anchor: 0, pitch: 50, aimK: 0, yaw: 35, blade: 0, lean: 0, headYaw: 0, headPitch: 0, headRoll: 0, elbowR: [-0.7, -0.8, -0.3], elbowL: [0.9, -0.6, 0.1], poleW: 0.75, sway: 0.5, steady: 0.7 },   // (designer's viewer pass, 08-08)
};
/** The same four carriages CROUCHED — standing and crouching tune separately (the designer's viewer pass). The solve blends the two tables channel by channel by
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
const LC = { side: 0, up: 1, fwd: 2, pitch: 3, aimK: 4, yaw: 5, blade: 6, lean: 7, headYaw: 8, headPitch: 9, headRoll: 10, elbowR: 11, elbowL: 14, poleW: 17, sway: 18, anchor: 19, steady: 20, count: 21 };
/** Steadying a long gun against the gait, for a figure whose CharacterAnimator.longSteady is up (Sam — player.ts armRifle; the guards' riflemen carry theirs as they
 *  did) and by the carriage's `steady`: the trigger hand's anchor follows the trunk's side-to-side through a two-pole low-pass of time constant `tau` (s) instead of
 *  frame by frame — the crouch-walk rocks the chest ±6 cm and the walk ±3, once a stride: that stays in the trunk and the arms take it up, the gun riding the
 *  shoulders' mean line as a shooter's does, while the weight settling onto one foot over a second at rest still carries it — and, at a run un-aimed (the sprint's
 *  low ready), `runYaw` of the shoulder line's pumping (±25° in the run clips, whose arms drive) is taken back out down the spine: both hands are on the weapon, so
 *  the shoulders are held to it and the legs do the running (longArms / longBody). Viewer: Long gun ▸ steady rows. */
export const LONG_STEADY = { tau: 0.5, runYaw: 0.85 };
/** the trigger hand's pull back along the bore while a shot plays (m; ~35 ms up, 0.2 s down — the drawn weapon rides the hand, so this is what the carbine's recoil shows) */
const LONG_KICK_BACK = 0.03;
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
/** kick timing (s): total (the last ~0.25 s is the weight settling forward off the re-planted foot), and the instant the sole meets the door */
const KICK_DUR = 1.0; export const KICK_IMPACT = 0.38;
/** the swing foot is back on the floor by this time */
const KICK_PLANT = 0.72;
const SIGNAL_DUR: Record<SignalKind, number> = { hold: 0.9, go: 0.95, rally: 1.3 };
/** the tells' lengths (s): the watch comes up, is read ~0.6 s, goes down; the neck rub takes a little longer (game/needs.ts keys its telegraph off neither: they are looks, not events) */
export const TELL_DUR: Record<TellKind, number> = { watch: 1.05, neck: 1.35 };
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
  /** Rifles (docs/internal/sc20k-design.md §3): the figure carries a long gun in both hands — the guards' carbine. While set, the pistol carry (carryArms) and the aim
   *  clip's ARMS are replaced by the long-gun solve (longArms) every frame whatever upper / stance say, since the weapon never leaves the two hands: eased in and out
   *  on its own spring (a viewer toggle, a later draw / sling), and the wall hold, the holds, lock work, a hand on a door and the one-shots that own the arms
   *  (reload, hit, throw, the signal's left arm) still play over it. Which carriage (LONG): longStance if forced (viewer, scripts), else derived from what the pistol
   *  man would be doing — upper 'aim' or a shot playing → 'shoulder'; stance lowReady → 'lowLong'; highReady / stack / a kick → 'portLong'; anything else →
   *  'patrolLong' — so the AI writes upper / stance exactly as it does for a pistol and the rifleman follows. */
  longGun = false;
  longStance: LongStance | null = null;
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
  /** the action layer's clock, its eased weight, and the clip it last resolved (kept through the fade-out after `act` is cleared) */
  private actT = 0; private actW = 0; private actClip: Clip | null = null; private actName = ''; private actOut = 0.35;
  /** output: the action layer's weight this frame (0 = none of it in the pose) — the probes read it */
  get actShown(): number { return this.actW; }
  // internal state
  phase = 0;                 // normalized locomotion phase
  crouch = 0;
  private upperW = { relaxed: 0, aim: 0, torch: 0 };
  private shootT = -1; private hitT = -1; private reloadT = -1; private throwT = -1; private strikeT = -1;
  private kickT = -1; private kickHit = false; private sigT = -1; private sigKind: SignalKind = 'hold';
  /** the idle tells (tell / tellLayer): the clock of the one playing (−1 none), which it is, and the arm envelope it showed last frame (0‥1 — read back by the QA
   *  probes as 'the tell is on him', game/needs.ts never reads it) */
  private tellT = -1; private tellK: TellKind = 'watch'; tellShown = 0;
  private idleT = 0;   // (desynced per figure by desync(id))
  /** stance follow-through: master weight + one spring per shape channel (blade / headYaw / side carry the stackSide sign) */
  private st = { w: new Spring(), fwd: new Spring(STANCES.highReady.fwd), up: new Spring(STANCES.highReady.up), side: new Spring(STANCES.highReady.side), pitch: new Spring(STANCES.highReady.pitch), lean: new Spring(STANCES.highReady.lean), headPitch: new Spring(0), tuck: new Spring(STANCES.highReady.tuck), blade: new Spring(0), headYaw: new Spring(0), squat: new Spring(0) };
  /** the wall hold's own followers: wl = how much of the stance weight is the WALL's body / arms rather than the carries' (1 while 'wall' is held, so stack ↔ wall
   *  cross-fade and none ↔ wall rides the master weight alone); side = stackSide made continuous (a flip sweeps head, hands and feet across instead of popping
   *  them); peek = wallPeek eased; park = standing on the hold's own foot spots (1) vs the cycle's feet (0), by ground speed — quick off them, slower back on */
  private wst = { wl: new Spring(), side: new Spring(1), peek: new Spring(), park: new Spring(1) };
  private stanceSeen: Stance = 'highReady'; private lpW = new Spring(); private lpT = 0;
  /** the long gun: master weight (follows longGun), the carriage last followed (null = the channels have never been set: snap), one spring per LongShape channel, how
   *  far the gun is being held back of the carriage's point for the support arm's reach (model space: taken up at once, let out at 2/s, capped — longArms), the two
   *  poles of the anchor's steadied side-to-side (model x, NaN = take it where it is: LONG_STEADY.tau) and this frame's run share (jog + sprint of the pose, 0 crouched) */
  private lg = { w: new Spring(), seen: null as LongStance | null, ch: Array.from({ length: LC.count }, () => new Spring()), pull: [0, 0, 0] as Vec3, lat: [NaN, NaN] as [number, number], run: 0 };
  /** was longGun set last frame? — the long-gun solve snaps weight AND channels on its rising edge, not only once the last draw has fully decayed (review 08-10 #14) */
  private lgArmedWas = false;
  /** the hold's two layers: master weights (sprung on holdPose / heldPose being set), the last inputs seen (what the layer eases OUT from once the controller has
   *  cleared them), the man's eased choke amount (an aborted choke lets his knees and hands come back instead of snapping), Sam's eased 'blade off him'
   *  amount (hdKn: the knife hand between its throat station and its shoulder station — sprung, so easing off a choke brings the blade back without a pop), and
   *  each figure's eased share of the VARIANT (hdGv / heGv, 0 = arm ↔ 1 = gun: snapped to it as a hold begins — hdOn / heOn say whether the pose was set last
   *  frame — and sprung across at SWAP_RATE when E changes it mid-hold, so Sam's right hand is handed over and the man's hands re-settle instead of popping) */
  private hdW = new Spring(); private hdLast: HoldPose = { phase: 'held', t: 0 }; private hdKn = new Spring(); private hdGv = new Spring(); private hdOn = false;
  private heW = new Spring(); private heLast: HeldPose = { phase: 'held', t: 0, agitation: 0 }; private heCk = new Spring(); private heGv = new Spring(); private heOn = false;
  /** the door hand (doorLayer): one weight spring per arm (a change of hand cross-fades), the last spot fed (what the arm eases out from once game.ts stops feeding),
   *  which arm is wanted, and the reach test's hysteresis */
  private dp = { wL: new Spring(), wR: new Spring(), last: null as DoorPush | null, right: false, reachOK: false, tw: new Spring() };   // (tw: how much of the aim's chest twist is let go — the shoulders squared to the door — while a push is live)
  /** `deliberate` eased; and the crouch walk's gait numbers its retime needs (measured off Crouch_Fwd_Loop at construction): the fore-aft middle of the ankles'
   *  travel — the stride is warped about it — and the phase the linger centres on (just after a foot is set down; the other plant is half a cycle on) */
  private dlb = new Spring(); private gait = { mid: -0.15, linger: 0.08 };
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
  private chestRestInv: Quat;
  /** finger joints [side L=0/R=1][finger index,middle,ring,pinky][joint 0..2] and thumbs [side][joint] */
  private fingers: number[][][]; private thumbs: number[][];
  nodes: Record<keyof typeof N, number>;

  constructor(public ch: GltfCharacter) {
    const n = ch.nodes.length;
    this.pose = new Pose(n); this.pA = new Pose(n); this.pB = new Pose(n); this.pC = new Pose(n); this.pUpper = new Pose(n); this.pAim = new Pose(n); this.rest = restPose(ch, new Pose(n));
    for (const p of [this.pose, this.pA, this.pB, this.pC, this.pUpper, this.pAim]) p.copy(this.rest);
    const need = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Idle_Torch_Loop', 'Hit_Chest', 'Sprint_Loop', 'Pistol_Reload', 'Punch_Cross'];   // (no death clip: dying hands the skeleton to the ragdoll, Character.ragdollize; no throw clip: the library's only cast is left-handed, the throw is procedural — throwLayer)
    this.clips = {};
    for (const k of need) { const c = ch.clips.get(k); if (!c) throw new Error('missing clip ' + k); this.clips[k] = c; }
    this.nodes = {} as Record<keyof typeof N, number>;
    for (const [k, name] of Object.entries(N)) { const i = ch.nodeByName.get(name); if (i === undefined) throw new Error('missing node ' + name); (this.nodes as Record<string, number>)[k] = i; }
    const node = (name: string) => { const i = ch.nodeByName.get(name); if (i === undefined) throw new Error('missing node ' + name); return i; };
    this.fingers = ['L', 'R'].map(s => ['f_index', 'f_middle', 'f_ring', 'f_pinky'].map(f => [1, 2, 3].map(j => node(`DEF-${f}.0${j}.${s}`))));
    this.thumbs = ['L', 'R'].map(s => [1, 2, 3].map(j => node(`DEF-thumb.0${j}.${s}`)));
    this.upperMask = buildMask(ch, [{ name: N.spine1, w: 0.3, subtree: false }, { name: N.spine2, w: 0.65, subtree: false }, { name: N.spine3, w: 1, subtree: true }]);
    this.armRMask = buildMask(ch, [{ name: N.shoulderR, w: 1, subtree: true }, { name: N.spine3, w: 0.25, subtree: false }]);
    this.headMask = buildMask(ch, [{ name: N.neck, w: 1, subtree: true }]);
    this.armsMask = buildMask(ch, [{ name: N.shoulderL, w: 1, subtree: true }, { name: N.shoulderR, w: 1, subtree: true }]);   // both clavicles down to the fingertips: the procedural carries / lock work
    this.armLOnly = buildMask(ch, [{ name: N.shoulderL, w: 1, subtree: true }]); this.armROnly = buildMask(ch, [{ name: N.shoulderR, w: 1, subtree: true }]);   // one arm at a time: the hand on a door
    this.torsoMask = this.upperMask.map((w, i) => this.armsMask[i] > 0 ? 0 : w);                                          // the aim clip's trunk + head without its arms (the long gun keeps its own)
    this.dynMask = new Float32Array(n);                                                                                      // the signals' left-arm mask, rebuilt per frame with staggered weights (shoulder → elbow → hand)
    this.fk = new PoseFK(ch);
    sampleClip(this.clips.Pistol_Aim_Neutral, 0, false, this.pAim);   // the two-hand grip every pistol carry below is built from (static clip)
    this.fk.run(this.rest); this.chestRestInv = quat.conj(this.fk.rot[this.nodes.spine3]);
    this.handFix = [this.nodes.handL, this.nodes.handR].map(h => { const r = this.fk.rot[h]; const F = v3.normalize(quat.rotate(r, AY)); const B = v3.normalize(v3.mad(AY, F, -v3.dot(AY, F))); return quat.mul(quat.conj(quat.fromBasis(v3.cross(F, B), F, B)), r); });   // rest = T-pose, palms down: fingers along local +Y, back of the hand facing model +Y
    this.fk.run(this.pAim); this.gripUp = quat.rotate(quat.conj(this.fk.rot[this.nodes.handR]), AY);
    { const p = new Pose(n).copy(this.rest); sampleClip(this.clips.Idle_Loop, 0, false, p); const fk = this.fk.run(p); const nd = this.nodes;
      this.gazeLocal = quat.rotate(quat.conj(fk.rot[nd.head]), AZ);
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
          const s = Math.hypot(q[0], q[1], q[2]), ang = 2 * Math.atan2(s, q[3]);
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
    this.phase = Math.random();
  }
  /** desynchronise the idle / life clocks per figure, deterministically (Character passes its id): a room of guards must not breathe and fidget in step,
   *  and two boots with the same ids must pose identically (the pixel-A/B capture recipe) */
  desync(seed: number) {
    const h = (k: number) => { let x = Math.imul(((seed + 1) * 2654435761) ^ (k * 40503), 2246822519) >>> 0; x ^= x >>> 15; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
    this.idleT = h(1) * 20; this.life.breath = h(2) * 6.28; this.life.shiftT = 2 + h(3) * 5; this.life.shiftSide = h(4) < 0.5 ? -1 : 1;
  }

  fire() { this.shootT = 0; }
  hit() { this.hitT = 0; }
  /** startle: same recoil as taking a round (Hit_Chest layer), no damage implied */
  flinch() { this.hit(); }
  /** takedown strike (full upper body, brief): Punch_Cross */
  strike() { this.strikeT = 0; }
  get striking() { return this.strikeT >= 0; }
  /** the reload one-shot (Pistol_Reload over the upper body), retimed to take `dur` seconds — the weapon's own beat: the Five-seveN's 1.6, the SC-20K's 2.4 */
  reload(dur = 1.6) { this.reloadT = 0; this.reloadDur = Math.max(0.3, dur); }
  cancelReload() { this.reloadT = -1; }
  private reloadDur = 1.6;
  /** Overhand throw off the right hand, THROW_DUR s, layered over whatever the legs are doing (standing, crouched, walking): torso and pelvis wind away and
   *  unwind hips-first, the hand comes up behind the head and whips past it — the item should leave it at THROW_RELEASE — then follows through down across
   *  the body and eases back to the pose beneath. Re-triggering mid-swing starts the new wind-up from where the hands are. */
  throwItem() { this.thrCarry = this.throwT >= 0 && this.thrLast ? { r: v3.copy(this.thrLast.r), l: v3.copy(this.thrLast.l) } : null; this.throwT = 0; }
  get reloading() { return this.reloadT >= 0; }
  /** the item is still in the hand (up to a hair past THROW_RELEASE): hand props keep drawing it, a beat waits with the re-draw */
  get throwing() { return this.throwT >= 0 && this.throwT < THROW_RELEASE + 0.05; }
  /** the throw one-shot is playing at all (wind-up through recovery) */
  get inThrow() { return this.throwT >= 0; }
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
   *  then chopped forward to point the way, 'rally' open hand circling above the head. Ignored while one is still playing. */
  signal(kind: SignalKind) { if (this.sigT < 0) { this.sigT = 0; this.sigKind = kind; } }
  get signalling() { return this.sigT >= 0; }
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
      this.shootT = this.hitT = this.reloadT = this.throwT = this.strikeT = this.kickT = this.sigT = this.tellT = -1; this.tellShown = 0; this.kickHit = false; this.hideHeldItem = false; this.thrCarry = this.thrLast = null;
      this.dp.wL.x = this.dp.wL.v = this.dp.wR.x = this.dp.wR.v = this.dp.tw.x = this.dp.tw.v = 0; this.dp.last = null;
      return;
    }
    // ---- one-shot clocks that shape the base graph (kick fades locomotion out under itself)
    const kt = this.kickT; const wK = kt >= 0 ? bump(kt, 0, 0.12, KICK_DUR - 0.2, KICK_DUR) : 0;   // locomotion fade under the kick
    const wKbody = kt >= 0 ? 1 - smoothstep(KICK_DUR - 0.2, KICK_DUR, kt) : 0;                      // the kick's body layer: full from the first frame (its curves and foot targets all start where the body is), eased off at the end
    const wKstand = kt >= 0 ? bump(kt, 0, 0.2, KICK_DUR - 0.3, KICK_DUR) : 0;                       // a stance's squat / blade / lean standing up square for the kick
    const wKslow = kt >= 0 ? bump(kt, 0, 0.3, KICK_DUR - 0.3, KICK_DUR) : 0;                        // what the arms and a crouch follow (hanging arms need longer than 0.1 s to find the gun)
    const wLp = clamp(this.lpW.step(this.lockpick ? 1 : 0, 17, dt), 0, 1);
    if (this.holdPose) this.hdLast = this.holdPose; else if (this.hdLast.phase === 'whip' && this.hdLast.t < HOLD.secs.whip + 1) this.hdLast = { ...this.hdLast, t: this.hdLast.t + dt };   // (what the layers ease out from once the controller lets go — a whip that has landed plays its follow-through on the way out)
    if (this.heldPose) this.heLast = this.heldPose;
    const thruWhip = !this.holdPose && this.hdLast.phase === 'whip' && this.hdLast.t >= HOLD.secs.whip && this.hdLast.t < HOLD.secs.whip + WHIP_THRU;   // (a whip that landed keeps the layer up through its follow-through, then lets go)
    const wHd = clamp(this.hdW.step(this.holdPose || thruWhip ? 1 : 0, 16, dt), 0, 1), wHe = clamp(this.heW.step(this.heldPose ? 1 : 0, 16, dt), 0, 1);
    // each figure's eased share of the variant (0 = arm ↔ 1 = gun): the variant's own the frame a hold begins, sprung across when E changes it with the man already
    // in the arm (player.ts swapHold) — holdLayer hands the right fist over behind his shoulder by it, heldLayer re-settles the man's hands and head by it
    { const gvT = (this.holdPose ?? this.hdLast).variant === 'gun' ? 1 : 0; if (this.holdPose && !this.hdOn) { this.hdGv.x = gvT; this.hdGv.v = 0; } else this.hdGv.step(gvT, SWAP_RATE, dt); this.hdOn = !!this.holdPose;
      const heT = (this.heldPose ?? this.heLast).variant === 'gun' ? 1 : 0; if (this.heldPose && !this.heOn) { this.heGv.x = heT; this.heGv.v = 0; } else this.heGv.step(heT, SWAP_RATE, dt); this.heOn = !!this.heldPose; }
    this.holdGunSide = this.hdGv.x >= 0.5;                        // which tool the hold's right hand has (the knife below ½, the pistol from there: they change hands behind the man's shoulder)
    const gunHold = wHd > 0.003 && this.holdGunSide;             // the pistol stays in the hand through this hold: drawn, lit if it was, and a shot's recoil is the hold layer's (not the two-handed aim clip's)
    this.hideHeldItem = wLp > 0.5 || (wHd > 0.5 && !gunHold);   // hands on the lock tools, or both on a held man: the pistol rides the thigh
    this.crouch = damp(this.crouch, Math.max(this.crouchTarget, this.lockpick ? 1 : 0), 10, dt);
    const s = Math.abs(this.speed) * (1 - wK);
    const crouchPose = this.crouch * (1 - wKslow);   // the crouch actually shown (the kick stands him up)
    // ---- deliberate movement (`deliberate`, eased here) and the crouch's centre of gravity by pace — the shares everything below reads (sneakLayer):
    //      Dl = deliberate AND crouch-walking (retime, stride, linger, the 4 cm, the lean), pace = creep → full crouch pace (the 3 cm and the longer step),
    //      soft = deliberate walking upright (a centimetre of knee), armsIn = deliberate at all (a little even planted, the rest with movement). The wall
    //      hold keeps its own body and feet: all but the arms let go by its share of the pose (last frame's springs — this frame's are stepped further down).
    const D = clamp(this.dlb.step(clamp(this.deliberate, 0, 1), 15, dt), 0, 1);
    const offWall = 1 - clamp(this.st.w.x, 0, 1) * clamp(this.wst.wl.x, 0, 1);
    const mv = smoothstep(0.15, 0.5, s);
    const Dl = D * mv * offWall * crouchPose, pace = smoothstep(0.38, 0.95, s / P.crouchSpeed) * mv * offWall * crouchPose, soft = D * mv * offWall * (1 - crouchPose);
    const armsIn = D * offWall * lerp(0.4, 1, mv);
    const strideD = 1 + SNEAK.stride * D * mv * offWall;   // the crouch cycle's cadence comes down by this and its stride goes up by it (× crouch: the rate lerp below, the pose in sneakLayer)
    // ---- locomotion (stand) ----
    // weights among idle / walk / jog by speed
    // The GAIT is chosen by ground speed on its own thresholds (BLEND), separate from the clips' natural speeds (P.*Speed) that set the phase RATE:
    // a brisk 1.6 m/s is still every bit a walk (played quicker), not a fifth of a run; and a slow prowl keeps the whole walk cycle at a lazy cadence
    // instead of half-dissolving into the idle (which used to freeze the stride while the ground kept moving — measured skate at 0.8 m/s: 22 cm/s).
    let wWalk = 0, wJog = 0, wSprint = 0;
    if (s <= BLEND.walkTop) wWalk = smoothstep(BLEND.walkIn0, BLEND.walkIn1, s);
    else if (s <= BLEND.jogAt) { wJog = smoothstep(0, 1, (s - BLEND.walkTop) / (BLEND.jogAt - BLEND.walkTop)); wWalk = 1 - wJog; }
    else { wSprint = clamp((s - BLEND.jogAt) / (P.sprintSpeed - BLEND.jogAt), 0, 1); wJog = 1 - wSprint; }
    const wIdle = 1 - wWalk - wJog - wSprint;
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
    this.phase = (this.phase + dt * rate * (this.reverse ? -1 : 1) + 100) % 1;
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
    this.lg.run = smoothstep(0.08, 0.45, wJog + wSprint) * (1 - crouchPose);   // the run's share of the pose, jog through sprint: what a steadied long gun holds the shoulders against (longBody)
    const ph = aL > 1e-5 || aR > 1e-5 ? (this.phase - aL / (4 * Math.PI) * Math.sin(th) - aR * (Math.sin(thR) - Math.sin(3 * thR) / 27) / (8 / 9) / (4 * Math.PI) + 1) % 1 : this.phase;
    const surge = aL > 1e-5 ? -aL * SNEAK.surge * strideD * (1 + SNEAK.paceStride * pace) * P.crouchSpeed * c.Crouch_Fwd_Loop.duration / (4 * Math.PI) * Math.sin(th) * (this.reverse ? -1 : 1) : 0;   // (ground per cycle = stride factor × the clip's own; × the share of it the clip's stance really covers)
    // stand pose
    sampleClip(c.Idle_Loop, this.idleT, true, this.pA);
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
    const held: Stance = kt >= 0 && kt < 0.55 ? 'highReady' : this.stance;   // the kick pulls whatever carry is up into the compressed high ready (an extended low ready would meet the knee), handing back for the plant
    const shape = held !== 'none' ? STANCES[held] : null; const side = this.stackSide;
    const wWas = Math.max(clamp(st.w.x, 0, 1), wKslow);   // the weight the last frame showed (read before stepping: one 60 Hz step from nothing already carries the master past the snap threshold below)
    const wSt = clamp(st.w.step(this.stance !== 'none' ? 1 : 0, this.stance === 'wall' || this.stanceSeen === 'wall' ? 22 : SW, dt), 0, 1);   // the master weight follows the stance itself (a kick from no stance shows the carry through wKslow); on and off the wall in ~0.2 s
    const armed = this.upper === 'relaxed' || this.upper === 'aim' || this.shootT >= 0;   // the pistol is in the hand (the door hand must then be the left)
    const parkNow = 1 - smoothstep(0.12, 0.7, s);                                          // the wall hold: standing on its own foot spots (1) or on the cycle's feet (0)
    if (shape) {
      const snap = wWas < 0.02 && this.stanceSeen !== held;   // taking a shape from (next to) nothing: start AT it rather than morphing from the last one under a rising weight
      if (snap) {
        for (const [k, sp] of Object.entries(st)) if (k !== 'w') { sp.v = 0; sp.x = k === 'blade' ? -side * shape.blade : k === 'headYaw' ? -side * shape.headYaw : k === 'side' ? shape.side - 0.02 * side * (shape.blade / 22) : (shape as unknown as Record<string, number>)[k]; }
        for (const sp of Object.values(ws)) sp.v = 0; ws.wl.x = held === 'wall' ? 1 : 0; ws.side.x = side; ws.peek.x = clamp(this.wallPeek, 0, 1); ws.park.x = parkNow;
      }
      this.stanceSeen = held;
      st.fwd.step(shape.fwd, SW, dt); st.up.step(shape.up, SW, dt); st.side.step(shape.side - 0.02 * side * (shape.blade / 22), SW, dt); st.pitch.step(shape.pitch, SW, dt);
      st.lean.step(shape.lean, SW, dt); st.headPitch.step(shape.headPitch, SW, dt); st.tuck.step(shape.tuck, SW, dt);
      st.blade.step(-side * shape.blade, SW * 0.8, dt); st.headYaw.step(-side * shape.headYaw, SW, dt); st.squat.step(shape.squat, SW * 0.8, dt);   // (yaw + = to the figure's left; side + = wall on its right)
      ws.wl.step(held === 'wall' ? 1 : 0, 22, dt); ws.side.step(side, SW, dt); ws.peek.step(clamp(this.wallPeek, 0, 1), 20, dt);   // (wl at the wall's own brisker rate; the peek is already ramped by the controller)
      ws.park.step(parkNow, parkNow < ws.park.x ? 30 : 12, dt);   // off the spots briskly when he sets off (the feet must be the cycle's within a stride), back onto them over ~0.3 s when he stops — a shuffle into place, not a skate
    }
    const wCarry = Math.max(wSt, wKslow);   // the kick pulls the gun into the compressed carry whatever the stance
    const wl = clamp(ws.wl.x, 0, 1);        // …of which the wall hold's share — of the STANCE weight: read as wSt · wl everywhere (a hold that comes and goes from 'none', the player's, leaves wl standing at 1 by design while wSt carries it out; read bare it switched the carries and the long gun off for good after his first wall — the rifle hung from one hand)
    // ---- the long gun's carriage (rifles): which of the four the pistol man's upper / stance / kick amount to (or the forced one), its channels following at the
    //      stances' rate — set straight AT the first carriage taken from nothing, morphing between them after — and the master weight following longGun itself
    let wLg = 0, lgWant: LongStance | null = null;
    if (this.longGun || this.lg.w.x > 0.002) {
      const want: LongStance = this.longStance ?? (this.upper === 'aim' || this.shootT >= 0 ? 'shoulder' : held === 'lowReady' ? 'lowLong' : held === 'highReady' || held === 'stack' ? 'portLong' : 'patrolLong');
      const wLgWas = clamp(this.lg.w.x, 0, 1);
      const drew = this.longGun && (this.lg.seen === null || wLgWas < 1 && !this.lgArmedWas);   // the rising edge of longGun: a weapon put in the hands from nothing OR re-armed while the last draw's weight was still easing out (E-E, 2→1→2, a short wall hug — review 08-10 #14: it floated level off a hanging wrist for 9–16 frames)
      if (drew) { this.lg.w.x = 1; this.lg.w.v = 0; this.lg.lat[0] = this.lg.lat[1] = NaN; }   // a weapon put in the hands from nothing (a fresh man armed, the viewer's toggle) is held at once — the prop appears that frame too; only letting go of it eases (and its steadied line starts where the trunk is)
      wLg = clamp(this.lg.w.step(this.longGun ? 1 : 0, SW, dt), 0, 1); this.lgArmedWas = this.longGun;
      const tgt = longTargets(want, crouchPose); const chs = this.lg.ch;   // ← the posture blend: LONG (standing) toward LONG_CROUCH by the crouch shown, ahead of the springs
      if (drew || this.lg.seen === null || (wLgWas < 0.02 && this.lg.seen !== want)) {
        const from = this.lg.seen === null && want === 'shoulder' && wSt * wl > 0.1 ? longTargets('lowLong', crouchPose) : tgt;   // drawn off the sling the frame he steps off a wall (the player): it comes UP into the shoulder through the low ready while the hold still has his body — the low ready's point is inside the support arm's reach with the shoulders still square to the plaster, the shouldered one is not for a tenth of a second (the hand trailed the fore-end by 20 cm)
        chs.forEach((sp, i) => { sp.x = from[i]; sp.v = 0; });
      } else chs.forEach((sp, i) => sp.step(tgt[i], SW, dt));
      this.lg.seen = want; this.longShown = wLg > 0.5 ? want : null; if (this.longGun) lgWant = want;
    } else { this.lg.seen = null; this.longShown = null; }
    const wWallArms = wSt * wl * (this.stance === 'wall' ? 1 : 1 - wLg);   // the wall hold's claim on the ARMS: its share of the stance while it is held; coming off it, a long gun back in the hands (the player's, drawn off the sling the frame he steps away) takes them back at once rather than through the hold's fifth of a second out — the weapon is drawn in the hand from that frame, so the hands are on it from that frame (the body still peels off the plaster at the hold's own rate: wallBody)
    // crouch pose (the kick stands him up: crouchPose above)
    if (crouchPose > 0.001) {
      sampleClip(c.Crouch_Idle_Loop, this.idleT, true, this.pB);
      const wMove = clamp(s / (P.crouchSpeed * 0.6), 0, 1);
      if (wMove > 0.001) { sampleClip(c.Crouch_Fwd_Loop, ph * c.Crouch_Fwd_Loop.duration, true, this.pC); blendPose(this.pB, this.pC, wMove, null, this.pB); }
      blendPose(this.pA, this.pB, crouchPose, null, this.pA);
    }
    // ---- life: breathing, the body's mass on starts / stops, the weight shifting foot to foot at rest (under every stance / hold / one-shot: they weigh it out) —
    //      and the standing foot lock, which the stances / holds / lockpick weigh out the same way (they have the whole body) but of the one-shots only the KICK
    //      does: the flinch (Hit_Chest) and the cross (Punch_Cross) are upper-body clips and the throw re-plants the pose's own feet, so through those the planted
    //      soles stay where they are — let go with the rest of the layer, feet lagging the body by the usual 20-odd degrees skated 12 cm back under the pose at
    //      1.8 m/s on every flinch or throw after a turn (review #18; tools/qa/gait.ts transitions, the one-shot row: 126 mm → under a millimetre)
    { const body = (1 - wSt) * (1 - wHd) * (1 - wHe) * (1 - wLp);
      const hard = kt >= 0 || this.throwT >= 0 || this.hitT >= 0 || this.strikeT >= 0 ? 0 : 1;   // one-shots that have the body's life motion: eased in and out (rate 12), so the weight shift hands over instead of vanishing in a frame
      this.life.gate = damp(this.life.gate, hard, 12, dt);
      this.feet.gate = damp(this.feet.gate, kt >= 0 ? 0 : 1, 12, dt);                            // the lock's own gate: the kick alone (same easing, so a kick from rest poses exactly as it did)
      this.lifeLayer(dt, s, crouchPose, body * this.life.gate, body * this.feet.gate); }
    // ---- upper body layers ----
    const tgt = { relaxed: this.upper === 'relaxed' ? 1 : 0, aim: this.upper === 'aim' ? 1 : 0, torch: this.upper === 'torch' ? 1 : 0 };
    if ((this.shootT >= 0 || lgWant === 'shoulder') && wHd <= 0.003) { tgt.aim = 1; tgt.relaxed = 0; tgt.torch = 0; }   // (any hold layer up — either side, or mid-swap — keeps the two-hand aim clip out: a round fired past a held man is holdLayer's own kick of the gun hand; keying this off the EASED gun side let Pistol_Shoot blend in over the hold for ~0.1 s when E swapped gun→arm inside a shot — review finding)   // a long gun SHOULDERED is the aim whoever asked for the carriage (the player forces it whenever the rifle is in his hands): the aim clip's trunk under it — square, steady at a walk or a run — is what its blade / lean / head were tuned over, and what keeps the fore-end inside the support arm's reach on the move (over the run clip's own trunk, pumping ±25°, the hand came off it)
    if (this.throwT >= 0 && this.throwT < THROW_DUR - 0.25) tgt.aim = 0;   // the throwing arm has the upper body: the aim clip fades out under the wind-up (≈ 0.15 s at rate 14) and comes back up over the recovery
    this.upperW.relaxed = damp(this.upperW.relaxed, tgt.relaxed, 9, dt);
    this.upperW.aim = damp(this.upperW.aim, tgt.aim, 14, dt);
    this.upperW.torch = damp(this.upperW.torch, tgt.torch, 9, dt);
    if (this.upperW.relaxed > 0.003) { sampleClip(c.Pistol_Idle_Loop, this.idleT, true, this.pUpper); blendPose(this.pA, this.pUpper, this.upperW.relaxed, this.upperMask, this.pA); }
    if (this.upperW.torch > 0.003) { sampleClip(c.Idle_Torch_Loop, this.idleT, true, this.pUpper); blendPose(this.pA, this.pUpper, this.upperW.torch, this.upperMask, this.pA); }
    // ---- deliberate movement / the crouch's centre of gravity (legs, pelvis, torso, arms) — over the finished locomotion and its clip arms, under every stance,
    //      one-shot and aim layer below (they read the feet where this leaves them, and pose the arms over these when they have them)
    if (Dl > 0.002 || pace > 0.002 || soft > 0.002 || armsIn > 0.003) this.sneakLayer(Dl, pace, soft, armsIn, surge);
    // ---- procedural: stance body (pelvis blade, lean, head), then the kick (pelvis + legs), then the pistol carry arms — in that order so the hands are solved
    //      against the chest where it finally is. The wall hold has its own body and arms (wallBody / wallArms), sharing the stance weight by wl.
    if (wSt * (1 - wl) > 0.003) this.stanceBody(wSt * (1 - wl), s, wKstand);
    if (wSt * wl > 0.003) this.wallBody(wSt * wl);
    if (kt >= 0) this.kickBody(kt, wKbody);
    if (wCarry * (1 - wSt * wl) * (1 - wLg) > 0.003) this.carryArms(wCarry * (1 - wSt * wl), kt);   // (× (1 − wLg): skipped outright once a long gun is fully in the hands — the long-gun solve below poses over it either way)
    if (wLg * (1 - wWallArms) > 0.003) {   // the long gun: trunk set to the carriage (all but the aim layer's share: that comes on top of the aim clip's trunk, below; and short of the wall hold's body), then both arms onto the weapon (short of the wall hold's arms)
      this.longBody(wLg * (1 - wSt * wl) * (1 - this.upperW.aim), this.lg.run);
      if (this.upperW.aim < 0.995) this.longArms(wLg * (1 - wWallArms), kt, dt, false, this.upperW.aim <= 0.003);   // (fully on the aim, the pass after the aim clip poses the arms alone)
    }
    if (wWallArms > 0.003) this.wallArms(wWallArms);
    if (wLp > 0.003) this.lockpickLayer(wLp);
    if (wHd > 0.003) this.holdLayer(wHd, dt); else { this.hdKn.x = 0; this.hdKn.v = 0; }   // (a hold that begins finds the blade AT the throat station, whatever the last one ended on)
    if (wHe > 0.003) this.heldLayer(wHe, dt);
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
    if (this.upperW.aim > 0.003) {
      // pitch: blend aim down/neutral/up (assume ±45° extremes), remainder handled by twist
      const pn = clamp(this.aimPitch / (45 * Math.PI / 180), -1, 1);
      sampleClip(c.Pistol_Aim_Neutral, 0, false, this.pUpper);
      if (pn > 0.01) { sampleClip(c.Pistol_Aim_Up, 0, false, this.pB); blendPose(this.pUpper, this.pB, pn, null, this.pUpper); }
      else if (pn < -0.01) { sampleClip(c.Pistol_Aim_Down, 0, false, this.pB); blendPose(this.pUpper, this.pB, -pn, null, this.pUpper); }
      if (this.shootT >= 0) {
        sampleClip(c.Pistol_Shoot, this.shootT, false, this.pB);
        const w = this.shootT < 0.04 ? this.shootT / 0.04 : clamp(1 - (this.shootT - 0.3) / 0.3, 0, 1);
        blendPose(this.pUpper, this.pB, w, null, this.pUpper);
      }
      if (wLg <= 0) blendPose(this.pA, this.pUpper, this.upperW.aim, this.upperMask, this.pA);
      else {   // the rifleman: the aim clip's trunk and head as ever, its pistol ARMS only by what the long gun has not got of them (nothing, once it is in the hands) —
               // then the carriage's own trunk set and both arms solved onto the weapon afresh against the trunk the clip has just moved (torso + arms masks = upperMask node for node)
        blendPose(this.pA, this.pUpper, this.upperW.aim, this.torsoMask, this.pA);
        blendPose(this.pA, this.pUpper, this.upperW.aim * (1 - wLg), this.armsMask, this.pA);
        const gate = wLg * (1 - wHd) * (1 - wHe) * (1 - wLp);   // (yielding to the holds and lock work as the pass at the carry did by running before them, and to the wall hold: the trunk by its body's share, the arms by its arms')
        if (gate * (1 - wWallArms) > 0.003) { this.longBody(gate * (1 - wSt * wl) * this.upperW.aim); this.longArms(gate * (1 - wWallArms), kt, dt, true, true); }
      }
    }
    if (this.shootT >= 0) { this.shootT += dt; if (this.shootT > c.Pistol_Shoot.duration) this.shootT = -1; }   // (the shot's clock runs whether or not the aim clip shows it — the gun hold takes its recoil off it instead)
    if (this.sigT >= 0) { this.signalLayer(this.sigT); this.sigT += dt; if (this.sigT > SIGNAL_DUR[this.sigKind]) this.sigT = -1; }
    if (this.tellT >= 0) {   // the idle tells: skipped (the clock still runs out) under anything that has the arms or the head — a hold either way, lock work, the kick, a throw, the cross, a flinch, a reload, the two-hand aim coming up (CONTACT mid-tell), a signal ordered over it
      if (wHd > 0.003 || wHe > 0.003 || wLp > 0.003 || kt >= 0 || this.throwT >= 0 || this.strikeT >= 0 || this.hitT >= 0 || this.reloadT >= 0 || this.upperW.aim > 0.003 || this.sigT >= 0) this.tellShown = 0; else this.tellLayer(this.tellT);
      this.tellT += dt; if (this.tellT > TELL_DUR[this.tellK]) { this.tellT = -1; this.tellShown = 0; }
    }
    if (this.reloadT >= 0) {
      sampleClip(c.Pistol_Reload, this.reloadT, false, this.pB);
      const d = c.Pistol_Reload.duration; const w = clamp(Math.min(this.reloadT / 0.12, (d - this.reloadT) / 0.15), 0, 1);
      blendPose(this.pA, this.pB, w, this.upperMask, this.pA);
      this.reloadT += dt * (d / this.reloadDur); if (this.reloadT > d) this.reloadT = -1;   // retimed to the weapon's beat (reload(dur): 1.6 s for the pistol — what it always was — 2.4 for the SC-20K)
    }
    if (this.throwT >= 0) { this.throwLayer(this.throwT); this.throwT += dt; if (this.throwT > THROW_DUR) { this.throwT = -1; this.thrCarry = this.thrLast = null; } }
    if (this.strikeT >= 0) {
      sampleClip(c.Punch_Cross, this.strikeT, false, this.pB);
      const d = c.Punch_Cross.duration; const w = clamp(Math.min(this.strikeT / 0.05, (d - this.strikeT) / 0.15), 0, 1);
      blendPose(this.pA, this.pB, w, this.upperMask, this.pA);
      this.strikeT += dt * 1.15; if (this.strikeT > d) this.strikeT = -1;
    }
    if (this.hitT >= 0) {
      sampleClip(c.Hit_Chest, this.hitT, false, this.pB);
      const w = clamp(1 - Math.abs(this.hitT / c.Hit_Chest.duration - 0.3) / 0.7, 0, 1) * 0.8;
      blendPose(this.pA, this.pB, w, this.upperMask, this.pA);
      this.hitT += dt; if (this.hitT > c.Hit_Chest.duration) this.hitT = -1;
    }
    // kick clock (impact flag is for this one FRAME: a zero-dt re-bake of the pose within it — game.ts after a leaf shoved him, the probes' pose refresh — advances
    // nothing and must not eat an impact the frame's real step raised before its reader got to it; review B7.8)
    if (dt > 0) { this.kickHit = false; if (kt >= 0) { const nt = kt + dt; this.kickHit = kt < KICK_IMPACT && nt >= KICK_IMPACT; this.kickT = nt > KICK_DUR ? -1 : nt; } }
    this.lpT += dt;
    // ---- the whole-body ACTION clip (act — game/civilians.ts: seated at a desk, kneeling at a bin, on the phone), over everything above with its eased weight;
    //      not so much as looked at for a figure that has none and never had (every guard, Sam): their pose is what it was, to the bit
    let wAct = 0;
    if (this.act || this.actW > 0) wAct = this.actLayer(dt);
    this.pose.copy(this.pA);
    // ---- procedural twists ----
    this.twists.length = 0;
    // Gaze stabiliser (head level and steady while the body works under it — the vestibular reflex the clips lack): the crouch and run clips look 34° at the
    // floor and the run swings the head 10° side to side; measured off the finished pose, the neck (40 %) and head (60 %) take GAZE_KEEP of the pitch error
    // toward a per-gait target elevation and damp the yaw wobble against a ½ s reference of itself (slow, meant head turns pass; the bob does not). Out of
    // the way of everything that poses the head on purpose: stances, the holds, the kick / throw / hit one-shots, the aim clip, death.
    { const wantW = (1 - wSt) * (1 - wHd) * (1 - wHe) * (1 - wLp) * (1 - this.upperW.aim) * (1 - wAct) * (kt >= 0 || this.throwT >= 0 || this.hitT >= 0 || this.strikeT >= 0 || this.reloadT >= 0 || this.tellT >= 0 ? 0 : 1);   // (the lockpick's look at the keyway, the reload's glance at the gun and the tells' look at the watch / into the stretch are authored looks: left alone; so is an action clip's seated / kneeling head)
      this.gz.w = damp(this.gz.w, wantW, 10, dt);
      if (this.gz.w > 0.01) {
        const fk = this.fk.run(this.pA); const g = quat.rotate(fk.rot[nd.head], this.gazeLocal);
        const el = Math.asin(clamp(g[1], -1, 1)), gyaw = Math.atan2(g[0], g[2]);
        const targetEl = -(GAZE_EL.stand + (GAZE_EL.crouch - GAZE_EL.stand) * crouchPose + (GAZE_EL.sprint - GAZE_EL.stand) * wSprint * (1 - crouchPose)) * DEGR;
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
    const look = this.lookYawExtra + headKeep;   // (y / p: the chest twist, worked out above the door hand — doorLayer inverts exactly these; headKeep: the share of it the door hand took off the chest, kept on the neck)
    this.twists.push({ node: nd.spine1, yaw: y * 0.25, pitch: 0 });
    this.twists.push({ node: nd.spine2, yaw: y * 0.35, pitch: 0 });
    this.twists.push({ node: nd.spine3, yaw: y * 0.40, pitch: -p * 0.35 });
    if (Math.abs(look) > 1e-3) { this.twists.push({ node: nd.neck, yaw: look * 0.4, pitch: 0 }); this.twists.push({ node: nd.head, yaw: look * 0.6, pitch: 0 }); }
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
    return w;
  }
  /** seconds into the action clip now playing (0 with none) — the probes, and a caller timing a one-shot such as 'Interact' */
  get actTime(): number { return this.actClip ? this.actT : 0; }

  // ================================================================ procedural layers
  // Conventions (see skeleton.ts): everything is posed in the un-twisted model space of the local pose (+Z the figure's front, +X its left, +Y up); the aim /
  // look twists are applied afterwards by the SkeletonInstance and turn these layers with the chest like they turn the clips. Body offsets are added straight
  // into pA scaled by the layer weight (a rotation × w is still a rotation); limbs that must reach a point are IK-solved on a copy and blended in through a mask.

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
    if (replant) { fk.run(pA); fL = v3.copy(fk.pos[nd.footL]); fR = v3.copy(fk.pos[nd.footR]); rL = [...fk.rot[nd.footL]] as Quat; rR = [...fk.rot[nd.footR]] as Quat; }
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
      fk.run(pA);
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL!, this.kneePole(rL!), 0.6, rL!);
      twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR!, this.kneePole(rR!), 0.6, rR!);
    }
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
      const fk = this.fk; fk.run(pose); const K = this.runK, m = this.jogMid;
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const tgt = (f: Vec3): Vec3 => [f[0], f[1] * lerp(1, K, 0.5), m + (f[2] - m) * K];
      twoBoneIK(fk, pose, nd.thighL, nd.shinL, nd.footL, tgt(fL), this.kneePole(rL), 0, rL);
      twoBoneIK(fk, pose, nd.thighR, nd.shinR, nd.footR, tgt(fR), this.kneePole(rR), 0, rR);
    }
  }
  /** The sprint clip as the game shows it: its stride warped at the ankles about the gait's middle by SPRINT_WARP.stride — the fraction of its ~8 m/s bound
   *  that the 4.7 m/s it is played at covers, so the planted foot holds the floor at the clip's own cadence — heights eased half way with it (as the jog's
   *  are) but about the ankles' floor rather than the ground plane, so the stance foot keeps the clip's height instead of sinking a few centimetres further;
   *  soles and knee planes as authored. Applied to the sprint pose before it blends with the (jog-shaped) run. */
  private sprintShape(pose: Pose) {
    const K = SPRINT_WARP.stride; if (K > 0.999) return;
    const nd = this.nodes, fk = this.fk; fk.run(pose); const m = this.sprintMid, y0 = this.sprintFloorY, Ky = lerp(1, K, 0.5);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const tL0 = fk.pos[nd.toeL][1] - fL[1], tR0 = fk.pos[nd.toeR][1] - fR[1];   // toe height off the ankle as authored this frame (the foot's pitch is kept, so this carries over)
    const tgt = (f: Vec3, toeOff: number): Vec3 => { let y = y0 + (f[1] - y0) * Ky; if (y + toeOff < TOE_FLOOR_Y) y = TOE_FLOOR_Y - toeOff; return [f[0], y, m + (f[2] - m) * K]; };   // (never an ankle so low its toe goes through the floor — the clip's stance foot points down and its eased height used to bury the toe 5 cm at 4.7 m/s)
    twoBoneIK(fk, pose, nd.thighL, nd.shinL, nd.footL, tgt(fL, tL0), this.kneePole(rL), 0, rL);
    twoBoneIK(fk, pose, nd.thighR, nd.shinR, nd.footR, tgt(fR, tR0), this.kneePole(rR), 0, rR);
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
    const nd = this.nodes, fk = this.fk; fk.run(pose);
    for (const [thigh, shin, foot] of [[nd.thighL, nd.shinL, nd.footL], [nd.thighR, nd.shinR, nd.footR]] as const) {
      const ph = fk.pos[thigh], pk = fk.pos[shin], pa = fk.pos[foot];
      const L = v3.dist(ph, pk) + v3.dist(pk, pa), d = v3.dist(ph, pa), r = d / L;
      if (r <= SOFT_KNEE.from) continue;
      const span = SOFT_KNEE.to - SOFT_KNEE.from, x = (r - SOFT_KNEE.from) / span;
      const rEased = SOFT_KNEE.from + span * (1 - Math.exp(-x));                 // slope 1 at `from`, → `to` asymptotically
      const rNew = r + (rEased - r) * w;
      const ar = [...fk.rot[foot]] as Quat;
      const tgt: Vec3 = [ph[0] + (pa[0] - ph[0]) * rNew / r, ph[1] + (pa[1] - ph[1]) * rNew / r, ph[2] + (pa[2] - ph[2]) * rNew / r];
      twoBoneIK(fk, pose, thigh, shin, foot, tgt, this.kneePole(ar), 0, ar);
      fk.run(pose);
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
    fk.run(pA);
    const legs: [number, number, number, number, number, { dev: number; pz: number }][] = [[nd.thighL, nd.shinL, nd.footL, nd.toeL, lerp(g.jog.cL, g.sprint.cL, wSprint), this.plantL], [nd.thighR, nd.shinR, nd.footR, nd.toeR, lerp(g.jog.cR, g.sprint.cR, wSprint), this.plantR]];
    for (const [thigh, shin, foot, toe, c, st] of legs) {
      let x = ph - c; x -= Math.round(x);            // −½ ‥ ½ about this foot's mid-stance
      const w = bump(x, R.on[0], R.on[1], R.off[0], R.off[1]) * wRun;
      const tp = fk.pos[toe];
      const miss = Number.isFinite(st.pz) ? dz - (tp[2] - st.pz) : 0; st.pz = tp[2];   // what the cycle's toe did this frame beyond the ground's own travel (a jump of 20 cm+ is a phase someone reset, not motion: let it go)
      st.dev = clamp((st.dev + (Math.abs(miss) < 0.2 ? miss : 0) * w) * Math.exp(-(1 - w) * dt / Math.max(R.bleed, 1e-3)), -0.25, 0.25);   // (bleed 0 = gone within the frame; the max() keeps w = 1, bleed = 0 off 0/0)   // holds the ground by w; what it is left holding as the toe comes off bleeds away up the swing
      if (w < 1e-3 && Math.abs(st.dev) < 5e-4) { st.dev = 0; continue; }
      const ap = fk.pos[foot], ar = [...fk.rot[foot]] as Quat;
      twoBoneIK(fk, pA, thigh, shin, foot, [ap[0], ap[1] - (tp[1] - TOE_FLOOR_Y) * w, ap[2] + st.dev], this.kneePole(ar), 0, ar);   // the ankle that puts the toe at [x, floor + (y − floor)·(1 − w), z + dev], sole unchanged — floored to the sole's level, not through it
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
    { const pp = L.prevPos, P0 = this.posIn; if (!Number.isFinite(pp[0])) { L.prevPos = v3.copy(P0); } else { const d = Math.hypot(P0[0] - pp[0], P0[2] - pp[2]); teleported = d > 0.5; L.rootV = dt > 0 && !teleported ? damp(L.rootV, Math.min(d / dt, 8), 14, dt) : teleported ? 0 : L.rootV; L.prevPos = v3.copy(P0); } }
    L.exert = clamp(L.exert + (s > 3.2 ? dt / 4 : -dt / 8), 0, 1);
    const bRate = lerp(LIFE.breathRate, LIFE.breathRateRun, L.exert), bAmp = lerp(LIFE.breathAmp, LIFE.breathAmpRun, L.exert) * lerp(1, 0.35, clamp(s / 2, 0, 1)) * LIFE.on;   // running, the gait's own motion carries the chest
    L.breath = (L.breath + dt * bRate * 2 * Math.PI) % (2 * Math.PI);
    const accel = dt > 0 ? (s - L.prevS) / dt : 0; L.prevS = s; L.accel = damp(L.accel, clamp(accel, -12, 12), 10, dt);
    L.mass.step(clamp(-L.accel * LIFE.massGain, -LIFE.massBack, LIFE.massFwd) * LIFE.on, 9, dt);            // fore-aft pelvis offset target: back under acceleration, forward (carrying on) under braking
    L.massV.step(clamp(-Math.abs(L.accel) * LIFE.massDip, -LIFE.massDipMax, 0) * LIFE.on, 10, dt);   // and a dip either way
    L.stillT = s < 0.12 && Math.abs(L.yawRate) < 0.5 ? L.stillT + dt : 0;
    const resting = L.stillT > LIFE.restAfter && LIFE.on > 0 ? 1 : 0;
    if (resting) { L.shiftT -= dt; if (L.shiftT <= 0) { L.shiftSide = L.shiftSide > 0 ? -1 : 1; L.shiftN++; L.shiftT = LIFE.shiftMin + ((L.shiftN * 0.618034) % 1) * LIFE.shiftSpan; } }   // (4–9 s, a golden-ratio sequence: irregular but deterministic)
    L.shift.step(resting * L.shiftSide, resting ? LIFE.shiftIn : LIFE.shiftOut, dt);          // −1 … +1: over the left / right foot (eases over ~0.8 s, snaps back out in ~0.25 s when he moves)
    if (wF < 0.003) this.feet.w = 0;        // the LOCK gated out (a stance / hold has the body, or the kick the legs): released here so that coming back it re-locks where the feet ARE, not where they stood before the hold walked off with him
    if (w < 0.003 && wF < 0.003) return;    // …and the life motion with it: nothing to pose, nothing to hold
    // remember the feet, pose the body, put the feet back
    fk.run(pA); const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
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
      fk.run(pA);
    }
    // ---- feet: planted in the WORLD while he stands (the pose's own spots, fL / fR, are where each foot WANTS to be; a locked foot stays where it was put
    //      down until the body has turned or shifted out from over it, then steps across in a lifted 0.22 s arc — one foot at a time), released into the
    //      cycle's feet as he moves off. Model ↔ world through the controller's pos / yaw fed in this frame.
    const F = this.feet; const standing = Math.max(s, L.rootV) < 0.22 && wF > 0.5 && FEET.on > 0.5 ? 1 : 0;   // (a body being lunged half a metre with speed 0 is not standing)
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
    const poleW = 0.6 * F.w;
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tL, this.kneePole(qL), poleW, qL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tR, this.kneePole(qR), poleW, qR);
  }
  private sneakLayer(Dl: number, pace: number, soft: number, armsIn: number, surge: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, S = SNEAK;
    const K = (1 + S.stride * Dl) * (1 + S.paceStride * pace);
    const drop = S.drop * Dl + S.paceDrop * pace + S.softDrop * soft;
    const tip = drop * 25 * DEGR;                                                    // ≈ 1.75° at 7 cm
    const lean = (S.lean * Dl + S.paceLean * pace) * DEGR * (1 - this.upperW.aim);
    if (K > 1.0005 || drop > 2e-4 || Math.abs(surge) > 2e-4) {
      fk.run(pA);
      const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
      const m = this.gait.mid; const tgt = (f: Vec3): Vec3 => [f[0], f[1], m + (f[2] - m) * K + surge];
      this.shift(pA, nd.hips, [0, -drop, surge]); if (tip > 1e-5) this.turn(pA, nd.hips, qPitch(tip));
      fk.run(pA);   // feet: where the cycle had them but for the longer stride and the surge, soles as they were, in the clip's own knee plane (pole weight 0: at no stride / drop / surge this is the identity, so the layer fades to exactly nothing)
      twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tgt(fL), this.kneePole(rL), 0, rL);
      twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tgt(fR), this.kneePole(rR), 0, rR);
    }
    if (lean + tip > 1e-5) {
      this.turn(pA, nd.spine1, qPitch(lean * 0.45)); this.turn(pA, nd.spine2, qPitch(lean * 0.35)); this.turn(pA, nd.spine3, qPitch(lean * 0.2));   // hips lead, chest follows
      const unl = lean + tip; this.turn(pA, nd.neck, qPitch(-unl * 0.4)); this.turn(pA, nd.head, qPitch(-unl * 0.6));                          // …and the head comes level back out of all of it
    }
    if (armsIn > 0.003) {
      pB.copy(pA); fk.run(pB);
      const cr = clamp(this.crouch, 0, 1), r = clamp(this.upperW.relaxed, 0, 1), k = lerp(0.5, 1, cr);
      const pR0 = v3.copy(fk.pos[nd.handR]), pL0 = v3.copy(fk.pos[nd.handL]); const rR0 = [...fk.rot[nd.handR]] as Quat, rL0 = [...fk.rot[nd.handL]] as Quat;
      const gunR = v3.add(pR0, v3.lerp(S.gunInStand, S.gunIn, cr));
      const freeR: Vec3 = [pR0[0] + Math.min(S.handIn, Math.max(0, -pR0[0])) * k, pR0[1] - 0.02 * k, pR0[2] - 0.03 * k];   // (the right hand lives at −x: in = toward the middle, never past it)
      const freeL: Vec3 = [pL0[0] - Math.min(S.handIn, Math.max(0, pL0[0])) * k, pL0[1] - 0.02 * k, pL0[2] - 0.03 * k];
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(freeR, gunR, r), v3.lerp([-0.05, 0.4, -1], [-0.12, -1, -0.5], r), lerp(0.35, 0.7, r), rR0);   // elbow: back and a shade out hanging; down and in on the gun
      const gunL = v3.add(fk.pos[nd.handR], v3.sub(pL0, pR0));                                                                                                // the support hand rigid with wherever the gun hand actually got to
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.lerp(freeL, gunL, r), v3.lerp([0.05, 0.4, -1], [0.2, -1, -0.35], r), lerp(0.35, 0.7, r), rL0);
      blendPose(pA, pB, clamp(armsIn, 0, 1), this.armsMask, pA);
    }
  }

  /** Both arms onto the pistol: the right (gun) hand at chest + [side, up, fwd] (model axes), the muzzle at `pitch` and level in roll, the left hand keeping the
   *  exact hold it has in Pistol_Aim_Neutral (both hands are moved by one rigid transform of the clip's grip, so the support hand never leaves the gun); elbows
   *  swivelled down-and-in by `tuck`. Solved on a copy seeded with the aim clip's shoulders / hands / fingers, blended in through the arms mask. A little sway
   *  and, during a kick, a pump of the gun toward the chest keep it from reading as a still. */
  private carryArms(w: number, kickT: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, st = this.st, fk = this.fk, t = this.idleT;
    pB.copy(pA); blendPose(pB, this.pAim, 1, this.armsMask, pB);   // current body, aim-clip arms
    fk.run(pB);
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
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, pL, [0.2 + 0.6 * (1 - tuck), -1, -0.35], 0.4 + 0.5 * tuck, quat.mul(D, rL0));   // (the support arm reaches across, so its elbow sits a little wider)
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
  /** The long gun, trunk half (weight w): the upper spine bladed toward the gun and taken back out at the neck, a lean spread hips-first with the head levelled out of
   *  it, and the head set to the stock — the carriage channels' current values (LONG), straight into pA. Runs before longArms so the shoulders are where the arms
   *  will be solved from. `run` (the pose's jog + sprint share, the carry pass only): a figure that steadies its long gun (longSteady) first has the run clip's pumping
   *  of the shoulder line — measured off the pose, ±25° with the arms that drive it — taken LONG_STEADY.runYaw of the way back out down the spine, so the shoulders
   *  stay on the weapon both hands hold and the legs do the running (the walk's few degrees are its own and stay). */
  private longBody(w: number, run = 0) {
    if (w < 0.003) return;
    const pA = this.pA, nd = this.nodes, ch = this.lg.ch;
    const hold = run * clamp(this.longSteady, 0, 1) * LONG_STEADY.runYaw * w;
    if (hold > 0.003) {
      const fk = this.fk.run(pA); const a = fk.pos[nd.upperArmL], b = fk.pos[nd.upperArmR];
      const sy = Math.atan2(b[2] - a[2], a[0] - b[0]) * hold;   // the shoulder line's yaw off square (+ = turned to the figure's left), the share of it to take out
      if (Math.abs(sy) > 1e-4) { this.turn(pA, nd.spine1, qYaw(-sy * 0.3)); this.turn(pA, nd.spine2, qYaw(-sy * 0.35)); this.turn(pA, nd.spine3, qYaw(-sy * 0.35)); }
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
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, ch = this.lg.ch, t = this.idleT, G = this.longGrip;
    pB.copy(pA); blendPose(pB, this.pAim, 1, this.armsMask, pB);   // current body, the aim clip's clavicles / trigger grip / fingers to start from
    fk.run(pB);
    const chest = v3.copy(fk.pos[nd.spine3]);
    const pR0 = v3.copy(fk.pos[nd.handR]); const rR0 = [...fk.rot[nd.handR]] as Quat;
    const g0 = v3.normalize(v3.sub(fk.pos[nd.middle1R], pR0));   // the clip's bore as posed on this spine (Character.gunDir's definition: wrist → middle finger)
    // the bore, model space
    const sway = ch[LC.sway].x, a = this.upperW.aim;
    const yaw = (ch[LC.yaw].x + 0.6 * sway * Math.sin(t * 1.1)) * DEGR;
    const pitch = clamp((ch[LC.pitch].x + 0.8 * sway * Math.sin(t * 1.7 + 1.1)) * DEGR + this.aimPitch * (ch[LC.aimK].x - 0.35 * a), -1.35, 1.35);
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
    { const py = lerp(LONG_PIVOT[1], anchor[1] - chest[1], kA), pz = lerp(LONG_PIVOT[2], anchor[2] - chest[2], kA);   // the swing's pivot: between the shoulders … the gun shoulder itself
      const th = this.aimPitch * ch[LC.aimK].x, ry = off[1] - py, rz = off[2] - pz;                       // about it: up with the muzzle raised, down and back with it lowered
      off[1] = py + ry * Math.cos(th) + rz * Math.sin(th); off[2] = pz - ry * Math.sin(th) + rz * Math.cos(th);
      const ph = -0.35 * this.aimPitch * a, oy = off[1], oz = off[2];                                       // less the twist's tilt of the whole trunk about the chest joint
      off[1] = oy * Math.cos(ph) + oz * Math.sin(ph); off[2] = -oy * Math.sin(ph) + oz * Math.cos(ph); }
    let pR: Vec3 = v3.add(chest, off);
    if (kick > 0) pR = v3.mad(pR, d, -LONG_KICK_BACK * kick);
    const poleR: Vec3 = [ch[LC.elbowR].x, ch[LC.elbowR + 1].x, ch[LC.elbowR + 2].x], poleL: Vec3 = [ch[LC.elbowL].x, ch[LC.elbowL + 1].x, ch[LC.elbowL + 2].x], pw = clamp(ch[LC.poleW].x, 0, 1);
    const rL = this.handRot(0, inGun(G.fingers), inGun(G.back));
    const solve = (at: Vec3): Vec3 => {   // → how far the support hand fell short of its point (zero when it reached)
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, at, poleR, pw, rR);
      const pL = v3.add(fk.pos[nd.handR], inGun(G.wrist));   // from where the trigger hand actually got to
      twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, pL, poleL, pw, rL);
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
    fk.run(pA);
    const hips = fk.pos[nd.hips];
    const backOff = lerp(lerp(P.back[0], P.back[1], cr), P.back[2], 1 - park);       // hips joint off the plane
    const out = v3.dot(hips, n) - (-WALL_ROOT_OFF + backOff);                        // + = further out in the room than wanted
    const drop = lerp(P.drop[0], P.drop[1], cr) + 0.006 * (1 - park) * (1 - Math.cos(this.phase * 4 * Math.PI));   // (a touch of bob on the move, twice a cycle)
    this.shift(pA, nd.hips, v3.add(v3.add(v3.scale(n, -out * w), [0, -drop * w, 0]), v3.scale(tr, s * K.shift * e * w)));
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
      const el = Math.asin(clamp(g[1], -1, 1)); const dpitch = (el + P.headPitch * DEGR) * hw;   // + = look further down
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
    const mv = (1 - park) * w;   // the sidle's share: how much the narrowing applies
    const footTarget = (right: boolean, fClip: Vec3, rClip: Quat, rIdle: Quat, yIdle: number): { p: Vec3; r: Quat } => {
      const lw = right ? u : 1 - u;                                     // how much this foot is the lead foot right now
      const L = spot(true, right), T = spot(false, right);
      const p = v3.lerp(T.p, L.p, lw); const yawRel = lerp(T.yaw, L.yaw, lw);
      const onToes = cr * (1 - lw) * F.trailHeel;                      // the crouched trail foot keeps a share of the crouch clip's raised heel (his weight is back on the wall); a lead foot, and any standing foot, is flat (the idle's sole)
      p[1] = lerp(yIdle, fClip[1], onToes) + 0.04 * (1 - s * s) * ((ws.side.v > 0) === right ? 1 : 0.25) + 0.08 * park * (1 - park) * (0.4 + 0.6 * lw);   // (mid-flip: the foot about to lead steps, the other shuffles; settling onto the spots from the cycle: a low step, the lead foot's the clearer)
      const base = quat.nlerp(rIdle, rClip, onToes);
      const fwd = quat.rotate(base, AY); const yaw0 = Math.atan2(fwd[0], fwd[2]);   // the foot bone's +Y runs heel → toes
      const r = quat.normalize(quat.mul(qYaw(wrapAngle(ny + yawRel - yaw0)), base));
      const k = park * w;
      let q = v3.lerp(fClip, p, k);
      if (mv > 1e-4) { const offC = v3.dot(q, n) + WALL_ROOT_OFF; q = v3.mad(q, n, (P.slide.line + (offC - WALL_ROOT_OFF) * P.slide.narrow - offC) * mv); }   // sidling: the footfall pulled toward the slide line — across the wall only, its travel along it untouched
      const into = -WALL_ROOT_OFF + 0.11 - v3.dot(q, n);                          // the wall stops a heel: a footfall of the turned cycle that would swing through the face slides along it instead (ankle ≥ 11 cm proud: the heel is 6 behind it)
      return { p: into > 0 ? v3.mad(q, n, into * w) : q, r: quat.nlerp(rClip, r, k) };
    };
    const tL = footTarget(false, fL, rL, I.rL, I.L[1]), tR = footTarget(true, fR, rR, I.rR, I.R[1]);
    fk.run(pA);
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, tL.p, this.kneePole(tL.r), 0.6, tL.r);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, tR.p, this.kneePole(tR.r), 0.6, tR.r);
  }

  /** The wall hold, arms (weight w through the arms mask), against the body wallBody left. The hands are always free here (the game holsters the pistol for the
   *  hold): both palms flat back against the wall 'feeling' it, a little behind the body line either side of the hips at hip height — the wrists IK'd ONTO the
   *  plane WALL_POSE.hands.off proud of it, ± hands.along from the hips joint, so they slide along the plaster with him and go with a peek's carried pelvis —
   *  fingers down and a little out along the wall, spread flat; elbows soft, poled out along the wall and a touch into the room (never into it). The two arms are
   *  one description mirrored, so a flip of side moves nothing; a peek draws the lead hand in a little (hands.peekIn) so its palm stays on the plaster short of
   *  the corner he leans past. Solved from the arms as the locomotion has them (clavicles and all), so the way in and out is a plain blend. */
  private wallArms(w: number) {
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, ws = this.wst, P = WALL_POSE, H = P.hands, E = P.elbow;
    const cr = clamp(this.crouch, 0, 1), s = clamp(ws.side.x, -1, 1), pk = clamp(ws.peek.x, 0, 1), e = pk * pk * (3 - 2 * pk);
    const ny = this.wallYaw; const n: Vec3 = [Math.sin(ny), 0, Math.cos(ny)], tr: Vec3 = [-n[2], 0, n[0]];   // wall normal (into the room) and his right along the wall, model space
    pB.copy(pA); fk.run(pB);
    const hips = fk.pos[nd.hips]; const hx = hips[0], hy = hips[1] + lerp(H.up, H.upCrouch, cr), hz = hips[2];
    const along0 = lerp(H.along, H.alongCrouch, cr);
    for (const side of [0, 1] as const) {   // 0 = left, 1 = right
      const sg = side ? 1 : -1;              // tr is his right: the right hand goes +tr, the left −tr
      const along = along0 - H.peekIn * e * (side ? 1 + s : 1 - s) / 2;   // (the lead side's hand — the right's share of leading is (1 + s) / 2 — comes in with the peek)
      const p: Vec3 = [hx + tr[0] * sg * along, hy, hz + tr[2] * sg * along];
      const onto = (-WALL_ROOT_OFF + H.off) - v3.dot(p, n); p[0] += n[0] * onto; p[2] += n[2] * onto;   // carried square onto the plane, the wrist `off` proud of it (the palm lies on the face)
      const r = this.handRot(side, [tr[0] * sg * H.out, -1, tr[2] * sg * H.out], n);                    // fingers down and out along the wall, back of the hand to the room
      const pole: Vec3 = [tr[0] * sg * E.out + n[0] * E.room, -E.down, tr[2] * sg * E.out + n[2] * E.room];
      if (side) twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, p, pole, 0.9, r); else twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, p, pole, 0.9, r);
      this.hand(pB, side, [0.05, 0.06, 0.08, 0.12], 0.1, 0.5);   // flat and a little spread on the wall
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
    const e = smoothstep(0, 0.24, t); const far = clamp(Math.hypot(KP[0] - FP[0], KP[2] - FP[2]) / 0.2, 0, 1);
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
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, wrench, [0.3, -1, -0.45], 0.75, rotL);
    this.hand(pB, 1, [0.55, 0.7, 0.9, 0.95], 0.75);   // pick pinched between thumb and index, the rest folded
    this.hand(pB, 0, [0.75, 0.8, 0.85, 0.85], 0.6);   // wrapped round the wrench
    blendPose(pA, pB, w, this.armsMask, pA);
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
      S.reachOK = S.reachOK ? d < 0.585 && d > 0.16 && ahead > 0.02 : d < 0.56 && d > 0.2 && ahead > 0.06;   // (nor with the shoulder itself on the leaf: no arm pushes from inside a hand's length)
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
    const ck = ph === 'choke' && !gunV ? smoothstep(0, K.secs.choke * 0.75, t) : 0;           // the elbow closing
    const kn = clamp(this.hdKn.step(ph === 'choke' ? 1 : 0, ph === 'choke' ? 6 / N.offSecs : 3 / N.offSecs, dt), 0, 1);   // the blade coming off him for the choke (and back, slower, off an aborted one) — never on in a gun hold, which has no choke
    const fight = kn * (ph === 'choke' ? 1 - smoothstep(F.fadeFrom, F.fadeTo, t / K.secs.choke) : 1);                  // what Sam braces against: the man's fight (heldLayer's envelope, near enough), spent as he goes — carried on kn so easing off lets it down gently
    const wnd = ph === 'whip' ? smoothstep(0, WHIP_WIND, t) : 0;                                                     // the whip: cocked back (and it stays cocked under the strike's blend: wind → hit is one straight whip of the hand)…
    const stk = ph === 'whip' ? (t < WHIP_STRIKE ? 0 : hermite(t, WHIP_STRIKE, 0, 0, K.secs.whip, 1, 7)) : 0;      // …brought down, ARRIVING fast (≈ 2 m/s at the bone)…
    const thru = ph === 'whip' ? smoothstep(K.secs.whip, K.secs.whip + WHIP_THRU, t) : 0;                            // …and on through as he drops (the layer lets go after it)
    // ---- body English straight into pA: lean over the three spine joints (hips lead), head yaw / pitch on neck + head, levelled back out of the lean; the gun hold
    //      keeps less chest on him, its whip loads the chest back then brings it through; the arm hold sways a couple of degrees against the choke's fight
    const eBody = smoothstep(0.15, 0.9, ug);
    const lean = lerp(lerp(K.lean, G.lean, gv), K.chokeLean, ck) * DEGR * w * eBody;
    const brace = K.brace * Math.sin(this.idleT * 2 * Math.PI * F.hz[2] + 0.7) * fight * DEGR * w;   // (nothing unless the choke is on: fight rides kn)
    const side = lerp(N.side, G.side, gv) * DEGR * w * eBody + brace;   // (+ roll = left shoulder up = the head carried out to the right)
    const yawB = (G.windYaw * wnd * (1 - stk) + G.hitYaw * (stk - thru)) * DEGR * w;   // (the whip's: zero the rest of the time)
    this.turn(pA, nd.spine1, quat.mul(qYaw(yawB * 0.3), qPitch(lean * 0.45))); this.turn(pA, nd.spine2, quat.mul(qYaw(yawB * 0.35), quat.mul(qRoll(side * 0.4), qPitch(lean * 0.35)))); this.turn(pA, nd.spine3, quat.mul(qYaw(yawB * 0.35), quat.mul(qRoll(side * 0.6), qPitch(lean * 0.2))));
    const hy = lerp(N.headYaw, G.headYaw, gv) * DEGR * w * eBody - yawB, hp = (lerp(K.headPitch, G.headPitch, gv) * DEGR - lean) * w * eBody;   // (the head stays where it looks while the chest loads and comes through under it)
    this.turn(pA, nd.neck, quat.mul(qRoll(side * 0.8 - brace), quat.mul(qYaw(hy * 0.4), qPitch(hp * 0.4)))); this.turn(pA, nd.head, quat.mul(qRoll(-side * 0.9), quat.mul(qYaw(hy * 0.6), qPitch(hp * 0.6))));   // (the head un-tips itself: eyes level, out beside his — and rides the bracing sway out)
    this.turn(pA, nd.shoulderL, qRoll(5 * DEGR * w * eBody)); this.turn(pA, nd.shoulderR, qRoll(-lerp(N.clav * (1 - 0.6 * kn), G.clav + 4 * wnd * (1 - stk), gv) * DEGR * w * eBody));   // the choking shoulder comes up and round; the weapon arm's clavicle up with it (less once the knife hand is down on his shoulder)
    // ---- arms on a copy, against the body as it now is
    pB.copy(pA); fk.run(pB);
    const liveL = v3.copy(fk.pos[nd.handL]), liveR = v3.copy(fk.pos[nd.handR]); const rL0 = [...fk.rot[nd.handL]] as Quat, rR0 = [...fk.rot[nd.handR]] as Quat;
    const limp = ph === 'choke' && !gunV ? smoothstep(0.62 * K.secs.choke, 0.95 * K.secs.choke, t) : 0;   // (the man's own going-limp clock, heldLayer's: as his knees give the arm goes down with him — it is what holds him up)
    const give: Vec3 = [0, -(K.sag[1] - K.sag[0]) * limp, 0.025 * limp];
    const holdL = v3.add(v3.lerp(K.throat, K.tight, ck), give), holdR = v3.add(v3.lerp(N.hand, N.offHand, kn), give);   // (the knife hand: at his throat ↔ down on his shoulder)
    let tgtL: Vec3, tgtR: Vec3;
    if (ph === 'grab') {   // round the outside of him and on: the left leads (0 → 0.75 of the reach), the right follows (0.2 → 1)
      const uL = smoothstep(0, 0.75, ug), uR = smoothstep(0.2, 1, ug);
      tgtL = curve3(uL, [[0, liveL], [0.4, K.viaL], [0.72, K.overL], [1, holdL]]); tgtR = curve3(uR, [[0, liveR], [0.55, N.via], [1, holdR]]);
    } else { tgtL = holdL; tgtR = holdR; }
    // hands: the left's fingers run on across the throat to his right and hook back round it, palm to the neck (back of the hand forward); the right is the fist round
    // the knife's handle, turned so the blade out of its thumb side lies where the station wants it (knifeRot)
    const rotHoldL = this.handRot(0, [-1, 0.12, -0.4], [0.1, 0.35, 1]);
    const eL = ph === 'grab' ? smoothstep(0.1, 0.7, ug) : 1, eR = ph === 'grab' ? smoothstep(0.3, 0.95, ug) : 1;
    const rotL = quat.nlerp(rL0, rotHoldL, eL);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tgtL, [0.55, 0.25, 0.85], 0.95 * eL, rotL);   // elbow forward and a little left, up on his left collarbone: the upper arm over his shoulder, the forearm level across the throat
    const open = 1 - (ph === 'grab' ? smoothstep(0.5, 1, ug) : 1);   // fingers close as the hands arrive
    const cl = (a: number) => lerp(a, 0.08, open);
    this.hand(pB, 0, [cl(0.5), cl(0.58), cl(0.64), cl(0.68)], lerp(0.55, 0.1, open), open * 0.4);
    // ---- the right hand: the knife fist below gv ½, the gun hand above — one or the other from a grab's first frame; between only for the beat of a hand-over
    //      (see above): xg cross-fades the two arm solves through the middle, backK / backG say how far each grip is withdrawn toward the hand-over point
    const xg = smoothstep(0.3, 0.7, gv);
    const backK = ph === 'grab' ? 0 : smoothstep(0, 0.55, gv), backG = ph === 'grab' ? 0 : 1 - smoothstep(0.45, 1, gv);   // (a grab reaches in along its own variant's path: nothing to withdraw)
    if (xg < 1) {   // the knife fist
      const eRk = ph === 'grab' ? smoothstep(0.5, 1, ug) : 1;   // the fist keeps the blade pointing ahead (out of the hanging hand's thumb side) round the outside of him, and only turns it across once it is coming in over the shoulder — in front of his face, never through the side of his head
      const rotR = quat.nlerp(rR0, quat.nlerp(this.knifeRot(N.blade, N.back), this.knifeRot(N.offBlade, N.offBack), kn), eRk);
      twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.lerp(tgtR, N.via, backK), v3.lerp([-0.9, 0.15, -0.4], [-0.8, -0.55, -0.3], kn), 0.9 * Math.max(eR, 0.3), rotR);   // elbow out to the right and UP — over the man's shoulder — for the throat; down and back once the fist is on the shoulder
      this.hand(pB, 1, [0.62, 0.68, 0.72, 0.76], 0.6);   // a fist round the handle from the first frame: the knife is in it the moment the reach begins
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
        hand = curve3(uR, [[0, liveR], [0.38, G.viaA], [0.7, G.viaB], [1, rest]]);
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
    const shot = H.shot !== undefined && H.shot >= 0 ? bump(H.shot, 0, 0.05, 0.12, G.duck.secs) * w : 0;   // a round just went past his ear: he ducks off it (only the gun hold fires one; the flinch outlives a holstering by its own half second)
    const knock = ph === 'whip' ? smoothstep(K.secs.whip - 0.1, K.secs.whip, t) * w : 0;                      // the pistol landing behind his right ear: the head goes with it (and the ragdoll is seeded going that way)
    // ---- restlessness: amplitude by agitation (bigger through the grab, gone as he goes limp; smaller with a gun at his head — he holds still for it), and now and
    //      then a tug at the arm (a jerk of the trunk, the left hand hauling down on the forearm) every 3–6 s
    const A = (0.35 + 0.65 * ag) * (1 - limp) * (ph === 'grab' ? 1.4 : 1) * lerp(1, 0.55, gv) * w;
    const period = 3 + 3 * (0.5 + 0.5 * Math.sin(Math.floor(tt / 4.5) * 12.9898));           // a jerk every 3–6 s (re-dealt each spell), 0.2 s long
    const jerk = bump(tt % period, 0, 0.06, 0.14, 0.24) * (1 - limp) * w * (0.5 + 0.5 * ag);
    // ---- the choke's fight (arm variant; the gun hold has no choke): an envelope on the EASED choke amount — up fast as the arm closes, spent as he goes, and let
    //      down gently by heCk if Sam eases off — driving a 2–3 Hz thrash of trunk and head, the hands clawing at the forearm, the knees pumping. Three sines off
    //      his own desynced clock: deterministic, and no two men fight alike.
    const S = smoothstep(0, F.rise, ck) * (1 - smoothstep(F.fadeFrom, F.fadeTo, ck)) * (1 - gv) * w;
    const s1 = Math.sin(tt * TAU * F.hz[0] + 0.4), s2 = Math.sin(tt * TAU * F.hz[1] + 1.3), s3 = Math.sin(tt * TAU * F.hz[2] + 2.1);
    const roll = (4 * Math.sin(tt * TAU * 0.7) * A + 5 * jerk + F.roll * s3 * S) * DEGR, yawS = (3 * Math.sin(tt * TAU * 0.45 + 1) * A - 7 * jerk + F.yaw * (0.65 * s1 + 0.35 * s2) * S) * DEGR;
    // ---- hard breathing while he is held (the fight and the going take it over): the chest heaving back and the shoulders lifting on each breath
    const br = (0.5 - 0.5 * Math.cos(tt * TAU * K.breath.hz)) * (1 - limp) * (1 - 0.7 * S) * lerp(1, 0.6, gv) * w * eIn;
    // ---- body: feet noted first (re-planted after the pelvis sinks), then arch / hunch / head
    fk.run(pA);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const drop = (lerp(K.sag[0], K.sag[1], ck) + 0.02 * shot + F.dip * (0.5 + 0.5 * Math.sin(tt * TAU * 1.3)) * S) * w * eIn;   // (the knees pumping under the fight, giving toward its end)
    if (drop > 1e-4) { this.shift(pA, nd.hips, [0, -drop, 0]); this.turn(pA, nd.hips, qPitch(drop * 40 * DEGR)); }
    const arch = lerp(K.arch, 2, limp) * DEGR * w * eIn + G.duck.pitch * DEGR * 0.5 * shot;     // arched back → the arch just gone as he goes (his neck stays in the crook of the arm: it is what holds him up — the head lolls over it, the knees give under it)
    const heave = -K.breath.pitch * br * DEGR;
    this.turn(pA, nd.spine1, quat.mul(qYaw(yawS * 0.3), qPitch(arch * 0.3))); this.turn(pA, nd.spine2, quat.mul(qYaw(yawS * 0.4), quat.mul(qRoll(roll * 0.4), qPitch(arch * 0.35 + heave * 0.4)))); this.turn(pA, nd.spine3, quat.mul(qYaw(yawS * 0.3), quat.mul(qRoll(roll * 0.6), qPitch(arch * 0.35 + heave * 0.6))));
    const clav = (K.clavUp * eIn * (1 - limp) + G.duck.hunch * shot + K.breath.clav * br) * DEGR * w; this.turn(pA, nd.shoulderL, qRoll(clav + 3 * s1 * S * DEGR)); this.turn(pA, nd.shoulderR, qRoll(-clav + 3 * s2 * S * DEGR));   // (the shoulders working against the arm, out of step)
    const aside = lerp(K.aside, G.aside, gv), chinUp = lerp(K.chinUp, G.chinUp, gv);
    const chin = lerp(chinUp, K.loll, limp) * DEGR * w * eIn - drop * 40 * DEGR + (G.duck.pitch * shot + G.knock.pitch * knock + F.head * 0.35 * s3 * S) * DEGR - heave;   // (the head nods against the heave: the eyes stay put while the chest works)
    const hr = (K.lollRoll * limp - aside * (1 - limp) * eIn + 3 * Math.sin(tt * 3.1) * A + F.roll * 0.7 * s1 * S - G.duck.roll * shot - G.knock.roll * knock) * DEGR * w;   // (− roll: his head tips out to his left — off the blade hand at his throat, or off the can at his right temple; ducked further off a shot, knocked that way by the whip)
    const hyw = (6 * Math.sin(tt * 1.7 + 2) * A + 9 * jerk + F.head * (0.6 * s2 + 0.4 * s3) * S + G.awayYaw * eIn * gv + G.duck.yaw * shot + G.knock.yaw * knock) * DEGR;
    this.turn(pA, nd.neck, quat.mul(qYaw(hyw * 0.4), quat.mul(qRoll(hr * 0.4), qPitch(chin * 0.45)))); this.turn(pA, nd.head, quat.mul(qYaw(hyw * 0.6), quat.mul(qRoll(hr * 0.6), qPitch(chin * 0.55))));
    if (drop > 1e-4) { fk.run(pA); twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0.6, rL); twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0.6, rR); }
    // ---- arms: the arm hold's set (gv 0) and / or the gun hold's (gv 1) — one of them nearly always; both, blended, for the beat of a mid-hold change
    pB.copy(pA); fk.run(pB);
    const liveL = v3.copy(fk.pos[nd.handL]), liveR = v3.copy(fk.pos[nd.handR]); const rL0 = [...fk.rot[nd.handL]] as Quat, rR0 = [...fk.rot[nd.handR]] as Quat;
    type ArmSet = { tgtL: Vec3; tgtR: Vec3; rotL: Quat; rotR: Quat; poleL: Vec3; poleR: Vec3; curlL: number[]; curlR: number[]; thumbL: number; thumbR: number; spreadL: number; spreadR: number };
    const armHold = (): ArmSet => {
      // held: the left hand laid on the forearm by his collarbone (hauling down on it with each tug), the right half up beside his head, open, palm forward, shaking
      // a little — frozen, pleading, not fighting. The choke changes that (cIn, on the eased amount, so easing off puts them back): both hands come clawing at the
      // forearm, working up and down it out of step at the fight's rate; then they fall away as he goes.
      const cIn = smoothstep(0.04, 0.3, ck);
      const claw = (o: number): Vec3 => [F.claw * 0.6 * Math.sin(tt * TAU * 1.7 + o) * S, F.claw * Math.sin(tt * TAU * 2.6 + o) * S, F.claw * 0.4 * Math.sin(tt * TAU * 2.6 + o + 1) * S];
      const rest: Vec3 = [K.restL[0], K.restL[1] - 0.03 * jerk, K.restL[2] - 0.02 * jerk];
      const up: Vec3 = [K.raisedR[0] + 0.01 * Math.sin(tt * TAU * 1.1) * A, K.raisedR[1] + 0.012 * Math.sin(tt * TAU * 0.9 + 1) * A + 0.03 * jerk, K.raisedR[2] + 0.01 * Math.cos(tt * TAU * 0.6) * A];
      const cl = lerp(0.62, 0.82, 0.5 + 0.5 * Math.sin(tt * TAU * 2.6)) * S + 0.65 * (1 - S);   // clawing: the fingers working
      return {
        tgtL: v3.lerp(v3.lerp(rest, v3.add(K.clawL, claw(0)), cIn), K.hang[0], limp),
        tgtR: v3.lerp(v3.lerp(up, v3.add(K.clawR, claw(Math.PI)), cIn), K.hang[1], limp),
        // hands: the left palm-down over the top of the forearm, fingers down its front (→ hooked up and back over it from below, back of the hand forward, once it claws); the right
        // fingers up and palm forward beside his head (→ hooked over the forearm from his right)
        rotL: quat.nlerp(this.handRot(0, [-0.25, -0.8, 0.5], [0, 0.55, 0.8]), this.handRot(0, [-0.5, 0.6, -0.6], [0.2, 0.5, 0.85]), cIn),
        rotR: quat.nlerp(this.handRot(1, [-0.2, 1, 0.1], [-0.15, 0.1, -1]), this.handRot(1, [0.5, 0.55, -0.6], [-0.2, 0.5, 0.85]), cIn),
        poleL: v3.lerp([1, -0.9, 0.3], [1, -0.5, 0.55], cIn), poleR: v3.lerp([-0.8, -1, 0.15], [-1, -0.6, 0.5], cIn),   // elbows: down at his left side, coming forward for the clawing; down and out under the raised hand, coming in and up for the arm
        curlL: [0.25, 0.3, 0.32, 0.35].map(a => lerp(lerp(a, cl, cIn), 0.2, limp)), thumbL: lerp(0.15, 0.3, cIn), spreadL: 0,
        curlR: H.armed ? [0.75, 0.8, 0.8, 0.8].map(a => lerp(a, 0.35, limp)) : [0.08, 0.1, 0.12, 0.18].map(a => lerp(lerp(a, cl, cIn), 0.25, limp)),   // (a pistol he was grabbed with stays in the fist — pointing at the ceiling out of the raised hand — until killGuard takes it)
        thumbR: H.armed ? 0.6 : lerp(0.05, 0.3, cIn), spreadR: H.armed ? 0 : 0.7 * (1 - cIn),   // the raised hand's fingers splayed
      };
    };
    const gunHold = (): ArmSet => {
      // the gun at his head: both hands half up in front of the shoulders, palms forward, trembling with the struggle, jerked in when a round goes past; whatever
      // the right holds (torch, pistol) points at the ceiling out of the raised fist
      const trem = 0.012 * Math.sin(tt * TAU * 1.1) * A, U = G.handsUp;
      const openL = Math.max(limp, 0.85), fist = 1 - limp * 0.7;
      return {
        tgtL: v3.lerp([U[0][0] - 0.03 * shot, U[0][1] + trem + 0.05 * shot + 0.03 * jerk, U[0][2] - 0.04 * shot], K.hang[0], limp),
        tgtR: v3.lerp([U[1][0] + 0.03 * shot + 0.03 * Math.sin(tt * 0.8) * A, U[1][1] - trem + 0.05 * shot + 0.04 * jerk, U[1][2] - 0.04 * shot + 0.02 * Math.cos(tt * 0.6) * A], K.hang[1], limp),
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
    if (ph === 'grab') { tgtL = v3.lerp(liveL, tgtL, smoothstep(0.15, 0.7, ug)); tgtR = curve3(smoothstep(0.05, 0.85, ug), [[0, liveR], [0.5, K.viaUp], [1, tgtR]]); }
    // limp, both hang palm-in
    const rotHangL = this.handRot(0, [0.1, -1, 0.15], [1, 0, 0.1]), rotHangR = this.handRot(1, [-0.1, -1, 0.15], [-1, 0, 0.1]);
    const eA = ph === 'grab' ? smoothstep(0.1, 0.75, ug) : 1;
    const rotL = quat.nlerp(quat.nlerp(rL0, Z.rotL, eA), rotHangL, limp);
    const rotR = quat.nlerp(quat.nlerp(rR0, Z.rotR, eA), rotHangR, limp);
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, tgtL, Z.poleL, 0.85 * eA, rotL);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, tgtR, Z.poleR, 0.85 * eA, rotR);
    this.hand(pB, 0, Z.curlL, Z.thumbL, Z.spreadL);
    this.hand(pB, 1, Z.curlR, Z.thumbR, Z.spreadR);
    blendPose(pA, pB, w * eA + w * (1 - eA) * 0.35, this.armsMask, pA);   // (the first frames of the grab: mostly still his own arms)
  }
  /** The knife fist (holdLayer): the right hand's rotation from where the BLADE is to point (`blade`: out of the fist's thumb side — rigProps.knifeBoxes lays it
   *  along that axis, edge to the palm side) and which way the back of the hand faces (`back`, squared to the blade here); the knuckles then run blade × back. */
  private knifeRot(blade: Vec3, back: Vec3): Quat {
    const T = v3.normalize(blade); const B = v3.normalize(v3.mad(back, T, -v3.dot(back, T)));
    return this.handRot(1, v3.cross(T, B), B);
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
    const pA = this.pA, pB = this.pB, nd = this.nodes, fk = this.fk, T = THR;
    const cr = clamp(this.crouch, 0, 1), legK = (1 - 0.5 * cr) * (1 - 0.4 * smoothstep(0.3, 1.5, Math.abs(this.speed)));   // the legs' share: halved on bent knees, less again on the move
    // ---- what is underneath: feet to re-plant, and each hand from its shoulder (the paths' live end keys)
    fk.run(pA);
    const fL = v3.copy(fk.pos[nd.footL]), fR = v3.copy(fk.pos[nd.footR]); const rL = [...fk.rot[nd.footL]] as Quat, rR = [...fk.rot[nd.footR]] as Quat;
    const uR = v3.sub(fk.pos[nd.handR], fk.pos[nd.upperArmR]), uL = v3.sub(fk.pos[nd.handL], fk.pos[nd.upperArmL]);
    // ---- body English (every curve is zero at both ends: full weight throughout)
    const chestYaw = curve(t, T.chestYaw) * DEGR, pelYaw = curve(t, T.pelvisYaw) * DEGR * legK, spYaw = chestYaw - pelYaw;   // the pelvis turn carries the whole spine; the spine joints add the rest
    const pitch = curve(t, T.pitch) * DEGR, roll = curve(t, T.roll) * DEGR;
    const ext = 18 * DEGR * cr * bump(t, 0, 0.12, 0.5, THROW_DUR);   // crouched: sit up out of the clip's hunch to get the arm over (as lockpickLayer un-rounds the back), chest first
    this.shift(pA, nd.hips, [curve(t, T.pelX) * legK, curve(t, T.pelY) * legK, curve(t, T.pelZ) * legK]);
    this.turn(pA, nd.hips, qYaw(pelYaw));
    const seg = (k: number, kp: number, ke: number) => quat.mul(qYaw(spYaw * k), quat.mul(qRoll(roll * k), qPitch(pitch * kp - ext * ke)));
    this.turn(pA, nd.spine1, seg(0.3 + 0.12 * cr, 0.4, 0.25)); this.turn(pA, nd.spine2, seg(0.35 + 0.13 * cr, 0.35, 0.3)); this.turn(pA, nd.spine3, seg(0.35 - 0.25 * cr, 0.25, 0.45));   // (the crouch clip lays the chest joint almost flat: there the turn is taken lower down, where the spine is still upright enough to twist about the vertical)
    const hy = -chestYaw * 0.85, hr = -roll * 0.7, hp = -pitch * 0.8 + ext;   // head: stays on the target (keeps 15 % of the turn), levelled out of the lean and the tilt, craned back down out of the sit-up
    this.turn(pA, nd.neck, quat.mul(qYaw(hy * 0.4), quat.mul(qRoll(hr * 0.4), qPitch(hp * 0.45)))); this.turn(pA, nd.head, quat.mul(qYaw(hy * 0.6), quat.mul(qRoll(hr * 0.6), qPitch(hp * 0.55))));
    this.turn(pA, nd.shoulderR, quat.mul(qYaw(curve(t, T.clavFwd) * DEGR), qRoll(-curve(t, T.clavUp) * DEGR)));
    fk.run(pA);   // feet back where the locomotion has them, soles as they were
    twoBoneIK(fk, pA, nd.thighL, nd.shinL, nd.footL, fL, this.kneePole(rL), 0.6, rL);
    twoBoneIK(fk, pA, nd.thighR, nd.shinR, nd.footR, fR, this.kneePole(rR), 0.6, rR);
    // ---- arms, IK'd on a copy against the body as it now is
    pB.copy(pA); fk.run(pB);
    const shR = v3.copy(fk.pos[nd.upperArmR]), shL = v3.copy(fk.pos[nd.upperArmL]); const cin = this.thrCarry;
    const lowK = 1 - 0.45 * cr;   // crouched: the follow-through stays up off the front knee
    const lift = (K: Keys3) => K.map(([kt, p]) => [kt, [p[0], p[1] < -0.25 ? -0.25 + (p[1] + 0.25) * lowK : p[1], p[2]]] as const);
    const kR = lift(T.handR), kL = lift(T.handL); const r0 = cin?.r ?? uR, l0 = cin?.l ?? uL;
    // the ends of each path hang off the live hand: part way toward the first / from the last authored point, bowed out round the body — so an arm that starts
    // forward (walking), low and wide (crouched) or mid-swing (re-triggered) takes no detour through a waypoint that only suits the standing idle
    const via = (a: readonly number[], b: readonly number[], s: number, bow: Vec3): Vec3 => [lerp(a[0], b[0], s) + bow[0], lerp(a[1], b[1], s) + bow[1], lerp(a[2], b[2], s) + bow[2]];
    const topR = kR[0][1], endR = kR[kR.length - 1][1], reachL = kL[0][1], endL = kL[kL.length - 1][1];
    const offR = curve3(t, [[0, r0], [0.06, via(r0, topR, 0.35, [-0.075, -0.015, 0.02])], [0.125, via(r0, topR, 0.75, [-0.11, 0.03, -0.09])], ...kR, [0.62, via(endR, uR, 0.55, [-0.10, 0.02, -0.02])], [THROW_DUR, uR]]);   // (up: hanging below the lifting elbow, then out behind it at shoulder height before it cocks up over it)
    const offL = curve3(t, [[0, l0], [0.09, via(l0, reachL, 0.5, [0.04, 0, 0.02])], ...kL, [0.63, via(endL, uL, 0.5, [0.03, 0, 0.02])], [THROW_DUR, uL]]);
    twoBoneIK(fk, pB, nd.upperArmR, nd.forearmR, nd.handR, v3.add(shR, offR), swivelPole(offR, SWIV_REF_R, curve(t, T.swivR) * DEGR), 1, this.handRot(1, curve3(t, T.fingR), curve3(t, T.backR)));
    twoBoneIK(fk, pB, nd.upperArmL, nd.forearmL, nd.handL, v3.add(shL, offL), swivelPole(offL, SWIV_REF_L, curve(t, T.swivL) * DEGR), 1, this.handRot(0, curve3(t, T.fingL), curve3(t, T.backL)));
    // fingers: closed round the can, sprung open at the release, hanging loose after; the left hand firms up as it tucks in
    const open = smoothstep(THROW_RELEASE - 0.025, THROW_RELEASE + 0.03, t), loose = smoothstep(0.34, 0.49, t);
    const cR = (grip: number, flat: number, hang: number) => lerp(lerp(grip, flat, open), hang, loose);
    this.hand(pB, 1, [cR(0.5, 0.05, 0.25), cR(0.55, 0.08, 0.3), cR(0.62, 0.12, 0.35), cR(0.7, 0.15, 0.42)], cR(0.7, 0.1, 0.3));
    const firm = bump(t, 0.22, 0.32, 0.5, 0.64); const cL = (a: number) => lerp(a, a + 0.25, firm);
    this.hand(pB, 0, [cL(0.3), cL(0.35), cL(0.4), cL(0.45)], lerp(0.3, 0.6, firm));
    // ---- in through per-arm masks (clavicle subtrees): full weight but for a short hand-over of the elbow at each end; a carried-in restart is already at weight
    const wR = cin ? 1 - smoothstep(0.62, THROW_DUR, t) : bump(t, 0, 0.06, 0.62, THROW_DUR), wL = cin ? 1 - smoothstep(0.57, 0.72, t) : bump(t, 0, 0.09, 0.57, 0.72);
    const m = this.dynMask; m.fill(0);
    const setSub = (i: number, wv: number) => { m[i] = wv; for (const ch of this.ch.nodes[i].children) setSub(ch, wv); };
    setSub(nd.shoulderR, wR); setSub(nd.shoulderL, wL); m[nd.shoulderR] = 0; m[nd.shoulderL] = 0;   // (the clavicles themselves are already posed in pA; pB carries the same turn)
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

export interface CharacterDesc { id: number; tint: Vec3; tint2: Vec3; pos: Vec3; yaw: number; }

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
  private restChestInv: Quat; private restHeadInv: Quat;
  /** the right hand's own axes (hand-bone local): out of the back of the hand, and across the knuckles toward the thumb / index side — read off the rest pose
   *  (T-pose, palms down: back = model up squared to the fingers, thumb side = back × fingers); the fingers themselves run along the bone's local +Y */
  private handRBack: Vec3; private handRThumb: Vec3;
  /** last frame's bones (and the dt between): the ragdoll is seeded with the body's own momentum — a guard shot mid-stride carries on forward as he folds */
  private prevBones: Record<string, Vec3> = {}; private prevDt = 0;
  /** once dead: the particle body that owns the pose (see ragdollize / updateRagdoll); `pos` then tracks the pelvis, `bodyYaw` stays what it was */
  ragdoll: Ragdoll | null = null; private rd: RagDrive | null = null;

  constructor(public ch: GltfCharacter, d: CharacterDesc) {
    this.id = d.id; this.tint = d.tint; this.tint2 = d.tint2; this.pos = v3.copy(d.pos); this.bodyYaw = d.yaw; this.aimYaw = d.yaw;
    this.anim = new CharacterAnimator(ch); this.anim.desync(d.id ?? 0); this.skel = new SkeletonInstance(ch);
    // rest-pose chest rotation for "facing" extraction
    const rp = restPose(ch, new Pose(ch.nodes.length)); this.skel.update(rp, m4.create(), null);
    this.restChestInv = quat.conj(this.skel.globalRot[this.anim.nodes.spine3]);
    this.restHeadInv = quat.conj(this.skel.globalRot[this.anim.nodes.head]);
    { const hr = this.skel.globalRot[this.anim.nodes.handR], hi = quat.conj(hr); const f = v3.normalize(quat.rotate(hr, [0, 1, 0])); const b = v3.normalize(v3.mad([0, 1, 0], f, -f[1]));
      this.handRBack = quat.rotate(hi, b); this.handRThumb = quat.rotate(hi, v3.cross(b, f)); }
  }

  forward(): Vec3 { return [Math.sin(this.bodyYaw), 0, Math.cos(this.bodyYaw)]; }
  aimDir(): Vec3 { const cp = Math.cos(this.aimPitch); return [Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp]; }
  /** The right hand's frame in the WORLD as posed this frame: `fingers` wrist → knuckles, `back` out of the back of the hand, `thumb` across the knuckles toward
   *  the thumb / index side (back × fingers). What a thing gripped in the fist is laid out in — rigProps.knifeBoxes: the blade out of the thumb side. */
  handFrameR(): { fingers: Vec3; back: Vec3; thumb: Vec3 } {
    const r = quat.mul(quat.yaw(this.bodyYaw), this.skel.globalRot[this.anim.nodes.handR]);
    return { fingers: quat.rotate(r, [0, 1, 0]), back: quat.rotate(r, this.handRBack), thumb: quat.rotate(r, this.handRThumb) };
  }

  update(dt: number) {
    if (this.ragdoll) { this.updateRagdoll(dt); return; }
    this.anim.aimYawOffset = clamp(wrapAngle(this.aimYaw - this.bodyYaw), -1.9, 1.9);
    this.anim.aimPitch = this.aimPitch;
    this.anim.bodyYawIn = this.bodyYaw; this.anim.posIn = this.pos;   // (the animator poses in model space but plants standing feet in the world: it needs where the body is and which way it faces)
    this.anim.update(dt);
    m4.fromTRS(this.world, this.pos, quat.yaw(this.bodyYaw), [1, 1, 1]);
    this.skel.update(this.anim.pose, this.world, this.anim.twists);
    this.readBones(dt);
  }

  /** World-space joint positions and the derived directions (chest facing, gun axis, muzzle) from the skeleton's current globals. */
  private readBones(dt: number) {
    const n = this.anim.nodes; const wp = (node: number): Vec3 => m4.transformPoint(this.world, this.skel.nodePos(node));
    const b = this.bones;
    if (dt > 1e-5 && b.hips) { const pb = this.prevBones; for (const k in b) pb[k] = b[k]; this.prevDt = dt; }   // (a dt-0 re-bake keeps the older sample: it is still one real frame back)
    b.hips = wp(n.hips); b.spine2 = wp(n.spine2); b.chest = wp(n.spine3); b.neck = wp(n.neck); b.head = wp(n.head);
    b.upperArmL = wp(n.upperArmL); b.forearmL = wp(n.forearmL); b.handL = wp(n.handL); b.upperArmR = wp(n.upperArmR); b.forearmR = wp(n.forearmR); b.handR = wp(n.handR);
    b.thighL = wp(n.thighL); b.shinL = wp(n.shinL); b.footL = wp(n.footL); b.toeL = wp(n.toeL); b.thighR = wp(n.thighR); b.shinR = wp(n.shinR); b.footR = wp(n.footR); b.toeR = wp(n.toeR);
    b.fingerR = wp(n.middle1R); b.fingerL = wp(n.middle1L);
    b.headTop = v3.add(b.head, [0, 0.2, 0]);
    // chest facing (rest → current delta applied to model +Z), in world
    const qYaw = quat.yaw(this.bodyYaw);
    const chestDelta = quat.mul(this.skel.globalRot[n.spine3], this.restChestInv);
    this.chestDir = v3.normalize(quat.rotate(quat.mul(qYaw, chestDelta), [0, 0, 1]));
    // gun direction: wrist → middle finger base, muzzle ahead of the hand
    this.gunDir = v3.normalize(v3.sub(b.fingerR, b.handR));
    if (!this.ragdoll && (this.anim.upper === 'aim' || this.anim.shooting) && !this.anim.inThrow && this.anim.longShown === null) {
      // when aiming the PISTOL, trust the analytic aim direction more (animation is approximate) — except mid-throw, when the hand (and whatever it holds) is off round
      // the head; a LONG gun's bore is the hands' own line (the sprung carriage puts wrist, knuckles and the support hand on it): snapping the drawn rifle to
      // aimDir instead parted it from the hands at every carriage change for ~0.3 s (review 08-10 #6: 35° at a sprint stop, the fore-end beam jumping)
      this.gunDir = this.aimDir();          // the prop, the rail light and the shot all share this exact direction
    }
    this.muzzle = v3.mad(b.handR, this.gunDir, this.muzzleAhead);
  }

  /** Die: stop animating and hand the skeleton to a ragdoll seeded from the current pose (twists baked in) and the bones' velocities, then shove it — a round
   *  along `dir` carries the body that way and pitches it head-first the same way (shot from the front: over backwards, away from the shooter; in the back:
   *  onto its face), knees kicked out so it drops rather than topples like a plank; `quiet` (takedown) is the same fold, gentler, along `dir` = his own
   *  facing. `world` = what it collides with (null: just the floor). */
  ragdollize(world: RagdollWorld | null, dir: Vec3, quiet: boolean) {
    if (this.ragdoll) return;
    if (!this.bones.hips) this.update(0);
    this.alive = false; this.vel = [0, 0, 0];
    const n = this.anim.nodes, b = this.bones, pb = this.prevBones, pdt = this.prevDt; const Y = quat.yaw(this.bodyYaw);
    const headUp = quat.rotate(quat.mul(Y, this.skel.globalRot[n.head]), [0, 1, 0]);
    const pts: Vec3[] = RAG_BONES.map(k => v3.copy(b[k]));
    pts[RAG.head] = v3.mad(b.head, headUp, 0.12); pts[RAG.handL] = v3.lerp(b.handL, b.fingerL, 0.5); pts[RAG.handR] = v3.lerp(b.handR, b.fingerR, 0.5);
    const vel: Vec3[] | null = pdt > 1e-5 && pb.hips ? RAG_BONES.map(k => { const v = v3.scale(v3.sub(b[k], pb[k]), 1 / pdt); const l = v3.len(v); return l > 3 ? v3.scale(v, 3 / l) : v; }) : null;   // (capped: an animation pop is not momentum)
    const rag = new Ragdoll(pts, vel, world);
    // the shove, as one rigid motion of the whole body: carried along `dir` and pitched top-first the same way (ω = up × dir turns the head end toward dir),
    // a little random yaw / strength so no two land alike; then the knees are kicked out forward so it drops instead of toppling like a plank
    const f = this.forward(); const j = 0.85 + Math.random() * 0.3, twist = (Math.random() - 0.5) * (quiet ? 0.8 : 1.6);
    const h = v3.normalize([dir[0], 0, dir[2]]); const pitchAxis: Vec3 = [h[2], 0, -h[0]];   // up × h: (up × h) × up = h
    if (!quiet) { rag.addRigidVelocity(v3.scale(h, 1.9 * j), [pitchAxis[0] * 2.2 * j, twist, pitchAxis[2] * 2.2 * j]); rag.addVelocity(RAG.kneeL, f, 1.2); rag.addVelocity(RAG.kneeR, f, 1.2); }
    else { rag.addRigidVelocity(v3.scale(h, 0.5 * j), [pitchAxis[0] * 3.2 * j, twist, pitchAxis[2] * 3.2 * j]); rag.addVelocity(RAG.kneeL, h, 1.0); rag.addVelocity(RAG.kneeR, h, 1.0); }
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
    rag.step(dt);
    if (rag.sleeping && rd.synced) return;
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
    const b = this.bones;
    const cap = (a: Vec3, c: Vec3, r: number, extendB = 0): number[] => {
      let bx = c[0], by = c[1], bz = c[2];
      if (extendB > 0) { const d = v3.normalize(v3.sub(c, a)); bx += d[0] * extendB; by += d[1] * extendB; bz += d[2] * extendB; }
      return [a[0], a[1], a[2], r, bx, by, bz];
    };
    // the shoe: heel to past the toe along the SOLE (the foot bone is the ankle, 10 cm up; the toe bone rides 1.5 cm up with the sole on the floor), radius
    // 3.3 cm about a centreline 3.3 cm above the sole so the proxy meets the floor the shoe stands on — no lit sliver under it — and follows the foot's pitch
    const sole = (foot: Vec3, toe: Vec3): number[] => {
      const up = TOE_FLOOR_Y; const heel: Vec3 = [foot[0] - (toe[0] - foot[0]) * 0.35, Math.min(foot[1], toe[1] - up + 0.033 + (foot[1] - toe[1]) * 0.15), foot[2] - (toe[2] - foot[2]) * 0.35];
      const tip: Vec3 = [toe[0], toe[1] - up + 0.033, toe[2]];
      return cap(heel, tip, 0.033, 0.06);
    };
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
    if (p[1] > bot && p[1] < top && Math.hypot(p[0] - cx, p[2] - cz) < 0.28) return true;
    if (chest && hips && Math.hypot(chest[0] - hips[0], chest[2] - hips[2]) > 0.12) {
      const cb = Math.min(hips[1], chest[1]) - 0.12;
      if (p[1] > cb && p[1] < top && Math.hypot(p[0] - chest[0], p[2] - chest[2]) < 0.25) return true;
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
    if (chest && hips && Math.hypot(chest[0] - hips[0], chest[2] - hips[2]) > 0.12) {
      const tc = columnEntry(ro, rd, tmax, chest[0], chest[2], 0.25, Math.min(hips[1], chest[1]) - 0.12, top);
      if (tc >= 0 && (t < 0 || tc < t)) t = tc;
    }
    return t;
  }

}
