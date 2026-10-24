// Tracer rounds (rifles, docs/internal/sc20k-design.md §3.3 / §11.5 — lane R6). A round is hitscan and has landed by the time anyone sees anything; the tracer is
// the PICTURE of it: a streak that travels muzzle → impact over a few frames (effects.ts tracerFx.speed), drawn the way a spark is drawn (sparks.ts) — one thin
// emissive box from where the head was a shutter-time ago to where it is now, raster + bloom only, flagged NoShadow so no ray of any kind (light, sight, bullet,
// cursor, cascade) ever meets a centimetre-wide box hanging in a doorway — plus what a spark does not have: a small warm TRANSIENT light riding the head, so the
// wall it passes, the floor under it and the haze it crosses light up for the frames it is there and keep nothing of it afterwards (LightSet's ttl lights carry
// the transient bit: out of every accumulated signal, exactly like a muzzle flash). Where the round stopped in something solid the head ends in an ember (a few
// sparks back off the surface and a 60 ms glow); in a man, or out into the night past 60 m, it just ends. No ricochet (later, maybe: reflect off `col.raycast`'s
// normal for shallow hits). Which rounds trace is the row's TracerSpec read off the gun's own counters (isTracerRound below); pistols and the FN2000 carry none.
// Everything is pooled (tracerFx.maxLive streaks, each owning its box and its light object; the oldest is evicted), nothing is allocated per frame, and with no
// streak alive update() is a compare and a return. Game.tune.tracers off = fireWeapon never calls in here at all.
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { thinNote } from './thinline';
import type { LightSet, RtLight } from '../render/lights';
import type { Sparks } from './sparks';
import type { Firearm, WeaponDef } from './weapons';
import { tracerFx } from './effects';

/** where an ember's sparks go: the CPU pool (game/sparks.ts Sparks satisfies this) or the game's router onto the GPU particles (particleFx.ts sparkSink) */
export type SparkSink = Pick<Sparks, 'emitCone'>;

/** what the round stopped in, as fireWeapon knows it: geometry / a leaf / loose furniture ('solid' → the ember), a man ('flesh' → nothing: no ember in him), or
 *  nothing inside the 60 m the scan looks ('none' → the streak flies out and is gone) */
export type TracerImpact = 'solid' | 'flesh' | 'none';

/** THE RULE. Asked of the gun right AFTER Firearm.fire() has cycled the round out (every fire site calls fire() before fireWeapon): the round that just left is
 *  a tracer iff its row declares one (WeaponDef.tracer) and EITHER it is every `every`-th round out of the box — k % every === 0, k = Firearm.spent = this
 *  round's ordinal since the gun was last full (1 = the first out of a fresh box, magCapacity the one that empties it; a bottomless sandbox magazine never empties,
 *  so k counts off the gun's life instead) — OR fewer than `lastN` rounds are left in the gun after it (Firearm.roundsReady < lastN: the shooter's cue that he is
 *  about to go dry — and Sam's, watching from cover). The guards' AKS-74U, thirty to a box, { every 3, lastN 3 }: rounds 3 6 9 12 15 18 21 24 27 light, and 28 29 30
 *  — twelve a box, never two in a row until the last three. A pistol row (tracer null): never. */
export function isTracerRound(w: Firearm): boolean {
  const T = w.def.tracer; if (!T) return false;
  const k = w.infinite ? w.shotsFired : w.spent;
  return (T.every > 0 && k > 0 && k % T.every === 0) || w.roundsReady < T.lastN;
}

/** One streak in flight (pooled: the object, its box and its light are made once and reused). */
export interface Tracer {
  alive: boolean;
  from: Vec3; dir: Vec3;          // muzzle and unit direction of the segment the round flew
  L: number;                      // its length: where the round stopped (or 60 m of nothing)
  s: number;                      // how far along it the head is now (0‥L)
  v: number;                      // m/s the head travels (tracerFx.speed, or slower so a short shot still lasts minLife)
  age: number;                    // s alive (the oldest goes first when the pool is full)
  frames: number;                 // update() calls it has been drawn in (QA reads it)
  color: Vec3; owner: number; impact: TracerImpact;
  arrived: boolean;               // the head reached L this frame: drawn there once more, ember spawned, gone next update
  light: RtLight | null;          // the head light while it carries one (≤ tracerFx.maxLights of them do)
  readonly box: Box;              // the streak, rewritten in place every frame it is drawn
  readonly lamp: RtLight;         // this slot's light object (in the LightSet only while `light` points at it)
}

/** ttl given to a head light so LightSet flags it transient (bit 256) and shapes it with its flash envelope — evaluated over [0, dt] every frame because update()
 *  zeroes its age while the streak lives (≈ ×0.9997 of peak); a light this module somehow never released would still retire itself after this long */
const LAMP_TTL = 30;

