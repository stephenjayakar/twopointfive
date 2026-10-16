// bench.ts — the CPU-frame lane's headless bench (docs/internal/cpu-frame.md): the QA harness's Game stepped like main.ts (game.update → camera → lights → BoxWorld.upload)
// under a seeded key script that walks Sam about the office (the cursor at (800, 500), the laser tripwires live, guards + civilians on their rounds), timing every section
// per frame with performance.now() and the JS heap growth per frame with process.memoryUsage().heapTotal (JSC's heap capacity — up as a frame allocates, down when a GC ran; the
// negative frames are counted as GCs and dropped from the alloc row) — the same shape as Lane H's `__perf().sections` table.
//   bun run tools/cpu-frame/bench.ts [--frames 1200] [--warm 300] [--seed 1] [--json docs/perf/cpu-frame-<tag>.json] [--tag name] [--quiet]
// Percentiles are over the LAST --frames frames (the warm-up's cold JIT dropped); alloc frames whose delta is negative (a GC ran) are dropped from the alloc row and counted.
import { standUp, ROOT } from '../qa/headless.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const jsc: any = await import('bun:jsc');
const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const FRAMES = Number(opt('frames', '1200')), WARM = Number(opt('warm', '300')), SEED = Number(opt('seed', '1')), JSON_OUT = opt('json', ''), TAG = opt('tag', 'run'), QUIET = args.includes('--quiet');

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
Math.random = mulberry32(SEED * 7919 + 13);
const W = await standUp();
const { game, engine, input, cam, canvas } = W;
const rng = mulberry32(SEED * 104729 + 7);
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
let wanderUntil = 0;
const dt = 1 / 60;
const N = WARM + FRAMES;
const NN = N + 300; const tUpd = new Float64Array(NN), tUpl = new Float64Array(NN), tStep = new Float64Array(NN), alloc = new Float64Array(NN);
let gcFrames = 0;
const pct = (a: Float64Array, p: number) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const row = (a: Float64Array) => ({ p50: pct(a, 0.5), p90: pct(a, 0.9), p99: pct(a, 0.99), max: pct(a, 1), mean: a.reduce((x, y) => x + y, 0) / a.length });
let memPrev = process.memoryUsage().heapTotal;   // (JSC's heap capacity: grows as the frame allocates, drops when a GC ran — a per-frame delta is the frame's allocation; bun:jsc memoryUsage().current is the process's high-water mark and never shrinks)
function stepOnce(f: number) {
  // the key script: a random walk 1‥4 s a leg, sprint a third of the time, a crouch / turn press now and then — the soak's wander, without its stimuli
  if (game.time >= wanderUntil) { for (const k of [...MOVE, 'ShiftLeft']) input.keys.delete(k); const keys = [MOVE[Math.floor(rng() * 4)]]; if (rng() < 0.4) keys.push(MOVE[Math.floor(rng() * 4)]); if (rng() < 0.33) keys.push('ShiftLeft'); for (const k of keys) input.keys.add(k); wanderUntil = game.time + 1 + rng() * 3; if (rng() < 0.2) input.pressed.add('KeyC'); }
  if (f % 97 === 0) { input.mouseX = 600 + Math.floor(rng() * 400); input.mouseY = 350 + Math.floor(rng() * 300); }
  const t0 = performance.now();
  game.update(dt, input, cam, canvas);
  const t1 = performance.now();
  cam.update(dt, game.followPos(), game.aimPoint);
  engine.lights.update(dt, game.time);
  engine.world.dynamics = game.dynBoxes;
  const t2 = performance.now();
  engine.world.upload();
  const t3 = performance.now();
  input.endFrame();
  tUpd[f] = t1 - t0; tUpl[f] = t3 - t2; tStep[f] = t3 - t0;
  const mem = process.memoryUsage().heapTotal; const d = mem - memPrev; memPrev = mem;
  if (d < 0) { gcFrames++; alloc[f] = NaN; } else alloc[f] = d / 1024;
}
for (let f = 0; f < N; f++) stepOnce(f);
// ALLOCATION, measured properly: heapTotal only grows while the heap has no free blocks to hand out, so between GCs a churning frame can read 0 — here a FULL GC is forced before
// each window of ALLOC_WIN frames (it trims the capacity back to the live set), and the window's growth ÷ its frames is what those frames allocated (block-granular, so windows
// not single frames). 300 frames after the timed run, on the same key script.
const ALLOC_WIN = 10, ALLOC_WINDOWS = 30; const allocWin: number[] = [];
for (let w = 0; w < ALLOC_WINDOWS; w++) {
  Bun.gc(true); const h0 = process.memoryUsage().heapTotal;
  for (let k = 0; k < ALLOC_WIN; k++) stepOnce(N + w * ALLOC_WIN + k);
  allocWin.push((process.memoryUsage().heapTotal - h0) / 1024 / ALLOC_WIN);
}
const allocPer = Float64Array.from(allocWin);
const tail = (a: Float64Array) => a.subarray(WARM, N);
const allocTail = Float64Array.from(Array.from(tail(alloc)).filter(x => !Number.isNaN(x)));
const out = {
  tag: TAG, seed: SEED, frames: FRAMES, warm: WARM, when: new Date().toISOString(), commit: (() => { try { return Bun.spawnSync(['git', '-C', ROOT, 'rev-parse', '--short', 'HEAD']).stdout.toString().trim(); } catch { return '?'; } })(),
  update: row(tail(tUpd)), upload: row(tail(tUpl)), step: row(tail(tStep)),
  allocKB: row(allocTail), gcFrames, allocKBPerFrame: { mean: allocPer.reduce((x, y) => x + y, 0) / allocPer.length, min: pct(allocPer, 0), max: pct(allocPer, 1), windows: ALLOC_WINDOWS, frames: ALLOC_WIN }, boxes: { statics: engine.world.statics.length, all: engine.world.all.length }, guards: game.guards.length,
  heap: jsc.heapStats ? { objects: jsc.heapStats().objectCount, size: jsc.heapStats().heapSize } : null,
};
const fmt = (r: { p50: number; p90: number; p99: number; max: number; mean: number }) => `p50 ${r.p50.toFixed(3)}  p90 ${r.p90.toFixed(3)}  p99 ${r.p99.toFixed(3)}  max ${r.max.toFixed(3)}  mean ${r.mean.toFixed(3)}`;
if (!QUIET) {
  console.log(`cpu-frame bench · ${TAG} @ ${out.commit} · seed ${SEED} · ${FRAMES} frames after ${WARM} warm · ${out.boxes.statics} statics / ${out.boxes.all} boxes`);
  console.log(`  update  ms  ${fmt(out.update)}`);
  console.log(`  upload  ms  ${fmt(out.upload)}`);
  console.log(`  step    ms  ${fmt(out.step)}`);
  console.log(`  alloc   KB  ${fmt(out.allocKB)}  (${gcFrames} GC frames dropped; heapTotal growth between GCs — reads 0 while the heap has spare blocks)`);
  console.log(`  alloc/frame KB (full GC before each ${ALLOC_WIN}-frame window, ${ALLOC_WINDOWS} windows): mean ${out.allocKBPerFrame.mean.toFixed(1)}  min ${out.allocKBPerFrame.min.toFixed(1)}  max ${out.allocKBPerFrame.max.toFixed(1)}`);
}
if (JSON_OUT) { mkdirSync(dirname(JSON_OUT), { recursive: true }); writeFileSync(JSON_OUT, JSON.stringify(out, null, 1) + '\n'); if (!QUIET) console.log(`  → ${JSON_OUT}`); }
