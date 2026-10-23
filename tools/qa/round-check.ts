// ROUND THINGS ARE ROUND (src/scene/round.ts, ROUND).
// Every level file: the kit's octagons the rule finds, against the count each file is known to hold; stood up with the switch each is ONE round box and three
// specks, and put back the list is the file's again. The shape, by a reference written here (is a point inside the cylinder?): boxes.ts rayBox and collision.ts
// lineBox over seeded round boxes (yawed and fully rotated), and the rule common.wgsl runs (isectRound, transliterated over f32) at the same t on the same face.
// The pass, stood up: a line that grazes its brazier's barrel is stopped all the way round and a line a hair out is free all the way round (the kit's octagon
// stops neither set whole), a body pushed against it — and Sam himself — stands at one distance all the way round, a round thing the wall engine can chew is
// one cell, a checkpoint loads with the switch as it was saved and across it with nothing broken, the walk grid of a lone round is a disc; the run with
// the switch off is the same run before and after a level was rounded; the fingerprint, the stands, a recording from before the table; what the box world
// packs for the GPU with the round's GPU half up, and that it packs nothing new with it down.
//   bun run tools/qa/round-check.ts          (probes.ts round; ROUND_BREAK=1 must FAIL — the stand's word is left down where the check raises it)
// Both stands: the check gives the stand its word (TPS_ROUND) itself. Nothing here is a picture: no round thing has been seen on a GPU by this check, and the
// shader's rule is checked as text put into TypeScript, not as a compiled program.
import { readFileSync, readdirSync } from 'node:fs';
import { standUp, ROOT, fake } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { ROUND, ROUND_STATS, roundConfig, findOctagons, roundLevel, roundTape, ROUND_CORE_W } = await import(`${ROOT}/src/scene/round.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
const { makeBox, rayBox, BoxWorld, BoxFlag, GEO_STRIDE, BOX_ROUND_BIT } = await import(`${ROOT}/src/scene/boxes.ts`);
const { StaticCollision, NavGrid, lineBox } = await import(`${ROOT}/src/scene/collision.ts`);
const { cutConfig, CUT_STRIDE } = await import(`${ROOT}/src/scene/cut.ts`);
const { scenePrelude } = await import(`${ROOT}/src/render/frame.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, BREAK = process.env.ROUND_BREAK === '1', VERBOSE = !!process.env.ROUND_VERBOSE;
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; } }
const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${file}`, 'utf8')));
let stood: boolean | null = null, stoodRound = false;   // (the switch as the stand left it and whether that Game's level had a round box, read once after the first stand-up)
async function stand(file: string, on: boolean, level?: any): Promise<any> {
  Math.random = seeded(21);
  const word = process.env.TPS_ROUND;
  try {
    if (stood === null) { const W0: any = await hushed(() => standUp({ level: levelOf(file), seed: 1 })); stood = !!ROUND.on; stoodRound = W0.game.level.boxes.some((b: any) => b.round === true); }
    process.env.TPS_ROUND = on && !BREAK ? '1' : '0';   // (the stand writes the switch from its word before it hands the level's boxes to the world)
    return await hushed(() => standUp({ level: level ?? levelOf(file), seed: 1 }));
  } finally { if (word === undefined) delete process.env.TPS_ROUND; else process.env.TPS_ROUND = word; }
}
/** the octagons of slabs each level is known to hold (the kit's drums, tyres, stoves and oven — gwotKit round with a radius of 0.2 or more — and the round table
 *  tops and drums three older generators wrote into lived-in rooms): [as its file has it, with its lived-in rooms' things stood in it as well (scene/lived.ts
 *  LIVED, the shipped stand)]. A level that gains a round thing gains a row; a file with none of them has no row, and line 1 looks every file over for a ring of
 *  four boxes the rule did not take. */
const KNOWN: Record<string, [number, number]> = {
  'bazaar.json': [6, 6], 'block-gwot.json': [0, 4], 'block-squads-gwot.json': [0, 4], 'block-squads.json': [0, 4], 'block.json': [0, 4], 'compound-gwot.json': [0, 3],
  'compound.json': [0, 3], 'consulate-gwot.json': [0, 1], 'consulate.json': [0, 1], 'crossing.json': [26, 28], 'glasshouse.json': [3, 5], 'gwot-yard.json': [18, 18],
  'lights-out.json': [9, 9], 'pass.json': [8, 19], 'police-post.json': [15, 19], 'quiet-relay.json': [18, 21], 'records-gwot.json': [0, 1], 'records.json': [0, 1],
  'snatch.json': [12, 12], 'train-move.json': [13, 13], 'train-orders.json': [2, 2], 'tut-pair.json': [35, 35], 'tut-plan.json': [24, 24], 'tut-quiet.json': [14, 14],
  'tut-sky.json': [15, 22], 'tut-solo.json': [29, 29], 'tut-squad.json': [25, 31], 'vault.json': [10, 10],
};
const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`);
const known = (f: string): number => (KNOWN[f] ?? [0, 0])[LIVED.on ? 1 : 0];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** the box's local axes in the world (yaw about +y, or the full rotation) — written out here, not taken from the code under test */
function axesOf(b: any): [Vec3, Vec3, Vec3] {
  if (b.rot) return [quat.rotate(b.rot, [1, 0, 0]), quat.rotate(b.rot, [0, 1, 0]), quat.rotate(b.rot, [0, 0, 1])];
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}
const localOf = (b: any, p: readonly number[]): Vec3 => { const A = axesOf(b), q = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]]; return [dot(A[0], q), dot(A[1], q), dot(A[2], q)]; };
/** THE REFERENCE: is the world point inside the round box's cylinder, grown by `grow` metres? */
const inside = (b: any, p: readonly number[], grow = 0) => { const l = localOf(b, p); return Math.hypot(l[0], l[2]) < b.h[0] + grow && Math.abs(l[1]) < b.h[1] + grow; };
const at = (o: Vec3, d: Vec3, t: number): Vec3 => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
/** common.wgsl isectBox's slab walk, then isectRound, statement for statement over f32 (a round box's path); returns (t, code) */
function gpuIsect(b: any, o: Vec3, d: Vec3, tmax: number): [number, number] {
  const f = Math.fround, lo = localOf(b, o).map(f), A = axesOf(b), ld = [dot(A[0], d), dot(A[1], d), dot(A[2], d)].map(f), h = b.h.map(f);
  const tmn = [0, 0, 0], tmx = [0, 0, 0]; let tN = -Infinity, tF = Infinity;
  for (let a = 0; a < 3; a++) { const inv = f(1 / (Math.abs(ld[a]) < 1e-8 ? (ld[a] < 0 ? -1e-8 : 1e-8) : ld[a])); const tA = f((-h[a] - lo[a]) * inv), tB = f((h[a] - lo[a]) * inv); tmn[a] = Math.min(tA, tB); tmx[a] = Math.max(tA, tB); tN = Math.max(tN, tmn[a]); tF = Math.min(tF, tmx[a]); }
  if (tN > tF || tF < 0 || tN > tmax) return [-1, 0];
  const R = h[0], tBox = tN; tN = tmn[1]; tF = tmx[1]; let code = 2 + (ld[1] > 0 ? 1 : 0);
  const px = f(lo[0] + ld[0] * tBox), pz = f(lo[2] + ld[2] * tBox);
  const a = f(ld[0] * ld[0] + ld[2] * ld[2]), hb = f(px * ld[0] + pz * ld[2]), c = f(f(px * px + pz * pz) - f(R * R));
  if (a < 1e-12) { if (c > 0) return [-1, 0]; }
  else {
    const disc = f(f(hb * hb) - f(a * c)); if (disc < 0) return [-1, 0];
    const s = f(Math.sqrt(disc)), ta = f(tBox + f((-hb - s) / a));
    if (ta >= tN) { tN = ta; code = -9; }
    tF = Math.min(tF, f(tBox + f((-hb + s) / a)));
  }
  if (tN > tF || tF < 0 || tN > tmax) return [-1, 0];
  if (tN < 0) return [0, 7];
  return [tN, code];
}
const randomRound = (R: () => number, i: number): any => makeBox({ c: [(R() - 0.5) * 4, 0.5 + R(), (R() - 0.5) * 4], h: (r => [r, 0.1 + R() * 0.6, r])(0.15 + R() * 0.6) as Vec3, yaw: i % 3 === 2 ? 0 : R() * 6.28,
  rot: i % 3 === 2 ? quat.axisAngle(norm([R() - 0.5, R() - 0.5, R() - 0.5]), R() * 6.28) : undefined, round: true });

