// THE READY POSE's numbers (character.ts `ready` / readyLayer, READY) and the strike's two clips, headless — a bare Character of the cast driven the way the game's
// controllers drive one (as pose-mesh.ts stands its man: no Game, so nothing but this file sets `ready`), measured in his own frame (his LEFT, up, forward: model axes).
//
//   bun run tools/qa/ready-pose-probes.ts poses                 each kind standing / crouched / on the move / under an aim twist: hands, elbows, the weight shown; PASS / FAIL lines
//   bun run tools/qa/ready-pose-probes.ts identity              `ready` never set: a hash of every joint matrix and bone, frame by frame, over a walk (300 frames), a crouch
//                                                               walk, a pistol aim and a strike — the SAME script through any tree:
//   REPO=<another checkout> bun run tools/qa/ready-pose-probes.ts identity        (e.g. `git archive HEAD` unpacked beside: the two printed hashes must match)
//   bun run tools/qa/ready-pose-probes.ts ease                  in / out: the weight frame by frame, the largest one-frame jump of either wrist through set → clear, a kind
//                                                               change at full weight, and a strike thrown out of the pose (both clips)
//   bun run tools/qa/ready-pose-probes.ts mesh --out <dir>      per kind a binary PLY of the posed mesh (pose-mesh.ts's format + its JSON) for a picture
// Exit 1 on any FAIL, 2 on an unknown mode.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.env.REPO ?? new URL('../..', import.meta.url).pathname);
type V3 = [number, number, number];
const args = process.argv.slice(2), mode = args[0] ?? 'poses';
const flag = (n: string): string | null => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] ?? ''; };
const H = await import(`${ROOT}/tools/qa/headless.ts`);
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f3 = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3), fv = (v: V3) => `[${f3(v[0])} ${f3(v[1])} ${f3(v[2])}]`;

const ch: any = await H.loadCastCharacter();
const node = (n: string): number => { const i = ch.nodeByName.get(n); if (i === undefined) throw new Error('no node ' + n); return i; };
const J = { hips: node('DEF-hips'), chest: node('DEF-spine.003'), neck: node('DEF-neck'), head: node('DEF-head'), shL: node('DEF-upper_arm.L'), elL: node('DEF-forearm.L'), haL: node('DEF-hand.L'), miL: node('DEF-f_middle.01.L'),
  shR: node('DEF-upper_arm.R'), elR: node('DEF-forearm.R'), haR: node('DEF-hand.R'), miR: node('DEF-f_middle.01.R'),
  thL: node('DEF-thigh.L'), knL: node('DEF-shin.L'), ftL: node('DEF-foot.L'), toL: node('DEF-toe.L'), thR: node('DEF-thigh.R'), knR: node('DEF-shin.R'), ftR: node('DEF-foot.R'), toR: node('DEF-toe.R') };
function stand(seed = 7): any {
  Math.random = seeded(seed);
  const c: any = new CH.Character(ch, { id: 1, tint: [0.07, 0.09, 0.1], tint2: [0.05, 0.07, 0.06], pos: [0, 0, 0], yaw: 0 });
  const v = ch.cast?.variants.find((x: any) => x.side === 'operator'); if (v) c.parts = v.mask;
  c.anim.phase = 0; c.anim.trained = 1; c.anim.upper = 'none'; c.anim.stance = 'none';
  return c;
}
const step = (c: any, n: number, each?: (i: number) => void) => { for (let i = 0; i < n; i++) { each?.(i); if (c.vel) c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; c.update(DT); } };
/** a world point in his own frame (left, up, forward) — character.ts toModelP */
const local = (c: any, p: ArrayLike<number>): V3 => { const cy = Math.cos(c.bodyYaw), sy = Math.sin(c.bodyYaw), dx = p[0] - c.pos[0], dz = p[2] - c.pos[2]; return [dx * cy - dz * sy, p[1] - c.pos[1], dx * sy + dz * cy]; };
const world = (c: any, m: V3): V3 => { const cy = Math.cos(c.bodyYaw), sy = Math.sin(c.bodyYaw); return [c.pos[0] + m[0] * cy + m[2] * sy, c.pos[1] + m[1], c.pos[2] - m[0] * sy + m[2] * cy]; };
const jp = (c: any, i: number): V3 => { const p = c.skel.nodePos(i); return [p[0], p[1], p[2]]; };   // (SkeletonInstance.nodePos is MODEL space, the chest twist applied: already his own frame)
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
function segDist(p: V3, a: V3, b: V3): number { const ab = sub(b, a), ap = sub(p, a), t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (len(ab) ** 2 || 1))); return len(sub(ap, [ab[0] * t, ab[1] * t, ab[2] * t])); }
const finite = (c: any) => c.skel.jointData.every(Number.isFinite) && Object.values(c.bones).every((b: any) => b.every(Number.isFinite));
function fnv(h: number, f: Float32Array | number[]): number { const u = new Uint8Array(f instanceof Float32Array ? f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) : new Float32Array(f).buffer); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } return h >>> 0; }

let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; };

// ================================================================ identity: `ready` never set — the animator as it was, to the bit
if (mode === 'identity') {
  const c = stand(); let h = 2166136261, frames = 0; const parts: string[] = [];
  const run = (name: string, n: number, each?: (i: number) => void) => { const h0 = h; step(c, n, i => { each?.(i); }); /* hashed below per frame */ void h0; };
  const hashed = (name: string, n: number, pre?: () => void, each?: (i: number) => void) => { pre?.(); let hs = 2166136261; for (let i = 0; i < n; i++) { each?.(i); step(c, 1); h = fnv(h, c.skel.jointData); hs = fnv(hs, c.skel.jointData); for (const k of Object.keys(c.bones).sort()) { h = fnv(h, c.bones[k]); hs = fnv(hs, c.bones[k]); } frames++; } parts.push(`${name} ${hs.toString(16).padStart(8, '0')}`); };
  void run;
  hashed('idle 30', 30);
  hashed('walk 300', 300, () => { c.anim.speed = 1.4; c.vel = [0, 0, 1.4]; });
  hashed('crouch-walk 120', 120, () => { c.anim.crouchTarget = 1; c.anim.speed = 0.9; c.vel = [0, 0, 0.9]; });
  hashed('stop + pistol aim, twisted 120', 120, () => { c.anim.speed = 0; c.vel = [0, 0, 0]; c.anim.crouchTarget = 0; c.anim.upper = 'aim'; c.aimYaw = c.bodyYaw + 0.5; c.aimPitch = -0.2; });
  hashed('strike() from empty hands 90', 90, () => { c.anim.upper = 'none'; c.aimYaw = c.bodyYaw; c.aimPitch = 0; }, i => { if (i === 10) c.anim.strike(); });
  hashed('tell + signal + throw 200', 200, undefined, i => { if (i === 5) c.anim.tell('watch'); if (i === 90) c.anim.signal('hold'); if (i === 150) c.anim.throwItem(); });
  console.log(`ready-pose identity @ ${ROOT}\n  has ready: ${'ready' in c.anim} · frames ${frames}\n  ${parts.join('\n  ')}\n  ALL ${h.toString(16).padStart(8, '0')}`);
  process.exit(0);
}

// ================================================================ the cases the pose probes and the pictures share
interface Case { name: string; kind: string; at: V3 | null; crouch?: boolean; speed?: number; pistol?: boolean; twist?: number; can?: boolean }
const NECK: V3 = [0, 1.45, 0.8], SEAT: V3 = [0, 1.15, 0.62];
const CASES: Case[] = [
  { name: 'grab', kind: 'grab', at: NECK },
  { name: 'grab-crouch', kind: 'grab', at: NECK, crouch: true },
  { name: 'grab-sneak', kind: 'grab', at: NECK, crouch: true, speed: 0.9 },
  { name: 'grab-nopoint', kind: 'grab', at: null },
  { name: 'grab-can', kind: 'grab', at: NECK, can: true },
  { name: 'grab-side', kind: 'grab', at: [0.75, 1.45, 0.3] },
  { name: 'grabGun', kind: 'grabGun', at: NECK, pistol: true },
  { name: 'grabGun-crouch', kind: 'grabGun', at: NECK, pistol: true, crouch: true },
  { name: 'grabGun-twist', kind: 'grabGun', at: NECK, pistol: true, twist: 0.6 },
  { name: 'strike', kind: 'strike', at: [0, 1.45, 0.9] },
  { name: 'strike-crouch', kind: 'strike', at: [0, 1.45, 0.9], crouch: true },
  { name: 'seat', kind: 'seat', at: SEAT },
  { name: 'seat-nopoint', kind: 'seat', at: null },
];
/** the man put into a case and settled: 30 frames as he is, then `n` with the pose asked for every frame (as close.ts closeTick does). The point is given in HIS
 *  frame as he stands when the pose is asked for (a sneaking man: the mark keeps its distance ahead of him). twist: the BODY turned that far to his left of the aim
 *  that stays on the man (the chest twist the pose has to reach through) */
