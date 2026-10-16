// A GUN FROM BEHIND A HELD MAN (the maintainer, 10-12: "when you're holding a hostage, enemies pretty much ignore that you're shooting at them and you can just take
// them down. they should probably run for cover when you take out a gun and actively work on flanking you").
//
// What was there (guards.ts, the human-shield standoff): the men who see a colleague in Sam's arm walk a ring round the pair, 3.5‥7 m off, every ring point
// chosen so the pair stays IN SIGHT, at a walk, chest to him — and under muzzle discipline nobody fires while the man is up. Right for a knife at a throat. With
// the PISTOL at the man's head Sam fires past him: one round a man, at men standing in the open who may not answer, and suppression only roots a standoff man
// where he stands. That is the free win.
//
// The rule here, for the men of that standoff, from the moment one of them has SEEN the pistol in the hold (or a round has left it):
//   COVER   a man in Sam's line of fire, forward of his rear arc, RUNS for the nearest floor where something solid stands between him and Sam's gun (a crouch
//           behind low cover counts; glass does not), and holds there — the standoff is kept without eyes on the pair while somebody of his side has seen
//           them lately;
//   ROUND   the men go round: each plans a way to Sam's back that keeps out of his line of fire (the nav search at a price on floor his gun covers, dearest in
//           front of him), two men opposite ways, bent double behind anything low; with three or more, the man most in front of Sam stays in cover and keeps
//           him talking. A way may cross open floor in his line only in short dashes — a couple of strides with the pistol turned on this man, a longer one
//           while it is on somebody else — else it is no way: he stays behind his cover and is asked again; and a man caught in the open with the pistol
//           coming round onto him breaks for the nearest cover;
//   LOOK    with nobody's eyes on the pair for a few seconds a man in cover steps to its edge (or stands up from behind low cover), looks, and steps back; the
//           pair gone from where they were left = the standoff is lost, and it is the plain hunt on where they were;
//   LINE    a man who gains the clean line at Sam's back (guards.ts flankShot: within 70° of dead astern, the held man well clear of the round, inside 5 m)
//           plants on it — and once Sam has FIRED from behind the man, takes it: single aimed rounds on the standoff's own slow cadence. Never past a civilian,
//           never from anywhere but that line; before Sam fires the line is held silent, as it always was.
// Nothing here adds a man, a hit point or a steadier hand: the same men, walking somewhere else.
//
// ONE MODEL: where Sam is, is where a man of the side last SAW the pair (`Known.sam` — any standoff man's eyes this frame, or his own); nobody is steered by the
// pair's true position through a wall. A round from the hold is known to every man of the standoff (they are inside a room's reach of it by construction).
//
// SWITCH: `GUNHOLD.on` — ON in the page (`?nogunhold` = the ring and the silence exactly as they were), OFF in the module and on the frozen harness stand
// (`TPS_GUNHOLD=1`); a FROZEN_HOLDS row, in the knob registry and a journal's tables (a recording from before the key replays with it off). Off = nothing in this
// file runs: every seam in guards.ts returns on its first clause. Never under a show (`touring`) or `quietUtility`.
//
// STATE: per hold (`Known`, keyed by the Hold object) and per man (`St`, keyed by his Standoff record) in WeakMaps — it dies with the hold / the record, as the
// standoff record itself does; no checkpoint is written with a man in Sam's arm (savestate.ts playerBusy), so nothing here is saved. The die is the game's
// (simRandom). Seams: guards.ts standoffPerceive (gunHoldSee), standoffAlert (gunHoldFeet, gunHoldFree), standoffUpkeep (gunHoldKeeps), updateGuard's
// suppression line (gunHoldRuns). Check: `bun run tools/qa/gunhold-check.ts` (`probes.ts gunhold`; `GUNHOLD_BREAK=1` must fail).
import { Vec3, v3, wrapAngle, approachAngle, damp, DEG } from '../math/vec';
import type { Game, Guard } from './game';
import type { Pair, Standoff } from './guards';
import { followPath, stepAlongPath, notGettingAnywhere } from './guards';
import { SUPPRESSION, flinching } from './suppression';
import { simRandom } from '../math/dice';
import { defenderWords } from './teams';

export const GUNHOLD = {
  /** the whole rule. Module default OFF (the frozen stand); the page raises it (src/host/profile.ts pageSwitches; `?nogunhold` holds it off) */
  on: false,
  /** once Sam has fired from behind the man, a man on the clean line at his back takes it. false = cover and the way round as ever, the line held silent */
  fire: true,
  /** how far a man will run for cover, metres of floor */
  coverM: 10,
  /** nobody's cover, and nobody's way round, inside this of the pair */
  nearM: 3.0,
  /** a man this close to dead astern of Sam (degrees) is where he wants to be: he does not run from there */
  rearDeg: 70,
  /** the standoff is kept this long with nobody of the side having seen the pair */
  keepSecs: 14,
  /** nobody has seen them for this long: a man in cover takes a look … */
  peekEvery: 4,
  /** … for this long, then back */
  peekSecs: 0.8,
  /** the longest stretch of a way round across floor his gun covers in front of him: with the pistol turned this man's way … */
  showM: 2.5,
  /** … seconds after a round from the hold that a man the pistol is turned on will cross next to none of it */
  shyS: 6,
  /** … and with it on somebody else (a dash between covers while he looks the other way) */
  dashM: 3.5,
  /** 'turned his way' = the man within this of where the pair faces, degrees */
  faceDeg: 50,
  /** the longest way round, metres */
  flankMaxM: 40,
  /** a man's own beat before his legs answer the gun, seconds [least, most] */
  react: [0.1, 0.4] as [number, number],
};
export const GUNHOLD_DEFAULTS: typeof GUNHOLD = JSON.parse(JSON.stringify(GUNHOLD));

