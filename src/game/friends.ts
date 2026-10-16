// THE PLAYER AND HIS OWN SIDE (the maintainer playing main, 10-11): two small rules about Sam's gun and the men who are not his enemies.
//
//   noSnap    "also shouldn't have any targeting overlays on friendlies" — the reticle used to take ANY living man of `g.guards` within its snap reach, so
//             a cursor near a teammate drew the red ring on him, laid Sam's aim on his chest and handed him to everything that reads `g.aimGuard` (the
//             ring airfoil's point, the OCP's torch test). On: a man who is not hostile to the player is never the reticle's — not by the loose snap, not
//             wounded, not with the cursor's own ray on his body. The aim is then the free aim along the cursor, as over empty floor.
//   lowReady  "we should have muzzle discipline for our character too! if we're aiming towards a friendly and not in combat, we go to low ready" — a rule
//             like the one his teammates have had (guards.ts muzzleCheck; its own numbers: a flat lane, no taper), for him: a gun that is up, a teammate (or
//             a rescue's hostage) standing in the line it is held along, NO FARTHER THAN WHAT IT IS AIMED AT (+ `pastM`: a friend beyond the man or the spot
//             under the reticle is not being pointed at) and within `reachM`, with nothing solid between — or, the aim free, the cursor on a teammate's body
//             — and nobody in a fight → the low ready, through the same seam a wall lowers it by (player.ts `walled`: the rifle's low carriage, the
//             pistol's stance, no round or launcher while it is down, a line that says why on a click). Down at once, up `upSecs` after the line is
//             clear, and up at once when the floor goes loud. IN COMBAT = inside `quietS` of Sam's last round or of the last loud thing in a living
//             teammate's ears (roomfight.ts hotOf: a shot, a charge, a boot), or a man hostile to him alert or searching. Never on the wall hold (the
//             stack's rifle is the wall's), with a man in his arm, hauling, or under a show / puppet.
//
// Both ON in the page (`?friendsnap` / `?nomuzzle` = as it was), both OFF in the module and on the frozen harness stand (`TPS_FRIENDS=1` / `TPS_MUZZLE=1`):
// FROZEN_HOLDS rows, in the knob registry and a journal's tables; a recording from before the table replays with both off. State: two fields on the Player
// (`friendLow`, `friendT` = the game's clock when a friend was last in the line) — a quarter second of hysteresis that runs out by itself through a beat that
// does not ask (a kick, a takedown), not saved (a load starts with the gun where the next frame's test puts it). No dice.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { hostileTo } from './teams';

export const FRIENDS = { noSnap: false, lowReady: false, reachM: 8, pastM: 0.3, clearM: 0.35, leadS: 0.3, leadMaxM: 0.4, upSecs: 0.25, quietS: 5 };
export const FRIENDS_STATS = { lowered: 0, loweredS: 0 };

/** the reticle passes this man over: he is not the player's enemy (player.ts updateAim, all three of its loops) */
export function friendNoSnap(gd: Guard): boolean { return FRIENDS.noSnap && !hostileTo(gd, 'player'); }
/** is this a man of his own side whose body the cursor's ray should know it landed on (player.ts updateAim's last loop: either rule on) */
export function friendOnRay(gd: Guard): boolean { return (FRIENDS.noSnap || FRIENDS.lowReady) && !hostileTo(gd, 'player'); }

/** is anybody in a fight, as far as Sam's own gun is concerned (see the head comment) */
export function friendsInFight(g: Game): boolean {
  if (g.time - g.player.lastFireT < FRIENDS.quietS) return true;
  for (const gd of g.guards) {
    if (gd.state === 'dead' || !gd.char.alive) continue;
    if (hostileTo(gd, 'player')) { if (gd.state === 'alert' || gd.state === 'search') return true; }
    else if (gd.unit && g.time - g.fight.hotOf(gd) < FRIENDS.quietS) return true;
  }
  return false;
}

