// MATERIALS + MARKINGS as document operations (the Materials / Markings inspector tabs, window.__ed.material / .marking / .box.override, and the
// probes all go through these): plain functions over the Editor, each ONE undoable command, coalesced per gesture where a slider or a brush
// stroke drives them. Pure data — no DOM, no GPU (paintui.ts is the chrome; the Scene re-syncs the engine from the document as for any edit).
//
// The FORMAT (scene/levelData.ts): `materials{}` name → { albedo, rough?, metal?, notes? } in the palette's authored ORDER; a box carries exactly
// one of `material` (a key) / `albedo` (inline) plus optional per-box `rough` / `metal` overriding the paint's; `markings[]` (scene/markings.ts
// MarkingDef: face, res, at, size, ≤ 3 MATERIAL palette entries { albedo | mul, rough?, emit? }, cells as '.abc' rows top first) ≤ 4 per box.
// Every material mutation here rewrites the WHOLE `materials` record (one 'set' op on ['materials']): a rename or a delete then undoes back to
// the same key order — the file's palette order is authored data — where deleting one key and re-inserting it would move it to the end.
import type { Vec3 } from '../math/vec';
import { BoxData, MaterialData, KEYS } from '../scene/levelData';
import { MarkingDef, MarkPal, MarkFace, MarkRes, MARK_FACES, MARK_RES, RES_K, MARKING_TEXEL, MAX_MARKS_PER_BOX, MAX_CELLS_W, MAX_CELLS_H, MAX_PAL, CELL_CHARS, CellCanvas, GEN, GLYPHS, GLYPH_NAMES, marking, markingErrors, faceHalf, faceIndex, markStats, resolveAlbedo } from '../scene/markings';
import * as MD from '../scene/markingDefaults';
import { ROUGH_DEFAULT } from '../scene/boxes';
import type { Editor } from './editor';
import { clonePlain } from './doc';
import { roundVec, round6 } from './geom';

// ================================================================================================================================ materials
/** The FINISH presets (officeGen.ts OFFICE_FINISH, docs/internal/p4-materials.md): one click sets rough / metal on a paint or a box. `unset` = no finish
 *  authored = ROUGH_DEFAULT (1.0, matte dielectric: no reflection ray on any tier). */
