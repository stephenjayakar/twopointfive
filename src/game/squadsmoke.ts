// TEAMMATES' SMOKE, THROWN ON ORDER — "smoke there".
//
// The maintainer, on what a kit should hold (10-08): "same goes for flash bangs, smoke grenades, frag grenades, dynamic hammer, etc." The stun canisters, the
// frags and the charges were already a teammate's to carry; smoke was Sam's alone. Here a teammate's card may carry smoke canisters (kit.ts: a teammate's 'smoke' row,
// none as issued) and the squad has one counted order on a spot of FLOOR: the nearest man of those the order goes to who has a throw to the spot throws one,
// says so, and the can is the very can Sam throws from slot 3 — combat.ts updateItems runs its fuse (1.3 s from the hand) whoever threw it and startCanister
// vents it where it lies, pop and all. Nothing of the smoke itself is touched here.
//
// THE COUNT is the squad's, as the stun canisters' is (one pool: whoever stands best throws, whoever's card it rode in on): what the cards of the men who came
// carry, set on EVERY staging by kit.ts kitStage — with the table off, or no card carrying one, that is 0, so a restart never keeps an old count.
// THE ROW is on the menu only while this staging brought a can ('smoke there · N left', under 'hold position' on a floor target): with every card as issued
// it is not registered, no line is on the HUD, nothing here runs but one map read a frame, and a run digests as it did before this file. It has a key of
// its own (SQUADSMOKE.orderKey — H — with the menu up: X, then H; the wheel reaches it too): the floor menu's five digits are all taken. It is greyed, not
// gone, when the cans are spent ('no smoke left.') or nobody addressed has a throw ('no throw from here.').
// THE THROW is the door tools' own (doortools.ts, the bang's): ItemPool.solve at 9 m/s from the thrower's hand, the item spawned on its arc, the quick toss.
// He throws it to COME TO REST on the spot, not to land on it: a can lands and runs on (a third of a metre thrown at his feet, three at the end of his arm),
// so the arc is aimed short by the run its bounces will take (`squadSmokeRest`). A throw is CLEAR when that arc comes DOWN ON THE FLOOR, would come to rest within
// `nearM` of the spot, and has nothing solid between where it lands and the spot (the solver's `land` is the arc's first impact: one up a wall, a pane or
// a shut leaf short of the spot is not a landing — frag.ts learned the same) — about 12 m is as far as a can gets, lobbed and run out, and NOBODY WALKS to
// make one: the order is for a man who is already near. He does not turn for it either (he keeps the order, the drill or the fight he is on: the row is
// `free` — no owner is asked to let go of him), so the can leaves the hand of a man who may be facing elsewhere. A man whose hands are on a lock's tools is
// passed over. The row being `free`, orders.ts does not log it; the throw files its own row in the squad's order log (an order WAS given: the rescue's
// clock starts on it as on any other).
// A SILENT squad may throw one: the pop is a quiet event (startCanister files it, as for Sam's), not gunfire, and the row is not one of silent.ts's loud ones.
//
// State is per Game in a WeakMap (as silent.ts keeps its own): nothing on the Game, nothing in the digest, nothing in a checkpoint (none is taken with a unit
// on the floor). Probes: tools/qa/squadsmoke-probes.ts (`probes.ts squadsmoke`).
import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Input } from './input';
import type { OrderDef, OrderNote } from './orders';
import type { ThrowSolution } from './throwables';
import { GRAVITY } from './throwables';
import { bogRun, snowBogAt } from './snowBog';
import { TOSS_QUICK } from './character';

export const SQUADSMOKE = {
  /** the row's own key, read while a menu that lists the row is up (game.ts → squadSmokeKey). Not a digit: the floor menu's five are taken */
  orderKey: 'KeyH',
  /** the throw's speed out of the hand (m/s — the door tools' own for a can) */
  speed: 9,
  /** a throw is clear when the can would come to rest within this of the spot (m), its arc down on the floor (no higher than `floorM` over the spot's own floor: not up a wall — even low on one —, not onto
   *  a desk), with nothing in the way of its run from the landing to the spot at either of `clearH` (m: the can's own height, and a shin's) */
  nearM: 1.0, floorM: 0.035, clearH: [0.07, 0.3],
  /** how far a can runs on past its landing, on open floor: this × its pace over the floor × the speed it comes down at (m — the sum of its bounces, each of
   *  which keeps 0.7 of the pace and 0.38 of the drop: throwables.ts; measured over 118 throws on the office floor, 0.3 m to 3.3 m) */
  rollK: 0.061,
  /** the hand the can leaves: this far ahead of him toward the spot (m), this high (m) — or `headDrop` under his head, if that is lower (a man down on a knee) */
  handAhead: 0.35, handUp: 1.3, headDrop: 0.3,
  /** one man's next can no sooner than this after his last (s): the toss has to finish */
  againSecs: 1.2,
};
export const SMOKE_ORDER = 'smokeThere';
interface State { /** what this staging brought · what is left of it */ brought: number; cans: number; noted: boolean; last: WeakMap<Guard, number>; }
const states = new SideMap<Game, State>('squadsmoke.states');
export const SQUADSMOKE_STATS = { staged: 0, thrown: 0 };
/** every can thrown on the order, newest last (QA; capped) */
export const SQUADSMOKE_LOG: { t: number; who: string; from: Vec3; at: Vec3; land: Vec3; rest: Vec3; left: number }[] = [];

