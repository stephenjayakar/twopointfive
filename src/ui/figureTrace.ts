// RAYS FOR THE KIT FIGURE (ui/kitFigure.ts): a small CPU ray tracer over one man's triangles, so the software view of him on the Team & kit step is lit the way
// the game lights a man — sized lamps with soft shadows, light off the ground and off his own kit, a sky — instead of flat tones.
//
// Pure arithmetic over typed arrays: nothing of the game is imported, nothing is rolled (the sample points are a fixed low-discrepancy sequence), nothing is
// kept outside the objects handed back.

export interface Bvh {
  /** per node: min xyz, max xyz */
  bb: Float32Array;
  /** per node: an inner node's first child (the second is the next index), or a leaf's first triangle */
  kid: Int32Array;
  /** per node: 0 = inner, else the leaf's triangle count */
  cnt: Int32Array;
  /** per triangle, in leaf order: corner, edge 1, edge 2 */
  T: Float32Array;
  /** per triangle, in leaf order: its index in the list the tree was built from */
  tid: Int32Array;
  stack: Int32Array;
}

/** A tree over triangles `I` (three indices each) of points `P` (median split of the longest axis; ≤ 4 triangles a leaf). */
export function buildBvh(P: Float32Array, I: Uint32Array): Bvh {
  const n = (I.length / 3) | 0, cen = new Float32Array(n * 3), tb = new Float32Array(n * 6), order = new Uint32Array(n);
  for (let t = 0; t < n; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3; order[t] = t;
    for (let k = 0; k < 3; k++) { const x = P[a + k], y = P[b + k], z = P[c + k], lo = Math.min(x, y, z), hi = Math.max(x, y, z); tb[t * 6 + k] = lo; tb[t * 6 + 3 + k] = hi; cen[t * 3 + k] = (lo + hi) / 2; }
  }
  if (!n) return { bb: new Float32Array(0), kid: new Int32Array(0), cnt: new Int32Array(0), T: new Float32Array(0), tid: new Int32Array(0), stack: new Int32Array(2) };   // (nothing to hit: the walkers ask `cnt.length` first)
  const cap = Math.max(1, 2 * n), depth = new Uint16Array(cap); let deep = 0;
  const bb = new Float32Array(cap * 6), kid = new Int32Array(cap), cnt = new Int32Array(cap);
  let nodes = 1; const todo: number[] = [0, 0, n];
  while (todo.length) {
    const hi = todo.pop()!, lo = todo.pop()!, node = todo.pop()!, o = node * 6;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    for (let i = lo; i < hi; i++) { const t = order[i], q = t * 6, c = t * 3;
      if (tb[q] < x0) x0 = tb[q]; if (tb[q + 1] < y0) y0 = tb[q + 1]; if (tb[q + 2] < z0) z0 = tb[q + 2]; if (tb[q + 3] > x1) x1 = tb[q + 3]; if (tb[q + 4] > y1) y1 = tb[q + 4]; if (tb[q + 5] > z1) z1 = tb[q + 5];
      if (cen[c] < cx0) cx0 = cen[c]; if (cen[c] > cx1) cx1 = cen[c]; if (cen[c + 1] < cy0) cy0 = cen[c + 1]; if (cen[c + 1] > cy1) cy1 = cen[c + 1]; if (cen[c + 2] < cz0) cz0 = cen[c + 2]; if (cen[c + 2] > cz1) cz1 = cen[c + 2]; }
    bb[o] = x0; bb[o + 1] = y0; bb[o + 2] = z0; bb[o + 3] = x1; bb[o + 4] = y1; bb[o + 5] = z1;
    if (hi - lo <= 4) { kid[node] = lo; cnt[node] = hi - lo; continue; }
    const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0, ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2, mid = ax === 0 ? (cx0 + cx1) / 2 : ax === 1 ? (cy0 + cy1) / 2 : (cz0 + cz1) / 2;
    let i = lo, j = hi - 1;
    while (i <= j) { if (cen[order[i] * 3 + ax] < mid) i++; else { const s = order[i]; order[i] = order[j]; order[j] = s; j--; } }
    if (i === lo || i === hi) i = (lo + hi) >> 1;   // (every centre on one side: halve the run as it lies)
    kid[node] = nodes; cnt[node] = 0; todo.push(nodes, lo, i, nodes + 1, i, hi); depth[nodes] = depth[nodes + 1] = depth[node] + 1; if (depth[nodes] > deep) deep = depth[nodes]; nodes += 2;
  }
  const T = new Float32Array(n * 9), tid = new Int32Array(n);
  for (let i = 0; i < n; i++) { const t = order[i], a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, o = i * 9; tid[i] = t;
    T[o] = P[a]; T[o + 1] = P[a + 1]; T[o + 2] = P[a + 2]; T[o + 3] = P[b] - P[a]; T[o + 4] = P[b + 1] - P[a + 1]; T[o + 5] = P[b + 2] - P[a + 2]; T[o + 6] = P[c] - P[a]; T[o + 7] = P[c + 1] - P[a + 1]; T[o + 8] = P[c + 2] - P[a + 2]; }
  return { bb: bb.slice(0, nodes * 6), kid: kid.slice(0, nodes), cnt: cnt.slice(0, nodes), T, tid, stack: new Int32Array(Math.max(96, deep + 8)) };   // (a walker holds at most one waiting node a level)
}

