// Composite: albedo * (direct + upsampled indirect) / pi + emissive (+ the glossy floors' specular, FLAG_GLOSS; + the ray-traced reflections, frame.rtCfg.w > 0; + a wet character's clear coat, wetCoatSpec), through the glass panes' tint — bent by them under GLASS_REFRACT — then volumetrics → HDR scene colour (rgba16f).
// Exposure / tonemap / bloom / night vision happen in post.wgsl.
@group(1) @binding(0) var gAlbedo: texture_2d<f32>;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var gDepth: texture_depth_2d;
@group(1) @binding(3) var gId: texture_2d<u32>;
@group(1) @binding(4) var directTex: texture_2d<f32>;
@group(1) @binding(5) var indirectTex: texture_2d<f32>;   // 1/frame.lossyCfg.x res (half; a third with gatherThird)
@group(1) @binding(6) var volTex: texture_2d<f32>;        // 1/frame.lossyCfg.y res (half; a quarter with volQuarter)
@group(1) @binding(7) var diceTex: texture_3d<f32>;
@group(1) @binding(8) var softTex: texture_2d<f32>;
@group(1) @binding(9) var specTex: texture_2d<f32>;       // glossy-floor reflection radiance (fgather.wgsl glossReflection, filtered), on indirectTex's texel grid — only read for BOX_GLOSS pixels while FLAG_GLOSS is on; holds nothing meaningful otherwise
@group(1) @binding(12) var reflTex: texture_2d<f32>;      // ray-traced reflections (reflect.wgsl → the shared denoiser's specular client), at 1/frame.rtCfg.w res: outgoing specular radiance per texel, filterable (sampled bilinearly) — only read while frame.rtCfg.w > 0
@group(1) @binding(13) var gMat: texture_2d<f32>;         // the g-buffer's material target: (roughness, metalness) per pixel (the reflections' cutoff fade, the metal step-back, the upsample's tap test)
@group(1) @binding(11) var froxTex: texture_3d<f32>;      // the INTEGRATED froxel volume (froxel.wgsl; FLAG_FROXEL_VOL): (in-scatter, transmittance) from the eye to each slice boundary — one trilinear fetch at the pixel's own distance (froxelFetch, common.wgsl); volTex then carries only the rain
// ---- SHARP DIRECT (docs/internal/sharp-direct.md). passes.ts compiles this text TWICE behind a prepended `const SHARP: bool`: false = the fragment composite at the INTERNAL size
// exactly as it always was (every `if (SHARP)` folds away); true = the same arithmetic per OUTPUT pixel as a compute kernel (`cs` below, writing hdrOut) with group 0 = the OUTPUT frame block, the
// g-buffer bindings = the output-size raster, directTex / softTex = the output-size shadowed direct (sharp_direct.wgsl), and everything stochastic — the gather's irradiance + specular, the volumetric
// march, the reflections — still on its INTERNAL grid: their texel ↔ pixel maps go through the internal size (frame.sharpCfg.xy) and their depth / normal / id guides are read at the output texel
// that HOLDS the internal sample pixel (gpx: the internal g-buffer is that subsample, gdown.wgsl — the same numbers by construction).
// ---- GLASS REFRACTION: a second prepended `const GLASS_REFRACT: bool` (passes.ts compText(sharp, refr) → four programs; the encode picks by passes.glassRefract): true = the view ray bent
// through the glass boxes and the surface read where it comes out (glassRefractPath / refractedRead below, over refract_common.wgsl prepended ahead of this text); false = this module as it was.
@group(1) @binding(14) var hdrOut: texture_storage_2d<rgba16float, write>;   // the compute entry point's target (the fragment pipeline's layout has no binding 14; fs never touches it)
/** internal px per output px (1 with SHARP off — never called then) */
fn inOverOut() -> vec2f { return frame.sharpCfg.xy / frame.screen; }
/** the g-buffer texel holding INTERNAL pixel `src`: itself (the g-buffer IS internal), or under SHARP the output texel its centre falls in */
fn gpx(src: vec2i) -> vec2i { if (SHARP) { return vec2i(clamp((vec2f(src) + 0.5 - frame.sharpCfgC.xy) * frame.sharpCfg.zw / frame.sharpCfg.xy, vec2f(0.0), frame.sharpCfg.zw - 1.0)); } return src; }   // (gdown.wgsl outTexelOf's expression, operand for operand — incl. the DECOUPLED jitter frame.sharpCfgC.xy, 0 without it)
/** an internal raster position → the pixel units worldFromDepth wants (frame.invScreen is the OUTPUT's under SHARP) */
fn ipos(p: vec2f) -> vec2f { if (SHARP) { return (p - frame.sharpCfgC.xy) / inOverOut(); } return p; }   // (an internal raster position sits at its unjittered place − the decoupled jitter)
/** the last internal pixel (clamps on internal sample pixels) */
fn inHi() -> vec2i { if (SHARP) { return vec2i(frame.sharpCfg.xy) - 1; } return vec2i(frame.screen) - 1; }

const PI: f32 = 3.14159265;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var o: VOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn linearDepth(d: f32, pix: vec2f) -> f32 { return distance(worldFromDepth(pix, d), frame.camPos); }

fn upsampleIndirect(pix: vec2i, pin: vec2f, z: f32, N: vec3f) -> vec3f {   // pin = the pixel's position on the INTERNAL raster (= pixf; under SHARP pixf × in∕out)
  let hdims = vec2i(textureDimensions(indirectTex));
  var ip = pix; if (SHARP) { ip = vec2i(floor(pin)); }           // the internal pixel this pixel falls in
  // GI IN MOTION (settings.giFullRes, docs/internal/gi-motion.md): the diffuse chain ran at the INTERNAL resolution this frame — the bound texture IS internal-sized (denoise.wgsl giUpsample did this
  // function's joint-bilateral 3×3 before the temporal step; the à-trous chain ends in it) — so the internal pixel takes its own texel; under SHARP an output pixel takes the depth / normal-guided
  // bilinear of the four internal texels round its position (guides at the output texel each internal pixel's centre falls in — gpx — as every other internal-grid term here)
  if (all(hdims == inHi() + 1)) {
    if (!SHARP) { return textureLoad(indirectTex, clamp(ip, vec2i(0), hdims - 1), 0).xyz; }
    let b = floor(pin - 0.5); let t = pin - 0.5 - b; let base = vec2i(b);
    var acc = vec3f(0.0); var wsum = 0.0;
    for (var dy = 0; dy <= 1; dy++) {
      for (var dx = 0; dx <= 1; dx++) {
        let src = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
        let d = textureLoad(gDepth, gpx(src), 0);
        if (d >= 1.0) { continue; }
        let zs = linearDepth(d, ipos(vec2f(src) + 0.5));
        let ns = textureLoad(gNormal, gpx(src), 0).xyz * 2.0 - 1.0;
        var w = select(1.0 - t.x, t.x, dx == 1) * select(1.0 - t.y, t.y, dy == 1) + 1e-4;
        w *= exp(-abs(zs - z) / max(z * 0.02, 0.02));
        w *= pow(max(dot(ns, N), 0.0), 8.0) + 0.001;
        acc += textureLoad(indirectTex, src, 0).xyz * w; wsum += w;
      }
    }
    if (wsum < 1e-5) { return textureLoad(indirectTex, clamp(vec2i(floor(pin)), vec2i(0), hdims - 1), 0).xyz; }
    return acc / wsum;
  }
  let gdiv = i32(frame.lossyCfg.x); let goff = (gdiv - 1) / 2;   // gather divisor (2, or 3 with the lossy option) and the full-res offset each texel was computed at (fgather)
  let base = ip / gdiv;                                           // the texel whose sample pixel (gdiv·h + goff) is nearest: floor(p / gdiv) for both divisors
  var acc = vec3f(0.0); var wsum = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let h = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
      let src = min(h * gdiv + goff, inHi());                       // guides from exactly the pixel the texel was traced at
      let d = textureLoad(gDepth, gpx(src), 0);
      if (d >= 1.0) { continue; }
      let zs = linearDepth(d, ipos(vec2f(src) + 0.5));
      let ns = textureLoad(gNormal, gpx(src), 0).xyz * 2.0 - 1.0;
      var sp = vec2f(src - pix); if (SHARP) { sp = vec2f(src) + 0.5 - pin; }
      var w = exp(-dot(sp, sp) * (0.18 * (4.0 / f32(gdiv * gdiv))));   // spatial falloff in units of the texel spacing (0.18 /px² at gdiv 2)
      w *= exp(-abs(zs - z) / max(z * 0.02, 0.02) );
      w *= pow(max(dot(ns, N), 0.0), 8.0) + 0.001;
      acc += textureLoad(indirectTex, h, 0).xyz * w; wsum += w;
    }
  }
  if (wsum < 1e-5) { return textureLoad(indirectTex, clamp(base, vec2i(0), hdims - 1), 0).xyz; }
  return acc / wsum;
}

// The same joint-bilateral 3x3 for the glossy floors' specular (FLAG_GLOSS): specTex shares indirectTex's texel grid and sample pixels, so the
// guides and weights are those of upsampleIndirect tap for tap — kept as its own function so the diffuse path above stays untouched, and only
// ever called for a gloss pixel with the flag on.
fn upsampleSpecular(pix: vec2i, pin: vec2f, z: f32, N: vec3f) -> vec3f {
  let hdims = vec2i(textureDimensions(specTex));
  let gdiv = i32(frame.lossyCfg.x); let goff = (gdiv - 1) / 2;
  var ip = pix; if (SHARP) { ip = vec2i(floor(pin)); }
  let base = ip / gdiv;
  var acc = vec3f(0.0); var wsum = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let h = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
      let src = min(h * gdiv + goff, inHi());
      let d = textureLoad(gDepth, gpx(src), 0);
      if (d >= 1.0) { continue; }
      // a tap on the carpet across a gloss seam is coplanar with the same normal, so depth / normal cannot reject it — but its texel holds spec = 0 and would
      // pull a dark fringe along every corridor edge under a bright reflection: only gloss-topped world boxes contribute
      let tid = textureLoad(gId, gpx(src), 0).x; let tIdx = tid & 0xFFFFFu;
      if (((tid >> 28u) & 1u) != 0u || tIdx == 0xFFFFFu) { continue; }
      if ((boxGeo[tIdx].flags & BOX_GLOSS) == 0u) { continue; }
      let zs = linearDepth(d, ipos(vec2f(src) + 0.5));
      let ns = textureLoad(gNormal, gpx(src), 0).xyz * 2.0 - 1.0;
      var sp = vec2f(src - pix); if (SHARP) { sp = vec2f(src) + 0.5 - pin; }
      var w = exp(-dot(sp, sp) * (0.18 * (4.0 / f32(gdiv * gdiv))));
      w *= exp(-abs(zs - z) / max(z * 0.02, 0.02) );
      w *= pow(max(dot(ns, N), 0.0), 8.0) + 0.001;
      acc += textureLoad(specTex, h, 0).xyz * w; wsum += w;
    }
  }
  if (wsum < 1e-5) { return textureLoad(specTex, clamp(base, vec2i(0), hdims - 1), 0).xyz; }
  return acc / wsum;
}