/** the friend nearest along the line Sam's gun is held on (gun shoulder, along his aim's heading, as far as what it is aimed at and `reachM` at most), or null */
export function friendInSamsLine(g: Game, c: Character): Guard | null {
  const K = FRIENDS;
  const from: Vec3 = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const dx = Math.sin(c.aimYaw), dz = Math.cos(c.aimYaw);
  const reach = Math.min(K.reachM, Math.hypot(g.aimPoint[0] - from[0], g.aimPoint[2] - from[2]) + K.pastM);   // (a friend BEYOND the man or the spot the gun is on is not in its line: the round is for what is nearer)
  let best: Guard | null = null, bt = Infinity;
  const ask = (o: Guard) => {
    if (o.state === 'dead' || !o.char.alive) return;
    const h = o.char.bones.hips ?? o.char.pos; const rx = h[0] - from[0], rz = h[2] - from[2];
    const t = rx * dx + rz * dz; if (t < 0.15 || t > reach || t >= bt) return;   // (behind the shoulder, out of reach, or beyond a nearer friend)
    const clear = K.clearM + Math.min(K.leadMaxM, K.leadS * Math.hypot(o.char.vel[0], o.char.vel[2]));   // (more room for a man on the move)
    if (Math.abs(rx * dz - rz * dx) > clear) return;
    const chest: Vec3 = o.char.bones.chest ?? v3.add(o.char.pos, [0, 1.2, 0]);
    if (g.col.segmentBlocked(from, chest)) return;   // (a wall between: nobody is being pointed at; glass is no wall to a muzzle)
    bt = t; best = o;
  };
  for (const o of g.guards) if (!hostileTo(o, 'player')) ask(o);
  if (g.rescue.active) for (const o of g.civilians) if (g.rescue.isHostage(o)) ask(o);
  return best;
}

/** …or the friend the CURSOR is on (player.ts updateAim: its ray lands on his body before anything else). The camera looks down, so a cursor on a man's
 *  chest puts the free aim on the floor a stride beyond him as the lens sees it, and the gun's own line can pass a body's breadth to his side: to the player
 *  that is still aiming at him. Only while the aim is FREE: snapped to a light or a man, the gun is on the snap and the line test above is the whole answer. */
export function friendUnderCursor(g: Game, c: Character): Guard | null {
  const o = g.aimFriend; if (!o || g.aimSnap || o.state === 'dead' || !o.char.alive) return null;
  const from: Vec3 = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const chest: Vec3 = o.char.bones.chest ?? v3.add(o.char.pos, [0, 1.2, 0]);
  return Math.hypot(chest[0] - from[0], chest[2] - from[2]) <= FRIENDS.reachM && !g.col.segmentBlocked(from, chest) ? o : null;
}

/** This frame's answer for the player: is his raised gun down for a friend (`up` = a gun is up or about to be: the rifle in the shoulder, the pistol in the
 *  hand). Asked once a frame from player.ts; with the switch off it writes nothing. The answer = the man it is down for (the click's line; null inside the
 *  beat after he left the line), or false = not lowered. */
export function samOffFriend(g: Game, c: Character, up: boolean, dt: number): Guard | null | false {
  const pl = g.player;
  if (!FRIENDS.lowReady) { pl.friendLow = false; return false; }
  const live = up && !g.touring && !g.puppet && !pl.wall && !pl.holding && !pl.dragging && !friendsInFight(g);
  const o = live ? friendInSamsLine(g, c) ?? friendUnderCursor(g, c) : null;
  if (o) { if (!pl.friendLow) FRIENDS_STATS.lowered++; pl.friendLow = true; pl.friendT = g.time; }
  else if (pl.friendLow && (!live || !(g.time - pl.friendT >= 0 && g.time - pl.friendT <= FRIENDS.upSecs))) pl.friendLow = false;
  if (pl.friendLow) FRIENDS_STATS.loweredS += dt;
  return pl.friendLow ? o : false;
}
