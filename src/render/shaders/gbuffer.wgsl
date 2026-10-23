// G-buffer rasterization: instanced yawed boxes + GPU-skinned characters.
// Outputs: albedo (rgba8), world normal (rgb10a2, n*0.5+0.5), id (r32uint: boxIdx | owner<<20 | isChar<<28 | cap<<29; a WET character pixel carries its
// coat's numbers in the low 20 bits instead of all ones and raises bit 30 — packWet below, read by composite.wgsl wetCoatSpec), depth, the OBJECT motion the
// TAAU resolve reprojects moving things with (rg16float, motionOf below), and the MATERIAL (rg8unorm: GGX roughness, metalness — the box's finish, common.wgsl
// boxFinish, after the detail layer; renderer v3 phase 4).

struct GOut {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) id: u32,
  @location(3) vel: vec2f,      // ndc(prevViewProj · P_prev) − ndc(prevViewProj · P_now): where this surface point WAS last frame minus where it IS, both through last frame's view-projection
                                // (so the camera's own motion, which the resolve rebuilds exactly from depth, and any projection jitter cancel out) — 0 for anything rigid that did not move
  @location(4) mat: vec2f,      // (roughness, metalness) of what the pixel shows: reflect.wgsl / the specular denoiser / composite read it; (1, 0) = matte dielectric (characters, section caps, the sky's clear)
  @location(5) edge: vec2f,     // GBAA (gbaa.wgsl): signed px distance from the pixel centre to the nearest edge of the box face shown, along x (in .x) OR y (in .y), d·½+½; 1.0 = none (characters, caps, the clear)
};
const EDGE_NONE: vec2f = vec2f(1.0, 1.0);

/** GBAA: the offset the `edge` target holds for a fragment at box-local position `lc` on face `hf.w` (0‥5) of a box with half-extents `hf.xyz`, given lc's screen derivatives
 *  (dlx = dpdx, dly = dpdy, box units per pixel). The face's two in-plane coordinates against their ± half-extent = its four edges; for each, the local gap to the edge over the
 *  gradient's magnitude = the perpendicular distance in pixels; the nearest edge wins and is stored along its major screen axis (the one its gradient leans on: the distance ALONG
 *  x to a near-vertical edge, along y to a near-horizontal one — what the blend pass steps across). Encoded d·½+½ into unorm; a component left at 1.0 = no edge on that axis. */
fn boxEdgeOffset(lc: vec3f, hf: vec4f, dlx: vec3f, dly: vec3f) -> vec2f {
  let ax = u32(hf.w + 0.5) / 2u;            // the face's own axis: 0 = ±x, 1 = ±y, 2 = ±z
  var cu: f32; var cv: f32; var hu: f32; var hv: f32; var gu: vec2f; var gv: vec2f;
  if (ax == 0u) { cu = lc.z; cv = lc.y; hu = hf.z; hv = hf.y; gu = vec2f(dlx.z, dly.z); gv = vec2f(dlx.y, dly.y); }
  else if (ax == 1u) { cu = lc.x; cv = lc.z; hu = hf.x; hv = hf.z; gu = vec2f(dlx.x, dly.x); gv = vec2f(dlx.z, dly.z); }
  else { cu = lc.x; cv = lc.y; hu = hf.x; hv = hf.y; gu = vec2f(dlx.x, dly.x); gv = vec2f(dlx.y, dly.y); }
  var best = 1e9; var d = vec2f(1.0, 1.0);
  let lu = length(gu); let lv = length(gv);
  if (lu < 1e-8 || lv < 1e-8) { return vec2f(1.0, 1.0); }   // a degenerate quad (an axis with no screen gradient): no edge rather than ±inf / NaN into the encode
  // u = +hu / −hu, v = +hv / −hv: gap s = edge − coordinate (box units, signed), perpendicular px = |s| / |g|, along-axis px = s / g.axis
  { let s0 = hu - cu; let pd = abs(s0) / lu; if (pd < best) { best = pd; if (abs(gu.x) >= abs(gu.y)) { d = vec2f(s0 / gu.x, 1.0); } else { d = vec2f(1.0, s0 / gu.y); } } }
  { let s0 = -hu - cu; let pd = abs(s0) / lu; if (pd < best) { best = pd; if (abs(gu.x) >= abs(gu.y)) { d = vec2f(s0 / gu.x, 1.0); } else { d = vec2f(1.0, s0 / gu.y); } } }
  { let s0 = hv - cv; let pd = abs(s0) / lv; if (pd < best) { best = pd; if (abs(gv.x) >= abs(gv.y)) { d = vec2f(s0 / gv.x, 1.0); } else { d = vec2f(1.0, s0 / gv.y); } } }
  { let s0 = -hv - cv; let pd = abs(s0) / lv; if (pd < best) { best = pd; if (abs(gv.x) >= abs(gv.y)) { d = vec2f(s0 / gv.x, 1.0); } else { d = vec2f(1.0, s0 / gv.y); } } }
  // encode: |d| ≥ 1 (either sign) is of use to nobody — the pixel's own blend needs |d| < ½, a neighbour's take-up needs ½ < |d| < 1 — and becomes NONE (1.0); a genuine distance inside
  // (−1, 1) is kept inside ±(1 − 1/128) so it can never round to the NONE code (the far-side pixel whose centre the edge all but touches keeps its half blend). (Clamping d ≤ −1
  // to −lim instead put every interior pixel with a far edge on its −x / −y side inside its neighbour's take-up window: a 49 % two-tap blur over half of every face.)
  let lim = 1.0 - 1.0 / 128.0;
  return select(clamp(d, vec2f(-lim), vec2f(lim)), vec2f(1.0), abs(d) >= vec2f(1.0)) * 0.5 + 0.5;
}

/** the object-motion term for a fragment at world position `wp` that was at `wpPrev` a frame ago (see GOut.vel); 0 when either is behind last frame's eye */
fn motionOf(wp: vec3f, wpPrev: vec3f) -> vec2f {
  let a = frame.prevViewProj * vec4f(wpPrev, 1.0); let b = frame.prevViewProj * vec4f(wp, 1.0);
  if (a.w <= 1e-4 || b.w <= 1e-4) { return vec2f(0.0); }
  return a.xy / a.w - b.xy / b.w;
}

