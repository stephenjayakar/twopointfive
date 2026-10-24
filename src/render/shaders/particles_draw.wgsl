// GPU particles — the splat (EXPERIMENT, render/particles.ts; prelude = scene + particles_common). One instanced draw straight after the composite, INTO the
// HDR target it wrote (before bloom → post → fxaa): six vertices per live-window slot, no vertex buffer. Nothing here has any history, so there is nothing
// to smear; sparks add radiance and the bloom finds them like it finds a muzzle card. Each particle is a short screen-space capsule from where it was a
// shutter-time ago to where it is (a spark's streak IS its speed; a resting chip / casing is a dash at its resting angle; a puff is a round blob), never
// drawn thinner than ~1.5 px: what is thinner is widened and its intensity / coverage scaled down by as much, so a 2 mm ember ten metres off carries the
// light it should instead of crawling in and out of pixels. Depth: the g-buffer depth at the pixel against the particle's own distance, softened over a
// couple of centimetres (a puff over its radius) — a chip resting ON the floor is biased to show, one under the desk top does not. Fog: the volumetric
// pass's transmittance to the surface behind the pixel, raised to the particle's share of that distance, dims it; the in-scatter in front is added back.
struct PoolR { hdr: array<vec4u, 4>, parts: array<Particle> };
@group(1) @binding(0) var<storage, read> poolR: PoolR;
@group(1) @binding(1) var<uniform> em: EmitBlock;
@group(1) @binding(2) var gDepth: texture_depth_2d;
@group(1) @binding(3) var volTex: texture_2d<f32>;   // rgb in-scatter, a transmittance toward the surface (volumetrics.wgsl), 1/frame.lossyCfg.y res
@group(1) @binding(4) var froxTex: texture_3d<f32>;  // the integrated froxel volume (froxel.wgsl; FLAG_FROXEL_VOL): the haze to the particle's OWN distance in one fetch — volTex then holds the smoke + rain
@group(1) @binding(5) var sceneTex: texture_2d<f32>;  // PARTICLE RAIN v2: the composite's copy (render/passes.ts hdrCopy, this pass's own size) the rain streaks REFRACT — a 1×1 black stand-in when em.rainCfgC.x is 0
@group(1) @binding(6) var sceneSamp: sampler;         // … read bilinear

const MIN_HALF_PX: f32 = 0.75;   // half-width floor in pixels (a 1.5 px line): thinner is widened and dimmed / thinned in coverage by the same factor

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) shade: vec3f,                          // radiance to show (a spark's emission, a lit chip's outgoing radiance)
  @location(1) loc: vec2f,                            // px in the capsule's own frame: x along tail(0) → head(L), y across · SHEET: −1‥1 across the quad both ways
  @location(2) @interpolate(flat) prm: vec4f,         // x = L px, y = half width px, z = mode (0 additive spark · 1 opaque lit · 2 dust blob · 3 sheet quad · 4 / 5 rain · 6 glass shard), w = coverage ≤ 1
  @location(3) @interpolate(flat) prm2: vec4f,        // x = fade (end of life), y = depth softening range m, z = opacity (dust) · SHEET: reactivity (1 in the air, low at rest), w = SHARD: frost at rest in 255ths + heap as the fraction (else spare)
  @location(4) zlin: f32,                             // metres eye → particle, tail to head (SHEET: per corner, so exact across the leaf)
};

fn cull() -> VOut { var o: VOut; o.pos = vec4f(0.0, 0.0, 2.0, 1.0); o.shade = vec3f(0.0); o.loc = vec2f(0.0); o.prm = vec4f(0.0); o.prm2 = vec4f(0.0); o.zlin = 0.0; return o; }   // z > w on all six: the primitive is clipped whole

/** The SHEET: an oriented quad in the world — width `size` across t, size × aspect along b (particles_common sheetFrame off its normal + spin), both faces (no
 *  culling), its four corners projected as they are; the fragment stage antialiases the rim over a pixel of `loc` and depth-softens it against the scene like a chip
 *  (a leaf lying ON the desk shows; the half of it slid under the monitor's foot does not). At rest it stops asking the TAAU to distrust its pixels (they hold still). */
fn sheetVertex(p: Particle, corner: u32, k1: vec4f) -> VOut {
  let n = pOctDecode(p.ori); let fr = sheetFrame(n, p.spin);
  let asp = unpack2x16float(p.aux).x;
  let cx = select(0.0, 1.0, corner == 1u || corner == 4u || corner == 5u);
  let cy = select(0.0, 1.0, corner == 2u || corner == 3u || corner == 5u);
  let lx = cx * 2.0 - 1.0; let ly = cy * 2.0 - 1.0;
  let wp = p.pos + fr[0] * (lx * 0.5 * p.size) + fr[1] * (ly * 0.5 * p.size * asp);
  let cp = frame.viewProj * vec4f(wp, 1.0);   // (no per-corner cull: the clipper handles a leaf crossing the near plane; culling one corner made a sliver toward the screen centre)
  var o: VOut;
  o.pos = cp;
  o.shade = p.shade;
  o.loc = vec2f(lx, ly);
  let asleep = (p.bits & PB_ASLEEP) != 0u;
  o.prm = vec4f(0.9 + 0.12 * f32((p.seed >> 10u) & 255u) / 255.0, 0.0, 3.0, 1.0);   // x = this leaf's tone (no two reams are the same white; a pile reads as separate leaves)
  o.prm2 = vec4f(clamp((p.life - p.age) / max(k1.y, 1e-3), 0.0, 1.0), 0.03, select(1.0, 0.15, asleep), 0.0);
  o.zlin = distance(frame.camPos, wp);
  return o;
}

/** The glass SHARD: the sheet's oriented quad (width `size` across t, size × aspect along b, both faces), drawn no narrower than SHARD_MIN_PX — a fragment thinner than
 *  that on screen is scaled up about its centre, its body's coverage cut by the area ratio and its glint's by the square root of it (a sub-pixel sliver still flashes when
 *  it finds a light; without the floor it crawled in and out of pixels) — its outline cut to an irregular polygon in the fragment stage off its seed. */