export const FINISH_PRESETS: readonly { key: string; label: string; rough?: number; metal?: boolean; title: string }[] = [
  { key: 'stone', label: 'stone', rough: 0.15, title: 'sealed polished stone (the lobby): fixtures mirror with edges — traced on every RT tier' },
  { key: 'lino', label: 'lino', rough: 0.22, title: 'waxed lino (corridor / break room): panels + vending fronts as soft-edged rectangles hardening at the contact' },
  { key: 'metal', label: 'brushed metal', rough: 0.28, metal: true, title: 'brushed steel — shelving, the UPS, cart frames, lamp posts (F0 = the albedo, most of the diffuse gone)' },
  { key: 'screen', label: 'dark screen', rough: 0.08, title: 'monitor / TV / vending glass front: near-mirror over the picture' },
  { key: 'laminate', label: 'laminate', rough: 0.5, title: 'laminate — printer, cooler, counter body, table top (rays on ultra only)' },
  { key: 'wood', label: 'wood', rough: 0.55, title: 'varnished wood 0.55‥0.6 — borderline: rays only on ultra' },
  { key: 'matte', label: 'matte wall', rough: 0.85, title: 'paint / render / tile / carpet: analytic highlights only, no ray on any tier' },
  { key: 'unset', label: 'unset', title: 'no finish authored = ROUGH_DEFAULT 1.0 (matte dielectric)' },
];
/** roughness cut-offs of the ray-traced reflection tiers (ui/quality.ts RtTier.maxRough: ultra 0.55 · high 0.45 · medium 0.35; low / verylow trace nothing) */
export const RT_TIERS: readonly { name: string; maxRough: number }[] = [{ name: 'ultra', maxRough: 0.55 }, { name: 'high', maxRough: 0.45 }, { name: 'medium', maxRough: 0.35 }];
/** what a roughness value MEANS for the picture: which tiers spend reflection rays on it (composite fades the term over the 0.12 under each cut-off) */
export function traceHint(rough: number | undefined): string {
  const r = rough ?? ROUGH_DEFAULT; const tiers = RT_TIERS.filter(t => r <= t.maxRough).map(t => r > t.maxRough - 0.12 ? `${t.name} (fading)` : t.name);
  return tiers.length ? `traced reflections on ${tiers.join(' · ')}` : 'analytic highlights only — no reflection ray on any tier';
}
export const MATERIAL_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
// ---- colour: the file holds LINEAR albedo; pickers and swatches speak sRGB (the IEC 61966-2-1 transfer pair, not a bare 2.2 power)
export const linToSrgb = (x: number) => { const c = x < 0 ? 0 : x > 1 ? 1 : x; return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
export const srgbToLin = (s: number) => { const c = s < 0 ? 0 : s > 1 ? 1 : s; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
/** '#rrggbb' of a linear rgb (clamped to the displayable cube) */
export function linearToHex(v: readonly number[]): string { return '#' + [0, 1, 2].map(i => Math.round(linToSrgb(v[i] ?? 0) * 255).toString(16).padStart(2, '0')).join(''); }
/** linear rgb of '#rgb' / '#rrggbb' (null if it is not one) — rounded to 4 decimals, which round-trips every 8-bit sRGB step */
export function hexToLinear(hex: string): Vec3 | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return [0, 1, 2].map(i => +srgbToLin(parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255).toFixed(4)) as Vec3;
}
/** CSS for a paint chip: the albedo as its sRGB colour under a specular streak whose strength and tightness follow the finish (a matte paint: none; polish: a
 *  narrow bright band; metal: the band takes the albedo's own hue, as a conductor's highlight does). An APPROXIMATION for the palette list, not a render. */
export function swatchCss(albedo: readonly number[], rough?: number, metal?: boolean): string {
  const base = linearToHex(albedo); const r = rough ?? ROUGH_DEFAULT; const gloss = Math.max(0, 1 - r);
  if (gloss < 0.08) return base;
  const a = (0.15 + 0.7 * gloss * gloss).toFixed(2); const w = 6 + 40 * r;   // brighter and narrower as it polishes
  const tint = metal ? linearToHex(albedo.map(x => Math.min(1, 0.35 + x * 1.6))) : '#ffffff';
  const rgba = (hexC: string, al: string) => `rgba(${parseInt(hexC.slice(1, 3), 16)},${parseInt(hexC.slice(3, 5), 16)},${parseInt(hexC.slice(5, 7), 16)},${al})`;
  return `linear-gradient(128deg, transparent ${(42 - w / 2).toFixed(0)}%, ${rgba(tint, a)} 42%, transparent ${(42 + w / 2).toFixed(0)}%), ${metal ? `linear-gradient(0deg, rgba(0,0,0,0.25), transparent 60%), ` : ''}${base}`;
}

export interface MaterialInfo { name: string; albedo: Vec3; rough?: number; metal?: boolean; notes?: string; boxes: number; parts: number }
/** a material record with only the keys it means, in the file's key order (KEYS.material): what every op below writes */
export function canonMaterial(m: { albedo: readonly number[]; rough?: number; metal?: boolean; notes?: string }): MaterialData {
  const o: MaterialData = { albedo: roundVec(m.albedo.map(x => Math.max(0, x))) };
  if (m.rough !== undefined) o.rough = round6(Math.min(1, Math.max(0, m.rough)));
  if (m.metal) o.metal = true;
  if (m.notes) o.notes = m.notes;
  return o;
}
/** how many boxes / prop parts reference each paint */
export function materialUsage(ed: Editor): Map<string, { boxes: number; parts: number }> {
  const u = new Map<string, { boxes: number; parts: number }>(); for (const k of Object.keys(ed.data.materials)) u.set(k, { boxes: 0, parts: 0 });
  for (const b of ed.data.boxes) if (b.material !== undefined) { const e = u.get(b.material); if (e) e.boxes++; }
  for (const p of ed.data.props) for (const q of p.parts) if (q.material !== undefined) { const e = u.get(q.material); if (e) e.parts++; }
  return u;
}
export function materialList(ed: Editor): MaterialInfo[] {
  const u = materialUsage(ed);
  return Object.entries(ed.data.materials).map(([name, m]) => ({ name, albedo: [...m.albedo] as Vec3, ...(m.rough !== undefined ? { rough: m.rough } : {}), ...(m.metal ? { metal: true } : {}), ...(m.notes ? { notes: m.notes } : {}), boxes: u.get(name)?.boxes ?? 0, parts: u.get(name)?.parts ?? 0 }));
}
/** ids of the boxes and props (any part) painted with `name` */
export function materialUsers(ed: Editor, name: string): { boxes: string[]; props: string[] } {
  return { boxes: ed.data.boxes.filter(b => b.material === name).map(b => b.id), props: ed.data.props.filter(p => p.parts.some(q => q.material === name)).map(p => p.id) };
}
function need(ed: Editor, name: string): MaterialData { const m = Object.prototype.hasOwnProperty.call(ed.data.materials, name) ? ed.data.materials[name] : undefined; if (!m) throw new Error(`no material '${name}' (palette: ${Object.keys(ed.data.materials).join(' ')})`); return m; }
/** replace the whole palette record (order as given) — the one write path */
function writeMaterials(ed: Editor, rec: Record<string, MaterialData>, label: string, coalesce?: string) { ed.doc.setPath(['materials'], rec, { label, coalesce }); }
/** Edit a paint in place: any of albedo / rough (null = unset → matte) / metal / notes (empty = drop). LIVE: every box using it follows on the next scene sync.
 *  `coalesce` folds a slider drag into one undo step (seal at the drag's end). */
export function materialSet(ed: Editor, name: string, patch: { albedo?: readonly number[]; rough?: number | null; metal?: boolean; notes?: string | null }, opts: { coalesce?: string; label?: string } = {}) {
  const cur = need(ed, name);
  if (patch.albedo && (patch.albedo.length !== 3 || patch.albedo.some(x => !Number.isFinite(x)))) throw new Error('albedo: three finite numbers');
  if (patch.rough !== undefined && patch.rough !== null && !Number.isFinite(patch.rough)) throw new Error('rough: a number in [0, 1] (null = unset)');
  const next = canonMaterial({ albedo: patch.albedo ?? cur.albedo, rough: patch.rough === null ? undefined : patch.rough ?? cur.rough, metal: patch.metal ?? cur.metal, notes: patch.notes === null ? undefined : patch.notes ?? cur.notes });
  const rec: Record<string, MaterialData> = {}; for (const [k, m] of Object.entries(ed.data.materials)) rec[k] = k === name ? next : m;
  writeMaterials(ed, rec, opts.label ?? `material ${name}`, opts.coalesce);
}
/** a new paint at the END of the palette (or right after `after`); refuses an existing name */
export function materialCreate(ed: Editor, name: string, init: { albedo?: readonly number[]; rough?: number; metal?: boolean; notes?: string } = {}, opts: { after?: string; label?: string } = {}): string {
  if (!MATERIAL_NAME_RE.test(name)) throw new Error('material names: a letter then letters / digits / _ (≤ 32)');
  if (Object.prototype.hasOwnProperty.call(ed.data.materials, name)) throw new Error(`material '${name}' exists`);
  const m = canonMaterial({ albedo: init.albedo ?? [0.5, 0.5, 0.5], rough: init.rough, metal: init.metal, notes: init.notes });
  const rec: Record<string, MaterialData> = {}; let placed = false;
  for (const [k, v] of Object.entries(ed.data.materials)) { rec[k] = v; if (k === opts.after) { rec[name] = m; placed = true; } }
  if (!placed) rec[name] = m;
  writeMaterials(ed, rec, opts.label ?? `new material ${name}`);
  return name;
}
/** a fresh palette name from `want` (want, want2, want3 …) */
export function freshMaterialName(ed: Editor, want: string): string { let base = want.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z]+/, '') || 'paint'; base = base.slice(0, 28); if (!(base in ed.data.materials)) return base; let k = 2; while (`${base}${k}` in ed.data.materials) k++; return `${base}${k}`; }
export function materialDuplicate(ed: Editor, src: string, newName = freshMaterialName(ed, `${src}_copy`)): string { const m = need(ed, src); return materialCreate(ed, newName, m, { after: src, label: `duplicate material ${src} → ${newName}` }); }
/** rename a paint (its slot in the palette order kept) and rewrite every box / prop-part reference — one command */
export function materialRename(ed: Editor, oldName: string, newName: string) {
  need(ed, oldName); if (newName === oldName) return;
  if (!MATERIAL_NAME_RE.test(newName)) throw new Error('material names: a letter then letters / digits / _ (≤ 32)');
  if (Object.prototype.hasOwnProperty.call(ed.data.materials, newName)) throw new Error(`material '${newName}' exists`);
  const rec: Record<string, MaterialData> = {}; for (const [k, v] of Object.entries(ed.data.materials)) rec[k === oldName ? newName : k] = v;
  ed.doc.transact(`rename material ${oldName} → ${newName}`, () => {
    writeMaterials(ed, rec, `rename material ${oldName} → ${newName}`);
    for (const b of ed.data.boxes) if (b.material === oldName) ed.updateBox(b.id, { material: newName });
    for (const p of ed.data.props) if (p.parts.some(q => q.material === oldName)) ed.updateProp(p.id, x => ({ ...x, parts: x.parts.map(q => q.material === oldName ? { ...q, material: newName } : q) }));
  });
}
/** remove a paint: refused while anything uses it — unless `repaintTo` names another paint the users move to first (one command) */
export function materialRemove(ed: Editor, name: string, opts: { repaintTo?: string } = {}) {
  need(ed, name); const users = materialUsers(ed, name);
  if ((users.boxes.length || users.props.length) && !opts.repaintTo) throw new Error(`material '${name}' paints ${users.boxes.length + users.props.length} thing(s) (${[...users.boxes, ...users.props].slice(0, 4).join(' ')}…) — repaint them first, or remove with { repaintTo }`);
  if (opts.repaintTo !== undefined) { if (opts.repaintTo === name) throw new Error('repaintTo: another material'); need(ed, opts.repaintTo); }
  const rec: Record<string, MaterialData> = {}; for (const [k, v] of Object.entries(ed.data.materials)) if (k !== name) rec[k] = v;
  ed.doc.transact(`remove material ${name}`, () => {
    if (opts.repaintTo) {
      for (const id of users.boxes) ed.updateBox(id, { material: opts.repaintTo });
      for (const pid of users.props) ed.updateProp(pid, x => ({ ...x, parts: x.parts.map(q => q.material === name ? { ...q, material: opts.repaintTo } : q) }));
    }
    writeMaterials(ed, rec, `remove material ${name}`);
  });
}
export function materialPreset(ed: Editor, name: string, presetKey: string) {
  const P = FINISH_PRESETS.find(p => p.key === presetKey); if (!P) throw new Error(`finish preset: one of ${FINISH_PRESETS.map(p => p.key).join(' ')}`);
  materialSet(ed, name, { rough: P.rough ?? null, metal: !!P.metal }, { label: `material ${name}: ${P.label} finish` });
}
/** The RESOLVED look of a box: albedo (its own or its paint's), rough / metal (its override, else the paint's, else matte / dielectric) — what loadLevel builds */
export function resolvedFinish(ed: Editor, b: BoxData): { albedo: Vec3; rough: number | undefined; metal: boolean; material?: string } {
  const m = b.material !== undefined ? ed.data.materials[b.material] : undefined;
  return { albedo: [...(b.albedo ?? m?.albedo ?? [0.5, 0.5, 0.5])] as Vec3, rough: b.rough ?? m?.rough, metal: b.metal ?? !!m?.metal, material: b.material };
}
/** a new paint from the primary box's resolved look, and the given boxes painted with it — one command; returns the name */
export function materialFromSelection(ed: Editor, boxIds: string[], name?: string): string {
  const b0 = ed.doc.get<BoxData>('boxes', boxIds[0] ?? ''); if (!b0) throw new Error('new paint from selection: select a box first');
  const f = resolvedFinish(ed, b0); const nm = name ?? freshMaterialName(ed, b0.material ? `${b0.material}_v` : (b0.group ?? 'paint').split('.')[0]);
  ed.doc.transact(`material ${nm} from ${boxIds[0]}`, () => { materialCreate(ed, nm, { albedo: f.albedo, rough: f.rough, metal: f.metal }, { after: b0.material }); boxPaint(ed, boxIds, nm); });
  return nm;
}

