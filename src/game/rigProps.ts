// Rig props: every number that places something ON the mannequin — the trifocal goggles on the head, the Five-seveN with its
// under-barrel rail light in the right hand, the combat knife in the fist for a hands-empty hold, the guards' hand torch / weapon
// light, their carbine, Sam's SC-20K in his hands or slung across his back — lives in RIG, and rigBoxes() / rigLightPose() / carbineLightPose() / sc20kLightPose() turn it into the prop boxes and the lights' poses. The character viewer (the workbench: src/viewer/) drives the
// same functions with sliders bound to RIG and its "copy constants" button emits the `export const RIG` statement below verbatim
// (rigSource()), so tuning is: drag, copy, paste over the block, commit.
import { SideMap } from '../math/side';
import { Vec3, Quat, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { RtLight } from '../render/lights';
import { Character } from './character';
import type { InHandWord } from './inhand';
import { GEAR } from './gear';   // (a leaf — read only inside the box builders: which rifle and which goggles are DRAWN)
import { packOf, sideBind, sideSkinned, sidePitch, sidePitched, chestJoint, type SidePlace } from './packside';   // (a leaf — called inside the box builders only: a long thing at the side of the pack he wears)

/** A stick-shaped part laid along a direction from an anchor point: it spans [l0, l1] metres along the direction; the box is
 *  `thick` (half width, sideways) × `tall` (half height). The box is fully oriented along the direction (Box.rot, see seg()). */
export interface Seg { l0: number; l1: number; thick: number; tall: number; adj?: Adj; }
/** A free adjustment on top of the structured numbers, Blender-style, in the node's PARENT frame (x = side, y = up, z = along —
 *  see nodeFrames below): `off` metres, `rot` degrees about those axes (applied x, then y, then z). Groups (pistol, goggles.on/off,
 *  torch, guardPistol) and parts (each Seg, the goggle housing / lens cluster) can carry one; absent = zero. This is what the
 *  viewer's gizmo edits. Props are traced boxes carrying a full 3D rotation (Box.rot), so groups turn rigidly. */
export interface Adj { off: Vec3; rot: Vec3; }

export interface Rig {
  goggles: {
    /** night vision ON: lens-cluster base point = head joint + f·fwd + up·[0,1,0] in the head frame chosen by followPitch (f = flattened head
     *  direction by default). The head joint sits at the top of the neck, so the eyes are ~10 cm up and ~10 cm forward of it… */
    on: { fwd: number; up: number };
    /** …and OFF the goggles are flipped up, parked on the forehead (~18 cm up) */
    off: { fwd: number; up: number };
    /** trifocal triangle around the base point: two lenses at ±lensSide sideways and lensDown, the third centred at lensUp */
    lensSide: number; lensDown: number; lensUp: number;
    /** one lens box: lensHalf across (square face) × lensThick along f (half extents) */
    lensHalf: number; lensThick: number;
    /** housing behind the lenses: centre sits `back` behind the base point along f */
    housing: { back: number; half: Vec3 };
    /** lens emission: down over the eyes they blaze, parked on the forehead they idle at a readable glow (screen glow + bloom only: props are
     *  raster-only boxes, no ray ever sees them, so this never lights the face) */
    glowOn: Vec3; glowOff: Vec3;
    /** the TWO-TUBE set the 2010s issue kit wears instead (gear.ts GEAR.on; the same cluster frame and adjustments): a tube per eye at ±side, `down` off the base
     *  point, `half` across (square), from `back` behind the base point to `front` ahead of it, a dark glass face `glass` thick (half) on the front of each — NEVER
     *  lit, up or down: nothing on the man glows — and the bridge joining them + the arm up to the helmet mount, each a centre in the cluster frame + half extents */
    tubes: { side: number; down: number; half: number; back: number; front: number; glass: number; bridge: { at: Vec3; half: Vec3 }; arm: { at: Vec3; half: Vec3 } };
    /** free adjustments (viewer gizmo): the whole cluster per state, the housing, the lens triangle */
    onAdj?: Adj; offAdj?: Adj; housingAdj?: Adj; lensAdj?: Adj;
    /** 0: fwd/up/side are laid out in a yaw-only head frame (world up) — what the game shipped with; 1: they ride the skull's full rotation
     *  (rest→current delta, like headDir), so a pitched head — crouch, looking down the sights, a ragdolled body — keeps them on the face. The boxes
     *  themselves can only yaw either way. */
    followPitch: number;
  };
  /** the player's pistol, laid along char.gunDir from bones.handR (wrist) */
  pistol: {
    slide: Seg; suppressor: Seg;
    /** grip: a segment hung under the rear of the frame — its adj.rot[0] rakes it down-and-back from the bore axis (≈108°), adj.off puts its top under the slide */
    grip: Seg;
    /** rail light body: same axis, but its anchor is dropped `under` metres along char.gunUnder() (below the bore) */
    rail: Seg & { under: number };
    /** the rail light's lens (drawn lit only while the light is on) */
    lens: Seg & { glow: Vec3 };
    /** the spot light itself: pos = hand + gunDir·lightAhead + gunUnder·lightUnder, dir = gunDir (see rigLightPose) */
    lightUnder: number; lightAhead: number;
    adj?: Adj;   // whole pistol group (props + rail light) relative to the hand frame
  };
  /** guards on patrol carry a hand torch along their (AI-smoothed) beam direction; the spot light sits at its lens */
  torch: { body: Seg; lens: Seg; /** lens emissive = flashlight colour × lensGlow while lit */ lensGlow: number; /** light origin: hand + beamDir·lightAhead */ lightAhead: number; adj?: Adj };
  /** guards off patrol: drawn pistol (no can) with the weapon light glowing in the lens slot */
  guardPistol: { slide: Seg; grip: Seg; lens: Seg; lightAhead: number; adj?: Adj };
  /** the player's combat knife, out only while he holds a man with his hands empty (the arm hold: character.ts holdLayer poses the fist, HOLD.knife). Laid out in
   *  the right FIST's frame (Character.handFrameR): origin = the middle of the grip — `grip.fwd` along the fingers from the wrist, `grip.palm` down out of the palm
   *  into the curled fingers, `grip.side` toward the thumb — z out of the thumb side of the fist (the blade's way: a hammer grip), y out of the back of the hand
   *  (the spine's side; the edge strip faces the palm side), x through the flat. Steel blade with a lighter strip along the edge, a stub of a guard, black handle. */
  knife: { blade: Seg; edge: Seg; guard: Seg; handle: Seg; grip: { fwd: number; palm: number; side: number }; adj?: Adj };
  /** …and where that knife rides when it is NOT in the fist: handle down in a sheath on the left chest webbing (sheathBoxes; drawn only where the caller asks —
   *  RigOpts.sheath). In the CHEST's frame (Character.chestFrame: to his left, up the trunk, out of the chest; metres off the chest joint, rigid with the upper
   *  spine): `at` = the middle of the handle's grip — THE point the reaching fist closes on (character.ts sheathFist reads this very record, so the hand and the
   *  handle cannot drift apart) — `along` = the knife's own line, handle → tip (up the strap toward the left shoulder), `out` = which way is off the chest (the
   *  flat of the blade lies against it). `body` = the sheath over the blade, along that line from the grip's middle like the knife's own Segs. */
  sheath: { at: Vec3; along: Vec3; out: Vec3; body: Seg };
  /** the canister standing in the right fist (slot smoke / stun up): base point = handR + `sink` along the can's axis (negative = down into the fist), the axis =
   *  up tilted `tilt` toward his facing; body/band segments along it; `adj` = the viewer's free adjustment on top */
  can: { sink: number; tilt: number; body: Seg; band: Seg; adj?: Adj };
  /** the holstered sidearm on the right thigh: anchor = thigh joint + `down` along the femur + `out` away from the pelvis (level) + `fwd`; `adj` on top */
  holster: { down: number; out: number; fwd: number; adj?: Adj };
  /** the guards' carbine (rifles, docs/internal/sc20k-design.md §3 — an AKS-74U-pattern short AK, stock extended, 0.73 m): held by its pistol grip in the right
   *  hand exactly as the sidearm is, so the group hangs off the same hand frame (wrist origin, z along char.gunDir, y up out of the receiver) moved by `adj` to a
   *  point ON THE BORE AXIS ABOVE THE TRIGGER — every part below is laid out from there: +z toward the muzzle, −z back along the receiver to the skeleton stock,
   *  the magazine's curve as two canted segs, the weapon light on the handguard's right face (its lens lit = the man's light colour × lensGlow, the spot light
   *  itself lightAhead along the lens part: for a rifleman the light IS on the gun, no hand torch). gripL is where the SUPPORT hand takes it, in the group's
   *  axes: the left wrist's point (under and left of the handguard) and the directions its fingers point / the back of the hand faces — the animator solves the
   *  left arm onto that (character.ts longArms via carbineGrip()), so dragging it in the viewer moves the hand on the gun.
   *  Parts (11 boxes, all traced): receiver (+ cover, its bulk a centimetre under the bore line) −0.09‥0.155 · handguard (the furniture, upper and lower as one)
   *  ‥0.275 · barrel ‥0.34 · muzzle = the conical booster ‥0.41 (the muzzle proper: 0.5 m ahead of the wrist) · mag out of the receiver floor ahead of the
   *  trigger canted forward 12°, mag2 its lower half canted 30° (the curve) · grip raked back like the sidearm's · stockTop level off the receiver's rear to
   *  −0.32, stockLow from the receiver's heel back and down to the toe of the butt (the triangle, open) · light + lens on the handguard's right face. */
  carbine: {
    receiver: Seg; handguard: Seg; barrel: Seg; muzzle: Seg;
    mag: Seg; mag2: Seg; grip: Seg; stockTop: Seg; stockLow: Seg;
    light: Seg; lens: Seg; lensGlow: number; lightAhead: number;
    gripL: { off: Vec3; fingers: Vec3; back: Vec3 };
    adj?: Adj;
  };
  /** Sam's SC-20K (rifles, docs/internal/sc20k-design.md §5 — an F2000-pattern bullpup with an integral suppressor, 0.74 m): held by its pistol grip in the right
   *  hand like the carbine, so the group hangs off the same hand frame moved by `adj` onto THE BORE AXIS ABOVE THE TRIGGER, +z toward the muzzle. A bullpup: the
   *  action and the magazine sit BEHIND the grip inside one polymer hull that is also the stock (hull −0.29‥0.12 with the buttpad behind it, the thirty-round box
   *  straight down out of its floor at −0.12), the fore-end ahead of the grip ‥0.30 with the FOREGRIP — a vertical post — under it at 0.20 (where the support hand
   *  goes: gripL, the left wrist's point and its fingers / back-of-hand directions in the group's axes, solved by the animator exactly as the carbine's handguard
   *  point is), the suppressor ‥0.43 (the muzzle: 0.52 ahead of the wrist), a rail along the hull's spine with the sight block on it, the weapon light and its lens
   *  on the fore-end's right face (lit = the rail light's colour × lensGlow; the spot light itself lightAhead along the lens part). Eleven traced boxes in two
   *  albedos (polymer, and a darker metal for the can, the box, the rail and the optic). `slung`: where it rides when it is not in the hands — diagonally FLAT across
   *  his BACK in the back's own frame (sc20kFrame: y up the spine line hips → chest joint, z the way the torso faces squared to that line — the root's facing and the
   *  chest's blended by `follow`, 0 … 1: a rigid thing bridging shoulder blade and hip goes with both — x his left; so a crouch tilts it with the back and an aim's
   *  chest twist turns it half way, where the chest's own axes swung its muzzle end out past the hip like a plank): `off` from the MID-BACK joint (spine2) along
   *  [left, up the spine, ahead], `bore` the way the muzzle points in the same axes (down and left past the hip, the butt up behind the right shoulder blade),
   *  `roll` degrees about the bore off lying side-flat to the back (0 = its right side on the back, 180 = its left: either way the hull's broad face to the spine and
   *  the box magazine, foregrip post and sight block in the back's plane; anything between stands it on edge), and a free `adj` on top for the gizmo. */
  sc20k: {
    hull: Seg; butt: Seg; mag: Seg; grip: Seg; fore: Seg; suppressor: Seg; rail: Seg; optic: Seg; foregrip: Seg;
    light: Seg; lens: Seg; lensGlow: number; lightAhead: number;
    gripL: { off: Vec3; fingers: Vec3; back: Vec3 };
    slung: { off: Vec3; bore: Vec3; roll: number; follow: number; adj?: Adj };
    adj?: Adj;
  };
  /** Sam's rifle as the 2010s issue kit DRAWS it (gear.ts GEAR.on): an M4-pattern carbine — receiver (`hull`), buffer `tube` and collapsible stock (`butt`), the
   *  thirty-round box AHEAD of the grip, a railed handguard (`fore`) with a laser box on top (`peq`) and the 40 mm tube under it (`gl`), a dot sight. ONLY THE PARTS
   *  THAT DIFFER: the group frame (`adj`), the pistol grip, the post and its fist point, the weapon light and its lens, the sling and THE CAN (its far face = the
   *  muzzle the rounds leave) are `sc20k`'s own parts, drawn from there — as the animator's support hand, the muzzle, the light's pose and the launcher's port are
   *  always read (sc20kGrip / sc20kMuzzleAhead / sc20kLightPose / sc20kLauncherMuzzle) — so the picture cannot leave what the simulation does. */
  m4: { hull: Seg; butt: Seg; mag: Seg; fore: Seg; rail: Seg; optic: Seg; tube: Seg; peq: Seg; gl: Seg };
}

// ---- paste target: the viewer's "copy constants" button (rigSource()) emits exactly this statement, in this format ----
export const RIG: Rig = {
  goggles: {
    on: { fwd: 0.105, up: 0.1 },
    off: { fwd: 0.075, up: 0.185 },
    lensSide: 0.03,
    lensDown: -0.012,
    lensUp: 0.026,
    lensHalf: 0.013,
    lensThick: 0.008,
    housing: { back: 0.03, half: [0.055, 0.028, 0.03] },
    glowOn: [1.5, 14, 3],
    glowOff: [0.35, 3.2, 0.7],
    tubes: { side: 0.032, down: -0.012, half: 0.015, back: 0.06, front: 0.012, glass: 0.003, bridge: { at: [0, 0.012, -0.03], half: [0.03, 0.007, 0.012] }, arm: { at: [0, 0.034, -0.045], half: [0.009, 0.018, 0.009] } },
    followPitch: 1,
    onAdj: { off: [-0.004, 0.04, 0.02], rot: [4.761, 0, 1.1] },   // (maintainer's viewer pass, 08-09: goggles-down 1.5 cm higher and ~14° flatter)
    offAdj: { off: [-0.006, 0.048, 0.032], rot: [-17.2, 0, 0.7] },
  },
  pistol: {
    slide: { l0: 0.02, l1: 0.21, thick: 0.016, tall: 0.026 },
    grip: { l0: 0, l1: 0.095, thick: 0.014, tall: 0.017, adj: { off: [0, -0.024, 0.05], rot: [108, 0, 0] } },   // top under the slide behind the trigger, raked ~18° back from vertical
    suppressor: { l0: 0.21, l1: 0.36, thick: 0.019, tall: 0.019 },
    rail: { l0: 0.09, l1: 0.2, thick: 0.013, tall: 0.012, under: 0.034, adj: { off: [0, 0, 0.064], rot: [0, 0, 0] } },
    lens: { l0: 0.2, l1: 0.215, thick: 0.014, tall: 0.013, glow: [14, 14, 13] },
    lightUnder: 0.038,
    lightAhead: 0.2,
    adj: { off: [0.039, 0.08, 0.035], rot: [-1.3, 0, 0] },
  },
  torch: {
    body: { l0: -0.06, l1: 0.15, thick: 0.022, tall: 0.022 },
    lens: { l0: 0.15, l1: 0.18, thick: 0.026, tall: 0.026 },
    lensGlow: 40,
    lightAhead: 0.18,
    adj: { off: [0.076, 0.04, 0.092], rot: [0, 6.7, 0] },
  },
  guardPistol: {
    slide: { l0: 0.02, l1: 0.2, thick: 0.016, tall: 0.026, adj: { off: [0.028, -0.034, 0.073], rot: [11.2, 0, 0.5] } },
    grip: { l0: 0, l1: 0.095, thick: 0.014, tall: 0.017, adj: { off: [0.028, -0.06, 0.118], rot: [119, 0, 0.5] } },   // follows the tuned slide (its off/rot folded in); fine-tune in the viewer
    lens: { l0: 0.2, l1: 0.23, thick: 0.015, tall: 0.015, adj: { off: [0.029, -0.064, 0.023], rot: [11.8, 0, 0] } },
    lightAhead: 0.25,
    adj: { off: [0.031, 0.105, -0.05], rot: [-8.6, 0, 0] },
  },
  knife: {
    blade: { l0: 0.045, l1: 0.215, thick: 0.002, tall: 0.009, adj: { off: [0, 0.003, 0], rot: [0, 0, 0] } },   // 17 cm × 2.4 cm (with the edge strip below it: the two tile at y −0.006) × 4 mm, from just past the index side of the fist
    edge: { l0: 0.045, l1: 0.215, thick: 0.002, tall: 0.003, adj: { off: [0, -0.009, 0], rot: [0, 0, 0] } },   // the ground edge: the palm-side 6 mm of the blade, lighter
    guard: { l0: 0.04, l1: 0.048, thick: 0.005, tall: 0.019 },                                                // a stub of a cross-guard between fist and blade
    handle: { l0: -0.065, l1: 0.045, thick: 0.011, tall: 0.013 },                                             // 11 cm, through the fist and out past the little finger (numbers to 3 decimals: rigSource's paste keeps them exactly)
    grip: { fwd: 0.08, palm: 0.03, side: 0 },
  },
  sheath: {
    at: [0.07, -0.085, 0.2], along: [0.26, 1, -0.2], out: [0, 0.18, 1],   // the grip a hand's breadth under the left collar bone's height, just proud of the webbing; the blade up the strap, leaning back with the chest
    body: { l0: 0.046, l1: 0.228, thick: 0.006, tall: 0.016 },              // 18 cm × 3.2 cm × 1.2 cm over the blade, from the guard up
  },
  can: {
    sink: -0.02, tilt: 0.35,                                                    // 2 cm down into the fist; the axis leans 35 % toward his facing
    body: { l0: -0.02, l1: 0.12, thick: 0.032, tall: 0.032 },                 // the can: 14 cm × 6.4 cm
    band: { l0: 0.085, l1: 0.109, thick: 0.034, tall: 0.034 },               // the colour band near the top (red = smoke, pale = stun)
    adj: { off: [0, 0, 0], rot: [0, 0, 0] },
  },
  holster: { down: 0.06, out: 0.115, fwd: 0.01, adj: { off: [0, 0, 0], rot: [0, 0, 0] } },   // 6 cm down the thigh, 11.5 cm out from the pelvis, 1 cm forward
  carbine: {
    receiver: { l0: -0.09, l1: 0.155, thick: 0.017, tall: 0.032, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } },
    handguard: { l0: 0.155, l1: 0.275, thick: 0.02, tall: 0.025, adj: { off: [0, -0.008, 0], rot: [0, 0, 0] } },
    barrel: { l0: 0.275, l1: 0.34, thick: 0.007, tall: 0.007 },
    muzzle: { l0: 0.34, l1: 0.41, thick: 0.015, tall: 0.015 },
    mag: { l0: 0, l1: 0.11, thick: 0.013, tall: 0.028, adj: { off: [0, -0.04, 0.085], rot: [78, 0, 0] } },
    mag2: { l0: 0, l1: 0.1, thick: 0.013, tall: 0.027, adj: { off: [0, -0.143, 0.106], rot: [60, 0, 0] } },
    grip: { l0: 0, l1: 0.09, thick: 0.013, tall: 0.016, adj: { off: [0, -0.045, -0.015], rot: [108, 0, 0] } },
    stockTop: { l0: -0.32, l1: -0.09, thick: 0.007, tall: 0.008, adj: { off: [0, 0.005, 0], rot: [0, 0, 0] } },
    stockLow: { l0: 0, l1: 0.235, thick: 0.007, tall: 0.008, adj: { off: [0, -0.04, -0.09], rot: [171, 0, 0] } },
    light: { l0: 0.18, l1: 0.265, thick: 0.011, tall: 0.011, adj: { off: [-0.032, -0.006, 0], rot: [0, 0, 0] } },
    lens: { l0: 0.265, l1: 0.28, thick: 0.012, tall: 0.012, adj: { off: [-0.032, -0.006, 0], rot: [0, 0, 0] } },
    lensGlow: 40,
    lightAhead: 0.285,
    gripL: { off: [0.099, -0.059, 0.149], fingers: [-0.48, -0.11, 0.19], back: [0.45, -0.85, -0.25] },   // (maintainer's viewer pass, 08-08)
    adj: { off: [0.06, 0.08, 0.09], rot: [0, 0, 0] },
  },
  sc20k: {
    hull: { l0: -0.29, l1: 0.12, thick: 0.024, tall: 0.04, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } },     // the bullpup's one polymer body: action and stock behind the grip, its bulk a centimetre under the bore line
    butt: { l0: -0.31, l1: -0.29, thick: 0.026, tall: 0.048, adj: { off: [0, -0.018, 0], rot: [0, 0, 0] } },   // the buttpad, a hair proud of the hull all round
    mag: { l0: 0, l1: 0.13, thick: 0.012, tall: 0.03, adj: { off: [0, -0.045, -0.12], rot: [84, 0, 0] } },     // the thirty-round box straight down out of the hull's floor BEHIND the grip (the bullpup's tell from above), toe canted a few degrees forward
    grip: { l0: 0, l1: 0.09, thick: 0.013, tall: 0.016, adj: { off: [0, -0.045, -0.015], rot: [108, 0, 0] } },  // the pistol grip, raked like the carbine's (the hand is on it: the same tuned hand frame)
    fore: { l0: 0.12, l1: 0.30, thick: 0.022, tall: 0.03, adj: { off: [0, -0.014, 0], rot: [0, 0, 0] } },      // the fore-end ahead of the guard
    suppressor: { l0: 0.30, l1: 0.43, thick: 0.019, tall: 0.019 },                                             // the integral can: the muzzle proper 0.52 ahead of the wrist (0.43 + the group's 0.09)
    rail: { l0: -0.16, l1: 0.16, thick: 0.011, tall: 0.008, adj: { off: [0, 0.036, 0], rot: [0, 0, 0] } },     // the top rail along the hull's spine…
    optic: { l0: -0.04, l1: 0.08, thick: 0.017, tall: 0.02, adj: { off: [0, 0.062, 0], rot: [0, 0, 0] } },     // …and the sight block riding it
    foregrip: { l0: 0, l1: 0.085, thick: 0.012, tall: 0.012, adj: { off: [0, -0.044, 0.2], rot: [90, 0, 0] } }, // the vertical foregrip: a post straight down off the fore-end's floor at 0.20 (RMB braces on it)
    light: { l0: 0.19, l1: 0.27, thick: 0.011, tall: 0.011, adj: { off: [-0.034, -0.008, 0], rot: [0, 0, 0] } },  // the weapon light's body on the fore-end's right face…
    lens: { l0: 0.27, l1: 0.285, thick: 0.012, tall: 0.012, adj: { off: [-0.034, -0.008, 0], rot: [0, 0, 0] } },  // …and its lens (lit while L has it on)
    lensGlow: 40,
    lightAhead: 0.29,
    gripL: { off: [0.06, -0.085, 0.145], fingers: [-0.3, 0.05, 0.95], back: [0.95, -0.15, 0.25] },   // the LEFT FIST round the post: wrist to its left and just behind it at mid height, metacarpals running forward along its left face, back of the hand facing out left — first-pass, for the viewer
    slung: { off: [-0.02, 0.17, -0.18], bore: [0.5, -0.866, 0.2], roll: 180, follow: 0.5 },         // flat ON the back, placed against the skinned mesh (the shadow capsules stand ~10 cm proud of the skin behind: clearing THEM floated it a hand off the back — the top-down 'plank'): the bore point 2 cm right of and 17 up from the mid-back joint (high: the game's steep camera reads anything behind the back a good 20 cm lower than it is), 18 behind the spine line; muzzle 30° left of straight down the spine and tipped 11° in toward the small of the back (the back falls away ~5 cm from shoulder blade to waist along that diagonal): its inner face rests 2–3 cm off the skin over the right shoulder blade standing (0.5–1.5 at the closest walking / running / crouched, the blade coming a centimetre into it for a frame at a kick's impact) and bridges the waist 4–8 cm off it, the stock standing off behind the shoulder above that; muzzle past the left hip, butt up behind the right shoulder (box centres within 19 cm of the spine line either side); its LEFT side to the back (roll 180: sight block toward the right hip, box magazine and foregrip post toward the left shoulder, the light's face outward — the side a sling over the left shoulder keeps to the body); turning half with the shoulders, half with the hips
    adj: { off: [0.06, 0.08, 0.09], rot: [0, 0, 0] },                                                  // the carbine's tuned hand → bore relationship (same hand, same grip)
  },
  m4: {
    hull: { l0: -0.075, l1: 0.115, thick: 0.017, tall: 0.036, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } },   // upper + lower receiver, the magazine well in its floor ahead of the grip
    butt: { l0: -0.31, l1: -0.19, thick: 0.017, tall: 0.036, adj: { off: [0, -0.02, 0], rot: [0, 0, 0] } },     // the collapsible stock, its pad where the bullpup's was (the shoulder does not move)
    mag: { l0: 0, l1: 0.14, thick: 0.011, tall: 0.03, adj: { off: [0, -0.045, 0.075], rot: [80, 0, 0] } },      // the thirty-round box down out of the well, a trigger guard ahead of the grip, raked a little forward
    fore: { l0: 0.115, l1: 0.30, thick: 0.022, tall: 0.022, adj: { off: [0, -0.003, 0], rot: [0, 0, 0] } },     // the railed handguard round the barrel, up to the can (sc20k.suppressor: the same can, the same muzzle)
    rail: { l0: -0.07, l1: 0.30, thick: 0.009, tall: 0.005, adj: { off: [0, 0.027, 0], rot: [0, 0, 0] } },      // the flat top, receiver to the handguard's nose
    optic: { l0: 0, l1: 0.07, thick: 0.016, tall: 0.02, adj: { off: [0, 0.052, 0], rot: [0, 0, 0] } },          // a holographic sight over the receiver
    tube: { l0: -0.19, l1: -0.075, thick: 0.012, tall: 0.012, adj: { off: [0, -0.002, 0], rot: [0, 0, 0] } },   // the buffer tube between receiver and stock
    peq: { l0: 0.215, l1: 0.29, thick: 0.017, tall: 0.011, adj: { off: [0, 0.043, 0], rot: [0, 0, 0] } },       // the laser box on the handguard's top rail
    gl: { l0: 0.14, l1: 0.3, thick: 0.02, tall: 0.024, adj: { off: [0, -0.05, 0], rot: [0, 0, 0] } },           // the 40 mm tube under the handguard, magazine well to the handguard's nose: its mouth is round the port the sponge round leaves (sc20kLauncherMuzzle), the post (sc20k.foregrip) comes down out of its floor
  },
};
// ---- end of paste target ----

