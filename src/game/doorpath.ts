// EACH MAN WALKS A REAL PATH THROUGH THE DOOR (`DOORPATH.on`; ON in the page — `?nodoorpath` puts it off, `?doorpath=gun` adds the gun rule —, off in the
// harness unless TPS_DOORPATH=1[,knob=value…]; off: the entry exactly as it was).
//
// What a room entry did (doortools.ts, the 'enter' stage): every man was let go a quarter second after the one before, each handed his point of domination and
// the nav grid's path to it. The grid knows walls; it does not know a LEAF standing open, nor the man in front. So the second man in hooked tight round the
// hinge jamb for his corner, walked into the leaf's open face and pushed it to its stop — where the door's own rule (doors.ts: a keyed man pressed on a leaf at
// its stop pulls it to) swung it shut THROUGH him and through the next man in the opening; and four men let go on a clock met in the frame shoulder to
// shoulder. With the switch on:
//   THE LANE    each man's walk is laid by hand from where he stands: to a point `outM` short of the frame line, across it at `at` of the opening from the
//               hinge (the half the leaf is not in), on to a point `inM` inside — one file through the middle of the gap, square to the frame
//   THE LEAF    from there to his point a leg may not come within `leafClear` of any leaf AS IT STANDS (his own door's, the next room's): where the straight
//               leg would, he goes ROUND THE FREE TIP on an arc that keeps that much air (re-laid as the leaf moves). A point with NO way round — the pocket between an
//               open leaf and the wall behind it, its mouth narrower than a man and that clearance — is not walked into through the leaf: his point is
//               moved to the nearest floor of the same room he can reach and stand on clear of every leaf (`moved`; the order's own record of his point
//               moves with it). While the leaf is still swinging nothing is decided: he walks his lane and waits at its end for it to stand. Only a point
//               with no such floor near it is walked straight, as before, and counted (`noRound`)
//   THE FILE    the men go in the order the door order dealt, one at a time: a man is let go when the man before him will be `gapM` ahead of him as he
//               reaches the frame line (0: the moment that man will be first at the line — the second gun is through half a second behind the first); and a man who comes within `shortM` of one sent before him, with that man in front of him, eases off until there is
//               room. Nobody is ever kept longer than `cap` seconds either way — a file that cannot form goes as the old one did
//   THE GUN     (`gun` — SHIPS OFF, see the knob) a barrel is not carried, and a weapon light not shone, through a door. A teammate WALKING on an order whose aim point lies across a
//               leaf standing off its frame, inside the gun's reach of him, carries the gun up along the way he goes until the leaf is behind it (never
//               onto the back of one of his own in that line: `gunLane`), then onto his point; where the gun as it lies is in a leaf, or he stands with his point across one, it comes down to the
//               low ready until the line is clear (Guard.muzzleDown: the pose, the hysteresis and the fire gate a friend in the line already has). Any
//               man under one of Sam's orders with his long gun at the shoulder, on a walk of this module or not — but never a man with an enemy in
//               his sights (`gunOver`, off), nor a drill's or a show's cast
// The walk itself is the runner's own (squad.ts → guards.ts followPath): this module only keeps the man's path two points long — a point `look` metres ahead
// of him on his line, then his goal — so his legs, his pace, his lean and his collisions are everybody's. followPath's stuck watchdog still has him: when it
// side-steps or re-plans, the walk stands back for a moment and is re-laid from where that left him; twice, and the nav has him for good (`gaveUp`).
// But for a point moved out from behind a leaf it changes no point of domination, and it changes no order and no gun: where the men end up and what they
// do there is the door order's — but for the gun lowered at a leaf.
import { SideMap, SideSet } from '../math/side';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { DoorOp } from './doortools';
import type { Vec3 } from '../math/vec';

