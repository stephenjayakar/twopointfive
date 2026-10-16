// SHARP DIRECT — the direct light's UNSHADOWED term at the OUTPUT resolution (docs/internal/sharp-direct.md).
// Direct light = U × visibility. U — every light's analytic contribution at the pixel: cone, falloff, N·L, emitter shape (evalLight) — is exact and
// history-free wherever it is evaluated, and it is where every HARD edge of the direct term lives (light-pool boundaries, cone edges, the lit / unlit
// break at a box corner); visibility is the stochastic part (shadow rays → the ratio-space denoiser), soft by nature except at contact. So this pass
// re-scores U per OUTPUT pixel off the output-size g-buffer — the SAME statements the internal-resolution estimator runs (direct.wgsl / restir.wgsl:
// stage the light list, cull it to the 8×8 tile's box losslessly, evalLight every survivor, split by emitter class) — and multiplies it by the
// visibility RATIO r̂ = S ∕ U the internal pass + its denoiser settled on, joint-bilateral upsampled from the 2×2 internal texels round the pixel
// (bilinear × same-plane × same-orientation; the ratio taken as Σw·S ∕ Σw·U — the U-weighted mean of the taps' own ratios, so a tap outside this
// light's footprint, U = 0, simply has no say). Output per class: E_c = U_c(out) ⊙ r̂_c → what composite reads as directTex / softTex at ITS pixel.
// EDGE RAYS (const EDGE_RAYS — settings.sharpEdgeRays picks the pipeline; frame.sharpCfgB.yzw are its knobs): the one place the internal ratio is not enough is a HARD shadow edge from a small emitter — a keyboard's contact shadow
// under a desk lamp — which the taps can only place to the internal pixel, and whose thin umbra the ratio's blur erodes. Where any on-surface tap of the
// 2×2 is flagged in the hard-edge mask (sharp_edge.wgsl: the class's ratio ranges by more than sharpCfgB.y within ±2 internal px with no penumbra hint
// wider than sharpCfgB.z px near) and one emitter carries most of the class at the pixel, ONE deterministic shadow ray from this output pixel to that
// emitter's CENTRE decides its share exactly (binary at the output resolution — the raster's jitter and the TAA antialias it like any geometric edge)
// and only the class's remainder rides on the upsampled ratio. A few per cent of the pixels of a frame sit on such an edge; everywhere else no ray is spent.
// SLIVERS (lane v3/direct-quality, docs/internal/direct-quality.md; frame.sharpCfgC.z & 3 = settings.sharpSliver): an output pixel none of whose 4×4 internal texels lies on its surface — a
// door frame's 4-cm reveal, a chair leg, the edge of a limb, a contact line the internal raster stepped over — has NO measured visibility of its own. Rule 0 (the path as it was) borrowed
// the 2×2's ratio whatever those texels show: a lit floor lent 'lit' to the occluded underside of a desk's lip, the lit wall beside a door lent it to the reveal the leaf shadows — thin
// bright lines exactly where the picture is darkest, and per channel, so a neighbour under another light mix lent its hue too. Rule 1 borrows NOTHING across surfaces: per emitter
// class ONE deterministic shadow ray from the output pixel to the centre of the class's strongest live emitter decides that light exactly, and only the class's remainder rides on the
// neighbours' LUMINANCE ratio, taken as the darker of (that ratio, lit) — the same texels and the same rule for both classes. At most sharpCfgC.z >> 8 sliver pixels per 8×8 tile
// trace (ranked in lane order — deterministic); the rest keep the conservative remainder rule for the whole class. The fallback CODE rides out in outE0.a for the harness to count
// (0 = the 2×2 had on-surface taps, 1 = only the outer ring had, 2 = sliver, +4 = its rays were traced, +8 = a class read 'unshadowed' for want of any tap holding its light, +16 / +32 =
// the ray found dark / lit what the neighbours would have lent the other way by over a quarter of the pixel's live U — the census of leaks the old rule drew) — composite
// reads .rgb only. sharpCfgC.z >> 4 & 3 = diagnostic PAINT: 1 = slivers magenta / ring pixels yellow in the direct term, 2 = only the slivers whose ray overturned the borrowed ratio.
// HIDDEN LIGHT (frame.sharpCfgC.z bit 15 = settings.dnShadowOccl, the shadow denoiser's occluded-light reading carried up to the output raster; off = the pass as it was): U counts a carried
// light the surface does not see (a guard's torch beyond a wall), so across the outer edge of ITS cone the taps' ratio S ∕ U falls a hundredfold while their S stands still — and
// U_out × Σw·S ∕ Σw·U draws that edge as a thin line on the far side of the wall (the taps' mean U is not this pixel's U where the cone's onset curves between them). The taps
// themselves tell the two cases apart: the slope of ln S against ln U over them is 1 where the ratio stands (a visible light's falloff or cone edge) and 0 where S stands; the
// class's value is the mix, by that slope, of the upsampled-ratio value and the taps' own mean S. Taps alike in U (nearly everywhere) leave the ratio value untouched.
// Group 0 is the OUTPUT frame block (frame.screen = the output size, worldFromDepth takes output pixels); the internal size is textureDimensions(iDepth).
// (direct_common.wgsl is prepended: lightReachesBox for the tile cull, shadowSample for the edge / sliver rays. `EDGE_RAYS` is a const passes.ts prepends: the pass is compiled twice so the
//  default pipeline carries no tracer at all — the traced one is dispatched while settings.sharpEdgeRays or settings.sharpSliver asks for rays; the edge MASK is read only while
//  frame.sharpCfgB.x says the mask kernel ran this frame.)
@group(1) @binding(0) var oDepth: texture_depth_2d;      // OUTPUT-size g-buffer: depth, packed normal
@group(1) @binding(1) var oNormal: texture_2d<f32>;
@group(1) @binding(2) var iDepth: texture_depth_2d;      // its INTERNAL view (gdown.wgsl: internal texel i ≡ output texel ⌊(i + ½)·out∕in⌋)
@group(1) @binding(3) var iNormal: texture_2d<f32>;
@group(1) @binding(4) var iS0: texture_2d<f32>;         // internal, per class: the DENOISED shadowed estimate S (rgb; a = the blur hint) …
@group(1) @binding(5) var iS1: texture_2d<f32>;
@group(1) @binding(6) var iU0: texture_2d<f32>;         // … and the exact unshadowed U it is a fraction of
@group(1) @binding(7) var iU1: texture_2d<f32>;
@group(1) @binding(8) var outE0: texture_storage_2d<rgba16float, write>;   // OUTPUT, per class: rgb = U(out) × r̂, a = 0
@group(1) @binding(9) var outE1: texture_storage_2d<rgba16float, write>;
@group(1) @binding(10) var oId: texture_2d<u32>;         // OUTPUT-size id (the owner byte: an edge ray from a man's pixel ignores his own proxies, as every shadow ray does)
@group(1) @binding(11) var iEdge: texture_2d<u32>;       // internal: the hard-edge mask (sharp_edge.wgsl), bit 0 sharp class, bit 1 broad

