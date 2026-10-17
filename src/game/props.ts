// Loose furniture physics: office chairs, cardboard cartons, bins and potted plants as 3-DOF rigid bodies (x, z, yaw — they stay on
// the floor and never topple). Characters shove them out of the way (two-way: a prop that cannot yield because it is pinned against
// the static scene holds the character back instead), bullets and thrown canisters knock them, swinging door leaves sweep them aside,
// they collide with the static boxes of the collision grid (2D oriented-rectangle SAT against each box's footprint, height-filtered),
// with each other (SAT, positional correction + a small impulse) and coast to rest under per-kind ground friction, then sleep.
// Anything abrupt — a shove that sets a prop going, a knock into a wall or another prop, a bullet strike — is reported as a PropEvent
// so the game can play a scrape / thud and feed the guards' hearing. Props are deliberately NOT collision occluders: they never block
// sight, sound or the nav grid (guards path straight through and shove them, which is the point).
// Conventions: yaw as Box.yaw / level frameAt (local +X → world (cos, −sin), local +Z → (sin, cos)); angular velocity w = d(yaw)/dt, so a
// point at offset r from the centre moves at (w·rz, −w·rx) and a planar impulse J at r changes w by (rz·Jx − rx·Jz)/I ("cross2" below).
import { wallClock } from '../math/side';
import { Vec3 } from '../math/vec';
import { Box, BoxFlag, makeBox, rayBox, MKEY } from '../scene/boxes';
import { StaticCollision } from '../scene/collision';
import { PropDef, PropKind } from '../scene/level';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

/** A character as the prop solver sees it: a kinematic-ish circle whose position may be corrected (held back) in place, like doors do. */
export interface PropContact { pos: Vec3; vel: Vec3; radius: number; who: number; mass: number; quiet: boolean; }
export interface PropEvent { prop: Prop; sound: 'scrape' | 'thud' | 'roll'; pos: Vec3; who: number; level: number; speed: number;
  /** only on sound 'roll' (a castor chair coasting, CASTOR below): 'start' as its speed passes CASTOR.startV, 'stop' as it falls under CASTOR.stopV. level is 0: nobody's ears. */
  roll?: 'start' | 'stop'; }

export interface KindTune { decel: number; visc: number; rest: number; scrapeRate: number; thudRate: number; }
/** decel: Coulomb ground friction as a deceleration (m/s²) — casters roll on, a carton on carpet stops almost at once; visc: extra viscous damping (1/s);
 *  rest: restitution against walls / other props; scrapeRate / thudRate: playback rate of the shared scrape / knock one-shots (a steel bin rings
 *  bright, a carton knocks dull). Angular friction is derived from decel and the footprint size. */
/** AN OFFICE CHAIR ROLLS ON ITS CASTORS (the maintainer: "i'd also expect the chair to have wheels and roll"). on: off in the module and on the frozen stand
 *  (TPS_CHAIRROLL=1), on in the page (?chairroll=0 = the chair as it was). With it on a prop of kind 'chair' coasts on rolling resistance `decel` (m/s²) and
 *  `visc` (1/s) in place of KIND.chair's 1.6 / 0.5 — pushed at a walk it rolls on about a metre and a half over two seconds where it stopped in half a metre —
 *  its spin dies at `spin` / radius (rad/s²), and while it coasts the system raises PropEvent sound 'roll' (start above `startV`, stop under `stopV` m/s).
 *  Every other kind, and every contact, wall and door rule, is untouched. First-pass numbers, never played. */
export const CASTOR = { on: false, decel: 0.4, visc: 0.45, spin: 1.2, startV: 0.3, stopV: 0.1 };
const KIND: Record<PropKind, KindTune> = {
  chair: { decel: 1.6, visc: 0.5, rest: 0.25, scrapeRate: 1.35, thudRate: 1.15 },
  cardboard: { decel: 3.2, visc: 0.8, rest: 0.12, scrapeRate: 1.0, thudRate: 0.8 },
  bin: { decel: 3.0, visc: 0.8, rest: 0.3, scrapeRate: 1.2, thudRate: 1.5 },
  plant: { decel: 4.5, visc: 1.0, rest: 0.1, scrapeRate: 0.8, thudRate: 0.95 },
};
const MAX_V = 5, MAX_W = 9;              // speed caps: with 1/60 s substeps a prop moves ≤ 8 cm per step, far below footprint + thinnest static panel → no tunnelling
const SLEEP_V = 0.04, SLEEP_W = 0.06, SLEEP_T = 0.3;
const DOOR_GUIDE = 1.2;                    // m/s a shoved prop is slid along the wall toward the middle of a door frame it fits through (PropSystem.doorways)
const Y_MIN = 0.04;                       // static boxes entirely below this are floor finishes, not obstacles

