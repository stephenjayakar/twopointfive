// THE BIG SLOT'S TOOLS ON A DOOR (the maintainer, 10-14: "i do think we should change the breaching shotgun to not take up a primary weapon slot (ready or
// not and door kickers have it as a separate slot, like the wall charge) since its slugs are only effective on door hinges anyways" · "and then we should
// also add a dynamic hammer"). The switch, the card's row and the numbers are kit.ts's (`BIGSLOT`); with it off nothing here runs — no row is offered, no
// man carries either thing (kit.ts kitBig, Player.bigKit stay 'none').
//
//   THE BREACHING SHOTGUN IS KIT. Carried in the big slot it is nobody's gun: a man keeps his rifle or his pistol, and the M870 comes out for a LOCK and
//   nothing else. What it does to the lock is shotgun.ts's own rule (fireShell: enough of one shell into a latched, locked leaf by its latch edge from
//   close, and the keep is gone — doors.ts kickIn with `lock`, so from the face the leaf opens toward it stands home unlocked for a hand to pull; a wedge
//   under the leaf is no keep and steel rings and holds). The shell is a shell: its flash, report and hearing event are the row's — heard as gunfire.
//     · YOU: a row of a door locked against you, in the boot's place ('shoot the lock off'). One committed beat (Player.kick with `tool`): planted on the
//       boot's spot, `BIGSLOT.draw` seconds to bring it up, a shell at the lock; a lock that holds gets up to `BIGSLOT.shells` of them.
//     · A TEAMMATE: the door tools' own lock-shooting (doortools.ts toGun / gunStep, written for a man whose GUN was the shotgun) with the gun brought up
//       off its sling as he comes onto his spot (gunUp: his own gun put down for it, `BIGSLOT.draw` seconds before the shell) and slung again the moment
//       the lock is off, the gun is given up on, or the fight has him (gunDown — doortools.ts slingTick is the net under every other way out).
//
//   THE DYNAMIC HAMMER. ONE blow where a boot would do (the leaf opens away from him: never slower than the boot), `BIGSLOT.swings` blows, one every
//   `BIGSLOT.swing` seconds, where the frame holds a boot (bigkit.ts hammerBlows) — and the lock gives: the last blow is doors.ts kickIn with `lock` — the
//   boot's verb and the boot's noise (a 'kick' the whole floor hears, never a shot), from EITHER face: where the frame holds a boot (the face the leaf
//   opens toward) the keep is broken out and the leaf stands home for a hand, as after the shotgun. It takes a wedged door too (the shotgun does not);
//   steel still holds. The blows before the last are the frame taking it: a thud each.
//     · YOU: the same row and the same beat ('hammer it open').
//     · A TEAMMATE: the door tools' lock stage again (toGun picks the man — a shotgun first, where the lock is one it takes — and hammerStep swings).
//
//   THE MOVES (BIGSLOT.moves — the maintainer, 10-15, with Door Kickers 2 footage: "i think the dynamic hammer and shotgun animations / pathing need some
//   work" · "using the hammer shouldn't require being directly in front of the door?" · "the character should have a hammer on their back, they put away
//   their gun, equip the hammer, wind up, and then hit the door in one motion"). What the build before did at the clinic's ward door with the four stacked
//   on it: the row was offered only inside the hand's reach of the leaf (doors.ts USE_REACH, 1.35 m of its middle — nothing from the stack's file), and the
//   one place beside the frame it knew (the latch jamb, kickSpotSide) was the lead's own mark, so he was slid to the boot's spot square in the opening.
//     · WHERE (bigSpots): a list of places for the man with the tool, best first — hard by the latch jamb, then (on the face the leaf opens away from) by
//       the hinge jamb, then off the shoulder of a man who has the jamb — every one of them OUT of the opening; the shotgun's a short arm nearer the lock
//       than its pattern needs. The first with floor, a line to the leaf and nobody standing on it is his. A teammate's list is the same one (shotgun.ts
//       breachSpot asks it first).
//     · YOU: the row is yours from BIGSLOT.reach of the doorway while such a place can be walked to in a straight line, and he WALKS there (samBigWalk) with
//       the tool coming into his hands on the way; the boot's spot in the opening only where nothing beside the frame has floor, and only from the hand's reach.
//     · THE BEAT: his gun put away and the tool in both hands in BIGSLOT.equip s (the shotgun's BIGSLOT.draw), each blow wound up over BIGSLOT.windup s and
//       landed in one swing, BIGSLOT.stow s to put it back. The body's side of it is the animator's (character.ts bigTool — a pose that is a pure function
//       of the beat's clock, written here every frame: samBigPose, hammerOutTick), the hammer on a back or in the hands is rigProps.ts's.
//   Off (`?nobigmoves`, a recording from before the key): the row inside the hand's reach, the one place or the opening, the punch standing in.
// NOBODY HAS SEEN ANY OF IT ON A GPU. With the moves off neither thing is drawn in your hands (a teammate's shotgun is, being a gun in his hands for the
// beat) and the hammer's blow is the strike a takedown uses, standing in.
// No dice, no camera, nothing read off the renderer. State: Player.kick.tool (a committed beat: savestate.ts refuses a save while a kick runs) and
// Guard.slung (on the man: the frame after a load slingTick finds him with no lock to shoot and gives him his own gun back).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { v3, type Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import { BIGSLOT, kitBig } from './kit';
import { Firearm, WEAPONS } from './weapons';
import { fireWeapon } from './combat';
import { lockPoint, breachSpot } from './shotgun';
import { offOf, doorPt, alongOf } from './doortools';
import { chronDoor } from './chronicle';
import { kickScuff } from './marks';
import { startKick } from './player';
import { PLAYER_ID } from './consts';
import { bigRebound, type Character } from './character';
import { samWork } from './handwork';

