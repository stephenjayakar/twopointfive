// THE LOOK PROTOTYPE (the page /look; render/frame.ts lookConfig, the scene prelude's const `LOOK`). Not the game's look: a place to find out how far materials can
// carry a world of boxes inside the frame's budget. This file is in the g-buffer module ONLY on that page (render/gbuffer.ts lookWgsl); every other page gets a stub.
//
// What it does to a box pixel, in the g-buffer and nowhere else:
//   MAPS      eight tiling materials made by the page at boot (render/lookTex.ts: paint, height, normal, roughness, cavity), picked by the box's paint class
//             (surface.wgsl surfClass) and laid in metres: along a wall and up it, world x z on the ground, along the long side of a board or a sheet.
//   UNTILE    the four that have no courses (mud, plaster, earth, gravel) are read twice, the second turned and shifted, and cross-faded by a slow noise and
//             by height, so a 2 m map does not print its repeat on a 40 m yard.
//   WEATHER   what follows the BUILDING, not the map: damp and dirt climbing a wall's foot to a ragged line, a bleached head and the runs under it, slow blotches;
//             on the ground the level's own traffic map (render/wear.ts) — walked earth packed pale and smooth, dirt and stones gathered where nobody walks,
//             against the walls.
//   RELIEF    the map's normal, stood on the face. The g-buffer keeps the TILTED normal with alpha 0 (the target's spare code); gdown hands every working-size
//             pass the box's own face back (common.wgsl lookGeoN), so the filters, the gather and the reservoirs see the flat wall they always saw, and only the
//             screen-size direct light (sharp_direct.wgsl) and the composite's sky share light the relief.
//   EDGES     a small box's arrises are rounded in the normal and rubbed pale: a crate stops being twelve triangles.
// Numbers the page's panel moves live: lookCfg (render/gbuffer.ts setLook).
@group(1) @binding(11) var lookA: texture_2d_array<f32>;
@group(1) @binding(12) var lookB: texture_2d_array<f32>;
@group(1) @binding(13) var lookSamp: sampler;
struct LookCfg { a: vec4f, b: vec4f, c: vec4f, d: vec4f };   // a = paint, relief, shine, weather · b = untile, edges, cavity, map size × · c, d = the eight layers' base roughness
@group(1) @binding(14) var<uniform> lookCfg: LookCfg;

const LOOK_TILE: f32 = 2.0;        // metres a map covers (render/lookTex.ts LOOK_TILE)
const LOOK_MAX_TILT: f32 = 0.48;   // the tangent part of the shading normal is held under this (29°): lookGeoN's snap back to the face must never pick a neighbour, and a wall's facet never reads as a top (fogofwar.wgsl asks N.y > 0.5)
const LOOK_MIN_TILT: f32 = 0.02;   // … and under this the pixel is the face, unmarked (a flat stretch of a map costs no second light score)

struct LookOut { albedo: vec3f, n: vec3f, rough: f32, tilted: bool };
struct LookTap { a: vec4f, b: vec4f };
fn lookTap(layer: i32, st: vec2f, dx: vec2f, dy: vec2f) -> LookTap {
  var t: LookTap; t.a = textureSampleGrad(lookA, lookSamp, st, layer, dx, dy); t.b = textureSampleGrad(lookB, lookSamp, st, layer, dx, dy); return t;
}
fn lookBase(layer: i32) -> f32 { if (layer < 4) { return lookCfg.c[layer]; } return lookCfg.d[layer - 4]; }
fn lookSlow(p: vec2f) -> f32 { return 0.55 * detailNoise(p) + 0.3 * detailNoise(p * 2.13 + vec2f(7.3, 1.9)) + 0.15 * detailNoise(p * 4.31 + vec2f(2.1, 9.4)); }

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
    if (cls == SURF_WOOD || cls == SURF_SHEET) {                 // the box's own: a door carries its boards round with it
      if (dot(abs(eb), hf.xyz) > dot(abs(ea), hf.xyz) && (lying || cls == SURF_WOOD)) { let t = ea; ea = eb; eb = t; }   // boards run the long way; a standing sheet's ribs run up
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
        let run = pow(detailNoise(vec2f(uv.x * 7.0, 1.7)), 3.0) * (1.0 - smoothstep(0.2, 1.3 + 1.2 * detailNoise(vec2f(uv.x * 2.1, 4.4)), dTop)) * smoothstep(0.02, 0.12, dTop) * k.w;
        alb *= 1.0 + 0.22 * bleach; alb *= 1.0 - 0.28 * run;
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
