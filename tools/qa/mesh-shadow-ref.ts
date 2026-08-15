// CPU reference + numbers for mesh-traced character shadows (src/render/meshbvh.ts topology / skin / refit / walk, mirrored by the GPU
// passes in src/render/meshShadows.ts and the WGSL walk in common.wgsl under FLAG_MESH_SHADOWS). No GPU anywhere: this is how the scheme is
// proven before the lead compiles it in the browser.
//
//   bun run tools/qa/mesh-shadow-ref.ts            → everything below, human-readable
//   bun run tools/qa/mesh-shadow-ref.ts --json     → machine-readable
//   bun run tools/qa/mesh-shadow-ref.ts --fixture  → also (re)write tools/qa/mesh-shadow-fixture.json: 64 rays at a fixed pose WITH the joint
//                                                     matrices that posed it and the walk's expected answers — replayable on the GPU through
//                                                     __meshTrace (main.ts) to check the WGSL walk against this one ray for ray
//
// What it reports:
//   (a) the tree: triangles, nodes, depth, leaf sizes, build time; and that the stackless walk agrees with brute force over every triangle
//       (20k random rays per pose: any-hit yes/no identical, and the walk's t is a real blocker: ≥ the brute-force nearest)
//   (b) capsules vs mesh, per pose, over 20k shadow-like rays (receiver points on the floor / around the man → lights 1–6 m off): how often
//       the 15 capsules call a ray blocked that the mesh lets through (over-occlusion — what the feature removes) and the reverse (mesh blocked,
//       no capsule hit at all — silhouette the capsules never had, AND what a capsules-only broad phase would throw away)
//   (c) refit: level order (the GPU's) == reverse sweep == boxes recomputed from scratch per subtree, to the bit, after re-posing
//   (d) walk cost: node visits / triangle tests per ray that enters the root box, refit tree vs a tree rebuilt at that pose (the price of
//       refitting a rest-pose topology instead of rebuilding)
import { writeFileSync } from 'node:fs';
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const { loadCharacter } = await import(`${ROOT}/tools/qa/headless.ts`);
const CH = await import(`${ROOT}/src/game/character.ts`);
const B = await import(`${ROOT}/src/render/meshbvh.ts`);
type Vec3 = [number, number, number];
const ch: any = await loadCharacter();
const args = process.argv.slice(2); const asJson = args.includes('--json'); const writeFixture = args.includes('--fixture');
const out: any = {};
const log = (...a: unknown[]) => { if (!asJson) console.log(...a); };

// ---- seeded rng (mulberry32) so the numbers are the same every run
let seed = 12345;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------------------------------------------------------- (a) the tree
const mesh = ch.mesh;
const tb0 = performance.now(); const bvh = B.buildMeshBvh(mesh.positions, mesh.indices); const buildMs = performance.now() - tb0;
{
  let structural = 0;
  for (let i = 0; i < bvh.numNodes; i++) {
    if (bvh.skip[i] <= i || bvh.skip[i] > bvh.numNodes) structural++;
    if (bvh.triCount[i] === 0) { if (bvh.right[i] <= i + 1 || bvh.skip[i + 1] !== bvh.right[i] || bvh.skip[bvh.right[i]] !== bvh.skip[i]) structural++; }
    else if (bvh.skip[i] !== i + 1 || bvh.triCount[i] > B.LEAF_MAX) structural++;
  }
  const seen = new Uint8Array(bvh.numTris); for (let i = 0; i < bvh.numTris; i++) seen[bvh.triOrder[i]]++; let coverage = 0; for (let i = 0; i < bvh.numTris; i++) if (seen[i] !== 1) coverage++;
  out.tree = { tris: bvh.numTris, verts: mesh.vertexCount, nodes: bvh.numNodes, leaves: bvh.stats.leaves, avgLeaf: +bvh.stats.avgLeaf.toFixed(2), maxLeaf: bvh.stats.maxLeaf, maxDepth: bvh.maxDepth, levels: bvh.maxDepth + 1, medianSplits: bvh.stats.medianSplits, buildMs: +buildMs.toFixed(1), structuralViolations: structural, coverageViolations: coverage,
    bytesPerChar: { nodes: bvh.numNodes * 32, tris: bvh.numTris * 48 } };
  log(`(a) tree: ${bvh.numTris} tris (${mesh.vertexCount} verts) → ${bvh.numNodes} nodes, ${bvh.stats.leaves} leaves (avg ${bvh.stats.avgLeaf.toFixed(2)}, max ${bvh.stats.maxLeaf} tris), depth ${bvh.maxDepth} (${bvh.maxDepth + 1} refit levels), ${bvh.stats.medianSplits} median splits, built in ${buildMs.toFixed(0)} ms; structure violations ${structural}, coverage violations ${coverage}`);
  log(`    per character on the GPU: ${(bvh.numNodes * 32 / 1024).toFixed(0)} KB of nodes + ${(bvh.numTris * 48 / 1024).toFixed(0)} KB of skinned corners`);
}

