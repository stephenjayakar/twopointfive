// Triangle BVH over the character mesh — the CPU half of mesh-traced character shadows (render/meshShadows.ts is the GPU half; the WGSL
// traversal lives in common.wgsl under FLAG_MESH_SHADOWS). Pure TypeScript, no GPU: the game builds the topology with it once, and
// tools/qa/mesh-shadow-ref.ts uses the reference skinning / refit / traversal below to prove the scheme before anyone looks at a GPU.
//
// The scheme. Every mannequin is the same glTF mesh, so ONE tree topology serves all of them: it is built once over the rest-pose triangles
// (binned SAH on centroids, leaves of ≤ LEAF_MAX triangles, triangles reordered so every leaf — and every subtree — owns a contiguous run),
// flattened depth-first with skip pointers (left child = i + 1, `skip[i]` = the node after this subtree = where a ray goes when it misses
// node i or is done with it; a stackless walk). Per frame and per character the GPU re-skins the triangle corners and REFITS the boxes
// bottom-up (deepest depth level first — nodes are also listed by level for that), never rebuilding: a posed limb only ever moves boxes,
// the topology of a body does not change. A refit tree is looser than a rebuilt one for extreme poses (an arm stretched out overlaps the
// torso's box); the harness measures the cost of that in node visits.
import { Vec3 } from '../math/vec';

/** triangles per leaf at most (the GPU leaf loop and the packed count byte assume ≤ 255; 4 is the usual any-hit sweet spot) */
export const LEAF_MAX = 4;
/** characters that get a tree on the GPU (= BoxWorld's capsule character cap: the capsule list and the skin instances are the same list in the same order) */
export const MESH_MAX_CHARS = 8;
const BINS = 12;          // SAH candidate planes per axis
const MAX_DEPTH = 40;     // past this a range is split at its median instead of by SAH (bounds the refit's level loop; never reached on the mannequin)

export interface MeshBvh {
  numTris: number;            // T
  numNodes: number;           // N
  maxDepth: number;           // deepest node (root = 0); the refit walks maxDepth+1 levels
  corners: Uint32Array;       // 3T vertex indices: triangle t of the BVH order is (corners[3t], corners[3t+1], corners[3t+2])
  triOrder: Uint32Array;      // T: BVH-ordered triangle → source triangle (indices[3s..])
  skip: Uint32Array;          // N: the node a ray visits next when it misses node i or has finished it (N = done)
  right: Int32Array;          // N: right child of an internal node (its left child is i + 1); −1 for a leaf
  triStart: Uint32Array;      // N: first triangle of a leaf (of the subtree, for internal nodes — subtrees own contiguous runs)
  triCount: Uint32Array;      // N: triangles in a leaf; 0 = internal node
  subtreeEnd: Uint32Array;    // N: one past the last triangle under node i (leaf: triStart + triCount)
  depth: Uint16Array;         // N
  levelNodes: Uint32Array;    // N node indices, deepest level first (the GPU refit's processing order)
  levelOff: Uint32Array;      // maxDepth + 2 entries: level L (0 = deepest) is levelNodes[levelOff[L] .. levelOff[L+1])
  stats: { leaves: number; avgLeaf: number; maxLeaf: number; medianSplits: number };
}

