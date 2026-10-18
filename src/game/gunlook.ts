// EACH GUN ITS OWN LOOK, SOUND AND RELOAD (GUNLOOK). The guns a card's two slots offer (gunslots.ts PICKS: the Mk 12, the MP7, the Mk 46, the M1014, the HK45
// and the Glock 18) were built as rows that are felt — reach, noise, handling, how long they run — and each was a STAND-IN to look at and to listen to: drawn as
// the issue carbine, the guards' short rifle or the issue pistols, speaking with their reports. With the switch on a row that names things of its `own`
// (weapons.ts WeaponDef.own) is drawn as its own model (the part tables below, laid out in the group its `rig` names — so the trigger hand, the sling and the
// holster are where they were), has its support hand where that model takes one, its muzzle where that model's is, speaks with its own voice (audio/sfx.ts),
// shows its own flame (effects.ts muzzleFx) and is fed the way it is fed (gunreload.ts: a belt under a feed cover, shells one at a time, a long magazine).
// The pump gun of the big slot (m870) is drawn as a pump gun too: it was the guards' short rifle in his hands and on his back.
// Off (the module, the frozen stand, `?nogunlook`): every row as its stand-in fields say — the build before. `GUNLOOK_BREAK=1` (tools/qa/gunlook-check.ts):
// a row's `own` is not read, so two picks share a model and a voice again and the check fails.
// PICTURE AND SOUND, with three things the simulation reads, all three only of a man who carries one of these rows (nobody does with gunslots.ts off): where his
// muzzle is (the model's far face), how bright his muzzle's flash is (the flame's light gain), and the beats inside his reload (never its length: the row's).
import type { Vec3 } from '../math/vec';
import type { WeaponDef, GunModelId } from './weapons';
import type { MuzzleFxKey } from './effects';

export const GUNLOOK = {
  on: false,
};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GUNLOOK_BREAK ?? '') === '1'; } catch { return false; } })();
/** the switch, as every reader asks it (GUNLOOK_BREAK=1: off whatever the table says) */
export const gunLookOn = (): boolean => GUNLOOK.on && !BREAK;
/** what a row has of its own, while the switch is on — null: its stand-in fields (rig, report.voice, muzzleFx) are the gun */
export const gunOwn = (def: WeaponDef): NonNullable<WeaponDef['own']> | null => gunLookOn() ? def.own ?? null : null;
/** the voice its report is played with (combat.ts fireWeapon) */
export const voiceOf = (def: WeaponDef): string => gunOwn(def)?.voice ?? def.report.voice;
/** the flame and the flash's light gain it fires with (combat.ts fireWeapon) */
export const flameOf = (def: WeaponDef): MuzzleFxKey => gunOwn(def)?.flame ?? def.muzzleFx;

/** WHERE A MODEL IS FED, in its group's own axes (rigProps.ts: the origin on the bore above the trigger, +z toward the muzzle, +y up out of the receiver, +x the
 *  shooter's LEFT; metres) — what gunreload.ts sends the support hand to. `well`: where a magazine goes in (the MP7's is the foot of its pistol grip; the
 *  M1014's the loading port under the receiver, a shell at a time). The Mk 46: `cover` the top of the feed cover (lifted from its front edge, hinged at the
 *  rear), `box` the belt box hanging under the receiver's left, `charge` the cocking handle on the right. The M1014: `port` the ejection port on the right
 *  (a shell dropped straight in on an empty gun), `saddle` the spare shells on the receiver's left. */
export const MODEL_POINTS: Record<GunModelId, { well: Vec3; cover?: Vec3; box?: Vec3; charge?: Vec3; port?: Vec3; saddle?: Vec3 }> = {
  mk12: { well: [0, -0.06, 0.08] },
  mp7: { well: [0, -0.135, -0.045] },
  mk46: { well: [0.02, -0.085, 0.06], cover: [0, 0.04, 0.07], box: [0.02, -0.085, 0.06], charge: [-0.03, 0, 0.0] },
  m1014: { well: [0, -0.047, 0.06], port: [-0.02, 0.005, 0.03], saddle: [0.024, 0, 0.0] },
  m870: { well: [0, -0.047, 0.06], port: [-0.02, 0.005, 0.03] },
  hk45: { well: [0, -0.1, -0.03] },
  g18: { well: [0, -0.1, -0.03] },
};

