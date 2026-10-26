// Half-resolution (a third with the lossy gatherThird option: frame.lossyCfg.x is the divisor) stochastic final gather. Per pixel: K cosine-distributed rays traced for real through the box grid
// (+ character capsules); at each hit the outgoing radiance is albedo/pi x (steady direct light, one importance-picked
// shadow ray + the exact unshadowed rest at half weight for the dim tail) + the cached multi-bounce irradiance (dice
// volume, read one bounce away from the eye where its coarseness cannot be seen) + emission; misses take the sky.
// Output is irradiance E at the primary hit (albedo applied in composite). History-accumulated + à-trous filtered
// downstream; transient lights never enter (they light the first hit directly through the history-free direct pass).
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var gId: texture_2d<u32>;
@group(1) @binding(3) var directTex: texture_2d<f32>;    // denoised on-screen direct (sharp class) — reused when a gather ray lands on a visible surface
@group(1) @binding(4) var softTex: texture_2d<f32>;      // (broad class)
@group(1) @binding(5) var diceTex: texture_3d<f32>;
@group(1) @binding(6) var outIndirect: texture_storage_2d<rgba16float, write>;   // rgb = E estimate (a unused: temporal overwrites it with view depth)
@group(1) @binding(7) var outSpecular: texture_storage_2d<rgba16float, write>;  // rgb = glossy-floor reflection radiance toward the eye, Fresnel-weighted (FLAG_GLOSS only: nothing is stored with the flag off; a unused, as above)
@group(1) @binding(8) var cardsTex: texture_2d<f32>;      // torch bounce cards (cards.wgsl, rebuilt this frame; FLAG_BOUNCE_CARDS): texel (k, row), rows (C, R) · (n, slot) · (Φ_L, rq) · (Cq, 1)
// GI IN MOTION (docs/internal/gi-motion.md; `main` only, frame.giCfg.x > 1): LAST frame's diffuse-denoiser moments (history length in .z) and value history (view depth in .a) — the gather-grid pair, or the
// internal-res pair while settings.giFullRes runs (the texture's own size says which) — and the frame's first-come counter of texels that took the extra rays
@group(1) @binding(14) var giMomPrev: texture_2d<f32>;
@group(1) @binding(15) var giHistPrev: texture_2d<f32>;
struct GiYoung { count: atomic<u32>, pad0: u32, pad1: u32, pad2: u32 };
@group(1) @binding(16) var<storage, read_write> giYoung: GiYoung;

override RAYS: u32 = 4u;
const TMAX: f32 = 40.0;
const CARD_MIN_E: f32 = 0.002;       // torch bounce cards: below this much unshadowed card irradiance (W/m², all cards) a pixel takes it without a shadow ray — under a percent of display white after the tonemap on any albedo, where a bounce shadow cannot be seen (the direct pass credits negligible tails unshadowed the same way)
// glossy floors (FLAG_GLOSS, glossRay / mirrorTail below)
const GLOSS_F0: f32 = 0.04;          // dielectric finish (stone sealer, waxed lino) at normal incidence — Schlick takes it to ~0.044 at this camera's 35-50° and 0.10 at 65°
const GLOSS_STRENGTH: f32 = 0.85;    // fraction of an ideal Fresnel coat the finish keeps (scuffs, dust)
const GLOSS_SPREAD: f32 = 0.0437;    // tan 2.5°: the mirror ray is jittered uniformly over a cone of this half-angle — a slightly rough polish; the specular history + one à-trous pass integrate it
const GLOSS_ALPHA: f32 = 0.0436;     // that half-angle in radians (the lobe's angular radius, for the analytic glints)
const GLOSS_SPILL: f32 = 0.005;      // a spot light's lens seen from outside its beam still shows this fraction of its on-axis radiance (reflector scatter): a torch held level glints in the floor as a clear dot (the guards' 70 W/sr behind a 7 cm lens at 1.5 m → ≈ 21 in the lobe → ≈ 0.8 scene-referred after Fresnel: bright, no bloom to speak of), and flares to GLOSS_GLINT_MAX when the beam swings through the mirror direction
const GLOSS_RAY_MAX: f32 = 24.0;     // luminance bound on what the one traced ray may bring back (the gather's own firefly bound: a lit panel ≈ 11 passes whole)
const GLOSS_GLINT_MAX: f32 = 160.0;  // …and on the analytic glints, which are noise-free and may therefore run far brighter (a torch lens is thousands: white after Fresnel, not a sun)

// (light / card staging, the RNG and directAtPoint live in gather_common.wgsl — shared with reflect.wgsl — and are prepended by passes.ts)

fn cosineDir(N: vec3f) -> vec3f {
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  let r = sqrt(rnd()); let a = rnd() * 6.2831853;
  return normalize(T * (cos(a) * r) + B * (sin(a) * r) + N * sqrt(max(1.0 - r * r, 0.0)));
}
// STRATIFIED GATHER DIRECTIONS (settings.gatherStrata; ported from exp/trace-perf E8, docs/internal/trace-perf.md §2.10): the gather's k-th ray of K drawn from STRATUM (k + frame) mod K
// of the cosine hemisphere — for the main gather's four rays (azimuth half) × (cos²θ half), each pixel jittering inside its stratum with its own two rnd() as before — instead of iid.
// Every pixel still covers all K strata every frame (a stratified estimate: the same expectation, never more variance than iid), the rng draws the same COUNT of numbers, but the k-th
// rays of a whole 8×8 tile now share a stratum, i.e. a quarter of direction space: the lanes of a SIMD group walk more of the same grid cells (the trace lab measured 1.25× on such
// rays; −13‥16 % of the gather pass at high). `const GATHER_STRATA: bool` is prepended by passes.ts (false / true → the pFG·pFGR / pFGs·pFGRs pipeline pairs, picked each frame by
// passes.gatherStrata); false = cosineDir exactly as it was — the branch below folds away and the module compiles to the program it always was.
fn cosineDirK(N: vec3f, k: u32, K: u32) -> vec3f {
  if (!GATHER_STRATA) { return cosineDir(N); }
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  let s = (k + frame.frameIdx) % K;
  var u = rnd(); var v = rnd();                                              // u = r² (cos²θ = 1 − u), v = azimuth ÷ 2π — the same two draws as cosineDir
  if (K == 4u) { u = (f32(s & 1u) + u) * 0.5; v = (f32(s >> 1u) + v) * 0.5; }   // four rays: (azimuth half) × (cos²θ half)
  else if (K == 2u) {                                                          // two rays over the same four cells as a Latin square: ray k takes cos²θ half (k + frame/2) and azimuth half (k + frame) —
    let f = frame.frameIdx;                                                    // every frame still covers both azimuth halves and both θ bands, the pairing alternates
    u = (f32((k + (f >> 1u)) & 1u) + u) * 0.5; v = (f32((k + f) & 1u) + v) * 0.5;
  }
  else { v = (f32(s) + v) / f32(K); }                                          // K rays: K azimuth sectors
  let r = sqrt(u); let a = v * 6.2831853;
  return normalize(T * (cos(a) * r) + B * (sin(a) * r) + N * sqrt(max(1.0 - u, 0.0)));
}

// ---- glossy floors (FLAG_GLOSS): the mirror ray (glossRay, traced in main's loop, mirrorTail), and the two helpers it needs ----
// Fraction of a disc of (angular) radius a covered by a disc of radius b whose centre lies g away — plain circle–circle overlap over pi·a²
// (small angles: the lobe and an emitter's outline treated as flat discs on the sphere). Concentric → min(1, b²/a²); apart → 0; smooth between.
fn discOverlap(a: f32, b: f32, g: f32) -> f32 {
  if (g >= a + b) { return 0.0; }
  if (g <= abs(a - b)) { return min(1.0, (b * b) / (a * a)); }
  let x = (g * g + a * a - b * b) / (2.0 * g);          // centre of disc a → the chord (g > |a − b| ≥ 0 here, so no division by zero)
  let y = sqrt(max(a * a - x * x, 0.0));                // half chord (the same for both discs)
  let x2 = g - x;
  let lens = a * a * acos(clamp(x / a, -1.0, 1.0)) - x * y + b * b * acos(clamp(x2 / b, -1.0, 1.0)) - x2 * y;
  return clamp(lens / (3.14159265 * a * a), 0.0, 1.0);
}

// The lobe's view of the small bright emitters the tracer cannot see. Torch and rail-light lenses, beacon domes, the storage bulb, street-lamp
// heads are NoShadow glow cards or no geometry at all — a reflection RAY never finds them (and if it could, a 5 cm lens caught by one jittered
// ray in five would be firefly bait). So every steady point / spot light's emitting disc (li.pos, li.radius; a spot's faces li.dir) is folded
// into the GLOSS_ALPHA cone around the mirror direction R analytically: the fraction of the cone its outline covers × the disc's radiance
// (on-axis intensity ÷ disc area — for a spot × its own angular falloff toward this point, floored at GLOSS_SPILL in front of the lens) × one
// shadow ray (and the smoke on it) when that is nonzero. Every input is smooth, so the glint sits still without history: a beacon's sweeps
// past as a pulse, a walking guard's torch glides. In expectation it is what the jittered ray would integrate if the lens were traceable.
// Area lights (kind 3) stay with the ray — their fixture boxes ARE traceable and carry the emission, so counting them here would double
// them — and the moon (kind 2) is never in a mirror direction this camera can produce. (The one traceable lit fixture of a point/spot light,
// the manager's desk-lamp head, cannot be mirrored by any polished floor from up here.)
fn glossGlints(Po: vec3f, R: vec3f, owner: u32) -> vec3f {
  var G = vec3f(0.0);
  for (var i = 0u; i < nL; i++) {
    let li = wgLights[i];
    let kind = lightKind(li);
    if (kind >= 2u || li.radius <= 0.0 || lightTransient(li)) { continue; }   // flashes stay out of anything with history (the direct pass shows them)
    let d = li.pos - Po; let dist = length(d);
    if (dist > li.range || dist < 0.05) { continue; }
    let Ld = d / dist;
    let cosG = dot(Ld, R);
    if (cosG < 0.95) { continue; }                       // 18° off the mirror direction: no emitter here subtends anything like that (cheap reject before the trig)
    let g = atan2(length(cross(Ld, R)), cosG);           // angle between R and the emitter's centre (well conditioned near 0, unlike acos)
    let over = discOverlap(GLOSS_ALPHA, atan(li.radius / dist), g);
    if (over <= 0.0) { continue; }
    var Le = li.color * (lightWindow(dist, li.range) / (3.14159265 * li.radius * li.radius));   // li.color = colour × on-axis intensity (W/sr); a disc of area pi r² showing that intensity has this radiance — windowed by range exactly as evalLight windows the light itself, so a glint fades out with its light instead of popping at range
    if (kind == 1u) {
      let cd = dot(-Ld, normalize(li.dir));
      if (cd <= 0.0) { continue; }                       // behind the lens
      Le *= max(smoothstep(li.cosOuter, li.cosInner, cd), GLOSS_SPILL);
    }
    if (!lightReaches(i, Po)) { continue; }              // walled off from this cell (reach.ts): no ray needed to know
    let tmax = dist - li.radius - 0.02;
    if (tmax > 0.0 && occluded(Po, Ld, tmax, owner | ((li.owner & 0xffu) << 8u))) { continue; }   // the same skip rule every shadow ray toward this light uses (its carrier never hides it)
    var tr = 1.0;
    if (frame.numSmoke > 0u) { tr = smokeTransmittance(Po, Ld, min(max(tmax, 0.0), 30.0)); }
    G += Le * (over * tr);
  }
  return G;
}

