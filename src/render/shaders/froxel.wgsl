// FROXEL VOLUMETRICS (renderer v3 Phase 2b — Wronski 2014 'Volumetric fog', Hillaire 2015 'Physically based & unified volumetric rendering'; host side:
// render/froxels.ts; the grid ↔ world mapping every kernel and consumer shares is froxelDir / froxelDist / froxelSlice / froxelFetch in common.wgsl).
// The camera frustum is cut into W × H × D froxels (screen tiles × slices in distance along the pixel ray, thickening exponentially with distance) and the
// participating media are LIT PER FROXEL instead of per pixel-ray step. The HAZE (the building's thin dust: beams) lives entirely in the froxels — density,
// lighting, integration — and a pixel reads it with one fetch. The SMOKE keeps its per-pixel density march (volumetrics.wgsl: the plume's own 2–8 cm voxels
// are far finer than a froxel, and its billows and silhouette are the sim's whole point) but takes its LIGHTING from here: J, the in-scattered radiance per
// unit scattering at each froxel of the smoke's clusters, one fetch per march step instead of K shadow rays + self-shadow marches per step.
//   cull       one thread per CLUSTER (8 × 8 froxels × 4 slices): its world box against every light (range sphere · brightness floor · spot cone · panel facing ·
//              a directional light only under the ceiling) and every live smoke domain → a 64-bit light mask + smoke domain masks. The froxel's light list.
//   inject     one thread per froxel. HAZE: four sub-rays across the froxel (2 × 2 strata, jittered per frame — a Halton triple, scrambled per froxel), each
//              light's lit chord of the froxel along them resolved ANALYTICALLY (range sphere ∩ cone ∩ panel half-space, the inverse-square core integrated in
//              closed form = the equi-angular integral the march estimated with steps), the k lights with the largest unshadowed in-scatter given a shadow ray
//              (+ the smoke's transmittance toward the light) from a point inside their lit chord, the rest dropped — never credited unshadowed (a torch behind
//              a wall must not glow this side of it). → raw volume rgb = haze in-scatter per metre (a = extinction, 0: the thin haze's is ignored as it always was).
//   injectJ    (also the TRANSIENT lights' haze — flashes, tracer heads, lightning — un-jittered on the same half-res grid, added by integrate outside the history:
//              at once, and gone at once) and SMOKE J, on its own grid (half the froxels across, the same slices — the smoke's light field is smooth; a texel where a
//              live domain is near only): at the texel CENTRE, un-jittered — so it needs no history and cannot flicker; every texel every frame — the k strongest
//              lights' irradiance × shadow visibility (one centre ray; for the SUN the mean of 4 depth strata of the texel: one centre ray terraces a sunlit
//              slab through a plume at slice pitch) × the short self-shadow march × the smoke phase, + the radiance cache's walled mean (the ambient). → J volume.
//   temporal   the raw haze volume reprojected into last frame's accumulated one (froxel centre → prevViewProj / prevCam → its old uvw, trilinear), clamped to
//              this frame's neighbourhood box ACROSS the screen (a beam that switched off or moved on cannot linger: where this frame's
//              estimate is flat the history has no room; where it is noisy — a beam's edge, the core beside an emitter — the box is wide and the history
//              smooths), blended at frame.froxelA.w. → the accumulated volume (ping-pong).
//   integrate  one thread per column, front to back: transmittance and the energy-conserving in-scatter of each slice (S += T · L · (1 − e^{−σΔ}) / σ) → the
//              INTEGRATED volume: slice k = (in-scatter, transmittance) between the eye and boundary k+1. composite / the particles fetch it once per pixel.
// Prelude: scene + lighting_common + vol_common. Bindings are disjoint across the kernels (each pipeline's layout lists its own).
@group(1) @binding(0) var clustersW: texture_storage_3d<rgba32uint, write>;   // cull → x, y = light mask (slots 0‥31, 32‥63), z = smoke domains overlapping the cluster | (those within 0.75 m) << 8, w spare
@group(1) @binding(1) var clustersR: texture_3d<u32>;                          // inject reads it
@group(1) @binding(2) var volOut: texture_storage_3d<rgba16float, write>;      // inject → the raw volume; integrate → the integrated volume (the same texture: raw is dead once temporal has read it)
@group(1) @binding(3) var rawR: texture_3d<f32>;                               // temporal reads the raw volume …
@group(1) @binding(4) var histR: texture_3d<f32>;                              // … and last frame's accumulated one; integrate reads this frame's
@group(1) @binding(5) var histOut: texture_storage_3d<rgba16float, write>;    // temporal → this frame's accumulated volume
@group(1) @binding(6) var diceTex: texture_3d<f32>;                            // the radiance cache's dice (lighting_common): the smoke's ambient
@group(1) @binding(7) var smokeJOut: texture_storage_3d<rgba16float, write>;   // injectJ → J: the smoke's source radiance per unit scattering at the texel centre (rgb; a = 1 where computed, 0 = no live domain near) — ⌈W/2⌉ × ⌈H/2⌉ × D
@group(1) @binding(8) var transOut: texture_storage_3d<rgba16float, write>;    // injectJ → the TRANSIENT lights' haze in-scatter per metre (muzzle flashes, tracer heads, lightning: one to three frames each) at the texel centre, no jitter, no history — the same half-res grid; written only while frame.rcJitter.w (their count) > 0
@group(1) @binding(9) var transR: texture_3d<f32>;                             // integrate adds it to the accumulated steady haze (read only while the count > 0)

