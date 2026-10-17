// A TEAMMATE WORKS A THING IN THE LEVEL — the squad's menu on something Sam could work himself.
//
// The maintainer, with the menu up on the breaker panel of a dark room and nothing on it but 'move there': "teammates should be able to flip the circuit
// breaker etc." So: the orders' menu opened on a thing a man can work with his hand carries that thing's own order on digit 1, where 'move there' is on bare
// floor — and the quick key and the button twice give it, as they give every target's first row. No new digit, no new key, nothing to hold.
//
// WHICH THINGS (things()): the ones Sam has a row of his own for that a teammate's hand makes sense on —
//   · the BREAKER (player.ts 'breakerOff' / 'breakerOn'): throw it, or re-arm the mains — whichever it is not, read when the order is given. Not once a round
//     has wrecked it (Sam has no row then either);
//   · the MISSION'S THING (player.ts 'drive'): the drive in its rack, or a quiet mission's thing in its holder (quiet.ts) — only once the objective is to
//     take it (stage 'drive'), as Sam's own row.
// NOT here, and why: doors and their locks have their own orders (the door's menu, doortools.ts) and a hand on a leaf is another module's (hands.ts); a wall
// has its charge (wallcharge.ts); people have theirs (pairorders.ts); a body wants a place to be carried TO, which one target cannot say; a light has no
// switch a hand can reach in this game (the OCP and a round are Sam's).
//
// WHAT THE MAN DOES: the nearest of the men addressed who can get there goes — one man works it, never two. He walks to a spot an arm off its face that he
// can stand on with a clear line to it (standFor), gun up on the way and low with Sam if the squad is sneaking; squares to it, puts his free hand on it
// (workHand → game.ts handsOnDoors → the animator's door-hand layer), and after the time it takes (the breaker: under a second; the mission's thing: Sam's
// own DRIVE_SECS) does what Sam's row does — Game.setBlackout / endBlackout, mission.ts drivePulled — says so in a word, turns his back to it and HOLDS
// there, where the unasked cover deals him the room's openings. With the whole element addressed his partner comes too, to a mark behind him facing out:
// one works, one covers. A fight takes him as it takes any man under orders (orders.ts' own seam) and gives him back, and he starts the hand again. If the
// thing is no longer there to be worked when he reaches it (somebody else threw it, the drive is already out) he says so and holds.
// A man the orders stop short of it (orders.ts brings a stuck man's mark to his feet and calls him arrived) is NOT at it: he holds where he stopped, the thing
// unworked — the test is his feet on the stand cell, squared to the face, with a clear line to it.
//
// WHAT COUNTS AS THE CURSOR BEING ON IT: the breaker's own panel under the ray (workOn), or a point within WORK.pickM of its face on ITS side of the wall it
// hangs on (workNear) — the wall's top, its far face and the next room's floor are not the breaker. Sam's own feet are Sam; a door leaf under the cursor is the door.
//
// ONE THING THIS HAS TO PUT RIGHT, behind its own switch: lighting.ts hands the 'go and check the breaker' errand to the nearest calm man on the guard list
// and lets ANY man standing by the panel re-arm it — a teammate is on that list. With WORK.on neither is a teammate's: he throws a breaker when told to.
//
// THE SWITCH: WORK.on — false here; the page and the shipped stand raise it (host/profile.ts; ?noworkthings = as it was), the frozen stand holds it off
// (TPS_WORKTHINGS=1 raises it). Off: no row, no target, nothing ticks, lighting.ts as it was.
//
// HABITS (coop-door-open-habits): no dice; nothing read off the camera or the canvas (the target is orders.ts', from input); no graphics setting; no GPU
// read; nothing asks for "the" player but orders.ts' own recipients; the state is one short record per man at work, dropped with his order — a checkpoint
// is refused while a unit is on the floor (savestate.ts canSave), so there is nothing to snapshot.
import { Vec3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character, DoorPush } from './character';
import type { OrderDef, OrderTarget, SquadOrders, Assignment } from './orders';
import type { Box } from '../scene/boxes';
import { DRIVE_SECS, DRIVE_REACH } from './consts';
import { drivePulled, rackDist } from './mission';
import { quietWords, holderStand } from './quiet';
import { chronObjective } from './chronicle';
import { sneakLow, SNEAK } from './sneak';
import { silentHolds } from './silent';

