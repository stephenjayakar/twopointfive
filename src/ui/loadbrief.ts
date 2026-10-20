// THE LOAD BRIEF — what a mission's page shows while it loads, and until the player starts it.
//
// The maintainer, 10-19, after watching a first-time player: "having the loading screen make more sense (e.g. being a pre mission brief) that you then click
// through rather than flashing the controls"; that player's own notes: "stay on loading screen longer, would like to read".
//
// Before this a page whose address names a mission booted behind the OLD start card's look-alike (ui/menu.ts bootCard: a grey Start, the notes, the whole
// controls list and the shader count) and the mission began under it the moment the boot was done: a list of keys up for as long as the machine took, gone
// before it could be read. Now that page shows THE MISSION: its own words off the mission list (scene/scenarioList.ts: the heading it sits under, its title,
// the place, the job in one line, the team as deployed, the defenders, the approach) beside its own picture (ui/menuStills.ts: a moment of that mission being
// played), and ONE block, START, which fills as the boot goes and is live when the level can start. Nothing here is a new sentence: every word is the list's.
//   · IT STAYS UNTIL IT IS STARTED: a click on the block, Enter or Space. The world is stood up and held still behind it (main.ts: one term of the loop's
//     `frozen`, as under the pause card), so the run's first tick is the player's.
//   · IT NEVER ADDS WAIT: a press made while the page still boots is kept (the block sits pressed in) and the level starts the moment it can.
//   · THE CONTROLS are where they are from every other screen, Options ▸ Controls (ui/options.ts), one quiet word away; BACK (Esc) is the mission list.
//   · NOT FOR A PAGE NOBODY SITS AT: main.ts makes none under ?paused, a replay's tape, ?kitview's window or a benchmark's scene, and drops it unstarted once
//     any script drives the page; the headless harness never comes through main.ts at all.
// THE SWITCH: LOADBRIEF.on — ON in the page (main.ts; `?loadbrief=0` = the boot card and the straight start, as the build was), OFF in the module, so every
// tool that stands a Menu on a fake DOM measures the cards as they were. A page-only screen: no game rule reads it and no knob table carries it.
// Plain DOM in a layer of its own (#brief, made here), styled with ui/theme.ts's tokens; its rules are injected once. Nothing at module level uses another
// module's exports. tools/qa/loadbrief-check.ts holds the words and the hand-over on a fake DOM; tools/qa/loadbrief-page.cjs looks at the real page.
import { ALL_MISSIONS, specOfQuery, quitSearch } from '../scene/scenarioList';
import { MISSION_GROUPS } from '../scene/scenarios';
import { PICKS_UI, pickOfQuery, pickQuitSearch } from '../scene/picks';
import { SOLO_NIGHT, missionOf, missionOfQuery, teamWordsOf, leanWords, reopenMissionsAfterLoad, type Mission } from './missions';
import { stillOf } from './menuStills';
import { openOptions, closeOptions, optionsOpen } from './options';
import { START_PAGE } from './startpage';
import { menuTheme } from './theme';

export const LOADBRIEF = { on: false };

/** what the brief says: the list's row, and the team as THIS page deploys it (a row deployed at another size than its own is still that row) */
export interface BriefWords { mission: Mission; group: string; team: string }
/** the mission a query string boots, in the list's words — its own row (ui/missions.ts missionOfQuery: the list's own answer, the plain solo night for
 *  `?solo` alone); deployed at a size no row has, the row of that kind on that level. Null: the address names no mission of the list (a plain page, a
 *  hand-typed combination on a level no row is on), or it picks its level by `?level=` (the editor's own level, the office as it was): the list's rows are
 *  written for the levels the list names, and a level being built is played the moment it loads. */
export function briefOfQuery(search: string | URLSearchParams): BriefWords | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search; if (q.has('level')) return null;
  const spec = specOfQuery(q), rows = [SOLO_NIGHT, ...ALL_MISSIONS.map(missionOf)];
  const words = (m: Mission, squad: number): BriefWords => ({ mission: m, group: MISSION_GROUPS.find(g => g.id === m.group)?.title ?? '', team: teamWordsOf({ squad: squad as Mission['squad'] }) });
  const own = missionOfQuery(q.toString(), rows); if (own) return words(own, spec?.squad ?? 0);
  if (!spec) return null;
  const here = rows.filter(m => m.scenario?.kind === spec.kind && (m.scenario.level ?? '') === (spec.level ?? ''));
  const m = here.find(x => x.squad === spec.squad) ?? here[0];
  return m ? words(m, spec.squad) : null;
}

