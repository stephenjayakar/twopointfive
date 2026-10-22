// A SMOKE — a man a level's script has told to have one (director.ts OrderPatch.smoke → GuardScript.smoke; the first is the ledger's night man, who looks
// for a whistle, finds nothing and turns his back: levels/tut-quiet.script.ts). The maintainer, 10-22, of that man standing over the player's prints in the
// snow: 'maybe we should make him stop a bit further away and then turn around for a cigarette break', and 'cigarette break animation (with real smoke!)
// would be sick'.
//   WHO       a living man on his feet whose script says `smoke`, once he stands where it sent him. Not a man in an arm, not a man the script has let go
//             of (the order is the script's: a man handed back to the game has both hands for the game the frame he is).
//   THE HAND  his LEFT (the torch and the gun are the right's): up to his mouth to light it, then down at his side, and up again for a draw every `every`
//             seconds. The animator's own layer (character.ts smokeLayer, its numbers SMOKEARM) carries the arm; this file only says how far up it is asked.
//   THE LIGHT a lighter's flame at his mouth as he lights it, and the end going bright at every draw: the engine's own short lights (LightSet.flash, as a
//             muzzle's), so the picture and the light meter have the same thing. Small: a flame lights a face and a hand's reach of wall.
//   THE SMOKE real smoke: sources on the smoke solver's fine lattice, the one a gun's gas and the cold's breath live on. A thin thread off the end in his
//             hand all the while, and what he breathes out after each draw, off his mouth, thicker than a breath and slower to go. Both are LOOK sources
//             (smoke/types.ts `look`): the game's own smoke, the one sight lines are cut by, never hears of them. With no solver drawing (the harness, a
//             page with smoke off) what he breathes out is the particle system's soft puffs, as a breath in the cold is; the thread is then not shown.
//   NOBODY    reads any of it but the light meter: no eye, ear or foot. Its clock is the frames' dt, its dice are its own (never Math.random, never the
//             game's die).
// THE SWITCH: SMOKEBREAK.on — ON in the page (`?smokebreak=0` puts it off), OFF in the module and on the frozen stand (FROZEN_HOLDS; TPS_SMOKEBREAK=1
// raises it there). Off, a man told to smoke stands where he was sent with his hands as they were. tools/qa/smokebreak-check.ts (SMOKEBREAK_BREAK=1 fails it).
// The numbers are set from the solver's arithmetic and the breath's own; NEVER SEEN ON A GPU.
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { gpuFx } from './particleFx';

export const SMOKEBREAK = {
  on: false,
  /** the clock: s to light it (the hand is up from `lightUp[0]` to `lightUp[1]`, the flame burns `flame` s from `flameAt`), then a draw every `every`
   *  s, the hand up for `draw` s of it, and what he breathes out leaves `outAfter` s after the hand starts down, for `out` s */
  lightSecs: 3.2, lightUp: [0.5, 2.6] as [number, number], flameAt: 1.3, flame: 0.9,
  every: 7.5, draw: 2.1, outAfter: 0.7, out: 1.3,
  /** the lights (LightSet.flash: colour, intensity, range m; the end's is re-filed every `emberEvery` s so it never quite goes out) */
  flameColor: [1.0, 0.62, 0.24] as Vec3, flameK: 2.4, flameRange: 3.2,
  emberColor: [1.0, 0.36, 0.1] as Vec3, emberK: 0.1, emberDrawK: 0.7, emberRange: 1.3, emberEvery: 0.4,
  /** where the end is off the left hand's joint, m along the hand's own heading (worked out from the forearm) and up */
  tipOut: 0.11, tipUp: 0.02,
  /** THE THREAD off the end (the solver's units, as snowBreath.ts BREATHSTEAM: 6 /m of extinction a unit of density; +1.6 m/s² a unit of heat) */
  thread: { radius: 0.02, cells: 1.2, density: 5, temp: 5, speed: 0.25, push: 10, jitter: 0.35 },
  /** WHAT HE BREATHES OUT after a draw */
  breath: { radius: 0.04, cells: 1.5, density: 16, temp: 2.5, speed: 1.1, push: 12, expand: 2.2, attack: 0.1, jitter: 0.3, down: 0.1 },
  /** … as puffs, with no solver drawing: records across `out`, puffs a record, and the puff's own numbers (render/particles.ts; `steam` = its share of the
   *  dust puff's opacity and that it rises) */
  puffs: { records: 4, count: 6, speed: 0.8, spread: 0.26, life: 2.4, size: 0.1, opacity: 0.8 },
  /** what the smoke scatters: a blue grey (the solver's `tint`, the puff's colour) */
  color: [0.72, 0.76, 0.86] as Vec3,
  /** m: the mouth off the head joint, ahead and down (snowBreath.ts's own two numbers) */
  mouthAhead: 0.1, mouthDown: 0.075,
};

