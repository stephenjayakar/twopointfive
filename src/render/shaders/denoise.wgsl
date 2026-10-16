// The v3 denoiser CORE (renderer v3 phase 3): ONE reprojection / accumulation / variance / à-trous machinery, THREE clients —
//   SHADOW    the direct pass's two emitter classes (full internal res), denoised in VISIBILITY-RATIO space r = S/U per channel: U (the exact unshadowed
//             light) never enters a history or a filter tap, so a light switching, sweeping or flashing is exact and immediate — only the stochastic
//             visibility is accumulated and smoothed. Input per class: S.rgb + the signed PCSS penumbra hint (S.a), U.rgb (direct.wgsl / restir.wgsl —
//             the same four textures either estimator writes). Output: S = U × r̂ back into the S textures composite / fgather read, hint kept in .a.
//   DIFFUSE   the ⅓ / ½-res final gather's irradiance E (fgather.wgsl outIndirect) → the gi texture composite upsamples.
//   SPECULAR  the gather's specular field (glossy floors + glass, outSpecular: rgb + the reflection ray's hit distance in .a) → the spec texture.
// Per client, per frame:
//   TEMPORAL  reproject the pixel's surface point through last frame's view-projection PLUS the g-buffer's per-pixel object motion (gVel — a walking
//             man's lit shoulder finds its own history, not the wall's behind him), fetch the 2×2 history texels round that point and validate EACH by
//             the view depth it stored against the depth this point had last frame (a partial footprint renormalises over the valid taps = 'fallback to
//             the closest valid'; none valid = disocclusion, history length 0), track per-pixel first / second MOMENTS of the incoming sample's luminance
//             (→ the temporal variance of the SAMPLES: high forever inside a penumbra or under 4-ray bounce, zero where every ray agrees) and the history
//             LENGTH n (capped per tier), accumulate at α = 1/n, and CLAMP the history into this frame's 5×5 neighbourhood statistics (mean ± k·σ, from a
//             workgroup-memory apron — the transient rule: whatever this frame cannot see in its own neighbourhood leaves the history now, so a muzzle
//             flash's visibility, a door's light, a torch sweeping on are this-frame events, exactly the property dtemporal.wgsl had); the diffuse client
//             also keeps a FAST history (short EMA) and centres its clamp box on it (ReLAX: kills the lag of a long history without the boil of clamping to
//             one raw frame). Under 4 frames of history the variance is the spatial one of the apron (SVGF's fallback).
//   À-TROUS   N iterations (per tier) of the 3×3 edge-stopped wavelet at strides 1, 2, 4, 8, 16: weight = B-spline tap × plane distance (depth) × normal
//             power × LUMINANCE similarity relative to the pixel's own σ = sqrt(variance) (SVGF: smooth where the estimate is noisy, keep every edge the
//             estimate is sure of — a crisp contact shadow beside a wide penumbra stays crisp), the variance filtered along (Σw²var / (Σw)²); the shadow
//             client also weighs taps 'lit alike' (never mix ratios across a cone edge / between light footprints — softblur's rule) and keeps softblur's
//             hint prior as the kernel's REACH: an iteration only takes a pixel as far as its own / inherited penumbra width asks (contact hardening from
//             the blocker distance, dilated stride by stride like the hint always was) — and its final iteration multiplies U back in.
// Kinds of texel this module reads / writes (all rgba16f unless noted):
//   shadow  CUR_c   = (ratio.rgb, cue luminance)         pack → temporal, then à-trous ping-pong (dP / dS in passes.ts); the hints ride in SHARED
//           SHARED  = (hint0, hint1, lumU0, lumU1)         pack → à-trous (dilated per iteration, ping-pong)
//           HV_c    = (accumulated ratio.rgb, lumU_c)      temporal → next frame's history AND the chain's first input (dH[c][p]); lumU = the class's EXACT unshadowed luminance that frame: the light cues' memory
//                                                          (CUR.a carries the believed-visible luminance the JUMP is measured against — see shTemporal)
//           HM      = (m1_0, var_0, m1_1, var_1)           EW mean / variance of the per-frame sample luminance, both classes (the first à-trous iteration takes its variance here)
//           HG      = r32uint: f16 view depth | len0 5 | len1 5 | oct normal 3+3 — what next frame validates / continues
//   radiance HIST   = (accumulated rgb, view depth)        (indHist / specHist: today's layout — the depth in .a is the validation key, gathered 2×2)
//           RM      = (m1, ewvar, history length, variance the à-trous reads (= ewvar, or the spatial one while young))
//           FAST    = (fast-history rgb, –)                 diffuse only
//           chain   = (rgb, variance)                       à-trous ping-pong (gi0 / gi1; the last iteration lands where composite reads)
// Group 0 = the scene prelude (frame, worldFromDepth, linSamp …); group 1 below. One module, five entry points; each pipeline's layout lists what its
// entry point touches (passes.ts / denoise.ts).

struct DnParams {
  sh: vec4f,       // SHADOW   x = clamp k (σ), y = history cap (frames; 0 = no temporal reuse), z = σ_l (luminance edge-stop scale), w = light-motion threshold: relative change of a class's unshadowed luminance per frame past which its history drops to the moving length (flags.z)
  sh2: vec4f,      //          x = depth weight k (plane distance ÷ (z·k)), y = normal power, z = history-length scale this frame (1; ½ after a resize carried the histories), w = ratio clamp hi (1, or 4 under the chroma-exact tail / ReSTIR hues)
  gi: vec4f,       // DIFFUSE  x = clamp k, y = history cap, z = σ_l, w = fast-history cap (frames; 0 = clamp on the raw neighbourhood mean)
  gi2: vec4f,      //          x = depth k, y = normal power, z = firefly: incoming luminance ≤ mean + z·σ of the 5×5 (0 = off), w = 0 in the main and reflection blocks (written non-zero there it changed the
                   //          REFLECTION chain's frame under ?legacydenoise — docs/internal/tjank.md 'identity' — although every read of it there sits behind SPEC; not chased, avoided); in the
                   //          INTERNAL-RES diffuse chain's own block (denoise.ts paramsFull) it carries the RAW gather's divisor 2 | 3 (radApronRaw / giTemporalF / giUpsample map pixels ↔ texels with it)
  sp: vec4f,       // SPECULAR x = clamp k, y = history cap, z = σ_l, w = roughness STAND-IN (0 = mirror … 1) for the gather-res chain (glass panes / the legacy gloss floors), whose texels have no material of their own
  sp2: vec4f,      //          x = depth k, y = normal power, z = virtual-hit reprojection share override (< 0: derived from roughness), w = PER-PIXEL ROUGHNESS mode: > 0 = this chain is the reflection
                   //          pass's (reflect.wgsl) — roughness per texel from the g-buffer's material target (gMatR), texels rougher than this value hold no term (weight 0, history 0), the
                   //          mirror image reprojected through last frame's eye and validated on the pixel's plane, the à-trous reach = the lobe's footprint (contact hardening); 0 = the stand-in above
  flags: vec4u,    // x: 1 = motion vectors on, 2 = FLAG_TEMPORAL mirror (radiance clients accumulate), 4 = lit-alike weight on, 8 = shadow temporal on, 16 = shadow hint prior on (kernel reach ≤ the PCSS width; off = pure variance guidance), 32 = the light cues read the believed-visible luminance from U.a (ReSTIR on) instead of U, 64 = the OCCLUDED-LIGHT reading (occlScale below, and stats5Sh's unlit texels left out of the temporal statistics; off = the shadow client as it was);
                   // w = the SHADOW client's light-JUMP threshold × 1000 (0 = off): a change of a class's EXACT unshadowed luminance within one frame, measured against the luminance the pixel
                   //     believes reaches it (CUR.a) — a switch, a fluorescent's dropout stroke, a lightning stroke arriving; not a torch drifting — takes that class's VALUE from this frame (capped, leant on its 5×5)
                   //     and carries its sample variance across instead of booking the step as variance (shTemporal 'jump');
                   // y = THIS chain's resolution divisor (the gather's 2|3, or the reflection target's 1|2|3); z = the shadow client's 'moving' history length (frames; 0 = the light-motion cue off); w spare
  gi3: vec4f,      // DIFFUSE, GI in motion (docs/internal/gi-motion.md §D; both 0 = the client as it was): x = CLAMP CUT — where the clamp had to move the long history (the bounce at a valid pixel CHANGED:
                   //          a man's soft occlusion sliding along a wall), the history length is cut by how far it moved relative to the box (the reflection chain's rule), so the next frames
                   //          weigh the fresh estimate more AND the gather's young-history rays fire there; y = YOUNG WIDEN — the à-trous luminance edge-stop loosened × (1 + y) on texels whose
                   //          history is young (smoother while only a frame or two stand behind the estimate); zw spare
};
@group(1) @binding(0) var<uniform> dn: DnParams;
@group(1) @binding(1) var gDepth: texture_depth_2d;
@group(1) @binding(2) var gNormal: texture_2d<f32>;
@group(1) @binding(3) var gVel: texture_2d<f32>;
@group(1) @binding(4) var nearSamp: sampler;             // non-filtering: textureGather on the uint geometry history
@group(1) @binding(5) var gMatR: texture_2d<f32>;        // the g-buffer's material target (roughness, metalness) — the radiance clients read its roughness in per-pixel mode (sp2.w > 0)

const SOFT_HINT_BAND: f32 = 0.015;   // |hint| under this = the drawn-character-shadow FLAG (direct_common.wgsl SOFT_HINT_FLAG 0.01), never a measurement: real hints are ≥ 0.75 px ∕ MAX_BLUR_PX = 0.023
const JUMP_REL_FLOOR: f32 = 0.2;   // shTemporal: the jump's yardstick is the believed-visible luminance, but never under this share of the exact U (deep umbra stays calm under drifting light)
const JUMP_CAP: f32 = 1.0;    // shTemporal, a light-jump frame: the current ratio's bright outliers capped at the 5×5 mean + this many σ …
const JUMP_LEAN_SHARP: f32 = 0.25;   // … and the value leant this far onto that mean, per class (0 = the capped sample as it is, 1 = the box mean): the SHARP class's shadows are hard-edged (torches, the
const JUMP_LEAN_BROAD: f32 = 0.75;   // lightning's mullions) and a box mean would soften them for the frame; the BROAD class's are penumbra anyway — 0 / 0.5 / 0.75 measured under the strobing tube 08-11
                                     // (docs/internal/tjank.md §A): per-level noise 2.5 / 2.0 / 2.0 (rug), 4.8 / 3.8 / 3.6 (chair), 6.6 / 4.5 / 3.8 (desk) 8-bit steps, levels within a step of each other
const DNF_VEL: u32 = 1u; const DNF_TEMPORAL: u32 = 2u; const DNF_LITALIKE: u32 = 4u; const DNF_SH_TEMPORAL: u32 = 8u; const DNF_SH_PRIOR: u32 = 16u; const DNF_CUE_UV: u32 = 32u; const DNF_SH_OCCL: u32 = 64u;   // (CUE_UV: the U textures' alpha carries the BELIEVED-VISIBLE unshadowed luminance per class — restir.wgsl — the yardstick the shadow client's light-JUMP is measured against; the cues' memory is the whole U)

// ============================================================== shared core ==============================================================

/** Where the surface point P (seen at internal pixel `px` this frame) was on LAST frame's internal raster, in continuous full-res pixel units (texel
 *  centres at +0.5), the view depth it had then (the validation key), and how far it moved on screen (uv units) beyond the camera's own motion.
 *  ok = false when it was behind last frame's eye. Camera motion: frame.prevViewProj (last render's jittered matrix — right for an internal-res
 *  history); object motion: the g-buffer's gVel (ndc(prev·P_prev) − ndc(prev·P_now), jitter-free by construction). */
