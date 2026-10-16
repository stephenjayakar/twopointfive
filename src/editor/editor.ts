// The editor CORE: the document (doc.ts) + selection + every high-level operation the tools, the inspector and window.__ed share — add / move /
// resize / rotate / duplicate / delete for boxes, and the same verbs where they make sense for lights, switchables, doors (+ frame / opening),
// routes and their waypoints, volumes, props, chokepoints, the mission marks, floors and materials — each ONE undoable command with its reference
// clean-up (delete a box: the switchable that listed it forgets it, a light's fixture pointing at it is cleared…). No DOM, no GPU: the page
// (main.ts) and the headless probes both construct it. Everything addressed by REF strings: 'box:<id>' 'prop:<id>' 'light:<id>' 'sw:<id>'
// 'door:<id>' 'route:<id>' 'route:<id>#<i>' (a waypoint) 'volume:<id>' 'chokepoint:<id>' 'device:<id>' 'floor:<id>' 'mark:spawn' 'mark:<objective id>'.
import type { Vec3 } from '../math/vec';
import { FlagName, AUTHORED_FLAGS, LevelData, BoxData, LightData, DoorData, RouteData, VolumeData, SwitchableData, PropData, ObjectiveData, FloorData, MaterialData, DeviceData, CameraData, KeypadData, LaserData, DEVICE_DEFAULTS, parseLevelData, parseLevelDataLenient, floorUsers, serializeLevelData, structuralDiff, canonicalLevelData, LEVEL_DATA_VERSION } from '../scene/levelData';
import { Doc, Collection, clonePlain } from './doc';
import { lintLevel, idsInMessage, LintOpts, LintReport } from './lint';
import { dealtSwings } from './swing';
import type { SwingDeal } from '../game/doorswing';
import { BOX_PRESETS, LIGHT_PRESETS, BoxPreset, doorFrameBoxes, cutOpeningPlan, pushFace, Face, roundVec, round6, snapTo } from './geom';
import { materialSet, materialCreate, materialRemove, markTexelOf, faceLattice, clampToFace, fitRows } from './paint';
import { LEAF_W } from '../scene/doorSize';

export type RefKind = 'box' | 'prop' | 'light' | 'sw' | 'door' | 'route' | 'volume' | 'chokepoint' | 'device' | 'floor' | 'mark';
export interface Ref { kind: RefKind; id: string; sub?: number }
export function parseRef(r: string): Ref {
  const i = r.indexOf(':'); if (i < 0) return { kind: 'box', id: r };   // a bare id is a box id (lint reports boxes bare)
  const kind = r.slice(0, i) as RefKind; let id = r.slice(i + 1); let sub: number | undefined;
  if (kind === 'route') { const h = id.lastIndexOf('#'); if (h >= 0) { sub = parseInt(id.slice(h + 1), 10); id = id.slice(0, h); } }
  return { kind, id, sub };
}
export const refStr = (r: Ref) => `${r.kind}:${r.id}${r.sub !== undefined ? `#${r.sub}` : ''}`;
const KIND_COLL: Partial<Record<RefKind, Collection>> = { box: 'boxes', prop: 'props', light: 'lights', sw: 'switchables', door: 'doors', route: 'routes', volume: 'volumes', chokepoint: 'chokepoints', device: 'devices', floor: 'floors' };

/** WHERE THE `scenarios` BLOCK NAMES A DOOR OR A ROUTE (scene/scenarios.ts is its shape; levelData.ts validateLevelData checks the same slots): a door by its id —
 *  a room's doors and the door each mark watches, a squad's barricade doors and the door a late squad comes by, the rescue's room / side / from doors and its
 *  flow's regions and openings, a quiet spot's and exit's door, a lesson test's `door` (and `on`, beside an 'order:' deed) — and a route by the name the game
 *  knows it by (its `name`, else its id): the quiet mission's patrol sets. ONLY these slots: a string elsewhere that happens to equal an id (a room's own id, a
 *  place as a line says it) is the player's words and is never touched. Each row is the holder + key (rename writes through it on a CLONE of the block) and a
 *  few words naming the user (delete's refusal). No editor tool edits the block; rename and delete keep it true to the document. */
export function scenarioRefs(S: unknown, kind: 'door' | 'route'): { o: any; k: string | number; where: string }[] {
  const out: { o: any; k: string | number; where: string }[] = []; const B = S as any; if (!B || typeof B !== 'object') return out;
  const arr = (x: unknown): any[] => Array.isArray(x) ? x : [];
  const at = (o: any, k: string | number, where: string) => { if (o && typeof o === 'object' && typeof o[k] === 'string') out.push({ o, k, where }); };
  if (kind === 'route') { arr(B.quiet?.patrols).forEach((set, i) => arr(set).forEach((_n, j) => at(set, j, `scenarios.quiet patrol set ${i}`))); return out; }
  for (const r of arr(B.roomClear?.rooms)) { for (const x of arr(r?.doors)) at(x, 'id', `scenarios.roomClear room '${r?.id}'`); for (const m of arr(r?.marks)) at(m, 'watch', `scenarios.roomClear room '${r?.id}' (a defender's mark watches it)`); }
  for (const q of arr(B.roomClear?.squads)) { arr(q?.barricade).forEach((_n, j) => at(q.barricade, j, `scenarios.roomClear squad '${q?.id}' (barricade)`)); at(q?.arrive, 'door', `scenarios.roomClear squad '${q?.id}' (comes in by it)`); }
  const R = B.rescue; at(R?.room, 'door', 'scenarios.rescue (the hostage room\'s door)'); at(R?.side, 'door', 'scenarios.rescue (the side door)'); at(R?.side?.from, 'door', 'scenarios.rescue (the room the side door is taken from)');
  for (const g of arr(R?.flow?.regions)) at(g, 'door', `scenarios.rescue flow region '${g?.id}'`); for (const o of arr(R?.flow?.route)) at(o, 'door', `scenarios.rescue flow opening '${o?.id}'`);
  for (const p of arr(B.quiet?.spots)) at(p, 'door', `scenarios.quiet spot '${p?.place}'`); for (const x of arr(B.quiet?.exits)) at(x, 'door', `scenarios.quiet exit '${x?.name}'`);
  const test = (t: any, where: string, depth = 0): void => {   // a lesson's done-test, and the tests inside an `all` / `any`
    if (!t || typeof t !== 'object' || depth > 8) return; if (Array.isArray(t)) { for (const x of t) test(x, where, depth + 1); return; }
    at(t, 'door', where); if (typeof t.what === 'string' && t.what.startsWith('order:')) at(t, 'on', where);
    for (const v of Object.values(t)) if (v && typeof v === 'object') test(v, where, depth + 1);
  };
  for (const t of arr(B.lesson?.steps)) test(t?.done, `scenarios.lesson step '${t?.id}'`);
  return out;
}
/** one line per part of a `scenarios` block (the level sheet's read-only section and its count line: no editor tool edits the block) */
export function scenarioLines(S: unknown): string[] {
  const B = S as any; const L: string[] = []; if (!B || typeof B !== 'object') return L;
  const arr = (x: unknown): any[] => Array.isArray(x) ? x : [];
  const pt = (p: any) => Array.isArray(p) ? `(${Number(p[0]).toFixed(1)}, ${Number(p[2]).toFixed(1)})` : '(?)';
  const team = (T: any) => T ? `team start ${pt(T.sam)}${arr(T.ops).length ? ` + ${arr(T.ops).length} teammate mark(s)` : ''}` : 'team start: the breach plan\'s';
  if (B.nightBreach) L.push(`night breach · ${team(B.nightBreach.team)}${B.nightBreach.room ? ` · room '${B.nightBreach.room}'` : ''}`);
  if (B.roomClear) { const R = B.roomClear, rooms = arr(R.rooms), sq = arr(R.squads);
    L.push(`room clear '${R.name}' · ${team(R.team)} · ${rooms.length} room(s), ${rooms.reduce((n, r) => n + (r?.garrison | 0), 0)} defenders${R.maxMen ? ` (at most ${R.maxMen} at once)` : ''}`);
    for (const r of rooms) L.push(`  room ${r?.id} "${r?.name}" × ${r?.garrison} · doors ${arr(r?.doors).map(x => x?.id).join(' ')} · ${arr(r?.marks).length} mark(s)`);
    for (const q of sq) L.push(`  squad ${q?.name ?? q?.id}: ${q?.arrive ? `${q.arrive.men} men, late, by door ${q.arrive.door}` : `rooms ${arr(q?.rooms).join(' ')}`}${q?.mayLeave === false ? ' · stays home' : ''}`); }
  if (B.rescue) { const R = B.rescue;
    L.push(`rescue · ${team(R.team)} · room "${R.room?.name}" by door ${R.room?.door}${R.side ? ` + side door ${R.side.door}` : ''}`);
    L.push(`  ${arr(R.hostages).length} hostage(s) · captor · door man · ${R.cast ? `${R.cast.roamers} of ` : ''}${arr(R.roamers).length} roamer mark(s)${arr(R.guards).length ? ` · ${arr(R.guards).length} more gun(s) in the room` : ''}${R.flow ? ` · flow: ${arr(R.flow.route).length} opening(s)` : ' · no flow'}`); }
  if (B.quiet) { const Q = B.quiet;
    L.push(`quiet · takes ${Q.thing ?? 'the drive'} · ${arr(Q.starts).length} start(s) · ${arr(Q.spots).length} spot(s) · ${arr(Q.exits).length} exit(s)`);
    L.push(`  patrols: ${Q.patrols ? arr(Q.patrols).map((s: any) => `[${arr(s).join(' ')}]`).join(' ') : 'every route, every run'}`);
    L.push(`  exits by door: ${arr(Q.exits).map((x: any) => x?.door).join(' ')} · spots by door: ${arr(Q.spots).map((x: any) => x?.door).join(' ')}`); }
  if (B.lesson) L.push(`lesson "${B.lesson.title}" · ${arr(B.lesson.steps).length} step(s), laid over ${B.roomClear ? 'the room clear' : B.quiet ? 'the quiet mission' : 'the level\'s mission'}`);
  if (B.places) L.push(`places · ${arr(B.places.areas).length} named area(s)`);
  return L;
}
/** the block in a few words ('room clear (4 rooms, 3 squads) · places'); '' with no block */
export function scenarioWords(S: unknown): string {
  const B = S as any; if (!B || typeof B !== 'object') return ''; const n = (x: unknown) => Array.isArray(x) ? x.length : 0; const w: string[] = [];
  if (B.nightBreach) w.push('night breach');
  if (B.roomClear) w.push(`room clear (${n(B.roomClear.rooms)} rooms${n(B.roomClear.squads) ? `, ${n(B.roomClear.squads)} squads` : ''})`);
  if (B.rescue) w.push(`rescue (${n(B.rescue.hostages)} hostages)`);
  if (B.quiet) w.push(`quiet (${n(B.quiet.starts)} starts, ${n(B.quiet.spots)} spots, ${n(B.quiet.exits)} exits)`);
  if (B.lesson) w.push(`lesson (${n(B.lesson.steps)} steps)`); if (B.places) w.push('places');
  return w.join(' · ');
}

export interface EditorSettings {
  snap: boolean; snapStep: number; grid: boolean; gridStep: number;
  /** draw + pick boxes flagged NoPrimary (the ceiling slab, panels): off = as the game's camera sees the level */
  showHidden: boolean;
  /** the daylight variant applied (data.daylight) */
  day: boolean;
  /** rotate snaps (R with Ctrl) in degrees; nudge step = snapStep (Shift = fine) */
  rotSnapDeg: number;
}

