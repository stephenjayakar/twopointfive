// THE HOSTAGE RESCUE'S TALLY — does fast play with technique beat both crawling and blind rushing?
//   bun run tools/qa/rescue-tally.ts                          every headline style over seeds 1‥32, the tables, a verdict; exit 0 = the verdict holds, 1 = it does not
//   bun run tools/qa/rescue-tally.ts --styles crawl,rush,flow --seeds 1-24 --jobs 4 [--json out.json] [--md] [--cap 150] [--react 0.6]
//   bun run tools/qa/rescue-tally.ts --set '{"setSecs":5,"roamers":2}'      the same with the scenario's knobs overridden (RESCUE, game/rescue.ts)
//   bun run tools/qa/rescue-tally.ts --trace flow:3           one run in this process with its timeline printed
//   bun run tools/qa/rescue-tally.ts --sam dark               Sam's light meter planted dark (the probes' stand-in) instead of the CPU estimate
//   (exit 2 = an unknown flag / style / knob / seed, nothing run — or NO VERDICT: a headline style missing, or the sources changed under the run)
//
// WHAT IT IS. The ?rescue scenario (game/rescue.ts) played headless by SCRIPTED PLAYERS — test drivers only, nothing of them is in the game. Each style is a
// short script of what a player would do, written in the player's own verbs:
//   · Sam is moved by the REAL keys (W A S D + Shift through Input, the camera's own basis), aims with the REAL cursor (the reticle's own snap), fires with the
//     real left button, kicks a door with the real Space row — so his rounds take the aim model's cone and the suppression's, a sprint lowers the rifle, and he
//     is one round from down like everybody else. (Game.puppet is not used: it switches the room fight and the order menu off.)
//   · the pair are ordered by the same calls the keys make: the order menu's SquadOrders.give (X) and F (Rescue.orderDoor through the key).
//   · both sides shoot on their own read (game/roomfight.ts), exactly as in the page.
// THE BOT'S EYES AND HANDS (one rule set for every style, so the styles differ only in what they choose to do):
//   · he may shoot a defender the FOG OF WAR shows (somebody on the team sees him — the picture a player has) who is ON SCREEN (the follow camera's own frame at
//     1600 × 1000: about a dozen metres round Sam) and to whom Sam himself has a clear line of fire, `react` seconds ± 25 % (the run's own dice) after that first became true (`--react`, 0.6: about what
//     a person needs to see a man appear and put a mouse on him; 0.35 is somebody who knew where he would be), and half of that again to go straight from one man to the next;
//     nearest first; never with a hostage near the line; never while sprinting (the game's own rule).
//   · he clicks at the semi-auto cadence while the ring sits on the man; he reloads on empty.
//   · he is SEEN through the game's own sight test with his light meter fed the CPU estimate of the direct light on him (guards.ts lightEstimateAt — the same
//     stand-in the AI men are judged by headless): the team's weapon lights behind him, the fixtures, his own muzzle flash all count. `--sam dark` plants a
//     meter of 0 instead: seen only inside arm's reach (the A/B: how much of a style's cost is Sam being seen).
// WHAT IT CANNOT SAY. No GPU: no light meter (the estimate has no bounce light), no smoke, no feel. A bot's reaction time and dead-centre cursor are not a
// person's. The numbers order the styles against each other on game logic; how hard it should be is a call for a person at the keys.
import { standUp, ROOT } from './headless.ts';
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`), { RESCUEEND } = await import(`${ROOT}/src/game/rescueend.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { roomOf } = await import(`${ROOT}/src/game/chronicle.ts`);
const { PLAYER_ID, INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
/** the page's ending (rescueend.ts): seconds the taken room is held with nobody of theirs shown and nothing said on their net before the scripted player
 *  leads the hostages out (a man who has just said he is coming is waited for: a player hears him too) */
const LEAD_AFTER = 20;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number | undefined | null) => (x !== undefined && x !== null && Number.isFinite(x) ? x.toFixed(1) : '—');
const pct = (n: number, d: number) => (d ? `${Math.round(100 * n / d)} %` : '—');
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ───────────────────────────────────────────────────────────── one run ─────────────────────────────────────────────────────────────
export type Grade = 'clean' | 'costly' | 'failed' | 'stalled' | 'error';
export interface Fall { who: string; side: 'sam' | 'pair' | 'hostage' | 'defender'; where: string; by: string; t: number; }
export interface RunOut {
  style: string; seed: number; grade: Grade; why: string;
  /** hostages alive, the pair alive (of 2), Sam up — at the end */
  hostages: number; pair: number; sam: boolean;
  /** seconds from the clock's start: the bang (first), the room secured (last), the end; the clock's dealt length; where the roamer stood */
  bang: number | null; secured: number | null; end: number; resolveSecs: number; roamer: string;
  falls: Fall[]; rounds: Record<string, number>; orders: number; refused: string[]; note: string;
  /** the pair were both down and Sam went for the room himself (the shared end game); the entry was a two-door go (a man at each door on one signal) */
  solo: boolean; split: boolean;
}
export class Done extends Error { constructor(public why = '') { super(why); } }

/** The floor as a player knows it (levels/office.json; the corridor runs west → east at z 10‥12.2, the hostage room is north of its east half). */
const AT = {
  /** into the corridor from the lobby arch, and past the conference room's glass (x 4‥14 on the north side) */
  corridorW: [8.5, 0, 11.2] as Vec3, pastGlass: [13.4, 0, 11.2] as Vec3,
  /** the corridor man's post: west of the second cubicle doorway (x 22‥23.4, south side), 4.5 m short of the hostage room's door — and the two ways he watches */
  post: [20.6, 0, 11.3] as Vec3, east: [31, 1.1, 11.1] as Vec3, west: [9.6, 1.1, 10.6] as Vec3,
  /** in front of the hostage room's corridor door (its leaf spans x 25.02‥26.18 at z 10), and two steps inside it */
  doorFront: [25.6, 0, 11.2] as Vec3, in1: [25.7, 0, 9.1] as Vec3, in2: [26.3, 0, 8.2] as Vec3,
  /** the crawl's rooms on the way: a spot inside each for 'move there' */
  conference: [8.6, 0, 7.4] as Vec3, cubiclesA: [15.7, 0, 14.6] as Vec3, cubiclesB: [19.5, 0, 16.5] as Vec3, server: [18.4, 0, 7.6] as Vec3, serverFront: [17.6, 0, 11.0] as Vec3,
};
const CONF = { x0: 4, x1: 14, z0: 4, z1: 10 }, SERVER = { x0: 14.4, x1: 21.6, z0: 4.4, z1: 9.2 }, OFFICE = { x0: 22, x1: 30, z0: 4, z1: 10 };
const inBox = (p: number[], b: { x0: number; x1: number; z0: number; z1: number }) => p[0] > b.x0 && p[0] < b.x1 && p[2] > b.z0 && p[2] < b.z1;

/** The scripted player: a staged scenario, Sam's hands (keys, cursor, trigger) and the verbs a style is written in. Every verb that passes time can throw Done. */
/** the scripted player's hands: seconds from a man first being in his sight (shown, on screen, a clear line) to his cursor being on him (--react) */
export const BOT = { react: 0.6 };

