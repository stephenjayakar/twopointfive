// The Tab tweak panel's INVENTORY — every row bindings.ts builds (label, kind, range / step, tooltip, buttons, options, revert dot), collected by
// instrumenting the Panel class while buildPanel runs headless (the full Game of headless.ts under it, a small fake DOM round it), and held
// against the inventory main's panel had before the two-level redo (tools/qa/fixtures/panel-inventory-main.json, frozen off main with --write).
// The redo may MOVE a row (its 'System ▸ Section' path is informational) and may ADD rows (listed); it may not lose or reword one: a row of the
// frozen list with no equal (kind + label + min / max / step + tooltip + buttons + options + revert dot) in the live panel is a FAIL.
//   bun run tools/qa/panel-inventory.ts                    live panel vs the frozen fixture (also: probes.ts panel-inventory, families 'ui' / 'selector')
//   bun run tools/qa/panel-inventory.ts --ref <gitref>     live panel vs the panel AT THAT REF (its bindings.ts + panel.ts materialised from git, imports re-pointed)
//   bun run tools/qa/panel-inventory.ts --write [--ref R]  (re)write the fixture from ref R (default HEAD) — only when a row is renamed ON PURPOSE
//   --reword [map.json]                                    a row reworded ON PURPOSE: rewrite ONLY the fixture's missing rows, each from the live row of the same kind + label (map.json = { "old label": "new label" }
//                                                          for a renamed one), every other fixture row left as it is (unlike --write, which re-freezes the lot and so holds rows other lanes added)
//   --print                                                dump the live inventory grouped by path
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, standUp, fake } from './headless.ts';

export interface Row { path: string; kind: string; label: string; min?: number; max?: number; step?: number; title: string; def: boolean; extra: string; adv?: boolean }
const FIXTURE = join(ROOT, 'tools/qa/fixtures/panel-inventory-main.json');
const SCRATCH = join(ROOT, 'tools/qa/.panel-inventory-scratch');

