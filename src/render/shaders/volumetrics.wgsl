// Half-resolution (quarter with the lossy volQuarter option: frame.lossyCfg.y is the divisor) volumetrics: (a) thin haze lit by spot/point lights with ray-traced shadows (visible beams),
// (b) ray-marched smoke domains lit by the same lights (shadow rays + self-shadowing) and by the RC mean radiance, (c) the weather's rain / splashes / sky flash.
// Output: rgb = in-scattered radiance, a = transmittance toward the surface.
// Under FLAG_FROXEL_VOL (renderer v3 Phase 2b) the haze beams live in the froxel volume (froxel.wgsl; composite fetches them per pixel) and this pass keeps
// (b) — the smoke's per-pixel density march, its plume too fine for a froxel — but LIT FROM THE FROXELS: one fetch of their source-radiance volume J per
// step where it used to spend K shadow rays + self-shadow marches + the ambient's wall test (smokeMarchJ), and (c) the rain. Flag off = every line below
// runs as it always did. Prelude: scene + lighting_common + vol_common (phaseHG / hazeAt / max3 / coneInterval / the masked smoke samplers).
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var diceTex: texture_3d<f32>;
@group(1) @binding(2) var outVol: texture_storage_2d<rgba16float, write>;
@group(1) @binding(3) var outReact: texture_storage_2d<rgba16float, write>;   // .g = the SMOKE-ONLY transmittance of the pixel's ray (post.wgsl's smoke diffusion: haze must not blur what is far away);   // luminance of what (c) below added — rain streaks, splash crowns, a stroke's lit sky — attenuated as composited: the TAAU resolve's reactive input (0 = nothing this texel)
@group(1) @binding(4) var smokeJ: texture_3d<f32>;   // the froxels' smoke source radiance (froxel.wgsl injectJ: rgb = Σ lights E·vis·selfshadow·phase + the walled ambient, at texel centres; a = 1 where a live domain is near) — FLAG_FROXEL_VOL only

fn smokeSelfShadow(P: vec3f, L: vec3f) -> f32 {
  var od = 0.0; let ds = 0.18;
  for (var i = 1; i <= 4; i++) { od += smokeDensityAt(P + L * (f32(i) - 0.3) * ds); }
  return exp(-od * ds * 6.0);
}

// ---- Phase-0 worst-case caps (docs/internal/renderer-v3.md §2: the smoke march and the beams were the field's #1 variance source) ----
// frame.volCfg.x = K, the most lights any one march step (smoke) / any one view ray (haze beams) spends shadow rays on — the K strongest by UNSHADOWED
// contribution there, the rest dropped (never credited unshadowed: a torch behind a wall must not glow in the smoke this side of it). K = 0 is the switch
// OFF: every line of the K > 0 paths is bypassed and the pass runs exactly the code it always ran (ui/quality.ts presets: ultra 6 · high 4 · medium 3 ·
// low / verylow 2; RenderSettings.volLightCap). With K > 0 the smoke march also (1) walks each live domain's OWN stretch of the ray front to back (merged
// where they overlap) at that domain's step, instead of one march across the hull of all of them at the finest voxel any of them has — two canisters ten
// metres apart no longer cost the empty air between them at 3 cm steps — and (2) keeps a bounded shortlist (the 16 lights with the largest unshadowed
// bound on THIS stretch) instead of falling back to scoring every light in the level per step once more than 16 pass the bound (44 lights × 112 steps
// per ray was the 25 ms frame). Everything else — thresholds, phase, self-shadowing, the transmittance early-out — is the estimator as it was.
const VOL_KMAX: u32 = 6u;
// THE K = 0 MARCH (no quality row ships it: every tier's caps.volK is 2 or more) is compiled only into its own twin (passes.ts volK0Pipe, built the first frame
// settings.volLightCap is 0): the boot's program carries false here, so the compile — DXC, Chrome's compiler on Windows, ~1.3 s of it — does not pay for a march no tier runs.
const VOL_K0: bool = false;
// THE FROXEL-LIT SMOKE MARCH (smokeMarchJ: the medium, low and very low presets) likewise: the boot's program (passes.ts pVol) is compiled with false here — the classic tiers'
// march, beams and rain — and the froxel tiers draw through its twin with true (pVolF, a LATER pipeline; the engine raises FrameFlags.FroxelVol only once it is in).
const VOL_FROXEL_MARCH: bool = true;
const MARCH_REFRESH_W: f32 = 0.02; // … and a light's shadow ray + self-shadow are refreshed (every `every` steps) only at steps whose weight T·(1 − e^−σΔ) in the pixel exceeds this — deep in the core and out in the thin skin the last answer stands (each slot is traced at least once a stretch)
const MARCH_DIR_TMAX: f32 = 30.0;  // … and a shadow ray toward a DIRECTIONAL light (the moon, the breach's sun: evalLight says 1e6 m) stops at 30 m: from anywhere smoke can be (under 3.5 m) a ray climbing at 15° or more has cleared this level's 8 m of roof by then — nothing beyond can shadow it, and the walk to the world's rim was the moon's whole price
const MARCH_MINOR_K: f32 = 0.04;     // smokeMarchJ's per-step lights: one whose unshadowed irradiance at a step is under this share of the stronger ones' there spends no shadow ray and no self-shadow taps (docs/internal/smoke-look.md §2: the moon's 80 m ray from every lit step of a lamp-lit plume was a fifth of the pass)
const VOL_RAY_STEPS: u32 = 160u;   // K > 0: march steps one view ray may spend over ALL its smoke stretches (each ≤ 112 as the hull march was; eight thin gun-smoke domains in a row no longer make 8 × 42)
// (the masked smoke samplers the K > 0 paths use — smokeTransIn / smokeSelfShadowIn / smokeDomainsNear — live in vol_common.wgsl: the froxel kernels share them; smokeDensityIn itself in common.wgsl)

// (coneInterval — the ray's stretch inside a spot's cone — lives in vol_common.wgsl with the other shared helpers)

// ---- (c) weather (game/weather.ts): rain streaks and splash rings in the OUTDOOR air, and the lit-sky glow of a lightning stroke ----
// Rain is not simulated: it is a lattice of falling drop columns evaluated analytically along the view ray. Columns stand at hashed points of a
// RAIN_CELL xz lattice (two per cell, each with a rank so frame.weatherA.x thins them out), leaning with the wind (weatherA.yz: metres sideways per
// metre of height), and carry a drop every RAIN_PERIOD metres falling at RAIN_V, each drawn out RAIN_LEN long — the streak a 1/30 s eye makes of it.
// The view ray, sheared the same way so that the columns stand vertical (a shear keeps lines lines and the ray parameter what it was), walks the
// lattice cells under its outdoor stretch with a 2D DDA, takes its closest approach to each column it passes, and where that comes within half a
// texel of a lit stretch of streak adds the streak: the UNSHADOWED irradiance of every light that can reach that point (the sodium heads overhead,
// the moon, a stroke of lightning — reach masks keep the office's panels indoors) × a small scattering gain, spread over the texel's width so a
// near streak and a far one carry the same energy. Only rays that END outdoors (or in the sky) rain, only below weatherB.w, and never inside the
// interior footprint's column (weatherC) — the roof is invisible from up here and the rooms must stay dry. Deterministic per frame (no jitter,
// nothing for a history to hold): the animation is frame.time alone.
const RAIN_CELL: f32 = 0.45;    // lattice cell (m): two columns a cell ≈ 10 columns / m² at full rate
const RAIN_V: f32 = 9.0;        // fall speed (m/s) — big drops
const RAIN_LEN: f32 = 0.30;     // streak length (m)
const RAIN_PERIOD: f32 = 2.2;   // drop spacing down one column (m)
const RAIN_W: f32 = 0.006;      // physical half-width credited to a streak (its energy); DRAWN max(this, 0.6 texel) wide
const RAIN_GAIN: f32 = 0.11;    // fraction of the irradiance at the streak scattered toward the eye — by eye: a metre under a sodium head streaks glare, at the ground they read against the lit asphalt, under the moon alone they are a faint grain
const SPLASH_W: f32 = 0.006;     // a splash ring's own line width (m): DRAWN max(this, a texel) wide
const SPLASH_FILL: f32 = 0.056; // the light of a ring's own line over that of its whole 9 cm cell lit for the ring's life (RAIN_SCALE's floor; measured: tools/qa/rainscale-check.ts)
const SPLASH_GAIN: f32 = 0.05;  // the same for the crown a drop throws up where it lands (a ring growing over 60 ms on outdoor ground)

fn outdoorsXZ(p: vec2f) -> bool { if (WX_KINDS) { if (frame.cardCfg.y != 0u) { return !wxRoofed(p); } } let I = frame.weatherC; let A = frame.weatherD; return (p.x < I.x || p.y < I.y || p.x > I.z || p.y > I.w) && (p.x < A.x || p.y < A.y || p.x > A.z || p.y > A.w); }   // outside the interior footprint AND outside the annex (the stair tower: a ray ending on its floor is under a roof — its column is not cut out of passing rays, being three metres of air against the facade)
/** PARTICLE RAIN (experiment, game/rainFx.ts): the share of the lattice's streaks / splash rings KEPT at ground point p — 1 outside the particle layer's disc (frame.weatherE: centre xz,
 *  radius, the share it takes), 1 − that share inside its inner 70 %, eased between over the rim the recycler thins its births across (particles.wgsl emit's taper). weatherE.w 0 =
 *  no particle layer anywhere: 1 exactly, and the callers below then multiply by nothing (their untouched statements run). */
