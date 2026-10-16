// The inspector's MATERIALS and MARKINGS tabs (the 'material / texture editor'): the paint palette with live swatches, per-paint albedo / roughness /
// metal / notes editors, finish presets, per-box overrides for the selection — and, for the selected box, its pixel-art markings: face picker, frame
// (res / size / position), a cell PAINTER on a canvas, palette-entry editors that keep the rules (≤ 3 entries, materials not colours, ONE chroma across
// emitters), the generators, ASCII import / export, copy / paste / apply-to-pattern. Every control writes through paint.ts (one undoable command,
// coalesced per drag / stroke and sealed at its end), so the view — the game's own renderer — follows live on the next scene sync.
import type { Vec3 } from '../math/vec';
import { Panel } from '../ui/panel';
import type { BoxData } from '../scene/levelData';
import { Editor } from './editor';
import type { Tools } from './tools';
import type { View } from './view';
import type { Scene } from './scene';
import type { Overlay } from './overlay';
import { textRow } from './sheet';
import * as P from './paint';
import type { MarkFace, MarkRes, MarkingDef, MarkPal, GeneratorKind } from './paint';

export type InspTab = 'props' | 'materials' | 'markings';
export interface PaintUiHost { ed: Editor; tools: Tools; view: View; scene: Scene; /** the 2D overlay (draws the face / marking outline); absent headless */ overlay?: Overlay | null; /** the WebGPU view canvas (face picks by click); absent headless */ viewEl?: HTMLElement | null; msg: (t: string) => void }
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (text: string, title: string, run: () => void, cls = 'pb') => { const b = el('button', cls, text) as HTMLButtonElement; b.title = title; b.onclick = () => run(); return b; };
const f2 = (v: number) => (+v.toFixed(3)).toString();
const FACES: MarkFace[] = ['+x', '-x', '+y', '-y', '+z', '-z'];
const RESES: MarkRes[] = ['fine', 'base', 'coarse'];
/** ticks on the roughness slider: the finish presets' values (a <datalist> gives a native range input its tick marks) */
const ROUGH_TICKS = [0.08, 0.15, 0.22, 0.28, 0.35, 0.45, 0.5, 0.55, 0.6, 0.85, 1];

export class PaintUi {
  tab: InspTab = 'props';
  /** the paint the Materials tab is editing */
  paint: string | null = null;
  /** the Markings tab's subject: box, marking index, the face new markings go on / the overlay outlines, the painter's active entry (0 = erase) */
  mk = { boxId: null as string | null, i: 0, face: '+z' as MarkFace, entry: 1 };
  gen: { kind: GeneratorKind; params: Record<string, number> } = { kind: 'grid', params: {} };
  recipeKey = 'carton';
  pattern = { text: '', sameSize: true };
  /** true after a press on the painter until a press elsewhere: painter keys ([ ] 1 2 3 0, arrows, shift+arrows, H V, Del) are live */
  painterFocus = false;
  readonly mat: Panel; readonly mark: Panel;
  private matKey = '§'; private markKey = '§'; private lastRev = -1;
  private tabBtns = new Map<InspTab, HTMLElement>();
  private painter: { canvas: HTMLCanvasElement; cell: number; W: number; H: number; paintNow: () => void } | null = null;
  private stroke: { key: string; entry: number; last: [number, number] | null; rect: [number, number] | null; cur: [number, number] | null } | null = null;
  private newName = '';

  constructor(readonly H: PaintUiHost, readonly els: { head: HTMLElement; props: HTMLElement; mat: HTMLElement; mark: HTMLElement; title: HTMLElement }) {
    this.mat = new Panel({ root: els.mat, header: false, persistKey: 'twopointsix.editor.matOpen' }); this.mat.visible = true;
    this.mark = new Panel({ root: els.mark, header: false, persistKey: 'twopointsix.editor.markOpen' }); this.mark.visible = true;
    // the tab strip in the PROPERTIES header
    const strip = el('span', 'itabs');
    for (const [k, label, title] of [['props', 'properties', 'the property sheet for the selection (or the level)'], ['materials', 'materials M', 'the paint palette: albedo / roughness / metal per paint, live on every box using it; per-box overrides for the selection'], ['markings', 'markings K', 'the selected box\'s pixel-art markings: faces, the cell painter, palette entries, generators, ASCII']] as [InspTab, string, string][]) {
      const b = btn(label, title, () => this.show(k), 'itab'); this.tabBtns.set(k, b); strip.append(b);
    }
    els.head.textContent = ''; els.head.append(strip, els.title);
    H.tools.panes.materials = () => { this.show('materials'); H.msg('materials: pick a paint — its sliders repaint every box using it, live'); };
    H.tools.panes.markings = () => { const b = H.ed.selected('box')[0]; if (!b) return false; this.mk.boxId = b.id; const hv = H.tools.hover; if (hv?.ref === `box:${b.id}`) this.mk.face = this.faceUnderCursor(b.id) ?? this.mk.face; this.show('markings'); H.msg(`markings of ${b.id}: paint cells (LMB), erase (RMB), shift-drag fills; [ ] cycle the entry`); return true; };
    // a click on a box in the view while the Markings tab is up picks the FACE under the cursor (Tools selects the box as ever)
    H.viewEl?.addEventListener('mousedown', (e: MouseEvent) => {
      this.painterFocus = false;
      if (this.tab !== 'markings' || e.button !== 0) return;
      const r = (H.viewEl as HTMLElement).getBoundingClientRect(); const { ro, rd } = H.view.ray(e.clientX - r.left, e.clientY - r.top); const hit = H.scene.pick(ro, rd);
      if (hit && hit.ref.startsWith('box:')) { const id = hit.ref.slice(4); const b = H.ed.doc.get<BoxData>('boxes', id); if (b) { this.mk.face = P.faceOfNormal(hit.normal, b.yaw ?? 0); if (this.mk.boxId !== id) { this.mk.boxId = id; this.mk.i = 0; } H.msg(`markings: ${id} face ${this.mk.face}`); } }
    });
    if (typeof window !== 'undefined') window.addEventListener?.('mouseup', () => this.endStroke());   // (bubble phase: the painter's own mouseup — a rect fill — runs first)
    H.ed.onSelect.push(() => this.followSelection());
    this.show('props', false);
  }
  private faceUnderCursor(boxId: string): MarkFace | null {
    const T = this.H.tools; const hv = T.hover; if (!hv || hv.ref !== `box:${boxId}`) return null;
    const { ro, rd } = this.H.view.ray((T as any).lastMX ?? 0, (T as any).lastMY ?? 0); const hit = this.H.scene.pick(ro, rd);
    const b = this.H.ed.doc.get<BoxData>('boxes', boxId); return hit && b && hit.ref === hv.ref ? P.faceOfNormal(hit.normal, b.yaw ?? 0) : null;
  }
  /** the Markings tab follows the selection's primary box */
  private followSelection() { const b = this.H.ed.selected('box')[0]; if (b && b.id !== this.mk.boxId) { this.mk.boxId = b.id; this.mk.i = 0; } }

