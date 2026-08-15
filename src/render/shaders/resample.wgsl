// Render-target housekeeping kernels (render/texpool.ts TargetOps), standalone — no scene prelude, group 0 only:
//  * blit16     — bilinear resample of a filterable colour texture into an rgba16float target of another size (the screen-space temporal histories carried
//                 across a change of internal resolution: direct light per class, the indirect, the specular; alpha rides along — the indirect's view depth,
//                 which the temporal pass validates within ~0.5 %, so an edge texel blended across two surfaces simply fails validation there and restarts)
//  * nearest32f — nearest resample of an r32float texture (the direct history's view-depth companion: unfilterable, and a depth must stay A depth, never a blend)
//  * nearest32u — the same for an r32uint texture (the v3 denoiser's packed depth | history-length texel: bits, never blended)
//  * clear16 / clear32f / clear32u / clear4x32u — zero a storage texture (a target taken back from the pool holds whatever the size it last served left in it; a fresh
//                 WebGPU texture reads as zeros, so a cleared pooled one is indistinguishable from a new one)
// Every entry point maps destination texel centres to normalized [0,1]² and reads the source there: both textures are taken to cover the same screen.
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var dst16: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var dst32f: texture_storage_2d<r32float, write>;
@group(0) @binding(5) var dst32u: texture_storage_2d<r32uint, write>;
@group(0) @binding(6) var srcU: texture_2d<u32>;
@group(0) @binding(7) var dst4x32u: texture_storage_2d<rgba32uint, write>;   // (phase 5's reservoir / hit-record targets)

@compute @workgroup_size(8, 8)
fn blit16(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst16);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  let uv = (vec2f(gid.xy) + 0.5) / vec2f(d);
  textureStore(dst16, gid.xy, textureSampleLevel(srcTex, samp, uv, 0.0));
}

@compute @workgroup_size(8, 8)
fn nearest32f(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst32f);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  let s = textureDimensions(srcTex);
  let p = min(vec2u((vec2f(gid.xy) + 0.5) * vec2f(s) / vec2f(d)), s - 1u);
  textureStore(dst32f, gid.xy, textureLoad(srcTex, p, 0));
}

@compute @workgroup_size(8, 8)
fn nearest32u(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst32u);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  let s = textureDimensions(srcU);
  let p = min(vec2u((vec2f(gid.xy) + 0.5) * vec2f(s) / vec2f(d)), s - 1u);
  textureStore(dst32u, gid.xy, textureLoad(srcU, p, 0));
}

@compute @workgroup_size(8, 8)
fn clear16(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst16);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  textureStore(dst16, gid.xy, vec4f(0.0));
}

@compute @workgroup_size(8, 8)
fn clear32f(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst32f);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  textureStore(dst32f, gid.xy, vec4f(0.0));
}

@compute @workgroup_size(8, 8)
fn clear32u(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst32u);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  textureStore(dst32u, gid.xy, vec4u(0u));
}

@compute @workgroup_size(8, 8)
fn clear4x32u(@builtin(global_invocation_id) gid: vec3u) {
  let d = textureDimensions(dst4x32u);
  if (gid.x >= d.x || gid.y >= d.y) { return; }
  textureStore(dst4x32u, gid.xy, vec4u(0u));
}
