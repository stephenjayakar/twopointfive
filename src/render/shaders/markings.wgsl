// MARKINGS (scene/markings.ts is the reference and the argument; this is its GPU half). Palette-indexed BITMAPS on box faces: for a marked box (the 1-based
// table ROW of its first record rides in bits 18‥31 of the flags word) up to 4 records in the tail of boxMat, each = header rows (where on which face, the
// coverage fractions, three MATERIAL entries: albedo + roughness + emitted radiance) + cell rows (2 bits a cell, 12 cells a float as an exact small integer,
// 48 a vec4 row), laid on a world-space lattice anchored at the face centre (frame.markCfg.x metres × ½ / 1 / 2 by the record's res). Evaluated
// ANALYTICALLY — no texture, no sampler: cell = floor(face uv ÷ texel), fetch 2 bits, palette lookup, the two nearest cells per axis blended by the pixel
// footprint's analytic coverage of the boundary between them (anti-aliasing ONLY at cell edges: crisp, and still under the TAAU jitter), faded to the
// record's coverage mean once the footprint passes ~¾ of a cell (minification: a tint, never noise), cone-averaged at reflection hits. Writes albedo +
// roughness (the g-buffer), genuine emission (composite at the primary hit, the reflection pass at its hits) — no normal; palette entries are materials, so
// baked lighting cannot be expressed. Prerequisite text: common.wgsl (frame, boxGeo, boxMat, MARK_BASE, boxRot, quatRotate). No derivative built-ins here
// (the g-buffer hands its own in), so the module is legal in compute stages too.

const MK_HEAD_ROWS: u32 = 8u;
const MK_MINIFY_LO: f32 = 0.75;      // footprint (cells) where the fade toward the mean begins …
const MK_MINIFY_W: f32 = 1.0;        // … and its width (fully the mean by 1.75 cells a pixel)
const MK_LOCAL: u32 = 4u;            // the local box average reaches this many cells an axis before the global mean takes over
// box-local face axes (scene/markings.ts FACE_AXES): u to the right and v up seen from outside for the vertical faces; +y: u = +x, v = −z
const MK_FACE_U = array<vec3f, 6>(vec3f(0.0, 0.0, -1.0), vec3f(0.0, 0.0, 1.0), vec3f(1.0, 0.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0));
const MK_FACE_V = array<vec3f, 6>(vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, -1.0), vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.0, 0.0));

/** one record's header, unpacked (scene/markings.ts packMarking) */
struct MarkRec {
  row: u32,                          // its first table row (the cells start at row + MK_HEAD_ROWS)
  U0: i32, V0: i32, W: i32, H: i32,
  face: u32, res: u32, last: bool, anyEmit: bool, areaLit: bool, emask: u32, palFlags: u32,
  f: vec3f,                          // coverage fractions of entries 1‥3
};
fn markLoad(row: u32) -> MarkRec {
  var m: MarkRec; m.row = row;
  let r0 = boxMat[MARK_BASE + row]; let r1 = boxMat[MARK_BASE + row + 1u];
  m.U0 = i32(round(r0.x)); m.V0 = i32(round(r0.y)); m.W = clamp(i32(round(r0.z)), 1, 32); m.H = clamp(i32(round(r0.w)), 1, 32);
  let mw = u32(r1.x + 0.5);
  m.face = mw & 7u; m.res = (mw >> 3u) & 3u; m.last = ((mw >> 5u) & 1u) != 0u; m.anyEmit = ((mw >> 6u) & 1u) != 0u; m.areaLit = ((mw >> 7u) & 1u) != 0u; m.emask = (mw >> 8u) & 7u; m.palFlags = (mw >> 11u) & 63u;
  m.f = r1.yzw;
  return m;
}
/** rows this record takes (the next record of the box's list follows directly) */
fn markRows(m: MarkRec) -> u32 { return MK_HEAD_ROWS + (u32(m.W * m.H) + 47u) / 48u; }
/** entry k's (1‥3) albedo + roughness (−1 = keep) and emitted radiance */
fn markPalA(m: MarkRec, k: u32) -> vec4f { return boxMat[MARK_BASE + m.row + 2u * k]; }
fn markPalE(m: MarkRec, k: u32) -> vec3f { return boxMat[MARK_BASE + m.row + 2u * k + 1u].xyz; }
/** the palette entry of cell (i, j) (j from the bottom); 0 outside the bitmap or transparent */
fn markCell(m: MarkRec, i: i32, j: i32) -> u32 {
  if (i < 0 || j < 0 || i >= m.W || j >= m.H) { return 0u; }
  let c = u32(j * m.W + i);
  let word = u32(boxMat[MARK_BASE + m.row + MK_HEAD_ROWS + c / 48u][(c % 48u) / 12u]);   // an exact integer < 2^24: the u32 conversion is exact
  return (word >> (2u * (c % 12u))) & 3u;
}
/** this record's cell size (m): the base × ½ / 1 / 2 */
fn markTexel(res: u32) -> f32 { return frame.markCfg.x * exp2(f32(res) - 1.0); }
/** the face a box-local normal belongs to (0 +x 1 −x 2 +y 3 −y 4 +z 5 −z) */
fn markFaceOf(ln: vec3f) -> u32 {
  let a = abs(ln);
  if (a.x >= a.y && a.x >= a.z) { return select(1u, 0u, ln.x >= 0.0); }
  if (a.y >= a.z) { return select(3u, 2u, ln.y >= 0.0); }
  return select(5u, 4u, ln.z >= 0.0);
}
/** CUT BOXES (scene/cut.ts; called only inside `if (CUT_BOXES)` blocks — dead code without the switch): markings live on a box's own six faces, so a point on a CUT
 *  face — off the plane of the box face its normal leans to — has none (the g-buffer's cut pass draws its cut faces bare the same way). */
