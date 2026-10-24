// THE LOOK PROTOTYPE (the page /look; render/frame.ts lookConfig, the scene prelude's const `LOOK`). Not the game's look: a place to find out how far materials can
// carry a world of boxes inside the frame's budget. This file is in the g-buffer module ONLY on that page (render/gbuffer.ts lookWgsl); every other page gets a stub.
//
// What it does to a box pixel, in the g-buffer and nowhere else:
//   MAPS      eleven tiling materials made by the page at boot (render/lookTex.ts: paint, height, normal, roughness, cavity), picked by the box's paint class
//             (lookClass, written out by render/gbuffer.ts from the palette) and laid in metres: along a wall and up it, world x z on the ground, along the long
//             side of a board or a sheet, and in the box's own frame for cloth, bare metal and old paint (a sack carries its weave with it).
//   UNTILE    the four that have no courses (mud, plaster, earth, gravel) are read twice, the second turned and shifted, and cross-faded by a slow noise and
//             by height, so a 2 m map does not print its repeat on a 40 m yard.
//   MASONRY   a mud wall's stone plinth and the mud brick where its render has fallen: two more maps, laid by the wall's own height and length.
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
struct LookCfg { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f };   // a = paint, relief, shine, weather · b = untile, edges, cavity, map size × · c, d, e.xyz = the eleven layers' base roughness · e.w = the snow that clings · f.x = × the lying snow's relief, f.y = its crust, f.z = the men, f.w = the masonry · g.x = markings as paint (markings.wgsl markSoft), g.y = the men's tailoring, g.z = the men's print (manCamo2) · g.w free
@group(1) @binding(14) var<uniform> lookCfg: LookCfg;

const LOOK_TILE: f32 = 2.0;        // metres a map covers (render/lookTex.ts LOOK_TILE)
const LOOK_MAX_TILT: f32 = 0.48;   // the tangent part of the shading normal is held under this (29°): lookGeoN's snap back to the face must never pick a neighbour, and a wall's facet never reads as a top (fogofwar.wgsl asks N.y > 0.5)
const LOOK_CLOTH: u32 = 9u;        // the look's own classes, after surface.wgsl's eight: sackcloth, canvas, blankets, rugs
const LOOK_METAL: u32 = 10u;       // bare iron, rusted
const LOOK_PAINT: u32 = 11u;       // old paint on steel or boards: drums, gates, a truck
const LOOK_MIN_TILT: f32 = 0.02;   // … and under this the pixel is the face, unmarked (a flat stretch of a map costs no second light score)