export class Run {
  g: any; R: any; O: any; I: any; cam: any; t = 0;
  // ── the bot's standing intent (a style writes these; input() turns them into keys every frame) ──
  /** where his feet are going (null: stand), at a sprint or a walk; whether he keeps walking while he shoots */
  goal: Vec3 | null = null; sprint = false; shootOnMove = false;
  /** where the cursor rests while he has nobody to shoot (null: ahead of his feet) */
  watch: Vec3 | null = null;
  /** seconds from a man first showing to the first click; trigger held back altogether */
  react = BOT.react; holdFire = false;
  /** the last defender to fire a round — who a downed Sam is put down to if the run's chronicle does not say */
  private lastDef = '?';
  target: any = null;
  /** where the roamers were stood at the staging */
  roamerAt = '';
  falls: Fall[] = []; rounds: Record<string, number> = {}; orders = 0; refused: string[] = []; trace: string[] = [];
  private seen = new Map<any, { first: number; last: number; need: number }>(); private dice: () => number; private lastTarget: any = null; private lastTargetT = -9; private busyUntil = 0; solo = false; private seenEv = new Set<any>(); private fallen = new Set<any>(); private vis = 0.05; private samFell = false; private logSeen = 0; private lastF = -100;
  constructor(public W: any, public seed: number, public cap: number, public verbose: boolean, public samMeter: 'estimate' | 'dark') { this.g = W.game; this.R = this.g.rescue; this.O = this.g.orders; this.I = W.input; this.cam = W.cam; this.dice = seeded(0xb07 + seed * 104729); this.roamerAt = this.R.hostiles.slice(2).map((h: any) => roomOf(h.char.pos)).join(' + ') || 'none'; }
  say(s: string) { const line = `${f1(this.clock).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }

  // ── the floor ──
  get sam(): any { return this.g.player; }
  get pos(): Vec3 { return this.g.player.char.pos; }
  /** seconds since the captor's clock started (the staging's own time before it has) */
  get clock(): number { return isNaN(this.R.t0) ? 0 : this.g.time - this.R.t0; }
  get ops(): any[] { return this.R.ops.filter((o: any) => o.state !== 'dead'); }
  get defenders(): any[] { return this.R.hostiles.filter((h: any) => h.state !== 'dead'); }
  get hostagesUp(): number { return this.R.hostages.filter((h: any) => h.state !== 'dead').length; }
  door(name: string): any { return this.g.doors.byName(name); }
  /** a defender the team's picture shows right now (the fog of war's own answer) */
  shown(h: any): boolean { return h.state !== 'dead' && !this.g.fogOfWar.hidden(h); }
  nameOf(id: number): string { return id === PLAYER_ID ? 'Sam' : [...this.g.guards, ...this.g.civilians].find((x: any) => x.char.id === id)?.callsign ?? `#${id}`; }
  at(what: string | RegExp): number | null { const L = this.R.log, i0 = L.map((l: any) => l.what).lastIndexOf('staged'); const hit = L.find((l: any, i: number) => i >= i0 && (typeof what === 'string' ? l.what === what : what.test(l.what))); return hit && !isNaN(this.R.t0) ? hit.t - this.R.t0 : null; }
  atLast(what: string): number | null { const L = this.R.log; for (let i = L.length - 1; i >= 0 && L[i].what !== 'staged'; i--) if (L[i].what === what) return isNaN(this.R.t0) ? null : L[i].t - this.R.t0; return null; }

  // ── Sam's hands, once a frame ──
  private chest(x: any): Vec3 { return x.char.bones.chest ?? [x.char.pos[0], 1.2, x.char.pos[2]]; }
  /** a hostage within `r` of the line of fire, out to 4 m past the man */
  private hostageNear(from: Vec3, to: Vec3, r = 0.7): boolean {
    const dx = to[0] - from[0], dz = to[2] - from[2], L = Math.hypot(dx, dz); if (L < 1e-3) return false; const ux = dx / L, uz = dz / L;
    for (const h of this.R.hostages) { if (h.state === 'dead') continue; const px = h.char.pos[0] - from[0], pz = h.char.pos[2] - from[2]; const s = px * ux + pz * uz; if (s < 0.3 || s > L + 4) continue; if (Math.abs(px * uz - pz * ux) < r) return true; }
    return false;
  }
  /** inside the picture (a margin in from the canvas's edge): where the cursor can go */
  private onScreen(p: Vec3): boolean { const cv = this.W.canvas; const [sx, sy, front] = this.cam.project(p, cv.clientWidth, cv.clientHeight); return front && sx > 30 && sx < cv.clientWidth - 30 && sy > 30 && sy < cv.clientHeight - 30; }
  private input() {
    const g = this.g, pl = g.player, c = pl.char, I = this.I;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) I.keys.delete(k);
    I.buttons &= ~1;
    if (pl.down) return;
    // eyes: who he may shoot
    const eye: Vec3 = [c.pos[0], 1.45, c.pos[2]]; let best: any = null, bd = 1e9;
    for (const h of this.R.hostiles) {
      if (h.state === 'dead') { this.seen.delete(h); continue; }
      const ch = this.chest(h), d = flat(c.pos, h.char.pos);
      if (!this.shown(h) || !this.onScreen(ch) || g.col.shotBlocked(eye, ch)) continue;
      let s = this.seen.get(h); if (!s || this.t - s.last > 1) { s = { first: this.t, last: this.t, need: this.react * (0.75 + 0.5 * this.dice()) }; this.seen.set(h, s); } else s.last = this.t;   // (each sighting its own beat, ± a quarter, off the bot's own dice: the seeds are not sixteen copies of one pair of hands)
      if (this.t - s.first >= s.need && d < bd && !this.hostageNear(eye, ch)) { bd = d; best = h; }
    }
    if (best && best !== this.lastTarget && this.t - this.lastTargetT < 0.5) this.busyUntil = this.t + this.react / 2;   // straight from one man to the next (both were in view): the cursor still has to travel
    if (best) { this.lastTarget = best; this.lastTargetT = this.t; } if (this.t < this.busyUntil) best = null;
    this.target = this.holdFire ? null : best;
    // feet
    const engaging = !!this.target; let ahead: Vec3 | null = null;
    if (this.goal) {
      const dx = this.goal[0] - c.pos[0], dz = this.goal[2] - c.pos[2], d = Math.hypot(dx, dz);
      if (d > 0.2) {
        ahead = [c.pos[0] + dx / d * 6, 1.1, c.pos[2] + dz / d * 6];
        if (!engaging || this.shootOnMove) {
          const { fwd, right } = this.cam.planarBasis(); const a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;   // the eight ways the keys give, nearest to the line (re-picked every frame: it weaves onto it)
          if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA');
          if (this.sprint && !engaging) I.keys.add('ShiftLeft');
        }
      }
    }
    // cursor
    const look = this.target ? this.chest(this.target) : this.watch ?? ahead;
    if (look) { const cv = this.W.canvas; const [sx, sy, front] = this.cam.project(look, cv.clientWidth, cv.clientHeight); if (front) { I.mouseX = clamp(sx, 10, cv.clientWidth - 10); I.mouseY = clamp(sy, 10, cv.clientHeight - 10); } }
    // trigger
    if (this.target && g.aimGuard === this.target && !pl.sprinting) I.clicked |= 1;
    if (pl.rifle.roundsReady === 0 && !pl.rifle.reloading) I.pressed.add('KeyR');
  }
  private meter() {
    const g = this.g, pl = g.player, c = pl.char;
    if (this.samMeter === 'dark') { pl.visibility = 0; return; }
    const E = Math.max(lightEstimateAt(g, c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]]), lightEstimateAt(g, c.bones.head ?? [c.pos[0], 1.6, c.pos[2]]));
    this.vis += (g.visibilityOf(E) - this.vis) * (1 - Math.exp(-6 * DT)); pl.irradiance = E; pl.visibility = this.vis;
  }

  // ── time ──
  step(n = 1) {
    const g = this.g, R = this.R;
    for (let i = 0; i < n; i++) {
      this.input(); this.meter();
      this.W.step(DT); this.t += DT;
      for (const e of g.events) {
        if (this.seenEv.has(e)) continue; this.seenEv.add(e);
        if (e.kind === 'guardShot') { const w = g.guards.find((x: any) => x.char.id === e.who); const k = w ? (w.team === 'operative' ? 'pair' : 'defenders') : '?'; this.rounds[k] = (this.rounds[k] ?? 0) + 1; if (k === 'defenders') this.lastDef = w.callsign; }
        else if (e.kind === 'shot' && e.who === PLAYER_ID) this.rounds.sam = (this.rounds.sam ?? 0) + 1;
      }
      if (this.seenEv.size > 4000) this.seenEv = new Set(g.events);
      for (const [list, side] of [[R.ops, 'pair'], [R.hostiles, 'defender'], [R.hostages, 'hostage']] as [any[], Fall['side']][]) for (const x of list) if (x.state === 'dead' && !this.fallen.has(x)) {
        this.fallen.add(x); const f: Fall = { who: x.callsign, side, where: roomOf(x.char.pos), by: x.killerId > 0 ? this.nameOf(x.killerId) : side === 'hostage' ? 'the captor (his clock)' : '?', t: this.clock }; this.falls.push(f); this.say(`DOWN ${f.who} (${side}) in the ${f.where} by ${f.by}`);
      }
      if (g.player.down && !this.samFell) { this.samFell = true; const by = g.chronicle?.counts?.downBy || this.lastDef; this.falls.push({ who: 'Sam', side: 'sam', where: roomOf(this.pos), by, t: this.clock }); this.say(`DOWN Sam in the ${roomOf(this.pos)} by ${by}`); }
      if (this.verbose) for (; this.logSeen < R.log.length; this.logSeen++) this.say(`   · ${R.log[this.logSeen].what}`);
      if (R.result) throw new Done(R.result.why);
      if (this.t >= this.cap) throw new Done('time cap');
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }

  // ── Sam's feet ──
  /** walk (or sprint) to `p` along the nav grid's path; stops early when `until` says so, or after `max` seconds, or when he has stopped getting anywhere */
  go(p: Vec3, o: { sprint?: boolean; max?: number; until?: () => boolean; again?: number; turns?: number; dodge?: boolean } = {}): boolean {
    const path: Vec3[] = this.g.col.nav.findPath(this.pos, p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    this.sprint = !!o.sprint; const t0 = this.t, max = o.max ?? 40; let mark = [...this.pos], markT = this.t, k = 0;
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.3 : 0.6)) {
        this.step(); if (o.until?.() || this.t - t0 > max) { this.goal = null; this.sprint = false; return false; }
        if (++k % 20 === 0 && (o.turns ?? 0) < 8 && this.g.col.solidBlocked([this.pos[0], 0.5, this.pos[2]], [wp[0], 0.5, wp[2]])) return this.go(p, { ...o, max: max - (this.t - t0), turns: (o.turns ?? 0) + 1 });   // shoved off his line (the pair coming the other way) with a wall now between him and the next corner: a fresh path
        if (flat(this.pos, mark) > 0.25 || this.target) { mark = [...this.pos]; markT = this.t; } else if (this.t - markT > 1.2) {   // not getting anywhere (the pair in a doorway, a chair): a fresh path from where he is, twice, before giving the leg up
          if (o.dodge && (o.again ?? 0) < 4) {   // (asked for: wedged on something the grid does not know — the tip of a leaf standing open at its stop, dead ahead — he steps to one side, then the other, as anybody would, before the fresh path)
            const dx = wp[0] - this.pos[0], dz = wp[2] - this.pos[2], L = Math.hypot(dx, dz) || 1, sd = (o.again ?? 0) % 2 ? -1 : 1;
            this.goal = [this.pos[0] + dz / L * sd * 0.9, 0, this.pos[2] - dx / L * sd * 0.9]; this.step(30);
            return this.go(p, { ...o, max: max - (this.t - t0), again: (o.again ?? 0) + 1 }); }
          if ((o.again ?? 0) < 2) return this.go(p, { ...o, max: max - (this.t - t0), again: (o.again ?? 0) + 1 });
          this.say(`(Sam is stuck short of ${f1(wp[0])}, ${f1(wp[2])})`); this.goal = null; this.sprint = false; return false;
        }
      }
    }
    this.goal = null; this.sprint = false; return true;
  }
  /** his own boot on a locked door from where he stands in front of it: the kick row, as Space gives it */
  kick(name: string): boolean {
    const d = this.door(name); if (!d.locked || d.lockBroken) return true;
    const fc = d.frameCentre; let ok = false;   // (the row is offered by reach, not by the cursor: his eyes stay where the style has them)
    for (let i = 0; i < 3 && !ok; i++) {   // (the pair walking to their stack shove him: the row wants him inside the door's reach, so he steps up to it and asks again)
      if (i) { const dx = this.pos[0] - fc[0], dz = this.pos[2] - fc[2], L = Math.hypot(dx, dz) || 1; this.go([fc[0] + dx / L * 0.9, 0, fc[2] + dz / L * 0.9], { max: 2.5 }); }
      ok = this.until(() => this.g.selectVerb('door', 'kick'), 0.6);
    }
    if (ok) { this.I.pressed.add(INTERACT_KEY); this.say(`Sam boots the ${name} door`); this.until(() => d.lockBroken || Math.abs(d.angle) > 0.4, 2.5); } else this.say(`(no kick row on the ${name} door)`);
    return d.lockBroken || Math.abs(d.angle) > 0.4;
  }

  /** THE ENDING AS THE PAGE HAS IT (rescueend.ts, its switch up — the page's stand; never asked on the frozen one, where the room held ends the run): the
   *  room taken ends nothing there, so Sam does what the objective row asks of a player — up to the nearest hostage, Space ('on your feet — with me'), and
   *  back to the way in with them behind him. His eyes and his trigger stay his own on the walk (step()); a run won cleared on the way is won cleared */
  leadOut(): boolean {
    const R = this.R, nav = this.g.col.nav;
    if (!R.ending.lead) {
      const up = R.hostages.filter((h: any) => h.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, this.pos) - flat(b.char.pos, this.pos));
      for (const h of up) { const p = h.char.pos, dx = this.pos[0] - p[0], dz = this.pos[2] - p[2], L = Math.hypot(dx, dz) || 1;
        const q = nav.nearestFreePoint(p[0] + dx / L * 1.1, p[2] + dz / L * 1.1) ?? p;   // (free floor beside her, on his side of her)
        this.go([q[0], 0, q[2]], { max: 4 + flat(this.pos, q) / 1.2 });
        if (this.until(() => this.g.selectVerb('guard', 'lead'), 0.8)) { this.I.pressed.add(INTERACT_KEY); this.step(2); }
        if (R.ending.lead) break; }
      if (!R.ending.lead) { this.say('(no row on a hostage yet: nobody is led)'); return false; }
      this.say('Sam gets the hostages on their feet and makes for the way in');
    }
    const out = R.ending.out; return !!out && this.go(out, { max: 90, dodge: true });
  }
  private quiet = NaN; private heldT = -1e9; private leadT = -1e9; private cueSeen = 0; private cueT = -1e9; private cued = new Set<string>();
  /** ONE STEP OF THE ROOM HELD (finish(), on either floor). On the frozen stand that is all there is to do: the hold ends the run. With the page's ending
   *  up he waits for whoever is coming — `LEAD_AFTER` s with no man of theirs shown and nothing SAID on their net (a man's first word, and 'they're gone':
   *  the lines the radio strip carries; a man's later errands are not announced and are not waited on) — and then leads the hostages out, asking again
   *  every few seconds until the word has taken and he stands at the way in */
  hold() {
    const R = this.R; if (!RESCUEEND.on) { this.step(); return; }
    for (; this.cueSeen < R.log.length; this.cueSeen++) { const l = R.log[this.cueSeen], m = /^flush:(?:(?:room|side|noise|out):(.+)|gone:)/.exec(l.what); if (!m) continue;
      if (m[1] !== undefined) { if (this.cued.has(m[1])) continue; this.cued.add(m[1]); } this.cueT = l.t; }
    if (this.t - this.heldT > 1 || this.defenders.some((h: any) => this.shown(h))) this.quiet = this.t;   // (the room only just the team's again, or a man of theirs on the picture)
    this.heldT = this.t;
    const out = R.ending.out, there = !!R.ending.lead && !!out && flat(this.pos, out) < 1.5;
    if (!there && this.t - this.quiet >= LEAD_AFTER && this.g.time - this.cueT >= LEAD_AFTER && this.t - this.leadT >= 5) { this.leadT = this.t; this.leadOut(); } else this.step();
  }

  // ── the commander ──
  floorT(p: Vec3) { const s = this.O.freeSpot(p); return s ? { kind: 'floor', at: s } : null; }
  doorT(name: string) { const d = this.door(name); return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, this.pos) }; }
  noneT() { return { kind: 'none', at: [this.pos[0], 0, this.pos[2]] }; }
  /** one order off the menu, by id; false = refused (with the reason kept) */
  order(id: string, target: any, who: 'all' | number = 'all'): boolean {
    if (!target) { this.refused.push(`${id}: no floor there`); return false; }
    const why = this.O.give(id, target, who); this.orders++;
    const words = `${id}${target.kind === 'door' ? ` ${target.door.def.name}` : target.kind === 'floor' ? ` (${f1(target.at[0])}, ${f1(target.at[2])})` : ''} → ${who === 'all' ? 'the pair' : this.O.squad()[who]?.callsign}`;
    if (why) { this.refused.push(`${words}: ${why}`); this.say(`order REFUSED ${words}: ${why}`); return false; }
    this.say(`order ${words}`); this.step(); return true;   // (a frame for the order to reach the men: `set()` asked the same frame reads the order before it)
  }
  /** one of the door tools' rows on a door (open and clear / bang and clear — doortools.ts), and the wait until that order has run its course (the men in the room, or it gave up) */
  tool(id: 'openClear' | 'bangClear', name: string, who: 'all' | number = 'all', cap = 20): boolean {
    const d = this.door(name), T = this.g.doorTools; if (!this.order(id, this.doorT(name), who)) return false;
    this.until(() => !T.ops.some((op: any) => op.door === d), cap); return true;
  }
  /** every living man is on the mark his order gave him */
  set(): boolean { return this.ops.every((m: any) => this.O.of(m)?.arrived ?? true); }
  /** F: bang and clear the hostage room (the key itself) */
  F() { this.I.pressed.add('KeyF'); this.orders++; this.lastF = this.t; this.say('F — bang and clear, hostage room'); this.step(); }
  /** is the bang and clear standing (the pair on their way to the stack, on it, or going in) */
  get onTheDoor(): boolean { return this.R.mode === 'door'; }
  /** a defender alive inside the hostage room */
  get roomHeld(): boolean { return this.R.hostiles.some((h: any) => h.state !== 'dead' && inBox(h.char.pos, OFFICE)); }

  /** THE END GAME every style shares once its own plan is spent — what any player would do with what is left:
   *  the room still theirs and the pair free → F again (if `reorder`); the room empty of them and nobody of ours in it → the pair sent in, or Sam goes himself;
   *  the pair gone → Sam takes the door himself. Runs until the scenario ends (Done). */
  finish(o: { reorder: boolean; post: Vec3 | null; watch: Vec3 | null; after?: () => void }) {
    let self = false;
    for (;;) {
      const R = this.R, ops = this.ops;
      if (R.state === 'secured') { this.hold(); continue; }
      if (!ops.length && !self) { self = this.solo = true; this.say('the pair are down — Sam takes the room himself'); }
      if (self) { this.shootOnMove = true; if (!inBox(this.pos, OFFICE)) { this.watch = null; this.go(AT.doorFront, { max: 20 }); if (!this.kick('manager')) this.wait(0.5); this.go(AT.in1, { max: 6 }); this.go(AT.in2, { max: 6 }); } this.watch = [27.5, 1.1, 7.2]; this.wait(1); continue; }
      if (!this.onTheDoor && this.t - this.lastF > 3) {
        if (this.roomHeld) { if (o.reorder) { this.F(); o.after?.(); } }
        else if (!ops.some((m: any) => inBox(m.char.pos, OFFICE)) && !inBox(this.pos, OFFICE)) { this.lastF = this.t; this.order('move', this.floorT(AT.in2)); }
      }
      if (o.post && flat(this.pos, o.post) > 0.6 && !this.target) { this.watch = null; this.go(o.post, { max: 6 }); }
      this.watch = o.watch; this.step(6);
    }
  }
}

