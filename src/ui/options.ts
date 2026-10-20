// THE OPTIONS SCREEN: one full-screen layer with four tabs — GRAPHICS · AUDIO · GAME · CONTROLS — opened from the title screen and from the pause card
// (ui/menu.ts). It is the player's settings page said as a game says it: a row per setting (its name, one wide control, its value), the highlighted row's
// plain-words description at the foot, Back and Reset in the corner. What a row DOES is what the pause card's Settings tab did before this screen existed
// (the maintainer, 08-13: 'make the graphics choices well thought out … art constants are not for the player to edit'): GRAPHICS = the one real decision (a
// quality tier, or Auto) with what it is doing on THIS machine live under it, the render resolution, whether it may drop resolution to hold frame rate,
// brightness, a frame-rate read-out; AUDIO = the four buses; GAME = autosave, the interaction hints and the three sandbox cheats named as cheats;
// CONTROLS = every key, grouped by what the hand is doing. Every renderer trade-off and experiment stays on the debugger (backtick).
// KEYS (no held key, no digit above 5): 1 2 3 4 the tabs · W S / ↑ ↓ the rows · A D / ← → change the row · Enter or Space flips a switch · Esc back.
// WHILE THE PAGE BOOTS there is no engine yet (ui/menu.ts hands the live objects over when its Menu is made — setOptionsDeps): CONTROLS is live from the
// first tick, the other three say what they wait for and fill in place when it arrives.
// KEPT PER MACHINE here: the four volumes and the hints switch (localStorage `twopointsix.options`; a deploy is a page load, and a volume that came back
// loud on every mission was no option). The tier, autosave and the cheats were already kept by their own modules; brightness is the mission's own (its hour
// and weather set the exposure) and is not kept.
// Plain DOM in a layer of its own (#options, over #menu), its rules injected here once. Nothing at module level uses another module's exports.
import { saveSandbox } from '../game/sandbox';
import { gearText } from '../game/gear';
import { menuTheme } from './theme';
import { TABKEY, tabChoices, setTabKey, tabDoes } from './tabkey';
import { BACKKEY } from '../game/backkey';
import { TEXTSIZE, TEXT_EVENT, textStep, setTextStep } from './textsize';
import { VOLUME_DEFAULTS } from '../audio/audio';   // (the mixer's levels on a fresh page: what Reset puts back)
import type { MenuDeps } from './menu';
import type { QualityName } from './quality';

export type OptionsTab = 'graphics' | 'audio' | 'game' | 'controls';
export type OptionsDeps = Pick<MenuDeps, 'engine' | 'game' | 'quality' | 'audio' | 'overlay'>;
const TABS: { id: OptionsTab; label: string }[] = [{ id: 'graphics', label: 'Graphics' }, { id: 'audio', label: 'Audio' }, { id: 'game', label: 'Game' }, { id: 'controls', label: 'Controls' }];
const LS = 'twopointsix.options';

const TIERS: { v: 'auto' | QualityName; label: string; line: string }[] = [
  { v: 'auto',    label: 'Auto',     line: 'Recommended. Measures this GPU for a couple of seconds, picks the tier and resolution that hold a steady frame rate, and keeps trimming as the scene changes. Never picks Ultra.' },
  { v: 'verylow', label: 'Very low', line: 'Integrated graphics: half resolution and one shadow ray per light with more temporal reuse. Grainy in the dark, but it plays.' },
  { v: 'low',     label: 'Low',      line: 'For thin laptops: lower internal resolution, coarser bounce light, no ray-traced reflections. Still fully dynamic light, nothing is baked.' },
  { v: 'medium',  label: 'Medium',   line: 'The same lighting with the bounce light and the beams computed at reduced resolution and fewer shadow rays. Softer contact shadows; most people cannot tell in motion.' },
  { v: 'high',    label: 'High',     line: 'The intended look. Ray-traced light and shadow, traced bounce light, volumetric beams and smoke, reflections in polished floors and glass. The tier the game is tuned on.' },
  { v: 'ultra',   label: 'Ultra',    line: 'The reference picture: every shadow ray, characters shadowed by their real mesh, reflections at full rate. For desktop GPUs with headroom, roughly twice the cost of High.' },
];

/** THE KEYS, grouped by what the hand is doing: [key caps, what it does, the small print]. The flat list other readers take is ui/menu.ts CONTROLS: a key
 *  that changes is changed in both. */
