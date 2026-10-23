// THE KIT STEP'S WALKTHROUGH — Team & kit walks the player through picking a kit by doing it, one small card at a time. This file is the ENGINE and
// the step's general script; the script a player is shown unasked is a tutorial mission's own plan (ui/kitPlan.ts).
//
// The maintainer, 10-22: "we should teach how to pick squad layouts! so maybe a tutorial on the gear page for a mission (that's skippable)" — and, 10-23,
// of the walkthrough that then came up on every mission's step: "this tutorial is good but we should attach it to a tutorial mission (and make it
// bespoke and explain how to plan), not for the regular ones". So:
//   · A WALKTHROUGH IS A SCRIPT (GuideScript): its beats in the step's own order, each the row its card sits by, its words for the step as it stands,
//     and what counts as having done it. A card sits beside its row, that row lit and the rest of the step dimmed, and goes when the player has DONE
//     what it asks (or on its 'Next'). A beat whose row this mission's step does not have, or whose thing is already so, is left out.
//   · WHICH SCRIPT (guideFor): the plan written for the mission whose step this is (KIT_PLANS — today the tutorial's squad mission), played unasked on a
//     first visit. A REGULAR MISSION HAS NONE: no card, no word on the head. The step's general walkthrough (GENERIC below: the job, who comes, a kit
//     for the squad, each man, his card, go) is kept for comparing and played only when asked for on the address (`?kitguide=1`).
//   · THE PAGE UNDER A CARD IS LIVE: nothing is locked, a click anywhere does what it always did — but Enter, which on most rows of the step is Deploy,
//     is the card's 'Next' while a card is up and the highlighted row has no Enter of its own: a first press of Enter on a card must never start the
//     mission. Deploy under a card is the Deploy row's own Enter, or a click on it.
//   · SKIPPABLE AT ANY POINT: 'Skip' on every card, or Esc (the first Esc is the walkthrough's; the next is the step's own, back to the mission). The
//     keys reach it AFTER the highlighted row (ui/loadout.ts embedded.rest): an open gun pop-up's Esc shuts the pop-up, and the walkthrough stays.
//   · ONCE A BROWSER, EACH SCRIPT UNDER ITS OWN KEY: finished, skipped or deployed under, it is not shown again (localStorage, `GuideScript.ls`). THE
//     WAY BACK is the script's own word on the step's head ('How to plan'), which plays it again from its first beat whenever it is not up.
//   · NOT FOR A PAGE NOBODY SITS AT: a browser a script drives (`navigator.webdriver`: every page tool under tools/qa) is no first-time player, and the
//     tools measure the step as it stands; there it is played only when asked for (`?kitguide=1`, or the word on the head).
//   · THE SWITCH: KITGUIDE.on — on in the page, `?kitguide=0` = no walkthrough and no word on any step; `?kitguide=1` = played on this visit whatever
//     the browser remembers (a mission's plan, or the general one on a regular mission). UI only: nothing under src/game reads it, no recording carries
//     it, and it is mounted only by the one starting page (ui/startpage.ts), which no headless stand opens.
// Plain DOM in the mission list's layer, one style block injected once. Nothing at module level uses another module's exports.
import type { LoadoutScreen } from './loadout';
import type { KitBrief } from './kitBrief';
import type { PlaceNeeds } from './missions';
import { countWords } from './kitBrief';
import { sizeWords } from '../game/loadout';
import { kitWorn } from '../game/kit';
import { KIT_PLANS } from './kitPlan';
import { rectZoom } from './textsize';

export const KITGUIDE = { on: true, again: false, /** a script drives this browser: nothing is played unasked */ driven: false };
try { const v = new URLSearchParams(location.search).get('kitguide'); if (v === '0') KITGUIDE.on = false; else if (v === '1') KITGUIDE.again = true; KITGUIDE.driven = (globalThis.navigator as { webdriver?: boolean } | undefined)?.webdriver === true; } catch { /* no page (the harness) */ }
export const KITGUIDE_LS = 'twopointsix.kitguide';
/** ms a finished beat's card stays, ticked, before the next comes */
export const KITGUIDE_TICK_MS = 520;