fn markOffFace(g: BoxGeo, lp: vec3f, face: u32) -> bool {
  let a = face >> 1u;
  return (g.flags & GEO_CUT) != 0u && abs(abs(lp[a]) - g.h[a]) > 2e-3;
}
fn markUV(face: u32, lp: vec3f) -> vec2f { return vec2f(dot(lp, MK_FACE_U[face]), dot(lp, MK_FACE_V[face])); }

/** Coverage weights of palette entries 1‥3 at continuous cell position (x, y) (bitmap origin = its bottom-left) for a pixel footprint wT cells wide per axis:
 *  the two nearest cells per axis blended by the footprint's analytic coverage of the boundary between them (a step at zero footprint, a bilinear ramp at one
 *  cell), then — past MK_MINIFY_LO — faded to the record's mean fractions × how much of the footprint the bitmap covers at all. Entry 0's weight is 1 − the sum. */
fn markTaps(m: MarkRec, x: f32, y: f32, wT: vec2f) -> vec3f {
  let i0 = i32(floor(x - 0.5)); let j0 = i32(floor(y - 0.5));
  let fx = x - 0.5 - f32(i0); let fy = y - 0.5 - f32(j0);
  let bx = clamp((fx - 0.5) / max(wT.x, 1e-4) + 0.5, 0.0, 1.0);
  let by = clamp((fy - 0.5) / max(wT.y, 1e-4) + 0.5, 0.0, 1.0);
  var acc = vec3f(0.0);
  for (var t = 0u; t < 4u; t++) {
    let di = i32(t & 1u); let dj = i32(t >> 1u);
    let wgt = select(1.0 - bx, bx, di == 1) * select(1.0 - by, by, dj == 1);
    if (wgt <= 0.0) { continue; }
    let e = markCell(m, i0 + di, j0 + dj);
    if (e > 0u) { acc[e - 1u] += wgt; }
  }
  let mini = clamp((max(wT.x, wT.y) - MK_MINIFY_LO) / MK_MINIFY_W, 0.0, 1.0);
  if (mini > 0.0) {
    // MINIFIED: the footprint spans more than a cell, so two taps an axis under-sample it. Up to MK_LOCAL cells an axis: the plain box average of the cells
    // under the footprint (a LOCAL mean — a row of LEDs stays a row of dim dots instead of smearing into a bar of their global mean); wider still (the whole
    // bitmap a few pixels across): the record's global fractions × how much of the footprint the bitmap covers.
    let hx = 0.5 * max(wT.x, 1e-4); let hy = 0.5 * max(wT.y, 1e-4);
    var loc = vec3f(0.0); var cnt = 0.0;
    let ia = i32(floor(x - min(hx, 2.0))); let ja = i32(floor(y - min(hy, 2.0)));
    for (var dj = 0; dj < 4; dj++) {
      let jj = ja + dj; let yc = f32(jj) + 0.5; if (abs(yc - y) > max(hy, 0.5)) { continue; }
      for (var di = 0; di < 4; di++) {
        let ii = ia + di; let xc = f32(ii) + 0.5; if (abs(xc - x) > max(hx, 0.5)) { continue; }
        cnt += 1.0; let e = markCell(m, ii, jj); if (e > 0u) { loc[e - 1u] += 1.0; }
      }
    }
    if (cnt > 0.0) { loc /= cnt; }
    let cx = clamp((min(x + hx, f32(m.W)) - max(x - hx, 0.0)) / (2.0 * hx), 0.0, 1.0);
    let cy = clamp((min(y + hy, f32(m.H)) - max(y - hy, 0.0)) / (2.0 * hy), 0.0, 1.0);
    let far = clamp((max(wT.x, wT.y) - f32(MK_LOCAL) + 1.0) * 0.5, 0.0, 1.0);   // past the local window's reach: hand over to the global mean
    acc = mix(acc, mix(loc, m.f * (cx * cy), far), mini);
  }
  return acc;
}
/** cheap reject: does the bitmap (± the filter's reach) contain cell position (x, y)? */
fn markNear(m: MarkRec, x: f32, y: f32, wT: vec2f) -> bool { let r = max(wT, vec2f(1.0)); return x > -r.x && y > -r.y && x < f32(m.W) + r.x && y < f32(m.H) + r.y; }

