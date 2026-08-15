// Mesh-traced character shadows, GPU half (EXPERIMENT, settings.meshShadows, FrameFlags.MeshShadows; the CPU topology + reference is meshbvh.ts,
// the walk is meshShadowT / meshAnyHitChar in common.wgsl). Every mannequin shares one glTF mesh, so one BVH topology (built once on the CPU
// over the rest pose) serves all of them; per frame two small compute dispatches re-skin every triangle corner per character and refit the
// boxes bottom-up, and every shadow ray that reaches a character walks that character's tree instead of testing his 15 capsules.
//
// ONE storage buffer (`buf`, bound read-only at scene binding 13 as array<vec4u>; floats travel as their bit patterns) holds it all:
//   [0]                                  header: (N = nodes per tree, NODE_BASE, TRI_BASE, T = triangles per tree)   ← what the walk reads
//   [1]                                  (MESH_MAX_CHARS, levels, LEAF_MAX, 0) — informational
//   [NODE_BASE + (k·N + i)·2 + 0]        node i of character k: (aabbMin.xyz as bits, skip)         skip = next node when this one is missed / done
//   [NODE_BASE + (k·N + i)·2 + 1]                               (aabbMax.xyz as bits, triStart | triCount << 24)   count 0 = internal (children i+1 and topo.right)
//   [TRI_BASE + (k·T + t)·3 + j]         corner j of triangle t of character k, skinned this frame: (pos.xyz as bits, 0)
// k is the character's index in this frame's capsule list = its skin instance (game.ts writes both from one list; scene.charBounds[k] culls it,
// capsules[k·capsPerChar] carries its owner id). N ≈ 9k, T ≈ 13.7k: 281 KB of nodes + 644 KB of corners per character, ×8 slots ≈ 7.4 MB.
// The node region is initialised for all slots with the real links and inside-out boxes, so a slot that has never been refit is a valid EMPTY
// tree (the walk terminates on any slot, whatever the frame's character count).
import { makeBuffer, makeBufferWithData, makeShader, computePipelineAsync } from '../gpu/device';
import { GltfCharacter, MeshData } from '../anim/gltf';
import { JOINT_STRIDE } from '../anim/characters';
import { MeshBvh, buildMeshBvh, topologyDigest, LEAF_MAX, LEAF_PAD, MESH_MAX_CHARS } from './meshbvh';
import { scenePrelude } from './frame';

export { MESH_MAX_CHARS };
export const NODE_BASE = 4;          // vec4u elements before the first node
const LEVEL_HDR = 64;                // u32 words of level offsets before the level-ordered node list in `levels`
const REFIT_WG = 256;                // one workgroup of this size refits one character's tree, level by level

const bvhCache = new WeakMap<MeshData, MeshBvh>();   // one build per mesh per process (the headless QA harness constructs many Games)
/** The shared topology for a loaded character mesh (built on first use: ~80 ms for the mannequin). */
export function meshBvhFor(mesh: MeshData): MeshBvh {
  let b = bvhCache.get(mesh);
  if (!b) { b = buildMeshBvh(mesh.positions, mesh.indices); bvhCache.set(mesh, b); }
  return b;
}

