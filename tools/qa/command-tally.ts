// WHO COMMANDS BEST — the same floor played three ways by scripted players, counted side by side (the maintainer, 10-14: 'we should also make it so
// micromanaging > autopilot commanding > doing it yourself' · 'so there's incentive to go beyond just mashing b').
//   bun run tools/qa/command-tally.ts                                             every hand on every default level over seeds 1‥6, the table, a verdict
//   bun run tools/qa/command-tally.ts --hands solo,b,plan --scn room-clear-four,killhouse-four --seeds 1-8 --jobs 4 [--cap 240] [--hard] [--json out.json] [--md] [--quiet]
//   bun run tools/qa/command-tally.ts --trace plan:killhouse-four:3               one run in this process with its timeline (--one is the same for a worker: one `@@<json>` line)
//   --mortal                                                                      Sam goes down when his hits are spent, and the run ends there
//   CT_NOTOOLS=1  the plan hand picks no entry by hand (two doors only) · CT_ANYDOOR=1  it takes a second door over floor nobody has walked (both: env)
//   exit 0 = the order holds (the verdict, below) · 1 = it does not · 2 = a bad flag, nothing run
//
// THE STAND: the page as it opens (TPS_PROFILE=shipped is set here when the caller did not), so B is the autopilot (autopilot.ts) and X lays the plan
// (planlay.ts). Sam is seen through the CPU estimate of the light on him (rescue-tally.ts's stand-in) and shot at in every hand; by default he does
// not go DOWN (god mode, as the maintainer often plays) and every ROUND that hits him is counted instead (the caller of his flinch is combat.ts's
// samHit; a stagger, a dazzle or a blast plays the same flinch and is counted apart, as `blasts` — his own squad's cans among them, and so is a frag
// that would have killed him: god mode hides which). `lives` = how many times a mortal Sam would have gone down (player.hitsLeft rounds each, one
// on the page today; the two seconds after a down count nothing). A CLEAN floor = taken with no such down: what a player who can be hit calls a win.
// --mortal: he goes down, and the run ends there.
// THE THREE HANDS — test drivers only. What a hand TELLS the game goes through the real keys and the real cursor (W A S D, the left button, the use
// key on a locked door, B, T, X and its digits, F); what it tidies behind itself does not (it closes a menu it could not use and drops a plan it gave
// up on by the order book's own calls).
//   solo   the squad is never told anything (it stands where the mission put it). Sam takes every held room himself: to the door, through it, and to
//          each man in it (he shoots only a man the fog shows, on screen, on a clear line, `react` seconds after he shows — rescue-tally.ts's eyes).
//   b      B and nothing else. From the first step that has the held room's nearest door in the picture: the cursor on it and B (stack up) — the men
//          go first and he walks behind them to a spot beside the door's own wall (B on himself, fall in, only when the door is too far to point
//          at). When they stand on their marks B again (the squad picks its entry); a door found shut gets B again. Then he walks in behind them.
//   plan   the same walk, but the entry is his where he has one to give:
//          · TWO DOORS, ONE WORD where the room has a second door that is not locked, within 30 m on foot, reached over floor the team has already
//            stood on (cleared.ts — a pair is not sent alone through rooms nobody has been in) and both pairs have a man up: T to red, X on the near
//            door, the tools page, 'wait for my word', the entry (a stun while the squad has more than one, else open and clear) — laid; T to blue,
//            'open and clear' laid on the far door; F sends the plan, and F again when both pairs stand set is the one word.
//          · else A TOOL OF HIS OWN PICKING on B's stack: a frag while the squad has one (B never throws one), else the last stun (B keeps its last).
//          · else the b hand's B.
//   AFTER THE ROOMS every hand hunts whoever is left: solo walks to him; a commander falls in, walks until the man's floor is in the picture and gives
//   B on that floor. A commander whose squad is all down goes on ALONE, as the solo hand would (the game does not end the mission there either).
//   SAM'S RIFLE is the same in all three: he shoots whoever the picture shows him.
// WHAT IS COUNTED per level and hand: floors taken, CLEAN floors, floors the squad was wiped on, floors not taken in the time, teammates lost, Sam's
// would-be downs, and the clock (mean over the floors taken). And THE PAIRED ROOMS: the plan hand and the b hand are one script until the first room
// the plan hand sets out to take its own way, so that room is met in the same state by both; it is booked by what the hand SET OUT to do, whatever
// became of the try (a plan dropped under fire, a tool refused, the squad lost on the walk all stay in the table).
// THE VERDICT: a laid plan over B = at least as many clean floors AND fewer men lost a floor; B over solo = more clean floors.
// WHAT IT CANNOT SAY. No GPU: no light meter but the estimate, no smoke, no feel. A bot's hands are not a person's. Every hand knows which rooms are
// held and walks to the men left in them through the fog (all three alike; solo leans on it most); none knows how many are behind a door. It orders
// the three against each other on game logic; whether each is FUN is a call for a person at the keys.
process.env.TPS_PROFILE ??= 'shipped';
const { standUp, ROOT } = await import('./headless.ts');
const { readFileSync, existsSync, writeFileSync } = await import('node:fs');
const { resolve } = await import('node:path');
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { PLANLAY, PLANLAY_STATS } = await import(`${ROOT}/src/game/planlay.ts`);
const { AUTOPILOT, AUTOPILOT_STATS } = await import(`${ROOT}/src/game/autopilot.ts`);
const { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { PLAYER_ID, INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
/** CT_ANYDOOR=1 (env): the plan hand takes any second door within 30 m on foot, known floor or not (the first count: pairs were lost on the walk) */
const SAFE = process.env.CT_ANYDOOR !== '1';
/** CT_NOTOOLS=1 (env): the plan hand picks no entry by hand — two doors where it can, B everywhere else (the second count) */
const TOOLS = process.env.CT_NOTOOLS !== '1';
const DT = 1 / 60, HANDS = ['solo', 'b', 'plan'] as const;
type Hand = typeof HANDS[number];
const DEFAULT_SCN = ['room-clear-four', 'killhouse-four', 'depot-four'];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—'), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');

export interface RunOut {
  hand: Hand; scn: string; seed: number; hard: boolean;
  /** taken: no defender left · sam: Sam down (--mortal) · cap: out of time · error ('wiped' ended a run in counts from before 10-14 04:00Z: now `wiped` below) */
  end: 'taken' | 'sam' | 'wiped' | 'cap' | 'error'; why: string; t: number;
  /** every teammate went down on the way (the run went on: the floor is still Sam's to take alone) · the flinches that were no round (a stagger, a dazzle, a blast) */
  wiped?: boolean; blasts?: number;
  men: number; of: number; left: number; defenders: number;
  /** rounds that hit Sam · the times a mortal Sam would have gone down (0 on a floor taken = a CLEAN floor) · the older score, kept for old files */
  hits: number; lives: number; cost: number;
  /** key presses that gave something: B · orders laid in the menu · F (a plan sent, the word) · rooms taken by two doors on one word · rounds Sam fired */
  b: number; laid: number; f: number; twoDoor: number; rounds: number; trace: string[];
  /** entries the plan hand picked in the menu and gave (a frag, the last stun) */
  tools?: number;
  /** every held room he went for, in order: its door, how it was taken (b: the quick key · two: two doors on one word · solo · b*: a plan that could not be
   *  laid, then B), run seconds at the start and the end, teammates lost and defenders dropped meanwhile, the rounds that hit Sam */
  rooms: RoomOut[];
}
export interface RoomOut { door: string; mode: 'solo' | 'b' | 'two' | 'b*' | 'tool'; t0: number; t1: number; lost: number; killed: number; hits: number; home: number;
  /** of `lost`: the men lost BEFORE the entry was told to go (on the walk to the door, on the stack) — the rest fell going in or after */
  lostPre: number }
class Done extends Error { constructor(public end: RunOut['end'], public why = '') { super(why); } }

class Run {
  g: any; O: any; D: any; I: any; cam: any; t = 0; trace: string[] = [];
  /** where his feet go · where the cursor rests with nobody to shoot · he may fire · seconds from a man showing to the first round */
  goal: Vec3 | null = null; look: Vec3 | null = null; fight = false; react = 0.6;
  target: any = null; b = 0; laid = 0; f = 0; twoDoor = 0; rounds = 0; hits = 0; blasts = 0; tools = 0;
  /** the hits a mortal Sam has · hits since he last 'went down' · when that was · how often (a down = `per` hits; the two seconds after it count nothing: he is on the floor) */
  per = 1; private took = 0; private downT = -9; downs = 0;
  private seen = new Map<any, { first: number; last: number; need: number }>(); private dice: () => number; private vis = 0.05; private lastT: any = null; private lastTT = -9; private busy = 0; private evSeen = new Set<any>(); private dead = new Set<any>();
  constructor(public W: any, public hand: Hand, seed: number, public cap: number, public verbose: boolean) { this.g = W.game; this.O = this.g.orders; this.D = this.g.doorTools; this.I = W.input; this.cam = W.cam; this.dice = seeded(0xb07 + seed * 131); this.fight = true;
    const a = this.g.player.char.anim, hf = a.hitFrom.bind(a); a.hitFrom = (d: unknown) => { const by = (new Error().stack ?? '').split('\n').slice(1).find(l => !/command-tally/.test(l)) ?? ''; if (!/[\\/]combat\.ts/.test(by)) { this.blasts++; return hf(d); }   // (the same flinch is played for a stagger, a dazzle and a blast — samstun.ts, frag.ts, wallcharge.ts: his own squad's cans among them. Only combat.ts's samHit is a round)
      this.hits++; if (this.t - this.downT > 2 && ++this.took >= this.per) { this.took = 0; this.downT = this.t; this.downs++; if (this.verbose) this.say(`   Sam would be DOWN here (${this.downs}) at ${at(this.pos)}`); } return hf(d); }; }   // (a bystander: combat.ts samHit calls it for every round that lands on him, god mode or not)
  say(s: string) { const line = `${f1(this.t).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }
  get pos(): Vec3 { return this.g.player.char.pos; }
  get team(): any[] { return this.O.squad(); }
  get up(): any[] { return this.team.filter((x: any) => x.state !== 'dead'); }
  get hostiles(): any[] { return this.g.guards.filter((x: any) => x.team === 'hostile'); }
  get left(): any[] { return this.hostiles.filter((h: any) => h.state !== 'dead'); }
  private chest(x: any): Vec3 { return x.char.bones.chest ?? [x.char.pos[0], 1.2, x.char.pos[2]]; }
  private screen(p: Vec3): [number, number, boolean] { const cv = this.W.canvas; const [sx, sy, front] = this.cam.project(p, cv.clientWidth, cv.clientHeight); return [sx, sy, front && sx > 30 && sx < cv.clientWidth - 30 && sy > 30 && sy < cv.clientHeight - 30]; }
  onScreen(p: Vec3): boolean { return this.screen(p)[2]; }

  // ── Sam's hands, once a frame (rescue-tally.ts Run.input, less its hostages) ──
  private input() {
    const g = this.g, pl = g.player, c = pl.char, I = this.I;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
    I.buttons &= ~1; this.target = null;
    if (pl.down) return;
    if (this.fight) {
      const eye: Vec3 = [c.pos[0], 1.45, c.pos[2]]; let best: any = null, bd = 1e9;
      for (const h of this.hostiles) {
        if (h.state === 'dead') { this.seen.delete(h); continue; }
        const ch = this.chest(h), d = flat(c.pos, h.char.pos);
        if (g.fogOfWar.hidden(h) || !this.onScreen(ch) || g.col.shotBlocked(eye, ch)) continue;
        let s = this.seen.get(h); if (!s || this.t - s.last > 1) { s = { first: this.t, last: this.t, need: this.react * (0.75 + 0.5 * this.dice()) }; this.seen.set(h, s); } else s.last = this.t;
        if (this.t - s.first >= s.need && d < bd) { bd = d; best = h; }
      }
      if (best && best !== this.lastT && this.t - this.lastTT < 0.5) this.busy = this.t + this.react / 2;
      if (best) { this.lastT = best; this.lastTT = this.t; } if (this.t < this.busy) best = null;
      this.target = best;
    }
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
    if (look) { const cv = this.W.canvas; const [sx, sy, front] = this.cam.project(look, cv.clientWidth, cv.clientHeight); if (front) { I.mouseX = clamp(sx, 10, cv.clientWidth - 10); I.mouseY = clamp(sy, 10, cv.clientHeight - 10); } }
    if (this.target && g.aimGuard === this.target && !pl.sprinting) I.clicked |= 1;
    if (this.fight && pl.rifle && pl.rifle.roundsReady === 0 && !pl.rifle.reloading) I.pressed.add('KeyR');
  }
  private meter() {
    const g = this.g, pl = g.player, c = pl.char;
    const E = Math.max(lightEstimateAt(g, c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]]), lightEstimateAt(g, c.bones.head ?? [c.pos[0], 1.6, c.pos[2]]));
    this.vis += (g.visibilityOf(E) - this.vis) * (1 - Math.exp(-6 * DT)); pl.irradiance = E; pl.visibility = this.vis;
  }
  step(n = 1) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      this.input(); this.meter(); this.W.step(DT); this.t += DT;
      for (const e of g.events) { if (this.evSeen.has(e)) continue; this.evSeen.add(e); if (e.kind === 'shot' && e.who === PLAYER_ID) this.rounds++; }
      if (this.evSeen.size > 4000) this.evSeen = new Set(g.events);
      if (g.player.down) { const by = g.chronicle?.counts?.downBy ?? '?', k = this.hostiles.find((h: any) => h.callsign === by); this.say(`Sam DOWN at ${at(this.pos)} by ${by}${k ? ` from ${at(k.char.pos)}, ${flat(k.char.pos, this.pos).toFixed(1)} m` : ''} · his light ${this.vis.toFixed(2)}`); throw new Done('sam', `Sam down by ${by}`); }
      if (g.roomClear.end === 'taken' || !this.left.length) throw new Done('taken', g.roomClear.endWhy ?? '');
      if (this.verbose) for (const x of g.guards) if (x.state === 'dead' && !this.dead.has(x)) { this.dead.add(x); const k = x.killerId > 0 ? (x.killerId === PLAYER_ID ? 'Sam' : g.guards.find((q: any) => q.char.id === x.killerId)?.callsign ?? `#${x.killerId}`) : '?'; this.say(`   ${x.team === 'hostile' ? 'down' : 'LOST'} ${x.callsign} at ${at(x.char.pos)} by ${k}${x.team === 'hostile' ? '' : ` · his order ${this.O.of(x)?.order ?? '—'} · door order ${this.D.ops.find((o: any) => o.men?.includes(x))?.phase ?? '—'}`}`); }
      if (this.hand !== 'solo' && !this.up.length && this.wipedT < 0) { this.wipedT = this.t; this.say('every teammate is down: the rest is his, alone'); }
      if (this.t >= this.cap) throw new Done('cap', 'out of time');
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }
  key(code: string) { this.I.pressed.add(code); this.step(); }

  // ── Sam's feet ──
  free(p: number[]): Vec3 | null { const nav = this.g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; }
  pathLen(a: number[], b: number[]): number { const path = this.g.col.nav.findPath(a, b); if (!path) return Infinity; let L = 0, q = a; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, b); }
  /** walk to `p` along the nav grid's path; false: stopped early (`until`, `max` seconds, or not getting anywhere after three fresh paths) */
  go(p: number[], max = 40, until?: () => boolean, again = 0): boolean {
    const path: Vec3[] = this.g.col.nav.findPath(this.pos, p) ?? [[p[0], 0, p[2]]]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push([p[0], 0, p[2]]);
    const t0 = this.t; let mark = [...this.pos], markT = this.t;
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.3 : 0.6)) {
        this.step(); if (until?.() || this.t - t0 > max) { this.goal = null; return false; }
        if (flat(this.pos, mark) > 0.25 || this.target) { mark = [...this.pos]; markT = this.t; }
        else if (this.t - markT > 1.2) {   // not getting anywhere (a mate in a doorway, a chair, the tip of a leaf): a step to one side, then the other, and a fresh path
          if (again >= 8) { this.goal = null; return false; }
          const dx = wp[0] - this.pos[0], dz = wp[2] - this.pos[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, k = 0.9 + 0.3 * (again >> 1);
          this.goal = [this.pos[0] - dz / L * sd * k - dx / L * 0.3, 0, this.pos[2] + dx / L * sd * k - dz / L * 0.3]; for (let i = 0; i < 36; i++) { this.step(); if (until?.()) { this.goal = null; return false; } }
          return this.go(p, max - (this.t - t0), until, again + 1); }
      }
    }
    this.goal = null; return true;
  }

  // ── the floor ──
  held(): { room: any; men: any[] }[] {
    const by = new Map<any, any[]>();
    for (const d of this.g.fight.defs) { if (!d.room || !d.room.entries.length || d.room.cells.size > 500 || d.gd.state === 'dead') continue; by.set(d.room, [...(by.get(d.room) ?? []), d.gd]); }
    return [...by].map(([room, men]) => ({ room, men }));
  }
  outPt(ent: any, back: number, lat: number): Vec3 { const ox = ent.out[0], oz = ent.out[1]; return [ent.at[0] + ox * back - oz * lat, 0, ent.at[2] + oz * back + ox * lat]; }
  /** where a player stands to work a door: a few metres from it on its own side, off its line where the floor allows (playthrough.ts workDoor's post) */
  post(ent: any): Vec3 {
    const g = this.g, gate = this.outPt(ent, 0.7, 0), clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
    let post: Vec3 | null = null, postL = Infinity;
    // … beside the door's own wall, a few metres along it, where nobody in the room has a line to him through the opening (a commander who can be hit stands there)
    const innPt = this.outPt(ent, -1.5, 0), hidden = (p: number[]) => g.col.solidBlocked([p[0], 1.1, p[2]], [innPt[0], 1.1, innPt[2]]) && g.col.solidBlocked([p[0], 1.1, p[2]], [this.outPt(ent, -3, 1)[0], 1.1, this.outPt(ent, -3, 1)[2]]) && g.col.solidBlocked([p[0], 1.1, p[2]], [this.outPt(ent, -3, -1)[0], 1.1, this.outPt(ent, -3, -1)[2]]);
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
  inside(ent: any): Vec3 | null { for (const b of [2.5, 2.0, 1.5]) { const p = this.outPt(ent, -b, 0); if (!this.g.col.nav.isBlocked(p[0], p[2])) return p; } return null; }
  /** the cursor on that door, as the keys read it (false: the door is not in the picture, or something else is under the cursor) */
  cursorOn(d: any): boolean {
    for (const y of [1.0, 0.1, 1.8]) { const p: Vec3 = [d.frameCentre[0], y, d.frameCentre[2]]; if (!this.onScreen(p)) continue; this.look = p; this.step(2);
      const t = this.O.targetUnder(this.I, this.cam, this.W.canvas); if (t?.kind === 'door' && t.door === d) return true;
      if (this.verbose) this.say(`   (cursor at y ${y} on ${d.def.name}: under it ${t?.kind}${t?.kind === 'door' ? ' ' + t.door.def.name : ''} · Sam ${at(this.pos)} door ${at(d.frameCentre)} angle ${d.angle.toFixed(2)})`); }
    if (this.verbose) this.say(`   (${d.def.name} ${at(d.frameCentre)} is not in the picture from ${at(this.pos)})`);
    return false;
  }
  sees(d: any): boolean { return [1.0, 0.1, 1.8].some(y => this.onScreen([d.frameCentre[0], y, d.frameCentre[2]])); }
  opsOn(d: any): any[] { return this.D.ops.filter((o: any) => o.door === d); }

  // ── solo: Sam's own rifle ──
  soloRoom(h: { room: any; men: any[] }, ent: any) {
    const d = ent.door, name = d.def.name; this.say(`→ ${name} himself (${h.men.length} at home)`);
    const front = this.free(this.outPt(ent, 0.9, 0)) ?? this.outPt(ent, 0.9, 0);
    this.go(front, 60);
    if (d.locked && !d.lockBroken && Math.abs(d.angle) < 0.3) {   // his own boot (the Space row), as a player alone at a locked door
      if (this.until(() => this.g.selectVerb('door', 'kick'), 0.8)) { this.I.pressed.add(INTERACT_KEY); this.say(`boots ${name}`); this.until(() => d.lockBroken || Math.abs(d.angle) > 0.4, 2.5); } else this.say(`(no kick row on ${name})`);
    }
    const stillHeld = () => h.men.some((m: any) => m.state !== 'dead');
    const inn = this.inside(ent); if (inn) this.go(inn, 20, () => !stillHeld());
    // the room's men he has not found yet: to each, as a player sweeping the room would
    for (let k = 0; k < 4 && stillHeld(); k++) { const m = h.men.filter((x: any) => x.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, this.pos) - flat(b.char.pos, this.pos))[0]; this.go(m.char.pos, 8, () => m.state === 'dead' || (!!this.target)); this.until(() => !this.target, 6); this.wait(0.3); }
  }
  // ── b: the quick key ──
  pressB(d: any, why: string): boolean { if (!this.cursorOn(d)) { this.say(`(B · ${d.def.name}: the door is not under the cursor)`); return false; } const n = this.O.log.length; this.key(ORDERS.quickKey); this.b++; const row = this.O.log[this.O.log.length - 1]; this.say(`B · ${d.def.name} (${why}) → ${this.O.log.length > n ? row.order : 'nothing given'}`); this.look = null; return this.O.log.length > n; }
  /** B on himself: 'fall in' (the quick key's row on nothing) — the squad walks with him to the next door */
  /** the cursor on his own feet with no teammate under it: what B calls 'nothing' and T 'the next element' */
  onSelf(): boolean { for (const [ox, oz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) { this.look = [this.pos[0] + ox, 0.05, this.pos[2] + oz]; this.step(2); const t = this.O.targetUnder(this.I, this.cam, this.W.canvas); if (t?.kind === 'none' && !t.man) return true; } return false; }
  fallIn() { if (!this.up.length) return; if (!this.onSelf()) this.say('(B on himself: something else is under the cursor)'); const n = this.O.log.length; this.key(ORDERS.quickKey); this.b++; this.look = null; const row = this.O.log[this.O.log.length - 1]; this.say(`B · on himself → ${this.O.log.length > n ? row.order : 'nothing given'}`); }
  bRoom(h: { room: any; men: any[] }, ent: any) {
    const d = ent.door, name = d.def.name; this.say(`→ ${name} (${h.men.length} at home), from ${at(this.post(ent))}`);
    const stillHeld = () => h.men.some((m: any) => m.state !== 'dead'), post = this.post(ent);
    // the men go first: B on the door from the first step that has it in the picture, and he walks to his post behind them (B on himself — fall in — only
    // when the door is too far to point at: they walk with him until it shows)
    const sees = () => this.sees(d); let sent = false;
    if (!sees()) { this.fallIn(); this.wait(1); this.go(post, 60, sees); }
    for (let k = 0; k < 4 && !sent; k++) { sent = this.pressB(d, 'stack'); if (!sent) this.go(post, 2); }
    this.wait(2.5); if (!this.go(post, 60)) this.say(`(Sam did not reach his post: at ${at(this.pos)})`);
    if (!sent) this.pressB(d, 'stack');
    this.until(() => this.up.every((m: any) => this.O.of(m)?.arrived), 25);
    for (let k = 0; k < 4 && stillHeld() && this.up.length; k++) {
      if (!k) this.upAtGo = this.up.length;
      if (!this.pressB(d, k ? 'again' : 'go in')) { this.wait(1); continue; }
      this.until(() => this.opsOn(d).length > 0, 3); this.until(() => !this.opsOn(d).length, 70); this.wait(1.5);
    }
    this.walkIn(ent);
  }
  /** an entry picked in the menu and GIVEN (the wait row off): X on the door, the tools page, the row's own key (false: not listed, greyed, or refused) */
  giveTool(d: any, id: string): boolean {
    const O = this.O; if (!this.cursorOn(d)) return false;
    if (O.menu) this.key(ORDERS.key); this.key(ORDERS.key); let M = O.menu; if (!M || M.target.kind !== 'door') return false;
    const pg = M.rows.find((r: any) => !!r.opens && O.rowsFor(M.target, r.opens, M.men).some((x: any) => x.id === id)); if (pg?.key) this.key(`Digit${pg.key}`); M = O.menu;
    if (M?.onWord) { const k = O.waitDigit(M); this.key(k ? `Digit${k}` : ORDERS.waitAlt); M = O.menu; }
    const i = M ? M.rows.findIndex((r: any) => r.id === id) : -1, row = i >= 0 ? M.rows[i] : null, n = O.log.length;
    if (!row || M.why[i] || M.onWord || !(row.key || row.hotKey)) { if (this.verbose) this.say(`   (X · ${d.def.name} · ${id}: ${!row ? 'not listed' : M.why[i] ?? 'no key'})`); O.close(); this.look = null; return false; }
    this.key(row.key ? `Digit${row.key}` : row.hotKey); if (O.menu) O.close(); this.look = null;
    const ok = O.log.length > n && O.log[O.log.length - 1].order === id; this.say(`X · ${d.def.name} → ${ok ? id : `${id} NOT GIVEN`}`); return ok;
  }
  /** THE TOOL PICKED BY HAND where B would pick for him, from the belt alone (never the head count behind the door, which no player has): a frag while the
   *  squad has one (B never throws one; the row is refused where a hostage or a mate is behind the door, and the entry is then B's), else the last
   *  stun (B keeps its last for a room it knows is held — this hand only ever walks to held rooms), else B. The stack is B's, as in the b hand. */
  toolRoom(h: { room: any; men: any[] }, ent: any): boolean {
    const d = ent.door, home = h.men.filter((m: any) => m.state !== 'dead').length, id = this.D.frags > 0 ? 'fragClear' : this.D.bangs === 1 ? 'bangClear' : '';
    if (!id) return false;
    this.doing = 'tool';
    this.say(`→ ${d.def.name} (${home} at home) with ${id}, from ${at(this.post(ent))}`);
    const stillHeld = () => h.men.some((m: any) => m.state !== 'dead'), post = this.post(ent), sees = () => this.sees(d); let sent = false;
    if (!sees()) { this.fallIn(); this.wait(1); this.go(post, 60, sees); }
    for (let k = 0; k < 4 && !sent; k++) { sent = this.pressB(d, 'stack'); if (!sent) this.go(post, 2); }
    this.wait(2.5); this.go(post, 60); if (!sent) this.pressB(d, 'stack');
    this.until(() => this.up.every((m: any) => this.O.of(m)?.arrived), 25);
    this.upAtGo = this.up.length; let given = stillHeld() && this.giveTool(d, id); if (given) this.tools++;
    for (let k = 0; k < 4 && stillHeld() && this.up.length; k++) {
      if (!given && !this.pressB(d, k ? 'again' : 'go in')) { this.wait(1); continue; }
      given = false; this.until(() => this.opsOn(d).length > 0, 3); this.until(() => !this.opsOn(d).length, 70); this.wait(1.5);
    }
    this.walkIn(ent); return true;
  }
  walkIn(ent: any) { this.wait(1); const inn = this.inside(ent); if (inn) this.go(inn, 25); this.wait(1); }
  // ── plan: two doors, one word ──
  who(want: string): boolean { this.onSelf(); for (let i = 0; i < 6 && this.O.who !== want; i++) this.key(ORDERS.whoKey); this.look = null; if (this.O.who !== want) this.say(`(T: the orders go to ${this.O.who}, not ${want})`); return this.O.who === want; }
  /** one door tool laid for the element now addressed: X on the door, the tools page, 'wait for my word', the entry's digit */
  lay(d: any, want = 'bangClear'): boolean {
    const O = this.O; if (!this.cursorOn(d)) { this.say(`(X · ${d.def.name}: the door is not under the cursor)`); return false; }
    if (O.menu) this.key(ORDERS.key); this.key(ORDERS.key); let M = O.menu; if (!M || M.target.kind !== 'door') { this.say(`(X · ${d.def.name}: no door menu)`); return false; }
    const tool = want === 'bangClear' && this.D.bangs > 1 ? 'bangClear' : 'openClear', has = (id: string) => (r: any) => !!r.opens && O.rowsFor(M.target, r.opens, M.men).some((x: any) => x.id === id);
    const pg = M.rows.find(has(tool)) ?? M.rows.find(has('openClear')); if (pg?.key) this.key(`Digit${pg.key}`); M = O.menu;
    if (!M?.wordRow) { this.say(`(X · ${d.def.name}: no 'wait for my word' row)`); O.close(); return false; }
    if (!M.onWord) { const k = O.waitDigit(M); this.key(k ? `Digit${k}` : ORDERS.waitAlt); M = O.menu; }
    const row = M?.rows.find((r: any) => r.id === tool) ?? M?.rows.find((r: any) => r.id === 'openClear'), n = O.lay.laid.length;
    if (!M?.onWord || !row?.key) { this.say(`(X · ${d.def.name}: the entry is not on a digit)`); O.close(); return false; }
    const why = M.why[M.rows.indexOf(row)], n0 = O.log.length; this.key(`Digit${row.key}`); if (O.menu) O.close(); this.look = null;
    if (this.verbose && !O.lay.laid.length) this.say(`   (row ${row.id} on ${row.key} · why-not ${JSON.stringify(why)} · order book ${n0} → ${O.log.length} · said: ${JSON.stringify(O.msg ?? O.hud?.().msg ?? null)})`);
    const ok = O.lay.laid.some((o: any) => o.door === this.g.doors.list.indexOf(d) && o.id === row.id); if (ok) this.laid++;
    this.say(`laid · ${O.who} · ${row.id} · ${d.def.name}${ok ? '' : ` — NOT LAID (${n} → ${O.lay.laid.length})`}`); return ok;
  }
  planRoom(h: { room: any; men: any[] }, ents: any[]): boolean {
    const O = this.O, [A, B] = ents, da = A.door, db = B.door; this.say(`→ ${da.def.name} + ${db.def.name} on one word (${h.men.length} at home)`);
    const stillHeld = () => h.men.some((m: any) => m.state !== 'dead');
    // the near door from his post on it; the other from the first step of the walk toward it that has it in the picture (he does not walk past a held room to point at a door)
    const drop = () => { this.who('all'); O.lay.laid.length = 0; return false; };
    const seesA = () => this.sees(da), seesB = () => this.sees(db), postA = this.post(A);
    if (!seesA()) { this.fallIn(); this.wait(1); this.go(postA, 60, seesA); }
    if (!this.who('red')) return drop();
    let ok = false; for (let k = 0; k < 4 && !ok; k++) { ok = this.lay(da); if (!ok) this.go(postA, 2); } if (!ok) return drop();
    if (!this.who('blue')) return drop();
    ok = false; for (let k = 0; k < 3 && !ok; k++) { if (!seesB()) this.go(this.post(B), 12, seesB); else if (k) this.go(this.post(B), 1.5); ok = this.lay(db, 'openClear'); }   // (one can for the room: the far pair opens its door on the same word, after the bang's burst)
    if (!ok) return drop();
    this.who('all'); this.key(ORDERS.waitAlt); this.f++; this.say(`F · the plan is sent (${PLANLAY_STATS.sent} sent so far)`);
    this.wait(2.5); this.go(postA, 60);   // (behind his men, to where he would stand for the near door)
    const set = () => [da, db].every(d => this.opsOn(d).some((o: any) => o.phase === 'ready'));   // (both pairs on their marks, the tool waiting on the word)
    if (!this.until(set, 40)) this.say('(not every pair stood set in 40 s: the word all the same)');
    const ph = [da, db].map(d => this.opsOn(d).map((o: any) => o.phase).join('/') || 'no order').join(' · ');
    this.upAtGo = this.up.length; this.key(ORDERS.waitAlt); this.f++; this.twoDoor++; this.say(`F · the word (${ph})`);
    this.until(() => !this.opsOn(da).length && !this.opsOn(db).length, 70); this.wait(1.5);
    for (let k = 0; k < 3 && stillHeld() && this.up.length; k++) { if (!this.pressB(da, 'again')) { this.wait(1); continue; } this.until(() => this.opsOn(da).length > 0, 3); this.until(() => !this.opsOn(da).length, 70); this.wait(1.5); }
    this.walkIn(A); return true;
  }

  rooms: RoomOut[] = []; private upAtGo = -1; wipedT = -1;
  /** how the room now being taken was MEANT to be taken (set where the hand commits to it; booked whatever becomes of the try) */
  private doing: RoomOut['mode'] = 'b';
  /** one room's entry, booked whatever ends it (the run's end included) */
  private room(door: string, home: number, fn: () => void) {
    const t0 = this.t, up0 = this.up.length, left0 = this.left.length, h0 = this.hits; let mode: RoomOut['mode'] = this.hand === 'solo' ? 'solo' : 'b';
    this.upAtGo = -1;
    this.doing = mode;
    try { fn(); mode = this.doing; } catch (e) { mode = this.doing; throw e; }
    finally { this.rooms.push({ door, mode, t0: +t0.toFixed(2), t1: +this.t.toFixed(2), lost: up0 - this.up.length, killed: left0 - this.left.length, hits: this.hits - h0, home, lostPre: up0 - (this.upAtGo < 0 ? this.up.length : this.upAtGo) }); }
  }
  play() {
    const tried = new Map<any, number>(); this.step(20);
    for (let round = 0; round < 24; round++) {
      const held = this.held().filter(h => (tried.get(h.room) ?? 0) < 3); if (!held.length) break;
      let best: { h: any; ent: any; L: number } | null = null;
      for (const h of held) for (const ent of h.room.entries) { const out = this.outPt(ent, 1.5, 0), L = this.pathLen(this.pos, this.free(out) ?? out); if (!best || L < best.L) best = { h, ent, L }; }
      if (!best || !Number.isFinite(best.L)) { this.say('no way on foot to any held room'); break; }
      tried.set(best.h.room, (tried.get(best.h.room) ?? 0) + 1);
      const B = best, name = B.ent.door.def.name, home = B.h.men.filter((m: any) => m.state !== 'dead').length;
      if (this.hand === 'solo' || !this.up.length) { this.room(name, home, () => { this.doing = 'solo'; this.soloRoom(B.h, B.ent); }); continue; }
      this.room(name, home, () => {
        if (this.hand === 'plan' && PLANLAY.on && this.O.big) {
          // a second door of the room he can walk to without crossing the room itself (its post is on foot from the first door's post, not much further than round the walls)
          const pa = this.post(B.ent), red = this.O.men('red').filter((m: any) => m.state !== 'dead'), blue = this.O.men('blue').filter((m: any) => m.state !== 'dead');
          // … and only by floor the team has stood on (cleared.ts: what the fog would show as walked): a pair is not sent alone through rooms nobody has been in
          const known = (a: number[], b: number[]) => { const way = this.g.col.nav.findPath(a, b) as Vec3[] | null; if (!way) return false; const pts = [a, ...way, b];
            for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], n = Math.max(1, Math.ceil(flat(p, q) / 0.5)); for (let k = 0; k <= n; k++) if (!this.g.cleared.knownAt([p[0] + (q[0] - p[0]) * k / n, 0, p[2] + (q[2] - p[2]) * k / n])) return false; }
            return true; };
          const others = B.h.room.entries.filter((e: any) => e !== B.ent && e.door !== B.ent.door && !(e.door.locked && !e.door.lockBroken)).map((e: any) => ({ e, L: this.pathLen(pa, this.post(e)) })).filter((x: any) => x.L < 30 && (SAFE ? known(this.pos, this.outPt(x.e, 1.0, 0)) : true)).sort((a: any, b: any) => a.L - b.L);
          if (others.length && red.length && blue.length) { this.doing = 'two'; if (!this.planRoom(B.h, [B.ent, others[0].e])) this.bRoom(B.h, B.ent); return; }
        }
        if (this.hand === 'plan' && TOOLS && this.toolRoom(B.h, B.ent)) return;
        this.bRoom(B.h, B.ent);
      });
    }
    // whoever is left is not at home
    for (let lap = 0; lap < 3; lap++) for (const h of this.left) {
      const hp = h.char.pos, way = this.g.col.nav.findPath(this.pos, hp) as Vec3[] | null; if (!way) continue;
      this.say(`hunt → ${h.callsign} ${at(hp)}`);
      if (this.hand === 'solo' || !this.up.length) { this.go(hp, 30, () => h.state === 'dead' || !!this.target); this.until(() => h.state === 'dead' || !this.target, 8); continue; }
      this.fallIn();
      const path: Vec3[] = [[this.pos[0], 0, this.pos[2]], ...way, [hp[0], 0, hp[2]]]; let back = 5, p: Vec3 | null = null;
      for (let i = path.length - 1; i > 0 && !p; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); p = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; } else back -= L; }
      if (p) this.go(this.free(p) ?? p, 40, () => h.state === 'dead' || (this.onScreen([h.char.pos[0], 0.05, h.char.pos[2]]) && this.pathLen(this.pos, h.char.pos) < 14));   // (… from where his floor first comes into the picture: a commander does not walk onto him)
      if (h.state !== 'dead' && this.up.length) { const now = h.char.pos; this.look = [now[0], 0.05, now[2]]; this.step(2); const n = this.O.log.length; this.key(ORDERS.quickKey); this.b++; this.say(`B · floor by ${h.callsign} → ${this.O.log.length > n ? this.O.log[this.O.log.length - 1].order : 'nothing given'}`); this.look = null; this.until(() => h.state === 'dead', 14); }
    }
    this.wait(15); throw new Done('cap', 'nothing left to try');
  }
}