const TMIN = 1e-4;
const nz = (d: number) => (d > -1e-9 && d < 1e-9 ? (d < 0 ? -1e-9 : 1e-9) : d);

/** anything between the origin and `tmax` along the ray */
export function occluded(B: Bvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number): boolean {
  const { bb, kid, cnt, T, stack } = B; if (!cnt.length) return false;
  const ix = 1 / nz(dx), iy = 1 / nz(dy), iz = 1 / nz(dz);
  let sp = 0; stack[sp++] = 0;
  while (sp) {
    const n = stack[--sp], o = n * 6;
    let a = (bb[o] - ox) * ix, b = (bb[o + 3] - ox) * ix, t0 = a < b ? a : b, t1 = a < b ? b : a;
    a = (bb[o + 1] - oy) * iy; b = (bb[o + 4] - oy) * iy; if (a < b) { if (a > t0) t0 = a; if (b < t1) t1 = b; } else { if (b > t0) t0 = b; if (a < t1) t1 = a; }
    a = (bb[o + 2] - oz) * iz; b = (bb[o + 5] - oz) * iz; if (a < b) { if (a > t0) t0 = a; if (b < t1) t1 = b; } else { if (b > t0) t0 = b; if (a < t1) t1 = a; }
    if (t1 < t0 || t1 < 0 || t0 > tmax) continue;
    const c = cnt[n];
    if (c === 0) { stack[sp++] = kid[n]; stack[sp++] = kid[n] + 1; continue; }
    for (let k = kid[n], e = k + c; k < e; k++) {
      const q = k * 9, e1x = T[q + 3], e1y = T[q + 4], e1z = T[q + 5], e2x = T[q + 6], e2y = T[q + 7], e2z = T[q + 8];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const inv = 1 / det, sx = ox - T[q], sy = oy - T[q + 1], sz = oz - T[q + 2], u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > TMIN && t < tmax) return true;
    }
  }
  return false;
}

/** the nearest triangle along the ray inside `tmax`: its index in the built list (−1 = none); the distance is left in `hitT` */
export let hitT = 0;
export function closest(B: Bvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number): number {
  const { bb, kid, cnt, T, tid, stack } = B; let best = -1; hitT = tmax; if (!cnt.length) return -1;
  const ix = 1 / nz(dx), iy = 1 / nz(dy), iz = 1 / nz(dz);
  let sp = 0; stack[sp++] = 0;
  while (sp) {
    const n = stack[--sp], o = n * 6;
    let a = (bb[o] - ox) * ix, b = (bb[o + 3] - ox) * ix, t0 = a < b ? a : b, t1 = a < b ? b : a;
    a = (bb[o + 1] - oy) * iy; b = (bb[o + 4] - oy) * iy; if (a < b) { if (a > t0) t0 = a; if (b < t1) t1 = b; } else { if (b > t0) t0 = b; if (a < t1) t1 = a; }
    a = (bb[o + 2] - oz) * iz; b = (bb[o + 5] - oz) * iz; if (a < b) { if (a > t0) t0 = a; if (b < t1) t1 = b; } else { if (b > t0) t0 = b; if (a < t1) t1 = a; }
    if (t1 < t0 || t1 < 0 || t0 > hitT) continue;
    const c = cnt[n];
    if (c === 0) { stack[sp++] = kid[n]; stack[sp++] = kid[n] + 1; continue; }
    for (let k = kid[n], e = k + c; k < e; k++) {
      const q = k * 9, e1x = T[q + 3], e1y = T[q + 4], e1z = T[q + 5], e2x = T[q + 6], e2y = T[q + 7], e2z = T[q + 8];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const inv = 1 / det, sx = ox - T[q], sy = oy - T[q + 1], sz = oz - T[q + 2], u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > TMIN && t < hitT) { hitT = t; best = tid[k]; }
    }
  }
  return best;
}