struct Reproj { pxPrev: vec2f, zPrev: f32, vel: f32, ok: bool };
fn reproject(P: vec3f, px: vec2i) -> Reproj {
  var r: Reproj;
  let pc = frame.prevViewProj * vec4f(P, 1.0);
  r.ok = pc.w > 1e-4; r.zPrev = pc.w; r.vel = 0.0;
  var ndc = pc.xy / max(pc.w, 1e-4);
  if ((dn.flags.x & DNF_VEL) != 0u) { let v = textureLoad(gVel, px, 0).xy; ndc += v; r.vel = length(v * vec2f(0.5, 0.5)); }
  r.pxPrev = (ndc * vec2f(0.5, -0.5) + 0.5) * frame.screen;
  return r;
}

/** The 2×2 history footprint round continuous texel position `hp` (texel centres at +0.5) of a W×H history: base texel, and the four bilinear weights
 *  in the order (0,0) (1,0) (0,1) (1,1) with every tap whose stored view depth disagrees with `zExpect` (relative tolerance `tol`) or that lies off the
 *  texture zeroed. sum = what is left (1 = the whole footprint is the same surface; 0 = disocclusion). */
struct Foot { base: vec2i, w: vec4f, sum: f32, whole: bool };
fn footprint(hp: vec2f, dims: vec2i, d4: vec4f, zExpect: f32, tol: f32) -> Foot {
  var f: Foot;
  let b = floor(hp - 0.5); f.base = vec2i(b); let t = hp - 0.5 - b;
  var w = vec4f((1.0 - t.x) * (1.0 - t.y), t.x * (1.0 - t.y), (1.0 - t.x) * t.y, t.x * t.y);
  let lim = tol * max(zExpect, 0.05) + 0.02;
  let ok = vec4f(select(0.0, 1.0, abs(d4.x - zExpect) < lim), select(0.0, 1.0, abs(d4.y - zExpect) < lim), select(0.0, 1.0, abs(d4.z - zExpect) < lim), select(0.0, 1.0, abs(d4.w - zExpect) < lim));
  // taps off the texture: no history there
  let in00 = all(f.base >= vec2i(0)) && all(f.base < dims);
  let in11 = all(f.base + 1 >= vec2i(0)) && all(f.base + 1 < dims);
  let inX = f.base.x + 1 >= 0 && f.base.x + 1 < dims.x && f.base.y >= 0 && f.base.y < dims.y;
  let inY = f.base.x >= 0 && f.base.x < dims.x && f.base.y + 1 >= 0 && f.base.y + 1 < dims.y;
  w *= ok * vec4f(select(0.0, 1.0, in00), select(0.0, 1.0, inX), select(0.0, 1.0, inY), select(0.0, 1.0, in11));
  f.w = w; f.sum = w.x + w.y + w.z + w.w;
  f.whole = f.sum > 0.999;
  return f;
}
/** textureGather's component order → the footprint's (0,0) (1,0) (0,1) (1,1): gather returns (u_min,v_max) (u_max,v_max) (u_max,v_min) (u_min,v_min),
 *  v growing downward in texel rows, so top-left = .w, top-right = .z, bottom-left = .x, bottom-right = .y */
fn gatherOrder(g: vec4f) -> vec4f { return vec4f(g.w, g.z, g.x, g.y); }
fn gatherOrderU(g: vec4u) -> vec4u { return vec4u(g.w, g.z, g.x, g.y); }
/** manual 2×2 fetch of an rgba16f history under footprint weights (used when some tap failed validation; the whole-footprint case takes one bilinear sample) */
fn fetchFoot(t: texture_2d<f32>, f: Foot) -> vec4f {
  var acc = vec4f(0.0);
  if (f.w.x > 0.0) { acc += textureLoad(t, f.base, 0) * f.w.x; }
  if (f.w.y > 0.0) { acc += textureLoad(t, f.base + vec2i(1, 0), 0) * f.w.y; }
  if (f.w.z > 0.0) { acc += textureLoad(t, f.base + vec2i(0, 1), 0) * f.w.z; }
  if (f.w.w > 0.0) { acc += textureLoad(t, f.base + vec2i(1, 1), 0) * f.w.w; }
  return acc / max(f.sum, 1e-6);
}

/** geometry edge-stopping shared by every à-trous: plane distance of the tap's point from the centre's tangent plane (a slanted floor is one surface at
 *  any stride, a desk top never joins the floor under it) × normal agreement */
fn geomWeight(P0: vec3f, n0: vec3f, z0: f32, Pq: vec3f, nq: vec3f, kz: f32, kn: f32, span: f32) -> f32 {
  return exp(-abs(dot(Pq - P0, n0)) / max(z0 * kz * span, 0.02)) * pow(max(dot(nq, n0), 0.0), kn);
}
/** SVGF's luminance edge-stop: differences the pixel's own noise (σ) explains are averaged away, larger ones are edges */
fn lumWeight(l0: f32, lq: f32, sigma: f32, kl: f32, eps: f32) -> f32 { return exp(-abs(lq - l0) / (kl * sigma + eps)); }

/** [1 2 1]/4 ⊗ [1 2 1]/4 for tap offset (dx, dy) ∈ {−1, 0, 1}² */
fn kb3(dx: i32, dy: i32) -> f32 { return f32((2 - abs(dx)) * (2 - abs(dy))) * 0.0625; }

// history geometry texel (shadow client): f16 view depth in bits 0‥15, the two classes' history lengths in 16‥20 / 21‥25 (≤ 31 each: a light moving over class 0 must not
// cut class 1's history), the surface normal octahedral-quantised to 3 + 3 bits in 26‥31 (coarse — 8 steps an axis — but its only job is telling a box's top from its side at
// the convex corners where depth runs continuous: the second validation key)
fn packHG(z: f32, n0: f32, n1: f32, nrm: vec3f) -> u32 {
  let o = vec2u(clamp(octEncode(nrm) * 7.0 + 0.5, vec2f(0.0), vec2f(7.0)));
  return (pack2x16float(vec2f(z, 0.0)) & 0xffffu) | (u32(clamp(n0, 0.0, 31.0)) << 16u) | (u32(clamp(n1, 0.0, 31.0)) << 21u) | (o.x << 26u) | (o.y << 29u);
}
fn hgDepth(v: u32) -> f32 { return unpack2x16float(v & 0xffffu).x; }
fn hgLen0(v: u32) -> f32 { return f32((v >> 16u) & 31u); }
fn hgLen1(v: u32) -> f32 { return f32((v >> 21u) & 31u); }
fn hgNormal(v: u32) -> vec3f { return octDecode(vec2f(f32((v >> 26u) & 7u), f32((v >> 29u) & 7u)) / 7.0); }

// workgroup apron for the temporal passes' neighbourhood statistics: the 8×8 tile + 2 texels each way = 12×12
const APR: i32 = 2; const AW: i32 = 12; const AN: u32 = 144u;
var<workgroup> wgA: array<vec4f, 144>;
var<workgroup> wgB: array<vec4f, 144>;
struct Stats { mean: vec3f, sigma: vec3f, lmean: f32, lsig: f32 };
fn statsOf(m1: vec3f, m2: vec3f, l1: f32, l2: f32) -> Stats {
  var s: Stats;
  s.mean = m1 / 25.0; s.sigma = sqrt(max(m2 / 25.0 - s.mean * s.mean, vec3f(0.0)));
  s.lmean = l1 / 25.0; s.lsig = sqrt(max(l2 / 25.0 - s.lmean * s.lmean, 0.0));
  return s;
}
/** mean / σ (rgb and luminance) over the 5×5 round local tile position `lp`, from apron array A */
fn stats5(lp: vec2i) -> Stats {
  var m1 = vec3f(0.0); var m2 = vec3f(0.0); var l1 = 0.0; var l2 = 0.0;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let v = wgA[u32((lp.y + APR + dy) * AW + (lp.x + APR + dx))].xyz;
      m1 += v; m2 += v * v; let l = luminance(v); l1 += l; l2 += l * l;
    }
  }
  return statsOf(m1, m2, l1, l2);
}

// ============================================================== SHADOW client ==============================================================
var<workgroup> wgU: array<vec2f, 144>;   // the apron's unshadowed luminance per class (SHARED.zw) — loaded only under the occluded-light reading
/** stats5 for the shadow client, one class at a time (class 0 = apron A, 1 = B). Under the occluded-light reading a texel where the class has NO light (U < 1e-5) holds shPack's prior
 *  (ratio 1), not a measurement: it stands in as the centre's own sample, so it neither moves the mean nor widens the box (counted as it stood, a face one pixel wide among
 *  such texels — a door head, a board's edge, with a lamp of the class hidden behind the wall — had a history of 0 clamped up to mean − k·σ ≈ 0.3 and showed the lamp's U as a
 *  bright line). Flag off = stats5 term for term over the class's own apron (wgU is not loaded then and not read). */
fn stats5Sh(lp: vec2i, cls: u32) -> Stats {
  let occl = (dn.flags.x & DNF_SH_OCCL) != 0u; let b = cls == 1u;
  let ci = u32((lp.y + APR) * AW + (lp.x + APR));
  var c = wgA[ci].xyz; if (b) { c = wgB[ci].xyz; }
  var m1 = vec3f(0.0); var m2 = vec3f(0.0); var l1 = 0.0; var l2 = 0.0;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let i = u32((lp.y + APR + dy) * AW + (lp.x + APR + dx));
      var v = wgA[i].xyz; if (b) { v = wgB[i].xyz; }
      if (occl) { let u = wgU[i]; if (select(u.x, u.y, b) < 1e-5) { v = c; } }
      m1 += v; m2 += v * v; let l = luminance(v); l1 += l; l2 += l * l;
    }
  }
  return statsOf(m1, m2, l1, l2);
}
/** 5×5 mean of the luminance of S = ratio × U per class (.x class 0, .y class 1) round local tile position `lp`: the neighbourhood read under the OCCLUDED hypothesis */
fn meanS5(lp: vec2i) -> vec2f {
  var m = vec2f(0.0);
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let i = u32((lp.y + APR + dy) * AW + (lp.x + APR + dx));
      m += vec2f(luminance(wgA[i].xyz), luminance(wgB[i].xyz)) * wgU[i];
    }
  }
  return m / 25.0;
}
/** fetchFoot of a value history (ratio_acc, lumU) that also returns, in .us, the unshadowed luminance the fetched RATIO stands under read as hidden light: Σ w·l·U / Σ w·l
 *  (so that ratio × us is the footprint's interpolated S exactly — the plain interpolated U times the interpolated ratio over-reads it wherever U is steep, every frame again) */