  // ---------------------------------------------------------------- tabs
  show(tab: InspTab, announce = true) {
    this.tab = tab; void announce;
    this.els.props.classList.toggle('hidden', tab !== 'props'); this.els.mat.classList.toggle('hidden', tab !== 'materials'); this.els.mark.classList.toggle('hidden', tab !== 'markings');
    for (const [k, b] of this.tabBtns) b.classList.toggle('on', k === tab);
    if (tab === 'markings') this.followSelection();
    this.matKey = '§'; this.markKey = '§'; this.tick(true);
    if (tab !== 'markings') { this.gizmo(null); this.painterFocus = false; }
  }
  /** per frame from Ui.tick: rebuild a pane when its STRUCTURE changed (names, selection, frames), else refresh values — never a rebuild mid-drag */
  tick(force = false) {
    const ed = this.H.ed; const rev = ed.doc.rev; const changed = force || rev !== this.lastRev; this.lastRev = rev;
    if (this.tab === 'materials') { const k = this.matStructKey(); if (k !== this.matKey) { this.matKey = k; this.buildMaterials(); } else if (changed) this.mat.refresh(); }
    else if (this.tab === 'markings') { const k = this.markStructKey(); if (k !== this.markKey) { this.markKey = k; this.buildMarkings(); } else if (changed) this.mark.refresh(); this.syncGizmo(); }
  }
  private selBoxes(): string[] { return this.H.ed.selected('box').map(r => r.id); }
  private matStructKey(): string {
    const ed = this.H.ed; const names = Object.keys(ed.data.materials); if (this.paint && !Object.hasOwn(ed.data.materials, this.paint)) this.paint = null; if (!this.paint && names.length) this.paint = names[0];
    const sel = this.selBoxes(); const per = sel.slice(0, 40).map(id => { const b = ed.doc.get<BoxData>('boxes', id); return b ? `${b.material ?? '~'}${b.rough !== undefined ? 'r' : ''}${b.metal !== undefined ? 'm' : ''}` : ''; }).join(',');
    const m = this.paint ? ed.data.materials[this.paint] : null;
    return `${names.join('|')}§${this.paint}§${m ? (m.rough === undefined ? 'matte' : 'r') : ''}§${sel.join(',')}§${per}`;
  }
  private markStructKey(): string {
    const ed = this.H.ed; const b = this.mk.boxId ? ed.doc.get<BoxData>('boxes', this.mk.boxId) : null; if (!b) { this.mk.boxId = null; return `none§${this.selBoxes().length}`; }
    const ms = b.markings ?? []; if (this.mk.i >= ms.length) this.mk.i = Math.max(0, ms.length - 1);
    const frames = ms.map(m => `${m.face}${m.res ?? 'base'}${m.at}${m.size}${m.pal.map(p => (p.albedo ? 'A' : p.mul !== undefined ? 'M' : 'N') + (p.rough !== undefined ? 'r' : '') + (p.emit ? 'e' : '')).join('')}`).join('|');
    return `${b.id}§${b.h.join(',')}§${frames}§${this.mk.i}§${this.mk.face}§${this.gen.kind}§${this.selBoxes().length}`;
  }
  private syncGizmo() {
    const b = this.mk.boxId ? this.H.ed.doc.get<BoxData>('boxes', this.mk.boxId) : null;
    if (!b) { this.gizmo(null); return; }
    const m = (b.markings ?? [])[this.mk.i];
    this.gizmo(m ? { boxId: b.id, face: m.face, res: m.res ?? 'base', at: m.at, size: m.size, texel: P.markTexelOf(this.H.ed) } : { boxId: b.id, face: this.mk.face, res: 'base' });
  }
  private gizmo(g: import('./overlay').MarkGizmo | null) { if (this.H.overlay) this.H.overlay.markGizmo = g; }
  private say(t: string) { this.H.msg(t); }
  private try<T>(f: () => T): T | undefined { try { return f(); } catch (e) { this.say(String((e as Error).message ?? e)); return undefined; } }

