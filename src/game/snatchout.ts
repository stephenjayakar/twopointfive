// HOW A SNATCH ENDS (SNATCHOUT; snatch.ts asks here while the switch is up and the level's block names a van). The maintainer, having played it: "i was
// expecting to have to grab him and exfil him though (while my squad handles holding off the response force), not needing to clear the structure. like maybe we
// need to get him to a van near our infil".
//
//   WHAT WAS THERE   the house taken with him alive and in hand was the win, and he was held where he gave up: nowhere to take him.
//   THE RULE         tied, he is LED: a row on him (Space, 'on your feet — with me') and he gets up and follows whoever said it, on the civilians' own legs
//                    (civilians.ts hostageLead: the walk a rescue's hostages have, his wrists still behind him); the same row then reads 'stay here'. The
//                    level's block names the team's VAN by its way in (scenarios.snatch.van): the leader inside `sendM` of its open doors with him close
//                    behind and he walks the last steps himself, and the moment he is at them he is IN (off the floor) and the mission is WON — men of
//                    theirs alive in the house or not. In Sam's arm, or out cold in his hands, he is in once Sam stands at the doors.
//   LOST is as it was: out by a way of his own, or dead by anybody's round or grenade. Tied is still for good.
//   THE SQUAD (`hold`)  nobody is asked: from the word, the teammates who were with the leader cover the walk out BY BOUNDS — one pair plants (a hold that
//                    names nothing to watch, so cover.ts deals each man one of the doors and gaps a man could come at them by, no two the same), never in
//                    a doorway, on the leader's way out or on a mate; left `trailM` behind, it comes up at the squad's own pace while the pair that was
//                    with the leader plants in its place. While one planted man fights, or one has just gone down, the other's gun goes to where that is.
//                    A man the player has given an order since is the player's: the order stands and this lets go of him (the Assignment is not ours
//                    any more). Nobody in a fight is called off it.
//
// Off (the module's default, the frozen stand) = the build as it was. On in the page (host/profile.ts pageSwitches; ?nosnatchout, ?nosnatchhold) and on the
// shipped stand; TPS_SNATCHOUT=1 raises it on a frozen run. UNTUNED by play.
// Per-player state (habit: 'which player, not the player'): the one who gave the word is kept as a character, never read off Game.player after the press.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard, Interactable, Player, Verb } from './game';
import type { Character } from './character';
import type { Snatch } from './snatch';
import type { Assignment } from './orders';
import { hostageLead, civilianLedTo, civilianOff } from './civilians';
import { COVER } from './cover';

export const SNATCHOUT = {
  on: false,
  /** the squad covers the walk out by bounds, unasked (false: every man does what he was last told) */
  hold: true,
  /** the row on him: its marker shows inside `markerM`, the word can be given inside `reachM` */
  markerM: 2.4, reachM: 2.2,
  /** led, he stops this far behind whoever leads him */
  gapM: 1.3,
  /** the leader this near the van's doors with him inside `sendHimM` of them: he walks the last steps himself · he is IN this near the spot at the doors */
  sendM: 3.5, sendHimM: 8, inM: 1.1,
  /** in Sam's arm or in his hands: Sam this near the doors and he is in */
  carryM: 2.2,
  /** the bounds: a pair left holding comes up once the leader is this far off · a pair coming up has arrived this near him */
  trailM: 12, closeM: 5,
  /** a planted man's gun stays on a mate's fight, or on where the round that put one down came from, this long after the last of it */
  turnSecs: 4,
  /** where a man plants: this clear of the leader's way out · of a doorway's or a gap's width · and no farther than this from where he stood */
  laneM: 1.0, offM: 0.7, spotM: 3.4,
};

type RowFn = (base: Interactable, verb: Verb, text: string, hints?: string, over?: Partial<Interactable>) => Interactable;
type OfferFn = (it: Interactable, verbs: Interactable[]) => void;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the player a row is built for and a press is read from (one today: the place a second would be asked for) */
const who = (g: Game): Player => g.player;

export interface SnatchOutSnap { lead: number | null; led: boolean; sent: boolean; inAt: number }

