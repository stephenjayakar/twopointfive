// FRIENDLY FIRE (the maintainer, 10-19: "we should also model friendly fire. squad mates should be very careful and pretty much never do it, but the player
// should definitely be able to hit their squad mates if they're not careful. auto aim should ofc only be for enemies").
//
// Until this rule a round found only men of a side HOSTILE to the shooter's and passed through everybody else (combat.ts fireWeapon: "discipline keeps those
// rounds in, not luck"). On, for Sam's side — Sam and his operatives — a round is a round:
//
//   bodies    Sam's round finds a living teammate standing in its way as it finds anybody (what it does to him is what a defender's round does: wounds.ts
//             decides by where it landed; the log's own '<callsign> down — your round'). A teammate's round finds Sam and the other teammates the same way.
//             Only the ENTERING hit counts on a man of his own side: a muzzle already past a mate's shoulder in a stack is past him, as a laser's is.
//   care      …so the team's care has to be real. A teammate does not press with a friend anywhere his round COULD go: inside the cone its spread can throw
//             it (`coneK` × the spread the round is about to be given, about a body `bodyM` wide), as far as the round would fly — through what it can
//             pierce, and past the man he is on unless the round cannot miss that man (`sureM`) — nothing solid between. No foreknowledge of the die: the question is asked before the round's spread is drawn.
//             Two seams: the room fight's gate (roomfight.ts, beside its own friendInLine — the same hold, side step and letting go), and combat.ts
//             fireWeapon itself, for every other place a teammate's round is born (cover fire, a covered lane, a blind round, the fight AI's own trigger):
//             there the round is simply not pressed (`FRIENDLYFIRE_STATS.unpressed`).
//   words     a teammate the player's round goes past, within `nearM` of his head or chest, says what a man says of a colleague's (suppression.ts's own
//             'watch your fire!' lines, on its own clocks: one line a few seconds at most).
//
// Not here: the reticle (friends.ts FRIENDS.noSnap already passes over every man who is not his enemy, and civilians were never on its list), the low ready
// out of a fight (friends.ts lowReady: his gun still comes down off a teammate while the floor is calm — in a fight it is his to keep clear), the night
// staff and the defenders among themselves (a colleague's round passes a colleague, as ever), a blast (frag.ts has always been everybody's), a show's cast.
//
// ON in the page (`?nofriendlyfire` = as it was), OFF in the module and on the frozen harness stand (`TPS_FRIENDLYFIRE=1`): a FROZEN_HOLDS row, in the knob
// registry and a journal's tables; a recording from before the table replays with it off. No state of its own but the tally below. No dice.
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { isHostile } from './teams';
import { shotEnergy } from './glasspen';
import type { WeaponDef } from './weapons';
import { roundEnergy } from './glasspen';
import { wallPenLive, thinLine } from './wallpen';
import { foeChar } from './teams';
import { watchYourFire } from './suppression';

export const FRIENDLYFIRE = {
  on: false,
  /** the share of a round's `spread` its line can be thrown sideways by (fireWeapon adds ±spread/2 to each axis of a unit direction: 0.71 at most on the floor plan) */
  coneK: 0.75,
  /** half the breadth a friend's body is owed about that cone, m (character.ts rayHit's columns are 0.28 about the hips and the chest) */
  bodyM: 0.34,
  /** the round cannot miss the man it is for while its cone is no wider than this at his distance, m (his column is 0.28): a friend BEYOND him is then not in its way */
  sureM: 0.2,
  /** a teammate's care (the cone above). Off = only the bodies: the check's own arm, nothing a player should want */
  care: true,
  /** a teammate says so when the player's round goes past him this close, m (his head or his chest to the round's line) */
  words: true, nearM: 0.6,
};
export const FRIENDLYFIRE_STATS = { samOnMate: 0, mateOnMate: 0, mateOnSam: 0, unpressed: 0, held: 0, said: 0 };

/** is the rule running: on, and nobody's show on the stage (a show's rounds are its script's) */
export function ffLive(g: Game): boolean { return FRIENDLYFIRE.on && !g.touring && !g.director.showing && !g.puppet; }
/** a man of Sam's own side whose body a round of that side can find (combat.ts fireWeapon): living and on his feet (a man down wounded is passed, as a body on the floor is), not a show's cast */
export function ffBody(gd: Guard): boolean { return gd.state !== 'dead' && gd.char.alive && !gd.god && !gd.civ && !isHostile('player', gd.team); }
/** is this shooter's side Sam's (an operative; never the night staff or a defender) */
export function ffSide(sg: Guard | null): boolean { return !!sg && !sg.civ && !isHostile(sg.team, 'player') && !isHostile('player', sg.team); }

/** THE CARE: the friend nearest the muzzle that a round from `muzzle` at `to`, thrown as wide as `spread` can throw it, could reach — or null. `self` = the
 *  teammate asking (never his own body). `on` = the man the round is for, when `to` is his chest: a round that cannot miss him (the whole cone inside his
 *  body where he stands) stops in him, and a friend beyond him is not in its way. Level geometry only between the muzzle and the friend — what the round
 *  goes through (glass, and a thin wall or a leaf while that rule is live) is no wall to this question either; furniture never is. */
