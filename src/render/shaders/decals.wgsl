// ---- decals (E1; render/decals.ts writes the buffer; the decalBuf binding + layout consts DECAL_* are prepended by the host: gbuffer.ts at group 1 binding 3, passes.ts (composite, for the glass cracks) at binding 10) ----
// Evaluated in the g-buffer's fragment stage for box pixels: decalSurface(P, faceN, boxIdx) walks the 1 m cell's entries and edits the albedo /
// normal / gloss-keep the fragment is about to store. Nothing here samples a texture or takes a derivative, so the non-uniform loop is legal;
// every edge is softened over the pixel's own world footprint (fp) so a 2 cm hole seen from 14 m neither aliases nor crawls as the camera moves
// (the g-buffer is not jittered: what is written is what composite multiplies the light by, frame after frame).

const DK_BULLET: u32 = 1u;
const DK_SCORCH: u32 = 2u;
const DK_SCUFF: u32 = 3u;
const DK_CHIP: u32 = 4u;
const DK_GLASS: u32 = 5u;             // a round's hole + crack star ON a glass pane: never a g-buffer surface (panes are not rasterised) — composite.wgsl draws it via glassMarks below
const DK_WETPRINT: u32 = 6u;          // a wet shoe print (game/wet.ts: Sam in from the rain): heel + ball darkened / saturated like wet fabric, param = how wet (aged toward 0 on the CPU)
const DK_DAMAGE: u32 = 7u;            // the destruction lane's dent / shred / crack (damageMark; the look is floor(param))
const DECAL_PLANE_TOL: f32 = 0.03;    // m either side of the decal's plane a surface may sit and still take it (a rug on the scorched floor, a panel proud of the wall)
const DECAL_FACING: f32 = 0.6;        // min cos between the pixel's face normal and the decal's

struct DecalOut { albedo: vec3f, n: vec3f, keep: f32 };   // keep: multiplier composite applies to the glossy floors' specular (soot is matte)

