// Mouse / keyboard interaction in the view: the SELECT tool (click, shift-click, marquee; drag = move on the floor, Alt-drag = vertical; S = face
// handles to resize, R = a ring to yaw, G = back to move), the one-shot placement tools (B box footprint, V volume footprint, L light, D door
// hinge→direction, P route waypoints), keyboard nudges / delete / duplicate, and the camera (RMB orbit, MMB or Space+LMB pan, wheel zoom).
// Every edit goes through Editor (so it is one undoable command, coalesced per gesture); nothing here touches the DOM — the overlay draws
// what `this` exposes (hover, handles, marquee, drafts) and the page maps `cursor`. Headless probes drive it with a synthetic pointer.
import { Vec3, v3 } from '../math/vec';
import type { BoxData, LightData, DoorData, RouteData, VolumeData, DeviceData } from '../scene/levelData';
import { DEVICE_DEFAULTS } from '../scene/levelData';
import { Editor, parseRef } from './editor';
import { Scene } from './scene';
import { View } from './view';
import { Face, faceCentre, snapTo, snapVec, roundVec, BOX_PRESETS, LIGHT_PRESETS, VOLUME_KINDS } from './geom';
import { makeBox, BoxFlag } from '../scene/boxes';
import { LEAF_W, LEAF_H, hingeOnCell } from '../scene/doorSize';

/** what Tools reads off the page's Input (game/input.ts satisfies it; the probes hand in a plain object) */
export interface Pointer { mouseX: number; mouseY: number; buttons: number; clicked: number; wheel: number; wheelCtrl: number; keys: Set<string>; pressed: Set<string> }
export type ToolName = 'select' | 'box' | 'volume' | 'light' | 'door' | 'route' | 'camera' | 'keypad' | 'laser';
export type GizmoMode = 'move' | 'resize' | 'rotate';
export interface Handle { id: string; kind: 'face' | 'ring' | 'aim' | 'doorEnd' | 'camAim' | 'laserEnd'; ref: string; face?: Face; /** laserEnd: 0 = emitter, 1 = receiver */ end?: 0 | 1; /** screen px */ x: number; y: number; /** world */ p: Vec3; pts?: [number, number][] }
export interface IconPt { ref: string; x: number; y: number; p: Vec3; kind: 'light' | 'waypoint' | 'mark' | 'hinge' | 'post' | 'sun' | 'camera' | 'keypad' | 'laser' }

type Drag =
  | { kind: 'move'; refs: string[]; start: Vec3; y: number; applied: Vec3; vertical: boolean; my0: number; mpp: number; key: string; moved: boolean; mx0: number; myS: number }
  | { kind: 'face'; ref: string; face: Face; origin: Vec3; n: Vec3; applied: number; key: string; sx: number; sy: number; dir: [number, number]; pxPerM: number }
  | { kind: 'ring'; refs: string[]; centre: Vec3; a0: number; yaw0: Map<string, number>; applied: number; key: string }
  | { kind: 'aim'; ref: string; key: string }
  | { kind: 'doorEnd'; ref: string; key: string }
  | { kind: 'camAim'; ref: string; key: string }
  | { kind: 'laserEnd'; ref: string; end: 0 | 1; key: string; y: number }
  | { kind: 'laserPlace'; from: Vec3 }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; add: boolean; clicked: string | null }
  | { kind: 'footprint'; tool: 'box' | 'volume'; a: Vec3; id: string | null; y: number }
  | { kind: 'doorPlace'; hinge: Vec3 }
  | { kind: 'orbit'; lx: number; ly: number }
  | { kind: 'pan'; lx: number; ly: number };

let dragSeq = 0;

export class Tools {
  tool: ToolName = 'select';
  mode: GizmoMode = 'move';
  boxPreset = 'wall'; lightPreset = 'bulb'; volumeKind: typeof VOLUME_KINDS[number] = 'hide';
  /** door tool: cut the wall + build the frame when the door lands */
  doorAuto = true;
  hover: { ref: string; point: Vec3 } | null = null;
  hot: Handle | null = null;
  handles: Handle[] = []; icons: IconPt[] = [];
  drag: Drag | null = null;
  routeDraft: Vec3[] | null = null;
  /** ground point under the cursor on the current floor (snapped if snap is on) — the overlay's crosshair */
  cursor3: Vec3 | null = null;
  cursor = 'default';
  private lastMX = 0; private lastMY = 0; private downAt: { x: number; y: number; ref: string | null; shift: boolean } | null = null; private wasDown = false;
  private lastClickT = -1; private lastClickRef: string | null = null;
  onToolChange: (() => void)[] = [];
  /** the inspector's tabs (the page's Ui wires them): M = Materials; K = Markings for the selected box (returns false when no box is selected — K is then the keypad tool as before) */
  panes: { materials?: () => void; markings?: () => boolean } = {};

  constructor(readonly ed: Editor, readonly scene: Scene, readonly view: View) {}

