// Ballistic incandescent sparks (unburnt powder out of a muzzle, a stun canister's burning fragments): CPU particles with gravity, drag and a
// floor / geometry bounce, drawn as tiny emissive raster-only boxes — one thin streak per spark from where it was a shutter-time ago to where
// it is, so a streak's length IS its speed and no history is kept. NoShadow: rays ignore them (no light injected into any cache, nothing to
// linger); the HDR bloom is what makes them glow. Ported from twopointfive's SparkField (game/effects.ts); the numbers live in ./effects.ts.
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { StaticCollision } from '../scene/collision';

/** Motion + colour ramp shared by every spark (the `sparks` block in effects.ts satisfies this). */
export interface SparkParams {
  gravity: number;      // m/s²
  drag: number;         // 1/s velocity decay
  hold: number;         // fraction of life at full brightness before the fade
  brightness: number;   // multiplier on the emitted colour — sparks are meant to clip
  maxLive: number;      // pool size (≤ 96: they are boxes in the per-frame dynamic list)
  emissive: number;     // HDR radiance of a spark at f = 1 before `brightness` (the muzzle flash card is ~40)
  thickness: number;    // streak box thickness (m): ~1 px at the default framing, or the raster drops / shimmers it
  shutter: number;      // seconds of motion a streak shows (frame-rate independent stand-in for "since last frame")
  minStreak: number;    // m: a spark at rest still shows as a dot this long
  collide: boolean;     // ray cast fast sparks against the static boxes + door leaves (else only the y = 0 floor)
}

interface Spark { pos: Vec3; vel: Vec3; age: number; life: number; alive: boolean; gen: number; }

export class Sparks {
  private pool: Spark[] = [];
  live = 0;
  constructor(public params: SparkParams) {
    for (let i = 0; i < 96; i++) this.pool.push({ pos: [0, -10, 0], vel: [0, 0, 0], age: 0, life: 0, alive: false, gen: 0 });
  }

  /** a free slot, else the spark nearest its end (a fresh burst may evict the tail of the previous one) */
  private slot(): number {
    const n = Math.min(this.params.maxLive | 0, this.pool.length);
    let worst = 0, wf = -1;
    for (let i = 0; i < n; i++) { const s = this.pool[i]; if (!s.alive) return i; const fr = s.age / Math.max(s.life, 1e-3); if (fr > wf) { wf = fr; worst = i; } }
    return worst;
  }
  private spawn(at: Vec3, vel: Vec3, life: number): number {
    const i = this.slot(); const s = this.pool[i];
    s.pos = v3.copy(at); s.vel = vel; s.age = 0; s.life = life; s.alive = true; s.gen++;
    return i;
  }
  /** deterministic per-spark hash in [0,1): a seeded event is the same event again (varied per throw by the caller's seed counter) */
  private static h(i: number, k: number, seed: number): number { const t = Math.sin((i + 1) * 12.9898 + k * 78.233 + seed * 53.17) * 43758.5453; return t - Math.floor(t); }

  /** `count` sparks in a cone of half-angle `cone` about `dir` — uniform over the spherical cap, not in angle (that piles them on the axis). Returns pool indices. */
  emitCone(at: Vec3, dir: Vec3, o: { count: number; speed: number; cone: number; life: number }, seed: number): number[] {
    const dn = v3.normalize(dir); const up: Vec3 = Math.abs(dn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const U = v3.normalize(v3.cross(up, dn)); const W = v3.cross(dn, U); const cosMax = Math.cos(o.cone);
    const out: number[] = [];
    for (let i = 0; i < o.count; i++) {
      const cy = 1 - Sparks.h(i, 1, seed) * (1 - cosMax); const r = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = Sparks.h(i, 2, seed) * Math.PI * 2;
      const sp = o.speed * (0.45 + 0.55 * Sparks.h(i, 3, seed)); const ct = Math.cos(th) * r, st = Math.sin(th) * r;
      const vel: Vec3 = [(dn[0] * cy + U[0] * ct + W[0] * st) * sp, (dn[1] * cy + U[1] * ct + W[1] * st) * sp, (dn[2] * cy + U[2] * ct + W[2] * st) * sp];
      out.push(this.spawn(at, vel, o.life * (0.5 + 0.7 * Sparks.h(i, 4, seed))));
    }
    return out;
  }
  /** A ground burst: upward hemisphere narrowed by `spread` and rotated toward vertical by `lift` (a can venting against the floor throws out AND up; nothing goes down). */
  emitBurst(at: Vec3, o: { count: number; speed: number; spread: number; lift: number; life: number }, seed: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < o.count; i++) {
      const theta = Sparks.h(i, 1, seed) * Math.PI * 2;
      let cy = Math.pow(Sparks.h(i, 2, seed), 1 + o.spread * 3) * 0.9 + 0.05;
      cy = cy + (1 - cy) * o.lift; const r = Math.sqrt(Math.max(0, 1 - cy * cy));
      const sp = o.speed * (0.45 + 0.55 * Sparks.h(i, 3, seed));
      out.push(this.spawn(at, [Math.cos(theta) * r * sp, cy * sp, Math.sin(theta) * r * sp], o.life * (0.5 + 0.7 * Sparks.h(i, 4, seed))));
    }
    return out;
  }
  /** Live position of pool spark `i` for a smoke emitter to ride; null once it dies or its slot is reused (the emitter then goes with it). */
  tracker(i: number): () => { pos: Vec3; dir: Vec3 } | null {
    const s = this.pool[i]; const gen = s.gen;
    return () => (s.alive && s.gen === gen ? { pos: s.pos, dir: [0, 1, 0] } : null);
  }
  clear() { for (const s of this.pool) s.alive = false; this.live = 0; }

