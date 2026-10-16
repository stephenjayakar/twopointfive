// What a shot COSTS: a lamp needs a real hit, and moving feet open the cone (the maintainer, 10-13, on the pistol
// against distant lights — "it's pretty much just point and click with distant lights" — and then: "yeah, needs a
// real hit. we should also really penalize accuracy while moving").
//
// TWO switches, each ON in the page and OFF in the module and on the frozen harness stand; each a `FROZEN_HOLDS`
// row, the table in the knob registry and a journal's tables — a recording from before the table replays with
// both off. Off = nothing here is asked and every statement at the seams is the one that stood there.
//
// `AIMCOST.lamp` (`?lamphit=0`, `TPS_LAMPHIT=1`) — A LAMP NEEDS A REAL HIT. The player's round used to break any
//   fixture whose point lay within 0.3‥0.45 m of the round's line: with the reticle's snap on the lamp, a pistol
//   whose cone was a metre wide out there still broke it. Now the round must MEET the thing (`lampStruck`): its
//   line within `bare` of the bulb's own point, or through one of the fixture's own boxes grown by `pad`, no
//   further than `slack` past where the round stopped. And a lamp is a thing to settle on like a man: the
//   reticle coming onto a lamp it was not just on starts the aim's settle over (aim.ts `trackPlayer`), so a
//   swing-and-click is the unsettled cone. The reticle's snap, the OCP and the launcher are untouched.
//
// `AIMCOST.move` (`?movecost=0`, `TPS_MOVECOST=1`) — MOVING FEET COST THE SHOT, for anybody holding a gun. Three
//   things, no new die (the same draws a round, a wider cone):
//   · the cone's feet term × `moveK`;
//   · the feet are REMEMBERED (`feetHold`): the fastest he has gone, let go over `stopTau` — a man who stops
//     and fires on the same step still has the walk in his hands (the old term fell to nothing the frame he
//     stopped, which is why tap-stop-shoot read as free). Let go for good: a small straight bleed (`stopBleed`)
//     under the decay takes it to exactly nothing — from a walk in a second and a third, from a sprint in under
//     two — so a man stood still has the cone he always had;
//   · the rifle's brace takes only `braceFeet` of its share off the feet term (braced, the gun is steady; the
//     legs under it are not).
//   A guard's own rule stands on the remembered feet too: he starts no burst while they are over `plantAt` (aim.ts
//   `trackGuard`'s moving cap, which already made him plant out of a run — so out of a run he waits a third of a
//   second longer, and a man at a walk shoots as he always did, wider). A room fight's men (roomfight.ts) get the same
//   remembered feet × `moveK` on their own feet term. What the player reads of it is the aiming ring: it may
//   open to `ringPx` (it stopped at 60) and closes as his feet settle. ONE round asks more: the standoff's flank
//   round, threaded 0.45 m past the colleague in Sam's arm (guards.ts), waits until the feet he remembers are under
//   `flankAt` (aim.ts `feetSettled`) — with the cone still open from the walk round, the first round found his own man.
//
// A leaf: nothing of the game is imported, so anything may import it.

import { Vec3, v3, clamp } from '../math/vec';
import { Box, rayBox } from '../scene/boxes';

export const AIMCOST = {
  /** a lamp breaks only to a round that meets it */
  lamp: false,
  /** moving feet open the cone, and are remembered after they stop */
  move: false,
  /** m: the round's line this near the bulb's own point is a hit */
  bare: 0.12,
  /** m: a fixture's own boxes are grown this much for the round */
  pad: 0.03,
  /** m: how far past where the round stopped the thing may sit (a bulb set into the ceiling it stopped in) */
  slack: 0.15,
  /** × the cone's feet term */
  moveK: 2,
  /** s: the remembered feet let go over this */
  stopTau: 0.35,
  /** m/s²: taken straight off the remembered feet as well, so they reach nothing in a finite time */
  stopBleed: 0.1,
  /** 0‥1: how much of the rifle's brace reaches the feet term (1 = all of it, as it was) */
  braceFeet: 0.5,
  /** m: the same for a wall device (a camera's body is longer than a bulb) */
  bareDevice: 0.16,
  /** m/s: a guard starts no burst while his remembered feet are over this (never looser than his own `stopToShoot`) */
  plantAt: 1.2,
  /** m/s: a man takes an aimed round PAST A COLLEAGUE in Sam's arm (guards.ts, the standoff's flank round) only with his remembered feet under this —
   *  the line is 0.45 m clear of his own man, and a cone still open from the walk round found him (standoff-flank, the page's stand) */
  flankAt: 0.3,
  /** px: the aiming ring's largest size under the rule (60 without) */
  ringPx: 120,
};
export const AIMCOST_STATS = { lampHits: 0, lampNear: 0 };

