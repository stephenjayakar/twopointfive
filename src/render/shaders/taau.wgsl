// TAAU — temporal anti-aliasing WITH upsampling (renderer v3, phase 1). One compute pass at OUTPUT (canvas) resolution, straight after the composite
// (+ the particles' splat) and before the bloom: the internal-resolution HDR frame, rendered this frame under a sub-pixel Halton(2,3) jitter of the
// projection, is folded into an output-resolution history that every later pass (bloom, post / AgX, the sharpen + grain blit) reads instead of `hdr`.
//
// Per output pixel:
//   1. where its centre falls in this frame's jittered internal raster → the 3×3 internal texels round it: a kernel-weighted CURRENT estimate (Gaussian on
//      each texel's true sample position — its centre minus the jitter — measured in OUTPUT pixels, so the kernel narrows as the upscale ratio grows and
//      the converged picture is built from sharp samples, not from a blur of them), a wide fallback estimate for pixels with no history, the neighbourhood's
//      first two moments for the clip, and the CLOSEST depth of the nine (a silhouette reprojected with the foreground's motion does not leave a fringe);
//   2. reprojection: that closest sample's world point (this frame's jittered inverse projection — the one the depth was rasterised with) through LAST
//      frame's UNJITTERED view-projection = where the surface was on last frame's output; + the object motion the g-buffer wrote for skinned men (velTex,
//      NDC delta already un-jittered on both ends); history fetched there with a 5-tap Catmull-Rom (bilinear alone blurs a panning picture in a dozen frames);
//   3. everything is weighed in a reversible tonemapped space (c / (1 + L·exposure): a muzzle-flash pixel cannot own the average — the 'anti-flicker'
//      luma weighting) and clipped in YCoCg toward the neighbourhood mean inside mean ± γ·σ (variance clip, γ = P.clipGamma);
//   4. blend: new-frame weight = P.alpha × the nearest sample's proximity (an output pixel this frame's jitter did not sample closely keeps its history —
//      the upsampling half of the idea), raised where the history had to be clipped far, where the surface moved fast on screen, and where the REACTIVE
//      inputs say this frame drew something with no history behind it: the particles' splat (their own r8 mask, dilated 3×3) and the rain the volumetric
//      pass added (as a fraction of the pixel's light); no usable history (a cut, off screen, first frame) = the wide current estimate outright;
//   5. back to linear scene-referred radiance → the new history texel = what the bloom / post read this frame.
// Bypass mode (debug views): a plain bilinear upscale of `cur`, no history, no jitter (the engine holds the jitter at 0 then).
@group(1) @binding(0) var curTex: texture_2d<f32>;        // hdr: this frame's composite (+ particles), INTERNAL res, linear scene-referred, jittered
@group(1) @binding(1) var gDepth: texture_depth_2d;       // internal res
@group(1) @binding(2) var histTex: texture_2d<f32>;       // last frame's output of this pass, OUTPUT res (linear)
@group(1) @binding(3) var outTex: texture_storage_2d<rgba16float, write>;   // this frame's output = next frame's history, OUTPUT res
@group(1) @binding(4) var reactTex: texture_2d<f32>;      // internal res r8unorm: the particles' reactive mask (their splat's second target; only read under TF_PARTICLES — stale otherwise)
@group(1) @binding(5) var volReactTex: texture_2d<f32>;   // volumetric res rgba16float: .r = luminance of the rain / splash / sky-flash (.g = the smoke transmittance post.wgsl reads) radiance the volumetric pass added per texel (0 = none)
@group(1) @binding(6) var velTex: texture_2d<f32>;        // internal res rg16float: per-pixel screen motion prev − cur in unjittered NDC (g-buffer; 0 for rigid geometry — the camera's share is reconstructed here from depth)

