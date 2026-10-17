// THE NIGHT'S OPENING — nobody of the shift starts the night on top of the way in. A level's routes stand every man on his first waypoint, and on the office
// that put Kowalski at the corridor's west end, a stride from the one arch out of the lobby and four metres from the spawn, standing there for his first
// 2.5 s: a player who pressed W as the card closed was heard at 2.6 s, seen at 3.0 and dead at 4.1 (the missions goal's fault S1: 24 of 24 seeds). The rule:
// on a FRESH encounter that is the player's own (not a show's — a showcase starts the level's men from their marks at t = 0 and orders them from there), a
// staff man whose first waypoint is inside `clearM` of the spawn BY WALKING is put on down his own beat instead — the first point along his route, leg by
// leg, that is at least that far from the spawn — facing the way he walks, his next waypoint the leg's far end: the night found mid-patrol, his back to the
// door he has just walked past. Nothing else of him changes (state, senses, clocks, dice: no draw is made), and nobody further off is touched.
// `OPENING.on` false = every man on his first waypoint, the game exactly as it was (the harness stands up with it off — host/standup.ts, `TPS_OPENING=1`
// turns it on for any harness tool; the page ships it ON, `?fairstart=0` on the URL takes it off for the visit). A module table, read before `new Game`.
// Called from the Game constructor and guards.ts resetGuards (the still view behind the start card, a restart, a checkpoint load — whose own slices then
// place every man where the file says), and by the two roads that make a fresh encounter UNDER a show's flag and drop the flag after (director.ts exitShow,
// attract.ts stop: so the card's still view already has him there). Game.update also calls it once a frame, the net under those: a man is FRESH for
// FRESH_SECS after this module first met his Guard object, show or no show, so an encounter handed over live a frame later (director.ts c.handover — touring
// stays up, `handedOver` says it is the player's) is still placed, and a man met long ago is never moved however he happens to stand.
// NOT covered: the old tour's own hand-over (demo.ts — unreachable from the page), and a spot inside a prop or a shut leaf (the nav grid is the statics').
// QA: tools/qa/opening-check.ts.
import { SideMap, SideSet } from '../math/side';
import type { Game, Guard } from './game';
import { Vec3, v3 } from '../math/vec';

export const OPENING = {
  /** the rule itself; false = the routes' first waypoints, as it always was */
  on: true,
  /** metres by walking from the player's spawn inside which no man of the shift starts the night */
  clearM: 10,
  /** how finely his route is walked looking for the first point that far off */
  stepM: 0.5,
};
/** the page's own `?fairstart=0` (read once, at the first call: a harness has no location) */
let urlRead = false;
function readUrl() {
  urlRead = true;
  try { const s = (globalThis as { location?: { search?: string } }).location?.search; if (s && /[?&]fairstart=(0|off|false)\b/i.test(s)) OPENING.on = false; } catch { /* no location */ }
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the men this module has already looked at (placed, or found not fresh / not in the way): each Guard object once */
const seen = new SideSet<Guard>('opening.seen');
/** game time each Guard object was first met at (under a show's flags too), and how long after it he still counts as fresh (longer than any one frame) */
const born = new SideMap<Guard, number>('opening.born'), FRESH_SECS = 0.25;
/** a route's spot, kept: the level's statics do not move, and a lap wholly inside the radius would otherwise be walked again on every restart */
const spots = new SideMap<object, { key: string; at: { pos: Vec3; yaw: number; wp: number } | null }>('opening.spots');

/** metres by walking a → b over the nav grid (Infinity: no way) */
function wayLen(g: Game, a: Vec3, b: Vec3): number {
  const nav = g.col.nav, p = nav.isBlocked(a[0], a[2]) ? nav.nearestFreePoint(a[0], a[2]) ?? a : a, q = nav.isBlocked(b[0], b[2]) ? nav.nearestFreePoint(b[0], b[2]) ?? b : b;
  const path = nav.findPath(p, q, 8000); if (!path) return Infinity;
  let L = 0, at = p; for (const w of path) { L += flat(at, w); at = w; } return L + flat(at, q);
}

/** where along his route a man who starts inside the clear radius is put, or null (he starts far enough off, or his whole lap is inside it) */
export function openingSpot(g: Game, gd: Guard): { pos: Vec3; yaw: number; wp: number } | null {
  const spawn = g.level.playerSpawn, key = `${OPENING.clearM}|${OPENING.stepM}|${spawn[0]}|${spawn[2]}`, kept = spots.get(gd.route);
  if (kept?.key === key) return kept.at;
  const at = findSpot(g, gd); spots.set(gd.route, { key, at }); return at;
}
function findSpot(g: Game, gd: Guard): { pos: Vec3; yaw: number; wp: number } | null {
  const pts = gd.route.points, n = pts.length, spawn = g.level.playerSpawn;
  if (n < 2 || wayLen(g, spawn, pts[0]) >= OPENING.clearM) return null;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], leg: Vec3[] = [a, ...(g.col.nav.findPath(a, b, 8000) ?? [b])];
    for (let k = 0; k + 1 < leg.length; k++) {
      const p = leg[k], q = leg[k + 1], L = flat(p, q); if (L < 1e-6) continue;
      for (let s = k === 0 && i === 0 ? OPENING.stepM : 0; s <= L; s += OPENING.stepM) {
        const at: Vec3 = [p[0] + (q[0] - p[0]) * s / L, 0, p[2] + (q[2] - p[2]) * s / L];
        if (g.col.nav.isBlocked(at[0], at[2])) continue;
        const far = wayLen(g, spawn, at); if (!Number.isFinite(far) || far < OPENING.clearM) continue;   // (no way found = not known to be clear: on to the next point)
        return { pos: at, yaw: v3.yawTo(p, q), wp: (i + 1) % n };
      }
    }
  }
  return null;
}

/** Put the fresh shift on for the player's night (see the head). Idempotent: each man is looked at once. Returns how many were moved now. */
export function openingStart(g: Game): number {
  if (!urlRead) readUrl();
  const show = g.quietUtility || (g.touring && !g.director?.handedOver);   // a show's own encounter (its men start from their marks) — not one it has handed to the player
  let moved = 0;
  for (const gd of g.guards) {
    if (seen.has(gd) || gd.unit || gd.team !== 'guard' || gd.routeI < 0) continue;
    if (!born.has(gd)) born.set(gd, g.time);
    if (!OPENING.on || show) continue;
    seen.add(gd);
    if (g.time - born.get(gd)! > FRESH_SECS || gd.state !== 'patrol' || gd.wp !== 0 || gd.hold || gd.script || flat(gd.char.pos, gd.route.points[0]) > 0.6) continue;   // not fresh: a man already on his beat is where the night put him
    const at = openingSpot(g, gd); if (!at) continue;
    const c = gd.char;
    c.pos = v3.copy(at.pos); c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = at.yaw; gd.lastPos = v3.copy(at.pos);
    gd.wp = at.wp; gd.wait = 0; gd.path = []; gd.pathI = 0; gd.pathGoal = null;
    c.update(0);   // (bones where he now stands, before anything reads them this frame)
    moved++;
  }
  return moved;
}
