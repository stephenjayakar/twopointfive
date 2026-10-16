// THE THROW A MAN WORKS OUT (squadthrow.ts SQUADTHROW.lob). The maintainer, 10-15: "ordering your squad to throw a grenade is still pretty useless. they should
// figure out how to throw to a spot". Until here a teammate had ONE throw: the solver's arc, straight at the spot, that came down on open floor and rolled to
// rest on it (squadsmoke.ts squadArcTo). Through a doorway onto floor beside it, behind a desk, round a corner off the far wall: 'no throw from here.'
//
// Here the thing is FLOWN before it is thrown: `throwFlight` runs the item pool's own step (throwables.ts update — the swept ray, the bounce, the friction, the
// safety floor, two half steps a frame) and the fuse's own rule (a frag's from the hand, a canister's from its first contact: combat.ts updateItems) from a
// hand and a velocity to where it GOES OFF, moving nothing and throwing no die. `throwTo` then tries a man's few ways of throwing at a spot — straight at it
// at three paces (flat and hard, the solver's, a slow lob) and at the walls that stand by it (a bank: `throwWalls`) — and takes the one that goes off nearest
// the spot, within SQUADTHROW.lobNearM of it, on its floor, with nothing solid between where it goes off and the spot. What he cannot see through he does
// not throw through: each way is asked for a line from his hand first.
//
// The flight is the pool's as it stands now: a chair it strikes is not pushed (the real one hands it a little momentum), a door that swings meanwhile is not
// foreseen. It is stepped at a sixtieth; the page steps at the display's rate, so a throw is only taken if it also holds at SQUADTHROW.lobSteps. tools/qa/squadthrow-lob-check.ts throws for real and measures where the fuse found it against where this said.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { ThrowSolution } from './throwables';
import { FRAG_ITEM, GRAVITY, bogBounce, bogSlide, bogStick } from './throwables';
import { snowBogAt } from './snowBog';
import * as fx from './effects';
import { FRAG } from './frag';
import { flashFuse } from './combat';
import { SQUADSMOKE } from './squadsmoke';
import { SQUADTHROW } from './squadthrow';

export const THROWPLAN_STATS = { sims: 0 };
export interface ThrowFlight { end: Vec3; land: Vec3; points: Vec3[]; landed: boolean }
const flat = v3.distXZ;

