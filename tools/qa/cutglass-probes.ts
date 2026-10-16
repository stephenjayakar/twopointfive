// FALLEN GLASS AS CUT PLATES (src/game/shards.ts under the cut switch, scene/cut.ts; rebuild/cut-pieces/glass/notes.md) — headless verdicts:
//   cutglass-shape         a pane shot and blasted until pieces let go, the cut switch ON: every piece / dagger that becomes a plate is ONE box (two when its cell has more
//                          edges than a record holds) cut along its cell's edges — every corner of the cell is on a plate, every corner of a plate is inside the cell, the
//                          plates' area is the cell's, the record is ≤ 8 unit in-plane planes — still clear, polished, glass contact, inside glass's share of the pool; and
//                          never more plates than the rectangles made for the same shots
//   cutglass-break         a cut plate landing hard breaks into CUT children (the parent's outline in two or three: their area is never more than the parent's, never past
//                          generation 2), everything comes to rest, the rest crumbs lie round the real outlines; a twelve-sided cell leaves as two halves; the polygon helpers
//   cutglass-gone          a glass plate the POOL drops (evicted at rest to make room for another chunk) goes as grains of its own glass under the switch; switch off: nothing
//   cutglass-look          a cut plate carries the GLASS LOOK (shards.ts SHARDS.cut*: a pale edge colour, see-through faces inside a rim, a dark polished body); the four
//                          look knobs at zero = the plate as it first went in; the record's last row as the cut pass decodes it (scene/cut.ts packCut)
//   cutglass-determinism   the seeded volley twice with the switch on: digest, events, audio, particle records, debris and every cut record identical
//   cutglass-off           THE SWITCH OFF = THE RECTANGLES: no plate carries a record, the cut counters stay at zero — and, when CUTGLASS_BASE names a checkout of the base
//                          build, the same seeded volley there is identical: run digest, rounds, events, audio, particle records, debris
import { standUp, ROOT, fake } from './headless.ts';
import { CONF_PANE } from './office-pane.ts';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const { Particles } = PM;
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const SM = await import(`${ROOT}/src/game/shards.ts`);
const CM = await import(`${ROOT}/src/scene/cut.ts`);
const { BoxFlag, makeBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { GB_STATS } = GBM; const { SHARDS, SHARD_STATS, polyArea, clipHalf } = SM; const { cutConfig, cutVerts, cutContains, MAX_CUT_PLANES } = CM;

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
const resetStats = () => { for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0; for (const k of Object.keys(SHARD_STATS)) (SHARD_STATS as any)[k] = 0; };
/** run `fn` with the cut switch at `on`, and put it back whatever happens (the switch is a module global: the next probe must find it as it was) */
// (headless.ts lets CUTBOXES=1|0 pin the switch for a whole run at every stand-up: these probes set it themselves, so the variable is put to the same value for their length)
function pinEnv(on: boolean): () => void { const keys = ['CUTBOXES', 'CUT_BOXES'].filter(k => process.env[k] !== undefined), had = keys.map(k => process.env[k]!); for (const k of keys) process.env[k] = on ? '1' : '0'; return () => { keys.forEach((k, i) => { process.env[k] = had[i]; }); }; }   // (both spellings: headless.ts reads either)
async function withCut<T>(on: boolean, fn: () => Promise<T>): Promise<T> { const was = cutConfig.on; const unpin = pinEnv(on); cutConfig.on = on; try { return await fn(); } finally { cutConfig.on = was; unpin(); } }

// the pane (by where it stands: office-pane.ts) = the conference partition's second sheet (shards-probes.ts): c (7.5, 1.5, 10), annealed; Sam in the corridor south of it
const PANE = CONF_PANE;
const W_ = (u: number, v: number): Vec3 => [7.5 + u, 1.5 + v, 10];
const SAM: Vec3 = [8.3, 0, 11.6];
const OPEN: Vec3 = [20, 1.4, 14.6];
const SHOTS: [number, number][] = [[0.1, 0.1], [0.11, 0.1], [0.12, 0.11], [-0.5, -0.3], [-0.49, -0.3], [0.6, 0.4], [0.61, 0.41], [-0.2, 0.6], [-0.21, 0.6], [0.3, -0.6], [0.31, -0.6], [-0.7, 0.2], [0.75, -0.2], [0.0, -0.4], [0.01, -0.41], [0.45, 0.0]];

async function stage(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = 0.5; game.tune.glassBreak = true; game.tune.glassShards = true; resetStats();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; });
  game.teleportPlayer(SAM); game.player.char.bodyYaw = game.player.char.aimYaw = Math.PI; game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
  W.step(DT); W.step(DT);
  const P = engine.particles;
  const flush = () => { const q = P.pending.map((e: any) => ({ kind: e.kind, count: e.count, pos: e.pos.slice(), dir: e.dir.slice(), seed: e.seed, o: e.o })); P.pending.length = 0; P.pendingImpulses.length = 0; return q; };
  return { W, game, engine, P, flush };
}
/** every fragment the model is handed, with the plates it made of it AS MADE (the pool moves them from the next frame on) */
function watchReleases(game: any) {
  const S = game.shards, D = game.destr.debris; const orig = S.release.bind(S); const out: { f: any; plates: { c: Vec3; rot: number[]; h: Vec3; cut: any[] | undefined; poly: [number, number][] | undefined; flags: number; rough: number; contact: any }[] }[] = [];
  S.release = (f: any) => { const before = new Set(D.list); const r = orig(f);
    out.push({ f, plates: D.list.filter((c: any) => c.glass && !before.has(c)).map((c: any) => ({ c: c.box.c.slice(), rot: (c.box.rot ?? quat.yaw(c.box.yaw)).slice(), h: c.box.h.slice(), cut: c.box.cut, poly: c.glass.poly, flags: c.box.flags, rough: c.box.rough, contact: c.contact, albedo: c.box.albedo.slice(), core: c.box.cutCore ? c.box.cutCore.slice() : null, glassLook: c.box.cutGlass ? { ...c.box.cutGlass } : null })) });
    return r; };
  return out;
}
const conj = (q: number[]) => [-q[0], -q[1], -q[2], q[3]] as [number, number, number, number];
/** the shots + one stun-sized blast, stepping as it goes; returns the peak pool and glass counts */
function breakPane(W: any, game: any, flush: () => any[]) {
  const gb = game.glassBreak, D = game.destr.debris; let peak = 0, peakGlass = 0; const recs: any[] = [];
  const step = (n: number) => { for (let f = 0; f < n; f++) { W.step(DT); recs.push(...flush()); peak = Math.max(peak, D.list.length); peakGlass = Math.max(peakGlass, D.list.filter((c: any) => c.glass).length); } };
  for (const [u, v] of SHOTS) { gb.hit(PANE, W_(u, v), [0, 0, -1], 1); step(18); }
  game.events.push({ kind: 'bang', pos: [8.6, 0.6, 10.7], time: game.time, loud: true, who: 0 }); step(240);
  return { peak, peakGlass, recs };
}

