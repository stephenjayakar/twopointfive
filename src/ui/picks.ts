// THE SHORT LIST ON THE CARDS (scene/picks.ts PICKS is the table; this file is its DOM and its keys): the start card — and the boot card under it, live from
// the first tick, since a pick is a page load and needs nothing of this page's renderer — open on the few missions worth playing first, in play order: a
// number, the title, what it is started with (team, a hard difficulty, the hour, the weather, a named switch) and one plain line. A CLICK ON A ROW STARTS IT
// with those settings (every row is a link to its own URL — scene/picks.ts pickHref). THE ONE CHOICE ON A ROW is standard or hard: the row opens on its own
// difficulty and a small link at its end ('hard ›', or 'standard ›' on a row that opens hard) starts the same mission at the other — nothing else is asked.
// A row whose mission the build's hard does not change (Pick.oneDifficulty) carries no such link: there is nothing to choose.
// Everything else the build has is one button further, on the mission list
// (the card's Missions button — ui/missions.ts, with its own team, hour and weather rows), and Start is still the solo night straight in.
// KEYS (no held keys, no digits): W S / ↑ ↓ walk the rows · D / → steps onto the row's other difficulty, A / ← back · Enter or Space starts the highlighted one. The rows a machine has already started say 'played', and
// S / ↓ from off the rows lands on the first one it has not (kept per machine: localStorage `twopointsix.picks`). The rows never take the focus by themselves:
// the card opens with it on Missions, as it always did, so a key already going down starts nothing. A page whose URL names a mission carries no rows (it is
// booting that mission, straight in).
// `?nopicks` (scene/picks.ts PICKS_UI.on false): picksBlock and nextPickOf return null and the cards are the build's as it was.
// THE LOADOUT FIRST (scene/picks.ts PICKS_UI.loadout, on; the maintainer, 10-09, playing the list: 'how do i do the loadout? scenario goes straight to the
// game'): a click, Enter or Space on a row — and on its other-difficulty link — opens THAT MISSION'S LOADOUT SCREEN (ui/loadout.ts: team, kit, the squad kit
// row) over the card, with the row's own URL under it; its Deploy is the page load (startPick), Esc / Back is the card again. STRAIGHT IN is one press
// further along the row: a small 'go ›' link before the difficulty one (D / → steps row → go › → hard ›, A / ← back). `?pickstraight` = off: everything
// in this paragraph is gone and a click starts the row, as the head of this file says.
// Plain DOM in the cards' own #menu, its styles injected here once (index.html is not touched). Nothing at module level uses another module's exports.
import { PICKS, PICKS_UI, pickHref, pickEntry, pickSquad, pickOfQuery, pickDifficulty, pickOtherDifficulty, pickChosenDifficulty, namesMission, nextPick, type Pick } from '../scene/picks';
import { sizeTag, sizeWords } from '../game/loadout';
import { hourLabel } from '../game/hours';
import { difficultyWords, leversHref, leversLine, squadsOf } from '../game/difficulty';
import { quietFogAside } from '../game/quietfog';
import { weatherTitle } from '../game/weatherKinds';
import { missionsBusy, missionList } from './missions';
import { openLoadout, entryOfMission, type LoadoutScreen } from './loadout';
import type { SquadSize } from '../game/loadout';
import { kitPreviewIsOpen } from './kitPreview';
import { menuTheme } from './theme';

