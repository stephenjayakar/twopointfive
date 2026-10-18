// SEEN WALK — the walk an order gives a man keeps off lit floor that a room nobody of the team has cleared can see.
//
// Found at the glasshouse (a glazed front on a floodlit forecourt): the squad's own walk to a door went past lit glass, in plain view of rooms nobody had
// been in. The maintainer, asked whether to build a rule for glass (10-16): "can that just work with the regular visibility systems? men will consider
// themselves visible in that condition". So there is no rule for glass here. A man asks of the floor ahead what a defender's eye asks of him:
//   LIT     the place's own steady light at that floor, on the meter's scale (calmtorch.ts placeLight: nothing anybody carries), at or over `litAt` — the
//           bar the sneak already calls lit (sneak.ts SNEAK.litAt);
//   IN VIEW a sight line to it (collision.ts segmentBlocked: glass passes it, a wall or a door's leaf stops it, as for every eye in the game) from where
//           somebody might stand in a room the team has not been in (cleared.ts: its floor, one point every `eyeStep` cells each way, at `eyeY`), inside
//           the reach a guard's eye has of a man that lit (guards.ts eyeReach).
// Floor that is both is priced `dear` to the walker, as the lane of a door standing open onto uncleared floor already is (doorway.ts doorwayLanePrice),
// and under the lanes' kind of bargain (orders.ts route, laneWay — asked after the lanes, of the way they left him): the way round is taken only where it
// takes no door the short way does not, runs at no lock, crosses no more uncleared room and no more lane, is at most `long` times as long + 1 m, and is
// `less` metres or more the less in view. No such way: the way as it was — an order is never refused and a mark never moved for it. A spot the player points at is his order: only the way to it is weighed.
// Glass comes out of it because sight lines pass glass; so does a window, an open door's lane, a gap in a wall.
//
// WHOSE WALKS: every walk orders.ts route() finds that is not a menu's question — an order's own, a man back on his order, the marks a door tool or a
// charge walks its men to (they are assigned through the same router, as the lanes are), and the walk the squad's throw planner reads of that router.
// Not the men following Sam, not Sam.
//
// COST: asked when a walk is begun, and by the throw planner while its page is open (squadthrow.ts walkLine: a few spots each time it plans again). A
// metre block of floor is read once a tick and shared by every walk asked that tick: its light, then one line per eye in reach until one is clear. Only
// inside the box of the short way + `margin`. Nothing is kept past the tick: what the picture asks must never decide what the game reads.
//
// SEENWALK.on: ON in the page (?seenwalk=0), off here and on the frozen stand (TPS_SEENWALK=1). Check: tools/qa/seenwalk-check.ts (SEENWALK_BREAK=1).
// Headless: the light is the CPU stand-in's and the lines are the collision's. Never seen on a GPU; nobody has played it.
import { SideMap } from '../math/side';
import type { Game } from './game';
import type { Vec3 } from '../math/vec';
import { placeLight } from './calmtorch';
import { eyeReach } from './guards';

export const SEENWALK = {
  on: false,
  /** floor is lit at this much of the meter (0‥1) · what a block of it costs the walker (× the metre) */
  litAt: 0.1, dear: 6,
  /** a way round is taken when it is at most this many times as long (+ 1 m) · and this many metres or more the less in view */
  long: 1.35, less: 1.5,
  /** an eye every this many nav cells each way of an uncleared room's floor · at this height (m) */
  eyeStep: 4, eyeY: 1.6,
  /** floor is read inside the short way's box grown by this (m); beyond it every block is dear: a way round does not go further out than that */
  margin: 8,
};
export const SEENWALK_DEFAULTS: typeof SEENWALK = { ...SEENWALK };
/** walks asked · blocks of floor read · sight lines cast · walks that had a metre in view · ways round taken */
export const SEENWALK_STATS = { asks: 0, blocks: 0, lines: 0, inView: 0, round: 0 };

