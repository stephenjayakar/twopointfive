// Pose sampling / blending / layering and skinning matrix computation for a glTF character.
import { Mat4, Quat, Vec3, m4, quat, clamp } from '../math/vec';
import { Clip, GltfCharacter } from './gltf';
import { hyp3, hyp4 } from '../math/vec';

/** the identity rotation, shared and never written (the root's parent in the FK loops below) */
const IDENT: Quat = [0, 0, 0, 1];

/** Local pose: per node 10 floats [tx ty tz | qx qy qz qw | sx sy sz]. */
export class Pose {
  data: Float32Array;
  constructor(public numNodes: number) { this.data = new Float32Array(numNodes * 10); }
  copy(src: Pose) { this.data.set(src.data); return this; }
  rot(i: number): Quat { const d = this.data, o = i * 10 + 3; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; }
  setRot(i: number, q: Quat) { const d = this.data, o = i * 10 + 3; d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = q[3]; }
  pos(i: number): Vec3 { const d = this.data, o = i * 10; return [d[o], d[o + 1], d[o + 2]]; }
  setPos(i: number, p: Vec3) { const d = this.data, o = i * 10; d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; }
}

export function restPose(ch: GltfCharacter, out: Pose): Pose {
  ch.nodes.forEach((nd, i) => { const o = i * 10; out.data.set(nd.t, o); out.data.set(nd.r, o + 3); out.data.set(nd.s, o + 7); });
  return out;
}

/** Sample clip at time t (seconds, wrapped if loop) into pose (only nodes with tracks are written). */
export function sampleClip(clip: Clip, t: number, loop: boolean, out: Pose) {
  const dur = clip.duration;
  if (loop) { t = t % dur; if (t < 0) t += dur; } else t = Math.min(Math.max(t, 0), dur);
  const d = out.data;
  for (const tr of clip.tracks) {
    const times = tr.times, vals = tr.values; const n = times.length;
    const comps = tr.path === 1 ? 4 : 3; const o = tr.node * 10 + (tr.path === 0 ? 0 : tr.path === 1 ? 3 : 7);
    if (n === 1 || t <= times[0]) { for (let c = 0; c < comps; c++) d[o + c] = vals[c]; continue; }
    if (t >= times[n - 1]) { const b = (n - 1) * comps; for (let c = 0; c < comps; c++) d[o + c] = vals[b + c]; continue; }
    // binary search for k with times[k] <= t < times[k+1]
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
    const a = lo * comps, b = hi * comps;
    if (tr.step) { for (let c = 0; c < comps; c++) d[o + c] = vals[a + c]; continue; }
    const f = (t - times[lo]) / Math.max(1e-6, times[hi] - times[lo]);
    if (comps === 3) { for (let c = 0; c < 3; c++) d[o + c] = vals[a + c] + (vals[b + c] - vals[a + c]) * f; }
    else {
      // nlerp shortest arc
      let bx = vals[b], by = vals[b + 1], bz = vals[b + 2], bw = vals[b + 3];
      const ax = vals[a], ay = vals[a + 1], az = vals[a + 2], aw = vals[a + 3];
      if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let x = ax + (bx - ax) * f, y = ay + (by - ay) * f, z = az + (bz - az) * f, w = aw + (bw - aw) * f;
      const l = hyp4(x, y, z, w) || 1; d[o] = x / l; d[o + 1] = y / l; d[o + 2] = z / l; d[o + 3] = w / l;
    }
  }
}

