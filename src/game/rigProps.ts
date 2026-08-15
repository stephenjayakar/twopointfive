// Rig props: every number that places something ON the mannequin — the trifocal goggles on the head, the Five-seveN with its
// under-barrel rail light in the right hand, the combat knife in the fist for a hands-empty hold, the guards' hand torch / weapon
// light, their carbine, Sam's SC-20K in his hands or slung across his back — lives in RIG, and rigBoxes() / rigLightPose() / carbineLightPose() / sc20kLightPose() turn it into the prop boxes and the lights' poses. The character viewer (viewer.html → src/viewer.ts) drives the
// same functions with sliders bound to RIG and its "copy constants" button emits the `export const RIG` statement below verbatim
// (rigSource()), so tuning is: drag, copy, paste over the block, commit.
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { RtLight } from '../render/lights';
import { Character } from './character';

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
    followPitch: 1,
    onAdj: { off: [-0.004, 0.04, 0.02], rot: [4.761, 0, 1.1] },   // (designer's viewer pass, 08-09: goggles-down 1.5 cm higher and ~14° flatter)
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
    gripL: { off: [0.099, -0.059, 0.149], fingers: [-0.48, -0.11, 0.19], back: [0.45, -0.85, -0.25] },   // (designer's viewer pass, 08-08)
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
};
// ---- end of paste target ----

/** albedos are not tunables (diffuse-only renderer: they just need to read as gunmetal / can / polymer / glass) */
const COL = {
  gun: [0.05, 0.05, 0.055] as Vec3, can: [0.09, 0.09, 0.095] as Vec3, torch: [0.16, 0.16, 0.17] as Vec3, lensBody: [0.3, 0.3, 0.3] as Vec3,
  gogglesLens: [0.02, 0.05, 0.03] as Vec3, gogglesHousing: [0.04, 0.045, 0.04] as Vec3,
  blade: [0.11, 0.11, 0.12] as Vec3, edge: [0.34, 0.34, 0.36] as Vec3, knifeGrip: [0.02, 0.02, 0.022] as Vec3,   // dark steel, the ground edge lighter (its glint, in a diffuse renderer), black polymer
  furniture: [0.2, 0.085, 0.05] as Vec3,   // the carbine's plum-brown handguard, grip and bakelite magazine against its parkerised steel (COL.gun)
  polymer: [0.045, 0.05, 0.046] as Vec3, darkMetal: [0.026, 0.026, 0.03] as Vec3,   // the SC-20K: a green-black polymer hull and the darker phosphated steel of its can, box, rail and optic (throwables.ts SC20K_ITEM repeats them for the one on the floor)
};
/** the tag on the knife's boxes (Box.name): nothing in the game reads it — the QA probes count them by it (tools/qa/hold-pose-probes.ts) */
export const KNIFE_TAG = 'knife';
/** the tag on the SC-20K's boxes, in the hands or slung (Box.name): nothing in the game reads it — the QA probes tell the rifle's parts from a pistol's by it (tools/qa/gunhold-probes.ts, sc20k-probes.ts) */
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
  const o = v3.mad(v3.mad(v3.mad(f.o, f.x, adj.off[0]), f.y, adj.off[1]), f.z, adj.off[2]);
  const D = Math.PI / 180; let x = f.x, y = f.y, z = f.z;
  for (const [axis, a] of [[f.x, adj.rot[0] * D], [f.y, adj.rot[1] * D], [f.z, adj.rot[2] * D]] as [Vec3, number][]) { x = rotAxis(x, axis, a); y = rotAxis(y, axis, a); z = rotAxis(z, axis, a); }
  return { o, x, y, z };
}
/** What the viewer needs to draw a hierarchy + gizmo: one entry per node, in draw order. `parent` is the frame the node's Adj acts in
 *  (draw the handles with ITS axes), `frame` the node's own after the adjustment; boxes [boxStart, boxStart+boxCount) in `out` are its geometry. */
export interface RigNodeMeta { path: string; label: string; depth: number; parent: Frame; frame: Frame; boxStart: number; boxCount: number; getAdj: () => Adj; }
type MetaSink = RigNodeMeta[] | undefined;
const ZERO_ADJ = (): Adj => ({ off: [0, 0, 0], rot: [0, 0, 0] });
/** Lazily materialize the Adj on its owner (so untouched nodes never appear in rigSource output). */
function adjOf<T extends object>(owner: T, key: keyof T): () => Adj { return () => ((owner[key] as unknown as Adj | undefined) ?? ((owner[key] as unknown as Adj) = ZERO_ADJ())); }