var<workgroup> wgLights: array<Light, 64>;
var<workgroup> wgP: array<vec4f, 64>;
var<workgroup> wgRowMin: array<vec4f, 8>;
var<workgroup> wgRowMax: array<vec4f, 8>;
var<workgroup> wgKeep: array<u32, 64>;
var<workgroup> wgList: array<u32, 64>;
var<workgroup> wgCount: u32;
var<workgroup> wgSliver: array<atomic<u32>, 2>;   // SLIVERS: the tile's ballot — bit lidx = 'a sliver that wants its rays' (rank in lane order against the per-tile cap)

const SHARP_NORMAL_POW: f32 = 8.0;    // same-orientation weight (the composite's indirect upsample uses the same power); the same-plane weight's k is frame.sharpCfgB.w (0.01: a tap a centimetre off this pixel's tangent plane per metre of view distance still weighs 0.37)

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32, @builtin(global_invocation_id) gid: vec3u) {
  let nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  let dims = textureDimensions(oDepth);
  let gxy = gid.xy;
  let onScreen = gxy.x < dims.x && gxy.y < dims.y;
  var depth = 1.0;
  if (onScreen) { depth = textureLoad(oDepth, gxy, 0); }
  let live = onScreen && depth < 1.0 && (frame.flags & FLAG_DIRECT) != 0u;
  let pix = vec2f(gxy) + 0.5;
  let P = worldFromDepth(pix, depth);
  // ---- SLIVER config (frame.sharpCfgC.z: rule | paint << 4 | per-tile ray cap << 8 — an exact small integer) ----
  let cfgZ = u32(frame.sharpCfgC.z + 0.5);
  let sliverRule = cfgZ & 3u; let sliverPaint = (cfgZ >> 4u) & 3u; let sliverCap = (cfgZ >> 8u) & 127u;
  let occlFit = ((cfgZ >> 15u) & 1u) != 0u;                    // HIDDEN LIGHT (header; settings.dnShadowOccl)
  if (lidx < 2u) { atomicStore(&wgSliver[lidx], 0u); }   // (ordered before any lane's vote by the light-list barriers below)
  // ---- the tile's light list: direct.wgsl's lossless cull, statement for statement (a light off the list scores !ok at every live pixel of the tile) ----
  let tileCull = (frame.flags & FLAG_TILECULL) != 0u;
  var nIter = nL;
  if (tileCull) {
    wgP[lidx] = vec4f(P, select(0.0, 1.0, live));
    workgroupBarrier();
    if (lidx < 8u) {
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = 0.0;
      for (var k = 0u; k < 8u; k++) { let q = wgP[lidx * 8u + k]; if (q.w > 0.0) { mn = min(mn, q.xyz); mx = max(mx, q.xyz); anyLive = 1.0; } }
      wgRowMin[lidx] = vec4f(mn, anyLive); wgRowMax[lidx] = vec4f(mx, anyLive);
    }
    workgroupBarrier();
    if (lidx < nL) {
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = false;
      for (var r = 0u; r < 8u; r++) { let a = wgRowMin[r]; if (a.w > 0.0) { mn = min(mn, a.xyz); mx = max(mx, wgRowMax[r].xyz); anyLive = true; } }
      wgKeep[lidx] = select(0u, 1u, anyLive && lightReachesBox(wgLights[lidx], mn, mx));
    }
    workgroupBarrier();
    if (lidx == 0u) { var n = 0u; for (var i = 0u; i < nL; i++) { if (wgKeep[i] != 0u) { wgList[n] = i; n++; } } wgCount = n; }
    workgroupBarrier();
    nIter = wgCount;
  } else {
    workgroupBarrier();   // wgLights staged
  }
  var U0 = vec3f(0.0); var U1 = vec3f(0.0);
  var Uw0 = vec3f(0.0); var Uw1 = vec3f(0.0);   // the part of U from lights the reach masks wall off from this cell — in U (as in the estimators') but known dark: the live lights' visibility is E ∕ (U − Uw)
  var E0 = vec3f(0.0); var E1 = vec3f(0.0);
  var topW = array<f32, 2>(0.0, 0.0); var topI = array<i32, 2>(-1, -1); var topE = array<vec3f, 2>(vec3f(0.0), vec3f(0.0));   // the strongest reaching light per class at this pixel (the edge / sliver ray's candidate)
  var N = vec3f(0.0, 1.0, 0.0);
  var code = 0u;                                             // SLIVERS: the fallback code that rides out in outE0.a (header)
  var wantsRays = false;                                     // a sliver under rule 1 with a live light to decide (voted into the tile's ballot below)
  var remR = vec2f(1.0);                                     // rule 1: the ratio the class's REMAINDER (everything but the rayed light) rides on, per class
  if (live) {
    N = normalize(textureLoad(oNormal, gxy, 0).xyz * 2.0 - 1.0);
    // ---- U per class at THIS output pixel: the estimators' scoring loop (same order, same early-outs; walled-off lights stay in U here as there) ----
    for (var s = 0u; s < nIter; s++) {
      var i = s; if (tileCull) { i = wgList[s]; }
      let li = wgLights[i];
      let ev = evalLight(li, P, N);
      if (!ev.ok) { continue; }
      let w = luminance(ev.E);
      if (w < 1e-4) { continue; }
      let c = select(0u, 1u, lightBroad(li));
      if (c == 1u) { U1 += ev.E; } else { U0 += ev.E; }
      if (lightReachLevel(i, P) == 0u) { if (c == 1u) { Uw1 += ev.E; } else { Uw0 += ev.E; } continue; }   // walled off from this cell: known dark — in U, never the ray's target
      if (w > topW[c]) { topW[c] = w; topI[c] = i32(i); topE[c] = ev.E; }
    }
    // ---- the visibility ratio from the internal estimate: joint-bilateral over the 2×2 internal texels round this pixel (a 4×4 search if none of them lies on this surface) ----
    let z = distance(P, frame.camPos);
    let inDims = vec2i(textureDimensions(iDepth));
    let sIn = pix * frame.sharpCfg.xy / frame.sharpCfg.zw + frame.sharpCfgC.xy - 0.5;   // this pixel's position on the internal texel lattice (texel i's centre sits at i; + the DECOUPLED jitter the internal raster carries, 0 without it)
    let base = vec2i(floor(sIn)); let fr = sIn - vec2f(base);
    var accS0 = vec3f(0.0); var accU0 = vec3f(0.0); var accS1 = vec3f(0.0); var accU1 = vec3f(0.0); var ws = 0.0;   // (the ratio is Σw·S ∕ Σw·U per class; ws normalises the sums for the ratio's guards, which compare them against this pixel's own U)
    var fit0 = Fit(vec4f(0.0), 0.0); var fit1 = Fit(vec4f(0.0), 0.0);   // HIDDEN LIGHT (header): how far the taps' S follows their U, per class
    var edgeBits = 0u;                                        // hard-edge mask bits of the 2×2's on-surface taps (edge rays)
    var nGood = 0u;                                           // taps that lie on THIS surface (plane × orientation above 0.1): the outer ring is searched only if the 2×2 has none, the nearest-texel fallback only if neither has
    let edgeMask = EDGE_RAYS && frame.sharpCfgB.x > 0.0;      // (the mask kernel ran this frame — else iEdge is stale and never read)
    for (var ring = 0u; ring < 2u && nGood == 0u; ring++) {
      let lo = select(0, -1, ring == 1u); let hi = select(1, 2, ring == 1u);
      for (var dy = lo; dy <= hi; dy++) {
        for (var dx = lo; dx <= hi; dx++) {
          if (ring == 1u && dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) { continue; }   // (the inner 2×2 had no on-surface tap and added nothing: only the ring round it)
          let t = clamp(base + vec2i(dx, dy), vec2i(0), inDims - 1);
          let d = textureLoad(iDepth, t, 0);
          if (d >= 1.0) { continue; }
          let Pt = worldFromDepth(vec2f(sharpOutTexel(t)) + 0.5, d);   // that internal texel's own point: the centre of the OUTPUT texel it was copied from (gdown.wgsl), at its depth — an exact plane test
          let nt = textureLoad(iNormal, t, 0).xyz * 2.0 - 1.0;
          let geo = exp(-abs(dot(Pt - P, N)) / max(z * frame.sharpCfgB.w, 0.02)) * pow(max(dot(nt, N), 0.0), SHARP_NORMAL_POW);   // same plane × same orientation
          if (geo <= 0.1) { continue; }                          // not this surface: no say at all (a lone on-surface corner then carries the pixel by itself)
          var w = geo;
          if (ring == 0u) { w *= max(select(fr.x, 1.0 - fr.x, dx == 0), 0.02) * max(select(fr.y, 1.0 - fr.y, dy == 0), 0.02); }   // × bilinear (floored so a lone valid corner still has a weight to carry it with)
          else { w *= 0.25; }
          let tS0 = textureLoad(iS0, t, 0).rgb; let tU0 = textureLoad(iU0, t, 0).rgb; let tS1 = textureLoad(iS1, t, 0).rgb; let tU1 = textureLoad(iU1, t, 0).rgb;
          accS0 += tS0 * w; accU0 += tU0 * w;
          accS1 += tS1 * w; accU1 += tU1 * w;
          ws += w; nGood += 1u;
          if (occlFit) { fit0 = fitAdd(fit0, luminance(tS0), luminance(tU0), w); fit1 = fitAdd(fit1, luminance(tS1), luminance(tU1), w); }
          if (edgeMask && ring == 0u) { edgeBits |= textureLoad(iEdge, t, 0).x; }   // every on-surface tap of the 2×2 votes, whatever its bilinear share (else the verdict would follow the pixel's phase in the cell)
        }
      }
      if (ring == 1u && nGood > 0u) { code = 1u; }             // (only the outer ring lay on this surface)
    }
    if (nGood == 0u) {   // no texel of the 4×4 lies on this surface — a SLIVER the internal raster never sampled: the plain bilinear blend of the 2×2, surface test waived (rule 0 rides on it per channel as
      code = 2u;         // it always did; rule 1 takes only its per-class LUMINANCE ratio, and only for the class's remainder — header)
      for (var dy = 0; dy <= 1; dy++) { for (var dx = 0; dx <= 1; dx++) {
        let t = clamp(base + vec2i(dx, dy), vec2i(0), inDims - 1);
        let w = select(fr.x, 1.0 - fr.x, dx == 0) * select(fr.y, 1.0 - fr.y, dy == 0) + 1e-4;
        accS0 += textureLoad(iS0, t, 0).rgb * w; accU0 += textureLoad(iU0, t, 0).rgb * w; accS1 += textureLoad(iS1, t, 0).rgb * w; accU1 += textureLoad(iU1, t, 0).rgb * w; ws += w;
      } }
    }
    let iw = 1.0 / max(ws, 1e-6);   // (the guards inside compare against this pixel's own U: hand them means, not weighted sums)
    if (code == 2u && sliverRule >= 1u) {
      // ---- rule 1: nothing borrowed across surfaces. The remainder's ratio per class = the neighbours' luminance ratio, ≤ 1 (walled-off share and all: it errs dark); a class whose light
      // the neighbours hold none of (a thin face lit by what its surround faces away from) has no neighbour verdict at all — its rayed light's own visibility stands in below, ½ if no ray ----
      let liveU0 = max(U0 - Uw0, vec3f(0.0)); let liveU1 = max(U1 - Uw1, vec3f(0.0));
      let lu0 = luminance(accU0 * iw); let lu1 = luminance(accU1 * iw);
      remR = vec2f(select(min(luminance(accS0 * iw) / max(lu0, 1e-6), 1.0), -1.0, lu0 < 1e-5 * max(luminance(U0), 1e-6)),
                   select(min(luminance(accS1 * iw) / max(lu1, 1e-6), 1.0), -1.0, lu1 < 1e-5 * max(luminance(U1), 1e-6)));   // (−1 = no verdict yet)
      wantsRays = EDGE_RAYS && sliverCap > 0u && (topI[0] >= 0 || topI[1] >= 0);
      E0 = liveU0 * select(remR.x, 0.5, remR.x < 0.0); E1 = liveU1 * select(remR.y, 0.5, remR.y < 0.0);   // the conservative whole-class value; the rays below re-decide the strongest light's share
    } else {
      let sr0 = sharpRatio(accS0 * iw, accU0 * iw, U0); let sr1 = sharpRatio(accS1 * iw, accU1 * iw, U1);
      E0 = U0 * sr0.xyz; E1 = U1 * sr1.xyz;
      if (occlFit) {   // HIDDEN LIGHT: where the taps' U differs and their S does not follow it, what differs is light the surface does not see — S is carried across, not the ratio
        let hiR = select(1.0, 4.0, (frame.flags & (FLAG_RESTIR | FLAG_TAIL_CHROMA)) != 0u);
        E0 = mix(min(accS0 * iw, U0 * hiR), E0, fitSlope(fit0)); E1 = mix(min(accS1 * iw, U1 * hiR), E1, fitSlope(fit1));
      }
      if (sr0.w > 0.0 || sr1.w > 0.0) { code |= 8u; }         // (a class read 'unshadowed' for want of any tap holding its light — counted, not changed)
      // ---- edge rays: a hard shadow edge of a class between the taps → its strongest emitter decided by ONE centre ray from this output pixel ----
      if (EDGE_RAYS && edgeBits != 0u) {
        let owner = (textureLoad(oId, gxy, 0).x >> 20u) & 0xffu;
        let Po = P + N * 0.015;
        for (var c = 0u; c < 2u; c++) {
          let liveU = max(select(U0 - Uw0, U1 - Uw1, c == 1u), vec3f(0.0));   // the class's LIVE unshadowed light here (walled-off lights are dark by proof, not by ratio)
          if ((edgeBits & (1u << c)) == 0u || topI[c] < 0) { continue; }      // no hard edge of this class near, or nothing reaches
          if (topW[c] < 0.35 * luminance(liveU)) { continue; }                 // no single emitter to pin the edge on
          let li = wgLights[u32(topI[c])];
          let vs = shadowSample(li, Po, N, owner, 0u, 1u, vec2f(0.0));   // sample 0 of 1 at u0 = 0: the emitter's centre → (visibility incl. smoke, ·)
          var vt = vec3f(vs.x);
          if (vs.x > 0.0) { let gm = lightGlassMask(li); if (gm != 0u) { vt = vs.x * glassVis(li, gm, P); } }   // lit through a pane: tinted, as both estimators tint a lit leader
          let E = select(E0, E1, c == 1u);
          let rest = max(liveU - topE[c], vec3f(0.0));
          let Ec = topE[c] * vt + clamp(E - topE[c] * vt, vec3f(0.0), rest);   // ONLY the strongest emitter's share is the ray's; the remainder keeps the taps' word (exact wherever ray and taps agree — the ray acts only where they differ), never above its unshadowed total, the walled-off part at its true 0
          if (c == 0u) { E0 = Ec; } else { E1 = Ec; }
        }
      }
    }
  }
  // ---- SLIVER rays (rule 1, the traced pipeline): the tile's ballot in uniform control flow, then per class one deterministic ray to the strongest live emitter's centre ----
  var overturn = 0.0;                                          // paint 2: how far the ray moved the class off the borrowed ratio (signed: + = the ray found light the neighbours called dark)
  if (EDGE_RAYS) {
    if (wantsRays) { atomicOr(&wgSliver[lidx >> 5u], 1u << (lidx & 31u)); }
    workgroupBarrier();
    if (wantsRays) {
      let m0 = atomicLoad(&wgSliver[0]); let m1 = atomicLoad(&wgSliver[1]);
      let below = (1u << (lidx & 31u)) - 1u;
      let rank = select(countOneBits(m0 & below), countOneBits(m0) + countOneBits(m1 & below), lidx >= 32u);
      if (rank < sliverCap) {
        code |= 4u;
        let owner = (textureLoad(oId, gxy, 0).x >> 20u) & 0xffu;   // (a ray from a man's own sliver ignores his proxies, as every shadow ray of his does)
        let Po = P + N * 0.015;
        for (var c = 0u; c < 2u; c++) {
          if (topI[c] < 0) { continue; }
          let liveU = max(select(U0 - Uw0, U1 - Uw1, c == 1u), vec3f(0.0));
          let li = wgLights[u32(topI[c])];
          let vs = shadowSample(li, Po, N, owner, 0u, 1u, vec2f(0.0));   // the emitter's centre: binary at the output resolution and rock-still (the output raster carries no jitter under the decoupled path)
          var vt = vec3f(vs.x);
          if (vs.x > 0.0) { let gm = lightGlassMask(li); if (gm != 0u) { vt = vs.x * glassVis(li, gm, P); } }
          var rr = remR[c]; if (rr < 0.0) { rr = vs.x; }             // no neighbour verdict for this class: the rayed light's own visibility stands in for its remainder
          let Ec = topE[c] * vt + max(liveU - topE[c], vec3f(0.0)) * rr;
          overturn += (vs.x - select(remR[c], 0.5, remR[c] < 0.0)) * luminance(topE[c]);
          if (c == 0u) { E0 = Ec; } else { E1 = Ec; }
        }
      }
    }
  }
  { let ou = 0.25 * max(luminance(U0 + U1 - Uw0 - Uw1), 1e-4); if (overturn < -ou) { code |= 16u; } else if (overturn > ou) { code |= 32u; } }   // census bits: 16 = the ray found DARK what the neighbours would have lent lit (a leak under rule 0), 32 = the reverse
  if (sliverPaint == 1u && (code & 3u) != 0u) { E0 = select(vec3f(5.0, 5.0, 0.0), vec3f(6.0, 0.0, 6.0), (code & 3u) == 2u); E1 = vec3f(0.0); }   // paint 1: slivers magenta, ring-only pixels yellow
  if (sliverPaint == 2u && (code & 48u) != 0u) { E0 = select(vec3f(0.0, 5.0, 6.0), vec3f(7.0, 0.0, 0.0), (code & 16u) != 0u); E1 = vec3f(0.0); }   // paint 2: red = the ray found DARK what the neighbours lent lit (a leak the old rule drew), cyan = the reverse
  if (onScreen) {
    textureStore(outE0, gxy, vec4f(E0, f32(code)));
    textureStore(outE1, gxy, vec4f(E1, 0.0));
  }
}

