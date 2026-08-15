// RAY-TRAVERSAL LAB kernels (exp/trace-perf — tools/qa/trace-lab.js compiles this behind the scene prelude, i.e. world consts + TRACE_VARIANT + common.wgsl,
// against the engine's scene bind group; NOT part of the bundle — the dev server serves it under /qa/shader/trace_lab.wgsl). Three jobs:
//   points   surface points the ray classes start from: the CURRENT camera's primary hits (exactly the g-buffer's distribution of receivers) or a level-wide
//            scatter (down rays onto floors / desks + level rays onto walls), traced with the reference walk → a rgba32float texture, 2 texels a point
//   bench    N threads × reps rays of ONE class through ONE query (occluded / occludedT / traceClosest — whichever variant TRACE_VARIANT selects, or the
//            'empty' query that only generates the ray) → a checksum per thread (nothing dead-code-eliminated); the pass is timestamped by the host
//   exact    the same rays through variant A and variant B of the query in the SAME thread → disagreement counters + the first few offending rays
//   prof     the reference walk with counters (cells visited, lists loaded, items fetched / culled / slab-tested, globals, capsules, where the answer came from)
// The variant selectors (occludedSel / occludedTSel / traceClosestSel) are appended by the host from its variant list, so this file never names a variant.

struct LabParams {
  mode: u32,      // 0 points-from-camera · 1 points-level-wide · 10 bench · 20 exact · 30 profile
  cls: u32,       // ray class (rayOf): 0 ao · 1 light · 2 sun/moon · 3 gather · 4 reflect · 5 random · 6 column · 7 panel
  nPoints: u32, nThreads: u32,
  seed: u32, reps: u32,
  fnSel: u32,     // query: 0 occluded · 1 occludedT · 2 traceClosest · 9 none (ray generation only)
  va: u32,        // exact: variant A
  vb: u32,        // exact: variant B
  ptsW: u32,      // points texture width in texels (2 texels per point per row-major index)
  coh: u32,       // lanes that trace the SAME ray (1 = every lane its own; 32 = a whole SIMD group in lockstep — the divergence probe)
  stride: u32,    // receiver stride: thread i starts from point (i / coh) * stride % nPoints (1 = neighbours share a neighbourhood, a big prime = scattered receivers)
};
@group(1) @binding(0) var<uniform> lab: LabParams;
@group(1) @binding(1) var ptsTex: texture_2d<f32>;                          // (bench / exact / prof) the points: texel 2i = (P.xyz, valid), 2i+1 = (N.xyz, kind)
@group(1) @binding(2) var<storage, read_write> outBuf: array<atomic<u32>>;   // [0, 64) counters · [64, 64 + 16·8) first offending rays (exact) · [256, 256 + nThreads) per-thread checksums
@group(1) @binding(3) var ptsOut: texture_storage_2d<rgba32float, write>;    // (points) — a separate texture object from ptsTex's (the host ping-pongs), bound in every mode so one layout serves all
@group(1) @binding(4) var labDepth: texture_depth_2d;                        // the engine's g-buffer (internal size): depth, packed normal, id — what fgather / restir read their receivers from
@group(1) @binding(5) var labNormal: texture_2d<f32>;
@group(1) @binding(6) var labId: texture_2d<u32>;

// ---- rng (pcg hash chain per thread) ----
var<private> lrs: u32;
fn lseed(a: u32, b: u32, c: u32) { lrs = (a * 0x9E3779B1u) ^ ((b + 0x7F4A7C15u) * 0x85EBCA77u) ^ ((c + 0x165667B1u) * 0xC2B2AE3Du); lrs = lrs ^ (lrs >> 16u); lrs *= 0x7FEB352Du; lrs ^= lrs >> 15u; }
fn lrnd() -> f32 { lrs = lrs * 747796405u + 2891336453u; var w = ((lrs >> ((lrs >> 28u) + 4u)) ^ lrs) * 277803737u; w = (w >> 22u) ^ w; return f32(w) * (1.0 / 4294967296.0); }
fn lcosineDir(N: vec3f) -> vec3f {
  let u = lrnd(); let v = lrnd(); let r = sqrt(u); let a = 6.2831853 * v;
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  return normalize(T * (r * cos(a)) + B * (r * sin(a)) + N * sqrt(max(1.0 - u, 0.0)));
}
fn lsphereDir() -> vec3f { let z = lrnd() * 2.0 - 1.0; let a = lrnd() * 6.2831853; let r = sqrt(max(1.0 - z * z, 0.0)); return vec3f(r * cos(a), z, r * sin(a)); }