/** how far a box's markings are drawn as brushed paint in place of square cells (the panel's Painted marks row) */
fn lookMarkSoft() -> f32 { return lookCfg.g.x; }
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
    // ---- MASONRY: what the wall is MADE of, laid by the wall's own height and length and never by a tile's repeat. A mud wall that stands on the ground has a
    // plinth of field stone (lookTex.ts 'field stone', in the wall's metres from the ground up) to a line that wanders along it, the render lapping down over the
    // stones' heads with a rounded lip; and where the render has let go, in patches that gather above the plinth, the mud brick under it ('mud brick'), a
    // finger's depth back behind a broken edge. Big, specific relief with hard edges: what one low lamp along a wall picks out.
    let km = lookCfg.f.w;
    if (km > 0.0 && cls == SURF_MUD && !lying && max(b.h.x, b.h.z) > 0.3 && b.h.y > 0.12) {   // (any piece of a wall, so a patch does not stop at the seam where two boxes of one wall meet; the plinth is by world height)
      let sv = lookTap(11, st + vec2f(0.13, 0.0), dx, dy);
      let line = (0.34 + 0.4 * detailNoise(vec2f(uv.x * 0.31, 7.7)) + 0.1 * detailNoise(vec2f(uv.x * 1.9, 2.2))) * min(km, 1.0);
      let e = wp.y - line - 0.09 * (sv.a.a - 0.5);                              // under 0: stone (the render's edge follows the stones' heads)
      let stone = 1.0 - smoothstep(-0.012, 0.0, e);
      if (stone > 0.0) {
        mult = mix(mult, sv.a.rgb * 2.0 * (1.0 - 0.3 * smoothstep(-0.05, -0.012, e)), stone);   // (in the lip's shadow)
        tn = mix(tn, sv.b.xy * 2.0 - 1.0, stone); cav = mix(cav, sv.b.a, stone); dr = mix(dr, sv.b.z - 0.95, stone);
      }
      tn.y -= 0.85 * smoothstep(-0.004, 0.01, e) * (1.0 - smoothstep(0.01, 0.034, e));           // the lip, turned down onto the stones
      let pq = uv * vec2f(1.3, 1.6) + vec2f(3.1, 8.6);                                        // (patches up to half a metre: at 2 m a cell a whole wall was bare brick or none of it)
      let thr = 0.75 - 0.04 * min(km, 1.5) - 0.1 * (1.0 - smoothstep(0.2, 1.1, e));             // (most just above the plinth, where the splash works on it)
      let pm = lookSlow(pq) + 0.1 * (tp.a.a - 0.5) + 0.06 * (detailNoise(uv * 11.0) - 0.5);       // ragged by the render's own lumps
      if (pm > thr - 0.04 && stone < 1.0) {
        let bv = lookTap(12, st + vec2f(0.0, 0.031), dx, dy);
        let hole = smoothstep(thr, thr + 0.01, pm) * (1.0 - stone);
        let g = vec2f(lookSlow(pq + vec2f(0.04, 0.0)) - lookSlow(pq - vec2f(0.04, 0.0)), lookSlow(pq + vec2f(0.0, 0.04)) - lookSlow(pq - vec2f(0.0, 0.04))) * vec2f(1.3, 1.6);
        let rim = smoothstep(thr - 0.035, thr, pm) * (1.0 - smoothstep(thr, thr + 0.01, pm)) * (1.0 - stone);
        mult = mix(mult, bv.a.rgb * 2.0 * (0.72 + 0.2 * smoothstep(thr + 0.01, thr + 0.06, pm)), hole);   // (darker under the broken edge)
        tn = mix(tn, bv.b.xy * 2.0 - 1.0, hole); cav = mix(cav, bv.b.a, hole); dr = mix(dr, bv.b.z - 0.95, hole);
        tn += g / max(length(g), 1e-5) * 0.8 * rim; mult *= 1.0 + 0.14 * rim;                    // the render's edge: a finger thick, facing into the hole, its break paler
      }
    }
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
//   TAILORING what was cut and sewn (manCut and the slots' own blocks below): seams, doubled knees and elbows, a sleeve pocket with its patches, the plain body
//             of a combat shirt, bar tacks on the webbing, a helmet cover's seams, band and cat's eyes, sand boots with laces, knee pads, gloves; on the other
//             side a shirt's placket and buttons, long folds in loose trousers, a wool waistcoat and cap
//   SNOW      on a snow level, caked on the boots and hems to a ragged line, most on the men who came in from the weather (none lies on a man: his call)
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
// ---- THE PRINT, ROUND TWO (the panel's Printed cloth row, lookCfg.g.z): manCamo's shapes are one value noise cut at a level, and a lattice's blobs come out
// square-shouldered, which read as big pixels on a sleeve. This is the print as it is on the bolt: a ground that drifts from tan to sage with no edge, hard-edged
// shapes of green and of brown laid over it, cream flecks and dark twigs. Each field is three octaves, every octave turned off the last one's lattice.
fn manRot0(p: vec3f) -> vec3f { return vec3f(dot(p, vec3f(0.36, 0.48, -0.8)), dot(p, vec3f(-0.8, 0.6, 0.0)), dot(p, vec3f(0.48, 0.64, 0.6))); }
fn manRot1(p: vec3f) -> vec3f { return vec3f(dot(p, vec3f(0.6, 0.0, 0.8)), dot(p, vec3f(0.64, 0.6, -0.48)), dot(p, vec3f(-0.48, 0.8, 0.36))); }
fn manFbm(p: vec3f) -> f32 { return (manNoise(p) + 0.5 * manNoise(manRot0(p) * 2.03 + vec3f(17.0)) + 0.25 * manNoise(manRot1(p) * 4.1 + vec3f(31.0))) * (1.0 / 1.75); }
fn manCamo2(p: vec3f, base: vec3f, seed: f32, fp: f32) -> vec3f {
  let q = p * vec3f(5.5, 9.5, 5.5) + vec3f(seed * 3.1, seed * 1.7, seed * 5.3);
  let w = vec3f(manNoise(q * 0.9 + vec3f(3.1)), manNoise(q * 0.9 + vec3f(7.7, 1.2, 4.4)), manNoise(q * 0.9 + vec3f(1.3, 9.9, 6.2))) - 0.5;
  let e = clamp(fp * 14.0, 0.012, 0.2);
  let g = manFbm(manRot0(q) * 0.55 + w * 0.9);
  let a = manFbm(manRot1(q) + w * 2.2);
  let b = manFbm(manRot0(q) * 1.35 + vec3f(11.0, 5.0, 2.0) - w * 1.9);
  let c = manFbm(q * 2.6 + vec3f(5.0, 8.0, 13.0) + w * 1.2);
  let d = manNoise(manRot1(q) * 5.2 + vec3f(2.0, 9.0, 4.0) - w);
  let green = smoothstep(0.56 - e, 0.56 + e, a);
  var col = mix(base * 1.18 + vec3f(0.03, 0.022, 0.008), base * vec3f(0.86, 1.02, 0.78), smoothstep(0.38, 0.62, g));
  col = mix(col, base * vec3f(0.46, 0.56, 0.38), green);
  col = mix(col, base * vec3f(0.62, 0.48, 0.34), smoothstep(0.585 - e, 0.585 + e, b) * (1.0 - 0.6 * green));
  col = mix(col, base * 1.5 + vec3f(0.09, 0.08, 0.055), smoothstep(0.635 - e, 0.635 + e, c));
  col = mix(col, base * vec3f(0.26, 0.24, 0.19), smoothstep(0.74 - e, 0.74 + e, d) * smoothstep(0.5, 0.58, a));
  return col;
}
fn manPrint(p: vec3f, base: vec3f, seed: f32, fp: f32) -> vec3f {
  let P = min(lookCfg.g.z, 1.0);
  if (P <= 0.0) { return manCamo(p, base, seed, fp); }
  let n = manCamo2(p, base, seed, fp);
  if (P >= 1.0) { return n; }
  return mix(manCamo(p, base, seed, fp), n, P);
}
/** the relief of a man's kit at a bind-pose point (m): cloth's folds, the webbing's rows. Each part is gone before the picture is too coarse to hold it */
fn manArm(p: vec3f) -> bool { return abs(p.x) > 0.21 && p.y > 1.3; }
// ---- TAILORING (the panel's Kit detail row, lookCfg.g.y): what a person CUT AND SEWED, drawn where it sits on the body in the bind pose (the cast's T pose: an arm
// runs out along x round (y 1.435, z −0.068), a leg up along y round (|x| 0.093, z −0.045 at the shin to 0.01 at the thigh)). Lines are a few millimetres: each is
// soft to the pixel and gone before it is much finer than one.
fn manLine(d: f32, w: f32, fp: f32) -> f32 { return (1.0 - smoothstep(w, w + max(fp, 0.0012), abs(d))) * (1.0 - smoothstep(3.0 * w, 9.0 * w, fp)); }
fn manBox(d: vec2f, h: vec2f, fp: f32) -> f32 { let aa = max(fp, 0.0012); return (1.0 - smoothstep(h.x, h.x + aa, abs(d.x))) * (1.0 - smoothstep(h.y, h.y + aa, abs(d.y))); }
fn manFrame(d: vec2f, h: vec2f, w: f32, fp: f32) -> f32 { return clamp(manBox(d, h + vec2f(w), fp) - manBox(d, h - vec2f(w), fp), 0.0, 1.0) * (1.0 - smoothstep(3.0 * w, 9.0 * w, fp)); }
/** the cut of a man's cloth at a bind-pose point: seam = a stitched line (drawn darker), dark = a doubled or rubbed panel, sewn = something sewn or stuck on (rgb, cover) */
struct ManCut { seam: f32, dark: f32, sewn: vec4f };
fn manCut(slot: u32, side: u32, p: vec3f, fp: f32) -> ManCut {
  var o: ManCut; o.seam = 0.0; o.dark = 0.0; o.sewn = vec4f(0.0);
  let ax = abs(p.x); let arm = manArm(p);
  let az = p.z + 0.068; let ay = p.y - 1.435;
  let lx = ax - 0.093; let lz = p.z - (-0.045 + 0.055 * smoothstep(0.3, 0.6, p.y));
  if (side == 0u || side == 4u) {
    if (arm) {
      // a sleeve: the shoulder seam, a pocket on the upper arm with its flap, a loop field on it carrying a patch and a tape, a doubled elbow, the cuff
      let top = smoothstep(0.0, 0.02, ay);
      var s = manLine(ax - 0.232, 0.0012, fp);
      s = max(s, manFrame(vec2f(ax - 0.352, az), vec2f(0.058, 0.05), 0.0011, fp) * top);
      s = max(s, manLine(ax - 0.318, 0.0011, fp) * top * step(abs(az), 0.05));
      var d = 0.42 * manBox(vec2f(ax - 0.362, az), vec2f(0.036, 0.036), fp) * top * (0.85 + 0.3 * manNoise(p * 700.0));
      let fd = vec2f(ax - 0.348, az - 0.012);
      let flag = manBox(fd, vec2f(0.014, 0.02), fp) * top;
      if (flag > 0.5) { o.sewn = vec4f(vec3f(0.11, 0.12, 0.085) * (1.0 + 0.9 * manFrame(fd, vec2f(0.014, 0.02), 0.0012, fp)), flag); }
      let tape = manBox(vec2f(ax - 0.384, az + 0.004), vec2f(0.008, 0.028), fp) * top;
      if (tape > 0.5) { o.sewn = vec4f(0.2, 0.185, 0.14, tape); }
      let under = 1.0 - smoothstep(-0.02, 0.01, az);                                        // the back of the arm, where an elbow lands
      d = max(d, 0.16 * (1.0 - smoothstep(0.075, 0.075 + max(fp, 0.0012), abs(ax - 0.52))) * under);
      s = max(s, max(manLine(ax - 0.445, 0.0011, fp), manLine(ax - 0.595, 0.0011, fp)) * under);
      d = max(d, 0.14 * smoothstep(0.662, 0.666, ax)); s = max(s, manLine(ax - 0.664, 0.0012, fp));
      o.seam = s; o.dark = d;
    } else if (p.y < 0.97) {
      // trousers: a doubled knee on the front, a doubled seat, the out seam stitched twice, the in seam, the hem
      let front = smoothstep(-0.01, 0.02, lz); let back = 1.0 - smoothstep(-0.05, -0.02, lz);
      let kband = smoothstep(0.395, 0.4, p.y) * (1.0 - smoothstep(0.68, 0.685, p.y));
      var s = max(manLine(p.y - 0.398, 0.0012, fp), manLine(p.y - 0.683, 0.0012, fp)) * front;
      s = max(s, manLine(lz, 0.0011, fp) * kband * step(0.03, abs(lx)));
      s = max(s, manLine(p.y - 0.742, 0.0012, fp) * back);
      s = max(s, step(0.03, lx) * max(manLine(lz - 0.004, 0.0009, fp), manLine(lz + 0.004, 0.0009, fp)));
      s = max(s, step(lx, -0.03) * manLine(lz, 0.001, fp));
      o.seam = max(s, manLine(p.y - 0.312, 0.0012, fp));
      o.dark = max(0.15 * kband * front, 0.12 * smoothstep(0.74, 0.745, p.y) * back);
    } else {
      o.seam = max(manLine(p.y - 1.492, 0.0012, fp), manLine(p.x, 0.0022, fp) * step(0.02, p.z) * smoothstep(1.36, 1.365, p.y));   // the collar, its short zip
    }
  } else if (slot == 2u) {
    // a shirt: cuffs and shoulder seams; down the chest a placket with its buttons; the collar band
    if (arm) { o.seam = max(manLine(ax - 0.657, 0.0012, fp), manLine(ax - 0.232, 0.0012, fp)); o.dark = 0.08 * smoothstep(0.655, 0.659, ax); }
    else if (p.y > 0.97) {
      let fr = step(0.03, p.z);
      let s = max(manLine(ax - 0.016, 0.001, fp) * step(1.2, p.y) * step(p.y, 1.52) * fr, manLine(p.y - 1.2, 0.001, fp) * step(ax, 0.016) * fr);
      let pk = max(manFrame(vec2f(p.x - 0.085, p.y - 1.3), vec2f(0.04, 0.046), 0.001, fp), manLine(p.y - 1.322, 0.001, fp) * step(abs(p.x - 0.085), 0.04)) * fr;   // a breast pocket and its flap
      o.seam = max(max(s, pk), manLine(p.y - 1.5, 0.0012, fp));
      let by = (p.y - 1.24) / 0.075; let bd = length(vec2f(p.x, (by - round(by)) * 0.075));
      let but = (1.0 - smoothstep(0.0045, 0.0045 + max(fp, 0.001), bd)) * fr * step(1.2, p.y) * step(p.y, 1.5) * (1.0 - smoothstep(0.004, 0.012, fp));
      if (but > 0.5) { o.sewn = vec4f(0.36, 0.34, 0.3, but); }
    }
  }
  return o;
}
/** clothes worn for weeks, on the sides that have one set (x = how much of the ground is in the cloth here, y = a darkening: sweat, a woven stripe): the road on
 *  the legs and the seat, grime at the cuffs, the collar and where he wipes his hands, rubbed elbows; some men's cloth is striped in the weave */
