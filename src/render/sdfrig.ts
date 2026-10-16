// The per-character SDF RIG (docs/internal/sdf-characters.md is the record). Every mannequin's 15 shadow / reflection proxies — the segments
// Character.capsules() builds off the skeleton each frame, in that order — are ROUND CONES (tapered capsules: radius r0 at end a, r1 at end b) whose
// radii are LEAST-SQUARES FITTED to the glTF mesh once at load: for each slot, the bind-pose vertices dominated by its joints (JOINTS below) are
// projected onto its bind-pose segment and ρ ≈ r0·(1 − u) + r1·u is solved (a vertex past an end fits that end's cap radius), the residual per slot
// printed (`rigTable`), and RIG_OVERRIDES lets a slot be pinned by hand. Nothing here touches the GPU: BoxWorld.upload applies the fit to every frame's
// proxy list (scene/boxes.ts applyRig — r0 replaces the hand radius, r1 rides quantised to the millimetre in the top byte of `misc`, the character's cull
// sphere is fitted to the cones) once the Engine has it (setRigFit: game.ts / the viewer at character load), and shaders/sdfrig.wgsl (appended to the
// scene prelude) has the GPU side: the closed-form ray / round-cone test every proxy loop in common.wgsl runs, plus two switchable extras — (ii) the
// sphere-traced SMOOTH UNION of a man's cones (polynomial smin, K below per slot) as the reflection pass's closest hit, (iii) the soft-shadow query as
// the direct estimator's character visibility (an experiment).
import { GltfCharacter, MeshData, castGoggles, castSuit } from '../anim/gltf';
import { Mat4, Vec3, m4, v3 } from '../math/vec';

/** = BoxWorld.CAPS_PER_CHAR: the slots of Character.capsules(), in its order */
export const RIG_SLOTS = 15;
export const RIG_SLOT_NAMES = ['lowerTorso', 'chest', 'shoulders', 'pelvis', 'neckHead', 'upperArmL', 'forearmL', 'upperArmR', 'forearmR', 'thighL', 'shinL', 'soleL', 'thighR', 'shinR', 'soleR'] as const;
export type RigSlotName = typeof RIG_SLOT_NAMES[number];
/** the radii Character.capsules() authors by hand for the same slots (the 'was' column of the table; what a slot keeps when there is nothing to fit it to, and what an Engine with no fit attached traces) */
export const HAND_RADII: readonly number[] = [0.15, 0.16, 0.07, 0.11, 0.105, 0.052, 0.042, 0.052, 0.042, 0.075, 0.058, 0.033, 0.075, 0.058, 0.033];
/** SMOOTH-UNION blend radius per slot (m): slot s is folded into the running union with smin(·, ·, K[s]) in FOLD_ORDER — a knee / elbow / neck fillet the
 *  size of the joint, the arms last against everything with 2 cm so an arm at the side does not web to the ribs, the thighs 4 cm (the crotch fills, as
 *  cloth does). shaders/sdfrig.wgsl RIG_K carries the same numbers in slot order (× frame.rigCfgB.x for A/B; 0 = the plain union). */
