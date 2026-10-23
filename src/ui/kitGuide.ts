// THE KIT STEP'S WALKTHROUGH — a first visit to Team & kit is walked through picking who comes and what each man carries, by doing it.
//
// The maintainer, 10-22: "we should teach how to pick squad layouts! so maybe a tutorial on the gear page for a mission (that's skippable)". No mission
// teaches the kit screen (every tutorial mission issues its own kit and has no kit to pick), so the screen teaches itself, on the first mission whose kit
// CAN be picked: one small card at a time beside the row it is about, that row lit and the rest of the step dimmed, and the card goes when the player
// has DONE what it asks (or on its 'Next'). The page under it is live throughout: nothing is locked, a click anywhere does what it always did — but
// Enter, which on most rows of the step is Deploy, is the card's 'Next' while a card is up and the highlighted row has no Enter of its own: a first
// press of Enter on a card must never start the mission. Deploy under a card is the Deploy row's own Enter, or a click on it.
//   THE BEATS, in the step's own order, each only where this mission has the row:
//     job   · the brief's band (ui/kitBrief.ts): the job, the map, the way in. Done: the map opened large and put back.
//     team  · the Team row. Done: another size picked.
//     kit   · the row of named kits. Done: another kit put on. Its card says what THIS place asks (hostages, locked doors — the brief's own counts).
//     man   · the roster. Done: another man picked.
//     card  · the picked man's card. Done: one thing on it changed.
//     go    · Deploy. Done: deployed, or its 'Got it'.
//   · SKIPPABLE AT ANY POINT: 'Skip' on every card, or Esc (the first Esc is the walkthrough's; the next is the step's own, back to the mission). The
//     keys reach it AFTER the highlighted row (ui/loadout.ts embedded.rest): an open gun pop-up's Esc shuts the pop-up, and the walkthrough stays.
//   · ONCE A BROWSER: finished, skipped or deployed under, it is not shown again (localStorage `twopointsix.kitguide`). THE WAY BACK is the word on the
//     step's head, 'How to pick', which plays it again from its first beat whenever it is not up.
//   · NOT FOR A PAGE NOBODY SITS AT: a browser a script drives (`navigator.webdriver`: every page tool under tools/qa) is no first-time player, and the
//     tools measure the step as it stands; there it is played only when asked for (`?kitguide=1`, or the word on the head).
//   · THE SWITCH: KITGUIDE.on — on in the page, `?kitguide=0` = no walkthrough and no word for it; `?kitguide=1` = played on this visit whatever the
//     browser remembers. UI only: nothing under src/game reads it, no recording carries it, and it is mounted only by the one starting page
//     (ui/startpage.ts), which no headless stand opens.
// Plain DOM in the mission list's layer, one style block injected once. Nothing at module level uses another module's exports.
import type { LoadoutScreen } from './loadout';
import type { KitBrief } from './kitBrief';
import type { PlaceNeeds } from './missions';
import { countWords } from './kitBrief';
import { sizeWords } from '../game/loadout';
import { rectZoom } from './textsize';

export const KITGUIDE = { on: true, again: false, /** a script drives this browser: nothing is played unasked */ driven: false };
try { const v = new URLSearchParams(location.search).get('kitguide'); if (v === '0') KITGUIDE.on = false; else if (v === '1') KITGUIDE.again = true; KITGUIDE.driven = (globalThis.navigator as { webdriver?: boolean } | undefined)?.webdriver === true; } catch { /* no page (the harness) */ }
export const KITGUIDE_LS = 'twopointsix.kitguide';
/** ms a finished beat's card stays, ticked, before the next comes */
export const KITGUIDE_TICK_MS = 520;

