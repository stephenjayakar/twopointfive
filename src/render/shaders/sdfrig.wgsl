// ---- SDF character rig (render/sdfrig.ts fits it; the prelude prepends RIG_SLOTS / RIG_KPAD / RB_QUANT and the generated charSdf() fold with the per-slot
// smooth-union radii — frame.ts scenePrelude). Every character's 15 shadow proxies (capsules[k·capsPerChar + slot], struct Capsule in common.wgsl) are
// ROUND CONES: radius cp.r at end a, coneRb(cp) at end b (the top byte of misc, millimetres; 0 = r again — an untapered cone, which is what a record nobody
// fitted decodes to). Three parts:
//   §1  the primitive — coneRb / sdRoundCone / roundConeNormal / isectRoundCone: what common.wgsl's proxy loops (traceCapsules / occludedCapsules / proxyNormal)
//       run for every ray at every tier, unconditionally;
//   §2  (ii) rigClosest, the sphere-traced SMOOTH UNION of a man's cones as the reflection tracer's closest character hit (traceClosestMesh) — a row, frame.rigCfg bit 2;
//   §3  (iii) charSoftVis, the direct estimators' soft-shadow character query (direct_common shadowSample) — an experiment, bits 4 / 8 / 16 / 32.
//   frame.rigCfg  x = bits: 2 = (ii) · 4 = (iii) the direct estimators' shadow rays skip characters and multiply in charSoftVis instead · 8 = (iii) in its analytic
//                     per-cone form (no march) · 16 = the soft query folds cones with the smooth union (else plain min) · 32 = the soft query for BROAD-class lights
//                     too (else the sharp class only: broad lights keep the ray-traced character test) · 64 = CHARACTER SELF-SHADOW (common.wgsl selfShadowT, asked by
//                     direct_common shadowSample for a man's own pixels; not part of the SDF experiments — it rides here because it is the proxies' rule) · 128 = mesh shadows for NEAR
//                     receivers only (common.wgsl meshShadowT: the high tier's form). Bit 1 is retired.
//                 y = soft-shadow march steps, z = × every light's angular radius in the soft query (1 = physical), w = the smallest tan(half-angle) a light is given
//   frame.rigCfgB x = × RIG_K (0 = the plain union everywhere), y = closest-hit sphere-trace steps, z = its surface epsilon (m), w = soft query: min step (m)
// Bits 0 = the plain round-cone loops everywhere; §2 / §3 then sit behind uniform branches nobody takes (they are compiled only into the modules that
// name them — reflect_p5's tracer tail, the direct estimators' shadowSample, the rig debug kernel — and dropped from every other).
fn rigBits() -> u32 { return u32(frame.rigCfg.x); }
fn rigSmoothOn() -> bool { return (rigBits() & 2u) != 0u; }
fn charSoftOn() -> bool { return (rigBits() & 4u) != 0u; }
/** does light `li` take the soft character query? — every light with bit 32, else only the SHARP emitter class (a broad panel's character shadow is all penumbra: nothing there trails, and its disc dwarfs every limb) */
fn charSoftFor(li: Light) -> bool { let b = rigBits(); return (b & 4u) != 0u && ((b & 32u) != 0u || !lightBroad(li)); }

// ---- §1 the round-cone primitive ----
/** radius at end b: the fitted r1 in millimetres from misc's top byte, or the record's own r when nobody packed one (an untapered cone = the game's hand capsule) */
fn coneRb(cp: Capsule) -> f32 { let q = cp.misc >> 24u; return select(f32(q) * RB_QUANT, cp.r, q == 0u); }
/** polynomial smooth min (iq): bulges at most k/4 outside min(a, b); k 0 = min exactly */
fn sminP(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / max(k, 1e-6); return min(a, b) - h * h * k * 0.25; }