// ================================================================ the shape
export async function cutglassShape() {
  const F = family('cutglass-shape: under the cut switch a fallen piece is its cell — one plate cut along the cell\'s edges');
  const on = await withCut(true, async () => {
    const { W, game, flush } = await stage(9301); const rel = watchReleases(game); const r = breakPane(W, game, flush);
    return { rel, r, stats: { ...SHARD_STATS }, cap: game.destr.debris.cap(), game };
  });
  const off = await withCut(false, async () => {
    const { W, game, flush } = await stage(9301); const rel = watchReleases(game); const r = breakPane(W, game, flush);
    return { rel, r, stats: { ...SHARD_STATS } };
  });
  const plated = on.rel.filter(x => x.plates.length > 0 && x.f.kind !== 'sheet');
  const bad: string[] = []; let nPlates = 0, nCut = 0, planes = 0, maxPlanes = 0, corners = 0, worstArea = 0, split = 0, pointed = 0;
  for (const { f, plates } of plated) {
    const n: Vec3 = v3.normalize(f.normal); const t0: Vec3 = v3.normalize(v3.cross(Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], n)); const b0: Vec3 = v3.cross(n, t0);
    const O: [number, number][] = f.outline.map((p: Vec3) => { const d = v3.sub(p, f.centre); return [v3.dot(d, t0), v3.dot(d, b0)] as [number, number]; });
    const cellArea = polyArea(O); const eps = 2e-4; const halfT = Math.max(0.004, f.thickness / 2);
    const inCell = (q: [number, number]) => { for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length]; if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) < -eps * Math.hypot(b[0] - a[0], b[1] - a[1])) return false; } return true; };
    let area = 0; if (plates.length > 1) split++;
    for (const pl of plates) {
      nPlates++; if (pl.cut) { nCut++; planes += pl.cut.length; maxPlanes = Math.max(maxPlanes, pl.cut.length); }
      if (!pl.poly) { bad.push(`a plate of fragment ${f.seed} carries no outline`); continue; }
      area += polyArea(pl.poly); corners += pl.poly.length;
      if (pl.cut && (pl.cut.length > MAX_CUT_PLANES || pl.cut.some((c: any) => Math.abs(Math.hypot(c.n[0], c.n[1], c.n[2]) - 1) > 1e-6 || Math.abs(c.n[2]) > 1e-9))) bad.push(`fragment ${f.seed}: a record with > ${MAX_CUT_PLANES} planes, a non-unit normal or a plane not across the plate`);
      if (Math.abs(pl.h[2] - halfT) > 1e-9) bad.push(`fragment ${f.seed}: plate ${pl.h[2]} thick, the pane is ${halfT}`);
      // every corner of the plate's SOLID (what the picture and the rays get) is inside the cell
      const verts = cutVerts(pl.h, pl.cut);
      for (const lv of verts) { const w = v3.add(pl.c, quat.rotate(pl.rot as any, lv)); const d = v3.sub(w, f.centre); const q: [number, number] = [v3.dot(d, t0), v3.dot(d, b0)]; const dn = v3.dot(d, n) - 0.02;
        if (!inCell(q) || Math.abs(dn) > halfT + eps) { bad.push(`fragment ${f.seed}: a plate corner lies outside its cell (${q.map(x => x.toFixed(4))}, ${dn.toFixed(4)} off the plane)`); break; } }
      // sharp corners: an interior angle under 60° somewhere = pointed
      const P = pl.poly; let sharp = false; for (let i = 0; i < P.length; i++) { const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length]; const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1]; const cs = (ux * vx + uy * vy) / Math.max(1e-12, Math.hypot(ux, uy) * Math.hypot(vx, vy)); if (cs > 0.5) sharp = true; }
      if (sharp) pointed++;
    }
    // every corner of the cell is on one of its plates
    for (const p of f.outline) { const w = v3.mad(p, n, 0.02); if (!plates.some(pl => cutContains(pl.h, pl.cut, quat.rotate(conj(pl.rot), v3.sub(w, pl.c)) as Vec3, eps))) { bad.push(`fragment ${f.seed}: a corner of the cell is on no plate`); break; } }
    worstArea = Math.max(worstArea, Math.abs(area - cellArea) / cellArea);
  }
  F.verdict(plated.length >= 4 && nCut >= 3 && bad.length === 0 && worstArea < 0.01 + (on.stats.cutDropped ? 0.05 : 0),
    'every plated piece is its cell: cell corners on a plate, plate corners inside the cell, the plates\' area the cell\'s; records ≤ 8 unit planes across the plate',
    `${plated.length} plated fragments → ${nPlates} plates (${nCut} with a record, ${nPlates - nCut} whose cell was its own rectangle), ${(planes / Math.max(1, nCut)).toFixed(1)} planes a record (most ${maxPlanes}), ${(corners / Math.max(1, nPlates)).toFixed(1)} corners a plate, ${pointed} with a corner under 60°, ${split} cells left in two, ${on.stats.cutDropped} edges left out, worst area error ${(100 * worstArea).toFixed(2)} %${bad.length ? ' · ' + bad.slice(0, 4).join(' · ') : ''}`);
  const all = plated.flatMap(x => x.plates);
  F.verdict(all.length > 0 && all.every(pl => (pl.flags & BoxFlag.NoShadow) && (pl.flags & BoxFlag.Dynamic) && pl.rough === 0.05 && pl.contact === SHARDS.contact), 'still glass: clear (no shadow, no ray), polished, sliding on a floor like glass', `${all.length} plates checked`);
  const share = Math.max(2, Math.floor(on.cap * SHARDS.plateShare)); const offPlates = off.rel.reduce((a, x) => a + (x.f.kind !== 'sheet' ? x.plates.length : 0), 0);
  F.verdict(on.r.peak <= on.cap && on.r.peakGlass <= share && nPlates <= offPlates && on.stats.fragments === off.stats.fragments && off.rel.every(x => x.plates.every(pl => !pl.cut && !pl.poly)),
    'inside the pool: never over its cap nor glass\'s share of it, and never more plates than the rectangles made of the same fragments (switch off: no plate carries a record)',
    `switch on: ${on.stats.fragments} fragments → ${nPlates} plates, pool peak ${on.r.peak}/${on.cap}, glass peak ${on.r.peakGlass}/${share}, ${on.stats.platesRefused} refused · switch off: ${off.stats.fragments} fragments → ${offPlates} rectangles, pool peak ${off.r.peak}`);
  return F.done();
}

