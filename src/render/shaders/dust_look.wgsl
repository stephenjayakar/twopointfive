// HOW DESTRUCTION DUST IS DRAWN (look only). Compiled into ONE program: the volumetric pass's dust twin (render/dustLookVol.ts builds it from volumetrics.wgsl's own
// text; passes.ts dispatches it only on frames some brick of smoke carries dust). volumetrics.wgsl, common.wgsl and every other module are not touched: with no dust
// alive the frame runs the programs it always ran.
//
// WHOSE smoke is dust is per CELL: the atlas texel carries it (smoke/smoke.wgsl publish): .x the density every reader takes, .yzw that density × (1 − tint) averaged over whatever
// is in the cell. So dust drifting into a canister's plume tints and shapes only where it is, in proportion, and the plume beside it stays white smoke. Where a cell is dust, in
// the VIEW march only, the density the eye integrates is the solver's × a shape that
//   (1) THINS THE CLOUD WHERE IT ENDS: a sample whose neighbourhood, a noise-varied 0.2‥0.5 m out, holds less than it does is at the cloud's edge and is drawn
//       thinner — a front of dust, 2 s after a bang, was drawn as an egg with a firm rim because the field is as dense at its surface as in its middle;
//   (2) frays the faintest veil;
//   (3) breaks the body into slow billows (mean kept): the coarse lattice's field in a filled room is smooth, and smooth lit fog reads as one flat blob;
// the in-scatter takes the tint, weighted by whose density is at the sample (gypsum is not white smoke; plain smoke sharing the ray keeps its white); and where the
// sample is dust the march's own self-shadow taps read the same drawn density, so a billow has a lit side and a fold.
// EVERY OTHER READER IS UNTOUCHED: the scene's shadow rays, the haze's and the froxels' smoke terms, and above all the light probe's sight lines read .x through
// smoke_read.wgsl like any smoke, so this file cannot move a sight line. The price, said plainly: the picture and the sight lines no longer read
// the very same field in a dust cloud — the outer 0.2‥0.5 m of a cloud and its thinnest veil are drawn thinner than a man's sight line (and the cloud's shadow on
// the floor) reads them, and through the body a ray crossing a billow's crest is drawn denser, one crossing a trough thinner, than the smooth field the sight line reads (the same on
// average). The K = 0 march (no row ships it) draws dust as plain smoke.
const DUST_SOFT_M: f32 = 0.36;      // the reach (m, × 0.55‥1.45 by the noise) over which a cloud's edge thins: the four taps that find where the cloud ends sit this far out
const DUST_SOFT_LO: f32 = 0.22;     // share of the sample's own density its neighbourhood must hold for anything to be drawn …
const DUST_SOFT_HI: f32 = 0.95;     // … and for all of it to be (the body, a reach inside the edge, is untouched)
const DUST_VEIL: f32 = 0.05;        // density under which the veil frays (× 0.35‥1.65 by the noise): at it and above the field is kept
const DUST_BILLOW: f32 = 0.4;       // 0 = the solver's field as it is · 1 = fully modulated by the billow noise
const DUST_FULL_AT: f32 = 0.14;     // the mean of 1 − tint over a cell's smoke from which it is drawn fully as dust: the palest dust there is (drywall), undiluted

fn dustShapeAt(p: vec3f, v: f32, fine: bool) -> f32 {
  let t = frame.time;
  let a = vnoise(p * 0.85 + vec3f(0.02 * t, -0.035 * t, 0.015 * t));
  let b = vnoise(p * 2.3 + vec3f(-0.05 * t, -0.09 * t, 0.04 * t) + vec3f(7.3, 1.9, 4.1));
  let veil = smoothstep(0.0, DUST_VEIL * (0.35 + 1.3 * b), v);
  var n = b; var soft = 1.0;
  if (fine) {
    n = b * 0.6 + 0.4 * vnoise(p * 4.4 + vec3f(0.07 * t, -0.16 * t, -0.06 * t) + vec3f(2.7, 8.4, 5.5));
    let r = DUST_SOFT_M * (0.55 + 0.9 * a);
    let yMin = SPG_B0 / 8.0;   // (the floor it stands on is not an edge)
    var nb = 0.0;
    var pt = p + r * vec3f(0.577, 0.577, 0.577); pt.y = max(pt.y, yMin); nb += smokeDensityAt(pt);
    pt = p + r * vec3f(0.577, -0.577, -0.577); pt.y = max(pt.y, yMin); nb += smokeDensityAt(pt);
    pt = p + r * vec3f(-0.577, 0.577, -0.577); pt.y = max(pt.y, yMin); nb += smokeDensityAt(pt);
    pt = p + r * vec3f(-0.577, -0.577, 0.577); pt.y = max(pt.y, yMin); nb += smokeDensityAt(pt);
    soft = smoothstep(DUST_SOFT_LO, DUST_SOFT_HI, 0.25 * nb / v);
  }
  return veil * soft * mix(1.0, n * n * 3.7, DUST_BILLOW);
}
struct DustDens { d: f32, tn: vec3f, dust: f32 }
fn dustDensity(p: vec3f, mask: u32, fine: bool) -> DustDens {
  let x = smokeTexelAt(p);
  var o = DustDens(x.x, vec3f(0.0), 0.0);
  let w = clamp((x.y + x.z + x.w) / (3.0 * DUST_FULL_AT * max(x.x, 1e-6)), 0.0, 1.0);
  if (w > 0.0 && x.x > 0.0) {
    let k = mix(1.0, dustShapeAt(p, x.x, fine), w);
    o.d = x.x * k; o.tn = -x.yzw * k; o.dust = o.d;
  }
  return o;
}
fn dustTintOf(dl: DustDens) -> vec3f { return vec3f(1.0) + dl.tn / max(dl.d, 1e-6); }
fn smokeSelfShadowLook(P: vec3f, L: vec3f, mask: u32) -> f32 {
  var od = 0.0; let ds = 0.18;
  for (var i = 1; i <= 4; i++) { od += dustDensity(P + L * (f32(i) - 0.3) * ds, mask, false).d; }
  return exp(-od * ds * SMOKE_SELF_K);
}
