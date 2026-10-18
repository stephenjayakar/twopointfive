// The game's side of the GPU particles (EXPERIMENT E4, render/particles.ts): every effect SITE, and the one switch they all route by. gpuFx(g) is the live
// system while engine.settings.gpuParticles is on and a Particles is attached (game.ts attaches one on a real Engine; the headless harness has none) —
// then a bullet strike knocks sparks / chips / dust out of what it hit by its material, every round ejects a case, the stun charge throws its
// fragments and a dust ring, a kicked door coughs plaster and splinters at the latch, the ring airfoil clacks a few sparks off the wall, and the muzzle's
// powder sparks and the tracer's embers go to the GPU instead of the box sparks. null = TODAY EXACTLY: the CPU sparks of game/sparks.ts at the three sites
// that had them (muzzle powder, the stun charge, tracer embers) and nothing at the new ones. Nothing here draws from Math.random (the identity probes replay
// rounds by it): the particles hash their own serial. The one sound it adds — a case landing — is scheduled off the shot on the CPU (the GPU cannot call
// back), and is deliberately NOT a hearing event: the report it follows already is one, at the same spot, an order of magnitude louder.
import { SideMap } from '../math/side';
import { BoxFlag } from '../scene/boxes';
import { Vec3, v3 } from '../math/vec';
import { OFFICE_DATA } from '../scene/level';
import { gwotSimOf } from '../scene/gwotPalette';
import type { Particles, EmitOpts } from '../render/particles';
import type { Game } from './game';
import type { Character } from './character';
import type { Door } from './doors';
import type { Prop } from './props';
import type { WeaponDef, WeaponId } from './weapons';
import * as fx from './effects';
import { blastSparks } from './blastLook';

/** the live GPU particle system, or null → the caller keeps to the CPU path (read straight off the engine so the harness's engine stand-in — no `particles`
 *  field at all — is simply 'off') */
export function gpuFx(g: Game): Particles | null {
  const e = g.engine as { particles?: Particles | null; settings: { gpuParticles?: boolean } };
  return e.particles && e.settings.gpuParticles ? e.particles : null;
}

// ------------------------------------------------------------------ DUST PUFFS: every `dust` emit goes through emitDust(), so the whole family — impact puffs, the destruction lane's
// gypsum / wood / concrete bursts, the stun charge's ring and column, a kicked door's threshold dust, a dropped tile's powder — is tuned from ONE table (the maintainer, 08-11:
// "the dust puffs on destruction (gpu particles, not the real smoke sim) also look kinda lame. make sure they're configurable"). EMIT side = multipliers on what each site
// asks for; LOOK side = the kind's numbers the kernels read (render/particles.ts params.dust: opacity, growth, and — in the slots a puff never used for physics — the fade-in,
// the edge softness, the scatter toward the eye, the ambient share). Kept per machine (localStorage twopointsix.dust); all 1 / the shipped look = the game as it was.
export const DUST = { count: 1, size: 1, life: 1, speed: 1, rise: 1, spread: 1 };
/** the LOOK, mirrored onto Particles.params.dust by applyDustLook: opacity = peak opacity at the centre (brightOrOpacity), growth = × radius over its life (shutterOrGrowth), fadeIn = s to
 *  full opacity (sleepV slot), soft = × the depth-softening / edge feather (holdOrFade slot), wrap = the share of a crossing beam scattered toward the eye (restitution slot), ambient = × the
 *  cache's ambient on it (keep slot) */