// ================================================================ breaking again, resting, the helpers
export async function cutglassBreak() {
  const F = family('cutglass-break: a cut plate that lands hard breaks into cut children; a twelve-sided cell leaves in two; the helpers');
  // ---- the polygon helpers
  { const hex: [number, number][] = Array.from({ length: 6 }, (_, i) => [0.2 * Math.cos(i * Math.PI / 3), 0.15 * Math.sin(i * Math.PI / 3)]);
    const a = clipHalf(hex, 0.8, 0.6, 0.03), b = clipHalf(hex, -0.8, -0.6, -0.03); const none = clipHalf(hex, 1, 0, -1), whole = clipHalf(hex, 1, 0, 1);
    F.verdict(Math.abs(polyArea(a) + polyArea(b) - polyArea(hex)) < 1e-12 && a.length >= 3 && b.length >= 3 && none.length === 0 && Math.abs(polyArea(whole) - polyArea(hex)) < 1e-12,
      'a line cuts an outline into two that add up to it; a line that misses takes nothing / everything', `hexagon ${(polyArea(hex) * 1e4).toFixed(1)} cm² = ${(polyArea(a) * 1e4).toFixed(1)} + ${(polyArea(b) * 1e4).toFixed(1)}; ${a.length} and ${b.length} corners`); }
  await withCut(true, async () => {
    const { W, game, flush } = await stage(9302); const D = game.destr.debris; const S = game.shards;
    const outl = (pts: [number, number][], at: Vec3) => pts.map(p => [at[0] + p[0], at[1] + p[1], at[2]] as Vec3);
    const frag = (pts: [number, number][], at: Vec3, vel: Vec3, seed: number) => ({ pane: -1, type: 'annealed', kind: 'piece', outline: outl(pts, at), centre: at.slice(), normal: [0, 0, 1], thickness: 0.006, area: polyArea(pts), velocity: vel, spin: [2, 0.5, -1.5], tint: [0.72, 0.8, 0.82], grain: 0, cause: 'support', who: 1, seed });
    // ---- a twelve-sided cell: more edges than a record holds → two halves, each whole
    const twelve: [number, number][] = Array.from({ length: 12 }, (_, i) => [0.22 * Math.cos(i * Math.PI / 6 + 0.2), 0.16 * Math.sin(i * Math.PI / 6 + 0.2)]);
    resetStats(); S.release(frag(twelve, [OPEN[0] - 3, 0.5, OPEN[2]], [0, 0, 0.2], 501)); flush();
    const t = D.list.filter((c: any) => c.glass); const tArea = t.reduce((a: number, c: any) => a + polyArea(c.glass.poly), 0);
    F.verdict(t.length === 2 && SHARD_STATS.cutSplit === 1 && SHARD_STATS.cutDropped === 0 && Math.abs(tArea - polyArea(twelve)) < 1e-9 && t.every((c: any) => c.box.cut && c.box.cut.length <= MAX_CUT_PLANES),
      'a cell with more edges than a record holds leaves as two halves that add up to it, nothing rounded off', `12 corners, ${(polyArea(twelve) * 1e4).toFixed(0)} cm² → ${t.length} plates of ${t.map((c: any) => `${c.glass.poly.length} corners / ${c.box.cut?.length} planes`).join(' and ')}, ${(tArea * 1e4).toFixed(0)} cm²`);
    game.clearAftermath(); W.step(DT); flush();
    // ---- pentagons thrown down hard on open floor: they break (≥ shatterV1), the children are cut, everything rests
    resetStats(); const penta: [number, number][] = [[-0.2, -0.12], [0.16, -0.16], [0.26, 0.02], [0.02, 0.2], [-0.22, 0.08]]; const parents: any[] = []; const seen = new Set<any>(); const kids: any[] = [];
    for (let i = 0; i < 6; i++) { const p0 = new Set(D.list); S.release(frag(penta, [OPEN[0] + (i - 2.5) * 0.9, OPEN[1], OPEN[2]], [0, -5, 0.3], 601 + i)); for (const c of D.list) if (c.glass && !p0.has(c)) { parents.push({ c, area: c.glass.area, hz: c.box.h[2] }); seen.add(c); } }
    const crumbs: any[] = []; let genMax = 0, restAll = false;
    for (let f = 0; f < 60 * 12; f++) { W.step(DT); for (const e of flush()) if (e.kind === 'shard' && Math.abs(e.o.size - SHARDS.crumbSize) < 1e-9) crumbs.push(e);
      for (const c of D.list) if (c.glass && !seen.has(c)) { seen.add(c); kids.push({ c, gen: c.glass.gen, area: c.glass.area, poly: c.glass.poly, cut: c.box.cut, hz: c.box.h[2] }); genMax = Math.max(genMax, c.glass.gen); } }
    const glass = D.list.filter((c: any) => c.glass); restAll = glass.every((c: any) => c.rest);
    const kidArea = kids.filter(k => k.gen === 1).reduce((a, k) => a + k.area, 0), parArea = parents.reduce((a, p) => a + p.area, 0);
    const finite = glass.every((c: any) => c.box.c.every(Number.isFinite) && c.box.h.every(Number.isFinite) && c.box.rot.every(Number.isFinite) && c.box.c[1] > -0.01);
    F.verdict(SHARD_STATS.breaks >= 4 && kids.length >= 6 && kids.every(k => k.poly && k.poly.length >= 3 && (!k.cut || k.cut.length <= MAX_CUT_PLANES) && Math.abs(k.hz - parents[0].hz) < 1e-12) && kids.filter(k => k.cut).length >= kids.length * 0.8 && kidArea < parArea && genMax <= SHARDS.maxGen,
      'plates that land hard break into CUT children: each its own outline and record, as thick as the pane, less glass than the parents, never past generation 2', `${parents.length} pentagons at 5 m/s: ${SHARD_STATS.breaks} breaks → ${kids.length} children (${kids.filter(k => k.cut).length} with a record, ${kids.map(k => k.poly?.length).join('')} corners), first generation ${(kidArea * 1e4).toFixed(0)} cm² of the parents' ${(parArea * 1e4).toFixed(0)}, deepest generation ${genMax}`);
    // the crumbs a resting cut plate sheds lie round ITS outline (inside 1.08 × + the jitter), not round its bounding rectangle's corners
    let far = 0; for (const e of crumbs) { let best = 1e9; for (const c of glass) { const m = c.glass; if (!m.poly) continue; const l = quat.rotate(conj(c.box.rot), v3.sub(e.pos, c.box.c)); let out = -1e9; const P = m.poly; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const ex = b[0] - a[0], ey = b[1] - a[1]; const L = Math.hypot(ex, ey) || 1; out = Math.max(out, ((l[0] - a[0]) * ey - (l[1] - a[1]) * ex) / L); } best = Math.min(best, Math.max(out, Math.abs(l[2]) - 0.05)); } if (best > 0.035) far++; }
    F.verdict(restAll && finite && glass.length > 0 && crumbs.length > 0 && far === 0, 'everything comes to rest on the floor, finite; the rest crumbs lie along the plates\' real outlines', `${glass.length} plates at rest, ${crumbs.length} crumb records, ${far} further than 3.5 cm outside every outline`);
  });
  return F.done();
}