/** what the men of one side know of one hold: when the pistol was first seen in it (−1 never), the last of Sam's rounds from it they know of (−1 none), where
 *  the pair was last seen and which way it faced, when; when a look found them gone; the floor his gun covers from there (lazy, per nav cell: 0 none, 1 standing
 *  only — a crouch hides, 2 open), and where that was worked out from; the man of three or more who stays in front; the side's last line */
interface Known { gunT: number; shotT: number; sam: Vec3; facing: number; fixT: number; goneT: number; expo: Map<number, number>; expoAt: Vec3; expoT: number; talker: Guard | null; saidT: number; saidGun: boolean; saidShot: boolean; }
type Phase = 'react' | 'plan' | 'run' | 'cover' | 'peek' | 'back' | 'flank' | 'line';
/** one man's part: what his feet are doing; the beat before they answer; his cover (and whether it is low: he crouches), the cell at its edge he looks from;
 *  his way round's goal and what the pair looked like when it was planned; the clocks */
interface St { phase: Phase; goT: number; spot: Vec3 | null; low: boolean; edge: Vec3 | null; goal: Vec3 | null; planSam: Vec3 | null; planFacing: number; planT: number; peekT: number; peekEnd: number; peekFrom: number; checkT: number; runT: number; lineT: number; retryT: number; coverBad: boolean; shownT: number; bad: Vec3 | null; saidRound: boolean; }
export interface GunHoldStats { armed: number; ran: number; noCover: number; rounds: number; noWay: number; looks: number; gone: number; lines: number; freeT: number; }

const knowns = new WeakMap<object, Known>(); const states = new WeakMap<Standoff, St>(); const statsOf = new WeakMap<Game, GunHoldStats>(); const planned = new WeakMap<Game, number>();
export function gunHoldStats(g: Game): GunHoldStats { let s = statsOf.get(g); if (!s) { s = { armed: 0, ran: 0, noCover: 0, rounds: 0, noWay: 0, looks: 0, gone: 0, lines: 0, freeT: -1 }; statsOf.set(g, s); } return s; }
export const GUNHOLD_DEBUG: { log: ((s: string) => void) | null } = { log: null };

const live = (g: Game) => GUNHOLD.on && !g.touring && !g.quietUtility;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the men of the standoff on this held man, living, in roster order */
function menOn(g: Game, held: Guard): Guard[] { const out: Guard[] = []; for (const o of g.guards) if (o.state !== 'dead' && o.standoff && o.standoff.pair === held) out.push(o); return out; }

/** guards.ts standoffPerceive, its last lines: this man has the pair in his eyes this frame, in the standoff. What his side knows of the hold is brought up to
 *  it — where they are, which way they face, whether the pistol is in it, whether it has fired. */
export function gunHoldSee(g: Game, gd: Guard, P: Pair) {
  if (!live(g)) return;
  const H = g.player.holding; if (!H) return;
  let K = knowns.get(P.key);
  if (!K) { K = { gunT: -1, shotT: -1, sam: v3.copy(P.sam), facing: P.facing, fixT: g.time, goneT: -1, expo: new Map(), expoAt: v3.copy(P.sam), expoT: g.time, talker: null, saidT: -100, saidGun: false, saidShot: false }; knowns.set(P.key, K); }
  K.sam = v3.copy(P.sam); K.facing = P.facing; K.fixT = g.time; K.goneT = -1;
  if (K.gunT < 0 && H.variant === 'gun' && H.phase !== 'grab') { K.gunT = g.time; gunHoldStats(g).armed++; GUNHOLD_DEBUG.log?.(`${gd.callsign} sees the pistol in the hold`); }
  learnShot(g, K, H.shotT, true);
  if (K.gunT >= 0 && gd.reactT > 0.3) gd.reactT = 0.3;   // (a pistol coming up at him is not a thing a man takes his whole beat over)
}
/** a round from the hold reaches the side's knowledge through a man who SENSED it — the pair in his eyes that frame, or the report in his ears (HEAR_M: a
 *  suppressed pistol across a room) — while it is fresh; a round nobody sensed is not known */
const HEAR_M = 7, FRESH_S = 1;
function learnShot(g: Game, K: Known, shotT: number, sensed: boolean) {
  if (!(shotT > K.shotT) || !sensed || g.time - shotT > FRESH_S) return;
  K.shotT = shotT; if (K.gunT < 0) { K.gunT = g.time; gunHoldStats(g).armed++; }
}
/** is this man's standoff one the rule has (the pistol known in the hold, a part dealt him) */
function partOf(g: Game, gd: Guard): { K: Known; st: St } | null {
  if (!live(g) || !gd.standoff) return null;
  const H = g.player.holding; if (!H || H.g !== gd.standoff.pair) return null;
  const K = knowns.get(H), st = states.get(gd.standoff); return K && st ? { K, st } : null;
}
/** guards.ts standoffUpkeep: out of his sight for LOSE_SECS the record went ('lost'). Behind cover on purpose it is KEPT while somebody of his side has seen the
 *  pair lately and no look has found them gone. */
