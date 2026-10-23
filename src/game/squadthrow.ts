// TEAMMATES' FRAGS AND STUN CANISTERS, THROWN ON ORDER — "frag there" / "bang there".
//
// The maintainer (10-13): "would be nice to be able to instruct teammates to throw frags/stuns". Until here a teammate's grenade left his hand only as part
// of a door order (bang and clear, frag and clear). Here the squad has two counted orders on a spot of FLOOR, behind one row of the floor's menu:
//
//   X on a spot of floor · G ('throw ▸', a page) · 1 = frag there · 2 = bang there.      Nothing held, no digit above 2 on the page, Esc / right click = back.
//
// THE COUNT is the door tools' own (doortools.ts `frags` / `bangs`: one bag, whoever's hand it leaves) — what the squad block already shows. No kit of its own.
// WHO THROWS: of the men the menu goes to, the nearest with a throw to the spot — squadsmoke.ts's own test (`squadArcTo`: the hand, the arc solved to bring the
// thing to REST on the spot, down on the floor, its run clear) and its own exclusions (`squadHandFree`) + `handsBusy` (the man setting a charge, on a door's
// handle or boot, with a hand on a thing he works, or changing a magazine is passed over), a stun canister with the smoke can's run (one body:
// throwables.ts) and a frag with its own (SQUADTHROW.fragRollK, measured). The rows are `free` and `only` the thrower's: nobody else answers.
// HE WORKS HIS THROW OUT (SQUADTHROW.lob / duck / samCall; the maintainer, 10-15: "ordering your squad to throw a grenade is still pretty useless. they should
// figure out how to throw to a spot"). Measured on the office, the four holding by the player: a frag was refused on 88 % of the floor he could see ('you are
// in it.': a frag reaches 9 m) and had no throw to two spots in three of the rest. Three rules, each its own key under the switch: `lob` — where the straight
// arc has no answer a man flies a few throws in his head (throwplan.ts: the pool's own flight) and takes one that goes off by the spot — another pace, a
// bank off a wall beside it — from where he stands, else from floor he walks to; `duck` — a man of ours who will be off a frag's line before it bursts (the
// squad steps off its own frag: frag.ts fragFlee) is not a reason to refuse it, nor to pass over floor to throw from; `samCall` — a frag that reaches the
// player alone is his call, named on the row. The order of asking: the straight arc from where a man stands, a worked-out throw from where a man stands,
// a walk to the straight arc, a walk to a worked-out throw.
// A MAN WITH NO THROW WALKS TO ONE (SQUADTHROW.walk; the maintainer, 10-13: "it would be good to have the squad move to do a throw (and maybe visualize who's
// doing it and the path on the ground?)"). Where nobody addressed has a throw from where he stands, `walkSpot` floods the walk grid out from each man who may
// be walked off (hand free; no drill, door tool or wall charge has him; not in a fight; under no order or one he can be handed back: move / stack / cover /
// hold / fall in) — over floor the squad knows, never through a shut leaf, at most `walkM` — and takes the FIRST cell (the fewest steps: the edge of where a
// throw opens, not the middle of it) from which the same arc test passes for a man standing there, he himself outside what it does, and the orders' router
// has a way. He is walked there by `SquadOrders.assign` under the row's own id (so anything that draws an order's man, way and mark draws this), the can
// still in the bag; on the spot he turns to it, the sense above is asked again of the floor as it stands, the can is taken and thrown, and (`back`) he walks
// back to where he stood and to the order he had. Stopped short, he looks once more for a spot from where he is; nothing = his word and back. Any other order
// to him ends it (nothing thrown, nothing spent). Off = 'no throw from here.', as it was.
// THE PICTURE (`squadThrowPlans`, drawn by ui/squadthrowviz.ts on the overlay behind SQUADTHROW.draw): who throws (a ring at his feet in his element's
// colour), his walk, the arc, where it rests — for the highlighted row while the throw page is up, and from the order until the thing leaves his hand.
// THE THROW is the door tools' own: the frag on FRAG.orderFuse from the hand, the canister on combat.ts flashFuse from its landing, the quick toss, his word
// ('frag out!' / 'bang out!'). Each goes off by the game's own road (combat.ts updateItems → frag.ts / detonateStun) under the thrower's id: nothing borrowed.
// SENSE, asked when the menu is read and again as the order is given (nothing is spent on a refusal):
//   none left · no arc for anybody addressed · A FRAG NEVER ONTO ITS OWN: the player, any teammate still breathing (the thrower too; a man down wounded or out cold counts), a hostage, the man to take
//   alive or a civilian inside the reach the door tools ask of a frag (FRAG.woundM + 1, a line by frag.ts exposedTo) of where it would rest or of the spot
//   itself = refused, naming who. A STUN is not refused for its own side — it is the player's call — but its row NAMES who of ours it would catch
//   (' · too close: you, Red One'), by detonateStun's own tests asked from where it would rest and from the spot, each reach a metre long: it may over-warn.
// A SILENT squad: both rows are silent.ts LOUD_ROWS (marked, and giving one takes the squad out of silent).
// THE SQUAD BLOCK shows the throw for SQUADTHROW.shownSecs ('Red Two · frag out').
//
// SQUADTHROW.on: off in the module and on the frozen stand; on in the page (host/profile.ts). The rows are put on / taken off the menu by squadThrowKey, once
// a frame, so a switch thrown live holds from the next frame. Off, and never on for this Game: one map read a frame. On with nothing ordered: rows on a menu.
//
// State is per Game in a WeakMap: whether the rows are on, each man's last throw (the toss has to finish), what the squad block is showing, the stun row's
// warning as last read. None of it is in a checkpoint — none is taken with a unit on the floor, and all of it is seconds old at most. No dice of its own:
// the thrown thing draws the game's die as any thrown item does (throwables.ts spawn). 'Nobody of ours in it' is asked AT THE THROW, of where each stands then.
// Check: tools/qa/squadthrow-check.ts (`probes.ts squadthrow`).
import { SideMap, rollbackVar } from '../math/side';
import type { Vec3 } from '../math/vec';
import { v3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import { isBreathing } from './game';
import type { Input } from './input';
import type { Assignment, OrderDef, OrderNote, OrderTarget, SquadOrders } from './orders';
import type { ThrowSolution } from './throwables';
import * as fx from './effects';
import { TOSS_QUICK } from './character';
import { FRAG, exposedTo, fleeMates, fleeSpot } from './frag';
import { FLASH, flashFuse } from './combat';
import { fightLive } from './roomfight';
import { SAMSTUN } from './samstun';
import { WORDS, wg } from './words';
import { squadArcTo, squadHandFree } from './squadsmoke';
import { workHand } from './workthings';
import { teamBlastPace } from './teampace';
import { bodyPos, PACE } from './guards';
import { loadPace, loadPaceOn } from './kitload';
import { conditionPace } from './condition';
import { PICTURE_STATS } from './picture';
import { squad40Word } from './squad40';   // (called inside a row's label only)
import { throwTo, throwWalls, throwFlight, throwHits } from './throwplan';   // (called inside the searches only: src/game is one import cycle)

export const SQUADTHROW = {
  on: false,
  /** how far a frag runs on past its landing: this × its pace over the floor × the speed it comes down at (squadsmoke.ts squadSmokeRest; a frag is a smaller,
   *  deader body than a can — throwables.ts FRAG_ITEM; measured headless on the office's floor, throws of 3 m to 12 m: where the fuse found it was a mean
   *  0.11 m and at most 0.30 m from the spot at 0.04, 0.15 / 0.33 at 0.045, 0.28 / 0.69 at 0.05) */
  fragRollK: 0.04,
  /** one man's next throw no sooner than this after his last (s) */
  againSecs: 1.2,
  /** the squad block names the throw this long (s) */
  shownSecs: 2.5,
  /** the stun row's warning asks detonateStun's reaches this much long (m): where it goes off is where it has run to when its fuse ends */
  slackM: 1,
  /** A MAN WITH NO THROW FROM WHERE HE STANDS WALKS TO WHERE HE HAS ONE, throws, and goes back (off: nobody walks — 'no throw from here.', as it was) */
  walk: true,
  /** … no further than this over the walk grid (m) · never from nearer the spot than this (m) · nor from further than a hand throws (m) */
  walkM: 12, minM: 1.5, maxM: 11.5,
  /** cells whose arc is asked in one search at most (each up to five arcs, ~0.2 ms an arc) · a search's answer is kept this long for the menu's and the picture's re-reads (s; an order GIVEN asks afresh) */
  tries: 12, keepSecs: 0.4,
  /** he gives the walk up after this long on it (s; time the fight has him is not counted) · on his spot he turns to the throw for this long at most (s) · the toss: he stays this long after it leaves his hand (s) */
  walkSecs: 16, turnSecs: 1.2, tossSecs: 0.5,
  /** thrown, he walks back to where he stood and to the order he had (off: he holds where he threw from) */
  back: true,
  /** the picture on the overlay: who throws, his walk, the arc, where it rests (off: none — a module that draws the squad's plan may fold `squadThrowPlans` in and put this off) */
  draw: true,
  /** A MAN WORKS HIS THROW OUT (throwplan.ts; on with the switch, off = the one straight arc that rests on the spot, as it was; `?throwlob=0`): where the
   *  straight arc has no answer he flies a few throws before he makes one — straight at the spot at `lobPaces` (m/s over the ground: the solver's, flat and
   *  hard, a slow lob) and at up to `lobWalls` walls that stand within `lobWallM` of it (met `lobWallH` up; `lobBankPaces`) — and takes the one that GOES OFF
   *  nearest the spot: within `lobNearM` of it, no more than `lobUpM` over its floor, nothing solid between. No throw leaves the hand faster than `lobSpeed`
   *  (the player's own arm). A throw is taken only if it still goes off by the spot stepped at each of `lobSteps` (the page steps at the display's rate; the forecast at a sixtieth). A search flies `lobSims` throws at most, over `lobCells` cells of floor at most, and its answer is kept `lobKeepSecs`. A walker who gets there is given `settleSecs` to come to a stand before his throw is asked for again (the hand of a man still walking is lower than the hand the search threw from). A man who would be inside his own frag where he stands is passed over for the next
   *  man, or a walk, instead of the row being refused in his name. */
  lob: true, lobPaces: [7.5, 10, 5] as readonly number[], lobBankPaces: [10, 7.5] as readonly number[], lobSpeed: 11, lobNearM: 1.5, lobUpM: 1.2, lobWalls: 12, lobWallM: 3, lobWallH: 0.9, lobSims: 48, lobCells: 10, lobKeepSecs: 1, settleSecs: 0.5, lobSteps: [1 / 120, 1 / 40] as readonly number[],
  /** A FRAG WHERE THE PLAYER HAS A LINE IS HIS CALL (on with `lob`; off = refused 'you are in it.', as it was; `?samcall=0`): the row is given all the
   *  same and NAMES him (' · too close: you'), as the stun row always has. The rings on the floor show the reach; 'frag out!' is the warning. Inside
   *  `duckMinM` of it (what it kills at) it is refused for him as before. His own men, hostages and civilians in it still refuse it. */
  samCall: true,
  /** A MAN WHO WILL BE OFF ITS LINE WHEN IT BURSTS IS NOT 'IN IT' (on with `lob` and with frag.ts FRAG.fleeWise, the flee it counts on; off = anybody of ours the burst has a line to refuses it, where he
   *  stands, as it was; `?throwduck=0`). The squad steps off its own frag the moment 'frag out!' is called (frag.ts fragFlee: every man in its line is dealt
   *  the spot his legs make before the fuse — at the squad's pace, never a sprint). The order now asks the same question BEFORE it throws: a teammate on
   *  his feet whose dealt spot the burst has no line to — with `duckSecs` of the fuse in hand, `duckThrowSecs` more for the man whose arm is still coming
   *  down — is not a reason to refuse, and a cell the thrower can duck from is a cell he may throw from. A man with nowhere to go still refuses it, by
   *  name — and so does one whose spot is within `duckApartM` of where another of ours stands or is going (two men to one corner leaves one out in it; with frag.ts FRAG.fleeApart on, the spot is asked for with the deal's own list of that floor, `fleeMates`, and of the man himself, as the deal asks; with it off, as before). Nobody within `duckMinM` of it (FRAG.lethalM and a metre) is asked to duck at all. A search asks it of `duckCells` cells at most. */
  duck: true, duckSecs: 0.5, duckThrowSecs: 0.2, duckCells: 16, duckApartM: 1.0, duckMinM: 5,
};
export const THROW_PAGE = 'throw', THROW_OPEN = 'throwThere', FRAG_THERE = 'fragThere', STUN_THERE = 'stunThere';
export type SquadThrowKind = 'frag' | 'stun';
type Arc = { from: Vec3; sol: ThrowSolution; rest: Vec3 };
/** a throw and the man to make it; `post`: the floor he walks to first (absent: he throws from where he stands) */
export type SquadThrower = Arc & { gd: Guard; post?: Vec3 };
/** a man on his way to a throw: the spot asked for, the floor he throws from, the arc as planned, the assignment that walks him (`A`: another one in its place = re-ordered),
 *  seconds on it, where he stood and what he was doing (`back`), his way as planned (the picture's) */
interface Walk extends Lent { kind: SquadThrowKind; at: Vec3; post: Vec3; arc: Arc; spent: number; lastT: number; onT: number; thrownT: number; again: number; held?: Arc | null; heldAt?: Vec3; heldT?: number; line: Vec3[]; }
/** A MAN TAKEN OFF WHAT HE WAS DOING, TO BE HANDED BACK (`squadLend` / `squadHandBack`: the walk to a throw here, the turn to a shot in squad40.ts): the men who
 *  shared his order, the target the order was given on, the assignment that has him meanwhile (`A`: another one in its place = re-ordered), where he stood
 *  and what he was doing (`back`: null = nothing he can be handed back) */
export interface Lent { mates: Guard[]; gd: Guard; t: OrderTarget; A: Assignment | null; home: Vec3; homeYaw: number; back: (Pick<Assignment, 'order' | 'post' | 'face' | 'going' | 'there'> & Partial<Assignment>) | null; }
interface Scratch { n: number; gen: number; seen: Int32Array; leaf: Int32Array; dep: Uint8Array; who: Uint8Array; q: Int32Array; }
interface State { last: WeakMap<Guard, number>; noted: unknown; shown: { t: number; text: string } | null; warn: { key: string; text: string } | null; warnFrag: { key: string; text: string } | null; caught: { key: string; t: number; who: string | null } | null;
  /** (lob) the men each row's search was last asked of, by `only`: the row's own question is put to the same men (rows, `ask`) */ asked: Map<SquadThrowKind, { key: string; men: Guard[] }>;
  walks: Map<Guard, Walk>; kept: Map<string, { key: string; t: number; th: SquadThrower | null; line: Vec3[] | null }>; scratch: Scratch | null; }
const states = new SideMap<Game, State>('squadthrow.states');
export const SQUADTHROW_STATS = { thrown: 0, frags: 0, stuns: 0, refused: 0, walks: 0, walked: 0, gaveUp: 0, searches: 0, arcs: 0, ducks: 0, cells: 0 };
/** every one thrown on the order, newest last (QA; capped) */
export const SQUADTHROW_LOG: { t: number; kind: SquadThrowKind; who: string; from: Vec3; at: Vec3; land: Vec3; rest: Vec3 }[] = [];

const flat = v3.distXZ;
const keyOf = (at: Vec3) => `${at[0].toFixed(2)},${at[2].toFixed(2)}`;
const left = (g: Game, kind: SquadThrowKind) => kind === 'frag' ? (FRAG.on ? g.doorTools.frags : 0) : g.doorTools.bangs;
const word = (kind: SquadThrowKind) => kind === 'frag' ? 'frag' : 'bang';   // (the order menu's one word for this can: 'bang, then go in' at a door, 'bang there' on the floor, 'bang out!' in his mouth — the kit page and the HUD name the thing, a stun canister)
const none = (kind: SquadThrowKind) => kind === 'frag' ? (FRAG.on ? 'no frags left.' : 'no frags in this kit.') : 'no bangs left.';
const rowOf = (kind: SquadThrowKind) => kind === 'frag' ? FRAG_THERE : STUN_THERE;
const rollOf = (kind: SquadThrowKind) => kind === 'frag' ? SQUADTHROW.fragRollK : undefined;
/** his own throw is still in the air: the toss has to finish */
const tossing = (s: State | undefined, g: Game, gd: Guard) => { const t = s?.last.get(gd) ?? -1e9; return g.time >= t && g.time - t < SQUADTHROW.againSecs; };

/** his hands are on something else: he is the man setting a charge on a door or a wall, the man on the handle / the boot of a door order, he has a hand on
 *  a thing he was sent to work, or he is changing a magazine — another man throws, or nobody does (squad40.ts asks it of the man with the launcher) */
export function handsBusy(g: Game, gd: Guard): boolean {
  if (g.doorTools.ops.some(o => o.lead === gd && (o.phase === 'place' || o.phase === 'kick'))) return true;
  if (g.wallCharge.ops.some(o => o.lead === gd && o.phase === 'place')) return true;
  if (workHand(g, gd.char)) return true;
  const O = g.fight.opOf(gd); return gd.reloadT > 0 || (!!O && O.reloadUntil > g.time);
}

/** the man of `men` who would throw it, with his throw: the nearest to the spot with a hand free and an arc that brings the thing to rest on it (null: none) */
export function squadThrower(g: Game, men: Guard[], at: Vec3, kind: SquadThrowKind): { gd: Guard; from: Vec3; sol: ThrowSolution; rest: Vec3 } | null { return standThrow(g, men, at, kind); }
/** what a search under SQUADTHROW.lob carries: the walls by the spot, the flights it has left, `clean` = a frag thrown so catches nobody of ours (the player
 *  apart: the row's own question of him), and `dirty` = the first throw found that did not — what the row is refused by, by name, if nothing clean turns up */
interface Lob { walls: Vec3[]; lim: { n: number }; clean: (th: SquadThrower) => boolean; dirty: SquadThrower | null }
/** … `lob` (SQUADTHROW.lob, asked by the plan only once nobody has a clean straight arc): each man's worked-out throw too (throwplan.ts), and a throw that
 *  would catch one of ours — the thrower in his own frag first of all — is passed over for the next man, or a walk, not a row refused in his name */
function standThrow(g: Game, men: Guard[], at: Vec3, kind: SquadThrowKind, lob?: Lob): { gd: Guard; from: Vec3; sol: ThrowSolution; rest: Vec3 } | null {
  const s = states.get(g);
  for (const gd of [...men].sort((a, b) => flat(a.char.pos, at) - flat(b.char.pos, at))) {
    if (!squadHandFree(g, gd) || handsBusy(g, gd) || tossing(s, g, gd)) continue;
    if (s?.walks.has(gd)) continue;   // (on his way to a throw already: that one first)
    const arc = squadArcTo(g, gd, at, rollOf(kind)) ?? (lob ? throwTo(g, gd, at, kind, undefined, lob.walls, lob.lim) : null);
    if (!arc) continue; const th = { gd, ...arc };
    if (!lob || lob.clean(th)) return th; lob.dirty ??= th;
  }
  return null;
}

/** SQUADTHROW.duck: a man of ours on his feet at `p` is off this frag's line before it bursts — the spot his legs will be dealt when it is called (frag.ts
 *  fleeSpot, the squad's pace, `duckSecs` of the fuse in hand and `late` more) is one the burst has no line to him at, down behind it */
let duckMates: { g: Game; gd: Guard; t: number; x: number; y: number; z: number; m: ReturnType<typeof fleeMates> } | null = null;
rollbackVar('squadthrow.duckMates', () => duckMates, v => { duckMates = v; });   // (a memo keyed by the game's clock)
function fragClears(g: Game, gd: Guard, p: Vec3, pts: Vec3[], late = 0, taken?: Vec3[]): boolean {
  const K = SQUADTHROW; if (!K.lob || !K.duck || !FRAG.fleeWise || gd.held || g.time < gd.staggerUntil || g.time < gd.dazzledUntil) return false;   // (the flee it counts on is the one that runs from where the thing will REST: frag.ts FRAG.fleeWise — without that rule nobody is counted on to duck)
  if (pts.some(L => flat(p, L) < K.duckMinM)) return false;   // (inside what it kills at nobody is asked to duck: a leg that fails there is a man dead, not a man hurt)
  const speed = conditionPace(g, gd, PACE.on ? teamBlastPace(g, gd, FRAG.runSpeed) : FRAG.runSpeed), L = pts[0]; SQUADTHROW_STATS.ducks++;
  // Asked as the deal asks it (frag.ts fragTick) when FRAG.fleeApart is on: of the man himself, so what he knows of the enemy weighs on the corner, and
  // with the deal's own list of the floor his mates have a claim to (`fleeMates`, the same for every cell asked of one throw: kept). The corners forecast
  // for the men asked before him are NOT handed over as legs already run: the deal tells men in the order they hear it, not in this one, so two men
  // forecast to one corner is still a refusal (`taken`, below). A forecast is not a man acting on his picture: the picture's counts are put back.
  const rest: Vec3 = [L[0], L[1] - 0.25, L[2]], M = duckMates;
  const apart = !FRAG.fleeApart ? undefined : M && M.g === g && M.gd === gd && M.t === g.time && M.x === rest[0] && M.y === rest[1] && M.z === rest[2] ? M.m : (duckMates = { g, gd, t: g.time, x: rest[0], y: rest[1], z: rest[2], m: fleeMates(g, gd, rest) }).m;
  const PS = PICTURE_STATS, asks = PS.asks, lines = PS.lines, movedN = PS.moved;
  const spot = fleeSpot(g, { pos: p }, rest, loadPace(g, gd, speed), FRAG.orderFuse - K.duckSecs - late, PACE.on ? PACE.accel * loadPaceOn(g, gd) : Infinity,   /* (kitload.ts: the legs his card leaves him, as the deal itself asks — frag.ts fragTick) */ { path: [], keep: null, apart }, FRAG.fleeApart ? gd : undefined);
  PS.asks = asks; PS.lines = lines; PS.moved = movedN;
  if (!spot || fragIn(g, pts, spot, 1.15)) return false;
  // … and one nobody of ours stands on or is going to (`taken`: the spots dealt to the men asked before him): two men to one corner is one man left out in it
  const near = (q: Vec3) => flat(q, spot) < K.duckApartM;
  if (g.guards.some(o => o !== gd && o.team === 'operative' && o.state !== 'dead' && near(o.char.pos)) || (!g.player.down && near(g.player.char.pos)) || taken?.some(near)) return false;
  taken?.push(spot); return true;
}
const fragPts = (rest: Vec3, at: Vec3): Vec3[] => [[rest[0], at[1] + 0.3, rest[2]], [at[0], at[1] + 0.3, at[2]]];
/** a body at `p` is inside a frag at one of `pts`: the door tools' own test (doortools.ts fragBehind; `reach`: another burst's — squad40.ts's round goes off where it lands, with no run to allow for) */
function fragIn(g: Game, pts: Vec3[], p: Vec3, head = 1.6, reach = FRAG.woundM + 1): boolean {
  return pts.some(L => flat(p, L) < reach && (exposedTo(g, L, p, [p[0], p[1] + head, p[2]]) > 0 || !g.col.solidBlocked([L[0], L[1] + 0.6, L[2]], [p[0], p[1] + 1.1, p[2]])));
}
const stunPts = (rest: Vec3, at: Vec3): Vec3[] => [[rest[0], at[1] + 0.055 + fx.bang.height, rest[2]], [at[0], at[1] + 0.055 + fx.bang.height, at[2]]];
/** an eye is caught by a stun canister going off at one of `pts` (combat.ts detonateStun's tests, each reach SQUADTHROW.slackM long; `full`: the count a watcher of it gets) */
function stunIn(g: Game, pts: Vec3[], eye: Vec3, full: boolean): boolean {
  const B = fx.bang, F = FLASH, entry = F.on && fightLive(g), slack = SQUADTHROW.slackM, cut = (a: Vec3, b: Vec3) => g.col.segmentBlocked(a, b);
  return pts.some(c => {
    const d = v3.dist(eye, c); if (d > B.dazzleRadius + slack) return false;
    const from: Vec3 = [c[0], c[1] + 0.3, c[2]], over: Vec3 = [c[0], c[1] + F.lift, c[2]];
    if (!entry) return !cut(from, eye);
    const seen = !cut(from, eye) || (!cut(from, over) && !cut(over, eye));
    if (seen && full) return true;
    if (d > F.ownM + slack) return false;
    if (seen) return true;
    const pr = g.col.sound.propagate(c, eye); return pr.muffle <= 0.6 && pr.pathLen <= F.concussM + slack;
  });
}

/** the orders he can be handed back when the throw is made */
const RESUMED = ['move', 'stack', 'cover', 'hold', 'fallIn'];
/** may this man be walked off to a throw: no drill owns him, no door tool or wall charge has him, the fight does not, and the order he is under (if any) is one he can be handed back
 *  (squad40.ts asks it of a man it would turn to a shot) */
export function mayWalk(g: Game, gd: Guard): boolean {
  const S = g.orders, A = S.of(gd);
  if (S.owners.some(o => o.owns(gd))) return false;
  if (g.doorTools.ops.some(o => o.men.includes(gd)) || g.wallCharge.ops.some(o => o.men.includes(gd))) return false;
  // (a room fight drives a teammate in 'patrol' with no yield stamp: the man it has a gun on is its `tgt`; a stack's or a stand-off's rear man keeps the squad's back)
  if (gd.state === 'alert' || (A && A.yieldT >= 0) || g.fight.opOf(gd)?.tgt || A?.spare) return false;
  return !A || RESUMED.includes(A.order);
}

/** NOBODY HAS A THROW FROM WHERE HE STANDS: the nearest floor one of `men` has one from, by the walk grid — a flood out from every man who may walk (4-neighbour,
 *  breadth first, so the first cell that passes is the fewest steps for anybody) over floor the squad knows (cleared.ts; the room a man stands in is his), never
 *  across a door's leaf where it stands, at most SQUADTHROW.walkM. A cell passes when: it is minM‥maxM from the spot with a clear line at head
 *  height and from the hand down to it, nobody of ours stands on it, squadArcTo has an arc for a man standing THERE and a short step to each side of there, he would not be in his own frag / caught by his own canister there,
 *  and the orders' router has a way (a lock, a room). At most `tries` arcs a search. `forced`: the man is ours already (his second look, from where he stopped). */
function walkSpot(g: Game, men: Guard[], at: Vec3, kind: SquadThrowKind, forced = false, lob?: Lob): SquadThrower | null {
  const K = SQUADTHROW, S = g.orders, nav = g.col.nav, C = nav.cell, W = nav.W, H = nav.H, s = state(g), col = g.col, rooms = g.cleared;
  const who = men.filter(gd => gd.state !== 'dead' && squadHandFree(g, gd) && !handsBusy(g, gd) && !tossing(s, g, gd) && (forced || (!s.walks.has(gd) && mayWalk(g, gd))))
    .sort((a, b) => flat(a.char.pos, at) - flat(b.char.pos, at)).slice(0, 8);
  if (!who.length) return null;
  let X = s.scratch; if (!X || X.n !== W * H) X = s.scratch = { n: W * H, gen: 0, seen: new Int32Array(W * H), leaf: new Int32Array(W * H), dep: new Uint8Array(W * H), who: new Uint8Array(W * H), q: new Int32Array(W * H) };
  const max = Math.min(250, Math.round(K.walkM / C)), home = who.map(gd => rooms.roomAt(gd.char.pos)), scratch = X; let gen = 0;
  const ours: Vec3[] = g.guards.filter(m => m.team === 'operative' && m.state !== 'dead').map(m => m.char.pos); if (!g.player.down) ours.push(g.player.char.pos);
  SQUADTHROW_STATS.searches++;
  // ONE FLOOD FOR THE STRAIGHT ARC, as it always was; and — SQUADTHROW.lob, only when that found nothing — one more for a throw to work out (`worked`)
  const flood = (worked: boolean): SquadThrower | null => {
  const X = scratch; let head = 0, tail = 0, tries = worked ? K.lobCells : K.tries; gen = ++X.gen; ducks = lob ? K.duckCells : 0;
  who.forEach((gd, k) => { const p = gd.char.pos, x = Math.floor(p[0] / C), z = Math.floor(p[2] / C); if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; if (X.seen[i] === gen) return; X.seen[i] = gen; X.dep[i] = 0; X.who[i] = k; X.q[tail++] = i; });
  for (const d of g.doors.list) {   // (a door's leaf where it stands, shut or open: the cells under it are not walked — nobody opens a door to get a throw)
    if (d.off) continue;
    const hx = d.def.hinge[0], hz = d.def.hinge[1], th = d.def.closedDir + d.angle, ux = Math.cos(th), uz = Math.sin(th);
    for (let u = 0.2; u <= d.def.width; u += 0.2) { const x = Math.floor((hx + ux * u) / C), z = Math.floor((hz + uz * u) / C); if (x >= 0 && z >= 0 && x < W && z < H) X.leaf[z * W + x] = gen; }
  }
  while (head < tail && tries > 0 && !(worked && lim.n <= 0)) {
    const i = X.q[head++], d = X.dep[i], k = X.who[i], gd = who[k], x = i % W, z = (i - x) / W, px = (x + 0.5) * C, pz = (z + 0.5) * C;
    eye[0] = hand[0] = px; eye[2] = hand[2] = pz; SQUADTHROW_STATS.cells++;
    const dist = Math.hypot(px - at[0], pz - at[2]);
    const free = d > 0 && dist >= K.minM && dist <= K.maxM && !ours.some(o => o !== gd.char.pos && Math.hypot(o[0] - px, o[2] - pz) < 0.6);
    // (a line at head height and one from the hand down to the spot: measured over the office, 92 % of such cells have the straight arc and under 6 m no other cell does;
    //  the worked flood: … or a line from the hand to over the spot, or to a wall that stands by it)
    const straight = free && !col.solidBlocked(eye, to) && !col.solidBlocked(hand, floor);
    if ((worked ? free && (straight || !col.solidBlocked(hand, over) || !col.solidBlocked(hand, to) || wallSeen(hand)) : straight) && !inOwn(kind === 'frag' ? fragAt : stunAt, px, pz, gd)) {
      tries--; SQUADTHROW_STATS.arcs++;
      const post: Vec3 = [px, 0, pz], arc = arcAt(gd, post, straight, worked);
      if (arc && !inOwn(kind === 'frag' ? fragPts(arc.rest, at) : stunPts(arc.rest, at), px, pz, gd) && duckHolds(gd, arc, px, pz) && S.reach(gd, post) === null && wayOk(gd, post, home[k])) { const th = { gd, ...arc, post }; if (!lob || lob.clean(th)) return th; lob.dirty ??= th; }
    }
    if (d >= max) continue;
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0), nz = z + (n === 2 ? 1 : n === 3 ? -1 : 0); if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const j = nz * W + nx; if (X.seen[j] === gen) continue;
      if (nav.blocked[j] || X.leaf[j] === gen) { X.seen[j] = gen; continue; }   // (two free cells side by side have no wall between them: the grid keeps a body's radius off every static)
      b[0] = (nx + 0.5) * C; b[2] = (nz + 0.5) * C;
      const r = rooms.roomAt(b); if (r && r !== home[k] && !rooms.isKnown(r)) continue;   // (floor nobody of the squad has been on: not walked for a throw by a man whose own room it is not — left unstamped, so a man whose room it IS may still take it)
      X.seen[j] = gen; X.dep[j] = d + 1; X.who[j] = k; X.q[tail++] = j;
    }
  }
  return null;
  };
  const b: Vec3 = [0, 0, 0], eye: Vec3 = [0, 1.6, 0], to: Vec3 = [at[0], at[1] + 1.6, at[2]], hand: Vec3 = [0, 1.3, 0], floor: Vec3 = [at[0], at[1] + 0.15, at[2]], over: Vec3 = [at[0], at[1] + 1.0, at[2]], rollK = rollOf(kind);
  const fragAt = fragPts(at, at), stunAt = stunPts(at, at);
  /** standing there he would be in his own frag / caught by his own canister (asked of the spot before any arc, of where it rests after) */
  //  (SQUADTHROW.duck: … unless he can be off its line before it bursts — asked of `duckCells` cells a search)
  let ducks = 0;   // (each flood its own count; a cell inside `duckMinM`, where nobody ducks, costs none of it)
  const mayDuck = (pts: Vec3[], px: number, pz: number) => !!lob && K.duck && !pts.some(L => Math.hypot(L[0] - px, L[2] - pz) < K.duckMinM);
  const inOwn = (pts: Vec3[], px: number, pz: number, gd: Guard) => kind === 'frag' ? fragIn(g, pts, [px, 0, pz]) && !(mayDuck(pts, px, pz) && ducks-- > 0 && fragClears(g, gd, [px, 0, pz], pts, K.duckThrowSecs)) : fx.flags.dazzle && stunIn(g, pts, [px, 1.65, pz], false);
  /** an arc for him standing on that cell that still holds a short step to any side of it (he stops within a stride of a mark, not on it): the arc from the cell's middle */
  const side = (n: number): [number, number] => [n === 0 ? 0.3 : n === 1 ? -0.3 : 0, n === 2 ? 0.3 : n === 3 ? -0.3 : 0];
  const arcAt = (gd: Guard, post: Vec3, straight: boolean, worked: boolean): Arc | null => {
    const arc = straight ? squadArcTo(g, gd, at, rollK, post) : null;
    if (arc) { let ok = true; for (let n = 0; n < 4 && ok; n++) { const [ox, oz] = side(n); SQUADTHROW_STATS.arcs++; ok = !!squadArcTo(g, gd, at, rollK, [post[0] + ox, 0, post[2] + oz]); } if (ok) return arc; }
    if (!worked) return null;
    // (the throw he works out standing there — and the SAME throw made a short step to each side still goes off by the spot)
    const th = throwTo(g, gd, at, kind, post, walls, lim); if (!th) return null;
    for (let n = 0; n < 4; n++) { const [ox, oz] = side(n); lim.n--; if (!throwHits(g, throwFlight(g, kind, [th.from[0] + ox, th.from[1], th.from[2] + oz], th.sol.v0).end, at, 0.4)) return null; }
    return th;
  };
  const walls = lob?.walls ?? [], lim = lob?.lim ?? { n: 0 }, wallSeen = (h: Vec3) => walls.some(w => Math.hypot(w[0] - h[0], w[2] - h[2]) >= 1 && !col.solidBlocked(h, w));
  /** (duck) a cell he throws a frag from only because he can duck from it: he can from a short step to any of eight sides of it too (he stops within a stride of a mark) */
  const duckHolds = (gd: Guard, arc: Arc, px: number, pz: number) => {
    if (kind !== 'frag' || !lob) return true; const pts = fragPts(arc.rest, at); if (!fragIn(g, pts, [px, 0, pz])) return true;
    for (let n = 0; n < 8; n++) { const q: Vec3 = n < 4 ? [px + side(n)[0], 0, pz + side(n)[1]] : [px + (n & 1 ? 0.25 : -0.25), 0, pz + (n & 2 ? 0.25 : -0.25)]; if (fragIn(g, pts, q) && !fragClears(g, gd, q, pts, K.duckThrowSecs)) return false; }
    return true;
  };
  /** the way the ORDERS would walk him there (their router, not this flood) crosses no leaf and no room nobody of the squad has been in */
  const wayOk = (gd: Guard, post: Vec3, own: ReturnType<typeof rooms.roomAt>) => {
    const L = walkLine(g, gd, post);
    for (let n = 1; n < L.length; n++) {
      const a = L[n - 1], c = L[n], len = flat(a, c), steps = Math.max(1, Math.ceil(len / 0.25));
      for (let m = 1; m <= steps; m++) {
        const f = m / steps; b[0] = a[0] + (c[0] - a[0]) * f; b[2] = a[2] + (c[2] - a[2]) * f;
        const x = Math.floor(b[0] / C), z = Math.floor(b[2] / C); if (x < 0 || z < 0 || x >= W || z >= H) return false;
        if (X.leaf[z * W + x] === gen) return false;
        const r = rooms.roomAt(b); if (r && r !== own && !rooms.isKnown(r)) return false;
      }
    }
    return true;
  };
  return flood(false) ?? (lob ? flood(true) : null);
}

