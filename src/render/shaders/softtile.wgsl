// Tile mask for the direct-light penumbra filter's pass-through (softblur.wgsl, FLAG_SOFT_TILESKIP). Two tiny dispatches a frame, right
// after the direct pass and ahead of the à-trous chain, on the chain's own 8x8 tile grid:
//   `markTiles`     — one workgroup per tile: does any pixel of it carry a penumbra hint (S.a != 0) in either emitter class?
//   `tileDistances` — one invocation per tile: Chebyshev distance d, in tiles, to the nearest marked tile (0 = itself), scanning SCAN_R =
//                     SKIP_T - 1 rings (so d saturates at SKIP_T, "at least that far"), stored as  d | (256 if d >= SKIP_T).
// Bit 256 is the whole decision: softblur passes such a tile through — copies input to output — at EVERY step of the chain (the
// exactness argument sits at the top of softblur.wgsl's main()). SKIP_T is the chain-wide threshold from passes.ts (skipThreshold of the
// chain's total stride sum); it and SCAN_R are prepended as consts by the host, one small module per threshold the settings can produce —
// no uniforms, no overrides, and no scene prelude either: nothing here touches group 0.
// The hints are read from S straight out of the direct pass; with temporal reuse on the chain starts from the history texture instead,
// but dtemporal copies S.a through unchanged, so the same mask holds.
@group(1) @binding(0) var srcS0: texture_2d<f32>;       // direct S per class: a = signed hint (< 0 own penumbra width, 0 = none / lit / no light)
@group(1) @binding(1) var srcS1: texture_2d<f32>;
@group(1) @binding(2) var tileFlagOut: texture_storage_2d<r32uint, write>;   // ceil(w/8) x ceil(h/8): 1 = some pixel of the tile has a hint
@group(1) @binding(3) var tileFlagIn: texture_2d<u32>;
@group(1) @binding(4) var tileDistOut: texture_storage_2d<r32uint, write>;   // same grid: d | (256 if d >= SKIP_T)

var<workgroup> wgHint: atomic<u32>;
@compute @workgroup_size(8, 8)
fn markTiles(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  // one workgroup per tile (dispatch = softblur's grid); no early return, every invocation takes both barriers
  if (li == 0u) { atomicStore(&wgHint, 0u); }
  workgroupBarrier();
  let dims = textureDimensions(srcS0);
  if (gid.x < dims.x && gid.y < dims.y) {
    // `!= 0.0` is exactly the predicate softblur's shortcut hinges on (|a| > 0 somewhere in reach): the direct pass writes lit pixels as
    // -clamp(0, ..) = -0.0, which compares equal to zero (clean, as it must be, or nothing would ever skip); a NaN compares unequal → flagged →
    // that tile just keeps running the per-pixel path. Pixels past the screen edge in a partial tile hold nothing softblur can read (its taps clamp).
    let pc = vec2i(gid.xy);
    if (textureLoad(srcS0, pc, 0).a != 0.0 || textureLoad(srcS1, pc, 0).a != 0.0) { atomicOr(&wgHint, 1u); }
  }
  workgroupBarrier();
  if (li == 0u) { textureStore(tileFlagOut, vec2i(wid.xy), vec4u(atomicLoad(&wgHint), 0u, 0u, 0u)); }
}

@compute @workgroup_size(8, 8)
fn tileDistances(@builtin(global_invocation_id) gid: vec3u) {
  // one invocation per tile. Tiles off the grid contain no pixels at all, so they never count as flagged; (2·SCAN_R+1)² u32 taps of a
  // texture a few hundred texels across — nothing next to one chain pass.
  let td = textureDimensions(tileFlagIn);
  if (gid.x >= td.x || gid.y >= td.y) { return; }
  let t = vec2i(gid.xy); let thi = vec2i(td) - 1;
  var d: i32 = SKIP_T;
  for (var dy = -SCAN_R; dy <= SCAN_R; dy++) {
    for (var dx = -SCAN_R; dx <= SCAN_R; dx++) {
      let q = t + vec2i(dx, dy);
      if (any(q < vec2i(0)) || any(q > thi)) { continue; }
      if (textureLoad(tileFlagIn, q, 0).x != 0u) { d = min(d, max(abs(dx), abs(dy))); }
    }
  }
  textureStore(tileDistOut, t, vec4u(u32(d) | select(0u, 256u, d >= SKIP_T), 0u, 0u, 0u));
}