fn mkHash(p: vec2f) -> f32 { let q = fract(p * vec2f(0.1031, 0.1030)); let r = q + dot(q, q.yx + 33.33); return fract((r.x + r.y) * r.x); }
fn mkNoise(p: vec2f) -> f32 { let i = floor(p); let f = p - i; let u = f * f * (3.0 - 2.0 * f); return mix(mix(mkHash(i), mkHash(i + vec2f(1.0, 0.0)), u.x), mix(mkHash(i + vec2f(0.0, 1.0)), mkHash(i + vec2f(1.0, 1.0)), u.x), u.y); }
const MK_BRIDGE = array<vec2i, 6>(vec2i(-1, 0), vec2i(0, -1), vec2i(2, 1), vec2i(1, 2), vec2i(2, 0), vec2i(0, 2));
fn mkEntry(e: u32) -> vec3f { return vec3f(f32(e == 1u), f32(e == 2u), f32(e == 3u)); }   // (a cell's entry as a weight vector: none for a bare cell)
/** THE LOOK PROTOTYPE, the soft read of a marking: ONE read of the block of four cells around (x, y), blended as a plain bilinear ramp between their
 *  centres (markTaps at a one-cell footprint is not that: it is already a quarter into its minified mean, which puts a step back on every cell edge and
 *  keeps a staircase a staircase), plus THE BRIDGE of a stroke that runs CORNER TO CORNER: where two cells of one paint meet only at a corner and the other
 *  two of the block are bare (a stepped diagonal: a gate's diamond) the ramp is exactly half cover at the corner, so the half-cover cut leaves two beads
 *  that just touch. The bridge adds 0.31 of cover there for that paint and nothing at the block's edges: a neck about 0.8 of a cell wide, as wide as the
 *  stroke. It is NOT added where both cells are the corners of solid blocks (two squares of a chequer of blocks, or two bare cells meeting inside a painted
 *  field, stay as ambiguous as they were), nor where the same paint sits on both outer ends of the other diagonal (a chequer of single cells), nor for a
 *  paint that BURNS. It reads its own record only: a corner on the seam between two records of one face is not joined. */
