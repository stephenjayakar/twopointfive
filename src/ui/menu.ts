// The title screen, the pause card and the debrief: one panel (#menu) in three modes.
// TITLE (mode 'start' while the one starting page is the way in — ui/startpage.ts): the wordmark and the main menu down the left of the screen — PLAY (the
// starting page: every mission, its team and kit, deploy), OPTIONS, CONTROLS (ui/options.ts) — with the floor, and the attract reel, showing through on the
// right. Up from the first tick as the BOOT card (the same screen with a progress line while the shaders compile). Under ?cards / the headless harness the
// start mode is the older card (Missions · Start, the short list, the notes, the controls list, the sandbox row), unchanged.
// PAUSE (Esc): the run's name and Resume / checkpoint / Restart / Options / Run so far / Quit down a narrow card; 'Run so far' opens the debrief of the run as
// it stands beside the menu (ui/debrief.ts). DEBRIEF: the mission's card proper — up on mission complete (Again / Keep playing) and, a beat after Sam drops, as
// the down card (Restart): the rating word and score, the numbers, the badges, the floor map with his path and the pins, the timeline. While any of them is
// open main.ts freezes the simulation and keeps rendering the frozen frame underneath. Plain DOM, styled in index.html (#menu…) with ui/theme.ts's tokens.
import { dumpNow, keptNow, keptWords } from '../replay/dumpui';
import { saveSandbox } from '../game/sandbox';
import { SAVETIMELINE, type SlotInfo } from '../game/savestate';
import { HANDRING } from '../game/handring';
import { TWOGEARS } from '../game/player';
import { gearText } from '../game/gear';   // (the controls list names the kit: shown in the kit's words as issued)
export { loadSandbox, saveSandbox, SANDBOX_LS } from '../game/sandbox';
import { Engine } from '../engine';
import { Game } from '../game/game';
import { renderDebrief } from './debrief';
import { Quality } from './quality';
import { AudioEngine } from '../audio/audio';
import { Overlay } from './overlay';
import { MISSIONS, closeMissions, missionsBusy, missionsReopenAsked } from './missions';
import { picksBlock, nextPickOf, picksNoteFocus } from './picks';
import { nextLessonOf } from './verdictNext';
import { pickEntry } from '../scene/picks';
import { quitSearch } from '../scene/scenarioList';
import { openList, openStartPage, startPageWanted, startPageFromQuery } from './startpage';
import { menuTheme } from './theme';
import { TABKEY } from './tabkey';
import { SLOTSETUP } from '../game/slotsetup';
import { keyText, keysOf, slotNow, camKey } from '../host/keymap';   // (the player's own keys: the list names them as they are bound)
import { openOptions, closeOptions, optionsOpen, setOptionsDeps, refreshOptions, wallWay } from './options';

const E_ROW: [string, string] = ['E', 'holster or draw the selected item (on a wall, pick what you\'ll draw next)'];
/** …while empty hands are a slot (game/handslot.ts): '0' is its row's cap in the build, shown in the key column as the key it is on (backtick) */
const SLOT_ROW: [string, string] = ['0', 'empty your hands · press a number to draw again'];
/** the action key's row, and it and the whistle's while his own actions are a ring that stays (game/handring.ts) */
const SPACE_ROW: [string, string] = ['Space', 'do the highlighted action (top-left) · hold it and use the wheel or ↑↓ to pick another, then let go · long actions keep going until you move or tap again'];
const RING_ROW: [string, string] = ['Space', 'do the action shown top-left · hold it a moment for a ring of everything you can do here, including the whistle (pick with 1 to 5 or a click) · long actions keep going until you move or tap again'];
const LN_ROW: [string, string] = ['L · N', 'weapon light · night vision'];
const N_ROW: [string, string] = ['N', 'night vision'];
/** the camera's row, and it while its key is the Space bar (host/keymap.ts camKey): that cap is written as it is — in a list of keys 'Space' is the action's
 *  row, wherever that is (`keyCol`) */
const CAM_ROW: [string, string] = ['Ctrl + mouse / wheel', 'orbit the camera / zoom (or pinch)'];
const CAM_SPACE: [string, string] = ['Space + mouse / wheel', CAM_ROW[1]];
const keyCol = (k: string) => k === CAM_SPACE[0] ? k : keyText(k, true);
const Q_ROW: [string, string] = ['Q', 'put your back to the wall beside you, then slide and peek around its end · press Q or Shift, or step away, to let go'];
const KIT_ROW: [string, string] = ['1 2 3 4 5', 'Five-seveN · FN2000 (press 2 again to switch its launcher, RING / 40 mm) · smoke · stun · frag'];
const ZR_ROW: [string, string] = ['Z · R', 'FN2000 semi / auto · reload'];
const LNV_ROW: [string, string] = ['L · N · V', 'weapon light · night vision · whistle (the nearest guard will come to look)'];
/** the same three rows with the gun's setup on (game/slotsetup.ts): a gun's key again is its setup, and the selector and the light are rows of it (a key
 *  the player gave either one back keeps its old row) */