const FTILE: u32 = 8u;      // froxels per cluster edge (x, y) = froxels.ts FROXEL_TILE
const FCHUNK: u32 = 4u;     // slices per cluster = froxels.ts FROXEL_CHUNK
const FK_MAX: u32 = 6u;     // most shadow-rayed lights a froxel (frame.froxelB.w ≤ this)
const HAZE_MIN_E: f32 = 0.002;    // a light dimmer than this (unshadowed W/m²) adds nothing visible to the thin haze — the per-pixel march's own floor
const SMOKE_MIN_E: f32 = 0.03;    // … and to smoke — likewise the march's

// ---------------------------------------------------------------- cull
/** does the cone (apex, unit axis, cos half-angle < 90°, length `range`) touch the sphere (C, r)? (the clustered-shading test: nearest approach in the cone's own 2D section) */
fn coneTouchesSphere(apex: vec3f, axis: vec3f, cosT: f32, range: f32, C: vec3f, r: f32) -> bool {
  let V = C - apex; let v1 = dot(V, axis); let v2 = dot(V, V);
  let sinT = sqrt(max(1.0 - cosT * cosT, 0.0));
  let dClosest = cosT * sqrt(max(v2 - v1 * v1, 0.0)) - v1 * sinT;
  return !(dClosest > r || v1 > r + range || v1 < -r);
}
@compute @workgroup_size(4, 4, 4)
fn cull(@builtin(global_invocation_id) gid: vec3u) {
  let cd = textureDimensions(clustersW);
  if (any(gid >= cd)) { return; }
  let G = frame.froxelB.xyz;
  // the cluster's world box: its eight corner froxel-boundaries (the far face is a spherical cap bulging ≤ 2 cm past the corners' chord at these tile angles — inside the pad)
  let f0 = vec3f(gid * vec3u(FTILE, FTILE, FCHUNK));
  let f1 = min(f0 + vec3f(f32(FTILE), f32(FTILE), f32(FCHUNK)), vec3f(G));
  var lo = vec3f(1e30); var hi = vec3f(-1e30);
  for (var c = 0u; c < 8u; c++) {
    let f = vec3f(select(f0.x, f1.x, (c & 1u) != 0u), select(f0.y, f1.y, (c & 2u) != 0u), select(f0.z, f1.z, (c & 4u) != 0u));
    let X = frame.camPos + froxelDir(f.xy / vec2f(G.xy)) * froxelDist(f.z);
    lo = min(lo, X); hi = max(hi, X);
  }
  lo -= vec3f(0.1); hi += vec3f(0.1);
  let ctr = 0.5 * (lo + hi); let rad = length(hi - ctr);
  // smoke domains that overlap it (a sample inside the cluster can lie in these only) and those within reach of a self-shadow tap off it
  var smOn = 0u; var smNear = 0u;
  if ((frame.flags & FLAG_SMOKE) != 0u) {
    for (var i = 0u; i < frame.numSmoke; i++) {
      let sd = smoke[i]; if (sd.live == 0u) { continue; }
      let bmin = sd.origin; let bmax = sd.origin + sd.voxel * vec3f(sd.dims);
      if (all(bmin <= hi) && all(bmax >= lo)) { smOn |= 1u << i; }
      if (all(bmin - vec3f(0.75) <= hi) && all(bmax + vec3f(0.75) >= lo)) { smNear |= 1u << i; }
    }
    if (smNear != 0u && !smokeAnyIn(lo - vec3f(0.75), hi + vec3f(0.75))) { smOn = 0u; smNear = 0u; }
  }
  let hazeOn = (frame.flags & FLAG_VOLUMETRICS) != 0u && frame.hazeDensity > 0.0;
  var mlo = 0u; var mhi = 0u;
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i]; let kind = lightKind(li);
    if (!(hazeOn && li.volumetric > 0.0) && smNear == 0u) { continue; }   // a light matters to the haze only through its volumetric weight; to smoke (J is made for every cluster NEAR a domain), any light does
    var keep = true;
    if (kind == 2u) { keep = lo.y < CEIL_Y + 0.5 || smNear != 0u; }        // the sun / a lightning stroke lights the building's dust UNDER the ceiling only (volumetrics.wgsl's rule); smoke anywhere
    else {
      let q = clamp(li.pos, lo, hi); let d2 = dot(q - li.pos, q - li.pos);
      if (d2 > li.range * li.range) { continue; }
      if (max3(li.color) / max(d2, li.radius * li.radius) < HAZE_MIN_E) { continue; }   // cannot reach even the haze's floor anywhere in the box (exact: the bound is what evalLight can return at best)
      if (kind == 1u && li.cosOuter > 0.0) { keep = coneTouchesSphere(li.pos, li.dir, li.cosOuter, li.range, ctr, rad); }
      else if (kind == 3u) {                                            // one-sided panel: some corner of the box in front of its plane
        keep = false;
        for (var c = 0u; c < 8u && !keep; c++) { let X = vec3f(select(lo.x, hi.x, (c & 1u) != 0u), select(lo.y, hi.y, (c & 2u) != 0u), select(lo.z, hi.z, (c & 4u) != 0u)); keep = dot(X - li.pos, li.dir) > 0.0; }
      }
    }
    if (!keep) { continue; }
    if (i < 32u) { mlo |= 1u << i; } else { mhi |= 1u << (i - 32u); }
  }
  textureStore(clustersW, gid, vec4u(mlo, mhi, smOn | (smNear << 8u), 0u));
}

