// Corpse physics: a 16-particle Verlet ragdoll (Jakobsen-style position projection) seeded from a Character's bones at the moment of
// death. Particles are spheres that collide with the floor, with the static boxes of the collision grid and with the door leaves — full
// 3-D sphere against yawed box, so a body slides under a desk but never into it, and slumps against the wall it died next to instead of
// clipping through it. The trunk (pelvis, mid-spine, neck, both shoulders, both hips) is one rigid cluster held together by shape matching,
// which also yields the trunk rotation the skinned mesh is driven with (Character.updateRagdoll); each limb is two stiff sticks; joint
// ranges are cheap: cones for hips and neck, a minimum shoulder–hand / hip–ankle distance so elbows and knees cannot fold shut, a 'knees
// bend forward, elbows back' inequality, and a handful of sphere–sphere keep-aparts so limbs do not pass through the torso or each other.
// Contacts get Coulomb friction; a body at rest goes to sleep (cost: nothing) until it is dragged or shoved. Dragging = the two ankle
// particles pinned to a point at the player's hands, the rest follows through the constraints.
// The stepping code does not allocate: flat Float64Arrays indexed by particle, scratch members for everything else.
import { Vec3, Quat } from '../math/vec';
import type { Box } from '../scene/boxes';

/** What the ragdoll needs from the collision layer (StaticCollision satisfies it; null = a bare floor at y = 0). */
export interface RagdollWorld {
  boxes: Box[]; dynamicBoxes: Box[];
  gather(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, out: Int32Array): number;
}

/** Particle indices. Seeded from Character.bones: pelvis = hips joint, spine = spine.002, head = skull centre, sho* = upper-arm joints,
 *  elb* = forearm joints, hand* = mid-palm, hip* = thigh joints, knee* = shin joints, ank* = foot joints. */
export const RAG = { pelvis: 0, spine: 1, neck: 2, head: 3, shoL: 4, shoR: 5, elbL: 6, elbR: 7, handL: 8, handR: 9, hipL: 10, hipR: 11, kneeL: 12, kneeR: 13, ankL: 14, ankR: 15 } as const;
export const RAG_COUNT = 16;
const N = RAG_COUNT;
/** collision radii (m) ≈ the capsule shadow proxies' (Character.capsules): the spine joints sit mid-depth in the torso, so 12-13 cm covers back and chest */
const RADIUS = [0.12, 0.13, 0.07, 0.11, 0.07, 0.07, 0.05, 0.05, 0.05, 0.05, 0.09, 0.09, 0.065, 0.065, 0.06, 0.06];
/** masses (kg-ish, only the ratios matter): ~70 in all, half of it in the two trunk lumps */
const MASS = [12, 15, 3, 5, 3, 3, 2, 2, 1, 1, 6, 6, 4, 4, 2, 2];
/** the rigid cluster (shape matched): pelvis, spine, neck, shoulders, hips */
const TRUNK = [0, 1, 2, 4, 5, 10, 11];
const TRUNK_SET = new Uint8Array(N); for (const i of TRUNK) TRUNK_SET[i] = 1;
/** stiff sticks (equality distance constraints): neck–head, upper arms, forearms, thighs, shins — lengths taken from the bind pose */
const STICKS: [number, number][] = [[2, 3], [4, 6], [6, 8], [5, 7], [7, 9], [10, 12], [12, 14], [11, 13], [13, 15]];
const LEG_STICKS = [5, 6, 7, 8];   // rows of STICKS whose stretch counts as 'the body is wedged' while dragged (see strain)
/** folding stops: an elbow closes to ~35°, a knee to ~40° — as a minimum straight-line shoulder–hand / hip–ankle distance (m) */
const MINDIST: [number, number, number][] = [[4, 8, 0.16], [5, 9, 0.16], [10, 14, 0.30], [11, 15, 0.30]];
/** keep-aparts (sphere–sphere at k × the radius sum): legs against each other, arms against the torso / head / each other, head off the shoulders. Arms are let in
 *  close (0.6): an arm trapped under the chest should give, not prop the whole trunk up like a kickstand and roll it over onto its back */
const APART: [number, number, number][] = [[12, 13, 0.9], [14, 15, 0.9], [12, 15, 0.9], [13, 14, 0.9], [6, 0, 0.6], [6, 1, 0.6], [7, 0, 0.6], [7, 1, 0.6], [8, 0, 0.6], [8, 1, 0.6], [8, 2, 0.6], [8, 3, 0.7], [9, 0, 0.6], [9, 1, 0.6], [9, 2, 0.6], [9, 3, 0.7], [8, 9, 0.8], [6, 7, 0.8], [4, 3, 0.9], [5, 3, 0.9]];   // (limb first: it is the one that gets the friction contact, see apart())
/** knee direction rule over (hip, knee, ankle): the knee must stay on the trunk's forward side of the hip–ankle line — legs buckle forward, never bird-legged. (Elbows get
 *  no such rule: 'behind the shoulder–hand line' is wrong for half the poses arms take, and enforcing it clubbed forward-falling bodies over onto their backs.) */