export const RIG_K: readonly number[] = [0.0, 0.06, 0.05, 0.06, 0.03, 0.02, 0.03, 0.02, 0.03, 0.04, 0.04, 0.03, 0.04, 0.04, 0.03];
export const FOLD_ORDER: readonly number[] = [0, 3, 1, 2, 4, 9, 10, 11, 12, 13, 14, 5, 6, 7, 8];
/** the largest smin bulge (k/4) any joint adds outside its cones — cull spheres and the closest hit's entry test are padded by it */
export const RIG_KPAD = [...RIG_K].sort((a, b) => b - a).slice(0, 3).reduce((n, k) => n + k, 0) / 4;   // each smin bulges ≤ k/4 outside the plain union, and the fold NESTS: where three blends meet (chest + shoulders + neck) the surface can sit up to the sum of the three largest k/4 outside — the entry cones and the cull sphere are padded by that
/** r1 rides in the top byte of a capsule's misc word in these units (0 = 'same as r0': a plain capsule — what a record nobody fitted decodes to) */
export const RB_QUANT = 0.001;
/** Hand overrides, applied over the least-squares result (metres). Empty = the fit as solved. Example: { neckHead: { r1: 0.105 } } */
export const RIG_OVERRIDES: Partial<Record<RigSlotName, { r0?: number; r1?: number }>> = {
  // the fit says 5.0 → 4.5 cm for the shoe, but Character.capsules() runs the sole's axis 3.3 cm off the floor (its capsule radius): a 5 cm solid on that
  // line sits 1.7 cm INTO the floor, and every floor receiver within ~3.7 cm of the line is then inside a proxy — occluded from t = 0 for every light, a
  // black rim round each shoe whichever way the light comes, and reflection rays that start inside the union. Pinned a millimetre proud of the axis height.
  soleL: { r0: 0.034, r1: 0.034 }, soleR: { r0: 0.034, r1: 0.034 },
};

export interface RigSlotFit {
  name: RigSlotName;
  /** fitted radii at end a / end b (after overrides) and what the solve alone said */
  r0: number; r1: number; solved: [number, number];
  /** vertices used, RMS and max |ρ − r(u)| over them (m), the share of them INSIDE the fitted cone, the segment's bind-pose length */
  n: number; rms: number; maxAbs: number; cover: number; len: number;
  /** the hand-authored capsule radius this slot had */
  hand: number;
  overridden: boolean;
}
export interface RigFit { r0: Float32Array; r1: Float32Array; slots: RigSlotFit[]; verts: number; ms: number;
  /** THE CAST: men who wear different parts of the cast mesh have different fits — keyed by the character's id (the owner byte of his proxy records), read by BoxWorld.applyRig before the
   *  fit's own radii (game.ts fills it as men are drawn: fitRig(ch, his part mask)). Absent / no entry = this fit. */
  byOwner?: Map<number, { r0: Float32Array; r1: Float32Array; pad?: number }>;
  /** THE CAST: how far (m) the worn mesh reaches outside the union of its own fitted cones in bind pose (a hat brim, an antenna, goggles flipped up) — BoxWorld.applyRig adds it to
   *  the man's cull sphere, which is also the mesh walk's broad phase, so a ray that grazes only that sliver still meets him. Absent on the mannequin (mask 0): the sphere as it was. */
  pad?: number; }

type J = Record<string, Vec3>;
/** exact signed distance from p to the round cone (a, r0) → (b, r1) (iq's sdRoundCone; the CPU twin of shaders/sdfrig.wgsl sdRoundCone) */
export function sdRoundCone(p: Vec3, a: Vec3, b: Vec3, r0: number, r1: number): number {
  const ba = v3.sub(b, a); const l2 = v3.dot(ba, ba); const rr = r0 - r1; const a2 = l2 - rr * rr; const il2 = 1 / l2;
  const pa = v3.sub(p, a); const y = v3.dot(pa, ba); const z = y - l2;
  const q = v3.sub(v3.scale(pa, l2), v3.scale(ba, y)); const x2 = v3.dot(q, q);
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r1;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r0;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r0;
}
/** slot → its bind-pose segment (the construction rules of Character.capsules(), on bind-pose joints), the joints whose dominated vertices it is fitted to, the span of the
 *  segment parameter u a vertex may have, and `after`: slots fitted before it whose cones this one only has to explain the OUTSIDE of (the shoulder line widens the
 *  chest, the pelvis line the lower torso — a torso is wider than deep, and one round cone up the spine fits its depth) */
