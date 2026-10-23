// A TEAMMATE'S 40 mm GRENADE, FIRED ON ORDER — "40 mm there".
//
// The maintainer, on the gear screen (10-19): "should be symmetric between self and teammates (e.g. 40mm should work for squad)". Until here the launcher's
// high-explosive round was Sam's alone (he40.ts: "nobody else is handed one"). Here a teammate's card may carry rounds (kit.ts MemberKit.shells, staged by
// kitStage) and the squad has one counted order on a spot of FLOOR, on the throws' own page of the floor's menu (squadthrow.ts):
//
//   X on a spot of floor · G ('throw ▸') · 3 = 40 mm there.      Nothing held, no digit above 3 on the page.
//
// THE ROUND is he40.ts's and nothing else: fireShell off the teammate's own launcher, the same 76 m/s, the same nose fuze that arms HE40.armM out, the same
// burst (frag.ts blast) — on whoever stands in it, his own side and the player too. Nothing here judges anybody or draws a die.
// THE COUNT is each man's own: what his card carries rides in his pouches and goes down his tube, so a man with none fires none whoever else has one, and a
// man down takes his with him. The row and the squad block show what the men on their feet have between them.
// WHO FIRES: of the men the menu goes to, one with a round, a long gun in his hands that has the launcher under it (weapons.ts `launcher`), a hand free
// (squadsmoke.ts squadHandFree, squadthrow.ts handsBusy), the tube closed again after his last (LAUNCHER40.cd), and A SHOT: the arc he40.ts would fly from
// his tube to the spot (shellSolve — statics, leaves, furniture, the bodies a round stops on: the player, the unarmed, the other side — and, to the plan, a
// teammate: nobody fires one through a friend's back) goes off within
// `nearM` of the spot and is ARMED there, a margin over (`armSlack`). A man of the other side standing in the line is where it goes off instead — if it is
// armed there. A man whose gun is on the spot already is asked first, then the nearest.
// HE POINTS IT FIRST. A man whose gun is UP and on the spot (within `aimRad`: in a fight, or under an order that has it at his shoulder) fires at once and
// keeps whatever he was doing — the fight included. Another is turned
// to it: lent from his order as a walking thrower is (squadthrow.ts squadLend — only a man who may be: no drill, door tool or fight has him), gun up on the
// spot, and the round goes when his gun is on it and the floor still says yes; then he is handed back (squadHandBack). NOBODY WALKS for it and nobody runs.
// SENSE, asked when the menu is read and again as the round goes (nothing is spent on a refusal): none left · none with the men addressed · nobody of them
// ready (no launcher in a free hand, the tube still open, not ours to turn) · too close to arm · no shot for anybody addressed · NEVER ONTO ITS OWN: the
// player, a teammate still breathing (the man firing too), a hostage, the man to take alive or a civilian inside the burst's reach (FRAG.woundM and
// `reachSlack`, by squadthrow.ts squadFragCatches with nobody counted on to duck: it goes off as it lands) of where it goes off or of the spot = refused,
// naming who. A man whose round would have one of ours in it is passed over for the next man with a shot.
// A SILENT squad: the row is one of silent.ts LOUD_ROWS (marked, and giving it takes the squad out of silent) and of holdfire.ts LIFT_ORDERS.
//
// SQUAD40.on: off in the module and on the frozen stand; on in the page (host/profile.ts; `?nosquad40`). The row is on the menu only while the switch is on,
// the throws' page is there (squadthrow.ts: no page, no row) AND this staging's cards brought a round: with no card carrying one nothing is kept for the Game, nothing is registered, nothing runs but one map read a
// frame, and a run digests as it did before this file — on either stand. `SQUAD40_BREAK=1` (the check's): the switch reads off whatever it is set to.
//
// State is per Game in a side table: each man's rounds, his last shot, who is turning to one, what the squad block shows. None of it is in a checkpoint —
// none is taken with a unit on the floor. Check: tools/qa/squad40-check.ts (`probes.ts squad40`).
// (No top-level statement here uses another game module's export: src/game is one import cycle.)
import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import { v3, wrapAngle } from '../math/vec';
import type { Character } from './character';
import type { Game, Guard } from './game';
import type { Assignment, OrderDef, OrderNote, OrderTarget, SquadOrders } from './orders';
import type { ThrowSolution } from './throwables';
import { HE40, arcLength, fireShell, shellSolve } from './he40';
import { civilianBodies } from './civilians';
import { FRAG } from './frag';
import { LAUNCHER40 } from './weapons';
import { squadHandFree } from './squadsmoke';
import { THROW_OPEN, THROW_PAGE, handsBusy, mayWalk, squadFragCatches, squadHandBack, squadLend, squadLogRow, type Lent } from './squadthrow';
import { isHostile } from './teams';
import { w } from './words';   // (a leaf: the dialogue pass's one switch)