fn dkHash(x: u32) -> u32 { var h = x * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return (h >> 22u) ^ h; }
fn dkRand(i: u32, seed: u32) -> f32 { return f32(dkHash(i ^ (seed * 0x9E3779B9u) ^ 0x5bd1e995u) & 0xffffffu) * (1.0 / 16777216.0); }
/** smooth periodic value noise round the circle: `cells` lattice points over 2π, C1 between them */
fn dkAngNoise(theta: f32, cells: f32, seed: u32) -> f32 {
  let u = (theta * (1.0 / 6.2831853) + 0.5) * cells;
  let c = u32(cells); let i0 = u32(floor(u)) % c; let i1 = (i0 + 1u) % c;
  let f = fract(u); let w = f * f * (3.0 - 2.0 * f);
  return mix(dkRand(i0, seed), dkRand(i1, seed), w);
}
/** smooth 1D value noise along a line (non-periodic) */
fn dkLineNoise(x: f32, seed: u32) -> f32 {
  let i = floor(x); let f = x - i; let w = f * f * (3.0 - 2.0 * f);
  let i0 = u32(i32(i) + 4096); return mix(dkRand(i0, seed), dkRand(i0 + 1u, seed), w);
}
/** smooth 2D value noise on a unit lattice (bilinear, smoothstepped) */
fn dkNoise2(p: vec2f, seed: u32) -> f32 {
  let i = floor(p); let f = p - i; let w = f * f * (3.0 - 2.0 * f);
  let ix = u32(i32(i.x) + 4096); let iy = u32(i32(i.y) + 4096);
  let a = dkRand(ix * 257u + iy, seed); let b = dkRand((ix + 1u) * 257u + iy, seed);
  let c = dkRand(ix * 257u + iy + 1u, seed); let d = dkRand((ix + 1u) * 257u + iy + 1u, seed);
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
/** how much of a texture of feature size `cell` (m) survives a pixel footprint fp: 1 while the pixel is finer, fading out as it gets coarser (no sub-pixel crawl) */
fn dkTexFade(cell: f32, fp: f32) -> f32 { return clamp(cell / max(fp, 1e-5), 0.0, 1.0); }

// A bullet hole in plaster / concrete / laminate: a near-black core (the hole itself, ~10 mm × calibre) ringed by the grey wipe the round leaves on the way
// in, a chip of irregular, partly missing outline where the finish flaked off round it (paler: the exposed gypsum / cement, shading darker into the crater),
// two or three hairline cracks running out of it, and the crater bevelled in the normal. q = in-plane offset (m) along (t, b); fp = pixel footprint (m).
fn bulletMark(o: ptr<function, DecalOut>, q: vec2f, R: f32, calibre: f32, seed: u32, fp: f32, t: vec3f, b: vec3f) {
  let rho = length(q); let theta = atan2(q.y, q.x);
  let aa = max(fp, 0.0008);
  // outlines: two octaves round the circle so the flake edge is jagged, and low enough in places that no chip shows there at all
  let nLow = dkAngNoise(theta, 11.0, seed);
  let nChip = 0.6 * nLow + 0.4 * dkAngNoise(theta, 29.0, seed + 3u);
  let rCore = 0.0095 * calibre * (0.85 + 0.3 * dkAngNoise(theta, 6.0, seed + 17u));
  let rChip = max(R * (0.42 + 0.62 * nChip), rCore);
  var core = 1.0 - smoothstep(rCore - 0.5 * aa, rCore + 0.5 * aa, rho);
  var chip = 1.0 - smoothstep(rChip - 0.7 * aa, rChip + 0.3 * aa, rho);
  core *= clamp(2.2 * rCore / aa, 0.0, 1.0);            // smaller than the pixel: fade by coverage instead of flickering in and out
  chip *= clamp(2.0 * rChip / aa, 0.0, 1.0);
  chip = max(chip - core, 0.0);
  let wipe = (1.0 - smoothstep(rCore + 0.0006, rCore + 0.0026 + 0.35 * aa, rho)) * (1.0 - core) * clamp(0.005 / aa, 0.0, 1.0);   // bullet wipe: the grey ring of lead / carbon hugging the hole
  var alb = (*o).albedo;
  let lum = dot(alb, vec3f(0.2126, 0.7152, 0.0722));
  let pale = min(mix(vec3f(lum), alb, 0.6) * 1.22 + vec3f(0.15), vec3f(0.9));    // exposed substrate: lighter and greyer than the finish, not white
  let grain = 1.0 + (dkNoise2(q * 320.0, seed + 5u) - 0.5) * 0.28 * dkTexFade(0.003, fp);   // granular spall (3 mm grain, gone once a pixel is coarser)
  let crater = mix(0.7, 1.0, smoothstep(rCore, rCore + 0.75 * (rChip - rCore) + 1e-4, rho));   // the flake bed slopes into the hole: darker toward it
  alb = mix(alb, pale * grain * crater, chip * 0.72);
  // hairline cracks out of the chip: 2 spokes at seeded angles, ~0.5 mm wide, a centimetre or two — resolved up close, faded to nothing at gameplay distance
  var crack = 0.0;
  for (var i = 0u; i < 2u; i++) {
    let ang = (dkRand(40u + i, seed) * 2.0 - 1.0) * 3.14159;
    let len = R * (0.75 + 0.7 * dkRand(50u + i, seed));
    let dv = vec2f(cos(ang), sin(ang));
    let along = dot(q, dv); let across = abs(q.x * dv.y - q.y * dv.x) + 0.12 * aa * dkLineNoise(along * 400.0, seed + i);
    let w = 0.0003 * (1.0 - smoothstep(len * 0.3, len, along));
    let c = (1.0 - smoothstep(w, w + 0.8 * aa, across)) * step(rCore, along) * (1.0 - smoothstep(len * 0.8, len, along));
    crack = max(crack, c * clamp(3.0 * w / aa, 0.0, 1.0));
  }
  alb *= 1.0 - 0.45 * crack * (1.0 - core);
  alb *= 1.0 - 0.55 * wipe;
  alb = mix(alb, vec3f(0.010, 0.009, 0.008), core * 0.97);
  (*o).albedo = alb;
  (*o).keep *= 1.0 - max(core, chip * 0.8);
  // the chip bed is a shallow cone into the wall: tilt the normal toward the centre across its smooth outline (light from one side catches the far rim; the
  // jagged flake edge stays in the albedo — tilting by it turns grazing light into glitter)
  let rBed = R * (0.42 + 0.62 * nLow);
  let bed = (1.0 - smoothstep(rBed - aa, rBed, rho)) * (1.0 - core) * clamp(2.0 * rChip / aa, 0.0, 1.0);
  if (rho > 1e-5 && bed > 0.01) {
    let dir = q / rho; let tilt = -(dir.x * t + dir.y * b) * (0.42 * bed);
    (*o).n = normalize((*o).n + tilt);
  }
}

// The scorch of a stun charge that went off on this surface: dense soot round a slightly paler blasted centre (the charge scoured the finish where it sat),
// thinning outward in streaky fingers to a ragged edge with a brown fringe. R = record radius (0.5–0.9 m), I = intensity 0‥1 (walls near the bang get a
// weaker, smaller one).
fn scorchMark(o: ptr<function, DecalOut>, q: vec2f, R: f32, I: f32, seed: u32, fp: f32) {
  let rho = length(q); let theta = atan2(q.y, q.x);
  let edge = 0.7 + 0.3 * dkAngNoise(theta, 13.0, seed);                    // ragged outline
  let x = rho / (R * edge);                                                 // 0 centre … 1 edge
  if (x >= 1.05) { return; }
  let fingers = dkAngNoise(theta, 7.0, seed + 3u) * dkAngNoise(theta, 19.0, seed + 5u);   // radial streaking, two beats round the circle so no regular teeth
  var soot = pow(1.0 - smoothstep(0.3, 1.0, x), 0.85);                      // dense over the inner third, then thinning
  soot *= mix(1.0, 0.55 + 0.9 * fingers, smoothstep(0.3, 0.8, x));          // the fingers only show where it thins
  soot = max(soot, 0.75 * (1.0 - smoothstep(0.5, 1.0, x)) * smoothstep(0.25, 0.6, fingers));   // the odd finger of soot carries on out toward the edge
  let centre = 1.0 - smoothstep(0.05, 0.18, x);                             // where the can lay: scoured, a little less soot on top
  soot *= 1.0 - 0.15 * centre;
  let fleck = 1.0 + (dkNoise2(q * 22.0, seed + 9u) - 0.5) * 0.18 * dkTexFade(0.045, fp);   // mottled (4.5 cm), smooth under a coarser pixel
  let k = clamp(soot * I * fleck, 0.0, 0.96);
  var alb = (*o).albedo;
  alb = mix(alb, mix(alb, vec3f(0.46, 0.44, 0.41), 0.5), centre * I * 0.15); // scoured finish
  let fringe = smoothstep(0.55, 1.0, x);
  alb *= mix(vec3f(1.0), vec3f(1.0, 0.83, 0.62), clamp(fringe * k * 3.0, 0.0, 0.65));   // brown where it is thin, at the edge
  alb = mix(alb, alb * vec3f(0.07, 0.064, 0.056) + vec3f(0.0025), k);       // soot proper
  (*o).albedo = alb;
  (*o).keep *= 1.0 - 0.94 * k;                                               // matte where the soot lies
}

// A boot's scuff on a kicked leaf: a dull smudge of grime the size of the ball of a foot, and across it three or four streaks of black rubber — slightly
// curved, tapering, catching and skipping — laid along t (the way the sole came across). L = the length of the whole mark; q.x along t.
fn scuffMark(o: ptr<function, DecalOut>, q: vec2f, L: f32, seed: u32, fp: f32) {
  let aa = max(fp, 0.0008);
  // the smudge: an irregular ellipse of low-contrast grime
  let e = length(vec2f(q.x / (0.55 * L), q.y / (0.34 * L)));
  var grime = (1.0 - smoothstep(0.45, 1.0, e + 0.25 * (dkNoise2(q * 30.0, seed + 21u) - 0.5)));
  grime *= 0.5 + 0.5 * mix(0.5, dkNoise2(q * 90.0, seed + 11u), dkTexFade(0.011, fp));
  // the rubber: streaks
  var dark = 0.0;
  let curve = (dkRand(77u, seed) - 0.5) * 1.4;                                // one bend for the whole mark: the foot swept one way
  for (var i = 0u; i < 3u; i++) {
    let r1 = dkRand(i, seed); let r2 = dkRand(i + 8u, seed); let r3 = dkRand(i + 16u, seed); let r4 = dkRand(i + 24u, seed);
    let broad = i == 0u;                                                       // one broad smear where the ball of the foot landed, two thin drags beside it
    let c = vec2f((r1 - 0.5) * 0.3 * L, select((r2 - 0.5) * 0.4 * L, 0.0, broad));
    let ang = (r3 - 0.5) * 0.1; let cs = cos(ang); let sn = sin(ang);
    let p = q - c; let u = cs * p.x + sn * p.y; var v = -sn * p.x + cs * p.y;
    let li = L * select(0.4 + 0.3 * r4, 0.75, broad); let wi = select(0.0025 + 0.003 * dkRand(i + 32u, seed), 0.011, broad);
    v -= u * u * curve;
    let un = u / li;
    let taper = 1.0 - smoothstep(0.3, 0.5, abs(un));
    let w = wi * (1.0 - 0.45 * smoothstep(0.0, 0.5, abs(un + 0.12)));          // broadest near where the sole landed, thinning as it dragged off
    var sk = (1.0 - smoothstep(w - 0.35 * w - 0.5 * aa, w + 0.5 * aa, abs(v))) * taper;
    sk *= 0.55 + 0.45 * dkLineNoise(u * 70.0 + f32(i) * 7.0, seed + i);      // density comes and goes along it
    sk *= clamp(2.0 * w / aa, 0.0, 1.0) * select(1.0, 0.7, broad);            // the smear is thinner rubber than the drags
    dark = max(dark, sk);
  }
  var alb = (*o).albedo;
  alb *= 1.0 - 0.35 * grime;
  alb = mix(alb, alb * 0.1 + vec3f(0.004), clamp(dark * 0.9, 0.0, 0.9));
  (*o).albedo = alb;
  (*o).keep *= 1.0 - max(0.4 * grime, dark);
}

// The chip a ring airfoil (or anything hard) knocks out of a painted surface: a small pale irregular spot, no hole.
fn chipMark(o: ptr<function, DecalOut>, q: vec2f, R: f32, seed: u32, fp: f32) {
  let rho = length(q); let theta = atan2(q.y, q.x);
  let aa = max(fp, 0.001);
  let rr = R * (0.5 + 0.5 * dkAngNoise(theta, 6.0, seed));
  var c = 1.0 - smoothstep(rr - aa, rr + 0.25 * aa, rho);
  c *= clamp(2.2 * rr / aa, 0.0, 1.0);
  let alb = (*o).albedo; let lum = dot(alb, vec3f(0.2126, 0.7152, 0.0722));
  let pale = min(mix(vec3f(lum), alb, 0.4) * 1.5 + vec3f(0.22), vec3f(0.86));
  (*o).albedo = mix(alb, pale, c * 0.7);
}

// A wet BOOT print: a heel block and a long forefoot block with the arch clear between them (rubber soles print two rounded slabs, not toes), water
// darkening and saturating the finish the way it does fabric — albedo^(1 + 0.6k) × (1 − 0.3k) — strongest round the rims where the water pools, mottled
// where the tread only half printed, the outline a little ragged. q.x runs heel → toe along t (the way he walked), q.y across; seed bit 0 = the right foot
// (mirrored: the forefoot cants and sits toward the big toe). k = how wet, 0‥1 (the CPU ages it toward 0).
fn dkSuper(e: vec2f, n: f32) -> f32 { let a = abs(e); return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n); }   // superellipse 'radius': 1 on the outline, squarer than an ellipse for n > 2
fn wetPrintMark(o: ptr<function, DecalOut>, q: vec2f, k: f32, seed: u32, fp: f32) {
  if (k <= 0.005) { return; }
  let aa = max(fp, 0.002);
  let side = select(1.0, -1.0, (seed & 1u) != 0u);           // +y = the big-toe side of the left foot
  let p = vec2f(q.x, q.y * side);
  let wob = (dkAngNoise(atan2(p.y, p.x), 9.0, seed | 1u) - 0.5) * 0.008;   // the tread, the way the weight came down
  // heel: a rounded slab 9 × 8 cm, a centimetre of arch between it and the forefoot
  let dh = dkSuper((p - vec2f(-0.085, -0.003)) / vec2f(0.045 + wob, 0.04 + wob), 2.6);
  // forefoot: one long rounded slab 15 × 10 cm, canted ~8° and set a little toward the big toe
  let cs = 0.99; let sn = 0.14;
  let pb = p - vec2f(0.048, 0.005);
  let rb = vec2f(cs * pb.x - sn * pb.y, sn * pb.x + cs * pb.y);
  let db = dkSuper(rb / vec2f(0.075 + wob, 0.05 + wob - 0.008 * clamp(-rb.x / 0.075, 0.0, 1.0)), 2.4);   // (a touch narrower toward the arch end)
  let soft = aa / 0.04;                                          // edge softness in the slabs' normalised units
  let heel = 1.0 - smoothstep(1.0 - 0.1 - soft, 1.0 + soft, dh);
  let ball = 1.0 - smoothstep(1.0 - 0.1 - soft, 1.0 + soft, db);
  var cov = max(heel, ball);
  if (cov <= 0.001) { return; }
  // wetter round the rim of each slab than in its middle (the sole squeezes the water outward), and mottled where the tread only half printed
  let rim = max(smoothstep(0.5, 0.95, dh) * heel, smoothstep(0.55, 0.95, db) * ball);
  let mott = mix(1.0, 0.5 + 0.5 * dkNoise2(p * vec2f(45.0, 70.0), seed + 3u), dkTexFade(0.015, fp));   // (stretched across: a hint of tread bars)
  let w = clamp(k * cov * (0.5 + 0.5 * rim) * mott, 0.0, 1.0);
  var alb = (*o).albedo;
  alb = pow(max(alb, vec3f(0.001)), vec3f(1.0 + 0.6 * w)) * (1.0 - 0.3 * w);
  (*o).albedo = alb;
}

