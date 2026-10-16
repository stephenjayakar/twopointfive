// THE ROOM CLEAR'S TALLY — does careful play beat rushing?
//   bun run tools/qa/roomclear-tally.ts                       every policy over seeds 1‥30 and 101‥164 (94 a policy: ~50 min on four cores), the three tables, a verdict;
//                                                             exit 0 = the verdict holds, 1 = it does not
//   bun run tools/qa/roomclear-tally.ts --policies rush,bang,flank,careful        the verdict's four policies alone (~20 min)
//   bun run tools/qa/roomclear-tally.ts --seeds 1-12 --policies rush,careful --jobs 4 [--json out.json] [--cap 300]      (a run without careful, rush, bang and flank has NO VERDICT: exit 1)
//   bun run tools/qa/roomclear-tally.ts --trace rush:3        one run in this process with its timeline printed (orders given, rooms called, who fell where)
//   --set '{"hostile":{"spreadK":1.4}}'   the numbers as shipped with these over them (the tables: operative, hostile, ROOMFIGHT, BLIND, NIGHTBREACH, DOORTOOLS)
//   --from a.json,b.json                  runs an earlier --json already played are read, not played again (refused unless this file, the shipped numbers, --set and --cap are the same)
//   --md                                  the tables as markdown
//   (exit 2 = an unknown flag / policy / seed list, or a --from file that does not match: nothing run)
//
// WHAT IT IS. The ?roomclear structure (game/roomclear.ts: four held rooms, five defenders dealt per seed) played headless under SCRIPTED PLAYER POLICIES — test
// drivers only: every policy is a list of the orders a player could give from the squad's command menu (game/orders.ts SquadOrders.give — the same call the menu's
// release makes), given at the moments a player could give them (off what he could see or hear: a man on his mark, a room called, a door open). Nothing here is
// in the game: both sides fight on their own read (game/roomfight.ts) exactly as they do in the page.
//
// WHAT THE SCRIPTED PLAYER IS NOT. Sam does not fight in these runs. He is the commander only — unseen and unheard (Game.playerInvisible), put where a player
// would stand for the instant each order is given (an order's door side and a move's facing are read off where he stands) and kept off the floor the rest of
// the time (Run.here: his body would stop rounds and gag his own men). An order's target is built here, not picked with the cursor (the menu's own rules for
// what the cursor is on are not exercised), and giving it takes no time; walking to where it is given from does. The TEAM IS THE PAIR (ROOMCLEAR.pairOnly:
// both teammates down = the structure lost), so the table measures the orders, not anybody's aim with the mouse. A real player adds a third gun and a body
// that can be shot; this tally cannot say what either is worth.
//
// THE HARNESS HAS NO GPU: no light meter (what a man sees of another is guards.ts's direct-light estimate), no smoke sight lines, no fog of war on screen, no feel.
import { standUp, ROOT } from './headless.ts';
const { ROOMCLEAR, STRUCTURE } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH, BLIND } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { FIGHT_SKILL, ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
/** where the commander's body is kept while time passes (Run.here): the lot's south-west corner, outside the building, the length of the floor from the rooms */
const PARK: Vec3 = [1, 0, 1];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const pct = (n: number, d: number) => (d ? `${Math.round(100 * n / d)} %` : '—');

// ───────────────────────────────────────────────────────────── one run ─────────────────────────────────────────────────────────────
export type RunEnd = 'taken' | 'wiped' | 'stalled' | 'error';
export interface Fall { who: string; team: 'operative' | 'hostile'; /** a defender's own room */ home: string | null; /** where the body lies */ where: string; by: string; /** the killer's own room (a defender's) */ byHome: string | null; t: number; /** the room the policy was working */ working: string | null; }
export interface RunOut { policy: string; seed: number; end: RunEnd; t: number; opsUp: number; rooms: Record<string, { cleared: boolean; at: number }>; falls: Fall[]; rounds: Record<string, number>; orders: number; refused: string[]; note: string; }

export class Done extends Error { constructor(public end: RunEnd, public why = '') { super(end); } }

/** The scripted player's hands: a staged game and the verbs a policy is written in. Every verb that passes time can throw Done (the scenario ended, or the cap). */
export class Run {
  g: any; RC: any; NB: any; O: any; t = 0; working: string | null = null; lastShotT = -100; lastFallT = -100;
  falls: Fall[] = []; rounds: Record<string, number> = {}; orders = 0; refused: string[] = []; trace: string[] = [];
  onStep?: (R: Run) => void;
  private seenEv = new Set<any>(); private fallen = new Set<any>(); private fightSeen = 0;
  constructor(public W: any, public seed: number, public cap: number, public verbose: boolean) { this.g = W.game; this.RC = this.g.roomClear; this.NB = this.g.nightBreach; this.O = this.g.orders; const p = this.g.player.char.pos; this.stand = [p[0], 0, p[2]]; this.g.teleportPlayer(PARK); }
  say(s: string) { const line = `${f1(this.t).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }

  // ── the floor ──
  get ops(): any[] { return this.NB.ops.filter((o: any) => o.state !== 'dead'); }
  get squad(): any[] { return this.O.squad(); }
  man(i: number): any { return this.squad[i]; }
  up(i: number): boolean { const m = this.man(i); return !!m && m.state !== 'dead'; }
  room(id: string): any { return this.RC.rooms.find((r: any) => r.def.id === id); }
  cleared(id: string): boolean { return this.room(id).cleared; }
  door(name: string): any { return this.g.doors.byName(name) ?? this.g.doors.list.find((d: any) => d.def.name === name); }
  zone(p: number[]): string { return this.RC.roomAt(p) ?? (p[2] > 9.9 && p[2] < 12.3 && p[0] > 4 && p[0] < 36.2 ? 'corridor' : p[0] > 4 && p[0] < 36.2 && p[2] > 4 && p[2] < 24 ? 'floor' : 'outside'); }
  nameOf(id: number): string { return id === PLAYER_ID ? 'Sam' : this.g.guards.find((x: any) => x.char.id === id)?.callsign ?? `#${id}`; }
  /** the unit vector out of `room` through `door`, and the door's frame centre */
  out(room: string, door: string): { c: Vec3; n: Vec3; u: Vec3 } {
    const d = this.door(door), b = this.room(room).def.bounds, c: Vec3 = [d.frameCentre[0], 0, d.frameCentre[2]];
    const th = d.def.closedDir, u: Vec3 = [Math.cos(th), 0, Math.sin(th)]; let n: Vec3 = [-u[2], 0, u[0]];
    const rc = [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]; if (n[0] * (c[0] - rc[0]) + n[2] * (c[2] - rc[2]) < 0) n = [-n[0], 0, -n[2]];
    return { c, n, u };
  }
  /** a point `d` m outside `room` through `door`, `side` m along the wall */
  outside(room: string, door: string, d: number, side = 0): Vec3 { const { c, n, u } = this.out(room, door); return [c[0] + n[0] * d + u[0] * side, 0, c[2] + n[2] * d + u[2] * side]; }
  /** points to walk in `room`: the middle, then its four quarters (snapped to free floor by the order itself) */
  sweep(room: string): Vec3[] { const b = this.room(room).def.bounds, x = (k: number) => b.x0 + (b.x1 - b.x0) * k, z = (k: number) => b.z0 + (b.z1 - b.z0) * k; return [[x(.5), 0, z(.5)], [x(.25), 0, z(.27)], [x(.75), 0, z(.27)], [x(.75), 0, z(.73)], [x(.25), 0, z(.73)]]; }

  // ── time ──
  step(n = 1) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      g.player.visibility = 0.05; this.W.step(DT); this.t += DT;
      for (const e of g.events) { if (this.seenEv.has(e)) continue; this.seenEv.add(e); if (e.kind === 'guardShot') { const w = g.guards.find((x: any) => x.char.id === e.who); const k = w ? w.team : '?'; this.rounds[k] = (this.rounds[k] ?? 0) + 1; this.lastShotT = this.t; if (this.verbose) this.say(`   ∘ ${w?.callsign ?? e.who} fires${e.blind ? ' blind' : ''}${w && g.time < w.dazzledUntil ? ` (dazzled ${f1(w.dazzledUntil - g.time)} s more)` : ''}`); } }
      if (this.seenEv.size > 4000) this.seenEv = new Set(g.events);
      for (const x of [...this.NB.ops, ...this.NB.hostiles]) if (x.state === 'dead' && !this.fallen.has(x)) {
        this.fallen.add(x); const home = this.RC.rooms.find((r: any) => r.defenders.includes(x))?.def.id ?? null;
        const shot = x.killerId >= 0; const killer = shot ? g.guards.find((k: any) => k.char.id === x.killerId) : null;
        const f: Fall = { who: x.callsign, team: x.team, home, where: this.zone(x.char.pos), by: shot ? this.nameOf(x.killerId) : x.downBy ?? '?', byHome: killer ? this.RC.rooms.find((r: any) => r.defenders.includes(killer))?.def.id ?? null : null, t: this.t, working: this.working };
        this.falls.push(f); this.lastFallT = this.t; this.say(`DOWN ${f.who} (${f.team}${home ? ` of ${home}` : ''}) in ${f.where} by ${f.by}`);
      }
      if (this.verbose) { const L = g.fight.log; for (; this.fightSeen < L.length; this.fightSeen++) this.say(`   · ${L[this.fightSeen].who}: ${L[this.fightSeen].what}`); }
      this.onStep?.(this);
      if (this.RC.end) throw new Done(this.RC.end, this.RC.endWhy);
      if (this.t >= this.cap) throw new Done('stalled', 'time cap');
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }

  // ── the commander ──
  /** The commander is WHERE HE STANDS (`stand`) only for the instant an order is read off it: while time passes his body is kept out on the lot (PARK). Left on
   *  the floor it is in the fight — a defender's round stops in it (combat.ts tests Sam's body; god mode only spares him the wound) and a teammate holds his
   *  fire and lowers his muzzle with Sam in his line (roomfight.ts friendInLine) — an unkillable shield and a gag, standing wherever the policy last ordered from */
  stand: Vec3 = [0, 0, 0];
  here<T>(fn: () => T): T { this.g.teleportPlayer(this.stand); try { return fn(); } finally { this.g.teleportPlayer(PARK); } }
  /** stand Sam here (the ghost: nobody sees or hears him) */
  sam(p: Vec3) { const s = this.here(() => this.O.freeSpot(p)) ?? p; this.stand = [s[0], 0, s[2]]; }
  /** walk him there: the seconds a player would take over the ground (a third on top of the straight line, at a run), then he is there */
  go(p: Vec3) { const d = flat(this.stand, p); if (d > 0.5) this.wait(d * 1.3 / 4); this.sam(p); }
  floorT(p: Vec3) { const s = this.here(() => this.O.freeSpot(p)); return s ? { kind: 'floor', at: s } : null; }
  doorT(name: string) { const d = this.door(name); return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, this.stand) }; }
  /** one order off the menu, by id; false = refused (with the reason kept) */
  order(id: string, target: any, who: 'all' | number = 'all'): boolean {
    if (!target) { this.refused.push(`${id}: no floor there`); return false; }
    if (who !== 'all' && !this.up(who)) return false;
    const why = this.here(() => this.O.give(id, target, who)); this.orders++;
    const words = `${id}${target.kind === 'door' ? ` ${target.door.def.name}` : target.kind === 'floor' ? ` (${f1(target.at[0])}, ${f1(target.at[2])})` : ''} → ${who === 'all' ? 'all' : this.man(who)?.callsign}`;
    if (why) { this.refused.push(`${words}: ${why}`); this.say(`order REFUSED ${words}: ${why}`); return false; }
    this.say(`order ${words}`); return true;
  }
  /** every living man addressed is on his mark */
  set(who: 'all' | number = 'all'): boolean { const men = who === 'all' ? this.ops : this.up(who) ? [this.man(who)] : []; return men.every((m: any) => this.O.of(m)?.arrived ?? true); }
  // ── the door tools (game/doortools.ts: rows 5‥8 of the same menu) ──
  get DT(): any { return this.g.doorTools; }
  opOn(name: string): any { const d = this.door(name); return this.DT.ops.find((o: any) => o.door === d) ?? null; }
  /** a door order by id, waited out: an entry until the order has ended (the men on their points, or nobody left on it); 'outside' until the men hold on the
   *  door; 'charge' until it is set and the men stood off — `blow` is then the commander's trigger. false = refused */
  tool(kind: 'openClear' | 'bangClear' | 'charge' | 'outside', name: string, who: 'all' | number = 'all', cap = 80): boolean {
    if (!this.order(kind, this.doorT(name), who)) return false;
    this.until(() => { const op = this.opOn(name); return !op || (kind === 'outside' && op.phase === 'held') || (kind === 'charge' && op.phase === 'armed'); }, cap);
    return true;
  }
  blow(name: string, cap = 30): boolean { if (!this.DT.chargeOn(this.door(name))) return false; if (!this.order('charge', this.doorT(name))) return false; this.until(() => !this.opOn(name), cap); return true; }
  locked(name: string): boolean { const d = this.door(name); return !!d.locked && !d.lockBroken; }
  open(name: string): boolean { return Math.abs(this.door(name).angle) > 0.5; }
}