// ───────────────────────────────────────────────────────────── the styles ─────────────────────────────────────────────────────────────
/** the roamer, if the team's picture has him in the conference room right now */
const roamerInConference = (R: Run) => R.R.hostiles.find((h: any) => R.shown(h) && inBox(h.char.pos, CONF)) ?? null;

/** CRAWL BY HAND (the build before the door tools had only this): every room on the way, in order, with the menu's stack up and move there — Sam boots the
 *  server room's locked door himself — and only then the hostage room. */
function crawlHand(R: Run) {
  // (the first room is ordered from the arch: the corridor is one straight lane, and a careful man does not stand in it while a room is cleared)
  R.order('stack', R.doorT('conference')); R.until(() => R.set(), 8);
  R.order('move', R.floorT(AT.conference)); R.until(() => R.set(), 8); R.wait(1.5);
  R.watch = AT.east; R.go(AT.corridorW); R.order('fallIn', R.noneT()); R.go(AT.pastGlass); R.watch = null;
  R.order('move', R.floorT(AT.cubiclesA)); R.until(() => R.set(), 8);
  R.order('move', R.floorT(AT.cubiclesB)); R.until(() => R.set(), 8); R.wait(1.5);
  R.order('fallIn', R.noneT()); R.go(AT.serverFront);
  R.order('stack', R.doorT('server')); R.until(() => R.set(), 8);
  R.kick('server');
  R.order('move', R.floorT(AT.server)); R.until(() => R.set(), 8); R.wait(1.5);
  // (he calls them back to him first: F with a man still posted in the server room would send that man to the side door — the two-door go, which is FLOW's)
  R.order('fallIn', R.noneT()); R.until(() => R.ops.every((m: any) => m.char.pos[2] > 10.1), 6);
  R.F(); R.go(AT.post); R.finish({ reorder: true, post: AT.post, watch: AT.east });
}
/** CRAWL (the answer page's 3.12: 'stack, bang and entry'): every room on the way, in order — the conference room, the cubicles, the server room — each door taken by
 *  the door tools' bang and clear (the men boot what is locked themselves; the third and last can is the hostage room's), and only then the hostage room. */
