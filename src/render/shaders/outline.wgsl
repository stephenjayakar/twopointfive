// THE OUTLINE IN THE DARK (render/outline.ts; host/findme.ts FINDME.outline): a rim round the pixels that are the player's own man, read off the g-buffer's
// id target — every pixel there carries the owner of what was drawn into it (gbuffer.wgsl: bits 20–27; his body, his kit and his gun alike), so the rim is
// his silhouette as this frame drew it, at any zoom and in any pose. One triangle over the composite, blended, inside a scissor round him: a pixel that is
// not his takes the ink by how near the nearest of his pixels is — and only from one that stands IN FRONT of it (the g-buffer's depth, smaller = nearer),
// so a wall top, a table or a teammate between him and the camera is not drawn on; a pixel that is his is left as the picture made it.
struct OutlineU {
  ink: vec4f,       // rgb = the rim's colour in the composite's own units (the exposure taken out) · a = its opacity this frame
  owner: u32,       // the owner byte the rim goes round
  radius: f32,      // the rim's width, pixels of the composite (its outer pixel fades)
  pad0: f32,
  pad1: f32,
};
@group(0) @binding(0) var gId: texture_2d<u32>;
@group(0) @binding(1) var gDepth: texture_depth_2d;
@group(0) @binding(2) var<uniform> U: OutlineU;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = vec2i(pos.xy);
  let lim = vec2i(textureDimensions(gId)) - vec2i(1);
  if (((textureLoad(gId, px, 0).x >> 20u) & 0xFFu) == U.owner) { return vec4f(0.0); }
  let z = textureLoad(gDepth, px, 0);
  let R = i32(ceil(U.radius));
  var best = 1e9;   // the squared distance, in pixels, to the nearest of his that stands in front of this one
  for (var y = -R; y <= R; y++) {
    for (var x = -R; x <= R; x++) {
      let d2 = f32(x * x + y * y);
      if (d2 >= best) { continue; }
      let q = clamp(px + vec2i(x, y), vec2i(0), lim);
      if (((textureLoad(gId, q, 0).x >> 20u) & 0xFFu) == U.owner && textureLoad(gDepth, q, 0) <= z) { best = d2; }
    }
  }
  return vec4f(U.ink.rgb, U.ink.a * clamp(U.radius + 0.5 - sqrt(best), 0.0, 1.0));
}