// The destruction lane's marks (game/destruction.ts damageMark): ONE kind, three looks off floor(param) — 0 a DENT punched into sheet metal (a rack front, a
// cabinet): a shallow round dimple, its bowl tilted in the normal so one side catches the light, the paint crazed pale round a dark centre; 1 a SHRED in a
// fabric-covered partition or a chair back: a ragged dark tear with the pale wadding showing through and loose fibres round it; 2 a CRACK in a dark screen:
// a black impact blotch, a spider of hairlines out of it and a bruise of dead panel round them. s = fract(param) = strength 0‥1.
fn damageMark(o: ptr<function, DecalOut>, q: vec2f, R: f32, param: f32, seed: u32, fp: f32, t: vec3f, b: vec3f) {
  let look = u32(floor(param)); let s = clamp(fract(param) + 0.001, 0.05, 1.0);
  let rho = length(q); let theta = atan2(q.y, q.x);
  let aa = max(fp, 0.001);
  var alb = (*o).albedo;
  if (look == 0u) {   // dent
    let rr = R * (0.8 + 0.25 * dkAngNoise(theta, 5.0, seed));
    let x = rho / rr; if (x >= 1.2) { return; }
    let bowl = 1.0 - smoothstep(0.0, 1.0, x);
    if (rho > 1e-5) { let dir = q / rho; (*o).n = normalize((*o).n + (dir.x * t + dir.y * b) * (0.55 * s * bowl * smoothstep(0.05, 0.4, x))); }   // the far wall of the dimple faces back across it
    let craze = (1.0 - smoothstep(0.55, 1.0, x)) * smoothstep(0.2, 0.5, x) * (0.5 + 0.5 * dkNoise2(q * 260.0, seed + 3u)) * dkTexFade(0.004, fp);
    let lum = dot(alb, vec3f(0.2126, 0.7152, 0.0722));
    alb = mix(alb, min(vec3f(lum) * 1.6 + vec3f(0.25), vec3f(0.8)), craze * 0.35 * s);
    alb *= 1.0 - 0.5 * s * (1.0 - smoothstep(0.0, 0.35, x));
    (*o).keep *= 1.0 - 0.6 * bowl * s;
  } else if (look == 1u) {   // shred
    let ang = (dkRand(7u, seed) - 0.5) * 1.2; let cs = cos(ang); let sn = sin(ang);
    let u = cs * q.x + sn * q.y; let w = -sn * q.x + cs * q.y;
    let len = R * (0.7 + 0.5 * dkRand(8u, seed)); let un = u / len;
    if (abs(un) > 1.3) { return; }
    let half = max(0.0, R * 0.18 * (1.0 - 0.7 * un * un) * (0.6 + 0.8 * dkLineNoise(u * 90.0, seed + 5u)));
    let tear = (1.0 - smoothstep(half - 0.5 * aa, half + 0.5 * aa, abs(w))) * (1.0 - smoothstep(0.8, 1.05, abs(un)));
    let fray = (1.0 - smoothstep(half * 1.6, half * 3.2 + aa, abs(w))) * (1.0 - smoothstep(0.9, 1.25, abs(un))) * dkNoise2(vec2f(u * 400.0, w * 90.0), seed + 9u) * dkTexFade(0.006, fp);
    let wad = tear * (1.0 - smoothstep(0.0, 0.35, abs(w) / max(half, 1e-4) - 0.3)) * (0.6 + 0.4 * dkNoise2(q * 180.0, seed + 11u));
    alb = mix(alb, alb * 0.18 + vec3f(0.01), tear * s);
    alb = mix(alb, vec3f(0.78, 0.76, 0.7), wad * 0.55 * s);
    alb = mix(alb, alb * 1.35 + vec3f(0.06), fray * 0.5 * s);
  } else {   // crack (a dark screen)
    let core = (1.0 - smoothstep(R * 0.16, R * 0.3 + aa, rho * (0.8 + 0.4 * dkAngNoise(theta, 7.0, seed)))) * s;
    var crack = 0.0;
    let nRad = 5u + seed % 4u;
    for (var i = 0u; i < nRad; i++) {
      let a0 = dkRadialAng(i, nRad, seed); let dv = vec2f(cos(a0), sin(a0));
      let along = dot(q, dv); let lenI = R * (0.55 + 0.5 * dkRand(120u + i, seed));
      if (along <= 0.0 || along > lenI) { continue; }
      let across = (q.x * dv.y - q.y * dv.x) - (dkLineNoise(along * 60.0, seed + 31u * i) - 0.5) * 0.2 * along;
      let wI = 0.0006 * (1.0 - 0.6 * along / lenI);
      crack = max(crack, dkCrackCov(across, wI, aa) * (1.0 - smoothstep(0.8 * lenI, lenI, along)));
    }
    let bruise = (1.0 - smoothstep(R * 0.3, R * 0.95, rho)) * (0.5 + 0.5 * dkNoise2(q * 45.0, seed + 13u)) * s;
    alb = mix(alb, vec3f(0.004), max(core, crack * 0.85));
    alb = mix(alb, alb + vec3f(0.05, 0.02, 0.06), bruise * 0.6);   // the dead panel round the hit shows a faint violet bleed
    (*o).keep *= 1.0 - max(core, crack) * 0.9;                       // the glass finish is gone along the cracks
  }
  (*o).albedo = alb;
}