/** One stick part as a yawed box laid along its frame's z from the frame origin (after the part's own Adj in the group frame `g`).
 *  Boxes only yaw, so the part follows the axis' heading and switches to an upright box when the axis is steep (relaxed carry, gun
 *  hanging down) instead of shearing. */
let curOwner = 0;   // character id stamped on the boxes rigBoxes() is emitting (set at its top)
function seg(out: Box[], g: Frame, s: Seg, albedo: Vec3, emissive: Vec3 = [0, 0, 0], meta?: MetaSink, path = '', label = '', depth = 0, name?: string) {
  const f = applyAdj(g, s.adj); const dir = f.z;
  const mid = v3.mad(f.o, dir, (s.l0 + s.l1) / 2); const len = Math.max(0.001, (s.l1 - s.l0) / 2);   // (max: a slider dragged past l1 < l0 must not make an inside-out box)
  if (meta) meta.push({ path, label, depth, parent: g, frame: { ...f, o: mid }, boxStart: out.length, boxCount: 1, getAdj: adjOf(s, 'adj') });
  // fully oriented (raster-only props may tilt: Box.rot): thick across (frame x), tall along frame y, len along the axis
  const lit = emissive[0] + emissive[1] + emissive[2] > 0;
  out.push(makeBox({ c: mid, h: [s.thick, s.tall, len], yaw: Math.atan2(dir[0], dir[2]), rot: quat.fromBasis(f.x, f.y, f.z), albedo, emissive: v3.copy(emissive), flags: lit ? GLOW_FLAGS : PROP_FLAGS, owner: curOwner, name }));
}

/** Flattened head 'forward' (falls back to the body heading when the head looks nearly straight up/down) — the goggle strap follows the skull's yaw only. */
function headFlatForward(c: Character): Vec3 {
  const hd = c.headDir(); const flat = Math.hypot(hd[0], hd[2]);
  if (flat > 0.2) return [hd[0] / flat, 0, hd[2] / flat];
  const fw = c.forward(); const fl = Math.hypot(fw[0], fw[2]) || 1; return [fw[0] / fl, 0, fw[2] / fl];
}

/** The trifocal goggles: housing + three lenses in a tight triangle — down over the eyes (lit bright) when night vision is on, flipped up
 *  onto the forehead (dim) when off. The offsets live in a head frame that is either yaw-only (G.followPitch 0) or the skull's full
 *  rotation (1); the boxes' own orientation is the flattened head yaw in both cases (boxes only yaw). */
function gogglesBoxes(c: Character, nv: boolean, out: Box[], G: Rig['goggles'], meta?: MetaSink) {
  const head = c.bones.head; if (!head) return;
  const f = headFlatForward(c);
  let fwd: Vec3 = f, up: Vec3 = [0, 1, 0], side: Vec3 = [f[2], 0, -f[0]];        // yaw-only frame (side = quat.yaw · +X, the figure's left; the triangle is symmetric so the sign is moot)
  if (G.followPitch >= 0.5) { const q = c.headRot(); fwd = quat.rotate(q, [0, 0, 1]); up = quat.rotate(q, [0, 1, 0]); side = quat.rotate(q, [1, 0, 0]); }
  const headF: Frame = { o: v3.copy(head), x: side, y: up, z: fwd };            // the head frame: parent of the cluster
  const P = nv ? G.on : G.off;
  // cluster frame: base point (fwd/up numbers) then the state's free adjustment
  const cl = applyAdj({ ...headF, o: v3.mad(v3.mad(head, fwd, P.fwd), up, P.up) }, nv ? G.onAdj : G.offAdj);
  const path = nv ? 'goggles.on' : 'goggles.off';
  if (meta) meta.push({ path, label: nv ? 'goggles (down, NV on)' : 'goggles (up, NV off)', depth: 1, parent: headF, frame: cl, boxStart: out.length, boxCount: 4, getAdj: adjOf(G, nv ? 'onAdj' : 'offAdj') });
  const glow = nv ? G.glowOn : G.glowOff;
  const hs = applyAdj({ ...cl, o: v3.mad(cl.o, cl.z, -G.housing.back) }, G.housingAdj);
  if (meta) meta.push({ path: path + '.housing', label: 'housing', depth: 2, parent: cl, frame: hs, boxStart: out.length, boxCount: 1, getAdj: adjOf(G, 'housingAdj') });
  out.push(makeBox({ c: hs.o, h: v3.copy(G.housing.half), yaw: Math.atan2(hs.z[0], hs.z[2]), rot: quat.fromBasis(hs.x, hs.y, hs.z), albedo: COL.gogglesHousing, flags: PROP_FLAGS, owner: curOwner }));
  const ln = applyAdj(cl, G.lensAdj);
  if (meta) meta.push({ path: path + '.lenses', label: 'lens triangle', depth: 2, parent: cl, frame: ln, boxStart: out.length, boxCount: 3, getAdj: adjOf(G, 'lensAdj') });
  const yawL = Math.atan2(ln.z[0], ln.z[2]); const rotL = quat.fromBasis(ln.x, ln.y, ln.z);
  for (const [ox, oy] of [[-G.lensSide, G.lensDown], [G.lensSide, G.lensDown], [0, G.lensUp]] as [number, number][]) {
    out.push(makeBox({ c: v3.mad(v3.mad(ln.o, ln.x, ox), ln.y, oy), h: [G.lensHalf, G.lensHalf, G.lensThick], yaw: yawL, rot: rotL, albedo: COL.gogglesLens, emissive: v3.copy(glow), flags: GLOW_FLAGS, owner: curOwner }));
  }
}