/** WHERE A THING THROWN FROM `from` AT `v0` GOES OFF: the pool's own flight (see the head of the file). `land` = its first contact, `points` = its way */
export function throwFlight(g: Game, kind: 'frag' | 'stun', from: Vec3, v0: Vec3, STEP = 1 / 60): ThrowFlight {
  const frag = kind === 'frag', radius = frag ? FRAG_ITEM.radius : 0.055, restitution = frag ? FRAG_ITEM.restitution : 0.38, friction = frag ? FRAG_ITEM.friction : 0.35;
  let pos = v3.copy(from), vel = v3.copy(v0), settled = false, bounces = 0, age = 0, fuse = frag ? FRAG.orderFuse : flashFuse(g), land: Vec3 | null = null;
  const points: Vec3[] = [v3.copy(pos)], h = STEP / 2, col = g.col, props = g.props; THROWPLAN_STATS.sims++;
  const ray = (ro: Vec3, rd: Vec3, tmax: number) => { const st = col.raycast(ro, rd, tmax), ph = props.raycast(ro, rd, st ? st.t : tmax); return ph ?? st; };
  for (let i = 0, n = Math.ceil(12 / STEP); i < n; i++) {
    age += STEP;
    for (let s = 0; s < 2 && !settled; s++) {
      vel[1] -= GRAVITY * h;
      const move = v3.scale(vel, h), len = v3.len(move); if (len < 1e-6) continue;
      const dir = v3.scale(move, 1 / len);
      let hit = ray(pos, dir, len + radius * 3.5), back = 0;
      if (hit) { back = radius / Math.max(0.3, -v3.dot(dir, hit.n)); if (hit.t - back > len) hit = null; }
      if (hit) {
        pos = v3.mad(pos, dir, Math.max(0, hit.t - back));
        const n = hit.n, vn = v3.dot(vel, n);
        if (vn < 0) {
          const vN = v3.scale(n, vn), vT = v3.sub(vel, vN);
          const bog = n[1] > 0.6 && !(hit as { prop?: unknown }).prop ? snowBogAt(g, pos[0], pos[1] - radius, pos[2]) : 0;   // lying snow under it (snowBog.ts; 0 = none, and the lines are the pool's as they were)
          vel = v3.add(v3.scale(vT, Math.max(0, 1 - friction * (0.5 + 0.5 * Math.abs(n[1])))), v3.scale(vN, -restitution)); bounces++; land ??= v3.copy(pos);
          if (bog > 0) { const up = v3.dot(vel, n), b = bogBounce(bog), s = bogSlide(bog); vel = v3.add(v3.scale(v3.sub(vel, v3.scale(n, up)), s), v3.scale(n, up * b)); }
          if (n[1] > 0.6 && Math.abs(vel[1]) < 0.5 && Math.hypot(vel[0], vel[2]) < 0.35 + (bog > 0 ? bogStick(bog) : 0)) { settled = true; vel = [0, 0, 0]; pos[1] += 0.001; }
        }
        pos = v3.mad(pos, n, 0.002);
      } else pos = v3.add(pos, move);
      if (pos[1] < radius) {
        const bog = snowBogAt(g, pos[0], 0, pos[2]);
        pos[1] = radius; if (vel[1] < 0) { vel[1] *= -restitution; vel[0] *= 0.7; vel[2] *= 0.7; if (bog > 0) { vel[1] *= bogBounce(bog); vel[0] *= bogSlide(bog); vel[2] *= bogSlide(bog); } bounces++; land ??= v3.copy(pos); }
        if (Math.abs(vel[1]) < 0.5 && Math.hypot(vel[0], vel[2]) < 0.35 + (bog > 0 ? bogStick(bog) : 0)) { settled = true; vel = [0, 0, 0]; }
      }
    }
    if (i % 2 === 1 || settled) points.push(v3.copy(pos));
    const landed = bounces > 0 || settled;
    if (frag || landed) fuse -= STEP;
    if (settled || fuse <= 0 || (!frag && !landed && age > fx.bang.maxAir)) break;   // (at rest: where it lies is where it goes off)
  }
  return { end: pos, land: land ?? v3.copy(pos), points, landed: bounces > 0 || settled };
}

/** THE WALLS THAT STAND BY A SPOT, for a bank: where rays out from over it (SQUADTHROW.lobWalls of them, lobWallH up, lobWallM long) first meet something
 *  solid — a hand's width off its face, the nearest first */
export function throwWalls(g: Game, at: Vec3): Vec3[] {
  const K = SQUADTHROW, o: Vec3 = [at[0], at[1] + K.lobWallH, at[2]], out: { p: Vec3; t: number }[] = [];
  for (let i = 0; i < K.lobWalls; i++) {
    const a = i * 2 * Math.PI / K.lobWalls, d: Vec3 = [Math.sin(a), 0, Math.cos(a)], hit = g.col.raycast(o, d, K.lobWallM);
    if (hit && hit.t > 0.4) out.push({ p: v3.mad(o, d, hit.t - 0.08), t: hit.t });
  }
  return out.sort((a, b) => a.t - b.t).map(x => x.p);
}