function pose(k: Case, n = 40): any {
  const c = stand(); const a = c.anim;
  if (k.crouch) a.crouchTarget = 1;
  if (k.pistol) a.upper = 'aim';
  if (k.can && a.grip) a.grip[1] = true;
  if (k.speed) { a.speed = k.speed; c.vel = [0, 0, k.speed]; }
  const tw = () => { if (k.twist) { c.bodyYaw = k.twist; c.aimYaw = 0; } };
  step(c, 30, tw);
  step(c, 40, () => { tw(); if (n) { a.ready = k.kind; a.readyAt = k.at ? (k.twist ? [k.at[0], k.at[1], k.at[2]] : world(c, k.at)) : null; } });
  return c;
}
function measure(c: any) {
  const P = (i: number) => jp(c, i);
  const hips = P(J.hips), neck = P(J.neck), chest = P(J.chest), head = P(J.head);
  return { hips, neck, chest, head, shL: P(J.shL), elL: P(J.elL), haL: P(J.haL), shR: P(J.shR), elR: P(J.elR), haR: P(J.haR), miL: P(J.miL), miR: P(J.miR),
    dL: segDist(P(J.haL), hips, neck), dR: segDist(P(J.haR), hips, neck), armL: len(sub(P(J.elL), P(J.shL))) + len(sub(P(J.haL), P(J.elL))) };
}

/** the knife's props as combat.ts handProps asks for them with the close-in switch on: how many boxes carry each tag this frame */
const RPm: any = await import(`${ROOT}/src/game/rigProps.ts`);
const tags = (c: any) => { const bx: any[] = []; RPm.rigBoxes(c, { goggles: false, nv: false, slot: 0, knife: !!c.anim.knifeShown, sheath: true, lightOn: false, isGuard: false, holster: true, held: null, rifle: null }, bx); return { knife: bx.filter(b => b.name === RPm.KNIFE_TAG).length, sheath: bx.filter(b => b.name === RPm.SHEATH_TAG).length }; };
/** the middle of the right fist's grip (rigProps.knifeBoxes' own origin off Character.handFrameR) against the middle of the sheathed handle (rigProps.sheathFrame), m */
const gripAt = (c: any): V3 => { const H = c.handFrameR(), h = c.bones.handR as V3, G = RPm.RIG.knife.grip; return [0, 1, 2].map(i => h[i] + H.fingers[i] * G.fwd - H.back[i] * G.palm + H.thumb[i] * G.side) as V3; };
const fistGap = (c: any): number => len(sub(gripAt(c), RPm.sheathFrame(c).o));

