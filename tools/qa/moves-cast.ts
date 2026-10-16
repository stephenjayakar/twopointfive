// THE SECOND PASS'S MOVES ON THE CAST (character.ts MOVES.reload / bound / clutch): the layers were built on the skeleton, and the cast wears vests, pouches, hats
// and hair the mannequin does not — so each key pose is checked against the MESH each variant wears. The cast is skinned on the CPU at the pose (render/meshbvh.ts
// skinVertices, the mesh-shadow reference's own blend) and, for the hand that moved, the wrist and the knuckles are measured against everything he wears that is
// not his arms: how far to the nearest surface, and whether the point is INSIDE it (an odd count of surface crossings on a majority of three rays).
// A hand resting ON cloth reads 0–4 cm outside; a hand sunk in a vest reads inside.
//
// THE HAND PASS (character.ts HAND): an empty hand hangs OPEN now, so its fingers reach 6–8 cm further down the thigh than the clips' fist did — the same test on
// every finger's middle joint, last joint and tip of both hands, standing and through a walk's stride and a run's, against what he wears AND against the boxes the
// game draws on him with nothing in his hands (the holstered sidearm on the thigh: rigProps).
//
//   bun run tools/qa/moves-cast.ts            → one line per (side, variant, pose); exit 1 if any point is inside what he wears by more than SINK
//   bun run tools/qa/probes.ts moves-cast     → the same as a probe (family `moves`)
import { ROOT, loadCastCharacter } from './headless.ts';
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const { skinVertices } = await import(`${ROOT}/src/render/meshbvh.ts`);
const { castSide } = await import(`${ROOT}/src/anim/gltf.ts`);
type V3 = [number, number, number];
const DT = 1 / 60, SINK = 0.03;   // m: a wrist joint sits ~3 cm under the skin of its own hand — deeper than that inside a surface is a hand through it
const { sc20kGrip, carbineGrip, rigBoxes, holsterBoxes, RIG } = await import(`${ROOT}/src/game/rigProps.ts`);
let ch: any, mesh: any, cast: any;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** distance from p to triangle ABC (Ericson's closest point) */
function triDist(p: V3, a: V3, b: V3, c: V3): number {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); let q: V3;
  if (d1 <= 0 && d2 <= 0) q = a;
  else { const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else { const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
      else { const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else { const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
          else { const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
            else { const dn = 1 / (va + vb + vc), v = vb * dn, w = vc * dn; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; } } } } } }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** vertices that belong to an arm (dominant joint under either clavicle): the hand's own sleeve and glove are not something it can clip into */
function armVerts(c: any): Uint8Array {
  const nd = c.anim.nodes, arm = new Set<number>(); const walk = (i: number) => { arm.add(i); for (const k of ch.nodes[i].children) walk(k); }; walk(nd.upperArmL); walk(nd.upperArmR);
  const armJoint = ch.skin.joints.map((n: number) => arm.has(n)); const out = new Uint8Array(mesh.vertexCount);
  for (let v = 0; v < mesh.vertexCount; v++) { let w = 0; for (let k = 0; k < 4; k++) if (armJoint[mesh.joints[v * 4 + k]]) w += mesh.weights[v * 4 + k]; out[v] = w > 0.35 ? 1 : 0; }
  return out;
}
function measure(c: any, mask: number, pts: [string, V3][], isArm: Uint8Array) {
  const P = skinVertices(mesh.positions, mesh.joints, mesh.weights, c.skel.jointData), I = mesh.indices, part = mesh.part as Uint8Array;
  const worn = (v: number) => ((mask >>> part[v]) & 1) === 1 && !isArm[v];
  const dirs: V3[] = [[0.57, 0.62, 0.54], [-0.71, 0.31, 0.63], [0.2, -0.4, -0.9]];
  return pts.map(([name, p]) => {
    let near = Infinity; const hits = [0, 0, 0];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], d = I[t + 2]; if (!worn(a) || !worn(b) || !worn(d)) continue;
      const A: V3 = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], B: V3 = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], C: V3 = [P[d * 3], P[d * 3 + 1], P[d * 3 + 2]];
      if (Math.abs(A[0] - p[0]) < near + 0.6 && Math.abs(A[1] - p[1]) < near + 0.6) { const l = triDist(p, A, B, C); if (l < near) near = l; }   // (the surface itself, not its vertices: a wide vest panel has few)
      if (Math.abs(A[0] - p[0]) > 1.2) continue;
      const e1 = sub(B, A), e2 = sub(C, A), s = sub(p, A);
      for (let k = 0; k < 3; k++) { const rd = dirs[k], h = cross(rd, e2), det = dot(e1, h); if (Math.abs(det) < 1e-12) continue; const u = dot(s, h) / det; if (u < 0 || u > 1) continue; const q = cross(s, e1), w = dot(rd, q) / det; if (w < 0 || u + w > 1) continue; if (dot(e2, q) / det > 1e-6) hits[k]++; }
    }
    const inside = hits.filter(n => n % 2 === 1).length >= 2;
    return { name, near, inside };
  });
}
const mid = (a: V3, b: V3, k = 0.5): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const handPts = (c: any, L: boolean): [string, V3][] => { const b = c.bones, w = L ? b.handL : b.handR, f = L ? b.fingerL : b.fingerR; return [[L ? 'L wrist' : 'R wrist', [...w] as V3], [L ? 'L knuckles' : 'R knuckles', f ? [...f] as V3 : [...w] as V3], [L ? 'L palm' : 'R palm', f ? mid(w, f) : [...w] as V3]]; };
const fresh = (rifle: boolean, trained: number) => { const c: any = new CH.Character(ch, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 }); c.anim.phase = 0; c.anim.trained = trained;
  if (rifle) { c.anim.longGun = true; c.anim.longSteady = trained > 0.5 ? 1 : 0; c.anim.longGrip = trained > 0.9 ? sc20kGrip() : carbineGrip(); c.muzzleAhead = 0.5; c.anim.upper = 'aim'; }   // (each side on its own gun's grip point, as game.ts deals it)
  else { c.anim.upper = 'none'; c.anim.stance = 'none'; }
  for (let i = 0; i < 90; i++) c.update(DT); return c; };