// ================================================================================================================================ per-box paint / overrides
/** a box record re-keyed in the file's order (KEYS.box) — so a box that gains `rough` keeps serializing (and diffing) like its neighbours */
export function canonBox(b: BoxData): BoxData { const o: any = {}; for (const k of KEYS.box) if ((b as any)[k] !== undefined) o[k] = (b as any)[k]; return o as BoxData; }
/** paint boxes with a palette entry (dropping an inline albedo) or an inline albedo (dropping the material) — per-box finish overrides are KEPT (clear them apart) */
export function boxPaint(ed: Editor, ids: string[], material: string | readonly number[], opts: { coalesce?: string; label?: string } = {}) {
  if (typeof material === 'string') need(ed, material);
  ed.doc.transact(opts.label ?? `paint ${ids.length} box(es) ${typeof material === 'string' ? material : 'inline'}`, () => { for (const id of ids) ed.updateBox(id, b => { const o = { ...b }; if (typeof material === 'string') { o.material = material; delete o.albedo; } else { o.albedo = roundVec((material as number[]).map(x => Math.max(0, x))); delete o.material; } return canonBox(o); }, { coalesce: opts.coalesce }); }, opts.coalesce);
}
/** Per-box overrides on every box in `ids`: `albedo` = go INLINE with that colour (the material link dropped — the box keeps its resolved finish as explicit
 *  rough / metal so the look does not jump), `rough` (null = drop the override), `metal` (null = drop). `patch === null` clears rough + metal overrides
 *  (an inline box keeps its albedo — repaint it with a material to re-link). One command; `coalesce` for slider drags. */
export function boxOverride(ed: Editor, ids: string[], patch: { albedo?: readonly number[]; rough?: number | null; metal?: boolean | null } | null, opts: { coalesce?: string; label?: string } = {}) {
  if (!ids.length) return;
  ed.doc.transact(opts.label ?? (patch === null ? `clear finish overrides on ${ids.length} box(es)` : `finish override on ${ids.length} box(es)`), () => {
    for (const id of ids) ed.updateBox(id, b => {
      const o: BoxData = { ...b }; const m = b.material !== undefined ? ed.data.materials[b.material] : undefined;
      if (patch === null) { delete o.rough; delete o.metal; return canonBox(o); }
      if (patch.albedo !== undefined) {
        if (b.material !== undefined) { if (o.rough === undefined && m?.rough !== undefined) o.rough = m.rough; if (o.metal === undefined && m?.metal) o.metal = true; }   // keep the look it had under the paint
        o.albedo = roundVec(patch.albedo.map(x => Math.max(0, x))); delete o.material;
      }
      if (patch.rough !== undefined) { if (patch.rough === null) delete o.rough; else o.rough = round6(Math.min(1, Math.max(0, patch.rough))); }
      if (patch.metal !== undefined) {
        if (patch.metal === null) delete o.metal;
        else if (patch.metal) o.metal = true;
        else if (m?.metal && o.material !== undefined) o.metal = false;   // false only means something over a metal paint; elsewhere it is the default — unwritten
        else delete o.metal;
      }
      return canonBox(o);
    }, { coalesce: opts.coalesce });
  }, opts.coalesce);
}
export function boxFinishPreset(ed: Editor, ids: string[], presetKey: string) {
  const P = FINISH_PRESETS.find(p => p.key === presetKey); if (!P) throw new Error(`finish preset: one of ${FINISH_PRESETS.map(p => p.key).join(' ')}`);
  boxOverride(ed, ids, P.key === 'unset' ? { rough: null, metal: null } : { rough: P.rough!, metal: !!P.metal }, { label: `${P.label} finish on ${ids.length} box(es)` });
}

// ================================================================================================================================ markings: geometry
export interface FaceLattice { face: MarkFace; res: MarkRes; /** cell size (m) */ t: number; /** face half sizes along u / v (m) */ hu: number; hv: number; /** lattice cell range wholly inside the face: [uMin, uEnd) × [vMin, vEnd) */ uMin: number; uEnd: number; vMin: number; vEnd: number; /** the largest bitmap the face takes at this res (≤ 32) */ maxW: number; maxH: number }
/** the marking lattice of one face of a box of half extents h at `res` (base texel `base` = the level's meta.markTexel) */
export function faceLattice(h: readonly number[], face: MarkFace, res: MarkRes = 'base', base = MARKING_TEXEL): FaceLattice {
  const t = base * RES_K[res]; const { hu, hv } = faceHalf(h as Vec3, faceIndex(face)); const eps = 1e-7;
  const uMin = Math.ceil(-hu / t - eps), uEnd = Math.floor(hu / t + eps), vMin = Math.ceil(-hv / t - eps), vEnd = Math.floor(hv / t + eps);
  return { face, res, t, hu, hv, uMin, uEnd, vMin, vEnd, maxW: Math.max(0, Math.min(MAX_CELLS_W, uEnd - uMin)), maxH: Math.max(0, Math.min(MAX_CELLS_H, vEnd - vMin)) };
}
/** size clamped to what the face takes (and 1‥32), then `at` clamped so the bitmap stays on the face */
export function clampToFace(L: FaceLattice, at: readonly number[], size: readonly number[]): { at: [number, number]; size: [number, number] } {
  const W = Math.max(1, Math.min(L.maxW || 1, Math.round(size[0]) || 1)), H = Math.max(1, Math.min(L.maxH || 1, Math.round(size[1]) || 1));
  const U = Math.min(Math.max(Math.round(at[0]) || 0, L.uMin), L.uEnd - W), V = Math.min(Math.max(Math.round(at[1]) || 0, L.vMin), L.vEnd - H);
  return { at: [U, V], size: [W, H] };
}
/** the box-local face a WORLD normal points out of (yaw-only boxes: the face frame's own convention) */
export function faceOfNormal(n: readonly number[], yaw = 0): MarkFace {
  const cs = Math.cos(yaw), sn = Math.sin(yaw); const lx = cs * n[0] - sn * n[2], lz = sn * n[0] + cs * n[2], ly = n[1];
  const ax = Math.abs(lx), ay = Math.abs(ly), az = Math.abs(lz);
  return ax >= ay && ax >= az ? (lx >= 0 ? '+x' : '-x') : ay >= az ? (ly >= 0 ? '+y' : '-y') : (lz >= 0 ? '+z' : '-z');
}
export type Anchor = 'centre' | 'bl' | 'br' | 'tl' | 'tr' | 'left' | 'right' | 'top' | 'bottom';
export function anchorAt(L: FaceLattice, size: readonly number[], anchor: Anchor): [number, number] {
  const W = size[0], H = size[1];
  const uc = Math.floor((L.uMin + L.uEnd - W) / 2), vc = Math.floor((L.vMin + L.vEnd - H) / 2);
  const u = anchor === 'bl' || anchor === 'tl' || anchor === 'left' ? L.uMin : anchor === 'br' || anchor === 'tr' || anchor === 'right' ? L.uEnd - W : uc;
  const v = anchor === 'bl' || anchor === 'br' || anchor === 'bottom' ? L.vMin : anchor === 'tl' || anchor === 'tr' || anchor === 'top' ? L.vEnd - H : vc;
  return [u, v];
}

