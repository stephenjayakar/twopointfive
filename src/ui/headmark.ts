// The mark over a man's head on the HUD (overlay.ts draws it): which glyph and which colour class, and nothing about where. Kept apart from the DOM so that a
// headless check can ask what would be drawn over a man (tools/qa/headmark-check.ts).
//
// WHOSE MARKS: the '?', the row of dots and the '◎' are the stealth game's read of a man who may find you out — how wary he is, how much has reached him,
// whether he has you lined up. Over one of your own men they say nothing you can act on (his number is not a guard's: under an order nothing drains it, so a
// can or a blast left dots standing over him for the rest of the mission), so a living teammate carries none of them. What state he is in is read off the man.
import { type Game, type Guard, isBreathing } from '../game/game';
import { guardAcquired } from '../game/aim';
import { dozeMark } from '../game/doze';
import { CONDITION } from '../game/condition';
import { MOVES } from '../game/character';

export interface HeadMark { text: string; cls: 'calm' | 'ko' | 'dead' | 'alert' | 'sus'; }

/** QA only: `true` puts the wary marks back over the player's own men (the check's break path) */
export const HEADMARK_QA = { ownWary: false };

/** one of the player's own men (the convention the rest of the display uses: bindings.ts, main.ts) */
const own = (g: Guard) => g.team === 'operative';

/** the row of dots for how much has reached a man: one at the least of it, seven at the most ('' = nothing worth a mark) */
export function waryDots(awareness: number): string { return awareness > 0.05 ? '·'.repeat(1 + Math.floor(awareness * 6)) : ''; }

export function headMark(game: Game, g: Guard): HeadMark {
  let text = '', cls: HeadMark['cls'] = 'calm'; const zz = dozeMark(game, g), wary = HEADMARK_QA.ownWary || !own(g);
  if (g.state === 'dead') { if (isBreathing(g)) { text = g.wound ? '✚' : 'zz'; cls = 'ko'; } else { text = '✕'; cls = 'dead'; } }   // out cold and breathing (the takedown, the choke, the whip, a ring to the head) reads asleep, not crossed out — the floor treats him as a body either way
  else if (g.state === 'alert') { text = wary && guardAcquired(game, g) ? '◎!' : '!'; cls = 'alert'; }   // ◎: he has you lined up — his track on you is past the aim model's first-shot gate (aim.ts; never shown with the model off, never over a man of your own)
  else if (g.state === 'suspicious' || g.state === 'search') { if (wary) { text = '?'; cls = 'sus'; } }
  else if (zz) text = zz;   // asleep in his chair (doze.ts): a 'z' that grows with each breath; at his screen with headphones on: '♪' — nothing with its switch off
  else if (wary && waryDots(g.awareness)) { text = waryDots(g.awareness); cls = 'sus'; }
  const posed = !HEADMARK_QA.ownWary && own(g) && CONDITION.on && MOVES.on > 0.5 && MOVES.dazzle > 0.5;   // (a man of your own bent away with a forearm over his eyes says it himself: no mark over him with the condition switch and that pose on)
  if (g.state !== 'dead' && game.time < g.dazzledUntil && !posed) { if (!text && own(g)) cls = 'sus'; text = '✹' + text; }   // dazzled by a stun canister (alone over a man of your own it keeps the colour it always had: whatever blinds a man also wrote the dots it stood before)
  return { text, cls };
}
