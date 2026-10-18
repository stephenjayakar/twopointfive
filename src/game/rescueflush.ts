// THE MEN LEFT ALIVE ON A RESCUE COME FOR THE HOSTAGES (RESCUEFLUSH; rescue.ts tick() / captor() / clock() ask here while the switch is up). The
// maintainer, 10-18: "remaining enemies should try to flush you out and/or kill the hostage when loud".
//
//   WHAT WAS THERE   the captor's clock passed to a man of theirs only if he happened to be standing in the hostage room; once the room was the team's, the
//                    men alive elsewhere (the door man in the corridor, a roamer who had hunted the noise and lost it, Hard's man on his crossfire) stayed
//                    where the fight had left them. Nobody came back for the hostages and nobody pushed the team off them.
//   THE RULE, once the team has been LOUD (a shot, a bang, a boot of its own: rescue.ts noiseAt) and the ROOM HAS FALLEN (every man posted in it is down):
//     THEY COME   `afterSecs` later the nearest man of theirs outside the room says so on their net and goes for the hostages; every `gapSecs` the next
//                 one follows — the first by the room's main door, the second by its side door where the level has one (two ways at once: the flush), and
//                 so on in turn. Each is let go the way a roamer is let go to the noise (the fight AI's own hunt of his `lastKnown`, the room fight's
//                 'free'): his eyes, his grenades and his pursuit drills are his own, he stops and fights whoever he meets, and the walk is priced and
//                 gated by the covered lanes like any other — a man held at the mouth of a corridor the team's guns hold is not sent down it
//                 (lanes.ts laneHolds / laneWarns), and the pathfinder takes the other way round where there is one.
//     AND AGAIN   a man who has come to rest with nobody in his sights (the room fight planted him again) is sent again `againSecs` after his last word.
//     THEY'RE GONE   the first of them to stand in the hostage room and find no hostage in it says so on the net, and from then on they go where a man
//                 taking people out of the building goes: the team's last loud thing and the way out (the team's own way in), in turn.
//     THE GUN ON HER   a man of theirs with a clear line to a living hostage inside `reachM` HAS her, as the man standing in the room always did
//                 (rescue.ts captor()): the clock is his. One who came for her is `killSecs` from turning his gun on her, then RESCUE.aimSecs from the
//                 round — the same act, broken the same ways (shot, blinded, staggered, grabbed, or one of the team standing in the line). So a
//                 hostage on her feet behind the team is safe only while nobody of theirs is left a line to her.
//   Never: a response from outside (another rule's), more health, a man who knows where the team is without having heard or seen it (the three places
//   he is sent are the room he was guarding, a noise his side heard, and the door the team came in by).
//
// Off (the module's default, the frozen stand) = the build as it was. On in the page (host/profile.ts pageSwitches; ?norescueflush) and on the shipped
// stand; TPS_RESCUEFLUSH=1 raises it on a frozen run. UNTUNED by play.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Rescue } from './rescue';
import { endGuardScript, inBounds } from './squad';
import { resetChase } from './guards';
import { runnerFled, runnerOwns } from './runner';
import { moraleOwns } from './morale';
import { laneHolds, laneWarns } from './lanes';
import { rescueCheckOwns } from './rescuecheck';
import { w } from './words';

export const RESCUEFLUSH = {
  on: false,
  /** seconds from the room falling to the first man moving on it · between one man's word and the next man's · before a man who has come to rest is sent again */
  afterSecs: 4, gapSecs: 2.5, againSecs: 8,
  /** a man with a clear line to a living hostage inside this many metres has her · one who came for her is this long from turning his gun on her */
  reachM: 10, killSecs: 3,
  /** a man with one of the team in his sights this recently is fighting: not sent anywhere */
  busySecs: 2,
  /** smoke between him and her thinner than this hides her from him (the bar guards.ts puts between two AI men) */
  smokeK: 0.3,
  /** a man sent round has reached a mark of his way inside this many metres of it: on to the next, and from the side door in */
  atDoorM: 1.8,
};

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Goal = 'room' | 'side' | 'noise' | 'out';
interface Sent { at: number; n: number; goal: Goal; via: Vec3[] }
export interface RescueFlushSnap { fellAt: number; nextAt: number; goneAt: number; count: number; sent: { id: number; at: number; n: number; goal: Goal; via: number[][] }[]; barred: number[] }