// …and once more with NO material test on the taps, for a pixel seen through a glass pane (FLAG_GLASS) that is not itself a gloss floor: its texels hold what
// the pane adds (fgather.wgsl glassShade), guided by the surface behind the glass exactly as the indirect is. Taps outside the pane's footprint hold zero and
// pull the reflection down over its last texel — a 2 px soft edge, behind a mullion or a sill nearly everywhere.
fn upsampleSpecAny(pix: vec2i, pin: vec2f, z: f32, N: vec3f) -> vec3f {
  let hdims = vec2i(textureDimensions(specTex));
  let gdiv = i32(frame.lossyCfg.x); let goff = (gdiv - 1) / 2;
  var ip = pix; if (SHARP) { ip = vec2i(floor(pin)); }
  let base = ip / gdiv;
  var acc = vec3f(0.0); var wsum = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let h = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
      let src = min(h * gdiv + goff, inHi());
      let d = textureLoad(gDepth, gpx(src), 0);
      if (d >= 1.0) { continue; }
      let zs = linearDepth(d, ipos(vec2f(src) + 0.5));
      let ns = textureLoad(gNormal, gpx(src), 0).xyz * 2.0 - 1.0;
      var sp = vec2f(src - pix); if (SHARP) { sp = vec2f(src) + 0.5 - pin; }
      var w = exp(-dot(sp, sp) * (0.18 * (4.0 / f32(gdiv * gdiv))));
      w *= exp(-abs(zs - z) / max(z * 0.02, 0.02) );
      w *= pow(max(dot(ns, N), 0.0), 8.0) + 0.001;
      acc += textureLoad(specTex, h, 0).xyz * w; wsum += w;
    }
  }
  if (wsum < 1e-5) { return textureLoad(specTex, clamp(base, vec2i(0), hdims - 1), 0).xyz; }
  return acc / wsum;
}

// The ray-traced reflections at this pixel (frame.rtCfg.w = the reflection target's divisor): ONE bilinear fetch of the reflection texture at the pixel's own position on its
// grid (texel g was traced at full-res pixel g·div + goff — the mapping denoise.wgsl gatherTexel uses). No dark fringe at a seam: the denoiser gives every texel that holds no
// term (a matte box, a man, the sky) its tile's representative reflection instead of black (denoise.wgsl radTemporalCore), and THIS pixel is masked by its own full-res
// roughness (reflK) — so the polish beside a chair leg reads polish, and the leg reads nothing. (A 3×3 joint-bilateral over the taps' depth / normal / material cost 36 loads a
// pixel for the same picture under TAAU: docs/internal/p4-materials.md §2.)
fn upsampleRefl(pixf: vec2f) -> vec3f {
  let rdiv = max(frame.rtCfg.w, 1.0);
  let goff = floor((rdiv - 1.0) * 0.5);
  let dims = vec2f(textureDimensions(reflTex));
  var pf = pixf; if (SHARP) { pf = pixf * inOverOut() + frame.sharpCfgC.xy; }   // (+ the decoupled jitter the internal raster carries, like every other internal ↔ output map; 0 without it)         // (the reflection grid is a fraction of the INTERNAL raster)
  let t = (pf - 0.5 - goff) / rdiv + 0.5;                         // continuous texel coordinate (pixf = the pixel centre, .5-based)
  return textureSampleLevel(reflTex, linSamp, t / dims, 0.0).xyz;
}

/** the weather's air as the volumetric target's alpha carries it (volumetrics.wgsl wxAirMarch), ESTIMATED for the pixel's ray to its surface from the open air's own
 *  profile under the layer's top — what is left of that alpha ÷ this is the smoke's. 1 with no weather. Set by main before the upsample. */
var<private> wxAirT: f32 = 1.0;
fn wxAirTEst(pixf: vec2f, z: f32) -> f32 {
  let ro = frame.camPos; let rd = normalize(worldFromDepth(pixf, 0.5) - ro); let top = CEIL_Y + WX_TOP;
  var t0 = 0.0; if (ro.y > top && rd.y < -1e-4) { t0 = (top - ro.y) / rd.y; }
  return clamp(exp(-wxFogTau(wxFog(), ro + rd * t0, rd, max(z - t0, 0.0))), 0.05, 1.0);
}
fn upsampleVol(pix: vec2i, pin: vec2f, z: f32) -> vec4f {
  let hdims = vec2i(textureDimensions(volTex));
  let vdiv = i32(frame.lossyCfg.y);                             // volumetric divisor: 2, or 4 with the lossy option
  var ip = pix; if (SHARP) { ip = vec2i(floor(pin)); }
  let base = ip / vdiv;
  var acc = vec4f(0.0); var wsum = 0.0;
  // EXPERIMENT (settings.smokeUpsampleRelax, volCfg.w bit 20): the depth guide assumes the volumetric term follows the SURFACE — true of haze up to it, false of a plume in
  // front of it: guiding by depth carves the plume's soft edge along every depth edge BEHIND it. Where the centre texel is mostly smoke (T < ½) the depth term lets go.
  var depthK = 1.0;
  if (((frame.volCfg.w >> 20u) & 1u) != 0u) { var Tc = textureLoad(volTex, clamp(base, vec2i(0), hdims - 1), 0).a; if (wxAirT < 1.0) { Tc = min(Tc / wxAirT, 1.0); } depthK = smoothstep(0.35, 0.75, Tc); }   // (÷ the weather's air in the texel's alpha — wxAirT, 1 with none: fog FOLLOWS the surface, only a plume lets go of the guide)
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let h = clamp(base + vec2i(dx, dy), vec2i(0), hdims - 1);
      let src = min(h * vdiv + vec2i(h.y & 1, h.x & 1) * (vdiv / 2), inHi());   // the pixel that texel marched through (volumetrics.wgsl)
      let d = textureLoad(gDepth, gpx(src), 0);
      let zs = select(linearDepth(d, ipos(vec2f(src) + 0.5)), 1e4, d >= 1.0);
      var sp = vec2f(src - pix); if (SHARP) { sp = vec2f(src) + 0.5 - pin; }
      var w = exp(-dot(sp, sp) * (0.15 * (4.0 / f32(vdiv * vdiv))));   // spatial falloff in units of the texel spacing (0.15 /px² at vdiv 2)
      w *= mix(1.0, exp(-abs(zs - z) / max(z * 0.05, 0.05)), depthK);
      acc += textureLoad(volTex, h, 0) * w; wsum += w;
    }
  }
  if (wsum < 1e-5) { return textureLoad(volTex, clamp(base, vec2i(0), hdims - 1), 0); }
  return acc / wsum;
}

// FROXEL VOLUMETRICS (FLAG_FROXEL_VOL): what lies between the eye and this pixel's surface, `dist` along its ray — the haze beams in ONE fetch of the integrated
// froxel volume (froxelFetch, common.wgsl: cubic across the screen, linear along the ray), plus what the 2D pass still marches per pixel (the smoke, lit from
// the froxels' J volume, and the rain) through the same depth-aware upsample it always had. The haze is laid behind the smoke's transmittance, as the march
// always composed the two. → (rgb to add, a = transmittance to multiply the surface by), what upsampleVol returns for the old path.
fn froxelVol(pixf: vec2f, pix: vec2i, pin: vec2f, dist: f32) -> vec4f {
  let hz = froxelFetch(froxTex, pixf * frame.invScreen, min(dist, frame.froxelA.y));
  let sm = upsampleVol(pix, pin, dist);
  return vec4f(sm.rgb + hz.rgb * sm.a, sm.a * hz.a);
}

// The light falling ON a pane at X (either face; n = the normal on the eye's side) — what a crack star or its milky collar has to scatter (decals.wgsl
// glassMarks; only ever called for the few pixels that lie on one). Every light this frame that reaches the pane's cell (reach.ts masks), transient ones
// included (a muzzle flash sets the web alight for its frame — nothing here has a history), evaluated without the receiver cosine but with the pane's own
// projected area; the STRONGEST is shadow-tested from the face it is on (+ smoke), the rest credited at half, unshadowed (dim by construction) — the dust
// glow's recipe in fgather.wgsl glassShade, one ray instead of two. Plus the cached bounce arriving on both faces.
// GLASS BREAKING (game/glassbreak.ts; only called under GLASS_BREAK): the crack picture of pane slot k at world point X on it, footprint fp (m per px) — .x = crack line coverage,
// .y = frost (crushed glass). The lines are the cuts of game/glassPattern.ts themselves (gpCrackAt is this function's CPU reference): the two RADIALS of the sector the point is
// in — part of the way into the sheet until the pane has run, to the frame after — the CHORDS either side of its piece (the concentric cracks), past the rings of a run pane
// the sector's branch crack and its dagger's snap, the territory line where two blows' cracks met, a laminated pane's tight web, the crushed crater of a blow too soft to punch
// it, and the bright chipped RIM of any piece that borders a hole. A tempered pane letting go is crazed through into dice wherever it still stands. Antialiased over the footprint like the stars.
fn gbLine(d: f32, w: f32, wt: f32) -> f32 { return (1.0 - smoothstep(w * 0.6, w * 1.6, d)) * wt; }
/** distance to the nearest edge of the dice (glassPattern.ts gpDiceEdge: F2 − F1 of a jittered 3 × 3 cellular pattern of cell size grain) */
fn gbDice(uv: vec2f, grain: f32, seed: u32) -> f32 {
  let p = uv / grain; let ip = vec2i(floor(p));
  var f1 = 1e9; var f2 = 1e9;
  for (var j = -1; j <= 1; j++) { for (var i = -1; i <= 1; i++) {
    let c = ip + vec2i(i, j); let cu = bitcast<u32>(c.x) & 0xffffu; let cv = bitcast<u32>(c.y) & 0xffffu;
    let q = vec2f(c) + 0.15 + 0.7 * vec2f(gpJit(seed, cu, cv), gpJit(seed ^ 0x5bd1e9u, cu, cv));
    let dd = distance(q, p); if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
  } }
  return (f2 - f1) * 0.5 * grain;
}
/** one crack LINE (through P, unit normal N) into the running (coverage, rim distance): its antialiased coverage at weight wt, and — when the glass just across it has
 *  fallen out — the distance to it as a rim */