// ------------------------------------------------------------ the models
/** what a part is made of (rigProps.ts gives each its albedo; `furn` is the flat dark earth of the 2010s kit, black on a man in the sneaking suit) */
export type ModelCol = 'black' | 'metal' | 'steel' | 'poly' | 'furn' | 'brass' | 'shell' | 'cloth' | 'torch' | 'lens';
/** One box of a model: a stick part along its frame's z in the group's axes (rigProps.ts Seg: l0‥l1 along z, half extents `thick` across and `tall` up, its own
 *  adjustment), what it is made of, and what it is — `mag`: left out while the magazine / the belt box is off the gun (gunreload.ts reloadShow, the player's
 *  KitDraw.noMag); `cover`: swung up about the model's `hinge` while the feed cover is lifted; `lens`: lit with his light's colour while the light is on. */
export interface ModelPart { s: Seg; col: ModelCol; is?: 'mag' | 'cover' | 'lens' }
/** A long gun's model. `ahead`: the far face of its foremost part along the bore from the group's origin — its muzzle (rigProps.ts modelMuzzleAhead adds the
 *  group's own offset from the wrist). `gripL`: where the support hand takes it, in the group's axes — the left wrist's point and the directions its fingers
 *  point / the back of the hand faces (as RIG.carbine.gripL); `post`: that hand is a fist round a vertical post (the fitted hold of the issue carbine's) rather
 *  than a palm under a handguard. `lensAhead`: the light's own origin along its lens part (absent: the group's own light, where it always was). */
export interface LongModel { parts: ModelPart[]; ahead: number; gripL: { off: Vec3; fingers: Vec3; back: Vec3 }; post: boolean; hinge?: Vec3; lens?: Seg; lensAhead?: number }
/** A hand gun's model, in the pistol group's axes: the slide and frame, the grip (the group's own rake is put on it), a can or none, and a magazine that stands
 *  out of the foot of the grip or none (drawn along the grip's own line) */
export interface PistolModel { slide: Seg; grip: Seg; can: Seg | null; mag: Seg | null; frame: ModelCol; canCol?: ModelCol }
type Seg = { l0: number; l1: number; thick: number; tall: number; adj?: { off: Vec3; rot: Vec3 } };

/** the pistol grip every long gun here is held by: the issue carbine's own (RIG.sc20k.grip / RIG.carbine.grip — the trigger hand is on it, the same tuned frame) */
const GRIP: Seg = { l0: 0, l1: 0.09, thick: 0.013, tall: 0.016, adj: { off: [0, -0.045, -0.015], rot: [108, 0, 0] } };
/** the weapon light on a handguard's right face and its lens, where the issue carbine carries its own (RIG.sc20k.light / .lens: the spot light's pose is read there) */
const LIGHT: Seg = { l0: 0.19, l1: 0.27, thick: 0.011, tall: 0.011, adj: { off: [-0.034, -0.008, 0], rot: [0, 0, 0] } };
const LENS: Seg = { l0: 0.27, l1: 0.285, thick: 0.012, tall: 0.012, adj: { off: [-0.034, -0.008, 0], rot: [0, 0, 0] } };
/** … and where the guards' short rifle carries its (RIG.carbine.light / .lens: the two shotguns are laid out in that group) */
const LIGHT_C: Seg = { l0: 0.18, l1: 0.265, thick: 0.011, tall: 0.011, adj: { off: [-0.032, -0.006, 0], rot: [0, 0, 0] } };
const LENS_C: Seg = { l0: 0.265, l1: 0.28, thick: 0.012, tall: 0.012, adj: { off: [-0.032, -0.006, 0], rot: [0, 0, 0] } };
/** a palm under a handguard, fingers wrapped across it (RIG.carbine.gripL, the maintainer's own viewer pass): `z` is how far down the bore the wrist is */
const under = (z: number, x = 0.099, y = -0.059): LongModel['gripL'] => ({ off: [x, y, z], fingers: [-0.48, -0.11, 0.19], back: [0.45, -0.85, -0.25] });