const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync((f => existsSync(f) ? f : resolve(ROOT, 'levels', file))(resolve(ROOT, 'levels', lookLevelFile(file))), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };   // (playthrough.ts's)
export async function playOne(hand: Hand, scn: string, seed: number, cap: number, hard: boolean, verbose: boolean, mortal = false): Promise<RunOut> {
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E || E.kind !== 'roomclear' || E.squad !== 4) throw new Error(`'${scn}' is not a four-man room clear of scene/scenarioList.ts`);
  const out: RunOut = { hand, scn, seed, hard, end: 'error', why: '', t: 0, men: 0, of: 0, left: 0, defenders: 0, hits: 0, lives: 0, cost: 5, b: 0, laid: 0, f: 0, twoDoor: 0, rounds: 0, trace: [], rooms: [] };
  const log = console.log, err = console.error, warn = console.warn, rnd = Math.random; let R: Run | null = null;
  try {
    if (!verbose) console.log = console.error = console.warn = () => { };
    Math.random = seeded(0x9137 + seed * 7919);
    if (hard) setDifficulty('hard', false);
    const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }), g = W.game;
    g.godMode = !mortal;
    const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);
    const { why } = await startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`start refused — ${why}`);
    for (const k of Object.keys(PLANLAY_STATS)) (PLANLAY_STATS as any)[k] = 0; for (const k of Object.keys(AUTOPILOT_STATS)) (AUTOPILOT_STATS as any)[k] = 0;
    R = new Run(W, hand, seed, cap, verbose); R.per = Math.max(1, g.player.hitsLeft | 0); R.step(1); out.of = R.team.length; out.defenders = R.hostiles.length;
    if (verbose) { console.log = log; R.say(`${hand} · ${scn} · seed ${seed} · ${out.of} men · ${out.defenders} defenders · autopilot ${AUTOPILOT.on ? 'on' : 'OFF'} · plan ${PLANLAY.on ? 'on' : 'OFF'}${hard ? ' · hard' : ''}`); }
    try { R.play(); } catch (e) { if (!(e instanceof Done)) throw e; out.end = e.end; out.why = e.why; }
  } catch (e: any) { out.end = 'error'; out.why = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { console.log = log; console.error = err; console.warn = warn; Math.random = rnd; }
  if (R) { out.t = +R.t.toFixed(1); out.men = R.up.length; out.left = R.left.length; out.b = R.b; out.laid = R.laid; out.f = R.f; out.twoDoor = R.twoDoor; out.rounds = R.rounds; out.trace = R.trace; out.hits = R.hits; out.lives = R.downs; out.rooms = R.rooms; out.tools = R.tools; out.blasts = R.blasts; out.wiped = R.wipedT >= 0; }
  out.cost = +((out.of - out.men) + out.lives + (out.end === 'taken' ? 0 : 5)).toFixed(2);
  return out;
}

