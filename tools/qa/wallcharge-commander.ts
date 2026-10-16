// PT_WALL=1 — the scripted commander (playthrough.ts) takes a held room BY A WALL CHARGE where a partition allows it (src/game/wallcharge.ts): a place on a
// partition of that room with free floor on the team's side that is not itself a held room, room to stand off, and a walk to it; Sam stands a few metres back,
// gathers the team, gives 'breach with a charge' on the wall (the menu's row, by its id), waits for 'stood off. your call.', blows it, lets the entry run, walks
// in through the hole and gathers them. One wall a room; a room with no such partition — or a refusal, or no charge left — is taken by its door as ever
// (wallEntry returns false and workDoor goes on). A wall more than PT_WALLFAR (4) metres further to walk than the room's nearest door is left for the door.
// PT_WALLFROM=room: a wall is used only from inside a room that is not held (room to room), never from open floor.
// PT_WALLOUTER=1: the building's OUTER walls count too (WALLCHARGE.outer: a shell wall with the open sky over one face) — a room is entered from the yard
// through its outside wall where that is the shorter walk. Unset: partitions only, every older tally as it was. Needs WALLCHARGE.outer (the shipped stand, or
// TPS_OUTERWALL=1 on the frozen one): without it no shell wall is a candidate and the flag does nothing.
// PT_WALLDBG=1: says why no wall site was found for a room (the counts per rule), and for a refused order where each man stood and every mark, safe and old.
// PT_WALLSET='{"holdLate":false}' sets the module's own knobs (WALLCHARGE) for an A/B. Off (the env flag absent) this file is never imported.
// The module only runs under the destruction's switch: PT_WALL=1 wants PT_DESTR=1 (without it every order here is refused and the run is the door's).
import { ROOT } from './headless.ts';
const { wallAt, wallPt, wallOff, wallChargeOn, outerWall, WALL_ORDER, WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
if (process.env.PT_WALLSET) Object.assign(WALLCHARGE, JSON.parse(process.env.PT_WALLSET));   // (the module's own knobs for an A/B: PT_WALLSET='{"doors":false}')

type Vec3 = [number, number, number];
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const OUTER = process.env.PT_WALLOUTER === '1', FAR = Number(process.env.PT_WALLFAR ?? 4), FROM_ROOM = process.env.PT_WALLFROM === 'room', HURRY = !!process.env.PT_HURRY, SIT = Number(process.env.PT_SIT ?? 0) || 0, PAUSE = Number(process.env.PT_PAUSE ?? 0) || 0, DIRECT = !!process.env.PT_DIRECT;

/** what the wall charge did in one run (RunOut.wall) */
export interface WallTally { sites: number; none: number; far: number; tried: number; refused: string[]; unset: number; /** the kit had set the carried count to 0 at the first wall try (this commander then carries one) */ kit0: number; blown: number; holes: number; entries: number; knocked: number; stunned: number; backblast: number; secs: number[] }
const tallies = new WeakMap<object, WallTally>(), done = new WeakMap<object, Set<any>>();
const tallyOf = (P: any): WallTally => { let t = tallies.get(P); if (!t) tallies.set(P, t = { sites: 0, none: 0, far: 0, tried: 0, refused: [], unset: 0, kit0: 0, blown: 0, holes: 0, entries: 0, knocked: 0, stunned: 0, backblast: 0, secs: [] }); return t; };
export function wallTally(P: any): WallTally { const t = tallyOf(P), s = P.g.wallCharge.stats; return { ...t, holes: s.holes, entries: s.entries, knocked: s.knocked, stunned: s.stunned, backblast: s.backblast }; }

/** the place on a partition to take `room` by: the nearest on foot whose far side is that room's floor and whose near side is floor of no held room */
function site(P: any, room: any, held: Set<any>): { W: any; mid: Vec3; near: Vec3; L: number } | null {
  const g = P.g, C = g.wallCharge, F = g.fight, nav = g.col.nav, free = (p: number[]) => !nav.isBlocked(p[0], p[2]); let best: { W: any; mid: Vec3; near: Vec3; L: number } | null = null; const why = { floor: 0, notRoom: 0, nearHeld: 0, door: 0, wall: 0, standoff: 0, walk: 0 };
  const cand: { id: number; box: any }[] = g.destr.walls.all().filter((w: any) => w.kind === 'wall');
  if (OUTER) { const seen = new Set(cand.map(w => w.id)), boxes = g.col.boxes, n = Math.min(g.destr.walls.authored, boxes.length);   // (PT_WALLOUTER=1: shell walls the charge cuts, asked of the module's own rule)
    for (let i = 0; i < n; i++) { const b = boxes[i]; if (seen.has(i) || b.rot || b.c[1] - b.h[1] > 0.05 || b.h[1] < 1.0 || Math.min(b.h[0], b.h[2]) > 0.14 || Math.max(b.h[0], b.h[2]) < 0.75) continue; if (outerWall(g, i)) cand.push({ id: i, box: b }); } }
  for (const w of cand) { const b = w.box, alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2], T = alongX ? b.h[2] : b.h[0]; if (L < 0.9) continue;
    for (let u = -L + 0.75; u <= L - 0.75 + 1e-6; u += 0.5) for (const side of [1, -1]) {
      const mid: Vec3 = alongX ? [b.c[0] + u, 1.05, b.c[2]] : [b.c[0], 1.05, b.c[2] + u], off = (d: number): Vec3 => { const k = side * Math.sign(d) * (T + Math.abs(d)); return alongX ? [mid[0], 0, mid[2] + k] : [mid[0] + k, 0, mid[2]]; };
      const far = off(-0.9), near = off(0.9); if (!free(far) || !free(near) || !free(off(-0.5)) || !free(off(0.5))) { why.floor++; continue; }
      if (F.roomAt(far) !== room) { why.notRoom++; continue; } const nr = F.roomAt(near); if (nr === room || (nr && held.has(nr))) { why.nearHeld++; continue; } if (FROM_ROOM && !nr) { why.nearHeld++; continue; }   // (PT_WALLFROM=room: only from inside a room the team has, never from open floor)
      if (g.doors.list.some((d: any) => flat(d.frameCentre, mid) < 1.5)) { why.door++; continue; }
      if (P.O.targetAt(mid).kind === 'door') { why.door++; continue; }   // (the menu's own rule: a point this near a leaf IS the door — a player would be offered the door's rows there, so he points further along the wall)
      const W = wallAt(g, mid, near); if (!W || !W.ok || W.index !== w.id || C.openAt(W)) { why.wall++; continue; } if (!C.standoffPosts(W, P.up.length)) { why.standoff++; continue; }
      const len = P.pathLen(P.pos, near); if (!Number.isFinite(len)) { why.walk++; continue; } if (best && len >= best.L) continue;
      best = { W, mid, near, L: len }; } }
  if (!best && process.env.PT_WALLDBG) P.say(`(no wall site: ${JSON.stringify(why)})`);
  return best;
}