// ================================================================ the posed mesh of a staged man as pose-mesh.ts writes one (PLY + JSON), for a picture
const MESH = async () => {
  const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`), RP: any = await import(`${ROOT}/src/game/rigProps.ts`), { skinVertices } = await import(`${ROOT}/src/render/meshbvh.ts`);
  const out = resolve(flag('--out') || './ready-pose-out'); mkdirSync(out, { recursive: true });
  const mesh = ch.mesh, variant = ch.cast.variants.find((x: any) => x.side === 'operator');
  const srgb = (l: number) => Math.round(255 * Math.min(1, Math.max(0, l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)));
  /** `c` re-baked at the origin facing +z (a dt-0 update: no clock moves), `at` = a point in his own frame to mark with a post */
  return (k: { name: string; pistol?: boolean; can?: boolean }, c: any, at: V3 | null) => {
    const yaw0 = c.bodyYaw; if (Math.hypot(c.pos[0], c.pos[2]) > 1e-9 && Math.hypot(c.pos[0], c.pos[2]) < 0.6) { c.pos = [50, 0, 50]; c.update(0); }   // (a short hop would leave the standing feet locked where they were: make it a teleport)
    c.pos = [0, 0, 0]; c.bodyYaw = 0; c.aimYaw -= yaw0; if (c.anim.ready) c.anim.readyAt = at; if (c.anim.creep && at) c.anim.creepAt = at; c.update(0);
    const P = skinVertices(mesh.positions, mesh.joints, mesh.weights, c.skel.jointData), I = mesh.indices, part = mesh.part as Uint8Array;
    const sd = CM.charSlots(ch); const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, 'operator', [0.07, 0.09, 0.1], [0.05, 0.07, 0.06], 1, !sd.authored);
    const worn = (v: number) => ((variant.mask >>> part[v]) & 1) === 1, remap = new Int32Array(mesh.vertexCount).fill(-1), verts: number[] = [], cols: number[] = [], faces: number[] = [];
    for (let t = 0; t < I.length; t += 3) { const tri = [I[t], I[t + 1], I[t + 2]]; if (!tri.every(worn)) continue;
      for (const v of tri) { if (remap[v] < 0) { remap[v] = verts.length / 3; verts.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); const s = Math.min(sd.slot[v], 10), p = 8 + s * 8; cols.push(srgb(pal[p]), srgb(pal[p + 1]), srgb(pal[p + 2]), s); } faces.push(remap[v]); } }
    const box = (cx: V3, h: V3, q: number[], col: V3) => { const [qx, qy, qz, qw] = q, base = verts.length / 3;
      const rot = (v: V3): V3 => { const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]); return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; };
      for (let n = 0; n < 8; n++) { const w = rot([(n & 1 ? 1 : -1) * h[0], (n & 2 ? 1 : -1) * h[1], (n & 4 ? 1 : -1) * h[2]]); verts.push(cx[0] + w[0], cx[1] + w[1], cx[2] + w[2]); cols.push(srgb(col[0]), srgb(col[1]), srgb(col[2]), 15); }
      for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) faces.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]); };
    try { const bx: any[] = []; RP.rigBoxes(c, { goggles: false, nv: false, slot: k.pistol ? 1 : 0, knife: !!c.anim.knifeShown, sheath: true, lightOn: false, isGuard: false, holster: !k.pistol, held: k.can ? 'smoke' : null, rifle: null }, bx);
      for (const b of bx) box(b.c, b.h, b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], [b.albedo[0] + 0.035, b.albedo[1] + 0.035, b.albedo[2] + 0.035]); } catch (e) { console.log('  (props not drawn: ' + String(e).slice(0, 120) + ')'); }
    if (at) { box(at, [0.05, 0.05, 0.05], [0, 0, 0, 1], [0.9, 0.25, 0.1]);   // the point the hand goes for, and a post under it where the man stands
      box([at[0], at[1] / 2 - 0.1, at[2] + 0.06], [0.015, at[1] / 2 - 0.1, 0.015], [0, 0, 0, 1], [0.35, 0.33, 0.3]); }
    const nV = verts.length / 3, nF = faces.length / 3;
    const head = `ply\nformat binary_little_endian 1.0\ncomment twopointsix ready-pose ${k.name}\nelement vertex ${nV}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar slot\nelement face ${nF}\nproperty list uchar int vertex_indices\nend_header\n`;
    const hb = new TextEncoder().encode(head), buf = new ArrayBuffer(hb.length + nV * 16 + nF * 13), dv = new DataView(buf); new Uint8Array(buf).set(hb, 0); let o = hb.length;
    for (let i = 0; i < nV; i++) { dv.setFloat32(o, verts[i * 3], true); dv.setFloat32(o + 4, verts[i * 3 + 1], true); dv.setFloat32(o + 8, verts[i * 3 + 2], true); dv.setUint8(o + 12, cols[i * 4]); dv.setUint8(o + 13, cols[i * 4 + 1]); dv.setUint8(o + 14, cols[i * 4 + 2]); dv.setUint8(o + 15, cols[i * 4 + 3]); o += 16; }
    for (let i = 0; i < nF; i++) { dv.setUint8(o, 3); dv.setInt32(o + 1, faces[i * 3], true); dv.setInt32(o + 5, faces[i * 3 + 1], true); dv.setInt32(o + 9, faces[i * 3 + 2], true); o += 13; }
    writeFileSync(`${out}/ready__${k.name}.ply`, new Uint8Array(buf));
    writeFileSync(`${out}/ready__${k.name}.json`, JSON.stringify({ case: k, readyShown: c.anim.readyShown ?? 0, creepShown: c.anim.creepShown ?? 0, knifeShown: !!c.anim.knifeShown, reachShown: c.anim.reachShown ?? 0, joints: Object.fromEntries(Object.entries(J).map(([n, i]) => [n, jp(c, i as number)])) }));
    console.log(`  ${out}/ready__${k.name}.ply  (${nF} tris)`);
  };
};

if (mode === 'poses') {
  console.log(`=== ready-pose: each kind's hands and elbows in his own frame [left up fwd] (m), 40 frames after the pose is asked for @ ${ROOT} ===`);
  for (const k of CASES) {
    const base = pose({ ...k, kind: k.kind }, 0), b = measure(base);   // the same man without the pose (the layer never asked for)
    const c = pose(k), m = measure(c), a = c.anim;
    console.log(`\n${k.name}  (${k.kind}${k.crouch ? ', crouched' : ''}${k.speed ? `, moving ${k.speed} m/s` : ''}${k.pistol ? ', pistol up' : ''}${k.twist ? `, body ${k.twist} rad left of the aim` : ''}${k.at ? '' : ', no point'})  readyShown ${a.readyShown.toFixed(3)}`);
    console.log(`  chest ${fv(m.chest)}  head ${fv(m.head)}  (without: chest ${fv(b.chest)} head ${fv(b.head)})`);
    console.log(`  L shoulder ${fv(m.shL)} elbow ${fv(m.elL)} wrist ${fv(m.haL)}   (without: wrist ${fv(b.haL)})   wrist→spine line ${m.dL.toFixed(3)}  reach ${(len(sub(m.haL, m.shL)) / m.armL).toFixed(2)} of the arm`);
    console.log(`  R shoulder ${fv(m.shR)} elbow ${fv(m.elR)} wrist ${fv(m.haR)}   (without: wrist ${fv(b.haR)})   wrist→spine line ${m.dR.toFixed(3)}`);
    check(finite(c), 'no NaN in any joint matrix or bone');
    check(a.readyShown > 0.99, `the pose is fully shown (${a.readyShown.toFixed(3)})`);
    check(m.dL > 0.12 && (m.dR > 0.12 || a.reachShown > 0), `neither wrist inside his own trunk (L ${m.dL.toFixed(3)}, R ${m.dR.toFixed(3)} m off the hips→neck line, want > 0.12 — but for a right hand resting on the knife: under a crouch's hung chest it is near that chord by design, checked against the chest joint below)`);
    check(len(sub(m.haL, m.shL)) <= 0.86 * m.armL + 0.02, `the left arm short of straight (${(len(sub(m.haL, m.shL)) / m.armL).toFixed(2)} of its length, want ≤ 0.85 + the IK's give)`);
    const ahead = m.haL[2] - m.chest[2];
    if (k.kind === 'grab' || k.kind === 'grabGun') {
      if (k.name !== 'grab-side') check(ahead >= 0.3, `left wrist ${ahead.toFixed(3)} m ahead of the chest joint (want ≥ 0.30)`);
      else check(len([m.haL[0] - m.chest[0], 0, m.haL[2] - m.chest[2]]) >= 0.3 && m.haL[0] > m.shL[0], `left wrist out toward a man on his left (${fv(sub(m.haL, m.chest))} off the chest)`);
      check(m.haL[1] >= m.chest[1] - 0.02 && m.haL[1] <= (k.crouch ? m.shL[1] + 0.17 : m.head[1] + 0.05), `left wrist between chest and ${k.crouch ? 'chin height off his own shoulder (crouched the head hangs below the shoulders)' : 'head height'} (${m.haL[1].toFixed(3)}; chest ${m.chest[1].toFixed(3)}, shoulder ${m.shL[1].toFixed(3)}, head joint ${m.head[1].toFixed(3)})`);
    }
    if (k.kind !== 'grabGun') {   // THE TELL's right hand: on the hilt of the sheathed knife, the elbow carried out where a camera overhead sees it
      const T = tags(c);
      if (k.can) check(a.reachShown === 0 && !a.knifeShown && T.knife === 0, `a can in the right fist: that hand does not go for the knife (reachShown ${a.reachShown})`);
      else {
        const gap = fistGap(c), flat = (u: V3, v: V3) => Math.hypot(u[0] - v[0], u[2] - v[2]), eOut = flat(m.elR, m.shR), eOut0 = flat(b.elR, b.shR), up = m.elR[1] - b.elR[1];
        const sx = m.shL[0] - m.shR[0], sz = m.shL[2] - m.shR[2], sl = Math.hypot(sx, sz), fwd = ((m.elR[0] - m.shR[0]) * -sz + (m.elR[2] - m.shR[2]) * sx) / sl, side = -((m.elR[0] - m.shR[0]) * sx + (m.elR[2] - m.shR[2]) * sz) / sl;
        check(a.reachShown === 1, `the right hand is on the hilt (reachShown ${a.reachShown})`);
        check(gap < 0.03, `the fist's grip is ${(gap * 100).toFixed(1)} cm from the sheathed handle's (want < 3)`);
        check(!a.knifeShown && T.knife === 0 && T.sheath === 3, `the knife stays sheathed: knifeShown ${a.knifeShown}, ${T.knife} knife boxes, ${T.sheath} sheath boxes (body + guard + handle)`);
        const moved = flat(m.elR, b.elR), wide = flat(m.elR, m.chest); void eOut0;
        const wMoved = flat(m.haR, b.haR);
        check((k.crouch ? wMoved >= 0.3 : moved >= 0.15) && wide >= 0.2 && eOut >= 0.17, `the right arm's change reads from above: the wrist has come ${wMoved.toFixed(3)} m in off the flank (seen from overhead${k.crouch ? '; crouched this is the change: the arm leaves his right side for under the hung chest' : ''}), the elbow has swung ${moved.toFixed(3)} m from where it hangs without the tell, to ${wide.toFixed(3)} m out from the chest joint and ${eOut.toFixed(3)} m out from its own shoulder (${f3(side)} to his right, ${f3(fwd)} ahead of the shoulder line, ${f3(up)} in height)`);
        check(len(sub(m.haR, m.chest)) > 0.15, `…and the wrist is on the chest's front, not in it (${len(sub(m.haR, m.chest)).toFixed(3)} m from the chest joint)`);
      }
    }
    if (k.kind === 'grabGun') { const d = len(sub(m.haR, b.haR)) + len(sub(m.elR, b.elR)) + len(sub(m.head, b.head)); check(d < 1e-6, `the gun arm and the head are the aim's (moved ${d.toExponential(1)} m)`); check(len(sub(m.haL, m.haR)) > 0.2, `the support hand has left the gun (${len(sub(m.haL, m.haR)).toFixed(3)} m from the gun wrist)`); }
    if (k.kind === 'strike') {
      const sx = m.shL[0] - m.shR[0], sz = m.shL[2] - m.shR[2], sl = Math.hypot(sx, sz), out = -((m.elR[0] - m.shR[0]) * sx + (m.elR[2] - m.shR[2]) * sz) / sl, outX = m.shR[0] - m.elR[0];
      void out; void outX;
      check(m.haL[2] - m.chest[2] >= 0.22, `left hand ahead of the chest (${(m.haL[2] - m.chest[2]).toFixed(3)} m)`);
      const bl = Math.atan2(sz, sx) * 180 / Math.PI, bl0 = Math.atan2(b.shL[2] - b.shR[2], b.shL[0] - b.shR[0]) * 180 / Math.PI;
      check(bl - bl0 >= 10 && bl - bl0 <= 17, `trunk bladed, left shoulder forward: ${(bl - bl0).toFixed(1)}° (want 12–15 at the shoulders)`);
    }
    if (k.kind === 'seat') {
      check(m.haL[1] < m.shL[1] - 0.1 && m.haL[2] > m.chest[2] + 0.25, `the left hand forward and down (${fv(sub(m.haL, m.shL))} off its shoulder)`);
    }
    if (k.at && (k.kind !== 'strike')) {   // the reach points AT the man: the wrist's bearing off the shoulder against the point's, in the world
      const tgt = k.twist ? local(c, k.at) : k.at, want = Math.atan2(tgt[0] - m.shL[0], tgt[2] - m.shL[2]), got = Math.atan2(m.haL[0] - m.shL[0], m.haL[2] - m.shL[2]);
      console.log(`  reach bearing ${(got * 180 / Math.PI).toFixed(1)}° vs the point's ${(want * 180 / Math.PI).toFixed(1)}° off his own forward (+ = his left)`);
      if (k.name !== 'grab-side' && !k.speed) check(Math.abs(got - want) < 0.12, 'the left hand goes for the point (bearing within 7°)');
    }
    const lean = Math.atan2(m.chest[2] - m.hips[2], m.chest[1] - m.hips[1]) - Math.atan2(b.chest[2] - b.hips[2], b.chest[1] - b.hips[1]);
    console.log(`  trunk: the hips→chest line ${(lean * 180 / Math.PI).toFixed(1)}° further forward than without; head joint moved ${fv(sub(m.head, b.head))}`);
  }
}