/** out = lerp(a, b, w * mask[node]) — mask null means uniform weight. out may alias a. */
export function blendPose(a: Pose, b: Pose, w: number, mask: Float32Array | null, out: Pose) {
  const n = a.numNodes; const A = a.data, B = b.data, O = out.data;
  for (let i = 0; i < n; i++) {
    const t = mask ? w * mask[i] : w; const o = i * 10;
    if (t <= 0) { if (O !== A) for (let c = 0; c < 10; c++) O[o + c] = A[o + c]; continue; }
    if (t >= 1) { for (let c = 0; c < 10; c++) O[o + c] = B[o + c]; continue; }
    for (let c = 0; c < 3; c++) O[o + c] = A[o + c] + (B[o + c] - A[o + c]) * t;
    for (let c = 7; c < 10; c++) O[o + c] = A[o + c] + (B[o + c] - A[o + c]) * t;
    let bx = B[o + 3], by = B[o + 4], bz = B[o + 5], bw = B[o + 6];
    const ax = A[o + 3], ay = A[o + 4], az = A[o + 5], aw = A[o + 6];
    if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t, ww = aw + (bw - aw) * t;
    const l = hyp4(x, y, z, ww) || 1; O[o + 3] = x / l; O[o + 4] = y / l; O[o + 5] = z / l; O[o + 6] = ww / l;
  }
}

export interface TwistSpec { node: number; yaw: number; pitch: number; } // model-space yaw (about +Y) and pitch (about model right axis after yaw) applied at this node
/** Externally driven node (ragdoll): its model-space global rotation is `rot`, its origin `pos` if given (else it hangs off its parent as usual). Children
 *  without an override follow through their local transforms. */
export interface NodeOverride { rot: Quat; pos?: Vec3; }

/**
 * Computes model-space global matrices for all nodes from a local pose, with optional procedural
 * model-space twists (applied at given nodes; affects their whole subtree, pivoting at the node origin)
 * and optional per-node overrides (sparse array by node index) that replace a node's global rotation / origin outright.
 */
export class SkeletonInstance {
  globals: Mat4[];           // per node, model space
  globalRot: Quat[];         // per node rotation, model space
  jointData: Float32Array;   // numJoints * 16, world-space skinning matrices (world * global * ibm)
  private tmp = m4.create(); private local = m4.create();
  private ownRot: Quat[];    // per node: the array update() writes an untwisted, un-overridden node's global rotation into (globalRot[i] points at it then; a twisted node's is a fresh array, an overridden node's the override's own, as ever)
  private ibms: Mat4[]; private jointViews: Mat4[];   // per joint: its inverse-bind matrix as a view, and its 16 floats of jointData as a view (fixed at construction: no per-frame subarray / set)
  constructor(public ch: GltfCharacter) {
    this.globals = ch.nodes.map(() => m4.create());
    this.globalRot = ch.nodes.map(() => quat.ident()); this.ownRot = this.globalRot.slice();
    this.jointData = new Float32Array(ch.skin.joints.length * 16);
    const ibm = ch.skin.inverseBind;
    this.ibms = ch.skin.joints.map((_, j) => ibm.subarray(j * 16, j * 16 + 16) as unknown as Mat4);
    this.jointViews = ch.skin.joints.map((_, j) => this.jointData.subarray(j * 16, j * 16 + 16) as unknown as Mat4);
  }