fn shardVertex(p: Particle, corner: u32, k1: vec4f) -> VOut {
  let n = pOctDecode(p.ori); let fr = sheetFrame(n, p.spin);
  let asp = unpack2x16float(p.aux).x;
  let cx = select(0.0, 1.0, corner == 1u || corner == 4u || corner == 5u);
  let cy = select(0.0, 1.0, corner == 2u || corner == 3u || corner == 5u);
  let lx = cx * 2.0 - 1.0; let ly = cy * 2.0 - 1.0;
  let cc = frame.viewProj * vec4f(p.pos, 1.0);
  if (cc.w < 0.05) { return cull(); }
  let asleep = (p.bits & PB_ASLEEP) != 0u;
  let frost = select(0.0, shardFrost(p.size), asleep && (em.flags & 8u) != 0u);   // (round five) at rest a grain is the handful that fell with it: wider on the floor, frosted (0 in the air, 0 for a sliver)
  let size = p.size * mix(1.0, shardRestSpread(p.size), frost);
  let wTrue = size * frame.screen.y * 0.5 / (frame.post.w * cc.w);     // its honest width in pixels
  let sc = max(1.0, mix(SHARD_MIN_PX, SHARD_REST_MIN_PX, frost) / max(wTrue, 1e-3));
  let wp = p.pos + (fr[0] * (lx * 0.5 * size) + fr[1] * (ly * 0.5 * size * asp)) * sc;
  var o: VOut;
  o.pos = frame.viewProj * vec4f(wp, 1.0);
  o.shade = p.shade;
  o.loc = vec2f(lx, ly);
  o.prm = vec4f(f32(p.seed & 0xffffu), 1.0 / (sc * sc), 6.0, 1.0 / sc);   // x = the outline's seed, y = the body's coverage, w = the glint's
  o.prm2 = vec4f(clamp((p.life - p.age) / max(k1.y, 1e-3), 0.0, 1.0), 0.03, select(1.0, SHARD_REACT_REST, asleep), floor(frost * 255.0) + 0.99 * shardRestHeap(p.size));   // (w = the frost at rest in 255ths + how much of a heap it is, as the fraction: shardFragment's body)
  o.zlin = distance(frame.camPos, wp);
  return o;
}

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let inst = vi / 6u; let corner = vi % 6u;
  let slot = slotOf3(em.win[0], em.win[1], em.rainWin, inst);   // (the two rings, then the rain ring's window — empty unless it rains particles)
  if (slot == 0xffffffffu) { return cull(); }
  let p = poolR.parts[slot];
  if (p.age >= p.life) { return cull(); }
  let kind = p.bits & PB_KIND; let asleep = (p.bits & PB_ASLEEP) != 0u;
  if (kind != P_RAIN && (p.bits & PB_OURS) == 0u && !((p.bits & PB_KEPT) != 0u && fogKeptOn()) && fogSeenBins(p.pos) < 0.5) { return cull(); }   // (the fog of war's full picture: a spark, a puff, a chip, a case, a leaf of paper or a shard over floor nobody on the team sees is not drawn, unless it is the team's own doing (PB_OURS — game/fogofwar.ts FOG.ours) — the weather is the same everywhere and stays; 1 while no sight table is written)
  let k1 = em.kp[kind * 2u + 1u];
  if (kind == P_SHEET) { return sheetVertex(p, corner, k1); }
  if (kind == P_RAIN) { return rainVertex(p, corner, em.kp[kind * 2u], k1); }   // the rain drop's streak / its splash crown (below)
  if ((SHARDS_ON && kind == P_SHARD)) { return shardVertex(p, corner, k1); }                   // a fragment of glass (above; shardFragment below)
  let u = clamp(p.age / p.life, 0.0, 1.0);
  // the segment in the world: head = where it is, tail = a shutter-time back along its velocity (never further back than it has existed) — or a resting dash
  var head = p.pos; var tail = p.pos;
  var width = p.size;                                  // metres across
  var mode = 1.0; var fade = 1.0; var opacity = 1.0; var softR = max(p.size * 2.0, 0.02);
  if (kind == P_SPARK) {
    tail = head - p.vel * min(k1.z, p.age);
    mode = 0.0; softR = 0.03;
  } else if (kind == P_DUST) {
    width = 2.0 * p.size * (1.0 + k1.z * u);            // diameter, growing
    mode = 2.0; opacity = k1.w * (1.0 - u) * (1.0 - u) * smoothstep(0.0, max(k1.x, 1e-3), p.age); softR = max(width * 0.25, 0.05) * k1.y;   // (k1.x = fade-in s 0.06, k1.y = softness × 1: params.dust's look slots — game/particleFx.ts DUST_LOOK)
    opacity *= steamOf(p.color);                        // STEAM (snowBreath.ts): a breath's own share of the puff's opacity — 1 for every other puff
  } else {                                             // debris / casing: a motion streak in flight, a dash at its resting angle once down
    let halfLen = p.size * select(0.55 * max(1.0, unpack2x16float(p.aux).x), 2.0, kind == P_CASING);   // a chip is barely longer than wide (× its aspect: a splinter is three chips long); a case is four diameters long
    if (asleep) { let ax = vec3f(cos(p.spin), 0.0, sin(p.spin)); head = p.pos + ax * halfLen; tail = p.pos - ax * halfLen; }
    else {
      let back = p.vel * min(k1.z, p.age);
      let bl = length(back);
      if (bl > 2.0 * halfLen) { tail = head - back; } else { let ax = vec3f(cos(p.spin + p.age * 9.0), 0.3 * sin(p.age * 13.0 + p.spin), sin(p.spin + p.age * 9.0)); head = p.pos + ax * halfLen; tail = p.pos - ax * halfLen; }   // slow: it tumbles rather than streaks
    }
    fade = clamp((p.life - p.age) / max(k1.y, 1e-3), 0.0, 1.0);
  }
  let ch = frame.viewProj * vec4f(head, 1.0); let ct = frame.viewProj * vec4f(tail, 1.0);
  if (ch.w < 0.05 || ct.w < 0.05) { return cull(); }
  let half = frame.screen * 0.5;
  let sh = ch.xy / ch.w * half; let st = ct.xy / ct.w * half;          // px about the screen centre, y up
  let pxPerM = half.y / (frame.post.w * ch.w);                          // metres → pixels at the head's depth (post.w = tan(fov/2))
  let wTrue = width * pxPerM;                                          // its honest width in pixels
  let halfW = max(0.5 * wTrue, MIN_HALF_PX);
  let coverage = min(1.0, wTrue / (2.0 * halfW));
  let d = sh - st; let L = length(d);
  let dir = select(vec2f(1.0, 0.0), d / max(L, 1e-6), L > 1e-4); let nrm = vec2f(-dir.y, dir.x);
  let ext = halfW + 0.75;                                              // AA skirt
  let cx = select(0.0, 1.0, corner == 1u || corner == 4u || corner == 5u);
  let cy = select(0.0, 1.0, corner == 2u || corner == 3u || corner == 5u);
  let a = mix(-ext, L + ext, cx); let b = mix(-ext, ext, cy);
  let spx = st + dir * a + nrm * b;
  let zw = mix(vec2f(ct.z, ct.w), vec2f(ch.z, ch.w), cx);
  var o: VOut;
  o.pos = vec4f(spx / half * zw.y, zw.x, zw.y);
  o.shade = p.shade;
  o.loc = vec2f(a, b);
  o.prm = vec4f(L, halfW, mode, coverage);
  o.prm2 = vec4f(fade, softR, opacity, 0.0);
  o.zlin = distance(frame.camPos, mix(tail, head, cx));
  return o;
}

// Two targets: the radiance into hdr, and the REACTIVE mask (r8, max-blended) the TAAU resolve raises its new-frame weight by — a splat has no history to reproject, so without it a
// spark would surface at a tenth of its brightness and trail for ten frames. A spark's reactivity is how visible it is (its luminance against display white), a chip's / puff's its coverage.
struct FOut { @location(0) color: vec4f, @location(1) react: vec4f };