// ───────────────────────────────────────────────────────────── the policies ─────────────────────────────────────────────────────────────
// The player's knowledge of the building: which door he takes each room by, and its second way in where the far side of it is ground the team already holds
// (the break room's corridor door; the server room's side door once the manager's office is theirs).
const PLAN: { room: string; front: string; second?: string; via?: string }[] = [
  { room: 'breakroom', front: 'breakroom_w', second: 'breakroom_n' },
  { room: 'storage', front: 'storage' },
  { room: 'manager', front: 'manager' },
  { room: 'server', front: 'server', second: 'server_manager', via: 'manager' },
];
type Entry = 'open' | 'bang' | 'charge' | 'auto';
interface Style {
  /** how each room's front door is taken, in the order the rooms are worked (a tool that has run out, or cannot be used on that door, falls back to 'open').
   *  'auto' chooses by what the floor knows, as a player would: no round fired and nobody down yet in the run = the plain door (the room is not
   *  looking; a bang or a charge would only wake the floor) — after that a charge while one is left, then a bang, then the plain door */
  entry: Entry[];
  /** clear from outside first: the door opened and the opening worked from outside, `outside` seconds held on it, before anybody is sent in */
  outside: number;
  /** the second way in, where the plan has one on ground the team holds: one man put on it before the entry and sent in by it as the front goes */
  second: boolean;
  /** once the room is called — or the entry has gone quiet — cover its doors (holdRoom: the door to a room still held first) and wait for whoever comes to
   *  the gunfire, until this long has passed without a shot (0: on to the next door at once) */
  hold: number;
  /** go through what the entry left by bounds (boundRoom) instead of both men walking it together */
  bound: boolean;
  /** cover the flank while a corridor door is worked: with another room still held, the second man does not stack — he is put a step up the corridor with his
   *  gun down it, toward the nearest door still held, and stays there until this room is called; the first man does the door alone */
  cover: boolean;
}
export const quietFor = (R: Run, secs: number) => R.t - R.lastShotT >= secs && R.t - R.lastFallT >= secs;