/** a point's own offset into the sample sequence: 0‥1 off an integer */
export function hash01(i: number, salt: number): number {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** the k-th point of the plane's R2 sequence (Roberts), moved by a per-point offset: two numbers in 0‥1 */
export const R2A = 0.7548776662466927, R2B = 0.5698402909980532;

// ------------------------------------------------------------ the game's tone curve (render/shaders/post.wgsl agx: KEEP IN STEP)

const LUT_N = 4096, LUT_MAX = 16.3, LUT_K = LUT_N / Math.sqrt(Math.sqrt(LUT_MAX));
let lut: Float32Array | null = null, lutP = new Float32Array(0);   // (the contrast curve, and the same to the look's power)
function curve(): Float32Array {
  if (lut) return lut;
  const L = lut = new Float32Array(LUT_N + 1), P = lutP = new Float32Array(LUT_N + 1), minEv = -12.47393, maxEv = 4.026069;
  for (let i = 0; i <= LUT_N; i++) {
    const r = i / LUT_N, x4 = r * r, lin = Math.max(x4 * x4 * LUT_MAX, 1e-10);   // (the table is laid out on the fourth root: the darks get most of it)
    const x = Math.min(1, Math.max(0, (Math.log2(lin) - minEv) / (maxEv - minEv))), x2 = x * x, xx4 = x2 * x2;
    const c = 15.5 * xx4 * x2 - 40.14 * xx4 * x + 31.96 * xx4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
    L[i] = Math.max(0, c); P[i] = Math.pow(L[i], 1.15);
  }
  return L;
}
/** linear light (already × exposure) → display bytes, into out[o‥o+2]: the post pass's AgX with its look (saturation as the game ships it) */
export function toneInto(out: Uint8ClampedArray | Float32Array, o: number, r: number, g: number, b: number, sat = 1.15): void {
  const L = lut ?? curve(), P = lutP, K = LUT_K;
  let x = 0.842479062253094 * r + 0.0784335999999992 * g + 0.0792237451477643 * b, y = 0.0423282422610123 * r + 0.878468636469772 * g + 0.0791661274605434 * b, z = 0.0423756549057051 * r + 0.0784336 * g + 0.879142973793104 * b;
  // (the look, as the shader has it: the grey is taken off the contrast curve BEFORE the power, and the powered colour is pushed from that grey)
  let i = Math.sqrt(Math.sqrt(x > 0 ? x : 0)) * K, ix = i > LUT_N ? LUT_N : i | 0;
  i = Math.sqrt(Math.sqrt(y > 0 ? y : 0)) * K; const iy = i > LUT_N ? LUT_N : i | 0;
  i = Math.sqrt(Math.sqrt(z > 0 ? z : 0)) * K; const iz = i > LUT_N ? LUT_N : i | 0;
  const lum = 0.2126 * L[ix] + 0.7152 * L[iy] + 0.0722 * L[iz]; x = lum + sat * (P[ix] - lum); y = lum + sat * (P[iy] - lum); z = lum + sat * (P[iz] - lum);
  out[o] = 255 * (1.19687900512017 * x - 0.0980208811401368 * y - 0.0990297440797205 * z);
  out[o + 1] = 255 * (-0.0528968517574562 * x + 1.15190312990417 * y - 0.0989611768448433 * z);
  out[o + 2] = 255 * (-0.0529716355144438 * x - 0.0980434501171241 * y + 1.15107367264116 * z);
}