// The radiance a polished floor at P (a BOX_GLOSS top face, N = +y) mirrors toward the eye. ONE reflection ray — the view direction reflected
// about the normal, jittered over a GLOSS_SPREAD cone — traced through the scene like a gather ray and shaded like a gather hit: emission (here
// INCLUDING area-lit fixtures: a mirror shows the glowing panel / screen / vending front itself, whereas the diffuse paths take those through
// their analytic lights) + albedo/pi × (direct at the hit — the exact on-screen textures when the hit is visible, else the one-shadow-ray
// estimate — + the cached bounce), the sky on a miss; plus the analytic glints of the small emitters no ray can see (above); then Schlick's
// Fresnel on the VIEW angle × the finish's strength. It is specular — never multiplied by the floor's albedo — so it leaves through its own
// texture (outSpecular → history + one à-trous pass in passes.ts → composite adds it after the diffuse terms). Called after the gather's
// rays: two rnd() for the cone plus whatever directAtPoint's pick draws, none of which the indirect estimate ever sees.
// The hit distance of the last reflection ray traced for this texel (mirrorTail writes it; main stores it in outSpecular.a for the v3 denoiser's specular client —
// its virtual-hit-point reprojection; nothing on the legacy path reads that alpha). Sky / no ray = a large number.
var<private> specHitT: f32 = 1e4;

// ---- torch bounce cards (FLAG_BOUNCE_CARDS): the cards' light at the shading point P (normal N) ----
// Per live card: the patch as FOUR sub-emitters at its flux RMS radius rq round its flux centroid Cq (cards.wgsl), each a quarter of Φ_L (= radiance × area)
// with the one-sided Lambertian emitter cosine (n), the receiver cosine (N), and 1 / (r² + rq²/2) — the on-axis-exact form Φ/(r² + a²) of a uniform disc of
// radius a, for a disc of RMS radius rq cut in four (R² = 2 rq², a² = R²/4): the far field of evalLight's kind-3 term, without its 1/max(d², R²) kink up
// close. Then ONE shadow ray for all of them, toward a point drawn uniformly over the equivalent disc (radius √2·rq, capped at the claim radius) of a card
// picked ∝ its unshadowed luminance here — the direct pass's tail rule: exact where one card dominates, which round a torch it does — with the smoke on that
// segment when smoke is up. Under CARD_MIN_E in all it is credited unshadowed (no ray). Every input is smooth, so the term holds still under the temporal
// filter; the visibility sample only shows inside real bounce shadows. Draws its rnd() AFTER the gather's rays, so those are value for value what they were.
fn cardIrradiance(P: vec3f, N: vec3f, Po: vec3f, owner: u32, pix: vec2u) -> vec3f {
  var Esum = vec3f(0.0); var Wsum = 0.0; var pick = -1;
  for (var k = 0u; k < nC; k++) {
    let c0 = wgCards[k * 4u]; let c2 = wgCards[k * 4u + 2u];
    if (c0.w <= 0.0) { continue; }
    let n = wgCards[k * 4u + 1u].xyz; let Cq = wgCards[k * 4u + 3u].xyz; let rq = c2.w;
    if (dot(n, P - Cq) <= 0.01) { continue; }               // behind or on the card's plane: a plane does not light itself (the wall round the spot gets nothing from it)
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.9);
    let T = normalize(cross(up, n)); let B = cross(n, T);
    var gsum = 0.0;
    for (var i = 0u; i < 4u; i++) {
      let a = 0.7853982 + f32(i) * 1.5707963;
      let d = (Cq + (T * cos(a) + B * sin(a)) * rq) - P;
      let r2 = dot(d, d); let L = d * inverseSqrt(max(r2, 1e-6));
      gsum += max(dot(N, L), 0.0) * max(dot(n, -L), 0.0) / (r2 + 0.5 * rq * rq);
    }
    let Ek = c2.xyz * (0.25 * gsum);
    let w = luminance(Ek);
    if (w < 1e-6) { continue; }
    Esum += Ek; Wsum += w;
    if (rnd() * Wsum < w) { pick = i32(k); }
  }
  if (pick < 0 || Wsum < CARD_MIN_E) { return Esum; }
  let k = u32(pick); let c0 = wgCards[k * 4u]; let n = wgCards[k * 4u + 1u].xyz; let Cq = wgCards[k * 4u + 3u].xyz; let rq = wgCards[k * 4u + 2u].w;
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.9);
  let T = normalize(cross(up, n)); let B = cross(n, T);
  // the disc point: a per-pixel R2 sequence stepped by the frame index (radius² and angle on two irrational strides off an interleaved-gradient offset), not two
  // fresh rnd() — every run of consecutive frames then covers the disc evenly, so the history's running average of this ONE visibility sample settles on the
  // patch's fractional visibility instead of wandering round it: the flicker in a bounce shadow's penumbra measured 3× lower for the same ray (perf doc, A.4)
  let fi = f32(frame.frameIdx & 1023u);
  let ur = fract(ign(vec2f(pix)) + fi * 0.7548777); let ua = fract(ign(vec2f(pix.yx) + 17.0) + fi * 0.5698403);
  let r = sqrt(ur) * min(1.4142 * rq, c0.w); let a = ua * 6.2831853;
  let d = (Cq + (T * cos(a) + B * sin(a)) * r + n * 0.02) - Po;
  let dist = length(d); let L = d / dist;
  var vis = 1.0;
  // a visibility sample drawn BELOW the receiver's horizon is not evidence of occlusion (the quadrature already zeroes below-horizon emitter points): test
  // occlusion / smoke only for a sample the receiver can face — else a receiver whose tangent plane cuts the disc (a desk top level with a wall spot, the
  // floor under a low spot) had its whole card sum zeroed on the frames the point fell below the plane: systematic darkening + a 0/1 alternation (review MED #1)
  if (dot(L, N) > 0.0) {
    if (occluded(Po, L, max(dist - 0.03, 0.0), owner)) { vis = 0.0; }
    else if (frame.numSmoke > 0u) { vis = smokeTransmittance(Po, L, min(dist, 30.0)); }
  }
  return Esum * vis;
}

/** the dust on a pane at Pg (normal n on the eye's side): every steady light's irradiance ON the pane, the two strongest shadow-tested (+ smoke), the rest at half credit unshadowed, × GLASS_DUST/π (0 with the knob or the direct light off) */
fn glassDust(Pg: vec3f, n: vec3f) -> vec3f {
  let kd = frame.glassCfg.z * GLASS_DUST;
  if (kd > 0.0 && (frame.flags & FLAG_DIRECT) != 0u) {
    var e0 = vec3f(0.0); var e1 = vec3f(0.0); var w0 = 0.0; var w1 = 0.0; var i0 = -1; var i1 = -1;
    var L0 = vec3f(0.0); var L1 = vec3f(0.0); var d0 = 0.0; var d1 = 0.0; var rest = vec3f(0.0);
    for (var i = 0u; i < nL; i++) {
      let li = wgLights[i];
      if (lightTransient(li)) { continue; }                 // flashes stay out of anything with history
      if (!lightReaches(i, Pg)) { continue; }               // walled off from the pane's cell (reach.ts)
      let ev = evalLight(li, Pg, vec3f(0.0));
      if (!ev.ok) { continue; }
      let E = ev.E * abs(dot(n, ev.L));
      let w = luminance(E);
      if (w < 1e-4) { continue; }
      if (w > w0) { rest += e1; e1 = e0; w1 = w0; i1 = i0; L1 = L0; d1 = d0; e0 = E; w0 = w; i0 = i32(i); L0 = ev.L; d0 = ev.dist.x; }
      else if (w > w1) { rest += e1; e1 = E; w1 = w; i1 = i32(i); L1 = ev.L; d1 = ev.dist.x; }
      else { rest += E; }
    }
    var Ed = rest * 0.5;
    for (var k = 0; k < 2; k++) {
      let ii = select(i1, i0, k == 0); if (ii < 0) { continue; }
      let li = wgLights[u32(ii)]; let Ld = select(L1, L0, k == 0); let dd = select(d1, d0, k == 0); let E = select(e1, e0, k == 0);
      let side = Pg + n * (0.015 * sign(dot(n, Ld)));        // start on the face the light is on
      let tmax = select(dd - li.radius - 0.02, 60.0, lightKind(li) == 2u);
      if (tmax > 0.0 && occluded(side, Ld, tmax, (li.owner & 0xffu) << 8u)) { continue; }
      var tr = 1.0;
      if (frame.numSmoke > 0u) { tr = smokeTransmittance(side, Ld, min(max(tmax, 0.0), 30.0)); }
      Ed += E * tr;
    }
    return Ed * (kd / 3.14159265);
  }
  return vec3f(0.0);
}
// ---- glass panes (FLAG_GLASS): what a pane ADDS toward the eye at the point the view ray crosses it — composite already holds the transmitted picture (the
// G-buffer is what stands behind the pane; composite tints it), so this is the mirror image + the glints + the dust glow, all additive, leaving through the
// same specular texture / history / à-trous pass as the glossy floors. ----
const GLASS_DUST: f32 = 0.035;       // albedo of the grime film on a pane: the share of the light ARRIVING at the glass (either face) it scatters diffusely — what makes a torch beam or a lit panel show on the glass itself; × frame.glassCfg.z
// The pane's terms (traced in main's / mainGi's loop: the turn after the gloss floor's): at the crossing point Pg (n = the pane's normal on the eye's side, V = the view direction, eye → scene), one mirror ray (the exact reflection: float glass is
// flat to well under a pixel — no cone, so nothing for the history to integrate but the hit's own shading noise), shaded as the gloss floor's mirror ray is
// (traceShade's mirror rules: emission INCLUDING area-lit fixtures: a mirror shows the glowing panel itself; albedo/π × (direct at the hit + the cached bounce); the sky
// on a miss), plus glossGlints' analytic image of the small emitters no ray can find, × Schlick's Fresnel at the view angle (n = 1.5) × the strength knob; then
// the dust: every steady light's irradiance ON the pane (no receiver cosine but the pane's own projected area, both faces alike), the two strongest shadow-
// tested (+ smoke), the rest at half credit unshadowed (dim by construction, reach-masked), × GLASS_DUST/π.

