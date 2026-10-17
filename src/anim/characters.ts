// GPU resources for instanced skinned characters sharing one mesh (SkinnedDrawable for the G-buffer pass).
import { makeBuffer, makeBufferWithData, writeWordsIfChanged } from '../gpu/device';
import { SkinnedDrawable } from '../render/gbuffer';
import { GltfCharacter } from './gltf';
import { Vec3 } from '../math/vec';
import { CHAR_MAT_FLOATS, charSlots } from '../render/charMaterials';

export const JOINT_STRIDE = 64; // joint slots per character in the jointMats buffer
export const MAX_CHARS = 16;
/** bytes per CharInst (gbuffer.wgsl): tint.xyz + jointOffset · tint2.xyz + owner · wet (coat, beads, rain, phase) · wetK (bead density, bead size, trail length, roughness wet) ·
 *  wetK2 (roughness dry, darken exponent, darken multiplier, specular gain) · wetK3 (waterline height in bind-pose m above the sole, the wicking band above it, THE CAST'S PART MASK as u32
 *  bits, 0) — the last four rows are the wet-character look (game/wet.ts), all zero for a dry man; the part mask (anim/gltf.ts loadGltfCast: which parts of the cast mesh this man wears)
 *  is 0 on the mannequin = every vertex drawn, the two tints by matSel, exactly as it always was */
export const CHAR_INST_BYTES = 96;
const INST_F32 = CHAR_INST_BYTES / 4;
const PARTS_AT = 22;   // gbuffer.wgsl CharInst.parts: the word after wetK3's two floats (a u32 on both sides — never through a float: a mask's bit pattern can be a denormal or a NaN)
/** bytes per instance in `charMats` (render/charMaterials.ts: CHAR_MAT_ROWS vec4 rows — the per-slot materials; all zero = the two tints above, as ever) */
export const CHAR_MAT_BYTES = CHAR_MAT_FLOATS * 4;

export class CharacterRenderer implements SkinnedDrawable {
  vertexBuf: GPUBuffer; jointBuf: GPUBuffer; indexBuf: GPUBuffer; indexCount: number; indexFormat: GPUIndexFormat = 'uint32';
  jointMats: GPUBuffer; charInsts: GPUBuffer; instanceCount = 0;
  /** CHARACTER MATERIALS (render/charMaterials.ts): per vertex (slot, cavity) as a second attribute buffer, per instance the slot rows — zeros until setMaterials says otherwise */
  slotBuf: GPUBuffer; charMats: GPUBuffer;
  private matData = new Float32Array(MAX_CHARS * CHAR_MAT_FLOATS); private matDirty = true; private slotsUp = false;
  jointsFormat: GPUVertexFormat;
  private instData = new Float32Array(MAX_CHARS * INST_F32); private instU32 = new Uint32Array(this.instData.buffer);
  private jointStaging = new Float32Array(MAX_CHARS * JOINT_STRIDE * 16);
  private instSent = new Uint32Array(MAX_CHARS * INST_F32);   // charInsts as last written (gpu/device.ts writeWordsIfChanged)