/** counted since the page (or the harness) stood up — the check's and the panel's */
export const BIG_STATS = { samShells: 0, samShot: 0, samBlows: 0, samHammered: 0, drawn: 0, slung: 0, mateBlows: 0, mateHammered: 0, /** BIGSLOT.moves: a teammate's hammer off his back · put back · you walked onto a place beside a frame · of those, by the hinge jamb or off a man's shoulder */ hammersOut: 0, hammersIn: 0, samWalks: 0, samOther: 0 };
/** seconds his hands stay on the tool after the lock has gone (or the last shell has not taken it) before he has his legs back */
const TAIL = 0.3;
/** `BIGKIT_BREAK=1` (the check's): the tools do nothing to a lock — the shell is not fired, the last blow does not land */
export const bigBroken = () => BREAK;
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BIGKIT_BREAK ?? '') === '1'; } catch { return false; } })();

// ------------------------------------------------------------ you
/** the big slot's tool that OPENS this door from where you stand (null: none carried, the switch off, a show, the door open, off its hinges or steel, a
 *  wedge under it and only the shotgun to hand — or, with BIGSLOT.shut off, not locked against you) */
export function samBig(g: Game, d: Door, p = g.player.char.pos): 'shotgun' | 'hammer' | null {
  const pl = g.player; if (!BIGSLOT.on || pl.bigKit === 'none' || g.puppet || g.touring || d.off || d.def.steel || !d.isClosed() || samBigTail(g)) return null;   // (the tail: the tool is on its way back onto him — not his to take again until it is)
  const locked = g.doors.lockedOut(d, p, pl.keys); if (!locked && !BIGSLOT.shut) return null;
  if (pl.bigKit === 'shotgun' && d.locked && d.lockId.startsWith('wedge:')) return null;   // (a wedge is no keep, from either face: the wedger's own side has its hand)
  return pl.bigKit;
}
/** WHERE YOU WORK IT FROM (BIGSLOT.beside; null = the boot's own spot): beside the latch jamb, out of the opening — the shotgun where its pattern has a
 *  line to the lock (shotgun.ts breachSpot, a teammate's own spots, none of them on a man), the hammer a short arm from it (doors.ts kickSpotSide) — when
 *  that floor is free, a couple of steps off and nothing solid stands between it and you. */
