// tables-hash.ts — BoxWorld.upload's TABLE BYTES, hashed per frame over a scripted 300-frame run (docs/internal/cpu-frame.md — the identity proof for the upload work):
// the QA harness's Game (seeded), Sam walking a key script, a door flung open then shut, a prop shoved, a static hidden the way destruction hides one (flags |= NoPrimary |
// NoShadow) and restored, a fixture's emissive and a marking gain written the way lighting.ts writes them, the markings switch flipped off and on — and after EVERY upload
// the geo / mat / mark-table / visible / grid (cellStart + items) / SceneInfo / capsule arrays hashed (FNV-1a over their u32 words, exactly the ranges upload writes to
// the GPU). Prints the per-region running hashes and one combined hash; `--json path` writes them; `--check path` compares against a written file and exits 1 on any
// difference (naming the first frame and region that differ). Same script + same seed → the same bytes on any build that packs the same tables.
//   bun run tools/cpu-frame/tables-hash.ts [--frames 300] [--seed 1] [--json docs/perf/cpu-frame-tables.json] [--check docs/perf/cpu-frame-tables.json]
import { standUp, ROOT } from '../qa/headless.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const FRAMES = Number(opt('frames', '300')), SEED = Number(opt('seed', '1')), JSON_OUT = opt('json', ''), CHECK = opt('check', '');

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
Math.random = mulberry32(SEED * 7919 + 13);
const W = await standUp();
const { game, engine, input, cam, canvas, level } = W;
const world = engine.world;
const rng = mulberry32(SEED * 104729 + 7);
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
let wanderUntil = 0;
const dt = 1 / 60;

