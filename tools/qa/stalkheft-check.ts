// 'stalkheft' — WEIGHT IN IT (STALK.heft, src/game/stalk.ts; fed by close.ts, drawn by character.ts creepLayer under CREEP.heft). The maintainer, of the arms in the
// creep: "(1) looks weird, but (2) also just looks like very static. the chaos theory animations have some real weight but also smoothness and precision to them".
//   bun run tools/qa/stalkheft-check.ts        (also `probes.ts stalkheft`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   step      closing on a man from behind, under two metres: his shoulders turn against his feet (the left foot ahead, the right shoulder ahead), each hand swings against
//             its own foot, and his hips go over the foot he stands on. With the key down all of it is still.
//   behind    his arms come a beat after his feet (the best fit of the swing to the stride is some frames late), so the arms are carried, not driven.
//   stop      the click let go with his feet passing each other: his feet stop and his hands go on past that frame, then settle.
//   alive     stopped behind the man three seconds on, his shoulders still rise and fall, on top of what the key down's do.
//   smooth    no frame of the whole walk in throws a hand: its fastest frame against his hips is no faster than the key down's, and an arm is never pulled straight.
//   ahead     no hand ever goes out past his head, the way he is facing, on the walk in: from the game's camera, side on, that is arms held out (his note on a GPU).
//   feet      the foot he stands on stays where it stands, as with the key down.
//   grab      the key takes the man out of the stance as it did: he is `held` within a frame of where the key down has him.
//   harness   down on the frozen stand, up in the page, ?stalkheft=0 puts it down; it rides a recording's tables, and a recording from before it replays with it down.
// STALKHEFT_BREAK=1 = the key left down where step, behind, stop, alive and ahead ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how it LOOKS (tools/qa/close-stills.ts scene stalk-clip, then tools/qa/pose-clip.py, draws it moving on the CPU).
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.STALKHEFT_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3), f1 = (x: number) => x.toFixed(1);
const span = (a: number[]) => a.length ? Math.max(...a) - Math.min(...a) : 0;
const fit = (a: number[], b: number[], lag = 0) => { let ab = 0, aa = 0, bb = 0, n = 0, ma = 0, mb = 0; for (let i = 0; i + lag < a.length; i++) { ma += a[i]; mb += b[i + lag]; n++; } ma /= n; mb /= n;
  for (let i = 0; i + lag < a.length; i++) { const x = a[i] - ma, y = b[i + lag] - mb; ab += x * y; aa += x * x; bb += y * y; } return ab / (Math.sqrt(aa * bb) || 1); };