export function gunHoldKeeps(g: Game, gd: Guard): boolean {
  const p = partOf(g, gd); if (!p) return false;
  return p.K.goneT < 0 && g.time - Math.max(gd.standoff!.seenT, p.K.fixT) < GUNHOLD.keepSecs;
}
/** updateGuard's suppression line: rounds past a standoff man's head ROOT him where he stands (head down, feet still: suppression.ts never shifts a man of the
 *  standoff). A man this rule has on his feet for cover is not rooted in the open — he is already running bent low for it; behind it, he ducks like anybody. */
export function gunHoldRuns(g: Game, gd: Guard): boolean {
  const p = partOf(g, gd); if (!p) return false;
  if (p.st.phase !== 'cover' && p.st.phase !== 'line') return true;
  return shown(g, p.K, gd.char.pos, p.st.phase === 'cover' && p.st.low);   // (Sam has walked the pair round his cover, or come about on the man at his back: he is not rooted there either)
}
/** guards.ts standoffAlert's round: is the clean line at Sam's back this man's to USE — Sam has fired from behind the man, and the man is no civilian */
export function gunHoldFree(g: Game, P: Pair): boolean {
  if (!live(g) || !GUNHOLD.fire || P.held.team === 'civilian') return false;
  const K = knowns.get(P.key); if (!K || K.shotT < 0) return false;
  gunHoldStats(g).freeT = g.time; return true;   // (freeT: the last frame a planted man was handed the round — tools/qa/soak.ts's shield invariant reads it)
}

// ---------------------------------------------------------------- the floor his gun covers
const GUN_Y = 1.35, PISTOL_ENERGY = 0.6;   // (the height the pistol comes out past the man's shoulder at; glasspen.ts's row for his sidearm — a pane a 9 mm passes is no cover)
/** what a man on nav cell `i` shows Sam's gun from where the pair was last seen: 2 = open, 1 = open standing, hidden crouched (low cover), 0 = hidden */
function expo(g: Game, K: Known, i: number): number {
  if (flat(K.sam, K.expoAt) > 0.5 || g.time - K.expoT > 1.5) { K.expo.clear(); K.expoAt = v3.copy(K.sam); K.expoT = g.time; }   // (…or it is old: a leaf swung, a wall or a pane gone)
  let e = K.expo.get(i); if (e !== undefined) return e;
  const n = g.col.nav, x = (i % n.W + 0.5) * n.cell, z = (((i / n.W) | 0) + 0.5) * n.cell;
  const G: Vec3 = [K.expoAt[0], GUN_Y, K.expoAt[2]]; const open = (h: number) => !g.col.shotBlocked(G, [x, h, z], 0.02, PISTOL_ENERGY);
  if (Math.hypot(x - G[0], z - G[2]) > 24) e = 0;
  else if (open(0.8) || open(1.05)) e = 2;
  else e = open(1.5) || open(1.2) ? 1 : 0;
  K.expo.set(i, e); return e;
}
function cellOf(g: Game, p: Vec3): number { const n = g.col.nav, x = Math.floor(p[0] / n.cell), z = Math.floor(p[2] / n.cell); return x < 0 || z < 0 || x >= n.W || z >= n.H ? -1 : z * n.W + x; }
function centre(g: Game, i: number): Vec3 { const n = g.col.nav; return [(i % n.W + 0.5) * n.cell, 0, (((i / n.W) | 0) + 0.5) * n.cell]; }
/** is the pistol turned this man's way: he stands within faceDeg of where the pair faces */
function facesHim(K: Known, p: Vec3): boolean { return Math.abs(wrapAngle(Math.atan2(p[0] - K.sam[0], p[2] - K.sam[2]) - K.facing)) < GUNHOLD.faceDeg * DEG; }
/** forward of Sam's rear arc: the floor he can put the pistol on without coming all the way about */
function front(K: Known, p: Vec3): boolean { return Math.abs(wrapAngle(Math.atan2(p[0] - K.sam[0], p[2] - K.sam[2]) - (K.facing + Math.PI))) > GUNHOLD.rearDeg * DEG; }
/** is a man standing (or, behind low cover, crouched) at `p` in Sam's line of fire, forward of his rear arc */
function shown(g: Game, K: Known, p: Vec3, low: boolean): boolean {
  if (!front(K, p)) return false;
  const G: Vec3 = [K.sam[0], GUN_Y, K.sam[2]]; const open = (h: number) => !g.col.shotBlocked(G, [p[0], h, p[2]], 0.02, PISTOL_ENERGY);
  return low ? open(0.8) || open(1.05) : open(1.3) || open(1.6) || open(0.8);
}
/** the nav search's price for a way that keeps out of his line: floor his gun covers is dear, dearest in front of him; the pair's own reach all but a wall */
function price(g: Game, K: Known): (ix: number, iz: number) => number {
  const n = g.col.nav, near2 = GUNHOLD.nearM * GUNHOLD.nearM;
  return (ix, iz) => {
    const x = (ix + 0.5) * n.cell, z = (iz + 0.5) * n.cell, dx = x - K.sam[0], dz = z - K.sam[2];
    if (dx * dx + dz * dz < near2) return 20;
    const e = expo(g, K, iz * n.W + ix); return e === 2 ? (front(K, [x, 0, z]) ? 8 : 1.4) : e === 1 ? 1.3 : 1;
  };
}
/** a way to `goal` at that price (null = no way); the way's length and the longest unbroken stretch of it across floor Sam's gun covers in front of him */
function wayTo(g: Game, gd: Guard, K: Known, goal: Vec3): { path: Vec3[]; len: number; show: number } | null {
  const path = g.col.nav.findPath(gd.char.pos, goal, 8000, price(g, K)); if (!path || !path.length || flat(path[path.length - 1], goal) > 0.6) return null;
  let len = 0, show = 0, cur = 0, a = gd.char.pos;
  for (const b of path) { const d = flat(a, b), k = Math.max(1, Math.ceil(d / 0.4)); for (let j = 1; j <= k; j++) { const q: Vec3 = [a[0] + (b[0] - a[0]) * j / k, 0, a[2] + (b[2] - a[2]) * j / k]; const i = cellOf(g, q); if (i >= 0 && expo(g, K, i) === 2 && front(K, q)) { cur += d / k; if (cur > show) show = cur; } else cur = 0; } len += d; a = b; }
  return { path, len, show };
}
function take(g: Game, gd: Guard, path: Vec3[], goal: Vec3) { gd.path = g.doors.threadPath(path, gd.char.pos, (x, z) => !g.col.nav.isBlocked(x, z)); gd.pathI = 0; gd.pathGoal = null; gd.repathT = 0;   // (no pathGoal: a man stuck on this way is planned again HERE, at this rule's price — followPath's own second try is the short way, through his line)
  gd.stallRef = null; gd.lineSide = 0; }