export class RescueFlush {
  /** when the room fell with the team loud (NaN: not yet) · when the next man is due · when one of them found the room empty (NaN: nobody has) · men sent so far */
  fellAt = NaN; nextAt = NaN; goneAt = NaN; count = 0;
  /** every man sent, his last word's time, how many times, where to, and the marks still ahead of him on a way round (`via`: the first is where he walks now) */
  readonly sent = new Map<Guard, Sent>();
  /** the men a held lane has kept from going, each logged once */
  private readonly barred = new Set<Guard>();
  constructor(private g: Game, private R: Rescue) {}

  reset() { this.fellAt = NaN; this.nextAt = NaN; this.goneAt = NaN; this.count = 0; this.sent.clear(); this.barred.clear(); }
  /** the rule is up on this run */
  private get live(): boolean { const R = this.R, g = this.g; return RESCUEFLUSH.on && R.active && !R.result && g.aiEnabled && g.fight.on; }
  private alive(): Guard[] { return this.R.hostages.filter(h => h.state !== 'dead'); }
  /** he came for her (rescue.ts clock(): his wait is `killSecs`, not the room's own man's) */
  came(gd: Guard): boolean { return this.sent.has(gd); }

  /** HIS LINE ON HER: inside `reachM`, nothing that stops a round between his eyes and her chest (a pane that would stop it is a wall to this: collision.ts
   *  shotBlocked), and no smoke of the team's hiding her (the renderer's own answer through Game.sensors; headless nothing answers and the air is clear).
   *  The distance, or Infinity. His facing and the light on her are not asked: he came knowing where she was kept. */
  private line(by: Guard, v: Guard): number {
    const g = this.g, K = RESCUEFLUSH, d = flat(v.char.pos, by.char.pos); if (d >= K.reachM) return Infinity;
    const e: Vec3 = [by.char.pos[0], 1.5, by.char.pos[2]], c = v.char.bones.chest ?? v3.add(v.char.pos, [0, 0.6, 0]);
    if (g.col.shotBlocked(e, c)) return Infinity;
    const T = g.sensors.segment(`rescueS${by.char.id}_${v.char.id}`, e, c);
    return T !== undefined && T < K.smokeK ? Infinity : d;
  }
  /** THE GUN ON HER: the man of theirs, outside the hostage room, with a clear line to a living hostage inside `reachM` — the nearest to one (rescue.ts
   *  captor(), after the room's own men; `keep`: the man who has the clock keeps it while this still holds for him). Null with the switch off. */
  holder(keep: Guard | null): Guard | null {
    if (!this.live || isNaN(this.fellAt)) return null;   // (while the room's own men stand, the clock is theirs as it always was)
    const g = this.g, alive = this.alive(); if (!alive.length) return null;
    const has = (h: Guard): number => {
      if (h.state === 'dead' || h.held || g.time < h.dazzledUntil || runnerOwns(h) || moraleOwns(h)) return Infinity;
      let best = Infinity; for (const v of alive) best = Math.min(best, this.line(h, v));
      return best;
    };
    if (keep && has(keep) < Infinity) return keep;
    let who: Guard | null = null, bd = Infinity;
    for (const h of this.R.hostiles) { const d = has(h); if (d < bd) { bd = d; who = h; } }
    return who;
  }

