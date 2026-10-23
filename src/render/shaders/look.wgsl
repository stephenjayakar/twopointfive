// THE LOOK PROTOTYPE (the page /look; render/frame.ts lookConfig, the scene prelude's const `LOOK`). Not the game's look: a place to find out how far materials can
// carry a world of boxes inside the frame's budget. This file is in the g-buffer module ONLY on that page (render/gbuffer.ts lookWgsl); every other page gets a stub.
//
// What it does to a box pixel, in the g-buffer and nowhere else:
//   MAPS      eleven tiling materials made by the page at boot (render/lookTex.ts: paint, height, normal, roughness, cavity), picked by the box's paint class
//             (lookClass, written out by render/gbuffer.ts from the palette) and laid in metres: along a wall and up it, world x z on the ground, along the long
//             side of a board or a sheet, and in the box's own frame for cloth, bare metal and old paint (a sack carries its weave with it).
//   UNTILE    the four that have no courses (mud, plaster, earth, gravel) are read twice, the second turned and shifted, and cross-faded by a slow noise and
//             by height, so a 2 m map does not print its repeat on a 40 m yard.
//   WEATHER   what follows the BUILDING, not the map: damp and dirt climbing a wall's foot to a ragged line, a bleached head and the runs under it, slow blotches;
//             on the ground the level's own traffic map (render/wear.ts) — walked earth packed pale and smooth, dirt and stones gathered where nobody walks,
//             against the walls.
//   RELIEF    the map's normal, stood on the face. The g-buffer keeps the TILTED normal with alpha 0 (the target's spare code); gdown hands every working-size
//             pass the box's own face back (common.wgsl lookGeoN), so the filters, the gather and the reservoirs see the flat wall they always saw, and only the
//             screen-size direct light (sharp_direct.wgsl) and the composite's sky share light the relief.
//   EDGES     a small box's arrises are rounded in the normal and rubbed pale: a crate stops being twelve triangles.
//   SNOW      on a snow level (snow.wgsl's field is live), lookSnow below: snow blown against the foot of what stands in the open, and lying on what was left out.
// Numbers the page's panel moves live: lookCfg (render/gbuffer.ts setLook).
@group(1) @binding(11) var lookA: texture_2d_array<f32>;
@group(1) @binding(12) var lookB: texture_2d_array<f32>;
@group(1) @binding(13) var lookSamp: sampler;
struct LookCfg { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f };   // a = paint, relief, shine, weather · b = untile, edges, cavity, map size × · c, d, e.xyz = the eleven layers' base roughness · e.w = the snow that clings · f.x = × the lying snow's relief, f.y = its crust
@group(1) @binding(14) var<uniform> lookCfg: LookCfg;

const LOOK_TILE: f32 = 2.0;        // metres a map covers (render/lookTex.ts LOOK_TILE)
const LOOK_MAX_TILT: f32 = 0.48;   // the tangent part of the shading normal is held under this (29°): lookGeoN's snap back to the face must never pick a neighbour, and a wall's facet never reads as a top (fogofwar.wgsl asks N.y > 0.5)
const LOOK_CLOTH: u32 = 9u;        // the look's own classes, after surface.wgsl's eight: sackcloth, canvas, blankets, rugs
const LOOK_METAL: u32 = 10u;       // bare iron, rusted
const LOOK_PAINT: u32 = 11u;       // old paint on steel or boards: drums, gates, a truck
const LOOK_MIN_TILT: f32 = 0.02;   // … and under this the pixel is the face, unmarked (a flat stretch of a map costs no second light score)

struct LookOut { albedo: vec3f, n: vec3f, rough: f32, tilted: bool };
struct LookTap { a: vec4f, b: vec4f };
fn lookTap(layer: i32, st: vec2f, dx: vec2f, dy: vec2f) -> LookTap {
  var t: LookTap; t.a = textureSampleGrad(lookA, lookSamp, st, layer, dx, dy); t.b = textureSampleGrad(lookB, lookSamp, st, layer, dx, dy); return t;
}
fn lookBase(layer: i32) -> f32 { if (layer < 4) { return lookCfg.c[layer]; } if (layer < 8) { return lookCfg.d[layer - 4]; } return lookCfg.e[layer - 8]; }
fn lookSlow(p: vec2f) -> f32 { return 0.55 * detailNoise(p) + 0.3 * detailNoise(p * 2.13 + vec2f(7.3, 1.9)) + 0.15 * detailNoise(p * 4.31 + vec2f(2.1, 9.4)); }

