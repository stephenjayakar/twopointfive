// QUIET ORDERS FOR ONE PARTNER (two person stealth): what Sam can tell the one AI teammate while the pair is still unseen, in the squad order menu's own grammar
// (orders.ts: X / the middle button opens the menu on what the cursor is on, a digit 1‥5 picks, B gives the target's first row at once, F is the word).
//
//   THE SWITCH. `PAIR.on`, OFF by default (`?pairorders` for the visit, Tab ▸ Sandbox ▸ Team feel; the harness leaves it off). Off — or with a squad of more
//   than `PAIR.maxSquad` men, or none — nothing here is on the menu, a person is not a target, no built-in row is touched and the two seams in the room fight
//   return on their first line: the game as it was (probes.ts pair-identity; the playthrough digests against the base).
//
//   A PERSON IS A TARGET. With the cursor on a defender the team can see (not one the fog of war hides), the menu opens ON HIM, as it does on a door:
//     1  take him · on your mark   the partner works round to the man's BACK unseen (stalk: the floor in front of every defender priced all but shut), stops a
//                                  few paces short, says 'set.' and WAITS. The MARK is F — or Sam's own hands going onto a man (his takedown, his grab:
//                                  `markOnHands`), so two men go down on one beat. On the mark he closes the last paces and puts the man out cold, quietly.
//                                  F before he is set: he goes as soon as he can get there.
//     2  watch him                 where he stands, gun on the man, no round while the man has not noticed anybody
//     3  fall in                   the built-in row ('on me')
//     4  hold position             the built-in row ('wait here')
//     5  take him now              the same job with no waiting: the partner picks his own moment (on the heels of the man's glance)
//   and on FLOOR, while the squad is silent (silent.ts: with no silent order in the build there is no such row):
//     1  move there · hold in the dark   in place of 'move there': the dark floor at, or nearest, the point — crouched, gun low. No dark floor within `darkM`:
//                                  refused, 'nowhere dark there.' (`darkRefuse` off: he goes anyway and says it is lit)
//   AN ORDER THAT CANNOT BE DONE IS REFUSED WITH A CUE — greyed on the menu with the reason, and said by the man when given by B: no way to the man ("can't get
//   there."), no floor at his back ('no room at his back.'), the man already down, the man already roused ("he's fighting. no hands."). A job that goes wrong
//   under way ends in words too: seen ("he's seen me!" — he stands with his gun on the man and the fight is the fight layer's), no way round unseen for
//   `stalkWait` s ('no way to his back unseen.'), not done in `takeSecs` ("can't get to his back."). Any other order cancels the job where he stands.
//
//   NOT HERE (other parts of the goal): how the partner moves and follows while nobody is alerted — his pace, his crouch, how well he sneaks — and what he does
//   once a guard is suspicious. The stalk's own pace and crouch are knobs here until that part gives him a sneaking grade to read.
//
// No module-level table is built from another game module's exports (src/game is one import cycle): PAIR is a plain literal, the rows are made in seat().
import { SideMap, rollbackRoot } from '../math/side';
import type { Game, Guard } from './game';
import type { Input } from './input';
import { v3, type Vec3 } from '../math/vec';
import { killGuard } from './combat';
import { lightEstimateAt, canSeeChar, sightGainOn, pointInView, BODY_LIGHT, GUARD_EYE } from './guards';
import { SILENT, squadSilent, setSilent, urgent } from './silent';
import { pairUp, PAIRUP_STATS } from './pairup';
import { SNEAK, sneakWalk } from './sneak';
import { SPOTTED, spottedMode, spottedBy, spottedTake, spottedGripped } from './spotted';
import { HOSTILE } from './teams';
import { partnerBegin, partnerCancel, partnerFall } from './takedown';   // the partner's takedown as a move, and the man it lands on (takedown.ts): poses only
import { WORD_HEAD, type Assignment, type OrderDef, type SquadOrders } from './orders';

export const PAIR = {
  /** THE SWITCH: the quiet orders for one partner (off: the game as it was) */
  on: false,
  /** the biggest squad (men besides Sam) the rows are offered to: these are a PAIR's orders */
  maxSquad: 1,
  /** a defender this near (m) the point under the cursor is the target (his body under the cursor always is) */
  pickM: 0.9,
  /** on your mark: how far behind the man (m) the partner waits · his hands reach this far (m) and take this long (s) · the noise they make (a 'prop' event; 0: none) */
  stageM: 1.2, reach: 1.05, secs: 0.6, scuffle: 0,
  /** a man with the partner's hands on him sees nobody for as long as they are (as one in Sam's arm does not): false = he could turn his head inside those
   *  `secs`, see the man at his back at arm's length and go ALERT before he went down — one takedown in a handful, played */
  grip: true,
  /** … nor does he find a BODY while they are on him: two men who face each other across a lit road, taken on one beat, otherwise fail by a tenth of a second —
   *  the first to drop is found, and radioed, by the second with the partner's hands already on him (the border crossing's lane, traced). The hold is `gripped()`'s:
   *  while the partner's job on him stands, at most `secs` + 0.5 s from the hands going on (0.6 s when the takedown lands; up to 1.1 s when it does not), and it
   *  ends with the job. It is asked inside guards.ts bodySeen, so every caller takes it — enemysquads.ts's two as well (a squad man in those hands). false = as it was */
  gripBody: true,
  /** his pace working round to the man's back, and over the last paces once sent (m/s; the silent posture's own cap still applies) · on a knee on the way */
  pace: 1.1, goPace: 1.6, crouch: true,
  /** the way to that back is read this often (s); with every way across somebody's eyes he waits this long (s) before he says there is none */
  stalkEvery: 0.3, stalkWait: 20,
  /** A SENTRY WHO SWEEPS: a standing man's head turning to and fro takes his near field (±100° of where he looks) round with it, so the floor at his elbow
   *  that is out of his eye this second is in it the next. The way to a back treats floor inside `ringM` of such a man as watched wherever his sweep has
   *  reached lately — all but a wedge astern of the way he mostly faces — so the search goes round it, the same way round every time it is asked (off: priced only
   *  where he looks now and mostly looks, and two near-equal ways round him trade places as his head turns) */
  sweep: true, ringM: 2.4,
  /** the way he is on is kept while it is still unseen and a fresh one is not clearly shorter (off: searched afresh every second and a half, taken whatever it is) */
  keepWay: true,
  /** where a man MOSTLY faces is read from when he last stopped walking (off: one six-second average, his walk to the post in it) */
  habitStood: true,
  /** HE DOES NOT TURN ABOUT ON HIS WAY (the maintainer, 10-22, the pair lesson: "partner seems to be very paranoid about always turning around to check the
   *  other guy"). Two things turned him (the lesson's scripted run, sampled): the way to a man's back handed out with a corner he had already passed first —
   *  the way he is kept on picks its nearest CORNER, and with that a pace behind him he turned right round to walk back to it and round again the next time
   *  the way was read; and each time the way read watched he parked and at once squared to the man, sixty to a hundred degrees, and squared back to walk a
   *  third of a second later. So: on the kept way a corner he is already past along its own leg is dropped, where the way on from the next is as plain and
   *  as cheap a walk from where he stands (priced as any kept way is); and parked on a watched way he keeps the heading he has for `steadyFaceSecs` — only a wait that lasts turns him to watch
   *  his man. The page: on (`?pairsteady=0`); false here and on the frozen harness stand (`TPS_PAIRSTEADY=1`; a FROZEN_HOLDS row). false = as it was */
  steady: false, steadyFaceSecs: 1.2,
  /** floor inside this (m) of a defender, in front of him and in his sight, is not walked (just past GUARD_EYE.nearM: inside that an eye has ±100°, and at
   *  2.6 two of 37 un-staged takes on The block and the depot walked the partner into it and were seen) */
  frontM: 3.6,
  /** … nor is LIT floor (brighter than `coneLit` on the meter's scale, the CPU's steady direct estimate) inside `coneM` of a defender, within 65° of where he
   *  looks and in his line: a man taken there is taken in plain view of his mate. 0 m = only the near field counts (un-staged on The block a man was then taken 5 m in front of his mate, on lit floor, and the floor woke) */
  coneM: 9, coneLit: 0.3,
  /** HE'S WATCHED: at the mark (and at his own moment, 'take him now') the partner asks whether another defender would SEE it — by the defenders' own tests:
   *  eyes on the partner at the man's back (canSeeChar) with light enough on him to start that man inside `watchSecs` (sightGainOn × secs ≥ `watchAw`), or the
   *  floor the man will lie on in his open view with the bodies-by-light bar met by the light now on him. Then he does not go: he says who, and waits for
   *  that man to look away — or for a second mark ('going anyway.'). Sam's own hands as the mark are never held up by it. Off: the mark is the mark. */
  watched: true, watchSecs: 1.2, watchAw: 0.25,
  /** … and a watcher who stands where he stood and whose sweep will bring his eyes back is not 'looking away': the partner stays held ('he'll look back.')
   *  until that man walks off, turns for good, or a second mark sends him (off: he goes the moment the watcher's head is turned) */
  lookBack: true,
  /** 'take him now': he holds at this ring (m) for the man to glance away and back, and goes within `heelFresh` s of the glance ending — or after `heelWait` s of none */
  heelRing: 2.9, heelFresh: 1.2, heelWait: 22,
  /** a job not done this long (s) after it was given (after the mark, for one that waited) is called off by the man himself */
  takeSecs: 75,
  /** Sam's own hands going onto a man (his takedown, his grab) are the mark too */
  markOnHands: true,
  /** a row here given while the squad is loud puts it in silent first (off: refused, "we're loud") */
  quietFirst: true,
  /** hold in the dark: floor is DARK at or under this on the light meter's 0‥1 scale (the place's steady light, direct only) · how far (m) from the point he
   *  may look for it · none: refuse (off: go anyway, and say so) · on a knee there · the height (m) the light is read at */
  darkVis: 0.3, darkM: 1.5, darkRefuse: true, darkCrouch: true, darkH: 0.9,
  /** … and once there he says so when the place has been lit this long (s), not more often than every `litEvery` s */
  litSecs: 2, litEvery: 20,
};
const STEADY_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PAIRSTEADY_BREAK === '1';   // (QA: the rule's own check must fail with this set)
export const PAIR_STATS = { given: 0, marks: 0, taken: 0, blown: 0, called: 0, cancelled: 0, held: 0, dark: 0, lit: 0, watched: 0, anyway: 0 };
/** what happened when (the probes read it; capped): 'mark:<man> on <foe>', 'now:…', 'set:…', 'go:<by>', 'watched:<foe> by <who>', 'clear:…', 'anyway:…', 'hands:…', 'down:…', 'blown:…', 'off:<why>', 'cancel:…', 'dark:…', 'lit:…' */
export const PAIR_LOG: { t: number; what: string }[] = [];
rollbackRoot('pairorders.PAIR_LOG', PAIR_LOG);   // (not a log alone: a lesson's `pair` step counts the rows filed since it began — lesson.ts)
/** ?pairorders (=0: off) and the harness's PAIRORDERS — read at load, and again once the Game has read the stored team feel back (the flag is this visit's word) */
function flags() {
  try { const q = new URLSearchParams(location.search); if (q.has('pairorders')) PAIR.on = q.get('pairorders') !== '0'; } catch { /* no page (the harness) */ }
  try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PAIRORDERS; if (e) PAIR.on = e !== '0' && e.toLowerCase() !== 'off'; } catch { /* no process (the page) */ }
}
flags();