// ---------------------------------------------------------------- cover
/** The nearest floor, by walking, where Sam's gun has no line to him (breadth first over the nav cells, no corner cut, ≤ coverM): hidden standing for choice, a
 *  crouch behind low cover else; not inside the pair's reach, not a mate's; for a man going round, the side of the pair he is working toward counts for it.
 *  `edge` = the open cell he came off to get there (where he looks from). null = none in reach. */
function pickCover(g: Game, gd: Guard, S: Standoff, K: Known, st: St, round: boolean): { spot: Vec3; low: boolean; edge: Vec3 | null } | null {
  const n = g.col.nav, W = n.W, c = gd.char; let s = cellOf(g, c.pos); if (s < 0) return null;
  if (n.blocked[s]) { const f = n.nearestFreePoint(c.pos[0], c.pos[2]); if (!f) return null; s = cellOf(g, f); }
  const mates: Vec3[] = [], rivals: Vec3[] = [];   // (rivals: mates of the standoff with no cover of their own yet — a spot nearer one of them is his)
  for (const o of g.guards) { if (o === gd || o.state === 'dead') continue; const os = o.standoff && states.get(o.standoff); if (os?.spot) mates.push(os.spot); else { mates.push(o.char.pos); if (o.standoff && o.standoff.pair === S.pair) rivals.push(o.char.pos); } }
  const d0 = flat(c.pos, K.sam), rear = K.facing + Math.PI, near = GUNHOLD.nearM;
  const came = new Map<number, number>([[s, -1]]); let q = [s], best = -1, bestScore = Infinity, firstD = -1;
  const maxD = Math.ceil(GUNHOLD.coverM / n.cell);
  for (let depth = 1; depth <= maxD && q.length; depth++) {
    const nx: number[] = [];
    for (const cur of q) { const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= n.H) continue;
        const i = z * W + x; if (n.blocked[i] || came.has(i)) continue; if (dx && dz && (n.blocked[cz * W + x] || n.blocked[z * W + cx])) continue;
        const p = centre(g, i); const dS = flat(p, K.sam); if (dS < near && dS < d0) continue;   // (not through the pair's reach — a man inside it may still walk OUT)
        came.set(i, cur); nx.push(i);
        const e = expo(g, K, i); if (e === 2 && front(K, p)) continue;
        if (dS < near + 0.5) continue;
        if (st.bad && flat(p, st.bad) < 0.8) continue;
        let taken = false; for (const m of mates) if (flat(m, p) < 0.9) { taken = true; break; } if (taken) continue;
        let score = depth * n.cell + (e === 1 ? 1 : 0) + (dS < d0 - 1.5 ? 4 : 0);
        // (thin cover — a jamb, the end of a partition: each open neighbour in front of Sam is a step of HIS that uncovers the man; the cell behind it is worth half a metre more)
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + ax, zz = z + az; if (xx < 0 || zz < 0 || xx >= W || zz >= n.H) continue; const j = zz * W + xx; if (!n.blocked[j] && expo(g, K, j) === 2 && front(K, centre(g, j))) score += 0.6; }
        if (e === 2) score += 2.5;   // (open floor at his back: out of the arc he can swing the pistol through without coming about — better than nothing, worse than a wall)
        for (const r of rivals) if (flat(r, p) + 0.5 < flat(c.pos, p)) { score += 3; break; }
        if (round) score += 0.7 * Math.abs(wrapAngle(rear - Math.atan2(p[0] - K.sam[0], p[2] - K.sam[2])));
        if (score < bestScore) { bestScore = score; best = i; } if (firstD < 0) firstD = depth;
      } }
    q = nx; if (firstD >= 0 && depth - firstD >= 6) break;
  }
  if (best < 0) return null;
  let edge: Vec3 | null = null; for (let i = came.get(best) ?? -1, k = 0; i >= 0 && k < 4; i = came.get(i) ?? -1, k++) if (expo(g, K, i) === 2) { edge = centre(g, i); break; }
  return { spot: centre(g, best), low: expo(g, K, best) === 1, edge };
}

// ---------------------------------------------------------------- the way round
/** A way to Sam's back that keeps out of his line: a spot inside the flank line's own reach and arc with a line of fire to him, his own side of the pair first;
 *  three path plans a look at most. Sets his path. false = none this time. */
