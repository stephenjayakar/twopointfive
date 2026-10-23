// THE SCORE, LEVEL BY LEVEL. The maintainer, 10-15: "we should curate the music for each level, not do it randomly". So every level has a short list of the score's pieces
// (pieces.ts) written down for it here — two: the one that opens it and the one that follows — and music.ts plays that list in its order instead of dealing from a
// shuffled bag: the first piece opens the level when play begins (off the menu, or on a page that loads straight in), the second takes over once a piece has had
// MUSIC.minutes at a calm phrase end, and round again. A retry keeps the music it has. The theme is on no list: it is the main menu's alone.
//   MUSIC.byLevel  the switch (pieces.ts): ON in the page (`?shuffle` = the shuffled bag, as it was), OFF in the module and on the frozen stand (TPS_MUSIC=1 raises it with
//                  the pieces). The listener's ears only: no rule reads it.
//   the key        a level's file name without `.json` ('office' = the bundled level), and before it `<level>:<kind>` for a mission kind that wants its own on that level
//                  (the office holds four kinds of mission: the solo night's slow lean is not a rescue's clock).
//   a new level    is a row here: tools/qa/music-check.ts ('every level') is red on a mission with no row, a row for no level, a row that is not two pieces, the theme on one.
// A level typed by hand that has no row (a test yard; the editor's own document under `?level=local` is read as the office) plays SETLIST_ELSE. Names, not indices: PIECE_NAMES is read when a list is asked for, never at module load.
import { PIECE_NAMES } from './pieces';
import { specOfQuery } from '../scene/scenarioList';

/** level (or `level:kind`) → its pieces in playing order, by name (pieces.ts PIECE_NAMES). Each row's comment is why. */
export const SETLISTS: Record<string, readonly string[]> = {
  // ---- the office (the bundled level), by what is played on it
  'office': ['Night Shift', 'Paper Walls'],                // the solo night: a slow lean on an upright bass in an empty office, then the koto
  'office:nightbreach': ['Wire Act', 'Night Shift'],       // one room, four doors, a held breath: the twelve-eight tightrope
  'office:roomclear': ['Cold Storage', 'Night Shift'],     // the careful game, room by room: the bass line walks, the break waits behind the door
  'office:rescue': ['Dead Freight', 'Cold Storage'],       // a clock: the two fast ones
  // ---- raids and strongholds
  'records': ['Paper Walls', 'Cold Storage'],              // thin partitions and a strong room: the piece named for it
  'depot': ['Dead Freight', 'Wire Act'],                   // a motor pool: freight (E minor to A minor, a fifth: the easy handover)
  'block': ['Wire Act', 'Dead Freight'],                   // a lit leg and a dark turn in every room: balance, then drive
  'block-squads': ['Dead Freight', 'Wire Act'],            // the same block held by eleven: the drive first
  'warehouse': ['Cold Storage', 'Dead Freight'],           // a racked hall and a loading dock
  'compound': ['Undertow', 'Glass Rain'],                  // eleven behind a wall at night: the bells, then frame drum and dulcimer
  'barracks': ['Wire Act', 'Undertow'],                    // two galleries that look across at each other
  'floodlit': ['Paper Walls', 'Wire Act'],                 // a lit yard to cross: both in twelve-eight, a fifth apart
  'hall': ['Undertow', 'Paper Walls'],                     // four men down a long bare hall under two guns: slow, heavy, led by drums
  'mousehole': ['Paper Walls', 'Undertow'],                // the walls are the way in
  'glasshouse': ['Glass Rain', 'Wire Act'],                // rooms walled in glass
  'pass': ['Undertow', 'Glass Rain'],                      // a teahouse under snow: bells, then the dulcimer
  'tut-sky': ['Undertow', 'Glass Rain'],                   // the first tutorial mission, a tunnel station under the same snow: the pass's own list
  'tut-solo': ['Dead Freight', 'Wire Act'],                // one man down a fuel halt's line, loud from the first second: the drive, then balance
  'tut-quiet': ['Night Shift', 'Glass Rain'],              // the tutorial's quiet house: the quiet missions' own piece, then the dulcimer
  'tut-pair': ['Night Shift', 'Undertow'],                 // the tutorial's truck park, as two: the quiet missions' own piece, then the bells
  // ---- on the clock
  'registry': ['Cold Storage', 'Wire Act'],
  'consulate': ['Wire Act', 'Cold Storage'],               // four rooms and no time to clear them: the quick twelve-eight, then the break
  'snatch': ['Dead Freight', 'Glass Rain'],                // a man who runs
  'defuse': ['Cold Storage', 'Dead Freight'],              // 1:15 on two charges: the fastest break (the second is for the retries)
  'killhouse': ['Dead Freight', 'Cold Storage'],           // a run against a medal time
  // ---- quiet
  'bazaar': ['Glass Rain', 'Paper Walls'],                 // a shuttered bazaar under curfew: two pieces with the same half step over the tonic
  'police-post': ['Night Shift', 'Wire Act'],
  'vault': ['Wire Act', 'Night Shift'],                    // tripwires
  'crossing': ['Undertow', 'Night Shift'],                 // two sentries across a lit road: slow, three against four
  'quiet-relay': ['Wire Act', 'Paper Walls'],
  'lights-out': ['Paper Walls', 'Night Shift'],
  'quiet-yard': ['Night Shift', 'Paper Walls'],
  'tut-squad': ['Dead Freight', 'Wire Act'],
  'tut-plan': ['Wire Act', 'Undertow'],                    // the plan mode mission: led from above, the squad mission's second piece first
};
/** a level with no row of its own */
export const SETLIST_ELSE: readonly string[] = ['Night Shift', 'Wire Act'];

/** a level file's name as this table keys it: without `.json`, its `-gwot` look file the same level, the office family (`office-*.json`) and no file at all = 'office' */
export function setlistLevel(levelFile: string | null | undefined): string {
  if (!levelFile || !/^[\w.-]+\.json$/.test(levelFile) || /^office(-[\w.-]+)?\.json$/.test(levelFile)) return 'office';
  return levelFile.replace(/(-gwot)?\.json$/, '');
}
/** the key's two halves as a query string names them: the level (setlistLevel of its `levelFile`) and the mission's kind */
export function setlistKey(search: string | URLSearchParams): { level: string; kind: string | null } {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  return { level: setlistLevel(q.get('levelFile')), kind: specOfQuery(q)?.kind ?? null };
}
/** the row a level and a mission kind play, the key it is under, and whether it is one written for them (false = SETLIST_ELSE, under the level's name) */
export function setlistNames(level: string, kind: string | null = null): { key: string; names: readonly string[]; own: boolean } {
  for (const key of kind ? [`${level}:${kind}`, level] : [level]) if (Object.hasOwn(SETLISTS, key)) return { key, names: SETLISTS[key], own: true };   // (hasOwn: the level's name comes off a URL)
  return { key: level, names: SETLIST_ELSE, own: false };
}
/** …as PIECE_NAMES indices, what music.ts plays (a name that is no piece, and the theme, are dropped) */
export function setlistOf(level: string, kind: string | null = null): number[] {
  return setlistNames(level, kind).names.map(n => PIECE_NAMES.indexOf(n)).filter(i => i > 0);
}
/** the list of the level a page's query string boots (main.ts says it again from the running game at every new mission: a scenario quit in the page is another kind) */
export function setlistOfQuery(search: string | URLSearchParams): number[] { const k = setlistKey(search); return setlistOf(k.level, k.kind); }