function crawl(R: Run) {
  R.tool('bangClear', 'conference'); R.wait(1.5);
  R.watch = AT.east; R.go(AT.corridorW); R.order('fallIn', R.noneT()); R.go(AT.pastGlass); R.watch = null;
  R.order('move', R.floorT(AT.cubiclesA)); R.until(() => R.set(), 8);
  R.order('move', R.floorT(AT.cubiclesB)); R.until(() => R.set(), 8); R.wait(1.5);
  R.order('fallIn', R.noneT()); R.watch = AT.east; R.go(AT.serverFront);
  R.tool('bangClear', 'server'); R.wait(1.5);
  R.order('fallIn', R.noneT()); R.until(() => R.ops.every((m: any) => m.char.pos[2] > 10.1), 6);
  R.F(); R.go(AT.post); R.finish({ reorder: true, post: AT.post, watch: AT.east });
}
/** RUSH: sprint the corridor, boot the hostage room's door and go in first. No bang, no order; the pair come on behind unasked, the last of them stopping on each opening he passes (rescueflow.ts). */
function rush(R: Run) {
  R.shootOnMove = true;
  R.go(AT.corridorW, { sprint: true }); R.go(AT.doorFront, { sprint: true });
  R.kick('manager');
  R.go(AT.in1, { max: 6 }); R.go(AT.in2, { max: 6 }); R.watch = [27.5, 1.1, 7.2];
  R.finish({ reorder: false, post: null, watch: [27.5, 1.1, 7.2] });
}
/** ORDER: the one word and nothing else — F at once, Sam stays at the arch (the playable branch's own tally, now with a Sam who can be seen and shot). */
function orderOnly(R: Run) { R.F(); R.finish({ reorder: true, post: null, watch: AT.east }); }
/** FLOW (the answer page's 3.12): down the corridor at a run looking into the conference room through its glass on the way (a man seen in there is the one room cleared on
 *  the way: the pair are sent in after him, and Sam goes on with them); the nearer man is sent through the server room's door (open and clear) and held in there — the side door's man; F: he takes the side
 *  door, the other the corridor door, both on one signal; and Sam is the CORRIDOR MAN, rifle up short of the second cubicle doorway, for as long as the pair are
 *  on the doors and in the room. The pair cover the openings he passes without being asked (rescueflow.ts). The in-between styles each drop one piece. */