// a scatter of soft round clots over a plane (snow stuck to a face, frost on the ground): one a cell, each with its own place and size, no finer than a pixel
// and a half (the cell doubles with distance, in octaves, as the snow field's own grains do). `dens` = the share of cells that hold one
fn lookClots(p: vec2f, fp: f32, dens: f32, salt0: u32) -> f32 {
  let gc = 0.025 * exp2(ceil(log2(max(1.5 * fp, 0.025) / 0.025)));
  let q = p / gc; let cell = vec2i(floor(q)); let salt = salt0 + 7u * u32(log2(gc / 0.025) + 0.5);
  if (snowHash(cell, salt + 3u) >= dens) { return 0.0; }
  let rad = 0.12 + 0.25 * snowHash(cell, salt + 2u);
  let ext = vec2f(rad, rad / 0.75);                                                        // (a clot sags: a little taller than wide; it is kept whole inside its cell)
  let ctr = ext + (1.0 - 2.0 * ext) * vec2f(snowHash(cell, salt), snowHash(cell, salt + 1u));
  return 1.0 - smoothstep(rad * 0.45, rad, length((fract(q) - ctr) * vec2f(1.0, 0.75)));
}
fn lookSurface(cls: u32, wp: vec3f, n: vec3f, bi: u32, lc: vec3f, hf: vec4f, albedoIn: vec3f, roughIn: f32, dwx: vec3f, dwy: vec3f, fp: f32) -> LookOut {
  var o: LookOut; o.albedo = albedoIn; o.n = n; o.rough = roughIn; o.tilted = false;
  if (hf.w < 0.0 || (all(lookCfg.a == vec4f(0.0)) && all(lookCfg.b.xyz == vec3f(0.0)))) { return o; }   // (every amount at 0: the box as the game draws it, and none of the reads below)
  let b = boxGeo[bi];
  if ((b.flags & (BOX_EMISSIVE | BOX_ROT)) != 0u) { return o; }
  let lying = abs(n.y) > 0.9;
  if (!lying && abs(n.y) > 0.1) { return o; }
  let q = boxRot(bi);
  let ax = u32(hf.w + 0.5) / 2u;
  var ea: vec3f; var eb: vec3f;                                 // the face's two box axes
  if (ax == 0u) { ea = vec3f(0.0, 0.0, 1.0); eb = vec3f(0.0, 1.0, 0.0); } else if (ax == 1u) { ea = vec3f(1.0, 0.0, 0.0); eb = vec3f(0.0, 0.0, 1.0); } else { ea = vec3f(1.0, 0.0, 0.0); eb = vec3f(0.0, 1.0, 0.0); }
  var tilt = vec2f(0.0);                                         // the shading normal's tangent part, along T and B
  var T: vec3f; var B: vec3f; var uv: vec2f;
  var alb = albedoIn; var rough = roughIn;
  let k = lookCfg.a; let k2 = lookCfg.b;
  if (cls != 0u) {
    if (cls == SURF_WOOD || cls == SURF_SHEET || cls >= LOOK_CLOTH) {   // the box's own: a door carries its boards round with it
      if (cls < LOOK_CLOTH && dot(abs(eb), hf.xyz) > dot(abs(ea), hf.xyz) && (lying || cls == SURF_WOOD)) { let t = ea; ea = eb; eb = t; }   // boards run the long way; a standing sheet's ribs run up
      if (cls == SURF_SHEET && min(dot(abs(eb), hf.xyz), dot(abs(ea), hf.xyz)) < 0.2) { return o; }                       // a bucket is not a roof sheet
      uv = vec2f(dot(lc, ea), dot(lc, eb)) + vec2f(0.37, 0.61) * f32(bi % 7u);
      T = quatRotate(q, ea); B = quatRotate(q, eb);
    } else if (lying) { T = vec3f(1.0, 0.0, 0.0); B = vec3f(0.0, 0.0, 1.0); uv = wp.xz; }
    else { T = normalize(vec3f(-n.z, 0.0, n.x)); B = vec3f(0.0, 1.0, 0.0); uv = vec2f(dot(wp, T), wp.y); }
    let layer = i32(cls) - 1;
    let sc = 1.0 / (LOOK_TILE * max(k2.w, 0.1));
    let st = uv * sc; let dx = vec2f(dot(dwx, T), dot(dwx, B)) * sc; let dy = vec2f(dot(dwy, T), dot(dwy, B)) * sc;
    var tp = lookTap(layer, st, dx, dy);
    var tn = tp.b.xy * 2.0 - 1.0;
    if (k2.x > 0.0 && (cls == SURF_MUD || cls == SURF_PLASTER || cls == SURF_EARTH || cls == SURF_GRAVEL)) {   // UNTILE
      let c = 0.8197; let s = 0.5729;                             // a turn of 0.61 rad
      let st2 = vec2f(c * st.x - s * st.y, s * st.x + c * st.y) * 0.87 + vec2f(0.37, 0.71);
      let t2 = lookTap(layer, st2, vec2f(c * dx.x - s * dx.y, s * dx.x + c * dx.y) * 0.87, vec2f(c * dy.x - s * dy.y, s * dy.x + c * dy.y) * 0.87);
      let m = lookSlow(uv * 0.19 + vec2f(3.7, 11.2));
      let w = smoothstep(0.4, 0.6, m + (t2.a.a - tp.a.a) * 0.3) * k2.x;
      let g2 = t2.b.xy * 2.0 - 1.0;
      tn = mix(tn, vec2f(c * g2.x + s * g2.y, -s * g2.x + c * g2.y), w);
      tp.a = mix(tp.a, t2.a, w); tp.b = mix(tp.b, t2.b, w);
    }
    var mult = tp.a.rgb * 2.0; var cav = tp.b.a; var dr = tp.b.z - lookBase(layer);
    // ---- WEATHER on the ground: the level's traffic map (r = walked, g = close to a wall)
    if (k.w > 0.0 && lying && n.y > 0.0 && wp.y < 0.25) {
      let wuv = (wp.xz - WORLD_MIN.xz) / (vec2f(f32(GRID_W), f32(GRID_H)) * GRID_CELL);
      let wm = textureSampleLevel(wearTex, linSamp, wuv, 0.0);
      let rag = lookSlow(uv * 0.9);
      let walked = clamp(wm.x * (0.5 + rag), 0.0, 1.0) * k.w;
      let lee = smoothstep(0.25, 0.75, wm.y * (0.55 + 0.9 * rag)) * k.w;      // against the walls, where nobody treads
      if (cls == SURF_EARTH && lee > 0.02) {                                   // stones and rubbish work their way to the wall's foot: the gravel map comes up through the earth by height
        let gv = lookTap(i32(SURF_GRAVEL) - 1, st * 1.3 + vec2f(0.21, 0.43), dx * 1.3, dy * 1.3);
        let up = smoothstep(0.45, 0.75, lee * 0.9 + (gv.a.a - 0.55) * 0.9);
        mult = mix(mult, gv.a.rgb * 2.0 * vec3f(0.82, 0.8, 0.78), up); tn = mix(tn, gv.b.xy * 2.0 - 1.0, up); cav = mix(cav, gv.b.a, up); dr = mix(dr, -0.06, up);
      }
      mult *= 1.0 - 0.3 * lee;
      mult *= 1.0 + 0.24 * walked; tn *= 1.0 - 0.55 * walked; cav = mix(cav, 1.0, 0.6 * walked); dr -= 0.1 * walked;   // beaten flat and pale
    }
    alb *= mix(vec3f(1.0), mult, k.x) * mix(1.0, 0.5 + 0.5 * cav, k2.z);
    rough = rough + dr * k.z;
    tilt = tn * k.y;
    // ---- a snow level's bare ground (earth a man cleared, a rut): within a stride of lying snow it is frozen — ice in the low places, dark and smooth enough to
    // show a lamp, and frost grains over the rest, thinning away from the snow
    if (SNOW_SURF && lookCfg.e.w > 0.0 && snowCfg.p[1].z > 0.5 && lying && n.y > 0.0 && wp.y < 0.06 && (cls == SURF_EARTH || cls == SURF_GRAVEL)) {
      let e = 0.3;   // (the field knows no roof here: a floor of earth inside an outer wall takes a hand's width of this along the wall — known, left)
      let near = max(max(snowField(wp.xz + vec2f(e, 0.0)).y, snowField(wp.xz - vec2f(e, 0.0)).y), max(snowField(wp.xz + vec2f(0.0, e)).y, snowField(wp.xz - vec2f(0.0, e)).y));
      if (near > 0.02) {
        let ks = min(lookCfg.e.w, 1.5);
        let ice = smoothstep(0.6, 0.66, lookSlow(wp.xz * 0.55 + vec2f(8.3, 2.9)) - 0.25 * (tp.a.a - 0.5)) * near * min(ks, 1.0);
        alb = mix(alb, alb * vec3f(0.5, 0.56, 0.66), ice * 0.8); rough = mix(rough, 0.1, ice * 0.9); tilt *= 1.0 - 0.9 * ice;
        let dens = near * ks * (0.1 + 0.4 * lookSlow(wp.xz * 1.3 + vec2f(2.2, 6.1))) * (1.0 - ice);
        let fr = max(0.85 * lookClots(wp.xz, fp, dens, 9u), 0.35 * dens * (0.5 + detailNoise(wp.xz * 19.0)));   // clots, and a thin bloom of rime between them
        alb = mix(alb, snowCfg.p[2].xyz, fr); rough = mix(rough, 0.9, fr);
      }
    }
  } else {
    T = quatRotate(q, ea); B = quatRotate(q, eb); uv = vec2f(dot(wp, T), dot(wp, B));
  }
  // ---- WEATHER on anything that stands on the ground or lies in the open: slow blotches; a wall's foot and head
  if (k.w > 0.0 && cls != 0u) {
    let slow = lookSlow(uv * 0.33 + vec2f(5.0, 2.0)); let slower = detailNoise(uv * 0.09 + vec2f(1.3, 8.1));
    alb *= 1.0 + k.w * select(1.0, 1.7, lying) * (0.3 * (slow - 0.5) + 0.2 * (slower - 0.5));   // (the ground most of all: forty metres of one paint)
    alb *= mix(vec3f(1.0), mix(vec3f(1.05, 1.0, 0.93), vec3f(0.95, 1.0, 1.06), smoothstep(0.3, 0.7, detailNoise(uv * 0.13 + vec2f(9.7, 4.2)))), 0.6 * k.w);   // … and no two stretches quite one hue
    if (!lying && cls != SURF_WOOD) {
      let foot0 = b.c.y - b.h.y;
      if (foot0 < 0.12) {                                                       // the wall stands on the ground: splash, damp and the dirt the rain throws up, to a ragged line
        let line = 0.18 + 0.55 * detailNoise(vec2f(uv.x * 0.7, 3.3)) + 0.16 * detailNoise(vec2f(uv.x * 6.0, 9.1)) + 0.05 * detailNoise(uv * vec2f(23.0, 9.0));
        let foot = (1.0 - smoothstep(0.0, line, wp.y)) * k.w;
        let rim = smoothstep(line * 0.72, line, wp.y) * (1.0 - smoothstep(line, line * 1.18, wp.y)) * k.w;   // the tide mark: salts left where the damp stops
        alb = mix(alb, alb * vec3f(0.6, 0.55, 0.5), foot * 0.85); rough = rough - 0.07 * foot;
        alb *= 1.0 + 0.16 * rim;
      }
      let top = b.c.y + b.h.y;
      if (b.h.y > 0.6 && top < CEIL_Y + 0.6) {                                  // its head: bleached and worn back, and the dark runs the rain leaves under it
        let dTop = top - wp.y;
        let bleach = (1.0 - smoothstep(0.05, 0.3 + 0.35 * detailNoise(vec2f(uv.x * 1.3, 6.6)), dTop)) * k.w;
        let run = pow(detailNoise(vec2f(uv.x * 7.0, 1.7)), 3.0) * smoothstep(0.45, 0.7, detailNoise(vec2f(uv.x * 0.55, 12.3))) * (1.0 - smoothstep(0.2, 1.3 + 1.2 * detailNoise(vec2f(uv.x * 2.1, 4.4)), dTop)) * smoothstep(0.02, 0.12, dTop) * k.w;
        alb *= 1.0 + 0.22 * bleach; alb *= 1.0 - 0.3 * run;   // (runs come in stretches, under where the head sheds, never as a fence of stripes)
      }
    }
  }
  // ---- EDGES: a small box's arrises rounded and rubbed (a crate, a table, a sill — not a wall, whose boxes meet their neighbours edge to edge)
  if (k2.y > 0.0 && max(b.h.x, b.h.z) < 0.65 && b.h.y < 0.8 && min(b.h.x, min(b.h.y, b.h.z)) > 0.02) {   // (half-extents: under 1.3 m on its long side and 1.6 m tall)
    let ha = dot(abs(ea), hf.xyz); let hb = dot(abs(eb), hf.xyz);
    let pa = dot(lc, ea); let pb = dot(lc, eb);
    let da = ha - abs(pa); let db = hb - abs(pb);                              // metres in from the face's two pairs of edges
    let r = clamp(1.7 * fp, 0.012, 0.045);
    let wa = 1.0 - smoothstep(0.0, r, da); let wb = 1.0 - smoothstep(0.0, r, db);
    if (wa + wb > 0.0) {
      let TA = quatRotate(q, ea); let TB = quatRotate(q, eb);
      let floorEdge = !lying && b.c.y - b.h.y < 0.05;                           // where a face meets the ground there is no arris to round
      var e = vec2f(wa * wa * sign(pa), wb * wb * sign(pb)) * 0.6 * k2.y;
      var wear = max(wa, wb);
      if (floorEdge) { if (abs(TA.y) > 0.5 && pa * TA.y < 0.0) { e.x = 0.0; wear = wb; } if (abs(TB.y) > 0.5 && pb * TB.y < 0.0) { e.y = 0.0; wear = wa; } }
      if (cls == 0u) { tilt = e; } else { tilt += vec2f(dot(TA * e.x + TB * e.y, T), dot(TA * e.x + TB * e.y, B)); }
      let chip = smoothstep(0.35, 0.75, detailNoise(vec2f(pa + pb, pa - pb) * 23.0 + vec2f(f32(bi % 13u))));
      alb *= 1.0 + 0.3 * wear * wear * chip * k2.y; rough = rough + 0.08 * wear * k2.y;
    }
  }
  let tl = length(tilt); if (tl > LOOK_MAX_TILT) { tilt *= LOOK_MAX_TILT / tl; }
  if (tl > LOOK_MIN_TILT) {
    if (cls == 0u) { T = quatRotate(q, ea); B = quatRotate(q, eb); }
    o.n = normalize(n * sqrt(max(1.0 - min(tl * tl, LOOK_MAX_TILT * LOOK_MAX_TILT), 0.0)) + T * tilt.x + B * tilt.y);
    o.tilted = true;
  }
  o.albedo = clamp(alb, vec3f(0.0), vec3f(1.0)); o.rough = clamp(rough, 0.05, 1.0);
  return o;
}

