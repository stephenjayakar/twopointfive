// THE SNOW'S SURFACE (game/weatherKinds.ts SNOW_LOOK.on → the prelude's `const SNOW_SURF`; render/snowField.ts bakes the field). A snow level's lying snow as one
// surface instead of painted boxes — the maintainer on his first GPU look at the pass: 'it does need to feel more organic. maybe we could do it with a height
// map or something like that? the rectangles don't seem to work. and i think we can make the material seem much cooler / feel like freshly fallen snow.'
//   THE FIELD   snowTex, over the world's plan: r = metres of snow STANDING over the ground (the level's drifts and banks as smooth hills), g = snow lies here,
//               b = trodden, a = old. Its edges are soft and wander; nothing in it is a rectangle.
//   THE GROUND  fsBox → snowBox: every upward face at floor level of a box of the level file is shaded off the field at its world point — the slab, a path's
//               painted strip, the earth a man cleared — so a strip's own outline shows nowhere: where the field says snow, there is snow.
//   THE HILLS   vsSnow / fsSnow: the lattice quads with snow standing on them, raised by r (the boxes they swallow are still drawn, under them).
//   A CAP       a snow-painted box above the ground (on a wall top, a lorry, a stack): the same snow, rounded off toward an edge that wanders.
//   THE FINISH  one function for all three (snowShade): the surface's own slopes — the field's hills and troughs, a slow swell, the wind's ridges, boot marks in
//               trodden snow — tilt the normal, so every lamp models it; hollows hold a bluer shade; a few grains in a hundred are set to mirror a lamp (a glint
//               is a pixel with a tilted normal and a tight lobe: the lights do the rest, and it winks as the view moves).
// PICTURE ONLY: albedo / normal / roughness of the primary hit. No ray, bounce or meter reads any of it (they read the boxes' paint, as ever).
// SNOW_SURF false (every page but a snow level's with the switch on) = every branch here is dead code.
@group(1) @binding(8) var snowTex: texture_2d<f32>;
// p[0] = (origin x, origin z, texels a metre, the ground slab's box index) · p[1] = (w, h, live 0|1, the file's box count) · p[2] = fresh rgb, sparkle gain ·
// p[3] = packed rgb, relief gain · p[4] = old rgb, swell m · p[5] = (wind x, wind z, ripple m, pillow m) · p[6] = (hollow blue, dimple m, glint share, glint
// roughness) · p[7] = the snow PAINT's rgb (how a snow box is known), fresh roughness · p[8] = (a cap's edge wander m, a glint grain's lean, a print's depth m — 0 = no prints, the prints' texels a metre) · p[9] = the TRODDEN paint's rgb · p[10] = the OLD paint's rgb (how a path's or a rut's strip is known), a print's rim m   — render/snowField.ts snowCfgRows
struct SnowCfg { p: array<vec4f, 11> };
@group(1) @binding(9) var<uniform> snowCfg: SnowCfg;
// THE PRINTS (game/snowTracks.ts; `const SNOW_TRACKS`): one byte a texel over the same plan — 1 where a boot or a fallen man has pressed the snow, 0.5 on the
// print's outline, 0 half a skirt outside it. Read as a height: a floor, a wall, and outside the outline the bank of snow the boot pushed up. An untidy print
// (SNOWTRACKS.mess) is the same byte read the same way: its stamp breaks the outline, the bank's reach and the floor, and sets clods in the bank's half.
@group(1) @binding(10) var snowTrackTex: texture_2d<f32>;

fn snowLive() -> bool { return SNOW_SURF && snowCfg.p[1].z > 0.5; }
fn snowField(xz: vec2f) -> vec4f { return textureSampleLevel(snowTex, linSamp, (xz - snowCfg.p[0].xy) * snowCfg.p[0].z / snowCfg.p[1].xy, 0.0); }
fn snowIsPaint(a: vec3f) -> bool { return all(abs(a - snowCfg.p[7].xyz) < vec3f(0.004)); }
/** a path's or a rut's strip, by its paint (trodden or old snow) */
fn snowIsLay(a: vec3f) -> bool { return all(abs(a - snowCfg.p[9].xyz) < vec3f(0.004)) || all(abs(a - snowCfg.p[10].xyz) < vec3f(0.004)); }
fn snowHash(p: vec2i, salt: u32) -> f32 { var h = (u32(p.x + 32768) * 73856093u) ^ (u32(p.y + 32768) * 19349663u) ^ (salt * 0x9E3779B9u); h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return f32(((h >> 22u) ^ h) & 0xffffu) * (1.0 / 65536.0); }