export const DOORPATH = {
  on: false,
  /** where the lane cuts the frame line: this share of the opening from the hinge (the leaf's root is at 0). 0.52 since the doors are real size
   *  (scene/doorSize.ts): between a leaf standing square on its stop and the latch stop a man's body has 0.325 to 0.556 m of a 0.86 m leaf's frame line to
   *  put his middle on, and the lane runs down the middle of that (0.6, as it was for the 1.16 m leaves, ran him a hand off the latch stop) */
  at: 0.52,
  /** the lane's ends: metres short of the frame line, metres past it */
  outM: 0.7, inM: 0.7,
  /** how far ahead of him on his line the point he walks at is kept */
  look: 0.5,
  /** no leg nearer than this to a leaf's centre line as it stands (the door's own contact starts at 0.365) */
  leafClear: 0.45,
  /** the arc round a leaf's free tip is laid this far out from it (a man walking at a point ahead of him cuts a corner by a hand or two) */
  tipM: 0.75,
  /** let go when the man before him will be this far ahead at the frame line · eased off inside this of a man sent before him (stopped 0.35 nearer).
   *  0 and 0.6 = the next man goes the moment the man before him will reach the line first, and gives way only to a body's width: the four cross inside
   *  about 1.1 s, half a second apart. (0.5 and 1.05, as first built, spaced them 0.6 s apart and brought the second man through the depot's first door
   *  0.2 s after the old entry did — his partner fought the room alone for that long, and the depot lost 24 teammates in 576 over 144 seeds) */
  gapM: 0, shortM: 0.6,
  /** the most a man is held back, seconds: at the stack, and again on the way */
  cap: 2.5,
  /** a point behind a leaf is moved at most this far · and stays this far from another man's point */
  moveM: 0, apartM: 0.7,   // (moveM 0 since the doors rules share this tree: where a body rests behind a leaf is theirs; 1.8 = the walk moving a point by itself)
  /** the gun comes down where its line would cross an open leaf · how far that line is taken from his chest (the shouldered muzzle stands ~0.8 m out) · a leaf this
   *  near its frame (rad) is the wall's: the stack's own carriage is for that · the line is also tried where he will stand this many seconds on ·
   *  and this far either side of his centre · with an enemy in his sights the rule leaves him alone unless this is set.
   *  THE GUN RULE SHIPS OFF, set by its tally (144 seeds a mission, the page's settings, the same seeds with and without it): with it on the office
   *  kept 23 fewer teammates of 576 (interval 0 to 47) and the depot 12 fewer (inside the scatter) — a gun at the low ready has no sights and takes its
   *  light off the room, 2.7 s an entry in the office. What it buys is real: in the office two men carry rifle and light through the server door's leaf
   *  for half a second in every run without it (rifle spells of 0.2 s and over 370 → 175, weapon light 339 → 17; the depot 27 → 0). Wanted in its
   *  place: a carry that pulls the rifle in and keeps eyes and light up — no such pose exists */
  gun: false, gunM: 0.95, gunAjar: 0.12, gunLead: 0.3, gunSide: 0.15, gunOver: false,
  /** the gun rule also has a man who STANDS (on his mark, in the stack, holding his point): off, only a man on his way somewhere is touched — a standing man
   *  keeps his gun where his order has it, through a leaf or not (a lowered gun takes his sights and his light off the room) */
  gunStill: true,
  /** the gun rule may bring a gun DOWN to the low ready: off, it only ever carries the gun up along a walking man's way (nothing is lowered: a gun at the
   *  low ready sees nothing, lights nothing and fires nothing, and a contested doorway is where that costs men) */
  gunDown: true,
  /** the gun is carried along his way only while nobody of his own stands in that line (a gun turned onto the back of the man ahead in the file is a gun
   *  the room fight then lowers for him): with a friend there it stays where his order has it */
  gunLane: true,
  /** a man down within this of a point still being walked to: the point is moved off him (0: never — a man walks onto the fallen as before) · the new
   *  point stands this far from where any man down lies · and at most this far from the point as dealt */
  bodyM: 0, bodyOff: 0.6, bodyMove: 1.2,
};

interface Walk {
  gd: Guard; op: DoorOp; door: Door; pod: Vec3; n: number; t0: number;
  /** his line (pts[0] where he stood when it was laid), its running length, how far along he is · the leaf angles it was laid against */
  pts: Vec3[]; len: number[]; s: number; laidT: number; near: { d: Door; angle: number }[]; lane: number;
  /** what this module last put under him (the watchdog's hand shows as a change) · standing back until · how often · seconds held short · off his order since */
  via: Vec3[]; arr: Vec3[] | null; arrN: number; yieldT: number; yields: number; held: number; offT: number; round: boolean;
  /** a leaf by his line is still swinging: his line ends at the lane's end until it stands · seconds waited so */
  wait: boolean; waited: number;
  /** the lane's inner end as it was laid (metres past the frame line) · his point as the door order dealt it (a moved point is looked for round this one) */
  inM: number; pod0: Vec3;
  /** when his point was last looked at for a man down on it */
  bodyT: number;
}

const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** a door blown off its hinges (doors.ts `Door.off`, where a build has that rule): there is no leaf in the frame to walk round, or to keep a gun out of —
 *  the slab on the floor is nobody's to route by. A build without the rule has no such door, and this is never true */
const gone = (d: Door) => (d as Door & { off?: boolean }).off === true;
/** the least distance between segments a→b and c→d on the floor */
function segSeg(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const cross = (ox: number, oz: number, px: number, pz: number, qx: number, qz: number) => (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
  const d1 = cross(c[0], c[2], d[0], d[2], a[0], a[2]), d2 = cross(c[0], c[2], d[0], d[2], b[0], b[2]), d3 = cross(a[0], a[2], b[0], b[2], c[0], c[2]), d4 = cross(a[0], a[2], b[0], b[2], d[0], d[2]);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
}
function ptSeg(p: Vec3, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz, t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[2] - a[2] - dz * t);
}

