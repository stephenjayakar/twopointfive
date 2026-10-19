// The graded visual effects, as numbers and as the code that spawns them: the shot (bore jet, side ports, lingering wisp, powder sparks,
// warm flash), the stun canister going off on the floor (end jets + body vents, wisp, incandescent fragments with smoke trails, white
// flash) and the smoke can's floor-hugging vent. Ported from twopointfive's src/game/effects.ts (blocks `muzzle`, `burst`, `flash`,
// `sparks`, `trail`, `vent`, tuning history 26df598..13ba1b8) onto this project's SmokeSystem emitters, transient lights and box sparks.
//
// EVERY TUNED NUMBER LIVES HERE so the set can be graded in one place; game.ts / sparks.ts / the panel only read it. Values are in OUR
// units — what the solver and renderer actually receive — with the reference value in the trailing "ref" note. The conversions applied:
//
//   quantity              theirs → ours     why
//   density rate (/s)     × 0.09            optical equivalence: their tracer draws σt = 0.55/m per density unit, our march uses 6/m per unit
//                                           (volumetrics.wgsl `dens * 6.0`), 0.55/6 = 0.092. Cross-check: the ported shot deposits ~7.8e-3
//                                           unit·m³ of smoke against ~9.1e-3 for the hand-tuned puff it replaces — same league, by a different road.
//   temperature rate (/s) × 1.5             equal buoyant impulse per deposited unit: their tuning page ran buoyancy 6.0 m/s² per unit cooling at
//                                           3/s (2 m/s per unit); ours is 1.6 m/s² per unit decaying at 1.2/s (1.33 m/s per unit)
//   jet speed (m/s)       × 0.5, ≤ 8        our forces kernel clamps |u| at 8 m/s and a fine domain is 1.4 m across (64 × 2.2 cm) (theirs: 4 m box); halving
//                                           keeps the bore : port : wisp ratios instead of flattening everything against the clamp
//   push (1/s), expand (1/s), attack / life (s)   1 : 1    same semantics after the solver port (smoke.wgsl: per-emitter push, sourceExpansion)
//   splat radius (m)      × 0.6             their splat is (1−r²/R²)² with compact support R (half-max at 0.54 R, volume 0.96 R³); ours is
//                                           exp(−r²/R²) cut at 3R (half-max 0.83 R, volume 5.57 R³). Matching the half-max radius says 0.65,
//                                           matching deposited volume says 0.556 — 0.6 splits them. Then floored per lattice where a splat would
//                                           fall under one cell (their own "honest lie": the shape survives, the scale does not)
//   effect-internal lengths (standoff, can half-length)   × 0.6   with the radii, so proportions survive
//   lattice               3.125 cm theirs;  shot → our fine 2.2 cm domains (bore jet 3.6 cells, wisp 1.9 — their "two cells across"),
//                                           canister effects → our coarse 5.5 cm domains (burst core 4.2 cells, trails floored to 1 cell)
//   light power           not derivable     (their raymarch takes power/d² at its own exposure); set against what was here: the old muzzle pair
//                                           summed to 92 × 0.45 for the player, torches are 55–70, and a stun charge should out-blast all of it
//   spark kinematics      1 : 1             metres and seconds, no lattice involved; only the COUNTS shrink (they are boxes here, pool of 96)
//
// What could not be checked from here (no GPU in the loop): whether × 1.5 heat reads as "lifts on its own" or as "boils" in a 1.6 m tall
// fine box, and whether 600 for 0.14 s is a stun charge or a camera flash under AgX — hence the gains below and the Effects panel section.
import { Vec3, v3 } from '../math/vec';
import { SmokeSystemLike } from '../smoke/types';
import type { Sparks } from './sparks';

/** A transient light an effect wants fired (LightSet.flash: history-free, so 1–8 frames of very bright light leave nothing behind). */
export interface FxLight { pos: Vec3; color: Vec3; intensity: number; range: number; ttl: number; radius?: number; }

