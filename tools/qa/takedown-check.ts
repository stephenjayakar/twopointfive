// CLOSE-UP TAKEDOWNS AS MOVES (src/game/takedown.ts — the animator's half in character.ts, the fall in ragdollize, the breath in breathFrame), headless:
//   bun run tools/qa/takedown-check.ts [off|rules|moves|partner|breathe|lower|kill|beats|harness …]      (probes.ts takedown; TAKEDOWN_BREAK=1 = the switch left off: must fail)
// THE CONTRACT: one switch, TAKEDOWN.on, and it changes NO RULE — the man goes down on the frame he always did, with the same downKind, the same hearing events
// and chronicle rows, the game's die drawn the same number of times. What it changes is poses, how the body falls, and a breathing chest (the picture's joints).
//   rules     each of Sam's eight moves and the partner's takedown staged twice from a fresh stand-up on one seed — switch off, switch on — and compared up to and
//             including the frame the man is counted out: that frame, his downKind, every hearing event (frame, kind, level), the chronicle's rows, the number of
//             draws on the die, where Sam stands
//   off       the switch off: the module counts nothing, nobody is ever handed a fall or a breath, no animator is in a blow
//   moves     the switch on: one blow / one fall counted a move, the attacker in his move before it lands, the fall's style read once, the body at rest inside
//             four seconds on the floor, the fold forward and the topple backward — and not where the old fall left him
//   partner   the partner's blow lands inside his takedown: the man reacts on his feet (his head moves) where he used to stand frozen; out on the same frame
//   breathe   a man out cold breathes — the PICTURE's chest joint (the skeleton's globals / skin matrices) rises and falls while `bones`, the capsules and the
//             particles stand; nothing moves with the switch off; a man killed never breathes
//   lower     the choke lowers him (TAKEDOWN.lower); kill = the kill from the hold as a move (TAKEDOWN.kill: the fist across his throat and out wide, his head back
//             before the cut, both going down by the clock's end with Sam's hand still on him, nothing pops — through it (a commit: nothing cancels it), on
//             into the fall, or started ten frames after a choke eased off — the fall, and the half off = the hold's own pose and the old fall); beats = the
//             choke's beats (TAKEDOWN.chokeBeats: hands on the arm at once, off it before he is lowered, the head to the side first, held at the bottom, and a
//             man grabbed again after a choke broken off starts with his hands where a fresh hold has them)
//   harness   the two stands' row, the stand word, the page's switch, the knob registry, a recording's tables
// Run it on both stands (plain, and TPS_PROFILE=shipped): it writes the switch itself for each arm. The stagings are tools/qa/takedown-strip.ts's own (that file
// runs on import, so they are repeated here): Sam's blows through player.ts startTakedown, the hold through startGrab and the held rows, the partner's through
// the pair's 'take him now' order. Nothing here looks at a picture.
import { standUp, ROOT } from './headless.ts';

