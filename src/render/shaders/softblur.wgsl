// Direct-light penumbra filter, BOTH emitter classes in one dispatch (they share every depth / normal fetch and all the
// geometric weight math; only S, U and the hints differ per class). It smooths the *visibility ratio* S/U per colour
// channel — S = shadow-sampled estimate, U = the same lights unshadowed and exact — never the light itself, so cone
// edges and unshadowed light stay per-pixel exact and dark regions stay dark. S.a is a signed radius hint in units of
// MAX_BLUR_PX: negative = this pixel's OWN penumbra width (its shadow rays met a blocker: PCSS width from the blocker
// distance), zero = fully lit for its sampled lights (inherits the widest hint within reach, so the lit half of a
// penumbra is filtered like the dark half). 3x3 à-trous passes (STRIDE 1,2,4,8,16,1); every pass runs everywhere and
// weighs itself by how much of its reach the local hint asks for — no quality gates. The two per-pixel shortcuts below are exact,
// and so is the per-tile one in front of them (FLAG_SOFT_TILESKIP): whole 8x8 tiles provably out of every hint's reach leave early.
override STRIDE: i32 = 1;
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var softIn0: texture_2d<f32>;     // class 0 (sharp): rgb = S (possibly already filtered), a = signed hint
@group(1) @binding(3) var softIn1: texture_2d<f32>;     // class 1 (broad)
@group(1) @binding(4) var softOut0: texture_storage_2d<rgba16float, write>;
@group(1) @binding(5) var softOut1: texture_storage_2d<rgba16float, write>;
@group(1) @binding(6) var softU0: texture_2d<f32>;      // rgb = U per class
@group(1) @binding(7) var softU1: texture_2d<f32>;
@group(1) @binding(8) var tileMask: texture_2d<u32>;    // per 8x8 tile (= per workgroup), rebuilt every frame by softtile.wgsl: tile distance to the nearest hint | bit 256 = pass this tile through

