// A SPOT THAT FITS THE ROOM (ROOMFIT, __game.orders 'move') — where each man stands, and what he watches, when Sam sends the squad to a spot.
// the maintainer, 10-10, a picture of three men shoulder to shoulder in the middle of an office, all looking the way Sam had pointed: "when squad is ordered to a spot,
// they should go there but their positions should roughly "make sense" for the room, where the doors are, what's cleared and what isn't, etc."
// 'move there' was a line abreast across the way Sam faced the point (orders.ts spotsAt), every man facing that same way and nobody named anything to watch.
//
//   WHAT THERE IS TO WATCH   the room read's ways out of the space the point is in (roomread.ts: its doors, leafless gaps, passage mouths) and, where the floor
//                 runs on a long way with no such line across it (a hall's length, a wide archway), that stretch of floor itself. Each is weighed: the nearer
//                 the heavier; floor the team has NOT stood on beyond it counts in full and known floor a third (cleared.ts — the way they came is still
//                 somebody's, after everything nobody has looked at); a shut leaf less than an open way, a locked one least; what lies the way Sam pointed a
//                 little more than what lies behind.
//   WHO WATCHES WHAT   the heaviest things first, one man each, never two men on one while another goes unwatched (a second gun on an uncleared way comes
//                 after every way has its first). A man with nothing left to take looks down the longest clear run nobody else is on.
//   WHERE HE STANDS   on floor of that same space within a few steps of the point (ROOMFIT.spread: the more men, the wider), and of that floor the place
//                 that is best for his job: a line to what he watches; OUT of the funnel of every way in (the strip a man coming through it shoots straight
//                 down) and at an angle to his own; a wall or a desk at his back before open floor; a body's room and more from every mate; nobody in his
//                 line and he in nobody's; never in a frame or where a leaf swings; and no further from the point than those are worth. One man alone goes
//                 onto the point itself, as he always did, and takes the heaviest thing he can see from it.
//   ON THE WALK   nothing changes: gun up and leading, as 'move' always had it. He takes up his watch over the last steps onto his mark (ROOMFIT.watchInM);
//                 he is 'in position' — and 'set.' is called — when his FEET are on it, as it always was (a man the fight has, or with a friend in his line,
//                 is not kept 'moving' for his gun).
//   WHILE THEY STAND   a man whose way has since become known floor (Sam went through it) moves his GUN — never his feet — to a heavier thing no mate is
//                 on, if he has a line to it from where he stands (asked once a second, and weighed again only when a room has become known, a leaf of
//                 the space has moved, or a mate's deal has come or gone).
//
// The seam is three lines of orders.ts's 'move' (issue hands each man a Fit; tick calls fitTick). ROOMFIT.on false (?noroomfit): fitSpots answers null and the
// order is the line abreast, frame for frame. Nothing here draws dice, reads the camera or the renderer, or keeps state outside the man's own Assignment
// (orders are in no checkpoint, so neither is this). (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { Vec3, v3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Assignment } from './orders';
import { doorWords } from './orders';
import { WORDS } from './words';
import { watchedPlace } from './dialogue';
import { roomRead, type RoomRead, type RoomWay } from './roomread';
import { doorwayInWay } from './doorway';

