// THE SCENE TWEAK PANEL — a one off tool, not a menu of the game's (`?tweak` on any link; ui/sceneLayers.ts says what a scene is made of).
//
// The maintainer, 10-15, on a night clip of the snow pass: "this is starting to look good but i think some manual tweaking by me would really help. could you make a one
// off UI for tweaking a scene like this? i'm curious what all the "layers" are for the effects and what variables we can configure". So: the picture as a list of
// LAYERS, back to front; each has a switch and, opened, its numbers on sliders; every move is live; `copy` puts what was changed on the clipboard as text, by the
// names the code uses, so the values can become the defaults. Nothing here is a default: with the panel never opened the build is the build as it was.
//
// What a hand moved is kept on this machine, a copy per scene (localStorage `twopointsix.sceneTweak.<level>`), and put back when a page opens with `?tweak` — a
// restart or a reload keeps the hand's work — and ONLY then: a link without the word never reads it. Only what a HAND moved counts as changed: a number the game
// itself moves later (the hour's exposure, a quality step) is not a tweak, is not copied and is not kept.
//
// This file is the panel and its bookkeeping, and knows no layer: the list is handed in. The bookkeeping half (changes, the text, the kept copy) touches no DOM, so
// tools/qa/scenetweak-check.ts runs it headless.

/** one number of a layer */
export interface TweakVar {
  /** the name the code knows it by (`SNOWGRAINS.opacity`, `SNOW_SPARKLE_GAIN`): what `copy` prints and the kept copy is keyed on */
  id: string;
  label: string;
  /** the file the default lives in */
  src: string;
  get: () => number; set: (v: number) => void;
  min: number; max: number; step: number;
  /** the shipped value (what it was when the page opened) */
  def: number;
  /** the code's own comment on it (the hover text) */
  note?: string;
  /** when a move shows: at once (absent), with the next ones born ('next'), or after the layer's shader is rebuilt ('build': a short hitch) */
  when?: 'next' | 'build';
  /** it is not the picture alone: guards and smoke read it too (the row carries a mark) */
  play?: boolean;
  /** a hand has moved it (the panel, or the kept copy of an earlier visit): only then can it read as changed */
  touched?: boolean;
  /** nothing reads it as the scene stands now (the row is dimmed; it still moves and still copies) */
  idle?: () => boolean;
}
/** a layer's switch. `reloads`: it is read when the page opens, so flipping it reloads the page with its URL word */
export interface TweakSwitch { get: () => boolean; set: (on: boolean) => void; reloads?: boolean;
  /** it is not the picture alone (the torches out is a darker room for a guard too): `none` and `all` leave it be */
  play?: boolean;
  /** it picks HOW the scene runs, it is not a layer to see or hide: `none` and `all` leave it be */
  mode?: boolean;
  /** how it stood when the page opened (absent = on): a layer the scene itself has off — no fog of war on this mission — is not a hand's change */
  def?: boolean }
export interface TweakLayer {
  id: string; name: string;
  /** the heading it stands under (Light · Ground · Air · Lens) */
  group: string;
  on?: TweakSwitch;
  vars: TweakVar[];
  /** one short live read-out beside the name (a count, a speed) */
  stat?: () => string;
  /** what the layer IS, in a plain sentence (its hover text) */
  note?: string;
  /** run at once after any of its numbers or its switch moved (a uniform block rewritten) */
  apply?: () => void;
  /** … and then this, for a layer with shader constants: rebuild its program from the text as it now stands (one at a time; the owner skips a text it already runs) */
  build?: () => Promise<{ ok: boolean; messages: string[] }>;
  /** nothing draws it as the scene stands now (the layer is dimmed) */
  idle?: () => boolean;
  /** one thing to do from its row (a button: set one off to look at) */
  act?: { label: string; note?: string; run: () => void };
}

