// pose-hash.ts — every character's SKINNING MATRICES (skel.jointData: 53 joints × 16 f32) and every proxy record (BoxWorld.capsuleData) hashed per frame over the bench's key
// script (docs/internal/cpu-frame.md — the identity proof for the animation work: PoseFK in place, the scalar SkeletonInstance.update): the seeded harness Game, Sam walking /
// sprinting / crouching about, guards and civilians on their rounds — with the same script and seed two builds must print the same combined hash frame for frame. `--json path`
// writes the per-frame hashes; `--check path` compares (exit 1 at the first differing frame). Sam is made to sprint into furniture, throw, aim and crouch so the layers that
// solve IK on a copy (sneak, carry, long gun, wall, throw) all run.
//   bun run tools/cpu-frame/pose-hash.ts [--frames 1500] [--seed 1] [--json p] [--check p]
import { standUp } from '../qa/headless.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const FRAMES = Number(opt('frames', '1500')), SEED = Number(opt('seed', '1')), JSON_OUT = opt('json', ''), CHECK = opt('check', '');
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
Math.random = mulberry32(SEED * 7919 + 13);
const W = await standUp();
const { game, engine, input, cam, canvas } = W;
const rng = mulberry32(SEED * 104729 + 7);
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
let wanderUntil = 0; const dt = 1 / 60;
function fnv(h: number, u: Uint32Array, a: number, b: number): number { for (let i = a; i < b; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
let H = 2166136261; const per: number[] = [];
for (let f = 0; f < FRAMES; f++) {
  if (game.time >= wanderUntil) { for (const k of [...MOVE, 'ShiftLeft', 'KeyC']) input.keys.delete(k); const keys = [MOVE[Math.floor(rng() * 4)]]; if (rng() < 0.4) keys.push(MOVE[Math.floor(rng() * 4)]); if (rng() < 0.33) keys.push('ShiftLeft'); if (rng() < 0.25) keys.push('KeyC'); for (const k of keys) input.keys.add(k); wanderUntil = game.time + 1 + rng() * 3; const r = rng(); if (r < 0.15) input.pressed.add('Digit1'); else if (r < 0.3) input.pressed.add('Digit2'); else if (r < 0.4) input.pressed.add('Digit3'); else if (r < 0.5) input.pressed.add('KeyE'); if (rng() < 0.2) input.pressed.add('KeyG'); }
  if (f % 97 === 0) { input.mouseX = 600 + Math.floor(rng() * 400); input.mouseY = 350 + Math.floor(rng() * 300); }
  input.buttons = (f % 240) < 90 ? 2 : 0;   // the right button held now and then: aiming down the gun (the aim / carry layers)
  game.update(dt, input, cam, canvas); cam.update(dt, game.followPos(), game.aimPoint); engine.lights.update(dt, game.time); engine.world.dynamics = game.dynBoxes; engine.world.upload(); input.endFrame();
  for (const c of [game.player.char, ...game.guards.map((g: any) => g.char), ...game.civilians.map((g: any) => g.char)]) { const jd: Float32Array = c.skel.jointData; H = fnv(H, new Uint32Array(jd.buffer, jd.byteOffset, jd.length), 0, jd.length); }
  H = fnv(H, engine.world.capsuleU32, 0, engine.world.capsuleCount * 8);
  per.push(H);
}
console.log(`pose-hash · seed ${SEED} · ${FRAMES} frames · combined ${H.toString(16)}`);
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ seed: SEED, frames: FRAMES, final: H, per }) + '\n'); console.log(`  → ${JSON_OUT}`); }
if (CHECK) { const ref = JSON.parse(readFileSync(CHECK, 'utf8')); if (ref.seed !== SEED || ref.frames !== FRAMES) { console.log('CHECK: seed / frames differ'); process.exit(2); } for (let i = 0; i < per.length; i++) if (ref.per[i] !== per[i]) { console.log(`CHECK: DIFFERS at frame ${i}: ${ref.per[i].toString(16)} → ${per[i].toString(16)}`); process.exit(1); } console.log(`CHECK: identical to ${CHECK} (${per.length} frames)`); }