/** Build the topology over rest-pose `positions` (3 per vertex) and `indices` (3 per triangle). ~13.7k triangles: a few tens of ms. */
export function buildMeshBvh(positions: Float32Array, indices: Uint32Array): MeshBvh {
  const T = (indices.length / 3) | 0;
  // per source triangle: centroid + bounds
  const cen = new Float64Array(T * 3), bmin = new Float64Array(T * 3), bmax = new Float64Array(T * 3);
  for (let t = 0; t < T; t++) {
    for (let a = 0; a < 3; a++) {
      const p0 = positions[indices[t * 3] * 3 + a], p1 = positions[indices[t * 3 + 1] * 3 + a], p2 = positions[indices[t * 3 + 2] * 3 + a];
      cen[t * 3 + a] = (p0 + p1 + p2) / 3; bmin[t * 3 + a] = Math.min(p0, p1, p2); bmax[t * 3 + a] = Math.max(p0, p1, p2);
    }
  }
  const ids = new Uint32Array(T); for (let t = 0; t < T; t++) ids[t] = t;
  const cap = 2 * T + 1;   // a binary tree over ≥ 1-triangle leaves never has more nodes
  const skip = new Uint32Array(cap), right = new Int32Array(cap).fill(-1), triStart = new Uint32Array(cap), triCount = new Uint32Array(cap), subtreeEnd = new Uint32Array(cap), depth = new Uint16Array(cap);
  let N = 0, maxDepth = 0, medianSplits = 0;
  const binCount = new Int32Array(BINS), binMin = new Float64Array(BINS * 3), binMax = new Float64Array(BINS * 3);
  const rightArea = new Float64Array(BINS), rightN = new Int32Array(BINS);
  const area = (mn: ArrayLike<number>, mx: ArrayLike<number>, o = 0) => { const dx = mx[o] - mn[o], dy = mx[o + 1] - mn[o + 1], dz = mx[o + 2] - mn[o + 2]; return dx < 0 ? 0 : 2 * (dx * dy + dy * dz + dz * dx); };

  const build = (start: number, end: number, d: number): number => {
    const node = N++; depth[node] = d; if (d > maxDepth) maxDepth = d;
    triStart[node] = start; subtreeEnd[node] = end;
    const count = end - start;
    if (count <= LEAF_MAX) { triCount[node] = count; skip[node] = N; return node; }
    // centroid bounds of the range
    const cmin = [Infinity, Infinity, Infinity], cmax = [-Infinity, -Infinity, -Infinity];
    for (let k = start; k < end; k++) { const t = ids[k]; for (let a = 0; a < 3; a++) { const c = cen[t * 3 + a]; if (c < cmin[a]) cmin[a] = c; if (c > cmax[a]) cmax[a] = c; } }
    let bestAxis = -1, bestBin = -1, bestCost = Infinity;
    if (d < MAX_DEPTH) {
      for (let axis = 0; axis < 3; axis++) {
        const ext = cmax[axis] - cmin[axis]; if (!(ext > 1e-9)) continue;
        const sc = BINS / ext;
        binCount.fill(0); binMin.fill(Infinity); binMax.fill(-Infinity);
        for (let k = start; k < end; k++) {
          const t = ids[k]; let b = Math.floor((cen[t * 3 + axis] - cmin[axis]) * sc); if (b >= BINS) b = BINS - 1; if (b < 0) b = 0;
          binCount[b]++;
          for (let a = 0; a < 3; a++) { if (bmin[t * 3 + a] < binMin[b * 3 + a]) binMin[b * 3 + a] = bmin[t * 3 + a]; if (bmax[t * 3 + a] > binMax[b * 3 + a]) binMax[b * 3 + a] = bmax[t * 3 + a]; }
        }
        // suffix sweep: bounds / counts of bins [i, BINS)
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; let n = 0;
        for (let i = BINS - 1; i > 0; i--) {
          n += binCount[i]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], binMin[i * 3 + a]); mx[a] = Math.max(mx[a], binMax[i * 3 + a]); }
          rightN[i] = n; rightArea[i] = n ? area(mn, mx) : 0;
        }
        // prefix sweep: split before bin i (left = [0, i), right = [i, BINS))
        mn[0] = mn[1] = mn[2] = Infinity; mx[0] = mx[1] = mx[2] = -Infinity; n = 0;
        for (let i = 1; i < BINS; i++) {
          n += binCount[i - 1]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], binMin[(i - 1) * 3 + a]); mx[a] = Math.max(mx[a], binMax[(i - 1) * 3 + a]); }
          if (n === 0 || rightN[i] === 0) continue;
          const cost = area(mn, mx) * n + rightArea[i] * rightN[i];
          if (cost < bestCost) { bestCost = cost; bestAxis = axis; bestBin = i; }
        }
      }
    }
    let mid: number;
    if (bestAxis >= 0) {
      // partition in place: centroid bin < bestBin goes left
      const ext = cmax[bestAxis] - cmin[bestAxis], sc = BINS / ext;
      let i = start, j = end - 1;
      while (i <= j) {
        const t = ids[i]; let b = Math.floor((cen[t * 3 + bestAxis] - cmin[bestAxis]) * sc); if (b >= BINS) b = BINS - 1; if (b < 0) b = 0;
        if (b < bestBin) i++; else { ids[i] = ids[j]; ids[j] = t; j--; }
      }
      mid = i;
      if (mid === start || mid === end) bestAxis = -1;   // (cannot happen with both counts > 0, but never recurse on an empty side)
    }
    if (bestAxis < 0) {
      // median split along the longest centroid axis (degenerate centroids, or the depth cap): always terminates, count halves
      medianSplits++;
      let axis = 0; if (cmax[1] - cmin[1] > cmax[axis] - cmin[axis]) axis = 1; if (cmax[2] - cmin[2] > cmax[axis] - cmin[axis]) axis = 2;
      const sub = Array.from(ids.subarray(start, end)).sort((p, q) => cen[p * 3 + axis] - cen[q * 3 + axis]);
      ids.set(sub, start);
      mid = (start + end) >> 1;
    }
    build(start, mid!, d + 1);              // left child = node + 1 by construction
    right[node] = build(mid!, end, d + 1);
    skip[node] = N;                         // everything under `node` has been numbered: the next number is the node after this subtree
    return node;
  };
  if (T > 0) build(0, T, 0);

  const corners = new Uint32Array(T * 3);
  for (let k = 0; k < T; k++) { const t = ids[k]; corners[k * 3] = indices[t * 3]; corners[k * 3 + 1] = indices[t * 3 + 1]; corners[k * 3 + 2] = indices[t * 3 + 2]; }
  // nodes by depth, deepest first (counting sort)
  const levels = maxDepth + 1; const levelOff = new Uint32Array(levels + 1); const levelNodes = new Uint32Array(N);
  for (let i = 0; i < N; i++) levelOff[(maxDepth - depth[i]) + 1]++;
  for (let L = 0; L < levels; L++) levelOff[L + 1] += levelOff[L];
  { const fill = new Uint32Array(levels); for (let i = 0; i < N; i++) { const L = maxDepth - depth[i]; levelNodes[levelOff[L] + fill[L]++] = i; } }
  let leaves = 0, maxLeaf = 0; for (let i = 0; i < N; i++) if (triCount[i] > 0) { leaves++; if (triCount[i] > maxLeaf) maxLeaf = triCount[i]; }
  return {
    numTris: T, numNodes: N, maxDepth, corners, triOrder: ids,
    skip: skip.slice(0, N), right: right.slice(0, N), triStart: triStart.slice(0, N), triCount: triCount.slice(0, N), subtreeEnd: subtreeEnd.slice(0, N), depth: depth.slice(0, N),
    levelNodes, levelOff,
    stats: { leaves, avgLeaf: leaves ? T / leaves : 0, maxLeaf, medianSplits },
  };
}