struct HistU { v: vec4f, us: f32 };
fn fetchFootU(t: texture_2d<f32>, f: Foot) -> HistU {
  var acc = vec4f(0.0); var ls = 0.0; var l = 0.0;
  for (var i = 0; i < 4; i++) {
    let w = f.w[i]; if (w <= 0.0) { continue; }
    let v = textureLoad(t, f.base + vec2i(i & 1, i >> 1), 0); let lv = luminance(v.xyz) * w;
    acc += v * w; l += lv; ls += lv * v.a;
  }
  var o: HistU; o.v = acc / max(f.sum, 1e-6); o.us = select(o.v.a, ls / l, l > 1e-7);
  return o;
}
// ---- the OCCLUDED-LIGHT reading (flags bit 64, settings.dnShadowOccl) ----
// The ratio r = S/U is only smooth where the lights of a class share their visibility. A light that is in U but HIDDEN from the pixel — a guard's torch on the other side of a
// wall, a few metres off and a hundred times brighter unshadowed than the lamp that does light the floor — puts its whole footprint into the denominator: r = S_rest / (U_rest + T)
// then carries the torch's cone, falloff and every step it takes, although S has none of it. Averaging such ratios (over taps, or over frames while the torch bobs) and multiplying
// the exact U back in does not return S: it returns S × (U here now) × mean(1/U) — the beam's shape, faint, on the far side of the wall (a thin bright arc along the cone's edge
// where another light shows the floor, a pale wedge walking with the guard; the maintainer, 10-10: "very subtle artifacting for flashlights that goes through occluders").
// Two readings of another sample (a tap q, or the history) of ratio r_q taken under U_q, seen from a pixel under U_c: SAME VISIBILITY (the lights that differ between them are as
// visible as the rest: r_q stands — the filter as it was) and OCCLUDED (they are hidden: S is what carries over, r_q × U_q/U_c). Both are physical and everything between them is
// a partly hidden light, so the sample is read as the point of that segment NEAREST the centre's own evidence (the à-trous: its ratio; the history: see shTemporal): where the occluded reading does not bring
// the sample closer — every visible light: a lit pixel's ratio rises with U, the occluded reading says it falls — nothing changes, and where U is the same on both sides (no
// carried light near, nothing flickering) the factor is exactly 1. The result never leaves the span between the sample and the evidence, so it adds no value the filter did not
// already hold.
// The same bit also governs shTemporal's NEIGHBOURHOOD STATISTICS (stats5Sh): a texel where the class has no light at all carries the prior, not a measurement, and is left out
// of the 5×5 mean / σ, and the history clamp's box always holds the pixel's own sample.
/** how to read a sample of ratio luminance `lq` taken under unshadowed luminance `uq`, from a centre under `uc` whose evidence is `lc`: .x = the scale, 1 (same visibility) … uq/uc (occluded); .y = the share 0‥1 of the occluded reading in it */
fn occlScale(lq: f32, uq: f32, uc: f32, lc: f32) -> vec2f {
  if (uq < 1e-5 || uc < 1e-5) { return vec2f(1.0, 0.0); }
  let k = min(uq / uc, 4096.0); let dl = lq * (k - 1.0);
  if (abs(dl) < 1e-6) { return vec2f(1.0, 0.0); }
  let t = clamp((lc - lq) / dl, 0.0, 1.0);
  return vec2f(mix(1.0, k, t), t);
}
// ---- pack: S,U → ratio + hint (CUR_c), (hints, lumU) → SHARED, and the per-tile hint flag softtile.wgsl's tileDistances turns into the chain's pass-through mask ----
@group(1) @binding(10) var pkS0: texture_2d<f32>;
@group(1) @binding(11) var pkS1: texture_2d<f32>;
@group(1) @binding(12) var pkU0: texture_2d<f32>;
@group(1) @binding(13) var pkU1: texture_2d<f32>;
@group(1) @binding(20) var pkCur0: texture_storage_2d<rgba16float, write>;
@group(1) @binding(21) var pkCur1: texture_storage_2d<rgba16float, write>;
@group(1) @binding(22) var pkShared: texture_storage_2d<rgba16float, write>;
@group(1) @binding(23) var pkTile: texture_storage_2d<r32uint, write>;
var<workgroup> wgHint: atomic<u32>;
fn ratioOfU(S: vec3f, U: vec3f) -> vec3f { return clamp(S / max(U, vec3f(1e-4)), vec3f(0.0), vec3f(dn.sh2.w)); }
@compute @workgroup_size(8, 8)
fn shPack(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  if (li == 0u) { atomicStore(&wgHint, 0u); }
  workgroupBarrier();
  let dims = textureDimensions(pkS0);
  if (gid.x < dims.x && gid.y < dims.y) {
    let pc = vec2i(gid.xy);
    let s0 = textureLoad(pkS0, pc, 0); let s1 = textureLoad(pkS1, pc, 0);
    let u0t = textureLoad(pkU0, pc, 0); let u1t = textureLoad(pkU1, pc, 0); let u0 = u0t.xyz; let u1 = u1t.xyz;
    let l0 = luminance(u0); let l1 = luminance(u1);
    // a class with no light here: ratio 1 (the prior a light sweeping on finds: lit) — its S = U × r is 0 whatever r says
    let r0 = select(vec3f(1.0), ratioOfU(s0.xyz, u0), l0 >= 1e-5);
    let r1 = select(vec3f(1.0), ratioOfU(s1.xyz, u1), l1 >= 1e-5);
    // CUR.a = the luminance the temporal stage's light cues watch: the BELIEVED-VISIBLE part of U when the estimator supplies it (ReSTIR: U.a, flags bit 32), else U itself.
    // (Nothing downstream reads a hint from CUR: the hints travel in SHARED.xy; the à-trous chain starts from HV.)
    let cueUv = (dn.flags.x & DNF_CUE_UV) != 0u;
    let q0 = select(l0, max(u0t.a, 0.0), cueUv); let q1 = select(l1, max(u1t.a, 0.0), cueUv);
    textureStore(pkCur0, pc, vec4f(r0, q0));
    textureStore(pkCur1, pc, vec4f(r1, q1));
    textureStore(pkShared, pc, vec4f(s0.a, s1.a, l0, l1));   // hints SIGNED as they come: < 0 = this pixel's own blocker measurement, ±0 = none (softblur's convention, dilated the same way below)
    if (s0.a != 0.0 || s1.a != 0.0) { atomicOr(&wgHint, 1u); }   // exactly softtile.wgsl markTiles' predicate (−0.0 == 0.0: a lit pixel flags nothing)
  }
  workgroupBarrier();
  if (li == 0u) { textureStore(pkTile, vec2i(wid.xy), vec4u(atomicLoad(&wgHint), 0u, 0u, 0u)); }
}