export function report(runs: RunOut[], md = false): { text: string; holds: boolean } {
  const scns = [...new Set(runs.map(r => r.scn))], hands = HANDS.filter(h => runs.some(r => r.hand === h)), L: string[] = [];
  const row = (cells: string[]) => (md ? `| ${cells.join(' | ')} |` : cells.map((c, i) => (i ? c.padStart(11) : c.padEnd(26))).join(' '));
  const head = ['level · hand', 'runs', 'taken', 'clean', 'wiped', 'cap', 'men lost', 'Sam downs', 'seconds'];
  const isClean = (r: RunOut) => r.end === 'taken' && r.lives === 0, isWiped = (r: RunOut) => r.end === 'wiped' || !!r.wiped;
  L.push(row(head)); if (md) L.push(row(head.map(() => '---')));
  const line = (name: string, all: RunOut[]) => { const rs = all.filter(r => r.end !== 'error'), won = rs.filter(r => r.end === 'taken');   // (a run that broke is in no mean: it is counted on the errors line)
    L.push(row([name, String(all.length), `${won.length}`, `${rs.filter(isClean).length}`, `${rs.filter(isWiped).length}`, `${rs.filter(r => r.end === 'cap' || r.end === 'sam').length}`, rs.length ? f2(mean(rs.map(r => r.of - r.men))) : '—', rs.length ? f2(mean(rs.map(r => r.lives))) : '—', won.length ? f1(mean(won.map(r => r.t))) : '—'])); };
  for (const s of scns) for (const h of hands) line(`${s} · ${h}`, runs.filter(r => r.scn === s && r.hand === h));
  for (const h of hands) line(`ALL · ${h}`, runs.filter(r => r.hand === h));
  const two = runs.filter(r => r.hand === 'plan'), n2 = two.reduce((a, r) => a + r.twoDoor, 0);
  L.push('', `plan: ${n2} two-door entries on one word in ${two.length} runs (${two.filter(r => r.twoDoor > 0).length} runs had one); errors: ${runs.filter(r => r.end === 'error').length}`);
  // THE PAIRED ROOMS: the b hand and the plan hand are one script until the first room the plan hand sets out to take its own way, so on one level and
  // seed that room was met in the same state by both — the one difference is how it was taken (booked by intent: see the header)
  for (const [want, label, what] of [['two', 'two doors, one word', "first room it set out to take by two doors"], ['tool', 'the entry picked by hand', "first room it set out to take with a tool of its own picking (a frag while there is one, else the last stun)"]] as const) {
    const pairs: { scn: string; seed: number; door: string; b: RoomOut; two: RoomOut }[] = [];
    for (const p of runs.filter(r => r.hand === 'plan')) { const q = runs.find(r => r.hand === 'b' && r.scn === p.scn && r.seed === p.seed && r.hard === p.hard); if (!q) continue;
      const i = p.rooms.findIndex(x => x.mode !== 'b'); if (i < 0 || p.rooms[i].mode !== want || !q.rooms[i] || q.rooms[i].door !== p.rooms[i].door || Math.abs(q.rooms[i].t0 - p.rooms[i].t0) > 0.05) continue;
      pairs.push({ scn: p.scn, seed: p.seed, door: p.rooms[i].door, b: q.rooms[i], two: p.rooms[i] }); }
    if (!pairs.length) continue;
    const sum = (f: (x: typeof pairs[number]) => number) => pairs.reduce((a, x) => a + f(x), 0), n = pairs.length;
    L.push('', `THE SAME ROOM, MET IN THE SAME STATE, TAKEN BOTH WAYS (${n} rooms: the plan hand's ${what} on a level and seed, against the b hand's entry there)`);
    L.push(row(['', 'rooms', 'men lost', 'per room', 'on the way', 'going in', 'defenders', 'seconds', 'Sam hit']));
    L.push(row(['B on one door', String(n), String(sum(x => x.b.lost)), f2(sum(x => x.b.lost) / n), String(sum(x => x.b.lostPre)), String(sum(x => x.b.lost - x.b.lostPre)), String(sum(x => x.b.killed)), f1(sum(x => x.b.t1 - x.b.t0) / n), String(sum(x => x.b.hits))]));
    L.push(row([label, String(n), String(sum(x => x.two.lost)), f2(sum(x => x.two.lost) / n), String(sum(x => x.two.lostPre)), String(sum(x => x.two.lost - x.two.lostPre)), String(sum(x => x.two.killed)), f1(sum(x => x.two.t1 - x.two.t0) / n), String(sum(x => x.two.hits))]));
    L.push(`  the plan lost fewer men in ${pairs.filter(x => x.two.lost < x.b.lost).length} rooms, more in ${pairs.filter(x => x.two.lost > x.b.lost).length}, the same in ${pairs.filter(x => x.two.lost === x.b.lost).length}`);
    for (const s of scns) { const ps = pairs.filter(x => x.scn === s); if (ps.length) L.push(`  ${s}: ${ps.length} rooms · B lost ${ps.reduce((a, x) => a + x.b.lost, 0)} · the plan lost ${ps.reduce((a, x) => a + x.two.lost, 0)} · seconds ${f1(mean(ps.map(x => x.b.t1 - x.b.t0)))} / ${f1(mean(ps.map(x => x.two.t1 - x.two.t0)))}`); }
  }
  // THE VERDICT, on what the maintainer asked be counted (wins and men kept): a WIN is a clean floor — taken with Sam never shot down, what a player
  // who can be hit calls taking it. A laid plan over B: at least as many clean floors AND fewer men lost. B over going solo: more clean floors.
  const of = (h: string) => runs.filter(r => r.hand === h && r.end !== 'error'), clean = (h: string) => of(h).filter(isClean).length / Math.max(1, of(h).length), lost = (h: string) => mean(of(h).map(r => r.of - r.men));
  const have = hands.length === 3 && HANDS.every(h => of(h).length > 0), planB = have && clean('plan') >= clean('b') && lost('plan') < lost('b'), bSolo = have && clean('b') > clean('solo'), errs = runs.filter(r => r.end === 'error').length, holds = planB && bSolo && errs === 0;   // (a run that threw is no run: the runs left over are not the sample that was asked for, so nothing HOLDS on them)
  const say = (h: string) => `${h} ${of(h).filter(isClean).length} of ${of(h).length} clean, ${f2(lost(h))} men lost a floor`;
  L.push(have ? `VERDICT: ${holds ? 'HOLDS' : errs ? `DOES NOT HOLD (${errs} of ${runs.length} runs threw)` : 'DOES NOT HOLD'} — a laid plan over B: ${planB ? 'yes' : 'NO'} (as many clean floors and fewer men lost) · B over solo: ${bSolo ? 'yes' : 'NO'} (more clean floors) · ${['plan', 'b', 'solo'].map(say).join(' · ')}` : 'NO VERDICT: not every hand was run');
  return { text: L.join('\n'), holds };
}

