// A MAN'S CONDITION — the one place that says what state a man is in, whoever he is: the player, one of his men, a defender. The states are the ones the
// game already had in pieces (shaken: fire on him, suppression.ts · blind: `dazzledUntil` · folded: `staggerUntil` · down: one round, or a blast close to) and
// one it did not: HURT. A blast that reaches a man and leaves him standing leaves him hurt, and from then on he is never faster than a walk and his rounds go
// wider. That is all of it: a condition only ever takes something from a man. Nobody has a second round in him because of it — how a man goes down is not
// touched here, and there is no count of anything.
//
// One cost for all three, each charged where that man's speed and spread are already settled:
//   pace     an AI man through teamPace (guards.ts: every path he walks) · the player loses his sprint (player.ts)
//   spread   as if fire were on him at `hurtSup`: conditionSup, which the three readers of a man's suppression for his rounds ask (suppression.ts
//            guardFireMods and samSpread; the room fight's and the covering man's own line)
// What a man looks like in each state is the poses' to say (character.ts, dealt from conditionOf in Game.dealWeapons).
//
// CONDITION.on: OFF here and on the frozen stand (TPS_CONDITION=1 raises it), ON in the page (?nocondition). Off = no man is ever hurt and every reader below
// answers as the build did before it. tools/qa/condition-check.ts (probes.ts condition; CONDITION_BREAK=1).
import type { Game, Guard, Player } from './game';
import { SUPPRESSION } from './suppression';

export const CONDITION = {
  on: false,
  /** the fastest a hurt AI man's legs are asked for, m/s (a teammate's own top pace is 2.2, a defender's chase 2.7, a walk on patrol 1.15) */
  hurtPace: 1.5,
  /** the fire a hurt man's rounds are opened by, as if it were on him (suppression's own scalar: its flinch line is 0.3) */
  hurtSup: 0.35,
  /** how long a man stays hurt, seconds (0 = for the rest of the mission) */
  hurtSecs: 0,
  /** the score does not read wariness off one of the player's own men at rest (guards.ts tension: under an order nothing drains that number) */
  ownCalm: true,
};
export const CONDITION_STATS = { hurt: 0 };

export type Man = Guard | Player;
export interface Condition {
  /** fire on him past the flinch line: his rounds go wider */
  shaken: boolean;
  /** he sees nothing (a stun can, a charge) */
  blind: boolean;
  /** doubled up: rooted, gun down, no round */
  folded: boolean;
  /** a blast reached him and left him standing: no faster than a walk, wider rounds */
  hurt: boolean;
  /** out of the fight */
  down: boolean;
}

const isGuard = (m: Man): m is Guard => 'callsign' in m;

/** is this man hurt now (never with the switch off) */
export function isHurt(g: Game, m: Man): boolean {
  if (!CONDITION.on || m.hurtAt < 0) return false;
  return CONDITION.hurtSecs <= 0 || g.time - m.hurtAt < CONDITION.hurtSecs;
}

/** A blast reached this man and left him up (frag.ts blast, its 'wounded' result): he is hurt from now. Not a civilian, not a man the debugger keeps whole,
 *  not the player in god mode, and nobody under a showcase's choreography (its men walk the marks it was written against). */
export function conditionHurt(g: Game, m: Man): boolean {
  if (!CONDITION.on || g.touring || g.puppet) return false;
  if (isGuard(m) ? m.civ || m.god || m.state === 'dead' : g.godMode || m.down) return false;
  if (!isHurt(g, m)) CONDITION_STATS.hurt++;
  m.hurtAt = g.time; return true;
}

/** the speed a man's legs may be asked for: a hurt one's is capped (anybody else: as asked) */
export function conditionPace(g: Game, gd: Guard, speed: number): number { return isHurt(g, gd) ? Math.min(speed, CONDITION.hurtPace) : speed; }

/** the fire his rounds are opened by: what is on him, and never less than `hurtSup` on a hurt man (anybody else: `v` as it is) */
export function conditionSup(g: Game, m: Man, v: number): number { return isHurt(g, m) ? Math.max(v, CONDITION.hurtSup) : v; }

/** the score leaves this man's wariness at rest out of its tension (one of the player's own, with the switch on) */
export function conditionCalm(gd: Guard): boolean { return CONDITION.on && CONDITION.ownCalm && gd.team === 'operative'; }

/** what state a man is in (the stamps are read as they stand, whatever switch charges each its cost: the poses and the panel ask this) */
export function conditionOf(g: Game, m: Man): Condition {
  const down = isGuard(m) ? m.state === 'dead' : m.down;
  return {
    shaken: !down && !!g.tune.suppression && m.sup.v >= SUPPRESSION.flinch,
    blind: !down && g.time < m.dazzledUntil,
    folded: !down && g.time < m.staggerUntil,
    hurt: !down && isHurt(g, m),
    down,
  };
}

/** Panel / QA: 'condition ▸ you hurt · Reyes folded hurt · Ortiz blind' — every man who is in anything but good order ('all sound' when nobody is) */
export function conditionSummary(g: Game): string {
  if (!CONDITION.on) return 'condition ▸ off';
  const word = (c: Condition) => [c.shaken ? 'shaken' : '', c.blind ? 'blind' : '', c.folded ? 'folded' : '', c.hurt ? 'hurt' : ''].filter(Boolean).join(' ');
  const parts: string[] = []; const me = word(conditionOf(g, g.player)); if (me && !g.player.down) parts.push(`you ${me}`);
  for (const gd of g.guards) { if (gd.state === 'dead' || gd.civ) continue; const w = word(conditionOf(g, gd)); if (w) parts.push(`${gd.callsign} ${w}`); }
  return `condition ▸ ${parts.length ? parts.join(' · ') : 'all sound'}`;
}