export const DUST_LOOK = { opacity: 0.3, growth: 0.6, fadeIn: 0.05, soft: 1.3, wrap: 0.5, ambient: 1.0 };   // (08-12, the maintainer: the puffs 'radially expanding outwards look pretty fake' — was opacity 0.4 / growth 2.2: discs blooming to 3× while flying out; now a puff blooms a little where it was raised and hangs)
export const DUST_DEFAULTS = { emit: { ...DUST }, look: { ...DUST_LOOK } };
const DUST_LS = 'twopointsix.dust.v2';   // (v2: the 08-12 look defaults; a table saved under the first key would put the blooming discs back)
export function loadDust() {
  try { const raw = localStorage.getItem(DUST_LS); if (!raw) return; const o = JSON.parse(raw);
    for (const k of Object.keys(DUST) as (keyof typeof DUST)[]) { const v = o?.emit?.[k]; if (typeof v === 'number' && isFinite(v) && v >= 0) DUST[k] = v; }
    for (const k of Object.keys(DUST_LOOK) as (keyof typeof DUST_LOOK)[]) { const v = o?.look?.[k]; if (typeof v === 'number' && isFinite(v) && v >= 0) DUST_LOOK[k] = v; }
  } catch { /* no storage (bun) / junk */ }
}
export function saveDust() { try { localStorage.setItem(DUST_LS, JSON.stringify({ emit: DUST, look: DUST_LOOK })); } catch { /* */ } }
export function resetDust(g: Game) { Object.assign(DUST, DUST_DEFAULTS.emit); Object.assign(DUST_LOOK, DUST_DEFAULTS.look); try { localStorage.removeItem(DUST_LS); } catch { /* */ } applyDustLook(gpuFx(g)); }
/** the look table onto the kind's numbers (the kernels read params.dust every frame; a null system = nothing to do) */
export function applyDustLook(P: Particles | null) {
  if (!P) return; const d = P.params.dust;
  d.brightOrOpacity = DUST_LOOK.opacity; d.shutterOrGrowth = DUST_LOOK.growth; d.sleepV = DUST_LOOK.fadeIn; d.holdOrFade = DUST_LOOK.soft; d.restitution = DUST_LOOK.wrap; d.keep = DUST_LOOK.ambient;
}
/** THE dust emit: the site's numbers × the table (count rounded, never below 1 when the site asked for any) */
export function emitDust(P: Particles, pos: Vec3, dir: Vec3, count: number, o: EmitOpts): number {
  const n = count > 0 && DUST.count > 0 ? Math.max(1, Math.round(count * DUST.count)) : 0; if (n <= 0) return 0;   // (× 0 = no GPU dust anywhere; any other factor keeps at least one puff where a site asked for some)
  const k = DUST;
  if (k.size === 1 && k.life === 1 && k.speed === 1 && k.rise === 1 && k.spread === 1) return P.emit('dust', pos, dir, n, o);   // (the shipped table: the site's own record, untouched)
  return P.emit('dust', pos, dir, n, { ...o, size: o.size * k.size, life: o.life * k.life, speed: o.speed * k.speed, lift: o.lift === undefined ? undefined : o.lift * k.rise, posJit: o.posJit === undefined ? undefined : o.posJit * k.spread, vadd: o.vadd ? v3.scale(o.vadd, k.speed) : undefined });
}

// ------------------------------------------------------------------ what a surface is made of (for what a round knocks out of it)
export type Surf = 'metal' | 'plastic' | 'glass' | 'wood' | 'cardboard' | 'drywall' | 'concrete' | 'carpet' | 'fabric' | 'foliage';
/** the level's paint palette by name (levels/office.json materials) → the stuff behind the paint. 'black' is the server racks, bezels and chair bases: metal
 *  as far as a round is concerned (the racks are what gets shot in the dark); the coloured partitions chip like plasterboard. */
const MAT_SURF: Record<string, Surf> = {
  metal: 'metal', glassFrame: 'metal', black: 'metal', red: 'metal', screenOff: 'glass',
  wood: 'wood', woodDark: 'wood', cardboard: 'cardboard', chair: 'fabric', plant: 'foliage',
  wall: 'drywall', white: 'drywall', ceiling: 'drywall', partRed: 'drywall', partBlue: 'drywall', partTan: 'drywall',
  concrete: 'concrete', wallDark: 'concrete', stone: 'concrete', asphalt: 'concrete', lino: 'concrete',
  carpet: 'carpet', carpetBlue: 'carpet', carpetRed: 'carpet', grass: 'carpet',
};
/** albedo (exact palette value) → material name, built once off the bundled level data — the runtime Box carries no material key, but the loader copied every
 *  palette albedo verbatim, so an exact match names the paint (levelLoad.ts levelToData does the same trick to write the file back) */
let matByAlbedo: Map<string, string> | null = null;
export function paletteName(albedo: Vec3): string | undefined {
  if (!matByAlbedo) { matByAlbedo = new Map(); for (const [k, m] of Object.entries(OFFICE_DATA.materials ?? {})) { const key = (m.albedo as number[]).join(','); if (!matByAlbedo.has(key)) matByAlbedo.set(key, k); } }
  const key = albedo.join(','), hit = matByAlbedo.get(key); if (hit !== undefined) return hit;
  const look = gwotSimOf(albedo, key); return look !== undefined && look[0] !== '~' ? look : undefined;   // (a paint of the default look says which office paint it stands for: scene/gwotPalette.ts)
}
/** what a surface of this albedo is, by palette name when it has one, else by how bright it is (pale = plaster, dark = metal / plastic, between = concrete) */
export function surfOf(albedo: Vec3): Surf {
  const name = paletteName(albedo); if (name && MAT_SURF[name]) return MAT_SURF[name];
  if (!name) { const look = gwotSimOf(albedo); if (look !== undefined && look[0] === '~') return look === '~steel' ? 'concrete' : look === '~steelPale' ? 'drywall' : look.slice(1) as Surf; }
  const lum = 0.2126 * albedo[0] + 0.7152 * albedo[1] + 0.0722 * albedo[2];
  return lum > 0.5 ? 'drywall' : lum < 0.1 ? 'metal' : 'concrete';
}
/** the colour a rule that reads the PAINT ITSELF should read (how grey a steel cabinet is): the box's own — but for a paint of the default look, the office
 *  paint it stands for (scene/gwotPalette.ts), so a locker in olive drab is the steel locker it was */
