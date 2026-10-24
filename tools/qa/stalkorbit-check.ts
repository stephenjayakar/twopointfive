// 'stalkorbit' — ROUND HIM (STALK.orbit, src/game/stalk.ts `orbited`; fed by player.ts). The maintainer: "when you're clicking on an enemy and moving around
// them, you should really be "orbiting" them".
//   bun run tools/qa/stalkorbit-check.ts        (also `probes.ts stalkorbit`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   round     the button held on a man 1.6 m ahead and the move key that points most across him held for a second: Sam goes round him, the gap within 6 cm
//             of where it was, a good part of a quarter turn round him, facing him, the creep still on.
//   slant     the view turned 12°, so that key is a little off square across him: still round on the same circle (STALK.orbitSnap), and with it at 0 a spiral.
//   nogun     no round leaves in a creep (his hands are empty in one: stalk.ts hands); the pistol drawn out of one, the gun swings to the cursor at
//             the aim's own rate (aimweight.ts AIMWEIGHT.rate), not in a frame — the aim's weight is only left out while a creep is on.
//   edge      the same key held for six seconds: he goes no further round than the edge of the man's back arc and waits there, the creep still on.
//   in, out   the key that points most at him closes the gap and stops at the waiting distance, never nearer; the one that points away opens it.
//   walking   the man walking away at 1.2 m/s and the key across him held a second: the circle goes with him, the gap within 20 cm, the creep on.
//   reach     from 0.9 m (in reach), the key across him held four seconds: he stops where the grab is still on offer, and the key then takes him.
//   stick     the lab's stick (STALK.drag) dragged across him: taken round him the same way.
//   letgo     the key let go with the button still held: the creep walks him in to reach, as it did.
//   off       the key down: a move key ends the creep and his feet are his own, as it was.
//   harness   down on the frozen stand, up in the page, ?stalkorbit=0 puts it down; it rides a recording's tables, and a recording from before it replays with it down.
// STALKORBIT_BREAK=1 = the key left down where round, slant, nogun, edge, in, walking, reach and stick ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no hand on the keys: they are written into the input. Nobody has played it.
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish, stalkOn } = await import(`${ROOT}/src/game/stalk.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
const { BEHIND_COS } = await import(`${ROOT}/src/game/close.ts`);
const { AIMWEIGHT } = await import(`${ROOT}/src/game/aimweight.ts`);

const BREAK = process.env.STALKORBIT_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (x: number) => x.toFixed(2), deg = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI;
/** the lobby's floor, the rifleman facing east with Sam `gap` m behind him, crouched with empty hands, the rest parked; the button pressed on the man's chest and held */
async function world(orbit: boolean, gap = 1.6, walk = 0, drag = false, yaw = 0) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = STALK.key = STALK.low = true; STALK.drag = drag; STALK.orbit = orbit; stalkPolish(true);   // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = yaw; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - gap, 0, AT[2]]); g.player.crouch = true;
  const c = g.player.char;
  let wt: number | null = null;   // (`walk`: when the man set off, east at `walk` m/s — `go()`)
  const step = (n = 1) => { for (let i = 0; i < n; i++) { STALK.orbit = orbit; STALK.drag = drag; const on = wt !== null; A.char.vel = [on ? walk : 0, 0, 0]; A.char.pos = [AT[0] + (on ? walk * (g.time - wt!) : 0), 0, AT[2]]; A.char.bodyYaw = EAST; W.step(DT); g.player.visibility = 0.02; } };
  const go = () => { wt = g.time; };
  step(40); W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.input.buttons |= 1; W.input.clicked |= 1; step(1); W.input.clicked &= ~1;
  /** the move key that points most across the man (or `into` him, or away), from where Sam stands, by the camera's floor axes */
  const pick = (want: 'across' | 'in' | 'out') => { const { fwd, right } = W.cam.planarBasis(), ux = (A.char.pos[0] - c.pos[0]), uz = (A.char.pos[2] - c.pos[2]), L = Math.hypot(ux, uz) || 1;
    const ks: [string, number[]][] = [['KeyW', fwd], ['KeyS', [-fwd[0], 0, -fwd[2]]], ['KeyD', right], ['KeyA', [-right[0], 0, -right[2]]]];
    const score = (d: number[]) => { const r = (d[0] * ux + d[2] * uz) / L; return want === 'across' ? -Math.abs(r) : want === 'in' ? r : -r; };
    return ks.sort((a, b) => score(b[1]) - score(a[1]))[0][0]; };
  const gapNow = () => Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]), speed = () => Math.hypot(c.vel[0], c.vel[2]);
  const round = () => Math.atan2(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]);   // (his bearing round the man, from the man)
  const faces = () => deg(c.aimYaw - Math.atan2(A.char.pos[0] - c.pos[0], A.char.pos[2] - c.pos[2]));
  const behind = () => Math.cos(round() - A.char.bodyYaw);   // (−1 = dead behind him, the creep's own measure)
  return { W, g, A, c, step, go, pick, gapNow, speed, round, faces, behind, on: () => stalkOn(g) === A };
}
async function roundLine() {
  console.log('\n=== round: the key across him, held a second ===');
  const C = await world(up()); C.step(20); const k = C.pick('across'), g0 = C.gapNow(), b0 = C.round(); let most = 0;
  C.W.input.keys.add(k); for (let i = 0; i < 60; i++) { C.step(); most = Math.max(most, Math.abs(C.gapNow() - g0)); }
  const turned = deg(C.round() - b0), face = C.faces(), on = C.on(); C.W.input.keys.delete(k);
  verdict(on && most < 0.06 && turned > 20 && face < 30,
    'the button held on a man 1.6 m ahead and the move key that points most across him held for a second: Sam goes round him, the gap never more than 6 cm off where it was, over 20° round him, facing him, the creep still on',
    `${k}: the gap ${f2(g0)} m, at most ${f2(most)} m off it · ${turned.toFixed(0)}° round him · he faces ${face.toFixed(0)}° off the man · the creep on ${on}`);
}
async function slant() {
  console.log('\n=== slant: the view turned 12°, so the key across him is a little off ===');
  const run = async (snap: number) => { const C = await world(up(), 1.6, 0, false, 12 * Math.PI / 180); STALK.orbitSnap = snap; C.step(20); const k = C.pick('across'), g0 = C.gapNow(), b0 = C.round(); let most = 0;
    C.W.input.keys.add(k); for (let i = 0; i < 60; i++) { C.step(); most = Math.max(most, Math.abs(C.gapNow() - g0)); }
    const r = { k, g0, most, turned: deg(C.round() - b0), on: C.on() }; C.W.input.keys.delete(k); return r; };
  const snap = STALK.orbitSnap, a = await run(snap), b = await run(0); STALK.orbitSnap = snap;
  verdict(a.on && a.most < 0.06 && a.turned > 20 && b.most > a.most + 0.05,
    'the view turned 12° so the move key across him is a little off square, held a second: he still goes round on the same circle, the gap never more than 6 cm off (and with `orbitSnap` at 0 the same key spirals him in)',
    `${a.k}: the gap ${f2(a.g0)} m, at most ${f2(a.most)} m off it · ${a.turned.toFixed(0)}° round him · the creep on ${a.on} · with orbitSnap 0: ${f2(b.most)} m off`);
}
async function nogun() {
  console.log('\n=== nogun: no round in a creep, and the gun drawn out of one turns at the aim\'s rate ===');
  const C = await world(up()), k = C.pick('across'), s0 = C.g.mission.stats.shots; let bare = true;
  C.W.input.keys.add(k); for (let i = 0; i < 60; i++) { C.step(); bare &&= !!C.g.player.holstered; }
  const on = C.on(), shots = C.g.mission.stats.shots - s0, y0 = C.c.aimYaw;
  C.W.input.keys.delete(k); C.W.input.buttons &= ~1; C.g.player.holstered = false; C.g.player.slot = 'pistol';   // (the pistol drawn: the creep is over)
  const p = C.c.pos, side = [p[0] + Math.cos(y0) * 3, 0, p[2] - Math.sin(y0) * 3]; C.W.cursorAt([side[0], 0, side[2]]);   // (the cursor a quarter turn off his line)
  C.step(); const first = deg(C.c.aimYaw - y0), off = C.on() === null || C.on() === undefined || !C.on(); C.step(29); const later = deg(C.c.aimYaw - y0);
  const rate = AIMWEIGHT.rate as number, cap = AIMWEIGHT.on ? rate * DT * 180 / Math.PI + 1 : 45;   // (the aim's weight down, as on the frozen stand: the old ease, a quarter of the way a frame)
  verdict(on && bare && shots === 0 && off && first <= cap && later > first,
    'the button held on a man and a key across him for a second: his hands stay empty and no round leaves; the pistol then drawn with the cursor a quarter turn off: the creep is over and the gun swings there at the aim\'s own rate, no snap',
    `${k}: the creep on ${on}, hands empty throughout ${bare}, rounds ${shots} · drawn: the creep over ${off}, the first frame turned ${first.toFixed(1)}° (${AIMWEIGHT.on ? `the aim's rate allows ${cap.toFixed(1)}°` : `the aim's weight down: the old ease, under ${cap}°`}), half a second on ${later.toFixed(0)}°`);
}
async function edge() {
  console.log('\n=== edge: the key across him, held six seconds ===');
  const C = await world(up()), k = C.pick('across'); let worst = -1;
  C.W.input.keys.add(k); for (let i = 0; i < 360; i++) { C.step(); worst = Math.max(worst, C.behind()); }
  const on = C.on(), v = C.speed(), at = C.behind(); C.W.input.keys.delete(k);
  const lim = Math.min(STALK.outCos, BEHIND_COS);
  verdict(on && worst <= lim && at > lim - STALK.orbitEdge - 0.15 && v < 0.1,
    'the same key held for six seconds: he goes round no further than the edge of the grab\'s arc behind the man and waits there, the creep still on',
    `${k}: the furthest round ${f2(worst)} (the grab\'s arc ends at ${BEHIND_COS}, the creep at ${STALK.outCos}; he stops short by ${STALK.orbitEdge}) · at the end ${f2(at)}, ${f2(v)} m/s · the creep on ${on}`);
}
async function inOut() {
  console.log('\n=== in, out: the key at him and the key away ===');
  const a = await world(up()), ki = a.pick('in'); let least = 9; a.W.input.keys.add(ki); for (let i = 0; i < 240; i++) { a.step(); least = Math.min(least, a.gapNow()); }
  const inAt = a.gapNow(), inOn = a.on();
  const b = await world(up()), ko = b.pick('out'), g0 = b.gapNow(); b.W.input.keys.add(ko); b.step(45); const outBy = b.gapNow() - g0, outOn = b.on();
  verdict(inOn && least > STALK.keyM - 0.06 && Math.abs(inAt - STALK.keyM) < 0.12 && outOn && outBy > 0.3,
    'the key that points most at him closes the gap and stops at the waiting distance, never more than 6 cm nearer; the one that points away opens it; the creep on throughout',
    `${ki}: stopped ${f2(inAt)} m behind him (waits at ${STALK.keyM}), the nearest ${f2(least)} m, the creep on ${inOn} · ${ko}: three quarters of a second opened the gap ${f2(outBy)} m, the creep on ${outOn}`);
}
async function walking() {
  console.log('\n=== walking: the man walks away, the key across him held ===');
  const C = await world(up(), 1.6, 1.2); C.go(); C.step(30); const k = C.pick('across'), g0 = C.gapNow(); let most = 0;
  C.W.input.keys.add(k); for (let i = 0; i < 60; i++) { C.step(); most = Math.max(most, Math.abs(C.gapNow() - g0)); }   // (a second: the lobby's furniture is in his way after that)
  const on = C.on(); C.W.input.keys.delete(k);
  verdict(on && most < 0.2, 'the man walking away at 1.2 m/s and the key across him held a second: the circle goes with him, the gap never more than 20 cm off where it was, the creep still on',
    `${k}: the gap ${f2(g0)} m, at most ${f2(most)} m off it · the creep on ${on}`);
}
async function reach() {
  console.log('\n=== reach: from in reach, the key across him held, then the grab ===');
  const C = await world(up(), 0.9), k = C.pick('across'); C.W.input.keys.add(k); C.step(240); C.W.input.keys.delete(k); C.step(10);
  const at = C.behind(), on = C.on(); C.g.selectVerb('guard', 'grab'); C.W.input.pressed.add('Space'); let held = false;
  for (let i = 0; i < 60 && !held; i++) { C.step(); held = C.g.player.holding?.g === C.A; }
  verdict(on && held && at <= BEHIND_COS, 'from 0.9 m, in reach, the key across him held four seconds: he stops where the grab is still on offer, and the key then takes him',
    `${k}: stopped at ${f2(at)} (the grab\'s arc ends at ${BEHIND_COS}) · the creep on ${on} · in his arm ${held}`);
}
async function stick() {
  console.log('\n=== stick: the lab\'s stick dragged across him ===');
  const C = await world(up(), 1.6, 0, true), I = C.W.input, mid = [I.mouseX, I.mouseY], g0 = C.gapNow(), b0 = C.round(); let most = 0;
  I.mouseX = mid[0]; I.mouseY = mid[1] - STALK.dragFull; for (let i = 0; i < 60; i++) { C.step(); most = Math.max(most, Math.abs(C.gapNow() - g0)); }
  const turned = deg(C.round() - b0), on = C.on();
  verdict(on && most < 0.06 && turned > 20, 'the lab\'s stick dragged the whole way across the screen for a second: taken round him the same way, the gap never more than 6 cm off',
    `the gap ${f2(g0)} m, at most ${f2(most)} m off it · ${turned.toFixed(0)}° round him · the creep on ${on}`);
}
async function letgo() {
  console.log('\n=== letgo: the key let go, the button still held ===');
  const C = await world(true), k = C.pick('across'); C.W.input.keys.add(k); C.step(30); C.W.input.keys.delete(k);
  let n = 0; for (; n < 600; n++) { C.step(); if (n > 30 && C.speed() < 0.02 && C.gapNow() < 0.95) break; }
  verdict(C.on() && C.gapNow() < 0.95 && n < 600, 'the key let go with the button still held: the creep walks him in to reach by itself, as it did', `in reach (${f2(C.gapNow())} m) after ${(n * DT).toFixed(1)} s, the creep on ${C.on()}`);
}
async function off() {
  console.log('\n=== off: the key down, a move key ends the creep ===');
  const C = await world(false), k = C.pick('across'); C.W.input.keys.add(k); C.step(30); const on = C.on(), v = C.speed(); C.W.input.keys.delete(k);
  verdict(!on && v > 0.3, 'the key down: a move key ends the creep and his feet are his own, as it was', `the creep on ${on} · moving ${f2(v)} m/s on his own keys`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STALKORBIT, want = word !== undefined ? word === '1' : shipped;
  STALK.orbit = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = STALK.orbit, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.STALK?.orbit === 'boolean';
  STALK.orbit = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.orbit = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.orbit;
  delete snap.tables.STALK.orbit; STALK.orbit = true; JR.applyKnobs(W.game, snap); const old = STALK.orbit;
  const read = (q: string) => { STALK.orbit = !STALK.orbit; PR.pageSwitches(new URLSearchParams(q)); return STALK.orbit; }, plainQ = read(''), offQ = read('stalkorbit=0');
  verdict((STAND_ENV as string[]).includes('TPS_STALKORBIT') && String((PR.FROZEN_HOLDS as Record<string, string>)['STALK.orbit']).startsWith('TPS_STALKORBIT=1') && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stalkorbit=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALKORBIT')} · FROZEN_HOLDS ${(PR.FROZEN_HOLDS as Record<string, string>)['STALK.orbit']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stalkorbit=0 ${offQ}`);
}

/** the whole card (probes.ts 'stalkorbit'): true = every check passed. The switches are put back as they were found. */
export async function stalkorbitCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = STALK.orbit;
  try { await roundLine(); await slant(); await nogun(); await edge(); await inOut(); await walking(); await reach(); await stick(); await letgo(); await off(); Object.assign(STALK, stalk); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== stalkorbit: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkorbitCheck()) ? 0 : 1);
