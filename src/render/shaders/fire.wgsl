// ---- AN OPEN FIRE, DRAWN (game/fire.ts FIRE; the composite adds it to the picture: composite.wgsl, beside the lasers' light in the air) ----
// A drum of burning wood is four things in the picture and this file is three of them: the FLAME, a small volume of light marched where the pixel's ray crosses
// it, the BED OF COALS it stands on (a disc over the drum's mouth: char and glowing wood, breathing) and the EMBERS, bright points on closed-form paths. (The third, the smoke, is real gas in the smoke solver and comes back through the volumetric pass.)
// Nothing here reads the scene: a record per fire and the pixel's ray in, light and how much of what is behind is kept out — so the same text runs alone on a
// plain stage (tools/qa/fire-lab.cjs), where its look was set. Picture only: the game reads none of it (the fire's LIGHT is an engine light like any lamp's).
//   a = where the coals are (the middle of the drum's mouth) + the mouth's radius (m)      b = flame height (m) · heat 0‥1 · the fire's own seed 0‥1 · its clock (s)
//   c = the wind at the flame (x, z; m/s) · the light's flicker this frame (about 1) · embers in the air at once      d = the bed of coals' radius (m; 0 = none drawn)
//   pop = the last four cracks of the wood: seconds since (under 0 = none) · how hard 0‥1 · its own seed 0‥1
struct FireRec { a: vec4f, b: vec4f, c: vec4f, d: vec4f, pop: array<vec4f, 4> };

const FIRE_STEPS = 18.0;        // samples of the flame along a pixel's ray
const FIRE_SIGMA = 6.0;         // 1/m: how soon a flame hides what is behind it. A flame is THIN: a hand's width of it keeps half of what is behind, so a long path
                                // through the heart is bright, the edges are dim and deep in colour, and the coals show through from above
const FIRE_GAIN = 2.0;          // scene radiance of full flame at its hottest (the drum's coals are authored at 11)
const FIRE_EMBER_GAIN = 2.5;   // … of an ember just thrown (a point far smaller than a pixel: what reaches the picture is this × its share of the pixel)
const FIRE_EMBER_R = 0.004;     // m: an ember's own radius
const FIRE_POP_EMBERS = 6u;     // embers a crack throws