  setTool(t: ToolName) { if (this.tool === t) return; this.cancel(); this.tool = t; this.ed.msg(TOOL_HINT[t]); for (const f of this.onToolChange) f(); }
  setMode(m: GizmoMode) { this.mode = m; this.ed.msg(m === 'move' ? 'move: drag the selection on the floor (Alt = up/down)' : m === 'resize' ? 'resize: drag a face handle (one box selected)' : 'rotate: drag the ring (Ctrl = 15° steps)'); for (const f of this.onToolChange) f(); }
  /** abandon whatever is in progress (Esc): an open footprint rolls back, a route draft is dropped, a drag is sealed where it is */
  cancel() {
    const d = this.drag;
    if (d?.kind === 'footprint' && d.id) this.ed.doc.rollback();
    if (d && (d.kind === 'move' || d.kind === 'face' || d.kind === 'ring' || d.kind === 'aim' || d.kind === 'doorEnd' || d.kind === 'camAim' || d.kind === 'laserEnd')) this.ed.doc.seal();
    this.drag = null; this.routeDraft = null; this.downAt = null;
  }
  private floorY() { return this.ed.floor().y; }
  private snap(p: Vec3): Vec3 { return this.ed.settings.snap ? snapVec(p, this.ed.settings.snapStep) : p; }
  private snapD(v: number): number { return this.ed.settings.snap ? snapTo(v, this.ed.settings.snapStep) : v; }
  private mod(p: Pointer, k: 'shift' | 'ctrl' | 'alt' | 'space' | 'meta') { const K = p.keys; return k === 'shift' ? K.has('ShiftLeft') || K.has('ShiftRight') : k === 'ctrl' ? K.has('ControlLeft') || K.has('ControlRight') : k === 'alt' ? K.has('AltLeft') || K.has('AltRight') : k === 'meta' ? K.has('MetaLeft') || K.has('MetaRight') : K.has('Space'); }

  // ---------------------------------------------------------------- per frame
  update(p: Pointer, dt: number) {
    const view = this.view; void dt;
    { const d = this.drag as { kind: string; ref?: string; refs?: string[]; tool?: string; id?: string | null } | null;   // (a drag whose thing went from under it — an undo or a delete by the menu or the API — is dropped where it is: moving a thing that is gone threw, and a throw here stops the page's loop)
      if (d && ((d.ref !== undefined && !this.ed.exists(d.ref)) || d.refs?.some(r => !this.ed.exists(r)) || (d.kind === 'footprint' && d.id && !this.ed.doc.get(d.tool === 'box' ? 'boxes' : 'volumes', d.id)))) { this.drag = null; this.downAt = null; } }
    const mx = p.mouseX, my = p.mouseY; const dmx = mx - this.lastMX, dmy = my - this.lastMY; this.lastMX = mx; this.lastMY = my;
    const lmb = (p.buttons & 1) !== 0, mmb = (p.buttons & 2) !== 0, rmb = (p.buttons & 4) !== 0;
    const lHit = (p.clicked & 1) !== 0; const released = this.wasDown && !lmb; this.wasDown = lmb;
    const fy = this.floorY();
    // ---- camera: RMB orbit, MMB / Space+LMB pan, wheel zoom (about the cursor's floor point)
    if (rmb && !this.drag) { view.orbit(dmx, dmy); this.cursor = 'grabbing'; }
    if ((mmb || (this.mod(p, 'space') && lmb)) && (!this.drag || this.drag.kind === 'pan')) { if (!this.drag) this.drag = { kind: 'pan', lx: mx, ly: my }; view.pan(dmx, dmy); this.cursor = 'move'; }
    if (this.drag?.kind === 'pan' && !mmb && !(this.mod(p, 'space') && lmb)) this.drag = null;
    const wheel = p.wheel + p.wheelCtrl; if (wheel) view.zoom(wheel, mx, my, fy);
    // ---- keys
    this.keys(p);
    // ---- hover: handles → icons → geometry
    const g = view.groundAt(mx, my, fy); this.cursor3 = g ? this.snap(g) : null;
    this.computeHandles(); this.computeIcons();
    if (!this.drag || this.drag.kind === 'marquee') {
      this.hot = null; let bestD = 9;
      if (this.tool === 'select') for (const h of this.handles) { const d = h.kind === 'ring' && h.pts ? distPolyline(mx, my, h.pts) : Math.hypot(h.x - mx, h.y - my); if (d < bestD) { bestD = d; this.hot = h; } }
      let icon: IconPt | null = null; let bi = 10; for (const ic of this.icons) { const d = Math.hypot(ic.x - mx, ic.y - my); if (d < bi) { bi = d; icon = ic; } }
      if (this.hot) this.hover = null;
      else if (icon) this.hover = { ref: icon.ref, point: icon.p };
      else { const { ro, rd } = view.ray(mx, my); const hit = this.scene.pick(ro, rd); this.hover = hit ? { ref: hit.ref, point: hit.point } : null; }
    }
    if (!rmb && !this.drag) this.cursor = this.tool !== 'select' ? 'crosshair' : this.hot ? (this.hot.kind === 'ring' ? 'alias' : this.hot.kind === 'face' ? 'ew-resize' : 'crosshair') : this.hover ? 'pointer' : 'default';

    // ---- press
    if (lHit && !this.mod(p, 'space') && !rmb) this.press(p, mx, my);
    // ---- held
    if (lmb && this.drag) this.dragMove(p, mx, my);
    // ---- release
    if (released) this.release(p, mx, my);
    if (!lmb && this.drag && this.drag.kind !== 'pan' && this.drag.kind !== 'orbit') { /* button lost outside the view */ this.release(p, mx, my); }
  }