const KEYS: { group: string; rows: [string[], string, string?][] }[] = [
  { group: 'Move', rows: [
    [['W', 'A', 'S', 'D'], 'Move'],
    [['Shift'], 'Sprint'],
    [['C'], 'Crouch'],
    [['Wheel'], 'Walking pace', 'slower is quieter'],
    [['Q'], 'Back to the wall beside you', 'slide along it, look round its end; Q or a step away lets go'],
    [['Ctrl', 'Mouse'], 'Orbit the camera'],
    [['Ctrl', 'Wheel'], 'Zoom'],
  ] },
  { group: 'Hands', rows: [
    [['Space'], 'Do the highlighted action', 'hold to pick another with the wheel, let go to do it'],
    [['V'], 'Whistle', 'the nearest man comes to look'],
    [['N'], 'Night vision'],
  ] },
  { group: 'Weapons', rows: [
    [['Mouse'], 'Aim', 'the ring takes a man near the cursor, or a light under it'],
    [['LMB'], 'Fire, or throw the can in your hand', 'hands empty behind a man: a silent takedown'],
    [['RMB'], 'Pistol: OCP a light. Rifle: its launcher', 'the launcher shows its arc while held and fires on letting go'],
    [['R'], 'Reload'],
    [['Z'], 'Rifle semi / auto'],
    [['L'], 'Weapon light'],
    [['E'], 'Holster or draw'],
  ] },
  { group: 'Kit', rows: [
    [['1'], 'Pistol'],
    [['2'], 'Rifle', '2 again changes what its launcher fires'],
    [['3'], 'Smoke'],
    [['4'], 'Stun'],
    [['5'], 'Frag'],
  ] },
  { group: 'Squad', rows: [
    [['X'], 'Orders, on what the cursor is on', 'or the middle mouse button; then 1 to 5 picks an order'],
    [['B'], 'The usual order for that spot, at once'],
    [['T'], 'Who takes the next order', 'everyone, red, blue or one man'],
    [['F'], 'Go', 'the word for an order that waits on you, and the trigger of a set charge'],
  ] },
  { group: 'Game', rows: [
    [['Esc'], 'Pause'],
    [['Enter'], 'Once down: back to the last checkpoint'],
    [['Shift', 'Enter'], 'Restart the mission'],
    [['F7'], 'Keep a replay of the last five minutes'],
    [['`'], 'The debugger', 'every knob in the build'],
  ] },
];