fn gbEdge(k: u32, fl: u32, n: u32, uv: vec2f, P: vec2f, N: vec2f, w: f32, wt: f32, acc: vec2f) -> vec2f {
  let sd = dot(uv - P, N); let dd = abs(sd);
  var o = vec2f(max(acc.x, gbLine(dd, w, wt)), acc.y);
  if ((fl & 1u) != 0u && dd < 0.012 + 2.0 * w && gbOpenUV(k, fl, n, uv - N * (sd + select(-0.004, 0.004, sd >= 0.0)))) { o.y = min(o.y, dd); }
  return o;
}
fn gbChordEdge(k: u32, fl: u32, n: u32, uv: vec2f, S: GbSite, s: i32, cb: u32, w: f32, wt: f32, acc: vec2f) -> vec2f {
  let A = gpChordPt(S, s, cb); let e = gpChordPt(S, s + 1, cb) - A; let L = max(1e-6, length(e));
  return gbEdge(k, fl, n, uv, A, vec2f(-e.y, e.x) / L, w, wt, acc);
}
fn gbCracks(k: u32, X: vec3f, fp: f32) -> vec2f {
  let h = gbHeader(k); let fl = u32(h.y + 0.5); let n = min(u32(h.x + 0.5), 8u);
  let uv = gbUV(k, gbLocal(k, X));
  let w = max(fp, 0.0006);
  if ((fl & 4u) != 0u) {   // a tempered pane on its way out: what still stands is dice — drawn while a die is a few pixels across, a milky sheet beyond that; brightest at the wave's edge
    let dw = gbRow(k, 2u); let grain = max(dw.w, 1e-3);
    let res = clamp(grain / (5.0 * w) - 0.2, 0.0, 1.0);
    let front = 1.0 - smoothstep(0.0, 0.12, gbClumpKey(k, uv) - dw.z);
    return vec2f(max(mix(0.5, gbLine(gbDice(uv, grain, u32(gbRow(k, 3u).z)), w, 0.9), res), front), 0.45 + 0.4 * front);
  }
  if (n == 0u) { return vec2f(0.0); }
  let web = (fl & 16u) != 0u; let full = (fl & 2u) != 0u && !web;
  let me = gbNearest(k, n, uv); let S = gbSiteLoad(k, me); let st = gpSector(S, uv); let sb = gpSectorBand(S, uv); let s = i32(sb.x); let b = sb.y;
  let d = uv - S.c; let r = length(d);
  let heavy = 0.55 + 0.35 * clamp(h.w, 0.15, 1.0);   // the lines thicken a little as the pane's damage climbs
  var acc = vec2f(0.0, 1e9); var frost = 0.0;   // (coverage, distance to the nearest hole's rim)
  for (var q = 0; q < 2; q++) {   // the radials either side: perpendicular distance, while the crack has run this far (tapering over its last third)
    let kk = s + q; let a = gpAngle(S, kk); let dir = vec2f(cos(a), sin(a)); let N = vec2f(-dir.y, dir.x);
    if (full) { acc = gbEdge(k, fl, n, uv, S.c, N, w, heavy, acc); continue; }
    let along = dot(d, dir); let perp = abs(dot(d, N));
    let reach = gpRho(S, kk, 2u) * (1.25 + 2.0 * gpJit(S.seed, gpWrap(kk, S.n), 9u)) * min(1.6, 0.6 + 0.4 * S.e);
    if (along <= reach) { acc = gbEdge(k, fl, n, uv, S.c, N, w, min(1.0, (reach - along) / (0.33 * reach) + 0.25) * heavy, acc); }
    else { acc.x = max(acc.x, gbLine(length(vec2f(along - reach, perp)), w, 0.25 * heavy)); }
  }
  if (web) {   // laminated: the three chords, an outer ring in most sectors, a sub-chord inside each band — a tight web that never opens
    var wb = 0u; for (; wb < 4u; wb++) { if (!gpBeyond(S, s, wb, uv)) { break; } }
    for (var cb = u32(max(0, i32(wb) - 1)); cb <= min(2u, wb); cb++) { acc = gbChordEdge(k, 0u, n, uv, S, s, cb, w, select(0.8, 1.0, cb == 0u) * heavy, acc); }
    if (wb >= 3u && gpJit(S.seed, sb.x, 33u) < GP_WEB_RING) { acc = gbChordEdge(k, 0u, n, uv, S, s, 3u, w, 0.6 * heavy, acc); }
    if (wb >= 1u && wb <= 3u && gpJit(S.seed, sb.x, 11u + wb) > 0.35) {
      let f0 = 0.3 + 0.4 * gpJit(S.seed, sb.x, 15u + wb); let f1 = 0.3 + 0.4 * gpJit(S.seed, gpWrap(s + 1, S.n), 15u + wb);
      let A = mix(gpChordPt(S, s, wb - 1u), gpChordPt(S, s, wb), f0); let B = mix(gpChordPt(S, s + 1, wb - 1u), gpChordPt(S, s + 1, wb), f1); let e = B - A;
      acc.x = max(acc.x, gbLine(abs(e.x * (uv.y - A.y) - e.y * (uv.x - A.x)) / max(1e-6, length(e)), w, 0.55 * heavy));
    }
    frost = max(frost, 0.55 * (1.0 - smoothstep(S.rho.x, S.rho.y * 1.3, r)));   // the middle of the web is powder held by the interlayer
  } else {   // annealed: the chords either side of the point's own piece (chord 2 only in a share of the sectors until the pane runs — a rim either way)
    let merged = gpMerged(S, sb.x);
    let inner = select(select(select(0, 1, b == 2u), 2, b >= 3u), -1, b == 0u);
    let outer = select(select(select(-1, 2, b == 2u), select(1, 2, merged), b == 1u), 0, b == 0u);
    let c2 = select(0.0, 0.8, full || gpJit(S.seed, sb.x, 31u) < GP_C2_DRAWN);
    if (inner >= 0) { acc = gbChordEdge(k, fl, n, uv, S, s, u32(inner), w, select(select(0.8, c2, inner == 2), 1.0, inner == 0) * heavy, acc); }
    if (outer >= 0) { acc = gbChordEdge(k, fl, n, uv, S, s, u32(outer), w, select(select(0.8, c2, outer == 2), 1.0, outer == 0) * heavy, acc); }
    if (b == 0u) { acc.x = max(acc.x, 0.5); frost = max(frost, 0.75); }   // a crater still in (a blow too soft to punch it): crushed white
  }
  if (full && b >= 3u) {   // past the rings of a run pane: the sector's branch crack and this half's snap
    let sp = gpSplit(S, s); let asp = S.rot + GP_TAU * sp / f32(S.n);
    acc = gbEdge(k, fl, n, uv, S.c, vec2f(-sin(asp), cos(asp)), w, 0.9 * heavy, acc);
    let c = gpCut(S, s, select(0u, 1u, st.y >= sp));
    if (c.on) { acc = gbEdge(k, fl, n, uv, c.p, c.n, w, 0.8 * heavy, acc); }
  }
  if (full && n >= 2u) {   // where this blow's cracks met the next one's
    var j2 = 0u; var d2 = 1e30; let d1 = dot(d, d) - S.rz * S.rz;
    for (var j = 0u; j < n; j++) { if (j == me) { continue; } let a = gbRow(k, GB_HDR + j * 4u); let qv = uv - a.xy; let dq = dot(qv, qv) - a.w * a.w; if (dq < d2) { d2 = dq; j2 = j; } }
    let cj = gbRow(k, GB_HDR + j2 * 4u).xy; let sep = max(1e-6, distance(cj, S.c));
    let dd = (d2 - d1) / (2.0 * sep);
    acc.x = max(acc.x, gbLine(dd, w, 0.8 * heavy));
    if ((fl & 1u) != 0u && dd < 0.012 + 2.0 * w && gbOpenUV(k, fl, n, uv + (cj - S.c) / sep * (dd + 0.004))) { acc.y = min(acc.y, dd); }
  }
  let rim = 1.0 - smoothstep(0.003, 0.010 + 2.0 * w, acc.y);   // the raw edge beside a hole
  return vec2f(max(acc.x, rim), max(frost, 0.8 * rim));
}
fn paneLight(X: vec3f, n: vec3f) -> vec3f {
  var best = vec3f(0.0); var bestW = 0.0; var bestL = vec3f(0.0); var bestD = 0.0; var bestI = -1; var rest = vec3f(0.0);
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    if (!lightReaches(i, X)) { continue; }
    let ev = evalLight(li, X, vec3f(0.0));
    if (!ev.ok) { continue; }
    let E = ev.E * abs(dot(n, ev.L));
    let w = luminance(E);
    if (w < 1e-4) { continue; }
    if (w > bestW) { rest += best; best = E; bestW = w; bestL = ev.L; bestD = ev.dist.x; bestI = i32(i); }
    else { rest += E; }
  }
  var Ed = rest * 0.5;
  if (bestI >= 0) {
    let li = lights[u32(bestI)];
    let side = X + n * (0.015 * sign(dot(n, bestL)));                    // start on the face the light is on
    let tmax = select(bestD - li.radius - 0.02, 60.0, lightKind(li) == 2u);
    if (!(tmax > 0.0 && occluded(side, bestL, tmax, (li.owner & 0xffu) << 8u))) {
      var tr = 1.0;
      if (frame.numSmoke > 0u) { tr = smokeTransmittance(side, bestL, min(max(tmax, 0.0), 30.0)); }
      Ed += best * tr;
    }
  }
  if ((frame.flags & FLAG_BOUNCE) != 0u) { let s = c0Spacing(); Ed += 0.5 * (diceIrradiance(X + n * s, n) + diceIrradiance(X - n * s, -n)); }
  return Ed;
}

// ---- wet characters (game/wet.ts): the clear coat of water over a wet man's pixel ----
// gbuffer.wgsl fsSkin packed the coat's roughness and gain and the bead's normal tilt into the id's low 20 bits (packWet) and raised bit 30 — never on a dry man
// or with the setting off, so none of this then runs. ONE GGX lobe per light that reaches this cell, scored unshadowed and then dimmed by the direct pass's OWN
// shadowing here — the ratio of the shadowed irradiance it delivered (Ed) to the unshadowed sum of the same lights, exact wherever one light dominates (a torch
// on him, the lamp over the lot) and carrying the smoke, the penumbra filter and its history for free — each lobe widened by its emitter's angular size so a
// bare bulb cannot draw a one-pixel sun (Karis' sphere-light term, renormalised); then the sheen of the ambient: the bounce arriving here mirrored at the view
// angle's Fresnel, which is what reads as wet at grazing angles where no lamp happens to mirror. Radiance, added as it is — specular is never × albedo.
const WET_F0: f32 = 0.02;            // water at normal incidence
const WET_TILT: f32 = 0.9;           // a bead's rim tilts the normal this far (tan): a flattened cap, not a hemisphere
const WET_SPEC_MAX: f32 = 30.0;      // luminance bound on the direct lobes (scene-referred: white long before this after the tonemap — a bound on sparkle outliers, not a look)
const WET_SHEEN: f32 = 0.6;          // × the ambient sheen
// The lobes are shadowed PER EMITTER CLASS (EdS = the sharp class's shadowed direct here, EdB = the broad class's: the two targets the direct chain keeps apart): each class's
// lobes × that class's own shadowed ∕ unshadowed ratio. One ratio over both drew the highlight of a light that is wholly hidden — the sodium street lamp behind the outer
// wall, broad, orange, the brightest unshadowed term in the rooms beside it — on every upturned pouch and boot the moment a torch (sharp) put any light on the man.
fn wetCoatSpec(id: u32, P: vec3f, N: vec3f, z: f32, EdS: vec3f, EdB: vec3f, Ei: vec3f) -> vec3f {
  let gain = f32((id >> 5u) & 31u) * (2.0 / 31.0);
  if (gain <= 0.0) { return vec3f(0.0); }
  let rough = 0.03 + f32(id & 31u) * (0.62 / 31.0);
  let tT = (f32((id >> 10u) & 31u) - 16.0) / 15.0; let tB = (f32((id >> 15u) & 31u) - 16.0) / 15.0;
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  let Ns = normalize(N + (T * tT + B * tB) * WET_TILT);
  let V = (frame.camPos - P) / max(z, 1e-4);
  let NdotV = clamp(dot(Ns, V), 0.05, 1.0);
  let a = rough * rough;
  var sumS = vec3f(0.0); var sumB = vec3f(0.0); var UdS = vec3f(0.0); var UdB = vec3f(0.0);
  for (var i = 0u; i < frame.numLights; i++) {
    if (!lightReaches(i, P)) { continue; }
    let li = lights[i];
    let ev = evalLight(li, P, vec3f(0.0));                 // square-on irradiance (no receiver cosine)
    if (!ev.ok) { continue; }
    let NdotL = dot(N, ev.L);
    if (NdotL <= 0.0) { continue; }
    let broad = lightBroad(li);
    if (broad) { UdB += ev.E * NdotL; } else { UdS += ev.E * NdotL; }   // what the direct pass scored here for it, unshadowed, in its class
    let NsL = dot(Ns, ev.L);
    if (NsL <= 0.0) { continue; }
    let hv = ev.L + V;
    if (dot(hv, hv) < 1e-8) { continue; }                 // the light dead behind the eye's line: no half vector
    let H = hv * inverseSqrt(dot(hv, hv));
    let NdotH = clamp(dot(Ns, H), 0.0, 1.0); let VdotH = clamp(dot(V, H), 0.0, 1.0);
    let wid = select(li.radius / (2.0 * max(ev.dist.x, 0.05)), li.radius * 0.5, lightKind(li) == 2u);   // the emitter's angular half-size (kind 2: radius IS angular)
    let ap = clamp(a + wid, a, 1.0);
    let a2 = ap * ap;
    let dn = NdotH * NdotH * (a2 - 1.0) + 1.0;
    let D = a2 / (3.14159265 * dn * dn) * ((a * a) / a2);   // GGX at the widened width × (a/a')²: the lobe's energy, spread over the disc
    let Vis = 0.5 / (NsL * (NdotV * (1.0 - ap) + ap) + NdotV * (NsL * (1.0 - ap) + ap) + 1e-4);   // height-correlated Smith, the usual approximation
    let uf = 1.0 - VdotH; let F = WET_F0 + (1.0 - WET_F0) * uf * uf * uf * uf * uf;   // Schlick (the base clamped above: pow of a negative ulp is NaN on some backends)
    let lobe = ev.E * (D * Vis * F * NsL);
    if (broad) { sumB += lobe; } else { sumS += lobe; }
  }
  let visS = clamp(luminance(EdS) / max(luminance(UdS), 1e-4), 0.0, 1.0);
  let visB = clamp(luminance(EdB) / max(luminance(UdB), 1e-4), 0.0, 1.0);
  var L = sumS * visS + sumB * visB;
  let lum = luminance(L);
  L = select(L, L * (WET_SPEC_MAX / lum), lum > WET_SPEC_MAX);
  // the sheen: what the coat mirrors of the room / the sky. The mirror direction's hemisphere off the radiance cache (three fetches — the floor's lit pool below a
  // camera-facing flank, the dark ceiling off an upturned shoulder, the sky outdoors), else the pixel's own bounce; × Fresnel at the view angle (bright rims)
  let uv1 = 1.0 - NdotV; let Fv = WET_F0 + (1.0 - WET_F0) * uv1 * uv1 * uv1 * uv1 * uv1;
  let R = reflect(-V, Ns);
  var env = Ei;
  if ((frame.flags & FLAG_BOUNCE) != 0u) { if (BOUNCE_WALLS) { let q = diceWalledPoint(P, N, (id >> 20u) & 0xffu); if (q.w > 0.0) { env = diceIrradiance(q.xyz, R); } } else { env = diceIrradiance(P + N * c0Spacing(), R); } }   // (BOUNCE WALLS, lighting_common.wgsl: a man by a wall never mirrors the room behind it)
  env = mix(vec3f(luminance(env)), env, 0.5);   // half the chroma: the cache is a metre coarse and a wet coat's mirror is blurry — the brightness is the cue, a cell-wide colour cast (a green cabinet glazing a black suit teal) is not
  let sheen = env * ((1.0 / 3.14159265) * Fv * WET_SHEEN * (1.0 - 0.5 * rough));
  L += sheen;
  return L * gain;
}

