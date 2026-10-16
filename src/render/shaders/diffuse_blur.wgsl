// The smoke diffusion's Gaussian (post.wgsl SMOKE DIFFUSION; passes.ts diffDown / diffBlur): a separable 9-tap blur (σ ≈ 2 texels) run at a quarter and an
// eighth of the output size over the frame's plain box-downsampled copies. Box downsamples alone keep texel-to-texel steps that a bilinear read at full size
// shows as blocks along any bright edge seen through thick smoke (the maintainer, 08-12: 'the boundary with the vending machine does look kinda pixelated');
// band-limited first, the same read is smooth. Same bind layout as bloom.wgsl (binding 2 unused here).
@group(1) @binding(0) var src: texture_2d<f32>;
@group(1) @binding(1) var dst: texture_storage_2d<rgba16float, write>;
@group(1) @binding(2) var addTex: texture_2d<f32>;

const GW = array<f32, 5>(0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);   // the 9-tap binomial / Gaussian, centre + 4 a side

fn blurAlong(gid: vec2u, dir: vec2i) {
  let dd = textureDimensions(dst);
  if (gid.x >= dd.x || gid.y >= dd.y) { return; }
  let p = vec2i(gid); let hi = vec2i(dd) - 1;
  var c = textureLoad(src, p, 0).xyz * GW[0];
  for (var i = 1; i <= 4; i++) {
    c += textureLoad(src, clamp(p + dir * i, vec2i(0), hi), 0).xyz * GW[i];
    c += textureLoad(src, clamp(p - dir * i, vec2i(0), hi), 0).xyz * GW[i];
  }
  textureStore(dst, gid, vec4f(c, 1.0));
}
@compute @workgroup_size(8, 8) fn blurH(@builtin(global_invocation_id) gid: vec3u) { blurAlong(gid.xy, vec2i(1, 0)); }
@compute @workgroup_size(8, 8) fn blurV(@builtin(global_invocation_id) gid: vec3u) { blurAlong(gid.xy, vec2i(0, 1)); }