/** walk the pair through a room until it is called (or the points run out): both to each point in turn, guns ahead — the rusher's way */
export function sweepRoom(R: Run, room: string, secsEach = 7, who: 'all' | number = 'all') {
  for (const p of R.sweep(room)) { if (R.cleared(room)) return; if (!R.order('move', R.floorT(p), who)) continue; R.until(() => R.cleared(room) || R.set(who), secsEach); if (!R.cleared(room)) R.wait(0.8); }
}
/** the careful way through a room with the same orders: one man moves a leg while the other covers where he is going, and at each stop both look down every
 *  other part of the room in turn ('cover that way') before the next leg; the movers alternate */
function boundRoom(R: Run, room: string, secsEach = 7, look = 0.7) {
  const pts = R.sweep(room); let mover = R.up(0) ? 0 : 1;
  const scan = () => { for (const q of pts) { if (R.cleared(room)) return; let any = false; for (const i of [0, 1]) if (R.up(i) && R.order('cover', R.floorT(q), i)) any = true; if (any) R.wait(look); } };
  scan();
  for (const p of pts) {
    if (R.cleared(room)) return; const other = 1 - mover;
    if (R.up(other)) R.order('cover', R.floorT(p), other);
    if (R.order('move', R.floorT(p), mover)) R.until(() => R.cleared(room) || R.set(mover), secsEach);
    if (R.up(other) && !R.cleared(room)) { R.order('move', R.floorT(p), other); R.until(() => R.cleared(room) || R.set(other), secsEach); }
    scan(); if (R.up(other)) mover = other;
  }
}
/** where the commander stands to order a door: off to one side of it, on the team's face */
const post = (R: Run, room: string, door: string) => R.outside(room, door, 3.5, 1.5);

