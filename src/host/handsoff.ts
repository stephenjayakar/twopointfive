// THE HANDS-OFF PLAYER — a staged room clear played from its first step to its end with nobody at the keys: Sam walked along the nav grid's path by W A S D, the cursor
// put on a door and the quick key pressed (the squad stacks; pressed again once they stand, the squad picks its entry — autopilot.ts), his rifle on whoever the picture
// shows him, and a hunt for whoever is left. It is the page's twin of the tallies' 'b' hand (tools/qa/command-tally.ts): what it TELLS the game goes through the real
// keys, the real buttons and the real cursor, written into the host's Input before the tick samples it (game/cmd.ts) — so the tick's record, the run tape and the
// picture's reticle carry it as they carry a person's hands, and nothing in the game knows the difference.
//   WHO USES IT: the benchmark's scenes (ui/bench.ts: a fight on a real floor, watched through the game's own camera) and tools/qa/bench-seeds.ts (the same hands
//   headless, over a set of seeds).
//   HOW IT RUNS: tick(dt) once per game tick, BEFORE the step. The script is a generator: each `yield` is 'one tick passes', so the walk, the waits and the door work
//   read top to bottom as the tally's do and nothing ever blocks the frame.
//   WHAT IT KNOWS THAT A PLAYER DOES NOT: which rooms are held and where the men left in them stand (the tallies' hands know the same). It never reads how many are
//   behind a door, and it orders nothing but through the keys.
//   ITS OWN DIE: the beat between a man showing and the first round is rolled on a die of its own (seeded by the caller), never the game's and never Math.random.
import type { Vec3 } from '../math/vec';
import { mulberry32 } from '../math/dice';
import type { Game, Guard } from '../game/game';
import type { Door } from '../game/doors';
import type { Input } from '../game/input';
import type { FollowCamera } from '../game/camera';
import type { OrderTarget } from '../game/orders';
import { ORDERS } from '../game/orders';
import { INTERACT_KEY } from '../game/consts';
import type { View } from './hud';

/** a way into a held room as the room fight keeps it (roomfight.ts): the opening's centre, the unit vector out of the room, its door */
interface Way { at: Vec3; out: [number, number]; door: Door }
interface Held { room: { entries: Way[]; cells: Set<number> }; men: Guard[] }
type Script<T = void> = Generator<void, T, void>;

export interface HandsOffPlan {
  /** the die the hands' own beats are rolled on */
  seed: number;
  /** run seconds after which the hands stop (end 'cap') */
  cap?: number;
  /** doors by name: a held room that has one of them is taken first, by that door, in this order — then the nearest as ever */
  route?: string[];
  /** before the rooms: a teammate is sent to throw the breaker (the quick key on its panel), and the hands wait for the dark */
  breaker?: boolean;
}
/** taken: no defender left · sam: Sam is down · cap: out of time · spent: nothing left to try */
export type HandsOffEnd = 'taken' | 'sam' | 'cap' | 'spent';

const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const at = (p: ArrayLike<number>) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;

export class HandsOff {
  /** run seconds played · how it ended (null: still playing) · presses of the quick key that gave an order · the timeline */
  t = 0; end: HandsOffEnd | null = null; b = 0; trace: string[] = [];
  /** where his feet go · where the cursor rests with nobody to shoot · seconds from a man showing to the first round · the man his rifle is on */
  private goal: Vec3 | null = null; private look: Vec3 | null = null; private react = 0.6; private target: Guard | null = null;
  private seen = new Map<Guard, { first: number; last: number; need: number }>(); private dice: () => number; private lastT: Guard | null = null; private lastTT = -9; private busy = 0;
  private script: Script; private cap: number;
  constructor(readonly g: Game, private I: Input, private cam: FollowCamera, private view: View, readonly plan: HandsOffPlan) {
    this.dice = mulberry32(0xb07 + plan.seed * 131); this.cap = plan.cap ?? 240; this.script = this.play();
  }
  /** one game tick is about to run: the keys, the button and the cursor it will read */
  tick(dt: number): void {
    const g = this.g, I = this.I;
    for (const k of MOVE) I.keys.delete(k);
    I.buttons &= ~1;
    if (this.end) return;
    if (g.player.down) return this.stop('sam');
    if (g.roomClear.end === 'taken' || (this.t > 0 && !this.left.length)) return this.stop('taken');
    if (this.t >= this.cap) return this.stop('cap');
    if (this.script.next().done) return this.stop('spent');
    this.hands(); this.t += dt;
  }
  /** the hands off for good: nothing held, the cursor left where it is */
  stop(end: HandsOffEnd = 'cap'): void { if (this.end) return; this.end = end; this.goal = this.look = this.target = null; this.say(`ended: ${end}`); }
  private say(s: string) { this.trace.push(`${this.t.toFixed(1).padStart(6)}  ${s}`); if (this.trace.length > 400) this.trace.shift(); }