/** the row of the step a beat is about (the brief's map · the Team row · the named kits · the roster · the picked man's card · Deploy) */
export type BeatRow = 'map' | 'squad' | 'squadkit' | 'members' | 'kit' | 'actions';
/** what a beat watches: the step's state as the kit screen last painted it (`frags`, `smoke` = on YOUR card as this team wears it · `bangs` = the stun
 *  grenades the teammates who come carry between them · `kits` = the named kits the step offers) */
export interface GuideState { squad: number; kit: string; member: number; worn: string; mapSeen: boolean; mapBig: boolean; frags: number; smoke: number; bangs: number; kits: readonly string[] }
export interface BeatWords { title: string; text: string }
/** what a card's words turn on: the mission's own team size · what its place asks of a kit (and whether its map marks the way in) · a rescue · the step as it stands */
export interface BeatAsk { own: number; needs: PlaceNeeds | null; rescue: boolean; now: GuideState }
/** ONE BEAT of a walkthrough: the row its card sits by, its words for this mission, and what counts as having done it */
export interface Beat {
  id: string; row: BeatRow;
  /** the man whose card is opened as the beat comes up (0 = you) */
  member?: number;
  /** it watches what the picked man wears (read only for such a beat) */
  wears?: boolean;
  /** asked for only where this is true of the step (beside its row being there at all) */
  has?(a: BeatAsk): boolean;
  words(a: BeatAsk): BeatWords;
  /** the thing it asks for has happened since it came up (`was` = the state as it came up). Absent: it goes on its button alone */
  done?(was: GuideState, now: GuideState): boolean;
}
/** A WALKTHROUGH: its beats in the step's own order · the key this browser remembers it under · the word on the step's head that plays it again ·
 *  `auto` = played unasked on a first visit (not: only when asked for) */
export interface GuideScript { id: string; ls: string; again: string; auto: boolean; beats: readonly Beat[] }