// ---- temporal: both classes in one dispatch ----
// Value history HV_c = (accumulated ratio.rgb, lumU_c that frame); moment history HM = (m1_0, ewvar_0, m1_1, ewvar_1): the exponentially weighted mean and VARIANCE of each
// class's incoming sample luminance (West's incremental form — no second raw moment to cancel catastrophically at f16); HG as above. The lumU riding in HV.a is the light cues'
// memory: the EXACT unshadowed field only changes at a surface point when a light of the class moves, switches or flickers — and only then can that class's SHADOWS have moved
// under a still receiver — so a relative change beyond dn.sh.w per frame drops that class's history to the short 'moving' length (flags.z frames: today's dtemporal regime,
// responsive) while everything under still light keeps the long, smooth one; the JUMP (below) measures the same change against what the pixel BELIEVES reaches it (CUR.a).
// (Until 08-11 both cues keyed on the believed-visible luminance itself — and ReSTIR's per-pixel dark memory flips in every penumbra of a sized emitter, tile beliefs at
// their borders: each flip read as a light switching, the history was cut or restarted with the value leant on a 5×5 that straddles the shadow edge, and every silhouette,
// wall foot and sill line under the sodium lamps wore a bright rim while their penumbrae boiled — the maintainer's 'direct light … still weird at rims … lots of boiling by
// the cubicle window … goes away when I turn off the v3 denoiser'. A belief changing is not the light changing: the exact U tells them apart for nothing.)
// A moving OCCLUDER under still light is the neighbourhood clamp's business, as it always was.
@group(1) @binding(30) var stCur0: texture_2d<f32>;      // CUR_0 (ratio, believed-visible luminance) this frame
@group(1) @binding(31) var stCur1: texture_2d<f32>;
@group(1) @binding(32) var stShared: texture_2d<f32>;    // (hint0, hint1, lumU0, lumU1) this frame
@group(1) @binding(33) var stHv0: texture_2d<f32>;       // last frame's HV_0 (ratio_acc, lumU) — filterable
@group(1) @binding(34) var stHv1: texture_2d<f32>;
@group(1) @binding(35) var stHm: texture_2d<f32>;        // last frame's (m1_0, var_0, m1_1, var_1) — filterable
@group(1) @binding(36) var stHg: texture_2d<u32>;        // last frame's geometry (depth | len0 | len1 | normal)
@group(1) @binding(40) var stHv0Out: texture_storage_2d<rgba16float, write>;
@group(1) @binding(41) var stHv1Out: texture_storage_2d<rgba16float, write>;
@group(1) @binding(42) var stHmOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(43) var stHgOut: texture_storage_2d<r32uint, write>;
@compute @workgroup_size(8, 8)
fn shTemporal(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let dims = vec2i(textureDimensions(stCur0)); let hi = dims - 1;
  // apron: the tile's 12×12 neighbourhood of both classes' ratios (edge-clamped) → workgroup memory
  let org = vec2i(wid.xy) * 8 - APR;
  for (var i = li; i < AN; i += 64u) {
    let q = clamp(org + vec2i(i32(i) % AW, i32(i) / AW), vec2i(0), hi);
    wgA[i] = textureLoad(stCur0, q, 0); wgB[i] = textureLoad(stCur1, q, 0);
    if ((dn.flags.x & DNF_SH_OCCL) != 0u) { wgU[i] = textureLoad(stShared, q, 0).zw; }
  }
  workgroupBarrier();
  if (gid.x >= u32(dims.x) || gid.y >= u32(dims.y)) { return; }
  let pc = vec2i(gid.xy); let lp = vec2i(lid.xy);
  let ci = u32((lp.y + APR) * AW + (lp.x + APR));
  let c0 = wgA[ci]; let c1 = wgB[ci];
  let q0 = c0.a; let q1 = c1.a;   // the luminance each class BELIEVES reaches the pixel (shPack: ReSTIR's believed-visible mix; = lumU without it) — the jump's yardstick
  let depth = textureLoad(gDepth, pc, 0);
  let P = worldFromDepth(vec2f(pc) + 0.5, depth);
  let zNow = (frame.viewProj * vec4f(P, 1.0)).w;
  let nrm = normalize(textureLoad(gNormal, pc, 0).xyz * 2.0 - 1.0);
  let cap = min(dn.sh.y * dn.sh2.z, 31.0);
  let sA = stats5Sh(lp, 0u); let sB = stats5Sh(lp, 1u);   // (unlit texels of a class left out under the occluded-light reading; flag off = stats5 over each class's apron)
  let l0 = luminance(c0.xyz); let l1 = luminance(c1.xyz);
  let hs = textureLoad(stShared, pc, 0); let lu0 = hs.z; let lu1 = hs.w;   // (hint0, hint1, lumU0, lumU1): the classes' EXACT unshadowed luminance here this frame — HV.a keeps it for next frame's comparison
  if (depth >= 1.0 || cap < 1.0 || (dn.flags.x & DNF_SH_TEMPORAL) == 0u) {   // sky / temporal reuse off: this frame's ratio as it is, its variance the neighbourhood's, no history kept
    textureStore(stHv0Out, pc, vec4f(c0.xyz, lu0)); textureStore(stHv1Out, pc, vec4f(c1.xyz, lu1));
    textureStore(stHmOut, pc, vec4f(l0, sA.lsig * sA.lsig, l1, sB.lsig * sB.lsig)); textureStore(stHgOut, pc, vec4u(packHG(zNow, 0.0, 0.0, nrm), 0u, 0u, 0u));
    return;
  }
  // ---- reproject + validate the 2×2 footprint (one gather of the packed depth | lengths | normal texels): a tap counts if it holds the depth this point had last frame AND a
  // normal within ~53° of ours ----
  let rp = reproject(P, pc);
  var n0 = 0.0; var n1 = 0.0; var h0 = vec4f(c0.xyz, lu0); var h1 = vec4f(c1.xyz, lu1); var hm = vec4f(0.0); var have = false;
  let occl = (dn.flags.x & DNF_SH_OCCL) != 0u; var us0 = lu0; var us1 = lu1;   // (us: the history's U as the occluded reading wants it — fetchFootU)
  if (rp.ok) {
    let hp = rp.pxPrev;                                            // same resolution: history texel coords = full-res px
    let uvG = (floor(hp - 0.5) + 1.0) / vec2f(dims);               // the corner shared by the footprint's four texels: gather fetches exactly those
    let g = gatherOrderU(textureGather(0, stHg, nearSamp, uvG));
    var d4 = vec4f(hgDepth(g.x), hgDepth(g.y), hgDepth(g.z), hgDepth(g.w));
    let nOk = vec4f(dot(hgNormal(g.x), nrm), dot(hgNormal(g.y), nrm), dot(hgNormal(g.z), nrm), dot(hgNormal(g.w), nrm)) > vec4f(0.6);
    d4 = select(vec4f(-1e6), d4, nOk);                             // a tap on another face fails like a tap at another depth
    let tol = select(0.008, 0.025, rp.vel > 1e-4);                 // ~0.8 %: a shin in front of the floor is another surface; looser where the surface itself moved (a man closing on the camera changes depth by centimetres a frame)
    let f = footprint(hp, dims, d4, rp.zPrev, tol);
    if (f.sum > 0.05) {
      have = true;
      n0 = dot(vec4f(hgLen0(g.x), hgLen0(g.y), hgLen0(g.z), hgLen0(g.w)), f.w);   // footprint-weighted history lengths (a half-disoccluded footprint counts half)
      n1 = dot(vec4f(hgLen1(g.x), hgLen1(g.y), hgLen1(g.z), hgLen1(g.w)), f.w);
      if (occl) { let a = fetchFootU(stHv0, f); let b = fetchFootU(stHv1, f); h0 = a.v; us0 = a.us; h1 = b.v; us1 = b.us; }   // tap by tap: the occluded reading interpolates S, not the ratio
      else if (f.whole) { let uv = hp / vec2f(dims); h0 = textureSampleLevel(stHv0, linSamp, uv, 0.0); h1 = textureSampleLevel(stHv1, linSamp, uv, 0.0); }
      else { h0 = fetchFoot(stHv0, f); h1 = fetchFoot(stHv1, f); }   // partial footprint: renormalised over the valid taps
      if (f.whole) { hm = textureSampleLevel(stHm, linSamp, hp / vec2f(dims), 0.0); } else { hm = fetchFoot(stHm, f); }
    }
  }
  // ---- the OCCLUDED-LIGHT reading of the history (occlScale): where the unshadowed light this class's history was taken under is not this frame's — a carried light moved,
  // or merely the sub-pixel jitter slid the footprint along a steep stretch of U — and this frame says the ratio moved the way a HIDDEN light's change moves it (S stayed), the
  // history follows — value, sample mean and variance — and that share (ex) of the change is no light-JUMP below: nothing the pixel can see jumped, and the jump's lean
  // on the 5×5 mean ratio is the wrong number there. (The light-motion cue is left as it is: a history kept short while a hidden light sweeps costs a little noise, and the
  // cue stays exactly what a VISIBLE torch's moving shadows were tuned on.) The
  // evidence is a 5×5 mean of this frame (quiet: 25 samples), read under whichever hypothesis the pixel's own sample sits nearer: the mean RATIO (right where the lights that
  // vary across the neighbourhood are visible) or the mean S over this pixel's U (right where they are hidden — there the mean ratio straddles the hidden cone's edge, ratios a
  // hundredfold apart, and a history led to THAT is the beam's edge drawn on the floor). ----
  var ex0 = 0.0; var ex1 = 0.0;
  if (have && occl) {
    let mS = meanS5(lp) / max(vec2f(lu0, lu1), vec2f(1e-5));
    let lq0 = luminance(h0.xyz); let e0 = select(sA.lmean, mS.x, abs(mS.x - l0) < abs(sA.lmean - l0));
    let lq1 = luminance(h1.xyz); let e1 = select(sB.lmean, mS.y, abs(mS.y - l1) < abs(sB.lmean - l1));
    var f0 = occlScale(lq0, us0, lu0, e0); var f1 = occlScale(lq1, us1, lu1, e1);
    // (the pixel's own sample has the last word AGAINST: a mean is 25 pixels of somewhere else — beside a hard shadow of a visible torch it sits below a lit pixel's ratio and
    // would lead its history down each frame the torch moves — so a history that already agrees with this pixel's sample better than the led one agrees with the mean stands)
    if (abs(lq0 - l0) <= abs(lq0 * f0.x - e0)) { f0 = vec2f(1.0, 0.0); }
    if (abs(lq1 - l1) <= abs(lq1 * f1.x - e1)) { f1 = vec2f(1.0, 0.0); }
    let rHi = dn.sh2.w;   // (the ratio's own ceiling: a scale of thousands on a firefly's variance is past what the history textures hold)
    ex0 = f0.y; h0 = vec4f(min(h0.xyz * f0.x, vec3f(rHi)), h0.a); hm.x = min(hm.x * f0.x, rHi); hm.y = min(hm.y * f0.x * f0.x, rHi * rHi);
    ex1 = f1.y; h1 = vec4f(min(h1.xyz * f1.x, vec3f(rHi)), h1.a); hm.z = min(hm.z * f1.x, rHi); hm.w = min(hm.w * f1.x * f1.x, rHi * rHi);
  }
  // ---- the two motion cues per class → the 'moving' history length. LIGHT: relative change of the exact unshadowed luminance at this surface point since last frame (a torch
  // sweeping, a switch — the only way a still receiver's shadows of the class move under a still occluder). OCCLUDER (a man walking under still panels, a swinging leaf): the
  // temporal GRADIENT — the reprojected history against this frame's 5×5 mean, in units of the frame's own σ (the mean of 25 samples wanders by ~σ/5, so a converged history
  // under a still shadow reads ≪ 1; a shadow that walked a texel reads > 1). Either drops that class's cap to movCap; neither costs a fetch. ----
  let movCap = f32(dn.flags.z); let thr = dn.sh.w;
  var cap0 = cap; var cap1 = cap;
  let du0 = abs(lu0 - h0.a) / max(max(lu0, h0.a), 1e-4); let du1 = abs(lu1 - h1.a) / max(max(lu1, h1.a), 1e-4);
  // A DRAWN character shadow (SDF rig, use iii — direct_common.wgsl SOFT_HINT_FLAG in the class's hint slot: no box penumbra measured or remembered at the pixel, a man's analytic
  // term on it): the incoming ratio carries no visibility noise, so where it MOVES (the occluder cue below) the history is not shortened to movCap but dropped — this frame's
  // ratio whole, nothing to trail a walking man's penumbra by — while at rest it accumulates as ever (the estimator's own weight noise still wants the average).
  var mc0 = movCap; var mc1 = movCap;
  let det0 = hs.x < 0.0 && hs.x > -SOFT_HINT_BAND; let det1 = hs.y < 0.0 && hs.y > -SOFT_HINT_BAND;
  if (det0) { mc0 = 1.0; } if (det1) { mc1 = 1.0; }
  if (have && movCap >= 1.0) {
    let gr0 = abs(luminance(h0.xyz) - sA.lmean) / (sA.lsig + 0.03); let gr1 = abs(luminance(h1.xyz) - sB.lmean) / (sB.lsig + 0.03);
    cap0 = mix(cap, min(cap, mc0), max(smoothstep(thr, 3.0 * thr, du0), smoothstep(0.6, 1.6, gr0)));
    cap1 = mix(cap, min(cap, mc1), max(smoothstep(thr, 3.0 * thr, du1), smoothstep(0.6, 1.6, gr1)));
  }
  // A light of the class JUMPED at this point (its cue luminance changed by more than flags.w ‰ of itself within the frame: a switch, a fluorescent's dropout stroke, a
  // lightning stroke arriving or gone). Wherever that light's visibility differs from the rest of the class's — its own penumbrae and umbrae — the ratio S/U is now
  // another number: the VALUE history is taken from this frame (α 1), but the sample VARIANCE is carried as it was and the mean it is measured about snaps to the new
  // level (jmp, below) — the visibility noise of the pixel did not change with the light's intensity, whereas West's update would book the level step itself as
  // variance, (l − m₁)² for 1/α frames, and the à-trous, guided by that σ, opened its luminance edge-stop and blurred every shadow the light casts into its lit
  // surround for a dozen frames after each stroke: shadows that filled in and emptied with the flicker (the low strokes 16–24 % bright in the umbra tiles, the lit
  // ones 6–9 % dark — the 'pumping' of docs/internal/tjank.md §A, present under either estimator). The history LENGTH is left alone (no young-history fallback to the
  // neighbourhood's variance, which is just as wide at a shadow edge). A torch drifting over the pixel changes U by far less per frame and keeps the moving history above.
  // The jump is the SAME exact change of U, measured against what the pixel believes reaches it (a fluorescent's stroke is 85 % of the light on the desk under it and a
  // fifth of U there; a far lamp switching behind three lit panels is not a jump for this desk) — floored at JUMP_REL_FLOOR of U so a pixel that believes next to nothing
  // visible (deep in every umbra) does not read a torch drifting three rooms off as a stroke. A belief flipping moves U by exactly nothing: no jump, no cut.
  // (Last frame's believed-visible share is not kept: it is estimated as last frame's U × this frame's fraction — so with no beliefs at all (?norestir: q = lumU) the yardstick is
  // max(U now, U then) exactly as the cue always was, and a departing stroke is measured against what stood beside it before it went.)
  let jump = f32(dn.flags.w) * 0.001;
  let fq0 = q0 / max(lu0, 1e-4); let fq1 = q1 / max(lu1, 1e-4);
  let dj0 = (1.0 - ex0) * abs(lu0 - h0.a) / max(max(max(q0, h0.a * fq0), JUMP_REL_FLOOR * max(lu0, h0.a)), 1e-4); let dj1 = (1.0 - ex1) * abs(lu1 - h1.a) / max(max(max(q1, h1.a * fq1), JUMP_REL_FLOOR * max(lu1, h1.a)), 1e-4);
  let jmp0 = have && jump > 0.0 && dj0 > jump; let jmp1 = have && jump > 0.0 && dj1 > jump;
  n0 = min(n0 * dn.sh2.z, cap0 - 1.0) + 1.0; n1 = min(n1 * dn.sh2.z, cap1 - 1.0) + 1.0;   // this frame makes n (1 = no history)
  var a0 = select(1.0 / n0, 1.0, jmp0); var a1 = select(1.0 / n1, 1.0, jmp1);
  // … and since a drawn term does not fluctuate at rest, a flagged pixel whose ratio CHANGED since last frame (by more than the estimator's weight noise: a relative
  // ramp 6 → 16 %) has moved — take this frame's value by that much, whatever the 5×5 occluder cue made of it (at a crisp moving edge the neighbourhood's own σ
  // swallows that cue and left four fifths of the stale edge in place: the drawn penumbra trailed MORE than the sampled one until this line).
  // — but only where the pixel's own sample history says the term IS steady (EW variance of the incoming luminance ≈ 0): under ReSTIR a pixel lit by two sharp lights the man
  // shadows differently alternates its ratio with the reservoir's pick, and reading that as motion would replay the pick noise at full amplitude every frame.
  if (det0 && have && hm.y < pow(0.06 * max(l0, hm.x) + 0.01, 2.0)) { let lh = luminance(h0.xyz); a0 = max(a0, smoothstep(0.06, 0.16, abs(l0 - lh) / (max(l0, lh) + 0.05))); }
  if (det1 && have && hm.w < pow(0.06 * max(l1, hm.z) + 0.01, 2.0)) { let lh = luminance(h1.xyz); a1 = max(a1, smoothstep(0.06, 0.16, abs(l1 - lh) / (max(l1, lh) + 0.05))); }
  // ---- clamp the history into this frame's neighbourhood (per channel, k·σ; σ floored so a converged flat region does not reject a history that differs by a hair) ----
  let k = dn.sh.x;
  var hv0 = h0.xyz; var hv1 = h1.xyz;
  if (have) {
    let e0 = sA.sigma * k + vec3f(0.004); let e1 = sB.sigma * k + vec3f(0.004);
    var lo0 = sA.mean - e0; var hi0 = sA.mean + e0; var lo1 = sB.mean - e1; var hi1 = sB.mean + e1;
    // (occluded-light reading: the box always holds the pixel's OWN sample — a 1-px face among faces of another ratio is never led off what its own rays say)
    if (occl) { lo0 = min(lo0, c0.xyz); hi0 = max(hi0, c0.xyz); lo1 = min(lo1, c1.xyz); hi1 = max(hi1, c1.xyz); }
    hv0 = clamp(hv0, lo0, hi0); hv1 = clamp(hv1, lo1, hi1);
  }
  var o0 = mix(hv0, c0.xyz, a0); var o1 = mix(hv1, c1.xyz, a1);
  // On a jump frame the value is this frame's alone (a 1); its one-sample outliers — a reservoir whose weight has drifted high shows its light several times over for a
  // frame, the sparkle a long history normally swallows — are capped at the neighbourhood's mean + JUMP_CAP·σ (one-sided: the estimator's excursions are bright ones) and
  // the pixel leans JUMP_LEAN_* of the way on that 5×5 mean (per class): level exact where the ratio is flat, the light's own shadow edges half a box soft for the one frame.
  if (jmp0) { let cc = min(c0.xyz, sA.mean + sA.sigma * JUMP_CAP); o0 = mix(cc, sA.mean, JUMP_LEAN_SHARP); }
  if (jmp1) { let cc = min(c1.xyz, sB.mean + sB.sigma * JUMP_CAP); o1 = mix(cc, sB.mean, JUMP_LEAN_BROAD); }
  // ---- EW mean / variance of the incoming SAMPLE luminance (the temporal variance of the samples: high forever inside a penumbra, zero where every ray agrees); the spatial
  // (5×5) variance stands in while a class's history is young ----
  var mo: vec4f;
  if (have) {
    let d0 = l0 - hm.x; let d1 = l1 - hm.z;
    mo = vec4f(hm.x + a0 * d0, (1.0 - a0) * (hm.y + a0 * d0 * d0), hm.z + a1 * d1, (1.0 - a1) * (hm.w + a1 * d1 * d1));
    if (jmp0) { mo.x = l0; mo.y = hm.y; }   // (the jump: mean to the new level, variance carried — see above)
    if (jmp1) { mo.z = l1; mo.w = hm.w; }
  } else { mo = vec4f(l0, 0.0, l1, 0.0); }
  if (n0 < 4.0 && !jmp0) { mo.y = mix(mo.y, max(mo.y, sA.lsig * sA.lsig), (4.0 - n0) / 3.0); }   // (young history: the neighbourhood's variance stands in — not on a jump frame, whose carried variance is the better number and whose 5×5 straddles the new shadow edges)
  if (n1 < 4.0 && !jmp1) { mo.w = mix(mo.w, max(mo.w, sB.lsig * sB.lsig), (4.0 - n1) / 3.0); }
  textureStore(stHv0Out, pc, vec4f(o0, lu0));
  textureStore(stHv1Out, pc, vec4f(o1, lu1));
  textureStore(stHmOut, pc, mo);
  textureStore(stHgOut, pc, vec4u(packHG(zNow, n0, n1, nrm), 0u, 0u, 0u));
}

