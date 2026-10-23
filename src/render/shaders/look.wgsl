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
struct LookCfg { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f };   // a = paint, relief, shine, weather · b = untile, edges, cavity, map size × · c, d, e.xyz = the eleven layers' base roughness · e.w = the snow that clings
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
    let line = f.x + open * (0.04 + (0.1 + 0.22 * windward) * rag) * ks;
    // (the bank's own edge is ragged at a finger's width; smooth noise, never a grid: a per-cell step here drew a staircase)
    amt = 1.0 - smoothstep(line * 0.6, line * 1.1 + 0.02, wp.y + (detailNoise(vec2f(ux, wp.y) * 13.0) - 0.5) * 0.05);
    bank = amt > 0.5;
    // above the line: what the wind has stuck to the face. A thin rime that fades a stride up, and in it round clots no finer than a
    // pixel and a half (in octaves, as the field's own grains), each with its own place and size in its cell
    let high = max(wp.y - line, 0.0);
    let patchy = 0.3 + 0.7 * smoothstep(0.35, 0.7, 0.6 * detailNoise(vec2f(ux, wp.y) * 1.9 + vec2f(4.1, 1.7)) + 0.4 * detailNoise(vec2f(ux, wp.y) * 5.3 + vec2f(7.7, 2.2)));
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
