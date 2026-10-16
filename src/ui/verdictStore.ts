// What this machine keeps of the runs played (game/verdict.ts names how one run went; keeping a record is the PAGE's, never a rule's: nothing in src/game reads
// this, and with no localStorage — headless, a private window — it keeps nothing and every answer is the empty one). One key, a small map: run key → a record.
// The key is the caller's (main.ts): mission id + difficulty, so a way won on standard is not a way won on hard.
//
//   A TRY is counted when it STARTS (the squad's first order, Sam's first stride or round: verdict.ts's rule), so a try given up — a restart, a closed tab — is a
//   try all the same, and restarting before anything was done is free. `s` = the tries started since the last win: the ticks on the end card.
//   A WAY WON (doors · walls · dark · quiet) is kept for good: the fewest tries a win by it ever took, whether one of those wins lost nobody, its best time.
//   Nothing here resets by itself; `clearVerdicts` is the only way back to nothing.
import type { Approach } from '../game/verdict';

const KEY = 'twopointsix.verdicts';
export const APPROACHES: readonly Approach[] = ['doors', 'walls', 'dark', 'quiet'];

/** one way won on one mission: `tries` = the fewest tries a win by it took (1 = at the first go), `clean` = a win by it with nobody lost, `secs` = its best
 *  time in whole seconds, `wins` = how many times */
export interface WayWon { tries: number; clean: boolean; secs: number; wins: number }
/** one mission at one difficulty: `n` tries started ever, `s` started since the last win (the open one included), `w` the ways won */
export interface MissionRecord { n: number; s: number; w: Partial<Record<Approach, WayWon>> }
/** what the end card is told of the run that just ended: `streak` = which try of the streak it was (0: not counted — cheats, or nowhere to keep it),
 *  `fresh` = this win lit a way that was dim, `gold` = two ways or more are won now */
export interface Kept { streak: number; fresh: boolean; gold: boolean; rec: MissionRecord | null }

const blank = (): MissionRecord => ({ n: 0, s: 0, w: {} });
const num = (v: unknown, d = 0) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d;
/** a stored record read defensively (a spoiled or older entry is read as far as it makes sense) */
function clean(v: any): MissionRecord {
  const r = blank(); if (!v || typeof v !== 'object') return r;
  r.n = num(v.n); r.s = Math.min(num(v.s), r.n);
  if (v.w && typeof v.w === 'object') for (const a of APPROACHES) { const x = v.w[a]; if (x && typeof x === 'object') r.w[a] = { tries: Math.max(1, num(x.tries, 1)), clean: !!x.clean, secs: num(x.secs), wins: Math.max(1, num(x.wins, 1)) }; }
  return r;
}
function store(): Storage | null { try { return (globalThis as any).localStorage ?? null; } catch { return null; } }
function readAll(): Record<string, unknown> { const ls = store(); if (!ls) return {}; try { const t = JSON.parse(ls.getItem(KEY) ?? '{}'); return t && typeof t === 'object' && !Array.isArray(t) ? t : {}; } catch { return {}; } }
function write(key: string, rec: MissionRecord): boolean { const ls = store(); if (!ls) return false; try { const all = readAll(); all[key] = rec; ls.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } }

/** the key a run is kept under */
export function verdictKey(mission: string, difficulty: string): string { return `${mission}|${difficulty}`; }
/** this machine's record for a run key (a blank one when there is none) */
export function recordOf(key: string): MissionRecord { return key ? clean(readAll()[key]) : blank(); }
/** the ways won as the pips read them (ui/verdictPips.ts): per way, won at the first try · won with nobody lost */
export function keptWays(rec: MissionRecord | null): Partial<Record<Approach, { first: boolean; clean: boolean }>> {
  const ways: Partial<Record<Approach, { first: boolean; clean: boolean }>> = {};
  if (rec) for (const a of APPROACHES) { const w = rec.w[a]; if (w) ways[a] = { first: w.tries === 1, clean: w.clean }; }
  return ways;
}
/** how many ways are won (two = gold) */
export function waysWon(rec: MissionRecord): number { return APPROACHES.filter(a => rec.w[a]).length; }

/** A try has started (verdict.ts: the first order, stride or round). Returns which try of the streak it is, 0 when it is not counted (no key, no store). */
export function tryStarted(key: string): number {
  if (!key) return 0;
  const rec = recordOf(key); rec.n++; rec.s++;
  return write(key, rec) ? rec.s : 0;
}
/** The counted try has ended. A win by `approach` keeps that way (the fewest tries, nobody lost once it ever was so, the best time) and closes the streak; a
 *  loss changes nothing — the try was counted when it started. `streak` = what tryStarted answered for this run (0: not a counted try — nothing is kept). */
export function runEnded(key: string, streak: number, run: { won: boolean; approach: Approach | null; clean: boolean; secs: number }): Kept {
  if (!key || !streak) return { streak: 0, fresh: false, gold: false, rec: null };
  const rec = recordOf(key);
  if (!run.won || !run.approach) return { streak, fresh: false, gold: waysWon(rec) >= 2, rec };
  const had = rec.w[run.approach], secs = Math.floor(Math.max(0, run.secs));
  rec.w[run.approach] = had
    ? { tries: Math.min(had.tries, streak), clean: had.clean || run.clean, secs: had.secs ? Math.min(had.secs, secs) : secs, wins: had.wins + 1 }
    : { tries: streak, clean: run.clean, secs, wins: 1 };
  rec.s = 0;
  write(key, rec);
  return { streak, fresh: !had, gold: waysWon(rec) >= 2, rec };
}
/** forget one run key's record, or every record (no key) */
export function clearVerdicts(key?: string) { const ls = store(); if (!ls) return; try { if (!key) { ls.removeItem(KEY); return; } const all = readAll(); delete all[key]; ls.setItem(KEY, JSON.stringify(all)); } catch { /* nowhere to keep one */ } }
