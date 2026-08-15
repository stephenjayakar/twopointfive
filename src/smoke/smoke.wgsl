// Eulerian smoke solver on a pool of fixed-size domains stacked along Z in atlas textures.
// Each dispatch processes one domain (dom.zOff selects the slab). Velocity in m/s, stored at cell centers.

struct SimParams {
  dims: vec3u, numEmitters: u32,
  turbulence: f32, dt: f32, time: f32, buoyancy: f32,
  weight: f32, vortConf: f32, velDamp: f32, densDecay: f32,
  tempDecay: f32, atlasDepth: f32, windX: f32, windZ: f32,
  numExpand: u32, omega: f32, brickSkip: u32, flushEps: f32, // emitters [0, numExpand) are the ones with expand > 0 (packed first so the two per-cell expansion loops stay short); omega = SOR factor for the red-black pressure sweeps;
                                                              // brickSkip: the scalar passes return at once in bricks outside the step's active set (see `occupancy`); flushEps: density/temperature at or below it is stored as exactly 0
  emitters: array<Emitter, 32>,
};
struct Emitter {
  pos: vec3f, radius: f32,        // pos in domain-local meters
  dir: vec3f, speed: f32,
  density: f32, temperature: f32, domain: u32, mode: f32,   // mode 1 = radial burst
  push: f32, expand: f32, epad0: f32, epad1: f32,           // push: drag rate (1/s) toward dir*speed; expand: divergence (1/s) the projection must leave in the field at the core
};
struct DomainParams { zOff: u32, index: u32, floorClosed: u32, pad: u32, origin: vec3f, voxel: f32 };

@group(0) @binding(0) var<uniform> sim: SimParams;
@group(0) @binding(1) var<uniform> dom: DomainParams;

// Ceilings on how much volume change one step may be asked for (ported with the expansion source from twopointfive's fluid.wgsl):
// SRC_DIV_DT caps Σexpand·dt per cell — applied identically where the Poisson RHS is built (divergence) and where density pays for
// the expansion (advectScalars), so the two can never disagree; MAX_DIV_DT is only a backstop on the exponent.
const SRC_DIV_DT: f32 = 1.6;
const MAX_DIV_DT: f32 = 2.0;

fn inDomain(c: vec3i) -> bool { return all(c >= vec3i(0)) && all(c < vec3i(sim.dims)); }
fn atlas(c: vec3i) -> vec3i { return c + vec3i(0, 0, i32(dom.zOff)); }
fn cellCenterLocal(c: vec3i) -> vec3f { return (vec3f(c) + 0.5) * dom.voxel; }         // domain-local meters
fn atlasUVW(localMeters: vec3f) -> vec3f {
  // local position (m) → normalized atlas coords, clamped inside this domain's slab
  var g = localMeters / dom.voxel;                                                          // in voxels
  g = clamp(g, vec3f(0.5), vec3f(sim.dims) - 0.5);
  let a = vec3f(g.x, g.y, g.z + f32(dom.zOff));
  return a / vec3f(f32(sim.dims.x), f32(sim.dims.y), sim.atlasDepth);
}

// Expansion S(P) the sources ASK for at a domain-local point: Σ expand·exp(-r²/R²) over this domain's expanding emitters, clamped.
// Why a divergence source and not a radial velocity splat: the projection's whole job is deleting divergence, so a radial `dir`
// splat (mode 1) is largely removed in the step it is applied and the puff appears rather than expands. Solving ∇²p = div v − S
// instead makes the pressure solve itself produce the outward push, consistent with obstacles and open faces (a burst in a corner
// vents the only way it can). S depends on the uniform block and position only — never on the velocity or density it produces —
// so it cannot feed back on itself, and it is exactly zero wherever nothing is expanding (legacy emitters all have expand = 0).
fn sourceExpansion(P: vec3f) -> f32 {
  var s = 0.0;
  for (var i = 0u; i < sim.numExpand; i++) {
    let e = sim.emitters[i];
    if (e.domain != dom.index) { continue; }
    let d = P - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
    if (r2 > 9.0) { continue; }
    s += e.expand * exp(-r2);
  }
  return min(s, SRC_DIV_DT / sim.dt);
}

// ------------------------------------------------------------------ obstacle bake (uses scene group 1 here)
@group(1) @binding(0) var obstOut: texture_storage_3d<r32float, write>;
struct BoxGeoS { c: vec3f, rot: u32, h: vec3f, flags: u32 };
@group(1) @binding(1) var<storage, read> sboxGeo: array<BoxGeoS>;
@group(1) @binding(2) var<storage, read> sgridCells: array<u32>;
@group(1) @binding(3) var<storage, read> sgridItems: array<u32>;
struct SceneInfoS { numBoxes: u32, numGlobals: u32, gridW: u32, gridH: u32, globals: array<vec4u, 4>, numCapsules: u32, numChars: u32, capsPerChar: u32, pad0: u32, charBounds: array<vec4f, 8>, globalsY: array<vec4f, 8>, grid: vec4f, globalsB: array<vec4f, 32>, glassInfo: vec4u, glass: array<vec4f, 96> };   // = SceneInfo in render/shaders/common.wgsl (boxes.ts infoData): the bake reads the globals, the grid and — glass experiment — the pane table
@group(1) @binding(4) var<uniform> sscene: SceneInfoS;
// The SEALING DOOR LEAVES (smoke.ts writeSealers, W8.2): leaves are Dynamic boxes, which the grid loop below must skip (a man walking through the plume would bake a
// man-shaped hole into the field for the domain's life), so the ones that seal a doorway — the CPU's SoundSeal rule: within 0.3 rad of shut — come in through this
// table instead and are baked solid at the pose they stand at; smoke.ts re-bakes the domain when one shuts, opens or moves. info.x = count; per leaf (c.xyz, cos yaw),
// (h.xyz, sin yaw) — the pane table's convention.
struct SealS { info: vec4u, boxes: array<vec4f, 32> };
@group(1) @binding(5) var<uniform> sseal: SealS;

fn insideBox(p: vec3f, b: BoxGeoS) -> bool {
  let cs = unpack2x16float(b.rot);
  let d = p - b.c;
  let l = vec3f(cs.x * d.x - cs.y * d.z, d.y, cs.y * d.x + cs.x * d.z);
  return all(abs(l) <= b.h + vec3f(0.01));
}

