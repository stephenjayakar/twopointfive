// Sides for the AI (the 'Breach' showcase: two friendly OPERATIVES clearing a room of HOSTILES, everybody an AI character). Who is hostile to whom, and nothing
// else — no imports but types, so guards.ts, combat.ts, aim.ts and suppression.ts can all ask without a cycle.
//
//   guard      the building's night staff (every man a level route stands up): hostile to the player and to nobody else — today's game, exactly.
//   player     Sam.
//   operative  Sam's side, AI-led: hostile to hostiles, FRIENDLY to the player (never takes him as a foe, never fires on him, holds fire with him in the line).
//   hostile    the opposition the operatives clear: hostile to operatives AND to the player (they would shoot Sam too).
//   guard ↔ hostile, guard ↔ operative: NEUTRAL — they never meet (the staff are parked or absent while the showcase room runs); a neutral is nobody's foe and
//   nobody's target, and a man holds his fire for a neutral in his line as he would for one of his own.
//   civilian   the building's own night people — a cleaner, a late worker (civilians.ts): hostile to NOBODY and nobody hostile to them. They carry nothing, fight
//              nobody, and are kept in Game.civilians, not Game.guards, so no AI side ever acquires, lines up or holds fire round one; what they do about Sam
//              (run, tell a guard, ring it in) is their own module's. The row is here so a held / downed civilian's Guard record has a side to name.
// The table is the whole rule: isHostile(a, b). It is symmetric today; nothing relies on that.
import type { Game, Guard } from './game';
import type { Character } from './character';
import { WORDS } from './words';   // (a leaf: nothing of the game behind it)

export type Team = 'guard' | 'operative' | 'hostile' | 'player' | 'civilian';
export const TEAMS: Team[] = ['guard', 'operative', 'hostile', 'player', 'civilian'];

/** HOSTILE[a][b]: does side `a` treat side `b` as an enemy (perceive him as a threat, take him as a foe, fire on him, let rounds find him). */
export const HOSTILE: Record<Team, Record<Team, boolean>> = {
  guard:     { guard: false, operative: false, hostile: false, player: true,  civilian: false },
  operative: { guard: false, operative: false, hostile: true,  player: false, civilian: false },
  hostile:   { guard: false, operative: true,  hostile: false, player: true,  civilian: false },
  player:    { guard: true,  operative: false, hostile: true,  player: false, civilian: false },
  civilian:  { guard: false, operative: false, hostile: false, player: false, civilian: false },
};
export function isHostile(a: Team, b: Team): boolean { return HOSTILE[a][b]; }
/** A SCENARIO'S DEFENDER, for the words of a line both sides' AI says (words.ts; false with the switch off): a spawned hostile is up against a TEAM — 'find them',
 *  not the night staff's 'find him' — and the callsign he carries ('Tango 2', 'Door man') is the PLAYER's label for him, no name his own side would say. */
export const defenderWords = (gd: Guard): boolean => WORDS.on && !!gd.unit && gd.team === 'hostile';
/** the name a man's own side calls him by in a line — null for a defender (above): the caller says 'one of ours', or leaves the name out */
export const spokenName = (o: Guard): string | null => defenderWords(o) ? null : o.callsign;
/** THE QUIET MISSION WITH A PARTNER (quiet.ts): the one floor where the night staff and an operative meet. On for that run, the staff take him as they take
 *  Sam — seen by the same eye, a foe, shot at — and he them (his takedowns and his rounds land); off (every other run, and always when no such run is up) the
 *  two are NEUTRAL, as the table above is written. Counted — though only ONE Game's run has it at a time: quiet.ts hands the module switches to whichever Game is running (`current()`), so the count is 0 or 1
 *  and two Games in one process (the tools) each get it for their own frames. */
let staffOps = 0;
export function staffVsOperatives(on: boolean) {
  staffOps = Math.max(0, staffOps + (on ? 1 : -1));
  HOSTILE.guard.operative = HOSTILE.operative.guard = staffOps > 0;
}

/** the side a Character is on: Sam's, or that of the Guard whose body it is ('guard' for a stray the game does not know) */
export function teamOfChar(g: Game, c: Character): Team {
  if (c === g.player.char) return 'player';
  return g.guards.find(x => x.char === c)?.team ?? 'guard';
}
/** the side of the character with this id (events and suppression carry ids, not objects) — 'player' for Sam's id, else the living or dead Guard's, else 'guard' */
export function teamOfId(g: Game, id: number): Team {
  if (id === g.player.char.id) return 'player';
  return g.guards.find(x => x.char.id === id)?.team ?? 'guard';
}

// ---------------------------------------------------------------- a man's FOE (Guard.foe): Sam, a hostile AI man, or nobody yet
/** Is `o` (an AI man, or Sam) an enemy of this man's side. */
export function hostileTo(gd: Guard, o: Guard | 'player'): boolean { return isHostile(gd.team, o === 'player' ? 'player' : o.team); }
/** The Character his foe is — Sam's, or the hostile AI man's; null when he has nobody (an operative before a hostile has shown himself, a man whose foe died
 *  with no other in sight). Every place in the AI that used to read g.player.char for "the man I am after" reads this. */
export function foeChar(g: Game, gd: Guard): Character | null { const f = gd.foe; return f === 'player' ? g.player.char : f ? f.char : null; }
/** His foe is out of the fight — Sam down, or the man dead. False with nobody. */
export function foeDown(g: Game, gd: Guard): boolean { const f = gd.foe; return f === 'player' ? g.player.down : !!f && f.state === 'dead'; }
/** His foe is crouched (the aim point comes down; the sight gain's crouch discount): Sam's crouch, or the AI man's crouch pose (head down under fire, a drill's knee). */
export function foeCrouched(g: Game, gd: Guard): boolean { const f = gd.foe; return f === 'player' ? g.player.crouch : !!f && f.char.anim.crouch > 0.5; }