@fragment fn fs(v: VOut) -> FOut {
  var fo: FOut;
  let L = v.prm.x; let halfW = v.prm.y; let mode = v.prm.z; let coverage = v.prm.w;
  let fw = fwidth(v.loc);                                              // (taken up here, in uniform control flow: the sheet's rim below is antialiased over one pixel of it)
  if (mode > 5.5) { return shardFragment(v, fw); }                     // a fragment of glass (6), below
  if (mode > 3.5) { return rainFragment(v); }                          // the rain drop's streak (4) / splash crown (5): particle rain experiment, below
  let d = length(vec2f(v.loc.x - clamp(v.loc.x, 0.0, L), v.loc.y));   // px to the capsule's spine
  var prof: f32;
  let sheet = mode > 2.5;
  var tone = 1.0;
  if (sheet) {   // the leaf: full inside, one pixel of antialiased edge, its own tone, and a faint darkening toward the rim so a leaf lying on another leaf still has an edge
    let e = clamp((vec2f(1.0) - abs(v.loc)) / max(fw, vec2f(1e-4)), vec2f(0.0), vec2f(1.0)); prof = e.x * e.y; if (prof <= 0.0) { discard; }
    let rim = max(abs(v.loc.x), abs(v.loc.y)); tone = L * (1.0 - 0.12 * smoothstep(0.82, 1.0, rim));
  }
  else if (SNOW_WISPS && mode > 2.2) {   // (2.25) a WISP of blowing snow (wispVertex): a puff of fine motes (wispMotes) — or, with none asked for, the older combed streak
    let x = d / halfW; if (x >= 1.0) { discard; }
    // A PUFF OF FINE SNOW (the maintainer, 10-15, of the combed streak below: "they just look like stretched out particle billboards"; and with a clip of a ground
    // blizzard: "at the wind speeds we have, we want the gentle, shimmering puffs of very small, a little [glinting] particles"): with motes asked for the streak is
    // not drawn at all — the same soft falloff is filled with pinpoint motes (wispMotes) over a breath of haze
    let look = floor(v.prm2.w); let motes = floor(look / 16.0) / 15.0;
    if (motes > 0.0) { prof = wispMotes(vec2f(v.loc.x - 0.5 * L, v.loc.y), coverage, fract(v.prm2.w), (exp(-3.5 * x * x) - 0.0302) / 0.9698, motes, (look - floor(look / 16.0) * 16.0) / 15.0); }
    else {
      let t = clamp(v.loc.x / max(L, 1.0), 0.0, 1.0); let s = v.prm2.w * 91.7;
      let n1 = wispN1(v.loc.y / halfW * 2.2 + s, 3.0); let n2 = wispN1(v.loc.y / halfW * 5.6 + s * 2.3 + t * 0.7, 7.0);
      let strand = 0.12 + 0.88 * n1 * n1 * (0.5 + n2);   // (strands: two scales across, the finer one leaning a little along the streak so they are not ruled lines)
      let clump = 0.45 + 0.55 * wispN1(t * 2.5 + s * 1.7, 5.0);
      prof = (exp(-3.5 * x * x) - 0.0302) / 0.9698 * strand * clump * mix(0.25, 1.0, smoothstep(0.0, 0.7, t)) * (1.0 - 0.4 * smoothstep(0.8, 1.0, t));
    }
  }
  else if (mode > 1.5) { let x = d / halfW; if (x >= 1.0) { discard; } prof = (exp(-3.5 * x * x) - 0.0302) / 0.9698; }   // soft round puff, exactly 0 at its rim
  else { prof = clamp(halfW + 0.5 - d, 0.0, 1.0); if (prof <= 0.0) { discard; } }                                    // hard little thing with a 1 px antialiased edge
  // scene depth at this pixel vs the particle's own distance
  let pix = vec2i(v.pos.xy);
  let dep = textureLoad(gDepth, pix, 0);
  var zs = 1e6;
  if (dep < 1.0) { zs = distance(worldFromDepth(v.pos.xy, dep), frame.camPos); }
  let zp = v.zlin; let softR = v.prm2.y;
  let bias = select(softR, 0.0, mode > 1.5 && !sheet);  // a chip lying ON a surface (its centre half a size off it, seen from above: 'behind' by millimetres) must show whole; a puff fades into what it meets; a leaf lies on its desk like the chip
  let soft = clamp((zs - zp + bias) / softR, 0.0, 1.0);
  if (soft <= 0.0) { discard; }
  // haze / smoke between it and the eye
  var tp = 1.0; var insc = vec3f(0.0);
  if ((em.flags & 4u) != 0u) {
    let vdiv = max(1, i32(frame.lossyCfg.y)); let vd = vec2i(textureDimensions(volTex));
    var pv = pix / vdiv; if (frame.sharpCfg.z > 0.0) { pv = vec2i((vec2f(pix) + 0.5) * (frame.sharpCfg.xy / frame.screen) + frame.sharpCfgC.xy) / vdiv; }   // (SHARP DIRECT, docs/internal/sharp-direct.md: this splat runs at the OUTPUT size then, the volumetric grid is a fraction of the internal raster)
    let vol = textureLoad(volTex, clamp(pv, vec2i(0), vd - 1), 0);
    let fr = clamp(zp / max(zs, 1e-3), 0.0, 1.0);
    tp = pow(max(vol.a, 1e-4), fr); insc = vol.rgb * fr;
    if ((frame.flags & FLAG_FROXEL_VOL) != 0u) { let hz = froxelFetch(froxTex, v.pos.xy * frame.invScreen, zp); insc += hz.rgb * tp; tp *= hz.a; }   // + the haze in front of IT (exact at its own depth), behind the smoke's share like the surface's
  }
  let fade = v.prm2.x;
  if (mode < 0.5) {                                                                          // spark: pure add (dst × (1 − 0) + this) — brighter at the head than
    let ramp = mix(0.45, 1.15, clamp(v.loc.x / max(L, 1.0), 0.0, 1.0));                     // the tail (the streak reads as going somewhere; mean ≈ 0.8 keeps its light)
    let rad = v.shade * (prof * coverage * soft * fade * tp * ramp);
    fo.color = vec4f(rad, 0.0);
    fo.react = vec4f(clamp(luminance(rad) * frame.exposure * 4.0, 0.0, 1.0), 0.0, 0.0, 0.0);   // (a quarter of display white already reads as a full streak)
    return fo;
  }
  let alpha = prof * select(coverage, 1.0, SNOW_WISPS && mode > 2.2 && !sheet) * soft * fade * select(1.0, v.prm2.z, mode > 1.5 && !sheet);   // (a wisp's `coverage` slot carries its pixels to the metre: wispVertex)
  if (SNOW_WISPS && mode > 2.2 && !sheet) {   // a WISP: nearly all light, hardly any cover (thin blown snow lets the ground through) — many lie over one another as a veil
    fo.color = vec4f(v.shade * (tp * alpha), min(1.0, alpha * WISP_COVER));   // (a glinting mote in a heavy puff can weigh over 3: its cover stops at all of it)
    // (a puff of MOTES moves a few pixels a frame and its grains are a pixel or two: the history must let go of them, or they smear into the haze they are not)
    fo.react = vec4f(clamp(alpha * select(0.6, 3.0, v.prm2.w >= 16.0), 0.0, 1.0), 0.0, 0.0, 0.0);
    return fo;
  }
  fo.color = vec4f((v.shade * (tone * tp) + insc) * alpha, alpha);                          // premultiplied over
  fo.react = vec4f(clamp(alpha * select(1.0, v.prm2.z, sheet), 0.0, 1.0), 0.0, 0.0, 0.0);   // (a leaf at rest holds still: its pixels may keep their history)
  return fo;
}

// ================================================================== the rain drop (EXPERIMENT exp/particle-rain; particles.wgsl rainStep moves / lands / lights it)
/** FALLING: a velocity-aligned streak — head where the drop is, tail a shutter (k1.z s) back along its velocity, k0-agnostic width p.size (the splat's own thin-line rule widens
 *  what is under 1.5 px and dims it by as much: a streak two metres under the camera and one twelve metres off carry the light they should) — projected exactly as the
 *  chips' capsule is, mode 4; faded IN over its first k1.y s (it is born under the top of the rain slab in mid air, like the lattice's streaks fade in over their top metre).
 *  SPLASHED (PB_ASLEEP): ONE quad lying on the surface it landed on (normal in ori, like the sheet's) — the fragment stage draws the crown in it procedurally: the ring
 *  running out and RAIN_SPLASH_DROPLETS thrown outward, over k1.x s; mode 5. */