fn manWorn(side: u32, p: vec3f, seed: f32, own: f32, own2: f32, fp: f32) -> vec2f {
  let ax = abs(p.x); let arm = manArm(p); let tor = !arm && p.y > 0.97; let leg = !arm && p.y <= 0.97;
  let n1 = manNoise(p * 9.0 + vec3f(seed, 2.0, 5.0)); let n2 = manNoise(p * 38.0 + vec3f(1.0, seed, 7.0)); let n3 = mix(manNoise(p * 140.0 + vec3f(seed, 9.0, 3.0)), 0.5, smoothstep(0.004, 0.012, fp));
  var d = 0.0;
  if (leg) { d = 0.9 * (1.0 - smoothstep(0.1, 0.42 + 0.3 * n1, p.y)) + 0.5 * smoothstep(0.7, 0.76, p.y) * (1.0 - smoothstep(0.9, 0.97, p.y)) * (1.0 - smoothstep(-0.06, -0.01, p.z)); }
  else if (arm) { d = 0.7 * smoothstep(0.56, 0.67, ax) + 0.5 * manBump(ax, 0.5, 0.09) * (1.0 - smoothstep(-0.03, 0.01, p.z + 0.068)); }
  else { d = 0.45 * smoothstep(1.45, 1.5, p.y) * (1.0 - smoothstep(1.56, 1.6, p.y)) * (1.0 - smoothstep(0.08, 0.16, ax)) + 0.35 * manBump(p.y, 1.08, 0.12) * smoothstep(0.0, 0.06, p.z); }
  d = clamp(d, 0.0, 1.0) * (0.25 + 0.75 * smoothstep(0.36, 0.62, 0.55 * n2 + 0.45 * n1)) * (0.8 + 0.4 * n3) * (0.65 + 0.35 * own);
  var k = 0.0;
  if (tor) { k = 0.14 * manBump(p.x, 0.0, 0.11) * (1.0 - smoothstep(-0.04, 0.0, p.z)) * smoothstep(1.02, 1.12, p.y) * (1.0 - smoothstep(1.3, 1.42, p.y)) * (0.5 + 0.5 * n1); }   // the sweat down his back
  if (own2 > 0.45 && side != 2u) { k = max(k, 0.13 * smoothstep(0.55, 0.9, 0.5 + 0.5 * select(sin(p.x * (6.2831853 / 0.011)), sin(atan2(p.y - 1.435, p.z + 0.068) * 34.0), arm)) * (1.0 - smoothstep(0.003, 0.008, fp))); }
  return vec2f(min(d, 0.85) * select(1.0, 0.45, side == 2u), k);
}
fn manHeight(slot: u32, side: u32, p: vec3f, fp: f32) -> f32 {
  let T = min(lookCfg.g.y, 1.0);
  if (slot == 1u || slot == 2u) {
    let arm = manArm(p);
    let big = 1.0 - smoothstep(0.02, 0.06, fp); let fine = 1.0 - smoothstep(0.005, 0.016, fp);
    var hang = 0.0; var hung = 0.0;
    if (T > 0.0 && side == 1u && slot == 2u && !arm && p.y < 0.97) {                         // loose trousers and a long shirt's skirt hang in long folds
      let drape = manNoise(p * vec3f(26.0, 2.2, 26.0) + vec3f(3.0, 3.0, 9.0)); let d2 = manNoise(p * vec3f(60.0, 5.0, 60.0) + vec3f(4.0, 1.0, 1.0));
      hang = 0.016 * big * abs(drape - 0.5) * 2.0 * smoothstep(0.1, 0.5, p.y) + 0.004 * fine * d2; hung = T;
    }
    let ax = select(vec3f(1.0, 3.6, 1.0), vec3f(3.6, 1.0, 1.0), arm);                     // a fold rings its limb
    var j = max(max(manBump(p.y, 0.5, 0.16), manBump(p.y, 0.93, 0.14)), manBump(p.y, 0.1, 0.12));   // the knee, the hip, the trouser bunched on the boot
    if (arm) { j = max(manBump(abs(p.x), 0.5, 0.13), manBump(abs(p.x), 0.25, 0.08)); }               // the elbow, the armpit
    let a = manNoise(p * ax * 5.0 + vec3f(3.3, 1.7, 9.1)); let b = manNoise(p * ax * 11.0 + vec3f(8.1, 4.4, 2.6));
    return mix(0.011 * big * (0.5 + 0.5 * j) * abs(a - 0.5) * 2.0 + 0.004 * fine * (0.35 + 0.65 * j) * abs(b - 0.5) * 2.0, hang, hung);
  }
  if (slot == 3u) {
    let f = fract(p.y / 0.045); let on = 1.0 - smoothstep(0.004, 0.012, fp); let band = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.56, 0.68, f));
    var h = 0.0022 * on * band;
    if (T > 0.0) {                                                                          // the tape is sewn down every inch and a half: flat at the bar tack, proud between
      let ft = fract(select(p.x, p.z, abs(p.x) > 0.15) / 0.038); let sn = sin(3.14159265 * ft);
      h = h * (1.0 - 0.75 * T * (1.0 - smoothstep(0.035, 0.075, min(ft, 1.0 - ft)))) + 0.0006 * T * on * band * sn * sn;
    }
    return h;
  }
  return 0.0;
}
/** `code` = the slot + 16 × the side (0 operator, 1 defender, 2 responder, 3 civilian, 4 an operator in the dark suit) · mp, dmx, dmy = the bind-pose point and its
 *  step a pixel across and down · wp's steps likewise · cavity −1 ridge ‥ +1 crease · dust = the ground's colour on him and how much stands here · owner = his id */