fn markSoftRead(m: MarkRec, x: f32, y: f32) -> vec3f {
  let i0 = i32(floor(x - 0.5)); let j0 = i32(floor(y - 0.5));
  let u = x - 0.5 - f32(i0); let v = y - 0.5 - f32(j0);
  let a = markCell(m, i0, j0); let b = markCell(m, i0 + 1, j0); let c = markCell(m, i0, j0 + 1); let d = markCell(m, i0 + 1, j0 + 1);
  // (whole-vector sums: the same maths as a write to o[entry] a cell)
  var o = mkEntry(a) * ((1.0 - u) * (1.0 - v)) + mkEntry(b) * (u * (1.0 - v)) + mkEntry(c) * ((1.0 - u) * v) + mkEntry(d) * (u * v);
  var e = 0u; var flip = false;
  if (a != 0u && a == d && b == 0u && c == 0u) { e = a; } else if (b != 0u && b == c && a == 0u && d == 0u) { e = b; flip = true; }
  if (e == 0u || ((m.emask >> (e - 1u)) & 1u) != 0u) { return o; }
  // the six cells that say what kind of corner it is (MK_BRIDGE: laid out for the a-d diagonal, mirrored for the other): the first four are the far
  // sides of the two cells (all four of the paint = two blocks), the last two the outer ends of the other diagonal (both of the paint = a chequer).
  // ONE call site in a loop, on purpose: written as two chains of `&&` over eight markCell calls, the software adapter never finished its first frame.
  var nb = 0u; var nl = 0u;
  for (var t = 0u; t < 6u; t++) {
    let q = MK_BRIDGE[t];
    if (markCell(m, i0 + select(q.x, 1 - q.x, flip), j0 + q.y) == e) { if (t < 4u) { nb++; } else { nl++; } }
  }
  if (nb < 4u && nl < 2u) { o += mkEntry(e) * (5.0 * u * (1.0 - u) * v * (1.0 - v)); }
  return o;
}
/** THE LOOK PROTOTYPE (soft > 0 only on that page: gbuffer.wgsl hands lookMarkSoft()): a marking drawn as PAINT, not as cells. The bitmap is read as a soft
 *  picture a cell wide (markSoftRead above: a bilinear ramp between cell centres, with its corner bridge) and cut back at half cover along a line the brush left ragged,
 *  so a staircase of cells is a slanted stroke, a lone cell a dab, a corner round; between two colours the stronger takes the pixel; the paint is thin in
 *  patches where it was rubbed. An entry that BURNS keeps its cells (an LED is a square). `w` = the crisp weights, `ws` = the soft read (the caller's: markSoftRead has ONE call
 *  site in the module, on purpose); returns the weights to use. */
/** how much of the soft read a pixel takes by its footprint in cells: far off it is the plain coverage again (a tint, never noise) */
fn markSoftNear(wT: vec2f) -> f32 { return 1.0 - smoothstep(0.75, 1.75, max(wT.x, wT.y)); }
fn markSoft(m: MarkRec, x: f32, y: f32, wT: vec2f, w: vec3f, soft: f32, salt: f32, ws: vec3f) -> vec3f {
  let foot = max(wT.x, wT.y); let near = markSoftNear(wT);
  let amt = min(soft, 1.0) * near;
  if (amt <= 0.0) { return w; }
  let s = ws.x + ws.y + ws.z;
  if (s <= 0.0) { return w * (1.0 - amt); }
  let eg = clamp(0.5 * foot, 0.07, 0.5);
  let rag = (mkNoise(vec2f(x, y) * 2.3 + vec2f(salt, 1.7)) - 0.5) * 0.3 + (mkNoise(vec2f(x, y) * 0.45 + vec2f(7.0, salt)) - 0.5) * 0.18;
  let cover = smoothstep(0.5 - eg, 0.5 + eg, s + rag * near);
  let p4 = ws * ws * ws * ws; let share = p4 / max(p4.x + p4.y + p4.z, 1e-6);
  let thin = 1.0 - 0.4 * near * smoothstep(0.55, 0.8, 0.6 * mkNoise(vec2f(x, y) * 0.21 + vec2f(3.0, 9.0 + salt)) + 0.4 * mkNoise(vec2f(x, y) * 1.1 + vec2f(salt, 5.0)));
  var o = share * cover * thin;
  o = select(o, w, vec3<bool>((m.emask & 1u) != 0u, (m.emask & 2u) != 0u, (m.emask & 4u) != 0u));
  o = mix(w, o, amt);
  let tot = o.x + o.y + o.z; if (tot > 1.0) { o /= tot; }
  return o;
}
struct MarkGB { albedo: vec3f, rough: f32 };
/** THE G-BUFFER's evaluation at the primary hit: every record of the box's list on this fragment's face, composited in order over the albedo / roughness the
 *  fragment has so far (contrast = frame.markCfg.y lerps entry albedos from the pixel's own). dwx / dwy = the world position's screen derivatives (fsBox takes
 *  them in uniform control flow); slot = the 1-based first row. */