/** the small relief the field does not carry (m): the open snow's slow swell and the wind's ridges, drawn out along the wind; boot and tyre marks where it is trodden */
fn snowFine(xz: vec2f, f: vec4f) -> f32 {
  let a = vec2f(0.8776 * xz.x - 0.4794 * xz.y, 0.4794 * xz.x + 0.8776 * xz.y);
  let wd = snowCfg.p[5].xy; let u = dot(xz, wd); let v = dot(xz, vec2f(-wd.y, wd.x));
  let swell = (detailNoise(a * (1.0 / 2.3)) - 0.5) * 2.0 + (detailNoise(a * (1.0 / 0.8) + vec2f(11.7, 4.2)) - 0.5) * 0.7;
  let ridge = ((detailNoise(vec2f(u * (1.0 / 3.4), v * (1.0 / 0.5))) - 0.5) * 2.0 + (detailNoise(vec2f(u * (1.0 / 1.3), v * (1.0 / 0.19)) + vec2f(4.4, 1.7)) - 0.5) * 0.6) * (0.35 + 0.65 * detailNoise(a * (1.0 / 3.1) + vec2f(5.3, 9.1)));
  let b = vec2f(0.4536 * xz.x + 0.8912 * xz.y, -0.8912 * xz.x + 0.4536 * xz.y);
  let dimple = ((detailNoise(b * (1.0 / 0.21) + vec2f(3.3, 8.8)) - 0.5) * 1.3 + (detailNoise(a * (1.0 / 0.47) + vec2f(1.9, 6.4)) - 0.5) * 1.1) * snowCfg.p[6].y;
  let fresh = (1.0 - f.z) * (1.0 - f.w);
  return fresh * (swell * snowCfg.p[4].w + ridge * snowCfg.p[5].z) + max(f.z, f.w) * dimple;
}
/** a print's height (m, ≤ 0 inside, > 0 on its rim) at a world point: t = the pressed byte there, deep = how far a boot sinks here */
fn snowPrint(xz: vec2f, deep: f32, mess: f32, fine: f32) -> f32 {
  let t = textureSampleLevel(snowTrackTex, linSamp, (xz - snowCfg.p[0].xy) * snowCfg.p[8].w / vec2f(textureDimensions(snowTrackTex)), 0.0).r;
  let wall = smoothstep(0.5, 0.95, t);
  let rim = sin(clamp(t * 2.0, 0.0, 1.0) * 3.14159265);
  var up = snowCfg.p[10].w * rim * rim; var down = deep * wall;
  if (mess > 0.0 && t > 0.0) {
    // UNTIDY (mess > 0): broken snow does not stand in an even bank. Anchored to the world, a hand's width a lump: what was pushed up stands several times
    // the bank's height here and is all but gone there; the wall and the floor carry crumbs that fell back in (`fine`: the smaller ones, while a pixel can hold one)
    let a = detailNoise(xz * (1.0 / 0.06) + vec2f(3.7, 9.2)); let b = detailNoise(xz * (1.0 / 0.027) + vec2f(8.1, 1.4));
    let lump = mix(a, 0.6 * a + 0.4 * b, fine);
    up *= mix(1.0, 0.6 + 3.4 * lump * lump, mess);
    down *= 1.0 - mess * (0.16 * (a - 0.5) + 0.3 * fine * smoothstep(0.5, 0.9, b));
  }
  return up - down;
}
/** how untidy the prints are, 0‥1 (game/snowTracks.ts SNOWTRACKS.mess, × 100 in a byte): the map carries it itself, in the first texel of the middle one of its
 *  three rows past the plan (the block's eleven rows are full, and the number belongs to the stamps that wrote the map) */
fn snowPrintMess() -> f32 { let d = vec2i(textureDimensions(snowTrackTex)); return clamp(textureLoad(snowTrackTex, vec2i(0, max(d.y - 2, 0)), 0).r * 2.55, 0.0, 1.0); }
/** the whole surface's height over the ground (m) from a field sample: the hills, snow's own depth where it lies, the troughs boots and wheels pressed */
fn snowDeep(f: vec4f) -> f32 { return f.x + f.y * 0.05 - f.z * 0.03 - f.w * 0.038; }

struct SnowS { albedo: vec3f, n: vec3f, rough: f32 };
/** The finish at a world point on snow. `f` = the field there (g already what the caller holds the cover to be); `up` = the surface's own normal before relief
 *  (the ground's, a hill's mean, a cap's pillow); fp = the pixel's footprint (m); `lying` = the snow lies on the ground here, so the field's own slopes are its
 *  slopes (a cap up on a wall or a lorry is not the ground under it: it takes the fine relief alone). */
