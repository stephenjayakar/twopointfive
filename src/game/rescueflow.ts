// The hostage rescue's DYNAMIC TEMPO (rescue.ts owns one of these; ?rescue): what the pair do about the openings Sam runs past, without being told, and what the
// player is shown of each. The 'fast rescue' answer page's 3.6–3.8 and 3.11: you pass, they pass, and the last man picks up the opening.
//
//   THE ROUTE      the corridor to the hostage room and the openings onto it, west to east — LEVEL DATA (scene/scenarios.ts RescueFlowData: Level.scenarios.rescue.flow;
//                  the office's, levels/office.scenarios.ts: the conference room's glass and door, the cubicles' west doorway, the server room's door, the cubicles'
//                  east doorway), checked headless by check(): where a man stands to cover each, and the point his gun is on. A level with no `flow` = none of this runs.
//   WHAT IS KNOWN  per opening, sensed a few times a second from the TEAM's own eyes (Sam's and every living, undazzled operative's — sight lines through the
//                  collision's own test: glass passes, a shut leaf does not): `looked` = most of what can be seen of the room from the corridor at that opening
//                  has been seen inside the last lookSecs; `hot` = one of theirs has been seen in there (or has fired from in there) and not since seen
//                  elsewhere or dead — let go when the room has since been looked through without him, or after hotSecs of nothing; `cleared` = one of the
//                  team has been in it, most of its floor has been seen, nobody of theirs known in it; `held` = a man is posted on it (the flow's man on HIS
//                  opening, or one of Sam's menu orders); else `unknown` (a shut door reads 'shut'). The floor is sampled at a crouched man's chest (0.9 m: a
//                  cubicle partition hides it), and who of theirs is SEEN is the fog of war's answer while the fog is up — what the player is shown is what is known.
//   THE FLOW       only once the captor's clock runs, only men who are FALLING IN (a man on any other menu order is Sam's: the menu overrides, and 'fall in'
//                  hands him back). Sam WALKS the corridor past an opening, west to east → the LAST man in the file takes it: runs to its mark, gun on it, says so ('glass left.',
//                  'opening right.', 'door left.'), gives it its look (longer while one of theirs is known in it: 'contact left — holding.'), and catches up — the
//                  other man stays on Sam. Openings Sam passes while that man is busy queue behind him: he leapfrogs them in order ('wait one.' when Sam has
//                  got far ahead), so a sprint arrives a man short. Sam turns off the corridor INTO a side room with both men free → the last man holds the
//                  corridor at that opening ('corridor.') until Sam is back out. Coming onto the corridor from a side room, or into the hostage room by its
//                  side door, passes nothing: only what he has walked past is behind him.
//   THE PICTURE    a strip on the floor across each opening, in the corridor, coloured by what is known (amber unknown · pale looked · red hot · blue held ·
//                  green cleared: one-frame NoShadow boxes — no ray, no light meter, no guard ever sees them), the same words on the objective line for the
//                  openings behind Sam, and each man's job in the squad block ('covering cubicles west').
//
// Not built (the answer page has them): the wedge, a 'looked' that decays into a timer on the strip, the guns of the men WITH Sam turning to the nearest unknown.
// Nothing here runs unless the rescue is up; with RESCUE.flow and RESCUE.marks off it does nothing at all.
import { SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Rescue } from './rescue';
import type { Assignment } from './orders';
import { inBounds } from './squad';
import { pairUp, PAIRUP_STATS } from './pairup';
import { squadSilent, silentCompromised } from './silent';
import { makeBox, BoxFlag } from '../scene/boxes';
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { isOffice, placeIn } from './dialogue';   // (called inside the hold's line only: nothing of dialogue.ts is touched at load)
import type { RouteOpening, RescueFlowData, Rect } from '../scene/scenarios';

export type OpenState = 'unknown' | 'looked' | 'hot' | 'held' | 'cleared';
/** THE ROUTE is level data (scene/scenarios.ts RescueFlowData — Level.scenarios.rescue.flow; the office's: levels/office.scenarios.ts): the corridor, the rooms
 *  off it and the openings onto it with their cover marks. A level whose rescue data has no `flow` runs without any of this (tick() returns on its first line). */
