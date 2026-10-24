// The smoke solver: an Eulerian step — semi-Lagrangian velocity, confinement, red/black SOR pressure, MacCormack scalars — on ONE world-wide virtual lattice per voxel size (until
// 2026-10 the same step ran in eight 64³ boxes placed round the sources; git history has them). The lattice is cut into BRICKS of 8³ cells; a brick exists (has a slot in the pool) only while smoke is
// in it or next to it. A page table (brick coordinate → slot) says which exist. Nothing here knows about plumes, domains or how many sources there are: one chain of dispatches a
// step runs over the list of live bricks, whatever they belong to, so the cost follows the VOLUME of smoke and the only ceiling is the pool (CAP bricks), which fails soft.
//
// Prepended by smoke.ts: the world consts (GRID_CELL), CAP (pool slots), N0 (level 0 page entries), NPAGE (all levels), NTILES, wind_field.wgsl + wind_force.wgsl.
//
// LEVELS: 0 = the coarse lattice (canisters, dust), 1 = the fine one (gun gas). Same pool, same kernels; a brick carries its level. The two do not exchange anything: readers add them up.

const NONE: u32 = 0xffffffffu;
const LOCK: u32 = 0xfffffffeu;
const MAX_EM: u32 = 64u;

struct Emitter {
  pos: vec3f, radius: f32,        // WORLD metres
  dir: vec3f, speed: f32,
  density: f32, temperature: f32, level: u32, mode: f32,
  push: f32, expand: f32, kind: u32, epad1: f32,                  // kind: WHAT it raises, as a cell's K word below (0 = canister smoke)
};
struct Level { dims: vec3u, pageBase: u32, voxel: f32, texY: u32, tile: u32, tileBase: u32 };   // dims in bricks; texY = this level's first row in the readers' page texture; tile = bricks per bounding tile edge (boxes)
struct SP {
  numEmitters: u32, numExpand: u32, stepNo: u32, keep: u32,       // keep: steps a brick nothing needs is held before its slot is freed
  dt: f32, time: f32, buoyancy: f32, weight: f32,
  vortConf: f32, velDamp: f32, densDecay: f32, tempDecay: f32,
  turbulence: f32, omega: f32, flushEps: f32, ring: u32,          // ring: CELLS of air kept round the smoke (1‥8; 8 = every brick that holds smoke has all 26 neighbours)
  windX: f32, windZ: f32, numDirty: u32, bakeAll: u32,
  softLo: f32, softHi: f32, softEps: f32, softDecay: f32,         // the pool's soft ceiling: between softLo and softHi of CAP in use the flush threshold rises to softEps and thin smoke decays softDecay/s faster
  thinDecay: f32, thinBelow: f32, readSkip: f32, fresh: f32,       // density under thinBelow decays up to thinDecay/s faster, always (0 = off): how far a plume's faint skirt spreads before it is gone · fresh: WHO GIVES WAY below
  viewX: f32, viewZ: f32, viewR: f32, viewBias: f32,              // where the camera looks (floor plan) and how far round it counts as seen: past viewR, rising to full at 2 viewR, the pool's ceiling comes sooner and harder (farOf); bias 0 = one ceiling for all
  calmCells: f32, farCells: f32, calmMax: u32, dtCap: f32,        // WHO STEPS (buildList): cells a brick's fastest air may cross between two of its steps, in sight / out of sight; the longest wait in frames (1 = every brick every frame, 2, 4); the most time one step integrates
  scaleCan: f32, scaleFx: f32, fineDecay: f32, fineShare: f32,    // the render density × of canister smoke / of everything else (publish) · THE FINE LATTICE LETS GO below
  fineEps: f32, fineHeat: f32, fineRing: u32, fineKeep: f32,     // … and fineKeep: gas hotter than this on the fine lattice is not let go (0 = none kept, as first built)
  levels: array<Level, 2>,
  dirty: array<vec4f, 16>,                                        // ≤ 8 boxes (lo, hi) whose obstacles changed since the last step
  windBound: array<vec4f, 8>,                                     // per wind source: bounding sphere (w < 0 = the storm: everywhere)
  emitters: array<Emitter, 64>,
};
@group(0) @binding(0) var<uniform> sp: SP;

// ---- the pool
@group(1) @binding(0) var<storage, read_write> A: array<atomic<u32>>;   // counters · free list · stamps · wake stamps · fine-over-coarse stamps · page table
@group(1) @binding(1) var<storage, read_write> M: array<u32>;           // header · live list · this step's list · per-slot records
@group(1) @binding(2) var<storage, read_write> V: array<vec2u>;         // vel0 · vel1 · curl: 4 × f16 a cell
@group(1) @binding(3) var<storage, read_write> S: array<u32>;           // dens0 · dens1 (density, temperature as 2 × f16) · obstacle bytes · what kind of smoke (WHAT IS IN A CELL)
@group(1) @binding(4) var<storage, read_write> P: array<f32>;           // pressure · divergence

const C_FREE: u32 = 0u; const C_LIVE: u32 = 1u; const C_FAIL: u32 = 2u; const C_SCALAR: u32 = 3u; const C_RENDER: u32 = 4u; const C_VMAX: u32 = 5u; const C_ALLOC: u32 = 6u; const C_FREED: u32 = 7u; const C_BAKED: u32 = 8u; const C_FINE: u32 = 9u;
const C_ACT: u32 = 10u; const C_STEP: u32 = 11u; const C_WORK: u32 = 12u; const C_TINT: u32 = 13u; const C_LVL1: u32 = 14u; const C_HELD: u32 = 15u;   // C_WORK: brick-steps since the pool was reset (never zeroed by a step: the tools' measure of work done)
const A_FREE: u32 = 32u;
const A_STAMP: u32 = A_FREE + CAP;
const A_WAKE: u32 = A_STAMP + CAP;    // the step a source last reached this brick (markEmit)
const A_FINE: u32 = A_WAKE + CAP;
const A_PAGE: u32 = A_FINE + N0;

const M_COUNT: u32 = 0u; const M_EPS: u32 = 1u; const M_DECAY: u32 = 2u; const M_USED: u32 = 3u; const M_NSTEP: u32 = 4u; const M_THIN: u32 = 5u; const M_TIGHT: u32 = 6u; const M_KEEP: u32 = 7u; const M_FINE: u32 = 8u;
const M_LIST: u32 = 16u;              // every live brick
const M_STEP: u32 = M_LIST + CAP;     // the ones that step this frame (buildList)
const M_META: u32 = M_STEP + CAP;
const MS: u32 = 40u;
const K_COORD: u32 = 0u; const K_FLAGS: u32 = 1u; const K_VMAX: u32 = 2u; const K_EM0: u32 = 3u; const K_EM1: u32 = 4u; const K_WIND: u32 = 5u; const K_BOX: u32 = 6u; const K_OPEN: u32 = 7u; const K_NBR: u32 = 8u;
const K_ACC: u32 = 35u; const K_DT: u32 = 36u; const K_PER: u32 = 37u;   // time owed since its last step · the time this step integrates · the frames it may wait (1, 2, 4)
const K_DMAX: u32 = 38u;   // its densest cell as its last step left it (injectDecay)
const F_SCALAR: u32 = 1u; const F_RENDER: u32 = 2u; const F_NEW: u32 = 4u; const F_ACT: u32 = 8u; const F_KIND: u32 = 16u; const F_KINDS: u32 = 32u; const F_TINT: u32 = 64u;   // F_KIND: some cell's K word is not 0 · F_KINDS: mine or a neighbour's is, or such a source is on me: the kind is carried here this step · F_TINT: some cell is tinted

const V_VEL0: u32 = 0u; const V_VEL1: u32 = CAP * 512u; const V_CURL: u32 = CAP * 1024u;
const S_DEN0: u32 = 0u; const S_DEN1: u32 = CAP * 512u; const S_BITS: u32 = CAP * 1024u; const S_KIND: u32 = CAP * 1152u;
const P_P: u32 = 0u; const P_DIV: u32 = CAP * 512u;

const SRC_DIV_DT: f32 = 1.6;
const MAX_DIV_DT: f32 = 2.0;
const MAX_TRACE: f32 = 14.0;   // cells a backtrace may span: two bricks less the trilinear footprint — what markNbr's reach of 2 covers

fn packCoord(l: u32, b: vec3i) -> u32 { return u32(b.x) | (u32(b.y) << 10u) | (u32(b.z) << 17u) | (l << 27u) | 0x80000000u; }
fn coordB(w: u32) -> vec3i { return vec3i(i32(w & 1023u), i32((w >> 10u) & 127u), i32((w >> 17u) & 1023u)); }
fn coordL(w: u32) -> u32 { return (w >> 27u) & 1u; }
fn pageIdx(l: u32, b: vec3i) -> u32 {
  let L = sp.levels[l]; let n = vec3i(L.dims);
  if (any(b < vec3i(0)) || any(b >= n)) { return NONE; }
  return L.pageBase + u32((b.z * n.y + b.y) * n.x + b.x);
}
fn metaOf(slot: u32) -> u32 { return M_META + slot * MS; }
fn cidx(c: vec3i) -> u32 { return u32(c.x + (c.y << 3u) + (c.z << 6u)); }
// K_BOX: the box of a brick's cells that hold density or heat (3 bits a coordinate, lo then hi, bit 18 = there are some; 0 = none) — written by injectDecay
fn boxLo(w: u32) -> vec3i { return vec3i(i32(w & 7u), i32((w >> 3u) & 7u), i32((w >> 6u) & 7u)); }
fn boxHi(w: u32) -> vec3i { return vec3i(i32((w >> 9u) & 7u), i32((w >> 12u) & 7u), i32((w >> 15u) & 7u)); }
/** does the smoke of the brick at offset d from me (its K_BOX w) come within `reach` cells of my cells? (d = 0: it is mine). Conservative: the box, not the cells. */
fn boxNear(w: u32, d: vec3i, reach: i32) -> bool {
  if (w == 0u) { return false; }
  let lo = boxLo(w) + d * 8; let hi = boxHi(w) + d * 8;      // in my cell coordinates
  return all(lo <= vec3i(7 + reach)) && all(hi >= vec3i(-reach));
}