// ================================================================ leaving the pool
export async function cutglassGone() {
  const F = family('cutglass-gone: a plate the pool drops goes as grains of its own glass (switch on); as nothing, as it was (switch off)');
  const run = (on: boolean) => withCut(on, async () => {
    const { W, game, engine, flush } = await stage(9303); const D = game.destr.debris; const S = game.shards; resetStats();
    const sq: [number, number][] = [[-0.12, -0.1], [0.14, -0.08], [0.1, 0.12], [-0.1, 0.09]];
    for (let i = 0; i < 4; i++) S.release({ pane: -1, type: 'annealed', kind: 'piece', outline: sq.map(p => [OPEN[0] + i * 0.7 + p[0], 0.3 + p[1], OPEN[2]]), centre: [OPEN[0] + i * 0.7, 0.3, OPEN[2]], normal: [0, 0, 1], thickness: 0.006, area: polyArea(sq), velocity: [0, 0, 0.3], spin: [1, 0, 0], tint: [0.5, 0.8, 0.6], grain: 0, cause: 'support', who: 1, seed: 700 + i });
    for (let f = 0; f < 300; f++) { W.step(DT); flush(); }
    const glass0 = D.list.filter((c: any) => c.glass); const rest0 = glass0.filter((c: any) => c.rest).length; const where = glass0.map((c: any) => c.box.c.slice());
    engine.settings.debrisCap = Math.max(4, D.list.length);   // the pool is now exactly full
    const cr0 = SHARD_STATS.crumbled; const recs: any[] = [];
    for (let i = 0; i < 2; i++) { D.spawn('clutter', makeBox({ c: [OPEN[0] - 2 - i, 1.0, OPEN[2]], h: [0.05, 0.05, 0.05], yaw: 0, albedo: [0.3, 0.3, 0.3], flags: BoxFlag.Dynamic }), [0, 0, 0], [0, 0, 0], 1); recs.push(...flush().filter((e: any) => e.kind === 'shard')); }
    const gone = glass0.length - D.list.filter((c: any) => c.glass).length;
    const near = recs.filter(e => where.some((p: Vec3) => Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]) < 0.05)); const tinted = recs.every(e => Math.abs(e.o.color[0] - 0.5) < 1e-9 && Math.abs(e.o.color[1] - 0.8) < 1e-9);
    return { n: glass0.length, rest0, gone, recs: recs.length, born: recs.reduce((a, e) => a + e.count, 0), near: near.length, tinted, crumbled: SHARD_STATS.crumbled - cr0, len: D.list.length, cap: D.cap(), evicted: D.stats.evicted };
  });
  const a = await run(true), b = await run(false);
  F.verdict(a.n >= 4 && a.rest0 === a.n && a.gone === 2 && a.recs === 2 && a.near === 2 && a.tinted && a.born >= 6 && a.crumbled === 2 && a.len <= a.cap,
    'switch on: each plate evicted at rest leaves a record of grains where it lay, in its own tint; the pool stays at its cap', `${a.n} plates at rest, pool full (${a.len}/${a.cap}); 2 chunks spawned → ${a.gone} plates evicted → ${a.recs} records, ${a.born} grains, ${a.near} at a plate's place`);
  F.verdict(b.gone === 2 && b.recs === 0 && b.crumbled === 0, 'switch off: the evicted plates vanish as they always did (no record, no count)', `${b.gone} plates evicted → ${b.recs} records`);
  return F.done();
}