const flat = v3.distXZ, yawTo = v3.yawTo;
const ROWS = ['pairMark', 'pairWatch', 'pairTake', 'pairDark', 'pairGo'];
const TAKES = ['pairMark', 'pairTake'];
const nameOf = (h: Guard) => h.callsign || 'that man';
/** where a man is LOOKING on the floor plane: his chest and his head, halved */
function lookOf(h: Guard): [number, number] { const a = h.char.chestDir, b = h.char.headDir(), x = a[0] + b[0], z = a[2] + b[2], L = Math.hypot(x, z); return L > 1e-4 ? [x / L, z / L] : [Math.sin(h.char.bodyYaw), Math.cos(h.char.bodyYaw)]; }

interface Job {
  foe: Guard; mode: 'mark' | 'now';
  /** the mark has been given (mode 'now': from the start) · he is on his staging spot · 'set.' has been said */
  go: boolean; set: boolean; setSaid: boolean;
  /** when his hands went on (−1: not yet) · when the job (or its last leg) began · when the way was last read · since when there has been none · since when he has waited at the ring · he is past it */
  t0: number; born: number; checkT: number; waitT: number; heelT: number; going: boolean; scuffled: boolean;
  /** the mark is given but another defender would see it (who, since when) · a second mark, or Sam's own hands: he goes whoever is looking */
  /** he was at Sam's shoulder (on 'fall in') when the order came: with the man down he falls in again (pairup.ts 'rejoin') */
  wasFollowing: boolean;
  /** the man roused with this one at his back and spotted.ts's hands took it on (pairup.ts 'hands'): the job waits on them */
  handed?: boolean;
  watcher: Guard | null; watchT: number; seenT: number; force: boolean; cueT: number; cueBy: Guard | null; cued: boolean; backSaid?: boolean; backT?: number;   // (cue*: the 'hold … / clear.' pair is SAID at most once per 8 s per watcher — a watcher whose glance comes and goes is not narrated turn by turn; the status line always shows it)
}

export class PairOrders {
  private jobs = new Map<Guard, Job>();
  /** where each defender MOSTLY looks (his facing eased over ~6 s: the back a takedown goes for) and whether he is glancing off it right now */
  private habit = new SideMap<Guard, [number, number]>();
  private glance = new SideMap<Guard, { on: boolean; endT: number; h0?: [number, number] }>();
  /** seconds a defender has stood where he is (0 while he walks) · how far (rad) his look has lately swung off the way he mostly faces, standing */
  private stood = new SideMap<Guard, number>();
  private swept = new SideMap<Guard, number>();
  private dark = new SideMap<Guard, { checkT: number; litT: number; saidT: number }>();
  private darkMemo = new Map<string, { t: number; spot: Vec3 | null }>();
  /** the way each man is on to a back, under pairup.ts oneEye (stalk keeps it while it reads unseen) */
  private ways = new SideMap<Guard, { to: Vec3; path: Vec3[]; t: number }>();
  private seated = false; private goSeated = false; private handsWas = false;
  constructor(private g: Game) {
    const S = g.orders; flags();
    S.people = {
      near: at => { if (!this.up) return null; let best: Guard | null = null, bd = PAIR.pickM;
        for (const h of g.guards) { if (!this.isFoe(h)) continue; const d = flat(h.char.pos, at); if (d < bd) { bd = d; best = h; } }
        return best ? { gd: best, d: bd } : null; },
      ray: (ro, rd, max) => { if (!this.up) return null; let best: Guard | null = null, bt = max;
        for (const h of g.guards) { if (!this.isFoe(h)) continue; const t = h.char.rayHit(ro, rd, bt); if (t >= 0 && t < bt) { bt = t; best = h; } }
        return best; },
    };
    S.notes.push(() => { if (!this.seated) return []; const W = this.waiting();
      return W.length ? [{ key: 'F', text: `mark · ${W.map(([gd, J]) => J.watcher ? `${gd.callsign} takes ${nameOf(J.foe)} anyway (${nameOf(J.watcher)} is watching)` : `${gd.callsign} takes ${nameOf(J.foe)}${J.set ? '' : ' (not set)'}`).join(' · ')}` }] : []; });
  }

