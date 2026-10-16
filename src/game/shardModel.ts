// A glass SHARD's dynamics — the CPU reference of what render/shaders/particles.wgsl integrates for the P_SHARD particle kind (a fragment of a pane that has let
// go: game/shards.ts files them when the fracture model releases a piece). One model, written twice, like the falling sheet (game/sheetModel.ts): the shader
// flies the thousands you see, this file flies the same equations for the QA probes (they come to rest, they stay bounded, nothing goes NaN — tools/qa
// shards-probes.ts) and for the trajectory sheet, and is the place the numbers are argued. Keep the two in step: SHARD below = particles.ts KIND_DEFAULTS.shard's
// eight slots (gravity · drag · restitution · keep · sleepV · fade · ROUGH · SCATTER) + the constants the kind block has no slot for, which
// particles_common.wgsl repeats as SHARD_* (the probes compare them by name).
// What is shared exactly: the equations, every constant, the hash FUNCTION and the emit kernel's draws (sprayShards below = the same seeds, streams and cone). What is
// not: the per-touch draws are keyed here by the touch count and in the kernel by the particle's age bits — so this file predicts the DISTRIBUTION the GPU flies
// (reach, hops, time to rest, rest tilts), not any one fragment's path.
//
// The model (a fragment of float glass is DENSE and STIFF: it does not flutter, it tumbles and it bounces):
//   state      p, v, unit normal n (two-sided), angular velocity ω (any axis: a shard spins about its normal too — that part only turns the outline), spin φ
//   flight     gravity; drag e^(−k·dt) with k = drag × REF_SIZE ÷ size capped at DRAG_MAX — at the reference centimetre a fragment keeps its speed across a
//              room, a 3 mm fine is stopped by the air inside a metre or two (area ÷ mass ∝ 1 ÷ size: the fines hang in a cloud near the pane, the big pieces
//              carry); ω barely damped (ANG_DAMP), n turned by ω
//   floor      (the shader: traceClosest against the level; here a floor plane) the normal speed comes back × restitution × (1 − E_JIT/2 ‥ 1 + E_JIT/2) hashed per
//              touch — an irregular piece lands on a corner one time and its flat the next, so no two hops are the same height; the slide keeps `keep` of
//              itself and is DEFLECTED by up to ±SKITTER rad to a hashed side (the corner it struck throws it sideways: that is the skitter); ω is dealt
//              afresh ∝ the speed it leaves at (SPIN_K rad/s per m/s, ≤ SPIN_MAX) about a hashed in-plane axis
//   wall       comes off at WALL_E of its normal speed, WALL_KEEP of its slide, half its tumble
//   rest       slower than sleepV after a floor touch → it lies down and SLEEPS: its normal goes to the surface's tilted by REST_TILT × h² toward a hashed side
//              (most lie flat, a few are propped on a neighbour or their own bevel) — so a field of litter mirrors a light at many slightly different angles and
//              only some of it glints at once, and which ones changes as the eye or the torch moves
import { Vec3, v3 } from '../math/vec';
import type { ImpulseResponse } from './sheetModel';