const skinRefitSrc = (N: number, T: number, LEVELS: number, TRI_BASE: number) => /* wgsl */`
const N: u32 = ${N}u; const T: u32 = ${T}u; const LEVELS: u32 = ${LEVELS}u;
const NODE_BASE: u32 = ${NODE_BASE}u; const TRI_BASE: u32 = ${TRI_BASE}u; const LEVEL_HDR: u32 = ${LEVEL_HDR}u;
const JOINT_STRIDE: u32 = ${JOINT_STRIDE}u; const LEAF_PAD: f32 = ${LEAF_PAD};
@group(0) @binding(0) var<storage, read_write> mbuf: array<vec4u>;
@group(0) @binding(1) var<storage, read> rest: array<vec4u>;         // 2 per vertex: (rest pos.xyz bits, joints j0 | j1<<8 | j2<<16 | j3<<24), (weights.xyzw bits)
@group(0) @binding(2) var<storage, read> cornerVert: array<u32>;     // 3T: vertex of corner c (triangles in tree order)
@group(0) @binding(3) var<storage, read> jointMats: array<mat4x4f>;  // CharacterRenderer.jointMats: instance k's skinning matrices at k·JOINT_STRIDE (what vsSkin rasterises with)
@group(0) @binding(4) var<storage, read> topo: array<vec4u>;         // N: (skip, triStart, triCount, right child)
@group(0) @binding(5) var<storage, read> levels: array<u32>;         // [0, LEVELS]: offsets into the node list at LEVEL_HDR.., deepest level first

// one thread per triangle corner per character (gid.y): the same linear blend vsSkin does, so the traced mesh is the rasterised one
@compute @workgroup_size(64) fn skin(@builtin(global_invocation_id) gid: vec3u) {
  let c = gid.x; let k = gid.y;
  if (c >= 3u * T) { return; }
  let vi = cornerVert[c];
  let r0 = rest[vi * 2u]; let r1 = rest[vi * 2u + 1u];
  let p = vec4f(bitcast<vec3f>(r0.xyz), 1.0); let w = bitcast<vec4f>(r1); let j = r0.w;
  let base = k * JOINT_STRIDE;
  let m = jointMats[base + (j & 255u)] * w.x + jointMats[base + ((j >> 8u) & 255u)] * w.y + jointMats[base + ((j >> 16u) & 255u)] * w.z + jointMats[base + (j >> 24u)] * w.w;
  let wp = (m * p).xyz;
  mbuf[TRI_BASE + k * T * 3u + c] = vec4u(bitcast<vec3u>(wp), 0u);
}

// one workgroup per character (wid.x): levels deepest first, a storage barrier between levels — a node's children sit one level deeper, so they
// are final by the time it is their parent's turn. Leaves box their corners (+ LEAF_PAD), internal nodes union their two children.
@compute @workgroup_size(${REFIT_WG}) fn refit(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lid: u32) {
  let k = wid.x;
  let nb = NODE_BASE + k * N * 2u; let tb = TRI_BASE + k * T * 3u;
  for (var L = 0u; L < LEVELS; L++) {
    let s = levels[L]; let e = levels[L + 1u];
    for (var q = s + lid; q < e; q += ${REFIT_WG}u) {
      let ni = levels[LEVEL_HDR + q];
      let tp = topo[ni];
      var mn: vec3f; var mx: vec3f;
      if (tp.z > 0u) {
        mn = vec3f(1e30); mx = vec3f(-1e30);
        for (var c = tp.y * 3u; c < (tp.y + tp.z) * 3u; c++) { let v = bitcast<vec3f>(mbuf[tb + c].xyz); mn = min(mn, v); mx = max(mx, v); }
        mn -= vec3f(LEAF_PAD); mx += vec3f(LEAF_PAD);
      } else {
        let l = nb + (ni + 1u) * 2u; let r = nb + tp.w * 2u;
        mn = min(bitcast<vec3f>(mbuf[l].xyz), bitcast<vec3f>(mbuf[r].xyz));
        mx = max(bitcast<vec3f>(mbuf[l + 1u].xyz), bitcast<vec3f>(mbuf[r + 1u].xyz));
      }
      mbuf[nb + ni * 2u] = vec4u(bitcast<vec3u>(mn), tp.x);
      mbuf[nb + ni * 2u + 1u] = vec4u(bitcast<vec3u>(mx), tp.y | (tp.z << 24u));
    }
    storageBarrier();
  }
}
`;

// The fixture replay (tools/qa/mesh-shadow-fixture.json → main.ts __meshTrace): the PRODUCTION walk from common.wgsl (scene prelude, scene bind group,
// the live mesh buffer) over rays handed in through a small side buffer, character slot 0.
const debugSrc = /* wgsl */`
@group(1) @binding(0) var<storage, read> dbgRays: array<vec4f>;        // 2 per ray: (ro.xyz, tmax), (rd.xyz, skipOwner as f32)
@group(1) @binding(1) var<storage, read_write> dbgOut: array<vec4f>;   // per ray: (t of meshAnyHitChar(0), t of meshShadowT over all characters, nodes N, 0)
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = arrayLength(&dbgOut);
  if (gid.x >= n) { return; }
  let a = dbgRays[gid.x * 2u]; let b = dbgRays[gid.x * 2u + 1u];
  let t0 = meshAnyHitChar(0u, a.xyz, b.xyz, safeInv(b.xyz), a.w);
  let t1 = meshShadowT(a.xyz, b.xyz, a.w, u32(b.w));
  dbgOut[gid.x] = vec4f(t0, t1, f32(meshLoad(0u).x), 0.0);
}
`;

export class MeshShadows {
  readonly bvh: MeshBvh;
  /** topology checksum — tools/qa/mesh-shadow-ref.ts prints the same for the same mesh (the fixture only applies when they agree) */
  readonly digest: string;
  /** the one buffer the scene group binds (layout above) */
  readonly buf: GPUBuffer;
  readonly bytes: number;
  readonly triBase: number;
  private pSkin!: GPUComputePipeline; private pRefit!: GPUComputePipeline; private bg: GPUBindGroup;
  private mod: GPUShaderModule; private pl: GPUPipelineLayout;
  private dbg: { pipe: GPUComputePipeline; layout: GPUBindGroupLayout } | null = null;
  /** characters skinned + refit by the last encode() (the HUD / panel read it) */
  lastChars = 0;