fn markSurfaceGB(slot: u32, bi: u32, wp: vec3f, n: vec3f, dwx: vec3f, dwy: vec3f, albedoIn: vec3f, roughIn: f32, soft: f32) -> MarkGB {
  var o: MarkGB; o.albedo = albedoIn; o.rough = roughIn;
  let g = boxGeo[bi]; let q = boxRot(bi); let qi = vec4f(-q.xyz, q.w);
  let lp = quatRotate(qi, wp - g.c); let ln = quatRotate(qi, n);
  let dlx = quatRotate(qi, dwx); let dly = quatRotate(qi, dwy);
  let face = markFaceOf(ln);
  var row = slot - 1u;
  for (var k = 0u; k < 4u; k++) {
    let m = markLoad(row);
    if (m.face == face) {
      let t = markTexel(m.res);
      let uv = markUV(face, lp) / t; let du = markUV(face, dlx) / t; let dv = markUV(face, dly) / t;
      let wT = vec2f(abs(du.x) + abs(dv.x), abs(du.y) + abs(dv.y));
      let x = uv.x - f32(m.U0); let y = uv.y - f32(m.V0);
      if (markNear(m, x, y, wT)) {
        var w = markTaps(m, x, y, wT);
        if (soft > 0.0) {
          let near = markSoftNear(wT);
          if (near > 0.0 || soft > 1.75) {
            let ws = markSoftRead(m, x, y);   // (the module's one call site: the software adapter builds a copy of the walk for each)
            // A TEST PICTURE (the panel's Painted marks row all the way up, 2): on the maintainer's GPU the marks stayed square cells where the software
            // adapter brushed them, and nobody has found why. Here the mark's own patch is painted with what this GPU finds on the way: RED = how much of
            // the soft read the pixel takes by its footprint (black = "too far, keep the cells"), GREEN = the soft read's cover (a smooth ramp between
            // cells if it works, flat squares if it does not), BLUE = this record has an entry that burns (those keep their cells by rule).
            if (soft > 1.75) { o.albedo = vec3f(near, ws.x + ws.y + ws.z, select(0.0, 1.0, m.emask != 0u)); o.rough = 1.0; return o; }
            w = markSoft(m, x, y, wT, w, soft, f32((bi * 7u + k) % 61u), ws);
          }
        }
        let sum = w.x + w.y + w.z;
        if (sum > 0.0) {
          var alb = o.albedo * (1.0 - sum); var rgh = o.rough * (1.0 - sum);
          for (var e = 1u; e <= 3u; e++) {
            let we = w[e - 1u]; if (we <= 0.0) { continue; }
            let pa = markPalA(m, e);
            let a = select(o.albedo, mix(o.albedo, pa.xyz, frame.markCfg.y), ((m.palFlags >> (e - 1u)) & 1u) != 0u);   // an entry without an albedo of its own keeps the pixel's
            alb += a * we;
            rgh += select(o.rough, pa.w, pa.w >= 0.0) * we;
          }
          o.albedo = alb; o.rough = rgh;
        }
      }
    }
    if (m.last) { break; }
    row += markRows(m);
  }
  return o;
}
/** per-axis footprint (cells) of an isotropic footprint fp (m, across the ray) landing on face `face` of a box with rotation q, seen along unit V (surface → eye) */
fn markFoot(face: u32, q: vec4f, V: vec3f, fp: f32, t: f32) -> vec2f {
  let uw = quatRotate(q, MK_FACE_U[face]); let vw = quatRotate(q, MK_FACE_V[face]);
  let du = dot(V, uw); let dv = dot(V, vw);
  return vec2f(fp / sqrt(max(1.0 - du * du, 0.04)), fp / sqrt(max(1.0 - dv * dv, 0.04))) / t;
}
/** THE EMISSION of the box's emissive markings at a point on it (composite at the primary hit): radiance toward the eye × the switchable's gain × the emissive
 *  scales. V = unit surface → eye, fp = the footprint across the ray (m). */