/** Risky / taste bits switchable at runtime (Effects panel). */
export const flags = {
  shotSparks: true,        // powder streaks out of the bore
  ejectionWisp: true,      // the small ejection-port curl the shipped look had (not in the reference set)
  trails: true,            // smoke emitters riding the stun canister's sparks
  ventCanister: false,     // slot-2 smoke can: false = the shipped upward jet + plume (preferred look), true = the ported directional floor vent (A/B from the Effects panel)
  dazzle: true,            // stun canister blinds guards with line of sight
};

/**
 * A shot: three things on three timescales, which is why it is not a small burst. The light is over in ~90 ms. The gas jet is over in
 * 60 ms and is DIRECTIONAL — propellant leaving a bore, a cone thrown forward, plus what leaves through the side ports (the part that reads
 * as a weapon rather than a jet of gas). The wisp outlives both fifty times over and is the only part anyone has time to look at, so it
 * has its own radius and heat: two cells across so it stays a thread, hot enough that buoyancy lifts it without being thrown.
 */
export const shot = {
  standoff: 0.22,                                     // m ahead of the muzzle where the bore gas appears (ref 0.30) — the forward part of jetOff; kept for the light position
  // emitter anchors as offsets in the muzzle frame [right, up, forward] (m) — what the viewer's emitter gizmos move
  jetOff: [0, 0, 0.22] as Vec3, portOff: [0, 0, 0.154] as Vec3, wispOff: [0, 0, 0.03] as Vec3,
  jetRadius: 0.08, jetDensity: 24, jetTemp: 120,      // ref 0.13 m, 260 /s, 80 /s
  jetSpeed: 10.5, jetRise: 0.2, jetPush: 90,          // ref 16 m/s (+0.4 up); 10.5 with the 1.4 m fine domain (was 8 in the 1.06 m one): the gas visibly carries past the pistol. push 90: imposes the bore velocity inside one step
  jetExpand: 24,                                      // modest and far below the stun charge's 90: expansion divides density, and a muzzle puff is small and DENSE
  jetLife: 0.08, jetAttack: 0.01,
  ports: 2, portFraction: 0.4, portAngle: 1.1,        // side ports: bearing off the bore (rad), each carrying 40 % of the bore's density / heat
  portRadiusK: 0.7, portSpeedK: 0.55, portPushK: 0.6, portExpandK: 0.5,
  wispRadius: 0.042, wispDensity: 4.1, wispTemp: 43,  // ref 0.07 m ("two cells"), 46 /s, 28.5 /s
  wispRise: 0.6, wispPush: 4, wispLife: 2.5, wispAttack: 0.15,   // ref rise 1.2 m/s; follows the barrel (SmokeSystem `track`) like the old wisp did
  ejectRadius: 0.018, ejectDensity: 1.6, ejectTemp: 2.5, ejectLife: 0.7,   // ours (shipped look), see flags.ejectionWisp
  jitter: 0.1,                                        // per-frame wobble on the jets; the reference had none, our plumes need a little to break symmetry
  lightColor: [1.0, 0.62, 0.26] as Vec3,              // ~2000 K propellant: strongly orange — white here reads as a camera going off
  lightPower: 90, lightDuration: 0.09, lightRange: 8, // ref power 46 / 0.09 s. 90: the pair this replaces peaked at 70 + 22
  suppressedGain: 0.45,                               // player's suppressed 5.7 vs a guard's bare 9 mm (light only; the gas is the same gas)
  sparkCount: 20, sparkSpeed: 31, sparkCone: 0.25, sparkLife: 0.06,     // ref 44 sparks; fast, tight and brief (tuned in the viewer): speed is the streak's LENGTH, life how far it gets
};

/**
 * What differs per WEAPON about the shot above (weapons.ts WeaponDef.muzzleFx keys this; the gas is the same gas for every gun): the 1-frame flash card — the
 * visible flame, a small emissive box `cardAhead` m down the bore from the muzzle, half extents `cardHalf` — and the gain on shot.lightPower for the ~2000 K
 * flash (a suppressed row is × suppressedGain on top of it: combat.ts fireWeapon), reaching `lightRange` m if the block says (else shot.lightRange). The two
 * pistols' numbers are the ones fireWeapon used to pick by `isPlayer ?` (unchanged). The viewer's K fires the block of the kit in the hands (carbine / bare /
 * suppressed), so what is graded there IS what the game fires.
 */