  // ------------------------------------------------------------ who, what
  /** the rows are on the menu: the switch, a squad on the floor, and not more of it than a pair's orders are for */
  get up(): boolean { if (!PAIR.on) return false; const S = this.g.orders; if (!S.active) return false; const n = S.squad().length; return n >= 1 && n <= PAIR.maxSquad; }
  /** the squad is quiet enough for hands (silent — or the silent order not in the build at all) */
  get quiet(): boolean { return !SILENT.on || squadSilent(this.g); }
  /** a man an order can be about: standing, on the other side from Sam, not in Sam's arm, and seen (the fog of war has not got him) */
  isFoe(h: Guard): boolean { return h.state !== 'dead' && h.team !== 'operative' && HOSTILE.player[h.team] && !h.held && !this.g.fogOfWar.hidden(h); }
  /** he has noticed somebody: roused, searching, or his meter past the silent order's own `noticed` (silent.ts silentHolds: one number for both) */
  noticed(h: Guard): boolean { return h.state === 'alert' || h.state === 'search' || h.awareness >= SILENT.noticed; }
  /** the men waiting on the mark */
  waiting(): [Guard, Job][] { return [...this.jobs].filter(([gd, J]) => !J.handed && ((J.mode === 'mark' && !J.go) || (!!J.watcher && !J.force && this.g.time - Math.max(J.seenT, J.backT ?? -1e9) < 1)) && gd.state !== 'dead'); }
  jobOf(gd: Guard): Readonly<Job> | null { return this.jobs.get(gd) ?? null; }
  /** (bounded: hands that stopped being tended — their man handed to the fight AI mid-struggle — do not blind the man for ever) */
  gripped(h: Guard): boolean { for (const J of this.jobs.values()) if (J.foe === h && J.t0 >= 0 && this.g.time - J.t0 < PAIR.secs + 0.5 && this.g.time >= J.t0) return true; return false; }
  /** spotted.ts says the pair is CAUGHT (pairup.ts: no take order is given then — it would be dropped the frame it was taken up) */
  private caught(S: SquadOrders): boolean { return SPOTTED.on && S.squad().some(gd => gd.state !== 'dead' && spottedMode(this.g, gd) === 'caught'); }
  /** his hands are on his man, or he is sent and on the last paces to him: with spotted.ts on, nobody else has his gun or his chest until it is done */
  finishing(gd: Guard): boolean { const J = this.jobs.get(gd); return !!J && SPOTTED.on && (J.t0 >= 0 || this.lastPaces(J, gd)); }
  /** sent, inside the ring, on his way with nothing holding him (not held for a watcher, not waiting on a way) and nothing solid between him and the man */
  private lastPaces(J: Job, gd: Guard): boolean { const p = gd.char.pos, c = J.foe.char.pos;
    return J.going && !J.watcher && J.waitT < 0 && flat(p, c) < PAIR.heelRing && !this.g.col.solidBlocked([p[0], 1.0, p[2]], [c[0], 1.0, c[2]]); }
  /** why a man an order pointed at is no longer one (null: he still is) */
  private gone(h: Guard): string | null { return h.state === 'dead' || !this.g.guards.includes(h) ? "he's down already." : h.held ? "he's in your arm." : this.g.fogOfWar.hidden(h) ? 'lost sight of him.' : null; }
  /** a clear line from a teammate's eyes to a man's chest (glass passes, as for any eye) */
  private sees(gd: Guard, h: Guard): boolean { const a = gd.char.pos, b = h.char.pos; return !this.g.col.segmentBlocked([a[0], 1.5, a[2]], [b[0], 1.2, b[2]]); }
  /** is `p` in the half of the floor behind the way `h` is looking right now — or (`mostly`) the way he mostly faces, which is the back `behind` goes for (a hand's width of grace) */
  private rear(h: Guard, p: Vec3, mostly = false): boolean { const y = this.yawOf(h), [lx, lz] = mostly ? [Math.sin(y), Math.cos(y)] : lookOf(h), c = h.char.pos; return lx * (p[0] - c[0]) + lz * (p[2] - c[2]) < 0.25; }
  private note(what: string) { PAIR_LOG.push({ t: this.g.time, what }); if (PAIR_LOG.length > 200) PAIR_LOG.splice(0, 50); }

  // ------------------------------------------------------------ the rows
  private rows(): OrderDef[] {
    const g = this.g;
    const loud = (): string | null => this.quiet || PAIR.quietFirst ? null : "we're loud — he gets shot, not grabbed.";
    const take = (id: string, mode: Job['mode'], key: number, label: string, ack: string[]): OrderDef => ({
      id, key, label, targets: ['foe'], ack,
      // a one-man job takes one man: the nearest of those addressed who has a way to him
      only: (S, men, t) => { if (t.kind !== 'foe') return []; const to = this.stage(t.foe);
        return men.filter(gd => S.reach(gd, to) === null).sort((a, b) => flat(a.char.pos, t.foe.char.pos) - flat(b.char.pos, t.foe.char.pos)).slice(0, 1); },
      can: (S, gd, t) => { if (t.kind !== 'foe') return 'no man there.'; const to = this.behind(t.foe), spot = S.freeSpot(to) ?? to;
        return !this.backOpen(t.foe, spot) || !this.rear(t.foe, spot, true) ? 'no room at his back.' : S.reach(gd, this.stage(t.foe)) ?? true; },
      valid: (S, t) => t.kind !== 'foe' ? false : this.gone(t.foe) ?? (this.noticed(t.foe) ? "he's fighting. no hands." : this.caught(S) ? "they're onto us. no hands." : loud() ?? true),
      issue: (S, men, t) => {
        if (t.kind !== 'foe') return 'no man there';
        this.quietFirst();
        for (const gd of men) { const foe = t.foe, p = this.stage(foe);
          const was = this.jobs.get(gd), wasFollowing = was ? was.wasFollowing : S.of(gd)?.post === null;   // (a second order on top of a first keeps what he was before either)
          this.jobs.set(gd, { foe, mode, go: mode === 'now', set: false, setSaid: false, t0: -1, born: g.time, checkT: -1, waitT: -1, heelT: -1, going: false, scuffled: false, wasFollowing, watcher: null, watchT: -1, seenT: -1, cueT: -1e9, cueBy: null, cued: false, force: false });
          S.assign(gd, { order: id, post: p, face: null, foe, crouch: PAIR.crouch, pace: PAIR.pace, stance: 'lowReady', upper: 'none', going: `moving up on ${nameOf(foe)}`, there: `on ${nameOf(foe)}` });
          PAIR_STATS.given++; this.note(`${mode}:${gd.callsign} on ${nameOf(foe)}`); }
      },
      tick: (S, gd, A) => this.takeTick(S, gd, A),
    });
    return [
      take('pairMark', 'mark', 1, 'take him · on your mark', ['moving up on him.', 'on him. your mark.']),
      { id: 'pairWatch', key: 2, label: 'watch him', targets: ['foe'], ack: ['eyes on him.', "i've got him."],
        can: (_S, gd, t) => (t.kind === 'foe' && this.sees(gd, t.foe)) || 'no line from here.',
        valid: (_S, t) => t.kind !== 'foe' ? false : this.gone(t.foe) ?? true,
        issue: (S, men, t) => {
          if (t.kind !== 'foe') return 'no man there';
          for (const gd of men) { const p = gd.char.pos, c = t.foe.char.pos, words = `watching ${nameOf(t.foe)}`; this.jobs.delete(gd);
            S.assign(gd, { order: 'pairWatch', post: [p[0], 0, p[2]], face: yawTo(p, c), watch: [c[0], 1.1, c[2]], foe: t.foe, stance: 'none', upper: 'aim', going: words, there: words }); }
        },
        tick: (S, gd, A) => { const h = A.foe; if (!h) return;
          if (h.state === 'dead' || !g.guards.includes(h)) { this.stand(S, gd, 'holding', null); return; }
          if (!this.sees(gd, h)) return;   // (behind something: the gun stays on where he last saw him — it does not follow a man through a wall)
          const c = h.char.pos; if (A.watch) { A.watch[0] = c[0]; A.watch[2] = c[2]; } A.face = yawTo(gd.char.pos, c); } },
      take('pairTake', 'now', 5, 'take him now', ['on him.', 'moving up on him.']),
      { id: 'pairDark', key: 1, label: 'move there · hold in the dark', targets: ['floor'], ack: ['moving.', 'on it.'],
        standsIn: { for: 'move', when: () => this.up && squadSilent(g) },
        can: (S, gd, t) => { const d = this.darkSpot(t.at), w = S.reach(gd, d ?? t.at); return w !== null ? w : d || !PAIR.darkRefuse ? true : 'nowhere dark there.'; },   // (no way there is said before no dark there: it is the nearer reason)
        issue: (S, men, t) => {
          const sam = g.player.char.pos, face = flat(sam, t.at) > 0.3 ? yawTo(sam, t.at) : g.player.char.bodyYaw, d = this.darkSpot(t.at), to = d ?? t.at;
          const spots = men.length > 1 ? S.spotsAt(to, face, men.length) : [to];
          S.pair(men, spots).forEach(([gd, p]) => { this.jobs.delete(gd); this.dark.set(gd, { checkT: -1, litT: -1, saidT: -1e9 });
            S.assign(gd, { order: 'pairDark', post: [p[0], 0, p[2]], face, crouch: PAIR.darkCrouch, stance: 'lowReady', upper: 'none', going: 'moving · to the dark', there: 'holding in the dark', setLine: 'set.' });
            PAIR_STATS.dark++; this.note(`dark:${gd.callsign} ${p[0].toFixed(1)},${p[2].toFixed(1)}${d ? '' : ' (lit)'}`); if (!d) g.say(gd, "it's lit there."); });
        },
        tick: (_S, gd, A) => this.darkTick(gd, A) },
    ];
  }
  /** the mark's own row (on every menu while somebody waits on it, on F): 'go' under the word's header */
  private goRow(): OrderDef {
    return { id: 'pairGo', head: WORD_HEAD, hotKey: 'KeyF', free: true, targets: ['floor', 'door', 'none', 'foe'],
      label: () => { const W = this.waiting(); return W.length ? `mark · ${W.map(([gd, J]) => `${gd.callsign} takes ${nameOf(J.foe)}${J.watcher ? ' anyway' : ''}`).join(' · ')}` : 'mark'; },
      only: () => this.waiting().map(([gd]) => gd), valid: () => this.waiting().length > 0 || 'nobody is waiting on your mark.',
      issue: () => { this.mark('row'); } };
  }
  /** a row here given while the squad is loud: silent first, with the squad's own line for it */
  private quietFirst() { const g = this.g; if (this.quiet || !PAIR.quietFirst) return; setSilent(g, true, 'order'); g.msg('squad: going silent on that order.'); }
  /** The rows kept on the menu while `up`, and off it otherwise; the two built-in rows a person's menu shares ('fall in', 'hold position') told they fit a
   *  person while it is, and told they do not again after; the mark's row while somebody waits on it. Asked every frame; work only when one of those changes. */
  private seat() {
    const S = this.g.orders, up = this.up;
    if (up !== this.seated) {
      this.seated = up;
      for (const id of ROWS) S.unregister(id);
      for (const id of ['fallIn', 'hold']) { const d = S.defs.find(x => x.id === id); if (!d) continue;
        const has = d.targets.includes('foe'); if (up && !has) d.targets = [...d.targets, 'foe']; else if (!up && has) d.targets = d.targets.filter(k => k !== 'foe'); }
      this.goSeated = false;
      if (up) { const [mark, watch, now, dark] = this.rows(); S.register(mark, 'cover'); S.register(watch, 'cover'); S.register(now); S.register(dark); }   // ('take him' ahead of every other row on a person: the quick key gives a target's first row)
      else this.reset();
    }
    const waits = up && this.waiting().length > 0;
    if (waits !== this.goSeated) { this.goSeated = waits; S.unregister('pairGo'); if (waits) S.register(this.goRow()); }
  }
  /** the rows are off the menu: nobody is left on one of them (he holds where he stands) */
  private reset() { const S = this.g.orders;
    for (const gd of S.squad()) { const A = S.of(gd); if (A && ROWS.includes(A.order)) this.stand(S, gd, 'holding', null); }
    this.jobs.clear(); this.darkMemo.clear(); this.handsWas = false; }