  constructor(private device: GPUDevice, ch: GltfCharacter, private jointMats: GPUBuffer) {
    const mesh = ch.mesh; const bvh = this.bvh = meshBvhFor(mesh); this.digest = topologyDigest(bvh);
    const N = bvh.numNodes, T = bvh.numTris, V = mesh.vertexCount, LEVELS = bvh.maxDepth + 1;
    if (LEVELS + 1 > LEVEL_HDR) throw new Error(`mesh shadows: ${LEVELS} tree levels do not fit the ${LEVEL_HDR}-word level header`);
    if (ch.skin.joints.length > 256 || JOINT_STRIDE > 256) throw new Error('mesh shadows: joint indices are packed as bytes');
    if (T >= 1 << 24 || LEAF_MAX > 255) throw new Error('mesh shadows: triStart | count << 24 packing');
    this.triBase = NODE_BASE + MESH_MAX_CHARS * N * 2;
    const elems = this.triBase + MESH_MAX_CHARS * T * 3;
    this.bytes = elems * 16;
    const S = GPUBufferUsage.STORAGE;
    this.buf = makeBuffer(device, this.bytes, S | GPUBufferUsage.COPY_DST, 'meshShadows');
    // header + every slot's node links with inside-out boxes (a never-refit slot walks as an empty tree; see the layout note)
    { const init = new Uint32Array(this.triBase * 4); const f = new Float32Array(init.buffer);
      init[0] = N; init[1] = NODE_BASE; init[2] = this.triBase; init[3] = T; init[4] = MESH_MAX_CHARS; init[5] = LEVELS; init[6] = LEAF_MAX; init[7] = 0;
      for (let k = 0; k < MESH_MAX_CHARS; k++) for (let i = 0; i < N; i++) {
        const o = (NODE_BASE + (k * N + i) * 2) * 4;
        f[o] = 1e18; f[o + 1] = 1e18; f[o + 2] = 1e18; init[o + 3] = bvh.skip[i];   // (±1e18: inside out, and × the walk's 1e20 inverse-direction clamp still finite in f32)
        f[o + 4] = -1e18; f[o + 5] = -1e18; f[o + 6] = -1e18; init[o + 7] = (bvh.triStart[i] | (bvh.triCount[i] << 24)) >>> 0;
      }
      device.queue.writeBuffer(this.buf, 0, init); }
    // static inputs: rest vertices (pos bits + packed joints, weight bits), corner → vertex, topology, level lists
    const rest = new Uint32Array(V * 8); { const f = new Float32Array(rest.buffer); const jn = mesh.joints;
      for (let v = 0; v < V; v++) { f[v * 8] = mesh.positions[v * 3]; f[v * 8 + 1] = mesh.positions[v * 3 + 1]; f[v * 8 + 2] = mesh.positions[v * 3 + 2]; rest[v * 8 + 3] = (jn[v * 4] | (jn[v * 4 + 1] << 8) | (jn[v * 4 + 2] << 16) | (jn[v * 4 + 3] << 24)) >>> 0; f.set(mesh.weights.subarray(v * 4, v * 4 + 4), v * 8 + 4); } }
    const topo = new Uint32Array(N * 4); for (let i = 0; i < N; i++) { topo[i * 4] = bvh.skip[i]; topo[i * 4 + 1] = bvh.triStart[i]; topo[i * 4 + 2] = bvh.triCount[i]; topo[i * 4 + 3] = Math.max(0, bvh.right[i]); }
    const levels = new Uint32Array(LEVEL_HDR + N); levels.set(bvh.levelOff, 0); levels.set(bvh.levelNodes, LEVEL_HDR);
    const restBuf = makeBufferWithData(device, rest, S, 'meshRest'), cornerBuf = makeBufferWithData(device, bvh.corners, S, 'meshCorners'), topoBuf = makeBufferWithData(device, topo, S, 'meshTopo'), levelBuf = makeBufferWithData(device, levels, S, 'meshLevels');
    const CS = GPUShaderStage.COMPUTE;
    const layout = device.createBindGroupLayout({ label: 'meshShadows', entries: [
      { binding: 0, visibility: CS, buffer: { type: 'storage' } },
      { binding: 1, visibility: CS, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: CS, buffer: { type: 'read-only-storage' } }, { binding: 3, visibility: CS, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: CS, buffer: { type: 'read-only-storage' } }, { binding: 5, visibility: CS, buffer: { type: 'read-only-storage' } },
    ] });
    this.mod = makeShader(device, skinRefitSrc(N, T, LEVELS, this.triBase), 'meshShadows');
    this.pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });   // (skin + refit: init(), awaited by main.ts / the viewer before the first frame)
    this.bg = device.createBindGroup({ label: 'meshShadowsBG', layout, entries: [
      { binding: 0, resource: { buffer: this.buf } }, { binding: 1, resource: { buffer: restBuf } }, { binding: 2, resource: { buffer: cornerBuf } },
      { binding: 3, resource: { buffer: jointMats } }, { binding: 4, resource: { buffer: topoBuf } }, { binding: 5, resource: { buffer: levelBuf } },
    ] });
  }

  /** skin + refit, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync) — main.ts / the viewer await it before the first frame; never called headless */
  async init(): Promise<void> {
    if (this.pSkin && this.pRefit) return;
    [this.pSkin, this.pRefit] = await Promise.all([
      computePipelineAsync(this.device, { label: 'meshSkin', layout: this.pl, compute: { module: this.mod, entryPoint: 'skin' } }),
      computePipelineAsync(this.device, { label: 'meshRefit', layout: this.pl, compute: { module: this.mod, entryPoint: 'refit' } }) ]);
  }

  /** WGSL source of the two passes (for a compile check through the page's __wgsl with no prelude) */
  source(): string { return skinRefitSrc(this.bvh.numNodes, this.bvh.numTris, this.bvh.maxDepth + 1, this.triBase); }

  /** Skin + refit the first `numChars` characters' trees (their joint matrices must already be in jointMats for this frame — CharacterRenderer.finish).
   *  Encode BEFORE any pass that traces (the cascades come first in engine.render). */
  encode(enc: GPUCommandEncoder, numChars: number, ts?: GPUComputePassTimestampWrites) {
    const n = Math.min(Math.max(0, numChars | 0), MESH_MAX_CHARS); this.lastChars = n;
    if (n === 0) return;
    const p = enc.beginComputePass({ label: 'meshShadows', timestampWrites: ts });
    p.setBindGroup(0, this.bg);
    p.setPipeline(this.pSkin); p.dispatchWorkgroups(Math.ceil(this.bvh.numTris * 3 / 64), n);
    p.setPipeline(this.pRefit); p.dispatchWorkgroups(n);
    p.end();
  }

  /** Fixture replay: pose character slot 0 with `joints` (SkeletonInstance.jointData layout, ≤ JOINT_STRIDE mat4s), skin + refit it, and run the production
   *  WGSL walk over `rays` (8 floats each: ro.xyz, tmax, rd.xyz, skipOwner). Resolves to 4 floats per ray: t from meshAnyHitChar(0) (−1 clear), t from
   *  meshShadowT over every character in the scene's list, the header's node count, 0. Clobbers slot 0's joints until the next frame rewrites them —
   *  use it on a ?paused page. `sceneBG` = the engine's scene bind group (Engine.sceneBindGroup()). */
  async debugTrace(sceneLayout: GPUBindGroupLayout, sceneBG: GPUBindGroup, joints: Float32Array, rays: Float32Array): Promise<Float32Array> {
    const d = this.device; const n = (rays.length / 8) | 0; if (n === 0) return new Float32Array(0);
    if (!this.dbg) {
      const layout = d.createBindGroupLayout({ label: 'meshDbg', entries: [ { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } } ] });
      const pipe = d.createComputePipeline({ label: 'meshDbg', layout: d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, layout] }), compute: { module: makeShader(d, scenePrelude() + debugSrc, 'meshDbg'), entryPoint: 'main' } });
      this.dbg = { pipe, layout };
    }
    d.queue.writeBuffer(this.jointMats, 0, joints.buffer, joints.byteOffset, Math.min(joints.byteLength, JOINT_STRIDE * 64));
    const rayBuf = makeBufferWithData(d, rays, GPUBufferUsage.STORAGE, 'meshDbgRays');
    const outBuf = makeBuffer(d, n * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'meshDbgOut');
    const rd = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const bg = d.createBindGroup({ layout: this.dbg.layout, entries: [{ binding: 0, resource: { buffer: rayBuf } }, { binding: 1, resource: { buffer: outBuf } }] });
    const enc = d.createCommandEncoder({ label: 'meshDbg' });
    this.encode(enc, 1);
    { const p = enc.beginComputePass({ label: 'meshDbgWalk' }); p.setPipeline(this.dbg.pipe); p.setBindGroup(0, sceneBG); p.setBindGroup(1, bg); p.dispatchWorkgroups(Math.ceil(n / 64)); p.end(); }
    enc.copyBufferToBuffer(outBuf, 0, rd, 0, n * 16);
    d.queue.submit([enc.finish()]);
    await rd.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(rd.getMappedRange().slice(0)); rd.unmap(); rd.destroy(); rayBuf.destroy(); outBuf.destroy();
    return out;
  }
}
