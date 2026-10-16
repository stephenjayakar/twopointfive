// WALL WEAR — what a breakable wall or piece of cover SHOWS while it is being shot, before it gives. LOOK ONLY: wallbreak.ts counts a round into a cell and opens
// the cell when the count is up; until then the wall used to stand whole to the eye (a 3 cm bullet mark on the shooter's face, nothing at all on the far one) and
// then burst. Here every counted round's mark is sized by how far gone its cell is — a pock, then a small hole in a ring of blown plaster, then cracks out of it —
// the marks the cell already carries grow with it, and on a thin partition the same mark shows on the FAR face (a blister, then a blow-out) with a puff and chips
// thrown out of that side. Nothing here is geometry: a 'small hole' is paint. Nothing sees, shoots or hears through it; the cell goes when it always went.
//
// THE RULES IT KEEPS (the destruction lane's digests stand):
//   · it READS the cell's count (handed in by WallBreak.round as a fraction) and writes nothing back; no hash counter of the lane's, no rate cap, no debris pool,
//     no solver dust, no light, no sound, no ray;
//   · it adds NO decal: the round's own bullet mark (marks.ts bulletMark, placed by combat.ts just before the destruction lane hears of the round) is EDITED into
//     decal kind 'damage' with param ≥ WEAR_MARK.look (render/decals.ts WEAR_MARK is the contract with decals.wgsl wearMark), so the decal ring's count — which
//     the game digest carries — is what it was. Variation comes off the decal's own look seed. A counted round that laid no mark (a muzzle pressed through the
//     wall — combat.ts wallAcrossArm — or the decals off) shows nothing new and throws nothing: the earlier marks of its cell still grow;
//   · particles only where a GPU system is attached (gpuFx), ≤ WEAR.maxBirths a round;
//   · nothing is saved: the ring already files a mark's kind / radius / strength (savestate.ts), so a load shows the wall as it was; the per-cell lists that let
//     OLD marks grow are dropped on restart / load (marks made before a load stay the size they were).
//
// THROUGH MARKS: on a partition of half thickness WEAR_MARK.minHalf‥maxHalf the record sits on the wall's MID-PLANE with a bounding radius of hypot(half
// thickness, reach) and the shader paints the wall's two faces from it (entry look where the surface faces the record's normal, exit look where it faces away;
// it recovers the half thickness from the radius and the strength, and takes only surfaces ON those two planes — a door leaf shut in the wall's plane is not
// one). Thicker cover, and sheet thinner than minHalf, take the entry look on the face that was hit and nothing behind.
//
// WHICH CELL A MARK BELONGS TO: the cell that was HIT (`key`), sized by the count of the cell the round was COUNTED into (a wall's sill counts on the upper
// while the upper stands). So a sill's marks grow with the port above it, stay as they are when the port opens (marks never shrink), and grow on from there
// once the sill's own count passes them.
import { Vec3, v3 } from '../math/vec';
import type { Box } from '../scene/boxes';
import { WEAR_MARK, type Decal } from '../render/decals';
import type { Game } from './game';
import { gpuFx, emitDust, type Surf } from './particleFx';

export const WEAR = {
  /** strength of a mark = (the cell's count ÷ what it takes)^curve × (1 − vary … 1 off the mark's seed) */
  curve: 0.4, vary: 0.25,
  /** far face: chips thrown from this strength up; particles asked for a round at most (the dust knob — particleFx DUST.count — scales the puffs after it) */
  exitChipsFrom: 0.3, maxBirths: 16,
  /** cells remembered at most (a cell opened by a blast or a collapse never says so here: the oldest lists are let go) */
  maxCells: 256,
};
/** the mark's material code (decals.wgsl wearMark): plaster · wood · torn board / cloth */
const matOf = (surf: Surf) => surf === 'wood' ? 1 : surf === 'cardboard' || surf === 'fabric' ? 2 : 0;
const PALE: Vec3 = [0.86, 0.85, 0.82];