fn markEmissiveAt(slot: u32, bi: u32, wp: vec3f, n: vec3f, V: vec3f, fp: f32) -> vec3f {
  var L = vec3f(0.0);
  var row = slot - 1u;
  let first = markLoad(row);
  if (!first.anyEmit) { return L; }
  let gain = boxMarkGain(bi) * frame.emissiveScale * frame.markCfg.z;
  if (gain <= 0.0) { return L; }
  let g = boxGeo[bi]; let q = boxRot(bi); let qi = vec4f(-q.xyz, q.w);
  let lp = quatRotate(qi, wp - g.c); let ln = quatRotate(qi, n);
  let face = markFaceOf(ln);
  if (CUT_BOXES) { if (markOffFace(g, lp, face)) { return L; } }
  for (var k = 0u; k < 4u; k++) {
    var m = first; if (k > 0u) { m = markLoad(row); }
    if (m.face == face && m.emask != 0u) {
      let t = markTexel(m.res);
      let uv = markUV(face, lp) / t; let wT = markFoot(face, q, V, fp, t);
      let x = uv.x - f32(m.U0); let y = uv.y - f32(m.V0);
      if (markNear(m, x, y, wT)) {
        let w = markTaps(m, x, y, wT);
        for (var e = 1u; e <= 3u; e++) { let we = w[e - 1u]; if (we > 0.0 && ((m.emask >> (e - 1u)) & 1u) != 0u) { L += markPalE(m, e) * we; } }
      }
    }
    if (m.last) { break; }
    row += markRows(m);
  }
  return L * gain;
}
struct MarkHit { albedo: vec3f, L: vec3f };
/** A REFLECTION hit on a marked box: its albedo with the markings on this face composited in, band-limited by the cone footprint fp (m) — small markings on a
 *  rough mirror average out to their mean, physically right — plus their emission (× kEmit for a marking whose light is registered: the analytic image
 *  carries the rest, as for an area-lit fixture — reflect.wgsl emitTraceK). */
fn markHit(slot: u32, bi: u32, wp: vec3f, n: vec3f, V: vec3f, fp: f32, kEmit: f32, albedoIn: vec3f) -> MarkHit {
  var o: MarkHit; o.albedo = albedoIn; o.L = vec3f(0.0);
  let g = boxGeo[bi]; let q = boxRot(bi); let qi = vec4f(-q.xyz, q.w);
  let lp = quatRotate(qi, wp - g.c); let ln = quatRotate(qi, n);
  let face = markFaceOf(ln);
  if (CUT_BOXES) { if (markOffFace(g, lp, face)) { return o; } }
  let gain = boxMarkGain(bi) * frame.emissiveScale * frame.markCfg.z;
  var row = slot - 1u;
  for (var k = 0u; k < 4u; k++) {
    let m = markLoad(row);
    if (m.face == face) {
      let t = markTexel(m.res);
      let uv = markUV(face, lp) / t; let wT = markFoot(face, q, V, fp, t);
      let x = uv.x - f32(m.U0); let y = uv.y - f32(m.V0);
      if (markNear(m, x, y, wT)) {
        let w = markTaps(m, x, y, wT);
        let sum = w.x + w.y + w.z;
        if (sum > 0.0) {
          var alb = o.albedo * (1.0 - sum);
          for (var e = 1u; e <= 3u; e++) {
            let we = w[e - 1u]; if (we <= 0.0) { continue; }
            let pa = markPalA(m, e);
            alb += select(o.albedo, mix(o.albedo, pa.xyz, frame.markCfg.y), ((m.palFlags >> (e - 1u)) & 1u) != 0u) * we;
            if (((m.emask >> (e - 1u)) & 1u) != 0u) { o.L += markPalE(m, e) * (we * gain * select(1.0, kEmit, m.areaLit)); }
          }
          o.albedo = alb;
        }
      }
    }
    if (m.last) { break; }
    row += markRows(m);
  }
  return o;
}
/** the 1-based first table row in a box's flags word (0 = no markings) — 0 for everybody while frame.markCfg.x says markings are off */
fn markSlotOf(flags: u32) -> u32 { return select(0u, flags >> 18u, frame.markCfg.x > 0.0); }
// The reflection passes' RAY CONE, set once per pixel by their main() before the rays go out: the receiver pixel's own footprint (mkConeFp0, m), its growth per
// metre past the mirror (mkConePix = the pixel's angular size: a planar mirror keeps the primary cone diverging at the same rate) and the LOBE's share per metre
// (mkConeK = markConeK() × α). markReflHit band-limits a TRACED hit's markings by fp0 + t·(pix + k). The lobe's share is deliberately small (settings.markingReflCone,
// default 0.25·α): the reflection rays are already drawn from the GGX lobe and the specular denoiser averages them, so THAT is where the lobe's blur is realised —
// pre-filtering every hit by the whole lobe as well (2·α, the first cut) blurred twice and turned the vending window's rows of cans into a featureless panel in the
// lino a metre out. Zero in every other module.
var<private> mkConeFp0: f32;
var<private> mkConePix: f32;
var<private> mkConeK: f32;
/** the lobe share of the traced-hit cone, × α per metre: |frame.markCfg.w| carries 1 + it while markings are evaluated at reflection hits at all (w < 0 = the analytic highlight left uniform, an A/B) */
fn markConeK() -> f32 { return max(abs(frame.markCfg.w) - 1.0, 0.0); }
fn markReflHit(slot: u32, bi: u32, Ph: vec3f, n: vec3f, dir: vec3f, t: f32, kEmit: f32, base: vec3f) -> MarkHit {
  return markHit(slot, bi, Ph, n, -dir, mkConeFp0 + t * (mkConePix + mkConeK), kEmit, base);
}
/** The ANALYTIC image's texture. An area light registered for an emissive marking (lights.ts markRef = box << 2 | ordinal) reaches a rough receiver through
 *  rtGlints' analytic, lobe-convolved highlight — which knows the light's rectangle but not its pixel art, so on its own it mirrors a uniform panel. This returns
 *  the marking's emission at the point where the receiver's MIRROR ray (off Po with normal N, eye direction V) meets the marking's plane, RELATIVE to the record's
 *  mean emission over the part of the footprint the bitmap covers: × it, the analytic image keeps its extent and fall-off (still the lobe's D — coverage is
 *  divided back out) and gains the window's rows and columns where the mirror footprint overlaps it. Band-limited by the pixel cone + the WHOLE lobe (2·α per
 *  metre of mirror distance): the analytic image has no ray distribution to realise the lobe's blur, so its texture takes all of it here — a rough floor two
 *  metres out gets the mean (ratio → 1), the strip along the machine's foot gets cans. 1 where the mirror ray runs along or away from the face. */