/** The hand frame the pistol group lives in: origin at the wrist, z along the bore (char.gunDir), y up out of the top of the slide
 *  (−gunUnder), x sideways. */
function pistolFrame(c: Character, hand: Vec3, P: { adj?: Adj }): { handF: Frame; g: Frame } {
  const handF: Frame = frameFrom(hand, c.gunDir, v3.scale(c.gunUnder(), -1));
  return { handF, g: applyAdj(handF, P.adj) };
}

export interface RigOpts {
  /** wears the trifocal goggles at all (the player does, guards don't) */
  goggles: boolean;
  /** night vision on: goggles down over the eyes and blazing; off: parked on the forehead, idling */
  nv: boolean;
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
  held?: 'smoke' | 'flash' | null;
  /** player: the combat knife is in the right fist (a man held with the hands empty — combat.ts handProps sets it off Player.holding; the hold layer poses the fist) */
  knife?: boolean;
  /** player: where the SC-20K is this frame — in the HANDS off the right wrist (the caller then passes slot 0: the Five-seveN rides the thigh), SLUNG across the back
   *  off the chest joint (RIG.sc20k.slung), or not carried at all (null / absent: the three-slot kit exactly as it was). One place or the other, never both. */
  rifle?: 'hand' | 'slung' | null;
  /** player: the SC-20K's fore-end light is lit (its lens glows; game.ts poses the spot light itself off sc20kLightPose) */
  rifleLight?: boolean;
}

/** Held / worn props for one character as small boxes, appended to `out` (the frame's dynamic box list).
 *  Needs the character's bones, i.e. call after char.update(). */
