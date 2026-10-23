// Fixed-angle follow camera (tilted perspective, à la the reference shots) + screen→world rays.
import { Vec3, m4, v3, DEG, damp, clamp } from '../math/vec';

/** the steepest pitch a pinned framing may ask for (setPin clamps to it): straight down / up is a degenerate lookAt */
export const PIN_PITCH_MAX = 89 * DEG;

export class FollowCamera {
  target: Vec3 = [10, 0, 15];       // smoothed look-at point (on the floor)
  desired: Vec3 = [10, 0, 15];
  yaw = -22 * DEG;                  // rotation of the view around +Y (0 = looking toward -Z / north)
  pitch = 55 * DEG;                 // downward tilt
  distance = 21;
  desiredDistance = 21;
  fov = 28 * DEG;
  near = 0.5; far = 120;
  aimLead = 0.18;                   // fraction of the aim offset the camera leads toward
  view = m4.create(); proj = m4.create(); viewProj = m4.create(); invViewProj = m4.create(); prevViewProj = m4.create();
  pos: Vec3 = [0, 0, 0]; forward: Vec3 = [0, 0, -1];
  aspect = 16 / 9;
  /** Optional world-space nudge added to the follow point (before smoothing): the player controller sets it while Sam peeks round the end of the wall he is
   *  pressed to (player.ts moveOnWall — a point past the corner and a little out from the wall), null the rest of the time. Nothing else reads or writes it. */
  peekOffset: Vec3 | null = null;

  /** Automation only (main.ts __stage): a fixed framing that update() applies verbatim — look-at, yaw, pitch, distance, no damping, no aim lead, no peek
   *  offset — so a scripted capture frames what it means to frame instead of wherever the follow camera has drifted to. null = the live follow camera. */
  pin: { look: Vec3; yaw: number; pitch: number; dist: number } | null = null;
  /** the free camera's angles + zoom from before the first setPin, put back when the pin is released through setPin(null) */
  private beforePin: { yaw: number; pitch: number; distance: number; desiredDistance: number } | null = null;
  /** Pin the framing (or, with null, release it) — the way __stage sets `pin`: the numbers are checked (all finite, else it throws) and clamped (dist ≥ near +
   *  0.05 so the eye never sits on the look-at point; |pitch| ≤ PIN_PITCH_MAX, since at ±90° the view direction is the up vector and lookAt degenerates), and the
   *  FREE camera's yaw / pitch / zoom are remembered on the first pin and restored on release — a script that pinned the camera hands back the camera the player
   *  had, not the pin's zoom and bearing (review B7.10). Returns the pin as applied. Writing `pin` directly still works and skips all of this (the breach's shots). */
  setPin(p: { look: Vec3; yaw: number; pitch: number; dist: number } | null): FollowCamera['pin'] {
    if (!p) {
      if (this.pin && this.beforePin) { this.yaw = this.beforePin.yaw; this.pitch = this.beforePin.pitch; this.distance = this.beforePin.distance; this.desiredDistance = this.beforePin.desiredDistance; }
      this.pin = null; this.beforePin = null; return null;
    }
    if (![p.look?.[0], p.look?.[1], p.look?.[2], p.yaw, p.pitch, p.dist].every(x => typeof x === 'number' && Number.isFinite(x))) throw new Error('camera pin: look[3], yaw, pitch and dist must all be finite numbers');
    if (!this.pin) this.beforePin = { yaw: this.yaw, pitch: this.pitch, distance: this.distance, desiredDistance: this.desiredDistance };
    this.pin = { look: v3.copy(p.look), yaw: p.yaw, pitch: clamp(p.pitch, -PIN_PITCH_MAX, PIN_PITCH_MAX), dist: Math.max(this.near + 0.05, p.dist) };
    return this.pin;
  }
  /** THE HOST'S OWN SHIFT of the follow point, metres on the floor (null = none): a page that keeps a panel open over one side of the view (host/sneaklab.ts)
   *  moves the look-at so that the man followed stands in the middle of what is left. The loop adds it to the follow (host/loop.ts); a pinned or scripted shot ignores it. */
  hostShift: Vec3 | null = null;
  update(dt: number, follow: Vec3, aimPoint: Vec3 | null) { this.frame(); this.step(dt, follow, aimPoint); }
  /** update()'s two halves, for a host that steps the camera with the game and draws at its own rate (host/loop.ts under the fixed step). `frame()`, once a drawn
   *  frame: 'previous' ← the matrix the last frame was DRAWN with. `step()`, once a game tick: the follow itself. */
  frame() { m4.copy(this.prevViewProj, this.kickDrawn ?? this.viewProj); this.kickDrawn = null; }   // (rebuild() may run again later in the frame; a kicked or posed frame's 'previous' is the matrix that frame was DRAWN with)
  step(dt: number, follow: Vec3, aimPoint: Vec3 | null) {
    if (this.pin) { const P = this.pin; this.desired = v3.copy(P.look); this.target = v3.copy(P.look); this.yaw = P.yaw; this.pitch = P.pitch; this.distance = this.desiredDistance = P.dist; this.rebuild(); return; }
    let d: Vec3 = v3.copy(follow);
    if (aimPoint) d = v3.lerp(follow, aimPoint, this.aimLead);
    if (this.peekOffset) d = v3.add(d, this.peekOffset);
    this.desired = d;
    this.target = [damp(this.target[0], d[0], 4, dt), damp(this.target[1], d[1], 4, dt), damp(this.target[2], d[2], 4, dt)];
    this.distance = damp(this.distance, this.desiredDistance, 6, dt);
    this.rebuild();
  }

