// The viewer's chrome: the top bar (scene tabs, variant chips, the live gait strip), the right inspector (OUTLINER tree over the stage / figure / skeleton /
// props / items / lights, and the PROPERTIES sheet composed from the selection + the variant's groups + the always-on figure block), the gear menu (stage &
// camera, renderer, hotkeys, 'all knobs', 'copy all changed'), the flat searchable 'all knobs' overlay (today's whole panel, for when the curation hides
// something), the constants box, and the URL hash (#scene/variant&sel=…). DOM is built on scene / variant / selection / kit changes only; per frame it
// compares a couple of short keys and, every 10 frames, writes text nodes (HUD, log, gait strip).
import { Panel } from '../ui/panel';
import type { Runtime } from './runtime';
import { SCENES, VariantDef, applyVariant, findVariant } from './scenes';
import { makeGroups, GroupDef, SheetCtx, nodeGroup, lightGroup, boneGroup, itemGroup, allChangedSource } from './sheet';
import { rigSource } from '../game/rigProps';
import { setAllOff, gaitSource } from './gait';

const BONE_GROUPS: [string, string, string[]][] = [
  ['trunk', 'trunk', ['hips', 'spine2', 'chest', 'neck', 'head', 'headTop']],
  ['armL', 'left arm', ['upperArmL', 'forearmL', 'handL', 'fingerL']], ['armR', 'right arm', ['upperArmR', 'forearmR', 'handR', 'fingerR']],
  ['legL', 'left leg', ['thighL', 'shinL', 'footL', 'toeL']], ['legR', 'right leg', ['thighR', 'shinR', 'footR', 'toeR']],
];
export const HOTKEYS = [
  ['drag · shift/right-drag · wheel', 'orbit · pan (frees the focus) · zoom'], ['click a prop', 'select it (arrows move, rings rotate) · U parent · Esc deselect'],
  ['F · H', 'frame the body · head close-up'], ['T · P', 'turntable · pause the character'], ['K · X', 'shoot · die (ragdoll, shot from the camera)'],
  ['N · L', 'night vision · rail light / torch'], ['G · C', 'guard kit · carbine'], ['0 · 1 · 2 · 4', 'holstered · pistol · canister · FN2000 off → slung → in the hands'], ['E', 'hold: swap knife ↔ pistol'],
  ['Tab', 'hide / show the inspector'], ['` · [ · ]', 'debug views · exposure'], ['⚙ ▸ all knobs', 'the flat searchable list of everything'],
];
const LS = { inspW: 'twopointsix.viewer.inspW', inspHidden: 'twopointsix.viewer.inspHidden', outlH: 'twopointsix.viewer.outlH' };

/** every element the chrome hangs on, by role (viewer.html's ids are the defaults; the workbench hands its own) */
export type ViewerUiEls = Record<'app' | 'scenes' | 'variants' | 'strip' | 'gaitline' | 'alloff' | 'copygait' | 'hud' | 'help' | 'log' | 'outbox' | 'rigout' | 'outwhat' | 'gear' | 'gearbtn' | 'allknobs' | 'inspbtn' | 'inspector' | 'grip' | 'splitter' | 'outliner' | 'props' | 'proptitle' | 'outclose' | 'outcopy' | 'allclose', HTMLElement>;
export interface ViewerUiOpts {
  els?: Partial<ViewerUiEls>;
  /** own the URL hash (#scene/variant&sel=) — false in the workbench, which keeps mode + document + scene in its own hash */
  hash?: boolean;
  /** list the STAGING scenes (figures stood in the level) — the workbench does; the standalone viewer has no level */
  staging?: boolean;
  /** the help line's text (the workbench words its own controls) */
  help?: string;
  /** a scene / variant was applied (the workbench re-points its world, tree and hash) */
  onScene?: (sceneId: string, variantId: string, def: VariantDef | null) => void;
  /** the inspector's width / split are the host's to size (its own grip) */
  hostSized?: boolean;
}
export class Ui {
  readonly groups: ReturnType<typeof makeGroups>;
  private sheet: Panel; private gearPanel: Panel; private allPanel: Panel | null = null;
  private ctx: SheetCtx;
  variantDef: VariantDef | null = null;
  private el: ViewerUiEls & { alloff: HTMLInputElement };
  private outlinerKey = ''; private sheetKey = ''; private rows = new Map<string, HTMLElement>();
  private expanded = new Set<string>(['grp:lights', 'grp:items', 'grp:props']);   // skeleton groups start collapsed
  readonly opts: ViewerUiOpts;

