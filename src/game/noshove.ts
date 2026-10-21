// TEAMMATES FALLING IN NEVER SHOVE YOU (NOSHOVE.on: on in the page, ?noshove=0; off here and on the frozen stand, TPS_NOSHOVE=1).
//
// What it answers: a man walking to his place under 'fall in' was as solid to the player as an enemy (player.ts keepOffGuards: "you are the one who yields"),
// so one whose place lay on the player's far side walked into him and shouldered him 0.2 m sideways. The squad then read that shove as the player WALKING
// (orders.ts measures his pace off the ground he covers): his place in the file moved, and a man keeping a taken room's door stepped out of "his way".
//
//   ROUND    (`round`) a man of the player's own under 'fall in', walked by his order (the fight has not got his feet), is the one who yields:
//              - his own step never takes him nearer the player than `ring` (or than he already stood): where the floor leaves his body room to pass on
//                one side he walks ROUND — the side of the player his way already lies on, else the other;
//              - his place itself inside the ring: he STOPS SHORT of it, at the ring;
//              - no room either side (a passage, a doorway): `through` on, he squeezes past as a man in a narrow doorway always did, and the player is not
//                moved; `through` off, he stops short and waits;
//              - left standing inside the player's own keep-off (a restart, a load, an enemy who shoved the player onto him): he steps back out at `back`.
//            Held short, his legs stop (squad.ts stands him: no walking on the spot, and the walker's own 'stuck' side-step is not woken).
//            The player, for his part, is never moved by such a man: only what his OWN legs closed on him this frame is taken back, so he still
//            cannot walk through a teammate. A man running from a live grenade is not such a man: he is as solid as he was.
//   OWN      (`own`) what the men he met moved the player by in a frame (anybody: a teammate on another order, an enemy walking into him) is not his
//            walking. orders.ts reads his pace and heading off his own step, less what the men took back of it: sliding round a man reads as the
//            ground he covers, a shove that only stops him counts as stopping, a shove of a standing player counts as nothing.
//
// Enemies are as solid as they were, and so is a teammate on any other order or in a fight. Off = the build as it was: every function here answers on its
// first line. State: three fields on the Player (`shoved`, `shovedT`, `shovedFrom`), written and read inside one update — nothing of them is carried from
// one frame to the next, so no save holds them. No dice.
import type { Game, Guard } from './game';
import { KEEP_OFF } from './player';
import { fragRunning } from './frag';

export const NOSHOVE = {
  on: false,
  /** a man falling in whose way lies through the player goes round him or stops short (false: he walks into him and the player is shouldered aside, as it was) */
  round: true,
  /** what men moved the player by is not the player walking (false: the squad reads a shoved player as a walking one, as it was) */
  own: true,
  /** no room to go round: he squeezes past and the player is not moved (false: he stops short and waits) */
  through: true,
  /** how near the player's centre such a man's own steps take him (m; the player's own keep-off is 0.55) */
  ring: 0.6,
  /** a man left standing inside the player's keep-off steps back out at this pace (m/s) */
  back: 1.2,
};
/** frames a man was turned round the player · held short of him · let squeeze past · stepped back out; frames a shove was kept out of the player's pace */
export const NOSHOVE_STATS = { round: 0, short: 0, through: 0, back: 0, notWalked: 0 };

const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NOSHOVE_BREAK ?? '') === '1'; } catch { return false; } })();

/** is this a man the rule has: one of the player's own under 'fall in', on his order's legs (not on the legs a live grenade lends him: guards.ts runs
 *  that leg through the same walker under a borrowed script, and a man leaving a grenade goes straight) */
export function noShoveMan(g: Game, gd: Guard): boolean {
  if (!NOSHOVE.on || BREAK || !NOSHOVE.round || gd.state === 'dead' || !gd.script) return false;
  const A = g.orders.of(gd); return !!A && A.post === null && !fragRunning(g, gd);
}