// ---------------------------------------------------------------- inject
struct VolEval { E: vec3f, t: f32, L: vec3f, dist: f32, ok: bool };
// evalLight (common.wgsl) for a FROXEL: the segment [d0, d1] of the eye ray `dir` — its mean irradiance over the segment, resolved ANALYTICALLY along the ray
// (the axis a froxel is a metre deep on) and point-sampled across it (where it is a decimetre wide). The lit chord [tA, tB] of the segment is exact: inside the
// range sphere, the spot's cone (coneInterval), the panel's front half-space; over it the inverse-square core integrates in closed form — ∫ dt / (D² + (t−δ)²)
// = (atan((tB−δ)/D) − atan((tA−δ)/D)) / D, D = the ray's distance from the light (≥ its radius), δ = the light's foot on the ray: the equi-angular integral
// the per-pixel march estimated with 4–24 steps — divided by the whole span (d1 − d0) = the froxel's mean along this ray. The window, the cone's soft edge
// and the panel cosine are taken at ONE point jittered inside the lit chord (r.t), which is also where the shadow ray leaves from and the phase is read: a
// froxel the beam only clips is lit in proportion, from a point that is actually in the beam. Directional: colour as is over the whole span, distance 1e6.
fn evalLightFroxel(li: Light, dir: vec3f, d0: f32, d1: f32, jz: f32) -> VolEval {
  var r: VolEval; r.ok = false; r.E = vec3f(0.0); r.t = mix(d0, d1, jz); r.L = -li.dir; r.dist = 1e6;
  let kind = lightKind(li);
  if (kind == 2u) { r.E = li.color; r.ok = true; return r; }
  let ro = frame.camPos;
  let oc = ro - li.pos; let b = dot(oc, dir); let oc2 = dot(oc, oc);
  let disc = b * b - oc2 + li.range * li.range;
  if (disc <= 0.0) { return r; }
  let sq = sqrt(disc);
  var tA = max(d0, -b - sq); var tB = min(d1, -b + sq);
  if (kind == 1u) { let ci = coneInterval(ro, dir, li.pos, li.dir, li.cosOuter); tA = max(tA, ci.x); tB = min(tB, ci.y); }
  else if (kind == 3u) {                                                 // in front of the panel: dot(oc, n) + t·dot(dir, n) > 0
    let pn = dot(oc, li.dir); let dn = dot(dir, li.dir);
    if (abs(dn) < 1e-6) { if (pn <= 0.0) { return r; } } else if (dn > 0.0) { tA = max(tA, -pn / dn); } else { tB = min(tB, -pn / dn); }
  }
  if (tB <= tA) { return r; }
  r.t = mix(tA, tB, jz);
  let X = ro + dir * r.t;
  let dv = li.pos - X; let dist = length(dv);
  r.L = dv / max(dist, 1e-6); r.dist = dist;
  let delta = -b;
  let Dl = max(sqrt(max(oc2 - b * b, li.radius * li.radius)), 1e-3);   // (≥ the radius, and never 0 for a radius-0 light dead on the ray: the atan form below would be inf/NaN — and NaN is for ever in a history)
  let meanInv = (atan((tB - delta) / Dl) - atan((tA - delta) / Dl)) / (Dl * max(d1 - d0, 1e-3));
  var att = lightWindow(dist, li.range) * meanInv;
  if (kind == 1u) { att *= smoothstep(li.cosOuter, li.cosInner, max(dot(-r.L, li.dir), li.cosOuter)); }
  else if (kind == 3u) { att *= max(dot(-r.L, li.dir), 0.0); }
  if (att <= 0.0) { return r; }
  let fogK = lightFogK(li, X, vec3f(0.0)); if (fogK <= 0.002) { return r; }   // the fog of war's light classes (common.wgsl): no beam in the air over floor nobody sees from a light the team has no look at
  r.E = li.color * (att * fogK); r.ok = true;
  return r;
}

