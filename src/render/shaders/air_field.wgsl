// ---- THE AIR FIELD (render/airField.ts): a small 2D fluid solve of the WIND over the level's floor plan, PICTURE ONLY (blown snow rides it; nothing in the
// game reads it). One cell = 1 / AIR_RES metres. The maintainer, of the first blown snow on his GPU: 'chaotic fluid dynamics, not just a single static pattern
// that lines up with the wind', 'neat interactions where the wind hits a wall', 'vortices past the edge of the door'.
//
// THE GRID is STAGGERED (a MAC grid): cell (i, j) keeps the x speed on its LOW-x face (at i, j + ½) and the z speed on its LOW-z face (at i + ½, j). A face
// with a solid cell on either side carries nothing, ever: that is the whole wall rule, exact for a wall one cell thick (a cell-centred grid leaks through one).
// The buffers are (w + 1) × (h + 1): the extra column / row holds the far rim's faces. Outside the world the air is the ambient wind and the pressure is 0
// (an open rim: eddies leave, the wind comes in).
//
// ONE STEP, five kernels in one pass (4 + 2 × iterations dispatches):
//   curl      the old field's spin at every cell CORNER, and beside it the turbulence's stream function there (a value noise over x, z and TIME: it boils
//             where it stands, it does not slide downwind).
//   advect    A → B. Every face is carried back along the flow (a midpoint step) and read there with a CUBIC, held inside what its four nearest hold (plain
//             bilinear advection smears a half-metre eddy away in a second; the cubic keeps it). Then the forces: the RELAX toward wind × share (the wind
//             that comes over the wall tops in 3D), VORTICITY CONFINEMENT (pushes round each eddy the way it already turns), the TURBULENCE (the curl of
//             the stream function: divergence-free by construction, scaled by the air's speed there and the wind's, so still air gets none).
//   div       what each cell gains a second from B.
//   pressure  red / black over-relaxed sweeps, in place, of  ∇²P − σ P = div.  The σ term is the VENT: air under pressure also leaves UPWARD (over the wall)
//             and air under suction is fed from above, at a rate ∝ P. With σ = 0 a walled yard is airless (a uniform push is a pressure gradient and nothing
//             else); with it a wall shelters only a few metres and the yard behind it has wind. It also makes the solve local: a dozen sweeps converge.
//             Under a roof the vent is a fraction of the sky's (a ceiling): a room is close to strict 2D, so a draught in at its door comes back out of it.
//   project   B − ∇P → A (the field the next step starts from), and the texture the grains read: the two faces of each cell averaged to its centre, the
//             LIFT = the vent's own upward speed (∝ P: up the windward face of a wall, down in its lee and in an eddy's core), a = 0 in a solid.
// Unconditionally stable: the advection only ever reads values, the relax is an exact decay, every other push is capped by `cap`.

// a LOCAL SOURCE (AirField.setSources): a gust through an open outside door, a wall vent, a ceiling diffuser's down-jet spreading over the floor
struct AirSrc {
  a: vec4f,   // x, z (m, the centre), vx, vz (m/s: the air it drives at its centre)
  b: vec4f,   // sigma (m), out (m/s: the radial outflow's peak, at one sigma), 1 − e^(−rate · dt), the divergence it feeds at its centre (1/s)
};
struct AirU {
  wind: vec2f,        // the ambient wind this step, m/s (x, z)
  dt: f32,            // s (≤ 1/30)
  time: f32,          // s, the caller's clock (the turbulence's evolution)
  size: vec2u,        // w, h in cells
  stride: u32,        // w + 1
  res: f32,           // cells a metre
  relax: f32,         // 1 − e^(−dt / relax time), in the open
  relaxRoof: f32,     // the same under a roof (share 0)
  confine: f32,       // vorticity confinement, × dt already, × the wind gate
  turb: f32,          // turbulence, 1/s × dt already
  turbSize: f32,      // m: the large boil's size
  turbRate: f32,      // 1/s: how fast it changes in place
  sigma: f32,         // the vent term of the pressure equation (cells² · vent / dt)
  sor: f32,           // over-relaxation
  cap: f32,           // m/s: no face faster than this
  liftGain: f32,      // m/s of lift per m²/s² of pressure
  liftMax: f32,       // m/s
  invDt: f32,
  windLen: f32,       // |wind|
  seed: f32,
  dWind: vec2f,       // the wind's change since the last step × AIR.follow: open air takes it at once
  drive: f32,         // m/s: the fastest thing driving the air, the ambient wind or a source (what the boil is held under)
  srcCount: u32,
  sigmaRoof: f32,     // the vent term under a roof (a ceiling lets little out: enough that a diffuser's air has somewhere to go)
  outScale: f32,      // × the solved field = the air in m/s (airField.ts: a light wind is solved at AIR.refSpeed, slowed in time, and handed out at its own speed)
  src: array<AirSrc, 16>,
};