  /** A PICTURE-ONLY KICK (game/blastFeel.ts writes it once a frame; null = none): metres added to the look-at for the frame's render and nothing else. The loop
   *  (host/loop.ts) calls kickIn() right before the render and kickOut() after the HUD has drawn against the same picture, so whatever reads the camera inside
   *  Game.update — the aim ray, WASD's basis, the on-screen tests, the session journal — reads it as it was without the kick, to the bit (rebuild() from the same
   *  look-at, angles and distance gives the same matrices). */
  kick: Vec3 | null = null;
  private kickHeld: Vec3 | null = null; private kickDrawn: Float32Array | null = null; private kickVP = m4.create();
  /** the look-at WITHOUT the kick, whenever asked — what the renderer hands on to things that feed back into play (engine.viewFocus → the wind, the smoke solver's schedule) */
  get focus(): Vec3 { return this.drawHeld?.target ?? this.kickHeld ?? this.target; }
  kickIn() { const k = this.kick; if (!k || this.kickHeld) return; this.kickHeld = this.target; this.target = v3.add(this.target, k); this.rebuild(); }
  kickOut() { const t = this.kickHeld; if (!t) return; m4.copy(this.kickVP, this.viewProj); this.kickDrawn = this.kickVP; this.kickHeld = null; this.target = t; this.rebuild(); }

  /** A PICTURE-ONLY POSE (host/tween.ts, drawing between ticks: the camera stood between where its last two ticks left it): look-at, angles and distance for the
   *  frame's render and the HUD laid over it, the tick's own put back by drawOut() — to the bit, as with the kick. The loop calls drawIn() before kickIn() and
   *  drawOut() after kickOut(). */
  private drawHeld: { target: Vec3; yaw: number; pitch: number; distance: number } | null = null; private drawVP = m4.create();
  drawIn(p: { target: Vec3; yaw: number; pitch: number; distance: number }) {
    if (this.drawHeld) return;
    this.drawHeld = { target: this.target, yaw: this.yaw, pitch: this.pitch, distance: this.distance };
    this.target = [p.target[0], p.target[1], p.target[2]]; this.yaw = p.yaw; this.pitch = p.pitch; this.distance = p.distance; this.rebuild();
  }
  drawOut() {
    const h = this.drawHeld; if (!h) return;
    if (!this.kickDrawn) { m4.copy(this.drawVP, this.viewProj); this.kickDrawn = this.drawVP; }   // (a kick on top of the pose already left the matrix the frame was drawn with)
    this.drawHeld = null; this.target = h.target; this.yaw = h.yaw; this.pitch = h.pitch; this.distance = h.distance; this.rebuild();
  }

