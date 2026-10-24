// 'stalk' — THE STALK (STALK, src/game/stalk.ts). The maintainer's design for the last metres to a man's back: "when you're close enough to an enemy … you can
// click and hold on an enemy and sam will creep toward him · click, let go to stop, and click again to continue · the game also controls the trajectory and speed
// and makes things smooth. it ends with you grabbing him · you get kicked out of the mode if he gets too far away, turns around, goes through a door".
//   bun run tools/qa/stalk-check.ts        (also `probes.ts stalk`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   grab      three seeds: hands empty, 2.6 m behind a man walking away at a patrol's pace, the left button pressed on him and kept down, no key: he is in Sam's
//             arm inside nine seconds, Sam never over the stalk's top pace and never changing speed by more than 0.2 m/s in a frame.
//   still     the same behind a man who stands: in his arm inside four seconds.
//   steer     begun from a rear quarter (120° off his facing, 2.4 m out) of a man who stands: it ends in the grab with Sam within 45° of dead astern.
//   let       the button let go half way: nothing is stalked, he is at rest inside half a second and stays where he is; pressed again, it ends in the grab.
//   out       with the button still down — the man turns to face him · the man is suddenly five metres off · something solid comes between them (the
//             collision's own answer, stubbed) · the man is onto him · a move key of the player's own: each ends it at once, and nobody is grabbed for two
//             seconds after with the button never let go.
//   tell      his body is the distance (STALK.tell): the reach's share and the rise only grow as he closes, through many frames of in-between; let go, the
//             pose stands still part way; with the tell off the reach is whole or nothing and he does not rise.
//   stepin    the grab a stalk ends in closes the gap in one eased step (STALK.catchSecs): no snap on its first frame, never over 4.5 m/s.
//   corner    his back on a wall, hands empty, the button held (STALK.corner): a man walking past is grabbed once he is past, by the same step in; no press,
//             or the switch off, and he walks by; a man facing him is not taken.
//   off       the key down: the same press and hold moves nobody and grabs nobody.
//   legs      with the polish down (stalkPolish(false): the frozen stand, ?stalkpolish=0, an old recording) the spring's clock and the sway's reach no leg, and
//             HOLD.wayShape off draws the bare hands as they first stood; with it up the sway never lets go of his legs (no knee twitch at the sine's zero).
//   lands     the ninth pass (HOLD.hitShape, HOLD.layAhead): the landing drives the man's hips ahead and back, and the choked man is laid down ahead of Sam's boots
//   catch     the eighth pass (STALK.yankWith, HOLD.catchShape): he goes back with the man in the haul, the lead hand goes over the shoulder and round the
//             throat, the man's hands fly out as he is hit, and in the hold he sits back onto Sam with his heels out — again after a walk.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?stalk=0` puts it off), rides a recording's
//             tables, and a recording from before the table replays with it off.
// STALK_BREAK=1 = the key left down where grab, still, steer and let ask for it up, the tell off where it is asked for, the step in at 0 s, the corner off, the duck at 0, the catch's two keys down, the old recording's keys left in: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how it looks or feels. tools/qa/stalk-page.cjs drives the real page on the software adapter.
import { standUp, ROOT } from './headless.ts';

