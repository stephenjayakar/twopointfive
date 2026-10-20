// The breach DRILL: two operatives with FN2000s run up at the low ready, stack on a room's door, boot it, put a stun charge in the instant the leaf clears, go in
// on the bang — #1 through the fatal funnel and a stride and a half straight in, a check across the middle and the man standing in it dropped, then his corner; #2
// on his heels the other way — end in an L owning the room and its next door, and stack on that door. Both operatives are scripted men (squad.ts's runner behind
// Guard.script, the drill below sequencing them the way RoomClear sequences the lockdown pair — battle drill six, the same doctrine RoomClear's live men keep).
//
// It began as the choreography of a daytime showcase (the office's level script, program 'breach', with a `Breach` facade here that main.ts and the probes drove).
// The two showcases were removed; what stays is BreachDrill — the one piece of choreography with fourteen clocks, kept statement for statement — which the night
// breach scenario runs LIVE on Sam's orders (game/nightbreach.ts, BreachLive) and a level script may still drive as a Director drill (game/director.ts D.drill).
// Its men are spawned UNITS (guards.ts spawnUnit: an operative's round finds a hostile through the ordinary fireWeapon and he goes down to the hit; the drill only
// aims and pulls the trigger on cue, and drops a man itself only if both rounds of his pair found furniture — `guaranteeDowns`, logged when it fires).
import { teamFight } from './teampace';   // (read inside tick only)
import { Vec3, v3, quat, damp, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { BreachPlan, BreachFlow } from '../scene/level';
import type { Item } from './throwables';
import { BoxFlag, makeBox } from '../scene/boxes';
import { order, endGuardScript, Sweep, inBounds } from './squad';
import { KICK_IMPACT } from './character';
import { fireWeapon, killGuard, detonateStun } from './combat';
import { kickDustFx } from './particleFx';
import { shotEnergy } from './glasspen';
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { runnerFled } from './runner';   // (asked inside the ending check only: false with its switch off)

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
const CENTRE_SECS = 0.32;   // (since 08-13 only the centre SWEEP's length: nobody stands in the middle any more — the maintainer: 'they should be continuously flowing through the room until they've cleared it')
/** the staged exchange: seconds a man's muzzle rests on his target before the first round, between the two rounds of the controlled pair, and before he takes the next man */
const SETTLE = 0.14, PAIR = 0.16, SHIFT = 0.3;   // (SETTLE 0.34 → 0.14, SHIFT 0.4 → 0.3, 08-13: 'take the shot immediately when passing through the door … no lingering in the threshold with the laser on the enemy')
/** how far inside the room's bounds a man must be before his first round may go (the frame itself is nobody's firing point; a stride in, it is) */
const FIRE_INSIDE_M = 0.3;
/** after 'room clear': the beat before the word for the next door, and how long the stack on it is held before the cut */
const NEXT_AFTER_CLEAR = 2.2, RESTACK_HOLD = 1.5, RESTACK_CAP = 7.5;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ================================================================ the drill
type Phase = 'wait' | 'approach' | 'stack' | 'breach' | 'kick' | 'bang' | 'enter' | 'clear' | 'restack' | 'done';
/** one operative's way through the room (BreachFlow runs on this): waiting for his go, through the funnel, the centre check, on to his corner, holding his sector */
type FlowSt = 'wait' | 'into' | 'centre' | 'corner' | 'hold';
/** What a LIVE drill reads every frame (BreachDrill.live; game/nightbreach.ts owns the object and writes it): how many orders Sam has given (1 = stack up, 2 = go),
 *  whether the pair's weapon lights come on as they enter, whether the boot is heard by the men inside (a 'kick' hearing event at the leaf), and whether #2 has a
 *  stun charge to put in (false = boot and go: no can, no bang, #1 starts through the door on the beat the charge would have left the hand). */
export interface BreachLive { orders: number; lights: boolean; loudBoot: boolean; stun: boolean;
  /** seconds the stack stands set before the point man may step out on 'go' (absent = SET_HOLD, the show's beat; game/rescue.ts shortens it once the clock is running) */
  setHold?: number; }
/** live play: what the pair says where the show's line would state what the drill does not know (a body count: Sam's rounds count too) … */
const LIVE_LINES: Record<string, string> = { clear1: 'right side — clear.', clear2: 'left clear. i have the door.', roomClear1: 'room clear.' };
/** … said by the man it is true of (words.ts): #1's hold is the gun on the room's north door (plan.flow[0].hold), #2's is the far corner */
const LIVE_NOW: Record<string, string> = { clear1: 'right side — clear. i have the door.', clear2: 'left clear.' };
/** … or promise a charge nobody is carrying */
const LIVE_NO_CHARGE: Record<string, string> = { stack1: 'stack on me — side door. on my boot.', stack2: 'set.' };
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
  /** LIVE PLAY (game/nightbreach.ts — null = the show's drill, statement for statement as it was): the pair wait on the approach marks for `orders` ≥ 1 ('stack up')
   *  and on the stack for `orders` ≥ 2 ('go') instead of the show's clocks; the men inside are NOT the drill's to script (start and bang leave them alone: they are
   *  pinned AI men who shoot back); a man down ends nothing while the other can go on (he finishes his flow with every living man inside on his list); the staged
   *  exchange asks for a line before every pick AND every round; the boot is heard (a 'kick' event); the room is called only when everybody inside is down — no 14 s
   *  fallback — and the drill ends there, on the hold, with no restack. */
  readonly live: BreachLive | null;
  /** live: the drill clock when order one came (the approach's cap counts from it, as the show's does from HOLD_OPEN) */
  tRun = NaN;
  constructor(private g: Game, readonly plan: BreachPlan, readonly a: Guard, readonly b: Guard, readonly hostiles: Guard[], opts: { guaranteeDowns?: boolean; live?: BreachLive } = {}) {
    this.aimA = v3.copy(plan.stackAim[0]); this.aimB = v3.copy(plan.stackAim[1]);
    const mk = (aim: Vec3): OpFlow => ({ st: 'wait', t0: 0, wps: [], sweep: new Sweep(), aim, q: [], on: -1, since: 0, n: 0, next: 0, said: false, inAt: NaN, cornerAt: NaN, holdAt: NaN });
    this.flows = [mk(this.aimA), mk(this.aimB)];
    this.downLogged = hostiles.map(() => false);
    this.guaranteeDowns = opts.guaranteeDowns ?? true;
    this.live = opts.live ?? null;
  }
  get door() { return this.g.doors.byName(this.plan.door); }
  get nextDoor() { return this.g.doors.byName(this.plan.next.door); }
  private beat(what: string) { this.beats.push({ t: this.t, what }); }
  private once(key: string): boolean { if (this.done.has(key)) return false; this.done.add(key); return true; }
  /** is there a stun charge in this entry: always in the show; live, only with the knob on and #2 alive to carry it (a dead man chops nothing and throws nothing) */
  private get charge(): boolean { return !this.live || (this.live.stun && this.b.state !== 'dead'); }
  private say(gd: Guard, key: string, text: string, radio = false) {
    if (this.live) text = (this.charge ? undefined : LIVE_NO_CHARGE[key]) ?? (WORDS.on ? LIVE_NOW[key] : undefined) ?? LIVE_LINES[key] ?? text;
    if (text && this.once('say:' + key) && gd.state !== 'dead') this.g.say(gd, text, radio);
  }
  private route(gd: Guard, wps: Vec3[], pts: readonly Vec3[], patch: Parameters<typeof order>[1] = {}) { wps.length = 0; for (const p of pts) wps.push(v3.copy(p)); order(gd, { ...patch, goal: wps[0] ?? null }); }
  private advance(gd: Guard, wps: Vec3[], pass = 0.7): boolean {
    if (gd.state === 'dead') return true;   // (live play only — the show ends on a man down: nobody orders a corpse about, and nothing waits on him)
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
    if (!this.live) P.hostiles.forEach((h, i) => { const gd = this.hostiles[i]; if (!gd) return; const c = gd.char; c.pos = v3.copy(h.pos); c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = h.yaw; gd.state = 'patrol'; gd.awareness = 0; c.update(0);
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
    if (this.phase !== 'wait' && this.phase !== 'approach' && this.phase !== 'stack' && this.phase !== 'done') { teamFight(g, a); teamFight(g, b); }   // (teampace.ts: from the boot on the drill's legs are the fight's, at the pace they had; the walk up to the stack is a walk — nothing with its switch off)
    if (this.live) { if (this.casualties(t)) return; }
    else if (a.state === 'dead' || b.state === 'dead') { if (this.phase !== 'done') { this.phase = 'done'; this.tDone = t; this.beat('abort'); } return; }   // (a live exchange, one day: a man down ends the show where it stands)
    if (this.phase === 'done') return;   // done is done: the Director's loud half walks these two men past the restack's marks, and advance() below would take a man within reach of a leftover waypoint back in hand
    let aIn = this.advance(a, this.wpA), bIn = this.advance(b, this.wpB);
    this.hostiles.forEach((h, k) => { if (!this.downLogged[k] && h.state === 'dead') { this.downLogged[k] = true; this.beat(`down:${k}`); } });   // whoever's round it was (or the fallback): logged the frame he goes
    if (!isNaN(this.tSet) && !this.chopped && this.charge) this.canInHand();
    switch (this.phase) {
      case 'wait': {   // the establishing shot opens on the empty floor; on the word they go — a run at the low ready, #2 a stride behind and a hair slower so the file holds
        if (this.live ? this.live.orders >= 1 : t >= HOLD_OPEN) {
          this.phase = 'approach'; this.beat('go'); this.tRun = t;
          this.route(a, this.wpA, [P.stack[0]], { speed: RUN, face: null, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false }); aIn = false;
          this.route(b, this.wpB, [P.stack[1]], { speed: RUN * 0.965, face: null, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false }); bIn = false;
        }
        break;
      }
      case 'approach': {   // the run down the aisle; three metres short of his mark #1 comes down to a walk and blades to the wall, #2 closing up behind him at the high port
        if (flat(a.char.pos, P.stack[0]) < 3.2 || t > (this.live ? this.tRun : HOLD_OPEN) + 16) {
          this.phase = 'stack'; this.tStack = t; this.beat('approach-done');
          order(a, { speed: 1.7, face: P.stackFace[0], stance: 'stack', stackSide: P.stackSide, upper: 'none', aimAt: this.aimA });
          order(b, { speed: 1.75, face: P.stackFace[1], stance: 'highReady', upper: 'none', aimAt: this.aimB });
        }
        break;
      }
      case 'stack': {   // set once both are planted (capped): #2's fist comes up beside his head with the charge in it — 'set, bang's up' — and SET_HOLD later #1 says the word and steps out square to the leaf while #2 slides up the wall into the jamb he leaves
        const ts = t - this.tStack;
        if (ts > 0.5) this.say(a, 'stack1', P.lines.stack1);
        if (isNaN(this.tSet) && ((aIn && bIn) || ts > 7)) { this.tSet = t; this.beat(aIn && bIn ? 'stacked' : 'stacked-late'); if (bIn) b.char.anim.signal('squeeze'); }
        if (!isNaN(this.tSet) && t > this.tSet + 0.3) this.say(b, 'stack2', P.lines.stack2);
        const setHold = this.live?.setHold ?? SET_HOLD;
        if (!isNaN(this.tSet) && t >= this.tSet + setHold && (!b.char.anim.signalling || t > this.tSet + setHold + 0.6) && (!this.live || this.live.orders >= 2)) {
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
        if (!this.chopped && t >= this.tKick + KICK_IMPACT + TOSS_AFTER_IMPACT - CHOP_LEAD) { this.chopped = true; if (b.state !== 'dead') b.char.anim.tossItem(CHOP_LEAD); if (this.charge) this.say(b, 'bang2', P.breachLines.bang2); }
        if (this.chopped && this.charge) this.canInHand();   // (still in the fist through the chop, until it flies below)
        if (isNaN(this.tFlung) && (an.kickImpact || an.kickTime >= KICK_IMPACT || !an.kicking)) {
          this.tFlung = t;
          const onIt = flat(c.pos, P.kickFrom) < 0.4 && Math.abs(wrapAngle(c.bodyYaw - P.kickFace)) < 0.35;
          if (Math.abs(d.angle) < 1.4) { d.latched = false; d.closing = false; d.vel = onIt ? P.fling : P.fling * 0.32; d.sinceBash = onIt ? 0 : d.sinceBash; d.quietT = -0.5; d.creakArmed = false; }
          d.lastWho = c.id;
          if (onIt && !d.off) { g.audio.play('doorBash', d.pos, 1.0, { rate: 0.9 }); kickDustFx(g, d, c.pos); }   // (+ the plaster and splinters off the jamb: GPU particles, nothing with them off)
          if (this.live?.loudBoot && !d.off) g.events.push({ kind: 'kick', pos: [d.pos[0], 0, d.pos[2]], time: g.time, loud: true, level: 1.0, who: c.id });   // live: the men inside HEAR the door go in (doors.ts kickIn's event; the show's boot never raised one — its men were puppets)
          this.say(a, 'in1', P.lines.in1); this.beat(onIt ? 'door-flung' : 'door-pushed');
          this.route(a, this.wpA, [P.retreat.mark], { speed: 1.9, face: P.retreat.face, strafe: true, stance: 'highReady', upper: 'none', aimAt: this.inside(1.2, 1.1) }); aIn = false;   // (the runner moves a kicking man too: the planted foot is the animator's, the root steps back under it)
          this.beat('retreat');
        }
        if (!this.charge && !isNaN(this.tFlung) && t >= this.tFlung + TOSS_AFTER_IMPACT) {   // live, no charge: muzzles onto the opening and in (the 'enter' beat's own GO_AFTER_BANG is all the pause there is)
          this.tBang = t; this.beat('nobang');
          this.muzzlesOnDoor();
          this.phase = 'enter'; break;
        }
        if (!isNaN(this.tFlung) && !this.can && t >= this.tFlung + TOSS_AFTER_IMPACT) {   // the leaf's latch edge is a hand clear: the can leaves the support hand round the jamb for the open floor north of the table
          const hand = b.char.jointUnder('handL') ?? v3.add(b.char.pos, [0, 1.3, 0]);
          const from: Vec3 = [hand[0], Math.max(1.0, hand[1]), hand[2]];
          const sol = g.items.solve(from, P.toss.land, 9);
          const it = this.can = g.items.spawn('flash', from, sol.v0, { fuse: 99, who: b.char.id, heading: v3.yawOf(sol.v0) });   // (fuse 99: it goes off on OUR cue below, not the item's — see bang)
          it.onBounce = (sp, p, g) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
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
          try { detonateStun(g, it, false, { side: 'operative' }); } finally { g.guards = all; }   // (the thrower is off the list: the can is the team's own to the player — samstun.ts)
          this.beat('bang');
          // the men inside reel: muzzles drop to the floor at their feet, the middle one gives half a step (they are dazed for seconds — long after it matters)
          if (!this.live) this.hostiles.forEach((h, i) => { if (h.state === 'dead') return; const c = h.char, f = c.forward(); order(h, { aimAt: [c.pos[0] + f[0] * 1.2, 0.1, c.pos[2] + f[2] * 1.2], upper: 'aim', stance: 'none' }); if (i === 0) order(h, { goal: [c.pos[0] + 0.35, 0, c.pos[2] - 0.3], strafe: true, face: c.bodyYaw, speed: 0.9 }); });
          this.muzzlesOnDoor();
          this.phase = 'enter';
        }
        break;
      }
      case 'enter': {   // GO_AFTER_BANG later #1 goes, TWO_AFTER_ONE after him #2 (each man's flow below); the exchange is staged on top of the flows
        if (isNaN(this.tEnter)) {
          if (t < this.tBang + GO_AFTER_BANG) break;
          this.tEnter = t; if (a.state !== 'dead') a.state = 'search'; if (b.state !== 'dead') b.state = 'search';   // (hunting now: lasers on, cutting the room's haze)
          this.say(a, 'going1', P.breachLines.going1); this.beat('enter1');
          if (a.state !== 'dead') this.startFlow(0);
        }
        const te = t - this.tEnter;
        if (this.flows[1].st === 'wait' && b.state !== 'dead' && te >= TWO_AFTER_ONE && (inBounds(a.char.pos, P.bounds) || te > 2.5 || a.state === 'dead')) { this.beat('enter2'); this.startFlow(1); }   // on his heels — but never treading on them: #1 is through the frame (inside the room's bounds) before #2 starts for it
        this.tickFlow(0, dt); this.tickFlow(1, dt); const clear = this.roomClear(te);
        aIn = bIn = false;   // (the flows route the men themselves)
        if (clear) { this.phase = 'clear'; this.tClear = t; this.beat('clear'); }
        break;
      }
      case 'clear': {   // #1 calls the room; a beat, then the word for the next door and both close on it — #2 (nearest, and holding it already) onto the jamb as the new point, #1 tucking in behind — guns at the high port on the shut leaf
        const tc = t - this.tClear;
        this.tickHold(0, dt); this.tickHold(1, dt);
        if (tc > 0.3) this.say(a.state !== 'dead' ? a : b, 'roomClear1', P.breachLines.roomClear1);
        if (this.live) { if (tc >= 1.0) { this.tDone = t; this.phase = 'done'; this.beat('done'); } break; }   // live: the room is theirs and they hold it where they stand — the next door is Sam's to call (no restack, no cut)
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
        if (isNaN(this.tStacked2) && ((aIn && bIn) || tn > RESTACK_CAP)) { this.tStacked2 = t; this.beat(aIn && bIn ? 'stack2' : 'stack2-late'); if (bIn) b.char.anim.signal('squeeze'); }
        if (!isNaN(this.tStacked2) && t >= this.tStacked2 + RESTACK_HOLD && isNaN(this.tDone)) { this.tDone = t; this.phase = 'done'; this.beat('cut'); this.beat('done'); }
        break;
      }
      // ('done' returned above)
    }
  }
  /** LIVE: what a man down means, asked every frame before anything else. Both down = the breach has failed where it stands ('wiped'); the point man down with the
   *  leaf still shut = nobody is left to open it ('abort', #2 holds the stack); anything else = the drill goes on with whoever is up — true when it has ended. */
  private casualties(t: number): boolean {
    if (this.phase === 'done') return false;
    const aDown = this.a.state === 'dead', bDown = this.b.state === 'dead';
    if (!aDown && !bDown) return false;
    for (const [gd, key] of [[this.a, 'a'], [this.b, 'b']] as const) if (gd.state === 'dead' && this.once('opdown:' + key)) this.beat(`opdown:${key === 'a' ? 1 : 2}`);
    const why = aDown && bDown ? 'wiped' : aDown && isNaN(this.tFlung) ? 'abort' : null;
    if (why) {
      this.phase = 'done'; this.tDone = t; this.beat(why);
      // a stun can already out of #2's hand flies on the long fuse this drill fires it from ('bang' above) — and the drill has just ended: left alone it would lie
      // live for a minute and a half. It goes back to an ordinary can's short fuse from where it lands (combat.ts updateItems), on whoever is looking at it.
      if (this.can && !this.can.fired) { this.can.fuse = Math.min(this.can.fuse, FUSE_AFTER_LAND); this.beat('can:short-fuse'); }
      return true;
    }
    return false;
  }
  /** heads back on the door: #1's muzzle up on the opening he is about to take, #2's over him (after the bang — or, live with no charge, straight off the boot) */
  private muzzlesOnDoor() {
    const setV = (o: Vec3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; };
    const pa = this.inside(1.5, 1.1), pb = this.inside(1.0, 1.5, 0.3);
    setV(this.aimA, pa[0], pa[1], pa[2]); if (this.a.state !== 'dead') order(this.a, { aimAt: this.aimA });
    setV(this.aimB, pb[0], pb[1], pb[2]); if (this.b.state !== 'dead') order(this.b, { aimAt: this.aimB });
  }
  /** a point `d` metres through the doorway into the room at height `y`, `s` along the wall (the plan's inward normal; absent = +x — the break room's west door,
   *  for which these are the numbers the three call sites always wrote out) */
  private inside(d: number, y: number, s = 0): Vec3 {
    const fc = this.door!.frameCentre, n = this.plan.inward ?? [1, 0];
    return [fc[0] + n[0] * d + n[1] * s, y, fc[2] + n[1] * d - n[0] * s];
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
    if (this.live?.lights) order(gd, { light: true });   // live: weapon lights on as he takes the frame (the show's pair run dark in daylight)
    F.sweep.start(F.aim, [fl.centre[0]], this.t, 0.9);   // the muzzle comes round onto the near end of the centre check as he takes the frame
  }
  private tickFlow(i: 0 | 1, dt: number) {
    const F = this.flows[i]; if (F.st === 'wait') return;
    const fl = this.flowOf(i), gd = i === 0 ? this.a : this.b, wps = i === 0 ? this.wpA : this.wpB, t = this.t;
    if (gd.state === 'dead') return;   // (live play only: a man down has no flow)
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
    const own = !!this.live && this.g.fight.on;   // (the room fight: a defender who has got OUT of the room is not in it — the room is called on the men left inside)
    const H = this.hostiles, allDown = H.every(h => h.state === 'dead' || runnerFled(h) || (own && !this.insideRoom(h.char.pos, -0.3)));
    const up = (i: 0 | 1) => (i === 0 ? this.a : this.b).state !== 'dead';
    const holding = this.live ? (!up(0) || this.flows[0].st === 'hold') && (!up(1) || this.flows[1].st === 'hold') : this.flows[0].st === 'hold' && this.flows[1].st === 'hold';
    if (holding && allDown) { if (isNaN(this.tAllDone)) this.tAllDone = this.t; return this.t > this.tAllDone + 0.5; }
    if (this.live) return false;   // live: nobody calls a room with a man still up in it, whatever the clock says
    if (te > 14) { H.forEach((h, k) => { if (h.state !== 'dead' && this.guaranteeDowns && !runnerFled(h)) { this.beat(`guaranteed:${k}`); killGuard(this.g, h, [1, 0, 0], false, 'shot', 'guard', 'hostile down'); } }); return true; }
    return false;
  }
  private tAllDone = NaN;
  /** is the front of man i's list a living man he has a line to (eye to chest, statics and leaves)? — dead men are dropped off the front as a side effect */
  private pickable(i: 0 | 1): boolean {
    if (this.live && this.g.fight.on) return this.g.fight.contact(i === 0 ? this.a : this.b);   // live, the room fight on: what HE has in his sight (light, smoke, cone — roomfight.ts), not a list
    const F = this.flows[i], H = this.hostiles, c = (i === 0 ? this.a : this.b).char;
    while (F.q.length && (H[F.q[0]]?.state === 'dead' || (!!H[F.q[0]] && runnerFled(H[F.q[0]])))) F.q.shift();
    const eye = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
    if (this.live) {   // live: any living man inside he has a line to is his to take — his own list's first, then anybody (his mate may be down, the plan's lists were written for puppets): the one found goes to the front
      const seen = (k: number) => { const hk = H[k]; return !!hk && hk.state !== 'dead' && !runnerFled(hk) && !this.g.col.shotBlocked(eye, hk.char.bones.chest ?? v3.add(hk.char.pos, [0, 1.1, 0]), 0.02, shotEnergy(this.g, c)); };
      const k = [...F.q, ...H.map((_, j) => j).filter(j => !F.q.includes(j))].find(seen);
      if (k === undefined) return false;
      F.q = [k, ...F.q.filter(j => j !== k)]; return true;
    }
    if (!F.q.length) return false;
    const h = H[F.q[0]]; const chest = h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    return !this.g.col.segmentBlocked(eye, chest);
  }

  /** The exchange as staged: man i works through his list for this leg of his flow — the first living man on it he has a line
   *  to gets the muzzle (his sweep waits), SETTLE later the first round of a controlled pair, PAIR later the second. The rounds fly true at the chest and, the cast
   *  having sides, FIND him (combat.ts fireWeapon → killGuard by the operative's hand): he goes down to the hit, his rifle leaving his hands. Should both rounds
   *  of the pair have found furniture instead he is dropped on the second regardless (killGuard, on nobody's card) so the beat holds. SHIFT later the next man.
   *  Returns true while his muzzle is on somebody. */
  private stagedExchange(i: 0 | 1, dt: number): boolean {
    const g = this.g, H = this.hostiles, F = this.flows[i], op = i === 0 ? this.a : this.b, c = op.char, t = this.t;
    if (this.live && g.fight.on) return g.fight.engaged(op);   // live, the room fight on (roomfight.ts): nothing is staged — each man shoots at what he sees when he has it, and this only tells the sweep to wait
    if (F.st === 'wait' || op.state === 'dead') return false;
    if (F.st === 'into' && !this.insideRoom(c.pos, FIRE_INSIDE_M)) return false;   // through the frame first — then the first man on his list who stands in his line gets the pair AS HE MOVES (08-13: no stop in the middle, no beat with the laser resting on a living man)
    if (F.on >= 0 && F.n === 0 && (H[F.on].state === 'dead' || runnerFled(H[F.on]))) { F.on = -1; F.next = t + SHIFT; }   // his man went before he fired (his mate's round across the room): the next one — but a pair begun is a pair finished, into the man as he falls
    if (F.on < 0 && t >= F.next && this.pickable(i)) { F.on = F.q[0]; F.since = t; F.n = 0; this.beat(`eyes${i + 1}:${F.on}`); }
    if (F.on < 0) return false;
    const h = H[F.on]; const chest = h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    F.aim[0] = damp(F.aim[0], chest[0], 16, dt); F.aim[1] = damp(F.aim[1], chest[1], 16, dt); F.aim[2] = damp(F.aim[2], chest[2], 16, dt);   // the muzzle snaps onto him (the script's aimAt IS this vector)
    const due = F.n === 0 ? F.since + SETTLE : F.next;
    if (this.live && t >= due && this.g.col.shotBlocked(c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]), chest, 0.02, shotEnergy(this.g, c, op.weapon.def))) { F.on = -1; F.next = t + 0.1; return false; }   // live: no round at a man he has lost his line to (he, or the man, moved behind something since the pick) — the muzzle comes off him and the next look is a tenth on
    if (t >= due && !op.weapon.reloading) {
      if (op.weapon.fire()) {
        const dir = v3.normalize(v3.sub(chest, c.muzzle));
        fireWeapon(g, c, chest, false, { steady: true, spread: 0.01 });
        F.n++; this.rounds[i]++; this.beat(`shot${i + 1}`);
        if (F.n >= 2) { if (h.state !== 'dead' && this.guaranteeDowns && !runnerFled(h)) { this.beat(`guaranteed:${F.on}`); killGuard(g, h, dir, false, 'shot', 'guard', 'hostile down'); } F.q = F.q.filter(k => k !== F.on); F.on = -1; F.next = t + SHIFT; }
        else F.next = t + PAIR;
      } else op.weapon.rearm();   // (cannot happen inside thirty rounds; a dry gun would stall the beat, so it is simply full again)
    }
    return true;
  }
}