export const SQUAD40 = {
  on: false,
  /** a shot is one whose round goes off within this of the spot (m) … */
  nearM: 1.2,
  /** … having flown this much more than it arms at (m: HE40.armM is counted along its path, and he is not a range table) */
  armSlack: 0.5,
  /** nobody of ours inside the burst's own outer radius and this (m: FRAG.woundM — it goes off where it lands, so there is no run to allow for as a thrown frag's) */
  reachSlack: 0.5,
  /** the tube: this far ahead of him toward the spot (m), this high (m) — or `headDrop` under his head, if that is lower (a man down on a knee) */
  muzzleAhead: 0.55, muzzleUp: 1.35, headDrop: 0.3,
  /** his gun is ON the spot within this (rad): such a man fires at once; another is turned to it first … */
  aimRad: 0.2,
  /** … for this long at most (s), his gun up at least this long before the round goes (s), and stays on it this long after it has gone (s) */
  aimSecs: 2, raiseSecs: 0.35, afterSecs: 0.4,
  /** the squad block names the shot this long (s) */
  shownSecs: 2.5,
  /** the picture on the overlay (ui/squadthrowviz.ts): who fires, the arc, where it goes off and the burst's two radii */
  draw: true,
};
/** `SQUAD40_BREAK=1` (the check's): the order is not there — no row, no round — whatever the switch says */
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SQUAD40_BREAK ?? '') === '1'; } catch { return false; } })();
/** A TEAMMATE'S 40 mm WORKS IN THIS BUILD (the card's question — kit.ts, as wallHere is the wall charge's): the switch is on and the order is not broken */
export function squad40Here(): boolean { return SQUAD40.on && !BREAK; }

export const SHELL_THERE = 'shellThere';
/** one man's shot: the tube, the point sent at, the arc, where it goes off (`burst`: the spot, or the man of the other side in its line) */
interface Shot { gd: Guard; from: Vec3; to: Vec3; sol: ThrowSolution; burst: Vec3; aimed: boolean }
/** a man turning to his shot: lent from his order (squadthrow.ts), the spot, since when, when the round went (−1: not yet), the arc as planned (the picture's) */
interface Turn extends Lent { at: Vec3; t0: number; firedT: number; shot: Shot }
interface State { rounds: Map<Guard, number>; brought: number; last: Map<Guard, number>; turns: Map<Guard, Turn>; noted: unknown;
  shown: { t: number; text: string } | null; kept: Map<Asker, { key: string; t: number; a: Shot | string; who: string | null }>; }
/** who re-reads a plan inside a third of a second, each with an answer of his own: the row's two questions (the picture keeps none — its reads are a drawn
 *  frame's, and nothing a drawn frame does may be in the Game's state) */
type Asker = 'only' | 'valid';
const states = new SideMap<Game, State>('squad40.states');
export const SQUAD40_STATS = { staged: 0, fired: 0, turned: 0, refused: 0, gaveUp: 0 };
/** every round fired on the order, newest last (QA; capped) */
export const SQUAD40_LOG: { t: number; who: string; from: Vec3; at: Vec3; burst: Vec3; left: number; turned: boolean }[] = [];

