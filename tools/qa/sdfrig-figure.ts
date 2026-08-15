// The rig-fit FIGURE for the review page: the mannequin's bind-pose mesh silhouette (orthographic front and side) with the 15 hand-radius CAPSULES and the 15
// fitted ROUND CONES outlined over it — the fit's residual made visible. Pure CPU: rasterised into an RGBA buffer, written as a PNG (zlib from node:zlib).
//   bun run tools/qa/sdfrig-figure.ts [out.png]      (default docs/shots/sr_fit.png)
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { loadGltfCharacter } from '../../src/anim/gltf';
import { fitRig, HAND_RADII, RIG_SLOT_NAMES } from '../../src/render/sdfrig';
import { m4, v3, Vec3, Mat4 } from '../../src/math/vec';

const ROOT = resolve(import.meta.dir, '../..');
const out = process.argv[2] ?? `${ROOT}/docs/shots/sr_fit.png`;
const ch = await loadGltfCharacter('file://' + ROOT + '/public/assets/ual/AnimationLibrary_Godot_Standard.gltf');
const fit = fitRig(ch);
// bind-pose joints and the slots' segments (the same rules sdfrig.ts SLOTS uses — re-derived here from the fit module's inputs)
const J: Record<string, Vec3> = {}; { const inv = m4.create(); ch.skin.joints.forEach((node, k) => { m4.invert(inv, ch.skin.inverseBind.subarray(k * 16, k * 16 + 16) as unknown as Mat4); J[ch.nodes[node].name] = [inv[12], inv[13], inv[14]]; }); }
const ext = (a: Vec3, b: Vec3, e: number): Vec3 => v3.mad(b, v3.normalize(v3.sub(b, a)), e);
const sole = (foot: Vec3, toe: Vec3): [Vec3, Vec3] => { const up = 0.0147; const heel: Vec3 = [foot[0] - (toe[0] - foot[0]) * 0.35, Math.min(foot[1], toe[1] - up + 0.033 + (foot[1] - toe[1]) * 0.15), foot[2] - (toe[2] - foot[2]) * 0.35]; const tip: Vec3 = [toe[0], toe[1] - up + 0.033, toe[2]]; return [heel, ext(heel, tip, 0.06)]; };
const SEGS: [Vec3, Vec3][] = [
  [J['DEF-hips'], J['DEF-spine.002']], [J['DEF-spine.002'], v3.lerp(J['DEF-upper_arm.L'], J['DEF-upper_arm.R'], 0.5)], [J['DEF-upper_arm.L'], J['DEF-upper_arm.R']], [J['DEF-thigh.L'], J['DEF-thigh.R']],
  [J['DEF-neck'], v3.add(J['DEF-head'], [0, 0.13, 0])], [J['DEF-upper_arm.L'], J['DEF-forearm.L']], [J['DEF-forearm.L'], ext(J['DEF-forearm.L'], J['DEF-hand.L'], 0.09)],
  [J['DEF-upper_arm.R'], J['DEF-forearm.R']], [J['DEF-forearm.R'], ext(J['DEF-forearm.R'], J['DEF-hand.R'], 0.09)],
  [J['DEF-thigh.L'], J['DEF-shin.L']], [J['DEF-shin.L'], J['DEF-foot.L']], sole(J['DEF-foot.L'], J['DEF-toe.L']),
  [J['DEF-thigh.R'], J['DEF-shin.R']], [J['DEF-shin.R'], J['DEF-foot.R']], sole(J['DEF-foot.R'], J['DEF-toe.R']),
];