/** Every decal registered in the 1 m cell under P that faces like this pixel's surface, lies in its plane and (if attached) belongs to its box, applied oldest →
 *  newest to (albedo, n, keep). fp: the pixel's footprint on the surface in metres (edge softening / coverage fade). */
fn decalSurface(P: vec3f, faceN: vec3f, boxIdx: u32, albedo: vec3f, fp: f32) -> DecalOut {
  var o: DecalOut; o.albedo = albedo; o.n = faceN; o.keep = 1.0;
  let cx = i32(floor((P.x - WORLD_MIN.x) / GRID_CELL)); let cz = i32(floor((P.z - WORLD_MIN.z) / GRID_CELL));
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_H) { return o; }
  let ci = u32(cz * GRID_W + cx);
  let w = decalBuf[DECAL_CELL0 + (ci >> 2u)][ci & 3u];
  let count = min(w >> 16u, DECAL_LIST_CAP); let start = w & 0xffffu;
  for (var k = 0u; k < count; k++) {
    let e = start + k;
    let di = decalBuf[DECAL_LIST0 + (e >> 2u)][e & 3u];
    if (di >= DECAL_CAP) { continue; }
    let d0 = bitcast<vec4f>(decalBuf[DECAL_REC0 + di * 3u]);
    let v = P - d0.xyz; let R = d0.w; let reach = R + 0.04;
    if (dot(v, v) > reach * reach) { continue; }                     // outside the bounding sphere (one load for almost every reject)
    let d1 = bitcast<vec4f>(decalBuf[DECAL_REC0 + di * 3u + 1u]);
    let n = d1.xyz;
    if (dot(faceN, n) < DECAL_FACING) { continue; }                    // the back of the wall, the floor under a wall hole, the jamb beside the leaf
    let h = dot(v, n);
    if (abs(h) > DECAL_PLANE_TOL) { continue; }                        // a desk top above a floor scorch, the far face of a thin partition
    let d2u = decalBuf[DECAL_REC0 + di * 3u + 2u];
    let bits = d2u.w; let d2 = bitcast<vec3f>(d2u.xyz);   // (row 2 = tangent xyz as f32 bits + the record's bits word, read as the u32 it is — review R2.1 / R10.3)
    if ((bits & 8u) != 0u && (bits >> 16u) != boxIdx) { continue; }   // attached: its own box only (the leaf's scuff never prints on the frame it shuts against)
    let kind = bits & 7u; let seed = (bits >> 4u) & 0xfffu;
    if (kind == DK_GLASS) { continue; }                                // a crack star lives on its pane, not on the wall header sharing the pane's plane (composite draws it)
    let t = d2; let b = cross(n, t);
    let q = vec2f(dot(v, t), dot(v, b));
    if (kind == DK_BULLET) { bulletMark(&o, q, R, d1.w, seed, fp, t, b); }
    else if (kind == DK_SCORCH) { scorchMark(&o, q, R, d1.w, seed, fp); }
    else if (kind == DK_SCUFF) { scuffMark(&o, q, d1.w, seed, fp); }
    else if (kind == DK_CHIP) { chipMark(&o, q, R, seed, fp); }
    else if (kind == DK_WETPRINT) { wetPrintMark(&o, q, d1.w, seed, fp); }
    else if (kind == DK_DAMAGE) { damageMark(&o, q, R, d1.w, seed, fp, t, b); }
  }
  return o;
}