  constructor(private device: GPUDevice, public ch: GltfCharacter) {
    const m = ch.mesh; const n = m.vertexCount;
    const inter = new Float32Array(n * 11);
    for (let i = 0; i < n; i++) {
      inter.set(m.positions.subarray(i * 3, i * 3 + 3), i * 11);
      inter.set(m.normals.subarray(i * 3, i * 3 + 3), i * 11 + 3);
      inter.set(m.weights.subarray(i * 4, i * 4 + 4), i * 11 + 6);
      inter[i * 11 + 10] = m.matSel[i];
    }
    this.vertexBuf = makeBufferWithData(device, inter, GPUBufferUsage.VERTEX, 'charVerts');
    // joints: upload as u8x4 or u16x4
    if (m.jointsAreU16) { this.jointBuf = makeBufferWithData(device, m.joints as Uint16Array, GPUBufferUsage.VERTEX, 'charJoints'); this.jointsFormat = 'uint16x4'; }
    else { this.jointBuf = makeBufferWithData(device, m.joints as Uint8Array, GPUBufferUsage.VERTEX, 'charJoints'); this.jointsFormat = 'uint8x4'; }
    this.indexBuf = makeBufferWithData(device, m.indices, GPUBufferUsage.INDEX, 'charIdx'); this.indexCount = m.indices.length;
    this.jointMats = makeBuffer(device, MAX_CHARS * JOINT_STRIDE * 64, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'jointMats');   // (COPY_SRC: the g-buffer keeps last frame's palette for the skinned motion vectors — render/gbuffer.ts snapshotPrev)
    this.charInsts = makeBuffer(device, MAX_CHARS * CHAR_INST_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'charInsts');
    this.slotBuf = makeBuffer(device, n * 8, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'charSlots');   // zeros until the first man has rows (setMaterials): nothing reads it before
    this.charMats = makeBuffer(device, MAX_CHARS * CHAR_MAT_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'charMats');
    if (ch.skin.joints.length > JOINT_STRIDE) throw new Error('too many joints');
    this.partSpans = partSpansOf(m.indices, m.part);
  }

  /** THE CAST, DRAWN BY WHAT IS WORN: each part's span of the index buffer (first index, index count), or null when the mesh has no parts (the mannequin) or they are not whole
   *  contiguous spans. vsSkin collapses every vertex of a part a man does not wear outside the clip volume — all three corners of each of its triangles, since a triangle is one
   *  part's — so those triangles never reach the raster; drawRuns hands the g-buffer the spans of the parts he DOES wear, in index order, and the rest are simply not submitted. */
  private partSpans: Uint32Array | null; private masks = new Uint32Array(MAX_CHARS); private runsByMask = new Map<number, Uint32Array>();
  /** instance i's index runs as (first index, index count) pairs in index order — null = the whole mesh (mask 0, the mannequin: one draw, as it always was) */
  drawRuns(i: number): Uint32Array | null {
    const mask = this.masks[i], sp = this.partSpans; if (mask === 0 || !sp) return null;
    let r = this.runsByMask.get(mask);
    if (!r) {
      const worn: number[] = [];   // (span index order = part order checked ascending by partSpansOf; adjacent worn spans fuse into one run)
      for (let p = 0; p < sp.length / 2; p++) {
        if (((mask >>> p) & 1) === 0 || sp[p * 2 + 1] === 0) continue;
        const n = worn.length;
        if (n > 0 && worn[n - 2] + worn[n - 1] === sp[p * 2]) worn[n - 1] += sp[p * 2 + 1]; else worn.push(sp[p * 2], sp[p * 2 + 1]);
      }
      this.runsByMask.set(mask, r = Uint32Array.from(worn));
    }
    return r;
  }

