// Ray-traced reflections + the analytic highlights of the ONE BRDF (renderer v3 phase 4; docs/internal/p4-materials.md). One thread per texel of the
// reflection target (internal res ÷ frame.rtCfg.w). For the surface under the pixel (characters keep their own wet coat, composite.wgsl wetCoatSpec):
// read its material from the g-buffer (gMat: GGX roughness + metalness after the detail layer; the box's anisotropy bit from boxFinish), skip it if rougher
// than rtCfg.x, else
//   1. sample a GGX half-vector from the distribution of VISIBLE normals (Heitz 2018) for the view direction and the roughness — anisotropic on the wet lot:
//      the lobe stretched along the view's projection on the ground so a lamp draws a long streak instead of a disc — on a per-pixel R2 sequence stepped by
//      the frame, reflect the view about it, and trace that ray through the box grid + capsules exactly as a gather ray (rtCfg.y rays; 0 = none);
//   2. shade the hit with the same BRDF's diffuse lobe: an emissive fixture (lit panel, exit sign, monitor, vending front — area-lit or not: a mirror shows the
//      fixture itself) returns its radiance; anything else albedo/π × (the direct light there — the exact on-screen textures when the point is visible, else
//      one shadow ray on an importance-picked light: gather_common.wgsl directAtPoint — + the radiance cache's bounce); a miss takes the sky (+ a stroke's lit
//      sky); a glass pane crossed on the way tints what lies beyond and adds the sky / cache it mirrors × its Fresnel. (Secondary hits are diffuse-only by
//      decision: the specular lobe's transport at a second vertex is one more narrow lobe found by one ray — variance the cache cannot settle — for a term worth
//      a few per cent of a dielectric's outgoing light; metals bounce their F0 as albedo, which is what the level authors as their paint.)
//   3. weight it by the VNDF estimator F(v·h) · G2/G1 (Schlick on F0 = 0.04, or the albedo for a metal — mixed by metalness; height-correlated Smith), average;
//   4. add the ANALYTIC image of the emitters (rtGlints) — the primary-hit specular response to the level's lights through the same GGX D · Smith G · Schlick F:
//      every steady point / spot light's lens (no ray can find those: NoShadow glow cards or no geometry) and, on finishes too rough to trace it cleanly, each
//      area-lit panel's kind-3 light, all widened by the emitter's angular size, the four strongest shadow-rayed (+ smoke) — noise-free, so a walking guard's
//      torch glides in the lino as an elongated highlight and the sodium lamp stands in the wet asphalt as a still streak;
// and store outgoing radiance (BRDF applied) + the first ray's hit distance in alpha (RT_TMAX on a miss, the strongest highlight's distance with no rays,
// −1 = no reflection at this texel: matte, character, sky), which the shared denoiser's specular client (denoise.wgsl, per-pixel roughness) reprojects the
// mirror image by and sizes its blur by. Composite adds the filtered result × the cutoff fade.
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var gId: texture_2d<u32>;
@group(1) @binding(3) var directTex: texture_2d<f32>;    // denoised on-screen direct, both classes (directAtPoint reuses them at visible hits)
@group(1) @binding(4) var softTex: texture_2d<f32>;
@group(1) @binding(5) var diceTex: texture_3d<f32>;
@group(1) @binding(6) var outRefl: texture_storage_2d<rgba16float, write>;   // rgb = outgoing specular radiance toward the eye, a = hit distance of ray 0 (RT_TMAX on a miss, −1 = no term)
@group(1) @binding(7) var gAlbedo: texture_2d<f32>;      // the g-buffer's base colour (after the detail layer + decals): F0 of a metal
@group(1) @binding(8) var gMat: texture_2d<f32>;         // (roughness, metalness) per pixel — gbuffer.wgsl

const RT_TMAX: f32 = 48.0;
const RT_SPILL: f32 = 0.005;        // a spot's lens seen from outside its beam still shows this fraction of its on-axis intensity (reflector scatter): a level torch is a dot in the floor
const RT_GLINT_MAX: f32 = 160.0;    // luminance bound on the analytic glints (stable, so allowed to read as white — a torch lens is thousands)
const RT_GLINT_RAYS: u32 = 4u;      // shadow rays for the strongest glint candidates; the rest are credited at half, unshadowed (off the lobe by construction: D has made them small)
const PI: f32 = 3.14159265;

