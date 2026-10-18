// ENTRY POINTS OFF UNCLEARED OPENINGS (Game.entry, __game.entry) — the footage's reading of both operator deaths in the hostage-rescue video: "a man standing
// still within about 3 m of an opening an enemy gets the first look through". The door tools' points of domination (doortools.ts pods(): the level's clear
// plan, or the first free floor to either hand of the door) and the points a room's search sends a man on to (moveOn) knew nothing of the room's OTHER ways
// in: a point could stand a metre in front of a connecting door nobody had been through.
//
//   AN OPENING     cover.ts's own list: every door at its frame (and, with ENTRY.gaps, every gap of the nav grid): nothing authored, a new level has them for nothing.
//   CLEARED        an opening's far side is KNOWN once one of the squad (a teammate or Sam) has stood on that side of it within ENTRY.knownM with a line to it —
//                  the corridor a stack walked up, a room they hold, the doorway a man is standing in (both sides). Kept for the encounter; nobody has to say it.
//                  (A side with no floor a man could come by is nobody's to clear: it never counts.)
//   RISKY          a point within ENTRY.nearM of an opening whose far side is not known, AND in its line: inside the wedge the opening shows to whoever comes
//                  to it (ENTRY.lineDeg off each jamb) with nothing a man cannot be seen over in between. Leaves are not counted: a shut door opens.
//                  Beside the door against its own wall is out of the line; so is three metres back.
//   THE MOVE       a risky point is moved to the nearest free floor of the same room that is not risky and has a line to that opening (no further than
//                  ENTRY.moveM, nothing to walk round in between, on the same hand of the entry door, no deeper into its funnel than it was, clear of the
//                  other points). A room with no such floor keeps the point where it was (`kept`): where the room allows, no more.
//   THE WATCH      the man keeps the facing his point was dealt for the entry itself — his corners, the room looked over — and once that is done HOLDS with
//                  his gun on the opening he was moved off (doortools.ts onSector: Pod.watch), from out of its line: whoever comes through it comes onto a
//                  muzzle already there. (The first cut moved the point and kept its facing: the one gun that had been near that door was now across the
//                  room with its back to it, and the man who came through it shot the room from behind — ENTRY.watch off is that cut.)
//
// ENTRY.offOpenings off = the points exactly as they were (clearOf returns its argument); the tracker still runs (it writes nothing but its own map), so a
// probe can ask riskAt() of either build's points. tools/qa/entrypoints-probes.ts counts the risky points of every door of the seven scenarios before and after.
// NOT DONE: the stack's own posts outside the door, the threshold stage's shallow step (doortools.ts shallowPods: counted by the probe, not moved), the
// rescue flow's authored cover marks; an uncleared opening no point was moved off gets no gun from this (room cover for everybody measured as a loss:
// cover.ts COVER.inRoom).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideSet } from '../math/side';
import { Vec3 } from '../math/vec';
import type { Game } from './game';
import type { Door } from './doors';
import type { Opening } from './cover';
import { wallBetween } from './roomclear';

