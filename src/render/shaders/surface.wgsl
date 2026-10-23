// SURFACES — A TRY, NOT THE LOOK (the prelude's SURF_TRY, render/frame.ts surfTryConfig; `?surf` at boot raises it. False = nothing below is reached and
// fsBox stores exactly what it always stored). STYLE.md says one colour and one finish a box and nothing painted on. This asks what the same boxes look like
// when a paint is a MATERIAL: its colour broken up the way that stuff is, a relief that turns the shading normal, a finish that follows both. No image, no
// binding, no UVs: every term is a function of the world position on the face (wood and sheet metal: of the box's own), band-limited against the pixel's
// footprint, so it costs no download and needs nothing from the level file. The paint says what the stuff is, as it does to a round and a blast
// (scene/gwotPalette.ts); render/gbuffer.ts surfaceWgsl() writes surfClass() from that palette.
// WHAT READS IT: the g-buffer only. The direct light, the bounce at the pixel and the reflections answer to the stored albedo / normal / roughness by
// themselves; no ray, no cache and no light meter ever sees any of this (a ray that HITS the box still meets one flat colour), so nothing a man senses moves.
// KNOWN GAPS (it is a try): cut pieces draw plain (gbuffer_cut.wgsl is not asked), wet ground draws plain (the storm darkens its paint in place: no palette
// colour any more), a fully turned box draws plain, and the relief is held under SURF_TILT so that no read of the bounce changes its rule
// (lighting_common.wgsl bounceLeftNoWall's 0.98).
const SURF_NONE: u32 = 0u;
const SURF_MUD: u32 = 1u;       // hand-laid mud plaster: the wall is no plane, the hand shows, it cracks, its foot is eaten
const SURF_PLASTER: u32 = 2u;   // lime render / whitewash: flatter, trowelled, hairline cracks, runs under the top
const SURF_BLOCK: u32 = 3u;     // concrete block in running bond: joints you can count
const SURF_EARTH: u32 = 4u;     // trodden earth: swells, clods, grit, a stone here and there
const SURF_GRAVEL: u32 = 5u;    // gravel: a pebble a hand's width
const SURF_SLAB: u32 = 6u;      // poured slab: bays with joints, stains, a crack
const SURF_WOOD: u32 = 7u;      // boards along the long side
const SURF_SHEET: u32 = 8u;     // corrugated sheet along the long side
const SURF_TILT: f32 = 0.18;    // the steepest slope the relief may give the normal (about ten degrees)
const SURF_RELIEF: f32 = 1.0;   // × every height
const SURF_PAINT: f32 = 1.0;    // × every colour term