const AIM_Y = 1.42;   // guards.ts STANDOFF_AIM_Y: the height on Sam a standoff round is laid at
function planRound(g: Game, gd: Guard, S: Standoff, K: Known, st: St): boolean {
  const nav = g.col.nav, rear = K.facing + Math.PI; let plans = 0;
  // (how far he will cross Sam's line on the way: a dash with Sam's back to him, less with the gun turned his way, and next to nothing while it is turned his
  //  way and has just fired — a man who got up from behind his desk into that was shot on his second stride)
  const maxRun = !facesHim(K, gd.char.pos) ? GUNHOLD.dashM : K.shotT >= 0 && g.time - K.shotT < GUNHOLD.shyS ? GUNHOLD.showM * 0.4 : GUNHOLD.showM;
  const mates: Vec3[] = []; for (const o of g.guards) { if (o === gd || o.state === 'dead') continue; const os = o.standoff && states.get(o.standoff); if (os?.goal) mates.push(os.goal); }
  for (const off of [40, 20, 60, 0, -25]) for (const r of [4.2, 3.5, 4.8]) {
    const b = rear - S.side * off * DEG; const p: Vec3 = [K.sam[0] + Math.sin(b) * r, 0, K.sam[2] + Math.cos(b) * r];
    if (nav.isBlocked(p[0], p[2])) continue;
    // (a place he can SHOOT from, asked as guards.ts clearShot will ask it of him stood there: his gun shoulder — either side of the spot — to Sam's chest.
    //  A partition top that a line at eye height clears and one from the shoulder does not sent a man round to stand behind it with no shot.)
    { const sx = Math.cos(b) * 0.22, sz = -Math.sin(b) * 0.22; const to: Vec3 = [K.sam[0], AIM_Y, K.sam[2]]; let shut = false;
      for (const k of [-1, 0, 1]) if (g.col.shotBlocked([p[0] + sx * k, 1.3, p[2] + sz * k], to, 0.02)) { shut = true; break; }
      if (shut) continue; }
    let taken = false; for (const m of mates) if (flat(m, p) < 1.2) { taken = true; break; } if (taken) continue;
    if (++plans > 3) return false;
    const w = wayTo(g, gd, K, p); if (!w) continue;
    if (w.len > GUNHOLD.flankMaxM || w.show > maxRun) { GUNHOLD_DEBUG.log?.(`${gd.callsign} way round to (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): ${w.len.toFixed(1)} m, ${w.show.toFixed(1)} m at a stretch in his line (may ${maxRun}) — no`); continue; }
    take(g, gd, w.path, p); st.goal = p; st.planSam = v3.copy(K.sam); st.planFacing = K.facing;
    GUNHOLD_DEBUG.log?.(`${gd.callsign} goes round to (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): ${w.len.toFixed(1)} m, ${w.show.toFixed(1)} m in his line`);
    return true;
  }
  return false;
}
/** does this man go round, or stay behind his cover in front: a lone man goes; of two or more the man most in front of Sam when the gun came out stays (Sam
 *  cannot face two ways: whichever he turns to, the other has his back), the rest go round, opposite ways where guards.ts pickSide dealt them so */
function goesRound(g: Game, gd: Guard, S: Standoff, K: Known): boolean {
  const men = menOn(g, S.pair); if (men.length <= 1) return true;
  if (!K.talker || !men.includes(K.talker)) { let b = Infinity; K.talker = null; for (const m of men) { const a = Math.abs(wrapAngle(Math.atan2(m.char.pos[0] - K.sam[0], m.char.pos[2] - K.sam[2]) - K.facing)); if (a < b) { b = a; K.talker = m; } } }
  return K.talker !== gd;
}

// ---------------------------------------------------------------- the lines
const LINES = {
  gun: ['gun — he\'s got a gun! get behind something!', 'he\'s armed — cover, get to cover!'],
  shot: ['he\'s shooting — out of his line, move!', 'shots! get off his line — go round him!'],
  round: ['going round him — keep him talking', 'I\'ll get behind him. keep his eyes on you'],
  gone: ['he\'s moved — they\'re not there!'],
};
/** The same four moments from a DEFENDER of a squad mission (teams.ts defenderWords: a hostile unit under the dialogue pass) — a room fight's man who has
 *  left his post (roomfight.ts mode 'free': neither held nor pinned) comes into the standoff like anybody. The man with the pistol is 'he', as in every other
 *  line of the standoff (guards.ts hostageCall, STANDOFF_LINES); the one in his arm is never called theirs — it can be a civilian. A fighting man's news is
 *  not that there is a gun but where it is: in the hold. The two `round` lines read as class 1 ('coming round') on the cue strip, `gone` as no class of its
 *  own. The pick is made where the line is read (gunHoldPool); the one roll of the die is drawn either way. probes.ts words-lint holds all of it. */
