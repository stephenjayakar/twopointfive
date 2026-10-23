// 'disarm' — THE GRAB DISARMS HIM (HOLD.disarm, src/game/disarm.ts). The maintainer: "we should also make the grab super satisfying. cool animation where sam
// disarms him and satisfying sounds".
//   bun run tools/qa/disarm-check.ts        (also `probes.ts disarm`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   beats     a man with a gun in his hand, taken from behind: on the grab's frame the gun is still his; by HOLD.strip.take it is out of his hand, an item in
//             Sam's (carried, off the floor); after HOLD.strip.drop nobody carries it and inside a second and a half it lies still within a metre of the pair;
//             by HOLD.strip.home the move is over. He is `held` on the frame he is with the switch off.
//   pose      both figures are told of the move while it runs (holdPose.strip, heldPose.strip) and of nothing once it is over; no box of Sam's is the knife
//             before HOLD.strip.knife.
//   ends      the hold let go while the gun is in Sam's hand: nothing is left carried a frame later, and the gun comes to rest on the floor.
//   off       the switch down: the gun is an item on the floor from the grab's first frame, as it was.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?disarm=0` puts it off), rides a recording's
//             tables, and a recording from before the key replays with it off.
// DISARM_BREAK=1 = the switch left down where beats, pose and ends ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the move LOOKS (tools/qa/close-stills.ts scenes disarm, disarm-rifle, disarm-gun draw it on the CPU) or sounds.
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK } = await import(`${ROOT}/src/game/stalk.ts`);
const { startGrab, freeHeld } = await import(`${ROOT}/src/game/player.ts`);
const { inHand } = await import(`${ROOT}/src/game/guards.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { KNIFE_TAG } = await import(`${ROOT}/src/game/rigProps.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.DISARM_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK;
/** the rifleman with his gun in his hands stood on the lobby's floor facing east, the rest parked, Sam with empty hands 0.8 m behind him */
async function world(on: boolean) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = on; CLOSE.on = true; CLOSE.noKnife = false; STALK.on = false;   // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);   // (a calm man with a pistol rig carries his torch: the rifleman has his gun in his hands)
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - 0.8, 0, AT[2]]);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(40);
  const gun = () => g.items.items.find((it: any) => it === A.dropped) ?? null;
  return { W, g, A, step, gun, armed: inHand(A) === 'weapon' };
}
/** the frame (from the grab's) on which he is `held`, and the move's own events, over three seconds */
function run(C: Awaited<ReturnType<typeof world>>) {
  const { g, A } = C; startGrab(g, A);
  const R = { first: inHand(A) === 'weapon' && !A.dropped, heldF: -1, takeT: -1, carriedT: -1, letT: -1, restT: -1, overT: -1, poseBoth: 0, poseOne: 0, poseAfter: 0, knifeEarly: 0, rest: [0, 0, 0] as number[] };
  for (let f = 1; f <= 180; f++) {
    C.step(); const t = f * DT, H = g.player.holding, it = C.gun(), an = g.player.char.anim, hn = A.char.anim;
    if (R.heldF < 0 && H?.phase === 'held') R.heldF = f;
    if (R.takeT < 0 && inHand(A) !== 'weapon') R.takeT = t;
    if (R.carriedT < 0 && it?.carried) R.carriedT = t;
    if (R.carriedT >= 0 && R.letT < 0 && it && !it.carried) R.letT = t;
    if (R.letT >= 0 && R.restT < 0 && it?.settled) { R.restT = t; R.rest = [...it.pos]; }
    if (R.overT < 0 && R.takeT >= 0 && H && !H.strip) R.overT = t;
    const a = !!an.holdPose?.strip, b = !!hn.heldPose?.strip;
    if (H?.strip) { if (a && b) R.poseBoth++; else R.poseOne++; } else if (a || b) R.poseAfter++;
    if (H?.strip && H.strip.t < HOLD.strip.knife) { const out: any[] = []; handProps(g, out); if (out.some(x => x.owner === (g.player.char.id & 0xff) && x.name === KNIFE_TAG)) R.knifeEarly++; }
  }
  return R;
}