// ---- SNOW GLOW (const SNOW_GLOW in the scene prelude: render/frame.ts snowLookConfig.glow ← game/weatherKinds.ts SNOW_LOOK.glow; false = every statement of it is dead code) ----
// The look of light INSIDE lying snow, as an approximation (no scattering is computed): on a snow pixel a lamp's light does not stop at the terminator. It wraps a
// little past it, what comes through has lost the lamp's own hue and most of its red, and shade on snow leans to blue. PICTURE ONLY, by where it stands: this module
// is the last word on a primary hit's colour and nothing reads its output back into the lighting (the meter and the probes are probe.wgsl, the bounce is
// lighting_common.wgsl hitRadiance → common.wgsl directIrradiance; neither is touched, and evalLight is called here as the wet coat above calls it, unchanged).
// A snow pixel is one whose normal target's alpha is under 1 (gbuffer.wgsl fsBox after snowBox, snow.wgsl fsSnow: 1∕3 = snow, 2∕3 = thin snow at its edge).
// PER LIGHT that reaches the cell, scored square-on (no receiver cosine) as the wet coat scores it: with c = N·L,
//   past the terminator (−WRAP < c < 0)  GAIN · ((c + WRAP) ∕ WRAP)²          the wrap: nothing at −WRAP, GAIN at the terminator
//   on the lit side (c ≥ 0)              GAIN · (1 − c)⁴                       it dies toward the lamp: snow square under a lamp is as bright as it was
// in a colour that is the lamp's, WHITEN of the way to its own grey (many scatterings later the hue is washed out), × TINT from the terminator on (white by c = WRAP).
// NO RAY: the term is × the direct pass's OWN shadowing per emitter class, as the wet coat's lobes are — but a pixel past the terminator of its one lamp has no
// shadowed light of its own to take a ratio of, so the ratio is taken over the pixel and four neighbours REACH metres off on the screen (the same surface: within
// 3 × REACH of its distance), Σ shadowed ∕ Σ unshadowed with each neighbour's own normal. So: a lamp wholly hidden from that hand's width of snow adds nothing
// (shadowed light stays shadowed); a penumbra or a shadow's edge bleeds REACH into the dark; and snow that turns away from the lamp over more than REACH (the
// whole back of a big drift) gets none — the stencil's mean cosine under CONF fades the term out rather than guess. Where two lamps of one class light the spot
// the ratio is the brighter one's (the wet coat's note). The fog of war draws AFTER this module (passes.ts: FogPass over hdr): a pixel the team does not see
// shows none of it, like the rest of the live frame.
const SNOW_GLOW_WRAP: f32 = 0.4;                          // how far past the terminator a lamp's light comes through, as −N·L (0.4 ≈ 24°)
const SNOW_GLOW_GAIN: f32 = 0.15;                         // the term AT the terminator, as a share of the lamp's square-on light
const SNOW_GLOW_TINT: vec3f = vec3f(0.45, 0.74, 1.0);     // what comes through: ice takes the red first
const SNOW_GLOW_WHITEN: f32 = 0.6;                        // how far the lamp's hue is washed toward its own grey before the tint
const SNOW_GLOW_REACH: f32 = 0.12;                        // metres: the stencil's arm (1 ‥ 14 px)
const SNOW_GLOW_CONF: f32 = 0.03;                         // the stencil's mean N·L (per class) under which the term fades out
const SNOW_GLOW_SHADE: vec3f = vec3f(0.93, 1.0, 1.11);    // × the bounce and the sky's light on snow in full shade (luminance kept): never dead grey
fn snowGlowAmt(a: f32) -> f32 { return clamp((1.0 - a) * 1.5, 0.0, 1.0); }
fn snowGlow(sPix: vec2i, P: vec3f, N: vec3f, z: f32, EdS: vec3f, EdB: vec3f) -> vec3f {
  var fac = vec4f(0.0); var kS = vec3f(0.0); var kB = vec3f(0.0); let V = (frame.camPos - P) / max(z, 1e-4);   // SNOW SPARKLE (below): this pixel's facet, what it flashes per class
  if (SNOW_SPARKLE) { snowSparkleL = vec3f(0.0); fac = snowSparkleFacet(P, N, z); if (!SNOW_GLOW && fac.w <= 0.0) { return vec3f(0.0); } }   // (the sparkle alone, and no facet here: nothing to do)
  let r = i32(clamp(SNOW_GLOW_REACH / max(z * 2.0 * frame.post.w * frame.invScreen.y, 1e-5), 1.0, 14.0) + 0.5);
  let hi = vec2i(textureDimensions(gDepth)) - 1;
  var Nk: array<vec3f, 4>; var S = vec2f(luminance(EdS), luminance(EdB)); var pts = 1.0;
  for (var k = 0; k < 4; k++) {
    Nk[k] = vec3f(0.0);
    let q = sPix + select(vec2i(select(-r, r, k == 1), 0), vec2i(0, select(-r, r, k == 3)), k >= 2);   // (x∓r, y), (x, y∓r)
    if (any(q < vec2i(0)) || any(q > hi)) { continue; }
    let d = textureLoad(gDepth, q, 0);
    if (d >= 1.0 || abs(linearDepth(d, vec2f(q) + 0.5) - z) > 3.0 * SNOW_GLOW_REACH) { continue; }   // another surface (a wall's top, the lorry's bed): not this snow's light
    Nk[k] = normalize(textureLoad(gNormal, q, 0).xyz * 2.0 - 1.0);
    S += vec2f(luminance(textureLoad(directTex, q, 0).rgb), luminance(textureLoad(softTex, q, 0).rgb)); pts += 1.0;
  }
  if (S.x <= 0.0 && S.y <= 0.0) { return vec3f(0.0); }   // no light of either class reaches the stencil (deep shade, under a roof): vis below is exactly 0 — the loop is not walked
  var U = vec2f(0.0); var Q = vec2f(0.0); var gS = vec3f(0.0); var gB = vec3f(0.0);
  for (var i = 0u; i < min(frame.numLights, 64u); i++) {
    if (!lightReaches(i, P)) { continue; }
    let li = lights[i];
    let ev = evalLight(li, P, vec3f(0.0));                 // square-on irradiance (no receiver cosine)
    if (!ev.ok) { continue; }
    let w = luminance(ev.E); let c = dot(N, ev.L);
    let u = w * (max(c, 0.0) + max(dot(Nk[0], ev.L), 0.0) + max(dot(Nk[1], ev.L), 0.0) + max(dot(Nk[2], ev.L), 0.0) + max(dot(Nk[3], ev.L), 0.0));   // what the direct pass scored for it over the stencil, unshadowed
    let broad = lightBroad(li);
    if (broad) { U.y += u; Q.y += w; } else { U.x += u; Q.x += w; }
    if (SNOW_SPARKLE) { if (fac.w > 0.0 && c > 0.0) { let k = mix(ev.E, vec3f(w), SNOW_SPARKLE_WHITEN) * (snowSparkleLobe(fac.xyz, ev.L, V) * smoothstep(0.0, SNOW_SPARKLE_EDGE, c)); if (broad) { kB += k * SNOW_SPARKLE_BROAD; } else { kS += k; } } }
    if (!SNOW_GLOW) { continue; }   // (the sparkle alone walks this loop: none of the glow's terms below)
    if (c <= -SNOW_GLOW_WRAP) { continue; }
    if (select(S.x, S.y, broad) <= 0.0) { continue; }   // (its class is wholly shadowed over the stencil: its share is × 0 below)
    let t = (c + SNOW_GLOW_WRAP) / SNOW_GLOW_WRAP; let l = 1.0 - min(c, 1.0); let l2 = l * l;
    let g = mix(ev.E, vec3f(w), SNOW_GLOW_WHITEN) * mix(vec3f(1.0), SNOW_GLOW_TINT, clamp(1.0 - c / SNOW_GLOW_WRAP, 0.0, 1.0)) * (SNOW_GLOW_GAIN * select(l2 * l2, t * t, c < 0.0));
    if (broad) { gB += g; } else { gS += g; }
  }
  // per class: the stencil's shadowed ∕ unshadowed light (the direct pass's own rays, penumbra filter and smoke), × how sure the stencil is (its mean cosine ∕ CONF)
  let vis = clamp(S / max(U, vec2f(1e-4)), vec2f(0.0), vec2f(1.0)) * clamp(U / max(Q * (pts * SNOW_GLOW_CONF), vec2f(1e-6)), vec2f(0.0), vec2f(1.0));
  if (SNOW_SPARKLE) { snowSparkleL = (kS * vis.x + kB * vis.y) * (fac.w * SNOW_SPARKLE_GAIN); }
  return gS * vis.x + gB * vis.y;
}