// ================================================================================================================================ markings: document ops
export interface MarkingSpec { face?: MarkFace; res?: MarkRes; at?: [number, number]; size?: [number, number]; anchor?: Anchor; pal?: MarkPal[]; cells?: string[] }
export interface MarkingInfo { index: number; face: MarkFace; res: MarkRes; at: [number, number]; size: [number, number]; texel: number; pal: MarkPal[]; cells: string[]; lit: number; emits: boolean; errors: string[] }
const box = (ed: Editor, id: string): BoxData => { const b = ed.doc.get<BoxData>('boxes', id); if (!b) throw new Error(`no box '${id}'`); return b; };
export const markTexelOf = (ed: Editor) => ed.data.meta.markTexel ?? MARKING_TEXEL;
/** every problem with marking m on box b (the level's own validator: keys, enums, palette, cells, inside-the-face at the level's base texel) */
export function markingProblems(ed: Editor, b: BoxData, m: MarkingDef): string[] { const e = markingErrors(m, b.h as Vec3, markTexelOf(ed)); if (b.rot) e.unshift('a box with rot cannot carry markings (the face frame is yaw-only)'); return e; }
export function markingList(ed: Editor, boxId: string): MarkingInfo[] {
  const b = box(ed, boxId);
  return (b.markings ?? []).map((m, index) => { let lit = 0; for (const r of m.cells) for (const ch of r) if (ch !== '.') lit++; return { index, face: m.face, res: m.res ?? 'base', at: [m.at[0], m.at[1]], size: [m.size[0], m.size[1]], texel: markTexelOf(ed) * RES_K[m.res ?? 'base'], pal: clonePlain(m.pal), cells: m.cells.slice(), lit, emits: m.pal.some(p => !!p.emit), errors: markingProblems(ed, b, m) }; });
}
/** replace box `boxId`'s marking list through ONE box update (validated: every marking must pass the level's own markingErrors) */
function writeMarkings(ed: Editor, boxId: string, list: MarkingDef[], label: string, coalesce?: string) {
  const b = box(ed, boxId);
  if (list.length > MAX_MARKS_PER_BOX) throw new Error(`at most ${MAX_MARKS_PER_BOX} markings per box`);
  list.forEach((m, k) => { const errs = markingProblems(ed, b, m); if (errs.length) throw new Error(`marking ${k} on ${boxId}: ${errs.join('; ')}`); });
  ed.updateBox(boxId, x => { const o: BoxData = { ...x }; if (list.length) o.markings = list.map(marking); else delete o.markings; return canonBox(o); }, { label, coalesce });
}
function withMarking(ed: Editor, boxId: string, i: number, f: (m: MarkingDef, b: BoxData) => MarkingDef, label: string, coalesce?: string) {
  const b = box(ed, boxId); const list = (b.markings ?? []).map(m => clonePlain(m)); const m = list[i]; if (!m) throw new Error(`box ${boxId} has no marking ${i} (${list.length})`);
  list[i] = f(m, b); writeMarkings(ed, boxId, list, label, coalesce);
}
/** the default palette a fresh marking starts with: one entry darkening the box's own albedo (a material — never a shaded colour) */
export const DEFAULT_PAL: MarkPal[] = [{ mul: 0.55 }];
/** Add a marking on `face` (default: the box's largest bitmap that fits, ≤ 8 × 8 base cells, centred; blank cells). Returns its index. */
export function markingAdd(ed: Editor, boxId: string, spec: MarkingSpec = {}): number {
  const b = box(ed, boxId); const list = (b.markings ?? []).map(m => clonePlain(m));
  if (list.length >= MAX_MARKS_PER_BOX) throw new Error(`box ${boxId} already carries ${MAX_MARKS_PER_BOX} markings (the per-box cap)`);
  const face = spec.face ?? '+y'; const res = spec.res ?? 'base'; const L = faceLattice(b.h, face, res, markTexelOf(ed));
  if (b.rot) throw new Error(`${boxId} is tilted (rot): a marking's face frame is yaw-only`);
  if (L.maxW < 1 || L.maxH < 1) throw new Error(`face ${face} of ${boxId} (${(2 * L.hu).toFixed(3)} × ${(2 * L.hv).toFixed(3)} m) is smaller than one ${res} cell (${(L.t * 100).toFixed(2)} cm)`);
  const want: [number, number] = spec.size ?? (spec.cells ? [spec.cells[0]?.length ?? 1, spec.cells.length] : [Math.min(8, L.maxW), Math.min(8, L.maxH)]);
  const size: [number, number] = [Math.max(1, Math.min(L.maxW, Math.round(want[0]) || 1)), Math.max(1, Math.min(L.maxH, Math.round(want[1]) || 1))];
  const at: [number, number] = spec.at && !spec.anchor ? clampToFace(L, spec.at, size).at : anchorAt(L, size, spec.anchor ?? 'centre');
  const pal = (spec.pal ?? DEFAULT_PAL).slice(0, MAX_PAL).map(p => clonePlain(p));
  let cells = spec.cells ? fitRows(spec.cells, size[0], size[1]) : blankRows(size[0], size[1]);
  cells = cells.map(r => r.replace(new RegExp(`[^${CELL_CHARS.slice(0, pal.length + 1)}]`, 'g'), '.'));   // cells may only name entries the palette has
  list.push(marking({ face, res, at, size, pal, cells }));
  writeMarkings(ed, boxId, list, `add marking on ${boxId} ${face}`);
  return list.length - 1;
}
export const blankRows = (W: number, H: number) => Array.from({ length: H }, () => '.'.repeat(W));
/** rows cropped / padded (with '.') to W × H, keeping the TOP-LEFT */
export function fitRows(rows: readonly string[], W: number, H: number): string[] { const out: string[] = []; for (let j = 0; j < H; j++) { const r = rows[j] ?? ''; out.push((r + '.'.repeat(Math.max(0, W - r.length))).slice(0, W)); } return out; }
/** Edit a marking's frame: face / res / at / size / anchor (cells are cropped or padded top-left to a new size; a res or face change re-clamps into the face). */
export function markingUpdate(ed: Editor, boxId: string, i: number, patch: MarkingSpec, opts: { coalesce?: string; label?: string } = {}) {
  withMarking(ed, boxId, i, (m, b) => {
    const face = patch.face ?? m.face, res = patch.res ?? m.res ?? 'base'; const L = faceLattice(b.h, face, res, markTexelOf(ed));
    if (L.maxW < 1 || L.maxH < 1) throw new Error(`face ${face} of ${boxId} is smaller than one ${res} cell`);
    let size: [number, number] = patch.size ?? (patch.cells ? [patch.cells[0]?.length ?? m.size[0], patch.cells.length] : [m.size[0], m.size[1]]);
    let at: [number, number] = patch.at ?? [m.at[0], m.at[1]];
    const cl = clampToFace(L, at, size); size = cl.size; at = patch.anchor ? anchorAt(L, size, patch.anchor) : cl.at;
    const pal = (patch.pal ?? m.pal).slice(0, MAX_PAL);
    const cells = fitRows(patch.cells ?? m.cells, size[0], size[1]);
    return { face, res, at, size, pal, cells };
  }, opts.label ?? `edit marking ${i} on ${boxId}`, opts.coalesce);
}
export function markingRemove(ed: Editor, boxId: string, i: number) { const b = box(ed, boxId); const list = (b.markings ?? []).map(m => clonePlain(m)); if (!list[i]) throw new Error(`box ${boxId} has no marking ${i}`); list.splice(i, 1); writeMarkings(ed, boxId, list, `remove marking ${i} from ${boxId}`); }
export function markingDuplicate(ed: Editor, boxId: string, i: number): number { const b = box(ed, boxId); const list = (b.markings ?? []).map(m => clonePlain(m)); if (!list[i]) throw new Error(`box ${boxId} has no marking ${i}`); if (list.length >= MAX_MARKS_PER_BOX) throw new Error(`box ${boxId} already carries ${MAX_MARKS_PER_BOX} markings`); list.push(clonePlain(list[i])); writeMarkings(ed, boxId, list, `duplicate marking ${i} on ${boxId}`); return list.length - 1; }
/** replace ALL of a box's markings (a kind recipe, a paste of a whole set) */
export function markingSetAll(ed: Editor, boxId: string, list: MarkingDef[], label = `set ${list.length} marking(s) on ${boxId}`) { writeMarkings(ed, boxId, list.slice(0, MAX_MARKS_PER_BOX).map(m => clonePlain(m)), label); }

// ---- cells (x = column from the left, y = row from the TOP: cells[y][x] — what the painter shows)
const setCell = (rows: string[], x: number, y: number, e: number) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; const r = rows[y]; rows[y] = r.slice(0, x) + CELL_CHARS[e] + r.slice(x + 1); };
const entryOk = (m: MarkingDef, e: number) => { if (!(Number.isInteger(e) && e >= 0 && e <= m.pal.length)) throw new Error(`entry ${e}: 0 (transparent) ‥ ${m.pal.length} (the palette has ${m.pal.length})`); };
/** paint one cell with entry e (0 = transparent) — `coalesce` folds a brush stroke into one undo step */
export function markingPaintCell(ed: Editor, boxId: string, i: number, x: number, y: number, e: number, opts: { coalesce?: string } = {}) {
  withMarking(ed, boxId, i, m => { entryOk(m, e); const rows = m.cells.slice(); setCell(rows, x, y, e); return { ...m, cells: rows }; }, `paint marking ${i} on ${boxId}`, opts.coalesce);
}
/** paint several cells in one op (a stroke segment interpolated by the painter) */
export function markingPaintCells(ed: Editor, boxId: string, i: number, pts: readonly (readonly [number, number])[], e: number, opts: { coalesce?: string } = {}) {
  withMarking(ed, boxId, i, m => { entryOk(m, e); const rows = m.cells.slice(); for (const [x, y] of pts) setCell(rows, x, y, e); return { ...m, cells: rows }; }, `paint marking ${i} on ${boxId}`, opts.coalesce);
}
/** fill the cell rect [x0, y0, x1, y1] INCLUSIVE (any corner order) with entry e */
export function markingFill(ed: Editor, boxId: string, i: number, rect: readonly [number, number, number, number], e: number, opts: { coalesce?: string } = {}) {
  withMarking(ed, boxId, i, m => { entryOk(m, e); const rows = m.cells.slice(); const x0 = Math.max(0, Math.min(rect[0], rect[2])), x1 = Math.min(m.size[0] - 1, Math.max(rect[0], rect[2])), y0 = Math.max(0, Math.min(rect[1], rect[3])), y1 = Math.min(m.size[1] - 1, Math.max(rect[1], rect[3])); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setCell(rows, x, y, e); return { ...m, cells: rows }; }, `fill marking ${i} on ${boxId}`, opts.coalesce);
}
export function markingClear(ed: Editor, boxId: string, i: number) { withMarking(ed, boxId, i, m => ({ ...m, cells: blankRows(m.size[0], m.size[1]) }), `clear marking ${i} on ${boxId}`); }
export function markingMirror(ed: Editor, boxId: string, i: number, axis: 'h' | 'v') { withMarking(ed, boxId, i, m => ({ ...m, cells: axis === 'h' ? m.cells.map(r => [...r].reverse().join('')) : m.cells.slice().reverse() }), `mirror marking ${i} ${axis} on ${boxId}`); }
/** shift the whole bitmap by (dx, dy) cells (dy > 0 = down as displayed), wrapping round — nothing is lost, so it undoes by shifting back too */
export function markingShift(ed: Editor, boxId: string, i: number, dx: number, dy: number, opts: { coalesce?: string } = {}) {
  withMarking(ed, boxId, i, m => { const W = m.size[0], H = m.size[1]; const sx = ((dx % W) + W) % W, sy = ((dy % H) + H) % H; const rows = m.cells.map((_, y) => m.cells[(y - sy + H) % H]).map(r => r.slice(W - sx) + r.slice(0, W - sx)); return { ...m, cells: rows }; }, `shift marking ${i} on ${boxId}`, opts.coalesce);
}
/** move the bitmap on the face by (du, dv) lattice cells (clamped to the face) */
export function markingNudge(ed: Editor, boxId: string, i: number, du: number, dv: number, opts: { coalesce?: string } = {}) { const m = (box(ed, boxId).markings ?? [])[i]; if (!m) throw new Error(`box ${boxId} has no marking ${i}`); markingUpdate(ed, boxId, i, { at: [m.at[0] + du, m.at[1] + dv] }, { coalesce: opts.coalesce, label: `nudge marking ${i} on ${boxId}` }); }