const KNEES: [number, number, number][] = [[10, 12, 14], [11, 13, 15]];
const HIP_CONE_COS = Math.cos(75 * Math.PI / 180), NECK_CONE_COS = Math.cos(55 * Math.PI / 180);   // thigh within 75° of an axis tilted 47° forward of straight down (−25° extension … 120° flexion); head within 55° of the trunk's up

const H = 1 / 180, MAX_SUBSTEPS = 9, ITERS = 8;
const GRAV = 9.8, DAMP = Math.pow(0.45, H), DAMP_PINNED = Math.pow(0.003, H);   // velocity retention per second 0.45 (as a per-substep factor): falls stay lively, nothing rattles on; much heavier while dragged so the trailing body does not swing about
const DAMP_SETTLE = Math.pow(0.02, H), SETTLE_V = 0.25;   // once the trunk is down to SETTLE_V (m/s) the limbs get this instead: joints have friction, a dead arm does not swing on its shoulder–hand hinge for three seconds
const MAX_STEP = 0.045;     // m per substep (8 m/s, which a fall from standing never reaches): below the smallest radius, so a particle that ended a substep outside a box can never find its centre inside one — the push-out side is never ambiguous, no tunnelling through 8 cm partitions or 5 cm door leaves
const PIN_STEP = 2.4 * H;   // m per substep a pinned ankle travels toward the hands (2.4 m/s): taking hold of a body gathers its legs in over a few frames instead of yanking it
const MU = 0.7;             // Coulomb friction on floor and boxes: a shot body skids a hand's breadth, a dragged one trails straight behind you
const SLEEP_WINDOW = 0.35, SLEEP_DISP = 0.012, MAX_AWAKE = 12;   // asleep when no particle has moved SLEEP_DISP (m) over the last SLEEP_WINDOW (s) — robust to both millimetre jitter and slow creep; hard cap (s)
const Y_MIN = 0.03;         // statics entirely below this are floor finishes (the floor itself is the plane y = 0)