const SLOTS: { name: RigSlotName; seg: (j: J) => [Vec3, Vec3]; joints: string[]; uRange: [number, number]; after?: RigSlotName[]; rhoMax?: number }[] = (() => {
  const ext = (a: Vec3, b: Vec3, e: number): Vec3 => v3.mad(b, v3.normalize(v3.sub(b, a)), e);
  const TOE_FLOOR_Y = 0.0147;   // = character.ts TOE_FLOOR_Y (the toe bone's height with the sole on the floor)
  const sole = (foot: Vec3, toe: Vec3): [Vec3, Vec3] => {
    const up = TOE_FLOOR_Y; const heel: Vec3 = [foot[0] - (toe[0] - foot[0]) * 0.35, Math.min(foot[1], toe[1] - up + 0.033 + (foot[1] - toe[1]) * 0.15), foot[2] - (toe[2] - foot[2]) * 0.35];
    const tip: Vec3 = [toe[0], toe[1] - up + 0.033, toe[2]];
    return [heel, ext(heel, tip, 0.06)];
  };
  return [
    { name: 'lowerTorso', seg: j => [j['DEF-hips'], j['DEF-spine.002']], joints: ['DEF-hips', 'DEF-spine.001'], uRange: [-0.15, 1.15] },
    { name: 'chest', seg: j => [j['DEF-spine.002'], v3.lerp(j['DEF-upper_arm.L'], j['DEF-upper_arm.R'], 0.5)], joints: ['DEF-spine.002', 'DEF-spine.003', 'DEF-shoulder.L', 'DEF-shoulder.R'], uRange: [-0.15, 1.15] },
    { name: 'shoulders', seg: j => [j['DEF-upper_arm.L'], j['DEF-upper_arm.R']], joints: ['DEF-shoulder.L', 'DEF-shoulder.R', 'DEF-spine.003', 'DEF-upper_arm.L', 'DEF-upper_arm.R'], uRange: [-0.12, 1.12], after: ['chest'], rhoMax: 0.14 },
    { name: 'pelvis', seg: j => [j['DEF-thigh.L'], j['DEF-thigh.R']], joints: ['DEF-hips', 'DEF-thigh.L', 'DEF-thigh.R'], uRange: [-0.6, 1.6], after: ['lowerTorso'], rhoMax: 0.16 },
    { name: 'neckHead', seg: j => [j['DEF-neck'], v3.add(j['DEF-head'], [0, 0.13, 0])], joints: ['DEF-neck', 'DEF-head'], uRange: [-0.2, 1.6] },
    { name: 'upperArmL', seg: j => [j['DEF-upper_arm.L'], j['DEF-forearm.L']], joints: ['DEF-upper_arm.L'], uRange: [-0.15, 1.15] },
    { name: 'forearmL', seg: j => [j['DEF-forearm.L'], ext(j['DEF-forearm.L'], j['DEF-hand.L'], 0.09)], joints: ['DEF-forearm.L', 'DEF-hand.L'], uRange: [-0.15, 1.3] },   // (no finger joints: 3 000 of the mesh's 8 500 vertices are fingers, splayed in the T-pose — they would fit a paddle, not a fist)
    { name: 'upperArmR', seg: j => [j['DEF-upper_arm.R'], j['DEF-forearm.R']], joints: ['DEF-upper_arm.R'], uRange: [-0.15, 1.15] },
    { name: 'forearmR', seg: j => [j['DEF-forearm.R'], ext(j['DEF-forearm.R'], j['DEF-hand.R'], 0.09)], joints: ['DEF-forearm.R', 'DEF-hand.R'], uRange: [-0.15, 1.3] },
    { name: 'thighL', seg: j => [j['DEF-thigh.L'], j['DEF-shin.L']], joints: ['DEF-thigh.L'], uRange: [-0.15, 1.15] },
    { name: 'shinL', seg: j => [j['DEF-shin.L'], j['DEF-foot.L']], joints: ['DEF-shin.L'], uRange: [-0.15, 1.15] },
    { name: 'soleL', seg: j => sole(j['DEF-foot.L'], j['DEF-toe.L']), joints: ['DEF-foot.L', 'DEF-toe.L'], uRange: [-0.6, 1.4] },
    { name: 'thighR', seg: j => [j['DEF-thigh.R'], j['DEF-shin.R']], joints: ['DEF-thigh.R'], uRange: [-0.15, 1.15] },
    { name: 'shinR', seg: j => [j['DEF-shin.R'], j['DEF-foot.R']], joints: ['DEF-shin.R'], uRange: [-0.15, 1.15] },
    { name: 'soleR', seg: j => sole(j['DEF-foot.R'], j['DEF-toe.R']), joints: ['DEF-foot.R', 'DEF-toe.R'], uRange: [-0.6, 1.4] },
  ];
})();