/** THE THROW AS IT WOULD BE ORDERED NOW: the nearest man with a throw from where he stands, else (SQUADTHROW.walk) the man with the shortest walk to one, with the
 *  floor he throws from as `post` (null: none). The walk's search is kept SQUADTHROW.keepSecs for the menu's and the picture's re-reads; `fresh` asks again. */
export function squadThrowPlan(g: Game, men: Guard[], at: Vec3, kind: SquadThrowKind, fresh = false, view = false): SquadThrower | null {
  const K = SQUADTHROW, th = squadThrower(g, men, at, kind);
  /** (lob) a frag thrown so catches nobody of ours — the thrower where he will stand, his mates where they are: who can duck is not caught (the player apart) */
  const clean = (t: SquadThrower) => kind !== 'frag' || !squadFragCatches(g, t.rest, at, { gd: t.gd, at: t.post ?? t.gd.char.pos }, false, !fresh);
  if (K.lob ? th && clean(th) : th || !K.walk) return th;
  // (one kept answer a kind, and the PICTURE's kept apart from the menu's and the order's: what is drawn never decides what the game reads)
  const s = state(g), slot = (view ? 'v' : 's') + kind + (K.lob && men.length === 1 ? '1' : ''), c = s.kept.get(slot);   // (lob: a question put of one man is kept apart from the squad's — the row asks both, every frame)
  const key = `${kind}|${keyOf(at)}|${men.map(m => `${m.char.id}:${Math.floor(m.char.pos[0] * 2)},${Math.floor(m.char.pos[2] * 2)}`).join(';')}`;
  if (!fresh && c && c.key === key && g.time >= c.t && g.time - c.t < (K.lob ? K.lobKeepSecs : K.keepSecs)) return c.th;
  // (SQUADTHROW.lob: … then a throw one of them works out from where he stands, then a walk to the straight arc, then a walk to a worked-out throw — the first
  //  that catches nobody of ours; a search's flights are counted (`lobSims`, and half as many again for the men where they stand: half a search between them,
  //  the walk a whole count of its own). Nothing clean: the first throw found all the same, and the row says who is in it)
  const L: Lob | undefined = K.lob ? { walls: throwWalls(g, at), lim: { n: K.lobSims >> 1 }, clean, dirty: th } : undefined;
  let w = L ? standThrow(g, men, at, kind, L) : null;
  if (!w && K.walk) { if (L) L.lim = { n: K.lobSims }; w = walkSpot(g, men, at, kind, false, L); }
  w ??= L ? L.dirty : th;
  s.kept.set(slot, { key, t: g.time, th: w, line: null }); return w;
}
/** his way to a spot as the orders would walk him (the router's corners, each leg by the walk grid): a line on the floor, for the picture */
function walkLine(g: Game, gd: Guard, post: Vec3): Vec3[] {
  const R = g.orders.route(gd, post), nav = g.col.nav, out: Vec3[] = [v3.copy(gd.char.pos)]; let a = gd.char.pos;
  for (const b of [...(R.why ? [] : R.via), post]) { const leg = nav.findPath(a, b); if (leg) for (const p of leg) out.push(p); out.push(b); a = b; }
  return out;
}

