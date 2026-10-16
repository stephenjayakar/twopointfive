// ---- smoke density at a point (smoke/smoke.ts + smoke.wgsl make the field; the scene prelude puts this file behind common.wgsl): what every reader — the marches, the shadow rays, the
// froxels, the guards' probe — asks. The field is one world-wide lattice per voxel size, cut into 8³-cell bricks that exist only where smoke is.
//   smokePage  (binding 14, r32uint 3D): rows [SPG_TEXY0, …) = the COARSE lattice's bricks: low 31 bits = slot + 1 of a brick with something to fetch (0 = nothing), bit 31 = fine smoke
//              somewhere inside this coarse brick; rows [0, SPG_N1.y) = the FINE lattice's bricks: slot + 1 or 0; rows [SPG_TEXYM, …) = one word per MACRO cell of 4 × 2 × 4 coarse bricks:
//              bit x + 4 z + 16 y = that brick's entry is not 0 (smoke.wgsl compose), so one load clears 1.76 × 0.88 × 1.76 m of air.
//   smokeAtlas (binding 8): one 10³-texel block per slot = the brick's 8³ cells + one cell of apron copied from its neighbours, so a hardware trilinear fetch inside a brick is seamless.
//   smoke[8]   (binding 7): BOUNDS only — boxes round wherever smoke is (0‥3 coarse, 4‥7 fine), for the readers that clip a ray before marching it. Density never depends on them.
//              (smoke[0].readSkip = the solver's knob of that name: 0 = nobody hops, every brick and every step asks the page.)
// Prepended by smokeGrid.ts smokeReadConsts(): SPG_B0 / SPG_B1 (brick edge, m), SPG_N0 / SPG_N1 (bricks per axis), SPG_TEXY0, SPG_TEXYM, SPG_AX / SPG_AY (atlas blocks per row / column), SPG_INV_ATLAS.
@group(0) @binding(14) var smokePage: texture_3d<u32>;


fn spgFetch4(slot1: u32, f: vec3f) -> vec4f {   // f = position inside the brick in cells, 0‥8
  let s = slot1 - 1u;
  let o = vec3f(f32(s % SPG_AX), f32((s / SPG_AX) % SPG_AY), f32(s / (SPG_AX * SPG_AY))) * 10.0 + 1.0;
  return textureSampleLevel(smokeAtlas, linSamp, (o + f) * SPG_INV_ATLAS, 0.0);
}
fn spgFetch(slot1: u32, f: vec3f) -> f32 { return spgFetch4(slot1, f).x; }
fn spgFine(p: vec3f) -> f32 {
  let q = p * (1.0 / SPG_B1); let fl = floor(q); let b = vec3i(fl);
  if (any(b < vec3i(0)) || any(b >= SPG_N1)) { return 0.0; }
  let s = textureLoad(smokePage, b, 0).x;
  if (s == 0u) { return 0.0; }
  return spgFetch(s, (q - fl) * 8.0);
}
var<private> spgHole: bool;   // the last smokeTexelAt met no page entry at all: only there is a run of clear air worth asking after (a hint for the marches' hop, never an answer)
/** what is at p: .x = the density every reader takes, both lattices, the render-density rows in it; .yzw = the coarse lattice's × (1 − tint) of whatever is in the cell (smoke.wgsl publish) */
fn smokeTexelAt(p: vec3f) -> vec4f {
  spgHole = true;
  let q = p * (1.0 / SPG_B0); let fl = floor(q); let b = vec3i(fl);
  if (any(b < vec3i(0)) || any(b >= SPG_N0)) { return vec4f(0.0); }
  let t = textureLoad(smokePage, b + vec3i(0, SPG_TEXY0, 0), 0).x;
  if (t == 0u) { return vec4f(0.0); }
  spgHole = false;
  var d = vec4f(0.0);
  if ((t & 0x7fffffffu) != 0u) { d = spgFetch4(t & 0x7fffffffu, (q - fl) * 8.0); }
  if ((t >> 31u) != 0u) { d.x += spgFine(p); }
  return d;
}
fn smokeDensityAt(p: vec3f) -> f32 { return smokeTexelAt(p).x; }
fn smokeDensityIn(p: vec3f, mask: u32) -> f32 { return smokeDensityAt(p); }