export class Tracers {
  private pool: Tracer[] = [];
  /** streaks alive after the last update() / round() */
  live = 0;
  /** of those, how many carry a head light right now */
  lit = 0;
  /** tracers spawned since construction (QA / the panel line) */
  spawned = 0;
  private seed = 1;
  /** WHOSE DOING AN EMBER IS (the Game hands its fog of war; null — the viewer — = nobody's, as it was): fogofwar.ts FOG.ours */
  fog: { begin(who: number): number; done(was: number): void; lightBy(l: RtLight, who: number): RtLight } | null = null;
  constructor(private lights: LightSet | null, private sparks: SparkSink | null, public params = tracerFx) {
    for (let i = 0; i < Math.max(1, params.maxLive | 0); i++) this.pool.push({
      alive: false, from: [0, 0, 0], dir: [0, 0, 1], L: 0, s: 0, v: 0, age: 0, frames: 0, color: [1, 0.5, 0.2], owner: 0, impact: 'none', arrived: false, light: null,
      box: makeBox({ c: [0, -10, 0], h: [0.006, 0.006, 0.05], albedo: [0.04, 0.03, 0.02], emissive: [0, 0, 0], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }),
      lamp: { name: 'tracer', group: 'tracer', kind: 0, pos: [0, -10, 0], dir: [0, -1, 0], color: [1, 0.5, 0.2], intensity: 0, range: params.lightRange, innerDeg: 0, outerDeg: 180, radius: params.lightRadius, volumetric: 1.0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: LAMP_TTL, age: 0, peakIntensity: 0 },
    });
  }

  /** every live streak (QA and the panel read them; do not hold on to the objects — they are pool slots) */
  *each(): IterableIterator<Tracer> { for (const t of this.pool) if (t.alive) yield t; }

  /** fireWeapon's one call, after the round has been traced: `w` is the gun it came out of (its counters decide, isTracerRound) — or null with `force` for a
   *  streak regardless (the viewer's 'tracer every round'); `def` the row (its colour); muzzle, unit dir and the distance it flew; what it stopped in; whose round
   *  (the owner byte on the box and the light: his own capsules never shadow it). Returns whether a streak went. */
  round(w: Firearm | null, def: WeaponDef, muzzle: Vec3, dir: Vec3, tHit: number, impact: TracerImpact, owner: number, force = false): boolean {
    const T = def.tracer; if (!T && !force) return false;
    if (!force && !(w && w.def === def && isTracerRound(w))) return false;   // (a round fired off a row the shooter does not carry — a harness poking fireWeapon — has no counters to be the third of anything)
    if (!(tHit >= this.params.minPath) || !Number.isFinite(tHit)) return false;   // the muzzle in the jamb, a contact shot: nothing to see
    this.spawn(muzzle, dir, tHit, impact, T ? T.color : [1, 0.42, 0.12], owner);
    return true;
  }

  /** a free slot, else the oldest streak's (its light handed back first) */
  private slot(): Tracer {
    let oldest = this.pool[0], oa = -1;
    for (const t of this.pool) { if (!t.alive) return t; if (t.age > oa) { oa = t.age; oldest = t; } }
    this.release(oldest); oldest.alive = false; this.live = Math.max(0, this.live - 1);
    return oldest;
  }
  private spawn(from: Vec3, dir: Vec3, L: number, impact: TracerImpact, color: Vec3, owner: number) {
    const P = this.params; const t = this.slot();
    t.alive = true; t.arrived = false; t.age = 0; t.frames = 0; t.s = 0; t.L = L; t.impact = impact; t.owner = owner & 0xff;
    t.from[0] = from[0]; t.from[1] = from[1]; t.from[2] = from[2];
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1; t.dir[0] = dir[0] / dl; t.dir[1] = dir[1] / dl; t.dir[2] = dir[2] / dl;
    t.color[0] = color[0]; t.color[1] = color[1]; t.color[2] = color[2];
    t.v = Math.min(P.speed, L / Math.max(1e-3, P.minLife));   // a short shot is slowed so it still reads as something moving for a couple of frames
    t.box.owner = t.owner; t.box.rot = quat.fromTo([0, 0, 1], t.dir); t.box.yaw = v3.yawOf(t.dir);
    // the head light: this slot's lamp into the set, if the tracer budget of lights has one to spare (the streak shows either way)
    t.light = null;
    if (this.lights && this.lit < P.maxLights) {
      const l = t.lamp; l.color[0] = color[0]; l.color[1] = color[1]; l.color[2] = color[2];
      l.peakIntensity = l.intensity = P.lightIntensity; l.range = P.lightRange; l.radius = P.lightRadius; l.owner = t.owner; l.age = 0; l.ttl = LAMP_TTL; l.enabled = true;
      l.pos[0] = from[0]; l.pos[1] = from[1]; l.pos[2] = from[2];
      if (this.lights.lights.indexOf(l) < 0) this.lights.add(l);
      t.light = l; this.lit++;
    }
    this.spawned++; this.live++;
  }
  /** hand a streak's light back to the set (idempotent) */
  private release(t: Tracer) {
    if (!t.light) return;
    this.lights?.remove(t.light); t.light = null; this.lit = Math.max(0, this.lit - 1);
  }

