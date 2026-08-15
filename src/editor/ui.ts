// The editor page's chrome (editor.html): the top bar (file, undo / redo, tools + gizmo modes, floor, view toggles, quality, validate / lint /
// play, status), the left PALETTE (box presets, light presets, volume kinds, materials, the G2 / G4 stubs greyed), the right INSPECTOR
// (outliner over the sheet — sheet.ts), the PROBLEMS panel (validate + lint findings, click selects + frames), the HUD / log / help lines,
// drag-and-drop + file picker loading, the autosave timer. DOM is rebuilt on selection / document changes only; text nodes every 10 frames.
import { Panel } from '../ui/panel';
import { QUALITY_NAMES } from '../ui/quality';
import { Editor, parseRef } from './editor';
import { Tools, ToolName } from './tools';
import { View } from './view';
import { Scene } from './scene';
import { buildSheet } from './sheet';
import { PaintUi } from './paintui';
import type { Overlay } from './overlay';
import { BOX_PRESETS, LIGHT_PRESETS, VOLUME_KINDS } from './geom';
import { formatLint, Finding } from './lint';
import * as persist from './persist';
import { swatchCss } from './paint';

export interface UiHost {
  ed: Editor; tools: Tools; view: View; scene: Scene;
  /** the 2D overlay + the view canvas (the Markings tab outlines its face on the one and picks faces by clicks on the other); absent headless */
  overlay?: Overlay | null; viewEl?: HTMLElement | null;
  quality?: (name?: string) => string;
  play: () => void;
  hudLine: () => string;
  /** dev server present (GET /levels/ answered): enables save-to-server + the server list */
  server: { available: boolean; list: persist.ServerEntry[] };
  /** container overrides (the workbench houses the editor's chrome in its own layout); absent = the page's ids as ever */
  els?: Partial<UiEls>;
  /** the brand text in the top bar (default '2.6 editor') — the workbench puts its own */
  brand?: string;
}
/** every element the chrome hangs on, by role (editor.html's ids are the defaults) */
export interface UiEls { topbar: HTMLElement; palette: HTMLElement; outliner: HTMLElement; props: HTMLElement; hud: HTMLElement; log: HTMLElement; help: HTMLElement; problems: HTMLElement; drop: HTMLElement; filepick: HTMLInputElement; proptitle: HTMLElement; insphead: HTMLElement; matpane: HTMLElement; markpane: HTMLElement; stage: HTMLElement; app: HTMLElement; inspgrip: HTMLElement | null; splitter: HTMLElement | null }
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (text: string, title: string, run: () => void, cls = 'tb') => { const b = el('button', cls, text) as HTMLButtonElement; b.title = title; b.onclick = () => run(); return b; };

export class Ui {
  sheet: Panel; problemsOpen = false;
  /** the inspector's Materials / Markings tabs */
  paintUi: PaintUi;
  private $!: UiEls & { status: HTMLElement | null; fps: HTMLElement | null; loadmenu: HTMLElement | null; savemenu: HTMLElement | null };
  private toolBtns = new Map<string, HTMLElement>(); private modeBtns = new Map<string, HTMLElement>(); private toggles: (() => void)[] = [];
  private selKey = ''; private docRev = -1; private outlinerRev = -1; private expanded = new Set<string>(['lights', 'doors', 'routes', 'marks', 'floors', 'devices']);
  private messages: { text: string; t: number }[] = [];
  private findings: { text: string; sev: string; ids: string[] }[] = [];
  lastAutosave = 0;