async function beats() {
  console.log('\n=== beats: the gun is taken, carried, let down ===');
  const C = await world(up()), R = run(C), K = HOLD.strip, p = C.g.player.char.pos, d = Math.hypot(R.rest[0] - p[0], R.rest[2] - p[2]);
  const D = await world(false), R0 = run(D);
  const ok = C.armed && R.first && Math.abs(R.takeT - K.take) < 0.05 && R.carriedT >= 0 && R.carriedT - R.takeT < 0.04 && Math.abs(R.letT - K.drop) < 0.05 && R.restT > 0 && R.restT < K.drop + 1.5 && d < 1.5 && R.rest[1] < 0.3 && Math.abs(R.overT - K.home) < 0.06 && R.heldF > 0 && R.heldF === R0.heldF;
  verdict(ok, 'a man with a gun in his hand, taken from behind: his on the first frame, out of his hand and in Sam\'s at the take, let go at the drop, still on the floor inside a metre and a half of them, the move over at its end, and he is held on the frame he always was',
    `armed ${C.armed} · his on the grab's frame ${R.first} · out of his hand at ${R.takeT.toFixed(2)} s (asks ${K.take}) · carried from ${R.carriedT.toFixed(2)} s · let go at ${R.letT.toFixed(2)} s (asks ${K.drop}) · at rest at ${R.restT.toFixed(2)} s, ${d.toFixed(2)} m from Sam, ${R.rest[1].toFixed(2)} m up · over at ${R.overT.toFixed(2)} s (asks ${K.home}) · held on frame ${R.heldF} (switch off: ${R0.heldF})`);
}
async function pose() {
  console.log('\n=== pose: both figures are told, and no knife before its beat ===');
  const C = await world(up()), R = run(C);
  verdict(R.poseBoth > 30 && R.poseOne === 0 && R.poseAfter <= 1 && R.knifeEarly === 0, 'while the move runs both poses carry it, neither does a frame after it is over, and no box of Sam\'s is the knife before HOLD.strip.knife',
    `frames both told ${R.poseBoth} · only one ${R.poseOne} · told after it ${R.poseAfter} · frames a knife was drawn early ${R.knifeEarly}`);
}
async function ends() {
  console.log('\n=== ends: let go with the gun in his hand ===');
  const C = await world(up()), { g, A } = C; startGrab(g, A); let had = false;
  for (let f = 0; f < 60 && !had; f++) { C.step(); had = !!C.gun()?.carried; }
  freeHeld(g, 'cancel'); C.step(2); const still = g.items.items.some((it: any) => it.carried); let rest = false; for (let f = 0; f < 150 && !rest; f++) { C.step(); rest = !!C.gun()?.settled || (!C.gun() && inHand(A) === 'weapon'); }
  verdict(had && !still && rest, 'the hold let go while the gun is in Sam\'s hand: nothing is carried two frames later and the gun comes to rest (or is back in his hand)', `it was in Sam's hand ${had} · still carried after ${still} · came to rest ${rest}`);
}
async function off() {
  console.log('\n=== off: the switch down ===');
  const C = await world(false), { g, A } = C; startGrab(g, A); const at0 = inHand(A) !== 'weapon' && !!A.dropped && !A.dropped.carried; C.step(30); const told = !!g.player.char.anim.holdPose?.strip || !!g.player.holding?.strip;
  verdict(C.armed && at0 && !told, 'with the switch down the gun is an item on its way to the floor from the grab\'s first frame and no pose is told of a move', `armed ${C.armed} · out of his hand on the grab's frame ${at0} · a move told ${told}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_DISARM, want = word !== undefined ? word === '1' : shipped;
  HOLD.disarm = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = HOLD.disarm, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.HOLD?.disarm === 'boolean';
  HOLD.disarm = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); HOLD.disarm = false; JR.applyKnobs(W.game, snapUp); const kept = HOLD.disarm;
  delete snap.tables.HOLD.disarm; HOLD.disarm = true; JR.applyKnobs(W.game, snap); const old = HOLD.disarm;
  const read = (q: string) => { HOLD.disarm = !HOLD.disarm; PR.pageSwitches(new URLSearchParams(q)); return HOLD.disarm; }, plainQ = read(''), offQ = read('disarm=0');
  verdict((STAND_ENV as string[]).includes('TPS_DISARM') && PR.FROZEN_HOLDS['HOLD.disarm'] === 'TPS_DISARM=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?disarm=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_DISARM')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['HOLD.disarm']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?disarm=0 ${offQ}`);
}

/** the whole card (probes.ts 'disarm'): true = every check passed. The switches are put back as they were found. */
export async function disarmCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = HOLD.disarm;
  try { await beats(); await pose(); await ends(); await off(); Object.assign(HOLD, hold); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== disarm: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await disarmCheck()) ? 0 : 1);
