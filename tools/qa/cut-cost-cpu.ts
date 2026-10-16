// CPU cost of cut boxes: two staged worst cases (tools/qa/cut-cost-recipes.js: a blown corridor with the debris pool full, a shot-out glass partition), each with the
// cut switch on and off — a CHILD PROCESS per state, so the switch is clean — timing game.update over the event, the box pack (BoxWorld.upload on the stub device)
// and the CPU rays through the final scene.
//   bun run tools/qa/cut-cost-cpu.ts [--reps 3] [--cases blast,glass] [--json out.json]      the table (medians over reps, on / off alternated)
//   CUTBOXES=1 bun run tools/qa/cut-cost-cpu.ts --child blast                                 one take, one JSON line
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const DT = 1 / 60;
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function child(which: string) {
  const { standUp, fake } = await import(`${ROOT}/tools/qa/headless.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
  const { cutConfig } = await import(`${ROOT}/src/scene/cut.ts`);
  const { BREAK_STATS } = await import(`${ROOT}/src/game/breakTable.ts`);
  const { WALL_STATS } = await import(`${ROOT}/src/game/wallbreak.ts`);
  const { SHARD_STATS } = await import(`${ROOT}/src/game/shards.ts`);
  const { GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
  const R: any = await import(`${ROOT}/tools/qa/cut-cost-recipes.js`);
  Math.random = mulberry32(4242);
  DESTRUCTION.on = true;                                   // the page's state (on unless ?nodestruction); headless.ts reads CUTBOXES=1|0 for the cut switch
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;   // the page has GPU particles: the emitters take that branch
  const pEmits: Record<string, number> = {}; let pRecs = 0, pCount = 0;
  { const P = engine.particles; const emit = P.emit.bind(P); P.emit = (kind: any, pos: any, dir: any, count: number, o: any) => { pRecs++; pCount += count; pEmits[kind] = (pEmits[kind] ?? 0) + count; return emit(kind, pos, dir, count, o); }; }
  // game.update timed alone (W.step also moves the camera, the lights and packs the boxes)
  const upd: number[] = []; let timing = false;
  { const u = game.update.bind(game); game.update = (...a: any[]) => { const t = performance.now(); const r = u(...a); if (timing) upd.push(performance.now() - t); return r; }; }
  const step = () => W.step(DT);
  for (let i = 0; i < 180; i++) step();                    // warm the JIT on a calm floor
  timing = true; for (let i = 0; i < 120; i++) step(); const calm = upd.splice(0);
  const res = which === 'blast' ? R.stageBlast(game, engine, step) : R.stageGlass(game, engine, step);
  const event = upd.splice(0);
  for (let i = 0; i < 120; i++) step(); const rest = upd.splice(0); timing = false;
  const counts = R.countScene(game, engine);

  // ---- the box pack: BoxWorld.upload() with the final list, as the frame loop calls it once a frame (engine.world.dynamics = game.dynBoxes; engine.world.upload())
  const world = engine.world; world.dynamics = game.dynBoxes;
  for (let i = 0; i < 50; i++) world.upload();
  const up: number[] = []; for (let i = 0; i < 200; i++) { const t = performance.now(); world.upload(); up.push(performance.now() - t); }
  // bytes one upload hands the queue (a counting device for one call), and the cut table's share of them
  let bytes = 0, cutBytes = 0, writes = 0; const dev0 = world.device;
  const cutBase = world.maxBoxes * 16 * 4;                 // the mat words end here: anything written at or past it on matBuf with the switch on is a table (marks only when dirty)
  world.device = { queue: { writeBuffer(buf: any, off: number, _d: any, _o: number, size: number) { writes++; bytes += size ?? 0; if (cutConfig.on && buf === world.matBuf && off >= cutBase) cutBytes += size ?? 0; } } };
  try { world.upload(); } catch (e) { console.error('counting upload failed: ' + e); }
  world.device = dev0;

  // ---- CPU rays through the final scene: the same 20 000 rays both states (own dice), origins in the event's room 0.05‥2 m up
  const box = which === 'blast' ? { x0: 13, x1: 26, z0: 8.5, z1: 13.7 } : { x0: 5.5, x1: 12.5, z0: 7, z1: 12 };
  const rnd = mulberry32(777); const N = 20000; const ro = new Float64Array(N * 3), rd = new Float64Array(N * 3), re = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) {
    ro[i * 3] = box.x0 + rnd() * (box.x1 - box.x0); ro[i * 3 + 1] = 0.05 + rnd() * 1.95; ro[i * 3 + 2] = box.z0 + rnd() * (box.z1 - box.z0);
    const a = rnd() * Math.PI * 2, y = (rnd() * 2 - 1) * 0.6 - 0.2, c = Math.sqrt(1 - Math.min(0.98, y * y)); rd[i * 3] = Math.cos(a) * c; rd[i * 3 + 1] = y; rd[i * 3 + 2] = Math.sin(a) * c;
    const L = Math.hypot(rd[i * 3], rd[i * 3 + 1], rd[i * 3 + 2]); rd[i * 3] /= L; rd[i * 3 + 1] /= L; rd[i * 3 + 2] /= L;
    re[i * 3] = box.x0 + rnd() * (box.x1 - box.x0); re[i * 3 + 1] = 0.05 + rnd() * 1.95; re[i * 3 + 2] = box.z0 + rnd() * (box.z1 - box.z0);
  }
  const time3 = (fn: () => number) => { const t: number[] = []; let hits = 0; for (let k = 0; k < 4; k++) { const t0 = performance.now(); hits = fn(); t.push(performance.now() - t0); } return { ms: med(t.slice(1)), hits }; };   // first lap = warm-up
  const o: [number, number, number] = [0, 0, 0], d: [number, number, number] = [0, 0, 0], e: [number, number, number] = [0, 0, 0];
  const lap = (fn: () => any) => () => { let h = 0; for (let i = 0; i < N; i++) { o[0] = ro[i * 3]; o[1] = ro[i * 3 + 1]; o[2] = ro[i * 3 + 2]; d[0] = rd[i * 3]; d[1] = rd[i * 3 + 1]; d[2] = rd[i * 3 + 2]; e[0] = re[i * 3]; e[1] = re[i * 3 + 1]; e[2] = re[i * 3 + 2]; if (fn()) h++; } return h; };
  const rays = {
    worldRaycast: time3(lap(() => world.raycast(o, d, 12))),                 // BoxWorld.raycast, default skips (NoShadow | NoPrimary): the aim ray / lasers — statics + dynamics
    worldRaycastAll: time3(lap(() => world.raycast(o, d, 12, 0))),           // nothing skipped: the NoShadow glass plates are tested too
    colRaycast: time3(lap(() => game.col.raycast(o, d, 12))),                // StaticCollision.raycast: rounds (statics + door leaves)
    segmentBlocked: time3(lap(() => game.col.segmentBlocked(o, e))),         // sight lines
    solidBlocked: time3(lap(() => game.col.solidBlocked(o, e))),             // sound / lines of fire
  };
  const out = {
    case: which, cut: cutConfig.on, recipe: res, counts,
    update: { calmMed: med(calm), eventFrames: event.length, eventMed: med(event), eventP95: pct(event, 0.95), eventMax: Math.max(...event), eventTotal: event.reduce((a, b) => a + b, 0), restMed: med(rest), restP95: pct(rest, 0.95) },
    upload: { med: med(up), p95: pct(up, 0.95), boxes: world.statics.length + world.dynamics.length, writes, bytes, cutBytes, visibleCut: world.visibleCutCount ?? 0 },
    rays, particles: { records: pRecs, count: pCount, byKind: pEmits },
    stats: { BREAK: { ...BREAK_STATS }, WALL: { ...WALL_STATS }, SHARD: { ...SHARD_STATS }, GB: { ...GB_STATS }, debris: { ...game.destr.debris.stats } },
  };
  console.log('CUTCOST ' + JSON.stringify(out));
  process.exit(0);
}

async function parent() {
  const reps = Number(arg('--reps', '3')); const cases = (arg('--cases', 'blast,glass') as string).split(',');
  const takes: any[] = [];
  for (const c of cases) for (let r = 0; r < reps; r++) for (const on of (r % 2 ? [false, true] : [true, false])) {
    const p = Bun.spawnSync(['bun', 'run', import.meta.path, '--child', c], { env: { ...process.env, CUTBOXES: on ? '1' : '0' }, stdout: 'pipe', stderr: 'pipe' });
    const line = p.stdout.toString().split('\n').find(l => l.startsWith('CUTCOST '));
    if (!line) { console.error(`${c} cut=${on} rep ${r}: no result (exit ${p.exitCode})\n${p.stderr.toString().slice(-1500)}`); process.exitCode = 1; continue; }
    takes.push(JSON.parse(line.slice(8))); console.error(`  ${c} cut=${on ? 'on ' : 'off'} rep ${r + 1}/${reps} done`);
  }
  const f = (x: number, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : '—');
  const rows: any[] = [];
  for (const c of cases) for (const on of [true, false]) {
    const T = takes.filter(t => t.case === c && t.cut === on); if (!T.length) continue; const m = (g: (t: any) => number) => med(T.map(g)); const t0 = T[0];
    rows.push({ case: c, cut: on, n: T.length, counts: t0.counts, recipe: t0.recipe, stats: t0.stats, particles: t0.particles,
      updCalm: m(t => t.update.calmMed), updMed: m(t => t.update.eventMed), updP95: m(t => t.update.eventP95), updMax: m(t => t.update.eventMax), updTotal: m(t => t.update.eventTotal), frames: t0.update.eventFrames, updRest: m(t => t.update.restMed),
      upMed: m(t => t.upload.med), upP95: m(t => t.upload.p95), boxes: t0.upload.boxes, bytes: t0.upload.bytes, cutBytes: t0.upload.cutBytes,
      rays: Object.fromEntries(Object.keys(t0.rays).map(k => [k, { ms: m(t => t.rays[k].ms), hits: t0.rays[k].hits }])) });
  }
  console.log('\n=== counts (first take of each state; the simulation is deterministic) ===');
  for (const r of rows) { const k = r.counts;
    console.log(`${r.case} cut ${r.cut ? 'ON ' : 'OFF'}: pool ${k.pieces}/${k.cap} ${JSON.stringify(k.kinds)} · pieces cut ${k.piecesCut} (${k.piecePlanes} planes) · statics ${k.statics} (${k.staticsCut} cut, ${k.staticPlanes} planes) · dyn boxes ${k.dynBoxes} (${k.dynCut} cut, ${k.dynPlanes} planes) · cut boxes ${k.cutBoxes}, planes ${k.planes}, hist ${JSON.stringify(k.planesHist)} · debris ${JSON.stringify(k.debrisStats)}`);
    console.log(`    particles asked: ${r.particles.count} in ${r.particles.records} records ${JSON.stringify(r.particles.byKind)}`);
    console.log(`    BREAK ${JSON.stringify(r.stats.BREAK)}\n    WALL ${JSON.stringify(r.stats.WALL)}\n    SHARD ${JSON.stringify(r.stats.SHARD)}\n    GB ${JSON.stringify(r.stats.GB)}`); }
  console.log(`\n=== CPU (medians of ${reps} takes a state, on / off alternated; ms) ===`);
  console.log('case  cut | update: calm  event-med  p95    max    total(frames)   at-rest | upload med  p95   boxes  bytes/frame (cut table) | 20k rays: world  world-all  col.raycast  segmentBlocked  solidBlocked');
  for (const r of rows) console.log(`${r.case.padEnd(5)} ${r.cut ? 'on ' : 'off'} |         ${f(r.updCalm)}  ${f(r.updMed)}      ${f(r.updP95)}  ${f(r.updMax, 2)}  ${f(r.updTotal, 1)} (${r.frames})   ${f(r.updRest)} | ${f(r.upMed)}       ${f(r.upP95)} ${r.boxes}   ${r.bytes} (${r.cutBytes}) | ${f(r.rays.worldRaycast.ms, 1)} [${r.rays.worldRaycast.hits}]  ${f(r.rays.worldRaycastAll.ms, 1)} [${r.rays.worldRaycastAll.hits}]  ${f(r.rays.colRaycast.ms, 1)} [${r.rays.colRaycast.hits}]  ${f(r.rays.segmentBlocked.ms, 1)} [${r.rays.segmentBlocked.hits}]  ${f(r.rays.solidBlocked.ms, 1)} [${r.rays.solidBlocked.hits}]`);
  const out = arg('--json'); if (out) { await Bun.write(out, JSON.stringify({ rows, takes }, null, 1)); console.log('\nwrote ' + out); }
}

if (process.argv.includes('--child')) await child(arg('--child') as string); else await parent();