@compute @workgroup_size(4, 4, 4)
fn bakeObstacles(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  let p = dom.origin + cellCenterLocal(c);
  var solid = 0.0;
  for (var g = 0u; g < sscene.numGlobals; g++) {
    let bi = sscene.globals[g >> 2u][g & 3u];
    let b = sboxGeo[bi];
    if ((b.flags & 10u) == 0u && insideBox(p, b)) { solid = 1.0; }
  }
  let gw = i32(sscene.gridW); let gh = i32(sscene.gridH);
  let cell = vec2i(floor(p.xz / GRID_CELL));
  if (solid == 0.0 && cell.x >= 0 && cell.y >= 0 && cell.x < gw && cell.y < gh) {
    let ci = u32(cell.y * gw + cell.x);
    let start = sgridCells[ci]; let end = sgridCells[ci + 1u];
    for (var k = start; k < end; k++) {
      let b = sboxGeo[sgridItems[k]];
      if ((b.flags & 10u) != 0u) { continue; }        // skip NoShadow decals (2) and Dynamic (8)
      if (insideBox(p, b)) { solid = 1.0; break; }
    }
  }
  // glass panes (experiment E3): they are in no trace grid, so take them from the scene's pane table (glassInfo.x is 0 with the experiment off or every
  // pane broken — an empty opening then, as before). A 12 mm sheet is thinner than a voxel: fatten its thin axis to just over half a voxel each way so
  // the sheet bakes as one closed layer of cells and the plume pools against the glass instead of seeping through between cell centres. Baked once per
  // domain like every obstacle: a pane broken beside a live plume opens for the NEXT domain, as a door does.
  for (var k = 0u; solid == 0.0 && k < min(sscene.glassInfo.x, 32u); k++) {
    let g0 = sscene.glass[k * 3u]; let g1 = sscene.glass[k * 3u + 1u];
    let d = p - g0.xyz;
    let l = vec3f(g0.w * d.x - g1.w * d.z, d.y, g1.w * d.x + g0.w * d.z);           // (cos, sin) exactly as insideBox unpacks them
    let fat = 0.55 * dom.voxel;
    let hh = vec3f(select(g1.x, max(g1.x, fat), g1.x < g1.z), g1.y, select(max(g1.z, fat), g1.z, g1.x < g1.z));   // fatten whichever of x / z is the thin one
    if (all(abs(l) <= hh + vec3f(0.01))) { solid = 1.0; }
  }
  // door leaves sealing a doorway (see SealS above): a 5 cm leaf is a hair under the coarse voxel and may stand yawed up to 17° in its frame, so its thin axis is
  // fattened to 0.6 of a voxel each way — face-adjacent fluid cells straddling a plane always have a centre within half a voxel of it, so at ≥ 0.5 no six-connected
  // path (the divergence / pressure stencil) crosses the sheet whatever its angle; the plume pools against the shut door and goes through the day it opens
  for (var k = 0u; solid == 0.0 && k < min(sseal.info.x, 16u); k++) {
    let s0 = sseal.boxes[k * 2u]; let s1 = sseal.boxes[k * 2u + 1u];
    let d = p - s0.xyz;
    let l = vec3f(s0.w * d.x - s1.w * d.z, d.y, s1.w * d.x + s0.w * d.z);
    let fat = 0.6 * dom.voxel;
    let hh = vec3f(select(s1.x, max(s1.x, fat), s1.x < s1.z), s1.y, select(max(s1.z, fat), s1.z, s1.x < s1.z));
    if (all(abs(l) <= hh + vec3f(0.01))) { solid = 1.0; }
  }
  if (dom.floorClosed != 0u && c.y == 0 && dom.origin.y < 0.02) { solid = max(solid, 0.0); }
  textureStore(obstOut, atlas(c), vec4f(solid, 0.0, 0.0, 0.0));
}

// ------------------------------------------------------------------ shared bindings for the sim kernels (group 1)
@group(1) @binding(10) var samp: sampler;
@group(1) @binding(11) var srcVel: texture_3d<f32>;
@group(1) @binding(12) var srcDens: texture_3d<f32>;
@group(1) @binding(13) var srcCurl: texture_3d<f32>;
@group(1) @binding(14) var srcP: texture_3d<f32>;
@group(1) @binding(15) var srcDiv: texture_3d<f32>;
@group(1) @binding(16) var srcObst: texture_3d<f32>;
@group(1) @binding(20) var dstVel: texture_storage_3d<rgba16float, write>;
@group(1) @binding(21) var dstDens: texture_storage_3d<rgba16float, write>;
@group(1) @binding(22) var dstCurl: texture_storage_3d<rgba16float, write>;
@group(1) @binding(23) var dstP: texture_storage_3d<r32float, write>;
@group(1) @binding(24) var dstDiv: texture_storage_3d<r32float, write>;
@group(1) @binding(25) var<storage, read_write> massOut: array<atomic<u32>>;
// brick occupancy (see `occupancy` / `dilate` below): the domain cut into bricks of BRICK³ cells = 2×2×2 workgroups of the 4×4×4 kernels, so a
// whole workgroup reads one word and retires together. BRICK (8), BRICKS_PER_DOMAIN (512), OCC_WORDS (512 bits = 16 words) and BRICK_STAT_WORDS
// are prepended by smoke.ts from its DIMS.
@group(1) @binding(26) var<storage, read_write> brickRaw: array<vec2u>;   // [domain][brick] this step: x = bit 0 density/temperature present, bit 1 velocity present; y = bitcast max |velocity component| (m/s)
@group(1) @binding(27) var<storage, read_write> brickAct: array<u32>;     // [domain][brick]: bit 0 = the scalar passes (advectScalars, injectDecay) must run here this step
@group(1) @binding(28) var<storage, read_write> brickStats: array<u32>;   // [domain][BRICK_STAT_WORDS]: active bricks, bricks holding scalar, bricks holding velocity, bitcast vmax, bricks the renderer must fetch in, 3 spare — read back for the HUD
@group(1) @binding(29) var<storage, read_write> brickRgn: array<u32>;     // [domain][brick]: 27-bit region mask of where the brick holds density after this step (renderOccRegions)
@group(1) @binding(30) var<storage, read_write> renderOcc: array<u32>;    // [domain][OCC_WORDS]: bit b = the renderer must fetch in brick b (it or its one-cell shell holds density) — the scene shaders bind this
                                                                          // same buffer read-only as `smokeOcc` (common.wgsl smokeDensityAt); written by renderOccPack, last kernel of every domain step;
                                                                          // then [OCC_WORDS × 8 + domain] = the box of the domain's set bricks (common.wgsl smokeSubWord: the shadow-ray transmittance's reject)

