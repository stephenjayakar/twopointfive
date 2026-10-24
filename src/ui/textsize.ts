// THE GAME'S OWN TEXT SIZE: one factor every word on the page is drawn at — the menus, the cards, the fight screen's read-outs, the marks over the picture, the
// debugger — in place of the browser's zoom, which the page now keeps for itself (a play test on a 3840 × 2160 screen, 10-19: 11 px rows nobody could read, and
// Ctrl + that grew the page until the layout broke). Three parts:
//   THE SIZE FOLLOWS THE WINDOW. With nothing chosen the factor is the window over `TEXTSIZE.ref` (1920 × 1080, the larger of the sizes the screens were laid
//     out at), never under 1: a 3840 × 2160 window at 100 % draws at 2, a 2560 × 1440 one at 1.33, a laptop's as it always did. A page zoomed from the
//     browser's own menu is a smaller window with denser pixels, so the factor falls as the zoom rises and the words stay the size they were.
//   A FEW STEPS OF YOUR OWN (`steps`, each a multiple of the window's factor; `base` is the one that is 1): the Options screen's Text size row, and the keys the
//     browser zooms with — Ctrl or ⌘ with + and − step it, with 0 it is the window's again. Kept per machine (localStorage `twopointsix.textsize`: the step's
//     index; nothing kept = the window's). A step never takes the layout under `floor` (1200 × 675 of its own pixels, the smallest the screens hold whole
//     at): on a window with less room than the largest step asks for, the larger steps share the room there is, so each is still a step.
//   THE PAGE DOES NOT ZOOM: Ctrl / ⌘ + − 0, Ctrl + wheel (nothing over a menu; over the picture a pinch is the camera's zoom and the wheel under a held Ctrl key nothing — game/input.ts) and a pinch are taken from the browser.
// HOW: CSS `zoom` on each layer of the page that carries words (`LAYERS`; never the picture's canvas), the factor in `--tz` on the root, which also wears the
// class `tsz` while the switch is on. Inside a zoomed layer a length in px is that many of the LAYER's pixels, and three things do not follow by themselves:
//   · a viewport unit is multiplied like any other length, so a rule in a layer writes `calc(25vw / var(--tz, 1))`, never a bare `25vw`
//     (tools/qa/textsize-check.ts is red on a bare one);
//   · an `@media` width or height asks the real window, so every such rule in the page is rewritten to ask for `px × factor` (`mediaRules`, again whenever a
//     style sheet joins the page), and a script asks `uiMatch('(max-width: 720px)')` in place of `matchMedia`;
//   · a rectangle a script MEASURES off a zoomed element (getBoundingClientRect) is in window pixels, one it WRITES into a layer's style is in the layer's:
//     divide by `rectZoom()` (the speech bubbles' blockers, the debugger's tooltip, the kit picture's width); a size read off the WINDOW or the picture's
//     canvas divides by `textZoom()` (the overlay's marks, `uiSize()`). The two are the same number wherever an engine measures a zoomed element in window
//     pixels, which the boot asks it once (`rectZoom` is 1 on one that answers in the element's own). A canvas drawn inside a layer multiplies its
//     device pixels by `textZoom()` or it is stretched (the kit figure, the debrief's map, the wind graph).
// THE SWITCH: `TEXTSIZE.on`, OFF in this module, raised by the page's boot (main.ts → bootTextSize; `?textsize=0` = off: no factor, no class, the browser's
// own zoom keys, every rule as it was — `var(--tz, 1)` is 1). Never in the Team & kit picture's own window (an iframe is zoomed with the layer it sits in).
// It is a look, not a rule of the game: the picture's canvas, the cursor and every number the game reads are untouched, nothing here is in a recording, and
// the headless harness never boots it. Plain DOM; nothing at module level uses another module's exports.
export const TEXTSIZE = {
  /** the whole thing; off = the page as it was */
  on: false,
  /** the window the screens are laid out for: a larger one draws larger by the same ratio */
  ref: [1920, 1080] as [number, number],
  /** the most the window alone asks for */
  max: 3,
  /** the player's steps, each a multiple of the window's factor, and which of them is the one nothing is kept for */
  steps: [0.85, 1, 1.15, 1.3, 1.5], base: 1,
  /** no step takes the layout under this many of its own pixels */
  floor: [1200, 675] as [number, number],
  /** the browser's zoom keys step the size (off: they are only taken from the browser) */
  keys: true,
};
const LS = 'twopointsix.textsize', ID = 'textsize-css';
/** sent on the window when the step changes (a screen that draws the choice repaints) */
export const TEXT_EVENT = 'tps-textsize';
/** every layer of the page that carries words: the fight screen's, the cards', the screens laid over them */
const LAYERS = ['#overlay', '#equip', '#lcol', '#meters', '#log', '#objective', '#tabcard', '#alarm', '#checkpoint', '#journal', '#caption', '#timeline', '#panel', '#ptip', '#loading', '#menu', '#missions', '#brief', '#options', '#replaytag', '#fatal', '#kit-preview', '#tapebar', '#tapenote', '#tapebig', '#taperefuse'];
const CSS = `
html.tsz :is(${LAYERS.join(', ')}) { zoom: var(--tz, 1); }
html.tsz { touch-action: pan-x pan-y; }
`;

