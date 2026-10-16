// The falling SHEET's dynamics — the CPU reference of what render/shaders/particles.wgsl `sheetAir` integrates for the P_SHEET particle kind (a leaf of
// office paper knocked off a desk by a burst: destruction.ts). One model, written twice: the shader flies the thousands you see, this file flies the same
// equations for the QA probes (settle time, no NaN, the flutter looks like flutter — tools/qa probes 'destruction') and is the place the numbers are argued.
// Keep the two in step: SHEET below = particles.ts KIND_DEFAULTS.sheet's slots (gravity · drag = KT · restitution = KN_LIN · keep = KN_Q · sleepV · fade · FLUT ·
// TRANS) + the two constants the kind block has no slot for (ANG_DAMP, SPIN_MAX), which particles_common.wgsl repeats.
//
// The model (phenomenological, sign-correct, cheap — Tanabe & Kaneko's falling-paper regimes without their lift polar):
//   state      p, v, unit normal n (two-sided: everything below is invariant under n → −n), angular velocity ω ⊥ n, in-plane spin φ (looks only)
//   gravity    v.y −= g·dt
//   drag       ANISOTROPIC: split v into the slip through the sheet vn = v·n and the slip along it vt = v − n·vn; the face is a plate — its normal force
//              grows with the whole airspeed × the through-slip (the flat plate's |v|²·sin α: a GLIDING sheet gets lift, not only a mushing one), + a little
//              linear: vn ← vn·e^−(KN_LIN + KN_Q·|v|)·dt, so face-down it reaches ≈ √(g / KN_Q) ≈ 1 m/s like an 80 g/m² sheet does — the edge is nothing,
//              vt ← vt·e^−KT·dt; so a tilted sheet GLIDES: the through-slip dies, the along-slip persists and gravity's in-plane share feeds it
//   flutter    the plate's centre of pressure sits ahead of its centre (toward where it is sliding), and the normal force acts there: torque
//              τ = r_cp × F = (c/4·v̂t) × (−k·vn·n)  →  angular acceleration  α = FLUT · (−vn) · (vt × n)  — bilinear in the two slips (∝ 'in-plane slip ×
//              normal slip'), and it pitches the LEADING EDGE UP: the glide steepens into a stall, the along-slip reverses down the new slope, the sheet swoops
//              back — the falling-leaf oscillation; a hard enough kick tumbles it end over end instead (both regimes are real). ω is damped (ANG_DAMP: air
//              resists a turning sheet strongly) and kept ⊥ n (spin about the normal is φ's, cosmetic); n turns by ω.
//   ground     (the shader: traceClosest against the level) an up-facing hit lays it toward flat, kills the through-slip, rubs the along-slip; slow enough and
//              it SLEEPS flat on the surface like a chip. Walls: slide down them. Here: a floor plane at y = 0 stands in for the level.
//   gust       (impulses, below) for a few tenths of a second after a blast has kicked it the AIR MOVES WITH THE LEAF: drag and flutter torque are taken
//              against a co-moving parcel, i.e. scaled by (1 − GUST_K·g), g = gust ÷ GUST_TAU falling to 0 — the leaf is CARRIED up a metre and let go
//              into still air at the top, where the flutter takes over. gust = 0 (every sheet no impulse has touched) = the equations exactly as they were.
import { Vec3, v3 } from '../math/vec';