fn brickGrid() -> vec3u { return sim.dims / BRICK; }
fn brickIndex(b: vec3u) -> u32 { let n = brickGrid(); return dom.index * (n.x * n.y * n.z) + (b.z * n.y + b.y) * n.x + b.x; }
// True when a scalar pass may return without touching cell c: skipping is on and c's brick is outside this step's active set. All 64
// invocations of a 4³ workgroup share a brick, so the branch is taken by whole workgroups.
fn brickIdle(c: vec3i) -> bool { return sim.brickSkip != 0u && (brickAct[brickIndex(vec3u(c) / BRICK)] & 1u) == 0u; }

fn obstAt(c: vec3i) -> f32 {
  if (!inDomain(c)) {
    // outside the domain: floor is solid when the domain sits on the ground, everything else open
    if (c.y < 0 && dom.floorClosed != 0u) { return 1.0; }
    return 0.0;
  }
  return textureLoad(srcObst, atlas(c), 0).x;
}
fn velAt(c: vec3i) -> vec3f {
  if (!inDomain(c)) { let cc = clamp(c, vec3i(0), vec3i(sim.dims) - 1); return textureLoad(srcVel, atlas(cc), 0).xyz; }
  return textureLoad(srcVel, atlas(c), 0).xyz;
}
fn pAt(c: vec3i, pc: f32) -> f32 {
  if (!inDomain(c)) { if (c.y < 0 && dom.floorClosed != 0u) { return pc; } return 0.0; }  // open boundary: p = 0
  if (textureLoad(srcObst, atlas(c), 0).x > 0.5) { return pc; }                            // Neumann at solids
  return textureLoad(srcP, atlas(c), 0).x;
}

// ------------------------------------------------------------------ advect velocity (semi-Lagrangian)
@compute @workgroup_size(4, 4, 4)
fn advectVel(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  if (obstAt(c) > 0.5) { textureStore(dstVel, atlas(c), vec4f(0.0)); return; }
  let u = textureLoad(srcVel, atlas(c), 0).xyz;
  let p = cellCenterLocal(c) - u * sim.dt;
  var v = textureSampleLevel(srcVel, samp, atlasUVW(p), 0.0).xyz;
  v *= exp(-sim.velDamp * sim.dt);
  textureStore(dstVel, atlas(c), vec4f(v, 0.0));
}

// ------------------------------------------------------------------ curl
@compute @workgroup_size(4, 4, 4)
fn curl(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  let L = velAt(c - vec3i(1, 0, 0)); let R = velAt(c + vec3i(1, 0, 0));
  let D = velAt(c - vec3i(0, 1, 0)); let U = velAt(c + vec3i(0, 1, 0));
  let B = velAt(c - vec3i(0, 0, 1)); let F = velAt(c + vec3i(0, 0, 1));
  let h = 0.5 / dom.voxel;
  let w = vec3f((U.z - D.z) - (F.y - B.y), (F.x - B.x) - (R.z - L.z), (R.y - L.y) - (U.x - D.x)) * h;
  textureStore(dstCurl, atlas(c), vec4f(w, length(w)));
}

// ------------------------------------------------------------------ forces: buoyancy, vorticity confinement, emitters
@compute @workgroup_size(4, 4, 4)
fn forces(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  if (obstAt(c) > 0.5) { textureStore(dstVel, atlas(c), vec4f(0.0)); return; }
  var u = textureLoad(srcVel, atlas(c), 0).xyz;
  let dT = textureLoad(srcDens, atlas(c), 0).xy;   // density, temperature
  // buoyancy
  u.y += (sim.buoyancy * dT.y - sim.weight * dT.x) * sim.dt;
  u += vec3f(sim.windX, 0.0, sim.windZ) * sim.dt;
  // vorticity confinement
  let wC = textureLoad(srcCurl, atlas(c), 0);
  let cl = clamp(c - vec3i(1, 0, 0), vec3i(0), vec3i(sim.dims) - 1); let cr = clamp(c + vec3i(1, 0, 0), vec3i(0), vec3i(sim.dims) - 1);
  let cd = clamp(c - vec3i(0, 1, 0), vec3i(0), vec3i(sim.dims) - 1); let cu = clamp(c + vec3i(0, 1, 0), vec3i(0), vec3i(sim.dims) - 1);
  let cb = clamp(c - vec3i(0, 0, 1), vec3i(0), vec3i(sim.dims) - 1); let cf = clamp(c + vec3i(0, 0, 1), vec3i(0), vec3i(sim.dims) - 1);
  let grad = vec3f(textureLoad(srcCurl, atlas(cr), 0).w - textureLoad(srcCurl, atlas(cl), 0).w,
                   textureLoad(srcCurl, atlas(cu), 0).w - textureLoad(srcCurl, atlas(cd), 0).w,
                   textureLoad(srcCurl, atlas(cf), 0).w - textureLoad(srcCurl, atlas(cb), 0).w);
  let gl = length(grad);
  if (gl > 1e-5) {
    let Nn = grad / gl;
    u += sim.vortConf * dom.voxel * cross(Nn, wC.xyz) * sim.dt;
  }
  // cheap procedural turbulence proportional to local density (breaks up laminar plumes)
  let P = cellCenterLocal(c);
  if (sim.turbulence > 0.0 && dT.x > 0.01) {
    let q = (dom.origin + P) * 4.7 + vec3f(0.0, -sim.time * 0.9, sim.time * 0.35);
    let n = vec3f(sin(q.y * 1.7 + sin(q.z * 2.3)) , sin(q.z * 1.3 + sin(q.x * 2.9)) * 0.5, sin(q.x * 1.9 + sin(q.y * 2.1)));
    u += n * sim.turbulence * clamp(dT.x, 0.0, 1.5) * sim.dt;
  }
  // emitters: blend velocity toward the jet velocity inside the splat. e.push is the drag RATE (1/s): at the core the medium relaxes toward
  // dir*speed with time constant 1/push (25 → the old fixed blend; a muzzle jet at 90 imposes its velocity inside one 60 Hz step, a
  // lingering wisp at 4 barely nudges the air it sits in). Falls off with the same gaussian as the density splat.
  for (var i = 0u; i < sim.numEmitters; i++) {
    let e = sim.emitters[i];
    if (e.domain != dom.index || e.push <= 0.0) { continue; }
    let d = P - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
    if (r2 > 9.0) { continue; }
    let g = exp(-r2);
    var jet = e.dir * e.speed;
    if (e.mode > 0.5) { jet = normalize(d + e.dir * 0.02 + vec3f(1e-4)) * e.speed; }   // blast: outward from the centre (slightly biased forward)
    u = mix(u, jet, clamp(g * e.push * sim.dt, 0.0, 1.0));
  }
  // ---- WIND (game/wind.ts → smoke.ts setWind → wind_force.wgsl in the prelude): the supply vents, the storm outdoors, the gust through an open exterior door relax
  // this cell's air toward their analytic field inside their support — one branch and nothing else when no source overlaps this domain (the per-domain mask)
  u = windForce(u, dom.origin + P, dom.index, sim.dt);
  // clamp for stability
  let sp = length(u); if (sp > 11.0) { u *= 11.0 / sp; }   // (was 8: with 64-cell domains a bore jet may carry further before the CFL-ish clamp catches it)
  textureStore(dstVel, atlas(c), vec4f(u, 0.0));
}