const CSS = `
#options { position: fixed; inset: 0; z-index: 39; display: none; flex-direction: column; align-items: center; outline: none; background: var(--m-base); color: var(--m-text); font: 13px/1.45 var(--m-font); }
#options.on { display: flex; }
#options .op-in { box-sizing: border-box; width: min(1180px, 100%); height: 100%; display: flex; flex-direction: column; padding: clamp(14px, 4vh / var(--tz, 1), 44px) clamp(16px, 4vw / var(--tz, 1), 48px) 16px; }
#options .op-title { flex: 0 0 auto; font: 700 clamp(34px, 5vw / var(--tz, 1), 56px)/0.9 var(--m-head); letter-spacing: 0.04em; text-transform: uppercase; color: var(--m-bright); }
#options .op-tabs { flex: 0 0 auto; display: flex; gap: 2px; margin-top: clamp(10px, 2.4vh / var(--tz, 1), 22px); border-bottom: 2px solid rgba(var(--m-edge),0.22); }
#options button { font: inherit; cursor: pointer; }
#options .op-tab { position: relative; top: 2px; padding: 11px 22px 9px; font: 600 16px/1 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; border-bottom: 2px solid transparent; }
#options .op-tab i { font: 10px var(--m-mono); font-style: normal; margin-right: 8px; color: var(--m-faint); letter-spacing: 0; vertical-align: 2px; }
#options .op-tab:hover, #options .op-tab:focus { color: var(--m-bright); outline: none; }
#options .op-tab.on { color: var(--m-bright); border-bottom-color: var(--m-accent); background: none; }
#options .op-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 6px 10px 0; }
#options .op-sec { display: flex; align-items: center; gap: 14px; margin: 20px 0 8px; font: 600 12px/1 var(--m-head); letter-spacing: 0.24em; text-transform: uppercase; color: var(--m-dim); }
#options .op-sec::after { content: ''; flex: 1; height: 1px; background: rgba(var(--m-edge),0.22); }
#options .op-row { display: grid; grid-template-columns: minmax(180px, 300px) minmax(0, 1fr) 64px; align-items: center; column-gap: 18px; padding: 5px 10px 5px 12px; border-left: 3px solid transparent; }
#options .op-row.sel { border-left-color: var(--m-accent); background: rgba(var(--m-accent-rgb),0.1); }
#options .op-label { font: 600 15px/1.2 var(--m-head); letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-btn-text); }
#options .op-row.sel .op-label { color: var(--m-bright); }
#options .op-val { text-align: right; font: 13px var(--m-mono); color: var(--m-bright); font-variant-numeric: tabular-nums; }
#options .op-seg { display: flex; gap: 3px; }
#options .op-opt { flex: 1 1 0; min-width: 0; padding: 9px 4px 8px; font: 600 13px/1 var(--m-head); letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; color: var(--m-soft); background: rgba(var(--m-btn-rgb),0.75); border: 1px solid rgba(var(--m-edge),0.18); border-radius: 0; }
#options .op-opt:hover { color: var(--m-bright); border-color: rgba(var(--m-edge),0.6); }
#options .op-opt:focus { outline: none; }
#options .op-opt.on { color: var(--m-on-accent); background: var(--m-accent); border-color: var(--m-accent); }
#options .op-switch { width: 100%; padding: 9px 4px 8px; font: 600 13px/1 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-soft); background: rgba(var(--m-btn-rgb),0.75); border: 1px solid rgba(var(--m-edge),0.18); border-radius: 0; }
#options .op-switch:hover { border-color: rgba(var(--m-edge),0.6); color: var(--m-bright); }
#options .op-switch:focus { outline: none; }
#options .op-switch.on { color: var(--m-bright); background: rgba(var(--m-accent-rgb),0.22); border-color: rgba(var(--m-accent-rgb),0.7); }
#options .op-range { -webkit-appearance: none; appearance: none; width: 100%; height: 32px; margin: 0; cursor: pointer; border: 1px solid rgba(var(--m-edge),0.18); border-radius: 0; outline: none;
  background: linear-gradient(90deg, var(--m-accent) 0, var(--m-accent) var(--p, 50%), rgba(var(--m-btn-rgb),0.75) var(--p, 50%), rgba(var(--m-btn-rgb),0.75) 100%); }
#options .op-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 4px; height: 32px; background: var(--m-bright); border: 0; border-radius: 0; }
#options .op-range::-moz-range-thumb { width: 4px; height: 32px; background: var(--m-bright); border: 0; border-radius: 0; }
#options .op-info { margin: 6px 10px 2px 15px; font: 12px/1.5 var(--m-mono); color: var(--m-dim); }
#options .op-wait { margin: 40px 15px; max-width: 60ch; font-size: 15px; color: var(--m-soft); }
#options .op-wait b { display: block; margin-bottom: 6px; font: 600 20px/1.1 var(--m-head); letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-bright); }
#options .op-keys { columns: 2; column-gap: 44px; }
#options .op-kgroup { break-inside: avoid; padding: 14px 0 6px; }
#options .op-kgroup .op-sec { margin-top: 0; }
#options .op-krow { display: grid; grid-template-columns: 150px minmax(0, 1fr); column-gap: 14px; align-items: baseline; padding: 5px 0 6px; border-bottom: 1px solid rgba(var(--m-edge),0.1); }
#options .op-caps { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
#options kbd { box-sizing: border-box; min-width: 26px; padding: 3px 7px 2px; text-align: center; font: 600 12px/1.3 var(--m-mono); color: var(--m-bright); background: rgba(var(--m-btn-rgb),0.9); border: 1px solid rgba(var(--m-edge),0.45); border-bottom-width: 2px; border-radius: 3px; }
#options .op-caps u { text-decoration: none; color: var(--m-faint); font-size: 11px; }
#options .op-what { font-size: 14px; color: var(--m-btn-text); }
#options .op-what small { display: block; margin-top: 1px; font-size: 12px; color: var(--m-dim); }
#options .op-desc { flex: 0 0 auto; box-sizing: border-box; min-height: 62px; margin-top: 8px; padding: 10px 14px; font-size: 13px; color: var(--m-soft); background: rgba(var(--m-panel2-rgb),0.7); border-left: 3px solid rgba(var(--m-edge),0.3); }
#options .op-desc b { display: block; margin-bottom: 2px; font: 600 12px/1.2 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-bright); }
#options.over-game { background: rgba(var(--m-base-rgb),0.84); }
#options .op-foot { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; margin-top: 12px; }
#options .op-btn { padding: 12px 22px 10px; font: 600 16px/1 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-btn-text); background: rgba(var(--m-edge),0.08); border: 1px solid transparent; border-radius: 0; }
#options .op-btn:hover, #options .op-btn:focus { outline: none; border-color: transparent; color: var(--m-bright); background: rgba(var(--m-edge),0.18); }
#options .op-btn.primary { min-width: 180px; color: var(--m-bright); background: rgba(var(--m-edge),0.12); }   /* (Back is the way out, not the thing to press: the accent is the cursor's and Deploy's) */
#options .op-btn.primary:hover, #options .op-btn.primary:focus { background: rgba(var(--m-edge),0.22); box-shadow: inset 3px 0 0 var(--m-accent); }
#options .op-hint { margin-left: auto; font: 11px var(--m-mono); color: var(--m-faint); letter-spacing: 0.06em; text-align: right; }
@media (max-width: 760px) { #options .op-keys { columns: 1; } #options .op-row { grid-template-columns: minmax(0, 1fr); row-gap: 4px; } #options .op-val { text-align: left; } #options .op-tab { padding: 10px 10px 8px; font-size: 14px; } #options .op-hint { display: none; } }
`;