export function samBigSpot(g: Game, d: Door, from: Vec3, tool: 'shotgun' | 'hammer'): { pos: Vec3; yaw: number; at?: Vec3; /** BIGSLOT.moves: the one corner of his walk there, round a man of the file */ via?: Vec3 } | null {
  if (!BIGSLOT.beside || d.off) return null;
  if (BIGSLOT.moves) {   // (the list's first place he can walk to that nobody stands on — a stack's lead on the latch jamb leaves him the next one)
    const side = bigSide(d, from), men = g.guards.filter(m => m.state !== 'dead').map(m => m.char.pos), n0 = doorPt(d, 0, 0, side), n1 = doorPt(d, 0, 1, side), nx = n1[0] - n0[0], nz = n1[2] - n0[2];
    /** how near the straight line a→b a point stands */
    const off = (m: Vec3, a: Vec3, b: Vec3) => { const ax = b[0] - a[0], az = b[2] - a[2], L2 = ax * ax + az * az; if (L2 < 1e-4) return v3.distXZ(m, a);
      const k = Math.max(0, Math.min(1, ((m[0] - a[0]) * ax + (m[2] - a[2]) * az) / L2)); return Math.hypot(m[0] - a[0] - ax * k, m[2] - a[2] - az * k); };
    const leg = (a: Vec3, b: Vec3, but?: Vec3) => !g.col.solidBlocked([a[0], 0.5, a[2]], [b[0], 0.5, b[2]]) && !men.some(m => m !== but && off(m, a, b) < MOVE_LINE);
    // (the places on HIS side of the opening before the ones across it: he does not walk the doorway's width to a jamb while there is a place where he came from)
    const mine = alongOf(d, from) < d.def.width / 2, list = bigSpots(g, d, side, tool), order = [...list.filter(x => x.hinge === mine), ...list.filter(x => x.hinge !== mine)];
    for (const s of order) {
      if (v3.distXZ(s.pos, from) > BIGSLOT.reach + MOVE_SLACK || men.some(m => v3.distXZ(m, s.pos) < MOVE_CLEAR)) continue;
      if (leg(from, s.pos)) return s;   // (a straight walk)
      // a man of the file between him and it: ROUND him on the side off the wall — one corner, abreast of that man, with floor and both legs clear
      const m = men.filter(q => off(q, from, s.pos) < MOVE_LINE).sort((a, b) => v3.distXZ(a, from) - v3.distXZ(b, from))[0]; if (!m || g.col.solidBlocked([from[0], 0.5, from[2]], [s.pos[0], 0.5, s.pos[2]])) continue;
      const via: Vec3 = [m[0] + nx * MOVE_ROUND, 0, m[2] + nz * MOVE_ROUND];
      if (!g.col.nav.isBlocked(via[0], via[2]) && leg(from, via) && leg(via, s.pos)) return { ...s, via };
    }
    return null; }
  const ok = (pos: Vec3) => v3.distXZ(pos, from) <= BESIDE_REACH && !g.col.nav.isBlocked(pos[0], pos[2]) && !g.col.solidBlocked([from[0], 0.5, from[2]], [pos[0], 0.5, pos[2]])
    && !g.guards.some(m => m.state !== 'dead' && v3.distXZ(m.char.pos, pos) < BESIDE_CLEAR);   // (never onto a man: a stack's lead stands on that jamb)
  if (tool === 'hammer') { const s = g.doors.kickSpotSide(d, from); return ok(s.pos) ? s : null; }
  const s = breachSpot(g, d, bigSide(d, from), g.guards.filter(m => m.state !== 'dead').map(m => m.char.pos));
  return s && s.beside && ok(s.pos) ? { pos: s.pos, yaw: s.yaw } : null;
}
/** BIGSLOT.moves: a place further than the row's reach plus this is not walked to (m) · how far off a place every man must be (m: a shoulder's width — he works
 *  beside the lead, not on him) · his pace onto it (m/s: a walk) · seconds the walk may take before the beat begins from where he got to, or is given up */