// The froxel is a decimetre or two ACROSS and the beam near a torch head is narrower than that: one ray through the froxel either threads the cone or misses it,
// and neighbouring froxels then come out lit / dark in blocks the trilinear fetch shows as stair-steps. So each froxel sends FSUB sub-rays across itself (2 × 2
// strata, jittered with the frame) and takes the MEAN of their analytic estimates — the froxel's footprint average, which is what a pixel inside it should read —
// while the shadow ray (the dear part) still leaves from ONE of them: the frame's pick if the light reaches it, else the first it does reach.
const FSUB: u32 = 4u;
struct FroxEval { E: vec3f, sub: u32, ok: bool };
fn evalLightSub(li: Light, dirs: array<vec3f, FSUB>, d0: f32, d1: f32, jz: f32, pick: u32) -> FroxEval {
  var r: FroxEval; r.E = vec3f(0.0); r.sub = FSUB; r.ok = false;
  for (var s = 0u; s < FSUB; s++) {
    let e = evalLightFroxel(li, dirs[s], d0, d1, jz);
    if (!e.ok) { continue; }
    r.E += e.E; r.ok = true;
    if (s == pick || r.sub == FSUB) { r.sub = s; }
  }
  r.E *= 1.0 / f32(FSUB);
  return r;
}

/** ONE shadow-rayed sample of light `li` on sub-ray `sd` at depth jitter `jz` of the froxel [d0, d1]: xyz = visibility × smoke transmittance toward the light × the haze
 *  phase (what multiplies the light's mean irradiance), w = 1 if the point saw the light else 0. The sun / a stroke: the building's dust only where a roof stands over the
 *  point (open sky = clear air — volumetrics.wgsl's rule), then the long ray up-sun; a local light: the shadow ray stops short of the emitter, and its own carrier never shadows it. */
fn hazeShadowed(li: Light, kind: u32, sd: vec3f, d0: f32, d1: f32, jz: f32, smokeShadows: bool) -> vec4f {
  let ev = evalLightFroxel(li, sd, d0, d1, jz);                          // this sample's point inside the lit chord, its direction to the light
  let Xs = frame.camPos + sd * ev.t;
  var vis: bool;
  if (kind == 2u) {
    if (WX_VOL) { if (WX_KINDS) { if (frame.cardCfg.w != 0u) { return vec4f(0.0); } } }   // (a weather is in: the sun in the air — the building's haze with it — is the 2D pass's, volumetrics.wgsl wxAirMarch)
    vis = Xs.y < CEIL_Y && occluded(Xs, vec3f(0.0, 1.0, 0.0), CEIL_Y + 0.5 - Xs.y, 0u) && !occluded(Xs, ev.L, 80.0, 0u);
  }
  else { vis = !occluded(Xs, ev.L, ev.dist - li.radius - 0.02, (li.owner & 0xffu) << 8u); }
  if (!vis) { return vec4f(0.0); }
  var st = 1.0;                                                           // smoke between here and the light (the beam dims beyond a plume): the masked few-tap estimate over the live domains the segment crosses (1 at once when it crosses none)
  if (smokeShadows) { st = smokeTransCoarse(Xs, ev.L, min(ev.dist, 6.0)); }
  return vec4f(vec3f(st * phaseHG(dot(sd, ev.L), 0.45)), 1.0);
}