// ---- GI IN MOTION: the young-history test and the extra ray (docs/internal/gi-motion.md §C; `main` only) ----
var<workgroup> wgYoungN: atomic<u32>;      // young lanes in this 8×8 tile
var<workgroup> wgYoungBase: atomic<u32>;   // the tile's first slot in the frame's counter (0xffffffff = none asked)
/** did the point P (this texel's, this frame) have NO usable diffuse history last frame? — behind last frame's eye, off its screen, on another surface (the stored view depth disagrees), or a history
 *  the denoiser calls young. Reads LAST frame's moments (.z = length) and value history (.a = view depth) at the reprojected texel: the gather-grid pair, or the internal-res pair while that chain
 *  runs — the texture's own size says which (denoise.wgsl gatherTexel's mapping, to the nearest texel). */
fn youngTexel(P: vec3f) -> bool {
  let pc = frame.prevViewProj * vec4f(P, 1.0);
  if (pc.w <= 1e-4) { return true; }
  let uvp = (pc.xy / pc.w) * vec2f(0.5, -0.5) + 0.5;
  if (any(uvp < vec2f(0.0)) || any(uvp >= vec2f(1.0))) { return true; }
  let md = vec2i(textureDimensions(giMomPrev));
  let mdiv = max(1, i32(round(frame.screen.y / f32(md.y))));            // that pair's divisor: the raw gather's, or 1 while the internal-res chain runs
  let moff = f32((mdiv - 1) / 2);
  let tex = clamp(vec2i(floor((uvp * frame.screen - moff - 0.5) / f32(mdiv) + 0.5)), vec2i(0), md - 1);
  let lenPrev = textureLoad(giMomPrev, tex, 0).z;
  let zStored = textureLoad(giHistPrev, tex, 0).a;
  return lenPrev < frame.giCfg.z || abs(zStored - pc.w) > 0.03 * pc.w + 0.05;   // (a coarser depth test than the denoiser's own: a texel off by one on a slanted floor must not read as disoccluded — a shin in front of the floor still does)
}
/** ONE ray of this pass traced from ro along dir and shaded at its hit (the compile: DXC inlines every call, so every ray of a kernel goes through ONE call of this — main's and
 *  mainGi's loops). gatherRay = the diffuse gather's rules (main's rays, the young tile's extras, mainGi's fresh candidates): emission without the area-lit fixtures, the
 *  torch-card exclusion, the bounce read walled or bounded by the receiver's plane (N, owner, Po: the receiver). Otherwise a mirror ray's (the gloss floor, the pane): every
 *  emitter — a mirror shows the glowing panel itself — no card exclusion (a mirror SHOWS the torch spot on the wall), the cache's plain read (no walled read: a man mirrored in
 *  a floor or a pane is the least of them). L = the outgoing radiance toward ro, uncapped; Lb = its cache-bounce share (gather rays, never a man's); xs / ns / t = the sample
 *  point, its normal and distance (a sky sample: ro, the direction, GI_SKY_D); specT = the hit distance as specHitT keeps it (1e4 on a miss); ok = anything but an 'inside' hit;
 *  cap = the hit is a man; bi / alb = the box hit and its paint (GI_NOBOX / 0 for sky or a man). */
struct RayHit { L: vec3f, Lb: vec3f, alb: vec3f, xs: vec3f, ns: vec3f, t: f32, specT: f32, sky: bool, ok: bool, cap: bool, bi: u32 };
fn traceShade(ro: vec3f, dir: vec3f, trOwner: u32, gatherRay: bool, N: vec3f, owner: u32, Po: vec3f) -> RayHit {
  var r: RayHit; r.L = vec3f(0.0); r.Lb = vec3f(0.0); r.alb = vec3f(0.0); r.xs = ro; r.ns = dir; r.t = GI_SKY_D; r.sky = false; r.ok = false; r.cap = false; r.bi = GI_NOBOX;
  let hit = traceClosest(ro, dir, TMAX, trOwner);
  r.specT = select(1e4, hit.t, hit.idx >= 0);
  var L = vec3f(0.0);
  if (hit.idx < 0) { L = skyRadiance(dir); r.sky = true; r.ok = true; }
  else if (!hit.inside) {
    let Ph = ro + dir * hit.t;
    r.ok = true; r.xs = Ph; r.ns = hit.n; r.t = hit.t;
    var albedo: vec3f;
    var ex = 0u;   // torch bounce cards whose claim region this hit lies in: their lights' direct terms here are the cards' to carry (empty loop with the flag off)
    if (hit.idx == CAPSULE_HIT) { albedo = hit.capAlbedo; r.cap = true; }
    else {
      let bi = u32(hit.idx); r.bi = bi;
      if (gatherRay) { if ((boxGeo[bi].flags & (BOX_EMISSIVE | BOX_AREALIT)) == BOX_EMISSIVE) { L += boxEmissive(bi); } }
      else if ((boxGeo[bi].flags & BOX_EMISSIVE) != 0u) { L += boxEmissive(bi); }
      albedo = boxAlbedoSec(bi); r.alb = albedo;
      if (gatherRay) { for (var k = 0u; k < nC; k++) { if (onCard(Ph, hit.n, wgCards[k * 4u], wgCards[k * 4u + 1u])) { ex |= 1u << k; } } }
    }
    var Eh = vec3f(0.0);
    if ((frame.flags & FLAG_DIRECT) != 0u) { Eh += directAtPoint(Ph, hit.n, ex); }
    if ((frame.flags & FLAG_BOUNCE) != 0u) {
      if (gatherRay) {
        var Eb: vec3f;
        if (BOUNCE_WALLS && (bounceHitMan(hit) || bounceLeftNoWall(N, owner, hit.t))) { Eb = diceIrradianceWalled(Ph, hit.n, bounceHitOwner(hit) | (owner << 8u)); } else { Eb = diceIrradianceFrom(Ph, hit.n, Po, N); }
        Eh += Eb; if (!r.cap) { r.Lb = albedo * Eb * (1.0 / 3.14159265); }
      } else { Eh += diceIrradiance(Ph + hit.n * c0Spacing(), hit.n); }
    }
    L += albedo * Eh * (1.0 / 3.14159265);
  }
  r.L = L;
  return r;
}
/** is this texel the polished top of a BOX_GLOSS floor box — a world box (not a character), flagged, seen from above (on = the gloss floors are up) */
fn specOnGloss(on: bool, id: u32, N: vec3f) -> bool { let bidx = id & 0xFFFFFu; return on && ((id >> 28u) & 1u) == 0u && bidx != 0xFFFFFu && (boxGeo[bidx].flags & BOX_GLOSS) != 0u && N.y > 0.95; }
/** the gloss floor's mirror ray at P (its two rnd() for the cone): Schlick on the VIEW angle, the unjittered mirror direction R (the glints'), the jittered ray */
struct GlossRay { F: f32, R: vec3f, dir: vec3f };
fn glossRay(P: vec3f) -> GlossRay {
  var g: GlossRay;
  let I = normalize(P - frame.camPos);                 // eye → floor
  let cosV = clamp(-I.y, 0.0, 1.0);                    // = N·V for the up-facing finish
  g.F = GLOSS_F0 + (1.0 - GLOSS_F0) * pow(1.0 - cosV, 5.0);
  g.R = vec3f(I.x, -I.y, I.z);                         // reflect(I, +y)
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(g.R.y) > 0.9);
  let T = normalize(cross(up, g.R)); let B = cross(g.R, T);
  let r = GLOSS_SPREAD * sqrt(rnd()); let a = rnd() * 6.2831853;
  g.dir = normalize(g.R + (T * cos(a) + B * sin(a)) * r);
  if (g.dir.y < 0.02) { g.dir = g.R; }                 // (only a grazing eye could push the cone under the floor; this camera never does)
  return g;
}
/** a mirror ray's radiance once traced (r): the traced ray under the gather's firefly bound (a lit panel ≈ 11 passes whole, a spark streak does not) + the analytic glints of
 *  the small emitters no ray can see (glossGlints from ro about the mirror direction R: stable, so allowed to read as white), then — the gloss floor — Schlick's Fresnel × the
 *  finish's strength, more on the wet lot (game/weather.ts: frame.weatherA.w = wetness, weatherC = the interior footprint: standing water outdoors mirrors up to 3.5× the coat's
 *  Fresnel at full wet, capped at a full mirror, nothing indoors or dry — w = 0: min(F, 1) = F), or — the pane — its Fresnel F. Sets specHitT. */