// ---------------------------------------------------------------- a small fake DOM (the shape editor-probes.ts uses, plus what panel.ts v2 touches)
type Listener = (e: any) => void;
class Style { [k: string]: any; setProperty(k: string, v: string) { this[k] = v; } removeProperty(k: string) { delete this[k]; } }
class ClassList { s = new Set<string>(); add(...c: string[]) { c.forEach(x => this.s.add(x)); } remove(...c: string[]) { c.forEach(x => this.s.delete(x)); } contains(c: string) { return this.s.has(c); } toggle(c: string, force?: boolean) { const on = force ?? !this.s.has(c); if (on) this.s.add(c); else this.s.delete(c); return on; } toString() { return [...this.s].join(' '); } }
class El {
  nodeType = 1; id = ''; title = ''; value = ''; type = ''; min = ''; max = ''; step = ''; checked = false; disabled = false; placeholder = ''; spellcheck = false; inputMode = ''; tabIndex = 0; href = ''; download = ''; width = 300; height = 150; hidden = false;
  scrollTop = 0; scrollLeft = 0;
  dataset: Record<string, string> = {}; style = new Style(); classList = new ClassList(); childNodes: any[] = []; parentElement: El | null = null; listeners = new Map<string, Listener[]>();
  onclick: Listener | null = null; onchange: Listener | null = null; oninput: Listener | null = null; onkeydown: Listener | null = null; onmousedown: Listener | null = null; onscroll: Listener | null = null; _text = '';
  constructor(public tagName: string) {}
  get className() { return this.classList.toString(); } set className(v: string) { this.classList.s = new Set(v.split(/\s+/).filter(Boolean)); }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; } get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get firstElementChild() { return this.children[0] ?? null; }
  get nextSibling() { const p = this.parentElement; if (!p) return null; const i = p.childNodes.indexOf(this); return p.childNodes[i + 1] ?? null; }
  get options() { return this.children.filter((c: El) => c.tagName === 'OPTION'); }
  get clientWidth() { return 320; } get clientHeight() { return 600; } get scrollHeight() { return 900; } get offsetTop() { return 0; }
  appendChild(c: any) { if (c.parentElement) c.parentElement.removeChild(c); this.childNodes.push(c); c.parentElement = this; return c; }
  append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }
  prepend(...cs: any[]) { let i = 0; for (const c of cs) { const n = typeof c === 'string' ? doc.createTextNode(c) : c; if (n.parentElement) n.parentElement.removeChild(n); this.childNodes.splice(i++, 0, n); n.parentElement = this; } }
  insertBefore(c: any, ref: any) { const i = this.childNodes.indexOf(ref); if (c.parentElement) c.parentElement.removeChild(c); if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); c.parentElement = this; return c; }
  removeChild(c: any) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentElement = null; return c; }
  remove() { this.parentElement?.removeChild(this); }
  replaceChildren(...cs: any[]) { for (const c of this.childNodes) c.parentElement = null; this.childNodes = []; this.append(...cs); }
  get textContent(): string { return this.nodeType === 3 ? this._text : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v: string) { if (this.nodeType === 3) { this._text = v; return; } for (const c of this.childNodes) c.parentElement = null; this.childNodes = []; if (v) { const t = doc.createTextNode(v); this.childNodes.push(t); t.parentElement = this; } }
  set innerHTML(v: string) { this.textContent = v.replace(/<[^>]*>/g, ''); } get innerHTML() { return this.textContent; }
  matches(sel: string): boolean { return sel.split(',').some(s => { const t = s.trim(); const [tag, ...cls] = t.split('.'); return (!tag || tag === '*' || this.tagName === tag.toUpperCase() || (tag.startsWith('#') && this.id === tag.slice(1))) && cls.every(c => this.classList.contains(c)); }); }
  querySelector(sel: string): El | null { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel: string): El[] { const out: El[] = []; const walk = (e: El) => { for (const c of e.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  addEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; a.push(f); this.listeners.set(t, a); } removeEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
  dispatch(t: string, e: any = {}) { const ev = { target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, key: '', code: '', ...e }; for (const f of this.listeners.get(t) ?? []) f(ev); const h = (this as any)['on' + t]; if (h) h(ev); return ev; }
  click() { this.dispatch('click'); }
  contains(el: any): boolean { for (let p = el; p; p = p.parentElement) if (p === this) return true; return false; }
  closest(sel: string): El | null { for (let p: El | null = this; p; p = p.parentElement) if (p.matches(sel)) return p; return null; }
  getBoundingClientRect() { return { top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight, x: 0, y: 0 }; }
  focus() { doc.activeElement = this; } blur() { if (doc.activeElement === this) doc.activeElement = doc.body; this.dispatch('blur'); } select() {}
  scrollIntoView() {} scrollTo(_x?: any, y?: number) { if (typeof _x === 'object') this.scrollTop = _x.top ?? this.scrollTop; else if (typeof y === 'number') this.scrollTop = y; }
  setAttribute(k: string, v: string) { (this as any)[k] = v; } getAttribute(k: string) { return (this as any)[k] ?? null; } removeAttribute(k: string) { delete (this as any)[k]; }
  getContext() { return fake('ctx2d'); }
  animate() { return { cancel() {}, finished: Promise.resolve() }; }
}
let byId = new Map<string, El>();
const doc: any = {
  body: new El('BODY'), activeElement: null as any, hidden: false, documentElement: new El('HTML'),
  createElement: (t: string) => new El(t.toUpperCase()), createTextNode: (s: string) => { const t = new El('#text'); t.nodeType = 3; t._text = String(s); return t; },
  getElementById: (id: string) => { let e = byId.get(id); if (!e) { e = new El(id === 'view' ? 'CANVAS' : 'DIV'); e.id = id; byId.set(id, e); doc.body.appendChild(e); } return e; },
  createRange: () => ({ selectNodeContents() {} }), contains: (el: El) => doc.body.contains(el),
  addEventListener() {}, removeEventListener() {}, querySelector: (s: string) => doc.body.querySelector(s), querySelectorAll: (s: string) => doc.body.querySelectorAll(s),
};
doc.activeElement = doc.body;
/** install the fake page globals; returns a restorer (a later probe in the same process must not inherit a document / storage / dead timers) */
function installGlobals(): () => void {
  const G = globalThis as any; const keys = ['document', 'window', 'addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'localStorage', 'location', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame', '__readout', 'getComputedStyle', 'matchMedia'];
  const prev = new Map<string, any>(); for (const k of keys) prev.set(k, Object.getOwnPropertyDescriptor(G, k));
  byId = new Map(); doc.body = new El('BODY'); doc.activeElement = doc.body;
  const store = new Map<string, string>();
  G.document = doc; G.window = G;
  G.addEventListener = () => {}; G.removeEventListener = () => {};
  G.innerWidth = 1930; G.innerHeight = 1100; G.devicePixelRatio = 1;
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  G.location = { hash: '', search: '', pathname: '/' };
  G.setInterval = () => 0;                        // (Panel's refresher and bindings' tension poll must not keep the process alive)
  G.requestAnimationFrame = () => 0; G.cancelAnimationFrame = () => {};
  G.getComputedStyle = () => new Proxy({}, { get: () => '' }); G.matchMedia = () => ({ matches: false, addEventListener() {} });
  G.__readout = { on: false, set() { /* */ } };   // (main.ts's read-out object: the 'debug read-out' row only builds when it exists)
  return () => { for (const [k, d] of prev) { if (d) Object.defineProperty(G, k, d); else delete G[k]; } };
}

// ---------------------------------------------------------------- instrument a Panel class: every row-building call lands in `rows` with the section it went to
function instrument(P: any, rows: Row[]) {
  const proto = P.prototype; if (proto.__inventoried) return; proto.__inventoried = true;
  const secName = new WeakMap<object, string>();
  const pathOf = (self: any, sec: any): string => { const n = secName.get(sec) ?? '?'; return typeof self.pathOf === 'function' ? (self.pathOf(sec) || n) : n; };
  const advOf = (self: any): boolean | undefined => typeof self.advanced === 'boolean' ? self.advanced : undefined;
  const num = (x: any) => (typeof x === 'number' ? +x.toFixed(6) : undefined);
  const btxt = (bs: any[]) => (bs ?? []).map(b => `[${b.text}${b.title ? ' — ' + b.title : ''}]`).join(' ');
  const o = { section: proto.section, slider: proto.slider, toggleBox: proto.toggleBox, select: proto.select, buttons: proto.buttons, text: proto.text, number: proto.number, numbers: proto.numbers };
  proto.section = function (name: string, ...rest: any[]) { const el = o.section.call(this, name, ...rest); secName.set(el, name); return el; };
  proto.slider = function (sec: any, label: string, min: number, max: number, step: number, _g: any, _s: any, title?: string, def?: any) { rows.push({ path: pathOf(this, sec), kind: 'slider', label, min: num(min), max: num(max), step: num(step), title: title ?? '', def: def !== undefined, extra: '', adv: advOf(this) }); return o.slider.apply(this, arguments as any); };
  proto.toggleBox = function (sec: any, label: string, _g: any, _s: any, title?: string, def?: any) { rows.push({ path: pathOf(this, sec), kind: 'toggle', label, title: title ?? '', def: def !== undefined, extra: '', adv: advOf(this) }); return o.toggleBox.apply(this, arguments as any); };
  proto.select = function (sec: any, label: string, options: string[], _g: any, _s: any, title?: string) { rows.push({ path: pathOf(this, sec), kind: 'select', label, title: title ?? '', def: false, extra: (options ?? []).join(' / '), adv: advOf(this) }); return o.select.apply(this, arguments as any); };
  proto.buttons = function (sec: any, label: string, btns: any[]) { rows.push({ path: pathOf(this, sec), kind: 'buttons', label, title: '', def: false, extra: btxt(btns), adv: advOf(this) }); return o.buttons.apply(this, arguments as any); };
  proto.text = function (sec: any, get: () => string) { let first = ''; try { first = String(get()); } catch (e) { first = `(threw: ${(e as Error)?.message})`; } rows.push({ path: pathOf(this, sec), kind: 'text', label: '', title: '', def: false, extra: first.slice(0, 60), adv: advOf(this) }); return o.text.apply(this, arguments as any); };
  proto.number = function (sec: any, label: string, _g: any, _s: any, opts: any = {}) { rows.push({ path: pathOf(this, sec), kind: 'number', label, min: num(opts.min), max: num(opts.max), step: num(opts.step), title: opts.title ?? '', def: opts.def !== undefined, extra: '', adv: advOf(this) }); return o.number.apply(this, arguments as any); };
  proto.numbers = function (sec: any, label: string, n: number, _g: any, _s: any, opts: any = {}) { rows.push({ path: pathOf(this, sec), kind: 'numbers', label, step: num(opts.step), title: opts.title ?? '', def: opts.defs !== undefined, extra: `×${n}`, adv: advOf(this) }); return o.numbers.apply(this, arguments as any); };
}

/** the identity of a row for the diff: everything the maintainer can see or search, nothing about WHERE it sits */
export function rowKey(r: Row): string { return [r.kind, r.label, r.min ?? '', r.max ?? '', r.step ?? '', r.title, r.def ? 'def' : '', r.kind === 'text' ? '' : r.extra].join('¦'); }

/** materialise src/ui/bindings.ts + panel.ts of a git ref into a scratch dir with their imports pointed at the live tree (panel.ts at the ref's own copy) */
function materialise(ref: string): { bindings: string; dir: string } {
  const show = (p: string) => { const r = Bun.spawnSync(['git', '-C', ROOT, 'show', `${ref}:${p}`]); if (!r.success) throw new Error(`git show ${ref}:${p} failed: ${new TextDecoder().decode(r.stderr)}`); return new TextDecoder().decode(r.stdout); };
  const dir = join(SCRATCH, ref.replace(/[^\w.-]/g, '_')); mkdirSync(dir, { recursive: true });
  const rewrite = (src: string) => src.replace(/from\s+'\.\/panel'/g, `from './panel.ts'`).replace(/from\s+'\.\.\/([^']+)'/g, (_m, p) => `from '${ROOT}/src/${p}.ts'`).replace(/from\s+'\.\/(?!panel\.ts)([^']+)'/g, (_m, p) => `from '${ROOT}/src/ui/${p}.ts'`);
  writeFileSync(join(dir, 'panel.ts'), show('src/ui/panel.ts')); writeFileSync(join(dir, 'bindings.ts'), rewrite(show('src/ui/bindings.ts')));
  return { bindings: join(dir, 'bindings.ts'), dir };
}

/** stand the game up and build a panel from the given bindings + panel modules; returns the rows in build order */
async function inventoryOf(bindingsPath: string, panelPath: string, W: any): Promise<Row[]> {
  const rows: Row[] = [];
  const PM = await import(panelPath); instrument(PM.Panel, rows);
  const BM = await import(bindingsPath);
  const g = W.game;
  // the stand-ins main.ts hands buildPanel: the real Game / camera / settings / lights / world, fakes for what only a GPU page has (they answer any read; nothing throws)
  const engineReal = W.engine;
  const engine = new Proxy(engineReal, { get(t, p) { if (p in t) return (t as any)[p]; if (p === 'particles') return fake('particles'); return fake(`engine.${String(p)}`); } });
  const smoke = new Proxy(W.smoke, { get(t, p) { if (p in t) return (t as any)[p]; return fake(`smoke.${String(p)}`); } });
  const overlay = { showLightDots: true, windViz: fake('windViz') };
  const panel = new PM.Panel();
  BM.buildPanel(panel, engine, g, smoke, W.cam, overlay, fake('audio'), fake('quality'), () => ({ fps: 60, union: 8 }));
  return rows;
}

function group(rows: Row[]): Map<string, Row[]> { const m = new Map<string, Row[]>(); for (const r of rows) { const a = m.get(r.path) ?? []; a.push(r); m.set(r.path, a); } return m; }
function multiset(rows: Row[]): Map<string, Row[]> { const m = new Map<string, Row[]>(); for (const r of rows) { const k = rowKey(r); const a = m.get(k) ?? []; a.push(r); m.set(k, a); } return m; }
const show = (r: Row) => `${r.kind.padEnd(7)} ${r.label || (r.kind === 'text' ? `“${r.extra}”` : '(no label)')}${r.kind === 'slider' ? ` [${r.min}‥${r.max} step ${r.step}]` : ''}${r.kind === 'buttons' ? ` ${r.extra}` : ''}${r.def ? ' ●' : ''}  @ ${r.path}`;

/** the probe: live vs frozen (or vs --ref); prints the table, the moves, the additions, and a '- PASS —' / '- FAIL —' line */
export async function panelInventory(argv: string[] = process.argv.slice(2)): Promise<boolean> {
  const refI = argv.indexOf('--ref'); const ref = refI >= 0 ? argv[refI + 1] : null; const write = argv.includes('--write'); const print = argv.includes('--print');
  console.log(`\n=== panel-inventory: every Tab-panel row bindings.ts builds, held against ${ref ? `the panel at ${ref}` : 'main\'s frozen inventory (tools/qa/fixtures/panel-inventory-main.json)'} ===`);
  const restore = installGlobals();
  try {
    const W = await standUp();
    let before: Row[] | null = null;
    if (ref || write) {
      const m = materialise(ref ?? 'HEAD');
      before = await inventoryOf(m.bindings, join(m.dir, 'panel.ts'), W);
      if (write) { writeFileSync(FIXTURE, JSON.stringify(before.map(({ adv: _a, ...r }) => r), null, 1) + '\n'); console.log(`  wrote ${before.length} rows of ${ref ?? 'HEAD'} → ${FIXTURE}`); }
    }
    if (!before) { if (!existsSync(FIXTURE)) { console.log('- FAIL — no fixture (run with --write --ref main once)'); return false; } before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Row[]; }
    if (write && !ref) { console.log('  (fixture written from HEAD; nothing compared)'); return true; }
    const live = await inventoryOf(`${ROOT}/src/ui/bindings.ts`, `${ROOT}/src/ui/panel.ts`, W);
    // the table: rows per live path
    const G = group(live); console.log(`\n  live panel: ${live.length} rows in ${G.size} sections (${live.filter(r => r.adv).length} advanced) · reference: ${before.length} rows in ${group(before).size} sections`);
    for (const [p, rs] of G) console.log(`    ${String(rs.length).padStart(3)}  ${p}${rs.every(r => r.adv) ? '  (all advanced)' : rs.some(r => r.adv) ? `  (${rs.filter(r => r.adv).length} adv)` : ''}`);
    if (print) { console.log(''); for (const r of live) console.log('    ' + show(r)); }
    // the diff as multisets on the visible identity
    const A = multiset(before), B = multiset(live);
    const missing: Row[] = [], added: Row[] = []; let moved = 0; const moves = new Map<string, number>();
    for (const [k, rs] of A) { const bs = B.get(k) ?? []; if (bs.length < rs.length) missing.push(...rs.slice(bs.length)); for (let i = 0; i < Math.min(rs.length, bs.length); i++) if (rs[i].path !== bs[i].path) { moved++; const mk = `${rs[i].path} → ${bs[i].path}`; moves.set(mk, (moves.get(mk) ?? 0) + 1); } }
    for (const [k, rs] of B) { const as_ = A.get(k) ?? []; if (rs.length > as_.length) added.push(...rs.slice(as_.length)); }
    console.log(`\n  moved: ${moved} row(s) now live under another path (${moves.size} distinct moves)`); for (const [mk, n] of [...moves].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`    ${String(n).padStart(3)}  ${mk}`);
    console.log(`\n  added: ${added.length} row(s) not in the reference`); for (const r of added) console.log('    + ' + show(r));
    // near-misses: for each missing row, the live row with the same kind + label (a range / tooltip / button reworded) — the usual slip
    if (missing.length) { console.log(`\n  MISSING: ${missing.length} reference row(s) with no equal in the live panel`); for (const r of missing) { console.log('    - ' + show(r)); const near = live.find(x => x.kind === r.kind && x.label === r.label && rowKey(x) !== rowKey(r)); if (near) console.log(`        nearest live: ${show(near)}\n        differs in:${near.min !== r.min || near.max !== r.max || near.step !== r.step ? ' range/step' : ''}${near.title !== r.title ? ' tooltip' : ''}${near.extra !== r.extra ? ' buttons/options' : ''}${near.def !== r.def ? ' revert-dot' : ''}`); } }
    const rwI = argv.indexOf('--reword');
    if (rwI >= 0 && !ref && missing.length) {
      const mapPath = argv[rwI + 1] && !argv[rwI + 1].startsWith('--') ? argv[rwI + 1] : null; const ren: Record<string, string> = mapPath ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
      const pool = [...added]; let n = 0; const left: Row[] = [];
      for (const r of missing) { const want = ren[r.label] ?? r.label; const i = pool.findIndex(x => x.kind === r.kind && x.label === want); if (i < 0) { left.push(r); continue; } const [x] = pool.splice(i, 1); const { adv: _a, ...row } = x; before[before.indexOf(r)] = row as Row; n++; console.log(`    reworded in the fixture: ${show(r)}  →  ${x.label}`); }
      writeFileSync(FIXTURE, JSON.stringify(before, null, 1) + '\n'); console.log(`  --reword: ${n} fixture row(s) rewritten, ${left.length} still missing`); missing.length = 0; missing.push(...left);
    }
    const ok = missing.length === 0;
    console.log(`\n- ${ok ? 'PASS' : 'FAIL'} — ${missing.length} missing of ${before.length} reference rows · ${live.length} live (${added.length} added, ${moved} moved)`);
    return ok;
  } finally { restore(); try { rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* */ } }
}

if (import.meta.main) { const ok = await panelInventory(); process.exit(ok ? 0 : 1); }