struct LookSnow { albedo: vec3f, n: vec3f, rough: f32, amt: f32, bank: bool };   // (bank: lying or banked snow — the pixel is the snow's, normal and all; else a grain stuck to a face: paint and finish only)
/** SNOW THAT CLINGS (a snow level on the look page; snow.wgsl's field and finish). The level's snow is laid by hand on the ground and as caps; this is what that
 *  leaves bare. On a face that stands on open ground: snow blown against its foot to a ragged line, higher where the face looks into the wind and where a drift
 *  stands against it, and flecks plastered above that. On a top left out under the sky (a crate, a stack of planks, a sill, a gatepost): snow lying on it, stopping short of its
 *  edges along a line that wanders, rolled off over its last hand. `cls` = the paint's class, `gn` = the face, `paint` = the box's own paint. amt 0 = the pixel as it was. */
fn lookSnow(cls: u32, wp: vec3f, gn: vec3f, bi: u32, lc: vec3f, hf: vec4f, paint: vec3f, albedoIn: vec3f, roughIn: f32, fp: f32) -> LookSnow {
  var o: LookSnow; o.albedo = albedoIn; o.n = gn; o.rough = roughIn; o.amt = 0.0; o.bank = false;
  let ks = lookCfg.e.w;
  if (ks <= 0.0 || hf.w < 0.0 || cls == LOOK_METAL) { return o; }   // (bare iron stays bare: on a snow level it is a stove, a flue or a brazier)
  let b = boxGeo[bi];
  if ((b.flags & (BOX_EMISSIVE | BOX_ROT | BOX_GLASS)) != 0u || snowIsPaint(paint) || snowIsLay(paint)) { return o; }
  var amt = 0.0; var up = vec3f(0.0, 1.0, 0.0); var at = wp; var bank = true;
  if (gn.y > 0.9) {
    if (wp.y < 0.06) { return o; }                               // the ground is the field's
    let open = smoothstep(0.05, 0.4, snowField(wp.xz).y);       // not under a roof
    if (open <= 0.0) { return o; }
    let da = hf.x - abs(lc.x); let db = hf.z - abs(lc.z);
    let small = clamp(min(hf.x, hf.z) / 0.25, 0.2, 1.0);        // (a narrow top keeps a narrow margin)
    let a2 = vec2f(0.8776 * wp.x - 0.4794 * wp.z, 0.4794 * wp.x + 0.8776 * wp.z);
    let wav = 0.7 * detailNoise(a2 * (1.0 / 0.31)) + 0.3 * detailNoise(wp.xz * (1.0 / 0.11) + vec2f(2.7, 6.1));
    let edge = min(da, db) - (0.012 + 0.07 * wav) * small;
    amt = smoothstep(0.0, max(0.012, 1.5 * fp), edge) * open * min(ks, 1.0);
    if (amt <= 0.0) { return o; }
    let t = clamp(1.0 - edge / (0.07 * small), 0.0, 1.0);
    let out2 = select(vec2f(sign(lc.x), 0.0), vec2f(0.0, sign(lc.z)), db < da);
    up = normalize(vec3f(0.0, 1.0, 0.0) + quatRotate(boxRot(bi), vec3f(out2.x, 0.0, out2.y)) * (t * t * 1.3));
  } else {
    if (abs(gn.y) > 0.1 || b.c.y - b.h.y > 0.12 || wp.y > 2.2) { return o; }
    let f = snowField(wp.xz + gn.xz * 0.14);                    // the ground at the face's foot
    let open = smoothstep(0.1, 0.6, f.y);
    if (open <= 0.0) { return o; }
    let wd = snowCfg.p[5].xy; let windward = 0.5 - 0.5 * dot(gn.xz, wd);   // 1 = the face looks into the wind
    let T = normalize(vec3f(-gn.z, 0.0, gn.x)); let ux = dot(wp, T);
    let rag = 0.55 * detailNoise(vec2f(ux * 0.9, 3.3)) + 0.3 * detailNoise(vec2f(ux * 4.7, 9.1)) + 0.15 * detailNoise(vec2f(ux * 17.0, wp.y * 9.0));
    let drift = 0.35 + 1.5 * smoothstep(0.3, 0.75, detailNoise(vec2f(ux * 0.31, 6.6)));   // (no even ribbon: a stretch where it barely stands, a stretch where the wind piled it)
    let line = f.x + open * (0.03 + (0.1 + 0.22 * windward) * rag * drift) * ks;
    // (the bank's own edge is ragged at a finger's width; smooth noise, never a grid: a per-cell step here drew a staircase)
    amt = 1.0 - smoothstep(line * 0.6, line * 1.1 + 0.02, wp.y + (detailNoise(vec2f(ux, wp.y) * 13.0) - 0.5) * 0.05);
    bank = amt > 0.5;
    // above the line: what the wind has stuck to the face. A thin rime that fades a stride up, and in it round clots no finer than a
    // pixel and a half (in octaves, as the field's own grains), each with its own place and size in its cell
    let high = max(wp.y - line, 0.0);
    let patchy = 0.08 + 0.92 * smoothstep(0.42, 0.68, 0.6 * detailNoise(vec2f(ux, wp.y) * 1.9 + vec2f(4.1, 1.7)) + 0.4 * detailNoise(vec2f(ux, wp.y) * 5.3 + vec2f(7.7, 2.2)));   // (in clumps with bare wall between: an even scatter reads as confetti)
    let dens = open * min(ks, 1.5) * (0.06 + 0.4 * windward) * patchy * (1.0 - smoothstep(0.0, 0.45 + 0.9 * rag, high));
    if (!bank) {
      let clot = lookClots(vec2f(ux, wp.y), fp, dens * 1.5, 5u);
      let rime = 0.5 * dens * (0.6 + 0.8 * detailNoise(vec2f(ux, wp.y) * 23.0));
      amt = max(amt, max(0.92 * clot, rime));   // (no bank: it leans nothing and is not the glow's snow — a tilted normal a pixel wide is noise to every filter under it)
    }
    if (amt <= 0.0) { return o; }
    up = normalize(gn + vec3f(0.0, 0.5, 0.0));                  // what stands against a wall is a bank, not the wall (kept under the fog of war's N.y > 0.5 'top')
    at = vec3f(wp.x - gn.x * wp.y, wp.y, wp.z - gn.z * wp.y);   // (the finish is laid in plan: the face unfolded onto the ground, so its grain runs up the wall too)
  }
  let s = snowShade(at, vec4f(0.0, 1.0, 0.0, 0.0), up, fp, false);
  o.albedo = mix(albedoIn, s.albedo, amt); o.rough = mix(roughIn, s.rough, amt); o.amt = amt; o.bank = bank;
  if (bank) { o.n = normalize(mix(gn, s.n, amt)); }
  return o;
}