export interface MuzzleFx { cardAhead: number; cardHalf: Vec3; cardEmissive: Vec3; lightGain: number; lightRange?: number; }
export const muzzleFx = {
  pistolSuppressed: { cardAhead: 0.05, cardHalf: [0.018, 0.018, 0.045], cardEmissive: [40, 22, 8], lightGain: 1 } as MuzzleFx,   // Sam's Five-seveN through its can: a small dim flame (the light's dimming is suppressedGain's job)
  pistolBare: { cardAhead: 0.09, cardHalf: [0.03, 0.03, 0.08], cardEmissive: [90, 50, 16], lightGain: 1 } as MuzzleFx,             // a guard's bare 9 mm: the full flame and the full light
  // the guards' AKS-74U (rifles, docs/internal/sc20k-design.md §2 / §3.3): the short barrel's famous fireball out of the conical booster — a flame card twice the bare
  // pistol's in every extent set a hand further down the bore, hotter at the core, and × 1.7 the light thrown 10 m instead of 8 (three of them 0.1 s apart strobe the
  // shooter's end of the room). UNTUNED — the doc's starting numbers; grade in the viewer (guard kit ▸ carbine, K) and paste back here.
  carbine: { cardAhead: 0.14, cardHalf: [0.04, 0.04, 0.12], cardEmissive: [110, 60, 18], lightGain: 1.7, lightRange: 10 } as MuzzleFx,
  // Sam's FN2000 (rifles, docs/internal/sc20k-design.md §5): 5.56 out of an integral suppressor — more gas than the pistol's little can lets by, far less than a bare
  // muzzle: the doc's card (h [0.03, 0.03, 0.09], emissive [60, 34, 12]) a hand down the bore, and the light × 1.2 before the row's suppressedGain (× 0.45) takes it
  // to ≈ 0.55 of a bare pistol's over 8 m — the doc's "flashGain 0.55". UNTUNED — grade in the viewer (Sam ▸ rifle: shouldered, K) and paste back here.
  sc20k: { cardAhead: 0.09, cardHalf: [0.03, 0.03, 0.09], cardEmissive: [60, 34, 12], lightGain: 1.2 } as MuzzleFx,
  // THE GUNS A CARD'S TWO SLOTS OFFER, each its own flame (gunlook.ts GUNLOOK: read through flameOf — with that switch off each fires the block its row's
  // `muzzleFx` names, as it did). UNTUNED, every one: first numbers set against the four above, never seen on a GPU — grade in the viewer and paste back.
  // Mk 12: 5.56 from eighteen inches through a can — the powder is burnt before the baffles get it: less flame than the short carbine's can lets by, and darker
  mk12: { cardAhead: 0.07, cardHalf: [0.024, 0.024, 0.07], cardEmissive: [44, 24, 8], lightGain: 1.0 } as MuzzleFx,
  // MP7: 4.6 mm through its can — the least there is to see of any long gun: a pistol can's wisp, a hair longer
  mp7: { cardAhead: 0.05, cardHalf: [0.016, 0.016, 0.05], cardEmissive: [34, 19, 7], lightGain: 0.85 } as MuzzleFx,
  // Mk 46: a bare 5.56 behind a slotted flash hider — the flame split thin and wide rather than the short rifle's ball, but there is one every twelfth of a second:
  // the string strobes his end of the room
  mk46: { cardAhead: 0.11, cardHalf: [0.05, 0.022, 0.085], cardEmissive: [95, 52, 16], lightGain: 1.45, lightRange: 10 } as MuzzleFx,
  // M1014: an ounce of shot out of a bare eighteen-inch tube — a fat, round, orange ball, slower burning than a rifle's and the brightest flash on the floor
  m1014: { cardAhead: 0.15, cardHalf: [0.06, 0.06, 0.11], cardEmissive: [120, 58, 14], lightGain: 2.0, lightRange: 11 } as MuzzleFx,
  // HK45: subsonic .45 through a big can — next to nothing: the dimmest thing a gun here shows
  hk45: { cardAhead: 0.045, cardHalf: [0.016, 0.016, 0.035], cardEmissive: [26, 14, 5], lightGain: 0.7 } as MuzzleFx,
  // Glock 18: the bare 9 mm's flame, and out of the compensator cuts a lick of it straight up — taller than it is wide; twenty a second, it reads as one flicker
  g18: { cardAhead: 0.08, cardHalf: [0.026, 0.042, 0.07], cardEmissive: [95, 52, 16], lightGain: 1.1 } as MuzzleFx,
};
export type MuzzleFxKey = keyof typeof muzzleFx;
/** shared by every card: warm paper-white albedo (it is only ever seen emitting) and one frame and a bit of life */
export const muzzleCard = { albedo: [1, 0.8, 0.5] as Vec3, ttl: 0.035 };

