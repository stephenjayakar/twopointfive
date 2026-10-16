// Minimal vector / matrix / quaternion helpers. Column-major mat4 (WebGPU/glTF convention).
import { hyp2, hyp3, hyp4 } from './hyp';
export { hyp2, hyp3, hyp4 };   // (Math.hypot's own bits without its call: see hyp.ts)
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x y z w
export type Mat4 = Float32Array; // 16, column-major

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;
/** Wrap angle to (-PI, PI]. */
export const wrapAngle = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
/** Move angle a toward b by at most maxStep (shortest arc). */
export const approachAngle = (a: number, b: number, maxStep: number) => { const d = wrapAngle(b - a); return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep; };
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const v3 = {
  make: (x = 0, y = 0, z = 0): Vec3 => [x, y, z],
  copy: (a: Vec3): Vec3 => [a[0], a[1], a[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  mad: (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  mul: (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3) => hyp3(a[0], a[1], a[2]),
  dist: (a: Vec3, b: Vec3) => hyp3(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  /** planar (XZ) distance — what 'how far apart on the floor' means everywhere in the game layer */
  distXZ: (a: Vec3, b: Vec3) => hyp2(a[0] - b[0], a[2] - b[2]),
  /** yaw of a direction: the angle whose forward [sin, 0, cos] points along d (Character.bodyYaw / aimYaw convention; y ignored) */
  yawOf: (d: Vec3) => Math.atan2(d[0], d[2]),
  /** yaw from one point toward another (same convention) */
  yawTo: (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]),
  normalize: (a: Vec3): Vec3 => { const l = hyp3(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
  min: (a: Vec3, b: Vec3): Vec3 => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
  max: (a: Vec3, b: Vec3): Vec3 => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
};

export const quat = {
  ident: (): Quat => [0, 0, 0, 1],
  axisAngle: (axis: Vec3, ang: number): Quat => { const s = Math.sin(ang / 2); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)]; },
  yaw: (ang: number): Quat => [0, Math.sin(ang / 2), 0, Math.cos(ang / 2)],
  mul: (a: Quat, b: Quat): Quat => {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
  },
  conj: (a: Quat): Quat => [-a[0], -a[1], -a[2], a[3]],
  normalize: (a: Quat): Quat => { const l = hyp4(a[0], a[1], a[2], a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; },
  dot: (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3],
  /** Normalized lerp along shortest arc (fine for animation blending). */
  nlerp: (a: Quat, b: Quat, t: number): Quat => {
    const s = quat.dot(a, b) < 0 ? -1 : 1;
    return quat.normalize([lerp(a[0], b[0] * s, t), lerp(a[1], b[1] * s, t), lerp(a[2], b[2] * s, t), lerp(a[3], b[3] * s, t)]);
  },
  slerp: (a: Quat, b: Quat, t: number): Quat => {
    let d = quat.dot(a, b); let s = 1; if (d < 0) { d = -d; s = -1; }
    if (d > 0.9995) return quat.nlerp(a, b, t);
    const th = Math.acos(d), sn = Math.sin(th); const wa = Math.sin((1 - t) * th) / sn, wb = (Math.sin(t * th) / sn) * s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
  },
  /** Rotation taking local +X/+Y/+Z to the given orthonormal world axes (columns of the rotation matrix). */
  fromBasis: (x: Vec3, y: Vec3, z: Vec3): Quat => {
    const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
    const tr = m00 + m11 + m22; let q: Quat;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
    return quat.normalize(q);
  },
  /** Shortest-arc rotation taking unit vector a onto unit vector b. */
  fromTo: (a: Vec3, b: Vec3): Quat => {
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d < -0.9999) { const ax: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const c: Vec3 = [a[1] * ax[2] - a[2] * ax[1], a[2] * ax[0] - a[0] * ax[2], a[0] * ax[1] - a[1] * ax[0]]; const l = hyp3(c[0], c[1], c[2]) || 1; return [c[0] / l, c[1] / l, c[2] / l, 0]; }
    const c: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return quat.normalize([c[0], c[1], c[2], 1 + d]);
  },
  rotate: (q: Quat, v: Vec3): Vec3 => {
    // v' = v + 2w(qv x v) + 2 qv x (qv x v)
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
    return [v[0] + qw * tx + (qy * tz - qz * ty), v[1] + qw * ty + (qz * tx - qx * tz), v[2] + qw * tz + (qx * ty - qy * tx)];
  },
};

export const m4 = {
  create: (): Mat4 => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity: (m: Mat4) => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  copy: (out: Mat4, a: Mat4) => { out.set(a); return out; },
  mul: (out: Mat4, a: Mat4, b: Mat4) => { // out = a * b
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  },
  fromTRS: (out: Mat4, t: Vec3, q: Quat, s: Vec3) => m4.fromTRSs(out, t[0], t[1], t[2], q[0], q[1], q[2], q[3], s[0], s[1], s[2]),
  /** fromTRS over scalars (the same expressions, operand for operand — bit-identical results; the skeleton's hot loop, which has them in a flat array, needs no temporaries) */
  fromTRSs: (out: Mat4, tx: number, ty: number, tz: number, x: number, y: number, z: number, w: number, s0: number, s1: number, s2: number) => {
    const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    out[0] = (1 - (yy + zz)) * s0; out[1] = (xy + wz) * s0; out[2] = (xz - wy) * s0; out[3] = 0;
    out[4] = (xy - wz) * s1; out[5] = (1 - (xx + zz)) * s1; out[6] = (yz + wx) * s1; out[7] = 0;
    out[8] = (xz + wy) * s2; out[9] = (yz - wx) * s2; out[10] = (1 - (xx + yy)) * s2; out[11] = 0;
    out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
    return out;
  },
  transformPoint: (m: Mat4, p: Vec3): Vec3 => {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  },
  transformDir: (m: Mat4, p: Vec3): Vec3 => {
    const x = p[0], y = p[1], z = p[2];
    return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  },
  getTranslation: (m: Mat4): Vec3 => [m[12], m[13], m[14]],
  /** Extract rotation as quaternion (assumes no shear; handles uniform-ish scale by normalizing columns). */
  getRotation: (m: Mat4): Quat => {
    const sx = hyp3(m[0], m[1], m[2]) || 1, sy = hyp3(m[4], m[5], m[6]) || 1, sz = hyp3(m[8], m[9], m[10]) || 1;
    const r00 = m[0] / sx, r01 = m[4] / sy, r02 = m[8] / sz, r10 = m[1] / sx, r11 = m[5] / sy, r12 = m[9] / sz, r20 = m[2] / sx, r21 = m[6] / sy, r22 = m[10] / sz;
    const tr = r00 + r11 + r22; let q: Quat;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(r21 - r12) / s, (r02 - r20) / s, (r10 - r01) / s, 0.25 * s]; }
    else if (r00 > r11 && r00 > r22) { const s = Math.sqrt(1 + r00 - r11 - r22) * 2; q = [0.25 * s, (r01 + r10) / s, (r02 + r20) / s, (r21 - r12) / s]; }
    else if (r11 > r22) { const s = Math.sqrt(1 + r11 - r00 - r22) * 2; q = [(r01 + r10) / s, 0.25 * s, (r12 + r21) / s, (r02 - r20) / s]; }
    else { const s = Math.sqrt(1 + r22 - r00 - r11) * 2; q = [(r02 + r20) / s, (r12 + r21) / s, 0.25 * s, (r10 - r01) / s]; }
    return quat.normalize(q);
  },
  invert: (out: Mat4, a: Mat4) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
  /** Right-handed perspective with WebGPU clip depth [0,1], reversed-Z off (near->0, far->1). */
  perspective: (out: Mat4, fovy: number, aspect: number, near: number, far: number) => {
    const f = 1 / Math.tan(fovy / 2); out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = far / (near - far); out[11] = -1; out[14] = (far * near) / (near - far);
    return out;
  },
  lookAt: (out: Mat4, eye: Vec3, target: Vec3, up: Vec3) => {
    const z = v3.normalize(v3.sub(eye, target)); const x = v3.normalize(v3.cross(up, z)); const y = v3.cross(z, x);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0; out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -v3.dot(x, eye); out[13] = -v3.dot(y, eye); out[14] = -v3.dot(z, eye); out[15] = 1;
    return out;
  },
};