export class Prop {
  x: number; z: number; yaw: number; vx = 0; vz = 0; w = 0;
  readonly hx: number; readonly hz: number; readonly radius: number; readonly height: number;
  readonly mass: number; readonly invMass: number; readonly invI: number; readonly tune: KindTune;
  home: [number, number, number];         // settled rest pose for reset()
  asleep = true; idle = 0; dirty = true;
  rolling = false;   // coasting on its castors (CASTOR): between the 'roll' start and stop events; not saved — a load finds it again inside a step
  lastWho = 0; noiseT = -10; pushT = -10;   // who moved it last (blamed for its noise), last event time (rate limit), last time a character / leaf was pushing it
  /** world-space part boxes, mutated in place by place() — these are what gets rendered / traced / ray tested */
  readonly boxes: Box[];
  private cy = 1; private sy = 0; private yawCached = NaN;
  constructor(readonly def: PropDef, readonly id: number) {
    this.x = def.x; this.z = def.z; this.yaw = def.yaw; this.home = [def.x, def.z, def.yaw];
    this.hx = def.half[0]; this.hz = def.half[1]; this.radius = Math.hypot(this.hx, this.hz); this.height = def.height;
    this.mass = def.mass; this.invMass = 1 / def.mass;
    this.invI = 1 / (def.mass * (this.hx * this.hx + this.hz * this.hz) / 3 * 1.5);   // slab inertia ×1.5: a little sluggish in yaw reads as weight and keeps corner contacts calm
    this.tune = KIND[def.kind];
    this.boxes = def.parts.map((p, j) => makeBox({ c: [0, 0, 0], h: [p.h[0], p.h[1], p.h[2]], yaw: 0, albedo: p.albedo, flags: BoxFlag.Dynamic, name: def.name, mkey: MKEY.prop + id * 16 + j, ...(p.marks?.length ? { marks: p.marks } : {}) }));   // (mkey: motion identity per part — scene/boxes.ts)   // (the part's markings ride on its box: the tape and glyphs on a carton turn with it)
    this.place();
  }
  get cs() { this.frame(); return this.cy; } get sn() { this.frame(); return this.sy; }
  private frame() { if (this.yaw !== this.yawCached) { this.yawCached = this.yaw; this.cy = Math.cos(this.yaw); this.sy = Math.sin(this.yaw); } }
  /** Refresh the world boxes from the pose. */
  place() {
    const cs = this.cs, sn = this.sn; const parts = this.def.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], b = this.boxes[i];
      b.c[0] = this.x + cs * p.off[0] + sn * p.off[2]; b.c[1] = p.off[1]; b.c[2] = this.z - sn * p.off[0] + cs * p.off[2]; b.yaw = this.yaw + p.yaw;
    }
    this.dirty = false;
  }
  wake() { this.asleep = false; this.idle = 0; }
  get speed() { return Math.hypot(this.vx, this.vz); }
}