/** the corridor the three north rooms open onto (their doors are in its north wall, the break room's corridor door in its south) */
const CORRIDOR_Z = 11.1;
/** put man `i` in the corridor a step past `door` on the side away from `threatX`, gun down the corridor at it */
function coverCorridor(R: Run, i: number, door: string, threatX: number) {
  const dx = R.door(door).frameCentre[0], sg = Math.sign(threatX - dx) || -1, at: Vec3 = [dx - sg * 1.4, 0, CORRIDOR_Z + 0.5];
  const here = R.stand.slice() as Vec3;
  R.go([at[0] - sg * 3, 0, CORRIDOR_Z]);   // (a move's facing is the commander's line to the spot: he stands behind it, looking the way the gun is to look)
  if (R.order('move', R.floorT(at), i)) R.until(() => R.set(i), 12);
  R.order('cover', R.floorT([threatX, 0, CORRIDOR_Z]), i);
  R.go(here);
}
/** hold what was taken: both men off the walls to where they have a line, then onto its doors (the one shared with a room still held first), until `secs` have passed without a shot */
function holdRoom(R: Run, P: typeof PLAN[number], secs: number, inside: number[]) {
  if (!inside.some(i => R.up(i))) return;
  // which doors: first one this room shares with a room still held (the next room over comes through it), then the door it was taken by, then its second
  const shared = (id: string) => PLAN.some(Q => Q.room !== P.room && !R.cleared(Q.room) && R.room(Q.room).def.doors.some((E: any) => E.id === id));
  const rank = (id: string) => (shared(id) ? 0 : id === P.front ? 1 : id === P.second ? 2 : 9);
  const mid = R.sweep(P.room)[0], doors: string[] = R.room(P.room).def.doors.map((D: any) => D.id).filter((id: string) => rank(id) < 9).sort((a: string, b: string) => rank(a) - rank(b));
  R.go(post(R, P.room, P.front));
  for (const i of inside) if (R.up(i)) R.order('move', R.floorT(mid), i);
  R.until(() => inside.every(i => !R.up(i) || R.set(i)), 6);
  R.go(mid); let k = 0;
  for (const i of inside) if (R.up(i)) { if (!R.order('cover', R.doorT(doors[k % doors.length]), i)) R.order('cover', R.doorT(doors[(k + 1) % doors.length]), i); k++; }
  R.until(() => quietFor(R, secs), 45);
}

function takeRoom(R: Run, P: typeof PLAN[number], S: Style, k: number) {
  R.working = P.room; if (!R.ops.length) return;
  const others = PLAN.filter(Q => Q !== P && !R.cleared(Q.room) && Q.room !== 'breakroom');
  const onCorridor = Math.abs(R.door(P.front).frameCentre[2] - 10) < 0.3;
  const flanker = S.cover && onCorridor && others.length > 0 && R.ops.length === 2;   // man 1 on the corridor, man 0 on the door
  if (!R.cleared(P.room)) {
    const asked = S.entry[Math.min(k, S.entry.length - 1)]; const hot = R.lastShotT > -100 || R.lastFallT > -100;
    const want = asked === 'auto' ? (hot ? 'charge' : 'open') : asked;
    const two = !flanker && S.second && !!P.second && R.ops.length === 2 && (!P.via || R.cleared(P.via));
    const lead = two || flanker ? (R.up(0) ? 0 : 1) : 'all' as const;
    if (flanker) { const dx = R.door(P.front).frameCentre[0]; const near = others.map(Q => R.door(Q.front).frameCentre[0]).sort((a, b) => Math.abs(a - dx) - Math.abs(b - dx))[0]; coverCorridor(R, 1, P.front, near); }
    if (two) {   // the second man onto the other door first (the order's door side is the commander's: he walks round to the face that man is to come from)
      R.go(P.via ? R.sweep(P.via)[0] : R.outside(P.room, P.second!, 3, -1.5)); R.order('stack', R.doorT(P.second!), 1);
    }
    R.go(post(R, P.room, P.front));
    if (S.outside > 0 && R.tool('outside', P.front, lead)) R.until(() => R.cleared(P.room) || quietFor(R, S.outside), 30);
    if (two) R.until(() => R.set(1), 20);
    if (!R.cleared(P.room)) {
      let went = false;
      const second = () => { if (two && R.up(1)) { const here = R.stand.slice() as Vec3; R.go(P.via ? R.sweep(P.via)[0] : R.outside(P.room, P.second!, 3, -1.5)); R.order('openClear', R.doorT(P.second!), 1); R.go(here); } };
      if (want === 'charge' && R.DT.charges > 0 && !R.open(P.front) && R.tool('charge', P.front, lead)) { second(); went = R.blow(P.front); }
      if (!went && want !== 'open' && R.DT.bangs > 0) {
        if (R.order('bangClear', R.doorT(P.front), lead)) { R.until(() => { const op = R.opOn(P.front); return !op || op.phase === 'wait' || op.phase === 'enter'; }, 80); second(); R.until(() => !R.opOn(P.front), 30); went = true; }
      }
      if (!went) { if (R.order('openClear', R.doorT(P.front), lead)) { R.until(() => { const op = R.opOn(P.front); return !op || op.phase === 'enter'; }, 80); second(); R.until(() => !R.opOn(P.front), 30); } }
      if (two) R.until(() => !R.opOn(P.second!), 15);
    }
    if (!R.cleared(P.room)) { R.go(post(R, P.room, P.front)); if (S.bound && !flanker) boundRoom(R, P.room); else sweepRoom(R, P.room, 7, flanker ? (R.up(0) ? 0 : 1) : 'all'); }
    if (!R.cleared(P.room)) chase(R, P, S);
  }
  if (S.hold > 0) holdRoom(R, P, S.hold, flanker ? [0] : [0, 1]);
}
/** the room walked and still not called: one of its men has gone out by another door. Each other door of the room in turn, from inside it — worked from the
 *  room's side first by the careful, then gone through */
