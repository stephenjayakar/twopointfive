// Temporal accumulation for the half-res (a third with gatherThird) indirect irradiance only (direct light has its own optional pass, dtemporal.wgsl; beams are never history
// filtered). Reprojects with last frame's view-projection, validates the history sample by view depth (kills
// disocclusion ghosts: a character walking off leaves nothing behind), clips history to the current neighbourhood's
// mean ± k·sigma so lighting changes converge in a few frames, and stores view depth in alpha for next frame's test.
// (Under FrameFlags.Gloss passes.ts runs this same module a second time over the glossy floors' specular texture and its own history pair:
// nothing here knows or cares which signal `curTex` holds — it is reprojected on the surface that wrote it and clipped the same way.)
@group(1) @binding(0) var gDepth: texture_depth_2d;          // full res
@group(1) @binding(1) var curTex: texture_2d<f32>;            // half res, this frame's gather output (rgb)
@group(1) @binding(2) var histTex: texture_2d<f32>;           // half res, accumulated result of last frame (rgb; a = view depth then)
@group(1) @binding(3) var outTex: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let odims = textureDimensions(outTex);
  if (gid.x >= odims.x || gid.y >= odims.y) { return; }
  let pc = vec2i(gid.xy);
  let cur = textureLoad(curTex, pc, 0).xyz;
  let gdiv = frame.lossyCfg.x; let goff = floor((gdiv - 1.0) * 0.5);           // gather divisor (2, or 3 with the lossy option) and the texel's sample offset in full-res px (0 / 1) — as in fgather
  let full = min(gid.xy * u32(gdiv) + u32(goff), vec2u(frame.screen) - 1u);
  let depth = textureLoad(gDepth, full, 0);
  let P = worldFromDepth(vec2f(full) + 0.5, depth);
  let cw = (frame.viewProj * vec4f(P, 1.0)).w;                 // this pixel's view depth now → alpha for next frame
  if (depth >= 1.0 || (frame.flags & FLAG_TEMPORAL) == 0u) { textureStore(outTex, pc, vec4f(cur, cw)); return; }
  // neighbourhood statistics of the (noisy) current estimate → variance clip box
  var m1 = vec3f(0.0); var m2 = vec3f(0.0);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let v = textureLoad(curTex, clamp(pc + vec2i(dx, dy), vec2i(0), vec2i(odims) - 1), 0).xyz;
      m1 += v; m2 += v * v;
    }
  }
  let mean = m1 / 9.0;
  let sigma = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  let mn = mean - sigma * 1.0 - vec3f(0.002);   // tight clip: with 4 rays/px sigma is generous already; anything outside is stale (moved shadow, moved light)
  let mx = mean + sigma * 1.0 + vec3f(0.002);
  // reproject + validate
  let pclip = frame.prevViewProj * vec4f(P, 1.0);
  var hist = cur; var wHist = 0.0;
  if (pclip.w > 0.0) {
    let ndc = pclip.xy / pclip.w;
    // this thread shades full-res pixel gdiv·g + goff (+0.5); history texel g is centred at (g+0.5)/odims: map through full-res pixel
    // coordinates so a static camera resamples exactly the texel it wrote even when the internal size is not a multiple (screen != gdiv·odims):
    // uv = ((x_full − goff − 0.5) / gdiv + 0.5) / odims  — at gdiv 2 the familiar (x_full + 0.5) / (2·odims)
    let uv = ((ndc * vec2f(0.5, -0.5) + 0.5) * frame.screen + (0.5 * (gdiv - 1.0) - goff)) / (gdiv * vec2f(odims));
    if (all(uv > vec2f(0.0)) && all(uv < vec2f(1.0))) {
      let h = textureSampleLevel(histTex, linSamp, uv, 0.0);
      // the surface we reproject onto must be the surface that wrote the history: compare its stored view depth with
      // the depth this point had last frame (pclip.w); a mismatch is a disocclusion → start over from the current estimate
      if (abs(h.a - pclip.w) < 0.02 + 0.006 * pclip.w) {   // ~0.5 %: tight enough that a shin, chair seat or box in front of the floor is a different surface
        if ((frame.flags & FLAG_GI_ADAPTIVE_HIST) != 0u) {
          // LOSSY option, variance-guided history (settings.giAdaptiveHistory): how far does the reprojected history sit from this frame's neighbourhood,
          // in units of that neighbourhood's own spread (+ a 5 % relative floor, so a smooth dim region is not 'always outside')? Inside → it is a consistent
          // estimate of the same light: taken as it is (no clip: no energy shaved off a heavy-tailed estimate) and leant on harder (0.93 ≈ 14 frames);
          // well outside → the light changed, or the history holds an outlier: clipped exactly as before and converged faster than before (0.7 ≈ 3 frames).
          let dev = abs(h.xyz - mean) / (sigma + 0.05 * mean + vec3f(0.002));
          let inside = 1.0 - smoothstep(1.0, 2.5, max(dev.x, max(dev.y, dev.z)));
          hist = mix(clamp(h.xyz, mn, mx), h.xyz, inside);
          wHist = mix(0.7, 0.93, inside);
        } else {
          hist = clamp(h.xyz, mn, mx);
          wHist = 0.86;
        }
      }
    }
  }
  textureStore(outTex, pc, vec4f(mix(cur, hist, wHist), cw));
}