/** the hand a throw at `aim` leaves, for a man stood at `p` (squadsmoke.ts squadArcTo's: ahead of him toward it, under his head) — null: it would be in a wall */
function handAt(g: Game, gd: Guard, p: Vec3, aim: Vec3): Vec3 | null {
  const K = SQUADSMOKE, d = flat(p, aim), k = d > 1e-3 ? K.handAhead / d : 0, head = gd.char.bones.head;
  const up = Math.max(0.6, Math.min(K.handUp, head ? head[1] - gd.char.pos[1] - K.headDrop : K.handUp));
  const from: Vec3 = [p[0] + (aim[0] - p[0]) * k, p[1] + up, p[2] + (aim[2] - p[2]) * k];
  return g.col.solidBlocked([p[0], p[1] + up, p[2]], from) ? null : from;
}
/** it went off by the spot: within lobNearM of it over the floor, not up on something tall, nothing solid between the two */
export function throwHits(g: Game, end: Vec3, at: Vec3, slack = 0): boolean {
  const K = SQUADTHROW;
  return flat(end, at) <= K.lobNearM + slack && end[1] - at[1] <= K.lobUpM && !g.col.solidBlocked([end[0], end[1] + 0.25, end[2]], [at[0], at[1] + 0.25, at[2]]);
}

/** ONE MAN'S WORKED-OUT THROW at a spot (`stood`: as he would have it standing there; `walls`: throwWalls(g, at), asked once a search; `lim.n`: flights left
 *  to this search, counted down): the hand, the throw (`sol.points` = its whole flight, `sol.land` its first contact) and where it goes off (`rest`). Null: none */
export function throwTo(g: Game, gd: Guard, at: Vec3, kind: 'frag' | 'stun', stood?: Vec3, walls?: Vec3[], lim?: { n: number }): { from: Vec3; sol: ThrowSolution; rest: Vec3 } | null {
  const K = SQUADTHROW, p = stood ?? gd.char.pos, col = g.col;
  let best: { from: Vec3; sol: ThrowSolution; rest: Vec3 } | null = null, miss = Infinity;
  const fly = (from: Vec3, aim: Vec3, paces: readonly number[]) => {
    const dx = aim[0] - from[0], dy = aim[1] - from[1], dz = aim[2] - from[2], dist = Math.hypot(dx, dz); let lastT = -1;
    for (const u of paces) {
      if (miss <= 0.5 || (lim && lim.n <= 0)) return;
      const T = Math.min(1.4, Math.max(0.3, dist / u)); if (Math.abs(T - lastT) < 0.02) continue; lastT = T;
      const v0: Vec3 = [dx / T, (dy + 0.5 * GRAVITY * T * T) / T, dz / T]; if (v3.len(v0) > K.lobSpeed) continue;
      if (lim) lim.n--;
      const F = throwFlight(g, kind, from, v0), m = flat(F.end, at);
      if (!(m < miss && throwHits(g, F.end, at))) continue;
      // (the page steps at the display's rate, not this forecast's sixtieth: a throw is taken only if it still goes off by the spot stepped finer and coarser)
      if (lim) lim.n -= 2;
      if (!K.lobSteps.every(h => throwHits(g, throwFlight(g, kind, from, v0, h).end, at, 0.4))) continue;
      miss = m; best = { from, sol: { v0, T, points: F.points, land: F.land }, rest: F.end };
    }
  };
  // straight at it: only with a line from the hand to somewhere over the spot (what he cannot see through he does not throw through)
  const to: Vec3 = [at[0], at[1] + 0.05, at[2]], from = flat(p, at) > 0.5 ? handAt(g, gd, p, to) : null;
  if (from && [0.3, 1.0, 1.7].some(y => !col.solidBlocked(from, [at[0], at[1] + y, at[2]]))) fly(from, to, K.lobPaces);
  // … and off a wall that stands by it: one his hand has a line to
  for (const w of walls ?? throwWalls(g, at)) {
    if (miss <= 0.5 || (lim && lim.n <= 0)) break;
    if (flat(p, w) < 1) continue;
    const hand = handAt(g, gd, p, w); if (hand && !col.solidBlocked(hand, w)) fly(hand, w, K.lobBankPaces);
  }
  return best;
}