// ---- points ----
fn ptStore(i: u32, P: vec3f, valid: f32, N: vec3f, kind: f32) {
  let x = (i * 2u) % lab.ptsW; let y = (i * 2u) / lab.ptsW;
  textureStore(ptsOut, vec2u(x, y), vec4f(P, valid));
  textureStore(ptsOut, vec2u(x + 1u, y), vec4f(N, kind));
}
struct LabPt { P: vec3f, N: vec3f, valid: bool, owner: u32 };
fn ptLoad(i: u32) -> LabPt {
  let x = (i * 2u) % lab.ptsW; let y = (i * 2u) / lab.ptsW;
  let a = textureLoad(ptsTex, vec2u(x, y), 0); let b = textureLoad(ptsTex, vec2u(x + 1u, y), 0);
  var p: LabPt; p.P = a.xyz; p.N = b.xyz; p.valid = a.w > 0.5; p.owner = u32(b.w / 4.0); return p;
}
fn pointsCamera(i: u32) {
  // THE g-buffer's receivers: a stratified pixel lattice over the internal frame (point i → one pixel of a cols × rows lattice, hash-jittered inside its cell), the pixel's depth /
  // normal / owner read exactly as fgather.wgsl reads them. Sky pixels are invalid points. kind: 1 = a box surface, 2 = a character's skin (owner byte ≠ 0), + owner × 4.
  let n = lab.nPoints; let W = frame.screen.x; let H = frame.screen.y;
  let cols = u32(ceil(sqrt(f32(n) * W / H))); let rows = (n + cols - 1u) / cols;
  lseed(i, lab.seed, 11u);
  let cx = f32(i % cols) + lrnd(); let cy = f32(i / cols) + lrnd();
  let px = min(vec2u(u32(cx / f32(cols) * W), u32(cy / f32(rows) * H)), vec2u(frame.screen) - 1u);
  let depth = textureLoad(labDepth, px, 0);
  var P = vec3f(0.0); var N = vec3f(0.0, 1.0, 0.0); var ok = 0.0; var kind = 0.0;
  if (depth < 1.0) {
    P = worldFromDepth(vec2f(px) + 0.5, depth);
    N = normalize(textureLoad(labNormal, px, 0).xyz * 2.0 - 1.0);
    let id = textureLoad(labId, px, 0).x; let owner = (id >> 20u) & 0xffu;
    ok = 1.0; kind = select(1.0, 2.0, ((id >> 28u) & 1u) != 0u) + f32(owner) * 4.0;
  }
  ptStore(i, P, ok, N, kind);
}
fn pointsLevel(i: u32) {
  lseed(i, lab.seed, 12u);
  var ro: vec3f; var rd: vec3f; var tmax: f32;
  if ((i & 1u) == 0u) {   // down onto floors / furniture tops from just under the ceiling (indoors) or from 6 m (the lot): a slight tilt so vertical faces get a few too
    let x = 0.5 + lrnd() * 39.0; let z = 0.5 + lrnd() * 27.0;
    let indoors = x > 4.0 && x < 36.0 && z > 4.0 && z < 24.0;
    ro = vec3f(x, select(6.0, 2.9, indoors), z);
    rd = normalize(vec3f((lrnd() - 0.5) * 0.3, -1.0, (lrnd() - 0.5) * 0.3)); tmax = 12.0;
  } else {                // level rays from body height onto walls / cabinets / partitions
    ro = vec3f(0.5 + lrnd() * 39.0, 0.15 + lrnd() * 2.5, 0.5 + lrnd() * 27.0);
    let a = lrnd() * 6.2831853; rd = normalize(vec3f(cos(a), (lrnd() - 0.5) * 0.4, sin(a))); tmax = 60.0;
  }
  let hit = traceClosestSel(0u, ro, rd, tmax, 0u);
  var P = vec3f(0.0); var N = vec3f(0.0, 1.0, 0.0); var ok = 0.0; var kind = 0.0;
  if (hit.idx >= 0 && !hit.inside) { P = ro + rd * hit.t; N = hit.n; ok = 1.0; kind = select(1.0, 2.0, hit.idx == CAPSULE_HIT); }
  ptStore(i, P, ok, N, kind);
}