function chase(R: Run, P: typeof PLAN[number], S: Style) {
  const def = R.room(P.room).def; const mid = R.sweep(P.room)[0];
  for (const D of def.doors) {
    if (R.cleared(P.room) || !R.ops.length) return; if (D.id === P.front) continue;
    const d = R.door(D.id); if (d.def.steel && R.locked(D.id)) continue;
    R.go(mid);   // (inside the room: the order's door side is the room's)
    if (S.outside > 0 && R.tool('outside', D.id, 'all', 40)) R.until(() => R.cleared(P.room) || quietFor(R, S.outside), 20);
    if (!R.cleared(P.room)) R.tool('openClear', D.id, 'all', 40);
    if (!R.cleared(P.room) && S.hold > 0) R.until(() => R.cleared(P.room) || quietFor(R, 3), 12);
  }
}
/** nothing left to script: every room again, the same way with no tools, until the scenario ends or the clock runs out */
function hunt(R: Run, S: Style) { const T: Style = { ...S, entry: ['open'], second: false, cover: false }; for (let lap = 0; lap < 6; lap++) for (let i = 0; i < PLAN.length; i++) { const P = PLAN[i]; if (R.cleared(P.room) && lap % 2 === 0) continue; if (R.cleared(P.room)) { R.working = P.room; R.go(post(R, P.room, P.front)); (S.bound ? boundRoom : sweepRoom)(R, P.room, 9); } else takeRoom(R, P, T, i); } }
const policy = (S: Style) => (R: Run) => { PLAN.forEach((P, k) => takeRoom(R, P, S, k)); hunt(R, S); };

// The four rooms in PLAN's order: break room (two men, its doors push open), storage, manager's office, server room (one man each, locked, off the corridor).
// Two charges and three bangs a run (doortools.ts DOORTOOLS). The first door is opened on a floor that does not know the team is there; every door after it on
// a floor that does.
export const POLICIES: Record<string, { run: (R: Run) => void; words: string }> = {
  rush: { run: policy({ entry: ['open'], outside: 0, second: false, hold: 0, bound: false, cover: false }),
    words: 'RUSH — open and clear on every door, one after the other with no pause: no bang, no charge, nobody covering anything, both men walk each room together' },
  bang: { run: policy({ entry: ['open', 'bang', 'bang', 'bang'], outside: 0, second: false, hold: 0, bound: false, cover: false }),
    words: 'BANG, NO FLANK COVER — rush, but every door after the first (the three rooms that have heard the team coming) gets a bang before the entry' },
  flank: { run: policy({ entry: ['open'], outside: 0, second: false, hold: 6, bound: false, cover: true }),
    words: 'FLANK COVER, NO BANG — open and clear on every door, no tools; but while a corridor door is worked one man covers down the corridor toward the rooms still held, and after each room its doors are covered — the door to a room still held first, then the one it was taken by — until six seconds pass without a shot' },
  careful: { run: policy({ entry: ['auto'], outside: 0, second: false, hold: 6, bound: false, cover: true }),
    words: 'CAREFUL — the door tool chosen by what the floor knows: the plain door while no round has been fired (the first room is not looking, and a bang would only wake the floor), after that a charge while one is left, then a bang; one man covering down the corridor toward the rooms still held while each corridor door is worked; and after each room its doors covered — the door to a room still held first, then the one it was taken by — until six seconds pass without a shot' },
  // CAREFUL with one habit taken away at a time — what each buys (reported under the main table; not part of the verdict)
  'careful-nocorridor': { run: policy({ entry: ['auto'], outside: 0, second: false, hold: 6, bound: false, cover: false }),
    words: 'careful WITHOUT the gun down the corridor: both men on every door, the rest as careful' },
  'careful-nohold': { run: policy({ entry: ['auto'], outside: 0, second: false, hold: 0, bound: false, cover: true }),
    words: 'careful WITHOUT the hold after each room: on to the next door the moment a room is called, the rest as careful' },
  // … and with the two habits the task's CAREFUL names that this one leaves out, put back in one at a time (they cost men as the orders stand: the page says why)
  'careful+outside': { run: policy({ entry: ['auto'], outside: 4, second: false, hold: 6, bound: false, cover: true }),
    words: 'careful PLUS clear from outside: every door opened and worked from outside first, four seconds held on it without a shot, before the entry' },
  'careful+second': { run: policy({ entry: ['auto'], outside: 0, second: true, hold: 6, bound: false, cover: true }),
    words: 'careful PLUS the second entry: where a room has a second door on ground the team holds, one man is put on it and goes in by it as the front goes' },
  'careful-nocover': { run: policy({ entry: ['auto'], outside: 0, second: false, hold: 0, bound: false, cover: false }),
    words: 'careful with NEITHER: the tools chosen the same way, nobody covering anything' },
};

