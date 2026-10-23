// THE LOOK PROTOTYPE's material maps (the page /look, render/frame.ts lookConfig; shaders/look.wgsl reads them): eleven tiling materials made HERE, by the page,
// at boot — no image file, nothing fetched, nothing licensed. Each layer is LOOK_N × LOOK_N texels over LOOK_TILE metres, two maps a layer:
//   A (rgba8): rgb = what the box's paint is multiplied by, ÷ 2 (128 = the paint as it is; so a map can also turn a hue), a = the height, 0‥1 of the layer's range
//   B (rgba8): rg = the tangent-space normal's xy (½ + ½·n), b = roughness, a = how open the texel is to the sky (cavity: 1 = open)
// Everything is periodic over the tile, so a layer repeats without a seam; the shader breaks the repeat up. Pure arithmetic on typed arrays: runs the same in a browser and under bun.
export const LOOK_N = 512, LOOK_TILE = 2.0, LOOK_LAYERS = 11;
/** the layers, in surface.wgsl's class order less one (SURF_MUD 1 → layer 0 …); the last three are the look's own (look.wgsl LOOK_CLOTH, LOOK_METAL, LOOK_PAINT) */
export const LOOK_NAMES = ['mud wall', 'plaster', 'block', 'earth', 'gravel', 'slab', 'wood', 'sheet', 'cloth', 'metal', 'paint'] as const;
/** the roughness each layer is written around (the shader adds a texel's difference from it to the box's own finish) */
export const LOOK_ROUGH = [0.95, 0.86, 0.93, 0.94, 0.88, 0.82, 0.84, 0.5, 0.96, 0.75, 0.5];

const TAU = Math.PI * 2;
function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 73856093) ^ Math.imul(iy | 0, 19349663) ^ Math.imul(seed | 0, 83492791)) >>> 0;
  h = (Math.imul(h, 747796405) + 2891336453) >>> 0; h = Math.imul((h >>> ((h >>> 28) + 4)) ^ h, 277803737) >>> 0;
  return (((h >>> 22) ^ h) >>> 0) / 4294967296;
}
const wrap = (i: number, p: number) => ((i % p) + p) % p;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** value noise, 0‥1, with `px` × `py` cells across the tile (u, v in tiles) */
function vn(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px, y = v * py, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = hash(wrap(ix, px), wrap(iy, py), seed), b = hash(wrap(ix + 1, px), wrap(iy, py), seed), c = hash(wrap(ix, px), wrap(iy + 1, py), seed), d = hash(wrap(ix + 1, px), wrap(iy + 1, py), seed);
  return mix(mix(a, b, wx), mix(c, d, wx), wy);
}
/** `oct` octaves of it from `p` cells up, 0‥1 */
function fbm(u: number, v: number, p: number, oct: number, seed: number, gain = 0.5): number {
  let s = 0, a = 1, n = 0, q = p;
  for (let o = 0; o < oct; o++) { s += a * vn(u, v, q, q, seed + o * 17); n += a; a *= gain; q *= 2; }
  return s / n;
}
interface Cell { f1: number; f2: number; id: number; dx: number; dy: number }
const cellOut: Cell = { f1: 0, f2: 0, id: 0, dx: 0, dy: 0 };
/** the nearest two feature points of a jittered `p` × `p` lattice: distances in CELLS, the nearest one's hash and the offset to it (cells) */
function cells(u: number, v: number, p: number, seed: number, jitter = 0.85): Cell {
  const x = u * p, y = v * p, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = wrap(ix + i, p), cy = wrap(iy + j, p);
    const px = ix + i + 0.5 + (hash(cx, cy, seed) - 0.5) * jitter, py = iy + j + 0.5 + (hash(cx, cy, seed + 1) - 0.5) * jitter;
    const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
    if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, seed + 2); bx = dx; by = dy; } else if (d < f2) f2 = d;
  }
  cellOut.f1 = f1; cellOut.f2 = f2; cellOut.id = id; cellOut.dx = bx; cellOut.dy = by; return cellOut;
}