// ---------------------------------------------------------------- poses: the real Character, stepped like the game steps it
interface PoseSpec { name: string; speed: number; crouch: number; upper: string; secs: number; yaw: number }
const POSES: PoseSpec[] = [
  { name: 'idle', speed: 0, crouch: 0, upper: 'relaxed', secs: 1.0, yaw: 0.4 },
  { name: 'walk', speed: 1.55, crouch: 0, upper: 'relaxed', secs: 1.3, yaw: 0.4 },
  { name: 'crouch-aim', speed: 0, crouch: 1, upper: 'aim', secs: 1.0, yaw: 0.4 },
  { name: 'sprint', speed: 4.7, crouch: 0, upper: 'none', secs: 1.1, yaw: 0.4 },
];
function posed(p: PoseSpec): { c: any; joints: Float32Array; caps: number[][]; bound: number[]; center: Vec3 } {
  const c = new CH.Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [10, 0, 10], yaw: p.yaw });
  const an: any = c.anim; an.phase = 0; an.speed = p.speed; an.crouchTarget = p.crouch; an.upper = p.upper;
  const DT = 1 / 60;
  for (let i = 0; i < Math.round(p.secs / DT); i++) { c.pos = [c.pos[0] + Math.sin(p.yaw) * p.speed * DT, 0, c.pos[2] + Math.cos(p.yaw) * p.speed * DT]; c.update(DT); }
  const { caps, bound } = c.capsules();
  return { c, joints: new Float32Array(c.skel.jointData), caps, bound, center: [bound[0], bound[1], bound[2]] };
}

// ---- CPU port of isectCapsule, the ray ∕ capsule test common.wgsl carried until the fitted round cones replaced it (2026-08-11) — kept here as the reference these
// numbers were taken against (the game's hand capsules, Character.capsules()): t ≥ 0 of the nearest intersection in front of the origin (0 from inside), or −1
function isectCapsule(ro: Vec3, rd: Vec3, cp: number[]): number {
  const pa: Vec3 = [cp[0], cp[1], cp[2]], ra = cp[3], pb: Vec3 = [cp[4], cp[5], cp[6]];
  const ba: Vec3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], oa: Vec3 = [ro[0] - pa[0], ro[1] - pa[1], ro[2] - pa[2]];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  if (baba <= 0) return -1;
  const hq = Math.max(0, Math.min(1, baoa / baba)); const dq: Vec3 = [oa[0] - ba[0] * hq, oa[1] - ba[1] * hq, oa[2] - ba[2] * hq];
  if (dot(dq, dq) < ra * ra) return 0;
  let a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - ra * ra * baba;
  let h = b * b - a * c;
  if (a > 1e-7 && h >= 0) {
    const t = (-b - Math.sqrt(h)) / a; const y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
    const oc: Vec3 = y <= 0 ? oa : [ro[0] - pb[0], ro[1] - pb[1], ro[2] - pb[2]];
    b = dot(rd, oc); c = dot(oc, oc) - ra * ra; h = b * b - c;
    if (h > 0) return -b - Math.sqrt(h);
    return -1;
  }
  let best = -1;
  for (let k = 0; k < 2; k++) {
    const oc: Vec3 = k === 1 ? [ro[0] - pb[0], ro[1] - pb[1], ro[2] - pb[2]] : oa;
    const bb = dot(rd, oc), cc = dot(oc, oc) - ra * ra, hh = bb * bb - cc;
    if (hh > 0) { const t = -bb - Math.sqrt(hh); if (t >= 0 && (best < 0 || t < best)) best = t; }
  }
  return best;
}
const capsOccluded = (caps: number[][], ro: Vec3, rd: Vec3, tmax: number) => { for (const cp of caps) { if (cp[3] <= 0) continue; const t = isectCapsule(ro, rd, cp); if (t >= 0 && t < tmax) return true; } return false; };