export function paintStandsFor(albedo: Vec3): Vec3 {
  const look = gwotSimOf(albedo); if (look === undefined) return albedo;
  if (look === '~steel' || look === '~steelPale') return look === '~steel' ? [0.36, 0.36, 0.36] : [0.58, 0.58, 0.58];
  if (look[0] === '~') return albedo;
  return (OFFICE_DATA.materials?.[look]?.albedo as Vec3 | undefined) ?? albedo;
}
const PROP_SURF: Record<string, Surf> = { chair: 'fabric', cardboard: 'cardboard', bin: 'metal', plant: 'foliage' };

// ------------------------------------------------------------------ recipes
/** what one round knocks out of each surface: sparks (emissive), chips (lit, tinted), dust puffs (lit) — counts for a pistol round; a rifle's ×1.4 */
interface ImpactRecipe { sparks: number; chips: number; dust: number; chipTint: Vec3 | 'albedo' | 'pale'; dustTint: Vec3 | 'albedo'; sparkSpeed?: number; chipSize?: number }
const IMPACT: Record<Surf, ImpactRecipe> = {
  metal:     { sparks: 16, chips: 2,  dust: 0, chipTint: [0.08, 0.08, 0.09], dustTint: [0.5, 0.5, 0.5], sparkSpeed: 6, chipSize: 0.005 },
  plastic:   { sparks: 6,  chips: 5,  dust: 1, chipTint: 'albedo', dustTint: [0.5, 0.5, 0.5] },
  glass:     { sparks: 4,  chips: 9,  dust: 0, chipTint: [0.1, 0.11, 0.12], dustTint: [0.5, 0.5, 0.5], chipSize: 0.006 },
  wood:      { sparks: 0,  chips: 12, dust: 3, chipTint: [0.66, 0.52, 0.34], dustTint: [0.62, 0.52, 0.4] },   // fresh wood under the finish is pale
  cardboard: { sparks: 0,  chips: 8,  dust: 3, chipTint: 'albedo', dustTint: [0.6, 0.5, 0.36] },
  drywall:   { sparks: 0,  chips: 10, dust: 6, chipTint: 'pale', dustTint: [0.8, 0.78, 0.74] },              // gypsum: whiter than any paint over it
  concrete:  { sparks: 5,  chips: 10, dust: 5, chipTint: [0.45, 0.44, 0.42], dustTint: [0.55, 0.54, 0.52], sparkSpeed: 5 },
  carpet:    { sparks: 0,  chips: 4,  dust: 4, chipTint: 'albedo', dustTint: 'albedo' },
  fabric:    { sparks: 2,  chips: 5,  dust: 3, chipTint: 'albedo', dustTint: 'albedo' },
  foliage:   { sparks: 0,  chips: 10, dust: 2, chipTint: [0.14, 0.32, 0.1], dustTint: [0.3, 0.22, 0.14] },
};
/** Every tuned number of the sites below, in one place for the panel / a later grading pass. */
export const PFX = {
  impactScaleRifle: 1.4,
  sparkSize: 0.003, sparkLife: 0.38, sparkSpread: 0.9,
  chipSpeed: 1.7, chipLife: 18, chipSize: 0.007, chipSpread: 1.0,
  dustSpeed: 0.3, dustLife: 1.0, dustSize: 0.1,   // (an impact's puff: raised at the hole, stopped by the air within a hand's breadth — was 0.7 m/s / 1.3 s)
  muzzleSparkSize: 0.002,
  bangSparks: 160, bangSparkSize: 0.0025, bangRing: 40, bangRingRadius: 0.25, bangRingSpeed: 3.2, bangRingLife: 1.7, bangRingSize: 0.16, bangPuff: 10,
  kickDust: 9, kickSplinters: 14,
  lockSplinters: 22, lockSplintersBack: 6, lockScrews: 4,   // the wind lane's lock death (lockSplinterFx): long splinters in with the leaf, a few back past the boot, the strike's screws
  tubeShards: 34, bulbShards: 18, tubeSparks: 16, breakerSparks: 70,   // … a shot tube's glass + phosphor (a panel / a lamp), its ballast's sparks; the breaker's arc-over
  clackSparks: 5,
  casingLife: 45, tinkGain: 0.16,
  emberSize: 0.0025,
};

// ------------------------------------------------------------------ sites
/** A round stopped in something solid at `hitP` travelling `dir`: what it knocks out, by what it hit — a static / door leaf (`index` as StaticCollision.raycast
 *  reports it: ≥ 1e6 = a leaf), loose furniture (`prop`), or just a normal. Sparks off metal, pale chips + a puff off plaster, splinters off wood… */