  constructor(readonly H: UiHost) {
    const { ed } = H;
    const g = (id: string) => document.getElementById(id) as HTMLElement; const E = H.els ?? {};
    this.$ = { topbar: E.topbar ?? g('topbar'), palette: E.palette ?? g('palette'), outliner: E.outliner ?? g('outliner'), props: E.props ?? g('props'), hud: E.hud ?? g('hud'), log: E.log ?? g('log'), help: E.help ?? g('help'), problems: E.problems ?? g('problems'), drop: E.drop ?? g('drop'), filepick: (E.filepick ?? g('filepick')) as HTMLInputElement, proptitle: E.proptitle ?? g('proptitle'), insphead: E.insphead ?? g('insphead'), matpane: E.matpane ?? g('matpane'), markpane: E.markpane ?? g('markpane'), stage: E.stage ?? g('stage'), app: E.app ?? g('app'), inspgrip: E.inspgrip !== undefined ? E.inspgrip : g('inspgrip'), splitter: E.splitter !== undefined ? E.splitter : g('splitter'), status: null, fps: null, loadmenu: null, savemenu: null };
    this.sheet = new Panel({ root: this.$.props, header: false, persistKey: 'twopointsix.editor.sheetOpen' }); this.sheet.visible = true;
    ed.onMsg = t => this.msg(t);
    ed.onSelect.push(() => { this.rebuildSheet(); this.paintOutlinerSel(); });
    ed.onSettings.push(() => this.refreshToggles());
    ed.onProblems.push(items => { this.findings = items.map(x => ({ ...x })); this.showProblems(true); });   // a verb's findings (a resize dropped a marking; a restored document opened WITH problems) go where validate / lint put theirs
    H.tools.onToolChange.push(() => this.paintTools());
    this.buildTopbar(); this.buildPalette(); this.wireFiles(); this.wireInspector();
    this.paintUi = new PaintUi({ ed, tools: H.tools, view: H.view, scene: H.scene, overlay: H.overlay ?? null, viewEl: H.viewEl ?? null, msg: t => this.msg(t) }, { head: this.$.insphead, props: this.$.props, mat: this.$.matpane, mark: this.$.markpane, title: this.$.proptitle });
    this.$.help.textContent = 'LMB select (shift = toggle, drag = marquee) · drag = move (Alt up/down) · G/S/R move/resize/rotate · B box · V volume · L light · D door · P route · C camera · K keypad (markings when a box is selected) · J laser · M materials · RMB orbit · MMB / Space-drag pan · wheel zoom · T plan · F frame · X snap · O grid · H hidden · N day · Del · ⌘/Ctrl Z / ⇧Z / D / S · arrows nudge (⇧ fine, Alt vertical) · Esc';
    this.rebuildSheet(); this.rebuildOutliner();
    if (ed.loadProblems.length) { this.findings = ed.loadProblems.map(x => ({ ...x })); this.showProblems(true); this.msg(`'${ed.data.name}' was opened WITH ${ed.loadErrors.length} PROBLEM(S) — the game cannot load it until they are fixed (listed below)`); }   // (a boot-time restore reported before this panel existed)
  }
  msg(text: string) { this.messages.push({ text, t: performance.now() / 1000 }); if (this.messages.length > 6) this.messages.shift(); this.$.log.textContent = this.messages.map(m => m.text).join('\n'); }

