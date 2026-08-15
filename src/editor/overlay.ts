// The 2D canvas over the WebGPU view: everything the editor draws that is not level geometry — the floor grid, selection outlines (the twelve
// edges of each selected box / volume), the gizmo handles (face squares, the yaw ring, a light's aim dot, a door's leaf end), entity icons
// (lights with their cones, waypoints, door hinges + swing arcs, chokepoints, the mission marks), patrol routes as polylines with direction
// ticks, the route being drawn, the marquee, the snapped cursor. All through FollowCamera.project; nothing here changes any state.
import { Vec3, v3 } from '../math/vec';
import type { BoxData, LightData, DoorData, VolumeData, DeviceData } from '../scene/levelData';
import { DEVICE_DEFAULTS } from '../scene/levelData';
import { cameraAimPoint } from './tools';
import { Editor, parseRef } from './editor';
import { Tools } from './tools';
import { View } from './view';
import { boxCorners, BOX_EDGES, yawAxes } from './geom';
import { FACE_AXES, faceIndex, faceHalf, RES_K, MARKING_TEXEL, MarkFace, MarkRes } from '../scene/markings';

/** what the Markings tab is looking at: the box face (outlined, with its u → / v ↑ painter axes) and, if one is selected, the marking's rectangle on it */
export interface MarkGizmo { boxId: string; face: MarkFace; res: MarkRes; at?: readonly number[]; size?: readonly number[]; texel?: number }

const COL = { cam: '#ff6a5a', pad: '#7ce38a', laser: '#ff4040', sel: '#f0d878', hover: 'rgba(140,230,255,0.9)', grid: 'rgba(120,170,160,0.13)', gridMajor: 'rgba(140,200,190,0.28)', route: '#7fe0a8', routeSel: '#f0d878', light: '#ffd27a', door: '#9ac4ff', mark: '#ff8db0', vol: { hide: '#5fe0a0', utility: '#e8c050', trigger: '#e070d0' } as Record<string, string>, handle: '#ffffff', axis: ['#ff5560', '#7be36d', '#5aa3ff'] };

export class Overlay {
  ctx: CanvasRenderingContext2D | null;
  /** set by the Markings tab while it is up (paintui.ts); null = nothing drawn */
  markGizmo: MarkGizmo | null = null;
  constructor(readonly canvas: HTMLCanvasElement, readonly ed: Editor, readonly tools: Tools, readonly view: View) { this.ctx = canvas.getContext('2d'); }