// ---- ray classes ----
struct LabRay { ro: vec3f, rd: vec3f, tmax: f32, skip: u32, ok: bool };
fn firstDirectional() -> i32 { for (var i = 0u; i < frame.numLights; i++) { if (lightKind(lights[i]) == 2u && !lightTransient(lights[i])) { return i32(i); } } return -1; }
// a light picked the way a bounce point picks one (∝ unshadowed luminance among a few random slots; `panelOnly` keeps kind 3), aimed at a point on its disk as shadowSample does
fn lightRay(P: vec3f, N: vec3f, panelOnly: bool) -> LabRay {
  var r: LabRay; r.ok = false; r.skip = 0u;
  let nl = frame.numLights; if (nl == 0u) { return r; }
  var W = 0.0; var pick = -1; var pL = vec3f(0.0); var pDist = 0.0;
  for (var k = 0u; k < 8u; k++) {
    let j = min(u32(lrnd() * f32(nl)), nl - 1u);
    let li = lights[j];
    if (lightTransient(li) || lightKind(li) == 2u) { continue; }
    if (panelOnly && lightKind(li) != 3u) { continue; }
    if (!lightReaches(j, P)) { continue; }
    let ev = evalLight(li, P, N);
    if (!ev.ok) { continue; }
    let w = luminance(ev.E); if (w < 1e-4) { continue; }
    W += w;
    if (lrnd() * W < w) { pick = i32(j); }
  }
  if (pick < 0) { return r; }
  let li = lights[u32(pick)];
  let ur = lrnd(); let ua = lrnd(); let rr = sqrt(ur) * li.radius; let a = ua * 6.2831853;
  let toC = li.pos - P; let dc = length(toC); let Lc = toC / dc;
  let axis = select(Lc, li.dir, lightKind(li) != 0u);
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(axis.y) > 0.9);
  let T = normalize(cross(up, axis)); let B = cross(axis, T);
  let d = (li.pos + T * (cos(a) * rr) + B * (sin(a) * rr)) - P;
  let dist = length(d);
  r.rd = d / dist; r.tmax = dist - 0.03; r.ro = P + N * 0.01; r.skip = (li.owner & 0xffu) << 8u; r.ok = dot(r.rd, N) > 0.0 && r.tmax > 0.0;
  return r;
}
fn rayOf(cls: u32, pt: LabPt, tid: u32, rep: u32) -> LabRay {
  var r: LabRay; r.ok = pt.valid; r.skip = 0u;
  let Po = pt.P + pt.N * 0.02;
  switch (cls) {
    case 0u: { r.ro = Po; r.rd = lcosineDir(pt.N); r.tmax = 0.3 + 1.7 * lrnd(); }                                    // AO-like short hemisphere ray
    case 1u: { let L = lightRay(pt.P, pt.N, false); r = L; r.ok = L.ok && pt.valid; }                              // shadow ray to a picked light
    case 7u: { let L = lightRay(pt.P, pt.N, true); r = L; r.ok = L.ok && pt.valid; }                               // … to a ceiling panel only
    case 8u: { let keep = lrs; lseed(tid / 32u, lab.seed + rep * 7919u, 8u); let L = lightRay(pt.P, pt.N, false); lrs = keep; r = L; r.ok = L.ok && pt.valid; }   // 'lightC': the light PICK (and disk point) drawn from one rng stream per 32 lanes — a SIMD group shoots at the same light, as a tile of the direct pass mostly does
    case 2u: {                                                                                                     // the sun / the moon: long directional shadow ray off a small disk
      let di = firstDirectional();
      if (di < 0) { r.ok = false; r.ro = Po; r.rd = vec3f(0.0, 1.0, 0.0); r.tmax = 1.0; }
      else { let li = lights[u32(di)]; let L = -li.dir; let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9); let T = normalize(cross(up, L)); let B = cross(L, T);
        let rr = sqrt(lrnd()) * li.radius; let a = lrnd() * 6.2831853; r.rd = normalize(L + (T * cos(a) + B * sin(a)) * rr); r.ro = pt.P + pt.N * 0.01; r.tmax = 80.0; r.ok = pt.valid && dot(r.rd, pt.N) > 0.0; }
    }
    case 3u: { r.ro = Po; r.rd = lcosineDir(pt.N); r.tmax = 40.0; }                                                // final-gather ray
    case 9u: {                                                                                                     // 'gatherB': the gather ray with its AZIMUTH BINNED per 32 lanes (a SIMD group draws from one 1/8 sector) — the coherence a per-tile direction sort could buy
      let sector = f32((tid / 32u + lab.seed + rep * 5u) % 8u);
      let u = lrnd(); let v = (sector + lrnd()) / 8.0; let rr = sqrt(u); let a = 6.2831853 * v;
      let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(pt.N.y) > 0.9);
      let T = normalize(cross(up, pt.N)); let B = cross(pt.N, T);
      r.ro = Po; r.rd = normalize(T * (rr * cos(a)) + B * (rr * sin(a)) + pt.N * sqrt(max(1.0 - u, 0.0))); r.tmax = 40.0;
    }
    case 11u, 12u: {                                                                                               // 4-strata schemes a 4-ray gather could adopt per frame: 11 = azimuth quadrant per 32 lanes; 12 = azimuth half × cosθ half
      let g = tid / 32u + lab.seed + rep * 5u;
      var u = lrnd(); var v = lrnd();
      if (cls == 11u) { v = (f32(g % 4u) + v) / 4.0; } else { v = (f32(g % 2u) + v) / 2.0; u = (f32((g / 2u) % 2u) + u) / 2.0; }
      let rr = sqrt(u); let a = 6.2831853 * v;
      let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(pt.N.y) > 0.9);
      let T = normalize(cross(up, pt.N)); let B = cross(pt.N, T);
      r.ro = Po; r.rd = normalize(T * (rr * cos(a)) + B * (rr * sin(a)) + pt.N * sqrt(max(1.0 - u, 0.0))); r.tmax = 40.0;
    }
    case 10u: {                                                                                                    // 'gatherB2': azimuth binned to 1/8 AND cos-theta binned to 1/4 per 32 lanes (32 direction cells)
      let g = tid / 32u + lab.seed + rep * 5u; let sector = f32(g % 8u); let band = f32((g / 8u) % 4u);
      let u = (band + lrnd()) / 4.0; let v = (sector + lrnd()) / 8.0; let rr = sqrt(u); let a = 6.2831853 * v;
      let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(pt.N.y) > 0.9);
      let T = normalize(cross(up, pt.N)); let B = cross(pt.N, T);
      r.ro = Po; r.rd = normalize(T * (rr * cos(a)) + B * (rr * sin(a)) + pt.N * sqrt(max(1.0 - u, 0.0))); r.tmax = 40.0;
    }
    case 4u: {                                                                                                     // reflection ray: mirror of the eye direction about N, a little GGX-ish spread
      let V = normalize(pt.P - frame.camPos); var R = reflect(V, pt.N);
      let j = lcosineDir(R); R = normalize(mix(R, j, 0.08)); if (dot(R, pt.N) < 0.02) { R = normalize(R + pt.N * 0.1); }
      r.ro = Po; r.rd = R; r.tmax = 48.0;
    }
    case 5u: { r.ro = vec3f(0.5 + lrnd() * 39.0, 0.1 + lrnd() * 2.8, 0.5 + lrnd() * 27.0); r.rd = lsphereDir(); r.tmax = 30.0; r.ok = true; }   // incoherent: anywhere in the air, any direction (an origin inside a box answers 'inside' — part of the mix)
    case 6u: { r.ro = pt.P + vec3f(0.0, 0.02, 0.0); r.rd = vec3f(0.0, 1.0, 0.0); r.tmax = max(CEIL_Y + 0.5 - r.ro.y, 0.05); }              // the column to the ceiling (the volumetric roof test; panel lights overhead are class 7)
    default: { r.ok = false; r.ro = Po; r.rd = pt.N; r.tmax = 1.0; }
  }
  if (cls != 5u) { r.skip = r.skip | (pt.owner & 0xffu); }   // a receiver on a character's skin ignores his own proxies (fgather / restir pass the g-buffer's owner byte the same way)
  return r;
}