export type BeatId = 'job' | 'team' | 'kit' | 'man' | 'card' | 'go';
export const BEATS: readonly BeatId[] = ['job', 'team', 'kit', 'man', 'card', 'go'];
/** what a beat watches: the step's state as the kit screen last painted it */
export interface GuideState { squad: number; kit: string; member: number; worn: string; mapSeen: boolean; mapBig: boolean }
/** a beat is done: the thing it asks for has happened since it came up (`was` = the state as it came up) */
export function beatDone(b: BeatId, was: GuideState, now: GuideState): boolean {
  switch (b) {
    case 'job': return now.mapSeen && !now.mapBig;
    case 'team': return now.squad !== was.squad;
    case 'kit': return now.kit !== was.kit && now.kit !== '';   // (a named kit put on — not a card changed by hand, which leaves none lit)
    case 'man': return now.member !== was.member;
    case 'card': return now.member === was.member && now.squad === was.squad && now.worn !== was.worn && (now.kit === was.kit || now.kit === '');   // (his card changed by hand: the named kit that was on is then a mix of his own — another named kit put on is not it)
    case 'go': return false;
  }
}
export interface BeatWords { title: string; text: string }
/** what a card's words turn on: the mission's own team size · the team as picked · what its place asks of a kit (and whether its map marks the way in) · a rescue */
export interface BeatAsk { own: number; squad: number; needs: PlaceNeeds | null; rescue: boolean }
/** a beat's card for THIS mission */
export function beatWords(b: BeatId, { own, squad, needs, rescue }: BeatAsk): BeatWords {
  const dot = !!needs?.marked;
  switch (b) {
    case 'job': return { title: 'The job', text: `Look at the map before you pick${dot ? '. The dot is where you go in' : ''}.\nPress [M] or click to open it and read the job, and again to close it.` };
    case 'team': return { title: 'Who comes', text: `Press [A] or [D], or click, to set how many come with you.\nThis mission is built for ${sizeWords(own)}.` };
    case 'kit': { const asks: string[] = [];
      if (rescue) asks.push('There are hostages inside, and a frag on their floor will hit them too.');
      if (needs && needs.locked > 0) asks.push(`${needs.locked === 1 ? 'One locked door' : `${cap(countWords(needs.locked))} locked doors`} here, so bring a way through.`);
      return { title: squad ? 'A kit for the squad' : 'A named kit', text: `${squad ? 'One press gives everyone a named kit.' : 'One press puts a named kit on your card.'} Press [A] or [D] to pick one and [Enter] to put it on.${asks.length ? `\n${asks.join(' ')}` : ''}` }; }
    case 'man': return { title: 'Each man', text: 'Press [A] or [D], or click, to pick a teammate. His card opens under the row.' };
    case 'card': return { title: 'His card', text: 'Use [W] [A] [S] [D] and [Enter], or click, to change one thing he carries.\nEach teammate has four pouches, and what he carries shows on Mobility and Concealment.' };
    case 'go': return { title: 'Go', text: 'Press [Enter] on Deploy to start with this team, or [Esc] to go back to the mission.' };
  }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** key caps: each word in brackets is a key */
const caps = (line: string) => line.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;')).replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');

