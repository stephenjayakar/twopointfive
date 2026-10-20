// BACK TO THE WALL, THE FEEL PASS (the Q hold in player.ts: wallSnap / moveOnWall / releaseWall, the pose in character.ts wallBody / stanceBody).
// One switch — WALLSNAP.on, OFF = the hold exactly as it was (every hook in player.ts / character.ts is behind it) — over three things:
//
//   QUIET (hands empty or the pistol): the TAKE runs on one clock sized to the job (a short step and a small turn = a tenth of a second, a long reach and a
//   half turn = a third), eased OUT so he moves on the frame of the key, the turn a little ahead of the glide so the shoulders come round and the back then
//   lands; the feet STEP onto the hold's spots one after the other instead of skating; the landing has a settle (the pelvis dips, the head tips back to the
//   plaster) and a soft scuff only the player hears; the reach is longer for a face he is walking AT; Q pressed a moment early still takes it. The way OFF
//   keeps his momentum: Q with a direction held walks on from the first frame, the stick held away needs a tenth of a second instead of a quarter, Q with
//   nothing held peels him a hand off the plaster and no further (he chose that shadow).
//
//   LOUD (the rifle in his hands when Q goes down): the rifle STAYS in his hands — he stacks on the wall, shoulder to it, facing along it, low ready;
//   walks along it the way he faces; a click raises it and fires where the line is clear. Parked at the open end he faces, the cursor on anything the
//   corner hides steps him out past the end with the rifle in the shoulder, and the cursor coming back steps him in again; the camera holds still through
//   the step, so the point under the reticle does not swim. No key is held for any of it.
//
//   WITHOUT THE KEY (`press`, a switch of its own under `on`): a move key held into a wall he is up against takes it, quiet or loud as above. Q still does.
//
// This file is the table and its arithmetic only (nothing of the game is imported: src/game is one import cycle); the hold's code is where the hold is.

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;

