// 'stripfirst' — THE DISARM LEADS (HOLD.stripFirst, src/game/disarm.ts `lead`). The maintainer, of the grab: "sam springs into action for the final grab ...
// you really want a disarm and then a grab, right?"
//   bun run tools/qa/stripfirst-check.ts        (also `probes.ts stripfirst`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   lead      a man with a gun in his hands, taken from behind: it is out of his hand at HOLD.first.take and let go at HOLD.first.drop, where with the key
//             down they fall at HOLD.strip.take and HOLD.strip.drop; the move is over that much sooner; he is `held` on the same frame either way.
//   voices    with the key up the strip is heard before the catch, and the catch no sooner than HOLD.first.catch; with it down the catch is the grab's frame.
//   arm       the grab as the page has it (the click brings him in, the key takes the man): the gun has left the man's hand at least five frames before
//             Sam's left hand is at his neck.
//   torn      the hold ended five frames in: the catch is heard then (a grab is never silent), no strip, nothing left in his hand.
//   others    a man with a torch in his hand has the catch on the grab's frame (nothing to take, nothing led); the pistol hold's rap comes at
//             HOLD.strip.take as it did.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?stripfirst=0`), rides a recording's
//             tables, and a recording from before the key replays with it off.
// STRIPFIRST_BREAK=1 = the key left down where lead, voices, arm and torn ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the move LOOKS (tools/qa/close-stills.ts scene disarm-rifle draws it on the CPU) or sounds.
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { inHand } = await import(`${ROOT}/src/game/guards.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.STRIPFIRST_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (x: number) => x.toFixed(2);
/** the lobby's floor, a man facing east with Sam `gap` m behind him: `rifle` = the rifleman with his gun in his hands (else a man with his torch), the rest parked */
async function world(first: boolean, o: { rifle?: boolean; gap?: number; stalk?: boolean; drawn?: boolean } = {}) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; HOLD.stripFirst = first; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = !!o.stalk; STALK.key = STALK.low = !!o.stalk; stalkPolish(!!o.stalk);   // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = !o.drawn;
  if (o.rifle ?? true) g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);   // (a calm man with a pistol rig carries his torch: the rifleman has his gun in his hands)
  const A = (o.rifle ?? true) ? g.guards.find((x: any) => x.callsign === 'Reyes') : g.guards.find((x: any) => inHand(x) === 'torch'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - (o.gap ?? 0.8), 0, AT[2]]); if (o.stalk) g.player.crouch = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { A.char.vel = [0, 0, 0]; W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(40); W.audioLog = [];
  return { W, g, A, step, armed: inHand(A) === 'weapon' };
}
/** the move's events over two seconds from the grab's frame (t0 = the game's clock then) */
function run(C: Awaited<ReturnType<typeof world>>) {
  const { g, A, W } = C, t0 = g.time, R = { heldF: -1, takeT: -1, letT: -1, overT: -1, neckF: -1, takeF: -1, strip: -1, catch: -1 };
  for (let f = 1; f <= 120; f++) {
    C.step(); const t = f * DT, H = g.player.holding, it = A.dropped, c = g.player.char.bones, n = A.char.bones.neck ?? A.char.bones.head;
    if (R.heldF < 0 && H?.phase === 'held') R.heldF = f;
    if (R.takeT < 0 && inHand(A) !== 'weapon') { R.takeT = t; R.takeF = f; }
    if (R.takeT >= 0 && R.letT < 0 && it && !it.carried) R.letT = t;
    if (R.overT < 0 && R.takeT >= 0 && H && !H.strip) R.overT = t;
    if (R.neckF < 0 && H && Math.hypot(c.handL[0] - n[0], c.handL[1] - n[1], c.handL[2] - n[2]) < 0.12) R.neckF = f;
  }
  const at = (name: string) => { const e = (W.audioLog as any[]).find(x => x.name === name); return e ? e.t - t0 : -1; };
  R.strip = at('gunStrip'); R.catch = at('grabCatch');
  return R;
}

async function lead() {
  console.log('\n=== lead: the gun is out of his hands sooner, and the hold is what it was ===');
  const C = await world(up()), _ = startGrab(C.g, C.A), R = run(C), D = await world(false), __ = startGrab(D.g, D.A), R0 = run(D), F = HOLD.first, K = HOLD.strip;
  const ok = C.armed && Math.abs(R.takeT - F.take) < 0.035 && Math.abs(R.letT - F.drop) < 0.04 && Math.abs(R0.takeT - K.take) < 0.035 && Math.abs(R0.letT - K.drop) < 0.04
    && R.takeT < R0.takeT - 0.02 && R0.overT - R.overT > (K.drop - F.drop) - 0.05 && R.heldF > 0 && R.heldF === R0.heldF;
  verdict(ok, 'a man with a gun in his hands, taken from behind: it is out of his hand and let go at the lead\'s two moments where the key down has them at the strip\'s own, the move is over that much sooner, and he is held on the same frame',
    `armed ${C.armed} · out of his hand at ${f2(R.takeT)} s (asks ${F.take}; key down ${f2(R0.takeT)}, asks ${K.take}) · let go at ${f2(R.letT)} s (asks ${F.drop}; key down ${f2(R0.letT)}, asks ${K.drop}) · over at ${f2(R.overT)} s (key down ${f2(R0.overT)}) · held on frame ${R.heldF} (key down ${R0.heldF})`);
  console.log('\n=== voices: the strip is heard, then the catch ===');
  verdict(R.strip >= 0 && R.catch > R.strip + 0.03 && R.catch >= F.catch - 0.02 && R.catch < F.catch + 0.06 && R0.catch >= 0 && R0.catch < 0.03 && R0.strip > R0.catch,
    'with the key up the strip\'s voice comes first and the catch\'s as the arm lands; with it down the catch is on the grab\'s frame and the strip after it',
    `key up: the strip at ${f2(R.strip)} s, the catch at ${f2(R.catch)} s (asks ${F.catch}) · key down: the catch at ${f2(R0.catch)} s, the strip at ${f2(R0.strip)} s`);
}
async function arm() {
  console.log('\n=== arm: the gun has left his hands before the arm is round his neck ===');
  const go = async (first: boolean) => { const C = await world(first, { gap: 2.6, stalk: true }), { W, g, A } = C, c = g.player.char; W.input.buttons |= 1; W.input.clicked |= 1;
    for (let n = 0; n < 900; n++) { C.step(); if (n > 60 && Math.hypot(c.vel[0], c.vel[2]) < 0.02 && Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]) < 0.95) break; }
    C.step(30); const sel = g.selectVerb('guard', 'grab'); W.input.pressed.add('Space'); W.audioLog = []; const R = run(C); return { R, sel, held: !!g.player.holding }; };
  const a = await go(up()), b = await go(false), gap = a.R.neckF - a.R.takeF, gap0 = b.R.neckF - b.R.takeF;
  verdict(a.held && a.R.takeF > 0 && a.R.neckF > 0 && gap >= 5 && gap > gap0 + 1 && Math.abs(a.R.catch - a.R.neckF * DT) < 0.07, 'the click brings him in behind the rifleman and the key takes him: the gun is out of the man\'s hand at least five frames before Sam\'s left hand is at his neck, more of them than with the key down, and the catch is heard within four frames of the hand landing',
    `in his arm ${a.held} · the gun leaves him on frame ${a.R.takeF}, the hand is at his neck on frame ${a.R.neckF}: ${gap} frames between (key down: ${b.R.takeF} and ${b.R.neckF}, ${gap0}) · the catch at ${f2(a.R.catch)} s, the hand there at ${f2(a.R.neckF * DT)} s`);
}
async function torn() {
  console.log('\n=== torn: the hold ended before the arm landed ===');
  const go = async (first: boolean) => { const C = await world(first), { g, W } = C; startGrab(g, C.A); const t0 = g.time; C.step(5); g.freeHeld('cancel'); C.step(20);
    const at = (name: string) => { const e = (W.audioLog as any[]).find(x => x.name === name); return e ? e.t - t0 : -1; };
    return { catch: at('grabCatch'), strip: at('gunStrip'), carried: g.items.items.some((it: any) => it.carried), hold: !!g.player.holding, due: g.player.catchDue }; };
  const a = await go(up()), b = await go(false);
  verdict(!a.hold && a.catch >= 0.05 && a.catch < 0.15 && a.strip < 0 && !a.carried && a.due === undefined && b.catch >= 0 && b.catch < 0.03,
    'torn loose five frames in, before the take: the catch is heard as the hold ends (never a silent grab), no strip, nothing left in his hand and nothing still owed; with the key down the catch was on the grab\'s frame',
    `the catch at ${f2(a.catch)} s (key down ${f2(b.catch)}) · a strip ${a.strip >= 0} · a gun still carried ${a.carried} · still owed ${a.due !== undefined}`);
}
async function others() {
  console.log('\n=== others: nothing to take, and the pistol hold\'s rap ===');
  const T = await world(true, { rifle: false }); startGrab(T.g, T.A); const Rt = run(T);
  const P = await world(true, { drawn: true }); startGrab(P.g, P.A); const gunV = P.g.player.holding?.variant === 'gun', Rp = run(P);
  verdict(!T.armed && Rt.catch >= 0 && Rt.catch < 0.03 && Rt.strip < 0 && gunV && Math.abs(Rp.takeT - HOLD.strip.take) < 0.035 && Rp.catch >= 0 && Rp.catch < 0.03,
    'a man with his torch in his hand: the catch is heard on the grab\'s frame and no strip; the pistol hold: the gun is rapped out at the strip\'s own moment with the catch on the grab\'s frame',
    `the torch man: armed ${T.armed}, the catch at ${f2(Rt.catch)} s, a strip ${Rt.strip >= 0} · the pistol hold ${gunV}: out of his hand at ${f2(Rp.takeT)} s (asks ${HOLD.strip.take}), the catch at ${f2(Rp.catch)} s`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_STRIPFIRST, want = word !== undefined ? word === '1' : shipped;
  HOLD.stripFirst = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = HOLD.stripFirst, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.HOLD?.stripFirst === 'boolean';
  HOLD.stripFirst = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); HOLD.stripFirst = false; JR.applyKnobs(W.game, snapUp); const kept = HOLD.stripFirst;
  delete snap.tables.HOLD.stripFirst; HOLD.stripFirst = true; JR.applyKnobs(W.game, snap); const old = HOLD.stripFirst;
  const read = (q: string) => { HOLD.stripFirst = !HOLD.stripFirst; PR.pageSwitches(new URLSearchParams(q)); return HOLD.stripFirst; }, plainQ = read(''), offQ = read('stripfirst=0');
  verdict((STAND_ENV as string[]).includes('TPS_STRIPFIRST') && String(PR.FROZEN_HOLDS['HOLD.stripFirst']).startsWith('TPS_STRIPFIRST=1') && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?stripfirst=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_STRIPFIRST')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['HOLD.stripFirst']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?stripfirst=0 ${offQ}`);
}

/** the whole card (probes.ts 'stripfirst'): true = every check passed. The switches are put back as they were found. */
export async function stripfirstCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = HOLD.stripFirst;
  try { await lead(); await arm(); await torn(); await others(); Object.assign(HOLD, hold); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== stripfirst: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stripfirstCheck()) ? 0 : 1);