fn rainVertex(p: Particle, corner: u32, k0: vec4f, k1: vec4f) -> VOut {
  let cx = select(0.0, 1.0, corner == 1u || corner == 4u || corner == 5u);
  let cy = select(0.0, 1.0, corner == 2u || corner == 3u || corner == 5u);
  let half = frame.screen * 0.5;
  if (SNOW_GRAINS) { if (grainIs(p.aux)) { return grainVertex(p, cx, cy); } }   // a grain of blown snow near the view (below)
  if (SNOW_WISPS) { if (wispIs(p.aux)) { return wispVertex(p, cx, cy); } }   // a wisp of blowing snow (below)
  var o: VOut;
  if ((p.bits & PB_ASLEEP) != 0u) {   // the splash quad
    let n = pOctDecode(p.ori); let fr = sheetFrame(n, f32(p.seed & 1023u) * 0.00613592);
    let S = max(k0.w, 0.02) * 1.7;                                     // half-size: the crown's reach + the droplets' hop
    let lx = cx * 2.0 - 1.0; let ly = cy * 2.0 - 1.0;
    let wp = p.pos + fr[0] * (lx * S) + fr[1] * (ly * S);
    let cp = frame.viewProj * vec4f(wp, 1.0);
    if (cp.w < 0.05) { return cull(); }
    o.pos = cp; o.shade = p.shade; o.loc = vec2f(lx * S, ly * S);
    let zl = distance(frame.camPos, wp);
    o.prm = vec4f(p.age - p.spin, max(k0.w, 0.02), 5.0, 1.0);         // splash age, crown radius, mode 5
    o.prm2 = vec4f(clamp((p.life - p.age) / max(k1.x * 0.35, 1e-3), 0.0, 1.0), 0.03, f32(p.seed & 4095u), 2.0 * zl * frame.post.w / frame.screen.y);   // fade over the last third, depth softening, seed, metres per pixel here
    o.zlin = zl;
    return o;
  }
  // the streak (= vs()'s capsule for the chips, with the rain's head / tail / width / fade). v2: each drop its own LENGTH (× 1 ± rainCfgD.x) and BRIGHTNESS (0.5 + 1.5 h², mean 1, by rainCfgD.y)
  // off its seed; the TAIL carries last frame's shade (particles.wgsl rainStep keeps it in omg / omgZ) so the light runs head → tail along the quad; the streak's screen direction rides
  // in prm2.zw for the fragment's refraction taps
  let D4 = em.rainCfgD;
  let h1 = fract(f32(p.seed & 65535u) * 0.61803399); let h2 = fract(f32((p.seed >> 11u) & 65535u) * 0.75487767);
  let lenK = 1.0 + clamp(D4.x, 0.0, 0.9) * (h1 * 2.0 - 1.0);
  let brightK = mix(1.0, 0.5 + 1.5 * h2 * h2, clamp(D4.y, 0.0, 1.0));
  let head = p.pos; let tail = p.pos - p.vel * min(k1.z * lenK, p.age);
  let ch = frame.viewProj * vec4f(head, 1.0); let ct = frame.viewProj * vec4f(tail, 1.0);
  if (ch.w < 0.05 || ct.w < 0.05) { return cull(); }
  let sh = ch.xy / ch.w * half; let st = ct.xy / ct.w * half;
  let pxPerM = half.y / (frame.post.w * ch.w);
  let wTrue = p.size * pxPerM;
  let F6 = em.rainCfgF;
  let minPx = clamp(D4.z - 16.0 * floor(D4.z / 16.0), 0.5, 2.0);      // (rainCfgD.z = the half-width floor + 16 × the refraction taps)
  let halfW = clamp(0.5 * wTrue, minPx, max(F6.x, minPx));            // v2: a CEILING too — a drop two metres off the lens is a thin bright line, not an 8-px bar …
  let coverage = min(max(F6.y, 1.0), wTrue / (2.0 * halfW));           // … its light kept up to rainCfgF.y × (thin → dim as ever below the floor)
  let d = sh - st; let L = length(d);
  let dir = select(vec2f(1.0, 0.0), d / max(L, 1e-6), L > 1e-4); let nrm = vec2f(-dir.y, dir.x);
  let ext = halfW + 0.75;
  let a = mix(-ext, L + ext, cx); let b = mix(-ext, ext, cy);
  let spx = st + dir * a + nrm * b;
  let zw = mix(vec2f(ct.z, ct.w), vec2f(ch.z, ch.w), cx);
  o.pos = vec4f(spx / half * zw.y, zw.x, zw.y);
  let tailShade = vec3f(unpack2x16float(p.omg), unpack2x16float(p.omgZ).x);
  o.shade = select(tailShade, p.shade, cx > 0.5) * brightK;             // (a varying: the quad interpolates it tail → head)
  o.loc = vec2f(a, b);
  let h3 = fract(f32((p.seed >> 5u) & 65535u) * 0.56984029);
  o.prm = vec4f(L, halfW, 4.0 + 0.49 * h3, coverage);                  // (mode 4.xx: the fraction carries this drop's bead phase / count to the fragment — still < 4.5 = a streak)
  var T = p.vel; let tl = length(T); T = select(vec3f(0.0, -1.0, 0.0), T / max(tl, 1e-6), tl > 1e-3);
  let To = T / (abs(T.x) + abs(T.y) + abs(T.z)); var Te = To.xz; if (To.y < 0.0) { Te = (1.0 - abs(Te.yx)) * select(vec2f(-1.0), vec2f(1.0), Te >= vec2f(0.0)); }   // (the streak's WORLD axis, octahedral in two floats: the fragment rebuilds the water cylinder from it)
  o.prm2 = vec4f(smoothstep(0.0, max(k1.y, 1e-3), p.age) * smoothstep(0.35 * F6.z, F6.z, min(ch.w, ct.w)), 0.05, Te.x, Te.y);   // fade IN × out of focus within rainCfgF.z of the lens (a drop crossing just under a low camera is a defocused nothing, not a 400-px bar), depth softening range, the streak's world axis (oct)
  o.zlin = distance(frame.camPos, mix(tail, head, cx));
  return o;
}
fn rainHash(s: f32, k: f32) -> f32 { return fract(sin(s * 12.9898 + k * 78.233) * 43758.5453); }
/** THE MOTES of a puff (fs, a wisp with motes asked for): `q` = px from the puff's middle (along its motion, across), `ppm` px to the metre there, `s` the wisp's
 *  own seed 0‥1, `g` the puff's own soft falloff at this pixel, `motes` 0‥1 how many of the cells hold one, `glintK` 0‥1 how hard one glints. Returns the
 *  pixel's whole weight. A puff of fine snow is GRAINS, EQUALLY BRIGHT, FEWER TOWARD ITS RIM — not a dotted card dimmed by a window — so the falloff thins the
 *  motes by COUNT (which cells hold one: `g` × a clumping that travels through the puff, the density waves of blown snow) and only the haze under them takes it
 *  as weight. Three sheets of cells WISP_MOTE_CELL m across and coarser, the second and third turned off the first's axes; in each the ROWS run at their own
 *  speeds along the puff's motion, so grains stream past one another and no lattice holds. One mote to a cell: WISP_MOTE_M across (never under a pixel and a
 *  half: thinner, it is drawn that wide and dimmed, never below WISP_MOTE_DIM), its light breathing to nothing and back on its own clock, and now and then — a
 *  crystal turning a face to a lamp — a soft glint. A sheet whose cells are down to a few pixels has no room for a mote: it fades into the haze. */