/** bind-pose (mesh-space) position of every skin joint: the translation of inverse(inverseBindMatrix) */
function bindJoints(ch: GltfCharacter): J {
  const out: J = {}; const inv = m4.create();
  ch.skin.joints.forEach((node, k) => {
    const ibm = ch.skin.inverseBind.subarray(k * 16, k * 16 + 16) as unknown as Mat4;
    if (!m4.invert(inv, ibm)) throw new Error(`sdf rig: singular inverse bind matrix on joint ${ch.nodes[node].name}`);
    out[ch.nodes[node].name] = [inv[12], inv[13], inv[14]];
  });
  return out;
}

const cache = new WeakMap<MeshData, Map<number, RigFit>>();
let padV = new Int32Array(0), padD = new Float64Array(0);   // (fitRig's scratch: the vertices that stand outside their own cone, and by how much)
/** The rig fit for a loaded character (solved on first use, ~10 ms for the mannequin's 8.5k vertices; cached per mesh — the QA harness builds many Games). `parts`: on a CAST mesh
 *  (anim/gltf.ts loadGltfCast) fit only the vertices of the parts in this mask — one man's kit; 0 = every vertex (the mannequin; on a cast, the union of all parts). */
/** the most a cast outfit may add to its cull sphere (RigFit.pad), m */
export const RIG_PAD_MAX = 0.3;
export function fitRig(ch: GltfCharacter, parts = 0): RigFit {
  let perMesh = cache.get(ch.mesh); if (!perMesh) cache.set(ch.mesh, perMesh = new Map());
  const partOf = parts ? ch.mesh.part : undefined; if (!partOf) parts = 0;
  const hit = perMesh.get(parts); if (hit) return hit;
  const t0 = performance.now();
  const mesh = ch.mesh; const V = mesh.vertexCount;
  const { segs, cand, ends, home } = meshRows(ch);
  const r0 = new Float32Array(RIG_SLOTS), r1 = new Float32Array(RIG_SLOTS); const slots: RigSlotFit[] = [];
  let kept = new Int32Array(256);
  SLOTS.forEach((S, si) => {
    const [a, b] = segs[si]; const len = Math.sqrt(v3.dot(v3.sub(b, a), v3.sub(b, a)));
    const prior = (S.after ?? []).map(n => RIG_SLOT_NAMES.indexOf(n));   // (fitted already: SLOTS lists them earlier)
    // normal equations of ρ_i ≈ r0·A_i + r1·B_i  (A, B) = (1 − u, u) on the flank, (1, 0) / (0, 1) past the ends — over this slot's rows of the mesh (meshRows: every test
    // that does not depend on the mask is made once per mesh), in vertex order
    const C = cand[si]; const n0 = C.v.length; if (kept.length < n0) kept = new Int32Array(n0);
    let sAA = 0, sAB = 0, sBB = 0, sAr = 0, sBr = 0, n = 0;
    for (let c = 0; c < n0; c++) {
      const v = C.v[c];
      if (partOf && !((parts >>> partOf[v]) & 1)) continue;   // (a part this man does not wear)
      if (prior.length) {
        const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
        if (prior.some(k => sdRoundCone(p, segs[k][0], segs[k][1], r0[k], r1[k]) < 0.01)) continue;   // inside (or within a centimetre of) a cone fitted before this one: explained already
      }
      const A = C.A[c], B = C.B[c], rho = C.rho[c];
      sAA += A * A; sAB += A * B; sBB += B * B; sAr += A * rho; sBr += B * rho; kept[n++] = c;
    }
    const det = sAA * sBB - sAB * sAB;
    let f0: number, f1: number;
    if (n < 8 || Math.abs(det) < 1e-9) { f0 = f1 = HAND_RADII[si]; }   // (nothing to fit to: keep the hand value)
    else { f0 = (sAr * sBB - sBr * sAB) / det; f1 = (sBr * sAA - sAr * sAB) / det; }
    if (!(f0 > 0)) f0 = HAND_RADII[si]; if (!(f1 > 0)) f1 = HAND_RADII[si];   // (a NaN out of a malformed mesh keeps the hand value: BoxWorld.applyRig tells a real record from padding by radius > 0)
    f0 = Math.max(0.01, f0); f1 = Math.max(0.01, f1);
    const ov = RIG_OVERRIDES[S.name]; const q0 = Math.max(0.005, ov?.r0 ?? f0), q1 = Math.max(0.005, ov?.r1 ?? f1);   // (an override may slim a slot, never zero it — same reason)
    let se = 0, mx = 0, inside = 0;
    for (let k = 0; k < n; k++) { const c = kept[k]; const e = C.rho[c] - (q0 * C.A[c] + q1 * C.B[c]); se += e * e; mx = Math.max(mx, Math.abs(e)); if (e <= 0) inside++; }
    r0[si] = q0; r1[si] = q1;
    slots.push({ name: S.name, r0: q0, r1: q1, solved: [f0, f1], n, rms: n ? Math.sqrt(se / n) : 0, maxAbs: mx, cover: n ? inside / n : 0, len, hand: HAND_RADII[si], overridden: !!ov });
  });
  const fit: RigFit = { r0, r1, slots, verts: V, ms: performance.now() - t0 };
  if (partOf) {   // the cast: the least-squares cones do not BOUND what he wears — measure how far it stands outside them (capped: one stray vertex must not blow the sphere up)
    // pad = the greatest, over the worn vertices, of the distance to the NEAREST cone — found without asking every cone of every vertex: a vertex's nearest cone is no
    // farther than its OWN (the first slot it is a row of, else the one whose line it lies nearest: meshRows), so a vertex whose own-cone distance is inside the pad so far
    // cannot raise it. The distances asked are sdRoundCone's own values and the pad is one of them: which vertices are asked, and in what order, moves no bit of it.
    let pad = 0;   // (fingers and toes stand outside the forearm / sole cones on the mannequin too, and its sphere never counted them: what is measured is what the OUTFIT adds)
    let m = 0; if (padV.length < V) { padV = new Int32Array(V); padD = new Float64Array(V); }
    for (let v = 0; v < V; v++) {   // (1) each worn vertex's distance to its own cone: at or under 0 (or no number at all) and it can raise nothing
      if (!((parts >>> partOf[v]) & 1) || ends[v]) continue;
      const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]; const h = home[v];
      const d = sdRoundCone(p, segs[h][0], segs[h][1], r0[h], r1[h]);
      if (d > 0) { padV[m] = v; padD[m++] = d; }
    }
    const order = Array.from({ length: m }, (_, k) => k).sort((x, y) => padD[y] - padD[x]);
    for (const k of order) {        // (2) farthest from its own cone first: once that distance is inside the pad, so is everybody's after it
      let d = padD[k]; if (!(d > pad)) break;
      const v = padV[k], h = home[v]; const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
      for (let s = 0; s < RIG_SLOTS && d > pad; s++) if (s !== h) d = Math.min(d, sdRoundCone(p, segs[s][0], segs[s][1], r0[s], r1[s]));
      if (d > pad && d < Infinity) pad = d;
    }
    fit.pad = Math.min(pad, RIG_PAD_MAX); fit.ms = performance.now() - t0;
  }
  perMesh.set(parts, fit);
  return fit;
}
/** THE CAST'S FITS AHEAD OF PLAY: every mask a man of this cast can be drawn with — each variant with its mesh goggles up, and with the rig's box goggles in
 *  their place; a variant without goggles as it is listed; an operator's also in the sneaking suit (anim/gltf.ts castGoggles / castSuit; game/cast.ts castParts picks among exactly these) — solved now, so the frame a kit is first seen in finds its fit in the cache
 *  instead of solving it mid-play. Nothing with the mannequin loaded. A fit that throws is left for its first use to report, as before. */