/** the sheet kind's numbers (particles.ts KIND_DEFAULTS.sheet mirrors the first eight; the shader reads them from the kind block) */
export const SHEET = {
  gravity: 9.8,
  KT: 0.5,        // along-the-sheet (skin) drag, 1/s
  KN_LIN: 1.5,    // through-the-sheet drag, linear part, 1/s
  KN_Q: 9.0,      // …× airspeed part, 1/m: terminal face-down ≈ √(g / KN_Q) ≈ 1 m/s
  sleepV: 0.28,   // m/s: slower than this on an up face after a touch → lies down and sleeps
  fade: 4.0,      // s of fade at the end of life
  FLUT: 25.0,     // flutter torque gain (rad/s² per (m/s)²): a sheet let go tilted at chest height rocks two or three times and lands ~half a metre off (sheetModel sweep)
  TRANS: 0.3,     // translucency: the share of the light on the BACK face that shows through (a sheet between the eye and a torch glows)
  ANG_DAMP: 1.8,  // 1/s on ω
  SPIN_MAX: 3.0,  // rad/s: in-plane spin dealt per sheet off its seed (× how fast it moves; nothing at rest)
  life: 60,       // s a sheet lies there before it fades (the LONG ring recycles the oldest before that under load)
};

export interface SheetState { p: Vec3; v: Vec3; n: Vec3; w: Vec3; asleep: boolean; age: number; /** s of blast wind still carrying it (impulses; absent / 0 = still air) */ gust?: number; }
/** the gust: how long a full kick's wind carries the leaf (TAU s: all of it but the last RAMP share, over which the still air comes back), and how much of the drag /
 *  torque it takes away while it does (particles_common.wgsl SHEET_GUST_TAU / _K / _RAMP) */
export const SHEET_GUST = { TAU: 0.4, K: 0.98, RAMP: 0.35 };

/** One step of the free-flight model above (no collision). Mutates s. Mirrors particles.wgsl sheetAir(). */
export function sheetAir(s: SheetState, dt: number, K = SHEET) {
  if (s.asleep || dt <= 0) return;
  const v = s.v; let n = s.n;
  const gust = s.gust ?? 0; const g = gust > 0 ? Math.min(1, gust / (SHEET_GUST.TAU * SHEET_GUST.RAMP)) : 0; if (gust > 0) s.gust = Math.max(0, gust - dt);
  const air = 1 - SHEET_GUST.K * g;   // (exactly 1 in still air: the model as it was, bit for bit)
  v[1] -= K.gravity * dt;
  const vn = v3.dot(v, n);
  const vt: Vec3 = [v[0] - n[0] * vn, v[1] - n[1] * vn, v[2] - n[2] * vn];
  const kn = Math.exp(-(K.KN_LIN + K.KN_Q * v3.len(v)) * air * dt), kt = Math.exp(-K.KT * air * dt);
  const vn2 = vn * kn;
  s.v = [vt[0] * kt + n[0] * vn2, vt[1] * kt + n[1] * vn2, vt[2] * kt + n[2] * vn2];
  // flutter torque → ω (⊥ n), damped
  const c = v3.cross(vt, n);
  const a = K.FLUT * (-vn) * air;
  let w: Vec3 = [s.w[0] + c[0] * a * dt, s.w[1] + c[1] * a * dt, s.w[2] + c[2] * a * dt];
  const wd = Math.exp(-K.ANG_DAMP * dt); w = v3.scale(w, wd);
  const wn = v3.dot(w, n); w = [w[0] - n[0] * wn, w[1] - n[1] * wn, w[2] - n[2] * wn];
  // n turns by ω
  const dn = v3.cross(w, n);
  n = v3.normalize([n[0] + dn[0] * dt, n[1] + dn[1] * dt, n[2] + dn[2] * dt]);
  s.n = n; s.w = w; s.age += dt;
}

/** The reference's ground: a floor plane at y = floorY (the shader traces the level instead). An up-facing touch lays the sheet toward flat, kills the through
 *  motion, rubs the slide; below sleepV it sleeps flat. Returns true the step it went to sleep. Mirrors particles.wgsl's sheet branch of the hit response. */