// ================================================================ the seeded volley (any checkout: `root`), for determinism and the switch-off identity
const VOLLEY = [[7.4, 1.3, 10], [7.42, 1.31, 10], [6.3, 1.0, 10], [7.9, 0.7, 10], [8.8, 1.5, 10], [6.6, 1.6, 10], [7.1, 0.5, 10], [8.9, 1.52, 10], [9.3, 0.9, 10], [7.6, 1.9, 10]];
// ================================================================ the look
export async function cutglassLook() {
  const F = family('cutglass-look: a cut plate is drawn as glass — dark polished faces that are seen through, a pale edge — and with the look knobs at zero it is the plate as it first went in');
  const lum = (a: number[]) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  const take = async () => withCut(true, async () => { const { W, game, flush } = await stage(9301); const rel = watchReleases(game); breakPane(W, game, flush);
    const made = rel.flatMap(x => x.plates).filter((p: any) => p.cut); const lying = game.destr.debris.list.filter((c: any) => c.glass && c.rest && c.box.cut);
    return { made, lying: lying.map((c: any) => ({ albedo: c.box.albedo.slice(), glassLook: c.box.cutGlass })) }; });
  const A = await take();
  const okA = A.made.length >= 3 && A.made.every((p: any) => p.core && p.core.every((x: number) => x >= 0.7) && p.glassLook && p.glassLook.see === SHARDS.cutSee && p.glassLook.rim === SHARDS.cutRim && p.glassLook.anim === SHARDS.cutAnim
    && lum(p.albedo) < 0.15 && p.rough === 0.05 && (p.flags & BoxFlag.NoShadow) !== 0);
  F.verdict(okA && SHARDS.cutSee > 0 && SHARDS.cutRim > 0 && SHARDS.cutEdge > 0 && SHARDS.cutBody > 0, 'as shipped every cut plate carries the glass look: a pale edge colour, see-through faces inside a rim, a dark polished body, no shadow',
    `${A.made.length} cut plates · see ${SHARDS.cutSee} rim ${SHARDS.cutRim} px anim ${SHARDS.cutAnim} · body luminance ≤ ${Math.max(...A.made.map((p: any) => lum(p.albedo))).toFixed(3)} · edge e.g. ${(A.made[0] as any)?.core?.map((x: number) => x.toFixed(2))}`);
  const airLum = Math.max(...A.made.map((p: any) => lum(p.albedo)));
  F.verdict(A.lying.length > 0 && SHARDS.cutSeeRest > 0 && SHARDS.cutSeeRest < SHARDS.cutSee && SHARDS.cutRestBody > 0 && A.lying.every((c: any) => c.glassLook && c.glassLook.see === SHARDS.cutSeeRest && c.glassLook.rim === SHARDS.cutRim && lum(c.albedo) > airLum + 0.05 && lum(c.albedo) < 0.5),
    'a plate that has come to rest has more body than one in the air: fewer of its pixels left to the floor, the rest a pale sheen (not the floor\'s colour, not opaque)', `${A.lying.length} cut plates at rest · see ${SHARDS.cutSeeRest} (in the air ${SHARDS.cutSee}) · body luminance ${Math.min(1, ...A.lying.map((c: any) => lum(c.albedo))).toFixed(3)}‥${Math.max(0, ...A.lying.map((c: any) => lum(c.albedo))).toFixed(3)} (in the air ≤ ${airLum.toFixed(3)})`);
  const was = { cutEdge: SHARDS.cutEdge, cutSee: SHARDS.cutSee, cutRim: SHARDS.cutRim, cutBody: SHARDS.cutBody, cutSeeRest: SHARDS.cutSeeRest, cutRestBody: SHARDS.cutRestBody };
  let R0; try { Object.assign(SHARDS, { cutSeeRest: 0, cutRestBody: 0 }); R0 = await take(); } finally { Object.assign(SHARDS, was); }
  F.verdict(R0.lying.length > 0 && R0.lying.every((c: any) => c.glassLook && c.glassLook.see === SHARDS.cutSee && lum(c.albedo) < 0.15), 'the two rest knobs at zero: a resting plate looks as it did in the air (the look before the rest pass)', `${R0.lying.length} at rest · see ${SHARDS.cutSee} · body luminance ≤ ${Math.max(0, ...R0.lying.map((c: any) => lum(c.albedo))).toFixed(3)}`);
  let Z; try { Object.assign(SHARDS, { cutEdge: 0, cutSee: 0, cutRim: 0, cutBody: 0 }); Z = await take(); } finally { Object.assign(SHARDS, was); }
  F.verdict(Z.made.length === A.made.length && Z.made.every((p: any) => !p.core && !p.glassLook && lum(p.albedo) > 0.15), 'the four look knobs at zero: no edge colour, no glass record, the face in the colour of what is under it (the first cut plates) — and the same plates',
    `${Z.made.length} cut plates · body luminance ≥ ${Math.min(...Z.made.map((p: any) => lum(p.albedo))).toFixed(3)}`);
  try { Object.assign(SHARDS, { cutSee: 0 }); Z = await take(); } finally { Object.assign(SHARDS, was); }
  F.verdict(Z.made.every((p: any) => p.glassLook && p.glassLook.see === 0 && lum(p.albedo) < 0.15) && Z.lying.length > 0 && Z.lying.every((c: any) => lum(c.albedo) > Math.max(...Z.made.map((p: any) => lum(p.albedo))) + 0.01), 'opaque faces (see 0): dark in the air, and at rest the colour of the floor under the plate through the tint (lighter than its body in the air)',
    `${Z.lying.length} at rest · body luminance at rest ≥ ${Math.min(1, ...Z.lying.map((c: any) => lum(c.albedo))).toFixed(3)}`);
  // the record's last row as the cut pass decodes it (gbuffer_cut.wgsl): 1 = a plain core colour exactly, as before glass existed
  const dst = new Float32Array(CM.CUT_STRIDE * 4); const q = CM.CUT_ROWS * 4 + 3; const pl = [{ n: [1, 0, 0] as Vec3, d: 0.1 }];
  CM.packCut(pl, dst, 0); const w0 = dst[q]; CM.packCut(pl, dst, 0, [0.5, 0.5, 0.5]); const w1 = dst[q]; CM.packCut(pl, dst, 0, [0.5, 0.5, 0.5], { see: 0.7, rim: 1.25, anim: true }); const w2 = dst[q]; CM.packCut(pl, dst, 0, undefined, { see: 2, rim: 9 }); const w3 = dst[q];
  F.verdict(w0 === 0 && w1 === 1 && Math.floor(w2) === 1 + 2 + 4 + 8 * 5 && Math.abs(w2 - Math.floor(w2) - 0.7) < 1e-4 && Math.floor(w3) === 2 + 8 * 15 && Math.abs(w3 - Math.floor(w3) - 0.98) < 1e-4,
    'the record: no core = 0, a core colour = 1 exactly (as before), glass = + 2, + 4 stepping, + 8 × the rim in quarter pixels, the see-through share as the fraction (clamped)', `w = ${w0} · ${w1} · ${w2.toFixed(4)} · ${w3.toFixed(4)}`);
  return F.done();
}
export async function volley(root: string, seed: number, cut: boolean) {
  const H = await import(`${root}/tools/qa/headless.ts`); const V = await import(`${root}/src/math/vec.ts`); void V;
  const { fireWeapon } = await import(`${root}/src/game/combat.ts`); const { WEAPONS } = await import(`${root}/src/game/weapons.ts`); const PMr = await import(`${root}/src/render/particles.ts`);
  const { digestGame } = await import(`${root}/src/game/digest.ts`); const { tread } = await import(`${root}/src/game/floor.ts`);
  let C: any = null; try { C = await import(`${root}/src/scene/cut.ts`); } catch { /* the base build: no cut boxes at all */ }
  const was = C ? C.cutConfig.on : false; const unpin = pinEnv(cut); if (C) C.cutConfig.on = cut;
  try {
    Math.random = seeded(seed);
    const W = await H.standUp(); const { game, engine } = W;
    engine.particles = new PMr.Particles(H.fake('device'), H.fake('sceneLayout')); engine.settings.gpuParticles = true;
    game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = 0.5; game.tune.glassBreak = true; game.tune.glassShards = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; });
    game.teleportPlayer([8.3, 0, 11.6]); game.player.char.bodyYaw = game.player.char.aimYaw = Math.PI; game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
    W.step(DT); W.step(DT);
    W.audioLog = []; const P = engine.particles; const p2 = (p: number[]) => p.map(x => x.toFixed(2)).join(',');
    const events: string[] = [], emits: string[] = [], rounds: string[] = []; const seen = new WeakSet<any>(); let peak = 0, peakGlass = 0;
    for (let f = 0; f < 60 * 10; f++) {
      if (f < 300 && f % 10 === 0) { const r = fireWeapon(game, game.player.char, VOLLEY[(f / 10) % VOLLEY.length], true, { weapon: WEAPONS.fn2000 }); rounds.push(`${f}:${r?.hit ?? ''}`); }
      if (f === 330) game.events.push({ kind: 'bang', pos: [10.2, 0.4, 10.9], time: game.time, loud: true, who: 0 });
      if (f >= 400 && f % 20 === 0) events.push(`tread@${f}:${tread(game, [7.5 + ((f / 20) % 5) * 0.4 - 0.8, 0, 9.6], 0.3, true).toFixed(4)}`);
      W.step(DT);
      for (const e of P.pending) emits.push(`${f}:${e.kind}:${e.count}:${p2(e.pos)}:${e.seed}:${JSON.stringify(e.o)}`); P.pending.length = 0;
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); events.push(`${e.kind}@${f}:${e.level ?? ''}:${e.pos ? p2(e.pos) : ''}:${e.who ?? ''}`); }
      const L = game.destr.debris.list; peak = Math.max(peak, L.length); let ng = 0; for (const c of L) if (c.glass) ng++; peakGlass = Math.max(peakGlass, ng);
    }
    const audio = W.audioLog!.map((a: any) => `${a.name}@${a.t.toFixed(3)}:${a.pos ? p2(a.pos) : ''}:${a.gain.toFixed(3)}:${JSON.stringify(a.opts ?? null)}`);
    const L = game.destr.debris.list;
    const debris = L.map((c: any) => `${c.kind}:${p2(c.box.c)}:${c.rest}:${p2(c.box.h)}:${p2(c.box.albedo)}:${c.box.flags}`);
    const cuts = L.map((c: any) => c.box.cut ? c.box.cut.map((k: any) => `${k.n.map((x: number) => x.toFixed(5))}:${k.d.toFixed(5)}`).join('|') : '-');
    return { digest: hash(JSON.stringify(digestGame(game, true))), rounds: hash(rounds.join()), events: hash(events.join()), nEvents: events.length, audio: hash(audio.join()), nAudio: audio.length, emits: hash(emits.join()), nEmits: emits.length,
      debris: hash(debris.join()), nDebris: debris.length, cuts: hash(cuts.join()), nCut: L.filter((c: any) => c.box.cut).length, nPoly: L.filter((c: any) => c.glass?.poly).length, nGlass: L.filter((c: any) => c.glass).length, peak, peakGlass, cap: game.destr.debris.cap() };
  } finally { if (C) C.cutConfig.on = was; unpin(); }
}
const line = (r: any) => `digest ${r.digest} · rounds ${r.rounds} · events ${r.events} (${r.nEvents}) · audio ${r.audio} (${r.nAudio}) · emits ${r.emits} (${r.nEmits}) · debris ${r.debris} (${r.nDebris}, ${r.nGlass} glass, ${r.nCut} cut)`;
const same = (a: any, b: any, keys = ['digest', 'rounds', 'events', 'audio', 'emits', 'debris']) => keys.every(k => a[k] === b[k]);

