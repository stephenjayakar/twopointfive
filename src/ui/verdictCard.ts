// The verdict's part of the end card (ui/debrief.ts hosts it; game/verdict.ts made the record): how the run went, at a glance.
//
//   THE HEAD  one word (won or lost), the clock, the par medal where the level has one, the four ways this mission can be won with the ones won lit
//             (ui/verdictPips.ts), and one tick per try it took — hollow for a try lost or given up, filled for the win. A run played with a cheat on
//             says so in one tag and shows no ticks: nothing was kept of it.
//   THE MEN   one row each: his name in his pair's colour, a bar of the run that ends where he fell (a notch for every defender he dropped, a cross
//             where he went down — when, where and to whom on its tooltip), and how many he dropped. Then the defenders, and a rescue's hostages, as
//             one square each.
//   THE SLOT  an empty box under the men that other panels fill (`verdictPanels`: the death recap's) — nothing is drawn for an empty one.
//
// Plain DOM through createElement / className / textContent / title / style only: it builds on the checks' fake document. Styled in index.html (#menu .vd-…).
import type { Game } from '../game/game';
import { clock, type KeptNote, type RunVerdict, type VerdictMan } from '../game/verdict';
import { pipsEl } from './verdictPips';

/** a mission played by a squad (its end card is the men's): everything but the stealth game alone or as two */
export function squadVerdict(V: RunVerdict): boolean { return V.kind !== null && V.kind !== 'quiet'; }
/** Panels other goals put inside the end card, under the men's rows: each is called once per card with an empty box it may fill (leave it empty = nothing
 *  drawn). A panel that throws is dropped for that card. */
export const verdictPanels: ((slot: HTMLElement, game: Game, V: RunVerdict) => void)[] = [];
const TICKS_MAX = 12, SQUARES_MAX = 16;

export function verdictHead(game: Game, V: RunVerdict, kept: KeptNote | null): HTMLElement {
  const box = el('div', `vd ${V.won ? 'won' : 'lost'}${V.void ? ' void' : ''}`);
  const top = el('div', 'vd-top'); box.appendChild(top);
  const word = el('b', 'vd-word'); word.textContent = V.word; top.appendChild(word);
  const time = el('span', 'vd-time'); time.textContent = clock(V.secs); time.title = 'from the first order, stride or round'; top.appendChild(time);
  const P = game.par?.result?.();
  if (P && V.won && P.medal !== 'none') { const m = el('span', `vd-medal m-${P.medal}`); m.textContent = P.medal; m.title = game.par.shown ?? P.line; top.appendChild(m); }
  if (V.void) { const v = el('span', 'vd-void'); v.textContent = 'cheats'; v.title = 'a cheat was on during this try: nothing is kept of it'; top.appendChild(v); }
  top.appendChild(el('span', 'vd-gap'));
  if (kept?.lesson) box.classList.add('lesson');   // a Training lesson: the word and the clock, nothing graded (no ways, no tries: main.ts keeps none)
  else top.appendChild(pipsEl(kept?.ways ?? {}, V.void ? null : V.approach));
  if (kept && kept.streak > 0) {
    const n = kept.streak, shown = Math.min(n, TICKS_MAX), tries = el('span', 'vd-tries');
    tries.title = V.won ? (n === 1 ? 'won at the first try' : `won at try ${n}`) : `try ${n}`;
    if (n > shown) { const more = el('i', 'more'); more.textContent = `+${n - shown}`; tries.appendChild(more); }
    for (let i = 0; i < shown; i++) tries.appendChild(el('i', `try${i === shown - 1 ? (V.won ? ' win' : ' last') : ''}`));
    top.appendChild(tries);
  }
  if (V.why) { const why = el('div', 'vd-why'); why.textContent = V.why; box.appendChild(why); }
  return box;
}

export function verdictMen(game: Game, V: RunVerdict): HTMLElement {
  const box = el('div', 'vd-men'), T = Math.max(1, V.secs), pct = (t: number) => `${(Math.min(1, Math.max(0, t / T)) * 100).toFixed(1)}%`;
  for (const m of V.men) {
    const row = el('div', `vd-man t-${m.tone ?? 'mate'} s-${m.state}`);
    const name = el('span', 'nm'); name.textContent = m.name; row.appendChild(name);
    const bar = el('span', 'bar'), fill = el('i', 'fill'); fill.style.width = m.state === 'up' ? '100%' : pct(m.downAt); bar.appendChild(fill);
    for (const t of m.drops) { const d = el('i', 'drop'); d.style.left = pct(t); d.title = `${clock(t)} · dropped a defender`; bar.appendChild(d); }
    if (m.state !== 'up') { const x = el('i', 'fell'); x.textContent = m.state === 'dead' ? '✕' : m.state === 'wounded' ? '✚' : 'z'; x.style.left = pct(m.downAt); x.title = fellWords(m); bar.appendChild(x); }
    row.appendChild(bar);
    const n = el('b', `n${m.drops.length ? '' : ' none'}`); n.textContent = String(m.drops.length); n.title = 'defenders he dropped'; row.appendChild(n);
    box.appendChild(row);
  }
  if (V.foes.of) box.appendChild(squares('foes', 'defenders', V.foes.down, V.foes.of, `${V.foes.down} of ${V.foes.of} down`));
  if (V.hostages) box.appendChild(squares('host', 'hostages', V.hostages.alive, V.hostages.of, `${V.hostages.alive} of ${V.hostages.of} alive`));
  return box;
}
/** the slot the other panels fill (null when no panel drew anything) */
export function verdictSlot(game: Game, V: RunVerdict): HTMLElement | null {
  if (!verdictPanels.length) return null;
  const slot = el('div', 'vd-slot');
  for (const f of verdictPanels) { try { f(slot, game, V); } catch { /* a panel that cannot draw is left out */ } }
  return slot.children && slot.children.length ? slot : null;
}

/** when, where and to whom a man went down (the cross's tooltip, the map mark's) */
export function fellWords(m: VerdictMan): string {
  const how = m.state === 'dead' ? 'down' : m.state === 'wounded' ? 'down wounded' : 'out cold';
  return `${m.name} ${how} · ${clock(m.downAt)}${m.downRoom ? ` · ${m.downRoom}` : ''}${m.downBy ? ` · by ${m.downBy}` : ''}`;
}
function squares(cls: string, label: string, on: number, of: number, title: string): HTMLElement {
  const row = el('div', `vd-man vd-count ${cls}`); row.title = title;
  const name = el('span', 'nm'); name.textContent = label; row.appendChild(name);
  const sq = el('span', 'sq'), n = Math.min(of, SQUARES_MAX);
  for (let i = 0; i < n; i++) sq.appendChild(el('i', i < Math.round(on * n / of) ? 'on' : ''));
  row.appendChild(sq);
  const b = el('b', 'n'); b.textContent = `${on}/${of}`; row.appendChild(b);
  return row;
}
function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
