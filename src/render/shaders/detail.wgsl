// The DETAIL LAYER (renderer v3 phase 4; gbuffer.wgsl fsBox calls detailSurface while frame.matCfg.w > 0). The art rule: the blocky flat-shaded look stays —
// no image textures, no albedo noise painted on walls; every term here is WEAR YOU CAN EXPLAIN, evaluated at the primary hit only (the g-buffer's albedo /
// roughness / metalness), so the direct light, the bounce at the pixel, the reflections and their highlights all answer to it by themselves and no ray, cache
// or light meter ever pays for it:
//   • WORN PATHS on the polished floors — where the shift walks (the level's traffic map: patrol routes traced over the nav grid + every door's threshold,
//     render/wear.ts) the wax is scuffed matte and holds a little ground-in grey: roughness up, albedo a touch duller. Uneven at the half-metre scale (wear
//     never is even), never finer.
//   • GRIME AT THE SKIRTING — the band of floor a mop does not reach (the traffic map's wall-proximity channel: within ~15 cm of anything standing on the
//     floor): rougher, a shade darker; and the bottom hand-width of every wall / cabinet face carries the shoe and mop marks: darker, rougher.
//   • DUST ON HIGH TOPS — upward faces above eye level (cabinet tops, door heads, the vending machines' roofs) nobody wipes: rougher, greyer, thinning
//     toward the edges where the air moves.
//   • EDGE WEAR ON METAL — within a couple of centimetres of a metal box's edges the paint / oxide is rubbed through to bright bare metal: base colour up,
//     roughness down (the exact edge distance is free in a box world).
// One amount k = frame.matCfg.w (settings.detail, 0‥1; 0.35 = 'lived-in', 1 = as far as it goes; 0 = none of this runs and the pixel is what it was).
@group(1) @binding(6) var wearTex: texture_2d<f32>;      // the traffic map over the world's XZ footprint (render/wear.ts; rg8: r = traffic 0‥1, g = wall proximity 0‥1) — a 1×1 zero where nobody built one (the viewer)

const DUST_Y: f32 = 1.6;             // tops above this (m) gather dust
const DUST_GREY: f32 = 0.33;         // what thick dust tends toward (a light warm grey, linear)
const STEEL: vec3f = vec3f(0.74, 0.72, 0.69);   // bare rubbed steel under worn paint (linear)

fn detailHash(p: vec2i) -> f32 { var h = (u32(p.x + 4096) * 73856093u) ^ (u32(p.y + 4096) * 19349663u); h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return f32(((h >> 22u) ^ h) & 0xffffu) * (1.0 / 65536.0); }
/** smooth value noise on the metre grid ÷ cell, 0‥1 — only ever read at cells of 0.35 m and up: unevenness, not texture */
fn detailNoise(p: vec2f) -> f32 {
  let i = floor(p); let f = p - i; let w = f * f * (3.0 - 2.0 * f);
  let ip = vec2i(i);
  return mix(mix(detailHash(ip), detailHash(ip + vec2i(1, 0)), w.x), mix(detailHash(ip + vec2i(0, 1)), detailHash(ip + vec2i(1, 1)), w.x), w.y);
}