const flat = v3.distXZ;
/** the squad's smoke canisters left this run (0: none brought, or all thrown) · what this staging brought */
export function squadSmokeLeft(g: Game): number { return states.get(g)?.cans ?? 0; }
export function squadSmokeBrought(g: Game): number { return states.get(g)?.brought ?? 0; }

/** A SCENARIO HAS JUST STAGED ITS TEAM (kit.ts kitStage, every staging): the squad's smoke for this run is `cans`, and the row is on the menu only if that is
 *  one or more. */
export function squadSmokeStage(g: Game, cans: number) {
  const n = Math.max(0, Math.floor(cans) || 0); let s = states.get(g);
  if (!s) { if (!n) return; states.set(g, s = { brought: 0, cans: 0, noted: false, last: new SideMap() }); }   // (never a can on this Game: nothing kept, nothing registered)
  s.brought = s.cans = n; s.last = new SideMap(); SQUADSMOKE_STATS.staged++;
  const S = g.orders; S.unregister(SMOKE_ORDER);
  if (!n) return;
  const after = S.defs.findIndex(d => d.id === 'hold');   // (its place: straight under the floor's own four, above whatever a later part has added)
  S.register(row(g), after >= 0 ? S.defs[after + 1]?.id : undefined);
  if (!s.noted) { s.noted = true; S.notes.push(() => notes(g)); }
}

/** where a can thrown from `from` on `sol` comes to rest on open floor: its landing, and the run of its bounces past it (SQUADSMOKE.rollK; `rollK`: another
 *  body's run — squadthrow.ts's frag) */
export function squadSmokeRest(from: Vec3, sol: ThrowSolution, rollK = SQUADSMOKE.rollK): Vec3 {
  const v = sol.v0, L = sol.land, k = rollK * Math.sqrt(Math.max(0, v[1] * v[1] + 2 * GRAVITY * (from[1] - L[1])));
  return [L[0] + v[0] * k, L[1], L[2] + v[2] * k];
}
/** nothing between a can down at `a` and the spot `b` for its run along the floor: the item pool's own test (statics and leaves, then loose furniture) */
function runClear(g: Game, a: Vec3, b: Vec3): boolean {
  const d = flat(a, b); if (d < 0.05) return true; const rd: Vec3 = [(b[0] - a[0]) / d, 0, (b[2] - a[2]) / d], back = 0.12;   // (from a hand's width behind the landing: one at the very foot of a wall starts on its face)
  for (const h of SQUADSMOKE.clearH) {
    const ro: Vec3 = [a[0] - rd[0] * back, a[1] + h, a[2] - rd[2] * back];
    if (g.col.solidBlocked(ro, [b[0], a[1] + h, b[2]]) || g.col.raycast(ro, rd, d + back) || g.props.raycast(ro, rd, d + back)) return false;
  }
  return true;
}
/** has this man a hand for a throw right now (hands on a lock's tools stay there; a man doubled over or blind
 *  throws nothing) — squadthrow.ts asks it too */
export function squadHandFree(g: Game, gd: Guard): boolean { return !(gd.state === 'dead' || gd.char.anim.lockpick || g.time < gd.staggerUntil || g.time < gd.dazzledUntil); }
/** ONE MAN'S THROW to a spot: the hand it leaves, the arc that brings the thing to REST on the spot, where it rests (null: he has none — his hand would be in
 *  a wall, the arc's first impact is not the floor by the spot, or something stands in its run). `rollK`: the run of the body thrown (default: a can's);
 *  squadthrow.ts asks it for a frag and a stun canister */