function flow(R: Run, o: { conference?: boolean; side?: boolean; corridor?: boolean; doorway?: boolean; tools?: boolean; blind?: boolean } = {}) {
  const conf = o.conference ?? true, side = o.side ?? true, corr = o.corridor ?? true, tools = o.tools ?? true;
  let seen: any = null; const look = () => { if (!o.blind) seen ??= roamerInConference(R); return false; };
  R.watch = o.blind ? AT.east : [9, 1.1, 8]; R.go(AT.corridorW, { sprint: true, until: look }); R.go([11.6, 0, 11.3], { sprint: true, until: look }); look();
  if (seen && conf) {
    R.say('a man behind the conference glass — the pair go in after him'); R.order('move', R.floorT(AT.conference)); R.watch = AT.west;
    R.until(() => seen.state === 'dead', 8); R.say(seen.state === 'dead' ? 'he is down — on' : 'they have not got him — on');
    // (and he goes on WITH them: the corridor ahead is the door man's lane, and a man alone at the server door with his boot up is shot there — every loss of the first cut)
    R.order('fallIn', R.noneT()); R.watch = AT.east; R.until(() => R.ops.some((m: any) => m.char.pos[2] > 10.1 && flat(m.char.pos, R.pos) < 3), 5);
  }
  R.watch = AT.east;
  if (side && tools && R.ops.length === 2) {   // the door tools: the side door's man opens the server room himself (the boot is his), Sam never stops in the lane to do it
    const sd = R.door('server').frameCentre, k = R.O.squad().indexOf([...R.ops].sort((a: any, b: any) => flat(a.char.pos, sd) - flat(b.char.pos, sd))[0]);
    R.order('openClear', R.doorT('server'), k); R.go([15.7, 0, 12.8], { sprint: true });   // (and he waits it out in the first cubicle doorway, off the lane)
    R.until(() => !R.g.doorTools.ops.some((op: any) => op.door === R.door('server')), 12); if (R.O.squad()[k]?.state !== 'dead') R.order('hold', R.noneT(), k);
  } else if (side && R.ops.length === 2) {
    R.go(AT.serverFront, { sprint: true }); R.kick('server');
    const sd = R.door('server').frameCentre, k = R.O.squad().indexOf([...R.ops].sort((a: any, b: any) => flat(a.char.pos, sd) - flat(b.char.pos, sd))[0]);
    R.watch = AT.east; if (R.order('move', R.floorT(AT.server), k)) R.until(() => { const m = R.O.squad()[k]; return !m || m.state === 'dead' || inBox(m.char.pos, SERVER); }, 8);
  }
  R.F();
  // the second cubicle doorway gets a rifle of its own: the man farther from the hostage room's door is taken off the entry by the menu (any order takes a man off
  // it) and stood in the doorway, and the other goes in alone
  const md = R.door('manager').frameCentre, far = o.doorway && R.ops.length === 2 ? [...R.ops].sort((a: any, b: any) => flat(b.char.pos, md) - flat(a.char.pos, md))[0] : null;
  const after = far ? () => { if (far.state !== 'dead' && R.ops.length === 2) R.order('move', R.floorT([22.7, 0, 12.7]), R.O.squad().indexOf(far)); } : undefined; after?.();
  const watch = seen && seen.state !== 'dead' ? AT.west : AT.east;
  if (corr) { R.go(AT.post); R.finish({ reorder: true, post: AT.post, watch, after }); }
  else { R.go([17.6, 0, 12.9], { max: 4 }); R.finish({ reorder: true, post: [17.6, 0, 12.9], watch: AT.serverFront }); }   // (off the corridor: back through the first cubicle doorway, out of the lane)
}

export const STYLES: Record<string, { run: (R: Run) => void; words: string; knobs?: Knobs }> = {
  crawl: { run: crawl, words: 'clears the conference room, the cubicles and the server room in order — bang and clear on each door (the men boot what is locked), the cubicles walked through, a wait for quiet after each — calls the pair out, then F on the hostage room with the last can and Sam as corridor man' },
  rush: { run: rush, words: 'Sam sprints the corridor, boots the hostage room\'s door and goes in first, shooting as he goes; no order, no bang; the pair come on behind unasked (one of them stopping on each opening he passes)' },
  flow: { run: R => flow(R), words: 'runs past the conference glass looking in (a man seen there has the pair sent in after him, and Sam goes on with them, not ahead: the one room cleared on the way), sends one man through the server room\'s door (open and clear: he boots it; Sam waits that out off the corridor) and holds him in there, F: that man takes the side door, the other the corridor door, on one signal; Sam holds the corridor short of the second cubicle doorway facing the way a roamer comes' },
  order: { run: orderOnly, words: 'F at once and Sam never leaves the arch (the pair do it all, through the one door)' },
  'crawl-hand': { run: crawlHand, words: 'crawl without the door tools: stack up and move there on each room, Sam boots the server room\'s door himself, no can until the hostage room' },
  'flow-boot': { run: R => flow(R, { tools: false }), words: 'flow, but Sam boots the server room\'s door himself (standing in the corridor to do it) and posts the side door\'s man with move there' },
  'rush-f': { run: R => flow(R, { blind: true, conference: false, side: false }), words: 'the rush with one word of technique: Sam sprints the corridor without a look at anything and presses F as he goes (the pair bang and clear the hostage room through its corridor door); he stops short of the door as corridor man and does not go in' },
  'flow-onedoor': { run: R => flow(R, { side: false }), words: 'flow, but nobody is sent to the side door (and so nobody stops to boot the server door): both men through the corridor door, Sam keeps the corridor' },
  'flow-nobang': { run: R => flow(R), knobs: { stun: false }, words: 'flow, but the men go through their doors with no stun charge ahead of them (the scenario\'s `stun` knob off)' },
  'flow-doorway': { run: R => flow(R, { side: false, doorway: true }), words: 'flow through the one door, but one of the pair is taken off the entry and stood in the second cubicle doorway (move there, straight after F) and the other goes in alone; Sam keeps the corridor' },
  'flow-pass': { run: R => flow(R, { conference: false }), words: 'flow, but a man seen in the conference room is passed, not met (the pair\'s unasked cover and Sam\'s rifle from his post are all he gets)' },
  'flow-nopost': { run: R => flow(R, { corridor: false }), words: 'flow, but nobody is the corridor man: Sam stays off the corridor, in the cubicles by the first doorway, once the order is given' },
};
export const HEADLINE = ['crawl', 'rush', 'flow'];