// ------------------------------------------------------------------ divergence
@compute @workgroup_size(4, 4, 4)
fn divergence(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  var L = velAt(c - vec3i(1, 0, 0)).x; var R = velAt(c + vec3i(1, 0, 0)).x;
  var D = velAt(c - vec3i(0, 1, 0)).y; var U = velAt(c + vec3i(0, 1, 0)).y;
  var B = velAt(c - vec3i(0, 0, 1)).z; var F = velAt(c + vec3i(0, 0, 1)).z;
  // solid neighbors have zero velocity
  if (obstAt(c - vec3i(1, 0, 0)) > 0.5) { L = 0.0; } if (obstAt(c + vec3i(1, 0, 0)) > 0.5) { R = 0.0; }
  if (obstAt(c - vec3i(0, 1, 0)) > 0.5) { D = 0.0; } if (obstAt(c + vec3i(0, 1, 0)) > 0.5) { U = 0.0; }
  if (obstAt(c - vec3i(0, 0, 1)) > 0.5) { B = 0.0; } if (obstAt(c + vec3i(0, 0, 1)) > 0.5) { F = 0.0; }
  var div = ((R - L) + (U - D) + (F - B)) * (0.5 / dom.voxel);
  // expanding sources: the pressure solve (rbgs) solves ∇²p = (what is stored here) and project subtracts ∇p, so storing div − S leaves exactly div v = S
  // in the projected field — the cells around a detonation really are pushed apart, by the pressure solve, respecting solids/open faces
  if (sim.numExpand > 0u && obstAt(c) < 0.5) { div -= sourceExpansion(cellCenterLocal(c)); }
  textureStore(dstDiv, atlas(c), vec4f(div, 0.0, 0.0, 0.0));
}

// ------------------------------------------------------------------ pressure solve: red-black Gauss-Seidel + SOR
// Two ping-ponged half sweeps (RB_COLOR 0 then 1): a cell of this sweep's colour takes the fresh average of its six neighbours
// (all of the other colour, i.e. exactly the values the previous half sweep wrote), relaxed by omega; cells of the other colour
// are carried over unchanged. One red+black pair converges like ~2 Gauss-Seidel iterations, and with omega ~1.7 the residual
// after 4 pairs (8 dispatches) is below what the original 20 Jacobi dispatches reached. Boundaries (pAt): open faces p = 0,
// Neumann (mirror the centre value) at solids and the closed floor.
override RB_COLOR: u32 = 0u;
@compute @workgroup_size(4, 4, 4)
fn rbgs(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  let pc = textureLoad(srcP, atlas(c), 0).x;
  if (u32((c.x + c.y + c.z) & 1) != RB_COLOR) { textureStore(dstP, atlas(c), vec4f(pc, 0.0, 0.0, 0.0)); return; }
  let div = textureLoad(srcDiv, atlas(c), 0).x;
  let s = pAt(c - vec3i(1, 0, 0), pc) + pAt(c + vec3i(1, 0, 0), pc) + pAt(c - vec3i(0, 1, 0), pc) + pAt(c + vec3i(0, 1, 0), pc) + pAt(c - vec3i(0, 0, 1), pc) + pAt(c + vec3i(0, 0, 1), pc);
  let h2 = dom.voxel * dom.voxel;
  let pGS = (s - div * h2) / 6.0;
  textureStore(dstP, atlas(c), vec4f(pc + (pGS - pc) * sim.omega, 0.0, 0.0, 0.0));
}

// ------------------------------------------------------------------ project
@compute @workgroup_size(4, 4, 4)
fn project(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  if (obstAt(c) > 0.5) { textureStore(dstVel, atlas(c), vec4f(0.0)); return; }
  let pc = textureLoad(srcP, atlas(c), 0).x;
  let gx = pAt(c + vec3i(1, 0, 0), pc) - pAt(c - vec3i(1, 0, 0), pc);
  let gy = pAt(c + vec3i(0, 1, 0), pc) - pAt(c - vec3i(0, 1, 0), pc);
  let gz = pAt(c + vec3i(0, 0, 1), pc) - pAt(c - vec3i(0, 0, 1), pc);
  var u = textureLoad(srcVel, atlas(c), 0).xyz - vec3f(gx, gy, gz) * (0.5 / dom.voxel);
  // no flow into solid neighbors
  if (obstAt(c - vec3i(1, 0, 0)) > 0.5) { u.x = max(u.x, 0.0); } if (obstAt(c + vec3i(1, 0, 0)) > 0.5) { u.x = min(u.x, 0.0); }
  if (obstAt(c - vec3i(0, 1, 0)) > 0.5) { u.y = max(u.y, 0.0); } if (obstAt(c + vec3i(0, 1, 0)) > 0.5) { u.y = min(u.y, 0.0); }
  if (obstAt(c - vec3i(0, 0, 1)) > 0.5) { u.z = max(u.z, 0.0); } if (obstAt(c + vec3i(0, 0, 1)) > 0.5) { u.z = min(u.z, 0.0); }
  textureStore(dstVel, atlas(c), vec4f(u, 0.0));
}

// ------------------------------------------------------------------ advect scalars (MacCormack) — srcVel must be the projected field
fn sampleDens(pLocal: vec3f) -> vec4f { return textureSampleLevel(srcDens, samp, atlasUVW(pLocal), 0.0); }