export const WORK = {
  /** the whole of it (false: the menu, the men and lighting.ts as they were) */
  on: false,
  /** the cursor's point within this of the thing (planar, metres), on its own side of the wall it is on, is the thing · the mission's thing, whose face is
   *  as wide as its rack (and whose top the cursor may be on: `behindM` behind its face still counts; the breaker: its own box's depth) */
  pickM: 0.45, pickWideM: 0.9, behindM: 0.5, behindPanelM: 0.09,
  /** he stands this far off its face · and his partner this far behind him */
  standM: 0.5, buddyM: 1.4,
  /** the hand goes out for this long before the thing is worked · the breaker's handle then takes this long (the mission's thing: DRIVE_SECS) */
  handSecs: 0.45, breakerSecs: 0.7,
  /** the hand comes off over this long · and goes out only from within this of the face (a stand further off works it at Sam's own reach, no hand shown) */
  fadeSecs: 0.4, handM: 0.85,
  /** a man who cannot leave where he stands is not handed the 'check the breaker' errand when the mains go (false: the nearest man is, walk or no walk, as it was) */
  posted: true,
  /** that errand is walked to the panel's OWN face, and the mains are re-armed only by a man with nothing solid between his chest and the panel (false: a spot
   *  and a bare radius at fixed offsets from the panel, right only where it hangs facing the way the office's does — elsewhere the man stood in a wall, or
   *  re-armed it from the far side of the one it hangs on) */
  ownFace: true,
  /** a man stood at his thing does not take as a target, or turn to look for at a mate's call or a footfall, a man his round is held for (the squad's fire
   *  is held and that man has noticed nobody): he works the thing, his partner's gun on the man if he has a partner (false: his muzzle stays on that man for
   *  as long as the hold stands, his chest turned off the thing, and it is never worked) */
  heldPass: true,
};
export const WORK_STATS = { given: 0, done: 0, moot: 0 };
export const WORK_ORDER = 'work';

export type WorkVerb = 'breakerOff' | 'breakerOn' | 'drive' | 'defuse';
/** A thing a teammate can work: `face` the point on it his palm goes to (world), `n` the unit normal out of it toward where he stands (planar), `stand`
 *  where he stands to work it (null: nowhere he can), `name` the menu's words for it ('on the breaker') */
export interface WorkThing { kind: 'breaker' | 'objective' | 'device'; face: Vec3; n: Vec3; stand: Vec3 | null; name: string;
  /** kind 'device': which of a defuse mission's charges (defuse.ts) */
  dev?: number; }
/** The work a hand is out for (workJob): which, how far in, how long it takes */
export interface WorkJob { verb: WorkVerb; secs: number; need: number; }
interface Job { thing: WorkThing; verb: WorkVerb; A: Assignment; t0: number; lastT: number; }
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** WHERE HE STANDS to work a thing on a face: the free nav cell nearest `standM` off the point, in front of it (`n`; null: any side — a quiet mission's holder
 *  faces any way), with a clear line from chest height to a hand's width short of it — in `area` (the holder's room) before out of it. Null: no such cell
 *  within arm's reach of it. Read again every second (things()): a door leaf standing across a face moves the spot. */
type Area = { x0: number; x1: number; z0: number; z1: number };
function standFor(g: Game, face: Vec3, n: Vec3 | null, area: Area | null = null): Vec3 | null {
  const nav = g.col.nav, e = 0.3; let best: Vec3 | null = null, bs = Infinity;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const dx = i * 0.2, dz = j * 0.2, d = Math.hypot(dx, dz); if (d < 0.3 || d > 1.0) continue;
    const front = n ? (dx * n[0] + dz * n[2]) / d : 1; if (front < 0.5) continue;
    const x = face[0] + dx, z = face[2] + dz; if (nav.isBlocked(x, z)) continue;
    if (g.col.solidBlocked([x, 1.0, z], [face[0] + dx / d * 0.2, 1.0, face[2] + dz / d * 0.2])) continue;
    const inside = !area || (x >= area.x0 - e && x <= area.x1 + e && z >= area.z0 - e && z <= area.z1 + e);   // (the room first, as quiet.ts holderStand)
    const s = Math.abs(d - WORK.standM) + (1 - front) * 0.8 + (inside ? 0 : 10); if (s < bs) { bs = s; best = [x, 0, z]; }
  }
  return best;
}