fn mirrorTail(r: RayHit, ro: vec3f, R: vec3f, trOwner: u32, F: f32, isGloss: bool, P: vec3f) -> vec3f {
  specHitT = r.specT;
  var L = r.L;
  let lum = luminance(L);
  L = select(L, L * (GLOSS_RAY_MAX / lum), lum > GLOSS_RAY_MAX);
  if ((frame.flags & FLAG_DIRECT) != 0u) {
    var G = glossGlints(ro, R, trOwner);
    let lg = luminance(G);
    G = select(G, G * (GLOSS_GLINT_MAX / lg), lg > GLOSS_GLINT_MAX);
    L += G;
  }
  if (isGloss) {
    let Wc = frame.weatherC; var wetOut = select(0.0, frame.weatherA.w, P.x < Wc.x || P.z < Wc.y || P.x > Wc.z || P.z > Wc.w);
    if (WX_KINDS) { if (frame.cardCfg.y != 0u && wxRoofed(P.xz)) { wetOut = 0.0; } }   // (weather kinds: every roof of the level keeps its floor dry, not the first alone)
    return L * (min(F * (1.0 + 2.5 * wetOut), 1.0) * GLOSS_STRENGTH);
  }
  return L * F;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lidx: u32) {
  nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  // torch bounce cards: stage the live cards' rows (texel (k, row) → wgCards[4k + row]) and the slot → card map; nC = 0 with the flag off (nothing loaded, both loops empty)
  nC = select(0u, min(frame.cardCfg.x, 8u), (frame.flags & FLAG_BOUNCE_CARDS) != 0u);
  wgCardOf[lidx] = -1;
  if (lidx < nC * 4u) { wgCards[lidx] = textureLoad(cardsTex, vec2u(lidx >> 2u, lidx & 3u), 0); }
  workgroupBarrier();
  if (lidx < nC && wgCards[lidx * 4u].w > 0.0) { wgCardOf[u32(wgCards[lidx * 4u + 1u].w)] = i32(lidx); }   // (a card that failed to build — R = 0 — excludes nothing and lights nothing)
  workgroupBarrier();
  // GI IN MOTION — young-history rays (frame.giCfg: x = the multiplier k, 0 / 1 = off — this block is skipped whole and the gather below is statement for statement what it was; y = the frame's cap
  // in texels; z = 'young' = a diffuse history shorter than this). A texel whose point had NO usable history last frame — reprojected off the screen (the edge a pan brings in), onto another
  // surface (what a walking man, a swinging leaf, Sam himself uncovers: the stored view depth disagrees), or onto a history the denoiser itself calls young — traces k× the rays THIS frame, so
  // the frames in which the temporal filter has nothing but the raw estimate to show get an estimate worth showing; a settled texel costs two texture loads. Decided PER 8×8 TILE (a SIMD group
  // pays for its slowest lane anyway, and which tiles win past the cap must not flicker with the arrival order of single texels): the tile counts its young lanes, takes that many slots from
  // the frame's counter with ONE atomic, and its young lanes trace k× iff the tile's first slot is under the cap. The CPU zeroes the counter each frame and holds k at 0 across a camera cut /
  // a wholesale history restart, when every texel is young. (A uniform branch: giCfg is the frame block's, so the barriers inside stand in uniform control flow.)
  var raysN = RAYS;
  let yk = u32(frame.giCfg.x + 0.5);
  if (yk > 1u) {
    var youngMe = false;
    let od0 = textureDimensions(outIndirect);
    if (gid.x < od0.x && gid.y < od0.y && (frame.flags & FLAG_INDIRECT) != 0u) {
      let gdiv0 = u32(frame.lossyCfg.x);
      let full0 = min(gid.xy * gdiv0 + (gdiv0 - 1u) / 2u, vec2u(frame.screen) - 1u);
      let depth0 = textureLoad(gDepth, full0, 0);
      if (depth0 < 1.0) { youngMe = youngTexel(worldFromDepth(vec2f(full0) + 0.5, depth0)); }
    }
    if (lidx == 0u) { atomicStore(&wgYoungN, 0u); }
    workgroupBarrier();
    if (youngMe) { atomicAdd(&wgYoungN, 1u); }
    workgroupBarrier();
    if (lidx == 0u) { let n = atomicLoad(&wgYoungN); var base = 0xffffffffu; if (n > 0u) { base = atomicAdd(&giYoung.count, n); } atomicStore(&wgYoungBase, base); }
    workgroupBarrier();
    if (youngMe && f32(atomicLoad(&wgYoungBase)) < frame.giCfg.y) { raysN = RAYS * yk; }
  }
  let odims = textureDimensions(outIndirect);
  if (gid.x >= odims.x || gid.y >= odims.y) { return; }
  let gdiv = u32(frame.lossyCfg.x);                                            // this pass runs at 1/gdiv resolution: 2, or 3 (lossy option)
  let full = min(gid.xy * gdiv + (gdiv - 1u) / 2u, vec2u(frame.screen) - 1u);   // the full-res pixel a texel is computed at: top-left of its 2x2 as always (the min never binds then), the centre of its 3x3
  let depth = textureLoad(gDepth, full, 0);
  let gloss = (frame.flags & FLAG_GLOSS) != 0u;   // glossy floors ride in this pass (they want its tracer, its light staging and its cache reads): every texel then also gets a specular value — zero unless it is a gloss floor — so the filter chain behind outSpecular sees a fully written field; flag off = no store at all (and, like the bounce, no reflections while indirect light is switched off)
  let glassOn = (frame.flags & FLAG_GLASS) != 0u; // glass panes ride here for the same reasons and leave through the same texture (glassDust above): the specular field is written whenever EITHER is on
  let specOn = gloss || glassOn;
  if (depth >= 1.0 || (frame.flags & FLAG_INDIRECT) == 0u) { textureStore(outIndirect, gid.xy, vec4f(0.0)); if (specOn) { textureStore(outSpecular, gid.xy, vec4f(0.0)); } return; }
  rngInit(gid.xy, frame.frameIdx);
  let P = worldFromDepth(vec2f(full) + 0.5, depth);
  let N = normalize(textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0);
  let id = textureLoad(gId, full, 0).x;
  let owner = (id >> 20u) & 0xffu;
  let Po = P + N * 0.02;
  // relative firefly bound: what a single cosine ray may bring back is judged against what the radiance cache says this point plausibly receives from its
  // whole hemisphere. A torch held half a metre off a wall makes a hotspot of hundreds of W/m²; one ray in K from the floor beside it finding that patch
  // returned ~40 (clamped to 24) where its neighbours returned ~0.05, and the patch moves with the man, so history never settled it: boiling bright noise
  // round every torch near a wall. K × Ecache/π (Ecache: c0 dice at P, smooth, includes the torch's bounce at cache resolution) + a small absolute floor so
  // legitimately dark corners keep their small bounces; the absolute 24 below stays as the last resort. K = lossyCfg.w (settings.giFireflyK, 0 = off).
  let Kff = frame.lossyCfg.w;
  var Lcap = 1e9;
  if (Kff > 0.0) { let Eref = diceIrradiance(P + N * c0Spacing(), N); Lcap = max(Kff * luminance(Eref) * (1.0 / 3.14159265), 0.35); }
  // ONE LOOP, ONE RAY A TURN (the compile, 2026-10-26: Chrome on Windows compiles through DXC, which inlines every call — this kernel traced and shaded a ray in four
  // places (the gather's loop, the young tile's extras, the gloss floor's mirror, the pane's mirror), so the tracer and directAtPoint were inlined four times and the
  // compile took ~8 s). Every ray this texel traces is now a turn of the loop below and is traced and shaded by the ONE call of traceShade: turns [0, RAYS) are the
  // gather's rays, [RAYS, raysN) the young tile's extras, turn raysN the gloss floor's mirror ray and turn raysN + 1 the pane's. The statements are the old ones in
  // the old order (the indirect is normalised, the cards added and the indirect stored between the two parts, as before), so every rnd() is drawn in the same order
  // and the values are what they were.
  var E = vec3f(0.0);
  var Ex = vec3f(0.0);
  var spec = vec3f(0.0);
  for (var j = 0u; j < raysN + 2u; j++) {
    var ro = Po; var dir = vec3f(0.0); var trOwner = owner; var gatherRay = true; var go = true;
    var Rm = vec3f(0.0); var Fm = 0.0; var paneHit = false; var Pg = vec3f(0.0); var gn = vec3f(0.0);
    if (j < RAYS) { dir = cosineDirK(N, j, RAYS); }   // (= cosineDir(N) unless GATHER_STRATA: ray k from stratum (k + frame) mod 4 — settings.gatherStrata)
    else if (j < raysN) { dir = cosineDirK(N, j - RAYS, raysN - RAYS); }   // GI in motion: extra ray kx of the Kx the young texel takes (under GATHER_STRATA a complete stratified set of their own: the base rays cover their 2 × 2 cells, these cover theirs, so the whole remains an unbiased cosine estimate)
    else if (j == raysN) {
      // cosine-weighted pdf = cos/pi  ⇒  E = pi/K · Σ L
      E *= 3.14159265 / f32(RAYS);
      // GI in motion: the young tile's extra rays (raysN > RAYS only then), the sum re-normalised to the true count
      if (raysN > RAYS) { E = (E * (f32(RAYS) / 3.14159265) + Ex) * (3.14159265 / f32(raysN)); }
      if (nC > 0u && (frame.flags & FLAG_DIRECT) != 0u) { E += cardIrradiance(P, N, Po, owner, gid.xy); }   // torch bounce cards: the footprints' one bounce, analytic (after the rays: their rnd() sequence is untouched)
      textureStore(outIndirect, gid.xy, vec4f(E * frame.indirectScale, 1.0));
      // AFTER the gather's rays and its store (the indirect estimate is value for value what it is with both flags off): the gloss floor's mirror ray
      go = specOnGloss(specOn && gloss, id, N);
      if (go) { let gm = glossRay(P); Fm = gm.F; Rm = gm.R; dir = gm.dir; ro = P + vec3f(0.0, 0.02, 0.0); gatherRay = false; }
    } else {
      // a pane between the eye and this texel's surface: what it adds toward the eye at the crossing (the nearest pane only reflects; composite tints for every one crossed):
      // the exact mirror ray (float glass is flat to well under a pixel) × Schlick at the view angle (n = 1.5) × the strength knob, + the dust (glassDust)
      go = false;
      if (specOn && glassOn) {
        let toP = P - frame.camPos; let dist = length(toP); let V = toP / max(dist, 1e-4);
        let gh = glassTrace(frame.camPos, V, 0.0, dist - 0.02);
        if (gh.idx >= 0) { paneHit = true; Pg = frame.camPos + V * gh.t; gn = gh.n; Fm = glassFresnel(clamp(dot(-V, gn), 0.0, 1.0)) * frame.glassCfg.x; Rm = V - gn * (2.0 * dot(V, gn)); ro = Pg + gn * 0.015; dir = Rm; trOwner = 0u; gatherRay = false; go = Fm > 0.001; }
      }
    }
    var L = vec3f(0.0);
    if (go) {
      let r = traceShade(ro, dir, trOwner, gatherRay, N, owner, Po);
      if (gatherRay) {
        // firefly guard: one ray in K finding a small intensely lit patch is an outlier the filters would smear into a blotch
        // (generous cap: a desk-lamp pool or a torch spot seen from the wall next to it is a LARGE, legitimately bright patch, not a
        // firefly — clamping it hard is what made small bright lights cast no bounce)
        L = r.L;
        let lum = luminance(L);
        let cap = min(Lcap, 24.0);
        L = select(L, L * (cap / lum), lum > cap);
        if (j < RAYS) { E += L; } else { Ex += L; }
      } else { L = mirrorTail(r, ro, Rm, trOwner, Fm, j == raysN, P); if (j == raysN) { spec = L; } }
    }
    if (paneHit) { spec += L + glassDust(Pg, gn); }
  }
  if (specOn) { textureStore(outSpecular, gid.xy, vec4f(spec, specHitT)); }   // (.a = the reflection ray's hit distance for the v3 denoiser; the legacy chain reads .rgb only)
}