const LS = 'twopointsix.picks';         // the ids started on this machine
const LS_MISSION = 'twopointsix.mission';   // (ui/missions.ts: the row its list opens on — a pick started here is that row)
const CSS = `
#menu .picks { margin: 18px 0 2px; }
#menu .picks .plevers { margin: -2px 0 6px; font-size: 11px; color: #c9b98a; }
#menu .picks .pwrap { display: flex; align-items: stretch; margin: 0 -10px; }
#menu .picks .pwrap + .pwrap { border-top: 1px solid rgba(255,255,255,0.05); }
#menu .picks .prow { flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 12px; padding: 7px 10px 8px 9px; text-decoration: none; color: var(--m-text); border-left: 3px solid transparent; border-radius: 2px; cursor: pointer; }
#menu .picks .palt, #menu .picks .pgap { flex: 0 0 auto; align-self: center; margin: 0 6px 0 4px; padding: 3px 7px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; text-decoration: none; border-radius: 2px; border: 1px solid rgba(255,156,132,0.45); color: #ffb9a6; cursor: pointer; }
#menu .picks .pgap { visibility: hidden; }
#menu .picks .palt.standard { border-color: rgba(var(--m-edge),0.45); color: var(--m-btn-text); }
#menu .picks .palt:hover, #menu .picks .palt:focus { background: rgba(255,156,132,0.18); border-color: #ff9c84; outline: none; }
#menu .picks .palt.standard:hover, #menu .picks .palt.standard:focus { background: rgba(var(--m-edge),0.18); border-color: var(--m-accent); }
#menu .picks .prow:hover, #menu .picks .prow:focus { background: rgba(var(--m-edge),0.14); border-left-color: var(--m-accent); outline: none; }
#menu .picks .pn { flex: 0 0 16px; padding-top: 2px; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--m-accent); text-align: right; }
#menu .picks .pmain { flex: 1; min-width: 0; }
#menu .picks .ptop { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
#menu .picks .ptitle { font-size: 14px; font-weight: 600; letter-spacing: 0.03em; color: var(--m-bright); }
#menu .picks .ptag { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; padding: 0 6px; border-radius: 2px; border: 1px solid rgba(var(--m-edge),0.45); color: var(--m-btn-text); white-space: nowrap; }
#menu .picks .ptag.four, #menu .picks .ptag.three { border-color: rgba(240,196,110,0.7); color: #f3d79a; }
#menu .picks .ptag.solo { border-color: rgba(150,190,240,0.55); color: #b9d2f3; }
#menu .picks .ptag.hard { border-color: rgba(255,156,132,0.7); color: #ffb9a6; }
#menu .picks .ptag.set { border-style: dashed; }
#menu .picks .pline { display: block; margin-top: 1px; font-size: 12px; color: var(--m-soft); }
#menu .picks .pend { flex: 0 0 58px; align-self: center; text-align: right; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; }
#menu .picks .pgo { color: var(--m-accent-hi); display: none; }
#menu .picks .pdone { color: var(--m-faint); }
#menu .picks .prow:hover .pgo, #menu .picks .prow:focus .pgo { display: inline; }
#menu .picks .prow:hover .pdone, #menu .picks .prow:focus .pdone { display: none; }
#menu .picks .prow.played .pn { color: var(--m-faint); }
#menu .picks .prow.next { border-left-color: rgba(var(--m-edge),0.45); }
#menu .picks .palt.go { border-color: rgba(var(--m-edge),0.45); color: var(--m-btn-text); margin-right: 0; }
#menu .picks .palt.go:hover, #menu .picks .palt.go:focus { background: rgba(var(--m-edge),0.18); border-color: var(--m-accent); }
#menu .picks.vl .pend { flex-basis: 74px; }
#menu .card:has(.picks) { width: min(640px, calc(100% - 40px)); }
#menu .card:has(.picks.vl) { width: min(700px, calc(100% - 40px)); }
`;
function styles() { menuTheme(); if (document.getElementById?.('picks-css')) return; const s = document.createElement('style'); s.id = 'picks-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }
function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

/** the ids this machine has started */
export function picksPlayed(): string[] { try { const v = JSON.parse(globalThis.localStorage?.getItem(LS) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } }
/** the tags of a row, in the order the card shows them: the team, then only what is NOT the mission as it was made */
export function pickTags(p: Pick): { text: string; cls: string }[] {
  const n = pickSquad(p), out = [{ text: sizeWords(n), cls: sizeTag(n) }];   // ('you + four': the count never leaves out the player)
  if (p.difficulty === 'hard' && pickEntry(p)) out.push({ text: 'hard', cls: 'hard' });   // (the solo night has no difficulty)
  if (p.hour && p.hour !== 'night') out.push({ text: hourLabel(p.hour), cls: 'set' });
  if (p.weather) out.push({ text: weatherTitle(p.weather), cls: 'set' });
  for (const t of p.tags ?? []) out.push({ text: t, cls: 'set' });
  return out;
}
/** what the card calls a pick: its own title, else its mission's */
export function pickTitle(p: Pick): string { return p.title ?? pickEntry(p)?.title ?? 'Solo night'; }
/** `p` is being started: remembered as started on this machine, and its mission is the row the mission list opens on */
export function notePicked(p: Pick) { try { const had = picksPlayed(); if (!had.includes(p.id)) globalThis.localStorage?.setItem(LS, JSON.stringify([...had, p.id])); globalThis.localStorage?.setItem(LS_MISSION, p.mission); } catch { /* no store */ } }
/** start `p`: remembered as started, then the page load of its URL (the same URL = a reload) */
export function startPick(p: Pick, href: string) {
  notePicked(p);
  href = quietFogAside(() => leversHref(href));   // (a difficulty lever moved by hand rides on the link only where this machine could not keep it — game/difficulty.ts; none moved = the link as it is)
  const L = location as Location, to = (L.pathname ?? '') + href + (L.hash ?? '');
  if (to === (L.pathname ?? '') + (L.search ?? '') + (L.hash ?? '')) L.reload(); else L.assign(to);
}

/** THE LOADOUT FIRST (PICKS_UI.loadout): `p`'s mission on the loadout screen with `href` — the row's own URL, or its other difficulty's — under it. Deploy is
 *  startPick of that URL with the team size on it (so the row is remembered as started, and a size that is not the row's own is no longer the pick: no 'next',
 *  scene/picks.ts pickOfQuery); Back / Esc closes the screen onto the card, the focus back on the row. A difficulty that is not standard is said in the title:
 *  the screen has no difficulty row of its own. Null (and the row started straight in) where the mission is not on the build's list. */
export function pickLoadout(p: Pick, href: string): LoadoutScreen | null {
  const m = missionList().find(x => x.id === p.mission); if (!m) { startPick(p, href); return null; }
  const e = entryOfMission(m), hard = !!pickEntry(p) && new URLSearchParams(href).get('difficulty') === 'hard';
  // (the ROW's team size, not the one this machine last deployed the mission with: the row says 'you + four', and its 'go ›' beside it starts four.
  //  Back finds the row afresh — the boot card may have become the start card under the screen, and the anchor that had the focus is then gone)
  const L = openLoadout(hard ? { ...e, title: `${e.title} · hard` } : e, { search: href, squad: pickEntry(p) ? pickSquad(p) as SquadSize : undefined, deploy: to => startPick(p, to),
    back: () => (document.querySelector?.(`#menu .picks [data-pick="${p.id}"]`) as HTMLElement | null)?.focus?.() });
  // (a double click's SECOND click must not land on the screen that the first one opened: its buttons write the kit)
  const st = L.root.style; if (st && typeof setTimeout === 'function') { st.pointerEvents = 'none'; setTimeout(() => { st.pointerEvents = ''; }, ARM_MS); }
  return L;
}

/** when the rows were last put on a card: Enter / Space start nothing for a beat after (a key already going down as the card opens is not a pick) */
let shownAt = 0;
const ARM_MS = 400;

export interface PicksBlock { root: HTMLElement; rows: HTMLElement[];
  /** the rows' other-difficulty links, by the row's id (scenario rows only) */
  alts: HTMLElement[];
  /** the rows' straight-in links, by the row's id (only while a row opens its loadout first — PICKS_UI.loadout) */
  gos: HTMLElement[];
  /** the row a re-drawn card gives the focus back to: the one the player had walked to on the card before it (the boot card → the start card), else none —
   *  the rows never TAKE the focus by themselves (a key already on its way down as the card opens must not start a mission) */
  focus: HTMLElement | null }
/** the row that has the focus as a card is about to be drawn again (its id) — picksNoteFocus, called by the card BEFORE it clears itself */
let walked: string | null = null;
let walkedAlt = false, walkedGo = false;
export function picksNoteFocus() { const at = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null, alt = at?.getAttribute?.('data-alt') ?? null, go = at?.getAttribute?.('data-go') ?? null; walked = at?.getAttribute?.('data-pick') ?? alt ?? go; walkedAlt = !!alt; walkedGo = !!go; }
/** a row's contents: number, title, tags, the line */
function rowBody(p: Pick, i: number): HTMLElement[] {
  const n = el('span', 'pn'); n.textContent = String(i + 1);
  const main = el('span', 'pmain'), top = el('span', 'ptop');
  const t = el('span', 'ptitle'); t.textContent = pickTitle(p); top.appendChild(t);
  for (const g of pickTags(p)) { const s = el('span', `ptag ${g.cls}`); s.textContent = g.text; top.appendChild(s); }
  const line = el('span', 'pline'); line.textContent = p.line;
  main.append(top, line);
  return [n, main];
}
/** THE ROWS for a card (null: the switch is off, the list holds nothing this build can start, or the page's URL already names something to play — that
 *  page boots it straight in, as every mission URL on this build does: W S Space there are the game's, not a way off the page) */
export function picksBlock(search: string = typeof location !== 'undefined' ? location.search ?? '' : ''): PicksBlock | null {
  if (!PICKS_UI.on || namesMission(search)) return null;
  const list = PICKS.flatMap((p, i) => { const href = pickHref(p, search); return href === null ? [] : [{ p, i, href }]; });
  if (!list.length) return null;
  styles();
  const via = PICKS_UI.loadout;   // (a row opens its loadout first; false = a click starts it)
  const root = el('div', via ? 'picks vl' : 'picks'), played = picksPlayed(), rows: HTMLElement[] = [], alts: HTMLElement[] = [], gos: HTMLElement[] = [];
  shownAt = typeof performance !== 'undefined' ? performance.now() : 0;
  // (no heading and no how-to line over the list: the maintainer, 10-11, "we should generally show, not tell. e.g. no \"play this first\", wordy explanations of different options, etc.")
  // (the difficulty levers moved by hand stand over every row's standard / hard — game/difficulty.ts LEVERS; said here so a row's 'hard' is not read as all of it)
  { const line = quietFogAside(() => leversLine()); if (line) { const lv = el('div', 'plevers'); lv.textContent = `Your difficulty levers, on every row: ${line}. A row's loadout changes them.`; root.appendChild(lv); } }
  const next = list.find(x => !played.includes(x.p.id)) ?? null;
  for (const { p, i, href } of list) {
    const was = played.includes(p.id);
    const a = el('a', `prow${was ? ' played' : ''}${next?.p === p ? ' next' : ''}`) as HTMLAnchorElement; a.setAttribute('href', href); a.setAttribute('data-pick', p.id);
    a.append(...rowBody(p, i));
    const end = el('span', 'pend'), go = el('span', 'pgo'); go.textContent = via ? 'loadout ›' : was ? 'again ›' : 'start ›'; end.appendChild(go);   // (shown on the row under the cursor or the highlight only)
    if (was) { const d = el('span', 'pdone'); d.textContent = 'played'; d.title = 'started on this machine'; end.appendChild(d); }
    a.appendChild(end);
    a.onclick = (e?: Event) => { e?.preventDefault?.(); if (via) { pickLoadout(p, href); return; } go.textContent = 'loading…'; startPick(p, href); };
    const wrap = el('div', 'pwrap'); wrap.appendChild(a); rows.push(a); root.appendChild(wrap);
    // STRAIGHT IN (only while the row itself opens the loadout): the row's own URL in one press, with the kit this machine keeps
    if (via) { const g = el('a', 'palt go') as HTMLAnchorElement; g.setAttribute('href', href); g.setAttribute('data-go', p.id); g.textContent = 'go ›'; g.title = 'Straight in, with the team and kit kept on this machine.';
      g.onclick = (e?: Event) => { e?.preventDefault?.(); g.textContent = 'loading…'; startPick(p, href); }; gos.push(g); wrap.appendChild(g); }
    // THE ONE CHOICE: the same mission against the other defenders (a scenario row; the solo night has no such switch)
    const other = pickOtherDifficulty(p), altHref = other ? pickHref(p, search, undefined, undefined, other) : null;   // (none on a row with one difficulty: hard is its standard)
    if (other && altHref !== null) {
      const b = el('a', `palt ${other}`) as HTMLAnchorElement; b.setAttribute('href', altHref); b.setAttribute('data-alt', p.id); b.textContent = `${other} ›`;
      b.title = `The same mission on ${difficultyWords(other, squadsOf(pickEntry(p)))}.`;   // (the build's own words for what that difficulty is HERE: on one squad map hard is the standard squads, and it says so)
      b.onclick = (e?: Event) => { e?.preventDefault?.(); if (via) { pickLoadout(p, altHref); return; } b.textContent = 'loading…'; startPick(p, altHref); };
      alts.push(b); wrap.appendChild(b);
    } else { const gap = el('span', 'pgap'); gap.textContent = 'hard ›'; wrap.appendChild(gap); }   // (unseen: keeps this row's end in line with the others)
  }
  return { root, rows, alts, gos, focus: (walked && ((walkedGo && gos.find(r => r.getAttribute('data-go') === walked)) || (walkedAlt && alts.find(r => r.getAttribute('data-alt') === walked)) || rows.find(r => r.getAttribute('data-pick') === walked))) || null };   // (on a row's other-difficulty link: the link keeps it, so Enter still starts what was highlighted)
}
/** THE PICK AFTER THIS ONE, for the pause and debrief cards of a run a pick started (null: the switch is off, the page is not a pick's, or it was the last):
 *  the next row's title and the page load that starts it. A difficulty the player chose over this row's own goes on to the next (and is said in the title);
 *  otherwise the next row opens on its own */
export function nextPickOf(search: string = typeof location !== 'undefined' ? location.search ?? '' : ''): { from: Pick; pick: Pick; title: string; href: string; start(): void } | null {
  if (!PICKS_UI.on) return null;
  const now = pickOfQuery(search), next = now && nextPick(now);
  const chosen = next && pickOtherDifficulty(next) ? pickChosenDifficulty(search) : undefined, carried = chosen && next && chosen !== pickDifficulty(next) ? chosen : undefined;   // (a row with one difficulty opens on it)
  const href = next ? pickHref(next, search, undefined, undefined, carried) : null;
  return now && next && href !== null ? { from: now, pick: next, title: pickTitle(next) + (carried ? ` · ${carried}` : ''), href, start: () => startPick(next, href) } : null;
}

// ---- the rows' keys: W S / ↑ ↓ walk them, Enter / Space start the one with the focus. Only while a card with the rows is up, nothing is over it (the mission
// list and the loadout take their own keys first) and the focus is the card's (not the Tab panel's search box).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', e => {
    if (!PICKS_UI.on || e.ctrlKey || e.metaKey || e.altKey || missionsBusy() || kitPreviewIsOpen()) return;
    const menu = document.getElementById('menu'); if (!menu || !menu.classList.contains('on')) return;
    const rows = [...menu.querySelectorAll<HTMLElement>('.picks .prow')]; if (!rows.length) return;
    const at = document.activeElement as HTMLElement | null; if (at && at !== document.body && !menu.contains(at)) return;
    const onAlt = !!at && at.classList.contains('palt'), row = onAlt ? at!.parentElement?.querySelector<HTMLElement>('.prow') ?? null : at;   // (on a row's other-difficulty link: W S walk from its row)
    const i = row ? rows.indexOf(row) : -1, entry = rows.find(r => r.classList.contains('next')) ?? rows[0];   // (from off the rows: the first one not yet played)
    switch (e.code) {
      case 'ArrowRight': case 'KeyD': if (i >= 0) { const ends = [...(rows[i].parentElement?.querySelectorAll<HTMLElement>('.palt') ?? [])], to = ends[onAlt ? ends.indexOf(at!) + 1 : 0]; if (to) { to.focus(); e.preventDefault(); } } break;   // (row → its links in order: 'go ›' where there is one, then the other difficulty)
      case 'ArrowLeft': case 'KeyA': if (i >= 0 && onAlt) { const ends = [...(rows[i].parentElement?.querySelectorAll<HTMLElement>('.palt') ?? [])], j = ends.indexOf(at!); (j > 0 ? ends[j - 1] : rows[i]).focus(); e.preventDefault(); } break;
      case 'ArrowUp': case 'KeyW': (i < 0 ? entry : rows[(i + rows.length - 1) % rows.length]).focus(); e.preventDefault(); break;
      case 'ArrowDown': case 'KeyS': (i < 0 ? entry : rows[(i + 1) % rows.length]).focus(); e.preventDefault(); break;
      case 'Enter': case 'NumpadEnter': case 'Space': if (i >= 0) { if (!e.repeat && performance.now() - shownAt >= ARM_MS) (onAlt ? at! : rows[i]).click(); e.preventDefault(); e.stopImmediatePropagation(); } break;
    }
  }, { capture: true });
}