/** the breaker panel: the point on its face and the normal out of it — out of the box's thin side, toward the point the level marks in front of it */
function panelFace(g: Game): { face: Vec3; n: Vec3 } {
  const B = g.level.breaker, box = g.engine.world.statics[B.boxes[0]], bp = B.pos; let n: Vec3 = [0, 0, -1], face: Vec3 = [bp[0], bp[1], bp[2]];
  if (box) { const dx = bp[0] - box.c[0], dz = bp[2] - box.c[2];
    if (Math.abs(dx) > Math.abs(dz)) { n = [Math.sign(dx) || 1, 0, 0]; face = [box.c[0] + n[0] * Math.min(box.h[0], box.h[2]), bp[1], bp[2]]; }
    else { n = [0, 0, Math.sign(dz) || -1]; face = [bp[0], bp[1], box.c[2] + n[2] * Math.min(box.h[0], box.h[2])]; } }
  return { face, n };
}

/** lighting.ts's 'check the breaker' errand, read off the panel itself: `goal` where the man sent walks to, `mid` the middle of the reach he re-arms it
 *  from, `at` the point just off the panel's face that his chest needs a clear line to. */
export interface BreakerErrand { goal: Vec3; mid: Vec3; at: Vec3; }
const errands = new WeakMap<Game, { t: number; key: string; E: BreakerErrand | null }>();   // (derived from the level as it stands, asked again every second: nothing to save)
/** lighting.ts setBlackout / breakerResetNear. Null: the fixed offsets and the bare radius, as they were (the switch or `ownFace` off, a show on the stage).
 *  The fixed spot is KEPT wherever a man can stand on it with a line to the panel (walls only: a door leaf swung across it for a moment does not move the
 *  errand), so every level it was right on walks and times as before; elsewhere it is the spot a teammate told to work the panel stands on (standFor),
 *  and the reach is measured in front of the panel's real face. */
export function breakerErrand(g: Game): BreakerErrand | null {
  if (!WORK.on || !WORK.ownFace || g.touring || g.quietUtility || !g.level.breaker) return null;
  const bp = g.level.breaker.pos, key = bp.join(','), c = errands.get(g);
  if (c && c.key === key && g.time >= c.t && g.time - c.t < 1) return c.E;
  const { face, n } = panelFace(g), at: Vec3 = [face[0] + n[0] * 0.05, 1.0, face[2] + n[2] * 0.05];
  const fixed: Vec3 = [bp[0] - 0.4, 0, bp[2] - 0.9], col = g.col, dyn = col.dynamicBoxes; let kept = false;
  col.dynamicBoxes = []; try { kept = !col.nav.isBlocked(fixed[0], fixed[2]) && !col.solidBlocked([fixed[0], 1.0, fixed[2]], at); } finally { col.dynamicBoxes = dyn; }
  const stand = kept ? fixed : standFor(g, bp, n);   // no floor in front of the panel at all: the fixed offsets as they were (a man who could never re-arm it is worse)
  const E: BreakerErrand | null = kept ? { goal: fixed, mid: [bp[0], 0, bp[2] - 0.6], at }
    : stand ? { goal: stand, mid: [face[0] + n[0] * 0.6, 0, face[2] + n[2] * 0.6], at } : null;
  errands.set(g, { t: g.time, key, E }); return E;
}

export class WorkThings {
  /** the menu's row (orders.ts rowsFor lists it through workRows only: `listed` is empty) */
  readonly row: OrderDef;
  private jobs = new Map<Guard, Job>();
  /** the hands out, by character: the layer's push, when it comes off (Infinity: while he works) and when his order last ticked with it out (a man the fight
   *  has taken is not ticked: his hand comes off by itself) */
  private hands = new Map<Character, { push: DoorPush; until: number; seen: number; verb: WorkVerb; t0: number; need: number }>();
  private cache: { key: string; t: number; list: WorkThing[] } | null = null;
  log: { t: number; who: string; what: string }[] = [];

  constructor(private g: Game) {
    this.row = { id: WORK_ORDER, key: 1, label: t => t.kind === 'floor' && t.thing ? this.words(t.thing) : 'work it', targets: ['floor'], listed: [], ack: ['on it.', 'moving.'],
      can: (S, gd, t) => S.reach(gd, t.at) ?? true,
      only: (S, men, t) => this.pick(S, men, t),
      valid: (_S, t) => !WORK.on || t.kind !== 'floor' || !t.thing ? 'nothing to work there.' : !t.thing.stand ? "can't get a hand on it." : this.moot(t.thing, this.verbOf(t.thing)) ?? true,
      issue: (S, men, t) => this.issue(S, men, t),
      tick: (S, gd, A) => this.tick(S, gd, A) };
    g.orders.register(this.row);
  }