/** HIDDEN LIGHT: one tap into a class's log–log fit of S against U over the taps (m = Σw·(x, y, x², x·y) with x = ln U, y = ln S; n = Σw). A tap that holds none of the class's light, or no S of it, stays out. */
struct Fit { m: vec4f, n: f32 };
fn fitAdd(f: Fit, s: f32, u: f32, w: f32) -> Fit {
  if (u < 1e-5 || s < 1e-6) { return f; }
  let x = log(u); let y = log(s);
  return Fit(f.m + vec4f(x, y, x * x, x * y) * w, f.n + w);
}
/** … and its slope 0‥1: 1 = the taps' S follows their U (the ratio stands: a visible light's falloff or cone edge — and wherever their U is alike within a few per cent, where there is
 *  nothing to tell and nothing to correct), 0 = their S stands whatever their U does (the light that differs is one the surface does not see). */
fn fitSlope(f: Fit) -> f32 {
  if (f.n <= 0.0) { return 1.0; }
  let mx = f.m.x / f.n; let my = f.m.y / f.n;
  let vx = f.m.z / f.n - mx * mx;
  let b = clamp((f.m.w / f.n - mx * my) / max(vx, 1e-8), 0.0, 1.0);
  return mix(1.0, b, smoothstep(4e-4, 4e-3, vx));
}
/** r̂ per channel for one class: Σw·S ∕ Σw·U over the taps, clamped like the denoiser's ratio (≤ 1, or ≤ 4 under the per-light hues of ReSTIR / the chroma-exact tail). A channel this pixel
 *  is lit in (Uo) but the taps hold next to none of (a coloured light's footprint finer than the internal raster) takes the taps' LUMINANCE ratio instead of a 0∕0; taps that hold no light
 *  of the class at all (the class reaches this pixel and none of them) read unshadowed — nothing nearer knows better (.w = 1 when that default fired, for the diagnostic count). */