fn wispMotes(q: vec2f, ppm: f32, s: f32, g: f32, motes: f32, glintK: f32) -> f32 {
  let m = q / max(ppm, 1.0); let tm = frame.time;
  let rTrue = 0.5 * WISP_MOTE_M * ppm; let r = max(rTrue, 0.75); let dim = max(WISP_MOTE_DIM, min(1.0, (rTrue * rTrue) / (r * r)));
  // the clumping: two slow noises along and across, sliding through the puff (0.3‥1, about 0.65 on the mean)
  let clump = 0.3 + 0.7 * smoothstep(0.1, 0.75, wispN1(m.x * 2.3 + s * 37.0 - tm * 0.55, 5.0) * 0.6 + wispN1(m.y * 3.1 + s * 91.0 + tm * 0.21, 9.0) * 0.6);
  let keep = motes * 0.9 * clamp(g * 1.6, 0.0, 1.0) * clump;   // the share of cells that hold a mote here
  var acc = 0.0; var hazeUp = 0.0;
  for (var l = 0; l < 3; l++) {
    let fl = f32(l); let cell = WISP_MOTE_CELL * (1.0 + 0.6 * fl);
    let cpx = cell * ppm; let room = smoothstep(2.0 * (r + 0.5), 4.0 * (r + 0.5), cpx); hazeUp += (1.0 - room) / 3.0;
    if (room <= 0.0) { continue; }
    let ang = fl * (0.47 - 0.8 * (fl - 1.0)); let cs = cos(ang); let sn = sin(ang);   // (0, +27°, −38°)
    let mr = vec2f(cs * m.x - sn * m.y, sn * m.x + cs * m.y) / cell;
    let row = floor(mr.y + fract(s * (1.7 + fl)) * 64.0 + fl * 13.0);
    let rowV = (rainHash(row, fl + 11.0) - 0.5) * WISP_MOTE_SHEAR + (0.5 - 0.45 * fl) * WISP_MOTE_DRIFT;   // m/s: this row's own run along the puff's motion
    let u = vec2f(mr.x + fract(s * (3.1 + fl)) * 64.0 + tm * rowV / cell, mr.y + fract(s * (1.7 + fl)) * 64.0 + fl * 13.0);
    let idf = floor(u); let f = u - idf; let id = idf - 256.0 * floor(idf / 256.0);   // (wrapped: the hash's sines stay where every vendor's are exact)
    let h = fract(sin(vec4f(dot(id, vec2f(12.71, 31.17)), dot(id, vec2f(26.95, 18.33)), dot(id, vec2f(41.92, 37.19)), dot(id, vec2f(5.37, 9.73))) + fl * 37.1) * 43758.5453);
    let held = 1.0 - smoothstep(keep - 0.05, keep + 0.05, h.z); if (held <= 0.0) { continue; }
    let edge = min(0.5, (r + 0.5) / cpx);
    let dpx = length((f - mix(vec2f(edge), vec2f(1.0 - edge), h.xy)) * cpx);
    let a = clamp(r + 0.5 - dpx, 0.0, 1.0) * room * held; if (a <= 0.0) { continue; }
    let b0 = 0.5 + 0.5 * sin(tm * (1.5 + 4.0 * h.w) + h.z * 71.0); let breathe = b0 * b0;
    let glint = pow(max(0.0, sin(tm * (0.8 + 2.4 * h.x) + h.w * 6.2831853)), 12.0) * glintK * WISP_GLINT;
    acc += a * dim * (breathe + glint);
  }
  return g * WISP_HAZE * (1.0 + WISP_HAZE_FAR * hazeUp * motes) + sqrt(g) * acc * WISP_MOTE_GAIN;
}
/** A WISP of blowing snow (game/snowFx.ts SNOWWISPS; particles.wgsl wispStep moves and lights it): a long soft streak along its own motion — head where it is, tail
 *  its stretch (the colour word's first byte ÷ 255 × 2 s, × 0.6‥1.4 per wisp) back along its velocity, never further than it has lived — as wide as its size, widening
 *  by three fifths over its life, faded in and out; mode 2.25 (fs: a puff's soft falloff about the streak's spine, combed into strands, thin at the tail), its weight
 *  em.rainCfgC.z × 0.5‥1.5 per wisp, its seed in prm2.w's fraction. WITH MOTES ASKED FOR (the colour word's top byte: game/snowFx.ts wispLookByte) the same quad is
 *  a puff of pinpoint motes over a breath of haze, not a combed streak (fs, wispMotes) — the stretch is then only the puff's lean. */
fn wispVertex(p: Particle, cx: f32, cy: f32) -> VOut {
  let half = frame.screen * 0.5;
  let h1 = fract(f32(p.seed & 65535u) * 0.61803399); let h2 = fract(f32((p.seed >> 11u) & 65535u) * 0.75487767);
  let stretch = f32(p.color & 255u) * (2.0 / 255.0) * (0.6 + 0.8 * h1);
  let head = p.pos; let tail = p.pos - p.vel * min(stretch, p.age);
  let ch = frame.viewProj * vec4f(head, 1.0); let ct = frame.viewProj * vec4f(tail, 1.0);
  if (ch.w < 0.05 || ct.w < 0.05) { return cull(); }
  let sh = ch.xy / ch.w * half; let st = ct.xy / ct.w * half;
  let pxPerM = half.y / (frame.post.w * ch.w);
  let u = clamp(p.age / p.life, 0.0, 1.0);
  let halfW = max(0.5 * p.size * (1.0 + 0.6 * u) * pxPerM, 1.5);
  let d = sh - st; let L = length(d);
  let dir = select(vec2f(1.0, 0.0), d / max(L, 1e-6), L > 1e-4); let nrm = vec2f(-dir.y, dir.x);
  let a = mix(-halfW, L + halfW, cx); let b = mix(-halfW, halfW, cy);
  let spx = st + dir * a + nrm * b;
  let zw = mix(vec2f(ct.z, ct.w), vec2f(ch.z, ch.w), cx);
  var o: VOut;
  o.pos = vec4f(spx / half * zw.y, zw.x, zw.y);
  o.shade = p.shade;
  o.loc = vec2f(a, b);
  o.prm = vec4f(L, halfW, 2.25, pxPerM);   // (.w: a wisp covers what it covers — the slot carries its pixels to the metre, for the motes)
  let env = smoothstep(0.0, WISP_FADE_IN, p.age) * smoothstep(0.0, WISP_FADE_OUT, p.life - p.age);
  o.prm2 = vec4f(1.0, WISP_SOFT_M, max(em.rainCfgC.z, 0.0) * env * (0.5 + h2), f32(p.color >> 24u) + 0.001 + 0.998 * h1);   // (.w: the look byte — motes × 16 + glint, sixteenths — over the wisp's seed in the fraction)
  o.zlin = distance(frame.camPos, mix(tail, head, cx));
  return o;
}
/** A GRAIN of blown snow (game/snowFx.ts SNOWGRAINS; particles.wgsl grainStep moves and lights it): the flake's own soft dot, far smaller — a dash a shutter long
 *  along its motion (a dot in calm air), never wider on screen than GRAIN_MAX_PX nor thinner than GRAIN_MIN_PX (thinner: drawn that wide, dimmed by as much). Nothing
 *  drawn while it lies (spin < 0). Its light is the step's (shade) × what the step says shows of it this frame (omgZ: weight × fade × the radius' rim). Mode 4:
 *  the flake's fragment, to the letter. */