const G = '#missions.one.kg-on.pane-loadout';
const CSS = `
/* THE KIT STEP'S WALKTHROUGH (ui/kitGuide.ts; root class 'kg-on' while a card is up): the row a card is about is lit, the rest of the step stands back */
${G} #loadout [data-row], ${G} .msheet > .mmap, ${G} .mbrief { transition: opacity .25s ease; }
${G} #loadout [data-row]:not(.kg-lit):not([data-row="actions"]), ${G}.kg-dimtop:not(.kb-big) .msheet > .mmap, ${G}.kg-dimtop .mbrief { opacity: 0.38; }
${G} #loadout [data-row="actions"]:not(.kg-lit) .lo-btn.primary { filter: saturate(0.35) brightness(0.8); }
${G} .kg-lit { position: relative; z-index: 2; outline: 2px solid var(--m-accent); outline-offset: 7px; animation: kglit 1.5s ease-in-out infinite; }
${G} .msheet > .mmap.kg-lit { outline-offset: 3px; }
${G}.kb-big .msheet > .mmap.kg-lit { z-index: 6; animation: none; outline-color: transparent; }
${G} #loadout [data-row="actions"].kg-lit { outline: 0; animation: none; }
${G} #loadout [data-row="actions"].kg-lit .lo-btn.primary { animation: kggo 1.5s ease-in-out infinite; }
@keyframes kglit { 0%, 100% { outline-color: var(--m-accent); } 50% { outline-color: rgba(var(--m-accent-rgb),0.25); } }
@keyframes kggo { 0%, 100% { box-shadow: 0 0 0 0 rgba(var(--m-accent-rgb),0.7); } 50% { box-shadow: 0 0 0 10px rgba(var(--m-accent-rgb),0); } }
#missions .kg-card { position: absolute; z-index: 8; display: none; box-sizing: border-box; width: 340px; max-width: calc(100% - 32px); padding: 14px 18px 12px; background: rgb(var(--m-panel2-rgb)); border-top: 3px solid var(--m-accent); box-shadow: 0 14px 44px rgba(0,0,0,0.66), 0 0 0 1px rgba(var(--m-edge),0.16); color: var(--m-text); font: 13px/1.5 var(--m-font); }
#missions.kg-on.pane-loadout .kg-card { display: block; animation: kgin .24s cubic-bezier(.2,.9,.3,1.2); }
#missions.kg-on.kb-big .kg-card { display: none; }
@keyframes kgin { from { opacity: 0; transform: translateY(8px) scale(0.97); } }
#missions .kg-card::before { content: ''; position: absolute; left: 22px; width: 12px; height: 12px; background: var(--m-accent); transform: rotate(45deg); top: -8px; }
#missions .kg-card.over::before { top: auto; bottom: -6px; background: rgb(var(--m-panel2-rgb)); }
#missions .kg-card.end::before { left: auto; right: 40px; }
#missions .kg-pips { display: flex; gap: 5px; margin: 0 0 9px; }
#missions .kg-pips i { width: 16px; height: 3px; background: rgba(var(--m-edge),0.22); transition: background .2s; }
#missions .kg-pips i.done { background: var(--m-soft); } #missions .kg-pips i.on { background: var(--m-accent); }
#missions .kg-card h3 { margin: 0 0 6px; font: 700 19px/1.1 var(--m-head); letter-spacing: 0.06em; text-transform: uppercase; color: var(--m-bright); }
#missions .kg-card h3 b { display: none; margin-left: 10px; color: var(--m-accent); font-weight: 700; }
#missions .kg-card p { margin: 0 0 6px; text-wrap: pretty; }
#missions .kg-card p kbd, #missions .kg-foot kbd { display: inline-block; min-width: 12px; margin: 0 1px; padding: 1px 5px 0; border-radius: 3px; background: var(--m-accent); color: var(--m-on-accent); font: 700 11px/1.35 var(--m-head); text-align: center; }
#missions .kg-foot { display: flex; align-items: center; justify-content: flex-end; gap: 14px; margin-top: 8px; }
#missions .kg-foot button { padding: 5px 0 4px; font: 600 11px/1 var(--m-head); letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; cursor: pointer; }
#missions .kg-foot button:hover { color: var(--m-bright); }
#missions .kg-foot button kbd { margin-left: 6px; background: rgba(var(--m-edge),0.2); color: var(--m-soft); }
#missions .kg-foot .kg-ok { padding: 8px 14px 6px; color: var(--m-on-accent); background: var(--m-accent); }
#missions .kg-foot .kg-ok:hover { color: var(--m-on-accent); background: var(--m-accent-hi); }
#missions .kg-foot .kg-ok[hidden], #missions .kg-foot .kg-next[hidden], #missions .kg-foot kbd[hidden] { display: none; }
#missions .kg-foot .kg-next { color: var(--m-soft); }
/* a beat done: the card ticks before it goes */
#missions .kg-card.tick { border-top-color: var(--m-bright); animation: kgtick .5s ease-out; }
#missions .kg-card.tick h3 b { display: inline; }
#missions .kg-card.tick .kg-pips i.on { background: var(--m-bright); }
@keyframes kgtick { 0% { transform: scale(1); } 30% { transform: scale(1.035); } 100% { transform: scale(1); } }
/* the way back: a quiet word on the step's head */
#missions .kg-again { display: none; margin-left: 22px; padding: 8px 0 7px; font: 600 11px/1 var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; cursor: pointer; }
#missions .kg-again:hover { color: var(--m-bright); }
#missions.one.pane-loadout.kg-can:not(.kg-on) .kg-again { display: inline-block; }
@media (prefers-reduced-motion: reduce) { ${G} .kg-lit, ${G} #loadout [data-row="actions"].kg-lit .lo-btn.primary, #missions .kg-card, #missions .kg-card.tick { animation: none; } }
`;
function styles() { if (document.getElementById?.('kitguide-css')) return; const s = document.createElement('style'); s.id = 'kitguide-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }
const store = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };
/** this browser has been through it (finished, skipped, or deployed under it) */
export function kitGuideSeen(): boolean { try { return store()?.getItem(KITGUIDE_LS) === 'done'; } catch { return false; } }