  constructor(readonly rt: Runtime, opts: ViewerUiOpts = {}) {
    this.opts = opts;
    const g = (id: string) => document.getElementById(id) as HTMLElement; const E = opts.els ?? {};
    const pick = (k: keyof ViewerUiEls, id: string = k) => E[k] ?? g(id);
    this.el = { app: pick('app'), scenes: pick('scenes'), variants: pick('variants'), strip: pick('strip'), gaitline: pick('gaitline'), alloff: pick('alloff') as HTMLInputElement, copygait: pick('copygait'), hud: pick('hud'), help: pick('help'), log: pick('log'), outbox: pick('outbox'), rigout: pick('rigout'), outwhat: pick('outwhat'), gear: pick('gear'), gearbtn: pick('gearbtn'), allknobs: pick('allknobs'), inspbtn: pick('inspbtn'), inspector: pick('inspector'), grip: pick('grip', 'inspgrip'), splitter: pick('splitter'), outliner: pick('outliner'), props: pick('props'), proptitle: pick('proptitle'), outclose: pick('outclose'), outcopy: pick('outcopy'), allclose: pick('allclose') };
    this.ctx = { rt, emit: (t, w) => this.emit(t, w), rebuild: () => this.rebuildSheet(), select: id => this.select(id) };
    this.groups = makeGroups(this.ctx);
    this.sheet = new Panel({ root: this.el.props, header: false, persistKey: 'twopointsix.viewer.sheetOpen' }); this.sheet.visible = true;
    this.gearPanel = new Panel({ root: this.el.gear, header: false, persistKey: 'twopointsix.viewer.gearOpen' });
    this.buildTopbar(); this.buildGear(); this.wireInspector();
    rt.gizmo.onSelect = () => { const p = rt.gizmo.selected; if (p) rt.st.sel = 'rig:' + p; else if (rt.st.sel?.startsWith('rig:')) rt.st.sel = null; this.onSelectionChanged(); };
    rt.gizmo.onChange = () => { this.sheet.refresh(); if (!this.el.outbox.classList.contains('hidden') && this.outKind === 'rig') this.el.rigout.textContent = rigSource(); };
    this.el.help.textContent = opts.help ?? 'drag orbit · shift/right-drag pan · wheel zoom · click a prop to select (U parent, Esc deselect) · F/H frame · T turntable · P pause · K shoot · X die · N nv · L light · G guard · C carbine · 0/1/2 hand · Tab inspector · ⚙ for the rest';
    if (opts.hash !== false) { window.addEventListener('hashchange', () => this.applyHash()); if (!this.applyHash()) this.applyScene('sam', 'idle'); }
    else this.applyScene('sam', 'idle');
  }
  /** the scenes this chrome lists (staging scenes only when the host has a level to stand them in) */
  scenes() { return SCENES.filter(s => !s.staging || !!this.opts.staging); }

  // ---------------------------------------------------------------- scenes / variants
  private buildTopbar() {
    const { scenes } = this.el; scenes.textContent = '';
    for (const s of this.scenes()) { const b = document.createElement('button'); b.className = 'tab'; b.textContent = s.label; b.title = s.title; b.dataset.id = s.id; b.onclick = () => { if (this.rt.st.sceneId !== s.id) this.applyScene(s.id, s.variants[0].id); }; scenes.appendChild(b); }
    this.el.alloff.onchange = () => { this.rt.st.allOff = this.el.alloff.checked; setAllOff(this.el.alloff.checked); this.sheet.refresh(); };
    this.el.copygait.onclick = () => this.emit(gaitSource(), 'gait constants — paste over the matching lines in src/game/character.ts');
    this.el.outclose.onclick = () => this.el.outbox.classList.add('hidden');
    this.el.outcopy.onclick = () => void this.clip(this.el.rigout.textContent ?? '');
  }
  private paintTopbar() {
    const st = this.rt.st;
    for (const b of Array.from(this.el.scenes.children) as HTMLElement[]) b.classList.toggle('on', b.dataset.id === st.sceneId);
    const scene = SCENES.find(s => s.id === st.sceneId) ?? SCENES[0];
    const v = this.el.variants; v.textContent = '';
    for (const x of scene.variants) { const c = document.createElement('button'); c.className = 'chip'; c.textContent = x.label; c.title = x.title; c.classList.toggle('on', x.id === st.variantId); c.onclick = () => this.applyScene(scene.id, x.id); v.appendChild(c); }
    this.el.strip.classList.toggle('hidden', !this.variantDef?.gait);
  }
  /** switch scene / variant (re-selecting the current one re-applies it: respawn + its extra again) */
  applyScene(sceneId: string, variantId: string, sel?: string | null) {
    this.variantDef = applyVariant(this.rt, sceneId, variantId);
    if (sel !== undefined) this.setSel(sel);
    this.paintTopbar(); this.rebuildSheet(); this.writeHash(); this.rt.msg(`${this.rt.st.sceneId} ▸ ${this.variantDef?.label ?? variantId}`);
    this.opts.onScene?.(this.rt.st.sceneId, this.rt.st.variantId, this.variantDef);
  }