const { STALK, STALK_STATS, stalkOn, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { TAKEDOWN, LAY_REACH, LAY_HALF } = await import(`${ROOT}/src/game/takedown.ts`);
const { HOLD, MOVES, READY_BARE_WAS } = await import(`${ROOT}/src/game/character.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.STALK_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, SAM: P3 = [6.2, 0, 19.5], SEEDS = [4411, 1, 2];   // (the lobby's open floor, some 15 m of it east of him)
const f2 = (n: number) => n.toFixed(2);
const f1 = (n: number) => n.toFixed(1);
let allPass = true, found = false, polFound: ReturnType<typeof polVals> | null = null;   // (found / polFound: the key and the polish as this stand had them when the check began)
let keyFound = false, lowFound = false;   // (the tenth pass's two keys as the check found them: on the page's stand they are the page's boot's)
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const up = () => !BREAK;

interface Ctx { W: any; g: any; A: any; walk: number; f: number; top: number; jerk: number; step(): void; press(): void; lift(): void; held(): boolean; gap(): number; astern(): number }
/** the lobby with the floor's men parked far off, one man `gap` m east of Sam facing east (walking away at `walk` m/s, moved by the check: the AI is off), Sam
 *  crouched with empty hands `bearing` degrees off the man's facing (180 = dead astern) */
async function world(on: boolean, seed: number, gap: number, walk: number, bearing = 180, shift: [number, number] = [0, 0]): Promise<Ctx> {
  Math.random = seeded(seed); const W: any = await quiet(() => standUp({ seed } as any)), g = W.game; CLOSE.on = true; STALK.on = on; stalkPolish(true); STALK.key = false; STALK.low = false; STALK.orbit = false;   // (STALK.orbit is down too: these cards are of a move key that ends the creep — stalkorbit-check has the keys that go round him. the frozen stand's pins write all of them at every stand-up: the polish is down there, and this check is of the stalk with it. The tenth pass's two keys are DOWN for every card but their own, `key` and `low`: the cards before them are of the hold that ends in the grab by itself and of the arm that comes up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  const [A, ...rest] = g.guards; for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  const a = EAST + bearing * Math.PI / 180, at: P3 = [SAM[0] + shift[0] + gap, 0, SAM[2] + shift[1]];   // (shift: the whole scene moved that far [x, z] across the lobby)
  A.char.pos = [...at]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [walk, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([at[0] + Math.sin(a) * gap, 0, at[2] + Math.cos(a) * gap]); g.player.crouch = true;
  const pl = g.player.char; let v0 = 0;
  const C: Ctx = { W, g, A, walk, f: 0, top: 0, jerk: 0,
    step: () => { if (C.walk > 0 && !A.held) { A.char.pos[0] += C.walk * DT; A.char.vel = [C.walk, 0, 0]; } else A.char.vel = [0, 0, 0];
      W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; C.f++;
      const v = Math.hypot(pl.vel[0], pl.vel[2]); C.top = Math.max(C.top, v); if (!g.player.holding) C.jerk = Math.max(C.jerk, Math.abs(v - v0)); v0 = v; },   // (the grab's own frame is the grab's: he and the man stop together)
    press: () => { W.input.buttons |= 1; W.input.clicked |= 1; }, lift: () => { W.input.buttons &= ~1; },
    held: () => g.player.holding?.g === A, gap: () => Math.hypot(pl.pos[0] - A.char.pos[0], pl.pos[2] - A.char.pos[2]),
    astern: () => { const b = Math.atan2(pl.pos[0] - A.char.pos[0], pl.pos[2] - A.char.pos[2]) - A.char.bodyYaw; return Math.abs(Math.atan2(Math.sin(b - Math.PI), Math.cos(b - Math.PI))) * 180 / Math.PI; } };
  for (let i = 0; i < 20; i++) { const w = C.walk; C.walk = 0; C.step(); C.walk = w; }   // (settle: he is crouched and still before the press)
  C.top = 0; C.jerk = 0; return C;
}
/** hold the button until he is in the arm (or `secs` run out): the seconds it took, or Infinity */
function holdToGrab(C: Ctx, secs: number): number { const f0 = C.f; let astern = -1; C.press(); for (let i = 0; i < secs * 60; i++) { if (C.gap() < 1.05 && astern < 0) astern = C.astern(); C.step(); if (C.held()) { (C as any).asternAt = astern < 0 ? C.astern() : astern; return (C.f - f0) * DT; } } return Infinity; }

async function grab() {
  console.log('\n=== grab: the button held on a man walking away ends with him in the arm, smoothly ===');
  const rows: string[] = []; let ok = true;
  for (const seed of SEEDS) {
    const C = await world(up(), seed, 2.6, C0.walk), g0 = STALK_STATS.grabs, t = holdToGrab(C, 12);
    ok &&= t < 9 && C.top <= STALK.pace + 0.03 && C.jerk <= 0.2 && STALK_STATS.grabs === g0 + 1;
    rows.push(`seed ${seed}: ${isFinite(t) ? `in his arm in ${f2(t)} s` : 'never grabbed'} · top speed ${f2(C.top)} m/s (the stalk's ${f2(STALK.pace)}) · the largest change of speed in a frame ${f2(C.jerk)} m/s`);
  }
  verdict(ok, 'hands empty, 2.6 m behind a man walking away at a patrol\'s pace, the left button pressed on him and kept down with no key: he is in the arm inside nine seconds, never over the stalk\'s pace, no frame changing his speed by more than 0.2 m/s', rows.join('\n    '));
}
const C0 = { walk: 1.15 };
async function still() {
  console.log('\n=== still: behind a man who stands ===');
  const C = await world(up(), SEEDS[0], 2.6, 0), t = holdToGrab(C, 8);
  verdict(t < 4 && C.jerk <= 0.2, 'the same behind a man who stands still: in the arm inside four seconds', `${isFinite(t) ? `in his arm in ${f2(t)} s` : 'never grabbed'} · top speed ${f2(C.top)} m/s · the largest change of speed in a frame ${f2(C.jerk)} m/s`);
}
async function steer() {
  console.log('\n=== steer: begun from a rear quarter, it swings him in behind ===');
  const C = await world(up(), SEEDS[0], 2.4, 0, 120), a0 = C.astern(), t = holdToGrab(C, 8), a1 = (C as any).asternAt ?? NaN;
  verdict(t < 6 && a1 < 45, 'begun 2.4 m out on a rear quarter of a man who stands (60° off dead astern), it ends in the grab with Sam within 45° of dead astern', `began ${f2(a0)}° off dead astern · ${isFinite(t) ? `in his arm in ${f2(t)} s, ${f2(a1)}° off dead astern as he came into reach` : 'never grabbed'}`);
}
async function letGo() {
  console.log('\n=== let: the button let go stops him where he is; pressed again he goes on ===');
  const C = await world(up(), SEEDS[0], 2.8, 0), pl = C.g.player.char;
  C.press(); for (let i = 0; i < 45; i++) C.step(); const moved = 2.8 - C.gap(), on0 = stalkOn(C.g) === C.A;
  C.lift(); C.step(); const on1 = stalkOn(C.g); for (let i = 0; i < 30; i++) C.step(); const v = Math.hypot(pl.vel[0], pl.vel[2]), p0 = [...pl.pos];
  for (let i = 0; i < 60; i++) C.step(); const drift = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]), free = !C.held();
  const t = holdToGrab(C, 8);
  verdict(on0 && moved > 0.2 && on1 === null && v < 0.05 && drift < 0.03 && free && t < 4, 'held for three quarters of a second he has closed on the man; let go, nothing is stalked the next frame, he is at rest inside half a second and stays put; pressed again it ends in the grab',
    `stalking ${on0}, closed ${f2(moved)} m · let go: stalked ${on1 ? 'still' : 'nobody'}, speed half a second on ${f2(v)} m/s, moved ${f2(drift)} m in the next second, nobody in his arm ${free} · pressed again: ${isFinite(t) ? `in his arm in ${f2(t)} s` : 'never grabbed'}`);
}
async function walkPress() {
  console.log('\n=== armed: a press made while his own feet are still moving begins the creep as they stop, once ===');
  const C = await world(up(), SEEDS[0], 2.7, 0), K = C.W.input.keys;
  K.add('KeyD'); for (let i = 0; i < 6; i++) C.step(); C.press(); for (let i = 0; i < 6; i++) C.step(); const during = stalkOn(C.g);
  K.delete('KeyD'); for (let i = 0; i < 3; i++) C.step(); const after = stalkOn(C.g) === C.A;
  // …and a stalk broken off by his own key is not taken up again by a button that merely stayed down
  K.add('KeyA'); for (let i = 0; i < 4; i++) C.step(); K.delete('KeyA'); for (let i = 0; i < 20; i++) C.step(); const again = stalkOn(C.g);
  C.lift(); C.step();
  verdict(during === null && after && again === null, 'the button pressed with a move key down takes nobody while the key is down, takes the man within three frames of the key coming up, and after his own key breaks that stalk off the button still down takes nobody',
    `with the key down: ${during ? 'stalking' : 'nobody'} · three frames after it came up: ${after ? 'stalking him' : 'nobody'} · after his own key broke it off, the button still down: ${again ? 'stalking' : 'nobody'}`);
}
async function out() {
  console.log('\n=== out: what ends it with the button still down ===');
  const rows: string[] = []; let ok = true;
  const cases: [string, (C: Ctx) => void][] = [
    ['he turns to face Sam', C => { C.A.char.bodyYaw = C.A.char.aimYaw = -EAST; }],
    ['he is suddenly five metres off', C => { C.A.char.pos[0] += 5; }],
    ['something solid comes between them', C => { C.g.col.solidBlocked = () => true; }],
    ['he is onto Sam', C => { C.A.state = 'alert'; }],
    ['a move key of the player\'s own', C => { C.W.input.keys.add('KeyA'); }],
  ];
  for (const [name, doIt] of cases) {
    const C = await world(true, SEEDS[0], 2.8, 0); C.press(); for (let i = 0; i < 30; i++) C.step(); const on0 = stalkOn(C.g) === C.A;
    doIt(C); C.step(); const on1 = stalkOn(C.g); let grabbed = false, again = false; for (let i = 0; i < 120; i++) { C.step(); grabbed ||= C.held(); again ||= !!stalkOn(C.g); }
    const good = on0 && on1 === null && !grabbed && !again; ok &&= good;
    rows.push(`${name}: stalking before ${on0} · the frame after, ${on1 ? 'still stalking' : 'nothing stalked'} · two seconds on with the button never let go: grabbed ${grabbed}, stalking again ${again}`);
  }
  verdict(ok, 'each of five things ends the stalk on the frame it happens, and a button merely still down neither grabs him nor takes him again', rows.join('\n    '));
  // STALK.jolt: broken off by the man, Sam shrinks back off him (the animator's soft duck) — with the MOVES pass up, and nothing with it down (the frozen stand's own)
  const duck = async (moves: number, how: (C: Ctx) => void, press = true, later?: [number, (C: Ctx) => void]) => {
    const C = await world(true, SEEDS[0], 2.8, 0), an = C.g.player.char.anim; MOVES.on = moves; if (BREAK) STALK.jolt = 0;   // (every stand-up writes the pass again)
    if (press) C.press(); for (let i = 0; i < 30; i++) C.step(); const on0 = stalkOn(C.g) === C.A; how(C); let shown = 0, hands = false, hit = false, early = 0;
    if (later) { for (let i = 0; i < later[0]; i++) { C.step(); early = Math.max(early, an.flinchShown); } later[1](C); }   // (…and what he does some frames on)
    for (let i = 0; i < 12; i++) { C.step(); shown = Math.max(shown, an.flinchShown); hands ||= an.startleShown > 0; hit ||= (an as any).hitT >= 0 && (an as any).hitT < 0.2; }
    return { shown, hands, hit, early, out: on0 && stalkOn(C.g) === null };
  };
  const mv = MOVES.on, jolt = STALK.jolt, face = STALK.joltFace;
  try {
    const turn = (C: Ctx) => { C.A.char.bodyYaw = C.A.char.aimYaw = -EAST; }, onto = (C: Ctx) => { C.A.state = 'alert'; }, quarter = (C: Ctx) => { C.A.char.bodyYaw = C.A.char.aimYaw = 0; };   // (a quarter turn: Sam at his shoulder — the stalk ends, he is not faced)
    const T = await duck(1, turn), H = await duck(1, onto), F = await duck(1, C => { C.A.char.pos[0] += 5; }), N = await duck(1, turn, false), D = await duck(0, turn), Q = await duck(1, quarter);
    const L = await duck(1, quarter, true, [12, turn]), X = await duck(1, quarter, true, [Math.ceil(STALK.joltSecs * 60) + 6, turn]), O = await duck(1, quarter, true, [12, onto]);   // (the quarter turn, then: round to face him a fifth of a second on · the same after joltSecs · onto him a fifth of a second on)
    const W2 = await duck(1, quarter, true, [12, C => { C.g.col.solidBlocked = () => true; turn(C); }]);   // (…round to face him with something solid between them)
    STALK.joltFace = 180; STALK.joltAtOnce = up(); const F5 = await duck(1, C => { C.g.col.solidBlocked = () => true; quarter(C); }); STALK.joltAtOnce = false; const F6 = await duck(1, C => { C.g.col.solidBlocked = () => true; quarter(C); }); STALK.joltFace = face;   // (a recording of the fifth pass replays with joltAtOnce: any turn that ends the stalk, on that frame, whatever stands between them · joltFace 180 alone, the lab's top, keeps the wall's test)
    verdict(F5.shown > 0.1 && F6.shown === 0 && T.shown > 0.1 && H.shown > T.shown && !T.hands && !H.hands && F.shown === 0 && N.shown === 0 && D.shown === 0 && !D.hit && Q.shown === 0 && Q.out && L.early === 0 && L.shown > 0.1 && X.shown === 0 && O.shown > L.shown && W2.shown === 0,
      'with the stalk on, the man who turns round to face him makes Sam duck inside a fifth of a second and the man who is onto him more — the soft duck, never the start that takes his hands; a quarter turn ends the stalk and gives none — until he comes on round to face him inside joltSecs (the duck), or is onto him (the whole of it), and not after joltSecs nor with something solid between them; a man who is merely far gives none, nor does the same turn with no stalk on; with the MOVES pass down nothing shows, not the old hit twitch either; and with joltAtOnce (raised only for a recording of the fifth pass) any turn that ends the stalk gives the duck on that frame, a wall between or not, where joltFace 180 alone still asks for a clear line',
      `the duck shown: he turns to face him ${f2(T.shown)} · a quarter turn ${f2(Q.shown)} (the stalk ended ${Q.out}), then round to face him ${f2(L.shown)} (before that ${f2(L.early)}), the same too late ${f2(X.shown)}, onto him ${f2(O.shown)}, a wall between ${f2(W2.shown)} · he is onto Sam ${f2(H.shown)} · he is five metres off ${f2(F.shown)} · he turns, the button never pressed ${f2(N.shown)} · MOVES down ${f2(D.shown)}, a hit twitch ${D.hit} · a start that takes the hands ${T.hands || H.hands} · a quarter turn with a wall between: joltAtOnce ${f2(F5.shown)}, joltFace 180 alone ${f2(F6.shown)}`);
  } finally { MOVES.on = mv; STALK.jolt = jolt; STALK.joltFace = face; STALK.joltAtOnce = false; }
}
async function tell() {
  console.log('\n=== tell: his body is the distance — the arm and the rise come in as he closes, hold when the button is let go, and are the old pose with the rule off ===');
  const run = async (on: boolean, pause: boolean) => {
    const C = await world(true, SEEDS[0], 2.9, 0); CLOSE.ready = true; CLOSE.noKnife = true; STALK.tell = on;
    const an = C.g.player.char.anim, far = { amt: an.readyAmt * (an.ready ? 1 : 0), rise: an.rise }; let back = 0, mid = 0, top = { amt: 0, rise: 0 }, last = { amt: 0, rise: 0 }, drift = 0, paused = false;
    C.press();
    for (let i = 0; i < 8 * 60 && !C.held(); i++) {
      if (pause && !paused && C.gap() < 1.6) { paused = true; C.lift(); for (let k = 0; k < 20; k++) C.step(); const a0 = an.readyAmt, r0 = an.rise; for (let k = 0; k < 40; k++) { C.step(); drift = Math.max(drift, Math.abs(an.readyAmt - a0), Math.abs(an.rise - r0)); } last = { amt: a0, rise: r0 }; break; }
      C.step(); if (C.held()) break;
      const a = an.ready ? an.readyAmt : 0, r = an.rise; back = Math.max(back, last.amt - a, last.rise - r); if (a > 0.02 && a < 0.98) mid++; last = { amt: a, rise: r }; top = { amt: Math.max(top.amt, a), rise: Math.max(top.rise, r) };
    }
    return { far, back, mid, top, last, drift, held: C.held() };
  };
  const A = await run(up(), false), P = await run(up(), true), O = await run(false, false);
  verdict(A.held && A.far.amt === 0 && A.far.rise === 0 && A.back < 0.01 && A.mid >= 20 && A.top.amt >= 0.85 * STALK.reach && A.top.rise >= 0.9 * STALK.rise,
    'from 2.9 m behind a man who stands, the button held: nothing of the reach at the start; the arm\'s share and the rise only ever grow, through twenty frames or more of in-between, to all but the whole of both before the grab',
    `at 2.9 m: reach ${f2(A.far.amt)}, rise ${f2(A.far.rise)} · frames in between ${A.mid} · the most either went back in a frame ${f2(A.back)} · at the grab: reach ${f2(A.top.amt)} of ${f2(STALK.reach)}, rise ${f2(A.top.rise)} of ${f2(STALK.rise)} · in his arm ${A.held}`);
  verdict(P.last.amt > 0.1 && P.last.amt < 0.95 && P.drift < 0.005, 'let go 1.6 m out, the pose is a frame of the move, paused: part of the reach, and it does not move for two thirds of a second',
    `reach ${f2(P.last.amt)} · rise ${f2(P.last.rise)} · the most either moved while he stood ${P.drift.toFixed(3)}`);
  verdict(O.held && O.mid === 0 && O.top.rise === 0, 'STALK.tell off: the reach is whole or nothing (the pose in reach alone, as before) and he never comes up out of the crouch', `frames in between ${O.mid} · the most rise ${f2(O.top.rise)} · in his arm ${O.held}`);
}
async function stepIn() {
  console.log('\n=== stepin: the grab a stalk ends in closes the gap in one eased step, not a snap ===');
  const C = await world(true, SEEDS[0], 2.4, 0), was = STALK.catchSecs; if (BREAK) STALK.catchSecs = 0;
  const pl = C.g.player.char, t = holdToGrab(C, 6), H = C.g.player.holding; let p0: P3 = [...pl.pos] as P3, first = -1, peak = 0, n = 0; const from = H?.from ? Math.hypot(H.from[0] - C.A.char.pos[0], H.from[2] - C.A.char.pos[2]) : -1;
  const a0: P3 = [...C.A.char.pos] as P3;
  for (let i = 0; i < 30 && C.g.player.holding?.phase === 'grab'; i++) { C.step(); const d = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]); if (first < 0) first = d; peak = Math.max(peak, d / DT); p0 = [...pl.pos] as P3; n++; }
  const end = C.gap(), back = Math.hypot(C.A.char.pos[0] - a0[0], C.A.char.pos[2] - a0[2]); STALK.catchSecs = was;
  verdict(isFinite(t) && from > 0.5 && first >= 0 && first < 0.04 && peak < 7 && end < 0.5 && (BREAK || (back > 0.6 * STALK.yank && back < STALK.yank + 0.02)), 'in the arm from most of a metre out: the first frame of the way in moves him under 4 cm (the old snap: a fifth of the gap), he is never over 7 m/s, he ends at the hold\'s own distance, and the man has been hauled back most of STALK.yank by the time he is held',
    `${isFinite(t) ? `in his arm in ${f2(t)} s` : 'never grabbed'} · grabbed from ${f2(from)} m · the first frame moved him ${first.toFixed(3)} m · top speed ${f2(peak)} m/s over ${n} frames · he ends ${f2(end)} m off the man · the man hauled back ${f2(back)} m (the yank ${f2(STALK.yank)})`);
}
/** Sam put on the nearest wall of the lobby with his hands empty (the wall hold, [Q]) and the man set walking past him along it, a metre out: the context, the
 *  wall's normal and the way he walks along it (he starts `back` m short of level with Sam) — or null if no wall took him */