export async function roundCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== round: round things are round${BREAK ? ' (ROUND_BREAK: the switch left off)' : ''} ===`);
  const was = { ...ROUND }, gpuWas = roundConfig.gpu, cutWas = cutConfig.on, stats0 = { ...ROUND_STATS }, rnd = Math.random;
  try {
    // (1) every level file
    { const wrong: string[] = []; let files = 0, total = 0, back = 0, shape = 0, loose = 0;
      const flat = (B: any[]) => JSON.stringify(B.map(b => [b.c, b.h, b.yaw, b.flags, b.marks ?? null, b.round ?? null]));
      for (const f of readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !f.includes('.lint')).sort()) {
        const L = levelOf(f), n = findOctagons(L.boxes).length, kn = known(f); const file = flat(L.boxes), count = L.boxes.length;
        if (n !== kn) wrong.push(`${f}: ${n} found, known ${kn}`);
        { const took = new Set<number>(); for (const i of findOctagons(L.boxes)) for (let k = 0; k < 4; k++) took.add(i + k);   // a ring the rule did not take: four solid boxes in a row at one centre, each 45° on from the last
          const B = L.boxes; for (let i = 0; i + 3 < B.length; i++) { if (took.has(i) || B[i].flags !== 0 || B[i].rot || B[i].h[0] < 0.19) continue; let ring = true; for (let k = 1; k < 4 && ring; k++) ring = B[i + k].flags === 0 && Math.hypot(B[i + k].c[0] - B[i].c[0], B[i + k].c[2] - B[i].c[2]) < 0.002 && Math.abs(B[i + k].yaw - B[i].yaw - k * Math.PI / 4) < 0.01 && Math.abs(B[i + k].h[0] - B[i].h[0]) < 0.005; if (ring) { loose++; wrong.push(`${f}: boxes ${i}‥${i + 3} are a ring of four the rule left`); } } }
        if (n) files++; total += n;
        const made = roundLevel(L.boxes, true, L.markTexel), again = roundLevel(L.boxes, true, L.markTexel);
        const rounds = L.boxes.filter((b: any) => b.round === true), specks = L.boxes.filter((b: any) => b.was && !b.round);
        const good = rounds.every((b: any) => b.h[0] === b.h[2] && b.h[0] > 0.19 && b.yaw === 0 && b.flags === 0 && !b.cut && !b.rot) && specks.every((b: any) => (b.flags & BoxFlag.NoPrimary) && (b.flags & BoxFlag.NoShadow) && b.h[0] === 0.01);
        if (made !== n || again !== n || rounds.length !== n || specks.length !== 3 * n || L.boxes.length !== count || !good) { shape++; wrong.push(`${f}: ${made}/${again} made of ${n}, ${rounds.length} round, ${specks.length} specks`); }
        if (roundLevel(L.boxes, false) !== 0 || flat(L.boxes) !== file || L.boxes.some((b: any) => b.was || b.round)) { back++; wrong.push(`${f}: not put back`); }
      }
      line(wrong.length === 0 && files === Object.keys(KNOWN).filter(f => known(f) > 0).length && shape === 0 && back === 0 && loose === 0, '1 every level file gives the round things it is known to hold and has no ring of four slabs the rule left; with the switch each is one round box and three specks in the places the four slabs had (twice over the same), and put back the list is the file\'s, box for box',
        `${files} files with round things · ${total} of them (lived-in rooms ${LIVED.on ? 'stood in' : 'left out'})${wrong.length ? ` · ${wrong.slice(0, 6).join(' · ')}` : ''}`); }

    // (2) ONE MODEL: rayBox, lineBox and the shader's rule against the reference
    { const R = seeded(5); let rays = 0, hits = 0, bad = 0, early = 0, missBad = 0, nBad = 0, lineBad = 0, gpuBad = 0, gpuFace = 0, gpuWorst = 0, ends = 0, sides = 0;
      for (let i = 0; i < 60; i++) { const b = randomRound(R, i);
        for (let k = 0; k < 80; k++) { rays++;
          const tgt: Vec3 = [b.c[0] + (R() - 0.5) * 2.2 * b.h[0], b.c[1] + (R() - 0.5) * 2.2 * b.h[1], b.c[2] + (R() - 0.5) * 2.2 * b.h[0]];
          const far = k % 8 === 7 ? 60 : 3, o: Vec3 = [tgt[0] + (R() - 0.5) * far, tgt[1] + (R() - 0.5) * far, tgt[2] + (R() - 0.5) * far]; if (inside(b, o, 0.01)) continue;
          const d = norm([tgt[0] - o[0], tgt[1] - o[1], tgt[2] - o[2]]), tmax = far * 2;
          const h = rayBox(o, d, b, tmax), seg = lineBox(o, d, b), g = gpuIsect(b, o, d, tmax);
          let first = -1; for (let s = 1; s < 4000; s++) { const t = tmax * s / 4000; if (inside(b, at(o, d, t), -1e-4)) { first = t; break; } }   // (the reference's own first sample inside)
          if (h) { hits++; const p = at(o, d, h.t), l = localOf(b, p), rl = Math.hypot(l[0], l[2]);
            const onSide = Math.abs(rl - b.h[0]) < 1e-7 && Math.abs(l[1]) <= b.h[1] + 1e-7, onEnd = Math.abs(Math.abs(l[1]) - b.h[1]) < 1e-7 && rl <= b.h[0] + 1e-7;
            if (!onSide && !onEnd) bad++;
            if (first >= 0 && first < h.t - tmax / 4000 - 1e-6) early++; if (first < 0 && inside(b, at(o, d, h.t + 0.02), -0.005)) early++;
            const A = axesOf(b), ln = [dot(A[0], h.n), dot(A[1], h.n), dot(A[2], h.n)];   // the normal in the box's frame: straight out of the side, or the end's
            const want = onSide && !onEnd ? [l[0] / rl, 0, l[2] / rl] : [0, Math.sign(l[1]), 0]; if (Math.hypot(ln[0] - want[0], ln[1] - want[1], ln[2] - want[2]) > 1e-5 || dot(h.n, d) >= 0) nBad++;
            if (onSide && !onEnd) sides++; else ends++;
            if (!seg || Math.abs(seg.t0 - h.t) > 1e-9 || !inside(b, at(o, d, (seg.t0 + seg.t1) / 2)) || inside(b, at(o, d, seg.t1 + 1e-4), -1e-6) || seg.depth > 0) lineBad++;
            else { const m = at(o, d, (seg.t0 + seg.t1) / 2), lm = localOf(b, m), in2 = lineBox(m, d, b); if (!in2 || Math.abs(in2.depth - Math.min(b.h[0] - Math.hypot(lm[0], lm[2]), b.h[1] - Math.abs(lm[1]))) > 1e-9 || in2.t0 > 0 || in2.t1 < 0 || rayBox(m, d, b, 10)) lineBad++; }   // (from inside: the depth under the nearer of the side and an end, and rayBox's no-hit rule)
            if (g[0] < 0 || Math.abs(g[0] - h.t) > 2e-4) { gpuBad++; gpuWorst = Math.max(gpuWorst, g[0] < 0 ? 1 : Math.abs(g[0] - h.t)); } else { gpuWorst = Math.max(gpuWorst, Math.abs(g[0] - h.t)); if ((g[1] < 0) !== (onSide && !onEnd) && Math.abs(rl - b.h[0]) + Math.abs(Math.abs(l[1]) - b.h[1]) > 1e-4) gpuFace++; }
          } else { if (first >= 0) missBad++; if (seg && seg.t1 > 0 && seg.t0 < tmax && seg.t1 - seg.t0 > 1e-6 && seg.t0 > 0) lineBad++; if (g[0] >= 0 && first < 0 && g[0] > 0) { let near = false; for (let s = 0; s < 400 && !near; s++) near = inside(b, at(o, d, tmax * s / 400), 2e-4); if (!near && !inside(b, at(o, d, g[0]), 2e-4)) gpuBad++; } }
        } }
      line(bad === 0 && early === 0 && missBad === 0 && nBad === 0 && lineBad === 0 && gpuBad === 0 && gpuFace === 0 && sides > 500 && ends > 200,
        '2 one model: over seeded round boxes (yawed and fully rotated) rayBox lands on the cylinder where the reference first finds a point inside it, its normal the side\'s straight out or the end\'s, a miss crosses none of it; lineBox\'s interval is that stay and its depth the origin\'s depth under the side or an end; and the shader\'s rule (isectBox + isectRound over f32) lands at the same t on the same kind of face',
        `${rays} rays, ${hits} hits (${sides} on a side, ${ends} on an end) · ${bad} off the surface · ${early} late · ${missBad} missed · ${nBad} normals · ${lineBad} intervals · GPU rule: ${gpuBad} off by > 0.2 mm, ${gpuFace} another face, worst ${gpuWorst.toExponential(1)} m`); }

    // (0) the stand, then the pass with the switch down and up
    const off: any = await stand('pass.json', false);
    const shipped = (process.env.TPS_PROFILE ?? '') === 'shipped', said = process.env.TPS_ROUND, word = said === '1';
    line(stood === (said !== undefined ? word : shipped) && stoodRound === stood, '0 the stand: off on the frozen stand, on on the shipped one, either as its word says where the run gives one, and the level it stands up has round boxes only where it is on', `stood up ${stood} · round boxes ${stoodRound} · ${shipped ? 'shipped' : 'frozen'} stand${said !== undefined ? ` · TPS_ROUND=${said}` : ''}`);
    const W: any = await stand('pass.json', true); const game = W.game, col = game.col, st: any[] = game.engine.world.statics;
    const near = (B: any[]) => B.findIndex((b: any) => Math.hypot(b.c[0] - 19.6, b.c[2] - 13.6) < 0.05 && b.h[1] > 0.2 && !(b.flags & BoxFlag.NoPrimary));
    const bi = near(st), drum = st[bi], oi = near(off.game.engine.world.statics), slab = off.game.engine.world.statics[oi];
    const slabA = slab ? slab.h[0] : 0, wantR = slabA * 1.026;   // (the circle with the octagon's area: round.ts R_OF_SLAB, written out here)
    { const rounds = st.filter(b => b.round === true).length, offRounds = off.game.engine.world.statics.filter((b: any) => b.round === true || b.was).length;
      const three = bi >= 0 && [1, 2, 3].every(k => st[bi + k].was && !st[bi + k].round && (st[bi + k].flags & BoxFlag.NoPrimary) && (st[bi + k].flags & BoxFlag.NoShadow));
      line(!!drum && drum.round === true && bi === oi && rounds === known('pass.json') && offRounds === 0 && three && Math.abs(drum.h[0] - wantR) < 1e-9 && drum.yaw === 0 && st.length === off.game.engine.world.statics.length && ROUND_STATS.made === rounds,
        '3 the pass stood up with the switch: its brazier\'s barrel is one round box where the first of its four slabs was, the other three are specks no pass or ray meets, every box keeps its place in the list; with the switch down no box is touched',
        `brazier box ${bi} (down: ${oi}) · round ${drum?.round === true} · radius ${drum?.h[0].toFixed(4)} over slabs ${slabA.toFixed(4)} long · ${rounds} round things up, ${offRounds} down · ${st.length} boxes either way`); }

    // (4) sight and movement at the brazier: the same all the way round
    { const N = 64, c = drum?.c ?? [19.6, 0.4, 13.6], y = c[1];
      const tangent = (C: any, d: number) => { let n = 0; for (let k = 0; k < N; k++) { const a = (k + 0.37) / N * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a); const m: Vec3 = [c[0] + nx * d, y, c[2] + nz * d];
        if (C.segmentBlocked([m[0] - nz * 0.45, y, m[2] + nx * 0.45], [m[0] + nz * 0.45, y, m[2] - nx * 0.45])) n++; } return n; };
      const pushed = (C: any) => { let lo = Infinity, hi = 0; for (let k = 0; k < N; k++) { const a = (k + 0.37) / N * Math.PI * 2, p: Vec3 = [c[0] + Math.cos(a) * 0.2, 0, c[2] + Math.sin(a) * 0.2]; C.collideCircle(p, 0.3, 0.2, 1.5); const d = Math.hypot(p[0] - c[0], p[2] - c[2]); lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
      const inB = tangent(col, wantR * 0.99), outB = tangent(col, wantR * 1.015), clear = tangent(col, wantR * 1.3), [lo, hi] = pushed(col);
      const offCol = off.game.col, inO = tangent(offCol, wantR * 0.99), outO = tangent(offCol, wantR * 1.015), [loO, hiO] = pushed(offCol);
      const hit = col.raycast([c[0] - 3, y, c[2] + wantR * 0.6], [1, 0, 0], 10), want = 3 - Math.sqrt(drum.h[0] ** 2 - (wantR * 0.6) ** 2);
      const ray = !!hit && hit.index === bi && Math.abs(hit.t - want) < 1e-6 && Math.abs(Math.hypot(hit.n[0], hit.n[2]) - 1) < 1e-9 && Math.abs(hit.n[2] - wantR * 0.6 / drum.h[0]) < 1e-6;
      line(clear === 0 && inB === N && outB === 0 && Math.abs(lo - (drum.h[0] + 0.3)) < 1e-6 && Math.abs(hi - (drum.h[0] + 0.3)) < 1e-6 && ray && inO < N && outO > 0 && hiO - loO > 0.01,
        '4 at the brazier, all the way round: a line of sight that grazes the barrel just inside its radius is stopped and one a hair outside is free, a body pushed against it stands at the barrel\'s radius plus its own, and a round fired at it stops on the curve with the normal straight out — where the kit\'s octagon lets some of the inner lines by, stops some of the outer ones and holds a body at different distances',
        `of ${N} lines: inside ${inB} stopped (octagon ${inO}), outside ${outB} stopped (octagon ${outO}), well clear ${clear} · a body stands ${lo.toFixed(4)}‥${hi.toFixed(4)} m out (octagon ${loO.toFixed(4)}‥${hiO.toFixed(4)}) · the round ${hit ? `box ${hit.index} at ${hit.t.toFixed(4)} m, wanted ${want.toFixed(4)}` : 'missed'}`); }

    // (4b) the game's own: Sam put inside the barrel is stood outside it, a round thing the wall engine can chew is one cell, and a save
    { const pl = game.player.char, c = drum.c; let lo = Infinity, hi = 0;
      for (let k = 0; k < 8; k++) { const a = (k + 0.3) / 8 * Math.PI * 2; game.teleportPlayer([c[0] + Math.cos(a) * 0.1, 0, c[2] + Math.sin(a) * 0.1]); for (let i = 0; i < 3; i++) W.step(DT); const d = Math.hypot(pl.pos[0] - c[0], pl.pos[2] - c[2]); lo = Math.min(lo, d); hi = Math.max(hi, d); }
      const want = drum.h[0] + pl.radius;
      const T: any = await stand('tut-pair.json', true), T0: any = await stand('tut-pair.json', false);   // (a level whose kit has drums in a paint the wall engine reads as wood, on either stand)
      const walls = T.game.destr.walls, chew: number[] = [], cells: number[] = []; T.game.col.boxes.forEach((b: any, i: number) => { const br = b.round === true ? walls.breakableAt(i) : null; if (br) { chew.push(i); cells.push(br.cells); } });
      const offChew = [0, 1, 2, 3].filter(k => chew.length > 0 && T0.game.destr.walls.breakableAt(chew[0] + k)).length;
      const SS: any = await import(`${ROOT}/src/game/savestate.ts`); let own = 'not asked', across = 'not asked';
      try { own = String(SS.canLoad(game, JSON.parse(JSON.stringify(SS.saveState(game))))); across = String(SS.canLoad(game, JSON.parse(JSON.stringify(SS.saveState(off.game))))); } catch (e) { own = `threw ${String(e).slice(0, 80)}`; }
      line(lo >= want - 1e-3 && hi - lo < 0.005 && (BREAK || (chew.length > 0 && cells.every(n => n === 1) && offChew === 4)) && own === 'null' && across === 'null',
        '4b in the game: Sam put inside the barrel from eight sides is stood outside it at one distance from its middle, its radius plus his own or more; on a level with drums the wall engine can chew, each is one breakable of one cell where the octagon was four, so it goes whole and never as pieces of the box round it; a checkpoint of the pass with its round things round loads, and so does one made with the switch down and nothing broken',
        `he stands ${lo.toFixed(3)}‥${hi.toFixed(3)} m out, at least ${want.toFixed(3)} · tut-pair: ${chew.length} round things breakable, cells ${cells.join(',') || 'none'} (the octagon at the first: ${offChew} of its four slabs breakable) · canLoad its own: ${own} · one from the switch down: ${across}`); }

    // (5) the walk grid of a lone round is a disc
    { const b = makeBox({ c: [12.3, 0.45, 9.1], h: [0.6, 0.45, 0.6], round: true }), sq = makeBox({ c: [12.3, 0.45, 9.1], h: [0.6, 0.45, 0.6] });
      const cells = (B: any) => { const nav = new NavGrid(new StaticCollision([B])); let n = 0, wrong = 0; for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { const d = Math.hypot((x + 0.5) * nav.cell - 12.3, (z + 0.5) * nav.cell - 9.1), bl = nav.blocked[z * nav.W + x] === 1; if (bl) n++; if (Math.abs(d - 0.94) > 0.006 && bl !== d < 0.94) wrong++; } return [n, wrong]; };
      const [n, wrong] = cells(BREAK ? sq : b), [nSq] = cells(sq);
      line(wrong === 0 && n > 0 && n < nSq, '5 the walk grid round a lone round thing is shut exactly where a walker\'s circle would touch the cylinder: a disc, fewer cells than the box round it shuts', `${n} cells shut, ${wrong} wrong · the box: ${nSq}`); }

    // (6) the switch down is the run it was: the same level object rounded and put back, against a fresh one
    { const run = async (level?: any) => { const V: any = await stand('pass.json', false, level); await hushed(() => { for (let i = 0; i < 600; i++) V.step(DT); }); return hashDigest(digestGame(V.game, true)); };
      const a = await run(), L = levelOf('pass.json'); roundLevel(L.boxes, true, L.markTexel); const b = await run(L);
      const up: any = await stand('pass.json', true); await hushed(() => { for (let i = 0; i < 600; i++) up.step(DT); }); const c = hashDigest(digestGame(up.game, true));
      line(a === b && !L.boxes.some((x: any) => x.round || x.was), '6 ten seconds of the pass with the switch down is the same run by digest on a level that was rounded and stood up again as on one fresh from its file (the stand puts every box back)', `fresh ${a} · rounded then stood down ${b} · with the switch up ${c}${c === a ? ' (the same: nobody met a round thing in ten seconds)' : ''}`); }

    // (7) the stands and a recording from before the table
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`);
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(game)));
      ROUND.on = true; const old = snap(); delete old.tables.ROUND; roundTape(old.tables); const tapeOff = ROUND.on === false;
      ROUND.on = true; const rec = snap(); roundTape(rec.tables); const tapeOn = ROUND.on === true && rec.tables.ROUND?.on === true;
      const called = ['src/replay/engineplay.ts', 'tools/qa/rerun.ts'].filter(f => !/roundTape\(src\)/.test(readFileSync(`${ROOT}/${f}`, 'utf8')));
      if (!/TPS_ROUND = .*ROUND\?\.on/.test(readFileSync(`${ROOT}/tools/qa/replay.ts`, 'utf8'))) called.push('tools/qa/replay.ts');
      const fpOn = levelFingerprint(game).fp as string, fpOff = levelFingerprint(off.game).fp as string;
      ROUND.on = true; J.applyKnobs(game, old); const before = ROUND.on;
      ROUND.on = false; J.applyKnobs(game, rec); const kept = ROUND.on;
      line(fpOn === fpOff && (BREAK || drum?.round === true) && tapeOff && tapeOn && called.length === 0 && before === false && kept === true && PR.FROZEN_HOLDS['ROUND.on'] === 'TPS_ROUND=1' && SE.STAND_ENV.includes('TPS_ROUND'),
        '7 the level\'s fingerprint is the same with its round things round as with the kit\'s octagons (a checkpoint or a recording is this level\'s either way); a recording from before the table has the switch put down before its level is stood up (the two tape players and the session replay each see to it), one made with it on keeps it; the stands\' list has the row and the word',
        `fingerprint ${fpOn} up, ${fpOff} down · a tape without the table: ${tapeOff ? 'down' : 'UP'} · with it: ${tapeOn ? 'up' : 'DOWN'} · not calling: ${called.join(', ') || 'none'} · applyKnobs without the table: ${before} · recorded on: ${kept} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['ROUND.on'] ?? 'no row'} · STAND_ENV ${SE.STAND_ENV.includes('TPS_ROUND')}`); }

    // (8) what the box world packs for the GPU
    { const build = (gpu: boolean, cut: boolean) => { cutConfig.on = cut; roundConfig.gpu = gpu; const w = new BoxWorld(fake('device'));
        const L = levelOf('pass.json'); roundLevel(L.boxes, !BREAK, L.markTexel); for (const b of L.boxes) w.statics.push(b);
        w.dynamics.push(makeBox({ c: [5, 1, 5], h: [0.3, 0.3, 0.3], flags: BoxFlag.Dynamic }), makeBox({ c: [6, 1, 5], h: [0.3, 0.4, 0.3], flags: BoxFlag.Dynamic, round: true })); w.upload(); return { w, text: scenePrelude() as string, whole: scenePrelude(true) as string }; };
      const up = build(true, true), w = up.w, allB = [...w.statics, ...w.dynamics], cd: Float32Array = (w as any).cutData;
      let bitBad = 0, rowBad = 0, nR = 0, cutBit = 0, dynBit = 0;
      for (let i = 0; i < allB.length; i++) { const b = allB[i], word = w.geoU32[i * GEO_STRIDE + 7], bit = (word & BOX_ROUND_BIT) !== 0;
        if (bit !== (b.round === true)) bitBad++; if (b.round === true && (word & 65536)) cutBit++; if ((b.flags & BoxFlag.Dynamic) && !b.round && bit) dynBit++;
        if (b.round !== true) continue; nR++; const q = i * CUT_STRIDE * 4;
        for (let k = 0; k < 8; k++) { const n = [cd[q + k * 4], cd[q + k * 4 + 1], cd[q + k * 4 + 2]], d = cd[q + k * 4 + 3], deg = Math.atan2(n[2], n[0]) * 180 / Math.PI; if (Math.abs(Math.hypot(n[0], n[2]) - 1) > 1e-6 || n[1] !== 0 || d !== Math.fround(b.h[0]) || Math.abs(((deg % 30) + 30) % 30 - 15) < 14.9 || Math.abs(((deg % 90) + 90) % 90 - 45) > 44.9) rowBad++; }
        if (cd[q + 32] !== 0 || cd[q + 35] !== ROUND_CORE_W) rowBad++; }
      let listed = 0; const n0 = w.visibleCount, nT = w.visibleCutTraced, nC = w.visibleCutCount; for (let k = nT; k < nC; k++) if (w.all[w.visible[n0 + k] & 0xFFFF].round === true) listed++;
      let plain = 0; for (let k = 0; k < n0; k++) if (w.all[w.visible[k] & 0xFFFF].round === true) plain++;
      const down = build(false, true), none = build(true, false); let downBits = 0; const wd = down.w, cdD: Float32Array = (wd as any).cutData; let downRows = 0;
      for (let i = 0; i < allB.length; i++) { const b = [...wd.statics, ...wd.dynamics][i], word = wd.geoU32[i * GEO_STRIDE + 7]; if (((word & 8) !== 0) !== ((b.flags & BoxFlag.Dynamic) !== 0)) downBits++; if (b.round === true) for (let k = 0; k < 36; k++) if (cdD[i * CUT_STRIDE * 4 + k] !== 0) downRows++; }
      const text = /const ROUND_BOXES: bool = true;/.test(up.text) && /const ROUND_BOXES: bool = false;/.test(down.text) && /const ROUND_BOXES: bool = false;/.test(none.text) && up.text.replace('ROUND_BOXES: bool = true', 'ROUND_BOXES: bool = false') === down.text;
      line(bitBad === 0 && rowBad === 0 && cutBit === 0 && dynBit === 0 && nR === known('pass.json') + 1 && listed === nR && plain === 0 && w.cutTraced === 0 && downBits === 0 && downRows === 0 && wd.visibleCutCount === 0 && none.w.roundOn === false && text,
        '8 with the round\'s GPU half up the box world sends the round bit on exactly the round boxes (never the cut bit, and a shoved box\'s own bit 3 is not sent), their rows hold the prism\'s eight planes at the radius and the round mark, they are drawn from the cut list\'s picture-only end and count for no cut program; with it down, or with the cut switch down, the words, the rows, the lists and the scene prelude are as they were',
        `${nR} round boxes · ${bitBad} bits wrong · ${cutBit} with the cut bit · ${rowBad} rows wrong · ${listed} in the picture-only list, ${plain} in the plain one · cutTraced ${w.cutTraced} · down: ${downBits} words changed, ${downRows} rows written, ${wd.visibleCutCount} listed · the prelude's const follows the switch and nothing else moves: ${text}`); }
  } finally { Object.assign(ROUND, was); roundConfig.gpu = gpuWas; cutConfig.on = cutWas; Object.assign(ROUND_STATS, stats0); Math.random = rnd; }
  console.log(`=== round: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await roundCheck()) ? 0 : 1);