const KIT_SET: [string, string] = ['1 2 3 4 5', 'Five-seveN · FN2000 · smoke · stun · frag · press a gun\'s key again for its setup (key 1 semi / auto · key 2 its launcher · key 3 its light)'];
const R_ROW: [string, string] = ['R', 'reload'];
const NV_ROW: [string, string] = ['N · V', 'night vision · whistle (the nearest guard will come to look)'];
const MOVE_ROW: [string, string] = ['W A S D', 'move · Shift sprint · C crouch · wheel = walking pace (slower is quieter)'];
/** …with two gears (game/player.ts TWOGEARS): the wheel is nobody's pace and the crouch is the sneak */
const MOVE_GEARS: [string, string] = ['W A S D', 'move · Shift sprint · C crouch (slower and quiet)'];
export const CONTROLS: [string, string][] = [   // (the options screen draws its own grouped copy, ui/options.ts KEYS: a key that changes is changed in both) ONE short line per key (playtest 08-09: 'the start page is WAY too wordy')
  MOVE_ROW,
  ['Mouse', 'aim, and the ring snaps to an enemy near the cursor or a light under it'],
  ['LMB', 'fire what\'s in your hand · throw a canister · take an enemy down silently from behind with empty hands'],
  ['RMB', 'with the pistol, OCP the light under the ring · with the FN2000, fire its launcher (hold to see the arc first)'],
  SPACE_ROW,
  E_ROW,
  Q_ROW,
  KIT_ROW,
  ZR_ROW,
  LNV_ROW,
  ['X · B · T · F', 'with a team — X (or middle click) for orders · B for the usual order · T for who gets it · F to start the drill, say go or blow a charge'],
  ['H · G', 'with the orders up — the big tool on a door, smoke on the floor · frag and clear'],
  ['F5', 'save'],
  ['Enter', 'go back to the last checkpoint when you\'re down · press Shift+Enter to restart any time'],
  CAM_ROW,
  ['Esc · `', 'pause & settings · the debugger (every knob)'],
];
/** the list as the board is (ui/options.ts wallWay): the wall hold's row with no key is the row of walking into one; with no key and no walk-in, no row */
const WALL_ROW: [string, string] = ['Wall', 'walk into one to put your back to it, then slide and peek around its end · step away or press Shift to let go'];
const controlRows = (): [string, string][] => CONTROLS.flatMap(r => {
  if (TWOGEARS.on && r === MOVE_ROW) return [MOVE_GEARS];
  if (HANDRING.on && r === SPACE_ROW) return [RING_ROW]; if (r === CAM_ROW) return [camKey() ? CAM_SPACE : r];
  if (SLOTSETUP.on && r === KIT_ROW) return [KIT_SET]; if (SLOTSETUP.on && r === ZR_ROW && !keysOf('KeyZ').length) return [R_ROW];
  if (r === LNV_ROW) { const l = !(SLOTSETUP.on && !keysOf('KeyL').length), v = !(HANDRING.on && !keysOf('KeyV').length); return [l && v ? r : l ? LN_ROW : v ? NV_ROW : N_ROW]; }   // (the light is a row of the gun's setup, the whistle a wedge of his ring: a key given back to either keeps its place here)
  if (r === E_ROW) return slotNow() ? (keysOf('KeyE').length ? [SLOT_ROW, r] : [SLOT_ROW]) : [r]; if (r !== Q_ROW) return [r]; const w = wallWay(); return w === 'key' ? [r] : w === 'walk' ? [WALL_ROW] : []; });

const TAGLINE = 'a ray-traced stealth sandbox where every light, shadow and wisp of smoke is live';
/** the title screen's line under the wordmark */
const TITLE_LINE = 'Squad tactics and stealth. Every light, shadow and wisp of smoke is live.';
const TITLE_FOOT = 'W S choose · Enter select · Esc back · ` the debugger';
const START_NOTES = [
  'MISSIONS lists every scenario and the solo night. START drops you straight into the solo night. Reach the server room, pull the drive from the marked rack and leave through the fire exit.'];
/** the note under the buttons when the card opens on the short list (ui/picks.ts): the rows above are the way in, the two buttons are everything else */
/** the card's one button to the one starting page (ui/startpage.ts) */
const PLAY = 'Play ›';
const PICKS_NOTES = ['MISSIONS has every mission, and you pick your own team, hour and weather. START puts you in the office at night, alone.'];

/** THE BOOT CARD: the start card's own layout — title, the three buttons DISABLED, the notes and the controls — up from the first tick of main.ts while the GPU process compiles
 *  the renderer's kernels in the background (engine.ts init), with a one-line status ('compiling shaders 40 / 97 …') main.ts rewrites as they resolve. Menu.open('start')
 *  re-renders the real card over it the moment everything is ready (the buttons come alive in place); `off()` clears it for boots that open no card (?solo, a scenario).
 *  MISSIONS is live from the first tick: the list (ui/missions.ts) is its own layer and a pick is a page load, so it needs nothing of this page's renderer. */