export const GUNHOLD_DEFENDER_LINES: Record<keyof typeof LINES, string[]> = {
  gun: ['pistol\'s out behind his shield — get to cover!', 'he\'s drawn from the hold — get behind something!'],
  shot: ['he\'s firing past his shield — off that line, move!', 'rounds from the hold — get off it, go round him!'],
  round: ['going round behind him — keep his eyes on you', 'coming at his back. hold him where he is'],
  gone: ['he\'s moved — nobody where we left them!'],
};
/** The pool a man draws one of the four moments from: a defender's own where the dialogue pass is on, else the staff's. */
export function gunHoldPool(gd: Guard, kind: keyof typeof LINES): string[] { const own = defenderWords(gd) ? GUNHOLD_DEFENDER_LINES[kind] : null; return own && own.length ? own : LINES[kind]; }
function bark(g: Game, gd: Guard, K: Known, kind: keyof typeof LINES, radio = false): boolean {
  if (g.time - K.saidT < 1.5) return false; K.saidT = g.time;
  const pool = gunHoldPool(gd, kind); g.say(gd, pool[Math.floor(simRandom() * pool.length) % pool.length], radio); return true;
}

// ---------------------------------------------------------------- his feet
/** guards.ts standoffAlert, in place of the ring: this man's feet while the pistol is known in the hold. null = the ring as ever (the rule off, the pistol not
 *  known, no cover in reach). Else his move speed, whether his legs have his body (a run: the caller does not turn his chest back to the pair), where he looks
 *  (null = the pair's aim point), how far down he is, and whether he keeps his mouth shut (a man going round says nothing to Sam). `lineOk` = flankShot's ok. */