  update(pose: Pose, world: Mat4, twists: TwistSpec[] | null, overrides: (NodeOverride | undefined)[] | null = null) {
    const { ch } = this; const d = pose.data;
    // several layers may push a twist for the same node (aim yaw, look, the gaze stabiliser): they ACCUMULATE — a Map built straight from the list kept only the last
    let twistMap: Map<number, TwistSpec> | null = null;
    if (twists && twists.length) { twistMap = new Map(); for (const t of twists) { const e = twistMap.get(t.node); if (e) twistMap.set(t.node, { node: t.node, yaw: e.yaw + t.yaw, pitch: e.pitch + t.pitch }); else twistMap.set(t.node, t); } }
    // (the CPU-frame lane: the pose's ten floats are read as scalars — the local rotation r, origin t and scale s were fresh arrays per node per frame — and the plain
    //  parent · local product is written straight into the node's global quaternion; every expression is quat.mul's / fromTRS's operand for operand, so the numbers are the same)
    for (const i of ch.order) {
      const nd = ch.nodes[i]; const o = i * 10;
      const rx = d[o + 3], ry = d[o + 4], rz = d[o + 5], rw = d[o + 6];
      const tx = d[o], ty = d[o + 1], tz = d[o + 2], sx = d[o + 7], sy = d[o + 8], sz = d[o + 9];
      const ov = overrides ? overrides[i] : undefined;
      if (ov) {   // driven from outside: global rotation as given, origin as given or where the parent puts it (parent scales are all ~1 in this rig, so composing T·R·S directly is fine)
        const t: Vec3 = [tx, ty, tz];
        const p = ov.pos ?? (nd.parent >= 0 ? m4.transformPoint(this.globals[nd.parent], t) : t);
        this.globalRot[i] = ov.rot; m4.fromTRSs(this.globals[i], p[0], p[1], p[2], ov.rot[0], ov.rot[1], ov.rot[2], ov.rot[3], sx, sy, sz); continue;
      }
      const parentRot = nd.parent >= 0 ? this.globalRot[nd.parent] : IDENT;
      const ax = parentRot[0], ay = parentRot[1], az = parentRot[2], aw = parentRot[3];
      const tw = twistMap?.get(i);
      let gr: Quat;   // = quat.mul(parentRot, r) — an untwisted node's goes into its own standing array (ownRot: one fresh array a node a frame otherwise; readers take the numbers at once and keep nothing, and a child is never its own parent, so the parent's four were read before this write)
      if (tw) gr = [aw * rx + ax * rw + ay * rz - az * ry, aw * ry - ax * rz + ay * rw + az * rx, aw * rz + ax * ry - ay * rx + az * rw, aw * rw - ax * rx - ay * ry - az * rz];
      else { gr = this.ownRot[i]; gr[0] = aw * rx + ax * rw + ay * rz - az * ry; gr[1] = aw * ry - ax * rz + ay * rw + az * rx; gr[2] = aw * rz + ax * ry - ay * rx + az * rw; gr[3] = aw * rw - ax * rx - ay * ry - az * rz; }
      let r: Quat | null = null;
      if (tw) {
        // model-space yaw about +Y then pitch about the yawed model X axis, applied to this subtree
        let extra = quat.yaw(tw.yaw);
        if (tw.pitch !== 0) { const right = quat.rotate(extra, [1, 0, 0]); extra = quat.mul(quat.axisAngle(right, tw.pitch), extra); }
        gr = quat.normalize(quat.mul(extra, gr));
        // convert back to a local rotation consistent with the new global: r = parentRot^-1 * gr
        r = quat.mul(quat.conj(parentRot), gr);
      }
      this.globalRot[i] = gr;
      if (r) m4.fromTRSs(this.local, tx, ty, tz, r[0], r[1], r[2], r[3], sx, sy, sz); else m4.fromTRSs(this.local, tx, ty, tz, rx, ry, rz, rw, sx, sy, sz);
      if (nd.parent >= 0) m4.mul(this.globals[i], this.globals[nd.parent], this.local); else m4.copy(this.globals[i], this.local);
    }
    // skinning matrices (world · global · inverse bind, written straight into the joint's slice of jointData)
    const joints = ch.skin.joints;
    for (let j = 0; j < joints.length; j++) {
      m4.mul(this.tmp, this.globals[joints[j]], this.ibms[j]);
      m4.mul(this.jointViews[j], world, this.tmp);
    }
  }

  /** Model-space origin of a node. */
  nodePos(node: number): Vec3 { const g = this.globals[node]; return [g[12], g[13], g[14]]; }

  /** Rewrite the rotations of `pose` so that plain FK (no twists) reproduces the globals of the last update(): parent⁻¹ · global per node. Freezes a
   *  procedurally twisted pose into an ordinary local one (the ragdoll keeps posing the un-driven joints — fingers, feet, face, in-between spine — from it). */
  bakeLocalRotations(pose: Pose) {
    const { ch } = this; const d = pose.data;
    for (const i of ch.order) {
      const nd = ch.nodes[i]; const r = nd.parent >= 0 ? quat.mul(quat.conj(this.globalRot[nd.parent]), this.globalRot[i]) : this.globalRot[i];
      const o = i * 10; d[o + 3] = r[0]; d[o + 4] = r[1]; d[o + 5] = r[2]; d[o + 6] = r[3];
    }
    return pose;
  }
}