async function onWall(seed: number, back: number): Promise<{ C: Ctx; n: P3; t: P3 } | null> {
  const C = await world(true, seed, 6, 0), g = C.g, pl = g.player, W = C.W; let hit: { t: number; d: P3 } | null = null;
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, d: P3 = [Math.sin(a), 0, Math.cos(a)], h = g.col.raycast([SAM[0], 1.0, SAM[2]], d, 14); if (h && (!hit || h.t < hit.t)) hit = { t: h.t, d }; }
  if (!hit) return null;
  const foot: P3 = [SAM[0] + hit.d[0] * (hit.t - 0.6), 0, SAM[2] + hit.d[2] * (hit.t - 0.6)]; g.teleportPlayer(foot); pl.crouch = false;
  const step = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([foot[0] + hit!.d[0] * 2, 1.2, foot[2] + hit!.d[2] * 2]); W.step(DT); pl.visibility = 0.02; } };
  step(10); W.input.pressed.add('KeyQ'); step(1); step(50); if (!pl.wall) return null;
  const n: P3 = [pl.wall.n[0], 0, pl.wall.n[2]], t0: P3 = [n[2], 0, -n[0]], p = pl.char.pos, A = C.A;
  // the side he comes from: the one with a clear run along the wall past Sam (the lobby's furniture stands on one of them)
  const run = (sg: number) => { const from: P3 = [p[0] + n[0] * 0.75 - t0[0] * back * sg, 0.5, p[2] + n[2] * 0.75 - t0[2] * back * sg]; return g.col.raycast(from, [t0[0] * sg, 0, t0[2] * sg], back + 1.6)?.t ?? 99; };
  const sg = run(1) >= run(-1) ? 1 : -1, t: P3 = [t0[0] * sg, 0, t0[2] * sg];
  A.char.pos = [p[0] + n[0] * 0.75 - t[0] * back, 0, p[2] + n[2] * 0.75 - t[2] * back]; A.char.bodyYaw = A.char.aimYaw = Math.atan2(t[0], t[2]);
  return { C, n, t };
}
async function corner() {
  console.log('\n=== corner: with his back on a wall the held button lies in wait, and the man who comes past is grabbed as he passes ===');
  const pass = async (hold: boolean, on: boolean) => {
    const S = await onWall(SEEDS[0], 2.6); if (!S) return null; const { C, t } = S, g = C.g, pl = g.player, A = C.A; STALK.corner = on; const c0 = STALK_STATS.corner;
    CLOSE.noKnife = true;   // (the wait's pose is a bare-handed one: the frozen stand has the knife, and every stand-up writes this again)
    let at = { deg: -1, d: -1 }, early = false, from = false, coil = 0, low = 0, r0 = -1, r1 = 0;   // (the wait's pose: how far he is sunk — asked, and shown —, and the lead hand's reach at the start and at its most)
    for (let i = 0; i < 5 * 60 && !C.held(); i++) {
      A.char.pos[0] += t[0] * 1.15 * DT; A.char.pos[2] += t[2] * 1.15 * DT; A.char.vel = [t[0] * 1.15, 0, t[2] * 1.15];
      const b = Math.atan2(pl.char.pos[0] - A.char.pos[0], pl.char.pos[2] - A.char.pos[2]) - A.char.bodyYaw, deg = Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) * 180 / Math.PI, d = C.gap();
      if (hold) { C.W.input.buttons |= 1; if (i === 0) C.W.input.clicked |= 1; }
      C.W.step(DT); pl.visibility = 0.02;
      if (C.held()) { at = { deg, d }; early = deg < STALK.cornerDeg - 3; from = !!pl.holding?.from; }
      else { const an = pl.char.anim; coil = Math.max(coil, an.coil); if (i > 30) low = Math.max(low, an.crouch); if (an.ready === 'grab' && an.coil > 0) { if (r0 < 0) r0 = an.readyAmt; r1 = Math.max(r1, an.readyAmt); } }
    }
    return { held: C.held(), at, early, from, wall: !!pl.wall, n: STALK_STATS.corner - c0, coil, low, r0, r1 };
  };
  const A = await pass(true, up()), B = await pass(false, true), O = await pass(true, false);
  if (!A || !B || !O) { verdict(false, 'the lobby has a wall Sam can put his back on', 'no wall took him: the check could not stand its scene'); return; }
  verdict(A.held && !A.early && A.at.d < STALK.cornerM + 0.05 && A.from && !A.wall && A.n === 1, 'on a wall with empty hands and the button held from the start, a man walking past a pace out is in his arm — not before Sam is STALK.cornerDeg round from his nose (he is past), inside the corner\'s reach, off the wall by the step in',
    `in his arm ${A.held}${A.held ? ` with Sam ${A.at.deg.toFixed(0)}° round from his nose, ${f2(A.at.d)} m off` : ''} · the step in ${A.from} · still on the wall ${A.wall} · corner grabs ${A.n}`);
  verdict(A.coil > 0.15 && A.low > Math.max(B.low, O.low) + 0.1 && A.r0 >= 0 && A.r1 > A.r0 + 0.1 && B.coil === 0 && O.coil === 0, 'while he waits he is seen to wait: sunk a little lower, the lead hand out toward the man and further out as the man comes on — and not with the button up, nor with the corner off',
    `the button held: asked to sink ${f2(A.coil)}, his crouch as shown ${f2(A.low)}, the reach from ${f2(A.r0)} to ${f2(A.r1)} · no press: ${f2(B.coil)}, shown ${f2(B.low)} · the corner off: ${f2(O.coil)}, shown ${f2(O.low)}`);
  verdict(!B.held && B.n === 0 && !O.held && O.n === 0, 'the button never pressed, the same man walks past and nobody is grabbed; nor with STALK.corner off and the button held', `no press: in his arm ${B.held} · the corner off: in his arm ${O.held}`);
  const S = await onWall(SEEDS[0], 1.0);   // a man who stands a pace short of him along the wall, facing him
  if (S) { const { C } = S, pl = C.g.player.char; S.C.A.char.bodyYaw = S.C.A.char.aimYaw = Math.atan2(pl.pos[0] - C.A.char.pos[0], pl.pos[2] - C.A.char.pos[2]); STALK.corner = true;
    for (let i = 0; i < 120; i++) { C.W.input.buttons |= 1; C.W.step(DT); C.g.player.visibility = 0.02; }
    verdict(!C.held(), 'a man who stands a pace off FACING him is not taken, the button held two seconds', `in his arm ${C.held()} · ${f2(C.gap())} m off`); }
}
async function shape() {
  console.log('\n=== shape: the grab a stalk ends in has a spring before the lunge, and the bare hold shows two heads ===');
  const run = async (on: boolean) => {
    const was = { dip: HOLD.lunge.dip, side: HOLD.apart.side, tip: HOLD.apart.tip, m: HOLD.sway.m };
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char, A = C.A.char; CLOSE.noKnife = true; HOLD.sway.m = 0; if (!on) HOLD.lunge.dip = HOLD.apart.side = HOLD.apart.tip = 0;
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift();
      const hips: number[] = []; for (let i = 0; i < 8; i++) { C.step(); hips.push(pl.bones.hips[1]); }
      for (let i = 0; i < 80; i++) C.step();   // (the grab over, the hold settled)
      let gap = 0; const N = 120; for (let i = 0; i < N; i++) { C.step(); const a = pl.bones.head, b = A.bones.head, y = A.bodyYaw; gap += Math.abs((a[0] - b[0]) * Math.cos(y) - (a[2] - b[2]) * Math.sin(y)) / N; }
      return { hips, gap, held: C.held() };
    } finally { HOLD.lunge.dip = was.dip; HOLD.apart.side = was.side; HOLD.apart.tip = was.tip; HOLD.sway.m = was.m; }
  };
  const A = await run(up()), B = await run(false);
  if (!A || !B) { verdict(false, 'the stalk ends in the grab', 'never grabbed: the check could not stand its scene'); return; }
  const dip = Math.max(...A.hips.map((y, i) => B.hips[i] - y)), at = A.hips.findIndex((y, i) => B.hips[i] - y === dip);
  verdict(A.held && dip > 0.035 && at < 5 && A.gap > B.gap + 0.025, 'bare hands: within five frames of the step in his hips have dipped 3.5 cm or more below where they are with HOLD.lunge at 0, and in the hold the two heads are 2.5 cm or more further apart across the pair than with HOLD.apart at 0',
    `the dip ${(dip * 100).toFixed(1)} cm at frame ${at + 1} · heads apart across the pair ${(A.gap * 100).toFixed(1)} cm, with HOLD.apart at 0 ${(B.gap * 100).toFixed(1)} cm · still held ${A.held}`);
}
/** THE POLISH DOWN IS THE LEGS AS THEY WERE: the spring's clock and the sway's still run with their numbers at 0, and a clock with nothing to move must not
 *  pin his feet and solve his legs (it did: a knee 7 cm off through the step in). The same grab and hold, polish down, with the two clocks stopped: the same shins. */
async function legs() {
  console.log('\n=== legs: with the polish down, the spring and the sway move nothing — not his knees either ===');
  const run = async (stopped: boolean) => {
    const t = HOLD.lunge.t, secs = HOLD.sway.secs;
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char; CLOSE.noKnife = true; stalkPolish(false);
      if (stopped) { HOLD.lunge.t = [1e-9, 0, 1e-9]; HOLD.sway.secs = Infinity; } else if (BREAK) { HOLD.lunge.dip = 1e-9; HOLD.sway.m = 1e-9; }   // (the break: a number that moves nothing a ruler could find, and lets the clocks into the legs again)
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift();
      const k: number[][] = []; for (let i = 0; i < 200; i++) { C.step(); k.push([...pl.bones.shinL, ...pl.bones.shinR]); }
      return { k, held: C.held() };
    } finally { HOLD.lunge.t = t; HOLD.sway.secs = secs; stalkPolish(true); }
  };
  const A = await run(false), B = await run(true);
  if (!A || !B) { verdict(false, 'the stalk ends in the grab', 'never grabbed: the check could not stand its scene'); return; }
  let worst = 0, at = -1; A.k.forEach((a, i) => { const b = B.k[i]; const d = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(a[3] - b[3], a[4] - b[4], a[5] - b[5])); if (d > worst) { worst = d; at = i; } });
  verdict(A.held && B.held && worst < 1e-6, 'with the polish down, the grab\'s step in and 3 seconds of the bare hold have his two shins where they are with the spring\'s clock and the sway\'s stopped: the clocks reach his legs only with something to move',
    `the furthest a shin is from its place with the clocks stopped: ${(worst * 1000).toFixed(3)} mm${at >= 0 ? ` at frame ${at + 1}` : ''} · still held ${A.held && B.held}`);
  // …and the bare hands as they first stood (character.ts READY_BARE_WAS): the eight numbers to the letter, and that HOLD.wayShape off draws them. The WHOLE reach
  // (the grab row's, no button pressed, Sam close behind a standing man: at the whole reach the way in's shape is spent, so the two sets of hands are all that
  // key changes), with the row shown on either stand (STALK.only off) — the break leaves the key as it is, and the two runs are one
  const WAS = { L: { pole: [0.5, -0.85, -0.2], fing: [-0.2, 0.12, 1], curl: 0.3, spread: 0.12 }, R: { at: [0.07, 0, 0.4], pole: [-0.5, -0.85, -0.25], fing: [0.15, 0.05, 1], curl: 0.34 } };
  const same = (['L', 'R'] as const).every(h => Object.entries(WAS[h]).every(([k, v]) => JSON.stringify((READY_BARE_WAS as any)[h][k]) === JSON.stringify(v)));
  const hand = async (way: boolean) => { const only = STALK.only; STALK.only = false; try { const C = await world(true, SEEDS[0], 0.8, 0), pl = C.g.player.char; STALK.only = false; STALK.tell = true; CLOSE.noKnife = true; CLOSE.ready = true; HOLD.wayShape = way; for (let i = 0; i < 90; i++) C.step();   // (the tell up: the page shows no grab row, and its reach before a press is the tell's — whole, this close)
    const c = pl.bones.chest; return { reach: pl.anim.ready === 'grab' && pl.anim.readyAmt === 1, amt: pl.anim.readyAmt, at: (['handR', 'fingerR', 'handL', 'fingerL'] as const).map(k => [pl.bones[k][0] - c[0], pl.bones[k][1] - c[1], pl.bones[k][2] - c[2]]) }; } finally { STALK.only = only; stalkPolish(true); } };
  const hd = await hand(BREAK), hu = await hand(true), gaps = hd.at.map((a, i) => Math.hypot(a[0] - hu.at[i][0], a[1] - hu.at[i][1], a[2] - hu.at[i][2])), apart = Math.max(...gaps);
  verdict(same && hd.reach && hu.reach && apart > 0.05, 'the bare hands as they first stood are the eight numbers they were, and HOLD.wayShape off draws them: at the whole reach, no button pressed, close behind a standing man, a hand or its fingers are 5 cm or more from where the fourth pass has them',
    `the eight numbers as they were ${same} · the whole reach shown ${hd.reach && hu.reach} (${f2(hd.amt)}, ${f2(hu.amt)}) · wayShape off against on, off his chest: right hand ${(gaps[0] * 100).toFixed(1)} cm, its fingers ${(gaps[1] * 100).toFixed(1)}, left hand ${(gaps[2] * 100).toFixed(1)}, its fingers ${(gaps[3] * 100).toFixed(1)}`);
  // …and with the polish UP the sway never lets go of his legs: the leg solve was asked for by the sway's sine, and on the tick in each half swing that reads zero
  // it dropped out and a knee jumped 3 cm and back. Three seconds of the settled bare hold: no shin moves half a centimetre in one frame.
  // (the break: the sway's size at 0 for one tick mid-hold — the solve drops out for that tick, as it did. HOLD.catchShape down for this one: its seat asks
  // for the leg solve too and would hide the tick — the catch card below reads the same shins with it up)
  { const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char; CLOSE.noKnife = true; const m = HOLD.sway.m; HOLD.catchShape = false;
    try {
      if (!isFinite(holdToGrab(C, 6))) { verdict(false, 'the stalk ends in the grab', 'never grabbed: the check could not stand its scene'); return; } C.lift(); for (let i = 0; i < 90; i++) C.step();
      let jump = 0, at = -1, last = [...pl.bones.shinL, ...pl.bones.shinR];
      for (let i = 0; i < 180; i++) { if (BREAK && i === 60) HOLD.sway.m = 0; C.step(); HOLD.sway.m = m; const now = [...pl.bones.shinL, ...pl.bones.shinR], d = Math.max(Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2]), Math.hypot(now[3] - last[3], now[4] - last[4], now[5] - last[5])); if (d > jump) { jump = d; at = i; } last = now; }
      verdict(C.held() && m > 0 && jump < 0.005, 'with the polish up, three seconds of the settled bare hold move neither shin half a centimetre in one frame: the sway keeps the leg solve through the ticks where its sine reads zero',
        `the furthest a shin moves in one frame: ${(jump * 1000).toFixed(2)} mm at frame ${at + 1} of the three seconds · HOLD.sway.m ${m} · still held ${C.held()}`);
    } finally { HOLD.sway.m = m; stalkPolish(true); } }
}
/** THE CATCH HAS A SHAPE (the eighth pass: STALK.yankWith and HOLD.catchShape, both under the polish). The same stalk into the same grab, bare hands, with the
 *  two keys up and with them down: with them up he goes back WITH the man in the haul (the gap is the hold's own from the landing on, where the man used to come
 *  11 cm into him), his lead hand goes over the man's shoulder and round his throat (it used to swing past his face at the height of his own brow, a hand's
 *  length ahead of the man), the man's two hands fly out as he is hit, and in the hold the man sits back onto him with his heels out in front.
 *  (the break: the two keys down in the run that is asked to have them up — each line then measures the catch as it was) */