  update(dt: number, col: StaticCollision | null) {
    const P = this.params; const decay = Math.exp(-P.drag * dt); let live = 0;
    for (const s of this.pool) {
      if (!s.alive) continue;
      s.age += dt; if (s.age >= s.life) { s.alive = false; continue; }
      s.vel[1] -= P.gravity * dt; s.vel[0] *= decay; s.vel[1] *= decay; s.vel[2] *= decay;
      const move = v3.scale(s.vel, dt); const len = v3.len(move);
      // fast sparks are ray cast so a burst beside a wall does not glow through it; slow ones (skittering embers) only see the floor — cheap enough at ≤ 96
      const hit = col && P.collide && len > 0.02 ? col.raycast(s.pos, v3.scale(move, 1 / len), len + 0.01) : null;
      if (hit) {
        s.pos = v3.mad(s.pos, move, Math.max(0, hit.t - 0.006) / len);
        const vn = v3.dot(s.vel, hit.n); if (vn < 0) { const vN = v3.scale(hit.n, vn); s.vel = v3.add(v3.scale(v3.sub(s.vel, vN), 0.7), v3.scale(vN, -0.25)); }
      } else s.pos = v3.add(s.pos, move);
      // bounce off the floor losing most of the energy: in indoor footage the fragments skitter along the ground for as long as they burn
      if (s.pos[1] < 0.01) { s.pos[1] = 0.01; if (s.vel[1] < 0) { s.vel[1] *= -0.25; s.vel[0] *= 0.7; s.vel[2] *= 0.7; } }
      live++;
    }
    this.live = live;
  }

  /** One thin emissive box per live spark. The streak is a thin box along the true 3D travel direction (Box.rot); historically it was laid along the XZ projection of the motion
   *  (what a top-down view sees of it) unless it is nearly vertical, when it stands upright instead. */
  boxes(out: Box[]) {
    const P = this.params; const t = P.thickness * 0.5;
    for (const s of this.pool) {
      if (!s.alive) continue;
      const u = s.age / Math.max(s.life, 1e-3);
      const f = u < P.hold ? 1 : Math.max(0, 1 - (u - P.hold) / Math.max(1e-3, 1 - P.hold));   // hold, then fall away: an ember is bright and then it is embers
      const e = f * f * P.brightness * P.emissive; if (e < 0.02 * P.emissive) continue;
      const emissive: Vec3 = [e, e * (0.35 + 0.5 * f), e * (0.08 + 0.25 * f * f)];             // white-hot → orange → red as it cools
      let tail = v3.mad(s.pos, s.vel, -P.shutter); if (tail[1] < 0.005) tail = [tail[0], 0.005, tail[2]];
      const d = v3.sub(s.pos, tail); const L = v3.len(d);
      const mid = v3.lerp(s.pos, tail, 0.5);
      // a streak IS its motion: a thin box along the true 3D travel direction (raster-only, so it may tilt: Box.rot), never a level sliver
      const dir: Vec3 = L > 1e-5 ? [d[0] / L, d[1] / L, d[2] / L] : [0, 1, 0];
      out.push(makeBox({ c: mid, h: [t, t, Math.max(P.minStreak * 0.5, L * 0.5)], yaw: v3.yawOf(d), rot: quat.fromTo([0, 0, 1], dir), albedo: [0.04, 0.03, 0.02], emissive, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
    }
  }
}