/** the shard kind's numbers (particles.ts KIND_DEFAULTS.shard mirrors the first eight; particles_common.wgsl repeats the rest as SHARD_<NAME>) */
export const SHARD = {
  gravity: 9.8,
  drag: 0.5,          // 1/s on a fragment REF_SIZE across (× REF_SIZE ÷ size, ≤ DRAG_MAX)
  restitution: 0.4,   // float glass on a hard floor (the mean; each touch draws its own)
  keep: 0.78,         // of the slide kept on a floor touch
  sleepV: 0.3,        // m/s
  fade: 5.0,          // s of fade at the end of life
  ROUGH: 0.07,        // the glint lobe's width (GGX α) of a clean fracture face, + the emitter's angular size
  SCATTER: 0.1,       // share of the irradiance on it the body and the cut edges send on diffusely (the green of the edge, the frost of the bruised face)
  REF_SIZE: 0.01,
  DRAG_MAX: 6.0,
  ANG_DAMP: 0.3,      // 1/s on ω in flight
  E_JIT: 0.8,         // spread of the per-touch restitution (× 0.6 ‥ 1.4)
  SKITTER: 0.45,      // rad: the most a floor touch deflects the slide
  SPIN_K: 28.0,       // rad/s of tumble dealt per m/s of speed after a touch
  SPIN_MAX: 60.0,     // rad/s
  WALL_E: 0.3,
  WALL_KEEP: 0.8,
  REST_TILT: 0.35,    // rad: the most a resting shard's normal is off the surface's (× h²)
  GLINT_CAP: 14.0,    // per-light ceiling on the mirror lobe × Fresnel (a fragment is a little mirror: the cap is what stops one aligned sliver being a lamp)
  F0: 0.04,           // glass
  life: 60,           // s a mid-sized fragment lies there (game/shards.ts deals each class its own)
};
/** what an impulse (a stun charge, a round beside it, a boot) does to glass litter: lighter than brass, it hops and skitters on (particles.ts impulseResponse.shard) */
export const SHARD_IMP: ImpulseResponse = { gain: 0.45, upK: 0.5, vMax: 4.5, wake: 0.25 };

export interface ShardState { p: Vec3; v: Vec3; n: Vec3; w: Vec3; size: number; asleep: boolean; age: number; /** floor / wall touches so far (seeds each touch's hashes) */ touches: number; seed: number; }

// the kernel's hash (particles.wgsl pcg / rnd), bit for bit: integer ops only
export function pcg(v: number): number { const s = (Math.imul(v, 747796405) + 2891336453) >>> 0; const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; }
export function rnd(seed: number, k: number): number { return (pcg((seed ^ Math.imul(k, 0x9E3779B9)) >>> 0) >>> 8) / 16777216; }

/** the drag rate of a fragment `size` metres across (1/s) */
export function shardDrag(size: number, K = SHARD): number { return Math.min(K.DRAG_MAX, K.drag * K.REF_SIZE / Math.max(size, 0.0015)); }

/** One step of free flight (no collision). Mutates s. Mirrors particles.wgsl shardAir(). */
export function shardAir(s: ShardState, dt: number, K = SHARD) {
  if (s.asleep || dt <= 0) return;
  s.v[1] -= K.gravity * dt;
  const kd = Math.exp(-shardDrag(s.size, K) * dt);
  s.v = [s.v[0] * kd, s.v[1] * kd, s.v[2] * kd];
  const ka = Math.exp(-K.ANG_DAMP * dt);
  s.w = [s.w[0] * ka, s.w[1] * ka, s.w[2] * ka];
  const c = v3.cross(s.w, s.n);
  s.n = v3.normalize([s.n[0] + c[0] * dt, s.n[1] + c[1] * dt, s.n[2] + c[2] * dt]);
}
/** A touch on a surface of unit normal `nrm` (the fragment already moved to the contact). Mirrors the P_SHARD branch of particles.wgsl update's hit response.
 *  Returns true when it went to sleep. */