fn grainVertex(p: Particle, cx: f32, cy: f32) -> VOut {
  let show = bitcast<f32>(p.omgZ);
  if (p.spin < 0.0 || !(show > 0.002)) { return cull(); }
  let half = frame.screen * 0.5;
  // (the maintainer on his GPU, 10-15: "the long wisps do look like a stretched particle" — a grain drawn along 1∕45 s of its flight was a 10‥20 cm line, every one
  // the same way. Now: a short shutter, the dash never longer than a few of its own widths, its tail fading — a grain with a little motion in it, not a line)
  let shutter = f32(p.color & 4095u) * (1.0 / 4096.0); let dashK = f32((p.color >> 12u) & 255u) * (1.0 / 16.0); let tailK = f32((p.color >> 20u) & 255u) * (1.0 / 255.0);
  let head = p.pos; let tail = p.pos - p.vel * min(shutter, max(p.age - p.spin, 0.0));
  let ch = frame.viewProj * vec4f(head, 1.0); let ct = frame.viewProj * vec4f(tail, 1.0);
  if (ch.w < 0.05 || ct.w < 0.05) { return cull(); }
  let sh = ch.xy / ch.w * half; let st = ct.xy / ct.w * half;
  let pxPerM = half.y / (frame.post.w * ch.w);
  let wTrue = p.size * pxPerM;
  let halfW = clamp(0.5 * wTrue, GRAIN_MIN_PX, GRAIN_MAX_PX);
  let coverage = min(1.5, wTrue / (2.0 * halfW));
  let d = sh - st; let L0 = length(d);
  let dir = select(vec2f(1.0, 0.0), d / max(L0, 1e-6), L0 > 1e-4); let nrm = vec2f(-dir.y, dir.x);
  let L = min(L0, dashK * 2.0 * halfW);   // (the dash is cut from its tail end: the head is where the grain is)
  let ext = halfW + 0.75;
  let a = mix(-ext, L + ext, cx); let b = mix(-ext, ext, cy);
  let spx = sh - dir * L + dir * a + nrm * b;
  let zw = mix(vec2f(ct.z, ct.w), vec2f(ch.z, ch.w), cx);
  var o: VOut;
  o.pos = vec4f(spx / half * zw.y, zw.x, zw.y);
  o.shade = p.shade * show;
  o.loc = vec2f(a, b);
  o.prm = vec4f(L, halfW, 4.0, coverage);
  let F6 = em.rainCfgF;
  o.prm2 = vec4f(smoothstep(0.35 * F6.z, F6.z, min(ch.w, ct.w)), 0.05, 2.0 + tailK, 1.0);   // (.z over 1.5 = a grain, + how far its tail fades: a streak's own .zw is its axis, each within ±1 — rainFragment)
  o.zlin = distance(frame.camPos, mix(tail, head, cx));
  return o;
}
/** a smooth 1-D value noise 0‥1 (the wisp's strands and clumps) */
fn wispN1(x: f32, k: f32) -> f32 { let i = floor(x); let f = x - i; let t = f * f * (3.0 - 2.0 * f); return mix(rainHash(i, k), rainHash(i + 1.0, k), t); }
/** v2 REFRACTION through the SHARED module (refract_common.wgsl — the solid-glass lane's, copied verbatim: fresnelSchlick / refractDir / beerLambert / screenRefractPx / clampRefractOffset;
 *  prepended to this splat): the streak is a thin WATER CYLINDER along its world axis T. At across-position x ∈ [−1, 1] its visible normal is N = A·x + Vp·√(1 − x²) (A = across, Vp =
 *  toward the eye, both ⊥ T); the eye ray refracts in (η 1 / 1.333), crosses the circular section — the cylinder's chord: it leaves where the section's outward normal is N mirrored about
 *  the internal ray's cross-section direction (a circle cannot hold a ray past the critical angle, so refractDir's mirrored fallback never fires here; were it to, the mirrored ray is
 *  taken as it is) — refracts out (η 1.333), and the exit ray is followed `probe` metres (the scene depth behind the pixel less the drop's own, capped at rainCfgC.y: the module's
 *  plane probe wants the g-buffer normal, which this splat does not bind) and projected onto THIS raster with its own matrix (screenRefractPx: frame.viewProj of the block bound here —
 *  jittered on the internal raster, unjittered on the sharp-direct output raster this splat runs at under sharp, either way what worldFromDepth inverts); the offset takes the module's
 *  screen guards (clampRefractOffset, capped at 0.12 × the frame's height as the glass does), and the refusals stay here as the module asks: a read that lands on something NEARER
 *  the eye than the drop by rainCfgC.w, or on the sky, keeps the pixel's own read c0 — AND (the rain's own third refusal) a read that lands UNDER A ROOF (particles_common.wgsl
 *  rainRoofed: inside the interior / annex footprint below the ceiling): the top-down camera looks straight through the NoPrimary roof, so a lit corridor floor sits a few pixels
 *  beside the drops outside its wall on screen with wall and slab between them in the world — screen space has no idea, and the drops by the exit sign came up green (the maintainer,
 *  08-12). Rain is only ever outdoors, so nothing indoors is behind a drop. × the two Fresnel transmissions (F0 0.02, both interfaces — no legacy look to hold); the drop's
 *  millimetre of water absorbs nothing (beerLambert of a clear tint ≡ 1, left out). Each fetch's display luminance held under rainCfgC.z (an emitter's face must not become a white
 *  needle). A DISPLACED READ KEEPS ITS LIGHT AND LOSES THE PICTURE (`keep` = rainCfgC.x's packed 0‥1, 1 = the fetch as it was): a tap was one FIXED offset per streak, so a streak
 *  whose side tap landed on a red stripe was red along its whole length and the next one cream — rain beside a striped tent came up as a displaced picture of the tent, loudest over
 *  dark floor far behind the streak (the probe at its reach, the offset on its cap: one large offset for every streak there) (the maintainer, 10-12: 'weird effect of red and white
 *  stripes on rain'). Three things, each × (1 − keep): the offset's LENGTH is jittered per pixel and frame (a falling drop images a wide fan of what is behind it, so each pixel of
 *  the streak reads another part of it and no picture survives); a fetch more than a few thousandths of the frame's height off the streak hands over its LUMINANCE in `hue`
 *  (luminance 1: what is straight behind where that has light, else the light on the drop), never its own colour; and that luminance is pulled half way to the pixel's own. A tap
 *  that lands on the pixel itself (x = 0, the 3-tap set's) has no offset and is untouched — a streak still shows what is straight behind it.
 *  Returns rgb = transmitted radiance, w = 1 (a tap always counts). */
fn rainRefractTap(x: f32, Pw: vec3f, ray: vec3f, T: vec3f, A: vec3f, Vp: vec3f, probe: f32, zp: f32, c0: vec3f, pixf: vec2f, dims: vec2f, hue: vec3f, keep: f32) -> vec4f {
  let RC = em.rainCfgC;
  let N = normalize(A * x + Vp * sqrt(max(1.0 - x * x, 0.0)));
  let r1 = refractDir(ray, N, 1.0 / 1.333).xyz;
  var rp = r1 - T * dot(r1, T); let rl = length(rp); rp = select(-N, rp / rl, rl > 1e-5);   // the internal ray's direction across the section
  let N2 = normalize(N - rp * (2.0 * dot(rp, N)));                                        // outward normal where the chord leaves the circle (N mirrored about that direction)
  let r2 = refractDir(r1, -N2, 1.333).xyz;
  let tr = (1.0 - fresnelSchlick(-dot(N, ray), 0.02)) * (1.0 - fresnelSchlick(max(dot(N2, r2), 0.0), 0.02));
  let sp = screenRefractPx(Pw, r2, probe, frame.viewProj, dims);
  var c = c0;
  if (sp.z > 0.0) {
    var o = clampRefractOffset(pixf, sp.xy - pixf, 0.12 * dims.y, dims);
    o *= mix(1.0, mix(0.2, 1.0, fract(ign(pixf) + frame.time * 7.31 + x * 3.7)), 1.0 - keep);   // per pixel of the streak: a drop images a wide fan, so each pixel reads another part of it
    let q = pixf + o;
    let qi = vec2i(clamp(q, vec2f(0.5), dims - 0.5));
    let dep = textureLoad(gDepth, qi, 0);
    if (dep < 1.0) {
      let Wq = worldFromDepth(vec2f(qi) + 0.5, dep);                                        // what the raster shows there, in the world
      if (distance(Wq, frame.camPos) >= zp - RC.w && !rainRoofed(Wq)) {                     // (the three refusals: nearer than the drop, the sky, or INDOORS behind the roofless raster → the pixel's own read)
        c = textureSampleLevel(sceneTex, sceneSamp, q / dims, 0.0).xyz;
        c = mix(c, hue * mix(luminance(c), luminance(c0), 0.5), smoothstep(0.002, 0.008, length(o) / dims.y) * (1.0 - keep));
      }
    }
  }
  let lum = luminance(c) * frame.exposure;
  if (lum > RC.z) { c *= RC.z / lum; }
  return vec4f(c * tr, 1.0);
}
/** The rain fragment: depth-softened against the scene and fogged like every splat. The light the drop SCATTERS toward the eye (v.shade, head → tail) is ADDITIVE — a clear drop hides
 *  next to nothing, and the lattice adds its streaks the same way; v2 adds what the drop REFRACTS: a drop is a lens that images a wide cone of the scene BEHIND it, so the streak's own
 *  coverage (× the refraction's share = rainCfgC.x's part under 2, × water's transmission) REPLACES the background with the mean of 2‥4 taps of the composite's copy taken rainCfgC.y px off the streak's line (across it, and
 *  along it) — over an even field the streak vanishes into it, beside the lamp's pool it carries the pool's light out over the dark asphalt (its LIGHT: a tap taken beside the streak
 *  is handed over without the surface's colour and at a scattered offset, rainRefractTap), in front of a lit window it shows the room.
 *  Premultiplied 'over' for that share (the blend is one / one-minus-src-alpha), the scatter on top. REACTIVE by what actually changed on screen: the scatter's display luminance + the
 *  refracted share's difference from what was there, × k0.z — so the TAA takes the streak from this frame instead of a tenth of it trailing ten frames, and leaves an invisible one be. */