/** albedos are not tunables (diffuse-only renderer: they just need to read as gunmetal / can / polymer / glass) */
const COL = {
  gun: [0.05, 0.05, 0.055] as Vec3, can: [0.09, 0.09, 0.095] as Vec3, torch: [0.16, 0.16, 0.17] as Vec3, lensBody: [0.3, 0.3, 0.3] as Vec3,
  gogglesLens: [0.02, 0.05, 0.03] as Vec3, gogglesHousing: [0.04, 0.045, 0.04] as Vec3,
  blade: [0.11, 0.11, 0.12] as Vec3, edge: [0.34, 0.34, 0.36] as Vec3, knifeGrip: [0.02, 0.02, 0.022] as Vec3, sheath: [0.028, 0.03, 0.026] as Vec3,   // dark steel, the ground edge lighter (its glint, in a diffuse renderer), black polymer
  furniture: [0.2, 0.085, 0.05] as Vec3,   // the carbine's plum-brown handguard, grip and bakelite magazine against its parkerised steel (COL.gun)
  anodised: [0.03, 0.03, 0.033] as Vec3, fde: [0.2, 0.155, 0.1] as Vec3, darkGlass: [0.015, 0.02, 0.022] as Vec3,   // the 2010s issue kit (gear.ts): a black receiver, flat dark earth furniture and rail, the goggle tubes' unlit glass
  haft: [0.3, 0.22, 0.07] as Vec3, sledge: [0.04, 0.04, 0.045] as Vec3,   // the dynamic hammer (BIGRIG): a yellow fibreglass handle — it has to read from above against dark kit — and a dark steel head
  polymer: [0.045, 0.05, 0.046] as Vec3, darkMetal: [0.026, 0.026, 0.03] as Vec3,   // the SC-20K: a green-black polymer hull and the darker phosphated steel of its can, box, rail and optic (throwables.ts SC20K_ITEM repeats them for the one on the floor)
};
/** the tag on the knife's boxes (Box.name): nothing in the game reads it — the QA probes count them by it (tools/qa/hold-pose-probes.ts) */
export const KNIFE_TAG = 'knife';
/** …and on the boxes of its sheath on the chest, the sheathed handle included (the probes: a tell shows these and no KNIFE_TAG box) */
export const SHEATH_TAG = 'sheath';
/** the tag on the SC-20K's boxes, in the hands or slung (Box.name): nothing in the game reads it — the QA probes tell the rifle's parts from a pistol's by it (tools/qa/gunhold-probes.ts, fn2000-probes.ts) */
export const SC20K_TAG = 'sc20k';
const PROP_FLAGS = BoxFlag.Dynamic;                      // real geometry: the gun / torch body / goggle housing shadow and occlude like anything else (owner = the character, and shadow rays skip whatever the LIGHT is mounted on, so a weapon light is never blocked by its own gun)
const GLOW_FLAGS = BoxFlag.Dynamic | BoxFlag.NoShadow;   // lit lenses stay raster-only: centimetre emitters would only be firefly bait for the gather; their light is the analytic spot / a glow