const MOVE_SLACK = 1.2, MOVE_CLEAR = 0.45, MOVE_WALK = 1.5, MOVE_CAP = 3;
/** … and how near the straight walk to a place a man may stand (m: nearer, and that place is passed over) */
const MOVE_LINE = 0.3;
/** … and how far off the wall from such a man the corner of the walk round him is (m) */
const MOVE_ROUND = 0.75;
/** how far proud of the leaf the point a hammer lands on is (shotgun.ts lockPoint's own), and how far in from the hinge edge a blow from the hinge jamb lands */
const PROUD = 0.06, HINGES_IN = 0.22;
/** THE PLACES A MAN WORKS A DOOR'S TOOL FROM, on face `side`, best first (BIGSLOT.moves) — [metres past the leaf's edge along the frame line, metres off the
 *  wall]: `jamb` hard by a jamb (the latch's first; the hinge's only on the face the leaf opens AWAY from — on the other the leaf is pulled round over that
 *  floor), `shoulder` off the shoulder of a man who has the latch jamb. All out of the opening. The hammer a short arm from the leaf; the shotgun's muzzle
 *  a hand from the lock. */
const SPOTS: Record<'hammer' | 'shotgun', { jamb: [number, number][]; shoulder: [number, number][] }> = {
  hammer: { jamb: [[0.3, 0.55], [0.18, 0.8]], shoulder: [[0.12, 1.12]] },
  shotgun: { jamb: [[0.35, 0.7], [0.22, 0.88]], shoulder: [[0.12, 1.15]] } };
export type BigSpot = { pos: Vec3; yaw: number; /** the point struck or shot */ at: Vec3; /** by the hinge jamb */ hinge: boolean };
/** … those of them with floor to stand on and a clear line to the leaf (who stands where is the caller's to ask) */
export function bigSpots(g: Game, d: Door, side: 1 | -1, tool: 'shotgun' | 'hammer'): BigSpot[] {
  const W = d.def.width, lock = lockPoint(d, side), out: BigSpot[] = [], T = SPOTS[tool];
  const put = (pos: Vec3, at: Vec3, hinge: boolean) => { if (!g.col.nav.isBlocked(pos[0], pos[2]) && !g.col.solidBlocked([pos[0], 1.2, pos[2]], at)) out.push({ pos, yaw: v3.yawTo(pos, at), at, hinge }); };
  const shoulder = () => { for (const [past, off] of T.shoulder) put(doorPt(d, W + past, off, side), lock, false); };
  for (const [past, off] of T.jamb) put(doorPt(d, W + past, off, side), lock, false);
  if (tool === 'shotgun') shoulder();   // (a shell is the lock's or nothing's — shotgun.ts: the lock's own side, shoulder and all, before the far jamb)
  if (!g.doors.pullFace(d, doorPt(d, W / 2, 0.5, side))) { const at = tool === 'hammer' ? doorPt(d, HINGES_IN, PROUD, side, lock[1]) : lock;   // (the hammer by the hinges, where he stands)
    for (const [past, off] of T.jamb) put(doorPt(d, -past, off, side), at, true); }
  if (tool === 'hammer') shoulder();
  return out;
}
/** BIGSLOT.moves — THE ROW FROM WHERE A STACK STANDS (player.ts buildInteractables, for a door outside the hand's reach): within BIGSLOT.reach of the
 *  doorway, a tool that opens it, and a place beside the frame he can walk to. */
export function samBigFar(g: Game, d: Door, p: Vec3): 'shotgun' | 'hammer' | null {
  if (!BIGSLOT.on || !BIGSLOT.moves || !BIGSLOT.beside || g.player.bigKit === 'none' || Math.min(v3.distXZ(d.pos, p), v3.distXZ(d.frameCentre, p)) >= BIGSLOT.reach) return null;
  const tool = samBig(g, d, p); return tool && samBigSpot(g, d, p, tool) ? tool : null;
}
/** BIGSLOT.moves — one frame of HIS WALK onto the place (player.ts updateKick, in the slide's stead): a walk's pace straight at it, the level's and the men's
 *  collision his own; `arrived` once he stands on it. Returns the yaw his body wants (the way he walks until he is nearly there, then the place's own). */
