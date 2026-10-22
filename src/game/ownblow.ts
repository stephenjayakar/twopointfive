// HIS OWN CHARGE GOES OFF FROM HIS OWN ACTIONS, NOT FROM THE SQUAD'S KEY (the maintainer, 10-22, on a tutorial's 'F: blow it': "F should be reserved for
// squad. instead it should be one of our own actions").
//
// ONE SWITCH, `OWNBLOW.on` — ON in the page (host/profile.ts pageSwitches; `?ownblow=0` = as it was), OFF here and on the frozen harness stand
// (`TPS_OWNBLOW=1`; a FROZEN_HOLDS row, in the knob registry and a journal's tables: a recording from before the table replays with it off). With it on:
//
//   · A ROW OF HIS OWN LIST, 'blow the charge', wherever he stands, while a charge his own hands set (a door's — doortools.ts, a wall's — wallcharge.ts)
//     stands free and his hands are: under the rows the things in his reach had (player.ts buildInteractables), and never the highlighted row while
//     another thing has one — so a tap of the interaction key gives it only when it is the only thing to do, and with anything else in reach it is a
//     wedge of his ring (handring.ts), never past the fourth. The nearest of his own goes; a door's linked charges go with it as on any trigger.
//   · A BARE TAP NEVER SETS IT OFF WITH HIM IN ITS BLAST (interact.ts asks `ownBlowHeld`): the row is greyed and its line says 'too close: you' first; the
//     ring's wedge, or the held list's row, still does it — two presses, meant. (The tap is the key that set the charge and the key that breaks a
//     setting off: one press too many at a wall's foot would have been the blast.)
//   · THE SQUAD'S KEY (doortools.ts blowKey) NO LONGER BLOWS IT, and no longer stops at it: a press with only his own charge set goes on to whoever
//     else reads the key (the drill, a rescue's entry), as with no charge set. The key is still the word: a charge the squad set and left to his call
//     is the key's, and so is HIS charge while the squad works its door or its wall (stood off behind it, stacked on it): one press, it goes with
//     them. `keyIs` on each tool says which; the floor plan's bars (floorplan.ts waitsOnKey) read the same.
//   · The words that named the key for his own charge (the door's line, the row's hint, the message when it is set, the squad block's note) name the
//     interaction key.
//
// A mission on rails that lists the rows it offers (rails.ts `rows`) offers this one where it offers 'charge' — what he may set he may set off — and from
// the step that opens the action `blow`, or the squad's word (the key that had it): until then a tap beside his own charge does nothing. A step whose
// line names the squad's key for it carries a `blowLine` for this switch (scene/scenarios.ts LessonStep, lesson.ts lineOf).
// No dice, no clock of its own, no state: the row is derived from the charges that stand set.
import type { Game, Interactable } from './game';
import { Vec3, v3 } from '../math/vec';

export const OWNBLOW = {
  /** the switch (above). false = the squad's key blows any set charge, his own among them, and his list has no row for it */
  on: false,
};
/** who set a charge, when it was the player's own hands (doortools.ts SetCharge.by, wallcharge.ts SetWallCharge.by) */
export const SAM_BY = 'Sam';

/** the key a set charge's ROW names — a row's key column and its `line2`, which the page words as the key that action is on: the squad's (`key`: its cap,
 *  as the caller words it) while that key blows it, else the interaction's */
export const blowKeyWord = (keyIs: boolean, key: string): string => keyIs ? key : 'Space';
/** …and what a line drawn AS IT IS WRITTEN says after 'charge set' (a door's header, a note, the log): the squad's key by name while that key blows it;
 *  nothing for his own — its row, with the key it is on, is on his list */
export const blowTail = (keyIs: boolean, key: string, sep = ' · '): string => keyIs ? `${sep}${key} blows it` : '';

/** the nearest free charge of his own, a door's or a wall's (null: none) */
function ownSet(g: Game): { at: Vec3; words: string; where: string; /** it would put him down where he stands */ fatal: boolean; go: () => void } | null {
  const D = g.doorTools, W = g.wallCharge; if (!D?.set.length && !W?.set.length) return null;
  const p = g.player.char.pos, d = D?.samSet() ?? null, w = W?.samSet() ?? null; if (!d && !w) return null;
  const wAt = w ? W!.samAt(w) : null;
  if (d && (!wAt || v3.distXZ(d.door.frameCentre, p) <= v3.distXZ(wAt, p))) return { at: d.door.pos, words: D.closeWords(d), where: D.samWhere(d), fatal: false, go: () => D.trigger(d) };   // (a door's charge dazzles or stuns him, as it does anyone: the row's words warn, and it is his to take)
  return { at: wAt!, words: W!.samWords(w!), where: 'the wall', fatal: W!.samFatal(w!), go: () => { W!.blow(w!); } };
}
/** player.ts buildInteractables: the row, or null (the switch, no charge of his own standing free, a mission on rails that does not offer it yet) */
export function ownBlowRow(g: Game): Interactable | null {
  if (!OWNBLOW.on) return null; const c = ownSet(g); if (!c) return null;   // (first: nothing set is nearly every frame)
  const R = g.rails; if (!(R.offers('blow') || R.offers('charge')) || (R.locks('blow') && R.locks('word'))) return null;   // (on rails: from the step that opens `blow` — or the squad's word, the key that had it)
  return { kind: 'charge', pos: c.at, line1: `charge set${c.words} · ${c.where}`, line2: 'Space  blow the charge', inReach: true, off: c.fatal, verb: 'blow', running: false };   // (greyed by the very test that refuses the bare tap)
}
/** interact.ts, at a bare tap's release: is the highlighted row his own charge where it would put him down (the tap gives nothing; the row is greyed) */
export function ownBlowHeld(g: Game, r: Interactable | null): boolean {
  if (!OWNBLOW.on || r?.kind !== 'charge' || r.verb !== 'blow' || !ownSet(g)?.fatal) return false;
  g.msg('too close to your own charge'); return true;
}
/** game.ts, where this frame's act is read: the row given */
export function ownBlowAct(g: Game) {
  const a = g.act; if (!OWNBLOW.on || a?.kind !== 'charge' || a.verb !== 'blow' || g.player.down) return;
  ownSet(g)?.go();
}