@compute @workgroup_size(8, 8, 1)
fn inject(@builtin(global_invocation_id) gid: vec3u) {
  let G = frame.froxelB.xyz;
  if (any(gid >= G)) { return; }
  let cl = textureLoad(clustersR, gid / vec3u(FTILE, FTILE, FCHUNK), 0);
  let smOn = cl.z & 0xffu; let smNear = (cl.z >> 8u) & 0xffu;
  let K = min(frame.froxelB.w & 255u, FK_MAX);
  let gf = vec3f(gid);
  let d0 = froxelDist(gf.z); let d1 = froxelDist(gf.z + 1.0);
  let hazeOn = (frame.flags & FLAG_VOLUMETRICS) != 0u && frame.hazeDensity > 0.0;
  let smokeShadows = frame.numSmoke > 0u && (frame.flags & FLAG_SMOKE_SHADOWS) != 0u;

  // ---- HAZE: four jittered sub-rays across the froxel, one jittered depth; the k strongest lights here shadow-rayed → raw in-scatter per metre ----
  var L = vec3f(0.0);
  let j = fract(frame.froxelC.xyz + vec3f(hash13(gf + 3.1), hash13(gf.yzx + 17.3), hash13(gf.zxy + 41.7)));   // the frame's jitter, scrambled per froxel so neighbours never sample in lock-step
  var dirs: array<vec3f, FSUB>;
  for (var s = 0u; s < FSUB; s++) { dirs[s] = froxelDir((gf.xy + (vec2f(f32(s & 1u), f32(s >> 1u)) + j.xy) * 0.5) / vec2f(G.xy)); }
  let pick = u32(hash13(gf + frame.froxelC.xyz * 31.0) * 4.0) & 3u;   // the sub-ray the shadow rays prefer to leave from this frame
  let dir = dirs[pick];
  let X = frame.camPos + dir * mix(d0, d1, j.z);
  if (hazeOn && K > 0u && X.y > WORLD_MIN.y - 0.25) {                  // (under the ground nothing scatters anything anyone can see)
    var bi: array<u32, FK_MAX>; var bs: array<f32, FK_MAX>; var bE: array<vec4f, FK_MAX>; var nb = 0u;   // slot: light, score, (mean E, the sub-ray to shadow from)
    for (var w = 0u; w < 2u; w++) {
      var m = select(cl.y, cl.x, w == 0u);
      while (m != 0u) {
        let i = w * 32u + countTrailingZeros(m); m &= m - 1u;
        if (i >= frame.numLights) { continue; }
        let li = lights[i];
        if (li.volumetric <= 0.0 || lightTransient(li) || !lightReaches(i, X)) { continue; }   // no beam from this one / a transient (injectJ draws those outside the history) / walled off from this cell (reach.ts)
        if (WX_VOL) { if (WX_KINDS) { if (frame.cardCfg.w != 0u && lightKind(li) == 2u) { continue; } } }   // (… or the sun under a weather: the 2D pass's — it takes no slot of the K kept here)
        let fe = evalLightSub(li, dirs, d0, d1, j.z, pick);
        if (!fe.ok) { continue; }
        let mc = max3(fe.E);
        if (mc < HAZE_MIN_E) { continue; }
        let Ld = select(normalize(li.pos - X), -li.dir, lightKind(li) == 2u);
        let score = mc * li.volumetric * phaseHG(dot(dir, Ld), 0.45);   // its unshadowed in-scatter here
        let pe = vec4f(fe.E, f32(fe.sub));
        if (nb < K) { var p = nb; while (p > 0u && bs[p - 1u] < score) { bs[p] = bs[p - 1u]; bi[p] = bi[p - 1u]; bE[p] = bE[p - 1u]; p--; } bs[p] = score; bi[p] = i; bE[p] = pe; nb++; }
        else if (score > bs[K - 1u]) { var p = K - 1u; while (p > 0u && bs[p - 1u] < score) { bs[p] = bs[p - 1u]; bi[p] = bi[p - 1u]; bE[p] = bE[p - 1u]; p--; } bs[p] = score; bi[p] = i; bE[p] = pe; }
      }
    }
    let strata = ((frame.froxelB.w >> 9u) & 3u) + 1u;                    // the STRONGEST light gets N shadow rays at N equal-weight depth strata of its lit chord (settings.froxelTopRays, ultra 3 · high / medium 2): a sheet of light thinner than a slice — a beam skimming a partition top — is hit-or-miss for one ray a frame, and that variance is what the history cannot hide; N strata are unbiased and cut its amplitude to 1/N
    for (var q = 0u; q < nb; q++) {                                     // shadow rays for the kept: `strata` for the strongest, one each for the rest
      let i = bi[q]; let li = lights[i]; let kind = lightKind(li);
      let sd = dirs[u32(bE[q].w)];
      let n = select(1u, strata, q == 0u);
      var f = vec3f(0.0);
      for (var r = 0u; r < n; r++) { f += hazeShadowed(li, kind, sd, d0, d1, (j.z + f32(r)) / f32(n), smokeShadows).xyz; }   // (stratum r covers [r/n, (r+1)/n) of the chord as j.z sweeps: the mean of the SHADOW × transmittance × phase term is the chord's exactly, in expectation; E (bE, the analytic chord mean) multiplies it as if flat along the chord — each stratum re-derives t / L on the chord through evalLightFroxel, cheap next to its ray)
      L += bE[q].xyz * (f * (li.volumetric / f32(n)));
    }
    if (any(L > vec3f(0.0))) { L *= frame.hazeDensity * hazeAt(X); }   // (the dust's density once, for all of them)
  }
  let bad = any(L != L);                                                // (a NaN never enters the volume: the history's clamp / mix would carry it for ever — tested BEFORE the min below, which drops a NaN operand on this backend and would turn it into the cap)
  textureStore(volOut, gid, select(vec4f(min(L, vec3f(6.0e4)), 0.0), vec4f(0.0), bad));   // (and capped below f16's range: an inf never enters either)
}

