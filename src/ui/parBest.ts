// The best par total this machine has run (game/par.ts times a run; keeping a record is the PAGE's, never a rule's: nothing in src/game reads this, and with
// no localStorage — headless, a private window — it keeps nothing and says nothing). One key, a small map: run key → whole seconds. The key is the caller's
// (main.ts): level file + way in + squad size + difficulty, so a time is only ever held against the same run.
import { clock } from '../game/par';

const KEY = 'twopointsix.parbest';

/** File a finished run's total (whole seconds, as shown) under `key` and say how it stands against this machine's best there ('' = nowhere to keep one). */
export function parBest(key: string, total: number): string {
  if (!key || !Number.isFinite(total)) return '';
  try {
    const ls = (globalThis as any).localStorage; if (!ls) return '';
    let all: Record<string, number> = {}; try { const t = JSON.parse(ls.getItem(KEY) ?? '{}'); if (t && typeof t === 'object') all = t; } catch { /* a spoiled entry: start over */ }
    const best = typeof all[key] === 'number' && Number.isFinite(all[key]) ? all[key] : null;
    if (best !== null && total >= best) return `best ${clock(best)}`;
    all[key] = Math.floor(total); ls.setItem(KEY, JSON.stringify(all));
    return best === null ? 'first time on this clock' : `a new best (was ${clock(best)})`;
  } catch { return ''; }
}
