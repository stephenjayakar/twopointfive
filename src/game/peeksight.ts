// A PEEK ROUND THE END OF A WALL LIFTS THE FOG OF WAR (the maintainer, from play on the police post, quiet, hard, the fog's cones: "peeking around a door …
// should let you see down the hallway").
//
// WHAT WAS THERE: with his back to a wall (Q), parked at an open end and still pushed toward it, the camera's look-at goes out past the corner and his neck
// cranes round it (player.ts moveOnWall: Player.wall.peek 0‥1) — but the man does not move, and the fog's eye for him is over his FEET (fogofwar.ts eyeOf:
// FogEye.at) looking where his head points: square off the wall into the room he stands in. So under the fog a peek showed the camera a hallway nobody's eye
// was in: dark, and no man in it drawn.
//
// THE RULE (PEEKSIGHT.on): while the peek is in, the fog's eye for the player is where a head leaned round that end would be — `out` metres past the end of
// the face, `off` metres off the wall's own plane (a head against the frame; never through the plane), at his own eye height — looking `turnDeg` round from
// 'along the wall' into the opening (90 = square through the doorway, past the corner). It comes in and goes with the peek's own ease, so the mask sweeps
// and does not pop. It REPLACES his own eye for as long as the peek is in (one head): under the cones the room behind his shoulder goes back under the fog
// but for the near field every eye has. Something solid standing in the way of the lean (a leaf swung across the end, a cabinet, a pane) stops the eye
// short of it. Looking under a door with the wand comes first, as it does over his own eye. On the rifle stack (wallsnap: he really steps out round the
// end, the rifle up) the same head position is measured from where he actually stands, and the look stays the rifle's own, which the player steers.
//
// KNOWN, NOT MENDED: the hold let go at full peek (stepping out round the end, Q, a takedown) puts the eye back over his feet in one frame, and on a face
// barely longer than he is wide the peek can change ends while it is still in: the mask jumps there, as the camera's own look-at does.
//
// NOT CHANGED: what anybody else sees. The guards' eyes go by his real head and chest, which stay on the wall: a peek exposes him no more than it did
// (probes.ts peek-sight digests the same run with the switch down and up, the guards live). Whether a head that is out should be a head that can be seen is
// the maintainer's call: it changes what guards see.
//
// No state of its own (read off Player.wall each frame), no dice, no clock. PEEKSIGHT.on: ON in the page (?peeksight=0), OFF here and on the frozen stand
// (TPS_PEEKSIGHT=1); a recording from before the table replays with it off (journal.ts).
import type { Vec3 } from '../math/vec';
import type { Game } from './game';
import type { FogEye } from './fogofwar';

/** `out` m: how far past the end of the face the eye stands at full peek · `off` m: how far off the wall's plane (his side of it) · `turnDeg`: how far round
 *  from 'along the wall, toward that end' it looks, into the opening (90 = square through it) — read only where an eye is a cone */
export const PEEKSIGHT = { on: false, out: 0.3, off: 0.1, turnDeg: 90 };
/** frames the peek's eye stood in for his own · of those, frames something in the way stopped it short */
export const PEEK_STATS = { frames: 0, short: 0 };

/** THE PLAYER'S EYE WHILE HE PEEKS (fogofwar.ts update asks it in place of his own eye, `own`), or null: the switch down, no hold, no peek in. */
export function peekEye(g: Game, own: FogEye): FogEye | null {
  if (!PEEKSIGHT.on) return null;
  const pl = g.player, w = pl.wall; if (!w || !(w.peek > 0) || pl.down) return null;
  const e = w.peek * w.peek * (3 - 2 * w.peek), s = w.peekDir, t = w.along, n = w.n;
  // from where he actually is (the stack's step-out and the ease onto the wall are already in own.at) to the head's place by the frame
  const u = own.at[0] * t[0] + own.at[2] * t[2], d = own.at[0] * n[0] + own.at[2] * n[2] - w.d;
  const along = Math.max(0, s > 0 ? w.hi + PEEKSIGHT.out - u : u - (w.lo - PEEKSIGHT.out)) * s, inward = Math.max(0, d - PEEKSIGHT.off);
  const at = (k: number): Vec3 => [own.at[0] + (t[0] * along - n[0] * inward) * k, own.at[1], own.at[2] + (t[2] * along - n[2] * inward) * k];
  let reach = e;
  if (g.col.solidBlocked(own.at, at(reach))) {   // (a leaf across the end, a cabinet, a pane: as far as the lean is clear, less a little)
    let lo = 0, hi = reach; for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (g.col.solidBlocked(own.at, at(m))) hi = m; else lo = m; }
    reach = Math.max(0, lo - 0.08); PEEK_STATS.short++;
  }
  PEEK_STATS.frames++;
  const p = at(reach); if (w.kind === 'stack') return { id: own.id, pos: p, look: own.look, at: p };
  // the look turns with the peek, by angle (0 = along the wall toward that end, + = through its plane), from his own to `turnDeg`: by way of 'along the
  // wall', the way a head goes round a corner — never by way of the room behind him
  const ox = (own.look[0] * t[0] + own.look[2] * t[2]) * s, oy = -(own.look[0] * n[0] + own.look[2] * n[2]);
  const from = Math.atan2(oy, ox), a = from + (PEEKSIGHT.turnDeg * Math.PI / 180 - from) * e, cs = Math.cos(a) * s, sn = Math.sin(a);
  return { id: own.id, pos: p, look: [t[0] * cs - n[0] * sn, 0, t[2] * cs - n[2] * sn], at: p };
}
/** a line for the debugger */
export function peekSummary(g: Game): string {
  const w = g.player.wall;
  return `${PEEKSIGHT.on ? 'on' : 'off'}${w && w.peek > 0 ? ` · peeking ${(w.peek * 100) | 0}%` : ''} · frames ${PEEK_STATS.frames}, stopped short ${PEEK_STATS.short}`;
}