fn markPatternAtMirror(mref: u32, li: Light, Po: vec3f, N: vec3f, V: vec3f, alpha: f32) -> vec3f {
  let bi = mref >> 2u; let ord = mref & 3u;
  let slot = markSlotOf(boxGeo[bi].flags); if (slot == 0u) { return vec3f(1.0); }
  var row = slot - 1u; var m = markLoad(row);
  for (var k = 0u; k < ord; k++) { if (m.last) { return vec3f(1.0); } row += markRows(m); m = markLoad(row); }
  if (m.emask == 0u) { return vec3f(1.0); }
  let n = li.dir;                                                          // the panel's outward normal
  let R = reflect(-V, N);                                                  // the receiver's mirror direction
  let dn = dot(R, n);
  if (dn > -1e-3) { return vec3f(1.0); }
  let s = dot(li.pos - n * 0.07 - Po, n) / dn;                             // (game.ts stands the light 7 cm proud of the face)
  if (s <= 0.0) { return vec3f(1.0); }
  let X = Po + R * s;
  let g = boxGeo[bi]; let q = boxRot(bi); let qi = vec4f(-q.xyz, q.w);
  let lp = quatRotate(qi, X - g.c);
  let t = markTexel(m.res);
  let fp = mkConeFp0 + s * (mkConePix + 2.0 * alpha);
  let uv = markUV(m.face, lp) / t; let wT = markFoot(m.face, q, -R, fp, t);
  let x = uv.x - f32(m.U0); let y = uv.y - f32(m.V0);
  if (!markNear(m, x, y, wT)) { return vec3f(1.0); }                       // the mirror footprint misses the bitmap outright: structure unknown there, D's fall-off stands
  let hx = max(0.5 * wT.x, 0.5); let hy = max(0.5 * wT.y, 0.5);
  let cov = clamp((min(x + hx, f32(m.W)) - max(x - hx, 0.0)) / (2.0 * hx), 0.0, 1.0) * clamp((min(y + hy, f32(m.H)) - max(y - hy, 0.0)) / (2.0 * hy), 0.0, 1.0);
  let w = markTaps(m, x, y, wT);
  var Lx = vec3f(0.0); var mean = vec3f(0.0);
  for (var e = 1u; e <= 3u; e++) {
    if (((m.emask >> (e - 1u)) & 1u) == 0u) { continue; }
    let pe = markPalE(m, e); Lx += pe * w[e - 1u]; mean += pe * m.f[e - 1u];
  }
  let ratio = clamp(Lx / max(mean * cov, vec3f(1e-4)), vec3f(0.0), vec3f(6.0));
  return mix(vec3f(1.0), ratio, smoothstep(0.05, 0.3, cov));               // hand back to the uniform image as the overlap thins (0 / 0 at the rim)
}
