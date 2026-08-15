// Rigid DEBRIS (the destruction lane, game/destruction.ts): the few things a firefight knocks loose that must stay GEOMETRY — a ceiling tile see-sawing down,
// a monitor housing off its stand, a mug or a run of binders off a desk — as a small POOL of tumbling boxes: ballistic flight with the throwables' swept
// sphere-vs-box contact against the statics, leaves and furniture (the support distance is the box's own extent along the surface normal, so a tile lands
// on its face and a binder on its edge), dead-ish bounces, a turn toward lying flat on each floor touch, settle, SLEEP; drawn as one dynamic shadow-casting
// box each. Bounded by construction (renderer v3 stage 2's chaos budget, docs/internal/image-quality.md §4: 64 tumbling casters cost +2 ms at high with no
// boil): the pool holds at most `cap()` chunks (settings.debrisCap: 64 ultra / high, 32 below) — a spawn over the cap evicts the oldest chunk already AT REST,
// and with none at rest it REFUSES (null) and the caller demotes the break-off to a particle burst (Control's rule). Landing is heard: the first hard touch
// plays its knock and files a 'prop' hearing event at the chunk's level (a tile 0.4, a monitor 0.5, clutter 0.25) blamed on WHOEVER CAUSED IT (Chunk.who: the
// shooter whose round knocked it off / dropped the tile, the thrower of the charge that shoved it — so a guard's own burst is his side's clumsiness to the men
// and no row on Sam's debrief, Sam's is heard and chronicled as his; NOBODY_ID when no one did: unexplained to the men, nobody's in the debrief). Deterministic: no Math.random — every wobble is hashed off the chunk's serial. Cleared by a restart / the tour's cuts with the rest of the aftermath.
import { Vec3, v3, quat, Quat } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import type { Game } from './game';
import type { Prop } from './props';
import { impulseKick, type ImpulseLike, type ImpulseResponse } from './sheetModel';
import { NOBODY_ID } from './consts';

export type ChunkKind = 'tile' | 'housing' | 'clutter' | 'binder' | 'chunk' | 'shard';   // (shard: a fallen cell of a glass pane — game/glassbreak.ts)
export interface Chunk {
  kind: ChunkKind; box: Box; v: Vec3; w: Vec3;
  /** at rest (asleep); seconds spent nearly still (toward sleep); age; whether its first hard landing has sounded */
  rest: boolean; stillT: number; age: number; sounded: boolean;
  /** hearing level of its landing ('prop' event) and the knock it plays */
  level: number; sfx: { name: string; rate: number; gain: number }[];
  serial: number;
  /** who is blamed for its landing (the character id whose round / charge set it going; NOBODY_ID = no one) */
  who: number;
  /** the prop it came to rest on (drops again once that prop moves) and that prop's pose key then */
  on: Prop | null; onPose: number;
}
const G = 9.81;
const SLEEP_V = 0.22, SLEEP_W = 1.2, SLEEP_T = 0.25;
/** the chunks' IMPULSE response (destruction.ts hands the pool the same records the GPU particles get: a charge wakes and shoves the mug it knocked off a minute ago):
 *  a rigid thing is heavy next to a leaf — a third of a sheet's push, a modest hop, capped at a brisk 3 m/s; a tenth of a metre a second wakes it (a round landing a
 *  foot off rocks it — under that it would not be seen to move); TUMBLE = rad/s of hashed spin per m/s of kick ÷ its size */
export const DEBRIS_IMP: ImpulseResponse & { TUMBLE: number } = { gain: 0.35, upK: 0.7, vMax: 3.0, wake: 0.1, TUMBLE: 0.5 };
/** hearing level + knock per kind */
const LANDING: Record<ChunkKind, { level: number; sfx: { name: string; rate: number; gain: number }[] }> = {
  tile:    { level: 0.4,  sfx: [{ name: 'propThud', rate: 0.75, gain: 0.9 }, { name: 'magDrop', rate: 0.5, gain: 0.35 }] },
  housing: { level: 0.5,  sfx: [{ name: 'propThud', rate: 0.6, gain: 1.0 }, { name: 'lightBreak', rate: 0.8, gain: 0.45 }] },
  clutter: { level: 0.25, sfx: [{ name: 'propThud', rate: 1.45, gain: 0.5 }] },
  binder:  { level: 0.25, sfx: [{ name: 'propThud', rate: 1.1, gain: 0.55 }] },
  chunk:   { level: 0.2,  sfx: [{ name: 'propThud', rate: 1.3, gain: 0.4 }] },
  shard:   { level: 0.3,  sfx: [{ name: 'glassCrack', rate: 1.9, gain: 0.3 }, { name: 'casingTink', rate: 0.6, gain: 0.35 }] },   // a piece of pane landing: a bright tinkle
};