/** WHO OF OURS A FRAG RESTING THERE WOULD HAVE IN IT (null: nobody) — in the row's words. The door tools' own test of a body (doortools.ts fragBehind: inside
 *  FRAG.woundM + 1, a line by the burst's own exposure or a plain one), asked from where the arc says it rests AND from the spot asked for.
 *  (`moved`: the thrower asked where he WILL stand, not where he is; `sam` false: the player is not asked about — SQUADTHROW.samCall, his call outside `duckMinM`)
 *  `kept` (the menu's and the picture's re-reads, never the order's own ask nor the hand's): the verdict of the last 0.3 s for the same throw with everybody
 *  of ours where he was — the duck rule asks a flee of every man in it, and the rows are read every frame
 *  `burst` (squad40.ts: a round that goes off as it lands): nobody is counted on to duck — there is no fuse to duck in — the reach is the one handed in,
 *  and `no` its own words for 'no frag.' */
export function squadFragCatches(g: Game, rest: Vec3, at: Vec3, moved?: { gd: Guard; at: Vec3 }, sam = true, kept = false, burst?: { reach: number; no: string }): string | null {
  if (!kept || burst || !SQUADTHROW.lob || !SQUADTHROW.duck) return fragCatches(g, rest, at, moved, sam, burst);
  const q = (p: Vec3) => `${Math.round(p[0] * 4)},${Math.round(p[2] * 4)}`, s = state(g), c = s.caught;
  const key = `${q(rest)}|${q(at)}|${moved ? moved.gd.char.id + ':' + q(moved.at) : ''}|${sam}|${g.player.down ? '' : q(g.player.char.pos)}|${g.guards.map(m => m.team === 'operative' ? `${m.state === 'dead' ? 'x' : ''}${q(m.char.pos)}` : '').join(';')}`;
  if (c && c.key === key && g.time >= c.t && g.time - c.t < 0.3) return c.who;
  const who = fragCatches(g, rest, at, moved, sam); s.caught = { key, t: g.time, who }; return who;
}
function fragCatches(g: Game, rest: Vec3, at: Vec3, moved: { gd: Guard; at: Vec3 } | undefined, sam: boolean, burst?: { reach: number; no: string }): string | null {
  const pts = fragPts(rest, at), inIt = (p: Vec3) => fragIn(g, pts, p, undefined, burst?.reach);
  if ((sam || samNear(g, pts)) && !g.player.down && inIt(g.player.char.pos)) return wg("you're in it.", 'you are in it.');
  // (… a man is told of it when it is within FRAG.seeM of him: one far from the hand it leaves hears late, by the slowest pace it is thrown at)
  const K = SQUADTHROW, taken: Vec3[] = [], on = (gd: Guard) => { const p = moved && moved.gd === gd ? moved.at : gd.char.pos; return inIt(p) && !(!burst && fragClears(g, gd, p, pts, moved?.gd === gd ? K.duckThrowSecs : moved ? Math.max(0, flat(moved.at, p) - FRAG.seeM) / 5 : 0, taken)); };   // (duck: … and cannot be off its line before it bursts)
  const mate = g.guards.find(gd => gd.team === 'operative' && (gd.state !== 'dead' ? on(gd) : isBreathing(gd) && inIt(bodyPos(gd))));   // (a teammate down and breathing — wounded, out cold — is still one of ours)
  if (mate) return `${mate.callsign} is in it.`;
  const live = (c: Guard | null | undefined) => !!c && c.state !== 'dead' && inIt(c.char.pos), no = burst?.no ?? 'no frag.';
  const hostage = !!g.rescue?.hostages.some(live), wanted = live(g.snatch?.man) ? g.snatch!.man! : null;
  if (!WORDS.on) return hostage || wanted || g.civilians.some(live) ? `hostages. ${no}` : null;
  // (the words name who it is: a rescue's hostages; the man a snatch came for, by the name his objective row gives him; anybody else unarmed on the floor)
  if (hostage) return `hostages. ${no}`;
  if (wanted) return `${wanted.civ?.name ?? 'our man'} is in it. ${no}`;
  if (g.civilians.some(live)) return `a civilian is in it. ${no}`;
  return null;
}