/**
 * The stun canister: a cylinder venting through ports at its ends ON THE GROUND — two opposed axial jets (one dominating), a weaker skirt
 * of body vents so it is not a dumbbell, and expansion rather than momentum doing the work (life 0.12 s, expand 90). The wisp is a second,
 * much weaker source that survives it. `seed` (per throw) picks the resting orientation and every port's deviation from ideal, so no two
 * cans come apart the same way.
 */
export const bang = {
  fuse: 1.5, maxAir: 3.0,                             // s after first contact; s of flight before it goes off regardless
  height: 0.07,                                       // burst centre above the resting can (≈ 0.12 m off the floor, ref 0.12): the bank spreads sideways because it cannot go down
  radius: 0.23, density: 6.3, temp: 48,               // end jets: ref 0.38 m, 70 /s, 32 /s
  expand: 90, life: 0.12, attack: 0.02, endPush: 40,
  ventSpeed: 7, halfLength: 0.10,                     // ref 14 m/s, 0.17 m
  asymmetry: 0.45, tilt: 0.25, jitter: 0.6,           // 0 = both ends equal … 1 = one end does everything; axis tilt off horizontal (rad); per-port deviation
  bodyVents: 5, bodyFraction: 0.25, bodyPush: 30, bodyRadiusK: 0.7, bodySpeedK: 0.6, bodyExpandK: 0.5,
  wispRadius: 0.24, wispDensity: 1.2, wispTemp: 10.5, wispRise: 0.6, wispPush: 5, wispLife: 3, wispAttack: 0.3,   // ref 0.4 m, 13 /s, 7 /s, 1.2 m/s; life 6 → 3 (tuned in the viewer: the haze should clear, not linger)
  frameJitter: 0.08,                                  // per-frame wobble on top of the seeded shape (small: the seed already did the work)
  densityGain: 1.0, tempGain: 1.0,                    // live grade multipliers (panel)
  lightColor: [1.0, 0.98, 0.95] as Vec3,              // magnesium white, no hue: warm would read as an explosion, not a stun charge
  lightPower: 1600, lightDuration: 0.14, lightRange: 14, lightRadius: 0.15, lightLift: 0.3,  // ref 156 / 0.14 s; 600 → 1600 tuned in the viewer (it should white the room out for a frame); lifted off the floor so it lights the room, not a disc of lino
  sparkCount: 72,                                     // ref 260 (they were GL lines; ours are boxes from a pool of 96)
  trailCount: 12, trailReserve: 2,                    // ref 90 (their game afforded 24); charged against SmokeSystem.budget() at spawn, keeping `reserve` free
  hearing: 28,                                        // m: every guard on the floor hears it (through the shared propagation model)
  dazzleRadius: 8, dazzleSeconds: 6.0, dazzleMin: 2.0,// guards with line of sight: blind + frozen this long (falls off to dazzleMin at the radius) — a real charge buys ~5 s of flash blindness up close
};

/** Burning fragments: ballistic, never touch the density field. What makes the first fifth of a second read as a detonation. */
export const sparks = {
  speed: 20, spread: 0.55, lift: 0.5, life: 0.55,     // lift rotates the throw toward vertical (a can venting against the floor), spread narrows it; 14/0.45/0.9 → 20/0.5/0.55 tuned in the viewer (faster, shorter-lived fragments)
  gravity: 16, drag: 1.6,
  brightness: 2.6, hold: 0.15,                        // × colour (meant to clip); fraction of life at full brightness before the fall-off
  maxLive: 96,                                        // pool / box budget
  emissive: 25,                                       // HDR radiance at f = 1 before brightness (flash card ≈ 40, lit ceiling panel ≈ 6)
  thickness: 0.002, shutter: 0.017, minStreak: 0.02,  // hair-thin streaks now that they are oriented along their travel (tuned in the viewer); length = speed × shutter
  collide: true,                                      // ray cast fast sparks against walls / props / doors (≤ 96 short rays a frame)
};

