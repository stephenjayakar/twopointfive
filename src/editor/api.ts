// window.__ed — the programmatic mirror of the editor: everything the mouse and the panels can do, as plain functions over the SAME command
// stack (so a scripted edit undoes like a hand edit), for headless lanes that author levels and shoot frames without a person at the mouse.
// docs/level-format.md 'Editor' has the table. Every mutator returns something useful (an id, the new refs); every getter returns copies.
import type { Vec3 } from '../math/vec';
import type { LevelData, FlagName } from '../scene/levelData';
import { levelDataDigest, validateLevelData } from '../scene/levelData';
import { clonePlain } from './doc';
import { Editor, parseRef } from './editor';
import type { Tools, ToolName, GizmoMode } from './tools';
import type { View, CamState } from './view';
import type { Scene } from './scene';
import { formatLint } from './lint';
import { BOX_PRESETS, LIGHT_PRESETS, doorFrameBoxes, cutOpeningPlan } from './geom';
import * as persist from './persist';
import * as P from './paint';

export interface ApiHost {
  ed: Editor; tools: Tools; view: View; scene: Scene;
  /** advance n frames (the page steps its loop; headless: sync + camera only) */
  step: (n: number, dt?: number) => void;
  shot?: (name: string, quality?: number) => Promise<string>;
  quality?: (name?: string) => string;
  play?: () => string;
  /** the inspector's tabs (the page's Ui; absent headless): show one, read which is up, point the Markings tab at a box / marking / face */
  ui?: { tab: (name?: 'props' | 'materials' | 'markings') => string; paint: (name?: string) => string | null; marking: (boxId?: string, i?: number, face?: string) => unknown; entry: (e?: number) => number };
}