struct LookGround { n: vec3f, rough: f32 };
/** LYING SNOW on the look page (fsBox's snow ground and the hills, after snow.wgsl snowShade has shaded them): its whole relief (the drifts' slopes, the wind's
 *  ridges, the prints and their rims) × the panel's 'Snow relief' (1 = as the build draws it), and a CRUST: where the wind has glazed fresh snow, in streaks drawn
 *  out along it, the surface is smooth enough to hold a lamp's sheen. Trodden snow (rough 1) and a glinting grain keep what they had. */
fn lookGround(wp: vec3f, nIn: vec3f, roughIn: f32, fp: f32) -> LookGround {
  var o: LookGround; o.n = nIn; o.rough = roughIn;
  let g = lookCfg.f.x;
  if (roughIn < snowCfg.p[6].w + 0.05) { return o; }   // (a glinting grain: its lean is its own, kept small on purpose — snow.wgsl)
  if (g != 1.0 && nIn.y > 0.2) { o.n = normalize(vec3f(nIn.x * g, nIn.y, nIn.z * g)); }
  let kc = min(lookCfg.f.y, 1.5);
  if (kc > 0.0 && roughIn < 0.97) {
    let f = snowField(wp.xz); let fresh = (1.0 - f.z) * (1.0 - f.w);
    let wd = snowCfg.p[5].xy; let u = dot(wp.xz, wd); let v = dot(wp.xz, vec2f(-wd.y, wd.x));
    let c = smoothstep(0.52, 0.7, 0.6 * detailNoise(vec2f(u * (1.0 / 2.6), v * (1.0 / 0.42)) + vec2f(3.1, 7.7)) + 0.4 * detailNoise(vec2f(u * (1.0 / 0.9), v * (1.0 / 0.15)) + vec2f(9.2, 1.3)));
    o.rough = mix(roughIn, 0.56, c * fresh * min(kc, 1.0) * clamp(0.25 / max(fp, 1e-4), 0.0, 1.0));   // (0.56: over every preset's rt.maxRough, so no glaze asks for a reflection ray; a streak finer than the pixel settles to the plain finish)
  }
  return o;
}