/** the lobby's floor, the rifleman facing east with Sam 3.2 m behind him, hands empty, the rest parked */
async function world(heft: boolean) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = STALK.key = STALK.low = STALK.wide = true; STALK.heft = heft; stalkPolish(true);   // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - 3.2, 0, AT[2]]); g.player.crouch = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { STALK.heft = heft; STALK.wide = true; A.char.vel = [0, 0, 0]; W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(40);
  const c = g.player.char, gap = () => Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]);
  /** his body this frame, along the way he is facing (`f`) and across it to his left (`l`): the feet's stride, the shoulders' turn, the hands' swing, the hips over his feet */
  const read = () => { const b = c.bones, fx = Math.sin(c.bodyYaw), fz = Math.cos(c.bodyYaw), lx = fz, lz = -fx, f = (p: number[]) => p[0] * fx + p[2] * fz, l = (p: number[]) => p[0] * lx + p[2] * lz;
    const sL = b.upperArmL, sR = b.upperArmR, h = b.hips, hL = b.handL, hR = b.handR;
    return { stride: f(b.footL) - f(b.footR), turn: Math.atan2(f(sL) - f(sR), l(sL) - l(sR)) * 180 / Math.PI, swing: (f(hL) - f(hR)), side: l(h) - (l(b.footL) + l(b.footR)) / 2, lift: b.footR[1] - b.footL[1], shoulder: (sL[1] + sR[1]) / 2 - c.pos[1],
      hL: [hL[0] - h[0], hL[1] - h[1], hL[2] - h[2]], hR: [hR[0] - h[0], hR[1] - h[1], hR[2] - h[2]], footL: [...b.footL], footR: [...b.footR],
      ahead: Math.max(f(hL), f(hR)) - f(b.head), stretch: Math.max(Math.hypot(hL[0] - sL[0], hL[1] - sL[1], hL[2] - sL[2]) / (Math.hypot(b.forearmL[0] - sL[0], b.forearmL[1] - sL[1], b.forearmL[2] - sL[2]) + Math.hypot(hL[0] - b.forearmL[0], hL[1] - b.forearmL[1], hL[2] - b.forearmL[2])), Math.hypot(hR[0] - sR[0], hR[1] - sR[1], hR[2] - sR[2]) / (Math.hypot(b.forearmR[0] - sR[0], b.forearmR[1] - sR[1], b.forearmR[2] - sR[2]) + Math.hypot(hR[0] - b.forearmR[0], hR[1] - b.forearmR[1], hR[2] - b.forearmR[2]))) }; };
  return { W, g, A, c, step, gap, read };
}
/** the click held from 3.2 m all the way in to where he waits, a read of each frame he moves under 1.9 m */
async function walk(heft: boolean) {
  const C = await world(heft), { W, c } = C, near: any[] = []; W.input.buttons |= 1; W.input.clicked |= 1; let throwM = 0, last: any = null, slip = 0, slipN = 0;
  for (let i = 0; i < 1500; i++) { C.step(); W.input.clicked &= ~1; const r = C.read(), v = Math.hypot(c.vel[0], c.vel[2]); if (C.gap() < 1.9 && v > 0.03) near.push(r); if (C.gap() < 1.1 && v < 0.02) break;
    if (last) { throwM = Math.max(throwM, Math.hypot(...(r.hL as number[]).map((x, k) => x - last.hL[k])), Math.hypot(...(r.hR as number[]).map((x, k) => x - last.hR[k])));
      for (const [now, was] of [[r.footL, last.footL], [r.footR, last.footR]] as number[][][]) if (now[1] < 0.14 && was[1] < 0.14) { const m = Math.hypot(now[0] - was[0], now[2] - was[2]); if (m < 0.02) { slip += m; slipN++; } } }
    last = r; }
  return { C, near, throwM, slip: slipN ? slip / slipN : 0, stretch: Math.max(...near.map(r => r.stretch)) };
}
/** the click held until his feet pass each other under 1.7 m (the arms at their fastest), then let go, and the frames as he stops: both keys let go on the same frame */
async function letGo(heft: boolean, at: number) {
  const C = await world(heft), { W } = C, after: any[] = []; W.input.buttons |= 1; W.input.clicked |= 1; let n = 0;
  for (; n < 1500; n++) { C.step(); W.input.clicked &= ~1; const r = C.read(); if (at >= 0 ? n === at : C.gap() < 1.7 && Math.abs(r.stride) < 0.1) break; }
  W.input.buttons &= ~1; for (let i = 0; i < 150; i++) { C.step(); after.push(C.read()); }
  return { C, n, after };
}
async function moves() {
  const a = await walk(up()), b = await walk(false), la = await letGo(up(), -1), lb = await letGo(false, la.n);
  console.log('\n=== step: his shoulders, hands and hips go with his feet ===');
  const col = (w: any, k: string) => w.near.map((r: any) => r[k]) as number[], turnFit = fit(col(a, 'stride'), col(a, 'turn')), swingFit = fit(col(a, 'stride'), col(a, 'swing')), sideFit = fit(col(a, 'lift'), col(a, 'side'));
  verdict(span(col(a, 'stride')) > 0.3 && span(col(a, 'turn')) > 15 && span(col(b, 'turn')) < 8 && span(col(a, 'swing')) > 0.3 && span(col(b, 'swing')) < 0.1 && turnFit < -0.5 && swingFit < -0.5 && sideFit > 0.3,
    'under two metres his shoulders turn with each step, the left foot ahead bringing the right shoulder ahead, each hand swings against its own foot, and his hips go over the foot he stands on; with the key down they are still',
    `${a.near.length} frames, stride over ${f2(span(col(a, 'stride')))} m · shoulders over ${f1(span(col(a, 'turn')))}° (key down ${f1(span(col(b, 'turn')))}°), fit to the stride ${f2(turnFit)} · hands over ${f2(span(col(a, 'swing')))} m (key down ${f2(span(col(b, 'swing')))}), fit ${f2(swingFit)} · hips over ${f3(span(col(a, 'side')))} m, fit to the feet ${f2(sideFit)}`);
  console.log('\n=== behind: his arms come a beat after his feet ===');
  let best = 0, bestAt = 0; for (let k = 0; k <= 40; k++) { const v = -fit(col(a, 'stride'), col(a, 'swing'), k); if (v > best) { best = v; bestAt = k; } }
  verdict(bestAt >= 3 && bestAt <= 30, 'the swing fits the stride best some frames late, a twentieth of a second to half a second',
    `best fit ${bestAt} frames late (${f2(bestAt * DT)} s) at ${f2(best)}`);
  console.log('\n=== stop: his feet stop, his hands go on and settle ===');
  const stopAt = (w: any) => { for (let i = 1; i < w.after.length; i++) if (w.after.slice(i, i + 12).every((r: any, k: number) => k === 0 || Math.abs(r.stride - w.after[i + k - 1].stride) < 0.002)) return i; return -1; };
  const fa = stopAt(la), on = la.after.map((r: any, i: number) => r.swing - lb.after[i].swing).slice(Math.max(0, fa)) as number[], most = Math.max(...on.map(x => Math.abs(x - on[0]))), rest = Math.abs(on[on.length - 1] - on[on.length - 8]);   // (against the key down's own, frame by frame: what is left is what the weight does)
  verdict(fa >= 0 && most > 0.03 && rest < 0.003, 'the click let go with his feet passing each other, his hands go on past the frame his feet stop on, more than the key down\'s do, and settle there',
    `feet still on frame ${fa}, the stride ${f2(la.after[Math.max(0, fa)].stride)} m · his hands go on ${f3(most)} m past it and at the end move ${f3(rest)} m in 7 frames`);
  console.log('\n=== alive: he breathes as he waits ===');
  la.C.step(180); lb.C.step(180); const s: number[] = []; for (let i = 0; i < 240; i++) { la.C.step(); lb.C.step(); s.push(la.C.read().shoulder - lb.C.read().shoulder); }   // (against the key down's, frame by frame)
  verdict(span(s) > 0.006, 'stopped behind the man for three seconds, his shoulders still rise and fall over the next four, on top of whatever the key down\'s do', `his shoulders over ${f3(span(s))} m`);
  console.log('\n=== ahead: his hands stay behind his head ===');
  const past = Math.max(...col(a, 'ahead')), past0 = Math.max(...col(b, 'ahead'));
  verdict(past < 0, 'on the walk in no hand goes out past his head the way he is facing, so from the side his arms are not held out', `the hand nearest ahead of his head ${f2(past)} m (key down ${f2(past0)})`);
  console.log('\n=== smooth: nothing thrown, nothing pulled straight, his feet stay put ===');
  verdict(a.throwM < b.throwM * 1.1 + 0.002 && a.stretch < 0.985 && a.slip < b.slip * 1.15 + 0.0005, 'no frame of the walk in throws a hand, no arm is pulled straight, and the foot he stands on stays where it stands as with the key down',
    `the fastest frame of a hand against his hips ${f3(a.throwM)} m (key down ${f3(b.throwM)}) · the arm at its longest ${f2(a.stretch)} of its reach · a foot down slips ${f3(a.slip)} m a frame (key down ${f3(b.slip)})`);
}
async function grab() {
  console.log('\n=== grab: the key takes the man out of the stance ===');
  const go = async (heft: boolean) => { const C = await world(heft), { W, g, A } = C, c = g.player.char; W.input.buttons |= 1; W.input.clicked |= 1;
    for (let n = 0; n < 1200; n++) { C.step(); W.input.clicked &= ~1; if (n > 30 && Math.hypot(c.vel[0], c.vel[2]) < 0.02 && C.gap() < 0.95) break; }
    C.step(30); g.selectVerb('guard', 'grab'); W.input.pressed.add('Space'); let held = -1;
    for (let f = 1; f <= 90 && held < 0; f++) { C.step(); if (g.player.holding?.phase === 'held') held = f; }
    return { held, who: g.player.holding?.g === A }; };
  const a = await go(true), b = await go(false);
  verdict(a.held > 0 && a.who && Math.abs(a.held - b.held) <= 1, 'the click brings him in behind the rifleman and the key takes him: he is held within a frame of where the key down has him', `held on frame ${a.held} (key down ${b.held}), the rifleman ${a.who}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STALKHEFT, want = word !== undefined ? word === '1' : shipped;
  STALK.heft = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = STALK.heft, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.STALK?.heft === 'boolean';
  STALK.heft = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.heft = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.heft;
  delete snap.tables.STALK.heft; STALK.heft = true; JR.applyKnobs(W.game, snap); const old = STALK.heft;
  const read = (q: string) => { STALK.heft = !STALK.heft; PR.pageSwitches(new URLSearchParams(q)); return STALK.heft; }, plainQ = read(''), offQ = read('stalkheft=0');
  verdict((STAND_ENV as string[]).includes('TPS_STALKHEFT') && String((PR.FROZEN_HOLDS as Record<string, string>)['STALK.heft']).startsWith('TPS_STALKHEFT=1') && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stalkheft=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALKHEFT')} · FROZEN_HOLDS ${(PR.FROZEN_HOLDS as Record<string, string>)['STALK.heft']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stalkheft=0 ${offQ}`);
}

/** the whole card (probes.ts 'stalkheft'): true = every check passed. The switches are put back as they were found. */
export async function stalkheftCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = STALK.heft;
  try { await moves(); await grab(); Object.assign(STALK, stalk); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== stalkheft: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkheftCheck()) ? 0 : 1);