// three panels: front + capsules, front + cones, side + both (legs / trunk only readable in the side view — the arms overlap it)
const PW = 520, PH = 940, W = PW * 3, H = PH + 60; const px = new Uint8Array(W * H * 4);
const bg = [16, 22, 26], meshCol = [92, 108, 112], capCol = [255, 120, 96], coneCol = [110, 231, 183];
for (let i = 0; i < W * H; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
type Proj = (p: Vec3) => [number, number];
const SCALE = 470;   // px per metre (1.83 m → 860 px)
const front = (ox: number): Proj => p => [ox + PW / 2 + p[0] * SCALE, 20 + PH - p[1] * SCALE];
const side = (ox: number): Proj => p => [ox + PW / 2 + p[2] * SCALE * 1.0, 20 + PH - p[1] * SCALE];
function fillTri(pr: Proj, a: Vec3, b: Vec3, c: Vec3, col: number[]) {
  const A = pr(a), B = pr(b), C = pr(c);
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  const e = (P: number[], Q: number[], x: number, y: number) => (Q[0] - P[0]) * (y - P[1]) - (Q[1] - P[1]) * (x - P[0]);
  const area = e(A, B, C[0], C[1]); if (Math.abs(area) < 1e-9) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const w0 = e(B, C, x + 0.5, y + 0.5), w1 = e(C, A, x + 0.5, y + 0.5), w2 = e(A, B, x + 0.5, y + 0.5); if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) { const o = (y * W + x) * 4; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; } }
}
/** 2D signed distance to the orthographic silhouette of a round cone (a, ra) → (b, rb) projected by pr (a tapered capsule in the plane — iq's sdUnevenCapsule generalised to any axis) */
function sdCone2(pr: Proj, a: Vec3, b: Vec3, ra: number, rb: number, x: number, y: number) {
  const A = pr(a), B = pr(b); const r1 = ra * SCALE, r2 = rb * SCALE;
  const dx = B[0] - A[0], dy = B[1] - A[1]; const h = Math.hypot(dx, dy); if (h < 1e-6) return Math.hypot(x - A[0], y - A[1]) - Math.max(r1, r2);
  const ux = dx / h, uy = dy / h; const qx0 = x - A[0], qy0 = y - A[1];
  const px_ = Math.abs(qx0 * uy - qy0 * ux), py_ = qx0 * ux + qy0 * uy;   // local frame: py along the axis, px lateral
  const bb = (r1 - r2) / h; const aa = Math.sqrt(Math.max(0, 1 - bb * bb));
  const kk = px_ * -bb + py_ * aa;   // iq's sdUnevenCapsule in the segment's own frame
  if (kk < 0) return Math.hypot(px_, py_) - r1;
  if (kk > aa * h) return Math.hypot(px_, py_ - h) - r2;
  return px_ * aa + py_ * bb - r1;
}
function strokeCone(pr: Proj, a: Vec3, b: Vec3, ra: number, rb: number, col: number[], wpx = 1.6) {
  const A = pr(a), B = pr(b); const R = Math.max(ra, rb) * SCALE + wpx + 2;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0]) - R)), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0]) + R)), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1]) - R)), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1]) + R));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.abs(sdCone2(pr, a, b, ra, rb, x + 0.5, y + 0.5)); if (d < wpx) { const t = Math.min(1, wpx - d); const o = (y * W + x) * 4; px[o] = Math.round(px[o] * (1 - t) + col[0] * t); px[o + 1] = Math.round(px[o + 1] * (1 - t) + col[1] * t); px[o + 2] = Math.round(px[o + 2] * (1 - t) + col[2] * t); } }
}
const M = ch.mesh; const P = (i: number): Vec3 => [M.positions[i * 3], M.positions[i * 3 + 1], M.positions[i * 3 + 2]];
const panels: [Proj, boolean, boolean][] = [[front(0), true, false], [front(PW), false, true], [side(PW * 2), true, true]];
for (const [pr] of panels) for (let t = 0; t < M.indices.length; t += 3) fillTri(pr, P(M.indices[t]), P(M.indices[t + 1]), P(M.indices[t + 2]), meshCol);
panels.forEach(([pr, caps, cones]) => {
  SEGS.forEach(([a, b], s) => { if (caps) strokeCone(pr, a, b, HAND_RADII[s], HAND_RADII[s], capCol); });
  SEGS.forEach(([a, b], s) => { if (cones) strokeCone(pr, a, b, fit.r0[s], fit.r1[s], coneCol); });
});
// a 1-px separator between panels
for (const ox of [PW, PW * 2]) for (let y = 0; y < H; y++) { const o = (y * W + ox) * 4; px[o] = 48; px[o + 1] = 60; px[o + 2] = 64; }

// ---- PNG (RGBA8, filter 0 per row)
function crc32(buf: Uint8Array) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(type: string, data: Uint8Array) { const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length); const td = new Uint8Array(4 + data.length); td.set(new TextEncoder().encode(type), 0); td.set(data, 4); const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(td)); return Buffer.concat([len, td, crc]); }
const raw = new Uint8Array((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1); }
const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
writeFileSync(out, png);
console.log(`${out}: ${W}×${H}, ${(png.length / 1024).toFixed(0)} KB — panels: front + hand capsules (${'#' + capCol.map(c => c.toString(16).padStart(2, '0')).join('')}) · front + fitted round cones (${'#' + coneCol.map(c => c.toString(16).padStart(2, '0')).join('')}) · side + both; slots ${RIG_SLOT_NAMES.join(' ')}`);