/** exact signed distance from p to the round cone (a, ra) → (b, rb) — iq's sdRoundCone (one square root); the CPU twin is sdfrig.ts sdRoundCone */
fn sdRoundCone(p: vec3f, a: vec3f, b: vec3f, ra: f32, rb: f32) -> f32 {
  let ba = b - a; let l2 = dot(ba, ba); let rr = ra - rb;
  if (l2 < 1e-10) { return length(p - a) - max(ra, rb); }   // a degenerate segment is a sphere (a coincident-joint frame, or a padding record: r 0 → the point's distance, never 'inside everywhere')
  let a2 = l2 - rr * rr; let il2 = 1.0 / l2;
  let pa = p - a; let y = dot(pa, ba); let z = y - l2;
  let q = pa * l2 - ba * y; let x2 = dot(q, q);
  let y2 = y * y * l2; let z2 = z * z * l2;
  let k = sign(rr) * rr * rr * x2;
  if (a2 <= 0.0) { return min(length(pa) - ra, length(p - b) - rb); }   // one end's sphere holds the other: the solid is the bigger sphere
  if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - rb; }
  if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - ra; }
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
}
fn coneSdfAt(i: u32, p: vec3f) -> f32 { let cp = capsules[i]; return sdRoundCone(p, cp.a, cp.b, cp.r, coneRb(cp)); }
/** outward unit normal of the round cone at (or near) a point p on its surface: the gradient of sdRoundCone by region (cap a, cap b, flank) */
fn roundConeNormal(p: vec3f, a: vec3f, b: vec3f, ra: f32, rb: f32) -> vec3f {
  let ba = b - a; let l2 = dot(ba, ba); let rr = ra - rb; let a2 = l2 - rr * rr;
  let pa = p - a; let y = dot(pa, ba); let z = y - l2;
  let q = pa * l2 - ba * y; let x2 = dot(q, q);
  let k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z * z * l2 > k) { return normalize(p - b); }
  if (sign(y) * a2 * y * y * l2 < k) { return normalize(pa); }
  // flank: perpendicular to the generator — the axis-perpendicular direction tilted back along the axis by the taper (rr / sqrt(a2) per unit length)
  let perp = q * inverseSqrt(max(x2, 1e-20));            // unit, ⟂ axis, toward p
  return normalize(perp * sqrt(max(a2, 0.0)) + ba * (rr * inverseSqrt(max(l2, 1e-12))));   // (cos of the taper × perp + sin of it × the axis: sin = rr / L, cos = √a2 / L)
}

// Ray vs round cone — iq's iRoundedCone, plus an origin-INSIDE answer (occluded from t = 0: the contact darkness under a prone body, as the box proxies and
// the capsules before it answered) and the ray re-centred near the cone before the quadratic (its dot products then span a metre, not the sixty a moonlit
// shadow ray does). Returns t of the entry point in front of the origin, or −1.
fn isectRoundCone(roIn: vec3f, rd: vec3f, pa: vec3f, pb: vec3f, ra: f32, rb: f32) -> f32 {
  let baL = pb - pa;
  let reach = sqrt(dot(baL, baL)) + max(ra, rb);
  let tc = dot(pa - roIn, rd) - reach - 0.01;          // everything of the cone lies past tc along the ray (a centimetre short of its bounding sphere's near pole, so an on-axis entry is not at local t ≈ 0)
  var t0 = 0.0; var ro = roIn;
  if (tc > 0.0) { t0 = tc; ro = roIn + rd * tc; }
  else if (sdRoundCone(roIn, pa, pb, ra, rb) < 0.0) { return 0.0; }   // (only an origin within `reach` of end a can be inside)
  let ba = baL; let oa = ro - pa; let ob = ro - pb; let rr = ra - rb;
  let m0 = dot(ba, ba); let m1 = dot(ba, oa); let m2 = dot(ba, rd); let m3 = dot(rd, oa); let m5 = dot(oa, oa); let m6 = dot(ob, rd); let m7 = dot(ob, ob);
  let d2 = m0 - rr * rr;
  let k2 = d2 - m2 * m2;
  let k1 = d2 * m3 - m1 * m2 + m2 * rr * ra;
  let k0 = d2 * m5 - m1 * m1 + m1 * rr * ra * 2.0 - m0 * ra * ra;
  let h = k1 * k1 - k0 * k2;
  // the flank quadratic degenerates as the ray comes within the cone's half-angle of its axis (k2 → 0: h's sign is cancellation noise and t = x ∕ ≈0);
  // there the solid is entered through a cap anyway, so only a well-conditioned quadratic may call a miss or a flank hit — the caps decide the rest
  if (k2 > 1e-6 * m0) {
    if (h < 0.0) { return -1.0; }
    let t = (-sqrt(h) - k1) / k2;
    let y = m1 - ra * rr + t * m2;
    if (y > 0.0 && y < d2) { return select(-1.0, t + t0, t >= 0.0); }   // the flank (behind the origin: the whole solid is — the inside case left above)
  }
  let h1 = m3 * m3 - m5 + ra * ra;
  let h2 = m6 * m6 - m7 + rb * rb;
  var best = -1.0;
  if (h1 > 0.0) { let t1 = -m3 - sqrt(h1); if (t1 >= 0.0) { best = t1; } }
  if (h2 > 0.0) { let t2 = -m6 - sqrt(h2); if (t2 >= 0.0 && (best < 0.0 || t2 < best)) { best = t2; } }
  return select(-1.0, best + t0, best >= 0.0);
}
/** the [enter, exit] distances of the ray through sphere (ce, ra); x > y = a miss */
fn raySphereSpan(ro: vec3f, rd: vec3f, ce: vec3f, ra: f32) -> vec2f {
  let oc = ro - ce; let b = dot(oc, rd); let c = dot(oc, oc) - ra * ra;
  let h = b * b - c; if (h < 0.0) { return vec2f(1.0, -1.0); }
  let s = sqrt(h); return vec2f(-b - s, -b + s);
}

