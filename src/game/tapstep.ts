// TAP TO STEP (TAPSTEP) — a prototype in the sneak lab: crouched, the move keys stop being a walk and become steps. The maintainer, of the ideas for the creep: "i love
// the tap to step idea! curious how we can make this feel awesome. and also generalize between creeping on a guy to grab him vs slithering through guards". One verb
// for both: there is no mode for a man's back, the same step just knows where it lands.
//
//   A STEP       a press lifts the foot, the key kept down reaches further (to `reachM`), the key let go plants it as soon as he can stop (a tap is `tapM`). Between
//                steps he stands dead still in the stride he stopped in: the legs are half a cycle a step and rest with both feet down (character.ts tapU).
//   THE RHYTHM   after a plant his weight settles for `settle` s. The key kept down waits that out and steps again, so a held key is always the safe pace. A press made
//                while he is still settling steps at once and that step lands as a scuff, louder the earlier it was. A press inside `beat` s of his settling is on
//                the beat: a tap then is a `beatM` step, so a player who has the rhythm goes further for a tap and still stops where he means to.
//   A MAN'S STEP a plant inside `maskSecs` of the footfall of a man within `maskM` of Sam is under it: `mask` of its level.
//   HIS BACK     a step taken toward the back of a man he could stalk (stalk.ts stalkCould), within `landM` of the spot `STALK.keyM` behind him, bends onto that spot and
//                carries on to it whatever the key does, so the last step lands in reach and the grab's own key is what is left. Behind a man who is walking, `follow` of
//                his speed goes into the step: the safe pace can catch him.
// What it does not touch: what the men see of a crouched Sam (a still man is a still man), Shift in a crouch (the quick crouch walk, for when the steps are too slow), the
// held click, the wall hold, a body in tow.
// A prototype: up in the sneak lab and with ?tapstep=1, down in the plain page and on the frozen stand, so no FROZEN_HOLDS row. Off = the build as it was.
// Check: tools/qa/tapstep-check.ts (TAPSTEP_BREAK=1 must fail).
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import { STALK, stalkCould } from './stalk';
import { tread } from './floor';
import { loadHeard } from './kitload';

export const TAPSTEP = {
  on: false,
  /** m: a tap's step · a tap's on the beat · the most a held key reaches */
  tapM: 0.3, beatM: 0.55, reachM: 0.85,
  /** m/s: the top of a step · m/s²: how hard he takes it up and sets it down */
  pace: 2, rate: 10,
  /** s: his weight coming down after a plant · how long after that a press is still on the beat */
  settle: 0.16, beat: 0.14,
  /** a plant's footfall: on time (the crouch walk's is 0.125) · at the very start of the settling, less the later the press */
  quiet: 0.08, scuff: 0.4,
  /** under a man's footfall: how long after it · how near Sam the man · the share of its level left */
  maskSecs: 0.16, maskM: 7, mask: 0.3,
  /** his back: how far off the spot a step takes it · cos of how far off the step's line it may be · the share of a walking man's speed a step behind him takes on */
  landM: 1.5, landCos: 0.5, follow: 0.6,
  /** 1/s: how quickly a step in the air comes round to the keys · how quickly the legs follow the ground a step has covered */
  turn: 10, legs: 9,
};
export const TAPSTEP_STATS = { steps: 0, scuffs: 0, beats: 0, masked: 0, lands: 0, last: '' };

export interface TapMove { mx: number; mz: number; speed: number }
interface St { /** 0 at rest · 1 in the air · 2 settling */ st: 0 | 1 | 2; /** s: settling left · at rest, how long he has been */ t: number; /** the frame this last ran on */ at: number; keys: boolean;
  dir: [number, number]; v: number; done: number; len: number; least: number; /** how early the press that began this step was, 0‥1 */ rush: number; u: number; n: number; way: 1 | -1; stuck: number; prev: Vec3 | null; asked: number;
  man: Guard | null; maskT: number; /** the key is up and `len` is where this step lands */ set: boolean }
const STATE = new SideMap<Game, St>('tapstep.STATE');
function stateOf(g: Game): St { let s = STATE.get(g); if (!s) { s = { st: 0, t: 9, at: -1, keys: false, dir: [0, 1], v: 0, done: 0, len: 0, least: 0, rush: 0, u: 1, n: 0, way: 1, stuck: 0, prev: null, asked: 0, man: null, maskT: -9, set: false }; STATE.set(g, s); } return s; }

/** is he stepping this frame: the footfalls are the plants', not the cycle's, and the pose is the held stride */
export const tapHeld = (g: Game): boolean => { const S = STATE.get(g); return TAPSTEP.on && !!S && S.at >= 0 && g.time - S.at < 0.1; };   // (close.ts asks before this frame's step has run)
/** a man's footfall (guards.ts): a plant just after it is under it */
export function tapHears(g: Game, pos: ArrayLike<number>) { const p = g.player.char.pos; if (Math.hypot(pos[0] - p[0], pos[2] - p[2]) <= TAPSTEP.maskM) stateOf(g).maskT = g.time; }
export function tapReset(g: Game) { const S = STATE.get(g); if (S) { S.st = 0; S.t = 9; S.at = -1; S.keys = false; S.v = 0; S.man = null; S.prev = null; S.maskT = -9; } }

