// The breach: a second, daytime showcase — Door Kickers rather than Splinter Cell. Ten in the morning, every fluorescent on and the sun raking in through the south
// glass (lighting.ts setDaylight swaps the level's daylight variant in); two operatives in Sam's colours with FN2000s run the length of the main office at the low
// ready, stack on the break room's side door, boot it, put a stun charge in the instant the leaf clears, go in on the bang — #1 through the fatal funnel and a
// stride and a half straight in, a check across the middle and the man standing in it dropped, then his corner; #2 on his heels the other way — end in an L
// owning the room and its next door, and stack on that door: cut, and the veil comes down on a fresh night-time encounter exactly as the start card has always
// found it. Nobody plays: both operatives are scripted men (squad.ts's runner behind Guard.script, the drill below sequencing them the way RoomClear sequences the
// lockdown pair — battle drill six, the same doctrine RoomClear's live men keep), the opposition are scripted too — pinned on their marks, muzzles on the door —
// and the camera cuts round it on the drill's own cues from fixed, pinned framings. Started from the start card's button, ?breach, or __breach.start(); P stops it.
//
// SINCE THE DIRECTOR (game/director.ts, docs/internal/director.md): the SHOW — cast, daylight, camera programme, captions, the cut and the restore — is the office's
// level script (levels/office.script.ts, program 'breach', showcase: true) run by Game.director; what stays here is the DRILL it drives (BreachDrill: the one piece of
// choreography with fourteen clocks, kept statement for statement), the BREACH_STAGING seam, and `Breach` as a FACADE over the Director with the surface main.ts, the
// __breach hook and tools/qa/breach-probes.ts always had (start / stop / update / active / t / drill / log / cast / chapters / onStop) — the probes stay byte-identical
// and now exercise the Director's path. The cast are spawned UNITS (guards.ts spawnUnit, ids 20‥24: an operative's round finds a hostile through the ordinary
// fireWeapon and he goes down to the hit; the drill only aims and pulls the trigger on cue, and drops a man itself only if both rounds of his pair found furniture —
// `guaranteeDowns`, logged when it fires); the shift is benched (Game.guards holds the cast alone, torches out) and comes back with restartEncounter under the veil.
// BREACH_STAGING.engage is the seam a live engagement fills to own the fight outright — see its contract below; it is NOT wired (an ownership decision, not an adapter).
import { Vec3, v3, quat, damp, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { FollowCamera } from './camera';
import type { SmokeSystemLike } from '../smoke/types';
import type { Input } from './input';
import type { BreachPlan, BreachFlow } from '../scene/level';
import type { Item } from './throwables';
import { BoxFlag, makeBox } from '../scene/boxes';
import { order, endGuardScript, Sweep, inBounds } from './squad';
import { KICK_IMPACT } from './character';
import { fireWeapon, killGuard, detonateStun } from './combat';
import { kickDustFx } from './particleFx';

/** the approach: a run with the rifles at the LOW ready — both hands on the gun, muzzle down (the runner's stance 'lowReady' → the long gun's 'lowLong'
 *  carriage) — begun HOLD_OPEN seconds in: the establishing shot opens on the empty sunlit floor and they come into it (guards walk their routes at 1.15, chase at 2.7) */
const RUN = 3.4, HOLD_OPEN = 2.6;
/** the stack: seconds between 'set' (both planted, #2's fist up with the charge in it) and #1 stepping out to breach — the breath before it goes loud */
const SET_HOLD = 2.4;
/** the charge: seconds after the sole meets the leaf that it leaves #2's hand (the latch edge has swung a hand clear by then), and its fuse from first contact with the floor */
const TOSS_AFTER_IMPACT = 0.15, FUSE_AFTER_LAND = 0.45;
/** #2's chop (the signal layer's 'go': hand up by the ear 0 → 0.28 s, over and down → 0.46) is started this long before the release so the can leaves the hand
 *  as it comes over the top */
const CHOP_LEAD = 0.4;
/** the entry: #1 goes this long after the bang, #2 this long after #1 */
const GO_AFTER_BANG = 0.4, TWO_AFTER_ONE = 0.5;
/** the centre check: seconds the muzzle takes across the room's middle before he may turn to his corner (a man standing in it cuts it short: he is engaged) */
const CENTRE_SECS = 0.32;   // (since 08-13 only the centre SWEEP's length: nobody stands in the middle any more — the designer: 'they should be continuously flowing through the room until they've cleared it')
/** the staged exchange: seconds a man's muzzle rests on his target before the first round, between the two rounds of the controlled pair, and before he takes the next man */
const SETTLE = 0.14, PAIR = 0.16, SHIFT = 0.3;   // (SETTLE 0.34 → 0.14, SHIFT 0.4 → 0.3, 08-13: 'take the shot immediately when passing through the door … no lingering in the threshold with the laser on the enemy')
/** how far inside the room's bounds a man must be before his first round may go (the frame itself is nobody's firing point; a stride in, it is) */
const FIRE_INSIDE_M = 0.3;
/** after 'room clear': the beat before the word for the next door, and how long the stack on it is held before the cut */
const NEXT_AFTER_CLEAR = 2.2, RESTACK_HOLD = 1.5, RESTACK_CAP = 7.5;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ================================================================ the seam for the teams lane
/** What BREACH_STAGING.engage is handed every frame. */
export interface BreachEngageCtx {
  g: Game; drill: BreachDrill;
  /** #1 (kicked, entered first, turns right to his corner) and #2 (banged, on his heels, turns left to his): scripted — order() them; #1's entry leg is already ordered when this is first called */
  ops: [Guard, Guard];
  /** the men inside, in plan order (plan.hostiles), dead or alive: scripted dummies today — endGuardScript(h, 'alert') hands one to the AI */
  hostiles: Guard[];
  /** seconds since #1 started through the door, and this frame's dt */
  te: number; dt: number;
}
/** The seam the teams lane's engagement fills. `engage`, when set, REPLACES the drill's flows and staged exchange (BreachDrill.flows / stagedExchange): it is called
 *  once a frame from the frame #1 starts through the door (phase 'enter': his entry leg is ordered, #2 follows TWO_AFTER_ONE later unless the hook re-routes him,
 *  and both scripts carry `hot`) until it returns true, meaning "room clear": the drill then runs the clear beat (the calls, the word for the next door, the stack
 *  on it) and the show ends as it does today. While it runs it owns the operatives' aim and trigger (order(op, { aimAt, upper }), op.weapon.fire() + fireWeapon(g,
 *  op.char, at, false, …)) and may re-route them; it owns the hostiles outright (hand them to the AI, let them shoot back — the operatives are ordinary Guards and
 *  die like anyone: the drill copes with a dead operative by ending the show early). It must return true within ~20 s or the drill calls the room itself. Default
 *  null = the staged version. Wiring the teams lane's guards.ts BREACH_HOOKS.engage(g, operatives, hostiles, opts) → { done, result, promise } into it is one
 *  closure — start theirs on the first call, answer with its `done` every call after:
 *    let live: { done: boolean } | null = null;
 *    BREACH_STAGING.engage = ({ g, ops, hostiles }) => (live ??= TEAMS.engage(g, ops, hostiles, { timeout: 20, surprise: 1 })).done;
 *  (and BREACH_STAGING.engage = null; live = null on Breach.stop — restore() below clears the seam's per-run state if it is given a `reset`). Not wired today: see
 *  the note at the top of the file. */
export const BREACH_STAGING: { engage: ((ctx: BreachEngageCtx) => boolean) | null; reset: (() => void) | null } = { engage: null, reset: null };

// ================================================================ the drill
type Phase = 'wait' | 'approach' | 'stack' | 'breach' | 'kick' | 'bang' | 'enter' | 'clear' | 'restack' | 'done';
/** one operative's way through the room (BreachFlow runs on this): waiting for his go, through the funnel, the centre check, on to his corner, holding his sector */
type FlowSt = 'wait' | 'into' | 'centre' | 'corner' | 'hold';
interface OpFlow {
  st: FlowSt; t0: number; wps: Vec3[]; sweep: Sweep; aim: Vec3;
  /** the staged exchange: hostile indices still to engage in this leg, the one his muzzle is on (−1 none) and since when, rounds of the pair fired, earliest next trigger / pick-up */
  q: number[]; on: number; since: number; n: number; next: number;
  said: boolean; inAt: number; cornerAt: number; holdAt: number;
}
/** Two operatives taking a held room through one door and flowing through it: run in → stack → #1 steps out and boots the leaf off his left leg → steps back to
 *  his own side while #2, tight on the jamb, chops the charge in the moment the latch edge clears → the bang → #1 through the funnel, centre check, the man in it,
 *  his corner; #2 on his heels, the same the other way, ending squared to the next door → the calls → both stack on that door → cut. Sequenced on its own clock
 *  like squad.ts RoomClear, every wait capped so a man who cannot make a mark costs a line, never the show. `beats` logs what happened when, in order, for the probes. */
export class BreachDrill {
  phase: Phase = 'wait';
  tStack = NaN; tSet = NaN; tGo = NaN; tKick = NaN; tFlung = NaN; tToss = NaN; tLand = NaN; tBang = NaN; tEnter = NaN; tCorner = NaN; tClear = NaN; tNext = NaN; tStacked2 = NaN; tDone = NaN;
  beats: { t: number; what: string }[] = [];
  rounds = [0, 0];
  /** the drill's own clock (seconds since start): the camera programme reads 'how long since tEnter / tClear' off it */
  t = 0;
  private done = new Set<string>();
  private aimA: Vec3; private aimB: Vec3;
  private wpA: Vec3[] = []; private wpB: Vec3[] = [];
  private can: Item | null = null; private chopped = false; private downLogged: boolean[];
  readonly flows: [OpFlow, OpFlow];
  /** guaranteeDowns (default true = the show as it always ran): a hostile still standing after both rounds of his pair, or after 14 s of entry, is put down by hand so the
   *  calls are true — logged as 'guaranteed:k' when it fires (it never has: the rounds find their men); false = only real rounds drop anybody */
  readonly guaranteeDowns: boolean;
  constructor(private g: Game, readonly plan: BreachPlan, readonly a: Guard, readonly b: Guard, readonly hostiles: Guard[], opts: { guaranteeDowns?: boolean } = {}) {
    this.aimA = v3.copy(plan.stackAim[0]); this.aimB = v3.copy(plan.stackAim[1]);
    const mk = (aim: Vec3): OpFlow => ({ st: 'wait', t0: 0, wps: [], sweep: new Sweep(), aim, q: [], on: -1, since: 0, n: 0, next: 0, said: false, inAt: NaN, cornerAt: NaN, holdAt: NaN });
    this.flows = [mk(this.aimA), mk(this.aimB)];
    this.downLogged = hostiles.map(() => false);
    this.guaranteeDowns = opts.guaranteeDowns ?? true;
  }
  get door() { return this.g.doors.byName(this.plan.door); }
  get nextDoor() { return this.g.doors.byName(this.plan.next.door); }
  private beat(what: string) { this.beats.push({ t: this.t, what }); }
  private once(key: string): boolean { if (this.done.has(key)) return false; this.done.add(key); return true; }
  private say(gd: Guard, key: string, text: string, radio = false) { if (text && this.once('say:' + key) && gd.state !== 'dead') this.g.say(gd, text, radio); }
  private route(gd: Guard, wps: Vec3[], pts: readonly Vec3[], patch: Parameters<typeof order>[1] = {}) { wps.length = 0; for (const p of pts) wps.push(v3.copy(p)); order(gd, { ...patch, goal: wps[0] ?? null }); }
  private advance(gd: Guard, wps: Vec3[], pass = 0.7): boolean {
    while (wps.length > 1 && flat(gd.char.pos, wps[0]) < pass) { wps.shift(); order(gd, { goal: wps[0] }); }
    return wps.length <= 1 && !!gd.script?.arrived;
  }
  /** is this man's centre still inside the doorway's opening (between the jambs, within a stride of the wall either side)? — the probes' funnel test, and #2's cue not to tread on #1 */
  inFunnel(p: Vec3): boolean {
    const d = this.door; if (!d) return false;
    const [hx, hz] = d.def.hinge; const alongX = Math.abs(Math.sin(d.def.closedDir)) < 0.5;
    const u0 = alongX ? hx : hz, u = alongX ? p[0] : p[2], w = alongX ? p[2] - hz : p[0] - hx;
    return u > u0 - 0.05 && u < u0 + d.def.width + 0.05 && Math.abs(w) < 0.9;
  }

  /** Stand everybody on his mark — the pair on the approach marks at the low ready facing down the aisle, the opposition inside on theirs, muzzles on the door —
   *  the leaf pulled to and latched (it is authored standing open): something to breach. */
  start() {
    const P = this.plan;
    [this.a, this.b].forEach((gd, i) => {
      const c = gd.char; const from = P.from?.[i] ?? P.stack[i];
      c.pos = v3.copy(from); c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = v3.yawTo(from, P.stack[i]); c.aimPitch = 0; gd.speed = 0;
      gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.hold = false; gd.pinned = false; gd.reactT = 0; gd.script = null;   // ('patrol', not the drill's 'search': a hunting man's laser is on — combat.ts handProps — and two lasers waving down a sunlit office is not the approach; they go to 'search' on the bang, and the lasers cut the room's haze where they belong)
      gd.weapon.rearm(); c.update(0);
      order(gd, { goal: null, face: c.bodyYaw, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false });   // stood at the low ready facing the way they will go, until the word (tick: 'wait')
    });
    P.hostiles.forEach((h, i) => { const gd = this.hostiles[i]; if (!gd) return; const c = gd.char; c.pos = v3.copy(h.pos); c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = h.yaw; gd.state = 'patrol'; gd.awareness = 0; c.update(0);
      order(gd, { goal: null, face: h.yaw, aimAt: v3.copy(h.aimAt), stance: 'none', upper: 'aim', crouch: !!h.crouch, light: false }); });
    const d = this.door; if (d) { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; }
    const dn = this.nextDoor; if (dn) { dn.reset(); dn.angle = 0; dn.vel = 0; dn.latched = true; dn.closing = false; }   // the next threshold shut too: a door to stack on, not a hole in the wall
    this.beat('start');
  }
  /** everybody off his script (the cast is about to be dismissed anyway; a stop mid-show must not leave the runner holding men that no longer exist) */
  end() { for (const gd of [this.a, this.b, ...this.hostiles]) if (gd.script) endGuardScript(gd, 'patrol'); }

  /** the stun can standing in #2's LEFT fist (his right never leaves the rifle): two boxes off the hand bone each frame, handed to the frame through Game.fx with a
   *  one-frame life — from 'set' (the fist comes up beside his head with it) until it leaves the hand at the chop. rigProps draws held cans in the right hand only. */
  private canInHand() {
    const g = this.g, c = this.b.char, hand = c.bones.handL, knuckle = c.bones.fingerL; if (!hand || !knuckle) return;
    const fingers = v3.normalize(v3.sub(knuckle, hand)); const f = c.forward();
    let axis = v3.cross(fingers, [0, 1, 0]); if (v3.len(axis) < 0.2) axis = v3.cross(fingers, f); axis = v3.normalize(axis); if (axis[1] < 0) axis = v3.scale(axis, -1);   // across the palm, standing up out of the fist
    const centre = v3.mad(v3.mad(v3.lerp(hand, knuckle, 0.55), axis, 0.03), fingers, 0.015);
    const yaw = Math.atan2(axis[0], axis[2]); const up: Vec3 = Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const x = v3.normalize(v3.cross(up, axis)), y = v3.cross(axis, x); const rot = quat.fromBasis(x, y, axis);
    const owner = c.id & 0xff;
    g.fx.push({ box: makeBox({ c: centre, h: [0.032, 0.032, 0.07], yaw, rot, albedo: [0.07, 0.075, 0.08], flags: BoxFlag.Dynamic, owner }), ttl: 1e-3 });
    g.fx.push({ box: makeBox({ c: v3.mad(centre, axis, 0.045), h: [0.034, 0.034, 0.012], yaw, rot, albedo: [0.7, 0.7, 0.66], flags: BoxFlag.Dynamic | BoxFlag.NoShadow, owner }), ttl: 1e-3 });
  }

  tick(dt: number) {
    const g = this.g, P = this.plan, a = this.a, b = this.b, d = this.door;
    this.t += dt; const t = this.t;
    if (!d) return;
    if (a.state === 'dead' || b.state === 'dead') { if (this.phase !== 'done') { this.phase = 'done'; this.tDone = t; this.beat('abort'); } return; }   // (a live exchange, one day: a man down ends the show where it stands)
    if (this.phase === 'done') return;   // done is done: the Director's loud half walks these two men past the restack's marks, and advance() below would take a man within reach of a leftover waypoint back in hand
    let aIn = this.advance(a, this.wpA), bIn = this.advance(b, this.wpB);
    this.hostiles.forEach((h, k) => { if (!this.downLogged[k] && h.state === 'dead') { this.downLogged[k] = true; this.beat(`down:${k}`); } });   // whoever's round it was (or the fallback): logged the frame he goes
    if (!isNaN(this.tSet) && !this.chopped) this.canInHand();
    switch (this.phase) {
      case 'wait': {   // the establishing shot opens on the empty floor; on the word they go — a run at the low ready, #2 a stride behind and a hair slower so the file holds
        if (t >= HOLD_OPEN) {
          this.phase = 'approach'; this.beat('go');
          this.route(a, this.wpA, [P.stack[0]], { speed: RUN, face: null, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false }); aIn = false;
          this.route(b, this.wpB, [P.stack[1]], { speed: RUN * 0.965, face: null, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false }); bIn = false;
        }
        break;
      }
      case 'approach': {   // the run down the aisle; three metres short of his mark #1 comes down to a walk and blades to the wall, #2 closing up behind him at the high port
        if (flat(a.char.pos, P.stack[0]) < 3.2 || t > HOLD_OPEN + 16) {
          this.phase = 'stack'; this.tStack = t; this.beat('approach-done');
          order(a, { speed: 1.7, face: P.stackFace[0], stance: 'stack', stackSide: P.stackSide, upper: 'none', aimAt: this.aimA });
          order(b, { speed: 1.75, face: P.stackFace[1], stance: 'highReady', upper: 'none', aimAt: this.aimB });
        }
        break;
      }
      case 'stack': {   // set once both are planted (capped): #2's fist comes up beside his head with the charge in it — 'set, bang's up' — and SET_HOLD later #1 says the word and steps out square to the leaf while #2 slides up the wall into the jamb he leaves
        const ts = t - this.tStack;
        if (ts > 0.5) this.say(a, 'stack1', P.lines.stack1);
        if (isNaN(this.tSet) && ((aIn && bIn) || ts > 7)) { this.tSet = t; this.beat(aIn && bIn ? 'stacked' : 'stacked-late'); if (bIn) b.char.anim.signal('hold'); }
        if (!isNaN(this.tSet) && t > this.tSet + 0.3) this.say(b, 'stack2', P.lines.stack2);
        if (!isNaN(this.tSet) && t >= this.tSet + SET_HOLD && (!b.char.anim.signalling || t > this.tSet + SET_HOLD + 0.6)) {
          this.say(a, 'breach1', P.breachLines.breach1);
          this.tGo = t; this.phase = 'breach'; this.beat('squeeze');
          this.route(a, this.wpA, [P.kickFrom], { speed: 1.3, face: P.kickFace, stance: 'highReady', upper: 'none', strafe: false, aimAt: null }); aIn = false;
          this.route(b, this.wpB, [P.toss.mark], { speed: 1.1, face: P.toss.face, strafe: true, stance: 'highReady', upper: 'none', aimAt: v3.copy(P.stackAim[0]) }); bIn = false;   // (strafing: his chest stays up the wall as he sidles into the jamb)
        }
        break;
      }
      case 'breach': {   // planted square to the leaf by the lock (or out of time): the boot, off the LEFT leg — the one nearer the doorway, his weight on the wall-side foot
        const c = a.char; const planted = aIn && flat(c.pos, P.kickFrom) < 0.07 && Math.abs(wrapAngle(c.bodyYaw - P.kickFace)) < 0.1;
        if ((planted && t > this.tGo + 0.5) || t > this.tGo + 1.8) { order(a, { goal: null, aimAt: null }); c.anim.kickDoor({ leg: 'left' }); this.tKick = t; this.phase = 'kick'; this.beat('kick'); this.beat('kickL'); }
        break;
      }
      case 'kick': {   // #2's chop starts ahead of the impact so the can comes over the top just after it; the sole meets the leaf at KICK_IMPACT: unlatched and flung off the boot into the room (the door model bangs it off its stop) — and on that frame #1 steps BACK, chest on the doorway, to his mark behind and outside #2: never across the opening
        const an = a.char.anim, c = a.char;
        if (!this.chopped && t >= this.tKick + KICK_IMPACT + TOSS_AFTER_IMPACT - CHOP_LEAD) { this.chopped = true; b.char.anim.signal('go'); this.say(b, 'bang2', P.breachLines.bang2); }
        if (this.chopped) this.canInHand();   // (still in the fist through the chop, until it flies below)
        if (isNaN(this.tFlung) && (an.kickImpact || an.kickTime >= KICK_IMPACT || !an.kicking)) {
          this.tFlung = t;
          const onIt = flat(c.pos, P.kickFrom) < 0.4 && Math.abs(wrapAngle(c.bodyYaw - P.kickFace)) < 0.35;
          if (Math.abs(d.angle) < 1.4) { d.latched = false; d.closing = false; d.vel = onIt ? P.fling : P.fling * 0.32; d.sinceBash = onIt ? 0 : d.sinceBash; d.quietT = -0.5; d.creakArmed = false; }
          d.lastWho = c.id;
          if (onIt) { g.audio.play('doorBash', d.pos, 1.0, { rate: 0.9 }); kickDustFx(g, d, c.pos); }   // (+ the plaster and splinters off the jamb: GPU particles, nothing with them off)
          this.say(a, 'in1', P.lines.in1); this.beat(onIt ? 'door-flung' : 'door-pushed');
          this.route(a, this.wpA, [P.retreat.mark], { speed: 1.9, face: P.retreat.face, strafe: true, stance: 'highReady', upper: 'none', aimAt: [d.frameCentre[0] + 1.2, 1.1, d.frameCentre[2]] }); aIn = false;   // (the runner moves a kicking man too: the planted foot is the animator's, the root steps back under it)
          this.beat('retreat');
        }
        if (!isNaN(this.tFlung) && !this.can && t >= this.tFlung + TOSS_AFTER_IMPACT) {   // the leaf's latch edge is a hand clear: the can leaves the support hand round the jamb for the open floor north of the table
          const hand = b.char.bones.handL ?? v3.add(b.char.pos, [0, 1.3, 0]);
          const from: Vec3 = [hand[0], Math.max(1.0, hand[1]), hand[2]];
          const sol = g.items.solve(from, P.toss.land, 9);
          const it = this.can = g.items.spawn('flash', from, sol.v0, { fuse: 99, who: b.char.id, heading: v3.yawOf(sol.v0) });   // (fuse 99: it goes off on OUR cue below, not the item's — see bang)
          it.onBounce = (sp, p) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
          g.audio.play('throw', from, 0.7);
          this.tToss = t; this.beat('toss');
          // eyes off what is about to go off, muzzles nowhere near each other: #1's head and gun go down to the floor on his outside (the side away from the
          // door and from #2), #2 tucks his head down behind the jamb, muzzle to the foot of the wall ahead of him — until it has gone
          { const fa: Vec3 = [Math.sin(P.retreat.face), 0, Math.cos(P.retreat.face)], fb: Vec3 = [Math.sin(P.toss.face), 0, Math.cos(P.toss.face)];
            const toB = v3.sub(P.toss.mark, P.retreat.mark); const side = Math.sign(fa[2] * toB[0] - fa[0] * toB[2]) || 1;   // which side of #1's facing #2 stands (+1 = his left): he looks away to the other
            order(a, { aimAt: [P.retreat.mark[0] - fa[2] * side * -1.4 + fa[0] * 0.3, 0.1, P.retreat.mark[2] + fa[0] * side * -1.4 + fa[2] * 0.3] });
            order(b, { aimAt: [P.toss.mark[0] + fb[0] * 1.3, 0.1, P.toss.mark[2] + fb[2] * 1.3] }); }
          this.phase = 'bang';
        }
        break;
      }
      case 'bang': {   // it lands, skids, and goes off FUSE_AFTER_LAND after first contact (or 2 s of anything): combat.ts detonateStun — the burst, the flash that whites the room, the bang the whole floor hears, and the daze on every man with eyes on it. The men with eyes on it are the three inside: the operatives are behind the partition looking away, but the flash test would not know a jamb from a doorway at #2's shoulder, so for the length of the call the guard list IS the opposition
        const it = this.can!; const landed = it.bounces > 0 || it.settled;
        if (landed && isNaN(this.tLand)) { this.tLand = t; this.beat('land'); }
        if ((!isNaN(this.tLand) && t >= this.tLand + FUSE_AFTER_LAND) || t > this.tToss + 2.0) {
          it.fired = true; this.tBang = t;
          const all = g.guards; g.guards = this.hostiles.filter(h => h.state !== 'dead');
          try { detonateStun(g, it); } finally { g.guards = all; }
          this.beat('bang');
          // the men inside reel: muzzles drop to the floor at their feet, the middle one gives half a step (they are dazed for seconds — long after it matters)
          this.hostiles.forEach((h, i) => { if (h.state === 'dead') return; const c = h.char, f = c.forward(); order(h, { aimAt: [c.pos[0] + f[0] * 1.2, 0.1, c.pos[2] + f[2] * 1.2], upper: 'aim', stance: 'none' }); if (i === 0) order(h, { goal: [c.pos[0] + 0.35, 0, c.pos[2] - 0.3], strafe: true, face: c.bodyYaw, speed: 0.9 }); });
          // heads back on the door: #1's muzzle up on the opening he is about to take, #2's over him
          const setV = (o: Vec3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; };
          setV(this.aimA, d.frameCentre[0] + 1.5, 1.1, d.frameCentre[2]); order(a, { aimAt: this.aimA });
          setV(this.aimB, d.frameCentre[0] + 1.0, 1.5, d.frameCentre[2] - 0.3); order(b, { aimAt: this.aimB });
          this.phase = 'enter';
        }
        break;
      }
      case 'enter': {   // GO_AFTER_BANG later #1 goes, TWO_AFTER_ONE after him #2 (each man's flow below); the exchange is staged on top of the flows unless the seam has an engagement
        if (isNaN(this.tEnter)) {
          if (t < this.tBang + GO_AFTER_BANG) break;
          this.tEnter = t; a.state = 'search'; b.state = 'search';   // (hunting now: lasers on, cutting the room's haze)
          this.say(a, 'going1', P.breachLines.going1); this.beat('enter1');
          this.startFlow(0);
        }
        const te = t - this.tEnter;
        if (this.flows[1].st === 'wait' && te >= TWO_AFTER_ONE && (inBounds(a.char.pos, P.bounds) || te > 2.5)) { this.beat('enter2'); this.startFlow(1); }   // on his heels — but never treading on them: #1 is through the frame (inside the room's bounds) before #2 starts for it
        const hook = BREACH_STAGING.engage;
        let clear: boolean;
        if (hook) clear = hook({ g, drill: this, ops: [a, b], hostiles: this.hostiles, te, dt }) || te > 20;
        else { this.tickFlow(0, dt); this.tickFlow(1, dt); clear = this.roomClear(te); }
        aIn = bIn = false;   // (the flows route the men themselves)
        if (clear) { this.phase = 'clear'; this.tClear = t; this.beat('clear'); }
        break;
      }
      case 'clear': {   // #1 calls the room; a beat, then the word for the next door and both close on it — #2 (nearest, and holding it already) onto the jamb as the new point, #1 tucking in behind — guns at the high port on the shut leaf
        const tc = t - this.tClear;
        this.tickHold(0, dt); this.tickHold(1, dt);
        if (tc > 0.3) this.say(a, 'roomClear1', P.breachLines.roomClear1);
        if (tc >= NEXT_AFTER_CLEAR && isNaN(this.tNext)) {
          this.tNext = t; this.beat('next'); this.say(a, 'next1', P.breachLines.next1);
          const N = P.next;
          this.route(b, this.wpB, this.legTo(b, N.stack[0]), { speed: 2.0, face: N.stackFace[0], strafe: false, stance: 'stack', stackSide: N.stackSide, upper: 'aim', aimAt: this.aimB, hot: true, crouch: false }); bIn = false;   // (upper 'aim' + hot: the muzzles stay ON the next door all the way to it — 08-13, 'as they approach the door they should keep their muzzle on the door')
          this.route(a, this.wpA, this.legTo(a, N.stack[1]), { speed: 2.3, face: N.stackFace[1], strafe: false, stance: 'highReady', upper: 'aim', aimAt: this.aimA, hot: true, crouch: false }); aIn = false;
          this.flows[0].sweep.start(this.aimA, [N.stackAim[1]], t, 1.2); this.flows[1].sweep.start(this.aimB, [N.stackAim[0]], t, 0.9);
          this.phase = 'restack';
        }
        break;
      }
      case 'restack': {
        const tn = t - this.tNext;
        for (const F of this.flows) if (F.sweep.active) F.sweep.at(t, F.aim);
        if (tn > 1.6) this.say(a, 'radio1', P.breachLines.radio1, true);
        if (isNaN(this.tStacked2) && ((aIn && bIn) || tn > RESTACK_CAP)) { this.tStacked2 = t; this.beat(aIn && bIn ? 'stack2' : 'stack2-late'); if (bIn) b.char.anim.signal('hold'); }
        if (!isNaN(this.tStacked2) && t >= this.tStacked2 + RESTACK_HOLD && isNaN(this.tDone)) { this.tDone = t; this.phase = 'done'; this.beat('cut'); this.beat('done'); }
        break;
      }
      // ('done' returned above)
    }
  }
  /** waypoints from where a man stands to a mark across the room: straight there if the leg is clear at shin and chest height (statics and leaves), else through
   *  as many of the plan's `next.via` points — a lane authored clear of the furniture — as it takes until the rest of the way is clear */
  private legTo(gd: Guard, mark: Vec3): Vec3[] {
    const g = this.g, from = gd.char.pos;
    const clear = (p: Vec3, q: Vec3) => !g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]) && !g.col.solidBlocked([p[0], 1.2, p[2]], [q[0], 1.2, q[2]]);
    if (clear(from, mark)) return [mark];
    const out: Vec3[] = []; let p = from;
    for (const q of this.plan.next.via ?? []) { if (clear(p, mark)) break; if (flat(p, q) > 0.6 && (out.length || flat(from, q) < flat(from, mark))) { out.push(v3.copy(q)); p = q; } }
    out.push(mark); return out;
  }

  /** p inside the room's authored bounds by at least `m` (plan.bounds: the walls' inner faces) */
  private insideRoom(p: Vec3, m: number): boolean { const B = this.plan.bounds; if (!B) return true; return p[0] > B.x0 + m && p[0] < B.x1 - m && p[2] > B.z0 + m && p[2] < B.z1 - m; }   // (no bounds authored: the frame test is the funnel's own arrival)
  // ---------------------------------------------------------------- the flows (battle drill six, one man at a time)
  private flowOf(i: 0 | 1): BreachFlow { return this.plan.flow[i]; }
  /** send man i: the doorway square and a stride and a half straight in at a run, gun up, muzzle on the middle of the room; his centre-check targets loaded */
  private startFlow(i: 0 | 1) {
    const F = this.flows[i], fl = this.flowOf(i), gd = i === 0 ? this.a : this.b, wps = i === 0 ? this.wpA : this.wpB;
    F.st = 'into'; F.t0 = this.t; F.q = [...this.plan.targets[i].centre]; F.on = -1; F.n = 0; F.next = 0;
    this.route(gd, wps, fl.into, { speed: 2.9, face: v3.yawTo(fl.into[Math.max(0, fl.into.length - 2)], fl.into[fl.into.length - 1]), strafe: false, stance: 'none', upper: 'aim', aimAt: F.aim, hot: true, crouch: false });
    F.sweep.start(F.aim, [fl.centre[0]], this.t, 0.9);   // the muzzle comes round onto the near end of the centre check as he takes the frame
  }
  private tickFlow(i: 0 | 1, dt: number) {
    const F = this.flows[i]; if (F.st === 'wait') return;
    const fl = this.flowOf(i), gd = i === 0 ? this.a : this.b, wps = i === 0 ? this.wpA : this.wpB, t = this.t;
    const arrived = this.advance(gd, wps, 0.8);
    const engaged = this.stagedExchange(i, dt);   // muzzle on a man (or picking one up): the sweep waits
    if (!engaged && F.sweep.active) F.sweep.at(t, F.aim);
    switch (F.st) {
      case 'into': {   // through the funnel; the check starts as he comes onto his spot (or 2.2 s in regardless)
        const last = fl.into[fl.into.length - 1];
        if (flat(gd.char.pos, last) < 0.55 || t > F.t0 + 2.2) {   // in: the centre check runs across the middle WHILE he turns for his corner — one continuous flow from the frame to his point (08-13)
          F.st = 'corner'; F.inAt = t; F.cornerAt = t; if (isNaN(this.tCorner)) this.tCorner = t; this.beat(`in${i + 1}`); this.beat(`centre${i + 1}`); this.beat(`corner${i + 1}`);
          F.q = [...F.q.filter(k => this.hostiles[k]?.state !== 'dead'), ...this.plan.targets[i].corner.filter(k => this.hostiles[k]?.state !== 'dead' && !F.q.includes(k))]; if (F.on < 0) { F.n = 0; F.next = Math.min(F.next, t + 0.05); }
          this.route(gd, wps, fl.corner, { speed: 2.0, face: fl.podFace, strafe: false, stance: 'none', upper: 'aim', aimAt: F.aim, hot: true });
          F.sweep.start(F.aim, [fl.centre[0], fl.centre[1], ...fl.cornerAim], t, CENTRE_SECS + 1.9);   // the middle first, then his sector edge to edge into the corner itself
        }
        break;
      }
      case 'centre': {   // the muzzle across the middle; a man standing in it is engaged (the exchange); done when the check has run AND nobody on his list is left standing in his line (or 3 s)
        const pending = F.on >= 0 || this.pickable(i);
        if ((!F.sweep.active && !pending && t > F.inAt + CENTRE_SECS) || t > F.inAt + 3.2) {
          F.st = 'corner'; F.cornerAt = t; if (isNaN(this.tCorner)) this.tCorner = t; this.beat(`corner${i + 1}`);
          F.q = [...this.plan.targets[i].corner.filter(k => this.hostiles[k]?.state !== 'dead'), ...F.q.filter(k => this.hostiles[k]?.state !== 'dead')]; F.on = -1; F.n = 0; F.next = t + 0.1;
          this.route(gd, wps, fl.corner, { speed: 1.7, face: fl.podFace, strafe: false, stance: 'none', upper: 'aim', aimAt: F.aim, hot: true });
          F.sweep.start(F.aim, fl.cornerAim, t, 1.9);   // his sector, edge to edge, into the corner itself
        }
        break;
      }
      case 'corner': {   // on his point (or 4 s), the corner swept and nobody left in his sector: he calls it and settles onto what he holds
        const pending = F.on >= 0 || this.pickable(i);
        if (((arrived || t > F.cornerAt + 4.0) && !F.sweep.active && !pending) || t > F.cornerAt + 6.5) {
          F.st = 'hold'; F.holdAt = t; this.beat(`hold${i + 1}`);
          this.say(gd, i === 0 ? 'clear1' : 'clear2', i === 0 ? this.plan.breachLines.clear1 : this.plan.breachLines.clear2);
          F.sweep.start(F.aim, [fl.hold], t, 0.9);
          order(gd, { face: fl.podFace });
        }
        break;
      }
      case 'hold': break;
    }
  }
  /** the clear beat keeps the exchange honest for a man still up (it cannot be, short of both flows timing out) and the muzzles resting where they hold */
  private tickHold(i: 0 | 1, dt: number) { const F = this.flows[i]; if (!this.stagedExchange(i, dt) && F.sweep.active) F.sweep.at(this.t, F.aim); }
  /** both men holding their sectors and every hostile down (a beat after the last of those) — or 14 s of entry, when whoever is somehow still standing is put down so the calls are true */
  private roomClear(te: number): boolean {
    const H = this.hostiles, allDown = H.every(h => h.state === 'dead');
    const holding = this.flows[0].st === 'hold' && this.flows[1].st === 'hold';
    if (holding && allDown) { if (isNaN(this.tAllDone)) this.tAllDone = this.t; return this.t > this.tAllDone + 0.5; }
    if (te > 14) { H.forEach((h, k) => { if (h.state !== 'dead' && this.guaranteeDowns) { this.beat(`guaranteed:${k}`); killGuard(this.g, h, [1, 0, 0], false, 'shot', 'guard', 'hostile down'); } }); return true; }
    return false;
  }
  private tAllDone = NaN;
  /** is the front of man i's list a living man he has a line to (eye to chest, statics and leaves)? — dead men are dropped off the front as a side effect */
  private pickable(i: 0 | 1): boolean {
    const F = this.flows[i], H = this.hostiles, c = (i === 0 ? this.a : this.b).char;
    while (F.q.length && H[F.q[0]]?.state === 'dead') F.q.shift();
    if (!F.q.length) return false;
    const h = H[F.q[0]]; const eye = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]); const chest = h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    return !this.g.col.segmentBlocked(eye, chest);
  }

  /** The exchange as staged (BREACH_STAGING.engage replaces it): man i works through his list for this leg of his flow — the first living man on it he has a line
   *  to gets the muzzle (his sweep waits), SETTLE later the first round of a controlled pair, PAIR later the second. The rounds fly true at the chest and, the cast
   *  having sides, FIND him (combat.ts fireWeapon → killGuard by the operative's hand): he goes down to the hit, his rifle leaving his hands. Should both rounds
   *  of the pair have found furniture instead he is dropped on the second regardless (killGuard, on nobody's card) so the beat holds. SHIFT later the next man.
   *  Returns true while his muzzle is on somebody. */
  private stagedExchange(i: 0 | 1, dt: number): boolean {
    const g = this.g, H = this.hostiles, F = this.flows[i], op = i === 0 ? this.a : this.b, c = op.char, t = this.t;
    if (F.st === 'wait') return false;
    if (F.st === 'into' && !this.insideRoom(c.pos, FIRE_INSIDE_M)) return false;   // through the frame first — then the first man on his list who stands in his line gets the pair AS HE MOVES (08-13: no stop in the middle, no beat with the laser resting on a living man)
    if (F.on >= 0 && F.n === 0 && H[F.on].state === 'dead') { F.on = -1; F.next = t + SHIFT; }   // his man went before he fired (his mate's round across the room): the next one — but a pair begun is a pair finished, into the man as he falls
    if (F.on < 0 && t >= F.next && this.pickable(i)) { F.on = F.q[0]; F.since = t; F.n = 0; this.beat(`eyes${i + 1}:${F.on}`); }
    if (F.on < 0) return false;
    const h = H[F.on]; const chest = h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    F.aim[0] = damp(F.aim[0], chest[0], 16, dt); F.aim[1] = damp(F.aim[1], chest[1], 16, dt); F.aim[2] = damp(F.aim[2], chest[2], 16, dt);   // the muzzle snaps onto him (the script's aimAt IS this vector)
    const due = F.n === 0 ? F.since + SETTLE : F.next;
    if (t >= due && !op.weapon.reloading) {
      if (op.weapon.fire()) {
        const dir = v3.normalize(v3.sub(chest, c.muzzle));
        fireWeapon(g, c, chest, false, { steady: true, spread: 0.01 });
        F.n++; this.rounds[i]++; this.beat(`shot${i + 1}`);
        if (F.n >= 2) { if (h.state !== 'dead' && this.guaranteeDowns) { this.beat(`guaranteed:${F.on}`); killGuard(g, h, dir, false, 'shot', 'guard', 'hostile down'); } F.q = F.q.filter(k => k !== F.on); F.on = -1; F.next = t + SHIFT; }
        else F.next = t + PAIR;
      } else op.weapon.rearm();   // (cannot happen inside thirty rounds; a dry gun would stall the beat, so it is simply full again)
    }
    return true;
  }
}