// ---------------- boxes ----------------
@group(1) @binding(0) var<storage, read> visible: array<u32>;
// last frame's box rows (render/gbuffer.ts snapshotPrev): geo rows first — prevBoxes[2i] = (c.xyz, packed yaw), prevBoxes[2i+1] = (h.xyz, flags) — then from PREV_MAT_BASE the mat rows,
// prevBoxes[PREV_MAT_BASE + 4i + 2] = the rotation quaternion (mat rows are 4 vec4 a box: boxes.ts MAT_STRIDE). A box takes its previous transform from here only if the box at ITS index last frame had the same half-extents and owner
// (the dynamic list keeps its order until something spawns or goes; a static never moves): else it is treated as not having moved.
@group(1) @binding(4) var<storage, read> prevBoxes: array<vec4u>;   // (raw words, bitcast per use: the flags word must not pass through a float load)

struct BoxVOut {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) albedo: vec3f,
  @location(1) @interpolate(flat) normal: vec3f,
  @location(2) @interpolate(flat) id: u32,
  @location(3) wp: vec3f,                                    // world position of the fragment (the decals are looked up by it: decals.wgsl)
  @location(4) wpPrev: vec3f,                                // where this corner was a frame ago (= wp for a box that did not move / cannot be matched)
  @location(5) @interpolate(flat) mark: u32,                 // the box's MARKING slot (1-based first record in the tail of boxMat; 0 = none, or markings off) — markings.wgsl
  @location(6) lc: vec3f,                                    // GBAA: the corner in BOX units (interpolated across the face: the fragment's box-local position) …
  @location(7) @interpolate(flat) hf: vec4f,                 // … and the box's half-extents + the face index (w) it lies on — boxEdgeOffset
  @location(8) @interpolate(flat) look: u32,                 // THE LOOK PROTOTYPE (look.wgsl): the paint's material class (lookClass), found once a corner — 0 on every other page
};

fn cubeCorner(vi: u32) -> vec3f {
  // 6 faces * 2 tris * 3 verts. Face order: +x -x +y -y +z -z
  var faces = array<vec3f, 6>(vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1));
  let face = vi / 6u; let k = vi % 6u;
  var quad = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(1,1), vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
  let q = quad[k];
  let n = faces[face];
  // build tangent basis so winding is CCW seen from outside
  var u: vec3f; var v: vec3f;
  if (face == 0u) { u = vec3f(0,0,-1); v = vec3f(0,1,0); }
  else if (face == 1u) { u = vec3f(0,0,1); v = vec3f(0,1,0); }
  else if (face == 2u) { u = vec3f(1,0,0); v = vec3f(0,0,-1); }
  else if (face == 3u) { u = vec3f(1,0,0); v = vec3f(0,0,1); }
  else if (face == 4u) { u = vec3f(1,0,0); v = vec3f(0,1,0); }
  else { u = vec3f(-1,0,0); v = vec3f(0,1,0); }
  return n + u * q.x + v * q.y;
}
fn cubeNormal(vi: u32) -> vec3f {
  var faces = array<vec3f, 6>(vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1));
  return faces[vi / 6u];
}

