// A MAN'S CONDITION — the one place that says what state a man is in, whoever he is: the player, one of his men, a defender. The states are the ones the
// game already had in pieces (shaken: fire on him, suppression.ts · blind: `dazzledUntil` · folded: `staggerUntil` · down: one round, or a blast close to) and
// one it did not: HURT. A blast that reaches a man and leaves him standing leaves him hurt, and from then on he is never faster than a walk and his rounds go
// wider. That is all of it: a condition only ever takes something from a man. Nobody has a second round in him because of it — how a man goes down is not
// touched here, and there is no count of anything.
//
// One cost for all three, each charged where that man's speed and spread are already settled:
//   pace     an AI man wherever his legs are asked for a speed: teamPace (guards.ts: every path he walks), stepAlongPath and the room entry's stepGate
//            (tactics.ts), which take their speed straight, and the two planners that pick where a man can run to from a grenade (frag.ts, squadthrow.ts:
//            the corner is one HIS legs make) · the player loses his sprint (player.ts: Shift is not a run for him, so it stops no reload either)
//   spread   as if fire were on him at `hurtSup`: conditionSup, which the three readers of a man's suppression for his rounds ask (suppression.ts
//            guardFireMods and samSpread; the room fight's and the covering man's own line). The larger of that and the fire really on him, never a sum;
//            how fast he fires is not touched. It rides suppression's own switch: with `tune.suppression` off nobody's rounds open, a hurt man's included.
// Only a burst (frag.ts blast: a frag, a 40 mm, the bomb a defuse lost) leaves a man hurt. A door or wall charge and the player's own charge fold a man
// and blind him as they did and leave him sound.
// What a man looks like in each state is the poses' to say (character.ts mvPost / mvArms: the fold of a man knocked about, the hunch and short step of a
// hurt one, the tucked head of one under fire), dealt by conditionPose every frame for all three alike. A showcase's cast is left as it was written.
//
// CONDITION.on: OFF here and on the frozen stand (TPS_CONDITION=1 raises it), ON in the page (?nocondition). Off = no man is ever hurt and every reader below
// answers as the build did before it. tools/qa/condition-check.ts (probes.ts condition; CONDITION_BREAK=1).
import type { Game, Guard, Player } from './game';
import { SUPPRESSION } from './suppression';
import { clamp } from '../math/vec';

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
  if (!CONDITION.on || m.hurtAt < 0 || g.touring || g.puppet) return false;   // (a showcase's cast walks the marks it was written against, whatever the mission before it left on the player)
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

/** Every frame, after the stun poses are dealt (Game.dealWeapons): each man's condition to his figure — the player's, his men's and the defenders' by the one
 *  rule. Off (and under a showcase): whatever it put on a figure comes off, and a figure it never touched is not touched. */
export function conditionPose(g: Game): void {
  const on = CONDITION.on && !g.touring && !g.director?.showing, S = SUPPRESSION;
  const deal = (m: Man) => { const an = m.char.anim;
    if (!on) { if (an.hurt !== 0 || an.shaken !== 0 || an.foldToo) { an.hurt = 0; an.shaken = 0; an.foldToo = false; } return; }
    const down = isGuard(m) ? m.state === 'dead' : m.down;
    an.foldToo = true; an.hurt = !down && isHurt(g, m) ? 1 : 0; an.hurtSide = -1;   // (his free hand is his left and it goes across to his right ribs: that is the side he favours, every man)
    an.shaken = down || !g.tune.suppression ? 0 : clamp((m.sup.v - (S.flinch - 0.1)) / Math.max(1e-3, S.pinned - (S.flinch - 0.1)), 0, 1); };
  deal(g.player); for (const gd of g.guards) if (!gd.civ) deal(gd);
}