/** how much of a feature `size` metres across a pixel `fp` metres wide can still carry: 1 from three pixels up, 0 at one */
fn surfFade(size: f32, fp: f32) -> f32 { return clamp(size / (2.0 * max(fp, 1e-5)) - 0.5, 0.0, 1.0); }
/** a line `half` metres to each side, `d` metres away, as the share of the pixel it covers (a hairline thinner than a pixel dims, it does not widen) */
fn surfLine(d: f32, half: f32, fp: f32) -> f32 { return clamp((half - d) / max(fp, 1e-5) + 0.5, 0.0, 1.0) * min(1.0, 2.0 * half / max(fp, 1e-5) + 0.15); }
/** cells: (distance to the nearest site, distance to the edge between the two nearest, the nearest site's own number), in cell units */
fn surfCells(p: vec2f) -> vec3f {
  let fl = floor(p); let ip = vec2i(fl); let f = p - fl;
  var d1 = 9.0; var d2 = 9.0; var id = 0.0;
  for (var j = -1; j <= 1; j++) { for (var i = -1; i <= 1; i++) {
    let c = ip + vec2i(i, j);
    let r = vec2f(f32(i), f32(j)) + vec2f(detailHash(c), detailHash(c + vec2i(977, 131))) - f; let d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = detailHash(c + vec2i(53, 719)); } else if (d < d2) { d2 = d; }
  } }
  return vec3f(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
fn surfN(p: vec2f) -> f32 { return detailNoise(p) - 0.5; }

struct SurfS { h: f32, a: f32, r: f32 };   // height (m), × the paint, + roughness
/** one material at one point of its face. uv in metres (a wall: along it and up; the ground: world x, z; wood and sheet: along the long side, across it).
 *  y = metres above the ground for a standing face, −1 for a lying one. */
fn surfSample(cls: u32, uv: vec2f, y: f32, fp: f32) -> SurfS {
  var s: SurfS; s.h = 0.0; s.a = 1.0; s.r = 0.0;
  if (cls == SURF_MUD) {
    let big = surfN(uv * (1.0 / 0.55)); let hand = surfN(vec2f(uv.x * (1.0 / 0.22), uv.y * (1.0 / 0.07)) + vec2f(7.3, 1.9));
    let grit = surfN(uv * (1.0 / 0.018) + vec2f(3.1, 8.7)) * surfFade(0.018, fp);
    let c = surfCells(uv * (1.0 / 0.42) + vec2f(0.6 * big));
    let crack = surfLine(c.y * 0.42, 0.003, fp) * smoothstep(0.02, 0.2, surfN(uv * (1.0 / 1.3) + vec2f(20.0, 4.0)));
    let foot = select(0.0, 1.0 - smoothstep(0.04, 0.34 + 0.3 * big, y), y >= 0.0);   // rain splash eats the foot of a mud wall
    s.h = 0.010 * big + 0.0035 * hand + 0.0012 * grit - 0.004 * crack - 0.006 * foot * (0.5 + hand);
    s.a = (1.0 + 0.2 * big + 0.09 * hand + 0.12 * grit) * (1.0 - 0.45 * crack) * (1.0 - 0.2 * foot);
  } else if (cls == SURF_PLASTER) {
    let big = surfN(uv * (1.0 / 0.4)); let trowel = surfN(vec2f(uv.x * (1.0 / 0.12), uv.y * (1.0 / 0.05)) + vec2f(2.2, 9.1));
    let c = surfCells(uv * (1.0 / 0.7) + vec2f(0.5 * big));
    let crack = surfLine(c.y * 0.7, 0.0012, fp) * smoothstep(0.08, 0.25, surfN(uv * (1.0 / 1.7) + vec2f(31.0, 12.0)));
    let run = select(0.0, max(surfN(vec2f(uv.x * (1.0 / 0.09), uv.y * (1.0 / 1.6)) + vec2f(5.0, 0.0)), 0.0) * smoothstep(0.3, 2.2, y), y >= 0.0);   // runs under the top of a wall
    let foot = select(0.0, 1.0 - smoothstep(0.03, 0.22 + 0.2 * big, y), y >= 0.0);
    s.h = 0.004 * big + 0.0015 * trowel - 0.002 * crack;
    s.a = (1.0 + 0.08 * big + 0.04 * trowel - 0.3 * run) * (1.0 - 0.4 * crack) * (1.0 - 0.14 * foot);
    s.r = 0.06 * run;
  } else if (cls == SURF_BLOCK) {
    let row = floor(uv.y * (1.0 / 0.2)); let u = uv.x + 0.2 * (row - 2.0 * floor(row * 0.5));
    let bu = u - 0.4 * floor(u * (1.0 / 0.4)); let bv = uv.y - 0.2 * row;
    let joint = surfLine(min(min(bu, 0.4 - bu), min(bv, 0.2 - bv)), 0.005, fp);
    let one = detailHash(vec2i(i32(floor(u * (1.0 / 0.4))), i32(row))) - 0.5;   // no two blocks are one batch
    let pit = surfN(uv * (1.0 / 0.03) + vec2f(1.7, 6.3)) * surfFade(0.03, fp);
    s.h = -0.004 * joint + 0.0012 * pit;
    s.a = (1.0 + 0.16 * one * surfFade(0.2, fp) + 0.07 * surfN(uv * (1.0 / 0.9)) + 0.05 * pit) * (1.0 - 0.25 * joint);
  } else if (cls == SURF_EARTH) {
    let q = vec2f(0.8776 * uv.x - 0.4794 * uv.y, 0.4794 * uv.x + 0.8776 * uv.y);   // (turned off the level's grid, as the wet ground's pools are)
    let swell = surfN(q * (1.0 / 1.7)); let blotch = surfN(q * (1.0 / 2.9) + vec2f(13.0, 7.0)); let clod = surfN(q * (1.0 / 0.17) + vec2f(5.0, 2.0));
    let grit = surfN(q * (1.0 / 0.024) + vec2f(9.0, 4.0)) * surfFade(0.024, fp);
    let c = surfCells(q * (1.0 / 0.23));
    let rad = select(0.0, 0.05 + 0.13 * fract(c.z * 17.0), c.z > 0.7);   // a stone on three sites in ten, 1 to 4 cm across (cell units)
    let dome = max(1.0 - (c.x * c.x) / max(rad * rad, 1e-4), 0.0) * select(0.0, 1.0, rad > 0.0) * surfFade(rad * 0.46, fp);
    s.h = 0.018 * swell + 0.006 * clod + 0.0015 * grit + 0.5 * rad * 0.23 * dome;
    s.a = (1.0 + 0.26 * blotch + 0.12 * swell + 0.12 * clod + 0.1 * grit) * (1.0 + 0.45 * min(dome * 2.0, 1.0));
  } else if (cls == SURF_GRAVEL) {
    let k = surfFade(0.045, fp);
    let c = surfCells(uv * (1.0 / 0.045));
    let dome = max(1.0 - c.x * c.x * (1.0 / 0.36), 0.0);
    let wide = surfN(uv * (1.0 / 1.4)); let mid = surfN(uv * (1.0 / 0.19) + vec2f(4.0, 9.0));
    s.h = 0.011 * dome * k + 0.008 * wide;
    s.a = (1.0 + 0.5 * (c.z - 0.5) * k + 0.16 * wide + 0.14 * mid) * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.14, c.y)) * k);
  } else if (cls == SURF_SLAB) {
    let bu = uv.x - 3.0 * floor(uv.x * (1.0 / 3.0)); let bv = uv.y - 3.0 * floor(uv.y * (1.0 / 3.0));
    let joint = surfLine(min(min(bu, 3.0 - bu), min(bv, 3.0 - bv)), 0.006, fp);
    let stain = surfN(uv * (1.0 / 1.2) + vec2f(8.0, 3.0)); let mid = surfN(uv * (1.0 / 0.22) + vec2f(2.0, 5.0));
    let c = surfCells(uv * (1.0 / 1.9) + vec2f(0.4 * stain));
    let crack = surfLine(c.y * 1.9, 0.002, fp) * smoothstep(0.1, 0.3, surfN(uv * (1.0 / 4.0) + vec2f(40.0, 2.0)));
    let bay = detailHash(vec2i(i32(floor(uv.x * (1.0 / 3.0))), i32(floor(uv.y * (1.0 / 3.0))))) - 0.5;   // each bay was poured on its own day
    s.h = -0.005 * joint + 0.002 * mid - 0.003 * crack;
    s.a = (1.0 + 0.18 * stain + 0.07 * mid + 0.1 * bay) * (1.0 - 0.4 * joint) * (1.0 - 0.4 * crack);
    s.r = -0.08 * max(stain, 0.0);
  } else if (cls == SURF_WOOD) {
    let pid = floor(uv.y * (1.0 / 0.11)); let pv = uv.y - 0.11 * pid;
    let gap = surfLine(min(pv, 0.11 - pv), 0.0015, fp);
    let one = detailHash(vec2i(i32(pid), 7)) - 0.5;
    let grain = surfN(vec2f(uv.x * (1.0 / 0.3) + one * 40.0, uv.y * (1.0 / 0.011))) * surfFade(0.011, fp);
    let figure = surfN(vec2f(uv.x * (1.0 / 0.6) + one * 17.0, uv.y * (1.0 / 0.045)));
    s.h = -0.003 * gap + 0.0007 * grain;
    s.a = (1.0 + 0.2 * one * surfFade(0.11, fp) + 0.12 * figure + 0.14 * grain) * (1.0 - 0.45 * gap);
    s.r = 0.08 * figure;
  } else if (cls == SURF_SHEET) {
    let k = surfFade(0.038, fp);
    s.h = 0.009 * cos(uv.y * (6.2831853 / 0.076)) * k;
    let streak = surfN(vec2f(uv.x * (1.0 / 0.5), uv.y * (1.0 / 0.076)) + vec2f(3.0, 3.0));
    s.a = 1.0 + 0.12 * streak + 0.08 * surfN(uv * (1.0 / 0.4));
    s.r = 0.18 * max(streak, 0.0);
  }
  return s;
}