export function shardTouch(s: ShardState, nrm: Vec3, K = SHARD): boolean {
  const hs = (s.seed ^ Math.imul(++s.touches, 0x85EBCA6B)) >>> 0;
  const h0 = rnd(hs, 41), h1 = rnd(hs, 42), h2 = rnd(hs, 43), h3 = rnd(hs, 44);
  const vn = v3.dot(s.v, nrm);
  const floor = nrm[1] > 0.6;
  if (vn < 0) {
    let vt: Vec3 = [s.v[0] - nrm[0] * vn, s.v[1] - nrm[1] * vn, s.v[2] - nrm[2] * vn];
    if (floor) {
      const e = K.restitution * (1 - 0.5 * K.E_JIT + K.E_JIT * h0);
      const a = (h1 * 2 - 1) * K.SKITTER; const ca = Math.cos(a), sa = Math.sin(a);
      const cr = v3.cross(nrm, vt);   // vt turned by a about the surface normal
      vt = [vt[0] * ca + cr[0] * sa, vt[1] * ca + cr[1] * sa, vt[2] * ca + cr[2] * sa];
      s.v = [vt[0] * K.keep - nrm[0] * vn * e, vt[1] * K.keep - nrm[1] * vn * e, vt[2] * K.keep - nrm[2] * vn * e];
    } else {
      s.v = [vt[0] * K.WALL_KEEP - nrm[0] * vn * K.WALL_E, vt[1] * K.WALL_KEEP - nrm[1] * vn * K.WALL_E, vt[2] * K.WALL_KEEP - nrm[2] * vn * K.WALL_E];
    }
  }
  const sp = v3.len(s.v);
  if (floor && sp < K.sleepV) {
    const tilt = K.REST_TILT * h2 * h2; const az = h3 * 6.2831853;
    const side: Vec3 = v3.normalize(v3.cross(nrm, Math.abs(nrm[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); const side2 = v3.cross(nrm, side);
    const t: Vec3 = [side[0] * Math.cos(az) + side2[0] * Math.sin(az), side[1] * Math.cos(az) + side2[1] * Math.sin(az), side[2] * Math.cos(az) + side2[2] * Math.sin(az)];
    s.n = v3.normalize([nrm[0] * Math.cos(tilt) + t[0] * Math.sin(tilt), nrm[1] * Math.cos(tilt) + t[1] * Math.sin(tilt), nrm[2] * Math.cos(tilt) + t[2] * Math.sin(tilt)]);
    s.v = [0, 0, 0]; s.w = [0, 0, 0]; s.asleep = true;
    return true;
  }
  if (floor) {   // dealt a fresh tumble about a hashed in-plane axis
    const az = h2 * 6.2831853; const u = v3.normalize(v3.cross(s.n, Math.abs(s.n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); const w2 = v3.cross(s.n, u);
    const k = Math.min(K.SPIN_MAX, K.SPIN_K * sp) * (0.4 + 0.6 * h3);
    s.w = [(u[0] * Math.cos(az) + w2[0] * Math.sin(az)) * k, (u[1] * Math.cos(az) + w2[1] * Math.sin(az)) * k, (u[2] * Math.cos(az) + w2[2] * Math.sin(az)) * k];
  } else s.w = v3.scale(s.w, 0.5);
  return false;
}

/** Fly one shard to rest over a floor at y = `floorY` (and, optionally, an upright wall: the half-space x·wall.n ≥ wall.d is solid) at a fixed step; returns the
 *  path sampled every `every` steps, the time it went to sleep (or −1) and its hops. The probes' and the trajectory sheet's flight. */
export function flyShard(s: ShardState, opts: { dt?: number; maxT?: number; floorY?: number; every?: number; wall?: { n: Vec3; d: number } } = {}, K = SHARD): { path: Vec3[]; restT: number; hops: number; maxH: number; reach: number } {
  const dt = opts.dt ?? 1 / 120, maxT = opts.maxT ?? 12, floorY = opts.floorY ?? 0, every = opts.every ?? 2;
  const path: Vec3[] = [v3.copy(s.p)]; const p0 = v3.copy(s.p);
  let restT = -1, hops = 0, maxH = s.p[1], i = 0;
  for (let t = 0; t < maxT && !s.asleep; t += dt, i++) {
    shardAir(s, dt, K);
    let np: Vec3 = [s.p[0] + s.v[0] * dt, s.p[1] + s.v[1] * dt, s.p[2] + s.v[2] * dt];
    if (opts.wall) { const d1 = v3.dot(np, opts.wall.n) - opts.wall.d; if (d1 > 0 && v3.dot(s.v, opts.wall.n) > 0) { np = [np[0] - opts.wall.n[0] * d1, np[1] - opts.wall.n[1] * d1, np[2] - opts.wall.n[2] * d1]; s.p = np; shardTouch(s, v3.scale(opts.wall.n, -1), K); np = s.p; } }
    if (np[1] <= floorY && s.v[1] < 0) { np[1] = floorY; s.p = np; hops++; if (shardTouch(s, [0, 1, 0], K)) restT = t + dt; }
    else s.p = np;
    s.age += dt; maxH = Math.max(maxH, s.p[1]);
    if (i % every === 0 || s.asleep) path.push(v3.copy(s.p));
  }
  return { path, restT, hops, maxH, reach: Math.hypot(s.p[0] - p0[0], s.p[2] - p0[2]) };
}

/** a shard in the state the emit kernel would deal one (speed along `dir` inside a cone, tumbling) — for the sweeps */
export function makeShard(seed: number, p: Vec3, dir: Vec3, speed: number, spread: number, size: number, tumble: number): ShardState {
  const dn = v3.normalize(dir); const U = v3.normalize(v3.cross(Math.abs(dn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], dn)); const W = v3.cross(dn, U);
  const cy = 1 - rnd(seed, 1) * (1 - Math.cos(spread)); const sr = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rnd(seed, 2) * 6.2831853;
  const d: Vec3 = [dn[0] * cy + U[0] * Math.cos(th) * sr + W[0] * Math.sin(th) * sr, dn[1] * cy + U[1] * Math.cos(th) * sr + W[1] * Math.sin(th) * sr, dn[2] * cy + U[2] * Math.cos(th) * sr + W[2] * Math.sin(th) * sr];
  const wa = rnd(seed, 15) * 6.2831853; const k = tumble * (0.3 + 0.7 * rnd(seed, 16));
  return { p: v3.copy(p), v: v3.scale(d, speed), n: dn, w: [(U[0] * Math.cos(wa) + W[0] * Math.sin(wa)) * k, (U[1] * Math.cos(wa) + W[1] * Math.sin(wa)) * k, (U[2] * Math.cos(wa) + W[2] * Math.sin(wa)) * k], size, asleep: false, age: 0, touches: 0, seed: seed >>> 0 };
}

/** one emit record's numbers as the kernel reads them (render/particles.ts EmitOpts' subset the shard kind uses) */
export interface ShardSpray { pos: Vec3; dir: Vec3; count: number; speed: number; speedJit: number; spread: number; size: number; sizeJit: number; tumble: number; posJit: number; vadd?: Vec3; seed: number; }
/** The shards one emit record deals, by the EMIT KERNEL's own draws (particles.wgsl emit: the particle's seed off the record's, the cone, speed × (1 − jit·r), size
 *  × (1 − jit + 2·jit·r), the position scatter flattened onto the pane, vadd) — the probes' and the trajectory sheet's births. */
export function sprayShards(r: ShardSpray): ShardState[] {
  const out: ShardState[] = []; const dn = v3.normalize(r.dir);
  for (let j = 0; j < r.count; j++) {
    const seed = pcg((r.seed ^ ((Math.imul(j, 0x85EBCA6B) + 1) >>> 0)) >>> 0);
    const sp = r.speed * (1 - r.speedJit * rnd(seed, 3));
    const size = Math.max(0.0005, r.size * (1 - r.sizeJit + 2 * r.sizeJit * rnd(seed, 10)));
    const s = makeShard(seed, r.pos, r.dir, sp, r.spread, size, r.tumble);
    if (r.vadd) s.v = v3.add(s.v, r.vadd);
    if (r.posJit > 0) {
      let jit: Vec3 = [(rnd(seed, 6) - 0.5) * 2 * r.posJit, (rnd(seed, 7) - 0.5) * 2 * r.posJit, (rnd(seed, 8) - 0.5) * 2 * r.posJit];
      const d = v3.dot(jit, dn) * 0.9; jit = [jit[0] - dn[0] * d, jit[1] - dn[1] * d, jit[2] - dn[2] * d];
      s.p = v3.add(s.p, jit);
    }
    out.push(s);
  }
  return out;
}
