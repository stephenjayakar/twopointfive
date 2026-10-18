// IN HAND — what a man holds is drawn in the hand that holds it, and the hand is turned onto the line the thing points (the maintainer, 10-18, of a teammate crouched on
// the rear with his sidearm out: "gun not aligned to hand for partner. we should do a pass for all the attachment points").
//
// WHAT WAS OFF. A pistol was laid out from the WRIST JOINT along `Character.gunDir` with its top to the world's up — and in an aim `gunDir` is the analytic aim
// line (readBones: "the animation is approximate"), not the hand's. So the gun stood where the simulation points it and the hand stood where the clip put it:
//   · standing still on a level aim the two agree (the pose the numbers in RIG were fitted on: the grip 1.7 cm from the fist's hollow, 5° between them);
//   · CROUCHED the aim clip rides a trunk the crouch has leaned, the hands point 17‥22° below and beside the aim line and the grip stood 3.5 cm off the palm with
//     the muzzle 12 cm above the hand's own line — a gun floating over two fists, all the while he aims (the maintainer's shot);
//   · for the 0.2 s the aim clip takes to come up (`upper` flips on a frame, the pose eases at 14 /s) the gun was already on the aim line: 8‥9.5 cm off the hand
//     and ~50° across it — every time a man on the rear brings his sidearm up or lets it down.
//
// THE RULE (two halves, one switch):
//   1. THE GUN IS RIGID IN THE HAND. The drawer (rigProps.ts pistolFrame, `RigOpts.inHand`) lays a pistol out in the hand bone's OWN frame — bore along the wrist →
//      knuckle line, top to the thumb side (Character.gripFrameR: the construction kit handling already carried Sam's gun by, kitGunFrame) — so whatever the arm
//      does, the grip is in the fist. The 9 mm's group, fitted on the old frame, is moved to where the fitted Glock's grip sits (GRIPFIT.guardPistol).
//   2. THE HAND GOES TO THE AIM LINE. While the aim shows (the animator's own weight for the aim clip, `aimShown`), the right hand is turned at the wrist so that
//      frame lies on the line the simulation fires along (Character.inHandPass), by `from`‥`to` of that weight and never by more than `wrist` degrees — past that
//      the gun stays in the hand and is off the line by the rest. A support hand that is on the gun (its wrist within `both` m of the gun hand's) is carried round
//      with it and its arm re-solved, so the two-hand hold stays a hold.
//
// AND THE PASS OVER EVERYTHING ELSE A MAN HOLDS, WEARS OR CARRIES (every cast variant × loadout × pose measured against the worn mesh, and
// every frame of 24 played missions against the hands' own frames — tools/qa/attach-mesh.ts, attach-play.ts).
// A thing whose LIGHT or MUZZLE the simulation places stays where the simulation has it, and the HAND goes to it:
//   · A TORCH (`torch`) stood 8‥12 cm beside the fist of every calm patrol (laid out from the wrist in the BEAM's frame, fitted in one pose). The torch and the
//     light at its lens stay put; the fist's thumb line is turned onto the beam and the arm re-solved so the hollow of the fist is round the torch's body.
//   · A LONG GUN (`long`): a teammate's rifle and a defender's carbine had their pistol grip 4 cm short of the palm (the fit Sam's had under kit handling was his
//     alone). The gun, its muzzle and the light on it stay put; the trigger hand is moved those 4 cm onto the grip (rigProps.longHold).
//   · WORN: a defender's holster stood a third inside his long shirt (`holsterOut` m further off the thigh, defenders only: the others' clothes are tight) and
//     the torch on a man's belt three quarters inside him (`belt`: handwork.ts beltTorch).
//   · THE SWAP'S HAND (`belt`): the torch ↔ sidearm swap takes the hand to the torch's old place on the belt (the reach is in the pose the game reads); the
//     drawn hand goes the rest of the way out to where the torch now hangs.
//   LEFT ALONE, each with its reason, in docs/agents/player.md (IN HAND): Sam's slung rifle through his radio pack (a pairing the page as it ships never stages),
//   the breacher's two long tools.
//   (The torch a whistle raised in the wrong hand was on that list: mended as a rule of its own, gunhand.ts GUNHAND.whistle — the torch branch below reads which
//   way round the fist is on it from the animator's `torchUp`. So was the trigger hand through a long gun's reload, which played the pistol's clip: mended by
//   gunhand.ts `longReload` — the long hold here keeps the palm on the grip through it, as through every carriage.)
//
// LOOKS ONLY. The pass poses the SKELETON a second time, after `bones`, `gunDir` and `muzzle` have been read (as a sleeping body's breath does): the joint palette
// the GPU is handed and the hand frames the DRAWER reads move; nothing the simulation reads does — the round, the flash, the laser, the light's pose, the hit
// capsules and every digest are as they were, and the one game rule that starts from the hand's frame (kit handling: kitanim.ts) asks for it as it was before the
// pass (Character.handFrameR(true)). A settled aim draws the gun on the simulation's own line, as before; only what the HANDS do changed. A man who dies is let
// go of first (ragdollize): the body that falls is the one the particles were read off.
//
// WHEN IT STANDS DOWN. The turn is the aim's, so it shows only while nothing else has the gun arm (CharacterAnimator.gunArmOwn: a reload, a blow, a flinch, a
// throw, a kit errand, the torch ↔ sidearm swap, a hold, a signal…) and it comes and goes at `rate` — never in one frame, bar one case: on a SHOT the hand is on
// the line at once and in full (no `wrist` limit), so the flash leaves the barrel the picture shows (a snap shot from a low ready used to pull the gun out of the
// hand instead).
//
// `fit`: the things a teammate holds through Sam's kit path (his pistol, a can, a magazine) are drawn IN the hand by the same measured offsets Sam's are
// (rigProps GRIPFIT), which were his alone.
//
// Off (the module's default, the frozen stand): the build as it was — every box where it was, the skeleton posed once.
// A leaf: nothing here is built from another game module's exports (src/game is one import cycle).