// ================================================================================================================================================
// RENDERER V3 PHASE 5 — the RESAMPLING gather (settings.giResample 'temporal' | 'full', ultra; frame.p5Cfg.x = mode | revalidate << 4, .y = the numbers).
// ReSTIR GI (Ouyang et al. 2021), simplified to what this renderer's gather is: an estimate of the irradiance E = ∫ L cosθ dω at the primary hit from
// secondary points ONE bounce away, whose outgoing radiance L is albedo/π × (direct at the point + the cache's bounce) + emission (traceShade = main's
// loop body). Per gather texel a RESERVOIR holds one such secondary sample y = {point x_s, its face normal n_s, its outgoing radiance L_o toward the
// receiver} chosen by resampled importance sampling with target p̂(y) = lum(L_o) · cosθ (∝ the integrand's luminance) from
//   * the texel's OWN reservoir of last frame, found by reprojection (prevViewProj + the g-buffer's motion vectors, both TAAU jitters taken back out so a
//     still pixel inherits itself) and validated by the receiver's stored view depth + normal, its confidence M capped (giResampleCap), its radiance
//     RE-SHADED at the stored point when 'revalidate' is up (a switched light or a swept torch reaches the history the same frame instead of an M-frame
//     lag; the box index rides in the record and is checked to still name a box holding the point);
//   * K fresh cosine-distributed rays (giResampleRays, 2 at ultra where the plain gather traces 4): source pdf cosθ/π, so w = p̂/p = π · lum(L);
// combined with confidence weights (M): W = Σw / (M · p̂(y)). Mode 'full' adds ONE spatial pass: k neighbours on a golden-angle disc (giResampleTaps /
// Radius) whose receiver lies on this texel's plane with a like normal lend last frame's temporal reservoirs, each re-targeted here with the reconnection
// Jacobian |J| = (cosφ_here · d_there²) / (cosφ_there · d_here²) (φ at the sample point, toward either receiver; 1 for a sky sample) and combined with
// PAIRWISE MIS against the canonical (defensive form, a rejected pair's share returned to the canonical — as restir.wgsl) — with NO extra visibility ray:
// the biased-but-bounded variant (a neighbour's sample this point cannot see leaks its light for as long as it survives; the plane / normal test and a
// radius under a metre keep that to the like-lit patch it came from). SHADING is Σ_j f(y_j) · w_j / p̂(y_j) over EVERY sample seen (temporal, fresh,
// accepted neighbours) rather than f(y) · W of the survivor: the same expectation, the fresh rays' chroma kept, and no division by a small p̂ anywhere
// (f/p̂ = L/lum(L)). What next frame inherits is the TEMPORAL stage's reservoir (no M inflation through the spatial pass). Every sample dark → a valid
// zero-weight reservoir keeps its M ('looked, found nothing' is evidence — dropping it brightens a dark corner the way restir.wgsl's note describes).
// The bounce cards' analytic term and the specular field follow exactly as in main. Output → outIndirect, which the diffuse denoiser client consumes as
// ever (its input is smoother — and temporally correlated — where the history holds, and exactly the plain K-ray estimate where it was dropped).
// Reservoir texels (two rgba32uint per gather texel, ping-pong sets — passes.ts giRes):
//   A = (x | z of the sample point (16 + 16 over the world box), y (16) | its normal oct 8 + 8 (a SKY sample: the direction), f16 L_oD.r | L_oD.g, f16 L_oD.b | f16 W) — L_oD = emission + direct part; the cache's bounce is re-added on load
//   B = (M (8) | flags (4: 1 valid, 2 sky, 4 capsule, 8 news) | box index (20), f16 the RECEIVER's view depth | the sample's albedo 5-6-5 << 16, f16 d (sample → its receiver) | f16 cosφ there, f16 p̂ at its receiver | receiver normal oct 8 + 8)
// ================================================================================================================================================
@group(1) @binding(9) var resInA: texture_2d<u32>;
@group(1) @binding(10) var resInB: texture_2d<u32>;
@group(1) @binding(11) var resOutA: texture_storage_2d<rgba32uint, write>;
@group(1) @binding(12) var resOutB: texture_storage_2d<rgba32uint, write>;
@group(1) @binding(13) var gVel: texture_2d<f32>;                          // the g-buffer's per-pixel object motion (TAAU's): the reservoir follows a pushed desk like the denoiser's history does
const GI_NOBOX: u32 = 0xFFFFFu;
const GI_SKY_D: f32 = 1000.0;      // 'distance' of a sky sample (its Jacobian is 1: no parallax at infinity)
const GI_JMAX: f32 = 6.0;          // a neighbour's sample whose reconnection Jacobian falls outside [1/JMAX, JMAX] is a different geometry seen from here (a point round the corner, a grazing patch): rejected, its share returned to the canonical
const GI_WMAX: f32 = 30000.0;      // the contribution weight W is stored as f16: bounded here, and a record whose W is not below this (inf / NaN from anywhere) is read back as invalid
var<workgroup> wgNewsFresh: atomic<u32>;   // the tile's news (mainGi): Σ over its lanes of the fresh rays' estimate of E, of the histories' estimate, and how many lanes had a history — fixed point ×4096
var<workgroup> wgNewsHist: atomic<u32>;
var<workgroup> wgNewsN: atomic<u32>;
/** an albedo in 16 bits (5-6-5): the stored sample's paint, for re-adding the cache's bounce at its point every frame (3 % steps on a second-order term) */
fn giPackAlb(a: vec3f) -> u32 { let q = vec3u(clamp(a, vec3f(0.0), vec3f(1.0)) * vec3f(31.0, 63.0, 31.0) + 0.5); return (q.x << 11u) | (q.y << 5u) | q.z; }
fn giUnpackAlb(v: u32) -> vec3f { return vec3f(f32((v >> 11u) & 31u) / 31.0, f32((v >> 5u) & 63u) / 63.0, f32(v & 31u) / 31.0); }

/** the cache's bounce leaving a stored sample point now: alb × dice(x_s) / π (0 for a sky / capsule sample, whose alb is 0) */
fn giBounceAt(xs: vec3f, ns: vec3f, alb: vec3f) -> vec3f {
  if ((frame.flags & FLAG_BOUNCE) == 0u || all(alb <= vec3f(0.0))) { return vec3f(0.0); }
  return alb * diceIrradiance(xs + ns * c0Spacing(), ns) * (1.0 / 3.14159265);
}
/** is world point p on / inside box bi (5 cm proud)? — a stored sample's box index still names the box it was found on (dynamic boxes are re-listed every frame) */
fn giPointOnBox(bi: u32, p: vec3f) -> bool {
  if (bi >= scene.numBoxes) { return false; }
  let b = boxGeo[bi]; let d = p - b.c;
  var lo: vec3f;
  if ((b.flags & BOX_ROT) != 0u) { let q = boxRot(bi); lo = quatRotate(vec4f(-q.xyz, q.w), d); }
  else { let cs = unpack2x16float(b.rot); lo = vec3f(cs.x * d.x - cs.y * d.z, d.y, cs.y * d.x + cs.x * d.z); }
  return all(abs(lo) <= b.h + vec3f(0.05));
}
/** the emission + DIRECT part of a STORED sample point's outgoing radiance NOW (revalidation; the cache's bounce is re-added apart every frame — giBounceAt): main's hit shading at
 *  a known point on box bi — emission rule, card exclusion, direct light. `full` = the off-screen light loop + shadow ray is allowed (directAtPoint); else only a point VISIBLE this
 *  frame is re-shaded (directOnScreen: the exact denoised textures — cheap) and an off-screen one reports .w = 0 = keep the stored part. The bounce sources that change in this
 *  level — a torch's wall, a lit floor — are on screen from up here; the ceiling is not, and gets the loop on the frames `full` says. Uncapped: the caller applies the bound. */
