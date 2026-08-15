// SMOKE COST LAB kernel (ported from perf/smoke-scale; driven by tools/qa/smoke-lab.js `exact()` / `stepsError()` — dev only, served from disk by the dev server, never bundled).
// Compiled behind the scene prelude (the common.wgsl in use), it runs N random shadow segments in and around the live smoke domains through smokeTransmittanceRef — the shadow-ray
// transmittance as main had it before the port, statement for statement, on its own copy of the unmasked sampler (below) — and through the function the frame now takes
// (common.wgsl smokeTransmittanceN at 8 samples: the occupied-box mask + the masked walk), and counts disagreements bit for bit. docs/internal/smoke-perf.md §0 / §2.1b.
struct LabParams {
  seed: u32, nThreads: u32, reps: u32, mode: u32,   // mode 0: segments between two random points of the box; 1: from a random point toward a random light of the frame's list (its disk); 2: toward the domains' boxes from around them
  boxLo: vec4f, boxHi: vec4f,                     // the sampling box (the live domains' hull, grown)
  lodA: u32, lodB: u32, stepsA: u32, stepsB: u32, // (the sample-count comparison, mode bit 16: transmittance at stepsA vs stepsB samples — error statistics, not exactness; lodA / lodB unread: the prefiltered-mip experiment was not ported)
};
@group(1) @binding(0) var<uniform> lab: LabParams;
// [0] rays · [1] bitwise mismatches · [2] |Δ| > 1e-6 · [3] |Δ| > 1e-3 · [4] max |Δ| (f32 bits; atomicMax orders non-negative floats) · [5] segments through smoke (ref < 1) · [6] log count · [7] Σ|Δ| × 1e6 (u32)
// [8] Σ ref × 1e3 over smoky segments · [9] Σ var × 1e3 · [64 + 8k ..] log record k: ro.xyz, tmax, rd.xyz, (ref f16 | var f16 << 16)
@group(1) @binding(1) var<storage, read_write> outBuf: array<atomic<u32>>;

var<private> rs: u32;
fn lrnd() -> f32 { rs = rs * 747796405u + 2891336453u; var w = ((rs >> ((rs >> 28u) + 4u)) ^ rs) * 277803737u; w = (w >> 22u) ^ w; return f32(w) * (1.0 / 4294967296.0); }
fn lrnd3() -> vec3f { return vec3f(lrnd(), lrnd(), lrnd()); }