/** THE STEP'S OWN WALKTHROUGH, for any mission whose kit can be picked — kept for comparing, played only when asked for (`?kitguide=1`) */
export const GENERIC: GuideScript = { id: 'generic', ls: KITGUIDE_LS, again: 'How to pick', auto: false, beats: [
  { id: 'job', row: 'map', done: (_was, now) => now.mapSeen && !now.mapBig,
    words: ({ needs }) => ({ title: 'The job', text: `Look at the map before you pick${needs?.marked ? '. The dot is where you go in' : ''}.\nPress [M] or click to open it and read the job, and again to close it.` }) },
  { id: 'team', row: 'squad', done: (was, now) => now.squad !== was.squad,
    words: ({ own }) => ({ title: 'Who comes', text: `Press [A] or [D], or click, to set how many come with you.\nThis mission is built for ${sizeWords(own)}.` }) },
  { id: 'kit', row: 'squadkit', done: (was, now) => now.kit !== was.kit && now.kit !== '',   // (a named kit put on — not a card changed by hand, which leaves none lit)
    words: ({ needs, rescue, now }) => { const asks: string[] = [];
      if (rescue) asks.push('There are hostages inside, and a frag on their floor will hit them too.');
      if (needs && needs.locked > 0) asks.push(`${needs.locked === 1 ? 'One locked door' : `${cap(countWords(needs.locked))} locked doors`} here, so bring a way through.`);
      return { title: now.squad ? 'A kit for the squad' : 'A named kit', text: `${now.squad ? 'One press gives everyone a named kit.' : 'One press puts a named kit on your card.'} Press [A] or [D] to pick one and [Enter] to put it on.${asks.length ? `\n${asks.join(' ')}` : ''}` }; } },
  { id: 'man', row: 'members', done: (was, now) => now.member !== was.member,
    words: () => ({ title: 'Each man', text: 'Press [A] or [D], or click, to pick a teammate. His card opens under the row.' }) },
  { id: 'card', row: 'kit', wears: true, done: (was, now) => now.member === was.member && now.squad === was.squad && now.worn !== was.worn && (now.kit === was.kit || now.kit === ''),   // (his card changed by hand: the named kit that was on is then a mix of his own — another named kit put on is not it)
    words: () => ({ title: 'His card', text: 'Use [W] [A] [S] [D] and [Enter], or click, to change one thing he carries.\nEach teammate has four pouches, and what he carries shows on Mobility and Concealment.' }) },
  { id: 'go', row: 'actions',
    words: () => ({ title: 'Go', text: 'Press [Enter] on Deploy to start with this team, or [Esc] to go back to the mission.' }) },
] };
/** the walkthrough of a mission's step: the plan written for that mission (ui/kitPlan.ts), else the step's own where it was asked for, else none */
export function guideFor(missionId: string): GuideScript | null { return KIT_PLANS[missionId]?.guide ?? (KITGUIDE.again ? GENERIC : null); }
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
/** this browser has been through a walkthrough (finished, skipped, or deployed under it) */
export function kitGuideSeen(script: GuideScript = GENERIC): boolean { try { return store()?.getItem(script.ls) === 'done'; } catch { return false; } }

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
  /** the beat whose card is up, by its id (null: none) */
  readonly beat: string | null;
  /** the walkthrough this mission's step has, by its id (null: none) */
  readonly script: string | null;
  close(): void;
}
/** the walkthrough, on the page's root (#missions): `brief` = the step's brief where it is on (its map is a beat's row), `head` = where the way back is hung. Null: the switch is off. */
export function mountKitGuide(root: HTMLElement, brief: KitBrief | null, head: HTMLElement | null): KitGuide | null {
  if (!KITGUIDE.on) return null;
  styles();
  const card = document.createElement('div'); card.className = 'kg-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite'); root.appendChild(card);
  const again = document.createElement('button'); again.className = 'kg-again'; again.setAttribute('type', 'button'); again.title = 'show the walkthrough of this step again'; head?.appendChild?.(again);
  let S: LoadoutScreen | null = null, script: GuideScript | null = null, at = -1, was: GuideState | null = null, lit: HTMLElement | null = null, running = false, shut = false, busy = false, mapSeen = false, drawn = '';
  const did = new Set<string>();   // the beats this visit's walkthrough has been through (the pips)
  const over = new Set<string>();   // the walkthroughs ended on this visit (finished, skipped, deployed under): not played again unasked however the page was opened
  let tick: ReturnType<typeof setTimeout> | null = null, tickNext = 0;   // (a finished beat's card, ticked: the beat that comes when it goes)
  const q = (sel: string) => root.querySelector?.(sel) as HTMLElement | null;
  const shown = (e: HTMLElement | null) => !!e && (e as unknown as { offsetParent?: unknown }).offsetParent !== null;
  const rowOf = (b: Beat): HTMLElement | null => b.row === 'map' ? q('.msheet > .mmap') : q(`#loadout [data-row="${b.row}"]`);
  const kitsOf = (): string[] => (Array.from(q('#loadout [data-row="squadkit"]')?.querySelectorAll?.('.lo-set') ?? []) as HTMLElement[]).filter(x => x.style.display !== 'none' && !(x as HTMLButtonElement).disabled).map(x => x.getAttribute('data-kit') ?? '');
  /** the step as it stands, read ONCE for each thing the walkthrough does (a paint asks it of every beat: the pips, the row, the words) and again after anything that moves it */
  let read: { s: LoadoutScreen; wears: boolean; v: GuideState } | null = null;
  const stale = () => { read = null; };
  const stateOf = (s: LoadoutScreen, b: Beat | null): GuideState => { const wears = !!b?.wears && !!s.card;
    if (read && read.s === s && (read.wears || !wears)) return wears || !read.wears ? read.v : { ...read.v, worn: '' };
    const you = s.card ? kitWorn(s.squad)[0] : null;
    const v: GuideState = { squad: s.squad, kit: s.kitName, member: s.member, worn: wears ? JSON.stringify(s.worn()) : '', mapSeen, mapBig: !!brief?.big,   // (what he wears is read for the one beat that watches it)
      frags: you?.frags ?? 0, smoke: you?.smoke ?? 0, bangs: s.card ? s.pool().bangs : 0, kits: kitsOf() };
    read = { s, wears, v }; return v; };
  const askOf = (s: LoadoutScreen, b: Beat | null): BeatAsk => ({ own: s.entry.squad, needs: brief?.needs ?? null, rescue: s.entry.kind === 'rescue', now: stateOf(s, b) });
  /** this mission's step has the beat's row, and the thing it asks for can be done on it */
  const has = (b: Beat, s: LoadoutScreen): boolean => {
    const r = rowOf(b); if (!shown(r)) return false;
    const row = b.row === 'map' ? !!brief : b.row === 'squad' ? (r!.querySelectorAll?.('.lo-size:not(.off)').length ?? 0) > 1 : b.row === 'squadkit' ? kitsOf().length > 1
      : b.row === 'members' ? !!s.card && s.squad > 0 : b.row === 'kit' ? !!s.card : true;
    return row && (b.has?.(askOf(s, b)) ?? true);
  };
  /** Enter on the highlighted row is the row's own (a named kit put on, Deploy on its own row): everywhere else on the step it would deploy, and under a card it is 'Next' */
  const enterIsRows = (s: LoadoutScreen) => { const r = s.rows[s.sel], id = r?.el?.getAttribute?.('data-row'); return !!r?.confirm || id === 'actions' || id === 'kit'; };   // (the man's card takes its own keys: Enter there works the tile)
  const beat = (): Beat | null => (script && at >= 0 ? script.beats[at] ?? null : null);
  const unlight = () => { lit?.classList.remove('kg-lit'); lit = null; };
  const hide = () => { unlight(); root.classList.remove('kg-on', 'kg-dimtop'); drawn = ''; };
  const remember = () => { if (!script) return; over.add(script.id); try { store()?.setItem(script.ls, 'done'); } catch { /* no store: it is shown again next visit */ } };
  const end = () => { running = false; at = -1; was = null; if (tick) { clearTimeout(tick); tick = null; } hide(); remember(); };
  /** the card beside its row: under it where there is room over the step's foot, else over it */
  const place = () => { const b = beat(); if (!lit || !b) return;
    const z = rectZoom(), R = root.getBoundingClientRect(), r = lit.getBoundingClientRect(), last = b.row === 'actions', H = card.offsetHeight || 150, W = card.offsetWidth || 340, gap = b.row === 'squadkit' ? 40 : 16;   // (the named kits: the line under them, what the squad carries between them, stays in view — it is what a kit put on changes)
    const foot = q('#loadout [data-row="actions"]')?.getBoundingClientRect(), floor = (foot && !last ? foot.top : R.bottom) - 8;
    const under = (r.bottom + gap) / z + H <= floor / z, above = last || !under;
    const anchor = last ? (lit.querySelector?.('.lo-btn.primary') as HTMLElement | null)?.getBoundingClientRect() ?? r : r;
    const top = above ? Math.max(R.top + 8, anchor.top - gap - H * z) : r.bottom + gap;
    const left = last ? anchor.right - W * z : Math.min(Math.max(r.left, R.left + 12), R.right - W * z - 12);
    card.style.left = `${Math.round((left - R.left) / z)}px`; card.style.top = `${Math.round((top - R.top) / z)}px`;
    card.classList.toggle('over', above); card.classList.toggle('end', last); };
  /** the beat at `at`, up: its row lit, the keys on that row, its card drawn */
  const show = (s: LoadoutScreen) => {
    const b = beat(), r = b ? rowOf(b) : null; if (!b || !r || !script) return;
    if (lit !== r) { unlight(); lit = r; r.classList.add('kg-lit'); }
    root.classList.add('kg-on'); root.classList.toggle('kg-dimtop', b.row !== 'map');
    const a = askOf(s, b), n = a.needs, last = b.row === 'actions', enter = !last && !enterIsRows(s);
    const sig = `${s.entry.id}|${script.id}|${b.id}|${enter}|${n ? `${n.locked},${n.hostages},${n.marked}` : ''}|${a.now.squad}|${a.now.kit}|${a.now.frags}|${a.now.smoke}|${a.now.bangs}`;
    if (drawn !== sig) { const moved = !drawn.startsWith(`${s.entry.id}|${script.id}|${b.id}|`); drawn = sig;
      const w = b.words(a), live = script.beats.filter((x, i) => (i < at ? did.has(x.id) : has(x, s))), k = live.indexOf(b);
      card.className = 'kg-card'; card.setAttribute('data-beat', b.id); if (!moved) card.style.animation = 'none'; else card.style.animation = '';   // (the same card with a count on it changed: it does not jump in again)
      card.innerHTML = `<div class="kg-pips">${live.map((_x, i) => `<i class="${i < k ? 'done' : i === k ? 'on' : ''}"></i>`).join('')}</div><h3>${caps(w.title)}<b>✓</b></h3>${w.text.split('\n').map(p => `<p>${caps(p)}</p>`).join('')}<div class="kg-foot"><button type="button" class="kg-skip" data-kg="skip">Skip<kbd>Esc</kbd></button><button type="button" class="kg-next" data-kg="next"${last ? ' hidden' : ''}>Next<kbd${enter ? '' : ' hidden'}>Enter</kbd></button><button type="button" class="kg-ok" data-kg="ok"${last ? '' : ' hidden'}>Got it</button></div>`;
      void card.offsetWidth; }
    place();
  };
  /** onto the first beat from `from` on that this mission's step has (none: the walkthrough is over) */
  const go = (s: LoadoutScreen, from: number) => {
    if (!script) return;
    let k = from; while (k < script.beats.length && !has(script.beats[k], s)) k++;
    if (k >= script.beats.length) { end(); return; }
    at = k; mapSeen = false; stale(); drawn = ''; did.add(script.beats[k].id);
    const b = script.beats[k], r = rowOf(b), row = b.row === 'map' ? -1 : s.rows.findIndex(x => x.el === r);   // (the keys go where the card points: A D act on the lit row at once)
    busy = true; stale();
    try { if (b.member !== undefined && s.card && s.member !== b.member) s.pick(b.member);   // (the card it is about is the one that is open)
      if (row >= 0 && s.sel !== row) { s.sel = row; s.rows[row].enter?.(1); s.paint(); } } finally { busy = false; stale(); }
    was = stateOf(s, b);
    show(s);
  };
  /** the card's 'Next': on to the beat after this one, its thing done or not */
  const next = () => { stale(); if (!S || !S.card || !running || at < 0) return; if (tick) { clearTimeout(tick); tick = null; go(S, tickNext); } else go(S, at + 1); };
  const onClick = (e: Event) => { const k = (e.target as HTMLElement | null)?.closest?.('[data-kg]')?.getAttribute('data-kg'); if (!k) return; e.stopPropagation(); if (k === 'skip') api.skip(); else if (k === 'next') next(); else end(); };
  card.addEventListener?.('click', onClick);
  card.addEventListener?.('mousedown', (e: Event) => e.stopPropagation());
  const onAgain = (e: Event) => { e.stopPropagation(); (again as unknown as { blur?: () => void }).blur?.(); api.start(); };
  again.addEventListener?.('click', onAgain);
  const onResize = () => { if (!shut && running && at >= 0 && S) place(); };
  try { globalThis.addEventListener?.('resize', onResize); root.addEventListener?.('scroll', onResize, true); } catch { /* no window */ }   // (the sheet scrolls in a short window: the card goes with its row)
  /** the walkthrough of the mission whose step this is, taken up: played unasked where it is one that is (a mission's own plan, a first visit, a browser somebody sits at) or where it was asked for on the address */
  const take = (sc: GuideScript | null) => { if (tick) { clearTimeout(tick); tick = null; } hide(); script = sc; at = -1; was = null; did.clear(); again.textContent = sc?.again ?? '';
    running = !!sc && !over.has(sc.id) && (KITGUIDE.again || (sc.auto && !KITGUIDE.driven && !kitGuideSeen(sc))); };
  const api: KitGuide = {
    paint(s) {
      if (shut || busy) return;
      stale();
      if (s !== S) { S = s; const sc = s ? (s.card ? guideFor(s.entry.id) : null) : script;   // (the keys off the step for a moment keep the walkthrough that was up)
        if (sc !== script) take(sc);   // (another mission's step with another walkthrough, or none: taken up from its first beat)
        else if (tick) { clearTimeout(tick); tick = null; at = tickNext; }   // (the same one: the beat is taken up afresh on what is there — a beat already ticked is not asked for again)
        was = null; drawn = ''; }
      root.classList.toggle('kg-can', !!s && !!s.card && !!script);
      if (!s || !s.card || !script) { hide(); return; }   // (off the step — a mission that issues its own kit — a mission with no walkthrough: nothing to teach)
      if (!running || tick) return;
      if (brief?.big && !mapSeen) { mapSeen = true; stale(); }
      if (at < 0 || !was) { go(s, Math.max(0, at)); return; }
      const b = script.beats[at];
      if (b?.done?.(was, stateOf(s, b))) {   // (done by doing: the card ticks, then the next comes — asked BEFORE whether the beat still has its place: a beat left out once its thing is so, like a named kit already on, is DONE the moment it is put on)
        card.style.animation = ''; card.classList.add('tick'); tickNext = at + 1;   // (a card redrawn in place had its entrance held off: the tick's own pulse plays)
        tick = setTimeout(() => { tick = null; if (shut || !running) return; if (S && S.card) go(S, tickNext); else at = tickNext; }, KITGUIDE_TICK_MS);
        return; }
      if (!b || !has(b, s)) { go(s, at + 1); return; }
      show(s);
    },
    key(code, repeat) { if (shut || !running || at < 0 || !S || !root.classList.contains('kg-on')) return false; stale();   // (only while a card is up: a mission with no card to change has none, and its Esc is the step's)
      if (code === 'Escape') { if (!repeat) api.skip(); return true; }
      if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && beat()?.row !== 'actions' && !enterIsRows(S)) { if (!repeat) next(); return true; }   // (Enter would deploy from here: under a card it is the card's Next)
      return false; },
    deployed() { if (running && at >= 0 && root.classList.contains('kg-on')) end(); },   // (deployed UNDER A CARD: from a mission with no walkthrough none is up, and nothing is remembered)
    start() { if (shut || !script) return; if (tick) { clearTimeout(tick); tick = null; } over.delete(script.id); running = true; at = -1; was = null; drawn = ''; did.clear(); if (S) api.paint(S); },
    skip() { if (running) end(); },
    get beat() { return running && root.classList.contains('kg-on') ? beat()?.id ?? null : null; },
    get script() { return script?.id ?? null; },
    close() { shut = true; if (tick) clearTimeout(tick); hide(); root.classList.remove('kg-can'); card.remove?.(); again.remove?.(); try { globalThis.removeEventListener?.('resize', onResize); root.removeEventListener?.('scroll', onResize, true); } catch { /* no window */ } },
  };
  return api;
}