const run = (c: any, secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) c.update(DT); };

/** the hand pass's points: every digit's middle joint, last joint and tip (the last bone carried on by 0.8 of its length) of both hands */
const fingerPts = (c: any): [string, V3][] => { const out: [string, V3][] = [];
  for (const s of ['L', 'R']) for (const f of ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky']) { const at = (j: number): V3 => { const p = c.skel.nodePos(ch.nodeByName.get(`DEF-${f}.0${j}.${s}`)); return [p[0], p[1], p[2]]; };
    const a = at(2), b = at(3), nm = `${s} ${f.replace('f_', '')}`; out.push([`${nm} mid`, a], [`${nm} last`, b], [`${nm} tip`, mid(a, b, 1.8)]); }
  return out; };
/** an empty-handed man of a side, as game.ts drills it, `secs` into standing (speed 0) or moving */
const empty = (trained: number, speed: number, secs: number, id = 1) => () => { const c: any = new CH.Character(ch, { id, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 }); c.anim.phase = 0; c.anim.trained = trained; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.speed = speed; run(c, secs); return c; };
/** how deep a point stands inside any of the boxes the game draws on an empty-handed man of this side (0 = outside them all) */
function inBoxes(c: any, side: string, p: V3): number {
  const out: any[] = [];
  if (side === 'operator') rigBoxes(c, { goggles: false, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true }, out); else if (side !== 'civilian') holsterBoxes(c, out, { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip });
  let deep = 0;
  for (const b of out) { const q: number[] = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], d: V3 = sub(p, b.c), v: V3 = [-q[0], -q[1], -q[2]], w = q[3];
    const t = cross(v, d), t2: V3 = [t[0] * 2, t[1] * 2, t[2] * 2], u = cross(v, t2), l: V3 = [d[0] + w * t2[0] + u[0], d[1] + w * t2[1] + u[1], d[2] + w * t2[2] + u[2]];
    const m = Math.min(b.h[0] - Math.abs(l[0]), b.h[1] - Math.abs(l[1]), b.h[2] - Math.abs(l[2])); if (m > deep) deep = m; }
  return deep;
}
interface Pose { name: string; side: 'operator' | 'defender' | 'civilian' | 'responder'; make: () => any; pts: (c: any) => [string, V3][]; boxes?: boolean; }
const FN = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }, AK = { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 };
const reloadAt = (trained: number, back: boolean, beat: any, clip: number, t: number) => () => { const c = fresh(true, trained); c.anim.reloadBack = back; c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.reload(clip, beat); run(c, t); return c; };
const POSES: Pose[] = [
  { name: 'reload: hand at the magazine', side: 'operator', make: reloadAt(1, true, FN, 2.4, FN.out), pts: c => handPts(c, true) },
  { name: 'reload: fresh one off the vest', side: 'operator', make: reloadAt(1, true, FN, 2.4, (FN.out + FN.in_) / 2 + 0.06), pts: c => handPts(c, true) },
  { name: 'reload: seating it', side: 'operator', make: reloadAt(1, true, FN, 2.4, FN.in_), pts: c => handPts(c, true) },
  { name: 'reload: hand at the magazine', side: 'defender', make: reloadAt(0.12, false, AK, 1.6, AK.out), pts: c => handPts(c, true) },
  { name: 'reload: fresh one off the belt', side: 'defender', make: reloadAt(0.12, false, AK, 1.6, (AK.out + AK.in_) / 2 + 0.06), pts: c => handPts(c, true) },
  { name: 'reload: seating it', side: 'defender', make: reloadAt(0.12, false, AK, 1.6, AK.in_), pts: c => handPts(c, true) },
  { name: 'reload: on the handle', side: 'defender', make: reloadAt(0.12, false, AK, 1.6, AK.rack), pts: c => handPts(c, true) },
  { name: 'reload: hand at the magazine', side: 'responder', make: reloadAt(0.75, false, AK, 1.6, AK.out), pts: c => handPts(c, true) },
  { name: 'reload: fresh one off the vest', side: 'responder', make: reloadAt(0.75, false, AK, 1.6, (AK.out + AK.in_) / 2 + 0.06), pts: c => handPts(c, true) },
  { name: 'clutch: hand to the ribs', side: 'responder', make: () => { const c = fresh(true, 0.75); c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.clutch = 1; run(c, 1); return c; }, pts: c => handPts(c, true) },
  { name: 'clutch: hand to the ribs', side: 'defender', make: () => { const c = fresh(true, 0.12); c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.clutch = 1; run(c, 1); return c; }, pts: c => handPts(c, true) },
  { name: 'hostage: wrists behind the back', side: 'civilian', make: () => { const c = fresh(false, 0.5); c.anim.crouchTarget = 1; run(c, 1); c.anim.bound = 1; run(c, 1); return c; }, pts: c => [...handPts(c, true), ...handPts(c, false)] },
  { name: 'stay down: hands on the head', side: 'civilian', make: () => { const c = fresh(false, 0.5); c.anim.crouchTarget = 1; run(c, 1); c.anim.bound = 2; run(c, 1); return c; }, pts: c => [...handPts(c, true), ...handPts(c, false)] },
  // the hand pass: relaxed fingers beside the thigh, the holster and the pouches — standing, at four points of a walk's stride and of a run's, each side at its own drill
  ...(([['operator', 1], ['defender', 0.12], ['responder', 0.75], ['civilian', 0.5]] as const).flatMap(([side, tr]): Pose[] => [
    { name: 'empty hands: standing', side, make: empty(tr, 0, 2), pts: fingerPts, boxes: true },
    ...[0, 1, 2, 3].map((k): Pose => ({ name: `empty hands: walking, ${k}/4 of a stride`, side, make: empty(tr, 1.4, 2 + k * 0.26), pts: fingerPts, boxes: true })),
    ...[0, 1, 2, 3].map((k): Pose => ({ name: `empty hands: running, ${k}/4 of a stride`, side, make: empty(tr, 3.4, 2 + k * 0.17), pts: fingerPts, boxes: true })) ])),
];
export async function movesCast(): Promise<boolean> {
  ch ??= await loadCastCharacter(); mesh = ch.mesh; cast = ch.cast; if (!cast || !mesh.part) { console.log('- FAIL — moves-cast: no cast loaded'); return false; }
  const keep = { ...CH.MOVES }; Object.assign(CH.MOVES, { on: 1, reload: 1, bound: 1, clutch: 1 });
  let bad = 0; const cmS = (m: number) => (m * 100).toFixed(1);
  console.log(`=== moves-cast: the second pass's key poses against what each variant of the cast wears (inside by more than ${cmS(SINK)} cm = through it) ===`);
  try {
    for (const Pz of POSES) {
      const c = Pz.make(), isArm = armVerts(c), pts = Pz.pts(c);
      for (const v of castSide(cast, Pz.side)) {
        const m = measure(c, v.mask, pts, isArm); const sunk = m.filter(x => x.inside && x.near > SINK);
        if (Pz.boxes) {   // (thirty points a pose: the line names the worst, not every one)
          const bx = pts.map(([name, p]) => ({ name, deep: inBoxes(c, Pz.side, p) })), inBox = bx.filter(x => x.deep > SINK), worstBox = bx.reduce((a, b) => b.deep > a.deep ? b : a);
          const ins = m.filter(x => x.inside), worst = ins.length ? ins.reduce((a, b) => b.near > a.near ? b : a) : null, nearest = m.reduce((a, b) => b.near < a.near ? b : a);
          if (sunk.length || inBox.length) bad++;
          console.log(`- ${sunk.length || inBox.length ? 'FAIL' : 'PASS'} — ${Pz.name} · ${v.side} ${v.name}\n    ${m.length} finger points · ${worst ? `deepest inside what he wears: ${worst.name} ${cmS(worst.near)} cm` : `none inside what he wears (nearest: ${nearest.name} ${cmS(nearest.near)} cm off)`} · ${worstBox.deep > 0 ? `deepest inside a drawn box: ${worstBox.name} ${cmS(worstBox.deep)} cm` : 'none inside a drawn box'}`);
          continue;
        }
        if (sunk.length) bad++;
        console.log(`- ${sunk.length ? 'FAIL' : 'PASS'} — ${Pz.name} · ${v.side} ${v.name}\n    ${m.map(x => `${x.name} ${x.inside ? 'INSIDE' : 'outside'} ${cmS(x.near)} cm`).join(' · ')}`);
      }
    }
  } finally { Object.assign(CH.MOVES, keep); }
  console.log(`=== moves-cast: ${bad ? `${bad} FAIL` : 'ALL PASS'} ===`);
  return bad === 0;
}
if (import.meta.main) process.exit((await movesCast()) ? 0 : 1);
