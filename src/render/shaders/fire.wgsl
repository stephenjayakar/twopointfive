// ---- AN OPEN FIRE, DRAWN (game/fire.ts FIRE; the composite adds it to the picture: composite.wgsl, beside the lasers' light in the air) ----
// A drum of burning wood is six things in the picture and this file is four of them: the FLAME, a volume of light marched where the pixel's ray crosses it; the
// SMOKE its tips turn into, marched with it; the BED OF COALS it stands on (a disc over the drum's mouth); and the SHIMMER of the hot air over it (fireShimmer:
// how far the picture behind is pushed aside). (The other two: its EMBERS are GPU particles, game/fire.ts; and it files real gas in the smoke solver.)
// Nothing here reads the scene: a record per fire, the look's numbers and the pixel's ray in, light and how much of what is behind is kept out — so the same text
// runs alone on a plain stage (tools/qa/fire-lab.cjs), where its look was set. Picture only: the game reads none of it (the fire's LIGHT is an engine light).
//   a = where the coals are (the middle of the drum's mouth) + the mouth's radius (m)      b = flame height (m) · heat 0‥1 · the fire's own seed 0‥1 · its clock (s)
//   c = the wind at the flame (x, z; m/s) · the light's flicker this frame (about 1) · spare      d = the bed of coals' radius (m; 0 = none drawn) · under the fog of war: 0 = drawn wherever it stands, 1 = only where the team sees, 2 = only where it does not (the composite's test: fireOver)
struct FireRec { a: vec4f, b: vec4f, c: vec4f, d: vec4f };   // (c.w: how much of this fire's flame is the solver's gas, 0‥1 — fireFlame)
// THE LOOK'S NUMBERS, the same for every fire (game/fire.ts FIRE.look, live in the page's fire lab):
//   a = × the flame's light · × its white heart · how soon it hides what is behind it (1/m) · × how fast it climbs
//   b = × its height · how torn it is 0‥2 · the smoke off its tips 0‥2 (0 = none) · the shimmer of the hot air over it (m the picture behind is pushed, 0 = none)
//   c = how dark and sooty its cool edge is 0‥1 · how hard it breathes 0‥2 · spare · spare
struct FireLook { a: vec4f, b: vec4f, c: vec4f, d: vec4f };   // (d: x = how far the temporal resolve is told to take a fire's pixels from THIS frame (0‥1) · y = how far the wind leans the flame (m at one flame height, per m/s))

const FIRE_STEPS = 40.0;        // samples of the flame along a pixel's ray when the look row names none (K.d.z = game/fire.ts FIRE.look.steps, 4‥64)
const FIRE_SMOKE_STEPS = 10.0;  // … and of the smoke over it
const FIRE_GAS_STEPS = 16.0;    // … and more of a flame that is the solver's gas: the wind carries it wider than the flame of noise ever stands
const FIRE_FLAME_TOP = 2.3;     // × its height: over this there is no flame, whatever its tongues do
const FIRE_SMOKE_TOP = 3.6;     // × its height: where the drawn smoke has thinned to nothing
const FIRE_SMOKE_SIGMA = 3.5;   // 1/m: how soon the smoke hides what is behind it
const FIRE_RISE = 1.7;          // m/s: how fast the shapes in the flame climb (a flame half a metre across: its gas leaves at two or three)
const FIRE_PUFF_HZ = 2.2;       // a fire this wide breathes about twice a second: a bulge leaves the coals and climbs

