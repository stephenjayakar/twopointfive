// ---- WIND in the smoke solver (game/wind.ts → smoke.ts setWind → the `forces` kernel of smoke.wgsl; render/shaders/wind_field.wgsl, prepended just ahead of
// this, IS the field). One small uniform of ≤ 8 source records; WHICH of them reach a brick is a mask the solver's `link` kernel makes per brick from each source's bound. The forces
// step calls windForce(u, worldP, mask, dt) once per cell of a brick some source reaches (a whole-workgroup branch: the mask is per brick); inside a source's support the
// cell's velocity is RELAXED toward the air's — u += k·w·(v_air − u)·dt, w = |v_air| ÷ the source's face speed (1 at a
// jet's face, falling off with its own profile: cells at the fringe are barely nudged, so a plume rising BESIDE a vent keeps its own motion), k = the block's
// relax rate — after buoyancy, confinement, turbulence and the emitters, before the speed clamp and the projection. The pressure solve then does what air does
// with it: a jet blown at the floor spreads along it, a jet into a corner vents the way it can, mass is conserved. Nothing here injects density or heat, and no
// source ever makes or keeps a brick: wind only bends smoke that already exists — which is exactly what the guards' sight lines then march through.
struct WindSrc {
  pos: vec3f, reach: f32,                    // jet: face centre, where it has halved · storm: interior footprint x0 z0 x1 (+ reach = z1)
  dir: vec3f, speed: f32,                    // jet: unit axis, m/s at the face this frame · storm: unit wind direction, m/s
  aux: vec4f,                                // jet: tanSpread, r0, dMax, floorY (≤ −100 = none) · storm: the annex footprint x0 z0 x1 z1
  kind: u32, spare0: u32, spare1: u32, spare2: u32,   // 0 jet · 1 storm; spare0 = 1 on a storm = ROOF BY ROOF (game/wind.ts WX_OWN.wind): pos + reach / aux = the level's first two roofs, the block's `spare` = its third / fourth as two vec4f (all 0 = none)
};
const WIND_MAX_SRC: u32 = 8u;
struct WindBlock {
  count: u32, relax: f32, minW: f32, pad0: f32,   // records live; relaxation rate (1/s) at w = 1; skip cells under this weight
  spare: array<vec4u, 2>,
  src: array<WindSrc, WIND_MAX_SRC>,
};
@group(0) @binding(2) var<uniform> wind: WindBlock;

fn windSrcVel(s: WindSrc, P: vec3f) -> vec3f {
  if (s.kind == 1u) {
    if (s.spare0 == 1u) { return windStormRoofs(s.dir * s.speed, vec4f(s.pos, s.reach), s.aux, bitcast<vec4f>(wind.spare[0]), bitcast<vec4f>(wind.spare[1]), P); }
    return windStorm(s.dir * s.speed, vec4f(s.pos, s.reach), s.aux, P);
  }
  return windJet(s.pos, s.dir, s.speed, s.reach, s.aux.x, s.aux.y, s.aux.z, s.aux.w, P);
}
/** the forces step's wind term for the cell at world position P, velocity u (m/s): u relaxed toward the air of each source in `mask` (bit i = wind.src[i]) inside its support */
fn windForce(u: vec3f, P: vec3f, mask: u32, dt: f32) -> vec3f {
  var v = u; var m = mask;
  while (m != 0u) {
    let i = countTrailingZeros(m); m &= m - 1u;
    let s = wind.src[i];
    let va = windSrcVel(s, P);
    let w = length(va) / max(s.speed, 1e-3);
    if (w < wind.minW) { continue; }
    v = mix(v, va, clamp(w * wind.relax * dt, 0.0, 1.0));
  }
  return v;
}