// ---------------------------------------------------------------- the bookkeeping (no DOM)
const EPS = 1e-9;
/** a number as the code would write it: no float noise, no trailing zeros */
export function fmtNum(v: number, step = 0): string {
  if (!Number.isFinite(v)) return String(v);
  const d = step > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-6)) + 1) : 4;
  return String(+v.toFixed(d));
}
export const varChanged = (v: TweakVar): boolean => !!v.touched && Math.abs(v.get() - v.def) > Math.max(EPS, Math.abs(v.def) * 1e-6);
/** a hand's move of one number, held to its slider's reach */
export function moveVar(v: TweakVar, x: number) { v.set(Math.min(v.max, Math.max(v.min, x))); v.touched = true; }
export function changedVars(layers: readonly TweakLayer[]): TweakVar[] { return layers.flatMap(L => L.vars.filter(varChanged)); }
/** the layers whose switch a hand has flipped (a reload switch is the URL's, not the panel's) */
export const layersFlipped = (layers: readonly TweakLayer[]): TweakLayer[] => layers.filter(L => L.on && !L.on.reloads && L.on.get() !== (L.on.def ?? true));

/** WHAT `copy` HANDS BACK: the changed numbers, by the code's own names, under the file each default lives in. `all` = every number, changed or not. */
export function tweakText(layers: readonly TweakLayer[], scene: string, all = false): string {
  const out: string[] = [`scene tweak · ${scene}`];
  const bySrc = new Map<string, string[]>();
  for (const L of layers) for (const v of L.vars) {
    const ch = varChanged(v); if (!ch && !all) continue;
    const rows = bySrc.get(v.src) ?? []; if (!rows.length) bySrc.set(v.src, rows);
    rows.push(ch ? `${v.id} = ${fmtNum(v.get(), v.step)}   (was ${fmtNum(v.def, v.step)})` : `${v.id} = ${fmtNum(v.def, v.step)}`);
  }
  for (const [src, rows] of bySrc) out.push('', `# ${src}`, ...rows);
  const flipped = layersFlipped(layers), off = flipped.filter(L => !L.on!.get()), on = flipped.filter(L => L.on!.get());
  if (off.length) out.push('', `# switched off: ${off.map(L => L.name).join(' · ')}`);
  if (on.length) out.push('', `# switched on: ${on.map(L => L.name).join(' · ')}`);
  if (out.length === 1) out.push('', 'nothing changed');
  return out.join('\n') + '\n';
}

/** the kept copy: the changed numbers and the switches a hand flipped (never a reload switch: the URL carries those). `old` = the copy already kept: what it
 *  holds for a layer this page does not have (the surface's rows on a `?snowlook=0` reload) is carried over, not dropped. */
export interface TweakSaved { v?: Record<string, number>; sw?: Record<string, boolean> }
export function savedOf(layers: readonly TweakLayer[], old?: TweakSaved | null): TweakSaved {
  const ids = new Set(layers.flatMap(L => L.vars.map(v => v.id))), lids = new Set(layers.map(L => L.id));
  const v: Record<string, number> = {}, sw: Record<string, boolean> = {};
  for (const [k, x] of Object.entries(old?.v ?? {})) if (!ids.has(k) && typeof x === 'number') v[k] = x;
  for (const [k, x] of Object.entries(old?.sw ?? {})) if (!lids.has(k) && typeof x === 'boolean') sw[k] = x;
  for (const x of changedVars(layers)) v[x.id] = x.get();
  for (const L of layersFlipped(layers)) sw[L.id] = L.on!.get();
  return { v, sw };
}
/** put a kept copy back (unknown names and values that are not numbers are passed over: another build's copy must not break this one). Returns the layers touched. */
export function applySaved(layers: readonly TweakLayer[], s: TweakSaved | null | undefined): TweakLayer[] {
  const hit = new Set<TweakLayer>(); if (!s) return [];
  for (const L of layers) {
    for (const v of L.vars) { const x = s.v?.[v.id]; if (typeof x === 'number' && Number.isFinite(x)) { v.touched = true; if (Math.abs(x - v.get()) > EPS) { moveVar(v, x); hit.add(L); } } }
    const want = s.sw?.[L.id]; if (L.on && !L.on.reloads && typeof want === 'boolean' && L.on.get() !== want) { L.on.set(want); hit.add(L); }
  }
  return [...hit];
}
/** every number back to its shipped value, every hand switch back where it stood. Returns the layers touched. */
export function resetAll(layers: readonly TweakLayer[]): TweakLayer[] {
  const hit = new Set<TweakLayer>();
  for (const L of layers) {
    for (const v of L.vars) { if (varChanged(v)) { v.set(v.def); hit.add(L); } v.touched = false; }
    if (L.on && !L.on.reloads && L.on.get() !== (L.on.def ?? true)) { L.on.set(L.on.def ?? true); hit.add(L); }
  }
  return [...hit];
}

