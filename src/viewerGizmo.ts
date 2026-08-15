// Viewer-only: Blender-style transform handles over the rig props + a clickable node hierarchy. It never touches the renderer —
// a 2D canvas laid over the WebGPU one draws the selected node's handles (three axis arrows to translate along the node's PARENT
// frame axes, three rings to rotate about them; x red, y green, z blue), and dragging a handle writes straight into that node's
// Adj in rigProps.RIG (off in metres, rot in degrees), which rigBoxes() applies next frame and rigSource() prints. Picking a prop
// in the 3D view selects its part node; the hierarchy list (or U) walks up to the group.
import { Vec3, v3, quat } from './math/vec';
import { Box, rayBox } from './scene/boxes';
import { FollowCamera } from './game/camera';
import { Input } from './game/input';
import { RigNodeMeta, Adj } from './game/rigProps';

const AXIS_COL = ['#ff5560', '#7be36d', '#5aa3ff'];
const ARROW_PX = 86, RING_M = 0.09;                 // arrow length on screen; ring radius in metres (drawn projected, so it reads as lying in the plane)

type Handle = { kind: 'move' | 'rot'; axis: 0 | 1 | 2 };

export class RigGizmo {
  readonly overlay: HTMLCanvasElement; private ctx: CanvasRenderingContext2D;
  selected: string | null = null;                    // node path (RigNodeMeta.path)
  /** overall handle / outline opacity (viewer slider) so the model underneath stays readable */
  opacity = 0.9;
  private meta: RigNodeMeta[] = []; private boxes: Box[] = [];
  private hot: Handle | null = null;                 // handle under the cursor
  private drag: { h: Handle; lastX: number; lastY: number } | null = null;
  private downAt: { x: number; y: number } | null = null;
  /** fires after any gizmo edit / selection change (viewer refreshes its source box + selection sliders) */
  onChange: () => void = () => {};
  onSelect: () => void = () => {};

  constructor(private view: HTMLCanvasElement, private cam: FollowCamera, private input: Input) {
    const o = document.createElement('canvas'); o.id = 'gizmo';
    o.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    view.parentElement!.insertBefore(o, view.nextSibling);
    this.overlay = o; this.ctx = o.getContext('2d')!;
  }

  /** True while a handle is being dragged (the viewer must not orbit / pan then). */
  get busy() { return !!this.drag; }
  node(): RigNodeMeta | null { return this.meta.find(m => m.path === this.selected) ?? null; }
  nodes(): RigNodeMeta[] { return this.meta; }
  select(path: string | null) { if (path !== this.selected) { this.selected = path; this.onSelect(); } }
  selectParent() { const n = this.node(); if (!n) return; const i = n.path.lastIndexOf('.'); const up = i > 0 ? n.path.slice(0, i) : null; this.select(up && this.meta.some(m => m.path === up) ? up : n.path); }

  private project(p: Vec3): [number, number, boolean] { return this.cam.project(p, this.view.clientWidth, this.view.clientHeight); }   // [x px, y px, in front of the eye]
  /** metres per screen pixel at point p along world direction a (for turning mouse travel into translation) */
  private axisScreen(o: Vec3, a: Vec3): { dir: [number, number]; pxPerM: number } {
    const [x0, y0] = this.project(o); const [x1, y1] = this.project(v3.mad(o, a, 0.1));
    const dx = x1 - x0, dy = y1 - y0; const L = Math.hypot(dx, dy) || 1e-6;
    return { dir: [dx / L, dy / L], pxPerM: L / 0.1 };
  }
  private ringPoint(n: RigNodeMeta, axis: number, t: number): Vec3 {
    const P = n.parent; const A = [P.x, P.y, P.z]; const u = A[(axis + 1) % 3], w = A[(axis + 2) % 3];
    return v3.mad(v3.mad(n.frame.o, u, Math.cos(t) * RING_M), w, Math.sin(t) * RING_M);
  }