export interface LoadBrief {
  /** the boot's status line, as the boot card takes it ('compiling shaders 40 / 97 …'): the block fills by its 'N / M' */
  status(text: string): void;
  /** the level can start: the block is live — and if it was pressed meanwhile (and the player is not reading Options over it), the run starts now.
   *  `onStart` runs once, as the brief goes; a throw from it is logged, never the caller's */
  live(onStart?: () => void): void;
  /** gone, unstarted (a page a script drives; a mission whose start was refused): no `onStart` */
  off(): void;
  /** up on the page */
  readonly up: boolean;
  /** live and not yet started: the world behind it is held still */
  readonly held: boolean;
  readonly words: BriefWords;
}

const STYLE = 'brief-style';
const CSS = `
/* THE LOAD BRIEF (ui/loadbrief.ts): the title screen's own composition — the words and the one block down the left on the menus' ground — with the mission's
   picture where the title has the floor. Flat, square, no frame round the words; the accent is the rule under the title and the block, nothing else.
   IT GROWS WITH A BIG WINDOW: every length below is written in px as the other menus' are and laid out in --u (styles(): 1 px up to a 1920 x 1080 window,
   2 px at 3840 x 2160), so the page a 4K screen at no scaling shows is the 1080p page, twice the size. (PX = a length that is not scaled: the unit itself, the breakpoints.) */
#brief { --u: clamp(1PX, min(0.0521vw, 0.0926vh), 2PX); position: absolute; inset: 0; z-index: 30; display: none; grid-template-columns: minmax(340px, 42%) minmax(0, 1fr); background: var(--m-base); color: var(--m-text); font: 13px/1.45 var(--m-font); outline: none; opacity: 1; transition: opacity 0.18s; }
#brief.on { display: grid; }
#brief.out { opacity: 0; pointer-events: none; }
#brief .bcol { box-sizing: border-box; min-width: 0; height: 100%; overflow: hidden auto; display: flex; flex-direction: column; padding: clamp(22px, 6vh, 64px) 24px clamp(22px, 6vh, 64px) clamp(24px, 6.5vw, 110px); }
#brief .bk { font: 600 12px/1 var(--m-head); letter-spacing: 0.3em; text-transform: uppercase; color: var(--m-dim); min-height: 12px; }
#brief .bt { margin: 14px 0 0; font: 700 clamp(34px, 4.2vw, 64px)/0.95 var(--m-head); letter-spacing: 0.01em; text-transform: uppercase; color: var(--m-bright); overflow-wrap: break-word; }
#brief .bt::after { content: ''; display: block; width: 72px; height: 4px; margin-top: 20px; background: var(--m-accent); }
#brief .bplace { margin-top: 18px; max-width: 40ch; font-size: 14px; line-height: 1.4; letter-spacing: 0.04em; color: var(--m-soft); }
#brief .bjob { margin-top: 14px; max-width: 40ch; font-size: 17px; line-height: 1.45; color: var(--m-bright); }
#brief .bfacts { display: flex; flex-wrap: wrap; gap: 10px 34px; margin-top: 24px; }
#brief .bf b { display: block; font: 600 11px/1 var(--m-head); letter-spacing: 0.22em; text-transform: uppercase; color: var(--m-dim); }
#brief .bf span { display: block; margin-top: 6px; font-size: 14px; color: var(--m-text); }
#brief .bin { margin: auto 0; }   /* (the words and the block as one group, level with the picture; a column taller than the window scrolls from its top) */
#brief .bgo { position: relative; overflow: hidden; box-sizing: border-box; width: min(360px, 100%); margin-top: clamp(22px, 5vh, 44px); display: flex; align-items: center; justify-content: space-between; text-align: left; font: 700 34px/1 var(--m-head); letter-spacing: 0.12em; text-transform: uppercase; padding: 14px 18px 11px; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.4); border: 0; border-left: 4px solid rgba(var(--m-edge),0.3); border-radius: 0; cursor: progress; transition: padding-left 0.12s, background 0.12s, color 0.12s; }
#brief .bgo i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(var(--m-accent-rgb),0.3); transition: width 0.2s; }
#brief .bgo span, #brief .bgo kbd { position: relative; }
#brief .bgo kbd { font: 600 11px/1 var(--m-head); letter-spacing: 0.2em; opacity: 0; transition: opacity 0.12s; }
#brief .bgo:focus { outline: none; }
#brief.armed .bgo { padding-left: 28px; color: var(--m-bright); border-left-color: var(--m-accent); }
#brief.live .bgo { cursor: pointer; color: var(--m-on-accent); background: var(--m-accent); border-left-color: var(--m-accent-hi); }
#brief.live .bgo i { width: 0 !important; }
#brief.live .bgo kbd { opacity: 0.7; }
#brief.live .bgo:hover, #brief.live .bgo:focus { padding-left: 28px; background: var(--m-accent-hi); border-left-color: var(--m-bright); }
#brief .bstatus { width: min(360px, 100%); min-height: 14px; margin-top: 8px; font: 11px/14px var(--m-mono); letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: var(--m-soft); }
#brief.live .bstatus { visibility: hidden; }
#brief .bfoot { display: flex; gap: 26px; margin-top: 10px; }
#brief .bq { padding: 8px 0 7px; font: 600 12px/1 var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; border-radius: 0; cursor: pointer; }
#brief .bq:hover, #brief .bq:focus { color: var(--m-bright); outline: none; }
#brief .bpic { min-width: 0; display: flex; align-items: center; justify-content: center; padding: clamp(20px, 5vh, 64px) clamp(20px, 4vw, 72px) clamp(20px, 5vh, 64px) 12px; }
#brief .bpic img { display: block; width: min(100%, 1140px); max-height: 100%; aspect-ratio: 760 / 475; object-fit: cover; border: 1px solid rgba(var(--m-edge),0.14); opacity: 0; transition: opacity 0.25s; }
#brief .bpic img.in { opacity: 1; }
/* a narrow window: the picture over the words; a short one: the same column, closer set */
@media (max-width: 820PX) { #brief { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); } #brief .bpic { order: -1; padding: 16px 24px 0; justify-content: flex-start; } #brief .bpic img { max-height: 32vh; }
  #brief .bcol { padding-left: 24px; } #brief .bin { margin: 0; } }
@media (max-height: 640PX) { #brief .bcol { padding-top: 16px; padding-bottom: 12px; } #brief .bt { margin-top: 10px; font-size: clamp(28px, 3.6vw, 44px); } #brief .bt::after { margin-top: 12px; }
  #brief .bplace { margin-top: 10px; } #brief .bjob { margin-top: 8px; font-size: 15px; } #brief .bfacts { margin-top: 14px; } #brief .bgo { margin-top: 18px; font-size: 26px; padding: 10px 18px 8px; } }
@media (prefers-reduced-motion: reduce) { #brief, #brief .bgo, #brief .bgo i, #brief .bpic img { transition: none; } }
`;
function styles() {
  menuTheme();
  if (document.getElementById?.(STYLE)) return;
  const s = document.createElement('style'); s.id = STYLE; s.textContent = CSS.replace(/(\d+(?:\.\d+)?)px/g, (px, n) => +n <= 1 ? px : `calc(var(--u) * ${n})`); document.head?.appendChild?.(s);   // (hairlines stay hairlines)
}
function el(tag: string, cls?: string, text?: string) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