fn snowShade(wp: vec3f, f: vec4f, up: vec3f, fp: f32, lying: bool) -> SnowS {
  var o: SnowS;
  let xz = wp.xz; let k = snowCfg.p[3].w;
  // slopes: the field's by central differences a texel out (bilinear heights → a continuous slope: no facets), the fine relief's by forward ones
  let e = 1.0 / snowCfg.p[0].z;
  let hc = snowDeep(f); var hxp = hc; var hxm = hc; var hzp = hc; var hzm = hc;
  if (lying) { hxp = snowDeep(snowField(xz + vec2f(e, 0.0))); hxm = snowDeep(snowField(xz - vec2f(e, 0.0))); hzp = snowDeep(snowField(xz + vec2f(0.0, e))); hzm = snowDeep(snowField(xz - vec2f(0.0, e))); }
  let e2 = max(0.03, fp);
  let n0 = snowFine(xz, f); let nx = snowFine(xz + vec2f(e2, 0.0), f); let nz = snowFine(xz + vec2f(0.0, e2), f);
  let fade = clamp(0.12 / max(fp, 1e-4), 0.0, 1.0);   // (relief finer than the pixel settles to flat instead of shimmering)
  var gx = (hxp - hxm) / (2.0 * e) + (nx - n0) / e2 * fade; var gz = (hzp - hzm) / (2.0 * e) + (nz - n0) / e2 * fade;
  // the prints: a dent the lamps model by its walls and its rim, crumbled inside (pressed snow breaks into clods); deeper where a drift's skirt stands, shallow in snow already trodden
  var pr = 0.0; var trod = 0.0; var cup = 0.0;
  if (SNOW_TRACKS && lying && snowCfg.p[8].z > 0.0) {
    let deep = (snowCfg.p[8].z + 0.6 * min(f.x, 0.25)) * (1.0 - 0.6 * max(f.z, f.w));
    let et = 0.75 / snowCfg.p[8].w;
    let mess = snowPrintMess(); let fine = clamp(0.0135 / max(fp, 1e-4), 0.0, 1.0);
    let p0 = snowPrint(xz, deep, mess, fine);
    let pf = clamp(0.1 / max(fp, 1e-4), 0.0, 1.0);
    trod = smoothstep(0.0, 0.006, abs(p0)) * pf;          // pressed or pushed up: broken snow — no smooth grain left to glint, no sheen
    let clod = trod * 0.35;   // (the slope of the clods there)
    let c0 = detailNoise(xz * (1.0 / 0.04) + vec2f(7.1, 2.3));
    let pxp = snowPrint(xz + vec2f(et, 0.0), deep, mess, fine); let pxm = snowPrint(xz - vec2f(et, 0.0), deep, mess, fine);
    let pzp = snowPrint(xz + vec2f(0.0, et), deep, mess, fine); let pzm = snowPrint(xz - vec2f(0.0, et), deep, mess, fine);
    gx += ((pxp - pxm) / (2.0 * et) + (detailNoise((xz + vec2f(0.02, 0.0)) * (1.0 / 0.04) + vec2f(7.1, 2.3)) - c0) * clod) * pf;
    gz += ((pzp - pzm) / (2.0 * et) + (detailNoise((xz + vec2f(0.0, 0.02)) * (1.0 / 0.04) + vec2f(7.1, 2.3)) - c0) * clod) * pf;
    pr = clamp(-p0 / max(deep, 1e-3), 0.0, 1.0) * pf;
    cup = clamp(((pxp + pxm + pzp + pzm) * 0.25 - p0) * (1.0 / 0.006), -1.0, 1.0) * mess * pf;   // untidy: > 0 at a lump's foot and in a crack, < 0 on its top (0 with mess 0)
  }
  var n = normalize(up + vec3f(-gx * k, 0.0, -gz * k));
  // the paint: fresh → trodden → old; a hollow holds a bluer, deeper shade and a crest catches a little more (snow glows from inside: its shade is never grey)
  var alb = mix(mix(snowCfg.p[2].xyz, snowCfg.p[3].xyz, f.z), snowCfg.p[4].xyz, f.w);
  let cav = clamp(((hxp + hxm + hzp + hzm) * 0.25 - hc) * 45.0 - n0 * 9.0, -1.0, 1.0);   // > 0 in a hollow
  let hol = max(max(cav, 0.0), pr * 0.9); let blue = snowCfg.p[6].x;   // (a print's floor is a hollow: bluer, and it sees less sky)
  alb = alb * mix(vec3f(1.0), vec3f(0.80, 0.90, 1.03), hol * blue) * (1.0 + 0.05 * max(-cav, 0.0)) * (1.0 - 0.45 * pr);
  alb = alb * (1.0 - 0.16 * max(cup, 0.0) + 0.10 * max(-cup, 0.0));   // (no ray is cast for a lump the size of a fist: its own shade at its foot is painted, and its top is the brightest snow there)
  var rough = mix(mix(snowCfg.p[7].w, snowCfg.p[7].w - 0.14, f.z), 1.0, trod);
  // glints: the surface cut into grains no finer than a pixel and a half (in octaves, so a grain is the same grain until the view has doubled its distance); a
  // few in a hundred lean their own way and are smooth — the lamps' highlights find them
  let fresh = (1.0 - f.z) * (1.0 - f.w) * snowCfg.p[2].w * (1.0 - trod);
  if (fresh > 0.01) {
    let g = 0.008 * exp2(ceil(log2(max(1.6 * fp, 0.008) / 0.008)));
    let ci = vec2i(floor(xz / g)); let salt = u32(log2(g / 0.008) + 0.5);
    if (snowHash(ci, salt) < snowCfg.p[6].z * fresh) {
      let t = vec2f(snowHash(ci, salt + 7u), snowHash(ci, salt + 13u)) - 0.5;
      n = normalize(n + vec3f(t.x, 0.0, t.y) * snowCfg.p[8].y);   // (a lean of its own — kept small: the same normal carries the grain's diffuse light, and a grain leant away from a low lamp is a dark speck)
      rough = snowCfg.p[6].w;
    }
  }
  o.albedo = alb; o.n = n; o.rough = rough;
  return o;
}