export function squadArcTo(g: Game, gd: Guard, at: Vec3, rollK = SQUADSMOKE.rollK, stood?: Vec3): { from: Vec3; sol: ThrowSolution; rest: Vec3 } | null {
  const K = SQUADSMOKE, to: Vec3 = [at[0], at[1] + 0.05, at[2]];
  // (`stood`: the throw he would have standing THERE as he stands now — squadthrow.ts's walk to a throw; absent: from where he is)
  const p = stood ?? gd.char.pos, d = flat(p, at), k = d > 1e-3 ? K.handAhead / d : 0, head = gd.char.bones.head;
  const up = Math.max(0.6, Math.min(K.handUp, head ? head[1] - gd.char.pos[1] - K.headDrop : K.handUp));
  const from: Vec3 = [p[0] + (at[0] - p[0]) * k, p[1] + up, p[2] + (at[2] - p[2]) * k];
  if (g.col.solidBlocked([p[0], p[1] + up, p[2]], from)) return null;   // (his hand would be in the wall he stands against)
  // (in lying snow the thing runs on less far than on a floor, or not at all: snowBog.ts bogRun — × 1 with SNOWBOG off or no snow under its landing)
  const restOf = (s: ThrowSolution) => squadSmokeRest(from, s, rollK * bogRun(snowBogAt(g, s.land[0], 0, s.land[2])));
  let aim = to, sol = g.items.solve(from, aim, K.speed), rest = restOf(sol);
  for (let i = 0; i < 2; i++) {   // (aimed short by the run-on: twice round is within a hand's width)
    aim = [aim[0] + at[0] - rest[0], to[1], aim[2] + at[2] - rest[2]]; sol = g.items.solve(from, aim, K.speed); rest = restOf(sol);
  }
  const L = sol.land;
  if (L[1] - at[1] > K.floorM || flat(rest, at) > K.nearM) return null;   // (its first impact is up a wall / a leaf / on a desk, or it would stop short of the spot or run past it)
  if (!runClear(g, L, at)) return null;   // (down on the floor, but with a wall, a pane, a leaf or a piece of furniture between it and the spot)
  return { from, sol, rest };
}
/** the man of `men` who would throw it, with his throw: the nearest to the spot with an arc that brings the can to rest on it (null: none of them has one) */
export function squadSmokeThrower(g: Game, men: Guard[], at: Vec3): { gd: Guard; from: Vec3; sol: ThrowSolution; rest: Vec3 } | null {
  const K = SQUADSMOKE, s = states.get(g);
  for (const gd of [...men].sort((a, b) => flat(a.char.pos, at) - flat(b.char.pos, at))) {
    if (!squadHandFree(g, gd)) continue;
    if (s && g.time - (s.last.get(gd) ?? -1e9) < K.againSecs) continue;
    const arc = squadArcTo(g, gd, at); if (arc) return { gd, ...arc };
  }
  return null;
}

function row(g: Game): OrderDef {
  return { id: SMOKE_ORDER, hotKey: SQUADSMOKE.orderKey, label: () => `smoke there · ${squadSmokeLeft(g)} left`, targets: ['floor'], free: true,
    // (the order is one man's — the thrower's: nobody else answers, and no drill is asked to let go of anybody)
    only: (_S, men, t) => { const th = squadSmokeThrower(g, men, t.at); return th ? [th.gd] : []; },
    valid: (_S, t, men) => squadSmokeLeft(g) <= 0 ? 'no smoke left.' : squadSmokeThrower(g, men, t.at) ? true : 'no throw from here.',
    issue: (S, men, t) => {
      const s = states.get(g), th = s && s.cans > 0 ? squadSmokeThrower(g, men, t.at) : null;
      if (!s || !th) return 'no throw from here.';   // (never reached through the menu: `valid` has refused it in its own words first)
      s.cans--; s.last.set(th.gd, g.time);
      // the door tools' own lines for a can (doortools.ts), with 'smoke': on its own fuse from the hand, as Sam's
      const it = g.items.spawn('smoke', th.from, th.sol.v0, { who: th.gd.char.id, heading: v3.yawOf(th.sol.v0) });
      it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
      th.gd.char.anim.tossItem(TOSS_QUICK); g.say(th.gd, 'smoke out.');
      S.log.push({ t: g.time, order: SMOKE_ORDER, who: [th.gd.callsign], target: `floor:${t.at[0].toFixed(1)},${t.at[2].toFixed(1)}` });   // (the squad's order log, in orders.ts's own words for a floor order: a `free` row is not logged there)
      SQUADSMOKE_STATS.thrown++; SQUADSMOKE_LOG.push({ t: g.time, who: th.gd.callsign, from: th.from, at: v3.copy(t.at), land: v3.copy(th.sol.land), rest: th.rest, left: s.cans }); if (SQUADSMOKE_LOG.length > 100) SQUADSMOKE_LOG.splice(0, 50);
    } };
}
/** the squad's HUD block: what is left, while this staging brought any */
function notes(g: Game): OrderNote[] { const s = states.get(g); return s && s.brought > 0 ? [`smoke ${s.cans}`] : []; }

/** The row's key with a menu up that lists it: the press is that row's — given, or refused in the row's words. Called straight after the menu's own input
 *  (game.ts, beside the door tools' menuKey). True: the press was the row's. */
export function squadSmokeKey(g: Game, input: Input): boolean {
  const S = g.orders, M = S.menu, key = SQUADSMOKE.orderKey; if (!M || !states.has(g) || !input.hit(key)) return false;
  const i = M.rows.findIndex(d => d.id === SMOKE_ORDER); if (i < 0) return false;
  input.pressed.delete(key); S.pick(i); return true;
}
export function squadSmokeSummary(g: Game): string {
  const s = states.get(g); return s && s.brought ? `${s.cans} of ${s.brought} left · ${SQUADSMOKE.orderKey.replace('Key', '')} with the menu up on a spot of floor` : 'none brought (no card carries smoke)';
}