// ───────────────────────────────────────────────────────────── the worker ─────────────────────────────────────────────────────────────
const DEFAULTS = { ...RESCUE };
export type Knobs = Record<string, unknown>;
export function checkKnobs(knobs: Knobs): string | null { for (const k of Object.keys(knobs)) if (!(k in DEFAULTS)) return `no knob '${k}' (the knobs: ${Object.keys(DEFAULTS).join(', ')})`; if ('start' in knobs && knobs.start !== 'hot') return `the scripted players only know the hot start (F once = bang and clear)`; return null; }
export async function play(style: string, seed: number, cap = 150, verbose = false, knobs: Knobs = {}, samMeter: 'estimate' | 'dark' = 'estimate'): Promise<RunOut & { trace: string[] }> {
  Object.assign(RESCUE, DEFAULTS, knobs, STYLES[style]?.knobs);   // (a style's own knobs are what it IS: they win over --set)
  Math.random = seeded(0x7e5c + seed * 7919);
  const log = console.log, err = console.error; if (!verbose) console.log = () => {};
  let R: Run | null = null, note = '', grade: Grade = 'error', why = '';
  try {
    const W: any = await standUp({ uploadEvery: 2 }); const g = W.game;
    g.tune.chaos = 0.5; g.fogOfWar.on = true;   // (the page's own defaults under ?rescue: main.ts)
    const no = g.rescue.start(); if (no) throw new Error(`start refused: ${no}`);
    R = new Run(W, seed, cap, verbose, samMeter);
    if (g.player.rifle.mode !== undefined && g.player.rifle.mode !== 'semi') g.player.rifle.mode = 'semi';
    try { R.step(20); STYLES[style].run(R); R.until(() => false, cap); } catch (e) { if (!(e instanceof Done)) throw e; why = e.why; }
    const res = R.R.result; grade = res ? res.grade : 'stalled'; if (res) why = res.why;
  } catch (e: any) { grade = 'error'; note = String(e?.stack ?? e).split('\n').slice(0, 4).join(' | '); }
  finally { console.log = log; console.error = err; }
  const RS = R?.R;
  return { style, seed, grade, why, hostages: R ? R.hostagesUp : 0, pair: R ? R.ops.length : 0, sam: R ? !R.sam.down : false, bang: R ? R.at('bang') : null, secured: R ? R.atLast('secured') : null, end: R ? R.clock : 0,
    resolveSecs: RS?.resolveSecs ?? NaN, roamer: R ? R.roamerAt : '', falls: R?.falls ?? [], rounds: R?.rounds ?? {}, orders: R?.orders ?? 0, refused: R?.refused ?? [], note, solo: R?.solo ?? false, split: R ? R.at(/^split:front=.*side=/) !== null : false, trace: R?.trace ?? [] };
}

// ───────────────────────────────────────────────────────────── the tables ─────────────────────────────────────────────────────────────
let MD = false;
function table(rows: string[][]): string {
  if (MD) return [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(r => `| ${r.join(' | ')} |`).join('\n');
  const w = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length))); return rows.map(r => r.map((x, c) => (c ? x.padStart(w[c]) : x.padEnd(w[c]))).join('  ')).join('\n');
}
/** `saved` = hostages alive at the end of a clean or costly run (Sam down, or a hostage hit by him, brings nobody out); `shot` = hostages dead, whoever fired;
 *  `whole` = runs that came off (clean or costly) with Sam and both of the pair up; `nFin` / `pairFin` / `pairLostMedian` = the runs that came off, and the pair in THOSE
 *  (a failed run stops the frame Sam drops or the second hostage is shot: its pair were never put to the room, so a team that never got there is not counted as kept);
 *  `late` = failed with Sam up (the clock, or his own round) */
