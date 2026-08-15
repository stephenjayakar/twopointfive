// LOSSY option `pressureHalf` (smoke.ts): the pressure Poisson problem solved on a 32³ grid per domain instead of the 64³ one — the classic
// cheap-smoke trade. This file is appended to smoke.wgsl in a SECOND shader module that smoke.ts only compiles the first time the option is
// switched on, so it shares SimParams / DomainParams / the group-1 slots / atlas() / inDomain() / RB_COLOR with the kernels above and the
// default module stays byte-for-byte what it was. Nothing here runs while the option is off.
//
// The coarse grid is 32³ blocks of 2×2×2 cells per domain, kept in three 32 × 32 × (32·MAX_DOMAINS) r32float textures (pressure ping / pong,
// and a pair written fresh every step by restrictDiv: block divergence + packed face counts) that smoke.ts binds to the same srcP / srcDiv /
// srcObst / dstP / dstDiv slots the fine kernels use. One domain step with the option on:
//   divergence (fine, unchanged) → restrictDiv → 2·rbIters × rbgsC, warm-started (the coarse pressure persists per domain the way pA does; it
//   is zeroed when a domain is placed and, for every domain, whenever the option is switched on) → prolongate into pA → pressureHalfSmooth ×
//   the ordinary fine rbgs red/black pair (default 1, see below) → project (unchanged: it reads pA as ever).
//
// * Coarse operator = the fine one summed over blocks (finite volume), boundaries included. The fine 7-point equation at a cell is a flux
//   balance: Σ_faces (p_nb − p) = h²·div, the face to a solid neighbour dropped (pAt mirrors: Neumann), the ghost past an open domain face
//   held at 0, the ghost under a closed floor mirrored. Give a whole block ONE unknown P and add up its fluid cells' balances: internal faces
//   cancel and what is left is   Σ_f n_f·(P_nb(f) − P) = 2h²·Σ_fluid cells div   over the block's six faces, where n_f ∈ 0…4 counts the fine
//   face pairs across face f that are open (fluid here AND fluid — or open-boundary ghost — there) and the 2 is the doubled centre distance.
//   restrictDiv stores Σdiv/8 and the six counts (3 bits each, + a 6-bit "any open" mask, as an exact small integer in the f32); rbgsC relaxes
//   P ← (Σ n_f·P_nb − 16h²·(Σdiv/8)) / Σ n_f with the panel's omega. A block with all 8 cells fluid and open all round reduces to exactly the
//   familiar (ΣP_nb − (2h)²·D̄)/6, so nothing is retuned; a block with no open pair (inside a wall) is skipped and never read.
// * Why this boundary rule (and not "a block is solid if any / most / all of its cells are"): the coarse system is sealed exactly where the
//   fine grid is sealed — a one-cell partition, a door frame, a desk top between two blocks all give n_f = 0 across them, so no plume ever
//   feels push or suction through geometry, however the obstacle happens to align with the 2-cell blocks — and at the same time a one-cell
//   fluid layer against a wall, under the ceiling or over a desk keeps its equation and its divergence, so a jet hitting the ceiling still
//   builds the pressure that turns it into a spreading sheet. (Prototyped on the CPU against the converged fine solve on a 32³ box with an
//   odd-aligned desk, a 1-cell partition with a gap and a ceiling slab: velocity-correction error 12 % of the fine correction — the fine
//   solver's own 4 pairs from a cold start are at 41 % — against 36 % for the "any cell solid" rule, which left the layer over the desk
//   essentially unprojected; pressure within 8 % of the fine field in L2 against 58 %; and no extra flow behind the partition.) Smoke is
//   kept OUT of walls, as before, by project's per-face velocity clamps and the advection kernels zeroing solid cells — both fine, both untouched.
// * Prolongation: trilinear — fine centre 2I+a sits a quarter block from block centre I, so per axis the taps are I−1+a and I+a with weights
//   ¼|¾ (a = 0) or ¾|¼ (a = 1) — restricted to taps the home block is actually CONNECTED to: a face neighbour needs an open pair across the
//   shared face, an edge neighbour an open two-face path either way round (home's face out AND the tap's face back), a corner all three; a
//   block with no open pair is never a tap; a ghost past an open face counts as the 0 it is when the home block's own faces open toward it
//   (for edge / corner ghosts only home's faces are asked — weight ≤ 3/64, value 0); nothing is taken from under a closed floor. Weights
//   are renormalised over what is left, so a fine cell beside a wall blends only pressures from its own side (∂p/∂n ≈ 0 there, like the
//   fine Neumann mirror) and never a value from across a partition or from inside an obstacle. C0-
//   continuous → project's central gradient varies smoothly; piecewise-constant injection alternated one-sided differences cell to cell and
//   measured far worse (58 % correction error, block-scale stipple in the divergence), which is why it was not used.
// * The fine pair after the prolongation (smoke.ts pressureHalfSmooth, default 1; the ordinary rbgs sweeps of the default module) is part
//   of the scheme, not garnish: a 2×2×2 block cannot see the grid-scale divergence the buoyant plume skin and the density-masked turbulence
//   make every step, the coarse solve alone leaves it in the field, and it piles up — a CPU soak of the whole step (canister preset, 90 s)
//   measured rms divergence ≈ 5× the fine path's and +40 % smoke mass with 0 pairs, but at or under the fine path's own with 1 (mass within
//   a few %, and calmer than the fine solve once the emitter dies); 2 or 3 pairs came out slightly worse than 1 (an over-relaxed second pair
//   overshoots back). Coarse for the smooth part, one fine pair for the rough part: the usual two-grid division of labour.
// * The loss that remains: divergence at scales under two cells that one pair does not reach (canister mouth, expansion cores) — softer
//   billows there, slightly puffier plumes; the large-scale motion (rise, mushrooming, filling a room, venting through a doorway) is the
//   coarse field's and stays. Advection, curl / vorticity confinement, turbulence, buoyancy, injection and everything the renderer samples
//   remain 64³.
// * Stability: rbgsC is SOR on a symmetric, diagonally dominant system (omega < 2); the prolongation is a convex combination of finite
//   values; project, the 11 m/s clamp in forces, velDamp and the scalar limiter are untouched; the coarse slabs are zeroed on (re)placement
//   and on every off→on so no stale field is mistaken for a warm start; and both writers pass their result through finiteOr0 so a value
//   gone non-finite drops to 0 instead of living on in the warm start (best effort: WGSL lets a compiler assume NaN never happens).