export interface AddBoxSpec extends Partial<Omit<BoxData, 'id'>> { id?: string; preset?: string; /** full size (x, y, z) instead of half extents */ size?: Vec3; switchable?: { group?: string; on?: boolean; baseEmissive?: Vec3 } | boolean }

export class Editor {
  readonly doc: Doc;
  sel = new Set<string>();
  settings: EditorSettings = { snap: true, snapStep: 0.25, grid: true, gridStep: 1, showHidden: false, day: false, rotSnapDeg: 15 };
  /** the floor being edited (new things are created on it; the grid is drawn at its y) */
  floorId: string;
  lintOpts: LintOpts = {};
  /** the dev server's file this document was LOADED FROM, by stem ('office-t20' — levels/office-t20.json), which is where ⌘/Ctrl S writes it back; null = a
   *  document from nowhere on the server (a picked or dropped file, a blank level, an autosave slot that did not say): saving then goes by the level's name */
  file: string | null = null;
  /** UI hooks: something to say (status line), selection changed */
  onMsg: (text: string) => void = () => {};
  onSelect: (() => void)[] = [];
  onSettings: (() => void)[] = [];

  constructor(data: LevelData, opts: { lintAllow?: LintOpts['allow']; file?: string | null } = {}) {
    this.doc = new Doc(data);
    this.floorId = this.doc.data.floors[0]?.id ?? 'f0';
    if (this.doc.data.meta.grid && this.doc.data.meta.grid > 0) this.settings.snapStep = this.doc.data.meta.grid;   // the level remembers its snap (meta.grid; the Level sheet edits it)
    if (opts.lintAllow) this.lintOpts.allow = opts.lintAllow;
    this.file = opts.file ?? null;
    this.doc.onChange((_c, why) => { if (why === 'load') { this.floorId = this.doc.data.floors[0]?.id ?? 'f0'; this.setSelection([]); } else this.pruneSelection(); });
  }
  get data(): LevelData { return this.doc.data; }
  msg(t: string) { this.onMsg(t); }
  set<K extends keyof EditorSettings>(k: K, v: EditorSettings[K]) { this.settings[k] = v; for (const f of this.onSettings) f(); }
  floor(): FloorData { return this.data.floors.find(f => f.id === this.floorId) ?? this.data.floors[0]; }
  setFloor(id: string) { if (!this.data.floors.some(f => f.id === id)) throw new Error(`floor: one of ${this.data.floors.map(f => f.id).join(' ')}`); this.floorId = id; for (const f of this.onSettings) f(); }

  // ---------------------------------------------------------------- selection
  setSelection(refs: Iterable<string>) { this.sel = new Set(refs); for (const f of this.onSelect) f(); }
  select(refs: string | string[] | null, mode: 'replace' | 'add' | 'toggle' | 'remove' = 'replace') {
    const list = refs === null ? [] : Array.isArray(refs) ? refs : [refs];
    for (const r of list) if (!this.exists(r)) throw new Error(`select: no such thing '${r}'`);
    const s = mode === 'replace' ? new Set<string>() : new Set(this.sel);
    for (const r of list) { if (mode === 'toggle') { if (s.has(r)) s.delete(r); else s.add(r); } else if (mode === 'remove') s.delete(r); else s.add(r); }
    this.setSelection(s);
  }
  selection(): string[] { return [...this.sel]; }
  selected(kind: RefKind): Ref[] { return [...this.sel].map(parseRef).filter(r => r.kind === kind); }
  /** the one selected thing if exactly one is selected (the inspector's subject) */
  primary(): Ref | null { return this.sel.size === 1 ? parseRef([...this.sel][0]) : null; }
  exists(ref: string): boolean {
    const r = parseRef(ref);
    if (r.kind === 'mark') return r.id === 'spawn' || this.data.mission.objectives.some(o => o.id === r.id);
    const coll = KIND_COLL[r.kind]; if (!coll) return false;
    const i = this.doc.indexOf(coll, r.id); if (i < 0) return false;
    if (r.kind === 'route' && r.sub !== undefined) return r.sub >= 0 && r.sub < this.data.routes[i].points.length;
    return true;
  }
  private pruneSelection() { let changed = false; for (const r of [...this.sel]) if (!this.exists(r)) { this.sel.delete(r); changed = true; } if (changed) for (const f of this.onSelect) f(); }

