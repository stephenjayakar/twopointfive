// THE DIFFICULTY LEVERS' ROWS (the maintainer, 10-10: 'let's actually unbundle difficulty a bit now since i think we'll need some play testing' · 'so fog of
// war has three rungs' · 'can have other levers for enemy ai and kit etc.'): one row per lever of game/difficulty.ts LEVERS — its label, a button per rung,
// and the line that says what the lit rung does — put on the screens a mission is set up on BEFORE it starts: the mission list's sheet (ui/missions.ts,
// under its Standard | Hard row) and, where the loadout is a screen of its own (?cards), the loadout (ui/loadout.ts: a short-list row opens there).
// Standard | Hard puts every lever on that level's rung; a lever's own button moves that lever alone and is kept on this machine (setLever) — and a lever
// put back on the rung the level has for the mission shown is let go of again. What is lit is READ OFF the game's tables (leversShown), so a row moved
// under a lever by hand in the Tab panel shows as no rung lit.
//
// ON A QUIET MISSION'S ROW (game/quietfog.ts — the maintainer, 10-11: 'i think we should make it part of the fog of war difficulty slider'): `paint(…, quiet)`
// shows the fog lever with one more rung at the bottom, OFF, and it reads and moves the quiet missions' OWN pick (quietFog / setQuietFog), never the squad
// lever. The button is made only while the rule is on (QUIETFOG.on) and shown only on a quiet row. Under the fog row there, while sticky cameras are in the
// build (STICKY.on), ONE more row, Sticky cameras (None | N): the mission hands you cameras for the launcher (quietCams / setQuietCams) — so a quiet row plays
// three ways, a press each: off · a rung · the cameras. It is a row of its own, in the rows' own classes, so a screen that steps a row's buttons (the
// start page's rail) steps it like any other; it is not one of `rows` (those are the difficulty's levers).
//
// CONTROLS: a click on a rung (the keys stay the sheet's own: W S the missions, A D standard / hard). The DOM asked for is the little the probes' stand-in
// has: createElement, className, textContent, setAttribute, appendChild, onclick.
import { LEVERS, difficultyNow, leversShown, leversSet, leversBase, leversMixed, leverWords, setLever, setBase, type LeverKey } from '../game/difficulty';
import { QUIETFOG, QUIET_RUNGS, quietFog, setQuietFog, quietFogWords, quietFogAside, quietCams, setQuietCams, quietFogDefault, quietCamsDefault, type QuietRung } from '../game/quietfog';
import { STICKY } from '../game/stickycam';
import { WAND } from '../game/wand';

