// SHARP DIRECT (docs/internal/sharp-direct.md): the INTERNAL-resolution view of a g-buffer rasterised at the OUTPUT resolution.
// One fullscreen triangle at the internal size; every internal pixel takes the OUTPUT texel that holds its own centre — o = ⌊(i + ½) · out ∕ in⌋ — and
// copies its six values through as they are (albedo, packed normal, id, object motion, material, and the depth through frag_depth). Nothing is averaged:
// a depth or a normal that is the mean of two surfaces names neither, and every internal-resolution pass downstream (the direct estimators, the gather,
// the reflections, the denoisers, the volumetric march) rebuilds a surface point from exactly one texel. So the internal g-buffer is a strict SUBSAMPLE of
// the output one — which is also what makes the composite's joint-bilateral upsample exact about its guides: internal texel i and output texel o(i) hold
// the same numbers by construction. The point an internal pass rebuilds (its own pixel centre's ray at this depth) sits ≤ ½ output px off the true sample —
// the same order as TAAU's jitter, on the same plane. Group 0 is the INTERNAL frame block (frame.screen = the internal size = this pass's raster).
@group(1) @binding(0) var oAlbedo: texture_2d<f32>;
@group(1) @binding(1) var oNormal: texture_2d<f32>;
@group(1) @binding(2) var oId: texture_2d<u32>;
@group(1) @binding(3) var oDepth: texture_depth_2d;
@group(1) @binding(4) var oVel: texture_2d<f32>;
@group(1) @binding(5) var oMat: texture_2d<f32>;

struct DOut {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) id: u32,
  @location(3) vel: vec2f,
  @location(4) mat: vec2f,
  @location(5) edge: vec2f,     // GBAA's edge offsets: NONE at the internal size (the blend pass runs on the OUTPUT raster under sharp direct; nothing internal reads them)
  @builtin(frag_depth) depth: f32,
};

@vertex fn vsDown(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

/** the output texel holding internal raster position `pin` (px = texel + ½): THE mapping — composite.wgsl gpx and sharp_direct.wgsl sharpOutTexel write the same expression on the same
 *  operands (frame.sharpCfg = internal size xy, output size zw, identical in both frame blocks), so all three name the same texel even where f32 rounding sits on a boundary */
fn outTexelOf(pin: vec2f) -> vec2i {
  return vec2i(clamp((pin - frame.sharpCfgC.xy) * frame.sharpCfg.zw / frame.sharpCfg.xy, vec2f(0.0), frame.sharpCfg.zw - 1.0));   // (− the DECOUPLED jitter: internal texel i of a jittered internal raster shows the unjittered content at i + ½ − j; 0 without it)
}

@fragment fn fsDown(@builtin(position) pos: vec4f) -> DOut {
  let o = outTexelOf(pos.xy);
  var r: DOut;
  r.albedo = textureLoad(oAlbedo, o, 0);
  r.normal = textureLoad(oNormal, o, 0);
  r.id = textureLoad(oId, o, 0).x;
  r.vel = textureLoad(oVel, o, 0).xy;
  r.mat = textureLoad(oMat, o, 0).xy;
  r.depth = textureLoad(oDepth, o, 0);
  r.edge = vec2f(1.0, 1.0);
  return r;
}
