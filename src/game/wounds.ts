// WOUNDS — a round does not always kill: WHERE IT LANDED decides whether the man dies or goes down wounded, on every side alike.
//
// THE RULE (hitZone — geometry only, never a counter; there are no hit points anywhere in this file and no state a second round adds up):
//   · the round's line through the HEAD or the NECK                                  → dead
//   · through the MIDDLE of the trunk (within WOUND.centre of the spine's line:
//     heart, lungs, spine, the great vessels)                                        → dead
//   · through the trunk's EDGE (flank, shoulder, the arm beside it)                  → WOUNDED
//   · through a LEG                                                                  → WOUNDED
// A WOUNDED man is DOWN AND OUT OF THE FIGHT: his gun leaves his hand, he sinks to a knee doubled over the wound or goes onto his back with a knee drawn up
// (character.ts `wound` — the library's own clips held short of their ends, the support hand pressed to the ribs / the thigh), and to every question the floor asks
// he is what a man out cold already is: state 'dead' with downKind 'wounded' (game.ts isBreathing) — no target for anybody's AI, no order reaches him, his side
// counts him lost, his body is found and called in. What differs is what is SEEN and SAID: he breathes, holds the wound, and the calls over him say so.
// He is no live threat (nothing in his hands), so nobody's AI puts another round into him. The PLAYER's rounds still find him — and the same rule answers again:
// the head or the middle finishes him, anything else changes nothing (a second flank wound is not a death: that would be a counter).
//
// What is NOT wounded by this rule: a civilian, the man in Sam's arm, anybody in a showcase (their rounds are choreography), Sam himself (his vest is hitPlayer's
// own, older rule), and every way down that is not a round (the cross, the choke, a ring, an execution, a blast — a blast that should wound is the blast's owner's).
//
// THE SWITCH: WOUND.on — `?wounds` in the page, `--wounds` natively, TPS_WOUNDS=1 under the harness. OFF = fireWeapon asks one question that answers 'shot' and
// the game is what it was, digest for digest (roundDoes's first line).
import type { Game, Guard } from './game';
import { FOLD_WITH, type Character } from './character';
import { v3, type Vec3 } from '../math/vec';
import { missionLive } from './mission';
import { chronDown } from './chronicle';
import { witnessKill } from './guards';

export type WoundZone = 'head' | 'centre' | 'side' | 'leg';
/** the record on a wounded man (Guard.wound; null on everybody else): where the round landed, how he is posed, when, and whose side's round it was */
export interface Wound { zone: 'side' | 'leg'; pose: 'knee' | 'back'; t: number; }

export const WOUND = {
  on: false,
  /** m — a round whose line passes within this of the trunk's own line (hips → chest → neck) is through the middle of him */
  centre: 0.105,
  /** m — … and within this of the neck → crown line is through the head or the neck */
  head: 0.125,
  /** m of the round's travel that is looked at: `lead` before it enters his hit column (a doubled-over man's head stands proud of it), `depth` on from there */
  lead: 0.4, depth: 0.7,
  /** m of clear floor behind a man for the fall onto his back (else he goes to a knee where he stands) */
  backRoom: 1.9,
};
FOLD_WITH.on = () => WOUND.on;   // the stagger's FOLD (character.ts MOVES.fold: a man knocked about and still up stays doubled over) comes up with this switch — off, a staggered man's trunk is the base's (character.ts is a leaf of the import graph: safe at the top level)
/** what the rule has answered since the last reset — the probes and the tallies read it: first rounds (dead / wounded, by zone), then second rounds into a wounded man.
 *  Beside the knob table, not in it: journal.ts files WOUND with a recording and a replay must not have its counters written back. */
