// `bun run tools/qa/wallsnap-trace.ts [--on] [--rifle] [--from Z] [--yaw DEG] [--walk]` — the take and the step-off of the wall hold (Q), frame by frame: how far
// the body is off its station, how far the back is off square, the stance weight the animator shows, the speed he is carried at and the pelvis' height. Numbers
// for the page; no verdict (the verdicts are wallsnap-probes.ts).
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const arg = (k: string, d: number) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const ON = process.argv.includes('--on'), RIFLE = process.argv.includes('--rifle'), WALK = process.argv.includes('--walk');
const DT = 1 / 60, DEG = Math.PI / 180, wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
Math.random = mulberry32(95);
const W: any = await standUp(); const g = W.game, input = W.input;
try { const m = await import(`${ROOT}/src/game/wallsnap.ts`); m.WALLSNAP.on = ON; } catch { if (ON) throw new Error('no wallsnap.ts in this checkout'); }
g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
for (let i = 0; i < 5; i++) W.step(DT);
g.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); });
const pl = g.player, c = pl.char;
// the corridor's north wall: face z 10.06, n (0, 1); the station is z 10.51
const z0 = arg('--from', 11.0), yaw0 = arg('--yaw', 180) * DEG;
g.teleportPlayer([20, 0, z0]); c.bodyYaw = c.aimYaw = yaw0;
if (RIFLE) { pl.slot = 'rifle'; pl.holstered = false; }
for (let i = 0; i < 40; i++) W.step(DT);
if (WALK) { input.keys.add('KeyS'); for (let i = 0; i < 30; i++) W.step(DT); }   // (cam yaw 0: W = north = +z?) walking at the wall first — see the print for which way he went
const row = (f: number, tag: string) => {
  const w = pl.wall, an = c.anim; const st = (an as any).st?.w?.x ?? NaN;
  const off = w ? c.pos[0] * w.n[0] + c.pos[2] * w.n[2] - (w.d + 0.45) : NaN;
  const yawErr = w ? wrapA(c.bodyYaw - Math.atan2(w.n[0], w.n[2])) / DEG : NaN;
  const hips = c.bones.hips, head = c.bones.head;
  console.log(`${tag} f${String(f).padStart(3)} pos z ${c.pos[2].toFixed(3)} x ${c.pos[0].toFixed(3)}  off ${off.toFixed(3)}  yawErr ${yawErr.toFixed(1).padStart(7)}  stanceW ${st.toFixed(2)}  speed ${Math.hypot(c.vel[0], c.vel[2]).toFixed(2)}  moved ${(v3.distXZ(c.pos, last) / DT).toFixed(2)} m/s  hipsY ${hips ? hips[1].toFixed(3) : '?'} headY ${head ? head[1].toFixed(3) : '?'}  stance ${an.stance} long ${an.longStance ?? '-'} holst ${pl.holstered}`);
  last = v3.copy(c.pos);
};
let last = v3.copy(c.pos);
console.log(`start: pos (${c.pos[0].toFixed(2)}, ${c.pos[2].toFixed(2)}) yaw ${(c.bodyYaw / DEG).toFixed(0)}° vel (${c.vel[0].toFixed(2)}, ${c.vel[2].toFixed(2)})  switch ${ON ? 'ON' : 'off'}${RIFLE ? ' rifle' : ''}`);
input.pressed.add('KeyQ');
for (let f = 0; f < 36; f++) { W.step(DT); row(f, 'take'); }
for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) input.keys.delete(k);
for (let i = 0; i < 40; i++) W.step(DT);
console.log('--- off: Q');
input.pressed.add('KeyQ');
for (let f = 0; f < 24; f++) { W.step(DT); row(f, 'offQ'); }
console.log('--- on again, then off by walking away (the stick square off the wall)');
input.pressed.add('KeyQ'); for (let i = 0; i < 60; i++) W.step(DT); last = v3.copy(c.pos);
input.keys.add('KeyS');
for (let f = 0; f < 40; f++) { W.step(DT); row(f, 'away'); }
input.keys.delete('KeyS');
process.exit(0);