  /** which of `of` (living hostages) a man of theirs HAS: the ones in the hostage room with him, and — while this rule is up and the room has fallen — the ones
   *  inside `reachM` of him with nothing between his eyes and her chest (rescue.ts clock(): the gun goes on one of these, and the round needs her still to be one) */
  victims(by: Guard, of: Guard[]): Guard[] {
    const B = this.R.bounds, here = inBounds(by.char.pos, B), far = this.live && !isNaN(this.fellAt);
    return of.filter(v => (here && inBounds(v.char.pos, B)) || (far && this.line(by, v) < Infinity));
  }
  /** once a frame from rescue.ts tick(), after its defenders() and before its clock() */
  tick() {
    if (!this.live) return;
    const g = this.g, R = this.R, K = RESCUEFLUSH, B = R.bounds, alive = this.alive();
    if (!alive.length || !R.noiseAt) return;   // nothing loud yet: nobody has been told anything
    if (isNaN(this.fellAt)) {
      if (R.cast().some(c => c.inRoom && c.gd.state !== 'dead' && !c.gd.held && !runnerFled(c.gd))) return;   // a man posted with them still stands: the clock is his, and the others have their own jobs
      this.fellAt = g.time; this.nextAt = g.time + K.afterSecs; R.note('flush:fell');
    }
    const inRoom = alive.some(h => inBounds(h.char.pos, B));
    // one of them stands in the room and nobody is there to shoot: they have been taken out
    if (isNaN(this.goneAt) && !inRoom) {
      const by = R.hostiles.find(h => h.state !== 'dead' && !h.held && inBounds(h.char.pos, B));
      if (by) { this.goneAt = g.time; R.note(`flush:gone:${by.callsign}`); g.say(by, 'they\'re gone — they\'re moving them! cut them off!', true); this.nextAt = Math.min(this.nextAt, g.time + 1); for (const s of this.sent.values()) s.at = -1e9; }
    }
    // a man sent round has reached the side door: on through it, for them (no second word: it is the same errand)
    for (const [h, S] of this.sent) {
      if (!S.via.length || h.state === 'dead' || h.held || flat(h.char.pos, S.via[0]) > K.atDoorM) continue;
      if (g.time - h.lastSeenT < K.busySecs || h.sawFoeThisFrame) continue;   // (one of the team in his sights at the mark: the fight is his, the way round waits)
      S.via.shift(); const to = S.via[0] ?? this.pointOf('room', alive); if (!to) continue;
      h.lastKnown = v3.copy(to); h.path = []; h.pathGoal = null;
      if (!S.via.length) { S.goal = 'room'; R.note(`flush:through:${h.callsign}`); }   // (at the side door: in by it)
    }
    if (g.time < this.nextAt) return;
    // the next man: never sent before the men who have been, then the nearest to where he would go
    const free = (h: Guard): boolean => {
      if (h.state === 'dead' || h.held || g.time < h.dazzledUntil || g.time < h.staggerUntil || runnerOwns(h) || moraleOwns(h) || rescueCheckOwns(g, h)) return false;
      if (inBounds(h.char.pos, B) && inRoom) return false;   // in with them: he has them (captor())
      if (g.time - h.lastSeenT < K.busySecs || h.sawFoeThisFrame) return false;   // one of the team in his sights: he is fighting
      const F = g.fight.defs.find(d => d.gd === h); if (F && F.mode === 'move') return false;   // on somebody's errand (the room fight's fall-back, Hard's crew on its way): that first
      const S = this.sent.get(h); if (!S) return true;
      if (g.time - S.at < K.againSecs) return false;
      return !F || F.mode === 'hold' || h.state === 'patrol' || h.state === 'suspicious' || h.state === 'search';   // come to rest, or hunting nothing
    };
    const room = R.outsidePoint;
    const pool = R.hostiles.filter(free).sort((a, b) => (this.sent.get(a)?.n ?? 0) - (this.sent.get(b)?.n ?? 0) || flat(a.char.pos, room) - flat(b.char.pos, room));
    for (const h of pool) {
      // his turn's way, else the other one: a corridor the team's guns hold is not walked down, and nobody goes alone at those guns (lanes.ts: its own
      // men go round, look and throw there) — so the way that is not held is the one he takes
      const n = this.sent.get(h)?.n ?? 0, a = this.goalOf(this.count, inRoom), b = this.goalOf(this.count + 1, inRoom);
      for (const goal of a === b ? [a] : [a, b]) {
        const via = goal === 'side' ? R.sideWay : [], at = via[0] ?? this.pointOf(goal, alive); if (!at || laneHolds(g, h, at) || laneWarns(g, h, at)) continue;
        this.send(h, goal, at, n, via); this.barred.delete(h);
        this.nextAt = g.time + K.gapSecs; return;
      }
      if (!this.barred.has(h)) { this.barred.add(h); R.note(`flush:lane:${h.callsign}`); }
    }
    this.nextAt = g.time + 1;   // nobody free this second: asked again the next
  }
  /** where the k-th word sends a man: the room by its two doors in turn while they are known to be in it, then the team's noise and the way out in turn */
  private goalOf(k: number, inRoom: boolean): Goal {
    if (inRoom || isNaN(this.goneAt)) return k % 2 === 1 && this.R.data?.side ? 'side' : 'room';
    return k % 2 === 0 ? 'out' : 'noise';
  }
  private pointOf(goal: Goal, alive: Guard[]): Vec3 | null {
    const R = this.R, S = R.data; if (!S) return null;
    if (goal === 'room' || goal === 'side') {   // (a man sent round walks rescue.sideWay first — tick(): the short way to a point IN the room is the main door)
      const B = R.bounds, v = alive.find(h => inBounds(h.char.pos, B));   // (where he knows they were kept: the room itself once they are not in it)
      return v ? [v.char.pos[0], 0, v.char.pos[2]] : B ? [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2] : null;
    }
    if (goal === 'noise' && R.noiseAt) return v3.copy(R.noiseAt);
    return R.ending.out;
  }
  /** let go to hunt it, as rescue.ts lets a roamer go to the noise; and his word on the net (the player's cue: it goes to the radio strip) */
  private send(h: Guard, goal: Goal, at: Vec3, n: number, via: Vec3[] = []) {
    const g = this.g, R = this.R, F = g.fight.defs.find(d => d.gd === h);
    R.letGo(h);
    h.hold = false; h.pinned = false;
    if (F) { F.mode = 'free'; F.freeAt = g.time; F.rallyAt = NaN; }
    if (h.script) endGuardScript(h, 'alert');
    h.state = 'alert'; h.awareness = 1; h.reactT = 0; h.lastKnown = v3.copy(at); h.path = []; h.pathGoal = null; resetChase(h);
    this.sent.set(h, { at: g.time, n: n + 1, goal, via: via.map(p => v3.copy(p)) }); this.count++;
    R.note(`flush:${goal}:${h.callsign}`);
    if (n > 0) return;   // (a man's second errand is not announced: one line a man)
    g.say(h, goal === 'room' ? w('it\'s gone quiet in there — I\'m going in for them!', 'it\'s gone quiet in there — i\'m going in for them!')
      : goal === 'side' ? w('going round — I\'ll take the other door!', 'going round — i\'ll take the other door!')
      : goal === 'out' ? 'on the way out — they don\'t leave with them!'
      : 'moving on that noise — keep them boxed in!', true);
  }

  /** the state a save would hold (habit: its pair beside it; no checkpoint is reachable while a rescue is staged, so only the check calls these) */
  snapshot(): RescueFlushSnap { return { fellAt: this.fellAt, nextAt: this.nextAt, goneAt: this.goneAt, count: this.count, sent: [...this.sent].map(([gd, s]) => ({ id: gd.char.id, at: s.at, n: s.n, goal: s.goal, via: s.via.map(p => [...p]) })), barred: [...this.barred].map(gd => gd.char.id) }; }
  restore(s: RescueFlushSnap) {
    this.fellAt = s.fellAt; this.nextAt = s.nextAt; this.goneAt = s.goneAt; this.count = s.count; this.sent.clear(); this.barred.clear();
    for (const r of s.sent) { const gd = this.R.hostiles.find(h => h.char.id === r.id); if (gd) this.sent.set(gd, { at: r.at, n: r.n, goal: r.goal, via: (r.via ?? []).map(p => [p[0], p[1], p[2]] as Vec3) }); }
    for (const id of s.barred ?? []) { const gd = this.R.hostiles.find(h => h.char.id === id); if (gd) this.barred.add(gd); }
  }
}