export function gunHoldFeet(g: Game, gd: Guard, dt: number, P: Pair, S: Standoff, fs: { ok: boolean; rear: number; clear: number }): { move: number; run: boolean; look: Vec3 | null; crouch: number; quiet: boolean } | null {
  if (!live(g)) return null;
  const K = knowns.get(P.key); if (!K) return null;
  const H = g.player.holding;
  if (H) learnShot(g, K, H.shotT, S.seenT === g.time || flat(gd.char.pos, P.sam) < HEAR_M);   // (a round from the hold: known through the men who saw or heard it)
  if (K.gunT < 0) return null;
  const now = g.time, c = gd.char, T = g.tune, stats = gunHoldStats(g);
  let st = states.get(S);
  if (!st) {
    st = { phase: 'react', goT: now + GUNHOLD.react[0] + simRandom() * (GUNHOLD.react[1] - GUNHOLD.react[0]), spot: null, low: false, edge: null, goal: null, planSam: null, planFacing: 0, planT: 0, peekT: 0, peekEnd: -1, peekFrom: 0, checkT: 0, runT: 0, lineT: -1, shownT: 0, retryT: 0, coverBad: false, bad: null, saidRound: false };
    states.set(S, st); S.orbitGoal = null; gd.path = []; gd.pathGoal = null; gd.stallRef = null;
    if (!K.saidGun && bark(g, gd, K, K.shotT >= 0 ? 'shot' : 'gun')) { K.saidGun = true; if (K.shotT >= 0) K.saidShot = true; }
  }
  if (K.shotT >= 0 && !K.saidShot && S.seenT === now && bark(g, gd, K, 'shot')) K.saidShot = true;
  const look: Vec3 = [K.sam[0], P.aim[1], K.sam[2]];
  const stand = () => { gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; gd.stallRef = null; };
  const alongPath = (): Vec3 | null => {   // a run: eyes and gun on where Sam is while the way keeps him anywhere ahead, else up the way
    if (gd.pathI >= gd.path.length) return look;
    const wp = gd.path[gd.pathI]; const yaw = Math.atan2(wp[0] - c.pos[0], wp[2] - c.pos[2]);
    if (S.seenT === now && !front(K, c.pos)) return look;   // (come out at Sam's back with eyes on him: the gun is on him from the first stride, so it is lined up by the time his feet stop)
    return Math.abs(wrapAngle(Math.atan2(look[0] - c.pos[0], look[2] - c.pos[2]) - yaw)) > 75 * DEG ? [c.pos[0] + Math.sin(yaw) * 4, look[1], c.pos[2] + Math.cos(yaw) * 4] : look;
  };
  const low = flinching(g, gd) ? SUPPRESSION.displaceCrouch : 0;
  const hereE = (() => { const i = cellOf(g, c.pos); return i >= 0 ? expo(g, K, i) : 0; })();   // what the floor under him shows Sam's gun: behind something low he moves bent double
  // (the man who stays is the other half of the pincer: when Sam comes about to deal with the man at his back, HIS back is to this one — and he comes up it)
  const round = goesRound(g, gd, S, K) || !front(K, c.pos);
  const out = (move: number, run: boolean, lk: Vec3 | null, crouch: number, quiet: boolean) => ({ move, run, look: lk ?? (S.seenT === now ? null : look), crouch, quiet });   // (not in his eyes this frame: his gun stays on where they were last seen, never on the pair through a wall)

  // his line, at Sam's back: plant on it (the caller's round, if it is free)
  // (the EDGE of the arc is no place to plant: there the line comes and goes frame by frame. A man still on his way to a spot deeper round goes on until he is
  //  well inside it; a man planted keeps his feet — and, guards.ts muzzleCheck, his gun up — through a blink of it.)
  const lineOk = fs.ok && !shown(g, K, c.pos, false);
  const sound = lineOk && (st.phase !== 'flank' || !st.goal || flat(c.pos, st.goal) < 0.8 || fs.rear < (GUNHOLD.rearDeg - 20) * DEG);
  if (sound || (st.phase === 'line' && (lineOk || (now - st.lineT < 0.4 && !facesHim(K, c.pos))))) {
    if (lineOk) st.lineT = now;
    if (st.phase !== 'line') { st.phase = 'line'; stats.lines++; gd.path = []; gd.pathGoal = null; GUNHOLD_DEBUG.log?.(`${gd.callsign} has the line at his back`); }
    stand(); return out(0, false, null, 0, false);
  }
  if (st.phase === 'line') { st.phase = 'plan'; st.planT = 0; }   // (Sam came about, or walked off it)

  if (st.phase === 'react') { if (now < st.goT) { stand(); return out(0, false, null, 0, false); } st.phase = 'plan'; }

  if (st.phase === 'plan') {
    if (now < st.retryT) return null;   // (no cover in reach a moment ago: the ring as ever until the next look for some)
    const open = shown(g, K, c.pos, false);
    if (open && hereE === 1 && !shown(g, K, c.pos, true)) { st.spot = v3.copy(c.pos); st.low = true; st.edge = null; st.phase = 'cover'; st.peekT = now + GUNHOLD.peekEvery * (0.6 + 0.8 * simRandom()); st.checkT = now + 0.5; gd.path = []; gd.pathGoal = null; }   // (something low between them already: down behind it, here)
    else if (open) {
      const cv = pickCover(g, gd, S, K, st, round);
      if (!cv) { stats.noCover++; st.retryT = now + 1.5; GUNHOLD_DEBUG.log?.(`${gd.callsign}: no cover in reach — the ring`); return null; }
      st.spot = cv.spot; st.low = cv.low; st.edge = cv.edge; st.goal = null;
      const w = g.col.nav.findPath(c.pos, cv.spot, 6000, price(g, K));
      take(g, gd, w ?? [v3.copy(cv.spot)], cv.spot); st.phase = 'run'; st.runT = now; stats.ran++;
      GUNHOLD_DEBUG.log?.(`${gd.callsign} runs for cover at (${cv.spot[0].toFixed(1)}, ${cv.spot[2].toFixed(1)})${cv.low ? ' (low)' : ''}, ${flat(c.pos, cv.spot).toFixed(1)} m`);
    } else { st.spot = v3.copy(c.pos); st.low = false; st.edge = null; st.phase = 'cover'; st.peekT = now + GUNHOLD.peekEvery * (0.6 + 0.8 * simRandom()); st.checkT = 0; gd.path = []; gd.pathGoal = null; }
  }

  if (st.phase === 'run') {
    if (!st.spot) { st.phase = 'plan'; stand(); return out(0, false, null, low, false); }
    // The first strides: cover is mostly BEHIND a man who was facing the pair, and followPath will not carry him above a creep until he has come about — most of
    // a second stood in front of the pistol. He sets off at once the way he has to go (backwards, sideways) and turns into it as he runs.
    let scramble = false;
    if (now - st.runT < 1.2 && gd.pathI < gd.path.length) { const wp = gd.path[gd.pathI]; const yawTo = Math.atan2(wp[0] - c.pos[0], wp[2] - c.pos[2]); if (Math.abs(wrapAngle(yawTo - c.bodyYaw)) > 50 * DEG) { scramble = true; c.bodyYaw = approachAngle(c.bodyYaw, yawTo, 5.5 * dt); } }
    const arrived = scramble ? stepAlongPath(g, gd, dt, T.guardChase) : followPath(g, gd, dt, T.guardChase);
    if (arrived) { st.phase = 'cover'; st.peekT = now + GUNHOLD.peekEvery * (0.6 + 0.8 * simRandom()); st.checkT = now + 0.4; st.planT = Math.max(st.planT, now + 0.3); gd.path = []; gd.pathGoal = null; }
    else if (notGettingAnywhere(gd, dt, 1.5)) { st.bad = st.spot; st.spot = null; st.phase = 'plan'; gd.path = []; gd.pathGoal = null; gd.stallRef = null; }
    return out(gd.speed, true, alongPath(), hereE === 1 ? 1 : Math.max(low, 0.35), true);
  }

  if (st.phase === 'cover') {
    // (the walk here stops within a quarter metre of the spot — on the edge of its cell, where cover one cell deep does not reach: the last step onto it)
    const off = st.spot ? flat(c.pos, st.spot) : 0;
    if (st.spot && off > 0.06 && off < 0.6 && dt > 0) { const k = Math.min(1, 1.2 * dt / off); c.vel = [(st.spot[0] - c.pos[0]) * k / dt, 0, (st.spot[2] - c.pos[2]) * k / dt]; c.pos = [c.pos[0] + (st.spot[0] - c.pos[0]) * k, c.pos[1], c.pos[2] + (st.spot[2] - c.pos[2]) * k]; gd.speed = 1.2; gd.stallRef = null; }
    else stand();
    if (now >= st.checkT) {   // twice a second: has Sam walked the pair round his cover
      st.checkT = now + 0.5;
      if (!shown(g, K, c.pos, st.low)) st.coverBad = false;
      else if (st.coverBad) { st.coverBad = false; st.phase = 'plan'; st.bad = null; return out(0, false, null, st.low ? 1 : 0, false); }
      else { st.coverBad = true; st.checkT = now + 0.15; }   // (two looks running, a beat apart: one grazing ray does not send him across the open)
    }
    if (round && now >= st.planT && planned.get(g) !== now) {   // (one man's way round a frame, floor-wide: up to three path searches each)
      planned.set(g, now);
      st.planT = now + (front(K, c.pos) ? 2 : 0.6);   // (Sam's back to him: that does not last — he looks for his way up it at once and often)
      if (planRound(g, gd, S, K, st)) { st.phase = 'flank'; S.cornered = false; stats.rounds++; if (!st.saidRound && bark(g, gd, K, 'round', true)) st.saidRound = true; return out(0, true, alongPath(), 0, true); }
      stats.noWay++; S.cornered = true;
    }
    if (now >= st.peekT && now - K.fixT > GUNHOLD.peekEvery * 0.5 && S.seenT !== now) {   // nobody's eyes on them for a while: a look
      st.peekFrom = now; st.peekEnd = -1; stats.looks++;
      if (st.low || !st.edge) { st.phase = 'peek'; st.peekEnd = now + GUNHOLD.peekSecs * (st.low ? 0.6 : 1); }   // (over the top of something low: a glance)
      else { st.phase = 'peek'; take(g, gd, [v3.copy(st.edge)], st.edge); }
    }
    return out(0, false, null, st.low && front(K, c.pos) ? 1 : 0, false);   // (down behind low cover while Sam's gun can come onto him; his back turned, up — the line may be there from where he is)
  }

  if (st.phase === 'peek') {
    if (st.peekEnd < 0) { const there = followPath(g, gd, dt, T.guardWalk); if (there || notGettingAnywhere(gd, dt, 1.2)) { st.peekEnd = now + GUNHOLD.peekSecs; gd.path = []; gd.pathGoal = null; } }
    else stand();
    const rattled = flinching(g, gd);
    if ((st.peekEnd >= 0 && now >= st.peekEnd) || rattled) {
      // looked, and they are not where they were left (his eye has the place and not the pair): the standoff is lost for everybody
      if (!rattled && S.seenT < st.peekFrom) { const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); if (!g.col.segmentBlocked(eye, [K.sam[0], 1.2, K.sam[2]])) { K.goneT = now; stats.gone++; bark(g, gd, K, 'gone', true); } }
      st.peekT = now + GUNHOLD.peekEvery * (0.6 + 0.8 * simRandom());
      if (st.spot && flat(c.pos, st.spot) > 0.3) { st.phase = 'back'; take(g, gd, [v3.copy(st.spot)], st.spot); } else { st.phase = 'cover'; st.checkT = now + 0.5; }
    }
    return out(gd.speed, false, null, 0, false);
  }

  if (st.phase === 'back') {
    if (!st.spot || followPath(g, gd, dt, T.guardInvestigate) || notGettingAnywhere(gd, dt, 1.2)) { st.phase = 'cover'; st.checkT = now + 0.5; gd.path = []; gd.pathGoal = null; }
    return out(gd.speed, false, null, low, false);
  }

  // 'flank': the way round — bent double behind anything low, at the run across floor his gun has, a jog where it has not; planned again when the pair has moved
  // or come about; a man in the open with the pistol turned on him breaks for cover
  {
    const here = shown(g, K, c.pos, hereE === 1);
    if (here && facesHim(K, c.pos)) st.shownT += dt; else st.shownT = Math.max(0, st.shownT - dt);
    const stale = st.planSam && (flat(st.planSam, K.sam) > 1.2 || Math.abs(wrapAngle(K.facing - st.planFacing)) > 40 * DEG);
    if (st.shownT > 0.3 || (stale && now >= st.planT && planned.get(g) !== now)) {
      planned.set(g, now);
      const caught = st.shownT > 0.3; st.shownT = 0; st.planT = now + 1; st.goal = null;
      if (caught || !planRound(g, gd, S, K, st)) { st.phase = 'plan'; st.bad = null; gd.path = []; gd.pathGoal = null; stand(); return out(0, false, null, low, true); }
    }
    const arrived = followPath(g, gd, dt, here ? T.guardChase : T.guardInvestigate);
    if (arrived || notGettingAnywhere(gd, dt, 2.5)) { st.phase = 'plan'; st.planT = now + 0.5; st.goal = null; gd.path = []; gd.pathGoal = null; gd.stallRef = null; }
    return out(gd.speed, true, alongPath(), hereE === 1 ? 1 : Math.max(low, here ? 0.35 : 0), true);
  }
}

