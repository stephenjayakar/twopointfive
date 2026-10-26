// Shared by the final gather (fgather.wgsl) and the ray-traced reflection pass (reflect.wgsl): the per-tile light / bounce-card staging, the RNG, and
// the direct light AT A HIT POINT (the exact on-screen textures when the point is visible this frame, else the one-shadow-ray estimate). Textually
// included ahead of either shader by passes.ts; both declare the bindings it reads under the same names (gDepth, gNormal, directTex, softTex) and
// fill wgLights / nL (and wgCards / wgCardOf / nC — the reflection pass leaves nC at 0: no card is ever excluded from a mirror image) in their entry point.
// every hit walks the light list (transient subtraction / off-screen estimate): stage it per 8x8 tile
var<workgroup> wgLights: array<Light, 64>;
var<private> nL: u32;
// torch bounce cards (FLAG_BOUNCE_CARDS), staged per tile likewise: the four rows of each live card, and per light slot the card built from it (−1 = none) so
// directAtPoint can drop an excluded light by slot without a search. nC = 0 whenever the flag is off: every loop over cards is then empty and every
// exclusion set 0 — the pass computes and stores exactly what it did before.
var<workgroup> wgCards: array<vec4f, 32>;
var<workgroup> wgCardOf: array<i32, 64>;
var<private> nC: u32;

// ---- phase 5: world points and unit vectors packed into texel words (the gather's reservoirs — fgather.wgsl mainGi — and the reflection pass's hit records) ----
// A point inside the traced world (WORLD_MIN‥MAX: 40 × 8.25 × 28 m) as 16 bits an axis (0.6 / 0.13 / 0.43 mm), a direction as an 8+8-bit octahedral (±1°).
fn p5PackXZ(p: vec3f) -> u32 { let q = clamp((p.xz - WORLD_MIN.xz) / (WORLD_MAX.xz - WORLD_MIN.xz), vec2f(0.0), vec2f(1.0)); return u32(q.x * 65535.0 + 0.5) | (u32(q.y * 65535.0 + 0.5) << 16u); }
fn p5PackYN(p: vec3f, n: vec3f) -> u32 { let qy = clamp((p.y - WORLD_MIN.y) / (WORLD_MAX.y - WORLD_MIN.y), 0.0, 1.0); let o = vec2u(clamp(octEncode(n) * 255.0 + 0.5, vec2f(0.0), vec2f(255.0))); return u32(qy * 65535.0 + 0.5) | (o.x << 16u) | (o.y << 24u); }
fn p5UnpackPos(xz: u32, yn: u32) -> vec3f {
  let q = vec3f(f32(xz & 0xffffu), f32(yn & 0xffffu), f32(xz >> 16u)) / 65535.0;
  return WORLD_MIN + q * (WORLD_MAX - WORLD_MIN);
}
fn p5UnpackN(yn: u32) -> vec3f { return octDecode(vec2f(f32((yn >> 16u) & 255u), f32(yn >> 24u)) / 255.0); }
fn p5PackOct16(n: vec3f) -> u32 { let o = vec2u(clamp(octEncode(n) * 255.0 + 0.5, vec2f(0.0), vec2f(255.0))); return o.x | (o.y << 8u); }
fn p5UnpackOct16(v: u32) -> vec3f { return octDecode(vec2f(f32(v & 255u), f32((v >> 8u) & 255u)) / 255.0); }

var<private> rngState: u32;
fn rngInit(p: vec2u, f: u32) { rngState = (p.x * 1973u + p.y * 9277u + f * 26699u) | 1u; rngState = rngState ^ (rngState >> 15u); rngState *= 0x2c1b3c6du; rngState ^= rngState >> 12u; }
fn rnd() -> f32 { rngState = rngState * 747796405u + 2891336453u; var w = ((rngState >> ((rngState >> 28u) + 4u)) ^ rngState) * 277803737u; w = (w >> 22u) ^ w; return f32(w) * (1.0 / 4294967296.0); }

