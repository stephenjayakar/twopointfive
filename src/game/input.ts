// Keyboard + mouse state.
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();     // edge-triggered this frame
  mouseX = 0; mouseY = 0;          // CSS pixels relative to canvas
  orbitDX = 0;                     // horizontal mouse travel this frame WHILE Ctrl is held (camera orbit; main.ts consumes it) — Ctrl does nothing else now
  wheelCtrl = 0;                   // wheel travel with Ctrl held (zoom); plain `wheel` is the walking-pace control (player.ts)
  buttons = 0; clicked = 0;        // held / edge-this-frame button bits, 1 << MouseEvent.button: 1 = LMB, 2 = MMB, 4 = RMB (see lmb() / mmb() / rmb())
  suppressClick = false;           // set by the title card: swallow the very next mouse press
  wheel = 0;
  hasFocus = true;
  /** when set, real keyboard / mouse input is ignored except these key codes (the showcase tour drives the player itself; P still stops it).
   *  Synthetic input (pressed.add / clicked |= / mouseX =) is unaffected. */
  lockExcept: Set<string> | null = null;
  /** called (rate-limited by the owner) when a real key / click is swallowed by the lock — lets the page tell the viewer why nothing happened */
  onLockedInput: (() => void) | null = null;
  /** asked about every real key before the game reads it: true = a UI surface took it (main.ts hands the tweak panel's onKey — ← / → over the panel walk its
   *  systems, a typed letter opens its search) and the game never sees it. Order-independent, unlike a second capture listener on window. */
  keyVeto: ((e: KeyboardEvent) => boolean) | null = null;

  /** Off-screen textarea that holds keyboard focus while playing inside someone else's page (an iframe embed such as the artifact viewer):
   *  host pages usually leave keystrokes aimed at an editable element alone, so their single-letter shortcuts stop eating ours. Every game
   *  key is preventDefault-ed, so nothing is ever typed into it (and macOS never shows its press-and-hold accent picker over the game). */
  private sink: HTMLTextAreaElement | null = null;

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
    window.addEventListener('keydown', e => {
      if (typingTarget(e)) return;
      if (this.keyVeto?.(e)) { e.stopPropagation(); return; }   // (a UI surface — the tweak panel — took it: not a game key this time)
      const inMenu = e.target instanceof HTMLElement && !!e.target.closest('#menu, #missions');   // (#missions: the mission list — ui/missions.ts — is a card like the menu's)
      const modifier = ['Meta', 'Control', 'Shift', 'Alt'].includes(e.key);
      const ours = e.code !== 'Escape' && !e.metaKey && !(e.ctrlKey && !modifier) && !inMenu && !/^F\d+$/.test(e.code);   // (the Control key itself is ours: held, it is the camera's orbit / zoom modifier — host/loop.ts; no game key reads it, crouch is C; F-keys stay the browser's)
      if (ours) { e.stopPropagation(); const typing = e.key.length === 1 || ['Backspace', 'Enter', 'Delete'].includes(e.key); if ((e.target === this.sink && typing) || ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }
      if (this.lockExcept && !this.lockExcept.has(e.code)) { if (!inMenu && !e.repeat && e.code !== 'Escape' && !modifier && !e.metaKey && !e.ctrlKey) this.onLockedInput?.(); return; }   // hands off during the tour (menu keyboard nav still works)
      if (e.repeat) return;   // OS auto-repeat is never a fresh press (holding P must not strobe the tour on and off)
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    }, { capture: true });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); if (!typingTarget(e) && e.code !== 'Escape' && !e.metaKey) e.stopPropagation(); if (this.sink && e.target === this.sink) this.sink.value = ''; }, { capture: true });
    window.addEventListener('blur', () => { this.keys.clear(); this.buttons = 0; this.pressed.add('Blur'); });   // ('Blur': a one-frame code for whoever must tell keys dropped from keys released — the squad's order menu)
    el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top; if (e.ctrlKey && !this.lockExcept) this.orbitDX += e.movementX; });   // (the cursor is tracked through a lock — the tour writes its own aim over it every frame it has one — so the reticle is where the mouse IS the moment the lock lifts; only the orbit is hands-off: review U9.11)
    el.addEventListener('mousedown', e => { e.preventDefault(); this.focusGame(); if (this.lockExcept) { this.onLockedInput?.(); return; } if (this.suppressClick) { this.suppressClick = false; return; } this.buttons |= 1 << e.button; this.clicked |= 1 << e.button; });
    window.addEventListener('mouseup', e => { if (this.lockExcept) return; this.buttons &= ~(1 << e.button); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); if (this.lockExcept) return; if (e.ctrlKey) this.wheelCtrl += e.deltaY; else this.wheel += e.deltaY; }, { passive: false });   // (a trackpad pinch also arrives as ctrl+wheel: it zooms, which is what a pinch should do)
  }
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