  private press(p: Pointer, mx: number, my: number) {
    const ed = this.ed; const fy = this.floorY(); const shift = this.mod(p, 'shift');
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.tool === 'select') {
      if (this.hot) { this.startHandleDrag(this.hot, mx, my); return; }
      const ref = this.hover?.ref ?? null;
      this.downAt = { x: mx, y: my, ref, shift };
      if (ref) {
        const dbl = this.lastClickRef === ref && now - this.lastClickT < 350; this.lastClickT = now; this.lastClickRef = ref;
        const wasSel = ed.sel.has(ref);
        if (shift) ed.select(ref, 'toggle');
        else if (!wasSel) ed.select(ref);
        if (dbl) { const r = parseRef(ref); if (r.kind === 'box') { const sw = ed.switchableOf(r.id); if (sw) ed.select(sw.boxes.map(b => `box:${b}`)); else { const b = ed.doc.get<BoxData>('boxes', r.id); if (b?.group) ed.select(ed.data.boxes.filter(x => x.group === b.group && (x.floor ?? ed.data.floors[0].id) === (b.floor ?? ed.data.floors[0].id)).map(x => `box:${x.id}`)); } ed.msg(`selected ${ed.sel.size} (double-click: the switchable / group)`); } }
        if (wasSel && !shift && ed.sel.has(ref)) {   // something ALREADY selected: press-drag moves the whole selection, grabbed at the hovered point's height
          const grabY = this.hover!.point[1]; const start = this.view.groundAt(mx, my, grabY) ?? this.hover!.point;
          this.drag = { kind: 'move', refs: [...ed.sel], start, y: grabY, applied: [0, 0, 0], vertical: this.mod(p, 'alt'), my0: my, mpp: this.view.mPerPx(start), key: `drag${++dragSeq}`, moved: false, mx0: mx, myS: my };
        } else this.drag = { kind: 'marquee', x0: mx, y0: my, x1: mx, y1: my, add: shift, clicked: ref };   // freshly selected by this press: a drag from here is a marquee (the floor is always under the cursor — click first, then drag to move)
      } else this.drag = { kind: 'marquee', x0: mx, y0: my, x1: mx, y1: my, add: shift, clicked: null };
      return;
    }
    const g = this.view.groundAt(mx, my, fy); if (!g) return; const at = this.snap(g);
    if (this.tool === 'box' || this.tool === 'volume') { this.drag = { kind: 'footprint', tool: this.tool, a: at, id: null, y: fy }; return; }
    if (this.tool === 'light') { const id = ed.addLight({ preset: this.lightPreset, pos: [at[0], 0, at[2]] }); ed.msg(`light ${id} placed — drag it, aim it by its target dot, edit it on the right`); this.setTool('select'); return; }
    if (this.tool === 'door') { this.drag = { kind: 'doorPlace', hinge: at }; return; }
    if (this.tool === 'camera') {   // hung at CAMERA_HEIGHT over the click, looking the way the view looks (level): then R turns it, its aim dot points it, the sheet does the rest
      const f = this.view.cam.planarBasis().fwd; const yaw = +Math.atan2(f[0], f[2]).toFixed(4);
      try { const id = ed.addDevice({ kind: 'camera', pos: [at[0], 0, at[2]], yaw }); ed.msg(`camera ${id} hung ${'2.6'} m over (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) — drag its aim dot, R to turn, pitch / cone / sweep on the right`); } catch (e) { ed.msg(String((e as Error).message)); }
      this.setTool('select'); return;
    }
    if (this.tool === 'keypad') {   // the door nearest the click gets the pad, on the face the click is on: the door is locked on the pad's own lock in the same command
      try { const id = ed.addDevice({ kind: 'keypad', pos: [g[0], 0, g[2]] }); const v = ed.doc.get<any>('devices', id); ed.msg(`keypad ${id} on door ${v?.door} (code ${v?.code} — change it on the right); the door is now locked on lock '${id}'`); } catch (e) { ed.msg(String((e as Error).message)); }
      this.setTool('select'); return;
    }
    if (this.tool === 'laser') { this.drag = { kind: 'laserPlace', from: at }; ed.msg('laser: drag to the receiver and let go (shin height; the sheet raises it)'); return; }
    if (this.tool === 'route') {
      const pt: Vec3 = [at[0], 0, at[2]]; const draft = this.routeDraft ??= [];
      const last = draft[draft.length - 1]; const dbl = last && Math.hypot(last[0] - pt[0], last[2] - pt[2]) < 0.05 && now - this.lastClickT < 400; this.lastClickT = now;
      if (dbl) { this.finishRoute(); return; }
      draft.push(pt); ed.msg(`route: ${draft.length} point${draft.length === 1 ? '' : 's'} — click on, Enter (or double-click) to finish, Backspace drops the last, Esc cancels`);
    }
  }
  private startHandleDrag(h: Handle, mx: number, my: number) {
    const ed = this.ed;
    if (h.kind === 'face') {
      const b = ed.doc.get<BoxData>('boxes', parseRef(h.ref).id)!; const fc = faceCentre(b.c as Vec3, b.h as Vec3, b.yaw ?? 0, h.face!);
      const [x0, y0] = this.view.project(fc.p); const [x1, y1] = this.view.project(v3.mad(fc.p, fc.n, 0.25)); const dx = x1 - x0, dy = y1 - y0; const L = Math.hypot(dx, dy) || 1e-6;
      this.drag = { kind: 'face', ref: h.ref, face: h.face!, origin: fc.p, n: fc.n, applied: 0, key: `face${++dragSeq}`, sx: mx, sy: my, dir: [dx / L, dy / L], pxPerM: Math.max(40, L / 0.25) };
    } else if (h.kind === 'ring') {
      const c = h.p; const [cx, cy] = this.view.project(c); const yaw0 = new Map<string, number>();
      for (const r of ed.selection()) { const q = parseRef(r); const e: any = q.kind === 'box' ? ed.doc.get('boxes', q.id) : q.kind === 'volume' ? ed.doc.get('volumes', q.id) : q.kind === 'prop' ? ed.doc.get('props', q.id) : q.kind === 'door' ? ed.doc.get('doors', q.id) : q.kind === 'device' ? ed.doc.get('devices', q.id) : null; if (e) yaw0.set(r, q.kind === 'door' ? -(e.closedDir ?? 0) : q.kind === 'device' ? deviceYaw(e) : (e.yaw ?? 0)); }
      this.drag = { kind: 'ring', refs: [...yaw0.keys()], centre: c, a0: Math.atan2(my - cy, mx - cx), yaw0, applied: 0, key: `ring${++dragSeq}` };
    } else if (h.kind === 'aim') this.drag = { kind: 'aim', ref: h.ref, key: `aim${++dragSeq}` };
    else if (h.kind === 'doorEnd') this.drag = { kind: 'doorEnd', ref: h.ref, key: `dend${++dragSeq}` };
    else if (h.kind === 'camAim') this.drag = { kind: 'camAim', ref: h.ref, key: `caim${++dragSeq}` };
    else if (h.kind === 'laserEnd') this.drag = { kind: 'laserEnd', ref: h.ref, end: h.end!, key: `lend${++dragSeq}`, y: h.p[1] };
  }
  private dragMove(p: Pointer, mx: number, my: number) {
    const ed = this.ed; const d = this.drag!;
    switch (d.kind) {
      case 'move': {
        if (!d.moved && Math.hypot(mx - d.mx0, my - d.myS) < 4) return;   // a click, so far
        d.moved = true; this.cursor = 'grabbing';
        let want: Vec3;
        if (d.vertical || this.mod(p, 'alt')) { d.vertical = true; want = [d.applied[0], this.snapD((d.my0 - my) * d.mpp), d.applied[2]]; }
        else { const g = this.view.groundAt(mx, my, d.y); if (!g) return; want = [this.snapD(g[0] - d.start[0]), d.applied[1], this.snapD(g[2] - d.start[2])]; }
        const step: Vec3 = [want[0] - d.applied[0], want[1] - d.applied[1], want[2] - d.applied[2]];
        if (step[0] || step[1] || step[2]) { ed.move(d.refs, step, { coalesce: d.key, label: `drag ${d.refs.length === 1 ? d.refs[0] : d.refs.length + ' things'}` }); d.applied = want; }
        break;
      }
      case 'face': {
        const along = ((mx - d.sx) * d.dir[0] + (my - d.sy) * d.dir[1]) / d.pxPerM;
        const want = this.snapD(along); const step = want - d.applied;
        if (Math.abs(step) > 1e-9) { ed.resizeBox(parseRef(d.ref).id, d.face, step, { coalesce: d.key }); d.applied = want; }
        break;
      }
      case 'ring': {
        const [cx, cy] = this.view.project(d.centre); const a = Math.atan2(my - cy, mx - cx);
        let total = -(a - d.a0);   // screen angle grows clockwise (y down); world yaw about +Y seen from above grows counter-clockwise
        if (this.view.cam.pitch < 0) total = -total;
        const snapDeg = this.mod(p, 'ctrl') ? ed.settings.rotSnapDeg : 0;
        // apply per ref so a Ctrl-snapped rotation lands each on a multiple of the step from ITS start
        for (const r of d.refs) { const y0 = d.yaw0.get(r) ?? 0; let target = y0 + total; if (snapDeg) target = snapTo(target, snapDeg * Math.PI / 180); const q = parseRef(r); const cur = q.kind === 'door' ? -(ed.doc.get<DoorData>('doors', q.id)?.closedDir ?? 0) : q.kind === 'device' ? deviceYaw(ed.doc.get<DeviceData>('devices', q.id)) : ((ed.doc.get<any>(q.kind === 'box' ? 'boxes' : q.kind === 'volume' ? 'volumes' : 'props', q.id)?.yaw) ?? 0); const step = target - cur; if (Math.abs(step) > 1e-7) ed.rotate([r], step, { coalesce: d.key }); }
        d.applied = total; break;
      }
      case 'aim': { const l = ed.doc.get<LightData>('lights', parseRef(d.ref).id); if (!l) break; const g = this.view.groundAt(mx, my, this.floorY()); if (g) ed.aimLight(l.id, this.snap(g), { coalesce: d.key }); break; }
      case 'doorEnd': {
        const o = ed.doc.get<DoorData>('doors', parseRef(d.ref).id); if (!o) break; const g = this.view.groundAt(mx, my, this.floorY()); if (!g) break;
        const dx = g[0] - o.hinge[0], dz = g[2] - o.hinge[1]; let ang = Math.atan2(dz, dx); if (!this.mod(p, 'alt')) ang = snapTo(ang, Math.PI / 2);
        const w = Math.max(0.5, Math.min(2.4, this.snapD(Math.hypot(dx, dz)) || o.width));
        ed.updateDoor(o.id, { closedDir: +ang.toFixed(6), width: +w.toFixed(6) }, { coalesce: d.key, label: `swing ${o.id}` }); break;
      }
      case 'camAim': { const g = this.view.groundAt(mx, my, this.floorY()); if (g) ed.aimCamera(parseRef(d.ref).id, this.snap(g), { coalesce: d.key }); break; }   // the floor spot the lens should look at (yaw + pitch)
      case 'laserEnd': { const g = this.view.groundAt(mx, my, d.y); if (g) { const q = this.snap(g); ed.moveLaserEnd(parseRef(d.ref).id, d.end, [q[0], d.y, q[2]], { coalesce: d.key }); } break; }   // slide one end at the beam's own height
      case 'marquee': d.x1 = mx; d.y1 = my; break;
      case 'laserPlace': break;
      case 'footprint': {
        const g = this.view.groundAt(mx, my, d.y); if (!g) break; const b = this.snap(g);
        if (!d.id) { if (Math.hypot(b[0] - d.a[0], b[2] - d.a[2]) < 0.02) break; ed.doc.begin(d.tool === 'box' ? `draw ${this.boxPreset}` : `draw ${this.volumeKind} volume`); d.id = d.tool === 'box' ? ed.addBox({ preset: this.boxPreset, ...cornersToBox(ed, this.boxPreset, d.a, b) }, { select: false }) : ed.addVolume({ kind: this.volumeKind, ...cornersToVolume(d.a, b, d.y) }, { select: false }); }
        else if (d.tool === 'box') { const spec = cornersToBox(ed, this.boxPreset, d.a, b); ed.updateBox(d.id, { c: spec.c, h: spec.h }, { coalesce: 'fp' }); }
        else { const spec = cornersToVolume(d.a, b, d.y); ed.updateVolume(d.id, { c: spec.c, h: spec.h }, { coalesce: 'fp' }); }
        break;
      }
      case 'doorPlace': break;
      default: break;
    }
  }
  private release(p: Pointer, mx: number, my: number) {
    const ed = this.ed; const d = this.drag; this.drag = null;
    if (!d) { if (this.downAt && !this.downAt.ref && !this.downAt.shift && this.tool === 'select') ed.select(null); this.downAt = null; return; }
    switch (d.kind) {
      case 'move': if (!d.moved && this.downAt?.ref && !this.downAt.shift && ed.sel.size > 1 && ed.sel.has(this.downAt.ref)) ed.select(this.downAt.ref); ed.doc.seal(); break;   // a plain click inside a multi-selection narrows to that one
      case 'face': case 'ring': case 'aim': case 'doorEnd': case 'camAim': case 'laserEnd': ed.doc.seal(); break;
      case 'laserPlace': {
        const g = this.view.groundAt(mx, my, this.floorY()); const a = d.from; const b = g ? this.snap(g) : null;
        if (!b || Math.hypot(b[0] - a[0], b[2] - a[2]) < 0.2) { ed.msg('laser: drag from the emitter to the receiver (a click is not a beam)'); this.setTool('select'); break; }
        try { const id = ed.addDevice({ kind: 'laser', from: [a[0], 0, a[2]], to: [b[0], 0, b[2]] }); ed.msg(`laser ${id}: ${Math.hypot(b[0] - a[0], b[2] - a[2]).toFixed(2)} m at shin height — raise it on the right (≥ 1.2 m = crouch under), drag an end to re-run it`); } catch (e) { ed.msg(String((e as Error).message)); }
        this.setTool('select'); break;
      }
      case 'marquee': {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        if (x1 - x0 < 4 && y1 - y0 < 4) { if (!d.add && !d.clicked) ed.select(null); break; }   // a plain click: on nothing clears, on a thing the press already selected it
        const inside: string[] = []; const F = ed.floor().id, F0 = ed.data.floors[0].id;
        const test = (ref: string, wp: Vec3 | null) => { if (!wp) return; const [sx, sy, ok] = this.view.project(wp); if (ok && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) inside.push(ref); };
        for (const b of ed.data.boxes) { if ((b.floor ?? F0) !== F) continue; if (!ed.settings.showHidden && b.flags?.includes('NoPrimary')) continue; test(`box:${b.id}`, b.c as Vec3); }
        for (const l of ed.data.lights) if (l.kind !== 'dir') test(`light:${l.id}`, l.pos as Vec3);
        for (const o of ed.data.doors) if ((o.floor ?? F0) === F) test(`door:${o.id}`, [o.hinge[0], 1, o.hinge[1]]);
        for (const v of ed.data.volumes) if ((v.floor ?? F0) === F) test(`volume:${v.id}`, v.c as Vec3);
        for (const pr of ed.data.props) if ((pr.floor ?? F0) === F) test(`prop:${pr.id}`, [pr.x, 0.4, pr.z]);
        for (const r of ed.data.routes) r.points.forEach((q, i) => test(`route:${r.id}#${i}`, q as Vec3));
        for (const v of ed.data.devices) if ((v.floor ?? F0) === F) test(`device:${v.id}`, v.kind === 'laser' ? [(v.from[0] + v.to[0]) / 2, (v.from[1] + v.to[1]) / 2, (v.from[2] + v.to[2]) / 2] : v.pos as Vec3);
        ed.select(inside, d.add ? 'add' : 'replace'); ed.msg(`marquee: ${inside.length} selected`);
        break;
      }
      case 'footprint': {
        if (!d.id) {   // a click: the preset's default footprint about the point
          if (d.tool === 'box') { const id = ed.addBox({ preset: this.boxPreset, c: [d.a[0], 0, d.a[2]] }); ed.msg(`${this.boxPreset} ${id} placed (default size) — drag a footprint next time for a size`); }
          else { const id = ed.addVolume({ kind: this.volumeKind, c: [d.a[0], d.y + 0.5, d.a[2]], h: [0.5, 0.5, 0.5] }); ed.msg(`${this.volumeKind} volume ${id} placed`); }
        } else { ed.doc.commit(); ed.doc.seal(); ed.select(`${d.tool === 'box' ? 'box' : 'volume'}:${d.id}`); ed.msg(`${d.tool === 'box' ? this.boxPreset : this.volumeKind + ' volume'} ${d.id} drawn`); }
        this.setTool('select'); break;
      }
      case 'doorPlace': {
        const g = this.view.groundAt(mx, my, this.floorY()); const { hinge: hg, ang, w } = this.doorDrag(d.hinge, g, this.mod(p, 'alt')), h = [hg[0], 0, hg[1]];
        const id = ed.addDoor({ hinge: hg, closedDir: +ang.toFixed(6), width: +w.toFixed(6) }, { cut: this.doorAuto, frame: this.doorAuto });
        const nf = ed.data.boxes.filter(b => b.group === `doorframe.${id}`).length;
        ed.msg(`door ${id}: hinge (${h[0].toFixed(2)}, ${h[2].toFixed(2)}), ${(ang * 180 / Math.PI).toFixed(0)}°, ${w.toFixed(2)} m${this.doorAuto ? ` — opening cut, ${nf} frame boxes` : ''}`);
        this.setTool('select'); break;
      }
      default: break;
    }
    this.downAt = null;
  }
  finishRoute() {
    const draft = this.routeDraft; this.routeDraft = null;
    if (!draft || !draft.length) { this.setTool('select'); return null; }
    const id = this.ed.addRoute({ points: draft }); this.ed.msg(`route ${id}: ${draft.length} points — set waits / weapon on the right; drag points to adjust`); this.setTool('select'); return id;
  }

  // ---------------------------------------------------------------- keys (plain keys via the pointer's pressed set; chords are the page's)
  private keys(p: Pointer) {
    const hit = (c: string) => p.pressed.has(c); const ed = this.ed;
    if (hit('Escape')) { if (this.drag || this.routeDraft) { this.cancel(); ed.msg('cancelled'); } else if (this.tool !== 'select') this.setTool('select'); else if (ed.sel.size) ed.select(null); }
    if (hit('Enter') && this.routeDraft) this.finishRoute();
    if (hit('Backspace') && this.routeDraft) { this.routeDraft.pop(); return; }
    if (this.mod(p, 'ctrl') || this.mod(p, 'meta')) return;   // chords belong to the page (undo / redo / duplicate / save)
    if (hit('KeyG')) this.setMode('move'); if (hit('KeyS')) this.setMode('resize'); if (hit('KeyR')) this.setMode('rotate');
    if (hit('KeyB')) this.setTool('box'); if (hit('KeyV')) this.setTool('volume'); if (hit('KeyL')) this.setTool('light'); if (hit('KeyD')) this.setTool('door'); if (hit('KeyP')) this.setTool('route');
    if (hit('KeyC')) this.setTool('camera'); if (hit('KeyK') && !this.panes.markings?.()) this.setTool('keypad'); if (hit('KeyJ')) this.setTool('laser');
    if (hit('KeyM')) this.panes.materials?.();
    if (hit('KeyT')) { this.view.togglePlan(); ed.msg(this.view.plan ? 'plan view (T toggles back)' : 'orbit view'); }
    if (hit('KeyF')) this.frameSelection();
    if (hit('KeyX')) { ed.set('snap', !ed.settings.snap); ed.msg(`snap ${ed.settings.snap ? `on (${ed.settings.snapStep} m)` : 'off'}`); }
    if (hit('KeyO')) { ed.set('grid', !ed.settings.grid); }
    if (hit('KeyH')) { ed.set('showHidden', !ed.settings.showHidden); ed.msg(ed.settings.showHidden ? 'hidden (NoPrimary) boxes shown + pickable' : 'hidden boxes as the game camera sees them'); }
    if (hit('KeyN')) { if (ed.data.daylight) { ed.set('day', !ed.settings.day); ed.msg(ed.settings.day ? 'daylight variant (data.daylight)' : 'night'); } else ed.msg('this level has no daylight variant'); }
    if ((hit('Delete') || hit('Backspace')) && ed.sel.size && !this.drag) { try { const n = ed.sel.size; ed.delete(ed.selection()); ed.msg(`deleted ${n}`); } catch (e) { ed.msg(String((e as Error).message)); } }   // (not mid-drag: the drag's next frame would move a thing that is gone)
    const fine = this.mod(p, 'shift'); const step = fine ? Math.max(0.01, ed.settings.snapStep / 5) : ed.settings.snapStep; const alt = this.mod(p, 'alt');
    if (ed.sel.size) {
      const { fwd, right } = this.view.cam.planarBasis();   // arrows move in SCREEN terms: up = away from the camera, snapped to the dominant world axis
      const axis = (v: Vec3): Vec3 => Math.abs(v[0]) >= Math.abs(v[2]) ? [Math.sign(v[0]), 0, 0] : [0, 0, Math.sign(v[2])];
      const F = axis(fwd), Rt = axis(right);
      if (hit('ArrowUp')) alt ? ed.nudge(ed.selection(), 0, 0, step) : ed.nudge(ed.selection(), F[0] * step, F[2] * step);
      if (hit('ArrowDown')) alt ? ed.nudge(ed.selection(), 0, 0, -step) : ed.nudge(ed.selection(), -F[0] * step, -F[2] * step);
      if (hit('ArrowLeft')) ed.nudge(ed.selection(), -Rt[0] * step, -Rt[2] * step);
      if (hit('ArrowRight')) ed.nudge(ed.selection(), Rt[0] * step, Rt[2] * step);
      if (hit('PageUp')) ed.nudge(ed.selection(), 0, 0, step); if (hit('PageDown')) ed.nudge(ed.selection(), 0, 0, -step);
    }
  }
  /** F: frame the selection (or the whole level) */
  frameSelection() {
    const ed = this.ed; let min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    const grow = (p: Vec3, r = 0.5) => { min = v3.min(min, v3.sub(p, [r, r, r])); max = v3.max(max, v3.add(p, [r, r, r])); };
    if (ed.sel.size) for (const ref of ed.sel) { const r = parseRef(ref); if (r.kind === 'box') { const b = ed.doc.get<BoxData>('boxes', r.id); if (b) grow(b.c as Vec3, Math.max(b.h[0], b.h[1], b.h[2])); } else if (r.kind === 'route' && r.sub === undefined) { for (const q of ed.doc.get<RouteData>('routes', r.id)?.points ?? []) grow(q as Vec3); } else { const q = ed.posOf(ref); if (q) grow(q, 1); } }
    else { const B = ed.data.surfaces?.building; if (B) { min = [B.x0, 0, B.z0]; max = [B.x1, 3, B.z1]; } else for (const b of ed.data.boxes) grow(b.c as Vec3, Math.max(b.h[0], b.h[2])); }
    if (min[0] === Infinity) return;
    this.view.frame(min, max); ed.msg(ed.sel.size ? `framed ${ed.sel.size} selected` : 'framed the level');
  }

  // ---------------------------------------------------------------- handles + icons for this frame (screen space)
  private computeHandles() {
    const ed = this.ed; const H: Handle[] = this.handles = [];
    const pr = ed.primary();
    if (pr?.kind === 'box' && this.mode === 'resize') {
      const b = ed.doc.get<BoxData>('boxes', pr.id); if (b) for (let f = 0 as Face; f < 6; f++) { const fc = faceCentre(b.c as Vec3, b.h as Vec3, b.yaw ?? 0, f as Face); const [x, y, ok] = this.view.project(fc.p); if (ok) H.push({ id: `face${f}`, kind: 'face', ref: `box:${b.id}`, face: f as Face, x, y, p: fc.p }); }
    }
    if (this.mode === 'rotate' && ed.sel.size) {
      const rot = ed.selection().filter(r => ['box', 'volume', 'prop', 'door', 'device'].includes(parseRef(r).kind));
      if (rot.length) {
        let c: Vec3 = [0, 0, 0]; let rad = 0.6; const ps = rot.map(r => ed.posOf(r)!).filter(Boolean); for (const q of ps) c = v3.add(c, q); c = v3.scale(c, 1 / Math.max(1, ps.length));
        if (rot.length === 1 && parseRef(rot[0]).kind === 'box') { const b = ed.doc.get<BoxData>('boxes', parseRef(rot[0]).id)!; rad = Math.max(0.4, Math.hypot(b.h[0], b.h[2]) * 1.1 + 0.15); c = b.c as Vec3; } else for (const q of ps) rad = Math.max(rad, Math.hypot(q[0] - c[0], q[2] - c[2]) + 0.5);
        const pts: [number, number][] = []; for (let k = 0; k <= 48; k++) { const t = (k / 48) * Math.PI * 2; const [x, y] = this.view.project([c[0] + Math.cos(t) * rad, c[1], c[2] + Math.sin(t) * rad]); pts.push([x, y]); }
        const [x, y] = this.view.project([c[0] + rad, c[1], c[2]]);
        H.push({ id: 'ring', kind: 'ring', ref: rot[0], x, y, p: c, pts });
      }
    }
    if (pr?.kind === 'light') { const l = ed.doc.get<LightData>('lights', pr.id); if (l && l.kind !== 'point') { const fy = this.floorY(); const t = l.dir[1] < -1e-3 ? Math.min(l.range, (l.pos[1] - fy) / -l.dir[1]) : Math.min(l.range, 3); const tp: Vec3 = [l.pos[0] + l.dir[0] * t, l.pos[1] + l.dir[1] * t, l.pos[2] + l.dir[2] * t]; const [x, y, ok] = this.view.project(tp); if (ok) H.push({ id: 'aim', kind: 'aim', ref: `light:${l.id}`, x, y, p: tp }); } }
    if (pr?.kind === 'door') { const o = ed.doc.get<DoorData>('doors', pr.id); if (o) { const e: Vec3 = [o.hinge[0] + Math.cos(o.closedDir) * o.width, this.floorY() + 0.05, o.hinge[1] + Math.sin(o.closedDir) * o.width]; const [x, y, ok] = this.view.project(e); if (ok) H.push({ id: 'doorEnd', kind: 'doorEnd', ref: `door:${o.id}`, x, y, p: e }); } }
    if (pr?.kind === 'device') {
      const v = ed.doc.get<DeviceData>('devices', pr.id);
      if (v?.kind === 'camera') { const tp = cameraAimPoint(v, this.floorY()); const [x, y, ok] = this.view.project(tp); if (ok) H.push({ id: 'camAim', kind: 'camAim', ref: `device:${v.id}`, x, y, p: tp }); }
      else if (v?.kind === 'laser') for (const end of [0, 1] as const) { const q = end ? v.to : v.from; const [x, y, ok] = this.view.project(q as Vec3); if (ok) H.push({ id: `lend${end}`, kind: 'laserEnd', ref: `device:${v.id}`, end, x, y, p: q as Vec3 }); }
    }
  }
  private computeIcons() {
    const ed = this.ed; const I: IconPt[] = this.icons = []; const F = ed.floor().id, F0 = ed.data.floors[0].id; const fy = this.floorY();
    const push = (ref: string, p: Vec3, kind: IconPt['kind']) => { const [x, y, ok] = this.view.project(p); if (ok && x > -50 && y > -50 && x < this.view.w + 50 && y < this.view.h + 50) I.push({ ref, x, y, p, kind }); };
    for (const l of ed.data.lights) if (l.kind !== 'dir') push(`light:${l.id}`, l.pos as Vec3, 'light');
    for (const r of ed.data.routes) r.points.forEach((q, i) => push(`route:${r.id}#${i}`, [q[0], fy + 0.02, q[2]], 'waypoint'));
    for (const o of ed.data.doors) if ((o.floor ?? F0) === F) push(`door:${o.id}`, [o.hinge[0], fy + 0.05, o.hinge[1]], 'hinge');
    for (const c of ed.data.chokepoints) push(`chokepoint:${c.id}`, [c.pos[0], fy + 0.02, c.pos[2]], 'post');
    push('mark:spawn', [ed.data.mission.playerSpawn[0], fy + 0.02, ed.data.mission.playerSpawn[2]], 'mark');
    for (const o of ed.data.mission.objectives) { const q = ed.posOf(`mark:${o.id}`)!; push(`mark:${o.id}`, [q[0], o.kind === 'drive' ? q[1] : fy + 0.02, q[2]], 'mark'); }
    for (const v of ed.data.devices) { if ((v.floor ?? F0) !== F) continue; if (v.kind === 'laser') push(`device:${v.id}`, [(v.from[0] + v.to[0]) / 2, (v.from[1] + v.to[1]) / 2, (v.from[2] + v.to[2]) / 2], 'laser'); else push(`device:${v.id}`, v.pos as Vec3, v.kind); }
  }

  /** THE DOOR A DRAG DRAWS, hinge → cursor: along an axis unless `free` (alt); a drag about a door long is a real door (doorSize.ts LEAF_W), any other length the
   *  grid's; and a real door on an axis has its hinge slid along its own line so its middle stands on a walk-grid cell centre — the only place a path goes through it */
  private doorDrag(h: ArrayLike<number>, g: ArrayLike<number> | null, free: boolean): { hinge: [number, number]; ang: number; w: number } {
    let ang = 0, w = LEAF_W;
    if (g) { const dx = g[0] - h[0], dz = g[2] - h[2], L = Math.hypot(dx, dz); if (L > 0.3) { ang = Math.atan2(dz, dx); if (!free) ang = snapTo(ang, Math.PI / 2); w = Math.abs(L - LEAF_W) < 0.25 ? LEAF_W : Math.max(0.6, Math.min(2.4, this.snapD(L) || LEAF_W)); } }
    return { hinge: w === LEAF_W ? hingeOnCell([h[0], h[2]], ang, w) : [h[0], h[2]], ang, w };
  }
  /** preview boxes for the scene this frame: a light's stand-in bulb while placing, the door being placed */
  previews(): ReturnType<typeof makeBox>[] {
    const out: ReturnType<typeof makeBox>[] = [];
    if (this.drag?.kind === 'doorPlace' && this.cursor3) { const { hinge: h, ang, w } = this.doorDrag(this.drag.hinge, this.cursor3, false); out.push(makeBox({ c: [h[0] + Math.cos(ang) * w / 2, this.floorY() + LEAF_H / 2, h[1] + Math.sin(ang) * w / 2], h: [w / 2, LEAF_H / 2, 0.025], yaw: -ang, albedo: [0.42, 0.3, 0.19], emissive: [0.3, 0.2, 0.1], flags: BoxFlag.Dynamic | BoxFlag.NoShadow })); }
    if (this.tool === 'light' && this.cursor3) { const P = LIGHT_PRESETS.find(x => x.key === this.lightPreset) ?? LIGHT_PRESETS[0]; out.push(makeBox({ c: [this.cursor3[0], this.floorY() + P.height, this.cursor3[2]], h: [0.06, 0.06, 0.06], albedo: [1, 1, 1], emissive: v3.scale(P.def.color, 6), flags: BoxFlag.Dynamic | BoxFlag.NoShadow })); }
    return out;
  }
  get presets() { return { boxes: BOX_PRESETS, lights: LIGHT_PRESETS, volumes: VOLUME_KINDS }; }
}