export function impactFx(g: Game, hitP: Vec3, dir: Vec3, hit: { n: Vec3; index?: number; prop?: Prop }, def: WeaponDef) {
  const P = gpuFx(g); if (!P) return;
  let albedo: Vec3 = [0.5, 0.5, 0.5]; let surf: Surf;
  if (hit.prop) { surf = PROP_SURF[hit.prop.def.kind] ?? 'plastic'; albedo = hit.prop.boxes[0]?.albedo ?? albedo; }
  else if (hit.index !== undefined && hit.index >= 1e6) { surf = 'wood'; albedo = g.col.dynamicBoxes[hit.index - 1e6]?.albedo ?? [0.42, 0.3, 0.19]; }
  else if (hit.index !== undefined && g.col.boxes[hit.index]) { const b = g.col.boxes[hit.index]; albedo = b.albedo; surf = (b.flags & BoxFlag.Glass) ? 'glass' : surfOf(albedo); }   // (a pane / the solid-glass bottle: glass chips, no gypsum puff — review 08-12)
  else surf = 'concrete';
  const R = IMPACT[surf]; const k = def.cls === 'pistol' ? 1 : PFX.impactScaleRifle;
  const n = v3.normalize(hit.n); const dn = v3.dot(dir, n);
  const refl = v3.normalize(v3.sub(dir, v3.scale(n, 2 * dn)));               // the ricochet direction
  const at = v3.mad(hitP, n, 0.015);                                           // a hair proud of the surface (the trace grid would eat anything born inside it)
  if (R.sparks > 0) P.emit('spark', at, v3.normalize(v3.add(v3.scale(refl, 0.6), v3.scale(n, 0.4))), Math.round(R.sparks * k), { speed: R.sparkSpeed ?? 5, speedJit: 0.6, spread: PFX.sparkSpread, life: PFX.sparkLife, lifeJit: 0.4, size: PFX.sparkSize });
  if (R.chips > 0) {
    const tint: Vec3 = R.chipTint === 'albedo' ? albedo : R.chipTint === 'pale' ? v3.lerp(albedo, [0.86, 0.85, 0.82], 0.55) : R.chipTint;
    P.emit('debris', at, v3.normalize(v3.add(n, v3.scale(refl, 0.3))), Math.round(R.chips * k), { speed: PFX.chipSpeed, speedJit: 0.7, spread: PFX.chipSpread, life: PFX.chipLife, lifeJit: 0.3, size: R.chipSize ?? PFX.chipSize, sizeJit: 0.5, color: tint });
  }
  if (R.dust > 0) {
    const tint: Vec3 = R.dustTint === 'albedo' ? v3.lerp(albedo, [0.5, 0.5, 0.5], 0.5) : R.dustTint;
    emitDust(P, v3.mad(hitP, n, 0.07), n, Math.round(R.dust * k), { shape: 'puff', speed: PFX.dustSpeed, speedJit: 0.5, lift: 0.05, life: PFX.dustLife, lifeJit: 0.3, size: PFX.dustSize, sizeJit: 0.35, posJit: 0.04, vadd: v3.scale(n, 0.45), color: tint });
  }
}

/** The muzzle's unburnt powder (effects.ts shot.spark*: a narrow fast cone about the bore, gone before the gas is) — the GPU twin of spawnShot's emitCone. */
export function muzzleSparksFx(g: Game, muzzle: Vec3, dir: Vec3, shooter: Character) {
  const P = gpuFx(g); const S = fx.shot; if (!P || !fx.flags.shotSparks || S.sparkCount <= 0) return;
  const d = v3.normalize(dir);
  P.emit('spark', v3.mad(muzzle, d, 0.04), [d[0], d[1] + 0.08, d[2]], S.sparkCount, { speed: S.sparkSpeed, speedJit: 0.55, spread: S.sparkCone, life: S.sparkLife, lifeJit: 0.35, size: PFX.muzzleSparkSize, vadd: shooter.vel, owner: shooter.id });
}

/** The stun charge coming apart at `at`: the fragments (effects.ts sparks: speed / spread / lift / life — four hundred of them now, not a pool's worth of boxes)
 *  and what a charge going off on a floor raises — a ring of dust thrown out along it and a puff over the can. 160, not more: four hundred at these speeds
 *  read as a firework going off in the room (the first captures), and the flash + smoke are the event; the fragments are its first fifth of a second.
 *  (The smoke, the flash and the dozen fragments that carry smoke trails stay effects.ts spawnBurst's.) */
export function bangFx(g: Game, at: Vec3) {
  const P = gpuFx(g); if (!P) return;
  const S = fx.sparks;
  if (!blastSparks(g, P, at)) P.emit('spark', at, [0, 1, 0], PFX.bangSparks, { shape: 'burst', spread: S.spread, lift: S.lift, speed: S.speed, speedJit: 0.55, life: S.life, lifeJit: 0.35, size: PFX.bangSparkSize });   // (blastLook.ts, under the destruction switch: a wall charge's fragments go out of the wall's two faces, a stun charge's the way its can lies)
  emitDust(P, [at[0], 0.1, at[2]], [0, 1, 0], PFX.bangRing, { shape: 'ring', radius: PFX.bangRingRadius, speed: PFX.bangRingSpeed, speedJit: 0.4, lift: 0.12, spread: 0.3, life: PFX.bangRingLife, lifeJit: 0.3, size: PFX.bangRingSize, sizeJit: 0.3, color: [0.7, 0.68, 0.64] });
  emitDust(P, v3.add(at, [0, 0.15, 0]), [0, 1, 0], PFX.bangPuff, { shape: 'puff', speed: 1.2, speedJit: 0.5, lift: 0.4, life: 2.0, lifeJit: 0.3, size: 0.22, sizeJit: 0.3, posJit: 0.1, color: [0.62, 0.6, 0.57] });
}

