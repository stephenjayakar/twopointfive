// STEALTH POSES — how Sam carries himself with his hands empty and nobody on to him, posed against Chaos Theory's own clips (the maintainer's clips, cut into
// beats: rebuild/takedowns-like-chaos-theory/clips/stealth-moves.md). The PLAYER only; picture and pose only.
//
//   IDLE    the crouch at a stand, hands empty: both arms hang forward of the knees off the shoulders, elbows a little out, forearms dropping in front of the
//           knees, hands open and loose between shin and knee height — and never a held frame: the weight goes foot to foot on a slow cycle (the pelvis a
//           centimetre to each side, feet where they were) with the hands drifting.
//   WALK    the crouch walk, hands empty: the hand opposite the forward foot comes forward low to knee height, fingers open; the other elbow goes back past
//           the hip. Read off the feet themselves, so it holds the stride he stopped in.
//   RISE    standing up: the hips come up as they always did and the ARMS follow over `riseSecs`, hanging low and forward until the trunk is up. Crouching
//           down: the elbows flare for the beat it takes the hands to come forward to the idle's place. Arms only: his trunk and head are the build's.
//   CREEP   the close-in mode near a man (close.ts): each step of the left foot led by the free (left) hand reaching low and forward. The right hand is
//           the knife's (close.ts, KIT.close) and the ready tell takes the left when it wants it.
//   CABLE   the look under a door (wand.ts): OVER the lock work's kneel, and it IS the pose (`bones`, the capsules and his eye go down with what is drawn): he shuffles half a step of pose in,
//           folds the trunk, bows the head below the shoulder line toward the foot of the door, shoulders rounded in, one arm forward and low at the gap, the
//           other by the knee. Out with the head first. `anim.lockpick`, wand.ts's rules, lens, clocks and rows are untouched.
//
// One switch, STEALTHPOSE.on — the page: on (`?nostealthpose` = as it was); the frozen harness stand: off (`TPS_STEALTHPOSE=1` on) — and a half for each of
// the five. No pace, key, reach, range or clock moves: `pos`, the yaws and the gait's cadence are the build's. What DOES differ for the simulation with it on
// (so the frozen stand holds it off): poses feed the game — his arms are somewhere else (capsules), and the idle's sway moves his pelvis, chest and head a
// centimetre. Outside the look under a door the trunk is never rounded and the pelvis never sunk; in it his head is some 30 cm lower than the lock work's kneel, never higher. No dice. No state of its own: the
// animator's eased weights are the animator's (not in a checkpoint).
//
// THIS FILE IS A LEAF (character.ts imports it, and character.ts is a leaf of the game's import graph): the table and the feed's shape only. The feed itself —
// `stealthFeed(g)`, what the GAME knows — is stealthfeed.ts; character.ts `stealthLayer` / `stealthPicture` do the rest and stand down, eased, for whatever
// else the animator itself knows has his arms. Nothing fed = nothing posed: with the switch off the layer is never entered.

export const STEALTHPOSE = {
  /** THE switch — the page: on (`?nostealthpose` off); the frozen stand: off (`TPS_STEALTHPOSE=1` on) */
  on: false,
  /** its halves, for A/B on the panel: the crouch idle's arms and sway · the crouch walk's arms · standing up / crouching down · the creep's leading hand · the look under a door */
  idle: true, walk: true, rise: true, creep: true, cable: true,
  /** a goggle nod made while he looks under a door is SEEN: the look poses it itself, as a lift of the head off the gap and back (false = the look takes the nod back out: the goggles swing on a still head, as it was). A key of its own so that a recording from before it replays with the head it was made with */
  nod: true,
  /** the idle's weight shift: seconds a cycle · metres the pelvis goes to each side · metres the hands drift */
  swaySecs: 2.2, swayM: 0.012, driftM: 0.016,
  /** standing up: seconds the arms take to follow the hips */
  riseSecs: 0.9,
  /** the look under a door (the pose itself — his head and body really go down): seconds in · degrees the trunk bows past level · metres of pose he shuffles in */
  cableIn: 0.4, cableBow: 26, cableStep: 0.07,
};

/** what the game tells the animator each frame (CharacterAnimator.stealth): `free` = both hands empty and nothing of the game's has them or his body;
 *  `cable` = the wand is under a door (the squat is drawn over the lock work's kneel) */
export interface StealthFeed { free: boolean; cable: boolean }