  // ------------------------------------------------------------ once a frame
  /** F (Game.update, ahead of the door tools' and the drills' reading of it): the mark, while somebody waits on it — the press is used here and a menu that is up goes away */
  input(input: Input) {
    if (!this.seated || !input.pressed.has('KeyF') || this.g.player.down || !this.waiting().length) return;   // (who waits is asked now: a job that ended since the last tick leaves F to whoever else reads it)
    input.pressed.delete('KeyF'); this.g.orders.close(); this.mark('F');
  }
  /** Once a frame before the orders pose the men (Game.update): the rows kept where they belong, where every defender mostly looks, Sam's hands as the mark,
   *  and a job whose man has been given something else forgotten. A find and a return with the switch off. */
  tick(dt: number) {
    this.seat();
    if (!this.seated) return;
    const g = this.g, S = g.orders;
    for (const h of g.guards) { if (h.state === 'dead' || h.team === 'operative' || !HOSTILE.player[h.team]) continue;
      const [fx, fz] = lookOf(h), H = this.habit.get(h);
      if (!H) { this.habit.set(h, [fx, fz]); this.glance.set(h, { on: false, endT: -1e9 }); continue; }
      const st = Math.hypot(h.char.vel[0], h.char.vel[2]) > 0.3 ? 0 : (this.stood.get(h) ?? 0) + dt; this.stood.set(h, st);
      // (a man who has just stopped mostly faces the way he faces NOW: the walk that brought him here is not where his back is)
      const k = Math.min(1, dt / (PAIR.habitStood && st > 0 ? Math.max(0.5, Math.min(6, st)) : 6)); H[0] += (fx - H[0]) * k; H[1] += (fz - H[1]) * k;
      const G = this.glance.get(h)!, L = Math.hypot(H[0], H[1]) || 1, c = (fx * H[0] + fz * H[1]) / L;
      // (the sweep: the widest his look has been off that way since he settled, forgotten slowly enough to outlast a turn of the head and back)
      this.swept.set(h, st > 2.5 ? Math.max(Math.acos(Math.max(-1, Math.min(1, c))), (this.swept.get(h) ?? 0) - dt * 0.025) : 0);
      if (!G.on && c < 0.77) { G.on = true; G.h0 = [H[0] / L, H[1] / L]; }
      else if (G.on && c > 0.94) { G.on = false; G.endT = g.time;
        // (his look and the way he mostly faces have met again — by THAT way coming round to his look, not his head coming back: he has turned for good, and what he swept from the old way is forgotten)
        if (G.h0 && (G.h0[0] * H[0] + G.h0[1] * H[1]) / L < 0.866) this.swept.set(h, 0); } }
    const pl = g.player, hands = !!pl.takedown || !!pl.holding;
    if (hands && !this.handsWas && PAIR.markOnHands) this.mark('hands');
    this.handsWas = hands;
    for (const [gd, J] of this.jobs) { const A = S.of(gd);
      if (gd.state === 'dead') { this.jobs.delete(gd); continue; }
      if (!A || !TAKES.includes(A.order) || A.foe !== J.foe) { this.jobs.delete(gd); PAIR_STATS.cancelled++; this.note(`cancel:${gd.callsign} off ${nameOf(J.foe)}`); } }
  }
  /** THE MARK: every man waiting on it goes for his man (false: nobody was waiting) */
  mark(by: 'F' | 'hands' | 'row' | 'api' = 'api'): boolean {
    const g = this.g, W = this.waiting(); if (!W.length) return false;
    const [gd0, J0] = W[0], again = !!J0.watcher, set = J0.set;
    for (const [gd, J] of W) {
      // (a second mark while he is held up: whoever is looking. Sam's own hands already on a man, with the partner on the last metres to his: the same —
      //  that beat is not to be missed. Hands while he is still far out do not send him across a watched floor; with PAIR.watched off nothing is forced)
      if (PAIR.watched && (J.watcher || (by === 'hands' && flat(gd.char.pos, J.foe.char.pos) < PAIR.heelRing))) { if (J.watcher) { PAIR_STATS.anyway++; this.note(`anyway:${gd.callsign} on ${nameOf(J.foe)}`); } J.force = true; }
      J.watcher = null;
      J.go = true; J.going = true; J.born = g.time; J.checkT = -1; const A = g.orders.of(gd); if (A) A.pace = PAIR.goPace; }
    PAIR_STATS.marks++; this.note(`go:${by}`);
    if (by === 'F' || by === 'api') g.msg('you: mark');   // (the menu's row prints its own line; hands need no word)
    // (a man the mark finds watched says THAT instead, from takeTick: 'moving.' is not said by a man who is not going)
    if (again) g.say(gd0, 'going anyway.'); else if (J0.force || !this.held(J0, gd0)) g.say(gd0, set ? 'moving.' : 'moving. not set yet.');
    return true;
  }
  /** WHO WOULD SEE IT (PAIR.watched): the first other defender who, by the defenders' own tests, has eyes on `gd` where he stands at the man's back with light
   *  enough on him to start that man inside `watchSecs`, or whose open view holds the floor the man will lie on with the bodies-by-light bar met by the light
   *  now on him (guards.ts canSeeChar · sightGainOn · pointInView · BODY_LIGHT — nothing of this module's own). A quiet pair of hands makes no sound: there is
   *  nothing to hear (PAIR.scuffle 0). */
  watcher(foe: Guard, gd: Guard): Guard | null {
    const g = this.g, hp = foe.char.bones.hips ?? foe.char.pos, at: Vec3 = [hp[0], 0.35, hp[2]];
    for (const o of g.guards) {
      if (o === foe || o.state === 'dead' || o.held || o.team === 'operative' || !HOSTILE.player[o.team]) continue;
      const s = canSeeChar(g, o, gd.char, false);
      if (s.visible && sightGainOn(g, o, gd, s.dist) * PAIR.watchSecs >= PAIR.watchAw) return o;
      if (o.team !== foe.team || !pointInView(g, o, at)) continue;   // (bodyInView: a man finds a body of his own side)
      if (this.bodyLit(o, foe, at)) return o;
    }
    return null;
  }
  /** the bodies-by-light bar from `o`'s eye, met by the light now on the man (his meter where he has one, the floor's own estimate where he does not: staff
   *  carry no meter. Smoke between them is not asked: he errs to holding) */
  private bodyLit(o: Guard, foe: Guard, at: Vec3): boolean { const B = BODY_LIGHT;
    const eye = o.char.bones.head ?? [o.char.pos[0], o.char.pos[1] + 1.65, o.char.pos[2]], d = Math.hypot(eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]);   // (eye to the body, as bodyLit measures it)
    const bar = !this.g.tune.bodyLight || d <= B.nearM ? -1 : B.litNear + (B.lit - B.litNear) * Math.min(1, (d - B.nearM) / Math.max(0.1, B.farM - B.nearM));
    return Math.max(foe.visibility, this.litAt(at)) >= bar; }
  /** HE'LL LOOK BACK (PAIR.lookBack): the man who was watching has only turned his head — he is up, calm, standing where he stood, and what he would see
   *  when it comes back is still there to see: inside what his eyes sweep (the way he mostly faces, widened by how far his look has lately swung, his own
   *  reach, a line to it) is the floor the body would lie on with the bodies-by-light bar met, or the partner with light enough on him — the watcher's own
   *  two tests, with the sweep where the open view was. A lamp put out, or the partner gone from his line, ends the hold */
  private looksBack(w: Guard, foe: Guard, gd: Guard): boolean {
    if (!PAIR.lookBack || w.state === 'dead' || w.held || (this.stood.get(w) ?? 0) < 0.5) return false;
    const H = this.habit.get(w), L = H ? Math.hypot(H[0], H[1]) : 0; if (!H || L < 0.3) return false;
    const eye = w.char.bones.head ?? [w.char.pos[0], w.char.pos[1] + 1.65, w.char.pos[2]], half = GUARD_EYE.halfDeg * Math.PI / 180 + (this.swept.get(w) ?? 0);
    const swept = (x: number, y: number, z: number): number => { const dx = x - eye[0], dz = z - eye[2], d = Math.hypot(dx, dz); if (d > GUARD_EYE.range || d < 0.05) return -1;
      return Math.acos(Math.max(-1, Math.min(1, (dx * H[0] + dz * H[1]) / (d * L)))) < half && !this.g.col.segmentBlocked([eye[0], eye[1], eye[2]], [x, y, z]) ? d : -1; };
    const hp = foe.char.bones.hips ?? foe.char.pos, at: Vec3 = [hp[0], 0.35, hp[2]];
    if (w.team === foe.team && swept(at[0], at[1], at[2]) >= 0 && this.bodyLit(w, foe, at)) return true;
    const c = gd.char.pos, d = swept(c[0], c[1] + 1.0, c[2]);
    return d >= 0 && sightGainOn(this.g, w, gd, d) * PAIR.watchSecs >= PAIR.watchAw;
  }
  /** would the mark, given now, find this man held up by a watcher (he is near enough for the question, and nothing has forced him) */
  private held(J: Job, gd: Guard): boolean { return PAIR.watched && !J.force && J.t0 < 0 && (!!J.watcher || flat(gd.char.pos, J.foe.char.pos) < PAIR.heelRing) && (!!this.watcher(J.foe, gd) || (!!J.watcher && this.looksBack(J.watcher, J.foe, gd))); }   // (once held he stays held while the watcher looks, wherever the man walks)
  /** off the job, onto a plain hold where he stands — with his gun on `aim` when the job ended in the man being roused */
  private stand(S: SquadOrders, gd: Guard, words: string, aim: Guard | null) {
    const p = gd.char.pos, here: Vec3 = [p[0], 0, p[2]]; this.jobs.delete(gd);
    S.assign(gd, aim ? { order: 'hold', post: here, face: yawTo(p, aim.char.pos), watch: [aim.char.pos[0], 1.1, aim.char.pos[2]], stance: 'none', upper: 'aim', going: words, there: words }
      : { order: 'hold', post: here, face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: words, there: words });
  }

  // ------------------------------------------------------------ taking a man
  private yawOf(foe: Guard): number { const H = this.habit.get(foe); return H && Math.hypot(H[0], H[1]) > 0.3 ? Math.atan2(H[0], H[1]) : foe.char.bodyYaw; }
  private back(foe: Guard, m: number): Vec3 { const c = foe.char.pos, y = this.yawOf(foe); return [c[0] - Math.sin(y) * m, 0, c[2] - Math.cos(y) * m]; }
  /** is `p` floor at `foe`'s back with nothing solid between it and him */
  private backOpen(foe: Guard, p: Vec3): boolean { const c = foe.char.pos; return !this.g.col.solidBlocked([p[0], 1.0, p[2]], [c[0], 1.0, c[2]]); }
  /** where the hands go on from: a short pace behind the way he MOSTLY faces (a glance over his shoulder does not send the partner round him) — as far behind
   *  him as there is floor */
  behind(foe: Guard): Vec3 { for (const m of [0.8, 0.6, 0.45]) { const p = this.back(foe, m); if (this.backOpen(foe, p)) return p; } return this.back(foe, 0.45); }
  /** where a man waits on the mark: `stageM` behind him, nearer where the floor is short — a spot he can stand on with nothing between it and the man's back */
  stage(foe: Guard): Vec3 { const nav = this.g.col.nav;
    for (const k of [1, 0.8, 0.6]) { const p = this.back(foe, PAIR.stageM * k); if (!nav.isBlocked(p[0], p[2]) && this.backOpen(foe, p)) return p; }
    return this.behind(foe); }
  /** One man's job, a frame at a time (orders.ts tick calls it before he is posed): round to the man's back unseen; on the mark (or at once: 'now'), in reach
   *  with that back still to him, the hands take `secs` and the man is out cold, quietly. The man roused first, or the squad gone loud under him: the job is
   *  off and he stands where he is with his gun on the man — the room fight shoots for him from there. */
  private takeTick(S: SquadOrders, gd: Guard, A: Assignment) {
    const g = this.g, J = this.jobs.get(gd); if (!J) { this.stand(S, gd, 'holding', null); return; }
    const foe = J.foe, p = gd.char.pos, here: Vec3 = [p[0], 0, p[2]], fc = foe.char, name = nameOf(foe);
    const off = (why: string, line: string | null, aim: boolean) => { if (line) g.say(gd, line); this.note(`off:${why}`); this.stand(S, gd, aim ? `covering ${name}` : 'holding', aim ? foe : null); };
    // (pairup.ts 'rejoin': sent from Sam's shoulder, he comes back to it — and sneaks again; else he holds where he is and where next is Sam's call)
    const rejoin = (): boolean => { if (!pairUp('rejoin') || !J.wasFollowing || g.player.down) return false;
      g.say(gd, "he's down. on you."); this.jobs.delete(gd); PAIRUP_STATS.rejoins++; this.note(`rejoin:${gd.callsign}`);
      S.assign(gd, { order: 'fallIn', post: null, follow: 0, face: null, stance: 'lowReady', upper: 'none', going: 'falling in', there: 'with you' }); return true; };
    if (foe.state === 'dead' || !g.guards.includes(foe)) { if (J.handed && foe.killerId === gd.char.id) { PAIRUP_STATS.finishes++; this.note(`finish:${gd.callsign} on ${name}`); }   // (pairup.ts 'hands': the job blown at his back, finished by spotted.ts's hands)
      if (rejoin()) this.note('off:down'); else off('down', "he's down.", false); return; }   // (somebody else dropped him: the job is done all the same)
    if (foe.held) { off('held', 'he is yours.', false); return; }   // (Sam has that man in his arm)
    const on = J.t0 >= 0;   // (his hands are on the man already: a struggle is not undone by the man starting at it)
    // BLOWN AT ARM'S LENGTH (pairup.ts 'hands'; spotted.ts on): the man has roused with this one a pace or two from his back. Stopping there with a gun on him is the
    // worst of both — spotted.ts's hands (the same takedown, the same reach, the same refusals: loud in his ears, a quiet gun, an alert man out of contact) finish it,
    // his feet theirs (orders.ts: spottedFeet first). The job stays his until the man is down (then 'rejoin' as after any take) or those hands give him up.
    if (!on && (J.handed || this.noticed(foe))) {
      if (pairUp('hands') && spottedTake(g, gd, foe)) { if (!J.handed) { J.handed = true; PAIR_STATS.blown++; PAIRUP_STATS.handoffs++; this.note(`blown:${gd.callsign} by ${name}`); this.note(`handed:${gd.callsign} on ${name}`); }
        A.crouch = false; A.going = A.there = `taking ${name} by hand`; return; }   // (upright, as the order's own hands are)
      if (!J.handed) { PAIR_STATS.blown++; this.note(`blown:${gd.callsign} by ${name}`); } off('blown', foe.foe === gd ? "he's seen me!" : "he's onto us.", true); return; }
    if (!on && !this.quiet) { off('loud', 'going loud.', true); return; }
    const d = flat(p, fc.pos), behindHim = this.rear(foe, p);
    // CAUGHT ENDS IT (pairup.ts; spotted.ts on): the pair has been made — an alert man has eyes on one of them — and his hands are not on yet. The job is off
    // like the man himself noticing, and his gun goes onto the one who HAS them; spotted.ts has already said so over the net. Not on the last paces once
    // sent: stopping an arm's length behind a man who is about to hear the shouting is the worst place to be — he finishes it.
    if (!on && SPOTTED.on && spottedMode(g, gd) === 'caught' && !this.lastPaces(J, gd)) {
      const by = spottedBy(g, gd); PAIR_STATS.blown++; PAIRUP_STATS.caughtOff++; this.note(`blown:${gd.callsign} caught${by ? ' by ' + nameOf(by) : ''}`); this.note('off:caught');
      this.stand(S, gd, by ? `covering ${nameOf(by)}` : 'holding', by); return; }
    // HE'S WATCHED: the mark is given (or the moment is his own) and he is at the man's back — but another defender would see it. He does not go: he says
    // who, stays where he is, and goes the moment that man looks away; a second mark sends him whoever is looking; with no mark to wait for, he calls it off
    if (J.go && !on && this.held(J, gd)) {
      const now = this.watcher(foe, gd), w = now ?? J.watcher!;
      if (!now) {   // (his head is turned, and it will come back: said once, and the row says so)
        if (g.time - J.seenT > 0.4 && J.cued && !J.backSaid) { g.say(gd, "he'll look back. your call."); J.backSaid = true; this.note(`lookback:${name} by ${nameOf(w)}`); }
        J.backT = g.time;   // (still held, and F still sends him: waiting() reads it)
        A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = yawTo(p, fc.pos); A.going = A.there = `on ${name} · ${nameOf(w)} will look back · F: go anyway`;
        if (J.mode === 'now' && g.time - J.watchT > PAIR.heelWait) { PAIR_STATS.called++; off('watched', "he's watched. no clean moment.", false); }
        return;
      }
      if (!J.watcher) { if (g.time - J.seenT > 2) J.watchT = g.time; PAIR_STATS.watched++; this.note(`watched:${name} by ${nameOf(w)}`);
        if (g.time - J.cueT > 8) { g.say(gd, `hold. ${nameOf(w)} has eyes on him.`); J.cueT = g.time; J.cueBy = w; J.cued = true; } }
      J.watcher = w; J.seenT = g.time;
      A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = yawTo(p, fc.pos); A.going = A.there = `on ${name} · WATCHED by ${nameOf(w)} · F: go anyway`;
      if (J.mode === 'now' && g.time - J.watchT > PAIR.heelWait) { PAIR_STATS.called++; off('watched', "he's watched. no clean moment.", false); }
      return;
    }
    if (J.watcher && !J.force && g.time - J.seenT < 0.4) return;   // (a head that turned away this frame may be on its way back: he gives it a moment)
    if (J.watcher) { J.watcher = null; if (J.cued) g.say(gd, 'clear. moving.'); J.cued = false; J.backSaid = false; J.born = g.time; J.waitT = J.heelT = -1; /* (the seconds he was held up are not the job's: its clocks start over) */ this.note(`clear:${gd.callsign} on ${name}`); if (flat(A.post ?? here, here) < 0.05) A.movedT = A.markT = g.time; }
    if (J.go && d < PAIR.reach + (on ? 0.4 : 0) && (on || behindHim) && !g.col.solidBlocked([p[0], 1.0, p[2]], [fc.pos[0], 1.0, fc.pos[2]])) {
      if (!on) { J.t0 = g.time; gd.char.anim.strike(); partnerBegin(g, gd, foe, false); this.note(`hands:${gd.callsign} on ${name}`); }
      if (PAIR.scuffle > 0 && !J.scuffled) { J.scuffled = true; g.events.push({ kind: 'prop', pos: v3.copy(fc.pos), time: g.time, loud: false, level: PAIR.scuffle, who: 0 }); }
      // (he stays ON the man while his hands work: one who is walking does not stroll out of them)
      const to: Vec3 = d > 0.7 ? this.behind(foe) : here; A.post = to; A.goal = [to[0], 0, to[2]]; A.via.length = 0; A.arrived = false; A.pace = PAIR.goPace; A.face = yawTo(p, fc.pos); A.crouch = false;
      if (g.time - J.t0 >= PAIR.secs) {
        partnerFall(g, foe, false, gd);
        killGuard(g, foe, v3.normalize([fc.pos[0] - p[0], 0, fc.pos[2] - p[2]]), true, 'struck', 'guard', `${gd.callsign} — ${name} is out cold`);
        PAIR_STATS.taken++; this.note(`down:${name} by ${gd.callsign}`);
        if (!rejoin()) { g.say(gd, "he's down."); this.stand(S, gd, 'holding', null); }
      }
      return;
    }
    if (J.t0 >= 0) partnerCancel(g, gd, foe);   // (takedown.ts: the move he had begun is let go of)
    J.t0 = -1;   // (he stepped off before the hands were on him: they start again)
    const staging = !J.go;
    // a job that is not getting done ends in words, not in a man 'moving up' for ever (a back in a corner; a spot the floor does not reach) — a man SET and waiting is waiting on Sam
    if (!(staging && J.set) && g.time - J.born > PAIR.takeSecs) { PAIR_STATS.called++; off('time', "can't get to his back.", false); return; }
    if (g.time - J.checkT < PAIR.stalkEvery && A.post) return;
    J.checkT = g.time;
    const want = staging ? this.stage(foe) : this.behind(foe), spot = S.freeSpot(want) ?? want;
    if (staging && J.set && behindHim && flat(p, spot) < 0.7 && this.clearOf(here, spot)) { A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = yawTo(p, fc.pos); return; }   // (set, and still set: he does not shuffle after every lean of the man's shoulders)
    // the way to his back, read afresh a few times a second (the man looks about him). The partner WAITS where he is while the only way lies across somebody's
    // eyes, goes when it is clear — and says so if it never is
    const way = this.stalk(gd, spot, J.going ? PAIR.goPace : PAIR.pace);
    if ((way.exposed && !J.force) || !this.backOpen(foe, spot)) {   // (told to go whoever is looking — a second mark, Sam's own hands: eyes on the way no longer stop him)
      if (J.waitT < 0) J.waitT = g.time;
      J.set = false; A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = PAIR.steady && !STEADY_BREAK && g.time - J.waitT < PAIR.steadyFaceSecs ? null : yawTo(p, fc.pos);   // (PAIR.steady: a short wait does not turn him)
      A.going = A.there = !way.exposed || J.force ? `waiting · no room at ${name}'s back` : !way.by ? `waiting · no way to ${name} unseen` : way.by === foe ? `waiting · ${name} is facing this way` : `waiting · ${nameOf(way.by)} is looking across the way to ${name}`;
      if (g.time - J.waitT > PAIR.stalkWait) { PAIR_STATS.called++; off('noway', !way.exposed || J.force ? 'no room at his back.' : 'no way to his back unseen.', false); }
      return;
    }
    J.waitT = -1;
    if (staging) {
      if (flat(p, spot) < 0.45) { J.set = true; A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = yawTo(p, fc.pos); A.going = A.there = `set on ${name} · F is the mark`;
        if (!J.setSaid) { J.setSaid = true; g.say(gd, 'set.'); this.note(`set:${gd.callsign} on ${name}`); }
        return; }
      J.set = false; A.going = A.there = `moving up on ${name}`;
    } else {
      A.going = A.there = `on ${name}`;
      // the last yards, inside his near field, when nobody gave the moment: on the heels of a glance (he has just looked and found nothing) — or, after `heelWait` of none, anyway
      const G = this.glance.get(foe);
      if (J.mode === 'now' && !J.going && G && d > PAIR.reach && d < PAIR.heelRing && (G.on || g.time - G.endT > PAIR.heelFresh)) {
        if (J.heelT < 0) J.heelT = g.time;
        if (g.time - J.heelT < PAIR.heelWait) { A.post = here; A.goal = [here[0], 0, here[2]]; A.via.length = 0; A.face = yawTo(p, fc.pos); return; }
      }
      if (d < PAIR.heelRing) J.going = true;   // (once in, in: stopping halfway is the worst place to be)
    }
    if (A.post && flat(A.post, here) < 0.05) A.movedT = A.markT = g.time;   // (he was parked here — set, or waiting on a way: a short step off it is a fresh walk, not a man stuck beside his mark; orders.ts would bring the mark to him)
    A.pace = J.going ? PAIR.goPace : PAIR.pace; A.crouch = PAIR.crouch; A.face = null;
    const path = way.path;
    A.post = spot; A.arrived = false; A.via.length = 0; for (const q of path.slice(0, -1)) A.via.push(q); A.goal = v3.copy(A.via[0] ?? spot);
  }
  /** nothing solid between two points a pace apart, at knee height */
  private clearOf(a: Vec3, b: Vec3): boolean { return !this.g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]); }
  /** THE WAY TO A MAN'S BACK: A* with the floor in front of every living defender — inside `frontM` of him, anywhere but the wedge 60° either side of dead
   *  astern, in his sight, and LIT floor inside `coneM` of him the way he looks — priced all but shut, so the route goes round behind him and behind his friends. `exposed`: it could not, and crosses floor inside
   *  the ±100° his eye really has. Each man counts twice: the way he faces this frame, and the way he mostly does. */
  stalk(gd: Guard, to: Vec3, pace = PAIR.pace): { path: Vec3[]; exposed: boolean; by?: Guard | null } {
    const g = this.g, nav = g.col.nav, c = nav.cell, R = PAIR.frontM;
    // ONE EYE (pairup.ts): the sneak's read instead of this module's own — guards.ts's eye test from every defender (as he looks, and as he mostly looks) to
    // a man low on the floor, lit by the sneak's bar or at his elbow, cones widened as the sneak widens them: watched floor is priced all but shut, and the
    // way found is `exposed` when walking it would add more to the most stirred watcher than the sneak's budget allows a crossing (sneak.ts sneakWalk)
    if (pairUp('oneEye')) {
      const W = sneakWalk(g, gd, PAIR.crouch, h => { const H = this.habit.get(h), L = H ? Math.hypot(H[0], H[1]) : 0; return H && L > 0.3 ? [H[0] / L, H[1] / L] : null; });
      const from: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]];
      // THE SWEEP'S RING (PAIR.sweep): standing men whose look swings, each with the half angle off the way he mostly faces that his near field reaches
      // at the sweep's end — never the last 25° astern. A PRICE on the search only: whether the way found is `exposed` is still the sneak's read of him as he
      // looks now and as he mostly looks (judged as exposed too, the partner waited from sixteen metres out and one start in twelve never set)
      const ring: { e: Guard; x: number; z: number; hx: number; hz: number; half: number }[] = [];
      if (PAIR.sweep) for (const e of g.guards) {
        if (e === gd || e.state === 'dead' || e.held || e.team === 'operative' || !HOSTILE.player[e.team]) continue;
        const sw = this.swept.get(e) ?? 0, H = this.habit.get(e), L = H ? Math.hypot(H[0], H[1]) : 0;
        if (sw < 0.1 || !H || L < 0.3) continue;
        ring.push({ e, x: e.char.pos[0], z: e.char.pos[2], hx: H[0] / L, hz: H[1] / L, half: Math.min(Math.PI * 155 / 180, Math.PI * 104 / 180 + sw) });
      }
      const ringAt = (x: number, z: number): boolean => {
        for (const r of ring) {
          const dx = x - r.x, dz = z - r.z, d = Math.hypot(dx, dz);
          if (d > PAIR.ringM || d < 0.05) continue;
          if (Math.acos(Math.max(-1, Math.min(1, (dx * r.hx + dz * r.hz) / d))) > r.half) continue;
          if (!g.col.segmentBlocked([r.x, 1.6, r.z], [x, 1.0, z])) return true;
        }
        return false;
      };
      const lenOf = (pts: Vec3[]) => { let d = 0; for (let i = 1; i < pts.length; i++) d += flat(pts[i - 1], pts[i]); return d; };
      // (the way he is already on stands while it is still unseen — read afresh every time. PAIR.keepWay: for six seconds, its end following the mark, and
      //  after that a fresh search takes over only where it is clearly the shorter, so two near-equal ways round a man are not traded every second and a
      //  half; off: searched afresh when the mark has moved or after a second and a half, and the fresh way taken whatever it is)
      const was = this.ways.get(gd), keep = PAIR.keepWay;
      let rest: Vec3[] | null = null;
      if (was && g.time >= was.t && (keep || g.time - was.t < 1.5) && flat(was.to, to) < (keep ? 0.6 : 0.3)) {
        let i = 0, bd = Infinity; for (let k = 0; k < was.path.length; k++) { const d = flat(from, was.path[k]); if (d < bd) { bd = d; i = k; } }
        if (bd < 0.9 && i < was.path.length - 1) i++;
        // (PAIR.steady: … and a corner he is already past — he stands along its leg to the next — is not his to walk back to: the kept way picked its
        //  NEAREST corner, and for the first metres of a long leg that is the one behind him)
        //  — tried first, and the nearest corner itself where that way on is no plain, cheap walk from here: at a turn back round a wall's end he stands
        //  "along" the next leg before he has reached the corner)
        let past = false;
        if (!(bd < 0.9) && PAIR.steady && !STEADY_BREAK && i < was.path.length - 1) { const a = was.path[i], b = was.path[i + 1]; past = (from[0] - a[0]) * (b[0] - a[0]) + (from[2] - a[2]) * (b[2] - a[2]) > 0; }
        for (const k of past ? [i + 1, i] : [i]) {
          const r = was.path.slice(k);
          if (keep && r.length) r[r.length - 1] = [to[0], 0, to[2]];
          if (r.length && nav.walkable(from, r[0]) && (!keep || r.length < 2 || nav.walkable(r[r.length - 2], r[r.length - 1])) && W.cost([from, ...r], pace, to) <= SNEAK.budget) {
            if (g.time - was.t < (keep ? 6 : 1.5)) { PAIRUP_STATS.waysKept++; return { path: r, exposed: false, by: null }; }
            rest = r; break;
          }
        }
      }
      const path = nav.findPath(from, to, 6000, (ix, iz) => { const x = (ix + 0.5) * c, z = (iz + 0.5) * c; return W.watched(x, z, true) || ringAt(x, z) ? 14 : 1; }) ?? nav.findPath(from, to);
      if (rest) {
        const ok = !!path && W.cost([from, ...path], pace, to) <= SNEAK.budget;
        if (!ok || lenOf([from, ...path!]) > 0.8 * lenOf([from, ...rest])) { PAIRUP_STATS.waysKept++; this.ways.set(gd, { to: [to[0], 0, to[2]], path: rest, t: g.time }); return { path: rest, exposed: false, by: null }; }
      }
      if (!path) { this.ways.delete(gd); return { path: [], exposed: true, by: null }; }
      const exposed = W.cost([from, ...path], pace, to) > SNEAK.budget;
      if (exposed) this.ways.delete(gd); else this.ways.set(gd, { to: [to[0], 0, to[2]], path, t: g.time });
      return { path, exposed, by: W.by };
    }
    const eyes: { x: number; z: number; fx: number; fz: number }[] = [];
    for (const h of g.guards) { if (h.state === 'dead' || h.team === 'operative' || !HOSTILE.player[h.team]) continue; const x = h.char.pos[0], z = h.char.pos[2], H = this.habit.get(h);
      const [lx, lz] = lookOf(h); eyes.push({ x, z, fx: lx, fz: lz }); if (H) { const L = Math.hypot(H[0], H[1]); if (L > 0.3) eyes.push({ x, z, fx: H[0] / L, fz: H[1] / L }); } }
    const C = PAIR.coneM, seen = new Map<number, boolean>();
    const front = (x: number, z: number, k: number) => { const key = (Math.floor(x / 0.25) + 4096 * Math.floor(z / 0.25)) * 2 + (k > 0.3 ? 1 : 0), was = seen.get(key); if (was !== undefined) return was;
      let lit = -1; const r = eyes.some(e => { const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz), f = dx * e.fx + dz * e.fz;
        if (d < R ? f <= -k * d : !(d < C && f > 0.42 * d && (lit < 0 ? lit = this.litCell(x, z) : lit) > PAIR.coneLit)) return false;
        return !g.col.segmentBlocked([e.x, 1.6, e.z], [x, 1.0, z]); });
      seen.set(key, r); return r; };
    // (the priced search can run out of its budget on a long way: the plain way is then read for eyes like any other — and only no way at all is 'no way')
    const path = nav.findPath(gd.char.pos, to, 6000, (ix, iz) => front((ix + 0.5) * c, (iz + 0.5) * c, 0.5) ? 14 : 1) ?? nav.findPath(gd.char.pos, to);
    if (!path) return { path: [], exposed: true };   // (no way found is not a safe way found)
    let exposed = false, a: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]];
    for (const b of path) { const n = Math.max(1, Math.ceil(flat(a, b) / 0.25)); for (let i = 1; i <= n && !exposed; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[2] + (b[2] - a[2]) * i / n; if (flat([x, 0, z], to) > 0.3 && front(x, z, 0.2)) exposed = true; } a = b; }
    return { path, exposed };
  }

  // ------------------------------------------------------------ holding in the dark
  /** how lit a spot of floor is, 0‥1 on the light meter's own scale: the place's steady lamps only (nobody's torch, no flash), direct light only — the CPU's
   *  estimate (guards.ts lightEstimateAt: no bounce) */
  /** litAt per nav cell, kept a few seconds (the stalk asks it of every cell it prices; the steady lamps change only when one is shot or switched) */
  private litCells = new Map<number, [number, number]>();
  private litCell(x: number, z: number): number { const c = this.g.col.nav.cell, ix = Math.floor(x / c), iz = Math.floor(z / c), key = ix + 4096 * iz, was = this.litCells.get(key), t = this.g.time;
    if (was && t >= was[1] && t - was[1] < 5) return was[0];
    const v = this.litAt([(ix + 0.5) * c, 0, (iz + 0.5) * c]); this.litCells.set(key, [v, t]); return v; }
  litAt(p: Vec3): number { const g = this.g; return g.visibilityOf(lightEstimateAt(g, [p[0], PAIR.darkH, p[2]], () => true, true)); }
  /** the dark floor an order for `at` means: the point itself when it is dark; else the darkest free floor on the nearest ring round it (½ m steps out to
   *  `darkM`) that a man could step to from it — null: none is dark */
  darkSpot(at: Vec3): Vec3 | null {
    const g = this.g, key = `${Math.round(at[0] * 4)},${Math.round(at[2] * 4)}`, was = this.darkMemo.get(key);
    if (was && Math.abs(g.time - was.t) < 1) return was.spot;
    if (this.darkMemo.size > 64) this.darkMemo.clear();
    const find = (): Vec3 | null => {
      if (this.litAt(at) <= PAIR.darkVis) return [at[0], 0, at[2]];
      const nav = g.col.nav;
      for (let r = 0.5; r <= PAIR.darkM + 1e-6; r += 0.5) { let best: Vec3 | null = null, bv = PAIR.darkVis;
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, q: Vec3 = [at[0] + Math.sin(a) * r, 0, at[2] + Math.cos(a) * r];
          if (nav.isBlocked(q[0], q[2]) || !this.clearOf(at, q)) continue; const v = this.litAt(q); if (v < bv || (v <= bv && !best)) { bv = v; best = q; } }
        if (best) return best; }
      return null; };
    const spot = find(); this.darkMemo.set(key, { t: g.time, spot }); return spot;
  }
  /** on his dark spot: the place read once a second, and said when it is no longer dark (a lamp switched on over him) — he stays: where next is Sam's call */
  private darkTick(gd: Guard, A: Assignment) {
    const g = this.g; let D = this.dark.get(gd); if (!D) this.dark.set(gd, D = { checkT: -1, litT: -1, saidT: -1e9 });
    if (!A.arrived || g.time - D.checkT < 1) return;
    D.checkT = g.time;
    if (this.litAt(gd.char.pos) <= PAIR.darkVis + 0.1) { D.litT = -1; A.there = 'holding in the dark'; return; }
    if (D.litT < 0) D.litT = g.time;
    A.there = 'holding · LIT';
    if (g.time - D.litT >= PAIR.litSecs && g.time - D.saidT >= PAIR.litEvery) { D.saidT = g.time; PAIR_STATS.lit++; this.note(`lit:${gd.callsign}`); g.say(gd, 'lit up here.'); }
  }

  summary(): string {
    if (!PAIR.on) return 'off';
    if (!this.up) return `on · not offered (a squad of 1 to ${PAIR.maxSquad} on the floor has them)`;
    const J = [...this.jobs].map(([gd, j]) => `${gd.callsign} ${j.mode === 'mark' ? (j.go ? 'going for' : j.set ? 'SET on' : 'moving up on') : 'taking'} ${nameOf(j.foe)}`);
    return `on · ${this.quiet ? 'quiet' : 'loud'} · ${J.join(' · ') || 'no job'} · given ${PAIR_STATS.given} · marks ${PAIR_STATS.marks} · taken ${PAIR_STATS.taken} · blown ${PAIR_STATS.blown}`;
  }
}