if (import.meta.main) {
  const A = process.argv.slice(2), opt = (k: string, d = '') => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] ?? '' : d; }, flag = (k: string) => A.includes(k);
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [Number(p)]; });
  const cap = Number(opt('--cap', '240')), hard = flag('--hard'), mortal = flag('--mortal');
  if (flag('--trace')) { const [h, s, n] = opt('--trace').split(':'); if (!HANDS.includes(h as Hand) || !s || !Number.isFinite(+n)) { console.error('--trace <hand>:<scenario id>:<seed>'); process.exit(2); }
    const r = await playOne(h as Hand, s, +n, cap, hard, true, mortal); const { trace, ...rest } = r; console.log(JSON.stringify(rest)); process.exit(r.end === 'error' ? 1 : 0); }
  if (flag('--one')) { const [h, s, n] = opt('--one').split(':'); const r = await playOne(h as Hand, s, +n, cap, hard, false, mortal); const { trace, ...rest } = r; process.stdout.write(`@@${JSON.stringify(rest)}\n`); process.exit(0); }
  const hands = opt('--hands', HANDS.join(',')).split(',') as Hand[], scns = opt('--scn', DEFAULT_SCN.join(',')).split(','), seeds = seedsOf(opt('--seeds', '1-6')), jobs = Math.max(1, Number(opt('--jobs', '4')));
  if (hands.some(h => !HANDS.includes(h)) || scns.some(s => !SCENARIOS.some((e: any) => e.id === s && e.kind === 'roomclear' && e.squad === 4)) || seeds.some(s => !Number.isFinite(s))) { console.error(`hands: ${HANDS.join(', ')} · levels: ${SCENARIOS.filter((e: any) => e.kind === 'roomclear' && e.squad === 4).map((e: any) => e.id).join(', ')}`); process.exit(2); }
  const todo = scns.flatMap(s => seeds.flatMap(n => hands.map(h => ({ h, s, n })))), runs: RunOut[] = []; let next = 0;
  const worker = async () => { while (next < todo.length) { const j = todo[next++];
      const p = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.h}:${j.s}:${j.n}`, '--cap', String(cap), ...(hard ? ['--hard'] : []), ...(mortal ? ['--mortal'] : [])], { stdout: 'pipe', stderr: 'ignore', env: process.env });
      const txt = await new Response(p.stdout).text(); await p.exited; const m = /^@@(.*)$/m.exec(txt);
      const r: RunOut = m ? JSON.parse(m[1]) : { hand: j.h, scn: j.s, seed: j.n, hard, end: 'error', why: 'no result line', t: 0, men: 0, of: 0, left: 0, defenders: 0, hits: 0, lives: 0, cost: 5, b: 0, laid: 0, f: 0, twoDoor: 0, rounds: 0, trace: [], rooms: [] };
      runs.push(r); if (!flag('--quiet')) console.error(`${r.hand.padEnd(5)} ${r.scn.padEnd(18)} seed ${String(r.seed).padStart(2)} · ${r.end.padEnd(6)} ${f1(r.t).padStart(6)} s · men ${r.men}/${r.of} · Sam hit ${r.hits} · left ${r.left}/${r.defenders} · B ${r.b} laid ${r.laid} F ${r.f} two-door ${r.twoDoor} by hand ${r.tools ?? 0} · rounds ${r.rounds}${r.end === 'error' ? ` · ${r.why}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => a.scn.localeCompare(b.scn) || a.seed - b.seed || HANDS.indexOf(a.hand) - HANDS.indexOf(b.hand));
  const rep = report(runs, flag('--md')); console.log(rep.text);
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(runs, null, 1));
  process.exit(rep.holds ? 0 : 1);
}