export const WOUND_STATS = { dead: 0, wounded: 0, byZone: { head: 0, centre: 0, side: 0, leg: 0 } as Record<WoundZone, number>, again: 0, finished: 0 };
try { const q = new URLSearchParams(location.search); if (q.has('wounds')) WOUND.on = q.get('wounds') !== '0'; if (q.has('nowounds')) WOUND.on = false; } catch { /* no page (the harness, the native host: they set it themselves) */ }
export function resetWoundStats() { const S = WOUND_STATS; S.dead = S.wounded = S.again = S.finished = 0; S.byZone.head = S.byZone.centre = S.byZone.side = S.byZone.leg = 0; }

/** closest distance between segments p1→q1 and p2→q2 */
function segDist(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = v3.sub(q1, p1), d2 = v3.sub(q2, p2), r = v3.sub(p1, p2);
  const a = v3.dot(d1, d1), e = v3.dot(d2, d2), f = v3.dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) return v3.len(r);
  if (a <= 1e-9) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = v3.dot(d1, r);
    if (e <= 1e-9) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = v3.dot(d1, d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return v3.len(v3.sub(v3.mad(p1, d1, s), v3.mad(p2, d2, t)));
}

/** WHERE THE ROUND LANDED: the round entered the man's hit column `tHit` along ro → rd; the stretch of it about that point (WOUND.lead before, WOUND.depth after) is measured against his own bones as they
 *  stand this frame — the neck → crown line, the trunk's line hips → spine → chest → neck, and each leg's thigh → shin → foot. Pure geometry off the pose. */
export function hitZone(c: Character, ro: Vec3, rd: Vec3, tHit: number): { zone: WoundZone; head: number; trunk: number; leg: number } {
  const b = c.bones, A = v3.mad(ro, rd, Math.max(0, tHit - WOUND.lead)), B = v3.mad(ro, rd, tHit + WOUND.depth);   // (lead: a head or a knee standing proud of the hit column is crossed BEFORE the column is entered)
  const line = (...k: string[]) => { let d = 9; for (let i = 0; i + 1 < k.length; i++) { const p = b[k[i]], q = b[k[i + 1]]; if (p && q) d = Math.min(d, segDist(A, B, p, q)); } return d; };
  const head = b.neck && b.head ? segDist(A, B, b.neck, v3.mad(b.head, v3.normalize(v3.sub(b.head, b.neck)), 0.16)) : 9;
  const trunk = line('hips', 'spine2', 'chest', 'neck'), leg = Math.min(line('thighL', 'shinL', 'footL'), line('thighR', 'shinR', 'footR'));
  const zone: WoundZone = head <= WOUND.head ? 'head' : trunk <= WOUND.centre ? 'centre' : leg < trunk ? 'leg' : 'side';
  return { zone, head, trunk, leg };
}

/** combat.ts fireWeapon, for the man the round stopped in: what it does to him — 'shot' (dead: killGuard as ever — and the only answer with the switch off),
 *  'side' / 'leg' (WOUNDED there: killGuard with kind 'wounded' and that zone — every book it keeps, then woundDown in place of the ragdoll), or 'none' (a round
 *  into a man already down wounded: this function has dealt with it — finished him, or left him as he is). */
export function roundDoes(g: Game, gd: Guard, ro: Vec3, rd: Vec3, tHit: number, hostage: boolean, byPlayer: boolean): 'shot' | 'side' | 'leg' | 'none' {
  if (!WOUND.on && !gd.wound) return 'shot';
  const S = WOUND_STATS;
  if (gd.wound) {
    const z = hitZone(gd.char, ro, rd, tHit).zone; S.again++;
    if (z === 'head' || z === 'centre') { S.finished++; finishWounded(g, gd, rd, byPlayer); }
    return 'none';
  }
  if (gd.civ || hostage || gd.held || gd.state === 'dead' || g.touring || g.director.showing) return 'shot';
  const z = hitZone(gd.char, ro, rd, tHit).zone; S.byZone[z]++;
  if (z === 'head' || z === 'centre') { S.dead++; return 'shot'; }
  S.wounded++;
  return z;
}