/** WHO OF OURS A STUN CANISTER GOING OFF THERE WOULD CATCH: 'you' and callsigns (none: []). combat.ts detonateStun's own tests — the night game's line inside
 *  the dazzle radius, or the room fight's (a line from the can or from over it; its own side only on top of it, the player in full where he has a line:
 *  SAMSTUN.ownSeen) — asked from where it would rest and from the spot, every reach SQUADTHROW.slackM long. */
export function squadStunCatches(g: Game, rest: Vec3, at: Vec3): string[] {
  if (!fx.flags.dazzle) return [];
  const pts = stunPts(rest, at), caught = (eye: Vec3, full: boolean) => stunIn(g, pts, eye, full);
  const out: string[] = [], pl = g.player;
  if (SAMSTUN.on && !pl.down && !g.puppet && !g.touring && caught(pl.char.bones.head ?? v3.add(pl.char.pos, [0, 1.6, 0]), SAMSTUN.ownSeen)) out.push('you');
  for (const gd of g.guards) if (gd.team === 'operative' && gd.state !== 'dead' && caught(gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]), false)) out.push(gd.callsign);
  return out;
}

/** SQUADTHROW.samCall: a frag the player has a line to is his call — not refused in his name, named on the row */
const samCalls = () => SQUADTHROW.lob && SQUADTHROW.samCall;
/** … is he inside it (where it would go off, or the spot asked for)? */
export function squadFragOnSam(g: Game, rest: Vec3, at: Vec3): boolean { return !g.player.down && fragIn(g, fragPts(rest, at), g.player.char.pos); }
/** … and never his call inside what it kills at (`duckMinM`: FRAG.lethalM and a metre): there it is refused as it always was */
const samNear = (g: Game, pts: Vec3[]) => pts.some(L => flat(g.player.char.pos, L) < SQUADTHROW.duckMinM);
function state(g: Game): State { let s = states.get(g); if (!s) states.set(g, s = { last: new SideMap(), noted: null, shown: null, warn: null, warnFrag: null, caught: null, asked: new Map(), walks: new Map(), kept: new Map(), scratch: null }); return s; }

