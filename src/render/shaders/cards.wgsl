// Torch bounce cards (FLAG_BOUNCE_CARDS; render/passes.ts dispatches one workgroup per nominated light, k < frame.cardCfg.x, right before the final gather).
//
// The problem: a torch held near a wall lights a patch a few tens of centimetres across to hundreds of W/m². The final gather finds that patch with K = 4
// cosine rays per half-res pixel — one ray in a few hundred from the floor beside it lands in it and brings back ~50× what its neighbours bring — so the
// bounce round every torch near a wall boils, and the relative firefly bound (giFireflyK) that tames it throws away up to a quarter of that bounce.
//
// The fix, by construction: the lit patch becomes an ANALYTIC emitter for the one bounce, exactly the way an area-lit fixture's glow is carried by its
// kind-3 light instead of by rays that happen to hit the box. Per nominated spot light (kind 1, `card` lights: torches, weapon lights, Sam's rail light):
//   1. lane 0 traces the beam axis from the lens (the carrier's own boxes / capsules skipped, as every shadow ray toward this light skips them) to the first
//      surface: centre C (ON the surface), normal n, distance t. No card when it hits nothing within CARD_TMAX, a character (capsule: curved, moving), or at
//      grazing incidence. The CLAIM REGION W = { x : |(x − C)·n| < CARD_PLANE_EPS, normal(x)·n > CARD_COS_MIN, |x − C|² − ((x − C)·n)² < R² } with
//      R = min(CARD_RMAX, 1.15 · t · tan(outer) / cos(incidence)) — the outer cone's footprint on that plane, and a little over.
//   2. all 64 lanes trace one direction each, stratified uniformly in solid angle over the outer cone (ΔΩ = 2π(1 − cosO)/64 per sample), and keep the
//      samples whose hit lies in W. FLUX: for a point source of intensity I(ω) the power through dω is I dω whatever surface it lands on (E = I cosθ / d², and
//      dA = d² dω / cosθ), so sample j carries  Φ_j = colour·I0 · smoothstep(cosO, cosI, cosα_j) · window(d_j) · ΔΩ  — the very factors evalLight applies for
//      this light (the 1/max(d², r²) core is 1/d² here: d ≫ the lens radius) — times the smoke transmittance along it when smoke is up (what the direct pass's
//      shadow rays would let through). A diffuse surface of albedo ρ turns irradiance E into radiosity ρE = π · radiance, so the patch's "radiance × area"
//      (the quantity a kind-3 Light carries in .color) is  Φ_L = Σ_j ρ(x_j) ⊙ Φ_j / π.  Energy check: the patch re-emits π·Φ_L = ρ·(flux landed in W). ✓
//      Flux that lands OUTSIDE W (past R, on the floor under a wall spot, on a man standing in the beam, on a box in front of the wall) is not claimed —
//      and the gather does not exclude it either (fgather.wgsl tests the same predicate, `onCard` in common.wgsl), so it stays with the rays: the card
//      and the exclusion agree on W by construction, for ANY R. R only trades how much of the boil is removed against how well a disc stands in for the patch.
//   3. the flux-weighted centroid Cq and RMS radius rq of the kept samples place the gather's 4-point quadrature where the light actually is (a spot's
//      smoothstep profile is centre-heavy; a beam half over a wall's edge is lopsided).
// Rows written per card k (texel x = k): 0 = (C, R) · 1 = (n, slot) · 2 = (Φ_L rgb, rq) · 3 = (Cq, 1). No card: R = 0 and Φ_L = 0 (row 1 still names
// the slot, rows are always fully written). Cost: 8 × 65 short closest-hit traces ≈ nothing; it is timed inside the 'gather' pass it serves.
@group(1) @binding(0) var cardsOut: texture_storage_2d<rgba32float, write>;

const CARD_TMAX: f32 = 6.0;        // no card for a surface further than this down the beam: metres wide, a few W/m² — the rays resolve big dim patches without boiling
const CARD_RMAX: f32 = 1.0;        // claim radius cap (m)
const CARD_COS_GRAZE: f32 = 0.25;  // no card below this incidence cosine (a beam skimming along a wall: the footprint is a long streak, not a disc)
const NS: u32 = 64u;               // cone samples per card = the workgroup