// FIRST PASS, every number: laid out on paper against the issue carbine's parts (rigProps.ts RIG.m4 / RIG.sc20k: stock at −0.31, grip at the origin, can to 0.43)
// and looked at only as software-rendered stills. Never seen on a GPU, never in the viewer.
export const LONG_MODELS: Partial<Record<GunModelId, LongModel>> = {
  // Mk 12: the carbine's receiver with a FIXED stock, a short twenty-round box, a long free-floated tube with a bipod folded under it, a scope the length of the
  // receiver with its bell and its turrets, and the can at the end of eighteen inches of barrel — 0.92 m, a hand and a half longer than the Mk 18
  mk12: {
    ahead: 0.61, post: false, gripL: under(0.2, 0.1, -0.056),
    parts: [
      { s: { l0: -0.075, l1: 0.115, thick: 0.017, tall: 0.036, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } }, col: 'black' },      // upper + lower receiver
      { s: { l0: -0.31, l1: -0.075, thick: 0.016, tall: 0.029, adj: { off: [0, -0.022, 0], rot: [0, 0, 0] } }, col: 'black' },      // the fixed stock: solid from the receiver to the pad
      { s: { l0: 0, l1: 0.09, thick: 0.011, tall: 0.03, adj: { off: [0, -0.045, 0.075], rot: [80, 0, 0] } }, col: 'metal', is: 'mag' },   // twenty rounds: a box half the carbine's
      { s: GRIP, col: 'furn' },
      { s: { l0: 0.115, l1: 0.40, thick: 0.021, tall: 0.021, adj: { off: [0, -0.002, 0], rot: [0, 0, 0] } }, col: 'furn' },         // the free-floated handguard, painted
      { s: { l0: 0.40, l1: 0.47, thick: 0.009, tall: 0.009 }, col: 'metal' },                                                       // the barrel between the tube and the can
      { s: { l0: 0.47, l1: 0.61, thick: 0.019, tall: 0.019 }, col: 'metal' },                                                       // the can (its far face: the muzzle)
      { s: { l0: -0.07, l1: 0.40, thick: 0.009, tall: 0.005, adj: { off: [0, 0.027, 0], rot: [0, 0, 0] } }, col: 'black' },         // the flat top, receiver to the tube's nose
      { s: { l0: -0.02, l1: 0.11, thick: 0.011, tall: 0.007, adj: { off: [0, 0.039, 0], rot: [0, 0, 0] } }, col: 'black' },         // the scope's one-piece mount on the flat top
      { s: { l0: -0.05, l1: 0.16, thick: 0.013, tall: 0.013, adj: { off: [0, 0.058, 0], rot: [0, 0, 0] } }, col: 'metal' },         // the scope's tube
      { s: { l0: 0.16, l1: 0.215, thick: 0.019, tall: 0.019, adj: { off: [0, 0.058, 0], rot: [0, 0, 0] } }, col: 'metal' },         // … its bell
      { s: { l0: 0.04, l1: 0.07, thick: 0.022, tall: 0.012, adj: { off: [0, 0.074, 0], rot: [0, 0, 0] } }, col: 'metal' },          // … its turrets: wider than the tube, the tell from above
      { s: { l0: 0.27, l1: 0.42, thick: 0.017, tall: 0.006, adj: { off: [0, -0.031, 0], rot: [0, 0, 0] } }, col: 'metal' },         // the bipod's legs folded forward under the tube
      { s: { l0: 0.30, l1: 0.375, thick: 0.017, tall: 0.011, adj: { off: [0, 0.043, 0], rot: [0, 0, 0] } }, col: 'furn' },          // the laser box, ahead of the scope's bell
      { s: LIGHT, col: 'torch' }, { s: LENS, col: 'lens', is: 'lens' },
    ],
  },
  // MP7: all of it behind the can — a short polymer body, the magazine up through the PISTOL GRIP and standing a hand out of its foot, a two-rod stock pulled
  // out, a folding front grip down under the nose, a dot sight; 0.58 m with the can on, the shortest long gun there is
  mp7: {
    ahead: 0.31, post: true, gripL: { off: [0.06, -0.082, 0.075], fingers: [-0.3, 0.05, 0.95], back: [0.95, -0.15, 0.25] },
    lens: { l0: 0.14, l1: 0.153, thick: 0.011, tall: 0.011, adj: { off: [-0.031, -0.004, 0], rot: [0, 0, 0] } }, lensAhead: 0.158,
    parts: [
      { s: { l0: -0.11, l1: 0.16, thick: 0.021, tall: 0.031, adj: { off: [0, -0.008, 0], rot: [0, 0, 0] } }, col: 'black' },        // the body
      { s: { l0: -0.255, l1: -0.11, thick: 0.004, tall: 0.005, adj: { off: [0.014, 0.004, 0], rot: [0, 0, 0] } }, col: 'metal' },   // the stock's two rods, out: daylight between them from above
      { s: { l0: -0.255, l1: -0.11, thick: 0.004, tall: 0.005, adj: { off: [-0.014, 0.004, 0], rot: [0, 0, 0] } }, col: 'metal' },
      { s: { l0: -0.27, l1: -0.255, thick: 0.018, tall: 0.034, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } }, col: 'black' },      // … and its plate
      { s: { l0: 0, l1: 0.095, thick: 0.015, tall: 0.019, adj: { off: [0, -0.045, -0.015], rot: [108, 0, 0] } }, col: 'black' },    // the grip: fat, the magazine goes up through it
      { s: { l0: 0.09, l1: 0.2, thick: 0.011, tall: 0.014, adj: { off: [0, -0.045, -0.015], rot: [108, 0, 0] } }, col: 'metal', is: 'mag' },   // forty rounds, out of the grip's foot
      { s: { l0: 0.16, l1: 0.31, thick: 0.017, tall: 0.017 }, col: 'metal' },                                                       // the can (its far face: the muzzle)
      { s: { l0: -0.09, l1: 0.15, thick: 0.009, tall: 0.004, adj: { off: [0, 0.027, 0], rot: [0, 0, 0] } }, col: 'black' },         // the top rail
      { s: { l0: -0.01, l1: 0.04, thick: 0.014, tall: 0.014, adj: { off: [0, 0.045, 0], rot: [0, 0, 0] } }, col: 'metal' },         // a dot sight
      { s: { l0: 0, l1: 0.075, thick: 0.011, tall: 0.012, adj: { off: [0, -0.04, 0.13], rot: [90, 0, 0] } }, col: 'black' },        // the front grip, at the nose, folded down (the support fist is round it)
      { s: { l0: 0.075, l1: 0.14, thick: 0.01, tall: 0.01, adj: { off: [-0.031, -0.004, 0], rot: [0, 0, 0] } }, col: 'torch' },     // a small light on the body's right
      { s: { l0: 0.14, l1: 0.153, thick: 0.011, tall: 0.011, adj: { off: [-0.031, -0.004, 0], rot: [0, 0, 0] } }, col: 'lens', is: 'lens' },
    ],
  },
  // Mk 46: a deep receiver under a flat feed cover (hinged at its rear), a soft hundred-round box hanging under the receiver's left with the belt running up
  // out of it, a fixed stock, a railed handguard with the bipod folded back under it, a bare barrel with its gas tube under and a flash hider — 0.84 m and the
  // widest thing a man carries
  mk46: {
    ahead: 0.53, post: false, gripL: under(0.23, 0.103, -0.062), hinge: [0, 0.022, -0.06],   // (the hand well ahead of the belt box: a cuff at 0.16 was in its front corner)
    parts: [
      { s: { l0: -0.10, l1: 0.14, thick: 0.027, tall: 0.034, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } }, col: 'black' },        // the receiver
      { s: { l0: -0.06, l1: 0.13, thick: 0.030, tall: 0.011, adj: { off: [0, 0.033, 0], rot: [0, 0, 0] } }, col: 'black', is: 'cover' },   // the feed cover: a slab wider than the receiver, the tell from above
      { s: { l0: -0.02, l1: 0.07, thick: 0.015, tall: 0.016, adj: { off: [0, 0.060, 0], rot: [0, 0, 0] } }, col: 'metal', is: 'cover' },   // the sight riding it (it lifts with the cover)
      { s: { l0: -0.31, l1: -0.10, thick: 0.015, tall: 0.032, adj: { off: [0, -0.02, 0], rot: [0, 0, 0] } }, col: 'poly' },         // the fixed stock
      { s: GRIP, col: 'poly' },
      { s: { l0: -0.005, l1: 0.125, thick: 0.034, tall: 0.045, adj: { off: [0.022, -0.092, 0], rot: [0, 0, 0] } }, col: 'cloth', is: 'mag' },   // the belt box: under the receiver, proud of its left
      { s: { l0: 0.03, l1: 0.09, thick: 0.010, tall: 0.034, adj: { off: [0.034, -0.018, 0], rot: [0, 0, 0] } }, col: 'brass', is: 'mag' },    // the belt, up out of the box into the tray
      { s: { l0: 0.14, l1: 0.33, thick: 0.024, tall: 0.022, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } }, col: 'black' },         // the railed handguard
      { s: { l0: 0.33, l1: 0.50, thick: 0.009, tall: 0.009 }, col: 'metal' },                                                       // the barrel
      { s: { l0: 0.33, l1: 0.43, thick: 0.007, tall: 0.007, adj: { off: [0, -0.022, 0], rot: [0, 0, 0] } }, col: 'metal' },         // the gas tube under it
      { s: { l0: 0.50, l1: 0.53, thick: 0.012, tall: 0.012 }, col: 'metal' },                                                       // the flash hider (its far face: the muzzle)
      { s: { l0: 0.17, l1: 0.37, thick: 0.019, tall: 0.006, adj: { off: [0, -0.042, 0], rot: [0, 0, 0] } }, col: 'metal' },         // the bipod's legs folded back under the handguard
      { s: { l0: 0.20, l1: 0.275, thick: 0.017, tall: 0.011, adj: { off: [0, 0.021, 0], rot: [0, 0, 0] } }, col: 'furn' },          // the laser box on top of the handguard, as the issue carbine wears its
      { s: LIGHT, col: 'torch' }, { s: LENS, col: 'lens', is: 'lens' },
    ],
  },
  // M1014: one long barrel over a magazine tube nearly as long, a polymer fore-end round both, a slab-sided receiver with six spare shells in a carrier on its
  // left, a pistol grip and a thin fixed stock with a tall pad — 0.80 m
  m1014: {
    ahead: 0.47, post: false, gripL: { off: [0.099, -0.059, 0.149], fingers: [-0.48, -0.11, 0.19], back: [0.45, -0.85, -0.25] },
    parts: [
      { s: { l0: -0.09, l1: 0.13, thick: 0.018, tall: 0.03, adj: { off: [0, -0.01, 0], rot: [0, 0, 0] } }, col: 'black' },          // the receiver
      { s: { l0: -0.31, l1: -0.09, thick: 0.012, tall: 0.017, adj: { off: [0, -0.016, 0], rot: [0, 0, 0] } }, col: 'black' },       // the stock's tube
      { s: { l0: -0.325, l1: -0.305, thick: 0.016, tall: 0.045, adj: { off: [0, -0.022, 0], rot: [0, 0, 0] } }, col: 'poly' },      // … and its pad
      { s: GRIP, col: 'poly' },
      { s: { l0: 0.13, l1: 0.47, thick: 0.0095, tall: 0.0095 }, col: 'metal' },                                                     // the barrel (its far face: the muzzle)
      { s: { l0: 0.13, l1: 0.41, thick: 0.0105, tall: 0.0105, adj: { off: [0, -0.024, 0], rot: [0, 0, 0] } }, col: 'metal' },       // the magazine tube under it
      { s: { l0: 0.13, l1: 0.31, thick: 0.019, tall: 0.027, adj: { off: [0, -0.012, 0], rot: [0, 0, 0] } }, col: 'black' },         // the fore-end round both
      { s: { l0: -0.06, l1: 0.08, thick: 0.008, tall: 0.004, adj: { off: [0, 0.024, 0], rot: [0, 0, 0] } }, col: 'black' },         // the rail over the receiver
      { s: { l0: 0.435, l1: 0.455, thick: 0.004, tall: 0.012, adj: { off: [0, 0.018, 0], rot: [0, 0, 0] } }, col: 'metal' },        // the front sight's blade
      { s: { l0: -0.05, l1: 0.07, thick: 0.007, tall: 0.012, adj: { off: [0.025, -0.004, 0], rot: [0, 0, 0] } }, col: 'shell' },    // six spare shells on the receiver's left
      { s: LIGHT_C, col: 'torch' }, { s: LENS_C, col: 'lens', is: 'lens' },
    ],
  },
  // the big slot's pump gun: a short barrel with the stand-off device on its end, a magazine tube with the PUMP on it (where the support hand is), a plain
  // stock. Its muzzle and its support hand are where the guards' short rifle had them (the group it is laid out in): nothing the simulation reads has moved.
  m870: {
    ahead: 0.41, post: false, gripL: { off: [0.099, -0.059, 0.149], fingers: [-0.48, -0.11, 0.19], back: [0.45, -0.85, -0.25] },
    parts: [
      { s: { l0: -0.09, l1: 0.12, thick: 0.018, tall: 0.03, adj: { off: [0, -0.01, 0], rot: [0, 0, 0] } }, col: 'steel' },          // the receiver
      { s: { l0: -0.31, l1: -0.07, thick: 0.015, tall: 0.026, adj: { off: [0, -0.028, 0], rot: [0, 0, 0] } }, col: 'poly' },        // the stock
      { s: GRIP, col: 'poly' },
      { s: { l0: 0.12, l1: 0.37, thick: 0.0095, tall: 0.0095 }, col: 'steel' },                                                     // the barrel
      { s: { l0: 0.37, l1: 0.41, thick: 0.013, tall: 0.013 }, col: 'metal' },                                                       // the stand-off device (its far face: the muzzle)
      { s: { l0: 0.12, l1: 0.34, thick: 0.0105, tall: 0.0105, adj: { off: [0, -0.024, 0], rot: [0, 0, 0] } }, col: 'steel' },       // the magazine tube
      { s: { l0: 0.17, l1: 0.29, thick: 0.02, tall: 0.021, adj: { off: [0, -0.02, 0], rot: [0, 0, 0] } }, col: 'poly' },            // the pump
      { s: LIGHT_C, col: 'torch' }, { s: LENS_C, col: 'lens', is: 'lens' },
    ],
  },
};
export const PISTOL_MODELS: Partial<Record<GunModelId, PistolModel>> = {
  // HK45: a bigger slide over a dark earth frame, and the fattest, longest can on the floor
  hk45: { slide: { l0: 0.02, l1: 0.215, thick: 0.0175, tall: 0.027 }, grip: { l0: 0, l1: 0.1, thick: 0.016, tall: 0.019 }, can: { l0: 0.215, l1: 0.40, thick: 0.0215, tall: 0.0215 }, mag: null, frame: 'furn', canCol: 'black' },   // (a DARK fat can: from above the issue pistol's is the light one)
  // Glock 18: the issue pistol's own size, bare, with thirty-three rounds standing a hand out of the foot of its grip
  g18: { slide: { l0: 0.02, l1: 0.22, thick: 0.016, tall: 0.025 }, grip: { l0: 0, l1: 0.095, thick: 0.014, tall: 0.017 }, can: null, mag: { l0: 0.09, l1: 0.2, thick: 0.011, tall: 0.0135 }, frame: 'steel' },
};
/** a long gun's model by its id, while the switch is on (null: none — the group draws its own parts) */
export const longModel = (id: GunModelId | null | undefined): LongModel | null => (id && gunLookOn() ? LONG_MODELS[id] ?? null : null);
export const pistolModel = (id: GunModelId | null | undefined): PistolModel | null => (id && gunLookOn() ? PISTOL_MODELS[id] ?? null : null);