// ---- 2D oriented-rectangle SAT (scratch result, no allocation) ----
// rect = centre (x,z), yaw as cos/sin, half extents (hx along local X, hz along local Z). On overlap `sat` holds the minimum translation to apply to B
// (unit normal n from A to B, depth) and one contact point: the deepest vertex of the box whose face is NOT the separating axis (edge midpoint when an
// edge lies flat against the face, so a carton pushed square into a wall takes no spurious torque).
const sat = { nx: 0, nz: 0, depth: 0, px: 0, pz: 0 };
function satRects(ax: number, az: number, acs: number, asn: number, ahx: number, ahz: number, bx: number, bz: number, bcs: number, bsn: number, bhx: number, bhz: number): boolean {
  const dx = bx - ax, dz = bz - az;
  // axes: A.u=(acs,−asn) A.v=(asn,acs) B.u=(bcs,−bsn) B.v=(bsn,bcs)
  const cuu = Math.abs(acs * bcs + asn * bsn), cuv = Math.abs(acs * bsn - asn * bcs);   // |A.u·B.u| = |A.v·B.v|, |A.u·B.v| = |A.v·B.u|
  let best = 1e9, bnx = 0, bnz = 0, fromA = true;
  // A.u
  let d = dx * acs - dz * asn; let ov = ahx + bhx * cuu + bhz * cuv - Math.abs(d); if (ov <= 0) return false;
  if (ov < best) { best = ov; const s = d < 0 ? -1 : 1; bnx = acs * s; bnz = -asn * s; fromA = true; }
  // A.v
  d = dx * asn + dz * acs; ov = ahz + bhx * cuv + bhz * cuu - Math.abs(d); if (ov <= 0) return false;
  if (ov < best) { best = ov; const s = d < 0 ? -1 : 1; bnx = asn * s; bnz = acs * s; fromA = true; }
  // B.u
  d = dx * bcs - dz * bsn; ov = bhx + ahx * cuu + ahz * cuv - Math.abs(d); if (ov <= 0) return false;
  if (ov < best) { best = ov; const s = d < 0 ? -1 : 1; bnx = bcs * s; bnz = -bsn * s; fromA = false; }
  // B.v
  d = dx * bsn + dz * bcs; ov = bhz + ahx * cuv + ahz * cuu - Math.abs(d); if (ov <= 0) return false;
  if (ov < best) { best = ov; const s = d < 0 ? -1 : 1; bnx = bsn * s; bnz = bcs * s; fromA = false; }
  sat.nx = bnx; sat.nz = bnz; sat.depth = best;
  if (fromA) support(bx, bz, bcs, bsn, bhx, bhz, -bnx, -bnz); else support(ax, az, acs, asn, ahx, ahz, bnx, bnz);
  return true;
}
/** Farthest point of a rect along (dx,dz) into sat.px/pz; near-parallel edges resolve to their midpoint. */
function support(cx: number, cz: number, cs: number, sn: number, hx: number, hz: number, dx: number, dz: number) {
  const du = dx * cs - dz * sn, dv = dx * sn + dz * cs;
  const su = du > 0.06 ? hx : du < -0.06 ? -hx : 0, sv = dv > 0.06 ? hz : dv < -0.06 ? -hz : 0;
  sat.px = cx + cs * su + sn * sv; sat.pz = cz - sn * su + cs * sv;
}

export class PropSystem {
  props: Prop[];
  /** every prop the level was built with, in construction order (index = Prop.id): `props` is this list minus what a blast broke apart (remove()) until reset() */
  readonly all: Prop[];
  enabled = true;            // off: props freeze where they are (still solid to characters)
  frictionScale = 1;
  time = 0;
  stats = wallClock({ awake: 0, ms: 0 }, 'ms');
  private near = new Int32Array(256);
  private byBox = new Map<Box, Prop>();
  private muted = true;      // no events while settling / resetting
  /** THE DOOR FRAMES (Game hands them over once its doors stand: the frame's middle, the unit vector along the closed leaf, half the air between its stops).
   *  A REAL DOOR GUIDES FURNITURE THROUGH: between the stops of a real door (scene/doorSize.ts) there are 0.83 m, a chair is half a metre across and a man 0.6 —
   *  a chair shoved at the frame a hand's width off its middle caught a corner on the jamb's face and stood there, and nobody gets past a chair in a real
   *  doorway. So a prop somebody is shoving, standing at a frame it fits through but off the middle by more than the frame leaves it, is slid along the wall
   *  toward the middle (step 4b): it glances off the jamb and goes through, as a shoved chair does. A prop wider than the door, one nobody is pushing, and one
   *  whose middle is not before the opening are left alone. Level data only: no state of its own. */
  doorways: { cx: number; cz: number; ux: number; uz: number; half: number }[] = [];

  constructor(defs: PropDef[], private col: StaticCollision, private emit: (e: PropEvent) => void) {
    this.all = defs.map((d, i) => new Prop(d, i)); this.props = this.all.slice();
    for (const p of this.props) for (const b of p.boxes) this.byBox.set(b, p);
    this.settle();
  }

  /** The prop that owns a rendered/traced box (e.g. from a BoxWorld.raycast hit on the dynamic list), or null. */
  propOf(b: Box): Prop | null { return this.byBox.get(b) ?? null; }
  boxes(out: Box[]) { for (const p of this.props) for (const b of p.boxes) out.push(b); }