// ---- glass: a round's mark ON a pane (DK_GLASS) — evaluated by composite.wgsl at the point the view ray crosses the pane, from the same cell lists ----
// What a bullet does to laminated glazing: a hole the size of a pea, a collar of pulverised glass round it that has gone milky, and a star of cracks running
// out from it — some short and crazed, some long with a fork, the odd chord of the web joining two of them — stopped by the interlayer before the pane can
// fall. Three coverages come back and composite turns them into light: the crack lines and the collar cut what comes THROUGH the pane and catch what falls
// ON it (they are diffusers now), the hole is simply dark. Everything is drawn off the decal's 12-bit seed (glass.ts hashes it from where the pane was hit),
// in the pane's plane, in metres, softened over the pixel's footprint on the pane — with a floor under a crack's coverage, because a hairline that catches
// the light reads from across the room though it is a twentieth of a pixel wide.
struct GlassMarks { crack: f32, frost: f32, core: f32 };

/** distance from p to the segment a→b */
fn dkSegDist(p: vec2f, a: vec2f, b: vec2f) -> f32 { let ab = b - a; let h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0); return length(p - a - ab * h); }
/** coverage of a crack line at perpendicular distance `across` (m), half-width w, pixel footprint aa: antialiased over the footprint, floored so a sub-pixel hairline still shows */
fn dkCrackCov(across: f32, w: f32, aa: f32) -> f32 { return (1.0 - smoothstep(w, w + aa, abs(across))) * clamp(2.0 * w / aa, 0.3, 1.0); }
/** the i-th radial of a star of n: its direction angle (evenly dealt round the circle, jittered by up to ±40 % of a sector off the seed) */
fn dkRadialAng(i: u32, n: u32, seed: u32) -> f32 { return (f32(i) + (dkRand(100u + i, seed) - 0.5) * 0.8) * (6.2831853 / f32(n)); }
/** the same, for i up to 2n − 1: radial i mod n, one turn on (the web's chords between the last radial and the first need both ends on one branch of the angle) */
fn dkRadialAngW(i: u32, n: u32, seed: u32) -> f32 { return dkRadialAng(i % n, n, seed) + 6.2831853 * f32(i / n); }