export function sheetGround(s: SheetState, floorY = 0, K = SHEET): boolean {
  if (s.asleep) return false;
  const clearance = 0.004;
  if (s.p[1] > floorY + clearance) return false;
  s.p[1] = floorY + clearance;
  const hn: Vec3 = [0, 1, 0];
  const vin = v3.dot(s.v, hn);
  if (vin < 0) s.v = [s.v[0] - hn[0] * vin * 1.05, s.v[1] - hn[1] * vin * 1.05, s.v[2] - hn[2] * vin * 1.05];   // no bounce to speak of
  s.v = v3.scale(s.v, 0.6);                                                                                     // paper on laminate: it does not skate
  const sgn = v3.dot(s.n, hn) >= 0 ? 1 : -1;
  s.n = v3.normalize(v3.lerp(s.n, v3.scale(hn, sgn), 0.7)); s.w = v3.scale(s.w, 0.3);
  if (v3.len(s.v) < K.sleepV) { s.asleep = true; s.v = [0, 0, 0]; s.w = [0, 0, 0]; s.n = v3.scale(hn, sgn); if (s.gust) s.gust = 0; return true; }
  return false;
}

/** Fly one sheet from `s` until it sleeps or `maxT` passes (dt fixed): the reference trajectory the probes measure (settle time, peak speed, how far it drifted,
 *  how many times the along-slip reversed = flutter half-cycles, how high it got). */
export function flySheet(s: SheetState, dt = 1 / 60, maxT = 20, floorY = 0): { t: number; asleep: boolean; peakV: number; peakY: number; drift: number; reversals: number; nan: boolean } {
  let t = 0, peakV = 0, peakY = s.p[1], reversals = 0, lastSign = 0; const p0: Vec3 = v3.copy(s.p); let nan = false;
  while (t < maxT && !s.asleep) {
    sheetAir(s, dt); s.p = v3.mad(s.p, s.v, dt); sheetGround(s, floorY);
    const sp = v3.len(s.v); if (sp > peakV) peakV = sp; if (s.p[1] > peakY) peakY = s.p[1];
    const vn = v3.dot(s.v, s.n); const vt: Vec3 = [s.v[0] - s.n[0] * vn, 0, s.v[2] - s.n[2] * vn]; const along = vt[0] * 0.7071 + vt[2] * 0.7071;   // the horizontal slide, signed along a fixed diagonal
    const sg = along > 0.05 ? 1 : along < -0.05 ? -1 : 0; if (sg && lastSign && sg !== lastSign) reversals++; if (sg) lastSign = sg;
    if (!s.p.every(Number.isFinite) || !s.n.every(Number.isFinite)) { nan = true; break; }
    t += dt;
  }
  return { t, asleep: s.asleep, peakV, peakY, drift: Math.hypot(s.p[0] - p0[0], s.p[2] - p0[2]), reversals, nan };
}