export type { RouteOpening } from '../scene/scenarios';
type RegionId = string;

/** the flow's numbers (plain literals: Tab ▸ Sandbox ▸ Hostage rescue carries the two switches, RESCUE.flow / RESCUE.marks; these are __rescue.flow.knobs) */
export const FLOW = {
  /** Sam this far short of an opening's middle = he is passing it; back this far west of it = it is ahead of him again */
  abreast: 0.6, unpass: 2.0,
  /** the cover is let go once Sam is this far past it (and the look is done), or after maxCover on the mark whatever Sam does; a man who cannot get onto his
   *  mark gives it up after giveUp; an opening nobody was free to take is forgotten after wantSecs */
  past: 1.5, maxCover: 2.5, giveUp: 7, wantSecs: 6,
  /** a hot opening is held this long after the last sight or sound of the man in it; the room stops being hot hotSecs after it (nobody has seen or heard
   *  him: it is unknown again), or as soon as hotEmpty of its floor has been seen since without him */
  hotHold: 6, hotSecs: 20, hotEmpty: 0.6,
  /** 'looked' = this share of what can be seen through the opening, seen inside lookSecs; 'cleared' = this share of the room's whole floor, with a man in it */
  lookShare: 0.6, lookSecs: 10, clearShare: 0.7, clearSecs: 25,
  /** the team's eyes: reach, how often each room is looked over (one room a call, in turn), and the height of the floor samples (a crouched man's chest) */
  eyeM: 16, senseHz: 6, sampleY: 0.9,
  /** Sam turning into a side room: the corridor is taken by a man who comes free within this long of it */
  holdSecs: 3,
  /** 'wait one.' when the man working the openings is this far behind Sam with more to do */
  waitM: 9,
  /** the strips' glow (× the state's colour) */
  glow: 1,
};

const COLOUR: Record<OpenState, Vec3> = { unknown: [1.0, 0.55, 0.08], looked: [0.6, 0.62, 0.5], hot: [2.6, 0.12, 0.05], held: [0.12, 0.5, 1.6], cleared: [0.1, 1.0, 0.3] };
const EYE = 1.55;
const NO_ROUTE: RouteOpening[] = [];
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

interface Region { id: RegionId; rect: Rect; pts: Vec3[]; seenT: Float64Array; cleared: boolean; hot: Map<Guard, { t: number; at: Vec3 }>; wasIn: number }
interface Known { o: RouteOpening; region: Region; lookable: number[]; builtOpen: boolean; share: number; state: OpenState; held: Guard | null; hot: boolean }
interface Job { kind: 'cover' | 'corridor'; o: RouteOpening; A: Assignment; t0: number; onT: number; chain: RouteOpening[]; saidHot: boolean; saidWait: boolean; leap: boolean }

export class RescueFlow {
  readonly knobs = FLOW;
  /** the level's route data (null = this level's rescue has no flow) and its openings */
  private get F(): RescueFlowData | null { return this.R.data?.flow ?? null; }
  get route(): RouteOpening[] { return this.F?.route ?? NO_ROUTE; }
  known: Known[] = [];
  /** who the flow has on a job right now */
  jobs = new Map<Guard, Job>();
  /** openings Sam has come past (ids), and the ones still waiting for a man (id → when) */
  passed = new Set<string>(); private want = new Map<string, number>();
  stats = { takes: 0, chained: 0, corridor: 0, overridden: 0, hotHolds: 0, unmanned: 0 };
  private regions = new Map<RegionId, Region>();
  /** the assignments the flow itself handed out (its covers, and the fall-in it sends a man back with): what tells the flow's man from one Sam posted */
  private mine = new SideSet<Assignment>();
  private senseAt = 0; private turn = 0; private heard = new SideSet<object>(); private built = false;
  private room: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  /** where Sam last stood ON the corridor (a pass is a walk along it, not a place), and the side room he has just turned into off it */
  private corr: { x: number; t: number } | null = null;
  private cameIn: { region: RegionId; o: RouteOpening; t: number } | null = null;
  constructor(private g: Game, private R: Rescue) { }