fn cDims() -> vec3i { return vec3i(sim.dims / 2u); }
fn cIn(c: vec3i) -> bool { return all(c >= vec3i(0)) && all(c < cDims()); }
fn cAtlas(c: vec3i) -> vec3i { return c + vec3i(0, 0, i32(dom.zOff / 2u)); }
fn finiteOr0(x: f32) -> f32 { return select(0.0, x, abs(x) < 1.0e9); }   // |p| stays orders below this (div ≤ ~10³/s, h² ≤ 3e-3, ≤ 64² cells); NaN compares false → 0

// Faces: 0 = −x, 1 = +x, 2 = −y, 3 = +y, 4 = −z, 5 = +z. The packed word restrictDiv writes per block: bits 3f…3f+2 = n_f (0…4), bits 18…23 =
// mask of faces with n_f ≠ 0 — an integer below 2²⁴, so f32(word) → r32float → u32(texel) is exact both ways. (Read back by plain truncation:
// most words are ≥ 2²³, where the f32 spacing is already 1.0 and the usual "+ 0.5 then truncate" would round every odd word up to even.)
fn faceDir(f: u32) -> vec3i {
  let s = select(-1, 1, (f & 1u) == 1u); let a = f >> 1u;
  return select(select(vec3i(0, 0, s), vec3i(0, s, 0), a == 1u), vec3i(s, 0, 0), a == 0u);
}
fn faceCount(K: u32, f: u32) -> f32 { return f32((K >> (3u * f)) & 7u); }
fn openMask(K: u32) -> u32 { return K >> 18u; }
fn blockWord(C: vec3i) -> u32 { return u32(textureLoad(srcObst, cAtlas(C), 0).x); }   // srcObst = the packed block texture in rbgsC / prolongate
// A fine cell that can hold pressure across a face pair: fluid inside the domain, or the ghost past an OPEN domain face (p = 0 lives there);
// the ghost under a closed floor cannot (mirrored = no pair), matching obstAt / pAt.
fn fluidFine(c: vec3i) -> bool {
  if (!inDomain(c)) { return !(c.y < 0 && dom.floorClosed != 0u); }
  return textureLoad(srcObst, atlas(c), 0).x <= 0.5;                                          // srcObst = the fine obstacle bake in restrictDiv
}