// ---- §2 (ii) the closest hit on the SMOOTH UNION of a man's cones: entry through the closed-form cones inflated by the blend's bulge (a miss on all of them
// is a miss on the union inside them), then a sphere trace of charSdf from just before it — Lipschitz-safe (polynomial smin of exact distances never
// over-states the distance), bounded by rigCfgB.y steps and the cull sphere's exit. The normal is the field's gradient (tetrahedron differences).
struct RigHit { t: f32, ch: i32 };
fn rigNormal(base: u32, p: vec3f, kS: f32) -> vec3f {
  let e = 0.002;
  let k0 = vec3f(1.0, -1.0, -1.0); let k1 = vec3f(-1.0, -1.0, 1.0); let k2 = vec3f(-1.0, 1.0, -1.0); let k3 = vec3f(1.0, 1.0, 1.0);
  let n = k0 * charSdf(base, p + k0 * e, kS) + k1 * charSdf(base, p + k1 * e, kS) + k2 * charSdf(base, p + k2 * e, kS) + k3 * charSdf(base, p + k3 * e, kS);
  return normalize(n);
}
fn rigClosest(ro: vec3f, rd: vec3f, tmax: f32, skipOwner: u32) -> RigHit {
  var best: RigHit; best.t = tmax; best.ch = -1;
  let kS = frame.rigCfgB.x; let steps = u32(clamp(frame.rigCfgB.y, 4.0, 64.0)); let eps = max(frame.rigCfgB.z, 2e-4);
  let pad = RIG_KPAD * kS + eps;
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let bs = scene.charBounds[ch];
    if (!raySphere(ro, rd, bs.xyz, bs.w, best.t)) { continue; }
    let base = ch * scene.capsPerChar;
    if (skipsOwner(capsuleOwner(capsules[base]), skipOwner)) { continue; }
    var t0 = best.t;
    for (var s = 0u; s < RIG_SLOTS; s++) { let cp = capsules[base + s]; let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r + pad, coneRb(cp) + pad); if (t >= 0.0 && t < t0) { t0 = t; } }
    if (t0 >= best.t) { continue; }
    let tExit = min(raySphereSpan(ro, rd, bs.xyz, bs.w).y, best.t);
    var t = max(t0 - eps, 0.0); var d = 1e9; var i = 0u;
    loop {
      if (i >= steps || t > tExit) { break; }
      d = charSdf(base, ro + rd * t, kS);
      if (d < eps) { break; }
      t += d; i++;
    }
    if (d < eps || (i >= steps && d < 8.0 * eps)) { if (t < best.t) { best.t = t; best.ch = i32(ch); } }   // (out of steps a hair off the surface = the silhouette grazer: a hit)
  }
  return best;
}