@group(0) @binding(0) var<uniform> U: AirU;
/** how much of the confinement air moving at `v` takes: none under a quarter of what drives the air, all of it from four fifths */
fn confineGate(v: vec2f) -> f32 { return smoothstep(0.25, 0.8, length(v) / max(U.drive, 1e-3)); }
@group(0) @binding(1) var cells: texture_2d<u32>;                        // 255 = solid, else share × 254
@group(0) @binding(2) var<storage, read_write> velA: array<vec2f>;        // the field between steps
@group(0) @binding(3) var<storage, read_write> velB: array<vec2f>;        // advected + forced, before the projection
@group(0) @binding(4) var<storage, read_write> corner: array<vec2f>;      // x = spin (1/s), y = the turbulence's stream function (m)
@group(0) @binding(5) var<storage, read_write> divg: array<vec4f>;        // x = divergence ÷ dt; y = which of the four neighbours are open (bits 1 2 4 8: −x +x −z +z), −1 in a solid; z = the cell's vent term
@group(0) @binding(6) var<storage, read_write> pres: array<f32>;          // pressure ÷ cell (m/s²), kept between steps: the next solve starts from it
@group(0) @binding(7) var outTex: texture_storage_2d<rgba16float, write>;

fn at(i: i32, j: i32) -> u32 { return u32(j) * U.stride + u32(i); }
fn inWorld(i: i32, j: i32) -> bool { return i >= 0 && j >= 0 && i < i32(U.size.x) && j < i32(U.size.y); }
fn cellByte(i: i32, j: i32) -> u32 { if (!inWorld(i, j)) { return 254u; } return textureLoad(cells, vec2i(i, j), 0).r; }
fn solid(i: i32, j: i32) -> bool { return cellByte(i, j) == 255u; }
fn share(i: i32, j: i32) -> f32 { let b = cellByte(i, j); if (b == 255u) { return 0.0; } return f32(b) / 254.0; }
fn blockedU(i: i32, j: i32) -> bool { return solid(i - 1, j) || solid(i, j); }
fn blockedV(i: i32, j: i32) -> bool { return solid(i, j - 1) || solid(i, j); }

// a face's value from A; past the rim = the ambient wind
fn uA(i: i32, j: i32) -> f32 { if (i < 0 || j < 0 || i > i32(U.size.x) || j >= i32(U.size.y)) { return U.wind.x; } return velA[at(i, j)].x; }
fn vA(i: i32, j: i32) -> f32 { if (i < 0 || j < 0 || i >= i32(U.size.x) || j > i32(U.size.y)) { return U.wind.y; } return velA[at(i, j)].y; }