/** Build a per-node mask: weight for listed node names and (optionally) all their descendants. */
export function buildMask(ch: GltfCharacter, entries: { name: string; w: number; subtree: boolean }[]): Float32Array {
  const mask = new Float32Array(ch.nodes.length);
  const setSub = (i: number, w: number) => { mask[i] = w; for (const c of ch.nodes[i].children) setSub(c, w); };
  for (const e of entries) {
    const i = ch.nodeByName.get(e.name); if (i === undefined) { console.warn('mask: missing node', e.name); continue; }
    if (e.subtree) setSub(i, e.w); else mask[i] = e.w;
  }
  return mask;
}

// ---------------------------------------------------------------- procedural posing helpers (model space = the un-twisted figure: +Y up, +Z its front, +X its left)

/** Forward kinematics of a local pose: model-space rotation and origin of every node (this rig's scales are all 1, so T·R composes directly). Cheap (55 nodes) —
 *  procedural layers re-run it whenever they need to know where a joint has got to. */
export class PoseFK {
  rot: Quat[]; pos: Vec3[];
  constructor(public ch: GltfCharacter) { this.rot = ch.nodes.map(() => quat.ident()); this.pos = ch.nodes.map((): Vec3 => [0, 0, 0]); }
  /** IN PLACE (the CPU-frame lane): `rot[i]` / `pos[i]` are the same arrays every run, overwritten — a run used to allocate five arrays a node (~30 runs a man a frame: most of the
   *  game's heap churn); the arithmetic is quat.rotate's and quat.mul's operand for operand, so the numbers are the same. Callers that keep a joint's rotation / origin across a
   *  run copy it (v3.copy / [...q]) — the layers in character.ts already did, and every remaining raw capture is either read before the next run or of a node the run leaves as it
   *  was (audited for the lane; docs/internal/cpu-frame.md). */
  run(pose: Pose) {
    const d = pose.data; const nodes = this.ch.nodes; const rot = this.rot, pos = this.pos;
    for (const i of this.ch.order) {
      const nd = nodes[i]; const o = i * 10; const q = rot[i], p = pos[i];
      const rx = d[o + 3], ry = d[o + 4], rz = d[o + 5], rw = d[o + 6];
      if (nd.parent < 0) { q[0] = rx; q[1] = ry; q[2] = rz; q[3] = rw; p[0] = d[o]; p[1] = d[o + 1]; p[2] = d[o + 2]; continue; }
      const pr = rot[nd.parent], pp = pos[nd.parent];
      const qx = pr[0], qy = pr[1], qz = pr[2], qw = pr[3]; const v0 = d[o], v1 = d[o + 1], v2 = d[o + 2];
      const tx = 2 * (qy * v2 - qz * v1), ty = 2 * (qz * v0 - qx * v2), tz = 2 * (qx * v1 - qy * v0);   // t = quat.rotate(pr, t_local)
      const t0 = v0 + qw * tx + (qy * tz - qz * ty), t1 = v1 + qw * ty + (qz * tx - qx * tz), t2 = v2 + qw * tz + (qx * ty - qy * tx);
      q[0] = qw * rx + qx * rw + qy * rz - qz * ry; q[1] = qw * ry - qx * rz + qy * rw + qz * rx; q[2] = qw * rz + qx * ry - qy * rx + qz * rw; q[3] = qw * rw - qx * rx - qy * ry - qz * rz;   // rot = quat.mul(pr, r)
      p[0] = pp[0] + t0; p[1] = pp[1] + t1; p[2] = pp[2] + t2;
    }
    return this;
  }
  /** run() restricted to `root`'s SUBTREE: only nodes at / under it are recomputed, from parents that are current — for a pose that changed at that node alone since the last
   *  run this is run() exactly (every other node's inputs did not move, so a full run would write it the same numbers it already holds); twoBoneIK's re-runs after its own
   *  edits use it (the CPU-frame lane). */
  private subLists: (Int32Array | undefined)[] = [];   // per root: its subtree in ch.order's order, found on first use (the scan each call used to make, with its marks)
  runFrom(pose: Pose, root: number) {
    const d = pose.data; const nodes = this.ch.nodes; const rot = this.rot, pos = this.pos;
    let list = this.subLists[root];
    if (!list) { const inSub = new Uint8Array(nodes.length), l: number[] = []; for (const i of this.ch.order) { const nd = nodes[i]; if (i !== root && !(nd.parent >= 0 && inSub[nd.parent])) continue; inSub[i] = 1; l.push(i); } list = this.subLists[root] = Int32Array.from(l); }
    for (let k = 0; k < list.length; k++) {
      const i = list[k]; const par = nodes[i].parent;
      const o = i * 10; const q = rot[i], p = pos[i];
      const rx = d[o + 3], ry = d[o + 4], rz = d[o + 5], rw = d[o + 6];
      if (par < 0) { q[0] = rx; q[1] = ry; q[2] = rz; q[3] = rw; p[0] = d[o]; p[1] = d[o + 1]; p[2] = d[o + 2]; continue; }
      const pr = rot[par], pp = pos[par];
      const qx = pr[0], qy = pr[1], qz = pr[2], qw = pr[3]; const v0 = d[o], v1 = d[o + 1], v2 = d[o + 2];
      const tx = 2 * (qy * v2 - qz * v1), ty = 2 * (qz * v0 - qx * v2), tz = 2 * (qx * v1 - qy * v0);
      const t0 = v0 + qw * tx + (qy * tz - qz * ty), t1 = v1 + qw * ty + (qz * tx - qx * tz), t2 = v2 + qw * tz + (qx * ty - qy * tx);
      q[0] = qw * rx + qx * rw + qy * rz - qz * ry; q[1] = qw * ry - qx * rz + qy * rw + qz * rx; q[2] = qw * rz + qx * ry - qy * rx + qz * rw; q[3] = qw * rw - qx * rx - qy * ry - qz * rz;
      p[0] = pp[0] + t0; p[1] = pp[1] + t1; p[2] = pp[2] + t2;
    }
    return this;
  }
  /** model-space rotation of node i's parent straight from the pose (walks up the chain: no run() needed, always current). Returns ONE SHARED SCRATCH quaternion — read it before the
   *  next call, never keep it (its two callers, Character.turn / shift, consume it inside one expression; the chain used to allocate two arrays a level) */
  private prScratch: Quat = [0, 0, 0, 1];
  parentRot(pose: Pose, i: number): Quat {
    let x = 0, y = 0, z = 0, w = 1; const nodes = this.ch.nodes; const d = pose.data;
    for (let p = nodes[i].parent; p >= 0; p = nodes[p].parent) {   // q = quat.mul(pose.rot(p), q), operand for operand
      const o = p * 10 + 3; const ax = d[o], ay = d[o + 1], az = d[o + 2], aw = d[o + 3]; const bx = x, by = y, bz = z, bw = w;
      x = aw * bx + ax * bw + ay * bz - az * by; y = aw * by - ax * bz + ay * bw + az * bx; z = aw * bz + ax * by - ay * bx + az * bw; w = aw * bw - ax * bx - ay * by - az * bz;
    }
    const q = this.prScratch; q[0] = x; q[1] = y; q[2] = z; q[3] = w; return q;
  }
}

