// 'stalkwide' — ARMS OUT (STALK.wide, src/game/stalk.ts; fed by close.ts, drawn by character.ts creepLayer under CREEP.wide). The maintainer, of the creep's
// raised hands: "having the hands up just doesn't look cool"; closing on a man from behind in his crouch, Sam's arms are out to each side, low, with open hands.
//   bun run tools/qa/stalkwide-check.ts        (also `probes.ts stalkwide`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   out       hands empty, crouched, the click held on a man three metres ahead: before he starts to sink his hands are where the key down has them; once
//             he is under two metres they are a metre apart, a third of a metre wider than with the key down, and no higher than his own neck.
//   waits     the click let go, he stops behind the man: two seconds on his arms are still out. The man taken away, they are the plain crouch's inside
//             half a second.
//   upright   stood upright behind the man, the key changes nothing: his hands are where the key down has them.
//   grab      the key takes the man out of the stance as it did: he is `held` within a frame of where the key down has him.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?stalkwide=0`), rides a recording's
//             tables, and a recording from before the key replays with it off.
// STALKWIDE_BREAK=1 = the key left down where out and waits ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the stance LOOKS (tools/qa/close-stills.ts scene stalk-rifle draws it on the CPU).
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.STALKWIDE_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (x: number) => x.toFixed(2);
/** the lobby's floor, the rifleman facing east with Sam 3.2 m behind him, hands empty, the rest parked */
async function world(wide: boolean, crouch = true) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = STALK.key = STALK.low = true; STALK.wide = wide; STALK.heft = false; stalkPolish(true);   // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - 3.2, 0, AT[2]]); g.player.crouch = crouch;
  const step = (n = 1) => { STALK.wide = wide; for (let i = 0; i < n; i++) { A.char.vel = [0, 0, 0]; W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(40);
  const c = g.player.char, gap = () => Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]);
  const spread = () => { const b = c.bones; return Math.hypot(b.handL[0] - b.handR[0], b.handL[1] - b.handR[1], b.handL[2] - b.handR[2]); };
  const over = () => { const b = c.bones, n = b.neck ?? b.head; return Math.max(b.handL[1], b.handR[1]) - n[1]; };   // (how far the higher hand is above his own neck)
  /** the arms' shape against his shoulders: the most a hand is outside its own shoulder, the least a hand is under it, and how far the left is ahead of the right (m) */
  const shape = () => { const b = c.bones, sL = b.upperArmL, sR = b.upperArmR; let lx = sL[0] - sR[0], lz = sL[2] - sR[2]; const L = Math.hypot(lx, lz) || 1; lx /= L; lz /= L;   // (toward his left)
    const fx = -lz, fz = lx;   // (his forward: the shoulder line turned a quarter)
    const outL = (b.handL[0] - sL[0]) * lx + (b.handL[2] - sL[2]) * lz, outR = -((b.handR[0] - sR[0]) * lx + (b.handR[2] - sR[2]) * lz);
    const lead = (b.handL[0] - b.handR[0]) * fx + (b.handL[2] - b.handR[2]) * fz;
    const fwdL = (b.handL[0] - sL[0]) * fx + (b.handL[2] - sL[2]) * fz, fwdR = (b.handR[0] - sR[0]) * fx + (b.handR[2] - sR[2]) * fz;
    return { out: Math.max(outL, outR), under: Math.min(sL[1] - b.handL[1], sR[1] - b.handR[1]), lead, v: [outL, sL[1] - b.handL[1], fwdL, outR, sR[1] - b.handR[1], fwdR] }; };
  return { W, g, A, step, gap, spread, over, shape };
}
/** the click held from 3.2 m: the widest his hands are before he sinks (over 2.7 m), the mean of it under 1.9 m, and the highest a hand comes against his neck; he is left 1.5 m behind the man with the click let go */
async function creep(wide: boolean, crouch = true) {
  const C = await world(wide, crouch), { W } = C; W.input.buttons |= 1; W.input.clicked |= 1; let far = 0, near = 0, n = 0, high = -9, out = -9, under = 9, lead = 0, at16: number[] | null = null;
  for (let i = 0; i < 900 && C.gap() > 1.5; i++) { C.step(); const d = C.gap(); if (d > 2.7) far = Math.max(far, C.spread()); if (d < 1.9) { near += C.spread(); n++; high = Math.max(high, C.over()); const S = C.shape(); out = Math.max(out, S.out); under = Math.min(under, S.under); lead += S.lead; if (!at16 && d < 1.6) at16 = S.v; } }
  W.input.buttons &= ~1; C.step(30);
  return { C, far, near: n ? near / n : 0, high, out, under, lead: n ? lead / n : 0, at16: at16 ?? [0, 0, 0, 0, 0, 0] };
}
async function out() {
  console.log('\n=== out: his arms come out as he sinks ===');
  const a = await creep(up()), b = await creep(false), off16 = Math.hypot(...a.at16.map((x: number, i: number) => x - b.at16[i]));
  verdict(Math.abs(a.far - b.far) < 0.03 && a.high < 0 && a.out > 0 && a.out < 0.25 && a.under > 0.2 && a.lead > 0.05 && off16 > 0.15,
    'hands empty, crouched, the click held on a man three metres ahead: before he sinks his hands are where the key down has them; under two metres the footage\'s creep: each hand a little outside its own shoulder and never a wing\'s reach out, well under it, the left leading, and 1.6 m out his hands a good way off the key down\'s',
    `his hands apart before he sinks ${f2(a.far)} m (key down ${f2(b.far)}) · under two metres: ${f2(a.near)} m apart (key down ${f2(b.near)}), the furthest out of its shoulder ${f2(a.out)} m (key down ${f2(b.out)}), the least under it ${f2(a.under)} m, the left ahead by ${f2(a.lead)} m (key down ${f2(b.lead)}), 1.6 m out ${f2(off16)} m off the key down\'s hands · the higher hand against his neck ${f2(a.high)} m`);
  console.log('\n=== waits: they stay out while he waits behind the man, and go when the man is gone ===');
  a.C.step(120); const wait = a.C.spread(), still = Math.hypot(a.C.g.player.char.vel[0], a.C.g.player.char.vel[2]), held = a.C.shape(); b.C.step(120); const wait0 = b.C.spread(), held0 = b.C.shape(), moved = Math.hypot(...held.v.map((x: number, i: number) => x - held0.v[i]));
  a.C.A.char.pos = [37.5, 0, 12]; b.C.A.char.pos = [37.5, 0, 12]; a.C.step(30); b.C.step(30); const gone = a.C.spread(), gone0 = b.C.spread();
  verdict(still < 0.02 && held.lead > 0.05 && held.out < 0.25 && moved > 0.15 && Math.abs(gone - gone0) < 0.05,
    'the click let go, he stops behind the man and two seconds on his arms are still out, the left leading, his hands a good way off where the key down has them; the man taken away, half a second on his hands are where the key down has them',
    `stopped (${f2(still)} m/s), two seconds on his hands ${f2(wait)} m apart (key down ${f2(wait0)}), the left ahead by ${f2(held.lead)} m (key down ${f2(held0.lead)}), ${f2(moved)} m off the key down\'s hands, the furthest out ${f2(held.out)} m · the man gone: ${f2(gone)} m (key down ${f2(gone0)})`);
}
async function upright() {
  console.log('\n=== upright: stood behind a man, not crouched ===');
  const at = async (wide: boolean) => { const C = await world(wide, false); C.g.teleportPlayer([AT[0] - 1.5, 0, AT[2]]); C.g.player.crouch = false; C.step(90); return { sp: C.spread(), up: !C.g.player.crouch }; };
  const a = await at(true), b = await at(false);
  verdict(a.up && Math.abs(a.sp - b.sp) < 0.02, 'stood upright a metre and a half behind the man, the key changes nothing: his hands are as far apart as with the key down',
    `upright ${a.up} · his hands ${f2(a.sp)} m apart (key down ${f2(b.sp)})`);
}
async function grab() {
  console.log('\n=== grab: the key takes the man out of the stance ===');
  const go = async (wide: boolean) => { const { C } = await creep(wide), { W, g, A } = C, c = g.player.char; W.input.buttons |= 1; W.input.clicked |= 1;
    for (let n = 0; n < 900; n++) { C.step(); if (n > 30 && Math.hypot(c.vel[0], c.vel[2]) < 0.02 && C.gap() < 0.95) break; }
    C.step(30); const sp = C.spread(); g.selectVerb('guard', 'grab'); W.input.pressed.add('Space'); let held = -1;
    for (let f = 1; f <= 90 && held < 0; f++) { C.step(); if (g.player.holding?.phase === 'held') held = f; }
    return { held, sp, who: g.player.holding?.g === A }; };
  const a = await go(true), b = await go(false);
  verdict(a.held > 0 && a.who && Math.abs(a.held - b.held) <= 1, 'the click brings him in behind the rifleman, arms out, and the key takes him: he is held within a frame of where the key down has him',
    `held on frame ${a.held} (key down ${b.held}), the rifleman ${a.who} · in reach his hands were ${f2(a.sp)} m apart (key down ${f2(b.sp)})`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STALKWIDE, want = word !== undefined ? word === '1' : shipped;
  STALK.wide = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = STALK.wide, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.STALK?.wide === 'boolean';
  STALK.wide = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.wide = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.wide;
  delete snap.tables.STALK.wide; STALK.wide = true; JR.applyKnobs(W.game, snap); const old = STALK.wide;
  const read = (q: string) => { STALK.wide = !STALK.wide; PR.pageSwitches(new URLSearchParams(q)); return STALK.wide; }, plainQ = read(''), offQ = read('stalkwide=0');
  verdict((STAND_ENV as string[]).includes('TPS_STALKWIDE') && String(PR.FROZEN_HOLDS['STALK.wide']).startsWith('TPS_STALKWIDE=1') && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stalkwide=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STALKWIDE')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['STALK.wide']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stalkwide=0 ${offQ}`);
}

/** the whole card (probes.ts 'stalkwide'): true = every check passed. The switches are put back as they were found. */
export async function stalkwideCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = STALK.wide;
  try { await out(); await upright(); await grab(); Object.assign(STALK, stalk); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== stalkwide: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkwideCheck()) ? 0 : 1);
