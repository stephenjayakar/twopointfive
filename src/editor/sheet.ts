// The inspector's PROPERTY SHEET: a Panel (src/ui/panel.ts — the viewer's widgets) rebuilt for whatever is selected — one box, many things,
// a light, a switchable, a door, a route / waypoint, a volume, a prop, a post, a mission mark, a floor — or the LEVEL itself when nothing is.
// Every field writes through Editor (undoable, coalesced per field); text fields are a small custom row (Panel has numbers, not strings).
import type { Vec3 } from '../math/vec';
import { Panel } from '../ui/panel';
import type { BoxData, LightData, DoorData, RouteData, VolumeData, SwitchableData, PropData, FloorData, DeviceData, CameraData, KeypadData, LaserData } from '../scene/levelData';
import { AUTHORED_FLAGS, DEVICE_DEFAULTS } from '../scene/levelData';
import { Editor, parseRef, Ref, keypadPlacement, scenarioLines } from './editor';
import type { Tools } from './tools';
import { FACE_NAMES } from './geom';

const DEGf = 180 / Math.PI;
const WEAPONS = ['', 'guard9mm', 'aks74u', 'ak74m', 'akms', 'fn2000', 'fiveseven', 'm870'];   // (game/weapons.ts WeaponId, every row)

export interface SheetHost { ed: Editor; tools: Tools; frame: () => void; rebuild: () => void }

/** a one-line text input row (commit on Enter / blur, Esc reverts) with the panel's refresh */
export function textRow(p: Panel, sec: HTMLElement, label: string, get: () => string, set: (v: string) => void, o: { title?: string; width?: string; placeholder?: string } = {}) {
  const r = document.createElement('div'); r.className = 'row txtrow'; const l = document.createElement('label'); l.textContent = label; if (o.title) { l.title = o.title; r.title = o.title; } r.appendChild(l);
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'txt'; inp.spellcheck = false; if (o.width) inp.style.width = o.width; if (o.placeholder) inp.placeholder = o.placeholder;
  const commit = () => { const v = inp.value; if (v !== get()) { try { set(v); } catch (e) { inp.value = get(); inp.title = String((e as Error).message); inp.classList.add('bad'); setTimeout(() => inp.classList.remove('bad'), 1200); } } };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { commit(); inp.blur(); } else if (e.key === 'Escape') { inp.value = get(); inp.blur(); } });
  inp.addEventListener('blur', () => { commit(); inp.value = get(); });
  r.appendChild(inp); sec.appendChild(r);
  const rf = () => { if (document.activeElement !== inp) inp.value = get(); }; rf(); p.keep(rf, inp); return inp;
}
/** a select over string values (Panel.select is index-based) */
function pickRow(p: Panel, sec: HTMLElement, label: string, options: string[], get: () => string, set: (v: string) => void, title?: string) {
  return p.select(sec, label, options.map(o => o || '—'), () => Math.max(0, options.indexOf(get())), i => set(options[i]), title);
}
function vecRow(p: Panel, sec: HTMLElement, label: string, get: () => readonly number[], set: (v: Vec3) => void, o: { step?: number; names?: string[]; title?: string; min?: number; scale?: number; digits?: number } = {}) {
  const k = o.scale ?? 1;
  return p.numbers(sec, label, 3, i => (get()[i] ?? 0) * k, (i, v) => { const cur = [...get()] as Vec3; cur[i] = v / k; set(cur); }, { step: o.step ?? 0.05, names: o.names ?? ['x', 'y', 'z'], title: o.title, min: o.min, digits: o.digits ?? 3 });
}

export function buildSheet(p: Panel, H: SheetHost) {
  const { ed } = H; p.clear();
  const sel = ed.selection(); const pr = ed.primary();
  if (!sel.length) levelSheet(p, H);
  else if (pr) single(p, H, pr);
  else multiSheet(p, H, sel);
  p.refresh();
}

