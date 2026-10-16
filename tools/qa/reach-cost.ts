// What re-deciding the lights' reach masks costs after a wall opens (Game.reachChanged + Game.reachTick), level by level, and whether a changed tick
// leaves the SAME masks as the tick it replaced.
//
//   bun run tools/qa/reach-cost.ts                         every loud level: blast up to --blasts partitions, time the call that queues and every tick after it
//     --levels depot,block,warehouse,block-squads,office   which levels
//     --blasts 6                                           partitions blasted per level
//     --dump <file.json>                                   every light's mask after every blast has settled (and each tick's count) → a file;  then on another
//                                                          checkout:  --against <file.json>  → exit 1 if a mask differs once the queue has drained
//   Each row: the blast, lights queued (point / directional), reachChanged's own ms, then per tick: ms (of which buildDirReach), lights taken.
// Headless: the masks are CPU work only (render/reach.ts), so the numbers are this box's, the equality is exact.
import { standUp, ROOT } from './headless.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { reachLevel, reachMaskFor, reachOneSource, REACH_WORK } = await import(`${ROOT}/src/render/reach.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);

type Vec3 = [number, number, number];
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const LEVELS = arg('--levels', 'depot,block,warehouse,block-squads,office').split(','), BLASTS = +arg('--blasts', '6');
const DUMP = arg('--dump', ''), AGAINST = arg('--against', '');
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);