// ---------------------------------------------------------------- injectJ (the smoke's light field, on the J grid: half the froxel grid across, the same slices)
// The march fetches J trilinearly at points INSIDE a live domain holding density, so J must stand at every J-texel within one texel of such a point: the
// texel's centre ± 1.5 slices along the ray, ± 3 froxel widths across, against the live domain boxes (exact reject; the cluster masks only say 'near').
// J has no jitter and no history: every texel is rebuilt every frame (a checkerboard refresh was tried and dropped — under a moving camera the stale half
// belongs to froxels that have slid elsewhere in the world, and a plume came out hatched at slice pitch). Two texel conventions share this half-res grid:
// J texel i looks down froxelDir((i + ½)/GJ) (its own texel centre — the march samples it with plain screen uv), the TRANSIENT texel i is the mean of main
// froxels 2i, 2i+1 (integrate samples it at (c + ½)/(2·GJ) for main column c); for odd W or H the two differ by half a texel at the far edge, each
// consumer matching its producer.
@compute @workgroup_size(8, 8, 1)
fn injectJ(@builtin(global_invocation_id) gid: vec3u) {
  let GJ = textureDimensions(smokeJOut);
  if (any(gid >= GJ)) { return; }
  let G = frame.froxelB.xyz;
  let fx = min(gid.xy * 2u, G.xy - 1u);                                 // the main-grid froxel this texel's centre sits in (its cluster holds the masks)
  let cl = textureLoad(clustersR, vec3u(fx, gid.z) / vec3u(FTILE, FTILE, FCHUNK), 0);
  let smOn = cl.z & 0xffu; let smNear = (cl.z >> 8u) & 0xffu;
  let smokeShadows = frame.numSmoke > 0u && (frame.flags & FLAG_SMOKE_SHADOWS) != 0u;
  // ---- TRANSIENT haze (a muzzle flash lives a frame or three: it must light the haze at once and leave nothing, so it never enters the accumulated volume —
  // evaluated here at the texel's four froxel centres and the chord midpoint, un-jittered (smooth, no history needed), one shadow ray each; integrate adds it) ----
  if (frame.rcJitter.w > 0.5) {
    var Lt = vec3f(0.0);
    if ((frame.flags & FLAG_VOLUMETRICS) != 0u && frame.hazeDensity > 0.0) {
      let gz = f32(gid.z); let d0 = froxelDist(gz); let d1 = froxelDist(gz + 1.0);
      var dirs: array<vec3f, FSUB>;
      for (var sb = 0u; sb < FSUB; sb++) { dirs[sb] = froxelDir((vec2f(fx) + vec2f(f32(sb & 1u), f32(sb >> 1u)) + 0.5) / vec2f(G.xy)); }
      let Xm = frame.camPos + dirs[0] * mix(d0, d1, 0.5);
      for (var w = 0u; w < 2u; w++) {
        var m = select(cl.y, cl.x, w == 0u);
        while (m != 0u) {
          let i = w * 32u + countTrailingZeros(m); m &= m - 1u;
          if (i >= frame.numLights) { continue; }
          let li = lights[i];
          if (!lightTransient(li) || li.volumetric <= 0.0 || !lightReaches(i, Xm)) { continue; }
          let fe = evalLightSub(li, dirs, d0, d1, 0.5, 0u);
          if (!fe.ok || max3(fe.E) < HAZE_MIN_E) { continue; }
          let sd = dirs[min(fe.sub, FSUB - 1u)];
          Lt += fe.E * (hazeShadowed(li, lightKind(li), sd, d0, d1, 0.5, smokeShadows).xyz * li.volumetric);   // one shadow ray from the chord midpoint × the smoke's transmittance toward it × phase (a stroke: under a roof only, like the sun)
        }
      }
      if (any(Lt > vec3f(0.0))) { Lt *= frame.hazeDensity * hazeAt(Xm); }
    }
    textureStore(transOut, gid, vec4f(Lt, 0.0));
  }
  if ((smOn | smNear) == 0u) { textureStore(smokeJOut, gid, vec4f(0.0)); return; }
  // (every texel every frame: J has no history to reproject through, and refreshing a checkerboard half per frame — tried, −30 % of this kernel — hatches a plume
  // at slice pitch the moment the camera moves, because the stale half then belongs to froxels that have slid to other places in the world)
  let K = min(frame.froxelB.w & 255u, FK_MAX);
  if (K == 0u) { textureStore(smokeJOut, gid, vec4f(diceMeanRadianceWalled(frame.camPos + froxelDir((vec2f(gid.xy) + 0.5) / vec2f(GJ.xy)) * froxelDist(f32(gid.z) + 0.5)), 1.0)); return; }   // (ambient-lit smoke only)
  let gz = f32(gid.z);
  let d0 = froxelDist(gz); let d1 = froxelDist(gz + 1.0); let dc = froxelDist(gz + 0.5);
  let dirC = froxelDir((vec2f(gid.xy) + 0.5) / vec2f(GJ.xy));
  let Xc = frame.camPos + dirC * dc;
  var J = vec4f(0.0);
  let dSl = 1.5 * (d1 - d0); let fw = 3.0 * dc * 2.0 * frame.post.w / f32(G.y);   // 1.5 slices along the ray; three froxel widths across at this distance (post.w = tan(fov/2))
  let A = Xc - dirC * dSl; let B = Xc + dirC * dSl;
  let jm = smokeDomainsNear(min(A, B) - vec3f(fw), max(A, B) + vec3f(fw), 0.0);
  if (jm != 0u) {
    var Js = diceMeanRadianceWalled(Xc);                                // ambient: the cache's mean radiance, never interpolated through a wall
    var bi: array<u32, FK_MAX>; var bs: array<f32, FK_MAX>; var nb = 0u;
    let nw = select(2u, 0u, smokeMarchLights() > 0u);                   // (vol_common.wgsl) the march lights the lights per step itself: J carries the ambient ALONE then — no light loop at all
    for (var w = 0u; w < nw; w++) {
      var m = select(cl.y, cl.x, w == 0u);
      while (m != 0u) {
        let i = w * 32u + countTrailingZeros(m); m &= m - 1u;
        if (i >= frame.numLights) { continue; }
        if (!lightReaches(i, Xc)) { continue; }
        let ev = evalLight(lights[i], Xc, vec3f(0.0));
        if (!ev.ok) { continue; }
        let score = max3(ev.E);
        if (score < SMOKE_MIN_E) { continue; }                            // below this a light adds nothing you can see in smoke (the march's own floor)
        if (nb < K) { var p = nb; while (p > 0u && bs[p - 1u] < score) { bs[p] = bs[p - 1u]; bi[p] = bi[p - 1u]; p--; } bs[p] = score; bi[p] = i; nb++; }
        else if (score > bs[K - 1u]) { var p = K - 1u; while (p > 0u && bs[p - 1u] < score) { bs[p] = bs[p - 1u]; bi[p] = bi[p - 1u]; p--; } bs[p] = score; bi[p] = i; }
      }
    }
    for (var q = 0u; q < nb; q++) {
      let li = lights[bi[q]]; let kind = lightKind(li);
      let ev = evalLight(li, Xc, vec3f(0.0));
      // visibility: one ray from the centre for a local light (its shadow boundaries inside a plume are small and the smooth self-shadow term dominates — no
      // terrace showed at night), the mean over 4 depth strata of the texel for the SUN: J is un-jittered, and one centre ray made the sunlit slab under a
      // window a terrace of whole slices through the breach's daytime plume; strata turn each step into a ramp (docs/shots/p2b_sun3-plume-sheet.png)
      let ns = select(1u, 4u, kind == 2u);
      var vis = 0.0;
      for (var r = 0u; r < ns; r++) {
        let Xr = frame.camPos + dirC * mix(d0, d1, (f32(r) + 0.5) / f32(ns));
        var Lr = ev.L; var tr = 80.0;
        if (kind != 2u) { let dv = li.pos - Xr; let dl = length(dv); Lr = dv / max(dl, 1e-6); tr = dl - li.radius - 0.02; }
        if (!occluded(Xr, Lr, tr, (li.owner & 0xffu) << 8u)) { vis += 1.0; }   // the light's own carrier never shadows it
      }
      if (vis <= 0.0) { continue; }
      Js += ev.E * ((vis / f32(ns)) * phaseHG(dot(dirC, ev.L), 0.35) * smokeSelfShadowIn(Xc, ev.L, jm | smNear));
    }
    J = vec4f(Js, 1.0);
  }
  textureStore(smokeJOut, gid, J);
}