struct SnowBox { albedo: vec3f, n: vec3f, rough: f32, amt: f32, gone: bool };
/** fsBox's snow: what a box's pixel shows on a snow level. `ground` = an upward face at floor level of a box of the level file; `paint` = the box wears the snow
 *  paint. amt 0 = the pixel as it was; gone = not there at all (a thin strip's side under snow, a cap past its wandering edge). */
fn snowBox(wp: vec3f, nIn: vec3f, bi: u32, lc: vec3f, hf: vec4f, ground: bool, paint: bool, lay: bool, albedoIn: vec3f, roughIn: f32, fp: f32) -> SnowBox {
  var o: SnowBox; o.albedo = albedoIn; o.n = nIn; o.rough = roughIn; o.amt = 0.0; o.gone = false;
  let face = u32(max(hf.w, 0.0) + 0.5);
  let thin = hf.y < 0.016 && wp.y < 0.035;
  if (ground) {
    var f = snowField(wp.xz);
    if (lay && thin && f.z + f.w < 0.5) { o.gone = true; return o; }   // a path's strip where the field holds no path (it crosses earth a man cleared, a drift stands on it): not drawn — what lies under it is
    let gc = 0.02 * exp2(ceil(log2(max(1.5 * fp, 0.02) / 0.02)));   // (in octaves, as the glints' grains are: a grain is the same grain until the view has doubled its distance)
    let grain = snowHash(vec2i(floor(wp.xz / gc)), 3u + u32(log2(gc / 0.02) + 0.5));
    let amt = smoothstep(0.25, 0.75, f.y + (grain - 0.5) * 0.12);   // (a dusting at the snow's edge: it thins grain by grain, not along a line)
    if (amt <= 0.0) { return o; }
    f.y = 1.0;
    let s = snowShade(wp, f, vec3f(0.0, 1.0, 0.0), fp, true);
    o.albedo = mix(albedoIn, s.albedo, amt); o.n = normalize(mix(nIn, s.n, amt)); o.rough = mix(roughIn, s.rough, amt); o.amt = amt;
    return o;
  }
  if (thin && face != 2u) { o.gone = snowField(wp.xz).y > 0.3 || paint || lay; return o; }   // the side of a strip lying on the ground: under the snow, it is not seen
  if (!paint) { return o; }
  // a snow-painted box that is not the ground: a CAP (or what shows of a drift). Rounded off toward its edges; a thin one's edge wanders and its sides are not drawn
  let b = boxGeo[bi]; let cap = hf.y < 0.06 && (b.flags & BOX_NOSHADOW) != 0u;
  var up = nIn; var f = vec4f(0.0, 1.0, 0.0, 0.0);
  if (face == 2u) {
    let r = min(snowCfg.p[5].w, min(hf.x, hf.z) * 0.9);
    let q = abs(lc.xz) - (hf.xz - vec2f(r));
    let sd = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;   // signed distance to the cap's rounded outline (inside < 0)
    let a = vec2f(0.8776 * wp.x - 0.4794 * wp.z, 0.4794 * wp.x + 0.8776 * wp.z);
    let wav = (0.75 * detailNoise(a * (1.0 / 0.42)) + 0.25 * detailNoise(wp.xz * (1.0 / 0.17) + vec2f(2.7, 6.1))) * select(0.0, snowCfg.p[8].x * clamp(min(hf.x, hf.z) / 0.3, 0.25, 1.0), cap);   // (a small cap's edge wanders less: a bite out of a gatepost's cap is a hole)
    let d = sd + wav;
    if (d > 0.0) { o.gone = true; return o; }
    let out2 = select(vec2f(sign(lc.x), 0.0), vec2f(0.0, sign(lc.z)), q.y > q.x);
    let dir = select(out2, normalize(max(q, vec2f(0.0)) * sign(lc.xz) + out2 * 1e-4), q.x > 0.0 && q.y > 0.0);
    let t = clamp(1.0 + d / max(r, 1e-3), 0.0, 1.0);
    let crown = lc.xz / max(hf.xz, vec2f(1e-3)) * 0.22;   // (a cap is a low dome, not a slab: it leans away from its middle everywhere, and rolls off over its last hand or two)
    up = normalize(vec3f(0.0, 1.0, 0.0) + quatRotate(boxRot(bi), vec3f(dir.x * t * t * 1.5 + crown.x, 0.0, dir.y * t * t * 1.5 + crown.y)));
  } else if (cap) { o.gone = true; return o; }
  else { up = normalize(nIn + vec3f(0.0, 0.8, 0.0)); }   // what shows of a snow box's side leans up: a bank, not a wall
  let s = snowShade(wp, f, up, fp, false);
  o.albedo = s.albedo; o.n = s.n; o.rough = s.rough; o.amt = 1.0;
  return o;
}

