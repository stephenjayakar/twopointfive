// The editor's camera: the game's FollowCamera driven as an orbit / plan camera about a focus point on the current floor — RMB-drag orbits, MMB /
// Space-drag pans in the ground plane, the wheel zooms toward the cursor, T flips to a top-down plan and back, F frames a bounds. `pin` (FollowCamera.pin)
// fixes a framing verbatim for captures exactly as the game's __stage does; `set` / `get` are the scripted mirror (__ed.camera).
import { Vec3, v3, DEG, clamp } from '../math/vec';
import { FollowCamera } from '../game/camera';

export interface CamState { look: Vec3; yaw: number; pitch: number; dist: number }

export class View {
  readonly cam = new FollowCamera();
  focus: Vec3 = [20, 0, 14];
  plan = false;
  private orbitSaved: { yaw: number; pitch: number } | null = null;
  /** CSS size of the view (the page keeps it current; headless a fixed 1600 × 1000) */
  w = 1600; h = 1000;

  constructor() {
    const c = this.cam; c.fov = 40 * DEG; c.near = 0.1; c.far = 250; c.aimLead = 0;
    c.yaw = -20 * DEG; c.pitch = 58 * DEG; c.distance = c.desiredDistance = 30;
    c.target = v3.copy(this.focus); c.desired = v3.copy(this.focus); c.rebuild();
  }
  get(): CamState { return { look: v3.copy(this.focus), yaw: this.cam.yaw, pitch: this.cam.pitch, dist: this.cam.desiredDistance }; }
  /** jump the camera (no easing): any subset of look / yaw / pitch / dist */
  set(s: Partial<CamState>) {
    const c = this.cam;
    if (s.look) { this.focus = v3.copy(s.look); c.target = v3.copy(s.look); c.desired = v3.copy(s.look); }
    if (s.yaw !== undefined) c.yaw = s.yaw; if (s.pitch !== undefined) c.pitch = clamp(s.pitch, 2 * DEG, 89.5 * DEG);
    if (s.dist !== undefined) c.distance = c.desiredDistance = clamp(s.dist, 0.5, 200);
    c.rebuild();
  }
  /** FollowCamera.pin: a verbatim framing for captures (null releases) */
  pin(p: CamState | null) { this.cam.pin = p ? { look: v3.copy(p.look), yaw: p.yaw, pitch: p.pitch, dist: p.dist } : null; if (p) this.set(p); }
  orbit(dxPx: number, dyPx: number) { if (this.plan) { this.cam.yaw -= dxPx * 0.008; return; } this.cam.yaw -= dxPx * 0.008; this.cam.pitch = clamp(this.cam.pitch + dyPx * 0.006, 3 * DEG, 89.5 * DEG); }
  /** slide the focus so the ground under the cursor follows the mouse (metres per pixel from the distance and fov) */
  pan(dxPx: number, dyPx: number) {
    const c = this.cam; const { fwd, right } = c.planarBasis();
    const mpp = 2 * c.distance * Math.tan(c.fov / 2) / Math.max(100, this.h);   // metres per CSS pixel at the focus depth
    const k = 1 / Math.max(0.15, Math.sin(c.pitch));                            // ground foreshortening along the view
    this.focus = v3.mad(v3.mad(this.focus, right, -dxPx * mpp), fwd, dyPx * mpp * k);
  }
  /** wheel: zoom about the cursor's ground point (it stays put under the mouse), clamped */
  zoom(wheel: number, mx?: number, my?: number, groundY = 0) {
    const c = this.cam; const f = Math.exp(wheel * 0.0012); const nd = clamp(c.desiredDistance * f, 0.6, 200);
    if (mx !== undefined && my !== undefined) { const g = this.groundAt(mx, my, groundY); if (g) { const s = 1 - nd / c.desiredDistance; this.focus = v3.lerp(this.focus, [g[0], this.focus[1], g[2]], s); } }
    c.desiredDistance = nd; c.distance = nd;
  }
  togglePlan(force?: boolean) {
    const on = force ?? !this.plan; if (on === this.plan) return;
    this.plan = on; const c = this.cam;
    if (on) { this.orbitSaved = { yaw: c.yaw, pitch: c.pitch }; c.pitch = 89.5 * DEG; c.yaw = 0; }
    else if (this.orbitSaved) { c.yaw = this.orbitSaved.yaw; c.pitch = this.orbitSaved.pitch; }
    c.rebuild();
  }
  /** frame an axis-aligned bounds (min, max): focus its middle, distance from its size and the fov */
  frame(min: Vec3, max: Vec3) {
    const mid: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const r = Math.max(0.6, v3.dist(min, max) / 2);
    this.focus = mid; this.cam.desiredDistance = this.cam.distance = clamp(r / Math.tan(this.cam.fov / 2) * 1.15, 1.2, 150);
  }
  update(dt: number) {
    this.focus[0] = clamp(this.focus[0], -20, 60); this.focus[2] = clamp(this.focus[2], -20, 48); this.focus[1] = clamp(this.focus[1], -2, 12);
    this.cam.aspect = this.w / Math.max(1, this.h);
    if (this.cam.pin) { this.cam.update(dt, this.focus, null); return; }
    this.cam.desired = v3.copy(this.focus); this.cam.target = v3.copy(this.focus); this.cam.distance = this.cam.desiredDistance;   // no easing: an editor camera goes where it is put
    this.cam.update(0, this.focus, null);   // (copies last frame's viewProj into prevViewProj BEFORE rebuilding — the temporal passes reproject through it)
  }
  ray(mx: number, my: number) { return this.cam.ray(mx / Math.max(1, this.w), my / Math.max(1, this.h)); }
  groundAt(mx: number, my: number, y = 0): Vec3 | null { return this.cam.groundPoint(mx / Math.max(1, this.w), my / Math.max(1, this.h), y); }
  project(p: Vec3): [number, number, boolean] { return this.cam.project(p, this.w, this.h, Infinity, 0.05); }
  /** metres per CSS pixel at world point p (for turning mouse travel into world distances) */
  mPerPx(p: Vec3): number { const d = Math.max(0.3, v3.dist(p, this.cam.pos)); return 2 * d * Math.tan(this.cam.fov / 2) / Math.max(100, this.h); }
}