// ---------------------------------------------------------------- CPU references of the three GPU steps (skin corners → refit → any-hit walk)
// Layouts mirror the GPU buffer (meshShadows.ts): triangle corner (t, j) is 4 floats at ((t·3 + j)·4) — xyz + a pad — and node i is two
// float4s: (min.xyz, skip) and (max.xyz, triStart | triCount << 24), the integer words kept apart here as the MeshBvh arrays.

/** Skin every triangle corner with linear blend skinning exactly as gbuffer.wgsl's vsSkin / the GPU skin pass do: M = Σ wᵢ·J[jᵢ], p' = M·p.
 *  `jointData` = SkeletonInstance.jointData (column-major world skinning matrices); out = 4 floats per corner (w = 1). */
export function skinCorners(bvh: MeshBvh, positions: Float32Array, joints: Uint8Array | Uint16Array, weights: Float32Array, jointData: Float32Array, out?: Float32Array): Float32Array {
  const T = bvh.numTris; out ??= new Float32Array(T * 3 * 4);
  for (let c = 0; c < T * 3; c++) {
    const vi = bvh.corners[c];
    const px = positions[vi * 3], py = positions[vi * 3 + 1], pz = positions[vi * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[vi * 4 + k]; if (w === 0) continue;
      const m = joints[vi * 4 + k] * 16;
      x += w * (jointData[m] * px + jointData[m + 4] * py + jointData[m + 8] * pz + jointData[m + 12]);
      y += w * (jointData[m + 1] * px + jointData[m + 5] * py + jointData[m + 9] * pz + jointData[m + 13]);
      z += w * (jointData[m + 2] * px + jointData[m + 6] * py + jointData[m + 10] * pz + jointData[m + 14]);
    }
    out[c * 4] = x; out[c * 4 + 1] = y; out[c * 4 + 2] = z; out[c * 4 + 3] = 1;
  }
  return out;
}

