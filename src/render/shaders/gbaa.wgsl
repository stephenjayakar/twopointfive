// GBAA — geometry-buffer anti-aliasing (Persson 2011), the image-quality program's single-frame edge AA (docs/internal/image-quality.md §C3).
// The g-buffer's box raster writes, per pixel, the signed distance in PIXELS from the pixel centre to the nearest silhouette / crease edge of the box face it shows,
// along the screen axis that edge is most nearly perpendicular to (gbuffer.wgsl boxEdgeOffset → the `edge` target, rg8unorm, d·½+½; a component ≥ ½ in magnitude =
// no edge crosses this pixel along that axis). Here, per pixel of the composite (hdr):
//   1. its own offset; if no edge crosses it, the four neighbours': a left neighbour whose edge lies ½‥1 px to ITS right has that edge inside this pixel at
//      l − 1, etc. — the pixel on the far side of a silhouette shows the OTHER surface and knows nothing of the edge, so the near side lends it;
//   2. the far side of the edge (a slab 0.5 − |d| of the pixel wide) belongs to whatever the neighbour across it shows: blend toward that neighbour by exactly that
//      coverage — in the reversible tonemapped space the TAA resolve weighs in (an emissive panel's edge against a dark desk averages as it will look, not in raw
//      radiance where the bright side always wins the pixel).
// SAME-SURFACE CLAMP (lane v3/direct-quality, frame.sharpCfgC.w = settings.gbaaClamp): the far side of a pixel's own edge belongs to the neighbour across it only if that neighbour
// is AT or BEHIND this pixel — the far side of a silhouette (metres back) or the other face of a crease (the same depth to a few cm). A neighbour NEARER than the pixel is a third
// surface standing over the edge (a man before a partition's top edge, a chair back across a desk's lip): its colour is not what the sliver beyond the edge shows, and lending it
// put half of him into every edge pixel his outline crossed — a rim of his colour along the furniture behind him. Such a pixel keeps its own colour (0 = the blend as it was).
// Analytic coverage from exact geometry: no history, no jitter, no search — an edge in motion is as clean as one at rest. Skinned men, glass panes and
// intersection lines (a box sunk into another) carry no edge here (their pixels write NONE) and are left to the temporal resolve as before. Runs after the
// composite (+ the particles' splat) and before the resolve, IN PLACE on hdr: the host copies hdr → hdrCopy first, this reads the copy and stores hdr.
@group(1) @binding(0) var hdrCopy: texture_2d<f32>;                          // the composite as written (a copy: we store over the original)
@group(1) @binding(1) var gEdge: texture_2d<f32>;                            // the g-buffer's edge offsets at the composite's size (the output-size raster under sharp direct)
@group(1) @binding(2) var hdrOut: texture_storage_2d<rgba16float, write>;   // hdr itself
@group(1) @binding(3) var gDepthE: texture_depth_2d;                         // the matching depth: a neighbour's edge is only taken up by a pixel AT or BEHIND that neighbour (the far side of a silhouette / the
                                                                             // other face of a crease) — never by a nearer surface the edge passes behind (a man in front of a desk edge, a box in front of another's)

fn tm(c: vec3f) -> vec3f { return c / (1.0 + luminance(c) * frame.exposure); }
fn tmInv(c: vec3f) -> vec3f { return c / max(1.0 - luminance(c) * frame.exposure, 1e-4); }
fn edgeAt(p: vec2i, hi: vec2i) -> vec2f { return textureLoad(gEdge, clamp(p, vec2i(0), hi), 0).xy * 2.0 - 1.0; }
/** view distance of pixel p's surface (m; the far plane for the sky) */
fn distAt(p: vec2i, hi: vec2i) -> f32 { let q = clamp(p, vec2i(0), hi); return distance(worldFromDepth(vec2f(q) + 0.5, textureLoad(gDepthE, q, 0)), frame.camPos); }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2i(textureDimensions(hdrOut));
  let p = vec2i(gid.xy);
  if (p.x >= dims.x || p.y >= dims.y) { return; }
  let hi = dims - 1;
  var off = edgeAt(p, hi);
  if (min(abs(off.x), abs(off.y)) >= 0.5) {
    // no edge through this pixel: does a neighbour's edge extend into it? (its offset points at us and lands within our half — and we are not in FRONT of that neighbour: depth)
    off = vec2f(0.5, 0.5);
    let zP = distAt(p, hi); let tol = 0.05 + 0.02 * zP;   // at or behind = the far side of a silhouette (metres away) or the other face of a crease (the same depth to a few cm)
    let l = edgeAt(p + vec2i(-1, 0), hi).x; let r = edgeAt(p + vec2i(1, 0), hi).x;
    let u = edgeAt(p + vec2i(0, -1), hi).y; let d = edgeAt(p + vec2i(0, 1), hi).y;
    if (abs(l - 0.75) < 0.25 && zP + tol >= distAt(p + vec2i(-1, 0), hi)) { off = vec2f(l - 1.0, 0.5); }
    if (abs(r + 0.75) < 0.25 && zP + tol >= distAt(p + vec2i(1, 0), hi)) { off = vec2f(r + 1.0, 0.5); }
    if (abs(u - 0.75) < 0.25 && zP + tol >= distAt(p + vec2i(0, -1), hi)) { off = vec2f(0.5, u - 1.0); }
    if (abs(d + 0.75) < 0.25 && zP + tol >= distAt(p + vec2i(0, 1), hi)) { off = vec2f(0.5, d + 1.0); }
  }
  // per axis: the blend position between this pixel and the neighbour across the edge = ±½ − d (magnitude 0.5 − |d| = the far side's coverage); a component holding no edge on that axis
  // (|d| ≥ ½: the encoder's NONE, or an edge that does not cross this pixel) shifts nothing
  var sh = select(vec2f(-0.5), vec2f(0.5), off >= vec2f(0.0)) - off;
  sh = select(sh, vec2f(0.0), abs(off) >= vec2f(0.5));
  var c = textureLoad(hdrCopy, p, 0).xyz;
  let ax = abs(sh.x); let ay = abs(sh.y);
  if (max(ax, ay) > 1e-3) {
    var nb: vec2i; var w: f32;
    if (ax >= ay) { nb = p + vec2i(select(-1, 1, sh.x > 0.0), 0); w = ax; } else { nb = p + vec2i(0, select(-1, 1, sh.y > 0.0)); w = ay; }
    if (frame.sharpCfgC.w > 0.0) { let zP = distAt(p, hi); if (distAt(nb, hi) + (0.05 + 0.02 * zP) < zP) { w = 0.0; } }   // SAME-SURFACE CLAMP (header): a nearer third surface across the edge lends nothing
    if (w > 0.0) {
      let cn = textureLoad(hdrCopy, clamp(nb, vec2i(0), hi), 0).xyz;
      c = tmInv(mix(tm(c), tm(cn), clamp(w, 0.0, 0.5)));
    }
  }
  textureStore(hdrOut, p, vec4f(c, 1.0));
}