// ---- THE MEN (gbuffer.wgsl fsSkin, a man shaded per material slot: render/charMaterials.ts) ----
// The layers above stop at the boxes; a man was still one flat colour a slot, with the mesh's creases. Here each SLOT is drawn as the stuff it is, in the man's
// BIND pose (so nothing swims on him as he moves) and by what he is (the side his rows were written for, and a number of his own so no two men match):
//   CLOTH     thread from the cloth map laid round each limb; folds that ring the limb and gather at the knee, the hip, the ankle, the elbow (a relief the lamps
//             light, gone before it is finer than the picture); an operator's uniform is a disruptive print in four tones of his own colour, every man's cut
//             from another part of the bolt; knees carry the ground's dust; no two men's cloth is quite the same age
//   WEBBING   rows of tape with shadowed gaps, coarser thread, edges rubbed pale
//   HELMET    an operator's wears a cover of his print; anyone's is scuffed to the undercoat on its ridges
//   METAL     rubbed bright on its edges, an oiled sheen between
//   BOOTS     scuffed toes, a leather sheen under the dust
//   SKIN      a tone of his own, the cold in his cheeks, nose and ears on a snow level, a day's growth on some
//   SNOW      on a snow level, lying on what faces up and caked on the boots and hems to a ragged line; most on the men who came in from the weather
// lookCfg.f.z = how much of it (the panel's Men row; 0 = the men as the build draws them). Derivatives are taken by the caller: nothing below needs uniform flow.
struct LookMan { albedo: vec3f, n: vec3f, rough: f32, gain: f32 };
fn manH(i: vec3i) -> f32 { var h = (u32(i.x + 4096) * 73856093u) ^ (u32(i.y + 4096) * 19349663u) ^ (u32(i.z + 4096) * 83492791u); h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return f32((h ^ (h >> 22u)) >> 8u) * (1.0 / 16777216.0); }
/** value noise in the bind pose's space, 0‥1, one lattice cell a unit */
fn manNoise(p: vec3f) -> f32 {
  let fl = floor(p); let i = vec3i(fl); let f = p - fl; let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(manH(i), manH(i + vec3i(1, 0, 0)), u.x), mix(manH(i + vec3i(0, 1, 0)), manH(i + vec3i(1, 1, 0)), u.x), u.y),
             mix(mix(manH(i + vec3i(0, 0, 1)), manH(i + vec3i(1, 0, 1)), u.x), mix(manH(i + vec3i(0, 1, 1)), manH(i + vec3i(1, 1, 1)), u.x), u.y), u.z);
}
fn manBump(x: f32, c: f32, w: f32) -> f32 { return 1.0 - smoothstep(0.0, w, abs(x - c)); }
/** a disruptive print cut from `base`: a dark and a pale shape over the ground colour and dark twigs over the dark, wider than tall, soft-edged to the pixel */
fn manCamo(p: vec3f, base: vec3f, seed: f32, fp: f32) -> vec3f {
  let q = p * vec3f(8.0, 12.5, 8.0) + vec3f(seed * 3.1, seed * 1.7, seed * 5.3);
  let w = vec3f(manNoise(q * 0.7 + vec3f(3.1)), manNoise(q * 0.7 + vec3f(7.7, 1.2, 4.4)), manNoise(q * 0.7 + vec3f(1.3, 9.9, 6.2))) - 0.5;
  let e = clamp(fp * 12.0, 0.015, 0.2);
  let a = manNoise(q + w * 1.8); let b = manNoise(q * 1.7 + vec3f(11.0, 5.0, 2.0) - w * 1.4); let c = manNoise(q * 3.9 + vec3f(5.0, 8.0, 13.0) + w);
  var col = base;
  col = mix(col, base * vec3f(0.5, 0.56, 0.44), smoothstep(0.55 - e, 0.55 + e, a));
  col = mix(col, base * 1.22 + vec3f(0.075, 0.062, 0.04), smoothstep(0.6 - e, 0.6 + e, b));
  col = mix(col, base * vec3f(0.3, 0.27, 0.22), smoothstep(0.7 - e, 0.7 + e, c) * smoothstep(0.45, 0.6, a));
  return col;
}
/** the relief of a man's kit at a bind-pose point (m): cloth's folds, the webbing's rows. Each part is gone before the picture is too coarse to hold it */
fn manArm(p: vec3f) -> bool { return abs(p.x) > 0.21 && p.y > 1.3; }
fn manHeight(slot: u32, p: vec3f, fp: f32) -> f32 {
  if (slot == 1u || slot == 2u) {
    let arm = manArm(p);
    let big = 1.0 - smoothstep(0.02, 0.06, fp); let fine = 1.0 - smoothstep(0.005, 0.016, fp);
    let ax = select(vec3f(1.0, 3.6, 1.0), vec3f(3.6, 1.0, 1.0), arm);                     // a fold rings its limb
    var j = max(max(manBump(p.y, 0.5, 0.16), manBump(p.y, 0.93, 0.14)), manBump(p.y, 0.1, 0.12));   // the knee, the hip, the trouser bunched on the boot
    if (arm) { j = max(manBump(abs(p.x), 0.5, 0.13), manBump(abs(p.x), 0.25, 0.08)); }               // the elbow, the armpit
    let a = manNoise(p * ax * 5.0 + vec3f(3.3, 1.7, 9.1)); let b = manNoise(p * ax * 11.0 + vec3f(8.1, 4.4, 2.6));
    return 0.011 * big * (0.5 + 0.5 * j) * abs(a - 0.5) * 2.0 + 0.004 * fine * (0.35 + 0.65 * j) * abs(b - 0.5) * 2.0;
  }
  if (slot == 3u) {
    let f = fract(p.y / 0.045);
    return 0.0022 * (1.0 - smoothstep(0.004, 0.012, fp)) * smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.56, 0.68, f));
  }
  return 0.0;
}
/** `code` = the slot + 16 × the side (0 operator, 1 defender, 2 responder, 3 civilian, 4 an operator in the dark suit) · mp, dmx, dmy = the bind-pose point and its
 *  step a pixel across and down · wp's steps likewise · cavity −1 ridge ‥ +1 crease · dust = the ground's colour on him and how much stands here · owner = his id */