/**
 * Tracer rounds (rifles, docs/internal/sc20k-design.md §3.3 — lane R6; src/game/tracers.ts draws them): the round itself is hitscan and has already landed;
 * what you SEE is a streak travelling muzzle → impact at `speed` (280 m/s: a 20 m corridor in four or five frames at 60 Hz — cinematic, a real 5.45 tracer does
 * 880), a thin emissive box from where the head was a shutter-time ago to where it is (so its length IS its speed, like a spark's), a small warm light riding the
 * head that washes the wall it passes and the haze it crosses, and — where it stops in something solid — an ember: two or three sparks and a 60 ms glow. Very
 * short shots are slowed so they still read for a couple of frames (minLife). UNTUNED starting numbers: grade in the viewer (Guard ▸ carbine: tracers, K) or in
 * the corridor at night and paste back here.
 */
export const tracerFx = {
  speed: 280,                                         // m/s the streak's head travels (the round is hitscan; this is the picture)
  minLife: 0.042,                                     // s: a short shot is slowed to last at least this long (2½ frames at 60 Hz), so a 3 m round still shows as a moving streak
  shutter: 0.011,                                     // s of travel one streak shows: length = speed × shutter ≈ 3.1 m at full speed (never longer than the distance flown so far)
  thickness: 0.012,                                   // m; widened to ~a pixel and dimmed by the same factor when the camera is far (the laser's rule), so it never crawls
  emissive: 60,                                       // × the row's colour = HDR radiance of the streak ([60, 25, 7] for the AK's orange): meant to bloom (a white-hot spark is 65, the flame card 40–110)
  minPath: 0.5,                                       // m: a round that stops nearer than this (the muzzle in the jamb, a contact shot) shows no streak
  lightIntensity: 4, lightRange: 4, lightRadius: 0.06,   // the head's light: a warm wash on what it passes within a couple of metres — a few candela, 1/20 of a muzzle flash — reaching 4 m
  emberSparks: 3, emberSpeed: 5, emberCone: 0.9, emberLife: 0.3,   // the splash where it stops in geometry: a few sparks back off the wall (never in a man, never on a miss into the sky)
  emberIntensity: 2.5, emberRange: 2.5, emberTtl: 0.06,             // and its glow: a 60 ms point light in the tracer's colour just off the surface
  maxLive: 24,                                        // streaks alive at once (pool; the oldest goes when a fresh one needs the slot) — a whole box dumps ≤ 4, three riflemen ≤ 12
  maxLights: 6,                                       // of those, how many carry the head light (LightSet holds 64 lights all told, the level's ~54 rows first: transients share what is left)
};

/** Smoke hung off the first `bang.trailCount` sparks: inherits each fragment's direction, arc and bounce, so the cloud's arms are irregular for free. */
export const trail = {
  radius: 0.036, minVoxels: 1,                        // ref 0.06 m = 0.65 coarse cells → floored to one cell (0.055) or it deposits nothing
  density: 8.6, temp: 45, life: 0.9, attack: 0.01,    // ref 95 /s, 30 /s; life matched to the sparks so the trail draws the fall, not just the throw
};

/**
 * The smoke can as a cold, dense, DIRECTIONAL vent: the jet leaves sideways under pressure (push 45 imposes it within a frame), temp 0 so
 * nothing lifts it and the solver's weight term pools it, no expansion (that thins a cloud — the opposite of what a screen wants).
 */
export const vent = {
  radius: 0.33, density: 18, temp: 0,                 // ref 0.55 m, 200 /s
  speed: 4.5, rise: 0.15, push: 45, expand: 0,        // ref 9 m/s + 0.3 up
  seconds: 30, attack: 0.12, jitter: 0.12,
  standoff: 0.07, height: 0.12,                       // vent mouth: along the axis from the can, above its centre
};