var<workgroup> wgC: vec4f;         // C.xyz, R
var<workgroup> wgN: vec4f;         // n.xyz, ok (1 / 0)
var<workgroup> wgAcc: array<vec4f, 64>;   // per lane: Φ_L contribution rgb, its luminance w
var<workgroup> wgMom: array<vec4f, 64>;   // per lane: w × in-plane offset from C (xyz), w × |offset|²

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32) {
  let k = wid.x;
  let slot = frame.cardSlots[k >> 2u][k & 3u];
  let li = lights[slot];
  let axis = normalize(li.dir);
  let skip = li.owner & 0xffu;                     // the carrier never shadows his own light (direct.wgsl shadowSample's rule, from the light's end)
  if (lidx == 0u) {
    var C = vec4f(0.0); var Nn = vec4f(0.0);
    if (lightKind(li) == 1u && li.cosOuter > 0.3) {   // a spot with a real cone (the nomination says so already; a light re-slotted mid-frame cannot happen, but a garbage slot must not build garbage)
      let hit = traceClosest(li.pos, axis, CARD_TMAX, skip);
      if (hit.idx >= 0 && hit.idx != CAPSULE_HIT && !hit.inside) {
        let cosInc = dot(hit.n, -axis);
        if (cosInc > CARD_COS_GRAZE) {
          let tanO = sqrt(max(1.0 - li.cosOuter * li.cosOuter, 0.0)) / li.cosOuter;
          let R = min(CARD_RMAX, 1.15 * hit.t * tanO / cosInc);
          C = vec4f(li.pos + axis * hit.t, R); Nn = vec4f(hit.n, 1.0);
        }
      }
    }
    wgC = C; wgN = Nn;
  }
  workgroupBarrier();
  let C = wgC.xyz; let R = wgC.w; let n = wgN.xyz; let ok = wgN.w > 0.0;
  // ---- 64 stratified directions over the outer cone, uniform in solid angle: cosα = 1 − u(1 − cosO), golden-angle azimuths ----
  var acc = vec4f(0.0); var mom = vec4f(0.0);
  if (ok) {
    let u = (f32(lidx) + 0.5) / f32(NS);
    let cosA = 1.0 - u * (1.0 - li.cosOuter);
    let sinA = sqrt(max(1.0 - cosA * cosA, 0.0));
    let phi = f32(lidx) * 2.3999632;
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(axis.y) > 0.9);
    let T = normalize(cross(up, axis)); let B = cross(axis, T);
    let dir = axis * cosA + (T * cos(phi) + B * sin(phi)) * sinA;
    let hit = traceClosest(li.pos, dir, CARD_TMAX + 2.0, skip);
    if (hit.idx >= 0 && hit.idx != CAPSULE_HIT && !hit.inside) {
      let x = li.pos + dir * hit.t;
      if (onCard(x, hit.n, wgC, wgN)) {
        let dOmega = 6.2831853 * (1.0 - li.cosOuter) / f32(NS);
        var flux = li.color * (smoothstep(li.cosOuter, li.cosInner, cosA) * lightWindow(hit.t, li.range) * dOmega);   // colour × I0 × profile × window × ΔΩ  (W per channel through this sample's solid angle)
        if (frame.numSmoke > 0u) { flux *= smokeTransmittance(li.pos, dir, hit.t); }
        flux *= lightFogK(li, x, hit.n);   // (the fog of war's light class, where the footprint falls: what a hidden torch throws on a wall nobody sees is not in the card, so it bounces nothing; what falls on a wall the team sees bounces as it does)
        let phiL = boxAlbedoSec(u32(hit.idx)) * flux * (1.0 / 3.14159265);   // radiance × area this sample adds to the patch
        let w = luminance(phiL);
        let off = (x - C) - n * dot(x - C, n);
        acc = vec4f(phiL, w); mom = vec4f(off * w, dot(off, off) * w);
      }
    }
  }
  wgAcc[lidx] = acc; wgMom[lidx] = mom;
  workgroupBarrier();
  if (lidx == 0u) {
    var A = vec4f(0.0); var M = vec4f(0.0);
    for (var i = 0u; i < NS; i++) { A += wgAcc[i]; M += wgMom[i]; }
    var Cq = C; var rq = 0.05; var Rout = R; var phiOut = A.xyz;
    if (!ok || A.w <= 0.0) { Rout = 0.0; phiOut = vec3f(0.0); }
    else {
      let cOff = M.xyz / A.w;                          // flux centroid, in the plane, relative to C
      Cq = C + cOff;
      rq = sqrt(max(M.w / A.w - dot(cOff, cOff), 0.0025));   // flux RMS radius about the centroid (≥ 5 cm)
    }
    textureStore(cardsOut, vec2u(k, 0u), vec4f(C, Rout));
    textureStore(cardsOut, vec2u(k, 1u), vec4f(n, f32(slot)));
    textureStore(cardsOut, vec2u(k, 2u), vec4f(phiOut, rq));
    textureStore(cardsOut, vec2u(k, 3u), vec4f(Cq, 1.0));
  }
}