export interface SmokeBreakStats { men: number; lit: number; draws: number; flames: number; embers: number; threads: number; breaths: number; records: number; frames: number }
interface Man { /** s since he was first asked */ t: number; flamed: boolean; /** draws begun, breaths let out */ draws: number; outs: number; emberT: number; /** the thread's source rides his hand */ thread: boolean;
  /** this frame he smokes (the sources' tracks read it) */ live: boolean; /** records of this breath still to file as puffs */ left: number; gap: number }
interface State { men: SideMap<Character, Man>; stats: SmokeBreakStats; seed: number }
const states = new SideMap<Game, State>('smokebreak.states');
const fresh = (): SmokeBreakStats => ({ men: 0, lit: 0, draws: 0, flames: 0, embers: 0, threads: 0, breaths: 0, records: 0, frames: 0 });
function stateOf(g: Game): State { let s = states.get(g); if (!s) { s = { men: new SideMap(), stats: fresh(), seed: 0x51607e }; states.set(g, s); } return s; }
export function smokeBreakStats(g: Game): SmokeBreakStats { return stateOf(g).stats; }
/** nobody has lit anything yet (probes, a restart) */
export function resetSmokeBreak(g: Game) { const s = stateOf(g); s.men = new SideMap(); s.stats = fresh(); }
const mix = (x: number): number => { x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return x >>> 0; };

/** is this man smoking now: the switch, a script that says so, on his feet where it sent him, nobody's arm round him */
export function smoking(gd: Guard): boolean {
  const s = gd.script;
  return SMOKEBREAK.on && !!s?.smoke && gd.state !== 'dead' && !gd.held && gd.char.alive && (s.goal === null || !!s.arrived);
}
/** how far up his hand is asked this second of his smoke (0‥1), and whether the end is at his mouth (a draw, or the lighting of it) */
function handAt(t: number): { up: number; drawn: boolean; cycle: number; into: number } {
  const K = SMOKEBREAK;
  if (t < K.lightSecs) { const up = t >= K.lightUp[0] && t < K.lightUp[1]; return { up: up ? 1 : 0, drawn: up && t >= K.flameAt + K.flame * 0.5, cycle: -1, into: t }; }
  const u = t - K.lightSecs, cycle = Math.floor(u / K.every), into = u - cycle * K.every, at = K.every - K.draw;   // (the draw ends each round: he has just lit it)
  const up = into >= at;
  return { up: up ? 1 : 0, drawn: up && into >= at + 0.6, cycle, into };
}
function mouthOf(c: Character): { pos: Vec3; dir: Vec3 } {
  const K = SMOKEBREAK, hd = c.headDir(), head = c.bones.head!, hl = Math.hypot(hd[0], hd[2]);
  const fx = hl > 0.2 ? hd[0] / hl : Math.sin(c.bodyYaw), fz = hl > 0.2 ? hd[2] / hl : Math.cos(c.bodyYaw), l = Math.hypot(1, K.breath.down);
  return { pos: [head[0] + fx * K.mouthAhead, head[1] - K.mouthDown, head[2] + fz * K.mouthAhead], dir: [fx / l, -K.breath.down / l, fz / l] };
}
/** the lit end: off the left hand's joint along the forearm's line, a little up (the joint is the wrist) */
function tipOf(c: Character): Vec3 | null {
  const h = c.bones.handL, e = c.bones.forearmL ?? c.bones.elbowL; if (!h) return null;
  const K = SMOKEBREAK; let d: Vec3 = [Math.sin(c.bodyYaw), 0, Math.cos(c.bodyYaw)];
  if (e) { const x = h[0] - e[0], y = h[1] - e[1], z = h[2] - e[2], l = Math.hypot(x, y, z); if (l > 1e-4) d = [x / l, y / l, z / l]; }
  return [h[0] + d[0] * K.tipOut, h[1] + d[1] * K.tipOut + K.tipUp, h[2] + d[2] * K.tipOut];
}