/** The knobs (__game.entry.knobs; Team feel rows: teamfeel.ts ENTRY). */
export const ENTRY = {
  /** a point of domination / a search point that is risky (below) is moved off the opening where the room has the floor · false = the points as they were */
  offOpenings: true,
  /** … the point itself is moved (false: it stays, and only the watch below is given) · the man on it holds with his gun on that opening once his entry is
   *  done (false: he keeps the sector his point was dealt, across the room) */
  move: true, watch: true,
  /** risky = within this of an uncleared opening (m, to the nearest of its width) … and inside this many degrees off its jambs (the wedge it shows) */
  nearM: 3, lineDeg: 45,
  /** the nav grid's gaps count as openings too (a doorway with no leaf, the slot between two partitions) · false = doors only. SHIPS OFF: a gap is floor of
   *  the room being entered — the entry's own corners and search look beyond it within seconds — where a door leads to a room this entry will not clear */
  gaps: false,
  /** one of the squad this near an opening, on a side with a line to it, makes that side known (m) */
  knownM: 4,
  /** how far a point may be moved (m) · its replacement keeps this far from the entry's other points (m) */
  moveM: 3, apart: 0.9,
  /** a point dealt PAST THE MOUTH of the door the entry comes through is never moved back into it: inside its funnel, nearer the frame than `mouthM`.
   *  (A point dealt down the middle of the door — the fourth man's, 3 m in, in a room with no floor to a hand of it — had no hand and no funnel width to
   *  keep to, so 'the nearest floor off the other opening' could be the doormat: he stood in the opening and whoever came in behind walked into his back.)
   *  With nowhere else to go he keeps the point he was dealt and holds his gun on the opening he could not get off (`stay`): the doorway free at the price
   *  of a man in an uncleared door's line, as every entry stood before points were moved at all. A point DEALT inside the mouth (a room so small that the
   *  middle man's place is 1.5 m in) is moved as it was. False: a point may be put in the mouth, as it was.
   *  SHIPS OFF. On the barracks the rule does what it says (the player is no longer stopped in the s34 doorway), and the scripted commander, no longer
   *  held there, walks his file out of the bunks seconds sooner into the counterattack coming through the gallery's fire door: 4 of 16 runs taken where
   *  14 were. That is the script's tempo, not the rule's — but until a commander who waits a beat after an entry has been counted, it stays a row to try */
  offMouth: false, mouthM: 1.8,
};

/** a point an entry deals a man: where, the facing held there — and, for a point this module has looked at, the opening its man holds his gun on afterwards */
export interface Pod { pos: Vec3; face: number; watch?: Vec3 }
const EYE = 1.55, CHEST = 1.1;

export class EntryPoints {
  readonly knobs = ENTRY;
  /** per opening: bit 1 = one of the squad has been on its +n side, bit 2 = on its −n side */
  private been = new Map<Opening, number>(); private last = -1;
  /** the points an entry dealt to its men (doortools.ts enter / moveOn): how many, how many of them risky as they stand, how many were moved off an opening
   *  and how many were risky with nowhere to go */
  stats = { pods: 0, risky: 0, moved: 0, kept: 0 };
  /** the newest moves: 'door · (x, z) → (x, z) · off <opening>' */
  log: string[] = [];
  private movedSet = new SideSet<Pod>();
  constructor(private g: Game) { }

  /** nothing known (a restart: Game.resetGuards) */
  reset() { this.been.clear(); this.last = -1; this.stats = { pods: 0, risky: 0, moved: 0, kept: 0 }; this.log.length = 0; }

  /** the level's openings as this module counts them */
  openings(): Opening[] { const all = this.g.cover.ready(); return ENTRY.gaps ? all : all.filter(o => o.kind === 'door'); }