/** 0‥1 off an integer (a hash, not a die) */
export function hash01(x: number): number { x = Math.imul(x ^ 0x9E3779B9, 0x85EBCA6B) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35) >>> 0; x ^= x >>> 16; return (x >>> 8) / 16777216; }

export class Debris {
  list: Chunk[] = [];
  private serial = 1; private frame = 0;
  /** running totals for the panel / QA: spawned, refused at the cap (demoted by the caller), evicted at rest, landings heard */
  stats = { spawned: 0, refused: 0, evicted: 0, landed: 0, peakLive: 0, peakMoving: 0, kicked: 0 };
  constructor(private g: Game) {}

  /** the pool's size on this tier (ui/quality.ts Caps.debris → settings.debrisCap; 64 without one) */
  cap(): number { const c = (this.g.engine.settings as { debrisCap?: number }).debrisCap; return Math.max(4, Math.floor(c ?? 64)); }
  get moving(): number { let n = 0; for (const c of this.list) if (!c.rest) n++; return n; }

  /** A chunk of `kind` = the box `box` (taken over as is: centre, half extents, yaw / rot, albedo) thrown at `v` (m/s) turning at `w` (rad/s), its landing blamed on
   *  `who`. null when the pool is full of chunks still moving — the caller demotes it to particles. */
  spawn(kind: ChunkKind, box: Box, v: Vec3, w: Vec3, who: number = NOBODY_ID): Chunk | null {
    while (this.list.length >= this.cap()) {   // (while: the cap can drop mid-run — the auto ladder hopping a preset — and the pool must come back under it, not hover one over)
      const i = this.list.findIndex(c => c.rest);
      if (i < 0) { this.stats.refused++; return null; }
      this.list.splice(i, 1); this.stats.evicted++;
    }
    const serial = this.serial++;
    const b = makeBox({ c: v3.copy(box.c), h: v3.copy(box.h), yaw: box.yaw, rot: box.rot ? [box.rot[0], box.rot[1], box.rot[2], box.rot[3]] : quat.yaw(box.yaw), albedo: v3.copy(box.albedo), flags: BoxFlag.Dynamic, name: 'debris', mkey: MKEY.debris + (serial & 65535) });
    const L = LANDING[kind];
    const c: Chunk = { kind, box: b, v: v3.copy(v), w: v3.copy(w), rest: false, stillT: 0, age: 0, sounded: false, level: L.level, sfx: L.sfx, serial, who, on: null, onPose: 0 };
    this.list.push(c); this.stats.spawned++;
    return c;
  }
  clear() { this.list.length = 0; this.impulses = 0; }   // (+ the impulses' hash stream; `serial` runs on so motion keys stay unique across restarts — a restarted encounter's wobbles differ by it, two fresh games agree)
  boxes(out: Box[]) { for (const c of this.list) out.push(c.box); }
  /** An IMPULSE over the pool (the same record the GPU particles get, game/sheetModel.ts impulseKick: strength × DEBRIS_IMP.gain × (1 − d/r) along radial + up +
   *  bias): every chunk within reach kicked at least DEBRIS_IMP.wake is woken if it rests, shoved, capped at vMax and set turning by a hashed wobble ∝ the kick ÷ its
   *  size; `blocked(p)` (the caller's line-of-sight test, or none) leaves a chunk behind a partition alone; `who` (when given) takes the blame for its next landing.
   *  Returns how many it moved. Deterministic (hash01 off the chunk's serial and the pool's impulse count). */
  impulse(imp: ImpulseLike, blocked?: (p: Vec3) => boolean, who?: number): number {
    if (!this.list.length) return 0;
    let n = 0; const k = ++this.impulses;
    for (const c of this.list) {
      if (c.age <= 0) continue;   // knocked off this very frame BY the event whose impulse this is: it already has its shove (the velocity policy's), not a second one
      const kick = impulseKick(imp, c.box.c, DEBRIS_IMP); if (!kick || kick.s < DEBRIS_IMP.wake) continue;
      if (blocked && v3.dist(c.box.c, imp.pos) > 0.5 && blocked(c.box.c)) continue;
      if (c.rest) { c.rest = false; c.on = null; c.stillT = 0; }
      let v = v3.add(c.v, kick.dv); const sp = v3.len(v); if (sp > DEBRIS_IMP.vMax) v = v3.scale(v, DEBRIS_IMP.vMax / sp); c.v = v;
      const h = (j: number) => hash01(c.serial * 977 + k * 131 + j) - 0.5;
      const tw = DEBRIS_IMP.TUMBLE * kick.s / Math.max(0.08, boundR(c.box));
      c.w = v3.add(c.w, [h(1) * tw, h(2) * tw * 0.5, h(3) * tw]);
      c.sounded = false; if (who !== undefined) c.who = who;   // (thrown again: its next hard landing is a fresh knock to hear, on whoever threw the charge)
      n++;
    }
    this.stats.kicked += n;
    return n;
  }
  /** impulses applied so far (hash stream) */
  private impulses = 0;