const TOOL_HINT: Record<ToolName, string> = {
  select: 'select: click selects (shift toggles) · press-drag on the SELECTION moves it (Alt = vertical) · press-drag anywhere else = marquee · S resize handles · R rotate ring · G move',
  box: 'box: press-drag a footprint on the floor (a click drops the preset\'s default size) — preset from the palette',
  volume: 'volume: press-drag a footprint (hide / utility / trigger from the palette)',
  light: 'light: click the floor under where it should hang (preset height) — then drag / aim / edit',
  door: 'door: press at the HINGE, drag along the closed leaf (snaps to 90°, Alt = free), release — the wall is cut and framed if "cut + frame" is on',
  route: 'route: click waypoints in patrol order · Enter / double-click finishes · Backspace drops the last · Esc cancels',
  camera: 'camera (C): click the floor under where it hangs (2.6 m up, looking the way the view looks) — then drag its aim dot / R / the sheet',
  keypad: 'keypad (K): click beside a door, on the face that should carry the pad — that door is locked on the pad\'s own lock',
  laser: 'laser (J): press at the emitter, drag to the receiver, let go (shin height 0.35 m; ≥ 1.2 m in the sheet = crouch under)',
};

function cornersToBox(ed: Editor, preset: string, a: Vec3, b: Vec3): { c: Vec3; h: Vec3 } { const s = ed.boxFromPreset(preset, a, b); return { c: s.c as Vec3, h: s.h as Vec3 }; }
function cornersToVolume(a: Vec3, b: Vec3, y: number): { c: Vec3; h: Vec3 } {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[2], b[2]), z1 = Math.max(a[2], b[2]); const H = 1.0;
  return { c: roundVec([(x0 + x1) / 2, y + H / 2, (z0 + z1) / 2]), h: roundVec([Math.max(0.05, (x1 - x0) / 2), H / 2, Math.max(0.05, (z1 - z0) / 2)]) };
}
function distPolyline(px: number, py: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy || 1e-6; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t))); }
  return best;
}
export type { VolumeData };
/** the yaw the rotate ring turns for a device: a camera's / keypad's own; a beam's heading in plan (from → to) */
export function deviceYaw(v: DeviceData | undefined | null): number { if (!v) return 0; if (v.kind === 'laser') return Math.atan2(v.to[0] - v.from[0], v.to[2] - v.from[2]); return v.yaw; }
/** where a camera's axis meets the floor (or `range` out if it never does): the aim dot */
export function cameraAimPoint(v: Extract<DeviceData, { kind: 'camera' }>, floorY: number): Vec3 {
  const pitch = v.pitch ?? DEVICE_DEFAULTS.pitch; const cp = Math.cos(pitch); const d: Vec3 = [Math.sin(v.yaw) * cp, Math.sin(pitch), Math.cos(v.yaw) * cp];
  const range = v.range ?? DEVICE_DEFAULTS.range; const t = d[1] < -1e-3 ? Math.min(range, (v.pos[1] - floorY) / -d[1]) : Math.min(range, 4);
  return [v.pos[0] + d[0] * t, v.pos[1] + d[1] * t, v.pos[2] + d[2] * t];
}
