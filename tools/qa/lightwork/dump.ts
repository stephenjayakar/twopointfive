// lightwork/dump — a preload AFTER tools/qa/framecost-hooks.ts (FC_GPU=1): every LW_EVERY frames of a scripted play, the light list as the engine uploads it
// (who carries what, ranges, reach rows) with the camera and the player's place. One JSON line a sample to LW_OUT.
import { appendFileSync, writeFileSync } from 'node:fs';
import { afterFrame } from './hook';
const OUT = process.env.LW_OUT ?? '/dev/stdout', EVERY = Number(process.env.LW_EVERY ?? 120);
if (OUT !== '/dev/stdout') writeFileSync(OUT, '');
afterFrame((W, n) => {
  if (n % EVERY) return;
  const { engine, game, cam } = W; const r3 = (v: any) => [...v].map((x: number) => +x.toFixed(2));
  const L = engine.lights.lights.filter((l: any) => (l.slot ?? -1) >= 0).map((l: any) => ({ slot: l.slot, name: l.name, kind: l.kind, owner: l.owner, tr: l.ttl >= 0 || !!l.transient, broad: !!l.broad, card: !!l.card, range: +l.range.toFixed(1), radius: l.radius, I: +l.intensity.toFixed(2), outer: l.outerDeg, pos: r3(l.pos), reach: !!l.reach, reachDir: !!l.reachDir }));
  appendFileSync(OUT, JSON.stringify({ f: n, t: +game.time.toFixed(2), player: r3(game.player.char.pos), cam: { target: r3(cam.target), pos: r3(cam.pos), dist: cam.distance, yaw: cam.yaw, pitch: cam.pitch }, lights: L, guards: game.guards.length, alive: game.guards.filter((g: any) => g.state !== 'dead').length, w: engine.width, h: engine.height, grid: [engine.rc.cfg.nx, engine.rc.cfg.ny, engine.rc.cfg.nz] }) + '\n');
});