fn fireHu(x: u32) -> f32 { var h = x * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; h ^= h >> 22u; return f32(h >> 8u) * (1.0 / 16777216.0); }
fn fireL(i: vec3i) -> f32 { return fireHu((u32(i.x) * 73856093u) ^ (u32(i.y) * 19349663u) ^ (u32(i.z) * 83492791u)); }
/** value noise, 0‥1, one lattice cell a unit */
fn fireN(p: vec3f) -> f32 {
  let fl = floor(p); let i = vec3i(fl); let f = p - fl; let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(fireL(i), fireL(i + vec3i(1, 0, 0)), u.x), mix(fireL(i + vec3i(0, 1, 0)), fireL(i + vec3i(1, 1, 0)), u.x), u.y);
  let b = mix(mix(fireL(i + vec3i(0, 0, 1)), fireL(i + vec3i(1, 0, 1)), u.x), mix(fireL(i + vec3i(0, 1, 1)), fireL(i + vec3i(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}

/** how much flame there is at P (0‥1) and how hot it is there (0‥1: the tips and the rim are the cool end) */
fn fireFlame(F: FireRec, P: vec3f) -> vec2f {
  let R = F.a.w; let H = F.b.x; let t = F.b.w; let s = F.b.z * 61.0;
  var q = P - F.a.xyz;
  if (q.y < -0.04 || q.y > H * 1.7) { return vec2f(0.0); }
  let y = max(q.y, 0.0) / H;
  // the wind leans it, more the higher it stands, and it sways a little of its own accord
  let bend = 0.055 * y * sqrt(y);
  q.x -= F.c.x * bend + 0.035 * y * sin(t * 2.3 + s);
  q.z -= F.c.y * bend + 0.035 * y * cos(t * 1.9 + s * 1.7);
  // it RISES: everything from here on is read in air that climbs, so the shapes travel up the flame and off its top
  let up = t * 1.7;
  let w1 = fireN(vec3f(q.x * 4.5 + s, q.y * 3.2 - up, q.z * 4.5)) - 0.5;
  let w2 = fireN(vec3f(q.x * 4.5 - s, q.y * 3.2 - up + 7.3, q.z * 4.5 + 3.1)) - 0.5;
  q.x += w1 * 1.1 * R * y; q.z += w2 * 1.1 * R * y;
  let r = length(q.xz);
  let rim = clamp(1.0 - r / (R * 1.1), 0.0, 1.0);   // 1 on the axis, 0 at the drum's rim
  // several flames stand side by side on the coals, each its own height, and trade places: the top of the fire is a field of peaks, and a peak is a point
  let tn = 0.7 * fireN(vec3f(q.x / R * 1.5 + s, t * 1.4, q.z / R * 1.5 - s)) + 0.3 * fireN(vec3f(q.x / R * 3.6 - s, t * 2.9 + 5.0, q.z / R * 3.6 + s));
  let h = H * (0.16 + 2.0 * pow(tn, 1.4)) * sqrt(rim) * (1.0 + 0.6 * (F.c.z - 1.0));
  let yy = max(q.y, 0.0) / max(h, 1e-3);
  // torn by what rises through it: whole at the coals, ragged up its sides, loose islands at the top
  let n = 0.62 * fireN(vec3f(q.x * 9.0, q.y * 6.0 - up * 2.2, q.z * 9.0) + s) + 0.38 * fireN(vec3f(q.x * 21.0, q.y * 13.0 - up * 4.4, q.z * 21.0) - s);
  let edge = 1.0 - yy;
  var f = smoothstep(0.0, 0.13, edge + (n - 0.5) * (0.35 + 0.8 * min(yy, 1.3))) * smoothstep(0.0, 0.22, rim + (n - 0.5) * 0.3 * smoothstep(0.0, 0.1, rim));   // (no flame beyond the rim: the noise alone must not light one there)
  f *= smoothstep(-0.01, 0.16, q.y) * (1.0 - smoothstep(1.4, 1.7, y));   // open at its feet, so the coals are seen between its roots; and gone before the volume's own top
  let hot = clamp(f * clamp(0.2 + 1.1 * edge, 0.0, 1.0) * (0.5 + 0.5 * rim), 0.0, 1.0);
  return vec2f(f, hot);
}
/** the light of a flame that hot: deep red at the cool end, orange, a yellow heart */
fn fireColor(hot: f32) -> vec3f {
  var c = mix(vec3f(0.85, 0.09, 0.004), vec3f(1.0, 0.28, 0.02), smoothstep(0.0, 0.3, hot));
  c = mix(c, vec3f(1.0, 0.60, 0.14), smoothstep(0.3, 0.85, hot));
  return c * (0.10 + 2.6 * hot * hot * hot);   // (a wide range: the rim stays under the tone curve's shoulder and keeps its red, the heart goes yellow)
}
/** where the vertical cylinder of radius R about `c` between heights y0 and y1 cuts the ray: (near, far), near > far = it does not */
fn fireCyl(ro: vec3f, rd: vec3f, c: vec3f, R: f32, y0: f32, y1: f32) -> vec2f {
  let o = ro - c; let A = dot(rd.xz, rd.xz); let B = dot(o.xz, rd.xz); let C = dot(o.xz, o.xz) - R * R;
  var t0 = -1e30; var t1 = 1e30;
  if (A > 1e-8) { let D = B * B - A * C; if (D <= 0.0) { return vec2f(1.0, 0.0); } let sq = sqrt(D); t0 = (-B - sq) / A; t1 = (-B + sq) / A; }
  else if (C > 0.0) { return vec2f(1.0, 0.0); }
  if (abs(rd.y) > 1e-6) { let a = (y0 - o.y) / rd.y; let b = (y1 - o.y) / rd.y; t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b)); }
  else if (o.y < y0 || o.y > y1) { return vec2f(1.0, 0.0); }
  return vec2f(t0, t1);
}
/** a bright point far smaller than a pixel, seen along the ray: its share of the pixel (the lasers' dot, composite.wgsl beamSpot) */
fn fireSpot(ro: vec3f, rd: vec3f, tMax: f32, P: vec3f, cpix: f32) -> f32 {
  let w = P - ro; let t = dot(w, rd);
  if (t <= 0.0 || t > tMax) { return 0.0; }
  let d2 = dot(w, w) - t * t;
  let sg = max(FIRE_EMBER_R, 0.55 * cpix * t);
  if (d2 > 16.0 * sg * sg) { return 0.0; }
  return min(1.0, (FIRE_EMBER_R * FIRE_EMBER_R) / (sg * sg)) * exp(-0.5 * d2 / (sg * sg));
}
/** an ember's colour as it cools over its life (x = 0 thrown, 1 out) */
fn fireEmberColor(x: f32) -> vec3f { return mix(vec3f(1.0, 0.36, 0.04), vec3f(0.9, 0.1, 0.01), smoothstep(0.0, 0.8, x)) * pow(1.0 - x, 1.4); }

/** THE EMBERS along the ray → light added. Those the fire lets go of all the while climb on its hot air and are carried off by the wind; those a crack throws
 *  leave fast and fall back. Every path is a closed form of the fire's clock: nothing is kept between frames. */
/** the cylinder nothing of this fire leaves — its embers' reach, which is the widest thing it has: in wind they only go downwind (0.3 m a second of age for each
 *  m/s, three seconds at most: FIRE_DRIFT), so the cylinder stands half that way downwind and is that much wider. x = where the ray enters it, y = leaves. */
const FIRE_DRIFT = 0.3;
fn fireBound(F: FireRec, ro: vec3f, rd: vec3f) -> vec2f {
  let half = F.c.xy * (FIRE_DRIFT * 1.5);
  return fireCyl(ro, rd, F.a.xyz + vec3f(half.x, 0.0, half.y), 1.3 + length(half), -0.9, 3.4);
}
struct FireEmb { near: vec3f, far: vec3f };   // the embers this side of the flame's middle, and those beyond it
fn fireEmbers(F: FireRec, ro: vec3f, rd: vec3f, tMax: f32, cpix: f32, tMid: f32) -> FireEmb {
  let R = F.a.w; let H = F.b.x; let heat = F.b.y; let t = F.b.w; let base = F.a.xyz;
  let sd = u32(F.b.z * 65535.0);
  let cb = fireBound(F, ro, rd);
  if (cb.x > cb.y || cb.y < 0.0 || cb.x > tMax) { return FireEmb(vec3f(0.0), vec3f(0.0)); }
  var Ln = vec3f(0.0); var Lf = vec3f(0.0);
  let n = u32(clamp(F.c.w, 0.0, 16.0));
  for (var i = 0u; i < n; i++) {
    let k = sd * 31u + i * 977u;
    let period = 1.4 + 1.7 * fireHu(k + 1u);
    let u = (t + period * fireHu(k + 2u)) / period; let cyc = u32(floor(u)); let age = (u - floor(u)) * period;
    let kc = k ^ (cyc * 2654435761u);
    let life = period * (0.55 + 0.4 * fireHu(kc + 3u));
    if (age >= life) { continue; }
    let x = age / life;
    let az = 6.2831853 * fireHu(kc + 4u); let out = vec2f(cos(az), sin(az)); let r0 = R * 0.8 * sqrt(fireHu(kc + 5u));
    let rise = 0.55 * (1.0 - exp(-age * 2.2)) * (1.1 + 0.9 * fireHu(kc + 6u)) + (0.3 + 0.35 * fireHu(kc + 7u)) * age;
    let ph = 6.2831853 * fireHu(kc + 8u);
    var P = base + vec3f(out.x * r0, H * (0.25 + 0.5 * fireHu(kc + 9u)), out.y * r0);
    P.y += rise;
    let drift = out * (0.1 + 0.2 * fireHu(kc + 10u)) * age + vec2f(sin(age * 5.1 + ph), cos(age * 4.3 + ph * 1.7)) * (0.05 * age) + F.c.xy * (FIRE_DRIFT * age * smoothstep(0.0, 0.5, age));
    P.x += drift.x; P.z += drift.y;
    let tw = (0.65 + 0.35 * sin(age * 31.0 + ph * 3.0)) * (0.4 + 1.2 * fireHu(kc + 11u));   // (no two alike)
    let e = fireEmberColor(x) * (tw * fireSpot(ro, rd, tMax, P, cpix));
    if (dot(P - ro, rd) < tMid) { Ln += e; } else { Lf += e; }
  }
  for (var j = 0u; j < 4u; j++) {
    let pp = F.pop[j]; let age = pp.x;
    if (age < 0.0 || age > 1.5) { continue; }
    let ks = u32(pp.z * 65535.0) * 7919u + sd;
    for (var i = 0u; i < FIRE_POP_EMBERS; i++) {
      let k = ks + i * 613u;
      let life = 0.55 + 0.9 * fireHu(k + 1u);
      if (age >= life) { continue; }
      let az = 6.2831853 * fireHu(k + 2u); let out = vec2f(cos(az), sin(az));
      let v = vec3f(out.x, 0.0, out.y) * ((0.35 + 1.1 * fireHu(k + 3u)) * (0.6 + 0.8 * pp.y)) + vec3f(0.0, (1.3 + 1.9 * fireHu(k + 4u)) * (0.6 + 0.7 * pp.y), 0.0);
      let e = (1.0 - exp(-1.5 * age)) / 1.5;   // a light thing in air: it sheds its speed
      var P = base + vec3f(out.x * R * 0.4, H * 0.3, out.y * R * 0.4) + v * e;
      P.y -= 1.6 * age * age;
      P.x += F.c.x * FIRE_DRIFT * age * age; P.z += F.c.y * FIRE_DRIFT * age * age;
      if (P.y < base.y - 0.86) { continue; }   // (gone out on the ground beside the drum)
      let li = fireEmberColor(age / life) * ((0.7 + 1.2 * fireHu(k + 5u)) * fireSpot(ro, rd, tMax, P, cpix));
      if (dot(P - ro, rd) < tMid) { Ln += li; } else { Lf += li; }
    }
  }
  let g = FIRE_EMBER_GAIN * heat;
  return FireEmb(Ln * g, Lf * g);
}

/** ONE FIRE along the ray ro + t·rd, 0 < t < tMax (the surface the pixel shows) → rgb = its light toward the eye, a = how much of what is behind it is kept.
 *  `cpix` = metres across a pixel per metre of distance, `jit` = 0‥1 per pixel and frame (the march's start offset). */
/** THE BED OF COALS at a point of the drum's mouth (q: metres from its middle): what it glows, rgb. Lumps of char with fire in the gaps between them, the
 *  whole breathing slowly and with the light — the level's glowing lid alone is one flat bright plate. */
fn fireCoals(F: FireRec, q: vec2f) -> vec3f {
  let t = F.b.w; let s = F.b.z * 37.0;
  let lump = fireN(vec3f(q.x * 20.0 + s, q.y * 20.0 - s, 0.5));                                   // a lump is a hand's width
  let fine = fireN(vec3f(q.x * 90.0 - s, q.y * 90.0 + s, t * 0.9));
  let breath = 0.5 + 0.5 * sin(t * 1.3 + 6.2831853 * fireN(vec3f(q.x * 11.0, q.y * 11.0, s)));     // each patch of it brightens and dims in its own time
  let gap = smoothstep(0.42, 0.7, lump + 0.25 * (fine - 0.5));                                     // 0 on a lump's back, 1 down between two
  let heat = F.b.y * (0.55 + 0.45 * breath) * (0.6 + 0.4 * F.c.z);
  let glow = gap * gap * heat;
  let char = vec3f(0.035, 0.012, 0.006) * (0.4 + fine) * 2.0;   // a lump's back: black
  return char + fireColor(0.1 + 0.4 * glow) * (3.0 * glow);     // … and the gaps deep orange and red, under the flame's own light
}
fn fireAir(F: FireRec, ro: vec3f, rd: vec3f, tMax: f32, cpix: f32, jit: f32) -> vec4f {
  let heat = F.b.y;
  if (heat <= 0.0) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let R = F.a.w; let H = F.b.x;
  var T = 1.0;
  let lean = 0.125 * length(F.c.xy) + 0.08;   // (fireFlame's bend at the flame's top, 0.055 × 1.7^1.5 a m/s, and its own sway and wobble)
  let cb = fireCyl(ro, rd, F.a.xyz, R * 1.9 + lean, -0.04, H * 1.7);
  let t0 = max(cb.x, 0.0); let t1 = min(cb.y, tMax);
  let em = fireEmbers(F, ro, rd, tMax, cpix, select(1e30, 0.5 * (t0 + t1), cb.x <= cb.y && t1 > t0));
  var acc = em.far;
  if (cb.x <= cb.y && t1 > t0) {
    let ds = (t1 - t0) / FIRE_STEPS;
    let glow = FIRE_GAIN * heat * (0.75 + 0.25 * F.c.z);
    var emb = vec3f(0.0);
    for (var i = 0.0; i < FIRE_STEPS; i += 1.0) {
      let fl = fireFlame(F, ro + rd * (t0 + (i + jit) * ds));
      if (fl.x <= 0.0) { continue; }
      let a = 1.0 - exp(-fl.x * heat * FIRE_SIGMA * ds);
      emb += T * fireColor(fl.y) * (a * glow);
      T *= 1.0 - a;
      if (T < 0.02) { break; }
    }
    acc = acc * T + emb;   // (an ember beyond the flame's middle is seen through the flame)
  }
  acc += em.near;
  // the bed of coals, seen from above through whatever flame stands on it: it hides the lid it lies on
  let Rb = F.d.x;
  if (Rb > 0.0 && rd.y < -1e-4 && ro.y > F.a.y) {
    let tb = (F.a.y + 0.004 - ro.y) / rd.y;
    if (tb > 0.0 && tb < tMax + 0.02) {
      let q = (ro + rd * tb).xz - F.a.xz; let r = length(q);
      let cover = 1.0 - smoothstep(Rb - max(2.0 * cpix * tb, 0.006), Rb, r);
      if (cover > 0.0) { acc += T * cover * fireCoals(F, q); T *= 1.0 - cover; }
    }
  }
  return vec4f(acc, T);
}
