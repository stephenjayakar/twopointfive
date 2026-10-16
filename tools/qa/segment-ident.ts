// SEGMENT TESTS, OLD AGAINST NEW — collision.ts segmentBlocked / segmentBlockedDynamic / shotBlocked's pane list were rewritten for speed (scalars, a cell scanned
// once, a far box passed before its slab test) on the promise that no answer moves. This holds the code as it was (below, verbatim but for reading the collision
// object's private fields) beside the code as it is, over random segments on every level: endpoints anywhere, at eye / chest / shin heights, on box faces and a
// hair inside them, straight up, a few centimetres long, through door leaves swung to random angles — the answer, every pane noted and its distance (and, when the panes
// are listed, every glassOpen question in order) must be the same. Exit 1 on the first level with a difference.
//   bun run tools/qa/segment-ident.ts [--n 200000] [--levels office.json,warehouse.json] [--seed 1] [--bench]
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { standUp } from './headless.ts';
const ROOT = resolve(import.meta.dir, '../..');
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const { BoxFlag, rayBox, makeBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { lineBox } = await import(`${ROOT}/src/scene/collision.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
type Vec3 = [number, number, number];

// ── the code as it was (a7ce1d6) ──
let refStamp = new Int32Array(0), refId = 0;
function refDynamic(col: any, a: Vec3, b: Vec3, needFlags = 0): boolean {
  const d = v3.sub(b, a); const len = v3.len(d); if (len < 1e-4) return false; const rd = v3.scale(d, 1 / len);
  for (const db of col.dynamicBoxes) { if ((db.flags & needFlags) !== needFlags) continue; const hit = rayBox(a, rd, db, len); if (hit && hit.t >= 0) return true; }
  return false;
}
function refBlocked(col: any, a: Vec3, b: Vec3, shrink = 0.02, through: number = BoxFlag.Glass, panes: { bi: number; t: number }[] | null = null): boolean {
  const d = v3.sub(b, a); const len = v3.len(d); if (len < 1e-4) return false;
  const rd = v3.scale(d, 1 / len);
  if (refDynamic(col, a, b)) return true;
  if (refStamp.length < col.boxes.length) refStamp = new Int32Array(col.boxes.length);
  const id = ++refId; const steps = Math.ceil(len / 0.5) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * len; const x = Math.floor((a[0] + rd[0] * t) / col.cs), z = Math.floor((a[2] + rd[2] * t) / col.cs);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cz = z + dz; if (cx < 0 || cz < 0 || cx >= col.W || cz >= col.H) continue;
      const cell = col.cells[cz * col.W + cx];
      for (let k = 0; k < cell.length; k++) {
        const bi = cell[k]; if (refStamp[bi] === id) continue; refStamp[bi] = id;
        if (col.boxes[bi].flags & (through | BoxFlag.NoShadow)) continue;
        const s = lineBox(a, rd, col.boxes[bi]); if (!s) continue;
        if (s.depth > shrink) continue;
        if (s.t1 > shrink && s.t0 < len - shrink) {
          if (col.glassOpen && (col.boxes[bi].flags & BoxFlag.Glass) && col.glassOpen(bi, v3.mad(a, rd, Math.max(0, s.t0)))) continue;
          if (panes && (col.boxes[bi].flags & BoxFlag.Glass)) { panes.push({ bi, t: Math.max(0, s.t0) }); continue; }
          return true;
        }
      }
    }
  }
  return false;
}

// ── the run ──
const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const N = Number(flag('--n') ?? 200000), SEED = Number(flag('--seed') ?? 1);
const files = (flag('--levels') ?? readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).join(',')).split(',');
let s32 = SEED >>> 0; const rnd = () => { s32 = (s32 + 0x6D2B79F5) >>> 0; let t = s32; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let bad = 0;
const log = console.log, err = console.error; const hush = (on: boolean) => { console.log = on ? () => {} : log; console.error = on ? () => {} : err; };
for (const file of files) {
  let W: any; hush(true);
  try { const data = JSON.parse(await Bun.file(resolve(ROOT, 'levels', file)).text()); W = await standUp({ uploadEvery: 1000, ...(file === 'office.json' ? {} : { level: loadLevel(data) }) }); }
  catch (e) { hush(false); log(`${file.padEnd(20)} not stood up (${String((e as Error).message).split('\n')[0].slice(0, 90)}) — skipped`); continue; }
  hush(false);
  const g = W.game, col = g.col as any; const boxes = col.boxes as any[];
  for (const d of g.doors.list) { if (rnd() < 0.6) { d.angle = (rnd() * 2 - 1) * 1.9; d.latched = false; } } hush(true); try { for (let i = 0; i < 3; i++) W.step(1 / 60); } catch { /* a level that needs more to run a frame still has its statics and leaves */ } hush(false);
  // BROKEN WALLS (a build whose statics change after the bake — StaticCollision.addStatic; skipped where there is no such thing): a share of the upright statics is
  // hidden and stood back up as pieces appended to the list, filed in the authored box's cells; half way through the segments every piece is re-shaped in place.
  const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow; const broken: { box: any; pieces: any[] }[] = [];
  const reshape = (B: { box: any; pieces: any[] }) => { const b = B.box; for (const p of B.pieces) {
    const h: Vec3 = [b.h[0] * (0.15 + rnd() * 0.85), b.h[1] * (0.15 + rnd() * 0.85), b.h[2] * (0.15 + rnd() * 0.85)]; const l: Vec3 = [(rnd() * 2 - 1) * (b.h[0] - h[0]), (rnd() * 2 - 1) * (b.h[1] - h[1]), (rnd() * 2 - 1) * (b.h[2] - h[2])];
    p.c = [b.c[0] + Math.cos(b.yaw) * l[0] + Math.sin(b.yaw) * l[2], b.c[1] + l[1], b.c[2] - Math.sin(b.yaw) * l[0] + Math.cos(b.yaw) * l[2]]; p.h = h; p.flags = rnd() < 0.15 ? b.flags0 | HIDE : b.flags0; } };
  if (typeof col.addStatic === 'function') {
    const authored = boxes.length;
    for (let i = 0; i < authored; i++) { const b = boxes[i]; if (b.rot || (b.flags & (HIDE | BoxFlag.Glass)) || rnd() > 0.12) continue;
      const B = { box: b, pieces: [] as any[] }; b.flags0 = b.flags; const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) { const pc = makeBox({ c: [b.c[0], b.c[1], b.c[2]], h: [b.h[0], b.h[1], b.h[2]], yaw: b.yaw, albedo: [0.5, 0.5, 0.5], flags: b.flags, name: 'piece' }); col.addStatic(pc, b); B.pieces.push(pc); }
      reshape(B); b.flags = b.flags0 | HIDE; broken.push(B); }
  }
  const x0 = -2, x1 = col.W * col.cs + 2, z0 = -2, z1 = col.H * col.cs + 2;
  const anywhere = (): Vec3 => [x0 + rnd() * (x1 - x0), rnd() < 0.7 ? [0.15, 0.45, 0.9, 1.2, 1.5, 2.0, 2.6][Math.floor(rnd() * 7)] : -0.5 + rnd() * 4.5, z0 + rnd() * (z1 - z0)];
  const onBox = (): Vec3 => { const b = boxes[Math.floor(rnd() * boxes.length)]; const l: Vec3 = [(rnd() * 2 - 1) * b.h[0], (rnd() * 2 - 1) * b.h[1], (rnd() * 2 - 1) * b.h[2]];
    const ax = Math.floor(rnd() * 3); l[ax] = (rnd() < 0.5 ? -1 : 1) * (b.h[ax] + [0, 0, 1e-9, -1e-9, 0.019, 0.021, -0.019, -0.021, 0.001, -0.3][Math.floor(rnd() * 10)]);
    const w = b.rot ? quat.rotate(b.rot, l) : [Math.cos(b.yaw) * l[0] + Math.sin(b.yaw) * l[2], l[1], -Math.sin(b.yaw) * l[0] + Math.cos(b.yaw) * l[2]]; return [b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]]; };
  const onLeaf = (): Vec3 => { const dyn = col.dynamicBoxes; if (!dyn.length) return anywhere(); const b = dyn[Math.floor(rnd() * dyn.length)]; return [b.c[0] + (rnd() * 2 - 1) * 1.5, b.c[1] + (rnd() * 2 - 1) * 1.2, b.c[2] + (rnd() * 2 - 1) * 1.5]; };
  const tilt = boxes.filter(b => b.rot);   // (tilted statics are filed by their yawed footprint alone: a share of the segments start or end on and round them)
  const onTilt = (): Vec3 => { const b = tilt[Math.floor(rnd() * tilt.length)]; if (rnd() < 0.5) return [b.c[0] + (rnd() * 2 - 1) * 2.5, b.c[1] + (rnd() * 2 - 1) * 0.8, b.c[2] + (rnd() * 2 - 1) * 2.5];
    const l: Vec3 = [(rnd() * 2 - 1) * b.h[0] * 1.2, (rnd() * 2 - 1) * b.h[1] * 1.2, (rnd() * 2 - 1) * b.h[2] * 1.2]; const w = quat.rotate(b.rot, l); return [b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]]; };
  const pick = (): Vec3 => { const r = rnd(); return tilt.length && r > 0.88 ? onTilt() : r < 0.45 ? anywhere() : r < 0.8 ? onBox() : onLeaf(); };
  const asked: string[] = [], askedRef: string[] = []; let sink = asked;
  const realOpen = col.glassOpen; const holes = (bi: number, p: Vec3) => ((bi * 7919 + Math.floor(p[0] * 3) * 31 + Math.floor(p[1] * 3) * 17 + Math.floor(p[2] * 3)) & 3) === 0;   // (a made-up set of fallen cells, the same for both)
  let diff = 0, blockedN = 0, paneN = 0, first = '';
  for (let i = 0; i < N; i++) {
    if (i === (N >> 1)) for (const B of broken) reshape(B);
    const a = pick(); let b = pick(); const r = rnd();
    if (r < 0.08) b = [a[0] + (rnd() - 0.5) * 0.05, a[1] + (rnd() - 0.5) * 0.05, a[2] + (rnd() - 0.5) * 0.05]; else if (r < 0.14) b = [a[0], a[1] + (rnd() * 2 - 1) * 9, a[2]]; else if (r < 0.3) { const L = 0.3 + rnd() * 4, th = rnd() * 6.283; b = [a[0] + Math.sin(th) * L, a[1] + (rnd() - 0.5) * 0.6, a[2] + Math.cos(th) * L]; } else if (r < 0.34) b = [a[0] + (rnd() < 0.5 ? 0 : (rnd() - 0.5) * 30), a[1], a[2] + (rnd() - 0.5) * 30];
    const shrink = [0.02, 0.02, 0.02, 0, 0.05, 0.3, -0.05][Math.floor(rnd() * 7)], through = rnd() < 0.5 ? BoxFlag.Glass : 0, wantPanes = through === 0 && rnd() < 0.5, withHoles = rnd() < 0.4;
    col.glassOpen = withHoles ? (bi: number, p: Vec3) => { sink.push(`${bi}:${p[0]},${p[1]},${p[2]}`); return holes(bi, p); } : realOpen;
    const pn: { bi: number; t: number }[] = [], pr: { bi: number; t: number }[] = [];
    asked.length = 0; askedRef.length = 0; sink = asked; const now = col.segmentBlocked(a, b, shrink, through, wantPanes ? pn : null); const nowD = col.segmentBlockedDynamic(a, b), nowS = col.segmentBlockedDynamic(a, b, BoxFlag.SoundSeal);
    sink = askedRef; const was = refBlocked(col, a, b, shrink, through, wantPanes ? pr : null); const wasD = refDynamic(col, a, b), wasS = refDynamic(col, a, b, BoxFlag.SoundSeal);
    if (now) blockedN++; paneN += pn.length;
    if (now !== was || nowD !== wasD || nowS !== wasS || pn.length !== pr.length || pn.some((p, k) => p.bi !== pr[k].bi || !Object.is(p.t, pr[k].t)) || (wantPanes && (asked.length !== askedRef.length || asked.some((q, k) => q !== askedRef[k])))) {
      diff++; first ||= `a ${a.map(n => n.toFixed(4))} b ${b.map(n => n.toFixed(4))} shrink ${shrink} through ${through}: blocked ${was}→${now}, leaves ${wasD}→${nowD}, sealed ${wasS}→${nowS}, panes ${pr.length}→${pn.length}, glassOpen asked ${askedRef.length}→${asked.length}`; }
  }
  col.glassOpen = realOpen;
  if (argv.includes('--bench')) {   // the same sight-line-like segments through both, interleaved in blocks (eye height, 2 to 25 m, inside the level)
    const segs: [Vec3, Vec3][] = []; for (let i = 0; i < 20000; i++) { const a: Vec3 = [1 + rnd() * (col.W * col.cs - 2), 1.5, 1 + rnd() * (col.H * col.cs - 2)], L = 2 + rnd() * 23, th = rnd() * 6.283; segs.push([a, [Math.min(col.W * col.cs - 1, Math.max(1, a[0] + Math.sin(th) * L)), 0.9 + rnd() * 0.8, Math.min(col.H * col.cs - 1, Math.max(1, a[2] + Math.cos(th) * L))]]); }
    let tNew = 0, tOld = 0, n = 0; for (let rep = 0; rep < 10; rep++) { let t = performance.now(); for (const [a, b] of segs) if (col.segmentBlocked(a, b)) n++; tNew += performance.now() - t; t = performance.now(); for (const [a, b] of segs) if (refBlocked(col, a, b)) n--; tOld += performance.now() - t; }
    log(`${''.padEnd(20)} bench: ${(tOld / 200).toFixed(2)} µs a segment as it was → ${(tNew / 200).toFixed(2)} µs now (×${(tOld / tNew).toFixed(1)}; answers ${n === 0 ? 'equal' : 'DIFFER'})`);
  }
  log(`${file.padEnd(20)} ${N} segments · ${boxes.length} statics · ${col.dynamicBoxes.length} leaves · ${broken.length ? `${broken.length} broken into ${broken.reduce((n, B) => n + B.pieces.length, 0)} pieces · ` : ''}${blockedN} blocked · ${paneN} panes noted · ${diff ? `FAIL — ${diff} differ, first: ${first}` : 'PASS — every answer and every pane the same'}`);
  if (diff) bad++;
}
log(bad ? `=== segment-ident: ${bad} level(s) FAIL ===` : '=== segment-ident: ALL PASS ===');
process.exit(bad ? 1 : 0);