fn rainFragment(v: VOut) -> FOut {
  var fo: FOut;
  let mode = v.prm.z; let k0 = em.kp[P_RAIN * 2u];
  // scene depth vs the particle's own distance (as fs())
  let pix = vec2i(v.pos.xy);
  let dep = textureLoad(gDepth, pix, 0);
  var zs = 1e6;
  if (dep < 1.0) {
    let Pend = worldFromDepth(v.pos.xy, dep);
    if (snowNow()) { if (flakeHidden(Pend)) { discard; } }   // (snow: the surface is UNDER a roof, not merely inside its rectangle — a wall's outer face and its top take the snow that falls in front of them: particles_common.wgsl flakeHidden)
    else if (RAIN_WALLS && rainOverWall(Pend)) { }   // (RAIN_WALLS: a wall's outer face, the door in it and the wall's top take the rain that falls in front of them — common.wgsl wxUnderRoof)
    else if (!rainOutdoors(Pend.xz)) { discard; }   // the lattice's readability rule, kept: a pixel whose surface is INDOORS shows no rain, even the outdoor drops the ray meets over the roof line on its way — the rooms stay dry to the eye
    zs = distance(Pend, frame.camPos);
  }
  let softR = v.prm2.y;
  let soft = clamp((zs - v.zlin + softR) / softR, 0.0, 1.0);
  if (soft <= 0.0) { discard; }
  // haze / smoke in front of it (as fs())
  var tp = 1.0;
  if ((em.flags & 4u) != 0u) {
    let vdiv = max(1, i32(frame.lossyCfg.y)); let vd = vec2i(textureDimensions(volTex));
    var pv = pix / vdiv; if (frame.sharpCfg.z > 0.0) { pv = vec2i((vec2f(pix) + 0.5) * (frame.sharpCfg.xy / frame.screen) + frame.sharpCfgC.xy) / vdiv; }
    let vol = textureLoad(volTex, clamp(pv, vec2i(0), vd - 1), 0);
    let frc = clamp(v.zlin / max(zs, 1e-3), 0.0, 1.0);
    tp = pow(max(vol.a, 1e-4), frc);
    if ((frame.flags & FLAG_FROXEL_VOL) != 0u) { tp *= froxelFetch(froxTex, v.pos.xy * frame.invScreen, v.zlin).a; }
  }
  var w = 0.0; var cov = 0.0;
  if (mode < 4.5) {   // the streak: the capsule's 1-px antialiased profile, its coverage (thin → dim), a touch brighter toward the head (mean 0.95; v2: the head / tail LIGHT now does most of what v1's 0.45 → 1.15 ramp stood in for)
    let L = v.prm.x; let halfW = v.prm.y;
    let d = length(vec2f(v.loc.x - clamp(v.loc.x, 0.0, L), v.loc.y));
    var prof = clamp(halfW + 0.5 - d, 0.0, 1.0); if (prof <= 0.0) { discard; }
    if (snowNow()) { let r = clamp(1.0 - d / (halfW + 0.5), 0.0, 1.0); prof = r * r * (3.0 - 2.0 * r) * 1.6; }   // a FLAKE (a level built for snow): soft from its centre out, not a hard-edged dot — the same light over the disc (∫ ≈ the capsule's)
    cov = prof * v.prm.w;
    w = cov * mix(0.75, 1.15, clamp(v.loc.x / max(L, 1.0), 0.0, 1.0));
    if (SNOW_GRAINS) { if (v.prm2.z > 1.5) { let tk = clamp(v.prm2.z - 2.0, 0.0, 1.0); let u = clamp(v.loc.x / max(L, 1.0), 0.0, 1.0); w = cov * 1.15 * mix(1.0 - tk, 1.0, u * u); } }   // a GRAIN (grainVertex): its tail fades toward nothing, its head is the grain
    let beadA = clamp(em.rainCfgF.w, 0.0, 1.0);                        // v2 BEADS: a big drop oscillates as it falls, so its streak beats bright-dim along its length (phase + 3‥6 beats per drop off the mode's fraction; mean 1)
    if (beadA > 0.0) { let hb = clamp((mode - 4.0) / 0.49, 0.0, 1.0); let cyc = mix(2.5, 6.0, fract(hb * 7.31)); w *= 1.0 + beadA * sin(6.2831853 * (cyc * v.loc.x / max(L, 1.0) + hb)); }
  } else {            // the crown: a ring running out at 0.3 m/s for its first 60 ms (the lattice's splash) + droplets hopping outward, each a short trail, all fading with the splash
    let tau = v.prm.x; let R = v.prm.y; let seed = v.prm2.z; let mpp = max(v.prm2.w, 1e-4);
    let q = v.loc;
    let ringR = 0.006 + tau * 0.3;
    let ringW = max(0.004, mpp);
    if (tau < 0.08) { w += (1.0 - smoothstep(0.0, ringW, abs(length(q) - ringR))) * (1.0 - tau / 0.08) * 1.6; }
    let dotR = max(0.0035, 0.75 * mpp);
    for (var i = 0u; i < RAIN_SPLASH_DROPLETS; i++) {
      let fi = f32(i);
      let az = rainHash(seed, fi) * 6.2831853; let spd = 0.22 + 0.33 * rainHash(seed, fi + 7.0); let life = 0.08 + 0.09 * rainHash(seed, fi + 13.0);   // secondary droplets: a few cm out over a tenth of a second (further, and a landing read as a printed glyph from the follow camera)
      if (tau > life) { continue; }
      let dirD = vec2f(cos(az), sin(az));
      let pa = dirD * (0.008 + spd * max(tau - 0.025, 0.0)); let pb = dirD * (0.008 + spd * tau);   // a 25 ms trail behind the droplet
      let ab = pb - pa; let t = clamp(dot(q - pa, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
      let dd = distance(q, pa + ab * t);
      let f = 1.0 - tau / life;
      w += (1.0 - smoothstep(dotR * 0.4, dotR, dd)) * f * f * 1.7 * min(1.0, R / 0.06);
    }
    if (w <= 0.0) { discard; }
  }
  let rad = v.shade * (w * soft * v.prm2.x * tp);
  // v2: what the streak REFRACTS of the scene behind it, through the shared refraction module (streaks only; the composite's copy is this pass's own raster — the internal one, or the OUTPUT one
  // under sharp direct, where this splat runs at the output size against the output depth with the output frame block — so v.pos.xy indexes it directly and frame.viewProj is its matrix)
  let RC = em.rainCfgC; var refr = vec3f(0.0); var refrA = 0.0; var dLum = 0.0;
  let refrOn = RC.x - 2.0 * floor(RC.x * 0.5);                           // (rainCfgC.x = the refraction's share 0‥1 + 2 × round(100 × how much of a displaced read's own colour is kept))
  if (mode < 4.5 && refrOn > 0.0 && cov > 0.0) {
    let keep = clamp(floor(RC.x * 0.5) * 0.01, 0.0, 1.0);
    let dims = vec2f(textureDimensions(sceneTex));
    let c0 = textureSampleLevel(sceneTex, sceneSamp, v.pos.xy / dims, 0.0).xyz;
    // the colour a displaced read is handed over in, at luminance 1: what is straight behind the streak where that has light (over an even field, coloured or not, the streak still
    // vanishes into it), else the light on the drop, half way to white (a beacon's pure red must not paint a white pool red; an unlit drop's is white)
    let hs = v.shade + vec3f(0.02 / max(frame.exposure, 1e-4));
    let l0 = luminance(c0);
    let hue = mix(mix(vec3f(1.0), hs / max(luminance(hs), 1e-6), 0.5), c0 / max(l0, 1e-6), smoothstep(0.01, 0.05, l0 * frame.exposure));
    // the water cylinder in the world: this pixel's point on the streak (along the pixel's ray at the streak's distance), the streak's axis T off the vertex, across A, toward-the-eye Vp
    let ray = normalize(worldFromDepth(v.pos.xy, 0.5) - frame.camPos);
    let Pw = frame.camPos + ray * v.zlin;
    let te = v.prm2.zw; var T = vec3f(te.x, 1.0 - abs(te.x) - abs(te.y), te.y);
    if (T.y < 0.0) { let tf = (1.0 - abs(T.zx)) * select(vec2f(-1.0), vec2f(1.0), T.xz >= vec2f(0.0)); T = vec3f(tf.x, T.y, tf.y); }
    T = normalize(T);
    var A = cross(T, -ray); let al = length(A); A = select(vec3f(1.0, 0.0, 0.0), A / al, al > 1e-4);
    let Vp = normalize(cross(A, T));                                     // (⊥ T, on the eye's side: dot(Vp, ray) < 0)
    let probe = clamp(zs - v.zlin, 0.25, max(RC.y, 0.25));              // how far behind the drop the scene lies along the view (capped: rainCfgC.y m)
    let taps = u32(clamp(floor(em.rainCfgD.z / 16.0), 2.0, 4.0));
    var sum: vec4f;
    if (taps == 3u) { sum = rainRefractTap(-0.7, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep) + rainRefractTap(0.0, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep) + rainRefractTap(0.7, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep); }
    else {
      let xo = select(0.55, 0.8, taps > 3u);
      sum = rainRefractTap(-xo, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep) + rainRefractTap(xo, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep);
      if (taps > 3u) { sum += rainRefractTap(-0.3, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep) + rainRefractTap(0.3, Pw, ray, T, A, Vp, probe, v.zlin, c0, v.pos.xy, dims, hue, keep); }
    }
    refr = sum.xyz / sum.w;                                              // (the two Fresnel transmissions are inside each tap: what the drop reflects instead is the glints' business)
    refrA = clamp(refrOn, 0.0, 1.0) * min(cov, 1.0) * soft * v.prm2.x;    // the streak's coverage 'over' the background × the same soft / fade the scatter takes
    dLum = luminance(abs(refr - c0)) * refrA;                            // (how much this actually changes the pixel — an invisible streak asks nothing of the TAA)
  }
  fo.color = vec4f(refr * refrA + rad, refrA);
  fo.react = vec4f(clamp((luminance(rad) + dLum) * frame.exposure * k0.z, 0.0, 1.0), 0.0, 0.0, 0.0);
  return fo;
}

// ================================================================== the glass shard (particles.wgsl shardAir / shardLight fly and light it; game/shards.ts files them)
fn shardHash(s: u32, k: u32) -> f32 { var x = s ^ (k * 0x9E3779B9u); x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return f32(x >> 8u) / 16777216.0; }
/** The glass fragment. OUTLINE: the quad with each corner cut by a chord at a hashed angle and depth — an irregular four- to eight-sided sliver, the same every frame for
 *  one fragment, antialiased over a pixel. LOOK: glass hides almost nothing — the face takes SHARD_BODY_A of what is behind it ('over' with nearly no colour of its own), the
 *  cut edge SHARD_RIM_A — and ADDS what the kernel found it sends to the eye (v.shade: the mirrored lights, the room by Fresnel, the body's scatter), the rim a little more
 *  of it (the light inside the glass leaves by the edge). Against a lit floor a dull fragment is a faint dark outline; one that finds a lamp flashes. Depth-softened and
 *  fogged like every splat. REACTIVE by what shows: its coverage or its glint's display luminance in the air, a fraction of that at rest. */
fn shardFragment(v: VOut, fw: vec2f) -> FOut {
  var fo: FOut;
  let sd = u32(v.prm.x);
  let f = max(fw, vec2f(1e-4));
  var epx = min((1.0 - abs(v.loc.x)) / f.x, (1.0 - abs(v.loc.y)) / f.y);   // px to the nearest edge of the outline, inside positive
  for (var k = 0u; k < 4u; k++) {
    let sg = vec2f(select(-1.0, 1.0, (k & 1u) != 0u), select(-1.0, 1.0, (k & 2u) != 0u));
    let th = 0.35 + 0.87 * shardHash(sd, k * 2u + 1u);                    // the chord's normal, 20°‥70° off the corner's x edge
    let dk = vec2f(cos(th), sin(th)) * sg;
    let ck = (cos(th) + sin(th)) * (0.5 + 0.5 * shardHash(sd, k * 2u + 2u));   // how deep it cuts (1 = just the corner point)
    epx = min(epx, (ck - dot(v.loc, dk)) / (abs(dk.x) * f.x + abs(dk.y) * f.y));
  }
  let prof = clamp(epx + 0.5, 0.0, 1.0); if (prof <= 0.0) { discard; }
  let rim = 1.0 - smoothstep(0.0, max(1.0, 0.22 / max(f.x, f.y)), epx);   // the cut edge: about a fifth of the half-width in, never under a pixel
  // scene depth vs the fragment's own distance (as fs(): one lying ON the floor shows whole)
  let pix = vec2i(v.pos.xy);
  let dep = textureLoad(gDepth, pix, 0);
  var zs = 1e6;
  if (dep < 1.0) { zs = distance(worldFromDepth(v.pos.xy, dep), frame.camPos); }
  let zp = v.zlin; let softR = v.prm2.y;
  let soft = clamp((zs - zp + softR) / softR, 0.0, 1.0);
  if (soft <= 0.0) { discard; }
  var tp = 1.0; var insc = vec3f(0.0);
  if ((em.flags & 4u) != 0u) {
    let vdiv = max(1, i32(frame.lossyCfg.y)); let vd = vec2i(textureDimensions(volTex));
    var pv = pix / vdiv; if (frame.sharpCfg.z > 0.0) { pv = vec2i((vec2f(pix) + 0.5) * (frame.sharpCfg.xy / frame.screen) + frame.sharpCfgC.xy) / vdiv; }
    let vol = textureLoad(volTex, clamp(pv, vec2i(0), vd - 1), 0);
    let frc = clamp(zp / max(zs, 1e-3), 0.0, 1.0);
    tp = pow(max(vol.a, 1e-4), frc); insc = vol.rgb * frc;
    if ((frame.flags & FLAG_FROXEL_VOL) != 0u) { let hz = froxelFetch(froxTex, v.pos.xy * frame.invScreen, zp); insc += hz.rgb * tp; tp *= hz.a; }
  }
  // (round five) a resting drift is a soft heap, not a cut shape: it thins toward its edge, brightest in the middle, darker where the cubes shade the floor between them
  let frost = floor(v.prm2.w) / 255.0; let heap = frost * fract(v.prm2.w) / 0.99;
  let rr = length(v.loc);
  let k = prof * soft * v.prm2.x * mix(1.0, smoothstep(1.15, 0.7, rr), heap);
  let aBody = mix(mix(SHARD_BODY_A, SHARD_RIM_A, rim), SHARD_REST_BODY_A, frost) * k * v.prm.y;   // (resting, frosted glass hides the floor it lies on)
  // (a frost's light is its body's, not a glint's: it takes the AREA coverage, and its edge is the darker part (SHARD_REST_EDGE → SHARD_REST_MID inward) — a far-off sub-pixel drift must not out-shine paper)
  let rad = v.shade * (mix(1.0 + SHARD_RIM_GAIN * rim, mix(SHARD_REST_EDGE, SHARD_REST_MID, smoothstep(0.95, 0.25, rr)), heap) * k * mix(v.prm.w, v.prm.y, frost) * tp);
  fo.color = vec4f(rad + insc * aBody, aBody);                             // premultiplied: the glint adds, the body is a thin 'over'
  fo.react = vec4f(clamp(max(aBody, luminance(rad) * frame.exposure * 4.0) * v.prm2.z, 0.0, 1.0), 0.0, 0.0, 0.0);
  return fo;
}