export interface Rate { n: number; clean: number; costly: number; failed: number; stalled: number; error: number; samDown: number; saved: number; shot: number; whole: number; nFin: number; pairFin: number; pairLostMedian: number; solo: number; split: number; late: number; }
export function report(runs: RunOut[], styles: string[]): { text: string; rates: Record<string, Rate> } {
  const rates: Record<string, Rate> = {}; const out: string[] = [];
  const rows = [['style', 'runs', 'clean', 'costly', 'failed', 'hostages saved', 'hostages shot', 'Sam down', 'pair alive where it came off', 'pair lost there, median', 'came off with nobody lost', 'bang at, s', 'secured at, s', 'rounds Sam : pair : them']];
  const out1 = (r: RunOut) => r.grade === 'clean' || r.grade === 'costly';
  for (const s of styles) {
    const all = runs.filter(r => r.style === s); const n = all.length; if (!n) continue;
    const rs = all.filter(r => r.grade !== 'error'), fin = rs.filter(out1);   // (an errored run is no result: it is counted as an error and nothing else)
    const c = (g: Grade) => all.filter(r => r.grade === g).length; const sum = (f: (r: RunOut) => number) => rs.reduce((a, r) => a + f(r), 0);
    const R: Rate = rates[s] = { n, clean: c('clean'), costly: c('costly'), failed: c('failed'), stalled: c('stalled'), error: c('error'), samDown: rs.filter(r => !r.sam).length, saved: sum(r => (out1(r) ? r.hostages : 0)), shot: sum(r => 2 - r.hostages), whole: fin.filter(r => r.pair === 2).length, nFin: fin.length, pairFin: fin.reduce((a, r) => a + r.pair, 0), pairLostMedian: fin.length ? median(fin.map(r => 2 - r.pair)) : NaN, solo: rs.filter(r => r.solo && out1(r)).length, split: rs.filter(r => r.split).length, late: rs.filter(r => r.grade === 'failed' && r.sam).length };
    const bangs = rs.filter(r => r.bang !== null).map(r => r.bang!), secs = rs.filter(r => r.secured !== null && out1(r)).map(r => r.secured!);
    rows.push([s, String(n), `${R.clean} (${pct(R.clean, n)})`, String(R.costly), `${R.failed}${R.stalled ? ` + ${R.stalled} stalled` : ''}${R.error ? ` + ${R.error} errors` : ''}`, `${R.saved}/${2 * n}`, String(R.shot), `${R.samDown}`, `${R.pairFin}/${2 * R.nFin}`, R.nFin ? String(R.pairLostMedian) : '—', `${R.whole} (${pct(R.whole, n)})`,
      bangs.length ? f1(median(bangs)) : '—', secs.length ? f1(median(secs)) : '—', `${Math.round(sum(r => r.rounds.sam ?? 0) / (rs.length || 1))} : ${Math.round(sum(r => r.rounds.pair ?? 0) / (rs.length || 1))} : ${Math.round(sum(r => r.rounds.defenders ?? 0) / (rs.length || 1))}`]);
  }
  out.push('THE RESCUE, per style (clean = both hostages alive and the room held; costly = one; failed = none, a hostage hit by Sam, or Sam down; saved = alive at the end of a clean or costly run; came off = clean or costly: the pair are counted there only, since a failed run stops before they are put to the room)', table(rows));
  // why the runs that were not clean were not
  const wr = [['style', 'not clean', 'Sam down', 'both hostages shot', 'one hostage shot', 'own fire', 'stalled / error']];
  for (const s of styles) {
    const rs = runs.filter(r => r.style === s && r.grade !== 'clean'); if (!runs.some(r => r.style === s)) continue;
    const k = (f: (r: RunOut) => boolean) => String(rs.filter(f).length);
    wr.push([s, String(rs.length), k(r => !r.sam && r.grade !== 'error'), k(r => r.sam && r.grade === 'failed' && /both/.test(r.why)), k(r => r.grade === 'costly'), k(r => /own fire/.test(r.why)), k(r => r.grade === 'stalled' || r.grade === 'error')]);
  }
  out.push('', 'WHY NOT CLEAN', table(wr));
  // who fell where
  const fr = [['style', 'pair lost', '…in the corridor', '…in the hostage room', '…elsewhere', '…to whom', 'Sam lost', '…where', '…to whom', 'Sam alone took the room', 'two-door goes']];
  const tally = (xs: string[]) => { const m: Record<string, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).map(([k, v]) => `${v} ${k}`).join(', ') || '—'; };
  for (const s of styles) {
    const rs = runs.filter(r => r.style === s); if (!rs.length) continue; const falls = rs.flatMap(r => r.falls);
    const pair = falls.filter(f => f.side === 'pair'), sam = falls.filter(f => f.side === 'sam');
    fr.push([s, String(pair.length), String(pair.filter(f => f.where === 'corridor').length), String(pair.filter(f => f.where === "manager's office").length), String(pair.filter(f => f.where !== 'corridor' && f.where !== "manager's office").length), tally(pair.map(f => f.by)), String(sam.length), tally(sam.map(f => f.where)), tally(sam.map(f => f.by)), String(rates[s].solo), String(rates[s].split)]);
  }
  out.push('', 'WHO FELL WHERE (the corridor includes the stack outside the hostage room\'s door: a man shot there by the Captor was shot from inside the room)', table(fr));
  // the one coin a staging tosses that the styles answer differently: which room the roamer starts in
  const places = [...new Set(runs.map(r => r.roamer).filter(Boolean))].sort();
  if (places.length > 1) {
    const br = [['style', ...places.map(p => `roamer in the ${p}: clean / runs`)]];
    for (const s of styles) { const rs = runs.filter(r => r.style === s && r.grade !== 'error'); if (!rs.length) continue; br.push([s, ...places.map(p => { const at = rs.filter(r => r.roamer === p); return `${at.filter(r => r.grade === 'clean').length} / ${at.length}`; })]); }
    out.push('', 'BY WHERE THE ROAMER STARTED (drawn at each staging)', table(br));
  }
  return { text: out.join('\n'), rates };
}

/** The verdict the task asks for: FLOW beats both CRAWL and RUSH on hostages saved and on the team alive — and the answer page's three targets (3.12).
 *  The staging tosses one coin the styles answer differently (which room the roamer starts in) and a style's result is close to fixed on each side of it, so the
 *  pooled comparison moves with the seed range's split: FLOW has to be no worse than either on EACH side of the coin as well as better pooled. */
export function verdict(rates: Record<string, Rate>, runs: RunOut[] = []): { ok: boolean; lines: string[] } {
  const lines: string[] = []; let ok = true; const chk = (c: boolean, s: string) => { ok &&= c; lines.push(`- ${c ? 'PASS' : 'FAIL'} — ${s}`); };
  const C = rates.crawl, U = rates.rush, F = rates.flow;
  if (!C || !U || !F) return { ok: false, lines: ['- NO VERDICT — the verdict needs `crawl`, `rush` and `flow` in the run'] };
  const team = (r: Rate) => r.whole / r.n, host = (r: Rate) => r.saved / (2 * r.n);
  chk(Math.min(C.n, U.n, F.n) >= 15, `fifteen seeds or more each (crawl ${C.n}, rush ${U.n}, flow ${F.n})`);
  chk(host(F) > host(C) && host(F) > host(U), `FLOW saves more hostages than both (flow ${pct(F.saved, 2 * F.n)}, crawl ${pct(C.saved, 2 * C.n)}, rush ${pct(U.saved, 2 * U.n)})`);
  chk(team(F) > team(C) && team(F) > team(U), `FLOW brings the whole team through more often than both (runs that came off with Sam and both of the pair up: flow ${pct(F.whole, F.n)}, crawl ${pct(C.whole, C.n)}, rush ${pct(U.whole, U.n)})`);
  chk(F.clean / F.n > C.clean / C.n && F.clean / F.n > U.clean / U.n, `FLOW is clean more often than both (flow ${pct(F.clean, F.n)}, crawl ${pct(C.clean, C.n)}, rush ${pct(U.clean, U.n)})`);
  const places = [...new Set(runs.map(r => r.roamer).filter(Boolean))].sort();
  for (const p of places) {
    const of = (s: string) => runs.filter(r => r.style === s && r.roamer === p && r.grade !== 'error'), sv = (s: string) => of(s).reduce((a, r) => a + (r.grade === 'clean' || r.grade === 'costly' ? r.hostages : 0), 0) / (2 * of(s).length || 1);
    if (Math.min(of('crawl').length, of('rush').length, of('flow').length) < 4) { lines.push(`- (roamer in the ${p}: fewer than four runs a style — not judged on its own)`); continue; }
    chk(sv('flow') >= sv('crawl') && sv('flow') >= sv('rush'), `roamer in the ${p}: FLOW saves no fewer hostages than either (flow ${Math.round(100 * sv('flow'))} %, crawl ${Math.round(100 * sv('crawl'))} %, rush ${Math.round(100 * sv('rush'))} % of ${2 * of('flow').length})`);
  }
  chk(1 - C.clean / C.n >= 0.9 && C.failed > C.n / 2 && C.samDown < C.n / 2, `target: CRAWL not clean in ≥ 90 %, failed in most, Sam mostly alive (not clean ${pct(C.n - C.clean, C.n)}, failed ${pct(C.failed, C.n)}, Sam down ${pct(C.samDown, C.n)})`);
  chk(1 - U.clean / U.n >= 0.6 && U.samDown > (U.n - U.clean) / 2, `target: RUSH not clean in ≥ 60 %, mostly by Sam going down (not clean ${pct(U.n - U.clean, U.n)}; Sam down in ${U.samDown} of those ${U.n - U.clean})`);
  chk(F.clean / F.n >= 0.65 && F.pairLostMedian <= 1 && F.nFin > 0, `target: FLOW clean in ≥ 65 % with at most one of the pair lost in the median run that came off (${pct(F.clean, F.n)}, median ${F.pairLostMedian})`);
  const errs = Object.entries(rates).filter(([, r]) => r.error); chk(!errs.length, `no run errored${errs.length ? ` (${errs.map(([k, r]) => `${k} ${r.error}`).join(', ')})` : ''}`);
  return { ok, lines };
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
function seedList(s: string): number[] { return s.split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); if (m) { const a = +m[1], b = +m[2]; return b >= a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [NaN]; } return [/^\d+$/.test(p) ? Number(p) : NaN]; }).filter((x, i, xs) => Number.isNaN(x) || xs.indexOf(x) === i); }