/** The knobs (no panel rows: ?noroomfit for a visit, the table by name from the console / a play-through's --set — it is in knobs.ts's registry). */
export const ROOMFIT = {
  /** off = 'move there' is the line abreast across Sam's facing it always was, every man facing that way */
  on: true,
  /** the floor the men may take: within `spread0 + spreadPer × men` metres of the point (two men 2.2, four 3.2) */
  spread0: 1.2, spreadPer: 0.5,
  /** no two marks nearer than `apart` · under `loose` costs `looseK` a metre */
  apart: 1.1, loose: 1.7, looseK: 0.8,
  /** a metre further from the point than `nearFree` costs this */
  nearK: 0.35, nearFree: 0.4,
  /** a wall or furniture at his back · and at a shoulder as well */
  wallK: 0.45, cornerK: 0.15,
  /** THE FUNNEL of a way in: `funnelM` deep, the way's own width plus `funnelPad` a side, widening `funnelFlare` a metre · what standing in one costs (his own
   *  way's: `ownK` of it; a way onto known floor: `knownFunnelK` of it; behind a shut leaf: `shutFunnelK` of it) */
  funnelM: 4.5, funnelPad: 0.3, funnelFlare: 0.12, funnelK: 1.6, ownK: 0.7, knownFunnelK: 0.4, shutFunnelK: 0.6,
  /** the angle he takes on his own way, off its centre line: full marks between these (degrees), none square on or past `angMax` */
  angK: 0.5, angLo: 18, angHi: 60, angMax: 85,
  /** nearer his own way than this costs `closeK` a metre */
  closeM: 1.6, closeK: 0.8,
  /** a mate within this of the line from a man to what he watches */
  laneM: 0.7, laneK: 4.0,
  /** the weights: a way further than `reach` is nobody's · the nearer the heavier (`nearM`: where it has halved) · known floor beyond · a shut leaf · a locked
   *  one · how much the way Sam pointed adds in front and takes off behind · a second gun on an uncleared way */
  reach: 10, nearM: 4, knownK: 0.35, shutK: 0.7, lockedK: 0.3, frontK: 0.25, secondK: 0.3,
  /** open floor running on at least `sectorM` with no way's line across it is a thing to watch: little at that length (a room's own far wall), `sectorK` of a
   *  way by a hall's (7.5 m more) · no nearer a way's bearing than `sectorDeg` — a way that FACES back up the run by at least `sectorAcross` (the cosine; 0 =
   *  any way near the bearing, as it first shipped: a hall with doors down its sides then had nobody on its length) · the gun is put `sectorLook` metres down it at most ·
   *  a run past `sectorFarM` in a room the team has stood in counts `sectorFarK`, not `knownK`: standing in a hall's near end says little of its far one (`knownK`'s 0.35 = as it first shipped) */
  sectorM: 5, sectorK: 0.55, sectorDeg: 35, sectorAcross: 0.5, sectorLook: 6, sectorFarM: 10, sectorFarK: 0.7,
  /** he takes up his watch this near his mark */
  watchInM: 1.5,
  /** a standing man looks again this often (s) · and changes only for something this much heavier */
  againSecs: 1.0, sticky: 1.3,
};
/** how often a deal put a man off the point · gave a man a way to watch · gave him a stretch of floor · left him looking the way Sam pointed · a standing
 *  man's gun moved on to something heavier */
export const ROOMFIT_STATS = { deals: 0, way: 0, sector: 0, plain: 0, moved: 0 };

/** One man's place and watch. `at`: the point the order named · `on`: he has taken his watch up (fitTick) · `key`: what he watches, by name (a way's id, a
 *  stretch of floor's bearing from the point) · `w`: its weight when dealt · `front`: the way Sam pointed · `nextT`: when he looks again · `sig`: what the
 *  weights hung on the last time he weighed them (fitTick). */
export interface Fit { at: Vec3; pos: Vec3; watch: Vec3 | null; face: number; words: string; key: string | null; w: number; front: number; on: boolean; nextT: number; sig: string }
interface Threat { at: Vec3; w: number; way: RoomWay | null; key: string; words: string }