// ------------------------------------------------------------ the room fight's two seams (roomfight.ts)
/** a teammate on a take job does not take a man who has not noticed anybody as a TARGET (no muzzle on him, no call): he is going for that back with his hands —
 *  nor the man his hands are already on, whatever that man has noticed by then */
export function pairPasses(g: Game, gd: Guard, h: Guard): boolean {
  if (!PAIR.on) return false;
  const P = g.pair, J = P.jobOf(gd); if (!J || urgent(g)) return false;   // (a captor's last warning: he is shot, as under the silent order)
  if (J.foe === h && J.t0 >= 0) return true;   // (his hands are on that man: he finishes it — he does not let go to shoot him)
  if (P.finishing(gd)) return true;   // (pairup.ts, spotted.ts on: caught on the last paces he finishes it — his gun is nobody's until the man is down)
  return !P.noticed(h);
}
/** guards.ts bodySeen: a man in the partner's hands finds no body (PAIR.gripBody; off = he does, as before). It is the grip's other half: with PAIR.grip off
 *  nobody counts as gripped and this is off with it */
export function pairGripBody(g: Game, h: Guard): boolean { return PAIR.gripBody && pairGripped(g, h); }
/** guards.ts's eyes: the partner's hands are on this man — he sees nobody until they are off (PAIR.grip) */
export function pairGripped(g: Game, h: Guard): boolean { return PAIR.grip && ((PAIR.on && g.pair.gripped(h)) || (pairUp('hands') && spottedGripped(g, h))); }   // (… or spotted.ts's hands, under pairup.ts's 'hands': one takedown, one rule for what the man in it sees)
/** … and one told to WATCH a man keeps his gun on him and fires no round while that man has not noticed (the quiet gun included: 'watch him' is not 'shoot him') */
export function pairHolds(g: Game, gd: Guard, h: Guard): boolean {
  if (!PAIR.on) return false;
  const A = g.orders.of(gd); if (!A || A.order !== 'pairWatch' || A.foe !== h || g.pair.noticed(h) || urgent(g)) return false;
  PAIR_STATS.held++; return true;
}