// p in cells. u faces sit at (i, j + ½), v faces at (i + ½, j).
fn uLin(p: vec2f) -> f32 {
  let g = vec2f(p.x, p.y - 0.5); let f0 = floor(g); let f = g - f0; let i = i32(f0.x); let j = i32(f0.y);
  return mix(mix(uA(i, j), uA(i + 1, j), f.x), mix(uA(i, j + 1), uA(i + 1, j + 1), f.x), f.y);
}
fn vLin(p: vec2f) -> f32 {
  let g = vec2f(p.x - 0.5, p.y); let f0 = floor(g); let f = g - f0; let i = i32(f0.x); let j = i32(f0.y);
  return mix(mix(vA(i, j), vA(i + 1, j), f.x), mix(vA(i, j + 1), vA(i + 1, j + 1), f.x), f.y);
}
// Catmull-Rom weights
fn crW(t: f32) -> vec4f {
  let t2 = t * t; let t3 = t2 * t;
  return vec4f(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}
// the cubic read, held inside the four nearest values (no new extremes: what keeps the sharp scheme stable)
fn uCub(p: vec2f) -> f32 {
  let g = vec2f(p.x, p.y - 0.5); let f0 = floor(g); let f = g - f0; let i = i32(f0.x); let j = i32(f0.y);
  let wx = crW(f.x); let wy = crW(f.y); var s = 0.0; var lo = 1e9; var hi = -1e9;
  for (var b = 0; b < 4; b++) {
    var r = 0.0;
    for (var a = 0; a < 4; a++) { let q = uA(i + a - 1, j + b - 1); r += q * wx[a]; if (a >= 1 && a <= 2 && b >= 1 && b <= 2) { lo = min(lo, q); hi = max(hi, q); } }
    s += r * wy[b];
  }
  return clamp(s, lo, hi);
}
fn vCub(p: vec2f) -> f32 {
  let g = vec2f(p.x - 0.5, p.y); let f0 = floor(g); let f = g - f0; let i = i32(f0.x); let j = i32(f0.y);
  let wx = crW(f.x); let wy = crW(f.y); var s = 0.0; var lo = 1e9; var hi = -1e9;
  for (var b = 0; b < 4; b++) {
    var r = 0.0;
    for (var a = 0; a < 4; a++) { let q = vA(i + a - 1, j + b - 1); r += q * wx[a]; if (a >= 1 && a <= 2 && b >= 1 && b <= 2) { lo = min(lo, q); hi = max(hi, q); } }
    s += r * wy[b];
  }
  return clamp(s, lo, hi);
}

// the sources' pull on one face at p (metres): `axis` picks the component. Each relaxes the air toward (its v + the radial outflow) with a Gaussian weight,
// cut at 2.5 sigma.
fn srcPull(p: vec2f, vel: f32, axis: i32) -> f32 {
  var v = vel;
  for (var n = 0u; n < U.srcCount; n++) {
    let s = U.src[n]; let d = p - s.a.xy; let q2 = dot(d, d) / (s.b.x * s.b.x);
    if (q2 >= 6.25) { continue; }
    let r = sqrt(dot(d, d)); let q = sqrt(q2);
    let want = s.a.zw + d / max(r, 1e-4) * (s.b.y * q * exp(0.5 - 0.5 * q2));
    v += (want[axis] - v) * exp(-q2) * s.b.z;
  }
  return v;
}
// … and the air a radial source ADDS a second at p (the divergence of its outflow, (out / sigma) · e^(½ − ½q²) · (2 − q²), scaled on the CPU by how hard it pulls):
// the pressure solve is told to leave that much, or it would press the outflow flat again
fn srcDiv(p: vec2f) -> f32 {
  var dv = 0.0;
  for (var n = 0u; n < U.srcCount; n++) {
    let s = U.src[n]; let d = p - s.a.xy; let q2 = dot(d, d) / (s.b.x * s.b.x);
    if (q2 >= 6.25 || s.b.w == 0.0) { continue; }
    dv += s.b.w * exp(0.5 - 0.5 * q2) * (2.0 - q2);
  }
  return dv;
}

// ---- the turbulence's stream function: value noise on an (x, z, time) lattice, two sizes
fn hash3(p: vec3i) -> f32 {
  var h = u32(p.x) * 0x8da6b343u + u32(p.y) * 0xd8163841u + u32(p.z) * 0xcb1ab31fu + u32(U.seed) * 0x9e3779b9u;
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du; h = (h ^ (h >> 12u)) * 0x297a2d39u; h = h ^ (h >> 15u);
  return f32(h >> 8u) * (2.0 / 16777216.0) - 1.0;
}
fn noise3(p: vec3f) -> f32 {
  let f0 = floor(p); let i = vec3i(f0); let t = p - f0; let s = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  let a = mix(mix(hash3(i), hash3(i + vec3i(1, 0, 0)), s.x), mix(hash3(i + vec3i(0, 1, 0)), hash3(i + vec3i(1, 1, 0)), s.x), s.y);
  let b = mix(mix(hash3(i + vec3i(0, 0, 1)), hash3(i + vec3i(1, 0, 1)), s.x), mix(hash3(i + vec3i(0, 1, 1)), hash3(i + vec3i(1, 1, 1)), s.x), s.y);
  return mix(a, b, s.z);
}
fn stream(xz: vec2f) -> f32 {
  let L = U.turbSize; let t = U.time * U.turbRate;
  // (ψ = L × noise(x / L): its curl is of order 1 at either size; the small boil changes faster, as small eddies do)
  return L * noise3(vec3f(xz / L, t)) + 0.45 * L * noise3(vec3f(xz / (0.45 * L) + 31.7, t * 1.9 + 11.3));
}

@compute @workgroup_size(8, 8) fn curl(@builtin(global_invocation_id) gid: vec3u) {
  let i = i32(gid.x); let j = i32(gid.y);
  if (gid.x > U.size.x || gid.y > U.size.y) { return; }
  // the corner (i, j): between v(i − 1, j) and v(i, j) along x, between u(i, j − 1) and u(i, j) along z
  let w = (vA(i, j) - vA(i - 1, j) - uA(i, j) + uA(i, j - 1)) * U.res;
  var psi = 0.0; if (U.turb > 0.0) { psi = stream(vec2f(f32(i), f32(j)) / U.res); }
  corner[at(i, j)] = vec2f(w, psi);
}

fn cornerAt(i: i32, j: i32) -> vec2f { return corner[at(clamp(i, 0, i32(U.size.x)), clamp(j, 0, i32(U.size.y)))]; }

@compute @workgroup_size(8, 8) fn advect(@builtin(global_invocation_id) gid: vec3u) {
  let i = i32(gid.x); let j = i32(gid.y);
  if (gid.x > U.size.x || gid.y > U.size.y) { return; }
  let k = U.dt * U.res;   // cells moved per m/s
  let c00 = cornerAt(i, j); let c10 = cornerAt(i + 1, j); let c01 = cornerAt(i, j + 1);
  var out = vec2f(0.0);

  // ---- the x face at (i, j + ½)
  if (gid.y < U.size.y && !blockedU(i, j)) {
    let p = vec2f(f32(i), f32(j) + 0.5);
    let v0 = vec2f(uA(i, j), 0.25 * (vA(i - 1, j) + vA(i, j) + vA(i - 1, j + 1) + vA(i, j + 1)));
    let m = p - 0.5 * k * v0; let v1 = vec2f(uLin(m), vLin(m));
    var u = uCub(p - k * v1);
    let sh = 0.5 * (share(i - 1, j) + share(i, j));
    u += U.dWind.x * sh; u += (U.wind.x * sh - u) * mix(U.relaxRoof, U.relax, sh);
    u = srcPull(p / U.res, u, 0);
    // confinement: N = the way the spin's strength rises, the push = N × ω (its x part = N.z · ω)
    let a0 = abs(c00.x); let a1 = abs(c01.x);
    let g = vec2f(0.25 * (abs(cornerAt(i + 1, j).x) + abs(cornerAt(i + 1, j + 1).x) - abs(cornerAt(i - 1, j).x) - abs(cornerAt(i - 1, j + 1).x)), a1 - a0);
    // (… only where the air MOVES: in slack air — a walled yard, a lee — there is no eddy for it to keep, and it fed the grid's own grain until every cell
    // pointed its own way: seen in the pass's compound, measured by the page test's court scene)
    u += U.confine * confineGate(v1) * (g.y / (length(g) + 0.05)) * 0.5 * (c00.x + c01.x);
    // turbulence: ∂ψ/∂z, scaled by the air's speed here (never more than twice what drives it, the wind or a source: none in still air)
    let sp = 0.5 * (U.windLen * sh + min(length(v1), 2.0 * U.drive));
    u += U.turb * sp * (c01.y - c00.y) * U.res;
    out.x = clamp(u, -U.cap, U.cap);
  }
  // ---- the z face at (i + ½, j)
  if (gid.x < U.size.x && !blockedV(i, j)) {
    let p = vec2f(f32(i) + 0.5, f32(j));
    let v0 = vec2f(0.25 * (uA(i, j - 1) + uA(i + 1, j - 1) + uA(i, j) + uA(i + 1, j)), vA(i, j));
    let m = p - 0.5 * k * v0; let v1 = vec2f(uLin(m), vLin(m));
    var v = vCub(p - k * v1);
    let sh = 0.5 * (share(i, j - 1) + share(i, j));
    v += U.dWind.y * sh; v += (U.wind.y * sh - v) * mix(U.relaxRoof, U.relax, sh);
    v = srcPull(p / U.res, v, 1);
    let a0 = abs(c00.x); let a1 = abs(c10.x);
    let g = vec2f(a1 - a0, 0.25 * (abs(cornerAt(i, j + 1).x) + abs(cornerAt(i + 1, j + 1).x) - abs(cornerAt(i, j - 1).x) - abs(cornerAt(i + 1, j - 1).x)));
    v -= U.confine * confineGate(v1) * (g.x / (length(g) + 0.05)) * 0.5 * (c00.x + c10.x);
    let sp = 0.5 * (U.windLen * sh + min(length(v1), 2.0 * U.drive));
    v -= U.turb * sp * (c10.y - c00.y) * U.res;
    out.y = clamp(v, -U.cap, U.cap);
  }
  velB[at(i, j)] = out;
}

@compute @workgroup_size(8, 8) fn divergence(@builtin(global_invocation_id) gid: vec3u) {
  let i = i32(gid.x); let j = i32(gid.y);
  if (gid.x >= U.size.x || gid.y >= U.size.y) { return; }
  let n = at(i, j);
  if (solid(i, j)) { divg[n] = vec4f(0.0, -1.0, 0.0, 0.0); pres[n] = 0.0; return; }
  // (the sweeps run twenty times a step and this once: the walls round the cell are looked up here and handed to them as four bits)
  let open = select(1.0, 0.0, solid(i - 1, j)) + select(2.0, 0.0, solid(i + 1, j)) + select(4.0, 0.0, solid(i, j - 1)) + select(8.0, 0.0, solid(i, j + 1));
  // (÷ res: the faces' difference is the divergence × one cell; the sources' is per second)
  divg[n] = vec4f((velB[at(i + 1, j)].x - velB[n].x + velB[at(i, j + 1)].y - velB[n].y - srcDiv((vec2f(f32(i), f32(j)) + 0.5) / U.res) / U.res) * U.invDt, open, mix(U.sigmaRoof, U.sigma, share(i, j)), 0.0);
}

// one colour of the checkerboard: a red cell reads only black ones, so the sweep is in place and race-free
fn sweep(gid: vec3u, colour: u32) {
  if (gid.x >= U.size.x || gid.y >= U.size.y || ((gid.x + gid.y) & 1u) != colour) { return; }
  let i = i32(gid.x); let j = i32(gid.y); let c = at(i, j); let d = divg[c];
  if (d.y <= 0.0) { if (d.y == 0.0) { pres[c] = 0.0; } return; }   // a solid, or an open cell walled in on all four sides
  let open = u32(d.y); var s = 0.0;
  // a solid neighbour: no flow through that face, it is not in the sum. Past the rim: open air at pressure 0 (counted, adds nothing).
  if ((open & 1u) != 0u && i > 0) { s += pres[c - 1u]; }
  if ((open & 2u) != 0u && gid.x + 1u < U.size.x) { s += pres[c + 1u]; }
  if ((open & 4u) != 0u && j > 0) { s += pres[c - U.stride]; }
  if ((open & 8u) != 0u && gid.y + 1u < U.size.y) { s += pres[c + U.stride]; }
  pres[c] = mix(pres[c], (s - d.x) / (f32(countOneBits(open)) + d.z), U.sor);
}
@compute @workgroup_size(8, 8) fn pressureRed(@builtin(global_invocation_id) gid: vec3u) { sweep(gid, 0u); }
@compute @workgroup_size(8, 8) fn pressureBlack(@builtin(global_invocation_id) gid: vec3u) { sweep(gid, 1u); }

fn presAt(i: i32, j: i32) -> f32 { if (!inWorld(i, j)) { return 0.0; } return pres[at(i, j)]; }
fn uProj(i: i32, j: i32) -> f32 { if (blockedU(i, j)) { return 0.0; } return clamp(velB[at(i, j)].x - U.dt * (presAt(i, j) - presAt(i - 1, j)), -U.cap, U.cap); }
fn vProj(i: i32, j: i32) -> f32 { if (blockedV(i, j)) { return 0.0; } return clamp(velB[at(i, j)].y - U.dt * (presAt(i, j) - presAt(i, j - 1)), -U.cap, U.cap); }

@compute @workgroup_size(8, 8) fn project(@builtin(global_invocation_id) gid: vec3u) {
  let i = i32(gid.x); let j = i32(gid.y);
  if (gid.x > U.size.x || gid.y > U.size.y) { return; }
  var f = vec2f(0.0);
  if (gid.y < U.size.y) { f.x = uProj(i, j); }
  if (gid.x < U.size.x) { f.y = vProj(i, j); }
  velA[at(i, j)] = f;
  if (gid.x >= U.size.x || gid.y >= U.size.y) { return; }
  if (solid(i, j)) { textureStore(outTex, vec2i(i, j), vec4f(0.0)); return; }
  let c = 0.5 * vec2f(f.x + uProj(i + 1, j), f.y + vProj(i, j + 1));
  // the lift off the pressure, smoothed over the cell and its open neighbours (the red / black sweeps leave a faint checker in P; the mean of both colours has none)
  var p = 2.0 * presAt(i, j); var n = 2.0;
  if (!solid(i - 1, j)) { p += presAt(i - 1, j); n += 1.0; }
  if (!solid(i + 1, j)) { p += presAt(i + 1, j); n += 1.0; }
  if (!solid(i, j - 1)) { p += presAt(i, j - 1); n += 1.0; }
  if (!solid(i, j + 1)) { p += presAt(i, j + 1); n += 1.0; }
  // (the vent's own speed: under a roof, where little leaves upward, the same pressure lifts that much less)
  let lift = clamp(U.liftGain * mix(U.sigmaRoof / max(U.sigma, 1e-6), 1.0, share(i, j)) * (p / n) / U.res, -U.liftMax, U.liftMax);
  textureStore(outTex, vec2i(i, j), vec4f(c * U.outScale, lift * U.outScale, 1.0));
}
