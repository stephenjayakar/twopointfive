// THE KIT STEP'S BRIEF — the job, the map and what the place asks of a kit, kept in sight while the team is picked.
//
// The maintainer, 10-22, on the Team & kit step: "honestly it doesn't make a ton of sense right now since you don't know anything about the objective or map
// when picking kit". The step folded the mission's sheet down to its NAME: what the job is, how many hold the floor, the plan and the way in were all one
// step back, behind Esc. So the choice of who comes and what they carry was made blind.
// Now the step keeps a band across its top: THE MAP SHEET at the left (the mission list's own canvas, the way in marked on it as on the Mission step; a
// click on it or M makes it large, again or Esc puts it back) and beside it the mission's name, what is set for it, its facts and its job in the list's own
// words — nothing here is a new sentence. To the list's facts the band adds WHAT THE PLACE ASKS OF A KIT, counted off the level's own file (ui/missions.ts
// placeNeeds): the doors found locked (a charge, the shotgun, the hammer or a pick is the way through one), how many of those are steel (the hammer and
// the shotgun do not take steel), and a rescue's hostages (a frag on their floor is theirs too). A count is drawn as a digit up to five and as a word
// past it (no digit above 5 on a menu).
//   · LARGE, the sheet carries the mission's name and its job under the map (`.kb-cap`, the list's words again): in a short window (800 px and under) the
//     band is no taller than the name alone was — the map a small mark, the name, the facts under it — and the job's sentence, for which
//     there is no room without cutting it, is read there.
//   · THE ELEMENTS ARE THE LIST'S: .mmap, .mcsum, .mfacts and .mblurb are shown on the kit step by the rules below and are otherwise untouched; the
//     facts of this file's own are cells of the same .mfacts row, drawn on this step only. One of them is the list's Defenders cell AGAIN, a count past
//     five written as a word ('eleven'): the list's own cell, which writes the digits, is not shown on this step.
//   · THE COUNTS ARE THE MISSION'S AS STAGED, not the file's alone: a rescue finds its side door unlocked (game/rescue.ts), so it is not counted there.
//   · THE SWITCH: KITBRIEF.on — on in the page, `?kitbrief=0` = the step as it was (the name alone). UI only: nothing under src/game reads it, no
//     recording carries it, and it is mounted only by the one starting page (ui/startpage.ts), which no headless stand opens.
// Plain DOM and one style block, injected once. Nothing at module level uses another module's exports.
import { placeNeeds, type Mission, type PlaceNeeds } from './missions';

export const KITBRIEF = { on: true };
try { if (new URLSearchParams(location.search).get('kitbrief') === '0') KITBRIEF.on = false; } catch { /* no page (the harness) */ }