export interface KitGuide {
  /** the kit screen painted (or the step changed): `s` = the screen on the kit step, null = the keys are not on it */
  paint(s: LoadoutScreen | null): void;
  /** a key on the kit step that the highlighted row did not take: true = it was the walkthrough's (Esc: skip · Enter where it would deploy: the next card) */
  key(code: string, repeat: boolean): boolean;
  /** Deploy was pressed: with a card up, the browser has been through it */
  deployed(): void;
  /** play it from its first beat, whatever the browser remembers (the step's own word) */
  start(): void;
  skip(): void;
  /** the beat whose card is up (null: none) */
  readonly beat: BeatId | null;
  close(): void;
}
/** the walkthrough, on the page's root (#missions): `brief` = the step's brief where it is on (its map is the first beat), `head` = where the way back is hung. Null: the switch is off. */
export function mountKitGuide(root: HTMLElement, brief: KitBrief | null, head: HTMLElement | null): KitGuide | null {
  if (!KITGUIDE.on) return null;
  styles();
  const card = document.createElement('div'); card.className = 'kg-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite'); root.appendChild(card);
  const again = document.createElement('button'); again.className = 'kg-again'; again.setAttribute('type', 'button'); again.textContent = 'How to pick'; again.title = 'show the walkthrough of this step again'; head?.appendChild?.(again);
  let S: LoadoutScreen | null = null, at = -1, was: GuideState | null = null, lit: HTMLElement | null = null, running = KITGUIDE.again || (!KITGUIDE.driven && !kitGuideSeen()), shut = false, busy = false, mapSeen = false, drawn = '';
  const did = new Set<BeatId>();   // the beats this visit's walkthrough has been through (the pips)
  let tick: ReturnType<typeof setTimeout> | null = null, tickNext = 0;   // (a finished beat's card, ticked: the beat that comes when it goes)
  const q = (sel: string) => root.querySelector?.(sel) as HTMLElement | null;
  const shown = (e: HTMLElement | null) => !!e && (e as unknown as { offsetParent?: unknown }).offsetParent !== null;
  const rowOf = (b: BeatId): HTMLElement | null => b === 'job' ? q('.msheet > .mmap') : q(`#loadout [data-row="${b === 'team' ? 'squad' : b === 'kit' ? 'squadkit' : b === 'man' ? 'members' : b === 'card' ? 'kit' : 'actions'}"]`);
  /** this mission's step has the beat's row, and the thing it asks for can be done on it */
  const has = (b: BeatId, s: LoadoutScreen): boolean => {
    const r = rowOf(b); if (!shown(r)) return false;
    switch (b) {
      case 'job': return !!brief;
      case 'team': return (r!.querySelectorAll?.('.lo-size:not(.off)').length ?? 0) > 1;
      case 'kit': return (Array.from(r!.querySelectorAll?.('.lo-set') ?? []) as HTMLElement[]).filter(x => x.style.display !== 'none' && !(x as HTMLButtonElement).disabled).length > 1;
      case 'man': return !!s.card && s.squad > 0;
      case 'card': return !!s.card;
      case 'go': return true;
    }
  };
  const stateOf = (s: LoadoutScreen, b: BeatId): GuideState => ({ squad: s.squad, kit: s.kitName, member: s.member, worn: b === 'card' && s.card ? JSON.stringify(s.worn()) : '', mapSeen, mapBig: !!brief?.big });   // (what he wears is read for the one beat that watches it)
  /** Enter on the highlighted row is the row's own (a named kit put on, Deploy on its own row): everywhere else on the step it would deploy, and under a card it is 'Next' */
  const enterIsRows = (s: LoadoutScreen) => { const r = s.rows[s.sel], id = r?.el?.getAttribute?.('data-row'); return !!r?.confirm || id === 'actions' || id === 'kit'; };   // (the man's card takes its own keys: Enter there works the tile)
  const unlight = () => { lit?.classList.remove('kg-lit'); lit = null; };
  const hide = () => { unlight(); root.classList.remove('kg-on', 'kg-dimtop'); drawn = ''; };
  const remember = () => { try { store()?.setItem(KITGUIDE_LS, 'done'); } catch { /* no store: it is shown again next visit */ } };
  const end = () => { running = false; at = -1; was = null; if (tick) { clearTimeout(tick); tick = null; } hide(); remember(); };
  /** the card beside its row: under it where there is room over the step's foot, else over it */
  const place = () => { if (!lit || at < 0) return;
    const z = rectZoom(), R = root.getBoundingClientRect(), r = lit.getBoundingClientRect(), b = BEATS[at], H = card.offsetHeight || 150, W = card.offsetWidth || 340, gap = 16;
    const foot = q('#loadout [data-row="actions"]')?.getBoundingClientRect(), floor = (foot && b !== 'go' ? foot.top : R.bottom) - 8;
    const under = (r.bottom + gap) / z + H <= floor / z, over = b === 'go' || !under;
    const anchor = b === 'go' ? (lit.querySelector?.('.lo-btn.primary') as HTMLElement | null)?.getBoundingClientRect() ?? r : r;
    const top = over ? Math.max(R.top + 8, anchor.top - gap - H * z) : r.bottom + gap;
    const left = b === 'go' ? anchor.right - W * z : Math.min(Math.max(r.left, R.left + 12), R.right - W * z - 12);
    card.style.left = `${Math.round((left - R.left) / z)}px`; card.style.top = `${Math.round((top - R.top) / z)}px`;
    card.classList.toggle('over', over); card.classList.toggle('end', b === 'go'); };
  /** the beat at `at`, up: its row lit, the keys on that row, its card drawn */
  const show = (s: LoadoutScreen) => {
    const b = BEATS[at], r = rowOf(b); if (!r) return;
    if (lit !== r) { unlight(); lit = r; r.classList.add('kg-lit'); }
    root.classList.add('kg-on'); root.classList.toggle('kg-dimtop', b !== 'job');
    const n = brief?.needs ?? null, enter = b !== 'go' && !enterIsRows(s);
    const sig = `${s.entry.id}|${b}|${s.squad ? 1 : 0}|${enter}|${n ? `${n.locked},${n.hostages},${n.marked}` : ''}`;
    if (drawn !== sig) { drawn = sig;
      const w = beatWords(b, { own: s.entry.squad, squad: s.squad, needs: n, rescue: s.entry.kind === 'rescue' }), live = BEATS.filter((x, i) => (i < at ? did.has(x) : has(x, s))), k = live.indexOf(b);
      card.className = 'kg-card';
      card.innerHTML = `<div class="kg-pips">${live.map((_x, i) => `<i class="${i < k ? 'done' : i === k ? 'on' : ''}"></i>`).join('')}</div><h3>${caps(w.title)}<b>✓</b></h3>${w.text.split('\n').map(p => `<p>${caps(p)}</p>`).join('')}<div class="kg-foot"><button type="button" class="kg-skip" data-kg="skip">Skip<kbd>Esc</kbd></button><button type="button" class="kg-next" data-kg="next"${b === 'go' ? ' hidden' : ''}>Next<kbd${enter ? '' : ' hidden'}>Enter</kbd></button><button type="button" class="kg-ok" data-kg="ok"${b === 'go' ? '' : ' hidden'}>Got it</button></div>`;
      void card.offsetWidth; }
    place();
  };
  /** onto the first beat from `from` on that this mission's step has (none: the walkthrough is over) */
  const go = (s: LoadoutScreen, from: number) => {
    let k = from; while (k < BEATS.length && !has(BEATS[k], s)) k++;
    if (k >= BEATS.length) { end(); return; }
    at = k; mapSeen = false; was = stateOf(s, BEATS[k]); drawn = ''; did.add(BEATS[k]);
    const b = BEATS[k], r = rowOf(b), row = b === 'job' ? -1 : s.rows.findIndex(x => x.el === r);   // (the keys go where the card points: A D act on the lit row at once)
    if (row >= 0 && s.sel !== row) { busy = true; try { s.sel = row; s.rows[row].enter?.(1); s.paint(); } finally { busy = false; } }
    show(s);
  };
  /** the card's 'Next': on to the beat after this one, its thing done or not */
  const next = () => { if (!S || !S.card || !running || at < 0) return; if (tick) { clearTimeout(tick); tick = null; go(S, tickNext); } else go(S, at + 1); };
  const onClick = (e: Event) => { const k = (e.target as HTMLElement | null)?.closest?.('[data-kg]')?.getAttribute('data-kg'); if (!k) return; e.stopPropagation(); if (k === 'skip') api.skip(); else if (k === 'next') next(); else end(); };
  card.addEventListener?.('click', onClick);
  card.addEventListener?.('mousedown', (e: Event) => e.stopPropagation());
  const onAgain = (e: Event) => { e.stopPropagation(); (again as unknown as { blur?: () => void }).blur?.(); api.start(); };
  again.addEventListener?.('click', onAgain);
  const onResize = () => { if (!shut && running && at >= 0 && S) place(); };
  try { globalThis.addEventListener?.('resize', onResize); root.addEventListener?.('scroll', onResize, true); } catch { /* no window */ }   // (the sheet scrolls in a short window: the card goes with its row)
  const api: KitGuide = {
    paint(s) {
      if (shut || busy) return;
      if (s !== S) { S = s; if (tick) { clearTimeout(tick); tick = null; at = tickNext; } was = null; drawn = ''; }   // (another mission's step, or the keys left it: the beat is taken up afresh on what is there — a beat already ticked is not asked for again)
      root.classList.toggle('kg-can', !!s && !!s.card);
      if (!s || !s.card) { hide(); return; }   // (off the step — or a mission that issues its own kit: nothing to pick, nothing to teach)
      if (!running || tick) return;
      if (brief?.big) mapSeen = true;
      if (at < 0 || !was) { go(s, Math.max(0, at)); return; }
      if (!has(BEATS[at], s)) { go(s, at + 1); return; }
      if (beatDone(BEATS[at], was, stateOf(s, BEATS[at]))) {   // (done by doing: the card ticks, then the next comes)
        card.classList.add('tick'); tickNext = at + 1;
        tick = setTimeout(() => { tick = null; if (shut || !running) return; if (S && S.card) go(S, tickNext); else at = tickNext; }, KITGUIDE_TICK_MS);
        return; }
      show(s);
    },
    key(code, repeat) { if (shut || !running || at < 0 || !S || !root.classList.contains('kg-on')) return false;   // (only while a card is up: a mission with no card to change has none, and its Esc is the step's)
      if (code === 'Escape') { if (!repeat) api.skip(); return true; }
      if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && BEATS[at] !== 'go' && !enterIsRows(S)) { if (!repeat) next(); return true; }   // (Enter would deploy from here: under a card it is the card's Next)
      return false; },
    deployed() { if (running && at >= 0 && root.classList.contains('kg-on')) end(); },   // (deployed UNDER A CARD: from a mission with no kit to pick — a tutorial, a level that issues its own — none is up, it has not been seen, and it is kept for the first that has)
    start() { if (shut) return; if (tick) { clearTimeout(tick); tick = null; } running = true; at = -1; was = null; drawn = ''; did.clear(); if (S) api.paint(S); },
    skip() { if (running) end(); },
    get beat() { return running && at >= 0 && root.classList.contains('kg-on') ? BEATS[at] : null; },
    close() { shut = true; if (tick) clearTimeout(tick); hide(); root.classList.remove('kg-can'); card.remove?.(); again.remove?.(); try { globalThis.removeEventListener?.('resize', onResize); root.removeEventListener?.('scroll', onResize, true); } catch { /* no window */ } },
  };
  return api;
}