  // ---------------------------------------------------------------- generic verbs over refs
  /** world position a ref is 'at' (its handle): box / volume centre, light pos, door hinge, route point (or its first), prop foot, mark point */
  posOf(ref: string): Vec3 | null {
    const r = parseRef(ref); const d = this.data;
    switch (r.kind) {
      case 'box': { const b = this.doc.get<BoxData>('boxes', r.id); return b ? [...b.c] as Vec3 : null; }
      case 'volume': { const v = this.doc.get<VolumeData>('volumes', r.id); return v ? [...v.c] as Vec3 : null; }
      case 'light': { const l = this.doc.get<LightData>('lights', r.id); return l ? [...l.pos] as Vec3 : null; }
      case 'prop': { const p = this.doc.get<PropData>('props', r.id); return p ? [p.x, 0, p.z] : null; }
      case 'door': { const o = this.doc.get<DoorData>('doors', r.id); return o ? [o.hinge[0], 0, o.hinge[1]] : null; }
      case 'route': { const t = this.doc.get<RouteData>('routes', r.id); if (!t) return null; const p = t.points[r.sub ?? 0]; return p ? [...p] as Vec3 : null; }
      case 'chokepoint': { const c = this.doc.get<any>('chokepoints', r.id); return c ? [...c.pos] as Vec3 : null; }
      case 'sw': { const s = this.doc.get<SwitchableData>('switchables', r.id); const b = s ? this.doc.get<BoxData>('boxes', s.boxes[0]) : null; return b ? [...b.c] as Vec3 : null; }
      case 'device': { const v = this.doc.get<any>('devices', r.id); return v ? [...(v.pos ?? v.from)] as Vec3 : null; }
      case 'floor': return null;
      case 'mark': {
        if (r.id === 'spawn') return [...d.mission.playerSpawn] as Vec3;
        const o = d.mission.objectives.find(x => x.id === r.id); if (!o) return null;
        return o.kind === 'reach' ? [(o.area.x0 + o.area.x1) / 2, 0, (o.area.z0 + o.area.z1) / 2] : o.kind === 'drive' ? [...o.front] as Vec3 : [o.x, 0, o.z];
      }
    }
  }
  /** Translate everything in `refs` by d (one command; `coalesce` for drags). Boxes / volumes / lights move in 3D, the rest on the floor. */
  move(refs: string[], dv: Vec3, opts: { coalesce?: string; label?: string } = {}) {
    if (!refs.length || (!dv[0] && !dv[1] && !dv[2])) return;
    const co = opts.coalesce; const doc = this.doc;
    doc.transact(opts.label ?? `move ${refs.length === 1 ? refs[0] : `${refs.length} things`}`, () => {
      const routesWhole = new Set(refs.map(parseRef).filter(r => r.kind === 'route' && r.sub === undefined).map(r => r.id));
      const swBoxes = new Set<string>();   // boxes moved via their switchable (don't move twice if the box itself is selected too)
      for (const ref of refs) { const r = parseRef(ref); if (r.kind === 'sw') for (const b of this.doc.get<SwitchableData>('switchables', r.id)?.boxes ?? []) swBoxes.add(b); }
      for (const ref of refs) {
        const r = parseRef(ref);
        const add3 = (p: readonly number[]): Vec3 => roundVec([p[0] + dv[0], p[1] + dv[1], p[2] + dv[2]]);
        const add2 = (p: readonly number[]): Vec3 => roundVec([p[0] + dv[0], p[1], p[2] + dv[2]]);
        switch (r.kind) {
          case 'box': if (!swBoxes.has(r.id)) doc.update<BoxData>('boxes', r.id, b => ({ ...b, c: add3(b.c) }), { coalesce: co }); break;
          case 'sw': for (const bid of this.doc.get<SwitchableData>('switchables', r.id)?.boxes ?? []) doc.update<BoxData>('boxes', bid, b => ({ ...b, c: add3(b.c) }), { coalesce: co }); break;
          case 'volume': doc.update<VolumeData>('volumes', r.id, v => ({ ...v, c: add3(v.c) }), { coalesce: co }); break;
          case 'light': doc.update<LightData>('lights', r.id, l => ({ ...l, pos: add3(l.pos) }), { coalesce: co }); break;
          case 'prop': doc.update<PropData>('props', r.id, p => ({ ...p, x: round6(p.x + dv[0]), z: round6(p.z + dv[2]) }), { coalesce: co }); break;
          case 'door': doc.update<DoorData>('doors', r.id, o => ({ ...o, hinge: [round6(o.hinge[0] + dv[0]), round6(o.hinge[1] + dv[2])] }), { coalesce: co }); break;
          case 'chokepoint': doc.update<any>('chokepoints', r.id, (c: any) => ({ ...c, pos: add2(c.pos) }), { coalesce: co }); break;
          case 'device': doc.update<any>('devices', r.id, (v: any) => v.kind === 'laser' ? { ...v, from: add3(v.from), to: add3(v.to) } : { ...v, pos: add3(v.pos) }, { coalesce: co }); break;
          case 'route':
            if (r.sub === undefined) doc.update<RouteData>('routes', r.id, t => ({ ...t, points: t.points.map(add2) }), { coalesce: co });
            else if (!routesWhole.has(r.id)) doc.update<RouteData>('routes', r.id, t => ({ ...t, points: t.points.map((p, i) => i === r.sub ? add2(p) : [...p] as Vec3) }), { coalesce: co });
            break;
          case 'mark': {
            const M = clonePlain(this.data.mission);
            if (r.id === 'spawn') M.playerSpawn = add2(M.playerSpawn);
            else M.objectives = M.objectives.map(o => o.id !== r.id ? o : o.kind === 'reach' ? { ...o, area: { x0: round6(o.area.x0 + dv[0]), x1: round6(o.area.x1 + dv[0]), z0: round6(o.area.z0 + dv[2]), z1: round6(o.area.z1 + dv[2]) } } : o.kind === 'drive' ? { ...o, front: add3(o.front) } : { ...o, x: round6(o.x + dv[0]), z: round6(o.z + dv[2]) });
            doc.setPath(['mission'], M, { coalesce: co }); break;
          }
          case 'floor': break;
        }
      }
    }, co);
    {   // most of the building moved: say what did NOT come (no ref reaches them, so no move does) — once a gesture, not once a frame of a drag
      const d = this.data, n = refs.filter(x => parseRef(x).kind === 'box').length, left = [d.scenarios ? 'the scenarios block\'s marks (team start, rooms, defenders, hostages, exits)' : '', d.civilians?.length ? `${d.civilians.length} civilian(s)` : '', d.vents?.length ? `${d.vents.length} vent(s)` : '', d.plans.roomClear.length || d.plans.breach ? 'the drill plans' : '', d.surfaces ? 'the footstep map' : ''].filter(Boolean);
      const key = co ?? `${refs.length}:${refs[0]}`;
      if (n >= 20 && n * 2 >= d.boxes.length && (dv[0] || dv[2]) && left.length && key !== this.movedSaid) { this.movedSaid = key; this.msg(`moved ${n} of ${d.boxes.length} boxes — NOT moved with them (they stay where the building was; nothing in the editor moves them): ${left.join(' · ')}`); }
    }
  }
  private movedSaid = '';
  /** Rotate boxes / volumes / props / doors / lights (their aim) by dyaw radians about +Y, each about its own centre (or about `pivot` if given, moving them). */
  rotate(refs: string[], dyaw: number, opts: { coalesce?: string; pivot?: Vec3; snapDeg?: number } = {}) {
    if (!refs.length || !dyaw) return;
    const co = opts.coalesce; const doc = this.doc; const snap = (a: number) => opts.snapDeg ? snapTo(a, opts.snapDeg * Math.PI / 180) : a;
    const about = (p: readonly number[]): Vec3 => { if (!opts.pivot) return [p[0], p[1], p[2]]; const cs = Math.cos(dyaw), sn = Math.sin(dyaw); const dx = p[0] - opts.pivot[0], dz = p[2] - opts.pivot[2]; return roundVec([opts.pivot[0] + cs * dx + sn * dz, p[1], opts.pivot[2] - sn * dx + cs * dz]); };   // (+yaw turns local +X toward −Z: the renderer's sense)
    doc.transact(`rotate ${refs.length === 1 ? refs[0] : `${refs.length} things`}`, () => {
      for (const ref of refs) {
        const r = parseRef(ref);
        switch (r.kind) {
          case 'box': doc.update<BoxData>('boxes', r.id, b => ({ ...b, c: about(b.c), yaw: round6(snap((b.yaw ?? 0) + dyaw)) || undefined }), { coalesce: co }); break;
          case 'volume': doc.update<VolumeData>('volumes', r.id, v => ({ ...v, c: about(v.c), yaw: round6(snap((v.yaw ?? 0) + dyaw)) || undefined }), { coalesce: co }); break;
          case 'prop': doc.update<PropData>('props', r.id, p => { const c = about([p.x, 0, p.z]); return { ...p, x: c[0], z: c[2], yaw: round6(snap((p.yaw ?? 0) + dyaw)) || undefined }; }, { coalesce: co }); break;
          case 'door': doc.update<DoorData>('doors', r.id, o => { const c = about([o.hinge[0], 0, o.hinge[1]]); return { ...o, hinge: [c[0], c[2]], closedDir: round6(snap(o.closedDir - dyaw)) }; }, { coalesce: co }); break;   // (closedDir is a plain atan2 angle: +yaw in the box sense is −angle here)
          case 'light': doc.update<LightData>('lights', r.id, l => { const cs = Math.cos(dyaw), sn = Math.sin(dyaw); return { ...l, pos: about(l.pos), dir: roundVec([cs * l.dir[0] + sn * l.dir[2], l.dir[1], -sn * l.dir[0] + cs * l.dir[2]]) }; }, { coalesce: co }); break;
          case 'chokepoint': doc.update<any>('chokepoints', r.id, (c: any) => ({ ...c, pos: about(c.pos), yaw: round6(snap(c.yaw + dyaw)) }), { coalesce: co }); break;
          case 'device': doc.update<DeviceData>('devices', r.id, v => {   // a camera / keypad turns its yaw (a camera's sweep goes round with it); a beam swings both ends about the pivot, or its own middle
            if (v.kind === 'laser') { const mid: Vec3 = opts.pivot ?? [(v.from[0] + v.to[0]) / 2, 0, (v.from[2] + v.to[2]) / 2]; const cs = Math.cos(dyaw), sn = Math.sin(dyaw); const turn = (p: readonly number[]): Vec3 => { const dx = p[0] - mid[0], dz = p[2] - mid[2]; return roundVec([mid[0] + cs * dx + sn * dz, p[1], mid[2] - sn * dx + cs * dz]); }; return { ...v, from: turn(v.from), to: turn(v.to) }; }
            const yaw = round6(snap(v.yaw + dyaw));
            return v.kind === 'camera' && v.sweep ? { ...v, pos: about(v.pos), yaw, sweep: [round6(v.sweep[0] + (yaw - v.yaw)), round6(v.sweep[1] + (yaw - v.yaw))] } : { ...v, pos: about(v.pos), yaw };
          }, { coalesce: co }); break;
          default: break;
        }
      }
    }, co);
  }
  /** Delete everything in refs with reference clean-up; refuses (throws, nothing changed) when something still points at a door / floor / breaker box. */
  delete(refs: string[]) {
    if (!refs.length) return;
    const d = this.data; const doc = this.doc;
    const boxIds = new Set<string>(); const props: string[] = [], lights: string[] = [], sws: string[] = [], doors: string[] = [], routes: string[] = [], volumes: string[] = [], cps: string[] = [], devices: string[] = [], floors: string[] = [];
    const points = new Map<string, number[]>();
    for (const ref of refs) {
      const r = parseRef(ref);
      if (r.kind === 'box') boxIds.add(r.id); else if (r.kind === 'prop') props.push(r.id); else if (r.kind === 'light') lights.push(r.id); else if (r.kind === 'sw') sws.push(r.id);
      else if (r.kind === 'door') doors.push(r.id); else if (r.kind === 'volume') volumes.push(r.id); else if (r.kind === 'chokepoint') cps.push(r.id); else if (r.kind === 'device') devices.push(r.id); else if (r.kind === 'floor') floors.push(r.id);
      else if (r.kind === 'route') { if (r.sub === undefined) routes.push(r.id); else points.set(r.id, [...(points.get(r.id) ?? []), r.sub]); }
      else if (r.kind === 'mark') throw new Error(`the mission marks cannot be deleted (v${LEVEL_DATA_VERSION} wants exactly one spawn / reach / drive / exfil) — move them`);
    }
    // refusals first (nothing has changed yet)
    for (const id of boxIds) { if (d.breaker.panel === id || d.breaker.led === id) throw new Error(`${id} is the breaker's ${d.breaker.panel === id ? 'panel' : 'LED'} — point the breaker at another box first`); }
    for (const id of doors) {
      const users = [...d.mission.objectives.filter(o => (o.kind === 'reach' || o.kind === 'exfil') && o.door === id).map(o => `objective '${o.id}'`), ...d.plans.roomClear.filter(p => p.door === id).map(p => `clear plan '${p.id}'`), ...(d.plans.breach?.door === id || d.plans.breach?.next?.door === id ? [`the breach plan`] : []), ...d.devices.filter(v => v.kind === 'keypad' && v.door === id && !devices.includes(v.id)).map(v => `keypad '${v.id}'`)];   // (a pad going in the same call is no user)
      const sc = this.scenarioUsers('door', id);   // (the missions' own block: a room's door, a squad's, the rescue's, a quiet spot's or exit's, a lesson's)
      if (users.length || sc.length) throw new Error(`door '${id}' is used by ${[...users, ...sc].join(', ')} — repoint them first${sc.length ? ' (the scenarios block has no editor tool: it is edited in the level\'s generator or its file)' : ''}`);
    }
    for (const id of [...routes, ...[...points].filter(([rid, is]) => !routes.includes(rid) && (this.doc.get<RouteData>('routes', rid)?.points.length ?? 0) - new Set(is).size < 1).map(([rid]) => rid)]) {   // (a route whose last point goes, goes)
      const t = this.doc.get<RouteData>('routes', id); if (!t) continue; const known = t.name ?? t.id;
      const sc = d.routes.some(x => x.id !== id && (x.name ?? x.id) === known) ? [] : this.scenarioUsers('route', known);
      if (sc.length) throw new Error(`route '${id}' is manned by ${sc.join(', ')} — take it out of the patrol sets first (the scenarios block has no editor tool: it is edited in the level's generator or its file)`);
    }
    for (const id of floors) { if (d.floors.length - floors.length < 1) throw new Error('the last floor cannot go'); const users = floorUsers(d, id).filter(u => !refs.includes(u.ref)); if (users.length) throw new Error(`floor '${id}' still has ${users.length} thing(s) on it (${users.slice(0, 4).map(u => u.ref).join(' ')}${users.length > 4 ? ' …' : ''}) — delete or move them first`); }   // (FLOOR_USERS: the one table delete, rename and lint share)
    doc.transact(`delete ${refs.length === 1 ? refs[0] : `${refs.length} things`}`, () => {
      // boxes: switchables forget them (an emptied switchable goes, and a beacon on its dome with it), fixtures are cleared
      if (boxIds.size) {
        for (const s of [...d.switchables]) { const keep = s.boxes.filter(b => !boxIds.has(b)); if (keep.length === s.boxes.length) continue; if (keep.length) doc.update<SwitchableData>('switchables', s.id, { boxes: keep }); else doc.remove('switchables', s.id); }
        for (const b of [...d.beacons]) if (boxIds.has(b.box)) doc.remove('beacons', b.id);
        for (const l of d.lights) if (l.fixture && boxIds.has(l.fixture)) doc.update<LightData>('lights', l.id, x => { const y = { ...x }; delete y.fixture; return y; });
        if (d.daylight?.sun.fixture && boxIds.has(d.daylight.sun.fixture)) { const D = clonePlain(d.daylight); delete D.sun.fixture; doc.setPath(['daylight'], D); }
        // remove from the back so indices stay valid op by op
        const idx = [...boxIds].map(id => doc.indexOf('boxes', id)).filter(i => i >= 0).sort((a, b) => b - a);
        for (const i of idx) doc.remove('boxes', d.boxes[i].id);
      }
      for (const id of sws) { doc.remove('switchables', id); for (const b of [...d.beacons]) if (!d.switchables.some(s => s.boxes.includes(b.box))) doc.remove('beacons', b.id); }
      for (const id of lights) { doc.remove('lights', id); if (d.daylight?.lightsOff.includes(id)) doc.setPath(['daylight', 'lightsOff'], d.daylight.lightsOff.filter(x => x !== id)); }
      for (const id of props) doc.remove('props', id);
      for (const id of doors) doc.remove('doors', id);
      for (const id of volumes) doc.remove('volumes', id);
      for (const id of cps) doc.remove('chokepoints', id);
      for (const id of devices) { const v = this.doc.get<DeviceData>('devices', id); doc.remove('devices', id); if (v?.kind === 'keypad' && this.doc.get<DoorData>('doors', v.door)?.lock === id) doc.update<DoorData>('doors', v.door, o => { const y = { ...o }; delete y.lock; return y; }); }   // (a keypad gone: its door keeps its bolt but goes back on the floor key — else the file would name a lock nothing opens)
      for (const id of floors) doc.remove('floors', id);
      for (const [id, is] of points) { if (routes.includes(id)) continue; const t = this.doc.get<RouteData>('routes', id); if (!t) continue; const drop = new Set(is); if (t.points.length - drop.size < 1) doc.remove('routes', id); else doc.update<RouteData>('routes', id, { points: t.points.filter((_, i) => !drop.has(i)), wait: t.wait.filter((_, i) => !drop.has(i)) }); }
      for (const id of routes) doc.remove('routes', id);
    });
    if (floors.includes(this.floorId)) this.floorId = this.data.floors[0].id;
  }
  /** Duplicate boxes / lights / doors / routes / volumes / props (+ any switchable wholly inside the set), offset by `off`; returns the new refs (selected). */
  duplicate(refs: string[], off: Vec3 = [0.5, 0, 0.5]): string[] {
    const d = this.data; const doc = this.doc; const out: string[] = [];
    const boxMap = new Map<string, string>();
    doc.transact(`duplicate ${refs.length} thing(s)`, () => {
      const boxRefs = new Set(refs.map(parseRef).filter(r => r.kind === 'box').map(r => r.id));
      for (const r of refs.map(parseRef)) if (r.kind === 'sw') for (const b of this.doc.get<SwitchableData>('switchables', r.id)?.boxes ?? []) boxRefs.add(b);
      for (const id of boxRefs) {
        const b = this.doc.get<BoxData>('boxes', id); if (!b) continue;
        const nid = this.doc.freshId('box', 'boxes'); boxMap.set(id, nid);
        const copy: BoxData = { ...clonePlain(b), id: nid, c: roundVec([b.c[0] + off[0], b.c[1] + off[1], b.c[2] + off[2]]) }; delete copy.name;   // (a name is a tag the game looks up: never two of them)
        doc.insert('boxes', copy); out.push(`box:${nid}`);
      }
      for (const s of [...d.switchables]) if (s.boxes.length && s.boxes.every(b => boxMap.has(b))) { const nid = this.uniqueId('switchables', s.id + '_copy'); doc.insert('switchables', { ...clonePlain(s), id: nid, boxes: s.boxes.map(b => boxMap.get(b)!) }); }
      for (const r of refs.map(parseRef)) {
        if (r.kind === 'light') { const l = this.doc.get<LightData>('lights', r.id); if (!l) continue; const nid = this.uniqueId('lights', r.id + '_copy'); const copy: LightData = { ...clonePlain(l), id: nid, pos: roundVec([l.pos[0] + off[0], l.pos[1] + off[1], l.pos[2] + off[2]]) }; if (copy.fixture) { if (boxMap.has(copy.fixture)) copy.fixture = boxMap.get(copy.fixture); else delete copy.fixture; } doc.insert('lights', copy); out.push(`light:${nid}`); }
        else if (r.kind === 'door') { const o = this.doc.get<DoorData>('doors', r.id); if (!o) continue; const nid = this.uniqueId('doors', r.id + '_copy'); doc.insert('doors', { ...clonePlain(o), id: nid, hinge: [round6(o.hinge[0] + off[0]), round6(o.hinge[1] + off[2])] }); out.push(`door:${nid}`); }
        else if (r.kind === 'route' && r.sub === undefined) { const t = this.doc.get<RouteData>('routes', r.id); if (!t) continue; const nid = this.uniqueId('routes', r.id + '_copy'); const copy: RouteData = { ...clonePlain(t), id: nid, points: t.points.map(p => roundVec([p[0] + off[0], p[1], p[2] + off[2]])) }; delete copy.name; doc.insert('routes', copy); out.push(`route:${nid}`); }
        else if (r.kind === 'volume') { const v = this.doc.get<VolumeData>('volumes', r.id); if (!v) continue; const nid = this.doc.freshId('vol', 'volumes'); doc.insert('volumes', { ...clonePlain(v), id: nid, c: roundVec([v.c[0] + off[0], v.c[1] + off[1], v.c[2] + off[2]]) }); out.push(`volume:${nid}`); }
        else if (r.kind === 'prop') { const p = this.doc.get<PropData>('props', r.id); if (!p) continue; const nid = this.uniqueId('props', p.kind + String(d.props.length)); const copy: PropData = { ...clonePlain(p), id: nid, x: round6(p.x + off[0]), z: round6(p.z + off[2]) }; delete copy.name; doc.insert('props', copy); out.push(`prop:${nid}`); }
        else if (r.kind === 'chokepoint') { const c = this.doc.get<any>('chokepoints', r.id); if (!c) continue; const nid = this.uniqueId('chokepoints', r.id + '_copy'); doc.insert('chokepoints', { ...clonePlain(c), id: nid, name: undefined, pos: roundVec([c.pos[0] + off[0], c.pos[1], c.pos[2] + off[2]]) }); out.push(`chokepoint:${nid}`); }
        else if (r.kind === 'device') { const v = this.doc.get<DeviceData>('devices', r.id); if (!v || v.kind === 'keypad') { if (v) this.msg(`keypad '${r.id}' not duplicated — one pad per door (add one on another door)`); continue; } const nid = this.uniqueId('devices', r.id + '_copy'); const copy: DeviceData = v.kind === 'laser' ? { ...clonePlain(v), id: nid, from: roundVec([v.from[0] + off[0], v.from[1] + off[1], v.from[2] + off[2]]), to: roundVec([v.to[0] + off[0], v.to[1] + off[1], v.to[2] + off[2]]) } : { ...clonePlain(v), id: nid, pos: roundVec([v.pos[0] + off[0], v.pos[1] + off[1], v.pos[2] + off[2]]) }; doc.insert('devices', copy); out.push(`device:${nid}`); }
      }
    });
    if (out.length) this.setSelection(out);
    return out;
  }
  uniqueId(coll: Collection, want: string): string { const arr = (this.data as any)[coll] as { id: string }[]; let id = want.replace(/[^A-Za-z0-9_.-]/g, '_') || 'x'; if (!arr.some(e => e.id === id)) return id; let k = 2; while (arr.some(e => e.id === `${id}_${k}`)) k++; return `${id}_${k}`; }
  /** who in the `scenarios` block names this door id / this route (by the name the game knows it by), in words, each once */
  scenarioUsers(kind: 'door' | 'route', id: string): string[] { return [...new Set(scenarioRefs(this.data.scenarios, kind).filter(u => u.o[u.k] === id).map(u => u.where))]; }
  /** rewrite a door id / a route's known name wherever the `scenarios` block names it (scenarioRefs' slots only); call inside a transact. Returns how many slots changed. */
  private scenarioRewrite(kind: 'door' | 'route', from: string, to: string): number {
    if (!this.data.scenarios) return 0; const S = clonePlain(this.data.scenarios); let n = 0;
    for (const u of scenarioRefs(S, kind)) if (u.o[u.k] === from) { u.o[u.k] = to; n++; }
    if (n) this.doc.setPath(['scenarios'], S); return n;
  }
  /** Rename an entity id and rewrite every reference to it (boxes: switchables / fixtures / breaker / beacons; doors: objectives / plans / keypads / the scenarios block; routes: the quiet mission's patrol sets; lights: daylight.lightsOff; floors: everything on it). */
  rename(ref: string, newId: string) {
    const r = parseRef(ref); const coll = KIND_COLL[r.kind]; if (!coll) throw new Error(`rename: not for ${r.kind}`);
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(newId)) throw new Error('ids: letters, digits, _ . - (1–64)');
    if (newId === r.id) return; if (this.doc.indexOf(coll, newId) >= 0) throw new Error(`${coll}: '${newId}' exists`);
    const d = this.data; const doc = this.doc;
    doc.transact(`rename ${ref} → ${newId}`, () => {
      doc.update<any>(coll, r.id, { id: newId });
      if (r.kind === 'box') {
        for (const s of d.switchables) if (s.boxes.includes(r.id)) doc.update<SwitchableData>('switchables', s.id, { boxes: s.boxes.map(b => b === r.id ? newId : b) });
        for (const l of d.lights) if (l.fixture === r.id) doc.update<LightData>('lights', l.id, { fixture: newId });
        if (d.breaker.panel === r.id || d.breaker.led === r.id) doc.setPath(['breaker'], { ...d.breaker, panel: d.breaker.panel === r.id ? newId : d.breaker.panel, led: d.breaker.led === r.id ? newId : d.breaker.led });
        for (const b of d.beacons) if (b.box === r.id) doc.update<any>('beacons', b.id, { box: newId });
        if (d.daylight?.sun.fixture === r.id) doc.setPath(['daylight', 'sun', 'fixture'], newId);
      } else if (r.kind === 'door') {
        const M = clonePlain(d.mission); let mch = false; for (const o of M.objectives) if ((o.kind === 'reach' || o.kind === 'exfil') && o.door === r.id) { o.door = newId; mch = true; } if (mch) doc.setPath(['mission'], M);
        d.plans.roomClear.forEach((p, i) => { if (p.door === r.id) doc.setPath(['plans', 'roomClear', i, 'door'], newId); });
        if (d.plans.breach?.door === r.id) doc.setPath(['plans', 'breach', 'door'], newId); if (d.plans.breach?.next?.door === r.id) doc.setPath(['plans', 'breach', 'next', 'door'], newId);
        for (const v of d.devices) if (v.kind === 'keypad' && v.door === r.id) doc.update<any>('devices', v.id, { door: newId });
        for (const b of d.boxes) if (b.group === `doorframe.${r.id}`) doc.update<BoxData>('boxes', b.id, { group: `doorframe.${newId}` });
        this.scenarioRewrite('door', r.id, newId);
      } else if (r.kind === 'route') { const t = this.doc.get<RouteData>('routes', newId); if (t && t.name === undefined && !d.routes.some(x => x.id !== newId && (x.name ?? x.id) === r.id)) this.scenarioRewrite('route', r.id, newId); }   // (the game knows a route by its name, else its id — a named route's patrol sets do not see its id)
      else if (r.kind === 'light') { if (d.daylight?.lightsOff.includes(r.id)) doc.setPath(['daylight', 'lightsOff'], d.daylight.lightsOff.map(x => x === r.id ? newId : x)); }
      else if (r.kind === 'device') { for (const o of d.doors) if (o.lock === r.id) doc.update<DoorData>('doors', o.id, { lock: newId }); }   // a keypad's id IS its door's lock id (validateLevelData holds the two together): the door follows the pad's new name
      else if (r.kind === 'floor') {
        for (const u of floorUsers(d, r.id)) {   // (FLOOR_USERS: the one table delete, rename and lint share — civilians and connector ends included)
          if (u.key === 'civilians') doc.setPath(['civilians', u.index], u.rewrite(newId), { label: `refloor ${u.ref}` });
          else doc.update<any>(u.key, u.id, () => u.rewrite(newId));
        }
        if (this.floorId === r.id) this.floorId = newId;
      }
    });
    if (this.sel.has(ref)) { const s = [...this.sel].map(x => x === ref ? refStr({ ...r, id: newId }) : x); this.setSelection(s); }
  }

  // ---------------------------------------------------------------- boxes
  preset(key: string): BoxPreset { const p = BOX_PRESETS.find(x => x.key === key); if (!p) throw new Error(`preset: one of ${BOX_PRESETS.map(x => x.key).join(' ')}`); return p; }
  /** The BoxData a preset gives for a footprint from corner a to corner b on the current floor (walls: the run along the longer drag axis, the preset's thickness across). */
  boxFromPreset(key: string, a: Vec3, b: Vec3): Omit<BoxData, 'id'> {
    const P = this.preset(key); const F = this.floor();
    let x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[2], b[2]), z1 = Math.max(a[2], b[2]);
    if (x1 - x0 < 1e-3 && z1 - z0 < 1e-3) { x0 = a[0] - P.size[0] / 2; x1 = a[0] + P.size[0] / 2; z0 = a[2] - P.size[1] / 2; z1 = a[2] + P.size[1] / 2; }   // a click: the preset's default footprint about the point
    if (P.thick !== undefined) { if (x1 - x0 >= z1 - z0) { const zc = a[2]; z0 = zc - P.thick / 2; z1 = zc + P.thick / 2; if (x1 - x0 < 1e-3) { x0 = a[0] - P.size[0] / 2; x1 = a[0] + P.size[0] / 2; } } else { const xc = a[0]; x0 = xc - P.thick / 2; x1 = xc + P.thick / 2; } }
    const y0 = F.y + (P.fromCeiling !== undefined ? F.ceiling - P.fromCeiling - P.height : P.y0 ?? 0);
    const box: Omit<BoxData, 'id'> = { floor: F.id, group: P.key === 'wall' || P.key === 'wall.ext' || P.key === 'lowwall' ? 'walls' : 'new', c: roundVec([(x0 + x1) / 2, y0 + P.height / 2, (z0 + z1) / 2]), h: roundVec([(x1 - x0) / 2, P.height / 2, (z1 - z0) / 2]) };
    if (P.material !== undefined && this.data.materials[P.material]) box.material = P.material; else box.albedo = [...(P.albedo ?? this.data.materials[P.material ?? '']?.albedo ?? [0.5, 0.5, 0.5])] as Vec3;
    if (P.emissive) box.emissive = [...P.emissive] as Vec3; if (P.flags?.length) box.flags = [...P.flags];
    return box;
  }
  /** Add a box: from a preset footprint (spec.preset + c as the click point, or c/h explicit), or fully explicit fields. Returns the id (selected). */
  addBox(spec: AddBoxSpec = {}, opts: { select?: boolean; label?: string } = {}): string {
    const F = this.floor(); const id = spec.id ?? this.doc.freshId('box', 'boxes');
    let box: BoxData;
    if (spec.preset && !spec.h && !spec.size) { const at: Vec3 = spec.c ? [...spec.c] as Vec3 : [20, 0, 14]; box = { id, ...this.boxFromPreset(spec.preset, at, at) }; if (spec.c && spec.c[1] !== 0 && spec.c[1] !== undefined) box.c[1] = spec.c[1]; }
    else {
      const h: Vec3 = spec.h ? [...spec.h] as Vec3 : spec.size ? [spec.size[0] / 2, spec.size[1] / 2, spec.size[2] / 2] : [0.5, 0.5, 0.5];
      box = { id, floor: F.id, group: spec.preset && ['wall', 'wall.ext', 'lowwall'].includes(spec.preset) ? 'walls' : 'new', c: spec.c ? roundVec(spec.c) : [20, F.y + h[1], 14], h: roundVec(h) };
      if (spec.preset) { const P = this.preset(spec.preset); if (P.material && this.data.materials[P.material]) box.material = P.material; else box.albedo = [...(P.albedo ?? [0.5, 0.5, 0.5])] as Vec3; if (P.emissive) box.emissive = [...P.emissive] as Vec3; if (P.flags) box.flags = [...P.flags]; }
    }
    for (const k of ['floor', 'group', 'name', 'yaw', 'rot', 'emissive', 'flags', 'cutHeight'] as const) if (spec[k] !== undefined) (box as any)[k] = clonePlain(spec[k]);
    if (spec.material !== undefined) { box.material = spec.material; delete box.albedo; } else if (spec.albedo !== undefined) { box.albedo = [...spec.albedo] as Vec3; delete box.material; }
    if (box.material === undefined && box.albedo === undefined) box.albedo = [0.5, 0.5, 0.5];
    if (box.material !== undefined && !this.data.materials[box.material]) throw new Error(`unknown material '${box.material}' (palette: ${Object.keys(this.data.materials).join(' ')})`);
    if (box.yaw === 0) delete box.yaw;
    const P = spec.preset ? this.preset(spec.preset) : null;
    const sw = spec.switchable === true ? {} : spec.switchable === false ? null : spec.switchable ?? (P?.switchable ? {} : null);
    this.doc.transact(opts.label ?? `add box ${id}${P ? ` (${P.label})` : ''}`, () => {
      this.doc.insert('boxes', box);
      if (sw) { const e = box.emissive ?? [1, 1, 1]; this.doc.insert('switchables', { id: this.uniqueId('switchables', `sw_${id}`), boxes: [id], group: sw.group ?? P?.switchable?.group ?? box.group ?? 'lights', on: sw.on ?? P?.switchable?.on ?? true, baseEmissive: [...(sw.baseEmissive ?? e)] as Vec3 }); }
    });
    if (opts.select !== false) this.setSelection([`box:${id}`]);
    return id;
  }
  /** THE write path for one box (the sheet, the gizmo, the paint ops, __ed.box.update all land here): the patch applied, then — if its half extents moved — its
   *  markings re-fitted onto the smaller / larger faces (fitMarkings), in the same command. */
  updateBox(id: string, patch: Partial<BoxData> | ((b: BoxData) => BoxData), opts: { coalesce?: string; label?: string } = {}) {
    this.doc.update<BoxData>('boxes', id, b => this.fitMarkings(b, typeof patch === 'function' ? patch(b) : { ...b, ...patch }), opts);
  }
  /** push one face of a box by delta metres (S-drag / numeric); the opposite face stays */
  resizeBox(id: string, face: Face, delta: number, opts: { coalesce?: string } = {}) {
    this.updateBox(id, b => { const r = pushFace(b.c as Vec3, b.h as Vec3, b.yaw ?? 0, face, delta); return { ...b, c: roundVec(r.c), h: roundVec(r.h) }; }, { coalesce: opts.coalesce, label: `resize ${id}` });
  }
  /** set a box's full size (keeps the centre) */
  setBoxSize(id: string, size: Vec3, opts: { coalesce?: string } = {}) { this.updateBox(id, b => ({ ...b, h: roundVec([Math.max(0.001, size[0] / 2), Math.max(0.001, size[1] / 2), Math.max(0.001, size[2] / 2)]) }), { coalesce: opts.coalesce, label: `resize ${id}` }); }
  /** A box whose half extents changed keeps its markings ON its faces: each is re-clamped into its face's lattice at the new size (paint.ts faceLattice /
   *  clampToFace — the bitmap cropped top-left when it had to shrink) and dropped only when the face no longer takes a single cell of its res; drops are
   *  reported (problems panel + the status line). Runs inside the box's own update, so ONE command carries size and markings and undo restores both — a
   *  resize used to leave the bitmap hanging off the face: an invalid document nothing would save or reload (review T4.1). */
  private fitMarkings(before: BoxData, after: BoxData): BoxData {
    const ms = after.markings; if (!ms?.length || after.rot) return after;
    if (before.h[0] === after.h[0] && before.h[1] === after.h[1] && before.h[2] === after.h[2]) return after;   // (same size: paint.ts writeMarkings validated whatever it wrote)
    const texel = markTexelOf(this);
    const kept: NonNullable<BoxData['markings']> = [], dropped: string[] = []; let moved = 0;
    ms.forEach((m, k) => {
      const L = faceLattice(after.h, m.face, m.res ?? 'base', texel);
      if (L.maxW < 1 || L.maxH < 1) { dropped.push(`marking ${k} (${m.face}, ${m.size[0]}×${m.size[1]} ${m.res ?? 'base'} cells): the face is now smaller than one cell`); return; }
      const cl = clampToFace(L, m.at, m.size);
      if (cl.at[0] === m.at[0] && cl.at[1] === m.at[1] && cl.size[0] === m.size[0] && cl.size[1] === m.size[1]) { kept.push(m); return; }
      moved++; kept.push({ ...m, at: cl.at, size: cl.size, cells: cl.size[0] === m.size[0] && cl.size[1] === m.size[1] ? m.cells : fitRows(m.cells, cl.size[0], cl.size[1]) });
    });
    if (!moved && !dropped.length) return after;
    const out: BoxData = { ...after }; if (kept.length) out.markings = kept; else delete out.markings;
    if (dropped.length) this.report(dropped.map(t => ({ text: `MARKING dropped from ${after.id} — ${t}`, sev: 'warn' as const, ids: [`box:${after.id}`] })), `${after.id}: ${dropped.length} marking(s) no longer fit the resized box and were dropped (undo brings them back)`);
    return out;
  }
  /** things worth the problems panel that a VERB found (not validate / lint): markings a resize dropped, the problems a lenient load came in with */
  onProblems: ((items: { text: string; sev: 'error' | 'warn' | 'info'; ids: string[] }[], summary: string) => void)[] = [];
  report(items: { text: string; sev: 'error' | 'warn' | 'info'; ids: string[] }[], summary: string) { this.msg(summary); for (const f of this.onProblems) f(items, summary); }
  setBoxFlags(ids: string[], flag: FlagName, on: boolean) {
    if (!(AUTHORED_FLAGS as readonly string[]).includes(flag)) throw new Error(`flag: one of ${AUTHORED_FLAGS.join(' ')}`);
    this.doc.transact(`${on ? 'set' : 'clear'} ${flag} on ${ids.length} box(es)`, () => { for (const id of ids) this.doc.update<BoxData>('boxes', id, b => { const f = new Set(b.flags ?? []); if (on) f.add(flag); else f.delete(flag); const flags = AUTHORED_FLAGS.filter(x => f.has(x)) as BoxData['flags']; const o = { ...b, flags }; if (!flags!.length) delete o.flags; return o; }); });   // (AUTHORED_FLAGS, in the file's order — every authored flag, Glass included: a hand-kept list here dropped a pane's Glass on any other flag's toggle)
  }
  setBoxMaterial(ids: string[], material: string | Vec3) {
    if (typeof material === 'string' && !this.data.materials[material]) throw new Error(`unknown material '${material}'`);
    this.doc.transact(`paint ${ids.length} box(es) ${typeof material === 'string' ? material : 'inline'}`, () => { for (const id of ids) this.doc.update<BoxData>('boxes', id, b => { const o = { ...b }; if (typeof material === 'string') { o.material = material; delete o.albedo; } else { o.albedo = roundVec(material); delete o.material; } return o; }); });
  }

  // ---------------------------------------------------------------- lights + switchables
  addLight(spec: Partial<LightData> & { preset?: string } = {}, opts: { select?: boolean } = {}): string {
    const P = LIGHT_PRESETS.find(p => p.key === (spec.preset ?? 'bulb')) ?? LIGHT_PRESETS[0]; const F = this.floor();
    const id = this.uniqueId('lights', spec.id ?? `${P.key}_${this.data.lights.length}`);
    const l: LightData = { id, kind: P.def.kind, pos: [20, F.y + P.height, 14], dir: P.def.kind === 'spot' ? [0, -1, 0] : [0, -1, 0], color: [...P.def.color] as Vec3, intensity: P.def.intensity, range: P.def.range, innerDeg: P.def.innerDeg, outerDeg: P.def.outerDeg, group: 'new', enabled: true, volumetric: P.def.volumetric };
    if (P.def.radius !== undefined) l.radius = P.def.radius; if (P.def.broad) l.broad = true; if (P.key === 'sodium') l.mains = false;
    for (const k of ['kind', 'pos', 'dir', 'color', 'intensity', 'range', 'innerDeg', 'outerDeg', 'group', 'enabled', 'volumetric', 'radius', 'mains', 'broad', 'fixture'] as const) if (spec[k] !== undefined) (l as any)[k] = clonePlain(spec[k]);
    if (spec.pos && spec.pos.length === 3 && spec.preset && spec.pos[1] === 0) l.pos = [spec.pos[0], F.y + P.height, spec.pos[2]];   // a floor point + a preset: hang it at the preset's height
    l.pos = roundVec(l.pos); l.dir = roundVec(l.dir); if (!(Math.hypot(...l.dir) > 1e-9)) l.dir = [0, -1, 0];
    this.doc.insert('lights', l, undefined, `add light ${id} (${P.label})`);
    if (opts.select !== false) this.setSelection([`light:${id}`]);
    return id;
  }
  updateLight(id: string, patch: Partial<LightData> | ((l: LightData) => LightData), opts: { coalesce?: string; label?: string } = {}) { this.doc.update<LightData>('lights', id, patch, opts); }
  /** point a light at a world position (dir = target − pos, normalized) */
  aimLight(id: string, target: Vec3, opts: { coalesce?: string } = {}) {
    this.doc.update<LightData>('lights', id, l => { const d: Vec3 = [target[0] - l.pos[0], target[1] - l.pos[1], target[2] - l.pos[2]]; const L = Math.hypot(...d); return L < 1e-6 ? l : { ...l, dir: roundVec([d[0] / L, d[1] / L, d[2] / L]) }; }, { coalesce: opts.coalesce, label: `aim ${id}` });
  }
  /** make the given (emissive) boxes one switchable fixture */
  makeSwitchable(boxIds: string[], spec: Partial<SwitchableData> = {}): string {
    if (!boxIds.length) throw new Error('makeSwitchable: no boxes'); for (const b of boxIds) if (!this.doc.get('boxes', b)) throw new Error(`no box '${b}'`);
    const owned = boxIds.find(b => this.data.switchables.some(s => s.boxes.includes(b))); if (owned) throw new Error(`box '${owned}' already belongs to switchable '${this.data.switchables.find(s => s.boxes.includes(owned))!.id}'`);
    const first = this.doc.get<BoxData>('boxes', boxIds[0])!; const e = first.emissive && first.emissive.some(x => x > 0) ? first.emissive : [4, 4, 3.6];
    const id = this.uniqueId('switchables', spec.id ?? `sw_${boxIds[0]}`);
    this.doc.transact(`make switchable ${id}`, () => {
      for (const b of boxIds) { const bx = this.doc.get<BoxData>('boxes', b)!; if (!bx.emissive || !bx.emissive.some(x => x > 0)) this.doc.update<BoxData>('boxes', b, { emissive: [...(spec.baseEmissive ?? e)] as Vec3 }); }
      this.doc.insert('switchables', { id, boxes: [...boxIds], group: spec.group ?? first.group ?? 'lights', on: spec.on ?? true, baseEmissive: [...(spec.baseEmissive ?? e)] as Vec3, ...(spec.flicker !== undefined ? { flicker: spec.flicker } : {}), ...(spec.mains !== undefined ? { mains: spec.mains } : {}) });
    });
    return id;
  }
  updateSwitchable(id: string, patch: Partial<SwitchableData> | ((s: SwitchableData) => SwitchableData), opts: { coalesce?: string } = {}) { this.doc.update<SwitchableData>('switchables', id, patch, opts); }
  switchableOf(boxId: string): SwitchableData | null { return this.data.switchables.find(s => s.boxes.includes(boxId)) ?? null; }

  // ---------------------------------------------------------------- doors
  addDoor(spec: Partial<DoorData> = {}, opts: { select?: boolean; frame?: boolean; cut?: boolean } = {}): string {
    const id = this.uniqueId('doors', spec.id ?? `door_${this.data.doors.length}`);
    const d: DoorData = { id, floor: this.floor().id, hinge: spec.hinge ? [round6(spec.hinge[0]), round6(spec.hinge[1])] : [20.32, 14], closedDir: round6(spec.closedDir ?? 0), width: round6(spec.width ?? LEAF_W) };
    for (const k of ['angle', 'exterior', 'closer', 'minAngle', 'maxAngle', 'locked', 'lock', 'keySide', 'swing'] as const) if (spec[k] !== undefined) (d as any)[k] = spec[k];
    this.doc.transact(`add door ${id}`, () => { this.doc.insert('doors', d); if (opts.cut) this.cutOpening(id); if (opts.frame) this.makeFrame(id); });
    if (opts.select !== false) this.setSelection([`door:${id}`]);
    return id;
  }
  updateDoor(id: string, patch: Partial<DoorData> | ((d: DoorData) => DoorData), opts: { coalesce?: string; label?: string } = {}) { this.doc.update<DoorData>('doors', id, patch, opts); }
  /** the side a door opens into (doors open one way: ±1 on the sign of game/doors.ts Doors.side), and why: `swing` in the file, else the
   *  deal the game makes when the level starts, run on the document (swing.ts). Kept per document revision; while edits are streaming in
   *  (a drag) the last deal is shown and re-dealt at most four times a second. null = the document does not load, or no such door. */
  doorSwing(id: string, now = false): SwingDeal | null {
    const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.swings || (this.swings.rev !== this.doc.rev && (now || t - this.swings.at > 250))) this.swings = { rev: this.doc.rev, at: t, deal: dealtSwings(this.data) };
    return this.swings.deal?.get(id) ?? null;
  }
  private swings: { rev: number; at: number; deal: Map<string, SwingDeal> | null } | null = null;
  /** (re)build the frame boxes for a door: removes any existing group doorframe.<id> boxes first; returns the new box ids */
  makeFrame(doorId: string, opts: { t?: number } = {}): string[] {
    const d = this.doc.get<DoorData>('doors', doorId); if (!d) throw new Error(`no door '${doorId}'`);
    const ids: string[] = [];
    this.doc.transact(`frame door ${doorId}`, () => {
      const old = this.data.boxes.filter(b => b.group === `doorframe.${doorId}`).map(b => `box:${b.id}`); if (old.length) this.delete(old);
      for (const b of doorFrameBoxes(d, { t: opts.t, floor: d.floor ?? this.floor().id })) { const id = this.doc.freshId('box', 'boxes'); this.doc.insert('boxes', { id, ...b }); ids.push(id); }
    });
    return ids;
  }
  /** split the wall slabs the doorway crosses into runs + lintel (geom.ts cutOpeningPlan); returns { removed, added } ids and `obstructions`: statics still
   *  standing in the doorway afterwards (wall-hung dressing, furniture) that the cut deliberately leaves for the author to move — lint's door-sides says the same */
  cutOpening(doorId: string): { removed: string[]; added: string[]; obstructions: string[] } {
    const d = this.doc.get<DoorData>('doors', doorId); if (!d) throw new Error(`no door '${doorId}'`);
    const plan = cutOpeningPlan(this.data, d); const added: string[] = [];
    if (plan.remove.length) {
      this.doc.transact(`cut opening for ${doorId}`, () => {
        const at = Math.min(...plan.remove.map(id => this.doc.indexOf('boxes', id)));
        this.delete(plan.remove.map(id => `box:${id}`));
        plan.add.forEach((b, k) => { const id = this.doc.freshId('box', 'boxes'); this.doc.insert('boxes', { id, ...b }, Math.min(at + k, this.data.boxes.length)); added.push(id); });   // (where the wall was, so the file's box order stays by room)
      });
    }
    const obstructions = this.doorwayObstructions(doorId);
    if (obstructions.length) this.msg(`doorway of ${doorId}: ${obstructions.length} thing(s) still in the opening — ${obstructions.slice(0, 4).join(' ')} (move or delete them)`);
    return { removed: plan.remove, added, obstructions };
  }
  /** statics (not NoShadow) whose footprint crosses the doorway prism: along the gap, ±0.35 m across the wall line, between knee and head height */
  doorwayObstructions(doorId: string): string[] {
    const d = this.doc.get<DoorData>('doors', doorId); if (!d) return [];
    const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir); const out: string[] = [];
    for (const b of this.data.boxes) {
      if (b.flags?.includes('NoShadow') || b.group === `doorframe.${doorId}`) continue;
      if (b.c[1] + b.h[1] < 0.3 || b.c[1] - b.h[1] > 2.0) continue;
      // box centre in the doorway's frame (u along the leaf from the hinge, v across)
      const dx = b.c[0] - d.hinge[0], dz = b.c[2] - d.hinge[1]; const u = dx * ux + dz * uz, v = -dx * uz + dz * ux;
      const cs = Math.abs(Math.cos((b.yaw ?? 0))), sn = Math.abs(Math.sin(b.yaw ?? 0)); const ex = cs * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + cs * b.h[2];
      const eu = Math.abs(ux) * ex + Math.abs(uz) * ez, ev = Math.abs(uz) * ex + Math.abs(ux) * ez;   // conservative extents along u / v
      if (u + eu > 0.05 && u - eu < d.width - 0.05 && Math.abs(v) < 0.35 + ev) out.push(b.id);
    }
    return out;
  }

  // ---------------------------------------------------------------- routes
  addRoute(spec: Partial<RouteData> & { points?: Vec3[] } = {}, opts: { select?: boolean } = {}): string {
    const pts = (spec.points?.length ? spec.points : [[20, 0, 14] as Vec3]).map(p => roundVec([p[0], 0, p[2]]));
    const id = this.uniqueId('routes', spec.id ?? `route_${this.data.routes.length}`);
    const r: RouteData = { id, points: pts, wait: pts.map((_, i) => Math.max(0, spec.wait?.[i] ?? 0)) };
    if (spec.name) r.name = spec.name; if (spec.weapon) r.weapon = spec.weapon; if (spec.keys?.length) r.keys = [...spec.keys];
    this.doc.insert('routes', r, undefined, `add route ${id} (${pts.length} points)`);
    if (opts.select !== false) this.setSelection([`route:${id}`]);
    return id;
  }
  updateRoute(id: string, patch: Partial<RouteData> | ((r: RouteData) => RouteData), opts: { coalesce?: string; label?: string } = {}) {
    const next = (r: RouteData) => { const n = typeof patch === 'function' ? patch(r) : { ...r, ...patch }; if (n.wait.length !== n.points.length) n.wait = n.points.map((_, i) => n.wait[i] ?? 0); return n; };
    // (the name the game knows him by — `name`, else the id — is what the quiet mission's patrol sets hold: a new name is followed there in the same undo step)
    const was = this.doc.get<RouteData>('routes', id), k0 = was ? was.name ?? was.id : '', k1 = was ? (n => n.name ?? n.id)(next(clonePlain(was))) : '';
    if (was && k1 !== k0 && !this.data.routes.some(x => x.id !== id && (x.name ?? x.id) === k0) && this.scenarioUsers('route', k0).length) this.doc.transact(opts.label ?? `rename route ${id}'s man`, () => { this.doc.update<RouteData>('routes', id, next); this.scenarioRewrite('route', k0, k1); });
    else this.doc.update<RouteData>('routes', id, next, opts);
  }
  movePoint(id: string, i: number, pos: Vec3, opts: { coalesce?: string } = {}) { this.updateRoute(id, r => ({ ...r, points: r.points.map((p, k) => k === i ? roundVec([pos[0], 0, pos[2]]) : p) }), { coalesce: opts.coalesce, label: `move ${id}#${i}` }); }
  insertPoint(id: string, i: number, pos: Vec3, wait = 0) { this.updateRoute(id, r => ({ ...r, points: [...r.points.slice(0, i), roundVec([pos[0], 0, pos[2]]), ...r.points.slice(i)], wait: [...r.wait.slice(0, i), wait, ...r.wait.slice(i)] }), { label: `insert ${id}#${i}` }); }
  removePoint(id: string, i: number) { this.delete([`route:${id}#${i}`]); }

  // ---------------------------------------------------------------- volumes / props / chokepoints / marks / floors / materials / level
  addVolume(spec: Partial<VolumeData> = {}, opts: { select?: boolean } = {}): string {
    const id = this.uniqueId('volumes', spec.id ?? this.doc.freshId('vol', 'volumes')); const F = this.floor();
    const h: Vec3 = spec.h ? roundVec(spec.h) : [0.5, 0.5, 0.5];
    const v: VolumeData = { id, kind: spec.kind ?? 'hide', floor: F.id, c: spec.c ? roundVec(spec.c) : [20, F.y + h[1], 14], h };
    if (spec.yaw) v.yaw = round6(spec.yaw); if (spec.notes) v.notes = spec.notes;
    this.doc.insert('volumes', v, undefined, `add ${v.kind} volume ${id}`);
    if (opts.select !== false) this.setSelection([`volume:${id}`]);
    return id;
  }
  updateVolume(id: string, patch: Partial<VolumeData> | ((v: VolumeData) => VolumeData), opts: { coalesce?: string; label?: string } = {}) { this.doc.update<VolumeData>('volumes', id, patch, opts); }
  updateProp(id: string, patch: Partial<PropData> | ((p: PropData) => PropData), opts: { coalesce?: string; label?: string } = {}) { this.doc.update<PropData>('props', id, patch, opts); }
  addChokepoint(spec: { id?: string; pos?: Vec3; yaw?: number; name?: string } = {}): string { const id = this.uniqueId('chokepoints', spec.id ?? `post_${this.data.chokepoints.length}`); this.doc.insert('chokepoints', { id, ...(spec.name ? { name: spec.name } : {}), floor: this.floor().id, pos: roundVec(spec.pos ?? [20, 0, 14]), yaw: round6(spec.yaw ?? 0) }); this.setSelection([`chokepoint:${id}`]); return id; }
  setSpawn(pos: Vec3, opts: { coalesce?: string } = {}) { this.doc.setPath(['mission', 'playerSpawn'], roundVec([pos[0], 0, pos[2]]), { coalesce: opts.coalesce, label: 'move spawn' }); }
  updateObjective(id: string, patch: Partial<ObjectiveData>, opts: { coalesce?: string } = {}) {
    const M = clonePlain(this.data.mission); const i = M.objectives.findIndex(o => o.id === id); if (i < 0) throw new Error(`no objective '${id}'`);
    M.objectives[i] = { ...M.objectives[i], ...patch } as ObjectiveData; this.doc.setPath(['mission'], M, { coalesce: opts.coalesce, label: `edit objective ${id}` });
  }
  addFloor(spec: Partial<FloorData> = {}): string { const id = this.uniqueId('floors', spec.id ?? `f${this.data.floors.length}`); const top = this.data.floors.reduce((m, f) => Math.max(m, f.y + f.ceiling + 0.2), 0); this.doc.insert('floors', { id, name: spec.name ?? `floor ${this.data.floors.length}`, y: round6(spec.y ?? top), ceiling: round6(spec.ceiling ?? 3) }); return id; }
  updateFloor(id: string, patch: Partial<FloorData>) { this.doc.update<FloorData>('floors', id, patch); }
  /** add a paint, or repaint an existing one's albedo / notes (its finish kept) — paint.ts materialCreate / materialSet: whole-record writes, so the palette ORDER undoes exactly */
  setMaterial(name: string, albedo: Vec3, notes?: string) { if (Object.prototype.hasOwnProperty.call(this.data.materials, name)) materialSet(this, name, { albedo, ...(notes !== undefined ? { notes: notes || null } : {}) }); else materialCreate(this, name, { albedo, notes }); }
  removeMaterial(name: string, opts: { repaintTo?: string } = {}) { materialRemove(this, name, opts); }
  setName(name: string) { this.doc.setPath(['name'], name.trim() || 'level'); }
  setMeta(patch: Partial<LevelData['meta']>) { this.doc.setPath(['meta'], { ...this.data.meta, ...patch }); }
  setSky(which: 'zenith' | 'horizon', rgb: Vec3, opts: { coalesce?: string } = {}) { this.doc.setPath(['sky', which], roundVec(rgb), opts); }

  // ---------------------------------------------------------------- devices (game/devices.ts: cameras, keypads, laser tripwires)
  /** Add a device. camera: `pos` (a floor point is lifted to CAMERA_HEIGHT under the current floor's ceiling), `yaw` …; keypad: `door` (required — or the door
   *  nearest `pos` within 2.5 m) — the door is LOCKED on the pad's own lock as part of the same command (the lock id is the link), the plate placed beside its
   *  latch jamb on the key side unless `pos` says otherwise; laser: `from` / `to` (floor points are lifted to LASER_HEIGHT). Returns the id (selected). */
  addDevice(spec: Partial<DeviceData> & { kind: DeviceData['kind'] }, opts: { select?: boolean } = {}): string {
    const F = this.floor(); const doc = this.doc; const d = this.data;
    const kind = spec.kind;
    const id = this.uniqueId('devices', spec.id ?? (kind === 'camera' ? `cam_${d.devices.filter(v => v.kind === 'camera').length}` : kind === 'keypad' ? `pad_${(spec as Partial<KeypadData>).door ?? d.devices.filter(v => v.kind === 'keypad').length}` : `laser_${d.devices.filter(v => v.kind === 'laser').length}`));
    let dev: DeviceData;
    if (kind === 'camera') {
      const c = spec as Partial<CameraData>;
      const pos: Vec3 = c.pos ? roundVec([c.pos[0], c.pos[1] > F.y + 0.01 ? c.pos[1] : F.y + Math.min(F.ceiling - 0.4, CAMERA_HEIGHT), c.pos[2]]) : [20, F.y + CAMERA_HEIGHT, 14];
      dev = { id, kind: 'camera', floor: F.id, pos, yaw: round6(c.yaw ?? 0), pitch: round6(c.pitch ?? DEVICE_DEFAULTS.pitch), fovDeg: c.fovDeg ?? DEVICE_DEFAULTS.fovDeg, range: c.range ?? DEVICE_DEFAULTS.range };
      if (c.sweep) { dev.sweep = [round6(c.sweep[0]), round6(c.sweep[1])]; dev.sweepPeriod = c.sweepPeriod ?? 9; } if (c.group !== undefined) dev.group = c.group; if (c.mains !== undefined) dev.mains = c.mains; if (c.notes) dev.notes = c.notes;
      doc.insert('devices', dev, undefined, `add camera ${id}`);
    } else if (kind === 'laser') {
      const l = spec as Partial<LaserData>;
      const lift = (p: readonly number[]): Vec3 => roundVec([p[0], p[1] > F.y + 0.01 ? p[1] : F.y + LASER_HEIGHT, p[2]]);
      const from: Vec3 = l.from ? lift(l.from) : [19, F.y + LASER_HEIGHT, 14], to: Vec3 = l.to ? lift(l.to) : [from[0] + 2, from[1], from[2]];
      if (Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) < 0.05) throw new Error('laser: from and to coincide — drag from the emitter to the receiver');
      dev = { id, kind: 'laser', floor: F.id, from, to };
      if (l.group !== undefined) dev.group = l.group; if (l.mains !== undefined) dev.mains = l.mains; if (l.alarm !== undefined) dev.alarm = l.alarm; if (l.notes) dev.notes = l.notes;
      doc.insert('devices', dev, undefined, `add laser ${id}`);
    } else {
      const k = spec as Partial<KeypadData>;
      let doorId = k.door;
      if (!doorId && k.pos) { let bd = 2.5; for (const o of d.doors) { const mx = o.hinge[0] + Math.cos(o.closedDir) * o.width / 2, mz = o.hinge[1] + Math.sin(o.closedDir) * o.width / 2; const dd = Math.hypot(mx - k.pos[0], mz - k.pos[2]); if (dd < bd) { bd = dd; doorId = o.id; } } }
      if (!doorId) throw new Error('keypad: name the door (spec.door) or click within 2.5 m of one');
      const door = this.doc.get<DoorData>('doors', doorId); if (!door) throw new Error(`keypad: no door '${doorId}'`);
      const other = d.devices.find(v => v.kind === 'keypad' && v.door === doorId); if (other) throw new Error(`door '${doorId}' already has keypad '${other.id}'`);
      const code = k.code ?? String(1000 + Math.floor(Math.abs(Math.sin(d.devices.length * 12.9898 + doorId.length * 78.233) * 8999)));   // (a placeholder the author will change; deterministic so a scripted level is repeatable)
      if (!DEVICE_DEFAULTS.codeRe.test(code)) throw new Error(`keypad: code '${code}' is not four digits`);
      const keySide: 1 | -1 = door.keySide ?? (k.pos ? (Math.cos(door.closedDir) * (k.pos[2] - door.hinge[1]) - Math.sin(door.closedDir) * (k.pos[0] - door.hinge[0]) >= 0 ? 1 : -1) : 1);   // (doors.ts side(): perp = u.x·pz − u.z·px ≥ 0 → +1)
      const place = keypadPlacement(door, keySide, F.y, d.boxes);
      const pos: Vec3 = k.pos && k.pos[1] > F.y + 0.01 ? roundVec(k.pos as Vec3) : place.pos;
      dev = { id, kind: 'keypad', floor: F.id, pos, yaw: round6(k.yaw ?? place.yaw), door: doorId, code };
      if (k.notes) dev.notes = k.notes;
      doc.transact(`add keypad ${id} on ${doorId}`, () => { doc.insert('devices', dev); doc.update<DoorData>('doors', doorId!, o => ({ ...o, locked: true, lock: id, keySide: o.keySide ?? (keySide === 1 ? undefined : -1) })); });   // the lock IS the link: the door goes on the pad's own lock (validateLevelData holds the two together)
    }
    if (opts.select !== false) this.setSelection([`device:${id}`]);
    return id;
  }
  /** edit a device in place (the sheet's fields, __ed.device.update); a keypad's `door` re-links: the old door comes off the pad's lock, the new one goes on it */
  updateDevice(id: string, patch: Partial<DeviceData> | ((v: DeviceData) => DeviceData), opts: { coalesce?: string; label?: string } = {}) {
    const cur = this.doc.get<DeviceData>('devices', id); if (!cur) throw new Error(`no device '${id}'`);
    const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch } as DeviceData;
    if (cur.kind === 'keypad' && next.kind === 'keypad' && next.door !== cur.door) {
      if (!this.doc.get<DoorData>('doors', next.door)) throw new Error(`no door '${next.door}'`);
      const other = this.data.devices.find(v => v.kind === 'keypad' && v.door === next.door && v.id !== id); if (other) throw new Error(`door '${next.door}' already has keypad '${other.id}'`);
      this.doc.transact(opts.label ?? `keypad ${id}: door ${cur.door} → ${next.door}`, () => {
        this.doc.update<DoorData>('doors', cur.door, o => { const y = { ...o }; delete y.lock; return y; });   // (the old door keeps its bolt but goes back on the floor key — the same as deleting the pad)
        this.doc.update<DoorData>('doors', next.door, o => ({ ...o, locked: true, lock: id }));
        this.doc.update<DeviceData>('devices', id, next);
      });
      return;
    }
    this.doc.update<DeviceData>('devices', id, next, opts);
  }
  /** point a camera at a world position (yaw + pitch off pos → target; the sweep, if any, re-centred on the new yaw) */
  aimCamera(id: string, target: Vec3, opts: { coalesce?: string } = {}) {
    this.doc.update<DeviceData>('devices', id, v => { if (v.kind !== 'camera') return v; const dx = target[0] - v.pos[0], dy = target[1] - v.pos[1], dz = target[2] - v.pos[2]; const L = Math.hypot(dx, dz); if (L < 1e-6 && Math.abs(dy) < 1e-6) return v; const yaw = round6(Math.atan2(dx, dz)), pitch = round6(Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.max(L, 1e-6))))); const o: DeviceData = { ...v, yaw, pitch }; if (v.sweep) { const half = (v.sweep[1] - v.sweep[0]) / 2; o.sweep = [round6(yaw - half), round6(yaw + half)]; } return o; }, { coalesce: opts.coalesce, label: `aim ${id}` });
  }
  /** move one END of a beam (0 = the emitter `from`, 1 = the receiver `to`) */
  moveLaserEnd(id: string, end: 0 | 1, pos: Vec3, opts: { coalesce?: string } = {}) {
    this.doc.update<DeviceData>('devices', id, v => v.kind !== 'laser' ? v : end === 0 ? { ...v, from: roundVec(pos) } : { ...v, to: roundVec(pos) }, { coalesce: opts.coalesce, label: `move ${id} ${end ? 'receiver' : 'emitter'}` });
  }

  // ---------------------------------------------------------------- nudges (keyboard)
  nudge(refs: string[], dx: number, dz: number, dy = 0) { this.move(refs, [dx, dy, dz], { label: `nudge ${refs.length} thing(s)` }); }

  // ---------------------------------------------------------------- document ops
  undo(): string | null { const l = this.doc.undo(); this.msg(l ? `undo: ${l}` : 'nothing to undo'); return l; }
  redo(): string | null { const l = this.doc.redo(); this.msg(l ? `redo: ${l}` : 'nothing to redo'); return l; }
  validate(): string[] { return this.doc.validate(); }
  lint(): LintReport { return lintLevel(this.data, this.lintOpts); }
  serialize(): string { return serializeLevelData(this.data); }
  /** the validation errors the last load() came in with (a `lenient` restore of a document that has problems) — the page lists them in the problems panel; [] otherwise —
   *  and the same as problems-panel rows (with the ids a click selects), for a panel built after the load */
  loadErrors: string[] = []; loadProblems: { text: string; sev: 'error' | 'warn' | 'info'; ids: string[] }[] = [];
  /** replace the document from text or data (validates; throws with the list). Stacks are cleared; `keepSaved` leaves the dirty baseline alone (autosave restore).
   *  `lenient` (the RESTORE paths: the autosave slot, a session's own text) opens a parseable document even when it does not validate — its problems land in
   *  `loadErrors` / onLoadErrors for the problems panel — and refuses only text that is not a level at all (levelData.ts parseLevelDataLenient): a session must
   *  never be silently replaced by another level and then autosaved over (review T4.1). Returns the errors it was opened with. */
  load(src: string | LevelData, opts: { keepSaved?: boolean; lintAllow?: LintOpts['allow']; lenient?: boolean; file?: string | null } = {}): string[] {
    const text = typeof src === 'string' ? src : JSON.stringify(src);
    let data: LevelData, errors: string[] = [];
    if (opts.lenient) ({ data, errors } = parseLevelDataLenient(text)); else data = parseLevelData(text);
    this.doc.load(data, { keepSaved: opts.keepSaved });
    this.lintOpts.allow = opts.lintAllow;   // (absent = none: a sidecar's allowances are its own level's — the office's used to stay on over whatever was opened next)
    this.file = opts.file ?? null;
    if (data.meta?.grid && data.meta.grid > 0) this.settings.snapStep = data.meta.grid;
    this.loadErrors = errors; this.loadProblems = errors.map(e => ({ text: `SCHEMA ${e}`, sev: 'error' as const, ids: idsInMessage(e, data) }));
    if (errors.length) this.report(this.loadProblems, `opened '${data.name}' WITH ${errors.length} PROBLEM(S) — listed in the problems panel; the game cannot load it until they are fixed: ${errors[0]}`);
    else this.msg(`loaded '${data.name}': ${this.counts(false)}${data.meta?.generator ? ` — GENERATED (${data.meta.generator.split(' ')[0]}): a re-export overwrites edits saved to it` : ''}`);
    return errors;
  }
  /** what the document holds, in one line: the long form is the level sheet's, the short one the load message's */
  counts(long = true): string {
    const c = this.data, sc = scenarioWords(c.scenarios), n = (x: unknown) => Array.isArray(x) ? x.length : 0;
    const head = long ? `${c.boxes.length} boxes · ${c.props.length} props · ${c.lights.length} lights · ${c.switchables.length} switchables · ${c.doors.length} doors · ${c.routes.length} routes · ${c.volumes.length} volumes · ${Object.keys(c.materials).length} materials`
      : `${c.boxes.length} boxes · ${c.lights.length} lights · ${c.doors.length} doors · ${c.routes.length} routes`;
    return `${head}${long ? '\n' : ' · '}${c.devices.length} devices · ${n(c.civilians)} civilians · ${n(c.vents)} vents · scenarios: ${sc || (c.name === 'office' || c.name.startsWith('office-') ? 'none in the file (the office\'s are levels/office.scenarios.ts)' : 'none')}`;
  }
  /** a structural self-check: serialize → parse → diff against the live document (0 = the file says exactly what the editor holds) */
  roundTripDiffs(): { n: number; first: string[] } { const out: string[] = []; const n = structuralDiff(canonicalLevelData(this.data), canonicalLevelData(parseLevelData(this.serialize())), out, 10); return { n, first: out }; }
  /** an empty level on one floor with the office's palette, sky, a ground slab and the mission marks parked in a corner (v1 needs one of each) */
  static blank(name = 'untitled', palette?: Record<string, MaterialData>): LevelData {
    const materials = palette ? clonePlain(palette) : { concrete: { albedo: [0.42, 0.41, 0.4] as Vec3 }, wall: { albedo: [0.66, 0.64, 0.6] as Vec3 }, carpet: { albedo: [0.13, 0.14, 0.17] as Vec3 }, lino: { albedo: [0.33, 0.33, 0.31] as Vec3 }, wood: { albedo: [0.52, 0.4, 0.27] as Vec3 }, woodDark: { albedo: [0.25, 0.18, 0.12] as Vec3 }, metal: { albedo: [0.3, 0.31, 0.33] as Vec3 }, white: { albedo: [0.8, 0.8, 0.78] as Vec3 }, black: { albedo: [0.04, 0.04, 0.045] as Vec3 }, cardboard: { albedo: [0.58, 0.44, 0.26] as Vec3 }, partTan: { albedo: [0.55, 0.47, 0.35] as Vec3 }, ceiling: { albedo: [0.72, 0.72, 0.7] as Vec3 }, screenOff: { albedo: [0.02, 0.02, 0.025] as Vec3 }, asphalt: { albedo: [0.09, 0.09, 0.1] as Vec3 } };
    return {
      version: LEVEL_DATA_VERSION, name, meta: { grid: 0.25, bounds: { min: [0, -0.25, 0], max: [40, 8, 28] }, notes: 'created in the editor' },
      floors: [{ id: 'f0', name: 'ground floor', y: 0, ceiling: 3 }], materials,
      surfaces: { building: { x0: 4, x1: 36, z0: 4, z1: 24 }, grassEdge: 0, inside: 'carpet', outside: 'asphalt', verge: 'asphalt', zones: [] },
      boxes: [{ id: 'ground', floor: 'f0', group: 'ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'asphalt' in materials ? 'asphalt' : Object.keys(materials)[0] },
              { id: 'breaker_panel', floor: 'f0', group: 'breaker', c: [4.3, 1.4, 4.3], h: [0.02, 0.3, 0.2], albedo: [0.3, 0.31, 0.33] }, { id: 'breaker_led', floor: 'f0', group: 'breaker', c: [4.33, 1.55, 4.3], h: [0.005, 0.01, 0.01], albedo: [0.04, 0.04, 0.045], emissive: [0.3, 4, 0.6], flags: ['NoShadow'] }],
      props: [], lights: [{ id: 'moon', kind: 'dir', pos: [0, 0, 0], dir: [0.45, -0.5, -0.74], color: [0.55, 0.7, 1], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false }],
      switchables: [], doors: [{ id: 'door_0', floor: 'f0', hinge: [10, 10], closedDir: 0, width: LEAF_W }], routes: [], chokepoints: [], volumes: [], devices: [], connectors: [],
      mission: { playerSpawn: [6, 0, 6], objectives: [{ id: 'reach_room', kind: 'reach', area: { x0: 14, x1: 22, z0: 4, z1: 10 }, door: 'door_0' }, { id: 'pull_drive', kind: 'drive', rackIndex: 0, front: [18, 1.1, 7], halfW: 0.33 }, { id: 'exfil', kind: 'exfil', door: 'door_0', x: 36.5, z: 20 }] },
      breaker: { pos: [4.4, 1.4, 4.3], panel: 'breaker_panel', led: 'breaker_led' }, beacons: [],
      sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] }, plans: { roomClear: [] },
    };
  }
}

