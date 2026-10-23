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
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?stalk=0` puts it off), rides a recording's
//             tables, and a recording from before the table replays with it off.
// STALK_BREAK=1 = the key left down where grab, still, steer and let ask for it up, the tell off where it is asked for, the step in at 0 s, the corner off: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how it looks or feels. tools/qa/stalk-page.cjs drives the real page on the software adapter.
import { standUp, ROOT } from './headless.ts';

const { STALK, STALK_STATS, stalkOn } = await import(`${ROOT}/src/game/stalk.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.STALK_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, SAM: P3 = [6.2, 0, 19.5], SEEDS = [4411, 1, 2];   // (the lobby's open floor, some 15 m of it east of him)
const f2 = (n: number) => n.toFixed(2);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const up = () => !BREAK;

interface Ctx { W: any; g: any; A: any; walk: number; f: number; top: number; jerk: number; step(): void; press(): void; lift(): void; held(): boolean; gap(): number; astern(): number }
/** the lobby with the floor's men parked far off, one man `gap` m east of Sam facing east (walking away at `walk` m/s, moved by the check: the AI is off), Sam
 *  crouched with empty hands `bearing` degrees off the man's facing (180 = dead astern) */
async function world(on: boolean, seed: number, gap: number, walk: number, bearing = 180): Promise<Ctx> {
  Math.random = seeded(seed); const W: any = await quiet(() => standUp({ seed } as any)), g = W.game; CLOSE.on = true; STALK.on = on;   // (the frozen stand's pins write both at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  const [A, ...rest] = g.guards; for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  const a = EAST + bearing * Math.PI / 180, at: P3 = [SAM[0] + gap, 0, SAM[2]];
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
  for (let i = 0; i < 30 && C.g.player.holding?.phase === 'grab'; i++) { C.step(); const d = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]); if (first < 0) first = d; peak = Math.max(peak, d / DT); p0 = [...pl.pos] as P3; n++; }
  const end = C.gap(); STALK.catchSecs = was;
  verdict(isFinite(t) && from > 0.5 && first >= 0 && first < 0.02 && peak < 4.5 && end < 0.5, 'in the arm from most of a metre out: the first frame of the way in moves him under 2 cm (the old snap: a fifth of the gap), he is never over 4.5 m/s, and he ends at the hold\'s own distance',
    `${isFinite(t) ? `in his arm in ${f2(t)} s` : 'never grabbed'} · grabbed from ${f2(from)} m · the first frame moved him ${first.toFixed(3)} m · top speed ${f2(peak)} m/s over ${n} frames · he ends ${f2(end)} m off the man`);
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
    let at = { deg: -1, d: -1 }, early = false, from = false;
    for (let i = 0; i < 5 * 60 && !C.held(); i++) {
      A.char.pos[0] += t[0] * 1.15 * DT; A.char.pos[2] += t[2] * 1.15 * DT; A.char.vel = [t[0] * 1.15, 0, t[2] * 1.15];
      const b = Math.atan2(pl.char.pos[0] - A.char.pos[0], pl.char.pos[2] - A.char.pos[2]) - A.char.bodyYaw, deg = Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) * 180 / Math.PI, d = C.gap();
      if (hold) { C.W.input.buttons |= 1; if (i === 0) C.W.input.clicked |= 1; }
      C.W.step(DT); pl.visibility = 0.02;
      if (C.held()) { at = { deg, d }; early = deg < STALK.cornerDeg - 3; from = !!pl.holding?.from; }
    }
    return { held: C.held(), at, early, from, wall: !!pl.wall, n: STALK_STATS.corner - c0 };
  };
  const A = await pass(true, up()), B = await pass(false, true), O = await pass(true, false);
  if (!A || !B || !O) { verdict(false, 'the lobby has a wall Sam can put his back on', 'no wall took him: the check could not stand its scene'); return; }
  verdict(A.held && !A.early && A.at.d < STALK.cornerM + 0.05 && A.from && !A.wall && A.n === 1, 'on a wall with empty hands and the button held from the start, a man walking past a pace out is in his arm — not before Sam is 75° round from his nose, inside the corner\'s reach, off the wall by the eased step in',
    `in his arm ${A.held}${A.held ? ` with Sam ${A.at.deg.toFixed(0)}° round from his nose, ${f2(A.at.d)} m off` : ''} · the step in ${A.from} · still on the wall ${A.wall} · corner grabs ${A.n}`);
  verdict(!B.held && B.n === 0 && !O.held && O.n === 0, 'the button never pressed, the same man walks past and nobody is grabbed; nor with STALK.corner off and the button held', `no press: in his arm ${B.held} · the corner off: in his arm ${O.held}`);
  const S = await onWall(SEEDS[0], 1.0);   // a man who stands a pace short of him along the wall, facing him
  if (S) { const { C } = S, pl = C.g.player.char; S.C.A.char.bodyYaw = S.C.A.char.aimYaw = Math.atan2(pl.pos[0] - C.A.char.pos[0], pl.pos[2] - C.A.char.pos[2]); STALK.corner = true;
    for (let i = 0; i < 120; i++) { C.W.input.buttons |= 1; C.W.step(DT); C.g.player.visibility = 0.02; }
    verdict(!C.held(), 'a man who stands a pace off FACING him is not taken, the button held two seconds', `in his arm ${C.held()} · ${f2(C.gap())} m off`); }
}
async function off() {
  console.log('\n=== off: the key down ===');
  const C = await world(false, SEEDS[0], 2.6, 0), pl = C.g.player.char, p0 = [...pl.pos], b0 = STALK_STATS.begun; C.press(); for (let i = 0; i < 240; i++) C.step();
  const moved = Math.hypot(pl.pos[0] - p0[0], pl.pos[2] - p0[2]);
  verdict(moved < 0.02 && !C.held() && STALK_STATS.begun === b0, 'with the key down the same press and four seconds of hold move nobody and grab nobody', `moved ${f2(moved)} m · in his arm ${C.held()} · stalks begun ${STALK_STATS.begun - b0}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STALK, want = word !== undefined ? word === '1' : shipped;
  STALK.on = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = STALK.on, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = !!snap.tables.STALK && 'on' in snap.tables.STALK;
  STALK.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.on = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.on;
  delete snap.tables.STALK; STALK.on = true; JR.applyKnobs(W.game, snap); const old = STALK.on;
  const read = (q: string) => { STALK.on = !STALK.on; PR.pageSwitches(new URLSearchParams(q)); return STALK.on; }, plainQ = read(''), offQ = read('stalk=0');
  verdict((STAND_ENV as string[]).includes('TPS_STALK') && PR.FROZEN_HOLDS['STALK.on'] === 'TPS_STALK=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stalk=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALK')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['STALK.on']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stalk=0 ${offQ}`);
}

/** the whole card (probes.ts 'stalk'): true = every check passed. The switches are put back as they were found. */
export async function stalkCheck(): Promise<boolean> {
  const was = { ...STALK }, close = JSON.parse(JSON.stringify(CLOSE)), rnd = Math.random; allPass = true; found = STALK.on;
  try { await grab(); await still(); await steer(); await letGo(); await out(); await tell(); await stepIn(); await corner(); await off(); Object.assign(STALK, was); await harness(); }
  finally { Object.assign(STALK, was); Object.assign(CLOSE, close); Math.random = rnd; }
  console.log(`\n=== stalk: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkCheck()) ? 0 : 1);
