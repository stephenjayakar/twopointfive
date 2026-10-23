// Tweak panel = the debugger (backtick; Tab is the game's): sliders / toggles / buttons / read-outs bound to live settings. The game builds ONE of these on #panel (bindings.ts) as a TWO-LEVEL panel —
// SYSTEMS down a left rail (Frame · Direct · Indirect · …), and inside the selected system collapsible SECTIONS with a live one-line summary and, where a
// shipped-defaults table exists, a '↺' reset — with a status strip (preset · fps · gpu ∪) and a search box that searches EVERY system at once (hits listed under
// their 'System ▸ Section' path; Enter jumps to the first). The viewer / editor build several flat ones (property sheets, the gear menu, the 'all knobs' list) on
// their own containers — hence the root / header / persistence options, `clear()` for sheets rebuilt on a context change, and `number()`: a drag-to-scrub field.
// A panel nobody called `system()` on stays FLAT (sections straight into the body, the DOM the workbench's stylesheet expects: .phead · .pbody › h3 + .sbody › .row).
// Rows built while `panel.advanced` is true (or inside an advanced section) are A/B knobs: hidden until 'all knobs' is ticked or a search finds them.
// The game panel shows ONE hover tip of its own (#ptip) in place of the browser's: whatever a row / button / header carried as its `title`, and the full text of
// anything the 372 px column cut short with an ellipsis (the status strip, a page's subtitle, a section's live summary, a long label) — at once, wrapped, readable.
import { rectZoom, uiSize } from './textsize';
import { gameCode } from '../host/keymap';   // (the player's own keys: the panel's key is where he put it)
type Getter<T> = () => T; type Setter<T> = (v: T) => void;
type Rf = (() => void) & { el?: HTMLElement; page?: HTMLElement | null };
/** localStorage behind try/catch (a private window, a disabled store, a full quota: the panel builds and works, nothing persists) and JSON that must be what we
 *  wrote (a corrupt value — a half-written key, another build's shape — falls back to the default instead of throwing in the constructor: that was a boot loop, review U9.3) */
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* nothing persists */ } };
function lsJson<T>(k: string, ok: (x: unknown) => boolean, def: T): T { const raw = lsGet(k); if (!raw) return def; try { const j = JSON.parse(raw); return ok(j) ? j as T : def; } catch { return def; } }
const isObj = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);

export interface PanelOpts {
  /** container (default: #panel) */
  root?: HTMLElement;
  /** search box + 'all knobs' switch on top (default true) */
  header?: boolean;
  /** localStorage key for the sections' open / closed state. Absent = the GAME's panel (systems rail, status strip, `twopointsix.panel`); null = nothing persists;
   *  a string = per-section explicit choices under that key (a section never touched follows its `open` argument on every build) */
  persistKey?: string | null;
  /** live refresh period while visible (ms, default 400) */
  refreshMs?: number;
}
/** a shipped default: the value, or a getter when the row follows a moving target (the long gun's carriage on show) */
export type Def<T> = T | (() => T);
const defOf = <T>(d: Def<T>): T => typeof d === 'function' ? (d as () => T)() : d;
export interface NumOpts {
  step?: number; min?: number; max?: number;
  /** the shipped value: rows whose value differs get the 'changed' look and a revert dot */
  def?: Def<number>;
  title?: string;
  /** decimals shown (default: from step) */
  digits?: number;
  /** field width in ch (default 7) */
  width?: number;
}
/** what a section can carry beyond its rows: its first-run open state, whether the whole thing is A/B-only, a live one-liner for its header (shown while it is
 *  collapsed — open, its own read-out rows say more), a reset that puts a shipped-defaults table back, a tooltip on the header */
export interface SectionOpts { open?: boolean; advanced?: boolean; summary?: () => string; reset?: () => void; resetTitle?: string; title?: string }
export interface SystemOpts { /** one or two glyphs for the rail */ icon?: string; /** the rail's short label (default: the name's first word) */ short?: string; title?: string }