const EYE = 1.55, CHEST = 1.1, DEG = Math.PI / 180;
const flat = v3.distXZ, yawTo = v3.yawTo;
const COMPASS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];   // yaw 0 = +z = south (orders.ts)
const compass = (yaw: number) => COMPASS[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8];
/** a row's words for a watch that is no door's (words.ts: the place watched by the level's own name, else what it is — never a bearing; off = the bearing, as it was) */
const wayWords = (g: Game, at: Vec3, to: Vec3, yaw: number) => { if (!WORDS.on) return `on the way ${compass(yaw)}`; const p = watchedPlace(g.level, at, to); return p ? `on the way to ${p}` : 'on the opening'; };
const runWords = (g: Game, at: Vec3, to: Vec3, yaw: number) => { if (!WORDS.on) return `watching ${compass(yaw)}`; const p = watchedPlace(g.level, at, to); return p ? `watching ${p}` : 'watching the far end'; };
/** how far `p` is from the stretch a → b, in plan — and only between its ends (a man behind the gun is in nobody's line) */
function offLine(p: Vec3, a: Vec3, b: Vec3): number {
  const bx = b[0] - a[0], bz = b[2] - a[2], L2 = bx * bx + bz * bz; if (L2 < 1e-6) return Infinity;
  const k = ((p[0] - a[0]) * bx + (p[2] - a[2]) * bz) / L2; if (k < 0.08 || k > 1) return Infinity;
  return Math.hypot(a[0] + bx * k - p[0], a[2] + bz * k - p[2]);
}

/** what there is to watch from the space round `at`, heaviest first (`front`: the way Sam pointed) */
function threatsOf(g: Game, R: RoomRead, at: Vec3, front: number, reach = ROOMFIT.reach): Threat[] {
  const K = ROOMFIT, out: Threat[] = [];
  const frontOf = (yaw: number) => 1 + K.frontK * Math.cos(wrapAngle(yaw - front));
  for (const W of R.ways) {
    if (W.dist > reach) continue;
    const yaw = yawTo(at, W.o.at);
    const w = K.nearM / (K.nearM + W.dist) * (W.farKnown ? K.knownK : 1) * (W.shut ? K.shutK : 1) * (W.locked ? K.lockedK : 1) * (W.dist > 0.5 ? frontOf(yaw) : 1);
    out.push({ at: [W.o.at[0], CHEST, W.o.at[2]], w, way: W, key: W.o.id, words: W.o.door ? `on the ${doorWords(W.o.door)}` : wayWords(g, at, W.beyond, yaw) });
  }
  // floor that runs on: the bearings from the point a man sees furthest along, where no way's line already stands for them
  const B = 24, step = 2 * Math.PI / B, eye: Vec3 = [at[0], EYE, at[2]], run: number[] = [];
  for (let b = 0; b < B; b++) { const hit = g.col.raycast(eye, [Math.sin(b * step), 0, Math.cos(b * step)], 14); run.push(hit ? hit.t : 14); }
  const sm = (b: number) => (run[(b + B - 1) % B] + 2 * run[b] + run[(b + 1) % B]) / 4;
  for (let b = 0; b < B; b++) {
    const t = run[b]; if (t < K.sectorM || sm(b) < sm((b + 1) % B) || sm(b) <= sm((b + B - 1) % B)) continue;   // (a peak of the smoothed run)
    const yaw = wrapAngle(b * step);
    if (R.ways.some(W => W.dist < t + 0.5 && Math.abs(wrapAngle(yawTo(at, W.o.at) - yaw)) < K.sectorDeg * DEG && (!K.sectorAcross || -(W.inN[0] * Math.sin(yaw) + W.inN[1] * Math.cos(yaw)) > K.sectorAcross))) continue;   // (a way stands for the run only where it lies ACROSS it: a door in a hall's side wall is near the hall's bearing and says nothing of its length)
    if (out.some(o => !o.way && Math.abs(wrapAngle(yawTo(at, o.at) - yaw)) < K.sectorDeg * DEG)) continue;
    const look = Math.min(t - 0.6, K.sectorLook), p: Vec3 = [at[0] + Math.sin(yaw) * look, CHEST, at[2] + Math.cos(yaw) * look];
    const far: Vec3 = [at[0] + Math.sin(yaw) * (t - 0.8), 0, at[2] + Math.cos(yaw) * (t - 0.8)];
    out.push({ at: p, w: K.sectorK * Math.min(1, (t - K.sectorM + 1.5) / 9) * (g.cleared.knownAt(far) ? (t > K.sectorFarM ? K.sectorFarK : K.knownK) : 1) * frontOf(yaw), way: null, key: `floor:${b}@${at[0].toFixed(1)},${at[2].toFixed(1)}`, words: runWords(g, at, far, yaw) });
  }
  return out.sort((a, b) => b.w - a.w || (a.key < b.key ? -1 : 1));
}
/** has a man stood at `q` a line to it: a door, to just short of its frame and — its leaf standing open — on into the doorway itself (a man behind the open
 *  leaf watches the back of a door); anything else, to the point */