fn ratioOf(S: vec3f, U: vec3f) -> vec3f { return clamp(S / max(U, vec3f(1e-4)), vec3f(0.0), vec3f(select(1.0, 4.0, (frame.flags & (FLAG_TAIL_CHROMA | FLAG_RESTIR)) != 0u))); }   // shadowed ≤ unshadowed per channel — except the experimental chroma-exact tail, whose single samples overshoot U (bounded at 4×), and ReSTIR's per-light hues (restir.wgsl SHADE: one visible warm lamp under a U that also holds the walled-off moon tops U's red)

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u) {
  let dims = textureDimensions(gDepth);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let pc = vec2i(gid.xy); let hi = vec2i(dims) - 1;
  // ---- tile-level pass-through (FLAG_SOFT_TILESKIP): a masked tile copies its input texels to its output and leaves. Why that is exact: ----
  // (1) Per pixel, this pass hands its input texel back untouched whenever its own hint is not negative and all 9 taps read |a| == 0:
  //     sky / flags-off / no-light pixels store cA, cB as they are; otherwise own = false and inh = max(0, |0|…) = 0 make skipA AND skipB
  //     true and the early-out stores (c.rgb, live ? inh : c.a) = (c.rgb, 0) — the input again, up to the sign of an exactly-zero alpha
  //     (the direct pass writes lit pixels as -0.0), which every reader of these textures (this filter: abs() / < 0; composite's hint
  //     debug view: abs(); composite / fgather: rgb only; dtemporal reads S before the chain runs) treats identically.
  // (2) A pass moves hints by at most STRIDE px: aOut is the pixel's own c.a or the widest |a| among its taps. So after the chain step with
  //     cumulative stride sum S_k, alpha is non-zero only within S_k px (Chebyshev; edge clamping only pulls taps nearer) of a pixel whose
  //     alpha left the direct pass non-zero — dtemporal copies alpha through — and by (1) any pixel further than S_k from all such pixels
  //     passes step k through (its taps reach STRIDE px into territory that is clean up to S_(k-1) = S_k - STRIDE). The chain's total
  //     stride sum S bounds every S_k, so a pixel further than S from all of them passes EVERY step through.
  // (3) softtile.wgsl flags the tiles holding such pixels and measures every tile's tile distance d to the nearest flagged one; pixels of
  //     tiles t apart are >= 8(t-1)+1 px apart, so d >= floor((S-1)/8)+2 (passes.ts skipThreshold; bit 256 of the mask) puts the whole
  //     tile beyond S. Such a tile stores input → output here at every step, i.e. exactly what the per-pixel path would have stored, so
  //     both ping-pong textures hold after every step what they always held (alpha zero-sign aside) — unmasked neighbours tapping into
  //     the tile read the same values as before, and nothing relies on a texel surviving from an earlier step or frame.
  // The mask texel is one address per workgroup (a broadcast); no barrier follows, so the non-uniform-looking return is fine. Flag off:
  // straight to the per-pixel path below, as before (and the host does not even build the mask).
  if ((frame.flags & FLAG_SOFT_TILESKIP) != 0u && (textureLoad(tileMask, vec2i(wid.xy), 0).x & 256u) != 0u) {
    textureStore(softOut0, pc, textureLoad(softIn0, pc, 0)); textureStore(softOut1, pc, textureLoad(softIn1, pc, 0));
    return;
  }
  let d0 = textureLoad(gDepth, pc, 0);
  let cA = textureLoad(softIn0, pc, 0);
  let cB = textureLoad(softIn1, pc, 0);
  if (d0 >= 1.0 || (frame.flags & (FLAG_SOFTSHADOW | FLAG_DIRECT)) != (FLAG_SOFTSHADOW | FLAG_DIRECT)) { textureStore(softOut0, pc, cA); textureStore(softOut1, pc, cB); return; }
  let UA = textureLoad(softU0, pc, 0).xyz; let UB = textureLoad(softU1, pc, 0).xyz;
  let luA = luminance(UA); let luB = luminance(UB);
  let liveA = luA >= 1e-5; let liveB = luB >= 1e-5;                     // a class with no light at this pixel is passed through untouched (and costs nothing below)
  if (!liveA && !liveB) { textureStore(softOut0, pc, cA); textureStore(softOut1, pc, cB); return; }
  let ownA = cA.a < 0.0; let ownB = cB.a < 0.0;
  let ownRA = abs(cA.a); let ownRB = abs(cB.a);
  // pass 1 over the taps (live classes only): the widest hint within reach and whether there is any signal at all
  var inhA = 0.0; var inhB = 0.0; var maxA = luminance(cA.xyz); var maxB = luminance(cB.xyz);
  for (var t = 0; t < 9; t++) {
    let q = clamp(pc + vec2i(t % 3 - 1, t / 3 - 1) * STRIDE, vec2i(0), hi);
    if (liveA) { let a = textureLoad(softIn0, q, 0); inhA = max(inhA, abs(a.a)); maxA = max(maxA, luminance(a.xyz)); }   // widest wish within this pass's reach (dilates pass to pass)
    if (liveB) { let b = textureLoad(softIn1, q, 0); inhB = max(inhB, abs(b.a)); maxB = max(maxB, luminance(b.xyz)); }
  }
  let aOutA = select(inhA, -ownRA, ownA); let aOutB = select(inhB, -ownRB, ownB);
  // exact shortcuts per class (they change nothing about the result, only skip work): no light of the class here;
  // nobody within reach measured a penumbra and neither did we (strength 0); everything within reach is black
  let skipA = !liveA || (!ownA && inhA <= 0.0) || maxA < 1e-6;
  let skipB = !liveB || (!ownB && inhB <= 0.0) || maxB < 1e-6;
  let outA0 = vec4f(cA.xyz, select(aOutA, cA.a, !liveA));
  let outB0 = vec4f(cB.xyz, select(aOutB, cB.a, !liveB));
  if (skipA && skipB) { textureStore(softOut0, pc, outA0); textureStore(softOut1, pc, outB0); return; }
  let P0 = worldFromDepth(vec2f(pc) + 0.5, d0);
  let z0 = distance(P0, frame.camPos);
  let n0 = textureLoad(gNormal, pc, 0).xyz * 2.0 - 1.0;
  var accA = vec3f(0.0); var wsA = 0.0; var accB = vec3f(0.0); var wsB = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = clamp(pc + vec2i(dx, dy) * STRIDE, vec2i(0), hi);
      let d = textureLoad(gDepth, q, 0);
      if (d >= 1.0) { continue; }
      let Pq = worldFromDepth(vec2f(q) + 0.5, d);
      let nq = textureLoad(gNormal, q, 0).xyz * 2.0 - 1.0;
      var w = f32((2 - abs(dx)) * (2 - abs(dy))) * 0.0625;            // [1 2 1]/4 ⊗ [1 2 1]/4
      w *= exp(-abs(dot(Pq - P0, n0)) / max(z0 * 0.004, 0.04));      // plane distance: slanted floor = one surface at any stride; a desk top never joins the floor
      w *= pow(max(dot(nq, n0), 0.0), 12.0);
      if (w < 1e-6) { continue; }
      if (!skipA) {
        let Uq = textureLoad(softU0, q, 0).xyz; let luq = luminance(Uq);
        if (luq >= 1e-5) { let wq = w * min(luq, luA) / max(luq, luA); accA += ratioOf(textureLoad(softIn0, q, 0).xyz, Uq) * wq; wsA += wq; }   // lit alike: never mix across a cone edge or between different light footprints
      }
      if (!skipB) {
        let Uq = textureLoad(softU1, q, 0).xyz; let luq = luminance(Uq);
        if (luq >= 1e-5) { let wq = w * min(luq, luB) / max(luq, luB); accB += ratioOf(textureLoad(softIn1, q, 0).xyz, Uq) * wq; wsB += wq; }
      }
    }
  }
  // radius each class wants: its own measurement (nudged toward the neighbourhood — one pixel's blocker-distance guess can
  // be unlucky) or, when it measured nothing, whatever its neighbours ask for; strength = how much of this pass's reach that is
  let reach = f32(STRIDE) * 1.5;
  if (skipA) { textureStore(softOut0, pc, outA0); }
  else {
    let want = select(inhA, max(ownRA, 0.3 * inhA), ownA) * MAX_BLUR_PX;
    var r = ratioOf(cA.xyz, UA);
    if (wsA > 1e-4) { r = mix(r, accA / wsA, smoothstep(reach * 0.5, reach * 1.25, want)); }
    textureStore(softOut0, pc, vec4f(UA * r, aOutA));                 // hint out: own stays own (signed), lit pixels carry the dilated wish onward
  }
  if (skipB) { textureStore(softOut1, pc, outB0); }
  else {
    let want = select(inhB, max(ownRB, 0.3 * inhB), ownB) * MAX_BLUR_PX;
    var r = ratioOf(cB.xyz, UB);
    if (wsB > 1e-4) { r = mix(r, accB / wsB, smoothstep(reach * 0.5, reach * 1.25, want)); }
    textureStore(softOut1, pc, vec4f(UB * r, aOutB));
  }
}