export function fitRigCast(ch: GltfCharacter) {
  const cast = ch.cast; if (!cast) return;
  for (const v of cast.variants) for (const m of [castGoggles(cast, v.mask, true), castGoggles(cast, v.mask, false), ...(v.side === 'operator' ? [castSuit(cast, v.mask)] : [])]) { try { fitRig(ch, m); } catch { /* its first use says so */ } }
}

/** What a fit reads off the MESH alone, whatever the mask: the bind-pose segments, per slot the vertices it may be fitted to (dominated by one of its joints, inside its span
 *  of u and within reach of its line) with their (A, B, ρ) rows in vertex order, per vertex whether its dominant joint is a finger / toe / palm, and its OWN slot for the pad's
 *  first question (the first slot it is a row of, else the one whose segment it lies nearest). Solved once per mesh; throws what fitRig always threw for a skin without the rig's joints. */
interface MeshRows { segs: [Vec3, Vec3][]; cand: { v: Int32Array; A: Float64Array; B: Float64Array; rho: Float64Array }[]; ends: Uint8Array; home: Int8Array }
const rowsCache = new WeakMap<MeshData, MeshRows>();
function meshRows(ch: GltfCharacter): MeshRows {
  const had = rowsCache.get(ch.mesh); if (had) return had;
  const joints = bindJoints(ch);
  for (const s of SLOTS) for (const jn of [...s.joints, ...(s.seg.toString().match(/DEF-[\w.]+/g) ?? [])]) if (!joints[jn]) throw new Error(`sdf rig: the skin has no joint '${jn}' (slot ${s.name})`);
  const mesh = ch.mesh; const V = mesh.vertexCount;
  // each vertex's dominant joint (by name) — the set membership below
  const jointName = ch.skin.joints.map(n => ch.nodes[n].name);
  const dom = new Int32Array(V);
  for (let v = 0; v < V; v++) { let best = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = mesh.weights[v * 4 + c]; if (w > bw) { bw = w; best = mesh.joints[v * 4 + c]; } } dom[v] = best; }
  const byName = new Map<string, number>(); jointName.forEach((n, i) => byName.set(n, i));
  const segs = SLOTS.map(S => S.seg(joints));
  const home = new Int8Array(V).fill(-1);
  const cand = SLOTS.map((S, si) => {
    const [a, b] = segs[si]; const ba = v3.sub(b, a); const len2 = v3.dot(ba, ba);
    const set = new Set(S.joints.map(n => byName.get(n)!));
    const vs: number[] = [], As: number[] = [], Bs: number[] = [], rhos: number[] = [];
    for (let v = 0; v < V; v++) {
      if (!set.has(dom[v])) continue;
      const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
      const pa = v3.sub(p, a); const u = v3.dot(pa, ba) / len2;
      if (u < S.uRange[0] || u > S.uRange[1]) continue;
      let A: number, B: number, rho: number;
      if (u <= 0) { A = 1; B = 0; rho = v3.len(pa); }
      else if (u >= 1) { A = 0; B = 1; rho = v3.dist(p, b); }
      else { A = 1 - u; B = u; rho = v3.len(v3.mad(pa, ba, -u)); }
      if (rho > (S.rhoMax ?? 0.35)) continue;   // (a stray vertex the dominance rule mislabels — a cuff vertex weighted to the chest — is nowhere near the segment; the two cross lines only explain what lies within a hand of them)
      vs.push(v); As.push(A); Bs.push(B); rhos.push(rho); if (home[v] < 0) home[v] = si;
    }
    return { v: Int32Array.from(vs), A: Float64Array.from(As), B: Float64Array.from(Bs), rho: Float64Array.from(rhos) };
  });
  const endJoint = jointName.map(n => /^DEF-(hand|f_|thumb|palm|toe)/.test(n)); const ends = new Uint8Array(V);
  for (let v = 0; v < V; v++) ends[v] = endJoint[dom[v]] ? 1 : 0;
  for (let v = 0; v < V; v++) {   // a vertex that is no slot's row still has an OWN cone for the pad's first question: the slot whose segment it lies nearest
    if (home[v] >= 0 || ends[v]) continue;
    const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]; let best = 0, bd = Infinity;
    for (let k = 0; k < RIG_SLOTS; k++) { const [a, b] = segs[k]; const ba = v3.sub(b, a), pa = v3.sub(p, a); const u = Math.min(1, Math.max(0, v3.dot(pa, ba) / v3.dot(ba, ba))); const d = v3.len(v3.mad(pa, ba, -u)); if (d < bd) { bd = d; best = k; } }
    home[v] = best;
  }
  const out: MeshRows = { segs, cand, ends, home }; rowsCache.set(ch.mesh, out);
  return out;
}