/** local ← local · q: turn node i in its own frame. On this rig (Rigify DEF bones: +Y along the bone) local +X is the hinge axis — elbow, knee and finger flexion
 *  are all positive X; the thigh is the odd one out (positive X = extension). */
export function rotateLocal(pose: Pose, i: number, q: Quat) {   // = pose.setRot(i, quat.normalize(quat.mul(pose.rot(i), q))), over scalars
  const d = pose.data, o = i * 10 + 3; const ax = d[o], ay = d[o + 1], az = d[o + 2], aw = d[o + 3], bx = q[0], by = q[1], bz = q[2], bw = q[3];
  const x = aw * bx + ax * bw + ay * bz - az * by, y = aw * by - ax * bz + ay * bw + az * bx, z = aw * bz + ax * by - ay * bx + az * bw, w = aw * bw - ax * bx - ay * by - az * bz;
  const l = hyp4(x, y, z, w) || 1; d[o] = x / l; d[o + 1] = y / l; d[o + 2] = z / l; d[o + 3] = w / l;
}
/** Turn node i (with its subtree) by q given about MODEL axes (pitch forward = +X, yaw to the figure's left = +Y, drop the right shoulder = +Z), pivoting at
 *  the node: local ← P⁻¹ · q · P · local, P = the parent's current model rotation. */
