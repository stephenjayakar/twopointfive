// Irradiance queries at arbitrary world points (light meter for stealth logic). One thread per query.
// Result per query: max over 6 axis directions of (shadowed direct + indirect) irradiance, plus the vertical component.
struct Query { pos: vec3f, skipOwner: u32, b: vec3f, kind: u32 };   // kind 0: irradiance at pos; kind 1: smoke transmittance pos→b
@group(1) @binding(0) var<storage, read> queries: array<Query>;
@group(1) @binding(1) var<storage, read_write> results: array<vec4f>;
@group(1) @binding(2) var diceTex: texture_3d<f32>;
struct ProbeParams { count: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(1) @binding(3) var<uniform> pp: ProbeParams;

@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= pp.count) { return; }
  let q = queries[i];
  if (q.kind == 1u) {
    let d = q.b - q.pos; let dist = length(d);
    var tr = 1.0;
    if (dist > 1e-3 && frame.numSmoke > 0u) {
      // finer march than the shadow-ray helper: 24 steps over the overlap
      let rd = d / dist; let invRd = safeInv(rd);
      var tEnter = 1e30; var tExit = -1e30;
      for (var k = 0u; k < frame.numSmoke; k++) {
        let sd = smoke[k]; if (sd.live == 0u) { continue; }
        let tb = isectBounds(q.pos, invRd, sd.origin, sd.origin + sd.voxel * vec3f(sd.dims));
        if (tb.x <= tb.y && tb.y > 0.0 && tb.x < dist) { tEnter = min(tEnter, max(tb.x, 0.0)); tExit = max(tExit, min(tb.y, dist)); }
      }
      if (tExit > tEnter) { let stp = (tExit - tEnter) / 24.0; var od = 0.0; for (var sI = 0.5; sI < 24.0; sI += 1.0) { od += smokeDensityAt(q.pos + rd * (tEnter + sI * stp)); } tr = exp(-od * stp * 6.0); }
    }
    results[i] = vec4f(tr, 0.0, 0.0, 2.0);
    return;
  }
  var dirs = array<vec3f, 6>(vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1));
  var best = 0.0; var sum = 0.0; var up = 0.0;
  for (var k = 0u; k < 6u; k++) {
    let N = dirs[k];
    var E = vec3f(0.0);
    if ((frame.flags & FLAG_DIRECT) != 0u) {
      for (var li = 0u; li < frame.numLights; li++) {
        let L = lights[li];
        let ev = evalLight(L, q.pos, N);
        if (!ev.ok) { continue; }
        if (max(ev.E.x, max(ev.E.y, ev.E.z)) < 0.002) { continue; }
        let tmax = ev.dist.x - L.radius - 0.02;
        if (tmax > 0.0 && occluded(q.pos, ev.L, tmax, q.skipOwner | ((L.owner & 0xffu) << 8u))) { continue; }
        E += ev.E * smokeTransmittance(q.pos, ev.L, min(tmax, 30.0));
      }
    }
    if ((frame.flags & FLAG_INDIRECT) != 0u) { E += diceIrradiance(q.pos, N); }   // physical bounce: the light meter / AI never follow the on-screen 'indirect scale' look knob
    let l = luminance(E);
    best = max(best, l); sum += l;
    if (k == 2u) { up = l; }
  }
  results[i] = vec4f(best, sum / 6.0, up, 1.0);
}