// ---- palette entries (MATERIALS: albedo | mul, rough?, emit? — the ≤ 3 rule and the one-chroma rule for emitters are enforced here and in the UI)
/** the chroma an emitting palette shares (its first emissive entry's emit normalized to max 1) and each entry's LEVEL (its emit's max component) */
export function emitModel(pal: readonly MarkPal[], cellCounts?: readonly number[]): { chroma: Vec3 | null; levels: (number | null)[]; consistent: boolean; hues: number; minorityShare: number } {
  let chroma: Vec3 | null = null; let consistent = true; const levels: (number | null)[] = [];
  const clusters: { c: Vec3; flux: number }[] = [];   // distinct emit chromas with their share of the marking's flux (level × lit cells, when counts are known; else level)
  for (const p of pal) {
    if (!p.emit || !(p.emit[0] > 0 || p.emit[1] > 0 || p.emit[2] > 0)) { levels.push(null); continue; }
    const L = Math.max(p.emit[0], p.emit[1], p.emit[2]); levels.push(L); const c: Vec3 = [p.emit[0] / L, p.emit[1] / L, p.emit[2] / L];
    if (!chroma) chroma = c; else if (Math.abs(c[0] - chroma[0]) > 0.03 || Math.abs(c[1] - chroma[1]) > 0.03 || Math.abs(c[2] - chroma[2]) > 0.03) consistent = false;
    const flux = L * (cellCounts ? (cellCounts[levels.length - 1] ?? 0) : 1); const hit = clusters.find(q => Math.abs(q.c[0] - c[0]) <= 0.03 && Math.abs(q.c[1] - c[1]) <= 0.03 && Math.abs(q.c[2] - c[2]) <= 0.03);
    if (hit) hit.flux += flux; else clusters.push({ c, flux });
  }
  const total = clusters.reduce((a, q) => a + q.flux, 0); const top = clusters.reduce((a, q) => Math.max(a, q.flux), 0);
  return { chroma, levels, consistent, hues: clusters.length, minorityShare: total > 0 ? 1 - top / total : 0 };   // (one lamp behind a printed film: several hues are allowed; the registered light takes the flux-weighted mean — keep the minority share small)
}
const emitOf = (chroma: readonly number[], level: number): Vec3 => roundVec([chroma[0] * level, chroma[1] * level, chroma[2] * level]);
/** Edit palette entry k: `mode` 'mul' (× the box's albedo) | 'albedo' (absolute) | 'none' (leave the albedo: a roughness / emission-only entry); `mul`, `albedo`,
 *  `rough` (null = the box's), `emitLevel` (null / 0 = not emissive; > 0 = the entry emits the marking's SHARED chroma × level), `emitChroma` (rewrites EVERY
 *  emissive entry's chroma — one registered light per marking, one colour). */
export function markingSetPal(ed: Editor, boxId: string, i: number, k: number, patch: { mode?: 'mul' | 'albedo' | 'none'; mul?: number; albedo?: readonly number[]; rough?: number | null; emitLevel?: number | null; emitOwnChroma?: readonly number[]; emitChroma?: readonly number[]; emit?: readonly number[] | null }, opts: { coalesce?: string; label?: string } = {}) {
  withMarking(ed, boxId, i, m => {
    const pal = m.pal.map(p => clonePlain(p)); const p = pal[k]; if (!p) throw new Error(`marking ${i} has no palette entry ${k} (${pal.length})`);
    if (patch.mode === 'mul') { delete p.albedo; p.mul = round6(patch.mul ?? p.mul ?? 0.6); }
    else if (patch.mode === 'albedo') { delete p.mul; p.albedo = roundVec((patch.albedo ?? p.albedo ?? [0.5, 0.5, 0.5]).map(x => Math.min(1, Math.max(0, x)))); }
    else if (patch.mode === 'none') { delete p.mul; delete p.albedo; }
    else { if (patch.mul !== undefined) { delete p.albedo; p.mul = round6(Math.min(4, Math.max(0, patch.mul))); } if (patch.albedo !== undefined) { delete p.mul; p.albedo = roundVec(patch.albedo.map(x => Math.min(1, Math.max(0, x)))); } }
    if (patch.rough !== undefined) { if (patch.rough === null) delete p.rough; else p.rough = round6(Math.min(1, Math.max(0, patch.rough))); }
    const model = emitModel(pal);
    if (patch.emit !== undefined) { if (patch.emit === null) delete p.emit; else p.emit = roundVec(patch.emit.map(x => Math.max(0, x))); }
    if (patch.emitChroma !== undefined) { const mx = Math.max(patch.emitChroma[0], patch.emitChroma[1], patch.emitChroma[2], 1e-6); const c: Vec3 = [patch.emitChroma[0] / mx, patch.emitChroma[1] / mx, patch.emitChroma[2] / mx]; pal.forEach((q, j) => { const L = model.levels[j]; if (L !== null && L !== undefined) q.emit = emitOf(c, L); }); if (patch.emitLevel !== undefined && patch.emitLevel !== null && patch.emitLevel > 0) p.emit = emitOf(c, patch.emitLevel); }
    else if (patch.emitOwnChroma !== undefined) { const v = patch.emitOwnChroma; const mx = Math.max(v[0], v[1], v[2], 1e-6); const lvl = p.emit ? Math.max(p.emit[0], p.emit[1], p.emit[2]) : (model.levels.find(x => x !== null) ?? 1.5); p.emit = emitOf([v[0] / mx, v[1] / mx, v[2] / mx], lvl); }   // this entry's OWN filter colour (one lamp, per-cell filters); the level is kept
    else if (patch.emitLevel !== undefined) { if (patch.emitLevel === null || !(patch.emitLevel > 0)) delete p.emit; else { const own: Vec3 | null = p.emit && Math.max(p.emit[0], p.emit[1], p.emit[2]) > 0 ? (() => { const L = Math.max(p.emit![0], p.emit![1], p.emit![2]); return [p.emit![0] / L, p.emit![1] / L, p.emit![2] / L] as Vec3; })() : p.albedo && Math.max(p.albedo[0], p.albedo[1], p.albedo[2]) > 0.02 ? (() => { const A = Math.max(p.albedo![0], p.albedo![1], p.albedo![2]); return [p.albedo![0] / A, p.albedo![1] / A, p.albedo![2] / A] as Vec3; })() : null; p.emit = emitOf(own ?? model.chroma ?? [1, 1, 1], patch.emitLevel); } }   // switching an entry ON keeps its own hue (its emit, else its albedo's — a red print transmits red), else the marking's, else white
    return { ...m, pal };
  }, opts.label ?? `marking ${i} entry ${'abc'[k] ?? k} on ${boxId}`, opts.coalesce);
}
/** rewrite every emissive entry to ONE chroma (the first emitter's), keeping each entry's level — the fix for a marking loaded with two hues */
export function markingUnifyChroma(ed: Editor, boxId: string, i: number) { withMarking(ed, boxId, i, m => { const model = emitModel(m.pal); if (!model.chroma) return m; return { ...m, pal: m.pal.map((p, j) => model.levels[j] !== null ? { ...p, emit: emitOf(model.chroma!, model.levels[j]!) } : p) }; }, `one chroma on marking ${i} of ${boxId}`); }
export function markingAddPal(ed: Editor, boxId: string, i: number, entry: MarkPal = { mul: 0.6 }): number { let n = 0; withMarking(ed, boxId, i, m => { if (m.pal.length >= MAX_PAL) throw new Error(`a marking has at most ${MAX_PAL} palette entries (the 2-bit cells name 0 = transparent + three)`); n = m.pal.length; return { ...m, pal: [...m.pal, clonePlain(entry)] }; }, `add palette entry to marking ${i} of ${boxId}`); return n; }
/** remove entry k: its cells go transparent, higher entries move down a letter */
export function markingRemovePal(ed: Editor, boxId: string, i: number, k: number) {
  withMarking(ed, boxId, i, m => { if (m.pal.length <= 1) throw new Error('a marking keeps at least one palette entry'); if (!m.pal[k]) throw new Error(`no entry ${k}`); const gone = CELL_CHARS[k + 1]; const remap = (ch: string) => ch === gone ? '.' : CELL_CHARS.indexOf(ch) > k + 1 ? CELL_CHARS[CELL_CHARS.indexOf(ch) - 1] : ch; return { ...m, pal: m.pal.filter((_, j) => j !== k), cells: m.cells.map(r => [...r].map(remap).join('')) }; }, `remove palette entry ${'abc'[k]} from marking ${i} of ${boxId}`);
}