/** The same blend per VERTEX (3 floats each) — for tools that want the posed mesh itself (e.g. to rebuild a tree at a pose for comparison). */
export function skinVertices(positions: Float32Array, joints: Uint8Array | Uint16Array, weights: Float32Array, jointData: Float32Array): Float32Array {
  const V = (positions.length / 3) | 0; const out = new Float32Array(V * 3);
  for (let vi = 0; vi < V; vi++) {
    const px = positions[vi * 3], py = positions[vi * 3 + 1], pz = positions[vi * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[vi * 4 + k]; if (w === 0) continue;
      const m = joints[vi * 4 + k] * 16;
      x += w * (jointData[m] * px + jointData[m + 4] * py + jointData[m + 8] * pz + jointData[m + 12]);
      y += w * (jointData[m + 1] * px + jointData[m + 5] * py + jointData[m + 9] * pz + jointData[m + 13]);
      z += w * (jointData[m + 2] * px + jointData[m + 6] * py + jointData[m + 10] * pz + jointData[m + 14]);
    }
    out[vi * 3] = x; out[vi * 3 + 1] = y; out[vi * 3 + 2] = z;
  }
  return out;
}

/** FNV-1a over the topology arrays: the offline harness and the running page (MeshShadows.digest) must print the same for the fixture to apply. */
export function topologyDigest(b: MeshBvh): string {
  let h = 0x811c9dc5 >>> 0;
  const feed = (arr: ArrayLike<number>) => { for (let i = 0; i < arr.length; i++) { let v = arr[i] >>> 0; for (let k = 0; k < 4; k++) { h ^= v & 255; h = Math.imul(h, 0x01000193) >>> 0; v >>>= 8; } } };
  feed(b.skip); feed(b.triStart); feed(b.triCount); feed(b.corners); feed(b.levelNodes);
  return h.toString(16).padStart(8, '0');
}

/** leaf boxes are grown by this much (m) so a hit lying exactly on a box face survives the slab test's rounding; parents inherit it */
export const LEAF_PAD = 1e-4;

/** Bottom-up refit in the GPU's order (deepest level first, each level in levelNodes order): leaves from their corners (+ LEAF_PAD), internal
 *  nodes as the union of their two children. nmin / nmax: 4 floats per node (w unused). */
