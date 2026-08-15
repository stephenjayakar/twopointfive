// SHARP DIRECT — the hard-shadow-edge mask (docs/internal/sharp-direct.md; read by sharp_direct.wgsl's edge rays). One thread per INTERNAL pixel over the denoised
// direct pair: per emitter class, is there a HARD shadow edge within ±2 px of this pixel? = the visibility ratio S∕U (luminance) ranges by more than
// frame.sharpCfgB.y across the 5×5 round it while EVERY pixel of that 5×5 that holds its OWN hint holds one under frame.sharpCfgB.z px. Own = the hint's
// sign (both estimators and the denoiser's write-back keep a pixel's own blocker-distance width NEGATIVE — 0.75 px at a contact, many px in a tall
// occluder's penumbra — and an inherited / dilated prior positive: the cap, 10 px, on an open lit desk, which says nothing about hardness). The maximum,
// not the minimum: where a hard contact shadow and a tall occluder's soft one overlap (a monitor's foot and its panel under one lamp) the soft
// one must win — one binary ray cannot draw a penumbra — so any wide dark pixel in reach vetoes; the price is that the veto also reaches two pixels into a
// contact umbra whose deeper pixels' rays meet the occluder's far side and read wide, which only stops the ray being spent inside the umbra, where the
// ratio is already right. ±2 internal px is what it takes to cover the true geometric edge of a thin contact shadow, which the ratio's blur erodes inward by up to its
// own radius. → mask bits 1 (sharp class) | 2 (broad class), r32uint.
// The 5×5 comes off a 12×12 workgroup apron loaded once per 8×8 tile (4 fetches a lane).
@group(1) @binding(0) var iS0: texture_2d<f32>;
@group(1) @binding(1) var iS1: texture_2d<f32>;
@group(1) @binding(2) var iU0: texture_2d<f32>;
@group(1) @binding(3) var iU1: texture_2d<f32>;
@group(1) @binding(4) var outMask: texture_storage_2d<r32uint, write>;

var<workgroup> wgR: array<vec4f, 144>;   // 12×12 apron: (r0, h0 px signed, r1, h1 px signed); r = −1 where the class has no light

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32, @builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2i(textureDimensions(iS0));
  let org = vec2i(wid.xy) * 8 - 2;
  for (var k = lidx; k < 144u; k += 64u) {
    let t = clamp(org + vec2i(i32(k % 12u), i32(k / 12u)), vec2i(0), dims - 1);
    let s0 = textureLoad(iS0, t, 0); let s1 = textureLoad(iS1, t, 0);
    let lu0 = luminance(textureLoad(iU0, t, 0).rgb); let lu1 = luminance(textureLoad(iU1, t, 0).rgb);
    wgR[k] = vec4f(select(-1.0, luminance(s0.rgb) / max(lu0, 1e-6), lu0 > 1e-4), s0.a * MAX_BLUR_PX, select(-1.0, luminance(s1.rgb) / max(lu1, 1e-6), lu1 > 1e-4), s1.a * MAX_BLUR_PX);   // hints kept SIGNED (< 0 = the pixel's own)
  }
  workgroupBarrier();
  if (any(vec2i(gid.xy) >= dims)) { return; }
  let lp = vec2i(i32(lidx & 7u), i32(lidx >> 3u)) + 2;
  var lo = vec2f(4.0); var hi = vec2f(-1.0); var hm = vec2f(0.0); var nd = vec2u(0u);   // hm: the widest OWN hint in reach; nd: how many pixels held one (0 = nothing says hard: no ray)
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let q = wgR[u32((lp.y + dy) * 12 + lp.x + dx)];
      if (q.x >= 0.0) { lo.x = min(lo.x, q.x); hi.x = max(hi.x, q.x); if (q.y < 0.0) { hm.x = max(hm.x, -q.y); nd.x += 1u; } }   // (a positive hint is inherited: no verdict either way)
      if (q.z >= 0.0) { lo.y = min(lo.y, q.z); hi.y = max(hi.y, q.z); if (q.w < 0.0) { hm.y = max(hm.y, -q.w); nd.y += 1u; } }
    }
  }
  let spread = frame.sharpCfgB.y; let hard = frame.sharpCfgB.z;
  var bits = 0u;
  if (hi.x - lo.x > spread && nd.x > 0u && hm.x < hard) { bits |= 1u; }
  if (hi.y - lo.y > spread && nd.y > 0u && hm.y < hard) { bits |= 2u; }
  textureStore(outMask, gid.xy, vec4u(bits, 0u, 0u, 0u));
}