const WORDS = ['none', '1', '2', '3', '4', '5', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** a count as the menus write one: a digit up to five, a word past it */
export function countWords(n: number): string { return WORDS[n] ?? 'many'; }
/** the cells this file adds to the facts row: [label, value, the sentence its tooltip says] */
/** a line of the list's with its counts as the menus write them ('11' → 'eleven', '3 holding hostages' as it is) */
export function wordsOf(line: string): string { return line.replace(/\d+/g, n => countWords(Number(n))); }
export function needCells(n: PlaceNeeds | null, rescue: boolean): [string, string, string][] {
  const out: [string, string, string][] = [];
  if (rescue) out.push(['Hostages', n && n.hostages > 0 ? countWords(n.hostages) : 'inside', 'a frag thrown onto their floor is theirs too']);
  if (n && n.locked > 0) out.push(['Locked doors', countWords(n.locked), 'a door charge, the breaching shotgun, the hammer or a pick is the way through a locked door']);
  if (n && n.steel > 0) out.push(['Steel', countWords(n.steel), 'the hammer and the shotgun do not take a steel door: a charge or a pick does']);
  return out;
}

const K = '#missions.one.kb.pane-loadout';
const CSS = `
/* THE KIT STEP'S BRIEF (ui/kitBrief.ts; root class 'kb'): the map sheet at the left of a band across the step's top, the mission's own words beside it */
${K} .msheet { position: relative; }
/* (the band is as tall as its WORDS: the sheet takes that height and draws the map inside it, so the kit under the band loses as little of the window as the words need) */
${K} .msheet:has(> .mmap .mplan:not([style*="none"])) { grid-template-columns: clamp(132px, 12vw / var(--tz, 1), 172px) minmax(0, 1fr); column-gap: 20px; }
${K} .msheet > .mmap { display: block; position: relative; grid-column: 1; grid-row: 1; align-self: stretch; box-sizing: border-box; width: 100%; min-height: 92px; margin: 0 0 16px; overflow: hidden; cursor: zoom-in; }
${K} .msheet > .mmap:has(.mplan[style*="none"]) { display: none; }
${K} .msheet > .mmap .mplan { display: block; position: absolute; left: 0; top: 0; box-sizing: border-box; width: 100%; height: 100%; max-width: none; max-height: none; aspect-ratio: auto; object-fit: contain; margin: 0; padding: 4px; background: none; border: 0; border-radius: 0; }
${K} .msheet > .mmap .mplace { display: none; }
${K} .msheet > .mmap:hover { box-shadow: 0 0 0 1px rgba(var(--m-edge),0.4); }
${K} .msheet:has(> .mmap .mplan:not([style*="none"])) .mbrief { grid-column: 2; }
${K} .mbrief { align-content: flex-start; gap: 0 18px; }
${K} .mcsum { display: block; }
${K} .mfacts { flex: 0 0 100%; display: flex; margin-top: 9px; }
${K} .mfact.kb { display: flex; }
${K} .mfact[data-fact="defenders"]:not(.kb) { display: none; }
${K} .mblurb { flex: 0 0 100%; display: block; max-width: 74ch; margin-top: 9px; font-size: 13px; line-height: 1.45; }
#missions .mfact.kb { display: none; }
/* …large: the sheet over the step, on the menus' ground; the band keeps its place under it */
${K}.kb-big .msheet > .mmap { position: absolute; z-index: 6; left: var(--pg); top: 20px; width: min(820px, calc(100% - 2 * var(--pg))); min-height: 0; margin: 0; cursor: zoom-out; background-color: rgb(var(--m-panel-rgb)); box-shadow: 0 0 0 1px rgba(var(--m-edge),0.4), 0 24px 80px rgba(0,0,0,0.7); animation: kbbig .16s ease-out; }
${K}.kb-big .msheet > .mmap .mplan { position: static; height: auto; aspect-ratio: 40 / 28; padding: 12px; }
#missions .kb-cap { display: none; }
${K}.kb-big .msheet > .mmap .kb-cap { display: block; padding: 2px 18px 14px; font: 14px/1.5 var(--m-font); color: var(--m-text); }
${K}.kb-big .msheet > .mmap .kb-cap b { display: block; margin-bottom: 3px; font: 700 17px/1.2 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; color: var(--m-bright); }
@keyframes kbbig { from { opacity: 0; transform: scale(0.96); transform-origin: 0 0; } }
/* A SHORT WINDOW (800 px and under; the maintainer's own is about 1000 x 673, and the kit under the head fills it — tools/qa/kitdense-page.cjs holds that a
   gun's pop-up opens under the guns and ends over the foot at 1317 x 775, and that nothing scrolls at 1200 x 675): the band is NOT A PIXEL TALLER than the
   name alone was (the sheet's own 20 + 24 + 16 px) — the map a small mark at its left, the name a size down, the facts on a line under it. NO TEXT IS CUT
   to get there (tools/qa/textsize-page.cjs holds that too): the job's sentence, which has no room, is not drawn in the band at all, and is read whole
   on the large sheet (M, or a click on the mark) */
@media (max-height: 800px) { ${K} .msheet { padding-top: 12px; } ${K} .msheet:has(> .mmap .mplan:not([style*="none"])) { grid-template-columns: 58px minmax(0, 1fr); column-gap: 12px; } ${K} .msheet > .mmap { min-height: 0; margin: 0 0 8px; }
  ${K} .msheet > .mmap .mplan { padding: 1px; } ${K} .mbrief { margin-bottom: 10px; } ${K} .mst { font-size: 20px; line-height: 22px; } ${K} .mcsum, ${K} .mblurb { display: none; } ${K} .mfacts { margin-top: 5px; } }
@media (max-width: 900px) { ${K} .msheet > .mmap { display: none; } ${K} .msheet .mbrief { grid-column: 1 / -1 !important; } }
`;
function styles() { if (document.getElementById?.('kitbrief-css')) return; const s = document.createElement('style'); s.id = 'kitbrief-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }

export interface KitBrief {
  /** the mission on the page (again when another is highlighted): its needs are read and drawn */
  show(m: Mission): void;
  /** what the place asks, as last read for the mission shown (null: not come yet, or no file) */
  readonly needs: PlaceNeeds | null;
  /** there is a map on the step to open (not: the plan did not come, or a window too narrow for it) */
  readonly map: boolean;
  /** the map is large */
  readonly big: boolean;
  setBig(on: boolean): void;
  /** a key on the kit step, before the kit screen has it: true = it was the map's (M; Esc while it is large) */
  key(code: string, repeat: boolean): boolean;
  /** told when the needs of the mission shown have come, and when the map goes large or back */
  onChange: (() => void) | null;
  close(): void;
}
/** the brief, on the page's root (#missions) and its sheet. Null: the switch is off. */
export function mountKitBrief(root: HTMLElement, sheet: HTMLElement): KitBrief | null {
  if (!KITBRIEF.on) return null;
  styles(); root.classList.add('kb');
  const facts = sheet.querySelector?.('.mfacts') as HTMLElement | null, map = sheet.querySelector?.('.mmap') as HTMLElement | null;
  let shown = '', needs: PlaceNeeds | null = null, big = false, shut = false; const cells: HTMLElement[] = [], hadTitle = map?.title ?? '';
  const onStep = () => !!root.classList?.contains('pane-loadout'), mapOn = () => !!map && onStep() && (map as unknown as { offsetParent?: unknown }).offsetParent !== null;
  const cap = document.createElement('div'); cap.className = 'kb-cap'; map?.appendChild?.(cap);   // the name and the job under the map, drawn while it is large
  const draw = (m: Mission) => { for (const c of cells) c.remove?.(); cells.length = 0; if (!facts) return;
    const cell = (label: string, value: string, why: string, before: Element | null) => { const c = document.createElement('div'), l = document.createElement('i'), v = document.createElement('b');
      c.className = 'mfact kb'; c.setAttribute('data-fact', label.toLowerCase().replace(/\s+/g, '-')); if (why) c.title = why; l.textContent = label; v.textContent = value; c.append(l, v); facts.insertBefore(c, before); cells.push(c); };
    if (m.defenders && m.defenders !== '—') cell('Defenders', wordsOf(m.defenders), '', facts.querySelector?.('.mfact[data-fact="defenders"]') ?? null);   // (the list's own cell writes the digits: on this step it is this one that shows)
    for (const [label, value, why] of needCells(needs, m.scenario?.kind === 'rescue')) cell(label, value, why, null); };
  const told = () => { try { api.onChange?.(); } catch (e) { console.error('the kit brief: onChange threw', e); } };
  const onMap = (e: Event) => { if (shut || !root.classList.contains('pane-loadout')) return; e.stopPropagation(); api.setBig(!big); };
  map?.addEventListener?.('click', onMap);
  const api: KitBrief = {
    show(m) { if (shut || m.id === shown) return; shown = m.id; needs = null; api.setBig(false); draw(m);
      { cap.textContent = ''; const t = document.createElement('b'); t.textContent = m.title; cap.append(t, m.blurb || m.place || ''); }
      void placeNeeds(m).then(n => { if (shut || shown !== m.id) return; needs = n; draw(m); told(); }); },
    get needs() { return needs; }, get big() { return big; },
    get map() { return mapOn(); },
    setBig(on) { const to = on && mapOn(), moved = to !== big; big = to; root.classList.toggle('kb-big', big); if (moved) told(); if (map) map.title = !onStep() ? hadTitle : big ? 'M or a click: back' : 'M or a click: the map, large'; },   // (the sheet is the Mission step's too: there it says what it said)
    key(code, repeat) { if (shut || !(big || mapOn())) return false;
      if (code === 'KeyM') { if (!repeat) api.setBig(!big); return true; }
      if (big && (code === 'Escape' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space')) { if (!repeat) api.setBig(false); return true; }   // (large, it is a sheet laid over the step: the keys that leave a card leave it)
      return false; },
    onChange: null,
    close() { shut = true; api.setBig(false); root.classList.remove('kb', 'kb-big'); map?.removeEventListener?.('click', onMap); if (map) map.title = hadTitle; cap.remove?.(); for (const c of cells) c.remove?.(); cells.length = 0; },
  };
  api.setBig(false);
  return api;
}
