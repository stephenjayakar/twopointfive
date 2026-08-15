// SDF character rig — a debug kernel over the LIVE scene group (main.ts __rigTrace): for a list of rays it evaluates the production WGSL of shaders/sdfrig.wgsl
// (the soft-shadow query in both forms, the round-cone any-hit, the smooth-union closest hit) so a CPU twin (tools/qa, the harness) can be checked against it
// number for number — the mesh shadows' __meshTrace pattern. Nothing here runs in a frame.
import { makeBuffer, makeBufferWithData, makeShader } from '../gpu/device';
import { scenePrelude } from './frame';

const src = /* wgsl */`
@group(1) @binding(0) var<storage, read> dbgRays: array<vec4f>;        // 2 per ray: (Po.xyz, tmax), (L.xyz, tanHalf)   (skip = 0)
@group(1) @binding(1) var<storage, read_write> dbgOut: array<vec4f>;   // 2 per ray: (charSoftVis, analytic res raw, march res raw, occludedCapsules 0/1), (traceCapsules t, its index, rigClosest t, its char)
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = arrayLength(&dbgOut) / 2u;
  if (gid.x >= n) { return; }
  let a = dbgRays[gid.x * 2u]; let b = dbgRays[gid.x * 2u + 1u];
  let Po = a.xyz; let L = b.xyz; let tmax = a.w; let th = b.w;
  let vis = charSoftVis(Po, L, tmax, th, 0u);
  var ra = 1.0; var rm = 1.0;
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let bs = scene.charBounds[ch];
    let sp = raySphereSpan(Po, L, bs.xyz, bs.w);
    let ta = max(sp.x, 0.02); let tb = min(sp.y, tmax);
    if (ta >= tb) { continue; }
    let base = ch * scene.capsPerChar;
    ra = charSoftAnalyticRes(base, Po, L, tb, th, ra);
    rm = charSoftMarch(base, Po, L, ta, tb, th, rm);
  }
  let occ = occludedCapsules(Po, L, tmax, 0u);
  let tc = traceCapsules(Po, L, tmax, 0u);
  let rc = rigClosest(Po, L, tmax, 0u);
  dbgOut[gid.x * 2u] = vec4f(vis, ra, rm, select(0.0, 1.0, occ));
  dbgOut[gid.x * 2u + 1u] = vec4f(tc.x, tc.y, rc.t, f32(rc.ch));
}
`;

let cached: { pipe: GPUComputePipeline; layout: GPUBindGroupLayout } | null = null;
/** rays: 8 floats each (Po.xyz, tmax, L.xyz, tanHalf) → 8 floats each (charSoftVis, analytic res, march res, occluded 0/1, traceCapsules t, index, rigClosest t, char) */
export async function rigDebugTrace(device: GPUDevice, sceneLayout: GPUBindGroupLayout, sceneBG: GPUBindGroup, rays: Float32Array): Promise<Float32Array> {
  const n = (rays.length / 8) | 0; if (n === 0) return new Float32Array(0);
  if (!cached) {
    const layout = device.createBindGroupLayout({ label: 'rigDbg', entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
    const pipe = await device.createComputePipelineAsync({ label: 'rigDbg', layout: device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, layout] }), compute: { module: makeShader(device, scenePrelude() + src, 'rigDbg'), entryPoint: 'main' } });
    cached = { pipe, layout };
  }
  const rayBuf = makeBufferWithData(device, rays, GPUBufferUsage.STORAGE, 'rigDbgRays');
  const outBuf = makeBuffer(device, n * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'rigDbgOut');
  const rd = device.createBuffer({ size: n * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const bg = device.createBindGroup({ layout: cached.layout, entries: [{ binding: 0, resource: { buffer: rayBuf } }, { binding: 1, resource: { buffer: outBuf } }] });
  const enc = device.createCommandEncoder({ label: 'rigDbg' });
  { const p = enc.beginComputePass({ label: 'rigDbg' }); p.setPipeline(cached.pipe); p.setBindGroup(0, sceneBG); p.setBindGroup(1, bg); p.dispatchWorkgroups(Math.ceil(n / 64)); p.end(); }
  enc.copyBufferToBuffer(outBuf, 0, rd, 0, n * 32);
  device.queue.submit([enc.finish()]);
  await rd.mapAsync(GPUMapMode.READ);
  const out = new Float32Array(rd.getMappedRange().slice(0)); rd.unmap(); rd.destroy(); rayBuf.destroy(); outBuf.destroy();
  return out;
}