  update(dt: number) {
    if (!this.list.length) return;
    this.frame++;
    let moving = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i]; c.age += dt;
      if (c.rest) {   // resting: on furniture it drops again once that piece has moved out from under it (a chair shoved from beneath the mug on it); on a static, a staggered down-ray now and
                      // then catches the static going away under it (a stack it landed on scattered later, a housing it sits on knocked off) — the GPU chips' every-16th-frame rule
        if (c.on) { if (poseKey(c.on) !== c.onPose) { const under = this.g.props.raycast([c.box.c[0], c.box.c[1] + 0.02, c.box.c[2]], [0, -1, 0], supportAlong(c.box, [0, 1, 0]) + 0.12); if (under && under.prop === c.on) c.onPose = poseKey(c.on); else { c.rest = false; c.on = null; c.stillT = 0; } } }
        else if (((this.frame + c.serial) & 31) === 0) { const sup = supportAlong(c.box, [0, 1, 0]); if (c.box.c[1] > sup + 0.02 && !this.g.col.raycast([c.box.c[0], c.box.c[1] + 0.02, c.box.c[2]], [0, -1, 0], sup + 0.08)) { c.rest = false; c.stillT = 0; } }
        continue;
      }
      moving++;
      const sub = 2, h = dt / sub;
      for (let s = 0; s < sub && !c.rest; s++) this.step(c, h);
      if (c.box.c[1] < -1 || c.age > 600) { this.list.splice(i, 1); }   // fell out of the world (should not happen) / ten minutes of lying there: quietly retired
    }
    this.stats.peakLive = Math.max(this.stats.peakLive, this.list.length); this.stats.peakMoving = Math.max(this.stats.peakMoving, moving);
  }

  private step(c: Chunk, h: number) {
    const g = this.g; const b = c.box;
    c.v[1] -= G * h;
    // turn
    const wl = v3.len(c.w);
    if (wl > 1e-5) { const a = wl * h; const s = Math.sin(a / 2) / wl; c.box.rot = quat.normalize(quat.mul([c.w[0] * s, c.w[1] * s, c.w[2] * s, Math.cos(a / 2)], b.rot ?? quat.yaw(b.yaw))); }
    // move with a swept contact: the centre ray, met `support` short of the surface (the box's extent along the hit normal in its current attitude)
    const move = v3.scale(c.v, h); const len = v3.len(move);
    if (len < 1e-7) { this.settleTick(c, h, null); return; }
    const dir = v3.scale(move, 1 / len);
    const reach = len + boundR(b) * 1.05;
    const st = g.col.raycast(b.c, dir, reach); const ph = g.props.raycast(b.c, dir, st ? st.t : reach);
    const hit = ph ? { t: ph.t, n: ph.n, prop: ph.prop as Prop | null } : st ? { t: st.t, n: st.n, prop: null } : null;
    let landed = false;
    if (hit) {
      const back = supportAlong(b, hit.n) / Math.max(0.35, -v3.dot(dir, hit.n));
      if (hit.t - back <= len) {
        const tHit = Math.max(0, hit.t - back);
        b.c[0] += dir[0] * tHit; b.c[1] += dir[1] * tHit; b.c[2] += dir[2] * tHit;
        const n = hit.n; const vn = v3.dot(c.v, n);
        if (vn < 0) {
          const speed = -vn;
          if (hit.prop) g.props.applyImpulse(hit.prop, b.c, v3.scale(n, vn * 0.4 * massOf(b)), 0);   // what it lands on feels it (a housing tips a chair a little)
          const vN = v3.scale(n, vn); const vT = v3.sub(c.v, vN);
          c.v = v3.add(v3.scale(vT, n[1] > 0.6 ? 0.55 : 0.8), v3.scale(vN, -0.22));   // dead bounces; rubs along a floor, slides down a wall
          // a floor touch turns it toward lying on the face nearest down, and trades some of the knock into a wobble about the contact
          if (n[1] > 0.6) { layFlat(b, n, 0.45); const kick = v3.cross(n, vT); c.w = v3.add(v3.scale(c.w, 0.45), v3.scale(kick, 2.0 / Math.max(0.08, boundR(b)))); }
          else c.w = v3.scale(c.w, 0.7);
          if (!c.sounded && speed > 1.0) this.land(c, speed);
          landed = n[1] > 0.6;
          if (landed && Math.abs(v3.dot(c.v, n)) < 0.5 && v3.len(c.v) < SLEEP_V * 2) { c.v = v3.scale(c.v, 0.5); c.w = v3.scale(c.w, 0.5); }
          if (landed && v3.len(c.v) < SLEEP_V && v3.len(c.w) < SLEEP_W) { this.sleep(c, n, hit.prop); return; }
        }
        b.c[0] += n[0] * 0.002; b.c[1] += n[1] * 0.002; b.c[2] += n[2] * 0.002;
      } else { b.c[0] += move[0]; b.c[1] += move[1]; b.c[2] += move[2]; }
    } else { b.c[0] += move[0]; b.c[1] += move[1]; b.c[2] += move[2]; }
    // the world's floor as a last resort (a chunk born a hair inside the slab would otherwise fall through it)
    const sup = supportAlong(b, [0, 1, 0]);
    if (b.c[1] < sup) { b.c[1] = sup + 0.001; if (c.v[1] < 0) { const sp = -c.v[1]; c.v[1] *= -0.2; c.v[0] *= 0.6; c.v[2] *= 0.6; layFlat(b, [0, 1, 0], 0.5); c.w = v3.scale(c.w, 0.5); if (!c.sounded && sp > 1) this.land(c, sp); } if (v3.len(c.v) < SLEEP_V && v3.len(c.w) < SLEEP_W) { this.sleep(c, [0, 1, 0], null); return; } }
    this.settleTick(c, h, landed ? [0, 1, 0] : null);
  }
  /** nearly still for SLEEP_T while touching a floor → asleep (catches the chunk that rocks on an edge under the speed test) */
  private settleTick(c: Chunk, h: number, floorN: Vec3 | null) {
    if (floorN && v3.len(c.v) < SLEEP_V * 1.6 && v3.len(c.w) < SLEEP_W * 1.6) { c.stillT += h; if (c.stillT > SLEEP_T) this.sleep(c, floorN, null); } else c.stillT = Math.max(0, c.stillT - h);
  }
  private sleep(c: Chunk, n: Vec3, on: Prop | null) {
    if (faceTilt(c.box, n) > 0.35) { layFlat(c.box, n, 0.45); c.stillT = 0; return; }   // (still ~20°+ off the face it will lie on: another settling turn instead of an 80° snap in one frame — it sleeps a few frames later)
    layFlat(c.box, n, 1); c.rest = true; c.v = [0, 0, 0]; c.w = [0, 0, 0]; c.on = on; c.onPose = on ? poseKey(on) : 0;
    // sit exactly on the surface under it (the swept contact leaves it a few millimetres proud or shy)
    const sup = supportAlong(c.box, [0, 1, 0]);
    const from: Vec3 = [c.box.c[0], c.box.c[1] + 0.05, c.box.c[2]];
    const st = this.g.col.raycast(from, [0, -1, 0], sup + 0.4); const ph = this.g.props.raycast(from, [0, -1, 0], st ? st.t : sup + 0.4);
    const t = ph ? ph.t : st ? st.t : null;
    if (t !== null) c.box.c[1] = from[1] - t + sup + 0.0015;
    if (ph) { c.on = ph.prop; c.onPose = poseKey(ph.prop); }
  }
  private land(c: Chunk, speed: number) {
    c.sounded = true; this.stats.landed++;
    const g = this.g; const p = v3.copy(c.box.c);
    for (const s of c.sfx) g.audio.play(s.name as 'propThud', p, Math.min(1, s.gain * (0.6 + speed * 0.15)), { rate: s.rate * (0.94 + 0.12 * hash01(c.serial * 31)) });
    g.events.push({ kind: 'prop', pos: p, time: g.time, loud: false, level: c.level, who: c.who });   // blamed on whoever set it going: Sam's is heard and chronicled as his, a guard's own is his side's clumsiness (hearingCheck: who ≥ 10), NOBODY_ID unexplained — a calm man goes to look
  }
  /** panel / QA line */
  summary(): string { const s = this.stats; return `debris ${this.list.length}/${this.cap()} (${this.moving} moving) · spawned ${s.spawned} · refused ${s.refused} · evicted ${s.evicted} · landings ${s.landed} · peak ${s.peakLive}/${s.peakMoving} moving`; }
}