// ================================================================== IMPULSES (render/particles.ts Particles.impulse → particles.wgsl applyImpulses; sites in
// game/destruction.ts): a game event — a stun charge going off, a round landing beside settled litter, a body or a boot or a shoved desk thumping the floor —
// pushes every live particle of the kinds it names within its radius, and WAKES the ones lying asleep so paper already on the floor goes up again. One record
// = { pos, radius, strength = the peak Δv (m/s) a SHEET gets at the centre, up = the upward share added to the radial push (leaves LIFT, then flutter down),
// bias = a direction folded in (the round's travel along the surface it struck), kinds, seed, an optional occlusion eye }. The push on a particle at distance
// d is Δv = strength × gain(kind) × (1 − d / radius) × (radial‖ + up·upK(kind)·ŷ + bias) — radial with its downward part dropped (a charge on the floor
// pushes the floor's litter out along the floor, never into it), the sum NOT renormalised (up and bias add to a unit radial); |v| is clamped per kind after
// the kick and a resting particle is only woken by a kick of at least wake(kind). This table is the kernel's third row per kind (particles.ts packs it into
// the uniform block, so the panel edits it live); the sheet's SHAPE response (the fresh tilt and tumble that put it back into the flutter model) is the two
// constants under it, which particles_common.wgsl repeats. The probes fly the reference below; the kernel flies what you see.
/** falloff of an impulse with distance: linear, 1 − d/r inside the radius, 0 outside — leaves within half the radius fly, ones near the edge just shiver */
export function impulseFalloff(d: number, r: number): number { if (!(d < r) || r <= 0) return 0; return 1 - Math.max(0, d) / r; }
/** below this scalar kick (m/s) an impulse does nothing to a particle at all (the far fringe: not worth the wake, the ray or the write) */
export const IMP_MIN_KICK = 0.03;
/** per-kind response: gain on the record's strength · multiplier on its upward share · |v| cap after the kick (m/s) · the least kick that wakes a resting one (m/s) */
export interface ImpulseResponse { gain: number; upK: number; vMax: number; wake: number; }
export const IMP_RESPONSE = {
  spark:  { gain: 0,    upK: 0,   vMax: 0,   wake: 0 },      // ignored: a spark is gone before anything could push it, and a pushed streak would read as a second ricochet
  debris: { gain: 0.4,  upK: 0.6, vMax: 4.0, wake: 0.25 },   // chips / splinters / crumbs: a moderate hop and skitter, another landing angle
  dust:   { gain: 0.7,  upK: 0.3, vMax: 3.0, wake: 0 },      // a puff is shoved along by the air (it never sleeps)
  casing: { gain: 0.3,  upK: 0.5, vMax: 3.5, wake: 0.3 },    // brass is heavy for its size: a short hop, a roll, the twinkle of it turning
  sheet:  { gain: 1.0,  upK: 1.0, vMax: 6.0, wake: 0.12 },   // THE reference kind: strength is quoted as a sheet's Δv at the centre
  rain:   { gain: 0,    upK: 0,   vMax: 0,   wake: 0 },      // ignored like the spark: a rain drop (game/rainFx.ts) is gone before a push could show, and the impulses leave its ring alone
} satisfies Record<string, ImpulseResponse>;
/** the sheet's shape response (particles_common.wgsl SHEET_IMP_TILT / _TUMBLE / _WMAX / _GUST0 / _GUST1): a kicked leaf is tipped off flat by up to TILT rad (× the
 *  kick over 1.5 m/s, × 0.4‥1 per leaf) toward a hashed side — so the push is partly ALONG it and persists, where a face-on shove dies in three frames of through-drag
 *  — lifted by the height its dipped edge would otherwise dig in, set turning about a hashed in-plane axis at TUMBLE rad/s per m/s of kick (≤ 4), |ω| ≤ WMAX, and
 *  given the blast's wind for SHEET_GUST.TAU × clamp((kick − GUST0) / GUST1) s: a scoot from a round beside it gets next to none, a charge's kick the whole gust */
export const SHEET_IMP = { TILT: 0.9, TUMBLE: 3.0, WMAX: 12, GUST0: 0.5, GUST1: 1.5 };
export interface ImpulseLike { pos: Vec3; radius: number; strength: number; up: number; bias: Vec3; }
/** per-particle raggedness of a push (a blast front is not smooth: two leaves a hand apart do not get the same shove — without it a pile lifts as one clump):
 *  the kick × (1 − MAG/2 ‥ 1 + MAG/2) off one hash, plus SIDE × the kick sideways along a hashed bearing */
export const IMP_JITTER = { MAG: 0.6, SIDE: 0.35 };
/** The push one impulse gives a particle of response `G` at `p`: the velocity change and the scalar kick s (strength × gain × falloff), or null when it does
 *  nothing (outside the radius, under IMP_MIN_KICK, a kind that ignores impulses). `j` = the particle's two hashes for this record (magnitude, bearing) —
 *  omitted = the smooth mean push (the sweeps); the kernel always has them. Mirrors the per-impulse body of particles.wgsl applyImpulses. */