/** the thing leaves his hand: the count is taken already. The door tools' own lines for each (doortools.ts, the toss): the frag on its fuse from the hand, the canister on its own from where it lands */
function throwIt(g: Game, gd: Guard, arc: Arc, kind: SquadThrowKind, at: Vec3) {
  const s = state(g), who = gd.char.id, heading = v3.yawOf(arc.sol.v0); s.last.set(gd, g.time); s.warn = s.warnFrag = null;
  const it = kind === 'frag' ? g.items.spawn('frag', arc.from, arc.sol.v0, { fuse: FRAG.orderFuse, who, heading }) : g.items.spawn('flash', arc.from, arc.sol.v0, { fuse: flashFuse(g), who, heading });
  it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
  gd.char.anim.tossItem(TOSS_QUICK); g.say(gd, kind === 'frag' ? 'frag out!' : WORDS.on ? 'bang out!' : 'bang out.');
  s.shown = { t: g.time, text: `${gd.callsign} · ${kind === 'frag' ? 'frag' : 'bang'} out` };
  SQUADTHROW_STATS.thrown++; if (kind === 'frag') SQUADTHROW_STATS.frags++; else SQUADTHROW_STATS.stuns++;
  SQUADTHROW_LOG.push({ t: g.time, kind, who: gd.callsign, from: arc.from, at: v3.copy(at), land: v3.copy(arc.sol.land), rest: arc.rest }); if (SQUADTHROW_LOG.length > 100) SQUADTHROW_LOG.splice(0, 50);
}
export const squadLogRow = (g: Game, S: SquadOrders, gd: Guard, order: string, at: Vec3) => { S.log.push({ t: g.time, order, who: [gd.callsign], target: `floor:${at[0].toFixed(1)},${at[2].toFixed(1)}` }); };   // (a `free` row is not logged by orders.ts: the squad's order log, in its own words for a floor order)