// ------------------------------------------------------------------------------------------------ spawners
type Track = () => { pos: Vec3; dir: Vec3 } | null;

/**
 * A shot from `muzzle` down unit `dir`: bore jet, side ports, the wisp (riding `track` — the live barrel — if given), powder sparks.
 * Returns the light to fire. Everything lands on the fine lattice.
 */
/** Muzzle frame for the emitter offsets: z = bore direction, y = up-ish, x = right (same construction as rigProps.frameFrom). */
export function muzzleFrame(o: Vec3, d: Vec3): { o: Vec3; x: Vec3; y: Vec3; z: Vec3 } {
  const z = v3.normalize(d); let y = v3.sub([0, 1, 0], v3.scale(z, z[1])); if (v3.len(y) < 1e-3) y = v3.sub([1, 0, 0], v3.scale(z, z[0])); y = v3.normalize(y);
  return { o: v3.copy(o), x: v3.cross(y, z), y, z };
}
export function spawnShot(smoke: SmokeSystemLike, sp: Sparks | null, muzzle: Vec3, dir: Vec3, o: { seed: number; lightGain?: number; lightRange?: number; track?: Track; eject?: Track }): FxLight[] {
  const S = shot; const d = v3.normalize(dir); const F = muzzleFrame(muzzle, d); const at3 = (off: Vec3): Vec3 => v3.mad(v3.mad(v3.mad(muzzle, F.x, off[0]), F.y, off[1]), F.z, off[2]);
  // (`anchor`: where the old box solver centred the shot's one 1.4 m box, ahead of the muzzle. The page's solver has no boxes and reads nothing of it; the retired native host's port does)
  const at = at3(S.jetOff); const anchor = v3.mad(muzzle, d, 0.38);
  const jv: Vec3 = [d[0] * S.jetSpeed, d[1] * S.jetSpeed + S.jetRise, d[2] * S.jetSpeed];
  // the bore: `push` drags the medium down the barrel (a jet, not a ball that happens to be off-centre); `expand` makes it open as it goes
  smoke.emit({ pos: at, dir: jv, speed: v3.len(jv), radius: S.jetRadius, density: S.jetDensity, temperature: S.jetTemp, ttl: S.jetLife, age: 0, kind: 'jet', push: S.jetPush, expand: S.jetExpand, attack: S.jetAttack, jitter: S.jitter, lattice: 'fine', anchor, confined: true });
  // side ports, symmetric about the bore and angled up: gas that does not leave through the barrel
  const yaw = Math.atan2(d[0], d[2]);
  for (let i = 0; i < S.ports; i++) {
    const a = yaw + (i % 2 === 0 ? 1 : -1) * S.portAngle; const ps = S.jetSpeed * S.portSpeedK; const pv: Vec3 = [Math.sin(a) * ps, ps * 0.5, Math.cos(a) * ps];
    smoke.emit({ pos: at3(S.portOff), dir: pv, speed: v3.len(pv), radius: S.jetRadius * S.portRadiusK, density: S.jetDensity * S.portFraction, temperature: S.jetTemp * S.portFraction, ttl: S.jetLife, age: 0, kind: 'jet', push: S.jetPush * S.portPushK, expand: S.jetExpand * S.portExpandK, attack: S.jetAttack, jitter: S.jitter, lattice: 'fine', anchor, confined: true });
  }
  // what is still there seconds later: cool(er) and slow, so buoyancy drifts it rather than anything throwing it
  const wv: Vec3 = [d[0] * 0.25, d[1] * 0.25 + S.wispRise, d[2] * 0.25];
  smoke.emit({ pos: at3(S.wispOff), dir: wv, speed: v3.len(wv), radius: S.wispRadius, density: S.wispDensity, temperature: S.wispTemp, ttl: S.wispLife, age: 0, kind: 'wisp', push: S.wispPush, attack: S.wispAttack, jitter: 0.25, lattice: 'fine', anchor, confined: true, track: o.track });
  if (flags.ejectionWisp && o.eject) { const e = o.eject(); if (e) smoke.emit({ pos: e.pos, dir: [0, 1, 0], speed: 0.1, radius: S.ejectRadius, density: S.ejectDensity, temperature: S.ejectTemp, ttl: S.ejectLife, age: 0, kind: 'wisp', lattice: 'fine', anchor, confined: true, track: o.eject }); }
  // unburnt powder: a narrow fast cone about the bore, gone before the gas has finished leaving
  if (sp && flags.shotSparks && S.sparkCount > 0) sp.emitCone(v3.mad(muzzle, d, 0.04), [d[0], d[1] + 0.08, d[2]], { count: S.sparkCount, speed: S.sparkSpeed, cone: S.sparkCone, life: S.sparkLife }, o.seed);
  return [{ pos: v3.mad(muzzle, d, S.standoff * 0.4), color: S.lightColor, intensity: S.lightPower * (o.lightGain ?? 1), range: o.lightRange ?? S.lightRange, ttl: S.lightDuration }];
}

