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
// PHASE 5 (frame.p5Cfg.z bit 2, settings.rtHitReuse — ultra): per texel last frame's HIT RECORD {hit point, its face normal, the irradiance the hit's shading found there (direct + bounce,
// before albedo), how many frames it has been refined, which box}: x = the point's x | z (16 bits each over the world box), y = its y (16) | octahedral normal (8 + 8), z = f16 × 2
// irradiance r, g, w = f16 irradiance b | count << 16 (4 bits) | the box index's low 12 bits << 20 (a record only ever refines a hit on the SAME box: rows of like-facing partitions a
// lobe's width apart do not pool their light). Read at the reflecting surface's reprojected texel, written for this frame's first ray. 1×1 stand-ins, never touched, while the bit is down.
@group(1) @binding(9) var hitPrev: texture_2d<u32>;
@group(1) @binding(10) var hitOut: texture_storage_2d<rgba32uint, write>;
const RT_HIT_CAP: f32 = 6.0;         // frames of hit-lighting history a record keeps at most (α ≥ 1/6: a light switched at the mirrored wall settles in a tenth of a second; the specular denoiser's own history sits behind it)
const RT_HIT_EMAX: f32 = 20000.0;    // irradiance bound before the f16 pack (a lens a few cm off the hit face would overflow to +inf and poison the blend next frame; a record not below it reads as empty)

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
 *  Bounded per ray by matCfg.z (luminance). In two halves for phase 5's hit-lighting reuse, which sits between them: reflHitParts finds the hit's
 *  emission + albedo and the IRRADIANCE there (the part worth a history: the one-shadow-ray light pick at an off-screen hit is what flickers), reflHitFinish
 *  puts them together and applies the segment's glass and the bound. Called back to back with the irradiance untouched they compute what main's one-function shading (reflect.wgsl shadeReflHit) does, statement
 *  for statement — every path of this kernel takes the two halves (one copy of the hit shading: DXC inlines each call it meets). */