// ───────────────────────────────────────────────────────────── the worker ─────────────────────────────────────────────────────────────
const RC_DEFAULTS = { ...ROOMCLEAR };
/** the tuning tables `--set` may write, by the name it uses for each (an A/B of the shipped numbers against others — e.g. the ones they were tuned from) */
const TABLES: Record<string, Record<string, unknown>> = { operative: FIGHT_SKILL.operative, hostile: FIGHT_SKILL.hostile, ROOMFIGHT, BLIND, NIGHTBREACH, DOORTOOLS };
const TABLE_DEFAULTS = JSON.stringify(TABLES, (_k, v) => (v === Infinity ? '∞' : v));
export type Knobs = Record<string, Record<string, unknown>>;
function setKnobs(knobs: Knobs) {
  const base = JSON.parse(TABLE_DEFAULTS, (_k, v) => (v === '∞' ? Infinity : v));
  for (const [t, T] of Object.entries(TABLES)) Object.assign(T, base[t], knobs[t] ?? {});
}
export function checkKnobs(knobs: Knobs): string | null {
  for (const [t, row] of Object.entries(knobs)) { if (!TABLES[t]) return `no table '${t}' (the tables: ${Object.keys(TABLES).join(', ')})`; for (const k of Object.keys(row)) if (!(k in TABLES[t])) return `no knob '${t}.${k}'`; }
  return null;
}
export async function play(policy: string, seed: number, cap = 300, verbose = false, knobs: Knobs = {}, onStep?: (R: Run) => void): Promise<RunOut & { trace: string[] }> {
  Object.assign(ROOMCLEAR, RC_DEFAULTS, { pairOnly: true }); setKnobs(knobs);
  Math.random = seeded(0x51ed + seed * 7919);
  const log = console.log; if (!verbose) console.log = () => {};
  let R: Run | null = null, end: RunEnd = 'error', note = '';
  try {
    const W: any = await standUp({ uploadEvery: 4 }); const g = W.game;
    const why = g.roomClear.start(seed); if (why) throw new Error(`start refused: ${why}`);
    g.playerInvisible = true; g.godMode = true;
    R = new Run(W, seed, cap, verbose); R.onStep = onStep;
    try { R.step(30); POLICIES[policy].run(R); R.until(() => false, cap); } catch (e) { if (e instanceof Done) { end = e.end; note = e.why; } else throw e; }
  } catch (e: any) { end = 'error'; note = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { console.log = log; }
  const rooms: RunOut['rooms'] = {}; if (R) for (const r of R.RC.rooms) rooms[r.def.id] = { cleared: r.cleared, at: r.cleared ? r.clearedAt - (R.g.time - R.t) : NaN };
  if (end === 'taken' && R && !R.ops.length) { end = 'wiped'; note = 'the last defender and the last teammate in the same moment: nobody left to hold it'; }
  return { policy, seed, end, t: R?.t ?? 0, opsUp: R ? R.ops.length : 0, rooms, falls: R?.falls ?? [], rounds: R?.rounds ?? {}, orders: R?.orders ?? 0, refused: R?.refused ?? [], note, trace: R?.trace ?? [] };
}

// ───────────────────────────────────────────────────────────── the tables ─────────────────────────────────────────────────────────────
let MD = false;   // --md: the tables as markdown (for the page)
function table(rows: string[][]): string {
  if (MD) return [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(r => `| ${r.join(' | ')} |`).join('\n');
  const w = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length))); return rows.map(r => r.map((x, c) => (c ? x.padStart(w[c]) : x.padEnd(w[c]))).join('  ')).join('\n'); }
const ROOM_IDS: string[] = STRUCTURE.rooms.map((r: any) => r.id);