export function samBigWalk(g: Game, dt: number): number {
  const pl = g.player, c = pl.char, K = pl.kick!, M = K.tool!.moves!;
  if (M.arrived) return K.yaw;
  if (M.via && v3.distXZ(M.via, c.pos) < 0.15) M.via = undefined;   // (round the man: the place itself from here)
  const to = M.via ?? K.spot, dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], L = Math.hypot(dx, dz);
  if (!M.via && L < 0.06) { M.arrived = true; BIG_STATS.samWalks++; return K.yaw; }
  const step = Math.min(L, MOVE_WALK * dt); c.pos = [c.pos[0] + dx / L * step, c.pos[1], c.pos[2] + dz / L * step];
  return M.via || L > 0.45 ? Math.atan2(dx, dz) : K.yaw;
}
/** BIGSLOT.moves — what the animator is told of the beat this frame (character.ts bigTool; null: no tool's beat, or the moves off) */
export function samBigPose(g: Game) {
  const T = g.player.kick?.tool, M = T?.moves; if (!T || !M) return null;
  return { kind: T.kind, t: T.t, equip: T.kind === 'hammer' ? BIGSLOT.equip : BIGSLOT.draw, windup: bigWind(), stow: BIGSLOT.stow, blows: M.blows, end: M.end, at: M.at, snug: BIGSLOT.snug };
}
/** the hammer's wind-up (s): `BIGSLOT.heft` with the moves on — the swing is drawn — and `BIGSLOT.windup`, as it was, with them off */
export const bigWind = (): number => (BIGSLOT.moves ? BIGSLOT.heft : BIGSLOT.windup);
/** … and from one blow to the next: with the moves on never less than a follow-through and a wind-up */
export const bigSwing = (): number => (BIGSLOT.moves ? Math.max(BIGSLOT.swing, bigRebound('hammer') + BIGSLOT.heft) : BIGSLOT.swing);
/** BIGSLOT.moves — THE TAIL: the beat is over and his legs are his own, the tool still going back onto him (the pose kept on `anim.bigTool`, its clock kept
 *  here). No round leaves his gun inside it (`equipT`, set as the beat ends — samBigEnded), no tool's row is his (samBig), no checkpoint is written
 *  (savestate.ts), his goggles are a nod (kitanim.ts). */
export const samBigTail = (g: Game): boolean => !!g.player.char.anim.bigTool && !g.player.kick?.tool;
/** … what is left of it (s) */
export const samBigLeft = (g: Game): number => { const B = g.player.char.anim.bigTool; return B && B.end >= 0 ? Math.max(0, B.end + B.stow - B.t) : 0; };
/** … the beat has ended (player.ts updateKick): the tail begins — or, a beat that never told its end, his hands are his own at once */
export function samBigEnded(g: Game) { const pl = g.player, left = samBigLeft(g); if (left > 0) pl.equipT = Math.max(pl.equipT, left); else pl.char.anim.bigTool = null; }
/** … dropped (player.ts cancelActions — a teleport, a show, a restage: his hands are his own, and nothing of the beat is left) */
export function samBigDrop(g: Game) { g.player.char.anim.bigTool = null; }
/** … one frame of it (player.ts, the top of his update): over when the tool is back — or AT ONCE when anything else has his hands (kitanim.ts's own list of
 *  what takes them, and a door or a wall under them) or the beat was broken off without an end (a blast, a load) */