/** the assignment that walks him to his throw: under the row's own id, gun low on the way, facing the spot once there */
function walkTo(S: SquadOrders, gd: Guard, kind: SquadThrowKind, post: Vec3, at: Vec3, arc?: Arc): Assignment | null {   // (`arc`, SQUADTHROW.lob: he stands facing the way it will leave his hand — a bank is not thrown at the spot)
  S.assign(gd, { order: rowOf(kind), post: v3.copy(post), face: arc && SQUADTHROW.lob ? v3.yawOf(arc.sol.v0) : v3.yawTo(post, at), stance: 'lowReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, going: `moving to throw · ${word(kind)}`, there: `throwing · ${word(kind)}`, setLine: null });
  return S.of(gd);
}
/** the order's walking case: he is sent to the floor he has a throw from; the can stays in the bag until it is thrown */
function startWalk(g: Game, S: SquadOrders, th: SquadThrower, t: OrderTarget, kind: SquadThrowKind) {
  const s = state(g), gd = th.gd, post = th.post!, line = walkLine(g, gd, post);
  const W: Walk = { ...squadLend(g, S, gd, t), kind, at: v3.copy(t.at), post: v3.copy(post), arc: th, spent: 0, lastT: g.time, onT: -1, thrownT: -1, again: 0, line };
  W.A = walkTo(S, gd, kind, post, t.at, th); s.walks.set(gd, W); s.warn = null;
  g.say(gd, 'moving to throw.'); squadLogRow(g, S, gd, rowOf(kind), t.at); SQUADTHROW_STATS.walks++;
}
/** what a man is doing NOW, kept so that he can be handed back to it: asked before he is given the assignment that takes him */
export function squadLend(g: Game, S: SquadOrders, gd: Guard, t: OrderTarget): Lent {
  const p = gd.char.pos, was = S.of(gd);
  const back: Lent['back'] = was && RESUMED.includes(was.order) ? { order: was.order, post: was.post ? v3.copy(was.post) : null, follow: was.follow, face: was.face, watch: was.watch, door: was.door, strafe: was.strafe, stance: was.stance, upper: was.upper,
    stackSide: was.stackSide, move: was.move, going: was.going, there: was.there, shy: was.shy, spare: was.spare, from: was.from, crouch: was.crouch, fit: was.fit, tries: was.tries, setLine: null } : null;   // (`tries`, ORDERS.walkTries: a walker sent off to throw comes back to his jamb still the man who tries the door)
  const mates = was ? g.guards.filter(m => m !== gd && S.of(m)?.group === was.group && S.of(m)?.order === was.order) : [];   // (who shared the order he leaves: it is his again only while one of them still holds it)
  return { mates, gd, t, A: null, home: [p[0], 0, p[2]], homeYaw: gd.char.bodyYaw, back };
}
/** the throw is made, or will not be: back to where he stood and to what he was doing (`back`: SQUADTHROW.back for a walk; off, or nothing to go back to:
 *  he holds) */
export function squadHandBack(g: Game, S: SquadOrders, W: Lent, back = SQUADTHROW.back) {
  const gd = W.gd, p = gd.char.pos, B = back ? W.back : null; if (gd.state === 'dead' || S.of(gd) !== W.A) return;
  S.newGroup();   // (his return is an order of its own: nobody else's 'set.' waits on it, and his waits on nobody)
  if (B && B.order === 'fallIn') { const d = S.defs.find(x => x.id === 'fallIn'); if (d) { d.issue(S, [gd], W.t); return; } }
  // (an order he shared — a stack, a move abreast — is his again only while a man he shared it with still holds it: the stack gone in without him is not gone back to)
  const stale = !!B && B.order !== 'hold' && W.mates.length > 0 && !W.mates.some(m => m.state !== 'dead' && S.of(m)?.order === B.order);
  if (B && B.order !== 'fallIn' && !stale) { S.assign(gd, { ...B, post: B.post ?? v3.copy(W.home), face: B.face ?? W.homeYaw }); return; }
  const at: Vec3 = back ? W.home : [p[0], 0, p[2]];
  S.assign(gd, { order: 'hold', post: v3.copy(at), face: back ? W.homeYaw : gd.char.bodyYaw, stance: 'lowReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, going: back ? 'moving back' : 'holding', there: 'holding', setLine: null });
}
/** A WALKING THROWER'S FRAME (the rows' `tick`: orders.ts calls it while he is under the row's id and the fight does not have him) */
function walkTick(g: Game, S: SquadOrders, gd: Guard, A: Assignment) {
  const K = SQUADTHROW, s = state(g), W = s.walks.get(gd), now = g.time, p = gd.char.pos;
  if (!W || W.A !== A) {   // (under the row's id with no walk of ours behind it — a hand-made assignment: he holds where he is)
    if (W) s.walks.delete(gd);
    S.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding', setLine: null }); return; }
  const dt = now - W.lastT; W.lastT = now; if (dt > 0 && dt < 0.25) W.spent += dt;
  const end = (line: string | null) => { if (line) { g.say(gd, line); SQUADTHROW_STATS.gaveUp++; } s.walks.delete(gd); squadHandBack(g, S, W); };
  if (W.thrownT >= 0) { if (now < W.thrownT || now - W.thrownT >= K.tossSecs) end(null); return; }
  if (!K.on || !K.walk) return end(null);
  if (W.spent > K.walkSecs) return end("can't get a throw.");
  if (!A.arrived && flat(p, W.post) > 0.4) return;   // (walking)
  if (!squadHandFree(g, gd) || handsBusy(g, gd)) return;   // (blinded, reeling, a magazine out: he waits — the walk's clock runs)
  if (W.onT < 0) W.onT = now;
  if (K.lob && (now - W.onT < K.settleSecs || gd.speed > 0.3)) return;   // (still coming to a stand: his hand is not yet where he throws from, nor his feet where he ducks from — the walk's clock runs)
  // (SQUADTHROW.lob: … else the throw he walked here for, made from where his hand now is — one flight — else one he works out afresh; flown once where he
  //  stops, not again every step of his turn)
  let arc: Arc | null = squadArcTo(g, gd, W.at, rollOf(W.kind));
  if (!arc && K.lob) {
    if (!W.heldAt || flat(p, W.heldAt) > 0.05 || now - W.heldT! > 1) {
      const from: Vec3 = [W.arc.from[0] + p[0] - W.post[0], W.arc.from[1], W.arc.from[2] + p[2] - W.post[2]], F = g.col.solidBlocked([p[0], from[1], p[2]], from) ? null : throwFlight(g, W.kind, from, W.arc.sol.v0);
      W.held = F && throwHits(g, F.end, W.at) ? { from, sol: { ...W.arc.sol, points: F.points, land: F.land }, rest: F.end } : throwTo(g, gd, W.at, W.kind, undefined, undefined, { n: K.lobSims });
      W.heldAt = v3.copy(p); W.heldT = now; if (W.held) A.face = v3.yawOf(W.held.sol.v0);   // (he turns to the way THIS one leaves his hand)
    }
    arc = W.held ?? null;
  }
  /** one more look, from where he is (twice at most): true = he is walking again */
  const lookAgain = (): boolean => {
    const th = W.again < 2 ? walkSpot(g, [gd], W.at, W.kind, true, K.lob ? { walls: throwWalls(g, W.at), lim: { n: K.lobSims }, clean: t => W.kind !== 'frag' || !squadFragCatches(g, t.rest, W.at, { gd, at: t.post! }, false), dirty: null } : undefined) : null; if (!th) return false;
    W.again++; W.post = v3.copy(th.post!); W.arc = th; W.onT = -1; W.heldAt = undefined; W.line = walkLine(g, gd, W.post); W.A = walkTo(S, gd, W.kind, W.post, W.at, th); return true;
  };
  if (!arc) { if (!lookAgain()) end('no throw from here.'); return; }   // (stopped short of his spot, or the floor is not what it was)
  W.arc = arc;
  if (Math.abs(wrapAngle(gd.char.bodyYaw - (K.lob ? v3.yawOf(arc.sol.v0) : v3.yawTo(p, W.at)))) > 0.9 && now - W.onT < K.turnSecs) return;   // (turning to it — to the way the thing will leave his hand: a bank is not thrown at the spot)
  // the order's own sense, asked of the floor as it stands NOW — nothing is spent on a refusal
  if (left(g, W.kind) <= 0) return end(none(W.kind));
  if (W.kind === 'frag') {
    const who = squadFragCatches(g, arc.rest, W.at, { gd, at: p }, !samCalls());
    // (lob: stopped a stride short of floor he could duck from, the one in it is HIMSELF: floor to look for again, not a throw to call off)
    if (who && K.lob && who === `${gd.callsign} is in it.` && lookAgain()) return;
    if (who) { SQUADTHROW_STATS.refused++; return end(who); }
  }
  if (!g.doorTools.take(W.kind === 'frag' ? 'frag' : 'bang')) return end(none(W.kind));
  throwIt(g, gd, arc, W.kind, W.at); W.thrownT = now; SQUADTHROW_STATS.walked++;
}

/** WHAT THE PICTURE DRAWS (and what a module that draws the squad's plan may read): one entry per throw on its way — `gd` who throws, `from` the floor he
 *  throws from, `points` the arc, `land` where the thing comes to rest, `walk` his way there from where he is (absent: he throws where he stands) — live from
 *  the order until the thing leaves his hand, plus a `preview` entry for the highlighted row while the throw page is up. Empty otherwise. Reads only. */
export interface SquadThrowPlan { gd: Guard; from: Vec3; points: Vec3[]; land: Vec3; kind: SquadThrowKind; preview?: true; walk?: Vec3[] }
export function squadThrowPlans(g: Game): SquadThrowPlan[] {
  const s = states.get(g), out: SquadThrowPlan[] = []; if (!s || !SQUADTHROW.on) return out;
  for (const W of s.walks.values()) {
    if (W.thrownT >= 0 || W.gd.state === 'dead' || g.orders.of(W.gd) !== W.A || !g.guards.includes(W.gd)) continue;   // (a walk somebody else's order has ended is swept at the next key read: never drawn meanwhile)
    const p = W.gd.char.pos, L = W.line; let bi = 0, bd = Infinity; for (let i = 0; i < L.length; i++) { const d = flat(L[i], p); if (d < bd) { bd = d; bi = i; } }
    out.push({ gd: W.gd, from: W.post, points: W.arc.sol.points, land: W.arc.rest, kind: W.kind, walk: flat(p, W.post) > 0.4 ? [v3.copy(p), ...L.slice(bi + 1), W.post] : undefined });
  }
  const M = g.orders.menu, id = M?.rows[M.sel]?.id;
  if (M && M.page === THROW_PAGE && M.target.kind === 'floor' && (id === FRAG_THERE || id === STUN_THERE)) {   // (the highlighted row's throw and no other: what is drawn is what the next pick gives)
    const t = M.target, kind: SquadThrowKind = id === STUN_THERE ? 'stun' : 'frag';
    const th = left(g, kind) > 0 ? squadThrowPlan(g, M.men, t.at, kind, false, true) : null;   // (the picture's own kept answer: it never stands in for the menu's or the order's)
    if (th && !(kind === 'frag' && squadFragCatches(g, th.rest, t.at, { gd: th.gd, at: th.post ?? th.gd.char.pos }, !samCalls(), true))) {   // (the row's own question, word for word: drawn where the row is live)
      let walk: Vec3[] | undefined;
      if (th.post) { const c = s.kept.get('v' + kind + (SQUADTHROW.lob && M.men.length === 1 ? '1' : '')); walk = c && c.th === th ? (c.line ??= walkLine(g, th.gd, th.post)) : walkLine(g, th.gd, th.post); }
      out.push({ gd: th.gd, from: th.post ?? [th.gd.char.pos[0], 0, th.gd.char.pos[2]], points: th.sol.points, land: th.rest, kind, preview: true, walk });
    }
  }
  return out;
}

function rows(g: Game): OrderDef[] {
  /** why not (a string), or the throw (with `post`: after a walk) */
  const ask = (men: Guard[], t: OrderTarget, kind: SquadThrowKind, fresh = false) => {
    if (left(g, kind) <= 0) return none(kind);
    // (lob) The row is the thrower's alone (`only`), but the search that named him was the squad's, with one count of flights between them: asked of him
    // alone it is another search, and may come back with another throw — one that catches a mate where the squad's did not. So the question goes first to
    // the men `only` was asked of, and that answer stands when it still names him and catches nobody; else he is asked alone, as before.
    const caught = (th: SquadThrower) => kind === 'frag' ? squadFragCatches(g, th.rest, t.at, { gd: th.gd, at: th.post ?? th.gd.char.pos }, !samCalls(), !fresh) : null;
    const A = SQUADTHROW.lob && men.length === 1 ? state(g).asked.get(kind) : undefined;
    if (A && A.key === keyOf(t.at) && A.men.length > 1 && A.men.includes(men[0])) { const th = squadThrowPlan(g, A.men, t.at, kind, fresh); if (th && th.gd === men[0] && !caught(th)) return th; }
    const th = squadThrowPlan(g, men, t.at, kind, fresh); if (!th) return 'no throw from here.';
    const who = caught(th); if (who) return who;
    return th;
  };
  const one = (kind: SquadThrowKind): OrderDef => ({ id: rowOf(kind), page: THROW_PAGE, targets: ['floor'], free: true,
    label: t => { const s = states.get(g), x = kind === 'stun' ? s?.warn : s?.warnFrag, w = x && x.key === keyOf(t.at) ? x.text : ''; return `${word(kind)} there · ${left(g, kind)} left${w}`; },
    // (the order is one man's — the thrower's: nobody else answers, and no drill is asked to let go of anybody; a man a drill owns is never walked: mayWalk)
    only: (_S, men, t) => { if (SQUADTHROW.lob) state(g).asked.set(kind, { key: keyOf(t.at), men }); const th = squadThrowPlan(g, men, t.at, kind); return th ? [th.gd] : []; },
    valid: (_S, t, men) => {
      const a = ask(men, t, kind);
      if (kind === 'stun') { const who = typeof a === 'string' ? [] : squadStunCatches(g, a.rest, t.at); state(g).warn = who.length ? { key: keyOf(t.at), text: ` · too close: ${who.join(', ')}` } : null; }
      else { const on = typeof a !== 'string' && samCalls() && squadFragOnSam(g, a.rest, t.at); state(g).warnFrag = on ? { key: keyOf(t.at), text: ' · too close: you' } : null; }   // (samCall: his call, and the row says so)
      return typeof a === 'string' ? a : true;
    },
    issue: (S, men, t) => {
      const a = ask(men, t, kind, true);
      if (typeof a === 'string') { SQUADTHROW_STATS.refused++; return a; }   // (through the menu `valid` has said it first: this is the floor as it stands NOW — nothing is spent)
      if (a.post) return startWalk(g, S, a, t, kind);
      if (!g.doorTools.take(kind === 'frag' ? 'frag' : 'bang')) return none(kind);
      throwIt(g, a.gd, a, kind, t.at); squadLogRow(g, S, a.gd, rowOf(kind), t.at);
    },
    tick: (S, gd, A) => walkTick(g, S, gd, A) });
  const open: OrderDef = { id: THROW_OPEN, opens: THROW_PAGE, hotKey: FRAG.orderKey, targets: ['floor'], free: true,
    label: () => `throw · frag ${left(g, 'frag')} · bang ${left(g, 'stun')}${squad40Word(g)}`, issue: () => {} };   // (squad40.ts: ' · 40 mm N' while a teammate's card brought one — its row is this page's third)
  return [open, one('frag'), one('stun')];
}
/** the squad's HUD block: the throw just made */
function notes(g: Game): OrderNote[] { const s = states.get(g), w = s?.shown; return w && g.time >= w.t && g.time - w.t < SQUADTHROW.shownSecs ? [w.text] : []; }

/** the rows on the menu while the switch is on, off it otherwise (asked once a frame: a switch thrown live holds from the next) */
function sync(g: Game) {
  const S = g.orders, has = S.defs.some(d => d.id === THROW_OPEN);
  if (SQUADTHROW.on === has) return;
  if (!SQUADTHROW.on) { for (const id of [THROW_OPEN, FRAG_THERE, STUN_THERE]) S.unregister(id); if (S.menu) S.close(); return; }
  const s = state(g), smoke = S.defs.findIndex(d => d.id === 'smokeThere'), hold = S.defs.findIndex(d => d.id === 'hold'), after = smoke >= 0 ? smoke : hold;   // (its place: under the floor's own four and the smoke row)
  const [open, ...page] = rows(g); S.register(open, after >= 0 ? S.defs[after + 1]?.id : undefined); for (const d of page) S.register(d);
  if (s.noted !== S) { s.noted = S; S.notes.push(() => notes(g)); }
}

/** Once a frame straight after the menu's own input (game.ts, beside the door tools' menuKey): the rows kept in step with the switch, and the page's key —
 *  G with a floor menu's first page up turns it to the throws. True: the press was the row's (the caller keeps it from the quick throw). */
export function squadThrowKey(g: Game, input: Input): boolean {
  if (!SQUADTHROW.on && !states.has(g)) return false;
  const st = states.get(g);
  if (st?.walks.size) for (const [gd, W] of st.walks) {   // (a walk whose man is down or under another order is over: nothing thrown, nothing spent · the switch thrown off: he goes back)
    if (gd.state === 'dead' || g.orders.of(gd) !== W.A) st.walks.delete(gd);
    else if (!SQUADTHROW.on) { st.walks.delete(gd); squadHandBack(g, g.orders, W); }
  }
  sync(g);
  const S = g.orders, M = S.menu, key = FRAG.orderKey; if (!M || !input.hit(key)) return false;
  if (M.page === THROW_PAGE) { input.pressed.delete(key); return true; }   // (G again on its own page: the press is the menu's — never Sam's own quick throw)
  if (M.page !== null) return false;
  const i = M.rows.findIndex(d => d.id === THROW_OPEN); if (i < 0) return false;
  input.pressed.delete(key); S.pick(i); return true;
}
export function squadThrowSummary(g: Game): string {
  return SQUADTHROW.on ? `frag ${left(g, 'frag')} · stun ${left(g, 'stun')} · X on a spot of floor, ${FRAG.orderKey.replace('Key', '')}, then 1 or 2 · thrown ${SQUADTHROW_STATS.thrown}` : 'off';
}