export function rotateModel(pose: Pose, i: number, q: Quat, parentRot: Quat) {   // (over scalars, quat.mul's expression each step: the same numbers as the nested calls, none of their five arrays)
  const d = pose.data, o = i * 10 + 3; const px = parentRot[0], py = parentRot[1], pz = parentRot[2], pw = parentRot[3];
  // m1 = quat.mul(parentRot, pose.rot(i))
  const rx = d[o], ry = d[o + 1], rz = d[o + 2], rw = d[o + 3];
  const m1x = pw * rx + px * rw + py * rz - pz * ry, m1y = pw * ry - px * rz + py * rw + pz * rx, m1z = pw * rz + px * ry - py * rx + pz * rw, m1w = pw * rw - px * rx - py * ry - pz * rz;
  // m2 = quat.mul(q, m1)
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const m2x = qw * m1x + qx * m1w + qy * m1z - qz * m1y, m2y = qw * m1y - qx * m1z + qy * m1w + qz * m1x, m2z = qw * m1z + qx * m1y - qy * m1x + qz * m1w, m2w = qw * m1w - qx * m1x - qy * m1y - qz * m1z;
  // m3 = quat.mul(quat.conj(parentRot), m2)   (conj = [−x, −y, −z, w])
  const cx = -px, cy = -py, cz = -pz;
  const x = pw * m2x + cx * m2w + cy * m2z - cz * m2y, y = pw * m2y - cx * m2z + cy * m2w + cz * m2x, z = pw * m2z + cx * m2y - cy * m2x + cz * m2w, w = pw * m2w - cx * m2x - cy * m2y - cz * m2z;
  const l = hyp4(x, y, z, w) || 1; d[o] = x / l; d[o + 1] = y / l; d[o + 2] = z / l; d[o + 3] = w / l;   // = quat.normalize
}
/** Give node i the model-space rotation `rot` outright (parent's current model rotation supplied). */
export function setModelRot(pose: Pose, i: number, rot: Quat, parentRot: Quat) {   // = pose.setRot(i, quat.normalize(quat.mul(quat.conj(parentRot), rot))), over scalars
  const d = pose.data, o = i * 10 + 3; const ax = -parentRot[0], ay = -parentRot[1], az = -parentRot[2], aw = parentRot[3], bx = rot[0], by = rot[1], bz = rot[2], bw = rot[3];
  const x = aw * bx + ax * bw + ay * bz - az * by, y = aw * by - ax * bz + ay * bw + az * bx, z = aw * bz + ax * by - ay * bx + az * bw, w = aw * bw - ax * bx - ay * by - az * bz;
  const l = hyp4(x, y, z, w) || 1; d[o] = x / l; d[o + 1] = y / l; d[o + 2] = z / l; d[o + 3] = w / l;
}

/** Two-bone IK on the local pose: turns `a` (upper: thigh / upper arm) and `b` (lower: shin / forearm, a's child) so that the origin of `c` (foot / hand, b's
 *  child) lands on `target` (model space, clamped just short of full extension so the joint never locks). The bend stays in the limb's current plane (the mocap's
 *  own elbow / knee axis) and is then swivelled about the a→target line toward `pole` (model-space direction the middle joint should point) by `poleW` (0 = leave
 *  the swivel alone, 1 = exactly at the pole). `endRot`, if given, becomes c's model rotation (a planted foot keeps its sole flat, a hand keeps hold of the gun).
 *  fk must be current on entry (fk.run(pose)) and is current again on exit. */