async function catchShape() {
    console.log('\n=== catch: he goes back with the man, the arm goes over the shoulder, the man\'s hands fly out and he sits back onto Sam ===');
  const run = async (on: boolean) => {
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char, A = C.A.char; CLOSE.noKnife = true; STALK.yankWith = HOLD.catchShape = on;   // (the sway left up: the page has both)
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift();
      const fwd = (p: number[], o: number[]) => (p[0] - o[0]) * Math.sin(A.bodyYaw) + (p[2] - o[2]) * Math.cos(A.bodyYaw), out = (p: number[], o: number[]) => Math.abs((p[0] - o[0]) * Math.cos(A.bodyYaw) - (p[2] - o[2]) * Math.sin(A.bodyYaw));   // (ahead of / out to the side of the man as he faces NOW: the held pair turns to the cursor)
      let landed = -1, lo = 9, hi = 0, up = -9, past = -9, fling = 0, wide = 0, run = 0, skate = 0, lifted = 0, back = 0; let s0: number[] | null = null; const track: number[][][] = [];
      for (let i = 0; i < 70; i++) { C.step(); const H = C.g.player.holding; if (!H) break; if (landed < 0 && H.hitAt !== undefined) { landed = i; s0 = [...pl.pos]; }
        if (landed >= 0 && i - landed < 40) { const d = C.gap(); lo = Math.min(lo, d); hi = Math.max(hi, d); back = Math.hypot(pl.pos[0] - s0![0], pl.pos[2] - s0![2]); track.push([[...pl.bones.footL], [...pl.bones.footR]]); }
        if (H.phase === 'grab') { up = Math.max(up, pl.bones.handL[1] - A.bones.head[1]); past = Math.max(past, fwd(pl.bones.handL, A.pos)); }
        if (i < 24) { const a = A.bones.handL, b = A.bones.handR, d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); wide = Math.max(wide, d); run = d > 0.78 ? run + 1 : 0; fling = Math.max(fling, run); } }
      for (const k of [0, 1]) { const floor = Math.min(...track.map(t => t[k][1])); track.forEach((t, i) => { const f = t[k], g0 = i ? track[i - 1][k] : f; if (f[1] < floor + 0.012 && g0[1] < floor + 0.012) skate = Math.max(skate, Math.hypot(f[0] - g0[0], f[2] - g0[2])); lifted = Math.max(lifted, f[1] - floor); }); }   // (on the floor = within 12 mm of the lowest that foot is in those frames)
      for (let i = 0; i < 60; i++) C.step();   // (the hold settled)
      let jump = 0, shins: number[] | null = null;
      const sat = () => { let heels = 0, sit = 0; const N = 60; for (let i = 0; i < N; i++) { C.step(); const k = [...pl.bones.shinL, ...pl.bones.shinR]; if (shins) jump = Math.max(jump, Math.hypot(k[0] - shins[0], k[1] - shins[1], k[2] - shins[2]), Math.hypot(k[3] - shins[3], k[4] - shins[4], k[5] - shins[5])); shins = k; heels += (fwd(A.bones.footL, A.pos) + fwd(A.bones.footR, A.pos)) / 2 / N; sit += (fwd(A.bones.hips, A.pos) - fwd(A.bones.head, A.pos)) / N; } return { heels, sit }; };
      const first = sat(), still = jump, p0 = [...pl.pos]; C.W.input.keys.add('KeyS'); for (let i = 0; i < 60; i++) C.step(); C.W.input.keys.delete('KeyS'); for (let i = 0; i < 50; i++) C.step();   // (…and walked a second, stopped, and settled again)
      const walked = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]), again = sat();
      // …and a swap to the gun from the settled seat: the furthest a hip, a head or a foot of either man moves in one frame (in his own man's frame: the pair may turn)
      const rel = () => [pl, A].flatMap(c => ['hips', 'head', 'footL', 'footR'].map(b => { const q = c.bones[b], dx = q[0] - c.pos[0], dz = q[2] - c.pos[2], sn = Math.sin(c.bodyYaw), cs = Math.cos(c.bodyYaw); return [dx * cs - dz * sn, q[1], dx * sn + dz * cs]; }));
      let pop = 0, r0 = rel(); C.W.input.pressed.add('KeyE'); for (let i = 0; i < 60; i++) { C.step(); const r = rel(); r.forEach((q, k) => { pop = Math.max(pop, Math.hypot(q[0] - r0[k][0], q[1] - r0[k][1], q[2] - r0[k][2])); }); r0 = r; }
      const gun = C.g.player.holding?.variant === 'gun';
      return { landed, lo, hi, up, past, fling, wide, skate, lifted, back, ...first, still, walked, again, pop, gun, held: C.held() };
    } finally { stalkPolish(true); }   // (as world() stands every card: the polish up)
  };
  // …and a hold DROPPED mid-reach (the man taken out of the arm 14 frames into the grab): the furthest his lead hand moves in one frame while the layer lets go
  const drop = async (on: boolean) => {
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char; CLOSE.noKnife = true; STALK.yankWith = HOLD.catchShape = on;
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift(); for (let i = 0; i < 14; i++) C.step();
      const mid = C.g.player.holding?.phase === 'grab'; C.A.held = null; let jump = 0, last = [...pl.bones.handL];
      for (let i = 0; i < 90; i++) { C.step(); const h = pl.bones.handL; jump = Math.max(jump, Math.hypot(h[0] - last[0], h[1] - last[1], h[2] - last[2])); last = [...h]; }
      return { mid, jump, gone: !C.g.player.holding };
    } finally { stalkPolish(true); }
  };
  const A = await run(up()), B = await run(false), D = await drop(up()), D0 = await drop(false);
  if (!A || !B) { verdict(false, 'the stalk ends in the grab', 'never grabbed: the check could not stand its scene'); return; }
  const cm = (n: number) => (n * 100).toFixed(1);
  verdict(A.held && A.landed >= 0 && A.lo > HOLD.dist - 0.02 && A.hi < HOLD.dist + 0.02 && A.back > 0.2 && A.skate < 0.03 && A.lifted > 0.03, 'from the frame he lands and for 40 frames after it (the haul and what follows) the two men are the hold\'s own distance apart to 2 cm: he goes back 20 cm or more with the man, and his feet step it — a foot is 3 cm or more off the floor at some frame, and no foot on the floor moves 3 cm in one',
    `landed at frame ${A.landed + 1} of the grab · the gap ${f2(A.lo)} to ${f2(A.hi)} m (the hold's ${f2(HOLD.dist)}) · he went back ${f2(A.back)} m, a foot on the floor moved at most ${cm(A.skate)} cm in a frame, the highest ${cm(A.lifted)} cm up · with the keys down ${f2(B.lo)} to ${f2(B.hi)} m, back ${f2(B.back)} m · still held ${A.held}`);
  verdict(A.held && A.up < 0.06 && A.past < 0.14 && !!D && !!D0 && D.mid && D.gone && D.jump < D0.jump + 0.03, 'through the grab his lead hand is never 6 cm above the bone of the man\'s head nor 14 cm ahead of where the man stands: over the shoulder and round the throat, not past his face — and with the man taken out of his arm 14 frames into the reach, the hand never moves 3 cm further in one frame, as the hold lets go, than it does with the keys down (kept on its frozen key it hung there, then jumped 70 cm)',
    `the highest ${cm(A.up)} cm over the man's head bone, the furthest ${cm(A.past)} cm ahead of him · with the keys down ${cm(B.up)} and ${cm(B.past)} cm · dropped mid-reach ${!!D && D.mid && D.gone}: at most ${D ? cm(D.jump) : '?'} cm a frame (keys down ${D0 ? cm(D0.jump) : '?'})`);
  verdict(A.held && A.fling >= 5 && B.fling === 0, 'in the grab\'s first 0.4 s the man\'s two hands are 78 cm or more apart for five frames or more on end, and with the keys down for none: his arms fly out and hang there, and he is seen to be hit',
    `78 cm apart for ${A.fling} frames on end, at the widest ${cm(A.wide)} cm · with the keys down ${B.fling} frames, ${cm(B.wide)} cm`);
  verdict(A.held && A.heels > B.heels + 0.12 && A.sit > B.sit + 0.08 && A.still < 0.005 && A.walked > 0.3 && A.again.heels > B.again.heels + 0.12 && A.again.sit > B.again.sit + 0.08 && A.gun && A.pop < 0.05,
    'in the settled hold the man\'s two feet are 12 cm or more further ahead of where he stands than with the keys down, and his hips 8 cm or more further ahead of his head: he sits back onto Sam, heels out, and no shin of Sam\'s moves half a centimetre in one frame of that second — he sits so again once Sam has walked a second and stopped, and a swap to the gun from there moves no hip, head or foot of either man 5 cm in one frame',
    `his feet ${cm(A.heels)} cm ahead of him (keys down ${cm(B.heels)}) · his hips ahead of his head ${cm(A.sit)} cm (keys down ${cm(B.sit)}) · Sam's shins at most ${(A.still * 1000).toFixed(2)} mm a frame · walked ${f2(A.walked)} m, then: feet ${cm(A.again.heels)} (${cm(B.again.heels)}), hips ${cm(A.again.sit)} (${cm(B.again.sit)}) · the gun swapped in ${A.gun}: at most ${cm(A.pop)} cm a frame (keys down ${cm(B.pop)})`);
}
/** THE BODY LANDS, AND HE IS LAID DOWN AHEAD (the ninth pass: HOLD.hitShape and HOLD.layAhead, both under the polish). The same stalk into the same grab,
 *  bare hands, with HOLD.hitShape up and down: up, the man's hips are driven ahead of his neck as Sam's body lands and come back to the seat, his neck stays
 *  under the forearm and the two heads come no nearer; and the same hold choked to its end with HOLD.layAhead up and at 0: up, he lies ahead of Sam's boots,
 *  where at 0 a boot stood on his shin — and a metre short of a wall he is laid down where he knelt, as at 0.
 *  (the break: both keys down in the runs that are asked to have them up) */