export function refitLevels(bvh: MeshBvh, tv: Float32Array, nmin: Float32Array, nmax: Float32Array) {
  for (let L = 0; L <= bvh.maxDepth; L++) for (let q = bvh.levelOff[L]; q < bvh.levelOff[L + 1]; q++) refitNode(bvh, bvh.levelNodes[q], tv, nmin, nmax);
}
/** The same by plain reverse index sweep (children always carry larger indices than their parent in the depth-first numbering). */
export function refitReverse(bvh: MeshBvh, tv: Float32Array, nmin: Float32Array, nmax: Float32Array) {
  for (let i = bvh.numNodes - 1; i >= 0; i--) refitNode(bvh, i, tv, nmin, nmax);
}
function refitNode(bvh: MeshBvh, i: number, tv: Float32Array, nmin: Float32Array, nmax: Float32Array) {
  const o = i * 4;
  if (bvh.triCount[i] > 0) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let c = bvh.triStart[i] * 3, e = (bvh.triStart[i] + bvh.triCount[i]) * 3; c < e; c++) {
      const x = tv[c * 4], y = tv[c * 4 + 1], z = tv[c * 4 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    nmin[o] = Math.fround(x0 - LEAF_PAD); nmin[o + 1] = Math.fround(y0 - LEAF_PAD); nmin[o + 2] = Math.fround(z0 - LEAF_PAD);
    nmax[o] = Math.fround(x1 + LEAF_PAD); nmax[o + 1] = Math.fround(y1 + LEAF_PAD); nmax[o + 2] = Math.fround(z1 + LEAF_PAD);
  } else {
    const l = (i + 1) * 4, r = bvh.right[i] * 4;
    for (let a = 0; a < 3; a++) { nmin[o + a] = Math.min(nmin[l + a], nmin[r + a]); nmax[o + a] = Math.max(nmax[l + a], nmax[r + a]); }
  }
}
/** Box of node i straight from ALL corners under it (its contiguous triangle run) — what a rebuild would store; refit must equal it exactly. */
export function subtreeBox(bvh: MeshBvh, i: number, tv: Float32Array): { min: Vec3; max: Vec3 } {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let c = bvh.triStart[i] * 3, e = bvh.subtreeEnd[i] * 3; c < e; c++) {
    const x = tv[c * 4], y = tv[c * 4 + 1], z = tv[c * 4 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { min: [Math.fround(x0 - LEAF_PAD), Math.fround(y0 - LEAF_PAD), Math.fround(z0 - LEAF_PAD)], max: [Math.fround(x1 + LEAF_PAD), Math.fround(y1 + LEAF_PAD), Math.fround(z1 + LEAF_PAD)] };
}

// ---- ray tests: the same arithmetic, tolerances and visiting order as meshTri / meshAnyHitChar in common.wgsl ----
/** barycentric slack: triangles are this much 'fat' at their edges so a ray through a shared edge cannot slip between both neighbours */
export const EPS_UV = 1e-5;
/** hits nearer than this along the ray are ignored (the origin sits on some other surface, ≥ 1 cm off it; this only guards t ≈ 0 noise) */
export const MESH_TMIN = 1e-4;

/** Möller–Trumbore, no backface culling: t of the hit in (MESH_TMIN, tmax], or −1. Corner c0 = first of the triangle's three in `tv`. */
export function triHit(tv: Float32Array, c0: number, ro: Vec3, rd: Vec3, tmax: number): number {
  const o = c0 * 4;
  const ax = tv[o], ay = tv[o + 1], az = tv[o + 2];
  const e1x = tv[o + 4] - ax, e1y = tv[o + 5] - ay, e1z = tv[o + 6] - az;
  const e2x = tv[o + 8] - ax, e2y = tv[o + 9] - ay, e2z = tv[o + 10] - az;
  const px = rd[1] * e2z - rd[2] * e2y, py = rd[2] * e2x - rd[0] * e2z, pz = rd[0] * e2y - rd[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const sx = ro[0] - ax, sy = ro[1] - ay, sz = ro[2] - az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < -EPS_UV || u > 1 + EPS_UV) return -1;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (rd[0] * qx + rd[1] * qy + rd[2] * qz) * inv;
  if (v < -EPS_UV || u + v > 1 + EPS_UV) return -1;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > MESH_TMIN && t <= tmax ? t : -1;
}
/** slab test of [0, tmax] against node i's box */
function boxHit(nmin: Float32Array, nmax: Float32Array, i: number, ro: Vec3, inv: Vec3, tmax: number): boolean {
  const o = i * 4;
  let t0 = 0, t1 = tmax;
  for (let a = 0; a < 3; a++) {
    let ta = (nmin[o + a] - ro[a]) * inv[a], tb = (nmax[o + a] - ro[a]) * inv[a];
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
  }
  return t0 <= t1;
}
export const safeInv = (rd: Vec3): Vec3 => [Math.abs(rd[0]) < 1e-20 ? 1e20 : 1 / rd[0], Math.abs(rd[1]) < 1e-20 ? 1e20 : 1 / rd[1], Math.abs(rd[2]) < 1e-20 ? 1e20 : 1 / rd[2]];

/** Stackless any-hit walk (skip pointers): t of the FIRST triangle found blocking (MESH_TMIN, tmax] — not necessarily the nearest — or −1.
 *  `visits`, if given, gets the number of nodes touched added to visits[0] and triangles tested to visits[1]. */
export function bvhAnyHit(bvh: MeshBvh, nmin: Float32Array, nmax: Float32Array, tv: Float32Array, ro: Vec3, rd: Vec3, tmax: number, visits?: number[]): number {
  const inv = safeInv(rd); const N = bvh.numNodes;
  let i = 0;
  while (i < N) {
    if (visits) visits[0]++;
    if (!boxHit(nmin, nmax, i, ro, inv, tmax)) { i = bvh.skip[i]; continue; }
    const cnt = bvh.triCount[i];
    if (cnt === 0) { i++; continue; }
    for (let k = 0; k < cnt; k++) {
      if (visits) visits[1]++;
      const t = triHit(tv, (bvh.triStart[i] + k) * 3, ro, rd, tmax);
      if (t >= 0) return t;
    }
    i = bvh.skip[i];
  }
  return -1;
}
/** Every triangle, no tree: nearest blocking t in (MESH_TMIN, tmax] or −1 (the ground truth the walk is checked against). */
export function bruteNearest(bvh: MeshBvh, tv: Float32Array, ro: Vec3, rd: Vec3, tmax: number): number {
  let best = -1;
  for (let t = 0; t < bvh.numTris; t++) { const h = triHit(tv, t * 3, ro, rd, tmax); if (h >= 0 && (best < 0 || h < best)) best = h; }
  return best;
}