let step = TEXTSIZE.base, zoom = 1, booted = false, rectsInWindow = true;
const round = (x: number) => Math.round(x * 100) / 100;

/** the factor a window of w × h is drawn at on step `i` */
export function zoomFor(w: number, h: number, i: number = TEXTSIZE.base): number {
  const T = TEXTSIZE; if (!(w > 0 && h > 0)) return 1;
  const auto = Math.max(1, Math.min(T.max, w / T.ref[0], h / T.ref[1])), mul = T.steps[i] ?? 1, top = T.steps[T.steps.length - 1];
  if (!(mul > 1)) return round(auto * mul);
  // (the room over the window's own factor before the layout is under its floor, shared out between the larger steps when the largest asks for more)
  const room = Math.max(1, Math.min(w / T.floor[0], h / T.floor[1]) / auto);
  return round(auto * (1 + (mul - 1) * Math.min(1, (room - 1) / (top - 1))));
}
/** the factor the page's words are drawn at now (1 while the switch is off) */
export function textZoom(): number { return zoom; }
/** the step in force (`TEXTSIZE.base` = nothing chosen) */
export function textStep(): number { return step; }
/** what a rectangle MEASURED off an element in a zoomed layer is divided by to be in the layer's own pixels */
export function rectZoom(): number { return rectsInWindow ? zoom : 1; }
/** the window as a zoomed layer lays itself out in it */
export function uiSize(): [number, number] { return [window.innerWidth / zoom, window.innerHeight / zoom]; }
/** a media query's px widths and heights, as the real window has to be asked for a layer drawn at `z` */
export function scaledQuery(text: string, z: number): string {
  return z === 1 ? text : text.replace(/\(\s*((?:min|max)-(?:width|height))\s*:\s*([\d.]+)px\s*\)/g, (_m, f: string, n: string) => `(${f}: ${round(parseFloat(n) * z)}px)`);
}
/** `matchMedia(q).matches` for a layer: its widths and heights are the layer's pixels */
export function uiMatch(q: string): boolean { try { return window.matchMedia(scaledQuery(q, zoom)).matches; } catch { return false; } }

/** every `@media` rule in the page asks for the layer's pixels (its own text kept, so a factor of 1 writes it back) */
const asked = new WeakMap<object, string>();
function mediaRules() {
  if (typeof CSSMediaRule === 'undefined') return;
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSMediaRule) { let own = asked.get(r); if (own === undefined) { own = r.media.mediaText; asked.set(r, own); } const want = scaledQuery(own, zoom); if (r.media.mediaText !== want) r.media.mediaText = want; }
      const inner = (r as CSSGroupingRule).cssRules; if (inner) walk(inner);
    }
  };
  for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules); } catch { /* a sheet from elsewhere */ } }
}

/** every `@media` rule as written and as asked now (the page check reads it) */
function mediaAsked(): [string, string][] {
  const out: [string, string][] = []; if (typeof CSSMediaRule === 'undefined') return out;
  const walk = (rules: CSSRuleList) => { for (const r of Array.from(rules)) { if (r instanceof CSSMediaRule) out.push([asked.get(r) ?? r.media.mediaText, r.media.mediaText]); const inner = (r as CSSGroupingRule).cssRules; if (inner) walk(inner); } };
  for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules); } catch { /* a sheet from elsewhere */ } }
  return out;
}