// ---- SNOW SPARKLE (const SNOW_SPARKLE in the scene prelude: render/frame.ts snowLookConfig.sparkle ← game/weatherKinds.ts SNOW_LOOK.sparkle; false = every statement of it is dead code) ----
// The maintainer, 10-14, with a still of Red Dead Redemption 2's snow by day: 'rdr2 has some nice "sparkle" on the snow on the ground' (and, of the whole snow
// look, "overall this should be subtle"). Ice crystals lie in fresh snow with flat faces every way up, and a face is a tiny mirror: it shows the lamp, as a point
// far brighter than the snow round it, only while its normal is the half vector between the lamp and the eye. PICTURE ONLY, by where it stands (the glow's
// header above: this module's output is read by no lighting pass, the meter and the probes are another program).
// THE GRAINS: the snow's plan cut into square cells GRAIN m wide, doubled until a cell is no finer than PX pixels (in octaves of distance, as snow.wgsl's glints:
// a grain is the same grain until the view has doubled its distance). SHARE of the cells hold a facet: a POINT somewhere in the cell by its own hash, with a
// normal of its own leant off the surface's by up to atan(SPREAD), any way round, and a brightness of its own (most are dim, few are full). The point is drawn
// a PIXEL wide whatever the cell: full within CORE pixels of its place, falling to nothing one pixel further out — so wherever this frame's sub-pixel jitter
// puts the samples, the nearest one is within 0.71 px of it and takes over half of it (a dot finer than the raster would come and go with the jitter, and TAAU's
// clip would take it for a firefly: the first build's points did not survive it). A pixel asks the nine cells round it and shows the point it is nearest.
// THE FLASH, per light that reaches the cell (the glow's own loop above: lightReaches + evalLight as they stand, so the fog of war's light classes hold), on the
// lit side only (N·L > 0, eased in over EDGE): the lamp's square-on light, WHITEN of the way to its grey, × the facet's cosine to the lamp × a lobe that is 1
// while the facet is within acos(COS1) of the half vector and 0 past acos(COS0) — a few degrees, so walking a metre (the follow camera translates with the
// player: V turns at every point) or sweeping a torch puts one set of points out and lights another — × GAIN; a broad emitter's flash is × BROAD (a mirror
// shows a wide source dimmer). NO RAY: × the glow's shadow ratio per emitter class (the direct pass's own shadows over the stencil): nothing in shade.
// ONLY FRESH SNOW: × the snow mark (thin snow at its edge takes less) and × a band round fresh snow's finish in the material target — snow.wgsl snowShade
// sets a boot print's and a fallen man's dent matt (roughness → 1) and a trodden path's tighter (−0.14); neither is in the band, so neither sparkles.
// The points are added as light (never × the albedo), into `spec` (debug view 10 shows them alone), through a pane like the rest of the pixel.
const SNOW_SPARKLE_GRAIN: f32 = 0.006;                    // metres: the finest grain cell
const SNOW_SPARKLE_PX: f32 = 1.5;                         // … and no cell finer than this many pixels
const SNOW_SPARKLE_SHARE: f32 = 0.5;                      // the share of cells that hold a facet
const SNOW_SPARKLE_CORE: f32 = 0.25;                      // pixels: a point is full within this of its place, and gone one pixel further out
const SNOW_SPARKLE_SPREAD: f32 = 1.0;                     // how far a facet leans off the surface, as a tangent (1.0 = 45°: a low lamp seen from the far side still finds facets)
const SNOW_SPARKLE_COS0: f32 = 0.996917;                  // the lobe's foot: cos 4.5° between the facet and the half vector
const SNOW_SPARKLE_COS1: f32 = 0.999391;                  // … and its top: cos 2°
const SNOW_SPARKLE_GAIN: f32 = 2.0;                       // a full facet square on its mirror line, as radiance per unit of the lamp's square-on light
const SNOW_SPARKLE_WHITEN: f32 = 0.5;                     // how far the lamp's hue is washed toward its own grey (a point that bright reads white)
const SNOW_SPARKLE_BROAD: f32 = 0.5;                      // × a broad emitter's flash
const SNOW_SPARKLE_EDGE: f32 = 0.15;                      // N·L under which the flash fades out toward the terminator
const SNOW_SPARKLE_FAR: vec2f = vec2f(22.0, 40.0);        // metres from the eye: full to here, none past there (a far field of snow lies still)
const SNOW_SPARKLE_ROUGH: vec4f = vec4f(0.80, 0.88, 0.94, 0.99);   // the material target's roughness: in over .xy, out over .zw (fresh snow is 0.92: snowField.ts SNOW_SURF.rough)
var<private> snowSparkleL: vec3f;                         // what snowGlow's loop found for this pixel (written only under SNOW_SPARKLE)
fn snowSparkleHash(p: vec2i, salt: u32) -> f32 { var h = (u32(p.x + 32768) * 73856093u) ^ (u32(p.y + 32768) * 19349663u) ^ (salt * 0x9E3779B9u); h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return f32(((h >> 22u) ^ h) & 0xffffu) * (1.0 / 65536.0); }
/** this pixel's facet: xyz = its normal, w = how much of a facet the pixel shows (0 = none: most of the snow) */
fn snowSparkleFacet(P: vec3f, N: vec3f, z: f32) -> vec4f {
  let far = 1.0 - smoothstep(SNOW_SPARKLE_FAR.x, SNOW_SPARKLE_FAR.y, z);
  if (far <= 0.0) { return vec4f(0.0); }
  let fp = z * 2.0 * frame.post.w * frame.invScreen.y;   // metres a pixel here
  let oct = ceil(log2(max(SNOW_SPARKLE_PX * fp, SNOW_SPARKLE_GRAIN) / SNOW_SPARKLE_GRAIN));
  let g = SNOW_SPARKLE_GRAIN * exp2(oct); let q = P.xz / g; let c0 = vec2i(floor(q)); let salt = 41u + u32(oct + 0.5);
  var ci = c0; var dot1 = 0.0;
  for (var j = 0; j < 9; j++) {   // the nine cells round the pixel: the point nearest it
    let cj = c0 + vec2i(j % 3, j / 3) - 1;
    if (snowSparkleHash(cj, salt) >= SNOW_SPARKLE_SHARE) { continue; }
    let w = clamp(SNOW_SPARKLE_CORE + 1.0 - length(q - (vec2f(cj) + vec2f(snowSparkleHash(cj, salt + 7u), snowSparkleHash(cj, salt + 13u)))) * (g / max(fp, 1e-6)), 0.0, 1.0);
    if (w > dot1) { dot1 = w; ci = cj; }
  }
  if (dot1 <= 0.0) { return vec4f(0.0); }
  let h = vec2f(snowSparkleHash(ci, salt + 19u), snowSparkleHash(ci, salt + 29u));
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  let a = 6.2831853 * h.x; let lean = SNOW_SPARKLE_SPREAD * sqrt(h.y);   // (even over the disc of leans)
  let bright = snowSparkleHash(ci, salt + 37u);
  return vec4f(normalize(N + (T * cos(a) + B * sin(a)) * lean), dot1 * mix(0.25, 1.0, bright * bright) * far);
}
/** how much of lamp L a facet of normal Nf mirrors to the eye along V: its cosine to the lamp × the lobe round the half vector */
fn snowSparkleLobe(Nf: vec3f, L: vec3f, V: vec3f) -> f32 {
  let hv = L + V; let h2 = dot(hv, hv);
  if (h2 < 1e-8) { return 0.0; }
  return smoothstep(SNOW_SPARKLE_COS0, SNOW_SPARKLE_COS1, dot(Nf, hv * inverseSqrt(h2))) * max(dot(Nf, L), 0.0);
}
fn snowSparkleFresh(rough: f32) -> f32 { return smoothstep(SNOW_SPARKLE_ROUGH.x, SNOW_SPARKLE_ROUGH.y, rough) * (1.0 - smoothstep(SNOW_SPARKLE_ROUGH.z, SNOW_SPARKLE_ROUGH.w, rough)); }

fn linearToSrgb(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}

// ---- refraction through the glass boxes (settings.glassRefract → the GLASS_REFRACT module; frame.glassCfg.w = the index of refraction n) — over refract_common.wgsl,
// the pure helpers the particle rain's water streaks share (refractDir / slabExit / beerLambert / refractProbeDist / screenRefractPx / clampRefractOffset) ----
// The view ray that meets glass box k at X bends INTO it (Snell, 1 → n: never total going in), crosses the box to the face it leaves by (slabExit, in the box's yawed
// frame — glassTrace's convention), and bends OUT (n → 1); a face it meets past the critical angle mirrors it instead (total internal reflection) and it crosses
// once more — three stretches at most, then it is let out as it runs. ONE law for every Glass box: a 12 mm pane lets the ray out parallel, shifted a few millimetres
// (nothing on screen but at a graze); the bottle's faces at right angles deviate it, and its 30 cm shift it centimetres. → the exit point E, the exit direction d,
// the length of glass crossed, and the box's reference thickness `unit` (twice its thinnest half-extent: the tint authored on a Glass box is READ AS its transmittance
// square through that — beerLambert's unit — so a pane square-on keeps exactly the tint it always had, and a slanting path, the bottle's diagonal or a mirrored leg
// inside it come out deeper by the same law, with no thickness switch anywhere).
const REFR_MAX_M: f32 = 1.5;      // the bent ray is followed at most this far behind the glass before the picture is read (a bottle against the far wall reads the wall a stride on, not across the room)
const REFR_MAX_PX: f32 = 0.12;    // … and its read point moves at most this share of the frame's height across the screen (a bound on a graze's worst case; square-on it is never reached)
struct GlassPath { E: vec3f, d: vec3f, len: f32, unit: f32, ok: bool };
fn glassRefractPath(X: vec3f, V: vec3f, k: u32, n: vec3f, ior: f32) -> GlassPath {
  let p0 = scene.glass[k * 3u]; let p1 = scene.glass[k * 3u + 1u];
  let cs = vec2f(p0.w, p1.w); let h = p1.xyz;
  var r: GlassPath; r.unit = 2.0 * min(min(h.x, h.y), h.z); r.ok = false;
  let w = X - p0.xyz;
  var lo = vec3f(cs.x * w.x - cs.y * w.z, w.y, cs.y * w.x + cs.x * w.z);          // into the box's frame (local = Rᵀ · world)
  let d0 = refractDir(V, n, 1.0 / ior).xyz;                                       // in: bent toward the entered face's normal (n faces the eye's side, as glassTrace hands it; η < 1 never mirrors)
  var ld = vec3f(cs.x * d0.x - cs.y * d0.z, d0.y, cs.y * d0.x + cs.x * d0.z);
  var len = 0.0;
  for (var b = 0; b < 3; b++) {
    let ex = slabExit(lo, ld, h);                                                 // the face it leaves by, from inside
    lo += ld * ex.t; len += ex.t;
    let o = refractDir(ld, -ex.n, ior);                                           // out: n → 1 — or mirrored back in past the critical angle (.w 0), across the box once more
    ld = o.xyz;
    if (o.w > 0.0) { r.ok = true; break; }
  }
  r.len = len;
  r.E = p0.xyz + vec3f(cs.x * lo.x + cs.y * lo.z, lo.y, -cs.y * lo.x + cs.x * lo.z);   // back to the world (local +x → (cos, 0, −sin), +z → (sin, 0, cos), as glassTrace's normal)
  r.d = normalize(vec3f(cs.x * ld.x + cs.y * ld.z, ld.y, -cs.y * ld.x + cs.x * ld.z));
  return r;
}
// Where the bent ray's continuation is READ on this raster (screen space: nothing is traced). It meets what this pixel already shows — the plane of that surface
// (P0, N0: refractProbeDist) — and that point, projected with this raster's own matrices (screenRefractPx: frame.viewProj / frame.screen — the internal raster's
// jittered ones, or the sharp output raster's), is the pixel whose G-buffer surface stands in for what the ray sees. Guards: the offset capped and shrunk to stay
// on the screen (clampRefractOffset), and the read refused — the pixel keeps its own — where the sky shows there or where what shows there lies IN FRONT of the
// glass's exit point (a mullion, a sill, a man before the neighbouring stretch of pane: nothing nearer than the glass can be seen through it). → (pixel, its depth, its point, ok).
struct GlassRead { pix: vec2i, depth: f32, P: vec3f, ok: bool };
fn refractedRead(pixf: vec2f, P0: vec3f, N0: vec3f, gp: GlassPath) -> GlassRead {
  var r: GlassRead; r.ok = false; r.pix = vec2i(pixf); r.depth = 0.0; r.P = P0;
  let q = screenRefractPx(gp.E, gp.d, refractProbeDist(gp.E, gp.d, P0, N0, REFR_MAX_M), frame.viewProj, frame.screen);
  if (q.z <= 0.0) { return r; }
  let rp = vec2i(pixf + clampRefractOffset(pixf, q.xy - pixf, REFR_MAX_PX * frame.screen.y, frame.screen));
  if (all(rp == vec2i(pixf))) { return r; }                                       // under half a pixel (a pane anywhere near square-on): nothing to move
  let rd = textureLoad(gDepth, rp, 0);
  if (rd >= 1.0) { return r; }                                                    // the sky shows there: keep the pixel's own read
  let Pr = worldFromDepth(vec2f(rp) + 0.5, rd);
  if (distance(Pr, frame.camPos) < distance(gp.E, frame.camPos) - 0.03) { return r; }   // nearer than the glass's exit: not something seen THROUGH it
  r.pix = rp; r.depth = rd; r.P = Pr; r.ok = true; return r;
}