import type { Vec3 } from '../math/vec';

/** What the drawer tells a figure it has put in his right hand this frame (combat.ts handProps → Character.inHand; a frame behind, as `anim.gripCan` is):
 *  a PISTOL, drawn in the hand's own frame · a TORCH drawn off `beam` (world): the point of its body the fist goes round `at` from the wrist and its body along `axis`, both in the beam's
 *  frame, held `fwd` m along the fingers and `palm` m out of the palm · a LONG GUN whose grip is `by` from where the palm is, in the gun's frame */
export type InHandWord = { kind: 'pistol' } | { kind: 'torch'; beam: Vec3; at: Vec3; axis: Vec3; fwd: number; palm: number } | { kind: 'long'; by: Vec3 };
export const IN_PISTOL: InHandWord = { kind: 'pistol' };

/** `on`: the switch · `from` / `to`: the aim clip's weight at which the hand starts for the aim line and is on it · `wrist`: the most the pass turns a wrist,
 *  degrees (a shot aside) · `both`: a support hand's wrist within this many metres of the gun hand's is on the gun and goes with it (in full inside half of it, fading out over the far half — a hold is 11‥12 cm, and the hands part to 17 cm as an aim comes up) ·
 *  `rate`: 1/s the pass comes in and goes out at when its gate opens or shuts · `fit`: a teammate's held things take Sam's grip offsets ·
 *  `torch`: the fist is turned onto a torch's beam and put round its body · `long`: the trigger hand of every man's long gun is moved onto its grip ·
 *  `holsterOut`: m further off the thigh a defender's holster is drawn (a third of it was inside his long shirt) · `belt`: the torch on a man's belt hangs outside
 *  his clothes (handwork.ts beltTorch: three quarters of it was inside him) */
/** the torch on a man's belt, m off his hips to his right and ahead: `was` where it hung (three quarters inside him), `at` where `belt` hangs it — and how far the
 *  swap's hand is drawn out to meet it (Character.inHandPass) */
export const BELT_TORCH = { was: [0.15, 0.115], at: [0.21, 0.16] };

export const INHAND = { on: false, from: 0.3, to: 0.92, wrist: 55, both: 0.34, rate: 9, fit: true, torch: true, long: true, holsterOut: 0.03, belt: true };