const flat = v3.distXZ;
/** the launcher is under the gun in his hands: a long gun whose row has one (not his sidearm, not a shotgun — the big slot's or his own) */
const tubeUp = (gd: Guard): boolean => { const d = gd.weapon.def; return d.cls !== 'pistol' && !d.pellets && d.launcher !== false; };
/** the rounds the squad's men on their feet have between them (0: none brought, or all fired) · what this staging brought */
export function squad40Left(g: Game): number { const s = states.get(g); let n = 0; if (s) for (const [gd, k] of s.rounds) if (gd.state !== 'dead') n += k; return n; }
export function squad40Brought(g: Game): number { return states.get(g)?.brought ?? 0; }
/** one man's rounds left */
export function squad40Of(g: Game, gd: Guard): number { return states.get(g)?.rounds.get(gd) ?? 0; }
/** the words the throws' row adds while the order is on the page (squadthrow.ts: 'throw · frag 2 · bang 3 · 40 mm 2') */
export function squad40Word(g: Game): string { const s = states.get(g); return s && s.brought > 0 && squad40Here() ? ` · 40 mm ${squad40Left(g)}` : ''; }

/** A SCENARIO HAS JUST STAGED ITS TEAM (kit.ts kitStage, every staging): each man's rounds for this run are what his card carries — none for a man whose
 *  gun has no launcher under it. With nobody carrying one, and never one on this Game: nothing kept. */
export function squad40Stage(g: Game, carried: readonly (readonly [Guard, number])[]) {
  const rounds = new Map<Guard, number>(); let n = 0;
  for (const [gd, c] of carried) { const k = tubeUp(gd) ? Math.max(0, Math.floor(c) || 0) : 0; if (k) { rounds.set(gd, k); n += k; } }
  let s = states.get(g);
  if (!s) { if (!n) return; states.set(g, s = { rounds, brought: 0, last: new Map(), turns: new Map(), noted: null, shown: null, kept: new Map() }); }
  s.rounds = rounds; s.brought = n; s.last = new Map(); s.turns = new Map(); s.shown = null; s.kept.clear(); SQUAD40_STATS.staged++;
}

/** the bodies a round stops on, as far as the player can see them (he40.ts shellBodies' own rule of the fog): `friends` it must never meet — the player, the
 *  unarmed, a hostage, the man to take alive — `foes`, on whom it may go off — and `mates`: a round in flight passes a teammate (he40.ts), but nobody
 *  fires one through a friend's back, so to the plan a teammate in the line is a body like any other */
function bodies(g: Game): { friends: Character[]; foes: Character[]; mates: Character[] } {
  const friends: Character[] = [], foes: Character[] = [], mates: Character[] = [], wanted = g.snatch?.man ?? null, hostages = g.rescue?.hostages ?? [];
  if (!g.player.down) friends.push(g.player.char);
  for (const gd of g.guards) if (gd.team === 'operative') { if (gd.state !== 'dead' && gd.char.alive) mates.push(gd.char); }
    else if (gd.state !== 'dead' && gd.char.alive && !g.fogOfWar.hidden(gd)) (isHostile('operative', gd.team) && !gd.civ && gd !== wanted && !hostages.includes(gd) ? foes : friends).push(gd.char);
  for (const cv of civilianBodies(g)) if (cv.char.alive && !g.fogOfWar.hidden(cv)) friends.push(cv.char);
  return { friends, foes, mates };
}
/** he faces the spot */
const onIt = (gd: Guard, at: Vec3) => Math.abs(wrapAngle(gd.char.aimYaw - v3.yawTo(gd.char.pos, at))) < SQUAD40.aimRad;
/** his gun is UP and on the spot: in a fight, or under an order that has it at his shoulder (a man at the low ready who merely faces it is turned to it) */
const gunOn = (g: Game, gd: Guard, at: Vec3) => onIt(gd, at) && (gd.state === 'alert' || !!g.fight.opOf(gd)?.tgt || g.orders.of(gd)?.upper === 'aim');
/** ONE MAN'S SHOT to a spot, from where he stands with his gun turned to it ('close': the round would not be armed there · null: he has none — his tube
 *  would be in a wall, or the arc meets a wall, a leaf, a desk or somebody it must not, short of the spot) */
