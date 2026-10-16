// Shared by the per-pixel volumetric march (volumetrics.wgsl) and the froxel kernels (froxel.wgsl): the haze's phase + drifting dust density, and the
// MASKED smoke samplers — exact versions of smokeTransmittance / smokeSelfShadow that only visit the domains in `mask`, for callers that have proved no other
// live domain can hold the point (a point on a segment lies only in domains whose box the segment crosses). With eight domains live and one or two of them
// anywhere near a given ray, the unmasked loops spent most of a beam step testing boxes kilometres of corridor away. The masked density sampler itself,
// smokeDensityIn, now lives in smoke_read.wgsl: the shadow-ray transmittance every pass takes walks a mask too (smokeSegment / smokeTransmittanceN).
// Prelude: scene (+ lighting_common for the includers that want the dice).
const PI: f32 = 3.14159265;

fn phaseHG(cosT: f32, g: f32) -> f32 { let g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosT, 1.5)); }
// cheap animated value noise → drifting dust density in beams
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i); let n100 = hash13(i + vec3f(1.0, 0.0, 0.0)); let n010 = hash13(i + vec3f(0.0, 1.0, 0.0)); let n110 = hash13(i + vec3f(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3f(0.0, 0.0, 1.0)); let n101 = hash13(i + vec3f(1.0, 0.0, 1.0)); let n011 = hash13(i + vec3f(0.0, 1.0, 1.0)); let n111 = hash13(i + vec3f(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
fn hazeAt(X: vec3f) -> f32 { let q = X * 0.9 + vec3f(frame.time * 0.05, -frame.time * 0.02, frame.time * 0.035); let h = 0.55 + 0.9 * vnoise(q) * vnoise(q * 2.7 + 3.1); if (WX_KINDS) { if (frame.cardCfg.w != 0u) { return h * wxHazeK(X); } } return h; }   // (a weather kind's fog thickens it outdoors: common.wgsl wxHazeK; no fog = the value it always was)
fn max3(v: vec3f) -> f32 { return max(v.x, max(v.y, v.z)); }

// Parametric interval [t0, t1] of the ray O + tV inside the (positive nappe of the) cone with apex A, axis D, cos half-angle cosT.
// Returns t0 > t1 when empty. Unbounded ends are ±1e9.
fn coneInterval(O: vec3f, V: vec3f, A: vec3f, D: vec3f, cosT: f32) -> vec2f {
  let CO = O - A;
  let vd = dot(V, D); let cod = dot(CO, D); let c2 = cosT * cosT;
  let a = vd * vd - c2;
  let b = 2.0 * (vd * cod - c2 * dot(V, CO));
  let c = cod * cod - c2 * dot(CO, CO);
  // where the axial coordinate s(t) = cod + t*vd is >= 0
  var sLo = -1e9; var sHi = 1e9;
  if (vd > 1e-6) { sLo = -cod / vd; } else if (vd < -1e-6) { sHi = -cod / vd; } else if (cod < 0.0) { return vec2f(1.0, 0.0); }
  if (abs(a) < 1e-7) {
    // ray direction lies on the cone angle: f(t) = b t + c linear
    var lo = -1e9; var hi = 1e9;
    if (abs(b) < 1e-9) { if (c < 0.0) { return vec2f(1.0, 0.0); } }
    else if (b > 0.0) { lo = -c / b; } else { hi = -c / b; }
    return vec2f(max(lo, sLo), min(hi, sHi));
  }
  let disc = b * b - 4.0 * a * c;
  if (disc < 0.0) {
    if (a < 0.0) { return vec2f(1.0, 0.0); }        // never inside
    return vec2f(sLo, sHi);                          // inside the double cone everywhere → positive nappe part
  }
  let sq = sqrt(disc);
  var r0 = (-b - sq) / (2.0 * a); var r1 = (-b + sq) / (2.0 * a);
  if (r0 > r1) { let tmp = r0; r0 = r1; r1 = tmp; }
  if (a < 0.0) {
    // inside between the roots (if that's the positive nappe)
    let mid = 0.5 * (r0 + r1);
    if (cod + mid * vd < 0.0) { return vec2f(1.0, 0.0); }
    return vec2f(r0, r1);
  }
  // a > 0: inside outside the roots; the positive nappe is the half-line on the s>=0 side
  if (vd > 0.0) { return vec2f(max(r1, sLo), 1e9); }
  return vec2f(-1e9, min(r0, sHi));
}

/** transmittance toward a light along ro + t·rd, t < tmax, for the (K > 0, non-froxel) smoke march's own step lighting: the shadow estimator at 8 samples whatever the frame's count
 *  (= smoke_read.wgsl smokeTransmittanceN — the masked walk this file introduced is now the one everybody takes, tightened to the domains' occupied boxes) */
fn smokeTransIn(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { return smokeTransmittanceN(ro, rd, tmax, 8.0); }
/** … with 5 samples — the froxels' haze uses it for how much a plume dims a beam beyond it (a per-froxel term, softer than the march's per-step one by construction) */
fn smokeTransCoarse(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { return smokeTransmittanceN(ro, rd, tmax, 5.0); }
fn smokeSelfShadowIn(P: vec3f, L: vec3f, mask: u32) -> f32 {
  var od = 0.0; let ds = 0.18;
  for (var i = 1; i <= 4; i++) { od += smokeDensityIn(P + L * (f32(i) - 0.3) * ds, mask); }
  return exp(-od * ds * SMOKE_SELF_K);
}
/** the self-shadow's extinction per unit density over its 0.72 m toward the light: 6 = the march's own σt (as it always was); 9 since 08-12 — the lit side of a billow
 *  keeps its light and the fold behind it goes dark, which is much of what reads as VOLUME in a lit plume (a look constant: only this march reads it) */
const SMOKE_SELF_K: f32 = 6.0;   // (9 deepens the folds further — a look call the maintainer has not made; Tab has no row for it yet)
/** the smoke march's PER-STEP LIGHT count (frame.volCfg.w bits 8‥11 = settings.smokeMarchLights; docs/internal/smoke-look.md): 0 = the froxel-lit march exactly as it
 *  was (every light reaches the plume trilinearly through the J volume); K > 0 = injectJ writes only the AMBIENT into J and the march lights the K strongest lights on each
 *  stretch per step itself (exact cone edge, a shadow ray, the step's own self-shadow) — the pre-froxel plume lighting, without J's flat blob or its slice lattice.
 *  Both producers read this one number, so J and the march always agree on who lights what. */
fn smokeMarchLights() -> u32 { return (frame.volCfg.w >> 8u) & 15u; }
/** the MULTIPLE-SCATTERING octave's gain (frame.volCfg.w bits 12‥15 ÷ 10; settings.smokeMultiScatter, 0 = single scattering exactly as it was): per lit step a second lobe with a
 *  phase half as forward and the light seen through HALF the self-shadow's extinction (√ of the single-scatter self-shadow), integrated to the eye through half the extinction
 *  too (√T, √stepT) — Wrenninge et al. 2013's octave with a = b = c = ½. What it buys: a plume can be opaque to what stands behind it AND still show the coloured glow of its
 *  lit side through its body, where single scattering alone shows an ambient-lit shell (the maintainer, 08-12: 'the lobes … more structure to the smoke + lighting, less flat'). */
fn smokeMsGain() -> f32 { return f32((frame.volCfg.w >> 12u) & 15u) * 0.1; }
const SMOKE_MS_G: f32 = 0.175;   // the octave's phase eccentricity (½ of the single lobe's 0.35)
/** bits of the live domains whose box, grown by `grow` metres, overlaps the box [lo, hi] — what can hold any sample taken within `grow` of that box */
fn smokeDomainsNear(lo: vec3f, hi: vec3f, grow: f32) -> u32 {
  var mask = 0u;
  for (var i = 0u; i < frame.numSmoke; i++) {
    let sd = smoke[i];
    if (sd.live == 0u) { continue; }
    let bmin = sd.origin - vec3f(grow); let bmax = sd.origin + sd.voxel * vec3f(sd.dims) + vec3f(grow);
    if (all(bmin <= hi) && all(bmax >= lo)) { mask |= 1u << i; }
  }
  return mask;
}