fn sharpRatio(S: vec3f, U: vec3f, Uo: vec3f) -> vec4f {
  let hiR = select(1.0, 4.0, (frame.flags & (FLAG_RESTIR | FLAG_TAIL_CHROMA)) != 0u);
  let lU = luminance(U);
  let none = lU < 1e-5 * max(luminance(Uo), 1e-6);
  let rl = select(clamp(luminance(S) / max(lU, 1e-6), 0.0, hiR), 1.0, none);
  let thin = U < max(Uo * 0.05, vec3f(1e-6));
  return vec4f(select(clamp(S / max(U, vec3f(1e-6)), vec3f(0.0), vec3f(hiR)), vec3f(rl), thin), select(0.0, 1.0, none && luminance(Uo) > 1e-4));
}
/** the OUTPUT texel internal texel `t` was copied from (gdown.wgsl's mapping — the same expression on the same operands, so the same texel: frame.sharpCfg rides in both frame blocks) */
fn sharpOutTexel(t: vec2i) -> vec2i { return vec2i(clamp((vec2f(t) + 0.5 - frame.sharpCfgC.xy) * frame.sharpCfg.zw / frame.sharpCfg.xy, vec2f(0.0), frame.sharpCfg.zw - 1.0)); }   // (gdown.wgsl outTexelOf, operand for operand — incl. the decoupled jitter)