async function lands() {
  console.log('\n=== lands: the body lands with a beat of its own, and the choked man is laid down ahead of Sam\'s boots ===');
  const seg = (p: number[], a: number[], b: number[], flat = false) => { const k = flat ? [0, 2] : [0, 1, 2], ab = k.map(i => b[i] - a[i]), ap = k.map(i => p[i] - a[i]), t = Math.max(0, Math.min(1, ab.reduce((n, x, i) => n + x * ap[i], 0) / Math.max(1e-9, ab.reduce((n, x) => n + x * x, 0)))); return Math.hypot(...k.map((i, j) => p[i] - a[i] - ab[j] * t)); };
  const hit = async (on: boolean) => {
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), pl = C.g.player.char, A = C.A.char; CLOSE.noKnife = true; HOLD.hitShape = on;
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift();
      const fwd = (p: number[], o: number[]) => (p[0] - o[0]) * Math.sin(A.bodyYaw) + (p[2] - o[2]) * Math.cos(A.bodyYaw);
      let landed = -1; const rows: { sit: number; heads: number; neck: number; sam: number }[] = [];
      for (let i = 0; i < 80 && rows.length < 36; i++) { C.step(); const H = C.g.player.holding; if (!H) break; if (landed < 0 && H.hitAt !== undefined) landed = i;
        if (landed >= 0) rows.push({ sit: fwd(A.bones.hips, A.pos) - fwd(A.bones.neck, A.pos), heads: Math.hypot(pl.bones.head[0] - A.bones.head[0], pl.bones.head[1] - A.bones.head[1], pl.bones.head[2] - A.bones.head[2]), neck: seg(A.bones.neck, pl.bones.forearmL, pl.bones.handL), sam: pl.bones.hips[1] }); }
      return { landed, rows, held: C.held() };
    } finally { stalkPolish(true); }
  };
  const A = await hit(up()), B = await hit(false);
  // (…and a change to the gun on the hold's first frame, inside the beat: the beat leaves with the arm's share of the hold, never in one frame)
  const swap = async (on: boolean) => {
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), M = C.A.char; CLOSE.noKnife = true; HOLD.hitShape = on;
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift(); let n = 0; while (C.g.player.holding?.phase === 'grab' && n++ < 120) C.step();
      const rel = () => { const q = M.bones.hips, dx = q[0] - M.pos[0], dz = q[2] - M.pos[2], sn = Math.sin(M.bodyYaw), cs = Math.cos(M.bodyYaw); return [dx * cs - dz * sn, q[1], dx * sn + dz * cs]; };
      let r0 = rel(), pop = 0; C.W.input.pressed.add('KeyE');
      for (let i = 0; i < 20; i++) { C.step(); const r = rel(); pop = Math.max(pop, Math.hypot(r[0] - r0[0], r[1] - r0[1], r[2] - r0[2])); r0 = r; }
      return { pop, gun: C.g.player.holding?.variant === 'gun' };
    } finally { stalkPolish(true); }
  };
  const SA = await swap(up()), SB = await swap(false);
  // (…and the hold ENDED three frames after the landing, at the beat's top: it leaves with the layer's weight)
  const drop = async (on: boolean) => {
    try {
      const C = await world(true, SEEDS[0], 2.4, 0), M = C.A.char; CLOSE.noKnife = true; HOLD.hitShape = on;
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift(); let n = 0; while (C.g.player.holding && C.g.player.holding.hitAt === undefined && n++ < 120) C.step(); for (let i = 0; i < 3; i++) C.step();
      const rel = () => { const q = M.bones.hips, dx = q[0] - M.pos[0], dz = q[2] - M.pos[2], sn = Math.sin(M.bodyYaw), cs = Math.cos(M.bodyYaw); return [dx * cs - dz * sn, q[1], dx * sn + dz * cs]; };
      let r0 = rel(), pop = 0; C.g.freeHeld('cancel');
      for (let i = 0; i < 20; i++) { C.step(); const r = rel(); pop = Math.max(pop, Math.hypot(r[0] - r0[0], r[1] - r0[1], r[2] - r0[2])); r0 = r; }
      return { pop, free: !C.g.player.holding };
    } finally { stalkPolish(true); }
  };
  const DA = await drop(up()), DB = await drop(false);
  if (!A || !B || !SA || !SB || !DA || !DB || A.rows.length < 36 || B.rows.length < 36) { verdict(false, 'the stalk ends in the grab', 'never grabbed, or the hold did not last: the check could not stand its scene'); return; }
  const cm = (n: number) => (n * 100).toFixed(1), d = A.rows.map((r, i) => r.sit - B.rows[i].sit), peak = Math.max(...d.slice(0, 10)), late = Math.max(...d.slice(24).map(Math.abs));
  const heads = Math.min(...A.rows.map(r => r.heads)), heads0 = Math.min(...B.rows.map(r => r.heads)), nearer = Math.max(...A.rows.map((r, i) => B.rows[i].heads - r.heads)), neck = Math.max(...A.rows.map((r, i) => r.neck - B.rows[i].neck)), dip = Math.min(...A.rows.map((r, i) => r.sam - B.rows[i].sam));
  verdict(A.held && A.landed === B.landed && peak > 0.08 && late < 0.01 && nearer < 0.01 && neck < 0.03 && dip < -0.02 && SA.gun && SB.gun && SA.pop < SB.pop + 0.02 && DA.free && DB.free && DA.pop < DB.pop + 0.02,
    'in the sixth of a second after his step lands the man\'s hips are 8 cm or more further ahead of his neck than with the key down, and from 0.4 s on within a centimetre of it: driven ahead as the body lands, then back in the seat — and through it frame for frame the two heads are never a centimetre nearer than with the key down, his neck is never 3 cm further from Sam\'s forearm, and Sam\'s hips go 2 cm or more lower: he heaves — and with the gun drawn on the hold\'s first frame, inside the beat, or the hold ended three frames after the landing, his hips never move 2 cm more in a frame than with the key down',
    `landed at frame ${A.landed + 1} of the grab · his hips at most ${cm(peak)} cm further ahead of his neck in the first ten frames, ${cm(late)} cm from frame 25 on · the heads at the nearest ${cm(heads)} cm (key down ${cm(heads0)}), at most ${cm(nearer)} cm nearer on any one frame · his neck at most ${cm(neck)} cm further from the forearm · Sam's hips at the lowest ${cm(dip)} cm against the key down · the gun drawn on the hold's first frame (${SA.gun && SB.gun}): his hips at most ${cm(SA.pop)} cm in a frame (key down ${cm(SB.pop)}) · the hold ended three frames after the landing (${DA.free && DB.free}): ${cm(DA.pop)} cm (key down ${cm(DB.pop)})`);
  // ---- laid down ahead: the hold choked to its end, two and a half seconds for the body to come to rest
  type Thing = { fwd: number; side: number; y: number; h: [number, number, number] };   // (a box stood ahead of him: its middle `fwd` m along his facing and `side` m off it, at height y, half extents h)
  type End = { at: number[]; e: P3 };                                                     // (where he stands and faces as the choke ends, from the same seed's open run)
  const lay = async (m: number, seed = SEEDS[0], things: Thing[] = [], end: End | null = null) => {
    const td = TAKEDOWN.on;
    try {
      const C = await world(true, seed, 2.4, 0), g = C.g, pl = g.player.char, A = C.A.char; CLOSE.noKnife = true; HOLD.layAhead = m; TAKEDOWN.on = true;   // (the lay is of the takedown's own fall: off on the frozen stand, and every stand-up writes it again)
      if (!isFinite(holdToGrab(C, 6))) return null; C.lift(); for (let i = 0; i < 80; i++) C.step();
      if (end) for (const t of things) g.col.addStatic({ ...g.col.boxes[0], flags: 0, c: [end.at[0] + end.e[0] * t.fwd + end.e[2] * t.side, t.y, end.at[2] + end.e[2] * t.fwd - end.e[0] * t.side], h: t.h, yaw: Math.atan2(end.e[0], end.e[2]) });
      g.selectVerb('held', 'choke'); C.W.input.pressed.add('Space'); let n = 0; while (g.player.holding && n++ < 600) C.step();
      // (measured in his own frame as the choke ends: through the choke the pair has gone on turning to the cursor, by half a turn on the frozen stand)
      const e: P3 = [Math.sin(A.bodyYaw), 0, Math.cos(A.bodyYaw)], atE = [...A.pos], along = (q: number[]) => (q[0] - atE[0]) * e[0] + (q[2] - atE[2]) * e[2];
      const lane = Math.min(...[-LAY_HALF, 0, LAY_HALF].flatMap(o => [0.15, 0.45, 1.1].map(y => g.col.raycast([atE[0] + e[2] * o, y, atE[2] - e[0] * o], e, 30)?.t ?? 30)));   // (the nearest thing nine rays find in the strip of floor ahead of him — a measure of its own, not the fall's: that one asks the volume)
      const p0 = [...A.bones.hips]; let fast = 0, last = [...p0]; for (let i = 0; i < 150; i++) { C.step(); const h = A.bones.hips; fast = Math.max(fast, Math.hypot(h[0] - last[0], h[1] - last[1], h[2] - last[2]) * 60); last = [...h]; }
      const legs = [0, 1].flatMap(k => { const L = k ? 'R' : 'L'; return [[A.bones['thigh' + L], A.bones['shin' + L]], [A.bones['shin' + L], A.bones['foot' + L]], [A.bones['foot' + L], A.bones['toe' + L] ?? A.bones['foot' + L]]]; });
      const boot = Math.min(...[pl.bones.footL, pl.bones.footR].flatMap(b => legs.map(([a, c]) => seg(b, a, c, true))));
      const far = Math.max(...Object.values(A.bones as Record<string, number[]>).filter(q => q && typeof q[0] === 'number').map(along));
      return { out: C.A.state === 'dead' && C.A.downKind === 'choked', boot, went: along(A.bones.hips) - along(p0), lane, far, fast, end: { at: atE, e } as End, drift: end ? Math.hypot(atE[0] - end.at[0], atE[2] - end.at[2]) + 1 - (e[0] * end.e[0] + e[2] * end.e[2]) : 0 };
    } finally { stalkPolish(true); TAKEDOWN.on = td; }
  };
  type Lay = NonNullable<Awaited<ReturnType<typeof lay>>>;
  const M = HOLD.layAhead, open: { L1: Lay; L0: Lay }[] = [];
  for (const sd of SEEDS) { const L1 = await lay(up() ? M : 0, sd), L0 = await lay(0, sd); if (!L1 || !L0) { verdict(false, 'the stalk ends in the grab', `never grabbed (seed ${sd}): the check could not stand its scene`); return; } open.push({ L1, L0 }); }
  const mn = (a: number[]) => Math.min(...a), mx = (a: number[]) => Math.max(...a), fast0 = mx(open.map(o => o.L0.fast)), went0 = mx(open.map(o => o.L0.went));
  // (walls and furniture, stood in the strip of floor ahead of where the same seed's open run ENDED its choke — the pair has turned by then, by half a
  // turn on the frozen stand — a few seconds before the choke ends. The walls: from a metre, where the fall itself has no room, across both of the lay's
  // own edges (half the way, the whole way: LAY_REACH and the sweep's 5 cm past each) to open floor, each asked which of the three it gets. The furniture:
  // the things a line down his middle, or nine, passed between. These runs keep the key up under the break: the rule they hold is the room's, not the key's)
  const eH = M / 2 + LAY_REACH + 0.05, eF = M + LAY_REACH + 0.05, wall = (at: number): Thing[] => [{ fwd: at + 0.1, side: 0, y: 1, h: [1.5, 1, 0.1] }];
  const WALLS = [0.95, 1.2, eH - 0.1, eH + 0.1, (eH + eF) / 2, eF - 0.1, eF + 0.1, eF + 0.4];
  const THINGS: [string, number, Thing[]][] = [   // [what, its nearest face along his facing, the boxes]
    ['a table\'s top 0.7 m ahead', 0.7, [{ fwd: 1.075, side: 0, y: 0.73, h: [0.8, 0.02, 0.375] }]], ['a table\'s top 1.1 m ahead', 1.1, [{ fwd: 1.475, side: 0, y: 0.73, h: [0.8, 0.02, 0.375] }]],
    ['a low table 0.9 m ahead', 0.9, [{ fwd: 1.2, side: 0, y: 0.28, h: [0.5, 0.02, 0.3] }, { fwd: 1.2, side: 0.42, y: 0.13, h: [0.03, 0.13, 0.26] }, { fwd: 1.2, side: -0.42, y: 0.13, h: [0.03, 0.13, 0.26] }]],
    ['a post a hand to one side', 0.94, [{ fwd: 1, side: 0.15, y: 1, h: [0.06, 1, 0.06] }]], ['a post a hand to the other', 0.94, [{ fwd: 1, side: -0.15, y: 1, h: [0.06, 1, 0.06] }]],
    ['a crate 1.2 m ahead', 1.2, [{ fwd: 1.5, side: 0, y: 0.15, h: [0.3, 0.15, 0.3] }]], ['a crate 1.6 m ahead', 1.6, [{ fwd: 1.9, side: 0, y: 0.15, h: [0.3, 0.15, 0.3] }]], ['a crate 1.6 m ahead, a foot to one side', 1.6, [{ fwd: 1.9, side: 0.45, y: 0.15, h: [0.3, 0.15, 0.3] }]]];
  const things: { what: string; near: number; wall: boolean; X: Lay }[] = [];
  for (const k of [0, 1]) for (const [what, near, boxes, isWall] of [...(k === 0 ? WALLS : [eH - 0.1, eH + 0.1, eF - 0.1, eF + 0.1]).map(w => [`a wall ${f2(w)} m ahead`, w, wall(w), true] as const), ...THINGS.map(t => [...t, false] as const)]) {
    const X = await lay(M, SEEDS[k], boxes, open[k].L0.end); if (!X) { verdict(false, 'the stalk ends in the grab', `never grabbed (seed ${SEEDS[k]}, ${what}): the check could not stand its scene`); return; } things.push({ what, near, wall: isWall, X }); }
  const kind = (went: number) => went < went0 + 0.08 ? 'kept' : Math.abs(went - M / 2) < 0.12 ? 'half' : went > M - 0.1 ? 'whole' : '?', owed = (near: number) => near < eH ? 'kept' : near < eF ? 'half' : 'whole';
  const ok = (t: { near: number; wall: boolean; X: Lay }) => t.X.out && t.X.drift < 0.05 && t.X.went > -0.1 && t.X.fast < fast0 + 1 && (t.wall ? kind(t.X.went) === owed(t.near) && t.near - t.X.far > 0.03 : t.X.went < Math.max(0, t.near - LAY_REACH) + went0 + 0.08);
  const W = things.filter(t => t.wall), T = things.filter(t => !t.wall), bad = things.filter(t => !ok(t)), count = (k: string) => W.filter(t => kind(t.X.went) === k).length;
  verdict(M > 0.3 && open.every(o => o.L1.out && o.L0.out && o.L1.boot > 0.15 && o.L1.boot > o.L0.boot + 0.1 && o.L1.went > o.L0.went + 0.5 && o.L1.fast < fast0 + 1) && !bad.length && count('kept') > 0 && count('half') > 0 && count('whole') > 0,
    'choked out and two and a half seconds on, on every seed, no part of the man\'s legs lies within 15 cm of either of Sam\'s boots (seen from above) and they lie 10 cm or more further from one than with the lay at 0: his hips have gone half a metre or more further along his facing since the choke ended, and never a metre a second faster than the fastest fall at 0 — and with a wall stood from a metre ahead of him to past the lay\'s own reach he is kept where he knelt, laid half the way or the whole way by which side of the lay\'s two edges it stands (a tenth of a metre either side of each), no bone of his within 3 cm of it; and with a table\'s top, a low table, a post a hand off his middle or a low crate stood in the strip of floor ahead of him he is laid no further than the floor is clear less a body\'s length; never thrown back, his hips never that fast',
    `the lay ${f2(M)} m, ${SEEDS.length} seeds · his legs at the nearest ${cm(mn(open.map(o => o.L1.boot)))} cm from a boot (at 0: ${cm(mx(open.map(o => o.L0.boot)))} at the furthest) · his hips went ${f2(mn(open.map(o => o.L1.went)))} m or more along his facing (at 0: ${f2(went0)}) at ${f2(mx(open.map(o => o.L1.fast)))} m/s at the fastest (at 0: ${f2(fast0)}) · ${W.length} walls, how far ahead [how far he went]: ${W.map(t => `${f2(t.near)}[${f2(t.X.went)}]`).join(' ')} m, the edges ${f2(eH)} and ${f2(eF)} · kept where he knelt ${count('kept')}, half the lay ${count('half')}, the whole of it ${count('whole')} · the nearest bone ${cm(mn(W.map(t => t.near - t.X.far)))} cm short of a wall · ${T.length} runs with furniture, he went ${T.map(t => f2(t.X.went)).join(' ')} m · the fastest of them all ${f2(mx(things.map(t => t.X.fast)))} m/s${bad.length ? ` · OUT OF BOUNDS: ${bad.map(t => `${t.what} (went ${f2(t.X.went)} m at ${f2(t.X.fast)} m/s, ${cm(t.near - t.X.far)} cm short, the scene ${f2(t.X.drift)} off)`).join(', ')}` : ''} · choked ${open.every(o => o.L1.out && o.L0.out) && things.every(t => t.X.out)}`);
}
/** THE KEY FINISHES IT (STALK.key, the tenth pass): the held click only brings him in. The grab is the row's key, and that grab is the stalk's. */
async function keyCard() {
  console.log('\n=== key: the held click brings him in and stops, and the row\'s key is the grab ===');
  const grabRow = (C: Ctx) => C.g.nearby.some((r: any) => r.kind === 'guard' && r.verb === 'grab' && r.guard === C.A);
  const take = (C: Ctx) => { const g = C.g, ok = g.selectVerb('guard', 'grab'); C.W.input.pressed.add('Space'); let n = 0; while (!C.held() && n++ < 40) C.step(); return ok; };
  const run = async (key: boolean, walk: number, secs: number, gap = 2.6) => {
    const C = await world(true, SEEDS[0], gap, walk); CLOSE.noKnife = true; STALK.key = key; const g0 = STALK_STATS.grabs, pl = C.g.player.char;
    C.press(); let alone = false, far = 0, near = 9, slow = 9, drift = 0;
    for (let i = 0; i < secs * 60; i++) { C.step(); if (C.held()) { alone = true; break; }
      if (i >= secs * 60 - 90) { far = Math.max(far, C.gap()); near = Math.min(near, C.gap()); slow = Math.min(slow, Math.abs(Math.hypot(pl.vel[0], pl.vel[2]) - walk)); drift = Math.max(drift, Math.abs(Math.hypot(pl.vel[0], pl.vel[2]) - walk)); } }
    const row = !alone && grabRow(C), on = !alone && stalkOn(C.g) === C.A, astern = alone ? 0 : C.astern();
    let took = false, from = false, hit = false, grabs = STALK_STATS.grabs - g0;
    if (!alone) { took = take(C) && C.held(); from = !!C.g.player.holding?.from; grabs = STALK_STATS.grabs - g0; for (let i = 0; i < 60 && C.held(); i++) { C.step(); hit ||= C.g.player.holding?.hitAt !== undefined; } }
    return { alone, far, near, drift, row, on, astern, took, from, hit, grabs, held: C.held() };
  };
  const A = await run(up(), 0, 7), W = await run(up(), 0.9, 4, 1.4),   // (from 1.4 m, for four seconds: further along, the lobby's floor has things in his way)
    O = await run(false, 0, 7);
  verdict(!A.alone && A.far < STALK.grabM && A.near > STALK.keyM - 0.02 && A.drift < 0.03 && A.row && A.on && A.astern < 25,
    'from 2.6 m behind a man who stands, the button held for seven seconds with no key: nobody is grabbed. He ends still, inside the grab\'s reach and behind him, the stalk still his, with the row\'s grab offered',
    `grabbed by itself ${A.alone} · over the last second and a half: ${f2(A.near)}‥${f2(A.far)} m from him (the grab's reach ${f2(STALK.grabM)}), the most he moved ${A.drift.toFixed(3)} m/s · ${f1(A.astern)}° off dead astern · the stalk on him ${A.on} · the row offered ${A.row}`);
  verdict(A.took && A.from && A.hit && A.grabs === 1,
    'the row\'s key then: he is in the arm, and the grab is the stalk\'s own (it steps in from where he stood, it lands, and it is counted once)',
    `in his arm ${A.took} · a step in from where he stood ${A.from} · it landed ${A.hit} · the stalk's grabs ${A.grabs}`);
  verdict(!W.alone && W.far < STALK.grabM && W.near > STALK.keyM - 0.05 && W.drift < 0.1 && W.row && W.took && W.from && W.grabs === 1,
    '1.4 m behind a man walking away at 0.9 m/s, the button held for four seconds: nobody is grabbed, he keeps station in reach at the man\'s own pace, and the key takes him',
    `grabbed by itself ${W.alone} · over the last second and a half: ${f2(W.near)}‥${f2(W.far)} m, his speed within ${f2(W.drift)} m/s of the man's · the row offered ${W.row} · the key: in his arm ${W.took}, the stalk's ${W.from}, counted ${W.grabs}`);
  // by his own keys: no click at all. Stood in reach behind him, the key's grab is the stalk's too
  const K = await (async () => { const C = await world(true, SEEDS[0], 0.85, 0); CLOSE.noKnife = true; STALK.key = up(); for (let i = 0; i < 10; i++) C.step(); const g0 = STALK_STATS.grabs, row = grabRow(C), took = take(C) && C.held(); return { row, took, from: !!C.g.player.holding?.from, grabs: STALK_STATS.grabs - g0 }; })();
  verdict(K.row && K.took && K.from && K.grabs === 1, 'walked in on his own keys (no click at all) and stood in reach behind him, the key\'s grab is the same one: the stalk\'s step in, counted once',
    `the row offered ${K.row} · in his arm ${K.took} · the stalk's ${K.from} · counted ${K.grabs}`);
  verdict(O.alone && O.grabs === 1, 'STALK.key off: the hold ends in the grab by itself, as before', `grabbed by itself ${O.alone} · counted ${O.grabs}`);
}