// ---- à-trous (both classes), STRIDE 1/2/4/8/16; FIRST = 1 takes each texel's variance from the moments texture (the value history carries lumU in .a, not variance);
// FINAL = 1 writes S = U × r̂ (what composite / fgather read) instead of the ratio ----
override STRIDE: i32 = 1;
override FINAL: bool = false;
override FIRST: bool = false;   // (shared with radAtrous below: the first iteration of either chain reads its variance from the moments texture)
@group(1) @binding(50) var saIn0: texture_2d<f32>;       // (ratio, var) class 0 — or, FIRST, (ratio, lumU) with the variance in saHm.y
@group(1) @binding(51) var saIn1: texture_2d<f32>;       //                     … saHm.w
@group(1) @binding(52) var saShIn: texture_2d<f32>;      // (hint0, hint1, lumU0, lumU1), hints dilated by the iterations before this one
@group(1) @binding(53) var saMask: texture_2d<u32>;      // per 8×8 tile: bit 256 = no hint within the chain's reach of this tile — pass it through (softtile.wgsl tileDistances)
@group(1) @binding(54) var saU0: texture_2d<f32>;        // U per class (FINAL only)
@group(1) @binding(55) var saU1: texture_2d<f32>;
@group(1) @binding(56) var saHm: texture_2d<f32>;        // this frame's moments (m1_0, var_0, m1_1, var_1) (FIRST only)
@group(1) @binding(57) var saHg: texture_2d<u32>;        // this frame's geometry texel (the history lengths — the diagnostic view only)
const DN_DEBUG_VIEW: u32 = 13u;   // composite debug view 13 = the shadow client's state instead of its light: r = σ class 0, g = σ class 1 (√ of the filtered sample variance, ×2), b = class 0's history length ÷ 31
@group(1) @binding(60) var saOut0: texture_storage_2d<rgba16float, write>;
@group(1) @binding(61) var saOut1: texture_storage_2d<rgba16float, write>;
@group(1) @binding(62) var saShOut: texture_storage_2d<rgba16float, write>;
/** what leaves an iteration for one class: FINAL → (U × ratio, signed hint) for the consumers; else (ratio, var) for the next iteration. (Every caller emits class 1
 *  before class 0 matters only under the diagnostic view, where class 1's σ is parked in dbgOut and written out with class 0's texel.) */
var<private> dbgOut: vec3f = vec3f(0.0);
fn shEmit(pc: vec2i, cls: u32, ratio: vec3f, v: f32, hintSigned: f32) {
  if (FINAL) {
    var U: vec3f; if (cls == 0u) { U = textureLoad(saU0, pc, 0).xyz; } else { U = textureLoad(saU1, pc, 0).xyz; }
    var o = vec4f(U * ratio, hintSigned);
    if (frame.debugView == DN_DEBUG_VIEW) {   // diagnostics ride out in class 0's texture (composite shows directTex raw under view 13; fgather's on-screen reuse reads it too, so the bounce is off while the view is up); class 1 keeps its light
      if (cls == 0u) { dbgOut.x = sqrt(max(v, 0.0)) * 2.0; dbgOut.z = hgLen0(textureLoad(saHg, pc, 0).x) / 31.0; o = vec4f(dbgOut, hintSigned); }
      else { dbgOut.y = sqrt(max(v, 0.0)) * 2.0; }
    }
    if (cls == 0u) { textureStore(saOut0, pc, o); } else { textureStore(saOut1, pc, o); }
  } else {
    let o = vec4f(ratio, v);
    if (cls == 0u) { textureStore(saOut0, pc, o); } else { textureStore(saOut1, pc, o); }
  }
}
@compute @workgroup_size(8, 8)
fn shAtrous(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u) {
  let dims = vec2i(textureDimensions(saIn0));
  if (gid.x >= u32(dims.x) || gid.y >= u32(dims.y)) { return; }
  let pc = vec2i(gid.xy); let hi = dims - 1;
  var cA = textureLoad(saIn0, pc, 0); var cB = textureLoad(saIn1, pc, 0); let sh = textureLoad(saShIn, pc, 0);
  if (FIRST) { let m = textureLoad(saHm, pc, 0); cA.a = m.y; cB.a = m.w; }   // the chain's first input: variance from the moments (whatever leaves this iteration carries it in .a)
  let prior = (dn.flags.x & DNF_SH_PRIOR) != 0u;
  // tile pass-through: no hint anywhere within the whole chain's reach of this tile → nothing here can differ from its input (softblur.wgsl's argument
  // carries over: WITH the hint prior the strength term below is 0 for every pixel further than the chain's travel from a hint) — copy through (FINAL: × U).
  // Without the prior every lit pixel filters at every stride, the mask would draw tile seams, and the host does not build it (passes.ts).
  if (prior && (frame.flags & FLAG_SOFT_TILESKIP) != 0u && (textureLoad(saMask, vec2i(wid.xy), 0).x & 256u) != 0u) {
    shEmit(pc, 1u, cB.xyz, cB.a, sh.y); shEmit(pc, 0u, cA.xyz, cA.a, sh.x); textureStore(saShOut, pc, sh);
    return;
  }
  let d0 = textureLoad(gDepth, pc, 0);
  let liveA = sh.z >= 1e-5; let liveB = sh.w >= 1e-5;   // a class with no light at this pixel is passed through untouched (and costs nothing below)
  if (d0 >= 1.0 || (!liveA && !liveB)) { shEmit(pc, 1u, cB.xyz, cB.a, sh.y); shEmit(pc, 0u, cA.xyz, cA.a, sh.x); textureStore(saShOut, pc, sh); return; }
  // pass 1 over the taps: the widest hint within this iteration's reach (dilation, as softblur: the lit half of a penumbra learns how wide it is from
  // the dark half, stride by stride) — the SHARED texel of every tap is wanted below for the lit-alike weight anyway
  let ownA = sh.x < -SOFT_HINT_BAND; let ownB = sh.y < -SOFT_HINT_BAND; let ownRA = abs(sh.x); let ownRB = abs(sh.y);   // (a drawn character shadow's flag — direct_common SOFT_HINT_FLAG, inside the band — is NOT an own measurement here: such a pixel inherits and is blurred by a neighbouring box penumbra's hint like any lit pixel, and lets that hint dilate across it; alone, its ⅓ px asks for nothing)
  var inhA = 0.0; var inhB = 0.0;
  for (var t = 0; t < 9; t++) {
    let q = clamp(pc + vec2i(t % 3 - 1, t / 3 - 1) * STRIDE, vec2i(0), hi);
    let s = textureLoad(saShIn, q, 0);
    if (liveA) { inhA = max(inhA, abs(s.x)); } if (liveB) { inhB = max(inhB, abs(s.y)); }
  }
  let aOutA = select(inhA, -ownRA, ownA); let aOutB = select(inhB, -ownRB, ownB);   // hint out: own stays own (signed), lit pixels carry the dilated wish onward
  // radius each class wants: its own measurement (nudged toward the neighbourhood — one pixel's blocker-distance guess can be unlucky) or, when it measured
  // nothing, whatever its neighbours ask for; strength = how much of THIS iteration's reach that is (softblur's term = the hint prior: contact hardening
  // from the blocker distance). With the prior off (flags bit 16 down): full strength wherever the class is lit — pure variance guidance.
  let wantA = min(select(inhA, max(ownRA, 0.3 * inhA), ownA) * MAX_BLUR_PX, frame.directCfg.z);
  let wantB = min(select(inhB, max(ownRB, 0.3 * inhB), ownB) * MAX_BLUR_PX, frame.directCfg.z);
  let reach = f32(STRIDE) * 1.5;
  let strA = select(1.0, smoothstep(reach * 0.5, reach * 1.25, wantA), prior);
  let strB = select(1.0, smoothstep(reach * 0.5, reach * 1.25, wantB), prior);
  let skipA = !liveA || strA <= 0.0 || (prior && !ownA && inhA <= 0.0);   // exact shortcuts: dead class, nothing asked of this iteration
  let skipB = !liveB || strB <= 0.0 || (prior && !ownB && inhB <= 0.0);
  let shOutV = vec4f(select(aOutA, sh.x, !liveA), select(aOutB, sh.y, !liveB), sh.z, sh.w);
  if (skipA && skipB) { shEmit(pc, 1u, cB.xyz, cB.a, shOutV.y); shEmit(pc, 0u, cA.xyz, cA.a, shOutV.x); textureStore(saShOut, pc, shOutV); return; }
  let P0 = worldFromDepth(vec2f(pc) + 0.5, d0);
  let z0 = distance(P0, frame.camPos);
  let n0 = textureLoad(gNormal, pc, 0).xyz * 2.0 - 1.0;
  let kz = dn.sh2.x; let kn = dn.sh2.y; let kl = dn.sh.z;
  let lA0 = luminance(cA.xyz); let lB0 = luminance(cB.xyz);
  // pass 2: geometry × lit-alike × luminance weights and the accumulation in ONE walk over the taps (no per-tap arrays: this pass is register-bound). The pixel's σ for
  // the luminance edge-stop is its own variance — the temporal EMA of its sample moments, already smooth in time; from the second iteration on it is the filtered one.
  let sigA = sqrt(max(cA.a, 0.0)); let sigB = sqrt(max(cB.a, 0.0));
  var accA = vec4f(0.0); var wsA = 0.0; var accB = vec4f(0.0); var wsB = 0.0;
  let litAlike = (dn.flags.x & DNF_LITALIKE) != 0u;
  let occl = (dn.flags.x & DNF_SH_OCCL) != 0u;   // the occluded-light reading of every tap (occlScale): a tap under another amount of HIDDEN light is read as the S it stands for
  for (var t = 0; t < 9; t++) {
    let dx = t % 3 - 1; let dy = t / 3 - 1;
    let q = clamp(pc + vec2i(dx, dy) * STRIDE, vec2i(0), hi);
    let d = textureLoad(gDepth, q, 0);
    if (d >= 1.0) { continue; }
    let Pq = worldFromDepth(vec2f(q) + 0.5, d);
    let nq = textureLoad(gNormal, q, 0).xyz * 2.0 - 1.0;
    let w = kb3(dx, dy) * geomWeight(P0, n0, z0, Pq, nq, kz, kn, 1.0);
    if (w <= 1e-6) { continue; }
    let s = textureLoad(saShIn, q, 0);
    var mq = vec4f(0.0); if (FIRST) { mq = textureLoad(saHm, q, 0); }
    if (!skipA && s.z >= 1e-5) {
      var wq = w * select(1.0, min(s.z, sh.z) / max(s.z, sh.z), litAlike);   // lit alike: never mix ratios across a cone edge / between different light footprints
      var a = textureLoad(saIn0, q, 0); if (FIRST) { a.a = mq.y; }
      if (occl) { let f = occlScale(luminance(a.xyz), s.z, sh.z, lA0).x; a = vec4f(min(a.xyz * f, vec3f(dn.sh2.w)), min(a.a * f * f, dn.sh2.w * dn.sh2.w)); }
      wq *= lumWeight(lA0, luminance(a.xyz), sigA, kl, 0.01);
      accA += vec4f(a.xyz * wq, a.a * wq * wq); wsA += wq;
    }
    if (!skipB && s.w >= 1e-5) {
      var wq = w * select(1.0, min(s.w, sh.w) / max(s.w, sh.w), litAlike);
      var b = textureLoad(saIn1, q, 0); if (FIRST) { b.a = mq.w; }
      if (occl) { let f = occlScale(luminance(b.xyz), s.w, sh.w, lB0).x; b = vec4f(min(b.xyz * f, vec3f(dn.sh2.w)), min(b.a * f * f, dn.sh2.w * dn.sh2.w)); }
      wq *= lumWeight(lB0, luminance(b.xyz), sigB, kl, 0.01);
      accB += vec4f(b.xyz * wq, b.a * wq * wq); wsB += wq;
    }
  }
  var rA = cA.xyz; var varA = cA.a; var rB = cB.xyz; var varB = cB.a;
  if (!skipA && wsA > 1e-4) { rA = mix(cA.xyz, accA.xyz / wsA, strA); varA = mix(cA.a, accA.a / (wsA * wsA), strA); }
  if (!skipB && wsB > 1e-4) { rB = mix(cB.xyz, accB.xyz / wsB, strB); varB = mix(cB.a, accB.a / (wsB * wsB), strB); }
  shEmit(pc, 1u, rB, varB, shOutV.y); shEmit(pc, 0u, rA, varA, shOutV.x);
  textureStore(saShOut, pc, shOutV);
}