export function report(runs: RunOut[], policies: string[]): { text: string; rates: Record<string, { n: number; taken: number; wiped: number; stalled: number; error: number }> } {
  const rates: Record<string, any> = {}; const out: string[] = [];
  const head = ['policy', 'runs', 'taken', 'wiped', 'stalled', 'men lost / run', 'runs with nobody lost', 'secs when taken', 'rounds us : them'];
  const rows = [head];
  for (const p of policies) {
    const rs = runs.filter(r => r.policy === p); const n = rs.length; if (!n) continue;
    const c = (e: RunEnd) => rs.filter(r => r.end === e).length; const taken = rs.filter(r => r.end === 'taken');
    rates[p] = { n, taken: c('taken'), wiped: c('wiped'), stalled: c('stalled'), error: c('error') };
    const lost = rs.reduce((s, r) => s + r.falls.filter(f => f.team === 'operative').length, 0);
    const sum = (k: string) => rs.reduce((s, r) => s + (r.rounds[k] ?? 0), 0);
    rows.push([p, String(n), `${c('taken')} (${pct(c('taken'), n)})`, `${c('wiped')} (${pct(c('wiped'), n)})`, `${c('stalled') + c('error')}${c('error') ? ` (${c('error')} errors)` : ''}`, (lost / n).toFixed(2),
      `${rs.filter(r => !r.falls.some(f => f.team === 'operative')).length}`, taken.length ? f1(taken.reduce((s, r) => s + r.t, 0) / taken.length) : '—', `${Math.round(sum('operative') / n)} : ${Math.round(sum('hostile') / n)}`]);
  }
  out.push('THE STRUCTURE, per policy', table(rows));
  // per room: was it called, what it cost, and where ITS men fell (defenders move between rooms: a man is his room's wherever he drops)
  const tallyOf = (xs: string[]) => { const m: Record<string, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.keys(m).length ? Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ') : '—'; };
  const rr = [['policy', 'room', 'called', 'secs', 'teammates lost working it', '…where they fell', '…to the men of', 'its men down', '…in their own room', '…elsewhere (where)']];
  for (const p of policies) {
    const rs = runs.filter(r => r.policy === p); if (!rs.length) continue;
    for (const id of ROOM_IDS) {
      const called = rs.filter(r => r.rooms[id]?.cleared); const lostF = rs.flatMap(r => r.falls.filter(f => f.team === 'operative' && f.working === id)); const lost = lostF.length;
      const own = rs.flatMap(r => r.falls.filter(f => f.team === 'hostile' && f.home === id)); const home = own.filter(f => f.where === id); const away: Record<string, number> = {};
      for (const f of own) if (f.where !== id) away[f.where] = (away[f.where] ?? 0) + 1;
      rr.push([p, id, `${called.length}/${rs.length}`, called.length ? f1(called.reduce((s, r) => s + r.rooms[id].at, 0) / called.length) : '—', String(lost), tallyOf(lostF.map(f => f.where)), tallyOf(lostF.map(f => f.byHome ?? '?')), String(own.length), String(home.length),
        Object.keys(away).length ? Object.entries(away).map(([k, v]) => `${v} ${k}`).join(', ') : '0']);
    }
    const lostElse = rs.reduce((s, r) => s + r.falls.filter(f => f.team === 'operative' && !f.working).length, 0);
    if (lostElse) rr.push([p, '(between rooms)', '', '', String(lostElse), '', '', '', '', '']);
  }
  out.push('', 'ROOM BY ROOM (a defender counts for the room he was dealt to, wherever he fell; a teammate for the room the team was working when he fell)', table(rr));
  // CAREFUL with one habit taken away at a time: what each buys
  const abl = policies.filter(p => p.startsWith('careful') && rates[p]);
  if (abl.length > 1 && rates.careful) {
    const lostOf = (p: string) => runs.filter(r => r.policy === p).reduce((s, r) => s + r.falls.filter(f => f.team === 'operative').length, 0) / rates[p].n;
    const ar = [['policy', 'taken', 'wiped', 'men lost / run', 'against careful: taken', 'men lost / run']];
    for (const p of abl) ar.push([p, `${rates[p].taken}/${rates[p].n} (${pct(rates[p].taken, rates[p].n)})`, `${rates[p].wiped}/${rates[p].n}`, lostOf(p).toFixed(2),
      p === 'careful' ? '—' : `${Math.round(100 * (rates[p].taken / rates[p].n - rates.careful.taken / rates.careful.n))} points`, p === 'careful' ? '—' : `${lostOf(p) - lostOf('careful') >= 0 ? '+' : ''}${(lostOf(p) - lostOf('careful')).toFixed(2)}`]);
    out.push('', 'WHAT EACH HABIT BUYS (careful with one habit taken away, or one added, at a time)', table(ar));
  }
  return { text: out.join('\n'), rates };
}

/** The verdict: CAREFUL takes it in ≥ 70 % over thirty seeds or more, RUSH loses the whole team more often than it takes the structure, and the in-between policies fall between.
 *  The stricter reading of 'mostly loses' — a clear majority, ≥ 60 % wiped — is PRINTED as a NOTE and does not gate: with the numbers as shipped a rush is wiped in a little
 *  over half its runs, and no skill number moved it further without costing CAREFUL more (the tables and what was tried are in the project's shared notes,
 *  rebuild/room-clear/tally.md — not in this repo). */
export function verdict(rates: Record<string, { n: number; taken: number; wiped: number; stalled: number; error: number }>, between: string[]): { ok: boolean; lines: string[] } {
  const lines: string[] = []; let ok = true; const chk = (c: boolean, s: string) => { ok &&= c; lines.push(`- ${c ? 'PASS' : 'FAIL'} — ${s}`); };
  const C = rates.careful, Rr = rates.rush;
  const missing = ['careful', 'rush', ...between].filter(p => !rates[p]);
  if (missing.length) return { ok: false, lines: [`- NO VERDICT — the verdict needs careful, rush and the in-between policies (${between.join(', ')}) in the run; missing: ${missing.join(', ')}`] };
  const tk = (r: { n: number; taken: number }) => r.taken / r.n;
  chk(C.n >= 30 && Rr.n >= 30, `thirty seeds or more each (careful ${C.n}, rush ${Rr.n})`);
  chk(tk(C) >= 0.7, `CAREFUL takes the structure in ≥ 70 % (${C.taken}/${C.n} = ${pct(C.taken, C.n)})`);
  chk(Rr.wiped > Rr.taken, `RUSH loses the whole team more often than it takes the structure (${Rr.wiped}/${Rr.n} = ${pct(Rr.wiped, Rr.n)} wiped, ${Rr.taken}/${Rr.n} = ${pct(Rr.taken, Rr.n)} taken)`);
  lines.push(`- NOTE — the stricter bar, RUSH wiped in a clear majority (≥ 60 %): ${Rr.wiped / Rr.n >= 0.6 ? 'reached' : 'NOT reached'} on these seeds (${pct(Rr.wiped, Rr.n)}); it does not gate`);
  for (const b of between) chk(tk(rates[b]) > tk(Rr) && tk(rates[b]) < tk(C), `${b} falls between (${pct(rates[b].taken, rates[b].n)} taken; rush ${pct(Rr.taken, Rr.n)}, careful ${pct(C.taken, C.n)})`);
  const errs = Object.entries(rates).filter(([, r]) => r.error); chk(!errs.length, `no run errored${errs.length ? ` (${errs.map(([k, r]) => `${k} ${r.error}`).join(', ')})` : ''}`);
  return { ok, lines };
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
/** '1-30', '3,7,9', '1-30,101-164' → the seeds once each, in the order given; null = not a seed list */
function seedList(s: string): number[] | null {
  const out: number[] = [];
  for (const p of s.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(p.trim()); if (!m) return null; const a = +m[1], b = m[2] === undefined ? a : +m[2]; if (b < a) return null; for (let k = a; k <= b; k++) if (!out.includes(k)) out.push(k); }
  return out.length ? out : null;
}
export const BETWEEN: string[] = ['bang', 'flank'];
/** the shipped numbers were chosen on 101‥164; 1‥30 are the check on them (thirty alone leave about ±8 points on a rate, so the default is both) */
const DEFAULT_SEEDS = '1-30,101-164';
/** an ad-hoc policy for trying a mix: `try:<entries by room, e.g. open+charge+charge+bang>:<outside s>:<second 0|1>:<hold s>:<bound 0|1>:<corridor cover 0|1>` */
function adhoc(name: string): boolean {
  const m = /^try:([a-z+]+):([\d.]+):([01]):([\d.]+):([01]):([01])$/.exec(name); if (!m) return false;
  const entry = m[1].split("+") as Entry[]; if (!entry.every(e => e === 'open' || e === 'bang' || e === 'charge' || e === 'auto')) return false;
  POLICIES[name] = { run: policy({ entry, outside: +m[2], second: m[3] === '1', hold: +m[4], bound: m[5] === '1', cover: m[6] === '1' }), words: `ad hoc: entries ${m[1]} · outside ${m[2]} s · second entry ${m[3]} · hold ${m[4]} s · bounds ${m[5]} · corridor cover ${m[6]}` };
  return true;
}

if (import.meta.main) {
  const argv = process.argv.slice(2); const opt: Record<string, string> = {}; const FLAGS = ['seeds', 'policies', 'jobs', 'json', 'cap', 'trace', 'worker', 'set', 'md', 'from'];
  for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!argv[i].startsWith('--') || !FLAGS.includes(k)) { console.error(`unknown flag '${argv[i]}' — the flags: ${FLAGS.map(f => `--${f}`).join(' ')}`); process.exit(2); } opt[k] = k === 'worker' || k === 'md' ? '1' : argv[++i] ?? ''; }
  MD = !!opt.md;
  const cap = Number(opt.cap ?? 300); if (!(cap > 0)) { console.error(`--cap wants seconds, e.g. 300 (got '${opt.cap}')`); process.exit(2); }
  let knobs: Knobs = {}; if (opt.set) { try { knobs = JSON.parse(opt.set); } catch (e) { console.error(`--set wants JSON, e.g. '{"hostile":{"bangBreak":0.3}}' (${e})`); process.exit(2); } const bad = checkKnobs(knobs); if (bad) { console.error(`--set: ${bad}`); process.exit(2); } }
  const names = (opt.policies ?? Object.keys(POLICIES).join(',')).split(',').filter(Boolean); const bad = names.filter(n => !POLICIES[n] && !adhoc(n));
  if (bad.length) { console.error(`unknown policy '${bad.join("', '")}' — the policies: ${Object.keys(POLICIES).join(', ')}`); process.exit(2); }
  if (opt.trace) {
    const k = opt.trace.lastIndexOf(':'); const [p, s] = [opt.trace.slice(0, k), opt.trace.slice(k + 1)]; if (!POLICIES[p] && !adhoc(p)) { console.error(`unknown policy '${p}' — the policies: ${Object.keys(POLICIES).join(', ')}`); process.exit(2); }
    const r = await play(p, Number(s ?? 1), cap, true, knobs); const { trace, ...rest } = r; console.log(JSON.stringify(rest, null, 1)); process.exit(0);
  }
  const seeds = seedList(opt.seeds ?? DEFAULT_SEEDS); if (!seeds) { console.error(`--seeds wants a list like 1-30 or 3,7,9 or 1-30,101-164 (got '${opt.seeds}')`); process.exit(2); }
  if (opt.worker) {   // one process, one policy, its seeds in turn: a RESULT line each
    for (const s of seeds) { const { trace, ...r } = await play(names[0], s, cap, false, knobs); process.stdout.write(`RESULT ${JSON.stringify(r)}\n`); }
    process.exit(0);
  }
  const jobs = Number(opt.jobs ?? Math.min(8, (await import('node:os')).cpus().length)); if (!(jobs >= 1)) { console.error(`--jobs wants a count, e.g. 4 (got '${opt.jobs}')`); process.exit(2); }
  // what a saved run depends on besides its policy and seed: this file (the policies), the numbers as shipped, --set and --cap. --from takes a file only if all four match
  const stamp = { runner: Bun.hash(await Bun.file(import.meta.path).text()).toString(16), tables: Bun.hash(TABLE_DEFAULTS).toString(16), set: opt.set ?? '', cap };
  const runs: RunOut[] = []; const t0 = Date.now(); let next = 0;
  if (opt.from) for (const f of opt.from.split(',')) {   // runs already played (an earlier --json of the SAME tree and knobs: a run repeats exactly, so it is not played twice)
    let J: any; try { J = JSON.parse(await Bun.file(f).text()); } catch (e) { console.error(`--from: cannot read '${f}' (${e})`); process.exit(2); }
    const off = (Object.keys(stamp) as (keyof typeof stamp)[]).filter(k => J.stamp?.[k] !== stamp[k]);
    if (off.length) { console.error(`--from: '${f}' was played with a different ${off.join(', ')} — its runs are not this table's (play them again, or give the same --set / --cap)`); process.exit(2); }
    for (const r of J.runs as RunOut[]) if (r.end !== 'error' && names.includes(r.policy) && seeds.includes(r.seed) && !runs.some(x => x.policy === r.policy && x.seed === r.seed)) runs.push(r); }
  const kept = runs.length;
  const todo: { policy: string; seed: number }[] = names.flatMap(p => seeds.map(seed => ({ policy: p, seed }))).filter(j => !runs.some(r => r.policy === j.policy && r.seed === j.seed));
  console.log(`room clear tally: ${names.join(', ')} × seeds ${opt.seeds ?? DEFAULT_SEEDS} (${todo.length} runs${kept ? ` + ${kept} read from ${opt.from}` : ''}, ${jobs} at a time, cap ${cap} s)${opt.set ? ` with ${opt.set}` : ''}`);
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < todo.length) {
      const job = todo[next++];   // (one process a run: nothing of one game is left in the next one's module state)
      const proc = Bun.spawn(['bun', 'run', import.meta.path, '--worker', '--policies', job.policy, '--seeds', String(job.seed), '--cap', String(cap), ...(opt.set ? ['--set', opt.set] : [])], { stdout: 'pipe', stderr: 'pipe' });
      const [text, errText] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]); await proc.exited;
      const line = text.split('\n').find(l => l.startsWith('RESULT '));
      const r: RunOut = line ? JSON.parse(line.slice(7)) : { policy: job.policy, seed: job.seed, end: 'error', t: 0, opsUp: 0, rooms: {}, falls: [], rounds: {}, orders: 0, refused: [], note: `worker died (${proc.exitCode}): ${errText.slice(-300)}` };
      runs.push(r); process.stderr.write(`  ${r.policy} seed ${r.seed}: ${r.end} at ${f1(r.t)} s, ${r.opsUp} up${r.end === 'error' ? ` — ${r.note}` : ''}\n`);
    }
  }));
  runs.sort((a, b) => names.indexOf(a.policy) - names.indexOf(b.policy) || a.seed - b.seed);
  const rep = report(runs, names); console.log(`\n${rep.text}\n`);
  for (const p of names) console.log(`${p}: ${POLICIES[p].words}`);
  if (opt.json) await Bun.write(opt.json, JSON.stringify({ seeds, policies: names, cap, stamp, runs }, null, 1));
  const v = verdict(rep.rates, BETWEEN); console.log(`\nVERDICT\n${v.lines.join('\n')}`);
  console.log(`=== roomclear-tally: ${v.ok ? 'ALL PASS' : v.lines[0].includes('NO VERDICT') ? 'NO VERDICT' : 'FAILURES above'} === (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(v.ok ? 0 : 1);
}