export class SnatchOut {
  /** whom he follows (null: he is down where he was tied, or put) */
  lead: Character | null = null;
  /** the word has been given at least once since the staging · he has been sent the last steps to the van's doors */
  led = false; sent = false;
  /** the game time he was put in the van (−1: he is not in it) */
  inAt = -1;
  /** the men planted by the bounds, each with the order it gave him (his order being another object = the player's order has him: let go) */
  private jobs = new Map<Guard, Assignment>();
  /** the pair coming up (null: nobody is) · he is being moved (the bounds are running) · bounds made, for the tally */
  private coming: string | null = null; private moving = false; bounds = 0;
  /** every man's order as this last saw it (another object = somebody else has ordered him since) · the men so ordered: theirs, until he is next moved off */
  private last = new Map<Guard, Assignment | null>(); private told = new Set<Guard>();
  /** where a planted man's fight is, or where the round that put one down came from: the rest of the planted men turn onto it until `until` · what each
   *  turned man's order had him on before */
  private hot: { at: Vec3; until: number } | null = null; private turned = new Map<Guard, { watch: Vec3 | null; face: number | null }>();
  constructor(private g: Game, private S: Snatch) {}

  /** a fresh staging (snatch.ts stage / drop): nobody led, nobody planted */
  reset() { this.lead = null; this.led = false; this.sent = false; this.inAt = -1; this.jobs.clear(); this.last.clear(); this.told.clear(); this.coming = null; this.moving = false; this.bounds = 0; this.hot = null; this.turned.clear(); }
  /** the spot at the van's open doors (null: the switch is off, or this level's block names no van) */
  get van(): Vec3 | null { const N = this.S.block; return SNATCHOUT.on && N?.van ? N.van.pos : null; }
  /** this level's snatch ends in the van (asked before he is staged too: qrf.ts) */
  get on(): boolean { return !!this.van; }
  /** …and it is running */
  get ruled(): boolean { return !!this.van && this.S.active; }
  /** he can be given the word: tied, on his feet or down, in nobody's arm */
  private get free(): boolean { const S = this.S, gd = S.man; return this.ruled && !!gd && !S.end && S.tied && gd.state !== 'dead' && !gd.held; }
  /** player.ts buildInteractables: the civilians' own rows on him (the arm from behind) stand down once the word can be given */
  owns(gd: Guard): boolean { return gd === this.S.man && this.free; }
  /** the men the bounds have planted right now */
  get planted(): Guard[] { return [...this.jobs.keys()]; }

  /** THE ROW on him in reach (player.ts buildInteractables, beside the other modules' rows): nothing with the switch off */
  rows(p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) {
    if (!this.free) return;
    const g = this.g, K = SNATCHOUT, pl = who(g), gd = this.S.man!, C = gd.civ!, hp = gd.char.pos, d = flat(p, hp);
    if (d > K.markerM || g.fogOfWar.hidden(gd)) return;
    const near = d < K.reachM && !g.col.solidBlocked([p[0], 1.0, p[2]], [hp[0], 1.0, hp[2]]), can = near && !pl.sprinting;
    const it: Interactable = { kind: 'guard', pos: v3.add(hp, [0, 1.35, 0]), line1: `${C.name} · ${C.label}`, line2: can ? '' : near ? 'stop sprinting' : 'get closer', inReach: can, off: false, guard: gd };
    offer(it, can && !busy ? [this.lead ? row(it, 'stay', 'stay here') : row(it, 'lead', 'on your feet — with me')] : []);
  }
  /** the word, for a caller that is not the key (a script, the console): he follows `by`, or (null) stays where he stands. False = refused */
  word(by: Character | null): boolean {
    if (!this.free) return false;
    const g = this.g, gd = this.S.man!;
    hostageLead(g, gd, by, SNATCHOUT.gapM);
    this.lead = by; this.sent = false; this.moving = false;   // (each word is a fresh start for the bounds: a man ordered since the last one is asked again)
    if (by) this.led = true;
    this.S.note(by ? 'lead' : 'stay');
    return true;
  }