export function samBigTailTick(g: Game, dt: number) {
  const pl = g.player, an = pl.char.anim, B = an.bigTool; if (!B || pl.kick?.tool) return;
  B.t += dt;
  const taken = pl.down || !!pl.kick || !!pl.holding || !!pl.takedown || !!pl.dragging || !!pl.picking || !!pl.wanding || !!pl.coding || !!pl.easing || !!pl.doorMove || !!pl.wall || !!pl.pendingThrow || pl.throwHeld || an.inThrow || !!samWork(g);
  if (B.end < 0 || B.t >= B.end + B.stow || taken) an.bigTool = null;
}
/** how far he is taken to that spot (m) */
const BESIDE_REACH = 1.7;
/** … and how far off it every man must be (m) */
const BESIDE_CLEAR = 0.6;
/** the row performed (game.ts): the beat begins — player.ts startKick with the tool in the boot's place */
export function samBigStart(g: Game, d: Door) { const tool = samBig(g, d); if (tool) startKick(g, d, false, tool); }
/** One frame of the beat (player.ts updateKick, which keeps him planted and squared): true = over, he has his legs back. */
export function samBigTick(g: Game, dt: number): boolean {
  const pl = g.player, c = pl.char, K = pl.kick!, T = K.tool!, d = K.door;
  T.t += dt;
  // (the moves: a blow or a shell that has just LANDED is followed through before the tool starts back — the animator's own rebound; a blow still to come is
  //  not swung. His legs are his own at T.done; the tool goes back onto him over the BIGSLOT.stow seconds after M.end — samBigTailTick)
  const M = T.moves, over = (tail: number, landed = false) => { T.done = T.t + tail; if (M && M.end < 0) { M.end = T.t + (landed ? Math.min(tail, bigRebound(T.kind)) : 0); M.blows = M.blows.filter(b => b <= T.t); } };
  if (T.done >= 0) {
    if (T.t < T.done) return false;
    // (broken from the face it opens toward: nothing flung it — the same hands pull it open, once the tool is back on him)
    const pull = T.gave && BIGSLOT.shut && !d.off && d.isClosed() && !g.doors.lockedOut(d, c.pos, pl.keys);
    if (pull && M && T.t < M.end + BIGSLOT.stow) { T.done = M.end + BIGSLOT.stow; return false; }
    if (pull) g.doors.use(d, c.pos, PLAYER_ID, pl.keys);
    return true; }
  if (d.off || (BIGSLOT.shut ? !d.isClosed() : !g.doors.lockedOut(d, c.pos, pl.keys))) { over(0.15); return false; }   // (somebody else had it open — or, the lock-only rule, turned the lock — under his hands)
  if (M && !Number.isFinite(T.next)) {   // (the moves: on his way to the place — the first blow is wound up, the first shell goes, once he stands on it with the tool in his hands)
    if (!M.arrived && T.t >= MOVE_CAP) { if (v3.distXZ(c.pos, K.spot) < 0.5) M.arrived = true; else { g.msg('no room to work it from here'); over(0); return false; } }   // (a man stepped into his way: from where he got to if that is at the place, else the beat is given up)
    if (!M.arrived) return false;
    T.next = Math.max(T.t, T.kind === 'hammer' ? BIGSLOT.equip : BIGSLOT.draw) + (T.kind === 'hammer' ? bigWind() : 0); M.blows.push(T.next); return false; }
  if (T.t < T.next) return false;
  T.n++;
  if (T.kind === 'shotgun') {
    BIG_STATS.samShells++;
    const lock = d.locked && d.latched;   // (the shell's own rule takes a keep that is locked AND home — shotgun.ts fireShell; anything else shut is the latch's)
    if (!BREAK) fireWeapon(g, c, lockPoint(d, T.side), true, { weapon: WEAPONS.m870, steady: true, spread: 0 });   // (shotgun.ts fireShell: the lock is its rule's — and its message and the debrief's row)
    // (a leaf merely SHUT is nothing to a pattern that strays onto it — shotgun.ts; this shell was put into its latch on purpose, and takes it as the boot does)
    const gave = lock ? !d.locked : !BREAK && g.doors.kickIn(d, c.pos, PLAYER_ID, true);
    if (gave && !lock) { g.msg('shot it open — the whole floor heard that'); chronDoor(g, 'doorKicked', d); }
    if (gave) { BIG_STATS.samShot++; T.gave = true; over(TAIL, true); }
    else if (T.n >= BIGSLOT.shells) { g.msg(lock ? 'the lock held' : 'it held'); over(TAIL, true); }
    else { T.next = T.t + WEAPONS.m870.cd; M?.blows.push(T.next); }
    return false;
  }
  if (!M) c.anim.strike('cross');   // (the moves: the swing is the animator's own, landing now — character.ts bigTool)
  BIG_STATS.samBlows++;
  if (T.n < T.need) { d.rattleT = 0.6; d.lastWho = PLAYER_ID; g.doors.sound(d, 'thud', d.pos, PLAYER_ID, 1.0); T.next = T.t + bigSwing(); M?.blows.push(T.next); return false; }
  const gave = !BREAK && g.doors.kickIn(d, c.pos, PLAYER_ID, true); kickScuff(g, d, c.pos);
  if (gave) { BIG_STATS.samHammered++; T.gave = true; g.msg('hammered it open — the whole floor heard that'); chronDoor(g, 'doorKicked', d); }
  over(TAIL, true);
  return false;
}
/** the blows the hammer needs on d from p: ONE where a boot would do (the leaf opens away: it is flung in, in the boot's own time) — `BIGSLOT.swings` where
 *  the frame holds a boot (doors.ts bootHolds: the face it opens toward), the first a thud in the frame */
