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
import type { PlateMeta } from './shards';
import type { BreakMeta } from './breakTable';

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
  /** GLASS only (game/shards.ts — absent on every other chunk, and on a shard while that model is off): what the plate is, and its own contact numbers (the share of
   *  its slide kept on a floor / a wall touch, the share of its normal speed it comes back with) in place of the pool's 0.55 / 0.8 / 0.22 */
  glass?: PlateMeta; contact?: { keepFloor: number; keepWall: number; rest: number };
  /** CUT PIECES only (game/breakTable.ts — absent while the cut switch is off): the material row it reads and whether it has broken once already */
  mat?: BreakMeta;
  /** CUT PIECES only: a second drawn box riding this chunk's pose (the other half of a kinked metal panel: same box, its own cut record). One pool slot. */
  mate?: Box;
  /** KICKED RUBBLE only (Debris.feet below — never set while RUBBLE.on is off): set going by a BOOT, not thrown — until it sleeps again (or a blast takes it) it SLIDES
   *  on its floor (slide(), not step()): no landing, so no knock and no hearing event, it pushes no prop it meets, breaks no further, and its slot can still be
   *  taken; `footAt` = its age at the last shove, `footN` = shoves in a row (a piece a man keeps pressing into a wall is let be for a while), `footSide` = the side
   *  of his line his last kick sent it to */
  foot?: boolean; footAt?: number; footN?: number; footSide?: number;
  /** m: a loose piece's own height over the floor it is seated on (edgeLook.ts's fragments: no two overlapping flakes laid flat with their tops in one plane); a pool piece has none */
  lift?: number;
}
/** the feet's books for one list of pieces: shoves made (its hash stream) and the counts. The pool keeps its own; a caller with a list of its own (edgeLook.ts)
 *  keeps its own too, so what the pool's pieces draw never depends on a picture-only list having been kicked first */
