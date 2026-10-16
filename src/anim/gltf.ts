// Minimal glTF 2.0 loader for skinned characters: nodes, one skin, mesh primitives, animations.
import { Quat, Vec3 } from '../math/vec';
import { lookDress } from '../scene/look';

export interface GltfNode { name: string; parent: number; children: number[]; t: Vec3; r: Quat; s: Vec3; }
export interface Track { node: number; path: 0 | 1 | 2; times: Float32Array; values: Float32Array; step: boolean; } // path: 0 T, 1 R, 2 S
export interface Clip { name: string; duration: number; tracks: Track[]; }
export interface SkinData { joints: number[]; inverseBind: Float32Array; } // joints: node indices; inverseBind: 16 floats per joint
export interface MeshData {
  positions: Float32Array; normals: Float32Array; weights: Float32Array; joints: Uint8Array | Uint16Array; matSel: Float32Array;
  indices: Uint32Array; vertexCount: number; jointsAreU16: boolean;
  bboxMin: Vec3; bboxMax: Vec3;
  /** THE CAST (loadGltfCast): the PART each vertex belongs to (index into CastInfo.parts) — absent on the mannequin, whose matSel is 0 / 1 and whose every vertex is always drawn */
  part?: Uint8Array;
  /** per vertex: the glTF material index of its primitive (255 = it names none), and the file's material names by that index — what render/charMaterials.ts deals the material slots from */
  matIndex?: Uint8Array; materialNames?: string[];
}
/** THE CAST (public/assets/chars/cast.gltf, built by tools/chars — loadGltfCast): the character mesh as a set of PARTS (helmet, vest, shirt, a head…) on the mannequin's skeleton, and the
 *  VARIANTS a character can be (a variant = the parts one man wears, as a bit mask over `parts`). The faces carry one of the eleven material SLOTS (SLOT_NAMES) in matSel's low four bits. */
export interface CastVariant { name: string; side: CastSide; parts: string[]; mask: number; tris: number; }
export type CastSide = 'operator' | 'defender' | 'civilian' | 'responder';   // (responder: the trained response element — staff, but one outfit for all of them)
export interface CastInfo { parts: string[]; partTris: number[]; variants: CastVariant[]; }
export interface GltfCharacter { nodes: GltfNode[]; order: number[]; roots: number[]; skin: SkinData; mesh: MeshData; clips: Map<string, Clip>; nodeByName: Map<string, number>; cast?: CastInfo; }

/** the material slots a cast face is assigned to — the contract between the models and their shading: the glTF material NAME on a primitive is one of these, and the vertex carries its
 *  index (matSel = slot + CAST_PART_STEP × part; gbuffer.wgsl vsSkin / slotAlbedo). Order is the id: never reorder, append only. */
export const SLOT_NAMES = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet', 'metal_dark', 'rubber', 'lens', 'accent', 'eye'] as const;   // accent = the member's marking colour (a helmet band, a brassard); eye = the whites of the eyes
/** THE GOGGLES RULE, for whoever draws a man of the cast: `boxes` = the rig's own box goggles are drawn on him (rigProps) → neither mesh pair; else, where his variant lists a
 *  pair, the mesh pair flipped UP on the mount (kit he carries, never down and dark over his eyes). A variant with no goggles comes back as it is. */
const nvgBits = new WeakMap<CastInfo, { up: number; down: number }>();
export function castGoggles(cast: CastInfo, mask: number, boxes: boolean): number {
  let nb = nvgBits.get(cast);
  if (!nb) { const bit = (n: string) => { const i = cast.parts.indexOf(n); return i < 0 ? 0 : (1 << i) >>> 0; }; nvgBits.set(cast, nb = { up: bit('nvg_up'), down: bit('nvg_down') }); }
  const { up, down } = nb; if (!(mask & (up | down))) return mask >>> 0;
  const bare = (mask & ~(up | down)) >>> 0;
  return boxes ? bare : (bare | (up || down)) >>> 0;
}
/** THE SNEAKING SUIT's mask (game/cast.ts sneakSuit says who wears it and when): a variant's own parts less the helmet and every `kit_*` (the back kit: radio, ram,
 *  packs) and less the mesh goggles, which hang on the helmet's mount — by name, so a cast file without those parts loses nothing. Here, beside castGoggles, so the
 *  game's castParts and the proxy fits solved ahead of play (render/sdfrig.ts fitRigCast) read ONE rule. */
