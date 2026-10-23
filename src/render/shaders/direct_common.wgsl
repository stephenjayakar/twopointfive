// Shared by the two direct-light estimators (direct.wgsl = the leader/tail path, restir.wgsl = ReSTIR DI): the tile-culling reach test, the glass
// helpers, the per-lane rng and the one emitter shadow-ray sampler. Moved out of direct.wgsl verbatim (renderer v3 Phase 2a) — passes.ts prepends it to both.
const GLASS_DIR_REACH: f32 = 8.0;             // how far toward a directional light (the moon, the sun) a pane may stand and still tint it: indoors the ray has left through the glazing or met the ceiling well inside this
fn glassPairMask(li: Light, mn: vec3f, mx: vec3f) -> u32 {
  var lm = lightGlassMask(li);   // the panes this light can reach at all (CPU, per frame, riding in the light's own record): usually none, so no pane is even looked at
  if (lm == 0u) { return 0u; }
  if (lightKind(li) == 2u) { return lm; }                       // directional (the moon, the sun): its CPU mask as it is — narrowing it per tile cost a 20-step walk on one lane of every tile, and the tint is only ever asked for where its ray came back LIT (shadowPhase), which indoors is nearly nowhere
  let a = min(mn, li.pos); let b = max(mx, li.pos);            // point / spot / area: the box holding the tile and the light holds every segment between them
  var m = 0u;
  while (lm != 0u) {   // this light's own few bits (a uniform walk over every pane measured slower: the phase is bound by its steps, not its loads)
    let k = countTrailingZeros(lm); lm = lm & (lm - 1u);
    let p0 = scene.glass[k * 3u]; let p1 = scene.glass[k * 3u + 1u];
    let e = vec3f(abs(p0.w) * p1.x + abs(p1.w) * p1.z, p1.y, abs(p1.w) * p1.x + abs(p0.w) * p1.z);   // world half extents of the yawed pane (boxes.ts footprint rule)
    if (all(p0.xyz - e <= b) && all(p0.xyz + e >= a)) { m |= 1u << k; }
  }
  return m;
}
// Conservative by construction: false only when evalLight(li, P, ·) (common.wgsl) takes one of its exact early-outs — E == 0,
// ok == false — for EVERY point P of the box [mn, mx]: beyond li.range (`dist > li.range`, kinds 0/1/3), outside the spot cone
// (`cd < li.cosOuter`, kind 1), behind the one-sided emitter's plane (`ce <= 0`, kind 3). It never judges by surface normal (that
// varies per pixel) and never drops the moon (kind 2, no position). The margins (1-2 cm, 0.01 rad) sit orders of magnitude above the
// f32 rounding of both this arithmetic and evalLight's own (positions here are < 64 m: ulp ≈ 4e-6 m) and are physically nil, so
// "culled here" is a strict subset of "evalLight returns !ok at every live pixel of the tile" — and such a light the scoring loop
// already skipped without touching U/W/top/lw or drawing from the rng. li.dir need not be unit length: every test divides it out
// exactly the way evalLight's dot products scale with it.
fn lightReachesBox(li: Light, mn: vec3f, mx: vec3f) -> bool {
  let kind = lightKind(li);
  if (kind == 2u) { return true; }
  let q = max(max(mn - li.pos, li.pos - mx), vec3f(0.0));            // per-axis gap between the light and the box (0 inside the slab)
  let rr = li.range + 0.01;
  if (dot(q, q) > rr * rr) { return false; }                          // nearest point of the box is out of range (+1 cm) → `dist > li.range` for every P in it
  let dl = length(li.dir);
  if (kind == 1u && dl > 0.0) {
    // cone vs the box's bounding sphere (centre c, radius r): seen from the light the sphere subtends A = asin(r/d) around the direction
    // to its centre, so every point in it is at least angle(centre) − A off the axis; cull when even that exceeds the outer half-angle O
    // (+δ = 0.01 rad). Evaluated in cos/sin space with the angle-sum identities (no acos/asin and their loose GPU error bounds); only for
    // cones under ~84° (cosO > 0.1) so O + A + δ < π, where cos is monotonic and "cos smaller" really means "angle larger".
    let c = (mn + mx) * 0.5; let v = c - li.pos; let d = length(v); let r = length(mx - c) + 0.01;
    let cosO = min(li.cosOuter / dl, 1.0);                            // evalLight compares |dir|·cosθ against cosOuter: effective cone cos = cosOuter/|dir|
    if (d > r && cosO > 0.1) {
      let sinA = r / d; let cosA = sqrt(max(1.0 - sinA * sinA, 0.0));
      let sinO = sqrt(max(1.0 - cosO * cosO, 0.0));
      let cosOA = cosO * cosA - sinO * sinA; let sinOA = sinO * cosA + cosO * sinA;   // cos / sin of (O + A)
      let cosLim = cosOA * 0.99995 - sinOA * 0.0099998;              // cos(O + A + 0.01)
      if (dot(v, li.dir) / (d * dl) < cosLim) { return false; }
    }
  }
  if (kind == 3u) {
    // one-sided panel (normal = dir): all 8 corners at least 2 cm behind the emitter plane → dot(P − pos, dir) < 0, i.e. evalLight's
    // `ce <= 0.0`, for every P in the box (the max over the corners of dot(corner − pos, dir), taken per axis)
    if (dot(max((mn - li.pos) * li.dir, (mx - li.pos) * li.dir), vec3f(1.0)) < -0.02 * dl) { return false; }
  }
  return true;
}
// The tint a pane between P and light `li` puts on that light, given the panes `gm` in reach of this tile for it (wgGlass, nonzero — the caller has looked):
// the product of the tints of the panes the segment P → light actually crosses. Applied in the shadow phase to a LEADER whose rays found it lit, as a factor
// on its visibility (S only; U keeps the untinted light, so the ratio filter treats a pane's edge like a penumbra's). The importance-picked tail light and a
// negligible leader go untinted (dim shares of a sum: not worth the call).
fn glassVis(li: Light, gm: u32, P: vec3f) -> vec3f {
  var L: vec3f; var tmax: f32;
  if (lightKind(li) == 2u) { L = -normalize(li.dir); tmax = GLASS_DIR_REACH; }
  else { let d = li.pos - P; tmax = length(d); L = d / max(tmax, 1e-4); tmax -= 0.02; }
  return glassTransmit(P, L, 0.02, tmax, gm);
}
// The soft character query's two signals to the estimators / the denoiser (SDF rig, use iii): shadowSample's .y = SOFT_CLEAR_Y when the segment was clear of boxes but a man's
// analytic term darkened it, and the S-texture hint value the estimators then write for a pixel with no box hint of its own — a magnitude below any real hint (those are
// ≥ 0.75 px ÷ MAX_BLUR_PX = 0.023), so every consumer that reads it as a blur radius reads ~⅓ px (nothing), and denoise.wgsl shTemporal takes such a pixel's ratio from
// this frame alone: the term is deterministic, there is no noise for a history to average and no reason to trail a walking man's penumbra by the history's length.
const SOFT_CLEAR_Y: f32 = -2.0;
const SOFT_HINT_FLAG: f32 = 0.01;
var<private> rngState: u32;
fn rngInit(p: vec2u, f: u32) { rngState = (p.x * 1973u + p.y * 9277u + f * 26699u) | 1u; rngState = rngState ^ (rngState >> 15u); rngState *= 0x2c1b3c6du; rngState ^= rngState >> 12u; }
fn rnd() -> f32 { rngState = rngState * 747796405u + 2891336453u; var w = ((rngState >> ((rngState >> 28u) + 4u)) ^ rngState) * 277803737u; w = (w >> 22u) ^ w; return f32(w) * (1.0 / 4294967296.0); }
// One shadow ray toward a point on light `li` as seen from Po — sample k of n, stratified over the emitter disk (n radial
// strata, golden-angle rotation between them, per-pixel random offset). Returns (visibility incl. smoke, penumbra width
// at the receiver in metres, or -1 when the segment was clear).
fn shadowSample(li: Light, Po: vec3f, N: vec3f, owner: u32, k: u32, n: u32, u0: vec2f) -> vec2f {
  let kind = lightKind(li);
  var dir: vec3f; var tmax: f32; var lightDist: f32;
  let ur = fract(u0.x + f32(k) * 0.618034);                          // golden-ratio sequence in radius²: every PREFIX of the samples is well spread over the disk (the caller may stop early)
  let ua = fract(u0.y + f32(k) * 0.7548777);                          // and a second irrational step for the angle (R2-style), decorrelated from the radius
  let r = sqrt(ur) * li.radius; let a = ua * 6.2831853;
  if (kind == 2u) {
    let L = -li.dir;
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9);
    let T = normalize(cross(up, L)); let B = cross(L, T);
    dir = normalize(L + (T * cos(a) + B * sin(a)) * r); tmax = 80.0; lightDist = 1e6;
  } else {
    let toC = li.pos - Po; let dc = length(toC); let Lc = toC / dc;
    let axis = select(Lc, li.dir, kind != 0u);                       // spots + area lights: the emitting disk lies in the fixture's own plane (perpendicular to its axis — stays under its housing); bare point lights: a disk facing the receiver
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(axis.y) > 0.9);
    let T = normalize(cross(up, axis)); let B = cross(axis, T);
    let d = (li.pos + T * (cos(a) * r) + B * (sin(a) * r)) - Po;
    lightDist = length(d); dir = d / lightDist; tmax = lightDist - 0.03;
  }
  if (dot(dir, N) <= 0.0) { return vec2f(0.0, -1.0); }
  let skip = owner | ((li.owner & 0xffu) << 8u);   // ignore the receiver's own proxies AND whatever the light is mounted on (a weapon light is never blocked by its own gun / hands)
  if (charSoftFor(li)) {
    // SDF rig, use (iii): the CHARACTERS' part of this light's visibility is the soft-shadow query toward the emitter's centre with its angular radius as the cone (analytic,
    // deterministic per pixel per light — sdfrig.wgsl charSoftVis), the boxes' part this sample's ray as ever (occludedTBoxes: the box walk alone). A box blocker still hands its
    // PCSS width on; a man's penumbra needs no blur hint (it is drawn, not sampled), so a ray only he darkens reports the segment clear of boxes.
    var tHill = -1.0; if (GROUND_RAYS) { tHill = ghHit(Po, dir, tmax); }   // (ground that rays can see, a trial — common.wgsl ghHit: a snow hill is a blocker the box walk's cap carries)
    let tBox = occludedTBoxes(Po, dir, tmax, skip, tHill);
    if (tBox >= 0.0) {
      let dOcc = max(tBox, 0.02);
      let pw = select(li.radius * dOcc / max(lightDist - dOcc, 0.05), li.radius * dOcc, kind == 2u);
      return vec2f(0.0, pw);
    }
    var Lc: vec3f; var dc: f32; var tanHalf: f32;
    if (kind == 2u) { Lc = -li.dir; dc = 80.0; tanHalf = li.radius; }
    else { let toC = li.pos - Po; dc = length(toC); Lc = toC / max(dc, 1e-4); tanHalf = li.radius / max(dc, 0.05); dc -= 0.03; }
    var vis = charSoftVis(Po, Lc, dc, tanHalf, skip);
    let charShadowed = vis < 1.0;
    if (vis > 0.0 && frame.numSmoke > 0u) { vis *= smokeTransmittance(Po, dir, min(tmax, 30.0)); }
    return vec2f(vis, select(-1.0, SOFT_CLEAR_Y, charShadowed));   // −2 (< 0: 'clear of boxes' to every existing test) tells the estimators the darkening came from the drawn character term
  }
  // CHARACTER SELF-SHADOW (frame.rigCfg bit 64, settings.charSelfShadow — common.wgsl selfShadowT): a man's own body between his pixel and the light, the part of the visibility the
  // owner skip below throws away. Asked first (fifteen records or one tree: cheap, and the nearest blocker there can be, so the penumbra hint stays right); never for the man
  // HOLDING this light (owner == the light's owner: a torch sits inside the fist round it — that skip stays whole).
  var tOcc = -1.0;
  if (owner != 0u && (u32(frame.rigCfg.x) & 64u) != 0u && owner != (li.owner & 0xffu)) { tOcc = selfShadowT(Po, N, dir, tmax, owner); }
  if (tOcc < 0.0) { tOcc = occludedT(Po, dir, tmax, skip); }
  if (tOcc >= 0.0) {
    // penumbra width at the receiver ~ emitter size x (receiver-occluder) / (occluder-light)  [PCSS]
    let dOcc = max(tOcc, 0.02);
    let pw = select(li.radius * dOcc / max(lightDist - dOcc, 0.05), li.radius * dOcc, kind == 2u);   // dir light: radius is angular
    return vec2f(0.0, pw);
  }
  var vis = 1.0;
  if (frame.numSmoke > 0u) { vis = smokeTransmittance(Po, dir, min(tmax, 30.0)); }
  return vec2f(vis, -1.0);
}