@vertex fn vsBox(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BoxVOut {
  let vw = visible[ii];
  let bi = vw & 0xFFFFu;             // the box; the top 16 bits say where its PREVIOUS transform is (MOTION IDENTITY, scene/boxes.ts upload): 0 = the index rule below, 0xFFFF = new this frame, else 1 + last frame's index
  let pslot = vw >> 16u;
  let b = boxGeo[bi];
  var c = b.c; var h = b.h;
  var cap = false;
  let face = vi / 6u;
  if ((b.flags & BOX_CUTAWAY) != 0u) {
    let bottom = c.y - h.y; let fullTop = c.y + h.y; let ch = boxCutHeight(bi);
    if (ch < bottom + 0.05) { h = vec3f(0.0); }             // entirely above the cut: collapse (nothing rasterized)
    let top = min(fullTop, max(bottom + 0.02, ch));
    if (top < fullTop - 0.001 && face == 2u) { cap = true; }
    h.y = min(h.y, (top - bottom) * 0.5); c.y = bottom + h.y;
  }
  // top faces flush under the (hidden) ceiling slab read as architectural section cuts
  if (face == 2u && c.y + h.y >= CEIL_Y - 0.03 && c.y - h.y < CEIL_Y - 0.5) { cap = true; }
  let q = boxRot(bi);                                       // = the box's yaw for ordinary boxes; BOX_ROT boxes (hand props, sparks, canisters) may carry a full 3D rotation
  let lc = cubeCorner(vi) * h;
  let ln = cubeNormal(vi);
  let wp = c + quatRotate(q, lc);
  var o: BoxVOut;
  o.pos = frame.viewProj * vec4f(wp, 1.0);
  o.normal = quatRotate(q, ln);
  o.albedo = boxAlbedo(bi);
  if (LOOK) { o.look = lookClass(o.albedo); }
  o.id = bi | (boxOwner(b) << 20u) | (select(0u, 1u, cap) << 29u);
  o.wp = wp;
  // motion: the same corner under last frame's transform of THIS box — by its motion identity when the CPU named one (pslot: the index its key had last frame, whatever spawned or died
  // around it in the list; a keyed box new this frame did not move), else the box at this index a frame ago if that was recognisably this box (same size, same owner / flag byte;
  // cutaway boxes are the viewer's still wall)
  var wpPrev = wp;
  if (pslot == 0u) {
    let pg1 = prevBoxes[bi * 2u + 1u];
    if ((b.flags & BOX_CUTAWAY) == 0u && all(bitcast<vec3f>(pg1.xyz) == b.h) && ((pg1.w ^ b.flags) & 0xFF00u) == 0u) {
      let pc = bitcast<vec3f>(prevBoxes[bi * 2u].xyz); let pq = bitcast<vec4f>(prevBoxes[PREV_MAT_BASE + bi * 4u + 2u]);
      wpPrev = pc + quatRotate(pq, lc);
    }
  } else if (pslot != 0xFFFFu) {
    let pi = pslot - 1u;
    let pg1 = prevBoxes[pi * 2u + 1u];
    if (all(abs(bitcast<vec3f>(pg1.xyz) - b.h) <= b.h * 0.02 + 1e-4)) {   // the keyed part must still be the same SHAPE (a laser / tripwire beam re-cut this frame, a magazine that just settled flat: treated as not having moved, as the index rule did)
      let pc = bitcast<vec3f>(prevBoxes[pi * 2u].xyz); let pq = bitcast<vec4f>(prevBoxes[PREV_MAT_BASE + pi * 4u + 2u]);
      wpPrev = pc + quatRotate(pq, lc);
    }
  }
  o.wpPrev = wpPrev;
  o.mark = markSlotOf(b.flags);
  o.lc = lc; o.hf = vec4f(h, select(f32(face), -1.0, cap || (b.flags & BOX_CUTAWAY) != 0u));   // (a section cap / the viewer's cut wall: no edge — the diagram's outline is not a surface's)
  return o;
}

@fragment fn fsBox(v: BoxVOut) -> GOut {
  var o: GOut;
  var albedo = v.albedo; var n = normalize(v.normal); var keep = 1.0; let gn = n;   // (gn: the face itself, whatever a layer below does to n)   // keep: the albedo target's alpha — 1 everywhere unless a decal's soot asks composite to hold the glossy floors' specular back there
  let dwx = dpdx(v.wp); let dwy = dpdy(v.wp);                             // the world position's screen derivatives (uniform control flow, two subtractions a pixel): the markings' texel-edge AA is analytic against them
  let dlx = dpdx(v.lc); let dly = dpdy(v.lc);                             // … and the box-local position's, for the GBAA edge distance (boxEdgeOffset)
  // the material (renderer v3 phase 4): the box's finish — a section cap (id bit 29) is a diagram, not a surface: matte
  let bi = v.id & 0xFFFFFu; let cap = ((v.id >> 29u) & 1u) != 0u;
  var rough = 1.0; var metal = 0.0; var wetG = false;
  if (!cap) { let fin = boxFinish(bi); rough = fin.rough; metal = select(0.0, 1.0, fin.metal); wetG = fin.aniso; }
  if (frame.matCfg.w > 0.0 && !cap) {                                    // the DETAIL layer (detailSurface below): wear you can explain, at the primary hit only — 0 = nothing here runs, the pixel exactly as it was
    let dt = detailSurface(v.wp, n, bi, albedo, rough, metal, frame.matCfg.w);
    albedo = dt.albedo; rough = dt.rough; metal = dt.metal;
  }
  var lookTilt = false;
  if (LOOK && !cap) {                                                    // THE LOOK PROTOTYPE (look.wgsl; the page /look — dead code on every other): the paint drawn off its material's maps, weathered as the building is, a small box's edges rounded
    let lk = lookSurface(v.look, v.wp, n, bi, v.lc, v.hf, albedo, rough, dwx, dwy, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y);
    albedo = lk.albedo; rough = lk.rough;
    n = lk.n; lookTilt = lk.tilted;
  }
  if (SURF_TRY && !LOOK && !cap) {                                                // SURFACES, A TRY (surface.wgsl; ?surf at boot — dead code on every other page): a paint drawn as the stuff it stands for, after the wear, before the markings
    let sf = surfaceTry(v.wp, n, bi, v.lc, v.hf, v.albedo, albedo, rough, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y);
    albedo = sf.albedo; n = sf.n; rough = sf.rough;
  }
  let wetK = floor(frame.rtCfg.z * 0.5) * 0.1;                           // WET GROUND (detail.wgsl wetGround; settings.wetBreakup rides rtCfg.z as 2 × tenths — 0 = nothing here runs)
  if (wetK > 0.0 && wetG && select(n.y, gn.y, LOOK) > 0.9) { rough = wetGround(v.wp, rough, wetK); }
  if (v.mark != 0u && !cap) {                                             // MARKINGS (markings.wgsl): the pixel-art signifiers on this box's faces — albedo + roughness only, after the wear, before the encounter's marks
    let mk = markSurfaceGB(v.mark, bi, v.wp, n, dwx, dwy, albedo, rough);
    albedo = mk.albedo; rough = mk.rough;
  }
  if (SNOW_SURF && !cap && snowCfg.p[1].z > 0.5 && f32(bi) < snowCfg.p[1].w) {   // THE SNOW'S SURFACE (snow.wgsl; a snow level with its look on — dead code on every other page): the ground and every snow-painted box of the level file are shaded off the level's snow field, after the markings, before the encounter's marks
    let snowPaint = snowIsPaint(v.albedo);
    let snowGround = select(n.y, gn.y, LOOK) > 0.9 && v.wp.y < 0.03 && v.wp.y > -0.01 && (boxGeo[bi].flags & BOX_EMISSIVE) == 0u;
    if (snowGround || snowPaint || (v.hf.y < 0.016 && v.wp.y < 0.035)) {
      let sb = snowBox(v.wp, select(n, gn, lookTilt), bi, v.lc, v.hf, snowGround, snowPaint, snowIsLay(v.albedo), albedo, rough, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y);
      if (sb.gone) { discard; }
      if (!lookTilt || sb.amt > 0.0) { albedo = sb.albedo; n = sb.n; rough = sb.rough; metal = metal * (1.0 - sb.amt); lookTilt = false; }   // (THE LOOK PROTOTYPE: where no snow lies the relief stays; where it does, the pixel is the snow's, normal and alpha)
      if (LOOK && snowGround && sb.amt > 0.5) { let lg = lookGround(v.wp, n, rough, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y); n = lg.n; rough = lg.rough; }   // THE LOOK PROTOTYPE (look.wgsl lookGround): lying snow's relief × the panel's number, and its crust
      if (SNOW_GLOW || SNOW_SPARKLE) { o.normal.a = sb.amt * 0.6667; }   // SNOW GLOW, SNOW SPARKLE (composite.wgsl snowGlow): how much of this pixel is snow, held in `o` (zero until here) for the output line below
    }
  }
  if (LOOK && SNOW_SURF && !cap && snowCfg.p[1].z > 0.5 && f32(bi) < snowCfg.p[1].w) { let ls = lookSnow(v.look, v.wp, gn, bi, v.lc, v.hf, v.albedo, albedo, rough, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y); if (ls.amt > 0.0) { albedo = ls.albedo; rough = ls.rough; metal = metal * (1.0 - ls.amt); if (ls.bank) { n = ls.n; lookTilt = false; if (SNOW_GLOW || SNOW_SPARKLE) { o.normal.a = ls.amt * 0.6667; } } } }   // THE LOOK PROTOTYPE on a snow level (look.wgsl lookSnow; a box of the level file, as the snow above): snow against the foot of what stands in the open and on what was left out. A BANK is snow to the glow and the sparkle and keeps none of the wall's relief; a grain stuck higher up is paint and finish only
  if ((frame.flags & FLAG_DECALS) != 0u) {                              // decals (experiment E1, decals.wgsl): the marks registered in this pixel's 1 m cell edit what is stored — so every light that reads the g-buffer answers to them
    let fp = distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y;   // this pixel's footprint on the surface (m): edges are softened over it, sub-pixel texture fades under it
    let nl = n; if (lookTilt) { n = gn; }                              // (THE LOOK PROTOTYPE: a mark is laid on the FACE, and the relief put back under it below)
    var d = decalSurface(v.wp, n, v.id & 0xFFFFFu, albedo, fp);
    for (var r = 1u; r < DECAL_REPEAT; r++) { let e = decalSurface(v.wp + vec3f(f32(r) * 1e-7), n, v.id & 0xFFFFFu, albedo, fp); d.keep = min(d.keep, e.keep + 1e-6 * e.albedo.x); }   // (measurement only, DECAL_REPEAT is 1 in production: the loop never runs)
    albedo = d.albedo; n = d.n; keep = d.keep;
    if (lookTilt) { n = normalize(n + nl - gn); let c = dot(n, gn); if (c < 0.8773) { n = normalize(gn * 0.8773 + normalize(n - gn * c) * 0.48); } }   // (… held inside LOOK_MAX_TILT again, mark and relief together: lookGeoN must find this face)
  }
  o.albedo = vec4f(albedo, keep);
  o.normal = vec4f(n * 0.5 + 0.5, select(1.0, 1.0 - o.normal.a, SNOW_GLOW || SNOW_SPARKLE));   // (.a: 1 = not snow, as every writer of this target stores it; SNOW GLOW or SNOW SPARKLE: 2∕3 = thin snow, 1∕3 = snow — the target's two spare bits, read by composite.wgsl snowGlowAmt alone)
  if (LOOK && lookTilt) { o.normal.a = 0.0; }   // THE LOOK PROTOTYPE: the alpha's fourth code = this normal carries the look's relief (common.wgsl lookGeoN gives the face back)
  o.id = v.id;
  o.vel = motionOf(v.wp, v.wpPrev);
  o.mat = vec2f(rough, metal);
  o.edge = select(boxEdgeOffset(v.lc, v.hf, dlx, dly), EDGE_NONE, v.hf.w < 0.0);   // GBAA: the nearest face edge in signed pixels (none on a cap)
  return o;
}

// ---------------- skinned characters ----------------
// The rows past the tints are the WET look (game/wet.ts → anim/characters.ts setInstance; all zero for a dry man or with settings.wetChars off — fsSkin then
// stores exactly what it always stored): wet = (coat 0‥1, beads 0‥1, the rain rate the drops were fed at, a per-man clock offset in s), wetK = (bead density,
// bead radius m, run / trail length m, coat roughness soaked), wetK2 = (coat roughness dry, darken exponent, darken multiplier, specular gain).
struct CharInst { tint: vec3f, jointOffset: u32, tint2: vec3f, owner: u32, wet: vec4f, wetK: vec4f, wetK2: vec4f, wetK3: vec2f, parts: u32, pad: u32 };   // wetK3 = (waterline: bind-pose m above the sole the coat reaches, the wicking band above it, 0, 0) — game/wet.ts wetLineRow
@group(1) @binding(1) var<storage, read> jointMats: array<mat4x4f>;
@group(1) @binding(2) var<storage, read> chars: array<CharInst>;
// CHARACTER MATERIALS (render/charMaterials.ts → anim/characters.ts setMaterials): CHAR_MAT_ROWS vec4 rows per instance. Row 0 = (on, grime height, grime band, crease
// darkening) · row 1 = (grime rgb, ridge lightening) · then per material slot (albedo rgb, lobe roughness) · (lobe gain, soak, grime, wear). Row 0 `.x` 0 — every instance
// unless settings.charMats is up — and vsSkin hands fsSkin the two tints and a zero finish: the pixel is stored exactly as it always was.
const CHAR_MAT_ROWS: u32 = 24u;
@group(1) @binding(7) var<storage, read> charMats: array<vec4f>;
@group(1) @binding(5) var<storage, read> prevJoints: array<mat4x4f>;   // last frame's palette (render/gbuffer.ts snapshotPrev), same layout / offsets — the skinned motion vectors

struct SkinVOut {
  @builtin(position) pos: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) albedo: vec3f,
  @location(2) @interpolate(flat) id: u32,
  @location(3) mp: vec3f,                              // bind-pose model position: the drops live in it, so they stay on the cloth whatever the pose does
  @location(4) wp: vec3f,                              // world position (the pixel's footprint on him, for the drops' edges)
  @location(5) @interpolate(flat) wet: vec4f,          // the instance's three wet rows, as they are (read only when he is wet)
  @location(6) @interpolate(flat) wetK: vec4f,
  @location(7) @interpolate(flat) wetK2: vec4f,
  @location(8) wpPrev: vec3f,                          // this vertex skinned with LAST frame's palette
  @location(9) @interpolate(flat) wetK3: vec4f,      // (waterline, band) — read only when he is wet
  @location(10) @interpolate(flat) fin: vec4f,        // CHARACTER MATERIALS: the slot's (lobe roughness, lobe gain, soak, 1) — w 0 = no slots: the two tints, a matte dry man
  @location(11) @interpolate(flat) mvar: vec4f,       // … its (grime, wear) and the man's (crease darkening, ridge lightening)
  @location(12) @interpolate(flat) grime: vec4f,      // … the ground's dust on him: rgb, and in w the height (bind-pose m above the sole) it stands at full strength
  @location(13) geo: vec2f,                           // … (cavity −1 ridge ‥ +1 crease baked from the mesh, the grime band's height) — interpolated
};