fn rainNearKeep(p: vec2f) -> f32 {
  let Ew = frame.weatherE;
  let r = distance(p, Ew.xy) / max(Ew.z, 1e-3);
  return 1.0 - Ew.w * (1.0 - smoothstep(0.7, 1.0, r));
}

// Irradiance at X from every light that can reach X's cell (isotropic receiver), plus the storm's lit sky. Unshadowed but where the reach mask is not sure (below): rain glinting
// inside a parked car's shadow is not something anyone can see, and this runs once per streak the ray meets. PARTICLE RAIN v2: under frame.weatherF.w > 0
// each light is weighted by the drop's PHASE toward the eye at V (isotropic floor weatherF.x + forward lobe weatherF.y × Henyey-Greenstein(weatherF.z), × gain
// weatherF.w — particles.wgsl rainPhase without the glint), so the far lattice flares looking into a lamp exactly as the near particles do; weatherF.w 0 = the sum as it was.
fn rainHg(mu: f32, g: f32) -> f32 { let d = max(1.0 + g * g - 2.0 * g * mu, 1e-4); return (1.0 - g * g) / (d * sqrt(d)); }
fn rainLight(X: vec3f, V: vec3f) -> vec3f {
  var E = frame.weatherB.xyz;
  let PF = frame.weatherF; let phased = PF.w > 0.0; let g = clamp(PF.z, 0.0, 0.98);
  for (var i = 0u; i < frame.numLights; i++) {
    let lv = lightReachLevel(i, X);
    if (lv == 0u) { continue; }              // (reach.ts: an interior fixture lights the rain outside its own windows, not through the wall)
    let li = lights[i];
    let ev = evalLight(li, X, vec3f(0.0));
    if (!ev.ok) { continue; }
    // WHERE THE MASK IS NOT SURE, A RAY SAYS (RAIN_SHADOW): a mask counts every doorway as open (a leaf moves) and a cell reached only through one, or by a sliver,
    // is level 1 or 2 — a bulb in a shut room lit the rain in a wedge outside its door; a carried light and a flash have no mask at all (level 3 everywhere) — a
    // weapon light pointed at a wall from inside lit the rain beyond it. Those ask one shadow ray; a fixed lamp's plainly reached cells (level 3) stay unshadowed,
    // as do the moon and a stroke of lightning.
    if (RAIN_SHADOW && lightKind(li) != 2u && (lv < 3u || (li.owner & 0xffu) != 0u || lightTransient(li))
        && occluded(X, ev.L, ev.dist.x - li.radius - 0.02, (li.owner & 0xffu) << 8u)) { continue; }
    if (phased) { E += ev.E * (PF.x + PF.y * rainHg(-dot(ev.L, V), g)); } else { E += ev.E; }
  }
  return select(E, E * PF.w, phased);
}

// Rain met along [t0, t1] of the view ray ro + t·rd (world frame): rgb to add, already weighted by coverage. No extinction (rain hides nothing at these rates).
fn rainAlong(ro: vec3f, rd: vec3f, t0: f32, t1: f32) -> vec3f {
  var acc = vec3f(0.0);
  if (t1 <= t0 + 1e-4) { return acc; }
  let K = frame.weatherA.yz;
  let o2 = ro.xz - K * ro.y; let d2 = rd.xz - K * rd.y;             // the ray in the sheared frame where the leaning columns stand vertical (same t)
  let dd = dot(d2, d2); if (dd < 1e-8) { return acc; }              // looking straight down the columns: none can be crossed (never, from this camera)
  let texelM = 2.0 * frame.post.w * frame.lossyCfg.y / frame.screen.y;   // metres per volumetric texel, per metre of distance (post.w = tan(fov/2), lossyCfg.y = this pass's divisor)
  let rate = frame.weatherA.x; let top = frame.weatherB.w;
  if (rate <= 0.0) { return acc; }                                    // a dry storm (lightning without rain): nothing to walk
  var cell = vec2i(floor((o2 + d2 * t0) / RAIN_CELL));
  let pos = d2 >= vec2f(0.0);
  let stp = select(vec2i(-1), vec2i(1), pos);
  let big2 = select(vec2f(-1e20), vec2f(1e20), pos);                  // (a component of d2 exactly 0: never cross that axis — signed like the step so tNext stays ahead)
  let inv = vec2f(select(1.0 / d2.x, big2.x, abs(d2.x) < 1e-20), select(1.0 / d2.y, big2.y, abs(d2.y) < 1e-20));
  var tNext = ((vec2f(cell) + select(vec2f(0.0), vec2f(1.0), pos)) * RAIN_CELL - o2) * inv;
  let tDel = abs(RAIN_CELL * inv);
  var t = t0;
  for (var it = 0u; it < 72u && t < t1; it++) {                     // (72: a 24° spectate pitch runs ~16 m of lattice through the 7 m slab ≈ 50 cells; the follow camera needs ~25)
    let cf = vec2f(cell);
    for (var k = 0u; k < 2u; k++) {
      let fk = f32(k);
      if (hash13(vec3f(cf, fk * 7.31 + 1.7)) >= rate) { continue; }                       // this column is not falling at this rate
      let c = (cf + 0.2 + 0.6 * vec2f(hash13(vec3f(cf, fk * 3.77 + 11.1)), hash13(vec3f(cf.yx, fk * 5.13 + 23.9)))) * RAIN_CELL;   // (kept 9 cm inside its cell: only the cells the ray's centreline crosses are visited, so a column nearer the edge than halfW would be missed from the far side)
      let tc = dot(c - o2, d2) / dd;                                                        // closest approach of the (sheared) ray to the column
      if (tc <= t0 || tc >= t1) { continue; }
      let y = ro.y + rd.y * tc;
      if (y < 0.02 || y > top) { continue; }
      let halfW = max(RAIN_W, 1.1 * tc * texelM);                                           // a texel either side: the pass's texels march interleaved pixels of their 2×2 block (main), so anything thinner comes out beaded
      let dist = length(o2 + d2 * tc - c);
      if (dist >= halfW) { continue; }
      let sc = (y + RAIN_V * frame.time) / RAIN_PERIOD + hash13(vec3f(cf, fk * 9.07 + 37.3)) * 17.0;
      let u = fract(sc) * (RAIN_PERIOD / RAIN_LEN);                                        // 0 at the drop (the streak's lower end) → 1 at its tail; ≥ 1 = between drops
      if (u >= 1.0) { continue; }
      let big = 0.35 + 1.3 * hash13(vec3f(cf.yx, floor(sc) * 1.31 + fk * 4.1));           // this drop's size: they are not all alike (a few fat ones glint, most are fine)
      let xr = dist / halfW;
      let shape = (1.0 - xr * xr) * (1.0 - 0.7 * u) * big * (1.0 - smoothstep(top - 1.0, top, y));   // across the streak (flat-topped: the interleaved texels along one streak sit up to half a texel either side of it, and a peaked core would ladder), along it (the tail thins), per drop, and in over the top metre
      var keep = 1.0; if (frame.weatherE.w > 0.0) { keep = rainNearKeep((ro + rd * tc).xz); }   // (particle rain: the near field is the particles' — this streak's share kept; exactly 1 without it)
      acc += rainLight(ro + rd * tc, -rd) * (RAIN_GAIN * 0.5 * shape * RAIN_W / halfW) * keep;  // (0.5: the flat profile carries twice the peaked one's area)
    }
    if (tNext.x < tNext.y) { t = tNext.x; tNext.x += tDel.x; cell.x += stp.x; } else { t = tNext.y; tNext.y += tDel.y; cell.y += stp.y; }
  }
  return acc;
}

// The crown a landing drop throws up, on outdoor GROUND (P.y under a hand): each 9 cm cell of the lot lands a drop every 1/f seconds at its own
// phase (f ∝ rain rate), and for 60 ms afterwards a ring grows out of a hashed point in it; a pixel on the ring returns its brightness 0..1.
fn splashAt(P: vec3f) -> f32 {
  let rate = frame.weatherA.x * frame.weatherA.w;
  if (rate <= 0.0 || P.y > 0.08) { return 0.0; }
  let cs = 0.09;
  let q = floor(P.xz / cs);
  let f = 1.4 * rate;                                                  // landings per cell per second (≈ 170 / m² / s in a downpour — the big drops)
  let age = fract(frame.time * f - hash13(vec3f(q, 3.3)) * 31.0) / f;  // seconds since this cell's last landing
  if (age > 0.06) { return 0.0; }
  let ctr = (q + 0.35 + 0.3 * vec2f(hash13(vec3f(q, 8.1)), hash13(vec3f(q.yx, 5.9)))) * cs;   // (kept 3 cm inside its cell: only the pixel's own cell is asked, so a ring must not run out of it)
  let r = 0.006 + age * 0.3;                                           // the ring runs out at 0.3 m/s to 2.4 cm
  let d = abs(distance(P.xz, ctr) - r);
  let w = max(SPLASH_W, distance(P, frame.camPos) * 2.0 * frame.post.w * frame.lossyCfg.y / frame.screen.y);   // ring line width: a texel at this distance (thinner aliases between the interleaved texels), 6 mm at least
  // RAIN_SCALE: drawn wider than its own line the ring keeps its LIGHT, not its brightness — dimmer by the footprint it gained (the line's two sides, less what
  // of the inner side has no room inside the ring), as a streak is by RAIN_W / halfW. With the camera pulled back a texel is many centimetres at the ground
  // and every ring was a blob that wide at a ring's full brightness. Exactly 1 where the texel is no wider than the line. (SPLASH_FILL: only the pixel's own
  // cell is asked, so a ring drawn wider than its cell stops gaining footprint there — the floor is the share of its cell a ring's own line covers.)
  var keepE = 1.0;
  if (RAIN_SCALE && w > SPLASH_W) { let i0 = max(r - SPLASH_W, 0.0); let i1 = max(r - w, 0.0); keepE = ((r + SPLASH_W) * (r + SPLASH_W) - i0 * i0) / ((r + w) * (r + w) - i1 * i1); keepE = min(1.0, sqrt(keepE * keepE + SPLASH_FILL * SPLASH_FILL)); }
  return (1.0 - smoothstep(0.0, w, d)) * (1.0 - age / 0.06) * keepE;
}