/** Panel / QA: 'gun in the hold ▸ fired · Kowalski: behind cover (low) · Reyes: going round, 6.2 m to go' — empty with nothing to say */
export function gunHoldSummary(g: Game): string {
  const H = g.player.holding, K = H ? knowns.get(H) : undefined; const s = gunHoldStats(g);
  const tail = `${s.ran} ran for cover · ${s.rounds} went round · ${s.lines} lines · ${s.looks} looks`;
  if (!GUNHOLD.on) return `gun in the hold ▸ off`;
  if (!H || !K || K.gunT < 0) return `gun in the hold ▸ — (${tail})`;
  const parts: string[] = [K.shotT >= 0 ? 'he has fired' : 'pistol seen'];
  for (const gd of menOn(g, H.g)) { const st = gd.standoff && states.get(gd.standoff); if (!st) continue;
    const what = st.phase === 'run' ? 'running for cover' : st.phase === 'cover' ? `behind cover${st.low ? ' (low)' : ''}` : st.phase === 'peek' || st.phase === 'back' ? 'taking a look' : st.phase === 'flank' ? `going round${st.goal ? `, ${flat(gd.char.pos, st.goal).toFixed(1)} m off his spot` : ''}` : st.phase === 'line' ? 'on the line at his back' : 'reacting';
    parts.push(`${gd.callsign}: ${what}`); }
  return `gun in the hold ▸ ${parts.join(' · ')} (${tail})`;
}
/** QA: this man's part, by name (null = none) */
export function gunHoldPhase(g: Game, gd: Guard): Phase | null { return partOf(g, gd)?.st.phase ?? null; }