/** the box's half extent along world direction n in its current attitude (the support function of an oriented box) */
export function supportAlong(b: Box, n: Vec3): number {
  const r = b.rot ?? quat.yaw(b.yaw);
  const ax = quat.rotate(r, [1, 0, 0]), ay = quat.rotate(r, [0, 1, 0]), az = quat.rotate(r, [0, 0, 1]);
  return Math.abs(v3.dot(ax, n)) * b.h[0] + Math.abs(v3.dot(ay, n)) * b.h[1] + Math.abs(v3.dot(az, n)) * b.h[2];
}
function boundR(b: Box): number { return Math.hypot(b.h[0], b.h[1], b.h[2]); }
/** a nominal mass off the volume (600 kg/m³, clamped) — only for how hard it nudges the furniture it lands on */
function massOf(b: Box): number { return Math.min(6, Math.max(0.1, b.h[0] * b.h[1] * b.h[2] * 8 * 600)); }
/** Turn box b by fraction k of the way toward lying with its nearest face on a surface of normal n (k = 1: exactly flat). Keeps `yaw` as the heading. */
/** radians between n and the box axis layFlat would settle onto it (the same per-extent choice) */
export function faceTilt(b: Box, n: Vec3): number {
  const q = b.rot ?? quat.yaw(b.yaw); const axes: Vec3[] = [quat.rotate(q, [1, 0, 0]), quat.rotate(q, [0, 1, 0]), quat.rotate(q, [0, 0, 1])];
  let bi = 0, bd = -1; for (let i = 0; i < 3; i++) { const d = Math.abs(v3.dot(axes[i], n)) / Math.max(0.01, b.h[i]); if (d > bd) { bd = d; bi = i; } }
  return Math.acos(Math.min(1, Math.abs(v3.dot(axes[bi], n))));
}
export function layFlat(b: Box, n: Vec3, k: number) {
  const r: Quat = b.rot ?? quat.yaw(b.yaw);
  const axes: Vec3[] = [quat.rotate(r, [1, 0, 0]), quat.rotate(r, [0, 1, 0]), quat.rotate(r, [0, 0, 1])];
  // the face to land on: the axis most aligned with n, judged PER UNIT OF EXTENT — a slab always ends on its face and a binder on its side unless it arrives all
  // but exactly on edge (the plain 'most aligned' choice stood every tile that came in tilted past 45° on its 1.5 cm edge and froze it there — review #1)
  let bi = 0, bd = -1; for (let i = 0; i < 3; i++) { const d = Math.abs(v3.dot(axes[i], n)) / Math.max(0.01, b.h[i]); if (d > bd) { bd = d; bi = i; } }
  let a = axes[bi]; if (v3.dot(a, n) < 0) a = v3.scale(a, -1);
  // shortest arc a → n, scaled by k
  const cr = v3.cross(a, n); const sl = v3.len(cr); const cs = Math.max(-1, Math.min(1, v3.dot(a, n)));
  if (sl < 1e-6) { if (k >= 1) b.rot = quat.normalize(r); return; }
  const ang = Math.atan2(sl, cs) * Math.max(0, Math.min(1, k));
  const axis = v3.scale(cr, 1 / sl);
  const s2 = Math.sin(ang / 2); const q: Quat = [axis[0] * s2, axis[1] * s2, axis[2] * s2, Math.cos(ang / 2)];
  b.rot = quat.normalize(quat.mul(q, r));
  const f = quat.rotate(b.rot, [0, 0, 1]); if (Math.hypot(f[0], f[2]) > 1e-3) b.yaw = Math.atan2(f[0], f[2]);   // (heading of local +Z, the level's yaw convention)
}
const poseKey = (p: Prop) => p.x * 7919 + p.z * 104729 + p.yaw;