  // ---------------------------------------------------------------- selection
  select(id: string | null) { this.setSel(id); this.onSelectionChanged(); }
  private setSel(id: string | null) {
    const st = this.rt.st; st.sel = id;
    const rig = id?.startsWith('rig:') ? id.slice(4) : null;
    if (this.rt.gizmo.selected !== rig) { this.rt.gizmo.selected = rig; }   // (set the field, not select(): no echo back through onSelect)
    if (id?.startsWith('bone:')) st.trackBone = id.slice(5);
  }
  private onSelectionChanged() { this.paintOutlinerSel(); this.rebuildSheet(); this.writeHash(); }

  // ---------------------------------------------------------------- hash: #scene/variant&sel=<id>
  private writeHash() { if (this.opts.hash === false) return; const st = this.rt.st; const h = `#${st.sceneId}/${st.variantId}${st.sel ? `&sel=${encodeURIComponent(st.sel)}` : ''}`; if (location.hash !== h) history.replaceState(null, '', h); }
  /** parse and apply the location hash; false when it names nothing valid */
  applyHash(): boolean {
    const raw = decodeURIComponent(location.hash.replace(/^#/, '')); if (!raw) return false;
    const [sv, ...rest] = raw.split('&'); const [scene, variant] = sv.split('/'); const selPart = rest.find(r => r.startsWith('sel=')); const sel = selPart ? selPart.slice(4) : null;
    const found = findVariant(scene, variant ?? '') ?? (SCENES.find(s => s.id === scene) ? { scene: SCENES.find(s => s.id === scene)!, variant: SCENES.find(s => s.id === scene)!.variants[0] } : null);
    if (!found) return false;
    const st = this.rt.st;
    if (st.sceneId === found.scene.id && st.variantId === found.variant.id && this.variantDef) { if ((sel ?? null) !== st.sel) this.select(sel); return true; }
    this.applyScene(found.scene.id, found.variant.id, sel); return true;
  }

  // ---------------------------------------------------------------- the sheet
  private selectionGroups(): GroupDef[] {
    const sel = this.rt.st.sel; if (!sel) return [];
    if (sel.startsWith('rig:')) { const path = sel.slice(4); const top = path.split('.')[0]; const out = [nodeGroup(this.ctx, path)]; const rg = this.groups.get(`rig.${top === 'holster' ? (this.rt.st.guard ? 'guardPistol' : 'pistol') : top}`); if (rg) out.push(rg); if (top === 'emitters') { const fx = this.groups.get('effects'); if (fx) out.push(fx); } return out; }
    if (sel.startsWith('light:')) { const g = lightGroup(this.ctx, sel.slice(6)); return g ? [g] : []; }
    if (sel.startsWith('bone:')) return [boneGroup(this.ctx, sel.slice(5))];
    if (sel.startsWith('item:')) return [itemGroup(this.ctx, parseInt(sel.slice(5), 10) || 0)];
    if (sel === 'stage') return ['stage', 'renderer'].map(id => this.groups.get(id)!).filter(Boolean);
    if (sel === 'door') return ['door'].map(id => this.groups.get(id)!).filter(Boolean);
    if (sel === 'figure') return ['kit'].map(id => this.groups.get(id)!).filter(Boolean);
    return [];
  }
  rebuildSheet() {
    const p = this.sheet; p.clear();
    const list: GroupDef[] = []; const seen = new Set<string>();
    const push = (g: GroupDef | null) => { if (g && !seen.has(g.id)) { seen.add(g.id); list.push(g); } };
    for (const g of this.selectionGroups()) push(g);
    push(this.groups.get('figure'));
    for (const id of this.variantDef?.groups ?? []) push(this.groups.get(id));
    push(this.groups.get('playback'));
    for (const g of list) this.buildGroup(p, g);
    this.el.proptitle.textContent = `· ${this.rt.st.sceneId} ▸ ${this.variantDef?.label ?? ''}${this.rt.st.sel ? ` · ${this.rt.st.sel}` : ''}`;
    this.sheetKey = this.computeSheetKey();
    p.refresh();
  }
  private buildGroup(p: Panel, g: GroupDef) {
    const sec = p.section(g.title, g.open ?? true);
    if (g.copy || g.reset) {
      const tools = document.createElement('div'); tools.className = 'gtools';
      if (g.changed) { const dot = document.createElement('span'); dot.className = 'gchanged'; dot.textContent = '● changed'; tools.appendChild(dot); const rf = () => { dot.style.visibility = g.changed!() ? 'visible' : 'hidden'; }; rf(); p.keep(rf, dot); }
      if (g.reset) { const b = document.createElement('button'); b.textContent = 'reset to shipped'; b.onclick = () => { g.reset!(); p.refresh(); this.rt.msg(`${g.title}: reset to the shipped numbers`); }; tools.appendChild(b); }
      if (g.copy) { const b = document.createElement('button'); b.textContent = 'copy constants'; b.onclick = () => this.emit(g.copy!(), `${g.title}`); tools.appendChild(b); }
      sec.appendChild(tools);
    }
    g.build(p, sec);
  }
  /** what, besides scene / variant / selection, decides which rows exist: whether the selected rig node is drawn this frame (kit / slot / NV decide) */
  private computeSheetKey(): string {
    const st = this.rt.st;
    return st.sel?.startsWith('rig:') ? (this.rt.gizmo.node()?.path === st.sel.slice(4) ? 'y' : 'n') : '-';
  }

  // ---------------------------------------------------------------- outliner
  private computeOutlinerKey(): string {
    const rt = this.rt, st = rt.st;
    return `${st.guard ? 'g' : 's'}${st.carbine ? 'c' : ''}${st.guardTorch ? 't' : ''}${st.slot}r${st.rifle}${st.lightOn ? 'L' : ''}${st.door.show ? 'd' : ''}${rt.char.alive ? '' : 'x'}|${rt.stageLights.map(l => l.enabled ? Math.round(l.intensity) : 'off').join(',')}|${rt.meta.map(m => m.path).join(',')}|${rt.stageItems.items.length}`;
  }
  private rebuildOutliner() {
    const rt = this.rt, st = rt.st; const root = this.el.outliner; root.textContent = ''; root.className = 'ol'; this.rows.clear();
    const node = (id: string, label: string, depth: number, o: { grp?: boolean; kids?: boolean; dim?: boolean; title?: string; inert?: boolean } = {}) => {
      const r = document.createElement('div'); r.className = 'n' + (o.grp ? ' grp' : '') + (o.dim ? ' dim' : '') + (o.inert ? ' inert' : ''); r.style.paddingLeft = `${4 + depth * 12}px`;
      const tw = document.createElement('span'); tw.className = 'tw'; tw.textContent = o.kids ? (this.expanded.has(id) ? '▾' : '▸') : ' '; r.appendChild(tw); r.appendChild(document.createTextNode(label));
      if (o.title) r.title = o.title;
      r.onclick = e => { e.stopPropagation(); if (o.inert) return; if (o.kids && (e.target === tw || o.grp)) { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); this.rebuildOutliner(); return; } if (o.grp) return; this.select(st.sel === id ? null : id); };
      root.appendChild(r); if (!o.inert) this.rows.set(id, r); return this.expanded.has(id);
    };
    // Stage ▸ lights, items, the door marker
    node('stage', 'Stage (studio floor, back wall, cube, post)', 0, { title: 'select: stage & camera + renderer in the sheet' });
    if (node('grp:lights', `lights (${rt.stageLights.length + 2})`, 1, { grp: true, kids: true })) {
      for (const L of rt.stageLights) node('light:' + L.name, `${L.name} (${L.enabled ? Math.round(L.intensity) : 'off'})`, 2, { dim: !L.enabled });
      node('light:' + rt.railLight.name, `rail light / rifle light — Sam (${st.lightOn && !st.guard && (st.slot === 1 || st.rifle === 2) ? 'lit' : 'dark'})`, 2, { dim: st.guard });
      node('light:' + rt.torchLight.name, `torch / weapon light — guard (${st.lightOn && st.guard ? 'lit' : 'dark'})`, 2, { dim: !st.guard });
    }
    const items = rt.stageItems.items;
    if (node('grp:items', `loose items (${items.length})`, 1, { grp: true, kids: items.length > 0 })) items.forEach((it, i) => node('item:' + i, `${it.kind}${it.settled ? '' : ' (moving)'}`, 2));
    if (st.door.show) node('door', 'door marker (leaf + jambs)', 1, { title: 'the Door group: distance, hinge side, the hand on the leaf' });
    // Figure ▸ skeleton, props
    node('figure', `Figure: ${st.guard ? `guard${st.carbine ? ' (carbine)' : st.guardTorch ? ' (torch)' : ' (pistol)'}` : `Sam (${st.rifle === 2 ? 'FN2000 in the hands' : (['holstered', 'pistol', 'canister'][st.slot] ?? 'slot ' + st.slot) + (st.rifle === 1 ? ', FN2000 slung' : '')})`}${rt.char.alive ? '' : ' — ragdoll'}`, 0, { title: 'select: the kit in the sheet' });
    if (node('grp:skel', 'skeleton (read-only joints)', 1, { grp: true, kids: true })) {
      for (const [gid, label, bones] of BONE_GROUPS) if (node('grp:skel.' + gid, label, 2, { grp: true, kids: true })) for (const b of bones) node('bone:' + b, b, 3, { dim: !rt.char.bones[b] });
    }
    if (node('grp:props', `attached props (${rt.meta.length} nodes)`, 1, { grp: true, kids: true })) {
      if (!rt.meta.length) node('noprops', st.showProps ? '(no props drawn with this kit / slot)' : '(draw props is off: Playback ▸ draw props)', 2, { dim: true, inert: true });
      for (const m of rt.meta) node('rig:' + m.path, m.label, 1 + Math.max(1, m.depth + (m.path.startsWith('emitters') ? 1 : 0)), { title: m.path });
    }
    this.outlinerKey = this.computeOutlinerKey();
    this.paintOutlinerSel();
  }
  private paintOutlinerSel() { const sel = this.rt.st.sel; for (const [id, r] of this.rows) r.classList.toggle('sel', id === sel); }

  // ---------------------------------------------------------------- gear menu, all-knobs overlay, constants box
  private buildGear() {
    const p = this.gearPanel; const rt = this.rt;
    const top = p.section('Viewer', true);
    p.buttons(top, '', [{ text: 'all knobs… (searchable)', run: () => this.toggleAllKnobs(true) }, { text: 'copy ALL changed constants', run: () => { const s = allChangedSource(this.groups); if (s) this.emit(s, 'every table with a value off its shipped default'); else rt.msg('nothing is off its shipped value'); } }]);
    p.buttons(top, '', [{ text: 'constants box', run: () => { this.el.outbox.classList.toggle('hidden'); if (!this.el.outbox.classList.contains('hidden') && !this.el.rigout.textContent) { this.el.rigout.textContent = rigSource(); this.outKind = 'rig'; } } }, { text: 'copy RIG', run: () => this.emit(rigSource(), 'RIG — paste over the block in src/game/rigProps.ts', 'rig') }, { text: 'shot → docs/shots', run: () => { void rt.shot(`viewer_${rt.st.sceneId}_${rt.st.variantId}`).then(r => rt.msg(`shot: ${r}`)); }, title: 'needs bun run tools/shot-server.ts' }]);
    for (const id of ['stage', 'renderer']) { const g = this.groups.get(id); if (g) g.build(p, p.section(g.title, true)); }
    const hk = p.section('Hotkeys', false);
    for (const [k, what] of HOTKEYS) { const r = document.createElement('div'); r.className = 'row hk'; const a = document.createElement('label'); a.textContent = k; const b = document.createElement('span'); b.textContent = what; r.append(a, b); hk.appendChild(r); }
    this.el.gearbtn.onclick = () => this.toggleGear();
    this.el.inspbtn.onclick = () => this.toggleInspector();
    this.el.allclose.onclick = () => this.toggleAllKnobs(false);
  }
  toggleGear(force?: boolean) { const g = this.el.gear; const on = force ?? g.classList.contains('hidden'); g.classList.toggle('hidden', !on); this.el.gearbtn.classList.toggle('on', on); this.gearPanel.visible = on; if (on) { this.gearPanel.refresh(); this.toggleAllKnobs(false); } }
  toggleAllKnobs(force?: boolean) {
    const a = this.el.allknobs; const on = force ?? a.classList.contains('hidden');
    if (on && !this.allPanel) {   // built once, lazily: EVERY group, flat — today's panel, for when the curation hides something
      const p = this.allPanel = new Panel({ root: a, header: true, persistKey: 'twopointsix.viewer.allOpen' });
      for (const id of this.groups.ids) { const g = this.groups.get(id)!; this.buildGroup(p, { ...g, open: false }); }
    }
    a.classList.toggle('hidden', !on); if (this.allPanel) { this.allPanel.visible = on; if (on) { this.allPanel.refresh(); this.allPanel.focusSearch(); } }
    if (on) this.toggleGear(false);
  }
  get overlayOpen() { return !this.el.gear.classList.contains('hidden') || !this.el.allknobs.classList.contains('hidden'); }
  closeOverlays() { this.toggleGear(false); this.toggleAllKnobs(false); }
  private outKind = '';
  /** show paste-back text in the constants box, put it on the clipboard, say so */
  emit(text: string, what: string, kind = '') {
    this.el.rigout.textContent = text; this.el.outwhat.textContent = what; this.outKind = kind; this.el.outbox.classList.remove('hidden');
    void this.clip(text).then(ok => this.rt.msg(ok ? `copied ${text.split('\n').length} lines — ${what}` : 'clipboard blocked by the browser — the text is selected in the box, ⌘/Ctrl+C it'));
  }
  private async clip(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const sel = window.getSelection(); if (sel) { const r = document.createRange(); r.selectNodeContents(this.el.rigout); sel.removeAllRanges(); sel.addRange(r); } return false; }
  }