  /** once a frame from snatch.ts tick, after its two losses, while he is alive and the rule is up: this frame's Space on his row, the last steps, the van.
   *  True = he is in it (the mission is won this frame) */
  tick(dt: number): boolean {
    const g = this.g, K = SNATCHOUT, S = this.S, gd = S.man!, V = this.van!, pl = who(g), act = pl.down ? null : g.act;
    if (act && act.kind === 'guard' && act.guard === gd && (act.verb === 'lead' || act.verb === 'stay')) this.word(act.verb === 'lead' ? pl.char : null);
    if (this.lead && this.downed(this.lead)) this.word(null);   // (the one he followed is down: he stays where he stands, and nothing is won behind a man on the floor)
    // in Sam's arm, or out cold in his hands: he follows nobody, and Sam at the doors puts him in
    if (gd.held || gd.state === 'dead') {
      this.lead = null; this.sent = false;
      if ((gd.held || pl.dragging === gd) && !pl.down && flat(pl.char.pos, V) < K.carryM) { this.into(false); return true; }
    } else if (this.lead && S.tied) {
      const dH = flat(gd.char.pos, V);
      if (!this.sent && flat(this.lead.pos, V) < K.sendM && dH < K.sendHimM) { this.sent = true; civilianLedTo(gd, V); S.note('sent to the doors'); }
      if (this.sent && dH < K.inM) { this.into(true); return true; }
    }
    this.bound(dt);
    return false;
  }
  private downed(c: Character): boolean { const g = this.g, pl = who(g); return c === pl.char ? pl.down : g.guards.some(x => x.char === c && x.state === 'dead'); }
  /** the debugger panel's switch thrown mid-run: with the rule off nobody is led and nobody planted (what is on the floor is the old snatch's from there) */
  switched() { if (SNATCHOUT.on) return; const gd = this.S.man; if (gd && this.lead) hostageLead(this.g, gd, null, SNATCHOUT.gapM); this.lead = null; this.sent = false; this.letGo(); }
  private into(walked: boolean) {
    const g = this.g, S = this.S, gd = S.man!, name = gd.civ!.name, V = this.van!;
    this.inAt = g.time; this.lead = null; this.sent = false;
    if (walked) civilianOff(g, gd);   // (on his own feet: up and in — off the floor. In Sam's hands he is at the doors, and the run ends there)
    g.audio.play('doorBang', [V[0], 1.0, V[2]], 0.5);
    this.letGo();
    S.win(`${name} is in ${S.block!.van!.name}`);
  }

