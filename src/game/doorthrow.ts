// A DOOR SWUNG OR KICKED INTO A MAN THROWS HIM — what the throw does to him (the maintainer: 'opening a door into the enemy should majorly confuse them' ·
// 'kicking down a door when an enemy on the side should stun or knock them out'; of an enemy's own boot: it stuns, it does not kill).
//
// The DOOR's side is doors.ts DOORTHROW (which leaf is a driven one, the carry ahead of it, the switch and its numbers): Doors.update hands back, on the
// contact of whoever a driven leaf met, DoorContact.struck — whose leaf, a boot's or not, did he stand right at it — and DoorContact.moved for anybody a leaf
// carried. This file is the game's side of both:
//   doorMan            what the doors ask about a man at a leaf (Doors.man): whose he is, whether he is folded right now (a leaf carries a folded man, it
//                      does not throw him twice), braced (just up from a fold, or in somebody's arm: no throw), calm (staff not alert or searching, any
//                      civilian: a leaf he opens short of a boot throws nobody)
//   doorThrowAfter     game.ts updateDoors, after the leaves are stepped: a carried man is settled against the walls, a struck man gets what a stun charge
//                      at arm's length gives a man, by the SAME two stamps and nothing new —
//       a guard / a teammate   FOLDED (Guard.staggerUntil: rooted, gun down, no round) and BLIND (Guard.dazzledUntil: sees nobody) for DOORTHROW.pushSecs,
//                              or .kickSecs under a boot; whatever he was at is over (a script, a burst, his path); a foe's leaf leaves him alert toward
//                              the doorway, with his man to find again (his own side's — only a boot of theirs throws him — just folds him). One who stood right at a booted door is on a knee for it (Guard.doorDownUntil).
//       Sam                    folded for the same seconds (samstun.ts staggerPlayer — rooted, gun low, no round or throw, what he was doing dropped);
//                              right at a booted door he is put in a crouch. With the player's fold switched off (SAMSTUN) only the clock is written,
//                              which keeps a leaf from striking him every frame, and nothing else of his changes.
//                              His eyes are the player's own: no white. God mode changes none of it (a stun is not a hit).
//       a civilian             the blow, and alarmed by it as by a noise at the door (civilians.ts toAlarmed); the stamp only keeps a leaf from
//                              throwing her every frame.
// By behaviour, never by hit points: nothing here hurts or kills anybody, and no rule of the mission is read or written (a stunned Sam fails nothing here).
import type { Game, Guard } from './game';
import { DOORTHROW, MAN_FOLDED, MAN_BRACED, MAN_CALM, type DoorContact, type DoorStrike } from './doors';
import { PLAYER_ID } from './consts';
import { v3, type Vec3 } from '../math/vec';
import { SAMSTUN, samStaggered, staggerPlayer } from './samstun';
import { endGuardScript } from './squad';
import { toAlarmed } from './civilians';
import { isHostile, type Team } from './teams';

/** QA: men thrown since the last reset (by a pushed / shoved leaf · by a boot · of those, put on a knee) and frames a leaf carried a man */
export const DOORTHROW_STATS = { pushed: 0, kicked: 0, floored: 0, carried: 0 };

/** whose man: Sam and his squad · the defenders · a civilian (her own) */
const sideOf = (t: Team): number => t === 'player' || t === 'operative' ? 1 : t === 'civilian' ? 3 : 2;
const manOf = (g: Game, id: number): Guard | undefined => g.guards.find(x => x.char.id === id) ?? g.civilians.find(x => x.char.id === id);

/** Doors.man (set by the Game): MAN_SIDE | MAN_FOLDED | MAN_BRACED | MAN_CALM for the man with this id; 0 = nobody the game knows */
export function doorMan(g: Game, who: number): number {
  const T = DOORTHROW, now = g.time;
  if (who === PLAYER_ID) { const pl = g.player; return 1 | (samStaggered(g) ? MAN_FOLDED : 0) | (g.puppet || (pl.staggerUntil >= 0 && now < pl.staggerUntil + T.again) ? MAN_BRACED : 0); }
  const gd = manOf(g, who); if (!gd) return 0;
  const until = Math.max(gd.staggerUntil, gd.dazzledUntil), side = gd.civ ? 3 : sideOf(gd.team);   // (−1: never folded — not 'just up' in a game's first seconds)
  return side | (now < until ? MAN_FOLDED : 0) | (gd.held || (until >= 0 && now < until + T.again) ? MAN_BRACED : 0) | (side === 3 || (side === 2 && gd.state !== 'alert' && gd.state !== 'search') ? MAN_CALM : 0);
}
/** whose leaf it was, for the teams' own table (nobody the game knows: no foe's) */
const teamOf = (g: Game, id: number): Team | null => id === PLAYER_ID ? 'player' : manOf(g, id)?.team ?? null;