@compute @workgroup_size(4, 4, 4)
fn advectScalars(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  // idle brick: no density/temperature within two backtraces of it (see `dilate`), so every tap below reads zero and the result would be the +0
  // densA already holds here. dstDens (densB) is left stale in idle bricks — it is only ever read by injectDecay, cell for cell, in bricks that
  // are active in the same step, and those this kernel has just written in full.
  if (brickIdle(c)) { return; }
  if (obstAt(c) > 0.5) { textureStore(dstDens, atlas(c), vec4f(0.0)); return; }
  let u = textureLoad(srcVel, atlas(c), 0).xyz;
  let P = cellCenterLocal(c);
  let pBack = P - u * sim.dt;
  let phiHat = sampleDens(pBack);                                     // forward (semi-Lagrangian) estimate
  let uBack = textureSampleLevel(srcVel, samp, atlasUVW(pBack), 0.0).xyz;
  let phiHatBack = textureSampleLevel(srcDens, samp, atlasUVW(pBack + uBack * sim.dt), 0.0); // NOTE: samples the *estimate* ideally; approximation using source field
  let phi0 = textureLoad(srcDens, atlas(c), 0);
  var phi = phiHat + 0.5 * (phi0 - phiHatBack);
  // clamp to the min/max of the 8 cells around the back-traced point to avoid overshoot
  let g = pBack / dom.voxel - 0.5;
  let i0 = vec3i(floor(g));
  var mn = vec4f(1e9); var mx = vec4f(-1e9);
  for (var k = 0; k < 8; k++) {
    let cc = clamp(i0 + vec3i(k & 1, (k >> 1) & 1, k >> 2), vec3i(0), vec3i(sim.dims) - 1);
    let v = textureLoad(srcDens, atlas(cc), 0); mn = min(mn, v); mx = max(mx, v);
  }
  phi = clamp(phi, mn, mx);
  phi = max(phi, vec4f(0.0));
  // volume correction for expanding sources: the gather is a MAP, and a map that grows a parcel's volume by (1 + S·dt) owes the density a
  // factor ≈ exp(−S·dt) or the cells tracing back into one dense core each copy it and mass is invented every step. S is the expansion
  // the step was ASKED for (sourceExpansion — the same function the divergence kernel used), not the divergence measured on the projected
  // field: that one carries the pressure solve's residual, and exponentiating a residual every step is a feedback loop. Applied after the limiter
  // (whose bounds come from the undeformed field) and to density only — temperature is intensive, a parcel carries it into the bigger
  // volume unchanged, and scaling it would let a detonation destroy its own buoyancy in a handful of frames.
  if (sim.numExpand > 0u) { phi.x *= exp(-min(sourceExpansion(P) * sim.dt, MAX_DIV_DT)); }
  textureStore(dstDens, atlas(c), phi);
}