/** player.ts updatePlayer, first thing: nobody has moved him yet this frame, and this is where his own legs start from */
export function noShoveBegin(g: Game): void {
  if (!NOSHOVE.on || BREAK) return;
  const pl = g.player, p = pl.char.pos; pl.shoved[0] = pl.shoved[1] = 0; pl.shovedT = g.time; pl.shovedFrom[0] = p[0]; pl.shovedFrom[1] = p[2];
}
/** player.ts keepOffGuards: a man moved him by this much (after the walls had their say) */
export function noShoveNote(g: Game, dx: number, dz: number): void {
  if (!NOSHOVE.on || BREAK) return;
  const pl = g.player; if (pl.shovedT !== g.time) { pl.shoved[0] = pl.shoved[1] = 0; pl.shovedT = g.time; pl.shovedFrom[0] = pl.char.pos[0] - dx; pl.shovedFrom[1] = pl.char.pos[2] - dz; }
  pl.shoved[0] += dx; pl.shoved[1] += dz;
}
/** player.ts keepOffGuards, of a man the rule has who stands at (mx, mz), `l` from the player: how far the player is put back from him — what his OWN legs
 *  closed on the man this update, and no more (0: the man came to him). Measured from where he would stand had his legs not moved, so a walk past a man's
 *  shoulder never works its way inside the keep-off a frame at a time. */
export function noShoveBack(g: Game, mx: number, mz: number, l: number): number {
  const pl = g.player; if (pl.shovedT !== g.time) return 0;
  const d0 = Math.hypot(pl.shovedFrom[0] + pl.shoved[0] - mx, pl.shovedFrom[1] + pl.shoved[1] - mz);
  return Math.max(0, Math.min(KEEP_OFF, d0) - l);
}

/** orders.ts tick: the player has covered (dx, dz) since the last tick — the step his own legs took of it, or null: not asked (the switch is off).
 *  A frame in which no man moved him reads as it always did. One in which a man did reads the step his own legs took inside that update (what a door or
 *  a blast did to him since the last tick is not his walking either), less what the men took back of it — the part of their shove that runs against his
 *  step, and no more than they gave: sliding round a man is the ground he covers, walking into one who stands is standing still, and a man who walks
 *  into a standing player adds nothing. */
export function noShoveOwn(g: Game, dx: number, dz: number): [number, number] | null {
  if (!NOSHOVE.on || BREAK || !NOSHOVE.own) return null;
  const pl = g.player; if (pl.shovedT !== g.time) return [dx, dz];
  const sx = pl.shoved[0], sz = pl.shoved[1], sl = Math.hypot(sx, sz); if (sl < 1e-9) return [dx, dz];
  NOSHOVE_STATS.notWalked++;
  const p = pl.char.pos, mx = p[0] - sx - pl.shovedFrom[0], mz = p[2] - sz - pl.shovedFrom[1];
  const c = Math.min(Math.max(-(mx * sx + mz * sz) / sl, 0), sl);
  return [mx + sx / sl * c, mz + sz / sl * c];
}

/** squad.ts runGuardScript, after his step and its collisions: he stood at (x0, z0) before it. See ROUND in the head. True: he is held short this frame
 *  (the caller stands his legs). */