// ---- outputs ----
const C_DIS_BOOL: u32 = 8u;    // exact: any-hit boolean disagreements (occluded, occludedT sign, traceClosest hit/miss)
const C_DIS_T: u32 = 9u;       // exact: |tA − tB| > 1e-4 (occludedT / traceClosest, both hit)
const C_DIS_IDX: u32 = 10u;    // exact: traceClosest box index differs (both hit)
const C_DIS_N: u32 = 11u;      // exact: traceClosest normal differs (both hit, same idx)
const C_DIS_TSMALL: u32 = 12u; // exact: 0 < |tA − tB| ≤ 1e-4 (informational: last-bit differences)
const C_MAXDT: u32 = 13u;      // exact: max |tA − tB| over agreeing-idx hits, as f32 bits (atomicMax on the bit pattern is monotonic for non-negative floats)
const C_LOGN: u32 = 14u;       // exact: offending rays logged so far (≤ 16)
const LOG_BASE: u32 = 64u;     // 8 words each: ro.xyz, tmax, rd.xyz, (a/b packed as f16 pair or flags)
const SUM_BASE: u32 = 256u;

fn logRay(r: LabRay, a: f32, b: f32) {
  let k = atomicAdd(&outBuf[C_LOGN], 1u);
  if (k >= 16u) { return; }
  let o = LOG_BASE + k * 8u;
  atomicStore(&outBuf[o], bitcast<u32>(r.ro.x)); atomicStore(&outBuf[o + 1u], bitcast<u32>(r.ro.y)); atomicStore(&outBuf[o + 2u], bitcast<u32>(r.ro.z)); atomicStore(&outBuf[o + 3u], bitcast<u32>(r.tmax));
  atomicStore(&outBuf[o + 4u], bitcast<u32>(r.rd.x)); atomicStore(&outBuf[o + 5u], bitcast<u32>(r.rd.y)); atomicStore(&outBuf[o + 6u], bitcast<u32>(r.rd.z)); atomicStore(&outBuf[o + 7u], pack2x16float(vec2f(a, b)));
}

