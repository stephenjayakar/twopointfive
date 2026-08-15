// Full-resolution direct lighting, history-free. One estimator for every light:
//   per pixel, every light is scored unshadowed (analytic, exact); lights fall into two classes — SHARP emitters
//   (torches, bulb, moon, muzzle flashes: narrow penumbrae) and BROAD ones (ceiling panels, screens, street lamps);
//   per class the strongest lights (2 sharp / 3 broad) get one shadow ray each to a random point on their emitter; the
//   rest of the class (the tail) gets ONE importance-picked shadow ray of its own (negligible tails ride on the leaders' visibility) instead of a ray of its
//   own — deterministic, so the only noise left for the denoiser is area-sampling noise inside real penumbrae. Each
//   class writes S (shadowed estimate), U (exact unshadowed total) and a signed penumbra-width hint (PCSS-style, from
//   the blocker distance). Cost is bounded by the per-class leader budget plus one tail ray, not by the light count no matter how many lights are on, transients need no
//   special casing, and there is no history anywhere in the direct path. The scoring itself is per 8x8 tile restricted — losslessly —
//   to the lights that can reach the tile's bounds at all (FLAG_TILECULL, below). Optionally (FLAG_CHECKER_DIRECT, lossy, off by default)
//   only a checkerboard half of the pixels trace shadow rays each frame and the other half reconstruct VISIBILITY from them (bottom).
// (The tile-cull reach test, the glass helpers, the rng and shadowSample live in direct_common.wgsl, prepended by passes.ts — restir.wgsl shares them.
//  This whole file is the settings.restir = OFF path: renderer v3 Phase 2a leaves it byte for byte as it was.)
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var gId: texture_2d<u32>;
@group(1) @binding(3) var outSharpS: texture_storage_2d<rgba16float, write>;   // rgb = S (sharp class), a = blur radius hint 0..1 (x MAX_BLUR_PX)
@group(1) @binding(4) var outSharpU: texture_storage_2d<rgba16float, write>;   // rgb = U (sharp class, unshadowed)
@group(1) @binding(5) var outBroadS: texture_storage_2d<rgba16float, write>;
@group(1) @binding(6) var outBroadU: texture_storage_2d<rgba16float, write>;

// the whole light list is walked by every pixel: stage it in workgroup memory once per 8x8 tile
var<workgroup> wgLights: array<Light, 64>;
// per-tile light culling (FLAG_TILECULL): the tile's 64 shading points are boxed (two-level min/max reduction), every light that
// provably evaluates to zero everywhere in that box is dropped, and the survivors' indices are compacted IN ASCENDING ORDER into
// wgList — the per-pixel loops below walk that list instead of 0..nL. ~34 lights are live in the level but a desk-sized tile is in
// range / in the cone / in front of only a handful; scoring the rest per pixel (a 64 B struct copy + evalLight each) was most of the pass.
var<workgroup> wgP: array<vec4f, 64>;         // [tile position] xyz = that pixel's shading point P, w = 1 when it shades a surface (0: off-screen, sky, direct off)
var<workgroup> wgRowMin: array<vec4f, 8>;     // level-1 partials, one per tile row: xyz = min over the row's live points, w = 1 if the row has any
var<workgroup> wgRowMax: array<vec4f, 8>;
var<workgroup> wgKeep: array<u32, 64>;        // light i survives the tile's box (written by thread i)
var<workgroup> wgList: array<u32, 64>;        // surviving light indices, ascending
var<workgroup> wgCount: u32;
// glass (FLAG_GLASS): per light, the panes (bits into SceneInfo.glass) that can possibly lie between it and ANY shading point of this tile — the light's own
// CPU mask (lightGlassMask: in range, bright enough, facing, a face in reach) narrowed to the panes whose bounds touch the box holding the tile's points and the
// light (a directional light keeps its CPU mask whole: glassPairMask). The segment P → light lies inside that box, so a pane outside it cannot cross the segment:
// culling by it is exact, and for nearly every (tile, light) pair the mask is 0 and glassVis is never called. Tile culling off: the light's whole CPU mask is tested.
var<workgroup> wgGlass: array<u32, 64>;
// checkerboard shadow rays (FLAG_CHECKER_DIRECT), indexed by tile position y*8+x like wgP: every lane publishes its surface (P + live in
// wgP, N and the per-class unshadowed luminance here) so the skipped half can tell which of its traced 4-neighbours lie on its own surface
// under the same lights, and the traced half what its rays found — per class the visibility ratio S/U and the penumbra hint |alpha|.
// (P + live reuse wgP above; the rest is packed to keep the tile's workgroup memory — and with it occupancy, flag on or off — near what it was)
var<workgroup> wgGeo: array<vec4f, 64>;       // xy = octEncode(N), z = luminance(U sharp), w = luminance(U broad)
var<workgroup> wgVis: array<vec4u, 64>;       // f16 pairs: x = sharp S/U .rg, y = (sharp S/U .b, |hint|), z, w = the same for broad




