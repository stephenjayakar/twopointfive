// WHO HAS SEEN WHAT FLOOR (doortools.ts DOORTOOLS.leadSeen): for each teammate, when every cell of the nav grid was last inside HIS eye's wedge with a line to it.
// One question is asked of it — of the men about to go through a door, who has already seen most of the room behind it (the footage, the Door Kickers narrator:
// 'i'm going to lead with this man because he's already seen most of the room he knows what it looks like and where the threats are at'; 'peanut here has
// already seen most of the room so we're going to prioritize him entering').
//   The eye is the sight test's own (guards.ts GUARD_EYE: 58° either side of where chest and head point between them, 100° inside 3.5 m), the line is the sight
//   test's own (col.segmentBlocked: statics and door leaves stop it, glass does not), the reach is the door tools' (`leadSeenM`: floor further off than that is
//   not floor he could say anything about). No light is asked for: what he knows from having looked is the room's shape and where a man could stand.
// It is a RECORD: it writes nothing but itself, draws no dice, and moves nobody — kept while the rule is on (or a probe asks for it: DoorTools.seenWatch), each
// living man's brought up to date every EVERY frames, the men staggered; a cell whose line was asked about inside the last REFRESH seconds is not asked about
// again, whichever way it came out (a man costs one wedge of line tests a second, some hundreds, however long he stands).
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { Vec3, v3, DEG } from '../math/vec';
import type { Game, Guard } from './game';
import { GUARD_EYE } from './guards';

const EVERY = 12, REFRESH = 1.0, NEVER = -1e9;

export class FloorSeen {
  /** per man: the game time each nav cell was last seen (NEVER: not yet) · and when its line was last asked about */
  private at = new Map<Guard, Float32Array>(); private asked = new Map<Guard, Float32Array>();
  private frame = 0;
  constructor(private g: Game) { }
  /** once a frame, for the men whose record is kept; `reach`: metres */
  tick(men: Guard[], reach: number) {
    const g = this.g, nav = g.col.nav, cs = nav.cell, t = g.time; this.frame++;
    for (let j = 0; j < men.length; j++) {
      if ((this.frame + j * 3) % EVERY !== 0) continue;
      const gd = men[j]; if (gd.state === 'dead' || t < gd.dazzledUntil) continue;
      let A = this.at.get(gd), Q = this.asked.get(gd); if (!A || !Q) { A = new Float32Array(nav.W * nav.H).fill(NEVER); Q = new Float32Array(nav.W * nav.H).fill(NEVER); this.at.set(gd, A); this.asked.set(gd, Q); }
      const c = gd.char, eye: Vec3 = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]), look = v3.lerp(c.chestDir, c.headDir(), 0.5), ll = Math.hypot(look[0], look[2]) || 1, lx = look[0] / ll, lz = look[2] / ll;
      const cosFar = Math.cos(GUARD_EYE.halfDeg * DEG), cosNear = Math.cos(GUARD_EYE.nearDeg * DEG), n = Math.ceil(reach / cs), x0 = Math.floor(eye[0] / cs), z0 = Math.floor(eye[2] / cs);
      for (let z = Math.max(0, z0 - n); z <= Math.min(nav.H - 1, z0 + n); z++) for (let x = Math.max(0, x0 - n); x <= Math.min(nav.W - 1, x0 + n); x++) {
        const i = nav.idx(x, z); if (nav.blocked[i] === 1 || t - Q[i] < REFRESH) continue;
        const px = (x + 0.5) * cs, pz = (z + 0.5) * cs, dx = px - eye[0], dz = pz - eye[2], dd = Math.hypot(dx, dz); if (dd > reach) continue;
        if (dd > 0.6 && (dx * lx + dz * lz) / dd < (dd < GUARD_EYE.nearM ? cosNear : cosFar)) continue;   // (the floor he stands on is seen; past that, the wedge)
        Q[i] = t; if (!g.col.segmentBlocked(eye, [px, 1.0, pz])) A[i] = t;
      }
    }
  }
  /** how many of `cells` (nav cell indices) `gd` has seen since game time `since` */
  count(gd: Guard, cells: Iterable<number>, since: number): number { const A = this.at.get(gd); if (!A) return 0; let n = 0; for (const i of cells) if (A[i] >= since) n++; return n; }
}
