// Optional temporal reuse for the direct-light estimates of BOTH emitter classes in one dispatch (weight =
// frame.directCfg.w; 0 disables and the host skips this pass). Full resolution. Reprojects last frame's accumulated S
// with prevViewProj, validates the history sample against last frame's view depth (a moved character or a disoccluded
// floor starts over), clips it to the current 3x3 estimate's mean ± sigma per class (a switched-off panel or a swept
// torch converges in a couple of frames — and transient lights never linger: they change U/S abruptly, which the clip
// follows), and blends. The outputs keep this frame's signed penumbra hints in alpha so the spatial passes downstream
// work unchanged; the shared view-depth history is refreshed here too.
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var cur0: texture_2d<f32>;        // this frame's S (rgb) + signed hint (a), class 0 / 1
@group(1) @binding(2) var cur1: texture_2d<f32>;
@group(1) @binding(3) var hist0: texture_2d<f32>;       // last frame's accumulated S per class
@group(1) @binding(4) var hist1: texture_2d<f32>;
@group(1) @binding(5) var prevDepthTex: texture_2d<f32>; // last frame's view depth (r32f)
@group(1) @binding(6) var outHist0: texture_storage_2d<rgba16float, write>;
@group(1) @binding(7) var outHist1: texture_storage_2d<rgba16float, write>;
@group(1) @binding(8) var outDepth: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(gDepth);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let pc = vec2i(gid.xy); let hi = vec2i(dims) - 1;
  let cA = textureLoad(cur0, pc, 0); let cB = textureLoad(cur1, pc, 0);
  let depth = textureLoad(gDepth, pc, 0);
  let P = worldFromDepth(vec2f(pc) + 0.5, depth);
  let cw = (frame.viewProj * vec4f(P, 1.0)).w;
  textureStore(outDepth, pc, vec4f(cw, 0.0, 0.0, 0.0));
  let wCfg = clamp(frame.directCfg.w, 0.0, 0.95);
  if (depth >= 1.0 || wCfg <= 0.0) { textureStore(outHist0, pc, cA); textureStore(outHist1, pc, cB); return; }
  // current neighbourhood statistics per class (variance clip boxes)
  var m1A = vec3f(0.0); var m2A = vec3f(0.0); var m1B = vec3f(0.0); var m2B = vec3f(0.0);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = clamp(pc + vec2i(dx, dy), vec2i(0), hi);
      let a = textureLoad(cur0, q, 0).xyz; let b = textureLoad(cur1, q, 0).xyz;
      m1A += a; m2A += a * a; m1B += b; m2B += b * b;
    }
  }
  let meanA = m1A / 9.0; let sigA = sqrt(max(m2A / 9.0 - meanA * meanA, vec3f(0.0)));
  let meanB = m1B / 9.0; let sigB = sqrt(max(m2B / 9.0 - meanB * meanB, vec3f(0.0)));
  var outA = cA.xyz; var outB = cB.xyz;
  let pclip = frame.prevViewProj * vec4f(P, 1.0);
  if (pclip.w > 0.0) {
    let ndc = pclip.xy / pclip.w;
    let uv = ndc * vec2f(0.5, -0.5) + 0.5;
    if (all(uv > vec2f(0.0)) && all(uv < vec2f(1.0))) {
      let hp = vec2i(uv * vec2f(dims));
      let pd = textureLoad(prevDepthTex, clamp(hp, vec2i(0), hi), 0).x;
      if (abs(pd - pclip.w) < 0.02 + 0.006 * pclip.w) {              // same surface as last frame (~0.5 %)
        let hA = textureSampleLevel(hist0, linSamp, uv, 0.0).xyz;
        let hB = textureSampleLevel(hist1, linSamp, uv, 0.0).xyz;
        outA = mix(cA.xyz, clamp(hA, meanA - sigA * 1.25 - vec3f(0.001), meanA + sigA * 1.25 + vec3f(0.001)), wCfg);
        outB = mix(cB.xyz, clamp(hB, meanB - sigB * 1.25 - vec3f(0.001), meanB + sigB * 1.25 + vec3f(0.001)), wCfg);
      }
    }
  }
  textureStore(outHist0, pc, vec4f(outA, cA.a));
  textureStore(outHist1, pc, vec4f(outB, cB.a));
}