interface Row { el: HTMLElement; label: string; desc: () => string; left(): void; right(): void; press(): void }
interface Screen { root: HTMLElement; tab: OptionsTab; sel: number; rows: Row[]; paint: () => void; onClose?: () => void; onTab?: () => void; had: HTMLElement | null }
let deps: OptionsDeps | null = null, open: Screen | null = null;
/** the Brightness slider's own doing: the factor it has turned the exposure by, and the value it last wrote (the mission writes its own for its hour: then Reset has nothing of the slider's left to undo) */
let turned = 1, wrote: number | null = null;

function el(tag: string, cls?: string, text?: string) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function kept(): { vol?: Partial<typeof VOLUME_DEFAULTS>; hints?: boolean; tab?: string } { try { const v = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
/** a page held silent (`?mute`, or the automation profile's kept flag: main.ts pins the master bus at 0 there): that 0 is the rig's, never the player's level */
function muted(): boolean { try { return new URLSearchParams(globalThis.location?.search ?? '').has('mute') || globalThis.localStorage?.getItem('twopointsix.testMute') === '1'; } catch { return false; } }
function keep() { if (!deps) return; try { const v = deps.audio.volume, master = muted() ? kept().vol?.master ?? VOLUME_DEFAULTS.master : v.master; globalThis.localStorage?.setItem(LS, JSON.stringify({ vol: { master, sfx: v.sfx, ambience: v.ambience, music: v.music }, hints: deps.overlay.showLightDots, ...(TABKEY.kept !== 'off' ? { tab: TABKEY.kept } : {}) })); } catch { /* no store */ } }

/** ui/menu.ts hands the live objects over when its Menu is made (the boot is over): what this machine kept is put on them, and a screen that is up fills in */
export function setOptionsDeps(d: OptionsDeps | null) {
  deps = d; if (!d) return;
  const k = kept(), vol = d.audio.volume;
  let moved = false;
  if (k.vol && vol) for (const b of ['master', 'sfx', 'ambience', 'music'] as const) { if (b === 'master' && muted()) continue; const x = k.vol[b]; if (typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1 && vol[b] !== x) { vol[b] = x; moved = true; } }
  if (moved) d.audio.setVolumes();
  if (typeof k.hints === 'boolean') d.overlay.showLightDots = k.hints;
  TABKEY.kept = tabDoes(k.tab) ?? 'off'; if (!TABKEY.url) setTabKey(TABKEY.kept);   // (what Tab does, on trial: ui/tabkey.ts — a `?tab=` visit holds its own)
  if (open) render(open);
}
export function optionsOpen() { return !!open; }
export function closeOptions() {
  const S = open; if (!S) return; open = null;
  S.root.classList.remove('on'); S.root.innerHTML = '';
  if (!document.getElementById('missions')?.classList.contains('on')) document.getElementById('menu')?.removeAttribute?.('inert');   // (a list opened meanwhile holds the card under it itself)
  S.onClose?.();
  try { if (S.had?.isConnected) S.had.focus(); } catch { /* gone */ }
  // a card left up under the screen with the focus outside it (Tab opened the screen from play: what had the focus was the game's own sink) takes it, or its W S walk hears nothing
  const m = document.getElementById('menu'); if (m?.classList.contains('on') && !m.hasAttribute?.('inert') && !m.contains?.(document.activeElement)) (m.querySelector?.('.actions .btn:not(:disabled)') as HTMLElement | null)?.focus?.();
}
/** the screen, on `tab` (GRAPHICS unless the page is still booting: then CONTROLS, the one tab with nothing to wait for) */
export function openOptions(o: { tab?: OptionsTab; onClose?: () => void; onTab?: () => void } = {}) {
  if (typeof document === 'undefined') return;
  menuTheme(); styles();
  let root = document.getElementById('options') as HTMLElement | null;
  if (!root) { root = el('div'); root.id = 'options'; root.setAttribute('tabindex', '-1');
    root.addEventListener?.('mousedown', (e: Event) => e.stopPropagation()); root.addEventListener?.('contextmenu', (e: Event) => e.preventDefault());
    (document.body ?? document.documentElement)?.appendChild?.(root); }
  if (open) { open.tab = o.tab ?? open.tab; open.sel = 0; if (o.onClose) open.onClose = o.onClose; if (o.onTab) open.onTab = o.onTab; render(open); return; }
  const S: Screen = { root, tab: o.tab ?? (deps ? 'graphics' : 'controls'), sel: 0, rows: [], paint: () => {}, onClose: o.onClose, onTab: o.onTab, had: (document.activeElement as HTMLElement | null) ?? null };
  open = S;
  document.getElementById('menu')?.setAttribute?.('inert', '');
  const over = !!document.getElementById('menu')?.classList.contains('paused');   // (over a paused run the frame shows through: Brightness and the tier are judged against it)
  if (over) root.classList.add('over-game'); else root.classList.remove('over-game');
  root.classList.add('on'); render(S);
  try { root.focus?.({ preventScroll: true }); } catch { /* */ }
}

function styles() { if (document.getElementById?.('options-css')) return; const s = el('style'); s.id = 'options-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }

function render(S: Screen) {
  const r = S.root; r.innerHTML = ''; S.rows = [];
  const box = el('div', 'op-in'); r.appendChild(box);
  box.appendChild(el('div', 'op-title', 'Options'));
  const tabs = el('div', 'op-tabs'); box.appendChild(tabs);
  TABS.forEach((t, i) => { const b = el('button', 'op-tab' + (t.id === S.tab ? ' on' : '')) as HTMLButtonElement; b.dataset.tab = t.id; b.appendChild(el('i', '', String(i + 1))); b.appendChild(document.createTextNode(t.label));
    b.onclick = () => { S.tab = t.id; S.sel = 0; render(S); }; tabs.appendChild(b); });
  const body = el('div', 'op-body'); box.appendChild(body);
  const desc = el('div', 'op-desc'); box.appendChild(desc);
  const foot = el('div', 'op-foot'); box.appendChild(foot);
  const back = el('button', 'op-btn primary', 'Back') as HTMLButtonElement; back.dataset.act = 'back'; back.onclick = () => closeOptions(); foot.appendChild(back);
  const paints: (() => void)[] = [];
  const row = (parent: HTMLElement, label: string, describe: () => string) => {
    const e = el('div', 'op-row'), i = S.rows.length; e.appendChild(el('div', 'op-label', label));
    const R: Row = { el: e, label, desc: describe, left() {}, right() {}, press() {} }; S.rows.push(R);
    e.addEventListener?.('mouseenter', () => { if (S.sel !== i) { S.sel = i; S.paint(); } });
    e.addEventListener?.('mousedown', () => { if (S.sel !== i) { S.sel = i; S.paint(); } });
    parent.appendChild(e); return R;
  };
  const seg = <T extends string>(parent: HTMLElement, label: string, opts: { v: T; label: string; line?: string; px?: number }[], get: () => T, set: (v: T) => void, describe: () => string) => {
    const R = row(parent, label, describe), box = el('div', 'op-seg'); R.el.appendChild(box); R.el.appendChild(el('div', 'op-val'));
    const btns = opts.map(o => { const b = el('button', 'op-opt', o.label) as HTMLButtonElement; b.tabIndex = -1; if (o.line) b.title = o.line; if (o.px) { b.style.fontSize = `${o.px}px`; b.style.lineHeight = '13px'; } b.onclick = () => { set(o.v); S.paint(); }; box.appendChild(b); return b; });   // (px: a choice drawn at a size of its own, the row no taller for it)
    const step = (d: number) => { const i = opts.findIndex(o => o.v === get()), j = Math.max(0, Math.min(opts.length - 1, (i < 0 ? 0 : i) + d)); if (j !== i) { set(opts[j].v); S.paint(); } };
    R.left = () => step(-1); R.right = () => step(1);
    paints.push(() => { const v = get(); btns.forEach((b, i) => b.classList.toggle('on', opts[i].v === v)); });
  };
  const range = (parent: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string, describe: string) => {
    const R = row(parent, label, () => describe), i = el('input', 'op-range') as HTMLInputElement, val = el('div', 'op-val');
    i.type = 'range'; i.min = String(min); i.max = String(max); i.step = String(step); i.tabIndex = -1; R.el.appendChild(i); R.el.appendChild(val);
    const show = () => { const v = get(); i.value = String(v); i.style.setProperty?.('--p', `${Math.round(100 * (v - min) / (max - min))}%`); val.textContent = fmt(v); };
    i.oninput = () => { set(parseFloat(i.value)); show(); };
    const nudge = (d: number) => { const v = Math.max(min, Math.min(max, Math.round((get() + d * step) / step) * step)); set(v); S.paint(); };
    R.left = () => nudge(-1); R.right = () => nudge(1);
    paints.push(show);
  };
  const flip = (parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void, describe: string, words: [string, string] = ['Enabled', 'Disabled']) => {
    const R = row(parent, label, () => describe), b = el('button', 'op-switch') as HTMLButtonElement; b.tabIndex = -1; R.el.appendChild(b); R.el.appendChild(el('div', 'op-val'));
    const go = (v: boolean) => { if (get() !== v) { set(v); S.paint(); } };
    b.onclick = () => go(!get()); R.press = () => go(!get()); R.left = () => go(false); R.right = () => go(true);
    paints.push(() => { const v = get(); b.classList.toggle('on', v); b.textContent = v ? words[0] : words[1]; });
  };
  const sec = (parent: HTMLElement, text: string) => parent.appendChild(el('div', 'op-sec', text));
  let reset: (() => void) | null = null;

  // TEXT SIZE (ui/textsize.ts): its steps as the letter at each size, nothing chosen = the window's own. It needs no renderer: the row is live while the page boots
  const textRow = () => { if (TEXTSIZE.on) seg(body, 'Text size', TEXTSIZE.steps.map((m, i) => ({ v: String(i), label: 'A', px: Math.round(13 * m) })), () => String(textStep()), v => setTextStep(+v === TEXTSIZE.base ? null : +v),
    () => 'Every word on the screen, from the menus to the marks over the picture. Until you choose, it follows the size of the window. Ctrl or ⌘ with + and − step it from anywhere; with 0 it is the window\'s again.'); };
  if (S.tab === 'controls') controls(body);
  else if (!deps) { if (S.tab === 'graphics' && TEXTSIZE.on) { sec(body, 'Display'); textRow(); }
    const w = el('div', 'op-wait'); w.appendChild(el('b', '', 'Still starting up')); w.appendChild(document.createTextNode('The renderer is compiling its shaders. These settings open the moment it is ready; the controls are on the last tab meanwhile.')); body.appendChild(w); }
  else if (S.tab === 'graphics') {
    const { engine, quality } = deps, G = engine.settings;
    const cur = (): 'auto' | QualityName => quality.auto ? 'auto' : quality.current;
    sec(body, 'Quality');
    seg(body, 'Graphics quality', TIERS, cur, v => { if (v === 'auto') quality.setAuto(); else quality.pin(v); }, () => TIERS.find(t => t.v === cur())?.line ?? '');
    const live = el('div', 'op-info'); body.appendChild(live); paints.push(() => { live.textContent = displayNote(); });
    range(body, 'Render resolution', 50, 100, 5, () => Math.round(G.renderScale * 100), v => { const auto = quality.auto; if (auto) quality.pin(quality.current); G.renderScale = v / 100; if (auto) S.paint(); }, v => `${v.toFixed(0)} %`,
      'Per cent of the tier\'s full resolution the scene is rendered at before it is upscaled to the window. Edges stay clean down to about 60 %. Under Auto, moving this pins the current tier.');
    flip(body, 'Hold frame rate', () => quality.adaptive, v => { quality.adaptive = v; },
      'When the frame rate dips (smoke, a firefight, a big window) the render resolution steps down a notch at a time and comes back when there is headroom. Never below half.');
    sec(body, 'Display');
    range(body, 'Brightness', 0.5, 2.5, 0.05, () => G.exposure, v => { if (wrote !== G.exposure) turned = 1; if (G.exposure > 0) turned *= v / G.exposure; G.exposure = wrote = v; }, v => v.toFixed(2),
      'Exposure before the tone map. Raise it if your display crushes the dark rooms, lower it if the lamps blow out. A mission sets its own for its hour, so this is for the mission you are in.');
    textRow();
    const ro = (globalThis as unknown as { __readout?: { on: boolean; set(v: boolean): void } }).__readout;
    if (ro) flip(body, 'Show frame rate', () => ro.on, v => ro.set(v), 'The read-out in the top-left corner: frame rate, the GPU\'s milliseconds per pass, the counts, your light meter and each man\'s state.');
    const pinned = (() => { try { const q = new URLSearchParams(globalThis.location?.search ?? '').get('quality'); return TIERS.find(t => t.v === q && t.v !== 'auto')?.v as QualityName | undefined; } catch { return undefined; } })();   // (`?quality=` pins this visit's tier: Reset puts THAT back)
    reset = () => { if (TEXTSIZE.on) setTextStep(null); quality.adaptive = true; if (wrote === G.exposure && turned > 0) G.exposure /= turned; turned = 1; wrote = null; ro?.set(false); if (pinned) { quality.auto = false; quality.apply(pinned); } else quality.setAuto(); };   // (apply, not pin: a URL's tier is this visit's, never written as this machine's choice)
  } else if (S.tab === 'audio') {
    const { audio } = deps, V = audio.volume, pct = (v: number) => `${Math.round(v * 100)} %`;
    const bus = (k: keyof typeof VOLUME_DEFAULTS, label: string, d: string) => range(body, label, 0, 1, 0.05, () => V[k], v => { V[k] = v; audio.setVolumes(); keep(); }, pct, d);
    sec(body, 'Volume');
    bus('master', 'Master', 'Everything at once.');
    bus('sfx', 'Effects', 'Footsteps, doors, gunfire, voices, the radio.');
    bus('ambience', 'Ambience', 'Room tone, the rain, the hum of the fixtures.');
    bus('music', 'Music', 'The score follows the tension on the floor. Zero turns it off.');
    reset = () => { Object.assign(V, VOLUME_DEFAULTS); audio.setVolumes(); keep(); };
  } else {
    const { game, overlay } = deps;
    sec(body, 'Play');
    flip(body, 'Autosave checkpoints', () => game.saves.enabled, v => { game.saves.setEnabled(v); },
      'A checkpoint is written by itself when the mission moves on, when you first enter a room, when you hide a body and every minute and a half of quiet play. Never while anyone is on to you. Enter on the down card loads the newest.');
    flip(body, 'Interaction hints', () => overlay.showLightDots, v => { overlay.showLightDots = v; keep(); }, 'The faint dots marking what Space and the right button can act on: lights, doors, bodies.');
    const tabOpts = tabChoices(BACKKEY.tab);   // (while Tab is the back key the first choice reads 'Nothing more' and every line says so: ui/tabkey.ts)
    seg(body, 'Tab key (trying out)', tabOpts, () => TABKEY.does, v => { setTabKey(v); TABKEY.kept = v; TABKEY.url = false; keep(); }, () => tabOpts.find(c => c.v === TABKEY.does)?.line ?? '');
    sec(body, 'Cheats');
    flip(body, 'God mode', () => game.godMode, v => { game.godMode = v; saveSandbox(game, 'god'); }, 'They still see you and shoot you; hits do nothing. Remembered on this machine.', ['On', 'Off']);
    flip(body, 'Enemies do not think', () => !game.aiEnabled, v => { game.aiEnabled = !v; saveSandbox(game, 'noAi'); }, 'Everybody stands where he is: nobody patrols, hears or sees. Remembered on this machine.', ['On', 'Off']);
    flip(body, 'Unlimited ammunition', () => game.infiniteAmmo, v => { game.infiniteAmmo = v; saveSandbox(game, 'ammo'); }, gearText('Bottomless magazines, canisters, ring airfoils and wall charges. Remembered on this machine.'), ['On', 'Off']);
    reset = () => { game.saves.setEnabled(true); overlay.showLightDots = true; setTabKey('off'); TABKEY.kept = 'off'; TABKEY.url = false; keep();
      if (game.godMode) { game.godMode = false; saveSandbox(game, 'god'); } if (!game.aiEnabled) { game.aiEnabled = true; saveSandbox(game, 'noAi'); } if (game.infiniteAmmo) { game.infiniteAmmo = false; saveSandbox(game, 'ammo'); } };
  }
  if (reset) { const run = reset, b = el('button', 'op-btn', 'Reset to defaults') as HTMLButtonElement; b.dataset.act = 'reset'; b.onclick = () => { run(); S.paint(); }; foot.appendChild(b); }
  foot.appendChild(el('div', 'op-hint', S.rows.length ? '1 2 3 4 tabs · W S rows · A D change · Esc back' : '1 2 3 4 tabs · W S scroll · Esc back'));
  S.sel = Math.max(0, Math.min(S.rows.length - 1, S.sel));
  S.paint = () => {
    for (const p of paints) p();
    S.rows.forEach((R, i) => R.el.classList.toggle('sel', i === S.sel));
    const R = S.rows[S.sel]; desc.innerHTML = '';
    if (R) { desc.appendChild(el('b', '', R.label)); desc.appendChild(document.createTextNode(R.desc())); }
    else desc.appendChild(document.createTextNode(S.tab === 'controls' ? gearText('Nothing here needs holding down but Space, to choose between actions, and the rifle\'s launcher, to see its arc.') : ''));
  };
  S.paint();
}

/** the row Tab adds to the list while it is on trial (ui/tabkey.ts): under the group it belongs to, after the key it doubles where it doubles one */
function tabRow(): { group: string; after?: string; row: [string[], string, string?] } | null {
  const on = 'on trial: Options, Game, Tab key';
  switch (TABKEY.does) {
    case 'who': return { group: 'Squad', after: 'T', row: [['Tab'], 'Who takes the next order, as T', on] };
    case 'run': return { group: 'Game', after: 'Esc', row: [['Tab'], 'Pause on the run so far, and back', on] };
    case 'keys': return { group: 'Game', after: 'Esc', row: [['Tab'], 'Pause on this list of keys, and back', on] };
    default: return null;
  }
}
function controls(body: HTMLElement) {
  const cols = el('div', 'op-keys'); body.appendChild(cols);
  const tab = tabRow();
  for (const g of KEYS) {
    const box = el('div', 'op-kgroup'); box.appendChild(el('div', 'op-sec', g.group));
    const back: typeof g.rows = BACKKEY.tab && g.group === 'Game' ? g.rows.flatMap(r => r[0][0] === 'Esc' ? [r, [['Tab'], 'Back out of a list'] as typeof r] : [r]) : g.rows;   // (game/backkey.ts: the key Esc gave up)
    const rows = tab && tab.group === g.group ? back.flatMap(r => r[0][0] === tab.after && r[1] !== 'Back out of a list' ? [r, tab.row] : [r]) : back;
    for (const [caps, what, small] of rows) {
      const r = el('div', 'op-krow'), c = el('div', 'op-caps');
      caps.forEach((k, i) => { if (i > 0 && caps.length < 4) c.appendChild(el('u', '', '+')); c.appendChild(el('kbd', '', k)); });
      const w = el('div', 'op-what', gearText(what)); if (small) w.appendChild(el('small', '', gearText(small)));
      r.appendChild(c); r.appendChild(w); box.appendChild(r);
    }
    cols.appendChild(box);
  }
}

/** the Graphics tab's live line: tier (and whether Auto chose it), internal → output resolution, GPU milliseconds and what that is in frames per second */
export function displayNote(): string {
  if (!deps) return '';
  const { engine, quality } = deps;
  const gpu = engine.timer?.unionMs?.() ?? 0; const fps = gpu > 0.5 ? Math.min(240, 1000 / gpu) : 0;
  const res = engine.width && engine.outWidth ? `${engine.width}×${engine.height} rendered → ${engine.outWidth}×${engine.outHeight} shown` : '';
  const tier = quality.auto ? `Auto is running ${quality.current}${/^(auto|calibrat)/.test(quality.lastChange ?? '') ? ' — ' + quality.lastChange : ''}` : `${quality.current[0].toUpperCase()}${quality.current.slice(1)} (pinned)`;
  return [tier, res, gpu > 0.5 ? `GPU ${gpu.toFixed(1)} ms a frame (≈ ${fps.toFixed(0)} fps of headroom)` : ''].filter(Boolean).join(' · ');
}
/** Auto's calibration has just settled under an open screen (ui/menu.ts refreshQualityNote): its line and the tier's button follow */
export function refreshOptions() { open?.paint(); }

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener(TEXT_EVENT, () => open?.paint());   // (the size stepped by its keys under an open screen: the row follows)
  // registered at module load = ahead of every listener main.ts adds at boot (its Esc handler, the Input class): a key the screen takes stops here
  window.addEventListener('keydown', e => {
    const S = open; if (!S || e.ctrlKey || e.metaKey || e.altKey) return;
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    const onBtn = e.target instanceof HTMLElement && (e.target.classList.contains('op-btn') || e.target.classList.contains('op-tab')) && S.root.contains(e.target);
    const move = (d: number) => { if (!S.rows.length) { (S.root.querySelector('.op-body') as HTMLElement | null)?.scrollBy?.({ top: d * 96 }); return; }   // (CONTROLS has no row to walk: the keys scroll its list)
      S.sel = (S.sel + d + S.rows.length) % S.rows.length; S.paint(); S.rows[S.sel].el.scrollIntoView?.({ block: 'nearest' }); };
    switch (e.code) {
      case 'Escape': if (!e.repeat) closeOptions(); eat(); return;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': { const t = TABS[+e.code.slice(5) - 1]; if (t && t.id !== S.tab) { S.tab = t.id; S.sel = 0; render(S); } eat(); return; }
      case 'ArrowUp': case 'KeyW': move(-1); eat(); return;
      case 'ArrowDown': case 'KeyS': move(1); eat(); return;
      case 'ArrowLeft': case 'KeyA': S.rows[S.sel]?.left(); eat(); return;
      case 'ArrowRight': case 'KeyD': S.rows[S.sel]?.right(); eat(); return;
      case 'Enter': case 'NumpadEnter': case 'Space': if (onBtn) { e.stopImmediatePropagation(); return; } if (!e.repeat) S.rows[S.sel]?.press(); eat(); return;   // (on Back / Reset / a tab the key is that button's)
      case 'Tab': if (S.onTab) { const back = S.onTab; if (!e.repeat) { closeOptions(); back(); } eat(); return; }   // (the screen Tab itself opened — ui/tabkey.ts 'keys' — goes away on Tab)
        e.stopImmediatePropagation(); return;   // (the browser's own walk over Back and Reset; never the game's key)
      default: if (/^F\d{1,2}$/.test(e.code)) return;   // (the recorders' keys — F7 replay, F8 sweep, F9, F10 — work with the screen up, as they do over a pause card)
        e.stopImmediatePropagation();   // (nothing else under the screen hears a key while it is up; the rest keep their browser defaults)
    }
  }, { capture: true });
  // a key let go is never held back (the game's Input must hear a key held when the screen came up being released); Space let go on a row's own control
  // would press it a second time in some browsers — the keydown above already did what the row does
  window.addEventListener('keyup', e => { const S = open; if (!S || e.code !== 'Space') return; const t = e.target; if (t instanceof HTMLElement && (t.classList.contains('op-btn') || t.classList.contains('op-tab')) && S.root.contains(t)) return; e.preventDefault(); }, { capture: true });
}