/** AS THE PAGE SHIPS IT (the tenth pass's two keys both up): what ends a stalk, and what is drawn and offered, with the key finishing the grab from the low creep —
 *  the cards before this one run with both keys down (they read the passes before). */
async function shippedCard() {
  console.log('\n=== shipped: with the key and the low creep both up — what ends it, the wider way out, the line that says what the click does, and a man walked up on standing ===');
  const mk = async (gap: number) => { const C = await world(true, SEEDS[0], gap, 0); CLOSE.ready = true; CLOSE.noKnife = true; STALK.key = up(); STALK.low = up(); return C; };
  const inReach = async () => { const C = await mk(2.6); C.press(); for (let i = 0; i < 7 * 60; i++) C.step(); return C; };
  const speed = (C: Ctx) => Math.hypot(C.g.player.char.vel[0], C.g.player.char.vel[2]);
  // he turns on Sam while Sam keeps station in reach
  { const C = await inReach(), on0 = stalkOn(C.g) === C.A && !C.held(); C.A.char.bodyYaw = C.A.char.aimYaw = -EAST; let grabbed = false, again = false; C.step(); const on1 = stalkOn(C.g); for (let i = 0; i < 120; i++) { C.step(); grabbed ||= C.held(); again ||= !!stalkOn(C.g); }
    verdict(on0 && on1 === null && !grabbed && !again, 'keeping station in reach behind him with the button down, the man turns to face Sam: the stalk is over on that frame, and two seconds on nobody is grabbed and nothing is stalked again',
      `waiting in reach before ${on0} · the frame after, ${on1 ? 'still stalking' : 'nothing stalked'} · grabbed ${grabbed}, stalking again ${again}`); }
  // let go in reach, and pressed again
  { const C = await inReach(), on0 = stalkOn(C.g) === C.A; C.lift(); for (let i = 0; i < 30; i++) C.step(); const on1 = stalkOn(C.g), v = speed(C), held1 = C.held(); C.press(); for (let i = 0; i < 20; i++) C.step(); const on2 = stalkOn(C.g) === C.A, held2 = C.held();
    verdict(on0 && on1 === null && v < 0.02 && !held1 && on2 && !held2, 'the button let go while he waits in reach: nothing is stalked, he stands still and nobody is grabbed. Pressed on him again from there: the stalk is his again, and still nobody is grabbed without the key',
      `waiting ${on0} · let go: ${on1 ? 'still stalking' : 'nothing stalked'}, ${f2(v)} m/s, in his arm ${held1} · pressed again: stalking ${on2}, in his arm ${held2}`); }
  // the wider way out: begun from 3.8 m, the man is put 4.6 m off (inside lowOutM) and then 5.3 m off (outside it)
  { const C = await mk(3.8); C.press(); for (let i = 0; i < 6; i++) C.step(); const on0 = stalkOn(C.g) === C.A; C.A.char.pos[0] += 4.6 - C.gap(); C.step(); C.step(); const on1 = stalkOn(C.g) === C.A; C.A.char.pos[0] += STALK.lowOutM + 0.3 - C.gap(); C.step(); C.step(); const on2 = stalkOn(C.g);
    verdict(on0 && on1 && on2 === null, `begun from 3.8 m, the man suddenly 4.6 m off is still stalked (the wider way out, ${f1(STALK.lowOutM)} m) and ${f1(STALK.lowOutM + 0.3)} m off he is not`,
      `begun ${on0} · 4.6 m off: stalking ${on1} · ${f1(STALK.lowOutM + 0.3)} m off: ${on2 ? 'still stalking' : 'nothing stalked'}`); }
  // the line that says what the click does, out to where a press begins it
  { const hint = async (gap: number, low: boolean) => { const C = await mk(gap); STALK.low = low; for (let i = 0; i < 4; i++) C.step(); const r = C.g.interactables.find((x: any) => x.kind === 'guard' && x.guard === C.A), row = C.g.nearby.some((x: any) => x.kind === 'guard' && x.verb); return r ? `${r.line2 ?? ''}${row ? ' [a row]' : ''}` : ''; };   // (the man's marker: the line over him — and whether the list has a row to press on him)
    const far = await hint(3.6, up()), off = await hint(3.6, false), near = await hint(1.8, up()), past = await hint(STALK.lowBeginM + 0.3, up());
    verdict(/hold to sneak up on him$/.test(far) && off === '' && /hold to sneak up on him$/.test(near) && past === '', '3.6 m behind him the man has one line, what the held click does, and no row to press (with STALK.low off there is nothing that far out, as before); 1.8 m behind him the same line; past the wider start nothing',
      `3.6 m: '${far}' (off: '${off}') · 1.8 m: '${near}' · ${f1(STALK.lowBeginM + 0.3)} m: '${past}'`); }
  // a man walked up on STANDING is walked up on standing: the low creep is out of his crouch, and nothing forces one
  { const C = await mk(2.0), pl = C.g.player, an = pl.char.anim; pl.crouch = false; let low = 0; for (let i = 0; i < 90; i++) { C.step(); low = Math.max(low, an.low); } const head = pl.char.bones.head[1];
    pl.crouch = true; for (let i = 0; i < 90; i++) C.step(); const headC = pl.char.bones.head[1];
    verdict(low === 0 && head > 1.3 && headC < head - 0.3 && an.low > 0, 'stood up 2.0 m behind him with no button: for a second and a half nothing of the low creep is fed and he is drawn standing (head above 1.3 m); crouched there, he is lower by 30 cm or more and the creep\'s sink is fed',
      `standing: the most of the sink fed ${f2(low)}, head ${f2(head)} m · crouched: head ${f2(headC)} m, the sink fed ${f2(an.low)}`); }
}