// ---- shadow-like rays: a receiver point (60 % the floor within 2 m of him, 40 % a point on nearby 'furniture / wall' 0.6–2 m off) toward a light 1–6 m
// off at 0.4–2.9 m height; tmax stops 3 cm short of the light like direct.wgsl's shadowSample
function shadowRay(center: Vec3): { ro: Vec3; rd: Vec3; tmax: number } {
  let ro: Vec3;
  if (rnd() < 0.6) { const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * 2.0; ro = [center[0] + Math.cos(a) * r, 0.015, center[2] + Math.sin(a) * r]; }
  else { const a = rnd() * 6.2832, r = 0.6 + rnd() * 1.4; ro = [center[0] + Math.cos(a) * r, 0.05 + rnd() * 2.1, center[2] + Math.sin(a) * r]; }
  const la = rnd() * 6.2832, lr = 1 + rnd() * 5; const lp: Vec3 = [center[0] + Math.cos(la) * lr, 0.4 + rnd() * 2.5, center[2] + Math.sin(la) * lr];
  const d: Vec3 = [lp[0] - ro[0], lp[1] - ro[1], lp[2] - ro[2]]; const dist = Math.hypot(d[0], d[1], d[2]);
  return { ro, rd: [d[0] / dist, d[1] / dist, d[2] / dist], tmax: dist - 0.03 };
}
// ---- uniform random rays through the character's box (for the walk-vs-brute check and the visit counts)
function boxRay(mn: Vec3, mx: Vec3): { ro: Vec3; rd: Vec3; tmax: number } {
  const c: Vec3 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]; const R = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * 0.6;
  const p: Vec3 = [mn[0] + rnd() * (mx[0] - mn[0]), mn[1] + rnd() * (mx[1] - mn[1]), mn[2] + rnd() * (mx[2] - mn[2])];   // a point in the box the ray must pass through
  const d = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
  const ro: Vec3 = [p[0] - d[0] * (R + 1), p[1] - d[1] * (R + 1), p[2] - d[2] * (R + 1)];
  void c; return { ro, rd: d, tmax: 2 * R + 2 + rnd() * 2 };
}