@fragment fn fs(v: VOut) -> @location(0) vec4f { let px = compositePixel(v.pos.xy); return vec4f(px, 1.0 - fireReact); }
/** SHARP DIRECT: the composite per OUTPUT pixel (dispatched only from the SHARP = true module, one thread per output pixel, hdrOut = the output-size HDR target) */
@compute @workgroup_size(8, 8) fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let od = textureDimensions(hdrOut);
  if (gid.x >= od.x || gid.y >= od.y) { return; }
  let px = compositePixel(vec2f(gid.xy) + 0.5);
  textureStore(hdrOut, gid.xy, vec4f(px, 1.0 - fireReact));   // (alpha: 1 but where an open fire burns — fireReact; nobody else reads it)
}

/** the composite at pixel centre `pixf` of the raster this module runs at → scene-referred colour; post.wgsl takes it from here (debug views 1/2/6/9 are passed through untouched there) */
// THE SQUAD'S WEAPON LASERS AS LIGHT IN THE AIR (settings.beamAir; `?nobeamair` = the opaque boxes exactly as they were). passes.ts setBeams hands the laser
// lines over as segments (the reflection pass's own buffer) and keeps their boxes out of the raster; here each is ADDED to the pixel as what a beam is: a thin
// line of scattered light whose brightness is the air's (seg.e.w: haze; more in rain, with drops flashing as they cross it; more inside smoke), brighter looked
// along than across, with the DOT where it lands (seg.b.w) and a glint at the device. Picture only: nothing the game reads. a = start + drawn half-width,
// b = end + dot, e = the box's (dimmed) emissive + the air's share.
struct BeamSeg { a: vec4f, b: vec4f, e: vec4f };
struct Beams { n: u32, p0: u32, p1: u32, p2: u32, k: vec4f, seg: array<BeamSeg, 8>, fireN: vec4u, fire: array<FireRec, 4>, fireLook: FireLook };   // (… and, behind the segments, THE OPEN FIRES: passes.ts setFires — fire.wgsl FireRec, fireN.x of them, and the look's numbers they are all drawn with, FireLook; the reflection pass's own struct stops at the segments)
@group(1) @binding(15) var<uniform> beams: Beams;
const BEAM_R0 = 0.0022;                           // combat.ts beamBoxes: the beam's own half-width, m
fn beamOutdoors(p: vec2f) -> bool {
  if (WX_KINDS) { if (frame.cardCfg.y != 0u) { return !wxRoofed(p); } }
  let I = frame.weatherC; let A = frame.weatherD;
  return (p.x < I.x || p.y < I.y || p.x > I.z || p.y > I.w) && (p.x < A.x || p.y < A.y || p.x > A.z || p.y > A.w);
}
fn beamSpot(ro: vec3f, D: vec3f, tMax: f32, P: vec3f, cpix: f32, r: f32, haloK: f32) -> f32 {
  let w = P - ro; let t = dot(w, D);
  if (t <= 0.0 || t > tMax + 0.06) { return 0.0; }
  let d2 = dot(w, w) - t * t;
  let sg = max(r, 0.6 * cpix * t); let sh = 4.0 * sg;
  if (d2 > 9.0 * sh * sh) { return 0.0; }
  let peak = min(1.0, (r * r) / (sg * sg));       // a spot smaller than a pixel keeps its light, not its radiance
  return peak * (exp(-0.5 * d2 / (sg * sg)) + haloK * exp(-0.5 * d2 / (sh * sh)));
}
fn beamPix() -> f32 { return 2.0 * frame.post.w * frame.invScreen.y; }   // metres across a pixel per metre of distance (this program's own frame block: the output's under SHARP)
fn beamAir(ro: vec3f, D: vec3f, tMax: f32, cpix: f32) -> vec3f {
  var L = vec3f(0.0);
  let nb = min(beams.n, 8u);
  let rain = frame.weatherA.x;
  for (var i = 0u; i < nb; i++) {
    let s = beams.seg[i];
    if (s.e.w <= 0.0) { continue; }
    let dv = s.b.xyz - s.a.xyz; let len = length(dv);
    if (len < 1e-3) { continue; }
    let u = dv / len;
    let E0 = s.e.xyz * (s.a.w / BEAM_R0);         // the beam's own radiance, the pixel floor's dimming taken back out
    if (s.b.w > 0.0) { L += E0 * (3.5 * beamSpot(ro, D, tMax, s.b.xyz, cpix, 0.009, 0.07)); }
    L += E0 * (1.8 * beamSpot(ro, D, tMax, s.a.xyz, cpix, 0.009, 0.05));
    let w0 = ro - s.a.xyz; let ru = dot(D, u); let rw = dot(D, w0); let uw = dot(u, w0);
    let den = max(1.0 - ru * ru, 1e-4);
    var q = clamp((uw - ru * rw) / den, 0.0, len);
    let t = clamp(ru * q - rw, 0.0, tMax);
    q = clamp(uw + ru * t, 0.0, len);
    let Q = s.a.xyz + u * q;
    let dq = Q - (ro + D * t);
    let d2 = dot(dq, dq);
    let sg = max(BEAM_R0, 0.55 * cpix * t); let sh = 3.0 * sg + 0.004;
    if (d2 > 9.0 * sh * sh) { continue; }
    var A = s.e.w;
    if (rain > 0.0) { if (beamOutdoors(Q.xz)) {
      let cq = q / 0.04; let fq = fract(cq);
      let h = hash13(vec3f(floor(cq) + 37.0 * f32(i), floor(frame.time * 24.0), 3.7));
      A += 0.25 * rain + select(0.0, 3.0 * (1.0 - abs(2.0 * fq - 1.0)) * fract(h * 53.0), h > 1.0 - 0.22 * rain);
    } }
    if (frame.numSmoke > 0u) { A += min(3.0, 1.2 * smokeDensityAt(Q)); }
    let I = 2.0 * BEAM_R0 * A * min(inverseSqrt(den), 4.0);   // light scattered per metre of line toward the eye; more of it in the pixel looked along the beam
    L += E0 * (I * 0.399 * (exp(-0.5 * d2 / (sg * sg)) / sg + 0.15 * exp(-0.5 * d2 / (sh * sh)) / sh));
  }
  return L;
}
/** THE OPEN FIRES over what the pixel shows (game/fire.ts; fire.wgsl fireAir): each fire's flame and embers along the pixel's ray as far as its surface, the
 *  one this ray meets last drawn first (by where the ray enters each one's bound: right for this pixel, whatever order the list came in). UNDER THE FOG OF WAR a fire is part of the
 *  place and is drawn as the team last saw it (game/fire.ts FIRE.fog says which, a record at a time: wherever it stands, only where the team sees its coals, or
 *  only where it does not; the fog pass then dims it with the ground it stands on). `c` in, `c` with the fires out. */
/** how much of this pixel is an open fire's flame or drawn smoke (0‥1; fireOver writes it, the picture's alpha carries 1 − it to the temporal resolve) */
var<private> fireReact: f32 = 0.0;
fn fireOver(c: vec3f, pixf: vec2f, rd: vec3f, tMax: f32) -> vec3f {
  var col = c;
  let n = min(beams.fireN.x, 4u);
  var at = array<f32, 4>(-1.0, -1.0, -1.0, -1.0); var any = false;
  for (var i = 0u; i < n; i++) {
    let cb = fireBound(beams.fire[i], beams.fireLook, frame.camPos, rd);   // (nothing of this fire is on a ray that misses it)
    if (cb.x > cb.y || cb.y < 0.0 || cb.x > tMax) { continue; }
    at[i] = max(cb.x, 0.0); any = true;
  }
  if (!any) { return col; }
  let jit = fract(ign(pixf) + f32(frame.frameIdx & 63u) * 0.61803399);
  for (var k = 0u; k < n; k++) {
    var far = -1.0; var pick = 4u;
    for (var i = 0u; i < n; i++) { if (at[i] > far) { far = at[i]; pick = i; } }
    if (pick > 3u) { break; }
    at[pick] = -1.0;
    let F = beams.fire[pick];
    if (F.d.y > 0.5) { let seen = fogSeenAt(F.a.xyz, vec3f(0.0)) >= 0.5; if (seen != (F.d.y < 1.5)) { continue; } }
    let fa = fireAir(F, beams.fireLook, frame.camPos, rd, tMax, beamPix(), jit);
    col = col * fa.a + fa.rgb;
    fireReact = max(fireReact, min(1.0, 4.0 * fireVeil) * beams.fireLook.d.x);   // (a quarter veiled is wholly the flame's: a thin flame — the look's sigma is the maintainer's 2.5 — is as new every frame as a solid one)   // (a flame is new every frame and has nothing to be reprojected by: taau.wgsl takes these pixels from this frame)
  }
  return col;
}
/** the hot gas of a fire the smoke solver carries (fire.wgsl fireFlameG): the fine lattice's heat there */
fn fireGas(p: vec3f) -> f32 { return spgFineHot(p).y; }
/** THE SHIMMER OF THE HOT AIR OVER A FIRE (fire.wgsl fireShimmer; game/fire.ts FIRE.look.shimmer, `?fireheat=0`): how far, in pixels, this pixel reads the
 *  picture aside — the whole composite is a function of the pixel, so the picture behind a fire's column is that function a little off. Nothing nearer than
 *  the column is moved, and nothing nearer is read in its place (the depth here and the depth where it would read both say), and a fire the fog of war
 *  draws only here or only there has its shimmer by the flame's own rule (fireOver). 0 with no fire near the ray. */