function levelSheet(p: Panel, H: SheetHost) {
  const { ed } = H; const d = () => ed.data;
  const s = p.section('Level', true);
  textRow(p, s, 'name', () => d().name, v => ed.setName(v), { title: 'the level\'s name (data.name): the file name of a DOWNLOAD, and of a save to the server only for a document that was not loaded from a server file — ⌘/Ctrl S writes the file the document was loaded from (shown below), whatever the name says' });
  p.text(s, () => { const g = d().meta.generator; return `file: ${ed.file ? `levels/${ed.file}.json (⌘/Ctrl S saves here)` : `not from the server — a save goes to levels/${d().name}.json`}${g ? `\nGENERATED — ${g}\na re-export overwrites edits saved to this file, and tools/levels/export.ts ${ed.file ?? d().name} --check fails until then: lasting changes go in the generator` : ''}`; });
  textRow(p, s, 'notes', () => d().meta.notes ?? '', v => ed.setMeta({ notes: v || undefined }));
  p.number(s, 'grid (snap) m', () => d().meta.grid ?? ed.settings.snapStep, v => { ed.setMeta({ grid: v > 0 ? v : undefined }); if (v > 0) ed.set('snapStep', v); }, { step: 0.05, min: 0.01, max: 4, title: 'meta.grid: the level\'s remembered snap step (X toggles snapping)' });
  p.text(s, () => `${ed.counts()}\ndigest ${ed.doc.digest()}${ed.doc.dirty ? ' (unsaved changes)' : ''}`);
  if (d().scenarios) {   // READ-ONLY: what the missions are played from (scene/scenarios.ts). No tool edits it — rename follows its doors and routes, delete refuses one it names, a move leaves its marks
    const sc = p.section('Scenarios (read-only)', true);
    p.text(sc, () => scenarioLines(d().scenarios).join('\n') + '\n(the missions\' own data: edited in the level\'s generator or its file, not here. Renaming a door or a route follows it in here; deleting one it names is refused; moving boxes does NOT move its marks. ▶ play starts one of these)');
  }
  const sky = p.section('Sky', false);
  vecRow(p, sky, 'zenith', () => d().sky.zenith, v => ed.setSky('zenith', v, { coalesce: 'skyz' }), { step: 0.005, names: ['r', 'g', 'b'], min: 0 });
  vecRow(p, sky, 'horizon', () => d().sky.horizon, v => ed.setSky('horizon', v, { coalesce: 'skyh' }), { step: 0.005, names: ['r', 'g', 'b'], min: 0 });
  p.text(sky, () => d().daylight ? `daylight variant: sun ${d().daylight!.sun.intensity} · haze ${d().daylight!.haze} · exposure ${d().daylight!.exposure} · groups on [${d().daylight!.groupsOn.join(' ')}] off [${d().daylight!.groupsOff.join(' ')}] (N toggles it in the view)` : 'no daylight variant');
  const fl = p.section('Floors', true);
  p.text(fl, () => d().floors.map(f => `${f.id === ed.floorId ? '▸ ' : '  '}${f.id} "${f.name ?? ''}" y ${f.y} ceiling ${f.ceiling}`).join('\n') + '\n(only floor geometry on the CURRENT floor is marquee-selected; new things go on it — G2 adds stairs)');
  pickRow(p, fl, 'current floor', d().floors.map(f => f.id), () => ed.floorId, v => { ed.setFloor(v); H.rebuild(); });
  p.buttons(fl, '', [{ text: 'add floor above', run: () => { const id = ed.addFloor(); ed.msg(`floor ${id} added (select it in the outliner to edit y / ceiling)`); H.rebuild(); } }]);
  const m = p.section('Materials', false);
  p.text(m, () => Object.entries(d().materials).map(([k, v]) => `${k.padEnd(11)} ${v.albedo.map(x => x.toFixed(2)).join(' ')}`).join('\n'));
  let newName = 'paint'; let newAlb: Vec3 = [0.5, 0.5, 0.5];
  textRow(p, m, 'new: name', () => newName, v => { newName = v; }); vecRow(p, m, 'new: albedo', () => newAlb, v => { newAlb = v; }, { step: 0.01, names: ['r', 'g', 'b'], min: 0 });
  p.buttons(m, '', [{ text: 'add / update material', run: () => { try { ed.setMaterial(newName, newAlb); ed.msg(`material '${newName}' set`); } catch (e) { ed.msg(String((e as Error).message)); } } }]);
}

function multiSheet(p: Panel, H: SheetHost, sel: string[]) {
  const { ed } = H; const refs = sel.map(parseRef);
  const kinds = new Map<string, number>(); for (const r of refs) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  const s = p.section(`Selection (${sel.length})`, true);
  p.text(s, () => [...kinds].map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(' · '));
  const boxes = refs.filter(r => r.kind === 'box').map(r => r.id);
  if (boxes.length) {
    let group = commonOf(boxes.map(id => ed.doc.get<BoxData>('boxes', id)?.group ?? ''));
    textRow(p, s, 'group (all)', () => group, v => { group = v; ed.doc.transact(`group ${boxes.length} boxes`, () => { for (const id of boxes) ed.updateBox(id, { group: v || undefined }); }); }, { title: 'set the editor group of every selected box' });
    const mats = ['', ...Object.keys(ed.data.materials)];
    pickRow(p, s, 'material (all)', mats, () => commonOf(boxes.map(id => ed.doc.get<BoxData>('boxes', id)?.material ?? '')), v => { if (v) ed.setBoxMaterial(boxes, v); });
    for (const f of AUTHORED_FLAGS) { const all = () => boxes.every(id => ed.doc.get<BoxData>('boxes', id)?.flags?.includes(f)); p.toggleBox(s, `${f} (all)`, all, on => ed.setBoxFlags(boxes, f, on), FLAG_TITLE[f]); }
    p.buttons(s, '', [{ text: 'make switchable of these', title: 'one switchable fixture owning every selected box (they get an emissive value if they had none)', run: () => { try { const id = ed.makeSwitchable(boxes); ed.msg(`switchable ${id} made`); ed.select(`sw:${id}`); } catch (e) { ed.msg(String((e as Error).message)); } } }]);
  }
  p.buttons(s, '', [{ text: 'duplicate (⌘/Ctrl D)', run: () => ed.duplicate(sel) }, { text: 'delete (Del)', run: () => { try { ed.delete(sel); } catch (e) { ed.msg(String((e as Error).message)); } } }, { text: 'frame (F)', run: () => H.frame() }]);
}
const commonOf = (vals: string[]) => vals.every(v => v === vals[0]) ? vals[0] ?? '' : '';
const FLAG_TITLE: Record<string, string> = { NoPrimary: 'not rasterised (the camera looks through it) — ceilings, light-only geometry', NoShadow: 'invisible to every ray (decals, glow cards): no shadow, no collision, no nav', Cutaway: 'viewer stage only', Gloss: 'polished floor finish: mirrors bright things under the glossy-floors experiment' };