type Tree = { [k: string]: number | number[] | Tree };
function assignTree(dst: Tree, src: Tree) {
  for (const k of Object.keys(src)) {
    const s = src[k], d = dst[k];
    if (typeof s === 'number') dst[k] = s;
    else if (Array.isArray(s)) { if (Array.isArray(d) && d.length === s.length) s.forEach((x, i) => { d[i] = x; }); else dst[k] = [...s]; }
    else assignTree((typeof d === 'object' && !Array.isArray(d) ? d : (dst[k] = {})) as Tree, s);
  }
}
export function cloneRig(r: Rig): Rig { const o = {} as Rig; assignTree(o as unknown as Tree, r as unknown as Tree); return o; }
/** Deep in-place copy (keeps the RIG object identity: sliders and rigBoxes() hold on to it). */
export function assignRig(dst: Rig, src: Rig) { assignTree(dst as unknown as Tree, src as unknown as Tree); }
/** Drop every free adjustment (viewer reset: RIG_DEFAULTS has none, and assignRig only copies keys that exist in the source). */
export function clearAdjs(rig: Rig) { const walk = (o: Record<string, unknown>) => { for (const k of Object.keys(o)) { if (/adj$/i.test(k)) delete o[k]; else if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) walk(o[k] as Record<string, unknown>); } }; walk(rig as unknown as Record<string, unknown>); }
/** The shipped numbers, captured at load — the viewer's "reset". */
export const RIG_DEFAULTS: Rig = cloneRig(RIG);

/** `export const RIG: Rig = {…};` as TypeScript source in the exact layout used above (group per block, member per line, leaves inline,
 *  numbers rounded to 3 decimals) so pasting it over the block is a clean, reviewable diff. */
export function rigSource(rig: Rig = RIG): string {
  const num = (n: number) => String(+n.toFixed(3));
  const zeroAdj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && 'off' in (v as object) && 'rot' in (v as object) && [...(v as Adj).off, ...(v as Adj).rot].every(x => Math.abs(x) < 5e-4);
  const keep = ([k, x]: [string, unknown]) => !(/adj$/i.test(k) && zeroAdj(x));   // an all-zero adjustment is the same as none: leave it out of the source
  const inline = (v: unknown): string => typeof v === 'number' ? num(v) : Array.isArray(v) ? `[${v.map(x => num(x as number)).join(', ')}]`
    : `{ ${Object.entries(v as object).filter(keep).map(([k, x]) => `${k}: ${inline(x)}`).join(', ')} }`;
  const lines = ['export const RIG: Rig = {'];
  for (const [group, members] of Object.entries(rig)) {
    lines.push(`  ${group}: {`);
    for (const [k, v] of Object.entries(members as object).filter(keep)) lines.push(`    ${k}: ${inline(v)},`);
    lines.push('  },');
  }
  lines.push('};');
  return lines.join('\n');
}

/** A right-handed frame: origin + side (x), up (y), along (z) unit axes. Every group / part is laid out in one, and its Adj acts in its parent's. */
export interface Frame { o: Vec3; x: Vec3; y: Vec3; z: Vec3; }
/** Frame from an origin, an 'along' axis and an up hint (Gram-Schmidt; falls back when the axis is (anti)parallel to the hint). */
export function frameFrom(o: Vec3, along: Vec3, upHint: Vec3 = [0, 1, 0]): Frame {
  const z = v3.normalize(along);
  let y = v3.sub(upHint, v3.scale(z, v3.dot(upHint, z))); if (v3.len(y) < 1e-3) y = v3.sub([1, 0, 0], v3.scale(z, z[0]));
  y = v3.normalize(y); const x = v3.cross(y, z);
  return { o: v3.copy(o), x, y, z };
}
function rotAxis(v: Vec3, axis: Vec3, ang: number): Vec3 { return Math.abs(ang) < 1e-6 ? v : quat.rotate(quat.axisAngle(axis, ang), v); }
/** Child frame = parent frame moved by adj.off (along the parent's axes) and turned by adj.rot (degrees about the parent's x, then y, then z). */
export function applyAdj(f: Frame, adj?: Adj): Frame {
  if (!adj) return { o: v3.copy(f.o), x: f.x, y: f.y, z: f.z };
  const fo = f.o, fx = f.x, fy = f.y, fz = f.z, a0 = adj.off[0], a1 = adj.off[1], a2 = adj.off[2];
  const o: Vec3 = [((fo[0] + fx[0] * a0) + fy[0] * a1) + fz[0] * a2, ((fo[1] + fx[1] * a0) + fy[1] * a1) + fz[1] * a2, ((fo[2] + fx[2] * a0) + fy[2] * a1) + fz[2] * a2];   // (the three v3.mad's written out per component, in their order: no arrays between)
  const D = Math.PI / 180; let x = f.x, y = f.y, z = f.z;
  // (about the parent's x, then y, then z — written out: the same turns in the same order as the loop over [axis, angle] pairs this was, each axis' quaternion built once for the three vectors it turns)
  const ax = adj.rot[0] * D; if (!(Math.abs(ax) < 1e-6)) { const q = quat.axisAngle(f.x, ax); x = quat.rotate(q, x); y = quat.rotate(q, y); z = quat.rotate(q, z); }
  const ay = adj.rot[1] * D; if (!(Math.abs(ay) < 1e-6)) { const q = quat.axisAngle(f.y, ay); x = quat.rotate(q, x); y = quat.rotate(q, y); z = quat.rotate(q, z); }
  const az = adj.rot[2] * D; if (!(Math.abs(az) < 1e-6)) { const q = quat.axisAngle(f.z, az); x = quat.rotate(q, x); y = quat.rotate(q, y); z = quat.rotate(q, z); }
  return { o, x, y, z };
}
/** What the viewer needs to draw a hierarchy + gizmo: one entry per node, in draw order. `parent` is the frame the node's Adj acts in
 *  (draw the handles with ITS axes), `frame` the node's own after the adjustment; boxes [boxStart, boxStart+boxCount) in `out` are its geometry. */
export interface RigNodeMeta { path: string; label: string; depth: number; parent: Frame; frame: Frame; boxStart: number; boxCount: number; getAdj: () => Adj; }
type MetaSink = RigNodeMeta[] | undefined;
const ZERO_ADJ = (): Adj => ({ off: [0, 0, 0], rot: [0, 0, 0] });
/** Lazily materialize the Adj on its owner (so untouched nodes never appear in rigSource output). */
function adjOf<T extends object>(owner: T, key: keyof T): () => Adj { return () => ((owner[key] as unknown as Adj | undefined) ?? ((owner[key] as unknown as Adj) = ZERO_ADJ())); }

/** A bound hostage's wrist tie (character.ts MOVES.bound 1: wrists crossed behind the back): one pale strap round both wrists, drawn only while the
 *  pose shows them crossed (the bones.handL / handR within a hand of each other). A picture only: a small Dynamic box like any other rig prop. */