/** One hit's star in the decal's own frame: q = in-plane offset from the hole (m, along t / b), R = the star's reach, strength = the record's param (1 = a
 *  round: hole + collar + star; < 0.9 = a blast's star: no hole, fainter collar), fp = pixel footprint on the pane (m). Three looks off seed % 3:
 *  0 STAR — nine to eleven radials most of the way out and two partial rings of the web; 1 CONE — a wide milky collar crazed with a dozen short radials, every
 *  fourth one running long, one tight ring; 2 RUNNERS — four to six long radials, each forking once, no rings. Accumulates into *m with max(). */
fn glassStar(m: ptr<function, GlassMarks>, q: vec2f, R: f32, strength: f32, seed: u32, fp: f32) {
  let rho = length(q); if (rho > R * 1.08) { return; }
  let theta = atan2(q.y, q.x);
  let aa = max(fp, 0.0004);
  let style = seed % 3u;
  let isRound = strength > 0.9;
  // the hole: 8 mm across, clean-edged; sub-pixel from across the room, so it fades by coverage rather than blinking
  let rCore = select(0.0, 0.004, isRound);
  var core = 0.0;
  if (isRound) { core = (1.0 - smoothstep(rCore - 0.5 * aa, rCore + 0.5 * aa, rho)) * clamp(2.0 * rCore / aa, 0.0, 1.0); }
  // the collar: pulverised glass gone white round the hole — dense at the rim, its edge ragged, a millimetre grain in it up close; wide on the cone look
  let rFrost = select(0.014, 0.024, style == 1u) * (0.75 + 0.5 * dkRand(3u, seed)) * select(0.7, 1.0, isRound);
  let fEdge = rFrost * (0.7 + 0.6 * dkAngNoise(theta, 9.0, seed + 1u));
  var frost = (1.0 - smoothstep(0.3 * fEdge, fEdge + 0.5 * aa, rho)) * clamp(1.6 * fEdge / aa, 0.0, 1.0);
  frost *= 0.7 + 0.3 * mix(0.5, dkNoise2(q * 900.0, seed + 7u), dkTexFade(0.0011, fp));
  frost = max(frost - core, 0.0) * select(0.55, 1.0, isRound);
  // the radials: out from the rim, drifting off their line in kinks every couple of centimetres, thinning to nothing at the tip
  let nRad = select(select(9u + seed % 3u, 12u + (seed >> 2u) % 4u, style == 1u), 4u + (seed >> 3u) % 3u, style == 2u);
  var crack = 0.0;
  for (var i = 0u; i < nRad; i++) {
    let ang = dkRadialAng(i, nRad, seed);
    let dv = vec2f(cos(ang), sin(ang));
    let along = dot(q, dv);
    var len = R * select(select(0.45 + 0.55 * dkRand(120u + i, seed), select(0.15 + 0.3 * dkRand(120u + i, seed), 0.7 + 0.3 * dkRand(140u + i, seed), (i & 3u) == 0u), style == 1u), 0.6 + 0.4 * dkRand(120u + i, seed), style == 2u);
    len *= 0.6 + 0.4 * strength;
    if (along < rCore * 0.5 || along > len) { continue; }
    let drift = (dkLineNoise(along * 45.0 + 3.0, seed + 31u * i) - 0.5) * 0.22 * along;      // lateral wander ∝ distance: the crack changes heading at each kink
    let across = (q.x * dv.y - q.y * dv.x) - drift;
    let w = 0.00045 * (1.0 - 0.65 * along / len) * (0.8 + 0.4 * strength);                    // ~0.9 mm at the rim, a third of that at the tip
    var c = dkCrackCov(across, w, aa) * (1.0 - smoothstep(0.82 * len, len, along));
    // runners fork once: a branch off the parent a third to two thirds of the way out, 25–55° aside, half the parent's length
    if (style == 2u) {
      let ab = len * (0.3 + 0.35 * dkRand(160u + i, seed));
      let side = select(-1.0, 1.0, dkRand(170u + i, seed) > 0.5);
      let bang = ang + side * (0.44 + 0.52 * dkRand(180u + i, seed));
      let bdv = vec2f(cos(bang), sin(bang));
      let pb = q - dv * ab - vec2f(-dv.y, dv.x) * ((dkLineNoise(ab * 45.0 + 3.0, seed + 31u * i) - 0.5) * 0.22 * ab);   // starts ON the wandering parent
      let bal = dot(pb, bdv); let blen = len * (0.35 + 0.3 * dkRand(190u + i, seed));
      if (bal > 0.0 && bal < blen) {
        let bacross = (pb.x * bdv.y - pb.y * bdv.x) - (dkLineNoise(bal * 50.0, seed + 47u * i) - 0.5) * 0.18 * bal;
        c = max(c, dkCrackCov(bacross, w * 0.75, aa) * (1.0 - smoothstep(0.8 * blen, blen, bal)));
      }
    }
    crack = max(crack, c);
  }
  // the web: a chord or two of the concentric cracks that join neighbouring radials (straight between them, as glass does it — not circles), most sectors
  // present, some missing; none on the runners look
  let nRing = select(select(2u, 1u, style == 1u), 0u, style == 2u);
  for (var j = 0u; j < nRing; j++) {
    let rj = R * select(select(0.2 + 0.15 * dkRand(200u + j, seed), 0.45 + 0.25 * dkRand(200u + j, seed), j == 1u), 0.12 + 0.08 * dkRand(200u, seed), style == 1u) * (0.6 + 0.4 * strength);
    if (abs(rho - rj) > 0.35 * rj + aa) { continue; }                                          // nowhere near this ring's band: skip the sector work
    // which sector (between radial k and k+1) holds theta: invert the un-jittered deal (dkRadialAng puts radial i at ≈ i·sector over 0‥2π, so bring atan2's
    // (−π, π] into that range first), then step once to the true jittered neighbours
    let sector = 6.2831853 / f32(nRad);
    let th = select(theta, theta + 6.2831853, theta < 0.0);
    var k = u32(floor(th / sector)) % nRad;
    var a0 = dkRadialAngW(k, nRad, seed); var a1 = dkRadialAngW(k + 1u, nRad, seed);
    if (th < a0) { a1 = a0; a0 = dkRadialAngW(k + nRad - 1u, nRad, seed) - 6.2831853; k = (k + nRad - 1u) % nRad; }   // jitter pushed radial k past theta: the sector is the one before (wrapping under radial 0)
    else if (th > a1) { a0 = a1; k = k + 1u; a1 = dkRadialAngW(k + 1u, nRad, seed); k = k % nRad; }                    // …or left radial k+1 short of it: the one after (wrapping past the last)
    if (dkRand(220u + k + 16u * j, seed) > 0.72) { continue; }                                  // this chord never formed
    let r0 = rj * (0.85 + 0.3 * dkRand(240u + k + 16u * j, seed)); let r1 = rj * (0.85 + 0.3 * dkRand(240u + ((k + 1u) % nRad) + 16u * j, seed));   // each end sits where it meets ITS radial, so neighbouring chords join up
    let p0 = vec2f(cos(a0), sin(a0)) * r0; let p1 = vec2f(cos(a1), sin(a1)) * r1;
    let d = dkSegDist(q, p0, p1);
    crack = max(crack, dkCrackCov(d, 0.0004 * (0.8 + 0.4 * strength), aa) * 0.85);
  }
  (*m).crack = max((*m).crack, crack * (1.0 - core));
  (*m).frost = max((*m).frost, frost);
  (*m).core = max((*m).core, core);
}