function single(p: Panel, H: SheetHost, r: Ref) {
  const { ed } = H;
  const idRow = (sec: HTMLElement, ref: string) => textRow(p, sec, 'id', () => parseRef(ref).id, v => { ed.rename(ref, v.trim()); H.rebuild(); }, { title: 'rename — every reference to it is rewritten' });
  switch (r.kind) {
    case 'box': {
      const g = () => ed.doc.get<BoxData>('boxes', r.id)!; if (!g()) return;
      const s = p.section(`Box ${r.id}`, true); idRow(s, `box:${r.id}`);
      textRow(p, s, 'group', () => g().group ?? '', v => ed.updateBox(r.id, { group: v || undefined }), { title: 'editor grouping (double-click a box selects its group)' });
      textRow(p, s, 'name (tag)', () => g().name ?? '', v => ed.updateBox(r.id, { name: v || undefined }), { title: 'Box.name: a tag the game looks up (breaker_panel) — unique' });
      pickRow(p, s, 'floor', ed.data.floors.map(f => f.id), () => g().floor ?? ed.data.floors[0].id, v => ed.updateBox(r.id, { floor: v }));
      vecRow(p, s, 'centre', () => g().c, v => ed.updateBox(r.id, { c: v }, { coalesce: `c:${r.id}` }), { step: 0.05 });
      vecRow(p, s, 'size', () => g().h.map(x => x * 2), v => ed.setBoxSize(r.id, v, { coalesce: `h:${r.id}` }), { step: 0.05, min: 0.002, title: 'full extents (the file stores half extents h)' });
      p.number(s, 'yaw °', () => (g().yaw ?? 0) * DEGf, v => ed.updateBox(r.id, { yaw: v ? +(v / DEGf).toFixed(6) : undefined }, { coalesce: `yaw:${r.id}` }), { step: 1, title: 'rotation about +Y (R + drag the ring; Ctrl = 15° steps)' });
      p.text(s, () => { const b = g(); return `bottom y ${(b.c[1] - b.h[1]).toFixed(3)} · top y ${(b.c[1] + b.h[1]).toFixed(3)}${b.rot ? ' · tilted (rot quaternion — edit in the file)' : ''}`; });
      const m = p.section('Paint', true);
      const mats = ['(inline albedo)', ...Object.keys(ed.data.materials)];
      p.select(m, 'material', mats, () => g().material ? mats.indexOf(g().material!) : 0, i => { if (i === 0) ed.setBoxMaterial([r.id], [...(ed.data.materials[g().material ?? '']?.albedo ?? g().albedo ?? [0.5, 0.5, 0.5])] as Vec3); else ed.setBoxMaterial([r.id], mats[i]); H.rebuild(); });
      if (!g().material) vecRow(p, m, 'albedo', () => g().albedo ?? [0.5, 0.5, 0.5], v => ed.updateBox(r.id, { albedo: v.map(x => Math.max(0, x)) as Vec3 }, { coalesce: `alb:${r.id}` }), { step: 0.01, names: ['r', 'g', 'b'], min: 0 });
      vecRow(p, m, 'emissive', () => g().emissive ?? [0, 0, 0], v => { const e = v.map(x => Math.max(0, x)) as Vec3; ed.updateBox(r.id, { emissive: e.some(x => x > 0) ? e : undefined }, { coalesce: `em:${r.id}` }); }, { step: 0.1, names: ['r', 'g', 'b'], min: 0, title: 'emitted radiance (linear HDR). A SWITCHABLE fixture also carries its lit value in the switchable' });
      for (const f of AUTHORED_FLAGS) p.toggleBox(m, f, () => !!g().flags?.includes(f), on => ed.setBoxFlags([r.id], f, on), FLAG_TITLE[f]);
      const sw = ed.switchableOf(r.id);
      const w = p.section('Switchable', true);
      if (sw) { p.text(w, () => { const x = ed.switchableOf(r.id); return x ? `part of '${x.id}' (group ${x.group}, ${x.on ? 'on' : 'off'}, ${x.boxes.length} box${x.boxes.length === 1 ? '' : 'es'})` : '—'; }); p.buttons(w, '', [{ text: 'edit switchable', run: () => ed.select(`sw:${sw.id}`) }, { text: 'select its boxes', run: () => ed.select(sw.boxes.map(b => `box:${b}`)) }]); }
      else p.buttons(w, '', [{ text: 'make switchable', title: 'an OCP-able / panel-switched fixture: this box glows baseEmissive when on and becomes an area light in the game', run: () => { try { const id = ed.makeSwitchable([r.id]); ed.select(`sw:${id}`); } catch (e) { ed.msg(String((e as Error).message)); } } }]);
      const a = p.section('Actions', true);
      p.buttons(a, '', [{ text: 'duplicate', run: () => ed.duplicate([`box:${r.id}`]) }, { text: 'delete', run: () => { try { ed.delete([`box:${r.id}`]); } catch (e) { ed.msg(String((e as Error).message)); } } }, { text: 'frame', run: () => H.frame() }, { text: 'select group', run: () => { const grp = g().group; if (grp) ed.select(ed.data.boxes.filter(b => b.group === grp).map(b => `box:${b.id}`)); } }]);
      p.buttons(a, 'push face 1 snap', FACE_NAMES.map((n, f) => ({ text: n, run: () => ed.resizeBox(r.id, f as 0, ed.settings.snapStep) })));
      p.buttons(a, 'pull face 1 snap', FACE_NAMES.map((n, f) => ({ text: n, run: () => ed.resizeBox(r.id, f as 0, -ed.settings.snapStep) })));
      break;
    }
    case 'light': {
      const g = () => ed.doc.get<LightData>('lights', r.id)!; if (!g()) return;
      const s = p.section(`Light ${r.id}`, true); idRow(s, `light:${r.id}`);
      pickRow(p, s, 'kind', ['point', 'spot', 'dir'], () => g().kind, v => { ed.updateLight(r.id, { kind: v as LightData['kind'], ...(v === 'spot' && !(g().outerDeg > 0) ? { innerDeg: 25, outerDeg: 60 } : {}) }); H.rebuild(); });
      textRow(p, s, 'group', () => g().group, v => ed.updateLight(r.id, { group: v || 'lights' }), { title: 'light-target group (Lights panel / OCP / daylight groupsOn/Off)' });
      p.toggleBox(s, 'enabled', () => g().enabled, v => ed.updateLight(r.id, { enabled: v }));
      vecRow(p, s, 'pos', () => g().pos, v => ed.updateLight(r.id, { pos: v }, { coalesce: `lp:${r.id}` }), { step: 0.05 });
      p.number(s, 'aim yaw °', () => Math.atan2(g().dir[0], g().dir[2]) * DEGf, v => { const d = g().dir; const pitch = Math.asin(Math.max(-1, Math.min(1, -d[1] / (Math.hypot(d[0], d[1], d[2]) || 1)))); const cp = Math.cos(pitch); ed.updateLight(r.id, { dir: [+(Math.sin(v / DEGf) * cp).toFixed(6), +(-Math.sin(pitch)).toFixed(6), +(Math.cos(v / DEGf) * cp).toFixed(6)] }, { coalesce: `ld:${r.id}` }); }, { step: 1, title: 'heading of the axis (drag the aim dot in the view to point it at a floor spot)' });
      p.number(s, 'aim down °', () => { const d = g().dir; return Math.asin(Math.max(-1, Math.min(1, -d[1] / (Math.hypot(d[0], d[1], d[2]) || 1)))) * DEGf; }, v => { const d = g().dir; const yaw = Math.atan2(d[0], d[2]); const pt = v / DEGf; ed.updateLight(r.id, { dir: [+(Math.sin(yaw) * Math.cos(pt)).toFixed(6), +(-Math.sin(pt)).toFixed(6), +(Math.cos(yaw) * Math.cos(pt)).toFixed(6)] }, { coalesce: `ld:${r.id}` }); }, { step: 1, min: -89.9, max: 90, title: '90 = straight down' });
      vecRow(p, s, 'color', () => g().color, v => ed.updateLight(r.id, { color: v.map(x => Math.max(0, x)) as Vec3 }, { coalesce: `lc:${r.id}` }), { step: 0.01, names: ['r', 'g', 'b'], min: 0 });
      p.number(s, 'intensity', () => g().intensity, v => ed.updateLight(r.id, { intensity: Math.max(0, v) }, { coalesce: `li:${r.id}` }), { step: 1, min: 0, title: 'point/spot: candela-ish (desk lamp 9, panel-ish 30, street lamp 260); dir: irradiance' });
      p.number(s, 'range m', () => g().range, v => ed.updateLight(r.id, { range: Math.max(0, v) }, { coalesce: `lr:${r.id}` }), { step: 0.5, min: 0 });
      p.slider(s, 'inner °', 0, 90, 1, () => g().innerDeg, v => ed.updateLight(r.id, { innerDeg: Math.min(v, g().outerDeg) }, { coalesce: `lin:${r.id}` }));
      p.slider(s, 'outer °', 0, 180, 1, () => g().outerDeg, v => ed.updateLight(r.id, { outerDeg: v, innerDeg: Math.min(g().innerDeg, v) }, { coalesce: `lout:${r.id}` }));
      p.slider(s, 'volumetric', 0, 1.5, 0.01, () => g().volumetric, v => ed.updateLight(r.id, { volumetric: v }, { coalesce: `lv:${r.id}` }), 'haze scattering multiplier for its beam');
      p.number(s, 'radius m', () => g().radius ?? (g().kind === 'dir' ? 0 : 0.05), v => ed.updateLight(r.id, { radius: Math.max(0, v) }, { coalesce: `lrad:${r.id}` }), { step: 0.01, min: 0, title: 'emitter size → penumbra width (dir: angular radius, rad)' });
      p.toggleBox(s, 'mains', () => g().mains !== false, v => ed.updateLight(r.id, { mains: v ? undefined : false }), 'fed from the breaker (off for street lighting / moon / sun)');
      p.toggleBox(s, 'broad', () => !!g().broad, v => ed.updateLight(r.id, { broad: v || undefined }), 'wide soft emitter → the direct pass\'s broad denoise class');
      textRow(p, s, 'fixture box', () => g().fixture ?? '', v => ed.updateLight(r.id, { fixture: v || undefined }), { title: 'BoxData.id of the emissive glow card that goes dark with the light' });
      p.buttons(s, '', [{ text: 'fixture = other selected box', title: 'shift-click a box into the selection first', run: () => { const b = ed.selected('box')[0]; if (b) ed.updateLight(r.id, { fixture: b.id }); else ed.msg('shift-click the fixture box into the selection first'); } }, { text: 'duplicate', run: () => ed.duplicate([`light:${r.id}`]) }, { text: 'delete', run: () => ed.delete([`light:${r.id}`]) }]);
      break;
    }
    case 'sw': {
      const g = () => ed.doc.get<SwitchableData>('switchables', r.id)!; if (!g()) return;
      const s = p.section(`Switchable ${r.id}`, true); idRow(s, `sw:${r.id}`);
      textRow(p, s, 'group', () => g().group, v => ed.updateSwitchable(r.id, { group: v || 'lights' }), { title: 'light-target group: the Lights panel switches groups; daylight groupsOn / groupsOff' });
      p.toggleBox(s, 'on', () => g().on, v => ed.updateSwitchable(r.id, { on: v }));
      vecRow(p, s, 'baseEmissive', () => g().baseEmissive, v => ed.updateSwitchable(r.id, { baseEmissive: v.map(x => Math.max(0, x)) as Vec3 }, { coalesce: `swe:${r.id}` }), { step: 0.1, names: ['r', 'g', 'b'], min: 0, title: 'what its boxes glow when on (ceiling panels 11 10.5 9.5; monitors 0.9 1.3 2.2; exit sign 0.3 3.2 0.6)' });
      p.toggleBox(s, 'flicker', () => !!g().flicker, v => ed.updateSwitchable(r.id, { flicker: v || undefined }), 'fluorescent flicker');
      p.toggleBox(s, 'mains', () => g().mains !== false, v => ed.updateSwitchable(r.id, { mains: v ? undefined : false }), 'off = battery / UPS backed (survives the breaker)');
      p.text(s, () => `boxes: ${g().boxes.join(' ')}`);
      p.buttons(s, '', [{ text: 'select boxes', run: () => ed.select(g().boxes.map(b => `box:${b}`)) }, { text: 'add selected boxes', run: () => { const add = ed.selected('box').map(b => b.id).filter(b => !g().boxes.includes(b) && !ed.switchableOf(b)); if (add.length) ed.updateSwitchable(r.id, { boxes: [...g().boxes, ...add] }); else ed.msg('shift-click free boxes into the selection first'); } }, { text: 'delete switchable', run: () => ed.delete([`sw:${r.id}`]) }]);
      break;
    }
    case 'door': {
      const g = () => ed.doc.get<DoorData>('doors', r.id)!; if (!g()) return;
      const s = p.section(`Door ${r.id}`, true); idRow(s, `door:${r.id}`);
      p.numbers(s, 'hinge x z', 2, i => g().hinge[i], (i, v) => { const h: [number, number] = [g().hinge[0], g().hinge[1]]; h[i] = v; ed.updateDoor(r.id, { hinge: h }, { coalesce: `dh:${r.id}` }); }, { step: 0.05, names: ['x', 'z'] });
      p.number(s, 'closed dir °', () => g().closedDir * DEGf, v => ed.updateDoor(r.id, { closedDir: +(v / DEGf).toFixed(6) }, { coalesce: `dd:${r.id}` }), { step: 90, title: 'world angle of the shut leaf from the hinge (0 → +x, 90 → +z); drag the leaf-end square in the view' });
      p.number(s, 'width m', () => g().width, v => ed.updateDoor(r.id, { width: Math.max(0.4, v) }, { coalesce: `dw:${r.id}` }), { step: 0.02, min: 0.4, max: 3 });
      p.number(s, 'authored angle °', () => (g().angle ?? 0) * DEGf, v => ed.updateDoor(r.id, { angle: v ? +(v / DEGf).toFixed(4) : undefined }), { step: 5, min: -175, max: 175, title: 'how far open it starts (0 = shut and latched)' });
      p.numbers(s, 'limits °', 2, i => ((i ? g().maxAngle : g().minAngle) ?? (i ? 1.92 : -1.92)) * DEGf, (i, v) => ed.updateDoor(r.id, i ? { maxAngle: +(v / DEGf).toFixed(4) } : { minAngle: +(v / DEGf).toFixed(4) }), { step: 5, names: ['min', 'max'] });
      p.toggleBox(s, 'exterior', () => !!g().exterior, v => ed.updateDoor(r.id, { exterior: v || undefined }), 'opens onto the lot: 24 cm frame, guards leave it alone in a lockdown');
      p.toggleBox(s, 'closer', () => g().closer !== false, v => ed.updateDoor(r.id, { closer: v ? undefined : false }), 'hydraulic closer (off = stays where it was left)');
      p.toggleBox(s, 'locked', () => !!g().locked, v => ed.updateDoor(r.id, { locked: v || undefined }), 'keyed on the keySide face; guards carry keys, the player picks / kicks / takes a key');
      textRow(p, s, 'lock id', () => g().lock ?? '', v => ed.updateDoor(r.id, { lock: v || undefined }), { title: 'which key turns it (absent = the floor key)' });
      pickRow(p, s, 'key side', ['+1', '-1'], () => (g().keySide ?? 1) === 1 ? '+1' : '-1', v => ed.updateDoor(r.id, { keySide: v === '+1' ? undefined : -1 }), '+1 = the CCW side of the closed leaf carries the cylinder');
      pickRow(p, s, 'opens into', ['dealt', '+1', '-1'], () => g().swing === 1 ? '+1' : g().swing === -1 ? '-1' : 'dealt', v => ed.updateDoor(r.id, { swing: v === '+1' ? 1 : v === '-1' ? -1 : undefined }), 'a door opens ONE way. dealt = the game picks the side when the level starts (into a room rather than a corridor, away from a lock\'s cylinder, toward the smaller floor …); +1 / -1 = authored: the CCW / CW side of the closed leaf. Its stop on that side must leave it an opening (limits)');
      p.text(s, () => { const w = ed.doorSwing(r.id); return w ? `opens ${w.swing > 0 ? '+1 (CCW)' : '-1 (CW)'} · ${w.why}${w.into ? ` · ${w.into}` : ''}` : 'opens: not dealt (the document does not load — see lint)'; });
      p.text(s, () => `frame boxes: ${ed.data.boxes.filter(b => b.group === `doorframe.${r.id}`).length} (group doorframe.${r.id})`);
      p.buttons(s, '', [{ text: 'cut opening', title: 'split the wall slabs the doorway crosses into runs + lintel', run: () => { const c = ed.cutOpening(r.id); ed.msg(`cut: ${c.removed.length} slab(s) → ${c.added.length} pieces`); } }, { text: 'make frame', title: 'jambs + head + stops as the generator built them (replaces an existing frame)', run: () => { const n = ed.makeFrame(r.id).length; ed.msg(`${n} frame boxes`); } }, { text: 'select frame', run: () => ed.select(ed.data.boxes.filter(b => b.group === `doorframe.${r.id}`).map(b => `box:${b.id}`)) }, { text: 'delete', run: () => { try { ed.delete([`door:${r.id}`]); } catch (e) { ed.msg(String((e as Error).message)); } } }]);
      break;
    }
    case 'route': {
      const g = () => ed.doc.get<RouteData>('routes', r.id)!; if (!g()) return;
      const s = p.section(`Route ${r.id}${r.sub !== undefined ? ` · point ${r.sub}` : ''}`, true); idRow(s, `route:${r.id}`);
      textRow(p, s, 'name', () => g().name ?? '', v => ed.updateRoute(r.id, { name: v || undefined }), { title: 'what the radio calls him (absent = the id)' });
      pickRow(p, s, 'weapon', WEAPONS, () => g().weapon ?? '', v => ed.updateRoute(r.id, { weapon: (v || undefined) as RouteData['weapon'] }), 'what he carries (absent = the 9 mm service pistol)');
      textRow(p, s, 'keys', () => (g().keys ?? []).join(' '), v => ed.updateRoute(r.id, { keys: v.trim() ? v.trim().split(/[\s,]+/) : undefined }), { title: 'lock ids on his belt, space separated (absent = the floor key)' });
      p.text(s, () => g().points.map((q, i) => `${i === r.sub ? '▸' : ' '}${String(i).padStart(2)}  (${q[0].toFixed(2)}, ${q[2].toFixed(2)})  wait ${g().wait[i]} s`).join('\n'));
      if (r.sub !== undefined) {
        const i = r.sub;
        p.numbers(s, `point ${i} x z`, 2, k => g().points[i]?.[k ? 2 : 0] ?? 0, (k, v) => { const q = [...(g().points[i] ?? [0, 0, 0])] as Vec3; q[k ? 2 : 0] = v; ed.movePoint(r.id, i, q, { coalesce: `wp:${r.id}#${i}` }); }, { step: 0.05, names: ['x', 'z'] });
        p.number(s, `wait ${i} s`, () => g().wait[i] ?? 0, v => ed.updateRoute(r.id, t => ({ ...t, wait: t.wait.map((w, k) => k === i ? Math.max(0, v) : w) }), { coalesce: `ww:${r.id}#${i}` }), { step: 0.5, min: 0 });
        p.buttons(s, '', [{ text: 'insert point after', run: () => { const q = g().points[i]; ed.insertPoint(r.id, i + 1, [q[0] + 1, 0, q[2]]); ed.select(`route:${r.id}#${i + 1}`); } }, { text: 'delete point', run: () => ed.removePoint(r.id, i) }, { text: 'whole route', run: () => ed.select(`route:${r.id}`) }]);
      } else p.buttons(s, '', [{ text: 'reverse order', run: () => ed.updateRoute(r.id, t => ({ ...t, points: [...t.points].reverse(), wait: [...t.wait].reverse() })) }, { text: 'duplicate', run: () => ed.duplicate([`route:${r.id}`]) }, { text: 'delete route', run: () => ed.delete([`route:${r.id}`]) }]);
      break;
    }
    case 'volume': {
      const g = () => ed.doc.get<VolumeData>('volumes', r.id)!; if (!g()) return;
      const s = p.section(`Volume ${r.id}`, true); idRow(s, `volume:${r.id}`);
      pickRow(p, s, 'kind', ['hide', 'utility', 'trigger'], () => g().kind, v => ed.updateVolume(r.id, { kind: v as VolumeData['kind'] }), 'hide = cover the AI treats as dark; utility = closet; trigger = scripted');
      vecRow(p, s, 'centre', () => g().c, v => ed.updateVolume(r.id, { c: v }, { coalesce: `vc:${r.id}` }));
      vecRow(p, s, 'size', () => g().h.map(x => x * 2), v => ed.updateVolume(r.id, { h: v.map(x => Math.max(0.01, x / 2)) as Vec3 }, { coalesce: `vh:${r.id}` }), { min: 0.02 });
      p.number(s, 'yaw °', () => (g().yaw ?? 0) * DEGf, v => ed.updateVolume(r.id, { yaw: v ? +(v / DEGf).toFixed(6) : undefined }, { coalesce: `vy:${r.id}` }), { step: 5 });
      textRow(p, s, 'notes', () => g().notes ?? '', v => ed.updateVolume(r.id, { notes: v || undefined }));
      p.buttons(s, '', [{ text: 'duplicate', run: () => ed.duplicate([`volume:${r.id}`]) }, { text: 'delete', run: () => ed.delete([`volume:${r.id}`]) }]);
      break;
    }
    case 'prop': {
      const g = () => ed.doc.get<PropData>('props', r.id)!; if (!g()) return;
      const s = p.section(`Prop ${r.id} (${g().kind})`, true); idRow(s, `prop:${r.id}`);
      p.numbers(s, 'x z', 2, i => i ? g().z : g().x, (i, v) => ed.updateProp(r.id, i ? { z: v } : { x: v }, { coalesce: `px:${r.id}` }), { step: 0.05, names: ['x', 'z'] });
      p.number(s, 'yaw °', () => (g().yaw ?? 0) * DEGf, v => ed.updateProp(r.id, { yaw: v ? +(v / DEGf).toFixed(6) : undefined }, { coalesce: `py:${r.id}` }), { step: 5 });
      p.number(s, 'mass kg', () => g().mass, v => ed.updateProp(r.id, { mass: Math.max(0.1, v) }), { step: 0.5, min: 0.1 });
      p.text(s, () => `${g().parts.length} part(s) · loose furniture the physics owns (parts are edited in the file)`);
      p.buttons(s, '', [{ text: 'duplicate', run: () => ed.duplicate([`prop:${r.id}`]) }, { text: 'delete', run: () => ed.delete([`prop:${r.id}`]) }]);
      break;
    }
    case 'chokepoint': {
      const g = () => ed.doc.get<any>('chokepoints', r.id)!; if (!g()) return;
      const s = p.section(`Post ${r.id}`, true); idRow(s, `chokepoint:${r.id}`);
      textRow(p, s, 'name', () => g().name ?? '', v => ed.doc.update<any>('chokepoints', r.id, { name: v || undefined }));
      p.numbers(s, 'pos x z', 2, i => g().pos[i ? 2 : 0], (i, v) => { const q = [...g().pos] as Vec3; q[i ? 2 : 0] = v; ed.doc.update<any>('chokepoints', r.id, { pos: q }, { coalesce: `cp:${r.id}` }); }, { step: 0.05, names: ['x', 'z'] });
      p.number(s, 'facing °', () => g().yaw * DEGf, v => ed.doc.update<any>('chokepoints', r.id, { yaw: +(v / DEGf).toFixed(6) }, { coalesce: `cy:${r.id}` }), { step: 5, title: 'Character convention: forward = [sin, 0, cos]' });
      p.buttons(s, '', [{ text: 'delete', run: () => ed.delete([`chokepoint:${r.id}`]) }]);
      break;
    }
    case 'mark': {
      const M = () => ed.data.mission; const s = p.section(r.id === 'spawn' ? 'Player spawn' : `Objective ${r.id}`, true);
      if (r.id === 'spawn') p.numbers(s, 'spawn x z', 2, i => M().playerSpawn[i ? 2 : 0], (i, v) => { const q = [...M().playerSpawn] as Vec3; q[i ? 2 : 0] = v; ed.setSpawn(q, { coalesce: 'spawn' }); }, { step: 0.05, names: ['x', 'z'] });
      else {
        const o = () => M().objectives.find(x => x.id === r.id)!; if (!o()) return;
        const doors = ed.data.doors.map(d => d.id);
        if (o().kind === 'reach') { p.numbers(s, 'area x0 x1', 2, i => (o() as any).area[i ? 'x1' : 'x0'], (i, v) => ed.updateObjective(r.id, { area: { ...(o() as any).area, [i ? 'x1' : 'x0']: v } } as any, { coalesce: 'oa' }), { step: 0.1 }); p.numbers(s, 'area z0 z1', 2, i => (o() as any).area[i ? 'z1' : 'z0'], (i, v) => ed.updateObjective(r.id, { area: { ...(o() as any).area, [i ? 'z1' : 'z0']: v } } as any, { coalesce: 'oa' }), { step: 0.1 }); pickRow(p, s, 'door', doors, () => (o() as any).door, v => ed.updateObjective(r.id, { door: v } as any), 'the door the HUD points at for this room'); }
        else if (o().kind === 'drive') { p.number(s, 'rack index', () => (o() as any).rackIndex, v => ed.updateObjective(r.id, { rackIndex: Math.max(0, Math.round(v)) } as any), { step: 1, min: 0, title: 'rack n → switchables rack<n>_leds / rack<n>_glow go dark' }); vecRow(p, s, 'front', () => (o() as any).front, v => ed.updateObjective(r.id, { front: v } as any, { coalesce: 'of' })); p.number(s, 'halfW', () => (o() as any).halfW, v => ed.updateObjective(r.id, { halfW: Math.max(0, v) } as any), { step: 0.01, min: 0 }); }
        else { p.numbers(s, 'exfil x z', 2, i => i ? (o() as any).z : (o() as any).x, (i, v) => ed.updateObjective(r.id, (i ? { z: v } : { x: v }) as any, { coalesce: 'ox' }), { step: 0.1, names: ['x', 'z'], title: 'past this x you are out' }); pickRow(p, s, 'door', doors, () => (o() as any).door, v => ed.updateObjective(r.id, { door: v } as any)); }
      }
      p.text(s, () => 'v1 wants exactly one spawn / reach / drive / exfil: they move, they are not deleted');
      break;
    }
    case 'floor': {
      const g = () => ed.data.floors.find(f => f.id === r.id)!; if (!g()) return;
      const s = p.section(`Floor ${r.id}`, true); idRow(s, `floor:${r.id}`);
      textRow(p, s, 'name', () => g().name ?? '', v => ed.updateFloor(r.id, { name: v || undefined } as Partial<FloorData>));
      p.number(s, 'y', () => g().y, v => ed.updateFloor(r.id, { y: v }), { step: 0.1, title: 'world Y of the walkable surface' });
      p.number(s, 'ceiling', () => g().ceiling, v => ed.updateFloor(r.id, { ceiling: Math.max(0.5, v) }), { step: 0.1, min: 0.5 });
      p.buttons(s, '', [{ text: 'make current', run: () => { ed.setFloor(r.id); H.rebuild(); } }, { text: 'delete floor', run: () => { try { ed.delete([`floor:${r.id}`]); } catch (e) { ed.msg(String((e as Error).message)); } } }]);
      break;
    }
    case 'device': {
      const g = () => ed.doc.get<DeviceData>('devices', r.id)!; if (!g()) return;
      const kind = g().kind; const s = p.section(`${kind === 'camera' ? 'Camera' : kind === 'keypad' ? 'Keypad' : 'Laser'} ${r.id}`, true); idRow(s, `device:${r.id}`);
      const upd = (patch: any, o: { coalesce?: string } = {}) => ed.updateDevice(r.id, patch, o);
      if (kind === 'camera') {
        const c = () => g() as CameraData;
        vecRow(p, s, 'pos (lens)', () => c().pos, v => upd({ pos: v }, { coalesce: `dp:${r.id}` }), { step: 0.05, title: 'the lens: hang it under the ceiling on a wall it can see the room from (a camera inside a wall sees nothing — lint says so)' });
        p.number(s, 'yaw °', () => c().yaw * DEGf, v => { const yaw = +(v / DEGf).toFixed(6); const cur = c(); upd(cur.sweep ? { yaw, sweep: [+(cur.sweep[0] + yaw - cur.yaw).toFixed(6), +(cur.sweep[1] + yaw - cur.yaw).toFixed(6)] } : { yaw }, { coalesce: `dy:${r.id}` }); }, { step: 5, title: 'rest heading (Character convention: 0 = +z south, 90 = +x east); R + the ring, or drag the aim dot; a sweep goes round with it' });
        p.number(s, 'pitch ° (− = down)', () => (c().pitch ?? DEVICE_DEFAULTS.pitch) * DEGf, v => upd({ pitch: +(Math.max(-83, Math.min(83, v)) / DEGf).toFixed(6) }, { coalesce: `dpi:${r.id}` }), { step: 1, min: -83, max: 83, title: 'tilt of the lens; straight under a wall camera is under its picture (the elevation window is the cone\'s own)' });
        p.slider(s, 'cone ° (full)', 10, 170, 1, () => c().fovDeg ?? DEVICE_DEFAULTS.fovDeg, v => upd({ fovDeg: v }, { coalesce: `df:${r.id}` }), 'the picture\'s width AND height (a square lens); the haze cone in the game follows it');
        p.number(s, 'range m', () => c().range ?? DEVICE_DEFAULTS.range, v => upd({ range: Math.max(1, v) }, { coalesce: `dr:${r.id}` }), { step: 0.5, min: 1, title: 'reach: past it he is not in the picture; the fill rate falls to a fifth by its edge (as a man\'s eye does by 16 m)' });
        p.toggleBox(s, 'pans (sweep)', () => !!c().sweep, on => { const cur = c(); if (on && !cur.sweep) upd({ sweep: [+(cur.yaw - 0.44).toFixed(6), +(cur.yaw + 0.44).toFixed(6)], sweepPeriod: cur.sweepPeriod ?? 9 }); else if (!on) upd((v: any) => { const y = { ...v }; delete y.sweep; delete y.sweepPeriod; return y; }); H.rebuild(); }, 'sweeps there and back between two headings (± 25° about the rest yaw to start with)');
        if (c().sweep) { p.numbers(s, 'sweep ° from / to', 2, i => (c().sweep?.[i] ?? 0) * DEGf, (i, v) => { const sw: [number, number] = [c().sweep![0], c().sweep![1]]; sw[i] = +(v / DEGf).toFixed(6); upd({ sweep: sw }, { coalesce: `dsw:${r.id}` }); }, { step: 5, names: ['from', 'to'] }); p.number(s, 'sweep period s', () => c().sweepPeriod ?? 9, v => upd({ sweepPeriod: Math.max(1, v) }, { coalesce: `dsp:${r.id}` }), { step: 0.5, min: 1, title: 'seconds for one there-and-back' }); }
        textRow(p, s, 'group', () => c().group ?? DEVICE_DEFAULTS.group, v => upd({ group: v && v !== DEVICE_DEFAULTS.group ? v : undefined }), { title: 'light-target group (the Lights panel switches it; \'security\' by default)' });
        p.toggleBox(s, 'mains (dies in a blackout)', () => c().mains !== false, v => upd({ mains: v ? undefined : false }), 'off = UPS-fed: the breaker does not take it down');
        p.text(s, () => 'sees the player through the guards\' own eye test + HIS light meter: control radios at 0.8 lit-seconds (a man is sent), the floor goes up at 2. OCP blinds it, a round kills it.');
      } else if (kind === 'keypad') {
        const k = () => g() as KeypadData; const doors = ed.data.doors.map(d => d.id);
        pickRow(p, s, 'door', doors, () => k().door, v => { try { upd({ door: v }); H.rebuild(); } catch (e) { ed.msg(String((e as Error).message)); } }, 'the door it opens — that door is locked on THIS pad\'s lock (re-linking moves the lock: the old door keeps its bolt but goes back on the floor key, as when the pad is deleted)');
        textRow(p, s, 'code (4 digits)', () => k().code, v => { if (!DEVICE_DEFAULTS.codeRe.test(v.trim())) throw new Error('four digits'); upd({ code: v.trim() }); }, { title: 'what the player keys in once a man has given it up or two of them have said it in his hearing', width: '6em' });
        vecRow(p, s, 'pos (plate)', () => k().pos, v => upd({ pos: v }, { coalesce: `dp:${r.id}` }), { step: 0.02, title: 'on the key-side face of the wall beside the latch jamb, chest height' });
        p.number(s, 'facing °', () => k().yaw * DEGf, v => upd({ yaw: +(v / DEGf).toFixed(6) }, { coalesce: `dy:${r.id}` }), { step: 90, title: 'out of the wall (0 = +z, 90 = +x)' });
        p.buttons(s, '', [{ text: 'snap beside the latch jamb', title: 'the default spot: a quarter metre past the latch end of the leaf on the door\'s key side, 1.4 m up, facing out', run: () => { const d = ed.doc.get<DoorData>('doors', k().door); if (!d) return; const pl = keypadPlacement(d, d.keySide ?? 1, ed.floor().y, ed.data.boxes); upd({ pos: pl.pos, yaw: pl.yaw }); } }, { text: 'select its door', run: () => ed.select(`door:${k().door}`) }]);
        p.text(s, () => { const d = ed.doc.get<DoorData>('doors', k().door); return d ? `door '${d.id}': locked ${!!d.locked} · lock '${d.lock ?? '(floor key)'}' · key side ${d.keySide ?? 1}${d.lock !== r.id ? '  ✗ the lock must be this pad\'s id (validate says so)' : ''}` : 'door missing'; });
      } else {
        const l = () => g() as LaserData;
        vecRow(p, s, 'from (emitter)', () => l().from, v => upd({ from: v }, { coalesce: `dlf:${r.id}` }), { step: 0.05, title: 'the emitter: the OCP / a round on THIS end knocks the beam out; drag the emitter square in the view' });
        vecRow(p, s, 'to (receiver)', () => l().to, v => upd({ to: v }, { coalesce: `dlt:${r.id}` }), { step: 0.05 });
        p.number(s, 'height m (both ends)', () => (l().from[1] + l().to[1]) / 2 - ed.floor().y, v => { const y = ed.floor().y + Math.max(0.05, v); upd({ from: [l().from[0], +y.toFixed(4), l().from[2]], to: [l().to[0], +y.toFixed(4), l().to[2]] }, { coalesce: `dlh:${r.id}` }); }, { step: 0.05, min: 0.05, max: 2.6, title: '0.35 = shin: nobody steps over it · ≥ 1.2 = crouch under (the crouch-walk\'s crown rides at ~1.12, a standing chest at 1.27)' });
        pickRow(p, s, 'breaking it raises', ['suspicion', 'alarm'], () => l().alarm ?? DEVICE_DEFAULTS.alarm, v => upd({ alarm: v === 'suspicion' ? undefined : (v as 'alarm') }), 'suspicion = control radios and the nearest calm man comes to look · alarm = the floor goes up a step at once');
        textRow(p, s, 'group', () => l().group ?? DEVICE_DEFAULTS.group, v => upd({ group: v && v !== DEVICE_DEFAULTS.group ? v : undefined }));
        p.toggleBox(s, 'mains (dies in a blackout)', () => l().mains !== false, v => upd({ mains: v ? undefined : false }), 'off = battery-backed: the breaker is no answer to it (make sure there is another — a way round, or room to crouch)');
        p.text(s, () => { const L2 = Math.hypot(l().to[0] - l().from[0], l().to[1] - l().from[1], l().to[2] - l().from[2]); return `${L2.toFixed(2)} m · the player's body, a hauled body or a thrown canister breaks it; staff, leaves and furniture do not`; });
      }
      p.buttons(s, '', [{ text: 'duplicate', run: () => ed.duplicate([`device:${r.id}`]) }, { text: 'delete', run: () => { try { ed.delete([`device:${r.id}`]); } catch (e) { ed.msg(String((e as Error).message)); } } }, { text: 'frame', run: () => H.frame() }]);
      break;
    }
  }
}