// ================================================================ ease: in, out, a change of kind, a strike out of the pose — nothing pops
else if (mode === 'ease') {
  console.log('=== ready-pose ease: the weight, and the largest one-frame move of either wrist (m). The hand comes up ~0.75 m in ~0.15 s (10/s in, as the door hand): a POP is that\n    travel in one frame — the bar is a third of it in, an eighth of it (0.1 m) for a change of kind or man at full weight ===');
  const c = stand(), a = c.anim; step(c, 30);
  let pL = jp(c, J.haL), pR = jp(c, J.haR), worst = 0, ws: string[] = [];
  const track = (n: number, each: (i: number) => void, label: string) => { let mx = 0; ws = []; step(c, 0); for (let i = 0; i < n; i++) { step(c, 1, () => each(i)); const l = jp(c, J.haL), r = jp(c, J.haR); mx = Math.max(mx, len(sub(l, pL)), len(sub(r, pR))); pL = l; pR = r; if (i < 8 || i % 10 === 0) ws.push(a.readyShown.toFixed(2)); } worst = Math.max(worst, mx); console.log(`  ${label}: largest step ${mx.toFixed(4)} m · readyShown ${ws.join(' ')} → ${a.readyShown.toFixed(3)}`); return mx; };
  const set = (kind: string | null, at: V3 | null) => () => { a.ready = kind; a.readyAt = at; };
  check(track(40, set('grab', NECK), 'grab in') < 0.25, 'in: eased over frames, no pop (largest step < 0.25 m)');
  check(a.readyShown === 1, 'in: the weight lands on exactly 1');
  check(track(30, set('strike', NECK), 'grab → strike at full weight') < 0.1, 'a change of kind crosses over');
  check(track(30, set('seat', SEAT), 'strike → seat') < 0.1, 'a change of kind crosses over');
  check(track(30, set('grab', [0.5, 1.45, 0.6]), 'seat → grab on another man') < 0.1, 'a change of man crosses over');
  check(track(50, set(null, null), 'out') < 0.25, 'out: eased over frames, no pop');
  check(a.readyShown === 0, 'out: the weight lands on exactly 0');
  { const h0 = fnv(2166136261, c.skel.jointData); const d = stand(); step(d, 30 + 40 + 30 + 30 + 30 + 50); void h0;
    step(c, 120); step(d, 120); let diff = 0; for (let i = 0; i < c.skel.jointData.length; i++) diff = Math.max(diff, Math.abs(c.skel.jointData[i] - d.skel.jointData[i]));
    check(diff === 0, `2 s after the pose has gone he is bit for bit the man who never took it (largest joint-matrix difference ${diff})`); }
  for (const kind of ['cross', 'jab'] as const) {
    track(40, set('strike', NECK), `guard up before a ${kind}`);
    let mx = 0, shown: string[] = [], reach = 0; const s0 = jp(c, kind === 'jab' ? J.haL : J.haR);
    step(c, 0); a.strike(kind);
    for (let i = 0; i < 70; i++) { step(c, 1, () => { a.ready = a.striking ? 'strike' : null; a.readyAt = NECK; }); const l = jp(c, J.haL), r = jp(c, J.haR); mx = Math.max(mx, len(sub(l, pL)), len(sub(r, pR))); pL = l; pR = r; reach = Math.max(reach, (kind === 'jab' ? l : r)[2] - s0[2]); if (i < 6 || i % 12 === 0) shown.push(a.readyShown.toFixed(2)); }
    console.log(`  strike('${kind}') out of the guard: largest wrist step ${mx.toFixed(3)} m (a punch: fast by design) · its fist travels ${reach.toFixed(3)} m forward · readyShown ${shown.join(' ')} · striking at the end: ${a.striking}`);
    check(finite(c) && !a.striking && reach > 0.15, `the ${kind} plays and ends (${kind === 'jab' ? 'left' : 'right'} wrist ${reach.toFixed(2)} m forward of the guard)`);
    step(c, 40, set(null, null));
  }
  { // suppression: each owner of the arms takes the pose down (eased), and it comes back after
    const owners: [string, () => void, number][] = [['tell', () => a.tell('watch'), 70], ['signal', () => a.signal('hold'), 60], ['throw', () => a.throwItem(), 50], ['reload', () => a.reload(0.8), 55], ['kick', () => a.kickDoor(), 65]];
    for (const [name, go, n] of owners) {
      step(c, 40, set('grab', NECK)); const up = a.readyShown; go(); let lo = 1, first = -1; step(c, n, i => { set('grab', NECK)(); }); void first;
      const d = stand(); void d;
      // (measured again frame by frame)
      step(c, 60, set('grab', NECK)); const back = a.readyShown;
      go(); let mn = 1; for (let i = 0; i < n; i++) { step(c, 1, set('grab', NECK)); mn = Math.min(mn, a.readyShown); lo = mn; }
      step(c, 60, set('grab', NECK));
      check(up > 0.99 && back > 0.99 && lo < 0.05 && a.readyShown > 0.99, `${name}: the pose stands down under it (to ${lo.toFixed(3)}) and comes back (${a.readyShown.toFixed(3)})`);
    }
    step(c, 40, set(null, null));
  }
}