// THE CAST'S MATERIAL SLOTS (anim/gltf.ts SLOT_NAMES — the ids are that table's order): the flat colour of a slot on one man. PLACEHOLDER SHADING, the models part's stand-in: one
// colour per slot, the man's two instance colours where the game already tells men apart by them (tint = the uniform / the loadout's suit, tint2 = the pair colour / trim). The
// characters' materials (finish per slot, cloth, skin tones, wear) replace this function and what fsSkin writes for the slot.
const SLOT_SKIN: u32 = 0u; const SLOT_CLOTH_UNIFORM: u32 = 1u; const SLOT_CLOTH_PLAIN: u32 = 2u; const SLOT_WEBBING: u32 = 3u; const SLOT_BOOT: u32 = 4u;
const SLOT_HELMET: u32 = 5u; const SLOT_METAL_DARK: u32 = 6u; const SLOT_RUBBER: u32 = 7u; const SLOT_LENS: u32 = 8u;
fn slotAlbedo(slot: u32, tint: vec3f, tint2: vec3f) -> vec3f {
  switch (slot) {
    case 0u: { return vec3f(0.42, 0.27, 0.19); }                                  // skin
    case 1u: { return tint; }                                                     // cloth_uniform: the uniform (operators) / the trousers (defenders)
    case 2u: { return tint2; }                                                    // cloth_plain: plain cloth — the shirt (defenders, civilians)
    case 3u: { return mix(tint, vec3f(0.16, 0.15, 0.09), 0.75); }                 // webbing: olive-drab, a little of the uniform in it
    case 4u: { return vec3f(0.035, 0.03, 0.028); }                                // boot
    case 5u: { return mix(tint, vec3f(0.10, 0.11, 0.08), 0.6); }                  // helmet / headgear
    case 6u: { return vec3f(0.03, 0.03, 0.035); }                                 // metal_dark
    case 7u: { return vec3f(0.025, 0.022, 0.02); }                                // rubber (hair, gloves, pads)
    case 8u: { return vec3f(0.05, 0.16, 0.10); }                                  // lens
    case 9u: { return tint2; }                                                    // accent: the member's marking colour (helmet band, brassards)
    case 10u: { return vec3f(0.46, 0.445, 0.42); }                                  // eye: the whites of the eyes (a fixed off-white on every side)
    default: { return tint; }
  }
}

