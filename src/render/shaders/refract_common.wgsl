// REFRACTION helpers — pure functions, NO bindings and no dependence on the scene prelude: prepended by whoever bends a ray through a clear medium and reads the
// already-shaded picture behind it in screen space. Today: composite.wgsl (the glass boxes — panes and the water-cooler bottle: glassRefractPath / refractedRead)
// and the particle rain's water streaks (particles_draw.wgsl, exp/prain). Each caller does its own READS (the shaded scene, the depth) with what it binds; the law,
// the box exit, the absorption, the re-projection and the screen guards live here once.
//
// The model both share: Snell in (refractDir, η = n_from / n_to), the medium crossed analytically (slabExit for a box; a cylinder's chord for a streak), Snell out
// (a face met past the critical angle mirrors the ray instead — total internal reflection — and the caller crosses once more), Beer–Lambert by the length crossed
// (beerLambert: the medium given as its transmittance through a reference length), then the exit ray's continuation READ where a point along it projects
// (refractProbeDist → screenRefractPx → clampRefractOffset), the caller refusing the read where what shows there is nearer than the exit point or is the sky.

/** Schlick's Fresnel at cosine `c` of the incidence angle, normal reflectance f0 (0.04 = glass n 1.5 — common.wgsl glassFresnel; 0.02 = water n 1.33). */
fn fresnelSchlick(c: f32, f0: f32) -> f32 { let u = 1.0 - clamp(c, 0.0, 1.0); let u2 = u * u; return f0 + (1.0 - f0) * u2 * u2 * u; }
/** normal reflectance of a dielectric of index n against air: ((n − 1) / (n + 1))² */
fn fresnelF0(ior: f32) -> f32 { let a = (ior - 1.0) / (ior + 1.0); return a * a; }

/** Snell's law: unit incident I against unit normal N facing I's side (dot(N, I) < 0), eta = n_from / n_to (1/n going in, n coming out). → (direction, 1), or past the
 *  critical angle — the ray cannot leave — (the MIRRORED direction, 0): total internal reflection, and the caller carries it across the medium once more. */
fn refractDir(I: vec3f, N: vec3f, eta: f32) -> vec4f {
  let o = refract(I, N, eta);
  if (dot(o, o) > 0.0) { return vec4f(o, 1.0); }
  return vec4f(reflect(I, N), 0.0);
}

/** From INSIDE an axis-aligned box of half-extents `half` (the box's own frame, centre at the origin) at `ro` heading `rd` (need not be unit): the parametric
 *  distance to the face it leaves by and that face's OUTWARD unit normal. An axis it does not move along never wins; a start a hair outside a face it heads
 *  away from (float slop at a corner) leaves at t = 0 by the face it is pressed against. */
struct SlabExit { t: f32, n: vec3f };
fn slabExit(ro: vec3f, rd: vec3f, half: vec3f) -> SlabExit {
  let inv = vec3f(select(1.0 / rd.x, 1e20, abs(rd.x) < 1e-20), select(1.0 / rd.y, 1e20, abs(rd.y) < 1e-20), select(1.0 / rd.z, 1e20, abs(rd.z) < 1e-20));
  let tF = (select(-half, half, rd >= vec3f(0.0)) - ro) * inv;   // per axis: the distance to the slab that component heads toward (≥ 0 from inside; huge along an axis it does not move on)
  var r: SlabExit; r.t = max(min(min(tF.x, tF.y), tF.z), 0.0); r.n = vec3f(0.0);
  if (tF.x <= tF.y && tF.x <= tF.z) { r.n.x = select(-1.0, 1.0, rd.x >= 0.0); } else if (tF.y <= tF.z) { r.n.y = select(-1.0, 1.0, rd.y >= 0.0); } else { r.n.z = select(-1.0, 1.0, rd.z >= 0.0); }
  return r;
}

/** Beer–Lambert: the transmittance of `len` of a medium given by its transmittance `tint` through the reference length `unit` = tint^(len / unit). (The glass boxes:
 *  unit = the box's own thickness, so the tint authored on a pane is what it shows square-on; a rain streak: unit = its diameter.) */
fn beerLambert(tint: vec3f, len: f32, unit: f32) -> vec3f { return pow(max(tint, vec3f(1e-3)), vec3f(len / max(unit, 1e-4))); }

/** How far along the exit ray (E, d) to READ: where it meets the plane (P0, N0) of what the pixel already shows — exact for a floor, a wall, a desk top behind the
 *  medium — capped at maxDist; a ray running along that plane or away from it is followed maxDist. */
fn refractProbeDist(E: vec3f, d: vec3f, P0: vec3f, N0: vec3f, maxDist: f32) -> f32 {
  let dn = dot(d, N0);
  if (dn < -0.05) { return clamp(dot(P0 - E, N0) / dn, 0.0, maxDist); }
  return maxDist;
}

/** The point `dist` along the exit ray (E, d) projected onto a `screen`-pixel raster by `viewProj` — the raster's OWN matrix, jitter and all: whatever its
 *  worldFromDepth inverts (frame.viewProj on the internal raster carries the TAAU jitter; the sharp-direct output raster's is unjittered) — → (pixel position
 *  .xy in that raster's pixels, y down; .z = 1, or 0 when the point falls behind the eye and nothing may be read). UV = .xy / screen. */
fn screenRefractPx(E: vec3f, d: vec3f, dist: f32, viewProj: mat4x4f, screen: vec2f) -> vec3f {
  let clip = viewProj * vec4f(E + d * dist, 1.0);
  if (clip.w < 1e-3) { return vec3f(0.0); }
  return vec3f((clip.xy / clip.w * vec2f(0.5, -0.5) + 0.5) * screen, 1.0);
}

/** The screen guards on a refraction offset `oIn` (read point − the pixel's centre `pixf`, px): its length capped at maxPx (a bound on a graze's worst case),
 *  then shrunk toward the pixel — continuously, no seam where a bent ray would leave the frame — until pixf + o lies inside the `screen` raster. What is left to
 *  the caller: refuse the read (keep the pixel's own) where the surface showing at pixf + o is NEARER the eye than the exit point (a mullion, a sill, a man in
 *  front of the neighbouring stretch of glass — nothing in front of the medium can be seen through it) or where the sky shows there. */
fn clampRefractOffset(pixf: vec2f, oIn: vec2f, maxPx: f32, screen: vec2f) -> vec2f {
  var o = oIn; let ol = length(o);
  if (ol > maxPx) { o *= maxPx / ol; }
  let hi = screen - 0.5; var lam = 1.0;
  if (pixf.x + o.x < 0.5) { lam = min(lam, (pixf.x - 0.5) / -o.x); }
  if (pixf.x + o.x > hi.x) { lam = min(lam, (hi.x - pixf.x) / o.x); }
  if (pixf.y + o.y < 0.5) { lam = min(lam, (pixf.y - 0.5) / -o.y); }
  if (pixf.y + o.y > hi.y) { lam = min(lam, (hi.y - pixf.y) / o.y); }
  return o * max(lam, 0.0);
}