// ================================================================ mesh: each case's posed mesh as pose-mesh.ts writes one (PLY + JSON), for a picture
// ================================================================ creep: the close-in mode's carriage — standing / crouched, hands empty / pistol, in and out, under other layers
else if (mode === 'creep') {
  const MAN: V3 = [0, 1.3, 1.6];
  const stage = (o: { crouch?: boolean; upper?: string; creep: boolean }, n = 60) => { const c = stand(), a = c.anim; if (o.crouch) a.crouchTarget = 1; if (o.upper) a.upper = o.upper; step(c, 40); step(c, n, () => { a.creep = o.creep; a.creepAt = o.creep ? world(c, MAN) : null; }); return c; };
  console.log(`=== creep: the stance against the same man without it, his own frame [left up fwd] (m) @ ${ROOT} ===`);
  for (const v of [{ name: 'standing, hands empty' }, { name: 'crouched, hands empty', crouch: true }, { name: 'standing, pistol in hand (relaxed)', upper: 'relaxed' }, { name: 'standing, pistol aimed', upper: 'aim' }, { name: 'crouched, pistol aimed', upper: 'aim', crouch: true }] as { name: string; crouch?: boolean; upper?: string }[]) {
    const b0 = stage({ ...v, creep: false }), c = stage({ ...v, creep: true }), b = measure(b0), m = measure(c), kn = [jp(c, J.knL), jp(c, J.knR)];
    const lean = (Math.atan2(m.chest[2] - m.hips[2], m.chest[1] - m.hips[1]) - Math.atan2(b.chest[2] - b.hips[2], b.chest[1] - b.hips[1])) * 180 / Math.PI;
    console.log(`\n${v.name}   creepShown ${c.anim.creepShown.toFixed(3)}`);
    console.log(`  hips ${fv(m.hips)} (without ${fv(b.hips)})  chest ${fv(m.chest)} (${fv(b.chest)})  head ${fv(m.head)} (${fv(b.head)})  hips→chest line ${lean.toFixed(1)}° further forward`);
    console.log(`  L wrist ${fv(m.haL)} (${fv(b.haL)}) elbow ${fv(m.elL)}   R wrist ${fv(m.haR)} (${fv(b.haR)}) elbow ${fv(m.elR)}`);
    check(finite(c), 'no NaN'); check(c.anim.creepShown > 0.99, 'the stance is fully shown');
    check(b.hips[1] - m.hips[1] >= (v.crouch ? 0.02 : 0.045), `pelvis sunk ${(b.hips[1] - m.hips[1]).toFixed(3)} m against the idle (want ≥ ${v.crouch ? 0.02 : 0.045}; the held stride's own pelvis rides a little higher than the idle's)`);
    { const t = [J.toL, J.toR].map(i => jp(c, i)[1]), t0 = [J.toL, J.toR].map(i => jp(b0, i)[1]); check(Math.abs(t[0] - t[1]) < (v.crouch ? 0.06 : 0.035) && (v.crouch ? Math.max(...t) < 0.04 : Math.min(...t) < Math.min(...t0) + 0.02), `both feet down${v.crouch ? ' (the crouch IDLE kneels on a dug-in rear toe; the held crouch-walk stands on both: no toe joint over 4 cm)' : ''} (toe joints ${t[0].toFixed(3)} / ${t[1].toFixed(3)} m up; the idle's ${t0[0].toFixed(3)} / ${t0[1].toFixed(3)})`); }
    if (v.upper !== 'aim') {
      check(lean >= (v.crouch ? 2 : 6), `trunk leaned forward ${lean.toFixed(1)}° (want ≥ ${v.crouch ? 2 : 6})`);
      check(m.head[2] - m.hips[2] > b.head[2] - b.hips[2] + (v.crouch ? 0.012 : 0.05), `head ${(m.head[2] - m.hips[2] - (b.head[2] - b.hips[2])).toFixed(3)} m further ahead of the hips than without`);
      check(m.haL[2] - m.hips[2] >= 0.2 && m.haL[1] > m.hips[1] + 0.15 && m.elL[1] < m.shL[1] - 0.08, `left hand up ahead of the hips (${(m.haL[2] - m.hips[2]).toFixed(3)} m ahead, ${(m.haL[1] - m.hips[1]).toFixed(3)} above them${v.upper ? '' : `, ${(m.haL[1] - b.haL[1]).toFixed(3)} higher than it hung`}), elbow bent below the shoulder`);
      check(m.dL > 0.14, `left wrist clear of the trunk (${m.dL.toFixed(3)} m off the hips→neck line)`);
      check(Math.min(...kn.map(k => len(sub(m.haL, k)))) > 0.1, `left wrist clear of both knees (${Math.min(...kn.map(k => len(sub(m.haL, k)))).toFixed(3)} m)`);
    } else {
      const g0 = b0.gunDir, g1 = c.gunDir, dg = Math.acos(Math.min(1, g0[0] * g1[0] + g0[1] * g1[1] + g0[2] * g1[2])) * 180 / Math.PI;
      check(dg < 0.01, `the bore is where the aim had it (turned ${dg.toFixed(4)}°)`);
      const r0 = len(sub(b.haR, b.shR)), r1 = len(sub(m.haR, m.shR)), l0 = len(sub(b.haL, b.haR)), l1 = len(sub(m.haL, m.haR));
      check(Math.abs(r0 - r1) < 1e-4 && Math.abs(l0 - l1) < 1e-4, `both arms are the aim's (gun wrist ↔ its shoulder ${r1.toFixed(4)} against ${r0.toFixed(4)} m, support wrist ↔ gun wrist ${l1.toFixed(4)} against ${l0.toFixed(4)})`);
    }
    if (!v.upper) {
      check(m.haR[2] - m.hips[2] >= 0.18 && m.haR[1] > b.haR[1] + 0.08, `right hand up ahead of the hips (${(m.haR[2] - m.hips[2]).toFixed(3)} m ahead, ${(m.haR[1] - b.haR[1]).toFixed(3)} higher)`);
      check(m.dR > 0.14 && Math.min(...kn.map(k => len(sub(m.haR, k)))) > 0.1, `right wrist clear of trunk and knees (${m.dR.toFixed(3)}, ${Math.min(...kn.map(k => len(sub(m.haR, k)))).toFixed(3)} m)`);
      const w0 = b.shL[0] - b.shR[0], w1 = m.shL[0] - m.shR[0]; console.log(`  shoulder joints ${w1.toFixed(3)} m apart across (without ${w0.toFixed(3)}), ${((m.shL[2] + m.shR[2]) / 2 - m.chest[2] - ((b.shL[2] + b.shR[2]) / 2 - b.chest[2])).toFixed(3)} m further ahead of the chest joint`);
    }
    if (v.upper === 'relaxed') { const d = len(sub(sub(m.haR, m.chest), sub(b.haR, b.chest))); console.log(`  gun wrist off the chest joint moved ${d.toFixed(3)} m (the carry's arm on a leaned trunk)`); check(len(sub(m.haL, m.haR)) > 0.15, `the off hand has come up off the gun (${len(sub(m.haL, m.haR)).toFixed(3)} m from the gun wrist)`); }
  }
  // the head attends to creepAt
  { const c = stand(), a = c.anim; step(c, 40); step(c, 60, () => { a.creep = true; a.creepAt = world(c, [0.9, 1.3, 1.2]); }); const hL = jp(c, J.head), n = jp(c, J.neck);
    const c2 = stand(); step(c2, 40); step(c2, 60, () => { c2.anim.creep = true; c2.anim.creepAt = world(c2, [-0.9, 1.3, 1.2]); }); const hR = jp(c2, J.head);
    void n; const top = (cc: any) => { const g = cc.skel.globalRot[J.head]; const q = g, v: V3 = [0, 0, 1]; const tx = 2 * (q[1] * v[2] - q[2] * v[1]), ty = 2 * (q[2] * v[0] - q[0] * v[2]), tz = 2 * (q[0] * v[1] - q[1] * v[0]); return Math.atan2(v[0] + q[3] * tx + q[1] * tz - q[2] * ty, v[2] + q[3] * tz + q[0] * ty - q[1] * tx) * 180 / Math.PI; };
    void hL; void hR; const d = top(c) - top(c2); check(Math.abs(d) > 25, `the head turns onto the man: ${Math.abs(d).toFixed(1)}° between a man 37° to his left and one 37° to his right`); }
  // easing: in, out, nothing pops; under a tell / a throw / a kick / the wall / a long gun it lets go and comes back
  console.log('\n--- in and out');
  { const c = stand(), a = c.anim; step(c, 40); let prev = measure(c), worst = 0, shown: number[] = [];
    const run = (n: number, on: boolean) => step(c, n, () => { a.creep = on; a.creepAt = on ? world(c, MAN) : null; });
    const watch = (n: number, on: boolean) => { for (let i = 0; i < n; i++) { run(1, on); const m = measure(c); worst = Math.max(worst, len(sub(m.haL, prev.haL)), len(sub(m.haR, prev.haR)), len(sub(m.head, prev.head)), len(sub(m.hips, prev.hips))); prev = m; shown.push(a.creepShown); } };
    watch(60, true); const tIn = shown.findIndex(x => x > 0.9) / 60; check(worst < 0.09, `coming in: no joint of hands / head / hips steps more than ${worst.toFixed(3)} m a frame (want < 0.09: the hands come up 0.45 m in a third of a second)`); check(tIn > 0.25 && tIn < 0.55, `90 % shown ${tIn.toFixed(2)} s after the mode begins (rate 6 /s)`);
    worst = 0; shown = []; watch(90, false); const tOut = shown.findIndex(x => x < 0.1) / 60; check(worst < 0.06, `going out: ≤ ${worst.toFixed(3)} m a frame`); check(tOut > 0.3 && tOut < 0.65 && a.creepShown === 0, `under 10 % ${tOut.toFixed(2)} s after it ends, 0 at rest (${a.creepShown})`);
    check(finite(c), 'no NaN through it'); }
  for (const [name, act] of [['a tell', (a: any) => a.tell('watch')], ['a throw', (a: any) => a.throwItem()], ['a reload', (a: any) => a.reload(1.6)], ['a kick', (a: any) => a.kickDoor?.()], ['a signal', (a: any) => a.signal('hold')]] as [string, (a: any) => void][]) {
    const c = stand(), a = c.anim; step(c, 40); const on = () => { a.creep = true; a.creepAt = world(c, MAN); }; step(c, 60, on);
    let prev = measure(c), worst = 0, low = 1; act(a);
    for (let i = 0; i < 240; i++) { step(c, 1, on); const m = measure(c); worst = Math.max(worst, len(sub(m.hips, prev.hips)), len(sub(m.head, prev.head))); prev = m; low = Math.min(low, a.creepShown); }
    check(low < 0.2 && a.creepShown > 0.99 && worst < 0.08 && finite(c), `${name}: the stance lets go (down to ${low.toFixed(2)}) and is back (${a.creepShown.toFixed(2)}); hips / head ≤ ${worst.toFixed(3)} m a frame through it`);
  }
  { const c = stand(), a = c.anim; step(c, 40); const on = () => { a.creep = true; a.creepAt = world(c, MAN); }; step(c, 60, on); a.longGun = true; step(c, 60, on); const lo = a.creepShown; a.longGun = false; step(c, 90, on);
    check(lo < 0.05 && a.creepShown > 0.99, `a long gun in the hands: the stance is out (${lo.toFixed(3)}), back when it is slung (${a.creepShown.toFixed(2)})`); }
  { const c = stand(), a = c.anim; step(c, 40); const on = () => { a.creep = true; a.creepAt = world(c, MAN); }; step(c, 60, on); step(c, 60, () => { on(); a.ready = 'grab'; a.readyAt = world(c, NECK); });
    const m = measure(c); check(a.readyShown > 0.99 && a.creepShown > 0.99 && m.haL[1] > m.chest[1] - 0.02 && m.haL[2] - m.chest[2] > 0.3, `the ready pose's arms win over the stance's (left wrist ${fv(sub(m.haL, m.chest))} off the chest: the reach)`); }
}