  /** A prop leaves the level (game/furnblast.ts: it came apart beside a charge — its parts fly on as debris): no longer drawn, solid, pushed or stepped until reset(). */
  remove(p: Prop) { const i = this.props.indexOf(p); if (i >= 0) this.props.splice(i, 1); }
  /** Everything back to its rest pose, asleep. */
  reset() {
    if (this.props.length !== this.all.length) { this.props.length = 0; for (const p of this.all) this.props.push(p); }
    for (const p of this.props) { p.x = p.home[0]; p.z = p.home[1]; p.yaw = p.home[2]; p.vx = p.vz = p.w = 0; p.asleep = true; p.idle = 0; p.noiseT = p.pushT = -10; p.lastWho = 0; p.rolling = false; p.dirty = true; p.place(); }
  }
  /** Debug: give every prop a random shove (panel button — lets you watch the solver without walking into things). */
  scatter(strength = 1.5) {
    for (const p of this.props) { const a = simRandom() * Math.PI * 2, s = strength * (0.5 + simRandom()); p.vx += Math.cos(a) * s; p.vz += Math.sin(a) * s; p.w += (simRandom() - 0.5) * 6 * strength; p.wake(); }
  }
  /** Authoring overlaps (a chair tucked 5 cm under a table edge, a bin grazing a desk corner) are resolved once, silently; the settled pose becomes home. */
  private settle() {
    this.muted = true; for (const p of this.props) p.dirty = true;   // dirty = "consider me" for the pair pass (everything starts asleep and freshly placed)
    for (let it = 0; it < 12; it++) { for (const p of this.props) this.solveStatics(p, false); this.solvePairs(false); }
    for (const p of this.props) { p.vx = p.vz = p.w = 0; p.asleep = true; p.home = [p.x, p.z, p.yaw]; p.place(); }
    this.muted = false;
  }

  /** Closest part box of any prop along the ray (t < tmax), for bullets / thrown items; `box` = the part that was hit (a mark left on it rides that part: marks.ts). */
  raycast(ro: Vec3, rd: Vec3, tmax: number): { t: number; n: Vec3; prop: Prop; box: Box } | null {
    let best = tmax; let bp: Prop | null = null; let bn: Vec3 = [0, 1, 0]; let bb: Box | null = null;
    const fl = Math.hypot(rd[0], rd[2]);
    for (const p of this.props) {
      // reject on the bounding cylinder: perpendicular distance from the prop axis to the ray in XZ, and not behind / beyond the best hit
      const ox = p.x - ro[0], oz = p.z - ro[2]; const along = fl > 1e-6 ? (ox * rd[0] + oz * rd[2]) / fl : 0;
      if (fl > 1e-6 && (along < -p.radius || along > best * fl + p.radius)) continue;
      const perp2 = ox * ox + oz * oz - along * along; if (perp2 > (p.radius + 0.05) * (p.radius + 0.05)) continue;
      for (const b of p.boxes) { const h = rayBox(ro, rd, b, best); if (h && h.t < best) { best = h.t; bp = p; bn = h.n; bb = b; } }
    }
    return bp && bb ? { t: best, n: bn, prop: bp, box: bb } : null;
  }

  /** Planar impulse J (N·s, y ignored) applied at world point `point`; `who` is blamed for the noise. thud=true reports it as an impact (bullet strike). */
  applyImpulse(p: Prop, point: Vec3, J: Vec3, who: number, thud = false) {
    const rx = point[0] - p.x, rz = point[2] - p.z;
    p.vx += J[0] * p.invMass; p.vz += J[2] * p.invMass; p.w += (rz * J[0] - rx * J[2]) * p.invI;
    this.clampVel(p); p.wake(); if (who) p.lastWho = who;
    if (thud) this.noise(p, 'thud', Math.hypot(J[0], J[2]) * p.invMass + 1, who || p.lastWho, 0.55);   // a round smacking into a carton across the room is a decent lure
  }