export class Ragdoll {
  /** positions / previous positions, xyz per particle (world space) */
  readonly x = new Float64Array(N * 3); readonly px = new Float64Array(N * 3);
  private readonly w = new Float64Array(N);           // effective inverse masses (0 while pinned)
  private readonly pinT = new Float64Array(N * 3); private readonly pinned = new Uint8Array(N); private anyPin = false;
  private readonly pen = new Float64Array(N); private readonly cn = new Float64Array(N * 3);   // per substep: deepest contact + summed contact normal per particle
  private readonly stickLen = new Float64Array(STICKS.length);
  // trunk cluster: rest offsets from the bind centroid (world axes at bind), the running rotation estimate bind → now (also what the mesh is posed
  // with), its 3×3 matrix, the current centroid; A = moment matrix scratch
  private readonly r0 = new Float64Array(TRUNK.length * 3); private trunkMass = 0;
  readonly rot: Quat = [0, 0, 0, 1]; private readonly R = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); private readonly centre: Vec3 = [0, 0, 0]; private readonly prevCentre: Vec3 = [0, 0, 0]; private readonly A = new Float64Array(9);
  // anatomical axes at bind (world): forward, up, and the hip cone axis; rotated by R when used
  private readonly fwd0: Vec3; private readonly up0: Vec3; private readonly hipAxis0: Vec3;
  // statics / door leaves near the body this substep (indices, with their yaw cos/sin cached)
  private readonly near = new Int32Array(384); private readonly nearCS = new Float64Array(384 * 2); private nNear = 0;
  private readonly dyn = new Int32Array(32); private readonly dynCS = new Float64Array(32 * 2); private nDyn = 0;
  private readonly exitL = new Float64Array(3); private readonly exitP = new Float64Array(3);   // sphereBox scratch (centre-inside case)
  private readonly snap = new Float64Array(N * 3); private snapT = 0;                          // positions SLEEP_WINDOW ago (sleep test)
  sleeping = false; private awake = 0; private acc = 0;
  /** largest stretch (m) of a leg stick after the last substep: while the ankles are pinned to the player's hands this is how hard the body is wedged */
  strain = 0;
  private impactV = 0; private sinceImpact = 1;

  /** pts: RAG_COUNT world positions; vel: matching velocities (m/s) or null. */
  constructor(pts: Vec3[], vel: Vec3[] | null, private world: RagdollWorld | null) {
    const x = this.x, px = this.px;
    for (let i = 0; i < N; i++) { const p = pts[i]; x[i * 3] = p[0]; x[i * 3 + 1] = Math.max(p[1], RADIUS[i]); x[i * 3 + 2] = p[2]; this.w[i] = 1 / MASS[i]; }
    for (let s = 0; s < STICKS.length; s++) this.stickLen[s] = this.dist(STICKS[s][0], STICKS[s][1]);
    // trunk rest shape about its mass centroid
    let M = 0, cx = 0, cy = 0, cz = 0;
    for (const i of TRUNK) { const m = MASS[i]; M += m; cx += x[i * 3] * m; cy += x[i * 3 + 1] * m; cz += x[i * 3 + 2] * m; }
    this.trunkMass = M; cx /= M; cy /= M; cz /= M; this.centre[0] = this.prevCentre[0] = cx; this.centre[1] = this.prevCentre[1] = cy; this.centre[2] = this.prevCentre[2] = cz;
    TRUNK.forEach((i, k) => { this.r0[k * 3] = x[i * 3] - cx; this.r0[k * 3 + 1] = x[i * 3 + 1] - cy; this.r0[k * 3 + 2] = x[i * 3 + 2] - cz; });
    // anatomical frame: left = hips + shoulders line, up = pelvis → neck (made orthogonal), forward = left × up (model +X is the figure's left, +Z its front)
    const lx = (x[30] - x[33]) + (x[12] - x[15]), ly = (x[31] - x[34]) + (x[13] - x[16]), lz = (x[32] - x[35]) + (x[14] - x[17]);
    const ll = Math.hypot(lx, ly, lz) || 1; const sx = lx / ll, sy = ly / ll, sz = lz / ll;
    let ux = x[6] - x[0], uy = x[7] - x[1], uz = x[8] - x[2]; const d = ux * sx + uy * sy + uz * sz; ux -= sx * d; uy -= sy * d; uz -= sz * d;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    this.up0 = [ux, uy, uz]; this.fwd0 = [sy * uz - sz * uy, sz * ux - sx * uz, sx * uy - sy * ux];
    const ca = Math.cos(47.5 * Math.PI / 180), sa = Math.sin(47.5 * Math.PI / 180);
    this.hipAxis0 = [-ux * ca + this.fwd0[0] * sa, -uy * ca + this.fwd0[1] * sa, -uz * ca + this.fwd0[2] * sa];
    // a hand or an elbow posed inside a wall at the moment of death (aiming along it) is walked back toward the pelvis until it is clear —
    // otherwise its first push-out could pick the far face and leave the arm hooked through the wall
    this.gatherNear();
    for (let i = 1; i < N; i++) for (let k = 0; k < 12 && this.buried(i); k++) {
      const dx = x[0] - x[i * 3], dy = x[1] - x[i * 3 + 1], dz = x[2] - x[i * 3 + 2]; const l = Math.hypot(dx, dy, dz) || 1;
      x[i * 3] += dx / l * 0.03; x[i * 3 + 1] += dy / l * 0.03; x[i * 3 + 2] += dz / l * 0.03;
    }
    for (let i = 0; i < N * 3; i++) px[i] = x[i];
    if (vel) for (let i = 0; i < N; i++) { const v = vel[i]; px[i * 3] -= v[0] * H; px[i * 3 + 1] -= v[1] * H; px[i * 3 + 2] -= v[2] * H; }
    this.snap.set(x);
  }

  private dist(i: number, j: number) { const x = this.x; return Math.hypot(x[j * 3] - x[i * 3], x[j * 3 + 1] - x[i * 3 + 1], x[j * 3 + 2] - x[i * 3 + 2]); }
  /** World position of particle i (into `out`). */
  point(i: number, out: Vec3 = [0, 0, 0]): Vec3 { out[0] = this.x[i * 3]; out[1] = this.x[i * 3 + 1]; out[2] = this.x[i * 3 + 2]; return out; }
  radius(i: number) { return RADIUS[i]; }
  /** Add velocity (m/s) to one particle. Wakes the body. */
  addVelocity(i: number, v: Vec3, scale = 1) { this.px[i * 3] -= v[0] * scale * H; this.px[i * 3 + 1] -= v[1] * scale * H; this.px[i * 3 + 2] -= v[2] * scale * H; this.wake(); this.awake = 0; }
  /** Add a rigid velocity field to the whole body: v + ω × (p − trunk centre) — the shove of a round / a slump as one coherent motion, so no limb is left
   *  standing still for the trunk to run into (momentum traded through the keep-aparts skews which way it falls). */
  addRigidVelocity(v: Vec3, omega: Vec3) {
    const c = this.centre, x = this.x, px = this.px;
    for (let i = 0; i < N; i++) {
      const o = i * 3; const rx = x[o] - c[0], ry = x[o + 1] - c[1], rz = x[o + 2] - c[2];
      px[o] -= (v[0] + omega[1] * rz - omega[2] * ry) * H; px[o + 1] -= (v[1] + omega[2] * rx - omega[0] * rz) * H; px[o + 2] -= (v[2] + omega[0] * ry - omega[1] * rx) * H;
    }
    this.wake(); this.awake = 0;
  }
  /** Displace one particle in the ground plane (a door leaf leaning on the body — see Game.updateDoors); wakes it if it actually moved. */
  nudge(i: number, dx: number, dz: number) { if (Math.abs(dx) + Math.abs(dz) < 1e-4) return; this.x[i * 3] += dx; this.x[i * 3 + 2] += dz; this.px[i * 3] += dx; this.px[i * 3 + 2] += dz; this.wake(); }
  /** Simulate again from now (a shove, a pin, a leaf moving beside it). Does not reset the MAX_AWAKE budget — only a round or being dragged does that — so
   *  something that keeps prodding a settled body a millimetre at a time cannot keep it simulating forever. */
  wake() { if (!this.sleeping) return; this.sleeping = false; this.snapT = 0; this.snap.set(this.x); }
  /** Hold particle i at `target` (moved there kinematically, ≤ PIN_STEP per substep); the rest of the body follows through the constraints. */
  setPin(i: number, target: Vec3) {
    this.pinT[i * 3] = target[0]; this.pinT[i * 3 + 1] = Math.max(target[1], RADIUS[i]); this.pinT[i * 3 + 2] = target[2];
    if (!this.pinned[i]) { this.pinned[i] = 1; this.w[i] = 0; this.anyPin = true; }
    this.wake();
  }
  clearPins() { if (!this.anyPin) return; for (let i = 0; i < N; i++) { this.pinned[i] = 0; this.w[i] = 1 / MASS[i]; } this.anyPin = false; this.strain = 0; }
  /** Checkpoint restore (game/savestate.ts): lay the body straight into a settled pose — every particle where the file has it, at rest, unpinned, asleep — with
   *  the trunk cluster's rotation re-fitted to those particles (warm-started from the file's `rot`, or from where it stands): a corpse comes back where and how
   *  it lay without being simulated there again. The trunk is snapped rigid to THIS body's bind shape, so its members may move a centimetre off the file. */
  settleAt(xs: ArrayLike<number>, rot?: ArrayLike<number>) {
    const x = this.x, px = this.px;
    for (let i = 0; i < N * 3; i++) { const v = Number(xs[i]); x[i] = Number.isFinite(v) ? v : x[i]; }
    for (let i = 0; i < N; i++) x[i * 3 + 1] = Math.max(x[i * 3 + 1], RADIUS[i]);
    if (rot && Number.isFinite(rot[0] + rot[1] + rot[2] + rot[3])) { const l = Math.hypot(rot[0], rot[1], rot[2], rot[3]) || 1; this.rot[0] = rot[0] / l; this.rot[1] = rot[1] / l; this.rot[2] = rot[2] / l; this.rot[3] = rot[3] / l; }
    this.clearPins();
    for (let k = 0; k < 8; k++) this.shapeMatch();   // (each pass = 10 extraction iterations warm-started from the last: converged well past a plain lie-down's quarter turn)
    for (let i = 0; i < N * 3; i++) px[i] = x[i];
    const c = this.centre, pc = this.prevCentre; pc[0] = c[0]; pc[1] = c[1]; pc[2] = c[2];
    this.snap.set(x); this.snapT = 0; this.awake = 0; this.acc = 0; this.strain = 0; this.impactV = 0; this.sleeping = true;
  }
  /** Hardest trunk / head landing (m/s along the contact normal) worth hearing (≥ min) since the last one reported, at most every `gap` seconds; 0 otherwise.
   *  Softer contacts (and the steady press of a body at rest) neither report nor use up the gap. */
  takeImpact(min = 1.4, gap = 0.25): number { const v = this.impactV; this.impactV = 0; if (v < min || this.sinceImpact < gap) return 0; this.sinceImpact = 0; return v; }

  /** Advance by dt (s): fixed 180 Hz substeps from an accumulator (at most MAX_SUBSTEPS per call — a long frame drops the remainder rather than spiral). */
  step(dt: number) {
    this.sinceImpact += dt;
    if (this.sleeping) return;
    this.acc = Math.min(this.acc + dt, H * MAX_SUBSTEPS);
    while (this.acc >= H - 1e-9) { this.acc -= H; this.substep(); if (this.sleeping) { this.acc = 0; break; } }
  }

  private substep() {
    const x = this.x, px = this.px, pinned = this.pinned, pinT = this.pinT;
    // 1. integrate (Verlet: velocity is x − px), gravity, damping, per-step travel cap; pinned particles travel toward their target instead, carrying no inertia
    const c = this.centre, pc = this.prevCentre; const trunkV = Math.hypot(c[0] - pc[0], c[1] - pc[1], c[2] - pc[2]) / H; pc[0] = c[0]; pc[1] = c[1]; pc[2] = c[2];
    const damp = this.anyPin ? DAMP_PINNED : DAMP, dampLimb = this.anyPin ? DAMP_PINNED : trunkV < SETTLE_V ? DAMP_SETTLE : DAMP; const g = GRAV * H * H;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      if (pinned[i]) {
        let dx = pinT[o] - x[o], dy = pinT[o + 1] - x[o + 1], dz = pinT[o + 2] - x[o + 2]; const l = Math.hypot(dx, dy, dz);
        if (l > PIN_STEP) { const s = PIN_STEP / l; dx *= s; dy *= s; dz *= s; }
        x[o] += dx; x[o + 1] += dy; x[o + 2] += dz; px[o] = x[o]; px[o + 1] = x[o + 1]; px[o + 2] = x[o + 2]; continue;
      }
      const d = TRUNK_SET[i] ? damp : dampLimb;
      let vx = (x[o] - px[o]) * d, vy = (x[o + 1] - px[o + 1]) * d - g, vz = (x[o + 2] - px[o + 2]) * d;
      const l = Math.hypot(vx, vy, vz); if (l > MAX_STEP) { const s = MAX_STEP / l; vx *= s; vy *= s; vz *= s; }
      px[o] = x[o]; px[o + 1] = x[o + 1]; px[o + 2] = x[o + 2]; x[o] += vx; x[o + 1] += vy; x[o + 2] += vz;
    }
    // 2. what is around the body this substep
    this.gatherNear(); this.pen.fill(0); this.cn.fill(0);
    // 3. project constraints, collisions last so nothing ends an iteration inside geometry
    for (let it = 0; it < ITERS; it++) {
      for (let s = 0; s < STICKS.length; s++) this.distance(STICKS[s][0], STICKS[s][1], this.stickLen[s], this.stickLen[s]);
      for (let s = 0; s < MINDIST.length; s++) this.distance(MINDIST[s][0], MINDIST[s][1], MINDIST[s][2], 1e9);
      for (let s = 0; s < APART.length; s++) this.apart(APART[s][0], APART[s][1], (RADIUS[APART[s][0]] + RADIUS[APART[s][1]]) * APART[s][2]);
      this.cone(10, 12, this.hipAxis0, HIP_CONE_COS); this.cone(11, 13, this.hipAxis0, HIP_CONE_COS); this.cone(2, 3, this.up0, NECK_CONE_COS);
      for (let s = 0; s < KNEES.length; s++) this.knee(KNEES[s][0], KNEES[s][1], KNEES[s][2]);
      this.shapeMatch();
      for (let i = 0; i < N; i++) this.collide(i);
    }
    // 4. contacts: kill the velocity still heading into the surface, Coulomb friction on the slide (proportional to how hard the contact pressed this substep, i.e. its
    //    depth; below that it sticks, so bodies actually stop), note trunk / head landings for the thud
    for (let i = 0; i < N; i++) {
      const pen = this.pen[i]; if (pinned[i] || pen <= 0) continue;
      const o = i * 3; let vx = x[o] - px[o], vy = x[o + 1] - px[o + 1], vz = x[o + 2] - px[o + 2];
      let nx = this.cn[o], ny = this.cn[o + 1], nz = this.cn[o + 2]; const nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      let vn = vx * nx + vy * ny + vz * nz;
      if (i <= 3) { const hit = Math.max(-vn, 0) / H; if (hit > this.impactV) this.impactV = hit; }   // only what was still falling into the surface counts as a landing — contact depth from a shove / un-bury is a correction, not a thud
      if (vn < 0) { vx -= nx * vn; vy -= ny * vn; vz -= nz * vn; vn = 0; }
      const tx = vx - nx * vn, ty = vy - ny * vn, tz = vz - nz * vn; const tl = Math.hypot(tx, ty, tz);
      if (tl > 1e-12) { const keep = Math.max(0, 1 - MU * pen / tl); vx = nx * vn + tx * keep; vy = ny * vn + ty * keep; vz = nz * vn + tz * keep; }
      px[o] = x[o] - vx; px[o + 1] = x[o + 1] - vy; px[o + 2] = x[o + 2] - vz;
    }
    // 5. how stretched the legs are (drag release valve); sleep once nothing has really moved for a while (or it has been at it far too long: a limb trading
    //    millimetres with a table leg forever is not worth simulating)
    let strain = 0;
    if (this.anyPin) for (const s of LEG_STICKS) strain = Math.max(strain, Math.abs(this.dist(STICKS[s][0], STICKS[s][1]) - this.stickLen[s]));
    this.strain = strain;
    if (this.anyPin) { this.awake = 0; this.snapT = 0; return; }
    this.awake += H; this.snapT += H;
    if (this.snapT >= SLEEP_WINDOW) {
      let still = true; const sx = this.snap;
      for (let i = 0; i < N * 3; i += 3) if (Math.abs(x[i] - sx[i]) + Math.abs(x[i + 1] - sx[i + 1]) + Math.abs(x[i + 2] - sx[i + 2]) > SLEEP_DISP) { still = false; break; }
      if (still || this.awake > MAX_AWAKE) { this.sleeping = true; for (let i = 0; i < N * 3; i++) px[i] = x[i]; }
      sx.set(x); this.snapT = 0;
    }
  }

  /** Clamp |xj − xi| into [lo, hi], corrections split by inverse mass. */
  private distance(i: number, j: number, lo: number, hi: number) {
    const x = this.x; const a = i * 3, b = j * 3;
    const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]; const l = Math.hypot(dx, dy, dz); if (l < 1e-9) return;
    const target = l < lo ? lo : l > hi ? hi : l; if (target === l) return;
    const wi = this.w[i], wj = this.w[j]; const ws = wi + wj; if (ws <= 0) return;
    const k = (l - target) / (l * ws);
    x[a] += dx * k * wi; x[a + 1] += dy * k * wi; x[a + 2] += dz * k * wi; x[b] -= dx * k * wj; x[b + 1] -= dy * k * wj; x[b + 2] -= dz * k * wj;
  }
  /** Sphere–sphere keep-apart of a limb particle i off particle j (min distance lo), logged as a contact on the limb so the friction pass grips it: an arm draped over
   *  the chest comes to rest instead of creeping off it for seconds (the constraint alone is frictionless). */
  private apart(i: number, j: number, lo: number) {
    const x = this.x; const a = i * 3, b = j * 3;
    const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2]; const l = Math.hypot(dx, dy, dz); if (l >= lo || l < 1e-9) return;
    const wi = this.w[i], wj = this.w[j]; const ws = wi + wj; if (ws <= 0) return;
    const k = (lo - l) / (l * ws);
    x[a] += dx * k * wi; x[a + 1] += dy * k * wi; x[a + 2] += dz * k * wi; x[b] -= dx * k * wj; x[b + 1] -= dy * k * wj; x[b + 2] -= dz * k * wj;
    this.contact(i, dx / l, dy / l, dz / l, (lo - l) * wi / ws);
  }
  /** Keep the direction i→j within acos(cosMax) of a trunk-relative axis (given at bind, turned with the trunk). */
  private cone(i: number, j: number, axis0: Vec3, cosMax: number) {
    const x = this.x, R = this.R; const a = i * 3, b = j * 3;
    const ax = R[0] * axis0[0] + R[1] * axis0[1] + R[2] * axis0[2], ay = R[3] * axis0[0] + R[4] * axis0[1] + R[5] * axis0[2], az = R[6] * axis0[0] + R[7] * axis0[1] + R[8] * axis0[2];
    const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]; const l = Math.hypot(dx, dy, dz); if (l < 1e-6) return;
    const ux = dx / l, uy = dy / l, uz = dz / l; const c = ux * ax + uy * ay + uz * az; if (c >= cosMax) return;
    let qx = ux - ax * c, qy = uy - ay * c, qz = uz - az * c; const ql = Math.hypot(qx, qy, qz); if (ql < 1e-6) return;
    const sinMax = Math.sqrt(1 - cosMax * cosMax); qx *= sinMax / ql; qy *= sinMax / ql; qz *= sinMax / ql;
    // nearest direction on the cone, same length; move j there (and i back) by inverse mass
    const ex = (ax * cosMax + qx) * l - dx, ey = (ay * cosMax + qy) * l - dy, ez = (az * cosMax + qz) * l - dz;
    const wi = this.w[i], wj = this.w[j]; const ws = wi + wj; if (ws <= 0) return;
    x[b] += ex * wj / ws; x[b + 1] += ey * wj / ws; x[b + 2] += ez * wj / ws; x[a] -= ex * wi / ws; x[a + 1] -= ey * wi / ws; x[a + 2] -= ez * wi / ws;
  }
  /** Knee bend direction: knee k must lie on the trunk's forward side of the hip–ankle line, C = (k − (h + t·(a − h))) · fwd ≥ 0, projected with inverse-mass weights
   *  (gradients fwd, −(1−t)·fwd, −t·fwd: linear momentum is kept, so the rule cannot shove the body about). */
  private knee(hi: number, ki: number, ai: number) {
    const x = this.x, R = this.R, f0 = this.fwd0; const a = hi * 3, b = ki * 3, c = ai * 3;
    const fx = R[0] * f0[0] + R[1] * f0[1] + R[2] * f0[2], fy = R[3] * f0[0] + R[4] * f0[1] + R[5] * f0[2], fz = R[6] * f0[0] + R[7] * f0[1] + R[8] * f0[2];
    const ux = x[c] - x[a], uy = x[c + 1] - x[a + 1], uz = x[c + 2] - x[a + 2]; const l2 = ux * ux + uy * uy + uz * uz; if (l2 < 1e-8) return;
    let t = ((x[b] - x[a]) * ux + (x[b + 1] - x[a + 1]) * uy + (x[b + 2] - x[a + 2]) * uz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const C = (x[b] - x[a] - ux * t) * fx + (x[b + 1] - x[a + 1] - uy * t) * fy + (x[b + 2] - x[a + 2] - uz * t) * fz;
    if (C >= 0) return;
    const wh = this.w[hi], wk = this.w[ki], wa = this.w[ai]; const den = wk + wh * (1 - t) * (1 - t) + wa * t * t; if (den <= 0) return;
    const s = -C / den; const dk = wk * s, dh = -wh * (1 - t) * s, da = -wa * t * s;
    x[b] += fx * dk; x[b + 1] += fy * dk; x[b + 2] += fz * dk; x[a] += fx * dh; x[a + 1] += fy * dh; x[a + 2] += fz * dh; x[c] += fx * da; x[c + 1] += fy * da; x[c + 2] += fz * da;
  }

  /** Rigid trunk: best-fit rotation of the cluster against its bind shape (mass-weighted moment matrix → rotation, warm-started from last time), then every
   *  member snapped to centroid + R·rest offset. Preserves the cluster's linear and angular momentum; `rot` / `R` / `centre` are what the mesh is posed from. */
  private shapeMatch() {
    const x = this.x, r0 = this.r0, A = this.A, M = this.trunkMass;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < TRUNK.length; k++) { const o = TRUNK[k] * 3, m = MASS[TRUNK[k]]; cx += x[o] * m; cy += x[o + 1] * m; cz += x[o + 2] * m; }
    cx /= M; cy /= M; cz /= M; this.centre[0] = cx; this.centre[1] = cy; this.centre[2] = cz;
    A.fill(0);
    for (let k = 0; k < TRUNK.length; k++) {
      const o = TRUNK[k] * 3, q = k * 3, m = MASS[TRUNK[k]]; const px = (x[o] - cx) * m, py = (x[o + 1] - cy) * m, pz = (x[o + 2] - cz) * m;
      A[0] += px * r0[q]; A[1] += px * r0[q + 1]; A[2] += px * r0[q + 2]; A[3] += py * r0[q]; A[4] += py * r0[q + 1]; A[5] += py * r0[q + 2]; A[6] += pz * r0[q]; A[7] += pz * r0[q + 1]; A[8] += pz * r0[q + 2];
    }
    extractRotation(A, this.rot, 10); quatToMat(this.rot, this.R); const R = this.R;   // (a flat cluster converges slowly per iteration, but it is warm-started 8× a substep and the trunk turns ≤ 1° per substep: it tracks)
    for (let k = 0; k < TRUNK.length; k++) {
      const o = TRUNK[k] * 3, q = k * 3; const rx = r0[q], ry = r0[q + 1], rz = r0[q + 2];
      x[o] = cx + R[0] * rx + R[1] * ry + R[2] * rz; x[o + 1] = cy + R[3] * rx + R[4] * ry + R[5] * rz; x[o + 2] = cz + R[6] * rx + R[7] * ry + R[8] * rz;
    }
  }

  /** Statics whose footprint overlaps the body's box (± a margin) and door leaves within reach, with their yaw cos/sin — once per substep. */
  private gatherNear() {
    this.nNear = 0; this.nDyn = 0; const wd = this.world; if (!wd) return;
    const x = this.x; let x0 = 1e9, x1 = -1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < N; i++) { const o = i * 3; if (x[o] < x0) x0 = x[o]; if (x[o] > x1) x1 = x[o]; if (x[o + 1] > y1) y1 = x[o + 1]; if (x[o + 2] < z0) z0 = x[o + 2]; if (x[o + 2] > z1) z1 = x[o + 2]; }
    const mg = 0.25; x0 -= mg; x1 += mg; z0 -= mg; z1 += mg; y1 += mg;
    const n = wd.gather(x0, z0, x1, z1, Y_MIN, y1, this.near); let m = 0;
    for (let k = 0; k < n; k++) {   // most of what the 1 m cells return is metres of wall nowhere near the body: keep only footprints that overlap its box
      const b = wd.boxes[this.near[k]]; const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const ex = Math.abs(c) * b.h[0] + Math.abs(s) * b.h[2], ez = Math.abs(s) * b.h[0] + Math.abs(c) * b.h[2];
      if (b.c[0] + ex < x0 || b.c[0] - ex > x1 || b.c[2] + ez < z0 || b.c[2] - ez > z1 || b.c[1] - b.h[1] > y1) continue;
      this.near[m] = this.near[k]; this.nearCS[m * 2] = c; this.nearCS[m * 2 + 1] = s; m++;
    }
    this.nNear = m;
    const dbs = wd.dynamicBoxes;
    for (let j = 0; j < dbs.length && this.nDyn < this.dyn.length; j++) {
      const b = dbs[j]; const reach = Math.hypot(b.h[0], b.h[2]);
      if (b.c[0] + reach < x0 || b.c[0] - reach > x1 || b.c[2] + reach < z0 || b.c[2] - reach > z1) continue;
      this.dyn[this.nDyn] = j; this.dynCS[this.nDyn * 2] = Math.cos(b.yaw); this.dynCS[this.nDyn * 2 + 1] = Math.sin(b.yaw); this.nDyn++;
    }
  }
  /** True if particle i's centre is inside one of the gathered statics (bind-time check only). */
  private buried(i: number): boolean {
    const wd = this.world; if (!wd) return false; const x = this.x; const o = i * 3;
    for (let k = 0; k < this.nNear; k++) {
      const b = wd.boxes[this.near[k]]; const c = this.nearCS[k * 2], s = this.nearCS[k * 2 + 1];
      const dx = x[o] - b.c[0], dy = x[o + 1] - b.c[1], dz = x[o + 2] - b.c[2];
      if (Math.abs(c * dx - s * dz) < b.h[0] && Math.abs(dy) < b.h[1] && Math.abs(s * dx + c * dz) < b.h[2]) return true;
    }
    return false;
  }
  /** Push particle i out of the floor, the nearby statics and door leaves; records contact depth / normal for the friction pass. */
  private collide(i: number) {
    const x = this.x; const o = i * 3; const r = RADIUS[i];
    if (x[o + 1] < r) { this.contact(i, 0, 1, 0, r - x[o + 1]); x[o + 1] = r; }
    const wd = this.world; if (!wd) return;
    for (let k = 0; k < this.nNear; k++) this.sphereBox(i, r, wd.boxes[this.near[k]], this.nearCS[k * 2], this.nearCS[k * 2 + 1]);
    for (let k = 0; k < this.nDyn; k++) this.sphereBox(i, r, wd.dynamicBoxes[this.dyn[k]], this.dynCS[k * 2], this.dynCS[k * 2 + 1]);
  }
  private contact(i: number, nx: number, ny: number, nz: number, pen: number) {
    if (pen > this.pen[i]) this.pen[i] = pen; const o = i * 3; this.cn[o] += nx * pen; this.cn[o + 1] += ny * pen; this.cn[o + 2] += nz * pen;
  }
  /** Sphere (particle i, radius r) against a yawed box (yaw cos/sin passed in; the level's convention: local x = c·dx − s·dz, local z = s·dx + c·dz). Outside:
   *  pushed off the closest point. Centre inside (only ever at bind, under a pin, or when a leaf swept over it): out through a face the previous position
   *  was outside of, else the nearest face. */
  private sphereBox(i: number, r: number, b: Box, c: number, s: number) {
    const x = this.x; const o = i * 3; const h = b.h;
    const dx = x[o] - b.c[0], dy = x[o + 1] - b.c[1], dz = x[o + 2] - b.c[2];
    const lx = c * dx - s * dz, ly = dy, lz = s * dx + c * dz;
    if (Math.abs(lx) > h[0] + r || Math.abs(ly) > h[1] + r || Math.abs(lz) > h[2] + r) return;
    const qx = lx < -h[0] ? -h[0] : lx > h[0] ? h[0] : lx, qy = ly < -h[1] ? -h[1] : ly > h[1] ? h[1] : ly, qz = lz < -h[2] ? -h[2] : lz > h[2] ? h[2] : lz;
    const ddx = lx - qx, ddy = ly - qy, ddz = lz - qz; const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
    if (d2 >= r * r) return;
    let nlx: number, nly: number, nlz: number, pen: number;
    if (d2 > 1e-12) { const d = Math.sqrt(d2); nlx = ddx / d; nly = ddy / d; nlz = ddz / d; pen = r - d; }
    else {
      const px = this.px; const pdx = px[o] - b.c[0], pdy = px[o + 1] - b.c[1], pdz = px[o + 2] - b.c[2];
      const el = this.exitL; el[0] = lx; el[1] = ly; el[2] = lz; const ep = this.exitP; ep[0] = c * pdx - s * pdz; ep[1] = pdy; ep[2] = s * pdx + c * pdz;
      let bestA = -1, bestS = 1, best = 1e9;
      for (let pass = 0; pass < 2 && bestA < 0; pass++) for (let a = 0; a < 3; a++) for (let sg = -1; sg <= 1; sg += 2) {
        if (pass === 0 && sg * ep[a] < h[a] - 1e-9) continue;   // first pass: only faces the previous position was beyond
        const fd = h[a] - sg * el[a]; if (fd < best) { best = fd; bestA = a; bestS = sg; }
      }
      nlx = bestA === 0 ? bestS : 0; nly = bestA === 1 ? bestS : 0; nlz = bestA === 2 ? bestS : 0; pen = best + r;
    }
    const nx = c * nlx + s * nlz, ny = nly, nz = -s * nlx + c * nlz;
    x[o] += nx * pen; x[o + 1] += ny * pen; x[o + 2] += nz * pen; this.contact(i, nx, ny, nz, pen);
  }
}