/** A SWITCH BY MUTING: a layer whose own switch is read when the page opens is put out live by holding some of its numbers at zero (its weight, its gain). The
 *  rows keep showing — and `copy` keeps printing — the values the hand set: the zero is the switch's, not a tweak. */
export function muting(vars: TweakVar[], ids: readonly string[], zero = 0): TweakSwitch {
  const vs = ids.map(id => { const v = vars.find(x => x.id === id); if (!v) throw new Error(`sceneTweak: no number '${id}' to mute`); return v; });
  const raw = vs.map(v => ({ get: v.get, set: v.set })); let held: number[] | null = null;
  vs.forEach((v, i) => { v.get = () => held ? held[i] : raw[i].get(); v.set = x => { if (held) held[i] = x; else raw[i].set(x); }; });
  return { get: () => !held, set: on => {
    if (on === !held) return;
    if (!on) { held = raw.map(r => r.get()); raw.forEach(r => r.set(zero)); } else { const h = held!; held = null; raw.forEach((r, i) => r.set(h[i])); }
  } };
}

// ---------------------------------------------------------------- the panel (DOM)
const LS_KEY = 'twopointsix.sceneTweak', LS_UI = 'twopointsix.sceneTweakUi';   // (the kept copy's key is LS_KEY + '.' + the scene)
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* nothing kept */ } };
function lsJson<T>(k: string): T | null { const raw = lsGet(k); if (!raw) return null; try { const j = JSON.parse(raw); return j && typeof j === 'object' ? j as T : null; } catch { return null; } }