// ------------------------------------------------------------------ allocation
const VIEW_RESERVE: f32 = 0.25;   // the share of the pool only smoke in sight may take
/** how far out of sight brick b of level l is: 0 within viewR of where the camera looks (on the floor plan), 1 from twice that; × viewBias */
fn farOf(l: u32, b: vec3i) -> f32 {
  let c = (vec2f(b.xz) + 0.5) * 8.0 * sp.levels[l].voxel;
  return sp.viewBias * smoothstep(sp.viewR, 2.0 * sp.viewR, distance(c, vec2f(sp.viewX, sp.viewZ)));
}
// WHO GIVES WAY WHEN THE POOL RUNS SHORT (sp.fresh, the share of the pool thin smoke may never take; 0 = first come, as first benched). Nothing is evicted and nothing is counted: as the last
// 2 × fresh of the pool fills (`tight` 0 → 1, stepBegin) three things lean on the THINNEST smoke there is, all of them rates or refusals, so a plume gives ground from its skirts in and never pops:
//   · what counts as thin rises, from thinBelow to THIN_RISE times it (M_THIN): the soft ceiling's faster decay reaches further into old plumes the fuller the pool is;
//   · a brick asked for by smoke under that bar is refused while fewer than fresh × CAP slots are free (standing): the last slots go to sources and to dense smoke — a can just thrown;
//   · thin smoke keeps less air round it (ringOf: down to one cell) and an unneeded brick is held for less long (M_KEEP).
// Density stands in for age: smoke only ever thins as it spreads, so the freshest plume is the densest.
const THIN_RISE: f32 = 16.0;
/** how a brick whose densest cell is dmax stands when slots are short: 0 = haze, 1 = a body of smoke */
fn standing(dmax: f32) -> f32 { let t = bitcast<f32>(M[M_THIN]); return smoothstep(0.25 * t, t, dmax); }
/** cells of air kept round the smoke of a brick that stands at `st` */
fn ringOf(l: u32, st: f32) -> i32 {
  let r = f32(clamp(select(sp.ring, min(sp.ring, sp.fineRing), l == 1u), 1u, 8u));
  return i32(round(mix(r, mix(1.0, r, st), bitcast<f32>(M[M_TIGHT]))));
}
// THE FINE LATTICE LETS GO (sp.fineDecay 0 and sp.fineShare 1 = none of it, as first benched). A fine brick is a fifteenth of a coarse one's volume, so gun gas left to wander costs the pool far more than
// it shows: 1.7 s of automatic fire held 2,663 of 4,096 bricks for 3 % of the smoke in the air, and still held them 3 s later. In the boxes a fine domain was a 1.4 m cube whose faces ate what left it. Here:
//   · density under the thin bar fades fineDecay/s faster on this lattice, always, and the heat in those cells with it (heat alone would hold a brick for seconds after its gas has gone): the crisp gas by the
//     muzzle is untouched, what has spread to a haze is gone in a second or two;
//   · … BUT NOT WHILE IT IS HOT (sp.fineKeep > 0; 0 = no such rule, as first built): a cell hotter than fineKeep is not thin, whatever its density, and from half of it up
//     it is let go by degrees — so a flame (game/fire.ts FIRE.gas: heat with next to no smoke in it) keeps its lift for as long as its own cooling takes, then goes at once;
//   · its floors are higher (fineEps, fineHeat: what is stored as nothing) and it keeps less air round the gas (fineRing cells): two bricks in three were clear air round thin wisps;
//   · it has a share of the pool, counted by buildList, so a step late: fineShare of CAP, or whatever the coarse lattice leaves under the soft ceiling's foot (softLo) if that is more. From 0.7 of it new
//     bricks are refused to the thinnest gas first, at all of it to everything but a source: the gas then meets an open face and fades there, as at a box's.
// So a firefight's gun gas has the room while nobody else wants it and can never take a canister's bricks, whoever is shooting, and no game code counts anything.
fn fineFull() -> f32 { return bitcast<f32>(M[M_FINE]); }
// Make brick b of level l exist and mark it needed this step, asked for by smoke that stands at `st` (a source: 2). Page entry: 0 = none, LOCK = someone is filling it in this very dispatch, else
// slot + 1. Pops happen only in the two mark kernels and pushes only in freeIdle, so the free list is never popped and pushed in one dispatch. A pool with nothing left refuses (C_FAIL): the smoke
// then meets an open face there.
fn ensureBrick(l: u32, b: vec3i, st: f32) {
  let pi = pageIdx(l, b);
  if (pi == NONE) { return; }
  let keepFree = u32(f32(CAP) * (VIEW_RESERVE * farOf(l, b) + sp.fresh * (1.0 - min(st, 1.0))));   // (the last slots are the view's and dense smoke's: out of sight and haze are refused first)
  var s = atomicLoad(&A[A_PAGE + pi]);
  if (s == 0u) {   // (asked BEFORE the lock: a request its own bar refuses must not hold the entry while a better-placed one, which takes LOCK for 'being made', looks at it)
    let free = atomicLoad(&A[C_FREE]);
    if (free <= keepFree || free > CAP) { atomicAdd(&A[C_FAIL], 1u); return; }
    if (l == 1u && st <= 1.0) { let bar = smoothstep(0.7, 1.0, fineFull()); if (st < bar || bar >= 1.0) { atomicAdd(&A[C_HELD], 1u); return; } }   // (its own count: the pool is not short)
  }
  for (var tries = 0; s == 0u && tries < 4; tries++) {
    let r = atomicCompareExchangeWeak(&A[A_PAGE + pi], 0u, LOCK);
    if (r.exchanged) {
      let n = atomicSub(&A[C_FREE], 1u);
      if (n <= keepFree || n > CAP) { atomicAdd(&A[C_FREE], 1u); atomicStore(&A[A_PAGE + pi], 0u); atomicAdd(&A[C_FAIL], 1u); return; }
      let slot = atomicLoad(&A[A_FREE + n - 1u]);
      let m = metaOf(slot);
      M[m + K_COORD] = packCoord(l, b); M[m + K_FLAGS] = F_NEW; M[m + K_VMAX] = 0u; M[m + K_BOX] = 0u; M[m + K_ACC] = 0u; M[m + K_PER] = 1u; M[m + K_DMAX] = 0u;
      atomicStore(&A[A_STAMP + slot], sp.stepNo);
      atomicStore(&A[A_PAGE + pi], slot + 1u);
      atomicAdd(&A[C_ALLOC], 1u);
      return;
    }
    s = r.old_value;
  }
  if (s == 0u || s == LOCK) { return; }   // (LOCK: its maker stamps it)
  atomicStore(&A[A_STAMP + s - 1u], sp.stepNo);
}

@compute @workgroup_size(1)
fn stepBegin() {
  atomicStore(&A[C_LIVE], 0u); atomicStore(&A[C_FAIL], 0u); atomicStore(&A[C_SCALAR], 0u); atomicStore(&A[C_RENDER], 0u); atomicStore(&A[C_VMAX], 0u);
  atomicStore(&A[C_ALLOC], 0u); atomicStore(&A[C_FREED], 0u); atomicStore(&A[C_BAKED], 0u); atomicStore(&A[C_FINE], 0u); atomicStore(&A[C_ACT], 0u); atomicStore(&A[C_STEP], 0u); atomicStore(&A[C_TINT], 0u);
  let used = f32(CAP - min(atomicLoad(&A[C_FREE]), CAP)) / f32(CAP);
  let s = smoothstep(sp.softLo, sp.softHi, used);
  M[M_EPS] = bitcast<u32>(mix(sp.flushEps, max(sp.softEps, sp.flushEps), s * s));
  M[M_DECAY] = bitcast<u32>(sp.thinDecay + sp.softDecay * s);
  M[M_USED] = bitcast<u32>(used);
  var tight = 0.0; if (sp.fresh > 0.0) { tight = smoothstep(1.0 - 2.0 * sp.fresh, 1.0 - 0.5 * sp.fresh, used); }
  M[M_TIGHT] = bitcast<u32>(tight);
  M[M_THIN] = bitcast<u32>(sp.thinBelow * mix(1.0, THIN_RISE, tight * tight));
  M[M_KEEP] = u32(round(mix(f32(sp.keep), f32(min(sp.keep, 8u)), tight)));
  let fine = f32(atomicLoad(&A[C_LVL1])) / f32(CAP);   // (the last step's list)
  M[M_FINE] = bitcast<u32>(select(0.0, fine / max(max(sp.fineShare, sp.softLo - max(used - fine, 0.0)), 1e-4), sp.fineShare < 1.0));
  atomicStore(&A[C_LVL1], 0u); atomicStore(&A[C_HELD], 0u);
}

/** a source reaches brick b this step: if it exists it steps this frame, whatever it was waiting for */
fn wakeBrick(l: u32, b: vec3i) {
  let pi = pageIdx(l, b); if (pi == NONE) { return; }
  let s = atomicLoad(&A[A_PAGE + pi]);
  if (s != 0u && s != LOCK) { atomicStore(&A[A_WAKE + s - 1u], sp.stepNo); }   // (LOCK: another source's thread is making it, and wakes it)
}
// one workgroup per emitter: every brick its splat can deposit in exists from this step on (pushes and spent envelopes deposit nothing and make nothing), and every brick it reaches is awake
@compute @workgroup_size(64)
fn markEmit(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  if (wid.x >= sp.numEmitters) { return; }
  let e = sp.emitters[wid.x];
  let deposits = e.density != 0.0 || e.temperature != 0.0;
  let bs = 8.0 * sp.levels[e.level].voxel; let R = 3.0 * e.radius;
  let lo = vec3i(floor((e.pos - R) / bs)); let hi = vec3i(floor((e.pos + R) / bs));
  let n = vec3u(hi - lo + 1); let total = min(n.x * n.y * n.z, 32768u);
  for (var k = li; k < total; k += 64u) {
    let b = lo + vec3i(i32(k % n.x), i32((k / n.x) % n.y), i32(k / (n.x * n.y)));
    let q = clamp(e.pos, vec3f(b) * bs, vec3f(b + 1) * bs) - e.pos;
    if (dot(q, q) <= R * R * 1.02) { if (deposits) { ensureBrick(e.level, b, 2.0); } wakeBrick(e.level, b); }
  }
}