struct TaauParams {
  prevViewProjU: mat4x4f,   // last frame's view-projection WITHOUT its jitter (the output history is unjittered)
  jitter: vec2f,            // this frame's jitter in internal pixels: content at unjittered pixel position s sits at s + jitter in the raster
  inSize: vec2f,            // internal (render) size
  outSize: vec2f,           // output (canvas) size
  alpha: f32,               // base new-frame weight (0.1)
  clipGamma: f32,           // clip box half-width in σ (1.0 – 1.25)
  flags: u32,               // TF_*
  reactK: f32,              // × the reactive inputs (0 = ignore them)
  kSharp: f32,              // current-estimate kernel: w = exp(−|d_out|² · kSharp)  (2 ≈ σ 0.5 output px)
  velK: f32,                // how much fast screen motion raises the new-frame weight (0 = not at all)
  camStill: f32,            // 1 when the camera did not move since last frame (the engine knows exactly): rigid pixels then reproject to themselves bit for bit
  lightJump: f32,           // the LIGHTING changed under a still surface: this frame's 3×3 mean ÷ the history in linear luminance past this ratio (either way) takes the new frame at ≥ ½ — a stroke of
                            // lightning through the windows, a fluorescent's dropout, a torch's pool sweeping onto the floor have no motion vector, and the clip alone leaves the OLD light
                            // wherever the 3×3 straddles a shadow edge (its box spans both) for the dozen frames α 0.1 takes: fat mullion shadows on the flash frame, edges that creep. 0 = off
  motionA: f32,             // MOTION SHARPNESS: the new-frame weight a pixel reprojected at ≥ MOTION_PX output px / frame is raised to (ramping in from a quarter of that) — a resampled history
                            // is a blur in motion (Catmull-Rom or not), and noise in motion reads far less than blur in motion; 0 = the old velK rule alone (0.25 at 24 px / frame)
  motionClip: f32,          // … and the share by which the clip box narrows at that speed (γσ × (1 − this)): the history may not sit as far from what the frame shows while everything slides
  histSharp: f32,           // HISTORY DE-BLUR (image-quality program C2): under motion the reprojected history is a resample of a resample — every frame's Catmull-Rom fetch at a fractional offset
                            // low-passes it a little more. The 5-tap fetch minus a BILINEAR fetch at the same spot is (a scaled copy of) exactly the band that low-pass eats; adding this × mot
                            // × that difference back puts the edge contrast the resample took this frame back into the history before the clip bounds it. 0 = off (the fetch as it was)
};
const MOTION_PX: f32 = 0.5;   // output px / frame at which the two motion terms above are fully in force (from a quarter of it): the history is RESAMPLED at any fractional offset — a 0.3°/frame orbit
                              // moves most of the picture under a pixel a frame and still softened lit box edges by +0.7 px (10–90 % rise) against the frame's own estimate; at 2 px the terms never engaged
@group(1) @binding(7) var<uniform> P: TaauParams;

const TF_RESET: u32 = 1u;       // take no history this frame (a cut, the first frame, the pass just switched on)
const TF_BYPASS: u32 = 2u;      // debug views: bilinear upscale of cur, nothing else
const TF_PARTICLES: u32 = 4u;   // the particles' splat ran this frame: reactTex is this frame's
const TF_VELOCITY: u32 = 8u;    // velTex holds this frame's object motion (the g-buffer wrote it)