function kept(): number {
  try { const v = globalThis.localStorage?.getItem(LS); if (v === null || v === undefined) return TEXTSIZE.base; const n = Number(v); return Number.isInteger(n) && n >= 0 && n < TEXTSIZE.steps.length ? n : TEXTSIZE.base; } catch { return TEXTSIZE.base; }
}
function apply() {
  if (!booted) return;
  const z = TEXTSIZE.on ? zoomFor(window.innerWidth, window.innerHeight, step) : 1, root = document.documentElement;
  if (z === zoom && root.classList.contains('tsz') === TEXTSIZE.on) return;   // (a resize that changes nothing; a new style sheet is the observer's)
  root.classList.toggle('tsz', TEXTSIZE.on);
  if (TEXTSIZE.on) root.style.setProperty('--tz', String(z)); else root.style.removeProperty('--tz');
  zoom = z; mediaRules();
}
/** the step is `i` (clamped), kept for this machine; null = nothing chosen, and nothing kept */
export function setTextStep(i: number | null) {
  const T = TEXTSIZE; if (!T.on || (i !== null && !Number.isFinite(i))) return;
  step = i === null ? T.base : Math.max(0, Math.min(T.steps.length - 1, Math.round(i)));
  try { if (step === T.base) globalThis.localStorage?.removeItem(LS); else globalThis.localStorage?.setItem(LS, String(step)); } catch { /* no store */ }
  apply();
  try { window.dispatchEvent(new Event(TEXT_EVENT)); } catch { /* no window */ }
}

/** the keys a browser zooms its page with: +1 larger, -1 smaller, 0 back to the window's, null any other key */
export function zoomKey(e: { key?: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): 1 | -1 | 0 | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') return 1;
  if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') return -1;
  if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') return 0;
  return null;
}

/** the page's boot (main.ts), before anything is drawn: the switch off the URL, this machine's step, the rules and the listeners. `child` = the Team & kit
 *  picture's own window, which is never sized by itself. */
export function bootTextSize(q: URLSearchParams, child = false) {
  if (booted || typeof window === 'undefined' || typeof document === 'undefined' || !document.documentElement?.classList) return;
  booted = true; TEXTSIZE.on = !child && q.get('textsize') !== '0';
  (window as unknown as { __textsize?: unknown }).__textsize = { get on() { return TEXTSIZE.on; }, get zoom() { return zoom; }, get step() { return step; }, set: setTextStep, layers: LAYERS, table: TEXTSIZE, want: zoomFor, media: mediaAsked };
  if (!TEXTSIZE.on) return;
  step = kept();
  const s = document.createElement('style'); s.id = ID; s.textContent = CSS; document.head.appendChild(s);
  // which pixels this engine measures a zoomed element in (asked once, off a box nobody sees)
  try { const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:1px;zoom:2;visibility:hidden;pointer-events:none'; document.documentElement.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); rectsInWindow = !(w > 0) || w > 150; } catch { /* as the standard has it */ }
  apply();
  window.addEventListener('resize', apply);
  // a style sheet that joins the page later (each screen puts its own rules in when it first opens) has its `@media` rules asked the same way
  if (typeof MutationObserver === 'function') { const mo = new MutationObserver(ms => { if (ms.some(m => Array.from(m.addedNodes).some(n => n.nodeName === 'STYLE' || n.nodeName === 'LINK'))) mediaRules(); }); mo.observe(document.head, { childList: true }); if (document.body) mo.observe(document.body, { childList: true }); }
  // the browser's zoom is the page's: its keys step the size here, Ctrl + wheel is left to whatever is under the cursor (the picture: game/input.ts, where a pinch zooms the camera), a pinch is nothing
  window.addEventListener('keydown', e => {
    const d = zoomKey(e); if (d === null) return;
    e.preventDefault(); if (e.repeat || !TEXTSIZE.keys) return;
    setTextStep(d === 0 ? null : step + d);
  }, { capture: true });
  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { capture: true, passive: false });   // (a pinch on a trackpad arrives as one of these too)
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) window.addEventListener(g, e => e.preventDefault(), { capture: true });
}