/** LOWER, HANDS DOWN (STALK.low, the tenth pass): closing, he sinks and slows and no arm comes up; the grab is the rise. */
async function lowCard() {
  console.log('\n=== low: closing, he sinks lower and slower with his hands down, the pose holds when the button is let go, and the grab springs up out of it ===');
  const run = async (low: boolean, pause: boolean) => {
    const C = await world(true, SEEDS[0], 2.9, 0), pl = C.g.player.char, an = pl.anim; CLOSE.ready = true; CLOSE.noKnife = true; STALK.key = true; STALK.low = low;
    const hand = () => Math.max(pl.bones.handL[1], pl.bones.handR[1]) - pl.bones.chest[1];
    const far = { hips: pl.bones.hips[1], hand: hand() }; let top = -9, back = 0, last = far.hips, t = Infinity, drift = 0, reach = 0, rise = 0;
    C.press();
    for (let i = 0; i < 12 * 60; i++) {
      if (pause && C.gap() < 1.6) { C.lift(); for (let k = 0; k < 30; k++) C.step(); const h0 = pl.bones.hips[1], a0 = hand(); for (let k = 0; k < 40; k++) { C.step(); drift = Math.max(drift, Math.abs(pl.bones.hips[1] - h0), Math.abs(hand() - a0)); } break; }
      C.step(); top = Math.max(top, hand()); reach = Math.max(reach, an.ready ? an.readyAmt : 0); rise = Math.max(rise, an.rise); back = Math.max(back, pl.bones.hips[1] - last); last = pl.bones.hips[1];
      if (C.gap() < STALK.grabM && Math.hypot(pl.vel[0], pl.vel[2]) < 0.02) { t = i / 60; break; }
    }
    for (let k = 0; k < 30 && !pause; k++) C.step();   // (stood in reach: the pose he waits in)
    const near = { hips: pl.bones.hips[1], hand: hand(), head: pl.bones.head[1] };
    let spring = 0, held = false;
    if (!pause) { C.g.selectVerb('guard', 'grab'); C.W.input.pressed.add('Space'); for (let i = 0; i < 40; i++) { C.step(); held ||= C.held(); spring = Math.max(spring, pl.bones.hips[1] - near.hips); } }
    return { far, near, top, back, t, drift, reach, rise, spring, held, gap: C.gap() };
  };
  const begins = async (low: boolean, gap: number) => { const C = await world(true, SEEDS[0], gap, 0); CLOSE.noKnife = true; STALK.key = true; STALK.low = low; C.press(); for (let i = 0; i < 6; i++) C.step(); return stalkOn(C.g) === C.A; };
  const wide = [await begins(up(), 3.8), await begins(false, 3.8), await begins(up(), STALK.lowBeginM + 0.3)];
  const A = await run(up(), false), O = await run(false, false), P = await run(up(), true);
  verdict(wide[0] && !wide[1] && !wide[2], 'a press on him from 3.8 m behind begins the creep (the wider start), where with STALK.low off it does not (the mode\'s 3.0 m), and from past the wider start it does not either',
    `from 3.8 m: begun ${wide[0]} (off: ${wide[1]}) · from ${f1(STALK.lowBeginM + 0.3)} m: begun ${wide[2]}`);
  verdict(isFinite(A.t) && A.far.hips - A.near.hips >= 0.025 && A.back < 0.004 && A.top < 0.02 && A.reach === 0 && A.rise === 0,
    'from 2.9 m behind a man who stands, the button held: his hips only ever go down as he closes, 2.5 cm or more by the time he is in reach, neither hand ever comes up to his chest, and nothing of the old reach or rise plays',
    `hips ${f2(A.far.hips)} m at 2.9 m, ${f2(A.near.hips)} in reach (${f1((A.far.hips - A.near.hips) * 100)} cm lower) · the most they came back up in a frame ${(A.back * 1000).toFixed(1)} mm · the higher hand, at its highest, ${f1(A.top * 100)} cm against his chest · the old reach ${f2(A.reach)}, rise ${f2(A.rise)}`);
  verdict(isFinite(A.t) && isFinite(O.t) && A.t >= O.t * 1.15 && O.top > A.top + 0.1 && O.far.hips - O.near.hips < 0.03,
    'against the same hold with STALK.low off (the pass before: the arm comes up and he rises): he takes longer to close, by 15% or more, and off, a hand is higher by 10 cm or more and the hips do not go down',
    `in reach and still after ${f2(A.t)} s (off: ${f2(O.t)}) · off: the higher hand ${f1(O.top * 100)} cm against his chest, hips ${f1((O.far.hips - O.near.hips) * 100)} cm lower`);
  verdict(P.drift < 0.006 && P.near.hips < P.far.hips - 0.005 && P.near.hips > A.near.hips + 0.005, 'let go 1.6 m out, the pose is a frame of the move, paused: part of the way down, and hips and hands do not move for two thirds of a second', `hips ${f2(P.near.hips)} m (${f2(P.far.hips)} far off, ${f2(A.near.hips)} in reach) · the most either moved while he stood ${(P.drift * 1000).toFixed(1)} mm`);
  verdict(A.held && O.held && A.spring >= O.spring + 0.05, 'the key in reach: he is in the arm, and the grab comes UP out of the low creep (the spring): his hips come up further in it, by 5 cm or more, than out of the pass before\'s wait',
    `in his arm ${A.held} (off: ${O.held}) · the hips at their highest ${f1(A.spring * 100)} cm above where he waited (off: ${f1(O.spring * 100)})`);
}
async function off() {
  console.log('\n=== off: the key down ===');
  const C = await world(false, SEEDS[0], 2.6, 0), pl = C.g.player.char, p0 = [...pl.pos], b0 = STALK_STATS.begun; C.press(); for (let i = 0; i < 240; i++) C.step();
  const moved = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]);
  verdict(moved < 0.02 && !C.held() && STALK_STATS.begun === b0, 'with the key down the same press and four seconds of hold move nobody and grab nobody', `moved ${f2(moved)} m · in his arm ${C.held()} · stalks begun ${STALK_STATS.begun - b0}`);
}
const polVals = () => ({ jolt: STALK.jolt, turnIn: STALK.turnIn, show: STALK.cornerShow, long: STALK.catchLong, way: HOLD.wayShape, dip: HOLD.lunge.dip, back: HOLD.lunge.back, m: HOLD.sway.m, twist: HOLD.sway.twist, side: HOLD.apart.side, tip: HOLD.apart.tip, arch: HOLD.yank.arch, with: STALK.yankWith, shape: HOLD.catchShape, hit: HOLD.hitShape, lay: HOLD.layAhead });
const POL_DOWN = { jolt: 0, turnIn: false, show: false, long: 1, way: false, dip: 0, back: 0, m: 0, twist: 0, side: 0, tip: 0, arch: -11, with: false, shape: false, hit: false, lay: 0 };   // (what a recording from before them replays with: journal.ts)
const polUp = (v: ReturnType<typeof polVals>) => v.jolt > 0 && v.turnIn === true && v.show === true && v.long > 1 && v.way === true && v.dip > 0 && v.back > 0 && v.m > 0 && v.twist > 0 && v.side > 0 && v.tip > 0 && v.arch > -11 && v.with === true && v.shape === true && v.hit === true && v.lay > 0;
const POL_ROWS = ['STALK.jolt', 'STALK.turnIn', 'STALK.cornerShow', 'STALK.catchLong', 'HOLD.wayShape', 'HOLD.lunge.dip', 'HOLD.lunge.back', 'HOLD.sway.m', 'HOLD.sway.twist', 'HOLD.apart.side', 'HOLD.apart.tip', 'HOLD.yank.arch', 'STALK.yankWith', 'HOLD.catchShape', 'HOLD.hitShape', 'HOLD.layAhead'];
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STALK, want = word !== undefined ? word === '1' : shipped;
  STALK.on = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = STALK.on, foundOk = !shipped || word !== undefined || found === want;
  const keyStood = STALK.key, lowStood = STALK.low;   // (the tenth pass's two keys, as this stand-up left them)
  const polWord = process.env.TPS_STALKPOLISH, polWant = polWord !== undefined ? polWord === '1' : shipped, polRows = POL_ROWS.every(k => (PR.FROZEN_HOLDS[k] ?? '').startsWith('TPS_STALKPOLISH=1'));
  if (BREAK) stalkPolish(!polWant);   // (the break: a stand-up that left them the other way)
  const polStood = polVals(), polBoot = BREAK || !shipped || polWord !== undefined || polUp(polFound!); stalkPolish(true);   // (the stand's own answer as this stand-up left it: a pin writes it, and an unpinned shipped stand-up must leave it up. polBoot: the page's stand has it from the page's boot — read when the check began, before anything here raised it. Then up, for the recordings below)
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = !!snap.tables.STALK && 'on' in snap.tables.STALK;
  STALK.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.on = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.on;
  const before = JSON.parse(JSON.stringify(snapUp)); if (!BREAK) { for (const k of ['jolt', 'joltFace', 'turnIn', 'cornerShow', 'catchLong', 'yankWith']) delete before.tables.STALK[k]; delete before.tables.HOLD.wayShape; delete before.tables.HOLD.catchShape; delete before.tables.HOLD.hitShape; delete before.tables.HOLD.layAhead; }   // (the break: the keys left in, so nothing is put down)
  JR.applyKnobs(W.game, before); const pass = polVals(), face = STALK.joltFace; JR.applyKnobs(W.game, snapUp);
  const mid = JSON.parse(JSON.stringify(snapUp)); if (!BREAK) { delete mid.tables.STALK.joltFace; delete mid.tables.STALK.joltAtOnce; } JR.applyKnobs(W.game, mid); const face5 = STALK.joltFace, jolt5 = STALK.jolt, once5 = STALK.joltAtOnce;
  const six = JSON.parse(JSON.stringify(snapUp)); delete six.tables.STALK.joltAtOnce; STALK.joltAtOnce = true; JR.applyKnobs(W.game, six); const once6 = STALK.joltAtOnce; JR.applyKnobs(W.game, snapUp);
  const seven = JSON.parse(JSON.stringify(snapUp)); if (!BREAK) { delete seven.tables.STALK.yankWith; delete seven.tables.HOLD.catchShape; delete seven.tables.HOLD.hitShape; delete seven.tables.HOLD.layAhead; } JR.applyKnobs(W.game, seven); const p7 = polVals(); JR.applyKnobs(W.game, snapUp);
  const eight = JSON.parse(JSON.stringify(snapUp)); if (!BREAK) { delete eight.tables.HOLD.hitShape; delete eight.tables.HOLD.layAhead; } JR.applyKnobs(W.game, eight); const p8 = polVals(); JR.applyKnobs(W.game, snapUp);   // (…and one of the eighth: the catch's shape, and neither of the ninth's two keys)   // (…and one of the seventh: all the polish but the catch's shape — neither of its two keys)   // (…and one of the sixth: joltFace, and no joltAtOnce — the wait)   // (a recording of the fifth pass: the duck, at any turn)
  PR.pageSwitches(new URLSearchParams(BREAK ? '' : 'stalkpolish=0')); const pol = polVals(); PR.pageSwitches(new URLSearchParams('')); const plain = polVals(); JR.applyKnobs(W.game, snapUp);   // (the word, then a plain address after it: by the same function, both ways)
  const back = STALK.jolt > 0 && STALK.joltFace < 180 && STALK.turnIn === true && HOLD.wayShape === true && HOLD.lunge.dip > 0;
  delete snap.tables.STALK; STALK.on = true; JR.applyKnobs(W.game, snap); const old = STALK.on;
  const read = (q: string) => { STALK.on = !STALK.on; PR.pageSwitches(new URLSearchParams(q)); return STALK.on; }, plainQ = read(''), offQ = read('stalk=0');
  verdict((STAND_ENV as string[]).includes('TPS_STALK') && PR.FROZEN_HOLDS['STALK.on'] === 'TPS_STALK=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stalk=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALK')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['STALK.on']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stalk=0 ${offQ}`);
  verdict(face5 === 180 && once5 === true && once6 === false && STALK.joltAtOnce === false && jolt5 > 0 && face === 180 && p7.with === false && p7.shape === false && p7.hit === false && p7.lay === 0 && p8.with === true && p8.shape === true && p8.hit === false && p8.lay === 0 && plain.hit === true && plain.lay > 0 && p7.turnIn === true && p7.way === true && p7.jolt > 0 && plain.with === true && plain.shape === true && JSON.stringify(pol) === JSON.stringify(pass) && pass.jolt === 0 && pass.turnIn === false && pass.show === false && pass.long === 1 && pass.way === false && pass.dip === 0 && pass.side === 0 && pass.arch === -11
    && plain.jolt > 0 && plain.turnIn === true && plain.way === true && plain.dip > 0 && plain.side > 0 && back,
    'a recording from before the fourth and fifth passes (no jolt, turnIn, cornerShow or catchLong in its stalk table, no wayShape in the hold\'s) replays with every one of them down, one of the fifth (the duck, no joltFace) replays with the duck at any turn and at once (joltAtOnce), one of the sixth (joltFace, no joltAtOnce) with the wait, one of the seventh (no yankWith, no catchShape) with those two down and the rest up, one of the eighth (no hitShape, no layAhead in the hold\'s table) with those two down and the catch\'s shape up, one made with them all replays with them up, the page\'s ?stalkpolish=0 puts the same sixteen numbers down as the first, and a plain address after it puts them up again',
    `from before: ${JSON.stringify(pass)}, joltFace ${face} · of the fifth: jolt ${jolt5}, joltFace ${face5}, at once ${once5} · of the sixth: at once ${once6} · of the seventh: yankWith ${p7.with}, catchShape ${p7.shape}, turnIn ${p7.turnIn} · of the eighth: catchShape ${p8.shape}, hitShape ${p8.hit}, layAhead ${p8.lay} · from after: all up ${back} · ?stalkpolish=0: ${JSON.stringify(pol) === JSON.stringify(pass) ? 'the same sixteen' : JSON.stringify(pol)} · a plain address after it: jolt ${plain.jolt}, turnIn ${plain.turnIn}, wayShape ${plain.way}, the dip ${plain.dip}`);
  verdict((STAND_ENV as string[]).includes('TPS_STALKPOLISH') && polRows && polBoot && (polWant ? polUp(polStood) : JSON.stringify(polStood) === JSON.stringify(POL_DOWN)),
    'the polish is a hold of its own: its sixteen numbers are rows of the two stands\' list with one word, they stand up on the shipped stand and down on the frozen one (the numbers a recording from before them replays with), and TPS_STALKPOLISH has the say on either',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALKPOLISH')} · the sixteen rows ${polRows} · wanted ${polWant ? 'up' : 'down'} · stood ${JSON.stringify(polStood)} · up from the page's boot, where that is asked ${polBoot}`);
  { // THE TENTH PASS'S TWO KEYS (STALK.key, STALK.low): rows of the two stands' list each with its own word, up on the shipped stand and down on the frozen one, carried by a recording, down for one from before them, and written by the page's boot
    const want2 = (w: string | undefined) => w !== undefined ? w === '1' : shipped, keyWant = want2(process.env.TPS_STALKKEY), lowWant = want2(process.env.TPS_STALKLOW);
    const rows = (STAND_ENV as string[]).includes('TPS_STALKKEY') && (STAND_ENV as string[]).includes('TPS_STALKLOW') && (PR.FROZEN_HOLDS['STALK.key'] ?? '').startsWith('TPS_STALKKEY=1') && (PR.FROZEN_HOLDS['STALK.low'] ?? '').startsWith('TPS_STALKLOW=1');
    const was2 = [STALK.key, STALK.low]; STALK.key = STALK.low = true; const up2 = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.key = STALK.low = false; JR.applyKnobs(W.game, up2); const kept2 = STALK.key && STALK.low;
    const old2 = JSON.parse(JSON.stringify(up2)); if (!BREAK) { delete old2.tables.STALK.key; delete old2.tables.STALK.low; } STALK.key = STALK.low = true; JR.applyKnobs(W.game, old2); const down2 = !STALK.key && !STALK.low;
    const boot = (q: string) => { STALK.key = STALK.low = false; PR.pageSwitches(new URLSearchParams(q)); return [STALK.key, STALK.low]; }, plain = boot(''), noKey = boot('stalkkey=0'), noLow = boot('stalklow=0'); [STALK.key, STALK.low] = was2;
    const bootOk = plain[0] && plain[1] && !noKey[0] && noKey[1] && noLow[0] && !noLow[1], stoodOk = shipped && process.env.TPS_STALKKEY === undefined && process.env.TPS_STALKLOW === undefined ? keyFound === keyWant && lowFound === lowWant : keyStood === keyWant && lowStood === lowWant;
    verdict(rows && stoodOk && kept2 && down2 && bootOk,
      'the key as the grab\'s finish and the low creep are each a row of the two stands\' list with a word of its own, up on the shipped stand and down on the frozen one, carried by a recording\'s tables, down for a recording from before them, and written by the page\'s boot (on for a plain address, each off by its own word)',
      `the rows ${rows} · the key: wanted ${keyWant}, stood ${keyStood}, found ${keyFound} · lower: wanted ${lowWant}, stood ${lowStood}, found ${lowFound} · recorded up ${kept2} · an old recording puts both down ${down2} · plain ${plain.join('/')}, ?stalkkey=0 ${noKey.join('/')}, ?stalklow=0 ${noLow.join('/')}`); }
}