struct SurfOut { albedo: vec3f, n: vec3f, rough: f32 };
/** fsBox's call. `paint` = the box's own colour (what names the stuff), `albedoIn` = that colour as the wear left it. */
fn surfaceTry(wp: vec3f, n: vec3f, bi: u32, lc: vec3f, hf: vec4f, paint: vec3f, albedoIn: vec3f, roughIn: f32, fp: f32) -> SurfOut {
  var o: SurfOut; o.albedo = albedoIn; o.n = n; o.rough = roughIn;
  let cls = surfClass(paint);
  if (cls == SURF_NONE || hf.w < 0.0) { return o; }
  let b = boxGeo[bi];
  if ((b.flags & (BOX_EMISSIVE | BOX_ROT)) != 0u) { return o; }
  let lying = abs(n.y) > 0.9;
  if (!lying && abs(n.y) > 0.1) { return o; }
  var T: vec3f; var B: vec3f; var uv: vec2f; var y = -1.0;
  if (cls == SURF_WOOD || cls == SURF_SHEET) {   // the box's own: a door carries its boards round with it
    let ax = u32(hf.w + 0.5) / 2u; let q = boxRot(bi);
    var ea: vec3f; var eb: vec3f;
    if (ax == 0u) { ea = vec3f(0.0, 0.0, 1.0); eb = vec3f(0.0, 1.0, 0.0); } else if (ax == 1u) { ea = vec3f(1.0, 0.0, 0.0); eb = vec3f(0.0, 0.0, 1.0); } else { ea = vec3f(1.0, 0.0, 0.0); eb = vec3f(0.0, 1.0, 0.0); }
    if (dot(abs(eb), hf.xyz) > dot(abs(ea), hf.xyz)) { let t = ea; ea = eb; eb = t; }   // ea = the long side
    if (cls == SURF_SHEET && dot(abs(eb), hf.xyz) < 0.25) { return o; }               // a bucket is not a roof sheet
    uv = vec2f(dot(lc, ea), dot(lc, eb) + 0.37 * f32(bi % 7u));
    T = quatRotate(q, ea); B = quatRotate(q, eb);
  } else if (lying) { T = vec3f(1.0, 0.0, 0.0); B = vec3f(0.0, 0.0, 1.0); uv = wp.xz; }
  else { T = normalize(vec3f(-n.z, 0.0, n.x)); B = vec3f(0.0, 1.0, 0.0); uv = vec2f(dot(wp, T), wp.y); y = wp.y; }
  let e = max(fp * 0.75, 0.003);
  let s0 = surfSample(cls, uv, y, fp); let s1 = surfSample(cls, uv + vec2f(e, 0.0), y, fp); let s2 = surfSample(cls, uv + vec2f(0.0, e), y, fp);
  var g = vec2f(s1.h - s0.h, s2.h - s0.h) * (SURF_RELIEF / e);
  let gl = length(g); if (gl > SURF_TILT) { g *= SURF_TILT / gl; }
  o.n = normalize(n - g.x * T - g.y * B);
  o.albedo = albedoIn * clamp(1.0 + (s0.a - 1.0) * SURF_PAINT, 0.4, 1.7);
  o.rough = clamp(roughIn + s0.r, 0.05, 1.0);
  return o;
}