// ============================================================== RADIANCE clients (diffuse GI, specular) ==============================================================
// Both live on a divided grid (1/div of the screen; texel g was computed at full-res pixel g·div + goff — fgather.wgsl / reflect.wgsl) with full-res guides.
override SPEC: bool = false;   // radTemporal / radAtrous: the specular client (virtual-hit reprojection, roughness-scaled clamp / reach / cap; its fast history holds the smoothed hit distance)
                               // (FIRST, declared with the shadow à-trous: radAtrous's first iteration reads its variance from the moments texture — the history carries view depth in .a)
fn gdivOf() -> i32 { return max(1, i32(dn.flags.y)); }
fn fullPx(g: vec2i) -> vec2i { let gdiv = gdivOf(); return min(g * gdiv + (gdiv - 1) / 2, vec2i(frame.screen) - 1); }
/** continuous full-res px → continuous texel coords of a gather-grid history (temporal.wgsl's mapping: a static camera lands on the texel it wrote, whatever the rounding of the sizes) */
fn gatherTexel(pxFull: vec2f) -> vec2f { let gdiv = f32(gdivOf()); let goff = floor((gdiv - 1.0) * 0.5); return (pxFull - goff - 0.5) / gdiv + 0.5; }
/** SPECULAR, per-pixel mode (dn.sp2.w > 0 — the reflection pass's chain): the roughness of what full-res pixel `full` shows (the g-buffer's material target), and whether a texel there holds
 *  a reflection term at all (rougher than the cutoff = matte / a character / a cap: no term — never a tap, never a history) */
fn perPixelSpec() -> bool { return SPEC && dn.sp2.w > 0.0; }
fn roughAt(full: vec2i) -> f32 { return textureLoad(gMatR, full, 0).x; }
const RT_TMAX_DN: f32 = 48.0;   // reflect.wgsl RT_TMAX: the hit distance a miss reports (as good as infinity for the mirror image's parallax)

@group(1) @binding(70) var rtCur: texture_2d<f32>;       // this frame's raw estimate (indirect: E rgb | spec: rgb + hit distance in .a, < 0 = no term at this texel)
@group(1) @binding(71) var rtHist: texture_2d<f32>;      // last frame's accumulated (rgb, view depth) — filterable, its .a gathered for validation
@group(1) @binding(72) var rtMom: texture_2d<f32>;       // last frame's (m1, ewvar, len, var)
@group(1) @binding(73) var rtFast: texture_2d<f32>;      // last frame's fast history (diffuse: fast rgb; specular: the smoothed hit distance in .x)
@group(1) @binding(80) var rtHistOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(81) var rtMomOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(82) var rtFastOut: texture_storage_2d<rgba16float, write>;
struct RadOut { hist: vec4f, mom: vec4f, fast: vec4f };
var<workgroup> wgSum: array<vec4f, 64>;   // per-pixel specular: per-lane partial sums of the apron's term texels (specTemporal)
var<workgroup> wgFill: vec4f;   // per-pixel specular: a texel of this tile that holds a term (or −1 in .a if none does) — the apron's no-term slots are filled with it for the statistics, and a no-term texel's
                                //  value history takes it (see radTemporalCore); the diffuse entry point never touches it
/** the radiance clients' temporal step for grid texel gid.xy (the apron already staged by radApron / radApronRaw): `cur4` = this texel's raw estimate (the apron's centre slot for the
 *  gather-grid clients; the guided upsample's value for the internal-res diffuse client), `sc` = the apron cell its 5×5 statistics are centred on (its own slot; the RAW gather texel under
 *  the pixel for the internal-res client); `hf` = the reprojected fast history is fetched here only when haveFastTex (every entry point but the stand-in specular binds it) */