function sees(g: Game, q: Vec3, T: Threat): boolean {
  const eye: Vec3 = [q[0], EYE, q[2]], d = flat(q, T.at); if (d < 0.3) return true;
  const door = T.way?.o.door ?? null, k = door ? Math.max(0, 1 - 0.7 / d) : Math.max(0, 1 - 0.3 / d);
  if (g.col.segmentBlocked(eye, [q[0] + (T.at[0] - q[0]) * k, CHEST, q[2] + (T.at[2] - q[2]) * k])) return false;
  return !(door && !door.off && Math.abs(door.angle) >= 0.5 && g.col.segmentBlocked(eye, T.at));
}
/** One thing a man could have his gun on from where he stands: where, how heavy, its name, its bearing from him, how far, and whether it is a way (a door's
 *  frame, an opening) or a run of floor. */
export interface Watchable { at: Vec3; w: number; key: string; yaw: number; dist: number; way: boolean }
/** WHAT A MAN STOOD AT `p` WITH HIS EYES SPARE COULD WATCH, heaviest first (cover.ts's rear man at a mark with no door: COVER.rearRead): the read 'move there'
 *  weighs its watches by, asked of one standing man out to `reach` — the ways out of the floor he is on and the long runs of it, each only where he has a
 *  line to it, it is not under his feet, and nobody of `bodies` stands in the line. `front`: the bearing things weigh a little heavier on (the way his back
 *  is to what his order watches). Reads the level, the doors and the rooms the team knows; no dice, nothing kept. */
export function watchablesAt(g: Game, p: Vec3, front: number, reach: number, bodies: readonly Vec3[]): Watchable[] {
  const K = ROOMFIT, at: Vec3 = [p[0], 0, p[2]], R = roomRead(g, at, reach, at), out: Watchable[] = [];
  for (const T of threatsOf(g, R, at, front, reach)) {
    const dist = flat(at, T.at); if (dist <= 1 || !sees(g, at, T) || bodies.some(b => offLine(b, at, T.at) < K.laneM)) continue;
    out.push({ at: T.at, w: T.w, key: T.key, yaw: yawTo(at, T.at), dist, way: !!T.way });
  }
  return out;
}
/** is `q` in the funnel of this way, on the space's own face of it */
function inFunnel(q: Vec3, W: RoomWay): boolean {
  const K = ROOMFIT, x = q[0] - W.o.at[0], z = q[2] - W.o.at[2], dn = x * W.inN[0] + z * W.inN[1]; if (dn < -0.2 || dn > K.funnelM) return false;
  return Math.abs(x * W.inN[1] - z * W.inN[0]) < W.o.half + K.funnelPad + K.funnelFlare * Math.max(0, dn);
}

/** THE DEAL: a place and a watch for each of `n` men sent to `at` — `front`: the way Sam pointed (his yaw to the point) · `from`: where he gave it from ·
 *  `bodies`: where anybody the order does not move stands (their room is kept) · `held`: what those men already watch under a deal of their own, by key (a
 *  gun on one of those is a second gun). null: the rule is off, or there is no floor there to deal. */