export function bootCard(): { status(text: string): void; off(): void } {
  menuTheme();
  const root = document.getElementById('menu')!;
  root.innerHTML = '';
  const card = el('div', 'card'); root.appendChild(card);
  const one = startPageWanted();   // THE ONE STARTING PAGE (ui/startpage.ts) is this build's way in: this is the TITLE SCREEN, PLAY its one button to that page
  const status = el('div', 'note bootstatus'), words = el('span'), fill = el('i'); words.textContent = 'starting the GPU…';
  { const bar = el('i', 'bbar'); bar.appendChild(fill); status.appendChild(words); status.appendChild(bar); }
  if (one) {
    root.classList.add('title'); root.classList.remove('paused');
    card.appendChild(titleHead());
    { const ta = titleActions(); card.appendChild(ta.actions); setTimeout(() => { if (!missionsBusy() && !optionsOpen() && (document.activeElement ?? document.body) === document.body) ta.play.focus(); }, 0); }   // (PLAY, OPTIONS and CONTROLS are live from the first tick: a deploy is a page load, and the controls need nothing of the renderer; Play has the focus from that tick too, as on the live title, so Enter is Play while the kernels still compile)
    card.appendChild(el('div', 'tfill'));
    card.appendChild(status);
    const foot = el('div', 'foot'); foot.textContent = keyText(TITLE_FOOT); card.appendChild(foot);
  } else {
    root.classList.remove('title'); root.classList.remove('paused');
    const head = el('div', 'head'); head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${TAGLINE}</div>`; card.appendChild(head);
    const picks = picksBlock(); if (picks) { card.appendChild(status); card.appendChild(picks.root); }   // THE SHORT LIST (ui/picks.ts): live from the first tick like MISSIONS — a pick is a page load too (the status line over the rows: they fill the card, and the line that says why Start is still grey has to be on screen)
    const actions = el('div', 'actions');
    actions.appendChild(button('Missions', () => { openList(); }, picks ? '' : 'primary'));
    { const b = button('Start', () => { /* not yet */ }) as HTMLButtonElement; b.disabled = true; actions.appendChild(b); }
    card.appendChild(actions);
    if (!picks) card.appendChild(status);
    for (const t of picks ? PICKS_NOTES : START_NOTES) { const n = el('div', 'note'); n.textContent = t; card.appendChild(n); }
    const body = el('div', 'body'); card.appendChild(body);
    const list = el('div', 'controls');
    for (const [k, v] of controlRows()) { if (k === 'F5' && !SAVETIMELINE.on) continue; const row = el('div', 'row'); const kk = el('div', 'k'); kk.textContent = keyCol(k); const vv = el('div', 'v'); vv.textContent = keyText(gearText(v)); row.append(kk, vv); list.appendChild(row); }
    body.appendChild(list);
    const foot = el('div', 'foot'); foot.textContent = keyText('Esc pauses · ` opens the debugger (every knob)'); card.appendChild(foot);
  }
  root.classList.add('on');
  // A FRESH VISIT OPENS ON THE TITLE. The starting page is up by itself only where the address or the last page asked for it: `?loadout=<id>` names a mission,
  // or a mission was quit by a page load ('Quit to scenarios' lands on the missions, not the title). Never under ?paused (the automation boot: scripts drive
  // the card; PLAY still opens the page)
  if (one) { const s = typeof location !== 'undefined' ? location.search ?? '' : ''; if (!startPageFromQuery(s) && !new URLSearchParams(s).has('paused') && missionsReopenAsked()) openStartPage(); }
  return { status(text: string) { words.textContent = text; const m = /(\d+) \/ (\d+)/.exec(text); if (fill.style) fill.style.width = m && +m[2] > 0 ? `${Math.min(100, Math.round(100 * +m[1] / +m[2]))}%` : /ready|setting up/.test(text) ? '100%' : '0'; },
    off() { root.classList.remove('on'); root.classList.remove('title'); root.innerHTML = ''; closeMissions(); closeOptions(); } };   // (no card = a run is live underneath: the list goes with it)
}