fn giReshadeDirect(xs: vec3f, ns: vec3f, bi: u32, full: bool) -> vec4f {
  var L = vec3f(0.0);
  if ((boxGeo[bi].flags & (BOX_EMISSIVE | BOX_AREALIT)) == BOX_EMISSIVE) { L += boxEmissive(bi); }
  let albedo = boxAlbedoSec(bi);
  var ex = 0u;
  for (var k = 0u; k < nC; k++) { if (onCard(xs, ns, wgCards[k * 4u], wgCards[k * 4u + 1u])) { ex |= 1u << k; } }
  if ((frame.flags & FLAG_DIRECT) != 0u) {
    let od = directAt(xs, ns, ex, full); if (od.w == 0.0) { return vec4f(0.0); }   // (one call for both: full = directAtPoint, else directOnScreen — .w 0 = off screen, not asked)
    L += albedo * od.xyz * (1.0 / 3.14159265);
  }
  return vec4f(L, 1.0);
}
// a reservoir as read back: the sample, its weight / confidence, and its receiver's keys
struct GiRec { xs: vec3f, ns: vec3f, LoD: vec3f, alb: vec3f, Lo: vec3f, W: f32, M: f32, valid: bool, sky: bool, cap: bool, news: bool, bi: u32, zRecv: f32, nRecv: vec3f, dq: f32, cosq: f32, phat: f32 };   // LoD + alb as stored; Lo = LoD + the cache's bounce at the point NOW (giLoad re-adds it); news = the tile that stored it had found its light changed: re-shade fully on reading it
fn giLoad(q: vec2i) -> GiRec {
  var r: GiRec;
  let a = textureLoad(resInA, q, 0); let b = textureLoad(resInB, q, 0);
  let fl = (b.x >> 8u) & 15u;
  r.valid = (fl & 1u) != 0u; r.sky = (fl & 2u) != 0u; r.cap = (fl & 4u) != 0u; r.news = (fl & 8u) != 0u;
  r.M = f32(b.x & 255u); r.bi = b.x >> 12u;
  r.xs = p5UnpackPos(a.x, a.y); r.ns = p5UnpackN(a.y);
  let lrg = unpack2x16float(a.z); let lbw = unpack2x16float(a.w);
  r.LoD = vec3f(lrg, lbw.x); r.W = lbw.y;
  r.zRecv = unpack2x16float(b.y & 0xffffu).x; r.alb = giUnpackAlb(b.y >> 16u);
  let dc = unpack2x16float(b.z); r.dq = dc.x; r.cosq = dc.y;
  let pw = unpack2x16float(b.w & 0xffffu); r.phat = pw.x;
  r.nRecv = p5UnpackOct16(b.w >> 16u);
  if (!(r.W < GI_WMAX) || !(r.W >= 0.0) || any(!(r.LoD < vec3f(6.0e4)))) { r.valid = false; r.W = 0.0; r.LoD = vec3f(0.0); }   // non-finite anything (an f16 that overflowed on the way in): no history here, rather than a NaN into the diffuse client
  r.Lo = r.LoD;
  if (r.valid && !r.sky) { r.Lo += giBounceAt(r.xs, r.ns, r.alb); }         // the cache's bounce at the stored point, THIS frame
  return r;
}
/** the direction from receiver P toward the record's sample (a sky sample carries its direction), and its distance */
fn giDirTo(r: GiRec, P: vec3f) -> vec4f { if (r.sky) { return vec4f(r.ns, GI_SKY_D); } let d = r.xs - P; let l = length(d); return vec4f(d / max(l, 1e-4), l); }
/** where the surface point P (full-res pixel `full`) sat on LAST frame's gather grid: texel index, and the view depth it had then (the receiver key). ok = in front of last frame's eye AND on the grid. */
struct GiPrev { q: vec2i, z: f32, ok: bool };
fn giPrevTexel(P: vec3f, full: vec2u, gdiv: u32, dims: vec2u) -> GiPrev {
  var g: GiPrev; g.ok = false; g.q = vec2i(0); g.z = 0.0;
  let pc = frame.prevViewProj * vec4f(P, 1.0);
  if (pc.w <= 1e-4) { return g; }
  var ndc = pc.xy / pc.w;
  ndc += textureLoad(gVel, full, 0).xy;                                     // the surface's own motion (0 on the statics)
  let pxPrev = (ndc * vec2f(0.5, -0.5) + 0.5) * frame.screen - frame.jitter.zw + frame.jitter.xy;   // last frame's raster with its jitter out and ours in: a still pixel maps onto itself
  let q = vec2i(floor(pxPrev / f32(gdiv)));
  if (any(q < vec2i(0)) || any(q >= vec2i(dims))) { return g; }
  g.q = q; g.z = pc.w; g.ok = true;
  return g;
}