const suitBits = new WeakMap<CastInfo, number>();
export function castSuit(cast: CastInfo, mask: number): number {
  let b = suitBits.get(cast);
  if (b === undefined) { b = 0; cast.parts.forEach((n, i) => { if (n === 'helmet' || n.startsWith('kit_')) b = (b! | (1 << i)) >>> 0; }); suitBits.set(cast, b); }
  return castGoggles(cast, (mask & ~b) >>> 0, true);
}
export const CAST_PART_STEP = 16;   // matSel = slot + 16 × part (exact in the f32 the vertex carries: ≤ 15 + 16 × 31)
export const CAST_MAX_PARTS = 32;   // a variant is a u32 mask over the parts

const COMP_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_N: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

type Accessor = { data: Float32Array | Uint8Array | Uint16Array | Uint32Array; n: number; count: number; comp: number };
/** fetch + parse a .gltf and its buffers (external .bin or embedded data URI); `readAccessor(i)` = accessor i as a tightly packed typed array */
async function openGltf(url: string): Promise<{ g: any; readAccessor: (i: number) => Accessor }> {
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
  function readAccessor(i: number): Accessor {
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
  return { g, readAccessor };
}

export async function loadGltfCharacter(url: string): Promise<GltfCharacter> {
  const { g, readAccessor } = await openGltf(url);

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
    return { pos, nrm, jn, wt, idx, mat: p.material ?? pi, material: typeof p.material === 'number' && p.material < 255 ? p.material : 255 };
  });
  const jointsAreU16 = prims.some((p: any) => p.jn.comp === 5123);
  const md: MeshData = {
    positions: new Float32Array(vcount * 3), normals: new Float32Array(vcount * 3), weights: new Float32Array(vcount * 4),
    joints: jointsAreU16 ? new Uint16Array(vcount * 4) : new Uint8Array(vcount * 4), matSel: new Float32Array(vcount), indices: new Uint32Array(icount), vertexCount: vcount, jointsAreU16,
    bboxMin: [1e9, 1e9, 1e9], bboxMax: [-1e9, -1e9, -1e9],
    matIndex: new Uint8Array(vcount), materialNames: (g.materials ?? []).map((m: any) => m.name ?? ''),
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
      md.matSel[vo + k] = p.mat === prims[0].mat ? 0 : 1; md.matIndex![vo + k] = p.material;
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

/** THE CAST: the new character meshes (tools/chars/README.md is the file's contract) laid over a loaded mannequin — the SAME skeleton, skin and clips, a different mesh. Every node with a
 *  mesh and a skin is a PART (its name), every primitive's material NAME is its slot, joints are matched to the mannequin's BY NAME (the file's own node transforms and inverse bind
 *  matrices are not read: vertices are in the mannequin's bind space), and root `extras.cast.variants` says which parts each variant wears. Returns a new GltfCharacter sharing
 *  everything but `mesh` (+ `cast`) with `base`; throws on anything off contract, so a bad file falls back to the mannequin at the caller. */
export async function loadGltfCast(url: string, base: GltfCharacter): Promise<GltfCharacter> {
  const { g, readAccessor } = await openGltf(url);
  const baseJoint = new Map<string, number>(); base.skin.joints.forEach((node, k) => baseJoint.set(base.nodes[node].name, k));
  const sk = g.skins?.[0]; if (!sk) throw new Error('cast: no skin');
  const jmap: number[] = sk.joints.map((n: number) => { const name = g.nodes[n].name ?? ''; const k = baseJoint.get(name); if (k === undefined) throw new Error(`cast: joint '${name}' is not on the mannequin's skeleton`); return k; });
  const slotOf = (mi: number | undefined): number => { const name = String(g.materials?.[mi ?? -1]?.name ?? '').replace(/\.\d+$/, ''); const s = (SLOT_NAMES as readonly string[]).indexOf(name); if (s < 0) throw new Error(`cast: material '${name}' is not a slot (${SLOT_NAMES.join(' ')})`); return s; };
  const partNodes: any[] = g.nodes.filter((nd: any) => nd.mesh !== undefined && nd.skin !== undefined);
  if (!partNodes.length) throw new Error('cast: no skinned mesh');
  if (partNodes.length > CAST_MAX_PARTS) throw new Error(`cast: ${partNodes.length} parts, at most ${CAST_MAX_PARTS}`);
  const parts: string[] = partNodes.map(nd => String(nd.name ?? ''));
  if (new Set(parts).size !== parts.length) throw new Error('cast: part names are not unique');
  let vcount = 0, icount = 0; const partTris: number[] = [];
  const prims = partNodes.flatMap((nd, part) => { let tris = 0; const out = g.meshes[nd.mesh].primitives.map((p: any) => {
    if ((p.mode ?? 4) !== 4) throw new Error(`cast: part '${parts[part]}' has a primitive that is not triangles`);
    if (nd.skin !== 0) throw new Error(`cast: part '${parts[part]}' is not on skin 0`);
    for (const a of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) if (p.attributes?.[a] === undefined) throw new Error(`cast: part '${parts[part]}' has a primitive with no ${a}`);
    if (p.indices === undefined) throw new Error(`cast: part '${parts[part]}' has a primitive with no indices`);
    const pos = readAccessor(p.attributes.POSITION), nrm = readAccessor(p.attributes.NORMAL), jn = readAccessor(p.attributes.JOINTS_0), wt = readAccessor(p.attributes.WEIGHTS_0), idx = readAccessor(p.indices);
    if (pos.comp !== 5126 || pos.n !== 3 || nrm.comp !== 5126 || nrm.n !== 3 || jn.n !== 4 || wt.n !== 4) throw new Error(`cast: part '${parts[part]}' has an attribute of the wrong type`);
    if (nrm.count !== pos.count || jn.count !== pos.count || wt.count !== pos.count || idx.count % 3 !== 0) throw new Error(`cast: part '${parts[part]}' has attributes of different lengths, or indices that are not whole triangles`);
    vcount += pos.count; icount += idx.count; tris += idx.count / 3;
    return { pos, nrm, jn, wt, idx, part, slot: slotOf(p.material) };
  }); partTris.push(tris); return out; });
  const md: MeshData = {
    positions: new Float32Array(vcount * 3), normals: new Float32Array(vcount * 3), weights: new Float32Array(vcount * 4), joints: new Uint8Array(vcount * 4), matSel: new Float32Array(vcount),
    indices: new Uint32Array(icount), vertexCount: vcount, jointsAreU16: false, bboxMin: [1e9, 1e9, 1e9], bboxMax: [-1e9, -1e9, -1e9], part: new Uint8Array(vcount),
  };
  let vo = 0, io = 0;
  for (const p of prims) {
    md.positions.set(p.pos.data as Float32Array, vo * 3); md.normals.set(p.nrm.data as Float32Array, vo * 3);
    const w = p.wt.data; const wn = p.wt.comp === 5126 ? 1 : p.wt.comp === 5121 ? 1 / 255 : 1 / 65535;
    for (let k = 0; k < p.pos.count; k++) {
      const v = vo + k; let sum = 0;
      for (let c = 0; c < 4; c++) { const x = w[k * 4 + c] * wn; md.weights[v * 4 + c] = x; sum += x; if (x > 0) { const j = jmap[p.jn.data[k * 4 + c]]; if (j === undefined) throw new Error(`cast: part '${parts[p.part]}' is weighted to a joint index past the skin's list`); md.joints[v * 4 + c] = j; } else md.joints[v * 4 + c] = 0; }
      if (!(sum > 0)) throw new Error(`cast: part '${parts[p.part]}' has a vertex with no weight`);
      for (let c = 0; c < 4; c++) md.weights[v * 4 + c] /= sum;
      md.matSel[v] = p.slot + CAST_PART_STEP * p.part; md.part![v] = p.part;
      for (let c = 0; c < 3; c++) { const x = md.positions[v * 3 + c]; if (!Number.isFinite(x)) throw new Error(`cast: part '${parts[p.part]}' has a non-finite position`); md.bboxMin[c] = Math.min(md.bboxMin[c], x); md.bboxMax[c] = Math.max(md.bboxMax[c], x); }
    }
    const ix = p.idx.data; for (let k = 0; k < p.idx.count; k++) { if (ix[k] >= p.pos.count) throw new Error(`cast: part '${parts[p.part]}' indexes past its vertices`); md.indices[io + k] = ix[k] + vo; }
    vo += p.pos.count; io += p.idx.count;
  }
  const decl: Record<string, { side?: string; parts?: string[] }> = g.extras?.cast?.variants ?? { all: { side: 'operator', parts } };
  const variants: CastVariant[] = Object.keys(decl).sort().map(name => {
    const d = decl[name]; const side = d.side as CastSide; if (side !== 'operator' && side !== 'defender' && side !== 'civilian' && side !== 'responder') throw new Error(`cast: variant '${name}' has side '${d.side}'`);
    let mask = 0, tris = 0; for (const pn of d.parts ?? []) { const i = parts.indexOf(pn); if (i < 0) throw new Error(`cast: variant '${name}' wears '${pn}', which is not a part`); mask |= 1 << i; tris += partTris[i]; }
    if (!mask) throw new Error(`cast: variant '${name}' wears nothing`);
    return { name, side, parts: [...(d.parts ?? [])], mask: mask >>> 0, tris };
  });
  return { ...base, mesh: md, cast: { parts, partTris, variants } };
}

/** The character a page boots with: the mannequin (skeleton, skin, clips — and its mesh) and, when `castUrl` is given, THE CAST's meshes over it. A cast that is missing or off contract
 *  costs one console error and leaves the mannequin: the game always has somebody to draw. */
export async function loadCharacterSet(baseUrl: string, castUrl: string | null): Promise<GltfCharacter> {
  const base = await loadGltfCharacter(baseUrl);
  if (!castUrl) return base;
  try { return await loadGltfCast(castUrl, base); } catch (e) { console.error('cast: the new character meshes did not load — the mannequin stands in', e); return base; }
}
/** where the cast is, for a page: null under `?mannequin` (the build as it was: one mannequin mesh for everybody) */
/** THE CAST'S FILE: today's, or the look's (scene/look.ts LOOK — one switch for the whole look: the defenders in local dress, the operators' helmet with its rails; built by the
 *  same tools/chars builder under `--look gwot`, same skeleton, slots and contract, its own 32 parts). Everything that loads a cast asks here. */
export const CAST_FILE = 'cast.gltf', CAST_FILE_LOOK = 'cast-gwot.gltf';
export function castFile(look = lookDress()): string { return look ? CAST_FILE_LOOK : CAST_FILE; }
export function castUrlFor(search: string, baseURI: string): string | null { return new URLSearchParams(search).has('mannequin') ? null : new URL('assets/chars/' + castFile(), baseURI).href; }

/** the variants of one side, in name order (operator_1 …) — every side falls back to all of them, so a file with only operators still dresses everybody (the responders to the
 *  defenders first) */
export function castSide(cast: CastInfo, side: CastSide): CastVariant[] {
  const v = cast.variants.filter(x => x.side === side); if (v.length) return v;
  if (side === 'responder') { const d = cast.variants.filter(x => x.side === 'defender'); if (d.length) return d; }   // (a file with no response outfit: they dress as the staff they are)
  return cast.variants;
}