// one workgroup per live brick (last step's list): a brick holding density or heat needs itself and whichever bricks round it lie within `reach` cells of that smoke — the air the plume
// moves in and may move into this step. A pancake of smoke along the floor whose top is low in its bricks gets no layer of bricks above it.
@compute @workgroup_size(64)
fn markNbr(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  if (wid.x >= M[M_COUNT]) { return; }
  let m = metaOf(M[M_LIST + wid.x]);
  if ((M[m + K_FLAGS] & F_SCALAR) == 0u) { return; }
  let cw = M[m + K_COORD]; let l = coordL(cw); let b = coordB(cw);
  let cells = bitcast<f32>(M[m + K_VMAX]) * sp.dt * f32(M[m + K_PER]) / sp.levels[l].voxel;   // (a brick that waits crosses its wait's worth in one step)
  let st = standing(bitcast<f32>(M[m + K_DMAX]));
  let reach = i32(ceil(cells)) + ringOf(l, st);   // cells beyond the smoke that must exist: what it may cross this step + the air it moves in
  let bx = M[m + K_BOX];
  let r = select(1, 2, reach > 8); let n = u32(2 * r + 1); let total = n * n * n;
  for (var k = li; k < total; k += 64u) {
    let d = vec3i(i32(k % n), i32((k / n) % n), i32(k / (n * n))) - r;
    if (boxNear(bx, -d, reach)) { ensureBrick(l, b + d, st); }      // (seen from the brick at d, I am at −d)
  }
}

@compute @workgroup_size(64)
fn freeIdle(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= M[M_COUNT]) { return; }
  let slot = M[M_LIST + gid.x]; let m = metaOf(slot);
  if (atomicLoad(&A[A_STAMP + slot]) + M[M_KEEP] >= sp.stepNo) { return; }
  let cw = M[m + K_COORD];
  atomicStore(&A[A_PAGE + pageIdx(coordL(cw), coordB(cw))], 0u);
  M[m + K_COORD] = 0u; M[m + K_FLAGS] = 0u;
  let i = atomicAdd(&A[C_FREE], 1u);
  atomicStore(&A[A_FREE + i], slot);
  atomicAdd(&A[C_FREED], 1u);
}

// WHO STEPS THIS FRAME. The old boxes' two rules (a calm box stepped every p-th frame, a far one on alternate frames), per BRICK. A brick may wait p frames
// (1, 2 or 4) as long as its fastest air crosses no more than `calmCells` cells in that wait — `farCells` out of sight (farOf) — and then integrates the time it sat out in one step (K_DT).
// A plume's slow outskirts wait while its jet steps every frame; nothing here knows what a plume is. What keeps the seams quiet:
//   · a brick takes the SHORTEST wait among itself and its 26 neighbours, so a brick stepping next to one that waits is itself calm;
//   · a source (deposit or shove) wakes every brick it reaches on every frame of its life, and a woken brick steps ONE frame (what it was owed, three frames of calm air at most, is let go): a
//     source's terms are always one frame's (sp.dt) and its jet never carries smoke a wait's length in a step;
//   · no wait is longer than a step may integrate (dtCap), so a slow frame rate shortens the waits and no brick's clock runs behind its neighbour's;
//   · a stepping brick reads a waiting neighbour's velocity where that one left it (ldVadv);
//   · pressure is stored per unit time (divergence, project), so bricks stepping different lengths of time read each other's without a jump;
//   · columns step together (buoyancy against pressure is a vertical balance) and plan tiles of 4 × 4 bricks take turns, so a frame's work is level.
// A waiting brick's fields, flags, neighbour table and atlas block all stand as its last step left them.
fn wishOf(slot: u32) -> u32 {
  if (atomicLoad(&A[A_WAKE + slot]) == sp.stepNo) { return 1u; }
  let m = metaOf(slot);
  if ((M[m + K_FLAGS] & F_NEW) != 0u) { return sp.calmMax; }   // (clear air just made: it steps now to be cleared, and asks nothing of its neighbours)
  let cw = M[m + K_COORD]; let l = coordL(cw);
  let allow = mix(sp.calmCells, max(sp.calmCells, sp.farCells), farOf(l, coordB(cw)));
  let w = min(allow * sp.levels[l].voxel / max(bitcast<f32>(M[m + K_VMAX]), 0.02), sp.dtCap * 1.001) / sp.dt;
  return min(select(select(1u, 2u, w >= 2.0), 4u, w >= 4.0), sp.calmMax);
}
@compute @workgroup_size(64)
fn buildList(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= CAP) { return; }
  let slot = gid.x; let m = metaOf(slot); let cw = M[m + K_COORD];
  if ((cw & 0x80000000u) == 0u) { return; }
  M[M_LIST + atomicAdd(&A[C_LIVE], 1u)] = slot;
  let fl = M[m + K_FLAGS]; let l = coordL(cw); let b = coordB(cw);
  if (l == 1u) { atomicAdd(&A[C_LVL1], 1u); }
  // (the counts the read-back reports: every live brick as its last step left it)
  if ((fl & F_ACT) != 0u) { atomicAdd(&A[C_ACT], 1u); }
  if ((fl & F_TINT) != 0u) { atomicAdd(&A[C_TINT], 1u); }
  if ((fl & F_SCALAR) != 0u) { atomicAdd(&A[C_SCALAR], 1u); atomicMax(&A[C_VMAX], M[m + K_VMAX]); }
  if ((fl & F_RENDER) != 0u) { atomicAdd(&A[C_RENDER], 1u); if (l == 1u) { atomicAdd(&A[C_FINE], 1u); } }
  var p = 1u;
  if (sp.calmMax > 1u) {
    p = wishOf(slot);
    for (var j = 0u; j < 27u && p > 1u; j++) {
      if (j == 13u) { continue; }
      let pi = pageIdx(l, b + vec3i(i32(j % 3u), i32((j / 3u) % 3u), i32(j / 9u)) - 1);
      if (pi == NONE) { continue; }
      let s = atomicLoad(&A[A_PAGE + pi]);
      if (s != 0u && s != LOCK) { p = min(p, wishOf(s - 1u)); }
    }
  }
  var due = p == 1u || (fl & F_NEW) != 0u || sp.bakeAll != 0u || ((sp.stepNo + u32(b.x >> 2u) + 2u * u32(b.z >> 2u)) & (p - 1u)) == 0u;
  if (!due) {   // an obstacle changed here: baked before anything reads it
    let h = sp.levels[l].voxel; let lo = vec3f(b) * 8.0 * h; let hi = lo + 8.0 * h;
    for (var j = 0u; j < sp.numDirty; j++) { if (all(sp.dirty[j * 2u].xyz <= hi + h) && all(sp.dirty[j * 2u + 1u].xyz >= lo - h)) { due = true; } }
  }
  let acc = bitcast<f32>(M[m + K_ACC]) + sp.dt;
  M[m + K_PER] = p;
  if (due) { M[M_STEP + atomicAdd(&A[C_STEP], 1u)] = slot; M[m + K_DT] = bitcast<u32>(select(min(acc, sp.dtCap), sp.dt, atomicLoad(&A[A_WAKE + slot]) == sp.stepNo)); M[m + K_ACC] = 0u; }
  else { M[m + K_ACC] = bitcast<u32>(acc); }
}

@group(2) @binding(6) var<storage, read_write> args: array<u32>;   // two indirect dispatches: [0‥2] a workgroup per live brick, [4‥6] per brick that steps
@compute @workgroup_size(1)
fn writeArgs() {
  let n = atomicLoad(&A[C_LIVE]); let ns = atomicLoad(&A[C_STEP]);
  M[M_COUNT] = n; M[M_NSTEP] = ns;
  args[0] = n; args[1] = 1u; args[2] = 1u;
  args[4] = ns; args[5] = 1u; args[6] = 1u;
  atomicAdd(&A[C_WORK], ns);
}

// ------------------------------------------------------------------ per-brick prologue
struct Bk { slot: u32, m: u32, l: u32, b: vec3i, h: f32, dt: f32 };   // dt: the time THIS brick integrates this step (K_DT); a source's own terms take sp.dt
var<workgroup> wgSlot: u32;
var<workgroup> wgWord: u32;
/** the brick this workgroup works on — in the form the uniformity analysis accepts ahead of a workgroupBarrier (link, project, injectDecay, publish) */
fn openBrickU(w: u32, li: u32) -> u32 {
  if (li == 0u) { var s = NONE; if (w < M[M_NSTEP]) { s = M[M_STEP + w]; } wgSlot = s; }
  return workgroupUniformLoad(&wgSlot);
}
/** the same for the kernels with no barrier of their own: a plain load */
fn openBrick(w: u32, li: u32) -> u32 { if (w >= M[M_NSTEP]) { return NONE; } return M[M_STEP + w]; }
fn brickOf(slot: u32) -> Bk { let m = metaOf(slot); let cw = M[m + K_COORD]; let l = coordL(cw); return Bk(slot, m, l, coordB(cw), sp.levels[l].voxel, bitcast<f32>(M[m + K_DT])); }
/** slot + 1 of the brick at offset o (in bricks) from k, 0 = there is none */
fn nbSlot(k: Bk, o: vec3i) -> u32 {
  if (all(abs(o) <= vec3i(1))) { return M[k.m + K_NBR + u32((o.x + 1) + 3 * (o.y + 1) + 9 * (o.z + 1))]; }
  let pi = pageIdx(k.l, k.b + o); if (pi == NONE) { return 0u; }
  let s = atomicLoad(&A[A_PAGE + pi]); return select(s, 0u, s == LOCK);
}
/** cell c in k's own cell coordinates (may lie outside 0‥7) → (slot + 1 or 0, cell index in that brick) */
fn cellRef(k: Bk, c: vec3i) -> vec2u {
  let o = c >> vec3u(3u);
  if (all(o == vec3i(0))) { return vec2u(k.slot + 1u, cidx(c)); }
  return vec2u(nbSlot(k, o), cidx(c & vec3i(7)));
}
fn bitsOf(slot: u32, cell: u32) -> u32 { return (S[S_BITS + slot * 128u + (cell >> 2u)] >> ((cell & 3u) * 8u)) & 0xffu; }   // bit 0 this cell is solid; 1‥6 its −x +x −y +y −z +z neighbour is
fn unV(w: vec2u) -> vec4f { return vec4f(unpack2x16float(w.x), unpack2x16float(w.y)); }
fn paV(v: vec4f) -> vec2u { return vec2u(pack2x16float(v.xy), pack2x16float(v.zw)); }
fn worldP(k: Bk, c: vec3i) -> vec3f { return (vec3f(k.b * 8 + c) + 0.5) * k.h; }

