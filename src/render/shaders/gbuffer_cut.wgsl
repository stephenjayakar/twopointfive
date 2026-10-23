// G-buffer raster of CUT BOXES (scene/cut.ts): appended to gbuffer.wgsl in a SECOND module that exists only in a build compiled with the cut switch
// (render/gbuffer.ts) — gbuffer.wgsl itself, and the plain boxes' pipeline, are untouched. A cut box is the convex solid
//   { |p| ≤ h }  ∩  { n_k · p ≤ d_k }   (box-local p; the planes in its CUT_ROWS plane rows of the cut table, common.wgsl cutPlaneRow)
// and is drawn as its PLANES: the box's six faces (the cube's 36 vertices, as vsBox) + one quad per cut plane, lying in that plane and big enough to cover the
// box's whole cross-section; the fragment stage then DISCARDS whatever lies outside the solid — a box-face fragment beyond any cut plane, a cut-face fragment
// outside the box or beyond another plane. Along a pixel's ray a convex solid is entered through exactly one of its planes, at a point inside all the others, so
// exactly one front-facing fragment survives per covered pixel (CUT_KEEP of slack keeps the shared edges closed) and the depth buffer holds the solid's true
// surface — the very surface common.wgsl isectCut reports to a ray. Everything else is fsBox: the material, the detail layer, markings (on the box's own faces
// only; so is the detail layer), decals, motion, and the GBAA edge distance — here also to the lines the cuts draw across a face.
// KEEP IN STEP with gbuffer.wgsl vsBox / fsBox: the bodies below are theirs plus the cut.

const CUT_KEEP: f32 = 2e-4;                   // metres of slack on every discard test (a fragment this far outside the solid still draws: closes the seams between a face and its neighbours)

struct BoxCutVOut {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) albedo: vec3f,
  @location(1) @interpolate(flat) normal: vec3f,
  @location(2) @interpolate(flat) id: u32,
  @location(3) wp: vec3f,
  @location(4) wpPrev: vec3f,
  @location(5) @interpolate(flat) mark: u32,
  @location(6) lc: vec3f,                                    // the fragment's box-local position: what the discard tests and the edge distances are measured in
  @location(7) @interpolate(flat) hf: vec4f,                 // half-extents + the face: 0‥5 a box face (as vsBox), −1 a section cap, 8 + k = cut plane k
};