// ------------------------------------------------------------------ restriction: fine divergence + obstacles → block divergence + face counts
// One invocation per block (dispatch cDims()/4). srcDiv = divT and srcObst = the obstacle bake, both fine, this step; dstDiv = Σdiv/8 over the
// block's fluid cells, dstP = the packed face-count word (the second r32float write slot, borrowed).
@compute @workgroup_size(4, 4, 4)
fn restrictDiv(@builtin(global_invocation_id) gid: vec3u) {
  let C = vec3i(gid);
  if (!cIn(C)) { return; }
  let B = C * 2;
  var fl: array<bool, 8>;
  var s = 0.0;
  for (var k = 0; k < 8; k++) {
    let c = B + vec3i(k & 1, (k >> 1) & 1, k >> 2);
    let f = textureLoad(srcObst, atlas(c), 0).x <= 0.5;
    fl[k] = f;
    if (f) { s += textureLoad(srcDiv, atlas(c), 0).x; }
  }
  var K = 0u; var mask = 0u;
  for (var f = 0u; f < 6u; f++) {
    let axis = f >> 1u; let plus = i32(f & 1u);
    var n = 0u;
    for (var q = 0; q < 4; q++) {
      // the four cells of the block on face f: axis coordinate = plus, the other two enumerated by q
      var c = vec3i(plus, q & 1, q >> 1);
      if (axis == 1u) { c = vec3i(q >> 1, plus, q & 1); } else if (axis == 2u) { c = vec3i(q & 1, q >> 1, plus); }
      if (fl[c.x + 2 * c.y + 4 * c.z] && fluidFine(B + c + faceDir(f))) { n++; }
    }
    K |= n << (3u * f);
    if (n != 0u) { mask |= 1u << f; }
  }
  textureStore(dstDiv, cAtlas(C), vec4f(s * 0.125, 0.0, 0.0, 0.0));
  textureStore(dstP, cAtlas(C), vec4f(f32(K | (mask << 18u)), 0.0, 0.0, 0.0));
}

// ------------------------------------------------------------------ coarse red-black SOR half sweep (RB_COLOR as rbgs; omega from the panel)
// srcP / dstP = coarse ping / pong, srcDiv = block divergence, srcObst = packed face counts. A block with no open pair carries its value
// (nobody reads it: neighbours weight it by n_f = 0, prolongate never taps it) and so keeps its cleared 0.
@compute @workgroup_size(4, 4, 4)
fn rbgsC(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!cIn(c)) { return; }
  let pc = textureLoad(srcP, cAtlas(c), 0).x;
  let K = blockWord(c);
  if (u32((c.x + c.y + c.z) & 1) != RB_COLOR || openMask(K) == 0u) { textureStore(dstP, cAtlas(c), vec4f(pc, 0.0, 0.0, 0.0)); return; }
  var sn = 0.0; var s = 0.0;
  for (var f = 0u; f < 6u; f++) {
    let n = faceCount(K, f);
    let nb = c + faceDir(f);
    if (n > 0.0 && cIn(nb)) { s += n * textureLoad(srcP, cAtlas(nb), 0).x; }   // an open pair onto a ghost: the ghost's p is 0 (only open faces have pairs)
    sn += n;
  }
  let div = textureLoad(srcDiv, cAtlas(c), 0).x;
  let pGS = (s - 16.0 * dom.voxel * dom.voxel * div) / sn;                       // Σ n_f (P_nb − P) = 2h²·Σdiv = 16h²·(Σdiv/8); sn ≥ 1 here
  textureStore(dstP, cAtlas(c), vec4f(finiteOr0(pc + (pGS - pc) * sim.omega), 0.0, 0.0, 0.0));
}