fn radTemporalCore(gid: vec3u, haveFastTex: bool, cur4: vec4f, sc: vec2i) -> RadOut {
  var o: RadOut;
  let od = vec2i(textureDimensions(rtHist));   // (the HISTORY's grid: = rtCur's for the gather-grid clients; the internal size for the internal-res diffuse client, whose rtCur is the raw gather it takes its statistics from)
  let g = vec2i(gid.xy);
  var cur = cur4.xyz;
  let full = fullPx(g);
  let depth = textureLoad(gDepth, full, 0);
  let P = worldFromDepth(vec2f(full) + 0.5, depth);
  let zNow = (frame.viewProj * vec4f(P, 1.0)).w;
  var prm = dn.gi; var prm2 = dn.gi2; if (SPEC) { prm = dn.sp; prm2 = dn.sp2; }
  let cap = prm.y;
  var l = luminance(cur);
  let s = stats5(sc);
  if (depth >= 1.0 || cap < 1.0 || (dn.flags.x & DNF_TEMPORAL) == 0u) {   // sky / FLAG_TEMPORAL off: the raw estimate, spatial variance, no history
    o.hist = vec4f(cur, zNow); o.mom = vec4f(l, s.lsig * s.lsig, 0.0, s.lsig * s.lsig); o.fast = vec4f(cur, 0.0);
    if (perPixelSpec()) { o.fast = vec4f(max(cur4.a, 0.0), 0.0, 0.0, 0.0); o.mom.z = 1.0; }
    return o;
  }
  // ---- SPECULAR, per-pixel mode: the roughness of THIS pixel replaces the stand-in; a texel that holds no reflection keeps a clean slate (length 0) but its depth, so a neighbour's
  // bilinear fetch next frame still validates the three floor texels round a chair leg ----
  let pp = perPixelSpec();
  var rough = clamp(prm.w, 0.0, 1.0);
  let hitT = cur4.a;
  if (pp) {
    rough = roughAt(full);
    // no term here (matte / a man / a cap, or the trace declined): a clean slate (length 0) that keeps its depth — and, for its VALUE, the tile's representative reflection (wgFill, staged by
    // specTemporal; black only if the whole 8×8 tile holds none): composite samples this texture bilinearly and masks per full-res pixel, so a seam pixel of the polish reads its own side's
    // colour off the texel under the chair leg instead of a dark fringe; the à-trous passes such a texel through and never take it as a tap
    if (rough > prm2.w || hitT < 0.0) { let fill = wgFill; o.hist = vec4f(select(vec3f(0.0), fill.xyz, fill.a >= 0.0), zNow); o.mom = vec4f(0.0); o.fast = vec4f(0.0); return o; }
  }
  // firefly (diffuse): an incoming texel far above its own neighbourhood is an outlier one ray found — bounded to mean + z·σ before it can enter any history (0 = off; the gather's own per-ray bound stays)
  if (!SPEC && prm2.z > 0.0) { let lcap = s.lmean + prm2.z * s.lsig + 1e-4; if (l > lcap) { cur *= lcap / l; l = lcap; } }
  // ---- reprojection: the surface's own motion; the specular client blends toward the VIRTUAL hit point (the mirror image sits hitT beyond the surface along the view ray —
  // exact for a planar reflector: its parallax under a moving camera is that point's, not the floor's) by how mirror-like the surface is ----
  var rp = reproject(P, full);
  var zExpect = rp.zPrev; var tolV = -1.0;   // (per-pixel mode: the depth the footprint must have shown last frame, blended toward the mirror image's own; tolV ≥ 0 = use it)
  var hitUse = hitT;
  if (SPEC) {
    var vmix = prm2.z;
    if (pp) {
      if (vmix < 0.0) { vmix = 1.0 - smoothstep(0.4, 0.65, rough); }   // the mirror image for every finish that gets a ray at all (on a plane its blur is CENTRED on the mirror image whatever the roughness — reprojecting the floor
                                                                       // instead drags a vending front's reflection along under a turning camera and no clamp can tell at one ray a pixel); the surface only toward the cutoff
      // the ACCUMULATED hit distance the surface reprojection hands over places the mirror image far more steadily than this frame's one ray (rays scattered over the lobe land on the vending
      // front, the wall behind it, the floor trim: metres apart) — one bilinear read of last frame's fast history where this floor point was
      if (vmix > 0.0 && rp.ok && haveFastTex) {
        let hpS = gatherTexel(rp.pxPrev);
        if (all(hpS >= vec2f(0.5)) && all(hpS <= vec2f(od) - 0.5)) {
          let hPrev = textureSampleLevel(rtFast, linSamp, hpS / vec2f(od), 0.0).x;
          if (hPrev > 0.0) { hitUse = mix(hPrev, min(hitT, RT_TMAX_DN), 0.3); }
        }
      }
      if (vmix > 0.0 && hitUse > 0.0) {
        let V = normalize(P - frame.camPos);
        let Pv = P + V * min(hitUse, RT_TMAX_DN);
        let pv = frame.prevViewProj * vec4f(Pv, 1.0);
        if (pv.w > 1e-4) {
          let pxV = ((pv.xy / pv.w) * vec2f(0.5, -0.5) + 0.5) * frame.screen;
          // the surface point that SHOWED this mirror image last frame: last frame's eye ray toward Pv, cut by this pixel's plane — its view depth then is the mirror point's × the fraction of the way
          // the plane is crossed (linear along the ray); a shin, a chair or a wall that stood there last frame is another depth and the history starts over
          let nrm = normalize(textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0);
          let rd = Pv - frame.prevCam.xyz; let dnr = dot(nrm, rd);
          var zV = rp.zPrev; var okV = false;
          if (abs(dnr) > 1e-5) { let t = (dot(nrm, P) - dot(nrm, frame.prevCam.xyz)) / dnr; if (t > 0.0 && t < 1.0) { zV = pv.w * t; okV = true; } }
          if (okV) { rp.pxPrev = mix(rp.pxPrev, pxV, vmix); zExpect = mix(rp.zPrev, zV, vmix); tolV = mix(select(0.008, 0.025, rp.vel > 1e-4), 0.03, vmix); rp.ok = true; }
        }
      }
    } else {
      if (vmix < 0.0) { vmix = 1.0 - smoothstep(0.05, 0.45, rough); }   // mirror → all virtual; rough → all surface
      if (vmix > 0.0 && hitT > 0.0 && hitT < 1e3) {
        let V = normalize(P - frame.camPos);
        let Pv = P + V * hitT;
        let pv = frame.prevViewProj * vec4f(Pv, 1.0);
        if (pv.w > 1e-4) { let pxV = ((pv.xy / pv.w) * vec2f(0.5, -0.5) + 0.5) * frame.screen; rp.pxPrev = mix(rp.pxPrev, pxV, vmix); }
      }
    }
  }
  var n = 0.0; var h = cur; var hm = vec4f(0.0); var hf = cur; var have = false;
  if (rp.ok) {
    let hp = gatherTexel(rp.pxPrev);
    let uvG = (floor(hp - 0.5) + 1.0) / vec2f(od);
    let d4 = gatherOrder(textureGather(3, rtHist, linSamp, uvG));   // the four stored view depths
    var tol = select(select(0.008, 0.025, rp.vel > 1e-4), 0.05, SPEC);   // (specular stand-in mode: the virtual point's texel is another point of the same floor — same plane, nearby depth)
    if (tolV >= 0.0) { tol = tolV; }
    let f = footprint(hp, od, d4, zExpect, tol);
    if (f.sum > 0.05) {
      have = true;
      if (f.whole) { let uv = hp / vec2f(od); h = textureSampleLevel(rtHist, linSamp, uv, 0.0).xyz; hm = textureSampleLevel(rtMom, linSamp, uv, 0.0); if (haveFastTex) { hf = textureSampleLevel(rtFast, linSamp, uv, 0.0).xyz; } }
      else { h = fetchFoot(rtHist, f).xyz; hm = fetchFoot(rtMom, f); if (haveFastTex) { hf = fetchFoot(rtFast, f).xyz; } }
      n = hm.z * select(f.sum, 1.0, f.whole);
    }
  }
  // per-pixel specular: the frames of history a finish may keep — a mirror ~6 (its image must track a walking man's torch), lino ¾ of the cap, the cutoff all of it
  var capEff = cap;
  if (pp) { capEff = mix(min(cap, 6.0), cap, smoothstep(0.05, 0.3, rough)); }
  n = min(n, capEff - 1.0) + 1.0;
  let alpha = 1.0 / n;
  // ---- fast history (diffuse): a short EMA that follows a moved light within a few frames; the long history is clamped into a k·σ box CENTRED on it (ReLAX) —
  // tighter and steadier than centring on one raw frame's mean, so less lag AND less clamp-jitter; without it (spec / cap 0) the box centres on the 5×5 mean ----
  var centre = s.mean;
  var fastOut = cur;
  if (!SPEC && prm.w >= 1.0 && haveFastTex) {
    let af = max(alpha, 1.0 / prm.w);
    let hfC = clamp(select(s.mean, hf, have), s.mean - s.sigma * 2.5 - vec3f(0.002), s.mean + s.sigma * 2.5 + vec3f(0.002));   // the fast history itself only loosely held to the frame
    fastOut = mix(hfC, s.mean, af);   // fed the 5×5 MEAN, not the raw texel: its one job is to track a lighting change for the clamp's centre, and a centre that jitters with 4-ray noise would clamp noise INTO the long history
    centre = fastOut;
  }
  var kk = prm.x; if (SPEC) { kk *= mix(0.5, 1.5, clamp(rough * 2.0, 0.0, 1.0)); }   // specular: a mirror trusts its history less (tight box), a rough lobe more
  var nKeep = n;   // the length next frame continues from
  if (have) {
    let e = s.sigma * kk + vec3f(0.002) + 0.02 * s.mean;
    let hc = clamp(h, centre - e, centre + e);
    // per-pixel specular: shorten the history by how far the clamp had to move it, relative to the box's own size — a switched panel or a torch swung into the mirror direction converges in a few frames
    if (pp) { let moved = length(hc - h) / (length(e) * 2.0 + 0.05 * s.lmean + 0.01); nKeep = max(1.0, n * (1.0 - clamp(moved * 0.5, 0.0, 0.8))); }
    // diffuse, GI in motion (dn.gi3.x > 0): the same rule for the bounce — a valid pixel whose history the clamp had to drag (the light there CHANGED under a long history: a man's occlusion sliding
    // along the wall beside him) keeps a shorter history, so the next frames lean on the fresh estimate and the gather's young-history rays (fgather.wgsl, len < young) fire exactly there
    if (!SPEC && dn.gi3.x > 0.0) { let moved = length(hc - h) / (length(e) * 2.0 + 0.05 * s.lmean + 0.01); let c = clamp(moved * dn.gi3.x, 0.0, 0.8); nKeep = max(1.0, n * (1.0 - c)); if (c >= 0.6) { nKeep = min(nKeep, 3.0); } }   // (dragged most of a box: as young as a disocclusion, whatever the length was)
    h = hc;
  }
  let outC = mix(h, cur, alpha);
  // EW mean / variance of the incoming sample luminance (West's incremental form: no raw second moment — an HDR l² overflows f16 and never leaves); the spatial variance stands
  // in while the history is young; .w = what the à-trous reads, .y = the pure temporal term next frame continues
  var mo: vec2f;
  if (have) { let d = l - hm.x; mo = vec2f(hm.x + alpha * d, (1.0 - alpha) * (hm.y + alpha * d * d)); } else { mo = vec2f(l, 0.0); }
  var v = mo.y;
  if (n < 4.0) { v = mix(v, max(v, s.lsig * s.lsig), (4.0 - n) / 3.0); mo.y = v; }
  o.hist = vec4f(outC, zNow); o.mom = vec4f(mo, nKeep, v); o.fast = vec4f(fastOut, 0.0);
  // per-pixel specular: the fast slot carries the SMOOTHED hit distance instead (it only places the mirror image and sizes the blur — allowed to follow faster than the colour)
  if (pp) { var hPrevB = min(hitT, RT_TMAX_DN); if (have && haveFastTex && hf.x > 0.0) { hPrevB = hf.x; } o.fast = vec4f(mix(hPrevB, min(hitT, RT_TMAX_DN), max(alpha, 0.25)), 0.0, 0.0, 0.0); }
  return o;
}
fn radApron(wid: vec3u, li: u32) {
  let ohi = vec2i(textureDimensions(rtCur)) - 1;
  let org = vec2i(wid.xy) * 8 - APR;
  for (var i = li; i < AN; i += 64u) { let q = clamp(org + vec2i(i32(i) % AW, i32(i) / AW), vec2i(0), ohi); wgA[i] = textureLoad(rtCur, q, 0); }
  workgroupBarrier();
}
@compute @workgroup_size(8, 8)
fn giTemporal(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  radApron(wid, li);
  let od = textureDimensions(rtCur);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let lp = vec2i(lid.xy);
  let o = radTemporalCore(gid, true, wgA[u32((lp.y + APR) * AW + (lp.x + APR))], lp);
  textureStore(rtHistOut, gid.xy, o.hist); textureStore(rtMomOut, gid.xy, o.mom); textureStore(rtFastOut, gid.xy, o.fast);
}