  // ---------------------------------------------------------------- top bar
  private buildTopbar() {
    const { ed, tools, view } = this.H; const t = this.$.topbar; t.textContent = '';
    const row1 = el('div', 'tabs'); const row2 = el('div', 'tabs'); t.append(row1, row2);
    row1.append(el('span', 'brand', this.H.brand ?? '2.6 editor'));
    // file
    row1.append(btn('load ▾', 'load a level: file picker · drop a .json on the view · the autosave slot · the dev server\'s levels/', () => this.toggleMenu('loadmenu')), btn('save ▾', 'save: download · to the dev server (levels/<name>.json) · autosave now', () => this.toggleMenu('savemenu')));
    row1.append(btn('↶', 'undo (⌘/Ctrl Z)', () => ed.undo()), btn('↷', 'redo (⌘/Ctrl ⇧Z)', () => ed.redo()));
    row1.append(el('span', 'sep', '│'));
    for (const [k, label, title] of [['select', '⬚ select', 'select / move (Esc)'], ['box', '▭ box B', 'draw a box footprint (preset from the palette)'], ['volume', '▧ vol V', 'draw a volume footprint'], ['light', '✺ light L', 'place a light'], ['door', '⌐ door D', 'place a door: press at the hinge, drag along the leaf'], ['route', '⤳ route P', 'draw a patrol route: click waypoints, Enter']] as [ToolName, string, string][]) { const b = btn(label, title, () => tools.setTool(k), 'tb tool'); this.toolBtns.set(k, b); row1.append(b); }
    row1.append(el('span', 'sep', '│'));
    for (const [k, label, title] of [['move', 'G move', 'drag = move on the floor'], ['resize', 'S resize', 'face handles on the selected box'], ['rotate', 'R rotate', 'yaw ring (Ctrl = 15°)']] as const) { const b = btn(label, title, () => tools.setMode(k), 'tb mode'); this.modeBtns.set(k, b); row1.append(b); }
    row1.append(el('span', 'spacer'));
    const status = el('span', 'status', ''); this.$.status = status; row1.append(status);
    // row 2: floor · toggles · quality · validate / lint / play
    row2.append(el('span', 'k', 'floor'));
    const floorSel = el('select', 'tbsel') as HTMLSelectElement; floorSel.title = 'the floor being edited (grid height, where new things go, what the marquee takes)'; floorSel.onchange = () => { ed.setFloor(floorSel.value); floorSel.blur(); };
    const paintFloors = () => { floorSel.textContent = ''; for (const f of ed.data.floors) { const o = el('option', '', `${f.id}${f.name ? ` · ${f.name}` : ''} (y ${f.y})`) as HTMLOptionElement; o.value = f.id; floorSel.append(o); } floorSel.value = ed.floorId; };
    paintFloors(); this.toggles.push(paintFloors); row2.append(floorSel);
    const tog = (label: string, title: string, get: () => boolean, set: (v: boolean) => void) => { const l = el('label', 'tog'); l.title = title; const c = el('input') as HTMLInputElement; c.type = 'checkbox'; c.onchange = () => { set(c.checked); c.blur(); }; l.append(c, document.createTextNode(' ' + label)); this.toggles.push(() => { c.checked = get(); }); row2.append(l); return c; };
    tog('grid O', 'floor grid overlay (1 m; the snap step when close)', () => ed.settings.grid, v => ed.set('grid', v));
    tog('snap X', 'snap moves / new corners to the step', () => ed.settings.snap, v => ed.set('snap', v));
    const stepSel = el('select', 'tbsel') as HTMLSelectElement; stepSel.title = 'snap step (m)'; for (const s of [1, 0.5, 0.25, 0.125, 0.1, 0.05, 0.01]) { const o = el('option', '', String(s)) as HTMLOptionElement; o.value = String(s); stepSel.append(o); } stepSel.onchange = () => { ed.set('snapStep', parseFloat(stepSel.value)); stepSel.blur(); }; this.toggles.push(() => { if (![...stepSel.options].some(o => +o.value === ed.settings.snapStep)) { const o = el('option', '', String(ed.settings.snapStep)) as HTMLOptionElement; o.value = String(ed.settings.snapStep); stepSel.append(o); } stepSel.value = String(ed.settings.snapStep); }); row2.append(stepSel);
    tog('plan T', 'top-down plan view', () => view.plan, v => view.togglePlan(v));
    tog('day N', 'the daylight variant (data.daylight) — night is the default', () => ed.settings.day, v => { if (ed.data.daylight) ed.set('day', v); else this.msg('this level has no daylight variant'); });
    tog('hidden H', 'draw + pick NoPrimary boxes (ceiling slab, panels)', () => ed.settings.showHidden, v => ed.set('showHidden', v));
    tog('door cut+frame', 'placing a door cuts the wall it lands in and builds its frame', () => this.H.tools.doorAuto, v => { this.H.tools.doorAuto = v; });
    row2.append(el('span', 'k', 'quality'));
    const qSel = el('select', 'tbsel') as HTMLSelectElement; qSel.title = 'renderer preset (the game\'s Quality presets; the editor never touches the game\'s remembered pick)'; for (const n of QUALITY_NAMES) { const o = el('option', '', n) as HTMLOptionElement; o.value = n; qSel.append(o); } qSel.onchange = () => { this.H.quality?.(qSel.value); qSel.blur(); }; this.toggles.push(() => { if (this.H.quality) qSel.value = this.H.quality(); }); row2.append(qSel);
    row2.append(el('span', 'sep', '│'));
    row2.append(btn('validate', 'run the schema validator (validateLevelData) → the problems panel', () => this.runChecks(false)), btn('lint', 'validate + level lint (reachability, sealing, overlaps, budgets…) → the problems panel', () => this.runChecks(true)), btn('▶ play from here', 'hand the current document to the game (?level=local) in a new tab', () => this.H.play(), 'tb play'));
    row2.append(el('span', 'spacer')); const fps = el('span', 'fps', ''); fps.id = 'fps'; row2.append(fps); this.$.fps = fps;
    // menus
    const loadMenu = el('div', 'menu hidden'); loadMenu.id = 'loadmenu'; const saveMenu = el('div', 'menu hidden'); saveMenu.id = 'savemenu'; t.append(loadMenu, saveMenu); this.$.loadmenu = loadMenu; this.$.savemenu = saveMenu;
    this.paintTools(); this.refreshToggles();
  }
  private toggleMenu(id: string) {
    const m = document.getElementById(id) ?? (id === 'loadmenu' ? this.$.loadmenu : this.$.savemenu)!; const other = document.getElementById(id === 'loadmenu' ? 'savemenu' : 'loadmenu') ?? (id === 'loadmenu' ? this.$.savemenu : this.$.loadmenu)!; other.classList.add('hidden');   // (by id first: the probes' fake DOM registers elements by id lookups)
    const open = m.classList.contains('hidden'); m.classList.toggle('hidden', !open); if (!open) return;
    m.textContent = ''; const { ed } = this.H; const S = this.H.server;
    if (id === 'loadmenu') {
      m.append(btn('open file…', 'pick a .json level file', () => { this.$.filepick.click(); this.closeMenus(); }, 'mi'));
      const a = persist.readAutosave(); m.append(btn(a ? `autosave: ${a.name} · ${new Date(a.t).toLocaleString()}` : 'autosave: (empty)', 'restore the localStorage autosave slot', () => { if (a) { try { const errs = ed.load(a.text, { keepSaved: true, lenient: true }); this.msg(errs.length ? `restored autosave of '${a.name}' — with ${errs.length} problem(s), listed` : `restored autosave of '${a.name}'`); } catch (e) { this.msg(String((e as Error).message)); } } this.closeMenus(); }, 'mi'));
      m.append(btn('new blank level', 'an empty level with the current palette, one floor, a ground slab and the mission marks', () => { if (!ed.doc.dirty || confirm('discard unsaved changes?')) { ed.load(Editor.blank('untitled', ed.data.materials)); this.msg('blank level'); } this.closeMenus(); }, 'mi'));
      m.append(btn('the bundled office', 'reload levels/office.json as built into this page', () => { if (!ed.doc.dirty || confirm('discard unsaved changes?')) (window as any).__edLoadBundled?.(); this.closeMenus(); }, 'mi'));
      m.append(el('div', 'mh', S.available ? 'dev server · levels/' : 'dev server: not available (static page)'));
      if (S.available) { void persist.serverList().then(list => { if (list) S.list = list; for (const f of S.list) m.append(btn(`${f.name}.json · ${(f.bytes / 1024).toFixed(0)} KB`, new Date(f.mtime).toLocaleString(), () => { void (window as any).__ed.save.serverLoad(f.name).then(() => this.msg(`loaded ${f.name}.json from the server`), (e: Error) => this.msg(String(e.message))); this.closeMenus(); }, 'mi')); }); }
    } else {
      m.append(btn(`download ${ed.data.name}.json`, 'save as a file (canonical one-entity-per-line JSON)', () => { persist.download(ed.data.name, ed.serialize()); ed.doc.markSaved(); this.msg(`downloaded ${ed.data.name}.json`); this.closeMenus(); }, 'mi'));
      m.append(btn(S.available ? `save to server: levels/${ed.data.name}.json  (⌘/Ctrl S)` : 'save to server: (no dev server)', 'POST to tools/serve.ts — writes the repo file', () => { void this.saveServer(); this.closeMenus(); }, 'mi'));
      m.append(btn('autosave now', `write the localStorage slot (${persist.LS.autosave}) — also every 30 s and on unload`, () => { const s = persist.autosave(ed); this.msg(s ? `autosaved ${(s.text.length / 1024).toFixed(0)} KB` : 'autosave failed (storage full / unavailable)'); this.closeMenus(); }, 'mi'));
      m.append(btn('copy JSON to clipboard', '', () => { void navigator.clipboard?.writeText(ed.serialize()).then(() => this.msg('copied'), () => this.msg('clipboard blocked')); this.closeMenus(); }, 'mi'));
    }
  }
  closeMenus() { for (const id of ['loadmenu', 'savemenu']) (document.getElementById(id) ?? (id === 'loadmenu' ? this.$.loadmenu : this.$.savemenu))?.classList.add('hidden'); }
  /** the top bar's fps read-out (the page writes it from its loop) */
  setFps(text: string) { if (this.$.fps) this.$.fps.textContent = text; }
  async saveServer() {
    const { ed } = this.H; if (!this.H.server.available) { persist.download(ed.data.name, ed.serialize()); ed.doc.markSaved(); this.msg('no dev server — downloaded instead'); return; }
    try { const r = await persist.serverSave(ed.data.name, ed.serialize()); ed.doc.markSaved(); this.msg(`saved levels/${r.name}.json (${(r.bytes / 1024).toFixed(1)} KB) — the repo file changed`); } catch (e) { this.msg(String((e as Error).message)); }
  }
  private paintTools() { const T = this.H.tools; for (const [k, b] of this.toolBtns) b.classList.toggle('on', T.tool === k); for (const [k, b] of this.modeBtns) b.classList.toggle('on', T.mode === k); }
  refreshToggles() { for (const f of this.toggles) f(); }