// ---- §3 (iii) the character visibility factor of a shadow ray as a SOFT-SHADOW QUERY: along Po + L·t toward the light, the field's clearance h at distance t
// against the light cone's radius there (tanHalf·t = the emitter's angular radius seen from the receiver × t): the smallest h ∕ (tanHalf·t) over the march,
// −1 (the cone wholly covered) ‥ +1 (wholly clear), through the smoothstep that a straight edge sliding across a disc traces. Deterministic per pixel per
// light — no sampling noise for a history to average — at the price of the approximations the doc lists (one edge per light, the field's clearance for
// the silhouette's, thin limbs under broad lights). Two consecutive samples triangulate the true closest approach between them (Aaltonen's refinement of
// iq's loop), so a 1–2 cm march step does not band a 5 mm penumbra. Characters whose cull sphere the segment misses cost one sphere test.
fn softRemap(res: f32) -> f32 { let r = clamp(res, -1.0, 1.0); return 0.25 * (1.0 + r) * (1.0 + r) * (2.0 - r); }
fn charSoftMarch(base: u32, Po: vec3f, L: vec3f, ta: f32, tb: f32, tanHalf: f32, resIn: f32) -> f32 {
  var res = resIn;
  let kS = select(0.0, frame.rigCfgB.x, (rigBits() & 16u) != 0u);
  let steps = u32(clamp(frame.rigCfg.y, 4.0, 64.0)); let minStep = max(frame.rigCfgB.w, 0.004);
  var t = ta; var ph = -1.0; var ps = 0.0;
  for (var i = 0u; i < steps; i++) {
    let h = charSdf(base, Po + L * t, kS);
    var d = h; var ty = t;
    if (h > 0.0 && ph > 0.0) {   // the closest approach between the previous sample and this one: the two unbounding spheres' intersection circle
      let y = clamp((ps * ps + h * h - ph * ph) / (2.0 * ps), 0.0, ps);
      let dd = h * h - y * y; if (dd > 0.0) { d = sqrt(dd); ty = t - y; }
    }
    res = min(res, d / (tanHalf * max(ty, 0.02)));
    if (res <= -1.0) { break; }
    let s = clamp(h, minStep, 0.6);
    ph = h; ps = s; t += s;
    if (t > tb) { break; }
  }
  return res;
}
// The ANALYTIC form (bit 8): per cone, the closest approach between the shadow segment and the cone's axis (Ericson's segment–segment closest points) gives the
// limb as a STRIP across the light's disc as the receiver sees it — centred dAxis ∕ w off the disc's centre, half-width r ∕ w, in units of the disc's radius
// w = tanHalf × the distance to that closest approach — and the strip's exact share of the disc's area (two circular-segment areas) is what it blocks: a limb
// thicker than the disc slides a straight edge across it (the march's smoothstep, exactly), a limb THINNER than the disc (a forearm under a ceiling panel, a shin
// two metres from a desk lamp) blocks only its width's worth even dead centre, where the field's clearance alone would call the disc covered. Per character
// the largest single strip stands for him (limbs in line overlap on the disc; side by side they would add — the lesser error is taken), characters multiply.
// No march, no step artefacts, ~15 closest-point solves per character crossed.
fn discCum(u: f32) -> f32 { let x = clamp(u, -1.0, 1.0); return 0.5 + (asin(x) + x * sqrt(max(1.0 - x * x, 0.0))) * 0.31830988; }   // area share of the unit disc lying below the chord at signed offset u (−1 → 0, 0 → ½, +1 → 1)
fn segSegClosest(p1: vec3f, d1: vec3f, l1: f32, p2: vec3f, q2: vec3f) -> vec3f {   // ray p1 + d1·s, s ∈ [0, l1] (d1 unit) vs segment p2 → q2: (s, u ∈ [0,1] on the segment, distance)
  let d2 = q2 - p2; let r = p1 - p2;
  let e = dot(d2, d2); let f = dot(d2, r); let c = dot(d1, r); let b = dot(d1, d2);
  let denom = e - b * b;                                  // (a = 1: d1 is unit)
  var s = 0.0;
  if (denom > 1e-9) { s = clamp((b * f - c * e) / denom, 0.0, l1); }
  var u = (b * s + f) / max(e, 1e-9);
  if (u < 0.0) { u = 0.0; s = clamp(-c, 0.0, l1); }
  else if (u > 1.0) { u = 1.0; s = clamp(b - c, 0.0, l1); }
  let dv = (p1 + d1 * s) - (p2 + d2 * u);
  return vec3f(s, u, length(dv));
}
/** the largest share of the light's disc any one cone of character `base` blocks along the shadow segment (0 = none, 1 = the whole disc) */
fn charSoftAnalytic(base: u32, Po: vec3f, L: vec3f, tb: f32, tanHalf: f32) -> f32 {
  var blocked = 0.0;
  for (var s = 0u; s < RIG_SLOTS; s++) {
    let cp = capsules[base + s];
    let c = segSegClosest(Po, L, tb, cp.a, cp.b);
    let r = mix(cp.r, coneRb(cp), c.y);
    let w = tanHalf * max(c.x, 0.02);                     // the disc's radius in metres of lateral offset at that distance
    if (c.z - r >= w) { continue; }                       // clears the whole disc (nearly every cone of a man the ray only passes)
    blocked = max(blocked, discCum((r - c.z) / w) - discCum((-r - c.z) / w));   // the strip [dAxis − r, dAxis + r] over the disc centred at 0
    if (blocked >= 0.999) { break; }
  }
  return blocked;
}
/** the raw edge ratio of the analytic form (min over cones of clearance ∕ disc radius — what the march estimates; the debug kernel compares the two) */
fn charSoftAnalyticRes(base: u32, Po: vec3f, L: vec3f, tb: f32, tanHalf: f32, resIn: f32) -> f32 {
  var res = resIn;
  for (var s = 0u; s < RIG_SLOTS; s++) {
    let cp = capsules[base + s];
    let c = segSegClosest(Po, L, tb, cp.a, cp.b);
    let clear = c.z - mix(cp.r, coneRb(cp), c.y);
    res = min(res, clear / (tanHalf * max(c.x, 0.02)));
  }
  return res;
}
/** the visibility 0‥1 of a light of angular radius atan(tanHalfIn) along Po + L·t, t ∈ [0.02, tmaxL], past every character but `skip`'s two owners */
fn charSoftVis(Po: vec3f, L: vec3f, tmaxL: f32, tanHalfIn: f32, skip: u32) -> f32 {
  if (scene.numCapsules == 0u) { return 1.0; }
  let tanHalf = max(tanHalfIn * max(frame.rigCfg.z, 0.05), max(frame.rigCfg.w, 1e-4));
  let analytic = (rigBits() & 8u) != 0u;
  var res = 1.0; var vis = 1.0;
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let bs = scene.charBounds[ch];
    let sp = raySphereSpan(Po, L, bs.xyz, bs.w + tanHalf * max(dot(bs.xyz - Po, L), 0.0));   // the light's cone grows with distance: a limb inside the sphere still covers part of the disc for a centre ray passing tanθ·t outside it
    let ta = max(sp.x, 0.02); let tb = min(sp.y, tmaxL);
    if (ta >= tb) { continue; }
    let base = ch * scene.capsPerChar;
    if (skipsOwner(capsuleOwner(capsules[base]), skip)) { continue; }
    if (analytic) { vis *= 1.0 - charSoftAnalytic(base, Po, L, tb, tanHalf); if (vis <= 0.001) { return 0.0; } }
    else { res = charSoftMarch(base, Po, L, ta, tb, tanHalf, res); if (res <= -1.0) { return 0.0; } }
  }
  if (analytic) { return vis; }
  return softRemap(res);
}