// ------------------------------------------------------------ who carries which
/** WHICH MODELS ARE ON A MAN (Character.gunLook; written by the simulation each step — game.ts for a teammate, player.ts for you — and by the kit screen for
 *  its figure; read by rigProps.ts): `hand` the gun in his hands, `long` his long gun (wherever it is: in his hands, slung, hung down his front), `side` his
 *  sidearm (in his hand or on his thigh). null each: that gun is drawn as its rig group always drew it. */
export interface GunLook { hand: GunModelId | null; long: GunModelId | null; side: GunModelId | null }
/** … from the rows he carries: the one in his hands and the other one (null: none) */
export function gunLookOf(into: GunLook | null, inHands: WeaponDef | null, other: WeaponDef | null, third: WeaponDef | null = null): GunLook | null {
  if (!gunLookOn()) return null;
  const L = into ?? { hand: null, long: null, side: null }; L.hand = inHands?.own?.model ?? null; L.long = null; L.side = null;
  for (const d of [third, other, inHands]) { if (!d) continue; const m = d.own?.model ?? null; if (d.cls === 'pistol') L.side = m; else if (!(d === inHands && third && d.id === 'm870')) L.long = m; }   // (the big slot's pump gun in his hands is not his long gun: that one, `third`, is on its sling)   // (the big slot's pump gun is nobody's long gun: his own hangs down his front while it is out)
  return L;
}