  private clampVel(p: Prop) {
    const s = Math.hypot(p.vx, p.vz); if (s > MAX_V) { p.vx *= MAX_V / s; p.vz *= MAX_V / s; }
    if (p.w > MAX_W) p.w = MAX_W; else if (p.w < -MAX_W) p.w = -MAX_W;
  }
  /** A castor chair's coast, as something a sound can follow (CASTOR): one 'roll' event with roll 'start' when its speed passes startV, one with 'stop' when it
   *  falls under stopV (or the switch goes off under it). Nothing is filed for anybody's ears: level 0, and Game.onPropEvent passes the kind over. */
  private rollNote(p: Prop, speed: number) {
    if (!p.rolling && speed > CASTOR.startV && !this.muted) { p.rolling = true; this.emit({ prop: p, sound: 'roll', roll: 'start', pos: [p.x, 0.05, p.z], who: p.lastWho, level: 0, speed }); }
    else if (p.rolling && speed < CASTOR.stopV) { p.rolling = false; this.emit({ prop: p, sound: 'roll', roll: 'stop', pos: [p.x, 0.05, p.z], who: p.lastWho, level: 0, speed }); }
  }
  private noise(p: Prop, sound: 'scrape' | 'thud', speed: number, who: number, level: number) {
    if (this.muted || this.time - p.noiseT < (sound === 'thud' ? 0.35 : 0.8)) return;   // per-prop rate limit: a chair rolled along a wall is one scrape and the odd knock, not a machine gun
    p.noiseT = this.time;
    this.emit({ prop: p, sound, pos: [p.x, Math.min(0.6, p.height * 0.5), p.z], who, level: Math.min(1, level), speed });
  }

  /** Advance the simulation: characters as circles (positions corrected in place when a prop cannot yield), `leaves` = kinematic boxes (door leaves). */
  update(dt: number, contacts: PropContact[], leaves: Box[]) {
    const t0 = performance.now();
    const n = Math.min(4, Math.max(1, Math.ceil(dt * 60 - 1e-6))); const h = dt / n;   // ≤ 1/60 s per substep (the frame dt is already clamped to 1/20)
    for (let s = 0; s < n; s++) { this.time += h; this.step(h, contacts, leaves); }
    let awake = 0;
    for (const p of this.props) { if (p.dirty) p.place(); if (!p.asleep) awake++; }
    this.stats.awake = awake; this.stats.ms = performance.now() - t0;
  }