// ---- profile: the reference any-hit / closest walks with counters (statement for statement occluded / traceClosest of common.wgsl — keep them in step — with the proxy loops inlined, + tallies) ----
const P_GLOB_TEST: u32 = 16u; const P_GLOB_SKIP: u32 = 17u; const P_CELLS: u32 = 18u; const P_CELL_RUNSKIP: u32 = 19u; const P_CELL_MASKREJ: u32 = 20u; const P_CELL_LIST: u32 = 21u;
const P_ITEMS: u32 = 22u; const P_ITEM_YCULL: u32 = 23u; const P_ITEM_OWNER: u32 = 24u; const P_SLAB: u32 = 25u; const P_SLAB_HIT: u32 = 26u; const P_CAP_SPHERE: u32 = 27u; const P_CAP_TEST: u32 = 28u;
const P_ANS_GLOBAL: u32 = 29u; const P_ANS_GRID: u32 = 30u; const P_ANS_CAPS: u32 = 31u; const P_ANS_MISS: u32 = 32u; const P_CELL_EMPTYLIST: u32 = 33u; const P_SLAB_ROT: u32 = 34u; const P_SLAB_YAW: u32 = 35u; const P_EXIT_ITER_SUM: u32 = 36u;
var<private> pc: array<u32, 24>;
fn pcz() { for (var i = 0u; i < 24u; i++) { pc[i] = 0u; } }
fn pcflush() { for (var i = 0u; i < 21u; i++) { if (pc[i] != 0u) { atomicAdd(&outBuf[16u + i], pc[i]); } } }
fn P_(k: u32) { pc[k - 16u] += 1u; }