fn fireHu(x: u32) -> f32 { var h = x * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; h ^= h >> 22u; return f32(h >> 8u) * (1.0 / 16777216.0); }
fn fireL(i: vec3i) -> f32 { return fireHu((u32(i.x) * 73856093u) ^ (u32(i.y) * 19349663u) ^ (u32(i.z) * 83492791u)); }
/** value noise, 0‥1, one lattice cell a unit */
fn fireN(p: vec3f) -> f32 {
  let fl = floor(p); let i = vec3i(fl); let f = p - fl; let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(fireL(i), fireL(i + vec3i(1, 0, 0)), u.x), mix(fireL(i + vec3i(0, 1, 0)), fireL(i + vec3i(1, 1, 0)), u.x), u.y);
  let b = mix(mix(fireL(i + vec3i(0, 0, 1)), fireL(i + vec3i(1, 0, 1)), u.x), mix(fireL(i + vec3i(0, 1, 1)), fireL(i + vec3i(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}


/** the flame's light at a heat (0‥1), as scene radiance. Set against the picture's tone curve at the game's exposure (post.wgsl, AgX at 2), which keeps a red or an
 *  orange its colour only between about 0.1 and 1 and turns anything brighter pale: so the flame's EDGE and its tips live there (deep red, red, orange), and the
 *  inside climbs far over it on purpose — yellow at 3, a white heart at 14 that the bloom spreads. The first two cuts kept the whole flame at one brightness, the
 *  ground's: a flat pale shape. */
fn fireColor(hot: f32, core: f32) -> vec3f {
  var c = mix(vec3f(0.07, 0.004, 0.0), vec3f(0.30, 0.022, 0.0), smoothstep(0.0, 0.16, hot));
  c = mix(c, vec3f(0.62, 0.075, 0.002), smoothstep(0.14, 0.32, hot));
  c = mix(c, vec3f(1.05, 0.21, 0.008), smoothstep(0.3, 0.5, hot));
  c = mix(c, vec3f(1.9, 0.52, 0.02), smoothstep(0.48, 0.7, hot));
  c = mix(c, vec3f(3.4, 1.35, 0.09), smoothstep(0.68, 0.86, hot));
  return mix(c, vec3f(9.0, 4.3, 0.6) * core, smoothstep(0.84, 1.0, hot));
}
/** HOW FAR THE WIND LEANS A FIRE at height y (× its height), in metres a metre a second of wind (K.d.y = game/fire.ts FIRE.look.lean): as y^1.5 through the
 *  body of the flame, then on at two fifths of that slope — the flame lies over, its smoke and the bound that is marched for it do not run away downwind */
fn fireBend(K: FireLook, y: f32) -> f32 { let m = min(y, 1.5); return K.d.y * (m * sqrt(m) + 0.735 * max(y - 1.5, 0.0)); }
/** 1 − what the last fireAir's flame and smoke let through, its bed of coals left out: what of the pixel is new every frame (composite.wgsl fireReact) */
var<private> fireVeil: f32 = 0.0;
/** at P: x = how much flame (0‥1), y = how hot it is there (0‥1: its edge and its tips are the cool end), z = how much smoke (0‥1) */
fn fireFlameN(F: FireRec, K: FireLook, P: vec3f) -> vec3f {
  let R = F.a.w; let H = F.b.x * K.b.x; let t = F.b.w; let s = F.b.z * 61.0;
  var q = P - F.a.xyz;
  if (q.y < -0.04 || q.y > H * FIRE_SMOKE_TOP) { return vec3f(0.0); }
  let y = max(q.y, 0.0) / H;
  // the wind leans it, more the higher it stands, and it sways a little of its own accord
  let bend = fireBend(K, y);
  q.x -= F.c.x * bend + 0.035 * y * sin(t * 2.3 + s);
  q.z -= F.c.y * bend + 0.035 * y * cos(t * 1.9 + s * 1.7);
  if (length(q.xz) > R * (1.45 + 0.5 * y)) { return vec3f(0.0); }   // (the lick below moves a point R (0.15 + 0.6 y) at most, and nothing stands wider than R (1.1 + 0.15 y) after it)
  // it RISES: everything from here on is read in air that climbs, so the shapes travel up the flame and off its top
  let up = t * FIRE_RISE * K.a.w;
  // … and it LICKS: the whole column is pushed about by slow big eddies that climb with it
  let w1 = fireN(vec3f(q.x * 2.6 + s, (q.y - up * 0.8) * 2.1, q.z * 2.6)) - 0.5;
  let w2 = fireN(vec3f(q.x * 2.6 - s, (q.y - up * 0.8) * 2.1 + 7.3, q.z * 2.6 + 3.1)) - 0.5;
  let lick = K.b.y * R * (0.3 + 1.0 * min(y, 2.6));
  q.x += w1 * lick; q.z += w2 * lick;
  let r = length(q.xz);
  var f = 0.0; var hot = 0.0;
  if (y < FIRE_FLAME_TOP) {
    // it BREATHES: a bulge leaves the coals about twice a second and climbs, and the flame necks in behind it
    let puff = 1.0 + K.c.y * 0.17 * sin(6.2831853 * (FIRE_PUFF_HZ * t - q.y * 1.25) + s * 3.0);
    let rim = 1.0 - r / (R * (1.08 - 0.36 * min(y, 1.7)) * puff);   // 1 on the axis, 0 where the flame's side stands: it narrows as it climbs
    if (rim > -0.2) {
      // several tongues stand side by side on the coals, each its own height, and trade places: the top of the fire is a field of peaks
      let tn = 0.7 * fireN(vec3f(q.x / R * 1.4 + s, t * 1.9, q.z / R * 1.4 - s)) + 0.3 * fireN(vec3f(q.x / R * 3.4 - s, t * 3.7 + 5.0, q.z / R * 3.4 + s));
      let h = H * (0.26 + 1.5 * smoothstep(0.24, 0.78, tn)) * (0.5 + 0.5 * sqrt(max(rim, 0.0))) * (1.0 + 0.6 * (F.c.z - 1.0));   // (deep gaps between the tongues, so each one stands alone toward its tip)
      let yy = max(q.y, 0.0) / max(h, 1e-3);
      // torn by what rises through it: whole at the coals, ragged up its sides, loose islands at the top
      let n = 0.6 * fireN(vec3f(q.x * 8.0, (q.y - up * 1.25) * 5.0, q.z * 8.0) + s) + 0.4 * fireN(vec3f(q.x * 19.0, (q.y - up * 1.7) * 11.0, q.z * 19.0) - s);
      // HOW DEEP INSIDE THE FLAME this point is: 1 down in its heart, 0 at its skin — the less of its height above and its width beside, with the tearing
      let deep = min(1.0 - yy, rim * 2.2) + (n - 0.5) * K.b.y * (0.3 + 0.8 * min(yy, 1.3));
      f = smoothstep(0.0, 0.07, deep) * smoothstep(-0.01, 0.1, q.y) * (1.0 - smoothstep(FIRE_FLAME_TOP - 0.45, FIRE_FLAME_TOP, y));   // (open at its feet, so the coals are seen between its roots; and thinned out under the top of what is marched, so a tongue the light kicks tall is never cut flat there)
      // how hot is how deep: the skin and the tips deep red, orange under them, yellow inside and a white heart low over the coals
      hot = clamp(0.03 + 1.02 * deep * (1.0 - 0.24 * min(y, 1.5)) + (n - 0.5) * 0.3 * smoothstep(0.1, 0.4, deep), 0.0, 1.0);   // (… and what rises through it carries hotter and cooler streaks up with it)
    }
  }
  // THE SMOKE its tips turn into: a column that widens and thins as it climbs, slower than the flame, torn into wisps
  var sm = 0.0;
  if (K.b.z > 0.0 && y > 0.8) {
    let rs = 1.0 - r / (R * (0.55 + 0.42 * y));
    if (rs > 0.0) {
      let ns = 0.65 * fireN(vec3f(q.x * 5.0 + s, (q.y - up * 0.5) * 3.0, q.z * 5.0)) + 0.35 * fireN(vec3f(q.x * 12.0 - s, (q.y - up * 0.62) * 7.0, q.z * 12.0 + s));
      sm = smoothstep(0.46, 0.7, ns + 0.22 * rs) * smoothstep(0.0, 0.35, rs) * smoothstep(0.8, 1.7, y) * (1.0 - smoothstep(FIRE_SMOKE_TOP * 0.55, FIRE_SMOKE_TOP, y)) * (1.0 - f) * min(K.b.z, 2.0);
    }
  }
  return vec3f(f, hot, sm);
}
/** THE FLAME AS GAS (game/fire.ts FIRE.gas): HEAT the smoke solver carries on its fine lattice, filed at the coals with next to no smoke in it — what the
 *  solver lifts, curls and leans IS the flame's shape. `fireGas(p)` is that lattice's heat at p (the composite's: smoke_read.wgsl spgFineHot; a stand-alone
 *  build of this file gives it a 0). At P: x = how much flame, y = how hot: by the gas's own heat against the heart's (K.c.z) — it cools as it climbs, so the
 *  tips and the skin are the cool end with no rule saying so — and no flame under K.c.w of that. The lattice's cells are two centimetres: the tearing finer
 *  than a cell is the noise's, climbing with the gas. */
fn fireFlameG(F: FireRec, K: FireLook, P: vec3f) -> vec2f {
  let H = F.b.x * K.b.x; let q = P - F.a.xyz;
  if (q.y < -0.04 || q.y > H * FIRE_FLAME_TOP) { return vec2f(0.0); }
  let d = fireGas(P);
  if (d <= 0.0) { return vec2f(0.0); }
  let s = F.b.z * 61.0; let up = F.b.w * FIRE_RISE * K.a.w;
  let n = 0.6 * fireN(vec3f(q.x * 8.0, (q.y - up * 1.25) * 5.0, q.z * 8.0) + s) + 0.4 * fireN(vec3f(q.x * 19.0, (q.y - up * 1.7) * 11.0, q.z * 19.0) - s);
  let dn = d / max(K.c.z, 1e-4) * (1.0 + (n - 0.5) * 0.8 * K.b.y);
  let lo = K.c.w;
  let f = smoothstep(lo, lo + 0.12, dn) * smoothstep(-0.01, 0.06, q.y) * (1.0 - smoothstep(FIRE_FLAME_TOP - 0.45, FIRE_FLAME_TOP, q.y / H));
  return vec2f(f, clamp((dn - lo) / max(1.0 - lo, 1e-3), 0.0, 1.0));
}
/** at P: x = how much flame (0‥1), y = how hot it is there (0‥1: its edge and its tips are the cool end), z = how much drawn smoke (0‥1). A fire whose gas the
 *  solver has (F.c.w, eased 0‥1 by the game) is the gas's flame, and its smoke is the solver's alone; any other is the flame of noise. */
fn fireFlame(F: FireRec, K: FireLook, P: vec3f) -> vec3f {
  let gm = F.c.w;
  var a = vec3f(0.0);
  if (gm < 1.0) { a = fireFlameN(F, K, P); }
  if (gm <= 0.0) { return a; }
  let g = fireFlameG(F, K, P);
  let wa = a.x * (1.0 - gm); let wg = g.x * gm; let f = wa + wg;
  return vec3f(f, (wa * a.y + wg * g.y) / max(f, 1e-4), a.z * (1.0 - gm));
}
/** the smoke's own light at a height over the coals (y: × the flame's height): soot, lit from below by the fire it came off and dark above */
fn fireSmokeColor(y: f32, glow: f32) -> vec3f { return vec3f(0.030, 0.026, 0.024) + vec3f(0.26, 0.06, 0.006) * (glow * exp(-max(y - 0.9, 0.0) * 2.2)); }
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
/** how much wider than the flame of noise a fire whose flame is the solver's gas is marched (m): the wind carries real gas where it will */
fn fireGasWide(F: FireRec) -> f32 { return F.c.w * (0.35 + 0.45 * length(F.c.xy)); }
/** the cylinder nothing of this fire's flame or smoke leaves (the smoke leans downwind: the cylinder stands half that way and is that much wider). x = where
 *  the ray enters it, y = leaves. */
fn fireBound(F: FireRec, K: FireLook, ro: vec3f, rd: vec3f) -> vec2f {
  let H = F.b.x * K.b.x; let lean = fireBend(K, FIRE_SMOKE_TOP);
  return fireCyl(ro, rd, F.a.xyz + vec3f(F.c.x, 0.0, F.c.y) * (0.5 * lean), F.a.w * 3.6 + 0.5 * lean * length(F.c.xy) + 0.14 + fireGasWide(F), -0.04, H * FIRE_SMOKE_TOP);
}
/** THE BED OF COALS at a point of the drum's mouth (q: metres from its middle): what it glows, rgb. Lumps of char with fire in the gaps between them, the
 *  whole breathing slowly and with the light — the level's glowing lid alone is one flat bright plate. */
fn fireCoals(F: FireRec, K: FireLook, q: vec2f) -> vec3f {
  let t = F.b.w; let s = F.b.z * 37.0;
  let lump = fireN(vec3f(q.x * 20.0 + s, q.y * 20.0 - s, 0.5));                                   // a lump is a hand's width
  let fine = fireN(vec3f(q.x * 90.0 - s, q.y * 90.0 + s, t * 0.9));
  let breath = 0.5 + 0.5 * sin(t * 1.3 + 6.2831853 * fireN(vec3f(q.x * 11.0, q.y * 11.0, s)));     // each patch of it brightens and dims in its own time
  let gap = smoothstep(0.42, 0.7, lump + 0.25 * (fine - 0.5));                                     // 0 on a lump's back, 1 down between two
  let heat = F.b.y * (0.55 + 0.45 * breath) * (0.6 + 0.4 * F.c.z);
  let glow = gap * gap * heat;
  let char = vec3f(0.02, 0.006, 0.002) * (0.4 + fine);                          // a lump's back: black, a little warm
  return char + fireColor(0.2 + 0.62 * glow, 1.0) * (K.a.x * (0.25 + 0.75 * glow) * smoothstep(0.0, 0.25, glow));   // … and fire down in the gaps: red at their lips, yellow at the bottom
}
/** ONE FIRE along the ray ro + t·rd, 0 < t < tMax (the surface the pixel shows) → rgb = its light toward the eye, a = how much of what is behind it is kept.
 *  `cpix` = metres across a pixel per metre of distance, `jit` = 0‥1 per pixel and frame (the march's start offset). */
fn fireAir(F: FireRec, K: FireLook, ro: vec3f, rd: vec3f, tMax: f32, cpix: f32, jit: f32) -> vec4f {
  let heat = F.b.y; fireVeil = 0.0;
  if (heat <= 0.0) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let R = F.a.w; let H = F.b.x * K.b.x;
  var T = 1.0;
  let wl = length(F.c.xy);
  let glow = K.a.x * heat * (0.75 + 0.25 * F.c.z);
  // the flame's own cylinder, and the smoke's over it (wider, and further downwind)
  let fl = fireBend(K, FIRE_FLAME_TOP);   // (how far the flame's top leans a metre a second of wind: its cylinder stands half that way and is that much wider)
  let cb = fireCyl(ro, rd, F.a.xyz + vec3f(F.c.x, 0.0, F.c.y) * (0.5 * fl), R * 2.4 + 0.5 * fl * wl + 0.07 + fireGasWide(F), -0.04, H * FIRE_FLAME_TOP);
  let t0 = max(cb.x, 0.0); let t1 = min(cb.y, tMax); let inF = cb.x <= cb.y && t1 > t0;
  var emb = vec3f(0.0);
  // (the smoke first when the eye is under it, last when over: the camera looks down, so what is higher is nearer along most rays — march the two spans in the
  //  order the ray meets them)
  let lean = fireBend(K, FIRE_SMOKE_TOP);
  let sb = fireCyl(ro, rd, F.a.xyz + vec3f(F.c.x, 0.0, F.c.y) * (0.5 * lean), R * 3.6 + 0.5 * lean * wl + 0.14, H * FIRE_FLAME_TOP, H * FIRE_SMOKE_TOP);
  let s0 = max(sb.x, 0.0); let s1 = min(sb.y, tMax); let inS = K.b.z > 0.0 && sb.x <= sb.y && s1 > s0;
  for (var leg = 0; leg < 2; leg++) {
    let smokeNow = (leg == 0) == (inS && (!inF || s0 < t0));
    if (smokeNow) {
      if (!inS) { continue; }
      let ds = (s1 - s0) / FIRE_SMOKE_STEPS;
      for (var i = 0.0; i < FIRE_SMOKE_STEPS; i += 1.0) {
        let P = ro + rd * (s0 + (i + jit) * ds);
        let fl = fireFlame(F, K, P);
        if (fl.z <= 0.0) { continue; }
        let a = 1.0 - exp(-fl.z * heat * FIRE_SMOKE_SIGMA * ds);
        emb += T * fireSmokeColor((P.y - F.a.y) / H, glow) * a;
        T *= 1.0 - a;
      }
    } else {
      if (!inF) { continue; }
      let steps = select(FIRE_STEPS, clamp(floor(K.d.z), 4.0, 64.0), K.d.z >= 1.0) + FIRE_GAS_STEPS * step(0.001, F.c.w); let ds = (t1 - t0) / steps;
      for (var i = 0.0; i < steps; i += 1.0) {
        let P = ro + rd * (t0 + (i + jit) * ds);
        let fl = fireFlame(F, K, P);
        let sF = fl.x * K.a.z; let sS = fl.z * FIRE_SMOKE_SIGMA;
        if (sF + sS <= 0.0) { continue; }
        let a = 1.0 - exp(-(sF + sS) * heat * ds);
        // (its cool skin is soot: K.c.x darkens what the skin gives, and it hides what is behind all the same — a dark red edge against lit ground)
        let cF = fireColor(fl.y, K.a.y) * (glow * mix(1.0, smoothstep(0.0, 0.3, fl.y), K.c.x));
        emb += T * (cF * sF + fireSmokeColor((P.y - F.a.y) / H, glow) * sS) * (a / (sF + sS));
        T *= 1.0 - a;
        if (T < 0.02) { break; }
      }
    }
  }
  var acc = emb; fireVeil = 1.0 - T;
  // the bed of coals, seen from above through whatever flame stands on it: it hides the lid it lies on
  let Rb = F.d.x;
  if (Rb > 0.0 && rd.y < -1e-4 && ro.y > F.a.y) {
    let tb = (F.a.y + 0.004 - ro.y) / rd.y;
    if (tb > 0.0 && tb < tMax + 0.02) {
      let q = (ro + rd * tb).xz - F.a.xz; let r = length(q);
      let cover = 1.0 - smoothstep(Rb - max(2.0 * cpix * tb, 0.006), Rb, r);
      if (cover > 0.0) { acc += T * cover * fireCoals(F, K, q); T *= 1.0 - cover; }
    }
  }
  return vec4f(acc, T);
}
/** THE SHIMMER of the hot air over a fire: how far the picture BEHIND it is pushed aside where the pixel's ray passes its column — xy = metres across and up the
 *  picture (the caller turns them into pixels at distance z), z = how far along the ray the column is (nothing nearer than that may be pushed). 0 = none. */
fn fireShimmer(F: FireRec, K: FireLook, ro: vec3f, rd: vec3f) -> vec3f {
  let amp = K.b.w * F.b.y;
  if (amp <= 0.0) { return vec3f(0.0); }
  let R = F.a.w; let H = F.b.x * K.b.x; let t = F.b.w;
  // where the ray passes nearest the fire's axis (the upright line through the coals)
  let w = ro - F.a.xyz; let b = rd.y; let d = dot(rd, w); let e = w.y; let den = 1.0 - b * b;
  if (den < 1e-4) { return vec3f(0.0); }
  let tr = (b * e - d) / den; let sa = e + b * tr;   // along the ray, and up the axis
  if (tr <= 0.0 || sa < 0.0 || sa > H * 4.2) { return vec3f(0.0); }
  // (the hot air leans downwind with the flame under it: the nearest approach again, to the axis moved as far as it leans at that height)
  let bn0 = fireBend(K, sa / H); let w2 = w - vec3f(F.c.x * bn0, 0.0, F.c.y * bn0);
  let tr2 = (b * e - dot(rd, w2)) / den; let sa2 = e + b * tr2;
  if (tr2 <= 0.0 || sa2 < 0.0 || sa2 > H * 4.2) { return vec3f(0.0); }
  let y = sa2 / H; let wd = R * (1.3 + 0.7 * y) + 0.5 * K.d.y * y * length(F.c.xy);
  let bn = fireBend(K, y);
  let off = (ro + rd * tr2) - (F.a.xyz + vec3f(F.c.x * bn, sa2, F.c.y * bn));
  let k = exp(-dot(off, off) / (wd * wd)) * smoothstep(0.0, 0.5, y) * (1.0 - smoothstep(2.4, 4.2, y));
  if (k < 0.01) { return vec3f(0.0); }
  let up = t * FIRE_RISE * K.a.w * 0.9; let s = F.b.z * 17.0;
  let n1 = fireN(vec3f(off.x * 14.0 + s, (sa2 - up) * 9.0, off.z * 14.0)) - 0.5;
  let n2 = fireN(vec3f(off.x * 14.0 - s, (sa2 - up) * 9.0 + 4.7, off.z * 14.0 + 2.3)) - 0.5;
  return vec3f(vec2f(n1, n2) * (2.0 * amp * k), tr2);
}