/** One held room taken through its wall. True = the entry was made (the room's turn is spent); false = nothing came of it and the door is next. */
export function wallEntry(P: any, best: { room: any; men: any[] }, heldNow: { room: any }[]): boolean {
  const g = P.g, C = g.wallCharge, T = tallyOf(P); let seen = done.get(P); if (!seen) { done.set(P, seen = new Set()); if (C.carried === 0) { T.kit0++; C.setCarried(1); } }   // (a kit that has set the carried count and issued none: this commander carries one wall charge, as a card that paid for it would)
  if (!best.room || !heldNow.some(h => h.room === best.room) || !wallChargeOn(g)) return false;   // (a held room only — never the hunt's door-for-itself — and only while the module is live)
  if (seen.has(best.room) || !P.up.length || !C.affordable) return false; seen.add(best.room);   // (no wall charge to set — the bag does not hold its cost: the door)
  const S = site(P, best.room, new Set(heldNow.map(h => h.room))); if (!S) { T.none++; return false; }
  // (a wall is worth it when it is about as near as the door: a commander who marches his team across open ground to reach one is measuring the walk, not the charge)
  const doorL = Math.min(...((best.room.entries ?? []) as any[]).map(e => P.pathLen(P.pos, [e.at[0] + e.out[0] * 1.5, 0, e.at[2] + e.out[1] * 1.5])));
  if (Number.isFinite(doorL) && S.L > doorL + FAR) { T.far++; P.say(`(the nearest wall into it is ${S.L.toFixed(1)} m off, its door ${doorL.toFixed(1)}: the door)`); return false; }
  T.sites++; const { W, mid } = S, name = `the wall at ${at(mid)}`;
  // where a player stands to give it: a few metres back on the wall's near side, in sight of the place, out of the blast
  const cp = wallPt(W, 0, 0, 1.1); let post: Vec3 | null = null, postL = Infinity;
  for (const [du, back] of [[1.6, 3.2], [-1.6, 3.2], [0, 3.6], [2.4, 2.6], [-2.4, 2.6], [0.8, 4.2], [-0.8, 4.2], [0, 2.8]]) { const p = P.free(wallPt(W, du, back)); if (!p || wallOff(W, p) < 0.3 || flat(p, cp) < 2.4 || g.col.solidBlocked([p[0], 1.1, p[2]], wallPt(W, 0, 0.15, 1.1))) continue;
    const L = P.pathLen(P.pos, p); if (L < postL) { post = p; postL = L; } }
  post ??= P.free(S.near) ?? S.near;
  P.say(`→ ${name} (${best.men.length} at home behind it), from ${at(post!)}`);
  if (!P.O.of(P.up[0]) || P.O.of(P.up[0]).order !== 'fallIn') P.fallIn();
  if (!P.go(post, 60)) P.say(`Sam did not reach ${at(post!)} (at ${at(P.pos)})`);
  P.until(() => P.up.every((m: any) => flat(m.char.pos, P.pos) < 4.5), 10);
  T.tried++; const n0 = P.refused.length, t0 = P.t;
  if (!P.give(WALL_ORDER, P.O.targetAt(mid), name)) { T.refused.push(String(P.refused[n0] ?? '?').replace(/^.*?: /, ''));
    if (process.env.PT_WALLDBG) { const spot = C.setSpot(W), men = P.up, why = (q: any) => men.map((m: any) => P.O.reach(m, q) ? 'x' : '.').join('');   // (why: each man's walk to the setter's spot and to every mark, safe and old)
      const safe = spot ? C.safePosts(W, men.length, spot) : null, old = spot ? C.standoffPosts(W, men.length, spot, true) : null;
      P.say(`(refused: men at ${men.map((m: any) => at(m.char.pos)).join(' ')} · spot ${spot ? at(spot) + ' ' + why(spot) : 'none'} · safe ${safe ? safe.map((q: any) => at(q) + why(q)).join(' ') : 'none'} · old ${old ? old.map((q: any) => at(q) + why(q)).join(' ') : 'none'} · in blast ${C.inBlast(W, men)})`); }
    return false; }
  const op = () => C.ops.find((o: any) => o.wall.index === W.index);
  P.until(() => !op() || op().phase === 'armed', 45);
  if (!op() || op().phase !== 'armed') { T.unset++; P.say(`(the charge on ${name} was never set and stood off: the door)`); return false; }
  P.wait(0.8); const r = C.blow(C.set.find((c: any) => c.wall.index === W.index)); P.orders++; T.blown++; P.say(`blows ${name}${r?.hole ? '' : ' — NO HOLE'}`);
  P.rooms++;
  P.until(() => !C.ops.some((o: any) => o.wall.index === W.index), 30); T.secs.push(+(P.t - t0).toFixed(1));
  if (HURRY) return true;
  P.wait(2);
  // Sam walks in behind them through the hole, then gathers them
  const hole = C.holeAt(W), Tk = 2 * (W.alongX ? W.box.h[2] : W.box.h[0]);
  if (hole) for (const d of [2.2, 1.6, 1.0]) { const p = wallPt(W, hole.du, -(Tk + d)); if (!g.col.nav.isBlocked(p[0], p[2])) { P.go(p, 25); break; } }
  P.wait(1);
  if (SIT > 0 && P.up.length) { P.say(`sitting ${SIT} s in the taken room`); P.wait(SIT); }
  if (P.up.length && !DIRECT) { P.fallIn(); P.wait(2.5); if (PAUSE > 0) P.wait(PAUSE); }
  return true;
}