// (b′) FLAG_FROXEL_VOL: the smoke march of the K > 0 path — the same per-domain stretches front to back, the same step (never finer than ~3 texels across at that
// distance), the same masked density sample, energy-conserving step and 3 % early-out — with the lighting of each lit step read from the froxels' J volume on
// this pixel's ray (uv is the pixel's: every step projects to it), half a slice nearer than the step (see the fetch), instead of evaluated there. → (in-scatter,
// transmittance).
fn smokeMarchJ(ro: vec3f, rd: vec3f, tSurf: f32, jitter: f32, uv: vec2f) -> vec4f {
  var inscatter = vec3f(0.0); var T = 1.0;
  let invRd = safeInv(rd);
  var ivA: array<vec3f, 8>; var ivM: array<u32, 8>; var niv = 0u;   // (tEnter, tExit, voxel) + domain bit per live domain the ray crosses before the surface, sorted by tEnter
  for (var i = 0u; i < frame.numSmoke; i++) {
    let sd = smoke[i];
    if (sd.live == 0u) { continue; }
    let tb = isectBounds(ro, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
    if (!(tb.x <= tb.y && tb.y > 0.0 && tb.x < tSurf)) { continue; }
    let a = max(tb.x, 0.0);
    var j = niv;
    while (j > 0u && ivA[j - 1u].x > a) { ivA[j] = ivA[j - 1u]; ivM[j] = ivM[j - 1u]; j--; }
    ivA[j] = vec3f(a, min(tb.y, tSurf), sd.voxel); ivM[j] = 1u << i; niv++;
  }
  if (niv == 0u) { return vec4f(inscatter, T); }
  var m = 0u;                                                        // merge overlapping stretches in place (finest voxel wins, domain bits OR)
  for (var i = 1u; i < niv; i++) {
    if (ivA[i].x <= ivA[m].y) { ivA[m].y = max(ivA[m].y, ivA[i].y); ivA[m].z = min(ivA[m].z, ivA[i].z); ivM[m] |= ivM[i]; }
    else { m++; ivA[m] = ivA[i]; ivM[m] = ivM[i]; }
  }
  let nInt = m + 1u;
  var rayBudget = VOL_RAY_STEPS;
  let D = f32(frame.froxelB.z);
  let stepVox = select(1.5, f32(frame.volCfg.z) * 0.1, frame.volCfg.z > 0u);
  let texelRad = 2.0 * frame.post.w * frame.lossyCfg.y / frame.screen.y;
  let tCut = 0.02 + 0.02 * jitter;   // the opaque early-out, dithered round its old 3 %: a fixed threshold dropped what lay behind it at a different step from one pixel to the next — one more contour
  let Kc = min(smokeMarchLights(), VOL_KMAX);   // (vol_common.wgsl) LIGHTS lit per step by this march itself, J then carrying the ambient alone: 0 = the J-lit march exactly as it was
  let every = max(frame.volCfg.y, 1u);           // their shadow ray + self-shadow refreshed every `every` steps and reused between — the K > 0 march's own rule, on its fixed phase: the 8 × 8
                                                 // pixels of a workgroup trace at the SAME steps (a per-pixel phase dithers the stale edge but splits the SIMD lanes: measured dearer than
                                                 // tracing twice as often; a per-frame phase halves the rays but flickers a shadow edge ±1 level at a 4-frame period in motion — both tried, §2)
  for (var ii = 0u; ii < nInt && T >= tCut; ii++) {
    let t0 = ivA[ii].x; let t1 = ivA[ii].y; let vox = ivA[ii].z; let onMask = ivM[ii];
    let span = t1 - t0;
    if (span <= 0.0 || rayBudget == 0u) { continue; }
    // The LIGHTS on this stretch, per step (settings.smokeMarchLights = Kc > 0; docs/internal/smoke-look.md). The froxels' J volume stands 15 cm across and a whole
    // slice deep (0.6 m at the follow distance): a torch entering a plume through it lights every billow alike — cone edge, the leaf's shadow and above all the plume's
    // OWN shadow along the beam become one trilinear ramp (the flat, over-bright blob) — and worse, J point-samples that steep self-shadowed light field once per slice, so
    // a plume top under a lamp head or a ceiling panel is lit through a lattice fixed to the SCREEN: a world point's brightness swings ±2‥4 % as the camera or the plume
    // moves it through the slices (the 'screen-space banding' two lanes could not find in stills — it only exists in motion). So with Kc > 0 injectJ writes the AMBIENT
    // alone into J (smooth over metres: the grid holds it) and the Kc strongest lights by unshadowed bound on the stretch (the K > 0 march's exact culls: range, the
    // 0.03 floor, the cone, the panel's facing; the K-th+1 dropped as that march always dropped it) are lit per step here — evalLight, a shadow ray every `every` steps,
    // the step's own 4-tap self-shadow, the phase: the pre-froxel plume, with the froxels still carrying the haze and the ambient.
    var cc: array<u32, VOL_KMAX>; var ccb: array<f32, VOL_KMAX>; var ncc = 0u; var nearMask = 0u;
    if (Kc > 0u) {
      let A = ro + rd * t0; let B = ro + rd * t1;
      nearMask = onMask | smokeDomainsNear(min(A, B), max(A, B), 0.75);                  // what a self-shadow tap ≤ 0.7 m off the stretch toward a light can lie in
      for (var i = 0u; i < frame.numLights; i++) {
        let li = lights[i]; let mc = max3(li.color); let kind = lightKind(li);
        var bound = mc;                                                                   // (directional: no falloff, no cone — the K > 0 march's own rule)
        if (kind != 2u) {
          let tc = clamp(dot(li.pos - ro, rd), t0, t1); let dv = ro + rd * tc - li.pos; let d2 = dot(dv, dv);
          if (d2 > li.range * li.range) { continue; }
          bound = mc / max(d2, li.radius * li.radius);
          if (bound < 0.03) { continue; }
          if (!(lightReaches(i, A) || lightReaches(i, B) || lightReaches(i, (A + B) * 0.5))) { continue; }   // walled off from the whole stretch (reach.ts, as injectJ / the cull test it): a bright lamp behind the wall must not take a slot from a light that does reach the plume
          if (kind == 1u && li.cosOuter > 0.0) { let ci = coneInterval(ro, rd, li.pos, li.dir, li.cosOuter); if (max(ci.x, t0) >= min(ci.y, t1)) { continue; } }
          else if (kind == 3u) { if (dot(A - li.pos, li.dir) <= 0.0 && dot(B - li.pos, li.dir) <= 0.0) { continue; } }
        } else if (bound < 0.03) { continue; }
        if (ncc == Kc && bound <= ccb[Kc - 1u]) { continue; }
        var p = min(ncc, Kc - 1u);
        while (p > 0u && ccb[p - 1u] < bound) { ccb[p] = ccb[p - 1u]; cc[p] = cc[p - 1u]; p--; }
        ccb[p] = bound; cc[p] = i; ncc = min(ncc + 1u, Kc);
      }
    }
    var visBits = 0u; var validBits = 0u; var knownBits = 0u; var selfC: array<f32, VOL_KMAX>;   // per light slot: visible from the last step that traced it, is that fresh, was it ever traced on this stretch, its self-shadow there
    let dtStep = max(vox * stepVox, min(0.0825, t0 * texelRad * 3.0));
    // A FIXED step for the stretch — never coarser than a quarter of it (the old four-step floor), never finer than the 112-step cap allows — so the sample lattice
    // t0 + (k + u)·dt only ever SLIDES with the stretch's ends, its last step PARTIAL (covering, and sampled inside, just what is left). The old `dt = span ∕ steps`
    // re-spaced every sample each time span ∕ dtStep crossed an integer, and the stretch mostly ends on the surface behind the plume: that drew the iso-contours of the
    // surface's depth across every lit plume — regular bands about a step of depth apart, fixed to the camera, stepping over the smoke as the view moved
    // (docs/internal/render-defects-0812.md §2). Both dt regimes vary continuously with span; only the count jumps, and a step born at the far end is born empty.
    let dt = max(min(dtStep, span * 0.25), span * (1.0 / 112.0));
    let steps = min(u32(ceil(span / dt - 1e-4)), rayBudget);
    rayBudget -= steps;
    for (var s = 0u; s < steps; s++) {
      let ta = t0 + f32(s) * dt;                                   // this step's near end
      let len = min(dt, t1 - ta);                                  // (the last one: whatever is left of the stretch)
      if (len <= 0.0) { break; }
      let t = ta + len * jitter;                                   // the sample, stratified inside the (partial) step
      if ((s % every) == 0u) { validBits = 0u; }                   // (per-step lights: every shadow answer is at most `every` steps old, lit steps or not)
      let X = ro + rd * t;
      let dens = fogSmoke(smokeDensityIn(X, onMask), X);
      if (dens == 0.0 && spgHole) { let hop = u32(clamp((smokeClearRun(X, rd) - 1e-3) / dt, 0.0, 4096.0)); if (hop > 0u) { if ((s % every) + hop >= every) { validBits = 0u; } rayBudget += min(hop, steps - 1u - s); s += hop; continue; } }
      if (dens > 0.002) {
        let sigT = dens * 6.0;
        let sigS = sigT * 0.92;
        let stepT = exp(-sigT * len);
        let wStep = T * (1.0 - stepT);                             // this step's weight in the pixel (what a shading error here can move it by): rays are spent where it shows
        var Lin = textureSampleLevel(smokeJ, linSamp, vec3f(uv, (froxelSlice(t) - 0.5) / D), 0.0).xyz;   // J sits at texel centres (s = k + ½ ↔ w = s/D exactly; its texels span screen uv 0‥1 by construction) — read half a slice NEARER on purpose: the texel a floor-hugging plume's lowest samples share with the floor has its centre under the slab, every light occluded, and read exactly its weight on the samples sharing its slice would be at least half (all of it at the slab); shifted, that texel's weight there never passes ½ (the sun's terraces are a different defect: injectJ's depth strata)
        var Lin2 = vec3f(0.0); let msGain = smokeMsGain();       // the multiple-scattering octave's light (vol_common.wgsl smokeMsGain; the ambient J stays in the single lobe — it is diffuse already)
        var eSeen = 0.0;                                           // unshadowed irradiance of the lights already lit at this step, strongest bound first
        for (var c = 0u; c < ncc; c++) {                           // + the lights this march lights itself (none when Kc = 0): the K > 0 march's inner loop statement for statement, plus the minor-light rule
          let li = lights[cc[c]];
          let ev = evalLight(li, X, vec3f(0.0));
          if (!ev.ok || max3(ev.E) < 0.03) { continue; }
          let e = max3(ev.E);
          if (e < MARCH_MINOR_K * eSeen) {                         // a MINOR light beside what already lights this step (the moon under a sodium head: 0.9 against 65): no ray, no taps —
            Lin += ev.E * phaseHG(dot(rd, ev.L), 0.35) * select(1.0, selfC[0], (visBits & 1u) != 0u);   // credited with the strongest light's self-shadow while that one is lit here; in its SHADOW credited plainly
            Lin2 += ev.E * phaseHG(dot(rd, ev.L), SMOKE_MS_G) * select(1.0, sqrt(selfC[0]), (visBits & 1u) != 0u);   // (the multiple-scattering octave: half as forward, √ the self-shadow) (no ray of its own — a hair of leak, never a plume gone black where the moon is all the light there is: wave-4 review)
            continue;                                              // (bounded: under 4 % of the step's UNSHADOWED light; alone in the dark it is nobody's minor and gets the full treatment)
          }
          eSeen += e;
          let bit = 1u << c;
          if ((validBits & bit) == 0u && (wStep > MARCH_REFRESH_W || (knownBits & bit) == 0u)) {   // due AND worth it: a step that can move the pixel by less than MARCH_REFRESH_W (thin haze at the skin, the
            let vis = !occluded(X, ev.L, min(ev.dist.x - li.radius - 0.02, MARCH_DIR_TMAX), (li.owner & 0xffu) << 8u);   // core behind opaque smoke) keeps the last answers; each slot is traced at least once a stretch —
            visBits = select(visBits & ~bit, visBits | bit, vis); validBits |= bit; knownBits |= bit;                   // the light's own carrier never shadows its beam; the moon / sun ray ends past the roofs
            if (vis) { selfC[c] = smokeSelfShadowIn(X, ev.L, nearMask); }
          }
          if ((visBits & bit) == 0u) { continue; }
          Lin += ev.E * phaseHG(dot(rd, ev.L), 0.35) * selfC[c];
          Lin2 += ev.E * phaseHG(dot(rd, ev.L), SMOKE_MS_G) * sqrt(selfC[c]);
        }
        inscatter += T * Lin * sigS * (1.0 - stepT) / max(sigT, 1e-4);
        inscatter += msGain * sqrt(T) * Lin2 * (sigS / max(sigT, 1e-4)) * (1.0 - sqrt(stepT));   // the octave to the eye through half the extinction: √T of the way in, (1 − √stepT) of this step (σs/2 ÷ σt/2 = the same albedo)
        T *= stepT;
        if (T < tCut) { break; }
      }
    }
  }
  return vec4f(inscatter, T);
}

// ---- (w) THE WEATHER'S AIR (const WX_VOL — render/frame.ts weatherVolConfig; common.wgsl wxAir is the field): a picked weather's dust / fog marched along the
// pixel's ray through the layer it stands in (the ground to WX_TOP over the ceiling plane), front to back, energy-conserving:
//   extinction   σ(X) = wxAir — the open air's own density, a room's share of it under a roof, nothing over a roof; × the drifting banks (picture only)
//   the sky      the radiance cache's mean radiance at X × the fog's tint: the sky's light and what the lit ground and walls throw back, where they reach
//   sun, moon    every directional light (a stroke of lightning is one) through a shadow ray — a wall, a man, a smoke plume cuts its own shape out of the
//                lit air — and the phase below: looking up-sun the air glows, down-sun it is quiet
// Under a roof a directional light that lights the building's thin haze (volumetric > 0: the sun) lights haze AND weather together by the statement the haze march
// always used for it (hazeAt carries the weather's share: common.wgsl wxHazeK) — that march and the froxels' stand down for directional lights while a weather is
// in, so the sun in the air has one owner at every tier. The lamps' and torches' cones keep their own march (the same field through hazeAt).
// → (in-scatter toward the eye, transmittance of the air to the surface).
const WX_STEP: f32 = 0.75;      // the march's step it aims for (m) …
fn wxMaxSteps() -> u32 { let n = (frame.volCfg.w >> 24u) & 31u; return select(max(n, 3u), max(frame.volSteps / 2u, 4u), n == 0u); }   // … up to the tier's budget (ultra 12 … verylow 4): longer rays take longer steps (jittered; the resolve averages them)
fn wxPhase(mu: f32) -> f32 { return 0.6 * phaseHG(mu, 0.45) + 0.4 / (4.0 * PI); }   // mineral dust / droplets: the haze's forward lobe over a broad isotropic floor
var<private> wxFlash: f32 = 0.0;   // the part of the march's in-scatter a TRANSIENT light put there (a stroke of lightning), as luminance: reactive for the resolve like the lit rain
fn wxAirMarch(ro: vec3f, rd: vec3f, tSurf: f32, jit: f32) -> vec4f {
  let top = CEIL_Y + WX_TOP;
  var ta = 0.0; var tb = tSurf;
  if (abs(rd.y) > 1e-5) { let t0 = (top - ro.y) / rd.y; let t1 = -ro.y / rd.y; ta = max(ta, min(t0, t1)); tb = min(tb, max(t0, t1)); }
  else if (ro.y > top || ro.y < 0.0) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  if (tb <= ta) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let F = wxFog();
  let alb = F.tint;
  var dl: array<u32, 2>; var nd = 0u;   // the directional lights (the sun or the moon; a stroke)
  for (var i = 0u; i < frame.numLights && nd < 2u; i++) { if (lightKind(lights[i]) == 2u) { dl[nd] = i; nd++; } }
  let hazeOn = (frame.flags & FLAG_VOLUMETRICS) != 0u && frame.hazeDensity > 0.0;
  let n = clamp(u32(ceil((tb - ta) / WX_STEP)), 3u, wxMaxSteps());
  let dt = (tb - ta) / f32(n);
  var acc = vec3f(0.0); var T = 1.0;
  for (var s = 0u; s < n; s++) {
    let X = ro + rd * (ta + (f32(s) + jit) * dt);
    let air = wxAir(X);
    let roofed = air.y > 0.5;
    let sg = air.x * wxBank(X.xz);
    let stepT = exp(-sg * dt);
    var Lw = vec3f(0.0);   // radiance the weather's own scatterers send toward the eye, per unit of their albedo
    var Lh = vec3f(0.0);   // … and what the building's haze + the weather in it send, per metre (under a roof, the sun's)
    if (sg > 1e-5) { Lw = diceMeanRadiance(X); if (!roofed) { Lw += frame.weatherB.xyz * 0.5; } }
    for (var k = 0u; k < nd; k++) {
      let li = lights[dl[k]];
      let Ld = -li.dir;
      if (Ld.y <= 0.0) { continue; }
      let own = roofed && X.y < CEIL_Y && li.volumetric > 0.0;   // the haze's statement lights this point for this light (the building's air: under the slab, never the air over the roof)
      if (own && !hazeOn) { continue; }
      if (!own && sg <= 1e-5) { continue; }
      if (occluded(X, Ld, min(60.0, (WORLD_MAX.y - X.y) / max(Ld.y, 0.05)), 0u)) { continue; }
      var st = 1.0;
      if (frame.numSmoke > 0u) { st = smokeTransmittance(X, Ld, 6.0); }
      var lit = vec3f(0.0);
      if (own) { let c = li.color * (st * phaseHG(dot(rd, Ld), 0.45) * frame.hazeDensity * li.volumetric * hazeAt(X)); Lh += c; lit = c * (dt * sqrt(stepT)); }
      else { let c = li.color * (st * wxPhase(dot(rd, Ld))); Lw += c; lit = alb * c * (1.0 - stepT); }
      if (lightTransient(li)) { wxFlash += T * luminance(lit); }
    }
    acc += T * (alb * Lw * (1.0 - stepT) + Lh * (dt * sqrt(stepT)));
    T *= stepT;
  }
  return vec4f(acc, T);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let odims = textureDimensions(outVol);
  if (gid.x >= odims.x || gid.y >= odims.y) { return; }
  var wxAirOn = false; if (WX_VOL) { if (WX_KINDS) { wxAirOn = frame.cardCfg.w != 0u; } }   // (a weather's air is marched whatever the two switches say: the men's eyes are cut by it)
  if ((frame.flags & (FLAG_VOLUMETRICS | FLAG_SMOKE)) == 0u && !wxAirOn) { textureStore(outVol, gid.xy, vec4f(0.0, 0.0, 0.0, 1.0)); textureStore(outReact, gid.xy, vec4f(0.0, 1.0, 0.0, 0.0)); return; }   // (smoke transmittance 1: nothing to blur)
  let froxel = (frame.flags & FLAG_FROXEL_VOL) != 0u;   // Phase 2b: the haze is the froxel volume's (froxel.wgsl); this pass keeps the smoke march (lit from the froxels' J) and the rain (see the file head)
  let vdiv = u32(frame.lossyCfg.y);   // 2, or 4 (lossy option): each texel marches through one full-res pixel of its vdiv×vdiv block, interleaved by texel parity as before (×1 at vdiv 2)
  let full = min(gid.xy * vdiv + vec2u(gid.y & 1u, gid.x & 1u) * (vdiv / 2u), vec2u(frame.screen) - 1u);
  let depth = textureLoad(gDepth, full, 0);
  let pix = vec2f(full) + 0.5;
  let Pfar = worldFromDepth(pix, select(depth, 1.0, depth >= 1.0));
  let ro = frame.camPos;
  var rd = Pfar - ro; var tSurf = length(rd); rd /= tSurf;
  if (depth >= 1.0) { tSurf = min(tSurf, 200.0); }
  let jitter = ign(vec2f(gid.xy));
  let jitterS = fract(jitter + f32(frame.frameIdx & 63u) * 0.61803399);   // the smoke march's start offset: the same texel dither, ROTATED by the golden ratio each frame — a fixed per-texel offset left its
                                                                             // error as a still grain the resolve could never average out and that slid over the plume with the camera; rotated, a still view
                                                                             // converges smooth and a moving one carries fine temporal noise the resolve damps (the rain and the flag-off haze march keep `jitter`)
  let invRd = safeInv(rd);
  var inscatter = vec3f(0.0);
  var T = 1.0;

  // ---- (b) smoke first (it attenuates what is behind it; haze contribution is mostly in front/around, error is small) ----
  let volK = min(frame.volCfg.x, VOL_KMAX);
  if (VOL_FROXEL_MARCH && froxel && (frame.flags & FLAG_SMOKE) != 0u && frame.numSmoke > 0u) { let sm = smokeMarchJ(ro, rd, tSurf, jitterS, pix * frame.invScreen); inscatter = sm.rgb; T = sm.a; }   // (b′) froxel-lit smoke march (above)
  if (!froxel && (frame.flags & FLAG_SMOKE) != 0u && frame.numSmoke > 0u && volK > 0u) {
    // (K > 0) the capped march: per-domain stretches front to back, a bounded per-stretch shortlist, the K strongest lights a step (see VOL_KMAX above)
    var ivA: array<vec3f, 8>; var ivM: array<u32, 8>; var niv = 0u; // (tEnter, tExit, voxel) + domain bit per live domain the ray crosses before the surface, sorted by tEnter
    for (var i = 0u; i < frame.numSmoke; i++) {
      let sd = smoke[i];
      if (sd.live == 0u) { continue; }
      let tb = isectBounds(ro, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
      if (!(tb.x <= tb.y && tb.y > 0.0 && tb.x < tSurf)) { continue; }
      let a = max(tb.x, 0.0);
      var j = niv;
      while (j > 0u && ivA[j - 1u].x > a) { ivA[j] = ivA[j - 1u]; ivM[j] = ivM[j - 1u]; j--; }
      ivA[j] = vec3f(a, min(tb.y, tSurf), sd.voxel); ivM[j] = 1u << i; niv++;
    }
    if (niv > 0u) {
      var m = 0u;                                                    // merge overlapping stretches in place (finest voxel wins, domain bits OR): sorted by entry, so exits come out ascending too
      for (var i = 1u; i < niv; i++) {
        if (ivA[i].x <= ivA[m].y) { ivA[m].y = max(ivA[m].y, ivA[i].y); ivA[m].z = min(ivA[m].z, ivA[i].z); ivM[m] |= ivM[i]; }
        else { m++; ivA[m] = ivA[i]; ivM[m] = ivM[i]; }
      }
      let nInt = m + 1u;
      var rayBudget = VOL_RAY_STEPS;                                 // march steps this ray may still spend, over all its stretches
      var ambCell = vec3f(1e9); var ambSide = vec2f(9.0); var ambHome = false;   // the ambient's wall test, cached: (dice cell of X, plan side it pulls from) → sample X's own cell centre instead?
      let sp = c0Spacing();
      for (var ii = 0u; ii < nInt && T >= 0.03; ii++) {             // front to back; a stretch behind opaque smoke is never walked
        let t0 = ivA[ii].x; let t1 = ivA[ii].y; let vox = ivA[ii].z;
        let A = ro + rd * t0; let B = ro + rd * t1;
        let onMask = ivM[ii];                                                             // the domains a point ON this stretch can lie in (exact) …
        let nearMask = smokeDomainsNear(min(A, B), max(A, B), 0.75);                     // … and those a self-shadow tap (≤ 0.7 m off it toward a light) can
        // shortlist for THIS stretch, strongest bound first. Exact culls: out of range of the whole stretch, too dim to reach the 0.03 floor anywhere on it (the
        // bound the march always used, from the light's closest approach to [t0, t1]), a spot whose cone the stretch never enters, a panel the stretch lies
        // entirely behind — none of those can pass evalLight at any step. Then the 16 largest bounds, sorted (insertion; ≤ 16 entries, once per stretch).
        var cand: array<u32, 16>; var cb: array<f32, 16>; var nc = 0u;
        for (var i = 0u; i < frame.numLights; i++) {
          let li = lights[i]; let mc = max3(li.color); let kind = lightKind(li);
          var bound = mc;
          if (kind != 2u) {
            let tc = clamp(dot(li.pos - ro, rd), t0, t1); let dv = ro + rd * tc - li.pos; let d2 = dot(dv, dv);
            if (d2 > li.range * li.range) { continue; }
            bound = mc / max(d2, li.radius * li.radius);
            if (bound < 0.03) { continue; }
            if (kind == 1u && li.cosOuter > 0.0) { let ci = coneInterval(ro, rd, li.pos, li.dir, li.cosOuter); if (max(ci.x, t0) >= min(ci.y, t1)) { continue; } }   // (coneInterval squares the cone test: exact for half-angles under 90° — every spot there is — so wider ones are simply not culled)
            else if (kind == 3u) { if (dot(A - li.pos, li.dir) <= 0.0 && dot(B - li.pos, li.dir) <= 0.0) { continue; } }
          } else if (bound < 0.03) { continue; }
          if (nc == 16u && bound <= cb[15]) { continue; }
          var p = min(nc, 15u);
          while (p > 0u && cb[p - 1u] < bound) { cb[p] = cb[p - 1u]; cand[p] = cand[p - 1u]; p--; }
          cb[p] = bound; cand[p] = i; nc = min(nc + 1u, 16u);
        }
        let span = t1 - t0;
        if (span <= 0.0 || rayBudget == 0u) { continue; }                                        // (a grazing hit: nothing to walk; or the ray's steps are spent — what is left lies behind the smoke already walked)
        let stepVox = select(1.5, f32(frame.volCfg.z) * 0.1, frame.volCfg.z > 0u);   // march step in voxels of the stretch's own domain (1.5 as ever; the cheaper tiers walk coarser: volCfg.z tenths)
        // never finer along the ray than ~3 of this pass's texels are ACROSS it at that distance (a 2.2 cm-voxel gun-smoke domain twenty metres off was walked at
        // 3.3 cm under texels 5 cm wide), and never coarser than the canister domains' own 8.25 cm: the fine domains' step grows with distance up to that
        let texelRad = 2.0 * frame.post.w * frame.lossyCfg.y / frame.screen.y;         // one volumetric texel, radians (post.w = tan(fov/2), lossyCfg.y = this pass's divisor)
        let dtStep = max(vox * stepVox, min(0.0825, t0 * texelRad * 3.0));
        let steps = min(clamp(u32(span / dtStep) + 1u, 4u, 112u), rayBudget);                  // ≤ 112 a stretch as ever, ≤ VOL_RAY_STEPS over all of a ray's stretches
        rayBudget -= steps;
        let dt = span / f32(steps);
        var t = t0 + dt * jitter;
        var visBits = 0u; var validBits = 0u; var selfC: array<f32, 16>;   // per shortlist slot: was the light visible from the last step that traced it, is that known, and its self-shadow there
        let every = max(frame.volCfg.y, 1u);                            // trace each light's shadow ray + self-shadow every `every` steps (1 = each step; 2 = alternate steps reuse the last answer — one step is 8 cm of a 5.5 cm-voxel plume)
        for (var s = 0u; s < steps; s++) {
          let X = ro + rd * t;
          if ((s % every) == 0u) { validBits = 0u; }                                             // every light's shadow answer is at most `every` steps old, lit steps or not
          let dens = fogSmoke(smokeDensityIn(X, onMask), X);
          if (dens == 0.0 && spgHole) { let hop = u32(clamp((smokeClearRun(X, rd) - 1e-3) / dt, 0.0, 4096.0)); if (hop > 0u) { if ((s % every) + hop >= every) { validBits = 0u; } rayBudget += min(hop, steps - 1u - s); s += hop; t += f32(hop + 1u) * dt; continue; } }
          if (dens > 0.002) {
            let sigT = dens * 6.0;
            let sigS = sigT * 0.92;
            // ambient: diceMeanRadianceWalled with its occlusion ray cached per (dice cell, plan quadrant) along the ray — a dozen steps share a 1 m cell and take the
            // first one's answer (approximate, not exact: a wall standing INSIDE the cell between two of those steps is decided by whichever came first)
            let home = (floor((X - RC_MIN) / sp) + vec3f(0.5)) * sp + RC_MIN;
            var side = sign(X - home); side.y = 0.0;
            if (any(home != ambCell) || any(side.xz != ambSide)) {
              ambCell = home; ambSide = side.xz;
              let nb = vec3f(home.x, X.y, home.z) + side * sp; let d = nb - X; let dist = length(d);
              ambHome = dist > 1e-3 && occluded(X, d / dist, dist, 0u);
            }
            var Lin = textureSampleLevel(diceTex, linSamp, diceCoord(select(X, home, ambHome), 6.0), 0.0).xyz;
            // lights, largest unshadowed BOUND on this stretch first: each is evaluated as ever (unshadowed, the 0.03 floor), and the first K that reach X get the
            // shadow ray + the self-shadow march (afresh at most every `every` steps, else that light's last answer); once K have — occluded or not — the rest of the
            // list is dropped for this step. (Bound order, not the order of what actually reaches X: over a long stretch a distant torch can outrank the panel
            // overhead, so at K = 2 the light dropped is not always the weakest there — the price of not sorting per step.)
            var got = 0u; var Lin2 = vec3f(0.0); let msGain = smokeMsGain();
            for (var c = 0u; c < nc && got < volK; c++) {
              let li = lights[cand[c]];
              let ev = evalLight(li, X, vec3f(0.0));
              if (!ev.ok || max3(ev.E) < 0.03) { continue; }
              got++;
              let bit = 1u << c;
              if ((validBits & bit) == 0u) {
                let vis = !occluded(X, ev.L, ev.dist.x - li.radius - 0.02, (li.owner & 0xffu) << 8u);   // the light's own carrier never shadows its beam
                visBits = select(visBits & ~bit, visBits | bit, vis); validBits |= bit;
                if (vis) { selfC[c] = smokeSelfShadowIn(X, ev.L, nearMask); }
              }
              if ((visBits & bit) == 0u) { continue; }
              Lin += ev.E * phaseHG(dot(rd, ev.L), 0.35) * selfC[c];
              Lin2 += ev.E * phaseHG(dot(rd, ev.L), SMOKE_MS_G) * sqrt(selfC[c]);   // (the multiple-scattering octave: half as forward, √ the self-shadow)
            }
            let stepT = exp(-sigT * dt);
            inscatter += T * Lin * sigS * (1.0 - stepT) / max(sigT, 1e-4);   // energy-conserving integration over the step
            inscatter += msGain * sqrt(T) * Lin2 * (sigS / max(sigT, 1e-4)) * (1.0 - sqrt(stepT));   // + the octave through half the extinction (vol_common.wgsl smokeMsGain)
            T *= stepT;
            if (T < 0.03) { break; }                                       // (0.01 as ever elsewhere; whatever lies behind 3 % transmittance is under an 8-bit step of black smoke)
          }
          t += dt;
        }
      }
    }
  }
  if (VOL_K0 && !froxel && (frame.flags & FLAG_SMOKE) != 0u && frame.numSmoke > 0u && volK == 0u) {   // K = 0: the march exactly as it was (in its own twin: VOL_K0 above)
    var t0 = 1e30; var t1 = -1e30; var vox = 1.0;
    for (var i = 0u; i < frame.numSmoke; i++) {
      let sd = smoke[i];
      if (sd.live == 0u) { continue; }
      let tb = isectBounds(ro, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
      if (tb.x <= tb.y && tb.y > 0.0 && tb.x < tSurf) { t0 = min(t0, max(tb.x, 0.0)); t1 = max(t1, min(tb.y, tSurf)); vox = min(vox, sd.voxel); }
    }
    if (t1 > t0) {
      // per-ray light shortlist: a light whose unshadowed irradiance cannot reach the in-scatter threshold (0.03) anywhere on
      // [t0, t1] — bounded from its closest approach to the segment — is dropped for every step of the march. Exact culling
      // (the bound is never below what evalLight can return), and it turns ~34 evaluations per step into a handful.
      var cand: array<u32, 16>; var nc = 0u; var everyLight = false;   // set when the shortlist overflows: fall back to walking every light
      if (!everyLight) {
        for (var i = 0u; i < frame.numLights; i++) {
          let li = lights[i]; let mc = max(li.color.x, max(li.color.y, li.color.z));
          var keep = false;
          if (lightKind(li) == 2u) { keep = mc >= 0.03; }
          else {
            let tc = clamp(dot(li.pos - ro, rd), t0, t1); let dv = ro + rd * tc - li.pos; let d2 = dot(dv, dv);
            keep = d2 <= li.range * li.range && mc / max(d2, li.radius * li.radius) >= 0.03;
          }
          if (keep) { if (nc < 16u) { cand[nc] = i; nc++; } else { everyLight = true; } }
        }
      }
      let nLoop = select(nc, frame.numLights, everyLight);
      let span = t1 - t0;
      let steps = clamp(u32(span / (vox * 1.5)) + 1u, 4u, 112u);
      let dt = span / f32(steps);
      var t = t0 + dt * jitter;
      for (var s = 0u; s < steps; s++) {
        let X = ro + rd * t;
        let dens = fogSmoke(smokeDensityAt(X), X);
        if (dens > 0.002) {
          let sigT = dens * 6.0;             // extinction (1/m) per unit density (domain densityScale already applied)
          let sigS = sigT * 0.92;
          var Lin = diceMeanRadianceWalled(X);   // ambient: mean radiance (isotropic phase → radiance directly), never interpolated through a wall (lighting_common)
          var Lin2 = vec3f(0.0); let msGain = smokeMsGain();   // the multiple-scattering octave (vol_common.wgsl smokeMsGain)
          for (var k = 0u; k < nLoop; k++) {
            let li = lights[select(cand[min(k, 15u)], k, everyLight)];
            let ev = evalLight(li, X, vec3f(0.0));
            if (!ev.ok || max(ev.E.x, max(ev.E.y, ev.E.z)) < 0.03) { continue; }   // below this a light adds nothing you can see in smoke; the test is what keeps the per-step cost bounded now that panels reach across the floor
            if (occluded(X, ev.L, ev.dist.x - li.radius - 0.02, (li.owner & 0xffu) << 8u)) { continue; }   // the light's own carrier never shadows its beam
            let ssh = smokeSelfShadow(X, ev.L);
            Lin += ev.E * phaseHG(dot(rd, ev.L), 0.35) * ssh;
            Lin2 += ev.E * phaseHG(dot(rd, ev.L), SMOKE_MS_G) * sqrt(ssh);
          }
          let stepT = exp(-sigT * dt);
          // energy-conserving integration over the step (+ the octave through half the extinction)
          inscatter += T * Lin * sigS * (1.0 - stepT) / max(sigT, 1e-4);
          inscatter += msGain * sqrt(T) * Lin2 * (sigS / max(sigT, 1e-4)) * (1.0 - sqrt(stepT));
          T *= stepT;
          if (T < 0.01) { break; }
        }
        t += dt;
      }
    }
  }

  let Tsmoke = T;   // the smoke was marched first: T here is the SMOKE's transmittance alone — what post.wgsl's diffusion keys on (the haze below must not blur far walls)
  // ---- (w) the weather's air (wxAirMarch above): its veil over the surface rides in the transmittance this pass hands on (Tsmoke stays the smoke's alone). The
  // smoke's own light is seen through about half of the air in front of the surface, and the air's through about half of the smoke — from the play camera most of a
  // ray's air lies ABOVE a plume standing on the ground, so neither is laid wholly behind the other.
  var Tair = 1.0;
  if (WX_VOL) { if (WX_KINDS) { if (frame.cardCfg.w != 0u) {
    let aw = wxAirMarch(ro, rd, tSurf, jitterS);
    inscatter = inscatter * mix(1.0, aw.a, 0.5) + aw.rgb * (0.5 + 0.5 * T);
    Tair = aw.a;
  } } }
  // ---- (a) haze beams ----
  // (K > 0: everything below is scaled by the smoke's transmittance T in front of it — behind 3 % of it, a beam or a rain streak is under an 8-bit step, so the
  // ray that ended inside a thick plume spends nothing more)
  let behindSmoke = (volK > 0u || froxel) && T < 0.03;
  if (!froxel && (frame.flags & FLAG_VOLUMETRICS) != 0u && frame.hazeDensity > 0.0 && !behindSmoke) {
    let sigS = frame.hazeDensity; // scattering coefficient of the thin uniform haze (1/m); extinction ignored
    // (K > 0) at most K local beams a ray: rank every eligible spot / point light by its UNSHADOWED in-scatter along this ray (∫ E dt of a 1/d² source over
    // the stretch inside its sphere ∧ cone = peak × (θB − θA) / D — the equi-angular integral the loop below estimates), keep the K largest in a 64-bit
    // mask, and let the loop skip the rest. Directional lights (the daytime sun) are always kept. K = 0: the mask is all ones and the loop is what it was.
    var selLo = 0xffffffffu; var selHi = 0xffffffffu;
    var bI: array<u32, VOL_KMAX>; var bS: array<f32, VOL_KMAX>; var bN: array<u32, VOL_KMAX>; var nb = 0u;   // the ray's K beams: light slot, unshadowed score, step budget
    if (volK > 0u) {
      selLo = 0u; selHi = 0u;
      for (var i = 0u; i < frame.numLights; i++) {
        let li = lights[i];
        if (li.volumetric <= 0.0) { continue; }
        if (lightKind(li) == 2u) { if (i < 32u) { selLo |= 1u << i; } else { selHi |= 1u << (i - 32u); } continue; }
        let tb = isectBounds(ro, invRd, li.pos - vec3f(li.range), li.pos + vec3f(li.range));
        let ta = max(tb.x, 0.0); let tbb = min(tb.y, tSurf);
        if (ta >= tbb) { continue; }
        let oc = ro - li.pos; let bq = dot(oc, rd); let cq = dot(oc, oc) - li.range * li.range;
        let disc = bq * bq - cq; if (disc <= 0.0) { continue; }
        let sq = sqrt(disc);
        var s0 = max(-bq - sq, ta); var s1 = min(-bq + sq, tbb);
        if (lightKind(li) == 1u) { let ci = coneInterval(ro, rd, li.pos, li.dir, li.cosOuter); s0 = max(s0, ci.x); s1 = min(s1, ci.y); }
        if (s0 >= s1) { continue; }
        if ((li.kind & (LIGHT_FOG_SEEN | LIGHT_FOG_UNSEEN)) != 0u) {   // (the three points asked in turn through ONE lightFogK call: DXC inlines each call it meets)
          var fk: array<f32, 3>;
          for (var q = 0u; q < 3u; q++) { fk[q] = lightFogK(li, ro + rd * select(select(s1, 0.5 * (s0 + s1), q == 1u), s0, q == 0u), vec3f(0.0)); }
          if (max(fk[0], max(fk[1], fk[2])) <= 0.002) { continue; }
        }   // (a beam the fog of war's class cuts along this ray takes none of the K places)
        let delta = dot(li.pos - ro, rd);
        let Dl = max(length(ro + rd * delta - li.pos), max(li.radius, 1e-3));
        let score = max3(li.color) * li.volumetric * (atan((s1 - delta) / Dl) - atan((s0 - delta) / Dl)) / Dl;
        if (nb < volK) { bI[nb] = i; bS[nb] = score; nb++; continue; }
        var w = 0u; for (var q = 1u; q < volK; q++) { if (bS[q] < bS[w]) { w = q; } }
        if (score > bS[w]) { bI[w] = i; bS[w] = score; }
      }
      // the ray's beam STEP budget, dealt by score: one beam alone keeps volSteps as ever; several share 1.5 × volSteps in proportion to their unshadowed
      // in-scatter (never under 4 each) — the dominant beam stays as smooth as it was, the faint ones crossing it get a coarser (jittered) estimate of little light
      var sumS = 0.0; for (var q = 0u; q < nb; q++) { sumS += bS[q]; }
      for (var q = 0u; q < nb; q++) {
        let i = bI[q]; if (i < 32u) { selLo |= 1u << i; } else { selHi |= 1u << (i - 32u); }
        bN[q] = clamp(u32(1.5 * f32(frame.volSteps) * bS[q] / max(sumS, 1e-9) + 0.5), 4u, frame.volSteps);
      }
    }
    for (var i = 0u; i < frame.numLights; i++) {
      if (((select(selHi, selLo, i < 32u) >> (i & 31u)) & 1u) == 0u) { continue; }   // not among this ray's K (all ones when K = 0)
      let li = lights[i];
      if (li.volumetric <= 0.0) { continue; }
      // ONE MARCH for the sun and for a lamp (the compile: DXC — Chrome's compiler on Windows — inlines each call it meets; the two marches were two copies of the shadow
      // ray, the smoke on it and the haze): set up per kind, then the same steps, statement for statement as each was.
      let dirL = lightKind(li) == 2u;
      var nSteps = 0u; var Ld = vec3f(0.0); var tA = 0.0; var dtD = 0.0;                       // the sun's
      var delta = 0.0; var Dl = 0.0; var thA = 0.0; var thB = 0.0; var smokeNear = false;    // a lamp's
      if (dirL) {
        if (WX_VOL) { if (WX_KINDS) { if (frame.cardCfg.w != 0u) { continue; } } }   // (a weather is in: the sun in the air — the building's haze with it — is wxAirMarch's)
        // A directional light (the daytime variant's sun — the moon carries volumetric 0): no source to sample toward and no falloff, so a plain jittered
        // march of the view ray with one shadow ray toward the light per step — the same ∫ E·phase·haze dt the equi-angular loop below estimates for a
        // lamp; the forward-scattering phase makes window shafts glow looking up-sun and go quiet down-sun. The haze is the building's dust, not weather:
        // only the stretch of the ray BELOW the ceiling plane is marched (the camera hangs in the open air above the roof — lit haze up there would fog
        // the whole picture), and a step only scatters where something stands over it (a short ray straight up meets the ceiling): the sunlit lot stays
        // clear air, the rooms the sun gets into show it. Both rays are short-circuiting any-hit queries; indoors the up ray ends inside a metre or three.
        Ld = -li.dir;
        if (ro.y > CEIL_Y) { if (rd.y >= -1e-4) { continue; } tA = (CEIL_Y - ro.y) / rd.y; }
        let tB = min(tSurf, tA + 30.0);
        if (tB <= tA) { continue; }
        nSteps = max(frame.volSteps, 6u);
        dtD = (tB - tA) / f32(nSteps);
      } else {
        let tb = isectBounds(ro, invRd, li.pos - vec3f(li.range), li.pos + vec3f(li.range));
        let ta = max(tb.x, 0.0); let tbb = min(tb.y, tSurf);
        if (ta >= tbb) { continue; }
        // tighter bound: sphere
        let oc = ro - li.pos; let bq = dot(oc, rd); let cq = dot(oc, oc) - li.range * li.range;
        let disc = bq * bq - cq; if (disc <= 0.0) { continue; }
        let sq = sqrt(disc);
        var s0 = max(-bq - sq, ta); var s1 = min(-bq + sq, tbb);
        if (lightKind(li) == 1u) { let ci = coneInterval(ro, rd, li.pos, li.dir, li.cosOuter); s0 = max(s0, ci.x); s1 = min(s1, ci.y); }
        if (s0 >= s1) { continue; }
        // smoke on this beam's shadow paths at all? K = 0: whenever any domain is live (as ever). K > 0: only if some live domain's box comes within reach of the
        // box spanned by the light and this stretch of the beam — every shadow segment from a step X toward the light lies inside it (exact, conservative)
        smokeNear = frame.numSmoke > 0u;
        if (smokeNear && volK > 0u) { let PA = ro + rd * s0; let PB = ro + rd * s1; smokeNear = smokeDomainsNear(min(li.pos, min(PA, PB)), max(li.pos, max(PA, PB)), 0.0) != 0u; }
        // equi-angular sampling: distributes samples ∝ 1/d² to the light, so the bright region near the source is not undersampled
        delta = dot(li.pos - ro, rd);
        Dl = max(length(ro + rd * delta - li.pos), max(li.radius, 1e-3));   // match evalLight's 1/max(d², r²) core so samples near the lamp head are not wasted
        thA = atan((s0 - delta) / Dl); thB = atan((s1 - delta) / Dl);
        var maxSteps = frame.volSteps;                                          // K > 0: this beam's share of the ray's step budget (bN); K = 0: volSteps as ever
        if (volK > 0u) { for (var q = 0u; q < nb; q++) { if (bI[q] == i) { maxSteps = bN[q]; } } }
        nSteps = clamp(u32((thB - thA) / 0.11) + 3u, 4u, maxSteps);
      }
      var acc = vec3f(0.0);
      for (var s = 0u; s < nSteps; s++) {
        var X: vec3f; var ev: LightEval; var t = 0.0;
        if (dirL) { X = ro + rd * (tA + (f32(s) + jitter) * dtD); ev.L = Ld; }
        else {
          let u = (f32(s) + jitter) / f32(nSteps);
          let th = mix(thA, thB, u);
          t = delta + Dl * tan(th);
          X = ro + rd * t;
          ev = evalLight(li, X, vec3f(0.0));
          if (!ev.ok) { continue; }
          if (max(ev.E.x, max(ev.E.y, ev.E.z)) < 0.002) { continue; }
        }
        // the shadow rays: the sun's turn 0 = open sky over this point (outdoor air, no dust) and turn 1 = its own ray; a lamp's turn 1 alone, its carrier never
        // shadowing its beam
        var dark = false;
        for (var q = select(1u, 0u, dirL); q < 2u; q++) {
          let occ = occluded(X, select(ev.L, vec3f(0.0, 1.0, 0.0), q == 0u), select(select(ev.dist.x - li.radius - 0.02, 80.0, dirL), CEIL_Y + 0.5 - min(X.y, CEIL_Y), q == 0u), select((li.owner & 0xffu) << 8u, 0u, dirL));
          if (occ == (q == 1u)) { dark = true; break; }
        }
        if (dark) { continue; }
        var st = 1.0;
        // (the sun: the smoke over 6 m toward it whenever a domain is live; a lamp: K = 0 whenever a domain is live, K > 0 only when some live domain is anywhere near the light
        // ∪ this beam stretch, and then only through the domains the shadow segment crosses — both exact)
        if (select(smokeNear, frame.numSmoke > 0u, dirL)) {
          let dS = select(min(ev.dist.x, 6.0), 6.0, dirL);
          if (!dirL && volK > 0u) { st = smokeTransIn(X, ev.L, dS); } else { st = smokeTransmittance(X, ev.L, dS); }
        }
        let hz = hazeAt(X);
        if (dirL) { acc += li.color * (st * hz); }
        else {
          let invPdf = (thB - thA) * (Dl * Dl + (t - delta) * (t - delta)) / Dl;
          acc += ev.E * st * phaseHG(dot(rd, ev.L), 0.45) * invPdf * hz;
        }
      }
      if (dirL) { inscatter += acc * (dtD * phaseHG(dot(rd, Ld), 0.45) * sigS * li.volumetric) * T; continue; }
      acc /= f32(nSteps);
      var beam = acc * sigS * li.volumetric * T;
      if (wxAirOn) { beam *= Tair; }   // (… and through the weather's air above them: beams stand low in the layer, the camera above it — and the froxel tiers' beams take the same factor in composite; no weather = the statement as it was, not a ×1)
      inscatter += beam;
    }
  }

  // ---- (c) weather: rain streaks / splash rings / the sky flash — outdoor air only (rainAlong / splashAt above; game/weather.ts feeds frame.weatherA‥D) ----
  var reactL = 0.0;   // what (c) adds toward the eye, for the TAAU resolve (outReact) — nothing drawn here has a history worth keeping: streaks fall metres a frame. (Beams are deliberately NOT
  if (wxAirOn) { reactL += wxFlash * (0.5 + 0.5 * T); }   // (the air a stroke lit, as the march above composed it: lit and gone with the stroke, not a history's worth)
                      // in it: a torch beam is a smooth gradient the history serves well, and marking it reactive handed the resolve the raw internal-resolution march instead — measured, reverted.)
  if ((frame.flags & FLAG_VOLUMETRICS) != 0u && !behindSmoke && (frame.weatherA.x > 0.0 || max(frame.weatherB.x, max(frame.weatherB.y, frame.weatherB.z)) > 0.0)) {
    let Pend = ro + rd * tSurf;
    if (depth >= 1.0 || outdoorsXZ(Pend.xz) || (RAIN_WALLS && !wxUnderRoof(Pend.xz))) {   // (RAIN_WALLS: a wall's outer face and its top are not under the roof — common.wgsl wxUnderRoof)
      // the ray's stretch through the rain slab 0 ≤ y ≤ top …
      let top = frame.weatherB.w;
      var ta = 0.0; var tb = tSurf;
      if (abs(rd.y) > 1e-5) { let tyA = (top - ro.y) / rd.y; let tyB = -ro.y / rd.y; ta = max(ta, min(tyA, tyB)); tb = min(tb, max(tyA, tyB)); }
      else if (ro.y > top || ro.y < 0.0) { tb = -1.0; }
      let wb = isectBounds(ro, invRd, vec3f(WORLD_MIN.x, -100.0, WORLD_MIN.z), vec3f(WORLD_MAX.x, 100.0, WORLD_MAX.z));   // (and inside the world's own column: past the lot's rim there is no ground to rain on)
      ta = max(ta, wb.x); tb = min(tb, wb.y);
      if (tb > ta) {
        // … minus the interior's column (an xz box, all heights): what is left is at most a piece before it and a piece beyond it
        let I = frame.weatherC;
        let ib = isectBounds(ro, invRd, vec3f(I.x, -100.0, I.y), vec3f(I.z, 100.0, I.w));
        var wx = vec3f(0.0); var outLen = 0.0;
        // the open-air pieces of the stretch, front to back, then ONE rainAlong a piece (the compile: DXC — Chrome's compiler on Windows — inlines every call, and the
        // four calls this took were four copies of the streak walk and its light loop; the pieces and their order are what the calls had)
        var seg: array<vec2f, 5>; var nSeg = 0u;
        if (WX_KINDS && frame.cardCfg.y != 0u) {
          // WEATHER KINDS (a kind picked: the footprints are the level's own roofs, up to four — the compound, the barracks): the stretch minus EVERY roof's
          // column, walked front to back — what is left is at most five pieces of open air (the yard between the house and its sheds rains; the rooms stay dry)
          var col: array<vec2f, 4>;   // each roof's column along the ray (x ≥ y = none: an empty footprint, or the ray misses it)
          for (var k = 0u; k < 4u; k++) {
            var R = frame.weatherC; if (k == 1u) { R = frame.weatherD; } else if (k == 2u) { R = wxRect(frame.cardCfg.y); } else if (k == 3u) { R = wxRect(frame.cardCfg.z); }
            col[k] = vec2f(1.0, 0.0);
            if (R.z > R.x) { col[k] = isectBounds(ro, invRd, vec3f(R.x, -100.0, R.y), vec3f(R.z, 100.0, R.w)); }
          }
          var cur = ta;
          for (var it = 0u; it < 5u && cur < tb; it++) {
            var e0 = tb; var e1 = tb;   // the nearest column still ahead of (or around) cur
            for (var k = 0u; k < 4u; k++) { let cb = col[k]; if (cb.x < cb.y && cb.y > cur && cb.x < e0) { e0 = max(cb.x, cur); e1 = cb.y; } }
            if (e0 > cur) { seg[nSeg] = vec2f(cur, e0); nSeg++; }
            cur = max(e1, e0);
          }
        } else
        if (ib.x < ib.y && ib.y > ta && ib.x < tb) {
          let a1 = min(tb, ib.x); let b0 = max(ta, ib.y);
          if (a1 > ta) { seg[nSeg] = vec2f(ta, a1); nSeg++; }
          if (tb > b0) { seg[nSeg] = vec2f(b0, tb); nSeg++; }
        } else { seg[0] = vec2f(ta, tb); nSeg = 1u; }
        for (var q = 0u; q < nSeg; q++) { wx += rainAlong(ro, rd, seg[q].x, seg[q].y); outLen += seg[q].y - seg[q].x; }
        // the lit sky of a stroke: the thin haze along the outdoor stretch glows with it (isotropic; no march — the sky is everywhere at once)
        wx += frame.weatherB.xyz * (frame.hazeDensity * 4.0 * outLen);
        // the crown where a drop lands on the lot, lit like a streak there
        if (depth < 1.0 && outdoorsXZ(Pend.xz)) { let sp = splashAt(Pend); if (sp > 0.0) { var keepS = 1.0; if (frame.weatherE.w > 0.0) { keepS = rainNearKeep(Pend.xz); } wx += rainLight(Pend + vec3f(0.0, 0.03, 0.0), -rd) * (SPLASH_GAIN * sp) * keepS; } }   // (particle rain: its drops splash where they land — the lattice's rings there kept by the same share; exactly 1 without it)
        var wxT = wx * T;
        if (wxAirOn) { wxT *= sqrt(Tair); }   // (no weather = the two statements as they were: a software sqrt(1) is not always 1)
        inscatter += wxT;
        reactL += luminance(wxT);
      }
    }
  }
  var Tout = T; if (wxAirOn) { Tout = T * Tair; }
  textureStore(outVol, gid.xy, vec4f(inscatter, Tout));
  textureStore(outReact, gid.xy, vec4f(reactL, Tsmoke, 0.0, 0.0));
}