  private get pos(): Vec3 { return this.g.player.char.pos; }
  private get up(): Guard[] { return this.g.orders.squad().filter(x => x.state !== 'dead'); }
  private get hostiles(): Guard[] { return this.g.guards.filter(x => x.team === 'hostile'); }
  /** defenders still up */
  get left(): Guard[] { return this.hostiles.filter(h => h.state !== 'dead'); }
  private chest(x: Guard): Vec3 { return x.char.bones.chest ?? [x.char.pos[0], 1.2, x.char.pos[2]]; }
  private screen(p: Vec3): [number, number, boolean] { const w = this.view.clientWidth, h = this.view.clientHeight; const [sx, sy, front] = this.cam.project(p, w, h); return [sx, sy, front && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30]; }
  private onScreen(p: Vec3): boolean { return this.screen(p)[2]; }

  // ── his hands, once a tick: the walk keys toward the goal, the cursor, the trigger ──
  private hands() {
    const g = this.g, pl = g.player, c = pl.char, I = this.I; this.target = null;
    if (pl.down) return;
    { const eye: Vec3 = [c.pos[0], 1.45, c.pos[2]]; let best: Guard | null = null, bd = 1e9;   // he shoots only a man the fog shows, on the screen, on a clear line, a beat after he shows
      for (const h of this.hostiles) {
        if (h.state === 'dead') { this.seen.delete(h); continue; }
        const ch = this.chest(h), d = flat(c.pos, h.char.pos);
        if (g.fogOfWar.hidden(h) || !this.onScreen(ch) || g.col.shotBlocked(eye, ch)) continue;
        let s = this.seen.get(h); if (!s || this.t - s.last > 1) { s = { first: this.t, last: this.t, need: this.react * (0.75 + 0.5 * this.dice()) }; this.seen.set(h, s); } else s.last = this.t;
        if (this.t - s.first >= s.need && d < bd) { bd = d; best = h; }
      }
      if (best && best !== this.lastT && this.t - this.lastTT < 0.5) this.busy = this.t + this.react / 2;
      if (best) { this.lastT = best; this.lastTT = this.t; } if (this.t < this.busy) best = null;
      this.target = best; }
    let ahead: Vec3 | null = null;
    if (this.goal) {
      const dx = this.goal[0] - c.pos[0], dz = this.goal[2] - c.pos[2], d = Math.hypot(dx, dz);
      if (d > 0.2) {
        ahead = [c.pos[0] + dx / d * 6, 1.1, c.pos[2] + dz / d * 6];
        if (!this.target) { const { fwd, right } = this.cam.planarBasis(); const a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
          if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); }
      }
    }
    const look = this.target ? this.chest(this.target) : this.look ?? ahead;
    if (look) { const w = this.view.clientWidth, h = this.view.clientHeight; const [sx, sy, front] = this.cam.project(look, w, h); if (front) { I.mouseX = clamp(sx, 10, w - 10); I.mouseY = clamp(sy, 10, h - 10); } }
    if (this.target && g.aimGuard === this.target && !pl.sprinting) I.clicked |= 1;
    if (pl.rifle && pl.rifle.roundsReady === 0 && !pl.rifle.reloading) I.pressed.add('KeyR');
  }

  // ── the script's own clock: a yield is a tick ──
  private *ticks(n: number): Script { for (let i = 0; i < n; i++) yield; }
  private *wait(secs: number): Script { const t1 = this.t + secs; while (this.t < t1 - 1e-6) yield; }
  private *until(pred: () => boolean, secs: number): Script<boolean> { const t1 = this.t + secs; while (this.t < t1 - 1e-6 && !pred()) yield; return pred(); }
  private *key(code: string): Script { this.I.pressed.add(code); yield; }
  /** a question that costs a path search, asked four times a second and not every tick (his thinking is inside the frames a benchmark times) */
  private slow(f: () => boolean, every = 0.25): () => boolean { let next = -1, v = false; return () => { if (this.t >= next) { next = this.t + every; v = f(); } return v; }; }

  // ── his feet ──
  private free(p: ArrayLike<number>): Vec3 | null { const nav = this.g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; }
  private pathLen(a: Vec3, b: Vec3): number { const path = this.g.col.nav.findPath(a, b); if (!path) return Infinity; let L = 0, q: ArrayLike<number> = a; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, b); }
  /** walk to `p` along the nav grid's path; false: stopped early (`until`, `max` seconds, or not getting anywhere after fresh paths) */
  private *go(p: Vec3, max = 40, until?: () => boolean, again = 0): Script<boolean> {
    const path: Vec3[] = (this.g.col.nav.findPath(this.pos, p) as Vec3[] | null) ?? [[p[0], 0, p[2]]]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push([p[0], 0, p[2]]);
    const t0 = this.t; let mark: Vec3 = [...this.pos], markT = this.t;
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.3 : 0.6)) {
        yield; if (until?.() || this.t - t0 > max) { this.goal = null; return false; }
        if (flat(this.pos, mark) > 0.25 || this.target) { mark = [...this.pos]; markT = this.t; }
        else if (this.t - markT > 1.2) {   // not getting anywhere (a mate in a doorway, a chair, the tip of a leaf): a step to one side, then the other, and a fresh path
          if (again >= 8) { this.goal = null; return false; }
          const dx = wp[0] - this.pos[0], dz = wp[2] - this.pos[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, k = 0.9 + 0.3 * (again >> 1);
          this.goal = [this.pos[0] - dz / L * sd * k - dx / L * 0.3, 0, this.pos[2] + dx / L * sd * k - dz / L * 0.3];
          const t1 = this.t + 0.6; while (this.t < t1) { yield; if (until?.()) { this.goal = null; return false; } }
          return yield* this.go(p, max - (this.t - t0), until, again + 1); }
      }
    }
    this.goal = null; return true;
  }

  // ── the floor ──
  private held(): Held[] {
    const by = new Map<Held['room'], Guard[]>();
    for (const d of this.g.fight.defs as unknown as { room: Held['room'] | null; gd: Guard }[]) { if (!d.room || !d.room.entries.length || d.room.cells.size > 500 || d.gd.state === 'dead') continue; by.set(d.room, [...(by.get(d.room) ?? []), d.gd]); }
    return [...by].map(([room, men]) => ({ room, men }));
  }
  private outPt(ent: Way, back: number, lat: number): Vec3 { const ox = ent.out[0], oz = ent.out[1]; return [ent.at[0] + ox * back - oz * lat, 0, ent.at[2] + oz * back + ox * lat]; }
  /** where a player stands to work a door: a few metres from it on its own side, off its line where the floor allows */
  private post(ent: Way): Vec3 {
    const g = this.g, gate = this.outPt(ent, 0.7, 0), clearTo = (p: Vec3) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
    let post: Vec3 | null = null, postL = Infinity;
    // … beside the door's own wall, a few metres along it, where nobody in the room has a line to him through the opening
    const inn = [this.outPt(ent, -1.5, 0), this.outPt(ent, -3, 1), this.outPt(ent, -3, -1)], hidden = (p: Vec3) => inn.every(q => g.col.solidBlocked([p[0], 1.1, p[2]], [q[0], 1.1, q[2]]));
    for (const [back, lat] of [[0.9, 4.2], [0.9, -4.2], [0.9, 5.4], [0.9, -5.4], [1.6, 4.8], [1.6, -4.8], [0.9, 3.2], [0.9, -3.2], [2.4, 5.5], [2.4, -5.5]]) {
      const p = this.free(this.outPt(ent, back, lat)); if (!p || flat(p, ent.at) < 2.8 || flat(p, ent.at) > 7.5 || !hidden(p)) continue;
      if (this.pathLen(gate, p) > flat(gate, p) * 1.5 + 1) continue;
      const L = this.pathLen(this.pos, p); if (L < postL) { post = p; postL = L; } }
    if (post) return post;
    for (const pass of [1.2, 0]) { for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.0, 2.8], [2.0, -2.8], [1.3, 3.2], [1.3, -3.2], [5.2, 0.6], [3.6, 0.5], [3.6, -0.5], [2.6, 0]]) {
        if (Math.abs(lat) < pass) continue; const p = this.free(this.outPt(ent, back, lat)); if (!p || !clearTo(p) || flat(p, ent.at) < 2.2) continue;
        if (this.pathLen(gate, p) > flat(gate, p) * 1.4 + 0.8) continue;
        const L = this.pathLen(this.pos, p); if (L < postL) { post = p; postL = L; } }
      if (post) break; }
    return post ?? this.free(this.outPt(ent, 2.5, 0)) ?? this.outPt(ent, 2.5, 0);
  }
  private inside(ent: Way): Vec3 | null { for (const b of [2.5, 2.0, 1.5]) { const p = this.outPt(ent, -b, 0); if (!this.g.col.nav.isBlocked(p[0], p[2])) return p; } return null; }
  private under(): OrderTarget { return this.g.orders.targetUnder(this.I, this.cam, this.view); }
  /** the cursor on that door, as the keys read it (false: the door is not in the picture, or something else is under the cursor) */
  private *cursorOn(d: Door): Script<boolean> {
    for (const y of [1.0, 0.1, 1.8]) { const p: Vec3 = [d.frameCentre[0], y, d.frameCentre[2]]; if (!this.onScreen(p)) continue; this.look = p; yield* this.ticks(2);
      const t = this.under(); if (t.kind === 'door' && t.door === d) return true; }
    return false;
  }
  private sees(d: Door): boolean { return [1.0, 0.1, 1.8].some(y => this.onScreen([d.frameCentre[0], y, d.frameCentre[2]])); }
  private opsOn(d: Door): unknown[] { return this.g.doorTools.ops.filter(o => o.door === d); }
  private orderGiven(n: number): string { const log = this.g.orders.log; return log.length > n ? log[log.length - 1].order : 'nothing given'; }

  // ── the quick key ──
  private *pressB(d: Door, why: string): Script<boolean> {
    if (!(yield* this.cursorOn(d))) { this.say(`(B · ${d.def.name}: the door is not under the cursor)`); return false; }
    const n = this.g.orders.log.length; yield* this.key(ORDERS.quickKey); this.say(`B · ${d.def.name} (${why}) → ${this.orderGiven(n)}`); this.look = null;
    if (this.g.orders.log.length > n) this.b++; return this.g.orders.log.length > n;
  }
  /** the cursor on his own feet with no teammate under it: what the quick key calls 'nothing' — fall in */
  private *onSelf(): Script<boolean> { for (const [ox, oz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) { this.look = [this.pos[0] + ox, 0.05, this.pos[2] + oz]; yield* this.ticks(2); const t = this.under(); if (t.kind === 'none' && !t.man) return true; } return false; }
  private *fallIn(): Script { if (!this.up.length) return; yield* this.onSelf(); const n = this.g.orders.log.length; yield* this.key(ORDERS.quickKey); this.look = null; this.say(`B · on himself → ${this.orderGiven(n)}`); if (this.g.orders.log.length > n) this.b++; }
  /** one held room by the quick key alone: the men stack and go first, he walks to a post behind them, and in after them */
  private *bRoom(h: Held, ent: Way): Script {
    const d = ent.door, post = this.post(ent); this.say(`→ ${d.def.name} (${h.men.length} at home), from ${at(post)}`);
    const stillHeld = () => h.men.some(m => m.state !== 'dead'), sees = () => this.sees(d); let sent = false;
    if (!sees()) { yield* this.fallIn(); yield* this.wait(1); yield* this.go(post, 60, sees); }
    for (let k = 0; k < 4 && !sent; k++) { sent = yield* this.pressB(d, 'stack'); if (!sent) yield* this.go(post, 2); }
    yield* this.wait(2.5); if (!(yield* this.go(post, 60))) this.say(`(he did not reach his post: at ${at(this.pos)})`);
    if (!sent) yield* this.pressB(d, 'stack');
    yield* this.until(() => this.up.every(m => this.g.orders.of(m)?.arrived), 25);
    for (let k = 0; k < 4 && stillHeld() && this.up.length; k++) {
      if (!(yield* this.pressB(d, k ? 'again' : 'go in'))) { yield* this.wait(1); continue; }
      yield* this.until(() => this.opsOn(d).length > 0, 3); yield* this.until(() => !this.opsOn(d).length, 70); yield* this.wait(1.5);
    }
    yield* this.wait(1); const inn = this.inside(ent); if (inn) yield* this.go(inn, 25); yield* this.wait(1);
  }
  /** a held room with no teammate left to send: to the door, through it, and to each man in it */
  private *soloRoom(h: Held, ent: Way): Script {
    const g = this.g, d = ent.door; this.say(`→ ${d.def.name} himself (${h.men.length} at home)`);
    yield* this.go(this.free(this.outPt(ent, 0.9, 0)) ?? this.outPt(ent, 0.9, 0), 60);
    if (d.locked && !d.lockBroken && Math.abs(d.angle) < 0.3 && (yield* this.until(() => g.selectVerb('door', 'kick'), 0.8))) { this.I.pressed.add(INTERACT_KEY); yield* this.until(() => d.lockBroken || Math.abs(d.angle) > 0.4, 2.5); }
    const stillHeld = () => h.men.some(m => m.state !== 'dead');
    const inn = this.inside(ent); if (inn) yield* this.go(inn, 20, () => !stillHeld());
    for (let k = 0; k < 4 && stillHeld(); k++) { const m = h.men.filter(x => x.state !== 'dead').sort((a, b) => flat(a.char.pos, this.pos) - flat(b.char.pos, this.pos))[0]; yield* this.go(m.char.pos, 8, () => m.state === 'dead' || !!this.target); yield* this.until(() => !this.target, 6); yield* this.wait(0.3); }
  }
  /** the breaker thrown by a teammate: the quick key on its panel, then the wait for the dark (nothing given, or no dark in time: the rooms are taken lit) */
  private *breaker(): Script {
    const g = this.g, b = g.level.breaker; if (!b || g.blackout.active || !this.up.length) return;
    const p: Vec3 = [b.pos[0], b.pos[1], b.pos[2]], foot = this.free(p) ?? p, isIt = () => { const t = this.under(); return t.kind === 'floor' && !!(t as { thing?: unknown }).thing; };
    this.say(`→ the breaker at ${at(p)}`);
    if (!this.onScreen(p)) { yield* this.fallIn(); yield* this.wait(1); yield* this.go(foot, 60, this.slow(() => this.onScreen(p) && this.pathLen(this.pos, foot) < 12)); }
    let given = false;
    for (const q of [p, [foot[0], 0.05, foot[2]] as Vec3]) { if (!this.onScreen(q)) continue; this.look = q; yield* this.ticks(2); if (!isIt()) continue;
      const n = g.orders.log.length; yield* this.key(ORDERS.quickKey); this.say(`B · the breaker → ${this.orderGiven(n)}`); given = g.orders.log.length > n; if (given) { this.b++; break; } }
    this.look = null;
    if (!given) { this.say('(the breaker is not under the cursor: the rooms are taken lit)'); return; }
    if (!(yield* this.until(() => g.blackout.active, 45))) this.say('(no dark in 45 s)');
    yield* this.wait(1.5);
  }

  private *play(): Script {
    const g = this.g, tried = new Map<Held['room'], number>(), route = this.plan.route ?? [];
    yield* this.ticks(20);
    if (this.plan.breaker) yield* this.breaker();
    for (let round = 0; round < 24; round++) {
      const held = this.held().filter(h => (tried.get(h.room) ?? 0) < 3); if (!held.length) break;
      let best: { h: Held; ent: Way; L: number } | null = null;
      for (const name of route) { for (const h of held) { const ent = h.room.entries.find(e => e.door.def.name === name); if (ent && !(tried.get(h.room) ?? 0)) { best = { h, ent, L: 0 }; break; } } if (best) break; }
      if (!best) for (const h of held) for (const ent of h.room.entries) { const out = this.outPt(ent, 1.5, 0), L = this.pathLen(this.pos, this.free(out) ?? out); if (!best || L < best.L) best = { h, ent, L }; }
      if (!best || !Number.isFinite(best.L)) { this.say('no way on foot to any held room'); break; }
      tried.set(best.h.room, (tried.get(best.h.room) ?? 0) + 1);
      if (!this.up.length) yield* this.soloRoom(best.h, best.ent); else yield* this.bRoom(best.h, best.ent);
    }
    // whoever is left is not at home
    for (let lap = 0; lap < 3; lap++) for (const h of this.left) {
      const hp = h.char.pos, way = g.col.nav.findPath(this.pos, hp) as Vec3[] | null; if (!way) continue;
      this.say(`hunt → ${h.callsign} ${at(hp)}`);
      if (!this.up.length) { yield* this.go(hp, 30, () => h.state === 'dead' || !!this.target); yield* this.until(() => h.state === 'dead' || !this.target, 8); continue; }
      yield* this.fallIn();
      const path: Vec3[] = [[this.pos[0], 0, this.pos[2]], ...way, [hp[0], 0, hp[2]]]; let back = 5, p: Vec3 | null = null;
      for (let i = path.length - 1; i > 0 && !p; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); p = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; } else back -= L; }
      const near = this.slow(() => this.onScreen([h.char.pos[0], 0.05, h.char.pos[2]]) && this.pathLen(this.pos, h.char.pos) < 14);
      if (p) yield* this.go(this.free(p) ?? p, 40, () => h.state === 'dead' || near());   // (… from where his floor first comes into the picture: a commander does not walk onto him)
      if (h.state !== 'dead' && this.up.length) { const now = h.char.pos; this.look = [now[0], 0.05, now[2]]; yield* this.ticks(2); const n = g.orders.log.length; yield* this.key(ORDERS.quickKey); this.say(`B · floor by ${h.callsign} → ${this.orderGiven(n)}`); this.look = null; yield* this.until(() => h.state === 'dead', 14); }
    }
    yield* this.wait(15);
  }
}
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