fn lookMan(code: u32, mp: vec3f, dmx: vec3f, dmy: vec3f, dwx: vec3f, dwy: vec3f, nIn: vec3f, albedoIn: vec3f, roughIn: f32, gainIn: f32, cavity: f32, dust: vec4f, owner: u32, fp: f32) -> LookMan {
  var o: LookMan; o.albedo = albedoIn; o.n = nIn; o.rough = roughIn; o.gain = gainIn;
  let K = min(lookCfg.f.z, 1.5); if (K <= 0.0) { return o; }
  let slot = code & 15u; let side = code >> 4u;
  let T = min(lookCfg.g.y, 1.0) * min(K, 1.0); let op = side == 0u || side == 4u;
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
      if (T > 0.0) { let ft = fract(select(mp.x, mp.z, abs(mp.x) > 0.15) / 0.038); alb *= 1.0 - 0.3 * T * (1.0 - smoothstep(0.035, 0.075, min(ft, 1.0 - ft))) * (1.0 - smoothstep(0.004, 0.012, fp)) * smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.56, 0.68, f)); }
      alb = mix(alb, alb * 1.35 + vec3f(0.01), 0.5 * K * ridge);
    } else {
      if (side == 0u && slot == 1u) {
        var print = manPrint(mp, alb, seed, fp);
        if (!manArm(mp) && mp.y > 0.97) { print = mix(print, alb * vec3f(0.74, 0.8, 0.62), T); }   // a combat shirt: the body under the plates is plain knit, only the sleeves are printed
        alb = mix(alb, print, K);
      }
      if (!op && slot == 1u && T > 0.0) {                                                    // a waistcoat: wool in a twill
        let tw = 0.5 + 0.5 * sin((mp.x + mp.y + mp.z) * (6.2831853 / 0.006));
        alb *= (1.0 + 0.16 * T * (tw - 0.5) * (1.0 - smoothstep(0.0015, 0.004, fp))) * (1.0 + T * 0.16 * (manNoise(mp * 240.0) - 0.5));
      }
      let age = manNoise(mp * 3.1 + vec3f(seed * 7.0, 2.0, seed));                         // slow blotches: washed, sweated, sat in
      alb *= 1.0 + K * (0.26 * (age - 0.5) + 0.16 * (own2 - 0.5));
      alb = mix(alb, vec3f(dot(alb, vec3f(0.2126, 0.7152, 0.0722))) * vec3f(1.04, 1.0, 0.93), K * (0.1 + 0.22 * own) * smoothstep(1.25, 1.5, mp.y));   // bleached across the shoulders
      if (T > 0.0) {
        let cut = manCut(slot, side, mp, fp);
        alb *= (1.0 - T * cut.dark) * (1.0 - 0.5 * T * cut.seam);
        alb = mix(alb, cut.sewn.rgb, T * cut.sewn.a);
        if (!op && slot == 2u) { let wn = manWorn(side, mp, seed, own, own2, fp); alb = mix(alb * (1.0 - T * wn.y), dust.xyz * 0.5, T * wn.x); }
      }
      let knee = manBump(mp.y, 0.5, 0.11) * smoothstep(0.0, 0.07, mp.z) * step(mp.y, 0.9);
      alb = mix(alb, dust.xyz, 0.4 * K * knee * (0.4 + 0.6 * manNoise(mp * 30.0 + vec3f(seed))));
    }
    // the relief, stood on the skinned normal by the steps of the bind-pose point and of the world point across this pixel
    let h0 = manHeight(slot, side, mp, fp); let dBs = manHeight(slot, side, mp + dmx, fp) - h0; let dBt = manHeight(slot, side, mp + dmy, fp) - h0;
    let R1 = cross(dwy, nIn); let R2 = cross(nIn, dwx); let det = dot(dwx, R1);
    let skirt = side == 1u && slot == 2u && ((mp.y < 0.97) != (mp.y + dmx.y < 0.97) || (mp.y < 0.97) != (mp.y + dmy.y < 0.97));   // (the long folds start at the waist: the same)
    let seam = skirt || manArm(mp) != manArm(mp + dmx) || manArm(mp) != manArm(mp + dmy);          // (the folds turn where the sleeve starts: a step across that line is no slope)
    if (abs(det) > 1e-12 && !seam) {
      var nn = normalize(abs(det) * nIn - (dBs * R1 + dBt * R2) * (sign(det) * K));
      let c = dot(nn, nIn); if (c < 0.8) { nn = normalize(nIn * 0.8 + normalize(nn - nIn * c) * 0.6); }
      o.n = nn;
    }
  } else if (slot == 5u) {
    if (side == 0u) { alb = mix(alb, manPrint(mp * 1.15, alb, seed + 3.0, fp), 0.8 * K); }
    let chip = smoothstep(0.62, 0.7, manNoise(mp * 70.0 + vec3f(seed)) * 0.55 + ridge * 0.9) * (1.0 - smoothstep(0.006, 0.02, fp));
    alb = mix(alb, alb * 1.9 + vec3f(0.03), 0.6 * K * max(chip, 0.5 * ridge));
    if (T > 0.0 && op) {
      // a cloth cover: four seams from the crown, a band round it with two cat's eyes at the back, loop squares on the sides, a rubber rim
      let r = length(mp.xz) + 1e-6; let ang = atan2(mp.x, mp.z + 1e-6); var sm = 0.0;
      for (var i = 0; i < 4; i++) { let da = ang - (0.785398 + 1.570796 * f32(i)); sm = max(sm, manLine(r * sin(da), 0.0012, fp) * step(0.0, cos(da))); }
      sm *= smoothstep(1.72, 1.73, mp.y) * smoothstep(0.025, 0.035, r);
      let band = smoothstep(1.688, 1.691, mp.y) * (1.0 - smoothstep(1.713, 1.716, mp.y));
      alb *= 1.0 - 0.45 * T * sm;
      alb = mix(alb, alb * vec3f(0.5, 0.52, 0.42), T * band);
      alb = mix(alb, vec3f(0.42, 0.46, 0.2), T * band * step(mp.z, -0.09) * manBox(vec2f(abs(mp.x) - 0.03, mp.y - 1.702), vec2f(0.011, 0.007), fp));
      alb *= 1.0 - 0.4 * T * manBox(vec2f(mp.z + 0.01, mp.y - 1.755), vec2f(0.03, 0.022), fp) * step(0.085, abs(mp.x)) * (0.8 + 0.4 * manNoise(mp * 700.0));
      alb = mix(alb, vec3f(0.03, 0.03, 0.028), T * (1.0 - smoothstep(1.656, 1.662, mp.y)));
    }
    if (T > 0.0 && side == 1u) { alb *= mix(1.0, (0.86 + 0.28 * manNoise(mp * 330.0)) * (1.0 + 0.18 * (manNoise(mp * 40.0) - 0.5)), T); rough = mix(rough, 0.97, T); gain *= 1.0 - 0.6 * T; }   // wool, felted
    let sc = manNoise(mp * 24.0 + vec3f(seed * 2.0));
    rough = clamp(rough + K * 0.2 * (sc - 0.5), 0.05, 1.0); gain *= 1.0 + K * 0.6 * (0.5 - sc);
  } else if (slot == 6u) {
    alb = mix(alb, vec3f(0.3, 0.3, 0.32), 0.7 * K * ridge);
    rough = clamp(mix(rough, 0.3, 0.6 * K) + 0.15 * K * (manNoise(mp * 40.0) - 0.5), 0.05, 1.0);
    gain = max(gain, K * (0.9 + ridge));
  } else if (slot == 4u) {
    let alb0 = mix(alb, vec3f(0.12, 0.1, 0.08), 0.6 * K * ridge); let rough0 = mix(rough, 0.38, 0.5 * K * (1.0 - dust.w)); let gain0 = max(gain, 0.5 * K * (1.0 - dust.w));   // round one's boot
    if (T > 0.0 && side == 0u) {
      // desert boots: rough-out leather the colour of sand, a padded collar, laces up the front between their eyelets, a welt, scuffed dark at the toe
      let nap = manNoise(mp * 260.0) * 0.6 + manNoise(mp * 60.0 + vec3f(3.0)) * 0.4;
      var b = vec3f(0.25, 0.185, 0.115) * (0.8 + 0.4 * nap) * (1.0 - 0.35 * max(cavity, 0.0));
      let lz = mp.z + 0.045; let lx = abs(mp.x) - 0.093; let near = 1.0 - smoothstep(0.004, 0.012, fp);
      b = mix(b, b * vec3f(0.62, 0.66, 0.6), smoothstep(0.236, 0.24, mp.y));
      let tongue = (1.0 - smoothstep(0.022, 0.026, abs(lx))) * step(0.03, lz) * smoothstep(0.085, 0.09, mp.y);
      let fl = fract((mp.y - 0.09) / 0.02);
      b = mix(b, b * 0.72, tongue * 0.5); b = mix(b, vec3f(0.2, 0.17, 0.12), (1.0 - smoothstep(0.16, 0.26, abs(fl - 0.5))) * tongue * near);
      b = mix(b, vec3f(0.05), (1.0 - smoothstep(0.003, 0.0045, abs(abs(lx) - 0.027))) * (1.0 - smoothstep(0.2, 0.3, abs(fl - 0.5))) * step(0.03, lz) * smoothstep(0.085, 0.09, mp.y) * near);
      b *= 1.0 - 0.5 * max(manLine(mp.y - 0.238, 0.0012, fp), manLine(mp.y - 0.047, 0.002, fp));
      b = mix(b, b * 0.6, 0.6 * smoothstep(0.07, 0.13, lz) * (1.0 - smoothstep(0.05, 0.1, mp.y)) * manNoise(mp * 45.0));
      b *= (1.0 - 0.16 * (1.0 - smoothstep(-0.07, -0.04, lz)) * (1.0 - smoothstep(0.1, 0.12, mp.y))) * (1.0 - 0.4 * manLine(mp.y - 0.118, 0.001, fp) * step(lz, -0.03));
      b = mix(b, dust.xyz, 0.5 * dust.w);
      alb = mix(alb0, b, T); rough = mix(rough0, 0.95, T); gain = mix(gain0, 0.4 * gain, T);
    } else { alb = alb0; rough = rough0; gain = gain0; }
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
    if (T > 0.0 && side == 0u && mp.y < 0.8) {
      // a knee pad: a hard cap, scraped pale where it meets the ground, dust in its grooves
      let scr = smoothstep(0.6, 0.78, manNoise(mp * vec3f(40.0, 240.0, 40.0) + vec3f(5.0)) * 0.6 + manNoise(mp * 90.0) * 0.4) * manBump(mp.y, 0.53, 0.06);
      var pc = vec3f(0.05, 0.047, 0.042) * (1.0 - 0.3 * max(cavity, 0.0));
      pc = mix(pc, vec3f(0.2, 0.19, 0.17), 0.7 * scr); pc = mix(pc, dust.xyz, 0.5 * max(cavity, 0.0));
      alb = mix(alb, pc, T); rough = mix(rough, 0.36 + 0.4 * scr, T); gain = max(gain, 1.1 * T);
    } else if (T > 0.0 && side == 0u && abs(mp.x) > 0.66 && mp.y > 1.2 && mp.y < 1.55) {
      // gloves: a sand-coloured back, a dark palm, a hard bar over the knuckles
      let topg = smoothstep(-0.006, 0.006, mp.y - 1.43);
      var gc = mix(vec3f(0.035, 0.032, 0.03), vec3f(0.2, 0.16, 0.105) * (0.85 + 0.3 * manNoise(mp * 400.0)), topg);
      gc = mix(gc, vec3f(0.03), (1.0 - smoothstep(0.012, 0.012 + max(fp, 0.0012), abs(abs(mp.x) - 0.8))) * topg);
      gc *= (1.0 - 0.4 * manLine(abs(mp.x) - 0.705, 0.0015, fp)) * (1.0 - 0.3 * max(cavity, 0.0));
      alb = mix(alb, gc, T); rough = mix(rough, 0.85, T);
    }
  }
  if (cold && lookCfg.e.w > 0.0 && mp.y < 0.32 && slot != 0u && slot != 8u && slot != 10u) {
    let ks = min(lookCfg.e.w, 1.5) * K * select(0.45, 1.0, side == 0u || side == 4u);
    let coarse = smoothstep(0.006, 0.02, fp);
    let g = mix(manNoise(mp * 55.0 + vec3f(seed)), 0.5, coarse); let g2 = manNoise(mp * 17.0 + vec3f(4.0 + seed, 1.0, seed));
    // NO SNOW LIES ON A MAN (the maintainer, on a GPU: "weird that the men are covered in snow, shouldn't happen"; a cap on his helmet and shoulders was tried three
    // ways and each hid the kit this page is about): only what he walked through, caked on the boots and the hems to a ragged line
    let cake = (1.0 - smoothstep(0.08, 0.2 + 0.12 * g2, mp.y)) * smoothstep(0.42, 0.6, 0.5 * g + 0.5 * g2 + 0.12);
    let s = clamp(0.9 * cake * ks, 0.0, 1.0);
    alb = mix(alb, snowCfg.p[2].xyz, s); rough = mix(rough, 0.9, s); gain *= 1.0 - s;
  }
  o.albedo = max(alb, vec3f(0.0)); o.rough = clamp(rough, 0.05, 1.0); o.gain = max(gain, 0.0);
  return o;
}