/** A boot through the lock: plaster dust and splinters off the jamb by the keep, blown into the room (away from whoever kicked it, at `from`). */
export function kickDustFx(g: Game, d: Door, from: Vec3) {
  const P = gpuFx(g); if (!P) return;
  const cd = d.def.closedDir; const u: Vec3 = [Math.cos(cd), 0, Math.sin(cd)];
  const jamb: Vec3 = [d.def.hinge[0] + u[0] * (d.def.width - 0.06), 1.0, d.def.hinge[1] + u[2] * (d.def.width - 0.06)];
  let m: Vec3 = [-u[2], 0, u[0]]; if (v3.dot(m, v3.sub(from, jamb)) > 0) m = v3.scale(m, -1);   // the leaf's normal pointing away from the kicker
  emitDust(P, v3.mad(jamb, m, 0.1), m, PFX.kickDust, { shape: 'puff', speed: 1.1, speedJit: 0.5, lift: 0.1, life: 1.6, lifeJit: 0.3, size: 0.14, sizeJit: 0.35, posJit: 0.18, vadd: v3.scale(m, 1.3), color: [0.78, 0.75, 0.7] });
  P.emit('debris', v3.mad(jamb, m, 0.05), m, PFX.kickSplinters, { speed: 3.2, speedJit: 0.7, spread: 0.7, life: 16, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, color: [0.62, 0.48, 0.3] });
  emitDust(P, [jamb[0] + m[0] * 0.3, 0.08, jamb[2] + m[2] * 0.3], [0, 1, 0], 5, { shape: 'puff', speed: 0.8, speedJit: 0.5, lift: 0.3, life: 1.4, lifeJit: 0.3, size: 0.18, sizeJit: 0.3, posJit: 0.25, vadd: v3.scale(m, 0.8), color: [0.6, 0.58, 0.55] });   // what the leaf's slam lifts off the threshold
}

// ------------------------------------------------------------------ fixture deaths (the wind lane's approved extras — combat.ts fireWeapon's fixture rule / breaker rule, game.ts onDoorEvent 'kick')
/** A fluorescent tube / panel / lamp SHOT OUT (`t` = the target that just broke; `from` = the muzzle, so the shower is thrown away from the round): a shower of pale glass and
 *  phosphor crumbs raining off the fixture with a puff of the tube's powder, a fizz of sparks off the ballast — under the flash and the flicker-out the site already had.
 *  A ceiling panel showers from just under the slab across its whole face; a lamp head from its lens. */
export function fixtureShatterFx(g: Game, t: { pos: Vec3; kind: string; boxes: number[] }, from: Vec3) {
  const P = gpuFx(g); if (!P) return;
  const b = t.boxes.length ? g.engine.world.statics[t.boxes[0]] : null;
  const at: Vec3 = b ? [b.c[0], Math.min(b.c[1] - b.h[1] - 0.03, 2.9), b.c[2]] : [t.pos[0], Math.min(t.pos[1], 2.9), t.pos[2]];
  const spread = b ? Math.min(0.6, Math.max(b.h[0], b.h[2])) : 0.15;   // over the fixture's face (a 1.2 m panel showers along its length)
  const away = v3.normalize([at[0] - from[0], 0, at[2] - from[2]]);
  P.emit('debris', at, [away[0] * 0.25, -1, away[2] * 0.25], t.kind === 'emissive' ? PFX.tubeShards : PFX.bulbShards, { speed: 1.6, speedJit: 0.8, spread: 1.2, life: 25, lifeJit: 0.3, size: 0.006, sizeJit: 0.7, aspect: 1.8, posJit: spread, color: [0.9, 0.92, 0.88] });   // glass + phosphor: pale slivers
  emitDust(P, v3.add(at, [0, -0.05, 0]), [0, -1, 0], 6, { shape: 'puff', speed: 0.5, speedJit: 0.5, lift: -0.4, life: 2.4, lifeJit: 0.3, size: 0.16, sizeJit: 0.35, posJit: spread * 0.7, color: [0.92, 0.92, 0.9] });   // the tube's powder, sinking
  P.emit('spark', v3.add(at, [0, 0.02, 0]), v3.normalize([away[0] * 0.8, -0.55, away[2] * 0.8]), PFX.tubeSparks, { speed: 5.5, speedJit: 0.65, spread: 1.15, life: 0.4, lifeJit: 0.5, size: 0.002 });   // the ballast arcing over — fast, thin and thrown out past the fixture (fixtureBreak.ts FIXLOOK.spark has why: at 3.2 m/s straight down they were fat dots from the play camera)
}
/** The BREAKER shot (a permanent blackout): a hard burst of sparks out of the panel's face and a cough of black smoke-dust — the box arcs as it dies. */
export function breakerSparkFx(g: Game, at: Vec3, from: Vec3) {
  const P = gpuFx(g); if (!P) return;
  const out = v3.normalize([from[0] - at[0], 0.15, from[2] - at[2]]);   // out of the wall, back toward the shooter's side
  P.emit('spark', v3.mad(at, out, 0.06), out, PFX.breakerSparks, { speed: 5.5, speedJit: 0.65, spread: 0.9, life: 0.7, lifeJit: 0.5, size: 0.003 });
  P.emit('spark', v3.mad(at, out, 0.06), [out[0], -0.4, out[2]], 25, { speed: 2.0, speedJit: 0.7, spread: 1.3, life: 1.1, lifeJit: 0.4, size: 0.0034 });   // the slow heavy blobs of molten copper dripping off it
  emitDust(P, v3.mad(at, out, 0.12), out, 7, { shape: 'puff', speed: 0.9, speedJit: 0.5, lift: 0.5, life: 2.2, lifeJit: 0.3, size: 0.14, sizeJit: 0.35, posJit: 0.08, vadd: v3.scale(out, 0.4), color: [0.12, 0.11, 0.1] });   // soot
}
/** A LOCK KICKED THROUGH (doors.ts kickIn → the 'kick' door event; `d.lockBroken` just went true): the keep tears out of the latch jamb — long splinters of the jamb's wood
 *  and the strike plate's screws thrown into the room with the leaf, a few landing at the kicker's feet. (kickDustFx is the plaster and the threshold's dust; this is the wood.) */