// ---- generators: parametric fills INTO the current bitmap (then hand-edit) — scene/markings.ts GEN + a plain fill + the 5 × 7 glyphs
export const GENERATOR_KINDS = ['fill', 'grid', 'seams', 'lines', 'scribble', 'dots', 'window', 'glyph', 'tape'] as const;
export type GeneratorKind = typeof GENERATOR_KINDS[number];
/** the parameters each generator takes with their defaults (the UI builds its rows from this; `entry`-typed ones are palette indices 1‥3) */
export const GENERATOR_PARAMS: Record<GeneratorKind, { key: string; def: number; min: number; max: number; entry?: boolean; title: string }[]> = {
  fill: [{ key: 'entry', def: 1, min: 0, max: 3, entry: true, title: 'entry to fill every cell with (0 = clear)' }],
  grid: [{ key: 'capW', def: 1, min: 1, max: 8, title: 'cap width (cells)' }, { key: 'capH', def: 1, min: 1, max: 8, title: 'cap height' }, { key: 'gap', def: 1, min: 0, max: 4, title: 'gap between / around caps' }, { key: 'keyboard', def: 0, min: 0, max: 1, title: '1 = the bottom row\'s middle is one long bar (space)' }, { key: 'deck', def: 1, min: 0, max: 3, entry: true, title: 'deck entry (between caps)' }, { key: 'cap', def: 2, min: 0, max: 3, entry: true, title: 'cap entry' }],
  seams: [{ key: 'rows', def: 3, min: 1, max: 16, title: 'drawer rows (seams between them)' }, { key: 'cols', def: 1, min: 1, max: 16, title: 'door columns' }, { key: 'pullW', def: 3, min: 0, max: 12, title: 'pull width (0 = none)' }, { key: 'pullH', def: 1, min: 0, max: 4, title: 'pull height' }, { key: 'seam', def: 1, min: 0, max: 3, entry: true, title: 'seam entry' }, { key: 'pull', def: 2, min: 0, max: 3, entry: true, title: 'pull entry' }],
  lines: [{ key: 'thick', def: 1, min: 1, max: 4, title: 'bar thickness (cells)' }, { key: 'gap', def: 1, min: 0, max: 4, title: 'gap between bars' }, { key: 'seed', def: 0, min: 0, max: 99, title: 'ragged-length seed' }, { key: 'ink', def: 1, min: 0, max: 3, entry: true, title: 'ink entry' }, { key: 'clear', def: 1, min: 0, max: 1, title: '1 = clear the bitmap first' }],
  scribble: [{ key: 'seed', def: 0, min: 0, max: 9, title: 'amplitude seed' }, { key: 'ink', def: 1, min: 0, max: 3, entry: true, title: 'ink entry' }, { key: 'clear', def: 1, min: 0, max: 1, title: '1 = clear first' }],
  dots: [{ key: 'count', def: 3, min: 1, max: 16, title: 'dots' }, { key: 'pitch', def: 2, min: 1, max: 8, title: 'cells between dot starts' }, { key: 'row', def: -1, min: -1, max: 31, title: 'row from the BOTTOM (−1 = the middle)' }, { key: 'seed', def: 0, min: 0, max: 99, title: 'amber seed' }, { key: 'amberEvery', def: 0, min: 0, max: 9, title: 'every k-th (by hash) dot takes the alt entry (0 = never)' }, { key: 'dot', def: 1, min: 0, max: 3, entry: true, title: 'dot entry' }, { key: 'alt', def: 2, min: 0, max: 3, entry: true, title: 'alt entry' }],
  window: [{ key: 'cols', def: 4, min: 1, max: 8, title: 'cans a shelf' }, { key: 'rows', def: 4, min: 1, max: 8, title: 'shelves' }, { key: 'seed', def: 0, min: 0, max: 99, title: 'sold-out / can mix seed' }, { key: 'canA', def: 1, min: 0, max: 3, entry: true, title: 'can entry A' }, { key: 'canB', def: 2, min: 0, max: 3, entry: true, title: 'can entry B' }, { key: 'back', def: 3, min: 0, max: 3, entry: true, title: 'backlight / tag entry' }],
  glyph: [{ key: 'glyph', def: 0, min: 0, max: GLYPHS.length - 1, title: GLYPH_NAMES.map((n, i) => `${i} = ${n}`).join(' · ') }, { key: 'i0', def: -1, min: -1, max: 31, title: 'left column (−1 = centred)' }, { key: 'j0', def: -1, min: -1, max: 31, title: 'bottom row from the BOTTOM (−1 = centred)' }, { key: 'scale', def: 1, min: 1, max: 4, title: 'cell scale' }, { key: 'ink', def: 1, min: 0, max: 3, entry: true, title: 'ink entry' }, { key: 'clear', def: 0, min: 0, max: 1, title: '1 = clear first' }],
  tape: [{ key: 'ink', def: 1, min: 1, max: 3, entry: true, title: 'entry that becomes the tape (its material set to brown packing tape, gloss 0.35)' }, { key: 'rows', def: 0, min: 0, max: 32, title: 'band height in cells about the middle (0 = the whole bitmap)' }],
};
/** Run generator `kind` INTO marking i's bitmap (entries the recipe names beyond the palette are ADDED as plain darkening entries so the cells stay valid). */
export function markingGenerate(ed: Editor, boxId: string, i: number, kind: GeneratorKind, params: Record<string, number> = {}) {
  const P = (k: string) => { const d = GENERATOR_PARAMS[kind]?.find(p => p.key === k); if (!d) return 0; const v = params[k] ?? d.def; return Math.round(Math.min(d.max, Math.max(d.min, Number.isFinite(v) ? v : d.def))); };
  if (!GENERATOR_KINDS.includes(kind)) throw new Error(`generator: one of ${GENERATOR_KINDS.join(' ')}`);
  withMarking(ed, boxId, i, m => {
    const W = m.size[0], H = m.size[1]; const c = new CellCanvas(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.set(x, H - 1 - y, CELL_CHARS.indexOf(m.cells[y][x]));   // start from the current cells (canvas j = 0 is the BOTTOM row)
    let pal = m.pal.map(p => clonePlain(p)); let maxE = 0;
    const used = (...es: number[]) => { for (const e of es) maxE = Math.max(maxE, e); };
    switch (kind) {
      case 'fill': c.fill(P('entry')); used(P('entry')); break;
      case 'grid': GEN.grid(c, P('capW'), P('capH'), P('gap'), !!P('keyboard'), P('deck'), P('cap')); used(P('deck'), P('cap')); break;
      case 'seams': GEN.seams(c, P('rows'), P('cols'), P('pullW'), P('pullH'), P('seam'), P('pull')); used(P('seam'), P('pullW') > 0 && P('pullH') > 0 ? P('pull') : 0); break;
      case 'lines': if (P('clear')) c.fill(0); GEN.lines(c, P('thick'), P('gap'), P('seed'), P('ink')); used(P('ink')); break;
      case 'scribble': if (P('clear')) c.fill(0); GEN.scribble(c, P('seed'), P('ink')); used(P('ink')); break;
      case 'dots': GEN.dots(c, P('count'), P('pitch'), P('row') < 0 ? Math.floor(H / 2) : Math.min(H - 1, P('row')), P('seed'), P('amberEvery'), P('dot'), P('alt')); used(P('dot'), P('amberEvery') > 0 ? P('alt') : 0); break;
      case 'window': GEN.window(c, P('cols'), P('rows'), P('seed'), P('canA'), P('canB'), P('back')); used(P('canA'), P('canB'), P('back')); break;
      case 'glyph': { const s = P('scale'); if (P('clear')) c.fill(0); const i0 = P('i0') < 0 ? Math.floor((W - 5 * s) / 2) : P('i0'), j0 = P('j0') < 0 ? Math.floor((H - 7 * s) / 2) : P('j0'); GEN.glyph(c, P('glyph'), i0, j0, s, P('ink')); used(P('ink')); break; }
      case 'tape': { const e = P('ink'); const rows = P('rows'); if (rows > 0 && rows < H) { const j0 = Math.floor((H - rows) / 2); c.fill(e, 0, j0, W, j0 + rows); } else c.fill(e); used(e); break; }
    }
    while (pal.length < Math.min(maxE, MAX_PAL)) pal.push({ mul: pal.length === 1 ? 0.4 : 0.75 });   // (a recipe that names entry b / c on a one-entry palette: give it entries rather than write cells the validator refuses)
    if (kind === 'tape') pal[P('ink') - 1] = { albedo: [...MD.MK.tape] as Vec3, rough: 0.35 };      // the tape IS a material: brown packing tape, glossier than the carton
    return { ...m, pal, cells: c.toRows() };
  }, `${kind} into marking ${i} of ${boxId}`);
}
/** The per-KIND recipes of scene/markingDefaults.ts applied to a box of half extents h — 'how every carton of a size is marked identically'. Each returns the
 *  full marking SET the office's objects of that kind carry; the editor replaces the box's markings with it. */
export const KIND_RECIPES: readonly { key: string; label: string; title: string; make: (h: Vec3, face: MarkFace, t: number) => MarkingDef[] }[] = [
  { key: 'keyboard', label: 'keyboard', title: 'key caps + space bar on the top face (h ≈ 0.2 × 0.012 × 0.07)', make: (h, _f, t) => MD.keyboardMarks(h, t) },
  { key: 'monitor', label: 'monitor (lit)', title: 'two or three emissive UI bars upper left of a lit screen (+z)', make: (h, _f, t) => MD.monitorMarks(h, true, t) },
  { key: 'carton', label: 'carton', title: 'tape over the top and down +x, this-side-up + fragile print (+z), shipping label (−z)', make: (h, _f, t) => MD.cartonMarks(h, t) },
  { key: 'shelfCarton', label: 'shelf carton', title: 'squat carton on shelving: tape along the top, print on both long faces', make: (h, _f, t) => MD.shelfCartonMarks(h, t) },
  { key: 'cabinet', label: 'filing cabinet', title: 'three drawer seams + pulls (coarse) on −z', make: (h, _f, t) => MD.cabinetMarks(h, t) },
  { key: 'cupboard2', label: 'cupboard ×2', title: 'two-door front: vertical seams (coarse) on the chosen face', make: (h, f, t) => MD.cupboardMarks(h, f, 2, t) },
  { key: 'cupboard4', label: 'cupboard ×4', title: 'four doors', make: (h, f, t) => MD.cupboardMarks(h, f, 4, t) },
  { key: 'binder', label: 'binder', title: 'white spine labels on ±z', make: (h, _f, t) => MD.binderMarks(h, t) },
  { key: 'bookRun', label: 'book run', title: 'a block of spines: vertical seams + a label band on the chosen face', make: (h, f, t) => MD.bookRunMarks(h, f, t) },
  { key: 'paper', label: 'paper (text)', title: 'grey text bars on the top face', make: (h, _f, t) => MD.paperMarks(h, 3, false, t) },
  { key: 'paperSigned', label: 'paper (signed)', title: 'a signature scribble + underline on the top face', make: (h, _f, t) => MD.paperMarks(h, 5, true, t) },
  { key: 'sheet', label: 'pinned sheet', title: 'text bars on the chosen face', make: (h, f, t) => MD.sheetMarks(h, f, 7, MD.MK.textGrey, t) },
  { key: 'whiteboard', label: 'whiteboard', title: 'marker blocks in blue / red + a green scribble on the chosen face', make: (h, f, t) => MD.whiteboardMarks(h, f, t) },
  { key: 'keypad', label: 'keypad', title: '3 × 4 light keys on a dark plate (fine) on the chosen face', make: (h, f, t) => MD.keypadMarks(h, f, t) },
  { key: 'extinguisher', label: 'extinguisher', title: 'label band with instruction lines on the chosen face', make: (h, f, t) => MD.extinguisherMarks(h, f, t) },
  { key: 'extinguisherBox', label: 'ext. cabinet', title: 'hollow pictogram square + handle slot on the chosen face', make: (h, f, t) => MD.extinguisherBoxMarks(h, f, t) },
  { key: 'agentCylinder', label: 'agent cylinder', title: 'tall label band + lines (+z)', make: (h, _f, t) => MD.agentCylinderMarks(h, t) },
  { key: 'rack', label: 'server rack', title: 'vent grid on the door + three LED rows (fine, emissive) on +z', make: (h, _f, t) => MD.rackMarks(h, [{ v: 0.4, amber: false }, { v: 0.62, amber: true }, { v: 0.84, amber: false }], t) },
  { key: 'doorLeaf', label: 'door leaf', title: 'kick plates both faces + a push plate by the latch (+z)', make: (h, _f, t) => MD.doorLeafMarks(h, t) },
  { key: 'clock', label: 'wall clock', title: 'light face + two hands (fine) on the chosen face', make: (_h, f, t) => MD.clockMarks(f, false, t) },
  { key: 'firstAid', label: 'first aid', title: 'the green cross (fine) on the chosen face', make: (_h, f, t) => MD.firstAidMarks(f, t) },
  { key: 'palletDeck', label: 'pallet deck', title: 'five deck boards along z on the top (coarse)', make: (h, _f, t) => MD.palletDeckMarks(h, t) },
  { key: 'dispenser', label: 'vending dispenser', title: 'black back wall + flap bar (+z, coarse)', make: (h, _f, t) => MD.dispenserMarks(h, t) },
  { key: 'vendingRed', label: 'vending front (red)', title: 'the backlit red field + ribbon + control column (+z, coarse, EMISSIVE: one chroma, flux by construction)', make: (h, _f, t) => MD.vendingRedMarks(h, 1, t) },
  { key: 'vendingBlue', label: 'vending front (blue)', title: 'the blue field + roundel + column + brand band', make: (h, _f, t) => MD.vendingBlueMarks(h, 1, t) },
  { key: 'lobbySign', label: 'lobby sign', title: 'the company mark + two name lines (+z, h 0.9 × 0.4)', make: (_h, _f, t) => MD.lobbySignMarks(t) },
  { key: 'placard', label: 'placard', title: 'wayfinding bar + square, mirrored on the back (±z, h 0.5 × 0.13)', make: (_h, _f, t) => MD.placardMarks(t) },
];
/** apply a kind recipe to a box (REPLACES its markings); markings the box's faces cannot take are dropped and named in the returned note */
export function markingApplyRecipe(ed: Editor, boxId: string, key: string, face: MarkFace = '+z'): { applied: number; dropped: string[] } {
  const R = KIND_RECIPES.find(r => r.key === key); if (!R) throw new Error(`recipe: one of ${KIND_RECIPES.map(r => r.key).join(' ')}`);
  const b = box(ed, boxId); const made = R.make([b.h[0], b.h[1], b.h[2]], face, markTexelOf(ed));
  const keep: MarkingDef[] = [], dropped: string[] = [];
  for (const m of made) { const errs = markingProblems(ed, b, m); if (errs.length || keep.length >= MAX_MARKS_PER_BOX) dropped.push(`${m.face} ${m.size.join('×')}: ${errs[0] ?? 'over the per-box cap'}`); else keep.push(m); }
  if (!keep.length) throw new Error(`recipe ${key} fits nothing on ${boxId} (h ${b.h.map(x => x.toFixed(3)).join(' ')}): ${dropped.join(' · ')}`);
  markingSetAll(ed, boxId, keep, `${R.label} markings on ${boxId}`);
  return { applied: keep.length, dropped };
}

// ---- ASCII round trip (the level file's / markingDefaults.ts' own notation: rows top first, '.' transparent, 'a' 'b' 'c' the palette)
export function markingAscii(ed: Editor, boxId: string, i: number): string[] { const m = (box(ed, boxId).markings ?? [])[i]; if (!m) throw new Error(`box ${boxId} has no marking ${i}`); return m.cells.slice(); }
/** the rows as a paste-able TypeScript array literal (markingDefaults.ts ART_* style) */
export function asciiLiteral(rows: readonly string[], name = 'ART'): string { return `const ${name} = [\n${rows.map(r => `  '${r}',`).join('\n')}\n];`; }
/** rows out of pasted text: a JS / JSON array literal, or plain lines — quotes, commas, brackets and blanks stripped, anything not '.abc' refused */
export function parseAscii(text: string): string[] {
  const rows: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, '');                                    // a trailing comment
    const quoted = [...line.matchAll(/['"`]([.abc]+)['"`]/g)];                     // 'a.b.',  ← a literal's row (or several on one line)
    if (quoted.length) { for (const q of quoted) rows.push(q[1]); continue; }
    if (/^\s*(const|let|var|export|return)\b/.test(line)) continue;                // the declaration's own line (its rows, if any on it, were quoted)
    const bare = line.replace(/[\s,;\[\]()=]/g, '');                               // plain rows (whitespace / commas / brackets tolerated)
    if (!bare) continue;
    if (!/^[.abc]+$/.test(bare)) throw new Error(`not a row of '.abc' cells: '${raw.trim().slice(0, 40)}'`);
    rows.push(bare);
  }
  if (!rows.length) throw new Error("no rows of '.abc' cells in the pasted text");
  const W = Math.max(...rows.map(r => r.length)); if (W > MAX_CELLS_W || rows.length > MAX_CELLS_H) throw new Error(`the art is ${W} × ${rows.length}; the most a marking holds is ${MAX_CELLS_W} × ${MAX_CELLS_H}`);
  return rows.map(r => r + '.'.repeat(W - r.length));
}
/** replace marking i's cells (and size) with ASCII rows; palette entries the art names beyond the palette are added; refused if the new size leaves the face */
export function markingFromAscii(ed: Editor, boxId: string, i: number, rowsOrText: readonly string[] | string) {
  const rows = typeof rowsOrText === 'string' ? parseAscii(rowsOrText) : parseAscii(rowsOrText.join('\n'));
  withMarking(ed, boxId, i, (m, b) => {
    const W = rows[0].length, H = rows.length; const L = faceLattice(b.h, m.face, m.res ?? 'base', markTexelOf(ed));
    if (W > L.maxW || H > L.maxH) throw new Error(`art ${W} × ${H} does not fit face ${m.face} of ${boxId} at ${m.res ?? 'base'} (${L.maxW} × ${L.maxH} cells) — pick a finer res or a bigger face`);
    const cl = clampToFace(L, m.at, [W, H]); let maxE = 0; for (const r of rows) for (const ch of r) maxE = Math.max(maxE, CELL_CHARS.indexOf(ch));
    const pal = m.pal.map(p => clonePlain(p)); while (pal.length < maxE) pal.push({ mul: pal.length === 1 ? 0.4 : 0.75 });
    return { ...m, at: cl.at, size: [W, H], pal, cells: rows.slice() };
  }, `ascii art into marking ${i} of ${boxId}`);
}

// ---- copy / paste / apply to a pattern
let clip: { marking: MarkingDef; from: string; h: Vec3 } | null = null;
export function markingCopy(ed: Editor, boxId: string, i: number): MarkingDef { const b = box(ed, boxId); const m = (b.markings ?? [])[i]; if (!m) throw new Error(`box ${boxId} has no marking ${i}`); clip = { marking: clonePlain(m), from: boxId, h: [b.h[0], b.h[1], b.h[2]] }; return clonePlain(m); }
export const markingClipboard = () => clip ? { ...clip, marking: clonePlain(clip.marking) } : null;
/** Paste the copied marking onto every target box's SAME face: at the same lattice spot if it fits, else clamped onto the face; a target whose face is too small,
 *  or which already carries the cap, is skipped and named. Existing markings the pasted rect overlaps on that face are replaced. One command; returns the tally. */
export function markingPaste(ed: Editor, targetIds: string[], src: MarkingDef | null = clip?.marking ?? null): { pasted: string[]; skipped: string[] } {
  if (!src) throw new Error('nothing copied (marking.copy first)');
  const pasted: string[] = [], skipped: string[] = [];
  ed.doc.transact(`paste marking onto ${targetIds.length} box(es)`, () => {
    for (const id of targetIds) {
      const b = ed.doc.get<BoxData>('boxes', id); if (!b) { skipped.push(`${id}: no such box`); continue; } if (b.rot) { skipped.push(`${id}: tilted`); continue; }
      const L = faceLattice(b.h, src.face, src.res ?? 'base', markTexelOf(ed));
      if (src.size[0] > L.maxW || src.size[1] > L.maxH) { skipped.push(`${id}: face ${src.face} takes ${L.maxW}×${L.maxH}, the art is ${src.size[0]}×${src.size[1]}`); continue; }
      const cl = clampToFace(L, src.at, src.size); const m = marking({ ...clonePlain(src), at: cl.at, size: cl.size });
      const overl = (o: MarkingDef) => o.face === m.face && (o.res ?? 'base') === (m.res ?? 'base') && o.at[0] < m.at[0] + m.size[0] && m.at[0] < o.at[0] + o.size[0] && o.at[1] < m.at[1] + m.size[1] && m.at[1] < o.at[1] + o.size[1];
      const list = (b.markings ?? []).filter(o => !overl(o)).map(o => clonePlain(o));
      if (list.length >= MAX_MARKS_PER_BOX) { skipped.push(`${id}: already carries ${MAX_MARKS_PER_BOX} markings`); continue; }
      list.push(m); writeMarkings(ed, id, list, `paste marking onto ${id}`); pasted.push(id);
    }
  });
  return { pasted, skipped };
}
/** the boxes a pattern names: a case-insensitive regular expression tested against each box's id, name and group; `sameSize` = only boxes whose h matches the source's within a millimetre (what 'per kind' means for cartons) */
export function boxesMatching(ed: Editor, pattern: string, opts: { sameSizeAs?: readonly number[]; exclude?: string } = {}): string[] {
  let re: RegExp; try { re = new RegExp(pattern, 'i'); } catch { throw new Error(`pattern '${pattern}' is not a regular expression`); }
  const hs = opts.sameSizeAs;
  return ed.data.boxes.filter(b => b.id !== opts.exclude && (re.test(b.id) || (b.name !== undefined && re.test(b.name)) || (b.group !== undefined && re.test(b.group))) && (!hs || (Math.abs(b.h[0] - hs[0]) < 1e-3 && Math.abs(b.h[1] - hs[1]) < 1e-3 && Math.abs(b.h[2] - hs[2]) < 1e-3))).map(b => b.id);
}
export function markingApplyToPattern(ed: Editor, boxId: string, i: number, pattern: string, opts: { sameSize?: boolean } = {}): { pasted: string[]; skipped: string[]; matched: number } {
  const src = markingCopy(ed, boxId, i); const b = box(ed, boxId);
  const targets = boxesMatching(ed, pattern, { sameSizeAs: opts.sameSize ? b.h : undefined, exclude: boxId });
  const r = targets.length ? markingPaste(ed, targets, src) : { pasted: [], skipped: [] };
  return { ...r, matched: targets.length };
}

// ---- stats for the UI: coverage, resolved albedos, mean emission → the light game.ts would register (radiance × area)
export function markingSummary(ed: Editor, boxId: string, i: number): { stats: ReturnType<typeof markStats>; lightI0: number; base: Vec3 } {
  const b = box(ed, boxId); const m = (b.markings ?? [])[i]; if (!m) throw new Error(`box ${boxId} has no marking ${i}`);
  const base = resolvedFinish(ed, b).albedo; const st = markStats(m, base, markTexelOf(ed)); const maxc = Math.max(st.meanL[0], st.meanL[1], st.meanL[2]);
  return { stats: st, lightI0: maxc * st.area, base };
}
export { MARK_FACES, MARK_RES, RES_K, MAX_MARKS_PER_BOX, MAX_CELLS_W, MAX_CELLS_H, MAX_PAL, CELL_CHARS, GLYPH_NAMES, resolveAlbedo };
export type { MarkingDef, MarkPal, MarkFace, MarkRes };