const { TAKEDOWN, TAKEDOWN_STATS } = await import(`${ROOT}/src/game/takedown.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { startTakedown, startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { takeFall } = await import(`${ROOT}/src/game/takedown.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { RAG, RAG_COUNT } = await import(`${ROOT}/src/game/ragdoll.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const PM: any = await import(`${ROOT}/src/game/pairorders.ts`);
const KN: any = await import(`${ROOT}/src/game/knobs.ts`);

type P3 = number[];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const BREAK = process.env.TAKEDOWN_BREAK === '1';
const DT = 1 / 60, DEG = Math.PI / 180, EAST = Math.PI / 2, LOBBY: P3 = [9.5, 0, 19.5];
const cm = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) : String(x)), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const flat = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- the stagings (takedown-strip.ts's, with the switch written right after the stand-up)
/** the die every run draws: the strip's seeded Math.random behind a counter (+ the game's own die's count where the stand gave it one: TPS_SEED) */
interface Die { n: number }
function die(seed: number): Die { const r = seeded(seed), D: Die = { n: 0 }; Math.random = () => { D.n++; return r(); }; return D; }
const drawn = (D: Die, g: any) => D.n + (g.dice?.n ?? 0);
/** the switch for an arm — and every half with it (TAKEDOWN_BREAK=1: left off, the on-lines then asked of the old build) */
function arm(on: boolean) { Object.assign(TAKEDOWN, { on: on && !BREAK, blow: true, victim: true, fall: true, partner: true, breathe: true, lower: true, kill: true, chokeBeats: true }); Object.assign(TAKEDOWN_STATS, { blows: 0, falls: 0, partner: 0, breathing: 0 }); }

interface Stage {
  W: any; g: any; D: Die;
  /** who does it · the man it is done to (a Guard) */
  att: any; vic: any;
  /** one frame, as the staging steps it */
  step: () => void;
  /** the move begins (the span the rules are compared over starts here) */
  begin: () => void;
  /** asked after every frame of the span: something the staging does part way (the hold's row) */
  during?: (f: number) => void;
  /** frames the man must be out within */
  cap: number;
  /** the partner's: has the blow begun (his hands on) */
  hands?: () => boolean;
  /** the hold's: Sam put back behind the man where he now stands, crouched, as before the grab */
  behind?: () => void;
}
function place(gd: any, p: P3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], EAST); gd.heardUpTo = 1e12; }
/** the lobby's open floor: one man planted facing east, calm, the others parked; Sam's hands empty, unhurtable, nobody perceiving anything */
async function lobby(seed: number, on: boolean) {
  const D = die(seed); const W: any = await hushed(() => standUp()); const g = W.game; CLOSE.on = true; arm(on);
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = g.guards; park(B, 0); park(C, 1); place(A, LOBBY, EAST); A.wp = 1; A.hold = true;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.step(DT); g.player.visibility = 0.02; } };
  const samAt = (bDeg: number, d: number, crouch = false) => { const a = A.char.bodyYaw + bDeg * DEG; g.teleportPlayer([A.char.pos[0] + Math.sin(a) * d, 0, A.char.pos[2] + Math.cos(a) * d]); g.player.crouch = crouch;
    const pl = g.player.char; pl.bodyYaw = pl.aimYaw = Math.atan2(A.char.pos[0] - pl.pos[0], A.char.pos[2] - pl.pos[2]); W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); step(20); };
  return { W, g, A, D, step, samAt };
}
async function blow(on: boolean, bDeg: number, dist: number, lethal: boolean): Promise<Stage> {
  const S = await lobby(7001, on), { W, g, A, D } = S; S.samAt(bDeg, dist); S.step(1);
  return { W, g, D, att: g.player, vic: A, step: () => S.step(1), begin: () => startTakedown(g, A, undefined, lethal), cap: 120 };
}
/** THE KILL FROM THE HOLD, staged from outside where player.ts has no row for it (tools/qa/takedown-strip.ts stages it with these two). The phase is put on the
 *  way player.ts setPhase puts one on (the clock zeroed, mirrored on the man); an updateHold that knows no 'kill' runs it as a phase it starts nothing in —
 *  rooted, the clock counting, both animators told, never ended — so the end is made here as the rules make it at HOLD.secs.kill: the hold let go of,
 *  takeFall(…, 'kill'), killGuard 'shot'. A build whose updateHold ends it itself is left to (the man is already dead, the hold already gone: killEnd does
 *  nothing and says so — false). `how` = what takeFall is told (the half's off arm: nothing = the old fall). */
const KILL_TAP = 90;
export function setHoldPhase(g: any, phase: string) { const H = g.player.holding; if (!H) return; H.phase = phase; H.t = 0; H.windT = -1; H.fireQueued = false; if (H.g.held) H.g.held.phase = phase; }
export function killEnd(g: any, how: 'kill' | undefined = 'kill'): boolean {
  const pl = g.player, H = pl.holding; if (!H || H.phase !== 'kill' || H.t < HOLD.secs.kill) return false;
  const gd = H.g, f = pl.char.forward(); gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  takeFall(g, gd, undefined, true, how); killGuard(g, gd, f, true, 'shot', 'player', 'knife — dead'); pl.holding = null; pl.char.anim.holdPose = null; return true;
}
/** the fall's style as takeFall leaves it on a man, WHOEVER ends the phase (this file's killEnd or player.ts's own rule): killGuard spends it inside the same
 *  frame, so nothing between frames ever sees it — it is caught as it is written */
function watchFall(c: any): { last: string | null } {
  const w = { last: null as string | null }; let v = c.fallAs ?? null;
  Object.defineProperty(c, 'fallAs', { configurable: true, enumerable: true, get: () => v, set: (x: any) => { v = x; if (x) w.last = String(x); } });
  return w;
}
async function hold(on: boolean, end: 'choke' | 'whip' | 'kill'): Promise<Stage> {
  const S = await lobby(7002, on), { W, g, A, D } = S; S.samAt(180, 0.8, true); g.player.holstered = end !== 'whip'; S.step(2);
  const ahead = () => { const c = g.player.char; W.cursorAt([c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.0, c.pos[2] + Math.cos(c.bodyYaw) * 6]); };
  const behind = () => { S.samAt(180, 0.8, true); g.player.holstered = end !== 'whip'; S.step(2); };
  if (end === 'kill') return { W, g, D, att: g.player, vic: A, step: () => { ahead(); S.step(1); killEnd(g); }, begin: () => startGrab(g, A), during: f => { if (f === KILL_TAP) setHoldPhase(g, 'kill'); }, cap: KILL_TAP + 360, behind };
  return { W, g, D, att: g.player, vic: A, step: () => { ahead(); S.step(1); }, begin: () => startGrab(g, A), during: f => { if (f === 90) { g.selectVerb('held', end); W.input.pressed.add('Space'); } }, cap: 90 + 360, behind };
}
/** the partner's: the room clear on the office with ONE teammate, silent; a defender stood on the open aisle, the partner told 'take him now' */
async function partner(on: boolean): Promise<Stage> {
  Object.assign(NIGHTBREACH, { squad: 1 }); const D = die(10);
  const { W, g } = await hushed(async () => { const W: any = await standUp(); const g = W.game; arm(on);
    Object.assign(SLM.SILENT, { on: true }); Object.assign(PM.PAIR, { on: true }); g.godMode = true;
    const why = g.roomClear.start(10); if (why) throw new Error(`partner: the room clear did not start: ${why}`); return { W, g }; });
  const O = g.orders, step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(30); SLM.setSilent(g, true); step(2);
  const mate = O.squad()[0], foe = g.guards.find((h: any) => h.callsign === 'Tango 1'); if (!mate || !foe) throw new Error('partner: no teammate / no Tango 1 on the floor');
  const put = (gd: any, p: P3, yaw: number) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.lastPos = [p[0], 0, p[2]]; gd.path = []; gd.pathGoal = null; };
  put(foe, [22, 0, 17.6], EAST); foe.hold = true; put(mate, [19, 0, 17.6], EAST); g.teleportPlayer([11, 0, 18.5]); step(30); PM.PAIR_LOG.length = 0;
  return { W, g, D, att: mate, vic: foe, step: () => step(1), cap: 960, hands: () => PM.PAIR_LOG.some((x: any) => String(x.what).startsWith('hands:')),
    begin: () => { const no = O.give('pairTake', { kind: 'foe', at: [foe.char.pos[0], 0, foe.char.pos[2]], foe }); if (no) throw new Error(`partner: 'take him now' refused: ${no}`); } };
}
/** what each move should count and leave: a blow of Sam's own (the hold's ends have none) · the fall's style · whether the man is out cold (breathes) or dead */
interface Move { title: string; stage: (on: boolean) => Promise<Stage>; blow: boolean; fall: string; kind: string; sam: boolean }
const MOVES: Record<string, Move> = {
  'knockout-behind': { title: 'the knockout from behind', stage: on => blow(on, 180, 0.6, false), blow: true, fall: 'fold', kind: 'struck', sam: true },
  'knockout-side': { title: 'the knockout from his left side', stage: on => blow(on, 90, 0.8, false), blow: true, fall: 'topple', kind: 'struck', sam: true },
  'knockout-front': { title: 'the knockout from in front', stage: on => blow(on, 0, 0.75, false), blow: true, fall: 'topple', kind: 'struck', sam: true },
  'knife-behind': { title: 'the knife from behind', stage: on => blow(on, 180, 0.6, true), blow: true, fall: 'sink', kind: 'shot', sam: true },
  'knife-side': { title: 'the knife from his left side', stage: on => blow(on, 90, 0.8, true), blow: true, fall: 'cut', kind: 'shot', sam: true },
  'knife-front': { title: 'the knife from in front', stage: on => blow(on, 0, 0.75, true), blow: true, fall: 'cut', kind: 'shot', sam: true },
  'grab-choke': { title: 'the grab, the hold, the choke', stage: on => hold(on, 'choke'), blow: false, fall: 'sink', kind: 'choked', sam: true },
  'grab-whip': { title: 'the grab with the pistol out, the pistol whip', stage: on => hold(on, 'whip'), blow: false, fall: 'fold', kind: 'struck', sam: true },
  'grab-kill': { title: 'the grab, the hold, the knife across his throat', stage: on => hold(on, 'kill'), blow: false, fall: 'fold', kind: 'shot', sam: true },
  'partner': { title: "the partner's takedown ('take him now')", stage: partner, blow: false, fall: 'fold', kind: 'struck', sam: false },
};
const NAMES = Object.keys(MOVES);

// ---------------------------------------------------------------- one run, everything the lines ask measured in it
interface Breath { asleep: boolean; set: boolean; chest: number; joints: number; bones: number; caps: number; rag: number }
interface Run {
  move: string; on: boolean; err: string | null;
  /** RULES — up to and including the frame he is counted out (frames from `begin`; -1 never) */
  out: number; downKind: string; events: string[]; chron: string[]; draws: number; sam: P3;
  /** the whole run: draws to its end · the module's counts · frames anybody was in a blow / the attacker was, before it landed · frames anybody held a fall style or a breath between frames */
  drawsAll: number; stats: Record<string, number>; blowAny: number; blowAtt: number; fallSeen: number; breathSeen: number; fallAfter: string | null;
  /** the fall: s from out to at rest (asleep, or every particle under 2 cm/s; NaN = not inside 4 s) · every particle finite · the lowest particle (m) · the particles
   *  at 4 s · the head's signed distance (m) from where his feet were along the facing he had */
  rest: number; fastAt4: number; slept: number; trace: string[]; fastWho: string; finite: boolean; low: number; lie: number[]; headAlong: number;
  /** the partner's: the frame his hands went on · the frame the blow lands · the head bone's furthest move from where it was then, until he is out · on his feet all that time */
  hands: number; lands: number; headMove: number; headIdle: number; stood: boolean;
  breath: Breath | null;
}
const chars = (g: any): any[] => [g.player.char, ...g.guards.map((x: any) => x.char), ...g.civilians.map((x: any) => x.char)];
const copyBones = (c: any): Record<string, P3> => { const o: Record<string, P3> = {}; for (const k of Object.keys(c.bones)) o[k] = [...c.bones[k]]; return o; };
const bonesDiff = (a: Record<string, P3>, c: any) => { let m = 0; for (const k of Object.keys(a)) { const b = c.bones[k]; m = Math.max(m, b ? Math.hypot(a[k][0] - b[0], a[k][1] - b[1], a[k][2] - b[2]) : Infinity); } return m; };
const flatNums = (x: any, out: number[] = []): number[] => { if (typeof x === 'number') out.push(x); else if (x && typeof x === 'object') for (const v of Array.isArray(x) || ArrayBuffer.isView(x) ? Array.from(x as any) : Object.values(x)) flatNums(v, out); return out; };
const numsDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => { let m = a.length === b.length ? 0 : Infinity; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

async function runOnce(move: string, on: boolean): Promise<Run> {
  const M = MOVES[move], rnd = Math.random, knobs = KN.knobsCopy(), squad = NIGHTBREACH.squad;
  const R: Run = { move, on, err: null, out: -1, downKind: '', events: [], chron: [], draws: 0, sam: [NaN, NaN, NaN], drawsAll: 0, stats: {}, blowAny: 0, blowAtt: 0, fallSeen: 0, breathSeen: 0, fallAfter: null,
    rest: NaN, fastAt4: NaN, slept: NaN, trace: [], fastWho: '', finite: true, low: Infinity, lie: [], headAlong: NaN, hands: -1, lands: -1, headMove: 0, headIdle: NaN, stood: true, breath: null };
  try {
    const S = await M.stage(on), { g, vic, att } = S, vc = vic.char;
    const seen = new Set<any>(g.events), chron0 = g.chronicle.events.length, d0 = drawn(S.D, g);
    const feet: P3 = [vc.pos[0], 0, vc.pos[2]], fwd: P3 = [Math.sin(vc.bodyYaw), 0, Math.cos(vc.bodyYaw)];
    let head0: P3 | null = null, f = 0; const heads: P3[] = [];
    const look = () => {   // (between frames: what stands on anybody)
      for (const c of chars(g)) { if (c.anim?.blowing) R.blowAny++; if (c.fallAs) R.fallSeen++; if (c.breathe) R.breathSeen++; }
      if (R.out < 0 && att.char.anim.blowing) R.blowAtt++;
    };
    S.begin(); look();
    // 1. to the frame he is counted out
    while (R.out < 0 && f < S.cap) {
      S.during?.(f); S.step(); f++;
      for (const e of g.events) if (!seen.has(e)) { seen.add(e); R.events.push(`${f}:${e.kind}:${e.level ?? '-'}`); }
      if (S.hands) heads.push([...vc.bones.head]);
      if (S.hands && R.hands < 0 && S.hands()) { R.hands = f; R.lands = f + Math.round(TAKEDOWN.partnerHit * 60); }
      if (vic.state === 'dead') { const n = f - R.lands, a = heads[R.hands - 1 - n]; if (R.lands >= 0 && a) { R.headIdle = 0; for (let i = R.hands - 1 - n; i < R.hands - 1; i++) R.headIdle = Math.max(R.headIdle, Math.hypot(heads[i][0] - a[0], heads[i][1] - a[1], heads[i][2] - a[2])); }
        R.out = f; R.downKind = String(vic.downKind); R.chron = g.chronicle.events.slice(chron0).map((e: any) => e.kind); R.draws = drawn(S.D, g) - d0; R.sam = [...g.player.char.pos]; }
      else if (R.lands >= 0 && f >= R.lands) { const h: P3 = vc.bones.head; if (!head0) head0 = [...h]; else R.headMove = Math.max(R.headMove, Math.hypot(h[0] - head0[0], h[1] - head0[1], h[2] - head0[2])); R.stood &&= !vc.ragdoll && vc.alive !== false; }
      look();
    }
    if (R.out < 0) throw new Error(`the man was never counted out in ${S.cap} frames (state ${vic.state})`);
    R.fallAfter = vc.fallAs ?? null;
    // 2. the fall: four seconds of it
    const rag = vc.ragdoll; if (!rag) throw new Error('counted out with no ragdoll');
    for (let k = 1; k <= 240; k++) {
      const prev = Float64Array.from(rag.x as ArrayLike<number>); S.step(); look();
      let fast = 0, who = 0; for (let i = 0; i < RAG_COUNT; i++) { const d = Math.hypot(rag.x[i * 3] - prev[i * 3], rag.x[i * 3 + 1] - prev[i * 3 + 1], rag.x[i * 3 + 2] - prev[i * 3 + 2]) / DT; if (d > fast) { fast = d; who = i; } if (!Number.isFinite(d)) R.finite = false; }
      if (Number.isNaN(R.rest) && (rag.sleeping || fast < 0.02) && k > 6) R.rest = k * DT;   // (the first frames of a led fall hold the neck: 'slow' there is not 'at rest')
      else if (!Number.isNaN(R.rest) && !rag.sleeping && fast >= 0.02) R.rest = NaN;           // (…and it moved again: not at rest yet)
      R.fastAt4 = fast; if (k === 240) { const sp = g.player.char.pos; R.fastWho = fast > 0 ? `${Object.keys(RAG).find(n => RAG[n] === who)} at height ${cm(rag.x[who * 3 + 1])} cm, ${cm(Math.hypot(rag.x[who * 3] - sp[0], rag.x[who * 3 + 2] - sp[2]))} cm from Sam on the plan, moving ${[0, 1, 2].map(a => cm((rag.x[who * 3 + a] - prev[who * 3 + a]) / DT)).join(' / ')} cm/s x / y / z` : 'none'; }
      if (k % 30 === 0) R.trace.push(cm(fast)); if (Number.isNaN(R.slept) && rag.sleeping) R.slept = k * DT;
    }
    R.lie = Array.from(rag.x as ArrayLike<number>); for (let i = 0; i < RAG_COUNT; i++) R.low = Math.min(R.low, rag.x[i * 3 + 1]); R.finite &&= R.lie.every(Number.isFinite);
    const hp = rag.point(RAG.head); R.headAlong = (hp[0] - feet[0]) * fwd[0] + (hp[2] - feet[2]) * fwd[2];
    // 3. the breath: asleep, three seconds on, then one whole breath watched
    for (let k = 0; k < 480 && !rag.sleeping; k++) { S.step(); look(); if (rag.sleeping) R.slept = 4 + (k + 1) * DT; }
    for (let k = 0; k < 180; k++) { S.step(); look(); }
    const sk = vc.skel, node = vc.anim.nodes.spine2, chest = (): P3 => [sk.globals[node][12], sk.globals[node][13], sk.globals[node][14]];
    const b0 = copyBones(vc), c0 = flatNums(vc.capsules()), x0 = Float64Array.from(rag.x), j0 = sk.jointData ? Float32Array.from(sk.jointData) : null;
    const lo = chest(), hi = chest(); const B: Breath = { asleep: !!rag.sleeping, set: !!vc.breathe, chest: 0, joints: 0, bones: 0, caps: 0, rag: 0 };
    for (let k = 0, n = Math.ceil(60 / TAKEDOWN.breathHz) + 12; k < n; k++) {
      S.step(); look(); B.set ||= !!vc.breathe;
      const p = chest(); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
      if (j0) B.joints = Math.max(B.joints, numsDiff(j0, sk.jointData));
      B.bones = Math.max(B.bones, bonesDiff(b0, vc)); B.caps = Math.max(B.caps, numsDiff(c0, flatNums(vc.capsules()))); B.rag = Math.max(B.rag, numsDiff(x0, rag.x));
    }
    B.chest = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); B.asleep &&= !!rag.sleeping; R.breath = B;
    R.drawsAll = drawn(S.D, g) - d0; R.stats = { ...TAKEDOWN_STATS };
  } catch (e) { R.err = e instanceof Error ? e.message : String(e); }
  finally { KN.knobsBack(knobs); NIGHTBREACH.squad = squad; Math.random = rnd; }
  return R;
}
const RUNS = new Map<string, Promise<Run>>();
const run = (move: string, on: boolean): Promise<Run> => { const k = `${move}:${on}`; let p = RUNS.get(k); if (!p) RUNS.set(k, p = runOnce(move, on)); return p; };
const both = async (move: string): Promise<[Run, Run]> => [await run(move, false), await run(move, true)];
const J = (o: unknown) => JSON.stringify(o);
const bad = (F: { verdict: Verdict }, ...rs: Run[]) => { const e = rs.filter(r => r.err); for (const r of e) F.verdict(false, `${r.move} (switch ${r.on ? 'on' : 'off'}): the staging ran`, r.err!); return e.length > 0; };

// ───────────────────────────────────────────────────────────── rules
export async function takedownRules(): Promise<boolean> {
  const F = family('takedown-rules: off against on, each move from a fresh stand-up on one seed — the same frame, downKind, hearing events, chronicle rows, draws, and Sam where he stood');
  for (const m of NAMES) {
    const [A, B] = await both(m); if (bad(F, A, B)) continue;
    const ev = J(A.events) === J(B.events), ch = J(A.chron) === J(B.chron), dp = Math.hypot(A.sam[0] - B.sam[0], A.sam[1] - B.sam[1], A.sam[2] - B.sam[2]);
    const same = A.out === B.out && A.downKind === B.downKind && ev && ch && A.draws === B.draws && dp <= 1e-6;
    F.verdict(same && A.downKind === MOVES[m].kind && (BREAK || B.stats.falls === 1), `${m}: no rule moved`,
      `out at frame ${A.out} | ${B.out} · downKind ${A.downKind} | ${B.downKind} · hearing events ${A.events.length} | ${B.events.length}${ev ? ' (equal)' : ` DIFFER: ${J(A.events)} | ${J(B.events)}`} [${A.events.join(' ')}] · chronicle ${ch ? `[${A.chron.join(' ')}] (equal)` : `DIFFER: ${J(A.chron)} | ${J(B.chron)}`} · draws to that frame ${A.draws} | ${B.draws} (to the run's end ${A.drawsAll} | ${B.drawsAll}) · Sam ${dp.toExponential(1)} m apart${m === 'partner' ? ` · hands on at frame ${A.hands} | ${B.hands}` : ''}`);
  }
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function takedownOff(): Promise<boolean> {
  const F = family('takedown-off: the switch off — nothing counted, nobody handed a fall or a breath, no animator in a blow');
  const rs: Run[] = []; for (const m of NAMES) rs.push(await run(m, false)); if (bad(F, ...rs)) return F.done();
  const sum = (k: string) => rs.reduce((a, r) => a + (r.stats[k] ?? 0), 0), row = (pick: (r: Run) => number) => rs.map(r => `${r.move} ${pick(r)}`).join(' · ');
  F.verdict(sum('blows') === 0 && sum('falls') === 0 && sum('partner') === 0 && sum('breathing') === 0, 'TAKEDOWN_STATS stay at nothing through every move', rs.map(r => `${r.move} ${J(r.stats)}`).join(' · '));
  F.verdict(rs.every(r => r.fallSeen === 0 && r.fallAfter === null), 'no character ever holds a fall style (fallAs null on every frame)', `frames seen: ${row(r => r.fallSeen)}`);
  F.verdict(rs.every(r => r.breathSeen === 0 && !r.breath?.set), 'no character is ever handed a breath (breathe null on every frame, out cold or dead)', `frames seen: ${row(r => r.breathSeen)}`);
  F.verdict(rs.every(r => r.blowAny === 0), 'no animator is ever in a blow (anim.blowing false on every frame, every man)', `frames seen: ${row(r => r.blowAny)}`);
  return F.done();
}

// ───────────────────────────────────────────────────────────── moves
export async function takedownMoves(): Promise<boolean> {
  const F = family('takedown-moves: the switch on — one blow and one fall a move, the fall read once, the body at rest on the floor, forward for the fold and backward for the topple');
  const lie = (a: Run, b: Run) => { let m = 0; for (let i = 0; i < RAG_COUNT; i++) m = Math.max(m, Math.hypot(a.lie[i * 3] - b.lie[i * 3], a.lie[i * 3 + 1] - b.lie[i * 3 + 1], a.lie[i * 3 + 2] - b.lie[i * 3 + 2])); return m; };
  for (const m of NAMES) {
    const M = MOVES[m], [A, B] = await both(m); if (bad(F, A, B)) continue;
    const wantBlows = M.sam && M.blow ? 1 : 0, wantPartner = M.sam ? 0 : 1, inMove = M.sam ? M.blow : true;
    F.verdict(B.stats.blows === wantBlows && B.stats.partner === wantPartner && B.stats.falls === 1 && (inMove ? B.blowAtt > 0 : B.blowAny === 0) && B.fallAfter === null && B.fallSeen === 0,
      `${m}: counted once (${M.fall}), ${inMove ? 'the attacker in his move before it lands' : 'no blow of its own'}, the fall's style read once and gone`,
      `stats ${J(B.stats)} (want blows ${wantBlows} · partner ${wantPartner} · falls 1) · frames the attacker was in a blow before the man was out ${B.blowAtt} of ${B.out} · fallAs on the frame he went down ${J(B.fallAfter)} · frames a fall style stood between frames ${B.fallSeen}`);
    F.verdict(Number.isFinite(B.rest) && B.rest <= 4 && B.finite && B.low > -0.05, `${m}: the body comes to rest inside four seconds, every particle finite and on the floor`,
      `at rest ${f2(B.rest)} s after he went down (off: ${f2(A.rest)} s) · fastest particle at 4 s ${cm(B.fastAt4)} cm/s (${B.fastWho}; every half second: ${B.trace.join(' ')}) · the ragdoll asleep at ${f2(B.slept)} s (off ${f2(A.slept)} s) · finite ${B.finite} · lowest particle ${cm(B.low)} cm (off ${cm(A.low)} cm)`);
  }
  { const [A, B] = await both('knockout-behind'); if (!bad(F, A, B)) {
      const d = lie(A, B); F.verdict(B.headAlong > 0.3 && d > 0.05, 'knockout from behind = FOLD: his head ends up in FRONT of where his feet were, and the body does not lie where the old fall left it',
        `head ${f2(B.headAlong)} m along his facing from his feet (off: ${f2(A.headAlong)} m) · the two bodies' furthest particle apart ${cm(d)} cm`); } }
  { const [A, B] = await both('knockout-front'); if (!bad(F, A, B)) {
      const d = lie(A, B); F.verdict(B.headAlong < -0.3 && d > 0.05, 'knockout from in front = TOPPLE: his head ends up BEHIND where his feet were, and the body does not lie where the old fall left it',
        `head ${f2(B.headAlong)} m along his facing from his feet (off: ${f2(A.headAlong)} m) · the two bodies' furthest particle apart ${cm(d)} cm`); } }
  { const rows: string[] = []; for (const m of NAMES) { const [A, B] = await both(m); if (!A.err && !B.err) rows.push(`${m} ${f2(A.headAlong)} → ${f2(B.headAlong)} (${cm(lie(A, B))} cm)`); }
    console.log(`    NOTE — every move's head, m along his facing from his feet, off → on (and the furthest particle between the two bodies): ${rows.join(' · ')}`); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── partner
export async function takedownPartner(): Promise<boolean> {
  const F = family("takedown-partner: the partner's blow lands inside his takedown — the man reacts on his feet where he used to stand frozen, and is out on the same frame");
  const [A, B] = await both('partner'); if (bad(F, A, B)) return F.done();
  const span = (r: Run) => `hands on at frame ${r.hands} · the blow lands at ${r.lands} · out at ${r.out} (${r.out - r.hands} frames = ${f2((r.out - r.hands) * DT)} s after the hands)`;
  F.verdict(A.hands > 0 && A.hands === B.hands && A.out === B.out && A.lands < A.out, 'the hands go on and the man is counted out on the same frames either way, the blow landing between', `off: ${span(A)} · on: ${span(B)}`);
  F.verdict(B.stood && B.headMove > 0.04, 'ON: from the blow landing until he is counted out he is on his feet (not down, no ragdoll) and his head moves more than 4 cm', `head bone moved ${cm(B.headMove)} cm · on his feet throughout ${B.stood} · downKind ${B.downKind}`);
  // (the bar: 3 cm. The old stand-in is not dead still — measured 1.8 cm against 0.7 cm for as long a stretch of standing untouched: it is the build's, not the switch's)
  F.verdict(A.stood && A.headMove < 0.03, 'OFF: the same stretch, the old stand-in — his head moves less than 3 cm', `head bone moved ${cm(A.headMove)} cm · on his feet throughout ${A.stood} · (as long a stretch just before the hands went on, standing untouched: ${cm(A.headIdle)} cm; on: ${cm(B.headIdle)} cm)`);
  F.verdict(B.blowAtt > 0 && B.stats.partner === 1 && A.blowAny === 0, "ON: the partner is in a move of his own (anim.blowing) before the man is out, counted once; OFF: nobody is", `on: frames in the blow ${B.blowAtt} · stats ${J(B.stats)} · off: frames ${A.blowAny}`);
  return F.done();
}

// ───────────────────────────────────────────────────────────── breathe
export async function takedownBreathe(): Promise<boolean> {
  const F = family("takedown-breathe: a man out cold breathes — the picture's chest joint only; bones, capsules and particles stand; a dead man never does");
  const say = (b: Breath) => `chest joint ${(b.chest * 1000).toFixed(2)} mm peak to peak · skin matrices moved ${b.joints.toExponential(1)} · bones ${b.bones.toExponential(1)} m · capsules ${b.caps.toExponential(1)} m · particles ${b.rag.toExponential(1)} m · asleep ${b.asleep} · breathe set ${b.set}`;
  console.log(`    NOTE — the picture's joints ARE reachable headless: Character.skel.globals[anim.nodes.spine2] (model space, what breathFrame writes through skel.update) and skel.jointData (the skin matrices); one breath = ${f2(1 / TAKEDOWN.breathHz)} s, watched from 3 s after the body slept`);
  for (const m of NAMES) {
    const M = MOVES[m], [A, B] = await both(m); if (bad(F, A, B)) continue; const a = A.breath!, b = B.breath!;
    const still = (x: Breath) => x.bones <= 1e-9 && x.caps <= 1e-9 && x.rag <= 1e-9;
    if (M.kind === 'shot') F.verdict(!b.set && B.breathSeen === 0 && b.chest <= 1e-9 && b.joints <= 1e-9 && still(b), `${m} (killed), ON: he never breathes`, say(b));
    else {
      F.verdict(b.asleep && b.set && b.chest > 0.003 && b.joints > 0, `${m} (out cold: ${B.downKind}), ON: the picture's chest joint rises and falls more than 3 mm over a breath`, say(b));
      F.verdict(still(b), `${m}, ON: what the game reads does not move at all — bones, capsules, particles (≤ 1e-9)`, say(b));
    }
    F.verdict(!a.set && A.breathSeen === 0 && a.chest <= 1e-9 && a.joints <= 1e-9 && still(a), `${m}, OFF: nothing moves`, say(a));
  }
  return F.done();
}

// ───────────────────────────────────────────────────────────── lower
interface ChokeRun { err: string | null; out: number; kind: string; man: Record<string, P3>[]; sam: Record<string, P3>[]; phase: string[] }
/** the grab, the hold, the choke, both skeletons after every frame from the grab (the tap on 'choke' is frame 90) until he is out. `ease` = a Space tap on that
 *  frame (the choke eased off: he breathes again and the hold goes on); the run then goes on `after` frames */
export async function chokeRun(on: boolean, lower: boolean, ease = -1, after = 0, beats = true, kill = true, haul = false): Promise<ChokeRun> {   // (haul: the choke's haul, HOLD.haul, is HELD OFF these lines — they pin the lowering's and the beats' own numbers; tools/qa/haul-check.ts is its check)
  const rnd = Math.random, knobs = KN.knobsCopy(), R: ChokeRun = { err: null, out: -1, kind: '', man: [], sam: [], phase: [] };
  try {
    const S = await hold(on, 'choke'), { g, vic } = S; TAKEDOWN.lower = lower; TAKEDOWN.chokeBeats = beats; TAKEDOWN.kill = kill; TAKEDOWN.haul = haul; S.begin();
    for (let f = 0, end = ease >= 0 ? ease + after : S.cap; f < end; f++) {
      S.during?.(f); if (f === ease) S.W.input.pressed.add('Space'); S.step();
      if (vic.state === 'dead') { R.out = f + 1; R.kind = String(vic.downKind); break; }
      R.man.push(copyBones(vic.char)); R.sam.push(copyBones(g.player.char)); R.phase.push(String(g.player.holding?.phase ?? '-'));
    }
  } catch (e) { R.err = e instanceof Error ? e.message : String(e); }
  finally { KN.knobsBack(knobs); Math.random = rnd; }
  return R;
}
const dist3 = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mapDiff = (a: Record<string, P3>, b: Record<string, P3>) => { let m = 0; for (const k of Object.keys(a)) m = Math.max(m, b[k] ? dist3(a[k], b[k]) : Infinity); return m; };
const offFloor = (b: Record<string, P3>) => Math.min(...Object.entries(b).filter(([k]) => !/^(foot|toe)/.test(k)).map(([, p]) => p[1]));
const fastest = (R: ChokeRun, from: number): [number, string] => { let pop = 0, at = '';
  for (let i = from; i < R.man.length; i++) for (const [who, b] of [['man', R.man], ['Sam', R.sam]] as const) for (const k of Object.keys(b[i])) { const d = dist3(b[i][k], b[i - 1][k]); if (d > pop) { pop = d; at = `${who}'s ${k} at frame ${i}`; } }
  return [pop, at]; };
export async function takedownLower(): Promise<boolean> {
  const F = family("takedown-lower: the choke LOWERS him — the man down onto his heels, Sam down with him, the arm still on his neck; out on the frame he always was; the half off = the hold as it was");
  const off = await chokeRun(false, true), plain0 = await chokeRun(true, false, -1, 0, false), plain = await chokeRun(true, false), low = await chokeRun(true, true);   // (plain0: the choke's beats off too — the hold as it was; plain / low: the beats on in both, the lowering alone between them)
  const bads = [off, plain0, plain, low].filter(r => r.err || r.out < 0);
  if (bads.length) { for (const r of bads) F.verdict(false, 'the choke ran to its end', r.err ?? 'he was never out'); return F.done(); }
  { // 1. the half off: bone for bone the hold with the whole switch off
    let d = 0; const n = Math.min(off.man.length, plain0.man.length); for (let i = 0; i < n; i++) d = Math.max(d, mapDiff(off.man[i], plain0.man[i]), mapDiff(off.sam[i], plain0.sam[i]));
    F.verdict(off.out === plain0.out && d <= 1e-9, "with 'the choke lowers him' and 'the choke's beats' off, the grab, the hold and the choke are the switch-off build's bone for bone, every frame, both men",
      `out at frame ${off.out} | ${plain0.out} · largest bone difference over ${n} frames ${d.toExponential(1)} m`); }
  const n = low.man.length, last = n - 1, tap = 90;
  { // 2. no rule moved by it, and he is really lowered
    const sat = HOLD.catchShape && CLOSE.noKnife ? HOLD.catch.sink : 0;   // (HOLD.catch: in the bare hold he is SAT that far down into the arm already, so the choke that does not lower him no longer ends with him standing — the line's 30 cm is below standing, as it reads)
    const mh = plain.man[last].hips[1] + sat - low.man[last].hips[1], sh = plain.sam[last].hips[1] - low.sam[last].hips[1], hd = low.sam[last].head[1] - plain.sam[last].head[1];
    F.verdict(low.out === plain.out && low.kind === 'choked' && plain.kind === 'choked', 'lowered or not, he is out on the same frame and out cold', `out at frame ${plain.out} | ${low.out} · ${plain.kind} | ${low.kind}`);
    F.verdict(mh >= 0.3 && sh >= 0.2 && hd < 0, "on the choke's last frame the man's hips are 30 cm or more lower than standing, Sam's 20 cm or more, Sam's head lower too",
      `the man's hips ${cm(mh)} cm lower (at ${f2(low.man[last].hips[1])} m${sat ? `; ${cm(sat)} cm of it the bare hold's seat` : ''}) · Sam's ${cm(sh)} cm lower (at ${f2(low.sam[last].hips[1])} m) · Sam's head ${cm(hd)} cm`); }
  { // 3. the arm stays on his neck, feet where they were, nothing under the floor, nothing pops
    let hand = 0, sFeet = 0, mFeet = 0, floor = Infinity; const [pop, popAt] = fastest(low, tap + 1);
    for (let i = tap; i < n; i++) {
      hand = Math.max(hand, Math.abs(dist3(low.sam[i].handL, low.man[i].neck) - dist3(plain.sam[i].handL, plain.man[i].neck)));
      for (const k of ['footL', 'footR']) { sFeet = Math.max(sFeet, dist3(low.sam[i][k], plain.sam[i][k])); mFeet = Math.max(mFeet, dist3(low.man[i][k], plain.man[i][k])); }
      floor = Math.min(floor, offFloor(low.man[i]), offFloor(low.sam[i]));
    }
    F.verdict(hand <= 0.03, "all the way down, Sam's hand is as far from the man's neck as it is in the standing choke, within 3 cm", `largest difference ${cm(hand)} cm`);
    F.verdict(sFeet <= 0.01 && mFeet <= 0.03, "Sam's feet stay where they stand (1 cm), the man's too (3 cm)", `Sam's ${cm(sFeet)} cm · the man's ${cm(mFeet)} cm`);
    F.verdict(floor >= 0.08, 'no joint of either but the feet they stand on comes within 8 cm of the floor line', `lowest joint ${cm(floor)} cm up`);
    F.verdict(pop <= 0.05, 'no joint of either moves more than 5 cm in a frame', `fastest: ${cm(pop)} cm, ${popAt}`); }
  // 4. eased off part way down: both stand back up, the hold goes on. An ease-off pops by itself with the lowering off (the choke's own clock lets go in a frame:
  //    Sam's head 8 cm, the man's fingers) — the lowering must add nothing to that, so it is held against the same ease-off with the lowering off; and with it on
  //    Sam's own trunk and arm come back out on the eased clock, so no joint of HIS pops at all
  for (const at of [tap + 150, tap + 165]) {
    const E = await chokeRun(true, true, at, 60), P = await chokeRun(true, false, at, 60);
    if (E.err || P.err || E.out >= 0 || E.man.length < at + 60 || P.man.length < at + 60) { F.verdict(false, `the choke eased off at frame ${at}: the hold goes on`, E.err ?? P.err ?? (E.out >= 0 ? `he was out at frame ${E.out}` : `only ${E.man.length} | ${P.man.length} frames`)); continue; }
    const held = tap - 5, e = E.man.length - 1, dip = E.man[held].hips[1] - E.man[at - 1].hips[1], mUp = E.man[held].hips[1] - E.man[e].hips[1], sUp = E.sam[held].hips[1] - E.sam[e].hips[1];
    const [pop, popAt] = fastest(E, at), [pop0, pop0At] = fastest(P, at);
    let hips = 0; for (let i = at; i <= e; i++) hips = Math.max(hips, dist3(E.man[i].hips, E.man[i - 1].hips), dist3(E.sam[i].hips, E.sam[i - 1].hips));
    F.verdict(dip >= 0.1 && E.phase[e] === 'held' && Math.abs(mUp) <= 0.03 && Math.abs(sUp) <= 0.03, `the choke eased off ${cm(dip)} cm down (a tap at frame ${at}): a second later both stand as they did in the hold`,
      `phase '${E.phase[e]}', his hips ${cm(mUp)} cm under the hold's, Sam's ${cm(sUp)} cm`);
    let sam = 0, samAt = '', sam0 = 0; for (let i = at; i <= e; i++) { for (const k of Object.keys(E.sam[i])) { const d = dist3(E.sam[i][k], E.sam[i - 1][k]); if (d > sam) { sam = d; samAt = `${k} at frame ${i}`; } } sam0 = Math.max(sam0, dist3(P.sam[i].head, P.sam[i - 1].head)); }
    F.verdict(sam <= 0.04, 'eased off, no joint of Sam moves more than 4 cm in a frame: his trunk and arm come back out of the choke over half a second',
      `fastest ${cm(sam)} cm (${samAt}) · with the lowering off his head goes ${cm(sam0)} cm in one frame`);
    F.verdict(hips <= 0.02 && pop <= pop0 + 0.005, 'on the way back up neither pelvis moves more than 2 cm a frame, and no joint moves faster than the fastest of the same ease-off with the lowering off',
      `hips ${cm(hips)} cm a frame · fastest ${cm(pop)} cm (${popAt}) against ${cm(pop0)} cm (${pop0At}) with it off`);
  }
  return F.done();
}


// ───────────────────────────────────────────────────────────── kill
interface KillRun { err: string | null; n: number; out: number; kind: string; fell: string | null; by: '' | 'check' | 'rule'; tap: number; man: Record<string, P3>[]; sam: Record<string, P3>[]; phase: string[]; yaw: number; lie: number[]; rest: number }
/** the grab, the hold, and at KILL_TAP the phase `phase` put on (see killEnd), both skeletons after every frame until he is out (`n` of them) and FALL frames
 *  on into the fall — then the fall to `settle` frames. `kill` = the half; `plain` = takeFall told no `how` (only where this file ends the phase: `by` says
 *  who did); `ease` = a choke first (the row at frame 90), eased off by a tap on that frame, and the phase put on ten frames after it (`tap`) */
const FALL = 20;
async function killRun(on: boolean, kill: boolean, o: { phase?: string; plain?: boolean; frames?: number; settle?: number; ease?: number } = {}): Promise<KillRun> {
  const rnd = Math.random, knobs = KN.knobsCopy(), R: KillRun = { err: null, n: 0, out: -1, kind: '', fell: null, by: '', tap: KILL_TAP, man: [], sam: [], phase: [], yaw: 0, lie: [], rest: NaN };
  try {
    const S = await hold(on, 'choke'), { g, vic } = S, ph = o.phase ?? 'kill', tap = R.tap = o.ease !== undefined ? o.ease + 10 : KILL_TAP; TAKEDOWN.kill = kill; const fell = watchFall(vic.char); S.begin(); R.yaw = vic.char.bodyYaw;
    const end = tap + (o.frames ?? Math.ceil(HOLD.secs.kill * 60) + 30);
    for (let f = 0; f < end; f++) {
      if (o.ease !== undefined) { S.during?.(f); if (f === o.ease) S.W.input.pressed.add('Space'); }
      if (f === tap) setHoldPhase(g, ph);
      S.step(); if (killEnd(g, o.plain ? undefined : 'kill')) R.by = 'check';
      if (vic.state === 'dead') { R.out = f + 1; R.kind = String(vic.downKind); R.fell = fell.last; R.by ||= 'rule'; break; }
      R.man.push(copyBones(vic.char)); R.sam.push(copyBones(g.player.char)); R.phase.push(String(g.player.holding?.phase ?? '-')); R.n++;
    }
    const rag = vic.char.ragdoll;
    if (R.out >= 0 && rag && o.settle) { for (let k = 1; k <= o.settle; k++) { if (k <= FALL) { R.man.push(copyBones(vic.char)); R.sam.push(copyBones(g.player.char)); } S.step(); if (Number.isNaN(R.rest) && rag.sleeping) R.rest = k * DT; } R.lie = Array.from(rag.x as ArrayLike<number>); }
  } catch (e) { R.err = e instanceof Error ? e.message : String(e); }
  finally { KN.knobsBack(knobs); Math.random = rnd; }
  return R;
}
const segDist = (p: P3, a: P3, b: P3) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return dist3(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]); };
/** a point in the man's own frame as he stood (his facing `yaw`): [to his left, up, ahead] of `o` */
const inFrame = (p: P3, o: P3, yaw: number): P3 => { const dx = p[0] - o[0], dz = p[2] - o[2]; return [dx * Math.cos(yaw) - dz * Math.sin(yaw), p[1] - o[1], dx * Math.sin(yaw) + dz * Math.cos(yaw)]; };
/** the fastest any joint goes in a frame over [from, to), Sam's knife arm apart (it is a slash) */
function steps(R: { man: Record<string, P3>[]; sam: Record<string, P3>[] }, from: number, to: number): { body: number; bodyAt: string; knife: number; knifeAt: string } {
  const o = { body: 0, bodyAt: '', knife: 0, knifeAt: '' };
  for (let i = Math.max(1, from); i < Math.min(to, R.man.length); i++) for (const [who, b] of [['man', R.man], ['Sam', R.sam]] as const) for (const k of Object.keys(b[i])) {
    const d = dist3(b[i][k], b[i - 1][k]), arm = who === 'Sam' && /^(handR|forearmR|fingerR)$/.test(k);
    if (arm) { if (d > o.knife) { o.knife = d; o.knifeAt = `${k} at frame ${i}`; } } else if (d > o.body) { o.body = d; o.bodyAt = `${who}'s ${k} at frame ${i}`; }
  }
  return o;
}
export async function takedownKill(): Promise<boolean> {
  const F = family("takedown-kill: the kill from the hold is a move — a hand over his mouth, the blade across his throat and out wide, the man let down forward with Sam going down after him, and on into the fold; the half off = the hold's own pose and the old fall");
  const T = HOLD.secs.kill, N = Math.ceil(T * 60), hitF = KILL_TAP + Math.round(HOLD.kill.hit * T * 60);
  const K = await killRun(true, true, { settle: 300 }), X = await killRun(true, false, { settle: 300 }), X0 = await killRun(true, false, { plain: true, settle: 300 }), Hd = await killRun(true, false, { phase: 'held', frames: N + 30 });
  const bads = [K, X, X0, Hd].filter(r => r.err); if (bads.length || K.out < 0 || X.out < 0 || X0.out < 0) { F.verdict(false, 'the kill ran to its end', bads.map(r => r.err).join(' | ') || `never out: on ${K.out} · off ${X.out} | ${X0.out}`); return F.done(); }
  console.log(`    NOTE — the phase is put on from tools/qa at frame ${KILL_TAP} (as player.ts setPhase puts one on) and ended at HOLD.secs.kill ${T} s by ${K.by === 'rule' ? "player.ts's own rule (this file's killEnd found the hold already gone)" : "this file's killEnd — takeFall + killGuard, as the rule does: this build's updateHold runs 'kill' as a phase it ends nothing in"}. The fall's style is caught as takeFall writes it on the man, whoever calls it. The cut is due at frame ${hitF} (HOLD.kill.hit ${HOLD.kill.hit}).`);
  const last = K.n - 1, t0 = KILL_TAP - 1, yaw = K.yaw;
  { // 1. the blade: across his throat at the cut, then out wide and clear of him to the end
    const lat = (i: number) => inFrame(K.sam[i].handR, K.man[i].neck, yaw)[0], flatTo = (i: number) => flat(K.sam[i].handR, K.man[i].neck);
    let far = -Infinity, cross = -1, wide = 0, wideAt = -1; for (let i = KILL_TAP; i <= last; i++) { const x = lat(i); if (cross < 0) far = Math.max(far, x); if (cross < 0 && i > KILL_TAP && lat(i - 1) > 0 && x <= 0) cross = i; if (cross >= 0) { wide = Math.max(wide, flatTo(i)); if (wideAt < 0 && flatTo(i) >= 0.45) wideAt = i; } }
    const at = cross >= 0 ? dist3(K.sam[cross].handR, K.man[cross].neck) : NaN; let clear = Infinity; for (let i = Math.max(wideAt, 0); i <= last && wideAt >= 0; i++) clear = Math.min(clear, flatTo(i));
    F.verdict(far >= 0.03 && cross >= 0 && Math.abs(cross + 1 - hitF) <= 2 && at >= 0.08 && at <= 0.18, "ON: the knife fist is set past the middle of his neck on its far side and comes back across it at the cut (within 2 frames of HOLD.kill.hit), the wrist 8 to 18 cm off the neck joint (the blade a fist under it)",
      `furthest to his left of his neck ${cm(far)} cm · crosses its middle on frame ${cross + 1} (due ${hitF}) · ${cm(at)} cm from the neck joint there`);
    F.verdict(wideAt >= 0 && wideAt - cross <= 18 && clear >= 0.4, 'ON: …and on out WIDE: 45 cm or more from his neck on the plan inside 0.3 s of the cut, and never back inside 40 cm of it until he is let go',
      `45 cm out on frame ${wideAt + 1} (${wideAt - cross} frames after the cut) · widest ${cm(wide)} cm · nearest after that ${cm(clear)} cm`);
    // his own arms out of the blade's way: startled FORWARD off the hand on his mouth, where the choke brings them in to his neck
    let elbow = Infinity, fore = Infinity, out = 0; for (let i = KILL_TAP + 4; i <= Math.max(wideAt, cross + 8) && cross >= 0 && i <= last; i++) { elbow = Math.min(elbow, dist3(K.sam[i].handR, K.man[i].forearmR)); fore = Math.min(fore, segDist(K.sam[i].handR, K.man[i].forearmR, K.man[i].handR)); }
    for (let i = KILL_TAP; i < hitF; i++) out = Math.max(out, Math.min(inFrame(K.man[i].handL, K.man[i].neck, yaw)[2], inFrame(K.man[i].handR, K.man[i].neck, yaw)[2]));
    F.verdict(out >= 0.25 && elbow >= 0.12 && fore >= 0.12, "ON: before the cut BOTH his wrists are flung 25 cm or more ahead of his neck (a startle, out of the two men's outline — not in to his throat as in the choke), and from the blade being set until it is out wide Sam's knife wrist never comes within 12 cm of his right elbow or forearm",
      `the nearer wrist ${cm(out)} cm ahead of his neck · knife wrist to his right elbow ${cm(elbow)} cm, to his forearm ${cm(fore)} cm at the nearest`); }
  { // 2. his head back before the cut · both going down by the end, Sam's hand on him all the way
    const back = (i: number) => inFrame(K.man[i].head, K.man[i].neck, yaw), b0 = back(t0), b1 = back(hitF - 2);
    const up = (b: P3) => Math.atan2(-b[2], b[1]) / DEG;   // ° the neck → head line leans BACK of upright
    F.verdict(up(b1) - up(b0) >= 8, "ON: before the cut his head is hauled BACK: the line from his neck to his head leans 8° or more further back than in the hold", `${f2(up(b0))}° in the hold → ${f2(up(b1))}° two frames before the cut`);
    const stood = hitF + Math.round((HOLD.kill.go - HOLD.kill.hit) * T * 60) - 2, st = K.man[t0].hips[1] - K.man[Math.min(stood, last)].hips[1];
    const mh = K.man[t0].hips[1] - K.man[last].hips[1], sh = K.sam[t0].hips[1] - K.sam[last].hips[1], hf = inFrame(K.man[last].head, K.man[t0].head, yaw)[2];
    F.verdict(mh >= 0.25 && hf >= 0.2 && st <= 0.03, "ON: he stands cut for a beat (his pelvis within 3 cm of the hold's until HOLD.kill.go), then goes: on the clock's last frame it is 25 cm or more lower and his head 20 cm or more further forward — going down and forward, not dropped from his height", `pelvis ${cm(st)} cm lower ${stood - hitF} frames after the cut · ${cm(mh)} cm lower on the last frame · head ${cm(hf)} cm forward`);
    const hd = K.sam[t0].head[1] - K.sam[last].head[1], sLow = offFloor(K.sam[last]), sFeet = Math.max(dist3(K.sam[last].footL, K.sam[t0].footL), dist3(K.sam[last].footR, K.sam[t0].footR));
    F.verdict(sh >= 0.12 && sh <= 0.3 && hd >= 0.2 && sLow >= 0.3 && sFeet <= 0.02 && offFloor(K.man[last]) >= 0.08, 'ON: Sam goes down WITH him and stays on his feet — his pelvis 12 to 30 cm lower than in the hold, his head 20 cm or more lower, his feet where they stood (2 cm), no other joint of his under 30 cm — and no joint of the man but his feet is at the floor yet',
      `Sam's pelvis ${cm(sh)} cm down, head ${cm(hd)} cm (at ${f2(K.sam[last].head[1])} m), his lowest joint off his feet ${cm(sLow)} cm up, feet moved ${cm(sFeet)} cm · the man's lowest joint ${cm(offFloor(K.man[last]))} cm up`);
    let on = Infinity, off = 0; for (let i = hitF + 18; i <= last; i++) { const d = segDist(K.sam[i].handL, K.man[i].chest, K.man[i].neck); on = Math.min(on, d); off = Math.max(off, d); }
    const went = K.sam[hitF + 18].handL[1] - K.sam[last].handL[1], sho = dist3(K.sam[last].handL, K.man[last].upperArmL);
    F.verdict(on >= 0.05 && off <= 0.24 && went >= 0.2 && sho <= 0.2, "ON: the hand that lets him down stays ON him and goes down with him: from 0.3 s after the cut to the end its wrist is 5 to 24 cm from the line of his upper spine (chest joint to neck), by the last frame it is 20 cm or more lower and within 20 cm of his left shoulder joint", `nearest ${cm(on)} cm · furthest ${cm(off)} cm · ${cm(went)} cm lower by the end · ${cm(sho)} cm from his shoulder joint there`); }
  { // 3. nothing pops: the whole move (it is a commit: nothing cancels it), and on into the fall; Sam comes up off him slowly while he stands where he is
    const st = steps(K, KILL_TAP, K.n), fl = steps(K, K.n, K.man.length);
    F.verdict(st.body <= 0.06 && st.knife <= 0.1, "ON: through the whole move no joint of either moves more than 6 cm in a frame (his hands falling from his throat are the fastest) — the knife arm's elbow, wrist and knuckle, which slash out to arm's length, no more than 10 cm", `fastest ${cm(st.body)} cm (${st.bodyAt}) · the knife arm ${cm(st.knife)} cm (${st.knifeAt})`);
    F.verdict(K.man.length >= K.n + FALL && fl.body <= 0.07 && fl.knife <= 0.05, `ON: …nor on into the fall: over the frame he is let go on and the ${FALL} after it no joint moves more than 7 cm in a frame (a body falling), Sam's knife arm no more than 5 cm`, `fastest ${cm(fl.body)} cm (${fl.bodyAt}) · the knife arm ${cm(fl.knife)} cm (${fl.knifeAt})`);
    await riseLines(F, 'kill', 12, 0.5, 54, "the man leaves his arm"); }
  { // 4. the end: dead on the clock's frame, by the knife, the fold forward, at rest
    const fwd: P3 = [Math.sin(yaw), 0, Math.cos(yaw)], feet = K.man[t0].hips, hd = K.lie.length ? [K.lie[RAG.head * 3], 0, K.lie[RAG.head * 3 + 2]] : [NaN, 0, NaN], along = (hd[0] - feet[0]) * fwd[0] + (hd[2] - feet[2]) * fwd[2];
    F.verdict(K.out === X.out && K.kind === 'shot' && X.kind === 'shot' && K.out - KILL_TAP >= N && K.out - KILL_TAP <= N + 2, "either way he is dead (downKind 'shot') on the same frame, the clock's own", `out at frame ${X.out} | ${K.out} (${K.out - KILL_TAP} frames after the phase went on; the clock is ${N}) · ${X.kind} | ${K.kind}`);
    F.verdict(K.fell === 'fold' && Number.isFinite(K.rest) && K.rest <= 4 && along > 0.3, "ON: he goes on down the way he was going — takeFall leaves the FOLD on him — asleep inside four seconds with his head in front of where he stood", `fall '${K.fell}' (ended by the ${K.by}) · asleep at ${f2(K.rest)} s · head ${f2(along)} m along his facing`); }
  { // 5. the half off: the phase is the hold's pose bone for bone, and the fall the old one
    let d = 0; const n = Math.min(X.n, Hd.n); for (let i = 0; i < n; i++) d = Math.max(d, mapDiff(X.man[i], Hd.man[i]), mapDiff(X.sam[i], Hd.sam[i]));
    F.verdict(n >= KILL_TAP + N - 1 && d <= 1e-9, "OFF ('the kill from the hold' off): every frame of the 'kill' phase is the 'held' phase's, bone for bone, both men", `largest bone difference over ${n} frames ${d.toExponential(1)} m`);
    const mine = X0.by === 'check', lie = X.lie.length && X.lie.length === X0.lie.length ? numsDiff(X.lie, X0.lie) : Infinity, apart = K.lie.length === X.lie.length ? numsDiff(K.lie, X.lie) : NaN;
    F.verdict(X.fell === (BREAK ? null : 'sink') && X0.fell === X.fell && lie <= 1e-9 && apart > 0.05 === !BREAK, `OFF: takeFall(…, 'kill') leaves the knife from behind's fall on him — he SINKS where he stood — and the body does not lie where the fold leaves it${mine ? '; told no `how` at all it is the same fall and the same body' : " (the phase is ended by player.ts's rule here: the run told no `how` is this one over again)"}`, `fall '${X.fell}' | '${X0.fell}' (ended by the ${X.by} | ${X0.by}) · the two bodies ${lie.toExponential(1)} m apart at 5 s · on against off: ${cm(apart)} cm`);
    { let dg = 0; const G = await killRunGun(); if (G.err) F.verdict(false, 'the gun hold: the phase ran', G.err); else { for (let i = 0; i < Math.min(G.a.length, G.b.length); i++) dg = Math.max(dg, mapDiff(G.a[i], G.b[i]));
        F.verdict(G.a.length >= N - 1 && dg <= 1e-9, "ON, the GUN hold (the pistol at his head, no knife in the fist): the 'kill' phase is drawn as the hold, bone for bone, both men", `largest bone difference over ${G.a.length} frames ${dg.toExponential(1)} m`);
        let da = 0; for (let i = 0; i < Math.min(G.c.length, G.d.length); i++) da = Math.max(da, mapDiff(G.c[i], G.d[i]));
        F.verdict(G.c.length >= 30 && G.d.length === G.c.length && da <= 1e-9, "…and let go of at its end Sam's arms come off the man at the rate they always did: half a second of his bones after it, the half on against off, the same (the slow way up is the knife's)", `largest difference in Sam's bones over ${G.c.length} frames after the man is down ${da.toExponential(1)} m`); } } }
  // 6. the phase put on ten frames after a choke EASED OFF — the blade still down on his shoulder (kn), the eased choke clock and the lowering still on their way back
  for (const u of [0.4, 0.8]) { const ease = 90 + Math.round((HOLD.secs.chokeHold + u * HOLD.secs.choke) * 60) + 1, E = await killRun(true, true, { ease });
    if (E.err || E.out < 0 || E.phase[ease - 1] !== 'choke' || E.phase[E.tap - 1] !== 'held') { F.verdict(false, `a choke eased off ${Math.round(u * 100)} % in (frame ${ease}), the kill ten frames later: it ran`, E.err ?? `out ${E.out} · phase before the ease '${E.phase[ease - 1]}', before the kill '${E.phase[E.tap - 1]}'`); continue; }
    const st = steps(E, E.tap, E.n), dn = E.man[89].hips[1] - E.man[E.tap - 1].hips[1];
    F.verdict(st.body <= 0.07 && st.knife <= 0.1, `ON: a choke eased off ${Math.round(u * 100)} % in and the kill begun ten frames later, the choke's springs still on their way back: no joint of either moves more than 7 cm in a frame (his arms coming up off the hang into the startle), the knife arm no more than 10`, `his pelvis still ${cm(dn)} cm under the hold's as the kill began · fastest ${cm(st.body)} cm (${st.bodyAt}) · the knife arm ${cm(st.knife)} cm (${st.knifeAt}) · dead at frame ${E.out} (${E.out - E.tap} after the phase went on)`); }
  return F.done();
}
/** the gun hold through `kill` against the same frames `held`: both men's bones in one map a frame (a · b) — and the phase ended there by killEnd, Sam's bones
 *  over the half second after, the half on (c) against off (d) */
async function killRunGun(): Promise<{ err: string | null; a: Record<string, P3>[]; b: Record<string, P3>[]; c: Record<string, P3>[]; d: Record<string, P3>[] }> {
  const out: { err: string | null; a: Record<string, P3>[]; b: Record<string, P3>[]; c: Record<string, P3>[]; d: Record<string, P3>[] } = { err: null, a: [], b: [], c: [], d: [] }, n = Math.ceil(HOLD.secs.kill * 60);
  for (const [half, to] of [[true, out.c], [false, out.d]] as const) { const rnd = Math.random, knobs = KN.knobsCopy();
    try { const S = await hold(true, 'whip'), { g, vic } = S; TAKEDOWN.kill = half; S.begin();
      for (let f = 0; f < KILL_TAP + n + 40 && to.length < 30; f++) { if (f === KILL_TAP) setHoldPhase(g, 'kill'); S.step(); killEnd(g); if (vic.state === 'dead') to.push(copyBones(g.player.char)); }
    } catch (e) { out.err = e instanceof Error ? e.message : String(e); } finally { KN.knobsBack(knobs); Math.random = rnd; } }
  for (const [ph, to] of [['kill', out.a], ['held', out.b]] as const) { const rnd = Math.random, knobs = KN.knobsCopy();
    try { const S = await hold(true, 'whip'), { g, vic } = S; S.begin();
      for (let f = 0; f < KILL_TAP + n - 1; f++) { if (f === KILL_TAP) setHoldPhase(g, ph); S.step(); if (f >= KILL_TAP) { const m: Record<string, P3> = {}, a = copyBones(vic.char), b = copyBones(g.player.char); for (const k of Object.keys(a)) m[`m.${k}`] = a[k]; for (const k of Object.keys(b)) m[`s.${k}`] = b[k]; to.push(m); } }
    } catch (e) { out.err = e instanceof Error ? e.message : String(e); } finally { KN.knobsBack(knobs); Math.random = rnd; } }
  return out;
}

// ───────────────────────────────────────────────────────────── beats
export async function takedownBeats(): Promise<boolean> {
  const F = family("takedown-beats: the choke's beats off the clips — both his hands on the forearm a quarter second in, off it and hanging before he is lowered, his head to the side before it comes forward; out on the frame he always was");
  const B = await chokeRun(true, true), P = await chokeRun(true, true, -1, 0, false), bads = [B, P].filter(r => r.err || r.out < 0);
  if (bads.length) { for (const r of bads) F.verdict(false, 'the choke ran to its end', r.err ?? 'he was never out'); return F.done(); }
  const c0 = B.phase.indexOf('choke'), C = HOLD.secs.choke * 60, at = (u: number) => Math.min(B.man.length - 1, c0 + Math.round(u * C));
  F.verdict(B.out === P.out && B.kind === 'choked' && P.kind === 'choked' && c0 > 0 && c0 === P.phase.indexOf('choke'), 'beats or not, the choke starts and he is out on the same frames, out cold', `choke from frame ${c0} | ${P.phase.indexOf('choke')} · out at ${P.out} | ${B.out} · ${P.kind} | ${B.kind}`);
  { const i = c0 + 21, on = (R: ChokeRun) => Math.max(segDist(R.man[i].handL, R.sam[i].forearmL, R.sam[i].handL), segDist(R.man[i].handR, R.sam[i].forearmL, R.sam[i].handL)), a = on(B), b = on(P);
    F.verdict(a <= 0.13 && b >= a + 0.08, 'ON: 0.35 s into the choke BOTH his wrists are within 13 cm of the forearm at his throat; OFF: one is still 8 cm or more further off', `the further wrist: ${cm(a)} cm on · ${cm(b)} cm off`); }
  { const i = at(0.62), j = at(0.5), drop = (R: ChokeRun) => Math.min(R.man[i].neck[1] - R.man[i].handL[1], R.man[i].neck[1] - R.man[i].handR[1]), sunk = B.man[j].hips[1] - B.man[i].hips[1], a = drop(B), b = drop(P);
    F.verdict(a >= 0.3 && sunk <= 0.05 && b <= 0.15, "ON: 62 % of the way through, both his hands hang 30 cm or more under his neck while his pelvis has not yet gone 5 cm down — off the arm BEFORE he is lowered; OFF: a hand is still within 15 cm of his neck's height", `the higher hand ${cm(a)} cm under his neck on · ${cm(b)} cm off · his pelvis ${cm(sunk)} cm down since half way`); }
  { // down sooner and deeper, and HELD at the bottom: the last third of a second nothing sinks further (off, he is still going down when he is let go)
    const i = at(1 - 0.33 / HOLD.secs.choke), e = B.man.length - 1, mv = (R: ChokeRun) => Math.max(Math.abs(R.man[e].hips[1] - R.man[i].hips[1]), Math.abs(R.sam[e].hips[1] - R.sam[i].hips[1])), a = mv(B), b = mv(P);
    const bow = (R: ChokeRun) => { const c = R.man[e].chest, h = R.man[e].hips; return Math.atan2(Math.hypot(c[0] - h[0], c[2] - h[2]), c[1] - h[1]) / DEG; }, sd = P.sam[e].hips[1] - B.sam[e].hips[1];
    F.verdict(a <= 0.01 && b >= 0.05 && bow(B) >= bow(P) + 5 && sd >= 0.05, "ON: the bottom is a beat of its own — over the choke's last 0.33 s neither pelvis moves 1 cm (OFF: one is still 5 cm or more from where it ends) — and deeper: his trunk (hips to chest joint) bowed 5° or more further forward than with the beats off, Sam's pelvis 5 cm or more lower", `pelvis travel over the last ${e - i} frames ${cm(a)} cm on · ${cm(b)} cm off · his hips → chest line ${f2(bow(B))}° off upright on · ${f2(bow(P))}° off · Sam's pelvis ${cm(sd)} cm lower`); }
  { const side = (R: ChokeRun, i: number) => inFrame(R.man[i].head, R.man[i].neck, R === B ? yawB : yawP), yawB = Math.PI / 2, yawP = Math.PI / 2;
    const i0 = at(0.45), i1 = at(0.63), tip = Math.abs(side(B, i1)[0] - side(B, i0)[0]), fw = side(B, i1)[2] - side(B, i0)[2], fwEnd = side(B, at(0.9))[2] - side(B, i0)[2], tipP = Math.abs(side(P, i1)[0] - side(P, i0)[0]);
    F.verdict(tip >= 0.012 && tip >= tipP + 0.01 && fwEnd >= fw + 0.02, 'ON: his head tips to the side first (its joint 1.2 cm or more across his neck, 1 cm more than with the beats off, by 63 % of the choke) and comes forward after', `head sideways ${cm(tip)} cm on · ${cm(tipP)} cm off · forward ${cm(fw)} cm by then, ${cm(fwEnd)} cm by 90 %`); }
  { const [pop, popAt] = fastest(B, c0 + 1); F.verdict(pop <= 0.05, 'ON: no joint of either moves more than 5 cm in a frame, the whole choke', `fastest ${cm(pop)} cm, ${popAt}`); }
  for (const tap of [c0 + Math.round(0.3 * C), c0 + Math.round(0.6 * C)]) {   // eased off with his hands on the arm, and with them falling
    const E = await chokeRun(true, true, tap, 60), Q = await chokeRun(true, true, tap, 60, false);
    if (E.err || Q.err || E.out >= 0 || E.man.length < tap + 60) { F.verdict(false, `the choke eased off at frame ${tap}: the hold goes on`, E.err ?? Q.err ?? (E.out >= 0 ? `he was out at frame ${E.out}` : `only ${E.man.length} frames`)); continue; }
    const [pop, popAt] = fastest(E, tap), [pop0, pop0At] = fastest(Q, tap);
    F.verdict(E.phase[E.man.length - 1] === 'held' && pop <= Math.max(0.05, pop0 + 0.005), `eased off at frame ${tap}: the hold goes on, and no joint moves faster than 5 cm a frame or than the same ease-off with the beats off`, `fastest ${cm(pop)} cm (${popAt}) against ${cm(pop0)} cm (${pop0At}) with them off`);
  }
  { const G = await regrabRun();   // a choke broken off, the man grabbed again: the beats start over with the hold
    F.verdict(!G.err && G.broke >= 0.55 && G.n >= 50 && G.worst <= 0.05, "a choke broken off part way (Sam shot: Game.freeHeld('shot')), the man grabbed again once he is loose: from the new grab's 6th frame to a second in, neither of his wrists is more than 5 cm further under his neck than at the same frame of the first grab — the beats' clock starts over with the hold (on the choke's own, never reset, he began it with his hands already off the arm)",
      G.err ?? `broken off ${Math.round(G.broke * 100)} % in · over ${G.n} frames the worst a wrist hangs under the first grab's: ${cm(G.worst)} cm (${G.at})`); }
  await riseLines(F, 'choke', 24, 0.6, 108, 'he is out');
  return F.done();
}
/** the first grab and hold (90 frames), the choke to 62 %, the hold broken by freeHeld('shot'), a second and a half for the man to come loose, Sam behind him
 *  again and a second grab: how far each wrist is under his neck at frame k of each grab — the worst the second is under the first */
async function regrabRun(): Promise<{ err: string | null; broke: number; n: number; worst: number; at: string }> {
  const rnd = Math.random, knobs = KN.knobsCopy(), R = { err: null as string | null, broke: 0, n: 0, worst: -Infinity, at: '' };
  try {
    const S = await hold(true, 'choke'), { g, vic } = S, b = vic.char.bones, under = () => [b.neck[1] - b.handL[1], b.neck[1] - b.handR[1]];
    const first: number[][] = []; S.begin(); let f = 0;
    for (; f < 90; f++) { S.step(); first.push(under()); }
    for (; f < 600; f++) { S.during?.(f); S.step(); const H = g.player.holding; if (!H || vic.state === 'dead') throw new Error(`the hold ended by itself at frame ${f}`); if (H.phase === 'choke' && H.t >= 0.62 * HOLD.secs.choke) { R.broke = H.t / HOLD.secs.choke; break; } }
    g.freeHeld('shot'); for (let k = 0; k < 90; k++) S.step();
    if (g.player.holding || vic.state === 'dead' || vic.char.ragdoll) throw new Error(`after freeHeld: holding ${!!g.player.holding} · his state ${vic.state}`);
    S.behind!(); startGrab(g, vic); if (!g.player.holding) throw new Error('the second grab did not take');
    for (let k = 0; k < 60; k++) { S.step(); const u = under(); if (k >= 5) { R.n++; for (const s of [0, 1]) { const d = u[s] - first[k][s]; if (d > R.worst) { R.worst = d; R.at = `his ${s ? 'right' : 'left'} wrist at frame ${k + 1} of the grab`; } } } }
  } catch (e) { R.err = e instanceof Error ? e.message : String(e); }
  finally { KN.knobsBack(knobs); Math.random = rnd; }
  return R;
}
/** AFTER THE MAN IS OUT OF HIS ARM (the choke run to its end / the kill): Sam's head height for two seconds — the half on or off, standing where he is, walked
 *  off from that frame (W held), or standing still with the pistol drawn and raised from that frame ('aim': the holster flag off and the right button held —
 *  `upper` = the animator's upper mode from the frame it leaves 'none', `seen` = that frame). `left` = the share of the way back up still to go at frame k
 *  (against where the head is at the end of the run). */
async function riseRun(end: 'choke' | 'kill', half: boolean, walk: boolean | 'aim'): Promise<{ err: string | null; down: number; left: (k: number) => number; gap: (k: number) => number; speed: number; upper: string; seen: number }> {
  const rnd = Math.random, knobs = KN.knobsCopy(), head: number[] = []; let err: string | null = null, held = NaN, speed = 0, upper = 'none', seen = -1;
  try {
    const S = await hold(true, 'choke'), { g, vic } = S, sam = g.player.char; if (end === 'kill') TAKEDOWN.kill = half; else TAKEDOWN.chokeBeats = half; S.begin();
    for (let f = 0; f < 600 && vic.state !== 'dead'; f++) { if (end === 'kill') { if (f === KILL_TAP) setHoldPhase(g, 'kill'); } else S.during?.(f); if (f === 89) held = sam.bones.head[1]; S.step(); if (end === 'kill') killEnd(g); if (vic.state !== 'dead') head[0] = sam.bones.head[1]; }
    if (vic.state !== 'dead') throw new Error('he was never out');
    for (let k = 1; k <= 120; k++) { if (walk === true) S.W.input.keys.add('KeyW'); if (walk === 'aim') { g.player.holstered = false; S.W.input.buttons |= 2; }
      S.step(); head.push(sam.bones.head[1]); speed = Math.max(speed, Math.hypot(sam.vel[0], sam.vel[2])); if (seen < 0 && sam.anim.upper !== 'none') { seen = k; upper = String(sam.anim.upper); } }
    S.W.input.keys.delete('KeyW'); S.W.input.buttons &= ~2;
  } catch (e) { err = e instanceof Error ? e.message : String(e); }
  finally { KN.knobsBack(knobs); Math.random = rnd; }
  const ref = head[head.length - 1];
  return { err, down: held - head[0], speed, upper, seen, left: k => (ref - head[k]) / (ref - head[0]), gap: k => ref - head[k] };
}
/** …its three lines, for either end: ON and standing still he comes up slowly; the half OFF he is up at once, as ever; ON and walked off he is up at once too */
async function riseLines(F: { verdict: Verdict }, end: 'choke' | 'kill', k: number, share: number, by: number, when: string) {
  const A = await riseRun(end, true, false), O = await riseRun(end, false, false), Wk = await riseRun(end, true, true), e = A.err ?? O.err ?? Wk.err;
  if (e) { F.verdict(false, `after the ${end}: the runs ran`, e); return; }
  const pc = (x: number) => `${Math.round(x * 100)} %`;
  F.verdict(A.down >= 0.2 && A.left(k) >= share && A.left(by) <= 0.1 && Math.abs(O.gap(k)) <= 0.03, `ON: once ${when} Sam does not pop upright — standing where he is, ${f2(k * DT)} s on ${pc(share)} or more of the way back up is still to go, and by ${f2(by * DT)} s he is up (a tenth or less left); the half OFF his head is within 3 cm of where it ends by ${f2(k * DT)} s, as ever`,
    `his head was ${cm(A.down)} cm under the hold's as ${when} · still to go at ${f2(k * DT)} s: ${pc(A.left(k))} (${cm(A.gap(k))} cm) on · ${cm(O.gap(k))} cm off · at ${f2(by * DT)} s: ${pc(A.left(by))} on`);
  F.verdict(A.down >= 0.2 && Wk.down >= 0.2 && Wk.speed >= 0.6 && Wk.left(k) <= 0.3 && Wk.left(k) <= A.left(k) - 0.3, `ON: …and it never holds him — walked off from that frame, the pose lets go at the rate it always did: ${pc(0.3)} or less of the way up left at ${f2(k * DT)} s, and 30 points less than standing still`,
    `walking ${f2(Wk.speed)} m/s · still to go at ${f2(k * DT)} s: ${pc(Wk.left(k))} walking · ${pc(A.left(k))} standing`);
  const Am = await riseRun(end, true, 'aim'); if (Am.err) { F.verdict(false, `after the ${end}, the gun raised: the run ran`, Am.err); return; }
  const j = Math.max(Am.seen, 0) + 15;   // (a quarter second after the animator is first told: the old rate has 6 % left by then)
  F.verdict(Am.down >= 0.2 && Am.seen >= 1 && Am.seen <= 6 && Am.speed < 0.1 && Am.left(j) <= 0.25 && Am.left(j) <= A.left(j) - 0.25, `ON: …nor does it hold his hands — standing STILL, the pistol drawn from that frame and the aim button held: a quarter second after the animator is first told (inside 0.1 s), a quarter or less of the way up is left, and 25 points less than standing idle (anything he is told to do hands the pose back at the old rate)`,
    `the animator's upper mode leaves 'none' for '${Am.upper}' at frame ${Am.seen} · moving ${f2(Am.speed)} m/s · still to go at ${f2(j * DT)} s: ${pc(Am.left(j))} with the gun out · ${pc(A.left(j))} idle`);
}

// ───────────────────────────────────────────────────────────── harness
export async function takedownHarness(): Promise<boolean> {
  const F = family('takedown-harness: the frozen stand holds the switch off, the page turns it on unless ?notakedown, the table is a registered knob table');
  const P = await import(`${ROOT}/src/host/profile.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`), was = { ...TAKEDOWN }, rnd = Math.random;
  try {
    { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_TAKEDOWN;
      if (frozen || word !== undefined) TAKEDOWN.on = word !== '1';   // (the other way up: the stand-up must WRITE it)
      const before = TAKEDOWN.on; await hushed(() => standUp()); const want = frozen || word !== undefined ? word === '1' : before;
      F.verdict(TAKEDOWN.on === want, frozen ? 'standUp() on the frozen stand puts TAKEDOWN.on to what TPS_TAKEDOWN says (unset: off — every stored digest has a man taken down fall and lie as he did)' : "standUp() on the shipped stand leaves TAKEDOWN.on to the page's boot (or to TPS_TAKEDOWN where it is given)",
        `before ${before} · after ${TAKEDOWN.on} · TPS_TAKEDOWN ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
      if (!frozen && word === undefined) { const c = KN.knobsCopy(); try { TAKEDOWN.on = false; P.shippedBoot?.(); F.verdict(TAKEDOWN.on === true, "the shipped stand's boot (the page with no flag) puts it ON", `after shippedBoot(): ${TAKEDOWN.on}`); } finally { KN.knobsBack(c); } } }
    { const row = P.FROZEN_HOLDS['TAKEDOWN.on']; F.verdict(row === 'TPS_TAKEDOWN=1' && E.STAND_ENV.includes('TPS_TAKEDOWN'), 'FROZEN_HOLDS names TAKEDOWN.on with the word that turns it on, and STAND_ENV carries that word', `FROZEN_HOLDS['TAKEDOWN.on'] = ${J(row)} · in STAND_ENV ${E.STAND_ENV.includes('TPS_TAKEDOWN')}`); }
    { const c = KN.knobsCopy(); let a: unknown, b: unknown, o: unknown;
      try { TAKEDOWN.on = false; P.pageSwitches(new URLSearchParams('')); a = TAKEDOWN.on; P.pageSwitches(new URLSearchParams('notakedown')); b = TAKEDOWN.on; P.pageSwitches(new URLSearchParams('noclose&nohandwork')); o = TAKEDOWN.on; } finally { KN.knobsBack(c); }
      F.verdict(a === true && b === false && o === true, "the page's boot (pageSwitches): no flag → on · ?notakedown → off · other flags leave it on", `'' → ${a} · 'notakedown' → ${b} · 'noclose&nohandwork' → ${o}`); }
    { const reg = KN.knobRegistry(), same = reg.TAKEDOWN === TAKEDOWN, inJ = KN.JOURNAL_KNOBS.includes('TAKEDOWN'); const c = KN.knobsCopy(), on0 = TAKEDOWN.on, hit0 = TAKEDOWN.partnerHit; TAKEDOWN.on = !on0; TAKEDOWN.partnerHit = hit0 + 1; KN.knobsBack(c);
      F.verdict(same && inJ && TAKEDOWN.on === on0 && TAKEDOWN.partnerHit === hit0, 'knobRegistry().TAKEDOWN is the table, a recording carries it (JOURNAL_KNOBS), knobsCopy / knobsBack put it back', `registry is the table ${same} · in JOURNAL_KNOBS ${inJ} · on put back ${TAKEDOWN.on === on0} · partnerHit put back ${TAKEDOWN.partnerHit === hit0}`); }
    { const JN: any = await import(`${ROOT}/src/game/journal.ts`), c = KN.knobsCopy(); let old: unknown[] = [], own: unknown[] = [];
      try { const W: any = await hushed(() => standUp()), g = W.game; Object.assign(TAKEDOWN, { on: true, lower: true, kill: true, chokeBeats: true });
        const snap = JN.knobsSnapshot(g), before = JSON.parse(JSON.stringify(snap)); for (const k of ['lower', 'kill', 'chokeBeats']) delete before.tables.TAKEDOWN[k];
        JN.applyKnobs(g, before); old = [TAKEDOWN.on, TAKEDOWN.lower, TAKEDOWN.kill, TAKEDOWN.chokeBeats];
        Object.assign(TAKEDOWN, { lower: false, kill: false, chokeBeats: false }); JN.applyKnobs(g, snap); own = [TAKEDOWN.on, TAKEDOWN.lower, TAKEDOWN.kill, TAKEDOWN.chokeBeats];
      } finally { KN.knobsBack(c); }
      F.verdict(J(old) === '[true,false,false,false]' && J(own) === '[true,true,true,true]', "a recording whose TAKEDOWN table has no lower / kill / chokeBeats key replays with those halves OFF (journal.ts applyKnobs); one that carries them replays with its own", `on · lower · kill · chokeBeats — a file from before: ${J(old)} · a file of this build: ${J(own)}`); }
  } finally { Object.assign(TAKEDOWN, was); Math.random = rnd; }
  return F.done();
}

const SUBS: Record<string, () => Promise<boolean>> = { harness: takedownHarness, rules: takedownRules, off: takedownOff, moves: takedownMoves, partner: takedownPartner, breathe: takedownBreathe, lower: takedownLower, kill: takedownKill, beats: takedownBeats };
if (import.meta.main) {
  const want = process.argv.slice(2).filter(a => !a.startsWith('-')), unknown = want.filter(w => !SUBS[w]);
  if (unknown.length) { console.log(`unknown: ${unknown.join(' ')} (one or more of: ${Object.keys(SUBS).join(' ')})`); process.exit(2); }
  if (BREAK) console.log("TAKEDOWN_BREAK=1: the switch is left OFF in the 'on' arm — the moves / partner / breathe / lower / kill / beats lines must fail");
  let ok = true; for (const k of want.length ? want : Object.keys(SUBS)) ok = await SUBS[k]() && ok;
  console.log(ok ? '\n=== takedown: ALL PASS ===' : '\n=== takedown: FAILED ==='); process.exit(ok ? 0 : 1);
}