// ================================================================ gait: the held gait's contract
else if (mode === 'gait') {
  const LEG = [J.thL, J.knL, J.ftL, J.toL, J.thR, J.knR, J.ftR, J.toR];
  const legs = (c: any): V3[] => LEG.map(i => jp(c, i)), dmax = (a: V3[], b: V3[]) => Math.max(...a.map((p, i) => len(sub(p, b[i]))));
  const legMats = (c: any): number[] => { const o: number[] = []; const jd = c.skel.jointData, js = ch.skin?.joints ?? ch.joints; for (const n of LEG) { const k = js ? js.indexOf(n) : -1; if (k >= 0) for (let e = 0; e < 16; e++) o.push(jd[k * 16 + e]); } return o; };
  for (const crouch of [false, true]) {
    const c = stand(), a = c.anim, P = a.params, clip = crouch ? a.clips.Crouch_Fwd_Loop : a.clips.Walk_Loop, V = crouch ? 0.6 : 1.0;
    console.log(`\n=== held gait, ${crouch ? 'crouched' : 'standing'} @ ${ROOT} ===`);
    if (crouch) a.crouchTarget = 1; step(c, 40);
    const on = () => { a.creep = true; }, go = (v: number) => { a.speed = v; c.vel = [0, 0, v]; };
    step(c, 20, on); go(V); step(c, 60, on);
    const perM = crouch ? 1 / (P.crouchSpeed * clip.duration) : 1 / (P.walkSpeed * clip.duration);
    const pStop = a.phase, l0 = legs(c), m0 = legMats(c); go(0);
    step(c, 1, on); const pStop1 = a.phase;
    step(c, 29, on); const lHalf = legs(c); step(c, 90, on); const l2 = legs(c), m2 = legMats(c), p2 = a.phase;
    const idle = (() => { const t = stand(); if (crouch) t.anim.crouchTarget = 1; step(t, 240); return legs(t); })();
    const spread = (L: V3[]) => Math.abs(L[2][2] - L[6][2]);
    console.log(`  walked 1 s at ${V} m/s, stopped 2 s: phase ${pStop.toFixed(4)} → ${p2.toFixed(4)}; feet ${spread(l2).toFixed(3)} m apart fore-aft (the idle's: ${spread(idle).toFixed(3)})`);
    check(p2 === pStop1 && Math.abs(pStop1 - pStop) < 1e-9, `the phase is where the stop left it (${(p2 - pStop).toExponential(1)} cycles in 2 s)`);
    const dm = m0.length ? Math.max(...m0.map((x, i) => Math.abs(x - m2[i]))) : NaN;
    check(dmax(l0, l2) < 0.02, `leg joints (hip, knee, ankle, toe × 2) at the end of the stop within ${dmax(l0, l2).toFixed(4)} m of where the last walking frame had them (want < 0.02: the stop's settle + the breath)` + (m0.length ? `; joint matrices' largest element difference ${dm.toFixed(4)}` : ''));
    check(dmax(lHalf, l2) < 0.01, `…and within ${dmax(lHalf, l2).toFixed(4)} m between 0.5 s and 2 s into the stop (the breath alone; want < 0.01)`);
    check(dmax(l2, idle) > 0.06, `it is not the idle (leg joints up to ${dmax(l2, idle).toFixed(3)} m from the idle's)`);
    // a tap
    const z0 = c.pos[2]; go(V); step(c, 6, on); go(0); step(c, 30, on); const dz = c.pos[2] - z0, dp = ((a.phase - p2 + 1.5) % 1) - 0.5;
    const strideK = crouch ? dp / (dz * perM) : 1;   // (crouched the deliberate stride and the pace change the cycles per metre: reported, held to the standing figure's band)
    check(Math.abs(dp - dz * perM * (crouch ? strideK : 1)) < 1e-6 && dp > 0 && (crouch ? strideK > 0.7 && strideK <= 1.001 : Math.abs(dp / (dz * perM) - 1) < 0.02), `a 0.1 s tap: moved ${dz.toFixed(3)} m, the phase ${dp.toFixed(4)} cycles = ${(dp / dz).toFixed(3)} per metre (the clip's own: ${perM.toFixed(3)}${crouch ? `; × ${strideK.toFixed(3)} for the crouch's longer stride` : ''})`);
    const pT = a.phase; step(c, 60, on); check(a.phase === pT, 'and it holds there');
    // blocked: the legs asked to walk, the root going nowhere
    a.speed = V; c.vel = [0, 0, 0]; step(c, 30, on); check(a.phase === pT, `asked to walk with the root held (a wall): the phase stays (${(a.phase - pT).toExponential(1)})`);
    // resume: on from the held phase
    go(V); step(c, 1, on); const d1 = ((a.phase - pT + 1.5) % 1) - 0.5; check(d1 > 0 && d1 < 0.03, `setting off again the first frame moves the phase on ${d1.toFixed(4)} from where it was held (no reset)`);
    // skate under the held gait at a slow pace: the lower foot's ground speed
    const skate = (creep: boolean, v: number) => { const t = stand(); if (crouch) t.anim.crouchTarget = 1; step(t, 40); t.anim.speed = v; t.vel = [0, 0, v]; const f = () => { t.anim.creep = creep; }; step(t, 120, f); let sum = 0, n = 0, prev: V3[] | null = null;
      for (let i = 0; i < 240; i++) { step(t, 1, f); const w = [J.toL, J.toR].map(j => world(t, jp(t, j))); if (prev) { const k = w[0][1] < w[1][1] ? 0 : 1; if (Math.min(w[0][1], w[1][1]) < Math.max(w[0][1], w[1][1]) - 0.015) { sum += Math.abs(w[k][2] - prev[k][2]) * 60; n++; } } prev = w; } return n ? sum / n : NaN; };
    for (const v of crouch ? [0.3, 0.6] : [0.3, 0.6, 1.0]) console.log(`  planted toe's ground speed at ${v} m/s: held gait ${(skate(true, v) * 100).toFixed(1)} cm/s · the normal gait ${(skate(false, v) * 100).toFixed(1)} cm/s`);
    { const sk = skate(true, 0.3), sn = skate(false, 0.3); check(sk < Math.max(sn, 0.05) + 0.03, `at a 0.3 m/s creep the planted toe slides ${(sk * 100).toFixed(1)} cm/s (the normal gait there: ${(sn * 100).toFixed(1)})`); }
    // leaving the mode at rest: back to the idle
    go(0); step(c, 30, on); let worst = 0, prev = legs(c); a.creep = false; for (let i = 0; i < 90; i++) { step(c, 1); const L = legs(c); worst = Math.max(worst, dmax(L, prev)); prev = L; }
    const t = stand(); if (crouch) t.anim.crouchTarget = 1; step(t, 60); const yz = (cc: any) => [J.hips, J.chest, J.head].map(i => { const p = jp(cc, i); return [0, p[1], p[2]] as V3; }), off = dmax(yz(c), yz(t));
    check(off < 0.025 && worst < 0.09, `the mode left at a stand: 1.5 s on hips / chest / head sit within ${off.toFixed(3)} m (height and fore-aft; the weight shift is sideways) of a man who never crept; no leg joint moved more than ${worst.toFixed(3)} m a frame on the way (a foot crossing 0.5 m in 0.4 s peaks near 0.03)`);
    check(Math.abs(spread(legs(c)) - spread(idle)) < 0.05, `…his feet ${spread(legs(c)).toFixed(3)} m apart fore-aft again (the idle's ${spread(idle).toFixed(3)})`);
    check(finite(c), 'no NaN');
  }
}

// ================================================================ knife: the reach (the tell), the lethal blow, the plain blow, the way back
else if (mode === 'knife') {
  const blade = (c: any) => { const H = c.handFrameR(), o = gripAt(c); const at = (l: number): V3 => local(c, [0, 1, 2].map(i => o[i] + H.thumb[i] * l) as V3); return { fist: at(0), base: at(0.045), tip: at(0.215) }; };
  const lineDist = (c: any, B: { base: V3; tip: V3 }) => { const m = measure(c), top: V3 = [m.head[0], m.head[1] + 0.16, m.head[2]]; let dT = 9, dH = 9; for (let i = 0; i <= 8; i++) { const p = [0, 1, 2].map(k => B.base[k] + (B.tip[k] - B.base[k]) * i / 8) as V3; dT = Math.min(dT, segDist(p, m.hips, m.neck)); dH = Math.min(dH, segDist(p, m.neck, top)); } return { dT, dH }; };
  console.log(`=== knife: the reach — the right hand to the sheathed knife and back, every frame @ ${ROOT} ===`);
  for (const kind of ['strike', 'grab', 'seat'] as const) for (const v of [{ n: 'standing' }, { n: 'crouched', crouch: true }, { n: 'crouched, moving 0.9 m/s', crouch: true, speed: 0.9 }, { n: 'body 0.6 rad off the aim', twist: 0.6 }, { n: 'in the close-in stance', creep: true }] as { n: string; crouch?: boolean; speed?: number; twist?: number; creep?: boolean }[]) {
    const c = stand(), a = c.anim; if (v.crouch) a.crouchTarget = 1; if (v.speed) { a.speed = v.speed; c.vel = [0, 0, v.speed]; }
    const tw = () => { if (v.twist) { c.bodyYaw = v.twist; c.aimYaw = 0; } if (v.creep) { a.creep = true; a.creepAt = world(c, [0, 1.3, 0.9]); } }; step(c, 40, tw);
    const on = () => { tw(); a.ready = kind; a.readyAt = kind === 'seat' ? world(c, SEAT) : world(c, NECK); };
    let prev = measure(c), worst = 0, t90 = -1, shown = false, kb = 0, gapMax = 0; const rows: string[] = [];
    for (let i = 1; i <= 60; i++) { step(c, 1, on); const m = measure(c); worst = Math.max(worst, len(sub(m.haR, prev.haR)) - (v.speed ?? 0) * 0); prev = m; const T = tags(c); kb += T.knife; if (a.knifeShown) shown = true;
      if (t90 < 0 && a.reachShown >= 0.9) t90 = i / 60; if (a.reachShown === 1) gapMax = Math.max(gapMax, fistGap(c));
      if (kind === 'strike' && v.n === 'standing' && i <= 20 && i % 2 === 0) rows.push(`    ${(i / 60).toFixed(3)} s  reachShown ${a.reachShown.toFixed(2)}  wrist ${fv(m.haR)}  elbow ${fv(m.elR)}  fist ↔ handle ${(fistGap(c) * 100).toFixed(1)} cm`); }
    if (rows.length) console.log(rows.join('\n'));
    check(t90 > 0 && t90 <= 0.35, `${kind}, ${v.n}: reachShown ≥ 0.9 after ${t90.toFixed(3)} s (want ≤ 0.35), 1 at the end: ${a.reachShown === 1}`);
    check(gapMax < 0.03, `…the fist's grip never more than ${(gapMax * 100).toFixed(2)} cm from the sheathed handle's while it rests there (want < 3)`);
    check(!shown && kb === 0, '…the knife stays sheathed: knifeShown never true, no KNIFE_TAG box on any frame');
    check(worst < 0.15 && finite(c), `…the wrist never steps more than ${worst.toFixed(3)} m a frame (want < 0.15)`);
    let t10 = -1, w2 = 0; prev = measure(c); a.ready = null; a.readyAt = null;
    for (let i = 1; i <= 60; i++) { step(c, 1, tw); const m = measure(c); w2 = Math.max(w2, len(sub(m.haR, prev.haR))); prev = m; if (t10 < 0 && a.reachShown < 0.1) t10 = i / 60; if (a.knifeShown) shown = true; }
    check(t10 > 0 && t10 <= 0.4 && w2 < 0.15 && a.reachShown === 0 && a.readyShown === 0 && !shown, `…let go: reachShown under 0.1 after ${t10.toFixed(3)} s (want ≤ 0.4), nothing left a second on; ≤ ${w2.toFixed(3)} m a frame`);
  }
  { const c = stand(), a = c.anim; step(c, 40); step(c, 40, () => { a.upper = 'aim'; a.ready = 'grabGun'; a.readyAt = world(c, NECK); }); check(a.reachShown === 0 && !a.knifeShown, 'grabGun (the pistol in that hand): no reach'); }
  { const c = stand(), a = c.anim; step(c, 40); const on = () => { a.ready = 'grab'; a.readyAt = world(c, NECK); }; step(c, 40, on); a.throwItem(); let lo = 1; step(c, 20, () => { on(); }); lo = a.reachShown; check(lo < 0.1 && !a.knifeShown, `a throw takes the hand off the hilt (reachShown ${lo.toFixed(2)} a third of a second in)`); }
  // bit-identity after it has all gone
  { const A = stand(), Bm = stand(); step(A, 40); step(Bm, 40); step(A, 40, () => { A.anim.ready = 'strike'; A.anim.readyAt = world(A, NECK); }); step(Bm, 40); A.anim.ready = null; A.anim.readyAt = null; step(A, 120); step(Bm, 120);
    let same = true; for (let i = 0; i < A.skel.jointData.length; i++) if (A.skel.jointData[i] !== Bm.skel.jointData[i]) { same = false; break; } check(same, 'two seconds after the tell has gone the man is bit for bit the man who never had one'); }

  console.log('\n=== knife: the LETHAL blow — strike(kind, true) ===');
  for (const kind of ['cross', 'jab'] as const) for (const from of ['tell', 'tell dropped as it starts', 'cold'] as const) for (const crouch of [false, true]) {
    const c = stand(), a = c.anim; if (crouch) a.crouchTarget = 1; step(c, 40);
    const tell = kind === 'jab' ? 'strike' : 'grab', man: V3 = kind === 'jab' ? [0, 1.2, 0.75] : NECK; let keep = from === 'tell';
    const on = () => { a.ready = keep ? tell : null; a.readyAt = keep ? world(c, man) : null; };
    if (from !== 'cold') { keep = true; step(c, 40, on); keep = from === 'tell'; }
    a.strike(kind, true);
    let n = 0, first = -1, last = -1, bad = 0, far = -9, tFar = 0, worst = 0, minH = 9, gapOn = -1, gapOff = -1, leth = true, prev = measure(c), prevShown = false, gapPrev = fistGap(c); const w0 = prev.haR; const rows: string[] = [];
    while (n < 200) { step(c, 1, on); n++; const m = measure(c), T = tags(c), B = blade(c), sh = !!a.knifeShown;
      if (T.knife !== (sh ? 4 : 0) || T.sheath !== (sh ? 1 : 3)) bad++;
      if (sh) { if (first < 0) { first = n; gapOn = gapPrev; } last = n; const D = lineDist(c, B); minH = Math.min(minH, D.dH); const f = B.tip[2]; if (f > far) { far = f; tFar = n / 60; } }
      if (!sh && prevShown) gapOff = fistGap(c);
      worst = Math.max(worst, len(sub(m.haR, prev.haR))); prev = m; prevShown = sh; gapPrev = fistGap(c);
      if (a.striking && !a.strikeLethal) leth = false;
      if (from === 'tell' && !crouch && n % 3 === 0) rows.push(`    ${(n / 60).toFixed(3)} s  ${sh ? 'KNIFE OUT' : 'sheathed '}  wrist ${fv(m.haR)}  ${sh ? `tip ${fv(B.tip)}` : `fist ↔ handle ${(fistGap(c) * 100).toFixed(1)} cm`}`);
      if (!a.striking) break; }
    if (rows.length) console.log(rows.join('\n'));
    const tag = `${kind}, ${from}${crouch ? ', crouched' : ''}`;
    check(first > 0 && last > first && last < n - 2 && leth, `${tag}: knifeShown from ${(first / 60).toFixed(3)} s to ${(last / 60).toFixed(3)} s of a ${(n / 60).toFixed(3)} s clip — home before it ends; strikeLethal throughout`);
    check(bad === 0, `…KNIFE_TAG boxes (4) exactly on the frames knifeShown is true, the sheath's handle and guard gone exactly then (${bad} frames wrong)`);
    check(gapOn >= 0 && gapOn < 0.03 && gapOff >= 0 && gapOff < 0.03, `…the knife leaves the fist-on-hilt and returns to it: fist ↔ handle ${(gapOn * 100).toFixed(1)} cm the frame before it shows, ${(gapOff * 100).toFixed(1)} cm the frame it is back (want < 3)`);
    check(far - Math.max(w0[2], measure(c).chest[2]) > 0.25, `…the blade's tip gets ${far.toFixed(3)} m ahead of him at ${tFar.toFixed(3)} s (the beat)`);
    let plain = 0; if (from === 'cold') { const d = stand(); if (crouch) d.anim.crouchTarget = 1; step(d, 40); d.anim.strike(kind); let q = measure(d).haR; for (let i = 0; i < n; i++) { step(d, 1); const r = measure(d).haR; plain = Math.max(plain, len(sub(r, q))); q = r; } }
    check(minH > 0.1 && worst < Math.max(0.2, plain + 0.02) && finite(c), `…the blade's line stays ${minH.toFixed(3)} m off his own head's (want > 0.10); the wrist ≤ ${worst.toFixed(3)} m a frame (want < 0.20: a blow${from === 'cold' ? ` — or the plain ${kind}'s own first frames out of hanging hands, ${plain.toFixed(3)}` : ''})`);
    step(c, 6, on);
    if (from === 'tell') check(a.reachShown === 1 && fistGap(c) < 0.03 && !a.knifeShown && !a.strikeLethal, `…after it the hand rests on the hilt again (reachShown ${a.reachShown}, ${(fistGap(c) * 100).toFixed(1)} cm)`);
    else { step(c, 60, on); check(a.reachShown === 0 && !a.knifeShown && !a.strikeLethal, '…after it nothing of the knife is left (reachShown 0)'); }
  }
  for (const kind of ['cross', 'jab'] as const) {   // two seconds on: the man who threw the plain blow at the same frame
    const A = stand(), Bm = stand(); step(A, 40); step(Bm, 40); A.anim.strike(kind, true); Bm.anim.strike(kind); step(A, 200); step(Bm, 200);
    let same = true; for (let i = 0; i < A.skel.jointData.length; i++) if (A.skel.jointData[i] !== Bm.skel.jointData[i]) { same = false; break; } check(same, `${kind}: two seconds after a cold lethal blow he is bit for bit the man who threw the plain one`); }

  console.log('\n=== knife: the PLAIN blow — strike(kind) / strike(kind, false): no knife at any frame ===');
  for (const kind of ['cross', 'jab'] as const) {
    const A = stand(), Bm = stand(), C = stand(); for (const c of [A, Bm, C]) step(c, 40);
    A.anim.strike(kind); Bm.anim.strike(kind, false); C.anim.strike(kind, true); let same = true, differs = false, any = false;
    for (let f = 0; f < 90; f++) { step(A, 1); step(Bm, 1); step(C, 1); if (A.anim.knifeShown || Bm.anim.knifeShown || A.anim.strikeLethal || tags(A).knife) any = true;
      for (let i = 0; i < A.skel.jointData.length; i++) { if (A.skel.jointData[i] !== Bm.skel.jointData[i]) same = false; if (A.skel.jointData[i] !== C.skel.jointData[i]) differs = true; } }
    check(same && !any, `${kind}: strike('${kind}') and strike('${kind}', false) are the same frames to the bit, with no knife (identity mode holds the first against the build's)`);
    check(differs, `…and the lethal one is a different blow (so the comparison compares something)`);
    // out of the tell: the hand leaves the hilt empty
    const c = stand(), a = c.anim; step(c, 40); const on = () => { a.ready = kind === 'jab' ? 'strike' : 'grab'; a.readyAt = world(c, NECK); }; step(c, 40, on); a.strike(kind);
    let t10 = -1, n = 0, kn = 0, dmax = 0; const D = stand(); step(D, 80); D.anim.strike(kind);
    while (n < 200) { step(c, 1, on); step(D, 1); n++; if (a.knifeShown || tags(c).knife) kn++; if (t10 < 0 && a.reachShown < 0.1) t10 = n / 60; if (n >= 12 && n <= 30) dmax = Math.max(dmax, len(sub(jp(c, J.haR), jp(D, J.haR)))); if (!a.striking) break; }
    check(kn === 0 && t10 > 0 && t10 <= 0.4, `${kind} out of the tell: no knife on any of ${n} frames; the hand is off the hilt (reachShown < 0.1) ${t10.toFixed(3)} s in`);
    check(dmax < 0.03, `…and through the blow (0.2 – 0.5 s) the right wrist is within ${(dmax * 100).toFixed(1)} cm of the same blow thrown with no tell (want < 3)`);
    step(c, 40, on); check(a.reachShown === 1 && !a.knifeShown, 'after it the hand goes back to the hilt (the tell is still on)');
  }
  { const c = stand(), a = c.anim; step(c, 40); a.strike('cross', true); step(c, 14); const was = a.knifeShown; a.strike('cross'); check(was && !a.knifeShown && !a.strikeLethal && tags(c).knife === 0, 'a plain blow thrown over a lethal one under way: the knife is gone on the spot'); step(c, 90); check(!a.knifeShown && finite(c), '…and stays gone'); }
}
// ================================================================ strips: the pictures the creep / held gait / knife are judged by (PLY + JSON per frame, as `mesh`)
else if (mode === 'strips') {
  const write = await MESH(); const MAN: V3 = [0, 1.3, 1.5];
  for (const v of [{ name: 'creep-stand' }, { name: 'creep-crouch', crouch: true }, { name: 'creep-pistol', upper: 'relaxed' }, { name: 'creep-aim', upper: 'aim' }, { name: 'nocreep-stand', off: true }, { name: 'nocreep-crouch', crouch: true, off: true }, { name: 'nocreep-pistol', upper: 'relaxed', off: true }] as { name: string; crouch?: boolean; upper?: string; off?: boolean }[]) {
    const c = stand(), a = c.anim; if (v.crouch) a.crouchTarget = 1; if (v.upper) a.upper = v.upper; step(c, 40); step(c, 60, () => { a.creep = !v.off; a.creepAt = v.off ? null : world(c, MAN); });
    write({ name: v.name, pistol: !!v.upper }, c, v.off ? null : MAN);
  }
  for (const crouch of [false, true]) {   // the held gait: walked, stopped two seconds mid-stride — and the same stop without the mode
    for (const creep of [true, false]) { const c = stand(), a = c.anim; if (crouch) a.crouchTarget = 1; step(c, 40); const on = () => { a.creep = creep; a.creepAt = creep ? world(c, MAN) : null; }; step(c, 20, on);
      a.speed = crouch ? 0.6 : 1; c.vel = [0, 0, a.speed]; step(c, crouch ? 78 : 70, on); a.speed = 0; c.vel = [0, 0, 0]; step(c, 120, on);
      write({ name: `${creep ? 'held' : 'stopped'}-${crouch ? 'crouch' : 'stand'}` }, c, creep ? MAN : null); }
  }
  for (const kind of ['strike', 'grab', 'seat'] as const) for (const crouch of [false, true]) {   // the tell: the hand on the hilt
    const c = stand(), a = c.anim; if (crouch) a.crouchTarget = 1; step(c, 40); const at = kind === 'seat' ? SEAT : NECK; step(c, 40, () => { a.ready = kind; a.readyAt = world(c, at); a.creep = true; a.creepAt = world(c, at); });
    write({ name: `tell-${kind}${crouch ? '-crouch' : ''}` }, c, at);
  }
  for (const f of [4, 8, 12, 18]) { const c = stand(), a = c.anim; step(c, 40); step(c, f, () => { a.ready = 'strike'; a.readyAt = world(c, NECK); }); write({ name: `reach-${String(f).padStart(2, '0')}` }, c, NECK); }
  for (const kind of ['cross', 'jab'] as const) {   // the lethal blow out of the tell
    const man: V3 = kind === 'jab' ? [0, 1.2, 0.75] : NECK;
    for (const f of kind === 'cross' ? [4, 9, 13, 16, 20, 26, 34, 44] : [4, 8, 12, 15, 19, 24, 30, 40]) { const c = stand(), a = c.anim; step(c, 40); const on = () => { a.ready = kind === 'jab' ? 'strike' : 'grab'; a.readyAt = world(c, man); }; step(c, 40, on); a.strike(kind, true); step(c, f, on);
      write({ name: `blow-${kind}-${String(f).padStart(2, '0')}` }, c, man); }
  }
}
else if (mode === 'mesh') {
  const write = await MESH(); const only = flag('--only');
  for (const k of [...CASES, { name: 'none', kind: '', at: null } as Case, { name: 'none-pistol', kind: '', at: null, pistol: true } as Case, { name: 'none-crouch', kind: '', at: null, crouch: true } as Case]) {
    if (only && !k.name.startsWith(only)) continue;
    const c = k.kind ? pose(k) : pose(k, 0); write(k, c, k.at ? (k.twist ? local(c, k.at) : k.at) : null);
  }
}
else { console.error(`ready-pose-probes: unknown mode '${mode}' — poses | identity | ease | creep | gait | knife | mesh | strips`); process.exit(2); }

console.log(fails ? `\n=== ready-pose-probes ${mode}: ${fails} FAIL ===` : `\n=== ready-pose-probes ${mode}: ALL PASS ===`);
process.exit(fails ? 1 : 0);