  /** Call once per frame after rigBoxes(): current node metadata + the dynamic box list they index into. Handles input. */
  update(meta: RigNodeMeta[], boxes: Box[]) {
    this.meta = meta; this.boxes = boxes;
    if (this.selected && !meta.some(m => m.path === this.selected)) { /* node not drawn this frame (slot / kit change): keep the selection name, draw nothing */ }
    const mx = this.input.mouseX, my = this.input.mouseY;
    const down = this.input.lmb(), pressed = this.input.lmbHit(), released = this.wasDown && !down; this.wasDown = down;
    // hover: which handle is under the cursor
    this.hot = this.drag ? this.drag.h : this.hitHandle(mx, my);
    // press / drag / release (Input gives us the press edge + held state; the panel swallows its own events)
    if (pressed && !down) { if (!this.hot) this.select(this.pick(mx, my)); this.downAt = null; }   // tap that began and ended inside this frame (trackpad tap-to-click): a click (unless it landed on a handle), never a drag
    else if (pressed) {
      this.downAt = { x: mx, y: my };
      if (this.hot) this.drag = { h: this.hot, lastX: mx, lastY: my };
    }
    if (this.drag && !down && !released) this.drag = null;                       // belt and braces: never stay armed without a held button
    if (this.drag && down) {
      const n = this.node();
      if (n) {
        const adj: Adj = n.getAdj(); const P = n.parent; const A = [P.x, P.y, P.z][this.drag.h.axis];
        const ddx = mx - this.drag.lastX, ddy = my - this.drag.lastY;
        if (this.drag.h.kind === 'move') {
          const s = this.axisScreen(n.frame.o, A);
          adj.off[this.drag.h.axis] += (ddx * s.dir[0] + ddy * s.dir[1]) / Math.max(s.pxPerM, 120);   // (an axis pointing at the camera projects to almost nothing: cap the gain instead of exploding)
        } else {
          // rotate: mouse travel along the ring's on-screen tangent at the point nearest the cursor → angle
          let bestT = 0, bestD = 1e9;
          for (let k = 0; k < 48; k++) { const t = (k / 48) * Math.PI * 2; const [x, y] = this.project(this.ringPoint(n, this.drag.h.axis, t)); const d = Math.hypot(x - mx, y - my); if (d < bestD) { bestD = d; bestT = t; } }
          const [xa, ya] = this.project(this.ringPoint(n, this.drag.h.axis, bestT)); const [xb, yb] = this.project(this.ringPoint(n, this.drag.h.axis, bestT + 0.05));
          const tx = xb - xa, ty = yb - ya; const L = Math.hypot(tx, ty) || 1e-6;
          adj.rot[this.drag.h.axis] += ((ddx * tx + ddy * ty) / L) * (0.05 / L) * (180 / Math.PI);
        }
        if (ddx || ddy) this.onChange();
      }
      this.drag.lastX = mx; this.drag.lastY = my;
    }
    if (released) {
      if (this.drag) this.drag = null;
      else if (this.downAt && Math.hypot(mx - this.downAt.x, my - this.downAt.y) < 4) this.select(this.pick(mx, my));   // a click (no drag) in the view: pick a prop part, or clear the selection
      this.downAt = null;
    }
  }
  private wasDown = false;

  private pick(mx: number, my: number): string | null {
    const u = mx / Math.max(1, this.view.clientWidth), v = my / Math.max(1, this.view.clientHeight);
    const { ro, rd } = this.cam.ray(u, v);
    let best = 1e9, path: string | null = null;
    for (const n of this.meta) {
      if (n.depth < 2 && this.meta.some(m => m.path.startsWith(n.path + '.'))) continue;   // prefer parts; groups are reached via 'parent'
      for (let i = n.boxStart; i < n.boxStart + n.boxCount && i < this.boxes.length; i++) {
        const t = rayBoxRot(ro, rd, this.boxes[i], best); if (t < best) { best = t; path = n.path; }
      }
    }
    return path;
  }
  private hitHandle(mx: number, my: number): Handle | null {
    const n = this.node(); if (!n) return null;
    const [ox, oy, vis] = this.project(n.frame.o); if (!vis) return null;
    const P = n.parent; const A = [P.x, P.y, P.z];
    let best: Handle | null = null, bestD = 9;
    for (let a = 0; a < 3; a++) {
      // arrow: distance to the segment origin→tip
      const s = this.axisScreen(n.frame.o, A[a]); const tx = ox + s.dir[0] * ARROW_PX, ty = oy + s.dir[1] * ARROW_PX;
      const d = distSeg(mx, my, ox + s.dir[0] * 14, oy + s.dir[1] * 14, tx, ty);
      if (d < bestD) { bestD = d; best = { kind: 'move', axis: a as 0 | 1 | 2 }; }
      // ring: distance to the projected polyline
      let px = 0, py = 0;
      for (let k = 0; k <= 48; k++) { const [x, y] = this.project(this.ringPoint(n, a, (k / 48) * Math.PI * 2)); if (k > 0) { const dd = distSeg(mx, my, px, py, x, y); if (dd < bestD) { bestD = dd; best = { kind: 'rot', axis: a as 0 | 1 | 2 }; } } px = x; py = y; }
    }
    return best;
  }

