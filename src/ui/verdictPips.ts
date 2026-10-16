// The four ways a mission can be won, as a strip of four small marks (the end card's head; a mission's card): a way won is lit, the rest are dim, two won
// frame the strip in gold. Under a lit mark, a '1' = won at the first try, a bar = won with nobody lost. No words are drawn: each mark's tooltip carries its
// name. Plain DOM (createElement / className / textContent / title only, so it builds on the checks' fake document too); styled in index.html (.vpips).
import type { Approach, KeptNote } from '../game/verdict';

export const WAYS: readonly Approach[] = ['doors', 'walls', 'dark', 'quiet'];
export const WAY_NAME: Record<Approach, string> = { doors: 'through the doors', walls: 'through a wall', dark: 'in the dark', quiet: 'never found' };
/** 16 × 16, drawn in the text's own colour: a leaf ajar in its frame · a wall with a gap blown in it · a lamp struck out · a closed eye */
export const WAY_ICON: Record<Approach, string> = {
  doors: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 2.2h9.6v11.6H3.2z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.6 3.4l5 1.7v7.5l-5 1.7z" fill="currentColor"/></svg>',
  walls: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 3h5.2L5 5.4l1.6 2L5.2 9.6l1 1.8L5.4 13H1z" fill="currentColor"/><path d="M15 3h-4.2l1 2.6L10.4 8l1.6 2.2-1 2.8H15z" fill="currentColor"/></svg>',
  dark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2a3.9 3.9 0 0 0-2.3 7.1v1.5h4.6V9.3A3.9 3.9 0 0 0 8 2.2z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6.3 12.1h3.4v1.5H6.3z" fill="currentColor"/><path d="M2.6 13.4L13.4 2.6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  quiet: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6.6c2.2 3.2 9.8 3.2 12 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 9.4l-1 1.9M8 10.2v2.1M12 9.4l1 1.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>',
};

/** The strip. `ways` = the ways won (KeptNote.ways / a stored record read the same way), `now` = the way the run just ended was won by (the end card). */
export function pipsEl(ways: KeptNote['ways'], now: Approach | null = null): HTMLElement {
  const n = WAYS.filter(a => ways[a]).length;
  const box = document.createElement('span'); box.className = `vpips${n >= 2 ? ' gold' : ''}`;
  for (const a of WAYS) {
    const w = ways[a], pip = document.createElement('span');
    pip.className = `vpip w-${a}${w ? ' won' : ''}${a === now ? ' now' : ''}`;
    const ic = document.createElement('i'); ic.className = 'vico'; ic.innerHTML = WAY_ICON[a]; pip.appendChild(ic);
    const marks = document.createElement('span'); marks.className = 'vmarks';
    const one = document.createElement('b'); one.className = `v1${w?.first ? ' on' : ''}`; one.textContent = '1';
    const all = document.createElement('u'); all.className = `vall${w?.clean ? ' on' : ''}`;
    marks.append(one, all); pip.appendChild(marks);
    pip.title = w ? `won ${WAY_NAME[a]}${w.first ? ' · at the first try' : ''}${w.clean ? ' · nobody lost' : ''}` : `not yet won ${WAY_NAME[a]}`;
    box.appendChild(pip);
  }
  if (n >= 2) box.title = 'two ways won';
  return box;
}