struct Pick { idx: i32, w: f32, E: vec3f };   // E: the light's unshadowed irradiance here, kept from the scoring loop so leaders are not evaluated twice


// The per-pixel estimator state lives at module scope (private = per invocation) so that the shadow phase can be a function: the
// checkerboard's late tracers (main, below) run it after the workgroup exchange, every other lane runs it exactly where this code always ran.
var<private> U: array<vec3f, 2>;      // exact unshadowed irradiance per class (0 sharp, 1 broad)
var<private> Uw: array<vec3f, 2>;     // the part of U from lights the reach masks (reach.ts) prove walled off from this cell: kept IN U (the ratio filter's denominator must stay as smooth as it always was — a per-cell step in U draws seams) but known dark: no leader slot, no tail pick, no ray, zero in S
var<private> W: array<f32, 2>;        // its luminance
var<private> top: array<Pick, 6>;     // [c*3 + k], k = 0..2 strongest first
var<private> lw: array<f32, 64>;      // every light's score, signed by class (< 0 sharp, > 0 broad, 0 = nothing here) — lets the tail be importance-sampled below without re-scoring
var<private> S: array<vec3f, 2>;      // shadowed estimate per class
var<private> blurPx: array<f32, 2>;   // OWN penumbra estimate in px (a ray was blocked)
var<private> softC: array<bool, 2>;    // SDF rig (iii): a ray of the class came back clear of boxes but darkened by the drawn character term (shadowSample .y = SOFT_CLEAR_Y)