// On-screen shadowed direct light if the point is visible this frame (exact, already denoised), else a one-ray estimate.
// `ex` (torch bounce cards): bit k set = this point lies inside card k's claim region, whose light's direct term the card carries instead — taken back
// out of the on-screen textures (what that light delivered here: shadowed, through smoke), left out of the off-screen sum. Always 0 with the flag off.
// (Phase 5 once had it set a private 'took the on-screen path' flag for the reflection pass's reuse: two dead-simple stores, yet with them live in the reflect
// kernel the Metal compiler scheduled the light loop differently and ONE light pick in a thousand flipped — a different output cell at ultra in one view. The
// reuse asks directAt's .w instead.)
fn directAtPoint(P: vec3f, N: vec3f, ex: u32) -> vec3f { return directAt(P, N, ex, true).xyz; }
// directAtPoint's ON-SCREEN half alone (phase 5 — the resampling gather's cheap revalidation of a stored sample point): the exact denoised direct light at P
// if it is visible this frame (.w = 1), else nothing (.w = 0) — never the light loop.
fn directOnScreen(P: vec3f, N: vec3f, ex: u32) -> vec4f { return directAt(P, N, ex, false); }
// Both of the above, as ONE body (the compile, 2026-10-26: DXC — Chrome's shader compiler on Windows — inlines every call, and this body asked evalLight three
// times and the shadow ray three times, so every caller paid for six inlined copies of the light and the tracer; a kernel that shades four hits paid for
// twenty-four). The light walks are now the turns of ONE loop with ONE evalLight and ONE occluded: on screen, the transient slots and then the cards' lights,
// whose share is taken back out of the textures; off screen, every steady light scored and then one more turn for the picked light's shadow ray. The
// statements and their order are directAtPoint's as they were (the same rnd() draws), so the light is what it was. offOk = the off-screen estimate may run:
// .w = 1 = the on-screen answer, 2 = the off-screen estimate, 0 = off screen and not asked.
fn directAt(P: vec3f, N: vec3f, ex: u32, offOk: bool) -> vec4f {
  var onScreen = false;
  var Ed = vec3f(0.0);
  let clip = frame.viewProj * vec4f(P, 1.0);
  if (clip.w > 0.0) {
    let ndc = clip.xyz / clip.w;
    let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;
    if (all(uv > vec2f(0.0)) && all(uv < vec2f(1.0))) {
      let px = vec2u(uv * frame.screen);
      let d = textureLoad(gDepth, px, 0);
      if (d < 1.0) {
        let Ps = worldFromDepth(vec2f(px) + 0.5, d);
        let Ns = textureLoad(gNormal, px, 0).xyz * 2.0 - 1.0;
        if (distance(Ps, P) < 0.12 && dot(Ns, N) > 0.7) {
          onScreen = true;
          Ed = textureLoad(directTex, px, 0).xyz + textureLoad(softTex, px, 0).xyz;
        }
      }
    }
  }
  if (!onScreen && !offOk) { return vec4f(0.0); }
  // ON SCREEN: the on-screen direct term includes transient lights (muzzle flashes); this estimate feeds accumulated history, so take their (unshadowed) share
  // back out — a flash must never outlive itself as bounce (skipped outright when no transient light is alive — the common case; else from the first transient's
  // slot: they sit at the tail of the list, and every slot visited is still tested — the same subset in the same order, review R2.2). Only what the flash actually
  // delivered here is in the texture: a hit in the flash's shadow keeps its steady light. Then the torch bounce cards: inside card k's footprint its light's direct
  // term leaves the same way — what the direct pass delivered here (its shadow ray's skip rule, the smoke on the segment), so a hit in a man's shadow inside the
  // spot keeps everything it has (ex == 0u unless the flag is on).
  // OFF SCREEN: score every steady light unshadowed, spend ONE shadow ray on an importance-picked light and apply its visibility to the whole sum (exact when one
  // light dominates, which is the common case at a bounce point).
  let tLo = min(frame.p5Cfg.w, nL); let tHi = select(0u, nL, frame.rcJitter.w > 0.0);
  let nT = select(0u, tHi - tLo, tHi > tLo);
  let nK = select(0u, nC, ex != 0u);
  let turns = select(nL + 1u, nT + nK, onScreen);
  var U = vec3f(0.0); var W = 0.0; var pick = -1; var pw = 0.0; var pL = vec3f(0.0); var pDist = 0.0; var pRad = 0.0;
  var vis = 1.0;
  let Po = P + N * 0.01;
  for (var t = 0u; t < turns; t++) {
    // which light this turn asks about, and what it does with the answer: 0 = a transient taken back out, 1 = a card's light taken back out, 2 = a steady light scored, 3 = the pick's shadow ray
    var mode = 2u; var slot = t;
    if (onScreen) {
      if (t < nT) { mode = 0u; slot = tLo + t; }
      else { mode = 1u; let k = t - nT; if ((ex & (1u << k)) == 0u) { continue; } slot = u32(wgCards[k * 4u + 1u].w); }
    } else if (t == nL) { if (pick < 0) { break; } mode = 3u; slot = u32(pick); }
    let li = wgLights[slot];
    if (mode == 0u && !lightTransient(li)) { continue; }
    if (mode == 2u) {
      if (lightTransient(li)) { continue; }
      if (ex != 0u) { let ck = wgCardOf[slot]; if (ck >= 0 && (ex & (1u << u32(ck))) != 0u) { continue; } }   // torch bounce cards: this light's direct term here is the card's to carry (never taken with the flag off: ex == 0u)
      if (!lightReaches(slot, P)) { continue; }   // walled off from the bounce point's cell (reach.ts): neither in the sum nor pickable — the same failure the direct pass had, one bounce down
    }
    var ev: LightEval;
    if (mode != 3u) { ev = evalLight(li, P, N); }
    else { ev.L = pL; ev.dist = vec3f(pDist, 0.0, 0.0); ev.ok = true; }
    if (!ev.ok) { continue; }
    var tmax = max(ev.dist.x - li.radius - 0.02, 0.0);
    var ray = true;
    if (mode == 2u) {
      let w = luminance(ev.E);
      if (w < 1e-4) { continue; }
      U += ev.E; W += w;
      if (rnd() * W < w) { pick = i32(slot); pw = w; pL = ev.L; pDist = ev.dist.x; pRad = li.radius; }
      ray = false;
    } else if (mode == 3u) {
      tmax = select(pDist - pRad - 0.02, 60.0, lightKind(li) == 2u);
      ray = tmax > 0.0;
    }
    var occ = false;
    if (ray) { occ = occluded(Po, ev.L, tmax, (li.owner & 0xffu) << 8u); }   // the same skip rule the direct pass used when it PUT the light there (its carrier never shadows it)
    if (mode == 0u) { if (!occ) { Ed -= ev.E; } }
    else if (mode == 1u) {
      if (occ) { continue; }
      var sub = ev.E;
      if (frame.numSmoke > 0u) { sub *= smokeTransmittance(Po, ev.L, min(tmax, 30.0)); }
      Ed -= sub;
    } else if (mode == 3u) { if (occ) { vis = 0.0; } }
  }
  if (onScreen) { return vec4f(max(Ed, vec3f(0.0)), 1.0); }
  if (pick < 0) { return vec4f(0.0, 0.0, 0.0, 2.0); }
  return vec4f(U * vis, 2.0);
}