export async function cutglassDeterminism() {
  const F = family('cutglass-determinism: the seeded volley twice with the cut switch on is one run');
  const a = await volley(ROOT, 4201, true), b = await volley(ROOT, 4201, true);
  F.verdict(same(a, b, ['digest', 'rounds', 'events', 'audio', 'emits', 'debris', 'cuts']) && a.nCut > 0 && a.peak <= a.cap, 'two runs of the seeded volley agree on everything, the cut records included; the pool inside its cap', `${line(a)} · cuts ${a.cuts} · pool peak ${a.peak}/${a.cap}, glass peak ${a.peakGlass}`);
  return F.done();
}
export async function cutglassOff() {
  const F = family('cutglass-off: the cut switch off = the rectangles (and, with CUTGLASS_BASE, the base build run for run)');
  resetStats(); const off = await volley(ROOT, 4201, false); const st = { ...SHARD_STATS };
  F.verdict(off.nCut === 0 && off.nPoly === 0 && st.cutPlates === 0 && st.cutSplit === 0 && st.cutDropped === 0 && off.nGlass > 0, 'switch off: no plate carries a record or an outline, the cut counters stay at zero', `${line(off)}`);
  const on = await volley(ROOT, 4201, true);
  F.verdict(on.nCut > 0 && on.rounds === off.rounds, 'the switch is live: the same volley with it on makes cut plates (the fracture itself — the rounds, what they hit — is the same)', `${line(on)}`);
  const base = process.env.CUTGLASS_BASE;
  if (base) { const b = await volley(base, 4201, false); F.verdict(same(off, b), `switch off is the base build (${base}) run for run: digest, rounds, events, audio, particle records, debris`, `base: ${line(b)}`); }
  else console.log('    (CUTGLASS_BASE not set: the cross-build identity was not run — CUTGLASS_BASE=<a checkout of the base build> bun run tools/qa/probes.ts cutglass-off)');
  return F.done();
}