/** Once a frame, after the characters are posed (game.ts, beside the breath in the cold). */
export function updateSmokeBreak(g: Game, dt: number) {
  const st = states.get(g);
  if (!SMOKEBREAK.on) { if (st) for (const gd of g.guards as Guard[]) { const m = st.men.get(gd.char); if (m?.live) { m.live = false; gd.char.anim.smoke = null; } } return; }
  if (!(dt > 0)) return;
  let any = false; for (const gd of g.guards as Guard[]) if (gd.script?.smoke || gd.char.anim.smoke !== null) { any = true; break; }
  if (!any) return;   // (nothing of this file runs on a floor where nobody was told to smoke)
  const S = stateOf(g), K = SMOKEBREAK, T = S.stats; T.frames++; let men = 0;
  for (const gd of g.guards as Guard[]) {
    const c = gd.char; let m = S.men.get(c);
    if (!smoking(gd)) { if (m?.live || c.anim.smoke !== null) { c.anim.smoke = null; if (m) { m.live = false; m.thread = false; m.left = 0; } }
      if (m && !gd.script?.smoke) S.men.delete(c);   // (told again later, he lights another)
      continue; }
    if (!m) { m = { t: 0, flamed: false, draws: 0, outs: 0, emberT: 0, thread: false, live: true, left: 0, gap: 0 }; S.men.set(c, m); T.lit++; }
    m.live = true; men++;
    const was = handAt(m.t); m.t += dt; const now = handAt(m.t);
    c.anim.smoke = now.up;
    const hidden = g.fogOfWar.hidden(gd), tip = tipOf(c);
    // the lighter's flame, once
    if (!m.flamed && m.t >= K.flameAt) { m.flamed = true; const a = mouthOf(c); g.engine.lights.flash([a.pos[0] + a.dir[0] * 0.06, a.pos[1], a.pos[2] + a.dir[2] * 0.06], K.flameColor, K.flameK, K.flameRange, K.flame, c.id); T.flames++; }
    // the end: a low glow all the while it is lit, bright at a draw
    if (m.t >= K.flameAt + K.flame * 0.5 && tip) { m.emberT -= dt; if (m.emberT <= 0) { m.emberT = K.emberEvery; g.engine.lights.flash(tip, K.emberColor, now.drawn ? K.emberDrawK : K.emberK, K.emberRange, K.emberEvery * 1.6, c.id); T.embers++; } }
    if (now.up && !was.up && now.cycle >= 0) { m.draws++; T.draws++; }
    if (hidden) continue;   // (nothing live shows in the fog: the lights are the meter's and stay, the smoke is the picture's)
    const drawing = g.smoke.drawing?.() === true;
    // the thread off the end: one source that rides his hand for as long as he smokes
    if (drawing && !m.thread && tip && m.t >= K.flameAt + K.flame) {
      const mine = m, B = K.thread;
      const at = (): { pos: Vec3; dir: Vec3 } | null => { if (!mine.live || !SMOKEBREAK.on || states.get(g) !== S || S.men.get(c) !== mine) { mine.thread = false; return null; } const p = tipOf(c); return p ? { pos: p, dir: [c.vel[0] * 0.5, B.speed, c.vel[2] * 0.5] } : null; };
      g.smoke.emit({ pos: tip, dir: [0, 1, 0], speed: B.speed, radius: B.radius, minVoxels: B.cells, density: B.density, temperature: B.temp, ttl: 600, age: 0, kind: 'breath', push: B.push, jitter: B.jitter,
        lattice: 'fine', confined: true, look: true, trackVel: true, tint: K.color, track: at });
      m.thread = true; T.threads++;
    }
    // what he breathes out: after the lighting and after every draw, as the hand comes down
    const due = was.up && !now.up ? m.t : -1;
    if (due >= 0) { m.outs++; (m as Man & { outAt?: number }).outAt = m.t + K.outAfter; }
    const outAt = (m as Man & { outAt?: number }).outAt;
    if (outAt !== undefined && m.t >= outAt) {
      (m as Man & { outAt?: number }).outAt = undefined; T.breaths++;
      if (drawing) {
        const mine = m, B = K.breath, born = m.outs;
        const at = (): { pos: Vec3; dir: Vec3 } | null => { if (!mine.live || mine.outs !== born || !SMOKEBREAK.on || states.get(g) !== S) return null; const a = mouthOf(c); return { pos: a.pos, dir: [a.dir[0] * B.speed + c.vel[0] * 0.3, a.dir[1] * B.speed, a.dir[2] * B.speed + c.vel[2] * 0.3] }; };
        const a0 = at();
        if (a0) g.smoke.emit({ pos: a0.pos, dir: a0.dir, speed: B.speed, radius: B.radius, minVoxels: B.cells, density: B.density, temperature: B.temp, ttl: K.out, age: 0, kind: 'breath', push: B.push, expand: B.expand,
          attack: B.attack, jitter: B.jitter, lattice: 'fine', confined: true, look: true, trackVel: true, tint: K.color, track: at });
      } else { m.left = Math.max(1, Math.round(K.puffs.records)); m.gap = 0; }
    }
    if (m.left > 0) { m.gap -= dt; if (m.gap <= 0) { m.gap += K.out / Math.max(1, Math.round(K.puffs.records)); m.left--;
      const P = gpuFx(g), Q = K.puffs;
      if (P) { const a = mouthOf(c); const n = P.emit('dust', a.pos, a.dir, Math.max(1, Math.round(Q.count)), { shape: 'cone', speed: Q.speed, speedJit: 0.35, spread: Q.spread, life: Q.life, lifeJit: 0.25, size: Q.size, sizeJit: 0.3, posJit: 0.012,
        owner: c.id, color: K.color, steam: clamp(Q.opacity, 0, 1), seed: mix((Math.imul(c.id + 1, 3266489917) ^ Math.imul(m.outs * 16 + m.left + 1, 668265263) ^ S.seed) >>> 0) }); if (n > 0) T.records++; } } }
  }
  T.men = men;
}
/** one line for the panel / the probes */
export function smokeBreakSummary(g: Game): string {
  const T = stateOf(g).stats;
  return SMOKEBREAK.on ? `smoke break ▸ ${T.men} smoking · ${T.lit} lit, ${T.draws} draws, ${T.breaths} breathed out (${T.threads} threads on the solver, ${T.records} puff records)` : 'smoke break: the switch is off';
}
