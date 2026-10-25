// Keyboard + mouse state.
import { gameCode, camKey, KEYMAP } from '../host/keymap';
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();     // edge-triggered this frame
  mouseX = 0; mouseY = 0;          // CSS pixels relative to canvas
  orbitDX = 0;                     // horizontal mouse travel this frame WHILE the camera's key is held (Ctrl, or the Space bar while it is spare — host/keymap.ts camKey; the loop consumes it)
  wheelCtrl = 0;                   // wheel travel with the camera's key held, or a pinch (zoom); plain `wheel` is the walking-pace control (player.ts)
  buttons = 0; clicked = 0;        // held / edge-this-frame button bits, 1 << MouseEvent.button: 1 = LMB, 2 = MMB, 4 = RMB (see lmb() / mmb() / rmb())
  suppressClick = false;           // set by the title card: swallow the very next mouse press
  dragOff = false;                 // a held left button's cursor is followed off the view too (over the panel, the HUD): only while the creep reads the mouse as a stick — Game.update sets it from stalk.ts STALK.drag every frame
  wheel = 0;
  hasFocus = true;
  /** when set, real keyboard / mouse input is ignored except these key codes (the showcase tour drives the player itself; P still stops it).
   *  Synthetic input (pressed.add / clicked |= / mouseX =) is unaffected. */
  lockExcept: Set<string> | null = null;
  /** is F5 the game's right now (the save by hand — savestate.ts SAVETIMELINE; the page's to say: a run is up)? Then its bare press is kept from the browser, whose reload it is */
  saveKey: (() => boolean) | null = null;
  /** called (rate-limited by the owner) when a real key / click is swallowed by the lock — lets the page tell the viewer why nothing happened */
  onLockedInput: (() => void) | null = null;
  /** asked about every real key before the game reads it: true = a UI surface took it (main.ts hands the tweak panel's onKey — ← / → over the panel walk its
   *  systems, a typed letter opens its search) and the game never sees it. Order-independent, unlike a second capture listener on window. */
  keyVeto: ((e: KeyboardEvent) => boolean) | null = null;

  /** Off-screen textarea that holds keyboard focus while playing inside someone else's page (an iframe embed such as the artifact viewer):
   *  host pages usually leave keystrokes aimed at an editable element alone, so their single-letter shortcuts stop eating ours. Every game
   *  key is preventDefault-ed, so nothing is ever typed into it (and macOS never shows its press-and-hold accent picker over the game). */
  private sink: HTMLTextAreaElement | null = null;
  /** the keys down on the board → the code each was filed under (host/keymap.ts: the player's own keys): a key let go lets go of what its press put down,
   *  whatever was rebound while it was held */
  private heldAs = new Map<string, string>();
  /** the camera's key is down (host/keymap.ts camKey: the Space bar while it is no row's): the key on the board, '' = not. The turn under Ctrl needs no such note: every
   *  mouse event says whether it is down; the wheel's own note of Ctrl is `ctrlDown` */
  camHeld = '';
  /** a Ctrl key is DOWN, by the last key or mouse event's own word: every one carries the modifiers as they ARE, whatever has the focus, whoever took the
   *  key and wherever Control sits on his board. The wheel asks it (KEYMAP.pinchOnly, below): a wheel that says Ctrl while no Ctrl key is down is a pinch */
  private ctrlDown = false;

  /** an Input with EVERY field initialised and NO listeners — the headless harness's, the session replayer's and a native host's: they write keys / pressed / mouse /
   *  buttons themselves (tools/qa/headless.ts used to Object.create(Input.prototype) and forgot orbitDX / wheelCtrl / keyVeto). `el` is null: focusGame() is a no-op. */
  static detached(): Input { return new Input(null); }

  constructor(private el: HTMLElement | null) {
    if (!el) return;   // detached (above): no DOM, no listeners — the state fields above are the whole object
    const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
    if (framed) {
      const t = document.createElement('textarea'); t.setAttribute('aria-label', 'game input'); t.setAttribute('inputmode', 'none'); t.tabIndex = -1; t.autocomplete = 'off'; t.spellcheck = false; t.setAttribute('autocorrect', 'off'); t.setAttribute('autocapitalize', 'off');   // (no aria-hidden on a focused element — Chrome warns; inputmode none keeps touch keyboards down)
      t.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;resize:none;border:0;padding:0;';
      document.body.appendChild(t); this.sink = t;
    }
    const typingTarget = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLTextAreaElement && e.target !== this.sink) || (e.target instanceof HTMLElement && e.target.isContentEditable);
    // Capture phase on window = first in line: a game key is claimed here (stopPropagation) before any document-level shortcut handler the
    // embedding page may have installed sees it. Escape and anything with Cmd/Ctrl held stay shared (menus, browser and host shortcuts).
    { const mods = (e: { ctrlKey: boolean }) => { this.ctrlDown = e.ctrlKey; };   // (ahead of this class's own listeners and behind none of their gates: a field with the focus, a lock and a repeat say it too. A screen whose listener is ahead of these and stops a BARE Ctrl key would hide it: none does. Focus lost keeps it: the next move of the mouse says how it is)
      for (const t of ['keydown', 'keyup', 'mousemove', 'mousedown', 'mouseup'] as const) window.addEventListener(t, mods, { capture: true }); }
    window.addEventListener('keydown', e => {
      if (e.code === 'F5' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && this.saveKey?.()) e.preventDefault();   // (F5 is the save by hand while the page says so — main.ts: a bare press must not reload the page under the run, a slider of the Options that kept the focus included; with a modifier, on the start page or over a broken frame it is the browser's reload as ever)
      if (typingTarget(e)) return;
      if (this.keyVeto?.(e)) { e.stopPropagation(); return; }   // (a UI surface — the tweak panel — took it: not a game key this time)
      this.modsUp(e);
      const inMenu = e.target instanceof HTMLElement && !!e.target.closest('#menu, #missions');   // (#missions: the mission list — ui/missions.ts — is a card like the menu's)
      const modifier = ['Meta', 'Control', 'Shift', 'Alt'].includes(e.key);
      const ours = e.code !== 'Escape' && !e.metaKey && !(e.ctrlKey && !modifier) && !inMenu && !/^F\d+$/.test(e.code);   // (the Control key itself is ours: held, it is the camera's orbit / zoom modifier — host/loop.ts; no game key reads it, crouch is C; F-keys stay the browser's)
      const code = gameCode(e.code);   // (the key as the game knows it — host/keymap.ts: itself unless the player moved a key in Options ▸ Controls; '' = a key whose row he moved away)
      if (ours) { e.stopPropagation(); const typing = e.key.length === 1 || ['Backspace', 'Enter', 'Delete'].includes(e.key); if ((e.target === this.sink && typing) || ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (code && code !== e.code)) e.preventDefault(); }   // (a key he gave a row is the game's whole: Backspace goes back a page nowhere, ' and / open no find bar)
      if (ours && !e.repeat && e.code === camKey()) this.camHeld = e.code;   // (held, it is the camera's: the mouse turns the view, the wheel zooms — below)
      if (!code) { this.heldAs.set(e.code, ''); return; }   // (…and let go, it lets go of nothing: the key his row moved TO may be down)
      if (this.lockExcept && !this.lockExcept.has(code)) { if (!inMenu && !e.repeat && e.code !== 'Escape' && !modifier && !e.metaKey && !e.ctrlKey) this.onLockedInput?.(); return; }   // hands off during the tour (menu keyboard nav still works)
      if (e.repeat) return;   // OS auto-repeat is never a fresh press (holding P must not strobe the tour on and off)
      if (!this.keys.has(code) || this.heldAs.has(e.code)) this.pressed.add(code);   // (…a key that goes down again with no repeat in it came up unseen — a system shortcut, a menu of the system's took its key-up: a fresh press, not a key dead until the window is left)
      this.keys.add(code); this.heldAs.set(e.code, code);
    }, { capture: true });
    window.addEventListener('keyup', e => { if (e.code === this.camHeld) this.camHeld = ''; { const as = this.heldAs.get(e.code) ?? gameCode(e.code); this.heldAs.delete(e.code); if (as) this.keys.delete(as); } if (!typingTarget(e) && e.code !== 'Escape' && !e.metaKey) e.stopPropagation(); if (this.sink && e.target === this.sink) this.sink.value = ''; }, { capture: true });
    window.addEventListener('blur', () => { this.keys.clear(); this.heldAs.clear(); this.camHeld = ''; this.buttons = 0; this.pressed.add('Blur'); });   // ('Blur': a one-frame code for whoever must tell keys dropped from keys released — the squad's order menu)
    el.addEventListener('mousemove', e => { this.modsUp(e); const r = el.getBoundingClientRect(); this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top; if (!this.lockExcept && (this.camHeld ? !!camKey() || e.ctrlKey : e.ctrlKey && !camKey())) this.orbitDX += e.movementX; });   // (the cursor is tracked through a lock — the tour writes its own aim over it every frame it has one — so the reticle is where the mouse IS the moment the lock lifts; only the orbit is hands-off: review U9.11)
    window.addEventListener('mousemove', e => { if (!this.dragOff) return; this.modsUp(e); if (!(e.buttons & 1)) { this.buttons &= ~1; return; } if (!(this.buttons & 1) || e.target === el) return; const r = el.getBoundingClientRect(); this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top; });   // (a drag begun on the view goes on being one over the panel or the HUD: stalk.ts STALK.drag reads it as a stick — only while `dragOff`. The press must have been on the view (the latch: a slider dragged on the panel is not a stick) and still be down by the event's own buttons: one let go outside the window sends no mouseup. Tracked through a lock, as the view's own listener does, so the reticle is where the mouse is when the lock lifts)
    el.addEventListener('mousedown', e => { e.preventDefault(); this.focusGame(); if (this.lockExcept) { this.onLockedInput?.(); return; } if (this.suppressClick) { this.suppressClick = false; return; } this.buttons |= 1 << e.button; this.clicked |= 1 << e.button; });
    window.addEventListener('mouseup', e => { if (this.lockExcept) return; this.buttons &= ~(1 << e.button); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('contextmenu', () => { this.camHeld = ''; }, { capture: true });   // (a browser menu opened off the canvas swallows the key's coming up: the camera is let go of there, not left turning with every move of the mouse)
    el.addEventListener('wheel', e => { e.preventDefault(); if (!e.ctrlKey) this.ctrlDown = false; if (this.lockExcept) return; const space = !!camKey(), cam = !!this.camHeld && space;
      // (KEYMAP.pinchOnly: while the camera's key is Space, the wheel under a Ctrl key that is DOWN is nothing — neither the zoom nor his pace. A wheel
      // that says Ctrl with no Ctrl key down is a trackpad pinch, and still zooms)
      if (KEYMAP.pinchOnly && space && !cam && e.ctrlKey && this.ctrlDown) return;
      if (e.ctrlKey || cam) this.wheelCtrl += e.deltaY; else this.wheel += e.deltaY; }, { passive: false });   // (a trackpad pinch also arrives as ctrl+wheel: it zooms, which is what a pinch should do — whichever key the camera is on)
  }
  /** A MODIFIER THE SYSTEM SAYS IS UP IS LET GO. A key-up the page never saw leaves its key held for good: a screenshot shortcut, the system's own menus
   *  and switchers take a modifier's key-up with them and the window is never blurred. Every key and mouse event carries the modifiers as they ARE, so a
   *  Shift / Control / Alt / Cmd this page holds that the event says is up goes — whatever it was held AS (host/keymap.ts: sprint on Shift, wherever he moved it) */
  private modsUp(e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) {
    if (!this.heldAs.size) return;
    if (!e.shiftKey) { this.modUp('ShiftLeft'); this.modUp('ShiftRight'); } if (!e.ctrlKey) { this.modUp('ControlLeft'); this.modUp('ControlRight'); }
    if (!e.altKey) { this.modUp('AltLeft'); this.modUp('AltRight'); } if (!e.metaKey) { this.modUp('MetaLeft'); this.modUp('MetaRight'); }
  }
  private modUp(phys: string) { const as = this.heldAs.get(phys); if (as === undefined) return; this.heldAs.delete(phys); if (as) this.keys.delete(as); if (this.camHeld === phys) this.camHeld = ''; }
  /** Give keyboard focus back to the game (the sink when embedded, else just drop focus from whatever button / field had it). */
  focusGame() { if (!this.el) return; if (this.sink) { if (document.activeElement !== this.sink) this.sink.focus({ preventScroll: true }); } else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !document.activeElement.closest('#panel')) document.activeElement.blur(); }
  down(code: string) { return this.keys.has(code); }
  hit(code: string) { return this.pressed.has(code); }
  lmb() { return (this.buttons & 1) !== 0; }
  rmb() { return (this.buttons & 4) !== 0; }
  lmbHit() { return (this.clicked & 1) !== 0; }
  rmbHit() { return (this.clicked & 4) !== 0; }
  mmb() { return (this.buttons & 2) !== 0; }
  mmbHit() { return (this.clicked & 2) !== 0; }
  endFrame() { this.pressed.clear(); this.clicked = 0; this.wheel = 0; this.wheelCtrl = 0; this.orbitDX = 0; }
  /** between two game ticks of one drawn frame (host/loop.ts, the fixed step): the one-frame edges were the first tick's — what is held stays held */
  endTick() { this.pressed.clear(); this.clicked = 0; this.wheel = 0; }
}