fn tmap(c: vec3f) -> vec3f { return c / (1.0 + luminance(c) * frame.exposure); }            // reversible range compression (Karis): weights every tap by 1 / (1 + L)
fn tunmap(c: vec3f) -> vec3f { return c / max(1.0 - luminance(c) * frame.exposure, 1e-4); }
fn toYcc(c: vec3f) -> vec3f { return vec3f(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
fn fromYcc(y: vec3f) -> vec3f { return vec3f(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }

/** 5-tap Catmull-Rom of the history at uv (Jimenez' arrangement: the four corner taps dropped, renormalised) — sharp under motion where bilinear smears; the
 *  negative lobes are clamped at zero and the clip below bounds any overshoot */
fn sampleHistory(uv: vec2f) -> vec3f {
  let size = P.outSize;
  let sp = uv * size; let tc = floor(sp - 0.5) + 0.5; let f = sp - tc;
  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);
  let w12 = w1 + w2;
  let t12 = (tc + w2 / w12) / size; let t0 = (tc - 1.0) / size; let t3 = (tc + 2.0) / size;
  let cA = textureSampleLevel(histTex, linSamp, vec2f(t12.x, t0.y), 0.0).xyz * (w12.x * w0.y);
  let cB = textureSampleLevel(histTex, linSamp, vec2f(t0.x, t12.y), 0.0).xyz * (w0.x * w12.y);
  let cC = textureSampleLevel(histTex, linSamp, t12, 0.0).xyz * (w12.x * w12.y);
  let cD = textureSampleLevel(histTex, linSamp, vec2f(t3.x, t12.y), 0.0).xyz * (w3.x * w12.y);
  let cE = textureSampleLevel(histTex, linSamp, vec2f(t12.x, t3.y), 0.0).xyz * (w12.x * w3.y);
  let wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max((cA + cB + cC + cD + cE) / wsum, vec3f(0.0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let od = textureDimensions(outTex);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let so = vec2f(gid.xy) + 0.5;                                   // output pixel centre
  if ((P.flags & TF_BYPASS) != 0u) {
    let c = textureSampleLevel(curTex, linSamp, so / P.outSize, 0.0).xyz;
    textureStore(outTex, gid.xy, vec4f(c, 1.0));
    return;
  }
  let ratio = P.inSize / P.outSize;                               // ≤ 1: internal pixels per output pixel
  let s = so * ratio;                                             // the same point in internal pixel units (unjittered)
  let q = vec2i(floor(s + P.jitter));                             // the internal texel whose footprint holds it this frame
  let hi = vec2i(P.inSize) - 1;
  // ---- 1. the 3×3: current estimate (sharp + wide), moments, closest depth
  // Two kernels, deliberately apart: the CURRENT estimate is rebuilt sharp (a narrow Gaussian in output pixels round each texel's true sample position — at k 6 it is
  // all but the nearest sample: no 3×3 tent smeared into every frame), while the temporal ACCEPTANCE of that estimate (prox) is a trapezoid over the output pixel's
  // own footprint — full weight for a sample within ¼ px of the centre, nothing past ¾ — so what the history integrates over the jitter cycle is close to a one-pixel
  // box of point samples: the supersampled picture, antialiased AND sharp, rather than a Gaussian-blurred one.
  var acc = vec3f(0.0); var wacc = 0.0; var accW = vec3f(0.0); var waccW = 0.0;
  var m1 = vec3f(0.0); var m2 = vec3f(0.0);
  var dBest = 2.0; var tBest = clamp(q, vec2i(0), hi); var prox = 0.0;
  let toOut = 1.0 / ratio;                                        // internal px → output px
  // the acceptance trapezoid's outer edge (output px; full weight inside half of it): 0.75 where a sample sits under nearly every output pixel, tighter for the deep
  // upscales — fewer samples accepted per cycle, but the settled picture is a narrower box of them (at 0.5 the 1.5-px box read as blur against the native rows)
  let proxR = mix(0.55, 0.75, smoothstep(0.6, 0.9, ratio.y));
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let t = clamp(q + vec2i(dx, dy), vec2i(0), hi);
      let c = tmap(textureLoad(curTex, t, 0).xyz);
      let y = toYcc(c);
      m1 += y; m2 += y * y;
      let d = (vec2f(t) + 0.5 - P.jitter) - s;                     // this texel's sample position relative to the output centre (internal px)
      let dOut = d * toOut;
      let w = exp(-dot(dOut, dOut) * P.kSharp);                     // sharp: in OUTPUT pixels
      let wW = exp(-dot(d, d) * 1.1);                               // wide: σ ≈ 0.67 internal px — a smooth upscale for pixels without history
      acc += y * w; wacc += w; accW += y * wW; waccW += wW;
      let ad = abs(dOut);
      prox = max(prox, clamp((proxR - ad.x) / (0.6667 * proxR), 0.0, 1.0) * clamp((proxR - ad.y) / (0.6667 * proxR), 0.0, 1.0));   // (full weight within proxR/3 of the centre, nothing past proxR)
      let dz = textureLoad(gDepth, t, 0);
      if (dz < dBest) { dBest = dz; tBest = t; }
    }
  }
  let mean = m1 / 9.0;
  let sigma = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  let curWide = accW / max(waccW, 1e-6);
  let cur = select(curWide, acc / max(wacc, 1e-9), wacc > 1e-5);   // (deep upscale, no sample anywhere near: the smooth estimate — its weight below is ~0 anyway)
  // ---- 2. reprojection off the closest sample
  let Pw = worldFromDepth(vec2f(tBest) + 0.5, min(dBest, 1.0));    // (sky: the far plane — rotation still reprojects it)
  let zNow = (frame.viewProj * vec4f(Pw, 1.0)).w;                   // its view depth now → the history's alpha, for next frame's disocclusion test
  let pc = P.prevViewProjU * vec4f(Pw, 1.0);
  var valid = (P.flags & TF_RESET) == 0u && pc.w > 0.0;
  var uvH = so / P.outSize;
  var velPx = 0.0;
  var disoccluded = false;
  if (valid) {
    let uvPrev = (pc.xy / pc.w) * vec2f(0.5, -0.5) + 0.5;                       // where that sample's surface point was on last frame's output
    let uvNow = (vec2f(tBest) + 0.5 - P.jitter) / P.inSize;                     // where it is now, unjittered
    var vel = uvPrev - uvNow;
    if (P.camStill > 0.5) { vel = vec2f(0.0); }                                  // (a still camera: skip the round trip through two matrices — rigid pixels map to themselves exactly, so a converged still is a fixed point)
    if ((P.flags & TF_VELOCITY) != 0u) { let ov = textureLoad(velTex, tBest, 0).xy; vel += ov * vec2f(0.5, -0.5); }   // + the object's own motion (skinned men, matched boxes): NDC delta → uv delta
    uvH += vel;
    velPx = length(vel * P.outSize);
    valid = all(uvH > vec2f(0.0)) && all(uvH < vec2f(1.0));
    // DISOCCLUSION: the surface the history holds there must be the surface we reproject onto — its stored view depth (alpha) against the depth this point had under last
    // frame's camera (pc.w), within ~1 % (a man closing on the camera moves centimetres a frame). Any of the 2×2 texels round the fetch position may vouch for it, so a depth
    // EDGE under a moving camera (desk against floor, half a texel either way) still finds its own side and keeps its history; the floor a man has just walked off finds
    // only his old depth a metre nearer and starts over from this frame — the colour clip alone cannot tell his dark suit from the dark carpet, and left his outline behind him.
    if (valid) {
      let hb = vec2i(floor(uvH * P.outSize - 0.5)); let ohi = vec2i(od) - 1;
      let tol = 0.03 + 0.01 * pc.w;
      var ok = false;
      for (var oy = 0; oy <= 1; oy++) { for (var ox = 0; ox <= 1; ox++) { let a = textureLoad(histTex, clamp(hb + vec2i(ox, oy), vec2i(0), ohi), 0).a; ok = ok || abs(a - pc.w) < tol; } }
      disoccluded = !ok;
    }
  }
  var outY: vec3f;
  if (!valid || disoccluded) {
    outY = select(cur, curWide, ratio.y < 0.7);   // this frame outright: the sharp estimate at mild ratios (a sample under nearly every output pixel), the smooth one for the deep upscales (nearest-sample blocks read worse than a frame or two of softness)
  } else {
    var histLin = sampleHistory(uvH);
    let motPre = smoothstep(0.25 * MOTION_PX, MOTION_PX, velPx);
    if (P.histSharp > 0.0 && motPre > 0.0) {   // C2: de-blur the fetched history by the band the resample removes (Catmull-Rom − bilinear at the same spot), only while it is being resampled (motion) — in the
                                               // tonemapped space, so a bright emitter's edge cannot ring in raw radiance (the clip below bounds what is left)
      let hb = tmap(textureSampleLevel(histTex, linSamp, uvH, 0.0).xyz); let ht = tmap(histLin);
      var hm = max(ht + (ht - hb) * (P.histSharp * motPre), vec3f(0.0));
      let Lm = luminance(hm) * frame.exposure; if (Lm > 0.98) { hm *= 0.98 / Lm; }   // bound the LUMINANCE inside tunmap's domain (a saturated channel legitimately exceeds 1/exposure in this space: clamping channels crushed bright reds / blues)
      histLin = tunmap(hm);
    }
    let hist = toYcc(tmap(histLin));
    // ---- 3. variance clip toward the mean (per axis in YCoCg; the box padded by a few per cent of the local luma — RELATIVE, never absolute: this is a dark game, most pixels sit a
    // few 8-bit steps off black where the tonemap's log shoulder shows a 20 % linear difference plainly, and an absolute pad wide enough to calm a bright wall let a man's dark
    // outline and his shadow's lag live on in the carpet behind him for seconds)
    let mot = smoothstep(0.25 * MOTION_PX, MOTION_PX, velPx);                     // 0 still … 1 at ≥ MOTION_PX px / frame of reprojection (camera + object)
    let ext = sigma * (P.clipGamma * (1.0 - P.motionClip * mot)) + vec3f(0.03, 0.015, 0.015) * max(mean.x, 1e-6);
    let dv = hist - mean;
    let r = abs(dv) / ext;
    let rmax = max(r.x, max(r.y, r.z));
    var clipped = hist;
    if (rmax > 1.0) { clipped = mean + dv / rmax; }
    // ---- 4. blend weight
    var a = P.alpha * prox;                                                       // only pixels this frame's jitter sampled closely take much of it
    // anti-flicker: on a hard high-contrast edge (an emissive panel against a dark desk) successive jitter phases land on either side and each pulls the settled edge value
    // ± α·Δ — with an HDR Δ that is tens of display levels. Where the 3×3 is that contrasty RELATIVE to its own level, take each frame at a quarter of the weight: the
    // converged edge is the same average, reached slower, and swings a quarter as far. (A moving edge is the clip's business below, not this term's.)
    a *= 1.0 - 0.75 * smoothstep(0.15, 0.5, sigma.x / max(mean.x, 1e-5));
    a = mix(a, max(a, 0.35), clamp((rmax - 2.0) * 0.25, 0.0, 1.0) * prox);      // the history was far outside what this frame sees here: converge faster (where we have a sample to converge to)
    a = mix(a, max(a, 0.25), clamp(velPx / 24.0, 0.0, 1.0) * P.velK);           // fast on-screen motion: lean less on a resampled history
    a = mix(a, max(a, P.motionA), mot * prox);                                    // MOTION SHARPNESS (TaauParams.motionA): in motion the history is a resample of a resample — take the frame's own sharp estimate at motionA where it has one
    if (P.lightJump > 1.0) {   // a lighting change (see TaauParams.lightJump): the linear-luminance ratio between what the 3×3 shows now and what the history holds, past the threshold either way and
                               // worth at least a few display steps, hands the pixel to this frame at ½+ (× prox: where this frame has a sample to hand it to). Disocclusions never get here.
      let Lc = luminance(tunmap(fromYcc(mean))); let Lh = luminance(tunmap(fromYcc(hist)));
      let rr = max(Lc, 1e-6) / max(Lh, 1e-6);
      let big = smoothstep(P.lightJump, P.lightJump * 1.5, max(rr, 1.0 / rr)) * smoothstep(0.01, 0.03, abs(mean.x - hist.x));
      a = mix(a, max(a, 0.5), big * prox);
    }
    if (P.reactK > 0.0) {
      var react = 0.0;
      if ((P.flags & TF_PARTICLES) != 0u) {                                       // particles drawn this frame: their mask, dilated one texel (a streak's AA skirt)
        for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { react = max(react, textureLoad(reactTex, clamp(q + vec2i(dx, dy), vec2i(0), hi), 0).x); } }
      }
      {   // radiance in the AIR this frame with nothing to reproject it by — rain streaks, a stroke's lit sky, the beam of a torch that swings with its man (volumetrics.wgsl outReact): what share of this pixel's light it is
        let vdiv = max(1, i32(frame.lossyCfg.y)); let vd = vec2i(textureDimensions(volReactTex)) - 1;
        var qv = q / vdiv; if (SHARP) { qv = vec2i((vec2f(q) + 0.5) * (frame.sharpCfg.xy / P.inSize) + frame.sharpCfgC.xy) / vdiv; }   // (SHARP DIRECT, docs/internal/sharp-direct.md: q is an OUTPUT pixel then and the volumetric grid a fraction of the INTERNAL raster — `SHARP` is a const passes.ts prepends; false = the statement as it was)
        let vr = textureLoad(volReactTex, clamp(qv, vec2i(0), vd), 0); let airL = vr.x;
        if (airL > 0.0) {
          let curL = luminance(tunmap(fromYcc(cur)));
          react = max(react, clamp(1.5 * airL / max(curL, 1e-5), 0.0, 1.0));
        }
        let smokeReactK = f32((frame.volCfg.w >> 16u) & 15u) * 0.1;   // EXPERIMENT (settings.smokeTaaReact): a plume has no motion vectors — by (1 − its transmittance) the pixel leans on the fresh march instead of a stale plume clamped into place
        if (smokeReactK > 0.0) { react = max(react, clamp((1.0 - vr.y) * smokeReactK, 0.0, 1.0)); }
      }
      // AN OPEN FIRE'S FLAME (composite.wgsl fireReact, in this frame's alpha as 1 − it; 1 everywhere else): new every frame with nothing to reproject it by. Left to the
      // history it was a ten-frame average of ten different flames, and the anti-flicker term above (a bright flame on dark ground is all contrast) made that forty: a soft,
      // dim, see-through shape that hardly moved — what every look at a fire on a GPU had shown
      react = max(react, clamp(1.0 - textureLoad(curTex, clamp(q, vec2i(0), hi), 0).a, 0.0, 1.0));
      a = max(a, react * P.reactK);
    }
    a = clamp(a, 0.0, 1.0);
    outY = mix(clipped, cur, a);
  }
  let outC = max(tunmap(fromYcc(outY)), vec3f(0.0));
  textureStore(outTex, gid.xy, vec4f(outC, zNow));
}