  /** a fresh staging: nothing known, nobody on a job */
  reset() {
    this.jobs.clear(); this.passed.clear(); this.want.clear(); this.senseAt = 0; this.turn = 0; this.built = false; this.known = []; this.regions.clear(); this.corr = null; this.cameIn = null;
    for (const k of Object.keys(this.stats) as (keyof RescueFlow['stats'])[]) this.stats[k] = 0;
  }
  /** is this assignment one the flow gave (rescue.ts: such a man is free for F; a cover Sam gave himself is not) */
  gave(A: Assignment | null): boolean { return !!A && this.mine.has(A); }
  /** F has taken these men: their jobs end where they stand */
  release(men: Guard[]) { for (const gd of men) this.jobs.delete(gd); }
  stateOf(id: string): OpenState | null { return this.known.find(k => k.o.id === id)?.state ?? null; }
  jobOf(gd: Guard): { kind: 'cover' | 'corridor'; opening: string; queued: string[] } | null { const J = this.jobs.get(gd); return J ? { kind: J.kind, opening: J.o.id, queued: J.chain.map(o => o.id) } : null; }

  private build() {
    const g = this.g, nav = g.col.nav, F = this.F; this.built = true; this.known = []; this.regions.clear();
    if (!F) return;
    const planned = (door: string | null, or: Rect): Rect => (door ? g.level.clearPlans?.find(p => p.door === door)?.bounds : null) ?? or;
    this.room = this.R.bounds ?? this.room;
    for (const reg of F.regions) {
      const id = reg.id, rect = planned(reg.door, reg.rect), pts: Vec3[] = [];
      for (let x = rect.x0 + 0.4; x < rect.x1; x += 1) for (let z = rect.z0 + 0.4; z < rect.z1; z += 1) if (!nav.isBlocked(x, z)) pts.push([x, FLOW.sampleY, z]);
      this.regions.set(id, { id, rect, pts, seenT: new Float64Array(pts.length).fill(-1e9), cleared: false, hot: new Map(), wasIn: -1e9 });
    }
    for (const o of F.route) { const K: Known = { o, region: this.regions.get(o.region)!, lookable: [], builtOpen: false, share: 0, state: 'unknown', held: null, hot: false }; this.lookable(K); this.known.push(K); }
  }
  /** what of the room can be seen through this opening at all: from the cover mark and from three places across its threshold on the corridor side (a door's,
   *  as its leaf stands — rebuilt when it opens or shuts) */
  private lookable(K: Known) {
    const g = this.g, o = K.o, dz = o.north ? 0.7 : -0.7;
    const eyes: Vec3[] = [[o.mark[0], EYE, o.mark[2]], [o.at[0], EYE, o.at[2] + dz], [o.at[0] - 0.9, EYE, o.at[2] + dz], [o.at[0] + 0.9, EYE, o.at[2] + dz]];
    K.lookable = []; K.builtOpen = this.open(o);
    K.region.pts.forEach((p, i) => { if (eyes.some(e => flat(e, p) < FLOW.eyeM && !g.col.segmentBlocked(e, p))) K.lookable.push(i); });
  }
  private open(o: RouteOpening): boolean { const d = o.door ? this.g.doors.byName(o.door) : null; return !d || Math.abs(d.angle) > 0.5; }

  /** the team's eyes this moment: Sam's, and every living operative's who is not blind */
  private eyes(): Vec3[] {
    const g = this.g, out: Vec3[] = [];
    if (!g.player.down) { const p = g.player.char.pos; out.push([p[0], EYE, p[2]]); }
    for (const op of this.R.ops) if (op.state !== 'dead' && g.time >= op.dazzledUntil) { const p = op.char.pos; out.push([p[0], EYE, p[2]]); }
    return out;
  }
  /** is this man of theirs seen by the team: the room fight's answer, else the fog of war's while it is up (a man the picture hides is not a man the strips know
   *  of), else a plain line from any of the team's eyes to his chest — the same lines the floor is looked over with */
  private sees(eyes: Vec3[], h: Guard): boolean {
    const g = this.g; if (g.fight.teamSees(h)) return true;
    if (g.fogOfWar.active) return g.fogOfWar.seen(h);
    const c = h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    return eyes.some(e => flat(e, c) < 30 && !g.col.segmentBlocked(e, c));
  }
  private regionAt(p: Vec3): Region | null { for (const r of this.regions.values()) if (inBounds(p, r.rect)) return r; return null; }