  // ---------------------------------------------------------------- inspector: collapse, width, outliner height (persisted)
  private wireInspector() {
    const app = this.el.app;
    this.el.inspbtn.classList.toggle('on', !app.classList.contains('insp-hidden'));
    if (this.opts.hostSized) return;   // (the workbench sizes its own columns and keeps its own splitters)
    const w = parseInt(localStorage.getItem(LS.inspW) ?? '', 10); if (w > 200 && w < 900) app.style.setProperty('--insp-w', `${w}px`);
    const oh = parseInt(localStorage.getItem(LS.outlH) ?? '', 10); if (oh > 60 && oh < 2000) app.style.setProperty('--outl-h', `${oh}px`);
    if (localStorage.getItem(LS.inspHidden) === '1') app.classList.add('insp-hidden');
    this.el.inspbtn.classList.toggle('on', !app.classList.contains('insp-hidden'));
    const drag = (el: HTMLElement, onMove: (e: MouseEvent) => void, onEnd: () => void) => el.addEventListener('mousedown', e => {
      e.preventDefault(); document.body.classList.add('resizing');
      const mm = (ev: MouseEvent) => onMove(ev); const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); document.body.classList.remove('resizing'); onEnd(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    let lastApply = 0; let pendW = 0;
    drag(this.el.grip, e => { pendW = Math.round(Math.min(900, Math.max(220, window.innerWidth - e.clientX))); const now = performance.now(); if (now - lastApply > 120) { lastApply = now; app.style.setProperty('--insp-w', `${pendW}px`); } },   // (throttled: every width change re-allocates the engine's targets)
      () => { if (pendW) { app.style.setProperty('--insp-w', `${pendW}px`); localStorage.setItem(LS.inspW, String(pendW)); } });
    let pendH = 0;
    drag(this.el.splitter, e => { const top = this.el.outliner.getBoundingClientRect().top; pendH = Math.round(Math.max(60, e.clientY - top)); app.style.setProperty('--outl-h', `${pendH}px`); }, () => { if (pendH) localStorage.setItem(LS.outlH, String(pendH)); });
  }
  toggleInspector() { const app = this.el.app; const hid = !app.classList.contains('insp-hidden'); app.classList.toggle('insp-hidden', hid); localStorage.setItem(LS.inspHidden, hid ? '1' : '0'); this.el.inspbtn.classList.toggle('on', !hid); }

  // ---------------------------------------------------------------- per frame
  tick(frameCount: number) {
    if (this.computeOutlinerKey() !== this.outlinerKey) this.rebuildOutliner();
    if (this.computeSheetKey() !== this.sheetKey) this.rebuildSheet();
    if (frameCount % 10 === 0) {
      const rt = this.rt;
      this.el.hud.textContent = rt.hudLines().join('\n');
      const nowS = performance.now() / 1000; this.el.log.textContent = rt.messages.filter(m => nowS - m.t < 5).map(m => m.text).join('\n');
      if (this.variantDef?.gait) { this.el.gaitline.textContent = rt.gait.line(); if (document.activeElement !== this.el.alloff) this.el.alloff.checked = rt.st.allOff; }
    }
  }
}