export function twoBoneIK(fk: PoseFK, pose: Pose, a: number, b: number, c: number, target: Vec3, pole: Vec3 | null, poleW: number, endRot: Quat | null, fresh = false) {
  // (over scalars: every v3 / quat helper this called written out with its own expression in its own order — the same numbers, none of its ~25 arrays a solve.
  //  `fresh`: the caller vouches that ALL of fk is current for `pose` on entry — the second solve of a pair, nothing written to the pose since the first returned —
  //  so the run after the bend, which exists to bring current whatever a caller left stale, need only redo what the bend moved: b's subtree)
  const nodes = fk.ch.nodes; const pa = fk.pos[a], pb = fk.pos[b], pc = fk.pos[c];
  const la = hyp3(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]), lb = hyp3(pb[0] - pc[0], pb[1] - pc[1], pb[2] - pc[2]);
  const tT0 = target[0] - pa[0], tT1 = target[1] - pa[1], tT2 = target[2] - pa[2]; const tTl = hyp3(tT0, tT1, tT2);
  const dist = clamp(tTl, Math.abs(la - lb) + 0.01, (la + lb) * 0.998);
  // 1. bend at b for the reach: interior angle from the cosine rule, changed about the limb's current hinge axis (or one derived from the pole if it is dead straight)
  let x = pb[0] - pa[0], y = pb[1] - pa[1], z = pb[2] - pa[2], l = hyp3(x, y, z) || 1; const u0 = x / l, u1 = y / l, u2 = z / l;
  x = pc[0] - pb[0]; y = pc[1] - pb[1]; z = pc[2] - pb[2]; l = hyp3(x, y, z) || 1; const w0 = x / l, w1 = y / l, w2 = z / l;
  const bendNow = Math.acos(clamp(u0 * w0 + u1 * w1 + u2 * w2, -1, 1));                                   // 0 = straight
  const bendWant = Math.PI - Math.acos(clamp((la * la + lb * lb - dist * dist) / (2 * la * lb), -1, 1));
  // hinge axis: the limb's own while it is clearly bent; a nearly straight limb has no reliable plane (a knee 'bent' 2° sideways by the clip would fold sideways),
  // so below ~15° of bend steer toward the axis the pole implies (pole × upper: bending about it puts the joint on the pole's side)
  let ax0 = u1 * w2 - u2 * w1, ax1 = u2 * w0 - u0 * w2, ax2 = u0 * w1 - u1 * w0; const al = hyp3(ax0, ax1, ax2);
  const pl0 = pole ? pole[0] : 0, pl1 = pole ? pole[1] : 0, pl2 = pole ? pole[2] : 1;
  let pA0 = pl1 * u2 - pl2 * u1, pA1 = pl2 * u0 - pl0 * u2, pA2 = pl0 * u1 - pl1 * u0; if (hyp3(pA0, pA1, pA2) < 1e-6) { pA0 = 1; pA1 = 0; pA2 = 0; }
  l = hyp3(pA0, pA1, pA2) || 1; pA0 = pA0 / l; pA1 = pA1 / l; pA2 = pA2 / l;
  if (al < 1e-5) { ax0 = pA0; ax1 = pA1; ax2 = pA2; }
  else {
    const ia = 1 / al; ax0 = ax0 * ia; ax1 = ax1 * ia; ax2 = ax2 * ia;
    if (ax0 * pA0 + ax1 * pA1 + ax2 * pA2 < 0 && bendNow < 0.26) { ax0 = ax0 * -1; ax1 = ax1 * -1; ax2 = ax2 * -1; }
    const k = clamp((bendNow - 0.09) / 0.17, 0, 1);
    x = pA0 + (ax0 - pA0) * k; y = pA1 + (ax1 - pA1) * k; z = pA2 + (ax2 - pA2) * k; l = hyp3(x, y, z) || 1; ax0 = x / l; ax1 = y / l; ax2 = z / l;
  }
  const q = IKQ;
  { const sn = Math.sin((bendWant - bendNow) / 2); q[0] = ax0 * sn; q[1] = ax1 * sn; q[2] = ax2 * sn; q[3] = Math.cos((bendWant - bendNow) / 2); }   // = quat.axisAngle(axis, bendWant − bendNow)
  rotateModel(pose, b, q, fk.rot[a]);
  if (fresh) fk.runFrom(pose, b); else fk.run(pose);   // (a FULL run once — whatever the caller left stale is current from here; the re-runs below touch only what this solve itself moved: a's subtree)
  // 2. swing a so the end lands on the target line
  const pRotA = nodes[a].parent >= 0 ? fk.rot[nodes[a].parent] : IDENT;
  const s0 = tT0 / (tTl || 1), s1 = tT1 / (tTl || 1), s2 = tT2 / (tTl || 1);   // = v3.normalize(toT)
  { const pcn = fk.pos[c], pan = fk.pos[a];
    x = pcn[0] - pan[0]; y = pcn[1] - pan[1]; z = pcn[2] - pan[2]; l = hyp3(x, y, z) || 1; const f0 = x / l, f1 = y / l, f2 = z / l;
    const d = f0 * s0 + f1 * s1 + f2 * s2;   // quat.fromTo(f, s), its expressions
    if (d < -0.9999) { const r = quat.fromTo([f0, f1, f2], [s0, s1, s2]); q[0] = r[0]; q[1] = r[1]; q[2] = r[2]; q[3] = r[3]; }
    else { const c0 = f1 * s2 - f2 * s1, c1 = f2 * s0 - f0 * s2, c2 = f0 * s1 - f1 * s0, c3 = 1 + d; const ql = hyp4(c0, c1, c2, c3) || 1; q[0] = c0 / ql; q[1] = c1 / ql; q[2] = c2 / ql; q[3] = c3 / ql; }
    rotateModel(pose, a, q, pRotA); }
  fk.runFrom(pose, a);
  // 3. swivel the bend plane toward the pole about the a→target axis
  if (pole && poleW > 0) {
    const pbn = fk.pos[b], pan = fk.pos[a]; const e0 = pbn[0] - pan[0], e1 = pbn[1] - pan[1], e2 = pbn[2] - pan[2];
    const es = -(e0 * s0 + e1 * s1 + e2 * s2), ps = -(pole[0] * s0 + pole[1] * s1 + pole[2] * s2);
    const eP0 = e0 + s0 * es, eP1 = e1 + s1 * es, eP2 = e2 + s2 * es, pP0 = pole[0] + s0 * ps, pP1 = pole[1] + s1 * ps, pP2 = pole[2] + s2 * ps;
    const el = hyp3(eP0, eP1, eP2), ppl = hyp3(pP0, pP1, pP2);
    if (el > 1e-4 && ppl > 1e-4) {
      const en0 = eP0 / el, en1 = eP1 / el, en2 = eP2 / el, pn0 = pP0 / ppl, pn1 = pP1 / ppl, pn2 = pP2 / ppl;
      const ang = Math.atan2((en1 * pn2 - en2 * pn1) * s0 + (en2 * pn0 - en0 * pn2) * s1 + (en0 * pn1 - en1 * pn0) * s2, en0 * pn0 + en1 * pn1 + en2 * pn2);
      const sn = Math.sin(ang * poleW / 2); q[0] = s0 * sn; q[1] = s1 * sn; q[2] = s2 * sn; q[3] = Math.cos(ang * poleW / 2);   // = quat.axisAngle(s, ang · poleW)
      rotateModel(pose, a, q, pRotA); fk.runFrom(pose, a);
    }
  }
  // 4. end effector orientation
  if (endRot) { setModelRot(pose, c, endRot, fk.rot[b]); fk.runFrom(pose, c); }
}
/** twoBoneIK's one rotation in flight (handed to rotateModel, which reads it and keeps nothing) */
const IKQ: Quat = [0, 0, 0, 1];