// ------------------------------------------------------------------ inject + decay scalars
@compute @workgroup_size(4, 4, 4)
fn injectDecay(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  // idle brick: nothing to decay (the advection result here is exactly 0) and no emitter that deposits density or heat within reach, so the
  // output would be the canonical +0 densA (dstDens) already holds in every cell of the brick — leave it.
  if (brickIdle(c)) { return; }
  if (obstAt(c) > 0.5) { textureStore(dstDens, atlas(c), vec4f(0.0)); return; }
  var v = textureLoad(srcDens, atlas(c), 0);
  v.x *= exp(-sim.densDecay * sim.dt);
  v.y *= exp(-sim.tempDecay * sim.dt);
  let P = cellCenterLocal(c);
  for (var i = 0u; i < sim.numEmitters; i++) {
    let e = sim.emitters[i];
    if (e.domain != dom.index) { continue; }
    let d = P - e.pos; let r2 = dot(d, d) / (e.radius * e.radius);
    if (r2 > 9.0) { continue; }
    let g = exp(-r2);
    // slight noise breakup so plumes aren't perfectly symmetric
    let n = fract(sin(dot(vec3f(c) + sim.time * 3.1, vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
    v.x += e.density * g * sim.dt * (0.75 + 0.5 * n);
    v.y += e.temperature * g * sim.dt;
  }
  // dissipation band inside the open faces of the domain: smoke a jet drives against the (invisible) domain wall would otherwise pile
  // up in the last cells — the backtrace keeps hauling dense smoke to the edge and nothing but this removes it — and render as a flat
  // face where the box ends. Six cells deep, gentle inside (≈0.7/s) rising steeply to ≈30/s in the outermost layer, so density
  // reaches ~0 AT the boundary and the plume seems to thin into the room instead of hitting glass. (Floor face excluded: it is solid.)
  let edge = min(min(min(f32(c.x), f32(i32(sim.dims.x) - 1 - c.x)), min(f32(c.z), f32(i32(sim.dims.z) - 1 - c.z))), f32(i32(sim.dims.y) - 1 - c.y));
  let t = 1.0 - clamp(edge / 6.0, 0.0, 1.0);
  let t2 = t * t;
  v.x *= exp(-(4.0 * t + 26.0 * t2 * t2) * sim.dt);
  v = max(v, vec4f(0.0));
  // The one deliberate epsilon: density / temperature at or below sim.flushEps is stored as exactly 0. The default, 2^-14 ≈ 6.1e-5, is the
  // smallest normal half float: below it the rgba16f texel is a subnormal whose spacing (2^-24) is coarser than one step of decay, so under
  // round-to-nearest the multiplication above stops changing the stored value (at 60 Hz everything under ~1.3e-5 is stuck for good, ~2.6e-5
  // at 120 Hz) and a cell the plume has left would idle there — and keep its brick active — until the domain retired; some GPUs flush that
  // range on store anyway. As extinction it is 3.7e-4 per metre: a whole domain of it end to end moves an 8-bit pixel by less than half a
  // step. It also canonicalises -0 to +0, which is what lets an idle brick keep its texels untouched (flushEps = 0 changes no value at all).
  v = select(v, vec4f(0.0), v <= vec4f(sim.flushEps));
  textureStore(dstDens, atlas(c), v);
}

// ------------------------------------------------------------------ clear (run for both parities when a domain is (re)placed)
@compute @workgroup_size(4, 4, 4)
fn clearAll(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3i(gid);
  if (!inDomain(c)) { return; }
  textureStore(dstVel, atlas(c), vec4f(0.0));
  textureStore(dstDens, atlas(c), vec4f(0.0));
  textureStore(dstP, atlas(c), vec4f(0.0));
  textureStore(dstCurl, atlas(c), vec4f(0.0));
}

// ------------------------------------------------------------------ mass reduction (for freeing idle domains)
var<workgroup> wgSum: array<f32, 64>;
@compute @workgroup_size(4, 4, 4)
fn reduceMass(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32) {
  let c = vec3i(gid);
  var v = 0.0;
  if (inDomain(c)) { v = textureLoad(srcDens, atlas(c), 0).x; }
  wgSum[li] = v;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) { if (li < s) { wgSum[li] += wgSum[li + s]; } workgroupBarrier(); }
  if (li == 0u) { atomicAdd(&massOut[dom.index], u32(clamp(wgSum[0] * 100.0, 0.0, 4.0e9))); }
}

// ------------------------------------------------------------------ brick occupancy: lossless empty-region skipping for the scalar passes
// For most of a plume's life density and temperature fill a small part of the cube, yet advectScalars (four trilinear fetches + a 9-tap
// limiter per cell) and injectDecay ran on every cell. Once per step, AFTER project and BEFORE advectScalars — i.e. on exactly the two
// textures advectScalars is about to read — `occupancy` reduces every brick of BRICK³ cells to "holds density/temperature anywhere"
// (any channel != 0, an exact test), "holds velocity anywhere" and its largest |velocity component|; `dilate` then marks a brick ACTIVE when
//   (a) some brick within `reach` bricks (Chebyshev) holds scalar, reach = ceil((floor(2·vmax·dt/voxel) + 3) / BRICK) ≥ 1, vmax = the
//       largest |component| of the projected velocity anywhere in the domain. advectScalars at cell c reads density only at c itself, in
//       the trilinear footprints around pBack = P − u·dt (|u_i| ≤ vmax) and pBack + uBack·dt (uBack is an interpolated velocity, so
//       |uBack_i| ≤ vmax too), and in the limiter's 2³ cells around pBack: all within floor(2·vmax·dt/voxel) + 1 cells of c per axis
//       (atlasUVW clamps taps into this domain's slab, which only ever moves them nearer). Two more cells are margin for f32 rounding of
//       the trace and the filtering hardware's fixed-point weights. Outside that set every density tap is +0 and the kernel provably
//       writes +0;
//   (b) or an emitter of this domain with density or temperature to deposit is within its 3·radius cutoff of the brick (box grown half
//       a voxel past the outermost cell centres, radius² padded 2 %) — injectDecay's splat loop is the only other way scalar appears.
// In an inactive brick both kernels would therefore output +0 in every cell, and densA already holds +0 there (injectDecay, its only
// writer besides clearAll, canonicalises zeros), so returning early changes nothing that is ever read: densA stays exact everywhere,
// densB is exact wherever it is read (active bricks, same step, same brickAct word for both kernels). Velocity, curl, divergence and
// pressure are NOT skipped: the projection makes velocity non-zero across the whole domain within a few steps (pressure is warm-started
// and spreads 2 cells per red/black pair; the entrainment flow is physically global), so an exact zero test finds no idle bricks there
// — brickStats' velocity count shows it — and anything looser would not be bit-exact.
var<workgroup> wgOccFlags: atomic<u32>;
var<workgroup> wgOccSpeed: atomic<u32>;
@compute @workgroup_size(8, 8, 1)
fn occupancy(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  // one workgroup per brick (dispatch = brickGrid()), each invocation walks one z column of it; srcDens = densA, srcVel = the projected field
  if (li == 0u) { atomicStore(&wgOccFlags, 0u); atomicStore(&wgOccSpeed, 0u); }
  workgroupBarrier();
  var flags = 0u; var speed = 0.0;
  for (var z = 0u; z < BRICK; z++) {
    let c = vec3i(wid * BRICK + vec3u(lid.x, lid.y, z));
    let d = textureLoad(srcDens, atlas(c), 0);
    let v = textureLoad(srcVel, atlas(c), 0).xyz;
    if (any(d != vec4f(0.0))) { flags |= 1u; }
    if (any(v != vec3f(0.0))) { flags |= 2u; }
    speed = max(speed, max(abs(v.x), max(abs(v.y), abs(v.z))));   // per-axis bound (what a backtrace displaces along each axis); abs/max are exact
  }
  atomicOr(&wgOccFlags, flags);
  atomicMax(&wgOccSpeed, bitcast<u32>(speed));                    // non-negative floats order like their bit patterns (an Inf reads as huge: everything in reach; max() drops NaNs — a field gone non-finite is outside what this scheme promises anyway)
  workgroupBarrier();
  if (li == 0u) { brickRaw[brickIndex(wid)] = vec2u(atomicLoad(&wgOccFlags), atomicLoad(&wgOccSpeed)); }
}

var<workgroup> wgDilSpeed: atomic<u32>;
var<workgroup> wgDilSpeedS: atomic<u32>;   // max |velocity component| over the bricks that HOLD density / temperature — how fast the smoke you can see moves (smoke.ts calmCells reads it back; empty air stirred by confinement or a vent does not count)
var<workgroup> wgDilScalar: atomic<u32>;
var<workgroup> wgDilVel: atomic<u32>;
var<workgroup> wgDilActive: atomic<u32>;
var<workgroup> wgDilReach: u32;
var<workgroup> wgDilA: array<u32, BRICKS_PER_DOMAIN>;   // separable dilation ping ...
var<workgroup> wgDilB: array<u32, BRICKS_PER_DOMAIN>;   // ... pong
@compute @workgroup_size(64)
fn dilate(@builtin(local_invocation_index) li: u32) {
  // one workgroup per domain (dispatch = 1): 64 invocations stride over the domain's bricks
  let n = brickGrid(); let count = n.x * n.y * n.z; let base = dom.index * count;
  if (li == 0u) { atomicStore(&wgDilSpeed, 0u); atomicStore(&wgDilSpeedS, 0u); atomicStore(&wgDilScalar, 0u); atomicStore(&wgDilVel, 0u); atomicStore(&wgDilActive, 0u); }
  workgroupBarrier();
  // 1. pull the raw scalar bits into workgroup memory; domain-wide vmax (and vmax over the bricks holding scalar) and counts on the way
  var sp = 0u; var sps = 0u; var ns = 0u; var nv = 0u;
  for (var b = li; b < count; b += 64u) { let r = brickRaw[base + b]; wgDilA[b] = r.x & 1u; sp = max(sp, r.y); sps = max(sps, select(0u, r.y, (r.x & 1u) != 0u)); ns += r.x & 1u; nv += (r.x >> 1u) & 1u; }
  atomicMax(&wgDilSpeed, sp); atomicMax(&wgDilSpeedS, sps); atomicAdd(&wgDilScalar, ns); atomicAdd(&wgDilVel, nv);
  workgroupBarrier();
  // 2. reach in bricks (see the derivation above); a non-finite velocity field puts everything in reach. One invocation decides, everyone takes
  //    it through workgroupUniformLoad so the loops below have uniform bounds ahead of the final barrier.
  if (li == 0u) {
    let vmax = bitcast<f32>(atomicLoad(&wgDilSpeed));
    let cells = 2.0 * vmax * sim.dt / dom.voxel;
    var r = max(n.x, max(n.y, n.z));
    if (cells < 1.0e6) { r = clamp((u32(cells) + 3u + BRICK - 1u) / BRICK, 1u, r); }
    wgDilReach = r;
  }
  let reach = i32(workgroupUniformLoad(&wgDilReach));
  // 3. Chebyshev dilation of the scalar bits by `reach` bricks, done separably — a cube is the sum of three axis segments, and clipping each pass
  //    to the grid loses nothing since sources and targets both lie inside it (outside the domain there is nothing: taps are clamped into the
  //    slab). x: A → B, y: B → A, z: A → the result. O(bricks · (2·reach + 1)) instead of the cube of it, so a fast jet costs nothing extra.
  for (var b = li; b < count; b += 64u) {
    let x = i32(b % n.x); var a = 0u;
    for (var d = max(-reach, -x); d <= min(reach, i32(n.x) - 1 - x); d++) { a |= wgDilA[u32(i32(b) + d)]; }
    wgDilB[b] = a;
  }
  workgroupBarrier();
  for (var b = li; b < count; b += 64u) {
    let y = i32((b / n.x) % n.y); var a = 0u;
    for (var d = max(-reach, -y); d <= min(reach, i32(n.y) - 1 - y); d++) { a |= wgDilB[u32(i32(b) + d * i32(n.x))]; }
    wgDilA[b] = a;
  }
  workgroupBarrier();
  // 4. per brick: scalar within reach, else any depositing emitter overlapping it
  var na = 0u;
  for (var b = li; b < count; b += 64u) {
    let X = vec3i(i32(b % n.x), i32((b / n.x) % n.y), i32(b / (n.x * n.y)));
    var act = 0u;
    for (var d = max(-reach, -X.z); d <= min(reach, i32(n.z) - 1 - X.z); d++) { act |= wgDilA[u32(i32(b) + d * i32(n.x * n.y))]; }
    if (act == 0u) {
      let lo = vec3f(X) * (f32(BRICK) * dom.voxel); let hi = lo + f32(BRICK) * dom.voxel;   // cell centres sit half a voxel inside this box
      for (var i = 0u; i < sim.numEmitters; i++) {
        let e = sim.emitters[i];
        if (e.domain != dom.index || (e.density == 0.0 && e.temperature == 0.0)) { continue; }   // pushes and spent envelopes add exactly +0
        let q = clamp(e.pos, lo, hi) - e.pos;
        if (dot(q, q) <= 9.0 * e.radius * e.radius * 1.02) { act = 1u; break; }
      }
    }
    brickAct[base + b] = act; na += act;
  }
  atomicAdd(&wgDilActive, na);
  workgroupBarrier();
  if (li == 0u) {
    let s = dom.index * BRICK_STAT_WORDS;
    brickStats[s] = atomicLoad(&wgDilActive); brickStats[s + 1u] = atomicLoad(&wgDilScalar); brickStats[s + 2u] = atomicLoad(&wgDilVel); brickStats[s + 3u] = atomicLoad(&wgDilSpeed);
    brickStats[s + 5u] = atomicLoad(&wgDilSpeedS);   // (word 4 = the render count, renderOccPack's)
  }
}

// ------------------------------------------------------------------ render occupancy: lossless empty-space skipping for the RENDERER's smoke samplers
// Every smoke read the picture and the AI make goes through smokeDensityAt (common.wgsl): the volumetric march and its self-shadow taps,
// the 8-tap smokeTransmittance on shadow rays / haze-beam steps / probe lights, the probe's 24-tap sight-line march. Each sample costs one
// trilinear atlas fetch per live domain whose bounds hold the point, and for most of a plume's life most of a 64³ domain is exactly zero
// (a fresh canister fills a corner of its 3.5 m cube). These two kernels tell the samplers where the zeros are, exactly:
//  * WHEN. They run last in every domain step — after injectDecay, the final writer of densA — so they read precisely the texture the render
//    passes sample: engine.render encodes the smoke pass first and every lighting pass after it in the same command buffer, nothing writes
//    densA or these words again until the next step, and a domain that is not stepped (sim paused, frozen or disabled; a retired slot)
//    keeps both exactly as its last step left them. The words and the slab they describe never part, whatever the domain lifecycle does.
//  * WHAT. renderOccRegions reduces each brick to a 27-bit mask: which of its 3×3×3 regions (first cell / the six middle cells / last cell,
//    per axis) hold a texel whose density — .x, the only channel the renderer reads — is != 0. An exact test on the stored half floats
//    (+0 and −0 both count as empty: a footprint of signed zeros filters to a zero, and d += 0 leaves d as it was). renderOccPack then sets
//    bit b of the domain when brick b itself, or any cell of the one-cell shell around it, holds density: of each of the 26 neighbours it
//    tests only the regions touching b (the neighbour's first cell along +axis, its last cell along −axis, all three along a shared axis).
//  * WHY ONE CELL OF SHELL IS EXACTLY ENOUGH. smokeDensityAt samples at texel coordinate tex ∈ [0.5, dims − 0.5] (clamped) and looks up the
//    brick of cell c = floor(tex). A trilinear fetch at coordinate g reads cells floor(g − ½) and floor(g − ½) + 1 per axis: for g in cell
//    c that is {c−1, c} or {c, c+1}, inside c−1..c+1 — and it stays inside for any coordinate error under half a cell, which covers the
//    sampler recomputing the coordinate from normalised uvw (exact for the power-of-two atlas but for the f32 rounding of atlasOffset + tex,
//    ~1e-4 cells) and its fixed-point weights (rounding moves weight between the two cells, never the pair). Clamp-to-edge folds cells
//    −1 / 64 back onto 0 / 63 along x and y, inside the block; along z the domain slabs are stacked in the atlas, but tex.z is clamped to
//    exactly [0.5, 63.5], where the foreign slab's texel has weight exactly 0. So bit(brick(c)) == 0 ⇒ every texel with a non-zero weight
//    is zero ⇒ the fetch returns exactly 0 ⇒ `d += 0 × densityScale` changes nothing, and not fetching is bit-identical. (Frame flag
//    32768 off = fetch regardless, for A/B. The one thing this leans on besides arithmetic: the texture unit converting a half float the
//    same way for textureLoad here and for the filtered fetch there — and with the default flushEps no subnormal is ever stored anyway.)
// Cost: one more read of densA per step (what `occupancy` already does for two textures) + a 64-thread pack; 16 words per domain out.
fn regionOf(l: u32) -> u32 { return select(select(1u, 0u, l == 0u), 2u, l == BRICK - 1u); }   // cell offset inside its brick → region 0 first, 1 middle, 2 last
// regions of the neighbour at brick offset d along one axis whose cells lie within one cell of the home brick, as a 3-bit set over the
// region index: d = +1 → its first cell only, d = −1 → its last cell only, d = 0 (same column as home) → all three
fn axisRegions(d: i32) -> u32 { return select(select(7u, 1u, d == 1), 4u, d == -1); }
fn acceptMask(d: vec3i) -> u32 {
  let ax = axisRegions(d.x); let ay = axisRegions(d.y); let az = axisRegions(d.z);
  var m = 0u;
  for (var ry = 0u; ry < 3u; ry++) {
    for (var rz = 0u; rz < 3u; rz++) {
      if (((ay >> ry) & 1u) != 0u && ((az >> rz) & 1u) != 0u) { m |= ax << (3u * ry + 9u * rz); }   // region bit index = rx + 3·ry + 9·rz
    }
  }
  return m;
}

var<workgroup> wgRgn: atomic<u32>;
@compute @workgroup_size(8, 8, 1)
fn renderOccRegions(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(local_invocation_index) li: u32) {
  // one workgroup per brick (dispatch = brickGrid()), each invocation walks one z column of it; srcDens = densA as injectDecay just left it
  if (li == 0u) { atomicStore(&wgRgn, 0u); }
  workgroupBarrier();
  let rxy = regionOf(lid.x) + 3u * regionOf(lid.y);
  var m = 0u;
  for (var z = 0u; z < BRICK; z++) {
    let c = vec3i(wid * BRICK + vec3u(lid.x, lid.y, z));
    if (textureLoad(srcDens, atlas(c), 0).x != 0.0) { m |= 1u << (rxy + 9u * regionOf(z)); }
  }
  atomicOr(&wgRgn, m);
  workgroupBarrier();
  if (li == 0u) { brickRgn[brickIndex(wid)] = atomicLoad(&wgRgn); }
}

var<workgroup> wgOccWords: array<atomic<u32>, OCC_WORDS>;
var<workgroup> wgOccCount: atomic<u32>;
var<workgroup> wgOccLo: array<atomic<u32>, 3>;   // the box of the SET bricks (min / max brick coordinate per axis), for the renderer's per-domain shadow-segment reject (common.wgsl smokeSubWord)
var<workgroup> wgOccHi: array<atomic<u32>, 3>;
@compute @workgroup_size(64)
fn renderOccPack(@builtin(local_invocation_index) li: u32) {
  // one workgroup per domain (dispatch = 1), straight after renderOccRegions: 64 invocations stride over the domain's bricks
  let n = brickGrid(); let count = n.x * n.y * n.z; let base = dom.index * count;
  for (var w = li; w < OCC_WORDS; w += 64u) { atomicStore(&wgOccWords[w], 0u); }
  if (li == 0u) { atomicStore(&wgOccCount, 0u); }
  if (li < 3u) { atomicStore(&wgOccLo[li], 7u); atomicStore(&wgOccHi[li], 0u); }
  workgroupBarrier();
  var mine = 0u;
  var lo = vec3u(7u); var hi = vec3u(0u);
  for (var b = li; b < count; b += 64u) {
    let B = vec3i(i32(b % n.x), i32((b / n.x) % n.y), i32(b / (n.x * n.y)));
    var hit = false;
    for (var k = 0u; k < 27u; k++) {
      let d = vec3i(i32(k % 3u), i32((k / 3u) % 3u), i32(k / 9u)) - 1;
      let N = B + d;
      if (any(N < vec3i(0)) || any(N >= vec3i(n))) { continue; }   // no cells beyond the domain: x/y clamp back inside, the next slab along z only ever gets weight 0 (see above)
      let m = brickRgn[base + u32((N.z * i32(n.y) + N.y) * i32(n.x) + N.x)];
      if (m != 0u && (m & acceptMask(d)) != 0u) { hit = true; break; }
    }
    if (hit) { atomicOr(&wgOccWords[b >> 5u], 1u << (b & 31u)); mine++; lo = min(lo, vec3u(B)); hi = max(hi, vec3u(B)); }
  }
  atomicAdd(&wgOccCount, mine);
  if (mine > 0u) { atomicMin(&wgOccLo[0], lo.x); atomicMin(&wgOccLo[1], lo.y); atomicMin(&wgOccLo[2], lo.z); atomicMax(&wgOccHi[0], hi.x); atomicMax(&wgOccHi[1], hi.y); atomicMax(&wgOccHi[2], hi.z); }
  workgroupBarrier();
  for (var w = li; w < OCC_WORDS; w += 64u) { renderOcc[dom.index * OCC_WORDS + w] = atomicLoad(&wgOccWords[w]); }
  if (li == 0u) {
    brickStats[dom.index * BRICK_STAT_WORDS + 4u] = atomicLoad(&wgOccCount);
    // the set bricks' box, packed as common.wgsl smokeSubWord reads it (3 bits a coordinate — an 8³ brick grid — + the valid bit); nothing set = lo 7 / hi 0, an inverted box that
    // smokeSegment takes as 'nothing here'. Written in this same dispatch behind the sixteen occupancy words, so the renderer never reads a box that is not the box of exactly those words.
    renderOcc[OCC_WORDS * 8u + dom.index] = (atomicLoad(&wgOccLo[0]) & 7u) | ((atomicLoad(&wgOccLo[1]) & 7u) << 3u) | ((atomicLoad(&wgOccLo[2]) & 7u) << 6u) | ((atomicLoad(&wgOccHi[0]) & 7u) << 9u) | ((atomicLoad(&wgOccHi[1]) & 7u) << 12u) | ((atomicLoad(&wgOccHi[2]) & 7u) << 15u) | (1u << 18u);
  }
}