  /** One frame: every live head advances v·dt along its segment (never past the end), the streak box is rewritten from tail to head and pushed to `out`, the light
   *  moved onto the head; a head that reached the end last frame is retired first (it was drawn AT the wall once), one that reaches it now spawns its ember.
   *  `mPerPx` = world size of an internal pixel at the look-at depth (Game.mPerPx; 0 = never widen): a streak thinner than ~a pixel is widened and dimmed by the same
   *  factor so it carries the same light instead of crawling. dt 0 (a frozen still) redraws everything where it is. */
  update(dt: number, out: Box[], mPerPx = 0) {
    if (this.live === 0) return;
    const P = this.params; let live = 0, lit = 0;
    const hw = Math.max(P.thickness * 0.5, 0.6 * mPerPx); const gain = (P.thickness * 0.5) / hw * P.emissive;
    for (const t of this.pool) {
      if (!t.alive) continue;
      if (t.arrived && dt > 0) { this.release(t); t.alive = false; continue; }   // shown at the wall last frame: gone
      t.age += dt; t.s = Math.min(t.L, t.s + t.v * dt);
      if (t.s >= t.L - 1e-6 && !t.arrived) { t.arrived = true; this.ember(t); }
      if (t.light) { const l = t.light; l.age = 0; l.enabled = true; l.pos[0] = t.from[0] + t.dir[0] * (t.s - 0.05); l.pos[1] = t.from[1] + t.dir[1] * (t.s - 0.05); l.pos[2] = t.from[2] + t.dir[2] * (t.s - 0.05); lit++; }   // (5 cm short of the head: never inside the surface it stops at)
      live++;
      if (t.s <= 1e-4) continue;   // nothing has left the muzzle yet (a zero-length step on the frame it was fired)
      const tail = Math.max(0, t.s - t.v * P.shutter); const len = Math.max(0.05, t.s - tail); const mid = t.s - len * 0.5;
      const b = t.box;
      b.c[0] = t.from[0] + t.dir[0] * mid; b.c[1] = t.from[1] + t.dir[1] * mid; b.c[2] = t.from[2] + t.dir[2] * mid;
      b.h[0] = hw; b.h[1] = hw; b.h[2] = len * 0.5;
      b.emissive[0] = t.color[0] * gain; b.emissive[1] = t.color[1] * gain; b.emissive[2] = t.color[2] * gain;
      thinNote(b, P.thickness * 0.5, 0.6, t.color[0] * P.emissive, t.color[1] * P.emissive, t.color[2] * P.emissive);   // (thinline.ts: re-sized by a picture drawn from another view)
      t.frames++;
      out.push(b);
    }
    this.live = live; this.lit = lit;
  }
  /** the splash where a tracer stops in geometry: a few sparks back off the surface (sparks.ts's own white → orange → red ramp is the tracer's colour family) and a
   *  brief glow in its colour just off it. Nothing in a man; nothing for a round that met nothing. Seeded off a private counter (never the game's fxSeed or dice). */
  private ember(t: Tracer) {
    if (t.impact !== 'solid') return;
    const P = this.params; const at: Vec3 = [t.from[0] + t.dir[0] * (t.L - 0.03), t.from[1] + t.dir[1] * (t.L - 0.03), t.from[2] + t.dir[2] * (t.L - 0.03)];
    const was = this.fog ? this.fog.begin(t.owner) : -1;   // (the ember is its shooter's doing: fogofwar.ts FOG.ours)
    try { if (this.sparks && P.emberSparks > 0) this.sparks.emitCone(at, [-t.dir[0], -t.dir[1] + 0.3, -t.dir[2]], { count: P.emberSparks, speed: P.emberSpeed, cone: P.emberCone, life: P.emberLife }, this.seed++);
    if (this.lights && P.emberIntensity > 0) { const l = this.lights.flash(at, v3.copy(t.color), P.emberIntensity, P.emberRange, P.emberTtl, 0); this.fog?.lightBy(l, t.owner); }   // (fogofwar.ts FOG.ours: the glow where a teammate's round stops is the team's own)
    } finally { this.fog?.done(was); }
  }

  /** everything gone at once (encounter restart / clearAftermath, the viewer's respawn): lights handed back, slots freed */
  clear() {
    for (const t of this.pool) { if (!t.alive) continue; this.release(t); t.alive = false; }
    this.live = 0; this.lit = 0;
  }
}