  /** One substep: integrate → characters push → prop↔prop → door leaves → statics → characters held back. Statics come last among the prop movers so
   *  nothing ends a substep inside a wall; the final character pass then concedes whatever the props could not. */
  private step(h: number, contacts: PropContact[], leaves: Box[]) {
    const props = this.props;
    if (this.enabled) {
      // 1. integrate + ground friction (Coulomb + a little viscous, linear and angular) + sleep
      for (const p of props) {
        if (p.asleep) continue;
        p.x += p.vx * h; p.z += p.vz * h; p.yaw += p.w * h; p.dirty = true;
        const fs = this.frictionScale; const cas = CASTOR.on && p.def.kind === 'chair';
        const dec = cas ? CASTOR.decel : p.tune.decel, vis = cas ? CASTOR.visc : p.tune.visc, spin = cas ? CASTOR.spin : 1.5 * p.tune.decel; const sp = Math.hypot(p.vx, p.vz);
        if (sp > 0) { const ns = Math.max(0, sp - dec * fs * h) * Math.exp(-vis * fs * h); p.vx *= ns / sp; p.vz *= ns / sp; }
        const aw = Math.abs(p.w); if (aw > 0) { const na = Math.max(0, aw - spin * fs / p.radius * h) * Math.exp(-vis * fs * h); p.w *= na / aw; }
        if (cas || p.rolling) this.rollNote(p, cas ? Math.hypot(p.vx, p.vz) : 0);
        if (sp < SLEEP_V && aw < SLEEP_W) { p.idle += h; if (p.idle > SLEEP_T) { p.asleep = true; p.vx = p.vz = p.w = 0; } } else p.idle = 0;
        if (p.yaw > Math.PI * 4 || p.yaw < -Math.PI * 4) p.yaw %= Math.PI * 2;
      }
    }
    // 2. characters push props (impulse toward the character's velocity, penetration split by mass — heavier props visibly slow you down)
    for (const c of contacts) {
      const invMc = 1 / c.mass;
      for (const p of props) {
        const dx = c.pos[0] - p.x, dz = c.pos[2] - p.z; const rr = p.radius + c.radius; if (dx * dx + dz * dz > rr * rr) continue;
        if (!this.circleContact(p, c.pos[0], c.pos[2], c.radius)) continue;
        const nx = cc.nx, nz = cc.nz, pen = cc.pen;
        if (!this.enabled) { c.pos[0] += nx * pen; c.pos[2] += nz * pen; continue; }        // frozen props are just obstacles
        const fresh = this.time - p.pushT > 0.25; p.pushT = this.time;                      // a new shove (as opposed to leaning on it continuously) — only those are worth a scrape
        p.wake(); p.lastWho = c.who; p.dirty = true;
        const rx = cc.px - p.x, rz = cc.pz - p.z;
        // relative normal velocity of the prop's contact point w.r.t. the character (n points prop → character; > 0 = closing)
        const vpx = p.vx + p.w * rz, vpz = p.vz - p.w * rx;
        const vn = (vpx - c.vel[0]) * nx + (vpz - c.vel[2]) * nz;
        if (vn > 0) {
          const cr = rz * nx - rx * nz; const k = p.invMass + p.invI * cr * cr + invMc; const jn = vn / k;
          p.vx -= jn * nx * p.invMass; p.vz -= jn * nz * p.invMass; p.w -= jn * cr * p.invI; this.clampVel(p);
          const dv = jn * p.invMass;                                                          // how hard it was set going: a nudge is silent, walking pace scrapes, a sprint into a chair is loud
          if (fresh && dv > 0.7) this.noise(p, 'scrape', dv, c.who, (0.28 * dv) * (c.quiet ? 0.5 : 1));
        }
        const share = p.invMass / (p.invMass + invMc);
        p.x -= nx * pen * share; p.z -= nz * pen * share; c.pos[0] += nx * pen * (1 - share); c.pos[2] += nz * pen * (1 - share);
      }
    }
    if (this.enabled) {
      // 3. prop ↔ prop
      this.solvePairs(true);
      // 4. door leaves sweep props aside (one-way and cheap: the door model never feels them; a prop shoved into a standing leaf finds it solid)
      for (const lb of leaves) {
        const lcs = Math.cos(lb.yaw), lsn = Math.sin(lb.yaw); const lr = Math.hypot(lb.h[0], lb.h[2]);
        for (const p of props) {
          const dx = p.x - lb.c[0], dz = p.z - lb.c[2]; if (dx * dx + dz * dz > (lr + p.radius) * (lr + p.radius)) continue;
          if (!satRects(lb.c[0], lb.c[2], lcs, lsn, lb.h[0], lb.h[2], p.x, p.z, p.cs, p.sn, p.hx, p.hz)) continue;
          p.x += sat.nx * sat.depth; p.z += sat.nz * sat.depth; p.dirty = true; p.wake(); p.pushT = this.time; p.lastWho = 0;   // whoever swung the door is unknown here: any clatter that follows is 'somebody', which guards do check out
          const vn = p.vx * sat.nx + p.vz * sat.nz; const want = Math.min(2, sat.depth / h * 0.5);   // carried along at about the leaf's speed (from how far it intruded this substep), never launched
          if (vn < want) { p.vx += (want - vn) * sat.nx; p.vz += (want - vn) * sat.nz; }
        }
      }
      // 4b. a door frame guides a shoved prop through (doorways, above)
      for (const F of this.doorways) for (const p of props) {
        if (p.asleep || this.time - p.pushT > 0.12 || p.lastWho === 0) continue;   // (… by a body: a leaf's sweep stamps the same clock, and guiding that back at the leaf would be a motor)
        const dx = p.x - F.cx, dz = p.z - F.cz; if (dx * dx + dz * dz > (F.half + p.radius + 0.4) * (F.half + p.radius + 0.4)) continue;
        const cs = p.cs, sn = p.sn, along = dx * F.ux + dz * F.uz, off = -dx * F.uz + dz * F.ux;
        const eu = p.hx * Math.abs(cs * F.ux - sn * F.uz) + p.hz * Math.abs(sn * F.ux + cs * F.uz), en = p.hx * Math.abs(-cs * F.uz - sn * F.ux) + p.hz * Math.abs(-sn * F.uz + cs * F.ux);   // its footprint's reach along the wall and across it
        const lim = F.half - eu - 0.01; if (lim < 0 || Math.abs(along) > F.half + 0.05 || Math.abs(off) > en + 0.15) continue;   // (wider than the door · its middle not before the opening · not at the frame yet)
        const over = Math.abs(along) - lim; if (over <= 0) continue;
        if (Math.abs(-p.vx * F.uz + p.vz * F.ux) < 0.5 * Math.abs(p.vx * F.ux + p.vz * F.uz)) continue;   // (shoved ALONG the wall, past the door: not on its way through)
        const k = Math.min(over, DOOR_GUIDE * h) * (along > 0 ? -1 : 1); p.x += F.ux * k; p.z += F.uz * k; p.dirty = true;
      }
      // 5. prop ↔ static scene (last of the prop movers, so nothing ends a substep inside a wall)
      for (const p of props) if (!p.asleep || p.dirty) this.solveStatics(p, true);
    }
    // 6. whatever a prop could not yield (pinned against a wall / another prop), the character gives back: pushed clear of the final prop poses.
    //    A prop found squeezed here also sheds the momentum step 2 keeps feeding it from the character's commanded velocity — otherwise a chair held
    //    against a partition by someone still walking into it would rattle between the two every substep (spin building at the corner, knock after knock)
    for (const c of contacts) for (const p of props) {
      const dx = c.pos[0] - p.x, dz = c.pos[2] - p.z; const rr = p.radius + c.radius; if (dx * dx + dz * dz > rr * rr) continue;
      if (!this.circleContact(p, c.pos[0], c.pos[2], c.radius)) continue;
      c.pos[0] += cc.nx * cc.pen; c.pos[2] += cc.nz * cc.pen;
      if (cc.pen > 0.004) { p.vx *= 0.3; p.vz *= 0.3; p.w *= 0.3; }
    }
  }