/** where new cameras hang (m above the floor) and new beams run (shin height: nobody steps over 35 cm) unless the spec says otherwise */
export const CAMERA_HEIGHT = 2.6, LASER_HEIGHT = 0.35;
/** The default spot for a door's keypad: on the key-side face of the wall the door hangs in, a quarter metre past the latch jamb, 1.4 m up, facing out of the wall
 *  (doors.ts geometry: the leaf runs `width` from the hinge along u = (cos, sin)(closedDir) ON THE WALL'S CENTRE LINE; side +1's outward normal is (−u.z, u.x);
 *  interior walls are 12 cm, exterior ones 24). The plate goes 1.5 cm proud of the wall's face — and, given the level's `boxes`, is pushed out of any solid it
 *  would still sit in (a thicker wall, a pilaster beside the frame): a pad inside a wall is a pad nobody sees. */
export function keypadPlacement(door: DoorData, keySide: 1 | -1, floorY = 0, boxes?: readonly BoxData[]): { pos: Vec3; yaw: number } {
  const ux = Math.cos(door.closedDir), uz = Math.sin(door.closedDir); const nx = -uz * keySide, nz = ux * keySide;
  const along = door.width + 0.27, out = (door.exterior ? 0.12 : 0.06) + 0.015;
  let pos: Vec3 = [door.hinge[0] + ux * along + nx * out, floorY + 1.4, door.hinge[1] + uz * along + nz * out];
  if (boxes) for (let iter = 0; iter < 4; iter++) {   // out of whatever solid the point is in, along the pad's facing normal, to its face + 1.5 cm
    let pushed = false;
    for (const b of boxes) {
      if (b.rot || (b.flags ?? []).includes('NoShadow')) continue;
      const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0); const dx = pos[0] - b.c[0], dz = pos[2] - b.c[2];
      const lx = cs * dx - sn * dz, lz = sn * dx + cs * dz, ly = pos[1] - b.c[1];
      if (!(Math.abs(lx) < b.h[0] && Math.abs(ly) < b.h[1] && Math.abs(lz) < b.h[2])) continue;
      const dlx = cs * nx - sn * nz, dlz = sn * nx + cs * nz;   // the normal in the box's frame: exit distance = the nearer slab crossing ahead
      const tx = Math.abs(dlx) > 1e-9 ? ((dlx > 0 ? b.h[0] : -b.h[0]) - lx) / dlx : Infinity, tz = Math.abs(dlz) > 1e-9 ? ((dlz > 0 ? b.h[2] : -b.h[2]) - lz) / dlz : Infinity;
      const t = Math.min(tx, tz); if (!Number.isFinite(t)) continue;
      pos = [pos[0] + nx * (t + 0.015), pos[1], pos[2] + nz * (t + 0.015)]; pushed = true; break;
    }
    if (!pushed) break;
  }
  return { pos: roundVec(pos), yaw: round6(Math.atan2(nx, nz)) };
}