export function impulseKick(imp: ImpulseLike, p: Vec3, G: ImpulseResponse, j?: [number, number]): { dv: Vec3; s: number } | null {
  if (G.gain <= 0) return null;
  const to = v3.sub(p, imp.pos); const d = v3.len(to);
  let s = imp.strength * G.gain * impulseFalloff(d, imp.radius);
  if (s < IMP_MIN_KICK) return null;
  const radial: Vec3 = d < 0.02 ? [0, 1, 0] : [to[0] / d, Math.max(0, to[1] / d), to[2] / d];
  const dir: Vec3 = [radial[0] + imp.bias[0], radial[1] + imp.up * G.upK + imp.bias[1], radial[2] + imp.bias[2]];
  if (!j) return { dv: v3.scale(dir, s), s };
  s *= 1 - IMP_JITTER.MAG / 2 + IMP_JITTER.MAG * j[0]; const a = j[1] * 6.2831853;
  return { dv: [dir[0] * s + Math.cos(a) * IMP_JITTER.SIDE * s, dir[1] * s, dir[2] * s + Math.sin(a) * IMP_JITTER.SIDE * s], s };
}
/** Apply a summed kick (Σ dv over the frame's impulses, s = the largest single kick) to one sheet: wake it if the kick clears the wake threshold, add the Δv and cap
 *  |v|, hand it the gust, spin it about an in-plane axis by h[2]; a leaf that was LYING (asleep) is also tipped off flat toward the hashed side h[0] by the hashed
 *  share h[1] and lifted by its dipped edge (one already in the air keeps its attitude: a second kick must not snap it). `halfLen` = half the leaf's length (m).
 *  Returns false when a resting sheet slept through it. Mirrors particles.wgsl applyImpulses' P_SHEET tail. */
export function sheetImpulse(s: SheetState, dv: Vec3, kick: number, h: Vec3, halfLen = 0.15, G: ImpulseResponse = IMP_RESPONSE.sheet, K = SHEET_IMP): boolean {
  if (kick <= 0) return false;
  const lay = s.asleep;
  if (lay) { if (kick < G.wake) return false; s.asleep = false; }
  let v: Vec3 = v3.add(s.v, dv); const sp = v3.len(v); if (sp > G.vMax) v = v3.scale(v, G.vMax / sp); s.v = v;
  s.gust = Math.max(s.gust ?? 0, SHEET_GUST.TAU * Math.min(1, Math.max(0, (kick - K.GUST0) / K.GUST1)));
  const az = h[0] * 6.2831853; const tilt = lay ? K.TILT * (0.4 + 0.6 * h[1]) * Math.min(1, kick / 1.5) : 0;
  const side: Vec3 = [Math.cos(az), 0, Math.sin(az)];
  let n = s.n; const sn = v3.dot(side, n); let t: Vec3 = [side[0] - n[0] * sn, side[1] - n[1] * sn, side[2] - n[2] * sn]; const tl = v3.len(t);
  if (tl > 1e-3) {
    t = v3.scale(t, 1 / tl);
    if (lay) {
      n = v3.normalize([n[0] * Math.cos(tilt) + t[0] * Math.sin(tilt), n[1] * Math.cos(tilt) + t[1] * Math.sin(tilt), n[2] * Math.cos(tilt) + t[2] * Math.sin(tilt)]);
      s.p = [s.p[0], s.p[1] + Math.sin(tilt) * halfLen, s.p[2]];
    }
    const axis = v3.normalize(v3.cross(n, t));   // in-plane, across the tilt: the leaf pitches on round the way it was tipped
    let w: Vec3 = v3.mad(s.w, axis, K.TUMBLE * Math.min(kick, 4) * (0.5 + h[2]) * (h[0] < 0.5 ? -1 : 1));
    const wl = v3.len(w); if (wl > K.WMAX) w = v3.scale(w, K.WMAX / wl);
    const wn = v3.dot(w, n); s.w = [w[0] - n[0] * wn, w[1] - n[1] * wn, w[2] - n[2] * wn]; s.n = n;
  }
  return true;
}