/**
 * A stun canister coming apart at `at` (on whatever it landed on): two opposed end jets, the body vents, the wisp, sparks, and smoke hung
 * off the first few sparks. Coarse lattice (the cloud is metres across within a second). Returns the flash to fire.
 */
/** `o.sparkCount`: how many CPU sparks to fly instead of bang.sparkCount — the GPU particle path (game/particleFx.ts bangFx) throws the visible fragments itself and
 *  asks only for the few that carry smoke trails (their emitters ride CPU spark positions); absent = the authored count, untouched. */
export function spawnBurst(smoke: SmokeSystemLike, sp: Sparks | null, at: Vec3, seed: number, o?: { sparkCount?: number }): FxLight {
  const B = bang; const rnd = (k: number) => { const t = Math.sin(seed * 37.31 + k * 91.7) * 43758.5453; return t - Math.floor(t); };
  const dens = B.density * B.densityGain, temp = B.temp * B.tempGain;
  // a can lying on the floor: axis mostly horizontal, yaw wherever it came to rest, tilted a little because floors are not billiard tables
  const yaw = rnd(1) * Math.PI * 2, tilt = (rnd(2) - 0.5) * 2 * B.tilt;
  const ax: Vec3 = [Math.cos(tilt) * Math.sin(yaw), Math.sin(tilt), Math.cos(tilt) * Math.cos(yaw)];
  const bias = (rnd(3) - 0.5) * 2 * B.asymmetry; const J = B.jitter;
  const wobble = (dv: Vec3, amount: number, k: number): Vec3 => v3.normalize([dv[0] + (rnd(k) - 0.5) * amount, dv[1] + (rnd(k + 1) - 0.5) * amount, dv[2] + (rnd(k + 2) - 0.5) * amount]);
  const common = { age: 0, kind: 'jet' as const, lattice: 'coarse' as const, jitter: B.frameJitter, confined: true };
  // end jets, deliberately unequal (in footage one port almost always dominates), not exactly at the ends, not exactly opposed
  let si = 0;
  for (const side of [1, -1]) {
    si++;
    const w = (1 + side * bias) * (1 + (rnd(40 + si) - 0.5) * J); if (w <= 0.02) continue;
    const along = B.halfLength * side * (0.6 + rnd(50 + si) * 0.8);
    const dv = wobble(v3.scale(ax, side), J * 0.9, 60 + si * 3); const spd = B.ventSpeed * (1 + (rnd(70 + si) - 0.5) * J * 0.8);
    smoke.emit({ ...common, pos: v3.mad(at, ax, along), dir: dv, speed: spd, radius: B.radius * (1 + (rnd(80 + si) - 0.5) * J * 0.7), density: dens * w, temperature: temp * w, push: B.endPush, expand: B.expand, ttl: B.life * (1 + (rnd(90 + si) - 0.5) * J * 0.5), attack: B.attack });
  }
  // skirt: weaker body ports perpendicular to the axis, spread along the body — what stops the two jets reading as a dumbbell
  const up: Vec3 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; const P = v3.normalize(v3.cross(up, ax)); const Q = v3.cross(ax, P);
  for (let i = 0; i < B.bodyVents; i++) {
    const a2 = (i / Math.max(1, B.bodyVents)) * Math.PI * 2 + rnd(10 + i) * 1.2; const c = Math.cos(a2), s = Math.sin(a2);
    const dv = wobble([P[0] * c + Q[0] * s, P[1] * c + Q[1] * s, P[2] * c + Q[2] * s], J * 0.7, 150 + i * 3);
    const w = B.bodyFraction * (0.5 + rnd(30 + i)) * (1 + (rnd(120 + i) - 0.5) * J);
    const along = (rnd(130 + i) - 0.5) * 2 * B.halfLength; const spd = B.ventSpeed * B.bodySpeedK * (1 + (rnd(140 + i) - 0.5) * J);
    smoke.emit({ ...common, pos: v3.mad(at, ax, along), dir: dv, speed: spd, radius: B.radius * B.bodyRadiusK * (1 + (rnd(170 + i) - 0.5) * J * 0.8), density: dens * w, temperature: temp * w, push: B.bodyPush, expand: B.expand * B.bodyExpandK, ttl: B.life * (1 + (rnd(180 + i) - 0.5) * J * 0.5), attack: B.attack });
  }
  // the wisp: one source cannot be both the bang and what is left afterwards
  smoke.emit({ pos: v3.copy(at), dir: [0, 1, 0], speed: B.wispRise, radius: B.wispRadius, density: B.wispDensity * B.densityGain, temperature: B.wispTemp * B.tempGain, ttl: B.wispLife, age: 0, kind: 'cloud', push: B.wispPush, attack: B.wispAttack, jitter: 0.3, lattice: 'coarse' });
  const sparkCount = o?.sparkCount ?? B.sparkCount;
  if (sp && sparkCount > 0) {
    const idx = sp.emitBurst(at, { count: sparkCount, speed: sparks.speed, spread: sparks.spread, lift: sparks.lift, life: sparks.life }, seed);
    // smoke riding the sparks themselves: each trail reads its spark's live position, so it inherits a direction, an arc and a floor bounce nobody laid out
    const n = flags.trails ? Math.max(0, Math.min(B.trailCount, idx.length, (smoke.budget?.() ?? B.trailCount) - B.trailReserve)) : 0;
    for (let i = 0; i < n; i++) {
      const tr = sp.tracker(idx[i]); const p0 = tr();
      if (p0) smoke.emit({ pos: v3.copy(p0.pos), dir: [0, 1, 0], speed: 0, push: 0, radius: trail.radius, minVoxels: trail.minVoxels, density: trail.density * B.densityGain, temperature: trail.temp * B.tempGain, ttl: trail.life, age: 0, kind: 'trail', attack: trail.attack, jitter: 0, lattice: 'coarse', confined: true, prio: 0, track: tr });
    }
  }
  // the light and the smoke are the same event and start on the same frame; a flash that leads or trails its own cloud reads as two things
  return { pos: v3.add(at, [0, B.lightLift, 0]), color: B.lightColor, intensity: B.lightPower, range: B.lightRange, ttl: B.lightDuration, radius: B.lightRadius };
}