export function lockSplinterFx(g: Game, d: Door, from: Vec3) {
  const P = gpuFx(g); if (!P) return;
  const cd = d.def.closedDir; const u: Vec3 = [Math.cos(cd), 0, Math.sin(cd)];
  const keep: Vec3 = [d.def.hinge[0] + u[0] * (d.def.width + 0.02), 1.0, d.def.hinge[1] + u[2] * (d.def.width + 0.02)];   // the strike in the latch jamb, handle height
  let m: Vec3 = [-u[2], 0, u[0]]; if (v3.dot(m, v3.sub(from, keep)) > 0) m = v3.scale(m, -1);                             // into the room, away from the boot
  P.emit('debris', v3.mad(keep, m, 0.05), v3.normalize(v3.add(m, [0, 0.15, 0])), PFX.lockSplinters, { speed: 4.0, speedJit: 0.6, spread: 0.55, life: 30, lifeJit: 0.3, size: 0.009, sizeJit: 0.6, aspect: 3.5, color: [0.7, 0.56, 0.36] });   // long pale splinters off the torn jamb, fast with the leaf
  P.emit('debris', v3.mad(keep, m, -0.04), v3.normalize(v3.add(v3.scale(m, -1), [0, 0.4, 0])), PFX.lockSplintersBack, { speed: 1.4, speedJit: 0.7, spread: 1.0, life: 30, lifeJit: 0.3, size: 0.007, sizeJit: 0.5, aspect: 2.5, color: [0.62, 0.48, 0.3] });   // a few back out past the boot
  P.emit('debris', v3.mad(keep, m, 0.04), m, PFX.lockScrews, { speed: 2.6, speedJit: 0.5, spread: 0.5, life: 40, lifeJit: 0.2, size: 0.005, sizeJit: 0.3, color: [0.5, 0.5, 0.47] });   // the strike plate's screws / the keep's bits (metal-grey crumbs)
}

/** The ring airfoil meeting a wall / a desk: a few sparks off the clack. */
export function clackFx(g: Game, at: Vec3) {
  const P = gpuFx(g); if (!P) return;
  P.emit('spark', v3.add(at, [0, 0.02, 0]), [0, 1, 0], PFX.clackSparks, { speed: 2.5, speedJit: 0.6, spread: 1.3, life: 0.3, lifeJit: 0.4, size: PFX.sparkSize });
}

/** The tracer's ember where it stops in geometry (tracers.ts ember → its spark sink): the same few sparks back off the surface, on the GPU. */
export function emberFx(P: Particles, at: Vec3, dir: Vec3, o: { count: number; speed: number; cone: number; life: number }) {
  P.emit('spark', at, dir, o.count, { speed: o.speed, speedJit: 0.55, spread: o.cone, life: o.life, lifeJit: 0.35, size: PFX.emberSize });
}

// ------------------------------------------------------------------ spent cases
/** How a row ejects: from the port by the hand (`ahead` m down the bore from the wrist, `up`, `right`) or — the FN2000 — out of the tube at the front, right of the
 *  muzzle; thrown along `dir` in the gun's frame [right, up, forward] at `speed`; the case's colour and diameter; when it is heard landing. */