/** Every DK_GLASS decal registered in the 1 m cell under X that belongs to pane `paneBox` (static box index) and lies in its plane, accumulated. n = the pane's
 *  normal on the eye's side (a star shows from either face: the crack goes through the glass), fp = the pixel's footprint on the pane (m). */
fn glassMarks(X: vec3f, n: vec3f, paneBox: u32, fp: f32) -> GlassMarks {
  var m: GlassMarks; m.crack = 0.0; m.frost = 0.0; m.core = 0.0;
  let cx = i32(floor((X.x - WORLD_MIN.x) / GRID_CELL)); let cz = i32(floor((X.z - WORLD_MIN.z) / GRID_CELL));
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_H) { return m; }
  let ci = u32(cz * GRID_W + cx);
  let w = decalBuf[DECAL_CELL0 + (ci >> 2u)][ci & 3u];
  let count = min(w >> 16u, DECAL_LIST_CAP); let start = w & 0xffffu;
  for (var k = 0u; k < count; k++) {
    let e = start + k;
    let di = decalBuf[DECAL_LIST0 + (e >> 2u)][e & 3u];
    if (di >= DECAL_CAP) { continue; }
    let d2u = decalBuf[DECAL_REC0 + di * 3u + 2u];
    let bits = d2u.w; let d2 = bitcast<vec3f>(d2u.xyz);   // (row 2 = tangent xyz as f32 bits + the record's bits word, read as the u32 it is — review R2.1 / R10.3)
    if ((bits & 7u) != DK_GLASS || (bits >> 16u) != paneBox) { continue; }   // a star belongs to one pane (cracks stop at the frame; the pane behind in a double run stays clear)
    let d0 = bitcast<vec4f>(decalBuf[DECAL_REC0 + di * 3u]);
    let v = X - d0.xyz; let R = d0.w;
    if (dot(v, v) > (R + 0.03) * (R + 0.03)) { continue; }
    let d1 = bitcast<vec4f>(decalBuf[DECAL_REC0 + di * 3u + 1u]);
    let dn = d1.xyz;
    if (abs(dot(n, dn)) < DECAL_FACING || abs(dot(v, dn)) > DECAL_PLANE_TOL) { continue; }
    let t = d2; let b = cross(dn, t);
    glassStar(&m, vec2f(dot(v, t), dot(v, b)), R, d1.w, (bits >> 4u) & 0xfffu, fp);
  }
  return m;
}