fn pow5(x: f32) -> f32 { let x2 = x * x; return x2 * x2 * x; }
/** Smith Λ for GGX with anisotropic roughness (ax along the tangent frame's x, ay along y) for a unit direction s given IN that frame (z = the normal) */
fn smithLambda(s: vec3f, ax: f32, ay: f32) -> f32 {
  let sz2 = max(s.z * s.z, 1e-6);
  let a2 = (ax * ax * s.x * s.x + ay * ay * s.y * s.y) / sz2;
  return 0.5 * (sqrt(1.0 + a2) - 1.0);
}
/** anisotropic GGX NDF for a half vector h in the tangent frame */
fn ggxD(h: vec3f, ax: f32, ay: f32) -> f32 {
  let e = (h.x * h.x) / (ax * ax) + (h.y * h.y) / (ay * ay) + h.z * h.z;
  return 1.0 / (PI * ax * ay * e * e);
}
/** Heitz 2018, "Sampling the GGX Distribution of Visible Normals": a half vector distributed as D_v(h) = G1(v) max(0, v·h) D(h) / v·z for the view
 *  direction Ve (tangent frame, z up, pointing AWAY from the surface) and roughness (ax, ay), from two uniforms. Every sample is a normal the eye can
 *  see, so at 1 ray/pixel nothing is wasted on back-facing microfacets; the reflected direction can still dip under the horizon for rough finishes at
 *  grazing views (the caller falls back to the mirror direction then). tools/qa/rtreflect-probes.ts holds a TS port to the same numbers. */
fn sampleGGXVNDF(Ve: vec3f, ax: f32, ay: f32, u1: f32, u2: f32) -> vec3f {
  let Vh = normalize(vec3f(ax * Ve.x, ay * Ve.y, Ve.z));                 // to the hemisphere configuration
  let lensq = Vh.x * Vh.x + Vh.y * Vh.y;
  var T1 = vec3f(1.0, 0.0, 0.0);
  if (lensq > 1e-8) { T1 = vec3f(-Vh.y, Vh.x, 0.0) * inverseSqrt(lensq); }
  let T2 = cross(Vh, T1);
  let r = sqrt(u1); let phi = 2.0 * PI * u2;
  let t1 = r * cos(phi); var t2 = r * sin(phi);
  let s = 0.5 * (1.0 + Vh.z);
  t2 = (1.0 - s) * sqrt(max(1.0 - t1 * t1, 0.0)) + s * t2;             // reproject onto the half disc the view sees
  let Nh = t1 * T1 + t2 * T2 + sqrt(max(1.0 - t1 * t1 - t2 * t2, 0.0)) * Vh;
  return normalize(vec3f(ax * Nh.x, ay * Nh.y, max(Nh.z, 0.0)));       // back to the ellipsoid configuration
}

/** How much of an AREA-LIT fixture's radiance the traced ray takes when it lands on one, by the RECEIVER's roughness — the rest comes from rtGlints'
 *  analytic image of the same fixture (its kind-3 light), so the two always sum to one panel: a polish (stone, screens, glassy metal) traces it and gets the
 *  panel's true rectangle, hard-edged where the lobe can resolve it; a rough finish (lino, tile) takes it analytically — the lobe has already blurred the
 *  shape past recognition there, and one ray in the GGX tail finding a 6 W/m²/sr panel is exactly the outlier that mottles a soft reflection. */
fn emitTraceK(rough: f32) -> f32 { return 1.0 - smoothstep(0.2, 0.3, rough); }

/** What the reflected ray brings back from where it went: sky (+ the stroke-lit sky) on a miss; the fixture's own radiance if it is emissive (area-lit
 *  ones × kEmit, see emitTraceK — the diffuse paths take those through their analytic light entirely, a mirror shows the panel itself); albedo/π ×
 *  (direct + bounce) otherwise; through any glass pane on the segment: tinted, plus what the pane itself mirrors (the sky / the cache) × its Fresnel.
 *  Bounded per ray by matCfg.z (luminance). */