fn ldV(f: u32, k: Bk, c: vec3i) -> vec4f { let r = cellRef(k, c); if (r.x == 0u) { return vec4f(0.0); } return unV(V[f + (r.x - 1u) * 512u + r.y]); }
/** a face neighbour's value for the stencils: a brick that is not there repeats the centre's (zero gradient — what clamping to the box edge did) */
fn ldVn(f: u32, k: Bk, c: vec3i, own: vec4f) -> vec4f { let r = cellRef(k, c); if (r.x == 0u) { return own; } return unV(V[f + (r.x - 1u) * 512u + r.y]); }
/** the advected velocity (V_VEL1) at c for the curl; of a neighbour that sits this frame out, the velocity its last step left (V_VEL0: its V_VEL1 is that step's scratch). K_ACC 0 = it steps now */
fn ldVadv(k: Bk, c: vec3i, own: vec4f) -> vec4f {
  let r = cellRef(k, c); if (r.x == 0u) { return own; }
  let f = select(V_VEL1, V_VEL0, r.x - 1u != k.slot && M[metaOf(r.x - 1u) + K_ACC] != 0u);
  return unV(V[f + (r.x - 1u) * 512u + r.y]);
}
fn ldD(f: u32, k: Bk, c: vec3i) -> vec2f { let r = cellRef(k, c); if (r.x == 0u) { return vec2f(0.0); } return unpack2x16float(S[f + (r.x - 1u) * 512u + r.y]); }

/** a sample point never sinks under the centres of the lattice's bottom row: what a floor-standing box's clamp to its own edge did (a backtrace into the floor repeats the first cell) */
fn aboveFloor(k: Bk, g: vec3f) -> vec3f { return vec3f(g.x, max(g.y, 0.5 - f32(k.b.y * 8)), g.z); }
/** trilinear velocity at g (k's cell coordinates, cell i's centre at i + ½); nothing where no brick is */
fn sampleVel(f: u32, k: Bk, g: vec3f) -> vec3f {
  let q = aboveFloor(k, g) - 0.5; let fl = floor(q); let i0 = vec3i(fl); let t = q - fl;
  let o0 = i0 >> vec3u(3u); let o1 = (i0 + 1) >> vec3u(3u);
  var a: vec3f; var b: vec3f; var c: vec3f; var d: vec3f; var e: vec3f; var ff: vec3f; var gg: vec3f; var hh: vec3f;
  if (all(o0 == o1)) {
    var s = k.slot + 1u; if (any(o0 != vec3i(0))) { s = nbSlot(k, o0); }
    if (s == 0u) { return vec3f(0.0); }
    let p = f + (s - 1u) * 512u + cidx(i0 & vec3i(7));
    a = unV(V[p]).xyz; b = unV(V[p + 1u]).xyz; c = unV(V[p + 8u]).xyz; d = unV(V[p + 9u]).xyz;
    e = unV(V[p + 64u]).xyz; ff = unV(V[p + 65u]).xyz; gg = unV(V[p + 72u]).xyz; hh = unV(V[p + 73u]).xyz;
  } else {
    a = ldV(f, k, i0).xyz; b = ldV(f, k, i0 + vec3i(1, 0, 0)).xyz; c = ldV(f, k, i0 + vec3i(0, 1, 0)).xyz; d = ldV(f, k, i0 + vec3i(1, 1, 0)).xyz;
    e = ldV(f, k, i0 + vec3i(0, 0, 1)).xyz; ff = ldV(f, k, i0 + vec3i(1, 0, 1)).xyz; gg = ldV(f, k, i0 + vec3i(0, 1, 1)).xyz; hh = ldV(f, k, i0 + vec3i(1, 1, 1)).xyz;
  }
  return mix(mix(mix(a, b, t.x), mix(c, d, t.x), t.y), mix(mix(e, ff, t.x), mix(gg, hh, t.x), t.y), t.z);
}
struct DenTap { v: vec2f, mn: vec2f, mx: vec2f };
/** trilinear (density, temperature) at g plus the min / max of the eight cells it weighs (the MacCormack limiter's bounds) */
fn sampleDen(f: u32, k: Bk, g: vec3f) -> DenTap {
  let q = aboveFloor(k, g) - 0.5; let fl = floor(q); let i0 = vec3i(fl); let t = q - fl;
  let o0 = i0 >> vec3u(3u); let o1 = (i0 + 1) >> vec3u(3u);
  var a: vec2f; var b: vec2f; var c: vec2f; var d: vec2f; var e: vec2f; var ff: vec2f; var gg: vec2f; var hh: vec2f;
  if (all(o0 == o1)) {
    var s = k.slot + 1u; if (any(o0 != vec3i(0))) { s = nbSlot(k, o0); }
    if (s == 0u) { return DenTap(vec2f(0.0), vec2f(0.0), vec2f(0.0)); }
    let p = f + (s - 1u) * 512u + cidx(i0 & vec3i(7));
    a = unpack2x16float(S[p]); b = unpack2x16float(S[p + 1u]); c = unpack2x16float(S[p + 8u]); d = unpack2x16float(S[p + 9u]);
    e = unpack2x16float(S[p + 64u]); ff = unpack2x16float(S[p + 65u]); gg = unpack2x16float(S[p + 72u]); hh = unpack2x16float(S[p + 73u]);
  } else {
    a = ldD(f, k, i0); b = ldD(f, k, i0 + vec3i(1, 0, 0)); c = ldD(f, k, i0 + vec3i(0, 1, 0)); d = ldD(f, k, i0 + vec3i(1, 1, 0));
    e = ldD(f, k, i0 + vec3i(0, 0, 1)); ff = ldD(f, k, i0 + vec3i(1, 0, 1)); gg = ldD(f, k, i0 + vec3i(0, 1, 1)); hh = ldD(f, k, i0 + vec3i(1, 1, 1));
  }
  var r: DenTap;
  r.v = mix(mix(mix(a, b, t.x), mix(c, d, t.x), t.y), mix(mix(e, ff, t.x), mix(gg, hh, t.x), t.y), t.z);
  r.mn = min(min(min(a, b), min(c, d)), min(min(e, ff), min(gg, hh)));
  r.mx = max(max(max(a, b), max(c, d)), max(max(e, ff), max(gg, hh)));
  return r;
}

// WHAT IS IN A CELL. The boxes drew a whole box as one kind of smoke (canister plume × 1.3, anything else × 1.0, destruction dust tinted and shaped); with no boxes the kind rides with the smoke, per cell
// of the coarse lattice: one K word = 4 × 8 bits (share of the density that is NOT canister smoke, then 1 − tint as r, g, b averaged over all of it). Shares, not amounts: they move along the
// density's own backtrace weighted by density, take a source's kind in proportion to what it deposits, and nothing decays them. 0 = canister smoke, so a brick with only that in and round it
// (no F_KINDS) does none of this. The fine lattice holds no canister smoke and nothing tinted: it has no words. Only publish reads them — the solver's own physics never does.
fn sampleKind(k: Bk, g: vec3f) -> vec4f {
  let q = aboveFloor(k, g) - 0.5; let fl = floor(q); let i0 = vec3i(fl); let t = q - fl;
  var acc = vec4f(0.0); var sum = 0.0;
  for (var j = 0u; j < 8u; j++) {
    let o = vec3i(i32(j & 1u), i32((j >> 1u) & 1u), i32(j >> 2u));
    let r = cellRef(k, i0 + o); if (r.x == 0u) { continue; }
    let at = (r.x - 1u) * 512u + r.y;
    let u = select(1.0 - t, t, o == vec3i(1));
    let w = unpack2x16float(S[S_DEN0 + at]).x * u.x * u.y * u.z;
    if (w > 0.0) { acc += w * unpack4x8unorm(S[S_KIND + at]); sum += w; }
  }
  return acc / max(sum, 1e-20);
}

/** Σ expand·exp(−r²/R²) over the expanding emitters that reach this brick (smoke.wgsl sourceExpansion, in world metres) */
fn sourceExpansion(k: Bk, Pw: vec3f) -> f32 {
  var s = 0.0;
  for (var w = 0u; w < 2u; w++) {
    var em = M[k.m + K_EM0 + w];
    while (em != 0u) {
      let i = countTrailingZeros(em) + 32u * w; em &= em - 1u;
      if (i >= sp.numExpand) { break; }
      let e = sp.emitters[i];
      let d = Pw - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
      if (r2 > 9.0) { continue; }
      s += e.expand * exp(-r2);
    }
  }
  return min(s, SRC_DIV_DT / sp.dt);
}

// ------------------------------------------------------------------ link: neighbours, who reaches this brick, and — new or dirtied — its obstacles
struct BoxGeoS { c: vec3f, rot: u32, h: vec3f, flags: u32 };
@group(2) @binding(1) var<storage, read> sboxGeo: array<BoxGeoS>;
@group(2) @binding(2) var<storage, read> sgridCells: array<u32>;
@group(2) @binding(3) var<storage, read> sgridItems: array<u32>;
struct SceneInfoS { numBoxes: u32, numGlobals: u32, gridW: u32, gridH: u32, globals: array<vec4u, 4>, numCapsules: u32, numChars: u32, capsPerChar: u32, pad0: u32, charBounds: array<vec4f, 8>, globalsY: array<vec4f, 8>, grid: vec4f, globalsB: array<vec4f, 32>, glassInfo: vec4u, glass: array<vec4f, 96> };
@group(2) @binding(4) var<uniform> sscene: SceneInfoS;
struct SealS { info: vec4u, boxes: array<vec4f, 64> };   // ≤ 32 sealing door leaves: (c, cos yaw), (h, sin yaw)
@group(2) @binding(5) var<uniform> sseal: SealS;