  /** Set instance i's joint matrices + tint; call finish() after all instances. `wet` writes the sixteen wet-look floats at the given offset of the instance
   *  block (game/wet.ts wetInstance + wetKnobs + wetLineRow: coat, beads, rain, phase, the eight look knobs, the waterline row) — omitted (the viewer, a dry man) they are zero, and the
   *  g-buffer shades him exactly as it always did. `parts`: the cast's part mask for this man (0 = the mannequin: everything, as it was). */
  setInstance(i: number, jointData: Float32Array, tint: Vec3, tint2: Vec3, owner: number, wet?: (out: Float32Array, offset: number) => void, parts = 0) {
    this.jointStaging.set(jointData, i * JOINT_STRIDE * 16);
    const o = i * INST_F32; const f = this.instData, u = this.instU32;
    f[o] = tint[0]; f[o + 1] = tint[1]; f[o + 2] = tint[2]; u[o + 3] = i * JOINT_STRIDE;
    f[o + 4] = tint2[0]; f[o + 5] = tint2[1]; f[o + 6] = tint2[2]; u[o + 7] = owner >>> 0;
    if (wet) wet(f, o + 8); else f.fill(0, o + 8, o + INST_F32);
    u[o + PARTS_AT] = parts >>> 0; this.masks[i] = parts >>> 0;
  }
  /** Instance i's material rows for this frame: `write` fills CHAR_MAT_FLOATS floats at the offset it is handed (charMaterials.ts writeCharPalette), omitted = zeros = the
   *  two tints. Uploaded by finish() only when a row changed, so a frame with the switch off — every frame, by default — writes nothing after the first. */
  setMaterials(i: number, write?: (out: Float32Array, offset: number) => void) {
    const o = i * CHAR_MAT_FLOATS; const f = this.matData;
    if (!write) { if (f[o] !== 0) { f.fill(0, o, o + CHAR_MAT_FLOATS); this.matDirty = true; } return; }
    if (!this.slotsUp) {   // the mesh's slot + cavity per vertex: solved and uploaded the first time anybody wears a table (the bake is tens of ms — never paid with the switch off)
      const m = this.ch.mesh; const sd = charSlots(this.ch); const sg = new Float32Array(m.vertexCount * 2);
      for (let v = 0; v < m.vertexCount; v++) { sg[v * 2] = sd.slot[v]; sg[v * 2 + 1] = sd.cavity[v]; }
      this.device.queue.writeBuffer(this.slotBuf, 0, sg); this.slotsUp = true;
    }
    const was = this.scratch; was.set(f.subarray(o, o + CHAR_MAT_FLOATS)); write(f, o);
    for (let k = 0; k < CHAR_MAT_FLOATS; k++) if (f[o + k] !== was[k]) { this.matDirty = true; break; }
  }
  private scratch = new Float32Array(CHAR_MAT_FLOATS);
  // DRAWING BETWEEN TICKS (host/tween.ts): the palette as the last tick staged it (instance i's joints at i × jointFloats), who instance i is, and a write of the PICTURE's own
  // palette — a blend of two ticks', in an array of the caller's — over the GPU's copy. The staging is never written by it: what the game staged is what the next tick finds.
  get staged(): Float32Array { return this.jointStaging; }
  readonly jointFloats = JOINT_STRIDE * 16;
  ownerOf(i: number): number { return this.instU32[i * INST_F32 + 7]; }
  drawJoints(data: Float32Array, count: number) { if (count > 0) this.device.queue.writeBuffer(this.jointMats, 0, data.buffer, data.byteOffset, count * JOINT_STRIDE * 64); }
  finish(count: number) {
    this.instanceCount = count;
    if (this.matDirty) { this.device.queue.writeBuffer(this.charMats, 0, this.matData.buffer, 0, MAX_CHARS * CHAR_MAT_BYTES); this.matDirty = false; }
    if (count === 0) return;
    this.device.queue.writeBuffer(this.jointMats, 0, this.jointStaging.buffer, 0, count * JOINT_STRIDE * 64);
    writeWordsIfChanged(this.device, this.charInsts, 0, this.instU32, this.instSent, count * INST_F32);   // (tints, owners, the wet rows, the part masks: the same words while nobody's coat or kit changes)
  }
}

/** Each part's span of the index buffer as (first index, index count) pairs by part index — or null unless EVERY triangle's three corners are one part's and the parts' triangles lie
 *  in the buffer as contiguous spans in ascending part order (anim/gltf.ts loadGltfCast builds it so; anything else keeps the one whole-mesh draw). */
function partSpansOf(indices: Uint32Array, part: Uint8Array | undefined): Uint32Array | null {
  if (!part) return null;
  let top = 0; for (let v = 0; v < part.length; v++) if (part[v] > top) top = part[v];
  if (top > 31) return null;
  const sp = new Uint32Array((top + 1) * 2); let last = -1;
  for (let k = 0; k + 2 < indices.length; k += 3) {
    const p = part[indices[k]]; if (part[indices[k + 1]] !== p || part[indices[k + 2]] !== p) return null;
    if (p !== last) { if (p < last || sp[p * 2 + 1] !== 0) return null; sp[p * 2] = k; last = p; }
    sp[p * 2 + 1] += 3;
  }
  return sp;
}