const out: Record<string, { blast: number; masks: string[]; ticks: number }[]> = {};
const worst = { tick: 0, changed: 0, dir: 0 }; const top: { ms: number; at: string; took: number; cells: number; dir: number }[] = []; let fullBad = 0, fullCells = 0, mixed = 0, sumTick = 0, nTick = 0, over2 = 0;
for (const level of LEVELS) {
  Math.random = seeded(7); DESTRUCTION.on = true;
  const lv = level === 'office' ? undefined : loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8')));
  const W = await standUp(lv ? { level: lv } : {}); const { game, engine } = W as any;
  game.godMode = true; game.aiEnabled = false; game.tune.chaos = 0.5;
  for (let i = 0; i < 3; i++) W.step(DT);
  // clocks on the three calls (the instance's own methods; nothing of the game edited)
  let tDir = 0, nDir = 0; const dir0 = game.buildDirReach.bind(game);
  game.buildDirReach = (l: any, only?: any) => { const t = performance.now(); dir0(l, only); tDir += performance.now() - t; nDir++; };
  const walls = game.destr.walls.all().filter((w: any) => w.kind === 'wall' && Math.max(w.box.h[0], w.box.h[2]) >= 1.6);
  console.log(`\n=== ${level}: ${engine.world.statics.length} statics, ${engine.lights.lights.length} lights, ${walls.length} partitions ===`);
  out[level] = []; let done = 0; const fields0 = REACH_WORK.fields ?? 0;
  for (const w of walls) {
    if (done >= BLASTS) break;
    const b = w.box, alongX = b.h[0] >= b.h[2];
    const at: Vec3 = alongX ? [b.c[0], 0.3, b.c[2] + 0.3] : [b.c[0] + 0.3, 0.3, b.c[2]];
    // (the raster read, timed where it runs: on the blast under ?reachpace=old / TPS_BLASTPACE=old, else inside a later tick — BLAST_PACE only notes the rect on the blast)
    const G = game as any; let tCh = 0, queued = 0, read = false;
    G.reachRead = (r: any) => { const t = performance.now(); const n = Object.getPrototypeOf(G).reachRead.call(G, r); tCh += performance.now() - t; queued += n; read = true; return n; };
    const res = game.destr.blast(at, { who: PLAYER_ID });
    if (!res.walls) { delete G.reachRead; continue; }
    done++;
    const q: any[] = (game as any).reachQueue; let qDir = q.filter(x => x.l.kind === 2).length;
    const ticks: string[] = []; let nt = 0;
    while (game.reachPending) {
      tDir = 0; nDir = 0; read = false; const c0 = REACH_WORK.cells, held = G.reachHeld.length; const t = performance.now(); const took = game.reachTick(); const ms = performance.now() - t;
      if (read || (held && !took && REACH_WORK.cells === c0)) continue;   // (a tick that waited on a noted change, or read the raster — that one's time is reachChanged's: not a tick of masks)
      nt++;
      qDir = Math.max(qDir, q.filter(x => x.l.kind === 2).length + nDir);
      top.push({ ms, at: `${level} blast ${done} tick ${nt}`, took, cells: REACH_WORK.cells - c0, dir: tDir });
      worst.tick = Math.max(worst.tick, ms); worst.dir = Math.max(worst.dir, tDir); sumTick += ms; nTick++; if (ms > 2) over2++;
      if (ticks.length < 6) ticks.push(`${f2(ms)}${nDir ? `(dir ${f2(tDir)})` : ''}×${took}`);
    }
    delete G.reachRead;
    worst.changed = Math.max(worst.changed, tCh);
    console.log(`  blast ${done} @(${f2(at[0])},${f2(at[2])}) opened ${res.opened}: queued ${queued} (${qDir} dir) · reachChanged ${f2(tCh)} ms · ${nt} ticks: ${ticks.join(' ')}${nt > 6 ? ' …' : ''}`);
    // each point light's mask against one derived WHOLE from the raster as it now stands (cells inside the light's range: past it a mask keeps what it had)
    { const solid = (game as any).reachSolid, interior = (game as any).reachInterior; let cells = 0;
      for (const l of (game as any).reachLights as any[]) { if (!l.reach || (reachOneSource && !reachOneSource(l.reach)) || game.beacons.some((b: any) => b.light === l)) { mixed++; continue; }   // (a beacon's turning spot: no one set of source points, before or after)
        const full = reachMaskFor(solid, l.pos, l.kind === 3 || l.kind === 1 ? l.dir : [0, 0, 0], l.radius, interior);
        for (let ci = 0; ci < WORLD.gridW * WORLD.gridH; ci++) { const x = WORLD.min[0] + (ci % WORLD.gridW + 0.5) * WORLD.gridCell, z = WORLD.min[2] + (Math.floor(ci / WORLD.gridW) + 0.5) * WORLD.gridCell;
          if (Math.hypot(x - l.pos[0], z - l.pos[2]) > l.range + 1.5) continue; cells++;
          if (reachLevel(full, ci) !== reachLevel(l.reach, ci)) { fullBad++; if (fullBad < 8) console.log(`    DIFFERS from a whole re-derive: light @(${f2(l.pos[0])},${f2(l.pos[2])}) cell ${ci}: ${reachLevel(l.reach, ci)} vs whole ${reachLevel(full, ci)}`); } }
      }
      fullCells += cells; }
    const masks = engine.lights.lights.map((l: any) => { const m = l.kind === 2 ? l.reachDir : l.reach; return m ? Buffer.from(m.buffer, m.byteOffset, m.byteLength).toString('base64') : ''; });
    out[level].push({ blast: done, masks, ticks: nt });
    for (let i = 0; i < 2; i++) W.step(DT);
  }
  if (REACH_WORK.fields !== undefined) console.log(`  jump fields worked out after boot: ${REACH_WORK.fields - fields0 - 0} (blasts ${done})`);
}
console.log(`\nworst: reachTick ${f2(worst.tick)} ms (buildDirReach ${f2(worst.dir)} of a tick) · reachChanged ${f2(worst.changed)} ms · ${nTick} ticks, ${f2(sumTick)} ms in all, ${over2} over 2 ms`);
top.sort((a, b) => b.ms - a.ms); for (const t of top.slice(0, 8)) console.log(`  ${f2(t.ms)} ms · ${t.at} · ${t.took} lights, ${t.cells} cells decided${t.dir ? `, buildDirReach ${f2(t.dir)}` : ''}`);
{ const ms = top.map(t => t.ms).sort((a, b) => a - b); console.log(`  ticks: median ${f2(ms[ms.length >> 1])} · p90 ${f2(ms[Math.floor(ms.length * 0.9)])} · p99 ${f2(ms[Math.floor(ms.length * 0.99)])} ms`); }
console.log(`${fullBad ? 'FAIL' : 'PASS'} — every point light's mask after every blast equals a whole re-derive inside its range: ${fullCells} cells compared, ${fullBad} differ (${mixed} masks of turning spots left out)`);
if (fullBad) process.exitCode = 1;
if (DUMP) writeFileSync(DUMP, JSON.stringify(out));
if (AGAINST) {
  const ref = JSON.parse(readFileSync(AGAINST, 'utf8')); let bad = 0, n = 0;
  for (const lvl of Object.keys(out)) for (let i = 0; i < out[lvl].length; i++) {
    const a = out[lvl][i], b = ref[lvl]?.[i]; if (!b) { bad++; console.log(`  ${lvl} blast ${i + 1}: not in the reference`); continue; }
    for (let k = 0; k < Math.max(a.masks.length, b.masks.length); k++) { n++; if (a.masks[k] !== b.masks[k]) { bad++; if (bad < 12) console.log(`  ${lvl} blast ${i + 1} light ${k}: mask differs`); } }
  }
  console.log(`${bad ? 'FAIL' : 'PASS'} — ${n} masks compared against ${AGAINST}, ${bad} differ`);
  if (bad) process.exitCode = 1;
}