const CSS = `
#stweak { position: absolute; left: 8px; top: 40px; width: 318px; max-height: calc(100% - 56px); z-index: 13; display: flex; flex-direction: column; font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: #cfd; background: rgba(5,9,11,0.9); border: 1px solid rgba(120,170,160,0.22); border-radius: 5px; box-shadow: 0 6px 24px rgba(0,0,0,0.5); user-select: none; -webkit-user-select: none; }
#stweak.shut { width: auto; }
#stweak.shut .stbody, #stweak.shut .stbtn { display: none; }
#stweak .sthead { flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 7px; cursor: grab; border-bottom: 1px solid rgba(120,170,160,0.16); }
#stweak.shut .sthead { border-bottom: 0; }
#stweak .sttitle { letter-spacing: 0.14em; text-transform: uppercase; color: #79d69a; font-size: 10px; }
#stweak .stcount { color: #e8c268; font-variant-numeric: tabular-nums; min-width: 2ch; }
#stweak .stgap { flex: 1; }
#stweak button { font: inherit; color: #bfe; background: #10201f; border: 1px solid #2c4a46; border-radius: 3px; padding: 1px 7px; cursor: pointer; }
#stweak button:hover { background: #17302d; color: #efe; }
#stweak button.flash { background: #245a3a; color: #fff; }
#stweak .stfold { padding: 1px 5px; }
#stweak .stbody { overflow-y: auto; overscroll-behavior: contain; padding: 2px 0 6px; }
#stweak .stgroup { padding: 7px 8px 2px; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f8a80; }
#stweak .stlayer { border-top: 1px solid rgba(120,170,160,0.07); }
#stweak .stlhead { display: flex; align-items: center; gap: 6px; padding: 3px 8px; cursor: pointer; }
#stweak .stlhead:hover { background: rgba(120,170,160,0.07); }
#stweak .stlhead input { margin: 0; cursor: pointer; accent-color: #58c98a; }
#stweak .stlhead .noswitch { width: 13px; }
#stweak .stname { color: #e4f4ea; white-space: nowrap; }
#stweak .stlayer.off .stname { color: #6d807a; text-decoration: line-through; text-decoration-color: #4a5a55; }
#stweak .ststat { flex: 1; min-width: 0; text-align: right; color: #6f9a8e; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
#stweak .ststat.err { color: #f08a7a; }
#stweak .stlayer.idle .stname { color: #6d807a; }
#stweak .strow.idle { opacity: 0.38; }
#stweak .stact { flex: none; padding: 0 6px; font-size: 10px; line-height: 14px; }
#stweak .stdot { color: #e8c268; font-variant-numeric: tabular-nums; min-width: 1.2ch; text-align: right; }
#stweak .stcaret { color: #5f8a80; width: 1ch; }
#stweak .stvars { display: none; padding: 1px 8px 6px 27px; }
#stweak .stlayer.open .stvars { display: block; }
#stweak .strow { display: grid; grid-template-columns: 96px 1fr 50px 10px; align-items: center; gap: 5px; height: 19px; }
#stweak .strow label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #a9c4ba; }
#stweak .strow.ch label { color: #f1d894; }
#stweak .strow .mark { color: #7fa0c8; }
#stweak .strow input[type=range] { width: 100%; min-width: 0; margin: 0; height: 12px; accent-color: #58c98a; cursor: ew-resize; }
#stweak .strow.ch input[type=range] { accent-color: #e8c268; }
#stweak .strow input[type=number] { width: 100%; box-sizing: border-box; font: inherit; color: #dfe; background: #0a1417; border: 1px solid #24383a; border-radius: 2px; padding: 0 3px; height: 16px; text-align: right; -moz-appearance: textfield; user-select: text; -webkit-user-select: text; }
#stweak .strow input[type=number]::-webkit-inner-spin-button { display: none; }
#stweak .strow .back { color: #e8c268; cursor: pointer; visibility: hidden; text-align: center; }
#stweak .strow.ch .back { visibility: visible; }
`;

export interface SceneTweakOpts {
  /** the scene's name in the copied text (the level) */
  scene: string;
  /** where the panel is put (default: the page's body) */
  root?: HTMLElement;
}

interface RowRec { v: TweakVar; row: HTMLElement; range: HTMLInputElement; num: HTMLInputElement }
interface LayerRec { L: TweakLayer; el: HTMLElement; box: HTMLInputElement | null; stat: HTMLElement; dot: HTMLElement; rows: RowRec[]; err: string; busy: boolean; again: boolean }
const BTN_LABEL = new WeakMap<HTMLButtonElement, string>();

export class SceneTweak {
  readonly el: HTMLElement;
  private recs: LayerRec[] = [];
  private countEl!: HTMLElement;
  private saveT = 0;
  private ui: { open?: string[]; shut?: boolean; x?: number; y?: number };
  private key: string;