struct SmokeSpan { mask: u32, tEnter: f32, tExit: f32 };
fn smokeSegment(ro: vec3f, rd: vec3f, tmax: f32) -> SmokeSpan {
  var sp: SmokeSpan; sp.mask = 0u; sp.tEnter = 1e30; sp.tExit = -1e30;
  let invRd = safeInv(rd);
  for (var i = 0u; i < frame.numSmoke; i++) {
    let sd = smoke[i];
    if (sd.live == 0u) { continue; }
    let tb = isectBounds(ro, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
    if (tb.x <= tb.y && tb.y > 0.0 && tb.x < tmax) { sp.tEnter = min(sp.tEnter, max(tb.x, 0.0)); sp.tExit = max(sp.tExit, min(tb.y, tmax)); sp.mask |= 1u << i; }
  }
  return sp;
}
const SPG_MB: vec3f = vec3f(4.0 * SPG_B0, 2.0 * SPG_B0, 4.0 * SPG_B0);   // a macro cell, m
fn spgSkip() -> bool { return smoke[0].readSkip > 0.5; }
fn spgMacroOf(b: vec3i) -> vec3i { return vec3i(b.x >> 2u, b.y >> 1u, b.z >> 2u); }
fn spgMacro(mc: vec3i) -> u32 { return textureLoad(smokePage, vec3i(mc.x, SPG_TEXYM + mc.y, mc.z), 0).x; }
fn spgBit(b: vec3i) -> u32 { return 1u << u32((b.x & 3) | ((b.z & 3) << 2u) | ((b.y & 1) << 4u)); }
/** where the ray ro + t·rd leaves the lattice cell `c` of edge `e` (per axis; an axis it does not move along never ends it) */
fn spgExit(ro: vec3f, rd: vec3f, inv: vec3f, c: vec3i, e: vec3f) -> vec3f { return select((vec3f(select(c, c + 1, rd > vec3f(0.0))) * e - ro) * inv, vec3f(1e30), rd == vec3f(0.0)); }
/** metres a ray standing at p can go on along rd through air the page says holds nothing: to the end of p's macro cell or of its brick; 0 = p's own brick has something to fetch (or nobody hops).
 *  A marcher that read 0 at p may drop every sample of its lattice inside that run: each would have read 0 off the same page entry. */
fn smokeClearRun(p: vec3f, rd: vec3f) -> f32 {
  if (!spgSkip()) { return 0.0; }
  let b = vec3i(floor(p * (1.0 / SPG_B0)));
  if (any(b < vec3i(0)) || any(b >= SPG_N0)) { return 0.0; }
  let mc = spgMacroOf(b); let m = spgMacro(mc);
  if ((m & spgBit(b)) != 0u) { return 0.0; }
  let inv = safeInv(rd);
  var x = spgExit(p, rd, inv, b, vec3f(SPG_B0));
  if (m == 0u) { x = spgExit(p, rd, inv, mc, SPG_MB); }
  return max(min(x.x, min(x.y, x.z)), 0.0);
}
/** does any coarse brick touching the box [lo, hi] have something to fetch? (macro cells, so a yes can be a near miss; a box over more than 64 of them is answered yes unasked) */
fn smokeAnyIn(lo: vec3f, hi: vec3f) -> bool {
  if (!spgSkip()) { return true; }
  let top = spgMacroOf(SPG_N0 - 1);
  let a = max(vec3i(floor(lo / SPG_MB)), vec3i(0)); let z = min(vec3i(floor(hi / SPG_MB)), top);
  if (any(z < a)) { return false; }
  let n = z - a + 1;
  if (n.x * n.y * n.z > 64) { return true; }
  for (var k = a.z; k <= z.z; k++) { for (var j = a.y; j <= z.y; j++) { for (var i = a.x; i <= z.x; i++) { if (spgMacro(vec3i(i, j, k)) != 0u) { return true; } } } }
  return false;
}
/** ∫ density dt along ro + t·rd, t0 < t < t1: a walk over the COARSE bricks; inside a brick that holds smoke, samples every `stride` metres of the chord through it (at least one, at the chord's
 *  middle); where the page says there is fine smoke too, that lattice is sampled at 0.4 × the stride. The sample points hang on the world's lattice and the ray, not on a box's extent — a plume's
 *  shadow does not re-sample itself when some other plume grows. Clear air costs one load per MACRO cell crossed, left in one hop; in a macro cell with smoke somewhere its word says which
 *  bricks to ask the page about. Every chord's ends are a closed form of its brick's coordinate, so hopping or not (spgSkip) the bricks with smoke are sampled at the same points. */
fn smokeOpticalDepth(ro: vec3f, rd: vec3f, t0: f32, t1: f32, stride: f32) -> f32 {
  let inv = safeInv(rd); let skip = spgSkip();
  let fwd = rd > vec3f(0.0);
  var cell = vec3i(floor((ro + rd * (t0 + 1e-4)) * (1.0 / SPG_B0)));
  var mAt = vec3i(-0x7fffffff); var mask = 0u;
  var t = t0; var od = 0.0;
  for (var it = 0; it < 192 && t < t1; it++) {
    let inside = all(cell >= vec3i(0)) && all(cell < SPG_N0);
    if (skip) {
      let mc = spgMacroOf(cell);
      if (any(mc != mAt)) { mAt = mc; mask = 0u; if (inside) { mask = spgMacro(mc); } }
      if (mask == 0u) {                                     // nothing in the whole macro cell: out of it in one go, into the brick the ray enters next
        let x = spgExit(ro, rd, inv, mc, SPG_MB);
        t = max(min(x.x, min(x.y, x.z)), t);
        let lo = mc * vec3i(4, 2, 4);
        let c = clamp(vec3i(floor((ro + rd * t) * (1.0 / SPG_B0))), lo, lo + vec3i(3, 1, 3));
        let nx = select(lo - 1, lo + vec3i(4, 2, 4), fwd);
        if (x.x <= x.y && x.x <= x.z) { cell = vec3i(nx.x, c.y, c.z); } else if (x.y <= x.z) { cell = vec3i(c.x, nx.y, c.z); } else { cell = vec3i(c.x, c.y, nx.z); }
        continue;
      }
    }
    let x = spgExit(ro, rd, inv, cell, vec3f(SPG_B0));
    let tEnd = min(min(x.x, min(x.y, x.z)), t1);
    let len = tEnd - t;
    if (inside && len > 1e-4 && (!skip || (mask & spgBit(cell)) != 0u)) {
      let w = textureLoad(smokePage, cell + vec3i(0, SPG_TEXY0, 0), 0).x;
      if ((w & 0x7fffffffu) != 0u) {
        let n = clamp(ceil(len / stride), 1.0, 4.0); let ds = len / n; var a = 0.0;
        for (var s = 0.5; s < n; s += 1.0) { let X = (ro + rd * (t + s * ds)) * (1.0 / SPG_B0) - vec3f(cell); a += spgFetch(w & 0x7fffffffu, clamp(X, vec3f(0.0), vec3f(1.0)) * 8.0); }
        od += a * ds;
      }
      if ((w >> 31u) != 0u) {
        let n = clamp(ceil(len / (0.4 * stride)), 1.0, 8.0); let ds = len / n; var a = 0.0;
        for (var s = 0.5; s < n; s += 1.0) { a += spgFine(ro + rd * (t + s * ds)); }
        od += a * ds;
      }
    }
    t = max(tEnd, t);
    if (x.x <= x.y && x.x <= x.z) { cell.x += select(-1, 1, fwd.x); } else if (x.y <= x.z) { cell.y += select(-1, 1, fwd.y); } else { cell.z += select(-1, 1, fwd.z); }
  }
  return od;
}
fn smokeShadowSteps() -> f32 { let n = frame.volCfg.w & 15u; return select(f32(n), 8.0, n == 0u); }
/** `steps` keeps its meaning as a quality knob: 8 samples over a 3.5 m box was one every 0.44 m, so the stride is 3.52 ∕ steps */
fn smokeTransmittanceN(ro: vec3f, rd: vec3f, tmax: f32, steps: f32) -> f32 {
  if (frame.numSmoke == 0u || (frame.flags & FLAG_SMOKE_SHADOWS) == 0u) { return 1.0; }
  let sp = smokeSegment(ro, rd, tmax);
  if (sp.tExit <= sp.tEnter) { return 1.0; }
  return exp(-smokeOpticalDepth(ro, rd, sp.tEnter, sp.tExit, 3.52 / steps) * 6.0);
}
fn smokeTransmittance(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { return smokeTransmittanceN(ro, rd, tmax, smokeShadowSteps()); }