struct DetailOut { albedo: vec3f, rough: f32, metal: f32 };
fn detailSurface(wp: vec3f, n: vec3f, bi: u32, albedoIn: vec3f, roughIn: f32, metalIn: f32, k: f32) -> DetailOut {
  var o: DetailOut; o.albedo = albedoIn; o.rough = roughIn; o.metal = metalIn;
  // the cheap world-space predicates first: most wall / ceiling / carpet pixels take no term and leave here without touching the box record
  let floorPix = n.y > 0.9 && wp.y < 0.15;
  let skirtPix = abs(n.y) < 0.3 && wp.y < 0.14 && wp.y > -0.02;
  let dustPix = n.y > 0.9 && wp.y > DUST_Y;
  let metalPix = metalIn > 0.5;
  if (!(floorPix || skirtPix || dustPix || metalPix)) { return o; }
  let b = boxGeo[bi];
  if ((b.flags & BOX_EMISSIVE) != 0u) { return o; }                     // a lit fixture's face is its light, not a surface anybody wears
  // box-local position; which face this is; the distance to that face's nearest edge (the second face pair's inward distance)
  let q = boxRot(bi); let qi = vec4f(-q.xyz, q.w);
  let lp = quatRotate(qi, wp - b.c);
  let ln = quatRotate(qi, n);
  let dIn = max(b.h - abs(lp), vec3f(0.0));                              // inward distance from each face pair
  let an = abs(ln);
  var edge: f32;                                                          // distance to the nearest edge of the face we stand on
  if (an.x >= an.y && an.x >= an.z) { edge = min(dIn.y, dIn.z); } else if (an.y >= an.z) { edge = min(dIn.x, dIn.z); } else { edge = min(dIn.x, dIn.y); }
  let lum = dot(o.albedo, vec3f(0.2126, 0.7152, 0.0722));
  let uneven = 0.65 + 0.7 * detailNoise(wp.xz * (1.0 / 0.7)) ;           // 0.65‥1.35: wear is patchy at arm's-length scales
  // ---- floors: worn paths + the grime band (upward faces at floor level; the traffic map covers the world's grid footprint) ----
  if (floorPix) {
    let uv = (wp.xz - WORLD_MIN.xz) / (vec2f(f32(GRID_W), f32(GRID_H)) * GRID_CELL);
    let wm = textureSampleLevel(wearTex, linSamp, uv, 0.0);
    let traffic = clamp(wm.x * uneven, 0.0, 1.0);
    let grime = wm.y * wm.y;                                              // (squared: hugs the wall)
    if (roughIn < 0.6) {                                                  // a finish there is to wear: the wax / sealer scuffed matte, a little ground-in grey
      let worn = traffic * k;
      o.rough = min(o.rough + 0.42 * worn, 1.0);
      o.albedo = mix(o.albedo, vec3f(lum * 0.86), min(0.35 * worn, 0.35));
    }
    let g = grime * k;                                                    // where the mop does not reach: dust and dirt, on any floor
    o.rough = min(o.rough + 0.3 * g, 1.0);
    o.albedo *= 1.0 - 0.28 * g;
  }
  // ---- skirting: the bottom hand-width of vertical faces that stand on the floor (walls, cabinets, counters, door leaves) — shoe / trolley / mop marks ----
  if (skirtPix && an.y < 0.3 && b.c.y - b.h.y < 0.05) {
    let band = (1.0 - smoothstep(0.03, 0.13, wp.y)) * k * (0.7 + 0.3 * uneven);
    o.albedo *= 1.0 - 0.3 * band;
    o.rough = min(o.rough + 0.25 * band, 1.0);
  }
  // ---- dust on high tops (the box's own +y face, above eye level; thinner within a few centimetres of the edges) ----
  if (dustPix && ln.y > 0.9) {
    let dust = k * smoothstep(0.0, 0.07, edge) * (0.75 + 0.25 * uneven) * smoothstep(DUST_Y, DUST_Y + 0.3, wp.y);
    o.rough = mix(o.rough, 1.0, min(0.85 * dust, 1.0));
    o.albedo = mix(o.albedo, vec3f(DUST_GREY), min(0.3 * dust, 0.3));
    o.metal = o.metal * (1.0 - min(0.8 * dust, 0.8));                    // dust is a dielectric film over the metal
  }
  // ---- edge wear on metal: paint / oxide rubbed through within ~2 cm of an edge (handles, frames, shelving uprights, the steel door's arrises) ----
  if (metalPix) {
    let wear = (1.0 - smoothstep(0.003, 0.022, edge)) * k;
    o.albedo = mix(o.albedo, STEEL, 0.7 * wear);
    o.rough = mix(o.rough, 0.16, wear);
  }
  return o;
}