export class DoorPath {
  walks = new Map<Guard, Walk>();
  /** per door order: the walk last let go, how many so far */
  private lastOf = new SideMap<DoorOp, { W: Walk | null; n: number; t: number }>();
  stats = { sent: 0, walked: 0, round: 0, noRound: 0, noLane: 0, late: 0, heldS: 0, capped: 0, yields: 0, gaveUp: 0, taken: 0, relaid: 0, turned: 0, moved: 0, waitS: 0, nav: 0, gunS: 0, guns: 0, gunAhead: 0, stepped: 0 };
  constructor(private g: Game) {}
  reset() { this.walks.clear(); this.lent.length = 0; }

  /** THE GUN: every teammate under one of Sam's orders, his long gun up at the shoulder — its line across an open leaf has it carried along his walk, or
   *  brought down (and kept down while it would cross). What it writes on his script is his for THIS frame's pose only: `after()` puts it back */
  private low = new SideSet<Guard>();
  private lent: { gd: Guard; s: NonNullable<Guard['script']>; mine: Vec3; aimAt: Vec3 | null | undefined; face: number | null | undefined; strafe: boolean | undefined }[] = [];
  private guns(dt: number) {
    const K = DOORPATH, g = this.g; if (!K.gun) return;
    for (const gd of g.guards) {
      const s = gd.script, c = gd.char;
      // (a man this rule has with his gun down who now has an enemy in his sights gets it back AT ONCE — not after the low ready's fifth of a second: at
      //  three metres that is the fight. The room fight, which runs next, lowers it again itself if a friend is in the line)
      if (s && s.over && !K.gunOver && this.low.has(gd) && gd.muzzleDown) { gd.muzzleDown = false; gd.muzzleClearT = 0; }
      // (only a man an order of Sam's is posing this frame; never one a drill or a show has weapons-free — `hot` —, and with a man of his own in his
      //  sights — `over` — only if `gunOver`: a gun kept off a man costs lives, and his eye sees round a leaf's edge that the line from his chest crosses)
      if (!s || !gd.unit || gd.team !== 'operative' || gd.state === 'dead' || !c.anim.longGun || s.hot || !g.orders.of(gd) || (s.over ? !K.gunOver : (s.upper ?? 'aim') !== 'aim')) { this.low.delete(gd); continue; }
      const p = c.pos, sp = Math.hypot(c.vel[0], c.vel[2]), lx = c.vel[0] * K.gunLead, lz = c.vel[2] * K.gunLead;   // (the line is tried where he stands and where he will stand by the time the gun has moved)
      const L: [Vec3, Vec3][] = []; for (const d of g.doors.list) { const h = d.def.hinge; if (!gone(d) && Math.abs(d.angle) >= K.gunAjar && Math.hypot(h[0] - p[0], h[1] - p[2]) < d.def.width + K.gunM + 0.5 + sp * K.gunLead) L.push(this.leaf(d)); }
      if (!L.length) { this.low.delete(gd); continue; }
      if (!K.gunStill && !(s.goal && !s.arrived && flat(p, s.goal) > 0.5)) { this.low.delete(gd); continue; }
      // the gun's line on a heading: from his chest, and a shoulder's width either side of it (the gun rides off his centre), a little past the muzzle
      const crosses = (yaw: number, lead = true) => { const sx = Math.sin(yaw), cz = Math.cos(yaw);
        for (const o of [0, K.gunSide, -K.gunSide]) { const a: Vec3 = [p[0] + cz * o, 0, p[2] - sx * o], b: Vec3 = [a[0] + sx * K.gunM, 0, a[2] + cz * K.gunM];
          if (L.some(l => segSeg(a, b, l[0], l[1]) < 0.06)) return true;
          if (lead && o === 0 && L.some(l => segSeg([a[0] + lx, 0, a[2] + lz], [b[0] + lx, 0, b[2] + lz], l[0], l[1]) < 0.06)) return true; }
        return false; };
      let down: boolean;
      if (s.over) down = crosses(c.aimYaw, false);   // (`gunOver`: the gun as it lies, no looking ahead)
      else {
        down = crosses(c.aimYaw);   // the gun as it lies is in the door, or about to be: down until it is out of it
        // where the order wants the gun: across a leaf?
        const at = s.aimAt, wish = at && flat(at, p) > 0.2 ? Math.atan2(at[0] - p[0], at[2] - p[2]) : null;
        if (wish !== null && crosses(wish) || (!K.gunDown && down)) {
          // on his way somewhere: the gun stays UP and goes the way he goes — muzzle through the gap, onto his corner once the leaf is behind it (the first
          // man through a door does not look at the floor). Standing: down
          const nx = gd.path[gd.pathI], go = sp > 0.3 ? Math.atan2(c.vel[0], c.vel[2]) : nx && flat(nx, p) > 0.2 ? Math.atan2(nx[0] - p[0], nx[2] - p[2]) : null;
          if (s.goal && !s.arrived && flat(p, s.goal) > 0.5 && go !== null && !crosses(go) && !(K.gunLane && this.friendOn(gd, go))) {
            const mine: Vec3 = [p[0] + Math.sin(go) * 3, 1.2, p[2] + Math.cos(go) * 3]; this.lent.push({ gd, s, mine, aimAt: s.aimAt, face: s.face, strafe: s.strafe });
            s.aimAt = mine; s.strafe = false; s.face = null; this.stats.gunAhead += dt; }
          else down = true;
        }
      }
      if (!down || !K.gunDown) { this.low.delete(gd); continue; }
      gd.muzzleDown = true; gd.muzzleClearT = 0; this.stats.gunS += dt; if (!this.low.has(gd)) { this.low.add(gd); this.stats.guns++; }
    }
  }
  /** one of his own (a teammate up, or Sam) in the line of a gun carried on this heading: within 8 m, off the line by less than half a metre and a third of
   *  how far along it he stands */
  private friendOn(gd: Guard, yaw: number): boolean {
    const p = gd.char.pos, sx = Math.sin(yaw), cz = Math.cos(yaw), g = this.g;
    const on = (q: Vec3) => { const dx = q[0] - p[0], dz = q[2] - p[2], a = dx * sx + dz * cz; return a > 0.2 && a < 8 && Math.abs(dx * cz - dz * sx) < 0.5 + a * 0.3; };
    if (on(g.player.char.pos)) return true;
    for (const o of g.guards) if (o !== gd && o.unit && o.team === 'operative' && o.state !== 'dead' && on(o.char.pos)) return true;
    return false;
  }
  /** after the men have been posed and walked: what `guns()` lent a script for the frame is taken back, so whoever reads or keeps that script next — the
   *  cover's deal, a drill that sets its point once — finds the order's own (game.ts, after the guards' update). A field somebody has rewritten since is theirs */
  after() {
    if (!this.lent.length) return;
    for (const x of this.lent) { const s = x.gd.script; if (s !== x.s) continue; if (s.aimAt === x.mine) s.aimAt = x.aimAt; if (s.face === null) s.face = x.face; if (s.strafe === false) s.strafe = x.strafe; }
    this.lent.length = 0;
  }