interface CasingSpec { color: Vec3; diameter: number; from: 'hand' | 'muzzle'; ahead: number; up: number; right: number; dir: Vec3; speed: number; tink: number; }
const BRASS: Vec3 = [0.72, 0.5, 0.16], LACQUERED_STEEL: Vec3 = [0.2, 0.19, 0.12];   // 5.7 / 9 mm / 5.56: brass; the AKs' 5.45 and 7.62 as issued: lacquered steel, dull olive
const CASINGS: Partial<Record<WeaponId, CasingSpec>> = {
  fiveseven: { color: BRASS, diameter: 0.008,  from: 'hand', ahead: 0.07, up: 0.055, right: 0.02, dir: [1, 0.9, -0.25], speed: 2.6, tink: 0.5 },
  guard9mm:  { color: BRASS, diameter: 0.0095, from: 'hand', ahead: 0.07, up: 0.055, right: 0.02, dir: [1, 0.8, -0.2], speed: 3.0, tink: 0.5 },
  aks74u:    { color: LACQUERED_STEEL, diameter: 0.010, from: 'hand', ahead: 0.16, up: 0.07, right: 0.03, dir: [1, 0.45, 0.5], speed: 4.8, tink: 0.55 },   // AKs fling their empties hard, forward and right
  ak74m:     { color: LACQUERED_STEEL, diameter: 0.010, from: 'hand', ahead: 0.16, up: 0.07, right: 0.03, dir: [1, 0.45, 0.5], speed: 4.8, tink: 0.55 },
  akms:      { color: LACQUERED_STEEL, diameter: 0.0113, from: 'hand', ahead: 0.16, up: 0.07, right: 0.03, dir: [1, 0.45, 0.5], speed: 4.5, tink: 0.55 },
  pkm:       { color: LACQUERED_STEEL, diameter: 0.0124, from: 'hand', ahead: 0.16, up: 0.05, right: -0.03, dir: [-1, 0.2, 0.1], speed: 3.6, tink: 0.5 },   // (a long rimmed case, out of the left of the feed cover)
  // (the guns a card's two slots offer — gunslots.ts: each ejects as the gun it is drawn as until it has a model of its own; the gas shotgun's hulls are owed with it)
  mk12:      { color: BRASS, diameter: 0.0095, from: 'hand', ahead: 0.16, up: 0.07, right: 0.03, dir: [1, 0.5, 0.15], speed: 3.4, tink: 0.5 },
  mk46:      { color: BRASS, diameter: 0.0095, from: 'hand', ahead: 0.16, up: 0.02, right: 0.03, dir: [1, -0.1, 0.1], speed: 3.0, tink: 0.45 },   // (down and right, out of the bottom of the feed tray)
  mp7:       { color: BRASS, diameter: 0.0075, from: 'hand', ahead: 0.10, up: 0.06, right: 0.02, dir: [1, 0.7, -0.1], speed: 3.0, tink: 0.5 },
  hk45:      { color: BRASS, diameter: 0.012,  from: 'hand', ahead: 0.07, up: 0.055, right: 0.02, dir: [1, 0.8, -0.2], speed: 2.6, tink: 0.5 },
  g18:       { color: BRASS, diameter: 0.0095, from: 'hand', ahead: 0.07, up: 0.055, right: 0.02, dir: [1, 0.8, -0.2], speed: 3.0, tink: 0.5 },
  fn2000:    { color: BRASS, diameter: 0.0095, from: 'muzzle', ahead: -0.16, up: -0.01, right: 0.045, dir: [0.35, -0.15, 1], speed: 1.1, tink: 0.4 },  // forward ejection: the cases trundle out of the tube by the muzzle and drop
};
interface FxState { tinks: { t: number; pos: Vec3; rate: number }[]; n: number }
const STATE = new SideMap<Game, FxState>('particleFx.STATE');
const stateOf = (g: Game): FxState => { let s = STATE.get(g); if (!s) { s = { tinks: [], n: 0 }; STATE.set(g, s); } return s; };
/** One spent case out of `shooter`'s gun of row `def`: ejected where and how the row says, carrying his stride, its rays blind to his own arm; and the sound of it
 *  landing, `tink` s later where it will roughly come down. */