/** Rotational part of the 3×3 matrix A (row-major), refined from the warm start q in place — Müller et al. 2016, "A Robust Method to Extract the Rotational Part
 *  of Deformations": repeatedly turn q by ω = Σ (Rcolᵢ × Acolᵢ) / |Σ Rcolᵢ · Acolᵢ|. A handful of iterations from last substep's answer is exact enough; degenerate
 *  (flat) clusters are fine because the answer is always a proper rotation near the previous one. */
const erR = new Float64Array(9);
function extractRotation(A: Float64Array, q: Quat, iters: number) {
  for (let it = 0; it < iters; it++) {
    quatToMat(q, erR); const R = erR;
    // columns j of R and A: (R[j], R[3+j], R[6+j])
    let ox = 0, oy = 0, oz = 0, dot = 0;
    for (let j = 0; j < 3; j++) {
      const rx = R[j], ry = R[3 + j], rz = R[6 + j], ax = A[j], ay = A[3 + j], az = A[6 + j];
      ox += ry * az - rz * ay; oy += rz * ax - rx * az; oz += rx * ay - ry * ax; dot += rx * ax + ry * ay + rz * az;
    }
    const inv = 1 / (Math.abs(dot) + 1e-9); ox *= inv; oy *= inv; oz *= inv;
    const wl = Math.hypot(ox, oy, oz); if (wl < 1e-9) break;
    const ha = wl * 0.5, sn = Math.sin(ha) / wl, cw = Math.cos(ha); const bx = ox * sn, by = oy * sn, bz = oz * sn;   // q ← axisAngle(ω/|ω|, |ω|) · q
    const ax = q[0], ay = q[1], az = q[2], aw = q[3];
    const nx = cw * ax + bx * aw + by * az - bz * ay, ny = cw * ay - bx * az + by * aw + bz * ax, nz = cw * az + bx * ay - by * ax + bz * aw, nw = cw * aw - bx * ax - by * ay - bz * az;
    const l = Math.hypot(nx, ny, nz, nw) || 1; q[0] = nx / l; q[1] = ny / l; q[2] = nz / l; q[3] = nw / l;
  }
}
/** Row-major 3×3 rotation matrix of unit quaternion q into out (out·v = quat.rotate(q, v)). */
function quatToMat(q: Quat, out: Float64Array) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const xx = x * x * 2, yy = y * y * 2, zz = z * z * 2, xy = x * y * 2, xz = x * z * 2, yz = y * z * 2, wx = w * x * 2, wy = w * y * 2, wz = w * z * 2;
  out[0] = 1 - yy - zz; out[1] = xy - wz; out[2] = xz + wy;
  out[3] = xy + wz; out[4] = 1 - xx - zz; out[5] = yz - wx;
  out[6] = xz - wy; out[7] = yz + wx; out[8] = 1 - xx - yy;
}