fn shadeReflHit(hit: Hit, Po: vec3f, dir: vec3f, kEmit: f32) -> vec3f {
  var L = vec3f(0.0);
  var segT = RT_TMAX;
  if (hit.idx < 0) {
    L = skyRadiance(dir) + frame.weatherB.xyz;                            // (weatherB.rgb = what a lightning stroke's lit sky adds this frame; 0 otherwise)
  } else if (!hit.inside) {
    segT = hit.t;
    let Ph = Po + dir * hit.t;
    var albedo: vec3f;
    if (hit.idx == CAPSULE_HIT) { albedo = hit.capAlbedo; }
    else {
      let bi = u32(hit.idx);
      let bf = boxGeo[bi].flags;
      if ((bf & BOX_EMISSIVE) != 0u) { L += boxEmissive(bi) * select(1.0, kEmit, (bf & BOX_AREALIT) != 0u); }
      albedo = boxAlbedoSec(bi);                                          // (= boxAlbedo unless the box's markings are folded in for the secondary rays)
      let ms = markSlotOf(bf);                                            // MARKINGS at the reflection hit (markings.wgsl): the face's pixel art band-limited by the cone, + its emission
      if (ms != 0u && frame.markCfg.w != 0.0) { let mh = markReflHit(ms, bi, Ph, hit.n, dir, hit.t, kEmit, boxAlbedo(bi)); albedo = mh.albedo; L += mh.L; }
    }
    var Eh = vec3f(0.0);
    if ((frame.flags & FLAG_DIRECT) != 0u) { Eh += directAtPoint(Ph, hit.n, 0u); }
    if ((frame.flags & FLAG_BOUNCE) != 0u) { Eh += diceIrradiance(Ph + hit.n * c0Spacing(), hit.n); }
    L += albedo * Eh * (1.0 / PI);
  } else { segT = 0.0; }
  if (glassCount() > 0u) {                                                // panes on the reflected segment: tint what lies beyond, add what the nearest mirrors
    let gh = glassTrace(Po, dir, 0.01, segT);
    if (gh.idx >= 0) {
      let cosI = clamp(dot(-dir, gh.n), 0.0, 1.0);
      let Fg = glassFresnel(cosI) * min(frame.glassCfg.x, 1.0);
      let Rg = dir - gh.n * (2.0 * dot(dir, gh.n));
      let Pg = Po + dir * gh.t;
      var env = skyRadiance(Rg);
      if ((frame.flags & FLAG_BOUNCE) != 0u && Rg.y < 0.25) { env = diceMeanRadiance(Pg + Rg * 0.6); }   // a pane mirroring back into the building: the cache's mean radiance a step along the mirrored ray; up and out: the sky
      L = L * gh.trans * (1.0 - Fg) + env * Fg;
    }
  }
  let lum = luminance(L); let cap = frame.matCfg.z;
  return select(L, L * (cap / lum), cap > 0.0 && lum > cap);
}