  private sense() {
    const g = this.g, t = g.time, K = FLOW, eyes = this.eyes(), all = [...this.regions.values()];
    {   // the floor the eyes are on: ONE room a call, in turn (the sight lines are the cost)
      const r = all[this.turn++ % all.length];
      for (const e of eyes) {
        if (e[0] < r.rect.x0 - K.eyeM || e[0] > r.rect.x1 + K.eyeM || e[2] < r.rect.z0 - K.eyeM || e[2] > r.rect.z1 + K.eyeM) continue;
        for (let i = 0; i < r.pts.length; i++) { if (t - r.seenT[i] < 0.5) continue; const p = r.pts[i]; if (flat(e, p) < K.eyeM && !g.col.segmentBlocked(e, p)) r.seenT[i] = t; }
      }
    }
    for (const r of all) for (const e of eyes) if (inBounds(e, r.rect)) r.wasIn = t;
    // who of theirs is known to be where: seen in a room marks it hot; seen anywhere else, or dead, lets it go
    for (const h of this.R.hostiles) {
      if (h.state === 'dead') { for (const r of this.regions.values()) r.hot.delete(h); continue; }
      if (!this.sees(eyes, h)) continue;
      const at = this.regionAt(h.char.pos);
      for (const r of this.regions.values()) if (r === at) { if (!r.hot.has(h)) this.R.note(`flow:hot:${r.id}`); r.hot.set(h, { t, at: v3.copy(h.char.pos) }); } else r.hot.delete(h);
    }
    for (const e of g.events) {   // a shot of theirs from inside a room says as much as a sight of him
      if (this.heard.has(e)) continue; this.heard.add(e);
      if (e.kind !== 'guardShot') continue;
      const h = this.R.hostiles.find(x => x.char.id === e.who); if (!h || h.state === 'dead') continue;
      const r = this.regionAt(e.pos); if (r) { if (!r.hot.has(h)) this.R.note(`flow:hot:${r.id}`); r.hot.set(h, { t, at: v3.copy(e.pos) }); }
    }
    for (const r of all) for (const [h, e] of [...r.hot]) {   // a hot room goes cold: nothing of him for a long while — or eyes on the very spot he was last at, the room looked through since, and no sign of him
      if (t - e.t < 1) continue;
      let cold = t - e.t > K.hotSecs;
      if (!cold && r.pts.length) {
        let n = 0; for (let i = 0; i < r.pts.length; i++) if (r.seenT[i] > e.t + 0.5) n++;
        const spot: Vec3 = [e.at[0], 1.1, e.at[2]];
        cold = n / r.pts.length >= K.hotEmpty && eyes.some(eye => flat(eye, spot) < K.eyeM && !g.col.segmentBlocked(eye, spot));
      }
      if (cold) { r.hot.delete(h); this.R.note(`flow:cold:${r.id}`); }
    }
    for (const r of all) {
      let n = 0; for (let i = 0; i < r.pts.length; i++) if (t - r.seenT[i] < K.clearSecs) n++;
      const was = r.cleared;
      r.cleared = r.hot.size === 0 && (r.cleared || (t - r.wasIn < 1 && r.pts.length > 0 && n / r.pts.length >= K.clearShare));
      if (r.cleared && !was) this.R.note(`flow:cleared:${r.id}`);
    }
    for (const k of this.known) {
      if (k.builtOpen !== this.open(k.o)) this.lookable(k);
      let n = 0; for (const i of k.lookable) if (t - k.region.seenT[i] < K.lookSecs) n++;
      k.share = k.lookable.length ? n / k.lookable.length : 0;
      k.hot = k.region.hot.size > 0; k.held = this.holder(k.o);
      const was = k.state;
      k.state = k.hot ? 'hot' : k.held ? 'held' : k.region.cleared ? 'cleared' : k.share >= K.lookShare ? 'looked' : 'unknown';
      if (k.state !== was) { this.R.note(`flow:state:${k.o.id}:${k.state}`); if (k.state === 'hot') g.msg(`contact — ${k.o.name}`); }
    }
  }
  /** the man posted on this opening: on (or nearly on) a mark of his own with his gun on it — the flow's cover, or a menu order of Sam's (cover / stack on its
   *  door, or anything with its watch on the opening itself) */
  private holder(o: RouteOpening): Guard | null {
    const g = this.g;
    for (const op of this.R.ops) {
      if (op.state === 'dead') continue; const A = g.orders.of(op); if (!A || !A.post || flat(op.char.pos, A.post) > 1.2) continue;
      const J = this.jobs.get(op);
      if (J && J.A === A) { if (J.kind === 'cover' && J.o === o) return op; continue; }   // the flow's own man holds HIS opening and no other (the corridor's man holds the corridor)
      if ((A.door && A.door.def.name === o.door) || (A.watch && flat(A.post, o.at) < 6 && (flat(A.watch, o.at) < 1.5 || flat(A.watch, o.watch) < 1.5))) return op;
    }
    return null;
  }