/** one straight stretch of a round's flight: from `o` along unit `d` for `end` metres */
export interface RoundLeg { o: Vec3; d: Vec3; end: number }

/** did a round flying these legs MEET a fixture — its point `pos`, its own boxes — under the real-hit rule?
 *  `stopped` = the round's flight ended in one of the fixture's boxes (the caller's own ray said so). */
export function lampStruck(pos: Vec3, boxes: readonly (Box | undefined)[], stopped: boolean, legs: readonly RoundLeg[], bare = AIMCOST.bare, slack = AIMCOST.slack): boolean {
  if (stopped) return true;
  const pad = AIMCOST.pad;
  for (const s of legs) {
    const reach = s.end + slack;
    const toT = v3.sub(pos, s.o); const depth = v3.dot(toT, s.d);
    if (depth <= reach && depth >= -bare) {
      const along = clamp(depth, 0, reach);
      if (v3.len(v3.sub(toT, v3.scale(s.d, along))) < bare) return true;
    }
    for (const b of boxes) {
      if (!b) continue;
      const toB = v3.sub(b.c, s.o); const db = v3.dot(toB, s.d); const r = Math.hypot(b.h[0], b.h[1], b.h[2]) + pad;
      if (db > reach + r || db < -r) continue;
      if (v3.len(v3.sub(toB, v3.scale(s.d, db))) > r) continue;
      const grown: Box = { ...b, h: [b.h[0] + pad, b.h[1] + pad, b.h[2] + pad] };
      if (rayBox(s.o, s.d, grown, reach)) return true;
      // (rayBox answers nothing for a ray that STARTS inside the box — a muzzle pressed to the fixture, a leg born in it: no way in from here to
      //  anywhere ahead, and a way in coming back from past it, is exactly that)
      const L = 2 * r + 0.01;
      if (!rayBox(s.o, s.d, grown, L) && rayBox(v3.add(s.o, v3.scale(s.d, L)), v3.scale(s.d, -1), grown, L)) return true;
    }
  }
  return false;
}

/** how near a round's legs pass a point (m; the legs' own lengths, nothing past where it stopped) — the cheap test ahead of `lampStruck` */
export function legsNear(pos: Vec3, legs: readonly RoundLeg[]): number {
  let best = Infinity;
  for (const s of legs) { const toT = v3.sub(pos, s.o); const d = v3.len(v3.sub(toT, v3.scale(s.d, clamp(v3.dot(toT, s.d), 0, s.end)))); if (d < best) best = d; }
  return best;
}

/** the feet a man's hands still remember: the fastest he has gone, let go over `stopTau` (and to nothing: `stopBleed`) */
export function feetHold(prev: number, speed: number, dt: number): number {
  const kept = prev * Math.exp(-dt / Math.max(AIMCOST.stopTau, 1e-3)) - AIMCOST.stopBleed * dt;
  const v = Math.max(speed, kept);
  return Number.isFinite(v) && v > 1e-4 ? v : 0;
}

export function aimCostSummary(): string {
  return `${AIMCOST.lamp ? `lamps: a real hit (bulb ${AIMCOST.bare} m)` : 'lamps: near is a hit'} · ${AIMCOST.move ? `moving ×${AIMCOST.moveK}, held ${AIMCOST.stopTau} s` : 'moving: as it was'} · lamps hit ${AIMCOST_STATS.lampHits}, passed near ${AIMCOST_STATS.lampNear}`;
}