/** FNV-1a over u32 words [a, b) of a typed array's buffer view — a running hash (h) carried across frames */
function fnv(h: number, u: Uint32Array, a: number, b: number): number { for (let i = a; i < b; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const regions = ['geo', 'mat', 'marks', 'visible', 'cells', 'items', 'info', 'caps'] as const;
type Region = typeof regions[number];
const H: Record<Region, number> = { geo: 2166136261, mat: 2166136261, marks: 2166136261, visible: 2166136261, cells: 2166136261, items: 2166136261, info: 2166136261, caps: 2166136261 };
const perFrame: { f: number; h: Record<Region, number> }[] = [];
const matU32 = new Uint32Array(world.matData.buffer), markU32 = new Uint32Array(world.markData.buffer), capU32 = world.capsuleU32 as Uint32Array;
function hashFrame(f: number) {
  const n = world.all.length;
  H.geo = fnv(H.geo, world.geoU32, 0, n * 8);
  H.mat = fnv(H.mat, matU32, 0, n * 16);
  H.marks = fnv(H.marks, markU32, 0, Math.max(1, world.markRows) * 4);
  H.visible = fnv(H.visible, world.visible, 0, world.visibleCount);
  H.cells = fnv(H.cells, world.cellStart, 0, world.cellStart.length);
  H.items = fnv(H.items, world.items, 0, 2 * world.itemCount);
  H.info = fnv(H.info, world.infoData, 0, world.infoData.length);
  H.caps = fnv(H.caps, capU32, 0, Math.max(8, world.capsuleCount * 8));
  perFrame.push({ f, h: { ...H } });
}
// the script's props: a door and a static to hide / relight, chosen deterministically
const door = game.doors.list[0];
const statics = world.statics as any[];
const hideIdx = statics.findIndex((b: any) => !(b.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass)) && b.h[1] < 0.05 && b.c[1] > 0.6 && b.c[1] < 1.2);   // a thin slab on a desk (a paper stack)
const fixIdx = statics.findIndex((b: any) => b.emissive[0] + b.emissive[1] + b.emissive[2] > 0);
const markIdx = statics.findIndex((b: any) => b.marks && b.marks.length);
const prop = level.props[0];
let hidFlags = 0, fixEm: number[] | null = null, markGainWas: number | undefined;
for (let f = 0; f < FRAMES; f++) {
  if (game.time >= wanderUntil) { for (const k of [...MOVE, 'ShiftLeft']) input.keys.delete(k); const keys = [MOVE[Math.floor(rng() * 4)]]; if (rng() < 0.4) keys.push(MOVE[Math.floor(rng() * 4)]); if (rng() < 0.33) keys.push('ShiftLeft'); for (const k of keys) input.keys.add(k); wanderUntil = game.time + 1 + rng() * 3; }
  if (f === 40 && door) door.vel = 4;                       // the leaf flung open…
  if (f === 130 && door) door.vel = -4;                     // …and slammed back
  if (f === 60 && prop) { game.teleportPlayer([prop.x - 0.9, 0, prop.z]); for (const k of MOVE) input.keys.delete(k); input.keys.add('KeyW'); wanderUntil = game.time + 2.5; }   // shoved: Sam walked into the first prop
  if (f === 150 && hideIdx >= 0) { hidFlags = statics[hideIdx].flags; statics[hideIdx].flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; }   // hidden as destruction hides a paper stack
  if (f === 230 && hideIdx >= 0) statics[hideIdx].flags = hidFlags;                                                                        // …and restored
  if (f === 170 && fixIdx >= 0) { fixEm = statics[fixIdx].emissive.slice(); statics[fixIdx].emissive[0] *= 0.5; statics[fixIdx].emissive[1] *= 0.5; statics[fixIdx].emissive[2] *= 0.5; }   // a fixture dimmed the way lighting.ts writes it
  if (f === 250 && fixEm) { statics[fixIdx].emissive[0] = fixEm[0]; statics[fixIdx].emissive[1] = fixEm[1]; statics[fixIdx].emissive[2] = fixEm[2]; }
  if (f === 180 && markIdx >= 0) { markGainWas = statics[markIdx].markGain; statics[markIdx].markGain = 0.3; }
  if (f === 240 && markIdx >= 0) statics[markIdx].markGain = markGainWas;
  if (f === 200) world.markingsEnabled = false;
  if (f === 220) world.markingsEnabled = true;
  if (f === 260) world.glassEnabled = false;
  if (f === 280) world.glassEnabled = true;
  game.update(dt, input, cam, canvas);
  cam.update(dt, game.followPos(), game.aimPoint);
  engine.lights.update(dt, game.time);
  world.dynamics = game.dynBoxes;
  world.upload();
  input.endFrame();
  hashFrame(f);
}
const combined = regions.reduce((h, r) => fnv(h, Uint32Array.of(H[r]), 0, 1), 2166136261 >>> 0);
const out = { seed: SEED, frames: FRAMES, statics: statics.length, script: { door: door?.def.name, hideIdx, fixIdx, markIdx, prop: prop ? [prop.x, prop.z] : null }, final: { ...H, combined }, perFrame };
console.log(`tables-hash · seed ${SEED} · ${FRAMES} frames · ${statics.length} statics · combined ${combined.toString(16)}`);
for (const r of regions) console.log(`  ${r.padEnd(8)} ${H[r].toString(16).padStart(8, '0')}`);
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(out) + '\n'); console.log(`  → ${JSON_OUT}`); }
if (CHECK) {
  const ref = JSON.parse(readFileSync(CHECK, 'utf8'));
  if (ref.seed !== SEED || ref.frames !== FRAMES) { console.log(`CHECK: the reference was recorded with seed ${ref.seed} / ${ref.frames} frames`); process.exit(2); }
  let bad: string | null = null;
  for (let i = 0; i < perFrame.length && !bad; i++) for (const r of regions) if (ref.perFrame[i]?.h[r] !== perFrame[i].h[r]) { bad = `frame ${perFrame[i].f} region ${r}: ${ref.perFrame[i]?.h[r]?.toString(16)} → ${perFrame[i].h[r].toString(16)}`; break; }
  if (bad) { console.log(`CHECK: DIFFERS at ${bad}`); process.exit(1); }
  console.log(`CHECK: identical to ${CHECK} (${perFrame.length} frames × ${regions.length} regions)`);
}
