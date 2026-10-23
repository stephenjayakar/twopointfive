// WHAT TAB SHOWS (ui/tabkey.ts 'brief'): a card over a paused game with the objective in full and the squad — each teammate, what he is doing and what
// he carries, then what the squad carries between them. The maintainer, 10-23: "if you don't have a menu open, tab opens up an
// objectives modal that also has your squad equipment?". It is the home of what the corner panel no longer says (ui/corner.ts: the line per man, loud
// or quiet, the counts). Every word on it is one the game already makes (the objective's line, orders.ts statusOf and the block's notes, kit.ts
// kitWords); this file lays them out. No page under it: `tabCard` is the card as data, `tabCardOf` the card of a game as it stands, `tabCardHtml` its
// markup. Called from the page's Tab key only (main.ts): nothing here runs at module load.
import { objectiveParts } from './corner';
import { kitWords, kitIndex, kitOf } from '../game/kit';
import { keyText } from '../host/keymap';
import type { Game } from '../game/game';

export interface TabMan { name: string; doing: string; kit: string; down: boolean; tone?: string }
export interface TabCard {
  /** the objective line's own word ('objective', 'training 2/7'; '' at a run's end) · what stands in front of it (a par, a clock) */
  label: string; note: string;
  /** the objective: its sentence, and under it the things it lists, each done, to do, or the one being called now */
  goal: string; items: { text: string; done: boolean; now: boolean }[];
  men: TabMan[];
  /** the squad as the block's title has it: loud or quiet, who the next order goes to ('loud · orders to GOLD'; '' = not said) */
  who: string;
  /** what the squad carries between them and what waits on him, as the block's notes word it ('charges 2 · bangs 3') */
  carry: string[];
}
/** An objective that lists ('clear the structure: ✓ the guard hut · [the store] · the workshop' — roomclear.ts: a tick is a room taken, brackets the one
 *  being called) as its sentence and its list; any other as its sentence alone. */
export function objectiveList(text: string): { goal: string; items: TabCard['items'] } {
  const cut = text.indexOf(': '), parts = cut < 0 ? [] : text.slice(cut + 2).split(' · ').map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return { goal: text, items: [] };
  return { goal: text.slice(0, cut), items: parts.map(p => { const done = p.startsWith('✓'), t = done ? p.slice(1).trim() : p, now = /^\[.*\]$/.test(t); return { text: now ? t.slice(1, -1) : t, done, now }; }) };
}
/** the card: `objective` the mission's line ('' = none) · `men` the squad in its order · `who` the block's title past its first word · `carry` the
 *  block's plain notes. Only a line under the word 'objective' is read for a list (a lesson's step or a run's end is its sentence). */
export function tabCard(objective: string, men: TabMan[], carry: string[], who = ''): TabCard {
  const O = objectiveParts(objective), L = O?.label === 'objective' ? objectiveList(O.text) : { goal: O?.text ?? '', items: [] };
  return { label: O?.label ?? '', note: O?.note ?? '', goal: L.goal, items: L.items, men, who, carry };
}
/** the card of a game as it stands: the squad in its order, each man's line as the block words it and the card he was staged with in a line (kit.ts
 *  kitOf: a mission that issues its own kit stages its own cards); the block's title and its plain notes (orders.ts hud: a line a man, then the notes,
 *  then the keys' lines — no notes where a lesson's frame keeps them back). Every key named is named as the page has it (keymap.ts keyText). */
export function tabCardOf(game: Game): TabCard {
  const O = game.orders, S = O.active ? O.squad() : [], block = O.hud().status[0];
  const men = S.map(gd => { const i = kitIndex(gd), m = kitOf(gd); return { name: gd.callsign, doing: keyText(O.statusOf(gd)), kit: i && m ? kitWords(i, m) : '', down: gd.state === 'dead' }; });
  return tabCard(keyText(game.objectiveText()), men, block ? block.opts.slice(S.length).filter(o => !o.key).map(o => keyText(o.text)) : [], block ? block.label.replace(/^squad(\s*·\s*)?/, '') : '');
}
const esc = (s: string): string => s.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
/** the card's markup (index.html #tabcard): a section for the objective and one for the squad, each only while it has something to say; a line with no
 *  word of its own (a run's end) stands under no heading */
export function tabCardHtml(C: TabCard): string {
  const sec = (head: string, note: string, body: string) => `<section>${head || note ? `<h4>${esc(head)}${note ? `<em>${esc(note)}</em>` : ''}</h4>` : ''}${body}</section>`;
  const obj = C.goal ? sec(C.label, C.note, `<p>${esc(C.goal)}</p>${C.items.length ? `<ul>${C.items.map(i => `<li class="${i.done ? 'done' : i.now ? 'now' : ''}">${esc(i.text)}</li>`).join('')}</ul>` : ''}`) : '';
  const squad = C.men.length ? sec('squad', C.who, C.men.map(m => `<div class="man${m.down ? ' down' : ''}${m.tone ? ` t-${esc(m.tone)}` : ''}"><b>${esc(m.name)}</b><span>${esc(m.doing)}</span>${m.kit ? `<i>${esc(m.kit)}</i>` : ''}</div>`).join('') + C.carry.map(c => `<p class="carry">${esc(c)}</p>`).join('')) : '';
  return `${obj}${squad}<footer>Press <kbd>Tab</kbd> to go back to the game.</footer>`;
}