struct HitParts { Le: vec3f, albedo: vec3f, Eh: vec3f, segT: f32, solid: bool, onScreen: bool };   // solid = an opaque surface was hit (Eh / albedo meaningful); onScreen = its direct light came off this frame's denoised textures
fn reflHitParts(hit: Hit, Po: vec3f, dir: vec3f, kEmit: f32, walls: u32) -> HitParts {
  var h: HitParts; h.Le = vec3f(0.0); h.albedo = vec3f(0.0); h.Eh = vec3f(0.0); h.segT = RT_TMAX; h.solid = false; h.onScreen = false;
  if (hit.idx < 0) {
    h.Le = skyRadiance(dir) + frame.weatherB.xyz;                         // (weatherB.rgb = what a lightning stroke's lit sky adds this frame; 0 otherwise)
  } else if (!hit.inside) {
    h.segT = hit.t; h.solid = true;
    let Ph = Po + dir * hit.t;
    if (hit.idx == CAPSULE_HIT) { h.albedo = hit.capAlbedo; }
    else {
      let bi = u32(hit.idx);
      let bf = boxGeo[bi].flags;
      if ((bf & BOX_EMISSIVE) != 0u) { h.Le += boxEmissive(bi) * select(1.0, kEmit, (bf & BOX_AREALIT) != 0u); }
      h.albedo = boxAlbedoSec(bi);
      let ms = markSlotOf(bf);                                            // MARKINGS at the reflection hit (as reflect.wgsl shadeReflHit)
      if (ms != 0u && frame.markCfg.w != 0.0) { let mh = markReflHit(ms, bi, Ph, hit.n, dir, hit.t, kEmit, boxAlbedo(bi)); h.albedo = mh.albedo; h.Le += mh.L; }
    }
    if ((frame.flags & FLAG_DIRECT) != 0u) {   // (the on-screen half first, so the reuse knows which path lit the hit; off screen, directAtPoint repeats the cheap projection test and takes its light loop)
      let od = directAt(Ph, hit.n, 0u, true);   // (directOnScreen, else directAtPoint, in one call: .w = 1 on screen)
      h.Eh += od.xyz; h.onScreen = od.w == 1.0;
    }
    if ((frame.flags & FLAG_BOUNCE) != 0u) { if ((BOUNCE_WALLS && bounceHitMan(hit)) || walls != 0u) { h.Eh += diceIrradianceWalled(Ph, hit.n, bounceHitOwner(hit) | ((walls & 0xffu) << 8u)); } else { h.Eh += diceIrradiance(Ph + hit.n * c0Spacing(), hit.n); } }
  } else { h.segT = 0.0; }
  return h;
}
fn reflHitFinish(h: HitParts, Po: vec3f, dir: vec3f) -> vec3f {
  var L = h.Le;
  if (h.solid) { L += h.albedo * h.Eh * (1.0 / PI); }
  if (glassCount() > 0u) {                                                // panes on the reflected segment: tint what lies beyond, add what the nearest mirrors
    let gh = glassTrace(Po, dir, 0.01, h.segT);
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
    let fogK = lightFogK(li, P, N); if (fogK <= 0.002) { continue; }   // the fog of war's light classes (common.wgsl): a torch's highlight is not on floor nobody sees
    let E = li.color * pat * (att * NdotL * fogK);
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

// ---- LASERS / TRACERS IN THE REFLECTION (render/passes.ts setBeams; settings.beamReflect). A weapon laser's beam and a tracer's streak are NoShadow boxes: no
// ray can meet one, so traceClosest never returns them. The host hands the nearest 8 as line segments and their mirror image is added ANALYTICALLY: where the
// pixel's mirror ray passes a segment, the share of the lobe's footprint there that the hair-thin line fills (footprint = the pixel's cone + the finish's lobe, so a polish shows a line and a rough wet patch a faint smear), one occlusion ray to that point, the finish's Fresnel. Stable frame to frame
// (no sampling), like the analytic highlights. Picture only. beams.n == 0 → never called: the pass's arithmetic as it was. KEEP IN STEP: reflect.wgsl ≡ reflect_p5.wgsl.
struct BeamSeg { a: vec4f, b: vec4f, e: vec4f };   // a = from xyz + the drawn half-width (m) · b = to xyz · e = emitted radiance rgb (already dimmed for that width)
struct Beams { n: u32, p0: u32, p1: u32, p2: u32, k: vec4f, seg: array<BeamSeg, 8> };   // p0: bit 0 = mirror images on, bit 1 = the lasers are light in the air (composite.wgsl beamAir); seg.e.w = that beam's share of air (0 = a box)
@group(1) @binding(11) var<uniform> beams: Beams;
const BEAM_REFL_AIR: f32 = 0.25;     // … and of a squad laser drawn as light in the air (settings.beamAir): a quarter of the line AS IT IS DRAWN (× its air share below), so the image is always well
                                     // under the beam (the maintainer: "a bit bright given the brightness of the IR beam"); the wet film's own share is 0.12. TASTE, never seen on a GPU
const BEAM_REFL_MIN: f32 = 0.35;     // the least share of the beam a finish mirrors (TASTE, first pass, never seen on a GPU). Physically a water film returns 4 % from above and a
                                     // 4 mm line at 4 % is invisible — but the beam itself is a drawn convention (no laser shows from the side in clear air), so its image is too: 0 = Fresnel alone
fn beamImage(Po: vec3f, N: vec3f, V: vec3f, ax: f32, ay: f32, F0: vec3f, cpix: f32, owner: u32, wetF: f32) -> vec3f {
  let R = reflect(-V, N);
  var L = vec3f(0.0);
  let Fr = F0 + (vec3f(1.0) - F0) * pow5(1.0 - clamp(dot(N, V), 0.0, 1.0));
  let wBox = max(Fr, vec3f(BEAM_REFL_MIN)) * 1.5;                                  // a glowing box (a tracer; a laser with the air look off): as it was
  let wAir = max(min(Fr * wetF, vec3f(1.0)), vec3f(BEAM_REFL_AIR));                // light in the air: the finish's own share (the wet film's on the wet lot)
  let nb = min(beams.n, 8u);
  for (var i = 0u; i < nb; i++) {
    let s = beams.seg[i];
    let dv = s.b.xyz - s.a.xyz; let len = length(dv);
    if (len < 1e-3) { continue; }
    let u = dv / len;
    // closest approach of the mirror ray Po + R t to the segment a + u q, q in 0‥len
    let w0 = Po - s.a.xyz; let ru = dot(R, u); let rw = dot(R, w0); let uw = dot(u, w0);
    let den = 1.0 - ru * ru;
    var q = 0.0;
    if (den > 1e-5) { q = clamp((uw - ru * rw) / den, 0.0, len); }
    let t = ru * q - rw;
    if (t < 0.03) { continue; }                                            // behind the surface point (or on it)
    q = clamp(uw + ru * t, 0.0, len);
    let Q = s.a.xyz + u * q;
    let off = Q - (Po + R * t); let dist = length(off);
    let wd = t * (2.0 * cpix + 2.0 * min(ax, ay)) + 2.0 * s.a.w;           // the footprint's width there (m): the lobe's TIGHT axis whichever way the line runs — smeared along the view's
                                                                           // long axis as a lamp's streak is, a beam across the view came out as a row of pale blobs, not a line (a drawn convention, like the beam)
    let x = 2.0 * dist / wd;
    if (x >= 1.0) { continue; }
    let toQ = Q - Po; let dq = length(toQ);
    if (occluded(Po, toQ / dq, dq - 0.02, owner)) { continue; }
    let air = (beams.p0 & 2u) != 0u && s.e.w > 0.0;                                  // a beam drawn as light in the air mirrors as faint as it is drawn
    L += s.e.xyz * select(wBox, wAir * min(1.0, s.e.w), air) * ((1.0 - x * x) * (2.0 * s.a.w / wd));             // (the kernel integrates to the line's share of the footprint)
  }
  return L;
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
  let noRec = (frame.p5Cfg.z & 2u) != 0u;                                  // (phase 5's hit-lighting reuse on: a texel that traces nothing this frame leaves an EMPTY record, never a stale one)
  let rdiv = max(u32(frame.rtCfg.w), 1u);
  let full = min(gid.xy * rdiv + (rdiv - 1u) / 2u, vec2u(frame.screen) - 1u);   // the full-res pixel this texel is computed at (its own at div 1; the top-left of its 2×2 at div 2, the centre of its 3×3 — as the gather picks its pixel)
  let depth = textureLoad(gDepth, full, 0);
  if (depth >= 1.0 || frame.rtCfg.w < 1.0) { textureStore(outRefl, gid.xy, none); if (noRec) { textureStore(hitOut, gid.xy, vec4u(0u)); } return; }
  let id = textureLoad(gId, full, 0).x;
  let bidx = id & 0xFFFFFu;
  if (((id >> 28u) & 1u) != 0u || ((id >> 29u) & 1u) != 0u) { textureStore(outRefl, gid.xy, none); if (noRec) { textureStore(hitOut, gid.xy, vec4u(0u)); } return; }   // a character (his coat is composite's) or a section cap
  let mat = textureLoad(gMat, full, 0);                                    // (roughness, metalness) as the g-buffer wrote them: the finish + the detail layer's wear
  let rough = mat.x; let metalness = mat.y;
  let maxR = frame.rtCfg.x;
  if (rough > maxR) { textureStore(outRefl, gid.xy, none); if (noRec) { textureStore(hitOut, gid.xy, vec4u(0u)); } return; }
  var aniso = false;
  if (bidx != 0xFFFFFu) { aniso = boxFinish(bidx).aniso; }
  let P = worldFromDepth(vec2f(full) + 0.5, depth);
  let N = normalize(textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0);
  let toEye = frame.camPos - P; let z = length(toEye);
  let V = toEye / max(z, 1e-4);
  if (dot(N, V) <= 0.01) { textureStore(outRefl, gid.xy, none); if (noRec) { textureStore(hitOut, gid.xy, vec4u(0u)); } return; }
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
  let an = frame.rtCfg.z - 2.0 * floor(frame.rtCfg.z * 0.5);              // (.z also carries the wet ground's break-up as 2 × tenths, read by the g-buffer: with none this is .z itself)
  if (aniso && an > 0.0) { ax = alpha * (1.0 - 0.6 * an); ay = min(alpha * (1.0 + 5.0 * an), 1.0); }   // wet ground: tight across the view, long along it
  let Ve = vec3f(dot(V, T), dot(V, B), dot(V, N));
  let base = textureLoad(gAlbedo, full, 0).xyz;                            // base colour (a metal's F0; brighter on a worn edge — the detail layer)
  let F0 = mix(vec3f(0.04), base, metalness);
  // THE WET FILM'S SHARE (settings.wetMirror → beams.k.y; 0 = off: wetF stays 1 and the lines below multiply by exactly what they did). The older gloss path (fgather.wgsl
  // glossReflection: what low / verylow draw in a storm) strengthens the film's Fresnel by the ground's wetness; this pass never did, so on the wet lot a traced image came
  // out a third as strong here as there — a lit man's too faint to read, beside a laser's image that had a floor of its own. Traced hits only: the lamps' glints are as they were.
  var wetF = 1.0;
  if (aniso && beams.k.y > 0.0) {
    let Wc = frame.weatherC; var wetOut = select(0.0, frame.weatherA.w, P.x < Wc.x || P.z < Wc.y || P.x > Wc.z || P.z > Wc.w);
    if (WX_KINDS) { if (frame.cardCfg.y != 0u && wxRoofed(P.xz)) { wetOut = 0.0; } }
    wetF = 1.0 + beams.k.y * wetOut;
  }
  let Po = P + N * 0.02;
  let rays = min(u32(frame.rtCfg.y), 4u);
  let lamV = smithLambda(Ve, ax, ay);
  let kEmit = emitTraceK(rough);                                            // area-lit fixtures: traced on a polish, analytic (rtGlints) on a rough finish, one panel either way
  let reflWalls = select(0u, 0x100u | owner, REFL_WALLS && metalness > 0.25);   // REFL WALLS, as reflect.wgsl: a metal's rays take the walled read at every hit (0 = the read as it was, else bit 8 and this pixel's owner)
  // ---- phase 5 (frame.p5Cfg.z bit 2): last frame's hit record at this surface point's reprojected texel — the reflecting floors are statics, so the camera's reprojection with both TAAU
  // jitters taken back out lands a still pixel on its own record whatever the jitter does (the gather's reservoirs use the same mapping) ----
  let reuse = (frame.p5Cfg.z & 2u) != 0u;
  var recOk = false; var recP = vec3f(0.0); var recN = vec3f(0.0, 1.0, 0.0); var recE = vec3f(0.0); var recCnt = 0.0; var recBox = 0xFFFFu;
  if (reuse) {
    let pc = frame.prevViewProj * vec4f(P, 1.0);
    if (pc.w > 1e-4) {
      let pxPrev = ((pc.xy / pc.w) * vec2f(0.5, -0.5) + 0.5) * frame.screen - frame.jitter.zw + frame.jitter.xy;
      let q = vec2i(floor(pxPrev / f32(rdiv)));
      if (all(q >= vec2i(0)) && all(q < vec2i(odims))) {
        let rec = textureLoad(hitPrev, q, 0);
        recCnt = f32((rec.w >> 16u) & 15u); recBox = rec.w >> 20u;
        if (recCnt > 0.0) {
          recP = p5UnpackPos(rec.x, rec.y); recN = p5UnpackN(rec.y); recE = vec3f(unpack2x16float(rec.z), unpack2x16float(rec.w & 0xffffu).x);
          recOk = all(recE < vec3f(RT_HIT_EMAX)) && all(recE >= vec3f(0.0));   // (a non-finite record — an f16 that overflowed on the way in — is no record)
        }
      }
    }
  }
  var outRec = vec4u(0u);                                                   // this frame's record (count 0 = nothing worth keeping: a miss, a man, sky)
  var Lsum = vec3f(0.0); var hitT0 = RT_TMAX;
  var u1r0 = 0.0; var u2r0 = 0.0;
  for (var k = 0u; k < rays; k++) {
    // R2 sequence stepped by (frame, ray) off the pixel's own offsets: consecutive frames stratify the lobe, so the history's running mean settles instead of wandering
    let fi = f32((frame.frameIdx * rays + k) & 4095u);
    var u1 = fract(cpx + fi * 0.7548777); var u2 = fract(cpy + fi * 0.5698403);
    if (reuse && k == 1u) { u1 = u1r0; u2 = fract(u2r0 + 0.5); }            // phase 5: the second ray is the first's ANTITHETIC partner — same radius on the sampling disc, the opposite azimuth — so the pair straddles the lobe and its mean sits near the mirror image every frame (two consecutive R2 points can land on one side)
    if (k == 0u) { u1r0 = u1; u2r0 = u2; }
    var H = sampleGGXVNDF(Ve, ax, ay, u1, u2);
    var Ls = reflect(-Ve, H);
    if (Ls.z < 0.02) { Ls = vec3f(-Ve.x, -Ve.y, Ve.z); H = vec3f(0.0, 0.0, 1.0); }   // under the horizon (rough finish, grazing eye): the mirror direction instead — energy kept where 1 spp cannot afford a rejection loop
    let dir = normalize(T * Ls.x + B * Ls.y + N * Ls.z);
    var hit: Hit;
    hit = traceClosestMesh(Po, dir, RT_TMAX, owner);   // (with p5Cfg.z bit 1 and the rig both down its tail is traceClosest's exactly: one tracer, not two copies of it — DXC inlines each call it meets)   // (phase 5: the men's skinned mesh in the mirror while bit 1 is up — or the SDF rig's smooth union, frame.rigCfg bit 2, whose branch lives in the same tail; main's own tracer, untouched, while both are down)
    if (k == 0u) { hitT0 = select(RT_TMAX, hit.t, hit.idx >= 0); }
    var Li: vec3f;
    var hp = reflHitParts(hit, Po, dir, kEmit, reflWalls);   // (the two halves on every path: shadeReflHit's statements in the same order, one copy of the hit shading instead of two)
    if (reuse) {
      // hit-lighting reuse: a STATIC opaque hit whose direct light was the one-ray estimate (an on-screen hit already carries this frame's settled light) takes the record's irradiance
      // into a running mean when the record's point lies within the lobe's own footprint of it on the same face — a history keyed on where the ray WENT, not on the pixel, so the
      // R2-scattered rays of consecutive frames refine one estimate of the light on that patch instead of each flickering its own light pick
      var cnt = 0.0;
      if (hp.solid && hit.idx != CAPSULE_HIT) {
        cnt = 1.0;
        let box12 = u32(hit.idx) & 0xFFFu;
        if (recOk && !hp.onScreen && box12 == recBox) {
          let Ph = Po + dir * hit.t;
          let rMatch = min(0.05 + 1.5 * max(rough * rough, 0.0009) * hit.t, 1.5);   // ≈ the GGX lobe's footprint radius at that distance (+ 5 cm: the record's own point is quantised and last frame's), never past a metre and a half
          if (distance(Ph, recP) < rMatch && dot(hit.n, recN) > 0.8) { cnt = min(recCnt, RT_HIT_CAP) + 1.0; hp.Eh = mix(recE, hp.Eh, 1.0 / cnt); }
        }
        if (k == 0u) { let Ph = Po + dir * hit.t; let Es = min(hp.Eh, vec3f(RT_HIT_EMAX)); outRec = vec4u(p5PackXZ(Ph), p5PackYN(Ph, hit.n), pack2x16float(Es.xy), (pack2x16float(vec2f(Es.z, 0.0)) & 0xffffu) | (u32(cnt) << 16u) | (box12 << 20u)); }
      }
    }
    Li = reflHitFinish(hp, Po, dir);
    let Fr = F0 + (vec3f(1.0) - F0) * pow5(1.0 - clamp(dot(Ve, H), 0.0, 1.0));
    let wG = (1.0 + lamV) / (1.0 + lamV + smithLambda(Ls, ax, ay));      // G2 / G1(v), height-correlated: the VNDF estimator's remaining weight
    Lsum += Li * min(Fr * wetF, vec3f(1.0)) * wG;
  }
  if (reuse) { textureStore(hitOut, gid.xy, outRec); }
  var Lspec = Lsum / f32(max(rays, 1u));
  if ((frame.flags & FLAG_DIRECT) != 0u && frame.matCfg.x > 0.0) {
    let g = rtGlints(P, Po, N, V, T, B, ax, ay, F0, owner, select(1.0 - kEmit, 1.0, rays == 0u));   // (no rays: every panel comes through its analytic light)
    Lspec += g.xyz * frame.matCfg.x;
    if (rays == 0u) { hitT0 = select(RT_TMAX, g.w, g.w > 0.0); }          // highlights only: the strongest one's distance places the image for the denoiser
  }
  if (beams.n > 0u && (beams.p0 & 1u) != 0u) { Lspec += beamImage(Po, N, V, ax, ay, F0, 2.0 * frame.post.w * frame.invScreen.y * f32(rdiv), owner, wetF); }   // lasers / tracers (no ray meets them): their analytic image
  textureStore(outRefl, gid.xy, vec4f(Lspec, hitT0));
}