// ================================================================ the show: a facade over the Director (the surface main.ts, __breach and tools/qa/breach-probes.ts always had)
/** The breach as it was always started, stopped and read — now backed by Game.director running the office script's program 'breach'. Constructing it hands the Director
 *  the camera and the input (so a start before any frame pins its first shot and locks the keys at once); update(dt) ticks NOTHING (the Director ticks inside
 *  Game.update) and only reports the look-at the show is pinned on, the way main.ts / the probes always read it before stepping the game. */
export class Breach {
  /** called at the very end of a run's teardown: finished = it ran to its end rather than being cut off (main.ts puts the start card back up) */
  onStop?: (finished: boolean) => void;
  constructor(private game: Game, cam: FollowCamera, _smoke: SmokeSystemLike, input: Input) {
    game.director.attach({ cam, input });
    const prev = game.director.onProgramEnd;
    game.director.onProgramEnd = (name, finished) => { prev?.(name, finished); if (name === PROGRAM) this.onStop?.(finished); };
  }
  /** does this level's script have an armed 'breach' program (a daylight variant and a plan behind it)? The start card only offers the button when it does. */
  get available(): boolean { return this.game.director.canStart(PROGRAM) === null || this.active; }
  get active(): boolean { const R = this.game.director.run; return !!R && !R.ended && R.name === PROGRAM; }
  /** the show clock: seconds since start (the last run's length once it has stopped) */
  get t(): number { const D = this.game.director; return this.active ? D.run!.t : D.lastRun?.name === PROGRAM ? D.lastRun.t : 0; }
  get fade(): number { return this.active ? this.game.director.frame?.fade ?? 0 : 0; }
  get caption(): string { return this.active ? this.game.director.frame?.caption ?? '' : ''; }
  get sub(): string { return this.active ? this.game.director.frame?.sub ?? '' : ''; }
  get shotI(): number { return this.game.director.chapters()?.i ?? -1; }
  /** the drill the running program drives (null between runs) */
  get drill(): BreachDrill | null { if (!this.active) return null; for (const d of this.game.director.run!.drills) if (d.impl.kind === 'breach') return d.impl.d; return null; }
  /** the cast of the running program: the two operatives, the men inside */
  get cast(): { ops: Guard[]; hostiles: Guard[] } | null { if (!this.active) return null; const us = [...this.game.director.run!.units.values()].map(u => u.gd); return { ops: us.filter(x => x.team === 'operative'), hostiles: us.filter(x => x.team === 'hostile') }; }
  /** The beats of the last (or current) run in the shape they always had — the show's notes ('daylight' / 'cast' / 'shot:…') first, then every drill beat, then
   *  'restore' — read off the Director's log for that run (which is chronological and says more: director.rowsOf()). */
  get log(): { t: number; what: string }[] {
    const D = this.game.director; const serial = this.active ? D.run!.serial : D.lastRun?.name === PROGRAM ? D.lastRun.serial : -1;
    const rows = D.rowsOf(serial); const notes: { t: number; what: string }[] = [], drill: { t: number; what: string }[] = [], tailRows: { t: number; what: string }[] = [];
    for (const r of rows) {
      if (r.kind === 'drill') drill.push({ t: r.t, what: r.what });
      else if (r.kind === 'camera') notes.push({ t: r.t, what: 'shot:' + r.what });
      else if (r.kind === 'note' && (r.what === 'daylight' || r.what === 'cast')) notes.push({ t: r.t, what: r.what });
      else if (r.kind === 'note' && r.what === 'restore') tailRows.push({ t: r.t, what: r.what });
    }
    return [...notes, ...drill, ...tailRows];
  }
  start() { const why = this.game.director.start(PROGRAM); if (why && typeof console !== 'undefined') console.warn('breach: ' + why); }
  stop(finished = false) { if (this.active) this.game.director.stop(finished); }
  chapters() { return this.game.director.chapters() ?? { list: [], i: -1, frac: 0 }; }
  /** Once a frame BEFORE the game step, as ever — but the show now runs inside Game.update (director.tick): this only hands back the look-at it is pinned on (non-null = 'a scripted camera has the frame'). */
  update(_dt: number): Vec3 | null { return this.active ? v3.copy(this.game.director.frame?.look ?? this.game.followPos()) : null; }
}
/** the office script's program this facade fronts (levels/office.script.ts) */
const PROGRAM = 'breach';