const RAYS = 20000;
out.poses = {};
let fixture: any = null;
for (const P of POSES) {
  const { joints, caps, center } = posed(P);
  const tv = B.skinCorners(bvh, mesh.positions, mesh.joints, mesh.weights, joints);
  const nmin = new Float32Array(bvh.numNodes * 4), nmax = new Float32Array(bvh.numNodes * 4);
  B.refitLevels(bvh, tv, nmin, nmax);
  // (c) refit: level order vs reverse sweep vs from scratch
  const rmin = new Float32Array(bvh.numNodes * 4), rmax = new Float32Array(bvh.numNodes * 4); B.refitReverse(bvh, tv, rmin, rmax);
  let refitDiff = 0, scratchDiff = 0;
  for (let i = 0; i < bvh.numNodes; i++) {
    for (let a = 0; a < 3; a++) { refitDiff = Math.max(refitDiff, Math.abs(nmin[i * 4 + a] - rmin[i * 4 + a]), Math.abs(nmax[i * 4 + a] - rmax[i * 4 + a])); }
    const sb = B.subtreeBox(bvh, i, tv);
    for (let a = 0; a < 3; a++) { scratchDiff = Math.max(scratchDiff, Math.abs(nmin[i * 4 + a] - sb.min[a]), Math.abs(nmax[i * 4 + a] - sb.max[a])); }
  }
  const rootMin: Vec3 = [nmin[0], nmin[1], nmin[2]], rootMax: Vec3 = [nmax[0], nmax[1], nmax[2]];
  // (a) walk vs brute force over rays through the root box; (d) visits, refit tree vs a tree rebuilt at this pose
  let anyMismatch = 0, tOrderBad = 0, hits = 0; const visits = [0, 0]; let entering = 0;
  const rebuilt = B.buildMeshBvh(B.skinVertices(mesh.positions, mesh.joints, mesh.weights, joints), mesh.indices);
  const rtv = B.skinCorners(rebuilt, mesh.positions, mesh.joints, mesh.weights, joints); const rbmin = new Float32Array(rebuilt.numNodes * 4), rbmax = new Float32Array(rebuilt.numNodes * 4); B.refitLevels(rebuilt, rtv, rbmin, rbmax);
  const rvisits = [0, 0];
  for (let k = 0; k < RAYS; k++) {
    const r = boxRay(rootMin, rootMax);
    const v0 = visits[0];
    const tw = B.bvhAnyHit(bvh, nmin, nmax, tv, r.ro, r.rd, r.tmax, visits);
    if (visits[0] - v0 > 1) entering++;
    B.bvhAnyHit(rebuilt, rbmin, rbmax, rtv, r.ro, r.rd, r.tmax, rvisits);
    const tb = B.bruteNearest(bvh, tv, r.ro, r.rd, r.tmax);
    if ((tw >= 0) !== (tb >= 0)) anyMismatch++;
    if (tw >= 0 && tb >= 0 && tw < tb - 1e-6) tOrderBad++;
    if (tb >= 0) hits++;
  }
  // (b) capsules vs mesh over shadow-like rays
  let both = 0, capsOnly = 0, meshOnly = 0, neither = 0;
  const BANDS = ['<0.15 m (feet)', '0.15–0.9 (legs)', '0.9–1.45 (torso/arms)', '>1.45 (head/shoulders)']; const band = (y: number) => y < 0.15 ? 0 : y < 0.9 ? 1 : y < 1.45 ? 2 : 3;
  const meshOnlyBands = [0, 0, 0, 0], capsOnlyBands = [0, 0, 0, 0];
  for (let k = 0; k < RAYS; k++) {
    const r = shadowRay(center);
    const cOcc = capsOccluded(caps, r.ro, r.rd, r.tmax);
    const tm = B.bvhAnyHit(bvh, nmin, nmax, tv, r.ro, r.rd, r.tmax); const mOcc = tm >= 0;
    if (cOcc && mOcc) both++; else if (cOcc) capsOnly++; else if (mOcc) meshOnly++; else neither++;
    if (mOcc && !cOcc) meshOnlyBands[band(r.ro[1] + r.rd[1] * tm)]++;
    if (cOcc && !mOcc) { let tc = Infinity; for (const cp of caps) { if (cp[3] <= 0) continue; const t = isectCapsule(r.ro, r.rd, cp); if (t >= 0 && t < r.tmax) tc = Math.min(tc, t); } capsOnlyBands[band(r.ro[1] + r.rd[1] * tc)]++; }
  }
  const relevant = both + capsOnly + meshOnly;
  const row = {
    refit: { levelVsReverseMaxDiff: refitDiff, levelVsScratchMaxDiff: scratchDiff },
    walkVsBrute: { rays: RAYS, blocked: hits, anyHitMismatches: anyMismatch, tBelowNearest: tOrderBad },
    cost: { raysEnteringRoot: entering, nodeVisitsPerRay: +(visits[0] / RAYS).toFixed(1), triTestsPerRay: +(visits[1] / RAYS).toFixed(1), rebuiltTree: { nodes: rebuilt.numNodes, depth: rebuilt.maxDepth, nodeVisitsPerRay: +(rvisits[0] / RAYS).toFixed(1), triTestsPerRay: +(rvisits[1] / RAYS).toFixed(1) } },
    capsulesVsMesh: { rays: RAYS, eitherBlocked: relevant, both, capsulesOnly: capsOnly, meshOnly, neither,
      overOcclusionPctOfCapsuleBlocked: +(100 * capsOnly / Math.max(1, both + capsOnly)).toFixed(1),
      meshOnlyPctOfMeshBlocked: +(100 * meshOnly / Math.max(1, both + meshOnly)).toFixed(1),
      meshOnlyByHeight: Object.fromEntries(BANDS.map((b, i) => [b, meshOnlyBands[i]])), capsulesOnlyByHeight: Object.fromEntries(BANDS.map((b, i) => [b, capsOnlyBands[i]])) },
    rootBox: { min: rootMin.map(x => +x.toFixed(3)), max: rootMax.map(x => +x.toFixed(3)) },
  };
  out.poses[P.name] = row;
  log(`\npose ${P.name}: root box ${row.rootBox.min.join(',')} … ${row.rootBox.max.join(',')}`);
  log(`  (c) refit: level order vs reverse sweep max |Δ| = ${refitDiff}, vs from-scratch subtree boxes max |Δ| = ${scratchDiff}`);
  log(`  (a) walk vs brute force, ${RAYS} rays through the root box (${hits} blocked): any-hit mismatches ${anyMismatch}, walk t < nearest t: ${tOrderBad}`);
  log(`  (d) cost per ray: ${row.cost.nodeVisitsPerRay} node visits, ${row.cost.triTestsPerRay} tri tests (refit of the rest topology) vs ${row.cost.rebuiltTree.nodeVisitsPerRay} / ${row.cost.rebuiltTree.triTestsPerRay} for a tree rebuilt at this pose (${rebuilt.numNodes} nodes, depth ${rebuilt.maxDepth})`);
  log(`  (b) capsules vs mesh, ${RAYS} shadow-like rays, ${relevant} blocked by either: both ${both} · capsules only ${capsOnly} (= ${row.capsulesVsMesh.overOcclusionPctOfCapsuleBlocked} % of what capsules block is over-occlusion) · mesh only ${meshOnly} (= ${row.capsulesVsMesh.meshOnlyPctOfMeshBlocked} % of what the mesh blocks no capsule catches) · neither ${neither}`);
  log(`      mesh-only hits by height: ${BANDS.map((b, i) => `${b} ${meshOnlyBands[i]}`).join(' · ')}`);
  log(`      capsule-only hits by height: ${BANDS.map((b, i) => `${b} ${capsOnlyBands[i]}`).join(' · ')}`);

  if (P.name === 'crouch-aim' && !fixture) {
    // 64 rays: 40 shadow-like + 24 through the box, at THIS pose; the joints that made it ride along so the GPU can be posed identically
    seed = 777;
    const rays: number[][] = []; const expect: number[] = []; const nearest: number[] = [];
    for (let k = 0; k < 64; k++) {
      const r = k < 40 ? shadowRay(center) : boxRay(rootMin, rootMax);
      rays.push([+r.ro[0], +r.ro[1], +r.ro[2], r.tmax, r.rd[0], r.rd[1], r.rd[2], 0]);
      expect.push(B.bvhAnyHit(bvh, nmin, nmax, tv, r.ro, r.rd, r.tmax));
      nearest.push(B.bruteNearest(bvh, tv, r.ro, r.rd, r.tmax));
    }
    fixture = { note: 'mesh-shadow walk fixture: pose = crouch-aim (Character id 1 at [10,0,10] yaw 0.4 after 1 s); joints = SkeletonInstance.jointData (53 × mat4, column-major); rays = [ro.xyz, tmax, rd.xyz, 0]; expect = the any-hit walk\'s t (−1 clear) — the GPU walk visits nodes in the same order so it should find the SAME triangle: compare t to ~1e-4, and blocked/clear exactly; nearest = brute-force nearest t for reference; digest = topology checksum (MeshShadows.digest at runtime must match)',
      digest: B.topologyDigest(bvh), nodes: bvh.numNodes, tris: bvh.numTris, joints: Array.from(joints).map(x => +x.toPrecision(9)), rays, expect: expect.map(x => +x.toPrecision(7)), nearest: nearest.map(x => +x.toPrecision(7)),
      blocked: expect.filter(t => t >= 0).length };
  }
}

out.digest = B.topologyDigest(bvh);
log(`\ntopology digest ${out.digest} (MeshShadows.digest in the running page must print the same)`);
if (writeFixture && fixture) { const p = `${ROOT}/tools/qa/mesh-shadow-fixture.json`; writeFileSync(p, JSON.stringify(fixture)); log(`fixture written: ${p} (${fixture.blocked}/64 blocked)`); }
if (asJson) console.log(JSON.stringify(out, null, 1));