export function rigBoxes(c: Character, o: RigOpts, out: Box[], rig: Rig = RIG, meta?: RigNodeMeta[]) {
  const hand = c.bones.handR; curOwner = c.id & 0xff;
  if (!o.isGuard) {
    if (hand && o.slot === 1) {
      const P = rig.pistol; const { handF, g } = pistolFrame(c, hand, P);
      if (meta) meta.push({ path: 'pistol', label: 'pistol (group + rail light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: o.lightOn ? 5 : 4, getAdj: adjOf(P, 'adj') });
      seg(out, g, P.slide, COL.gun, undefined, meta, 'pistol.slide', 'slide + frame', 2);
      seg(out, g, P.grip, COL.gun, undefined, meta, 'pistol.grip', 'grip', 2);
      seg(out, g, P.suppressor, COL.can, undefined, meta, 'pistol.suppressor', 'suppressor', 2);
      const under: Frame = { ...g, o: v3.mad(g.o, g.y, -P.rail.under) };          // rail light under the slide; lit lens when on
      seg(out, under, P.rail, COL.torch, undefined, meta, 'pistol.rail', 'rail light body', 2);
      if (o.lightOn) seg(out, applyAdj(under, P.rail.adj), P.lens, COL.lensBody, P.lens.glow, meta, 'pistol.lens', 'rail light lens (lit)', 2);   // the lens rides on the rail body (its adj), then its own
    }
    if (o.slot !== 1) { if (o.holster) holsterBoxes(c, out, { slide: rig.pistol.slide, grip: rig.pistol.grip, suppressor: rig.pistol.suppressor }, meta, rig.holster); if (o.held) heldCanBoxes(c, o.held, out, rig.can, meta); }   // canister up: the Five-seveN rides the thigh, the can is in the fist
    if (o.knife) knifeBoxes(c, out, rig.knife, meta);
    if (o.rifle === 'hand' && hand) sc20kBoxes(c, out, rig.sc20k, 'hand', o.rifleLight ? v3.scale(RAIL_LENS_COLOR, rig.sc20k.lensGlow) : [0, 0, 0], meta);   // the SC-20K in both hands (the animator's long-gun solve has them on it)…
    else if (o.rifle === 'slung') sc20kBoxes(c, out, rig.sc20k, 'slung', [0, 0, 0], meta);                                                          // …or across his back, dark
    if (o.goggles) gogglesBoxes(c, o.nv, out, rig.goggles, meta);
    return;
  }
  if (!hand) return;
  if (o.weapon === 'carbine' || o.weapon === 'sc20k') {                       // a long gun in both hands in every state; riflemen wear the sidearm too, and it never leaves the thigh
    if (o.weapon === 'sc20k') sc20kBoxes(c, out, rig.sc20k, 'hand', o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.sc20k.lensGlow) : [0, 0, 0], meta);
    else carbineBoxes(c, out, rig.carbine, o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.carbine.lensGlow) : [0, 0, 0], meta);
    if (o.holster !== false) holsterBoxes(c, out, { slide: rig.guardPistol.slide, grip: rig.guardPistol.grip }, meta);
    return;
  }
  const lens: Vec3 = o.lightOn && o.lensColor ? v3.scale(o.lensColor, rig.torch.lensGlow) : [0, 0, 0];
  if (o.torch && c.alive) {                                                     // torch carried in the hand (the spot light sits at its lens)
    const handF = frameFrom(hand, o.beamDir ?? c.gunDir); const g = applyAdj(handF, rig.torch.adj);
    if (meta) meta.push({ path: 'torch', label: 'hand torch (group + light)', depth: 1, parent: handF, frame: g, boxStart: out.length, boxCount: 2, getAdj: adjOf(rig.torch, 'adj') });
    seg(out, g, rig.torch.body, COL.torch, undefined, meta, 'torch.body', 'body', 2);
    seg(out, g, rig.torch.lens, COL.lensBody, lens, meta, 'torch.lens', 'lens', 2);
    if (o.holster !== false) holsterBoxes(c, out, { slide: rig.guardPistol.slide, grip: rig.guardPistol.grip }, meta);   // torch in hand → the sidearm is on his thigh
  } else {                                                                      // drawn pistol with a weapon light (a body keeps the gun, unlit)
    const { handF, g } = pistolFrame(c, hand, rig.guardPistol);
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
  seg(out, gg, { ...parts.slide, adj: undefined }, COL.gun);
  seg(out, gg, GRIP_HUNG(parts.grip), COL.gun);
  if (parts.suppressor) seg(out, gg, { ...parts.suppressor, adj: undefined }, COL.can);
}
const GRIP_HUNG = (grip: Seg): Seg => ({ ...grip, adj: { off: [0, -0.024, 0.05], rot: [108, 0, 0] } });

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

/** A canister in the right hand (slot 2 / 3 up): the throwable's own body — smoke can olive with a red band, stun can near-black with a pale band —
 *  standing in the fist, tilted a little forward. */
function heldCanBoxes(c: Character, kind: 'smoke' | 'flash', out: Box[], K: Rig['can'] = RIG.can, meta?: MetaSink) {
  const hand = c.bones.handR; if (!hand) return;
  const f = c.forward(); const axis = v3.normalize([f[0] * K.tilt, 1, f[2] * K.tilt]);
  const g0 = frameFrom(v3.mad(hand, axis, K.sink), axis, f); const g = applyAdj(g0, K.adj);
  const body: Vec3 = kind === 'flash' ? [0.07, 0.075, 0.08] : [0.25, 0.29, 0.2]; const band: Vec3 = kind === 'flash' ? [0.7, 0.7, 0.66] : [0.6, 0.08, 0.06];
  if (meta) meta.push({ path: 'can', label: `canister in the fist (${kind === 'flash' ? 'stun' : 'smoke'})`, depth: 1, parent: g0, frame: g, boxStart: out.length, boxCount: 2, getAdj: adjOf(K, 'adj') });
  seg(out, g, K.body, body, [0, 0, 0], meta, 'can.body');
  seg(out, g, K.band, band, [0, 0, 0], meta, 'can.band');
}

/** The carbine's group frame: the sidearm's hand frame (wrist, z along char.gunDir, y up out of the receiver) moved by the group adj onto the bore above the trigger. */
function carbineFrame(c: Character, hand: Vec3, C: Rig['carbine']): { handF: Frame; g: Frame } { return pistolFrame(c, hand, C); }
/** The guards' carbine (RIG.carbine, see the Rig doc): eleven oriented boxes off the right hand — steel in COL.gun, furniture in COL.furniture, the weapon light's
 *  body like the rail light's and its lens lit with `lens` (zero = dark). The support hand's grip point is a node of its own (no boxes) so the gizmo can drag it. */
function carbineBoxes(c: Character, out: Box[], C: Rig['carbine'], lens: Vec3, meta?: MetaSink) {
  const hand = c.bones.handR; if (!hand) return;
  const { handF, g } = carbineFrame(c, hand, C);
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
const gripAdjs = new WeakMap<object, Adj>();
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
/** the colour its lens glows while the light is on: the rail light's own cool white (railLightDef) */
const RAIL_LENS_COLOR: Vec3 = [0.9, 0.96, 1.0];
/** The rifle's group frame. In the HANDS: the sidearm's hand frame (wrist, z along char.gunDir, y up out of the receiver) moved by the group adj onto the bore above
 *  the trigger — the carbine's construction exactly. SLUNG: in the BACK's frame — y up the spine line (hips joint → chest joint: a crouch or a kick tilts it with the
 *  back it lies on), z the way the torso faces squared to that line, blended by `slung.follow` between the root's facing (0: the hips) and the chest's (1) — the
 *  thing is rigid and bridges shoulder blade and hip, so it goes half with each: the chest's axes alone swung its muzzle end 45 cm out past the hip whenever the
 *  chest turned toward an aim or hunched (the plank in the top-down view) — x his left, origin the mid-back joint (spine2, where its middle rests): `slung.off` along
 *  those axes, z along `slung.bore` in them, lying side-flat to the back (its across axis = the back's outward normal squared to the bore) turned `slung.roll` degrees
 *  about the bore, then the free `slung.adj`. `parent` is what that node's Adj acts in (the gizmo draws its handles with it). */
function sc20kFrame(c: Character, S: Rig['sc20k'], where: 'hand' | 'slung'): { parent: Frame; g: Frame } {
  if (where === 'hand') { const { handF, g } = pistolFrame(c, c.bones.handR ?? c.muzzle, S); return { parent: handF, g }; }
  const P = S.slung; const b = c.bones;
  const haveJoints = !!(b.hips && b.thighL && b.thighR && b.upperArmL && b.upperArmR && b.spine2);
  const hips = b.hips ?? v3.add(c.pos, [0, 0.95, 0]), top = haveJoints ? v3.lerp(b.upperArmL, b.upperArmR, 0.5) : v3.add(c.pos, [0, 1.4, 0]), mid = b.spine2 ?? v3.lerp(hips, top, 0.5);
  let up = v3.sub(top, hips); up = v3.len(up) > 1e-3 ? v3.normalize(up) : [0, 1, 0];         // the spine line, hips joint → between the shoulder joints: the line the torso's own capsules run up (Character.capsules), so the clearance off the back holds as it bends
  const fw = c.forward(); let left: Vec3 = [fw[2], 0, -fw[0]];                                 // his left at the root (up × ahead)…
  if (haveJoints) left = v3.lerp(v3.normalize(v3.sub(b.thighL, b.thighR)), v3.normalize(v3.sub(b.upperArmL, b.upperArmR)), Math.max(0, Math.min(1, P.follow ?? 0.5)));   // …or read off the body: the hip line and the shoulder line, blended — the back's own twist between the two, whatever the clips and the aim do with either
  left = v3.mad(left, up, -v3.dot(left, up)); left = v3.len(left) > 1e-3 ? v3.normalize(left) : [fw[2], 0, -fw[0]];
  const cf: Frame = { o: mid, x: left, y: up, z: v3.cross(left, up) };                         // x his left, y up the spine, z the way the back faces (left × up = ahead)
  const inC = (d: Vec3): Vec3 => v3.mad(v3.mad(v3.scale(cf.x, d[0]), cf.y, d[1]), cf.z, d[2]);
  const o = v3.add(mid, inC(P.off)); const z = v3.normalize(inC(P.bore));
  let x = v3.mad(v3.scale(cf.z, -1), z, v3.dot(cf.z, z));                              // the back's outward normal (−z of the back frame) squared to the bore: the rifle's across axis — side flat on the back
  if (v3.len(x) < 1e-3) x = cf.x; x = v3.normalize(x); x = rotAxis(x, z, P.roll * Math.PI / 180);
  const base: Frame = { o, x, y: v3.cross(z, x), z };
  return { parent: base, g: applyAdj(base, P.adj) };
}
/** Sam's SC-20K (see the Rig doc): eleven oriented boxes — the polymer hull, buttpad, grip, fore-end and foregrip; the darker can, box, rail and optic; the light body
 *  and its lens (lit with `lens`, zero = dark) — off the right hand ('hand') or across the back ('slung'). The support hand's grip point is a node of its own (no
 *  boxes) so the gizmo can drag it, as the carbine's is. Standalone-safe: stamps the boxes with THIS character. */
export function sc20kBoxes(c: Character, out: Box[], S: Rig['sc20k'] = RIG.sc20k, where: 'hand' | 'slung' = 'hand', lens: Vec3 = [0, 0, 0], meta?: MetaSink) {
  curOwner = c.id & 0xff;
  const { parent, g } = sc20kFrame(c, S, where);
  const slung = where === 'slung';
  if (meta) meta.push({ path: slung ? 'sc20k.slung' : 'sc20k', label: slung ? 'SC-20K (slung across the back)' : 'SC-20K (group + weapon light)', depth: 1, parent, frame: g, boxStart: out.length, boxCount: 11, getAdj: slung ? adjOf(S.slung, 'adj') : adjOf(S, 'adj') });
  seg(out, g, S.hull, COL.polymer, undefined, meta, 'sc20k.hull', 'hull (action + stock, polymer)', 2, SC20K_TAG);
  seg(out, g, S.butt, COL.polymer, undefined, meta, 'sc20k.butt', 'buttpad', 2, SC20K_TAG);
  seg(out, g, S.mag, COL.darkMetal, undefined, meta, 'sc20k.mag', 'magazine (behind the grip)', 2, SC20K_TAG);
  seg(out, g, S.grip, COL.polymer, undefined, meta, 'sc20k.grip', 'pistol grip', 2, SC20K_TAG);
  seg(out, g, S.fore, COL.polymer, undefined, meta, 'sc20k.fore', 'fore-end', 2, SC20K_TAG);
  seg(out, g, S.suppressor, COL.darkMetal, undefined, meta, 'sc20k.suppressor', 'integral suppressor', 2, SC20K_TAG);
  seg(out, g, S.rail, COL.darkMetal, undefined, meta, 'sc20k.rail', 'top rail', 2, SC20K_TAG);
  seg(out, g, S.optic, COL.darkMetal, undefined, meta, 'sc20k.optic', 'sight block', 2, SC20K_TAG);
  seg(out, g, S.foregrip, COL.polymer, undefined, meta, 'sc20k.foregrip', 'foregrip (vertical post)', 2, SC20K_TAG);
  seg(out, g, S.light, COL.torch, undefined, meta, 'sc20k.light', 'weapon light body', 2, SC20K_TAG);
  seg(out, g, S.lens, COL.lensBody, lens, meta, 'sc20k.lens', 'weapon light lens', 2, SC20K_TAG);
  if (meta && !slung) { const G = S.gripL; const o = v3.mad(v3.mad(v3.mad(g.o, g.x, G.off[0]), g.y, G.off[1]), g.z, G.off[2]); meta.push({ path: 'sc20k.gripL', label: 'support hand grip point (arrows only)', depth: 2, parent: g, frame: { ...g, o }, boxStart: out.length, boxCount: 0, getAdj: () => gripAdj(G) }); }
}
/** the SC-20K's support-hand grip for the animator (character.ts longGrip): the foregrip post's fist point + directions through the group adj, as carbineGrip */
export function sc20kGrip(rig: Rig = RIG): { wrist: Vec3; fingers: Vec3; back: Vec3 } { return longGripOf(rig.sc20k.adj, rig.sc20k.gripL); }
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