  /** the leaf as it stands: hinge → free tip */
  private leaf(d: Door): [Vec3, Vec3] { const u = d.dir(), h = d.def.hinge; return [[h[0], 0, h[1]], [h[0] + u[0] * d.def.width, 0, h[1] + u[1] * d.def.width]]; }
  private leaves(near: Vec3, far: Vec3): [Vec3, Vec3][] { const out: [Vec3, Vec3][] = []; for (const d of this.g.doors.list) { if (gone(d)) continue; const L = this.leaf(d); if (segSeg(near, far, L[0], L[1]) < 2.5) out.push(L); } return out; }
  /** a man can stand here: clear of every static at his own width */
  private free(p: Vec3): boolean { const q: Vec3 = [p[0], 0, p[2]]; this.g.col.collideCircle(q, 0.3, 0.2, 1.5, 3); return flat(q, p) < 0.03; }
  private open(a: Vec3, b: Vec3): boolean {
    if (this.g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]])) return false;
    const d = flat(a, b), n = Math.floor(d / 0.3); for (let i = 1; i < n; i++) { const k = i / n; if (!this.free([a[0] + (b[0] - a[0]) * k, 0, a[2] + (b[2] - a[2]) * k])) return false; }
    return true;
  }

  /** from a to b keeping `leafClear` off every leaf nearby: the corners to walk (b last), or null when no way round was found. A point that itself stands nearer
   *  a leaf than the clearance is asked only for what it has. */
  private roundLeaves(a: Vec3, b: Vec3): { pts: Vec3[]; round: boolean } | null {
    const K = DOORPATH, c = K.leafClear, L = this.leaves(a, b);
    const off = (p: Vec3) => { let m = Infinity; for (const l of L) m = Math.min(m, ptSeg(p, l[0], l[1])); return m; };
    const ok = (p: Vec3, q: Vec3, dp: number, dq: number) => { const need = Math.max(0.05, Math.min(c, dp, dq) - 0.02); for (const l of L) if (segSeg(p, q, l[0], l[1]) < need) return false; return true; };
    const da = off(a), db = off(b);
    if (ok(a, b, da, db)) return { pts: [b], round: false };
    // the corners: an arc round each leaf's free tip, far enough out (tipM) that the chords between them — and the corner a man cuts walking at a point
    // ahead of him — keep the clearance
    const rr = K.tipM, nodes: Vec3[] = [a, b], dist: number[] = [da, db];
    for (const l of L) { const th = Math.atan2(l[1][2] - l[0][2], l[1][0] - l[0][0]);
      for (let k = -3; k <= 3; k++) { const p: Vec3 = [l[1][0] + Math.cos(th + k * Math.PI / 4) * rr, 0, l[1][2] + Math.sin(th + k * Math.PI / 4) * rr]; if (this.free(p)) { nodes.push(p); dist.push(off(p)); } } }
    // the shortest way over them (a dozen points: the plain search)
    const N = nodes.length, best = new Array<number>(N).fill(Infinity), from = new Array<number>(N).fill(-1), done = new Array<boolean>(N).fill(false); best[0] = 0;
    for (;;) { let i = -1; for (let k = 0; k < N; k++) if (!done[k] && best[k] < Infinity && (i < 0 || best[k] < best[i])) i = k; if (i < 0 || i === 1) break; done[i] = true;
      for (let j = 1; j < N; j++) { if (done[j]) continue; const w = best[i] + flat(nodes[i], nodes[j]); if (w >= best[j]) continue; if (!ok(nodes[i], nodes[j], dist[i], dist[j]) || !this.open(nodes[i], nodes[j])) continue; best[j] = w; from[j] = i; } }
    if (best[1] === Infinity) return null;
    const pts: Vec3[] = []; for (let i = 1; i > 0; i = from[i]) pts.unshift(nodes[i]);
    return { pts, round: true };
  }

  /** from a to b for a man's feet: clear of the leaves (roundLeaves) AND of the level — where the straight leg is not a man's width of open floor (a table
   *  between the door and his point, a wall between a late man and the lane), the nav grid's own path, each leg of it taken round the leaves */
  private way(a: Vec3, b: Vec3): { pts: Vec3[]; round: boolean } | null {
    const R = this.roundLeaves(a, b); if (!R) return null;
    let prev = a, clear = true; for (const q of R.pts) { if (!this.open(prev, q)) { clear = false; break; } prev = q; }
    if (clear) return R;
    const N = this.g.col.nav.findPath(a, b, 3000); if (!N || !N.length) return R;   // (no plan either: the straight leg, as the runner would have walked it)
    if (flat(N[N.length - 1], b) > 0.05) N.push(b);
    const pts: Vec3[] = []; let round = false; prev = a;
    for (const w of N) { if (flat(prev, w) < 0.05) continue; const r = this.roundLeaves(prev, w); if (!r) return null; pts.push(...r.pts); round ||= r.round; prev = w; }
    this.stats.nav++; return pts.length ? { pts, round } : R;
  }

  /** his line from where he stands: the lane through the opening while he is outside it, then round the leaves to his point */
  private lay(W: Walk) {
    const K = DOORPATH, d = W.door, p = W.gd.char.pos, h = d.def.hinge, ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir), wide = d.def.width;
    const vx = uz * W.op.side, vz = -ux * W.op.side;   // into the room: off the side the men stacked on
    const at = (s: number): Vec3 => [h[0] + ux * wide * K.at + vx * s, 0, h[1] + uz * wide * K.at + vz * s];
    const s0 = (p[0] - h[0]) * vx + (p[2] - h[1]) * vz, a0 = (p[0] - h[0]) * ux + (p[2] - h[1]) * uz;
    const pts: Vec3[] = [[p[0], 0, p[2]]]; W.lane = 0;
    if (s0 < K.inM - 0.25 && flat(p, W.pod) > 0.6) {
      let inM = K.inM; const far = at(inM); if (!this.free(far)) inM = 0.45; W.inM = inM;
      const Pa = at(-K.outM), Pi = at(inM);
      if (this.free(Pi) && (s0 > -0.15 || this.free(Pa))) { if (s0 < -K.outM - 0.2 || (s0 < -0.15 && Math.abs(a0 - wide * K.at) > 0.15)) { const R0 = this.way(pts[0], Pa); if (R0) pts.push(...R0.pts); else pts.push(Pa); }   // (a leaf standing open on HIS side of the wall is gone round as well)
        pts.push(Pi); W.lane = pts.length - 1; }
      else this.stats.noLane++;
    }
    const from = pts[pts.length - 1]; let R = this.way(from, W.pod); W.wait = false;
    if (!R && W.waited < K.cap && this.g.doors.list.some(x => !gone(x) && Math.abs(x.vel) > 0.15 && segSeg(from, W.pod, ...this.leaf(x)) < 2.5)) W.wait = true;   // (a leaf still swinging: no verdict on it yet)
    else if (!R) { const q = this.stand(W, from); if (q) { this.move(W, q); R = this.way(from, q); } }
    if (R) { pts.push(...R.pts); if (R.round && !W.round) { W.round = true; this.stats.round++; } } else if (!W.wait) { pts.push(W.pod); this.stats.noRound++; }
    W.pts = pts; W.len = [0]; for (let i = 1; i < pts.length; i++) W.len.push(W.len[i - 1] + flat(pts[i - 1], pts[i]));
    W.s = 0; W.laidT = this.g.time; W.arr = null;
    W.near = []; for (const x of this.g.doors.list) { if (gone(x)) continue; const L = this.leaf(x); let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, segSeg(pts[i - 1], pts[i], L[0], L[1])); if (m < 2.5) W.near.push({ d: x, angle: x.angle }); }
  }
  /** his point stands where no walk reaches it clear of a leaf: the nearest floor of the same room that one does, a man can stand on, `leafClear` off every
   *  leaf as it stands and `apartM` off every other point of his order — or null */
  private stand(W: Walk, from: Vec3, reach = DOORPATH.moveM): Vec3 | null {
    const K = DOORPATH, pod = W.pod0, L = this.leaves(pod, pod), others: Vec3[] = [], room = this.g.fight?.roomAt(pod) ?? null, down = K.bodyM > 0 ? this.fallen(pod, reach + K.bodyOff + 0.5) : [];
    for (const [m, q] of W.op.pod) if (m !== W.gd) others.push(q.pos); for (const q of W.op.queue) if (q.gd !== W.gd) others.push(q.pod.pos);
    for (let r = 0.3; r <= reach + 1e-6; r += 0.3) { let best: Vec3 | null = null, bd = Infinity;
      for (let k = 0; k < 16; k++) { const c: Vec3 = [pod[0] + Math.cos(k * Math.PI / 8) * r, 0, pod[2] + Math.sin(k * Math.PI / 8) * r];
        if (!this.free(c) || L.some(l => ptSeg(c, l[0], l[1]) < K.leafClear + 0.05) || others.some(o => flat(o, c) < K.apartM) || down.some(o => flat(o, c) < K.bodyOff) || (this.g.fight?.roomAt(c) ?? null) !== room) continue;
        const dd = flat(c, from); if (dd >= bd || !this.way(from, c)) continue; best = c; bd = dd; }
      if (best) return best; }
    return null;
  }
  /** where the men down lie within `r` of a point (hips, chest and head of each: a body is longer than it is wide) */
  private fallen(at: Vec3, r: number): Vec3[] {
    const out: Vec3[] = [];
    for (const x of [...this.g.guards, ...this.g.civilians]) { if (x.state !== 'dead' && !x.char.ragdoll) continue; const b = x.char.bones;
      for (const q of [b.hips, b.chest, b.head]) if (q && flat(q, at) < r) out.push([q[0], 0, q[2]]); }
    return out;
  }
  /** his point is `q` now: this walk's, the order's (orders.ts Assignment post / goal — the same object, so the door order still knows it for its own),
   *  the runner's, and the door order's record of where he was sent */
  private move(W: Walk, q: Vec3) {
    const gd = W.gd, old = W.pod, A = this.g.orders.of(gd), pod = W.op.pod.get(gd); W.pod = q; this.stats.moved++;
    if (A && A.post && flat(A.post, old) < 0.1) { A.post = [q[0], A.post[1], q[2]]; A.goal = [q[0], A.post[1], q[2]]; if (gd.script && gd.script.goal && flat(gd.script.goal, old) < 0.1) gd.script.goal = A.goal; }
    if (pod && flat(pod.pos, old) < 0.1) W.op.pod.set(gd, { ...pod, pos: [q[0], pod.pos[1], q[2]] });
  }
  private total(W: Walk) { return W.len[W.len.length - 1]; }
  private pointAt(W: Walk, s: number): Vec3 {
    const n = W.pts.length; if (s >= this.total(W)) return W.pts[n - 1];
    let i = 1; while (i < n - 1 && W.len[i] < s) i++;
    const a = W.pts[i - 1], b = W.pts[i], l = W.len[i] - W.len[i - 1], k = l > 1e-6 ? (s - W.len[i - 1]) / l : 1;
    return [a[0] + (b[0] - a[0]) * k, 0, a[2] + (b[2] - a[2]) * k];
  }
  /** how far along his line he is now: the nearest point of it from where he was to a metre on (never back) */
  private advance(W: Walk): number {
    const p = W.gd.char.pos; let bestS = W.s, bestD = Infinity;
    for (let i = 1; i < W.pts.length; i++) { if (W.len[i] < W.s) continue; const a = W.pts[i - 1], b = W.pts[i], l = W.len[i] - W.len[i - 1]; if (l < 1e-6) continue; if (W.len[i - 1] > W.s + 1) break;
      const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[2] - a[2]) * (b[2] - a[2])) / (l * l))), s = Math.max(W.s, Math.min(W.s + 1, W.len[i - 1] + k * l)), q = this.pointAt(W, s), dd = flat(p, q);
      if (dd < bestD - 1e-6) { bestD = dd; bestS = s; } }
    W.s = bestS; return bestD;
  }
  /** metres of his line still to walk to the frame line of his door (negative: that far past it) */
  private toLine(W: Walk): number { return W.lane > 0 ? W.len[W.lane] - W.inM - W.s : -this.depth(W.door, W.op.side, W.gd.char.pos); }
  private depth(d: Door, side: number, p: ArrayLike<number>) { const h = d.def.hinge, ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir); return (p[0] - h[0]) * uz * side - (p[2] - h[1]) * ux * side; }

  /** doortools.ts, the entry: may the queue's i-th man be let go now? One at a time, in the order dealt, each once the man before him has his start. */
  mayGo(op: DoorOp, q: { gd: Guard; pod: { pos: Vec3 } }, i: number): boolean {
    if (i !== 0) return false;
    const K = DOORPATH, L = this.lastOf.get(op), t = this.g.time; if (!L || !L.W) return true;
    const V = L.W; if (V.gd.state === 'dead' || this.walks.get(V.gd) !== V) return true;
    if (t - L.t >= K.cap) { this.stats.late++; return true; }
    const d = op.door, p = q.gd.char.pos, h = d.def.hinge, ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir), out = -this.depth(d, op.side, p);
    const lx = h[0] + ux * d.def.width * K.at - uz * op.side * K.outM, lz = h[1] + uz * d.def.width * K.at + ux * op.side * K.outM;   // (the lane's outer end, as lay() has it)
    const mine = out > 0 ? Math.hypot(p[0] - lx, p[2] - lz) + K.outM : 0;   // his own walk to the line
    return mine - this.toLine(V) >= K.gapM;
  }
  /** doortools.ts, the entry: this man has just been handed his point */
  sent(op: DoorOp, gd: Guard, pod: { pos: Vec3 }) {
    const L = this.lastOf.get(op) ?? { W: null, n: 0, t: 0 }, t = this.g.time;
    const W: Walk = { gd, op, door: op.door, pod: [pod.pos[0], 0, pod.pos[2]], n: L.n, t0: t, pts: [], len: [0], s: 0, laidT: t, near: [], lane: 0, via: [], arr: null, arrN: 0, yieldT: -1, yields: 0, held: 0, offT: NaN, round: false, wait: false, waited: 0, inM: DOORPATH.inM, pod0: [pod.pos[0], 0, pod.pos[2]], bodyT: -1 };
    this.own(W);
    this.lay(W); this.walks.set(gd, W); this.lastOf.set(op, { W, n: L.n + 1, t }); this.stats.sent++;
  }

  /** the order's own way round (orders.ts route: waypoints to its door) is this walk's while it lasts: taken off the order, kept, and handed back if the
   *  walk is dropped before he is through */
  private own(W: Walk) { const A = this.g.orders.of(W.gd); if (!A || !A.post || flat(A.post, W.pod) > 0.1 || !A.via.length) return false; W.via = A.via.slice(); A.via.length = 0; A.goal = [A.post[0], A.post[1], A.post[2]]; return true; }
  private drop(W: Walk, why: 'taken' | 'gaveUp') {
    this.walks.delete(W.gd); this.stats[why]++;
    if (why === 'gaveUp') { W.gd.path = []; W.gd.pathGoal = null; }   // (the line under him was this walk's own array, side-steps spliced in: left there, goTo sees its goal met and never plans, and he goes straight at his point through whatever the line went round)
    const A = this.g.orders.of(W.gd); if (A && A.post && flat(A.post, W.pod) < 0.1 && !A.via.length && W.via.length && this.depth(W.door, W.op.side, W.gd.char.pos) < 0.3) { let k = 0; for (let i = 1; i < W.via.length; i++) if (flat(W.via[i], W.gd.char.pos) < flat(W.via[k], W.gd.char.pos)) k = i; A.via = W.via.slice(k).map(q => [q[0], q[1], q[2]] as Vec3); }   // (from the corner nearest him on: never back to one he has passed)
  }
  /** once a frame, after the orders have posed their men and before anybody moves */
  tick(dt: number) {
    if (!DOORPATH.on) { if (this.walks.size) this.walks.clear(); return; }
    const K = DOORPATH, g = this.g, t = g.time;
    this.guns(dt);
    for (const W of [...this.walks.values()]) {
      const gd = W.gd, s = gd.script, p = gd.char.pos;
      if (gd.state === 'dead' || t < W.t0 || !g.guards.includes(gd)) { this.walks.delete(gd); continue; }   // (dead · the clock has gone back: a checkpoint loaded · not on the floor any more: the encounter restarted)
      if (s && this.own(W)) { s.goal = g.orders.of(gd)!.goal; s.arrived = false; }   // (back from the fight, the order laid its own way round again)
      if (!s || !s.goal || flat(s.goal, W.pod) > 0.1) {   // off this order (the fight has him, or another word): the walk waits a moment for him, no longer
        if (isNaN(W.offT)) W.offT = t; else if (t - W.offT > 1.5) this.drop(W, 'taken'); W.arr = null; continue; }
      if (!isNaN(W.offT)) { W.offT = NaN; this.lay(W); this.stats.relaid++; }
      if (flat(p, W.pod) < Math.max(0.3, K.look * 0.6) && this.total(W) - W.s < K.look + 0.3) { this.walks.delete(gd); this.stats.walked++; continue; }   // there: the runner settles him onto the mark
      if (t < W.yieldT) continue;
      if (!W.wait && W.arr && gd.path === W.arr && gd.path.length === 1 && W.arr.length === 1 && gd.pathI >= 1) { this.walks.delete(gd); this.stats.walked++; continue; }   // (he has walked our last point out: the runner settles him onto the mark)
      if (W.arr && gd.path.length && (gd.path !== W.arr || gd.path.length !== W.arrN)) {   // somebody else has laid a path under him: the watchdog's side-step, or its re-plan
        if (++W.yields > 2) { this.drop(W, 'gaveUp'); continue; }
        W.yieldT = t + 0.8; W.arr = null; this.stats.yields++; continue; }
      if (!W.arr && W.yields && t >= W.yieldT) { this.lay(W); this.stats.relaid++; }
      // the leaves have moved under the line: laid afresh from here
      if (t - W.laidT > 0.2 && (W.wait || W.near.some(x => gone(x.d) || Math.abs(x.d.angle - x.angle) > 0.05))) { this.lay(W); this.stats.relaid++; }
      // a man has dropped on his point: it is moved a body's width off him (stand(): the nearest floor of that room he can reach clear of the leaves, the
      // other men's points and everybody who is down) — looked at four times a second while he is still a stride or more from it
      if (K.bodyM > 0 && t - W.bodyT > 0.25 && flat(p, W.pod) > 0.6) { W.bodyT = t;
        if (this.fallen(W.pod, K.bodyM).length) { const q = this.stand(W, [p[0], 0, p[2]], K.bodyMove); if (q) { this.move(W, q); this.lay(W); this.stats.stepped++; } } }
      const offLine = W.pts.length > 1 ? this.advance(W) : 0; if (offLine > 0.6) { this.lay(W); this.stats.relaid++; }
      const end = W.pts[W.pts.length - 1], tot = this.total(W), near = tot - W.s <= K.look;
      let cs = W.s + K.look, carrot = near ? end : this.pointAt(W, cs);
      while (!near && cs < tot && flat(p, carrot) < K.look - 1e-3) { cs += 0.05; carrot = this.pointAt(W, cs); }   // (round a corner the point ahead is kept that far off him as the crow flies: followPath takes a point for reached at 0.45)
      const arr: Vec3[] = near || cs >= tot ? [[end[0], 0, end[2]]] : [carrot, [end[0], 0, end[2]]];
      gd.path = arr; gd.pathI = 0; gd.pathGoal = [s.goal[0], s.goal[1], s.goal[2]]; W.arr = arr; W.arrN = arr.length;
      // his feet stay on the line: followPath walks a man where his CHEST points while it comes round to the path — and a man the room fight has just let go of
      // (it had him side-stepping with his chest to a threat) is facing anywhere: in a doorway that walked him into the leaf. Until he is round, he side-steps
      // along his line as the fight had him (the runner's strafe), his chest coming round to the way he goes
      { const yaw = Math.atan2(arr[0][0] - p[0], arr[0][2] - p[2]); if (flat(p, arr[0]) > 0.05 && Math.cos(yaw - gd.char.wantBody) < 0.7) { s.strafe = true; s.face = yaw; this.stats.turned += dt; } }   // (while the fight walks him with his chest to a man — over.walk — the runner strafes him already and this face is not read)
      // a leaf still swinging by his line: he stands at the lane's end until it stands (the order's stuck clocks wait with him)
      if (W.wait) { W.waited += dt; this.stats.waitS += dt; if (tot - W.s < 0.3) { s.speed = 0; const A = g.orders.of(gd); if (A) { A.movedT = A.markT = t; A.mark[0] = p[0]; A.mark[2] = p[2]; } } }
      // the file: room for the man sent before him
      if (W.held < K.cap) { let f = 1;
        for (const V of this.walks.values()) { if (V === W || V.door !== W.door || V.t0 > W.t0 || (V.t0 === W.t0 && V.n >= W.n)) continue; const q = V.gd.char.pos, dd = flat(p, q); if (dd > K.shortM || dd < 1e-3) continue;
          const hx = carrot[0] - p[0], hz = carrot[2] - p[2], hl = Math.hypot(hx, hz) || 1; if (((q[0] - p[0]) * hx + (q[2] - p[2]) * hz) / (hl * dd) < 0.2) continue;   // (beside or behind him: not in his way)
          f = Math.min(f, Math.max(0, (dd - (K.shortM - 0.35)) / 0.35)); }
        if (f < 1) { s.speed = (s.speed ?? g.tune.guardWalk) * f;
          if (f < 0.5) { W.held += dt; this.stats.heldS += dt; if (W.held >= K.cap) this.stats.capped++;
            const A = g.orders.of(gd); if (A) { A.movedT = A.markT = t; A.mark[0] = p[0]; A.mark[2] = p[2]; } } } }   // (a man waiting his turn is not a man who cannot get there: the order's stuck clocks wait with him, as for roomfight.ts holdShort)
    }
  }
  summary() { const S = this.stats; return `door paths ${DOORPATH.on ? 'on' : 'off'} · sent ${S.sent} · walked ${S.walked} · round a leaf ${S.round} (no way ${S.noRound}) · points moved off a leaf ${S.moved} · held ${S.heldS.toFixed(1)} s · gave up ${S.gaveUp} · taken ${S.taken}`; }
}