/** the fit as a fixed-width table (console / the doc): slot · hand radius · fitted r0 / r1 · n · rms · max · cover · length */
export function rigTable(fit: RigFit): string {
  const f = (x: number, d = 3) => x.toFixed(d);
  const rows = fit.slots.map(s => `${s.name.padEnd(11)} hand ${f(s.hand)}  →  r0 ${f(s.r0)}  r1 ${f(s.r1)}${s.overridden ? ` (solved ${f(s.solved[0])} / ${f(s.solved[1])}, OVERRIDDEN)` : ''}   n ${String(s.n).padStart(4)}  rms ${f(s.rms * 1000, 1).padStart(5)} mm  max ${f(s.maxAbs * 1000, 1).padStart(5)} mm  inside ${(s.cover * 100).toFixed(0).padStart(3)} %  len ${f(s.len)}`);
  const all = fit.slots.reduce((a, s) => ({ n: a.n + s.n, se: a.se + s.rms * s.rms * s.n }), { n: 0, se: 0 });
  return rows.join('\n') + `\n${fit.verts} vertices, ${all.n} used, overall rms ${(Math.sqrt(all.se / Math.max(1, all.n)) * 1000).toFixed(1)} mm, solved in ${fit.ms.toFixed(1)} ms`;
}

// (What BoxWorld.upload needs to turn the frame's proxy list into the rig — { r0, r1, kPad } — engine.render builds inline from the attached fit, kPad = RIG_KPAD × settings.sdfRigK.)