interface SysRec { name: string; btn: HTMLElement; page: HTMLElement; empty: HTMLElement; secs: SecRec[] }
interface SecRec { key: string; name: string; sys: SysRec | null; wrap: HTMLElement | null; head: HTMLElement; nameEl: HTMLElement | null; sumEl: HTMLElement | null; body: HTMLElement; advanced: boolean; summary?: () => string; paint: () => void }
const NAV_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, BracketLeft: -1, BracketRight: 1 };
/** the elements the panel's stylesheet cuts short with an ellipsis (index.html): hovering one that IS cut shows its whole text */
const TRUNC_SEL = '.pstat, .ptitle span, .pshead .nm, .pshead .sum, .row > label, .prail .sys span';
const TIP_DELAY_MS = 350;   // a cold tip waits this long (sweeping the pointer across the panel flashes nothing); once one is up the next follows the pointer at once
const TIP_WARM_MS = 300;    // … and for this long after one hid (the pixel between two rows, a pass over a section header)
/** an Element test that survives hosts without the DOM classes (the headless probes' fake document defines no HTMLElement) */
const isEl = (x: unknown): x is HTMLElement => !!x && typeof x === 'object' && (x as Node).nodeType === 1 && typeof (x as HTMLElement).matches === 'function';
/** a control that keeps its own keys from Input (game/input.ts typingTarget: the same test) */
const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export class Panel {
  root: HTMLElement;
  /** rows built while this is true are ADVANCED (A/B knobs): hidden unless 'all knobs' is on or a search hits them. bindings.ts flips it round its knob runs. */
  advanced = false;
  visible = false;
  private refreshers: Rf[] = [];
  private sections = new Map<string, SecRec>();
  private secOfBody = new Map<HTMLElement, SecRec>();
  private systems: SysRec[] = []; private curSys: SysRec | null = null; private activeSys: SysRec | null = null;
  private body: HTMLElement; private rail: HTMLElement | null = null; private statEl: HTMLElement | null = null; private hitsEl: HTMLElement | null = null;
  private search: HTMLInputElement | null = null; private allBox: HTMLInputElement | null = null;
  private open: Set<string>; private showAll: boolean;
  private game: boolean; private persistKey: string | null; private explicit: Record<string, boolean> = {};
  private state: { sys?: string; open?: Record<string, boolean>; scroll?: Record<string, number> } = {};
  private statusGet: (() => string) | null = null; private hovered = false; private saveT = 0;
  private tip: HTMLElement | null = null; private tipFor: HTMLElement | null = null; private tipPending: HTMLElement | null = null; private tipT = 0; private tipWarmUntil = 0;

  constructor(opts: PanelOpts = {}) {
    this.root = opts.root ?? document.getElementById('panel')!;
    this.game = opts.persistKey === undefined; this.persistKey = this.game ? 'twopointsix.panel' : opts.persistKey ?? null;
    // header: (game) a status strip the frame loop feeds — preset · fps · gpu ∪, so the panel is worth having up with the read-out off — then the search box that filters every row of every
    // system by its label / tooltip / section / system words, and the 'all knobs' switch (the A/B rows and the rarely-touched sections stay out of the way until asked for). All persisted.
    if (this.game) { this.state = lsJson('twopointsix.panel', isObj, {}); this.open = new Set(); this.showAll = lsGet('twopointsix.panelAll') === '1'; }
    else { this.open = new Set(); this.showAll = true; if (this.persistKey) this.explicit = lsJson<Record<string, boolean>>(this.persistKey, isObj, {}); }
    if (opts.header !== false) {
      const head = document.createElement('div'); head.className = 'phead';
      if (this.game) { this.statEl = document.createElement('div'); this.statEl.className = 'pstat'; head.append(this.statEl); }
      const line = document.createElement('div'); line.className = 'psearch';
      const search = this.search = document.createElement('input'); search.type = 'search'; search.placeholder = this.game ? 'search every knob…   (hover + type · ←/→ systems)' : 'search every knob…'; search.spellcheck = false;
      search.oninput = () => this.applyFilter();
      search.onkeydown = e => { if (e.key === 'Escape') { search.value = ''; this.applyFilter(); search.blur(); } else if (e.key === 'Enter') { this.jumpToFirstHit(); e.preventDefault(); } e.stopPropagation(); };   // typing here must not drive the game
      line.append(search);
      if (this.game) {
        const lab = document.createElement('label'); lab.className = 'all'; lab.title = 'show the A/B-only knobs and the rarely touched sections too (kept per machine)'; const allBox = this.allBox = document.createElement('input'); allBox.type = 'checkbox'; allBox.checked = this.showAll;
        allBox.onchange = () => { this.showAll = allBox.checked; lsSet('twopointsix.panelAll', this.showAll ? '1' : '0'); this.applyFilter(); allBox.blur(); };
        lab.append(allBox, document.createTextNode(' all knobs')); line.append(lab);
        this.hitsEl = document.createElement('div'); this.hitsEl.className = 'phits';
      }
      head.append(line); if (this.hitsEl) head.append(this.hitsEl);
      this.root.appendChild(head);
    }
    this.body = document.createElement('div'); this.body.className = 'pbody';
    if (this.game) {
      const main = document.createElement('div'); main.className = 'pmain';
      this.rail = document.createElement('div'); this.rail.className = 'prail'; main.append(this.rail, this.body); this.root.appendChild(main);
      this.body.addEventListener('scroll', () => { if (!this.activeSys || this.searching) return; (this.state.scroll ??= {})[this.activeSys.name] = Math.round(this.body.scrollTop); this.saveSoon(); }, { passive: true } as AddEventListenerOptions);
      this.root.addEventListener('mouseenter', () => { this.hovered = true; }); this.root.addEventListener('mouseleave', () => { this.hovered = false; this.hideTip(); });
      // backtick opens and shuts the panel (main.ts's hotkey). A FIELD of the panel holding the keyboard (the search box, a slider just dragged, a list, a number) keeps its keys from
      // Input, so the hotkey never sees the press: shut it from here, before the field types the character. Anywhere else the press reaches Input once and the hotkey toggles.
      this.root.addEventListener('keydown', e => { if (gameCode(e.code) !== 'Backquote' || (e.code !== 'Backquote' && e.code !== 'Backslash') || e.metaKey || e.ctrlKey || e.altKey || !isField(e.target)) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat && this.visible) this.toggle(); }, { capture: true });
      this.installTips();
    } else this.root.appendChild(this.body);
    setInterval(() => { if (this.visible) this.refresh(); }, opts.refreshMs ?? 400);
  }
  toggle() {
    this.visible = !this.visible; this.root.classList.toggle('hidden', !this.visible); document.body.classList.toggle('panel-open', this.visible);
    if (this.visible) { if (this.game && this.systems.length) this.go(this.activeSys ?? this.systems.find(s => s.name === this.state.sys) ?? this.systems[0], false); else { this.refresh(); this.applyFilter(); } }
    else { this.hovered = false; this.hideTip(); const a = document.activeElement; if (isEl(a) && this.root.contains(a)) a.blur(); }   // (shut with a control focused: hand the keyboard back; and no mouseleave will come for a panel that vanished under the pointer)
  }
  // ---------------------------------------------------------------- the hover tip (game panel): the browser's own tooltips are slow, unwrapped and cannot show what an ellipsis hid
  private installTips() {
    const tip = this.tip = document.createElement('div'); tip.id = 'ptip'; tip.style.display = 'none'; document.body.appendChild(tip);
    this.root.addEventListener('mouseover', e => {
      const a = this.tipAnchor(e.target);
      if (a && (a.el === this.tipFor || a.el === this.tipPending)) return;   // still over the same thing (its padding, its slider, its value): the shown tip stays, a pending one keeps counting
      const warm = this.tip!.style.display !== 'none' || performance.now() < this.tipWarmUntil; this.hideTip();
      if (!a) return;
      this.tipPending = a.el;
      if (warm) this.showTip(a.el, a.text); else this.tipT = setTimeout(() => this.showTip(a.el, a.text), TIP_DELAY_MS) as unknown as number;
    });
    this.root.addEventListener('mousedown', () => this.hideTip());
    this.body.addEventListener('scroll', () => this.hideTip(), { passive: true } as AddEventListenerOptions);
    this.rail?.addEventListener('scroll', () => this.hideTip(), { passive: true } as AddEventListenerOptions);
  }
  /** what to say for the thing under the pointer: the nearest ancestor that carried a `title` (moved to data-tip on first sight, so the browser's tip never doubles ours) or that
   *  the stylesheet cut short. A cut LABEL defers to its row when the row has a description (the row's text leads with the full label anyway), so crossing one row never
   *  swaps one tip for another; a tip that would only repeat what is fully on show says nothing. */
  private tipAnchor(t: EventTarget | null): { el: HTMLElement; text: string } | null {
    for (let el = isEl(t) ? t : null; el && el !== this.root; el = el.parentElement) {
      if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
      const shown = (el.textContent ?? '').trim(); const cut = el.matches(TRUNC_SEL) && el.scrollWidth > el.clientWidth + 1;
      const own = el.dataset.tip;
      if (own && (cut || own.trim() !== shown)) return { el, text: own };
      if (cut) {
        const p = el.parentElement; if (p && p !== this.root && p.title) { p.dataset.tip = p.title; p.removeAttribute('title'); }
        if (p && p !== this.root && p.dataset.tip) return { el: p, text: p.dataset.tip };
        return { el, text: shown };
      }
    }
    return null;
  }
  private showTip(el: HTMLElement, text: string) {
    const tip = this.tip; this.tipPending = null; if (!tip || !this.visible || !el.isConnected || el.getClientRects().length === 0) return;   // (gone, or filtered / paged out of sight since the hover began)
    tip.style.left = '0px'; tip.style.top = '0px'; tip.textContent = text; tip.style.display = 'block'; this.tipFor = el;   // (measured from the corner: the wrap width, hence the height, is the final one)
    const tz = rectZoom(), b = el.getBoundingClientRect(), r = { left: b.left / tz, top: b.top / tz, bottom: b.bottom / tz }, [vw, vh] = uiSize(); const w = tip.offsetWidth, h = tip.offsetHeight;   // (measured in the window's pixels, placed in the tip's own: ui/textsize.ts)
    const x = Math.max(6, Math.min(r.left, vw - w - 6));
    let y = r.bottom + 5; if (y + h > vh - 6) y = Math.max(6, r.top - h - 5);   // under the thing, or over it at the foot of the screen
    tip.style.left = `${Math.round(x)}px`; tip.style.top = `${Math.round(y)}px`;
  }
  /** drop the tip (shown or pending); a tip that WAS showing leaves a short warm spell so the next thing hovered answers at once (the 1 px between two rows is not a cold start) */
  private hideTip() {
    clearTimeout(this.tipT); this.tipPending = null;
    if (this.tip && this.tip.style.display !== 'none') { this.tipWarmUntil = performance.now() + TIP_WARM_MS; this.tip.style.display = 'none'; }
    this.tipFor = null;
  }
  /** run every live read-out / control getter (rows on a system page that is not showing are skipped: five hundred getters ten times a second was the old cost) */
  refresh() {
    const searching = this.searching;
    for (const r of this.refreshers) { if (r.page && !searching && this.activeSys && r.page !== this.activeSys.page) continue; try { r(); } catch { /* a getter over an object that went away (respawn): the next rebuild drops it */ } }
    if (this.statEl && this.statusGet) { try { this.statEl.textContent = this.statusGet(); } catch { /* */ } }
    for (const s of this.sections.values()) { if (!s.sumEl || !s.summary) continue; if (s.sys && !searching && s.sys !== this.activeSys) continue; try { s.sumEl.textContent = oneLine(s.summary()); } catch { s.sumEl.textContent = ''; } }
    if (this.tip && this.tipFor && !this.tipFor.dataset.tip) this.tip.textContent = (this.tipFor.textContent ?? '').trim();   // (a tip over a live read-out — the status strip, a summary — follows it)
  }
  /** Drop refreshers whose controls were removed from the DOM (sections rebuilt by their owner, e.g. the viewer's selection box). */
  prune() { this.refreshers = this.refreshers.filter(r => !r.el || document.contains(r.el)); }
  /** Empty the panel: every section, row and refresher (the viewer's property sheet is rebuilt from nothing on each scene / variant / selection change). */
  clear() { this.body.innerHTML = ''; if (this.rail) this.rail.innerHTML = ''; this.sections.clear(); this.secOfBody.clear(); this.systems.length = 0; this.curSys = this.activeSys = null; this.refreshers.length = 0; if (!this.game) this.open.clear(); }
  /** True while the search box has focus (main.ts: let Esc / keys go to it, not the game). */
  get typing() { return !!this.search && document.activeElement === this.search; }
  /** Put the cursor in the search box (the viewer's 'all knobs' overlay opens straight into it). */
  focusSearch() { this.search?.focus(); this.search?.select(); }
  /** the status strip's text (bindings.ts: preset · scale · fps · gpu ∪), refreshed with the rows */
  setStatus(get: () => string) { this.statusGet = get; }
  private get searching() { return !!this.search && this.search.value.trim().length > 0; }

  // ---------------------------------------------------------------- systems (the rail) — game panel only; a flat panel ignores the call and keeps building into its body
  /** Start a SYSTEM: a rail entry + a page; every section() after this lands on that page until the next system(). */
  system(name: string, opts: SystemOpts = {}): void {
    if (!this.game || !this.rail) return;
    const ex = this.systems.find(s => s.name === name); if (ex) { this.curSys = ex; return; }
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sys'; btn.title = opts.title ? `${name} — ${opts.title}` : name;
    const ic = document.createElement('i'); ic.textContent = opts.icon ?? name[0]; const sh = document.createElement('span'); sh.textContent = opts.short ?? name.split(/[\s&/—-]+/)[0]; btn.append(ic, sh);
    const page = document.createElement('div'); page.className = 'ppage'; page.style.display = 'none';
    const ttl = document.createElement('div'); ttl.className = 'ptitle'; ttl.textContent = name; if (opts.title) { const sub = document.createElement('span'); sub.textContent = opts.title; ttl.append(sub); } page.append(ttl);
    const empty = document.createElement('div'); empty.className = 'pempty'; empty.style.display = 'none'; page.append(empty);
    const sys: SysRec = { name, btn, page, empty, secs: [] };
    btn.onclick = () => { this.go(sys); btn.blur(); };   // (blur: a rail click must not leave the keyboard parked in the panel — the game gets its keys straight back)
    this.rail.appendChild(btn); this.body.appendChild(page); this.systems.push(sys); this.curSys = sys;
    if (!this.activeSys && (this.state.sys === name || (!this.state.sys && this.systems.length === 1))) this.go(sys, false);
    else if (this.activeSys && this.state.sys === name) this.go(sys, false);
  }
  /** show a system's page (and remember it); `user` = a person did it: persist + restore that page's scroll */
  private go(sys: SysRec, user = true) {
    if (this.activeSys && this.activeSys !== sys && user && !this.searching) (this.state.scroll ??= {})[this.activeSys.name] = Math.round(this.body.scrollTop);
    this.activeSys = sys; this.hideTip();
    for (const s of this.systems) { const on = s === sys; s.btn.classList.toggle('on', on); if (!this.searching) s.page.style.display = on ? '' : 'none'; }
    this.state.sys = sys.name; if (user) this.saveSoon();
    this.applyFilter(); this.refresh();
    const y = this.state.scroll?.[sys.name] ?? 0; this.body.scrollTop = this.searching ? 0 : y;
  }
  /** open the panel on the system of this name (a page that is about one system — the sneak lab — opens on it) */
  show(name: string) { const s = this.systems.find(x => x.name === name); if (!s) return; if (!this.visible) this.toggle(); this.go(s, false); }
  /** the rail's neighbour in direction ±1 (wrapping) */
  private step(dir: number) { if (!this.systems.length) return; const i = Math.max(0, this.systems.indexOf(this.activeSys!)); this.go(this.systems[(i + dir + this.systems.length) % this.systems.length]); }
  /** 'System ▸ Section' of a section body handed out by section() (the inventory probe and the search results word rows by it) */
  pathOf(sec: HTMLElement): string { const s = this.secOfBody.get(sec); return !s ? '' : s.sys ? `${s.sys.name} ▸ ${s.name}` : s.name; }
  /** The keyboard, offered by main.ts through Input's veto BEFORE the game reads a key: with the panel up and the pointer over it (or a control in it focused) ← / → and [ / ]
   *  walk the rail and a typed character opens the search with it; returns true when the key was the panel's (the game then never sees it). Backtick / Esc stay main.ts's. */
  onKey(e: KeyboardEvent): boolean {
    if (!this.visible || !this.game) return false;
    const inPanel = e.target instanceof Node && this.root.contains(e.target); if (!this.hovered && !inPanel) return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const t = e.target; const typingIn = (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'search')) || t instanceof HTMLSelectElement;   // (a field being typed in / a list being picked keeps its own keys)
    const nav = NAV_KEYS[e.code];
    if (nav && !typingIn && !(t instanceof HTMLInputElement && t.type === 'range')) { this.step(nav); e.preventDefault(); return true; }   // (← / → on a focused slider still nudge it)
    if (gameCode(e.code) === 'Backquote') return false;   // (the panel's own key: main.ts's hotkey shuts it — never a character for the search)
    if (e.key.length === 1 && !typingIn && this.search && e.code !== 'Space') { this.search.focus(); this.search.value += e.key; this.applyFilter(); e.preventDefault(); return true; }   // (Space stays the game's one action key even over the panel)
    return false;
  }
  private saveSoon() { if (!this.game) return; clearTimeout(this.saveT); this.saveT = setTimeout(() => lsSet('twopointsix.panel', JSON.stringify(this.state)), 250) as unknown as number; }

  // ---------------------------------------------------------------- sections
  /** `open` is only the first-run default (the user's own open/closed choice persists); `advanced` sections hide unless "all knobs" is on or a search matches inside them.
   *  The object form adds a live header summary and a '↺' that puts a shipped-defaults table back. */
  section(name: string, open?: boolean | SectionOpts, advanced?: boolean): HTMLElement {
    const o: SectionOpts = typeof open === 'object' ? open : { open, advanced };
    const sys = this.game ? this.curSys : null; const key = sys ? `${sys.name}/${name}` : name;
    const had = this.sections.get(key); if (had) return had.body;
    const adv = !!o.advanced; const openDef = o.open ?? true;
    if (this.game) { const ex = this.state.open?.[key]; if (ex === undefined ? openDef : ex) this.open.add(key); }
    else if (key in this.explicit ? this.explicit[key] : openDef) this.open.add(key);
    const h = document.createElement('h3'); const body = document.createElement('div'); body.className = 'sbody';
    let wrap: HTMLElement | null = null, nameEl: HTMLElement | null = null, sumEl: HTMLElement | null = null;
    if (this.game) {   // the rich header: caret · NAME · live summary (right, muted) · ↺
      wrap = document.createElement('div'); wrap.className = 'psec' + (adv ? ' advsec' : '');
      h.className = 'pshead'; if (o.title) h.title = o.title;
      const caret = document.createElement('b'); caret.className = 'caret'; nameEl = document.createElement('span'); nameEl.className = 'nm'; nameEl.textContent = name;
      sumEl = document.createElement('span'); sumEl.className = 'sum'; h.append(caret, nameEl, sumEl);
      if (o.reset) { const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'rst'; rb.textContent = '↺'; rb.title = o.resetTitle ?? 'back to the shipped values'; rb.onclick = e => { e.stopPropagation(); o.reset!(); this.refresh(); rb.blur(); }; h.append(rb); }
      wrap.append(h, body); (sys ? sys.page : this.body).appendChild(wrap);
    } else { this.body.appendChild(h); this.body.appendChild(body); }
    const paint = () => { const on = this.open.has(key); body.style.display = on ? 'block' : 'none'; if (nameEl) { h.classList.toggle('open', on); wrap!.classList.toggle('open', on); (h.firstChild as HTMLElement).textContent = on ? '▾' : '▸'; } else { h.textContent = (on ? '▾ ' : '▸ ') + name; h.classList.toggle('open', on); } };
    const rec: SecRec = { key, name, sys, wrap, head: h, nameEl, sumEl, body, advanced: adv, summary: o.summary, paint };
    h.onclick = () => {
      if (this.searching) return;   // (under a search every hit section is held open; the click would only fight it)
      if (this.open.has(key)) this.open.delete(key); else this.open.add(key);
      if (this.game) { (this.state.open ??= {})[key] = this.open.has(key); this.saveSoon(); }
      else if (this.persistKey) { this.explicit[key] = this.open.has(key); lsSet(this.persistKey, JSON.stringify(this.explicit)); }
      paint(); this.refresh();
    };
    paint(); this.sections.set(key, rec); this.secOfBody.set(body, rec); sys?.secs.push(rec); return body;
  }
  /** Search: only rows whose label / tooltip / section / system words contain every typed word, across EVERY system (hit sections held open under their 'System ▸ Section' path, the rest gone);
   *  no query: the active system's page, sections per their open state, advanced rows / sections hidden unless "all knobs". */
  private applyFilter() {
    const q = this.search ? this.search.value.trim().toLowerCase() : ''; const words = q ? q.split(/\s+/) : [];
    this.root.classList.toggle('searching', !!words.length); this.hideTip();
    let hits = 0, hitSecs = 0; const sysHits = new Map<SysRec, number>();
    for (const s of this.sections.values()) {
      const path = s.sys ? `${s.sys.name} ${s.name}` : s.name; let n = 0, shown = 0;
      for (const r of Array.from(s.body.children) as HTMLElement[]) {
        const adv = r.classList.contains('adv') || s.advanced;
        let show: boolean;
        if (words.length) { const hay = ((r.querySelector('label')?.textContent ?? r.textContent ?? '') + ' ' + (r.title || r.dataset.tip || '') + ' ' + path).toLowerCase(); show = words.every(w => hay.includes(w)); if (show) n++; }   // (a row hovered once carries its description in data-tip: tipAnchor)
        else show = this.showAll || !adv;
        r.style.display = show ? '' : 'none'; if (show) shown++;
      }
      const secVisible = words.length ? n > 0 : shown > 0 && (this.showAll || !s.advanced);
      const box = s.wrap ?? s.head; box.style.display = secVisible ? '' : 'none'; if (!s.wrap) s.body.style.display = !secVisible ? 'none' : words.length ? 'block' : (this.open.has(s.key) ? 'block' : 'none');
      else s.body.style.display = words.length ? 'block' : (this.open.has(s.key) ? 'block' : 'none');
      if (s.nameEl) s.nameEl.textContent = words.length && s.sys ? `${s.sys.name} ▸ ${s.name}` : s.name;
      if (words.length && n) { hits += n; hitSecs++; if (s.sys) sysHits.set(s.sys, (sysHits.get(s.sys) ?? 0) + n); }
      if (!words.length && s.sys) sysHits.set(s.sys, (sysHits.get(s.sys) ?? 0) + (secVisible ? 1 : 0));
    }
    for (const sys of this.systems) {
      const n = sysHits.get(sys) ?? 0;
      if (words.length) { sys.page.style.display = n ? '' : 'none'; sys.empty.style.display = 'none'; sys.btn.classList.toggle('hit', n > 0); sys.btn.classList.remove('dim'); }
      else { sys.page.style.display = sys === this.activeSys ? '' : 'none'; sys.btn.classList.remove('hit'); sys.btn.classList.toggle('dim', n === 0); sys.empty.style.display = n ? 'none' : ''; if (!n) sys.empty.textContent = `everything on this page is an A/B knob or a rarely-touched section — tick 'all knobs' above`; }
    }
    if (this.hitsEl) this.hitsEl.textContent = words.length ? (hits ? `${hits} row${hits === 1 ? '' : 's'} in ${hitSecs} section${hitSecs === 1 ? '' : 's'} of ${[...sysHits.keys()].filter(k => sysHits.get(k)).length} system(s) · Enter opens the first` : 'nothing matches') : '';
    if (words.length) this.refresh();   // (rows of other systems are on show now: their read-outs want a fresh value)
  }
  /** Enter in the search box: open the first hit's system + section, clear the query, scroll the row into view and flash it */
  private jumpToFirstHit() {
    if (!this.searching) return;
    for (const s of (this.systems.length ? this.systems.flatMap(x => x.secs) : [...this.sections.values()])) {
      const box = s.wrap ?? s.head; if (box.style.display === 'none') continue;
      const row = (Array.from(s.body.children) as HTMLElement[]).find(r => r.style.display !== 'none'); if (!row) continue;
      this.search!.value = ''; this.open.add(s.key); if (this.game) { (this.state.open ??= {})[s.key] = true; this.saveSoon(); }
      if (row.classList.contains('adv') || s.advanced) { this.showAll = true; if (this.allBox) this.allBox.checked = true; lsSet('twopointsix.panelAll', '1'); }   // (an A/B row asked for by name: show its kind from now on, or it vanishes the moment the query clears)
      s.paint(); if (s.sys) this.go(s.sys); else this.applyFilter();
      this.search!.blur(); row.scrollIntoView?.({ block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1400);
      return;
    }
  }
  private row(sec: HTMLElement, label: string, title?: string): HTMLElement {
    const r = document.createElement('div'); r.className = this.advanced ? 'row adv' : 'row'; const l = document.createElement('label'); l.textContent = label; if (title) r.title = `${label} — ${title}`; else if (!this.game) l.title = label; r.appendChild(l); sec.appendChild(r); return r;   // (the game panel's own tip reads the row's title — led by the label, so a cut label is whole in it — or the cut label's text; the flat panels keep the browser's)
  }
  private pageOf(el: HTMLElement | null): HTMLElement | null { for (let p: HTMLElement | null = el; p; p = p.parentElement) { if (p.classList?.contains('ppage')) return p; if (p === this.root) break; } return null; }
  /** register a refresher of your own (a custom row): it runs with the panel's, and prune() / clear() drop it with its element */
  keep(rf: Rf, el: HTMLElement) { rf.el = el; rf.page = this.game ? this.pageOf(el) : null; this.refreshers.push(rf); }
  /** the revert dot at the end of a row: visible (and the row tinted) while the value is off its shipped default; a click puts the default back */
  private revertDot(r: HTMLElement, isChanged: () => boolean, revert: () => void): () => void {
    const d = document.createElement('span'); d.className = 'rev'; d.textContent = '●'; d.title = 'revert to the shipped value'; d.onclick = e => { e.stopPropagation(); revert(); this.refresh(); }; r.appendChild(d);
    return () => { const c = isChanged(); r.classList.toggle('changed', c); d.style.visibility = c ? 'visible' : 'hidden'; };
  }
  slider(sec: HTMLElement, label: string, min: number, max: number, step: number, get: Getter<number>, set: Setter<number>, title?: string, def?: Def<number>) {
    const r = this.row(sec, label, title); r.classList.add('sliderrow'); const inp = document.createElement('input'); inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step);
    const val = document.createElement('span'); val.className = 'val';
    const fmt = (v: number) => (Math.abs(step) >= 1 ? v.toFixed(0) : Math.abs(step) >= 0.1 ? v.toFixed(1) : Math.abs(step) >= 0.01 ? v.toFixed(2) : v.toFixed(3));
    r.appendChild(inp); r.appendChild(val);
    const mark = def === undefined ? () => {} : this.revertDot(r, () => Math.abs(get() - defOf(def)) > Math.max(1e-6, Math.abs(step) * 0.5), () => set(defOf(def)));
    inp.oninput = () => { const v = parseFloat(inp.value); set(v); val.textContent = fmt(v); mark(); };
    inp.onchange = () => { if (this.game) inp.blur(); };   // (a released slider hands the keyboard back to the game; the viewer's sheets keep their old manners)
    const rf = () => { if (document.activeElement !== inp) { const v = get(); inp.value = String(v); val.textContent = fmt(v); } mark(); };
    rf(); this.keep(rf, inp); return inp;
  }
  /** A numeric field for values with no natural bounds (offsets, sizes, rates): shows the number; DRAG sideways on it to scrub (one `step` per 2 px; Shift = fine ×0.1,
   *  Alt / Ctrl = coarse ×10), CLICK to type a value (Enter / blur commits, Esc cancels), ↑ / ↓ step it while typing (same modifiers). min / max clamp if given.
   *  With `def` the row shows when it is off the shipped value and grows a revert dot. */
  number(sec: HTMLElement, label: string, get: Getter<number>, set: Setter<number>, o: NumOpts = {}) {
    const r = this.row(sec, label, o.title); r.classList.add('numrow');
    const f = this.numField(get, set, o, () => mark()); r.appendChild(f.el);
    const def = o.def; const mark = def === undefined ? () => {} : this.revertDot(r, () => Math.abs(get() - defOf(def)) > Math.max(1e-7, (o.step ?? 0.01) * 0.5), () => set(defOf(def)));
    const rf = () => { f.paint(); mark(); }; rf(); this.keep(rf, f.el); return f.el;
  }
  /** Several numeric fields on one row (a vector: off.xyz, rot.xyz, an rgb glow) — each scrubs / types like number(); `defs` per component for the revert dot (reverts all);
   *  `steps` per component when they are not alike (a foot spot: metres, metres, degrees). */
  numbers(sec: HTMLElement, label: string, n: number, get: (i: number) => number, set: (i: number, v: number) => void, o: NumOpts & { defs?: Def<number[]>; names?: string[]; steps?: number[] } = {}) {
    const r = this.row(sec, label, o.title); r.classList.add('numrow', 'vecrow');
    const stepOf = (i: number) => o.steps?.[i] ?? o.step ?? 0.01;
    const fields = Array.from({ length: n }, (_, i) => { const f = this.numField(() => get(i), v => set(i, v), { ...o, step: stepOf(i), width: o.width ?? 5 }, () => mark()); if (o.names?.[i]) f.el.title = `${o.names[i]}${o.title ? ' · ' + o.title : ''}`; r.appendChild(f.el); return f; });
    const defs = o.defs;
    const mark = !defs ? () => {} : this.revertDot(r, () => defOf(defs).some((d, i) => Math.abs(get(i) - d) > Math.max(1e-7, stepOf(i) * 0.5)), () => defOf(defs).forEach((d, i) => set(i, d)));
    const rf = () => { for (const f of fields) f.paint(); mark(); }; rf(); this.keep(rf, r); return r;
  }
  private numField(get: Getter<number>, set: Setter<number>, o: NumOpts, after: () => void): { el: HTMLInputElement; paint: () => void } {
    const step = o.step ?? 0.01; const digits = o.digits ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : step >= 0.001 ? 3 : 4);
    const clampV = (v: number) => Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'num'; inp.spellcheck = false; inp.inputMode = 'decimal'; inp.style.width = `${o.width ?? 7}ch`;
    if (o.title) inp.title = o.title;
    let dragging = false;
    const fmt = (v: number) => Number.isFinite(v) ? v.toFixed(digits) : String(v);
    const paint = () => { if (document.activeElement !== inp && !dragging) inp.value = fmt(get()); };
    const commit = (v: number) => { if (!Number.isFinite(v)) return; set(clampV(+v.toFixed(6))); after(); };
    const gain = (e: MouseEvent | KeyboardEvent) => e.shiftKey ? 0.1 : (e.altKey || e.ctrlKey) ? 10 : 1;
    // drag-to-scrub: a press that travels > 3 px scrubs (and never focuses); a press that does not is a click → focus + select for typing
    inp.addEventListener('mousedown', e => {
      if (document.activeElement === inp || e.button !== 0) return;   // already typing: let the browser place the caret
      e.preventDefault();
      const x0 = e.clientX; let last = x0; let moved = false; let acc = 0; const v0 = get(); let v = v0;
      const mm = (ev: MouseEvent) => {
        if (!moved) { if (Math.abs(ev.clientX - x0) <= 3) return; moved = true; dragging = true; last = x0; document.body.classList.add('scrubbing'); }   // (past the click threshold: count the travel from where the press began)
        const dx = ev.clientX - last; last = ev.clientX;
        acc += dx / 2; const whole = Math.trunc(acc); if (!whole) return; acc -= whole;
        v = clampV(v + whole * step * gain(ev)); set(+v.toFixed(6)); inp.value = fmt(v); after();
      };
      const mu = () => {
        window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); document.body.classList.remove('scrubbing');
        if (moved) { dragging = false; paint(); after(); } else { inp.focus(); inp.select(); }
      };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    let shown = inp.value; inp.addEventListener('focus', () => { shown = inp.value; });   // (the text as the field took the keys: left as it was, a click away or Esc writes nothing — parsed back, the ROUNDED text overwrote a finer value)
    inp.addEventListener('keydown', e => {
      e.stopPropagation();   // (Input ignores typing targets anyway; this also keeps host pages' shortcuts off the field)
      if (e.key === 'Enter') { if (inp.value !== shown) commit(parseFloat(inp.value)); inp.blur(); }
      else if (e.key === 'Escape') { inp.value = shown = fmt(get()); inp.blur(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const cur = parseFloat(inp.value); const base = Number.isFinite(cur) ? cur : get(); const v = clampV(base + (e.key === 'ArrowUp' ? 1 : -1) * step * gain(e)); set(+v.toFixed(6)); inp.value = shown = fmt(v); inp.select(); after(); }
    });
    inp.addEventListener('blur', () => { if (inp.value !== shown) { const v = parseFloat(inp.value); if (Number.isFinite(v) && Math.abs(v - get()) > 1e-9) commit(v); } inp.value = fmt(get()); });
    inp.addEventListener('wheel', e => { if (document.activeElement !== inp) return; e.preventDefault(); const v = clampV(get() + (e.deltaY < 0 ? 1 : -1) * step * gain(e)); set(+v.toFixed(6)); inp.value = shown = fmt(v); after(); }, { passive: false });
    return { el: inp, paint };
  }
  toggleBox(sec: HTMLElement, label: string, get: Getter<boolean>, set: Setter<boolean>, title?: string, def?: boolean) {
    const r = this.row(sec, label, title); r.classList.add('togglerow'); const inp = document.createElement('input'); inp.type = 'checkbox'; r.appendChild(inp);
    const mark = def === undefined ? () => {} : this.revertDot(r, () => get() !== def, () => set(def));
    inp.onchange = () => { set(inp.checked); mark(); if (this.game) inp.blur(); }; const rf = () => { inp.checked = get(); mark(); }; rf(); this.keep(rf, inp); return inp;
  }
  select(sec: HTMLElement, label: string, options: string[], get: Getter<number>, set: Setter<number>, title?: string) {
    const r = this.row(sec, label, title); r.classList.add('selectrow'); const s = document.createElement('select');
    options.forEach((o, i) => { const op = document.createElement('option'); op.value = String(i); op.textContent = o; s.appendChild(op); });
    s.onchange = () => { set(parseInt(s.value, 10)); s.blur(); }; const rf = () => { if (document.activeElement !== s) s.value = String(get()); }; rf(); this.keep(rf, s); r.appendChild(s); return s;   // (a pick made hands the keyboard straight back to the stage / the game)
  }
  buttons(sec: HTMLElement, label: string, btns: { text: string; run: () => void; title?: string }[]) {
    const r = this.row(sec, label); r.classList.add('btnrow'); const box = this.game ? document.createElement('span') : r; if (box !== r) { box.className = 'btns'; r.appendChild(box); }
    for (const b of btns) { const el = document.createElement('button'); el.type = 'button'; el.textContent = b.text; if (b.title) el.title = b.title; el.onclick = () => { b.run(); this.refresh(); if (this.game) el.blur(); }; box.appendChild(el); }
    return r;
  }
  text(sec: HTMLElement, get: Getter<string>) {
    const r = document.createElement('div'); r.className = this.advanced ? 'row textrow adv' : 'row textrow'; r.style.color = '#8aa'; r.style.whiteSpace = 'pre-wrap'; sec.appendChild(r);
    const rf = () => { const t = get(); if (r.textContent !== t) r.textContent = t; r.classList.toggle('empty', !t); }; rf(); this.keep(rf, r); return r;
  }
}
/** the first line of a summary, for a section header (the full thing is the section's own read-out row) */
function oneLine(s: string): string { const i = s.indexOf('\n'); return (i >= 0 ? s.slice(0, i) : s).trim(); }
