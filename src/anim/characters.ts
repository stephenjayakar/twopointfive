// GPU resources for instanced skinned characters sharing one mesh (SkinnedDrawable for the G-buffer pass).
import { makeBuffer, makeBufferWithData } from '../gpu/device';
import { SkinnedDrawable } from '../render/gbuffer';
import { GltfCharacter } from './gltf';
import { Vec3 } from '../math/vec';

export const JOINT_STRIDE = 64; // joint slots per character in the jointMats buffer
export const MAX_CHARS = 16;
/** bytes per CharInst (gbuffer.wgsl): tint.xyz + jointOffset · tint2.xyz + owner · wet (coat, beads, rain, phase) · wetK (bead density, bead size, trail length, roughness wet) ·
 *  wetK2 (roughness dry, darken exponent, darken multiplier, specular gain) · wetK3 (waterline height in bind-pose m above the sole, the wicking band above it, 0, 0) — the last four
 *  rows are the wet-character look (game/wet.ts), all zero for a dry man */
export const CHAR_INST_BYTES = 96;
const INST_F32 = CHAR_INST_BYTES / 4;

export class CharacterRenderer implements SkinnedDrawable {
  vertexBuf: GPUBuffer; jointBuf: GPUBuffer; indexBuf: GPUBuffer; indexCount: number; indexFormat: GPUIndexFormat = 'uint32';
  jointMats: GPUBuffer; charInsts: GPUBuffer; instanceCount = 0;
  jointsFormat: GPUVertexFormat;
  private instData = new Float32Array(MAX_CHARS * INST_F32); private instU32 = new Uint32Array(this.instData.buffer);
  private jointStaging = new Float32Array(MAX_CHARS * JOINT_STRIDE * 16);

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
    if (ch.skin.joints.length > JOINT_STRIDE) throw new Error('too many joints');
  }

  /** Set instance i's joint matrices + tint; call finish() after all instances. `wet` writes the sixteen wet-look floats at the given offset of the instance
   *  block (game/wet.ts wetInstance + wetKnobs + wetLineRow: coat, beads, rain, phase, the eight look knobs, the waterline row) — omitted (the viewer, a dry man) they are zero, and the
   *  g-buffer shades him exactly as it always did. */
  setInstance(i: number, jointData: Float32Array, tint: Vec3, tint2: Vec3, owner: number, wet?: (out: Float32Array, offset: number) => void) {
    this.jointStaging.set(jointData, i * JOINT_STRIDE * 16);
    const o = i * INST_F32; const f = this.instData, u = this.instU32;
    f[o] = tint[0]; f[o + 1] = tint[1]; f[o + 2] = tint[2]; u[o + 3] = i * JOINT_STRIDE;
    f[o + 4] = tint2[0]; f[o + 5] = tint2[1]; f[o + 6] = tint2[2]; u[o + 7] = owner >>> 0;
    if (wet) wet(f, o + 8); else f.fill(0, o + 8, o + INST_F32);
  }
  finish(count: number) {
    this.instanceCount = count;
    if (count === 0) return;
    this.device.queue.writeBuffer(this.jointMats, 0, this.jointStaging.buffer, 0, count * JOINT_STRIDE * 64);
    this.device.queue.writeBuffer(this.charInsts, 0, this.instData.buffer, 0, count * CHAR_INST_BYTES);
  }
}
