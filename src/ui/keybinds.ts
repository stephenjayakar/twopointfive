// REBINDING A KEY, on Options ▸ Controls (ui/options.ts draws the list; this file is the caps that can be moved and the one key they wait for).
// A cap of a row the player may move (host/keymap.ts KEY_ACTS) is a button: a click, or Enter on it, and it WAITS — the next key pressed is its key.
//   · a key another row has: the two SWAP, and the other cap shows it for a moment (no two rows are ever left on one key)
//   · Backspace or Delete: the row has no key (its cap reads —, marked)      · Esc, or a click anywhere: nothing changes
//   · a row the build itself gives no key (the wall hold's: host/keymap.ts qFree) reads — from the start, unmarked: a click and a key puts it on one
//   · one of the page's own keys (Enter, Tab, the arrows …): the cap shakes its head and goes on waiting; the F row stays the browser's and the recorders'
// A redraw of the list under a waiting cap (the boot ending under the screen) leaves it waiting: the new cap of the same row takes the wait over.
// A cap that is not as built is marked; Reset (the screen's own button) puts every one back. The words beside a cap, the HUD and the start card's list follow
// through host/keymap.ts keyText / keyCap. Nothing here is the game's: the rebind lives at the keyboard (game/input.ts).
import { KEYMAP, actOfCap, bindKey, unbindKey, capNow, keysOf, keyBuilt } from '../host/keymap';

/** what the options screen hands a cap: its list of rows the keys walk (W S), and a repaint */
export interface KeyHost { rows: { el: HTMLElement; label: string; desc: () => string; left(): void; right(): void; press(): void }[]; paints: (() => void)[]; select(i: number): void; paint(): void }

let waiting: { id: string; el: HTMLElement } | null = null;
let refused = '', swapped = '', swapT = 0;

const CSS = `
#options button.op-key { box-sizing: border-box; min-width: 26px; padding: 3px 7px 2px; text-align: center; font: 600 12px/1.3 var(--m-mono); color: var(--m-bright); background: rgba(var(--m-btn-rgb),0.9); border: 1px solid rgba(var(--m-edge),0.45); border-bottom-width: 2px; border-radius: 3px; cursor: pointer; }
#options .op-keys.rebind kbd { color: var(--m-soft); background: none; border-bottom-width: 1px; }
#options button.op-key:hover, #options button.op-key.sel { border-color: var(--m-accent); outline: none; }
#options button.op-key.sel { box-shadow: 0 0 0 1px var(--m-accent); }
#options button.op-key.moved { color: var(--m-accent); }
#options button.op-key.none, #options kbd.none { color: var(--m-accent-hi); border-color: var(--m-accent-hi); border-style: dashed; }
#options button.op-key.wait { color: var(--m-on-accent); background: var(--m-accent); border-color: var(--m-accent); animation: opkey-wait 0.9s ease-in-out infinite; }
#options button.op-key.swap { animation: opkey-swap 0.9s ease-out 1; }
#options button.op-key.no { animation: opkey-no 0.28s linear 1; }
@keyframes opkey-wait { 50% { opacity: 0.55; } }
@keyframes opkey-swap { 0% { background: var(--m-accent); color: var(--m-on-accent); } }
@keyframes opkey-no { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
`;
function styles() { if (document.getElementById?.('keybinds-css')) return; const s = document.createElement('style'); s.id = 'keybinds-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }

/** is a cap waiting for its key (the screen's own keys are the cap's then) */
export function keyWaiting(): boolean { if (waiting && !waiting.el.isConnected) waiting = null; return !!waiting; }
/** let go of a waiting cap, nothing changed */
export function keyStop() { waiting = null; refused = ''; }

/** ONE CAP of the Controls list: `cap` as the build names it ('Q', 'Shift', 'Ctrl'). A cap of a row that can move is its button the first time the list
 *  shows it (`seen` is the list's own: the row's cap anywhere after is a plain cap that follows); anything else is the plain cap it always was. */
export function keyCapEl(cap: string, what: string, host: KeyHost, seen: Set<string>): HTMLElement {
  const row = actOfCap(cap), a = KEYMAP.on ? row : null;
  if (!a) { const k = document.createElement('kbd'); k.textContent = row ? capNow(row.id) : cap; if (row && !keysOf(row.id).length) { styles(); k.classList.add('none'); } return k; }   // (the rebinding off: a row the build gives no key still reads —, host/keymap.ts qFree)
  if (seen.has(a.id)) { const k = document.createElement('kbd'); host.paints.push(() => { const now = capNow(a.id); k.textContent = now; k.classList.toggle('none', !keysOf(a.id).length); }); return k; }
  seen.add(a.id); styles();
  const b = document.createElement('button'); b.className = 'op-key'; b.tabIndex = -1; b.dataset.key = a.id;
  if (waiting?.id === a.id) waiting.el = b;   // (the list drawn again under a waiting cap)
  const i = host.rows.length;
  const go = () => { if (waiting?.id === a.id) keyStop(); else { waiting = { id: a.id, el: b }; refused = ''; } host.select(i); };
  host.rows.push({ el: b, label: what, desc: () => waiting?.id !== a.id ? 'Click it, then press its new key.' : refused === a.id ? 'The page needs that key. Press another · press Esc to keep the old one' : 'Press its new key · press Backspace for no key · press Esc to keep the old one', left() {}, right() {}, press: go });
  b.onclick = e => { e.stopPropagation(); go(); };
  b.addEventListener?.('mouseenter', () => { if (!waiting) host.select(i); });
  host.paints.push(() => {
    const w = waiting?.id === a.id; b.textContent = w ? '…' : capNow(a.id);
    b.classList.toggle('wait', w); b.classList.toggle('none', !w && !keysOf(a.id).length); b.classList.toggle('moved', !w && !keyBuilt(a.id));
    b.classList.toggle('no', w && refused === a.id); b.classList.toggle('swap', !w && swapped === a.id && performance.now() - swapT < 900);
  });
  return b;
}

/** A KEY PRESSED WITH THE SCREEN UP (ui/options.ts asks before its own keys): true = a cap was waiting and the key was its own */
export function keyCapture(e: KeyboardEvent): boolean {
  if (!keyWaiting()) return false;
  const w = waiting!; if (/^F\d{1,2}$/.test(e.code)) return false;   // (never a row's key, and never held back: the browser's reload, the replay keeper)
  if (e.repeat) return true;
  if (e.code === 'Escape') { keyStop(); return true; }
  if (e.code === 'Backspace' || e.code === 'Delete') { unbindKey(w.id); keyStop(); return true; }
  const r = bindKey(w.id, e.code);
  if (!r.ok) { refused = w.id; w.el.classList.remove('no'); void w.el.offsetWidth; return true; }   // (the shake again on a second wrong key: the class is taken off and the box read, so the paint that follows starts it afresh)
  if (r.swapped) { swapped = r.swapped; swapT = performance.now(); } else swapped = '';
  keyStop(); return true;
}