// ---- the REFERENCE: main's smokeDensityAt / smokeTransmittance before the port (main @ 2005ebf, src/render/shaders/common.wgsl), statement for statement ----
fn smokeDensityAtRef(p: vec3f) -> f32 {
  var d = 0.0;
  let skipEmpty = (frame.flags & FLAG_SMOKE_RSKIP) != 0u;
  for (var i = 0u; i < frame.numSmoke; i++) {
    let sd = smoke[i];
    if (sd.live == 0u) { continue; }
    let l = (p - sd.origin) / (sd.voxel * vec3f(sd.dims));
    if (any(l <= vec3f(0.0)) || any(l >= vec3f(1.0))) { continue; }
    let tex = clamp(l * vec3f(sd.dims), vec3f(0.5), vec3f(sd.dims) - 0.5);
    if (skipEmpty && !smokeMayHold(i, tex, sd.dims)) { continue; }
    let atlasSize = vec3f(textureDimensions(smokeAtlas));
    let uvw = (vec3f(sd.atlasOffset) + tex) / atlasSize;
    d += textureSampleLevel(smokeAtlas, linSamp, uvw, 0.0).x * sd.densityScale * smokeEdgeFade(l, sd.floorClosed != 0u);   // (08-12: the edge fade is part of what a density READ is now — main's reference takes it too, so __sl.exact() still compares the MASKING alone: the port's walk vs the plain one over the same reads)
  }
  return d;
}
fn smokeTransmittanceRef(ro: vec3f, rd: vec3f, tmax: f32) -> f32 {
  if (frame.numSmoke == 0u || (frame.flags & FLAG_SMOKE_SHADOWS) == 0u) { return 1.0; }
  let invRd = safeInv(rd);
  var tEnter = 1e30; var tExit = -1e30;
  for (var i = 0u; i < frame.numSmoke; i++) {
    let sd = smoke[i];
    if (sd.live == 0u) { continue; }
    let tb = isectBounds(ro, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
    if (tb.x <= tb.y && tb.y > 0.0 && tb.x < tmax) { tEnter = min(tEnter, max(tb.x, 0.0)); tExit = max(tExit, min(tb.y, tmax)); }
  }
  if (tExit <= tEnter) { return 1.0; }
  let steps = 8.0;
  let dt = (tExit - tEnter) / steps;
  var od = 0.0;
  for (var s = 0.5; s < steps; s += 1.0) { od += smokeDensityAtRef(ro + rd * (tEnter + s * dt)); }
  return exp(-od * dt * 6.0);
}

/** one random segment per the mode: (ro, rd, tmax) */
struct Seg { ro: vec3f, rd: vec3f, tmax: f32 };
fn segment(mode: u32) -> Seg {
  var s: Seg;
  let lo = lab.boxLo.xyz; let hi = lab.boxHi.xyz;
  s.ro = mix(lo, hi, lrnd3());
  var q: vec3f;
  if (mode == 1u && frame.numLights > 0u) {
    let i = min(u32(lrnd() * f32(frame.numLights)), frame.numLights - 1u);
    let li = lights[i];
    if (lightKind(li) == 2u) { q = s.ro - normalize(li.dir) * 30.0 + (lrnd3() - 0.5) * (60.0 * li.radius); }
    else { q = li.pos + (lrnd3() - 0.5) * (2.0 * li.radius); }
  } else if (mode == 2u && frame.numSmoke > 0u) {
    let i = min(u32(lrnd() * f32(frame.numSmoke)), frame.numSmoke - 1u);
    let sd = smoke[i]; q = sd.origin + sd.voxel * vec3f(sd.dims) * lrnd3();   // a point inside a random domain box (from a random point of the big box: mostly from outside it)
  } else { q = mix(lo, hi, lrnd3()); }
  let d = q - s.ro; let len = length(d);
  s.rd = d / max(len, 1e-4); s.tmax = min(max(len - 0.03, 0.01), 30.0);
  return s;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= lab.nThreads) { return; }
  rs = (gid.x * 9781u + lab.seed * 26699u) | 1u; rs ^= rs >> 15u; rs *= 0x2c1b3c6du; rs ^= rs >> 12u;
  var nRays = 0u; var nMis = 0u; var n6 = 0u; var n3 = 0u; var nSmoky = 0u; var maxD = 0.0; var sumD = 0.0; var sumR = 0.0; var sumV = 0.0;
  for (var r = 0u; r < lab.reps; r++) {
    let sg = segment(lab.mode & 15u);
    var a: f32; var b: f32;
    if ((lab.mode & 16u) != 0u) {   // sample-count comparison: the frame's estimator at stepsA vs stepsB samples (smokeTransmittanceN, common.wgsl) — statistics, not exactness
      a = smokeTransmittanceN(sg.ro, sg.rd, sg.tmax, f32(max(lab.stepsA, 1u))); b = smokeTransmittanceN(sg.ro, sg.rd, sg.tmax, f32(max(lab.stepsB, 1u)));
    } else {
      a = smokeTransmittanceRef(sg.ro, sg.rd, sg.tmax); b = smokeTransmittanceN(sg.ro, sg.rd, sg.tmax, 8.0);   // main's function as it was vs the masked walk every pass now takes at its old sample count
    }
    nRays++;
    if (a < 1.0) { nSmoky++; sumR += a; sumV += b; }
    let dlt = abs(a - b);
    if (bitcast<u32>(a) != bitcast<u32>(b)) {
      nMis++;
      if (dlt > 1e-6) { n6++; } if (dlt > 1e-3) { n3++; }
      maxD = max(maxD, dlt); sumD += dlt;
      let k = atomicAdd(&outBuf[6], 1u);
      if (k < 24u) {
        let o = 64u + k * 8u;
        atomicStore(&outBuf[o], bitcast<u32>(sg.ro.x)); atomicStore(&outBuf[o + 1u], bitcast<u32>(sg.ro.y)); atomicStore(&outBuf[o + 2u], bitcast<u32>(sg.ro.z)); atomicStore(&outBuf[o + 3u], bitcast<u32>(sg.tmax));
        atomicStore(&outBuf[o + 4u], bitcast<u32>(sg.rd.x)); atomicStore(&outBuf[o + 5u], bitcast<u32>(sg.rd.y)); atomicStore(&outBuf[o + 6u], bitcast<u32>(sg.rd.z)); atomicStore(&outBuf[o + 7u], pack2x16float(vec2f(a, b)));
      }
    }
  }
  atomicAdd(&outBuf[0], nRays); atomicAdd(&outBuf[1], nMis); atomicAdd(&outBuf[2], n6); atomicAdd(&outBuf[3], n3); atomicMax(&outBuf[4], bitcast<u32>(maxD)); atomicAdd(&outBuf[5], nSmoky);
  atomicAdd(&outBuf[7], u32(min(sumD * 1e6, 4.0e9))); atomicAdd(&outBuf[8], u32(min(sumR * 1e3, 4.0e9))); atomicAdd(&outBuf[9], u32(min(sumV * 1e3, 4.0e9)));
}