fn insideBox(p: vec3f, b: BoxGeoS) -> bool {
  let cs = unpack2x16float(b.rot);
  let d = p - b.c;
  let l = vec3f(cs.x * d.x - cs.y * d.z, d.y, cs.y * d.x + cs.x * d.z);
  return all(abs(l) <= b.h + vec3f(0.01));
}
fn insideSheet(p: vec3f, a: vec4f, b: vec4f, fat: f32) -> bool {
  let d = p - a.xyz;
  let l = vec3f(a.w * d.x - b.w * d.z, d.y, b.w * d.x + a.w * d.z);
  let hh = vec3f(select(b.x, max(b.x, fat), b.x < b.z), b.y, select(max(b.z, fat), b.z, b.x < b.z));
  return all(abs(l) <= hh + vec3f(0.01));
}
/** smoke.wgsl bakeObstacles' test at one point: statics off the trace grid, glass panes and sealing door leaves fattened to a closed layer of cells */
fn solidAt(p: vec3f, voxel: f32) -> bool {
  for (var g = 0u; g < sscene.numGlobals; g++) {
    let b = sboxGeo[sscene.globals[g >> 2u][g & 3u]];
    if ((b.flags & 10u) == 0u && insideBox(p, b)) { return true; }
  }
  let gw = i32(sscene.gridW); let gh = i32(sscene.gridH);
  let cell = vec2i(floor(p.xz / GRID_CELL));
  if (cell.x >= 0 && cell.y >= 0 && cell.x < gw && cell.y < gh) {
    let ci = u32(cell.y * gw + cell.x);
    let end = sgridCells[ci + 1u];
    for (var j = sgridCells[ci]; j < end; j++) {
      let b = sboxGeo[sgridItems[j]];
      if ((b.flags & 10u) != 0u) { continue; }
      if (insideBox(p, b)) { return true; }
    }
  }
  for (var j = 0u; j < min(sscene.glassInfo.x, 32u); j++) { if (insideSheet(p, sscene.glass[j * 3u], sscene.glass[j * 3u + 1u], 0.55 * voxel)) { return true; } }
  for (var j = 0u; j < min(sseal.info.x, 32u); j++) { if (insideSheet(p, sseal.boxes[j * 2u], sseal.boxes[j * 2u + 1u], 0.6 * voxel)) { return true; } }
  return false;
}

var<workgroup> wgEm: array<atomic<u32>, 2>;
var<workgroup> wgWind: atomic<u32>;
var<workgroup> wgOpen: atomic<u32>;
var<workgroup> wgNear: atomic<u32>;
var<workgroup> wgKind: atomic<u32>;
var<workgroup> wgSolid: array<atomic<u32>, 32>;   // the brick's 10³ cells (its own + one cell of apron) as bits
fn solidBit(c: vec3i) -> u32 { let i = u32((c.x + 1) + 10 * (c.y + 1) + 100 * (c.z + 1)); return (atomicLoad(&wgSolid[i >> 5u]) >> (i & 31u)) & 1u; }

@compute @workgroup_size(256)
fn link(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrickU(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  let bs = 8.0 * k.h; let lo = vec3f(k.b) * bs; let hi = lo + bs;
  if (li == 0u) {
    atomicStore(&wgEm[0], 0u); atomicStore(&wgEm[1], 0u); atomicStore(&wgWind, 0u); atomicStore(&wgOpen, 0u); atomicStore(&wgNear, 0u); atomicStore(&wgKind, 0u);
    var w = M[k.m + K_FLAGS] & F_NEW;
    if (w == 0u && sp.bakeAll != 0u) { w = 1u; }
    for (var j = 0u; w == 0u && j < sp.numDirty; j++) { if (all(sp.dirty[j * 2u].xyz <= hi + k.h) && all(sp.dirty[j * 2u + 1u].xyz >= lo - k.h)) { w = 1u; } }
    wgWord = w;
  }
  if (li < 32u) { atomicStore(&wgSolid[li], 0u); }
  let todo = workgroupUniformLoad(&wgWord);   // F_NEW = clear + bake, 1 = bake again, 0 = neither
  if (li < 27u) {
    let o = vec3i(i32(li % 3u), i32((li / 3u) % 3u), i32(li / 9u)) - 1;
    let pi = pageIdx(k.l, k.b + o);
    var s = 0u; if (pi != NONE) { s = atomicLoad(&A[A_PAGE + pi]); if (s == LOCK) { s = 0u; } }
    M[k.m + K_NBR + li] = s;
    if (s != 0u && boxNear(M[metaOf(s - 1u) + K_BOX], o, 1)) { atomicOr(&wgNear, 1u); }   // smoke in me or in the one-cell shell round me
    if (s != 0u && (M[metaOf(s - 1u) + K_FLAGS] & F_KIND) != 0u) { atomicOr(&wgKind, 1u); }   // (a coarse backtrace spans under a brick: 11 m/s × 1/30 s = 6.7 cells, and a brick that waits is slower still)
    // the six faces: smoke close to one with no brick beyond it (markNbr asked and the world ends there, or the pool had nothing left) = an open face the scalars are eased out toward;
    // under the floor is solid, not open
    if (s == 0u && (abs(o.x) + abs(o.y) + abs(o.z)) == 1 && !(o.y < 0 && k.b.y == 0) && boxNear(M[k.m + K_BOX], -o, ringOf(k.l, standing(bitcast<f32>(M[k.m + K_DMAX]))))) {
      let f = select(select(select(5u, 4u, o.z < 0), select(3u, 2u, o.y < 0), o.y != 0), select(1u, 0u, o.x < 0), o.x != 0);
      atomicOr(&wgOpen, 1u << f);
    }
  } else if (li >= 64u && li < 64u + MAX_EM) {
    let i = li - 64u;
    if (i < sp.numEmitters) {
      let e = sp.emitters[i];
      let q = clamp(e.pos, lo, hi) - e.pos;
      if (e.level == k.l && dot(q, q) <= 9.0 * e.radius * e.radius * 1.02) { atomicOr(&wgEm[i >> 5u], 1u << (i & 31u)); if (e.kind != 0u && e.density != 0.0) { atomicOr(&wgKind, 1u); } }
    }
  } else if (li >= 128u && li < 136u) {
    let i = li - 128u;
    if (i < wind.count) {
      let wb = sp.windBound[i];
      let q = clamp(wb.xyz, lo, hi) - wb.xyz;
      let s = wind.src[i];   // (the storm blows nowhere inside its interior footprint: a brick wholly indoors never asks it)
      let hit = select(dot(q, q) <= wb.w * wb.w, !(lo.x >= s.pos.x && lo.z >= s.pos.y && hi.x <= s.pos.z && hi.z <= s.reach), wb.w < 0.0);
      if (hit) { atomicOr(&wgWind, 1u << i); }
    }
  }
  if (todo != 0u) {
    for (var j = li; j < 1000u; j += 256u) {
      let c = vec3i(i32(j % 10u), i32((j / 10u) % 10u), i32(j / 100u)) - 1;
      let wc = k.b * 8 + c;
      if (wc.y < 0 || solidAt((vec3f(wc) + 0.5) * k.h, k.h)) { atomicOr(&wgSolid[j >> 5u], 1u << (j & 31u)); }
    }
  }
  workgroupBarrier();
  if (todo != 0u && li < 128u) {
    var w = 0u;
    for (var j = 0u; j < 4u; j++) {
      let cell = li * 4u + j; let c = vec3i(i32(cell & 7u), i32((cell >> 3u) & 7u), i32(cell >> 6u));
      let bits = solidBit(c) | (solidBit(c - vec3i(1, 0, 0)) << 1u) | (solidBit(c + vec3i(1, 0, 0)) << 2u) | (solidBit(c - vec3i(0, 1, 0)) << 3u) | (solidBit(c + vec3i(0, 1, 0)) << 4u)
               | (solidBit(c - vec3i(0, 0, 1)) << 5u) | (solidBit(c + vec3i(0, 0, 1)) << 6u);
      w |= bits << (8u * j);
    }
    S[S_BITS + slot * 128u + li] = w;
  }
  if (todo == F_NEW) {
    for (var j = li; j < 512u; j += 256u) {
      let i = slot * 512u + j;
      V[V_VEL0 + i] = vec2u(0u); V[V_VEL1 + i] = vec2u(0u); V[V_CURL + i] = vec2u(0u);
      S[S_DEN0 + i] = 0u; S[S_DEN1 + i] = 0u; S[S_KIND + i] = 0u; P[P_P + i] = 0.0; P[P_DIV + i] = 0.0;
    }
  }
  if (li == 0u) {
    // The scalar passes run (F_ACT) where their result can be anything but zero: smoke in the brick or in the one-cell shell round it, an emitter on it — or air moving a cell a step or
    // faster here, when the backtrace from one of MY cells (it uses my velocity) can reach further than that shell. Every other brick is air: exactly zero scalars, velocity only.
    let fast = bitcast<f32>(M[k.m + K_VMAX]) * k.dt / k.h > 0.8;
    let act = atomicLoad(&A[A_STAMP + slot]) == sp.stepNo && (fast || atomicLoad(&wgNear) != 0u || (atomicLoad(&wgEm[0]) | atomicLoad(&wgEm[1])) != 0u);
    var fl = M[k.m + K_FLAGS] & ~(F_NEW | F_ACT | F_KINDS);
    if (k.l == 0u && atomicLoad(&wgKind) != 0u) { fl |= F_KINDS; }
    if (act) { fl |= F_ACT; } else { fl &= ~F_SCALAR; M[k.m + K_BOX] = 0u; M[k.m + K_DMAX] = 0u; }
    M[k.m + K_FLAGS] = fl;
    M[k.m + K_EM0] = atomicLoad(&wgEm[0]); M[k.m + K_EM1] = atomicLoad(&wgEm[1]); M[k.m + K_WIND] = atomicLoad(&wgWind); M[k.m + K_OPEN] = atomicLoad(&wgOpen);
    if (todo != 0u) { atomicAdd(&A[C_BAKED], 1u); }
  }
}

// ------------------------------------------------------------------ the step. Workgroup = one brick, 8×8×4 invocations, two cells each.
@compute @workgroup_size(8, 8, 4)
fn advectVel(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot); let damp = exp(-sp.velDamp * k.dt); let s = k.dt / k.h;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    if ((bitsOf(slot, cell) & 1u) != 0u) { V[V_VEL1 + i] = vec2u(0u); continue; }
    let u = unV(V[V_VEL0 + i]).xyz;
    let g = vec3f(c) + 0.5 - clamp(u * s, vec3f(-MAX_TRACE), vec3f(MAX_TRACE));
    V[V_VEL1 + i] = paV(vec4f(sampleVel(V_VEL0, k, g) * damp, 0.0));
  }
}

