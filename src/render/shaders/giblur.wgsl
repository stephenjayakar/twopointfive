// Edge-aware à-trous filter for the half-resolution (a third with the lossy gatherThird option) accumulated indirect irradiance (3x3
// B-spline taps, STRIDE 1,2,4). Guides come from the full-resolution G-buffer at the pixel each texel was computed at; irradiance is
// albedo-free so blurring across material boundaries is harmless, only geometry (depth / normal) stops the kernel.
// (Under FrameFlags.Gloss the STRIDE 1 pipeline also runs once over the glossy floors' accumulated specular — passes.ts, same guides.)
override STRIDE: i32 = 1;
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var giIn: texture_2d<f32>;
@group(1) @binding(3) var giOut: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(giOut);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let pc = vec2i(gid.xy); let hi = vec2i(dims) - 1;
  let c0 = textureLoad(giIn, pc, 0);
  let gdiv = i32(frame.lossyCfg.x); let goff = (gdiv - 1) / 2;   // gather divisor (2 | 3) and sample offset, as in fgather
  let fhi = vec2i(frame.screen) - 1;
  let full = min(pc * gdiv + goff, fhi);
  let d0 = textureLoad(gDepth, full, 0);
  if (d0 >= 1.0) { textureStore(giOut, pc, c0); return; }
  let P0 = worldFromDepth(vec2f(full) + 0.5, d0);
  let z0 = distance(P0, frame.camPos);
  let n0 = textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0;
  var acc = vec4f(0.0); var wsum = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = clamp(pc + vec2i(dx, dy) * STRIDE, vec2i(0), hi);
      let fq = min(q * gdiv + goff, fhi);
      let d = textureLoad(gDepth, fq, 0);
      if (d >= 1.0) { continue; }
      let Pq = worldFromDepth(vec2f(fq) + 0.5, d);
      let nq = textureLoad(gNormal, fq, 0).xyz * 2.0 - 1.0;
      var w = f32((2 - abs(dx)) * (2 - abs(dy))) * 0.0625;
      w *= exp(-abs(dot(Pq - P0, n0)) / max(z0 * 0.01 * f32(STRIDE) * (f32(gdiv) * 0.5), 0.02));   // plane distance (a tap spans gdiv/2 × the ground it did at half res): keeps slanted floors together, splits at steps
      w *= pow(max(dot(nq, n0), 0.0), 8.0);
      acc += textureLoad(giIn, q, 0) * w; wsum += w;
    }
  }
  textureStore(giOut, pc, select(c0, acc / max(wsum, 1e-5), wsum > 1e-5));
}