fn fireWarp(pixf: vec2f) -> vec2f {
  let n = min(beams.fireN.x, 4u);
  if (n == 0u || beams.fireLook.b.w <= 0.0) { return vec2f(0.0); }
  let rd = normalize(worldFromDepth(pixf, 0.5) - frame.camPos);
  var off = vec2f(0.0); var near = 1e30;
  for (var i = 0u; i < n; i++) {
    let F = beams.fire[i];
    if (F.d.y > 0.5) { let seen = fogSeenAt(F.a.xyz, vec3f(0.0)) >= 0.5; if (seen != (F.d.y < 1.5)) { continue; } }
    let s = fireShimmer(F, beams.fireLook, frame.camPos, rd);
    if (s.z > 0.0) { off += vec2f(s.x, -s.y) / (beamPix() * s.z); near = min(near, s.z); }
  }
  if (near > 1e29) { return vec2f(0.0); }
  let d = textureLoad(gDepth, vec2i(pixf), 0);
  if (d < 1.0 && linearDepth(d, pixf) < near) { return vec2f(0.0); }   // (what this pixel shows stands in front of the fire's column)
  let to = clamp(pixf + off, vec2f(0.5), vec2f(textureDimensions(gDepth)) - 0.5); let d2 = textureLoad(gDepth, vec2i(to), 0);
  if (d2 < 1.0 && linearDepth(d2, to) < near) { return vec2f(0.0); }   // (… and so does what it would have read: a man in front of the fire is not smeared onto the ground beside him)
  return off;
}
fn compositePixel(pix0: vec2f) -> vec3f {
  var pixf = pix0;
  if (frame.debugView == 0u && beams.fireN.x > 0u) { pixf = clamp(pix0 + fireWarp(pix0), vec2f(0.5), vec2f(textureDimensions(gDepth)) - 0.5); }
  let pix = vec2i(pixf);
  var pin = pixf; if (SHARP) { pin = pixf * inOverOut() + frame.sharpCfgC.xy; }   // this pixel on the INTERNAL raster (the stochastic terms' texel maps; + the decoupled jitter that raster carries, 0 without it)
  let depth = textureLoad(gDepth, pix, 0);
  var color: vec3f;
  let dbg = frame.debugView;
  // the tail both branches end with (beams, fire, the volumetrics, the weather's veil), run ONCE below on the branch's ray: the compile — DXC, Chrome's compiler on Windows,
  // inlines every call, and the two copies of the fire's look alone were ~160 KB of inlined text. rdT / tT = the view ray and how far it goes (the sky: 1e4); dirS = the
  // pixel's own ray to its surface (the veil's); zg / Ng / id / moved = the surface's keys (unset on the sky)
  var rdT = vec3f(0.0); var tT = 1e4; var dirS = vec3f(0.0); var zg = 0.0; var Ng = vec3f(0.0); var id = 0u; var moved = false;
  if (depth >= 1.0) {
    // background: sky through the view ray
    let Pfar = worldFromDepth(pixf, 1.0);
    color = skyRadiance(normalize(Pfar - frame.camPos));
    rdT = normalize(Pfar - frame.camPos);
  } else {
    // Where the surface this pixel shows is READ: under the pixel — or, through REFRACTING glass (GLASS_REFRACT: passes.ts compiles this module a second time with it true, taken while
    // settings.glassRefract; false = every statement below exactly as it was, the frame hash for hash), where the ray the glass bent comes out behind it. So the glass test runs FIRST there:
    // the pixel's own ray (P0 / z0 / V) meets the nearest pane, glassRefractPath bends it through that box, refractedRead finds the pixel it lands on (sPix), and the tint, the cracks and the
    // pane's own terms are settled before anything is read; the tail then keys the panes' reflection field and the fog on the PIXEL (zg / Ng), the shading on what is read.
    var sPix = pix; var sPixf = pixf; var sPin = pin; var sDepth = depth; var N0 = vec3f(0.0); var z0 = 0.0;
    var glassT = vec3f(1.0); var glassPix = false;
    var specK = 1.0; var crackL = vec3f(0.0);   // the cracks' share (FLAG_DECALS × FLAG_GLASS): × the pane's reflection along crack lines, + what the crack star and its collar scatter toward the eye
    if (GLASS_REFRACT) {
      let P0 = worldFromDepth(pixf, depth);
      z0 = distance(P0, frame.camPos);
      if ((frame.flags & FLAG_GLASS) != 0u) {
        let V = (P0 - frame.camPos) / max(z0, 1e-4);
        let gh = glassTrace(frame.camPos, V, 0.0, z0 - 0.02);
        if (gh.idx >= 0) {
          glassPix = true;
          let cosI = clamp(dot(-V, gh.n), 0.0, 1.0);
          let F = glassFresnel(cosI) * min(frame.glassCfg.x, 1.0);
          let ior = frame.glassCfg.w;
          if (ior >= 1.0) {
            // ONE law for the 12 mm pane and the 30 cm bottle: Snell in, across the box to the face it leaves by, Snell out; Beer–Lambert by the glass crossed in units of the box's own
            // thickness (1 = square through a pane: its authored tint exactly; a slanting path, the bottle's diagonal, a mirrored leg inside it: deeper); the picture read where it comes out
            let gp = glassRefractPath(frame.camPos + V * gh.t, V, u32(gh.idx), gh.n, ior);
            glassT = pow(max(gh.trans, vec3f(1e-3)), vec3f(frame.glassCfg.y * gp.len / max(gp.unit, 1e-4))) * (1.0 - F);
            if (gp.ok) {
              N0 = normalize(textureLoad(gNormal, pix, 0).xyz * 2.0 - 1.0);
              let rr = refractedRead(pixf, P0, N0, gp);
              if (rr.ok) { sPix = rr.pix; sPixf = vec2f(rr.pix) + 0.5; sDepth = rr.depth; moved = true; if (SHARP) { sPin = sPixf * inOverOut() + frame.sharpCfgC.xy; } else { sPin = sPixf; } }
            }
          } else {   // (the setting off while this module is live — a frame at most: the old rule)
            glassT = pow(max(gh.trans, vec3f(1e-3)), vec3f(frame.glassCfg.y / max(cosI, 0.35))) * (1.0 - F);
          }
          if ((frame.flags & FLAG_DECALS) != 0u || GLASS_BREAK) {   // the crack stars ON the pane where the pixel's ray crosses it (the block below, word for word — the marks sit on the glass, nothing bends them)
            let X = frame.camPos + V * gh.t;
            let paneBox = u32(scene.glass[u32(gh.idx) * 3u + 2u].w + 0.5);
            let fpG = gh.t * 2.0 * frame.post.w * frame.invScreen.y;
            var gm: GlassMarks; gm.crack = 0.0; gm.frost = 0.0; gm.core = 0.0; if ((frame.flags & FLAG_DECALS) != 0u) { gm = glassMarks(X, gh.n, paneBox, fpG); }
            if (GLASS_BREAK) { let vc = gbCracks(u32(gh.idx), X, fpG); gm.crack = max(gm.crack, vc.x); gm.frost = max(gm.frost, vc.y); }   // GLASS BREAKING: the radial and concentric cracks of every blow + the bright rim of a piece beside a hole (a fractured pane draws them from its own record — hence the block runs under GLASS_BREAK with no mark anywhere)
            let scat = 0.6 * gm.frost + 0.4 * gm.crack;
            if (scat + gm.core > 0.004) {
              glassT *= (1.0 - 0.62 * gm.crack) * (1.0 - 0.9 * gm.frost) * (1.0 - gm.core);
              specK = (1.0 + 2.5 * gm.crack + 0.8 * gm.frost) * (1.0 - gm.core);
              if (scat > 0.004) { crackL = paneLight(X, gh.n) * (scat * (0.62 / PI)) * (1.0 - gm.core); }
            }
          }
        }
      }
    }
    let albedo4 = textureLoad(gAlbedo, sPix, 0);
    let albedo = albedo4.rgb;                   // (.a = the decals' gloss-keep: exactly 1 unless a mark's soot lies on this pixel — gbuffer.wgsl fsBox)
    let N = normalize(textureLoad(gNormal, sPix, 0).xyz * 2.0 - 1.0);
    id = textureLoad(gId, sPix, 0).x;
    let boxIdx = id & 0xFFFFFu;
    let P = worldFromDepth(sPixf, sDepth);
    let z = distance(P, frame.camPos);
    let EdS = textureLoad(directTex, sPix, 0).rgb; let EdB = textureLoad(softTex, sPix, 0).rgb;   // the shadowed direct per emitter class (sharp, broad)
    let Ed = EdS + EdB;
    let Ei = upsampleIndirect(sPix, sPin, z, N);
    var emissive = vec3f(0.0);
    var glossPix = false;                       // this pixel is the polished top of a BOX_GLOSS floor box (world geometry, never a character)
    if (((id >> 28u) & 1u) == 0u && boxIdx != 0xFFFFFu) {
      let b = boxGeo[boxIdx];
      if ((b.flags & BOX_EMISSIVE) != 0u) { emissive = boxEmissive(boxIdx); }
      glossPix = (b.flags & BOX_GLOSS) != 0u;
      let mslot = markSlotOf(b.flags);                                        // MARKINGS (markings.wgsl): the emission of the box's emissive markings at this pixel — the vending window's cans and backlight, UI bars, LEDs — genuine radiance, so it blooms and reads in NV like a fixture
      if (mslot != 0u && ((id >> 29u) & 1u) == 0u) { emissive += markEmissiveAt(mslot, boxIdx, P, N, (frame.camPos - P) / max(z, 1e-4), z * 2.0 * frame.post.w * frame.invScreen.y); }
    }
    // ray-traced reflections (frame.rtCfg.w > 0): how much of the reflection term this pixel takes (1 under the roughness cutoff, fading to 0 at it — the term never bands at the cutoff), and how
    // metallic its finish is (a conductor has no diffuse: its mirror carries what the paint's Lambert stood in for — stepped back by 70 % rather than removed, since one ray a pixel through a
    // 1 m cache is a coarser mirror than the paint was a diffuser; only while rays are actually traced — the highlights-only mode leaves the diffuse whole). Never on a character or a cap.
    var reflK = 0.0; var metalK = 0.0;
    if (frame.rtCfg.w >= 1.0 && ((id >> 28u) & 3u) == 0u) {
      let mt = textureLoad(gMat, sPix, 0); let maxR = frame.rtCfg.x;
      reflK = (1.0 - smoothstep(maxR - 0.12, maxR + 0.001, mt.x)) * frame.matCfg.y;
      metalK = select(0.0, reflK * mt.y, frame.rtCfg.y >= 1.0);
    }
    // glass (FLAG_GLASS): is there a pane between the eye and this pixel's surface? Then what the G-buffer shaded is the TRANSMITTED picture: tinted by every pane
    // crossed (albedo^(depth ÷ cos of the crossing angle): more glass along a slanting path), less the share the nearest pane reflects instead (Schlick, at most
    // the physical term); what that pane adds toward the eye — mirror image, glints, dust glow — comes up from the gather's specular field below. (The module as it
    // always was: under GLASS_REFRACT all of this ran above, ahead of the reads, and this block is not compiled.)
    if (!GLASS_REFRACT && (frame.flags & FLAG_GLASS) != 0u) {
      let V = (P - frame.camPos) / max(z, 1e-4);
      let gh = glassTrace(frame.camPos, V, 0.0, z - 0.02);
      if (gh.idx >= 0) {
        glassPix = true;
        let cosI = clamp(dot(-V, gh.n), 0.0, 1.0);
        let F = glassFresnel(cosI) * min(frame.glassCfg.x, 1.0);
        glassT = pow(max(gh.trans, vec3f(1e-3)), vec3f(frame.glassCfg.y / max(cosI, 0.35))) * (1.0 - F);
        // rounds that stopped in this pane (glass.ts glassHit → a 'glassHit' decal; decals.wgsl glassMarks): the hole, the milky collar and the crack star ON the
        // glass where the view ray crosses it. Cracked glass and pulverised glass are diffusers: they cut what comes THROUGH (darker against the lit room), mirror
        // more along the crack faces, and light up with whatever falls ON the pane from either side (a torch on the glazing sets the star alight; in the dark it is
        // a dark web against the room behind). The hole itself is just dark. Only under FLAG_DECALS (up while any mark exists), only for pixels on a pane.
        if ((frame.flags & FLAG_DECALS) != 0u || GLASS_BREAK) {
          let X = frame.camPos + V * gh.t;
          let paneBox = u32(scene.glass[u32(gh.idx) * 3u + 2u].w + 0.5);
          let fpG = gh.t * 2.0 * frame.post.w * frame.invScreen.y;          // the pixel's footprint on the pane (m), as gbuffer.wgsl sizes it for the other marks
          var gm: GlassMarks; gm.crack = 0.0; gm.frost = 0.0; gm.core = 0.0; if ((frame.flags & FLAG_DECALS) != 0u) { gm = glassMarks(X, gh.n, paneBox, fpG); }
          if (GLASS_BREAK) { let vc = gbCracks(u32(gh.idx), X, fpG); gm.crack = max(gm.crack, vc.x); gm.frost = max(gm.frost, vc.y); }   // (GLASS BREAKING: as in the refracting path above)
          let scat = 0.6 * gm.frost + 0.4 * gm.crack;
          if (scat + gm.core > 0.004) {
            glassT *= (1.0 - 0.62 * gm.crack) * (1.0 - 0.9 * gm.frost) * (1.0 - gm.core);
            specK = (1.0 + 2.5 * gm.crack + 0.8 * gm.frost) * (1.0 - gm.core);
            if (scat > 0.004) { crackL = paneLight(X, gh.n) * (scat * (0.62 / PI)) * (1.0 - gm.core); }   // white glass powder: albedo ≈ 0.6, lit from both faces
          }
        }
      }
    }
    zg = z; Ng = N;                             // the panes' reflection field and the fog key on the PIXEL — its own distance, the normal AT it — not on what a bend read (≡ z / N unless GLASS_REFRACT moved the read)
    if (GLASS_REFRACT) { zg = z0; Ng = select(N, N0, moved); }
    var dif = albedo * (Ed + Ei) * (1.0 / PI);   // (the old product, untouched: the pass-off frame hashes identical to main — docs/internal/p4-materials.md §5)
    var sparkle = vec3f(0.0);                    // SNOW SPARKLE (snowSparkleFacet above): the facets' flashes at this pixel — zero unless SNOW_SPARKLE, on lit fresh snow
    if (SNOW_GLOW || SNOW_SPARKLE) {   // SNOW GLOW (snowGlow above): on a snow pixel, the light that wrapped its terminator, and shade that leans to blue — never a man's pixel or a section cap's (one walk of the lights for the glow and the sparkle)
      let sa = snowGlowAmt(textureLoad(gNormal, sPix, 0).a);
      if (sa > 0.0 && ((id >> 28u) & 3u) == 0u) {
        let glow = snowGlow(sPix, P, N, z, EdS, EdB);
        if (SNOW_GLOW) { let lE = luminance(Ed); let lI = luminance(Ei); dif += albedo * (glow + Ei * (SNOW_GLOW_SHADE - vec3f(1.0)) * (lI / max(lE + lI, 1e-5))) * (sa / PI); }
        if (SNOW_SPARKLE) { sparkle = snowSparkleL * (sa * snowSparkleFresh(textureLoad(gMat, sPix, 0).x)); }
      }
    }
    if (metalK > 0.0) { dif *= 1.0 - 0.7 * metalK; }   // metalK: 0 unless the reflections are traced AND this is a metal under the cutoff
    color = (dif + emissive) * glassT + crackL;
    var spec = vec3f(0.0);                      // glossy floors (FLAG_GLOSS) / glass (FLAG_GLASS): the reflection radiance, added as it is — specular is not tinted by the diffuse albedo; both flags off = never read, colour untouched
    var refl = vec3f(0.0);                      // the ray-traced reflections (frame.rtCfg.w > 0; the host never raises FLAG_GLOSS with them): outgoing radiance, BRDF already applied by the pass — added as it is × the cutoff fade × the decals' gloss-keep (soot does not mirror), through the pane's transmission if one stands in front
    if (reflK > 0.0) { refl = upsampleRefl(sPixf) * (reflK * albedo4.a); color += refl * glassT; }
    if ((frame.flags & FLAG_GLOSS) != 0u && glossPix) { spec = upsampleSpecular(pix, pin, zg, Ng) * select(albedo4.a, specK, glassPix); color += spec; }   // × the decals' gloss-keep: soot on the lino does not mirror the ceiling panel (1.0 wherever no mark lies) — except through a pane, whose texels carry the floor's AND the pane's reflection in one read: the pane's must not vanish over a scorch behind it, so the keep is waived there (and the cracks' boost applies)
    else if (glassPix) { spec = upsampleSpecAny(pix, pin, zg, Ng) * specK; color += spec; }
    if ((id & 0x50000000u) == 0x50000000u) { let ws = wetCoatSpec(id, P, N, z, EdS, EdB, Ei); spec += ws; color += ws * glassT; }   // a WET character pixel (bits 30 + 28: gbuffer.wgsl fsSkin — never a dry man's, never with the setting off): the clear coat's light, through the pane like the rest of him if he stands behind one
    if (SNOW_SPARKLE) { spec += sparkle; color += sparkle * glassT; }   // SNOW SPARKLE: light, not paint — added as it is
    if (((id >> 29u) & 1u) == 1u) { color = mix(frame.capColor.rgb, albedo * frame.capColor.rgb * 4.0, frame.capColor.a); }
    if (dbg == 1u) { color = select(albedo, albedo * glassT + vec3f(0.0, 0.08, 0.06), glassPix); }   // (albedo view: pixels behind glass carry the tint and a faint teal wash, so the panes can be found)
    else if (dbg == 2u) { color = N * 0.5 + 0.5; }
    else if (dbg == 3u) { color = Ed * (1.0 / PI); }
    else if (dbg == 4u) { color = Ei * (1.0 / PI); }
    else if (dbg == 6u) { color = vec3f(1.0 - exp(-z * 0.06)); }   // view distance, monotonic (white = far)
    else if (dbg == 7u) { color = diceIrradiance(P + N * 0.27, N) * (1.0 / PI); }
    else if (dbg == 8u) { color = (Ed + Ei) * (1.0 / PI); }
    else if (dbg == 9u) { color = vec3f(abs(textureLoad(directTex, pix, 0).a), abs(textureLoad(softTex, pix, 0).a), 0.0); }   // denoiser blur hints (r sharp, g broad)
    else if (dbg == 10u) { color = spec + refl; }                   // every specular term alone: the glossy floors' / the panes' / a wet coat's (spec) and the ray-traced reflections' (refl) — black wherever none is up
    else if (dbg == 11u || dbg == 12u) { color = textureLoad(directTex, pix, 0).rgb; }   // ReSTIR diagnostics (restir.wgsl writes them raw into S0, the filter chain is skipped): 11 = r/g history M ÷ cap per class, b = 1 − tile gradient confidence; 12 = r rays ÷ 6, g taps, b neighbour-shaded
    else if (dbg == 14u) { color = refl; }                          // the ray-traced reflections alone (black with the pass off)
    else if (dbg == 15u) { let mt = textureLoad(gMat, pix, 0); color = vec3f(mt.x, mt.y, 0.0); }   // the material the g-buffer wrote: r = roughness (bright = matte), g = metalness — the finish table + the detail layer's wear, as the reflections read them
    else if (dbg == 13u) { color = textureLoad(directTex, pix, 0).rgb; }   // the v3 denoiser's shadow-client state, written raw into the sharp class's texture by its last iteration (denoise.wgsl DN_DEBUG_VIEW): r/g = σ per class, b = history length
    else if (dbg == 16u) { color = Ei; }                            // phase 5: the resampling gather's reservoir state (fgather.wgsl mainGi writes it into the indirect, through the diffuse denoiser): r = confidence M ÷ cap, g = temporal history taken, b = spatial taps accepted ÷ k — the plain indirect with resampling off
    else if (dbg == 17u) { color = select(vec3f(0.0), upsampleRefl(pixf), frame.rtCfg.w >= 1.0); }   // phase 5: the reflection pass's raw output as the composite fetches it (no cutoff fade / gloss-keep) — the mesh hits and the hit-lighting reuse are judged here
    rdT = normalize(worldFromDepth(pixf, 0.5) - frame.camPos); tT = zg; dirS = normalize(worldFromDepth(pixf, depth) - frame.camPos);

  }
  // ---- the tail both branches end with, on the branch's ray (see rdT above)
  let sky = depth >= 1.0;
  if (dbg == 0u && beams.n > 0u && (beams.p0 & 2u) != 0u) { color += beamAir(frame.camPos, rdT, tT, beamPix()); }
  if (dbg == 0u && beams.fireN.x > 0u) { color = fireOver(color, pixf, rdT, tT); }
  if (dbg == 0u || dbg == 5u) {
    if (!sky) { if (WX_VOL) { if (WX_KINDS) { if (frame.cardCfg.w != 0u) { wxAirT = wxAirTEst(pixf, zg); } } } }
    // (on a surface the fog along the PIXEL's ray to its own surface — zg — whatever a bend read; view 5 keeps the sky under the volumetrics, as the old path always did)
    if ((frame.flags & FLAG_FROXEL_VOL) != 0u) { let vol = froxelVol(pixf, pix, pin, tT); color = select(color * vol.a + vol.rgb, vol.rgb, dbg == 5u && !sky); }
    else {
    let vol = upsampleVol(pix, pin, tT);
    color = select(color * vol.a + vol.rgb, vol.rgb, dbg == 5u && !sky);
    }
  }
  if (WX_KINDS && !WX_VOL) { if (frame.cardCfg.w != 0u && dbg == 0u) {   // WEATHER FOG (a kind picked, game/weatherKinds.ts) along the pixel's ray to its surface: the field the men's eyes are cut by (weather.ts airTrans); over the void past the lot as over the ground beside it. (The flat veil — under WX_VOL the weather's air is a volume the volumetric pass marched: it is in `vol` above)
    if (WX_EDGE && !sky) {   // (the veil at the building's shell — common.wgsl wxFogApplySurf: an outside wall's face is asked where its normal points; a man's pixel and a box he carries — bit 28 / the owner byte of the PIXEL's own id — where he stands)
      var idg = id; if (GLASS_REFRACT) { if (moved) { idg = textureLoad(gId, pix, 0).x; } }
      color = wxFogApplySurf(color, dirS, zg, select(Ng.xz, vec2f(0.0), ((idg >> 20u) & 0x1FFu) != 0u));
    } else { color = wxFogApply(color, select(dirS, rdT, sky), select(zg, 0.0, sky), sky); }
  } }
  return max(color, vec3f(0.0));
}