@compute @workgroup_size(8, 8, 4)
fn curl(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot); let h = 0.5 / k.h;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let i = slot * 512u + cidx(c);
    let o = unV(V[V_VEL1 + i]);
    let L = ldVadv(k, c - vec3i(1, 0, 0), o); let R = ldVadv(k, c + vec3i(1, 0, 0), o);
    let D = ldVadv(k, c - vec3i(0, 1, 0), o); let U = ldVadv(k, c + vec3i(0, 1, 0), o);
    let B = ldVadv(k, c - vec3i(0, 0, 1), o); let F = ldVadv(k, c + vec3i(0, 0, 1), o);
    let w = vec3f((U.z - D.z) - (F.y - B.y), (F.x - B.x) - (R.z - L.z), (R.y - L.y) - (U.x - D.x)) * h;
    V[V_CURL + i] = paV(vec4f(w, length(w)));
  }
}

@compute @workgroup_size(8, 8, 4)
fn forces(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot); let windMask = M[k.m + K_WIND];
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    if ((bitsOf(slot, cell) & 1u) != 0u) { V[V_VEL0 + i] = vec2u(0u); continue; }
    var u = unV(V[V_VEL1 + i]).xyz;
    let dT = unpack2x16float(S[S_DEN0 + i]);
    u.y += (sp.buoyancy * dT.y - sp.weight * dT.x) * k.dt;
    u += vec3f(sp.windX, 0.0, sp.windZ) * k.dt;
    let wC = unV(V[V_CURL + i]);
    let grad = vec3f(ldVn(V_CURL, k, c + vec3i(1, 0, 0), wC).w - ldVn(V_CURL, k, c - vec3i(1, 0, 0), wC).w,
                     ldVn(V_CURL, k, c + vec3i(0, 1, 0), wC).w - ldVn(V_CURL, k, c - vec3i(0, 1, 0), wC).w,
                     ldVn(V_CURL, k, c + vec3i(0, 0, 1), wC).w - ldVn(V_CURL, k, c - vec3i(0, 0, 1), wC).w);
    let gl = length(grad);
    if (gl > 1e-5) { u += sp.vortConf * k.h * cross(grad / gl, wC.xyz) * k.dt; }
    let Pw = worldP(k, c);
    if (sp.turbulence > 0.0 && dT.x > 0.01) {
      let q = Pw * 4.7 + vec3f(0.0, -sp.time * 0.9, sp.time * 0.35);
      let n = vec3f(sin(q.y * 1.7 + sin(q.z * 2.3)), sin(q.z * 1.3 + sin(q.x * 2.9)) * 0.5, sin(q.x * 1.9 + sin(q.y * 2.1)));
      u += n * sp.turbulence * clamp(dT.x, 0.0, 1.5) * k.dt;
    }
    for (var w = 0u; w < 2u; w++) {
      var em = M[k.m + K_EM0 + w];
      while (em != 0u) {
        let e = sp.emitters[countTrailingZeros(em) + 32u * w]; em &= em - 1u;
        if (e.push <= 0.0) { continue; }
        let d = Pw - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
        if (r2 > 9.0) { continue; }
        var jet = e.dir * e.speed;
        if (e.mode > 0.5) { jet = normalize(d + e.dir * 0.02 + vec3f(1e-4)) * e.speed; }
        u = mix(u, jet, clamp(exp(-r2) * e.push * sp.dt, 0.0, 1.0));
      }
    }
    if (windMask != 0u) { u = windForce(u, Pw, windMask, k.dt); }
    let spd = length(u); if (spd > 11.0) { u *= 11.0 / spd; }
    V[V_VEL0 + i] = paV(vec4f(u, 0.0));
  }
}

@compute @workgroup_size(8, 8, 4)
fn divergence(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot); let expanding = sp.numExpand > 0u && (M[k.m + K_EM0] | M[k.m + K_EM1]) != 0u;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    let bits = bitsOf(slot, cell);
    if ((bits & 1u) != 0u) { P[P_DIV + i] = 0.0; continue; }
    let o = unV(V[V_VEL0 + i]);
    let L = select(ldVn(V_VEL0, k, c - vec3i(1, 0, 0), o).x, 0.0, (bits & 2u) != 0u);  let R = select(ldVn(V_VEL0, k, c + vec3i(1, 0, 0), o).x, 0.0, (bits & 4u) != 0u);
    let D = select(ldVn(V_VEL0, k, c - vec3i(0, 1, 0), o).y, 0.0, (bits & 8u) != 0u);  let U = select(ldVn(V_VEL0, k, c + vec3i(0, 1, 0), o).y, 0.0, (bits & 16u) != 0u);
    let B = select(ldVn(V_VEL0, k, c - vec3i(0, 0, 1), o).z, 0.0, (bits & 32u) != 0u); let F = select(ldVn(V_VEL0, k, c + vec3i(0, 0, 1), o).z, 0.0, (bits & 64u) != 0u);
    var div = ((R - L) + (U - D) + (F - B)) * (0.5 / k.h);
    if (expanding) { div -= sourceExpansion(k, worldP(k, c)); }
    P[P_DIV + i] = div / k.dt;   // (pressure per unit time: what two bricks stepping different lengths of time can share, and a warm start that survives a change of dt)
  }
}

/** pressure beyond one face: a solid mirrors the centre (Neumann), a brick that is not there is open air (p = 0) */
fn pAt(k: Bk, bits: u32, bit: u32, c: vec3i, pc: f32) -> f32 {
  if ((bits & bit) != 0u) { return pc; }
  let r = cellRef(k, c); if (r.x == 0u) { return 0.0; }
  return P[P_P + (r.x - 1u) * 512u + r.y];
}
// red / black SOR IN PLACE: a half sweep writes one colour and reads only the other, so no second pressure field and no copy of the colour that sits out. 256 invocations = the brick's
// 256 cells of this colour (brick origins are even on every axis, so a cell's colour in its brick is its colour in the world).
override RB_COLOR: u32 = 0u;
@compute @workgroup_size(256)
fn rbgs(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  let z = i32(li >> 5u); let y = i32((li >> 2u) & 7u); let x = i32((li & 3u) << 1u) + ((y + z + i32(RB_COLOR)) & 1);
  let c = vec3i(x, y, z); let cell = cidx(c); let i = slot * 512u + cell;
  let bits = bitsOf(slot, cell);
  if ((bits & 1u) != 0u) { return; }
  let pc = P[P_P + i];
  let s = pAt(k, bits, 2u, c - vec3i(1, 0, 0), pc) + pAt(k, bits, 4u, c + vec3i(1, 0, 0), pc) + pAt(k, bits, 8u, c - vec3i(0, 1, 0), pc) + pAt(k, bits, 16u, c + vec3i(0, 1, 0), pc)
        + pAt(k, bits, 32u, c - vec3i(0, 0, 1), pc) + pAt(k, bits, 64u, c + vec3i(0, 0, 1), pc);
  let pGS = (s - P[P_DIV + i] * k.h * k.h) / 6.0;
  P[P_P + i] = pc + (pGS - pc) * sp.omega;
}

var<workgroup> wgMax: atomic<u32>;
@compute @workgroup_size(8, 8, 4)
fn project(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrickU(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  if (li == 0u) { atomicStore(&wgMax, 0u); }
  workgroupBarrier();
  var vm = 0.0;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    let bits = bitsOf(slot, cell);
    if ((bits & 1u) != 0u) { continue; }   // (forces stored 0 there)
    let pc = P[P_P + i];
    let g = vec3f(pAt(k, bits, 4u, c + vec3i(1, 0, 0), pc) - pAt(k, bits, 2u, c - vec3i(1, 0, 0), pc),
                  pAt(k, bits, 16u, c + vec3i(0, 1, 0), pc) - pAt(k, bits, 8u, c - vec3i(0, 1, 0), pc),
                  pAt(k, bits, 64u, c + vec3i(0, 0, 1), pc) - pAt(k, bits, 32u, c - vec3i(0, 0, 1), pc));
    var u = unV(V[V_VEL0 + i]).xyz - g * (0.5 * k.dt / k.h);
    if ((bits & 2u) != 0u) { u.x = max(u.x, 0.0); }  if ((bits & 4u) != 0u) { u.x = min(u.x, 0.0); }
    if ((bits & 8u) != 0u) { u.y = max(u.y, 0.0); }  if ((bits & 16u) != 0u) { u.y = min(u.y, 0.0); }
    if ((bits & 32u) != 0u) { u.z = max(u.z, 0.0); } if ((bits & 64u) != 0u) { u.z = min(u.z, 0.0); }
    V[V_VEL0 + i] = paV(vec4f(u, 0.0));
    vm = max(vm, max(abs(u.x), max(abs(u.y), abs(u.z))));
  }
  atomicMax(&wgMax, bitcast<u32>(vm));
  workgroupBarrier();
  if (li == 0u) { M[k.m + K_VMAX] = atomicLoad(&wgMax); }
}

@compute @workgroup_size(8, 8, 4)
fn advectScalars(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrick(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  let fl = M[k.m + K_FLAGS];
  if ((fl & F_ACT) == 0u) { return; }
  let kinds = (fl & F_KINDS) != 0u;
  let s = k.dt / k.h; let expanding = sp.numExpand > 0u && (M[k.m + K_EM0] | M[k.m + K_EM1]) != 0u;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    if ((bitsOf(slot, cell) & 1u) != 0u) { S[S_DEN1 + i] = 0u; continue; }
    let u = unV(V[V_VEL0 + i]).xyz;
    let gB = vec3f(c) + 0.5 - clamp(u * s, vec3f(-MAX_TRACE), vec3f(MAX_TRACE));
    let hat = sampleDen(S_DEN0, k, gB);
    let uB = sampleVel(V_VEL0, k, gB);
    let back = sampleDen(S_DEN0, k, gB + clamp(uB * s, vec3f(-MAX_TRACE), vec3f(MAX_TRACE))).v;
    var phi = hat.v + 0.5 * (unpack2x16float(S[S_DEN0 + i]) - back);
    phi = max(clamp(phi, hat.mn, hat.mx), vec2f(0.0));
    if (expanding) { phi.x *= exp(-min(sourceExpansion(k, worldP(k, c)) * sp.dt, MAX_DIV_DT)); }
    S[S_DEN1 + i] = pack2x16float(phi);
    if (kinds) { V[V_CURL + i].x = pack4x8unorm(sampleKind(k, gB)); }   // (parked till injectDecay in the half of the curl's record nobody reads again: a neighbour's forces take only |curl|, in .y)
  }
}