// ---------------- the hills: the field's standing snow as a mesh ----------------
struct SnowVOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f };
@vertex fn vsSnow(@builtin(vertex_index) vi: u32, @location(0) quad: vec2u) -> SnowVOut {
  var corner = array<vec2u, 6>(vec2u(0u, 0u), vec2u(0u, 1u), vec2u(1u, 1u), vec2u(0u, 0u), vec2u(1u, 1u), vec2u(1u, 0u));
  let t = quad + corner[vi];
  let hgt = textureLoad(snowTex, vec2i(t), 0).x;
  let xz = snowCfg.p[0].xy + (vec2f(t) + 0.5) / snowCfg.p[0].z;
  var o: SnowVOut;
  o.wp = vec3f(xz.x, select(-0.012, hgt, hgt > 0.0), xz.y);   // (a corner with nothing standing on it dives under the ground: the hill meets the floor along a line of its own)
  o.pos = frame.viewProj * vec4f(o.wp, 1.0);
  return o;
}
@fragment fn fsSnow(v: SnowVOut) -> GOut {
  var o: GOut;
  let fp = distance(v.wp, frame.camPos) * 2.0 * frame.post.w * frame.invScreen.y;
  var f = snowField(v.wp.xz); f.y = 1.0;
  let s = snowShade(v.wp, f, vec3f(0.0, 1.0, 0.0), fp, true);
  o.albedo = vec4f(s.albedo, 1.0);
  o.normal = vec4f(s.n * 0.5 + 0.5, select(1.0, 0.3333, SNOW_GLOW || SNOW_SPARKLE));   // (.a under SNOW GLOW or SNOW SPARKLE: 1∕3 = snow — gbuffer.wgsl fsBox's output line, composite.wgsl snowGlowAmt)
  o.id = u32(snowCfg.p[0].w + 0.5);   // the snow lies on the ground: its pixels are the ground slab's to every pass that asks whose they are
  o.vel = vec2f(0.0);
  o.mat = vec2f(s.rough, 0.0);
  if (LOOK) { let lg = lookGround(v.wp, s.n, s.rough, fp); o.normal = vec4f(lg.n * 0.5 + 0.5, o.normal.a); o.mat = vec2f(lg.rough, 0.0); }   // THE LOOK PROTOTYPE (look.wgsl lookGround): the hills' relief × the panel's number, and the crust
  o.edge = EDGE_NONE;
  return o;
}