fn gridCellProf(ci: u32, ya: f32, yb: f32, run: ptr<function, u32>, gskip: bool, ycull: bool, shrink: f32) -> CellWalk {
  var w: CellWalk; w.start = 0u; w.end = 0u; w.qlo = 0u; w.qhi = 255u;
  P_(P_CELLS);
  if (*run > 0u) { *run = *run - 1u; P_(P_CELL_RUNSKIP); return w; }
  let w0 = gridCells[GRID_CB + 2u * ci];
  let dist = select(0u, w0 >> 24u, gskip);
  if (dist > 0u) { *run = dist - 1u; P_(P_CELL_RUNSKIP); return w; }
  var m = 0xffffffu; var need = 1u;
  if (ycull) { w.qlo = gridYq(min(ya, yb) + shrink); w.qhi = gridYq(max(ya, yb) - shrink); m = gridSliceMask(min(w.qlo, w.qhi), max(w.qlo, w.qhi)); need = select(1u, m, w.qlo > w.qhi); }
  if ((w0 & m) < need) { P_(P_CELL_MASKREJ); return w; }
  let w1 = gridCells[GRID_CB + 2u * ci + 1u];
  w.start = w1 & 0xffffffu;
  let n = w1 >> 24u;
  if (n == 255u) { w.end = gridCells[ci + 1u]; } else { w.end = w.start + n; }
  P_(P_CELL_LIST); if (w.end <= w.start) { P_(P_CELL_EMPTYLIST); }
  return w;
}
fn occludedProf(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> bool {
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { P_(P_ANS_MISS); return false; }
  let tmax = min(tmaxIn, tb.y);
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yEnd = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yEnd, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { P_(P_GLOB_SKIP); continue; }
    P_(P_GLOB_TEST);
    let bi = scene.globals[g >> 2u][g & 3u];
    let r = isectBox(ro, rd, boxGeo[bi], tmax, bi, invRd, axisFast);
    if (r.x >= 0.0) { P_(P_ANS_GLOBAL); return true; }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  var iters = 0u;
  for (var iter = 0; iter < 96; iter++) {
    iters++;
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCellProf(ci, ro.y + rd.y * max(tCell - tBack, t0), yEnd, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    for (var k = cw.start; k < cw.end; k++) {
      P_(P_ITEMS);
      let gi = gridItem(k, cw, ycull); if (gi < 0) { P_(P_ITEM_YCULL); continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { P_(P_ITEM_OWNER); continue; }
      P_(P_SLAB); if ((b.flags & BOX_ROT) != 0u) { P_(P_SLAB_ROT); } else if (b.rot != ROT_IDENTITY) { P_(P_SLAB_YAW); }
      let r = isectBox(ro, rd, b, tmax, bi, invRd, axisFast);
      if (r.x >= 0.0) { P_(P_SLAB_HIT); P_(P_ANS_GRID); pc[P_EXIT_ITER_SUM - 16u] += iters; return true; }
    }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  pc[P_EXIT_ITER_SUM - 16u] += iters;
  if (scene.numCapsules > 0u) {
    for (var ch = 0u; ch < scene.numChars; ch++) {
      P_(P_CAP_SPHERE);
      let bs = scene.charBounds[ch];
      if (!raySphere(ro, rd, bs.xyz, bs.w, tmax)) { continue; }
      let first = ch * scene.capsPerChar; let last = min(first + scene.capsPerChar, scene.numCapsules);
      for (var i = first; i < last; i++) {
        let cp = capsules[i];
        if (skipsOwner(capsuleOwner(cp), skipOwner)) { break; }
        P_(P_CAP_TEST);
        let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp));   // (the round-cone proxies, as common.wgsl's loops test them since the SDF character rig)
        if (t >= 0.0 && t < tmax) { P_(P_ANS_CAPS); return true; }
      }
    }
  }
  P_(P_ANS_MISS);
  return false;
}

// the reference CLOSEST walk with the same counters (mode 31): how far a gather / reflection ray walks past its first candidate
fn traceClosestProf(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> Hit {
  var hit: Hit; hit.t = tmaxIn; hit.idx = -1; hit.inside = false; hit.n = vec3f(0.0, 1.0, 0.0);
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { P_(P_ANS_MISS); return hit; }
  var tmax = min(tmaxIn, tb.y);
  hit.t = tmax;
  var code = 0.0; var found = false; var ansG = false;
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yFar = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yFar, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { P_(P_GLOB_SKIP); continue; }
    P_(P_GLOB_TEST);
    let bi = scene.globals[g >> 2u][g & 3u];
    let b = boxGeo[bi];
    let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
    if (r.x >= 0.0 && r.x < hit.t) { hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; ansG = true; }
  }
  var run = 0u; var iters = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0; var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    if (tCell > hit.t) { break; }
    iters++;
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCellProf(ci, ro.y + rd.y * max(tCell - tBack, t0), ro.y + rd.y * hit.t, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    for (var k = cw.start; k < cw.end; k++) {
      P_(P_ITEMS);
      let gi = gridItem(k, cw, ycull); if (gi < 0) { P_(P_ITEM_YCULL); continue; }
      let bi = u32(gi); let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { P_(P_ITEM_OWNER); continue; }
      P_(P_SLAB); if ((b.flags & BOX_ROT) != 0u) { P_(P_SLAB_ROT); } else if (b.rot != ROT_IDENTITY) { P_(P_SLAB_YAW); }
      let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
      if (r.x >= 0.0 && r.x < hit.t) { P_(P_SLAB_HIT); hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; ansG = false; }
    }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  pc[P_EXIT_ITER_SUM - 16u] += iters;
  if (found) { if (code > 6.5) { hit.inside = true; hit.n = -rd; } else { hit.n = boxNormalFromCode(boxGeo[u32(hit.idx)], code, u32(hit.idx)); } } else { hit.idx = -1; hit.t = tmaxIn; }
  var ansC = false;
  if (scene.numCapsules > 0u) {
    for (var ch = 0u; ch < scene.numChars; ch++) {
      P_(P_CAP_SPHERE);
      let bs = scene.charBounds[ch];
      if (!raySphere(ro, rd, bs.xyz, bs.w, hit.t)) { continue; }
      let first = ch * scene.capsPerChar; let last = min(first + scene.capsPerChar, scene.numCapsules);
      for (var i = first; i < last; i++) {
        let cp = capsules[i];
        if (skipsOwner(capsuleOwner(cp), skipOwner)) { break; }
        P_(P_CAP_TEST);
        let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp));   // (the round-cone proxies, as common.wgsl's loops test them since the SDF character rig)
        if (t >= 0.0 && t < hit.t) { hit.t = t; hit.idx = CAPSULE_HIT; ansC = true; }
      }
    }
  }
  if (hit.idx < 0) { P_(P_ANS_MISS); } else if (ansC) { P_(P_ANS_CAPS); } else if (ansG) { P_(P_ANS_GLOBAL); } else { P_(P_ANS_GRID); }
  return hit;
}

// ---- entry ----
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (lab.mode == 0u) { if (i < lab.nPoints) { pointsCamera(i); } return; }
  if (lab.mode == 1u) { if (i < lab.nPoints) { pointsLevel(i); } return; }
  if (i >= lab.nThreads) { return; }
  let ri = (i / max(lab.coh, 1u)) * max(lab.stride, 1u);   // the ray identity: `coh` consecutive lanes share it; `stride` scatters the receivers
  let pt = ptLoad(ri % lab.nPoints);
  var sum = 0u; var nOk = 0u; var nHit = 0u;
  if (lab.mode == 30u || lab.mode == 31u) { pcz(); }
  for (var rep = 0u; rep < lab.reps; rep++) {
    lseed(ri, lab.seed + rep * 7919u, lab.cls);
    let r = rayOf(lab.cls, pt, ri, rep);
    if (!r.ok) { continue; }
    nOk++;
    if (lab.mode == 10u) {          // bench: ONE query of the compiled variant
      switch (lab.fnSel) {
        case 0u: { if (occludedSel(TRACE_VARIANT, r.ro, r.rd, r.tmax, r.skip)) { nHit++; sum += 3u; } }
        case 1u: { let t = occludedTSel(TRACE_VARIANT, r.ro, r.rd, r.tmax, r.skip); if (t >= 0.0) { nHit++; sum += bitcast<u32>(t) >> 8u; } }
        case 2u: { let h = traceClosestSel(TRACE_VARIANT, r.ro, r.rd, r.tmax, r.skip); if (h.idx >= 0) { nHit++; sum += u32(h.idx) + (bitcast<u32>(h.t) >> 8u) + u32(h.n.x * 3.0 + h.n.y * 5.0 + 9.0); } }
        default: { sum += bitcast<u32>(r.rd.x + r.tmax) >> 4u; }
      }
    } else if (lab.mode == 20u) {   // exact: A vs B in the same thread
      switch (lab.fnSel) {
        case 0u: {
          let a = occludedSel(lab.va, r.ro, r.rd, r.tmax, r.skip); let b = occludedSel(lab.vb, r.ro, r.rd, r.tmax, r.skip);
          if (a != b) { atomicAdd(&outBuf[C_DIS_BOOL], 1u); logRay(r, select(0.0, 1.0, a), select(0.0, 1.0, b)); }
          if (a) { nHit++; }
        }
        case 1u: {
          let a = occludedTSel(lab.va, r.ro, r.rd, r.tmax, r.skip); let b = occludedTSel(lab.vb, r.ro, r.rd, r.tmax, r.skip);
          if ((a < 0.0) != (b < 0.0)) { atomicAdd(&outBuf[C_DIS_BOOL], 1u); logRay(r, a, b); }
          else if (a >= 0.0) { nHit++; let d = abs(a - b); if (d > 1e-4) { atomicAdd(&outBuf[C_DIS_T], 1u); logRay(r, a, b); } else if (d > 0.0) { atomicAdd(&outBuf[C_DIS_TSMALL], 1u); } atomicMax(&outBuf[C_MAXDT], bitcast<u32>(d)); }
        }
        case 2u: {
          let a = traceClosestSel(lab.va, r.ro, r.rd, r.tmax, r.skip); let b = traceClosestSel(lab.vb, r.ro, r.rd, r.tmax, r.skip);
          if ((a.idx < 0) != (b.idx < 0)) { atomicAdd(&outBuf[C_DIS_BOOL], 1u); logRay(r, f32(a.idx), f32(b.idx)); }
          else if (a.idx >= 0) {
            nHit++;
            if (a.idx != b.idx || a.inside != b.inside) { atomicAdd(&outBuf[C_DIS_IDX], 1u); logRay(r, a.t, b.t); }
            else { let d = abs(a.t - b.t); if (d > 1e-4) { atomicAdd(&outBuf[C_DIS_T], 1u); logRay(r, a.t, b.t); } else if (d > 0.0) { atomicAdd(&outBuf[C_DIS_TSMALL], 1u); } atomicMax(&outBuf[C_MAXDT], bitcast<u32>(d));
              if (any(abs(a.n - b.n) > vec3f(1e-4)) || (a.idx == CAPSULE_HIT && any(abs(a.capAlbedo - b.capAlbedo) > vec3f(1e-4)))) { atomicAdd(&outBuf[C_DIS_N], 1u); logRay(r, a.t, b.t); } }
          }
        }
        default: { }
      }
    } else if (lab.mode == 30u) {   // profile (any-hit)
      if (occludedProf(r.ro, r.rd, r.tmax, r.skip)) { nHit++; }
    } else if (lab.mode == 31u) {   // profile (closest)
      let h = traceClosestProf(r.ro, r.rd, r.tmax, r.skip); if (h.idx >= 0) { nHit++; sum += u32(h.t * 16.0); }
    }
  }
  if (lab.mode == 30u || lab.mode == 31u) { pcflush(); }
  // per-thread word (no shared atomics inside the timed pass): rays ok << 24 | hits << 16 | checksum — the host sums them (reps ≤ 255)
  atomicStore(&outBuf[SUM_BASE + i], (min(nOk, 255u) << 24u) | (min(nHit, 255u) << 16u) | (sum & 0xffffu));
}