  // ---------------------------------------------------------------- the squad, by bounds
  private fighting(gd: Guard): boolean { return (!gd.script && gd.state === 'alert') || !!this.g.fight?.engaged(gd); }
  /** whoever is moving him: the one he follows, or the player with him in an arm or in his hands */
  private get mover(): Character | null { const pl = who(this.g), gd = this.S.man; return this.lead ?? (gd && (gd.held || pl.dragging === gd) && !pl.down ? pl.char : null); }
  /** an order of this module's, and the object it is from then on (what `last` and `jobs` know him by) */
  private mine(gd: Guard, spec: Parameters<Game['orders']['assign']>[1]): Assignment { const O = this.g.orders; O.assign(gd, spec); const A = O.of(gd)!; this.last.set(gd, A); return A; }
  private drop(gd: Guard) { const A = this.jobs.get(gd), was = this.turned.get(gd); if (A && was) { A.watch = was.watch; A.face = was.face; } this.jobs.delete(gd); this.turned.delete(gd); }
  private rejoin(gd: Guard) {
    const O = this.g.orders, A = this.jobs.get(gd); this.drop(gd);
    if (A && O.of(gd) === A && gd.state !== 'dead') this.mine(gd, { order: 'fallIn', post: null, follow: 9, face: null, stance: 'lowReady', upper: 'none', going: 'moving up', there: 'with you' });
  }
  /** it is over, or nobody is moving him: every man still ours goes back to the file (snatch.ts calls this at either end: nothing here ticks after it) */
  letGo() { for (const gd of [...this.jobs.keys()]) this.rejoin(gd); this.coming = null; this.hot = null; this.moving = false; }
  /** where a man plants: where he stands, unless that is in a doorway or a gap, on the way he is walked out by, or on a mate's spot — then the nearest free
   *  floor he can walk straight to that is none of those (null: there is none within `spotM`, and the pair stays in the file) */
  private spot(gd: Guard, route: Vec3[], taken: Vec3[], own: boolean): Vec3 | null {
    const g = this.g, K = SNATCHOUT, col = g.col, p = gd.char.pos, open = g.cover.ready();
    const offRoute = (q: Vec3) => { for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / l2)); if (Math.hypot(q[0] - a[0] - dx * t, q[2] - a[2] - dz * t) < K.laneM) return false; } return true; };
    const ok = (q: Vec3) => !col.nav.isBlocked(q[0], q[2]) && !open.some(o => o.kind !== 'rear' && flat(q, o.at) < o.half + K.offM) && offRoute(q) && !taken.some(t => flat(t, q) < 0.9);
    if (ok(p)) return [p[0], 0, p[2]];
    if (own) return null;
    for (let r = 0.6; r <= K.spotM + 1e-6; r += 0.4) for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, q: Vec3 = [p[0] + Math.sin(a) * r, 0, p[2] + Math.cos(a) * r];
      if (ok(q) && !col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]) && !col.solidBlocked([p[0], 1.3, p[2]], [q[0], 1.3, q[2]])) return q;
    }
    return null;
  }
  /** a pair plants: each man on a spot (above), the men who stand on a good one keeping it; which way each faces is the squad's own rule for men left
   *  holding together (orders.ts holdArcs: an approach each), and the hold names nothing to watch, so cover.ts deals each man one of the doors and gaps
   *  round him, no two the same, re-dealt as they open. With that module off the arc is his watch */
  private plant(men: Guard[]) {
    const g = this.g, O = g.orders, M = this.mover!;
    const route = [M.pos, ...(g.col.nav.findPath(M.pos, this.van!) ?? [])], spots = new Map<Guard, Vec3>();
    for (const own of [true, false]) for (const gd of men) { if (spots.has(gd)) continue; const q = this.spot(gd, route, [...spots.values()], own); if (q) spots.set(gd, q); }
    if (men.some(gd => !spots.has(gd))) return;   // (no floor for one of them here: the pair walks on, and the next half second asks again)
    const at = men.map(gd => spots.get(gd)!), arcs = men.length > 1 ? O.holdArcs(at) : null;
    O.newGroup();
    men.forEach((gd, i) => {
      const p = at[i], arc = arcs?.[i] ?? null, yaw = arc ? arc.yaw : gd.char.aimYaw, fc = arc?.door?.frameCentre;
      const watch: Vec3 | null = COVER.on || !arc ? null : fc ? [fc[0], 1.1, fc[2]] : [p[0] + Math.sin(yaw) * arc.reach, 1.1, p[2] + Math.cos(yaw) * arc.reach];
      this.jobs.set(gd, this.mine(gd, { order: 'hold', post: p, face: yaw, watch, stance: 'none', upper: 'aim', going: 'holding', there: 'holding — covering you' }));
    });
    this.bounds++;
    if (this.bounds === 1) g.say(men[0], 'holding here — get him out.');
  }
  /** a pair looks after itself: while one planted man fights, or one has just gone down, the others' guns go to where that is — and back to their own
   *  openings `turnSecs` after the last of it (a man in his own fight is the fight's) */
  private turn() {
    const g = this.g, K = SNATCHOUT;
    for (const gd of this.jobs.keys()) { const t = g.fight?.opOf(gd)?.tgt; if (t && t.state !== 'dead') this.hot = { at: v3.copy(t.char.pos), until: g.time + K.turnSecs }; }
    if (this.hot && g.time >= this.hot.until) this.hot = null;
    const at = this.hot?.at ?? null;
    for (const [gd, A] of this.jobs) {
      if (this.fighting(gd)) continue;
      const was = this.turned.get(gd);
      if (at) { if (!was) this.turned.set(gd, { watch: A.watch, face: A.face }); A.watch = [at[0], 1.1, at[2]]; A.face = v3.yawTo(A.post ?? gd.char.pos, at); }
      else if (was) { A.watch = was.watch; A.face = was.face; this.turned.delete(gd); }
    }
  }
  private bound(dt: number) {
    const g = this.g, K = SNATCHOUT, O = g.orders, M = K.hold ? this.mover : null;
    for (const gd of [...this.jobs.keys()]) if (gd.state === 'dead') {
      const by = gd.killerId >= 0 ? g.guards.find(x => x.char.id === gd.killerId) : null;
      if (by) this.hot = { at: v3.copy(by.char.pos), until: g.time + K.turnSecs };   // (he went down at his post: the men still on theirs heard where from)
      this.drop(gd);
    }
    if (!M) { if (this.jobs.size || this.moving) this.letGo(); return; }
    if (!this.moving) { this.moving = true; this.told.clear(); this.last.clear(); }
    // an order that is not this module's since it last looked (the player's, a drill's): the man is theirs, and is not asked again until he is next moved off
    for (const gd of O.men('all')) { const A = O.of(gd) ?? null; if (this.last.has(gd) && this.last.get(gd) !== A) { this.told.add(gd); this.drop(gd); } this.last.set(gd, A); }
    if (Math.floor(g.time * 2) === Math.floor((g.time - dt) * 2)) return;   // (twice a second)
    const L = M.pos, V = this.van!;
    this.turn();
    // the groups this can move: each pair's men who are in the file (fall in) or planted by this
    const groups = new Map<string, Guard[]>();
    for (const gd of O.men('all')) {
      if (this.told.has(gd) || (!this.jobs.has(gd) && O.of(gd)?.order !== 'fallIn')) continue;
      const k = O.pairOf(gd) ?? `m${gd.char.id}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(gd);
    }
    const near = (m: Guard[]) => Math.min(...m.map(x => flat(x.char.pos, L)));
    const held = (m: Guard[]) => m.some(x => this.jobs.has(x));
    if (this.coming !== null) { const m = groups.get(this.coming); if (!m || held(m) || near(m) < K.closeM) this.coming = null; }
    // a pair left behind comes up: one at a time, and nobody is called off a fight
    if (this.coming === null) for (const [k, m] of groups) {
      if (!held(m) || near(m) <= K.trailM || m.some(x => this.fighting(x))) continue;
      for (const gd of m) this.rejoin(gd);
      this.coming = k; g.say(m[0], 'moving.');
      break;
    }
    // nobody planted: the pair in the file plants (at the word, the one farther from the van: the other walks him out)
    if (![...groups.values()].some(held)) {
      const free = [...groups].filter(([k, m]) => k !== this.coming && near(m) < K.trailM).map(x => x[1]);
      const far = (m: Guard[]) => Math.max(...m.map(x => flat(x.char.pos, V)));
      free.sort((a, b) => this.coming !== null ? near(a) - near(b) : far(b) - far(a));
      if (free.length) this.plant(free[0]);
    }
  }

  /** snatch.ts objective(): the row once he is in hand — where to take him (null: not this rule's to say) */
  objective(): { text: string; pos: Vec3 | null } | null {
    const S = this.S, gd = S.man; if (!this.ruled || !gd || S.end || !S.inHand) return null;
    const moving = !!this.lead || !!gd.held || who(this.g).dragging === gd;
    return { text: `objective ▸ get ${gd.civ!.name} to ${S.block!.van!.name}`, pos: moving ? v3.copy(this.van!) : [gd.char.pos[0], 0, gd.char.pos[2]] };
  }

  /** the state a save would hold (habit: new state the game depends on has its pair beside it; snatch.ts carries it in its own slice — which nothing loads
   *  today: a checkpoint is refused with a squad on the floor). The bounds are not carried: a load is every man back in the file, and the next half second plants again */
  snapshot(): SnatchOutSnap { return { lead: this.lead ? this.lead.id : null, led: this.led, sent: this.sent, inAt: this.inAt }; }
  restore(s: SnatchOutSnap | undefined) {
    this.reset(); if (!s || !this.ruled) return;
    const g = this.g, pl = who(g), gd = this.S.man!;
    const by = s.lead === null ? null : pl.char.id === s.lead ? pl.char : g.guards.find(x => x.char.id === s.lead)?.char ?? null;
    if (by && this.free) { hostageLead(g, gd, by, SNATCHOUT.gapM); this.lead = by; }
    this.led = s.led; this.inAt = s.inAt;
    if (s.sent && this.lead) { this.sent = true; civilianLedTo(gd, this.van); }
  }
}
/** player.ts buildInteractables: his row (nothing unless a snatch is up with the rule on) */
export function snatchOutRows(g: Game, p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) { g.snatch?.out.rows(p, busy, row, offer); }