// ------------------------------------------------------------------ prolongation: coarse pressure → pA (fine), connectivity-aware trilinear
// One invocation per block writes its 8 fine children (they share the 27 blocks around it). srcP = the coarse pressure the sweeps left in the
// ping texture, srcObst = the packed face counts; dstP = pA, which project (and any fine smoothing pair) reads next. Solid fine cells get a
// value too — theirs is never read (project zeroes them, pAt mirrors past them).
// May the tap at block offset d (each component −1…1, not all 0) feed the home block's children? hm / tm = home / tap open-face masks;
// ghost = the tap lies past a domain face (open every way; the caller has already refused anything under a closed floor).
fn tapUsable(hm: u32, tm: u32, ghost: bool, d: vec3i) -> bool {
  if (!ghost && tm == 0u) { return false; }
  let fw = vec3u(select(0u, 1u, d.x > 0), select(2u, 3u, d.y > 0), select(4u, 5u, d.z > 0));   // home's face toward the tap, per axis
  let bk = fw ^ vec3u(1u);                                                                       // the tap's face back toward home
  let H = vec3<bool>(((hm >> fw.x) & 1u) != 0u, ((hm >> fw.y) & 1u) != 0u, ((hm >> fw.z) & 1u) != 0u);
  var T = vec3<bool>(true, true, true);
  if (!ghost) { T = vec3<bool>(((tm >> bk.x) & 1u) != 0u, ((tm >> bk.y) & 1u) != 0u, ((tm >> bk.z) & 1u) != 0u); }
  let m = u32(d.x != 0) + u32(d.y != 0) + u32(d.z != 0);
  if (m == 1u) { return (d.x != 0 && H.x) || (d.y != 0 && H.y) || (d.z != 0 && H.z); }        // face neighbour: an open pair across the shared face
  if (m == 2u) {                                                                                 // edge neighbour: out one axis and back in the other, either order
    if (d.x == 0) { return (H.y && T.z) || (H.z && T.y); }
    if (d.y == 0) { return (H.x && T.z) || (H.z && T.x); }
    return (H.x && T.y) || (H.y && T.x);
  }
  return H.x && H.y && H.z && T.x && T.y && T.z;                                                 // corner (weight ≤ 1/64): all three, both ends
}

@compute @workgroup_size(4, 4, 4)
fn prolongate(@builtin(global_invocation_id) gid: vec3u) {
  let C = vec3i(gid);
  if (!cIn(C)) { return; }
  let hK = blockWord(C);
  let hm = openMask(hK);
  // the 3×3×3 block neighbourhood, index (dz+1)·9 + (dy+1)·3 + (dx+1): pressure, and whether it may be blended in (1) or not (0)
  var pv: array<f32, 27>;
  var pw: array<f32, 27>;
  for (var k = 0; k < 27; k++) {
    let d = vec3i(k % 3, (k / 3) % 3, k / 9) - 1;
    let n = C + d;
    var v = 0.0; var w = 0.0;
    if (k == 13) { v = textureLoad(srcP, cAtlas(C), 0).x; w = select(0.0, 1.0, hm != 0u); }
    else if (cIn(n)) { if (tapUsable(hm, openMask(blockWord(n)), false, d)) { v = textureLoad(srcP, cAtlas(n), 0).x; w = 1.0; } }
    else if (!(n.y < 0 && dom.floorClosed != 0u)) { if (tapUsable(hm, 0u, true, d)) { w = 1.0; } }   // ghost past an open face: p = 0
    pv[k] = v; pw[k] = w;
  }
  let pc = pv[13];
  for (var ch = 0; ch < 8; ch++) {
    let a = vec3i(ch & 1, (ch >> 1) & 1, ch >> 2);   // child offset inside the block
    var sw = 0.0; var swp = 0.0;
    for (var t = 0; t < 8; t++) {
      let tb = vec3i(t & 1, (t >> 1) & 1, t >> 2);
      let off = a - 1 + tb;                                          // per axis: child 0 taps {−1, 0}, child 1 taps {0, +1}
      let w3 = select(vec3f(0.25), vec3f(0.75), tb != a);            // the offset-0 tap (the block itself) is the ¾ one on every axis
      let ki = (off.z + 1) * 9 + (off.y + 1) * 3 + (off.x + 1);
      let w = w3.x * w3.y * w3.z * pw[ki];
      sw += w; swp += w * pv[ki];
    }
    let p = select(pc, swp / sw, sw > 0.0);   // nothing usable: a fine cell buried in an obstacle — value irrelevant, keep it continuous
    textureStore(dstP, atlas(C * 2 + a), vec4f(finiteOr0(p), 0.0, 0.0, 0.0));
  }
}

// ------------------------------------------------------------------ clear both coarse pressure textures of this domain (dstP = ping, dstDiv = pong)
// Run when a domain is (re)placed and for every domain when the option goes on, so the warm start never inherits a stale slab.
@compute @workgroup_size(4, 4, 4)
fn clearCoarse(@builtin(global_invocation_id) gid: vec3u) {
  let C = vec3i(gid);
  if (!cIn(C)) { return; }
  textureStore(dstP, cAtlas(C), vec4f(0.0));
  textureStore(dstDiv, cAtlas(C), vec4f(0.0));
}