/** the title screen's head and its main menu (the boot card and the real start card build the same screen) */
function titleHead(): HTMLElement { const head = el('div', 'head'); head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${TITLE_LINE}</div>`; return head; }
/** EXTRAS (the title screen's fourth entry: the maintainer, 10-11 — "the showcase and editor and whatever other tools we have … should all be linked in the main menu"): the
 *  tool pages, each a LINK — a tool is its own page (the `.html` names: the dev server forwards them to its routes, the build has them as files; the one-file build has no tool
 *  pages and lists none: `onePage`); a row whose link is a key of this page (`?bench`) keeps the visitor's other flags (`showHref`) and, ON THE LIVE TITLE, STARTS IN PLACE
 *  (Menu.title hands `TitleShows`) — no page load, the click is the gesture the sound needs; the link is what such a row is while the page still boots, or in a new tab.
 *  (The two showcases that were this list's first section — the night and the day — were removed.) What is listed and what is not, and why: rebuild/menus/tools.md. */
/** the Tools row that hands over every kept replay (replay/keeper.ts keeps each run in this browser as it is played; replay/dumpui.ts packs them): it acts IN
 *  PLACE on any title — the boot card's too, it needs nothing of the game — and a small line under its name says what is kept and what a press did (no line while
 *  nothing is kept; its sentence is the row's tooltip, like every row's); its link is the viewer's list of them */
const DUMP_LINE = 'Get every run you\'ve played as one file.';
function dumpRow(a: HTMLAnchorElement): void {
  // (show, not tell: the row is its name like every other; a line under it exists only while it has a FACT to show — what is kept, what a press did)
  let small = a.querySelector('small') as HTMLElement | null;
  const say = (t: string) => { if (!small) { if (!t) return; small = document.createElement('small'); a.appendChild(small); } small.textContent = t; };
  void keptNow().then(S => { if (S.visits) say(keptWords(S)); }).catch(() => {});
  a.addEventListener('click', e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); void dumpNow({}, say); });
}
export const EXTRAS: { head: string; rows: { id: string; label: string; line: string; href: string }[] }[] = [
  { head: 'Tools', rows: [
    { id: 'editor', label: 'Level editor', line: 'Build and change levels, then play from where you stand.', href: 'workbench.html#mode=level' },
    { id: 'chars', label: 'Characters and effects', line: 'See the cast, the kit in their hands, muzzle flash, smoke and tracers on a studio stage.', href: 'workbench.html#mode=chars' },
    { id: 'replay', label: 'Replays', line: 'Scrub through the last minutes of a run on a map. Press F7 to keep one while you play.', href: 'replay.html' },
    { id: 'sounds', label: 'Sounds', line: 'Hear every sound in the game on one page.', href: 'sounds.html' },
    { id: 'bench', label: 'Benchmark', line: 'It plays three floors by itself, then times each quality level on this machine. You get text to copy and a file.', href: '?bench' },
    { id: 'dump', label: 'Hand over replays', line: DUMP_LINE, href: 'replay.html#kept' } ] },
];
/** the link of a row that is a key of this page (`?bench`): its key, then the visitor's own flags as every mission link keeps them (`?mute&quality=low` rides along; another mission's keys do not) */
function showHref(href: string): string { if (href[0] !== '?') return href; const rest = quitSearch(typeof location !== 'undefined' ? location.search ?? '' : ''); return href + (rest ? '&' + rest.slice(1) : ''); }
/** the one-file build (tools/build-one.ts marks its page): index.html is all there is, so the tool pages are not listed */
const onePage = () => typeof document !== 'undefined' && !!document.querySelector?.('meta[name="tps-one-page"]');
/** a row started in place, by its id: true = started (or refused aloud), false = not from here — the row's link loads it */
type TitleShows = Partial<Record<string, () => boolean>>;
/** which page of the title's menu is up: the main one, or EXTRAS (kept through the boot card handing over to the real title) */
let titleExtras = false;
let titleShownAt = 0;   // (when the live title was last drawn: an Esc that ENDED a running programme drew it, and that same press must not also step its Extras list back)
let titleAgain: (() => void) | null = null;   // (the live title's own 'Options closed' — the boot card's buttons, made before there was a Menu, reach it through here)
function titleActions(onClose?: () => void, shows?: TitleShows): { actions: HTMLElement; play: HTMLElement } {
  const onOptionsClose = onClose ?? (() => titleAgain?.());
  const actions = el('div', 'actions'); let play!: HTMLElement;
  const fill = (focus?: 'first' | 'extras') => {
    actions.innerHTML = ''; actions.classList.toggle('extras', titleExtras);
    if (titleExtras) {
      const one = onePage();
      for (const sec of EXTRAS) {
        const rows = sec.rows.filter(r => !one || r.href[0] === '?' || r.id === 'dump'); if (!rows.length) continue;
        const h = el('div', 'xhead'); h.textContent = sec.head; actions.appendChild(h);
        for (const r of rows) {
          const a = el('a', 'btn xrow') as HTMLAnchorElement; a.href = showHref(r.href); a.dataset.extra = r.id; a.innerHTML = `<b>${esc(r.label)}</b>`; a.title = r.line;   // (show, not tell: a row is its name; its sentence is the tooltip)
          actions.appendChild(a);
          if (r.id === 'dump') { if (one) a.href = '#'; dumpRow(a); continue; }
          const go = shows?.[r.id]; if (go) a.addEventListener('click', e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; if (go()) e.preventDefault(); });   // (a plain click or Enter; a new-tab click stays the link's)
        }
      }
      const back = button('‹ Main menu', () => { titleExtras = false; fill('extras'); }, 'xback'); actions.appendChild(back);
      play = actions.querySelector('.xrow') as HTMLElement;
      if (focus) play.focus();
      return;
    }
    play = button(PLAY, () => { openList({ backLabel: '‹ Main menu' }); }, 'primary');
    actions.appendChild(play);
    actions.appendChild(button('Options', () => openOptions({ onClose: onOptionsClose })));
    actions.appendChild(button('Controls', () => openOptions({ tab: 'controls', onClose: onOptionsClose })));
    const extras = button('Extras', () => { titleExtras = true; fill('first'); }, 'xopen'); actions.appendChild(extras);
    if (focus === 'extras') extras.focus();
  };
  fill();
  return { actions, get play() { return play; } };
}

export interface MenuDeps { engine: Engine; game: Game; quality: Quality; audio: AudioEngine; overlay: Overlay; stopTour?: () => void; onStart: () => void; focusGame?: () => void;
  /** the benchmark (ui/bench.ts): Extras ▸ Benchmark on the live title begins it (a page load of its first scene: ui/benchrun.ts) */
  startBench?: () => void;
  /** checkpoints (game/savestate.ts): load the stored slot `key` into the game — main.ts stops any show first and snaps the camera after; returns why not, or null */
  loadCheckpoint?: (key: string) => string | null;
  /** F5 came on the pause card and the save will be written as play goes on (main.ts: the press is kept, the world is held) — the strip shows its tile to come */
  saveDue?: () => boolean;
  /** the scenario that is up right now (game/scenarioRun.ts — null: the plain night) in the picker's words, and the way out of it back to the start card's
   *  picker (main.ts: the scenario stopped, its flags off the URL). Absent: no scenario rows on the pause / down cards. */
  scenario?: { current: () => { title: string; team: string; saves?: boolean; entry?: { id: string } | null } | null; quit: () => void; refused?: () => string | null };
  /** the run just played, opened in the replay viewer in this window (ui/replaykey.ts openViewer, Shift+F7's work) — asked each time a card is drawn, since the
   *  replay key is made after the menu; null or absent: no viewer page or no buffer, and the end card has no Replay button */
  replay?: () => (() => void) | null; }

export class Menu {
  private root: HTMLElement; private body!: HTMLElement; private run = false;   // (run: the pause card's 'Run so far' is open beside its menu)
  mode: 'start' | 'pause' | 'debrief' | 'closed' = 'closed';
  constructor(private d: MenuDeps) {
    menuTheme();
    this.root = document.getElementById('menu')!;
    this.root.addEventListener('mousedown', e => e.stopPropagation());      // clicks in the menu never reach the game canvas
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    setOptionsDeps({ engine: d.engine, game: d.game, quality: d.quality, audio: d.audio, overlay: d.overlay });   // (ui/options.ts: the boot is over — its Graphics, Audio and Game tabs come alive, and what this machine kept is applied)
  }
  /** main.ts hands the scenario hooks over once the scenario is started (after this card is constructed) */
  setScenario(s: MenuDeps['scenario']) { this.d.scenario = s; }
  get isOpen() { return this.mode !== 'closed'; }
  /** the start mode is the TITLE SCREEN (the one starting page is the way in), not the older card */
  private get titled() { return this.mode === 'start' && startPageWanted(); }
  /** Auto's calibration has just settled (main.ts wires Quality.onCalibrated): the options screen's live line follows, if it is the one up */
  refreshQualityNote() { refreshOptions(); }

  open(mode: 'start' | 'pause' | 'debrief') { if (mode === 'debrief') closeOptions(); this.mode = mode; MISSIONS.startSolo = mode === 'start' ? () => this.close() : null; this.render(); this.root.classList.add('on'); }   // (the mission list's solo night off the start card IS Start)
  close() { closeOptions(); MISSIONS.startSolo = null; closeMissions(); if (this.mode === 'start') this.d.onStart(); this.mode = 'closed'; this.run = false; this.root.classList.remove('on'); this.d.focusGame?.(); }   // keys go to the game, not the (now hidden) button that had focus
  /** the pause card with 'Run so far' open beside it (Tab, while that is what Tab is trying out: ui/tabkey.ts) */
  openRun() { this.run = true; this.open('pause'); }
  private stripAt: HTMLElement | null = null;   // (the pause card's node the strip of saves sits before)
  /** F5 came on the pause card (main.ts `saveDue`): the strip alone is laid again, with the tile to come — the card and where the keys had walked on it stay */
  saveAsked() {
    if (this.mode !== 'pause') return; const strip = this.saveStrip(), old = this.root.querySelector('.saves'); if (!strip) return;
    const held = !!old && old.contains(document.activeElement);
    if (old) old.replaceWith(strip); else if (this.stripAt?.parentNode) this.stripAt.parentNode.insertBefore(strip, this.stripAt); else return;
    if (held) (strip.querySelector('.tile[tabindex="0"]') as HTMLElement | null)?.focus();
  }
  get runOpen() { return this.mode === 'pause' && this.run; }
  toggle() { if (this.titled) return; if (this.isOpen) this.close(); else this.open('pause'); }   // (Esc: on the title screen there is nothing to back out of — the solo night is a row of the starting page)

  private render() {
    picksNoteFocus();   // (ui/picks.ts: a short-list row the keys had walked to on the card this one replaces keeps the focus)
    const r = this.root; r.innerHTML = '';
    const titled = this.titled, pause = this.mode === 'pause';
    if (titled) r.classList.add('title'); else r.classList.remove('title');
    if (pause) r.classList.add('paused'); else r.classList.remove('paused');
    const card = el('div', 'card'); r.appendChild(card);
    if (this.mode === 'debrief') { card.classList.add('wide'); this.debrief(card); return; }
    if (titled) { this.title(card); return; }
    if (pause) { this.pause(card); return; }
    // ---- the older start card (?cards, the headless harness): Missions · Start, the short list, the notes, the sandbox row, the controls
    const head = el('div', 'head');
    head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${TAGLINE}</div>`;
    card.appendChild(head);
    const picks = picksBlock(); if (picks) card.appendChild(picks.root);   // THE SHORT LIST (ui/picks.ts): what the start card opens on — the missions worth playing first, in order, a click each; null under ?nopicks and on a page that is booting a mission
    const actions = el('div', 'actions');
    const missions = button('Missions', () => { openList(); }, picks ? '' : 'primary');   // the level select (ui/missions.ts): every scenario and the solo night; a pick is a page load
    const primary = picks?.focus ?? missions;   // (the rows never take the focus by themselves: only the one the keys had already walked to)
    actions.appendChild(missions);
    actions.appendChild(button('Start', () => this.close()));
    card.appendChild(actions);
    this.refused(card);
    for (const t of picks ? PICKS_NOTES : START_NOTES) { const n = el('div', 'note'); n.textContent = t; card.appendChild(n); }
    this.sandboxRow(card);   // (no loadout choice: the FN2000 is always in the kit — playtest 08-09)
    this.body = el('div', 'body'); card.appendChild(this.body);
    this.controls();
    const foot = el('div', 'foot'); foot.textContent = keyText('Esc pauses · ` opens the debugger (every knob)'); card.appendChild(foot);
    setTimeout(() => { if (!missionsBusy() && !optionsOpen()) primary.focus(); }, 0);   // (the mission list opened off the boot card is still up over this card: the focus stays its own)
  }

  /** THE TITLE SCREEN: the wordmark, PLAY · OPTIONS · CONTROLS, and — only when one is on — the cheats, named, a click from where they are switched */
  private title(card: HTMLElement) {
    const g = this.d.game, cheats = () => [g.godMode ? 'god mode' : '', !g.aiEnabled ? 'enemies don\'t think' : '', g.infiniteAmmo ? 'unlimited ammo' : ''].filter(Boolean).join(' · ');
    const was = cheats(), again = () => { if (this.mode === 'start' && cheats() !== was) this.render(); };   // (the chip follows what Options ▸ Game did)
    card.appendChild(titleHead());
    this.refused(card);
    titleAgain = again; titleShownAt = typeof performance !== 'undefined' ? performance.now() : 0;
    const ta = titleActions(again, {
      bench: () => { const sb = this.d.startBench; if (!sb) return false; sb(); return true; } }), actions = ta.actions;
    card.appendChild(actions);
    card.appendChild(el('div', 'tfill'));
    if (was) { const c = button(`Cheats on: ${was}`, () => openOptions({ tab: 'game', onClose: again })); c.className = 'cheats'; c.title = 'switch them in Options ▸ Game'; card.appendChild(c); }
    const foot = el('div', 'foot'); foot.textContent = keyText(TITLE_FOOT); card.appendChild(foot);
    setTimeout(() => { if (!missionsBusy() && !optionsOpen()) ta.play.focus(); }, 0);   // (the starting page opened off the boot card is still up over this screen: the focus stays its own)
  }

  /** THE PAUSE CARD: what is paused, then the menu — Resume first; 'Run so far' opens the debrief of the run as it stands beside it */
  private pause(card: HTMLElement) {
    const scn = this.d.scenario?.current() ?? null;   // a scenario is up under the pause card: it is named, with its team, and can be quit to the missions
    const side = el('div', 'side'); card.appendChild(side);
    const head = el('div', 'head');
    head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${scn ? `paused · ${esc(scn.title)} · ${esc(scn.team)}` : 'paused'}</div>`;
    side.appendChild(head);
    const actions = el('div', 'actions'), gap = () => actions.appendChild(el('div', 'gap'));
    const resume = button('Resume', () => this.close(), 'primary');
    actions.appendChild(resume);
    { const ck = this.checkpointButton(); if (ck) actions.appendChild(ck); const strip = this.saveStrip(); if (strip) actions.appendChild(strip); }   // 'Restart from checkpoint (40 s ago)' when one is stored (game/savestate.ts) — under Resume here; on the down card it is THE default
    actions.appendChild(this.stripAt = button(scn ? 'Restart scenario' : 'Restart encounter', () => { this.d.stopTour?.(); this.d.game.restart(); this.close(); }));   // (a running tour or level-script program ends first: its beat must not keep puppeting the fresh encounter; under a scenario the restart stages it again)
    gap();
    actions.appendChild(button('Options', () => openOptions()));
    actions.appendChild(button('Run so far', () => { this.run = !this.run; this.render(); }, this.run ? 'on' : ''));
    gap();
    if (scn) actions.appendChild(this.quitButton()); else actions.appendChild(button('Missions', () => { openList({ backLabel: '‹ Back' }); }));   // the level select (ui/missions.ts): every scenario and the solo night; a pick is a page load
    { const nx = this.nextPickButton(); if (nx) actions.appendChild(nx); }   // (a run a pick started: the next one on the short list, one press away)
    side.appendChild(actions);
    const foot = el('div', 'foot'); foot.textContent = 'Esc resumes · W S choose'; side.appendChild(foot);
    this.body = el('div', 'body');
    if (this.run) { card.classList.add('wide'); card.appendChild(this.body); renderDebrief(this.body, this.d.game); }   // the debrief of the run as it stands (nothing to press but 'copy summary': Resume / Restart are the card's own)
    setTimeout(() => { if (!missionsBusy() && !optionsOpen()) resume.focus(); }, 0);
  }
  /** the URL named a scenario and its start() said no: the reason, where the player is looking */
  private refused(card: HTMLElement) { const why = this.d.scenario?.refused?.() ?? null; if (why) { const r = el('div', 'refused'); r.textContent = why; card.appendChild(r); } }

  /** The debrief card (main.ts opens it whenever game.mission.debrief is raised): on MISSION COMPLETE — Again = a fresh encounter (and mission), Keep playing / Esc =
   *  back to the sandbox with the mission left done — and, a beat after Sam goes DOWN, as the down card — Restart (or Esc back to the floor, where Enter restarts
   *  as it always has). The contents are ui/debrief.ts's: rating + score, the numbers, the badges, the map, the timeline. */
  private debrief(card: HTMLElement) {
    const g = this.d.game; const V = g.verdict?.result ?? null; const down = V ? !V.won || g.player.down : g.mission.stage !== 'done';   // (won or lost is the run's verdict where there is one — a squad's mission never reaches the stealth game's 'done' — game/verdict.ts)
    const shown = performance.now();
    const restart = () => { if (performance.now() - shown < 500) return; this.d.stopTour?.(); g.restart(); this.close(); };   // (armed after half a second: the card appears mid-stride, often a Space-tap after the fire door — that tap must not restart the run unseen)
    const info = down ? this.checkpointInfo() : null; const mine = !!info && g.saves.isThisRun(info);   // DOWN with a checkpoint of THIS run stored: 'Restart from checkpoint (N s ago)' is the default (focused, Enter — the bare key does the same before the card is up); an earlier run's is offered but never the default
    const cur = this.d.scenario?.current() ?? null, scn = !!cur;   // down under a scenario: the restart stages it again, and the picker is one press away (no checkpoint button: none is written with a team on the floor, and a solo run's is refused there — but a scenario that SAVES, a quiet mission alone, offers its own)
    const ck = info ? this.checkpointButton(mine ? 'primary' : '', () => performance.now() - shown >= 500) : null;
    const strip = down ? this.saveStrip(() => performance.now() - shown >= 500) : null;   // (this run's saves laid out in time: any of them is one press away, the default stays the newest sound one)
    const nl = V && V.won && !down && g.verdict.kept?.lesson ? nextLessonOf(cur?.entry?.id) : null;   // a Training lesson done (the row that is UP, as the books read it — main.ts vBooks): the next lesson leads the card (ui/verdictNext.ts; none under ?noverdict)
    const lead = nl ? button(`Next: ${nl.title} ›`, () => { if (performance.now() - shown < 500) return; this.d.stopTour?.(); nl.start(); }, 'primary next') : null;
    const primary = button(down ? (scn ? 'Restart scenario' : 'Restart encounter') : 'Again', restart, (ck && mine) || lead ? '' : 'primary');
    const actions: HTMLElement[] = down ? (ck ? (mine ? [ck, primary] : [primary, ck]).concat([button('Back to the floor', () => this.close())]) : [primary, button('Back to the floor', () => this.close())]) : [primary, button('Keep playing', () => this.close())];
    if (strip) actions.push(strip);
    if (lead && nl) { lead.dataset.href = nl.href; actions.unshift(lead); }
    if (scn) actions.push(this.quitButton(() => performance.now() - shown >= 500));
    { const nx = this.nextPickButton(() => performance.now() - shown >= 500); if (nx) actions.push(nx); }
    { const view = this.d.replay?.() ?? null; if (view) { const b = button('Replay', () => { if (performance.now() - shown >= 500) view(); }, 'replay'); b.title = 'watch this run again in the game'; actions.push(b); } }   // (the maintainer: "would be nice to be able to open the replay immediately here")
    this.body = el('div', 'body'); card.appendChild(this.body);
    renderDebrief(this.body, g, actions);
    const foot = el('div', 'foot'); foot.textContent = keyText(down ? (ck && mine ? 'Press Enter to go back to the checkpoint · press Shift+Enter to restart the mission · press Esc to close this' : 'Press Esc to close this · press Enter or Shift+Enter to restart') : 'Press Esc to keep playing · press Shift+Enter to restart any time · Esc ▸ Run so far shows this for a run in progress'); card.appendChild(foot);
    setTimeout(() => (lead ?? (ck && mine ? ck : primary)).focus(), 0);
  }
  /** 'Restart from checkpoint (40 s ago)' for the newest stored checkpoint (this run's for choice), or null when there is none / no loader is wired: loads it
   *  through main.ts (any show stopped, the camera snapped) and closes the card; a refusal goes on the message line and re-renders the card. `armed`: the down
   *  card's half-second guard against the tap that raised it. */
  private checkpointButton(cls = '', armed: () => boolean = () => true): HTMLElement | null {
    const g = this.d.game, load = this.d.loadCheckpoint; if (!load) return null;
    const info = this.checkpointInfo(); if (!info) return null;
    return button(`Restart from checkpoint (${g.saves.ageWords(g, info)})`, () => { if (!armed()) return; const why = load(info.key); if (why) { g.msg(`checkpoint: ${why}`); this.render(); return; } this.close(); }, cls);
  }
  /** 'Quit to scenarios' (the pause card and the down card while a scenario is up): the scenario stopped and the start card's picker back (main.ts) */
  private quitButton(armed: () => boolean = () => true): HTMLElement { return button('Quit to scenarios', () => { if (!armed()) return; this.d.stopTour?.(); this.d.scenario?.quit(); }, 'quit'); }
  /** 'Next: <title>' while the page is a run the short list started (scene/picks.ts pickOfQuery) and a row follows it: that row's own page load. Null otherwise,
   *  and always under ?nopicks. */
  private nextPickButton(armed: () => boolean = () => true): HTMLElement | null {
    const nx = nextPickOf(); if (!nx) return null;
    if (!!pickEntry(nx.from) !== !!this.d.scenario?.current()) return null;   // (the URL is a pick's, but what is up is not it: its scenario was refused at boot and the plain night is being played — or a scenario is up on the solo pick's page)
    return button(`Next: ${nx.title} ›`, () => { if (!armed()) return; this.d.stopTour?.(); nx.start(); }, 'next');
  }
  /** the slot the cards offer: this run's newest at or before now on the mission clock, else an earlier run's newest (null: none / no loader) */
  private checkpointInfo() {
    const g = this.d.game; if (!this.d.loadCheckpoint) return null;
    const scn = this.d.scenario?.current() ?? null, n = g.saves.offer(g, g.mission.stats.elapsed);
    if (scn && !scn.saves) return SAVETIMELINE.on && n && g.saves.isThisRun(n) ? n : null;   // (a scenario with a team: no file is written there and a solo run's is refused — but under SAVETIMELINE this run's own saves, kept in memory, are offered)
    return n;
  }   // (savestate.ts offer: an earlier run's slot only if this game would load it)
  /** THE STRIP (savestate.ts SAVETIMELINE): this run's saves in the order they were made, each a tile — its picture, how long ago, a mark on the ones made by
   *  hand, a regretted autosave dimmed. A click, or Enter on the tile the arrows (A D too) have walked to, goes back to it. Null with the switch off, no loader,
   *  or fewer than two saves (one save is the button above it) unless one is asked for on this card. */
  private saveStrip(armed: () => boolean = () => true): HTMLElement | null {
    const g = this.d.game, load = this.d.loadCheckpoint; if (!SAVETIMELINE.on || !load) return null;
    const due = this.mode === 'pause' && !!this.d.saveDue?.();   // (a save asked for on this card: its tile stands where the save will, empty until play goes on and writes it)
    const line = g.saves.timeline(); if (line.length < 2 && !due) return null;
    const now = g.mission.stats.elapsed, offered = this.checkpointInfo();
    const strip = el('div', 'saves'); strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'saves of this run');
    const tiles = line.map(info => {
      const t = el('button', 'tile' + (info.slot === 'manual' ? ' hand' : '') + (info.regret ? ' regret' : '') + (info.missionT > now + 0.5 ? ' ahead' : '')) as HTMLButtonElement; t.type = 'button';
      const pic = g.saves.pictureOf(info); if (pic) t.style.backgroundImage = `url("${pic}")`;
      const age = el('span', 'age'); age.textContent = tileAge(now - info.missionT); t.appendChild(age);
      if (info.slot === 'manual') t.appendChild(el('i'));
      t.title = info.label || (info.slot === 'manual' ? 'by hand' : 'autosave'); t.setAttribute('aria-label', `${info.slot === 'manual' ? 'saved by hand' : 'autosave'}, ${g.saves.ageWords(g, info)}`);
      t.tabIndex = -1;
      t.onclick = () => { if (!armed()) return; const why = load(info.key); if (why) { g.msg(`checkpoint: ${why}`); this.render(); return; } this.close(); };
      strip.appendChild(t); return t;
    });
    if (due) { const t = el('div', 'tile hand due'); t.appendChild(el('i')); t.setAttribute('aria-label', 'a save by hand, written as play goes on'); strip.insertBefore(t, tiles[line.findIndex(x => x.missionT > now + 0.5)] ?? null); }   // (before the saves a load has left ahead of this moment)
    if (!tiles.length) return strip;
    let cur = Math.max(0, offered ? line.findIndex(x => x.key === offered.key) : line.length - 1); tiles[cur].tabIndex = 0;   // (one stop for W S and Tab: the tile the button above would load)
    strip.addEventListener('keydown', e => {
      const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0; if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
      tiles[cur].tabIndex = -1; cur = Math.max(0, Math.min(tiles.length - 1, cur + d)); tiles[cur].tabIndex = 0; tiles[cur].focus(); e.preventDefault(); e.stopPropagation();
    });
    return strip;
  }

  private controls() {
    const list = el('div', 'controls');
    for (const [k, v] of controlRows()) { if (k === 'F5' && !SAVETIMELINE.on) continue; const row = el('div', 'row'); const kk = el('div', 'k'); kk.textContent = keyCol(k); const vv = el('div', 'v'); vv.textContent = keyText(gearText(v)); row.append(kk, vv); list.appendChild(row); }
    this.body.appendChild(list);
  }

  /** the START card's sandbox row (the maintainer's ask, 08-12): god mode · guards don't think · unlimited ammo (magazines, canisters, rings) — set before the first frame,
   *  kept per machine (`SANDBOX_LS`), the same three flags the pause card's Settings ▸ Game and the debugger's Sandbox page flip */
  private sandboxRow(card: HTMLElement) {
    const game = this.d.game; const row = el('div', 'sandbox');
    // A MISSION REFUSED FOR 'NO AI' IS TRIED AGAIN the moment the box is unticked (off a tape of play, 10-13: the kept switch refused a rescue at boot, he
    // unticked it here and pressed Start, and was on a floor with no mission while the card still said 'did not start'): its own link is loaded again, as
    // Deploy would — a start is a page load, and the switch has just been kept. Any other refusal stays said.
    const stuck = !game.aiEnabled && !!this.d.scenario?.refused?.();
    const box = (label: string, key: 'god' | 'noAi' | 'ammo', get: () => boolean, set: (v: boolean) => void, title: string) => { const l = el('label') as HTMLLabelElement; l.title = title; const i = el('input') as HTMLInputElement; i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); saveSandbox(game, key); if (key === 'noAi' && stuck && game.aiEnabled && typeof location !== 'undefined') location.reload(); }; l.appendChild(i); l.appendChild(document.createTextNode(' ' + label)); row.appendChild(l); };
    box('god mode', 'god', () => game.godMode, v => { game.godMode = v; }, 'enemies still see you and shoot you, but hits don\'t hurt');
    box('no AI', 'noAi', () => !game.aiEnabled, v => { game.aiEnabled = !v; }, 'the guards stay where they are, and nobody sees, hears or thinks');
    box('unlimited ammo', 'ammo', () => game.infiniteAmmo, v => { game.infiniteAmmo = v; }, gearText('bottomless magazines (rounds still cycle and reload), smoke and stun canisters, ring airfoils, wall charges'));
    card.appendChild(row);
  }
}

// W S / ↑ ↓ walk the title screen's and the pause card's menu (Enter and Space are the focused button's own). Registered here, at module load, like the other
// screens' keys; it only ever moves the focus, and stands down while a screen is up over the card (#menu is inert then) or the focus is somewhere else.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', e => {
  if (e.code === 'Tab' && (TABKEY.does === 'run' || TABKEY.does === 'keys')) { const m = document.getElementById('menu'); if (m?.classList.contains('on') && m.classList.contains('paused') && !m.hasAttribute('inert')) e.preventDefault(); return; }   // (Tab is the game's key on the pause card then, not the browser's walk over its buttons: main.ts tabKey)
  if (e.code === 'Escape' && titleExtras) { const m = document.getElementById('menu'); if (e.timeStamp >= titleShownAt && m?.classList.contains('on') && m.classList.contains('title') && !m.hasAttribute('inert')) { (m.querySelector('.actions .xback') as HTMLElement | null)?.click(); e.preventDefault(); } return; }   // (Esc on the title's EXTRAS page = back to its main menu; the title itself has nothing to back out of)
  if (e.code === 'Space' && !e.repeat && titleExtras) { const a = document.activeElement as HTMLElement | null; if (a?.classList?.contains('xrow') && document.getElementById('menu')?.contains(a)) { a.click(); e.preventDefault(); } return; }   // (a row of EXTRAS is a link, and Space does not follow a link: here it does, as it presses every other entry of this menu)
  const d = e.code === 'KeyW' || e.code === 'ArrowUp' ? -1 : e.code === 'KeyS' || e.code === 'ArrowDown' ? 1 : 0; if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
  const m = document.getElementById('menu'); if (!m || !m.classList.contains('on') || !(m.classList.contains('title') || m.classList.contains('paused')) || m.hasAttribute('inert')) return;
  const a = document.activeElement as HTMLElement | null; if (a && a !== document.body && !m.contains(a)) return;
  const bs = [...m.querySelectorAll('.actions .btn:not(:disabled), .actions .saves .tile[tabindex="0"]')] as HTMLElement[]; if (!bs.length) return;   // (the strip of saves is one stop: its own arrows walk it)
  const i = a ? bs.indexOf(a) : -1; bs[i < 0 ? (d > 0 ? 0 : bs.length - 1) : (i + d + bs.length) % bs.length].focus(); e.preventDefault();
}, { capture: true });

// ---- tiny DOM helpers (menu-local styling lives in index.html)
function esc(t: string) { return t.replace(/[&<>"]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'); }
/** a save's age on its tile: '40 s', '3 min' — '+40 s' for one AHEAD of the clock (a later save of this run, after going back past it) */
function tileAge(d: number): string { const a = Math.abs(d), w = a < 90 ? `${Math.round(a)} s` : `${Math.round(a / 60)} min`; return d < -0.5 ? `+${w}` : w; }
function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function button(text: string, run: () => void, cls = '') { const b = el('button', 'btn ' + cls) as HTMLButtonElement; b.textContent = text; b.onclick = run; return b; }