/** combat.ts killGuard, how 'wounded', where a shot man is handed to the ragdoll: he stays a posed figure — on his back if the round took a leg from in front of
 *  him and there is floor behind to land on, else down on one knee where he stood — everything about the fight cleared off him. */
export function woundDown(g: Game, gd: Guard, dir: Vec3, zone: 'side' | 'leg' = 'side') {
  const c = gd.char;
  c.turnDrop();   // (TURN: he goes down as the body that was drawn, and nothing turns him from here — character.ts update leaves a wounded figure's yaws alone)
  const f = c.forward(), fromFront = f[0] * dir[0] + f[2] * dir[2] < -0.25;
  const room = (y: number) => { const a: Vec3 = [c.pos[0], y, c.pos[2]], b: Vec3 = [c.pos[0] - f[0] * WOUND.backRoom, y, c.pos[2] - f[2] * WOUND.backRoom]; return !g.col.solidBlocked(a, b) && !g.col.segmentBlockedDynamic(a, b); };
  const pose: Wound['pose'] = zone === 'leg' && fromFront && room(0.25) && room(0.9) ? 'back' : 'knee';
  gd.wound = { zone, pose, t: g.time };
  lay(gd, false);
  gd.staggerUntil = -1; gd.dazzledUntil = -1;
  c.anim.hit();
  g.say(gd, zone === 'leg' ? 'my leg — I\'m down!' : 'I\'m hit — I\'m hit!');   // (he says so himself: the one line a wounded man has — heard by whoever is near, on the log otherwise)
}
/** the pose and nothing else: his animator given the wound, the fight's layers taken off him (savestate's restore lays a wounded man down settled through this) */
function lay(gd: Guard, settled: boolean, clock?: number) {
  const c = gd.char, W = gd.wound!;
  c.anim.wound = { pose: W.pose, at: W.zone === 'leg' ? 'thigh' : 'ribs', settled, clock };
  c.anim.act = null; c.anim.upper = 'none'; c.anim.speed = 0; c.vel = [0, 0, 0]; c.aimYaw = c.bodyYaw; c.aimPitch = 0; c.anim.lookYawExtra = 0;
}
/** a checkpoint's wounded man (savestate.ts): the record back on him, already down, his breath where the file caught it (`clock` = the layer's own, Character.anim.woundClock) */
export function woundRestore(gd: Guard, W: Wound & { clock?: number }) { gd.char.turnDrop(); gd.wound = { zone: W.zone === 'leg' ? 'leg' : 'side', pose: W.pose === 'back' ? 'back' : 'knee', t: +W.t || 0 }; lay(gd, true, Number.isFinite(W.clock) ? +W.clock! : undefined); }

/** A round through the head or the middle of a man already down wounded: he is dead — the record off him, the body the ragdoll's from the pose he lay in, and
 *  the books put right (shot, not breathing; by the player: a kill on the card — in place of the knockout if the wound was his own round's — a 'kill' row on the
 *  timeline after the 'wounded' one, and whoever watched it done remembers a shooting). */
function finishWounded(g: Game, gd: Guard, dir: Vec3, byPlayer: boolean) {
  gd.wound = null; gd.char.anim.wound = null;
  gd.downKind = 'shot';
  if (byPlayer) {
    const st = g.mission.stats;
    if (missionLive(g)) { if (gd.downBy === 'player' && st.knockouts > 0) st.knockouts--; st.kills++; }
    chronDown(g, gd, 'shot'); gd.downBy = 'player';
    witnessKill(g, gd, 'shot', 'player');
  }
  gd.char.ragdollize(g.col, dir, true);
  g.msg(`${gd.callsign} — finished on the floor`);
}

/** every man down wounded right now (the probes, the soak, the panel) */
export function woundedMen(g: Game): Guard[] { return g.guards.filter(x => !!x.wound); }