  /** Once a frame from Rescue.tick (before F's own walk to the stack, before the order menu moves anybody). */
  tick() {
    const g = this.g, R = this.R, K = FLOW, RK = R.knobs, F = this.F, ROUTE = this.route;
    if (!R.active || !F || (!RK.flow && !RK.marks)) { if (this.jobs.size) this.dropAll(true); return; }
    if (!this.built) this.build();
    if (g.time >= this.senseAt) { this.senseAt = g.time + 1 / (K.senseHz * Math.max(1, this.regions.size)); this.sense(); }
    if (RK.marks) this.boxes();
    const sam = g.player.char.pos, t = g.time, live = RK.flow && R.dynamic && !R.result && !g.player.down;
    const inCorr = inBounds(sam, F.corridor), onRoute = inCorr || inBounds(sam, this.room), samIn = onRoute ? null : this.regionAt(sam);
    // what Sam has come past: he was on the corridor short of it a moment ago and is on the corridor abreast of it now (stepping onto the corridor from a side
    // room, or being in the hostage room, passes nothing). Kept from the staging on, clock or no clock: the picture's 'behind you' is where he has walked.
    if (inCorr) {
      const from = this.corr && t - this.corr.t < 0.5 ? this.corr.x : null;
      for (const o of ROUTE) {
        const has = this.passed.has(o.id), line = o.at[0] - K.abreast;
        if (!has && from !== null && from <= line && sam[0] > line) { this.passed.add(o.id); R.note(`flow:pass:${o.id}`); if (live) this.want.set(o.id, t); }
        else if (has && sam[0] < o.at[0] - K.unpass) { this.passed.delete(o.id); this.want.delete(o.id); }
      }
      this.corr = { x: sam[0], t }; this.cameIn = null;
    } else if (samIn) {   // off the corridor into a side room: by the opening of that room nearest him as he went in
      if (this.cameIn?.region !== samIn.id) { const into = ROUTE.filter(x => x.region === samIn.id);   // (a room the route has no opening onto: nothing to hold the corridor at)
        this.cameIn = into.length && this.corr && t - this.corr.t < 0.5 ? { region: samIn.id, o: into.reduce((a, b) => flat(a.at, sam) <= flat(b.at, sam) ? a : b), t } : null; }
    } else if (onRoute) this.cameIn = null;
    if (!RK.flow || !R.dynamic) { if (this.jobs.size) this.dropAll(true); return; }
    if (R.result || g.player.down) { this.jobs.clear(); this.want.clear(); return; }   // (it is over: whoever was covering stays covering)
    // the men on a job
    for (const [gd, J] of [...this.jobs]) {
      const A = g.orders.of(gd);
      if (gd.state === 'dead' || R.owns(gd)) {   // (down on the job: what was queued behind him is wanted again — the other man's, by the rules below)
        this.jobs.delete(gd); if (gd.state === 'dead') for (const o of J.chain) this.want.set(o.id, t); continue;
      }
      if (A !== J.A) {   // Sam's own order has him (or a drill took him): the flow lets go, and does not send the next man to the same openings behind Sam's back
        this.jobs.delete(gd); this.stats.overridden++; R.note(`flow:override:${gd.callsign}`); continue;
      }
      if (!gd.script && gd.state === 'alert') continue;   // (the fight AI has him: his fight first)
      const o = J.o, k = this.known.find(x => x.o === o)!;
      if (J.kind === 'corridor') { if (onRoute || !samIn) { this.rejoin(gd, 'on you.'); R.note(`flow:done:corridor:${gd.callsign}`); } continue; }
      if (isNaN(J.onT) && (A.arrived || flat(gd.char.pos, o.mark) < 0.6)) J.onT = t;
      if (k.hot) {   // one of theirs is known in it: it is held for as long as he has lately been seen or heard there
        const last = Math.max(...[...k.region.hot.values()].map(e => e.t));
        if (t - last < K.hotHold || RK.holdHot) { if (!J.saidHot) { J.saidHot = true; this.stats.hotHolds++; g.say(gd, `contact ${o.side} — holding.`); R.note(`flow:hold:${o.id}:${gd.callsign}`); } continue; }
      }
      if (g.fight.engaged(gd) || (RK.holdHot && J.saidHot && g.fight.busy(gd, 2))) continue;   // (the man he was holding on has just gone from his sight, or he is turning to him: not released on that frame)
      const samPast = !onRoute || sam[0] > o.at[0] + K.past;
      const done = isNaN(J.onT) ? t - J.t0 > K.giveUp : t - J.onT >= o.look && (samPast || t - J.onT >= K.maxCover);
      if (!J.saidWait && J.chain.length && onRoute && sam[0] - gd.char.pos[0] > K.waitM) { J.saidWait = true; g.say(gd, 'wait one.'); R.note(`flow:wait:${gd.callsign}`); }
      if (!done) continue;
      R.note(`flow:done:${o.id}:${gd.callsign}`);
      let next = J.chain.shift(); while (next && this.settled(next)) next = J.chain.shift();
      if (next && this.stays()) { PAIRUP_STATS.stays++; R.note(`flow:stay:${next.id}`); next = undefined; }
      if (next) { this.take(gd, next, J.chain, J.saidWait, true); this.stats.chained++; }
      else this.rejoin(gd, J.saidHot ? 'lost him — moving.' : J.leap ? 'moving.' : null);   // (one opening covered and done: he just falls back in — the next one's call is a breath away)
    }
    if (R.mode === 'door') { this.want.clear(); return; }   // F has the floor: whoever it left out stays where Sam put him
    if (this.want.size && this.stays()) { for (const id of this.want.keys()) { PAIRUP_STATS.stays++; R.note(`flow:stay:${id}`); } this.want.clear(); }   // (pairup.ts 'stay': the one partner of a silent pair is Sam's shadow, not the flow's cover man)
    // an opening just passed: the man already working the openings takes it next; else the last free man in the file
    for (const o of ROUTE) {
      const at = this.want.get(o.id); if (at === undefined) continue;
      if (this.settled(o) || [...this.jobs.values()].some(J => J.o === o || J.chain.includes(o))) { this.want.delete(o.id); continue; }
      if (t - at > K.wantSecs) { this.want.delete(o.id); this.stats.unmanned++; R.note(`flow:unmanned:${o.id}`); continue; }
      const busy = [...this.jobs].find(([, J]) => J.kind === 'cover');
      if (busy) { busy[1].chain.push(o); this.want.delete(o.id); R.note(`flow:queue:${o.id}:${busy[0].callsign}`); continue; }
      const free = this.free(); if (!free.length) continue;
      if (free.length === 1) {
        // the only free man: with another in the file who is in a fight or blind this moment it waits for him (wantSecs) and the man on Sam stays on Sam; with
        // nobody else in the file (one man left, or the other on an order of Sam's) flowSolo decides
        const file = R.ops.filter(op => op.state !== 'dead' && !R.owns(op) && g.orders.of(op)?.order === 'fallIn').length;
        if (file >= 2) continue;
        if (!RK.flowSolo) { this.want.delete(o.id); this.stats.unmanned++; R.note(`flow:unmanned:${o.id}`); continue; }
      }
      this.take(free[0], o, [], false, false); this.want.delete(o.id);
    }
    // Sam has turned off the corridor into a side room with both men on him: the last man holds the corridor at the opening he used (once: a man Sam then
    // orders off it is not replaced, and walking into the cubicles from the lobby is not turning off the corridor)
    const C = this.cameIn;
    if (samIn && C && C.region === samIn.id && t - C.t < K.holdSecs && ![...this.jobs.values()].some(J => J.kind === 'corridor')) {
      const free = this.free();
      if (free.length >= 2) {
        const o = C.o; C.t = -1e9;
        const gd = free[0], watch: Vec3 = [Math.min(o.mark[0] + F.hold.ahead, F.hold.xMax), 1.1, F.hold.z];
        const hall = (WORDS.on && !isOffice(g.level) ? placeIn(g.level, o.mark)?.name : null) ?? 'the corridor';   // (the floor he holds by the level's own word for it: the registry's is a gallery)
        g.orders.newGroup();
        g.orders.assign(gd, { order: 'cover', post: v3.copy(o.mark), face: v3.yawTo(o.mark, watch), watch, stance: 'none', upper: 'aim', move: { stance: 'none', upper: 'aim' }, going: `holding ${hall}`, there: `holding ${hall}` });
        const A = g.orders.of(gd)!; this.mine.add(A);
        this.jobs.set(gd, { kind: 'corridor', o, A, t0: t, onT: NaN, chain: [], saidHot: false, saidWait: false, leap: false });
        this.stats.corridor++; g.say(gd, `${hall.replace(/^the /, '')}.`); R.note(`flow:corridor:${o.id}:${gd.callsign}`);
      }
    }
  }
  /** nothing for a man to do at it: the room behind it is cleared, or a man Sam posted has it already */
  private settled(o: RouteOpening): boolean {
    const k = this.known.find(x => x.o === o); if (!k) return false;
    return k.region.cleared || (!!k.held && !this.jobs.has(k.held));
  }
  /** pairup.ts 'stay': one partner, silent, not found out — the flow sends nobody */
  private stays(): boolean { const g = this.g; return pairUp('stay') && g.orders.squad().length === 1 && squadSilent(g) && !silentCompromised(g); }
  /** the men the flow may send: alive, falling in (unasked, or because Sam said so), not F's, not in a fight, not blind — the LAST in the file first */
  private free(): Guard[] {
    const g = this.g, out: [Guard, Assignment][] = [];
    for (const gd of this.R.ops) {
      if (gd.state === 'dead' || this.jobs.has(gd) || this.R.owns(gd) || g.time < gd.dazzledUntil) continue;
      const A = g.orders.of(gd); if (!A || A.order !== 'fallIn') continue;
      if ((!gd.script && gd.state === 'alert') || g.fight.engaged(gd)) continue;
      out.push([gd, A]);
    }
    return out.sort((a, b) => b[1].follow - a[1].follow).map(x => x[0]);
  }
  private take(gd: Guard, o: RouteOpening, chain: RouteOpening[], saidWait: boolean, leap: boolean) {
    const g = this.g, door = o.door ? g.doors.byName(o.door) ?? null : null;
    g.orders.newGroup();   // (his own: a 'set.' Sam's last order is waiting to call does not wait on this man's mark)
    g.orders.assign(gd, { order: 'cover', post: v3.copy(o.mark), face: v3.yawTo(o.mark, o.watch), watch: v3.copy(o.watch), door, stance: 'none', upper: 'aim', move: { stance: 'none', upper: 'aim' }, going: `moving · ${o.name}`, there: `covering ${o.name}` });
    const A = g.orders.of(gd)!; this.mine.add(A);
    this.jobs.set(gd, { kind: 'cover', o, A, t0: g.time, onT: NaN, chain, saidHot: false, saidWait, leap });
    this.stats.takes++; g.say(gd, o.call); this.R.note(`flow:take:${o.id}:${gd.callsign}`);
  }
  /** back into the file behind Sam (at its tail: orders.ts closes the file up) */
  private rejoin(gd: Guard, words: string | null) {
    const g = this.g; this.jobs.delete(gd);
    g.orders.newGroup();
    g.orders.assign(gd, { order: 'fallIn', post: null, follow: 9, face: null, stance: 'lowReady', upper: 'none', going: 'catching up', there: 'with you' });
    const A = g.orders.of(gd); if (A) this.mine.add(A);
    if (words) g.say(gd, words);
  }
  private dropAll(back: boolean) {
    for (const [gd, J] of [...this.jobs]) { this.jobs.delete(gd); if (back && gd.state !== 'dead' && !this.R.owns(gd) && this.g.orders.of(gd) === J.A) this.rejoin(gd, null); }
    this.want.clear();
  }