/** a man whose back this step is going to, and the spot `keyM` behind him */
function backOf(g: Game, dx: number, dz: number, far: number): { gd: Guard; x: number; z: number; d: number } | null {
  const p = g.player.char.pos; let best: { gd: Guard; x: number; z: number; d: number } | null = null;
  for (const gd of g.guards) { if (!stalkCould(g, gd)) continue;
    const q = gd.char.pos, x = q[0] - Math.sin(gd.char.bodyYaw) * STALK.keyM, z = q[2] - Math.cos(gd.char.bodyYaw) * STALK.keyM, ax = x - p[0], az = z - p[2], d = Math.hypot(ax, az);
    if (d > far || (d > 0.05 && (ax * dx + az * dz) / d < TAPSTEP.landCos)) continue;
    if (!best || d < best.d) best = { gd, x, z, d }; }
  return best;
}
function lift(g: Game, S: St, mx: number, mz: number, rush: number, least: number) {
  const f = g.player.char.forward(); S.st = 1; S.dir = [mx, mz]; S.v = 0; S.done = 0; S.len = TAPSTEP.reachM; S.least = least; S.rush = rush; S.u = 0; S.n++; S.stuck = 0; S.man = null; S.set = false; S.way = mx * f[0] + mz * f[2] < -0.3 ? -1 : 1;
  TAPSTEP_STATS.steps++;
}
function plant(g: Game, S: St) {
  const c = g.player.char, T = TAPSTEP, under = g.time - S.maskT <= T.maskSecs, base = T.quiet + (T.scuff - T.quiet) * S.rush;
  const level = tread(g, c.pos, base * loadHeard(g, 'player'), true) * (under ? T.mask : 1);
  g.events.push({ kind: 'step', pos: [c.pos[0], c.pos[1], c.pos[2]], time: g.time, loud: false, level }); g.player.noise = Math.max(g.player.noise, level);
  if (S.rush > 0) TAPSTEP_STATS.scuffs++; if (under) TAPSTEP_STATS.masked++; if (S.man) TAPSTEP_STATS.lands++;
  TAPSTEP_STATS.last = S.man ? 'landed behind him' : under ? 'under his footfall' : S.rush > 0 ? 'a scuff' : 'quiet';
  S.st = 2; S.t = T.settle; S.v = 0; S.man = null;
}
/** a frame of it, crouched with his feet his own: the keys in, the step out */
export function tapTick(g: Game, mx: number, mz: number, ml: number, dt: number): TapMove {
  const S = stateOf(g), T = TAPSTEP, c = g.player.char, fresh = ml > 0 && !S.keys;
  const moved = S.prev ? Math.hypot(c.pos[0] - S.prev[0], c.pos[2] - S.prev[2]) : 0, asked = S.asked;
  S.keys = ml > 0; S.at = g.time; S.prev = [c.pos[0], c.pos[1], c.pos[2]];
  if (S.st === 2) { S.t -= dt;
    if (fresh) lift(g, S, mx, mz, clamp(S.t / T.settle, 0, 1), T.tapM);
    else if (S.t <= 0) { S.st = 0; S.t = 0; } }
  else if (S.st === 0) S.t += dt;
  if (S.st === 0 && ml > 0) { const beat = fresh && S.t <= T.beat; if (beat) TAPSTEP_STATS.beats++; lift(g, S, mx, mz, 0, beat ? T.beatM : T.tapM); }
  else if (S.st === 1) { S.done += moved;
    if (asked > 0.2 * dt && moved < 0.25 * asked) { if (++S.stuck >= 3) plant(g, S); } else S.stuck = 0; }
  if (S.st === 1) {
    if (ml > 0) { const k = 1 - Math.exp(-T.turn * dt), x = S.dir[0] + (mx - S.dir[0]) * k, z = S.dir[1] + (mz - S.dir[1]) * k, l = Math.hypot(x, z); if (l > 1e-3) S.dir = [x / l, z / l]; }
    const near = backOf(g, S.dir[0], S.dir[1], T.landM), ahead = near ?? backOf(g, S.dir[0], S.dir[1], 99);
    const gv = ahead ? ahead.gd.char.vel : null, gain = gv ? T.follow * Math.max(0, gv[0] * S.dir[0] + gv[2] * S.dir[1]) : 0;
    if (near && near.d > 0.03) { S.man = near.gd; S.dir = [(near.x - c.pos[0]) / near.d, (near.z - c.pos[2]) / near.d]; S.len = S.done + near.d; }
    else if (near) S.len = S.done;
    else { S.man = null; const reach = T.reachM + gain * 0.4; if (ml > 0) { S.len = reach; S.set = false; } else if (!S.set) { S.set = true; S.len = Math.min(reach, Math.max(S.least, S.done + S.v * S.v / (2 * T.rate))); } }   // (the key let go fixes where it lands: the soonest he can stop, a tap's at the least)
    const rem = S.len - S.done;
    S.v = Math.min(S.v + T.rate * dt, T.pace + gain, Math.sqrt(2 * T.rate * Math.max(rem, 0)));
    if (rem <= 0.01) plant(g, S);
  }
  if (S.st !== 0) S.u += clamp((S.st === 1 ? clamp(S.done / Math.max(S.len, 0.05), 0, 1) : 1) - S.u, 0, dt * T.legs);
  const an = c.anim; an.tapU = S.u; an.tapN = S.n; an.tapWay = S.way;
  S.asked = S.v * dt;
  return { mx: S.dir[0], mz: S.dir[1], speed: S.v };
}
/** his feet are not the step's this frame (he stood, ran, took a wall): the next press starts clean */
export function tapOff(g: Game, ml: number) { const S = STATE.get(g); if (S) { S.st = 0; S.t = 9; S.v = 0; S.man = null; S.keys = ml > 0; S.asked = 0; S.prev = null; S.at = -1; } g.player.char.anim.tapU = -1; return null; }
