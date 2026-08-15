// Minimal glTF 2.0 loader for skinned characters: nodes, one skin, mesh primitives, animations.
import { Quat, Vec3 } from '../math/vec';

export interface GltfNode { name: string; parent: number; children: number[]; t: Vec3; r: Quat; s: Vec3; }
export interface Track { node: number; path: 0 | 1 | 2; times: Float32Array; values: Float32Array; step: boolean; } // path: 0 T, 1 R, 2 S
export interface Clip { name: string; duration: number; tracks: Track[]; }
export interface SkinData { joints: number[]; inverseBind: Float32Array; } // joints: node indices; inverseBind: 16 floats per joint
export interface MeshData {
  positions: Float32Array; normals: Float32Array; weights: Float32Array; joints: Uint8Array | Uint16Array; matSel: Float32Array;
  indices: Uint32Array; vertexCount: number; jointsAreU16: boolean;
  bboxMin: Vec3; bboxMax: Vec3;
}
export interface GltfCharacter { nodes: GltfNode[]; order: number[]; roots: number[]; skin: SkinData; mesh: MeshData; clips: Map<string, Clip>; nodeByName: Map<string, number>; }

const COMP_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_N: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export async function loadGltfCharacter(url: string): Promise<GltfCharacter> {
  const res = await fetch(url); if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const g = await res.json();
  const base = url.substring(0, url.lastIndexOf('/') + 1);
  const bins: ArrayBuffer[] = [];
  for (const b of g.buffers) {
    const uri: string = b.uri ?? '';
    if (uri.startsWith('data:')) {   // embedded glTF (base64 buffer inline): decoded here rather than fetched, so it also loads where only JSON / JS can be served
      const b64 = uri.slice(uri.indexOf(',') + 1); const raw = atob(b64); const u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i); bins.push(u8.buffer);
    } else { const r = await fetch(/^(https?:)?\//.test(uri) ? uri : base + uri); if (!r.ok) throw new Error(`fetch ${uri}: ${r.status}`); bins.push(await r.arrayBuffer()); }
  }

  /** Read accessor into a tightly packed typed array (handles byteStride). */
  function readAccessor(i: number): { data: Float32Array | Uint8Array | Uint16Array | Uint32Array; n: number; count: number; comp: number } {
    const a = g.accessors[i]; const bv = g.bufferViews[a.bufferView];
    const n = TYPE_N[a.type]; const cs = COMP_SIZE[a.componentType]; const count = a.count;
    const buf = bins[bv.buffer]; const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = bv.byteStride ?? n * cs;
    const Ctor = a.componentType === 5126 ? Float32Array : a.componentType === 5121 ? Uint8Array : a.componentType === 5123 ? Uint16Array : a.componentType === 5125 ? Uint32Array : null;
    if (!Ctor) throw new Error('unsupported componentType ' + a.componentType);
    const out = new Ctor(count * n);
    if (stride === n * cs) {
      // fast path (copy respecting alignment)
      const src = new Ctor(buf.slice(off, off + count * n * cs)); out.set(src);
    } else {
      const dv = new DataView(buf);
      for (let k = 0; k < count; k++) for (let c = 0; c < n; c++) {
        const p = off + k * stride + c * cs;
        (out as any)[k * n + c] = cs === 4 ? (a.componentType === 5126 ? dv.getFloat32(p, true) : dv.getUint32(p, true)) : cs === 2 ? dv.getUint16(p, true) : dv.getUint8(p);
      }
    }
    return { data: out, n, count, comp: a.componentType };
  }

  // ---- nodes ----
  const nodes: GltfNode[] = g.nodes.map((nd: any) => ({ name: nd.name ?? '', parent: -1, children: nd.children ?? [], t: nd.translation ?? [0, 0, 0], r: nd.rotation ?? [0, 0, 0, 1], s: nd.scale ?? [1, 1, 1] }));
  nodes.forEach((nd, i) => nd.children.forEach(c => (nodes[c].parent = i)));
  const roots: number[] = g.scenes[g.scene ?? 0].nodes;
  const order: number[] = [];
  const visit = (i: number) => { order.push(i); for (const c of nodes[i].children) visit(c); };
  roots.forEach(visit);
  const nodeByName = new Map<string, number>(); nodes.forEach((nd, i) => nodeByName.set(nd.name, i));

  // ---- skin ----
  const sk = g.skins[0];
  const skin: SkinData = { joints: sk.joints, inverseBind: readAccessor(sk.inverseBindMatrices).data as Float32Array };

  // ---- mesh (merge all primitives of the first skinned mesh) ----
  const meshNode = g.nodes.findIndex((nd: any) => nd.mesh !== undefined && nd.skin !== undefined);
  const mesh = g.meshes[g.nodes[meshNode].mesh];
  let vcount = 0, icount = 0;
  const prims = mesh.primitives.map((p: any, pi: number) => {
    const pos = readAccessor(p.attributes.POSITION), nrm = readAccessor(p.attributes.NORMAL), jn = readAccessor(p.attributes.JOINTS_0), wt = readAccessor(p.attributes.WEIGHTS_0), idx = readAccessor(p.indices);
    vcount += pos.count; icount += idx.count;
    return { pos, nrm, jn, wt, idx, mat: p.material ?? pi };
  });
  const jointsAreU16 = prims.some((p: any) => p.jn.comp === 5123);
  const md: MeshData = {
    positions: new Float32Array(vcount * 3), normals: new Float32Array(vcount * 3), weights: new Float32Array(vcount * 4),
    joints: jointsAreU16 ? new Uint16Array(vcount * 4) : new Uint8Array(vcount * 4), matSel: new Float32Array(vcount), indices: new Uint32Array(icount), vertexCount: vcount, jointsAreU16,
    bboxMin: [1e9, 1e9, 1e9], bboxMax: [-1e9, -1e9, -1e9],
  };
  let vo = 0, io = 0;
  for (const p of prims) {
    md.positions.set(p.pos.data as Float32Array, vo * 3); md.normals.set(p.nrm.data as Float32Array, vo * 3);
    // weights may be u8/u16 normalized in some files; here f32. Renormalize anyway.
    const w = p.wt.data; const wn = p.wt.comp === 5126 ? 1 : p.wt.comp === 5121 ? 1 / 255 : 1 / 65535;
    for (let k = 0; k < p.pos.count; k++) {
      let a = w[k * 4] * wn, b = w[k * 4 + 1] * wn, c = w[k * 4 + 2] * wn, d = w[k * 4 + 3] * wn; const s = a + b + c + d || 1;
      md.weights[(vo + k) * 4] = a / s; md.weights[(vo + k) * 4 + 1] = b / s; md.weights[(vo + k) * 4 + 2] = c / s; md.weights[(vo + k) * 4 + 3] = d / s;
      for (let c2 = 0; c2 < 4; c2++) md.joints[(vo + k) * 4 + c2] = p.jn.data[k * 4 + c2];
      md.matSel[vo + k] = p.mat === prims[0].mat ? 0 : 1;
      const x = md.positions[(vo + k) * 3], y = md.positions[(vo + k) * 3 + 1], z = md.positions[(vo + k) * 3 + 2];
      md.bboxMin = [Math.min(md.bboxMin[0], x), Math.min(md.bboxMin[1], y), Math.min(md.bboxMin[2], z)];
      md.bboxMax = [Math.max(md.bboxMax[0], x), Math.max(md.bboxMax[1], y), Math.max(md.bboxMax[2], z)];
    }
    const ix = p.idx.data; for (let k = 0; k < p.idx.count; k++) md.indices[io + k] = ix[k] + vo;
    vo += p.pos.count; io += p.idx.count;
  }

  // ---- animations ----
  const clips = new Map<string, Clip>();
  for (const an of g.animations ?? []) {
    const tracks: Track[] = []; let duration = 0;
    for (const ch of an.channels) {
      const smp = an.samplers[ch.sampler]; const path = ch.target.path;
      if (path !== 'translation' && path !== 'rotation' && path !== 'scale') continue;
      const times = readAccessor(smp.input).data as Float32Array; const values = readAccessor(smp.output).data as Float32Array;
      duration = Math.max(duration, times[times.length - 1]);
      tracks.push({ node: ch.target.node, path: path === 'translation' ? 0 : path === 'rotation' ? 1 : 2, times, values, step: smp.interpolation === 'STEP' });
    }
    clips.set(an.name, { name: an.name, duration: Math.max(duration, 1 / 30), tracks });
  }
  return { nodes, order, roots, skin, mesh: md, clips, nodeByName };
}