/** one texel as a material writes it: height (m), paint multiplier, roughness */
interface Tex { h: number; r: number; g: number; b: number; rough: number }
type Mat = (u: number, v: number, t: Tex) => void;
const tint = (t: Tex, k: number) => { t.r *= k; t.g *= k; t.b *= k; };
const hue = (t: Tex, r: number, g: number, b: number, k: number) => { t.r *= mix(1, r, k); t.g *= mix(1, g, k); t.b *= mix(1, b, k); };

// ---- a hand-laid mud wall: lumps the size of a hand, the sweep of the hand that smoothed it (never straight, never even), straw in it, shrinkage cracks where it
// dried fastest, pits where a stone fell out
const mud: Mat = (u, v, t) => {
  const lump = fbm(u, v, 5, 4, 11), mid = fbm(u, v, 22, 3, 12);
  const wu = u + 0.05 * (fbm(u, v, 3, 2, 13) - 0.5), wv = v + 0.09 * (fbm(u, v, 4, 2, 14) - 0.5);
  const sweep = vn(wu, wv, 7, 46, 15) * vn(u, v, 9, 9, 16);                       // strokes that come and go
  t.h = 0.02 * (lump - 0.5) + 0.005 * (mid - 0.5) + 0.003 * (sweep - 0.25);
  tint(t, 1 + 0.2 * (lump - 0.5) + 0.1 * (mid - 0.5));
  const region = smooth(0.6, 0.74, fbm(u, v, 3, 3, 17));                           // cracks keep to the patches that dried hard
  const c = cells(u + 0.02 * (mid - 0.5), v + 0.02 * (lump - 0.5), 6, 18);
  const crack = smooth(0.045, 0.01, c.f2 - c.f1) * region * (0.35 + 0.65 * vn(u, v, 11, 11, 21));   // (fewer, finer, and no two of one weight)
  t.h -= 0.007 * crack; tint(t, 1 - 0.4 * crack); t.rough = 0.95 + 0.03 * crack;
  const s = cells(u, v, 44, 19, 1);                                               // straw: a short pale fibre in about a third of the cells, each at its own angle
  if (s.id < 0.2) {
    const a = s.id * 97, ca = Math.cos(a), sa = Math.sin(a), along = s.dx * ca + s.dy * sa, across = Math.abs(-s.dx * sa + s.dy * ca);
    const f = smooth(0.07, 0.03, across) * smooth(0.42, 0.3, Math.abs(along));
    t.h += 0.0018 * f; hue(t, 1.32, 1.26, 1.02, f);
  }
  const p = cells(u, v, 27, 20);
  if (p.id < 0.05) { const f = smooth(0.3, 0.1, p.f1 + 0.25 * (vn(u, v, 90, 90, 21) - 0.5)) * smooth(0.0, 0.2, p.f2 - p.f1); t.h -= 0.005 * f; tint(t, 1 - 0.25 * f); }
  hue(t, 0.96, 1.0, 1.06, smooth(0.55, 0.8, mid) * 0.6);                           // paler, dustier on the high spots
};
// ---- render over block: a trowelled coat, hairline crazing, and the places it has let go of the wall and shows what is under it
const plaster: Mat = (u, v, t) => {
  const low = fbm(u, v, 3, 3, 31), wu = u + 0.06 * (fbm(u, v, 4, 2, 32) - 0.5), wv = v + 0.06 * (fbm(u, v, 4, 2, 33) - 0.5);
  const trowel = vn(wu, wv, 5, 38, 34), speck = vn(u, v, 190, 190, 35);
  t.h = 0.005 * (low - 0.5) + 0.0014 * (trowel - 0.5) + 0.0005 * (speck - 0.5);
  tint(t, 1 + 0.1 * (low - 0.5) + 0.05 * (trowel - 0.5) + 0.03 * (speck - 0.5)); t.rough = 0.84 + 0.06 * trowel;
  const c = cells(u + 0.12 * (fbm(u, v, 6, 3, 41) - 0.5), v + 0.12 * (fbm(u, v, 6, 3, 42) - 0.5), 3, 36);
  const hair = smooth(0.02, 0.004, c.f2 - c.f1) * smooth(0.5, 0.7, fbm(u, v, 3, 2, 37));
  t.h -= 0.002 * hair; tint(t, 1 - 0.3 * hair);
  const gone = fbm(u, v, 4, 4, 38) + 0.08 * (vn(u, v, 40, 40, 39) - 0.5);
  const off = smooth(0.635, 0.655, gone), lip = smooth(0.6, 0.635, gone) * (1 - off);
  if (off > 0) {                                                                    // the coat is off: a step down to the rough block face
    const under = fbm(u, v, 60, 3, 40), course = smooth(0.42, 0.5, Math.abs(((v * 10) % 1) - 0.5));
    t.h = mix(t.h, -0.008 + 0.003 * (under - 0.5) - 0.004 * course, off);
    t.r = mix(t.r, 0.7 + 0.2 * under - 0.12 * course, off); t.g = mix(t.g, 0.68 + 0.2 * under - 0.12 * course, off); t.b = mix(t.b, 0.68 + 0.2 * under - 0.12 * course, off);
    t.rough = mix(t.rough, 0.97, off);
  }
  t.h += 0.0012 * lip; tint(t, 1 + 0.07 * lip);                                    // the edge of the coat curls up, and is the palest thing on the wall
};
// ---- concrete block in a running bond: 40 × 20 cm blocks, each its own shade, raked mortar joints, pitted faces, corners knocked off
const block: Mat = (u, v, t) => {
  const row = Math.floor(v * 10), x = u * 5 + 0.5 * (row & 1), col = wrap(Math.floor(x), 5), fx = x - Math.floor(x), fy = v * 10 - row;
  const d = Math.min(Math.min(fx, 1 - fx) * 0.4, Math.min(fy, 1 - fy) * 0.2);       // metres to the block's edge
  const chip = smooth(0.62, 0.9, vn(u, v, 36, 36, 51)) * smooth(0.05, 0.0, d);    // corners and arrises knocked off, here and there
  const joint = smooth(0.011 + 0.02 * chip, 0.005, d);
  const id = hash(col, row, 52), id2 = hash(col, row, 53), pit = vn(u, v, 150, 150, 54), pore = cells(u, v, 64, 55);
  const hole = pore.id < 0.14 ? smooth(0.14 + 0.2 * pore.id * 7, 0.06, pore.f1) : 0;
  t.h = (1 - joint) * (0.0016 * (id - 0.5) + 0.0014 * (pit - 0.5) - 0.0022 * hole + 0.0015 * (fbm(u, v, 12, 2, 56) - 0.5)) - 0.0065 * joint;
  tint(t, 1 + 0.26 * (id - 0.5) + 0.08 * (pit - 0.5) - 0.2 * hole); hue(t, 1.05, 1.0, 0.94, id2);
  if (joint > 0) { const m = vn(u, v, 90, 90, 57); t.r = mix(t.r, 1.12 + 0.14 * m, joint); t.g = mix(t.g, 1.12 + 0.14 * m, joint); t.b = mix(t.b, 1.14 + 0.14 * m, joint); }
  t.rough = mix(0.92 + 0.04 * pit, 0.98, joint);
};
// ---- a yard of beaten earth: hard-packed and smooth where it is walked, stones worked up to the surface in drifts, fine cracks where a puddle dried
const earth: Mat = (u, v, t) => {
  const low = fbm(u, v, 3, 4, 71), mid = fbm(u, v, 18, 3, 72), grit = vn(u, v, 170, 170, 73), pack = smooth(0.4, 0.62, fbm(u, v, 4, 3, 74));
  t.h = 0.012 * (low - 0.5) + 0.0035 * (mid - 0.5) * (1 - 0.6 * pack) + 0.0008 * (grit - 0.5);
  tint(t, 1 + 0.22 * (low - 0.5) + 0.1 * (mid - 0.5) + 0.07 * (grit - 0.5) + 0.07 * pack); t.rough = 0.97 - 0.1 * pack;
  const drift = smooth(0.5, 0.72, fbm(u, v, 5, 3, 75));                             // where the stones gather
  for (let k = 0; k < 2; k++) {
    const s = cells(u, v, k ? 46 : 19, 76 + k * 5), want = k ? 0.05 + 0.34 * drift : 0.02 + 0.2 * drift;
    if (s.id < want) {
      const r = 0.2 + 0.26 * hash(Math.floor(s.id * 9973), k, 77), rr = r * (0.8 + 0.4 * vn(u, v, 70, 70, 81)), dome = smooth(0, 1, 1 - (s.f1 / rr) * (s.f1 / rr)) * smooth(0.0, 0.14, s.f2 - s.f1);
      if (dome > 0) {
        const cellM = LOOK_TILE / (k ? 46 : 19), f = smooth(0.0, 0.35, dome), shade = 0.85 + 0.6 * hash(Math.floor(s.id * 7919), k, 78);
        t.h = Math.max(t.h, t.h * (1 - f) + (0.22 * r * cellM * dome));
        t.r = mix(t.r, 1.15 * shade, f); t.g = mix(t.g, 1.2 * shade, f); t.b = mix(t.b, 1.38 * shade, f); t.rough = mix(t.rough, 0.8, f);
        const sun = clamp01(0.5 - 0.4 * (s.dx + s.dy) / r); tint(t, mix(1, 0.9 + 0.2 * sun, f));   // a stone is lighter on one shoulder: it reads as round with no lamp on it
      }
    }
  }
  const c = cells(u, v, 11, 79), dried = smooth(0.58, 0.72, fbm(u, v, 3, 2, 80)) * pack;
  const crack = smooth(0.035, 0.008, c.f2 - c.f1) * dried * smooth(0.5, 0.75, vn(u, v, 5, 5, 82)); t.h -= 0.002 * crack; tint(t, 1 - 0.22 * crack);
};
// ---- gravel: stones shoulder to shoulder, two sizes, every one its own grey, dark between them
const gravel: Mat = (u, v, t) => {
  let h = -0.006, f = 0, shade = 1, hueK = 0, sh = 0;
  for (let k = 0; k < 2; k++) {
    const p = k ? 58 : 30, s = cells(u, v, p, 91 + k * 7, 0.95), cellM = LOOK_TILE / p;
    const r = 0.5 + 0.22 * s.id, dome = Math.sqrt(Math.max(0, 1 - (s.f1 / r) * (s.f1 / r))) * smooth(0.0, 0.16, s.f2 - s.f1);
    const hh = (k ? 0.36 : 0.5) * cellM * dome - (k ? 0.003 : 0);
    if (hh > h) { h = hh; f = smooth(0, 0.3, dome); shade = 0.68 + 0.75 * hash(Math.floor(s.id * 9973), k, 92); hueK = hash(Math.floor(s.id * 7919), k, 93); sh = clamp01(0.5 - 0.45 * (s.dx + s.dy) / r); }
  }
  t.h = h; const fine = vn(u, v, 200, 200, 94);
  tint(t, mix(0.5, shade * (0.82 + 0.36 * sh), f) * (0.96 + 0.08 * fine)); hue(t, 1.1, 1.0, 0.86, f * hueK * 0.8); hue(t, 0.94, 1.0, 1.12, f * (1 - hueK) * 0.6);
  t.rough = mix(0.97, 0.78, f);
};
// ---- a concrete slab, two metres square: floated and brushed, pores, a stain or two, one crack, a tooled joint at its edge with the arris broken here and there
const slab: Mat = (u, v, t) => {
  const low = fbm(u, v, 4, 4, 111), brush = vn(u + 0.01 * (low - 0.5), v, 6, 150, 112), fine = vn(u, v, 180, 180, 113);
  t.h = 0.002 * (low - 0.5) + 0.0006 * (brush - 0.5) + 0.0004 * (fine - 0.5);
  tint(t, 1 + 0.14 * (low - 0.5) + 0.05 * (brush - 0.5) + 0.04 * (fine - 0.5)); t.rough = 0.8 + 0.08 * brush;
  const p = cells(u, v, 76, 114); if (p.id < 0.22) { const f = smooth(0.28, 0.1, p.f1); t.h -= 0.0018 * f; tint(t, 1 - 0.28 * f); }
  const stain = smooth(0.62, 0.8, fbm(u, v, 3, 4, 115)); tint(t, 1 - 0.16 * stain); t.rough -= 0.22 * stain;   // something was spilt and soaked in: darker, a little glossier
  const c = cells(u, v, 2, 116, 0.6), crack = smooth(0.02, 0.004, (c.f2 - c.f1) + 0.012 * (vn(u, v, 30, 30, 117) - 0.5)) * smooth(0.6, 0.78, vn(u, v, 2, 2, 118));
  t.h -= 0.0025 * crack; tint(t, 1 - 0.45 * crack);
  const d = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v)) * LOOK_TILE, broke = smooth(0.6, 0.85, vn(u, v, 26, 26, 119));
  const joint = smooth(0.011 + 0.02 * broke, 0.004, d), round = smooth(0.03, 0.011, d) * (1 - joint);
  t.h -= 0.007 * joint + 0.0015 * round; tint(t, 1 - 0.5 * joint + 0.05 * round); t.rough = mix(t.rough, 0.97, joint);
};
// ---- sawn boards, 12.5 cm wide, grain along u: every board from a different tree, cupped a little, gaps you can lose a coin in, knots, the butt joints staggered
const wood: Mat = (u, v, t) => {
  const y = v * 16, p = wrap(Math.floor(y), 16), fy = y - Math.floor(y), id = hash(p, 0, 131), id2 = hash(p, 1, 131);
  const off = id * 37, warp = 0.5 * (vn(u + off, v, 3, 16, 132) - 0.5);
  const ring = vn(u + off, (fy + warp) * 0.999, 2, 9, 133), line = vn(u + off, v, 10, 16 * 34, 134), fib = vn(u + off, v, 60, 16 * 90, 135);
  const grain = 0.55 * Math.abs(Math.sin(ring * 14)) + 0.3 * line + 0.15 * fib;
  const gap = smooth(0.04, 0.018, Math.min(fy, 1 - fy));
  let du = Math.abs(u - id2); du = Math.min(du, 1 - du); const butt = smooth(0.0022, 0.0008, du);
  const seam = Math.max(gap, butt);
  t.h = 0.0011 * (grain - 0.5) - 0.0012 * Math.cos((fy - 0.5) * TAU * 0.5) * (id - 0.3) - 0.008 * seam;
  tint(t, (0.8 + 0.42 * id) * (1 + 0.3 * (grain - 0.5))); hue(t, 1.08, 1.0, 0.86, id2); hue(t, 0.9, 0.95, 1.06, smooth(0.6, 0.9, id) * 0.8);   // some boards have gone grey
  const k = cells(u * 1 + off, fy * 0.5, 3, 136 + p, 0.9);
  if (k.id < 0.3) { const e = Math.hypot(k.dx * 0.3, k.dy * 1.4), f = smooth(0.12, 0.03, e), halo = smooth(0.3, 0.1, e) * (1 - f); tint(t, 1 - 0.55 * f + 0.1 * halo * Math.sin(e * 90)); t.h -= 0.0012 * f; }
  tint(t, 1 - 0.75 * seam); t.rough = mix(0.8 + 0.1 * line, 0.98, seam);
  for (const e of [0.012, -0.012]) { let dn = Math.abs(u - id2 - e); dn = Math.min(dn, 1 - dn); const n = smooth(0.0035, 0.002, Math.hypot(dn * 1, (fy - 0.5) * 0.0625 * 0.45)); tint(t, 1 - 0.6 * n); t.h -= 0.0008 * n; if (n > 0) t.rough = mix(t.rough, 0.5, n); }   // a nail each side of a butt joint
};
// ---- corrugated sheet, ribs up and down (v): zinc spangle where it is sound, rust that starts in the valleys and at the laps and runs down, dents, a row of screws
const sheet: Mat = (u, v, t) => {
  const ph = u * 27, rib = 0.5 + 0.5 * Math.cos(ph * TAU), crest = Math.pow(rib, 0.7);
  const dent = fbm(u, v, 3, 2, 151), spangle = cells(u, v, 70, 152), run = vn(u, v, 27, 3, 153), patch = fbm(u, v, 4, 4, 154);
  const lapD = Math.min(v, 1 - v), lap = smooth(0.012, 0.004, lapD);                 // sheets lap every two metres
  const rust = smooth(0.66, 0.86, patch + 0.16 * (run - 0.5) + 0.12 * (1 - rib) + 0.45 * smooth(0.14, 0.0, lapD) * run);
  t.h = 0.0095 * crest + 0.004 * (dent - 0.5) + 0.0005 * rust * (vn(u, v, 120, 120, 155) - 0.5) + 0.0012 * lap;
  tint(t, 0.95 + 0.12 * spangle.id + 0.06 * (dent - 0.5)); t.rough = 0.42 + 0.14 * spangle.id;
  const deep = vn(u, v, 60, 60, 156);
  t.r = mix(t.r, 0.5 + 0.2 * deep, rust); t.g = mix(t.g, 0.29 + 0.11 * deep, rust); t.b = mix(t.b, 0.19 + 0.06 * deep, rust); t.rough = mix(t.rough, 0.94, rust);
  tint(t, 1 - 0.25 * lap);
  const sv = Math.abs(v - 0.5), su = Math.abs(((ph / 3 + 0.5) % 1) - 0.5) * 3 / 27;      // a screw on every third crest (27 ribs: nine screws, whole at the seam), half way up the sheet
  const screw = smooth(0.006, 0.003, Math.hypot(su, sv)), washer = smooth(0.011, 0.008, Math.hypot(su, sv)) * (1 - screw);
  t.h += 0.002 * screw + 0.0008 * washer; tint(t, 1 - 0.5 * washer + 0.15 * screw); if (screw + washer > 0) t.rough = mix(t.rough, 0.7, washer);
};
// ---- sackcloth, canvas, a blanket: a plain weave drawn coarse enough to survive the play camera (a thread every 1.6 cm), no thread the weight of its neighbour
// and none of them straight; the cloth itself lies in folds, holds dust in them and is stained
const cloth: Mat = (u, v, t) => {
  const N = 128;
  const x = (u + 0.006 * (vn(u, v, 6, 6, 171) - 0.5)) * N, y = (v + 0.006 * (vn(u, v, 6, 6, 172) - 0.5)) * N;
  const ix = wrap(Math.floor(x), N), iy = wrap(Math.floor(y), N), fx = x - Math.floor(x), fy = y - Math.floor(y);
  const over = ((ix + iy) & 1) === 0;                                   // warp over weft at every other crossing
  const a = Math.sin(fx * Math.PI), b = Math.sin(fy * Math.PI);
  const thick = over ? hash(ix, 0, 173) : hash(0, iy, 174);             // a thread keeps its weight along its whole length: slubs run across the cloth
  const yarn = over ? a * (0.55 + 0.45 * b) : b * (0.55 + 0.45 * a);
  const fold = 0.6 * vn(u, v, 2, 7, 175) + 0.4 * vn(u, v, 5, 13, 176), stain = fbm(u, v, 3, 3, 177);   // it lies in folds that run one way more than the other
  t.h = 0.0015 * yarn * (0.6 + 0.8 * thick) + 0.011 * (fold - 0.5);
  tint(t, (0.82 + 0.3 * thick) * (0.78 + 0.22 * yarn) * (1 + 0.3 * (fold - 0.5)));
  hue(t, 0.88, 0.86, 0.82, smooth(0.5, 0.85, stain) * 0.6);
  t.rough = 0.93 + 0.06 * yarn;
};
// ---- bare iron left out: a skin of rust that blooms in patches and lifts in plates, pits, and bright scratches where the skin is still sound
const metal: Mat = (u, v, t) => {
  const bloom = fbm(u, v, 5, 4, 181), fine = fbm(u, v, 40, 3, 182), pit = cells(u, v, 46, 183), where = fbm(u, v, 6, 2, 187);
  const pits = pit.id < 0.5 * smooth(0.45, 0.7, where) ? smooth(0.3, 0.1, pit.f1) : 0;   // pits come in patches
  const rust = smooth(0.4, 0.64, bloom + 0.25 * (fine - 0.5));
  const plate = cells(u + 0.02 * (fine - 0.5), v + 0.02 * (bloom - 0.5), 11, 186), lift = rust * smooth(0.55, 0.8, where + 0.3 * (plate.id - 0.5)), edge = lift * smooth(0.07, 0.015, plate.f2 - plate.f1);   // where it is worst the skin lifts in plates
  const scratch = Math.max(smooth(0.88, 0.95, vn(u, v, 3, 150, 184)), smooth(0.91, 0.97, vn(u, v, 120, 4, 185))) * (1 - rust);
  t.h = 0.0014 * rust * (fine - 0.5) + 0.0011 * lift * (plate.id - 0.5) - 0.0011 * edge - 0.0013 * pits - 0.0003 * scratch;
  tint(t, 0.86 + 0.34 * (fine - 0.5) + 0.26 * (bloom - 0.5));
  hue(t, 1.28, 0.92, 0.68, rust * (0.5 + 0.5 * fine));
  tint(t, (1 - 0.3 * edge) * (1 - 0.4 * pits) * (1 + 0.5 * scratch));
  t.rough = mix(mix(0.5, 0.97, rust), 0.3, scratch);
};
// ---- old paint on steel or boards (a drum, a gate, a truck's door): dented, chalked by the sun, scuffed in long strokes, and gone in ragged patches with a
// lifted rim, down to what is under it
const paint: Mat = (u, v, t) => {
  const dent = fbm(u, v, 3, 3, 191), peel = fbm(u, v, 7, 4, 192), fine = vn(u, v, 90, 90, 193), chip = cells(u, v, 9, 194, 1.0), brush = vn(u, v, 4, 150, 195);
  const e = peel + 0.35 * (0.5 - chip.f1) + 0.12 * (fine - 0.5);
  const gone = smooth(0.66, 0.72, e), rim = smooth(0.59, 0.66, e) * (1 - gone);
  const scuff = smooth(0.82, 0.96, vn(u, v, 2, 70, 196)) * (1 - gone);
  const under = vn(u, v, 50, 50, 198);
  t.h = 0.003 * (dent - 0.5) + 0.00025 * (brush - 0.5) - 0.0007 * gone + 0.0004 * rim + 0.0004 * gone * (under - 0.5);
  tint(t, 0.93 + 0.16 * (dent - 0.5) + 0.06 * (brush - 0.5));
  hue(t, 1.1, 1.08, 1.06, smooth(0.4, 0.8, fbm(u, v, 2, 2, 197)) * 0.6);   // chalked pale in patches
  tint(t, 1 + 0.3 * rim + 0.22 * scuff);
  t.r = mix(t.r, 0.62 + 0.2 * under, gone); t.g = mix(t.g, 0.4 + 0.12 * under, gone); t.b = mix(t.b, 0.3 + 0.08 * under, gone);   // (a multiplier of the paint: bare patches come out dark and warm whatever the paint was)
  t.rough = mix(mix(0.46 + 0.08 * brush, 0.72, scuff), 0.94, gone);
};
const MATS: Mat[] = [mud, plaster, block, earth, gravel, slab, wood, sheet, cloth, metal, paint];
/** how much the relief is stood up when the normal is taken off the height (1 = true to the metres above; a map read from twenty metres wants more) */
const RELIEF = [1.6, 1.8, 1.5, 1.6, 1.3, 1.8, 1.6, 1.0, 1.6, 1.6, 1.6];