/** the whole card (probes.ts 'stalk'): true = every check passed. The switches are put back as they were found. */
export async function stalkCheck(): Promise<boolean> {
  const was = { ...STALK }, close = JSON.parse(JSON.stringify(CLOSE)), rnd = Math.random; allPass = true; found = STALK.on; polFound = polVals(); keyFound = STALK.key; lowFound = STALK.low; const hold = knobsCopy(['HOLD']);
  const only = process.env.STALK_ONLY?.split(',').filter(Boolean);   // (STALK_ONLY=key,low: those cards alone, for a quick look while tuning. Never a verdict: that is the whole card, and a run of some of it says PARTIAL and fails)
  const cards: Record<string, () => Promise<void>> = { grab, still, steer, letGo, walkPress, out, tell, stepIn, shape, legs, catchShape, lands, key: keyCard, low: lowCard, shipped: shippedCard, corner, off };
  const unknown = only?.filter(n => n !== 'harness' && !(n in cards)) ?? [];
  if (unknown.length) { console.log(`STALK_ONLY names no card: ${unknown.join(', ')} (the cards: ${Object.keys(cards).join(', ')}, harness)`); return false; }
  try {
    for (const [name, card] of Object.entries(cards)) if (!only || only.includes(name)) await card();
    Object.assign(STALK, was); if (!only || only.includes('harness')) await harness(); }
  finally { Object.assign(STALK, was); Object.assign(CLOSE, close); Math.random = rnd; knobsBack(hold); }   // (the hold's table too, as it was found: world() raises its share of the polish)
  console.log(`\n=== stalk: ${only ? `PARTIAL (${only.join(', ')}): ${allPass ? 'those pass' : 'FAILURES above'} — not a verdict` : allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass && !only;
}
if (import.meta.main) process.exit((await stalkCheck()) ? 0 : 1);