export const hammerBlows = (g: Game, d: Door, p: readonly number[]): number => (d.locked && g.doors.bootHolds(d, p as [number, number, number]) ? Math.max(1, BIGSLOT.swings) : 1);   // (a latch that is not locked gives at one blow from either face)
/** which face of d he is on (the lock point's side) */
export const bigSide = (d: Door, p: readonly number[]): 1 | -1 => (offOf(d, p as [number, number, number], 1) >= 0 ? 1 : -1);

// ------------------------------------------------------------ carried where it can be seen (BIGSLOT.moves)
/** the big slot's tool a man carries, for the drawer (combat.ts handProps → rigProps.ts): null with the moves off, on a show's puppet, or with nothing carried */
export function bigCarried(g: Game, c: { id: number }): 'hammer' | 'shotgun' | null {
  if (!BIGSLOT.on || !BIGSLOT.moves) return null;
  if (c.id === PLAYER_ID) { const k = g.player.bigKit; return k === 'hammer' || k === 'shotgun' ? k : null; }
  const gd = g.guards.find(m => m.char.id === c.id); if (!gd) return null;
  const k = kitBig(gd); return k === 'hammer' || k === 'shotgun' ? k : null;
}

// ------------------------------------------------------------ a teammate
/** he carries the hammer in his big slot (kit.ts: a staged teammate's card) */
export function carriesHammer(gd: Guard): boolean { return gd.state !== 'dead' && kitBig(gd) === 'hammer'; }
/** THE SHOTGUN COMES UP OFF ITS SLING into a teammate's hands (the door tools' gunStep, as he comes onto his spot): the gun he held is put down for it —
 *  kept on him, with the row his route names (game.ts deals a man's gun off his route every frame, so the route is where the swap is written). True once
 *  it has been up `BIGSLOT.draw` seconds: the shell may go. A man whose own gun is the shotgun has nothing to draw. */
export function gunUp(g: Game, gd: Guard): boolean {
  if (!gd.slung?.out) {
    if (gd.weapon.def.pellets?.breach) return true;
    const s = gd.slung ??= { own: gd.weapon, ownId: gd.route.weapon, ahead: gd.char.muzzleAhead, gun: new Firearm(WEAPONS.m870), out: false, t: 0 };
    s.own = gd.weapon; s.ownId = gd.route.weapon; s.ahead = gd.char.muzzleAhead;
    gd.route.weapon = 'm870'; gd.weapon = s.gun; gd.reloadT = -1; gd.char.muzzleAhead = WEAPONS.m870.muzzleAhead;
    s.out = true; s.t = g.time; BIG_STATS.drawn++;
  }
  return g.time - gd.slung!.t >= BIGSLOT.draw;
}
/** … and is slung again: his own gun back in his hands, as he put it down (a dead man keeps what he fell with) */
export function gunDown(gd: Guard) {
  const s = gd.slung; if (!s?.out) return;
  s.out = false; BIG_STATS.slung++;
  if (gd.state === 'dead') return;
  gd.route.weapon = s.ownId; gd.weapon = s.own; gd.reloadT = -1; gd.char.muzzleAhead = s.ahead;
}
/** One blow of a teammate's hammer on d (doortools.ts hammerStep, on his spot and squared to the lock). The blows before the last are a thud
 *  in the frame; the last is the boot's verb with the lock itself broken — true = the door gave. */