/** one layer's two maps at full size (LOOK_N² × 4 bytes each) */
export function lookLayer(layer: number, N = LOOK_N): { a: Uint8Array; b: Uint8Array } {
  const mat = MATS[layer], H = new Float32Array(N * N), a = new Uint8Array(N * N * 4), b = new Uint8Array(N * N * 4), R = new Float32Array(N * N);
  const t: Tex = { h: 0, r: 1, g: 1, b: 1, rough: 1 };
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    t.h = 0; t.r = t.g = t.b = 1; t.rough = LOOK_ROUGH[layer];
    mat((x + 0.5) / N, (y + 0.5) / N, t);
    const i = y * N + x; H[i] = t.h; R[i] = t.rough; if (t.h < lo) lo = t.h; if (t.h > hi) hi = t.h;
    a[i * 4] = Math.round(255 * clamp01(t.r * 0.5)); a[i * 4 + 1] = Math.round(255 * clamp01(t.g * 0.5)); a[i * 4 + 2] = Math.round(255 * clamp01(t.b * 0.5));
  }
  // cavity: how far a texel sits under the mean of its neighbourhood (a box blur of ±R texels, periodic, two passes)
  const rad = Math.max(2, Math.round(N / 85)), tmp = new Float32Array(N * N), blur = new Float32Array(N * N), w = 1 / (2 * rad + 1);
  for (let y = 0; y < N; y++) { let s = 0; for (let k = -rad; k <= rad; k++) s += H[y * N + wrap(k, N)]; for (let x = 0; x < N; x++) { tmp[y * N + x] = s * w; s += H[y * N + wrap(x + rad + 1, N)] - H[y * N + wrap(x - rad, N)]; } }
  for (let x = 0; x < N; x++) { let s = 0; for (let k = -rad; k <= rad; k++) s += tmp[wrap(k, N) * N + x]; for (let y = 0; y < N; y++) { blur[y * N + x] = s * w; s += tmp[wrap(y + rad + 1, N) * N + x] - tmp[wrap(y - rad, N) * N + x]; } }
  const texel = LOOK_TILE / N, k = RELIEF[layer] / (2 * texel), span = Math.max(hi - lo, 1e-6);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const sx = (H[y * N + wrap(x + 1, N)] - H[y * N + wrap(x - 1, N)]) * k, sy = (H[wrap(y + 1, N) * N + x] - H[wrap(y - 1, N) * N + x]) * k, il = 1 / Math.hypot(sx, sy, 1);
    a[i * 4 + 3] = Math.round(255 * (H[i] - lo) / span);
    b[i * 4] = Math.round(255 * (0.5 - 0.5 * sx * il)); b[i * 4 + 1] = Math.round(255 * (0.5 - 0.5 * sy * il));
    b[i * 4 + 2] = Math.round(255 * clamp01(R[i])); b[i * 4 + 3] = Math.round(255 * clamp01(1 - (blur[i] - H[i]) * 160));
  }
  return { a, b };
}
/** the next mip of one map (a 2 × 2 mean; for B the normal is left SHORT where its four texels disagree, and that shortfall is put into the roughness: relief too fine
 *  to draw at this size turns into a duller surface instead of a shimmer) */
export function lookMip(src: Uint8Array, n: number, isB: boolean): Uint8Array {
  const m = n >> 1, out = new Uint8Array(m * m * 4);
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
    const o = (y * m + x) * 4, i0 = ((2 * y) * n + 2 * x) * 4, i1 = i0 + 4, i2 = i0 + n * 4, i3 = i2 + 4;
    for (let c = 0; c < 4; c++) out[o + c] = (src[i0 + c] + src[i1 + c] + src[i2 + c] + src[i3 + c] + 2) >> 2;
    if (isB) {
      let len = 0;
      for (const i of [i0, i1, i2, i3]) { const nx = src[i] / 127.5 - 1, ny = src[i + 1] / 127.5 - 1; len += Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); }
      const mx = out[o] / 127.5 - 1, my = out[o + 1] / 127.5 - 1, flat = Math.sqrt(Math.max(0, 1 - mx * mx - my * my)) - len / 4;   // > 0 where the four normals fan out
      out[o + 2] = Math.min(255, out[o + 2] + Math.round(255 * Math.min(0.35, 2.2 * Math.max(0, flat))));
    }
  }
  return out;
}