  draw() {
    const c = this.ctx; if (!c) return;
    const W = this.view.w, H = this.view.h; const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) { this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.font = '11px ui-monospace, Menlo, monospace'; c.lineJoin = 'round';
    if (this.ed.settings.grid) this.grid(c);
    this.volumes(c); this.doors(c); this.routes(c); this.marks(c); this.lights(c); this.devices(c);
    this.selection(c); this.hover(c); this.markFace(c); this.handles(c); this.draft(c); this.marquee(c); this.cursor(c);
  }
  /** the Markings tab's subject: the face outlined (cyan, dashed) with its painter axes (u → right, v ↑ up as seen from outside), and the marking's rect (magenta) */
  private markFace(c: CanvasRenderingContext2D) {
    const g = this.markGizmo; if (!g) return;
    const b = this.ed.doc.get<BoxData>('boxes', g.boxId); if (!b || b.rot) return;
    const f = faceIndex(g.face); if (f < 0) return;
    const A = FACE_AXES[f]; const { ax, az } = yawAxes(b.yaw ?? 0); const { hu, hv, hn } = faceHalf(b.h as Vec3, f);
    const W = (l: readonly number[]): Vec3 => [ax[0] * l[0] + az[0] * l[2], l[1], ax[2] * l[0] + az[2] * l[2]];   // box-local → world (yaw only)
    const u = W(A.u), v = W(A.v), n = W(A.n);
    const centre = v3.mad(b.c as Vec3, n, hn + 0.004);
    const at = (su: number, sv: number): Vec3 => v3.mad(v3.mad(centre, u, su), v, sv);
    c.strokeStyle = 'rgba(120,230,255,0.9)'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.beginPath();
    const q = [at(-hu, -hv), at(hu, -hv), at(hu, hv), at(-hu, hv)]; for (let i = 0; i < 4; i++) this.line3(c, q[i], q[(i + 1) % 4]); c.stroke(); c.setLineDash([]);
    // painter axes off the face's lower-left corner: u (right in the painter) and v (up)
    const o = at(-hu, -hv); const L = Math.max(0.08, Math.min(hu, hv) * 0.6);
    c.strokeStyle = '#7be36d'; c.beginPath(); this.line3(c, o, v3.mad(o, u, L)); c.stroke(); c.strokeStyle = '#5aa3ff'; c.beginPath(); this.line3(c, o, v3.mad(o, v, L)); c.stroke();
    { const [x, y, ok] = this.P(v3.mad(o, u, L)); if (ok) { c.fillStyle = '#7be36d'; c.fillText('u →', x + 3, y + 4); } } { const [x, y, ok] = this.P(v3.mad(o, v, L)); if (ok) { c.fillStyle = '#5aa3ff'; c.fillText('v ↑', x + 3, y - 2); } }
    { const [x, y, ok] = this.P(at(0, hv)); if (ok) { c.fillStyle = 'rgba(120,230,255,0.95)'; c.fillText(`${g.boxId} ${g.face}`, x + 6, y - 6); } }
    if (g.at && g.size) {   // the marking's bitmap rectangle on its lattice
      const t = (g.texel ?? MARKING_TEXEL) * RES_K[g.res];
      const u0 = g.at[0] * t, v0 = g.at[1] * t, u1 = (g.at[0] + g.size[0]) * t, v1 = (g.at[1] + g.size[1]) * t;
      c.strokeStyle = '#ff6ad5'; c.lineWidth = 2; c.beginPath(); const r = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]; for (let i = 0; i < 4; i++) this.line3(c, r[i], r[(i + 1) % 4]); c.stroke();
    }
  }
  private P(p: Vec3): [number, number, boolean] { return this.view.project(p); }
  private line3(c: CanvasRenderingContext2D, a: Vec3, b: Vec3) { const [x0, y0, o0] = this.P(a), [x1, y1, o1] = this.P(b); if (!o0 || !o1) return; c.moveTo(x0, y0); c.lineTo(x1, y1); }

  private grid(c: CanvasRenderingContext2D) {
    const y = this.ed.floor().y + 0.003; const f = this.view.focus; const dist = this.view.cam.distance;
    const step = dist < 14 ? this.ed.settings.snapStep : this.ed.settings.gridStep; const major = this.ed.settings.gridStep;
    const R = Math.min(40, Math.max(8, dist * 1.2)); const B = this.ed.data.meta.bounds;
    const x0 = Math.max(B?.min[0] ?? -1e9, Math.floor((f[0] - R) / step) * step), x1 = Math.min(B?.max[0] ?? 1e9, f[0] + R), z0 = Math.max(B?.min[2] ?? -1e9, Math.floor((f[2] - R) / step) * step), z1 = Math.min(B?.max[2] ?? 1e9, f[2] + R);
    if ((x1 - x0) / step > 400) return;
    const seg = 4;   // metres per segment (segments with an end behind the eye are dropped)
    for (const pass of [0, 1]) {
      c.beginPath(); c.strokeStyle = pass ? COL.gridMajor : COL.grid; c.lineWidth = 1;
      for (let x = x0; x <= x1 + 1e-6; x += step) { const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6; if (+isMajor !== pass) continue; for (let z = z0; z < z1; z += seg) this.line3(c, [x, y, z], [x, y, Math.min(z1, z + seg)]); }
      for (let z = z0; z <= z1 + 1e-6; z += step) { const isMajor = Math.abs(z / major - Math.round(z / major)) < 1e-6; if (+isMajor !== pass) continue; for (let x = x0; x < x1; x += seg) this.line3(c, [x, y, z], [Math.min(x1, x + seg), y, z]); }
      c.stroke();
    }
  }
  private boxEdges(c: CanvasRenderingContext2D, cc: Vec3, h: Vec3, yaw: number) {
    const pts = boxCorners(cc, h, yaw).map(p => this.P(p)); if (pts.some(p => !p[2])) return;
    c.beginPath(); for (const [i, j] of BOX_EDGES) { c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[j][0], pts[j][1]); } c.stroke();
  }
  private selection(c: CanvasRenderingContext2D) {
    const ed = this.ed; if (!ed.sel.size) return;
    c.strokeStyle = COL.sel; c.lineWidth = 1.5; let n = 0;
    for (const ref of ed.sel) {
      if (++n > 600) break;
      const r = parseRef(ref);
      if (r.kind === 'box') { const b = ed.doc.get<BoxData>('boxes', r.id); if (b) this.boxEdges(c, b.c as Vec3, b.h as Vec3, b.yaw ?? 0); }
      else if (r.kind === 'volume') { const v = ed.doc.get<VolumeData>('volumes', r.id); if (v) this.boxEdges(c, v.c as Vec3, v.h as Vec3, v.yaw ?? 0); }
      else if (r.kind === 'sw') { for (const bid of ed.doc.get<any>('switchables', r.id)?.boxes ?? []) { const b = ed.doc.get<BoxData>('boxes', bid); if (b) this.boxEdges(c, b.c as Vec3, b.h as Vec3, b.yaw ?? 0); } }
      else if (r.kind === 'prop') { const p = ed.doc.get<any>('props', r.id); if (p) this.boxEdges(c, [p.x, (p.height ?? 1) / 2, p.z], [p.half?.[0] ?? 0.3, (p.height ?? 1) / 2, p.half?.[1] ?? 0.3], p.yaw ?? 0); }
      else { const q = ed.posOf(ref); if (q) { const [x, y, ok] = this.P(q); if (ok) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke(); } } }
    }
  }
  private hover(c: CanvasRenderingContext2D) {
    const hv = this.tools.hover; if (!hv || this.tools.drag) return;
    const r = parseRef(hv.ref); c.strokeStyle = COL.hover; c.lineWidth = 1;
    if (r.kind === 'box') { const b = this.ed.doc.get<BoxData>('boxes', r.id); if (b) this.boxEdges(c, b.c as Vec3, b.h as Vec3, b.yaw ?? 0); }
    else { const [x, y, ok] = this.P(hv.point); if (ok) { c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke(); } }
    const [x, y, ok] = this.P(hv.point); if (ok) { c.fillStyle = 'rgba(200,240,255,0.85)'; c.fillText(hv.ref, x + 12, y - 8); }
  }
  private handles(c: CanvasRenderingContext2D) {
    const T = this.tools;
    for (const h of T.handles) {
      const hot = T.hot?.id === h.id || (T.drag as any)?.face === h.face && T.drag?.kind === 'face' && h.kind === 'face';
      if (h.kind === 'face') { c.fillStyle = hot ? '#fff' : COL.axis[h.face! >> 1]; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.rect(h.x - 5, h.y - 5, 10, 10); c.fill(); c.stroke(); }
      else if (h.kind === 'ring' && h.pts) { c.strokeStyle = hot || T.drag?.kind === 'ring' ? '#fff' : COL.axis[1]; c.lineWidth = hot ? 3 : 2; c.beginPath(); h.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
      else if (h.kind === 'aim') { const l = this.ed.doc.get<LightData>('lights', parseRef(h.ref).id); if (l) { const [x0, y0, ok] = this.P(l.pos as Vec3); if (ok) { c.strokeStyle = COL.light; c.lineWidth = 1; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(x0, y0); c.lineTo(h.x, h.y); c.stroke(); c.setLineDash([]); } } c.fillStyle = hot ? '#fff' : COL.light; c.beginPath(); c.arc(h.x, h.y, hot ? 7 : 5, 0, Math.PI * 2); c.fill(); c.fillText('aim', h.x + 8, h.y + 4); }
      else if (h.kind === 'doorEnd') { c.fillStyle = hot ? '#fff' : COL.door; c.beginPath(); c.rect(h.x - 5, h.y - 5, 10, 10); c.fill(); c.fillText('swing / width', h.x + 8, h.y + 4); }
      else if (h.kind === 'camAim') { c.fillStyle = hot ? '#fff' : COL.cam; c.beginPath(); c.arc(h.x, h.y, hot ? 7 : 5, 0, Math.PI * 2); c.fill(); c.fillText('aim', h.x + 8, h.y + 4); }
      else if (h.kind === 'laserEnd') { c.fillStyle = hot ? '#fff' : COL.laser; c.beginPath(); c.rect(h.x - 5, h.y - 5, 10, 10); c.fill(); c.fillText(h.end ? 'receiver' : 'emitter', h.x + 8, h.y + 4); }
    }
  }
  private lights(c: CanvasRenderingContext2D) {
    const sel = this.ed.sel; c.lineWidth = 1;
    for (const l of this.ed.data.lights) {
      if (l.kind === 'dir') continue;
      const [x, y, ok] = this.P(l.pos as Vec3); if (!ok) continue;
      const on = l.enabled; const isSel = sel.has(`light:${l.id}`);
      c.strokeStyle = isSel ? COL.sel : COL.light; c.fillStyle = on ? `rgb(${Math.min(255, l.color[0] * 255) | 0},${Math.min(255, l.color[1] * 255) | 0},${Math.min(255, l.color[2] * 255) | 0})` : '#333';
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); c.stroke(); }
      if (l.kind === 'spot') {   // cone edges: axis ± outer angle in the plane containing the axis and world up (or x if the axis is vertical)
        const d = v3.normalize(l.dir as Vec3); const side = Math.abs(d[1]) > 0.95 ? [1, 0, 0] as Vec3 : v3.normalize(v3.cross(d, [0, 1, 0])); const up2 = v3.normalize(v3.cross(side, d));
        const len = Math.min(l.range, 2.5); const oa = l.outerDeg * Math.PI / 180;
        c.strokeStyle = isSel ? COL.sel : 'rgba(255,210,122,0.55)'; c.beginPath();
        for (const s of [-1, 1]) for (const basis of [side, up2]) { const e = v3.mad(v3.scale(d, Math.cos(oa)), basis, Math.sin(oa) * s); this.line3(c, l.pos as Vec3, v3.mad(l.pos as Vec3, e, len)); }
        this.line3(c, l.pos as Vec3, v3.mad(l.pos as Vec3, d, len)); c.stroke();
      }
      if (isSel || this.view.cam.distance < 18) { c.fillStyle = 'rgba(255,230,170,0.9)'; c.fillText(l.id, x + 12, y + 4); }
    }
  }
  private routes(c: CanvasRenderingContext2D) {
    const fy = this.ed.floor().y + 0.02; const sel = this.ed.sel;
    for (const r of this.ed.data.routes) {
      const whole = sel.has(`route:${r.id}`); const anySel = whole || r.points.some((_, i) => sel.has(`route:${r.id}#${i}`));
      const pts = r.points.map(p => this.P([p[0], fy, p[2]]));
      c.strokeStyle = anySel ? COL.routeSel : COL.route; c.lineWidth = anySel ? 2.5 : 1.5; c.setLineDash(anySel ? [] : [6, 4]);
      c.beginPath(); let started = false;
      for (let i = 0; i <= pts.length; i++) { const q = pts[i % pts.length]; if (!q[2]) { started = false; continue; } if (!started) { c.moveTo(q[0], q[1]); started = true; } else c.lineTo(q[0], q[1]); }
      c.stroke(); c.setLineDash([]);
      // direction ticks: a chevron at each leg's middle pointing along the patrol order
      c.fillStyle = anySel ? COL.routeSel : COL.route;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (!a[2] || !b[2] || pts.length < 2) continue; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy); if (L < 20) continue; const ux = dx / L, uy = dy / L; c.beginPath(); c.moveTo(mx + ux * 7, my + uy * 7); c.lineTo(mx - ux * 5 - uy * 5, my - uy * 5 + ux * 5); c.lineTo(mx - ux * 5 + uy * 5, my - uy * 5 - ux * 5); c.closePath(); c.fill(); }
      // waypoints: numbered dots, the wait in seconds beside
      pts.forEach((q, i) => { if (!q[2]) return; const s = whole || sel.has(`route:${r.id}#${i}`); c.fillStyle = s ? COL.sel : '#0b1410'; c.strokeStyle = anySel ? COL.routeSel : COL.route; c.lineWidth = 1.5; c.beginPath(); c.arc(q[0], q[1], i === 0 ? 7 : 5.5, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = s ? '#111' : '#cfe'; c.fillText(String(i), q[0] - 3, q[1] + 4); if (r.wait[i] > 0) { c.fillStyle = 'rgba(200,255,220,0.8)'; c.fillText(`${r.wait[i]}s`, q[0] + 9, q[1] - 6); } });
      const p0 = pts[0]; if (p0?.[2]) { c.fillStyle = anySel ? COL.routeSel : 'rgba(160,240,190,0.85)'; c.fillText(r.name ?? r.id, p0[0] + 10, p0[1] + 14); }
    }
  }
  private doors(c: CanvasRenderingContext2D) {
    const fy = this.ed.floor().y + 0.03; const F = this.ed.floor().id, F0 = this.ed.data.floors[0].id;
    for (const o of this.ed.data.doors as DoorData[]) {
      if ((o.floor ?? F0) !== F) continue;
      const isSel = this.ed.sel.has(`door:${o.id}`); const h: Vec3 = [o.hinge[0], fy, o.hinge[1]];
      const u = (a: number): Vec3 => [Math.cos(a), 0, Math.sin(a)];
      c.strokeStyle = isSel ? COL.sel : COL.door; c.lineWidth = isSel ? 2 : 1.2;
      c.beginPath(); this.line3(c, h, v3.mad(h, u(o.closedDir), o.width)); c.stroke();   // the closed leaf
      // swing arc between the limits (default ±110°), and the authored angle as a solid leaf line
      const a0 = o.closedDir + (o.minAngle ?? -1.92), a1 = o.closedDir + (o.maxAngle ?? 1.92);
      c.setLineDash([3, 4]); c.beginPath(); let first = true; for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; const [x, y, ok] = this.P(v3.mad(h, u(a), o.width)); if (!ok) { first = true; continue; } if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); } c.stroke(); c.setLineDash([]);
      if (o.angle) { c.beginPath(); this.line3(c, h, v3.mad(h, u(o.closedDir + o.angle), o.width)); c.stroke(); }
      const [x, y, ok] = this.P(h); if (ok) { c.fillStyle = isSel ? COL.sel : COL.door; c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill(); if (isSel || this.view.cam.distance < 22) { c.fillText(`${o.id}${o.locked ? ' 🔒' : ''}`, x + 8, y - 6); } }
    }
  }
  private volumes(c: CanvasRenderingContext2D) {
    for (const v of this.ed.data.volumes as VolumeData[]) { c.strokeStyle = this.ed.sel.has(`volume:${v.id}`) ? COL.sel : (COL.vol[v.kind] ?? '#ccc'); c.lineWidth = 1; c.setLineDash([2, 3]); this.boxEdges(c, v.c as Vec3, v.h as Vec3, v.yaw ?? 0); c.setLineDash([]); const [x, y, ok] = this.P(v.c as Vec3); if (ok) { c.fillStyle = COL.vol[v.kind] ?? '#ccc'; c.fillText(`${v.kind} ${v.id}`, x + 6, y); } }
  }
  private marks(c: CanvasRenderingContext2D) {
    const ed = this.ed; const fy = ed.floor().y + 0.02; const M = ed.data.mission;
    const flag = (ref: string, p: Vec3, label: string) => { const [x, y, ok] = this.P(p); if (!ok) return; const s = ed.sel.has(ref); c.strokeStyle = s ? COL.sel : COL.mark; c.fillStyle = s ? COL.sel : COL.mark; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 16); c.lineTo(x + 10, y - 12); c.lineTo(x, y - 8); c.stroke(); c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); c.fillText(label, x + 8, y + 12); };
    flag('mark:spawn', [M.playerSpawn[0], fy, M.playerSpawn[2]], 'spawn');
    for (const o of M.objectives) {
      if (o.kind === 'reach') { const s = ed.sel.has(`mark:${o.id}`); c.strokeStyle = s ? COL.sel : 'rgba(255,141,176,0.7)'; c.lineWidth = 1; c.setLineDash([5, 4]); c.beginPath(); const A = o.area; const q: Vec3[] = [[A.x0, fy, A.z0], [A.x1, fy, A.z0], [A.x1, fy, A.z1], [A.x0, fy, A.z1]]; for (let i = 0; i < 4; i++) this.line3(c, q[i], q[(i + 1) % 4]); c.stroke(); c.setLineDash([]); flag(`mark:${o.id}`, [(A.x0 + A.x1) / 2, fy, (A.z0 + A.z1) / 2], `reach: ${o.id} (door ${o.door})`); }
      else if (o.kind === 'drive') flag(`mark:${o.id}`, o.front as Vec3, `drive: rack ${o.rackIndex}`);
      else flag(`mark:${o.id}`, [o.x, fy, o.z], `exfil (door ${o.door})`);
    }
    for (const cp of ed.data.chokepoints) { const [x, y, ok] = this.P([cp.pos[0], fy, cp.pos[2]]); if (!ok) continue; const s = ed.sel.has(`chokepoint:${cp.id}`); c.strokeStyle = s ? COL.sel : '#c8a0ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.stroke(); const [x2, y2] = this.P([cp.pos[0] + Math.sin(cp.yaw) * 0.8, fy, cp.pos[2] + Math.cos(cp.yaw) * 0.8]); c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); if (s || this.view.cam.distance < 18) { c.fillStyle = '#d8c0ff'; c.fillText(`post ${cp.name ?? cp.id}`, x + 8, y + 4); } }
  }
  /** cameras: dot + the cone's two edges on the floor plane (yaw ± fov/2 out to range) with the sweep's extremes dashed and a line to the aim point; keypads: a
   *  square with a tick out of the wall and a line to their door's middle; lasers: the beam from emitter (square) to receiver (hollow square) with its height */
  private devices(c: CanvasRenderingContext2D) {
    const ed = this.ed; const fy = ed.floor().y + 0.03; const F = ed.floor().id, F0 = ed.data.floors[0].id; const near = this.view.cam.distance < 22;
    for (const v of ed.data.devices as DeviceData[]) {
      if ((v.floor ?? F0) !== F) continue;
      const isSel = ed.sel.has(`device:${v.id}`);
      if (v.kind === 'camera') {
        const [x, y, ok] = this.P(v.pos as Vec3); if (!ok) continue;
        const half = (v.fovDeg ?? DEVICE_DEFAULTS.fovDeg) / 2 * Math.PI / 180; const range = v.range ?? DEVICE_DEFAULTS.range; const p0: Vec3 = [v.pos[0], fy, v.pos[2]];
        const edge = (yaw: number, len: number): Vec3 => [v.pos[0] + Math.sin(yaw) * len, fy, v.pos[2] + Math.cos(yaw) * len];
        c.strokeStyle = isSel ? COL.sel : COL.cam; c.lineWidth = isSel ? 2 : 1.2;
        c.beginPath(); this.line3(c, p0, edge(v.yaw - half, range)); this.line3(c, p0, edge(v.yaw + half, range));
        for (let k = 0; k < 12; k++) this.line3(c, edge(v.yaw - half + (2 * half) * k / 12, range), edge(v.yaw - half + (2 * half) * (k + 1) / 12, range));   // the reach arc
        c.stroke();
        if (v.sweep) { c.setLineDash([3, 4]); c.beginPath(); this.line3(c, p0, edge(v.sweep[0] - half, range)); this.line3(c, p0, edge(v.sweep[1] + half, range)); c.stroke(); c.setLineDash([]); }
        const aim = cameraAimPoint(v, ed.floor().y); c.setLineDash([2, 3]); c.beginPath(); this.line3(c, v.pos as Vec3, aim); c.stroke(); c.setLineDash([]);
        c.fillStyle = isSel ? COL.sel : COL.cam; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.stroke();
        if (isSel || near) { c.fillStyle = 'rgba(255,190,180,0.95)'; c.fillText(`${v.id}${v.mains === false ? ' (UPS)' : ''}`, x + 8, y - 6); }
      } else if (v.kind === 'keypad') {
        const [x, y, ok] = this.P(v.pos as Vec3); if (!ok) continue;
        c.fillStyle = isSel ? COL.sel : COL.pad; c.strokeStyle = isSel ? COL.sel : COL.pad; c.lineWidth = 1.2;
        c.beginPath(); c.rect(x - 4, y - 5, 8, 10); c.fill();
        c.beginPath(); this.line3(c, v.pos as Vec3, [v.pos[0] + Math.sin(v.yaw) * 0.4, v.pos[1], v.pos[2] + Math.cos(v.yaw) * 0.4]); c.stroke();   // out of the wall
        const d = ed.doc.get<DoorData>('doors', v.door); if (d) { const mid: Vec3 = [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, fy + 1, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2]; c.setLineDash([2, 3]); c.beginPath(); this.line3(c, v.pos as Vec3, mid); c.stroke(); c.setLineDash([]); }
        if (isSel || near) { c.fillStyle = 'rgba(190,255,200,0.95)'; c.fillText(`${v.id} → ${v.door} (${v.code})`, x + 8, y - 6); }
      } else {
        const [x0, y0, o0] = this.P(v.from as Vec3), [x1, y1, o1] = this.P(v.to as Vec3); if (!o0 || !o1) continue;
        c.strokeStyle = isSel ? COL.sel : COL.laser; c.lineWidth = isSel ? 2.5 : 1.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.fillStyle = isSel ? COL.sel : COL.laser; c.beginPath(); c.rect(x0 - 4, y0 - 4, 8, 8); c.fill(); c.lineWidth = 1.5; c.beginPath(); c.rect(x1 - 4, y1 - 4, 8, 8); c.stroke();
        if (isSel || near) { c.fillStyle = 'rgba(255,180,180,0.95)'; c.fillText(`${v.id} · y ${v.from[1].toFixed(2)}${v.mains === false ? ' (UPS)' : ''}${v.alarm === 'alarm' ? ' · ALARM' : ''}`, (x0 + x1) / 2 + 8, (y0 + y1) / 2 - 6); }
      }
    }
  }
  private draft(c: CanvasRenderingContext2D) {
    const T = this.tools; const fy = this.ed.floor().y + 0.02;
    if (T.routeDraft?.length) {
      const pts = [...T.routeDraft, ...(T.cursor3 ? [T.cursor3] : [])].map(p => this.P([p[0], fy, p[2]]));
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); pts.forEach((q, i) => { if (!q[2]) return; if (i === 0) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); }); c.stroke(); c.setLineDash([]);
      T.routeDraft.forEach((_, i) => { const q = pts[i]; if (!q[2]) return; c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 4, 0, Math.PI * 2); c.fill(); c.fillText(String(i), q[0] + 6, q[1] - 6); });
    }
    if (T.drag?.kind === 'footprint' && !T.drag.id && T.cursor3) { const a = T.drag.a, b = T.cursor3; c.strokeStyle = '#fff'; c.setLineDash([4, 3]); c.beginPath(); const q: Vec3[] = [[a[0], fy, a[2]], [b[0], fy, a[2]], [b[0], fy, b[2]], [a[0], fy, b[2]]]; for (let i = 0; i < 4; i++) this.line3(c, q[i], q[(i + 1) % 4]); c.stroke(); c.setLineDash([]); }
    if (T.drag?.kind === 'doorPlace' && T.cursor3) { const h = T.drag.hinge; const [x, y, ok] = this.P([h[0], fy, h[2]]); if (ok) { c.fillStyle = COL.door; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.fillText('hinge', x + 8, y - 8); } }
  }
  private marquee(c: CanvasRenderingContext2D) {
    const d = this.tools.drag; if (d?.kind !== 'marquee') return;
    c.strokeStyle = 'rgba(240,216,120,0.9)'; c.fillStyle = 'rgba(240,216,120,0.08)'; c.lineWidth = 1; c.setLineDash([4, 3]);
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0); c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); c.setLineDash([]);
  }
  private cursor(c: CanvasRenderingContext2D) {
    const T = this.tools; if (!T.cursor3 || (T.tool === 'select' && !T.drag)) return;
    const [x, y, ok] = this.P([T.cursor3[0], this.ed.floor().y + 0.01, T.cursor3[2]]); if (!ok) return;
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.moveTo(x, y - 8); c.lineTo(x, y + 8); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(`${T.cursor3[0].toFixed(2)}, ${T.cursor3[2].toFixed(2)}`, x + 10, y + 14);
  }
}