  // ------------------------------------------------------------ the things
  /** the things that can be worked right now. Read afresh when what places them changes (the level, the mission's rack, a quiet mission's words) and once a
   *  second besides: where a man stands to one moves with a door leaf swung across it. A new second also drops the records of men no longer at it (prune). */
  things(): WorkThing[] {
    const g = this.g; if (!WORK.on) return [];
    const B = g.level.breaker, bo = g.blackout, M = g.level.mission, drive = g.mission.stage === 'drive' && !g.quietUtility && !g.puppet, W = drive ? quietWords(g) : null;
    const key = `${B ? B.pos.join(',') : ''}|${B && !(bo.active && bo.permanent)}|${drive && M?.rack ? M.rack.front.join(',') : ''}|${W ? W.holder : ''}|${g.defuse?.key ?? ''}`;
    if (this.cache && this.cache.key === key && g.time >= this.cache.t && g.time - this.cache.t < 1) return this.cache.list;
    this.prune();
    const list: WorkThing[] = [];
    if (B && !(bo.active && bo.permanent)) { const { face, n } = panelFace(g); list.push({ kind: 'breaker', face, n, stand: standFor(g, B.pos, n), name: 'the breaker' }); }
    if (drive && M?.rack) {   // the mission's thing: the rack's LED face looks +z on the plain night; a quiet mission's holder faces wherever a man can stand, in its room
      const rf = M.rack.front, y = Math.min(1.35, Math.max(0.9, rf[1] || 1.1));
      let stand = W ? standFor(g, rf, null, M.serverRoom) : standFor(g, rf, [0, 0, 1]);
      if (!stand && W) { const H = holderStand(g, rf, M.serverRoom); if (H.pos && H.clear && rackDist(g, H.pos) < DRIVE_REACH) stand = H.pos; }   // (no cell an arm off it: the cell the game itself sends a man to — quiet.ts — if Sam's own reach would do from there)
      let n: Vec3 = [0, 0, 1]; if (stand && W) { const d = flat(stand, rf) || 1; n = [(stand[0] - rf[0]) / d, 0, (stand[2] - rf[2]) / d]; }
      list.push({ kind: 'objective', face: [rf[0], y, rf[2]], n, stand, name: W ? W.holder : 'the rack' });
    }
    for (const d of g.defuse?.armed() ?? []) list.push({ kind: 'device', face: d.face, n: d.n, stand: standFor(g, d.face, d.n), name: d.name, dev: d.i });   // a defuse mission's live charges (defuse.ts)
    this.cache = { key, t: g.time, list }; return list;
  }
  /** records of men who are no longer at it: down, off the roster (a new cast), or since ordered elsewhere — and hands with no living owner on the roster */
  private prune() {
    const S = this.g.orders, squad = S.squad();
    for (const [gd, J] of this.jobs) if (gd.state === 'dead' || !squad.includes(gd) || S.of(gd) !== J.A) this.jobs.delete(gd);
    for (const c of this.hands.keys()) if (!squad.some(gd => gd.char === c && gd.state !== 'dead')) this.hands.delete(c);
  }
  /** what working it would do now */
  verbOf(th: WorkThing): WorkVerb { return th.kind === 'device' ? 'defuse' : th.kind === 'objective' ? 'drive' : this.g.blackout.active ? 'breakerOn' : 'breakerOff'; }
  /** the row's words */
  words(th: WorkThing): string {
    if (th.kind === 'device') return `make ${th.name} safe`;
    if (th.kind === 'breaker') return this.g.blackout.active ? 're-arm the mains' : 'throw the breaker';
    const W = quietWords(this.g); return W ? `take ${W.thing}` : 'pull the drive';
  }
  /** why that is not there to be done any more (null: it is) — the word the man says */
  private moot(th: WorkThing, verb: WorkVerb): string | null {
    const g = this.g, bo = g.blackout;
    if (th.kind === 'device') return g.defuse ? g.defuse.moot(th.dev ?? -1) : "it's gone.";
    if (th.kind === 'objective') return g.mission.stage === 'drive' ? null : quietWords(g) ? "it's already gone." : "it's already out.";
    if (bo.active && bo.permanent) return "it's scrap.";
    return verb === 'breakerOff' ? (bo.active ? "it's already dark." : null) : bo.active ? null : "it's already on.";
  }
  /** orders.ts targetAt: the thing a point is ON, as a target (the floor a man stands on to work it, carrying the thing), with how far the point is off it —
   *  within its pick distance and on its own side of whatever it is fixed to: the far face of the breaker's wall, the wall's top and the floor of the next
   *  room are not the breaker */
  near(at: Vec3): { d: number; target: OrderTarget } | null {
    let best: WorkThing | null = null, bd = Infinity;
    for (const th of this.things()) {
      const d = flat(th.face, at), wide = th.kind !== 'breaker'; if (d >= (wide ? WORK.pickWideM : WORK.pickM) || d >= bd) continue;
      if ((at[0] - th.face[0]) * th.n[0] + (at[2] - th.face[2]) * th.n[2] < -(wide ? WORK.behindM : WORK.behindPanelM)) continue;
      bd = d; best = th;
    }
    return best ? { d: bd, target: { kind: 'floor', at: best.stand ?? [best.face[0], 0, best.face[2]], thing: best } } : null;
  }
  /** orders.ts targetUnder: the thing whose own box the cursor's ray landed on (the breaker's panel and its lamp: drawn 1.35 m up a wall, where the ray's
   *  point is the thing's whatever the angle) */
  on(box: Box | undefined): OrderTarget | null {
    const B = this.g.level.breaker, W = this.g.engine.world; if (!box || !B) return null;
    if (!B.boxes.some(i => W.statics[i] === box)) return null;
    const th = this.things().find(x => x.kind === 'breaker'); return th ? { kind: 'floor', at: th.stand ?? [th.face[0], 0, th.face[2]], thing: th } : null;
  }
  /** orders.ts rowsFor: a thing's menu is the floor's with its own order where 'move there' was (and whatever stood in for it) */
  rows(t: OrderTarget, page: string | null, rows: OrderDef[]): OrderDef[] {
    if (!WORK.on || page !== null || t.kind !== 'floor' || !t.thing) return rows;
    return [this.row, ...rows.filter(d => d.id !== 'move' && d.standsIn?.for !== 'move' && d.key !== 1)];
  }