/** the class names of the screen the rows are put on (its own row / label / button / note looks; `on` is added to a lit button) */
export interface LeverCls { row: string; label: string; btn: string; note: string }
export type LeverLive = boolean | ((key: LeverKey) => boolean);
export interface LeverRow { key: LeverKey; el: HTMLElement; btns: HTMLElement[] }
export interface LeverRowsUi {
  /** the rows in order */
  rows: LeverRow[];
  /** light the buttons as the tables stand. `live` false for a row: the mission does not read that lever (the solo night's shift is the level's own, and it has
   *  no fog of war but the quiet one's: game/quietfog.ts QUIETFOG.solo) — the row is greyed and says nothing. `structure`: the structure the mission shown is fought on ('' = one with no rows of its own):
   *  the kit lit is the kit the level carries THERE (difficulty.ts HARD_AT), and a press on the level's own rung there lets the lever go. `quiet`: the
   *  mission shown is a quiet one that may be played under the fog (game/quietfog.ts) — the fog row shows its bottom rung too (off: every guard shown) and is the quiet pick's, lit where a quiet mission starts until it is moved */
  paint(live?: LeverLive, structure?: string, quiet?: boolean): void;
  /** a button of the rows was pressed on this screen */
  readonly touched: boolean;
}
/** the cameras row's one line (the note under it while it is lit, and its button's title) */
const camWords = () => `The last one you put on a wall is one more eye in the fog.${QUIETFOG.wand && WAND.on ? ' An optical wand for doors comes with them.' : ''}`;   // (quietfog.ts quietWand: the mission's cameras come with a wand)
const el = (tag: string, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** every lever's rung in a word, for a screen that repaints its links only when something changed */
export function leversSig(): string { const S = quietFogAside(() => leversShown()), M = leversSet(); return `${leversBase()}|${S.fog}|${S.ai}|${S.kit}|${M.fog ?? ''}|${M.ai ?? ''}|${M.kit ?? ''}${QUIETFOG.on ? `|${quietFog()}${quietCams() ? '+cams' : ''}` : ''}`; }

/** Build the rows into `host`. `onChange`: after a press changed the tables. */
export function leverRows(host: HTMLElement, cls: LeverCls, onChange: () => void): LeverRowsUi {
  const rows: LeverRow[] = [], notes = new Map<string, HTMLElement>();
  let touched = false;
  const press = (fn: () => void) => (e?: Event) => { e?.preventDefault?.(); touched = true; fn(); U.paint(lastLive, lastAt, lastQuiet); onChange(); };
  let camRow: { el: HTMLElement; btns: HTMLButtonElement[]; note: HTMLElement } | null = null;   // (the cameras' row: under the fog row, shown on a quiet row only)
  const row = (key: LeverKey, label: string, rungs: { id: string; label: string; words: string }[], put: (id: string) => void) => {
    const r = el('div', cls.row); r.setAttribute('data-lever', key); r.appendChild(el('span', cls.label, label));
    const btns = rungs.map(g => { const b = el('button', cls.btn, g.label) as HTMLButtonElement; b.type = 'button'; b.setAttribute('data-rung', g.id); b.title = g.words; b.onclick = press(() => put(g.id)); r.appendChild(b); return b; });
    const n = el('span', cls.note); r.appendChild(n); notes.set(key, n);
    host.appendChild(r); rows.push({ key, el: r, btns });
    if (key === 'fog' && QUIETFOG.on && STICKY.on) {
      const c = el('div', cls.row); c.setAttribute('data-lever', 'cams'); c.appendChild(el('span', cls.label, 'Sticky cameras'));   // (named as the kit card names them: a bare 'Cameras' under Enemy AI / Enemy kit read as the level's own wall cameras)
      const cb = [false, true].map(on => { const b = el('button', cls.btn, on ? String(STICKY.issue) : 'None') as HTMLButtonElement; b.type = 'button'; b.setAttribute('data-cams', on ? '1' : '0');
        b.title = on ? camWords() : ''; b.onclick = press(() => setQuietCams(on)); c.appendChild(b); return b; });
      const cn = el('span', cls.note); c.appendChild(cn); host.appendChild(c); camRow = { el: c, btns: cb, note: cn };
    }
  };
  const off = QUIET_RUNGS[0];   // (the fog lever's bottom rung on a quiet mission's row: made only while the rule is on, hidden on every other row)
  for (const L of LEVERS) row(L.key, L.label, L.key === 'fog' && QUIETFOG.on ? [off, ...L.rungs] : L.rungs,
    id => { if (L.key === 'fog' && lastQuiet) setQuietFog(id as QuietRung); else if (id !== off.id) quietFogAside(() => setLever(L.key, id as never, true, lastAt)); });   // (quietFogAside: a quiet mission being played under its rung is not the squad lever's to move)
  let lastLive: LeverLive = true, lastAt: string | undefined, lastQuiet = false;
  const U: LeverRowsUi = {
    rows,
    get touched() { return touched; },
    paint(liveOf: LeverLive = true, structure?: string, quiet = false) {
      lastLive = liveOf; lastAt = structure; lastQuiet = quiet && QUIETFOG.on;
      const S = quietFogAside(() => leversShown(structure)) as Record<string, string | null>, M = leversSet() as Record<string, string | undefined>;
      for (const R of rows) {
        const live = typeof liveOf === 'function' ? liveOf(R.key) : liveOf;
        const mine = lastQuiet && R.key === 'fog', lit = mine ? quietFog() : S[R.key], moved = mine ? lit !== quietFogDefault() : M[R.key] !== undefined;   // (a quiet row's lever is 'moved' off where a quiet mission STARTS: QUIETFOG.def)
        R.el.className = `${cls.row}${live ? '' : ' na'}${moved ? ' moved' : ''}`;
        for (const b of R.btns) { const id = b.getAttribute('data-rung'), on = id === lit; b.className = on ? `${cls.btn} on` : cls.btn; b.setAttribute('aria-pressed', on ? 'true' : 'false');
          if (R.key === 'fog' && QUIETFOG.on) { if (id === off.id) (b as HTMLElement & { style: { display: string } }).style.display = mine ? '' : 'none'; else b.title = mine ? quietFogWords(id) : leverWords('fog', id); } }
        if (R.key === 'fog' && camRow) { const on = mine && quietCams(); (camRow.el as HTMLElement & { style: { display: string } }).style.display = mine ? '' : 'none';
          camRow.el.className = `${cls.row}${live ? '' : ' na'}${mine && quietFog() !== off.id && on !== quietCamsDefault() ? ' moved' : ''}`; camRow.note.textContent = on ? camWords() : ''; camRow.note.title = camRow.note.textContent;
          for (const b of camRow.btns) { const lit = (b.getAttribute('data-cams') === '1') === on; b.className = lit ? `${cls.btn} on` : cls.btn; b.setAttribute('aria-pressed', lit ? 'true' : 'false'); } }
        const n = notes.get(R.key)!;
        n.textContent = !live ? '' : mine ? quietFogWords(lit) : leverWords(R.key, lit) || 'moved by hand in the debugger'; n.title = n.textContent ?? '';
      }
    },
  };
  return U;
}

/** A SCREEN OPENED ON A LINK THAT NAMES ITS LEVEL (a short-list row opens the loadout on its own difficulty, whatever this machine keeps): the tables are put
 *  on that level for as long as the screen is up, the levers moved by hand staying over it. Returns the way back, for a screen closed with nothing pressed
 *  on its rows (pass their `touched`). Tables standing on rows moved by hand in the Tab panel are left alone both ways. */
export function leversOpenOn(href: string): (touched: boolean) => void {
  const d = new URLSearchParams(href.replace(/^[^?]*\?/, '')).get('difficulty'), was = leversBase();
  const named = d === 'standard' || d === 'hard' ? d : null, free = quietFogAside(() => difficultyNow() !== 'custom' || leversMixed());
  if (!named || named === was || !free) return () => { /* nothing was changed */ };
  quietFogAside(() => setBase(named));
  return touched => { if (!touched && leversBase() === named) quietFogAside(() => setBase(was)); };
}