  constructor(readonly layers: TweakLayer[], private opts: SceneTweakOpts) {
    this.key = `${LS_KEY}.${opts.scene}`;
    this.ui = lsJson<SceneTweak['ui']>(LS_UI) ?? {};
    if (!document.getElementById('stweak-css')) { const st = document.createElement('style'); st.id = 'stweak-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = this.el = document.createElement('div'); el.id = 'stweak'; if (this.ui.shut) el.classList.add('shut');
    el.append(this.head());
    const body = document.createElement('div'); body.className = 'stbody';
    let group = '';
    for (const L of layers) {
      if (L.group !== group) { group = L.group; const g = document.createElement('div'); g.className = 'stgroup'; g.textContent = group; body.append(g); }
      body.append(this.layer(L));
    }
    el.append(body);
    (opts.root ?? document.body).appendChild(el);   // (beside the canvas, not over a listener of the game's: Input hears presses and the wheel on the canvas alone, and releases on the window — nothing here is kept from it)
    if (typeof this.ui.x === 'number' && typeof this.ui.y === 'number') this.place(this.ui.x, this.ui.y);
    // the kept copy of an earlier visit, now that each layer has somewhere to say what its rebuild made of it (the shipped values were read when the layers were made)
    for (const L of applySaved(layers, lsJson<TweakSaved>(this.key))) this.applied(L);
    this.refresh();
    setInterval(() => this.refresh(), 500);
  }

  // ---- the head: its name (drag it), how many numbers stand changed, copy · reset · fold
  private head(): HTMLElement {
    const h = document.createElement('div'); h.className = 'sthead';
    const title = document.createElement('span'); title.className = 'sttitle'; title.textContent = 'scene';
    this.countEl = document.createElement('span'); this.countEl.className = 'stcount'; this.countEl.title = 'numbers changed';
    const gap = document.createElement('span'); gap.className = 'stgap';
    const btn = (text: string, title: string, run: (b: HTMLButtonElement, e: MouseEvent) => void) => { const b = document.createElement('button'); b.className = 'stbtn'; b.textContent = text; b.title = title; b.onclick = e => { run(b, e); b.blur(); }; return b; };
    const copy = btn('copy', 'the changed numbers, as text (shift: every number)', (b, e) => { void this.copy(e.shiftKey).then(ok => this.flash(b, ok ? 'copied' : 'see console')); });
    const reset = btn('reset', 'every number back to its shipped value, every switch back where it stood', () => { for (const L of resetAll(this.layers)) this.applied(L); this.refresh(true); lsSet(this.key, JSON.stringify(savedOf(this.layers))); });   // (and the kept copy with it, whole: reset is reset)
    const none = btn('none', 'every layer of the picture off (not ↻ ones, not ◆ ones, not the two that say how the air runs)', () => this.allTo(false));
    const all = btn('all', 'every layer on', () => this.allTo(true));
    const fold = document.createElement('button'); fold.className = 'stfold'; fold.textContent = this.ui.shut ? '▸' : '▾'; fold.onclick = () => { this.ui.shut = !this.ui.shut; this.el.classList.toggle('shut', !!this.ui.shut); fold.textContent = this.ui.shut ? '▸' : '▾'; fold.blur(); this.saveUi(); };
    h.append(title, this.countEl, gap, none, all, copy, reset, fold);
    // drag by the head
    h.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      const r = this.el.getBoundingClientRect(), p = (this.el.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 }; const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = (m: PointerEvent) => this.place(m.clientX - dx - p.left, m.clientY - dy - p.top);
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.saveUi(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); e.preventDefault();
    });
    return h;
  }
  /** put the panel at (x, y) of its parent, its head always in reach (a place kept from a wider window comes back inside this one) */
  private place(x: number, y: number) {
    const p = this.el.offsetParent as HTMLElement | null; const pw = p?.clientWidth || window.innerWidth, ph = p?.clientHeight || window.innerHeight;
    x = Math.round(Math.max(0, Math.min(x, pw - 60))); y = Math.round(Math.max(0, Math.min(y, ph - 24)));
    this.el.style.left = x + 'px'; this.el.style.top = y + 'px'; this.ui.x = x; this.ui.y = y;
  }
  private flash(b: HTMLButtonElement, text: string) { if (!BTN_LABEL.has(b)) BTN_LABEL.set(b, b.textContent ?? ''); b.textContent = text; b.classList.add('flash'); setTimeout(() => { b.textContent = BTN_LABEL.get(b)!; b.classList.remove('flash'); }, 900); }
  private allTo(on: boolean) { for (const r of this.recs) { const s = r.L.on; if (!s || s.reloads || s.play || s.mode || s.get() === on) continue; s.set(on); this.applied(r.L); } this.refresh(true); this.saveSoon(); }

  // ---- one layer: switch · name · read-out · how many changed · its rows
  private layer(L: TweakLayer): HTMLElement {
    const el = document.createElement('div'); el.className = 'stlayer'; if (this.ui.open?.includes(L.id)) el.classList.add('open');
    const head = document.createElement('div'); head.className = 'stlhead';
    let box: HTMLInputElement | null = null;
    if (L.on) {
      box = document.createElement('input'); box.type = 'checkbox'; box.checked = L.on.get(); if (L.on.reloads) box.title = 'reloads the page';
      box.onclick = e => e.stopPropagation();
      box.onchange = () => { L.on!.set(box!.checked); box!.blur(); if (L.on!.reloads) return; this.applied(L); this.refresh(true); this.saveSoon(); };
      head.append(box);
    } else { const sp = document.createElement('span'); sp.className = 'noswitch'; head.append(sp); }
    const name = document.createElement('span'); name.className = 'stname'; name.textContent = L.name + (L.on?.reloads ? ' ↻' : '') + (L.on?.play ? ' ◆' : ''); name.title = [L.note, L.on?.play ? 'not the picture alone: guards and smoke read it too' : ''].filter(Boolean).join('\n');
    const stat = document.createElement('span'); stat.className = 'ststat';
    const dot = document.createElement('span'); dot.className = 'stdot';
    const caret = document.createElement('span'); caret.className = 'stcaret'; caret.textContent = L.vars.length ? '▸' : '';
    const rec: LayerRec = { L, el, box, stat, dot, rows: [], err: '', busy: false, again: false };
    head.append(name, stat);
    if (L.act) { const A = L.act; const b = document.createElement('button'); b.className = 'stact'; b.textContent = A.label; if (A.note) b.title = A.note;
      b.onclick = e => { e.stopPropagation(); rec.err = ''; try { A.run(); } catch (err) { rec.err = String(err); console.error('[scene tweak]', L.name, err); } b.blur(); this.paintLayer(rec); }; head.append(b); }
    head.append(dot, caret);
    const vars = document.createElement('div'); vars.className = 'stvars';
    head.onclick = () => { if (!L.vars.length) return; const open = el.classList.toggle('open'); caret.textContent = open ? '▾' : '▸'; const o = new Set(this.ui.open ?? []); if (open) o.add(L.id); else o.delete(L.id); this.ui.open = [...o]; this.saveUi(); if (open) this.refresh(true); };
    if (el.classList.contains('open')) caret.textContent = '▾';
    for (const v of L.vars) rec.rows.push(this.row(rec, v, vars));
    el.append(head, vars); this.recs.push(rec);
    return el;
  }
  private row(rec: LayerRec, v: TweakVar, into: HTMLElement): RowRec {
    const row = document.createElement('div'); row.className = 'strow';
    const tip = [v.id, v.note, v.when === 'next' ? 'reaches the next ones born' : v.when === 'build' ? 'rebuilds a shader: a short hitch' : '', v.play ? 'not the picture alone: guards and smoke read it too' : '', v.idle ? 'dimmed while nothing reads it' : ''].filter(Boolean).join('\n');
    const label = document.createElement('label'); label.textContent = v.label; row.title = tip;
    if (v.play || v.when) { const m = document.createElement('span'); m.className = 'mark'; m.textContent = v.play ? ' ◆' : v.when === 'build' ? ' ⟳' : ' ›'; label.append(m); }
    const range = document.createElement('input'); range.type = 'range'; range.min = String(v.min); range.max = String(v.max); range.step = String(v.step);
    const num = document.createElement('input'); num.type = 'number'; num.step = String(v.step);
    const back = document.createElement('span'); back.className = 'back'; back.textContent = '•'; back.title = `back to ${fmtNum(v.def, v.step)}`;
    const put = (x: number) => { moveVar(v, x); this.applied(rec.L); this.paintRow(r); this.paintLayer(rec); this.paintCount(); this.saveSoon(); };
    // a slider is live as it is dragged — but a shader constant's is committed on release: each commit is a program rebuilt
    range.oninput = () => { if (v.when === 'build') num.value = fmtNum(+range.value, v.step); else put(+range.value); };
    range.onchange = () => { if (v.when === 'build') put(+range.value); range.blur(); };   // (a focused slider would keep the game's keys: hand them back)
    // the box: a number or nothing (an empty or half-typed box is put back as it was), held to the slider's reach; Escape gives it up
    num.onchange = () => { const x = num.value.trim() === '' ? NaN : +num.value; if (Number.isFinite(x)) put(x); else this.paintRow(r); num.blur(); };
    num.onkeydown = e => { if (e.key === 'Escape') { num.value = fmtNum(v.get(), v.step); num.blur(); } else if (e.key === 'Enter') num.blur(); e.stopPropagation(); };
    back.onclick = () => { put(v.def); v.touched = false; this.paintRow(r); this.paintLayer(rec); this.paintCount(); };
    row.append(label, range, num, back); into.append(row);
    const r: RowRec = { v, row, range, num };
    return r;
  }

  /** a layer's numbers or switch moved: its apply at once, then its build — one at a time per layer (a rebuild still under way is followed by one more, which reads the latest values) */
  private applied(L: TweakLayer) {
    const rec = this.recs.find(r => r.L === L);
    try { L.apply?.(); } catch (e) { if (rec) rec.err = String(e); console.error('[scene tweak]', L.name, e); }
    if (!L.build || !rec) return;
    if (rec.busy) { rec.again = true; return; }
    const run = () => {
      rec.busy = true;
      void L.build!().then(r => { rec.err = r.ok ? '' : (r.messages[0] ?? 'did not build'); if (!r.ok) console.error('[scene tweak]', L.name, r.messages); }, e => { rec.err = String(e); console.error('[scene tweak]', L.name, e); })
        .then(() => { rec.busy = false; if (rec.again) { rec.again = false; run(); } this.paintLayer(rec); });
    };
    run(); this.paintLayer(rec);
  }

  // ---- painting
  private paintRow(r: RowRec) {
    const x = r.v.get(); r.row.classList.toggle('ch', varChanged(r.v)); r.row.classList.toggle('idle', !!r.v.idle?.());
    if (document.activeElement !== r.range) r.range.value = String(Math.min(r.v.max, Math.max(r.v.min, x)));
    if (document.activeElement !== r.num) r.num.value = fmtNum(x, r.v.step);
  }
  private paintLayer(rec: LayerRec) {
    const on = rec.L.on ? rec.L.on.get() : true; rec.el.classList.toggle('off', !on); rec.el.classList.toggle('idle', !!rec.L.idle?.()); if (rec.box && document.activeElement !== rec.box) rec.box.checked = on;
    const n = rec.L.vars.filter(varChanged).length; rec.dot.textContent = n ? String(n) : '';
    let s = ''; if (rec.err) s = rec.err; else if (rec.busy) s = 'building…'; else if (rec.L.stat) { try { s = rec.L.stat(); } catch { s = ''; } }
    rec.stat.textContent = s; rec.stat.title = s; rec.stat.classList.toggle('err', !!rec.err);
  }
  private paintCount() { const n = changedVars(this.layers).length; this.countEl.textContent = n ? String(n) : ''; }
  /** the read-outs, the switches, the counts — and, for open layers (or all of them when `rows`), the rows: something else may have moved a number (the debugger, an hour change) */
  refresh(rows = false) {
    if (this.ui.shut && !rows) { this.paintCount(); return; }
    for (const rec of this.recs) { this.paintLayer(rec); if (rows || rec.el.classList.contains('open')) for (const r of rec.rows) this.paintRow(r); }
    this.paintCount();
  }

  // ---- the kept copy, the text
  private saveSoon() { clearTimeout(this.saveT); this.saveT = setTimeout(() => lsSet(this.key, JSON.stringify(savedOf(this.layers, lsJson<TweakSaved>(this.key)))), 250) as unknown as number; }
  private saveUi() { lsSet(LS_UI, JSON.stringify(this.ui)); }
  text(all = false): string { return tweakText(this.layers, this.opts.scene, all); }
  async copy(all = false): Promise<boolean> {
    const t = this.text(all); console.log(t);
    try { await navigator.clipboard.writeText(t); return true; } catch { /* no clipboard here (an insecure origin, a denied permission): the old way */ }
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
}