  rebuild() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // forward points from camera to target
    this.forward = [-sy * cp, -sp, -cy * cp];
    this.pos = v3.mad(this.target, this.forward, -this.distance);
    m4.lookAt(this.view, this.pos, this.target, [0, 1, 0]);
    m4.perspective(this.proj, this.fov, this.aspect, this.near, this.far);
    m4.mul(this.viewProj, this.proj, this.view);
    m4.invert(this.invViewProj, this.viewProj);
  }

  /** Spectate helper: swing the yaw toward the side the followed man can actually be SEEN from. From this height the last few metres of the sight
   *  line drop below wall height, so a man standing by a wall is hidden whenever the camera happens to sit beyond it; every half second try eight
   *  yaws and ease toward the one whose low approach segment (chest height, the 4 m nearest him along the view direction) is clear — preferring
   *  the current yaw on ties so it never hunts. `blocked(a, b)` is the level's segment test. */
  private autoYawT = 0;
  autoYaw(dt: number, target: Vec3, blocked: (a: Vec3, b: Vec3) => boolean) {
    if ((this.autoYawT -= dt) > 0) return; this.autoYawT = 0.5;
    const chest: Vec3 = [target[0], 1.3, target[2]]; let best = this.yaw, bestScore = -1;
    for (let i = 0; i < 8; i++) {
      const yaw = this.yaw + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 4));   // current first, then ±45°, ±90°, ±135°, 180°
      const sy = Math.sin(yaw), cy = Math.cos(yaw); let clear = 0;
      for (let s = 1; s <= 4; s++) { const p: Vec3 = [chest[0] + sy * s, 1.3, chest[2] + cy * s]; if (blocked(chest, p)) break; clear = s; }   // back along the view direction at chest height: a wall within a few metres on that side is what hides him from up there (the level's segment test is a 2D one; rising samples read as out of band)
      const score = clear - Math.abs(i === 0 ? 0 : Math.ceil(i / 2)) * 0.01;   // (a hair of preference for turning less)
      if (score > bestScore) { bestScore = score; best = yaw; }
    }
    this.yawGoal = best;
  }
  private yawGoal: number | null = null;
  /** ease toward the autoYaw goal (call every frame while spectating; clears itself when told to stop) */
  easeYaw(dt: number, on: boolean) { if (!on) { this.yawGoal = null; return; } if (this.yawGoal === null) return; let d = this.yawGoal - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 3); }
  zoom(delta: number) { this.desiredDistance = clamp(this.desiredDistance * Math.exp(delta * 0.0012), 6, 40); }
  rotate(dYaw: number) { this.yaw += dYaw; }

  /** World point → CSS pixels of a w×h view (origin top-left) through this frame's viewProj, plus whether it is showable: in front of the eye
   *  (clip w > minW) and, when `margin` is given, inside |ndc| < margin on both axes (1 = the view's edge — the HUD keeps markers alive a little
   *  past it). A point exactly on the eye plane (w = 0) is divided by 1 instead, as m4.transformPoint does; behind the eye the pixel is mirrored
   *  nonsense and only the flag means anything. The one projection the overlay markers, speech bubbles, the cursor's hover test, the tour's
   *  puppet aim and the viewer gizmo share. */
  project(p: Vec3, w: number, h: number, margin = Infinity, minW = 0): [number, number, boolean] {
    const vp = this.viewProj;
    const cw = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]; const d = cw || 1;
    const nx = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / d, ny = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / d;
    const front = cw > minW;
    return [(nx * 0.5 + 0.5) * w, (1 - (ny * 0.5 + 0.5)) * h, margin === Infinity ? front : front && nx > -margin && nx < margin && ny > -margin && ny < margin];
  }

  /** World-space ray through a pixel given in [0,1]^2 UV (origin top-left). */
  ray(u: number, v: number): { ro: Vec3; rd: Vec3 } {
    const ndcX = u * 2 - 1, ndcY = 1 - v * 2;
    const p0 = m4.transformPoint(this.invViewProj, [ndcX, ndcY, 0]);
    const p1 = m4.transformPoint(this.invViewProj, [ndcX, ndcY, 1]);
    return { ro: p0, rd: v3.normalize(v3.sub(p1, p0)) };
  }
  /** Intersect a UV ray with the horizontal plane y = h. */
  groundPoint(u: number, v: number, h = 0): Vec3 | null {
    const { ro, rd } = this.ray(u, v);
    if (Math.abs(rd[1]) < 1e-5) return null;
    const t = (h - ro[1]) / rd[1]; if (t < 0) return null;
    return v3.mad(ro, rd, t);
  }
  /** Camera-relative planar basis for WASD. */
  planarBasis(): { fwd: Vec3; right: Vec3 } {
    const f: Vec3 = v3.normalize([this.forward[0], 0, this.forward[2]]);
    return { fwd: f, right: [-f[2], 0, f[0]] };
  }
}