  /** four times a second: where the squad stands is known ground */
  tick() {
    const g = this.g; if (!g.orders.active) return;
    if (this.last >= 0 && Math.abs(g.time - this.last) < 0.25) return; this.last = g.time;
    for (const gd of g.orders.men()) if (gd.state !== 'dead') this.mark(gd.char.pos);
    this.mark(g.player.char.pos);
  }
  /** one of ours stands at `p`: the side he is on of every opening near him that he has a line to is known (in the opening itself: both) */
  mark(p: Vec3) {
    const K = ENTRY;
    for (const o of this.g.cover.ready()) {   // (gaps too, whatever the knob says: it can be flipped in the middle of a run)
      const dx = p[0] - o.at[0], dz = p[2] - o.at[2]; if (dx * dx + dz * dz > K.knownM * K.knownM) continue;
      const s = dx * o.n[0] + dz * o.n[1], inIt = Math.abs(s) < 0.3 && Math.abs(dx * o.n[1] - dz * o.n[0]) <= o.half + 0.2;   // (standing in the opening itself)
      const had = this.been.get(o) ?? 0, bits = inIt ? 3 : s > 0 ? 1 : 2; if ((had & bits) === bits) continue;
      // (his own eyes' line, leaves and all — a side seen only through another door's shut leaf is not known — to the opening's own face, short of its leaf)
      if (!inIt && !this.sees(p, o, s >= 0 ? 1 : -1, false)) continue;
      this.been.set(o, had | bits);
    }
  }
  /** a line from a man standing at `p` to the face of `o` on side `sg` (its middle, or either third of its width). `open`: with every leaf out of the way */
  private sees(p: Vec3, o: Opening, sg: 1 | -1, open: boolean): boolean {
    const eye: Vec3 = [p[0], EYE, p[2]], col = this.g.col;
    for (const k of [0, 0.6, -0.6]) { const q: Vec3 = [o.at[0] + o.n[1] * o.half * k + o.n[0] * sg * 0.3, CHEST, o.at[2] - o.n[0] * o.half * k + o.n[1] * sg * 0.3]; if (open ? !wallBetween(this.g, eye, q) : !col.segmentBlocked(eye, q)) return true; }
    return false;
  }
  /** has one of the squad been on the side of `o` that `p` is NOT on */
  farKnown(o: Opening, p: Vec3): boolean { const s = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1]; return ((this.been.get(o) ?? 0) & (s >= 0 ? 2 : 1)) !== 0; }

  /** the uncleared opening that makes `p` a bad place to stand still (the nearest), or null. `skip`: the door this entry comes in by. `gaps`: count the nav
   *  grid's gaps whatever the knob says (the play-throughs' watcher labels a death by either kind) */
  riskAt(p: Vec3, skip: Door | null = null, gaps = ENTRY.gaps): Opening | null {
    const K = ENTRY, nav = this.g.col.nav, tan = Math.tan(K.lineDeg * Math.PI / 180); let best: Opening | null = null, bd = Infinity;
    for (const o of this.g.cover.ready()) {
      if (!gaps && o.kind !== 'door') continue;
      if (skip && o.door === skip) continue;
      const dx = p[0] - o.at[0], dz = p[2] - o.at[2]; if (Math.abs(dx) > K.nearM + o.half || Math.abs(dz) > K.nearM + o.half) continue;
      const s = dx * o.n[0] + dz * o.n[1], b = Math.abs(s), l = Math.abs(dx * o.n[1] - dz * o.n[0]), d = Math.hypot(Math.max(0, l - o.half), b);
      if (d > K.nearM || d >= bd || l > o.half + b * tan) continue;
      if (this.farKnown(o, p)) continue;
      const sg = s >= 0 ? 1 : -1;
      if (nav.isBlocked(o.at[0] - o.n[0] * sg * 0.9, o.at[2] - o.n[1] * sg * 0.9) && nav.isBlocked(o.at[0] - o.n[0] * sg * 1.5, o.at[2] - o.n[1] * sg * 1.5)) continue;   // (no floor beyond: nobody comes that way)
      const to: Vec3 = [p[0], CHEST, p[2]]; let seen = false;
      for (const k of [0, 0.7, -0.7]) { const ax = o.at[0] + o.n[1] * o.half * k + o.n[0] * sg * 0.2, az = o.at[2] - o.n[0] * o.half * k + o.n[1] * sg * 0.2; if (!wallBetween(this.g, [ax, EYE, az], to)) { seen = true; break; } }   // (leaves out of the way: a shut door opens)
      if (!seen) continue;
      best = o; bd = d;
    }
    return best;
  }

  /** an entry's points through door `d`, each risky one moved off its opening where the room has the floor and given that opening to hold a gun on
   *  (ENTRY.offOpenings off: `pods` itself). `frame(p)`: p in the door's frame — [metres along it from its middle, metres inside the frame line]
   *  (doortools.ts hands its own). */
  clearOf(d: Door, pods: Pod[], frame: (p: Vec3) => [number, number]): Pod[] {
    const K = ENTRY; if (!K.offOpenings || !pods.length) return pods;
    const g = this.g, nav = g.col.nav, cs = nav.cell, W = d.def.width, out = [...pods];
    for (let i = 0; i < out.length; i++) {
      const P = out[i], by = this.riskAt(P.pos, d); if (!by) continue;
      const watch: Vec3 | undefined = K.watch ? [by.at[0], 1.2, by.at[2]] : undefined;
      const sideOf = (q: Vec3): 1 | -1 => (q[0] - by.at[0]) * by.n[0] + (q[2] - by.at[2]) * by.n[1] >= 0 ? 1 : -1;
      const stay = () => { if (watch && this.sees(P.pos, by, sideOf(P.pos), true)) out[i] = { pos: P.pos, face: P.face, watch }; };   // (it stays where it is: its man can at least hold the opening)
      if (!K.move) { stay(); continue; }
      const [a0, b0] = frame(P.pos), funnel = W / 2 + 0.3, r = Math.ceil(K.moveM / cs), cx = Math.floor(P.pos[0] / cs), cz = Math.floor(P.pos[2] / cs), room = g.fight?.roomAt(P.pos) ?? null;
      let best: Vec3 | null = null, bs = Infinity;
      for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
        const q: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs], dist = Math.hypot(q[0] - P.pos[0], q[2] - P.pos[2]); if (dist > K.moveM || dist >= bs || nav.isBlocked(q[0], q[2])) continue;
        const [a, b] = frame(q); if (b < 0.3) continue;                                         // inside the room
        if (Math.abs(a0) > 0.3 && a * a0 < 0) continue;                                         // on the hand of the door it was dealt
        if (Math.abs(a) < Math.min(Math.abs(a0), funnel)) continue;                             // no deeper into the door's own funnel
        if (K.offMouth && b0 >= K.mouthM && Math.abs(a) < funnel && b < K.mouthM) continue;     // … and a point dealt past its mouth is never brought back into it (in the funnel, within mouthM of the frame)
        if (out.some((o, j) => j !== i && Math.hypot(o.pos[0] - q[0], o.pos[2] - q[2]) < K.apart)) continue;
        if (room && g.fight.roomAt(q) !== room) continue;                                       // the room it was in (not the one beyond an open door)
        if (g.col.solidBlocked([P.pos[0], 0.45, P.pos[2]], [q[0], 0.45, q[2]])) continue;       // the same pocket of floor: nothing to walk round between the two
        if (this.riskAt(q, d)) continue;
        if (watch && !this.sees(q, by, sideOf(q), true)) continue;                              // … from where he can hold a gun on the opening he was moved off
        best = q; bs = dist;
      }
      if (!best) { stay(); continue; }
      const moved: Pod = { pos: best, face: P.face, watch }; out[i] = moved; this.movedSet.add(moved);
      this.log.push(`${d.def.name} · (${P.pos[0].toFixed(1)}, ${P.pos[2].toFixed(1)}) → (${best[0].toFixed(1)}, ${best[2].toFixed(1)}) · off ${by.id}`); if (this.log.length > 60) this.log.shift();
    }
    return out;
  }

  /** a search point taken over a better-seeing one that stood by an uncleared opening (doortools.ts moveOn): it counts as moved */
  swapped(pod: Pod) { this.movedSet.add(pod); }
  /** a point an entry has just dealt to a man (the tallies: Game.entry.stats) */
  dealt(pod: Pod, skip: Door | null) { const S = this.stats; S.pods++; const risky = !!this.riskAt(pod.pos, skip); if (risky) S.risky++; if (this.movedSet.has(pod)) S.moved++; else if (risky && ENTRY.offOpenings) S.kept++; }

  summary(): string { const S = this.stats, n = [...this.been.values()].filter(v => v).length; return `entry points: ${S.pods} dealt · ${S.risky} by an uncleared opening · ${S.moved} moved off one · ${S.kept} with nowhere to go · ${n} openings known`; }
}