export interface FootBook { shoves: number; stats: { kicked: number; offMan: number; walled: number; gaveUp: number } }
/** what Debris.feet reads of a man: where his feet are and how he is moving (a Character is one) */
export interface FootMan { pos: Vec3; vel: Vec3 }
/** KICKED RUBBLE's numbers (the table is game/destructionSwitch.ts RUBBLE — no game import there; this is its shape) */
export interface FootKnobs { radius: number; reach: number; lead: number; slide: number; inside: number; floor: number; heavy: number; walk: number; base: number; gain: number; aside: number; vMax: number; off: number; spin: number; perFrame: number; cooldown: number; giveUp: number; giveUpSecs: number; scuff: number }
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
  get moving(): number { let n = 0; for (const c of this.list) if (!c.rest && !c.foot) n++; return n; }   // (thrown and not yet down: a piece a boot slid is not part of the mayhem)

  /** A chunk of `kind` = the box `box` (taken over as is: centre, half extents, yaw / rot, albedo) thrown at `v` (m/s) turning at `w` (rad/s), its landing blamed on
   *  `who`. null when the pool is full of chunks still moving — the caller demotes it to particles. */
  spawn(kind: ChunkKind, box: Box, v: Vec3, w: Vec3, who: number = NOBODY_ID): Chunk | null {
    if (kind === 'shard' && this.glass) { const r = this.glass.take(box, v, w, who); if (r !== undefined) return r; }   // glass after it lets go is game/shards.ts's (undefined = not live: as it always was)
    return this.spawnRaw(kind, box, v, w, who);
  }
  /** GLASS HOOKS (game/shards.ts sets them; null = this pool exactly as it was): `take` is offered every 'shard' spawn first (a Chunk / null = it placed the fragment
   *  itself, undefined = not its business), `landed` a glass plate's first hard touch (true = it made the sound and filed the hearing event), `rested` a glass plate
   *  going to sleep, `gone` (optional) a glass plate the POOL has just dropped — evicted at rest to make room, or retired by age. Only chunks carrying `glass` reach the last three. */
  glass: { take(box: Box, v: Vec3, w: Vec3, who: number): Chunk | null | undefined; landed(c: Chunk, speed: number): boolean; rested(c: Chunk): void; gone?(c: Chunk): void } | null = null;
  /** THE BREAK TABLE'S HOOKS (game/breakTable.ts sets them; each is nothing while the cut switch is off — null or off = this pool exactly as it was): every chunk
   *  born, a piece's first hard touch, an impulse's kick on a piece, a resting piece evicted for its slot (the ONE crumble-on-evict rule: glass plates included). */
  breaks: { born(c: Chunk): void; landed(c: Chunk, speed: number): void; kicked(c: Chunk, kick: number): void; evicted(c: Chunk): void;
    /** (optional) WHICH piece gives up its slot, among those `ok` allows: an index into the list, −1 = none. Absent = the oldest, as ever. */
    pick?(list: readonly Chunk[], ok: (c: Chunk) => boolean): number } | null = null;
  /** spawn() without the glass door (what spawn() always did; shards.ts places its plates through this) */
  spawnRaw(kind: ChunkKind, box: Box, v: Vec3, w: Vec3, who: number = NOBODY_ID): Chunk | null {
    while (this.list.length >= this.cap()) {   // (while: the cap can drop mid-run — the auto ladder hopping a preset — and the pool must come back under it, not hover one over)
      const i = this.breaks?.pick ? this.breaks.pick(this.list, evictable) : this.list.findIndex(evictable);
      if (i < 0) { this.stats.refused++; return null; }
      const gone = this.list.splice(i, 1)[0]; this.stats.evicted++; this.breaks?.evicted(gone);
    }
    const serial = this.serial++;
    const b = makeBox({ c: v3.copy(box.c), h: v3.copy(box.h), yaw: box.yaw, rot: box.rot ? [box.rot[0], box.rot[1], box.rot[2], box.rot[3]] : quat.yaw(box.yaw), albedo: v3.copy(box.albedo), flags: BoxFlag.Dynamic, name: 'debris', mkey: MKEY.debris + (serial & 65535) });
    const L = LANDING[kind];
    const c: Chunk = { kind, box: b, v: v3.copy(v), w: v3.copy(w), rest: false, stillT: 0, age: 0, sounded: false, level: L.level, sfx: L.sfx, serial, who, on: null, onPose: 0 };
    this.list.push(c); this.stats.spawned++; this.breaks?.born(c);
    return c;
  }
  clear() { this.list.length = 0; this.impulses = 0; this.serial0 = this.serial; this.shoves = 0; this.scuffAt = -1; this.feetStats = { kicked: 0, offMan: 0, walled: 0, gaveUp: 0 }; } serial0 = 1;   // (+ the impulses' hash stream and the feet's; `serial` runs on so motion keys stay unique across restarts — a restarted encounter's wobbles differ by it, two fresh games agree; `serial0` = the serial at the last clear, read by game/breakTable.ts alone)
  boxes(out: Box[]) { for (const c of this.list) { out.push(c.box); const m = c.mate; if (m) { m.c = c.box.c; m.yaw = c.box.yaw; m.rot = c.box.rot; out.push(m); } } }
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
      if (c.foot) c.foot = false;   // (a blast has it now: thrown, heard and breakable like any other)
      let v = v3.add(c.v, kick.dv); const sp = v3.len(v); if (sp > DEBRIS_IMP.vMax) v = v3.scale(v, DEBRIS_IMP.vMax / sp); c.v = v;
      const h = (j: number) => hash01(c.serial * 977 + k * 131 + j) - 0.5;
      const tw = DEBRIS_IMP.TUMBLE * kick.s / Math.max(0.08, boundR(c.box));
      c.w = v3.add(c.w, [h(1) * tw, h(2) * tw * 0.5, h(3) * tw]);
      c.sounded = false; if (who !== undefined) c.who = who; this.breaks?.kicked(c, kick.s);   // (thrown again: its next hard landing is a fresh knock to hear, on whoever threw the charge)
      n++;
    }
    this.stats.kicked += n;
    return n;
  }
  /** impulses applied so far (hash stream) */
  private impulses = 0;

  /** FEET (the kicked-rubble goal; game/destruction.ts calls it once a frame while RUBBLE.on — off, it is never called and the pool is exactly as it was). Two rules,
   *  over pieces AT REST (or still sliding from a boot) and the living men on their feet:
   *    · a piece lying on the floor he walks on, within a boot's `reach` of a man WALKING AT IT, is shoved on ahead and ASIDE of him: a slide along the floor, harder
   *      the faster he goes and the lighter it is, turned about its middle when the boot catches an end;
   *    · a piece that came to rest OVERLAPPING a man (a plank through his shins, a slab he stands in) is pushed off him by its nearest way out, moving or not
   *      (in several men: by the sum of their ways out).
   *  Left alone: a piece on furniture or on any floor but his own (a desk top, a counter: `floor`), one heavier than a boot shifts (`heavy`), a glass plate.
   *  A shove is not a throw: it goes round impulse() altogether — the piece keeps its `sounded` and its `who`, the break table is not told (nothing snaps
   *  underfoot), and while `foot` is up it slides on its floor (slide()): it never lands, so no knock, no 'prop' hearing event, no furniture pushed — walking through rubble brings nobody.
   *  It stays evictable and out of `moving`, so a blast's new pieces find their slots and the mayhem rule reads what it read. Bounded: `perFrame` shoves, a
   *  `cooldown` per piece, and a piece shoved `giveUp` times running (pinned against a wall by a man who will not move) is let be for `giveUpSecs`.
   *  Deterministic: hashed off the pool's own shove count (zeroed in clear()) — never the impulses' stream, never Math.random. Returns the shoves made.
   *  Another list than the pool's comes with ITS `book` (FootBook): its shoves hash off its own count and are counted there, the pool's stream untouched. */
  feet(men: readonly FootMan[], K: FootKnobs, list: readonly Chunk[] = this.list, book?: FootBook): number {
    if (!list.length || !men.length) return 0;
    const g = this.g; let n = 0; this.footMu = K.slide; const S = book ? book.stats : this.feetStats;
    for (const c of list) {
      if (n >= K.perFrame) break;
      if (!(c.rest || c.foot) || c.age <= 0 || c.on || c.glass) continue;   // (in the air from a blast: not a boot's business; on furniture: nobody walks there; a glass plate: its litter lies where it first rested — shards.ts)
      const since = c.footAt === undefined ? Infinity : c.age - c.footAt;
      if (since < ((c.footN ?? 0) >= K.giveUp ? K.giveUpSecs : K.cooldown)) continue;
      const b = c.box; const mass = b.h[0] * b.h[1] * b.h[2] * 8 * 600; if (mass > K.heavy) continue;   // (more than a boot shifts — a cabinet on its side, a desk top: he walks through it, as before)
      const far = boundR(b) + K.radius + K.reach + 0.05;   // (nobody near it: nothing to work out — the common case, for all but a few pieces)
      let near = false; for (const m of men) { const d = far + Math.hypot(m.vel[0], m.vel[2]) * K.lead; if (Math.abs(m.pos[0] - b.c[0]) < d && Math.abs(m.pos[2] - b.c[2]) < d) { near = true; break; } }
      if (!near) continue;
      // its footprint on the floor: a rectangle along its most level long axis (a resting piece lies flat; a dealt heap slab is tipped a little — the bound of it)
      const q = b.rot ?? quat.yaw(b.yaw);
      const A: Vec3[] = [quat.rotate(q, [1, 0, 0]), quat.rotate(q, [0, 1, 0]), quat.rotate(q, [0, 0, 1])];
      let iu = 0; for (let i = 1; i < 3; i++) if (Math.abs(A[i][1]) > Math.abs(A[iu][1])) iu = i;
      const i1 = (iu + 1) % 3, i2 = (iu + 2) % 3; const il = b.h[i1] >= b.h[i2] ? i1 : i2;
      let d1x = A[il][0], d1z = A[il][2]; const dl = Math.hypot(d1x, d1z); if (dl < 1e-4) { d1x = 1; d1z = 0; } else { d1x /= dl; d1z /= dl; }
      const d2x = -d1z, d2z = d1x;
      let e1 = 0, e2 = 0, hy = 0; for (let i = 0; i < 3; i++) { e1 += Math.abs(A[i][0] * d1x + A[i][2] * d1z) * b.h[i]; e2 += Math.abs(A[i][0] * d2x + A[i][2] * d2z) * b.h[i]; hy += Math.abs(A[i][1]) * b.h[i]; }
      const bottom = b.c[1] - hy, top = b.c[1] + hy;
      // the men it lies IN (every one of them: it goes out by their sum, so two men do not pass it back and forth) — or, in nobody, the walking man whose leading
      // foot (his place a beat on) it is most in the way of. Only men standing on ITS floor: a piece on a desk top beside him, or a storey down, is not at his feet
      let ox = 0, oz = 0, inN = 0; let best: { gap: number; dx: number; dz: number; lx: number; lz: number; m: FootMan; sp: number } | null = null;
      for (const m of men) {
        const fy = m.pos[1]; if (bottom > fy + K.floor || top < fy + 0.01) continue;
        const here = this.footGap(b, m.pos[0], m.pos[2], d1x, d1z, e1, e2, K.radius);
        if (here.gap < -K.inside) { ox -= here.dx * here.gap; oz -= here.dz * here.gap; inN++; continue; }
        const sp = Math.hypot(m.vel[0], m.vel[2]); if (inN || sp <= K.walk) continue;
        const hit = this.footGap(b, m.pos[0] + m.vel[0] * K.lead, m.pos[2] + m.vel[2] * K.lead, d1x, d1z, e1, e2, K.radius);
        if (hit.gap >= K.reach || (m.vel[0] * hit.dx + m.vel[2] * hit.dz) <= 0.2 * sp) continue;
        if (!best || hit.gap < best.gap) best = { ...hit, m, sp };
      }
      if (!inN && !best) continue;
      const k = book ? ++book.shoves : ++this.shoves; const h = (j: number) => hash01(k * 149 + j);   // (the pool's own shove count, zeroed with the pool: a restarted encounter draws what a fresh one does)
      c.footAt = c.age; c.footN = since > 2 ? 1 : (c.footN ?? 0) + 1;
      if (c.footN === K.giveUp) S.gaveUp++;
      const heft = 1 / (1 + mass / 4);
      let dx: number, dz: number, s: number, lx = 0, lz = 0;
      if (inN) {
        const ol = Math.hypot(ox, oz); if (ol < 0.02) { S.walled++; continue; }   // (held between men pushing it opposite ways: it stays — the try counts)
        dx = ox / ol; dz = oz / ol; s = K.off * (0.6 + 0.4 * heft);
      } else {
        // ahead of him and aside: off his line to the side it already lies on (hashed when it lies dead ahead), so he does not dribble it down the corridor
        const B = best!; const vx = B.m.vel[0] / B.sp, vz = B.m.vel[2] / B.sp; const toward = vx * B.dx + vz * B.dz;
        const cr = vx * (b.c[2] - B.m.pos[2]) - vz * (b.c[0] - B.m.pos[0]);
        const side = since <= 2 && c.footSide ? c.footSide : Math.abs(cr) > 0.03 ? Math.sign(cr) : h(4) < 0.5 ? -1 : 1; c.footSide = side;   // (and the same side as his last kick at it: two kicks clear it, they do not put it back)
        dx = B.dx - vz * side * K.aside; dz = B.dz + vx * side * K.aside; const dn = Math.hypot(dx, dz); dx /= dn; dz /= dn; lx = B.lx; lz = B.lz;
        s = Math.min(K.vMax, K.base + K.gain * B.sp * Math.max(0.3, toward)) * heft * (0.8 + 0.4 * h(5));
      }
      // not into a wall: along it, or (square on) not at all — the try still counts, so a pinned piece is given up on
      const reach = Math.abs(dx * d1x + dz * d1z) * e1 + Math.abs(dx * d2x + dz * d2z) * e2 + 0.1;
      const wall = g.col.raycast([b.c[0], Math.max(b.c[1], bottom + 0.03), b.c[2]], [dx, 0, dz], reach);
      if (wall) {
        const dn = dx * wall.n[0] + dz * wall.n[2]; let tx = dx - wall.n[0] * dn, tz = dz - wall.n[2] * dn; const tl = Math.hypot(tx, tz);
        if (tl < 0.25) { S.walled++; continue; }
        tx /= tl; tz /= tl; dx = tx; dz = tz; s *= tl;
      }
      if (c.rest) { c.rest = false; c.stillT = 0; }
      c.foot = true;
      c.v = [dx * s, 0, dz * s];
      // a boot on one end turns it about its middle; a touch of its own so two planks do not slide as one
      const wy = Math.max(-5, Math.min(5, K.spin * (lz * dx - lx * dz) * s / Math.max(0.01, e1 * e1 + e2 * e2)));
      c.w = [0, wy + (h(3) - 0.5) * 0.6 * s / Math.max(0.08, boundR(b)), 0];
      if (K.scuff > 0 && c.sfx.length && g.time - this.scuffAt > 0.12) {   // a scuff for the ear only, at a footfall's weight (no hearing event: his steps already carry his noise)
        this.scuffAt = g.time; const f = c.sfx[0];
        g.audio.play(f.name as 'propThud', v3.copy(b.c), Math.min(1, K.scuff * f.gain * (0.6 + 0.6 * s / Math.max(0.1, K.vMax))), { rate: f.rate * (1.15 + 0.2 * h(7)) });
      }
      if (inN) S.offMan++; else S.kicked++;
      n++;
    }
    return n;
  }
  /** A piece OUTSIDE the pool, for the feet alone (game/edgeLook.ts's rubble at rest — picture only, so no pool piece: it has no slot, lands nowhere and no blast
   *  reaches it): a chunk record round ITS box, at rest, that feet(men, K, [records]) shoves and footStep() slides. Never in `list`, never counted, never evicted. */
  loose(box: Box, lift = 0): Chunk { const L = LANDING.chunk; return { kind: 'chunk', box, lift, v: [0, 0, 0], w: [0, 0, 0], rest: true, stillT: 0, age: 0, sounded: true, level: L.level, sfx: L.sfx, serial: 0, who: NOBODY_ID, on: null, onPose: 0 }; }
  /** …and its frame: older by `dt`, and slid on if a boot set it going (the pool's own slide(): the floor it lies on, the walls, the furniture — nothing else) */
  footStep(c: Chunk, dt: number) { c.age += dt; if (c.rest) return; if (!c.foot) { c.rest = true; return; } const sub = 2, h = dt / sub; for (let s = 0; s < sub && !c.rest; s++) this.slide(c, h); }
  /** A man's circle at (px, pz) against a piece's footprint (the rectangle e1 × e2 along (d1x, d1z) about its middle): the gap between them (negative = into
   *  him), the way the piece goes to get clear of him (unit, level) and the point of it nearest him, from its middle (the boot's lever) */
  private footGap(b: Box, px: number, pz: number, d1x: number, d1z: number, e1: number, e2: number, radius: number): { gap: number; dx: number; dz: number; lx: number; lz: number } {
    const d2x = -d1z, d2z = d1x; const rx = px - b.c[0], rz = pz - b.c[2];
    const u = rx * d1x + rz * d1z, v = rx * d2x + rz * d2z;
    const cu = Math.max(-e1, Math.min(e1, u)), cv = Math.max(-e2, Math.min(e2, v));
    if (cu === u && cv === v) {   // his middle stands over it: out by the nearer side, away from him
      const pu = e1 - Math.abs(u), pv = e2 - Math.abs(v);
      if (pu < pv) { const s = u > 0 ? -1 : 1; return { gap: -(pu + radius), dx: d1x * s, dz: d1z * s, lx: 0, lz: 0 }; }
      const s = v > 0 ? -1 : 1; return { gap: -(pv + radius), dx: d2x * s, dz: d2z * s, lx: 0, lz: 0 };
    }
    const ou = u - cu, ov = v - cv; const d = Math.hypot(ou, ov);
    return { gap: d - radius, dx: -(ou * d1x + ov * d2x) / d, dz: -(ou * d1z + ov * d2z) / d, lx: cu * d1x + cv * d2x, lz: cu * d1z + cv * d2z };   // (from him, through the point of it nearest him)
  }
  /** A boot's piece (`foot`) for `h` seconds: a SLIDER on the floor it lay on — level travel, stopped by the walls and the furniture (it pushes neither), rubbed
   *  to a stop by plain friction (`slide` = μ: it goes v² ÷ 2μg), turning about its middle, easing flat as it goes (a heap's tipped slab lies down), seated on the
   *  floor under it; where that floor ends it stops (it is never slid off an edge), and a long piece whose end would turn or travel into a wall it was clear of
   *  takes the step back and stops turning (footIn: its corners). It never leaves the floor, so it never falls, bounces or lands: no knock, no hearing event — silent by construction,
   *  where step()'s contact is the thrown pieces'. */
  private slide(c: Chunk, h: number) {
    const g = this.g, b = c.box; const up: Vec3 = [0, 1, 0];
    const sp = Math.hypot(c.v[0], c.v[2]);
    if (sp < SLEEP_V * 0.25 && Math.abs(c.w[1]) < 0.5) {   // stopped: asleep, laid flat — unless lying down would put a corner of it into a wall it is clear of (a slab tipped against a wall's stump): then it rests as it is
      const clear = !this.footIn(b), r0 = b.rot ? ([b.rot[0], b.rot[1], b.rot[2], b.rot[3]] as typeof b.rot) : undefined, y0 = b.c[1], w0 = b.yaw;
      this.sleep(c, up, null);
      if (clear && this.footIn(b)) { b.rot = r0; b.yaw = w0; b.c[1] = y0; c.rest = true; c.foot = false; c.v = [0, 0, 0]; c.w = [0, 0, 0]; }
      return;
    }
    const c0: Vec3 = [b.c[0], b.c[1], b.c[2]], rot0 = b.rot ? ([b.rot[0], b.rot[1], b.rot[2], b.rot[3]] as typeof b.rot) : undefined, yaw0 = b.yaw; const in0 = this.footIn(b);
    const back = () => { b.c[0] = c0[0]; b.c[1] = c0[1]; b.c[2] = c0[2]; b.rot = rot0; b.yaw = yaw0; };
    if (faceTilt(b, up) > 1e-3) layFlat(b, up, 0.2);
    if (Math.abs(c.w[1]) > 1e-4) { const a = c.w[1] * h; b.rot = quat.normalize(quat.mul([0, Math.sin(a / 2), 0, Math.cos(a / 2)], b.rot ?? quat.yaw(b.yaw))); c.w[1] *= Math.max(0, 1 - 5 * h); }
    const sup = supportAlong(b, up);
    if (sp > 1e-4) {
      const dx = c.v[0] / sp, dz = c.v[2] / sp; const d = sp * h; const ahead = supportAlong(b, [dx, 0, dz]);
      const from: Vec3 = [b.c[0], Math.max(b.c[1], b.c[1] - sup + 0.05), b.c[2]];
      const st = g.col.raycast(from, [dx, 0, dz], d + ahead); const ph = g.props.raycast(from, [dx, 0, dz], st ? st.t : d + ahead); const hit = ph ?? st;
      if (hit) {   // up to it, then along it with what is left of its speed (a dead touch: 0.7 kept, no bounce to speak of)
        const t = Math.max(0, hit.t - ahead); b.c[0] += dx * t; b.c[2] += dz * t;
        const vn = c.v[0] * hit.n[0] + c.v[2] * hit.n[2]; if (vn < 0) { c.v[0] = (c.v[0] - hit.n[0] * vn * 1.1) * 0.7; c.v[2] = (c.v[2] - hit.n[2] * vn * 1.1) * 0.7; }
      } else { b.c[0] += dx * d; b.c[2] += dz * d; }
    }
    const top: Vec3 = [b.c[0], c0[1] + 0.05, b.c[2]]; const fl = g.col.raycast(top, [0, -1, 0], 0.05 + sup + 0.3);
    if (!fl) { back(); c.v = [0, 0, 0]; c.w = [0, 0, 0]; return; }   // the floor ends here: it stops where it was
    b.c[1] = top[1] - fl.t + sup + 0.0015 + (c.lift ?? 0);
    if (!in0 && this.footIn(b)) { back(); c.w[1] = 0; c.v[0] *= 0.5; c.v[2] *= 0.5; }
    const s2 = Math.hypot(c.v[0], c.v[2]); const keep = s2 < 1e-4 ? 0 : Math.max(0, 1 - this.footMu * G * h / s2); c.v = [c.v[0] * keep, 0, c.v[2] * keep];
  }
  /** does a piece's footprint (the level rectangle of it, as feet() takes it) reach into a static? Level rays from its middle to the rectangle's four corners:
   *  a wall's face that cuts into a rectangle cuts off a corner of it. (A piece smaller than 6 cm is its middle's business alone.) */
  private footIn(b: Box): boolean {
    const q = b.rot ?? quat.yaw(b.yaw); const A: Vec3[] = [quat.rotate(q, [1, 0, 0]), quat.rotate(q, [0, 1, 0]), quat.rotate(q, [0, 0, 1])];
    let iu = 0; for (let i = 1; i < 3; i++) if (Math.abs(A[i][1]) > Math.abs(A[iu][1])) iu = i;
    const i1 = (iu + 1) % 3, i2 = (iu + 2) % 3; const il = b.h[i1] >= b.h[i2] ? i1 : i2;
    let d1x = A[il][0], d1z = A[il][2]; const dl = Math.hypot(d1x, d1z); if (dl < 1e-4) { d1x = 1; d1z = 0; } else { d1x /= dl; d1z /= dl; }
    let e1 = 0, e2 = 0, hy = 0; for (let i = 0; i < 3; i++) { e1 += Math.abs(A[i][0] * d1x + A[i][2] * d1z) * b.h[i]; e2 += Math.abs(-A[i][0] * d1z + A[i][2] * d1x) * b.h[i]; hy += Math.abs(A[i][1]) * b.h[i]; }
    const L = Math.hypot(e1, e2); if (L < 0.06) return false;
    const o: Vec3 = [b.c[0], Math.max(b.c[1], b.c[1] - hy + 0.03), b.c[2]];
    for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = (d1x * e1 * su - d1z * e2 * sv) / L, z = (d1z * e1 * su + d1x * e2 * sv) / L; if (this.g.col.raycast(o, [x, 0, z], L)) return true; }
    return false;
  }
  private footMu = 0.3;
  /** shoves made so far (the feet's own hash stream — not the impulses') and when the last scuff played */
  private shoves = 0; private scuffAt = -1;
  /** KICKED RUBBLE's counts (its own object: `stats` is as it was) — kicked ahead of a walking man, pushed off a man it lay in, tries a wall stopped, pieces given up on */
  feetStats = { kicked: 0, offMan: 0, walled: 0, gaveUp: 0 };

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
      if (!c.foot) moving++;
      const sub = 2, h = dt / sub;
      for (let s = 0; s < sub && !c.rest; s++) if (c.foot) this.slide(c, h); else this.step(c, h);   // (a boot's piece slides on the floor it lay on — feet(); anything else flies)
      if (c.box.c[1] < -1 || c.age > 600) { this.list.splice(i, 1); if (c.glass) this.glass?.gone?.(c); }   // fell out of the world (should not happen) / ten minutes of lying there: quietly retired
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
          const ct = c.contact;
          c.v = v3.add(v3.scale(vT, n[1] > 0.6 ? (ct ? ct.keepFloor : 0.55) : (ct ? ct.keepWall : 0.8)), v3.scale(vN, ct ? -ct.rest : -0.22));   // dead bounces; rubs along a floor, slides down a wall (a glass plate brings its own numbers: it slides on and hops)
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
    if (c.foot) c.foot = false;
    // sit exactly on the surface under it (the swept contact leaves it a few millimetres proud or shy)
    const sup = supportAlong(c.box, [0, 1, 0]);
    const from: Vec3 = [c.box.c[0], c.box.c[1] + 0.05, c.box.c[2]];
    const st = this.g.col.raycast(from, [0, -1, 0], sup + 0.4); const ph = this.g.props.raycast(from, [0, -1, 0], st ? st.t : sup + 0.4);
    const t = ph ? ph.t : st ? st.t : null;
    if (t !== null) c.box.c[1] = from[1] - t + sup + 0.0015 + (c.lift ?? 0);
    if (ph) { c.on = ph.prop; c.onPose = poseKey(ph.prop); }
    if (c.glass) this.glass?.rested(c);
  }
  private land(c: Chunk, speed: number) {
    c.sounded = true; this.stats.landed++; this.breaks?.landed(c, speed);
    if (c.glass && this.glass?.landed(c, speed)) return;   // a glass plate: its own clink / shatter and hearing event (game/shards.ts)
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
/** a slot the pool may take: a piece at rest — or one only a boot has set sliding (Chunk.foot: never set while RUBBLE.on is off) */
const evictable = (c: Chunk) => c.rest || c.foot === true;
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