// Shadow phase for one scored pixel: the tail pick, then the rays → S, blurPx. Draws from the lane's rng.
fn shadowPhase(P: vec3f, N: vec3f, Po: vec3f, owner: u32, pxPerMetre: f32, nIter: u32, tileCull: bool) {
  // ---- tail pick per class: one light drawn with probability ∝ its score among the NON-leaders (weighted reservoir over the stored
  // scores; no light is evaluated twice). Its shadow ray stands in for the whole tail: E[tail] = Σ_tail E_i·V_i exactly in expectation,
  // instead of borrowing the leaders' visibility — which ranked by UNshadowed irradiance are often bright panels behind a wall, whose
  // zero visibility used to black out a perfectly visible dim local light the moment it fell out of the top-K (a hard disc around it).
  var pickT: array<i32, 2>; var sumT: array<f32, 2>;
  pickT[0] = -1; pickT[1] = -1; sumT[0] = 0.0; sumT[1] = 0.0;
  for (var s = 0u; s < nIter; s++) {
    var i = s; if (tileCull) { i = wgList[s]; }   // same walk as the scoring loop: an unlisted light would have hit `sw == 0` → continue (no rnd()) anyway
    let sw = lw[i]; if (sw == 0.0) { continue; }
    let c = select(0u, 1u, sw > 0.0); let w = abs(sw); let K = select(2u, 3u, c == 1u);
    var lead = false; for (var k = 0u; k < K; k++) { if (top[c * 3u + k].idx == i32(i)) { lead = true; } }
    if (lead) { continue; }
    sumT[c] += w; if (rnd() * sumT[c] < w) { pickT[c] = i32(i); }
  }

  // ---- shadow rays: leaders exact (own visibility on own light); the tail rides on the leaders' aggregate visibility ----
  for (var c = 0u; c < 2u; c++) {
    S[c] = vec3f(0.0); blurPx[c] = 0.0;
    if (W[c] <= 0.0) { continue; }
    let K = select(2u, 3u, c == 1u);              // broad emitters (panels) overlap more: one extra leader
    var leadU = vec3f(0.0); var leadS = vec3f(0.0);
    for (var k = 0u; k < K; k++) {
      let pk = top[c * 3u + k];
      if (pk.idx < 0) { continue; }
      let li = wgLights[u32(pk.idx)];
      let f = pk.E;
      leadU += f;
      if (luminance(f) < 0.02 * W[c]) { leadS += f; continue; }   // negligible: not worth a ray
      // rays instead of heuristics: the strongest light gets 4 stratified emitter samples, the others 2 (a zero-radius
      // light needs exactly one — every sample would land on the same point)
      var ns = select(u32(clamp(select(frame.directCfg.y, frame.directCfg.x, k == 0u), 1.0, 8.0)), 1u, li.radius <= 0.0);
      if (c == 1u) { ns = min(ns, select(2u, 4u, k == 0u)); }   // broad emitters: wide, low-contrast penumbrae that the filter + history resolve well — cap their ray budget; the sharp class keeps the full budget for crisp edges
      if (W[0] + W[1] < frame.lossyCfg.z) { ns = 1u; }          // LOSSY option dimRays (z = 0 when off: never true): a pixel whose whole unshadowed light is this dim resolves its penumbrae with one emitter sample per leader — near black after the tonemap, where grain cannot be seen
      let u0 = vec2f(rnd(), rnd());
      var vsum = 0.0; var pwMax = -1.0; var blocked = 0u; var taken = 0u;
      for (var si = 0u; si < ns; si++) {
        // adaptive: the budget is only spent where samples disagree (a penumbra). Three stratified samples that all agree
        // — spread across the emitter disk — mean the light is entirely visible or entirely hidden from here; stop.
        if (si >= u32(max(frame.rcJitter.z, 2.0)) && (blocked == 0u || blocked == taken)) { break; }   // (>= 2: one sample cannot 'agree'; the stop rule biases faint penumbra tails slightly toward fully lit/dark)
        let vs = shadowSample(li, Po, N, owner, si, ns, u0);
        vsum += vs.x; taken++;
        if (vs.y >= 0.0) { pwMax = max(pwMax, vs.y); blocked++; }
        if (vs.y == SOFT_CLEAR_Y) { softC[c] = true; }
      }
      var fS = f;
      if (vsum > 0.0) { let gm = wgGlass[u32(pk.idx)]; if (gm != 0u) { fS = f * glassVis(li, gm, P); } }   // glass: a leader that actually REACHES this pixel (some sample lit) through a pane arrives tinted by it — a visibility factor, S only (U keeps the untinted light: the ratio filter smooths the tint's edge like a penumbra's); nothing asked for a blocked light or one with no pane in reach
      leadS += fS * (vsum / f32(taken));
      // penumbra hint only when this pixel actually straddles the shadow edge (some samples blocked, some not) or is fully
      // blocked (then the width tells the filter how far the lit side may be): PCSS width from the blocker distance
      if (blocked > 0u) { blurPx[c] = max(blurPx[c], max(0.75, pwMax * pxPerMetre * min(1.0, luminance(f) / W[c] * 2.0))); }
    }
    // tail = class total minus leaders. Worth a ray (≥ 2 % of the class): credited with the visibility of ONE importance-picked tail
    // light (one emitter sample) — unbiased in LUMINANCE for Σ_tail E·V (chroma stays the unshadowed tail's aggregate hue: differently
    // coloured tail lights with different visibility come out at the right brightness, mixed colour; the per-channel-unbiased E_pick·V/p
    // form exceeds U per channel and would fight the filter's S≤U ratio clamp — a queued follow-up), and noise-free wherever the tail
    // shares one fate (the filter / history take the rest). Negligible tails ride on the leaders' aggregate visibility (smooth, no ray).
    let tail = max(U[c] - leadU - Uw[c], vec3f(0.0));   // the live tail: walled-off lights (Uw) are dark by proof, not by the pick's luck
    var visTail = clamp(leadS / max(leadU, vec3f(1e-4)), vec3f(0.0), vec3f(1.0));
    var tailS = tail * visTail;
    if (pickT[c] >= 0 && luminance(tail) >= 0.02 * W[c]) {
      let li = wgLights[u32(pickT[c])];
      let vs = shadowSample(li, Po, N, owner, 0u, 1u, vec2f(rnd(), rnd()));
      if ((frame.flags & FLAG_TAIL_CHROMA) != 0u) {
        // per-channel unbiased form: this light's OWN colour, weighted by 1/p (p = its share of the tail's score). Single samples exceed U per
        // channel (the filter's ratio clamp is opened up for it); exact in expectation for every channel, chroma noise where the tail mixes hues.
        let ev = evalLight(li, P, N); let w = luminance(ev.E);
        tailS = select(vec3f(0.0), min(ev.E * (vs.x * sumT[c] / max(w, 1e-6)), 4.0 * tail), w > 0.0);   // bounded at 4× the unshadowed tail per channel HERE, so every consumer (the filter's exact shortcut and its ratio path alike) sees one distribution — a small energy loss on saturated minority lights instead of a desaturated band along the penumbra hints
      } else {
        tailS = tail * vs.x;   // luminance-unbiased, bounded by U: the tail keeps its aggregate hue
      }
      if (vs.y >= 0.0) { blurPx[c] = max(blurPx[c], max(0.75, vs.y * pxPerMetre * min(1.0, luminance(tail) / W[c] * 2.0))); }   // a blocked tail ray is a penumbra measurement too
      if (vs.y == SOFT_CLEAR_Y) { softC[c] = true; }
    }
    S[c] = leadS + tailS;
  }
}

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32) {
  let nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  // ---- lane → pixel (FLAG_CHECKER_DIRECT) ----
  // Off: lane i shades tile pixel (i & 7, i >> 3) — its global_invocation_id, as always. On: only the checkerboard half with
  // (x + y + frame parity) even traces shadow rays this frame, and the lanes are dealt so that 0..31 hold the tile's 32 traced pixels and
  // 32..63 the 32 reconstructed ones — whole SIMD groups (32 lanes on Apple / NVIDIA) then skip the ray phase instead of idling half their
  // lanes through it, which is where the saving comes from (a 64-wide wave gains nothing and loses nothing). Every tile row holds 4 pixels
  // of each parity: lane → row j >> 2, that row's (j & 3)-th pixel of the wanted parity. Tile origins are multiples of 8, so tile-local
  // parity is screen parity. The parity flips every frame while direct-light history is on (both halves feed the EMA); history-free it
  // stays put, like the rng pattern does, so a still picture holds still instead of trading own and borrowed samples at frame rate.
  let checker = (frame.flags & FLAG_CHECKER_DIRECT) != 0u;
  var lp = vec2u(lidx & 7u, lidx >> 3u);
  if (checker) { let j = lidx & 31u; let y = j >> 2u; let fpar = select(0u, frame.frameIdx & 1u, frame.directCfg.w > 0.0); lp = vec2u(2u * (j & 3u) + ((y + fpar + (lidx >> 5u)) & 1u), y); }
  let traced = !checker || lidx < 32u;           // this lane traces its own shadow rays (flag off: every lane, as before)
  let ti = lp.y * 8u + lp.x;                     // tile position index for the checkerboard exchange (== lidx when off)
  let gxy = wid.xy * 8u + lp;                    // the pixel this lane shades
  // no early return anywhere below: off-screen / sky / direct-off threads still take part in every barrier (the tile culling's and the
  // checkerboard exchange's — WGSL wants them in uniform control flow whether or not the flags are set), they just contribute no point to
  // the tile's box and store their zeros at the end (`live` = this thread shades a surface; the per-pixel work is predicated on it —
  // the same statements in the same order as when they sat behind early returns)
  let dims = textureDimensions(gDepth);
  let onScreen = gxy.x < dims.x && gxy.y < dims.y;
  var depth = 1.0;
  if (onScreen) { depth = textureLoad(gDepth, gxy, 0); }
  let live = onScreen && depth < 1.0 && (frame.flags & FLAG_DIRECT) != 0u;
  let pix = vec2f(gxy) + 0.5;
  let P = worldFromDepth(pix, depth);            // (finite garbage for dead threads; only live ones publish it)

  // ---- per-tile light list (FLAG_TILECULL; off = the old walk over 0..nL, for A/B) ----
  // Exactness: the list holds, in ascending order, every light index EXCEPT those lightReachesBox() proves score zero (evalLight !ok) at
  // every live pixel of this tile. The old loops met such a light with `if (!ev.ok) { continue; }` (scoring: lw[i] = 0, no U/W/top
  // update) and `if (sw == 0.0) { continue; }` (tail reservoir: no sumT update, no rnd() drawn). Walking the list therefore visits the
  // same contributing lights in the same order — identical float sums (order-dependent), identical top-K tie-breaks (first index wins),
  // identical rnd() sequence (one draw per non-leader light with a nonzero score, in index order) — and lw[] of a culled light is neither
  // written nor read because BOTH loops walk the list. Off-list ⊂ zero-score, never the reverse: lights that merely happen to score zero
  // at some pixel (facing away, N·L <= 0, per-pixel outside the cone) stay listed and take the old per-pixel early-outs.
  let tileCull = (frame.flags & FLAG_TILECULL) != 0u;
  var nIter = nL;                                // per-pixel loop trip count: nL (flag off) or the tile's list length
  if (tileCull) {
    wgP[ti] = vec4f(P, select(0.0, 1.0, live));   // (ti == lidx unless the checkerboard dealt the lanes; the box below is over all 64 either way)
    workgroupBarrier();                          // (also publishes wgLights)
    if (lidx < 8u) {                             // level 1: thread r boxes tile row r
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = 0.0;
      for (var k = 0u; k < 8u; k++) { let q = wgP[lidx * 8u + k]; if (q.w > 0.0) { mn = min(mn, q.xyz); mx = max(mx, q.xyz); anyLive = 1.0; } }
      wgRowMin[lidx] = vec4f(mn, anyLive); wgRowMax[lidx] = vec4f(mx, anyLive);
    }
    workgroupBarrier();
    if (lidx < nL) {                             // level 2 (8 partials, redundantly per thread — cheaper than another barrier) + thread i tests light i
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = false;
      for (var r = 0u; r < 8u; r++) { let a = wgRowMin[r]; if (a.w > 0.0) { mn = min(mn, a.xyz); mx = max(mx, wgRowMax[r].xyz); anyLive = true; } }
      let keep = anyLive && lightReachesBox(wgLights[lidx], mn, mx);
      wgKeep[lidx] = select(0u, 1u, keep);   // an all-dead tile keeps nothing (nobody will walk the list)
      var gm = 0u;
      if (keep && (frame.flags & FLAG_GLASS) != 0u) { gm = glassPairMask(wgLights[lidx], mn, mx); }   // (glass: which panes this light can shine through onto this tile — none, nearly always; a culled light's mask is never read)
      wgGlass[lidx] = gm;
    }
    workgroupBarrier();
    if (lidx == 0u) {                            // ordered compaction: a serial scan over <= 64 flags keeps the index order the estimator depends on
      var n = 0u;
      for (var i = 0u; i < nL; i++) { if (wgKeep[i] != 0u) { wgList[n] = i; n++; } }
      wgCount = n;
    }
    workgroupBarrier();
    nIter = wgCount;
  } else {
    if (lidx < nL) { wgGlass[lidx] = lightGlassMask(wgLights[lidx]); }   // no tile box to cull panes by: every pane the light can reach is tested per pixel (same product; 0 with the flag off)
    workgroupBarrier();                          // wgLights (+ wgGlass) staged
  }
  var N = vec3f(0.0, 1.0, 0.0); var owner = 0u; var Po = P; var zView = 0.0; var pxPerMetre = 0.0;
  // ---- score every light unshadowed; keep the top-3 per class (sharp uses 2 of them) ----
  for (var c = 0u; c < 2u; c++) { U[c] = vec3f(0.0); Uw[c] = vec3f(0.0); W[c] = 0.0; for (var k = 0u; k < 3u; k++) { top[c * 3u + k] = Pick(-1, 0.0, vec3f(0.0)); } }
  if (live) {
    // history-free: a static per-pixel pattern (residuals sit still instead of boiling); with temporal reuse on, the pattern advances
    // every frame so the history actually accumulates different samples (a static pattern would make history ≡ current)
    rngInit(gxy, select(0u, select(frame.frameIdx, frame.frameIdx >> 1u, (frame.flags & FLAG_DIRECT_SEED_HOLD) != 0u), frame.directCfg.w > 0.0));   // (FLAG_DIRECT_SEED_HOLD, an A/B knob: the pattern advances every other frame)
    N = normalize(textureLoad(gNormal, gxy, 0).xyz * 2.0 - 1.0);
    let id = textureLoad(gId, gxy, 0).x;
    owner = (id >> 20u) & 0xffu;
    Po = P + N * 0.015;
    zView = distance(P, frame.camPos);
    pxPerMetre = frame.screen.y / (2.0 * zView * frame.post.w + 1e-4);   // post.w = tan(fov/2): metres → pixels at this depth
    for (var s = 0u; s < nIter; s++) {
      var i = s; if (tileCull) { i = wgList[s]; }   // the tile's list (ascending) or, flag off, every light 0..nL as before
      lw[i] = 0.0;
      let li = wgLights[i];
      let ev = evalLight(li, P, N);
      if (!ev.ok) { continue; }
      let w = luminance(ev.E);
      if (w < 1e-4) { continue; }
      let c = select(0u, 1u, lightBroad(li));
      U[c] += ev.E; W[c] += w;
      let rlv = lightReachLevel(i, P);
      if (rlv == 0u) { Uw[c] += ev.E; continue; }   // walled off from this pixel's cell (reach.ts): counted in U, known dark — lw[i] stays 0 so the tail walk neither picks it nor draws a rnd() for it, and it takes no leader slot
      lw[i] = select(-w, w, c == 1u);
      var cand = Pick(i32(i), w * reachRankWeight(rlv), ev.E);   // RANKED by score × how much of this cell the light sees (a panel glimpsed through a far doorway does not take a leader slot from the room's own lamp); U / W / the tail keep the true score
      for (var k = 0u; k < 3u; k++) { let j = c * 3u + k; if (cand.w > top[j].w) { let tmp = top[j]; top[j] = cand; cand = tmp; } }
    }
  }
  // ---- shadow rays for the lanes that trace this frame (flag off: every live lane, right here as always) ----
  S[0] = vec3f(0.0); S[1] = vec3f(0.0); blurPx[0] = 0.0; blurPx[1] = 0.0; softC[0] = false; softC[1] = false;
  if (live && traced) { shadowPhase(P, N, Po, owner, pxPerMetre, nIter, tileCull); }
  // alpha < 0: this pixel's OWN penumbra estimate (a blocker was found; the denoiser keeps it close to that);
  // alpha == 0: lit for its leaders — inherits (dilates) the hints around it in the denoiser
  let cap = frame.directCfg.z;
  var a0 = -clamp(min(blurPx[0], cap) / MAX_BLUR_PX, 0.0, 1.0);
  var a1 = -clamp(min(blurPx[1], cap) / MAX_BLUR_PX, 0.0, 1.0);
  if (blurPx[0] <= 0.0 && softC[0]) { a0 = -SOFT_HINT_FLAG; }   // no box penumbra measured, a man's DRAWN shadow on the pixel: the denoiser takes this frame's ratio as it is (SDF rig iii; the checkerboard's skipped half inherits it as the widest hint in reach)
  if (blurPx[1] <= 0.0 && softC[1]) { a1 = -SOFT_HINT_FLAG; }

  // ---- checkerboard exchange (FLAG_CHECKER_DIRECT): the traced half publishes, the skipped half rebuilds S = U × (its neighbours' S/U) ----
  // U is exact at EVERY pixel either way; only visibility is borrowed, per class, as the ratio the penumbra filter smooths anyway (same
  // per-channel clamp as its ratioOf), so a borrowed one is a plausible sample of this pixel's own. Neighbour k (the 4-neighbours all have
  // the traced parity; 2 remain in a tile corner, 3 on an edge — reading across tiles is not worth an apron) weighs
  //   (same orientation) × (same plane — softblur's test: a desk edge never borrows the floor's shadow) × (lit alike, per class — the
  //   ratio of a neighbour under another light footprint says nothing about ours),
  // and the hint becomes the widest one in reach, claimed as OWN (negative) so filter and history treat the pixel like its neighbours.
  // Two cases trace for themselves after all, late (after the barrier — the SIMD group that skipped the ray phase runs it once for them):
  // a lit class with next to no usable neighbour (silhouette slivers, lone pixels of a partial tile), and a HARD shadow edge running
  // between the neighbours — their ratios disagree outright while their hints promise (almost) no filtering to hide a guess behind. Wide
  // penumbrae interpolate silently (the filter blurs far wider than one pixel there); hard edges stay traced every frame; what is left
  // is one frame of softness on narrow penumbrae in fast motion, since (with history on) the parities swap every frame and each pixel
  // measures for itself on the next.
  if (checker) {
    if (!tileCull) { wgP[ti] = vec4f(P, select(0.0, 1.0, live)); }   // (the tile culling published it already when on)
    wgGeo[ti] = vec4f(octEncode(N), W[0], W[1]);   // W[c] = Σ luminance(E) = luminance(U[c])
    if (live && traced) {
      let hiR = vec3f(select(1.0, 4.0, (frame.flags & FLAG_TAIL_CHROMA) != 0u));
      let v0 = clamp(S[0] / max(U[0], vec3f(1e-4)), vec3f(0.0), hiR); let v1 = clamp(S[1] / max(U[1], vec3f(1e-4)), vec3f(0.0), hiR);
      wgVis[ti] = vec4u(pack2x16float(v0.xy), pack2x16float(vec2f(v0.z, -a0)), pack2x16float(v1.xy), pack2x16float(vec2f(v1.z, -a1)));
    }
    workgroupBarrier();
    if (live && !traced) {
      var r0 = vec3f(0.0); var r1 = vec3f(0.0); var ws0 = 0.0; var ws1 = 0.0; var h0 = 0.0; var h1 = 0.0;
      var lo0 = 4.0; var hi0 = 0.0; var lo1 = 4.0; var hi1 = 0.0;   // luminance range of the usable neighbours' ratios per class
      for (var k = 0u; k < 4u; k++) {
        let q = vec2i(lp) + select(vec2i(select(-1, 1, k == 1u), 0), vec2i(0, select(-1, 1, k == 3u)), k >= 2u);   // (x∓1, y), (x, y∓1)
        if (any(q < vec2i(0)) || any(q > vec2i(7))) { continue; }
        let qi = u32(q.y * 8 + q.x);
        let gp = wgP[qi]; if (gp.w <= 0.0) { continue; }
        let g = wgGeo[qi];
        let w = pow(max(dot(octDecode(g.xy), N), 0.0), 8.0) * exp(-abs(dot(gp.xyz - P, N)) / max(zView * 0.004, 0.04));
        let w0 = select(0.0, w * min(g.z, W[0]) / max(max(g.z, W[0]), 1e-6), g.z >= 1e-5 && W[0] > 0.0);
        let w1 = select(0.0, w * min(g.w, W[1]) / max(max(g.w, W[1]), 1e-6), g.w >= 1e-5 && W[1] > 0.0);
        let pk = wgVis[qi];
        if (w0 > 1e-3) { let v = vec4f(unpack2x16float(pk.x), unpack2x16float(pk.y)); r0 += v.xyz * w0; ws0 += w0; h0 = max(h0, v.w); let l = luminance(v.xyz); lo0 = min(lo0, l); hi0 = max(hi0, l); }
        if (w1 > 1e-3) { let v = vec4f(unpack2x16float(pk.z), unpack2x16float(pk.w)); r1 += v.xyz * w1; ws1 += w1; h1 = max(h1, v.w); let l = luminance(v.xyz); lo1 = min(lo1, l); hi1 = max(hi1, l); }
      }
      // late trace: (a lone perfect neighbour weighs 1) no support for a lit class, or a hard edge — ratios > 0.35 apart under hints below 2 px
      let late0 = W[0] > 0.0 && (ws0 < 0.15 || (hi0 - lo0 > 0.35 && h0 * MAX_BLUR_PX < 2.0));
      let late1 = W[1] > 0.0 && (ws1 < 0.15 || (hi1 - lo1 > 0.35 && h1 * MAX_BLUR_PX < 2.0));
      if (late0 || late1) {
        shadowPhase(P, N, Po, owner, pxPerMetre, nIter, tileCull);
        a0 = -clamp(min(blurPx[0], cap) / MAX_BLUR_PX, 0.0, 1.0);
        a1 = -clamp(min(blurPx[1], cap) / MAX_BLUR_PX, 0.0, 1.0);
        if (blurPx[0] <= 0.0 && softC[0]) { a0 = -SOFT_HINT_FLAG; }
        if (blurPx[1] <= 0.0 && softC[1]) { a1 = -SOFT_HINT_FLAG; }
      } else {
        S[0] = U[0] * (r0 / max(ws0, 1e-6)); a0 = -h0;   // (a class with no light here: U = 0 and no weights → S 0, hint -0, like a traced one)
        S[1] = U[1] * (r1 / max(ws1, 1e-6)); a1 = -h1;
      }
    }
  }
  if (onScreen) {
    if (live) {
      textureStore(outSharpS, gxy, vec4f(S[0], a0));
      textureStore(outSharpU, gxy, vec4f(U[0], 1.0));
      textureStore(outBroadS, gxy, vec4f(S[1], a1));
      textureStore(outBroadU, gxy, vec4f(U[1], 1.0));
    } else {
      textureStore(outSharpS, gxy, vec4f(0.0)); textureStore(outSharpU, gxy, vec4f(0.0)); textureStore(outBroadS, gxy, vec4f(0.0)); textureStore(outBroadU, gxy, vec4f(0.0));
    }
  }
}