export function makeApi(H: ApiHost) {
  const { ed, tools, view, scene } = H;
  const ids = (refs: string | string[]) => (Array.isArray(refs) ? refs : [refs]);
  const boxRefs = (x: string | string[]) => ids(x).map(r => r.includes(':') ? r : `box:${r}`);
  const api = {
    help: 'window.__ed — see docs/level-format.md "Editor". Try: __ed.box.add({preset:"crate", c:[10,0,18]}), __ed.select("box:box_0100"), __ed.move(["box:box_0100"],[1,0,0]), __ed.undo(), __ed.lint().summary, __ed.serialize()',
    get editor() { return ed; }, get data(): LevelData { return ed.data; },
    /** a deep copy of the document (safe to keep) */
    snapshot: (): LevelData => clonePlain(ed.data),
    digest: () => ed.doc.digest(), rev: () => ed.doc.rev, get dirty() { return ed.doc.dirty; },
    serialize: () => ed.serialize(),
    load: (src: string | LevelData, opts: { lenient?: boolean } = {}) => { const errors = ed.load(src, { lenient: opts.lenient }); return { name: ed.data.name, digest: ed.doc.digest(), boxes: ed.data.boxes.length, errors }; },   // (lenient: open a document that has problems, listing them — the restore paths' mode)
    blank: (name?: string) => { ed.load(Editor.blank(name, ed.data.materials)); return ed.data.name; },
    validate: () => ed.validate(),
    lint: () => { const r = ed.lint(); return { ...r, summary: formatLint(r)[0], lines: formatLint(r) }; },
    roundTrip: () => ed.roundTripDiffs(),
    undo: () => ed.undo(), redo: () => ed.redo(), history: () => ed.doc.history(), seal: () => ed.doc.seal(),
    // ---- selection
    select: (refs: string | string[] | null, mode?: 'replace' | 'add' | 'toggle' | 'remove') => { ed.select(refs === null ? null : boxRefs(refs), mode); return ed.selection(); },
    selection: () => ed.selection(),
    exists: (ref: string) => ed.exists(ref),
    posOf: (ref: string) => ed.posOf(ref),
    // ---- generic verbs over refs
    move: (refs: string | string[], d: Vec3) => { ed.move(boxRefs(refs), d); return boxRefs(refs).map(r => ed.posOf(r)); },
    rotate: (refs: string | string[], dyaw: number, opts?: { snapDeg?: number; pivot?: Vec3 }) => ed.rotate(boxRefs(refs), dyaw, opts),
    duplicate: (refs: string | string[], off?: Vec3) => ed.duplicate(boxRefs(refs), off),
    delete: (refs: string | string[]) => { ed.delete(boxRefs(refs)); return true; },
    rename: (ref: string, newId: string) => { ed.rename(ref, newId); return newId; },
    nudge: (refs: string | string[], dx: number, dz: number, dy = 0) => ed.nudge(boxRefs(refs), dx, dz, dy),
    // ---- boxes
    box: {
      presets: () => BOX_PRESETS.map(p => ({ key: p.key, label: p.label, title: p.title })),
      add: (spec: Parameters<Editor['addBox']>[0] = {}) => ed.addBox(spec),
      /** draw a preset footprint from corner a to corner b (what B + drag does) */
      draw: (preset: string, a: Vec3, b: Vec3) => ed.addBox({ preset, ...(() => { const s = ed.boxFromPreset(preset, a, b); return { c: s.c as Vec3, h: s.h as Vec3 }; })() }),
      get: (id: string) => clonePlain(ed.doc.get('boxes', id)),
      update: (id: string, patch: any) => { ed.updateBox(id, patch); return clonePlain(ed.doc.get('boxes', id)); },
      move: (idOrIds: string | string[], d: Vec3) => ed.move(ids(idOrIds).map(i => `box:${i}`), d),
      resize: (id: string, face: 0 | 1 | 2 | 3 | 4 | 5 | '+x' | '-x' | '+y' | '-y' | '+z' | '-z', delta: number) => { const f = typeof face === 'number' ? face : (['+x', '-x', '+y', '-y', '+z', '-z'].indexOf(face) as 0); ed.resizeBox(id, f as 0, delta); return clonePlain(ed.doc.get('boxes', id)); },
      size: (id: string, size: Vec3) => { ed.setBoxSize(id, size); return clonePlain(ed.doc.get('boxes', id)); },
      rotate: (idOrIds: string | string[], dyaw: number, opts?: { snapDeg?: number }) => ed.rotate(ids(idOrIds).map(i => `box:${i}`), dyaw, opts),
      duplicate: (idOrIds: string | string[], off?: Vec3) => ed.duplicate(ids(idOrIds).map(i => `box:${i}`), off).map(r => parseRef(r).id),
      delete: (idOrIds: string | string[]) => ed.delete(ids(idOrIds).map(i => `box:${i}`)),
      flags: (idOrIds: string | string[], flag: FlagName, on: boolean) => ed.setBoxFlags(ids(idOrIds), flag, on),
      paint: (idOrIds: string | string[], material: string | Vec3) => ed.setBoxMaterial(ids(idOrIds), material),
      /** per-box finish overrides: { albedo } goes inline keeping the look, { rough }, { metal } (null values drop that override); `null` clears rough + metal */
      override: (idOrIds: string | string[], patch: { albedo?: Vec3; rough?: number | null; metal?: boolean | null } | null) => { P.boxOverride(ed, ids(idOrIds), patch); return ids(idOrIds).map(i => clonePlain(ed.doc.get('boxes', i))); },
      /** one-click finishes on boxes: stone / lino / metal / screen / laminate / wood / matte / unset */
      finish: (idOrIds: string | string[], presetKey: string) => P.boxFinishPreset(ed, ids(idOrIds), presetKey),
      /** the RESOLVED look of a box (its paint's albedo / finish with its own overrides applied — what loadLevel builds) */
      look: (id: string) => { const b = ed.doc.get<any>('boxes', id); return b ? P.resolvedFinish(ed, b) : null; },
      /** ids of boxes whose id / name / group match a regular expression (optionally the same size as box `sameSizeAs`) */
      matching: (pattern: string, opts?: { sameSizeAs?: string }) => P.boxesMatching(ed, pattern, { sameSizeAs: opts?.sameSizeAs ? ed.doc.get<any>('boxes', opts.sameSizeAs)?.h : undefined }),
      byGroup: (group: string) => ed.data.boxes.filter(b => b.group === group).map(b => b.id),
      count: () => ed.data.boxes.length,
    },
    // ---- lights / switchables
    light: {
      presets: () => LIGHT_PRESETS.map(p => ({ key: p.key, label: p.label, title: p.title })),
      add: (spec: Parameters<Editor['addLight']>[0] = {}) => ed.addLight(spec),
      get: (id: string) => clonePlain(ed.doc.get('lights', id)),
      update: (id: string, patch: any) => { ed.updateLight(id, patch); return clonePlain(ed.doc.get('lights', id)); },
      aim: (id: string, target: Vec3) => { ed.aimLight(id, target); return clonePlain(ed.doc.get<any>('lights', id)?.dir); },
      move: (id: string, d: Vec3) => ed.move([`light:${id}`], d),
      delete: (id: string) => ed.delete([`light:${id}`]),
      list: () => ed.data.lights.map(l => l.id),
    },
    switchable: {
      make: (boxIds: string | string[], spec?: any) => ed.makeSwitchable(ids(boxIds), spec),
      get: (id: string) => clonePlain(ed.doc.get('switchables', id)),
      update: (id: string, patch: any) => { ed.updateSwitchable(id, patch); return clonePlain(ed.doc.get('switchables', id)); },
      of: (boxId: string) => clonePlain(ed.switchableOf(boxId)),
      delete: (id: string) => ed.delete([`sw:${id}`]),
      list: () => ed.data.switchables.map(s => s.id),
    },
    // ---- doors
    door: {
      add: (spec: Parameters<Editor['addDoor']>[0] = {}, opts?: { frame?: boolean; cut?: boolean }) => ed.addDoor(spec, opts),
      get: (id: string) => clonePlain(ed.doc.get('doors', id)),
      update: (id: string, patch: any) => { ed.updateDoor(id, patch); return clonePlain(ed.doc.get('doors', id)); },
      makeFrame: (id: string, opts?: { t?: number }) => ed.makeFrame(id, opts),
      cutOpening: (id: string) => ed.cutOpening(id),
      obstructions: (id: string) => ed.doorwayObstructions(id),
      /** what makeFrame / cutOpening WOULD do, without doing it */
      framePlan: (id: string) => { const d = ed.doc.get<any>('doors', id); return d ? { frame: doorFrameBoxes(d), cut: cutOpeningPlan(ed.data, d) } : null; },
      frameBoxes: (id: string) => ed.data.boxes.filter(b => b.group === `doorframe.${id}`).map(b => b.id),
      delete: (id: string) => ed.delete([`door:${id}`]),
      list: () => ed.data.doors.map(d => d.id),
    },
    // ---- routes
    route: {
      add: (spec: Parameters<Editor['addRoute']>[0] = {}) => ed.addRoute(spec),
      /** the P tool, scripted: points clicked in order then Enter */
      draw: (points: Vec3[]) => { tools.setTool('route'); tools.routeDraft = points.map(p => [p[0], 0, p[2]] as Vec3); return tools.finishRoute(); },
      get: (id: string) => clonePlain(ed.doc.get('routes', id)),
      update: (id: string, patch: any) => { ed.updateRoute(id, patch); return clonePlain(ed.doc.get('routes', id)); },
      movePoint: (id: string, i: number, pos: Vec3) => ed.movePoint(id, i, pos),
      insertPoint: (id: string, i: number, pos: Vec3, wait?: number) => ed.insertPoint(id, i, pos, wait),
      removePoint: (id: string, i: number) => ed.removePoint(id, i),
      setWait: (id: string, i: number, secs: number) => ed.updateRoute(id, r => ({ ...r, wait: r.wait.map((w, k) => k === i ? Math.max(0, secs) : w) })),
      reverse: (id: string) => ed.updateRoute(id, r => ({ ...r, points: [...r.points].reverse(), wait: [...r.wait].reverse() }), { label: `reverse ${id}` }),
      delete: (id: string) => ed.delete([`route:${id}`]),
      list: () => ed.data.routes.map(r => r.id),
    },
    // ---- volumes / props / posts / marks / floors / materials / level
    volume: {
      add: (spec: Parameters<Editor['addVolume']>[0] = {}) => ed.addVolume(spec),
      get: (id: string) => clonePlain(ed.doc.get('volumes', id)),
      update: (id: string, patch: any) => { ed.updateVolume(id, patch); return clonePlain(ed.doc.get('volumes', id)); },
      delete: (id: string) => ed.delete([`volume:${id}`]), list: () => ed.data.volumes.map(v => v.id),
    },
    prop: {
      get: (id: string) => clonePlain(ed.doc.get('props', id)),
      move: (id: string, x: number, z: number, yaw?: number) => ed.updateProp(id, p => ({ ...p, x, z, ...(yaw !== undefined ? { yaw } : {}) })),
      update: (id: string, patch: any) => { ed.updateProp(id, patch); return clonePlain(ed.doc.get('props', id)); },
      delete: (id: string) => ed.delete([`prop:${id}`]), list: () => ed.data.props.map(p => p.id),
    },
    chokepoint: { add: (spec?: any) => ed.addChokepoint(spec), update: (id: string, patch: any) => ed.doc.update('chokepoints', id, patch), delete: (id: string) => ed.delete([`chokepoint:${id}`]), list: () => ed.data.chokepoints.map(c => c.id) },
    mark: {
      spawn: (pos?: Vec3) => { if (pos) ed.setSpawn(pos); return clonePlain(ed.data.mission.playerSpawn); },
      objective: (id: string, patch?: any) => { if (patch) ed.updateObjective(id, patch); return clonePlain(ed.data.mission.objectives.find(o => o.id === id) ?? null); },
      move: (ref: string, d: Vec3) => ed.move([ref.startsWith('mark:') ? ref : `mark:${ref}`], d),
      list: () => ['mark:spawn', ...ed.data.mission.objectives.map(o => `mark:${o.id}`)],
    },
    // ---- devices (game/devices.ts): cameras / keypads / laser tripwires
    device: {
      /** add({kind:'camera', pos, yaw, pitch, fovDeg, range, sweep, sweepPeriod, mains, group}) · add({kind:'keypad', door | pos, code}) (locks the door on the pad's own lock) · add({kind:'laser', from, to, alarm, mains}) — floor points are lifted to the default heights */
      add: (spec: Parameters<Editor['addDevice']>[0]) => ed.addDevice(spec),
      get: (id: string) => clonePlain(ed.doc.get('devices', id)),
      update: (id: string, patch: any) => { ed.updateDevice(id, patch); return clonePlain(ed.doc.get('devices', id)); },
      move: (idOrIds: string | string[], d: Vec3) => ed.move(ids(idOrIds).map(i => `device:${i}`), d),
      rotate: (idOrIds: string | string[], dyaw: number, opts?: { snapDeg?: number; pivot?: Vec3 }) => ed.rotate(ids(idOrIds).map(i => `device:${i}`), dyaw, opts),
      /** point a camera's lens at a world position (yaw + pitch; a sweep re-centres) */
      aim: (id: string, target: Vec3) => { ed.aimCamera(id, target); const v: any = ed.doc.get('devices', id); return v ? { yaw: v.yaw, pitch: v.pitch } : null; },
      /** move one end of a beam: end 0 = emitter (from), 1 = receiver (to) */
      end: (id: string, end: 0 | 1, pos: Vec3) => { ed.moveLaserEnd(id, end, pos); return clonePlain(ed.doc.get('devices', id)); },
      duplicate: (idOrIds: string | string[], off?: Vec3) => ed.duplicate(ids(idOrIds).map(i => `device:${i}`), off).map(r => parseRef(r).id),
      delete: (idOrIds: string | string[]) => ed.delete(ids(idOrIds).map(i => `device:${i}`)),
      list: (kind?: 'camera' | 'keypad' | 'laser') => ed.data.devices.filter(v => !kind || v.kind === kind).map(v => v.id),
      /** the keypad on a door, if any */
      ofDoor: (doorId: string) => clonePlain(ed.data.devices.find(v => v.kind === 'keypad' && v.door === doorId) ?? null),
    },
    connector: { list: () => ed.data.connectors.map(c => c.id), note: 'connectors (stairs between floors) are typed stubs until lane G2' },
    floor: (id?: string) => { if (id !== undefined) ed.setFloor(id); return clonePlain(ed.floor()); },
    floors: { list: () => clonePlain(ed.data.floors), add: (spec?: any) => ed.addFloor(spec), update: (id: string, patch: any) => ed.updateFloor(id, patch), delete: (id: string) => ed.delete([`floor:${id}`]) },
    /** the paint palette (paint.ts): every call one undo step; edits are LIVE on every box using the paint */
    material: {
      /** name → record, in the palette's authored order (a copy) */
      list: () => clonePlain(ed.data.materials),
      /** the palette with usage counts: [{ name, albedo, rough?, metal?, notes?, boxes, parts }] */
      table: () => P.materialList(ed),
      get: (name: string) => { const m = ed.data.materials[name]; return m ? { name, ...clonePlain(m), users: P.materialUsers(ed, name), trace: P.traceHint(m.rough) } : null; },
      /** set(name, { albedo?, rough? (null = unset → matte), metal?, notes? }) on an existing paint — or set(name, [r,g,b], notes?) which also CREATES (the old signature) */
      set: (name: string, patchOrAlbedo: Vec3 | { albedo?: Vec3; rough?: number | null; metal?: boolean; notes?: string | null }, notes?: string) => { if (Array.isArray(patchOrAlbedo)) ed.setMaterial(name, patchOrAlbedo, notes); else P.materialSet(ed, name, patchOrAlbedo); return clonePlain(ed.data.materials[name]); },
      create: (name: string, init?: { albedo?: Vec3; rough?: number; metal?: boolean; notes?: string }, opts?: { after?: string }) => P.materialCreate(ed, name, init, opts),
      duplicate: (name: string, newName?: string) => P.materialDuplicate(ed, name, newName),
      rename: (oldName: string, newName: string) => { P.materialRename(ed, oldName, newName); return newName; },
      /** refused while boxes / parts use it — unless { repaintTo } moves them to another paint first */
      remove: (name: string, opts?: { repaintTo?: string }) => { ed.removeMaterial(name, opts); return true; },
      users: (name: string) => P.materialUsers(ed, name),
      /** one-click finish: stone 0.15 · lino 0.22 · metal 0.28+metal · screen 0.08 · laminate 0.5 · wood 0.55 · matte 0.85 · unset */
      preset: (name: string, presetKey: string) => { P.materialPreset(ed, name, presetKey); return clonePlain(ed.data.materials[name]); },
      presets: () => P.FINISH_PRESETS.map(p => ({ ...p })),
      /** a new paint from the box's resolved look, the boxes painted with it */
      fromSelection: (boxIds?: string | string[], name?: string) => P.materialFromSelection(ed, boxIds ? ids(boxIds) : ed.selected('box').map(r => r.id), name),
      selectUsers: (name: string) => { const u = P.materialUsers(ed, name); ed.select([...u.boxes.map(b => `box:${b}`), ...u.props.map(p => `prop:${p}`)]); return ed.selection().length; },
      /** which reflection tiers trace a roughness (ultra ≤ 0.55 · high ≤ 0.45 · medium ≤ 0.35) */
      traceHint: (rough?: number) => P.traceHint(rough),
    },
    /** MARKINGS on a box's faces (paint.ts; scene/markings.ts is the format): every call one undo step, live in the view. (x, y) = (column from the left, row from the TOP) */
    marking: {
      list: (boxId: string) => P.markingList(ed, boxId),
      get: (boxId: string, i: number) => clonePlain((ed.doc.get<any>('boxes', boxId)?.markings ?? [])[i] ?? null),
      /** the lattice a face offers at a res: cell size, the cell range inside the face, the largest bitmap (≤ 32 × 32) */
      face: (boxId: string, face: P.MarkFace, res?: P.MarkRes) => { const b = ed.doc.get<any>('boxes', boxId); return b ? P.faceLattice(b.h, face, res, P.markTexelOf(ed)) : null; },
      /** add({ face, res, size [W,H], at [U,V] | anchor 'centre'|'bl'|…, pal, cells }) → index */
      add: (boxId: string, spec?: P.MarkingSpec) => P.markingAdd(ed, boxId, spec),
      update: (boxId: string, i: number, patch: P.MarkingSpec) => { P.markingUpdate(ed, boxId, i, patch); return clonePlain(ed.doc.get<any>('boxes', boxId).markings[i]); },
      remove: (boxId: string, i: number) => { P.markingRemove(ed, boxId, i); return P.markingList(ed, boxId).length; },
      duplicate: (boxId: string, i: number) => P.markingDuplicate(ed, boxId, i),
      setAll: (boxId: string, list: P.MarkingDef[]) => P.markingSetAll(ed, boxId, list),
      paintCell: (boxId: string, i: number, x: number, y: number, entry: number) => P.markingPaintCell(ed, boxId, i, x, y, entry),
      paintCells: (boxId: string, i: number, pts: [number, number][], entry: number) => P.markingPaintCells(ed, boxId, i, pts, entry),
      /** fill(boxId, i, [x0, y0, x1, y1] inclusive, entry) */
      fill: (boxId: string, i: number, rect: [number, number, number, number], entry: number) => P.markingFill(ed, boxId, i, rect, entry),
      clear: (boxId: string, i: number) => P.markingClear(ed, boxId, i),
      mirror: (boxId: string, i: number, axis: 'h' | 'v') => P.markingMirror(ed, boxId, i, axis),
      /** shift the bitmap's cells by (dx, dy), wrapping */
      shift: (boxId: string, i: number, dx: number, dy: number) => P.markingShift(ed, boxId, i, dx, dy),
      /** move the bitmap on the face by (du, dv) lattice cells */
      nudge: (boxId: string, i: number, du: number, dv: number) => P.markingNudge(ed, boxId, i, du, dv),
      /** generate(boxId, i, 'fill'|'grid'|'seams'|'lines'|'scribble'|'dots'|'window'|'glyph'|'tape', params) INTO the bitmap — generators() lists the parameters */
      generate: (boxId: string, i: number, kind: P.GeneratorKind, params?: Record<string, number>) => { P.markingGenerate(ed, boxId, i, kind, params); return P.markingAscii(ed, boxId, i); },
      generators: () => clonePlain(P.GENERATOR_PARAMS),
      /** the per-kind recipes of scene/markingDefaults.ts (keyboard, carton, cabinet, vendingRed…): recipe(boxId, key, face?) REPLACES the box's markings */
      recipes: () => P.KIND_RECIPES.map(r => ({ key: r.key, label: r.label, title: r.title })),
      recipe: (boxId: string, key: string, face?: P.MarkFace) => P.markingApplyRecipe(ed, boxId, key, face),
      ascii: (boxId: string, i: number) => P.markingAscii(ed, boxId, i),
      /** the rows as a markingDefaults.ts-style array literal */
      literal: (boxId: string, i: number, name?: string) => P.asciiLiteral(P.markingAscii(ed, boxId, i), name),
      /** rows (or pasted text: a JS array literal / plain lines) → the bitmap (resized to the art) */
      fromAscii: (boxId: string, i: number, rows: string[] | string) => { P.markingFromAscii(ed, boxId, i, rows); return P.markingAscii(ed, boxId, i); },
      parseAscii: (text: string) => P.parseAscii(text),
      /** palette entry k: { mode 'mul'|'albedo'|'none', mul, albedo, rough (null = the box's), emitLevel (null = off), emitChroma (rewrites every emitter: one light, one colour) } */
      pal: (boxId: string, i: number, k: number, patch: Parameters<typeof P.markingSetPal>[4]) => { P.markingSetPal(ed, boxId, i, k, patch); return clonePlain(ed.doc.get<any>('boxes', boxId).markings[i].pal); },
      addPal: (boxId: string, i: number, entry?: P.MarkPal) => P.markingAddPal(ed, boxId, i, entry),
      removePal: (boxId: string, i: number, k: number) => P.markingRemovePal(ed, boxId, i, k),
      unifyChroma: (boxId: string, i: number) => P.markingUnifyChroma(ed, boxId, i),
      /** the emitters' shared chroma, per-entry levels, and whether they agree */
      emitModel: (boxId: string, i: number) => { const m = (ed.doc.get<any>('boxes', boxId)?.markings ?? [])[i]; const n = [0, 0, 0]; for (const row of (m?.cells ?? []) as string[]) for (const ch of row) { const e = ch === 'a' ? 0 : ch === 'b' ? 1 : ch === 'c' ? 2 : -1; if (e >= 0) n[e]++; } return P.emitModel(m?.pal ?? [], n); },   // (+ hues / minorityShare weighted by lit cells)
      copy: (boxId: string, i: number) => P.markingCopy(ed, boxId, i),
      /** paste the copied marking onto boxes (same face; clamped onto each face; too-small faces skipped) → { pasted, skipped } */
      paste: (targetIds: string | string[]) => P.markingPaste(ed, ids(targetIds)),
      clipboard: () => P.markingClipboard(),
      /** copy marking i of boxId onto every box whose id / name / group matches the pattern (sameSize = only boxes of the source's size) */
      applyToPattern: (boxId: string, i: number, pattern: string, opts?: { sameSize?: boolean }) => P.markingApplyToPattern(ed, boxId, i, pattern, opts),
      /** coverage fractions, resolved albedos, mean radiance, and the intensity of the light game.ts would register for it */
      summary: (boxId: string, i: number) => P.markingSummary(ed, boxId, i),
      /** boxes that carry markings (ids) */
      marked: () => ed.data.boxes.filter(b => b.markings?.length).map(b => b.id),
    },
    /** the inspector tabs (the page only): ui.tab('materials'|'markings'|'props'), ui.paint(name) selects a paint in the Materials tab, ui.marking(boxId, i, face) points the Markings tab, ui.entry(e) = the painter's active entry */
    ui: {
      tab: (name?: 'props' | 'materials' | 'markings') => H.ui ? H.ui.tab(name) : 'n/a (headless)',
      paint: (name?: string) => H.ui ? H.ui.paint(name) : null,
      marking: (boxId?: string, i?: number, face?: string) => H.ui ? H.ui.marking(boxId, i, face) : null,
      entry: (e?: number) => H.ui ? H.ui.entry(e) : -1,
    },
    level: { name: (n?: string) => { if (n !== undefined) ed.setName(n); return ed.data.name; }, meta: (patch?: any) => { if (patch) ed.setMeta(patch); return clonePlain(ed.data.meta); }, sky: (which: 'zenith' | 'horizon', rgb: Vec3) => ed.setSky(which, rgb), counts: () => ({ boxes: ed.data.boxes.length, props: ed.data.props.length, lights: ed.data.lights.length, switchables: ed.data.switchables.length, doors: ed.data.doors.length, routes: ed.data.routes.length, volumes: ed.data.volumes.length, devices: ed.data.devices.length, floors: ed.data.floors.length }) },
    // ---- view / tools / settings
    camera: (s?: Partial<CamState>) => { if (s) view.set(s); return view.get(); },
    pin: (p: CamState | null) => { view.pin(p); return !!view.cam.pin; },
    plan: (on?: boolean) => { view.togglePlan(on ?? !view.plan); return view.plan; },
    frame: () => { tools.frameSelection(); return view.get(); },
    tool: (t?: ToolName) => { if (t) tools.setTool(t); return tools.tool; },
    mode: (m?: GizmoMode) => { if (m) tools.setMode(m); return tools.mode; },
    preset: (kind: 'box' | 'light' | 'volume', key: string) => { if (kind === 'box') { ed.preset(key); tools.boxPreset = key; } else if (kind === 'light') { if (!LIGHT_PRESETS.some(p => p.key === key)) throw new Error(`light preset: ${LIGHT_PRESETS.map(p => p.key).join(' ')}`); tools.lightPreset = key; } else tools.volumeKind = key as any; return key; },
    grid: (on?: boolean, step?: number) => { if (on !== undefined) ed.set('grid', on); if (step) ed.set('gridStep', step); return { on: ed.settings.grid, step: ed.settings.gridStep }; },
    snap: (on?: boolean, step?: number) => { if (on !== undefined) ed.set('snap', on); if (step) ed.set('snapStep', step); return { on: ed.settings.snap, step: ed.settings.snapStep }; },
    day: (on?: boolean) => { if (on !== undefined) { if (on && !ed.data.daylight) throw new Error('this level has no daylight variant'); ed.set('day', on); } return ed.settings.day; },
    hidden: (on?: boolean) => { if (on !== undefined) ed.set('showHidden', on); return ed.settings.showHidden; },
    settings: () => clonePlain(ed.settings),
    quality: (name?: string) => H.quality ? H.quality(name) : 'n/a',
    // ---- frames / captures / persistence
    step: (n = 1, dt = 1 / 60) => { H.step(n, dt); return n; },
    shot: (name: string, quality?: number) => H.shot ? H.shot(name, quality) : Promise.resolve('no renderer (headless)'),
    scene: () => ({ ...scene.stats, error: scene.error, statics: scene.engine.world.statics.length, dynamics: scene.engine.world.dynamics.length, gpuLights: scene.engine.lights.lights.length }),
    pick: (mx: number, my: number) => { const { ro, rd } = view.ray(mx, my); const h = scene.pick(ro, rd); return h ? { ref: h.ref, point: h.point } : null; },
    save: {
      download: () => { persist.download(ed.data.name, ed.serialize()); ed.doc.markSaved(); return `${ed.data.name}.json`; },
      autosave: () => persist.autosave(ed),
      readAutosave: () => persist.readAutosave(),
      restoreAutosave: () => { const s = persist.readAutosave(); if (!s) return null; const errors = ed.load(s.text, { keepSaved: true, lenient: true }); return { name: s.name, t: s.t, digest: s.digest, errors }; },   // (lenient: a slot with problems opens WITH them listed — never refused and then overwritten)
      server: async (name?: string) => { const n = name ?? ed.data.name; const r = await persist.serverSave(n, ed.serialize()); ed.doc.markSaved(); return r; },
      serverList: () => persist.serverList(),
      serverLoad: async (name: string) => { const t = await persist.serverLoad(name); const allow = await persist.serverLintAllow(name); ed.load(t, { lintAllow: allow ?? undefined }); return { name: ed.data.name, digest: ed.doc.digest() }; },
      local: () => persist.stashForPlay(ed),
      keys: persist.LS,
    },
    play: () => H.play ? H.play() : persist.stashForPlay(ed),
    /** validate any LevelData-shaped value without loading it */
    check: (d: unknown) => validateLevelData(d as LevelData),
    digestOf: (d: unknown) => levelDataDigest(d as LevelData),
  };
  return api;
}
export type EditorApi = ReturnType<typeof makeApi>;
