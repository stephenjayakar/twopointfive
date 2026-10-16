// The ways a mission has been won, on its card on the start page: the end card's four pips (ui/verdictPips.ts), read from what this machine keeps
// (ui/verdictStore.ts) for that mission at the difficulty now picked. Nothing won yet = four dim marks; a way won is lit; two = the gold frame.
//
// The mission list is the menus' (ui/missions.ts, ui/startpage.ts) and is not edited: this file only DRESSES the rows it finds — every
// `#missions .mrow[data-mission]` gets one `.vpips` child, made again when what is kept or the difficulty changes — from a MutationObserver on `#missions`,
// so a list drawn again (a group opened, the page reopened) is dressed again by itself. Training rows are lessons, not runs to be won: they get none.
// Off with the verdict's own switch (`VERDICT.on`, ?noverdict): no row is touched. Styled in index.html (`#missions .mrow > .vpips`).
import { VERDICT, type KeptNote } from '../game/verdict';
import { difficultyNow } from '../game/difficulty';
import { ALL_MISSIONS } from '../scene/scenarioList';
import { recordOf, verdictKey, keptWays } from './verdictStore';
import { pipsEl } from './verdictPips';

/** a mission that can be won some way (every row but the training lessons and ids the list does not know) */
export function rowEarns(id: string): boolean { const e = ALL_MISSIONS.find(m => m.id === id); return e ? e.group !== 'training' : id === 'solo-night'; }

/** Dress every mission row under `root` (default the page's `#missions`). Idempotent: a row whose pips already say what is kept is left alone. Returns how
 *  many rows carry pips. `ways` (the checks) = a reader other than this machine's store. */
export function dressMissionRows(root: ParentNode | null = typeof document !== 'undefined' ? document.getElementById('missions') : null,
  ways: (id: string) => KeptNote['ways'] = id => keptWays(recordOf(verdictKey(id, difficultyNow())))): number {
  if (!root) return 0;
  let n = 0;
  for (const row of Array.from(root.querySelectorAll('.mrow[data-mission]')) as HTMLElement[]) {
    const id = row.getAttribute('data-mission') ?? '', had = Array.from(row.children).find(c => (c as HTMLElement).className?.split?.(' ').includes('vpips')) as HTMLElement | undefined;
    if (!VERDICT.on || !rowEarns(id)) { if (had) row.removeChild(had); continue; }
    const w = ways(id), sig = (['doors', 'walls', 'dark', 'quiet'] as const).map(a => w[a] ? `${a}${w[a]!.first ? '1' : ''}${w[a]!.clean ? 'c' : ''}` : '').join(',');
    n++;
    if (had && had.getAttribute('data-ways') === sig) continue;
    const pips = pipsEl(w); pips.setAttribute('data-ways', sig); if (!sig.replace(/,/g, '')) pips.className += ' none';
    if (had) row.replaceChild(pips, had); else row.appendChild(pips);
  }
  return n;
}

let watching = false;
/** Keep the page's mission rows dressed for as long as the page lives (main.ts, once, before the boot card paints). */
export function watchMissionRows() {
  if (watching || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const root = document.getElementById('missions'); if (!root) return;
  watching = true;
  let due = false;
  const run = () => { due = false; try { dressMissionRows(root); } catch { /* a row that cannot be dressed is left as the list drew it */ } };
  const ask = () => { if (!due) { due = true; queueMicrotask(run); } };
  new MutationObserver(ask).observe(root, { childList: true, subtree: true });
  // (the difficulty is picked by a click on the page — its row is not under a mission row, so no mutation need follow — and what is kept can change in
  // another tab: both are asked again here)
  root.addEventListener('click', () => setTimeout(ask, 0)); root.addEventListener('keyup', () => setTimeout(ask, 0));
  addEventListener('storage', e => { if (!e.key || e.key === 'twopointsix.verdicts') ask(); });
  ask();
}
