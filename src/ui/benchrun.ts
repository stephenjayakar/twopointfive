// THE BENCHMARK ACROSS PAGE LOADS — a level is only ever loaded at boot, so a run over the benchmark's scenes (host/benchScenes.ts) is one page per scene. What
// ties the pages into one run is this file: the address each scene is played on, and a small record in the tab's own session store (it dies with the tab, and
// nothing of it leaves the machine) that carries the lines measured so far from one page to the next. ui/bench.ts plays one page's part (a BenchLeg) and knows
// nothing of addresses or stores.
//   HOW A RUN GOES: the row (or ?bench on any address) → begin(): the record is written and the first scene's address loads. Each scene's page finds the record
//   at boot (legOfPage), plays its part and hands on (the record grows, the next address loads); the last page shows the card, and closing it loads the address
//   the run was started from.
//   THE SCENES ARE THE SET'S, NOT THE VISITOR'S: of the flags on the address the run was asked on, only the ones that change no fight ride along (CARRIED); a
//   scene's address says its own level, deal, die and difficulty, keeps no verdict of the try and files no replay of it (the fight was not the visitor's).
//   BACK DOES NOT START ANOTHER: a run asked for on the address REPLACES that address with the first scene's, and each scene's with the next.
//   A RELOAD IN THE MIDDLE DOES NOT START IT AGAIN: a page marks the record as begun on its scene before it plays, and a page that finds its own mark drops the
//   record and is a plain mission page.
import { BENCH_SCENES, BENCH_SET, type BenchSceneDef } from '../host/benchScenes';
import { SCENARIOS } from '../scene/scenarioList';
import { scenarioQuery } from '../scene/scenarios';
import type { BenchLeg, BenchStep, BenchSceneRun, BenchBoot, BenchOpts } from './bench';

const KEY = 'twopointsix.bench';
/** the word on a scene's address: its place in the set */
export const BENCH_RUN_KEY = 'benchrun';
interface Carry {
  v: 1; set: string;
  /** the address the run was started from (the card's Close goes back to it), and whether that page had already booted the game (the first scene's load is then a second load) */
  from: string; warm: boolean;
  /** the visitor's own flags that ride along on every scene's address (CARRIED) */
  keep: string[];
  /** the scene to play next · the scene a page has begun (−1: none) */
  i: number; live: number;
  /** ?bench=N as it was asked (seconds a window) · the most seconds a scene plays, where the address said (?benchcap=N: a short run) */
  secs: string | null; cap: number | null;
  /** the run's own options, where a check handed some in (ui/bench.ts BenchOpts: every page of the run starts with them) */
  opts?: Partial<BenchOpts>;
  steps: BenchStep[]; notes: string[]; scenes: BenchSceneRun[]; boot?: BenchBoot | null; away?: number;
}
const read = (): Carry | null => { try { const t = sessionStorage.getItem(KEY), c = t ? JSON.parse(t) as Carry : null; return c && c.v === 1 && c.set === BENCH_SET && Array.isArray(c.steps) ? c : null; } catch { return null; } };
const write = (c: Carry): boolean => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); return true; } catch { return false; } };
const clear = (): void => { try { sessionStorage.removeItem(KEY); } catch { /* no store: nothing was kept */ } };

/** the address scene `i` is played on: its mission's own, the deal and the die pinned by the scene's seed, its difficulty said, no verdict kept of the try (the
 *  run is the benchmark's, not the visitor's: game/verdict.ts files nothing and raises no end card), and the scene's place */
export function benchSceneSearch(S: BenchSceneDef, i: number, keep: string[] = []): string {
  const E = SCENARIOS.find(e => e.id === S.scn); if (!E) throw new Error(`no mission '${S.scn}'`);
  const own = `${scenarioQuery(E).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${S.seed}`)}&seed=${S.seed}&difficulty=${S.hard ? 'hard' : 'standard'}&noverdict&nokeep&${BENCH_RUN_KEY}=${i}`;
  const has = new URLSearchParams(own), rest = keep.filter(p => !has.has(p.split('=')[0]));
  return rest.length ? `${own}&${rest.join('&')}` : own;
}
/** the visitor's address with the benchmark's own words off it */
const plain = (search: string): string => { const keep = search.replace(/^\?/, '').split('&').filter(p => p && !/^(bench|benchcap|benchrun)(=|$)/.test(p)); return keep.length ? '?' + keep.join('&') : ''; };
/** the visitor's flags that ride along from scene to scene: the ones that change the sound or the picture's quality and nothing of the fight (an hour, a weather,
 *  a difficulty lever, a rule's off switch would make it another fight than the set's) */
const CARRIED = /^(mute|nomusic|quality)(=|$)/;
const flags = (search: string): string[] => search.replace(/^\?/, '').split('&').filter(p => CARRIED.test(p));

/** start a run from this page: the record, then the first scene's address. `warm`: this page had booted the game (the row on the title), so the first scene's
 *  load is not the machine's first. Returns why not when the tab has no session store (a run could not be carried from page to page) */
export function benchBegin(warm: boolean, loc: Location = location, opts?: Partial<BenchOpts>): string | null {
  const q = new URLSearchParams(loc.search), cap = parseFloat(q.get('benchcap') ?? '');
  const c: Carry = { v: 1, set: BENCH_SET, from: loc.pathname + plain(loc.search) + loc.hash, warm, keep: flags(loc.search), i: 0, live: -1, secs: q.get('bench'), cap: isFinite(cap) && cap > 0 ? cap : null, ...(opts ? { opts } : {}), steps: [], notes: [], scenes: [] };
  if (!write(c) || !read()) return 'this tab keeps no session store';
  const to = loc.pathname + benchSceneSearch(BENCH_SCENES[0], 0, c.keep) + loc.hash;
  if (warm) loc.assign(to); else loc.replace(to);   // (asked for on the address: that address is not left in the tab's history, where Back would ask again)
  return null;
}

/** this page's part of a run, where it is a scene's page of one under way: the scene, the window seconds asked, and the leg ui/bench.ts plays. Null = a plain
 *  page (no record, another scene's address, or a reload of a scene already begun: the record is dropped) */
export function benchLegOfPage(loc: Location = location): { scene: BenchSceneDef; secs: string | null; cap: number; opts: Partial<BenchOpts>; leg: BenchLeg } | null {
  const q = new URLSearchParams(loc.search), at = q.get(BENCH_RUN_KEY); if (at === null) return null;
  const c = read(), i = Number(at), S = BENCH_SCENES[i];
  if (!c || !S || c.i !== i || c.live === i) { if (c) clear(); return null; }
  c.live = i; write(c);
  const of = BENCH_SCENES.length;
  if (i === 0 && c.warm) c.notes.push('started from the title: the load above is a second load of the page, its shaders may have been kept by the browser');
  const leg: BenchLeg = { set: BENCH_SET, scene: { id: S.id, name: S.name }, index: i, of, secs: c.cap ?? S.secs, steps: c.steps, notes: c.notes, scenes: c.scenes, boot: c.boot, away: c.away,
    onward: next => { const n: Carry = { ...c, ...next, i: i + 1, live: -1 }; if (!write(n)) { clear(); throw new Error('the session store took no more'); } loc.replace(loc.pathname + benchSceneSearch(BENCH_SCENES[i + 1], i + 1, c.keep ?? []) + loc.hash); },
    over: () => clear(),
    closed: () => { loc.assign(c.from || loc.pathname); } };
  return { scene: S, secs: c.secs, cap: c.cap ?? S.secs, opts: c.opts ?? {}, leg };
}