function shotOf(g: Game, gd: Guard, at: Vec3, B = bodies(g)): Shot | 'close' | null {
  const K = SQUAD40, p = gd.char.pos, d = flat(p, at); if (d < 1e-3) return 'close';
  const head = gd.char.bones.head, up = Math.max(0.6, Math.min(K.muzzleUp, head ? head[1] - p[1] - K.headDrop : K.muzzleUp)), k = K.muzzleAhead / d;
  const from: Vec3 = [p[0] + (at[0] - p[0]) * k, p[1] + up, p[2] + (at[2] - p[2]) * k], to: Vec3 = [at[0], at[1] + 0.03, at[2]];
  if (g.col.solidBlocked([p[0], p[1] + up, p[2]], from)) return null;   // (his tube would be in the wall he stands against)
  const short = d < HE40.armM ? 'close' as const : null;
  const friends = [...B.friends, ...B.mates.filter(c => c !== gd.char)];
  const sol = shellSolve(g, from, to, [...friends, ...B.foes]);
  // (stopped short of the spot: by a man of the other side — the arc with him out of it reaches — it goes off on him; by anything else it is no shot)
  if (v3.dist(sol.land, to) > K.nearM && !(B.foes.length && v3.dist(shellSolve(g, from, to, friends).land, to) <= K.nearM)) return short;
  if (arcLength(sol) < HE40.armM + K.armSlack) return 'close';
  return { gd, from, to, sol, burst: v3.copy(sol.land), aimed: gunOn(g, gd, at) };
}
/** who of ours the burst would have in it (null: nobody), in the row's words — asked of where it goes off AND of the spot it is sent at: a man of the
 *  other side it would stop on may be out of its line by the time it is there */
function caught(g: Game, a: Shot, at: Vec3): string | null {
  return squadFragCatches(g, a.burst, at, { gd: a.gd, at: a.gd.char.pos }, true, false, { reach: FRAG.woundM + SQUAD40.reachSlack, no: 'no 40 mm.' });
}
const none = 'no 40 mm left.';
/** THE SHOT AS IT WOULD BE ORDERED NOW: the man of `men` who would fire it, with his shot — one whose gun is on the spot first, then the nearest; a man
 *  whose round would have one of ours in it is passed over for the next, and named (`who`: a refusal, in the row's words) only when nobody's is clean — or
 *  why nobody has one. An `asker`'s re-reads are kept a third of a second; the order itself (null) asks the floor as it stands. */
function plan(g: Game, men: Guard[], at: Vec3, asker: Asker | null): { a: Shot; who: string | null } | string {
  const s = states.get(g); if (!s || squad40Left(g) <= 0) return none;
  // (kept while the spot, the men asked — where each stands, his gun, his hands, his rounds — and everybody of ours stay as they were)
  const ready = (gd: Guard) => { const t = s.last.get(gd) ?? -1e9; return tubeUp(gd) && squadHandFree(g, gd) && !handsBusy(g, gd) && !s.turns.has(gd) && !(g.time >= t && g.time - t < LAUNCHER40.cd); };   // (the last: the tube still open on his last round)
  const q = (p: Vec3) => `${Math.round(p[0] * 4)},${Math.round(p[2] * 4)}`;
  const key = `${at[0].toFixed(2)},${at[2].toFixed(2)}|${men.map(m => `${m.char.id}:${q(m.char.pos)},${gunOn(g, m, at) ? 1 : 0}${ready(m) ? 1 : 0}${s.rounds.get(m) ?? 0}`).join(';')}|${g.player.down ? '' : q(g.player.char.pos)}|${g.guards.map(m => m.team === 'operative' ? q(m.char.pos) : '').join(';')}`;
  const c = asker && s.kept.get(asker);
  if (c && c.key === key && g.time >= c.t && g.time - c.t < 0.3) return typeof c.a === 'string' ? c.a : { a: c.a, who: c.who };
  const keep = (a: Shot | string, who: string | null = null) => { if (asker) s.kept.set(asker, { key, t: g.time, a, who }); return typeof a === 'string' ? a : { a, who }; };
  const B = bodies(g); let any = false, asked = false, close = false, dirty: { a: Shot; who: string } | null = null;
  for (const gd of [...men].sort((x, y) => (gunOn(g, y, at) ? 1 : 0) - (gunOn(g, x, at) ? 1 : 0) || flat(x.char.pos, at) - flat(y.char.pos, at))) {
    if (gd.state === 'dead' || !(s.rounds.get(gd)! > 0)) continue; any = true;
    if (!ready(gd)) continue;
    if (!gunOn(g, gd, at) && !mayWalk(g, gd)) continue;   // (his gun is elsewhere and he is not ours to turn: a drill, a door tool or the fight has him)
    asked = true;
    const a = shotOf(g, gd, at, B); if (a === 'close') { close = true; continue; } if (!a) continue;
    const who = caught(g, a, at); if (who) { dirty ??= { a, who }; continue; }
    return keep(a);
  }
  // (the words: these men carry none · the men who do have no launcher in a free hand, or are not ours to turn · the round would not arm · no arc)
  return dirty ? keep(dirty.a, dirty.who) : keep(!any ? w("nobody's carrying one.", 'none with them.') : !asked ? 'not ready.' : close ? 'too close to arm.' : 'no shot from here.');
}