export class WallWear {
  /** QA only (no panel row, not persisted): off = the round leaves what it left before this file */
  on = true;
  stats = { rounds: 0, marks: 0, through: 0, grown: 0, chips: 0, puffs: 0 };
  /** QA: the last rounds as `time cell count÷need place through|face marked|unmarked` (≤ 200 rows) */
  log: string[] = [];
  /** cell key → the marks it carries (ring entries; one the ring has dropped is edited to no effect) */
  private cells = new Map<number, Decal[]>();
  /** the newest ring serial taken as a round's own mark: an older bullet mark is never this round's */
  private taken = 0;

  /** A round was counted on a cell of a breakable (WallBreak.round, after the count went up, before the cell is judged). `box` = the AUTHORED box, `key` = any
   *  number naming the cell that was HIT, `counted` = the one the count went to (the same, but for a sill under a standing upper), `frac` = that cell's count ÷
   *  what it takes (≥ 1: it goes this frame). */
  round(g: Game, box: Box, surf: Surf, key: number, counted: number, frac: number, hitP: Vec3, dir: Vec3) {
    if (!this.on) return;
    this.stats.rounds++;
    if (frac >= 1) { this.cells.delete(counted); return; }   // the cell is gone this frame: what it throws is the break's own (a sill's list is kept: it stands)
    // the thin axis of the box (walls and cover are unrotated or yawed boxes) is the one a through mark crosses
    const cs = Math.cos(box.yaw), sn = Math.sin(box.yaw);
    const thinX = box.h[0] <= box.h[2]; const half = thinX ? box.h[0] : box.h[2];
    const axis: Vec3 = thinX ? [cs, 0, -sn] : [sn, 0, cs];   // (boxes.ts: local +X → (cos, 0, −sin), local +Z → (sin, 0, cos))
    const f = Math.max(0, Math.min(1, frac)); const base = Math.pow(f, WEAR.curve);
    const sOf = (d: Decal) => Math.min(0.999, base * (1 - WEAR.vary * (d.seed / 4096)));
    // every mark the cell carries grows with it
    let list = this.cells.get(key); let touched = false;
    if (list) for (const d of list) { const s = sOf(d); if (s > (d.param % 1) + 1e-4) { this.shape(d, s); this.stats.grown++; touched = true; } }
    // this round's own mark
    const mark = this.own(g, hitP);
    const through = !!mark && Math.abs(v3.dot(mark.n, axis)) > 0.9 && half >= WEAR_MARK.minHalf && half <= WEAR_MARK.maxHalf;
    if (mark) {
      if (through) mark.pos = v3.mad(mark.pos, mark.n, -half);   // onto the mid-plane: both faces are then on its two planes
      mark.kind = 'damage'; const w = mark as WearDecal; w.wearHalf = through ? half : 0; w.wearMat = matOf(surf);
      this.shape(mark, sOf(mark));
      if (!list) { if (this.cells.size >= WEAR.maxCells) this.cells.delete(this.cells.keys().next().value!); list = []; this.cells.set(key, list); }
      list.push(mark);
      this.stats.marks++; if (through) this.stats.through++; touched = true;
    }
    if (touched) g.decals.touch();
    this.log.push(`${g.time.toFixed(2)} cell ${key} ${f.toFixed(2)} @(${hitP[0].toFixed(2)},${hitP[1].toFixed(2)},${hitP[2].toFixed(2)}) ${through ? 'through' : 'face'} ${mark ? 'marked' : 'unmarked'}`); if (this.log.length > 200) this.log.splice(0, 100);
    if (mark) this.throwOut(g, box, surf, hitP, dir, mark.n, half, through, base);
  }

  /** the level put back / a checkpoint about to be applied: the marks are the ring's (cleared or re-filed by it), the lists are dropped */
  reset() { this.cells.clear(); this.taken = 0; }