/** The smoke can venting along `yaw` from `at` (the vent mouth; `track` keeps it on a can that is still rolling). Returns the emission time for the hiss. */
export function spawnVent(smoke: SmokeSystemLike, at: Vec3, yaw: number, o: { track?: Track; seconds?: number } = {}): number {
  const V = vent; const seconds = o.seconds ?? V.seconds;
  const dv: Vec3 = [Math.sin(yaw) * V.speed, V.rise, Math.cos(yaw) * V.speed];   // a touch of lift so the jet clears the floor it lies on and then settles, instead of scrubbing along it from the first cell
  smoke.emit({ pos: v3.copy(at), dir: dv, speed: v3.len(dv), radius: V.radius, density: V.density, temperature: V.temp, ttl: seconds, age: 0, kind: 'vent', push: V.push, expand: V.expand, attack: V.attack, jitter: V.jitter, lattice: 'coarse', prio: 2, track: o.track });
  return seconds;
}

/** Where a can lying at `itemPos` vents from, for a jet along `yaw`. */
export function ventMouth(itemPos: Vec3, yaw: number): Vec3 { return [itemPos[0] + Math.sin(yaw) * vent.standoff, itemPos[1] + vent.height, itemPos[2] + Math.cos(yaw) * vent.standoff]; }