@vertex fn vsBoxCut(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BoxCutVOut {
  let vw = visible[ii];
  let bi = vw & 0xFFFFu; let pslot = vw >> 16u;
  let b = boxGeo[bi];
  let c = b.c; let h = b.h;                                 // (a cut box is never a Cutaway box: that is the viewer stage's wall)
  let q = boxRot(bi);
  var lc: vec3f; var ln: vec3f; var face: f32; var dead = false; var cap = false;
  if (vi < 36u) {
    let f = vi / 6u;
    lc = cubeCorner(vi) * h; ln = cubeNormal(vi); face = f32(f);
    if (f == 2u && c.y + h.y >= CEIL_Y - 0.03 && c.y - h.y < CEIL_Y - 0.5) { cap = true; }   // (vsBox's section-cut rule for a top face flush under the ceiling slab)
  } else {
    let k = (vi - 36u) / 6u; let pl = cutPlaneRow(bi, k); let n = pl.xyz;
    face = 8.0 + f32(k); ln = n; lc = vec3f(0.0);
    if (dot(n, n) < 0.25) { dead = true; }                  // an unused row: no quad
    else {
      // a frame in the plane, u × v = n (counter-clockwise seen from outside, like the cube's faces): t = the box axis the normal leans on least
      let a = abs(n); var t = vec3f(0.0, 0.0, 1.0);
      if (a.x <= a.y && a.x <= a.z) { t = vec3f(1.0, 0.0, 0.0); } else if (a.y <= a.z) { t = vec3f(0.0, 1.0, 0.0); }
      let u = normalize(cross(t, n)); let v = cross(n, u);
      // the box lies within ±eu along u and ±ev along v of its centre, so the rectangle (n·d ± eu·u ± ev·v) covers its whole section by the plane
      let eu = dot(abs(u), h); let ev = dot(abs(v), h);
      var quad = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
      let qd = quad[(vi - 36u) % 6u];
      lc = n * pl.w + u * (qd.x * eu) + v * (qd.y * ev);
    }
  }
  let wp = c + quatRotate(q, lc);
  var o: BoxCutVOut;
  o.pos = frame.viewProj * vec4f(wp, 1.0);
  if (dead) { o.pos = vec4f(0.0, 0.0, -2.0, 1.0); }        // outside the clip volume: all six corners of an unused quad go
  o.normal = quatRotate(q, ln);
  o.albedo = boxAlbedo(bi);
  o.id = bi | (boxOwner(b) << 20u) | (select(0u, 1u, cap) << 29u);
  o.wp = wp;
  var wpPrev = wp;                                          // motion: vsBox's rules, word for word
  if (pslot == 0u) {
    let pg1 = prevBoxes[bi * 2u + 1u];
    if (all(bitcast<vec3f>(pg1.xyz) == b.h) && ((pg1.w ^ b.flags) & 0xFF00u) == 0u) {
      let pc = bitcast<vec3f>(prevBoxes[bi * 2u].xyz); let pq = bitcast<vec4f>(prevBoxes[PREV_MAT_BASE + bi * 4u + 2u]);
      wpPrev = pc + quatRotate(pq, lc);
    }
  } else if (pslot != 0xFFFFu) {
    let pi = pslot - 1u;
    let pg1 = prevBoxes[pi * 2u + 1u];
    if (all(abs(bitcast<vec3f>(pg1.xyz) - b.h) <= b.h * 0.02 + 1e-4)) {
      let pc = bitcast<vec3f>(prevBoxes[pi * 2u].xyz); let pq = bitcast<vec4f>(prevBoxes[PREV_MAT_BASE + pi * 4u + 2u]);
      wpPrev = pc + quatRotate(pq, lc);
    }
  }
  o.wpPrev = wpPrev;
  o.mark = select(markSlotOf(b.flags), 0u, vi >= 36u && !cutIsRound(bi));   // markings live on the box's own faces; a cut face shows the bare material (a ROUND's prism faces are one face: its marks run round it)
  o.lc = lc; o.hf = vec4f(h, select(face, -1.0, cap));
  return o;
}

/** ROUND THINGS (scene/round.ts; the core row's w carries ROUND_CORE_W): this record is the prism the picture stands round a round box — no ray reads it */
fn cutIsRound(bi: u32) -> bool { return (u32(max(cutCoreRow(bi).w, 0.0)) & 128u) != 0u; }

/** GBAA across a cut: one edge candidate — a line where `coord` (some linear function of the box-local position, screen gradient g per pixel) reaches `edge`.
 *  boxEdgeOffset's arithmetic per candidate: the perpendicular distance in pixels picks the nearest, which is stored along its major screen axis. */
fn cutEdgeTake(s0: f32, g: vec2f, best: ptr<function, f32>, d: ptr<function, vec2f>) {
  let l = length(g); if (l < 1e-8) { return; }
  let pd = abs(s0) / l;
  if (pd < *best) { *best = pd; if (abs(g.x) >= abs(g.y)) { *d = vec2f(s0 / g.x, 1.0); } else { *d = vec2f(1.0, s0 / g.y); } }
}

@fragment fn fsBoxCut(v: BoxCutVOut) -> GOut {
  var o: GOut;
  var albedo = v.albedo; var n = normalize(v.normal); var keep = 1.0;
  let dwx = dpdx(v.wp); let dwy = dpdy(v.wp);
  let dlx = dpdx(v.lc); let dly = dpdy(v.lc);
  let bi = v.id & 0xFFFFFu; let cap = ((v.id >> 29u) & 1u) != 0u;
  // ---- the cut: is this fragment on the solid? + the nearest edge of the face it lies on, for GBAA (the box's own edges and the lines the planes draw)
  let h = v.hf.xyz; let own = i32(v.hf.w + 0.5) - 8;        // ≥ 0: this fragment lies on cut plane `own`; < 0: on a box face
  var gone = false; var best = 1e9; var ed = vec2f(1.0, 1.0);
  for (var k = 0; k < i32(CUT_ROWS); k++) {
    let pl = cutPlaneRow(bi, u32(k));
    if (dot(pl.xyz, pl.xyz) < 0.25) { break; }
    if (k == own) { continue; }
    let s = pl.w - dot(pl.xyz, v.lc);                       // metres inside plane k (negative = cut away)
    if (s < -CUT_KEEP) { gone = true; }
    cutEdgeTake(s, vec2f(dot(pl.xyz, dlx), dot(pl.xyz, dly)), &best, &ed);
  }
  let fax = select(i32(v.hf.w + 0.5) / 2, -1, own >= 0);    // the box face's own axis (its coordinate is constant across the face: no edge along it); −1 on a cut face
  for (var a = 0; a < 3; a++) {
    if (a == fax) { continue; }
    if (own >= 0 && abs(v.lc[a]) > h[a] + CUT_KEEP) { gone = true; }
    let g = vec2f(dlx[a], dly[a]);
    cutEdgeTake(h[a] - v.lc[a], g, &best, &ed); cutEdgeTake(-h[a] - v.lc[a], g, &best, &ed);
  }
  // ---- fsBox's body
  var rough = 1.0; var metal = 0.0;
  if (!cap) { let fin = boxFinish(bi); rough = fin.rough; metal = select(0.0, 1.0, fin.metal); }
  // a cut face shows the CORE (Box.cutCore: the gypsum under the paint), matte; none = the box's own colour and finish.
  // GLASS (Box.cutGlass, the core row's w: scene/cut.ts packCut): the box's two faces across its own z (a glass plate is thin along z: cutPrism) are a SCREEN DOOR — a share of their pixels is left to what is behind, fewer
  // toward a grazing view (a sheet seen edge-on mirrors) — inside a rim, which with the cut faces and the box's side faces shows the core: the bright edge of sheet
  // glass. The pattern is per pixel, stepped along the TAAU jitter's cycle when asked, so the resolve averages the door to a tint. Picture only.
  let core = cutCoreRow(bi); let cw = u32(max(core.w, 0.0));
  // ROUND THINGS (scene/round.ts): the prism's faces round the box's own y are ONE round face to the picture. Their normal points straight out from the axis at
  // the fragment (the silhouette keeps the prism's twelve flats; every ray meets the cylinder inside it — common.wgsl isectRound), marks read them as the box
  // face that normal leans to, and the lid gets the rolled rim of a drum's. Picture only.
  var side = false;
  if ((cw & 128u) != 0u && !cap) {
    let q = boxRot(bi); let ln = quatRotate(vec4f(-q.xyz, q.w), n);
    let rl = length(v.lc.xz);
    if (abs(ln.y) < 0.5 && rl > 1e-4) { side = true; n = quatRotate(q, vec3f(v.lc.x, 0.0, v.lc.z) / rl); }
    else if (ln.y > 0.5) {
      let d = h.x - rl;                                      // metres in from the round's edge
      albedo *= 1.0 - 0.45 * smoothstep(0.012, 0.02, d) * (1.0 - smoothstep(0.03, 0.042, d));
    }
  }
  var edge = own >= 0 && !side;
  if ((cw & 2u) != 0u && own < 0 && !cap) {
    if (fax != 2 || best < f32(cw >> 3u) * 0.25) { edge = true; }
    else {
      let see = fract(core.w);
      let ndv = abs(dot(n, normalize(frame.camPos - v.wp))); let fres = pow(saturate(1.0 - ndv), 5.0);
      // the door's threshold per pixel: interleaved gradient noise, stepped along the TAAU jitter's cycle — the jitter's x is the base-2 radical inverse of the
      // phase index (engine.ts halton; it rides in frame.jitter, or in sharpCfgC when the output raster is the unjittered one), so its reversed bits are that index.
      // STRATIFIED IN EIGHTHS: the step is the index's low three bits reversed, over 8, and the share let through is rounded to eighths — so in ANY eight frames
      // running every pixel lets through exactly the same count, m of 8. (The golden-ratio walk it replaces left each pixel 3 or 4 of 8 by its own noise value: a
      // fixed weave the resolve never averaged away however long the view stood still.) What is left is the order within the eight, a ripple the resolve's
      // running mean holds under half of what the weave was. The grazing-view rise (a sheet seen edge-on mirrors) is a second, still pattern: only there.
      // (sharp direct WITHOUT the decoupled jitter scales that jitter: the index is then not recovered and the door averages less evenly — no preset runs that way)
      let ign0 = fract(52.9829189 * fract(dot(floor(v.pos.xy), vec2f(0.06711056, 0.00583715))));
      if ((cw & 4u) != 0u) {
        let j = (reverseBits(u32(clamp(frame.jitter.x + frame.sharpCfgC.x + 0.5, 0.0, 0.999) * 256.0 + 0.5)) >> 24u) & 7u;
        let step = f32(((j & 1u) << 2u) | (j & 2u) | ((j >> 2u) & 1u)) * 0.125;
        if (fract(ign0 + step) < floor(see * 8.0 + 0.5) * 0.125 && fract(ign0 * 7.137 + 0.371) >= fres) { gone = true; }
      } else if (ign0 < see * (1.0 - fres)) { gone = true; }
    }
  }
  if (edge && (cw & 1u) != 0u) { albedo = core.rgb; rough = 1.0; metal = 0.0; }
  if (frame.matCfg.w > 0.0 && !cap && own < 0 && !side) {   // (the detail layer reads the box's own faces — edge wear, the skirting band: a cut face shows the bare material, and so does a round's side)
    let dt = detailSurface(v.wp, n, bi, albedo, rough, metal, frame.matCfg.w);
    albedo = dt.albedo; rough = dt.rough; metal = dt.metal;
  }
  if (v.mark != 0u && !cap && (own < 0 || side)) {
    let mk = markSurfaceGB(v.mark, bi, v.wp, n, dwx, dwy, albedo, rough);
    albedo = mk.albedo; rough = mk.rough;
  }
  if ((frame.flags & FLAG_DECALS) != 0u) {
    let fp = distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y;
    var d = decalSurface(v.wp, n, v.id & 0xFFFFFu, albedo, fp);
    for (var r = 1u; r < DECAL_REPEAT; r++) { d = decalSurface(v.wp, n, v.id & 0xFFFFFu, albedo, fp); }   // (measurement only, as fsBox: render/decals.ts decalDebug)
    albedo = d.albedo; n = d.n; keep = d.keep;
  }
  if (gone) { discard; }
  o.albedo = vec4f(albedo, keep);
  o.normal = vec4f(n * 0.5 + 0.5, 1.0);
  o.id = v.id;
  o.vel = motionOf(v.wp, v.wpPrev);
  o.mat = vec2f(rough, metal);
  let lim = 1.0 - 1.0 / 128.0;                              // boxEdgeOffset's encode
  o.edge = select(select(clamp(ed, vec2f(-lim), vec2f(lim)), vec2f(1.0), abs(ed) >= vec2f(1.0)) * 0.5 + 0.5, EDGE_NONE, v.hf.w < 0.0);
  return o;
}