/** WGSL the shader side needs from this table (prepended to shaders/sdfrig.wgsl by frame.ts scenePrelude): the sizes, and `charSdf(base, p, kS)` = the SMOOTH UNION of
 *  character `base ÷ capsPerChar`'s cones at p, unrolled in FOLD_ORDER with each slot's blend radius × kS (0 = the plain union) — generated here so the two sides
 *  cannot disagree about the order or the radii. */
export function sdfRigWgslConsts(): string {
  const fold = FOLD_ORDER.map((s, i) => i === 0 ? `  var d = coneSdfAt(base + ${s}u, p);` : `  d = sminP(d, coneSdfAt(base + ${s}u, p), ${RIG_K[s].toFixed(3)} * kS);`).join('\n');
  return `const RIG_SLOTS: u32 = ${RIG_SLOTS}u;\nconst RIG_KPAD: f32 = ${RIG_KPAD.toFixed(4)};\nconst RB_QUANT: f32 = ${RB_QUANT};\n`
    + `/** the smooth union of one character's ${RIG_SLOTS} round cones at p (render/sdfrig.ts FOLD_ORDER / RIG_K, × kS) */\nfn charSdf(base: u32, p: vec3f, kS: f32) -> f32 {\n${fold}\n  return d;\n}\n`;
}