export function friendInCone(g: Game, self: Guard, muzzle: Vec3, to: Vec3, spread: number, def?: WeaponDef, on?: Character | null): 'player' | Guard | null {
  const K = FRIENDLYFIRE; if (!K.care || !ffLive(g) || !ffSide(self) || ffBroken()) return null;   // (`FRIENDLYFIRE_BREAK=1`, the check's and the measure's: the bodies without the care)
  let dx = to[0] - muzzle[0], dz = to[2] - muzzle[2]; const L = Math.hypot(dx, dz); if (L < 0.05) return null; dx /= L; dz /= L;
  const rise = (to[1] - muzzle[1]) / L, k = K.coneK * Math.max(0, spread);
  const w = def ?? self.weapon.def, energy = shotEnergy(g, self.char, w), thin = wallPenLive(g) ? roundEnergy(w) : -1;
  const reaches = (p: Vec3) => !g.col.shotBlocked(muzzle, p, 0.02, energy) || (thin >= 0 && thinLine(g, muzzle, p, thin) !== null);
  let past = Infinity;   // (how far along the line a friend still counts: all the way, unless the round is sure to stop in the man it is for)
  if (on && on.alive) { const ch = on.bones.chest ?? [on.pos[0], on.pos[1] + 1.2, on.pos[2]]; if (Math.hypot(to[0] - ch[0], to[1] - ch[1], to[2] - ch[2]) < 0.35 && k * L <= K.sureM) past = L + 0.3; }
  let best: 'player' | Guard | null = null, bt = Infinity;
  const ask = (c: Character, who: 'player' | Guard) => {
    const hips = c.bones.hips ?? c.pos, chest = c.bones.chest ?? hips;
    const mx = hips[0] - muzzle[0], mz = hips[2] - muzzle[2];
    if (mx * mx + mz * mz < 0.28 * 0.28) return;   // (the muzzle is already inside his column: past him — only the entering hit counts, combat.ts)
    let t = Infinity;   // (how far along the line his hips or his chest — a man leaning round a jamb — come inside the cone)
    for (const p of [hips, chest]) { const rx = p[0] - muzzle[0], rz = p[2] - muzzle[2]; const a = rx * dx + rz * dz; if (a > 0 && a < t && Math.abs(rx * dz - rz * dx) <= K.bodyM + a * k) t = a; }
    if (t >= bt || t > 60 || t > past) return;
    const y = muzzle[1] + rise * t, top = (c.bones.headTop?.[1] ?? c.pos[1] + 1.8) + 0.1;   // (a round laid on a man on the floor two strides off goes into the floor, not into a friend across the room)
    if (y - t * k > top || y + t * k < c.pos[1]) return;
    const cy = c.bones.chest ? chest[1] : c.pos[1] + 1.2, head: Vec3 = c.bones.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
    // something solid between them that his round does not go through: asked of his middle, his head and the two edges of his column as the line sees it (a man half out of a doorway is in the doorway)
    if (!reaches([chest[0], cy, chest[2]]) && !reaches(head) && !reaches([hips[0] + dz * 0.25, cy, hips[2] - dx * 0.25]) && !reaches([hips[0] - dz * 0.25, cy, hips[2] + dx * 0.25])) return;
    bt = t; best = who;
  };
  if (!g.player.down) ask(g.player.char, 'player');
  for (const o of g.guards) if (o !== self && ffBody(o)) ask(o.char, o);
  return best;
}

/** combat.ts fireWeapon, a teammate's round about to be born with a friend in its cone: not pressed. */
export function ffUnpressed(g: Game, sg: Guard | null, muzzle: Vec3, to: Vec3, spread: number, def: WeaponDef): boolean {
  if (!sg) return false;
  const B = def.pellets?.breach; if (B && Math.hypot(to[0] - muzzle[0], to[1] - muzzle[1], to[2] - muzzle[2]) <= B.reachM + 0.2) return false;   // (a shell put into a lock at arm's length is the door tool's: its own lines ask who stands where)
  if (!friendInCone(g, sg, muzzle, to, spread, def, foeChar(g, sg))) return false;
  FRIENDLYFIRE_STATS.unpressed++; return true;
}
function ffBroken(): boolean { return String((globalThis as any).process?.env?.FRIENDLYFIRE_BREAK ?? '') === '1'; }

/** combat.ts fireWeapon, the PLAYER's round flown from `from` to where it stopped: every standing teammate it went close past says so (the man it went into says nothing) */
export function ffPast(g: Game, from: Vec3, to: Vec3, into: Character | null) {
  const K = FRIENDLYFIRE; if (!K.words) return;
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], L2 = dx * dx + dy * dy + dz * dz; if (L2 < 1) return;
  for (const o of g.guards) { if (!ffBody(o) || o.char === into || o.held) continue;
    for (const p of [o.char.bones.head, o.char.bones.chest]) { if (!p) continue;
      const t = ((p[0] - from[0]) * dx + (p[1] - from[1]) * dy + (p[2] - from[2]) * dz) / L2; if (t < 0.02 || t > 1) continue;   // (beside or behind the muzzle: not past him)
      if (Math.hypot(from[0] + dx * t - p[0], from[1] + dy * t - p[1], from[2] + dz * t - p[2]) > K.nearM) continue;
      if (watchYourFire(g, o)) FRIENDLYFIRE_STATS.said++; break; } }
}
/** roomfight.ts: its gate held a round for a friend in the cone that its own lane did not hold (counted) */
export function ffHeld() { FRIENDLYFIRE_STATS.held++; }
/** combat.ts: a round of Sam's side has gone into a man of Sam's side — counted (who fired, who was found; nothing else reads it) */
export function ffNote(sg: Guard | null, isPlayer: boolean, intoSam: boolean) {
  const S = FRIENDLYFIRE_STATS; if (isPlayer) S.samOnMate++; else if (intoSam) S.mateOnSam++; else if (sg) S.mateOnMate++;
}