@vertex fn vsSkin(@location(0) position: vec3f, @location(1) normal: vec3f, @location(2) joints: vec4u, @location(3) weights: vec4f,
                  @builtin(instance_index) ii: u32, @location(4) matSel: f32, @location(5) slotGeo: vec2f) -> SkinVOut {
  let ch = chars[ii];
  let base = ch.jointOffset;
  let m = jointMats[base + joints.x] * weights.x + jointMats[base + joints.y] * weights.y + jointMats[base + joints.z] * weights.z + jointMats[base + joints.w] * weights.w;
  let wp = m * vec4f(position, 1.0);
  let wn = normalize((m * vec4f(normal, 0.0)).xyz);
  var o: SkinVOut;
  o.pos = frame.viewProj * vec4f(wp.xyz, 1.0);
  o.normal = wn;
  o.albedo = select(ch.tint, ch.tint2, matSel > 0.5);
  // THE CAST (anim/gltf.ts loadGltfCast): the mesh is a set of PARTS and this man wears the ones in his mask (CharInst.parts); matSel = slot + 16 × part. A part he does
  // not wear collapses outside the clip volume (its triangles are whole parts, so all three corners go) and the slot picks the colour. Mask 0 = the mannequin: the lines above, as ever.
  let parts = ch.parts;
  if (parts != 0u) {
    let ms = u32(matSel + 0.5);
    if (((parts >> (ms >> 4u)) & 1u) == 0u) { o.pos = vec4f(0.0, 0.0, -2.0, 1.0); }
    o.albedo = slotAlbedo(ms & 15u, ch.tint, ch.tint2);
  }
  o.fin = vec4f(0.0); o.mvar = vec4f(0.0); o.grime = vec4f(0.0); o.geo = vec2f(0.0);
  let mb = ii * CHAR_MAT_ROWS; let H0 = charMats[mb];
  if (H0.x > 0.5) {   // this man is shaded per material slot
    let sr = mb + 2u + 2u * min(u32(slotGeo.x + 0.5), 10u);
    let A = charMats[sr]; let B = charMats[sr + 1u]; let H1 = charMats[mb + 1u];
    o.albedo = A.xyz; o.fin = vec4f(A.w, B.x, B.y, 1.0);
    if (LOOK) { o.fin.w = 1.0 + f32(min(u32(slotGeo.x + 0.5), 10u) + 16u * min(u32(H0.x - 0.5), 4u)); }   // THE LOOK PROTOTYPE (look.wgsl lookMan): which slot this is and whose side he is on, for the fragment
    o.mvar = vec4f(B.z, B.w, H0.w, H1.w); o.grime = vec4f(H1.xyz, H0.y); o.geo = vec2f(slotGeo.y, H0.z);
  }
  o.id = 0xFFFFFu | (ch.owner << 20u) | (1u << 28u);
  o.mp = position; o.wp = wp.xyz;
  o.wet = ch.wet; o.wetK = ch.wetK; o.wetK2 = ch.wetK2; o.wetK3 = vec4f(ch.wetK3, 0.0, 0.0);
  let mp = prevJoints[base + joints.x] * weights.x + prevJoints[base + joints.y] * weights.y + prevJoints[base + joints.z] * weights.z + prevJoints[base + joints.w] * weights.w;
  o.wpPrev = (mp * vec4f(position, 1.0)).xyz;
  return o;
}