// ---------------------------------------------------------------- temporal
const FX_CLAMP_UP: f32 = 0.15;   // head-room above the neighbourhood box, × its max (see below)
const FX_MOVED_K: f32 = 0.8;     // how far a clamped (= wrong) history hands the froxel to this frame's estimate
@compute @workgroup_size(8, 8, 1)
fn temporal(@builtin(global_invocation_id) gid: vec3u) {
  let G = frame.froxelB.xyz;
  if (any(gid >= G)) { return; }
  let raw = textureLoad(rawR, gid, 0);
  var res = raw;
  let hw = frame.froxelA.w;
  if (hw > 0.0) {
    let Xc = frame.camPos + froxelDir((vec2f(gid.xy) + 0.5) / vec2f(G.xy)) * froxelDist(f32(gid.z) + 0.5);   // the froxel's centre, where last frame's grid saw it
    let pc = frame.prevViewProj * vec4f(Xc, 1.0);
    if (pc.w > 1e-3) {
      let puv = pc.xy / pc.w * vec2f(0.5, -0.5) + 0.5;
      let ps = froxelSlicePrev(distance(Xc, frame.prevCam.xyz));
      if (all(puv >= vec2f(0.0)) && all(puv <= vec2f(1.0)) && ps >= 0.0 && ps <= f32(G.z)) {
        var hist = textureSampleLevel(histR, linSamp, vec3f(puv, ps / f32(G.z)), 0.0);
        var mn = raw; var mx = raw;
        let g = vec3i(gid); let gm = vec3i(G) - 1;
        for (var a = 0; a < 4; a++) { var p = g; let ax = a >> 1; p[ax] = clamp(p[ax] + select(-1, 1, (a & 1) == 1), 0, gm[ax]); let v = textureLoad(rawR, vec3u(p), 0); mn = min(mn, v); mx = max(mx, v); }   // the four neighbours ACROSS only: a beam is a slice or two thick, so its depth neighbours are dark air — with them in the box a dark history passed for plausible everywhere inside a beam that had just swept in, and its far end (five froxels a frame) never filled in
        let pad = (mx - mn) * 0.25 + vec4f(1e-5);   // (a quarter of the local range either side)
        // + 15 % head-room above the box: the froxel's own raw sample sets the ceiling most frames inside a beam's bright core (its four neighbours across are darker air),
        // so a history clamped to ≤ raw-now whenever raw-now dips, and never lifted when it peaks, drifted DOWN — the beam body's −7 % against the march (p2b §3.3); with the
        // head-room the still beam reads +1 % nearer the march and a beam that has just LEFT a froxel is still emptied within the frame (its ceiling is the dark air's max)
        let histC = clamp(hist, mn - pad, mx + pad + FX_CLAMP_UP * mx);
        // where the history had to be clamped it was wrong (the beam has just arrived here, or just left): lean on this frame's estimate — up to half the weight — so a
        // sweeping beam reaches its brightness in three frames instead of ten (its old froxels are already dark: their box has no room above zero)
        let moved = clamp(2.0 * luminance(abs(histC.xyz - hist.xyz)) / max(luminance(max(raw.xyz, hist.xyz)), 1e-4), 0.0, 1.0);
        res = mix(raw, histC, hw * (1.0 - FX_MOVED_K * moved));   // (0.5 → 0.8, 08-11: a torch swept at 180°/s trailed the march by 1–2 frames at 0.5 and reads half a frame nearer at 0.8 — docs/internal/tjank.md §C; nothing static changes, `moved` is 0 there)
      }
    }
  }
  textureStore(histOut, gid, res);
}