  /** Circle (character) vs prop footprint: on overlap fills `cc` with the normal (prop → circle), penetration and the contact point on the prop. */
  private circleContact(p: Prop, cx: number, cz: number, r: number): boolean {
    const cs = p.cs, sn = p.sn; const dx = cx - p.x, dz = cz - p.z;
    const lx = cs * dx - sn * dz, lz = sn * dx + cs * dz;                                  // circle centre in prop space
    const qx = lx < -p.hx ? -p.hx : lx > p.hx ? p.hx : lx, qz = lz < -p.hz ? -p.hz : lz > p.hz ? p.hz : lz;
    const ddx = lx - qx, ddz = lz - qz; const d2 = ddx * ddx + ddz * ddz; if (d2 >= r * r) return false;
    let nlx: number, nlz: number, pen: number;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); nlx = ddx / d; nlz = ddz / d; pen = r - d; }
    else { const px = p.hx - Math.abs(lx), pz = p.hz - Math.abs(lz); if (px < pz) { nlx = lx < 0 ? -1 : 1; nlz = 0; pen = px + r; } else { nlx = 0; nlz = lz < 0 ? -1 : 1; pen = pz + r; } }
    cc.nx = cs * nlx + sn * nlz; cc.nz = -sn * nlx + cs * nlz; cc.pen = pen;
    cc.px = p.x + cs * qx + sn * qz; cc.pz = p.z - sn * qx + cs * qz;
    return true;
  }

  private solvePairs(dynamic: boolean) {
    const props = this.props;
    for (let i = 0; i < props.length; i++) {
      const a = props[i];
      for (let j = i + 1; j < props.length; j++) {
        const b = props[j];
        if (a.asleep && b.asleep && !a.dirty && !b.dirty) continue;
        const dx = b.x - a.x, dz = b.z - a.z; const rr = a.radius + b.radius; if (dx * dx + dz * dz > rr * rr) continue;
        if (!satRects(a.x, a.z, a.cs, a.sn, a.hx, a.hz, b.x, b.z, b.cs, b.sn, b.hx, b.hz)) continue;
        const nx = sat.nx, nz = sat.nz;
        // positional correction split by inverse mass (a little slop so resting neighbours do not chatter)
        const corr = Math.max(0, sat.depth - 0.003); const wa = a.invMass / (a.invMass + b.invMass);
        a.x -= nx * corr * wa; a.z -= nz * corr * wa; b.x += nx * corr * (1 - wa); b.z += nz * corr * (1 - wa); a.dirty = b.dirty = true;
        if (!dynamic) continue;
        const rax = sat.px - a.x, raz = sat.pz - a.z, rbx = sat.px - b.x, rbz = sat.pz - b.z;
        const vn = ((b.vx + b.w * rbz) - (a.vx + a.w * raz)) * nx + ((b.vz - b.w * rbx) - (a.vz - a.w * rax)) * nz;   // < 0: approaching
        if (vn > -0.05) continue;
        const vlin = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;                                  // linear closing speed before the impulse, for the noise below
        const who = a.asleep ? b.lastWho : b.asleep ? a.lastWho : (a.speed > b.speed ? a.lastWho : b.lastWho);   // momentum hand-over carries the blame with it
        const ca = raz * nx - rax * nz, cb = rbz * nx - rbx * nz;
        const e = Math.min(a.tune.rest, b.tune.rest);
        const jn = -(1 + e) * vn / (a.invMass + b.invMass + a.invI * ca * ca + b.invI * cb * cb);
        a.vx -= jn * nx * a.invMass; a.vz -= jn * nz * a.invMass; a.w -= jn * ca * a.invI;
        b.vx += jn * nx * b.invMass; b.vz += jn * nz * b.invMass; b.w += jn * cb * b.invI;
        this.clampVel(a); this.clampVel(b);
        a.lastWho = b.lastWho = who; a.wake(); b.wake();
        // audible clatter: judged on the bodies' linear closing speed (spin at a corner is not loudness), and not while a character is squeezing them together
        if (-vlin > 0.9 && this.time - Math.max(a.pushT, b.pushT) > 0.05) this.noise(a.mass < b.mass ? a : b, 'thud', -vlin, who, 0.12 + 0.14 * -vlin);
      }
    }
  }

  /** Push prop p out of the static boxes around it (up to 3 passes); with `dynamic`, reflect/friction its velocity at the contact and report knocks. */
  private solveStatics(p: Prop, dynamic: boolean) {
    const boxes = this.col.boxes;
    for (let it = 0; it < 3; it++) {
      const R = p.radius + 0.02;
      const n = this.col.gather(p.x - R, p.z - R, p.x + R, p.z + R, Y_MIN, p.height, this.near);
      let any = false;
      for (let k = 0; k < n; k++) {
        const b = boxes[this.near[k]];
        const bcs = Math.cos(b.yaw), bsn = Math.sin(b.yaw);
        // circle-vs-rect early out (most gathered boxes are metres of wall nowhere near the prop)
        const dx = p.x - b.c[0], dz = p.z - b.c[2]; const lx = bcs * dx - bsn * dz, lz = bsn * dx + bcs * dz;
        const ex = Math.abs(lx) - b.h[0], ez = Math.abs(lz) - b.h[2]; if (ex > p.radius || ez > p.radius || (ex > 0 && ez > 0 && ex * ex + ez * ez > p.radius * p.radius)) continue;
        if (!satRects(b.c[0], b.c[2], bcs, bsn, b.h[0], b.h[2], p.x, p.z, p.cs, p.sn, p.hx, p.hz)) continue;
        any = true; const nx = sat.nx, nz = sat.nz;
        p.x += nx * sat.depth; p.z += nz * sat.depth; p.dirty = true;
        if (!dynamic) continue;
        const rx = sat.px - p.x, rz = sat.pz - p.z;
        const vpx = p.vx + p.w * rz, vpz = p.vz - p.w * rx; const vn = vpx * nx + vpz * nz;   // < 0: driving into the wall
        if (vn >= 0) continue;
        const vlin = p.vx * nx + p.vz * nz;                                                   // the body's own closing speed, for the noise below (before the impulse changes it)
        const cr = rz * nx - rx * nz; const kn = p.invMass + p.invI * cr * cr; const jn = -(1 + p.tune.rest) * vn / kn;
        p.vx += jn * nx * p.invMass; p.vz += jn * nz * p.invMass; p.w += jn * cr * p.invI;
        // Coulomb friction along the wall (μ 0.4): a carton dragged along a partition slows, a chair glancing off a jamb spins away
        const tx = -nz, tz = nx; const vt = vpx * tx + vpz * tz;
        if (Math.abs(vt) > 1e-4) { const ct = rz * tx - rx * tz; const kt = p.invMass + p.invI * ct * ct; let jt = -vt / kt; const lim = 0.4 * jn; if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim; p.vx += jt * tx * p.invMass; p.vz += jt * tz * p.invMass; p.w += jt * ct * p.invI; }
        this.clampVel(p);
        // a knock worth hearing: something coasting into the wall on its own (linear speed; a pinned prop's corner spin is not an impact) — not a prop
        // somebody is walking into the wall right now (that shove already made its scrape, and a sprint makes it a loud one)
        if (-vlin > 0.8 && this.time - p.pushT > 0.05) this.noise(p, 'thud', -vlin, p.lastWho, 0.1 + 0.15 * -vlin);
      }
      if (!any) break;
    }
  }
}
// scratch for circleContact
const cc = { nx: 0, nz: 0, pen: 0, px: 0, pz: 0 };