  // ---------------------------------------------------------------- palette
  private buildPalette() {
    const { ed, tools } = this.H; const P = this.$.palette; P.textContent = '';
    P.append(el('div', 'ph', 'BOXES (B, drag)'));
    for (const pr of BOX_PRESETS) { const b = btn(pr.label, pr.title, () => { tools.boxPreset = pr.key; tools.setTool('box'); this.paintPalette(); }, 'pi box'); b.dataset.key = pr.key; P.append(b); }
    P.append(el('div', 'ph', 'LIGHTS (L, click)'));
    for (const pr of LIGHT_PRESETS) { const b = btn(pr.label, pr.title, () => { tools.lightPreset = pr.key; tools.setTool('light'); this.paintPalette(); }, 'pi light'); b.dataset.key = pr.key; P.append(b); }
    P.append(el('div', 'ph', 'VOLUMES (V, drag)'));
    for (const k of VOLUME_KINDS) { const b = btn(k, `${k} volume`, () => { tools.volumeKind = k; tools.setTool('volume'); this.paintPalette(); }, 'pi vol'); b.dataset.key = k; P.append(b); }
    P.append(el('div', 'ph', 'OTHER'));
    P.append(btn('door (D)', 'press at the hinge, drag along the leaf', () => tools.setTool('door'), 'pi'), btn('route (P)', 'click waypoints, Enter', () => tools.setTool('route'), 'pi'), btn('post', 'a lockdown chokepoint at the view centre', () => { ed.addChokepoint({ pos: [this.H.view.focus[0], 0, this.H.view.focus[2]] }); }, 'pi'));
    P.append(el('div', 'ph', 'DEVICES (C / K / J)'));
    for (const [k, label, title] of [['camera', 'camera (C)', 'a wall camera: click the floor under where it hangs — it looks the way the view looks; aim dot / R / the sheet then'], ['keypad', 'keypad (K)', 'a keypad lock: click beside a door on the face that carries the pad — the door goes on the pad\'s own lock'], ['laser', 'laser (J)', 'a tripwire: press at the emitter, drag to the receiver (shin height; raise it in the sheet)']] as [ToolName, string, string][]) { const b = btn(label, title, () => { tools.setTool(k); this.paintPalette(); }, 'pi dev'); b.dataset.key = k; P.append(b); }
    { const b = btn('stair (G2)', 'stair: typed stub in the format — lane G2 fills it in', () => this.msg('stair: not yet — lane G2'), 'pi stub') as HTMLButtonElement; b.disabled = true; P.append(b); }
    P.append(el('div', 'ph', 'MATERIALS (click = paint sel.)'));
    const mats = el('div', 'mats'); P.append(mats);
    const paintMats = () => { mats.textContent = ''; for (const [name, m] of Object.entries(ed.data.materials)) { const sw = btn('', `${name}  [${m.albedo.map(x => x.toFixed(2)).join(' ')}]${m.rough !== undefined ? ` rough ${m.rough}${m.metal ? ' metal' : ''}` : ' matte'} — click paints the selected boxes (and opens it in the Materials tab when that is up)`, () => { const ids = ed.selected('box').map(r => r.id); if (this.paintUi?.tab === 'materials') { this.paintUi.paint = name; this.paintUi.tick(true); } if (ids.length) { ed.setBoxMaterial(ids, name); this.msg(`painted ${ids.length} ${name}`); } else if (this.paintUi?.tab !== 'materials') this.msg('select boxes first (or M: edit the paint itself)'); }, 'sw'); sw.style.background = swatchCss(m.albedo, m.rough, m.metal); sw.append(el('span', 'swn', name)); mats.append(sw); } };
    paintMats(); (this as any).paintMats = paintMats;
    this.paintPalette();
  }
  private paintPalette() { const T = this.H.tools; for (const b of Array.from(this.$.palette.querySelectorAll?.('button.pi') ?? []) as HTMLElement[]) { const k = b.dataset.key; b.classList.toggle('on', (b.classList.contains('box') && T.tool === 'box' && k === T.boxPreset) || (b.classList.contains('light') && T.tool === 'light' && k === T.lightPreset) || (b.classList.contains('vol') && T.tool === 'volume' && k === T.volumeKind) || (b.classList.contains('dev') && T.tool === k)); } }