// ---------------------------------------------------------------- integrate
@compute @workgroup_size(8, 8, 1)
fn integrate(@builtin(global_invocation_id) gid: vec3u) {
  let G = frame.froxelB.xyz;
  if (gid.x >= G.x || gid.y >= G.y) { return; }
  var S = vec3f(0.0); var T = 1.0;
  var dA = froxelDist(0.0);
  let withTrans = frame.rcJitter.w > 0.5;                               // transient lights alive this frame: their un-accumulated haze (injectJ, half-res) joins each slice
  let uvT = (vec2f(gid.xy) + 0.5) / (2.0 * vec2f(textureDimensions(transR).xy));   // (the half-res grid's own extent: ⌈W/2⌉·2 columns, which is W + 1 when W is odd — uv over G would drift a froxel at the far edge)
  for (var k = 0u; k < G.z; k++) {
    var v = textureLoad(histR, vec3u(gid.xy, k), 0);
    if (withTrans) { v += vec4f(textureSampleLevel(transR, linSamp, vec3f(uvT, (f32(k) + 0.5) / f32(G.z)), 0.0).xyz, 0.0); }
    let dB = froxelDist(f32(k + 1u));
    let len = dB - dA;
    let sig = max(v.a, 0.0);
    let stepT = exp(-sig * len);
    S += T * select(v.rgb * len, v.rgb * ((1.0 - stepT) / max(sig, 1e-6)), sig > 1e-5);   // energy-conserving over the slice (→ L·Δ in clear air)
    T *= stepT;
    textureStore(volOut, vec3u(gid.xy, k), vec4f(clamp(S, vec3f(0.0), vec3f(6.0e4)), T));   // (inside f16's range either way: a capped froxel × a 2 m far slice must not become an inf here)
    dA = dB;
  }
}