// ---- wet characters (fsSkin, when CharInst.wet says he is wet): the water on him, in BIND-POSE space so it stays on the cloth whatever the pose does ----
// The bind mesh is a T-pose (+y up, +x his left), read as four kinds of tube: the legs, the trunk and the neck + head about vertical axes — water runs DOWN
// those — and the arms about the shoulder line, water running OUT along them toward the hands (which is down, for an arm that hangs). wetSurface maps a
// bind-pose point to (u = arc round its tube, v = metres along it, decreasing downstream, salt = which tube). Two layers live on that surface:
//   FILM   sheets of water clinging to the cloth in ragged vertical streaks (value noise stretched along the flow, creeping downstream), thicker as the coat
//          soaks, sparing the undersides — this is what breaks a wet man's highlights into streaks instead of a mannequin's even gloss;
//   DROPS  the surface cut into columns WET_COL_W of arc wide and cells one run long, ONE drop per live cell (a hash under density × the beads level: the
//          cells empty one by one as the beads run off): it forms (fades in) at a hashed spot, sits for half its period, lets go and runs its length
//          gathering pace — drawing a soaked trail that thins behind it — and is spent (fades out); the period shortens with the rain rate. A bead is a
//          flattened cap of water: coverage + an outward normal tilt for composite's clear coat to catch the lights with.
const WET_COL_W: f32 = 0.032;        // drop column width (m of arc)
const WET_BEAD_ROUGH: f32 = 0.05;    // roughness of standing water (widened per pixel below: a bead's normals fan ±40° across two or three pixels)
const WET_FILM_W: f32 = 0.014;       // film streak width (m of arc) …
const WET_FILM_L: f32 = 0.16;        // … and length along the flow (m)
struct WetUV { u: f32, v: f32, salt: u32 };
fn wetSurface(mp: vec3f) -> WetUV {
  var o: WetUV;
  let ax = abs(mp.x);
  if (ax > 0.21 && mp.y > 1.3) { o.u = atan2(mp.z + 0.06, mp.y - 1.427) * 0.045; o.v = 1.25 - ax; o.salt = select(3u, 4u, mp.x < 0.0); }   // an arm and its hand: v falls toward the fingertips
  else if (mp.y > 1.52) { o.u = atan2(mp.z, mp.x) * 0.09; o.v = mp.y; o.salt = 2u; }                                                       // neck + head
  else if (mp.y > 0.9) { o.u = atan2(mp.z, mp.x) * 0.14; o.v = mp.y; o.salt = 1u; }                                                         // the trunk
  else { let sx = select(-0.086, 0.086, mp.x >= 0.0); o.u = atan2(mp.z + 0.016, mp.x - sx) * 0.075; o.v = mp.y; o.salt = select(5u, 6u, mp.x < 0.0); }   // a leg and its boot
  return o;
}
fn wetHash(x: u32) -> u32 { var h = x * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return (h >> 22u) ^ h; }
fn wetRand(ci: i32, cj: i32, salt: u32) -> f32 { return f32(wetHash((u32(ci + 8192) * 40503u) ^ (u32(cj + 8192) * 0x9E3779B9u) ^ (salt * 0x85EBCA6Bu)) & 0xffffffu) * (1.0 / 16777216.0); }
/** smooth value noise on the (column, row) lattice, 0‥1 */
fn wetNoise(p: vec2f, salt: u32) -> f32 {
  let i = floor(p); let f = p - i; let w = f * f * (3.0 - 2.0 * f);
  let ix = i32(i.x); let iy = i32(i.y);
  return mix(mix(wetRand(ix, iy, salt), wetRand(ix + 1, iy, salt), w.x), mix(wetRand(ix, iy + 1, salt), wetRand(ix + 1, iy + 1, salt), w.x), w.y);
}
/** The film at (u, v) → (coverage 0‥1, normal tilt along composite's T, tilt along its B): streaky noise creeping downstream, thresholded lower
 *  (= more water) as the coat soaks — about half of him at full soak, the odd rivulet half dry, nothing on a dry coat. The tilts are what turn wet cloth from
 *  a glossy mannequin into water: a rivulet is a ridge whose SHOULDERS lean across the streak, and the water in it is never flat — a fine isotropic wobble
 *  (two smooth noises a few millimetres across, sliding down the streak with the flow) leans every patch of film its own way by up to ~20°. From up here a
 *  lamp low to one side can only mirror in a surface that leans toward the half vector, so at any moment a scatter of those patches GLINT, hard and white,
 *  and as the wobble slides the glints wink in and out and drift down him: running water. (Deliberately not anti-aliased away: a glint narrower than the
 *  pixel is still a white pixel to a camera — the sparkle is the look.) */