/** the brief of the mission this address boots, up at once — or null: the switch is off, or the address names no mission of the list (the caller's boot
 *  card then, as before). One a page. */
export function loadBrief(search: string = typeof location !== 'undefined' ? location.search ?? '' : ''): LoadBrief | null {
  if (!LOADBRIEF.on || typeof document === 'undefined') return null;
  const W = briefOfQuery(search); if (!W) return null;
  const m = W.mission;
  styles();
  const host = document.getElementById('app') ?? document.body;
  document.getElementById('brief')?.remove?.();
  const root = el('div'); root.id = 'brief'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', m.title); root.setAttribute('data-mission', m.id);
  const column = el('div', 'bcol');
  const col = el('div', 'bin'); column.appendChild(col);
  col.appendChild(el('div', 'bk', W.group));
  col.appendChild(el('h1', 'bt', m.title));
  col.appendChild(el('div', 'bplace', m.place));
  if (m.blurb) col.appendChild(el('div', 'bjob', m.blurb));
  { const facts = el('div', 'bfacts');
    const fact = (label: string, value: string) => { if (!value || value === '—') return; const f = el('div', 'bf'); f.appendChild(el('b', undefined, label)); f.appendChild(el('span', undefined, value)); facts.appendChild(f); };
    fact('Team', W.team); fact('Defenders', m.defenders); fact('Approach', leanWords(m.lean));   // (the mission sheet's own three cells and their names: ui/missions.ts)
    col.appendChild(facts); }
  const go = el('button', 'bgo') as HTMLButtonElement, fill = el('i'), words = el('div', 'bstatus', 'starting the GPU…');
  go.type = 'button'; go.setAttribute('aria-busy', 'true'); go.appendChild(fill); go.appendChild(el('span', undefined, 'Start')); go.appendChild(el('kbd', undefined, 'Enter'));
  col.appendChild(go); col.appendChild(words);
  const foot = el('div', 'bfoot'), keys = el('button', 'bq', 'Controls') as HTMLButtonElement, back = el('button', 'bq', 'Back') as HTMLButtonElement;
  keys.type = 'button'; back.type = 'button'; foot.appendChild(keys); foot.appendChild(back); col.appendChild(foot);
  root.appendChild(column);
  const pic = el('div', 'bpic'); root.appendChild(pic);
  host.appendChild(root); root.classList.add('on');

  let up = true, live = false, armed = false, onStart: (() => void) | undefined;
  // the mission's picture, where one was made (none: the one-file build without them, a mission newer than the pictures — the words alone)
  void stillOf(m.id).then(P => { if (!up || !P) return; const img = el('img') as HTMLImageElement; img.alt = ''; img.decoding = 'async'; img.onload = () => img.classList.add('in'); img.src = P.img.src; pic.appendChild(img); if (img.complete) img.classList.add('in'); }).catch(() => { /* the words alone */ });

  const gone = () => { up = false; live = false; window.removeEventListener('keydown', onKey, true); };
  const start = () => {
    if (!up) return;
    if (!live) { arm(!armed); return; }   // (pressed while the page still boots: kept — live() starts it; pressed again: taken back)
    const run = onStart; gone(); closeOptions();
    root.classList.add('out'); setTimeout(() => root.remove(), 220);   // (the run is live from this line: the fade is over the first frames of it)
    try { run?.(); } catch (e) { console.error('load brief: the start threw', e); }   // (the armed start runs inside the page's boot: a throw here must not be the boot's)
  };
  const arm = (on: boolean) => { armed = on; root.classList.toggle('armed', on); go.setAttribute('aria-pressed', String(on)); };
  const leave = () => {   // BACK: the mission list, by a page load (this one is still booting) — the address a quit of this mission leaves (main.ts's own quit)
    const s = location.search ?? '', pick = PICKS_UI.on ? pickOfQuery(s) : null;
    if (!pick || START_PAGE.on) reopenMissionsAfterLoad();
    location.assign(location.pathname + (PICKS_UI.on ? pickQuitSearch(s) : quitSearch(s)) + location.hash);
  };
  // THE KEYS are the brief's while it is up (first in line at the window: main.ts makes it before the game's Input exists, so no key of the game's, and no Esc
  // of the pause card's, is read under it): Enter / Space start, Esc is Back, Tab walks its three buttons. Left alone: a chord and the F-keys (the browser's,
  // the recorders' — but never an Esc on to the pause card), and every key while the options layer is up over it (ui/options.ts has its own).
  const onKey = (e: KeyboardEvent) => {
    if (!up || optionsOpen()) return;
    if (e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(e.code)) { if (e.code === 'Escape') e.stopImmediatePropagation(); return; }   // (a chorded Esc is still not the pause card's)
    e.stopImmediatePropagation();
    if (e.code === 'Tab') return;
    const quiet = e.target === keys || e.target === back;   // (a quiet button with the focus is pressed by Enter / Space as any button is)
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { if (quiet) return; e.preventDefault(); if (!e.repeat) start(); return; }
    e.preventDefault();
    if (e.code === 'Escape' && !e.repeat) leave();
  };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('mousedown', e => e.stopPropagation());   // (a click on the brief never reaches the game's canvas)
  go.onclick = start; back.onclick = leave;
  // CONTROLS: the options layer gives the focus back to what had it (ui/options.ts closeOptions) — START, so Enter after reading is Start, not Controls again;
  // and a press kept from the boot is taken back: the player chose to read, and the run does not start under the page they are reading.
  keys.onclick = () => { if (!live) arm(false); go.focus?.(); openOptions({ tab: 'controls' }); };
  setTimeout(() => { if (up && !optionsOpen() && (document.activeElement ?? document.body) === document.body) go.focus?.(); }, 0);

  return {
    status(text: string) { if (!up || live) return; words.textContent = text; const n = /(\d+) \/ (\d+)/.exec(text); if (fill.style) fill.style.width = n && +n[2] > 0 ? `${Math.min(100, Math.round(100 * +n[1] / +n[2]))}%` : /ready|setting up/.test(text) ? '100%' : '0'; },
    live(run?: () => void) { if (!up || live) return; live = true; onStart = run; root.classList.add('live'); go.removeAttribute('aria-busy'); words.textContent = ''; if (armed && !optionsOpen()) start(); else arm(false); },
    off() { if (!up) return; gone(); closeOptions(); root.remove(); },
    get up() { return up; },
    get held() { return up && live; },
    words: W,
  };
}