// ---- the diffuse client at the INTERNAL resolution (settings.giFullRes, docs/internal/gi-motion.md): the raw ⅓ / ½-res gather is first brought to the internal grid by the same joint-bilateral
// 3×3 the composite always upsampled it with (giUpsample: depth-plane + normal guides at each texel's own sample pixel), and THAT is what the temporal step accumulates — history, moments,
// fast history and the à-trous chain all at internal res (dn.flags.y = 1 in this chain's parameter block: fullPx / gatherTexel are the identity), so a moving camera's reprojection error is
// an internal pixel instead of a gather texel and what residual noise survives is pixel-sized instead of texel-sized. The neighbourhood STATISTICS (clamp box, firefly bound, young
// variance) still come from the RAW gather texels — 5×5 of them round the pixel's own, staged from the gather-res texture (radApronRaw): the box that decides how much history a
// pixel may keep must span the estimator's real correlation length, not 5 interpolated pixels of it (a box that narrow clamps the long history down to the fast one and the picture
// boils MORE). Composite then reads the à-trous chain's output 1 : 1. ----
@group(1) @binding(74) var rtCurF: texture_2d<f32>;      // giTemporalF: the upsampled estimate at internal res (its own pixel's value); rtCur is then the RAW gather (the apron's statistics)
@group(1) @binding(84) var upOut: texture_storage_2d<rgba16float, write>;   // giUpsample's target (internal res)
/** stage 12×12 RAW gather texels centred on the texel under this 8×8 pixel tile's centre → wgA; returns the apron's origin texel (a pixel's own texel − it = its cell) */
fn radApronRaw(wid: vec3u, li: u32) -> vec2i {
  let gdiv = max(1, i32(dn.gi2.w));
  let rhi = vec2i(textureDimensions(rtCur)) - 1;
  let centreTexel = (vec2i(wid.xy) * 8 + 4) / gdiv;   // (composite's / giUpsample's `base = pix / gdiv`: the texel a pixel takes as its own)
  let org = centreTexel - AW / 2;
  for (var i = li; i < AN; i += 64u) { let q = clamp(org + vec2i(i32(i) % AW, i32(i) / AW), vec2i(0), rhi); wgA[i] = textureLoad(rtCur, q, 0); }
  workgroupBarrier();
  return org;
}
@compute @workgroup_size(8, 8)
fn giTemporalF(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let org = radApronRaw(wid, li);
  let od = textureDimensions(rtCurF);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let gdiv = max(1, i32(dn.gi2.w));
  let ownTexel = vec2i(gid.xy) / gdiv;                              // the raw texel this pixel takes as its own (composite's / giUpsample's `base`)
  let sc = clamp(ownTexel - org, vec2i(APR), vec2i(AW - 1 - APR)) - APR;   // stats5 adds APR back: the 5×5 round the pixel's own texel, kept inside the apron (an 8-px tile spans < 4 texels: it always is, the clamp is belt and braces)
  let o = radTemporalCore(gid, true, textureLoad(rtCurF, vec2i(gid.xy), 0), sc);
  textureStore(rtHistOut, gid.xy, o.hist); textureStore(rtMomOut, gid.xy, o.mom); textureStore(rtFastOut, gid.xy, o.fast);
}
/** the guided upsample: internal pixel ← the 3×3 raw gather texels round its own, weighed spatial × depth × normal exactly as composite.wgsl upsampleIndirect does (its statements) */
@compute @workgroup_size(8, 8)
fn giUpsample(@builtin(global_invocation_id) gid: vec3u) {
  let od = textureDimensions(upOut);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let pix = vec2i(gid.xy);
  let d0 = textureLoad(gDepth, pix, 0);
  if (d0 >= 1.0) { textureStore(upOut, pix, vec4f(0.0)); return; }
  let P0 = worldFromDepth(vec2f(pix) + 0.5, d0);
  let z = distance(P0, frame.camPos);
  let N = normalize(textureLoad(gNormal, pix, 0).xyz * 2.0 - 1.0);
  let hdims = vec2i(textureDimensions(rtCur));
  let gdiv = max(1, i32(dn.gi2.w)); let goff = (gdiv - 1) / 2;
  let inHi = vec2i(frame.screen) - 1;
  let base = pix / gdiv;
  var acc = vec3f(0.0); var wsum = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let h = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
      let src = min(h * gdiv + goff, inHi);                            // guides from exactly the pixel the texel was traced at
      let d = textureLoad(gDepth, src, 0);
      if (d >= 1.0) { continue; }
      let zs = distance(worldFromDepth(vec2f(src) + 0.5, d), frame.camPos);
      let ns = textureLoad(gNormal, src, 0).xyz * 2.0 - 1.0;
      let sp = vec2f(src - pix);
      var w = exp(-dot(sp, sp) * (0.18 * (4.0 / f32(gdiv * gdiv))));
      w *= exp(-abs(zs - z) / max(z * 0.02, 0.02));
      w *= pow(max(dot(ns, N), 0.0), 8.0) + 0.001;
      acc += textureLoad(rtCur, h, 0).xyz * w; wsum += w;
    }
  }
  var E = textureLoad(rtCur, clamp(base, vec2i(0), hdims - 1), 0).xyz;
  if (wsum >= 1e-5) { E = acc / wsum; }
  textureStore(upOut, pix, vec4f(E, 1.0));
}
@compute @workgroup_size(8, 8)
fn specTemporal(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  radApron(wid, li);
  if (perPixelSpec()) {
    // fill the apron's no-term slots (matte texels, characters, sky: alpha < 0, rgb 0) with a representative texel of the tile so the 5×5 mean / σ describe the reflection, not the seam —
    // the clamp box on the polish beside the carpet must not be dragged toward black. The representative: the mean of the apron's texels that have one (one thread sums them).
    var f = vec4f(0.0); for (var i = li; i < AN; i += 64u) { let a = wgA[i]; if (a.a >= 0.0) { f += vec4f(a.xyz, 1.0); } } wgSum[li] = f;   // each lane sums its ≤ 3 apron slots …
    workgroupBarrier();
    if (li == 0u) { var t = vec4f(0.0); for (var i = 0u; i < 64u; i++) { t += wgSum[i]; } wgFill = select(vec4f(0.0, 0.0, 0.0, -1.0), vec4f(t.xyz / max(t.w, 1.0), 1.0), t.w > 0.0); }   // … lane 0 folds the 64: the MEAN of the apron's term texels (144 raw samples make a quiet stand-in)
    workgroupBarrier();
    let fill = wgFill;
    if (fill.a >= 0.0) { for (var i = li; i < AN; i += 64u) { if (wgA[i].a < 0.0) { wgA[i] = vec4f(fill.xyz, wgA[i].a); } } }   // (.a keeps its own sign: the centre texel's 'no term' test reads it)
    workgroupBarrier();
  }
  let od = textureDimensions(rtCur);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let pp = perPixelSpec();
  let lp = vec2i(lid.xy);
  let o = radTemporalCore(gid, pp, wgA[u32((lp.y + APR) * AW + (lp.x + APR))], lp);   // (the stand-in mode has no use for the fast pair: nothing fetched, nothing stored — the gather-res chain computes exactly what it did)
  textureStore(rtHistOut, gid.xy, o.hist); textureStore(rtMomOut, gid.xy, o.mom);
  if (pp) { textureStore(rtFastOut, gid.xy, o.fast); }
}

// ---- à-trous on the divided grid ----
@group(1) @binding(90) var raIn: texture_2d<f32>;        // (rgb, var) — or, FIRST, the history (rgb, depth) with the variance in raMom.a
@group(1) @binding(91) var raMom: texture_2d<f32>;       // this frame's (m1, ewvar, len, var)
@group(1) @binding(92) var raFast: texture_2d<f32>;      // this frame's fast history (specular per-pixel mode: the smoothed hit distance in .x — the lobe footprint's size)
@group(1) @binding(95) var raOut: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn radAtrous(@builtin(global_invocation_id) gid: vec3u) {
  let od = vec2i(textureDimensions(raOut));
  if (gid.x >= u32(od.x) || gid.y >= u32(od.y)) { return; }
  let pc = vec2i(gid.xy); let hi = od - 1;
  var c0 = textureLoad(raIn, pc, 0);
  if (FIRST) { c0.a = textureLoad(raMom, pc, 0).a; }
  let full = fullPx(pc);
  let d0 = textureLoad(gDepth, full, 0);
  if (d0 >= 1.0) { textureStore(raOut, pc, c0); return; }
  var prm = dn.gi; var prm2 = dn.gi2; if (SPEC) { prm = dn.sp; prm2 = dn.sp2; }
  let P0 = worldFromDepth(vec2f(full) + 0.5, d0);
  let z0 = distance(P0, frame.camPos);
  let n0 = textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0;
  let gdiv = f32(gdivOf());
  let kz = prm2.x * f32(STRIDE) * (gdiv * 0.5); let kn = prm2.y; let kl = prm.z;
  let pp = perPixelSpec();
  // specular: the kernel's reach shrinks with mirror-likeness (a mirror keeps its detail; a rough lobe was integrated over a cone anyway)
  var strength = 1.0;
  var r0 = 0.0; var radius = 0.0; var young = 0.0;
  if (pp) {
    // PER-PIXEL: the reach is the lobe's FOOTPRINT — a finish of GGX width α mirrors a patch ~1.4·α·hitT across of whatever lies hitT away, and that patch, seen from the eye at (z + hitT),
    // spans that / (z + hitT) radians → × the focal length in this grid's pixels. hitT → 0 at the contact line of a cabinet standing on the lino, so its foot mirrors sharp and its top soft
    // (contact hardening), and a polish (α → 0) is barely touched. The samples already carry the lobe's blur, so a settled history takes 0.7 of it; a young one (the first frames after a
    // disocclusion have nothing but neighbours to lean on) more than all of it plus a pixel and a half. Under half this iteration's stride there is nothing for it to do: pass through.
    r0 = roughAt(full);
    if (r0 > prm2.w) { textureStore(raOut, pc, c0); return; }             // holds no term
    let m = textureLoad(raMom, pc, 0);
    let hitT = max(textureLoad(raFast, pc, 0).x, 0.0);
    let a0 = max(r0 * r0, 0.0009);
    let focalPx = frame.screen.y / (2.0 * max(frame.post.w, 1e-3) * gdiv);
    let lobePx = 1.4 * a0 * hitT / max(z0 + hitT, 1e-3) * focalPx;
    young = clamp(1.0 - (m.z - 1.0) / 8.0, 0.0, 1.0);                     // 1 on the first frame of a history, 0 from the ninth
    radius = min(lobePx * (0.7 + 1.5 * young) + 1.5 * young, 24.0);
    if (radius < 0.5 * f32(STRIDE)) { textureStore(raOut, pc, c0); return; }
  } else if (SPEC) { let rough = clamp(prm.w, 0.0, 1.0); strength = smoothstep(f32(STRIDE) * 0.6, f32(STRIDE) * 1.6 + 0.5, 1.0 + rough * 12.0); if (strength <= 0.0) { textureStore(raOut, pc, c0); return; } }
  let l0 = luminance(c0.xyz);
  var sig = sqrt(max(c0.a, 0.0));   // the pixel's own σ (its sample-moment EMA; the filtered variance from the second iteration on)
  if (pp) { sig *= 1.0 + 3.0 * young; }                                     // (a young history's variance is the spatial stand-in and its neighbours are all it has: looser)
  if (!SPEC && dn.gi3.y > 0.0) { let mz = textureLoad(raMom, pc, 0).z; sig *= 1.0 + dn.gi3.y * clamp(1.0 - (mz - 1.0) / 4.0, 0.0, 1.0); }   // diffuse, GI in motion: the same allowance for a young bounce history (0 from the fifth frame)
  var acc = vec4f(0.0); var ws = 0.0;
  for (var t = 0; t < 9; t++) {
    let dx = t % 3 - 1; let dy = t / 3 - 1;
    let q = clamp(pc + vec2i(dx, dy) * STRIDE, vec2i(0), hi);
    let fq = fullPx(q);
    let d = textureLoad(gDepth, fq, 0);
    if (d >= 1.0) { continue; }
    let Pq = worldFromDepth(vec2f(fq) + 0.5, d);
    let nq = textureLoad(gNormal, fq, 0).xyz * 2.0 - 1.0;
    var w = kb3(dx, dy) * geomWeight(P0, n0, z0, Pq, nq, kz, kn, 1.0);
    if (pp) {
      let rq = roughAt(fq);
      if (rq > prm2.w) { continue; }                                        // holds no reflection (matte / character / cap): weight zero, never a dark tap
      let dd = vec2f(f32(dx), f32(dy)) * f32(STRIDE);
      w *= exp(-dot(dd, dd) / (2.0 * radius * radius)) * exp(-abs(rq - r0) * 12.0);   // inside the lobe's footprint; a different finish is a different reflection
    }
    if (w <= 1e-6) { continue; }
    var a = textureLoad(raIn, q, 0); if (FIRST) { a.a = textureLoad(raMom, q, 0).a; }
    let wq = w * lumWeight(l0, luminance(a.xyz), sig, kl, 0.002 + 0.05 * l0);   // (radiance is HDR: the floor of the edge-stop is relative to the pixel's own level)
    acc += vec4f(a.xyz * wq, a.a * wq * wq); ws += wq;
  }
  var outv = c0;
  if (ws > 1e-5) { outv = vec4f(mix(c0.xyz, acc.xyz / ws, strength), mix(c0.a, acc.a / (ws * ws), strength)); }
  textureStore(raOut, pc, outv);
}