  /** the strips: one flat glowing bar on the corridor floor across each opening, in its state's colour (a hot one beats) */
  private boxes() {
    const g = this.g;
    for (const k of this.known) {
      const o = k.o, c = COLOUR[k.state], beat = k.state === 'hot' ? 0.65 + 0.35 * Math.sin(g.time * 9) : 1, e = FLOW.glow * beat;
      g.fx.push({ box: makeBox({ c: [o.at[0], 0.012, o.at[2] + (o.north ? 0.36 : -0.3)], h: [o.half, 0.008, 0.05], albedo: [0.03, 0.03, 0.03], emissive: [c[0] * e, c[1] * e, c[2] * e], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: 1e-3 });
    }
  }
  private word(k: Known): string {
    const shut = k.o.kind === 'door' && !this.open(k.o);
    switch (k.state) {
      case 'hot': return k.held ? 'HOT, held' : 'HOT';
      case 'held': return 'held';
      case 'cleared': return 'clear';
      case 'looked': return 'looked';
      default: return shut ? 'shut' : 'unknown';
    }
  }
  /** the objective line's tail: the openings behind Sam and what is known of each, and any hot one still ahead of him ('' with neither) */
  line(): string {
    const row = (k: Known) => `${k.o.short} ${this.word(k)}`;
    const behind = this.known.filter(k => this.passed.has(k.o.id)).map(row), ahead = this.known.filter(k => !this.passed.has(k.o.id) && k.state === 'hot').map(row);
    return [behind.length ? `behind you ▸ ${behind.join(' · ')}` : '', ahead.length ? `ahead ▸ ${ahead.join(' · ')}` : ''].filter(x => x).join(' · ');
  }
  summary(): string {
    if (!this.known.length) return 'flow: not staged';
    const jobs = [...this.jobs].map(([gd, J]) => `${gd.callsign} ${J.kind === 'corridor' ? 'corridor' : J.o.short}${J.chain.length ? ` +${J.chain.length}` : ''}`).join(', ');
    return `openings ${this.known.map(k => `${k.o.short} ${this.word(k)}${this.passed.has(k.o.id) ? '' : ' (ahead)'}`).join(' · ')}${jobs ? ` · on it: ${jobs}` : ''} · ${this.stats.takes} covers, ${this.stats.corridor} corridor holds, ${this.stats.overridden} overridden`;
  }
  /** the marks against the floor (headless: probes.ts rescue-flow): every cover mark stands on free floor with a line to what it watches, and every opening can
   *  be looked into from the corridor. Returns what is wrong. */
  check(): string[] {
    const g = this.g, nav = g.col.nav, bad: string[] = []; if (!this.F) return bad; if (!this.built) this.build();
    for (const k of this.known) {
      const o = k.o;
      if (nav.isBlocked(o.mark[0], o.mark[2])) bad.push(`${o.id}: the cover mark is not on free floor`);
      const eye: Vec3 = [o.mark[0], EYE, o.mark[2]], w = o.watch, d = flat(eye, w), s = o.kind === 'door' ? Math.max(0, d - 0.5) / d : 1;   // (a door: to just short of its leaf)
      if (g.col.segmentBlocked(eye, [eye[0] + (w[0] - eye[0]) * s, w[1], eye[2] + (w[2] - eye[2]) * s])) bad.push(`${o.id}: no line from the cover mark to its watch point`);
      if (o.door && !g.doors.byName(o.door)) bad.push(`${o.id}: no door '${o.door}' in the level`);
      if (o.kind !== 'door' && k.lookable.length < 6) bad.push(`${o.id}: only ${k.lookable.length} floor samples can be seen through it`);
      if (!k.region.pts.length) bad.push(`${o.id}: its room has no floor`);
    }
    return bad;
  }
}