@compute @workgroup_size(8, 8)
fn mainGi(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lidx: u32, @builtin(workgroup_id) wid: vec3u) {
  nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  if (lidx == 0u) { atomicStore(&wgNewsFresh, 0u); atomicStore(&wgNewsHist, 0u); atomicStore(&wgNewsN, 0u); }   // (ordered before any lane's add by the staging barriers below)
  nC = select(0u, min(frame.cardCfg.x, 8u), (frame.flags & FLAG_BOUNCE_CARDS) != 0u);
  wgCardOf[lidx] = -1;
  if (lidx < nC * 4u) { wgCards[lidx] = textureLoad(cardsTex, vec2u(lidx >> 2u, lidx & 3u), 0); }
  workgroupBarrier();
  if (lidx < nC && wgCards[lidx * 4u].w > 0.0) { wgCardOf[u32(wgCards[lidx * 4u + 1u].w)] = i32(lidx); }
  workgroupBarrier();
  let odims = textureDimensions(outIndirect);
  // No early return from here on: the tile takes ONE collective decision below (workgroupBarrier in uniform control flow), so a lane with nothing to do rides along with live = false.
  let inGrid = gid.x < odims.x && gid.y < odims.y;
  let gdiv = u32(frame.lossyCfg.x);
  let full = min(gid.xy * gdiv + (gdiv - 1u) / 2u, vec2u(frame.screen) - 1u);
  let gloss = (frame.flags & FLAG_GLOSS) != 0u;
  let glassOn = (frame.flags & FLAG_GLASS) != 0u;
  let specOn = gloss || glassOn;
  let empty = vec4u(0u);
  var live = false; var depth = 1.0;
  if (inGrid) {
    depth = textureLoad(gDepth, full, 0);
    if (depth >= 1.0 || (frame.flags & FLAG_INDIRECT) == 0u) { textureStore(outIndirect, gid.xy, vec4f(0.0)); if (specOn) { textureStore(outSpecular, gid.xy, vec4f(0.0)); } textureStore(resOutA, gid.xy, empty); textureStore(resOutB, gid.xy, empty); }
    else { live = true; }
  }
  rngInit(gid.xy, frame.frameIdx);
  var P = vec3f(0.0); var N = vec3f(0.0, 1.0, 0.0); var id = 0u;
  if (live) { P = worldFromDepth(vec2f(full) + 0.5, depth); N = normalize(textureLoad(gNormal, full, 0).xyz * 2.0 - 1.0); id = textureLoad(gId, full, 0).x; }
  let owner = (id >> 20u) & 0xffu;
  let Po = P + N * 0.02;
  let zNow = (frame.viewProj * vec4f(P, 1.0)).w;                            // the receiver key next frame validates against
  let Kff = frame.lossyCfg.w;
  var Lcap = 1e9;
  if (live && Kff > 0.0) { let Eref = diceIrradiance(P + N * c0Spacing(), N); Lcap = max(Kff * luminance(Eref) * (1.0 / 3.14159265), 0.35); }
  // the numbers (frame.p5Cfg): mode 1 temporal / 2 + spatial, revalidate bit; fresh rays K, confidence cap, spatial taps k, radius (gather texels)
  let mode = frame.p5Cfg.x & 15u; let revalidate = (frame.p5Cfg.x & 16u) != 0u;
  let K = clamp(frame.p5Cfg.y & 15u, 1u, 4u); let mCap = f32(max((frame.p5Cfg.y >> 8u) & 255u, 2u)); let kSp = (frame.p5Cfg.y >> 16u) & 15u; let radius = f32((frame.p5Cfg.y >> 24u) & 255u);
  let PI_ = 3.14159265;
  let Kf = f32(K);
  // ---- the running reservoir (the sample that survives) + the shade-all accumulators ----
  var yXs = Po; var yNs = N; var yLo = vec3f(0.0); var yLoD = vec3f(0.0); var yAlb = vec3f(0.0); var ySky = false; var yCap = false; var yBi = GI_NOBOX; var yD = GI_SKY_D; var yCos = 1.0; var yPh = 0.0; var have = false;
  var wsum = 0.0;                                                            // Σ of MIS-normalised weights (the m's carry the confidence: W = wsum / p̂(y), E = Σ f/p̂ · w, no 1/M anywhere)
  var E = vec3f(0.0);
  var dbgT = 0.0;                                                            // (debug view 16: the temporal history was found and taken)
  // ---- temporal: this texel's own reservoir of last frame — found, validated, re-shaded ----
  var tOk = false; var LoT = vec3f(0.0); var cosT = 0.0; var Mt = 0.0; var phOld = 0.0; var tW = 0.0; var tDist = GI_SKY_D; var tCos = 1.0; var tM = 0.0; var tNews = false;
  var tXs = Po; var tNs = N; var tSky = false; var tCap = false; var tBi = GI_NOBOX; var tLoD = vec3f(0.0); var tAlb = vec3f(0.0);
  var histE = -1.0;                                                          // what the history believed E was here (L·cos·W, luminance) before any re-shade — the tile's news test below; −1 = no history
  if (live && (frame.flags & FLAG_TEMPORAL) != 0u) {
    let pv = giPrevTexel(P, full, gdiv, odims);
    if (pv.ok) {
      let t = giLoad(pv.q);
      if (t.valid && t.M > 0.0 && abs(t.zRecv - pv.z) < 0.01 * pv.z + 0.02 && dot(t.nRecv, N) > 0.9) {
        let dd = giDirTo(t, P); cosT = dot(N, dd.xyz);
        let faces = t.sky || dot(t.ns, dd.xyz) < -0.01;                     // the sample surface still faces this receiver (a sky sample always does)
        if (cosT > 0.0 && faces) {
          tOk = true; LoT = t.Lo; tLoD = t.LoD; tAlb = t.alb; phOld = t.phat; tW = t.W; tM = t.M; tNews = t.news; tDist = dd.w; tCos = select(-dot(t.ns, dd.xyz), 1.0, t.sky);
          tXs = t.xs; tNs = t.ns; tSky = t.sky; tCap = t.cap; tBi = t.bi;
          histE = luminance(t.Lo) * cosT * t.W;
        }
      }
    }
  }
  // RE-SHADE the stored point (revalidate). A visible point off this frame's denoised direct textures every frame (cheap); an off-screen one (the ceiling most floor texels'
  // rays end on) through the light loop + a shadow ray on the tile's every-4th-frame turn OR when its record carries last frame's NEWS bit (the tile then found its fresh
  // rays and its histories more than ×2 apart: light had arrived or gone somewhere in the hemisphere) — per 8×8 TILE, never per texel: a SIMD group pays for its slowest
  // lane (a per-texel quarter measured as dear as every texel; the news bit is written tile-wide, so it stays tile-uniform wherever the reprojection kept the tile
  // together). Measured at ultra against all-lights-off / all-on in the indirect view: within a few frames of the plain gather either way (docs/internal/p5-ultra.md),
  // where the stored radiance alone lagged 17 / 33 frames to 50 / 10 %. A ZERO-WEIGHT record ('looked, found nothing') is re-shaded too, for news of its own: light has
  // ARRIVED at the dark point it kept — the history is then dropped on the spot and the fresh rays speak alone.
  let fullTurn = tNews || ((wid.x + wid.y + frame.frameIdx) & 3u) == 0u;
  if (tOk && tW <= 0.0 && luminance(LoT) > 1e-5) { tOk = false; }           // a zero-weight record whose point the cache's bounce now lights (giLoad re-added it live): light arrived — drop it, the fresh rays speak alone
  if (tOk && revalidate && !tSky && !tCap && tBi != GI_NOBOX) {
    if (giPointOnBox(tBi, tXs)) {
      let rs = giReshadeDirect(tXs, tNs, tBi, fullTurn);
      if (rs.w > 0.0) {
        var Ln = rs.xyz + (LoT - tLoD);                                       // the fresh direct part + the bounce giLoad re-added this frame
        let lum = luminance(Ln); let c = min(Lcap, 24.0);
        if (lum > c) { let sc = c / lum; Ln *= sc; tLoD = rs.xyz * sc; } else { tLoD = rs.xyz; }   // (the same bound a fresh ray takes)
        if (tW > 0.0) { LoT = Ln; } else if (lum > 1e-5) { tOk = false; }
      }
    } else { tOk = false; }   // its box moved off / was re-listed: drop the history
  }
  // the history's outgoing radiance takes the bound a fresh ray takes on EVERY path (the un-reshaded ones too: giLoad re-added a live bounce to a direct part stored under it)
  if (tOk) { let lum = luminance(LoT); let c = min(Lcap, 24.0); if (lum > c) { let sc = c / lum; LoT *= sc; tLoD *= sc; } }
  // ---- combine. The history sample against the fresh candidates by CONFIDENCE, the history's discounted by how far the target at its own point has moved since it was stored:
  // r = p̂_new / p̂_old (p̂_old = t.phat as stored; p̂_new from the re-shade / re-aim / live bounce above), M_eff = M · min(r, 1/r) — restir.wgsl's symmetric target-ratio cut —
  // then the plain split m_t = M_eff / (M_eff + K), m_fresh = 1 / (M_eff + K) (Σ m = 1). Still light: M_eff = M, ten frames of evidence against two rays. Light ARRIVED at the
  // point (r ≫ 1): the history keeps little, the fresh rays speak, and no stale W is multiplied into a firefly; light LEFT it (r ≪ 1: a man's shadow, a spot's skirt, a door's
  // wedge moving onto it — or the mains going): likewise the fresh rays, rather than 91 % of the weight on a sample that just went dark. Past ×64 either way the history is simply
  // dropped. What is stored as M is the discounted confidence + K, so a reservoir rebuilt from two rays after a switch says two rays, and the next frames average instead of
  // trusting it at 91 %. A zero-weight record that stayed reads back with M ≤ K (light arriving elsewhere than at its point costs the fresh rays a frame, not ten); a man's
  // sample (capsule: never re-shaded, and he walks) likewise.
  var MtE = 0.0;
  if (tOk) {
    let phT = luminance(LoT) * cosT;
    var rL = 1.0;
    if (phOld > 0.0) { rL = phT / phOld; } else if (phT > 0.0) { rL = 1e9; }
    if (rL > 64.0 || rL < 1.0 / 64.0) { tOk = false; }
    else {
      Mt = select(min(tM, mCap), min(tM, Kf), tW <= 0.0 || tCap);
      MtE = Mt * min(rL, 1.0 / rL);
      let mT = MtE / (MtE + Kf);
      let wT = mT * phT * tW;
      wsum += wT; E += LoT * (cosT * tW * mT);
      yXs = tXs; yNs = tNs; yLo = LoT; yLoD = tLoD; yAlb = tAlb; ySky = tSky; yCap = tCap; yBi = tBi; yD = tDist; yCos = tCos; yPh = phT; have = true;
      dbgT = 1.0;
    }
  }
  let mF = 1.0 / (MtE + Kf);
  // ---- K fresh candidates, streamed: cosine rays traced and shaded as ever; w = m_fresh · p̂/p = m_fresh · π·lum(L) ----
  var lastXs = Po; var lastNs = N; var lastBi = GI_NOBOX; var lastSky = false; var lastCap = false; var lastD = GI_SKY_D; var lastCos = 1.0; var lastAlb = vec3f(0.0); var anyOk = false;
  var freshE = 0.0;                                                          // the fresh rays' own estimate of E (π/K Σ L, luminance) — the other half of the news test
  var yW = 0.0; var Mkeep = 0.0; var dbgS = 0.0;   // (set at turn K below: the temporal stage closed, the spatial pass)
  var spec = vec3f(0.0);
  // ONE LOOP, ONE RAY A TURN (as `main`, and for the same reason: DXC inlines every call, and the fresh rays and the two mirror rays were three copies of the tracer and
  // directAtPoint). Turns [0, K) are the fresh candidates; turn K closes the temporal stage, runs the spatial pass and the cards, and then sets up the gloss floor's
  // mirror ray; turn K + 1 is the pane's. Every ray is traced and shaded by the ONE traceShade call; the statements run in their old order (the same rnd() draws).
  if (live) {
    for (var j = 0u; j < K + 2u; j++) {
      var ro = Po; var dir = vec3f(0.0); var trOwner = owner; var gatherRay = true; var go = true;
      var Rm = vec3f(0.0); var Fm = 0.0; var paneHit = false; var Pg = vec3f(0.0); var gn = vec3f(0.0);
      if (j < K) { dir = cosineDirK(N, j, K); }   // (stratified across the K fresh rays under GATHER_STRATA — each still cosine-distributed over the set, so the RIS weights stand; K = 2: the Latin square)
      else if (j == K) {
        // E is now the temporal stage's estimate (= π/K Σ L with no history: the plain gather); the survivor's contribution weight, bounded for the f16 it is stored in (a dim
        // survivor beside a bright candidate has a large 1/p̂ — legitimate, but +inf once packed would poison next frame: giLoad refuses anything that is not < GI_WMAX too)
        yW = 0.0;
        if (have && yPh > 0.0 && wsum > 0.0) { yW = min(wsum / yPh, GI_WMAX); }
        else if (!have && anyOk) { yXs = lastXs; yNs = lastNs; yBi = lastBi; ySky = lastSky; yCap = lastCap; yD = lastD; yCos = lastCos; yAlb = lastAlb; yLo = vec3f(0.0); yLoD = vec3f(0.0); yPh = 0.0; yW = 0.0; have = true; }   // everything dark: keep a ZERO-WEIGHT sample ('looked, found nothing' — its confidence rides along, capped low above when it is read back)
        else if (yPh <= 0.0 || wsum <= 0.0) { yW = 0.0; yLo = vec3f(0.0); yLoD = vec3f(0.0); yPh = 0.0; }   // (a dark history and dark fresh rays: still zero-weight)
        Mkeep = select(min(MtE + Kf, mCap), Kf, yCap);                         // (the discounted confidence + this frame's rays; a man's sample never claims more than the rays that found him)
        // ---- spatial (mode 2): k neighbours' temporal reservoirs of last frame, pairwise MIS against the canonical, shade-all. The canonical's pairwise weight m_c is a function of the
        // SURVIVOR y_c and multiplies the whole shade-all estimate E (E[Σ_j a_j·m_c(y_c)] ≠ E[Σ_j a_j·m_c(y_j)]): a mild extra bias of this variant on top of the missing visibility
        // ray — 'full' is the documented biased-but-bounded mode; 'temporal' carries neither. A neighbour holding a valid ZERO-WEIGHT reservoir is dark evidence and takes its share
        // like any other (contribution 0); only a geometric reject returns the share to the canonical. ----
        dbgS = 0.0;
        if (live && mode >= 2u && kSp > 0u && (frame.flags & FLAG_TEMPORAL) != 0u) {
          let kf = f32(kSp); let Mck = max(Mkeep, 1.0) / kf;
          var mc = 0.0; var Enb = vec3f(0.0); var took = 0.0;
          let phi0 = rnd() * 6.2831853; let r0 = rnd();
          let lumC = luminance(yLo);
          for (var tp = 0u; tp < kSp; tp++) {
            let ang = phi0 + f32(tp) * 2.3999632; let rr = max(radius, 1.0) * sqrt((f32(tp) + r0) / kf);
            let qg = vec2i(gid.xy) + vec2i(i32(round(cos(ang) * rr)), i32(round(sin(ang) * rr)));
            var accepted = false;
            if (all(qg >= vec2i(0)) && all(qg < vec2i(odims)) && any(qg != vec2i(gid.xy))) {
              let fq = min(vec2u(qg) * gdiv + (gdiv - 1u) / 2u, vec2u(frame.screen) - 1u);
              let dq = textureLoad(gDepth, fq, 0);
              if (dq < 1.0) {
                let Pq = worldFromDepth(vec2f(fq) + 0.5, dq);
                let Nq = normalize(textureLoad(gNormal, fq, 0).xyz * 2.0 - 1.0);
                if (abs(dot(Pq - P, N)) < 0.05 + 0.004 * zNow && dot(Nq, N) > 0.9) {   // its receiver lies on our plane, facing our way: lit alike to first order
                  let pq = giPrevTexel(Pq, fq, gdiv, odims);
                  if (pq.ok) {
                    let nb = giLoad(pq.q);
                    let nbStaleDark = nb.W <= 0.0 && luminance(nb.Lo) > 1e-5;      // dark evidence at a point the live bounce now lights: stale, not evidence
                    if (nb.valid && nb.M > 0.0 && !nbStaleDark && abs(nb.zRecv - pq.z) < 0.01 * pq.z + 0.02) {
                      // re-target ITS sample here: direction / cos at our receiver, the reconnection Jacobian, our p̂ of it
                      let di = giDirTo(nb, P); let cosI = dot(N, di.xyz);
                      var J = 1.0; var okJ = cosI > 0.0;
                      if (!nb.sky) {
                        let cosHere = -dot(nb.ns, di.xyz);                          // φ at the sample toward US
                        okJ = okJ && cosHere > 0.02 && nb.cosq > 0.02;
                        J = (cosHere * nb.dq * nb.dq) / max(nb.cosq * di.w * di.w, 1e-6);
                        okJ = okJ && J < GI_JMAX && J > 1.0 / GI_JMAX;
                      }
                      if (okJ) {
                        let phCI = luminance(nb.Lo) * cosI * J;                     // p̂_c(y_i)·|J|
                        // p̂_i(y_c)·|J'|: OUR sample as its receiver would rate it (Pq, Nq) — sky: cos only
                        var phIC = 0.0;
                        if (have && lumC > 0.0) {
                          if (ySky) { phIC = lumC * max(dot(Nq, yNs), 0.0); }
                          else {
                            let dc = yXs - Pq; let lc = max(length(dc), 1e-4); let dirc = dc / lc;
                            let cosThere = -dot(yNs, dirc);
                            if (cosThere > 0.02) { let Jp = (cosThere * yD * yD) / max(yCos * lc * lc, 1e-6); if (Jp < GI_JMAX && Jp > 1.0 / GI_JMAX) { phIC = lumC * max(dot(Nq, dirc), 0.0) * Jp; } }
                          }
                        }
                        let Mi = select(min(nb.M, mCap), min(nb.M, Kf), nb.W <= 0.0);   // (a zero-weight neighbour: K rays' worth, as its own texel reads it)
                        mc += (Mck * yPh) / (Mi * phIC + Mck * yPh + 1e-12) / kf;
                        let mi = (Mi * nb.phat) / (Mi * nb.phat + Mck * phCI + 1e-12) / kf;
                        Enb += nb.Lo * (cosI * J * nb.W * mi);                     // f_c(y_i)/p̂_c(y_i) · w_i, w_i = m_i p̂_c(y_i) |J| W_i
                        accepted = true; took += 1.0;
                      }
                    }
                  }
                }
              }
            }
            if (!accepted) { mc += 1.0 / kf; }                                    // a rejected pair: its share of the canonical weight comes home whole
          }
          E = E * mc + Enb;
          dbgS = took / kf;
        }
        if (live && nC > 0u && (frame.flags & FLAG_DIRECT) != 0u) { E += cardIrradiance(P, N, Po, owner, gid.xy); }
        go = specOnGloss(specOn && gloss, id, N);
        if (go) { let gm = glossRay(P); Fm = gm.F; Rm = gm.R; dir = gm.dir; ro = P + vec3f(0.0, 0.02, 0.0); gatherRay = false; }
      } else {
        go = false;
        if (specOn && glassOn) {
          let toP = P - frame.camPos; let dist = length(toP); let V = toP / max(dist, 1e-4);
          let gh = glassTrace(frame.camPos, V, 0.0, dist - 0.02);
          if (gh.idx >= 0) { paneHit = true; Pg = frame.camPos + V * gh.t; gn = gh.n; Fm = glassFresnel(clamp(dot(-V, gn), 0.0, 1.0)) * frame.glassCfg.x; Rm = V - gn * (2.0 * dot(V, gn)); ro = Pg + gn * 0.015; dir = Rm; trOwner = 0u; gatherRay = false; go = Fm > 0.001; }
        }
      }
      var Lm = vec3f(0.0);
      if (go) {
        let r = traceShade(ro, dir, trOwner, gatherRay, N, owner, Po);
        if (gatherRay) {
          // the firefly bound on the whole and on its emission + direct part (the share the reservoir keeps: the cache's bounce is re-added at the stored point every frame)
          let lum = luminance(r.L); let c = min(Lcap, 24.0); let sc = select(1.0, c / lum, lum > c);
          let rL = r.L * sc; let rLoD = max(r.L - r.Lb, vec3f(0.0)) * sc;
          E += rL * (PI_ * mF);                                                 // f/p̂ · w = (L / lum L) · π lum L · m_fresh
          freshE += luminance(rL) * (PI_ / Kf);
          if (r.ok) {
            anyOk = true; lastXs = r.xs; lastNs = r.ns; lastBi = r.bi; lastSky = r.sky; lastCap = r.cap; lastD = r.t; lastCos = select(max(-dot(r.ns, dir), 1e-3), 1.0, r.sky); lastAlb = r.alb;
            let ph = luminance(rL) * max(dot(N, dir), 1e-4);
            let w = PI_ * luminance(rL) * mF;
            wsum += w;
            if (w > 0.0 && rnd() * wsum < w) { yXs = r.xs; yNs = r.ns; yLo = rL; yLoD = rLoD; yAlb = r.alb; ySky = r.sky; yCap = r.cap; yBi = r.bi; yD = r.t; yCos = lastCos; yPh = ph; have = true; }
          }
        } else { Lm = mirrorTail(r, ro, Rm, trOwner, Fm, j == K, P); if (j == K) { spec = Lm; } }
      }
      if (paneHit) { spec += Lm + glassDust(Pg, gn); }
    }
  }
  // ---- the tile's NEWS for next frame: has the light these 64 texels gather changed since their histories were stored? Each lane's fresh estimate of E against what its
  // history believed (both luminance, before any re-shade), summed over the tile in fixed point; a tile total that doubled or halved writes the news bit into every
  // record it stores, and next frame all of them take the full re-shade instead of waiting for the tile's turn — a door thrown open on a dark room, the mains
  // restrike, a torch coming round the corner reach the reused samples a frame after they reach the fresh rays. Steady light never trips it (128 rays a tile
  // average well inside ×2); noise that does costs one tile one loop. (Uniform control flow: every lane of the group reaches this barrier, live or not.) ----
  if (live) {
    atomicAdd(&wgNewsFresh, u32(clamp(freshE * 4096.0, 0.0, 4.0e6)));
    if (histE >= 0.0) { atomicAdd(&wgNewsHist, u32(clamp(histE * 4096.0, 0.0, 4.0e6))); }
    atomicAdd(&wgNewsN, 1u | (select(0u, 1u, histE >= 0.0) << 16u));         // live lanes in the low half, lanes WITH a history in the high half
  }
  workgroupBarrier();
  let nn = atomicLoad(&wgNewsN);
  let nLive = f32(nn & 0xffffu); let nh = f32(nn >> 16u);
  let hSum = f32(atomicLoad(&wgNewsHist)) * (nLive / max(nh, 1.0));          // (scaled to the tile's LIVE lane count — an edge tile, a tile half sky: only lanes with a history said anything, only live lanes gathered)
  let fSum = f32(atomicLoad(&wgNewsFresh));
  let news = nh >= 8.0 && abs(fSum - hSum) > max(min(fSum, hSum), 0.625 * nLive);   // > ×2 either way (0.625 a lane = ~1.5e-4 W/m² × 4096: under that both are 'dark' and nothing is news)
  if (!live) { return; }
  if (frame.debugView == 16u) { E = vec3f(Mkeep / mCap, dbgT, max(dbgS, select(0.0, 0.5, news || tNews))); textureStore(outIndirect, gid.xy, vec4f(E, 1.0)); }   // (b: spatial taps accepted, or ½ = the tile has / acted on NEWS this frame)
  else { textureStore(outIndirect, gid.xy, vec4f(E * frame.indirectScale, 1.0)); }
  // ---- store the TEMPORAL reservoir for next frame ----
  if (have) {
    let flags = 1u | select(0u, 2u, ySky) | select(0u, 4u, yCap) | select(0u, 8u, news);
    let A = vec4u(p5PackXZ(yXs), p5PackYN(yXs, yNs), pack2x16float(yLoD.xy), pack2x16float(vec2f(yLoD.z, yW)));
    let B = vec4u((u32(clamp(Mkeep, 0.0, 255.0)) & 255u) | (flags << 8u) | (min(yBi, GI_NOBOX) << 12u), (pack2x16float(vec2f(min(zNow, 60000.0), 0.0)) & 0xffffu) | (giPackAlb(yAlb) << 16u), pack2x16float(vec2f(min(yD, GI_SKY_D), yCos)), (pack2x16float(vec2f(yPh, 0.0)) & 0xffffu) | (p5PackOct16(N) << 16u));
    textureStore(resOutA, gid.xy, A); textureStore(resOutB, gid.xy, B);
  } else { textureStore(resOutA, gid.xy, empty); textureStore(resOutB, gid.xy, empty); }
  // ---- the specular field (traced in the loop above, as main)
  if (specOn) {
    textureStore(outSpecular, gid.xy, vec4f(spec, specHitT));
  }
}