export function wristTieBoxes(c: Character, out: Box[]) {
  const a = c.bones.handL, b = c.bones.handR; if (!a || !b) return;
  const d = v3.sub(b, a), L = v3.len(d); if (L > 0.16) return;
  const x: Vec3 = L > 1e-4 ? v3.scale(d, 1 / L) : [1, 0, 0];
  let y: Vec3 = Math.abs(x[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]; const z = v3.normalize(v3.cross(x, y)); y = v3.cross(z, x);
  out.push(makeBox({ c: v3.scale(v3.add(a, b), 0.5), h: [L / 2 + 0.048, 0.026, 0.045], yaw: Math.atan2(z[0], z[2]), rot: quat.fromBasis(x, y, z), albedo: [0.6, 0.59, 0.55], flags: PROP_FLAGS, owner: c.id & 0xff }));
}
let curOwner = 0;   // character id stamped on the boxes rigBoxes() is emitting (set at its top)
/** One stick part as a yawed box laid along its frame's z from the frame origin (after the part's own Adj in the group frame `g`).
 *  Boxes only yaw, so the part follows the axis' heading and switches to an upright box when the axis is steep (relaxed carry, gun
 *  hanging down) instead of shearing. */
function seg(out: Box[], g: Frame, s: Seg, albedo: Vec3, emissive: Vec3 = [0, 0, 0], meta?: MetaSink, path = '', label = '', depth = 0, name?: string) {
  segAt(out, g, s, s.adj, albedo, emissive, meta, path, label, depth, name);
}
/** an unlit part's emission (read and copied per box, never handed on) */
const NO_GLOW: Vec3 = [0, 0, 0];
/** the heading and the rotation of the last frame a part WITHOUT an adjustment of its own was laid in: every such part of one group shares the group's frame object
 *  (frames are built once and never written again), so its yaw and quaternion are computed once for the group — each box still gets its own copy of the quaternion */
let rotOf: Frame | null = null, rotYaw = 0, rotQ: Quat = [0, 0, 0, 1];
/** seg() with the part's adjustment handed in (the holster hangs the hand gun's Segs with its own, or none) */
function segAt(out: Box[], g: Frame, s: Seg, adj: Adj | undefined, albedo: Vec3, emissive: Vec3, meta?: MetaSink, path = '', label = '', depth = 0, name?: string) {
  const f = adj ? applyAdj(g, adj) : g; const dir = f.z;   // (no adjustment: the part's frame IS the group's — applyAdj only ever copied its origin, and nothing below writes or keeps it)
  const mid = v3.mad(f.o, dir, (s.l0 + s.l1) / 2); const len = Math.max(0.001, (s.l1 - s.l0) / 2);   // (max: a slider dragged past l1 < l0 must not make an inside-out box)
  if (meta) meta.push({ path, label, depth, parent: g, frame: { ...f, o: mid }, boxStart: out.length, boxCount: 1, getAdj: adjOf(s, 'adj') });
  // fully oriented (raster-only props may tilt: Box.rot): thick across (frame x), tall along frame y, len along the axis
  const lit = emissive[0] + emissive[1] + emissive[2] > 0;
  let yaw: number, rot: Quat;
  if (adj) { yaw = Math.atan2(dir[0], dir[2]); rot = quat.fromBasis(f.x, f.y, f.z); }
  else { if (rotOf !== f) { rotYaw = Math.atan2(dir[0], dir[2]); rotQ = quat.fromBasis(f.x, f.y, f.z); rotOf = f; } yaw = rotYaw; rot = [rotQ[0], rotQ[1], rotQ[2], rotQ[3]]; }
  out.push({ yaw, albedo, emissive: [emissive[0], emissive[1], emissive[2]], flags: lit ? GLOW_FLAGS : PROP_FLAGS, owner: curOwner, cutHeight: 1e6, c: mid, h: [s.thick, s.tall, len], rot, name });   // (makeBox's own object, key for key, without its spread)
}

/** Flattened head 'forward' (falls back to the body heading when the head looks nearly straight up/down) — the goggle strap follows the skull's yaw only. */
function headFlatForward(c: Character): Vec3 {
  const hd = c.headDir(); const flat = Math.hypot(hd[0], hd[2]);
  if (flat > 0.2) return [hd[0] / flat, 0, hd[2] / flat];
  const fw = c.forward(); const fl = Math.hypot(fw[0], fw[2]) || 1; return [fw[0] / fl, 0, fw[2] / fl];
}

/** how far out from the brow the goggles swing half way through a flip, m (first-pass, picture only) */
const NV_SWING = 0.018;
/** The trifocal goggles: housing + three lenses in a tight triangle — down over the eyes (lit bright) when night vision is on, flipped up
 *  onto the forehead (dim) when off. The offsets live in a head frame that is either yaw-only (G.followPitch 0) or the skull's full
 *  rotation (1); the boxes' own orientation is the flattened head yaw in both cases (boxes only yaw). */
/** `k` (a flip under way — character.ts nvShown): the cluster part way between its two authored places, 0 up … 1 down; absent, 0 or 1 = the place `nv` names, as ever */
export function gogglesBoxes(c: Character, nv: boolean, out: Box[], G: Rig['goggles'], meta?: MetaSink, k?: number) {
  const head = c.bones.head; if (!head) return;
  const f = headFlatForward(c);
  let fwd: Vec3 = f, up: Vec3 = [0, 1, 0], side: Vec3 = [f[2], 0, -f[0]];        // yaw-only frame (side = quat.yaw · +X, the figure's left; the triangle is symmetric so the sign is moot)
  if (G.followPitch >= 0.5) { const q = c.headRot(); fwd = quat.rotate(q, [0, 0, 1]); up = quat.rotate(q, [0, 1, 0]); side = quat.rotate(q, [1, 0, 0]); }
  const headF: Frame = { o: v3.copy(head), x: side, y: up, z: fwd };            // the head frame: parent of the cluster
  const P = nv ? G.on : G.off;
  // cluster frame: base point (fwd/up numbers) then the state's free adjustment
  let cl = applyAdj({ ...headF, o: v3.mad(v3.mad(head, fwd, P.fwd), up, P.up) }, nv ? G.onAdj : G.offAdj);
  if (k !== undefined && k > 0 && k < 1) {   // on its way down or up: between the two places, swung a little out from the brow on the way (a mount's arc, not a slide through the forehead)
    const a = applyAdj({ ...headF, o: v3.mad(v3.mad(head, fwd, G.off.fwd), up, G.off.up) }, G.offAdj), b = applyAdj({ ...headF, o: v3.mad(v3.mad(head, fwd, G.on.fwd), up, G.on.up) }, G.onAdj);
    const z = v3.normalize(v3.lerp(a.z, b.z, k)), x = v3.normalize(v3.cross(v3.lerp(a.y, b.y, k), z)), y = v3.cross(z, x);
    cl = { o: v3.mad(v3.lerp(a.o, b.o, k), fwd, NV_SWING * Math.sin(Math.PI * k)), x, y, z };
  }
  const path = nv ? 'goggles.on' : 'goggles.off';
  if (meta) meta.push({ path, label: nv ? 'goggles (down, NV on)' : 'goggles (up, NV off)', depth: 1, parent: headF, frame: cl, boxStart: out.length, boxCount: 4, getAdj: adjOf(G, nv ? 'onAdj' : 'offAdj') });
  if (GEAR.on && G.tubes) { curOwner = c.id & 0xff;   // the 2010s issue kit: two tubes on a bridge, glass dark whichever way they are flipped (the maintainer: "i don't think we need the NVG to glow in the dark")
    const T = G.tubes, at = (f: Frame, p: Vec3): Vec3 => v3.mad(v3.mad(v3.mad(f.o, f.x, p[0]), f.y, p[1]), f.z, p[2]);
    if (meta) meta[meta.length - 1].boxCount = 6;
    const hs = applyAdj(cl, G.housingAdj), rotH = quat.fromBasis(hs.x, hs.y, hs.z), yawH = Math.atan2(hs.z[0], hs.z[2]);
    if (meta) meta.push({ path: path + '.bridge', label: 'bridge + mount arm', depth: 2, parent: cl, frame: hs, boxStart: out.length, boxCount: 2, getAdj: adjOf(G, 'housingAdj') });
    for (const part of [T.bridge, T.arm]) out.push({ yaw: yawH, albedo: COL.gogglesHousing, emissive: [0, 0, 0], flags: PROP_FLAGS, owner: curOwner, cutHeight: 1e6, c: at(hs, part.at), h: v3.copy(part.half), rot: rotH });
    const ln = applyAdj(cl, G.lensAdj), rotL = quat.fromBasis(ln.x, ln.y, ln.z), yawL = Math.atan2(ln.z[0], ln.z[2]);
    if (meta) meta.push({ path: path + '.tubes', label: 'the two tubes', depth: 2, parent: cl, frame: ln, boxStart: out.length, boxCount: 4, getAdj: adjOf(G, 'lensAdj') });
    for (const sx of [-T.side, T.side]) {
      out.push({ yaw: yawL, albedo: COL.gogglesHousing, emissive: [0, 0, 0], flags: PROP_FLAGS, owner: curOwner, cutHeight: 1e6, c: at(ln, [sx, T.down, (T.front - T.back) / 2]), h: [T.half, T.half, (T.front + T.back) / 2], rot: rotL });
      out.push({ yaw: yawL, albedo: COL.darkGlass, emissive: [0, 0, 0], flags: GLOW_FLAGS, owner: curOwner, cutHeight: 1e6, c: at(ln, [sx, T.down, T.front + T.glass]), h: [T.half * 0.8, T.half * 0.8, T.glass], rot: rotL });
    }
    return;
  }
  const glow = nv ? G.glowOn : G.glowOff;
  const hs = applyAdj({ ...cl, o: v3.mad(cl.o, cl.z, -G.housing.back) }, G.housingAdj);
  if (meta) meta.push({ path: path + '.housing', label: 'housing', depth: 2, parent: cl, frame: hs, boxStart: out.length, boxCount: 1, getAdj: adjOf(G, 'housingAdj') });
  out.push({ yaw: Math.atan2(hs.z[0], hs.z[2]), albedo: COL.gogglesHousing, emissive: [0, 0, 0], flags: PROP_FLAGS, owner: curOwner, cutHeight: 1e6, c: hs.o, h: v3.copy(G.housing.half), rot: quat.fromBasis(hs.x, hs.y, hs.z) });   // (makeBox's own object, key for key, without its spread — as seg's)
  const ln = applyAdj(cl, G.lensAdj);
  if (meta) meta.push({ path: path + '.lenses', label: 'lens triangle', depth: 2, parent: cl, frame: ln, boxStart: out.length, boxCount: 3, getAdj: adjOf(G, 'lensAdj') });
  const yawL = Math.atan2(ln.z[0], ln.z[2]); const rotL = quat.fromBasis(ln.x, ln.y, ln.z);
  for (const [ox, oy] of [[-G.lensSide, G.lensDown], [G.lensSide, G.lensDown], [0, G.lensUp]] as [number, number][]) {
    out.push({ yaw: yawL, albedo: COL.gogglesLens, emissive: v3.copy(glow), flags: GLOW_FLAGS, owner: curOwner, cutHeight: 1e6, c: v3.mad(v3.mad(ln.o, ln.x, ox), ln.y, oy), h: [G.lensHalf, G.lensHalf, G.lensThick], rot: rotL });
  }
}

/** HOW THINGS SIT IN HIS HANDS (the maintainer, 10-10: "i think hand attachment points could use some work"). Every held thing was laid out off the WRIST joint
 *  with numbers fitted by eye on the mannequin's mitten; measured against the cast's hand (wrist → knuckles 12.2 cm, the closed fist's hollow 9‥11 cm along the
 *  fingers and ~3 cm out of the palm) the can stood ON the wrist, the rifle's grip 5 cm and the pistol's 2.5 cm short of the fist, the foregrip post 6 cm short
 *  of the support hand's fingers and a magazine inside the hand. With `RigOpts.fit` (Sam, under kit handling: kitanim.ts KITANIM.grips) the DRAWN boxes move
 *  into the hand — nothing the simulation reads does: the muzzle, the bore, the gun light's pose and every other man's rig are as they were. `can`: the middle of
 *  the can in the right hand's own frame (m along the fingers, out of the PALM, toward the thumb), its axis the thumb's. `pistol` / `long`: the gun group moved
 *  in its own frame (x his left, y up, z the bore — rigid with the hand: z = the fingers, x = the palm side). `fore`: the support wrist moved back along its own
 *  fingers / out of its own back / down its own thumb line so the post stands in the hook of the fingers, the hand under the handguard. `mag`: a magazine's middle in the left hand's frame, its length along the thumb. */
export const GRIPFIT = {
  can: { fwd: 0.106, palm: 0.047, side: 0 },
  pistol: [-0.006, 0, 0.023] as Vec3,
  long: [-0.031, 0, 0.037] as Vec3,
  fore: { back: 0.062, lift: 0.011, down: 0.015 },
  mag: { fwd: 0.095, palm: 0.028, side: 0.03 },
  /** the 9 mm a defender (or a teammate without a can on his) holds, IN HAND only (inhand.ts — RigOpts.inHand): its group was fitted on the old frame 2.6 cm further out of the
   *  palm and 3.5 cm shorter along the fingers than the fitted Glock sits; this puts its grip where that one's is, in the group's own axes */
  guardPistol: [-0.026, -0.005, 0.035] as Vec3,
  /** a torch, IN HAND only: where in the fist its body is held — m along the fingers from the wrist, m out of the palm (rigProps.torchHold → Character.inHandPass) */
  torch: { fwd: 0.1, palm: 0.036 },
};
/** a gun group's frame moved by a GRIPFIT shift (in its own axes) */
function fitFrame(g: Frame, d: Vec3): Frame { return { ...g, o: v3.mad(v3.mad(v3.mad(g.o, g.x, d[0]), g.y, d[1]), g.z, d[2]) }; }
/** The hand frame the pistol group lives in: origin at the wrist, z along the bore (char.gunDir), y up out of the top of the slide
 *  (−gunUnder), x sideways. */
function pistolFrame(c: Character, hand: Vec3, P: { adj?: Adj }, inHand = false): { handF: Frame; g: Frame } {
  // (`inHand` — inhand.ts, RigOpts.inHand: the frame is the HAND's own as it is drawn this frame — the bore along its knuckle line, the top its thumb side — so the gun
  //  is rigid in the fist; character.ts inHandPass turns that hand onto the aim line while he aims, which puts a settled aim's gun where gunDir has it)
  const hf = inHand ? c.gripFrameR() : null;
  const handF: Frame = hf ? frameFrom(hand, hf.bore, hf.top) : frameFrom(hand, c.gunDir, v3.scale(c.gunUnder(), -1));
  return { handF, g: applyAdj(handF, P.adj) };
}

export interface RigOpts {
  /** wears the trifocal goggles at all (the player does, guards don't) */
  goggles: boolean;
  /** night vision on: goggles down over the eyes and blazing; off: parked on the forehead, idling */
  nv: boolean;
  /** a goggle flip under way (kitanim.ts): where they are between up (0) and down (1); absent = where `nv` says */
  nvK?: number;
  /** 1 = pistol in the right hand; anything else = empty hand (canister slot) */
  slot: number;
  /** player: rail light on (lens lit) · guard: flashlight / weapon light currently lit */
  lightOn: boolean;
  /** guard kit instead of the player's: torch when `torch`, else a drawn pistol with a weapon-light lens; no can, no goggles */
  isGuard: boolean;
  /** guard is carrying the hand torch (patrol) rather than the drawn pistol */
  torch?: boolean;
  /** guard: what is in the hands — the sidearm (default; the torch flag above then decides torch-or-pistol) or a long gun in both hands in every living state (no
   *  torch: its weapon light is his light; like the pistol it stays with a body unlit): the guards' carbine, or the SC-20K for a man handed Sam's row (the breach
   *  showcase's operatives — the same eleven boxes rigBoxes draws in Sam's hands, lens lit with lensColor × RIG.sc20k.lensGlow) */
  weapon?: 'pistol' | 'carbine' | 'sc20k';
  /** guard torch direction (the AI's smoothed beam; defaults to gunDir) */
  beamDir?: Vec3;
  /** guard light colour: lens glow = colour × RIG.torch.lensGlow while lit */
  lensColor?: Vec3;
  /** draw the sidearm holstered on the right thigh when it is not in the hand (player with a canister up; a guard on patrol carrying the torch). Off for a
   *  body whose gun has left him. */
  holster?: boolean;
  /** what an empty right hand holds when slot is 2 / 3: the canister body about to be thrown ('smoke' | 'flash'), nothing otherwise */
  held?: 'smoke' | 'flash' | 'frag' | null;
  /** player: the combat knife is in the right fist (a man held with the hands empty — combat.ts handProps sets it off Player.holding; the hold layer poses the fist) */
  knife?: boolean;
  /** player: the knife's sheath is drawn on his left chest webbing (sheathBoxes) — with the handle standing out of it unless `knife` has it in the fist. Absent =
   *  no sheath box at all: the box list as it was (combat.ts handProps raises it only with the close-in switch on) */
  sheath?: boolean;
  /** player: where the SC-20K is this frame — in the HANDS off the right wrist (the caller then passes slot 0: the Five-seveN rides the thigh), SLUNG across the back
   *  off the chest joint (RIG.sc20k.slung), or not carried at all (null / absent: the three-slot kit exactly as it was). One place or the other, never both. */
  rifle?: 'hand' | 'slung' | null;
  /** player: a slung rifle hangs in FRONT of him on its sling (SLING_FRONT below; kitanim.ts kitSlingFront: a loud kit) instead of lying across his back. Absent = the back, as ever */
  slingFront?: boolean;
  /** …and how far it is swung forward onto his thighs this frame, rad (kitanim.ts kitSlingRest: eased over time). Absent = what this pose wants, at once */
  slingRest?: number;
  /** player: the SC-20K's fore-end light is lit (its lens glows; game.ts poses the spot light itself off sc20kLightPose) */
  rifleLight?: boolean;
  /** player: held things are drawn IN the hand (GRIPFIT above; kitanim.ts KITANIM.grips). Absent = every box where it always was */
  fit?: boolean;
  /** IN HAND (inhand.ts): a pistol in his right hand is laid out in the hand's own frame (Character.gripFrameR; both kits' pistols) instead of along gunDir from
   *  the wrist. (A torch and a long gun are drawn where they always were: there the hand goes to the thing — Character.inHand.) Absent = as it always was */
  inHand?: boolean;
  /** guards: metres further out from the thigh the holster is drawn (inhand.ts INHAND.holsterOut — the defenders' long shirt hid a third of it). Absent = where it always was */
  holsterOut?: number;
  /** player: kit handling under way (KitDraw below; game/kitanim.ts fills it off the animator's swap / magazine change). Absent = every box as it always was */
  kit?: KitDraw;
  /** the 2010s carbine drawn all black (stock, grip, handguard, post, laser box) instead of dark earth: a man in the sneaking suit (combat.ts handProps asks
   *  cast.ts sneakSuit). Colours only; nothing for the bullpup. */
  rifleBlack?: boolean;
  /** THE BIG SLOT'S TOOL he carries (bigkit.ts bigCarried — null with its switch off; BIGRIG / bigBoxes below): drawn on his back, or in his hands, or between
   *  the two by `bigK` (the animator's word: character.ts bigK — absent = 0, on his back). Its boxes are the LAST of his list. Absent / null = nothing drawn:
   *  the box list as it was. `bigClear`: something else lies across his back (Sam's slung rifle), so it rides bigClearOf further off it. */
  big?: 'hammer' | 'shotgun' | null; bigK?: number; bigClear?: boolean;
  /** a guard-kit man's own gun is not in his hands (they are on the big slot's tool): a long gun hangs on its sling down his front (hungBoxes), a sidearm is
   *  on his thigh. Absent = in his hands, as ever */
  hang?: boolean;
}
/** KIT HANDLING, the drawer's half (character.ts KIT is the hand's): while Sam puts a gun away or brings one out, the gun in his fist is laid out off the HAND's own
 *  frame (the thumb side = the top of the gun — `roll` 0‥1 from the usual frame, whose roll is taken off the world's up and has no answer for a bore pointing
 *  straight down a thigh or up over a shoulder) and carried the last of the way between the hand and where it lives: `pistol` 0‥1 toward the thigh holster's frame,
 *  `rifle` 0‥1 toward the slung frame across his back (`front`: toward the sling in front of him — SLING_FRONT). A magazine change: `noMag` = the rifle's magazine is out of the well (its box not drawn), `magL` = a
 *  magazine is in the support hand (the old one on its way to the pouch, the fresh one on its way to the gun). */
export interface KitDraw { pistol?: number; rifle?: number; roll?: number; front?: boolean; rest?: number; noMag?: boolean; magL?: 'pistol' | 'rifle' | null }
/** the frame `k` of the way from a to b: origins lerped, axes slerped */
export function mixFrame(a: Frame, b: Frame, k: number): Frame {
  if (k <= 0) return a; if (k >= 1) return b;
  const q = quat.slerp(quat.fromBasis(a.x, a.y, a.z), quat.fromBasis(b.x, b.y, b.z), k);
  return { o: v3.lerp(a.o, b.o, k), x: quat.rotate(q, [1, 0, 0]), y: quat.rotate(q, [0, 1, 0]), z: quat.rotate(q, [0, 0, 1]) };
}
/** two adjustments mixed (none = zero): a part going over from how it sits in one frame to how it sits in another */
function mixAdj(a: Adj | undefined, b: Adj | undefined, k: number): Adj | undefined {
  if (k <= 0 || (!a && !b)) return a;
  const A = a ?? ADJ_NONE, B = b ?? ADJ_NONE, l = (i: number, v: 'off' | 'rot') => A[v][i] + (B[v][i] - A[v][i]) * k;
  return { off: [l(0, 'off'), l(1, 'off'), l(2, 'off')], rot: [l(0, 'rot'), l(1, 'rot'), l(2, 'rot')] };
}
const ADJ_NONE: Adj = { off: [0, 0, 0], rot: [0, 0, 0] };
/** applyAdj backwards: the PARENT frame whose child by `adj` is g (where a wrist must be, and how its hand must lie, for the gun group it carries to stand at g) */
export function unAdj(g: Frame, adj?: Adj): Frame {
  if (!adj) return { o: v3.copy(g.o), x: g.x, y: g.y, z: g.z };
  const I = applyAdj({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { off: [0, 0, 0], rot: adj.rot });   // the child's axes in the parent's own coordinates
  const ax = (k: number): Vec3 => [g.x[0] * I.x[k] + g.y[0] * I.y[k] + g.z[0] * I.z[k], g.x[1] * I.x[k] + g.y[1] * I.y[k] + g.z[1] * I.z[k], g.x[2] * I.x[k] + g.y[2] * I.y[k] + g.z[2] * I.z[k]];
  const x = ax(0), y = ax(1), z = ax(2), a = adj.off;
  return { o: [g.o[0] - x[0] * a[0] - y[0] * a[1] - z[0] * a[2], g.o[1] - x[1] * a[0] - y[1] * a[1] - z[1] * a[2], g.o[2] - x[2] * a[0] - y[2] * a[1] - z[2] * a[2]], x, y, z };
}
/** The thigh holster's group frame off three joints and the body's forward, in whatever ONE space they are given in (holsterBoxes' own construction: the world for
 *  the drawer, the animator's model space for the hand that goes to it) */
export function holsterFrameOf(th: Vec3, kn: Vec3, hp: Vec3, fwd: Vec3, H: Rig['holster'] = RIG.holster): Frame {
  const down = v3.normalize(v3.sub(kn, th));
  let outward = v3.sub(th, hp); outward = v3.sub(outward, v3.scale(down, v3.dot(outward, down))); outward[1] = 0;
  outward = v3.len(outward) > 1e-3 ? v3.normalize(outward) : v3.cross(fwd, [0, 1, 0]);
  return applyAdj(frameFrom(v3.mad(v3.mad(v3.mad(th, down, H.down), outward, H.out), fwd, H.fwd), down, fwd), H.adj);
}
/** the gun group's frame as the HAND itself has it (bore = wrist → knuckles, top = the thumb side), `roll` of the way from the usual frame `g` */
function kitGunFrame(c: Character, hand: Vec3, P: { adj?: Adj }, g: Frame, roll: number): Frame {
  const kn = c.bones.fingerR; if (!(roll > 0) || !kn) return g;
  let z = v3.sub(kn, hand); if (v3.len(z) < 1e-4) return g;
  let th = c.handFrameR().thumb; const lie = c.kitLieWorld();   // (a wrist held inside what a wrist bends: the gun keeps the line the errand asked for)
  if (lie) { z = quat.rotate(lie, z); th = quat.rotate(lie, th); }
  return mixFrame(g, applyAdj(frameFrom(hand, z, th), P.adj), roll);
}
/** a magazine in the support hand (a magazine change under way): one dark box up out of the fist */
function magBoxL(c: Character, out: Box[], kind: 'pistol' | 'rifle', fit = false) {
  const a = c.bones.handL, b = c.bones.fingerL; if (!a || !b) return;
  if (fit) { const hf = c.handFrameL(), F = GRIPFIT.mag, h: Vec3 = kind === 'rifle' ? [0.012, 0.085, 0.03] : [0.008, 0.055, 0.016];   // (in the fist: across the palm, its length up out of the thumb side)
    const x = v3.cross(hf.thumb, hf.fingers);
    out.push(makeBox({ c: v3.mad(v3.mad(v3.mad(a, hf.fingers, F.fwd), hf.back, -F.palm), hf.thumb, F.side), h, yaw: Math.atan2(hf.fingers[0], hf.fingers[2]), rot: quat.fromBasis(x, hf.thumb, hf.fingers), albedo: COL.gun, flags: PROP_FLAGS, owner: c.id & 0xff })); return; }
  const f = v3.sub(b, a), L = v3.len(f); if (L < 1e-4) return; const z = v3.scale(f, 1 / L);
  let y: Vec3 = v3.mad([0, 1, 0], z, -z[1]); y = v3.len(y) > 1e-3 ? v3.normalize(y) : [1, 0, 0]; const x = v3.cross(y, z);
  const h: Vec3 = kind === 'rifle' ? [0.012, 0.085, 0.03] : [0.008, 0.055, 0.016];
  out.push(makeBox({ c: v3.mad(v3.mad(a, z, 0.085), y, h[1] * 0.35), h, yaw: Math.atan2(z[0], z[2]), rot: quat.fromBasis(x, y, z), albedo: COL.gun, flags: PROP_FLAGS, owner: c.id & 0xff }));
}

/** Held / worn props for one character as small boxes, appended to `out` (the frame's dynamic box list).
 *  Needs the character's bones, i.e. call after char.update(). */
export function rigBoxes(c: Character, o: RigOpts, out: Box[], rig: Rig = RIG, meta?: RigNodeMeta[]) {
  kitBoxes(c, o, out, rig, meta);
  if (o.big) bigBoxes(c, o.big, o.bigK ?? 0, out, rig, !!o.bigClear, meta);   // (the big slot's tool: after everything else of his — the motion keys of the parts above are their ordinals in his list)
}
function kitBoxes(c: Character, o: RigOpts, out: Box[], rig: Rig, meta?: RigNodeMeta[]) {
  const hand = c.bones.handR; curOwner = c.id & 0xff;
  if (!o.isGuard) {
    if (hand && o.slot === 1) {
      const P = rig.pistol; const pf = pistolFrame(c, hand, P, !!o.inHand), handF = pf.handF; let g = pf.g;
      if (o.kit) {   // (kit handling: the gun rides the hand's own frame, and the last of the way to / first of the way from the holster it is carried between the two)
        g = kitGunFrame(c, hand, P, g, o.kit.roll ?? 0); if (o.fit) g = fitFrame(g, GRIPFIT.pistol);
        const th = c.bones.thighR, kn = c.bones.shinR, hp = c.bones.hips;
        if ((o.kit.pistol ?? 0) > 0 && th && kn && hp) g = mixFrame(g, holsterFrameOf(th, kn, hp, c.forward(), rig.holster), o.kit.pistol!);
      } else if (o.fit || o.inHand) g = fitFrame(g, GRIPFIT.pistol);   // (inHand: laid out in the hand's frame it is IN the hand only with the fit — whatever kit handling's own switch says)
      const hk = o.kit?.pistol ?? 0;   // (kit handling: how far it is into the holster — its parts go over to how the holstered gun hangs (holsterBoxes: no adjustments but the hung grip's rake, no rail light), so the last frame in the hand's errand IS the first on the thigh)
      if (hk > 0) {
        segAt(out, g, P.slide, mixAdj(P.slide.adj, undefined, hk), COL.gun, NO_GLOW); segAt(out, g, P.grip, mixAdj(P.grip.adj, GRIP_HUNG, hk), COL.gun, NO_GLOW); segAt(out, g, P.suppressor, mixAdj(P.suppressor.adj, undefined, hk), COL.can, NO_GLOW);
        if (hk < 0.5) seg(out, { ...g, o: v3.mad(g.o, g.y, -P.rail.under) }, P.rail, COL.torch);
      } else {
      if (meta) meta.push({ path: 'pistol', label: 'pistol (group + rail light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: o.lightOn ? 5 : 4, getAdj: adjOf(P, 'adj') });
      seg(out, g, P.slide, COL.gun, undefined, meta, 'pistol.slide', 'slide + frame', 2);
      seg(out, g, P.grip, COL.gun, undefined, meta, 'pistol.grip', 'grip', 2);
      seg(out, g, P.suppressor, COL.can, undefined, meta, 'pistol.suppressor', 'suppressor', 2);
      const under: Frame = { ...g, o: v3.mad(g.o, g.y, -P.rail.under) };          // rail light under the slide; lit lens when on
      seg(out, under, P.rail, COL.torch, undefined, meta, 'pistol.rail', 'rail light body', 2);
      if (o.lightOn) seg(out, applyAdj(under, P.rail.adj), P.lens, COL.lensBody, P.lens.glow, meta, 'pistol.lens', 'rail light lens (lit)', 2);   // the lens rides on the rail body (its adj), then its own
      }
    }
    if (o.slot !== 1) { if (o.holster) holsterBoxes(c, out, { slide: rig.pistol.slide, grip: rig.pistol.grip, suppressor: rig.pistol.suppressor }, meta, rig.holster); if (o.held) heldCanBoxes(c, o.held, out, rig.can, meta, o.fit); }   // canister up: the Five-seveN rides the thigh, the can is in the fist
    if (o.knife) knifeBoxes(c, out, rig.knife, meta);
    if (o.sheath) sheathBoxes(c, out, !o.knife, rig, meta);
    if (o.rifle === 'hand' && hand) sc20kBoxes(c, out, rig.sc20k, 'hand', o.rifleLight ? v3.scale(RAIL_LENS_COLOR, rig.sc20k.lensGlow) : [0, 0, 0], meta, rifleM4(rig), o.kit, o.fit, false, undefined, o.rifleBlack);   // the SC-20K in both hands (the animator's long-gun solve has them on it)…
    else if (o.rifle === 'slung') sc20kBoxes(c, out, rig.sc20k, 'slung', [0, 0, 0], meta, rifleM4(rig), undefined, false, o.slingFront, o.slingRest, o.rifleBlack);                                                          // …or across his back, dark
    if (o.kit?.magL) magBoxL(c, out, o.kit.magL, o.fit);
    if (o.goggles) gogglesBoxes(c, o.nvK !== undefined ? o.nvK > 0.5 : o.nv, out, rig.goggles, meta, o.nvK);
    return;
  }
  if (!hand) return;
  const HR = o.holsterOut ? { ...rig.holster, out: rig.holster.out + o.holsterOut } : undefined;   // (inhand.ts: a holster worn over a long shirt stands further off the thigh)
  if (o.weapon === 'carbine' || o.weapon === 'sc20k') {                       // a long gun in both hands in every state; riflemen wear the sidearm too, and it never leaves the thigh
    if (o.hang) hungBoxes(c, o.weapon, out, rig, false, meta);   // (his hands are on the big slot's tool: the long gun on its sling down his front, dark)
    else if (o.weapon === 'sc20k') sc20kBoxes(c, out, rig.sc20k, 'hand', o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.sc20k.lensGlow) : [0, 0, 0], meta, rifleM4(rig));
    else carbineBoxes(c, out, rig.carbine, o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.carbine.lensGlow) : [0, 0, 0], meta);
    if (o.holster !== false) holsterBoxes(c, out, { slide: rig.guardPistol.slide, grip: rig.guardPistol.grip }, meta, HR);
    return;
  }
  if (o.hang) { if (o.holster !== false) holsterBoxes(c, out, { slide: rig.guardPistol.slide, grip: rig.guardPistol.grip }, meta, HR); return; }   // (… a sidearm: on his thigh)
  const lens: Vec3 = o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.torch.lensGlow) : [0, 0, 0];
  if (o.torch && c.alive) {                                                     // torch carried in the hand (the spot light sits at its lens)
    const handF = frameFrom(hand, o.beamDir ?? c.gunDir); const g = applyAdj(handF, rig.torch.adj);
    if (meta) meta.push({ path: 'torch', label: 'hand torch (group + light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: 2, getAdj: adjOf(rig.torch, 'adj') });
    seg(out, g, rig.torch.body, COL.torch, undefined, meta, 'torch.body', 'body', 2);
    seg(out, g, rig.torch.lens, COL.lensBody, lens, meta, 'torch.lens', 'lens', 2);
    if (o.holster !== false) holsterBoxes(c, out, { slide: rig.guardPistol.slide, grip: rig.guardPistol.grip }, meta, HR);   // torch in hand → the sidearm is on his thigh
  } else {                                                                      // drawn pistol with a weapon light (a body keeps the gun, unlit)
    const pf = pistolFrame(c, hand, rig.guardPistol, !!o.inHand), handF = pf.handF, g = o.inHand ? fitFrame(pf.g, GRIPFIT.guardPistol) : pf.g;
    if (meta) meta.push({ path: 'guardPistol', label: 'guard pistol (group + light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: c.alive ? 3 : 2, getAdj: adjOf(rig.guardPistol, 'adj') });
    seg(out, g, rig.guardPistol.slide, COL.gun, undefined, meta, 'guardPistol.slide', 'slide', 2);
    seg(out, g, rig.guardPistol.grip, COL.gun, undefined, meta, 'guardPistol.grip', 'grip', 2);
    if (c.alive) seg(out, g, rig.guardPistol.lens, COL.lensBody, lens, meta, 'guardPistol.lens', 'weapon light lens', 2);
  }
}

/** Sidearm in a thigh holster: barrel down the outside of the right thigh, grip up and to the rear (top of the slide facing forward). Same part
 *  boxes as the drawn gun (slide, grip, and the player's suppressor), just hung on the leg frame instead of the hand frame. */
export function holsterBoxes(c: Character, out: Box[], parts: { slide: Seg; grip: Seg; suppressor?: Seg }, meta?: MetaSink, holsterRig?: Rig['holster']) {
  const th = c.bones.thighR, kn = c.bones.shinR, hp = c.bones.hips; if (!th || !kn || !hp) return;
  curOwner = c.id & 0xff;   // (also called on its own for a body — stamp the boxes with THIS character, not whoever rigBoxes drew last)
  const down = v3.normalize(v3.sub(kn, th)); const fwd = c.forward();
  let outward = v3.sub(th, hp); outward = v3.sub(outward, v3.scale(down, v3.dot(outward, down))); outward[1] = 0;   // away from the pelvis, level
  outward = v3.len(outward) > 1e-3 ? v3.normalize(outward) : v3.cross(fwd, [0, 1, 0]);
  const H = holsterRig ?? RIG.holster;
  const anchor = v3.mad(v3.mad(v3.mad(th, down, H.down), outward, H.out), fwd, H.fwd);
  const g = frameFrom(anchor, down, fwd);   // z down the thigh, y = body forward → the grip (−y, raked toward −z) points back and up, as holstered
  const gg = applyAdj(g, H.adj);
  if (meta) meta.push({ path: 'holster', label: 'holstered sidearm (thigh)', depth: 1, parent: g, frame: gg, boxStart: out.length, boxCount: parts.suppressor ? 3 : 2, getAdj: adjOf(H, 'adj') });   // the group owns the boxes (the parts reuse the hand gun's Segs — nothing of their own to adjust here)
  segAt(out, gg, parts.slide, undefined, COL.gun, NO_GLOW);   // (the hand gun's Segs with the holster's own adjustments in place of theirs: none, the hung grip's rake, none)
  segAt(out, gg, parts.grip, GRIP_HUNG, COL.gun, NO_GLOW);
  if (parts.suppressor) segAt(out, gg, parts.suppressor, undefined, COL.can, NO_GLOW);
}
const GRIP_HUNG: Adj = { off: [0, -0.024, 0.05], rot: [108, 0, 0] };

/** The combat knife in the right fist (RIG.knife): handle through the fist, a stub guard, then the blade out of its thumb side with the lighter edge strip on
 *  the palm side — four traced boxes carrying the character's owner byte like the rest of his kit (his own shadow rays pass through them), none emissive.
 *  Where it ends up is entirely the hand's doing: character.ts holdLayer turns the fist so the blade lies across the held man's throat. */
export function knifeBoxes(c: Character, out: Box[], K: Rig['knife'] = RIG.knife, meta?: MetaSink) {
  const hand = c.bones.handR; if (!hand) return;
  curOwner = c.id & 0xff;
  const H = c.handFrameR();
  const o = v3.mad(v3.mad(v3.mad(hand, H.fingers, K.grip.fwd), H.back, -K.grip.palm), H.thumb, K.grip.side);   // the middle of the grip: up the metacarpals from the wrist, down out of the palm into the curled fingers
  const fist: Frame = { o, x: v3.cross(H.back, H.thumb), y: H.back, z: H.thumb };                              // z the blade's way (thumb side), y the spine's (back of the hand), x through the flat
  const g = applyAdj(fist, K.adj);
  if (meta) meta.push({ path: 'knife', label: 'combat knife (right fist)', depth: 1, parent: fist, frame: g, boxStart: out.length, boxCount: 4, getAdj: adjOf(K, 'adj') });
  seg(out, g, K.handle, COL.knifeGrip, undefined, meta, 'knife.handle', 'handle', 2, KNIFE_TAG);
  seg(out, g, K.guard, COL.blade, undefined, meta, 'knife.guard', 'guard', 2, KNIFE_TAG);
  seg(out, g, K.blade, COL.blade, undefined, meta, 'knife.blade', 'blade', 2, KNIFE_TAG);
  seg(out, g, K.edge, COL.edge, undefined, meta, 'knife.edge', 'edge strip (lighter)', 2, KNIFE_TAG);
}
/** The sheath's frame in the world this frame (RIG.sheath through Character.chestFrame): origin = the middle of the sheathed handle's grip, z = the knife's line
 *  handle → tip, x = off the chest (squared to z), y = across it. Null before his first update. The probes measure the reaching fist against `o`. */
export function sheathFrame(c: Character, S: Rig['sheath'] = RIG.sheath): Frame | null {
  const C = c.chestFrame(); if (!C) return null;
  const W = (v: Vec3): Vec3 => v3.mad(v3.mad(v3.scale(C.left, v[0]), C.up, v[1]), C.fwd, v[2]);
  const z = v3.normalize(W(S.along)), x0 = W(S.out), x = v3.normalize(v3.mad(x0, z, -v3.dot(x0, z)));
  return { o: v3.add(C.o, W(S.at)), x, y: v3.cross(z, x), z };
}
/** The knife's sheath on the left chest webbing (RIG.sheath; RigOpts.sheath): the dark body over the blade always, and — `full`: the knife is in it — the
 *  knife's own handle and guard standing out of its mouth (RIG.knife's Segs along the same line, so the knife that leaves it is the knife that was in it; laid
 *  FLAT to the chest, a quarter turn from how the fist will carry it: a 2 cm matter). It rides the chest joint's frame, so it leans, twists and breathes with
 *  the trunk, and the hand that goes for it (character.ts readyLayer → sheathFist) closes on `at`. Traced boxes with his owner byte like the rest of his kit,
 *  none emissive, every one tagged SHEATH_TAG. */
export function sheathBoxes(c: Character, out: Box[], full = true, rig: Rig = RIG, meta?: MetaSink) {
  const g = sheathFrame(c, rig.sheath); if (!g) return;
  curOwner = c.id & 0xff;
  if (meta) meta.push({ path: 'sheath', label: 'knife sheath (left chest)', depth: 1, parent: g, frame: g, boxStart: out.length, boxCount: full ? 3 : 1, getAdj: ZERO_ADJ });
  seg(out, g, rig.sheath.body, COL.sheath, undefined, meta, 'sheath.body', 'sheath', 2, SHEATH_TAG);
  if (full) {
    seg(out, g, rig.knife.guard, COL.blade, undefined, meta, 'sheath.guard', 'guard (sheathed)', 2, SHEATH_TAG);
    seg(out, g, rig.knife.handle, COL.knifeGrip, undefined, meta, 'sheath.handle', 'handle (sheathed)', 2, SHEATH_TAG);
  }
}

/** A canister in the right hand (slot 2 / 3 up): the throwable's own body — smoke can olive with a red band, stun can near-black with a pale band —
 *  standing in the fist, tilted a little forward. */
function heldCanBoxes(c: Character, kind: 'smoke' | 'flash' | 'frag', out: Box[], K: Rig['can'] = RIG.can, meta?: MetaSink, fit = false) {
  const hand = c.bones.handR; if (!hand) return;
  const f = c.forward(); const axis = v3.normalize([f[0] * K.tilt, 1, f[2] * K.tilt]);
  let g0 = frameFrom(v3.mad(hand, axis, K.sink), axis, f);
  if (fit) { const hf = c.handFrameR(), F = GRIPFIT.can, mid = (K.body.l0 + K.body.l1) / 2;   // (IN the fist: its middle in the hollow of the hand, standing along the thumb's line whatever the arm does)
    g0 = frameFrom(v3.mad(v3.mad(v3.mad(hand, hf.fingers, F.fwd), hf.back, -F.palm), hf.thumb, F.side - mid), hf.thumb, hf.fingers); }
  const g = applyAdj(g0, K.adj);
  const body: Vec3 = kind === 'frag' ? [0.13, 0.17, 0.08] : kind === 'flash' ? [0.07, 0.075, 0.08] : [0.25, 0.29, 0.2]; const band: Vec3 = kind === 'frag' ? [0.75, 0.62, 0.1] : kind === 'flash' ? [0.7, 0.7, 0.66] : [0.6, 0.08, 0.06];   // (frag: throwables.ts FRAG_ITEM's olive body and yellow band)
  if (meta) meta.push({ path: 'can', label: `canister in the fist (${kind === 'frag' ? 'frag' : kind === 'flash' ? 'stun' : 'smoke'})`, depth: 1, parent: g0, frame: g, boxStart: out.length, boxCount: 2, getAdj: adjOf(K, 'adj') });
  seg(out, g, K.body, body, [0, 0, 0], meta, 'can.body');
  seg(out, g, K.band, band, [0, 0, 0], meta, 'can.band');
}

/** The carbine's group frame: the sidearm's hand frame (wrist, z along char.gunDir, y up out of the receiver) moved by the group adj onto the bore above the trigger. */
function carbineFrame(c: Character, hand: Vec3, C: Rig['carbine']): { handF: Frame; g: Frame } { return pistolFrame(c, hand, C); }
/** The guards' carbine (RIG.carbine, see the Rig doc): eleven oriented boxes off the right hand — steel in COL.gun, furniture in COL.furniture, the weapon light's
 *  body like the rail light's and its lens lit with `lens` (zero = dark). The support hand's grip point is a node of its own (no boxes) so the gizmo can drag it. */
function carbineBoxes(c: Character, out: Box[], C: Rig['carbine'], lens: Vec3, meta?: MetaSink, at?: Frame) {
  const hand = c.bones.handR; if (!hand) return;
  const { handF, g } = at ? { handF: at, g: at } : carbineFrame(c, hand, C);   // (`at`: the group's frame handed in — the gun somewhere other than his hands: hungBoxes / bigBoxes)
  if (meta) meta.push({ path: 'carbine', label: 'carbine (group + weapon light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: 11, getAdj: adjOf(C, 'adj') });
  seg(out, g, C.receiver, COL.gun, undefined, meta, 'carbine.receiver', 'receiver + cover', 2);
  seg(out, g, C.handguard, COL.furniture, undefined, meta, 'carbine.handguard', 'handguard (wood)', 2);
  seg(out, g, C.barrel, COL.gun, undefined, meta, 'carbine.barrel', 'barrel', 2);
  seg(out, g, C.muzzle, COL.gun, undefined, meta, 'carbine.muzzle', 'muzzle booster', 2);
  seg(out, g, C.mag, COL.furniture, undefined, meta, 'carbine.mag', 'magazine (upper)', 2);
  seg(out, g, C.mag2, COL.furniture, undefined, meta, 'carbine.mag2', 'magazine (lower, the curve)', 2);
  seg(out, g, C.grip, COL.furniture, undefined, meta, 'carbine.grip', 'pistol grip', 2);
  seg(out, g, C.stockTop, COL.gun, undefined, meta, 'carbine.stockTop', 'stock, top strut', 2);
  seg(out, g, C.stockLow, COL.gun, undefined, meta, 'carbine.stockLow', 'stock, lower strut', 2);
  seg(out, g, C.light, COL.torch, undefined, meta, 'carbine.light', 'weapon light body', 2);
  seg(out, g, C.lens, COL.lensBody, lens, meta, 'carbine.lens', 'weapon light lens', 2);
  if (meta) { const G = C.gripL; const o = v3.mad(v3.mad(v3.mad(g.o, g.x, G.off[0]), g.y, G.off[1]), g.z, G.off[2]); meta.push({ path: 'carbine.gripL', label: 'support hand grip point (arrows only)', depth: 2, parent: g, frame: { ...g, o }, boxStart: out.length, boxCount: 0, getAdj: () => gripAdj(G) }); }
}
/** the grip point as an Adj for the gizmo: its `off` IS gripL.off (dragging writes it); the rings' rot is accepted and ignored */
const gripAdjs = new SideMap<object, Adj>('rigProps.gripAdjs');
function gripAdj(G: Rig['carbine']['gripL']): Adj { let a = gripAdjs.get(G); if (!a || a.off !== G.off) { a = { off: G.off, rot: [0, 0, 0] }; gripAdjs.set(G, a); } return a; }

/** What the animator needs of RIG.carbine to put the support hand on the gun (character.ts CharacterAnimator.longGrip): the left wrist's point and its fingers /
 *  back-of-hand directions in the trigger hand's GUN frame (x the figure's left, y up out of the receiver, z along the bore, from the wrist) — i.e. gripL taken
 *  through the group's free adjustment. */
export function carbineGrip(rig: Rig = RIG): { wrist: Vec3; fingers: Vec3; back: Vec3 } { return longGripOf(rig.carbine.adj, rig.carbine.gripL); }
/** how far ahead of the wrist along the bore the carbine's muzzle is (Character.muzzleAhead for a rifleman: the flash, the laser, the shot's origin) */
export function carbineMuzzleAhead(rig: Rig = RIG): number { return muzzleAheadOf(rig.carbine.adj, rig.carbine.muzzle); }
/** a long gun's support-hand grip (gripL through the group adj) in the trigger hand's gun frame — the carbine's handguard point, the SC-20K's foregrip post */
function longGripOf(groupAdj: Adj | undefined, G: { off: Vec3; fingers: Vec3; back: Vec3 }): { wrist: Vec3; fingers: Vec3; back: Vec3 } {
  const g = applyAdj({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, groupAdj);
  const dirIn = (d: Vec3): Vec3 => v3.normalize(v3.mad(v3.mad(v3.scale(g.x, d[0]), g.y, d[1]), g.z, d[2]));
  return { wrist: v3.mad(v3.mad(v3.mad(g.o, g.x, G.off[0]), g.y, G.off[1]), g.z, G.off[2]), fingers: dirIn(G.fingers), back: dirIn(G.back) };
}
/** metres ahead of the wrist along the bore to the far end of a long gun's foremost part (through the group adj and the part's own) */
function muzzleAheadOf(groupAdj: Adj | undefined, part: Seg): number {
  const m = applyAdj(applyAdj({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, groupAdj), part.adj);
  return v3.mad(m.o, m.z, part.l1)[2];
}

// ---------------------------------------------------------------- Sam's SC-20K (RIG.sc20k): in the hands, or slung across the back
/** THE RIFLE ON ITS SLING IN FRONT (kit handling, a loud kit — the maintainer, 10-10: "for "loud builds" … unequipping rifle should be putting it down in a
 *  sling, not over the back"): where it hangs when it is let go of, in the same construction as RIG.sc20k.slung (sc20kFrame below) but on the CHEST — `off` from the
 *  mid-back joint in the torso's frame (x his left, y up the spine, z ahead) to the point over the grip, `bore` in those axes (muzzle down toward the left hip, the
 *  stock up by the right shoulder), its left face flat to the chest (the outward normal squared to the bore, turned `roll` about it: the top up-left, the grip
 *  down-right where the right hand finds it), `follow` = how much of the chest's own facing it takes over the hips'. Outside RIG on purpose: FIRST-PASS numbers
 *  placed against the mesh in an offline render, never seen in the renderer and not from the viewer — move them into RIG.sc20k once they have been. */
export const SLING_FRONT: Rig['sc20k']['slung'] = { off: [-0.07, 0.0, 0.2], bore: [0.55, -0.82, 0.12], roll: 180, follow: 0.85 };
/** …and how it rests on a raised thigh: `pivot` m behind the frame's origin along the bore = where the sling holds it (the stock end, by the shoulder), `len` m of
 *  rifle from there to the muzzle, `clear` m kept between its line and a thigh's (thigh joint → knee, read at `n` points), swung at most `max` rad; a point of a
 *  thigh counts in full where the rifle passes over it and fades out over `soft` m beside that, so the swing follows the legs with no jump (sc20kFrame). */
export const SLING_REST = { pivot: 0.28, len: 0.7, clear: 0.11, max: 1.4, soft: 0.1, n: 6 };
/** KIT: the right hand that holds the rifle as it hangs in front (SLING_FRONT, at rest), in the torso's axes [his left, up the spine, ahead] off the mid-back
 *  joint: the wrist, the fingers' line (= the bore: kitGunFrame lays a carried gun along the hand) and the way the back of the hand faces — character.ts kitSpot */
export function slingFrontHand(S: Rig['sc20k'] = RIG.sc20k, rest = 0): { at: Vec3; fing: Vec3; back: Vec3 } {
  const P = SLING_FRONT; let z = v3.normalize(P.bore), o: Vec3 = P.off;
  if (rest > 0) { const piv = v3.mad(o, z, -SLING_REST.pivot); z = rotAxis(z, [1, 0, 0], -Math.min(SLING_REST.max, rest)); o = v3.mad(piv, z, SLING_REST.pivot); }   // (swung onto his thighs — `rest`, kitanim.ts kitSlingRest: the turn slungBase gives the rifle itself, about his left axis at the sling's hold)
  let x: Vec3 = [-z[0] * z[2], -z[1] * z[2], 1 - z[2] * z[2]]; x = v3.len(x) < 1e-3 ? [1, 0, 0] : v3.normalize(x);
  x = rotAxis(x, z, P.roll * Math.PI / 180); const y = v3.cross(z, x), A = S.adj?.off ?? [0, 0, 0];
  return { at: [o[0] - (x[0] * A[0] + y[0] * A[1] + z[0] * A[2]), o[1] - (x[1] * A[0] + y[1] * A[1] + z[1] * A[2]), o[2] - (x[2] * A[0] + y[2] * A[1] + z[2] * A[2])], fing: z, back: v3.scale(x, -1) };
}
/** the colour its lens glows while the light is on: the rail light's own cool white (railLightDef) */
const RAIL_LENS_COLOR: Vec3 = [0.9, 0.96, 1.0];
/** The rifle's group frame. In the HANDS: the sidearm's hand frame (wrist, z along char.gunDir, y up out of the receiver) moved by the group adj onto the bore above
 *  the trigger — the carbine's construction exactly. SLUNG: in the BACK's frame — y up the spine line (hips joint → chest joint: a crouch or a kick tilts it with the
 *  back it lies on), z the way the torso faces squared to that line, blended by `slung.follow` between the root's facing (0: the hips) and the chest's (1) — the
 *  thing is rigid and bridges shoulder blade and hip, so it goes half with each: the chest's axes alone swung its muzzle end 45 cm out past the hip whenever the
 *  chest turned toward an aim or hunched (the plank in the top-down view) — x his left, origin the mid-back joint (spine2, where its middle rests): `slung.off` along
 *  those axes, z along `slung.bore` in them, lying side-flat to the back (its across axis = the back's outward normal squared to the bore) turned `slung.roll` degrees
 *  about the bore, then the free `slung.adj`. `parent` is what that node's Adj acts in (the gizmo draws its handles with it). */
/** a CAST body's back (public/assets/chars: the suit's cloth over the trunk) stands about 4 cm further behind the spine than the mannequin's, which RIG.sc20k.slung was placed
 *  against: across the back of one the rifle rides this much further out — without it the carbine's body-side face lay 1 to 1.8 cm INSIDE the suit (3.6 at a kick; its receiver
 *  is 3.4 through), the bullpup's 2.5. The mannequin, and the sling in front, are where they were. tools/qa/fn2000-probes.ts rifle-carry (3) holds it per operator outfit */
export const SLUNG_CAST_OUT = 0.03;
function slungBase(c: Character, P: Rig['sc20k']['slung'], front: boolean, rest?: number): { o: Vec3; z: Vec3; cf: Frame; want: number } {
  const b = c.bones;
  const haveJoints = !!(b.hips && b.thighL && b.thighR && b.upperArmL && b.upperArmR && b.spine2);
  const hips = b.hips ?? v3.add(c.pos, [0, 0.95, 0]), top = haveJoints ? v3.lerp(b.upperArmL, b.upperArmR, 0.5) : v3.add(c.pos, [0, 1.4, 0]), mid = b.spine2 ?? v3.lerp(hips, top, 0.5);
  let up = v3.sub(top, hips); up = v3.len(up) > 1e-3 ? v3.normalize(up) : [0, 1, 0];         // the spine line, hips joint → between the shoulder joints: the line the torso's own capsules run up (Character.capsules), so the clearance off the back holds as it bends
  const fw = c.forward(); let left: Vec3 = [fw[2], 0, -fw[0]];                                 // his left at the root (up × ahead)…
  if (haveJoints) left = v3.lerp(v3.normalize(v3.sub(b.thighL, b.thighR)), v3.normalize(v3.sub(b.upperArmL, b.upperArmR)), Math.max(0, Math.min(1, P.follow ?? 0.5)));   // …or read off the body: the hip line and the shoulder line, blended — the back's own twist between the two, whatever the clips and the aim do with either
  left = v3.mad(left, up, -v3.dot(left, up)); left = v3.len(left) > 1e-3 ? v3.normalize(left) : [fw[2], 0, -fw[0]];
  const cf: Frame = { o: mid, x: left, y: up, z: v3.cross(left, up) };                         // x his left, y up the spine, z the way the back faces (left × up = ahead)
  const inC = (d: Vec3): Vec3 => v3.mad(v3.mad(v3.scale(cf.x, d[0]), cf.y, d[1]), cf.z, d[2]);
  let o = v3.add(mid, inC(!front && c.ch.cast ? [P.off[0], P.off[1], P.off[2] - SLUNG_CAST_OUT] : P.off)), z = v3.normalize(inC(P.bore));
  let want = 0;
  if (front) { const a = rest ?? (want = slingSwing(c, cf, o, z)); if (a > 0) { const piv = v3.mad(o, z, -SLING_REST.pivot); z = rotAxis(z, cf.x, -Math.min(SLING_REST.max, a)); o = v3.mad(piv, z, SLING_REST.pivot); } }   // (resting on a raised thigh: swung forward about where the sling holds its stock end)
  return { o, z, cf, want };
}
/** How far a rifle hanging in front must swing forward (rad about his left axis, at the sling's hold) to lie over both thighs as posed: 0 standing, most of a
 *  right angle in a crouch. Worked in the plane across his left axis, where the swing is a plain turn: every point of the rifle keeps its distance from the pivot and
 *  its place across him, so a point of a thigh is in its way only where the rifle passes at that place across him and that distance out — a weight that fades over
 *  `soft`. A gait still moves it a quarter turn in a few frames: whoever draws a man over TIME eases toward it (kitanim.ts kitSlingRest → RigOpts.slingRest). */
function slingSwing(c: Character, cf: Frame, o: Vec3, z: Vec3): number {
  const b = c.bones; if (!(b.thighL && b.thighR && b.shinL && b.shinR)) return 0;
  const F = SLING_REST, piv = v3.mad(o, z, -F.pivot), zx = v3.dot(z, cf.x), zs = Math.sqrt(Math.max(1e-6, 1 - zx * zx)), ang = (f: number, u: number) => Math.atan2(f, -u), a0 = ang(v3.dot(z, cf.z), v3.dot(z, cf.y));
  let a = 0;
  for (const [j0, j1] of [[b.thighL, b.shinL], [b.thighR, b.shinR]] as const) for (let i = 1; i <= F.n; i++) {
    const v = v3.sub(v3.lerp(j0, j1, i / F.n), piv), l = v3.dot(v, cf.x), f = v3.dot(v, cf.z), u = v3.dot(v, cf.y), r = Math.hypot(f, u); if (r < 1e-3) continue;
    // the rifle's stretch that passes within `clear` of this point's place across him, as distances out from the pivot → how far the point's own distance is from that stretch
    const k = zs / (Math.abs(zx) > 1e-3 ? zx : 1e-3), r0 = Math.max(0, Math.min((l - F.clear) * k, (l + F.clear) * k)), r1 = Math.min(F.len * zs, Math.max((l - F.clear) * k, (l + F.clear) * k));
    const d = r1 < r0 ? Infinity : r < r0 ? r0 - r : r > r1 ? r - r1 : 0, w = Math.max(0, Math.min(1, 1 - (d - F.clear) / F.soft)); if (w <= 0) continue;
    a = Math.max(a, w * (ang(f, u) + Math.asin(Math.min(1, F.clear / r)) - a0));
  }
  return Math.min(F.max, a);
}
/** …asked from outside: the swing a front-slung rifle wants on this pose (the target kitanim.ts eases toward) */
export function slingRestWant(c: Character): number { return slungBase(c, SLING_FRONT, true).want; }
function sc20kFrame(c: Character, S: Rig['sc20k'], where: 'hand' | 'slung', front = false, rest?: number): { parent: Frame; g: Frame } {
  if (where === 'hand') { const { handF, g } = pistolFrame(c, c.bones.handR ?? c.muzzle, S); return { parent: handF, g }; }
  if (!front) { const side = packSide(c, 'rifle'); if (side) return { parent: side, g: side }; }   // (packside.ts: across a back that wears a pack it stands at the pack's left side instead)
  const P: Rig['sc20k']['slung'] = front ? SLING_FRONT : S.slung, { o, z, cf } = slungBase(c, P, front, rest);
  const out = front ? 1 : -1; let x = v3.mad(v3.scale(cf.z, out), z, -out * v3.dot(cf.z, z));                              // the outward normal of the side it lies on (the back: −z of the back frame; the chest, in front: +z) squared to the bore: the rifle's across axis — side flat on the back
  if (v3.len(x) < 1e-3) x = cf.x; x = v3.normalize(x); x = rotAxis(x, z, P.roll * Math.PI / 180);
  const base: Frame = { o, x, y: v3.cross(z, x), z };
  return { parent: base, g: applyAdj(base, P.adj) };
}
/** Sam's SC-20K (see the Rig doc): eleven oriented boxes — the polymer hull, buttpad, grip, fore-end and foregrip; the darker can, box, rail and optic; the light body
 *  and its lens (lit with `lens`, zero = dark) — off the right hand ('hand') or across the back ('slung'). The support hand's grip point is a node of its own (no
 *  boxes) so the gizmo can drag it, as the carbine's is. Standalone-safe: stamps the boxes with THIS character. */
export function sc20kBoxes(c: Character, out: Box[], S: Rig['sc20k'] = RIG.sc20k, where: 'hand' | 'slung' = 'hand', lens: Vec3 = [0, 0, 0], meta?: MetaSink, M: Rig['m4'] | null = null, kit?: KitDraw, fit = false, front = false, rest?: number, black = false) {
  curOwner = c.id & 0xff;
  const fr = sc20kFrame(c, S, where, front, rest), parent = fr.parent; let g = fr.g;
  if (kit && where === 'hand' && c.bones.handR) {   // (kit handling: it rides the hand's own frame up over the shoulder, then goes down his back — or comes up off it — between the hand and the sling)
    g = kitGunFrame(c, c.bones.handR, S, g, kit.roll ?? 0); if (fit) g = fitFrame(g, GRIPFIT.long);
    if ((kit.rifle ?? 0) > 0) g = mixFrame(g, sc20kFrame(c, S, 'slung', !!kit.front, kit.rest).g, kit.rifle!);
  } else if (fit && where === 'hand') g = fitFrame(g, GRIPFIT.long);
  const slung = where === 'slung';
  const k = M ? 'm4' : 'sc20k';   // (`M` = the 2010s carbine's own parts over the same group: rifleM4 below hands it in. The first eleven boxes are the same parts in the same order either way;
                                  //  the group's node and every shared part keep their sc20k paths — the viewer's rows and 'copy constants' edit the table that is read)
  const body = M ? COL.anodised : COL.polymer, furn = M ? (black ? COL.polymer : COL.fde) : COL.polymer, metal = M ? COL.anodised : COL.darkMetal;   // (`black` = RigOpts.rifleBlack: the carbine's dark earth furniture and laser box in black polymer — the sneaking suit's rifle; the bullpup never had any tan)
  if (meta) meta.push({ path: slung ? 'sc20k.slung' : 'sc20k', label: (M ? 'M4' : 'SC-20K') + (slung ? ' (slung across the back)' : ' (group + weapon light)'), depth: 1, parent, frame: g, boxStart: out.length, boxCount: M ? M4_BOXES : 11, getAdj: slung ? adjOf(S.slung, 'adj') : adjOf(S, 'adj') });
  seg(out, g, M ? M.hull : S.hull, body, undefined, meta, k + '.hull', M ? 'receiver' : 'hull (action + stock, polymer)', 2, SC20K_TAG);
  seg(out, g, M ? M.butt : S.butt, furn, undefined, meta, k + '.butt', M ? 'stock' : 'buttpad', 2, SC20K_TAG);
  if (!kit?.noMag || meta) seg(out, g, M ? M.mag : S.mag, metal, undefined, meta, k + '.mag', M ? 'magazine (ahead of the grip)' : 'magazine (behind the grip)', 2, SC20K_TAG);
  seg(out, g, S.grip, furn, undefined, meta, 'sc20k.grip', 'pistol grip', 2, SC20K_TAG);
  seg(out, g, M ? M.fore : S.fore, furn, undefined, meta, k + '.fore', M ? 'handguard' : 'fore-end', 2, SC20K_TAG);
  seg(out, g, S.suppressor, metal, undefined, meta, 'sc20k.suppressor', M ? 'suppressor' : 'integral suppressor', 2, SC20K_TAG);
  seg(out, g, M ? M.rail : S.rail, M ? COL.anodised : COL.darkMetal, undefined, meta, k + '.rail', 'top rail', 2, SC20K_TAG);
  seg(out, g, M ? M.optic : S.optic, metal, undefined, meta, k + '.optic', M ? 'sight' : 'sight block', 2, SC20K_TAG);
  seg(out, g, S.foregrip, furn, undefined, meta, 'sc20k.foregrip', 'foregrip (vertical post)', 2, SC20K_TAG);
  seg(out, g, S.light, COL.torch, undefined, meta, 'sc20k.light', 'weapon light body', 2, SC20K_TAG);
  seg(out, g, S.lens, COL.lensBody, lens, meta, 'sc20k.lens', 'weapon light lens', 2, SC20K_TAG);
  if (M) {
    seg(out, g, M.tube, metal, undefined, meta, 'm4.tube', 'buffer tube', 2, SC20K_TAG); seg(out, g, M.peq, black ? COL.polymer : COL.fde, undefined, meta, 'm4.peq', 'laser box', 2, SC20K_TAG);
    seg(out, g, M.gl, metal, undefined, meta, 'm4.gl', '40 mm launcher tube', 2, SC20K_TAG);
  }
  if (meta && !slung) { const G = S.gripL; const o = v3.mad(v3.mad(v3.mad(g.o, g.x, G.off[0]), g.y, G.off[1]), g.z, G.off[2]); meta.push({ path: 'sc20k.gripL', label: 'support hand grip point (arrows only)', depth: 2, parent: g, frame: { ...g, o }, boxStart: out.length, boxCount: 0, getAdj: () => gripAdj(G) }); }
}
/** how many boxes the 2010s carbine is (the bullpup's eleven + buffer tube, laser box, launcher tube) */
export const M4_BOXES = 14;
/** the 2010s carbine's parts while gear.ts's switch has it drawn, else null = the bullpup (sc20kBoxes' last argument; every reader of where the gun IS — the four
 *  functions below — is on rig.sc20k whichever is drawn) */
export function rifleM4(rig: Rig = RIG): Rig['m4'] | null { return GEAR.on ? rig.m4 ?? null : null; }
/** the SC-20K's support-hand grip for the animator (character.ts longGrip): the foregrip post's fist point + directions through the group adj, as carbineGrip */
export function sc20kGrip(rig: Rig = RIG, fit = false): { wrist: Vec3; fingers: Vec3; back: Vec3 } {
  const G = longGripOf(rig.sc20k.adj, rig.sc20k.gripL); if (!fit) return G;
  const d = GRIPFIT.long, F = GRIPFIT.fore;   // (GRIPFIT: the gun as drawn has moved in the trigger hand, and the post belongs in the hook of this hand's fingers)
  return { wrist: v3.mad(v3.mad(v3.mad(v3.add(G.wrist, d), G.fingers, -F.back), G.back, -F.lift), v3.normalize(v3.cross(G.fingers, G.back)), -F.down), fingers: G.fingers, back: G.back };
}
/** IN HAND (inhand.ts): what the look-only hand pass is told of a long gun in his hands — how far its pistol grip is from where his palm is, in the trigger
 *  hand's gun frame (x his left, y the gun's top, z the bore). The gun, its muzzle and its light stay where the simulation has them; the HAND goes those few
 *  centimetres. The same measured shift a fitted rifle is drawn by (GRIPFIT.long), the other way round. */
export function longHold(weapon: 'carbine' | 'sc20k', rig: Rig = RIG): InHandWord {
  const g = applyAdj({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, weapon === 'sc20k' ? rig.sc20k.adj : rig.carbine.adj), d = GRIPFIT.long;
  return { kind: 'long', by: v3.scale(v3.mad(v3.mad(v3.scale(g.x, d[0]), g.y, d[1]), g.z, d[2]), -1) };
}
/** …and of a torch: the line its beam leaves along, and in that beam's frame the point of its body his fist goes round (the group's own origin, from the wrist) and the way its body lies */
export function torchHold(beam: Vec3, rig: Rig = RIG): InHandWord {
  const g = applyAdj({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, rig.torch.adj);
  return { kind: 'torch', beam, at: g.o, axis: g.z, fwd: GRIPFIT.torch.fwd, palm: GRIPFIT.torch.palm };
}
/** how far ahead of the wrist along the bore its muzzle is — the far face of the suppressor (Character.muzzleAhead while it is in the hands; the row says 0.52 too) */
export function sc20kMuzzleAhead(rig: Rig = RIG): number { return muzzleAheadOf(rig.sc20k.adj, rig.sc20k.suppressor); }
/** its weapon light: at the lens on the fore-end, pointing down the bore (game.ts poses Player.light off this while the rifle is up and L has it on) */
export function sc20kLightPose(c: Character, rig: Rig = RIG): { pos: Vec3; dir: Vec3 } {
  const S = rig.sc20k; const { g } = sc20kFrame(c, S, 'hand'); const l = applyAdj(g, S.lens.adj);
  return { pos: v3.mad(l.o, l.z, S.lightAhead), dir: g.z };
}
/** where a ring leaves it: the launcher port under the fore-end's nose, a hand under the bore just short of the can (launcher.ts fires from here along the aim) */
export function sc20kLauncherMuzzle(c: Character, rig: Rig = RIG): Vec3 {
  const S = rig.sc20k; const { g } = sc20kFrame(c, S, 'hand'); const f = applyAdj(g, S.fore.adj);
  return v3.mad(v3.mad(f.o, f.z, S.fore.l1), f.y, -(S.fore.tall + 0.02));
}
/** The carbine's weapon light: at the lens part on the handguard, pointing down the bore — the light IS where the muzzle points. */
export function carbineLightPose(c: Character, rig: Rig = RIG): { pos: Vec3; dir: Vec3 } {
  const C = rig.carbine; const { g } = carbineFrame(c, c.bones.handR ?? c.muzzle, C);
  const l = applyAdj(g, C.lens.adj);
  return { pos: v3.mad(l.o, l.z, C.lightAhead), dir: g.z };
}

/** The player's rail light: physically mounted under the barrel, so its position and direction ARE the gun's, aiming or not —
 *  lens `lightAhead` along the bore from the wrist and `lightUnder` below the bore axis. */
export function rigLightPose(c: Character, rig: Rig = RIG): { pos: Vec3; dir: Vec3 } {
  const { g } = pistolFrame(c, c.bones.handR ?? c.muzzle, rig.pistol);        // follows the pistol group's free adjustment…
  const r = applyAdj({ ...g, o: v3.mad(g.o, g.y, -rig.pistol.lightUnder) }, rig.pistol.rail.adj);   // …and the rail body's, so the beam leaves the drawn lens
  return { pos: v3.mad(r.o, r.z, rig.pistol.lightAhead), dir: r.z };
}

/** A guard's light origin along its beam: at the torch lens on patrol, at the weapon-light slot when the pistol is drawn, at the carbine's lens for a rifleman (the SC-20K's for a man carrying that). */
export function rigTorchPos(c: Character, dir: Vec3, torch: boolean, rig: Rig = RIG, weapon: 'pistol' | 'carbine' | 'sc20k' = 'pistol'): Vec3 {
  if (weapon === 'carbine') return carbineLightPose(c, rig).pos;
  if (weapon === 'sc20k') return sc20kLightPose(c, rig).pos;
  const hand = c.bones.handR ?? c.muzzle;
  const g = torch ? applyAdj(applyAdj(frameFrom(hand, dir), rig.torch.adj), rig.torch.lens.adj) : applyAdj(pistolFrame(c, hand, rig.guardPistol).g, rig.guardPistol.lens.adj);   // follows the group's AND the lens part's free adjustment: the beam starts at the drawn lens
  return v3.mad(g.o, g.z, torch ? rig.torch.lightAhead : rig.guardPistol.lightAhead);
}

/** The player's rail light — a small, tight, cool-white weapon light. Declared once for game.ts and the viewer; parked and off until posed. */
export function railLightDef(owner: number, intensity: number): RtLight {
  return { name: 'pistol_light', group: 'player', kind: 1, pos: [0, -10, 0], dir: [0, 0, 1], color: [0.9, 0.96, 1.0], intensity, range: 18, innerDeg: 5, outerDeg: 15, radius: 0.035, volumetric: 1.0, owner, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: intensity, card: true };   // card: its footprint is a torch bounce card under settings.torchBounceCards (render/shaders/cards.wgsl)
}
/** A guard's torch / weapon light — warm and wider; the cone angles are game tunables. */
export function torchLightDef(name: string, owner: number, intensity: number, innerDeg: number, outerDeg: number): RtLight {
  return { name, group: 'flashlights', kind: 1, pos: [0, -10, 0], dir: [0, 0, 1], color: [1.0, 0.92, 0.78], intensity, range: 16, innerDeg, outerDeg, radius: 0.05, volumetric: 1.0, owner, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: intensity, card: true };
}

/** Relaxed torch carry (torch in the swinging hand): the beam follows the chest / aim heading, tilted by the aim pitch, and is smoothed
 *  from last frame's `prev` so the arm swing only bobs the origin, never the direction. Returns the new beam direction. The smoothing is per
 *  SECOND (1 − e^(−13·dt): 0.195 of the way at 60 Hz, the old per-frame fifth — which at 30 fps eased the beam, and with it what the light
 *  meter reads off it, half as fast: review B7.6). */
export function torchCarryDir(c: Character, prev: Vec3, dt = 1 / 60): Vec3 {
  const f: Vec3 = [Math.sin(c.aimYaw), 0, Math.cos(c.aimYaw)];
  const want = v3.normalize([f[0] * 0.5 + c.chestDir[0] * 0.5, Math.tan(c.aimPitch), f[2] * 0.5 + c.chestDir[2] * 0.5]);
  return v3.normalize(v3.lerp(prev, want, 1 - Math.exp(-TORCH_CARRY_RATE * Math.max(0, dt))));
}
/** /s: the relaxed torch carry's easing rate toward the chest / aim heading (torchCarryDir) */
const TORCH_CARRY_RATE = 13;

// ---------------------------------------------------------------- the big slot's tools (bigkit.ts): the dynamic hammer, the breaching shotgun as kit
/** THE BIG SLOT'S TOOLS AS THINGS A MAN CARRIES (the maintainer, 10-15: "the character should have a hammer on their back, they put away their gun, equip the
 *  hammer, wind up, and then hit the door in one motion"; character.ts BIGMOVE / bigLayer is the hands' half and reads `grip`, `hands`, `headAt` and `back` here).
 *  `hammer`: a sledge 0.8 m long, laid out along its handle (z, butt → head) from THE RIGHT FIST'S GRIP — in the hands that is the fist's own frame, the knife's
 *  construction (origin = the middle of the grip: `grip.fwd` along the fingers from the wrist, `grip.palm` out of the palm; z out of the thumb side, x across the
 *  knuckles): the handle through the fist with the head `headAt` beyond it (its middle), the left fist `hands` down the handle toward the butt. The head's long
 *  axis is x: it strikes the way the knuckles lead. `back`: where it rides when it is not in the hands, in the back's own frame (RIG.sc20k.slung's construction:
 *  `off` from the mid-back joint along [his left, up the spine, ahead] to that same grip point, `bore` = the handle's line, butt → head, `roll` ° about it,
 *  `follow` the chest's share of the facing): head up behind the right shoulder — where a right hand over that shoulder finds the handle just under it — the
 *  handle down across the back toward the spine. `shotgun`: carried, it is a long gun's boxes (the carbine's: the M870 has no parts of its own yet) in the
 *  slung rifle's own place across the back; in Sam's hands, off his right hand like any long gun. `clear`: with something else across his back (Sam's slung
 *  rifle) the tool rides this much further off it, so the two do not lie inside each other — a number a tool, measured box against box (bigslot-check, 'over
 *  the rifle'): the shotgun lies along the rifle's own line, a receiver's thickness out; the hammer's head sits where the rifle's stock stands off behind the
 *  right shoulder, and at the shotgun's 7.5 cm lay 2.6 cm inside the bullpup's hull and 1.8 inside the carbine's stock. bigClearOf below is the distance asked
 *  for: this plus whatever the rifle itself rides out on the body that carries it. Outside RIG on purpose, as SLING_FRONT: FIRST-PASS numbers placed
 *  against headless stick strips (tools/qa/bigmoves-strip.ts), never seen in the renderer and not from the viewer. */
export const BIGRIG = {
  hammer: {
    handle: { l0: -0.46, l1: 0.265, thick: 0.02, tall: 0.02 } as Seg,
    head: { l0: 0.265, l1: 0.335, thick: 0.085, tall: 0.045 } as Seg,
    grip: { fwd: 0.08, palm: 0.03, side: 0 }, hands: 0.36, headAt: 0.3,
    back: { off: [-0.055, 0.01, -0.19], bore: [-0.42, 0.91, 0], roll: 90, follow: 0.5 } as Rig['sc20k']['slung'],
  },
  shotgun: { back: { off: [-0.02, 0.17, -0.18], bore: [0.5, -0.866, 0.2], roll: 180, follow: 0.5 } as Rig['sc20k']['slung'] },
  clear: { hammer: 0.11, shotgun: 0.075 },
};
/** How far off his back the big slot's tool rides with his rifle slung under it: BIGRIG.clear for the tool, and as much again as slungBase itself puts the
 *  rifle out past `slung.off` on THIS body (read off its answer, so a body the rifle is moved out on carries the tool out with it and the two keep their
 *  gap; nothing where slungBase adds nothing — every body, as this is written; the free `slung.adj` is the viewer's and is not followed). The drawer
 *  (bigBoxes) asks here, and combat.ts hands the same distance to the hand that goes for the handle (character.ts bigLayer, `bigClear`). */
export function bigClearOf(c: Character, kind: 'hammer' | 'shotgun', rig: Rig = RIG): number {
  const P = rig.sc20k.slung, s = slungBase(c, P, false), out = P.off[2] - v3.dot(v3.sub(s.o, s.cf.o), s.cf.z);
  return BIGRIG.clear[kind] + (Math.abs(out) < 1e-6 ? 0 : out);
}
/** PACK SIDE (packside.ts), the drawer's half: the sizes of the thing the rule stands at a pack's side, read off the tables that draw it — the hammer's
 *  handle and head; a long gun's butt end, its half thickness on the face that lies on the pack (the shotgun, on the pack's right, its bare left face; the
 *  rifle, on the pack's left, the face its weapon light stands on) and how far its top (the sight on a rifle) stands over the bore */
export function packSideDims(what: 'hammer' | 'shotgun' | 'rifle', rig: Rig = RIG): { grip?: number; thick: number; head?: Vec3; rear?: number; top?: number; len: number } {
  if (what === 'hammer') { const H = BIGRIG.hammer; return { grip: H.headAt, thick: H.handle.thick, head: [H.head.thick, H.head.tall, (H.head.l1 - H.head.l0) / 2], len: H.headAt - H.handle.l0 }; }
  if (what === 'shotgun') { const C = rig.carbine; return { rear: -C.stockTop.l0, thick: Math.max(C.receiver.thick, C.handguard.thick), top: C.receiver.tall + (C.receiver.adj?.off[1] ?? 0), len: C.muzzle.l1 - C.stockTop.l0 }; }
  const S = rig.sc20k, M = rifleM4(rig), O = M ? M.optic : S.optic;
  return { rear: -(M ? M.butt.l0 : S.butt.l0), thick: Math.max(S.hull.thick, -(S.light.adj?.off[0] ?? 0) + S.lens.thick), top: (O.adj?.off[1] ?? 0) + O.tall, len: S.suppressor.l1 - (M ? M.butt.l0 : S.butt.l0) };
}
/** … and the place itself, in the bind space of the mesh he wears, turned about its top end to lie along his back as he is posed (null with the switch off
 *  or no pack worn: across his back, as ever) */
export function packSideBind(c: Character, what: 'hammer' | 'shotgun' | 'rifle', rig: Rig = RIG): SidePlace | null {
  const e = packOf(c.ch, c.parts); if (!e) return null;
  const p = sideBind(e, what, packSideDims(what, rig)); return sidePitched(p, sidePitch(c.ch, p, c.skel.jointData));
}
/** … carried into the world by the chest joint's skin matrix, as the pack's own vertices are */
function packSide(c: Character, what: 'hammer' | 'shotgun' | 'rifle', rig: Rig = RIG): Frame | null {
  const p = packSideBind(c, what, rig); if (!p) return null;
  const j = chestJoint(c.ch); return j < 0 ? null : sideSkinned(p, c.skel.jointData, j * 16);
}
/** the tag on the big slot's hammer's boxes (Box.name): nothing in the game reads it — the strips and the checks tell them by it */
export const BIG_TAG = 'big';
/** Where a thing across the back is, off six joints in whatever ONE space they are given in (slungBase's own construction, without its fallbacks: the world for
 *  the drawer, the animator's model space for the hand that goes to it — character.ts bigLayer): the point `P.off` and the line `P.bore` in the back's frame
 *  `cf` (x his left, y up the spine line hips → between the shoulders, z the way the torso faces), `clear` m further off the back. */
export function bigBackOf(hips: Vec3, mid: Vec3, thL: Vec3, thR: Vec3, uaL: Vec3, uaR: Vec3, P: Rig['sc20k']['slung'], clear = 0): { o: Vec3; z: Vec3; cf: Frame } {
  let up = v3.sub(v3.lerp(uaL, uaR, 0.5), hips); up = v3.len(up) > 1e-3 ? v3.normalize(up) : [0, 1, 0];
  let left = v3.lerp(v3.normalize(v3.sub(thL, thR)), v3.normalize(v3.sub(uaL, uaR)), Math.max(0, Math.min(1, P.follow ?? 0.5)));
  left = v3.mad(left, up, -v3.dot(left, up)); left = v3.len(left) > 1e-3 ? v3.normalize(left) : v3.normalize(v3.sub(uaL, uaR));
  const cf: Frame = { o: mid, x: left, y: up, z: v3.cross(left, up) };
  const inC = (d: Vec3): Vec3 => v3.mad(v3.mad(v3.scale(cf.x, d[0]), cf.y, d[1]), cf.z, d[2]);
  return { o: v3.add(mid, inC([P.off[0], P.off[1], P.off[2] - clear])), z: v3.normalize(inC(P.bore)), cf };
}
/** The big slot's tool on a man (RigOpts.big; standalone-safe: stamps the boxes with THIS character): on his back (k 0), in his hands (1 — the hammer off the
 *  right fist's own frame, the shotgun off the right hand like the carbine it is drawn as), or carried between the two by `k`, as kit handling carries a gun.
 *  Traced boxes with his owner byte like the rest of his kit, none lit. */
export function bigBoxes(c: Character, kind: 'hammer' | 'shotgun', k: number, out: Box[], rig: Rig = RIG, clear = false, meta?: MetaSink) {
  const b = c.bones; if (!(b.hips && b.spine2 && b.thighL && b.thighR && b.upperArmL && b.upperArmR)) return;
  curOwner = c.id & 0xff;
  const across = (): Frame => { const P = kind === 'hammer' ? BIGRIG.hammer.back : BIGRIG.shotgun.back, bk = bigBackOf(b.hips!, b.spine2!, b.thighL!, b.thighR!, b.upperArmL!, b.upperArmR!, P, clear ? bigClearOf(c, kind, rig) : 0);
    let x = v3.mad(v3.scale(bk.cf.z, -1), bk.z, v3.dot(bk.cf.z, bk.z)); x = rotAxis(v3.len(x) < 1e-3 ? bk.cf.x : v3.normalize(x), bk.z, P.roll * Math.PI / 180);   // (sc20kFrame's: the back's outward normal squared to the line, turned `roll` about it)
    return applyAdj({ o: bk.o, x, y: v3.cross(bk.z, x), z: bk.z }, P.adj); };
  const onBack = packSide(c, kind, rig) ?? across();   // (packside.ts: he wears a pack — the tool stands at its right side and moves with it)
  let g = onBack; const hand = b.handR;
  if (k > 0 && hand) {
    if (kind === 'hammer') { const H = c.handFrameR(), K = BIGRIG.hammer.grip;
      g = mixFrame(onBack, { o: v3.mad(v3.mad(v3.mad(hand, H.fingers, K.fwd), H.back, -K.palm), H.thumb, K.side), x: v3.cross(H.back, H.thumb), y: H.back, z: H.thumb }, k);
    } else g = mixFrame(onBack, carbineFrame(c, hand, rig.carbine).g, k);
  }
  if (kind === 'shotgun') { carbineBoxes(c, out, rig.carbine, [0, 0, 0], meta, g); return; }
  if (meta) meta.push({ path: 'big.hammer', label: 'dynamic hammer (big slot)', depth: 1, parent: onBack, frame: g, boxStart: out.length, boxCount: 2, getAdj: ZERO_ADJ });
  segAt(out, g, BIGRIG.hammer.handle, undefined, COL.haft, NO_GLOW, undefined, '', '', 0, BIG_TAG);
  segAt(out, g, BIGRIG.hammer.head, undefined, COL.sledge, NO_GLOW, undefined, '', '', 0, BIG_TAG);
}
/** A man's OWN long gun let go of for the big slot's tool: on its sling down his front (SLING_FRONT's place, swung onto his thighs as his pose asks), dark —
 *  the guards' carbine or the SC-20K. Standalone-safe. */
export function hungBoxes(c: Character, weapon: 'carbine' | 'sc20k', out: Box[], rig: Rig = RIG, black = false, meta?: MetaSink) {
  if (weapon === 'sc20k') { sc20kBoxes(c, out, rig.sc20k, 'slung', [0, 0, 0], meta, rifleM4(rig), undefined, false, true, undefined, black); return; }
  curOwner = c.id & 0xff;
  carbineBoxes(c, out, rig.carbine, [0, 0, 0], meta, sc20kFrame(c, rig.sc20k, 'slung', true).g);
}