/** game.ts updateDoors, right after the leaves are stepped (Sam's own place is settled by the caller, as after any leaf that moved him) */
export function doorThrowAfter(g: Game, contacts: DoorContact[]): void {
  if (!DOORTHROW.on) return;
  for (const c of contacts) {
    if (!c.moved && !c.struck) continue;
    if (c.moved) DOORTHROW_STATS.carried++;
    if (c.who === PLAYER_ID) { if (c.struck) throwSam(g, c.struck); continue; }
    const gd = manOf(g, c.who); if (!gd || gd.state === 'dead') continue;
    if (c.moved) { const p = gd.char.pos; g.col.collideCircle(p, 0.3, 0.2, 1.5); g.col.clampToWorld(p, 0.3); gd.char.update(0); }   // (he has no walk this frame to keep him out of the wall the leaf carried him at: the statics are asked here, and his bones re-baked where he now is)
    if (c.struck) throwMan(g, gd, c.struck);
  }
}

const count = (s: DoorStrike) => { if (s.hard) DOORTHROW_STATS.kicked++; else DOORTHROW_STATS.pushed++; if (s.floor) DOORTHROW_STATS.floored++; };

function throwMan(g: Game, gd: Guard, s: DoorStrike): void {
  if (gd.held) return;
  const T = DOORTHROW, secs = s.hard ? T.kickSecs : T.pushSecs, c = gd.char, away: Vec3 = [s.dir[0], 0, s.dir[1]], at = s.door.frameCentre, until = g.time + secs;
  c.anim.hitFrom(away); g.audio.play('bodyHit', v3.add(c.pos, [0, 1.1, 0]), s.hard ? 0.8 : 0.55, { rate: s.hard ? 0.9 : 1.05 });
  gd.staggerUntil = Math.max(gd.staggerUntil, until); count(s);
  if (gd.civ) { toAlarmed(g, gd, 'noise', [at[0], 0, at[2]], false); return; }
  if (gd.script) endGuardScript(gd, gd.state === 'patrol' ? 'suspicious' : gd.state === 'search' ? 'search' : gd.state === 'alert' ? 'alert' : 'suspicious');   // (choreography ends where he stands, as a ring ends it)
  gd.dazzledUntil = Math.max(gd.dazzledUntil, until); gd.dazzledAt = v3.copy(at); gd.reactT = Math.max(gd.reactT, secs); gd.weapon.burst = null;
  gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.speed = 0; c.vel = [0, 0, 0];
  if (s.floor) gd.doorDownUntil = Math.max(gd.doorDownUntil, until);
  const by = teamOf(g, s.by);
  if (by && isHostile(by, gd.team)) { gd.awareness = Math.max(gd.awareness, T.aware); if (gd.state !== 'alert' || !gd.lastKnown) gd.lastKnown = [at[0], 0, at[2]]; }   // (a foe's leaf: he comes back alert toward the doorway — his own side's only folds him)
}

function throwSam(g: Game, s: DoorStrike): void {
  const pl = g.player, secs = s.hard ? DOORTHROW.kickSecs : DOORTHROW.pushSecs; if (pl.down || g.puppet) return;
  if (!SAMSTUN.on) { pl.staggerUntil = Math.max(pl.staggerUntil, g.time + secs); count(s); return; }   // (the player's fold is switched off: the clock only)
  staggerPlayer(g, secs, [s.dir[0], 0, s.dir[1]]);
  g.audio.play('bodyHit', v3.add(pl.char.pos, [0, 1.1, 0]), s.hard ? 0.8 : 0.55, { rate: s.hard ? 0.9 : 1.05 });
  if (s.floor) pl.crouch = true;
  count(s);
}