  /** this round's bullet mark: the newest world-fixed 'bullet' among the last few ring entries (the lane may have laid a dent / shred after it), laid after the
   *  last one taken, within its own radius of the hit */
  private own(g: Game, hitP: Vec3): Decal | null {
    const L = g.decals.list;
    for (let i = L.length - 1; i >= 0 && i >= L.length - 3; i--) {
      const d = L[i]; if (d.kind !== 'bullet' || d.box || d.serial <= this.taken) continue;
      if (v3.dist(d.pos, hitP) < 0.045) { this.taken = d.serial; return d; }   // (bulletMark clamps the centre in from a face's edge by its radius, ≤ 3.1 cm)
    }
    return null;
  }
  /** strength → the record (WEAR_MARK: param = look + material + strength; radius = the reach, or hypot(half thickness, reach) for a mark on the mid-plane) */
  private shape(d: Decal, s: number) {
    const w = d as WearDecal; const half = w.wearHalf ?? 0; const reach = WEAR_MARK.reach0 + WEAR_MARK.reach1 * s;
    d.param = WEAR_MARK.look + (w.wearMat ?? 0) + s; d.radius = half > 0 ? Math.hypot(half, reach) : reach;
  }

  /** what the far face throws (through marks), and a little more off the near face as the cell goes: particles only, nothing without a GPU system */
  private throwOut(g: Game, box: Box, surf: Surf, hitP: Vec3, dir: Vec3, n: Vec3, half: number, through: boolean, s: number) {
    const P = gpuFx(g); if (!P) return;
    const wood = surf === 'wood', soft = surf === 'fabric' || surf === 'cardboard';
    const chip: Vec3 = surf === 'drywall' ? v3.lerp(box.albedo, PALE, 0.55) : wood ? [0.66, 0.52, 0.34] : v3.lerp(box.albedo, [0.8, 0.78, 0.72], soft ? 0.4 : 0.1);
    const dust: Vec3 = surf === 'drywall' ? [0.82, 0.8, 0.76] : wood ? [0.62, 0.54, 0.42] : v3.lerp(box.albedo, [0.7, 0.68, 0.64], 0.6);
    let room = WEAR.maxBirths;
    if (through) {
      // out of the far face, along the round (kept off the wall plane so nothing is born inside it)
      const out = v3.normalize(v3.add(v3.scale(n, -1), v3.scale(dir, 0.6)));
      const at = v3.mad(hitP, n, -(2 * half + 0.03));
      const puffs = emitDust(P, at, out, Math.min(room, 1 + Math.round(2 * s)), { shape: 'puff', speed: 0.35 + 0.5 * s, speedJit: 0.5, lift: 0.2, life: 1.1 + 0.6 * s, lifeJit: 0.3, size: 0.09 + 0.08 * s, sizeJit: 0.35, posJit: 0.04 + 0.05 * s, vadd: v3.scale(out, 0.3 + 0.4 * s), color: dust });
      this.stats.puffs += puffs; room = Math.max(0, room - puffs);
      const chips = Math.min(room, s < WEAR.exitChipsFrom ? 1 : Math.round(3 + 8 * s)); room -= chips;
      if (chips > 0) P.emit('debris', at, out, chips, { speed: 1.2 + 2.2 * s, speedJit: 0.7, spread: 0.7 + 0.3 * s, life: 14, lifeJit: 0.3, size: wood ? 0.006 : 0.007 + 0.004 * s, sizeJit: 0.6, aspect: wood ? 3 : 1, color: chip });
      this.stats.chips += chips;
    }
    // near face: the impact burst (particleFx impactFx) already threw its chips and puff; a cell most of the way gone sheds a few bigger flakes that fall
    const flakes = Math.min(room, s > 0.45 ? Math.round(5 * s) : 0);
    if (flakes > 0) { P.emit('debris', v3.mad(hitP, n, 0.02), v3.normalize(v3.add(n, [0, -0.4, 0])), flakes, { speed: 0.9, speedJit: 0.7, spread: 1.1, life: 14, lifeJit: 0.3, size: wood ? 0.007 : 0.012, sizeJit: 0.6, aspect: wood ? 3 : 1.4, color: chip }); this.stats.chips += flakes; }
  }

  summary(): string { const s = this.stats; return `wear ${this.on ? 'on' : 'OFF'} · rounds ${s.rounds} · marks ${s.marks} (${s.through} through) · grown ${s.grown} · chips ${s.chips} puffs ${s.puffs} · cells ${this.cells.size}`; }
}
/** a ring entry this file re-shaped: the half thickness its record carries (0 = on the face it was hit on) and its material code */
type WearDecal = Decal & { wearHalf?: number; wearMat?: number };