/** the round leaves his tube */
function fire(g: Game, s: State, a: Shot, at: Vec3, turned: boolean) {
  const gd = a.gd; s.rounds.set(gd, Math.max(0, (s.rounds.get(gd) ?? 0) - 1)); s.last.set(gd, g.time); s.kept.clear();
  fireShell(g, gd.char, a.from, a.to); gd.char.anim.fire(); g.say(gd, 'forty out!');
  s.shown = { t: g.time, text: `${gd.callsign} · 40 mm out` };
  SQUAD40_STATS.fired++; if (turned) SQUAD40_STATS.turned++;
  SQUAD40_LOG.push({ t: g.time, who: gd.callsign, from: a.from, at: v3.copy(at), burst: a.burst, left: squad40Left(g), turned }); if (SQUAD40_LOG.length > 100) SQUAD40_LOG.splice(0, 50);
}
/** A MAN TURNING TO HIS SHOT, each frame (the row's `tick`: orders.ts calls it while he is under the row's id and the fight does not have him) */
function turnTick(g: Game, S: SquadOrders, gd: Guard, A: Assignment) {
  const K = SQUAD40, s = states.get(g), W = s?.turns.get(gd), now = g.time, p = gd.char.pos;
  if (!s || !W || W.A !== A) {   // (under the row's id with no turn of ours behind it — a hand-made assignment: he holds where he is)
    if (W) s!.turns.delete(gd);
    S.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding', setLine: null }); return; }
  const end = (line: string | null) => { if (line) { g.say(gd, line); SQUAD40_STATS.gaveUp++; } s.turns.delete(gd); squadHandBack(g, S, W, true); };
  if (W.firedT >= 0) { if (now < W.firedT || now - W.firedT >= K.afterSecs) end(null); return; }
  if (!squad40Here()) return end(null);
  if (now < W.t0 || now - W.t0 > K.aimSecs) return end('no shot from here.');
  if (!squadHandFree(g, gd) || handsBusy(g, gd) || !tubeUp(gd)) return;   // (blinded, reeling, a magazine out, his sidearm up: he waits — the clock runs)
  if (!onIt(gd, W.at) || now - W.t0 < K.raiseSecs) return;   // (turning, his gun coming up)
  // the order's own sense, asked of the floor as it stands NOW — nothing is spent on a refusal
  if (!(s.rounds.get(gd)! > 0)) return end(none);
  const a = shotOf(g, gd, W.at); if (!a || a === 'close') return end(a ? 'too close to arm.' : 'no shot from here.');
  const who = caught(g, a, W.at); if (who) { SQUAD40_STATS.refused++; return end(who); }
  fire(g, s, a, W.at, true); W.firedT = now;
}

function row(g: Game): OrderDef {
  return { id: SHELL_THERE, page: THROW_PAGE, targets: ['floor'], free: true,
    label: () => `40 mm there · ${squad40Left(g)} left`,
    // (the order is one man's — the man who fires: nobody else answers, and no drill is asked to let go of anybody; a man a drill owns is never turned: mayWalk)
    only: (_S, men, t) => { const a = plan(g, men, t.at, 'only'); return typeof a === 'string' ? [] : [a.a.gd]; },
    valid: (_S, t, men) => { const a = plan(g, men, t.at, 'valid'); return typeof a === 'string' ? a : a.who ?? true; },
    issue: (S, men, t) => {
      const s = states.get(g), a = s ? plan(g, men, t.at, null) : none;
      if (!s || typeof a === 'string' || a.who) { SQUAD40_STATS.refused++; return typeof a === 'string' ? a : a.who!; }   // (through the menu `valid` has said it first: this is the floor as it stands NOW — nothing is spent)
      const gd = a.a.gd, p = gd.char.pos;
      squadLogRow(g, S, gd, SHELL_THERE, t.at);
      if (a.a.aimed) return fire(g, s, a.a, t.at, false);
      const W: Turn = { ...squadLend(g, S, gd, t), at: v3.copy(t.at), t0: g.time, firedT: -1, shot: a.a };
      S.assign(gd, { order: SHELL_THERE, post: [p[0], 0, p[2]], face: v3.yawTo(p, t.at), watch: v3.copy(a.a.to), stance: 'none', upper: 'aim', going: 'turning to fire · 40 mm', there: 'aiming · 40 mm', setLine: null });
      W.A = S.of(gd); s.turns.set(gd, W); s.kept.clear();
    },
    tick: (S, gd, A) => turnTick(g, S, gd, A) };
}
/** the squad's HUD block: what is left while this staging brought any, and the shot just made */
function notes(g: Game): OrderNote[] {
  const s = states.get(g); if (!s || !s.brought || !g.orders.defs.some(d => d.id === SHELL_THERE)) return [];
  const w = s.shown; return w && g.time >= w.t && g.time - w.t < SQUAD40.shownSecs ? [w.text, `40 mm ${squad40Left(g)}`] : [`40 mm ${squad40Left(g)}`];
}

/** Once a frame straight after the menu's own input (game.ts, after squadthrow.ts's own): the row kept in step with the switch, with what this staging
 *  brought and with the throws' page (its third row; with the throws off there is no page and no row), and a turn whose man is down or under another
 *  order ended — nothing fired, nothing spent. One map read and a return on a Game no card ever brought a round to. */
export function squad40Tick(g: Game) {
  const s = states.get(g); if (!s) return;
  const S = g.orders, on = squad40Here();
  for (const [gd, W] of s.turns) {
    if (gd.state === 'dead' || S.of(gd) !== W.A) s.turns.delete(gd);
    else if (!on || g.time < W.t0 || g.time - W.t0 > SQUAD40.aimSecs + 1) { s.turns.delete(gd); squadHandBack(g, S, W, true); }   // (the switch thrown off, or the fight has had him since: he goes back)
  }
  const has = S.defs.some(d => d.id === SHELL_THERE), want = on && s.brought > 0 && S.defs.some(d => d.id === THROW_OPEN);
  if (has === want) return;
  if (S.menu) S.close();
  if (!want) { S.unregister(SHELL_THERE); return; }
  S.register(row(g));
  if (s.noted !== S) { s.noted = S; S.notes.push(() => notes(g)); }
}

/** WHAT THE PICTURE DRAWS (ui/squadthrowviz.ts): `gd` who fires, `points` the arc, `land` where it goes off — for a man turning to his shot until it goes,
 *  and a `preview` for the highlighted row while its page is up. Empty otherwise. Reads only: it asks the floor afresh and keeps nothing. */
export interface Squad40Plan { gd: Guard; from: Vec3; points: Vec3[]; land: Vec3; kind: 'shell'; preview?: true; walk?: undefined }
export function squad40Plans(g: Game): Squad40Plan[] {
  const s = states.get(g), out: Squad40Plan[] = []; if (!s || !squad40Here()) return out;
  const of = (a: Shot, preview?: true): Squad40Plan => ({ gd: a.gd, from: [a.gd.char.pos[0], 0, a.gd.char.pos[2]], points: a.sol.points, land: a.burst, kind: 'shell', preview });
  for (const W of s.turns.values()) if (W.firedT < 0 && W.gd.state !== 'dead' && g.orders.of(W.gd) === W.A) out.push(of(W.shot));
  const M = g.orders.menu;
  if (M && M.target.kind === 'floor' && M.rows[M.sel]?.id === SHELL_THERE) { const a = plan(g, M.men, M.target.at, null); if (typeof a !== 'string' && !a.who) out.push(of(a.a, true)); }
  return out;
}
export function squad40Summary(g: Game): string {
  const s = states.get(g); if (!squad40Here()) return 'off';
  return s && s.brought ? `${squad40Left(g)} of ${s.brought} left · X on a spot of floor, G, then 3 · fired ${SQUAD40_STATS.fired}` : 'none brought (no teammate\'s card carries a 40 mm grenade)';
}