  /** Redraw the overlay (call after render). */
  draw() {
    const o = this.overlay, dpr = window.devicePixelRatio || 1;
    const W = this.view.clientWidth, H = this.view.clientHeight;
    if (o.width !== Math.round(W * dpr) || o.height !== Math.round(H * dpr)) { o.width = Math.round(W * dpr); o.height = Math.round(H * dpr); }
    const c = this.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const n = this.node(); if (!n) return;
    this.overlay.style.opacity = String(this.opacity);
    // outline the selected node's boxes (projected corners' hull ≈ just draw the 12 edges)
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,230,120,0.9)';
    for (let i = n.boxStart; i < n.boxStart + n.boxCount && i < this.boxes.length; i++) this.drawBoxEdges(this.boxes[i]);
    const [ox, oy, vis] = this.project(n.frame.o); if (!vis) return;
    const P = n.parent; const A = [P.x, P.y, P.z];
    for (let a = 0; a < 3; a++) {
      const hotMove = this.hot?.kind === 'move' && this.hot.axis === a, hotRot = this.hot?.kind === 'rot' && this.hot.axis === a;
      // ring
      c.beginPath();
      for (let k = 0; k <= 64; k++) { const [x, y] = this.project(this.ringPoint(n, a, (k / 64) * Math.PI * 2)); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.strokeStyle = AXIS_COL[a]; c.globalAlpha = hotRot ? 1 : 0.55; c.lineWidth = hotRot ? 3 : 1.5; c.stroke();
      // arrow
      const s = this.axisScreen(n.frame.o, A[a]); const tx = ox + s.dir[0] * ARROW_PX, ty = oy + s.dir[1] * ARROW_PX;
      c.globalAlpha = hotMove ? 1 : 0.9; c.lineWidth = hotMove ? 3.5 : 2.2; c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
      const nx = -s.dir[1], ny = s.dir[0];
      c.beginPath(); c.moveTo(tx + s.dir[0] * 12, ty + s.dir[1] * 12); c.lineTo(tx + nx * 5, ty + ny * 5); c.lineTo(tx - nx * 5, ty - ny * 5); c.closePath(); c.fillStyle = AXIS_COL[a]; c.fill();
      c.globalAlpha = 1; c.font = '11px ui-monospace, Menlo, monospace'; c.fillText('xyz'[a], tx + s.dir[0] * 22 - 3, ty + s.dir[1] * 22 + 4);
    }
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(ox, oy, 3, 0, Math.PI * 2); c.fill();
  }
  private drawBoxEdges(b: Box) {
    const q = b.rot ?? quat.yaw(b.yaw); const pts: [number, number][] = [];   // (yaw convention: local +X → (cos, 0, −sin), +Z → (sin, 0, cos) = rotation about +Y)
    for (let k = 0; k < 8; k++) {
      const l: Vec3 = [(k & 1 ? 1 : -1) * b.h[0], (k & 2 ? 1 : -1) * b.h[1], (k & 4 ? 1 : -1) * b.h[2]];
      const [x, y] = this.project(v3.add(b.c, quat.rotate(q, l))); pts.push([x, y]);
    }
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const c = this.ctx; c.beginPath(); for (const [i, j] of E) { c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[j][0], pts[j][1]); } c.stroke();
  }
}

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Ray vs a possibly tilted box (Box.rot, else yaw): slab test in the box frame. Returns t or +inf. */
function rayBoxRot(ro: Vec3, rd: Vec3, b: Box, tmax: number): number {
  if (!b.rot) { const r = rayBox(ro, rd, b, tmax); return r ? r.t : Infinity; }
  const qi = quat.conj(b.rot); const o = quat.rotate(qi, v3.sub(ro, b.c)); const d = quat.rotate(qi, rd);
  let t0 = 0, t1 = tmax;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (Math.abs(o[a]) > b.h[a]) return Infinity; continue; }
    let ta = (-b.h[a] - o[a]) / d[a], tb = (b.h[a] - o[a]) / d[a]; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return Infinity;
  }
  return t0;
}