const WET_FACET: f32 = 0.006;         // size of one leaning patch of film (m; never under two pixels, see below)
const WET_FACET_TILT: f32 = 0.42;     // how far a patch may lean (tan)
fn wetFilmN(p: vec2f, salt: u32) -> f32 { return wetNoise(p, salt + 40u) * 0.7 + wetNoise(p * vec2f(2.7, 2.1) + 3.1, salt + 41u) * 0.3; }
fn wetFilm(S: WetUV, coat: f32, rain: f32, fp: f32) -> vec3f {
  if (coat <= 0.02) { return vec3f(0.0); }
  let creep = frame.time * (0.012 + 0.02 * rain);                                   // the sheets slide a centimetre or three a second
  let p = vec2f(S.u / WET_FILM_W, (S.v + creep) / WET_FILM_L);
  let n = wetFilmN(p, S.salt);
  let lo = 0.64 - 0.24 * coat;
  let sub = clamp(WET_FILM_W * 1.5 / max(fp, 1e-5), 0.0, 1.0);                      // how well the pixel resolves a streak (1 = fully)
  var film = smoothstep(lo, lo + 0.26, n);                                          // (a soft shoulder: a hard-edged streak reads as a painted stripe up close)
  film = mix(clamp((1.0 - lo - 0.13) * 1.4, 0.0, 1.0) * 0.7, film, sub);           // streaks finer than the pixel: settle on their mean coverage instead of shimmering
  // the shoulders: slope across the streak by a forward difference a fifth of a cell on (the noise is C1), alive only on the rivulet's edge band
  let e = 0.2;
  let nu = wetFilmN(p + vec2f(e, 0.0), S.salt);
  let band = film * (1.0 - film) * 4.0;                                             // 1 on a rivulet's shoulder, 0 in its middle and off it
  var tT = -(nu - n) / e * band * sub * 0.5;                                        // (+u runs along −T)
  // the wobble: patches WET_FACET across (or two pixels, whichever is more — a patch must not flicker under the pixel grid) sliding down with the flow at a
  // few centimetres a second, each leaning its own way
  let cg = max(WET_FACET, 2.2 * fp);
  let q = vec2f(S.u, S.v + creep * 2.5) / cg;
  let jx = wetNoise(q, S.salt + 43u) - 0.5; let jy = wetNoise(q + vec2f(17.3, 9.1), S.salt + 44u) - 0.5;
  tT += jx * 2.0 * WET_FACET_TILT * film;
  let tB = jy * 2.0 * WET_FACET_TILT * film;
  return vec3f(film, tT, tB) * smoothstep(0.02, 0.3, coat);
}
struct DropOut { bead: f32, trail: f32, tilt: vec2f, rb: f32 };   // bead coverage 0‥1, trail wetness 0‥1, bead normal tilt (along composite's T, along its B: |tilt| ≤ 1 at the rim), bead radius
fn wetDrops(S: WetUV, W: vec4f, K: vec4f, fp: f32) -> DropOut {
  var o: DropOut; o.bead = 0.0; o.trail = 0.0; o.tilt = vec2f(0.0); o.rb = max(K.y, 1e-3);
  let u = S.u; let v = S.v; let salt = S.salt;
  let rain = clamp(W.z, 0.0, 1.0);
  let rbMax = K.y * 1.25; let runMax = K.z * 1.3;
  let cellL = runMax + 2.0 * rbMax + 0.03;
  let colW = max(WET_COL_W, 2.0 * rbMax + 0.006);
  let ci = i32(floor(u / colW)); let cj = i32(floor(v / cellL));
  if (wetRand(ci, cj, salt) >= K.x * W.y) { return o; }             // no drop in this cell
  let rb = max(K.y, 1e-3) * (0.75 + 0.5 * wetRand(ci, cj, salt + 11u));
  let runL = K.z * (0.7 + 0.6 * wetRand(ci, cj, salt + 12u));
  let margin = rb / colW + 0.08;
  let ub = (f32(ci) + mix(margin, 1.0 - margin, wetRand(ci, cj, salt + 13u))) * colW;
  let v0 = f32(cj) * cellL + runL + rb + wetRand(ci, cj, salt + 14u) * max(cellL - runL - 2.0 * rb, 0.0);   // where it forms and sits (its run then ends inside this cell: no neighbour to look at)
  let period = mix(2.5, 7.0, wetRand(ci, cj, salt + 15u)) / (0.4 + rain);
  let ph = fract((frame.time + W.w) / period + wetRand(ci, cj, salt + 16u));
  let g = smoothstep(0.5, 1.0, ph);                                     // sits, then lets go and gathers pace
  let vb = v0 - g * runL;
  let life = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.93, 1.0, ph));
  let d = vec2f(u - ub, v - vb) / rb;
  let r = length(d);
  let aa = clamp(fp / rb, 0.03, 1.5);
  var bead = (1.0 - smoothstep(1.0 - aa, 1.0 + 0.5 * aa, r)) * life;
  bead *= clamp(1.6 * rb / max(fp, 1e-5), 0.0, 1.0);                   // under a pixel across: fade by coverage instead of crawling
  let above = v - vb; let tl = g * runL;
  var trail = 0.0;
  if (above > 0.0 && above < tl + rb) {
    let k = clamp(above / max(tl, 1e-4), 0.0, 1.0);
    let wdt = rb * mix(0.55, 0.3, k);                                    // the streak narrows away from the bead
    let aau = max(fp, 0.0015);
    trail = (1.0 - smoothstep(wdt - 0.5 * aau, wdt + 0.5 * aau, abs(u - ub))) * (1.0 - 0.6 * k) * life * clamp(2.5 * wdt / aau, 0.0, 1.0);
  }
  o.bead = bead; o.trail = trail * (1.0 - bead); o.rb = rb;
  o.tilt = clamp(vec2f(-d.x, d.y), vec2f(-1.0), vec2f(1.0)) * bead;      // (+u runs along −T and +v along +B of the tangent frame composite builds off the normal)
  return o;
}
// What composite needs to light the coat, in the id's low 20 bits (all ones on a dry character pixel, and bit 30 clear): roughness 0.03‥0.65 (5 bits), gain 0‥2
// (5), the bead's normal tilt along T and B, −1‥1 (5 + 5, 16 = none). composite.wgsl wetCoatSpec unpacks the same way.
fn packWet(rough: f32, gain: f32, tilt: vec2f) -> u32 {
  let r5 = u32(clamp((rough - 0.03) / 0.62, 0.0, 1.0) * 31.0 + 0.5);
  let g5 = u32(clamp(gain * 0.5, 0.0, 1.0) * 31.0 + 0.5);
  let tu = u32(clamp(round(tilt.x * 15.0) + 16.0, 1.0, 31.0));
  let tv = u32(clamp(round(tilt.y * 15.0) + 16.0, 1.0, 31.0));
  return (r5 | (g5 << 5u) | (tu << 10u) | (tv << 15u)) & 0xFFFFFu;   // (masked: whatever the inputs, nothing here reaches the owner byte or the flag bits)
}