  // ================================================================ MATERIALS
  private buildMaterials() {
    const p = this.mat; const ed = this.H.ed; p.clear();
    const list = P.materialList(ed);
    // ---- the palette
    const s = p.section(`Paints (${list.length})`, true);
    { const r = el('div', 'row btnrow');
      r.append(
        btn('new', 'a new paint at the end of the palette (name from the field below, or paint, paint2 …)', () => this.try(() => { const nm = P.materialCreate(ed, this.newName && P.MATERIAL_NAME_RE.test(this.newName) ? P.freshMaterialName(ed, this.newName) : P.freshMaterialName(ed, 'paint')); this.paint = nm; this.say(`material '${nm}' added — set its albedo / finish below`); })),
        btn('duplicate', 'a copy of the selected paint right after it', () => this.try(() => { if (!this.paint) return; const nm = P.materialDuplicate(ed, this.paint, this.newName && P.MATERIAL_NAME_RE.test(this.newName) && !Object.hasOwn(ed.data.materials, this.newName) ? this.newName : undefined); this.paint = nm; this.say(`duplicated → '${nm}'`); })),
        btn('rename', 'rename the selected paint to the name in the field below — every box / prop part using it follows', () => this.try(() => { if (!this.paint) return; const nm = this.newName.trim(); if (!nm) { this.say('type the new name in the "name" field first'); return; } P.materialRename(ed, this.paint, nm); this.paint = nm; this.say(`renamed → '${nm}' (references rewritten)`); })),
        btn('delete', 'remove the selected paint — refused while anything uses it (repaint its users first: "users → sel." then click another swatch in the palette strip, or use __ed.material.remove(name, {repaintTo}))', () => this.try(() => { if (!this.paint) return; const nm = this.paint; P.materialRemove(ed, nm); this.paint = null; this.say(`material '${nm}' removed`); })),
      ); s.append(r); }
    { const r = el('div', 'row btnrow');
      r.append(
        btn('from selection', 'a NEW paint from the first selected box\'s resolved look (albedo + finish), and the selection painted with it', () => this.try(() => { const sel = this.selBoxes(); if (!sel.length) { this.say('select boxes first'); return; } const nm = P.materialFromSelection(ed, sel, this.newName && P.MATERIAL_NAME_RE.test(this.newName) && !Object.hasOwn(ed.data.materials, this.newName) ? this.newName : undefined); this.paint = nm; this.say(`material '${nm}' made from ${sel[0]} and applied to ${sel.length}`); })),
        btn('users → sel.', 'select every box (and prop) painted with the selected paint', () => this.try(() => { if (!this.paint) return; const u = P.materialUsers(ed, this.paint); ed.select([...u.boxes.map(b => `box:${b}`), ...u.props.map(q => `prop:${q}`)]); this.say(`${u.boxes.length} boxes · ${u.props.length} props use '${this.paint}'`); })),
        btn('paint sel.', 'paint the selected boxes with the selected paint (as a click on the palette strip does)', () => this.try(() => { const sel = this.selBoxes(); if (!this.paint || !sel.length) { this.say('select boxes and a paint'); return; } P.boxPaint(ed, sel, this.paint); this.say(`painted ${sel.length} '${this.paint}'`); })),
      ); s.append(r); }
    textRow(p, s, 'name (for new / rename)', () => this.newName, v => { this.newName = v.trim(); }, { title: 'letters, digits, _ — used by new / duplicate / rename / from selection', placeholder: 'e.g. linoDark' });
    const listEl = el('div', 'matlist'); s.append(listEl);
    for (const m of list) {
      const row = el('div', 'mrow' + (m.name === this.paint ? ' on' : '')); row.title = `${m.name}: albedo [${m.albedo.map(x => x.toFixed(3)).join(' ')}] · ${m.rough === undefined ? 'matte (no finish)' : `rough ${m.rough}${m.metal ? ' · metal' : ''}`} · ${P.traceHint(m.rough)}${m.notes ? '\n' + m.notes : ''}\nclick = edit it here · shift-click = paint the selection with it`;
      const chip = el('span', 'chip'); chip.style.background = P.swatchCss(m.albedo, m.rough, m.metal);
      const nm = el('span', 'mname', m.name); const use = el('span', 'muse', `${m.boxes}${m.parts ? `+${m.parts}` : ''}`); use.title = `${m.boxes} boxes · ${m.parts} prop parts`;
      const fin = el('span', 'mfin', m.rough === undefined ? 'matte' : `${m.rough.toFixed(2)}${m.metal ? ' M' : ''}`);
      row.append(chip, nm, use, fin);
      row.onclick = (e: MouseEvent) => { if (e?.shiftKey) { const sel = this.selBoxes(); if (sel.length) this.try(() => { P.boxPaint(ed, sel, m.name); this.say(`painted ${sel.length} '${m.name}'`); }); return; } this.paint = m.name; this.matKey = '§'; this.tick(true); };
      const rf = () => { const cur = ed.data.materials[m.name]; if (!cur) return; chip.style.background = P.swatchCss(cur.albedo, cur.rough, cur.metal); fin.textContent = cur.rough === undefined ? 'matte' : `${cur.rough.toFixed(2)}${cur.metal ? ' M' : ''}`; };
      p.keep(rf, row); listEl.append(row);
    }
    p.text(s, () => 'swatches: the albedo in sRGB under a highlight streak that narrows and brightens as the paint polishes (a CSS approximation, not a render — the view is the render)');
    // ---- the selected paint
    if (this.paint && ed.data.materials[this.paint]) this.buildPaintEditor(p, this.paint);
    // ---- per-box overrides for the selection
    this.buildOverrides(p);
    p.refresh();
  }
  /** the shared 'seal at the end of a drag' for coalesced slider / colour scrubs */
  private seal() { this.H.ed.doc.seal(); }
  private buildPaintEditor(p: Panel, name: string) {
    const ed = this.H.ed; const g = () => ed.data.materials[name]; const S = this.H.scene.engine.settings;
    const s = p.section(`Paint: ${name}`, true);
    const set = (patch: Parameters<typeof P.materialSet>[2], key: string) => this.try(() => P.materialSet(ed, name, patch, { coalesce: `mat:${name}:${key}` }));
    this.colorRows(p, s, 'albedo', () => g()?.albedo ?? [0.5, 0.5, 0.5], (v, live) => { set({ albedo: v }, 'alb'); if (!live) this.seal(); }, 'the paint\'s diffuse albedo — LINEAR in the file; the picker and the hex speak sRGB. Live on every box using it');
    this.roughRows(p, s, () => g()?.rough, v => set({ rough: v }, 'rough'), () => this.seal());
    p.toggleBox(s, 'metal', () => !!g()?.metal, v => { set({ metal: v }, 'metal'); this.seal(); }, 'a bare conductor: F0 = the albedo, most of the diffuse gone (brushed steel 0.28). The format carries metal as yes / no — no fraction');
    p.text(s, () => { const m = g(); if (!m) return ''; const on = !!(S as any).rtReflect; const cut = (S as any).rtMaxRough as number | undefined; const r = m.rough ?? 1; return `${P.traceHint(m.rough)}\nthis view: ${on ? `RT reflections on, cut-off ${cut?.toFixed(2)} → ${r <= (cut ?? 0) ? 'TRACED here' : 'analytic highlight only here'}` : 'RT reflections off at this quality (low / verylow, or switched off) — analytic highlights only'}\naniso: runtime-only (the storm's wet lot) — not a LevelData v1 field`; });
    textRow(p, s, 'notes', () => g()?.notes ?? '', v => { set({ notes: v.trim() ? v : null }, 'notes'); this.seal(); }, { title: 'free text kept in the file with the paint' });
    p.buttons(s, 'finish', P.FINISH_PRESETS.map(f => ({ text: f.label, title: `${f.title}${f.rough !== undefined ? ` — rough ${f.rough}${f.metal ? ' + metal' : ''}` : ''}`, run: () => this.try(() => { P.materialPreset(ed, name, f.key); this.seal(); this.say(`'${name}': ${f.label} (${f.rough === undefined ? 'unset → matte' : `rough ${f.rough}${f.metal ? ', metal' : ''}`}) — ${P.traceHint(f.rough)}`); }) })));
    p.text(s, () => { const u = P.materialUsers(ed, name); return `used by ${u.boxes.length} box${u.boxes.length === 1 ? '' : 'es'}${u.props.length ? ` · ${u.props.length} prop(s)` : ''}${u.boxes.length ? ` (${u.boxes.slice(0, 4).join(' ')}${u.boxes.length > 4 ? ' …' : ''})` : ''}`; });
  }
  /** albedo editors: a native colour picker (sRGB) + hex field + three linear number fields — all views of one value; `live` = mid-drag (coalesce, no seal) */
  private colorRows(p: Panel, sec: HTMLElement, label: string, get: () => readonly number[], set: (v: Vec3, live: boolean) => void, title: string) {
    const r = el('div', 'row colrow'); r.title = title; const l = el('label', '', label); r.append(l);
    const pick = el('input', 'col') as HTMLInputElement; pick.type = 'color';
    const hex = el('input', 'txt hex') as HTMLInputElement; hex.type = 'text'; hex.spellcheck = false; hex.style.width = '8.5ch';
    pick.oninput = () => { const v = P.hexToLinear(pick.value); if (v) { set(v, true); hex.value = pick.value; } };
    pick.onchange = () => { const v = P.hexToLinear(pick.value); if (v) set(v, false); };
    const commitHex = () => { const v = P.hexToLinear(hex.value); if (v) set(v, false); else { hex.classList.add('bad'); setTimeout(() => hex.classList.remove('bad'), 900); hex.value = P.linearToHex(get()); } };
    hex.addEventListener('keydown', (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') { commitHex(); hex.blur(); } else if (e.key === 'Escape') { hex.value = P.linearToHex(get()); hex.blur(); } });
    hex.addEventListener('blur', () => { if (hex.value !== P.linearToHex(get())) commitHex(); });
    r.append(pick, hex); sec.append(r);
    const rf = () => { const h = P.linearToHex(get()); if (document.activeElement !== pick) pick.value = h; if (document.activeElement !== hex) hex.value = h; }; rf(); p.keep(rf, r);
    p.numbers(sec, `${label} (linear)`, 3, i => get()[i] ?? 0, (i, v) => { const cur = [get()[0], get()[1], get()[2]] as Vec3; cur[i] = Math.max(0, Math.min(1, v)); set(cur, true); }, { step: 0.005, min: 0, max: 1, digits: 3, names: ['r', 'g', 'b'], title: 'linear reflectance per channel (0‥1) — drag to scrub, click to type' });
  }
  /** roughness: a range slider 0.02‥1 with ticks at the finish presets + the value + a 'matte (unset)' box (absent rough = ROUGH_DEFAULT 1.0: no ray anywhere) */
  private roughRows(p: Panel, sec: HTMLElement, get: () => number | undefined, set: (v: number | null) => void, end: () => void, labelText = 'roughness') {
    const r = el('div', 'row roughrow'); const l = el('label', '', labelText); r.title = 'GGX roughness: 0.08 dark screen · 0.15 stone · 0.22 lino · 0.28 brushed metal · 0.5 laminate · 0.55‥0.6 wood · 0.85 walls. Reflection rays only under the tier\'s cut-off (ultra 0.55 · high 0.45 · medium 0.35); the ticks are the presets'; r.append(l);
    const inp = el('input') as HTMLInputElement; inp.type = 'range'; inp.min = '0.02'; inp.max = '1'; inp.step = '0.01';
    const dlId = `roughticks`; if (typeof document !== 'undefined' && !document.getElementById(dlId)) { const dl = el('datalist'); dl.id = dlId; for (const t of ROUGH_TICKS) { const o = el('option') as HTMLOptionElement; o.value = String(t); dl.append(o); } document.body?.appendChild?.(dl); }
    inp.setAttribute('list', dlId);
    const val = el('span', 'val', '');
    inp.oninput = () => { set(parseFloat(inp.value)); val.textContent = (+inp.value).toFixed(2); };
    inp.onchange = () => end();
    inp.addEventListener('pointerup', () => end()); inp.addEventListener('keyup', () => end());
    r.append(inp, val); sec.append(r);
    const rf = () => { const v = get(); if (document.activeElement !== inp) inp.value = String(v ?? 1); val.textContent = v === undefined ? 'matte' : v.toFixed(2); inp.classList.toggle('unset', v === undefined); }; rf(); p.keep(rf, r);
    p.toggleBox(sec, 'matte (no finish)', () => get() === undefined, on => { set(on ? null : 0.5); end(); }, 'no roughness authored = ROUGH_DEFAULT 1.0, matte dielectric: the reflection pass never spends a ray on it. Untick to give it a finish (starts at 0.5)');
  }
  private buildOverrides(p: Panel) {
    const ed = this.H.ed; const sel = this.selBoxes();
    const s = p.section(`Selection — per-box finish (${sel.length})`, true);
    if (!sel.length) { p.text(s, () => 'select boxes in the view: their material, an inline albedo, and rough / metal OVERRIDES over the paint are edited here'); return; }
    const boxes = () => sel.map(id => ed.doc.get<BoxData>('boxes', id)).filter((b): b is BoxData => !!b);
    const first = () => boxes()[0];
    p.text(s, () => { const bs = boxes(); const byMat = new Map<string, number>(); let nr = 0, nm = 0; for (const b of bs) { byMat.set(b.material ?? '(inline)', (byMat.get(b.material ?? '(inline)') ?? 0) + 1); if (b.rough !== undefined) nr++; if (b.metal !== undefined) nm++; } return `${bs.length} box${bs.length === 1 ? '' : 'es'}: ${[...byMat].map(([k, n]) => `${n} × ${k}`).join(', ')}${nr || nm ? ` · overrides: rough on ${nr}, metal on ${nm}` : ' · no finish overrides'}`; });
    const mats = ['(inline albedo)', ...Object.keys(ed.data.materials)];
    p.select(s, 'material', mats, () => { const ms = new Set(boxes().map(b => b.material ?? '')); if (ms.size !== 1) return -1 as unknown as number; const m = [...ms][0]; return m ? mats.indexOf(m) : 0; }, i => this.try(() => { if (i === 0) { P.boxOverride(ed, sel, { albedo: P.resolvedFinish(ed, first()!).albedo }); this.say(`${sel.length} box(es) detached to an inline albedo (finish kept)`); } else { P.boxPaint(ed, sel, mats[i]); this.say(`painted ${sel.length} '${mats[i]}'`); } }), 'the paint these boxes reference — (inline albedo) detaches them with their current colour and finish written on the box');
    const anyInline = () => boxes().some(b => b.material === undefined);
    if (anyInline()) this.colorRows(p, s, 'inline albedo', () => (boxes().find(b => b.material === undefined)?.albedo ?? [0.5, 0.5, 0.5]), (v, live) => { const ids = boxes().filter(b => b.material === undefined).map(b => b.id); this.try(() => P.boxOverride(ed, ids, { albedo: v }, { coalesce: `ov:alb:${ids.join(',')}` })); if (!live) this.seal(); }, 'the inline albedo of the selected boxes that carry one (boxes on a paint keep the paint\'s)');
    // rough override
    p.toggleBox(s, 'override roughness', () => boxes().length > 0 && boxes().every(b => b.rough !== undefined), on => this.try(() => { P.boxOverride(ed, sel, { rough: on ? (P.resolvedFinish(ed, first()!).rough ?? 0.5) : null }); this.seal(); }), 'a per-box roughness over the paint\'s (off = the paint\'s finish, or matte for an inline box)');
    if (boxes().some(b => b.rough !== undefined)) this.roughRows(p, s, () => boxes().find(b => b.rough !== undefined)?.rough, v => this.try(() => P.boxOverride(ed, boxes().filter(b => b.rough !== undefined || v !== null).map(b => b.id), { rough: v }, { coalesce: `ov:rough:${sel.join(',')}` })), () => this.seal(), 'box roughness');
    p.toggleBox(s, 'override metal', () => boxes().length > 0 && boxes().every(b => b.metal !== undefined), on => this.try(() => { if (on) P.boxOverride(ed, sel, { metal: !P.resolvedFinish(ed, first()!).metal ? true : false }); else P.boxOverride(ed, sel, { metal: null }); this.seal(); }), 'a per-box metal flag over the paint\'s (metal false is only written over a metal paint — elsewhere it is the default)');
    if (boxes().some(b => b.metal !== undefined)) p.toggleBox(s, 'metal (these boxes)', () => boxes().some(b => b.metal === true), v => this.try(() => { P.boxOverride(ed, sel, { metal: v }); this.seal(); }));
    p.buttons(s, 'finish on boxes', P.FINISH_PRESETS.map(f => ({ text: f.label, title: `${f.title} — written on the BOX (over its paint)`, run: () => this.try(() => { P.boxFinishPreset(ed, sel, f.key); this.say(`${f.label} finish on ${sel.length} box(es)`); }) })));
    p.buttons(s, '', [{ text: 'clear overrides', title: 'drop rough / metal from the selected boxes (their paint\'s finish shows again)', run: () => this.try(() => { P.boxOverride(ed, sel, null); this.say(`overrides cleared on ${sel.length}`); }) }, { text: 'edit their paint', title: 'jump to the first box\'s paint in the palette', run: () => { const m = first()?.material; if (m) { this.paint = m; this.matKey = '§'; this.tick(true); } else this.say('the first box is inline — no paint to edit'); } }]);
    p.text(s, () => { const b = first(); if (!b) return ''; const f = P.resolvedFinish(ed, b); return `${b.id} resolves to albedo (${f.albedo.map(x => x.toFixed(3)).join(' ')})${b.material ? ` from '${b.material}'` : ' inline'} · rough ${f.rough === undefined ? 'matte' : `${f.rough}${b.rough !== undefined ? ' (box)' : ' (paint)'}`} · ${f.metal ? 'metal' : 'dielectric'}${b.metal !== undefined ? ' (box)' : ''}\n→ ${P.traceHint(f.rough)}`; });
  }

  // ================================================================ MARKINGS
  private box(): BoxData | null { return this.mk.boxId ? this.H.ed.doc.get<BoxData>('boxes', this.mk.boxId) : null; }
  private cur(): MarkingDef | null { const b = this.box(); return (b?.markings ?? [])[this.mk.i] ?? null; }
  private buildMarkings() {
    const p = this.mark; const ed = this.H.ed; p.clear(); this.painter = null;
    const b = this.box();
    if (!b) { const s = p.section('Markings', true); p.text(s, () => 'select a box (click one in the view, or K over it): its faces carry up to 4 pixel-art markings — key caps, tape, seams, LEDs, glyphs — each a ≤ 32 × 32 bitmap of ≤ 3 MATERIAL entries on a world texel lattice'); p.refresh(); return; }
    const ms = b.markings ?? []; const id = b.id; const texel = P.markTexelOf(ed);
    // ---- the box + faces
    const s = p.section(`Box ${id} — markings ${ms.length} / ${P.MAX_MARKS_PER_BOX}`, true);
    p.text(s, () => { const bb = this.box(); if (!bb) return ''; return `h ${bb.h.map(x => f2(x)).join(' × ')} m${bb.yaw ? ` · yaw ${(bb.yaw * 57.2958).toFixed(0)}°` : ''}${bb.rot ? ' · TILTED (rot): cannot carry markings' : ''} · base texel ${(texel * 100).toFixed(2)} cm (fine ${(texel * 50).toFixed(2)} · coarse ${(texel * 200).toFixed(1)})`; });
    { const r = el('div', 'row btnrow facerow'); const l = el('label', '', 'face'); l.title = 'the face new markings go on and the view outlines (click a face of the box IN THE VIEW to pick it, or these)'; r.append(l);
      for (const f of FACES) { const bt = btn(f, `face ${f}`, () => { this.mk.face = f; const k = (this.box()?.markings ?? []).findIndex(m => m.face === f); if (k >= 0) this.mk.i = k; this.markKey = '§'; this.tick(true); }, 'pb face' + (f === this.mk.face ? ' on' : '')); r.append(bt); }
      s.append(r); }
    p.text(s, () => { const bb = this.box(); if (!bb) return ''; return RESES.map(rs => { const L = P.faceLattice(bb.h, this.mk.face, rs, texel); return `${rs.padEnd(6)} ${(L.t * 100).toFixed(2)} cm cells → ${this.mk.face} takes ${L.maxW} × ${L.maxH}${L.uEnd - L.uMin > 32 || L.vEnd - L.vMin > 32 ? ` (face is ${L.uEnd - L.uMin} × ${L.vEnd - L.vMin}: a bitmap covers part of it)` : ''}`; }).join('\n'); });
    // ---- the list
    const listEl = el('div', 'mklist'); s.append(listEl);
    ms.forEach((m, k) => {
      const row = el('div', 'mkrow' + (k === this.mk.i ? ' on' : '')); const info = P.markingList(ed, id)[k];
      const chips = el('span', 'mkchips'); m.pal.forEach((q, j) => { const c = el('span', 'mkchip' + (q.emit ? ' emit' : '')); c.style.background = P.linearToHex(P.resolveAlbedo(q, P.resolvedFinish(ed, b).albedo)); c.title = `${'abc'[j]}: ${palDesc(q)}`; chips.append(c); });
      row.append(el('span', 'mki', String(k)), el('span', 'mkd', `${m.face} ${m.res ?? 'base'} ${m.size[0]}×${m.size[1]} @ ${m.at[0]},${m.at[1]}`), chips, el('span', 'mkl', `${info?.lit ?? 0} lit${info?.emits ? ' · emits' : ''}${info?.errors.length ? ' ⚠' : ''}`));
      row.title = info?.errors.length ? info.errors.join('\n') : `marking ${k}: click to edit · covers ${(m.size[0] * (info?.texel ?? texel) * 100).toFixed(1)} × ${(m.size[1] * (info?.texel ?? texel) * 100).toFixed(1)} cm`;
      row.onclick = () => { this.mk.i = k; this.mk.face = m.face; this.markKey = '§'; this.tick(true); };
      listEl.append(row);
    });
    { const r = el('div', 'row btnrow');
      r.append(
        btn(`add on ${this.mk.face}`, 'a new blank marking on the chosen face (up to 8 × 8 base cells, centred; one darkening entry)', () => this.try(() => { const k = P.markingAdd(ed, id, { face: this.mk.face }); this.mk.i = k; this.say(`marking ${k} added on ${id} ${this.mk.face} — paint it below`); })),
        btn('duplicate', 'a copy of the selected marking (then move it: it starts on top of the original)', () => this.try(() => { if (!this.cur()) return; this.mk.i = P.markingDuplicate(ed, id, this.mk.i); })),
        btn('remove', 'delete the selected marking', () => this.try(() => { if (!this.cur()) return; P.markingRemove(ed, id, this.mk.i); this.mk.i = Math.max(0, this.mk.i - 1); })),
        btn('copy', 'copy the selected marking (then paste onto other boxes\' same face)', () => this.try(() => { if (!this.cur()) return; P.markingCopy(ed, id, this.mk.i); this.say(`copied marking ${this.mk.i} of ${id} (${this.cur()!.face})`); })),
        btn('paste → sel.', 'paste the copied marking onto every SELECTED box, on the same face (clamped onto each face; faces too small are skipped and named)', () => this.try(() => { const t = this.selBoxes().filter(x => x !== P.markingClipboard()?.from || this.selBoxes().length === 1); if (!P.markingClipboard()) { this.say('copy a marking first'); return; } const r2 = P.markingPaste(ed, t); this.say(`pasted onto ${r2.pasted.length}${r2.skipped.length ? ` · skipped ${r2.skipped.length}: ${r2.skipped.slice(0, 3).join('; ')}` : ''}`); })),
      ); s.append(r); }
    { const r = el('div', 'row txtrow patrow'); const l = el('label', '', 'apply to pattern'); l.title = 'copy the selected marking onto every box whose id / name / group matches a regular expression (how a per-kind default is authored by hand: mark one carton, apply to ^box_ with "same size" on)'; r.append(l);
      const inp = el('input', 'txt') as HTMLInputElement; inp.type = 'text'; inp.placeholder = 'regex over id / name / group, e.g. storage|crate'; inp.value = this.pattern.text; inp.spellcheck = false;
      inp.addEventListener('keydown', (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); }); inp.addEventListener('blur', () => { this.pattern.text = inp.value; });
      const same = el('input') as HTMLInputElement; same.type = 'checkbox'; same.checked = this.pattern.sameSize; same.title = 'only boxes the same size as this one (h within a millimetre)'; same.onchange = () => { this.pattern.sameSize = same.checked; };
      const go = btn('apply', 'copy the selected marking onto the matching boxes (same face)', () => this.try(() => { this.pattern.text = inp.value; if (!this.cur()) return; if (!this.pattern.text.trim()) { this.say('type a pattern first'); return; } const r2 = P.markingApplyToPattern(ed, id, this.mk.i, this.pattern.text.trim(), { sameSize: this.pattern.sameSize }); this.say(`pattern matched ${r2.matched}: pasted onto ${r2.pasted.length}${r2.skipped.length ? `, skipped ${r2.skipped.length} (${r2.skipped.slice(0, 2).join('; ')})` : ''}`); }));
      r.append(inp, same, go); s.append(r); }
    { const keys = P.KIND_RECIPES.map(r => r.key);
      p.select(s, 'kind recipe', P.KIND_RECIPES.map(r => r.label), () => Math.max(0, keys.indexOf(this.recipeKey)), i => { this.recipeKey = keys[i] ?? 'carton'; }, 'the per-kind marking sets of scene/markingDefaults.ts (what the office\'s objects carry) sized to THIS box — apply REPLACES the box\'s markings; recipes with a face take the chosen face');
      p.buttons(s, '', [{ text: 'apply recipe (replaces all)', title: 'replace this box\'s markings with the recipe\'s set for its size', run: () => this.try(() => { const r2 = P.markingApplyRecipe(ed, id, this.recipeKey, this.mk.face); this.mk.i = 0; this.say(`${this.recipeKey}: ${r2.applied} marking(s)${r2.dropped.length ? ` · dropped ${r2.dropped.length}: ${r2.dropped.join('; ')}` : ''}`); }) }]); }
    // ---- the selected marking
    const m = this.cur();
    if (m) { this.buildFrame(p, b, m); this.buildPainter(p, b, m); this.buildPalette(p, b, m); this.buildGenerators(p, b, m); this.buildAscii(p, b, m); }
    else p.text(p.section('Marking', true), () => `no marking on ${id} yet — "add on ${this.mk.face}", a kind recipe, or paste one`);
    p.refresh();
  }
  private buildFrame(p: Panel, b: BoxData, m0: MarkingDef) {
    const ed = this.H.ed; const id = b.id; const i = this.mk.i; const texel = P.markTexelOf(ed);
    const g = () => this.cur() ?? m0;
    const s = p.section(`Marking ${i} — frame`, true);
    const upd = (patch: P.MarkingSpec, key: string) => this.try(() => P.markingUpdate(ed, id, i, patch, { coalesce: `mk:${id}:${i}:${key}` }));
    p.select(s, 'res', RESES.map(r => { const L = P.faceLattice(b.h, g().face, r, texel); return `${r} · ${(L.t * 100).toFixed(2)} cm · max ${L.maxW}×${L.maxH}`; }), () => RESES.indexOf(g().res ?? 'base'), k => { upd({ res: RESES[k] }, 'res'); this.seal(); }, 'the lattice: fine = half the base texel, coarse = double (all nesting). A res change keeps the cells and re-clamps the bitmap onto the face');
    p.select(s, 'face', FACES, () => FACES.indexOf(g().face), k => { upd({ face: FACES[k] }, 'face'); this.mk.face = FACES[k]; this.seal(); }, 'move the marking to another face (re-clamped)');
    p.numbers(s, 'size W H (cells)', 2, k => g().size[k], (k, v) => { const sz: [number, number] = [g().size[0], g().size[1]]; sz[k] = Math.max(1, Math.round(v)); upd({ size: sz }, 'size'); }, { step: 1, min: 1, max: 32, digits: 0, names: ['W', 'H'], title: 'bitmap size in cells (1‥32, clamped to what the face takes at this res); cells are cropped / padded top-left' });
    p.numbers(s, 'at U V (lattice)', 2, k => g().at[k], (k, v) => { const at: [number, number] = [g().at[0], g().at[1]]; at[k] = Math.round(v); upd({ at }, 'at'); }, { step: 1, digits: 0, names: ['U', 'V'], title: 'lattice coordinates of the bitmap\'s bottom-left cell from the face centre along u / v (clamped onto the face); arrows nudge it while the painter has focus' });
    p.buttons(s, 'anchor', ([['⌜', 'tl', 'top-left'], ['⌃', 'top', 'top middle'], ['⌝', 'tr', 'top-right'], ['◂', 'left', 'left middle'], ['◎', 'centre', 'centre'], ['▸', 'right', 'right middle'], ['⌞', 'bl', 'bottom-left'], ['⌄', 'bottom', 'bottom middle'], ['⌟', 'br', 'bottom-right']] as [string, P.Anchor, string][]).map(([t, a, title]) => ({ text: t, title: `snap the bitmap to the face's ${title}`, run: () => { upd({ anchor: a }, 'anchor'); this.seal(); } })));
    p.buttons(s, 'nudge', [['←', -1, 0], ['→', 1, 0], ['↑', 0, 1], ['↓', 0, -1]].map(([t, du, dv]) => ({ text: t as string, title: 'move one lattice cell (arrows do this while the painter has focus)', run: () => this.try(() => { P.markingNudge(ed, id, i, du as number, dv as number); this.seal(); }) })));
    p.text(s, () => { const m = g(); const info = P.markingList(ed, id)[i]; const t = texel * P.RES_K[m.res ?? 'base']; const errs = info?.errors ?? []; if (errs.length) return `⚠ ${errs.join('\n⚠ ')}`; let sm = ''; try { const su = P.markingSummary(ed, id, i); sm = su.stats.emask ? ` · emits: mean L (${su.stats.meanL.map(x => x.toFixed(2)).join(' ')}) over ${(su.stats.area * 1e4).toFixed(0)} cm² → the game registers a light of intensity ${su.lightI0.toFixed(3)}` : ''; } catch { /* */ } return `ok · ${(m.size[0] * t * 100).toFixed(1)} × ${(m.size[1] * t * 100).toFixed(1)} cm at u [${(m.at[0] * t).toFixed(3)}, ${((m.at[0] + m.size[0]) * t).toFixed(3)}] v [${(m.at[1] * t).toFixed(3)}, ${((m.at[1] + m.size[1]) * t).toFixed(3)}] m · ${info?.lit ?? 0} of ${m.size[0] * m.size[1]} cells lit${sm}`; });
  }

  // ---- the painter
  private buildPainter(p: Panel, b: BoxData, m0: MarkingDef) {
    const ed = this.H.ed; const id = b.id; const i = this.mk.i;
    const g = () => this.cur() ?? m0;
    const s = p.section(`Marking ${i} — painter`, true);
    // entry chips: 0 = erase, then a b c
    { const r = el('div', 'row btnrow entrow'); const l = el('label', '', 'entry'); l.title = 'the entry the left button paints (right button erases; [ ] cycle; 1 2 3 0 pick; the chip colours are the entries resolved against the box)'; r.append(l);
      const chips: HTMLElement[] = [];
      for (let e = 0; e <= 3; e++) { const c = btn(e === 0 ? '· erase' : 'abc'[e - 1], e === 0 ? 'transparent: the box shows through' : `palette entry ${'abc'[e - 1]}`, () => { if (e <= g().pal.length) { this.mk.entry = e; paintChips(); } }, 'pb entry'); chips.push(c); r.append(c); }
      const paintChips = () => { const m = g(); const base = P.resolvedFinish(ed, b).albedo; chips.forEach((c, e) => { c.classList.toggle('on', e === this.mk.entry); (c as HTMLButtonElement).disabled = e > m.pal.length; if (e === 0) c.style.background = ''; else { const q = m.pal[e - 1]; c.style.background = q ? P.linearToHex(P.resolveAlbedo(q, base)) : ''; c.style.color = q && lum(P.resolveAlbedo(q, base)) > 0.4 ? '#000' : ''; c.classList.toggle('emit', !!q?.emit); c.title = q ? `${'abc'[e - 1]}: ${palDesc(q)}` : '(no such entry — add one below)'; } }); };
      s.append(r); p.keep(paintChips, r); paintChips(); if (this.mk.entry > g().pal.length) this.mk.entry = g().pal.length; }
    // the canvas
    const wrap = el('div', 'painter'); const canvas = el('canvas', 'paintcv') as HTMLCanvasElement; canvas.tabIndex = 0; wrap.append(canvas); s.append(wrap);
    const status = el('div', 'row textrow pstat', ''); s.append(status);
    const W = g().size[0], H = g().size[1]; const cell = Math.max(6, Math.min(22, Math.floor(Math.min(292 / W, 240 / H))));
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.round(W * cell * dpr) + 1; canvas.height = Math.round(H * cell * dpr) + 1; canvas.style.width = `${W * cell}px`; canvas.style.height = `${H * cell}px`;
    const ctx = canvas.getContext('2d');
    const paintNow = () => {
      const m = this.cur(); if (!m || !ctx) return; const base = P.resolvedFinish(ed, b).albedo;
      ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W * cell + 1, H * cell + 1);
      const baseHex = P.linearToHex(base); const cols = m.pal.map(q => P.linearToHex(P.resolveAlbedo(q, base)));
      for (let y = 0; y < m.size[1]; y++) for (let x = 0; x < m.size[0]; x++) {
        const e = P.CELL_CHARS.indexOf(m.cells[y]?.[x] ?? '.'); const px = x * cell, py = y * cell;
        if (e <= 0) { ctx.fillStyle = baseHex; ctx.fillRect(px, py, cell, cell); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px, py, cell / 2, cell / 2); ctx.fillRect(px + cell / 2, py + cell / 2, cell / 2, cell / 2); }   // transparent: the box's own albedo under a faint checker
        else { ctx.fillStyle = cols[e - 1] ?? '#f0f'; ctx.fillRect(px, py, cell, cell); if (m.pal[e - 1]?.emit) { ctx.fillStyle = 'rgba(255,240,150,0.9)'; ctx.fillRect(px + cell - 4, py + 1, 3, 3); } }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= m.size[0]; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, m.size[1] * cell); }
      for (let y = 0; y <= m.size[1]; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(m.size[0] * cell, y * cell + 0.5); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath();   // every 4 cells a stronger rule (counting from the bottom-left, as the lattice does)
      for (let x = 0; x <= m.size[0]; x += 4) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, m.size[1] * cell); }
      for (let y = m.size[1]; y >= 0; y -= 4) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(m.size[0] * cell, y * cell + 0.5); }
      ctx.stroke();
      const st = this.stroke; if (st?.rect && st.cur) { const x0 = Math.min(st.rect[0], st.cur[0]), x1 = Math.max(st.rect[0], st.cur[0]), y0 = Math.min(st.rect[1], st.cur[1]), y1 = Math.max(st.rect[1], st.cur[1]); ctx.strokeStyle = '#ff6ad5'; ctx.lineWidth = 2; ctx.strokeRect(x0 * cell + 1, y0 * cell + 1, (x1 - x0 + 1) * cell - 2, (y1 - y0 + 1) * cell - 2); }
      canvas.classList.toggle('focus', this.painterFocus);
    };
    this.painter = { canvas, cell, W, H, paintNow }; p.keep(paintNow, canvas); paintNow();
    const cellAt = (e: MouseEvent): [number, number] | null => { const r = canvas.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell); const m = this.cur(); if (!m || x < 0 || y < 0 || x >= m.size[0] || y >= m.size[1]) return null; return [x, y]; };
    let seq = 0;
    canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation(); this.painterFocus = true; canvas.focus?.(); paintNow();
      const c = cellAt(e); if (!c) return; const m = this.cur(); if (!m) return;
      const entry = e.button === 2 ? 0 : Math.min(this.mk.entry, m.pal.length);
      this.stroke = { key: `mk:${id}:${i}:stroke${++seq}`, entry, last: null, rect: e.shiftKey && e.button === 0 ? c : null, cur: c };
      if (!this.stroke.rect) { this.try(() => P.markingPaintCells(ed, id, i, [c], entry, { coalesce: this.stroke!.key })); this.stroke.last = c; }
      paintNow();
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const c = cellAt(e); const m = this.cur();
      if (c && m) status.textContent = `cell (${c[0]}, ${c[1]}) = '${m.cells[c[1]]?.[c[0]] ?? '.'}' · lattice (${m.at[0] + c[0]}, ${m.at[1] + m.size[1] - 1 - c[1]}) · LMB paint ${'·abc'[Math.min(this.mk.entry, m.pal.length)] === '·' ? '(erase)' : `'${'abc'[Math.min(this.mk.entry, m.pal.length) - 1]}'`} · RMB erase · shift-drag fill · [ ] entry · ⇧arrows shift · arrows move · H V mirror`;
      const st = this.stroke; if (!st || !c) return;
      if (st.rect) { st.cur = c; paintNow(); return; }
      if (st.last && st.last[0] === c[0] && st.last[1] === c[1]) return;
      const pts = st.last ? linePts(st.last, c) : [c]; st.last = c;
      this.try(() => P.markingPaintCells(ed, id, i, pts, st.entry, { coalesce: st.key })); paintNow();
    });
    canvas.addEventListener('mouseup', (e: MouseEvent) => { const st = this.stroke; if (st?.rect) { const c = cellAt(e) ?? st.cur ?? st.rect; this.try(() => P.markingFill(ed, id, i, [st.rect![0], st.rect![1], c[0], c[1]], st.entry)); } this.endStroke(); paintNow(); });
    canvas.addEventListener('mouseleave', () => { status.textContent = ''; });
    p.buttons(s, '', [
      { text: 'mirror H', title: 'flip left ↔ right (H while the painter has focus)', run: () => this.try(() => P.markingMirror(ed, id, i, 'h')) },
      { text: 'mirror V', title: 'flip top ↔ bottom (V)', run: () => this.try(() => P.markingMirror(ed, id, i, 'v')) },
      { text: '⇠', title: 'shift the cells one left, wrapping (⇧←)', run: () => this.try(() => P.markingShift(ed, id, i, -1, 0)) }, { text: '⇢', title: 'shift right (⇧→)', run: () => this.try(() => P.markingShift(ed, id, i, 1, 0)) },
      { text: '⇡', title: 'shift up (⇧↑)', run: () => this.try(() => P.markingShift(ed, id, i, 0, -1)) }, { text: '⇣', title: 'shift down (⇧↓)', run: () => this.try(() => P.markingShift(ed, id, i, 0, 1)) },
      { text: 'clear', title: 'every cell transparent', run: () => this.try(() => P.markingClear(ed, id, i)) },
    ]);
    p.text(s, () => this.painterFocus ? 'painter keys live: [ ] entry · 1 2 3 0 · arrows move on the face · ⇧arrows shift cells · H V mirror · Esc hands the keys back' : 'click the bitmap to give it the keys ([ ] 1 2 3 0 arrows H V)');
  }
  private endStroke() { if (!this.stroke) return; this.stroke = null; this.seal(); }
  /** painter keys, offered every keydown by the page BEFORE the game's Input sees it; true = consumed */
  key(e: KeyboardEvent): boolean {
    if (this.tab !== 'markings' || !this.painterFocus) return false;
    if (e.metaKey || e.ctrlKey) return false;
    const ed = this.H.ed; const id = this.mk.boxId; const m = this.cur(); if (!id || !m) return false;
    const i = this.mk.i; const k = e.key;
    const done = (f: () => void) => { this.try(f); this.painter?.paintNow(); return true; };
    if (k === 'Escape') { this.painterFocus = false; this.painter?.paintNow(); return true; }
    if (k === '[' || k === ']') { const n = m.pal.length; this.mk.entry = ((this.mk.entry + (k === ']' ? 1 : -1)) % (n + 1) + (n + 1)) % (n + 1); this.mark.refresh(); return true; }
    if (/^[0-3]$/.test(k)) { const e2 = Number(k); if (e2 <= m.pal.length) { this.mk.entry = e2; this.mark.refresh(); } return true; }
    if (k.startsWith('Arrow')) {
      const d: [number, number] = k === 'ArrowLeft' ? [-1, 0] : k === 'ArrowRight' ? [1, 0] : k === 'ArrowUp' ? [0, 1] : [0, -1];
      if (e.shiftKey) return done(() => P.markingShift(ed, id, i, d[0], -d[1]));   // (shift moves cells: screen-down is +row)
      return done(() => { P.markingNudge(ed, id, i, d[0], d[1]); });   // (one step per press: unrelated presses must not fold into one undo)
    }
    if (k === 'h' || k === 'H') return done(() => P.markingMirror(ed, id, i, 'h'));
    if (k === 'v' || k === 'V') return done(() => P.markingMirror(ed, id, i, 'v'));
    if (k === 'Delete' || k === 'Backspace') return true;   // swallowed: Delete must not take the BOX while its bitmap has the keys
    return false;
  }

  // ---- palette entries
  private buildPalette(p: Panel, b: BoxData, m0: MarkingDef) {
    const ed = this.H.ed; const id = b.id; const i = this.mk.i;
    const g = () => this.cur() ?? m0;
    const s = p.section(`Marking ${i} — palette (${g().pal.length} / ${P.MAX_PAL})`, true);
    p.text(s, () => 'entries are MATERIALS — an albedo (absolute, or × the box\'s own), a roughness, an emitted radiance — never a shaded colour: no gradient and no baked lighting, by construction. A backlit front is ONE LAMP behind a printed film: every entry may emit and hues may differ per entry (a red wedge on a blue field), but let the dominant hue carry the flux — the game registers one rect light per marking in the flux-weighted MEAN chroma (exact in the far field).');
    const model = () => P.emitModel(g().pal);
    const setPal = (k: number, patch: Parameters<typeof P.markingSetPal>[4], key: string) => this.try(() => P.markingSetPal(ed, id, i, k, patch, { coalesce: `mk:${id}:${i}:pal${k}:${key}` }));
    // emission summary (shown when anything emits): hue count + the minority hues' share of the flux — an ADVISORY, not a lock (one lamp, per-cell filters; the light takes the mean)
    if (model().chroma) {
      const counts = () => { const m = g(); const n = [0, 0, 0]; for (const row of m.cells) for (const ch of row) { const e = ch === 'a' ? 0 : ch === 'b' ? 1 : ch === 'c' ? 2 : -1; if (e >= 0) n[e]++; } return n; };
      const fm = () => P.emitModel(g().pal, counts());
      p.text(s, () => { const M = fm(); return M.hues <= 1 ? 'emitters: one hue ✓ (the registered light is exactly this colour)' : `emitters: ${M.hues} hues · the minority carries ${(M.minorityShare * 100).toFixed(0)} % of the flux — the registered light takes the flux-weighted mean${M.minorityShare > 0.3 ? ' ⚠ that is a lot for ONE light: consider two markings' : ''}`; });
      p.buttons(s, '', [{ text: 'unify hue (keep levels)', title: 'rewrite every emitter to the first emitter\'s chroma at its own level', run: () => this.try(() => { P.markingUnifyChroma(ed, id, i); this.seal(); }) }]);
    }
    g().pal.forEach((_q, k) => {
      const q = () => g().pal[k] ?? _q; const L = 'abc'[k];
      const sub = el('div', 'palent'); s.append(sub);
      const head = el('div', 'row palhead'); const chip = el('span', 'mkchip big'); const lab = el('label', '', `entry ${L}`); const desc = el('span', 'paldesc', ''); head.append(lab, chip, desc);
      const rfHead = () => { const base = P.resolvedFinish(ed, b).albedo; chip.style.background = P.linearToHex(P.resolveAlbedo(q(), base)); chip.classList.toggle('emit', !!q().emit); desc.textContent = palDesc(q()); }; rfHead(); p.keep(rfHead, head); sub.append(head);
      const modes = ['× box albedo (mul)', 'absolute albedo', 'leave the albedo (rough / emit only)'];
      p.select(sub, 'albedo mode', modes, () => q().albedo ? 1 : q().mul !== undefined ? 0 : 2, v => { setPal(k, { mode: v === 0 ? 'mul' : v === 1 ? 'albedo' : 'none', ...(v === 1 && !q().albedo ? { albedo: P.resolveAlbedo(q(), P.resolvedFinish(ed, b).albedo) } : {}) }, 'mode'); this.seal(); }, 'how the entry colours its cells: a MULTIPLIER of whatever the box is painted (a seam, a cap: follows a repaint), an ABSOLUTE linear albedo (tape, a label), or nothing (an entry that only changes roughness / emits)');
      if (q().albedo) this.colorRows(p, sub, `albedo ${L}`, () => q().albedo ?? [0.5, 0.5, 0.5], (v, live) => { setPal(k, { albedo: v }, 'alb'); if (!live) this.seal(); }, 'absolute linear albedo of the entry (0‥1)');
      else if (q().mul !== undefined) { const sl = p.slider(sub, `mul ${L}`, 0.4, 1.6, 0.01, () => q().mul ?? 1, v => setPal(k, { mul: v }, 'mul'), '× the box\'s own albedo (0.4 darkens to a seam; 1.6 brightens; clamped to 1 per channel at render)'); sl.onchange = () => this.seal(); sl.addEventListener('pointerup', () => this.seal()); }
      p.toggleBox(sub, `roughness ${L}`, () => q().rough !== undefined, on => { setPal(k, { rough: on ? (P.resolvedFinish(ed, b).rough ?? 0.4) : null }, 'roughOn'); this.seal(); }, 'the entry\'s own roughness (off = the box\'s finish) — glossy tape on a matte carton, a satin key cap');
      if (q().rough !== undefined) { const sl = p.slider(sub, `rough ${L}`, 0.02, 1, 0.01, () => q().rough ?? 0.5, v => setPal(k, { rough: v }, 'rough'), P.traceHint(q().rough)); sl.onchange = () => this.seal(); sl.addEventListener('pointerup', () => this.seal()); }
      p.toggleBox(sub, `emits ${L}`, () => !!q().emit, on => { setPal(k, { emitLevel: on ? (model().levels.find(x => x !== null) ?? 1.5) : null }, 'emitOn'); this.seal(); }, 'an emissive entry: radiance = its hue × this level — switching it on keeps the entry\'s own hue (its albedo\'s: a red print transmits red) (W/sr/m²). The box\'s switchable (if any) drives it at runtime; game.ts registers ONE rectangular light for the marking whose flux is the pattern\'s integral');
      if (q().emit) p.number(sub, `level ${L} (W/sr/m²)`, () => { const e2 = q().emit; return e2 ? Math.max(e2[0], e2[1], e2[2]) : 0; }, v => { setPal(k, { emitLevel: Math.max(0.01, v) }, 'level'); }, { step: 0.05, min: 0.01, max: 60, digits: 2, title: 'peak radiance of the entry (LEDs ≈ 6, a monitor bar ≈ 1.5, the vending field ≈ 1‥2): the light\'s colour stays the shared chroma' });
      if (q().emit) this.colorRows(p, sub, `emit hue ${L}`, () => { const e2 = q().emit!; const mx = Math.max(e2[0], e2[1], e2[2], 1e-6); return [e2[0] / mx, e2[1] / mx, e2[2] / mx]; }, (v, live) => { setPal(k, { emitOwnChroma: v }, 'hue'); if (!live) this.seal(); }, 'this entry\'s filter colour over the one backlight (its level is kept); the registered light takes the flux-weighted mean of all emitters');
      p.buttons(sub, '', [{ text: `remove ${L}`, title: `drop entry ${L}: its cells go transparent, later entries move down a letter`, run: () => this.try(() => { P.markingRemovePal(ed, id, i, k); if (this.mk.entry > g().pal.length) this.mk.entry = g().pal.length; }) }]);
    });
    p.buttons(s, '', [{ text: g().pal.length >= P.MAX_PAL ? `add entry (at the cap of ${P.MAX_PAL})` : `add entry ${'abc'[g().pal.length]}`, title: 'a marking has at most three entries (2-bit cells: transparent + a b c)', run: () => this.try(() => { if (g().pal.length >= P.MAX_PAL) { this.say(`at most ${P.MAX_PAL} entries — the cells are 2 bits`); return; } const k = P.markingAddPal(ed, id, i); this.mk.entry = k + 1; }) }]);
  }
  // ---- generators
  private buildGenerators(p: Panel, b: BoxData, _m: MarkingDef) {
    const ed = this.H.ed; const id = b.id; const i = this.mk.i;
    const s = p.section(`Marking ${i} — generators`, false);
    const kinds = [...P.GENERATOR_KINDS];
    p.select(s, 'generator', kinds, () => kinds.indexOf(this.gen.kind), k => { this.gen.kind = kinds[k] ?? 'grid'; this.gen.params = {}; this.markKey = '§'; this.tick(true); }, 'parametric fills INTO the bitmap (then hand-edit): grid = key caps · seams = drawers / doors + pulls · lines = text bars · scribble · dots = LEDs · window = the vending cans · glyph = the 5 × 7 pictograms · tape = a band of packing tape · fill');
    for (const prm of P.GENERATOR_PARAMS[this.gen.kind]) p.number(s, prm.key, () => this.gen.params[prm.key] ?? prm.def, v => { this.gen.params[prm.key] = Math.round(v); }, { step: 1, min: prm.min, max: prm.max, digits: 0, title: `${prm.title}${prm.entry ? ' (a palette entry index: 1 = a, 2 = b, 3 = c, 0 = transparent — entries the palette lacks are ADDED)' : ''}` });
    p.buttons(s, '', [{ text: `run ${this.gen.kind} into the bitmap`, title: 'writes the cells (grid / seams / window / fill / tape overwrite; lines / scribble / glyph draw over unless "clear" is 1)', run: () => this.try(() => { P.markingGenerate(ed, id, i, this.gen.kind, this.gen.params); this.say(`${this.gen.kind} → marking ${i} of ${id}`); }) }]);
    p.text(s, () => this.gen.kind === 'glyph' ? `glyphs: ${P.GLYPH_NAMES.map((n, k) => `${k} ${n}`).join(' · ')}` : this.gen.kind === 'tape' ? 'tape sets the ink entry\'s MATERIAL to brown packing tape (albedo 0.36 0.22 0.10, rough 0.35) — the one dark glossy accent that reads on a carton at play distance' : '');
  }
  // ---- ASCII
  private buildAscii(p: Panel, b: BoxData, m0: MarkingDef) {
    const ed = this.H.ed; const id = b.id; const i = this.mk.i;
    const g = () => this.cur() ?? m0;
    const s = p.section(`Marking ${i} — ASCII ('.abc' rows, top first)`, false);
    const ta = el('textarea', 'ascii') as HTMLTextAreaElement; ta.spellcheck = false; ta.setAttribute('rows', String(Math.min(14, g().size[1] + 1))); ta.setAttribute('wrap', 'off'); ta.value = g().cells.join('\n');
    ta.addEventListener('keydown', (e: KeyboardEvent) => e.stopPropagation());
    s.append(ta);
    const rf = () => { if (document.activeElement !== ta) ta.value = g().cells.join('\n'); }; p.keep(rf, ta);
    p.buttons(s, '', [
      { text: 'apply text', title: 'the textarea\'s rows → the bitmap (resized to the art; entries it names beyond the palette are added; refused if it will not fit the face at this res)', run: () => this.try(() => { P.markingFromAscii(ed, id, i, ta.value); this.say(`ascii → marking ${i}: ${g().size[0]} × ${g().size[1]}`); }) },
      { text: 'copy as literal', title: 'the rows as a markingDefaults.ts-style array literal → the clipboard (paste it into the code to make it a per-kind default)', run: () => { const lit = P.asciiLiteral(g().cells, `ART_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`); const nav = typeof navigator !== 'undefined' ? navigator : null; if (nav?.clipboard?.writeText) void nav.clipboard.writeText(lit).then(() => this.say(`copied ${g().cells.length} rows as a literal`), () => { ta.value = lit; this.say('clipboard blocked — the literal is in the textarea'); }); else { ta.value = lit; this.say('the literal is in the textarea'); } } },
      { text: 'paste from clipboard', title: 'read a literal / rows from the clipboard into the textarea (then "apply text")', run: () => { const nav = typeof navigator !== 'undefined' ? navigator : null; if (nav?.clipboard?.readText) void nav.clipboard.readText().then(t => { ta.value = t; this.say('pasted into the textarea — "apply text" to use it'); }, () => this.say('clipboard read blocked — paste into the textarea by hand')); else this.say('paste into the textarea by hand'); } },
    ]);
  }
}
/** the cells on the line between two cells (Bresenham) — a fast drag paints a continuous stroke */
function linePts(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const out: [number, number][] = []; let x = a[0], y = a[1]; const dx = Math.abs(b[0] - x), dy = -Math.abs(b[1] - y); const sx = x < b[0] ? 1 : -1, sy = y < b[1] ? 1 : -1; let err = dx + dy;
  for (let n = 0; n < 80; n++) { out.push([x, y]); if (x === b[0] && y === b[1]) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
  return out;
}
const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function palDesc(q: MarkPal): string { return `${q.albedo ? `albedo (${q.albedo.map(x => x.toFixed(2)).join(' ')})` : q.mul !== undefined ? `× ${q.mul}` : 'box albedo'}${q.rough !== undefined ? ` · rough ${q.rough}` : ''}${q.emit ? ` · emits (${q.emit.map(x => +x.toFixed(2)).join(' ')})` : ''}`; }
