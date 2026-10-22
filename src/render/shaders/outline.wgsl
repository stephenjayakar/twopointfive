// THE OUTLINE IN THE DARK (render/outline.ts; host/findme.ts FINDME.outline): a rim round the pixels that are one man's (the player's own, or a teammate's:
// the pass draws this once a man, each with his own owner, ink and width), read off the g-buffer's
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
  fade: vec4f,      // BY THE PICTURE (w = 1; 0 = not asked): the rim beside a part of him fades by how bright that part is drawn — x = the brightness
                    // on the screen (0 black … 1 white) at and over which there is none, y = at and under which it is at its full, z = the exposure
};
@group(0) @binding(0) var gId: texture_2d<u32>;
@group(0) @binding(1) var gDepth: texture_depth_2d;
@group(0) @binding(2) var<uniform> U: OutlineU;
@group(0) @binding(3) var gPic: texture_2d<f32>;   // this frame's composite, a copy that may be read while the composite is drawn on (one black pixel when fade.w is 0)

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
  let pic = U.fade.w > 0.5;
  var best = 1e9;   // the squared distance, in pixels, to the nearest of his that stands in front of this one
  var lum = 0.0;    // by the picture: the light of every pixel of his in reach, as the composite holds it, and how many
  var his = 0.0;
  for (var y = -R; y <= R; y++) {
    for (var x = -R; x <= R; x++) {
      let d2 = f32(x * x + y * y);
      if (d2 >= best && !pic) { continue; }
      let q = clamp(px + vec2i(x, y), vec2i(0), lim);
      if (((textureLoad(gId, q, 0).x >> 20u) & 0xFFu) == U.owner && textureLoad(gDepth, q, 0) <= z) {
        best = min(best, d2);
        if (pic) { lum += dot(max(textureLoad(gPic, q, 0).rgb, vec3f(0.0)), vec3f(0.2126, 0.7152, 0.0722)); his += 1.0; }
      }
    }
  }
  var a = U.ink.a * clamp(U.radius + 0.5 - sqrt(best), 0.0, 1.0);
  if (pic && his > 0.0) {
    // how bright that part of him is on the screen, near enough: the exposure on, the shoulder of a tone curve, a display's gamma (0 black … 1 white).
    // The mean over the few pixels of his in reach, not the nearest one: the rim changes along him as his shading does, and one noisy pixel is not a blink
    let l = clamp(lum / his * U.fade.z, 0.0, 1e4);   // (a pixel of his at the format's infinity is very bright, not a number that is none)
    let v = sqrt(l / (1.0 + l));
    a *= clamp((U.fade.x - v) / max(U.fade.x - U.fade.y, 1e-4), 0.0, 1.0);
  }
  return vec4f(U.ink.rgb, a);
}