@fragment fn fsSkin(v: SkinVOut) -> GOut {
  var o: GOut;
  var albedo = v.albedo; var id = v.id;
  var n = normalize(v.normal);
  let lmx = dpdx(v.mp); let lmy = dpdy(v.mp); let lwx = dpdx(v.wp); let lwy = dpdy(v.wp);   // THE LOOK PROTOTYPE (look.wgsl lookMan): the steps its relief stands on, taken here in uniform flow
  // how fast the normal turns across this pixel (uniform control flow: derivatives of the interpolated normal, two subtractions a pixel) — the wet coat's
  // specular anti-aliasing below: a limb 5 cm in radius turns several degrees within one pixel from up here, and a lobe narrower than that would light one
  // pixel in three along it and crawl as he moves (Tokuyoshi & Kaplanyan's kernel: alpha² += ½·Var(n), capped)
  let dnx = dpdx(v.normal); let dny = dpdy(v.normal);
  let nKr2 = min(0.5 * (dot(dnx, dnx) + dot(dny, dny)), 0.18);
  // CHARACTER MATERIALS: the slot's colour arrives in v.albedo; here the variation the MESH gives it — creases darker and duller, ridges worn lighter, the ground's
  // dust climbing from the sole — and the finish its highlight takes (the wet coat's lobe: packWet below → composite.wgsl wetCoatSpec). v.fin.w 0 = none of this.
  let slotted = v.fin.w > 0.5;
  var dRough = 0.65; var dGain = 0.0;   // (dRough: before the specular anti-aliasing — the wet branch below widens its own)
  if (slotted) {
    let crease = max(v.geo.x, 0.0) * v.mvar.y; let ridge = max(-v.geo.x, 0.0) * v.mvar.y;
    albedo = albedo * (1.0 - v.mvar.z * crease);
    albedo = mix(albedo, albedo * 1.5 + vec3f(0.012), v.mvar.w * ridge);
    let dust = v.mvar.x * (1.0 - smoothstep(v.grime.w, v.grime.w + v.geo.y, v.mp.y)) * (0.75 + 0.25 * crease);
    albedo = mix(albedo, v.grime.xyz, clamp(dust, 0.0, 1.0) * 0.6);
    dRough = mix(v.fin.x, 0.65, clamp(dust + 0.5 * crease - 0.25 * ridge, 0.0, 1.0));           // dust and creases dull it, a rubbed ridge is a touch shinier
    dGain = v.fin.y * (1.0 - 0.7 * clamp(dust, 0.0, 1.0)) * (1.0 - 0.5 * crease);
    if (LOOK) {   // THE LOOK PROTOTYPE (look.wgsl lookMan; dead code on every other page): the slot drawn as the stuff it is
      let lm = lookMan(u32(v.fin.w - 0.5), v.mp, lmx, lmy, lwx, lwy, n, albedo, dRough, dGain, v.geo.x, vec4f(v.grime.xyz, clamp(dust, 0.0, 1.0)), (v.id >> 20u) & 0xFFu, distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y);
      albedo = lm.albedo; n = lm.n; dRough = lm.rough; dGain = lm.gain;
    }
    let aaRough = pow(clamp(pow(dRough, 4.0) + nKr2, 0.0, 1.0), 0.25);                            // the wet coat's specular anti-aliasing (below), for the same reason
    id = (v.id & 0xFFF00000u) | packWet(aaRough, dGain, vec2f(0.0)) | (1u << 30u);
  }
  let soak = select(1.0, v.fin.z, slotted);   // how much of the rain's darkening this material takes (1 with no slots: every factor below is then the one it always was)
  let W = v.wet;
  // the WATERLINE (wetK3, game/wet.ts wetLineRow): the coat — and any drops — only below it, easing to nothing across the wicking band above; the rain's line sits far over
  // his head (all of him, exactly as before there was one), a wading depth wets him to there and leaves the rest of him the dry man he was
  let below = 1.0 - smoothstep(v.wetK3.x, v.wetK3.x + max(v.wetK3.y, 0.005), v.mp.y);
  if ((W.x > 0.0 || W.y > 0.0) && below > 0.0) {   // wet (game/wet.ts) — a dry man, or the dry part of one, never enters: those pixels are stored exactly as they always were
    let K = v.wetK; let K2 = v.wetK2;    // K = (bead density, bead radius, run length, film roughness) · K2 = (dry-cloth roughness, darken exponent, darken multiplier, specular gain)
    let fp = distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y;   // the pixel's footprint on him (m)
    let S = wetSurface(v.mp);
    let expo = smoothstep(-0.55, 0.05, n.y);                        // undersides (the arm's, the chin's, a thigh's back when he kneels) take less of it
    let coat = W.x * mix(0.7, 1.0, expo) * below;
    let rain = clamp(W.z, 0.0, 1.0);
    // wet fabric / webbing / plastic: the water fills the weave that scattered white — darker in LUMINANCE (lum^(darken·coat), so dark cloth drops hardest, as
    // soaked cloth does) × (1 − darkenMul·coat), and a touch more saturated about that grey (a per-channel power would turn a blue-black suit teal)
    let lum0 = max(dot(albedo, vec3f(0.2126, 0.7152, 0.0722)), 1e-4);
    let kd = pow(lum0, K2.y * (coat * soak)) * (1.0 - K2.z * (coat * soak));
    let L = lum0 * kd;
    // the albedo target is 8 bits a channel: below ~0.03 a hue cannot survive quantisation (a blue-black suit taken to 0.002 stores as (0, 1, 1)/255 — teal), so
    // the chroma fades out toward that floor and a soaked black suit goes to a neutral near-black instead
    let keepChroma = smoothstep(0.006, 0.03, L);
    albedo = mix(vec3f(max(L, 0.004)), max(mix(vec3f(L), albedo * kd, 1.0 + 0.25 * (coat * soak)), vec3f(0.0)), keepChroma);
    let F3 = wetFilm(S, coat, rain, fp) * expo; let film = F3.x;
    var dr: DropOut; dr.bead = 0.0; dr.trail = 0.0; dr.tilt = vec2f(0.0); dr.rb = K.y;
    if (W.y > 0.0) { dr = wetDrops(S, W, K, fp); dr.bead *= below; dr.trail *= below; dr.tilt *= below; }   // (drops stand on him only where he is wet — the band's are half there)
    let soaked = max(film, dr.trail);
    albedo *= 1.0 - 0.07 * film - 0.12 * dr.trail;   // where the water stands the cloth is darker still (gently for the film — its gloss is what shows it — plainly along a drop's trail)
    // for composite's clear coat: damp cloth is a wide, dim lobe; the film a tight bright one whose rivulet edges tilt the normal; a bead is water, its normals
    // fanning right across it (widened by the pixel's footprint so the whole drop answers a lamp, not one lucky pixel of it); the gain follows the coat — and a
    // bead or a fresh trail glints even on cloth that has half dried
    let dryR = select(K2.x, dRough, slotted);                              // (a slotted material dries back to ITS finish, not to the one dry-cloth number)
    var rough = mix(dryR, mix(dryR, K.w, 0.3), clamp(coat, 0.0, 1.0));    // damp cloth
    rough = mix(rough, K.w, soaked);                                        // film / trail
    rough = mix(rough, WET_BEAD_ROUGH, dr.bead);                            // standing water
    var tilt = clamp(F3.yz, vec2f(-0.7), vec2f(0.7)) * (1.0 - dr.bead) + dr.tilt;   // the rivulets' shoulders and waves, then the bead's own cap over them
    // specular anti-aliasing for the SMOOTH terms only: widen the lobe by how much the mesh normal turns inside this pixel (nKr2) and by a bead's cap fanning
    // ±40° across its two or three pixels, so a highlight along a limb is a line and a bead answers as a whole (alpha² += kernel; alpha = roughness²). The
    // film's wobble is left sharp on purpose — its sub-pixel glints are the sparkle (wetFilm).
    var kr2 = nKr2;
    kr2 += dr.bead * pow(clamp(0.8 * fp / max(dr.rb, 1e-4), 0.0, 0.6), 2.0);
    rough = pow(clamp(pow(rough, 4.0) + kr2, 0.0, 1.0), 0.25);
    var gain = K2.w * clamp(max(max(0.15 * coat, soaked * (0.35 + 0.65 * coat)), dr.bead * 1.8), 0.0, 2.0);
    if (slotted) { gain = max(gain, dGain); }   // a helmet in the rain keeps the highlight it had dry
    id = (v.id & 0xFFF00000u) | packWet(rough, gain, tilt) | (1u << 30u);
  }
  o.albedo = vec4f(albedo, 1.0);
  o.normal = vec4f(n * 0.5 + 0.5, 1.0);
  o.id = id;
  o.vel = motionOf(v.wp, v.wpPrev);
  o.mat = vec2f(1.0, 0.0);       // cloth, webbing, skin: matte to the reflection pass (his wet coat is composite's wetCoatSpec, off the id bits above — the two never stack)
  o.edge = EDGE_NONE;            // GBAA: a skinned man's silhouette is the temporal resolve's business (no analytic edge for a triangle without its neighbours)
  return o;
}
