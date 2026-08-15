// Progressive bloom (no threshold — a small fraction of every pixel scatters, like a real lens): 13-tap Karis-weighted
// first downsample (kills fireflies/flicker), 4-tap bilinear box for the rest of the chain, 9-tap tent upsample that
// adds each level back onto the next larger one. All levels rgba16f; sizes W/2 … W/32.
@group(1) @binding(0) var src: texture_2d<f32>;
@group(1) @binding(1) var dst: texture_storage_2d<rgba16float, write>;
@group(1) @binding(2) var addTex: texture_2d<f32>;      // upsample: the level being added onto (same size as dst); unused by the down passes

override FIRST: bool = false;   // down: 13-tap + Karis average on the first level

fn karis(c: vec3f) -> f32 { return 1.0 / (1.0 + luminance(c)); }

@compute @workgroup_size(8, 8)
fn down(@builtin(global_invocation_id) gid: vec3u) {
  let dd = textureDimensions(dst);
  if (gid.x >= dd.x || gid.y >= dd.y) { return; }
  let ts = 1.0 / vec2f(textureDimensions(src));
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(dd);
  var c: vec3f;
  if (FIRST) {
    // Jimenez 2014: 13 bilinear taps → 5 overlapping 4-tap boxes, each Karis-weighted
    let a = textureSampleLevel(src, linSamp, uv + ts * vec2f(-2.0, -2.0), 0.0).xyz;
    let b = textureSampleLevel(src, linSamp, uv + ts * vec2f( 0.0, -2.0), 0.0).xyz;
    let cc = textureSampleLevel(src, linSamp, uv + ts * vec2f( 2.0, -2.0), 0.0).xyz;
    let d = textureSampleLevel(src, linSamp, uv + ts * vec2f(-2.0,  0.0), 0.0).xyz;
    let e = textureSampleLevel(src, linSamp, uv, 0.0).xyz;
    let f = textureSampleLevel(src, linSamp, uv + ts * vec2f( 2.0,  0.0), 0.0).xyz;
    let g = textureSampleLevel(src, linSamp, uv + ts * vec2f(-2.0,  2.0), 0.0).xyz;
    let h = textureSampleLevel(src, linSamp, uv + ts * vec2f( 0.0,  2.0), 0.0).xyz;
    let i = textureSampleLevel(src, linSamp, uv + ts * vec2f( 2.0,  2.0), 0.0).xyz;
    let j = textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, -1.0), 0.0).xyz;
    let k = textureSampleLevel(src, linSamp, uv + ts * vec2f( 1.0, -1.0), 0.0).xyz;
    let l = textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0,  1.0), 0.0).xyz;
    let m = textureSampleLevel(src, linSamp, uv + ts * vec2f( 1.0,  1.0), 0.0).xyz;
    let g0 = (a + b + d + e) * 0.25; let g1 = (b + cc + e + f) * 0.25; let g2 = (d + e + g + h) * 0.25; let g3 = (e + f + h + i) * 0.25; let g4 = (j + k + l + m) * 0.25;
    let w0 = karis(g0) * 0.125; let w1 = karis(g1) * 0.125; let w2 = karis(g2) * 0.125; let w3 = karis(g3) * 0.125; let w4 = karis(g4) * 0.5;
    c = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    c = min(c, vec3f(64.0));                                   // hard ceiling: a muzzle flash pixel is not allowed to own the frame
  } else {
    c = (textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, -1.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(1.0, -1.0), 0.0).xyz
       + textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, 1.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(1.0, 1.0), 0.0).xyz) * 0.25;
  }
  textureStore(dst, gid.xy, vec4f(c, 1.0));
}

// dst = addTex + tent(src)   (src is the smaller level)
@compute @workgroup_size(8, 8)
fn up(@builtin(global_invocation_id) gid: vec3u) {
  let dd = textureDimensions(dst);
  if (gid.x >= dd.x || gid.y >= dd.y) { return; }
  let ts = 1.0 / vec2f(textureDimensions(src));
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(dd);
  var c = textureSampleLevel(src, linSamp, uv, 0.0).xyz * 4.0;
  c += (textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, 0.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(1.0, 0.0), 0.0).xyz
      + textureSampleLevel(src, linSamp, uv + ts * vec2f(0.0, -1.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(0.0, 1.0), 0.0).xyz) * 2.0;
  c += textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, -1.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(1.0, -1.0), 0.0).xyz
     + textureSampleLevel(src, linSamp, uv + ts * vec2f(-1.0, 1.0), 0.0).xyz + textureSampleLevel(src, linSamp, uv + ts * vec2f(1.0, 1.0), 0.0).xyz;
  c *= 1.0 / 16.0;
  let base = textureLoad(addTex, vec2i(gid.xy), 0).xyz;
  textureStore(dst, gid.xy, vec4f(base + c, 1.0));
}