export function noShoveKeep(g: Game, gd: Guard, x0: number, z0: number, dt: number): boolean {
  if (!noShoveMan(g, gd)) return false;
  const K = NOSHOVE, c = gd.char, s = g.player.char.pos;
  const x1 = c.pos[0], z1 = c.pos[2], l1 = Math.hypot(x1 - s[0], z1 - s[2]); if (l1 >= K.ring) return false;
  const bx = x0 - s[0], bz = z0 - s[2], l0 = Math.hypot(bx, bz);
  const settle = (min: number, back: [number, number]): boolean => {   // the walls have their say; left nearer the player than `min` by them, he is put at `back` (true)
    g.col.collideCircle(c.pos, c.radius, 0.2, 1.5);
    if (Math.hypot(c.pos[0] - s[0], c.pos[2] - s[2]) >= min - 1e-6) return false;
    c.pos[0] = back[0]; c.pos[2] = back[1]; return true; };
  const stand = (): true => { gd.speed = 0; c.vel = [0, 0, 0]; return true; };   // (held: his legs stop — a man walking on the spot wakes followPath's stuck side-step)
  if (l1 >= l0 - 1e-6) {   // not closing on him (standing, or on his way out): inside the player's own keep-off he steps back out
    if (l1 >= KEEP_OFF - 0.005) return false;
    const ux = l1 > 1e-4 ? (x1 - s[0]) / l1 : -Math.sin(c.bodyYaw), uz = l1 > 1e-4 ? (z1 - s[2]) / l1 : -Math.cos(c.bodyYaw), step = Math.min(KEEP_OFF - l1, K.back * dt);
    c.pos[0] += ux * step; c.pos[2] += uz * step; settle(l1, [x1, z1]); NOSHOVE_STATS.back++; return false;
  }
  // closing on him inside the ring. A corner of his way that lies under the player is not walked to: the one after it, where that is a straight walk
  const under = (q: number[]) => Math.hypot(q[0] - s[0], q[2] - s[2]) < K.ring + 0.05;
  while (gd.pathI < gd.path.length && under(gd.path[gd.pathI])) {
    const nx = gd.path[gd.pathI + 1] ?? gd.script?.goal ?? null;
    if (!nx || g.col.solidBlocked([x0, 0.45, z0], [nx[0], 0.45, nx[2]])) break;   // (the last corner too: past it he walks straight at his place, so that must be a straight walk)
    gd.pathI++; }
  const goal = gd.script?.goal ?? null, wp = gd.pathI < gd.path.length ? gd.path[gd.pathI] : goal;
  const mx = x1 - x0, mz = z1 - z0, ml = Math.hypot(mx, mz), wl = wp ? Math.hypot(wp[0] - x0, wp[2] - z0) : 0;
  const fx = wp && wl > 0.3 ? (wp[0] - x0) / wl : mx / ml, fz = wp && wl > 0.3 ? (wp[2] - z0) / wl : mz / ml;   // the way he is going: the leg to his next corner (steady while he turns onto it), else this frame's step
  const rad = Math.min(K.ring, l0), ux = l0 > 1e-4 ? bx / l0 : -fx, uz = l0 > 1e-4 ? bz / l0 : -fz;   // (never nearer than he stood: the ring, for a man who came from outside it)
  const short = () => {   // held off: straight back out to where he may be
    const l = Math.hypot(c.pos[0] - s[0], c.pos[2] - s[2]), vx = l > 1e-4 ? (c.pos[0] - s[0]) / l : ux, vz = l > 1e-4 ? (c.pos[2] - s[2]) / l : uz;
    c.pos[0] = s[0] + vx * rad; c.pos[2] = s[2] + vz * rad; settle(rad, [x0, z0]); NOSHOVE_STATS.short++; return stand(); };
  if (goal && Math.hypot(goal[0] - s[0], goal[2] - s[2]) < K.ring) return short();   // his place is where the player stands: he stops short of it
  if (wp && wp !== goal && under(wp)) return short();   // (a corner under the player that he cannot cut: he waits for it)
  // which side of the player he passes: the one his way already lies on (square on: his right), if his body has the room there — else the other
  const off = bx * fz - bz * fx, room = (side: number) => { const hit = g.col.raycast([s[0], 0.45, s[2]], [fz * side, 0, -fx * side], 1.5); return (hit ? hit.t : 1.5) >= K.ring + c.radius - 0.05; };
  let side = off <= -0.04 ? -1 : 1; if (!room(side)) side = room(-side) ? -side : 0;
  if (side === 0) { if (K.through) { NOSHOVE_STATS.through++; return false; } return short(); }   // (no room either way: he squeezes past, the player unmoved — or waits)
  // round: this frame's stride, turned off his line toward that side by how squarely the player is in front of him, and never inside the ring
  const ahead = Math.max(0, -(ux * fx + uz * fz)); let dx = fx + fz * side * ahead, dz = fz - fx * side * ahead; const dl = Math.hypot(dx, dz) || 1;
  let qx = x0 + dx / dl * ml - s[0], qz = z0 + dz / dl * ml - s[2]; const ql = Math.hypot(qx, qz);
  if (ql < rad) { if (ql > 1e-4) { qx *= rad / ql; qz *= rad / ql; } else { qx = ux * rad; qz = uz * rad; } }
  c.pos[0] = s[0] + qx; c.pos[2] = s[2] + qz; NOSHOVE_STATS.round++;
  return settle(rad, K.through ? [x1, z1] : [x0, z0]) && !K.through && stand();   // (the walls eat the turn: he squeezes past after all — or stays)
}

/** one line for a tool or the debugger */
export function noShoveSummary(): string {
  const S = NOSHOVE_STATS; return `no shove ${NOSHOVE.on ? 'on' : 'off'} · frames: round ${S.round}, short ${S.short}, squeezed past ${S.through}, stepped back ${S.back} · shoves kept out of the player's pace ${S.notWalked}`;
}