export function fitSpots(g: Game, at: Vec3, n: number, front: number, from: Vec3, bodies: Vec3[] = [], held: readonly string[] = []): Fit[] | null {
  const K = ROOMFIT; if (!K.on || n < 1) return null;
  const nav = g.col.nav, cs = nav.cell, R = roomRead(g, at, K.reach, from); if (!R.cells.length) return null;
  const T = threatsOf(g, R, at, front);
  const mk = (pos: Vec3, t: Threat | null): Fit => ({ at: v3.copy(at), pos, watch: t ? v3.copy(t.at) : null, face: t ? yawTo(pos, t.at) : front, words: t ? t.words : '', key: t ? t.key : null, w: t ? t.w : 0, front, on: false, nextT: 0, sig: '' });
  ROOMFIT_STATS.deals++;
  const count = (F: Fit[]) => { for (const f of F) { if (!f.key) ROOMFIT_STATS.plain++; else if (f.key.startsWith('floor:')) ROOMFIT_STATS.sector++; else ROOMFIT_STATS.way++; } return F; };
  if (n === 1) return count([mk(v3.copy(at), T.find(t => !held.includes(t.key) && flat(at, t.at) > 1 && sees(g, at, t) && !bodies.some(b => offLine(b, at, t.at) < K.laneM)) ?? null)]);   // (one man: onto the point itself, on the heaviest thing he sees from it that is not under his feet, nor a mate's already)
  // the floor they may take: the space's cells a short walk and a short way from the point, in plain view of it, off every frame and every leaf's swing, clear of the
  // furniture that can be shoved
  const spread = K.spread0 + K.spreadPer * n, C: Vec3[] = [];
  const clear = (q: Vec3) => !g.props.props.some(pr => { const dx = q[0] - pr.x, dz = q[2] - pr.z, c = Math.cos(pr.yaw), sn = Math.sin(pr.yaw);   // (a chair where it stands NOW: he would lean on it for good)
    return Math.hypot(Math.max(0, Math.abs(c * dx - sn * dz) - pr.hx), Math.max(0, Math.abs(sn * dx + c * dz) - pr.hz)) < 0.3; });
  const okAt = !nav.isBlocked(at[0], at[2]) && !doorwayInWay(g, at) && clear(at); if (okAt) C.push([at[0], 0, at[2]]);
  for (const c of R.cells) { if (R.steps.get(c)! * cs > spread * 1.5 + 1) break;
    const q: Vec3 = [(c % nav.W + 0.5) * cs, 0, (((c / nav.W) | 0) + 0.5) * cs]; if (flat(q, at) > spread || (okAt && flat(q, at) < 0.3)) continue;
    if (doorwayInWay(g, q) || !clear(q) || g.col.solidBlocked([at[0], 1.3, at[2]], [q[0], 1.3, q[2]])) continue;
    C.push(q); }
  if (C.length < n) return null;
  // the jobs: every thing to watch once, heaviest first; then a second gun on the uncleared ways; then nothing (the longest clear run nobody is on)
  const jobs: (Threat | null)[] = T.filter(t => !held.includes(t.key));
  for (const t of T) if (t.way && !t.way.farKnown && !t.way.locked) jobs.push({ ...t, w: t.w * K.secondK });   // (T is heaviest first: so are its second guns, after it)
  for (const t of T) if (held.includes(t.key) && !jobs.some(j => j!.key === t.key)) jobs.push(t);   // (… and last, what a man outside this order has and no second gun was owed)
  jobs.length = Math.min(jobs.length, n); while (jobs.length < n) jobs.push(null);
  const wallAt = (q: Vec3, yaw: number, d: number) => nav.isBlocked(q[0] + Math.sin(yaw) * d, q[2] + Math.cos(yaw) * d);
  const score = (q: Vec3, t: Threat | null, others: (Fit | null)[]): number => {
    let s0 = 0;
    for (const b of bodies) { if (flat(b, q) < K.apart * 0.8) return -Infinity; if (t && offLine(b, q, t.at) < K.laneM) s0 -= K.laneK; }
    let s = s0 - K.nearK * Math.max(0, flat(q, at) - K.nearFree);
    for (const o of others) { if (!o) continue; const d = flat(o.pos, q); if (d < K.apart) return -Infinity; if (d < K.loose) s -= (K.loose - d) * K.looseK;
      if (o.watch && offLine(q, o.pos, o.watch) < K.laneM) s -= K.laneK;
      if (t && offLine(o.pos, q, t.at) < K.laneM) s -= K.laneK; }
    for (const W of R.ways) if (inFunnel(q, W)) s -= K.funnelK * (t?.way === W ? K.ownK : 1) * (W.farKnown ? K.knownFunnelK : 1) * (W.shut ? K.shutFunnelK : 1);
    const yaw = t ? yawTo(q, t.at) : front, back = yaw + Math.PI;
    if (wallAt(q, back, 0.55) || wallAt(q, back, 0.9)) { s += K.wallK; if (wallAt(q, yaw + Math.PI / 2, 0.55) || wallAt(q, yaw - Math.PI / 2, 0.55)) s += K.cornerK; }
    if (t) {
      const d = flat(q, t.at); if (d < K.closeM) s -= (K.closeM - d) * K.closeK;
      if (t.way) { const W = t.way, x = q[0] - W.o.at[0], z = q[2] - W.o.at[2], dn = x * W.inN[0] + z * W.inN[1], a = Math.acos(Math.max(-1, Math.min(1, dn / Math.max(1e-3, Math.hypot(x, z))))) / DEG;
        s += K.angK * (a < K.angLo ? a / K.angLo : a <= K.angHi ? 1 : a < K.angMax ? (K.angMax - a) / (K.angMax - K.angHi) : 0); }
    }
    return s;
  };
  const out: (Fit | null)[] = jobs.map(() => null);
  const pick = (i: number): Fit | null => { const t = jobs[i], others = out.filter((_, j) => j !== i); let best: Vec3 | null = null, bs = -Infinity;
    for (const q of C) { if (t && !sees(g, q, t)) continue; const s = score(q, t, others); if (s > bs) { bs = s; best = q; } }
    return best ? mk(best, t) : null; };
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) {
    let f = pick(i); if (!f && jobs[i] && !out[i]) { jobs[i] = null; f = pick(i); }   // (nowhere to see it from: he is a spare man — only a man with no place yet gives a job up; crowded off it on a later pass he keeps the place he had)
    if (!f && !out[i]) return null;   // (no floor left for him: the line abreast has its own way of finding some)
    if (f) out[i] = f; }
  const fits = out as Fit[];
  // a man with nothing to watch: the longest clear run from his mark that no mate's gun is on — the way Sam pointed among equals — else that way itself
  for (const f of fits) { if (f.key) continue; const t = spareRun(g, f.pos, front, fits.filter(o => o !== f)); if (t) { f.watch = t.at; f.face = yawTo(f.pos, t.at); f.words = t.words; f.key = t.key; f.w = t.w; } }
  return count(fits);
}
/** the longest clear run from `q` at eye height that is `sectorDeg` clear of every mate's gun (null: walls all round, or every run is somebody's) */
function spareRun(g: Game, q: Vec3, front: number, mates: Fit[]): Threat | null {
  const K = ROOMFIT, B = 16, step = 2 * Math.PI / B, eye: Vec3 = [q[0], EYE, q[2]]; let best: Threat | null = null;
  for (let b = 0; b < B; b++) { const yaw = wrapAngle(front + b * step), hit = g.col.raycast(eye, [Math.sin(yaw), 0, Math.cos(yaw)], 12), t = hit ? hit.t : 12; if (t < 2.2) continue;
    const gap = Math.min(Math.PI, ...mates.map(m => Math.abs(wrapAngle((m.watch ? yawTo(m.pos, m.watch) : m.face) - yaw))));
    const look = Math.min(t - 0.6, K.sectorLook), p: Vec3 = [q[0] + Math.sin(yaw) * look, CHEST, q[2] + Math.cos(yaw) * look];
    if (mates.some(m => offLine(m.pos, q, p) < K.laneM)) continue;
    const w = 0.1 * Math.min(1, t / 10) * (gap < K.sectorDeg * DEG ? 0.2 : gap < 2 * K.sectorDeg * DEG ? 0.7 : 1) * (1 + K.frontK * Math.cos(b * step));
    if (!best || w > best.w + 1e-9) best = { at: p, w, way: null, key: `run:${b}@${q[0].toFixed(1)},${q[2].toFixed(1)}`, words: runWords(g, q, [q[0] + Math.sin(yaw) * (t - 0.8), 0, q[2] + Math.cos(yaw) * (t - 0.8)], yaw) }; }
  return best;
}
/** which spots are one pair's (orders.ts pair(): a pair of the squad is kept on two marks of one group): the two nearest one another, then the rest */
export function fitGroups(fits: Fit[]): number[] {
  const n = fits.length; if (n < 3) return fits.map(() => 0);
  let a = 0, b = 1, bd = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = flat(fits[i].pos, fits[j].pos); if (d < bd) { bd = d; a = i; b = j; } }
  if (n === 4) { const l = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]].map(l => ({ l, d: flat(fits[l[0]].pos, fits[l[1]].pos) + flat(fits[l[2]].pos, fits[l[3]].pos) })).sort((x, y) => x.d - y.d)[0].l;
    return fits.map((_, i) => (i === l[0] || i === l[1] ? 0 : 1)); }
  return fits.map((_, i) => (i === a || i === b ? 0 : 1));
}