  // ------------------------------------------------------------ the order
  /** where the man who covers goes: a free spot he can reach behind the man at work, on his own side of him (null: none — he is then left out of the order) */
  private coverPost(S: SquadOrders, mate: Guard, th: WorkThing): Vec3 | null {
    const stand = th.stand; if (!stand) return null;
    const side = Math.sign((mate.char.pos[0] - stand[0]) * th.n[2] - (mate.char.pos[2] - stand[2]) * th.n[0]) || 1;
    for (const k of [side, -side, 0]) {
      const post = S.freeSpot([stand[0] + th.n[0] * WORK.buddyM + th.n[2] * 0.5 * k, 0, stand[2] + th.n[2] * WORK.buddyM - th.n[0] * 0.5 * k]);
      if (post && flat(post, stand) > 0.7 && flat(post, stand) < WORK.buddyM + 1.2 && S.reach(mate, post) === null) return post;
    }
    return null;
  }
  /** who it is for: the nearest of them who can get there — and, with more than one addressed, his partner (the other man of his pair; the one pair: the
   *  other man) if there is a mark for him to cover from. Everybody else is left as he was (a drill that owns him is not asked to let go). */
  private pick(S: SquadOrders, men: Guard[], t: OrderTarget): Guard[] {
    const able = men.filter(gd => S.reach(gd, t.at) === null); if (!able.length || t.kind !== 'floor' || !t.thing) return [];
    const w = able.reduce((a, b) => flat(b.char.pos, t.at) < flat(a.char.pos, t.at) ? b : a);
    const id = S.pairOf(w), mate = men.length > 1 ? able.find(gd => gd !== w && (!S.paired || S.pairOf(gd) === id) && !!this.coverPost(S, gd, t.thing!)) : undefined;
    return mate ? [w, mate] : [w];
  }
  private issue(S: SquadOrders, men: Guard[], t: OrderTarget): string | void {
    const g = this.g; if (t.kind !== 'floor' || !t.thing || !t.thing.stand) return 'nothing to work there.';
    const th = t.thing, stand = th.stand!, verb = this.verbOf(th); this.prune();
    const w = men.reduce((a, b) => flat(b.char.pos, stand) < flat(a.char.pos, stand) ? b : a), toIt = Math.atan2(-th.n[0], -th.n[2]), out = Math.atan2(th.n[0], th.n[2]);
    S.assign(w, { order: WORK_ORDER, post: [stand[0], 0, stand[2]], face: toIt, stance: 'lowReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, going: `to ${th.name}`, there: `at ${th.name}`, setLine: null });
    this.jobs.set(w, { thing: th, verb, A: S.of(w)!, t0: -1, lastT: g.time });
    const covers: string[] = [];
    for (const mate of men) { if (mate === w) continue;   // one covers: a mark behind the man at work, back to him — a plain 'move' with his eyes spare, so the unasked cover deals him the ways in
      const p = mate.char.pos, post = this.coverPost(S, mate, th);
      if (post) S.assign(mate, { order: 'move', post, face: out, stance: 'lowReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, spare: true, from: [p[0], 0, p[2]], going: 'moving', there: `covering ${w.callsign}`, setLine: 'set.' });
      else S.assign(mate, { order: 'hold', post: [p[0], 0, p[2]], face: mate.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding' });   // (the mark he was picked for has gone in the meantime: he holds where he is — never left with no order, his drill having let go of him)
      covers.push(mate.callsign); }
    WORK_STATS.given++; this.note(w, `sent to ${verb} at ${stand[0].toFixed(1)},${stand[2].toFixed(1)}${covers.length ? ` · ${covers.join(', ')} covers` : ''}`);
  }
  /** once a frame for the man at work, before the orders pose him (never while the fight has him: the hand comes off and the clock starts over when he is back) */
  private tick(S: SquadOrders, gd: Guard, A: Assignment) {
    const g = this.g, J = this.jobs.get(gd), now = g.time; if (!J || J.A !== A) return;
    if (!WORK.on) { this.settle(S, gd, J, null, false); return; }
    const th = J.thing, stand = th.stand!, H0 = this.hands.get(gd.char);
    if (J.t0 >= 0 && (now - J.lastT > 0.25 || !H0 || H0.until !== Infinity)) this.handOff(gd, J);   // (a gap in his ticks, or the hand has come off in it: start again)
    J.lastT = now;
    // the run has ENDED under his hand (Sam is down): the mission's thing is nobody's to take and a charge stays armed (defuse.ts's makeSafe does nothing then).
    // The job ends here with no word — "it's already gone." and 'charge is safe.' would both be false. The breaker is the level's, not the run's: it goes on
    if (g.player.down && (J.verb === 'drive' || J.verb === 'defuse')) { WORK_STATS.moot++; this.note(gd, 'moot: the run is over'); this.settle(S, gd, J, null, false); return; }
    const why = this.moot(th, J.verb);
    if (why) { WORK_STATS.moot++; this.note(gd, `moot: ${why}`); this.settle(S, gd, J, why, true); return; }
    // the orders bring a mark to a man who cannot reach it (orders.ts tick: stuck, or somebody standing on it) — and call that arrived. He is not at the thing:
    // he has said so if it was far ("can't get through."); he holds where he is, the thing unworked
    if (!A.post || flat(A.post, stand) > 0.3) { WORK_STATS.moot++; this.note(gd, 'stopped short of it'); this.settle(S, gd, J, A.there === 'stopped short' ? null : "can't get to it.", false); return; }
    const p = gd.char.pos, dF = flat(p, th.face) || 1;
    const on = A.arrived && flat(p, stand) < 0.45 && Math.abs(wrapAngle(gd.char.bodyYaw - (A.face ?? 0))) < 0.6
      && !g.col.solidBlocked([p[0], 1.0, p[2]], [th.face[0] + (p[0] - th.face[0]) / dF * 0.2, 1.0, th.face[2] + (p[2] - th.face[2]) / dF * 0.2]);
    const low = !on && sneakLow(g, gd); A.crouch = low; A.pace = low ? SNEAK.lowPace : undefined;   // (low with Sam on the way, as a man sent to a mark; he stands to it)
    if (!on) { if (J.t0 >= 0) this.handOff(gd, J); A.there = `at ${th.name}`; return; }
    if (J.t0 < 0) { J.t0 = now;
      if (dF < WORK.handM) this.hands.set(gd.char, { push: { p: th.face, n: th.n, w: 1, hand: 0 }, until: Infinity, seen: now, verb: J.verb, t0: now, need: this.needOf(J.verb) });
      if (J.verb === 'drive') { const m = g.mission, W = quietWords(g); g.audio.play('click', th.face, 0.8); g.audio.play('magOut', th.face, 0.4, { rate: 0.55 });
        if (!m.handsOn) { m.handsOn = true; chronObjective(g, W ? `hands on ${W.thing}` : 'hands on the drive', th.face); } } }
    const H = this.hands.get(gd.char); if (H) H.seen = now;
    const need = this.needOf(J.verb), k = (now - J.t0) / need;
    A.there = J.verb === 'drive' || J.verb === 'defuse' ? `${this.words(th)}… ${Math.min(99, Math.round(k * 100))}%` : `on ${th.name}`;
    if (k < 1) return;
    let line: string;
    if (J.verb === 'breakerOff') { g.setBlackout(86400, 'hand'); line = 'lights out.'; }
    else if (J.verb === 'breakerOn') { g.endBlackout(); line = "power's back."; }
    else if (J.verb === 'defuse') { const i = th.dev ?? -1; g.defuse.makeSafe(i, gd);
      if (g.defuse.states[i] !== 'safe') { WORK_STATS.moot++; this.note(gd, 'moot: not made safe'); this.settle(S, gd, J, null, false); return; }   // (the word follows the deed: makeSafe has its own reasons to do nothing)
      line = 'charge is safe.'; }
    else { const n0 = g.player.noise, W = quietWords(g); drivePulled(g); g.player.noise = n0; line = W ? `got ${W.bare}.` : 'got the drive.'; }   // (the clunk is the rack's, heard as ever — it is not Sam's own noise)
    WORK_STATS.done++; this.note(gd, `done: ${J.verb}`); this.settle(S, gd, J, line, true);
  }
  /** the hand comes off (eased by the layer), and the job's clock is stopped: it starts over when he is on the thing again */
  private handOff(gd: Guard, J: Job) { J.t0 = -1; const H = this.hands.get(gd.char); if (H && H.until === Infinity) { H.until = this.g.time + WORK.fadeSecs; H.push = { ...H.push, w: 0 }; } }
  /** done with it, one way or another: a word, the hand off, and a plain hold where he stands — his back to the thing if he was at it (`turn`) */
  private settle(S: SquadOrders, gd: Guard, J: Job, line: string | null, turn: boolean) {
    const g = this.g, p = gd.char.pos, th = J.thing;
    this.handOff(gd, J); this.jobs.delete(gd); if (line) g.say(gd, line);
    S.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: turn ? Math.atan2(th.n[0], th.n[2]) : gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: turn ? `holding · ${th.name}` : 'holding', setLine: null });
  }
  /** game.ts handsOnDoors: the hand a man at work has out (null: none — every other character, and all of them with the switch off) */
  hand(c: Character): DoorPush | null {
    const H = this.hands.get(c), now = this.g.time; if (!H) return null;
    if (H.until === Infinity && now - H.seen > 0.25) { H.until = now + WORK.fadeSecs; H.push = { ...H.push, w: 0 }; }   // (his order no longer ticks with it out: the fight has him)
    if (now > H.until || now < H.seen - 1) { this.hands.delete(c); return null; }   // (… or the clock has gone back under it: a restart)
    return H.push;
  }
  /** how long the work on a thing takes from the hand going out, s */
  private needOf(verb: WorkVerb): number { return WORK.handSecs + (verb === 'drive' ? DRIVE_SECS : verb === 'defuse' ? this.g.defuse.workSecs : WORK.breakerSecs); }
  /** what the hand `hand(c)` has out is doing, for whoever poses it: the verb, the seconds since it went out and the seconds the work takes (null: no hand
   *  out). `secs` runs on through the fade after the work is done or dropped; a read only, nothing here is written */
  job(c: Character): WorkJob | null { const H = this.hands.get(c); return H ? { verb: H.verb, secs: Math.max(0, this.g.time - H.t0), need: H.need } : null; }
  /** he is at work and stood on the spot his thing is worked from (workPasses) */
  atThing(gd: Guard): boolean { const J = this.jobs.get(gd); return !!J && this.working(gd) && !!J.A.arrived && !!J.thing.stand && flat(gd.char.pos, J.thing.stand) < 0.45; }
  /** is this man working a thing (a probe, the HUD) */
  working(gd: Guard): boolean { const J = this.jobs.get(gd); return !!J && gd.state !== 'dead' && this.g.orders.of(gd) === J.A; }
  /** the man an order has on a defuse mission's charge i (defuse.ts: the objective row's 'charge 1 · Red One on it'): `on` = his hand is on it NOW (his
   *  order ticked with it out inside the last quarter second — a man the fight has taken off it reads 'going' until he is back), else he is on his way; a
   *  man with his hand on it is named before one still walking. null: nobody */
  onDevice(i: number): { gd: Guard; on: boolean } | null {
    let best: { gd: Guard; on: boolean } | null = null;
    for (const [gd, J] of this.jobs) if (J.thing.kind === 'device' && J.thing.dev === i && this.working(gd)) {
      const on = J.t0 >= 0 && this.g.time - J.lastT <= 0.25; if (on) return { gd, on }; best ??= { gd, on }; }
    return best;
  }
  private note(gd: Guard, what: string) { this.log.push({ t: this.g.time, who: gd.callsign, what }); if (this.log.length > 200) this.log.splice(0, 50); }
  summary(): string { const th = this.things(), n = [...this.jobs.keys()].filter(gd => this.working(gd)).length; return !WORK.on ? 'off' : `${th.map(x => `${x.name}${x.stand ? '' : ' (no place to stand)'}`).join(' · ') || 'nothing to work'} · ${n} at work · given ${WORK_STATS.given} done ${WORK_STATS.done} moot ${WORK_STATS.moot}`; }
}

/** orders.ts targetAt: a thing a teammate can work near a point (null: none, or the switch is off) */
export function workNear(g: Game, at: Vec3): { d: number; target: OrderTarget } | null { return WORK.on && g.work ? g.work.near(at) : null; }
/** orders.ts targetUnder: the thing whose own box the cursor is on (null: none, or the switch is off) */
export function workOn(g: Game, box: Box | undefined): OrderTarget | null { return WORK.on && g.work ? g.work.on(box) : null; }
/** orders.ts rowsFor */
export function workRows(g: Game, t: OrderTarget, page: string | null, rows: OrderDef[]): OrderDef[] { return WORK.on && g.work ? g.work.rows(t, page, rows) : rows; }
/** game.ts handsOnDoors */
export function workHand(g: Game, c: Character): DoorPush | null { return g.work ? g.work.hand(c) : null; }
/** roomfight.ts's eyes and what turns a man with nobody in his sight (a mate's call, footfalls), beside the pair's pairPasses: A MAN STOOD AT THE THING HE
 *  WAS SENT TO WORK DOES NOT TAKE AS A TARGET, OR TURN TO LOOK FOR, A MAN HIS ROUND IS HELD FOR — the squad's fire is held and that man has noticed nobody
 *  (silent.ts silentHolds: the silent order, the sneak, the hold nobody has lifted; each wants him neither alert nor searching and under its `noticed` bar).
 *  With his muzzle on such a man the room fight kept his chest turned to him, the order kept turning it back to the thing, and for as long as the hold stood
 *  the thing was never worked. He does what he was sent to do; a man who covers him (give(): spare eyes behind him, when he has a partner) has that man. The
 *  frame that hold no longer holds his round (the man has noticed, the alarm is up, the hold is lifted) this is false and the fight has him as ever: the
 *  hand comes off (tick). Only AT the thing: on the walk there his gun goes onto whoever he sees, as it did. NOT passed, his gun staying on them as before:
 *  a man held only by spotted.ts's rule (suspicious, or roused and no danger yet) or only for a pane in the way (silentGlassHolds) — each has noticed
 *  something, and a back turned on him would be the dumber thing. False with the switch or `heldPass` off. */
export function workPasses(g: Game, gd: Guard, h: Guard): boolean {
  if (!WORK.on || !WORK.heldPass || !g.work) return false;
  return g.work.atThing(gd) && silentHolds(g, gd, h);
}
/** a pose layer's read beside workHand: what that hand is doing and how far in (null whenever workHand is null) */
export function workJob(g: Game, c: Character): WorkJob | null { return g.work && g.work.hand(c) ? g.work.job(c) : null; }
/** lighting.ts: is the breaker none of this man's business unless he is told (a teammate, with the switch on) */
export function workNotHis(gd: Guard): boolean { return WORK.on && gd.team === 'operative' && !!gd.unit; }
/** lighting.ts setBlackout: a man who cannot leave where he stands (held on his mark, pinned to it, or walked by a script: a room fight's defenders, a posted response man)
 *  is not handed the 'check the breaker' errand. He said he was going and never went. It goes to the nearest man who can walk it, or to nobody.
 *  Not under a show, whose held men and their lines are staged. */
export function workStaysPut(g: Game, gd: Guard): boolean { return WORK.on && WORK.posted && !g.touring && !g.quietUtility && (gd.hold || gd.pinned || !!gd.script); }
