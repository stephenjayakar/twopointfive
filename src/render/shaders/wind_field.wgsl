// ---- THE WIND FIELD (game/wind.ts): the air's velocity from ONE source at a point — the analytic supply-vent JET and the STORM outdoors. This one text is compiled
// into BOTH GPU consumers (render/particles.ts prepends it to the particle kernels, smoke/smoke.ts to the solver's), and game/wind.ts jetVel / stormVel repeat it
// on the CPU (windAt: the moths, the panel, the probes) — three copies of one small model; tools/qa wind-probes compares the constants and the CPU numbers. No
// bindings, no structs of either consumer: plain functions of plain arguments, so the two blocks that carry the records (particles_common.wgsl ImpulseRec in its
// 'wind' mode, smoke/wind_force.wgsl WindSrc) can lay them out as suits them.
//
// The JET (a diffuser at `pos` blowing along unit `dir` at `speed` m/s at its face): straight streamlines out of the cone's virtual apex (r0 = the core's radius at
// the face, tanSpread its half-angle), speed × 1/(1 + (d/reach)²) down the axis × a Gaussian e^(−(r/σ)²) across it (σ = r0 + d·tanSpread), cut smoothly to nothing
// over the last 30 % of dMax and outside 2.6 σ (a bounded support: a solver cell or a leaf outside it does exactly nothing); a jet blowing DOWN at a floor turns
// to run out along it below WIND_DEFLECT_H over it (the impinging jet's wall jet — what slides a leaf lying under a diffuser instead of pinning it) and is nothing
// under that floor. `floorY` ≤ −100 = no floor. The STORM: the weather's wind vector everywhere OUTDOORS (outside the two roofed footprints, under
// WIND_STORM_TOP), easing in over the first metre and a half off the facade (the wall's lee) and slower along the ground. ROOF BY ROOF (windStormRoofs; game/wind.ts
// WX_OWN.wind): a level of three or four roofs of its own used to hand windStorm their BOUNDING BOX as its one footprint — on a level built round a yard that box is
// the yard, and nothing outdoors there had any wind. With that rule on the storm record of such a level carries all four footprints and the storm blows wherever
// none of them is overhead, easing in off whichever is nearest; a level of one or two roofs still calls windStorm, with the rectangles it always had.
const WIND_DEFLECT_H: f32 = 0.55;    // m over its floor below which a down-jet turns outward (game/wind.ts WIND_FIELD.deflectH)
const WIND_DEFLECT_LOSS: f32 = 0.35; // share of the speed the turn costs at the floor itself (WIND_FIELD.deflectLoss)
const WIND_SUPPORT_SIG: f32 = 2.6;   // radial cut-off in σ (e^−6.76 ≈ 0.001 of the axis speed) (WIND_FIELD.supportSigma)
const WIND_STORM_TOP: f32 = 8.0;     // m: no storm record above this (nothing that flies or smokes is up there) (WIND_FIELD.stormTop)
const WIND_STORM_LEE: f32 = 1.5;     // m off the facade over which the storm eases in (WIND_FIELD.stormLee)

fn windJet(pos: vec3f, dir: vec3f, speed: f32, reach: f32, tanSpread: f32, r0: f32, dMax: f32, floorY: f32, p: vec3f) -> vec3f {
  if (speed <= 0.0) { return vec3f(0.0); }
  let q = p - pos; let d = dot(q, dir);
  if (d <= 0.0 || d >= dMax) { return vec3f(0.0); }
  let radial = q - dir * d; let r = length(radial);
  let sigma = r0 + d * tanSpread;
  if (r > WIND_SUPPORT_SIG * sigma) { return vec3f(0.0); }
  let x = d / max(reach, 1e-3); let rs = r / sigma;
  var s = speed * exp(-rs * rs) / (1.0 + x * x) * (1.0 - smoothstep(0.7 * dMax, dMax, d));
  var u = normalize(dir * (d + r0 / max(tanSpread, 0.02)) + radial);   // out of the virtual apex r0 / tanSpread behind the face
  if (floorY > -100.0 && dir.y < -0.5) {
    let h = p.y - floorY;
    if (h < 0.0) { return vec3f(0.0); }
    if (h < WIND_DEFLECT_H) {   // the wall jet: turn outward along the floor, all the way AT it, and give up part of the speed in the turn
      let t = 1.0 - h / WIND_DEFLECT_H;
      var hz = vec3f(radial.x, 0.0, radial.z); let hl = length(hz);
      if (hl > 1e-3) { hz /= hl; } else { hz = normalize(vec3f(dir.z + 0.37, 0.0, 0.29 - dir.x)); }   // dead on the axis: any way out (a fixed one)
      u = normalize(mix(u, hz, t * t));
      s *= 1.0 - WIND_DEFLECT_LOSS * t;
    }
  }
  return u * s;
}
fn windInRect(p: vec2f, R: vec4f) -> bool { return p.x > R.x && p.y > R.y && p.x < R.z && p.y < R.w; }
/** the storm's air at p: `windV` outdoors — outside the interior footprint (x0 z0 x1 z1) and the annex's — nothing indoors, above WIND_STORM_TOP or under the ground */
fn windStorm(windV: vec3f, interior: vec4f, annex: vec4f, p: vec3f) -> vec3f {
  if (p.y > WIND_STORM_TOP || p.y < 0.0 || windInRect(p.xz, interior) || windInRect(p.xz, annex)) { return vec3f(0.0); }
  let dOut = max(max(interior.x - p.x, p.x - interior.z), max(interior.y - p.z, p.z - interior.w));   // metres outside the interior rectangle along its nearer axis (> 0 out here)
  let lee = smoothstep(0.0, WIND_STORM_LEE, dOut);
  let hgt = 0.55 + 0.45 * clamp(p.y / 2.5, 0.0, 1.0);
  return windV * (lee * hgt);
}
/** metres ground point p stands outside roof R along its nearer axis (> 0 in the open, ≤ 0 under it) — a footprint with no width is no roof at all: far away */
fn windRoofOut(p: vec2f, R: vec4f) -> f32 {
  if (R.z <= R.x || R.w <= R.y) { return 1e6; }
  return max(max(R.x - p.x, p.x - R.z), max(R.y - p.y, p.y - R.w));
}
/** … and the storm's air at p under up to FOUR roofs (x0 z0 x1 z1 each; an empty one = none): `windV` wherever no roof is overhead, nothing under one, above
 *  WIND_STORM_TOP or under the ground — windStorm's rule roof by roof, the lee taken off the NEAREST roof (windStorm eases in off its first rectangle alone) */
fn windStormRoofs(windV: vec3f, r0: vec4f, r1: vec4f, r2: vec4f, r3: vec4f, p: vec3f) -> vec3f {
  if (p.y > WIND_STORM_TOP || p.y < 0.0) { return vec3f(0.0); }
  let dOut = min(min(windRoofOut(p.xz, r0), windRoofOut(p.xz, r1)), min(windRoofOut(p.xz, r2), windRoofOut(p.xz, r3)));
  if (dOut <= 0.0) { return vec3f(0.0); }
  let lee = smoothstep(0.0, WIND_STORM_LEE, dOut);
  let hgt = 0.55 + 0.45 * clamp(p.y / 2.5, 0.0, 1.0);
  return windV * (lee * hgt);
}