export function casingFx(g: Game, shooter: Character, def: WeaponDef) {
  const P = gpuFx(g); if (!P) return;
  const C = CASINGS[def.id]; if (!C) return;
  const F = fx.muzzleFrame(shooter.muzzle, shooter.gunDir);   // z = bore, y = up out of the receiver, x = the shooter's LEFT (right-handed, +Z south)
  const right = v3.scale(F.x, -1);
  const base = C.from === 'hand' ? (shooter.bones.handR ?? shooter.muzzle) : shooter.muzzle;
  const port = v3.mad(v3.mad(v3.mad(base, F.z, C.ahead), F.y, C.up), right, C.right);
  const dir = v3.normalize(v3.add(v3.add(v3.scale(right, C.dir[0]), v3.scale(F.y, C.dir[1])), v3.scale(F.z, C.dir[2])));
  P.emit('casing', port, dir, 1, { speed: C.speed, speedJit: 0.3, spread: 0.25, life: PFX.casingLife, lifeJit: 0.1, size: C.diameter, sizeJit: 0, vadd: shooter.vel, owner: shooter.id, color: C.color });
  const st = stateOf(g);
  const land: Vec3 = [port[0] + dir[0] * C.speed * C.tink, 0.02, port[2] + dir[2] * C.speed * C.tink];
  st.tinks.push({ t: g.time + C.tink, pos: land, rate: 0.9 + ((st.n++ * 7) % 11) * 0.03 });   // (a little spread in pitch, dealt not drawn)
}
/** Once a frame (game.ts update): the cases due to land are heard landing. Nothing else of the particles lives on the CPU. */
export function updateParticleFx(g: Game) {
  const st = STATE.get(g); if (!st || st.tinks.length === 0) return;
  const P = gpuFx(g);
  for (let i = st.tinks.length - 1; i >= 0; i--) { const k = st.tinks[i]; if (k.t > g.time) continue; st.tinks.splice(i, 1); if (P) g.audio.play('casingTink', k.pos, PFX.tinkGain, { rate: k.rate }); }
}
/** encounter restart / the tour's cuts: nothing in the air, nothing on the floor, nothing waiting to be heard */
export function clearParticleFx(g: Game) {
  const st = STATE.get(g); if (st) st.tinks.length = 0;
  (g.engine as { particles?: Particles | null }).particles?.clear();
}
/** QA: the cases waiting to be heard (particles-probes.ts) */
export function pendingTinks(g: Game): readonly { t: number; pos: Vec3 }[] { return stateOf(g).tinks; }

/** The spark sink handed to the tracers (tracers.ts SparkSink): embers to the GPU while it is on, into the CPU pool otherwise — decided per ember, so the panel
 *  switch takes the very next one. */
export function sparkSink(g: Game): { emitCone(at: Vec3, dir: Vec3, o: { count: number; speed: number; cone: number; life: number }, seed: number): number[] } {
  return { emitCone: (at, dir, o, seed) => { const P = gpuFx(g); if (P) { emberFx(P, at, dir, o); return []; } return g.sparks.emitCone(at, dir, o, seed); } };
}

/** Panel / hook: a test burst of `kind` at `at` (the cursor's point): what the sites above throw, without firing anything. */
export function testBurst(g: Game, kind: 'sparks' | 'debris' | 'dust' | 'casings' | 'bang' | 'sheets', at: Vec3): number {
  const P = gpuFx(g); if (!P) return 0;
  const up: Vec3 = [0, 1, 0]; const p = v3.add(at, [0, 0.05, 0]);
  switch (kind) {
    case 'sheets': return P.emit('sheet', v3.add(at, [0, 0.35, 0]), up, 40, { shape: 'burst', spread: 0.2, lift: 0.35, speed: 3.2, speedJit: 0.7, life: 60, lifeJit: 0.2, size: 0.21, sizeJit: 0.15, aspect: 1.41, tumble: 7, nrmJit: 0.5, posJit: 0.25, color: [0.86, 0.86, 0.82] });   // two reams' worth of A4 thrown up off the point: the destruction lane's paper (game/sheetModel.ts)
    case 'sparks': return P.emit('spark', p, up, 60, { speed: 5, speedJit: 0.6, spread: 1.1, life: 0.5, lifeJit: 0.4, size: PFX.sparkSize });
    case 'debris': return P.emit('debris', p, up, 40, { speed: 3, speedJit: 0.7, spread: 1.2, life: PFX.chipLife, lifeJit: 0.3, size: PFX.chipSize, sizeJit: 0.5, color: [0.8, 0.78, 0.74] });
    case 'dust': return emitDust(P, v3.add(at, [0, 0.12, 0]), up, 12, { shape: 'puff', speed: 0.9, speedJit: 0.5, lift: 0.2, life: 1.6, lifeJit: 0.3, size: 0.15, sizeJit: 0.35, posJit: 0.1, color: [0.75, 0.73, 0.7] });
    case 'casings': { let n = 0; for (let i = 0; i < 15; i++) n += P.emit('casing', v3.add(at, [0, 0.25, 0]), [Math.cos(i * 0.9), 1.6, Math.sin(i * 0.9)], 1, { speed: 2.5, speedJit: 0.4, spread: 0.4, life: PFX.casingLife, lifeJit: 0.1, size: 0.0095, sizeJit: 0, color: i % 3 === 0 ? LACQUERED_STEEL : BRASS }); return n; }   // (all from just over the point clicked: a burst born inside the desk above it would be culled as born-in-geometry)
    case 'bang': bangFx(g, v3.add(at, [0, fx.bang.height, 0])); return PFX.bangSparks + PFX.bangRing + PFX.bangPuff;
  }
}
export type { EmitOpts };