if (import.meta.main) {
  const argv = process.argv.slice(2); const opt: Record<string, string> = {}; const FLAGS = ['seeds', 'styles', 'jobs', 'json', 'cap', 'trace', 'worker', 'set', 'md', 'sam', 'react'];
  for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!argv[i].startsWith('--') || !FLAGS.includes(k)) { console.error(`unknown flag '${argv[i]}' — the flags: ${FLAGS.map(f => `--${f}`).join(' ')}`); process.exit(2); } if (k === 'worker' || k === 'md') { opt[k] = '1'; continue; } const v = argv[++i]; if (v === undefined || v.startsWith('--')) { console.error(`--${k} wants a value`); process.exit(2); } opt[k] = v; }
  const num = (k: string, d: number, min: number) => { if (opt[k] === undefined) return d; const v = Number(opt[k]); if (!Number.isFinite(v) || v < min) { console.error(`--${k} wants a number ≥ ${min} (got '${opt[k]}')`); process.exit(2); } return v; };
  MD = !!opt.md;
  const cap = num('cap', 150, 5); const samMeter = opt.sam === 'dark' ? 'dark' : 'estimate'; BOT.react = num('react', BOT.react, 0);
  if (opt.sam && opt.sam !== 'dark' && opt.sam !== 'estimate') { console.error(`--sam wants 'estimate' or 'dark'`); process.exit(2); }
  let knobs: Knobs = {}; if (opt.set) { try { knobs = JSON.parse(opt.set); } catch (e) { console.error(`--set wants JSON, e.g. '{"setSecs":5}' (${e})`); process.exit(2); } const bad = checkKnobs(knobs); if (bad) { console.error(`--set: ${bad}`); process.exit(2); } }
  const eff: Knobs = { ...DEFAULTS, ...knobs };   // every knob as this process read it, handed to each worker whole: a default edited on disk mid-tally cannot split the table
  const names = (opt.styles ?? HEADLINE.join(',')).split(',').filter(Boolean); const bad = names.filter(n => !STYLES[n]);
  if (bad.length) { console.error(`unknown style '${bad.join("', '")}' — the styles: ${Object.keys(STYLES).join(', ')}`); process.exit(2); }
  if (opt.trace) {
    const [p, s] = opt.trace.split(':'); if (!STYLES[p]) { console.error(`unknown style '${p}' — the styles: ${Object.keys(STYLES).join(', ')}`); process.exit(2); }
    if (s !== undefined && !/^\d+$/.test(s)) { console.error(`--trace wants style:seed, e.g. flow:7 (got '${opt.trace}')`); process.exit(2); }
    const r = await play(p, Number(s ?? 1), cap, true, knobs, samMeter); const { trace, ...rest } = r; console.log(JSON.stringify(rest, null, 1)); process.exit(r.grade === 'error' ? 1 : 0);
  }
  const seeds = seedList(opt.seeds ?? '1-32');
  if (!seeds.length || seeds.some(Number.isNaN)) { console.error(`--seeds wants numbers, e.g. 1-32 or 3,5,9 (got '${opt.seeds}')`); process.exit(2); }
  if (opt.worker) { let bad = false; for (const s of seeds) { const { trace, ...r } = await play(names[0], s, cap, false, knobs, samMeter); bad ||= r.grade === 'error'; process.stdout.write(`RESULT ${JSON.stringify(r)}\n`); } process.exit(bad ? 1 : 0); }
  const jobs = Math.floor(num('jobs', Math.min(8, (await import('node:os')).cpus().length), 1));
  const fs = await import('node:fs'); const stamp = () => Math.max(...[import.meta.path, `${ROOT}/tools/qa/headless.ts`, ...['src', 'levels'].flatMap(d => (fs.readdirSync(`${ROOT}/${d}`, { recursive: true }) as string[]).map(f => `${ROOT}/${d}/${f}`))].map((f: string) => fs.statSync(f).mtimeMs)); const stamp0 = stamp();   // (everything a worker loads afresh)
  const todo = names.flatMap(style => seeds.map(seed => ({ style, seed }))); const runs: RunOut[] = []; const t0 = Date.now(); let next = 0;
  console.log(`rescue tally: ${names.join(', ')} × seeds ${opt.seeds ?? '1-32'} (${todo.length} runs, ${jobs} at a time, cap ${cap} s, Sam's meter: ${samMeter}, his reaction ${BOT.react} s)${opt.set ? ` with ${opt.set}` : ''}`);
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < todo.length) {
      const job = todo[next++];   // (one process a run: nothing of one game is left in the next one's module state)
      const proc = Bun.spawn(['bun', 'run', import.meta.path, '--worker', '--styles', job.style, '--seeds', String(job.seed), '--cap', String(cap), '--sam', samMeter, '--react', String(BOT.react), '--set', JSON.stringify(eff)], { stdout: 'pipe', stderr: 'pipe' });
      const kill = setTimeout(() => proc.kill(), 300_000);   // (a run is seconds of wall; a worker that hangs is an error row, not a hung tally)
      const [text, errText] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]); await proc.exited; clearTimeout(kill);
      const line = text.split('\n').find(l => l.startsWith('RESULT '));
      const r: RunOut = line ? JSON.parse(line.slice(7)) : { style: job.style, seed: job.seed, grade: 'error', why: '', hostages: 0, pair: 0, sam: false, bang: null, secured: null, end: 0, resolveSecs: NaN, roamer: '', falls: [], rounds: {}, orders: 0, refused: [], solo: false, split: false, note: `worker died (${proc.exitCode}): ${errText.slice(-300)}` };
      runs.push(r); process.stderr.write(`  ${r.style} seed ${r.seed}: ${r.grade} — ${r.why || r.note} · hostages ${r.hostages}/2 · pair ${r.pair}/2 · Sam ${r.sam ? 'up' : 'DOWN'} · ${f1(r.end)} s\n`);
    }
  }));
  runs.sort((a, b) => names.indexOf(a.style) - names.indexOf(b.style) || a.seed - b.seed);
  const rep = report(runs, names); console.log(`\n${rep.text}\n`);
  for (const p of names) console.log(`${p}: ${STYLES[p].words}`);
  const stale = stamp() !== stamp0;
  if (opt.json) await Bun.write(opt.json, JSON.stringify({ stale, seeds, styles: names, cap, samMeter, react: BOT.react, knobs: eff, runs }, null, 1));
  if (stale) { console.log('=== rescue-tally: NO VERDICT — the game\'s sources changed on disk while the tally ran (workers load them afresh): run it again ==='); process.exit(2); }
  const v = verdict(rep.rates, runs); console.log(`\nVERDICT\n${v.lines.join('\n')}`);
  console.log(`=== rescue-tally: ${v.ok ? 'ALL PASS' : v.lines[0].includes('NO VERDICT') ? 'NO VERDICT' : 'FAILURES above'} === (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(v.ok ? 0 : v.lines[0].includes('NO VERDICT') ? 2 : 1);
}