function take(A: Assignment, F: Fit) {
  A.watch = F.watch ? v3.copy(F.watch) : null; A.face = F.watch && A.post ? yawTo(A.post, F.watch) : F.face; A.there = F.words ? `in position · ${F.words}` : 'in position';
}
/** Once a frame for each man under 'move' (orders.ts, before he is posed): he takes his watch up over the last steps onto his mark; standing, he looks
 *  again once a second — his gun moves on, his feet never — when what he watches has become known floor and something heavier is nobody's. */
export function fitTick(g: Game, gd: Guard, A: Assignment) {
  const K = ROOMFIT, F = A.fit; if (!F || !A.post) return;
  if (A.there === 'stopped short') { A.fit = undefined; return; }   // (orders.ts: he could not get there, and says so — the deal was for a mark he never reached)
  if (!K.on) { if (F.on) { A.watch = null; A.face = F.front; A.there = 'in position'; } A.fit = undefined; return; }
  const p = gd.char.pos;
  if (!F.on) { if (flat(p, A.post) > K.watchInM || g.col.solidBlocked([p[0], 1.3, p[2]], [A.post[0], 1.3, A.post[2]])) return;
    F.on = true; F.nextT = g.time + K.againSecs * (1 + (gd.char.id % 4) * 0.25); take(A, F); return; }
  if (g.time < F.nextT || !A.arrived) return;
  F.nextT = g.time + K.againSecs;
  // what the weights hang on: the rooms known, the leaves, who else holds a deal — nothing of it changed, nothing to weigh
  const mates: { pos: Vec3; F: Fit }[] = []; for (const m of g.orders.men()) { if (m === gd) continue; const B = g.orders.of(m); if (B?.fit && B.post) mates.push({ pos: B.post, F: B.fit }); }
  let sig = `${g.cleared.known}|${mates.map(m => m.F.key ?? '-').join()}|`; for (const d of g.doors.list) sig += d.off ? 'x' : d.latched ? (d.locked ? 'l' : 's') : String(Math.round(d.angle * 4));
  if (sig === F.sig) return; F.sig = sig;
  const R = roomRead(g, F.at, K.reach, A.post), T = threatsOf(g, R, F.at, F.front);   // (from the point the order named: the same things, by the same names, as the deal weighed)
  const mine = T.find(t => t.key === F.key), cur = mine ? mine.w : F.key && /^(floor|run):/.test(F.key) ? F.w : 0;   // (a stretch of floor whose bearing a swinging leaf has shifted by one is still his, at what it weighed)
  if (mine) F.w = mine.w;
  for (const t of T) {   // (heaviest first)
    if (t.w <= cur * K.sticky + 0.02) break;
    if (t.key === F.key || mates.some(m => m.F.key === t.key) || !sees(g, A.post, t)) continue;
    if (mates.some(m => offLine(m.pos, A.post!, t.at) < K.laneM)) continue;
    F.watch = v3.copy(t.at); F.words = t.words; F.key = t.key; F.w = t.w; take(A, F); ROOMFIT_STATS.moved++; return;
  }
}