export function hammerBlow(g: Game, gd: Guard, d: Door, last: boolean): boolean {
  const c = gd.char; if (!gd.bigOut) c.anim.strike('cross');   // (the moves: his swing is the animator's, landing now)
  BIG_STATS.mateBlows++;
  if (!last) { d.rattleT = 0.6; d.lastWho = c.id; g.doors.sound(d, 'thud', d.pos, c.id, 1.0); return false; }
  const gave = !BREAK && g.doors.kickIn(d, v3.copy(c.pos), c.id, true); kickScuff(g, d, c.pos);
  if (gave) BIG_STATS.mateHammered++;
  return gave;
}
/** BIGSLOT.moves — THE HAMMER OFF A TEAMMATE'S BACK (doortools.ts hammerStep, every frame he is its door's man: begun as he is sent, so it is in his hands
 *  by the time he has walked onto his place). His gun is put away for it — the animator's and the drawer's to show; he fires nothing while it is out, and
 *  the lock stage gives it up the moment the fight has him (hammerIn). */
export function hammerOut(g: Game, gd: Guard, at: Vec3) {
  if (!gd.bigOut || gd.bigOut.end >= 0) { gd.bigOut = { t0: g.time, blows: [], end: -1, at: v3.copy(at) }; BIG_STATS.hammersOut++; }
  return gd.bigOut;
}
/** … and put back: begun now — or as the blow that has just landed is followed through (a blow still to come is not swung); hammerOutTick has it on his back
 *  BIGSLOT.stow seconds on. `hard` (the fight has him — doortools.ts; he fires — bigFired): on his back AT ONCE, his gun in his hands, as the sim has it. */
export function hammerIn(g: Game, gd: Guard, hard = false) {
  const H = gd.bigOut; if (!H) return;
  if (H.end < 0) BIG_STATS.hammersIn++;
  if (hard) { gd.bigOut = null; gd.char.anim.bigTool = null; return; }
  if (H.end >= 0) return;
  const now = g.time - H.t0; H.blows = H.blows.filter(b => b <= now);
  H.end = H.blows.length ? Math.max(now, H.blows[H.blows.length - 1] + bigRebound('hammer')) : now;   // (a blow just landed is followed through first)
}
/** a round has left this man's gun (combat.ts fireWeapon, a man other than Sam with the tool's pose on him): the hammer is on his back — what is drawn is what the sim did */
export function bigFired(g: Game, c: Character) { const gd = g.guards.find(x => x.char === c); if (gd?.bigOut) hammerIn(g, gd, true); else c.anim.bigTool = null; }
/** … every frame (doortools.ts update, beside the sling's own net): the animator is told where each man's beat stands (character.ts bigTool), a hammer whose
 *  door is no longer his (`mine`) goes back, and one that has been put back — or whose man is down — is on his back again. */
export function hammerOutTick(g: Game, mine: (gd: Guard) => boolean) {
  for (const gd of g.guards) { const H = gd.bigOut; if (!H) continue;
    if (!BIGSLOT.moves || gd.state === 'dead') { gd.bigOut = null; gd.char.anim.bigTool = null; continue; }
    if (H.end < 0 && !mine(gd)) hammerIn(g, gd);
    const t = g.time - H.t0;
    if (H.end >= 0 && t >= H.end + BIGSLOT.stow) { gd.bigOut = null; gd.char.anim.bigTool = null; continue; }
    gd.char.anim.bigTool = { kind: 'hammer', t, equip: BIGSLOT.equip, windup: bigWind(), stow: BIGSLOT.stow, blows: H.blows, end: H.end, at: H.at, snug: BIGSLOT.snug }; }
}
