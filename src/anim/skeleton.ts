// Pose sampling / blending / layering and skinning matrix computation for a glTF character.
import { Mat4, Quat, Vec3, m4, quat, v3, clamp } from '../math/vec';
import { Clip, GltfCharacter } from './gltf';

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
      const l = Math.hypot(x, y, z, w) || 1; d[o] = x / l; d[o + 1] = y / l; d[o + 2] = z / l; d[o + 3] = w / l;
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
    const l = Math.hypot(x, y, z, ww) || 1; O[o + 3] = x / l; O[o + 4] = y / l; O[o + 5] = z / l; O[o + 6] = ww / l;
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
  private tmp = m4.create(); private tmp2 = m4.create(); private local = m4.create();
  constructor(public ch: GltfCharacter) {
    this.globals = ch.nodes.map(() => m4.create());
    this.globalRot = ch.nodes.map(() => quat.ident());
    this.jointData = new Float32Array(ch.skin.joints.length * 16);
  }

  update(pose: Pose, world: Mat4, twists: TwistSpec[] | null, overrides: (NodeOverride | undefined)[] | null = null) {
    const { ch } = this; const d = pose.data;
    // several layers may push a twist for the same node (aim yaw, look, the gaze stabiliser): they ACCUMULATE — a Map built straight from the list kept only the last
    let twistMap: Map<number, TwistSpec> | null = null;
    if (twists && twists.length) { twistMap = new Map(); for (const t of twists) { const e = twistMap.get(t.node); if (e) twistMap.set(t.node, { node: t.node, yaw: e.yaw + t.yaw, pitch: e.pitch + t.pitch }); else twistMap.set(t.node, t); } }
    for (const i of ch.order) {
      const nd = ch.nodes[i]; const o = i * 10;
      let r: Quat = [d[o + 3], d[o + 4], d[o + 5], d[o + 6]];
      const t: Vec3 = [d[o], d[o + 1], d[o + 2]]; const s: Vec3 = [d[o + 7], d[o + 8], d[o + 9]];
      const ov = overrides ? overrides[i] : undefined;
      if (ov) {   // driven from outside: global rotation as given, origin as given or where the parent puts it (parent scales are all ~1 in this rig, so composing T·R·S directly is fine)
        const p = ov.pos ?? (nd.parent >= 0 ? m4.transformPoint(this.globals[nd.parent], t) : t);
        this.globalRot[i] = ov.rot; m4.fromTRS(this.globals[i], p, ov.rot, s); continue;
      }
      const parentRot = nd.parent >= 0 ? this.globalRot[nd.parent] : quat.ident();
      let gr = quat.mul(parentRot, r);
      const tw = twistMap?.get(i);
      if (tw) {
        // model-space yaw about +Y then pitch about the yawed model X axis, applied to this subtree
        let extra = quat.yaw(tw.yaw);
        if (tw.pitch !== 0) { const right = quat.rotate(extra, [1, 0, 0]); extra = quat.mul(quat.axisAngle(right, tw.pitch), extra); }
        gr = quat.normalize(quat.mul(extra, gr));
        // convert back to a local rotation consistent with the new global: r = parentRot^-1 * gr
        r = quat.mul(quat.conj(parentRot), gr);
      }
      this.globalRot[i] = gr;
      m4.fromTRS(this.local, t, r, s);
      if (nd.parent >= 0) m4.mul(this.globals[i], this.globals[nd.parent], this.local); else m4.copy(this.globals[i], this.local);
    }
    // skinning matrices
    const ibm = ch.skin.inverseBind; const joints = ch.skin.joints;
    for (let j = 0; j < joints.length; j++) {
      const ib = ibm.subarray(j * 16, j * 16 + 16) as unknown as Mat4;
      m4.mul(this.tmp, this.globals[joints[j]], ib);
      m4.mul(this.tmp2, world, this.tmp);
      this.jointData.set(this.tmp2, j * 16);
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
  run(pose: Pose) {
    const d = pose.data; const nodes = this.ch.nodes;
    for (const i of this.ch.order) {
      const nd = nodes[i]; const o = i * 10;
      const r: Quat = [d[o + 3], d[o + 4], d[o + 5], d[o + 6]];
      if (nd.parent < 0) { this.rot[i] = r; this.pos[i] = [d[o], d[o + 1], d[o + 2]]; continue; }
      const pr = this.rot[nd.parent], pp = this.pos[nd.parent]; const t = quat.rotate(pr, [d[o], d[o + 1], d[o + 2]]);
      this.rot[i] = quat.mul(pr, r); this.pos[i] = [pp[0] + t[0], pp[1] + t[1], pp[2] + t[2]];
    }
    return this;
  }
  /** model-space rotation of node i's parent straight from the pose (walks up the chain: no run() needed, always current) */
  parentRot(pose: Pose, i: number): Quat {
    let q = quat.ident(); const nodes = this.ch.nodes;
    for (let p = nodes[i].parent; p >= 0; p = nodes[p].parent) q = quat.mul(pose.rot(p), q);
    return q;
  }
}

/** local ← local · q: turn node i in its own frame. On this rig (Rigify DEF bones: +Y along the bone) local +X is the hinge axis — elbow, knee and finger flexion
 *  are all positive X; the thigh is the odd one out (positive X = extension). */
export function rotateLocal(pose: Pose, i: number, q: Quat) { pose.setRot(i, quat.normalize(quat.mul(pose.rot(i), q))); }
/** Turn node i (with its subtree) by q given about MODEL axes (pitch forward = +X, yaw to the figure's left = +Y, drop the right shoulder = +Z), pivoting at
 *  the node: local ← P⁻¹ · q · P · local, P = the parent's current model rotation. */
export function rotateModel(pose: Pose, i: number, q: Quat, parentRot: Quat) {
  pose.setRot(i, quat.normalize(quat.mul(quat.conj(parentRot), quat.mul(q, quat.mul(parentRot, pose.rot(i))))));
}
/** Give node i the model-space rotation `rot` outright (parent's current model rotation supplied). */
export function setModelRot(pose: Pose, i: number, rot: Quat, parentRot: Quat) { pose.setRot(i, quat.normalize(quat.mul(quat.conj(parentRot), rot))); }

/** Two-bone IK on the local pose: turns `a` (upper: thigh / upper arm) and `b` (lower: shin / forearm, a's child) so that the origin of `c` (foot / hand, b's
 *  child) lands on `target` (model space, clamped just short of full extension so the joint never locks). The bend stays in the limb's current plane (the mocap's
 *  own elbow / knee axis) and is then swivelled about the a→target line toward `pole` (model-space direction the middle joint should point) by `poleW` (0 = leave
 *  the swivel alone, 1 = exactly at the pole). `endRot`, if given, becomes c's model rotation (a planted foot keeps its sole flat, a hand keeps hold of the gun).
 *  fk must be current on entry (fk.run(pose)) and is current again on exit. */
export function twoBoneIK(fk: PoseFK, pose: Pose, a: number, b: number, c: number, target: Vec3, pole: Vec3 | null, poleW: number, endRot: Quat | null) {
  const nodes = fk.ch.nodes; const pa = fk.pos[a], pb = fk.pos[b], pc = fk.pos[c];
  const la = v3.dist(pa, pb), lb = v3.dist(pb, pc);
  const toT = v3.sub(target, pa); const dist = clamp(v3.len(toT), Math.abs(la - lb) + 0.01, (la + lb) * 0.998);
  // 1. bend at b for the reach: interior angle from the cosine rule, changed about the limb's current hinge axis (or one derived from the pole if it is dead straight)
  const u = v3.normalize(v3.sub(pb, pa)), w = v3.normalize(v3.sub(pc, pb));
  const bendNow = Math.acos(clamp(v3.dot(u, w), -1, 1));                                   // 0 = straight
  const bendWant = Math.PI - Math.acos(clamp((la * la + lb * lb - dist * dist) / (2 * la * lb), -1, 1));
// hinge axis: the limb's own while it is clearly bent; a nearly straight limb has no reliable plane (a knee 'bent' 2° sideways by the clip would fold sideways),
  // so below ~15° of bend steer toward the axis the pole implies (pole × upper: bending about it puts the joint on the pole's side)
  let axis = v3.cross(u, w); const al = v3.len(axis);
  const pl: Vec3 = pole ?? [0, 0, 1]; let pAxis = v3.cross(pl, u); if (v3.len(pAxis) < 1e-6) pAxis = [1, 0, 0]; pAxis = v3.normalize(pAxis);
  if (al < 1e-5) axis = pAxis;
  else { axis = v3.scale(axis, 1 / al); if (v3.dot(axis, pAxis) < 0 && bendNow < 0.26) axis = v3.scale(axis, -1); const k = clamp((bendNow - 0.09) / 0.17, 0, 1); axis = v3.normalize(v3.lerp(pAxis, axis, k)); }
  rotateModel(pose, b, quat.axisAngle(axis, bendWant - bendNow), fk.rot[a]);
  fk.run(pose);
  // 2. swing a so the end lands on the target line
  const pRotA = nodes[a].parent >= 0 ? fk.rot[nodes[a].parent] : quat.ident();
  rotateModel(pose, a, quat.fromTo(v3.normalize(v3.sub(fk.pos[c], fk.pos[a])), v3.normalize(toT)), pRotA);
  fk.run(pose);
  // 3. swivel the bend plane toward the pole about the a→target axis
  if (pole && poleW > 0) {
    const s = v3.normalize(toT); const e = v3.sub(fk.pos[b], fk.pos[a]);
    const eP = v3.mad(e, s, -v3.dot(e, s)), pP = v3.mad(pole, s, -v3.dot(pole, s));
    if (v3.len(eP) > 1e-4 && v3.len(pP) > 1e-4) {
      const en = v3.normalize(eP), pn = v3.normalize(pP);
      const ang = Math.atan2(v3.dot(v3.cross(en, pn), s), v3.dot(en, pn));
      rotateModel(pose, a, quat.axisAngle(s, ang * poleW), pRotA); fk.run(pose);
    }
  }
  // 4. end effector orientation
  if (endRot) { setModelRot(pose, c, endRot, fk.rot[b]); fk.run(pose); }
}