fn lookMan(code: u32, mp: vec3f, dmx: vec3f, dmy: vec3f, dwx: vec3f, dwy: vec3f, nIn: vec3f, albedoIn: vec3f, roughIn: f32, gainIn: f32, cavity: f32, dust: vec4f, owner: u32, fp: f32) -> LookMan {
  var o: LookMan; o.albedo = albedoIn; o.n = nIn; o.rough = roughIn; o.gain = gainIn;
  let K = min(lookCfg.f.z, 1.5); if (K <= 0.0) { return o; }
  let slot = code & 15u; let side = code >> 4u;
  let seed = f32(owner) * 0.618; let own = fract(seed); let own2 = fract(f32(owner) * 0.3819 + 0.27);
  let ridge = max(-cavity, 0.0);
  let cold = SNOW_SURF && snowCfg.p[1].z > 0.5;
  var alb = albedoIn; var rough = roughIn; var gain = gainIn;
  if (slot == 1u || slot == 2u || slot == 3u) {
    let tile = select(0.3, 0.16, slot == 3u);                                               // (webbing's thread is coarser)
    let S = wetSurface(mp); let Sx = wetSurface(mp + dmx); let Sy = wetSurface(mp + dmy);
    let tp = lookTap(8, vec2f(S.u, S.v) / tile, (vec2f(Sx.u, Sx.v) - vec2f(S.u, S.v)) / tile, (vec2f(Sy.u, Sy.v) - vec2f(S.u, S.v)) / tile);   // (across a seam the steps are huge: the map's coarsest level, a flat tone)
    alb *= mix(vec3f(1.0), tp.a.rgb * 2.0, 0.55 * K) * mix(1.0, 0.6 + 0.4 * tp.b.a, 0.6 * K);
    if (slot == 3u) {
      let f = fract(mp.y / 0.045); let rows = (1.0 - smoothstep(0.004, 0.012, fp)) * (1.0 - smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.56, 0.68, f)));
      alb *= 1.0 - 0.32 * K * rows;
      alb = mix(alb, alb * 1.35 + vec3f(0.01), 0.5 * K * ridge);
    } else {
      if (side == 0u && slot == 1u) { alb = mix(alb, manCamo(mp, alb, seed, fp), K); }
      let age = manNoise(mp * 3.1 + vec3f(seed * 7.0, 2.0, seed));                         // slow blotches: washed, sweated, sat in
      alb *= 1.0 + K * (0.26 * (age - 0.5) + 0.16 * (own2 - 0.5));
      alb = mix(alb, vec3f(dot(alb, vec3f(0.2126, 0.7152, 0.0722))) * vec3f(1.04, 1.0, 0.93), K * (0.1 + 0.22 * own) * smoothstep(1.25, 1.5, mp.y));   // bleached across the shoulders
      let knee = manBump(mp.y, 0.5, 0.11) * smoothstep(0.0, 0.07, mp.z) * step(mp.y, 0.9);
      alb = mix(alb, dust.xyz, 0.4 * K * knee * (0.4 + 0.6 * manNoise(mp * 30.0 + vec3f(seed))));
    }
    // the relief, stood on the skinned normal by the steps of the bind-pose point and of the world point across this pixel
    let h0 = manHeight(slot, mp, fp); let dBs = manHeight(slot, mp + dmx, fp) - h0; let dBt = manHeight(slot, mp + dmy, fp) - h0;
    let R1 = cross(dwy, nIn); let R2 = cross(nIn, dwx); let det = dot(dwx, R1);
    let seam = manArm(mp) != manArm(mp + dmx) || manArm(mp) != manArm(mp + dmy);          // (the folds turn where the sleeve starts: a step across that line is no slope)
    if (abs(det) > 1e-12 && !seam) {
      var nn = normalize(abs(det) * nIn - (dBs * R1 + dBt * R2) * (sign(det) * K));
      let c = dot(nn, nIn); if (c < 0.8) { nn = normalize(nIn * 0.8 + normalize(nn - nIn * c) * 0.6); }
      o.n = nn;
    }
  } else if (slot == 5u) {
    if (side == 0u) { alb = mix(alb, manCamo(mp * 1.15, alb, seed + 3.0, fp), 0.8 * K); }
    let chip = smoothstep(0.62, 0.7, manNoise(mp * 70.0 + vec3f(seed)) * 0.55 + ridge * 0.9) * (1.0 - smoothstep(0.006, 0.02, fp));
    alb = mix(alb, alb * 1.9 + vec3f(0.03), 0.6 * K * max(chip, 0.5 * ridge));
    let sc = manNoise(mp * 24.0 + vec3f(seed * 2.0));
    rough = clamp(rough + K * 0.2 * (sc - 0.5), 0.05, 1.0); gain *= 1.0 + K * 0.6 * (0.5 - sc);
  } else if (slot == 6u) {
    alb = mix(alb, vec3f(0.3, 0.3, 0.32), 0.7 * K * ridge);
    rough = clamp(mix(rough, 0.3, 0.6 * K) + 0.15 * K * (manNoise(mp * 40.0) - 0.5), 0.05, 1.0);
    gain = max(gain, K * (0.9 + ridge));
  } else if (slot == 4u) {
    alb = mix(alb, vec3f(0.12, 0.1, 0.08), 0.6 * K * ridge);
    rough = mix(rough, 0.38, 0.5 * K * (1.0 - dust.w)); gain = max(gain, 0.5 * K * (1.0 - dust.w));
  } else if (slot == 0u) {
    alb *= mix(vec3f(1.0), vec3f(0.86 + 0.28 * own) * mix(vec3f(1.04, 1.0, 0.94), vec3f(0.97, 1.0, 1.05), own2), K);
    let face = smoothstep(0.03, 0.08, mp.z) * step(1.52, mp.y);
    let flush = max(face * manBump(mp.y, 1.64, 0.055), step(0.068, abs(mp.x)) * manBump(mp.y, 1.655, 0.05)) * select(0.35, 1.0, cold);
    alb = mix(alb, alb * vec3f(1.22, 0.86, 0.84), 0.55 * K * flush);
    let growth = face * manBump(mp.y, 1.575, 0.05) * step(0.4, own2);
    alb = mix(alb, alb * vec3f(0.6, 0.62, 0.68), 0.5 * K * growth * (0.6 + 0.4 * manNoise(mp * 160.0)));
    rough = mix(rough, 0.45, 0.5 * K); gain = max(gain, 0.3 * K);
  } else if (slot == 7u) {
    let strand = manNoise(mp * vec3f(130.0, 16.0, 130.0) + vec3f(seed)) * (1.0 - smoothstep(0.004, 0.012, fp)) + 0.5 * smoothstep(0.004, 0.012, fp);
    alb *= 1.0 + K * 0.5 * (strand - 0.5);
    alb = mix(alb, alb * 1.6 + vec3f(0.02), 0.4 * K * ridge);
  }
  if (cold && lookCfg.e.w > 0.0 && slot != 0u && slot != 8u && slot != 10u) {
    let ks = min(lookCfg.e.w, 1.5) * K * select(0.45, 1.0, side == 0u || side == 4u);
    let coarse = smoothstep(0.006, 0.02, fp);
    let g = mix(manNoise(mp * 55.0 + vec3f(seed)), 0.5, coarse); let g2 = manNoise(mp * 17.0 + vec3f(4.0 + seed, 1.0, seed));
    let up = smoothstep(0.45, 0.85, nIn.y) * smoothstep(1.25, 1.4, mp.y);               // on his shoulders, arms and helmet as he stood in it (a man on his back is not a drift)
    let lie = up * smoothstep(0.62 - 0.12 * ks, 0.72 - 0.08 * ks, 0.55 * g + 0.45 * g2);
    let cake = (1.0 - smoothstep(0.08, 0.2 + 0.12 * g2, mp.y)) * smoothstep(0.42, 0.6, 0.5 * g + 0.5 * g2 + 0.12);
    let s = clamp(max(lie, 0.9 * cake) * ks, 0.0, 1.0);
    alb = mix(alb, snowCfg.p[2].xyz, s); rough = mix(rough, 0.9, s); gain *= 1.0 - s;
  }
  o.albedo = max(alb, vec3f(0.0)); o.rough = clamp(rough, 0.05, 1.0); o.gain = max(gain, 0.0);
  return o;
}