var<workgroup> wgLo: array<atomic<i32>, 3>;
var<workgroup> wgHi: array<atomic<i32>, 3>;
@compute @workgroup_size(8, 8, 4)
fn injectDecay(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  let slot = openBrickU(wid.x, li);
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  if (li == 0u) { wgWord = M[k.m + K_FLAGS]; }
  if (li < 3u) { atomicStore(&wgLo[li], 8); atomicStore(&wgHi[li], -1); }
  if (li == 3u) { atomicStore(&wgMax, 0u); atomicStore(&wgKind, 0u); }
  let fl = workgroupUniformLoad(&wgWord);
  if ((fl & F_ACT) == 0u) { return; }
  var eps = bitcast<f32>(M[M_EPS]); var extra = bitcast<f32>(M[M_DECAY]); let thin0 = bitcast<f32>(M[M_THIN]); var thin = thin0; let open = M[k.m + K_OPEN];
  let far = farOf(k.l, k.b);
  if (far > 0.0) {   // out of sight the ceiling starts at half the fill, bites up to three times as hard and calls four times the density thin
    let s = smoothstep(sp.softLo * (1.0 - 0.5 * far), sp.softHi * (1.0 - 0.35 * far), bitcast<f32>(M[M_USED]));
    eps = mix(sp.flushEps, max(sp.softEps, sp.flushEps), s * s); extra = sp.thinDecay + sp.softDecay * s * (1.0 + 2.0 * far); thin = thin0 * (1.0 + 3.0 * far * s);
  }
  let eps0 = eps; var epsT = eps; var cool = 0.0;
  if (k.l == 1u) { cool = sp.fineDecay; extra += cool; eps = max(eps, sp.fineEps); epsT = max(epsT, sp.fineHeat); }   // (THE FINE LATTICE LETS GO)
  var lo = vec3i(8); var hi = vec3i(-1); var dm = 0.0; let kinds = (fl & F_KINDS) != 0u; var any = 0u;
  for (var z = 0; z < 8; z += 4) {
    let c = vec3i(lid) + vec3i(0, 0, z); let cell = cidx(c); let i = slot * 512u + cell;
    if ((bitsOf(slot, cell) & 1u) != 0u) { S[S_DEN0 + i] = 0u; continue; }
    var v = unpack2x16float(S[S_DEN1 + i]);
    var kd = vec4f(0.0); if (kinds) { kd = unpack4x8unorm(V[V_CURL + i].x); }
    // (the pool's soft ceiling: as it fills, THIN smoke goes faster — the body of a plume is untouched, its faint skirts give their bricks back)
    var faint = 1.0 - smoothstep(0.0, thin, v.x);
    if (k.l == 1u && sp.fineKeep > 0.0) { faint *= 1.0 - smoothstep(0.5 * sp.fineKeep, sp.fineKeep, v.y); }   // (hot gas on the fine lattice is not let go: THE FINE LATTICE LETS GO)
    v.x *= exp(-(sp.densDecay + extra * faint) * k.dt);
    v.y *= exp(-(sp.tempDecay + cool * faint) * k.dt);
    let Pw = worldP(k, c); var fed = false;
    for (var w = 0u; w < 2u; w++) {
      var em = M[k.m + K_EM0 + w];
      while (em != 0u) {
        let e = sp.emitters[countTrailingZeros(em) + 32u * w]; em &= em - 1u;
        let d = Pw - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
        if (r2 > 9.0) { continue; }
        let g = exp(-r2);
        let n = fract(sin(dot(vec3f((k.b * 8 + c) & vec3i(63)) + sp.time * 3.1, vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
        let add = e.density * g * sp.dt * (0.75 + 0.5 * n);
        if (kinds && add > 0.0) { kd = mix(kd, unpack4x8unorm(e.kind), add / (v.x + add)); }
        v.x += add;
        v.y += e.temperature * g * sp.dt; fed = true;
      }
    }
    // an OPEN face (the world's edge, or the pool refused the brick beyond): the old boxes' dissipation band, only there. A brick with smoke normally has all its neighbours and never runs this.
    if (open != 0u) {
      var edge = 8.0;
      if ((open & 1u) != 0u) { edge = min(edge, f32(c.x)); }  if ((open & 2u) != 0u) { edge = min(edge, f32(7 - c.x)); }
      if ((open & 4u) != 0u) { edge = min(edge, f32(c.y)); }  if ((open & 8u) != 0u) { edge = min(edge, f32(7 - c.y)); }
      if ((open & 16u) != 0u) { edge = min(edge, f32(c.z)); } if ((open & 32u) != 0u) { edge = min(edge, f32(7 - c.z)); }
      let t = 1.0 - clamp(edge / 6.0, 0.0, 1.0); let t2 = t * t;
      v.x *= exp(-(4.0 * t + 26.0 * t2 * t2) * k.dt);
    }
    v = select(max(v, vec2f(0.0)), vec2f(0.0), v <= select(vec2f(eps, epsT), vec2f(eps0), fed));   // (a cell a source is feeding keeps the plain floor: a weak source lays down less than the fine lattice's in a step and would never build)
    let w16 = pack2x16float(v);
    S[S_DEN0 + i] = w16;
    if (kinds) { let kw = select(0u, pack4x8unorm(kd), v.x > 0.0); S[S_KIND + i] = kw; any |= kw; }
    if (w16 != 0u) { lo = min(lo, c); hi = max(hi, c); dm = max(dm, v.x); }
  }
  if (hi.x >= 0) {
    atomicMin(&wgLo[0], lo.x); atomicMin(&wgLo[1], lo.y); atomicMin(&wgLo[2], lo.z);
    atomicMax(&wgHi[0], hi.x); atomicMax(&wgHi[1], hi.y); atomicMax(&wgHi[2], hi.z); atomicMax(&wgMax, bitcast<u32>(dm));
    if (any != 0u) { atomicOr(&wgKind, select(F_KIND, F_KIND | F_TINT, (any >> 8u) != 0u)); }
  }
  workgroupBarrier();
  if (li == 0u) {
    let h0 = atomicLoad(&wgHi[0]); let sc = select(0u, 1u, h0 >= 0);
    M[k.m + K_FLAGS] = (fl & ~(F_SCALAR | F_KIND | F_TINT)) | select(0u, F_SCALAR, sc != 0u) | atomicLoad(&wgKind);
    var bx = 0u;
    if (sc != 0u) { bx = u32(atomicLoad(&wgLo[0])) | (u32(atomicLoad(&wgLo[1])) << 3u) | (u32(atomicLoad(&wgLo[2])) << 6u) | (u32(h0) << 9u) | (u32(atomicLoad(&wgHi[1])) << 12u) | (u32(atomicLoad(&wgHi[2])) << 15u) | (1u << 18u); }
    M[k.m + K_BOX] = bx; M[k.m + K_DMAX] = atomicLoad(&wgMax);
  }
}

// ------------------------------------------------------------------ publish: what the renderer and the guards' probe read
// A brick is RENDERABLE when it, or the one-cell shell round it, holds density (smoke.wgsl renderOccPack's rule and proof). Each renderable brick is copied into its slot of the render
// atlas with ONE CELL OF APRON from its neighbours — 10³ texels — so a hardware trilinear fetch anywhere inside the brick weighs exactly the cells the dense atlas would have, and
// two bricks that touch in the world need not touch in the atlas. The page texture says which slot (0 = nothing to fetch).
@group(2) @binding(7) var atlasOut: texture_storage_3d<rgba16float, write>;
@group(2) @binding(8) var pageOut: texture_storage_3d<r32uint, write>;
var<workgroup> wgHit: atomic<u32>;
override PUB_ALL: u32 = 0u;   // 1 = every live brick, the waiting ones too (a render-density row moved: smoke.ts refreshDomains)
@compute @workgroup_size(256)
fn publish(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  var slot = NONE;
  if (PUB_ALL != 0u) { if (li == 0u) { var t = NONE; if (wid.x < M[M_COUNT]) { t = M[M_LIST + wid.x]; } wgSlot = t; } slot = workgroupUniformLoad(&wgSlot); } else { slot = openBrickU(wid.x, li); }
  if (slot == NONE) { return; }
  let k = brickOf(slot);
  if (li == 0u) { atomicStore(&wgHit, 0u); }
  workgroupBarrier();
  if (li < 27u) {
    let n = M[k.m + K_NBR + li];
    if (n != 0u) {
      let d = vec3i(i32(li % 3u), i32((li / 3u) % 3u), i32(li / 9u)) - 1;
      if (boxNear(M[metaOf(n - 1u) + K_BOX], d, 1)) { atomicOr(&wgHit, 1u); }
    }
  }
  workgroupBarrier();
  if (li == 0u) { wgWord = atomicLoad(&wgHit); }
  let hit = workgroupUniformLoad(&wgWord) != 0u;
  if (li == 0u) {
    let fl = M[k.m + K_FLAGS];
    M[k.m + K_FLAGS] = select(fl & ~F_RENDER, fl | F_RENDER, hit);
    if (k.l == 1u) {
      textureStore(pageOut, k.b + vec3i(0, i32(sp.levels[1].texY), 0), vec4u(select(0u, slot + 1u, hit), 0u, 0u, 0u));
      if (hit) {   // tell the coarse page there is fine smoke somewhere in these coarse bricks (compose turns the stamp into bit 31)
        let r = sp.levels[1].voxel / sp.levels[0].voxel;
        let lo = vec3i(floor(vec3f(k.b) * r)); let hi = min(vec3i(floor(vec3f(k.b + 1) * r)), vec3i(sp.levels[0].dims) - 1);
        for (var z = lo.z; z <= hi.z; z++) { for (var y = lo.y; y <= hi.y; y++) { for (var x = lo.x; x <= hi.x; x++) { atomicStore(&A[A_FINE + pageIdx(0u, vec3i(x, y, z))], sp.stepNo); } } }
      }
    }
  }
  if (!hit) { return; }
  // a texel = (the density every reader takes: the solver's × its kind's render density, so those two rows act on smoke in the air · that density × (1 − tint), for the view march's dust look)
  let org = vec3i(i32(slot % ATLAS_X), i32((slot / ATLAS_X) % ATLAS_Y), i32(slot / (ATLAS_X * ATLAS_Y))) * 10 + 1;
  let kinds = (M[k.m + K_FLAGS] & F_KINDS) != 0u; let plain = select(sp.scaleCan, sp.scaleFx, k.l == 1u);
  for (var j = li; j < 1000u; j += 256u) {
    let c = vec3i(i32(j % 10u), i32((j / 10u) % 10u), i32(j / 100u)) - 1;
    let r = cellRef(k, vec3i(c.x, select(c.y, max(c.y, 0), k.b.y == 0), c.z));   // (under the lattice's bottom row: that row again, as aboveFloor samples it)
    var o = vec4f(0.0);
    if (r.x != 0u) {
      let at = (r.x - 1u) * 512u + r.y; let dt2 = unpack2x16float(S[S_DEN0 + at]); let d = dt2.x;
      if (kinds) { let kd = unpack4x8unorm(S[S_KIND + at]); o.x = d * mix(sp.scaleCan, sp.scaleFx, kd.x); o = vec4f(o.x, o.x * kd.yzw); } else { o.x = d * plain; }
      if (k.l == 1u) { o.w = dt2.y; }   // (a FINE brick's last channel is its HEAT, as the solver has it: nobody read that channel of a fine brick — smoke_read.wgsl spgFineHot, for a fire's flame)
    }
    textureStore(atlasOut, org + c, o);
  }
}

// the coarse page, dense (N0 texels, a few tens of µs): slot + 1 of a renderable coarse brick | bit 31 = fine smoke somewhere inside this coarse brick. One load tells a ray everything about 0.44 m of air.
// A workgroup is one MACRO cell of 4 × 2 × 4 bricks and leaves a word for it too (rows from MACRO_Y): bit x + 4 z + 16 y = that brick's page entry is not 0. One load tells a ray about 1.76 × 0.88 × 1.76 m.
var<workgroup> wgMacro: atomic<u32>;
@compute @workgroup_size(4, 2, 4)
fn compose(@builtin(global_invocation_id) gid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  if (li == 0u) { atomicStore(&wgMacro, 0u); }
  workgroupBarrier();
  let n = sp.levels[0].dims;
  if (all(gid < n)) {
    let i = (gid.z * n.y + gid.y) * n.x + gid.x;
    let s = atomicLoad(&A[A_PAGE + i]);
    var v = 0u;
    if (s != 0u && s != LOCK && (M[metaOf(s - 1u) + K_FLAGS] & F_RENDER) != 0u) { v = s; }
    let fs = atomicLoad(&A[A_FINE + i]);
    if (fs != 0u && sp.stepNo - fs < 5u) { v |= 0x80000000u; }   // (a fine brick that waits last said so up to four steps ago; the bit outliving the smoke by that costs a reader one page load)
    textureStore(pageOut, vec3i(i32(gid.x), i32(gid.y + sp.levels[0].texY), i32(gid.z)), vec4u(v, 0u, 0u, 0u));
    if (v != 0u) { atomicOr(&wgMacro, 1u << (lid.x | (lid.z << 2u) | (lid.y << 4u))); }
  }
  workgroupBarrier();
  if (li == 0u) { textureStore(pageOut, vec3i(i32(wid.x), MACRO_Y + i32(wid.y), i32(wid.z)), vec4u(atomicLoad(&wgMacro), 0u, 0u, 0u)); }
}
@compute @workgroup_size(4, 4, 4)
fn wipePage(@builtin(global_invocation_id) gid: vec3u) {
  if (any(gid >= textureDimensions(pageOut))) { return; }
  textureStore(pageOut, vec3i(gid), vec4u(0u));
}

// ------------------------------------------------------------------ boxes: ≤ 8 BOUNDS for the readers that clip rays before they march (never storage, never a limit on the smoke)
// The marchers, the froxel cull and the shadow rays start from `smoke: array<SmokeBound, 8>` (common.wgsl): boxes to clip against, bounds round wherever renderable bricks are:
// bricks are binned into plan tiles, each tile keeps the box of its bricks, and the tiles are merged greedily into at most four boxes a level. More plumes than boxes = looser boxes
// (rays walk some empty page entries), never lost smoke.
struct DomOut { origin: vec3f, voxel: f32, pad0: vec3u, live: u32, dims: vec3u, pad1: u32, pad2: f32, readSkip: f32, pad3: f32, pad4: f32 };   // = common.wgsl SmokeBound
@group(2) @binding(9) var<storage, read_write> domOut: array<DomOut, 8>;
@group(2) @binding(10) var<storage, read_write> statsOut: array<u32>;
var<workgroup> tl: array<atomic<u32>, NTILES * 6u>;
fn vol(lo: vec3i, hi: vec3i) -> f32 { let d = vec3f(hi - lo + 1); return d.x * d.y * d.z; }
@compute @workgroup_size(256)
fn boxes(@builtin(local_invocation_index) li: u32) {
  for (var i = li; i < NTILES * 6u; i += 256u) { atomicStore(&tl[i], select(0u, 0xffffu, (i % 6u) < 3u)); }
  workgroupBarrier();
  let n = M[M_COUNT];
  for (var i = li; i < n; i += 256u) {
    let m = metaOf(M[M_LIST + i]);
    if ((M[m + K_FLAGS] & F_RENDER) == 0u) { continue; }
    let cw = M[m + K_COORD]; let L = sp.levels[coordL(cw)]; let b = vec3u(coordB(cw));
    let tw = (L.dims.x + L.tile - 1u) / L.tile;
    let t = (L.tileBase + (b.z / L.tile) * tw + b.x / L.tile) * 6u;
    atomicMin(&tl[t], b.x); atomicMin(&tl[t + 1u], b.y); atomicMin(&tl[t + 2u], b.z);
    atomicMax(&tl[t + 3u], b.x); atomicMax(&tl[t + 4u], b.y); atomicMax(&tl[t + 5u], b.z);
  }
  workgroupBarrier();
  if (li != 0u) { return; }
  var lo: array<vec3i, 8>; var hi: array<vec3i, 8>; var cnt = array<u32, 2>(0u, 0u);
  for (var l = 0u; l < 2u; l++) {
    let L = sp.levels[l];
    let nt = ((L.dims.x + L.tile - 1u) / L.tile) * ((L.dims.z + L.tile - 1u) / L.tile);
    for (var t = 0u; t < nt; t++) {
      let o = (L.tileBase + t) * 6u;
      let a = vec3i(i32(atomicLoad(&tl[o])), i32(atomicLoad(&tl[o + 1u])), i32(atomicLoad(&tl[o + 2u])));
      if (a.x == 0xffff) { continue; }
      let z = vec3i(i32(atomicLoad(&tl[o + 3u])), i32(atomicLoad(&tl[o + 4u])), i32(atomicLoad(&tl[o + 5u])));
      var best = -1; var cost = 1e30;
      for (var j = 0u; j < cnt[l]; j++) {
        let q = l * 4u + j;
        if (all(a <= hi[q] + 1) && all(z >= lo[q] - 1)) { best = i32(q); cost = -1.0; break; }   // touches a box we have: it grows
        let g = vol(min(lo[q], a), max(hi[q], z)) - vol(lo[q], hi[q]);
        if (g < cost) { cost = g; best = i32(q); }
      }
      if (cost >= 0.0 && cnt[l] < 4u) { let q = l * 4u + cnt[l]; lo[q] = a; hi[q] = z; cnt[l]++; continue; }
      lo[best] = min(lo[best], a); hi[best] = max(hi[best], z);
    }
  }
  for (var q = 0u; q < 8u; q++) {
    let l = q >> 2u; let on = (q & 3u) < cnt[l]; let h = sp.levels[l].voxel;
    var d: DomOut;
    d.voxel = h; d.live = select(0u, 1u, on); d.readSkip = sp.readSkip;   // (record 0's: the readers' switch for hopping over empty air, smoke_read.wgsl spgSkip)
    if (on) { d.origin = vec3f(lo[q]) * (8.0 * h); d.dims = vec3u(hi[q] - lo[q] + 1) * 8u; }
    domOut[q] = d;
    statsOut[16u + q * 2u] = select(0u, u32(lo[q].x) | (u32(lo[q].y) << 10u) | (u32(lo[q].z) << 20u) | 0x80000000u, on);
    statsOut[17u + q * 2u] = select(0u, u32(hi[q].x) | (u32(hi[q].y) << 10u) | (u32(hi[q].z) << 20u), on);
  }
  statsOut[0] = n; statsOut[1] = atomicLoad(&A[C_SCALAR]); statsOut[2] = atomicLoad(&A[C_RENDER]); statsOut[3] = atomicLoad(&A[C_FAIL]);
  statsOut[4] = atomicLoad(&A[C_FREE]); statsOut[5] = atomicLoad(&A[C_VMAX]); statsOut[6] = atomicLoad(&A[C_ALLOC]); statsOut[7] = atomicLoad(&A[C_FREED]);
  statsOut[8] = sp.stepNo; statsOut[9] = cnt[0] + cnt[1]; statsOut[10] = atomicLoad(&A[C_BAKED]); statsOut[11] = atomicLoad(&A[C_FINE]); statsOut[12] = M[M_EPS]; statsOut[13] = atomicLoad(&A[C_ACT]); statsOut[14] = M[M_NSTEP]; statsOut[15] = atomicLoad(&A[C_WORK]); statsOut[32] = M[M_THIN]; statsOut[33] = atomicLoad(&A[C_TINT]); statsOut[34] = atomicLoad(&A[C_LVL1]); statsOut[35] = atomicLoad(&A[C_HELD]);
}
