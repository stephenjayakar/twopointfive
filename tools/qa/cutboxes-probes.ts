// CUT BOXES probes (scene/cut.ts, docs/internal/cut-boxes-contract.md) — `bun run tools/qa/probes.ts cutboxes` (the family; every probe also answers to its own name):
//   cutboxes-record   the builders: cutRecord normalises, drops a plane that removes nothing and the ones over MAX_CUT_PLANES (shallowest first), reports an empty solid; cutPrism
//                     gives a convex outline back as a slab + side planes whose solid is that prism; cutFit never grows the box and keeps the solid
//   cutboxes-ray      ONE MODEL: over seeded random cut boxes (yawed and fully rotated, 1‥8 planes) rayBox ≡ an independent world-space half-space clip (t and normal),
//                     lineBox's interval ≡ the same clip's, and the rule common.wgsl runs over the very rows packed for the GPU (isectCut transliterated, f32 rows) lands on the
//                     same face at the same t; BoxWorld.raycast over a world of cut statics + dynamics ≡ the brute minimum
//   cutboxes-off      the switch OFF: a box carrying a record answers rayBox / lineBox exactly as the same box without one, BoxWorld packs no bit and no rows and lists nothing
//                     for the cut pipeline, and the scene prelude declares CUT_BOXES false with the tail it had
//   cutboxes-pack     the switch ON: bit 16 of the geo flags word only on boxes with a record, its CUT_ROWS rows = the planes then the pad row, cut boxes listed after the plain
//                     ones in `visible`, a static's rows re-packed when its record is REPLACED, the counts in cutStats
//   cutboxes-lines    SIGHT, SOUND AND LINES OF FIRE through a cut static and a cut door leaf (StaticCollision: segmentBlocked = sight, solidBlocked = sound / a step,
//                     shotBlocked = a line of fire, raycast = a round, SoundPaths.propagate, segmentBlockedDynamic = the leaves alone): a line through the CUT-AWAY part
//                     passes and a line through the KEPT part is stopped, every answer set against the half-space reference — over 27 upright walls (3 more tilted), 6
//                     leaves, and the ragged wall ends real charges leave in a level; switch off, the same lines meet the whole box. THE GATE for the fast paths in
//                     collision.ts that copy the slab test over scalars (they skip the cut rule unless they hand a cut box to lineBox / rayBox: with that hand-over
//                     taken out this probe is red — 0 of 27 walls and 0 of 6 leaves let a line through the cut-away part)
import { ROOT, fake } from './headless.ts';
const CUT = await import(`${ROOT}/src/scene/cut.ts`);
const BX = await import(`${ROOT}/src/scene/boxes.ts`);
const COL = await import(`${ROOT}/src/scene/collision.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
const { scenePrelude } = await import(`${ROOT}/src/render/frame.ts`);
const { cutConfig, cutRecord, cutThrough, cutPrism, cutFit, cutContains, cutVerts, packCut, MAX_CUT_PLANES, CUT_ROWS, CUT_STRIDE } = CUT;
const { makeBox, rayBox, BoxWorld, BoxFlag, GEO_STRIDE } = BX;

type Vec3 = [number, number, number];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); return ok; } };
}
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the box's local axes in the world, by the same convention rayBox uses (yaw about +y, or the full rotation) — written out here, not taken from the code under test */
function axesOf(b: any): [Vec3, Vec3, Vec3] {
  if (b.rot) return [quat.rotate(b.rot, [1, 0, 0]), quat.rotate(b.rot, [0, 1, 0]), quat.rotate(b.rot, [0, 0, 1])];
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}
/** THE REFERENCE: the cut solid as world-space half-spaces N · x ≤ D (six for the box, one per plane) and a ray clipped against all of them */
function halfSpaces(b: any, withCut: boolean): { N: Vec3; D: number }[] {
  const A = axesOf(b); const out: { N: Vec3; D: number }[] = [];
  for (let a = 0; a < 3; a++) for (const s of [1, -1]) { const N: Vec3 = [A[a][0] * s, A[a][1] * s, A[a][2] * s]; out.push({ N, D: dot(N, b.c) + b.h[a] }); }
  if (withCut && b.cut) for (const pl of b.cut) { const N: Vec3 = [0, 1, 2].map(i => A[0][i] * pl.n[0] + A[1][i] * pl.n[1] + A[2][i] * pl.n[2]) as Vec3; out.push({ N, D: dot(N, b.c) + pl.d }); }
  return out;
}
function refClip(H: { N: Vec3; D: number }[], o: Vec3, d: Vec3, tmax: number): { t0: number; t1: number; n: Vec3 | null } | null {
  let t0 = -Infinity, t1 = Infinity; let n: Vec3 | null = null;
  for (const h of H) { const den = dot(h.N, d), num = h.D - dot(h.N, o); if (den < 0) { const t = num / den; if (t > t0) { t0 = t; n = h.N; } } else if (den > 0) { const t = num / den; if (t < t1) t1 = t; } else if (num < 0) return null; }
  if (t0 > t1 || t1 < 0 || t0 > tmax) return null;
  return { t0, t1, n };
}
function refLine(H: { N: Vec3; D: number }[], o: Vec3, d: Vec3): { t0: number; t1: number } | null {
  let t0 = -Infinity, t1 = Infinity;
  for (const h of H) { const den = dot(h.N, d), num = h.D - dot(h.N, o); if (den < 0) t0 = Math.max(t0, num / den); else if (den > 0) t1 = Math.min(t1, num / den); else if (num < 0) return null; }
  return t0 > t1 ? null : { t0, t1 };
}
/** common.wgsl isectBox + isectCut, statement for statement, over the packed f32 rows (a ROT box's path: lo / ld through the inverse rotation); returns (t, code) */
function gpuIsect(b: any, rows: Float32Array, o: Vec3, d: Vec3, tmax: number): [number, number] {
  const A = axesOf(b); const p: Vec3 = [o[0] - b.c[0], o[1] - b.c[1], o[2] - b.c[2]];
  const lo = [dot(A[0], p), dot(A[1], p), dot(A[2], p)].map(Math.fround), ld = [dot(A[0], d), dot(A[1], d), dot(A[2], d)].map(Math.fround);
  const h = b.h.map(Math.fround); const tmn = [0, 0, 0]; let tN = -Infinity, tF = Infinity;
  for (let a = 0; a < 3; a++) { const inv = 1 / (Math.abs(ld[a]) < 1e-8 ? (ld[a] < 0 ? -1e-8 : 1e-8) : ld[a]); const tA = (-h[a] - lo[a]) * inv, tB = (h[a] - lo[a]) * inv; tmn[a] = Math.min(tA, tB); tN = Math.max(tN, tmn[a]); tF = Math.min(tF, Math.max(tA, tB)); }
  if (tN > tF || tF < 0 || tN > tmax) return [-1, 0];
  let code = 7;
  for (let k = 0; k < CUT_ROWS; k++) {
    const q = k * 4; const pl = [rows[q], rows[q + 1], rows[q + 2]], w = rows[q + 3];
    if (pl[0] === 0 && pl[1] === 0 && pl[2] === 0) break;
    const den = dot(pl, ld), num = w - dot(pl, lo);
    if (den < 0) { const t = num / den; if (t > tN) { tN = t; code = -1 - k; } }
    else if (den > 0) tF = Math.min(tF, num / den);
    else if (num < 0) return [-1, 0];
  }
  if (tN > tF || tF < 0 || tN > tmax) return [-1, 0];
  if (tN < 0) return [0, 7];
  if (code < 0) return [tN, code];
  code = 4 + (ld[2] > 0 ? 1 : 0);
  if (tN === tmn[0]) code = ld[0] > 0 ? 1 : 0; else if (tN === tmn[1]) code = 2 + (ld[1] > 0 ? 1 : 0);
  return [tN, code];
}
function gpuNormal(b: any, rows: Float32Array, code: number): Vec3 {
  const A = axesOf(b); let ln: Vec3;
  if (code < 0) { const k = Math.trunc(-code - 0.5) * 4; ln = [rows[k], rows[k + 1], rows[k + 2]]; }
  else { const c = code | 0; ln = [0, 0, 0]; ln[c >> 1] = c & 1 ? -1 : 1; }
  return [0, 1, 2].map(i => A[0][i] * ln[0] + A[1][i] * ln[1] + A[2][i] * ln[2]) as Vec3;
}
/** a seeded random cut box: 1‥n planes through points inside the box, every third one fully rotated */
function randomCutBox(R: () => number, i: number, at?: Vec3): any {
  const h: Vec3 = [0.1 + R() * 0.8, 0.05 + R() * 0.6, 0.1 + R() * 0.8];
  const want = 1 + ((R() * MAX_CUT_PLANES) | 0); const pl: any[] = [];
  for (let k = 0; k < want; k++) pl.push(cutThrough([(R() * 2 - 1) * h[0] * 0.8, (R() * 2 - 1) * h[1] * 0.8, (R() * 2 - 1) * h[2] * 0.8], [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]));
  // keep the box's centre-ish point inside: flip a plane that cuts it away, so the solid is never empty
  const keep: Vec3 = [(R() * 2 - 1) * h[0] * 0.3, (R() * 2 - 1) * h[1] * 0.3, (R() * 2 - 1) * h[2] * 0.3];
  for (const p of pl) if (dot(p.n, keep) > p.d) { p.n = [-p.n[0], -p.n[1], -p.n[2]]; p.d = -p.d; }
  const rec = cutRecord(h, pl);
  const rot = i % 3 === 2 ? quat.axisAngle(norm([R() - 0.5, R() - 0.5, R() - 0.5]), R() * 6.28) : undefined;
  return makeBox({ c: at ?? [(R() - 0.5) * 2, 1 + R(), (R() - 0.5) * 2], h, yaw: rot ? 0 : R() * 6.28, rot, cut: rec.cut });
}

export async function cutboxesRecord(): Promise<boolean> {
  const F = family('cutboxes-record: the record builders');
  const h: Vec3 = [0.5, 0.4, 0.3];
  { const r = cutRecord(h, [{ n: [2, 0, 0], d: 0.2 }, { n: [0, 1, 0], d: 5 }, { n: [1, 0, 0], d: 0.5 }]);
    F.verdict(!!r.cut && r.cut.length === 1 && Math.abs(r.cut[0].n[0] - 1) < 1e-12 && Math.abs(r.cut[0].d - 0.1) < 1e-12 && !r.empty && r.dropped === 0, 'a plane is normalised; planes that remove nothing (beyond the box, or lying on a face) are dropped', `kept ${r.cut?.length} · n ${r.cut?.[0].n} d ${r.cut?.[0].d}`); }
  { const r = cutRecord(h, [{ n: [1, 0, 0], d: -0.6 }]); F.verdict(r.empty && r.cut === undefined, 'a plane that removes everything reports empty', `empty ${r.empty}`); }
  { const pl = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pl.push(cutThrough([Math.cos(a) * 0.25 * (1 + (i % 3) * 0.05), 0, Math.sin(a) * 0.25 * (1 + (i % 3) * 0.05)], [Math.cos(a), 0, Math.sin(a)])); }
    const r = cutRecord([0.5, 0.4, 0.5], pl);
    F.verdict(!!r.cut && r.cut.length === MAX_CUT_PLANES && r.dropped === 4, `over the limit: the ${MAX_CUT_PLANES} deepest planes are kept and the rest counted`, `kept ${r.cut?.length} dropped ${r.dropped}`); }
  { // the same edge given twice (a hexagon with a point in the middle of every edge = 12 planes for 6 edges): copies are merged, nothing is counted as dropped
    const hex: [number, number][] = []; for (let i = 0; i < 6; i++) { const a = (i + 0.2) / 6 * Math.PI * 2, c = (i + 1.2) / 6 * Math.PI * 2; const p: [number, number] = [Math.cos(a) * 0.3, Math.sin(a) * 0.3], q: [number, number] = [Math.cos(c) * 0.3, Math.sin(c) * 0.3]; hex.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
    const pr = cutPrism(2, 0.006, hex); const par = cutRecord([0.5, 0.4, 0.3], [{ n: [1, 0, 0], d: 0.2 }, { n: [1, 0, 0], d: 0.1 }, { n: [2, 0, 0], d: 0.6 }]);
    F.verdict(!!pr.cut && pr.cut.length === 6 && pr.dropped === 0 && !!par.cut && par.cut.length === 1 && Math.abs(par.cut[0].d - 0.1) < 1e-12, 'a plane given twice, or parallel planes, are merged into the tighter one (an outline with a point mid-edge loses no edge to the limit)', `hexagon with 12 points: ${pr.cut?.length} planes, dropped ${pr.dropped} · parallel: ${par.cut?.length} at d ${par.cut?.[0].d}`); }
  { const tri: [number, number][] = [[-0.3, 0], [0.26, 0], [0.05, 0.75]]; const pr = cutPrism(2, 0.012, tri);
    // (u, v) of axis 2 = (x, y): sample the fit box and compare point-in-solid with point-in-triangle
    const R = seeded(7); let bad = 0, inside = 0; const N = 4000;
    const inTri = (x: number, y: number) => { let s = 0; for (let i = 0; i < 3; i++) { const a = tri[i], b = tri[(i + 1) % 3]; const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 1e-6) return null; s += cr > 0 ? 1 : -1; } return Math.abs(s) === 3; };
    for (let i = 0; i < N; i++) { const p: Vec3 = [(R() * 2 - 1) * pr.h[0], (R() * 2 - 1) * pr.h[1], (R() * 2 - 1) * pr.h[2]]; const w = inTri(p[0] + pr.off[0], p[1] + pr.off[1]); if (w === null) continue; const c = cutContains(pr.h, pr.cut, p); if (c !== w) bad++; if (c) inside++; }
    F.verdict(bad === 0 && !pr.empty && pr.dropped === 0 && inside > N * 0.3 && Math.abs(pr.h[2] - 0.012) < 1e-12, 'cutPrism: a triangle comes back as a slab whose solid is that triangle\'s prism', `${bad} of ${N} points disagree · ${inside} inside · h (${pr.h.map((x: number) => x.toFixed(3))}) off (${pr.off.map((x: number) => x.toFixed(3))}) · ${pr.cut?.length} planes`); }
  { const R = seeded(11); let grew = 0, lost = 0, n = 0;
    for (let i = 0; i < 200; i++) { const b = randomCutBox(R, 0, [0, 0, 0]); if (!b.cut) continue; n++; const f = cutFit(b.h, b.cut);
      if (f.h[0] > b.h[0] + 1e-9 || f.h[1] > b.h[1] + 1e-9 || f.h[2] > b.h[2] + 1e-9) grew++;
      for (const v of cutVerts(b.h, b.cut)) { const q: Vec3 = [v[0] - f.off[0], v[1] - f.off[1], v[2] - f.off[2]]; if (!cutContains([f.h[0] + 1e-7, f.h[1] + 1e-7, f.h[2] + 1e-7], f.cut, q, 1e-7)) { lost++; break; } } }
    F.verdict(grew === 0 && lost === 0 && n > 150, 'cutFit: the tight box never grows and still holds every vertex of the solid', `${n} solids · ${grew} grew · ${lost} lost a vertex`); }
  return F.done();
}

export async function cutboxesRay(): Promise<boolean> {
  const F = family('cutboxes-ray: one model — rayBox ≡ the half-space reference ≡ the GPU rule over the packed rows');
  const was = cutConfig.on; cutConfig.on = true;
  try {
    const R = seeded(20261008); const rows = new Float32Array(CUT_STRIDE * 4);
    let insideRays = 0, insideSolid = 0, gpuInside = 0, awayHits = 0;
    let rays = 0, hits = 0, cutHits = 0, badT = 0, badN = 0, badMiss = 0, worstT = 0, gpuBad = 0, gpuWorst = 0, gpuFace = 0, gpuSkip = 0, lineBad = 0, lines = 0, planes = 0, rotBoxes = 0;
    for (let i = 0; i < 300; i++) {
      const b = randomCutBox(R, i); if (!b.cut) continue; planes += b.cut.length; if (b.rot) rotBoxes++;
      packCut(b.cut, rows, 0); const H = halfSpaces(b, true); const rad = Math.hypot(b.h[0], b.h[1], b.h[2]);
      for (let k = 0; k < 120; k++) {
        let o: Vec3 = norm([R() - 0.5, R() - 0.5, R() - 0.5]).map((x, a) => b.c[a] + x * rad * (1.2 + R() * 2)) as Vec3;
        let inBox = false, inSolid = false;
        if (k % 4 === 3) {   // every fourth ray STARTS inside the uncut box: in the solid (no hit on the CPU, 'inside' on the GPU) or in the part cut away (outside: it can hit)
          const A = axesOf(b); const lp: Vec3 = [(R() * 2 - 1) * b.h[0] * 0.98, (R() * 2 - 1) * b.h[1] * 0.98, (R() * 2 - 1) * b.h[2] * 0.98];
          o = [0, 1, 2].map(i => b.c[i] + A[0][i] * lp[0] + A[1][i] * lp[1] + A[2][i] * lp[2]) as Vec3; inBox = true; inSolid = cutContains(b.h, b.cut, lp); insideRays++;
        }
        const tgt: Vec3 = [b.c[0] + (R() * 2 - 1) * b.h[0] * 1.1, b.c[1] + (R() * 2 - 1) * b.h[1] * 1.1, b.c[2] + (R() * 2 - 1) * b.h[2] * 1.1];
        const d = norm([tgt[0] - o[0], tgt[1] - o[1], tgt[2] - o[2]]); rays++;
        const ref = refClip(H, o, d, 1e9); const got = rayBox(o, d, b, 1e9);
        const refHit = ref && ref.t0 >= 0 ? ref : null;
        if (!!got !== !!refHit) { if (!(ref && ref.t1 - ref.t0 < 1e-9)) badMiss++; continue; }   // (a graze of zero length may fall either way)
        if (inBox && inSolid && ref && ref.t1 > 1e-4 && ref.t0 < -1e-4) { insideSolid++; const g = gpuIsect(b, rows, o, d, 1e9); if (got || !(g[0] === 0 && g[1] === 7)) gpuInside++; }
        if (inBox && !inSolid && got) awayHits++;
        if (got && refHit) { hits++; const e = Math.abs(got.t - refHit.t0); worstT = Math.max(worstT, e); if (e > 1e-9) badT++; if (dot(got.n, refHit.n!) < 1 - 1e-9) badN++;
          if (H.indexOf(H.find(x => x.N === refHit.n)!) >= 6) cutHits++;
          const g = gpuIsect(b, rows, o, d, 1e9);
          if (g[0] < 0 || g[1] > 6.5) { if (refHit.t1 - refHit.t0 > 1e-3) gpuBad++; else gpuSkip++; }
          else { const ge = Math.abs(g[0] - refHit.t0); gpuWorst = Math.max(gpuWorst, ge); if (ge > 2e-4) gpuBad++; if (dot(gpuNormal(b, rows, g[1]), refHit.n!) < 1 - 1e-4) gpuFace++; } }
        // the segment o → o + d·L against lineBox's interval
        const L = rad * 4; const ls = COL.lineBox(o, [d[0] * L, d[1] * L, d[2] * L], b); lines++;
        const lr = refLine(H, o, d);   // (lineBox answers for the whole LINE, in units of the segment: its callers clamp)
        if (!!ls !== !!lr) { if (lr && lr.t1 - lr.t0 > 1e-7) lineBad++; }
        else if (ls && lr) { if (Math.abs(ls.t0 * L - lr.t0) > 1e-7 || Math.abs(ls.t1 * L - lr.t1) > 1e-7) lineBad++; }
      }
    }
    F.verdict(badT === 0 && badN === 0 && badMiss === 0 && hits > 5000 && cutHits > 1000, 'rayBox on a cut box = the world-space half-space clip: same hit or miss, same t, same normal', `${rays} rays · ${hits} hits (${cutHits} on a cut face) · ${badMiss} hit/miss · ${badT} t · ${badN} normal · worst Δt ${worstT.toExponential(1)} · ${planes} planes over 300 boxes (${rotBoxes} fully rotated)`);
    F.verdict(gpuBad === 0 && gpuFace === 0, 'the GPU rule (isectBox + isectCut over the packed f32 rows) lands on the same face at the same t', `${gpuBad} off by > 0.2 mm or missed · ${gpuFace} another face · worst Δt ${gpuWorst.toExponential(1)} m · ${gpuSkip} grazes under 1 mm skipped`);
    F.verdict(gpuInside === 0 && insideSolid > 1000 && awayHits > 300, 'a ray starting INSIDE the uncut box: in the solid = no hit on the CPU and \'inside\' on the GPU; in the part cut away = outside, and it can hit (counted in the rows above)', `${insideRays} such rays · ${insideSolid} from inside the solid, ${gpuInside} wrong · ${awayHits} hits from the cut-away part`);
    F.verdict(lineBad === 0, 'lineBox (sight lines, rounds, sound, reach) = the same clip\'s interval', `${lines} segments · ${lineBad} disagree`);
    // a world of cut statics + dynamics: BoxWorld.raycast ≡ the brute minimum of rayBox
    const world = new BoxWorld(fake('device')); const R2 = seeded(99); const all: any[] = [];
    for (let i = 0; i < 40; i++) { const b = randomCutBox(R2, i, [4 + R2() * 30, 0.5 + R2() * 1.5, 4 + R2() * 18]); world.statics.push(b); all.push(b); }
    for (let i = 0; i < 12; i++) { const b = randomCutBox(R2, i + 1, [4 + R2() * 30, 0.5 + R2() * 1.5, 4 + R2() * 18]); b.flags |= BoxFlag.Dynamic; world.dynamics.push(b); all.push(b); }
    world.upload();
    let wBad = 0, wHits = 0;
    for (let k = 0; k < 3000; k++) { const o: Vec3 = [2 + R2() * 34, 0.2 + R2() * 2.5, 2 + R2() * 22]; const d = norm([R2() - 0.5, (R2() - 0.5) * 0.4, R2() - 0.5]);
      let best = 1e9, bi = -1; for (let i = 0; i < all.length; i++) { const r = rayBox(o, d, all[i], best); if (r && r.t < best) { best = r.t; bi = i; } }
      const got = world.raycast(o, d, 1e9, 0); if (bi >= 0) wHits++;
      if ((got ? got.index : -1) !== bi || (got && Math.abs(got.t - best) > 1e-12)) wBad++; }
    F.verdict(wBad === 0 && wHits > 150, 'BoxWorld.raycast over cut statics + dynamics = the brute minimum of rayBox', `3000 rays · ${wHits} hits · ${wBad} disagree`);
  } finally { cutConfig.on = was; }
  return F.done();
}

export async function cutboxesOff(): Promise<boolean> {
  const F = family('cutboxes-off: the switch off = the record is not there');
  const was = cutConfig.on; cutConfig.on = false;
  try {
    const R = seeded(5); let bad = 0, n = 0, lbad = 0;
    for (let i = 0; i < 120; i++) { const b = randomCutBox(R, i); if (!b.cut) continue; const plain = { ...b, cut: undefined };
      for (let k = 0; k < 60; k++) { const o: Vec3 = [b.c[0] + (R() - 0.5) * 5, b.c[1] + (R() - 0.5) * 5, b.c[2] + (R() - 0.5) * 5]; const d = norm([b.c[0] - o[0] + (R() - 0.5) * 0.6, b.c[1] - o[1] + (R() - 0.5) * 0.6, b.c[2] - o[2] + (R() - 0.5) * 0.6]); n++;
        if (JSON.stringify(rayBox(o, d, b, 1e9)) !== JSON.stringify(rayBox(o, d, plain, 1e9))) bad++;
        if (JSON.stringify(COL.lineBox(o, [d[0] * 6, d[1] * 6, d[2] * 6], b)) !== JSON.stringify(COL.lineBox(o, [d[0] * 6, d[1] * 6, d[2] * 6], plain))) lbad++; } }
    F.verdict(bad === 0 && lbad === 0 && n > 5000, 'rayBox and lineBox answer a box with a record exactly as the same box without one', `${n} rays · ${bad} rayBox · ${lbad} lineBox differ`);
    const mk = (cut: boolean) => { const w = new BoxWorld(fake('device')); const R3 = seeded(31); for (let i = 0; i < 20; i++) { const b = randomCutBox(R3, i, [4 + R3() * 30, 1, 4 + R3() * 18]); if (!cut) b.cut = undefined; if (i >= 14) { b.flags |= BoxFlag.Dynamic; w.dynamics.push(b); } else w.statics.push(b); } w.upload(); return w; };
    const a = mk(true), p = mk(false);
    const same = (x: ArrayBufferLike, y: ArrayBufferLike) => { const u = new Uint8Array(x), v = new Uint8Array(y); if (u.length !== v.length) return false; for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false; return true; };
    let visSame = a.visibleCount === p.visibleCount; for (let i = 0; i < a.visibleCount && visSame; i++) visSame = a.visible[i] === p.visible[i];
    F.verdict(same(a.geoData, p.geoData) && same((a as any).matData.buffer, (p as any).matData.buffer) && visSame && a.visibleCutCount === 0 && (a as any).cutData.length === 0, 'BoxWorld packs the same bytes with and without records: no bit, no rows, nothing listed for the cut pipeline', `geo ${same(a.geoData, p.geoData)} · mat ${same((a as any).matData.buffer, (p as any).matData.buffer)} · visible ${visSame} (${a.visibleCount}) · cut listed ${a.visibleCutCount}`);
    const pre = scenePrelude();
    F.verdict(/const CUT_BOXES: bool = false;/.test(pre) && !/const CUT_BOXES: bool = true;/.test(pre), 'the scene prelude declares CUT_BOXES false (the cut code is dead in every module)', pre.match(/const CUT_BOXES[^\n]*/)?.[0].slice(0, 120) ?? 'no const');
  } finally { cutConfig.on = was; }
  return F.done();
}

export async function cutboxesPack(): Promise<boolean> {
  const F = family('cutboxes-pack: the bit, the rows, the draw list');
  const was = cutConfig.on; cutConfig.on = true;
  try {
    const writes: { label: string; off: number; src: number; size: number }[] = [];
    const dev = new Proxy(fake('device'), { get(t: any, k) { if (k === 'queue') return { writeBuffer: (buf: any, off: number, _d: any, src = 0, size = 0) => { writes.push({ label: buf?.label, off, src, size }); } }; if (k === 'createBuffer') return (d: any) => ({ label: d.label, size: d.size }); return t[k]; } });
    const w = new BoxWorld(dev); const R = seeded(77); const want: boolean[] = [];
    for (let i = 0; i < 24; i++) { const b = randomCutBox(R, i, [4 + R() * 30, 1, 4 + R() * 18]); if (i % 3 === 0) b.cut = undefined; else if (i % 2 === 0) b.cutCore = [0.9 - i * 0.01, 0.88, 0.8]; if (i >= 16) { b.flags |= BoxFlag.Dynamic; w.dynamics.push(b); } else w.statics.push(b); }
    w.upload();
    const all = [...w.statics, ...w.dynamics]; const cd: Float32Array = (w as any).cutData; let bitBad = 0, rowBad = 0, nCut = 0, nPl = 0, coreBad = 0, nCore = 0;
    for (let i = 0; i < all.length; i++) { const b = all[i]; const has = !!b.cut && b.cut.length > 0; want.push(has); const bit = (w.geoU32[i * GEO_STRIDE + 7] & 65536) !== 0;
      if (bit !== has) bitBad++;   // (GEO_STRIDE: cx cy cz rot | hx hy hz flags — the flags word is the record's last)
      if (has) { nCut++; nPl += b.cut.length; for (let k = 0; k < CUT_ROWS; k++) { const q = (i * CUT_STRIDE + k) * 4; const c = b.cut[k];
        const ok = c ? cd[q] === Math.fround(c.n[0]) && cd[q + 1] === Math.fround(c.n[1]) && cd[q + 2] === Math.fround(c.n[2]) && cd[q + 3] === Math.fround(c.d) : cd[q] === 0 && cd[q + 1] === 0 && cd[q + 2] === 0 && cd[q + 3] === 1; if (!ok) rowBad++; }
        const q = (i * CUT_STRIDE + CUT_ROWS) * 4, k3 = b.cutCore; if (!(k3 ? cd[q] === Math.fround(k3[0]) && cd[q + 1] === Math.fround(k3[1]) && cd[q + 2] === Math.fround(k3[2]) && cd[q + 3] === 1 : cd[q] === 0 && cd[q + 1] === 0 && cd[q + 2] === 0 && cd[q + 3] === 0)) coreBad++; if (k3) nCore++; } }
    F.verdict(bitBad === 0 && rowBad === 0 && nCut === 16 && coreBad === 0 && nCore > 0 && nCore < nCut, 'bit 16 of the flags word on exactly the boxes with a record; their rows = the planes, then (0, 0, 0, 1); the core row = (colour, 1) or zeros', `${nCut} cut of ${all.length} · ${nCore} with a core colour · ${bitBad} bits wrong · ${rowBad} rows wrong · ${coreBad} core rows wrong`);
    { // A CALM ROOM PAYS NOTHING (render/cutSwap.ts): what the boot compiles under the switch is the text of the build without it; the cut set asks for the rule by name
      const swapWas = cutConfig.swap; cutConfig.on = false; const offText = scenePrelude(); cutConfig.on = true;
      cutConfig.swap = true; const boot = scenePrelude(); cutConfig.swap = false; const whole = scenePrelude(); cutConfig.swap = swapWas;
      F.verdict(boot === offText && whole === scenePrelude(true) && whole !== offText && /const CUT_BOXES: bool = true;/.test(whole), 'under the swap the boot prelude is the switch-off text, character for character; scenePrelude(true) (and ?cutprograms=boot) carries the rule', `boot = off ${boot === offText} · ${whole.length - offText.length} chars apart with the rule`);
      const traced = all.filter(b => b.cut && b.cut.length > 0 && !(b.flags & BoxFlag.NoShadow)).length;
      const w2 = new BoxWorld(fake('device')); const R4 = seeded(78); let want2 = 0;
      for (let i = 0; i < 12; i++) { const b = randomCutBox(R4, i, [4 + R4() * 30, 1, 4 + R4() * 18]); b.flags |= BoxFlag.Dynamic; if (i % 2 === 0) b.flags |= BoxFlag.NoShadow; else if (b.cut && b.cut.length > 0) want2++; w2.dynamics.push(b); }
      w2.upload(); const mid = w2.cutTraced;
      { // the cut list is the traceable boxes, THEN the picture-only ones: the g-buffer draws the first visibleCutTraced whole on a frame whose ray programs have no cut rule
        let lead = true, tail = true; const n0 = w2.visibleCount, nT = w2.visibleCutTraced, nC = w2.visibleCutCount;
        for (let k = 0; k < nC; k++) { const b = w2.all[w2.visible[n0 + k] & 0xFFFF]; const plate = !!(b.flags & BoxFlag.NoShadow); if (k < nT ? plate : !plate) { if (k < nT) lead = false; else tail = false; } }
        F.verdict(lead && tail && nT === want2 && nC > nT, 'the cut list leads with the boxes a ray can meet (visibleCutTraced of them) and ends with the picture-only plates', `${nT} traceable, then ${nC - nT} plates · order ${lead && tail}`);
      }
      w2.dynamics.length = 0; w2.upload();
      F.verdict(w.cutTraced === traced && traced > 0 && mid === want2 && want2 > 0 && w2.cutTraced === 0, 'cutTraced counts the cut boxes a ray can meet (a NoShadow plate is picture only) and is 0 again once they are gone', `${w.cutTraced} of ${nCut} · plates apart ${mid} = ${want2} · after they go ${w2.cutTraced}`);
    }
    { // THE SWAP'S RULE (render/cutSwap.ts frame / drawsCut / hot), driven with a stand-in owner: when the cut set is on the frame, and that the raster follows it
      const { cutSwap } = await import(`${ROOT}/src/render/cutSwap.ts`);
      const swapWas = cutConfig.swap, keep = { state: cutSwap.state, live: cutSwap.live, force: cutSwap.force, idle: cutSwap.idle, swaps: cutSwap.swaps, hot: cutSwap.hotPinned, members: new Set(cutSwap.members) };
      const warn = console.warn; console.warn = () => { /* hot() says so once */ };
      try {
        cutConfig.swap = true; cutSwap.members.clear(); let used = false, calls = 0; const m = { buildCut: async () => { /* nothing to compile */ }, useCut: (on: boolean) => { used = on; calls++; } }; cutSwap.members.add(m);
        cutSwap.live = false; cutSwap.force = null; cutSwap.idle = 0; cutSwap.swaps = 0; cutSwap.hotPinned = false;
        cutSwap.state = 'building'; cutSwap.frame(5); const early = !cutSwap.live && !cutSwap.drawsCut && calls === 0;      // a piece born before the second set exists: boot programs, drawn whole
        cutSwap.state = 'failed'; cutSwap.frame(5); const failed = !cutSwap.live && !cutSwap.drawsCut;
        cutSwap.state = 'ready'; cutSwap.frame(0); const calm = !cutSwap.live && !used;
        cutSwap.frame(5); const taken = cutSwap.live && used && cutSwap.drawsCut && cutSwap.swaps === 1;
        let held = 0; while (cutSwap.live && held < 100000) { cutSwap.frame(0); held++; }                                       // …the last piece gone: held, then the boot's again
        const back = !cutSwap.live && !used && cutSwap.swaps === 2 && held >= 120;
        cutSwap.frame(1); let flap = true; for (let r = 0; r < 40; r++) { for (let k = 0; k < held - 1; k++) cutSwap.frame(0); flap &&= cutSwap.live; cutSwap.frame(1); }   // pieces coming and going inside the hold never swap
        const steady = flap && cutSwap.swaps === 3;
        while (cutSwap.live) cutSwap.frame(0);
        cutSwap.force = 'cut'; cutSwap.frame(0); const pinned = cutSwap.live; cutSwap.force = null; cutSwap.frame(0); const released = pinned && !cutSwap.live;   // a pin let go leaves no hold behind (the cost lab's 'ship' row)
        cutSwap.frame(5); cutSwap.hot(); const hot = !cutSwap.live && !used && !cutSwap.drawsCut && cutSwap.force === 'base'; cutSwap.frame(5); const hotStays = !cutSwap.live && !cutSwap.drawsCut;
        cutConfig.swap = false; const oneSet = cutSwap.drawsCut;                                                                // ?cutprograms=boot: every program carries the rule, the raster always cuts
        F.verdict(early && failed, 'a cut piece alive before the second set is in (or with a set that failed) keeps the boot programs AND is drawn whole: picture and rays agree', `building ${early} · failed ${failed}`);
        F.verdict(calm && taken && back && steady, 'the cut set is taken the frame a traceable piece exists, held after the last one goes, and pieces coming and going inside the hold never flap it', `calm ${calm} · taken ${taken} · back after ${held} frames ${back} · 40 comings and goings: swaps ${steady ? 'none' : 'SOME'}`);
        F.verdict(released && hot && hotStays && oneSet, 'a pin let go returns to the rule at once; a hot-swapped program pins the boot set (whole for both); the one-set build always draws cut', `release ${released} · hot ${hot} · stays ${hotStays} · one set ${oneSet}`);
      } finally { console.warn = warn; cutConfig.swap = swapWas; cutSwap.members.clear(); for (const x of keep.members) cutSwap.members.add(x); cutSwap.state = keep.state; cutSwap.live = keep.live; cutSwap.force = keep.force; cutSwap.idle = keep.idle; cutSwap.swaps = keep.swaps; cutSwap.hotPinned = keep.hot; }
    }
    { // the rows land where the shaders read them: boxMat byte (CUT_BASE + bi × CUT_STRIDE) × 16, CUT_BASE as the prelude declares it
      const m = scenePrelude(true).match(/const CUT_BASE: u32 = MAX_BOXES \* 4u \+ (\d+)u;/); const baseRows = m ? w.maxBoxes * 4 + Number(m[1]) : -1;
      const cutIdx = all.map((b, i) => b.cut && b.cut.length ? i : -1).filter(i => i >= 0); const nS = w.statics.length;
      const sIdx = cutIdx.filter(i => i < nS), dIdx = cutIdx.filter(i => i >= nS);
      const wr = writes.filter(x => x.label === 'boxMat' && x.off >= baseRows * 16);
      const exp = [sIdx, dIdx].filter(a => a.length).map(a => ({ off: (baseRows + a[0] * CUT_STRIDE) * 16, src: a[0] * CUT_STRIDE * 16, size: (a[a.length - 1] - a[0] + 1) * CUT_STRIDE * 16 }));
      const ok = baseRows > 0 && wr.length === exp.length && exp.every((e, i) => wr[i].off === e.off && wr[i].src === e.src && wr[i].size === e.size);
      const matSize = (w as any).matBuf.size;
      F.verdict(ok && matSize === (baseRows + w.maxBoxes * CUT_STRIDE) * 16, 'the rows are uploaded where the shaders read them (CUT_BASE of the prelude), the statics\' range and the dynamics\' range apart; boxMat is sized for the table', `CUT_BASE row ${baseRows} · ${wr.map(x => `@${x.off}+${x.size}`).join(' ')} vs ${exp.map(x => `@${x.off}+${x.size}`).join(' ')} · boxMat ${matSize} B`); }
    const listed = new Set<number>(); let order = true; for (let i = 0; i < w.visibleCount; i++) { const bi = w.visible[i] & 0xFFFF; if (want[bi]) order = false; listed.add(bi); }
    for (let i = w.visibleCount; i < w.visibleCount + w.visibleCutCount; i++) { const bi = w.visible[i] & 0xFFFF; if (!want[bi]) order = false; listed.add(bi); }
    F.verdict(order && w.visibleCutCount === nCut && listed.size === all.length && w.cutStats.boxes === nCut && w.cutStats.planes === nPl, 'cut boxes are listed after the plain ones in `visible`, each box once; cutStats counts them', `plain ${w.visibleCount} · cut ${w.visibleCutCount} · stats ${JSON.stringify(w.cutStats)}`);
    // a static's record REPLACED → its rows follow; removed → the bit goes and it returns to the plain list
    const s0 = w.statics.findIndex((b: any) => !!b.cut); const nb = [{ n: [0, 1, 0] as Vec3, d: 0.01 }]; w.statics[s0].cut = nb; const s1 = w.statics.findIndex((b: any, i: number) => i > s0 && !!b.cut); w.statics[s1].cut = undefined; w.upload();
    const q = s0 * CUT_STRIDE * 4; const moved = cd[q] === 0 && cd[q + 1] === 1 && cd[q + 3] === Math.fround(0.01) && cd[q + 4] === 0 && cd[q + 7] === 1;
    const gone = (w.geoU32[s1 * GEO_STRIDE + 7] & 65536) === 0; let back = false; for (let i = 0; i < w.visibleCount; i++) if ((w.visible[i] & 0xFFFF) === s1) back = true;
    F.verdict(moved && gone && back && w.visibleCutCount === nCut - 1, 'a static whose record is replaced is re-packed; one whose record is removed loses the bit and rejoins the plain list', `rows follow ${moved} · bit gone ${gone} · relisted ${back} · cut listed ${w.visibleCutCount}`);
  } finally { cutConfig.on = was; }
  return F.done();
}

/** the reference's answer to StaticCollision's rule for a segment from OUTSIDE the box (unit d, length len): in the way when the line is inside the solid past the first
 *  `shrink` and enters it before the last. `graze` = too close to call (an interval under a tenth of a millimetre, or an end within that of the rule's edges) */
function refBlocks(H: { N: Vec3; D: number }[], o: Vec3, d: Vec3, len: number, shrink = 0.02): { hit: boolean; t0: number; graze: boolean } {
  const r = refLine(H, o, d); if (!r) return { hit: false, t0: Infinity, graze: false };
  const e = 1e-4; const graze = r.t1 - r.t0 < e || Math.abs(r.t1 - shrink) < e || Math.abs(r.t0 - (len - shrink)) < e || Math.abs(r.t0) < e;
  return { hit: r.t1 > shrink && r.t0 < len - shrink, t0: r.t0, graze };
}
/** one box's lines: seeded segments across it (mostly along its thin axis, jittered), each classed by the reference — `away` = the whole box is in the way and the cut
 *  solid is not (the line goes through the part cut away), `kept` = the cut solid is in the way */
function linesAcross(R: () => number, b: any, n: number, yLo: number, yHi: number, reach: number): { a: Vec3; b: Vec3; d: Vec3; len: number; away: boolean; kept: boolean; t0: number }[] {
  const A = axesOf(b), Hc = halfSpaces(b, true), Hw = halfSpaces(b, false); const thin = b.h[2] <= b.h[0] ? 2 : 0; const out: any[] = [];
  for (let k = 0; k < n * 6 && out.length < n; k++) {
    const lp: Vec3 = [(R() * 2 - 1) * b.h[0] * 0.96, (R() * 2 - 1) * b.h[1] * 0.96, (R() * 2 - 1) * b.h[2] * 0.96];
    const P: Vec3 = [0, 1, 2].map(i => b.c[i] + A[0][i] * lp[0] + A[1][i] * lp[1] + A[2][i] * lp[2]) as Vec3; if (P[1] < yLo || P[1] > yHi) continue;
    const j = (k % 3 === 0) ? 0 : 0.45; const t = A[thin], u = A[thin === 2 ? 0 : 2];
    const d = norm([t[0] + u[0] * (R() * 2 - 1) * j, (R() * 2 - 1) * j * 0.3, t[2] + u[2] * (R() * 2 - 1) * j]); const sg = R() < 0.5 ? 1 : -1;
    const a: Vec3 = [P[0] - d[0] * reach * sg, P[1] - d[1] * reach * sg, P[2] - d[2] * reach * sg], e: Vec3 = [P[0] + d[0] * reach * sg, P[1] + d[1] * reach * sg, P[2] + d[2] * reach * sg];
    const dd: Vec3 = [d[0] * sg, d[1] * sg, d[2] * sg]; const len = reach * 2;
    const c = refBlocks(Hc, a, dd, len), w = refBlocks(Hw, a, dd, len); if (c.graze || w.graze) continue;
    out.push({ a, b: e, d: dd, len, away: w.hit && !c.hit, kept: c.hit, t0: c.t0 });
  }
  return out;
}
/** a cut record for test wall / leaf i: an end cut square or slanted, the top cut off on a slope, a corner notched by two planes, a ragged end of four */
function wallCut(R: () => number, i: number, h: Vec3): any[] {
  const s = (R() * 2 - 1); const pl: any[] = [];
  switch (i % 5) {
    case 0: pl.push(cutThrough([h[0] * 0.1 * s, 0, 0], [1, 0, 0])); break;                                    // the end sawn off square
    case 1: pl.push(cutThrough([0, 0, 0], [1, 0.6 * s, 0])); break;                                           // … on a slant
    case 2: pl.push(cutThrough([0, h[1] * 0.15 * s, 0], [0.25 * s, 1, 0])); break;                            // the top off on a slope
    case 3: pl.push(cutThrough([h[0] * 0.3, 0, 0], [1, 0.5, 0]), cutThrough([-h[0] * 0.2, h[1] * 0.4, 0], [-0.4, 1, 0.3 * s])); break;   // two planes, one leaning through the thickness
    default: pl.push(cutThrough([h[0] * 0.55, 0, 0], [1, 0.2, 0.1]), cutThrough([h[0] * 0.5, h[1] * 0.5, 0], [1, 0.9, 0]), cutThrough([h[0] * 0.45, -h[1] * 0.5, 0], [1, -0.8, -0.1]), cutThrough([-h[0] * 0.7, 0, 0], [-1, 0.3 * s, 0]));   // ragged ends
  }
  return cutRecord(h, pl).cut!;
}

export async function cutboxesLines(): Promise<boolean> {
  const F = family('cutboxes-lines: sight, sound and lines of fire through a cut static and a cut door leaf');
  const was = cutConfig.on; cutConfig.on = true;
  try {
    // ---------------------------------------------------------------- 27 upright walls + 3 tilted, 6 leaves, an empty floor between them
    const R = seeded(20261009); const boxes: any[] = []; const NW = 27;
    boxes.push(makeBox({ c: [20, -0.25, 14], h: [20, 0.25, 14], yaw: 0 }));   // the floor (index 0)
    for (let i = 0; i < NW; i++) { const h: Vec3 = [1, 1.5, 0.05 + 0.03 * (i % 3)]; const row = (i / 9) | 0, col = i % 9;
      const yaw = row === 0 ? (col % 2 ? Math.PI / 2 : 0) : row === 1 ? (R() * 2 - 1) * Math.PI : [Math.PI, -Math.PI / 2, 0.3, -1.1, 2.5][col % 5];
      boxes.push(makeBox({ c: [3.5 + 4 * col, 1.6, 4.5 + 7 * row], h, yaw, cut: wallCut(R, i, h) })); }
    for (let i = 0; i < 3; i++) { const h: Vec3 = [1, 1.5, 0.07]; boxes.push(makeBox({ c: [9.5 + 8 * i, 1.6, 25], h, yaw: 0, rot: quat.mul(quat.axisAngle([0, 1, 0], 0.4 * (i - 1)), quat.axisAngle([1, 0, 0], 0.09 * (i + 1))), cut: wallCut(R, i + 1, h) })); }
    const lateFrom = boxes.length - 6;   // (the last three upright walls and the tilted ones join at RUNTIME, as a blown wall's standing pieces do — addStatic)
    const late = boxes.splice(lateFrom - 3, 3); const tilted = boxes.splice(boxes.length - 3, 3);
    const col = new COL.StaticCollision(boxes); for (const b of late) col.addStatic(b); const tiltFrom = col.boxes.length; for (const b of tilted) col.addStatic(b);
    const leaves: any[] = []; for (let i = 0; i < 6; i++) { const h: Vec3 = [0.45, 1.05, 0.02]; leaves.push(makeBox({ c: [5 + 6 * i, 1.05, 8], h, yaw: [0, 0.6, Math.PI / 2, -1.2, 2.2, Math.PI][i], flags: BoxFlag.Dynamic | BoxFlag.SoundSeal, cut: wallCut(R, i, h) })); }
    col.dynamicBoxes = leaves;
    const plain = (r: any) => r.direct && r.carry === 1;   // the sound's straight run is clear (SoundPaths: anything else is over the top, routed or sealed)
    type Tally = { things: number; passOk: number; stopOk: number; away: number; kept: number; bad: string[] };
    const sweep = (list: any[], index: (i: number) => number, leaf: boolean): Tally => {
      const T: Tally = { things: list.length, passOk: 0, stopOk: 0, away: 0, kept: 0, bad: [] };
      list.forEach((b, i) => { const L = linesAcross(R, b, 60, 1.0, leaf ? 1.95 : 2.9, 1.2); let aw = 0, awOk = 0, kp = 0, kpOk = 0;
        for (const l of L) { if (!l.away && !l.kept) continue;
          const sight = col.segmentBlocked(l.a, l.b), solid = col.solidBlocked(l.a, l.b), shot = col.shotBlocked(l.a, l.b), dyn = col.segmentBlockedDynamic(l.a, l.b, BoxFlag.SoundSeal);
          const ray = col.raycast(l.a, l.d, l.len); col.sound.invalidate(); const snd = col.sound.propagate(l.a, l.b);
          if (l.away) { aw++; const ok = !sight && !solid && !shot && !ray && plain(snd) && (!leaf || !dyn); if (ok) awOk++; else if (T.bad.length < 4) T.bad.push(`${leaf ? 'leaf' : 'wall'} ${i} cut-away line stopped: sight ${sight} solid ${solid} fire ${shot} round ${!!ray} sound clear ${plain(snd)}${leaf ? ` leaf ${dyn}` : ''}`); }
          else { kp++; const hitIt = !!ray && ray.index === index(i) && Math.abs(ray.t - l.t0) < 1e-9; const ok = sight && solid && shot && hitIt && !plain(snd) && (!leaf || dyn); if (ok) kpOk++; else if (T.bad.length < 4) T.bad.push(`${leaf ? 'leaf' : 'wall'} ${i} kept line passed: sight ${sight} solid ${solid} fire ${shot} round ${ray ? `#${ray.index} at ${ray.t.toFixed(4)} (want ${l.t0.toFixed(4)})` : 'none'} sound clear ${plain(snd)}${leaf ? ` leaf ${dyn}` : ''}`); } }
        T.away += aw; T.kept += kp; if (aw > 0 && awOk === aw) T.passOk++; if (kp > 0 && kpOk === kp) T.stopOk++; });
      return T;
    };
    const walls = col.boxes.slice(1, 1 + NW), tw = col.boxes.slice(tiltFrom);
    const Tw = sweep(walls, i => 1 + i, false);
    F.verdict(Tw.passOk === NW && Tw.away > NW * 8, `${NW} upright cut walls (yaw 0, quarter turns, any yaw; 3 added at runtime): every line through the cut-away part passes — sight, sound's straight run, a step, a line of fire, a round`, `${Tw.passOk} of ${NW} walls let every such line through (${Tw.away} lines)${Tw.bad.length ? ' · ' + Tw.bad.join(' · ') : ''}`);
    F.verdict(Tw.stopOk === NW && Tw.kept > NW * 8, `the same ${NW} walls: every line through the kept part is stopped, and the round lands where the reference enters the solid`, `${Tw.stopOk} of ${NW} walls stop every such line (${Tw.kept} lines)`);
    const Tt = sweep(tw, i => tiltFrom + i, false);
    F.verdict(Tt.passOk === 3 && Tt.stopOk === 3 && Tt.away > 20 && Tt.kept > 20, '3 tilted cut walls (a full rotation: filed by the yawed footprint, asked first)', `${Tt.passOk} / ${Tt.stopOk} of 3 pass / stop (${Tt.away} + ${Tt.kept} lines)${Tt.bad.length ? ' · ' + Tt.bad.join(' · ') : ''}`);
    const Tl = sweep(leaves, i => 1e6 + i, true);
    F.verdict(Tl.passOk === 6 && Tl.stopOk === 6 && Tl.away > 40 && Tl.kept > 40, '6 cut door leaves (shut, ajar, open): the cut-away part is open to sight, fire, the round and the leaf-only sound test; the kept part stops them', `${Tl.passOk} / ${Tl.stopOk} of 6 pass / stop (${Tl.away} + ${Tl.kept} lines)${Tl.bad.length ? ' · ' + Tl.bad.join(' · ') : ''}`);
    { // the switch OFF: the record is not there — the lines through the cut-away part meet the whole box again
      cutConfig.on = false; let n = 0, bad = 0; const R2 = seeded(5150);
      for (const [list, leaf] of [[walls, false], [leaves, true]] as [any[], boolean][]) for (const b of list) { cutConfig.on = true; const L = linesAcross(R2, b, 24, 1.0, leaf ? 1.95 : 2.9, 1.2); cutConfig.on = false;
        for (const l of L) { if (!l.away) continue; n++; if (!(col.segmentBlocked(l.a, l.b) && col.solidBlocked(l.a, l.b) && col.shotBlocked(l.a, l.b) && col.raycast(l.a, l.d, l.len))) bad++; } }
      cutConfig.on = true;
      F.verdict(bad === 0 && n > 300, 'switch off: the same walls and leaves stop the lines through their cut-away part (the whole box)', `${n} lines · ${bad} passed`); }

    // ---------------------------------------------------------------- the ragged ends the game itself leaves (a level's partitions blown, its cover shot; the standing pieces asked)
    { const { standUp } = await import('./headless.ts'); const { readFileSync } = await import('node:fs');
      const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
      const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
      const destr0 = DESTRUCTION.on, rnd0 = Math.random;
      const stage = async (floor = 'block-squads') => { DESTRUCTION.on = true; Math.random = seeded(11); cutConfig.on = true;
        const W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${floor}.json`, 'utf8'))) }); const game: any = W.game; cutConfig.on = true;   // (standUp follows CUTBOXES when it is given: this probe stages the switch itself)
        game.godMode = true; game.aiEnabled = false; game.tune.chaos = 0.5; for (let i = 0; i < 3; i++) W.step(1 / 60);
        for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; }
        return { W, game }; };
      /** every standing static with a cut record, asked: a line counts only when THIS piece decides it (with the piece hidden nothing else is in its way); sound only
       *  for lines at or above the height SoundPaths lifts its ends to */
      const ask = (game: any, seed: number, yLo: number) => {
        const gc = game.col; const from = game.destr.walls.authored; const ends: number[] = []; for (let i = from; i < gc.boxes.length; i++) { const b = gc.boxes[i]; if (b.cut && b.cut.length && !(b.flags & BoxFlag.NoShadow)) ends.push(i); }
        let used = 0, awayN = 0, keptN = 0, bad = 0, endsAway = 0, endsOk = 0, heard = 0; const said: string[] = []; const R3 = seeded(seed);
        for (const bi of ends) { const b = gc.boxes[bi]; const A = axesOf(b); const inBox = (p: Vec3) => [0, 1, 2].every(i => Math.abs((p[0] - b.c[0]) * A[i][0] + (p[1] - b.c[1]) * A[i][1] + (p[2] - b.c[2]) * A[i][2]) <= b.h[i] + 1e-4);
          // (the reference answers for a line from OUTSIDE the box: a fat piece — a crate, not a partition — wants a longer line than a wall's half metre, and a line with an end in the box is not asked)
          const L = linesAcross(R3, b, 200, yLo, 3.2, Math.max(0.5, 2.2 * Math.min(b.h[0], b.h[2]) + 0.1)); let aw = 0, awOk = 0;
          for (const l of L) { if (!l.away && !l.kept) continue; if (inBox(l.a) || inBox(l.b)) continue;
            b.flags |= BoxFlag.NoShadow; const other = gc.solidBlocked(l.a, l.b) || !!gc.raycast(l.a, l.d, l.len); b.flags &= ~BoxFlag.NoShadow; if (other) continue; used++;
            const sight = gc.segmentBlocked(l.a, l.b), solid = gc.solidBlocked(l.a, l.b), shot = gc.shotBlocked(l.a, l.b), ray = gc.raycast(l.a, l.d, l.len);
            const ears = Math.min(l.a[1], l.b[1]) >= 0.9; let clear = l.away; if (ears) { gc.sound.invalidate(); clear = plain(gc.sound.propagate(l.a, l.b)); heard++; }
            const ok = l.away ? !sight && !solid && !shot && !ray && clear : sight && solid && shot && !!ray && ray.index === bi && !clear;
            if (l.away) { awayN++; aw++; if (ok) awOk++; } else keptN++;
            if (!ok) { bad++; if (said.length < 3) said.push(`piece #${bi} ${l.away ? 'cut-away line stopped' : 'kept line passed'}: sight ${sight} solid ${solid} fire ${shot} round ${ray ? '#' + ray.index : 'none'}${ears ? ` sound clear ${clear}` : ''}`); } }
          if (aw > 0) { endsAway++; if (awOk === aw) endsOk++; } }
        return { ends: ends.length, used, awayN, keptN, bad, endsAway, endsOk, heard, said };
      };
      try {
        { // (a) walls, the break table alone (no wall look beside it: beside the look the standing pieces stay square and the look's plates are picture only)
          const { W, game } = await stage(); game.destr.breaks.look = null; let blasts = 0;
          for (const w of game.destr.walls.all()) { const b = w.box; const alongX = b.h[0] >= b.h[2]; const L = alongX ? b.h[0] : b.h[2];
            const at: Vec3 = alongX ? [b.c[0], 0.4, b.c[2] + 0.3] : [b.c[0] + 0.3, 0.4, b.c[2]]; game.destr.blast(at, { who: PLAYER_ID, radius: 2.4 }); blasts++; for (let f = 0; f < 20; f++) W.step(1 / 60); }
          for (let f = 0; f < 240; f++) W.step(1 / 60);
          const r = ask(game, 77, 0.05);
          F.verdict(r.bad === 0 && r.ends >= 20 && r.endsAway >= 20 && r.endsOk === r.endsAway && r.awayN >= 100 && r.keptN >= 500 && r.heard >= 200, 'a level after real charges (block-squads, every wall and cover blown, the break table alone): a line through a standing piece\'s bitten-off end passes, one through what stands is stopped',
            `${blasts} charges · ${r.ends} standing pieces with a ragged end · ${r.endsOk} of ${r.endsAway} let every line through their cut-away part (${r.awayN} lines) · ${r.keptN} lines through the kept part · ${r.heard} also asked of the sound path · ${r.bad} wrong${r.said.length ? ' · ' + r.said.join(' · ') : ''}`); }
        { // (b) cover as the build plays it (the wall look on): a cell shot out of each piece of cover leaves ragged ends on what stands. Asked on TWO floors and
          // summed: the block (whose walls (a) blows; rebuilt 10-13 it stands only two pieces of cover) and the hall, the floor with the most cover of two cells and up
          const T = { opened: 0, ends: 0, endsAway: 0, endsOk: 0, awayN: 0, keptN: 0, bad: 0 }; const per: string[] = []; const said: string[] = [];
          for (const [floor, seed] of [['block-squads', 78], ['hall', 79]] as [string, number][]) {
            const { W, game } = await stage(floor); const list = (game.destr.walls as any).list as any[]; let opened = 0;
            for (const B of list) { if (B.kind !== 'cover' || B.nOpen !== 0 || B.nx * B.ny * B.nz < 2) continue; (game.destr.walls as any).openCells(B, [0], 'fire', PLAYER_ID, [1, 0, 0], true); opened++; }
            for (let f = 0; f < 120; f++) W.step(1 / 60);
            const r = ask(game, seed, 0.02);
            T.opened += opened; T.ends += r.ends; T.endsAway += r.endsAway; T.endsOk += r.endsOk; T.awayN += r.awayN; T.keptN += r.keptN; T.bad += r.bad; said.push(...r.said.map(x => `${floor}: ${x}`));
            per.push(`${floor} ${opened} opened, ${r.ends} ragged, ${r.awayN} + ${r.keptN} lines`); }
          F.verdict(T.bad === 0 && T.ends >= 4 && T.endsOk === T.endsAway && T.awayN >= 10 && T.keptN >= 100, 'the build as it plays (the wall look on; the block and the hall): cover with a cell shot out — a line over the bitten-off end passes, one through what stands is stopped',
            `${T.opened} pieces of cover opened · ${T.ends} standing pieces with a ragged end · ${T.endsOk} of ${T.endsAway} let every line through their cut-away part (${T.awayN} lines) · ${T.keptN} lines through the kept part · ${T.bad} wrong · ${per.join(' · ')}${said.length ? ' · ' + said.slice(0, 3).join(' · ') : ''}`); }
      } finally { DESTRUCTION.on = destr0; Math.random = rnd0; }
    }
  } finally { cutConfig.on = was; }
  return F.done();
}

if (import.meta.main) {
  let ok = true; for (const f of [cutboxesRecord, cutboxesRay, cutboxesOff, cutboxesPack, cutboxesLines]) ok = (await f()) && ok;
  process.exit(ok ? 0 : 1);
}
