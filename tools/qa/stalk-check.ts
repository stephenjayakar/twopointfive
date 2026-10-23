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
//   off       the key down: the same press and hold moves nobody and grabs nobody.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?stalk=0` puts it off), rides a recording's
//             tables, and a recording from before the table replays with it off.
// STALK_BREAK=1 = the key left down where grab, still, steer and let ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
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
  try { await grab(); await still(); await steer(); await letGo(); await out(); await off(); Object.assign(STALK, was); await harness(); }
  finally { Object.assign(STALK, was); Object.assign(CLOSE, close); Math.random = rnd; }
  console.log(`\n=== stalk: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkCheck()) ? 0 : 1);