export const WALLSNAP = {
  on: false,
  // ---- the take (seconds = takeBase + takePerM × the glide + takePerTurn × the turn in half turns, within [takeMin, takeMax])
  takeBase: 0.10, takePerM: 0.16, takePerTurn: 0.06, takeMin: 0.12, takeMax: 0.30,
  /** the glide's ease-out power (1 − (1 − s)^p: 2 = a quarter of the way in the first eighth of the time) and the turn's (ahead of the glide) */
  easePow: 2, yawPow: 3,
  /** how far off the body a face may be when he is walking AT it (m; standing still it is the hold's own 0.7), how squarely (cos), and how much that outranks a nearer face he is passing (m of score) */
  reachMoving: 1.15, headingMin: 0.5, headingBonus: 0.35,
  /** Q pressed this long (s) before a face comes into reach still takes it */
  buffer: 0.15,
  // ---- the landing
  /** pelvis dip (m) and head tip back (degrees) at the peak of the settle, the peak's time after the back lands (s), the scuff's gain (0 = silent) */
  dip: 0.035, nod: 4, hitPeak: 0.05, scuff: 0.3,
  /** the feet: lift of each step (m), and how far behind a planted foot may be left before it drags (m) */
  stepLift: 0.06, stepTrail: 0.5,
  /** the hold's poses mended (character.ts WALL_POSE.mend / .gait): the arms hang beside the hips instead of folding out, and the crouched sidle steps on tracks of
   *  its own along the wall instead of the turned crouch cycle. false = the poses as they were */
  pose: true,
  /** the camera's look-at while he is on the wall: into the room, and toward the side he looks (m) */
  camRoom: 0.35, camSide: 0.3,
  // ---- the way along, and the way off
  /** the stick within this of the wall's own line (degrees) SIDLES him, whichever way the camera is turned, and a stick that sidles him is never 'held away':
   *  only one nearer square-out than this lets go. 0 = the rule before it (along when that share was at least the square share, away from half a stick
   *  outward — under a camera turned 35° to the wall the key that mostly runs along it threw him off in a fifth of a second) */
  alongDeg: 55,
  /** stick held square away (within 35°) / on a diagonal (s; the diagonal's only with alongDeg 0: with it, a diagonal sidles) */
  awaySecs: 0.10, awayDiag: 0.18,
  /** Q with nothing held: the push off the plaster (m/s, eaten by the ordinary stop within ~5 cm) */
  offPush: 0.7,
  /** the pose's way out (1/s; the stance's own spring is 13) */
  outRate: 24,
  // ---- the stack (rifle in the hands)
  stack: true,
  /** the rifle brought into his hands ON the back hold (2, or E with it selected) makes the hold the stack where he stands; false = it waits for the step off, as it did ('in hand once off the wall') */
  stackDraw: true,
  /** the rifle stays up this long after a click (s) and takes this long to come up before a round may leave (s); no round while this much of the bore's line is in a wall (m) */
  upSecs: 1.2, upRise: 0.16, bore: 0.9,
  /** stepping out round an open end: how far past his parked station along the wall (m), seconds out and back */
  leanAlong: 0.6, leanOut: 0.18, leanBack: 0.14,
  /** the cursor's angle past what he can already see from cover that steps him out / back (degrees), its least distance from the corner (m), and behind the wall past this (degrees about the corner) stepping out would not bring it into his line either */
  leanOnDeg: 8, leanOffDeg: 2, leanMinDist: 0.6, leanMaxDeg: 100,
  /** once out, the far limits give this much before he comes back (degrees further round, m nearer the corner): a point sitting on a limit does not flap him */
  leanKeepDeg: 15, leanKeepDist: 0.2,
  /** a cursor that lands above this height (m: a wall's top, a lintel) is read where its ray comes down to chest height behind it; off = the landing point as it is */
  leanOver: true, leanOverY: 1.9,
  /** he steps out only if, from where he would then stand, this much of the way to the point is open (m; 0 = the angle alone — he would step out to face a shut door) */
  leanClearM: 1.4,
  /** the cursor must have stayed there this long before he steps out / back (s); once out he stays at least minOut, and afterShot after any round (s) */
  dwellOut: 0.06, dwellBack: 0.15, minOut: 0.35, afterShot: 0.4,
  // ---- the wall taken WITHOUT the key (its own switch; acts only with `on`; false = Q alone takes a wall, as it was)
  /** a move key held INTO a wall takes it as Q would: the stick within pressDeg of square to the face, for pressSecs, counted from pressNear (m) out — so a
   *  man who walks squarely up to a wall has it from pressFlow (m) short of touching, his back coming round as he arrives, and one who turns into a wall he
   *  stands against waits the whole of it there. Where the face has something to use within pressThingAt (m) of the spot he walks into (a door, a switch, the
   *  breaker, the mission's thing, a body) the wait is pressThing, all of it within pressTouch (m) of the face: he walked up to use it. */
  press: false, pressSecs: 0.18, pressFlow: 0.2, pressNear: 0.6, pressDeg: 35, pressTouch: 0.08, pressThing: 0.5, pressThingAt: 0.9,
  /** the latch a hold's end (or a refusal) leaves on the stick as it then stands: gone when the stick rests or turns by this (deg); till then a wall facing as
   *  the one he left is not taken, nor any other within this (s) */
  pressTurn: 50, pressAgain: 0.6,
  /** …and not with a mouse button held, nor within this (s) of a round of his own: a man shooting who backs into a wall keeps his gun up (the stack carries the rifle at the low ready) */
  pressAfterShot: 1.0,
  /** with a sidearm or a can in the hand (the hold puts it away) the key-less take waits until nobody is alert; false = whenever. The rifle stacks either way. */
  pressCalm: true,
};

/** seconds the take runs for a glide of `dist` metres and a turn of `turn` radians */
export function wsTakeSecs(dist: number, turn: number): number {
  const W = WALLSNAP; const t = W.takeBase + W.takePerM * dist + W.takePerTurn * Math.abs(turn) / Math.PI;
  return Math.min(W.takeMax, Math.max(W.takeMin, t));
}
/** ease-out by power p: 0 → 0, 1 → 1, fastest at the start */
export function wsEase(s: number, p: number): number { return 1 - Math.pow(1 - clamp01(s), p); }
/** the landing's settle, t seconds after the back arrived: 0 → 1 at hitPeak → gone by ~6 × that */
export function wsHit(t: number): number { const a = WALLSNAP.hitPeak; return t < 0 || t > 8 * a ? 0 : (t / a) * Math.exp(1 - t / a); }

/** Where the cursor's point is about a wall's end, in the corner's own frame: `a` on along the wall past the end (+ = beyond it), `b` off the plane (+ = the
 *  room he stands in, − = behind the wall). Returns the angle about the corner from the wall's own line carried on, + = round behind it (degrees, −180‥180),
 *  and the distance from the corner. */
export function wsCornerAngle(a: number, b: number): { deg: number; dist: number } { return { deg: Math.atan2(-b, a) * 180 / Math.PI, dist: Math.hypot(a, b) }; }
/** The angle (degrees, as wsCornerAngle) up to which a man standing `back` short of the end and `off` the plane already sees past the corner without moving */
export function wsSeenDeg(back: number, off: number): number { return Math.atan2(off, back) * 180 / Math.PI; }