// The analytic image of the emitters = the finish's specular response to the level's lights at the primary hit (see the header): GGX specular from each
// steady light that reaches this cell — point / spot lenses always (no ray can find them), the area-lit fixtures' kind-3 lights × kAna = 1 − emitTraceK (the
// share the traced ray does not take) — widened by the emitter's angular size (alpha' = alpha + half its angular radius per axis — the widened D is still
// normalised, no extra factor), Schlick F, height-correlated Smith; the RT_GLINT_RAYS strongest by luminance get a shadow ray (their carrier never hides
// them: the light's owner byte in the skip word) and the smoke on the segment, the rest — off the lobe, where D has already made them small, and reach-masked
// — are credited at half, unshadowed (the dust glow's rule). The moon stays the sky's. Returns radiance in .xyz and the strongest highlight's distance in .w
// (0 = none) — the virtual depth the denoiser reprojects a highlight by when no ray was traced.
struct Glint { L: vec3f, spec: vec3f, dist: f32, w: f32, i: i32 };
fn rtGlints(P: vec3f, Po: vec3f, N: vec3f, V: vec3f, T: vec3f, B: vec3f, ax: f32, ay: f32, F0: vec3f, owner: u32, kAna: f32) -> vec4f {
  var g0: Glint; var g1: Glint; var g2: Glint; var g3: Glint; g0.w = 0.0; g1.w = 0.0; g2.w = 0.0; g3.w = 0.0; g0.i = -1; g1.i = -1; g2.i = -1; g3.i = -1;
  var rest = vec3f(0.0);
  let Ve = vec3f(dot(V, T), dot(V, B), dot(V, N));
  let NdotV = max(Ve.z, 0.05);
  let lamV = smithLambda(vec3f(Ve.x, Ve.y, NdotV), ax, ay);
  for (var i = 0u; i < nL; i++) {
    let li = wgLights[i];
    let kind = lightKind(li);
    if (kind == 2u || li.radius <= 0.0 || lightTransient(li)) { continue; }
    if (kind == 3u && kAna <= 0.0) { continue; }                          // area-lit fixtures: only the share the traced ray leaves (none on a polish)
    if (!lightReaches(i, P)) { continue; }
    let d = li.pos - P; let dist2 = dot(d, d); let dist = sqrt(dist2);
    if (dist > li.range || dist < 0.05) { continue; }
    let Ld = d / dist;
    let NdotL = dot(N, Ld);
    if (NdotL <= 0.0) { continue; }
    var att = lightWindow(dist, li.range) / max(dist2, li.radius * li.radius);
    var wid = li.radius / (2.0 * max(dist, 0.05));                        // the emitter's angular half-size (a lens: Karis' sphere term)
    var pat = vec3f(1.0);                                                  // × the emitter's own texture (kind-3 marking lights only)
    if (kind == 1u) {
      let cd = dot(-Ld, normalize(li.dir));
      if (cd <= 0.0) { continue; }                                        // behind the lens
      att *= max(smoothstep(li.cosOuter, li.cosInner, cd), RT_SPILL);
    } else if (kind == 3u) {
      let ce = dot(-Ld, li.dir);                                          // one-sided Lambertian panel: dark from behind (as evalLight)
      if (ce <= 0.0) { continue; }
      att *= ce * kAna;                                                   // (wid stays r / 2d: against a quadrature over a 1.2 × 0.6 panel — tools/qa/rtreflect-probes.ts — the centre direction through a lobe widened by half the disc's angular radius tracks the true integral within ~20 % at the peak for rough 0.3‥0.45; the full radius, or Karis' (α/α')² renormalisation, lands 3-4× too dim)
      let mref = lightMarkRef(li);                                        // a MARKING's light (the vending windows): texture the uniform analytic image with the window's own pattern at the mirror point (markings.wgsl)
      if (mref >= 0 && frame.markCfg.w > 0.0) { pat = markPatternAtMirror(u32(mref), li, Po, N, V, ax); }
    }
    let E = li.color * pat * (att * NdotL);
    let hw = Ld + V; if (dot(hw, hw) < 1e-8) { continue; }
    let Hw = hw * inverseSqrt(dot(hw, hw));
    let H = vec3f(dot(Hw, T), dot(Hw, B), dot(Hw, N));
    if (H.z <= 0.0) { continue; }
    let axp = clamp(ax + wid, ax, 1.0); let ayp = clamp(ay + wid, ay, 1.0);
    let D = ggxD(H, axp, ayp);                                            // the lobe convolved with the emitter's disc ≈ a lobe that much wider — D is normalised at any width, so no further factor (see the kind-3 note)
    let Lt = vec3f(dot(Ld, T), dot(Ld, B), NdotL);
    let lamL = smithLambda(Lt, axp, ayp);
    let Vis = 1.0 / (4.0 * NdotV * NdotL * (1.0 + lamV + lamL) + 1e-4);   // height-correlated Smith G2 / (4 n·v n·l)
    let Fr = F0 + (vec3f(1.0) - F0) * pow5(1.0 - clamp(dot(V, Hw), 0.0, 1.0));
    let spec = E * Fr * (D * Vis);
    let w = luminance(spec);
    if (w < 1e-5) { continue; }
    var g: Glint; g.L = Ld; g.spec = spec; g.dist = dist - li.radius - 0.02; g.w = w; g.i = i32(i);
    if (w > g0.w) { rest += g3.spec; g3 = g2; g2 = g1; g1 = g0; g0 = g; } else if (w > g1.w) { rest += g3.spec; g3 = g2; g2 = g1; g1 = g; } else if (w > g2.w) { rest += g3.spec; g3 = g2; g2 = g; } else if (w > g3.w) { rest += g3.spec; g3 = g; } else { rest += spec; }
  }
  var G = rest * 0.5;
  for (var k = 0u; k < RT_GLINT_RAYS; k++) {
    var g = g0; if (k == 1u) { g = g1; } else if (k == 2u) { g = g2; } else if (k == 3u) { g = g3; }
    if (g.i < 0) { continue; }
    let li = wgLights[u32(g.i)];
    if (g.dist > 0.0 && occluded(Po, g.L, g.dist, owner | ((li.owner & 0xffu) << 8u))) { continue; }
    var tr = 1.0;
    if (frame.numSmoke > 0u) { tr = smokeTransmittance(Po, g.L, min(max(g.dist, 0.0), 30.0)); }
    G += g.spec * tr;
  }
  let lg = luminance(G);
  return vec4f(select(G, G * (RT_GLINT_MAX / lg), lg > RT_GLINT_MAX), select(0.0, max(g0.dist, 0.05), g0.i >= 0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lidx: u32) {
  nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  nC = 0u;                                                                 // no bounce-card exclusion in a mirror image (directAtPoint's card loops stay empty)
  wgCardOf[lidx] = -1;
  workgroupBarrier();
  let odims = textureDimensions(outRefl);
  if (gid.x >= odims.x || gid.y >= odims.y) { return; }
  let none = vec4f(0.0, 0.0, 0.0, -1.0);
  let rdiv = max(u32(frame.rtCfg.w), 1u);
  let full = min(gid.xy * rdiv + (rdiv - 1u) / 2u, vec2u(frame.screen) - 1u);   // the full-res pixel this texel is computed at (its own at div 1; the top-left of its 2×2 at div 2, the centre of its 3×3 — as the gather picks its pixel)
  let depth = textureLoad(gDepth, full, 0);
  if (depth >= 1.0 || frame.rtCfg.w < 1.0) { textureStore(outRefl, gid.xy, none); return; }
  let id = textureLoad(gId, full, 0).x;
  let bidx = id & 0xFFFFFu;
  if (((id >> 28u) & 1u) != 0u || ((id >> 29u) & 1u) != 0u) { textureStore(outRefl, gid.xy, none); return; }   // a character (his coat is composite's) or a section cap
  let mat = textureLoad(gMat, full, 0);                                    // (roughness, metalness) as the g-buffer wrote them: the finish + the detail layer's wear
  let rough = mat.x; let metalness = mat.y;
  let maxR = frame.rtCfg.x;
  if (rough > maxR) { textureStore(outRefl, gid.xy, none); return; }
  var aniso = false;
  if (bidx != 0xFFFFFu) { aniso = boxFinish(bidx).aniso; }
  let P = worldFromDepth(vec2f(full) + 0.5, depth);
  let N = normalize(textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0);
  let toEye = frame.camPos - P; let z = length(toEye);
  let V = toEye / max(z, 1e-4);
  if (dot(N, V) <= 0.01) { textureStore(outRefl, gid.xy, none); return; }
  let owner = (id >> 20u) & 0xffu;
  // per-pixel Cranley-Patterson offsets for the lobe samples: WHITE over the screen (two draws of a pixel-seeded hash, the same every frame), stepped through
  // the frames by R2 below — every pixel stratifies its lobe over consecutive frames, and neighbours' errors stay uncorrelated so the à-trous can average
  // them away (an interleaved-gradient offset here drew its diagonal bands into 30-pixel blotches that the history then held on to)
  rngInit(gid.xy, 0x51f7u);
  let cpx = rnd(); let cpy = rnd();
  rngInit(gid.xy, frame.frameIdx ^ 0x9e37u);                              // directAtPoint's light pick draws from this (its own stream, not the gather's)
  // tangent frame: B along the view's projection onto the surface (the streak axis on wet ground), T across it
  var B: vec3f; var T: vec3f;
  let vpar = V - N * dot(V, N);
  if (dot(vpar, vpar) > 1e-6) { B = normalize(vpar); T = normalize(cross(B, N)); }
  else { let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9); T = normalize(cross(up, N)); B = cross(N, T); }
  let alpha = max(rough * rough, 0.0009);                                  // (α floored at 0.03²: a perfect mirror has no lobe to integrate and no use for the sampler)
  { let cpix = 2.0 * frame.post.w * frame.invScreen.y * f32(rdiv); mkConeFp0 = z * cpix; mkConePix = cpix; mkConeK = markConeK() * alpha; }   // the markings' ray cone at reflection hits (markings.wgsl markReflHit): this pixel's footprint, its growth per metre, + a small share of the lobe
  var ax = alpha; var ay = alpha;
  let an = frame.rtCfg.z;
  if (aniso && an > 0.0) { ax = alpha * (1.0 - 0.6 * an); ay = min(alpha * (1.0 + 5.0 * an), 1.0); }   // wet ground: tight across the view, long along it
  let Ve = vec3f(dot(V, T), dot(V, B), dot(V, N));
  let base = textureLoad(gAlbedo, full, 0).xyz;                            // base colour (a metal's F0; brighter on a worn edge — the detail layer)
  let F0 = mix(vec3f(0.04), base, metalness);
  let Po = P + N * 0.02;
  let rays = min(u32(frame.rtCfg.y), 4u);
  let lamV = smithLambda(Ve, ax, ay);
  let kEmit = emitTraceK(rough);                                            // area-lit fixtures: traced on a polish, analytic (rtGlints) on a rough finish, one panel either way
  var Lsum = vec3f(0.0); var hitT0 = RT_TMAX;
  for (var k = 0u; k < rays; k++) {
    // R2 sequence stepped by (frame, ray) off the pixel's own offsets: consecutive frames stratify the lobe, so the history's running mean settles instead of wandering
    let fi = f32((frame.frameIdx * rays + k) & 4095u);
    let u1 = fract(cpx + fi * 0.7548777); let u2 = fract(cpy + fi * 0.5698403);
    var H = sampleGGXVNDF(Ve, ax, ay, u1, u2);
    var Ls = reflect(-Ve, H);
    if (Ls.z < 0.02) { Ls = vec3f(-Ve.x, -Ve.y, Ve.z); H = vec3f(0.0, 0.0, 1.0); }   // under the horizon (rough finish, grazing eye): the mirror direction instead — energy kept where 1 spp cannot afford a rejection loop
    let dir = normalize(T * Ls.x + B * Ls.y + N * Ls.z);
    let hit = traceClosest(Po, dir, RT_TMAX, owner);
    if (k == 0u) { hitT0 = select(RT_TMAX, hit.t, hit.idx >= 0); }
    let Li = shadeReflHit(hit, Po, dir, kEmit);
    let Fr = F0 + (vec3f(1.0) - F0) * pow5(1.0 - clamp(dot(Ve, H), 0.0, 1.0));
    let wG = (1.0 + lamV) / (1.0 + lamV + smithLambda(Ls, ax, ay));      // G2 / G1(v), height-correlated: the VNDF estimator's remaining weight
    Lsum += Li * Fr * wG;
  }
  var Lspec = Lsum / f32(max(rays, 1u));
  if ((frame.flags & FLAG_DIRECT) != 0u && frame.matCfg.x > 0.0) {
    let g = rtGlints(P, Po, N, V, T, B, ax, ay, F0, owner, select(1.0 - kEmit, 1.0, rays == 0u));   // (no rays: every panel comes through its analytic light)
    Lspec += g.xyz * frame.matCfg.x;
    if (rays == 0u) { hitT0 = select(RT_TMAX, g.w, g.w > 0.0); }          // highlights only: the strongest one's distance places the image for the denoiser
  }
  textureStore(outRefl, gid.xy, vec4f(Lspec, hitT0));
}