interface Shared { t: number; known: number; nav: unknown; stamp: string; eyes: { x: number; z: number }[]; memo: Map<number, number> }
const shared = new SideMap<Game, Shared>('seenwalk.shared');
/** what is kept of this game, FOR THE TICK ONLY: thrown away with the clock moved, a room cleared, the floor changed (a wall blown), a door moved, locked or off its frame, a number here changed.
 *  (No longer than the tick on purpose: the picture asks walks too — the throw planner's drawn plan — and what is drawn must never decide what the game reads.
 *  The clock moves at the top of a step, before anything of the game asks, so the game never reads a block the picture read first of another moment's floor.) */
function sharedOf(g: Game): Shared {
  const K = SEENWALK, C = g.cleared, nav = g.col.nav; let doors = '';
  for (const d of g.doors.list) doors += d.angle + (d.latched ? 'l' : '') + (d.locked ? 'k' : '') + (d.off ? 'o' : '') + ',';
  // (the floor's cells change in place — a wall blown, furniture gone: the world's own serial says so, as stackroom.ts reads it)
  const stamp = doors + '|' + ((g.engine.world as { geomSerial?: number }).geomSerial ?? 0) + '|' + K.litAt + '|' + K.dear + '|' + K.eyeStep + '|' + K.eyeY; let S = shared.get(g);
  if (!S || S.t !== g.time || S.known !== C.known || S.nav !== nav || S.stamp !== stamp) { S = { t: g.time, known: C.known, nav, stamp, eyes: C.unknownEyes(K.eyeStep), memo: new Map() }; shared.set(g, S); }
  return S;
}
/** nothing kept (a restart, a checkpoint loaded: the lamps, the doors and the rooms known are another moment's) */
export function seenReset(g: Game): void { shared.delete(g); }

/** the price of the floor to a walk from `from` by `base` (the way he would be walked without this rule): `dear` on lit floor in view of an uncleared room,
 *  1 elsewhere — null when there is no room left uncleared within an eye's reach of that walk */
export function seenPrice(g: Game, from: Vec3, base: Vec3[]): ((ix: number, iz: number) => number) | null {
  const K = SEENWALK, C = g.cleared, nav = g.col.nav, cs = nav.cell, S = sharedOf(g); SEENWALK_STATS.asks++;
  if (!S.eyes.length) return null;
  let x0 = from[0], x1 = from[0], z0 = from[2], z1 = from[2];
  for (const b of base) { x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[0]); z0 = Math.min(z0, b[2]); z1 = Math.max(z1, b[2]); }
  x0 -= K.margin; x1 += K.margin; z0 -= K.margin; z1 += K.margin;
  const far = eyeReach(g, 1), eyes = S.eyes.filter(e => e.x >= x0 - far && e.x <= x1 + far && e.z >= z0 - far && e.z <= z1 + far);
  if (!eyes.length) return null;
  const memo = S.memo;
  return (ix, iz) => {
    const x = (ix + 0.5) * cs, z = (iz + 0.5) * cs; if (x < x0 || x > x1 || z < z0 || z > z1) return K.dear;   // (unread floor is not safe floor: a way round does not leave the box)
    const bx = ix >> 1, bz = iz >> 1, key = bz * 8192 + bx; let v = memo.get(key);
    if (v === undefined) { v = 1; SEENWALK_STATS.blocks++;
      // (the block's own point: its first free cell in a fixed order, so that what a block costs does not hang on which of its cells was asked first)
      let px = NaN, pz = NaN;
      for (let k = 0; k < 4 && isNaN(px); k++) { const cx = bx * 2 + (k & 1), cz = bz * 2 + (k >> 1); if (cx < nav.W && cz < nav.H && nav.blocked[nav.idx(cx, cz)] !== 1) { px = (cx + 0.5) * cs; pz = (cz + 0.5) * cs; } }
      if (!isNaN(px) && C.knownAt([px, 0, pz])) {   // (floor inside a room nobody has been in is cleared.ts's own price, not this one's)
        const lit = placeLight(g, px, pz);
        if (lit >= K.litAt) { const reach = eyeReach(g, lit), head: Vec3 = [px, 1.5, pz];
          for (const e of eyes) { if (Math.hypot(e.x - px, e.z - pz) > reach) continue; SEENWALK_STATS.lines++;
            if (!g.col.segmentBlocked([e.x, K.eyeY, e.z], head)) { v = K.dear; break; } } } }
      memo.set(key, v); }
    return v;
  };
}