  // ---------------------------------------------------------------- files: picker, drag-drop
  private wireFiles() {
    const { ed } = this.H; const fp = this.$.filepick;
    const readFile = (f: File) => { void f.text().then(t => { try { ed.load(t); this.msg(`loaded ${f.name}`); } catch (e) { this.msg(String((e as Error).message).split('\n').slice(0, 3).join(' · ')); } }); };
    fp.onchange = () => { const f = fp.files?.[0]; if (f) readFile(f); fp.value = ''; };
    const stage = this.$.stage;
    stage.addEventListener('dragover', e => { e.preventDefault(); this.$.drop.classList.add('on'); });
    stage.addEventListener('dragleave', () => this.$.drop.classList.remove('on'));
    stage.addEventListener('drop', e => { e.preventDefault(); this.$.drop.classList.remove('on'); const f = (e as DragEvent).dataTransfer?.files?.[0]; if (f) readFile(f); });
  }

  // ---------------------------------------------------------------- inspector width / outliner height (persisted like the viewer's)
  private wireInspector() {
    const app = this.$.app; const K = { w: 'twopointsix.editor.inspW', h: 'twopointsix.editor.outlH' };
    if (!this.$.inspgrip && !this.$.splitter) return;   // (the workbench sizes its own columns)
    try { const w = parseInt(localStorage.getItem(K.w) ?? '', 10); if (w > 200 && w < 900) app.style.setProperty('--insp-w', `${w}px`); const oh = parseInt(localStorage.getItem(K.h) ?? '', 10); if (oh > 60 && oh < 2000) app.style.setProperty('--outl-h', `${oh}px`); } catch { /* */ }
    const drag = (el0: HTMLElement | null, onMove: (e: MouseEvent) => void, onEnd: () => void) => el0?.addEventListener('mousedown', e => {
      e.preventDefault(); document.body.classList.add('resizing');
      const mm = (ev: MouseEvent) => onMove(ev); const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); document.body.classList.remove('resizing'); onEnd(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    let pendW = 0, lastApply = 0; drag(this.$.inspgrip, e => { pendW = Math.round(Math.min(900, Math.max(220, window.innerWidth - e.clientX))); const now = performance.now(); if (now - lastApply > 120) { lastApply = now; app.style.setProperty('--insp-w', `${pendW}px`); } }, () => { if (pendW) { app.style.setProperty('--insp-w', `${pendW}px`); try { localStorage.setItem(K.w, String(pendW)); } catch { /* */ } } });
    let pendH = 0; drag(this.$.splitter, e => { const top = this.$.outliner.getBoundingClientRect().top; pendH = Math.round(Math.max(60, e.clientY - top)); app.style.setProperty('--outl-h', `${pendH}px`); }, () => { if (pendH) { try { localStorage.setItem(K.h, String(pendH)); } catch { /* */ } } });
  }

  // ---------------------------------------------------------------- outliner
  rebuildOutliner() {
    const { ed } = this.H; const root = this.$.outliner; root.textContent = ''; this.rows.clear();
    const node = (id: string, label: string, depth: number, o: { grp?: boolean; kids?: boolean; dim?: boolean; title?: string } = {}) => {
      const r = el('div', 'n' + (o.grp ? ' grp' : '') + (o.dim ? ' dim' : '')); r.style.paddingLeft = `${4 + depth * 12}px`;
      const tw = el('span', 'tw', o.kids ? (this.expanded.has(id) ? '▾' : '▸') : ' '); r.append(tw, document.createTextNode(label)); if (o.title) r.title = o.title;
      r.onclick = e => { e.stopPropagation(); if (o.grp) { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); this.rebuildOutliner(); return; } ed.select(id, (e as MouseEvent).shiftKey ? 'toggle' : 'replace'); };
      root.append(r); if (!o.grp) this.rows.set(id, r); return this.expanded.has(id);
    };
    const d = ed.data;
    if (node('floors', `floors (${d.floors.length})`, 0, { grp: true, kids: true })) for (const f of d.floors) node(`floor:${f.id}`, `${f.id} ${f.name ?? ''} · y ${f.y}`, 1);
    if (node('lights', `lights (${d.lights.length})`, 0, { grp: true, kids: true })) for (const l of d.lights) node(`light:${l.id}`, `${l.id} · ${l.kind} ${l.enabled ? l.intensity : 'off'} · ${l.group}`, 1, { dim: !l.enabled });
    if (node('sws', `switchables (${d.switchables.length})`, 0, { grp: true, kids: true })) { const byG = new Map<string, typeof d.switchables>(); for (const s of d.switchables) byG.set(s.group, [...(byG.get(s.group) ?? []), s]); for (const [g, list] of byG) { if (node(`swg:${g}`, `${g} (${list.length})`, 1, { grp: true, kids: true })) for (const s of list) node(`sw:${s.id}`, `${s.id} · ${s.on ? 'on' : 'off'} · ${s.boxes.length} box`, 2, { dim: !s.on }); } }
    if (node('doors', `doors (${d.doors.length})`, 0, { grp: true, kids: true })) for (const o of d.doors) node(`door:${o.id}`, `${o.id}${o.locked ? ' 🔒' : ''}${o.exterior ? ' ext' : ''} · ${o.width} m`, 1);
    if (node('routes', `routes (${d.routes.length})`, 0, { grp: true, kids: true })) for (const r of d.routes) node(`route:${r.id}`, `${r.name ?? r.id} · ${r.points.length} pts${r.weapon ? ' · ' + r.weapon : ''}`, 1);
    if (node('volumes', `volumes (${d.volumes.length})`, 0, { grp: true, kids: d.volumes.length > 0 })) for (const v of d.volumes) node(`volume:${v.id}`, `${v.kind} ${v.id}`, 1);
    if (node('posts', `chokepoints (${d.chokepoints.length})`, 0, { grp: true, kids: d.chokepoints.length > 0 })) for (const c of d.chokepoints) node(`chokepoint:${c.id}`, `${c.name ?? c.id}`, 1);
    if (node('marks', 'mission marks', 0, { grp: true, kids: true })) { node('mark:spawn', 'spawn', 1); for (const o of d.mission.objectives) node(`mark:${o.id}`, `${o.kind}: ${o.id}`, 1); }
    if (node('devices', `devices (${d.devices.length})`, 0, { grp: true, kids: d.devices.length > 0, title: 'cameras / keypads / laser tripwires (game/devices.ts)' })) for (const v of d.devices) node(`device:${v.id}`, v.kind === 'camera' ? `◉ ${v.id}${v.sweep ? ' · pans' : ''}${v.mains === false ? ' · UPS' : ''}` : v.kind === 'keypad' ? `▣ ${v.id} → ${v.door} (${v.code})` : `≋ ${v.id} · y ${v.from[1].toFixed(2)}${v.mains === false ? ' · UPS' : ''}${v.alarm === 'alarm' ? ' · alarm' : ''}`, 1);
    node('connectors', `connectors (${d.connectors.length}) — G2`, 0, { grp: true, kids: false, dim: true, title: 'stairs between floors: typed stubs' });
    if (node('props', `props (${d.props.length})`, 0, { grp: true, kids: d.props.length > 0 })) for (const p of d.props) node(`prop:${p.id}`, `${p.id} (${p.kind})`, 1);
    if (node('groups', 'box groups', 0, { grp: true, kids: true })) { const byG = new Map<string, number>(); for (const b of d.boxes) byG.set(b.group ?? '(none)', (byG.get(b.group ?? '(none)') ?? 0) + 1); for (const [g, n] of [...byG].sort()) { const r = el('div', 'n'); r.style.paddingLeft = '16px'; r.append(el('span', 'tw', ' '), document.createTextNode(`${g} (${n})`)); r.title = 'click: select every box in the group (shift adds)'; r.onclick = e => { ed.select(d.boxes.filter(b => (b.group ?? '(none)') === g).map(b => `box:${b.id}`), (e as MouseEvent).shiftKey ? 'add' : 'replace'); }; root.append(r); } }
    this.outlinerRev = ed.doc.rev; this.paintOutlinerSel();
  }
  private rows = new Map<string, HTMLElement>();
  private paintOutlinerSel() { const sel = this.H.ed.sel; for (const [id, r] of this.rows) r.classList.toggle('sel', sel.has(id)); }

  // ---------------------------------------------------------------- sheet + problems
  rebuildSheet() {
    buildSheet(this.sheet, { ed: this.H.ed, tools: this.H.tools, frame: () => this.H.tools.frameSelection(), rebuild: () => this.rebuildSheet() });
    const sel = this.H.ed.selection(); this.$.proptitle.textContent = sel.length === 0 ? '· level' : sel.length === 1 ? `· ${sel[0]}` : `· ${sel.length} selected`;
    this.selKey = sel.join('|'); this.docRev = this.H.ed.doc.rev;
  }
  runChecks(withLint: boolean) {
    const { ed } = this.H; const v = ed.validate();
    this.findings = v.map(e => ({ text: `SCHEMA ${e}`, sev: 'error', ids: [] }));
    let summary = `validate: ${v.length ? `${v.length} error(s)` : 'clean'}`;
    if (withLint) { const r = ed.lint(); summary += ` · ${formatLint(r)[0]}`; for (const f of r.findings as Finding[]) if (f.code !== 'schema') this.findings.push({ text: `${f.severity.toUpperCase()} ${f.code}: ${f.message}`, sev: f.severity, ids: f.ids }); }
    this.msg(summary); this.showProblems(true);
  }
  showProblems(on: boolean) {
    this.problemsOpen = on; const P = this.$.problems; P.classList.toggle('hidden', !on); if (!on) return;
    P.textContent = ''; const head = el('div', 'phd'); head.append(el('span', '', `PROBLEMS (${this.findings.length}) — click selects`), el('span', 'spacer'), btn('×', 'close', () => this.showProblems(false), 'iconbtn')); P.append(head);
    if (!this.findings.length) P.append(el('div', 'pf ok', 'nothing to report'));
    for (const f of this.findings) { const r = el('div', `pf ${f.sev}`, f.text); r.title = f.ids.join(' '); r.onclick = () => { const refs = f.ids.map(x => x.includes(':') ? x : `box:${x}`).filter(x => { const q = parseRef(x); return q.kind !== 'route' || true; }).filter(x => this.H.ed.exists(x)); if (refs.length) { this.H.ed.select(refs); this.H.tools.frameSelection(); } }; P.append(r); }
  }

  // ---------------------------------------------------------------- per frame
  tick(frame: number) {
    const { ed } = this.H;
    if (ed.doc.rev !== this.docRev) { const selKey = ed.selection().join('|'); if (selKey !== this.selKey) this.rebuildSheet(); else { this.docRev = ed.doc.rev; this.sheet.refresh(); } }
    if (frame % 30 === 0 && ed.doc.rev !== this.outlinerRev) { this.rebuildOutliner(); (this as any).paintMats?.(); this.refreshToggles(); }
    this.paintUi.tick();
    if (frame % 10 === 0) {
      this.$.hud.textContent = this.H.hudLine();
      if (this.$.status) { this.$.status.textContent = `${ed.data.name} · ${ed.doc.dirty ? '● unsaved' : 'saved'} · undo ${ed.doc.undoStack.length}${this.lastAutosave ? ` · autosaved ${Math.round((Date.now() - this.lastAutosave) / 1000)} s ago` : ''}`; this.$.status.classList.toggle('dirty', ed.doc.dirty); }
      const nowS = performance.now() / 1000; this.$.log.textContent = this.messages.filter(m => nowS - m.t < 8).map(m => m.text).join('\n');
    }
  }
}
