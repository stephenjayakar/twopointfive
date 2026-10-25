// 'samlook' — SAM WATCHES THE MAN WHO MATTERS, AND GIVES A MAN ROOM AS HE PASSES (SAMLOOK, src/game/samlook.ts; the poses: character.ts WATCH). The
// maintainer's words: "another thing CT did really well is having sam look at enemies! curious how that might fit with our control scheme" and "i'm also
// curious if we can make the experience of 'slithering' through guards also feel just as amazing as approaching them for a grab".
//   bun run tools/qa/samlook-check.ts        (also `probes.ts samlook`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   look      a man three metres off, forty degrees to one side of where he aims: inside a second his head is on the man (the cursor has not moved and
//             neither has his aim); with nobody near his head is on his aim's line.
//   noticed   of two men in front of him the nearer is his — until the further one has him in view with his notice risen: then that one is.
//   sticky    two men at one distance do not trade him back and forth: the man he has is kept against one a little nearer, and given up for one a good
//             deal nearer.
//   nobody    a man behind him, a man past the range, a man the fog hides, and any man while a gun is in the aim: his head is his aim's.
//   stalk     the man a held click is creeping up on is the man he watches.
//   slip      crouched, hands empty, a man a little over a metre off his side: his chest is further from the man and lower than with the key down, and the
//             hand on that side is out toward him — on either side; none of it on his feet, for a man who is onto him, or from three metres.
//   between   a man 1.2 m off each side: his chest goes to neither side and he is lower than beside one man alone.
//   off       both keys down: nobody is his, and the animator is handed nothing.
//   harness   the two keys are rows of the two stands' list with their words, off on the frozen stand and on in the page (`?samlook=0`, `?slip=0`), ride a
//             recording's tables, and a recording from before the table replays with both off.
// SAMLOOK_BREAK=1 = the keys left down where look, noticed, sticky, stalk, slip and between ask for them up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the turned head, the lean or the low arm LOOK.
import { standUp, ROOT } from './headless.ts';

const { SAMLOOK, samLookMan, samSlipMan } = await import(`${ROOT}/src/game/samlook.ts`);
const { STALK, stalkOn } = await import(`${ROOT}/src/game/stalk.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { WATCH } = await import(`${ROOT}/src/game/character.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.SAMLOOK_BREAK === '1', DT = 1 / 60, SAM = [8.5, 0, 17.0], R2D = 180 / Math.PI;   // (the lobby's open floor; he aims up it, +z)
let allPass = true, found = { on: false, slip: false };
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f1 = (n: number) => n.toFixed(1), f2 = (n: number) => n.toFixed(2), cm = (n: number) => (n * 100).toFixed(1);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Sam on the lobby's floor aiming up it with empty hands; men[i] = where a man stands off him [to +x, up the floor] — the rest of the shift parked */
async function world(look: boolean, slip: boolean, men: number[][], o: { crouch?: boolean } = {}) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game; SAMLOOK.on = look; SAMLOOK.slip = slip; STALK.on = false; CLOSE.on = true;
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  const M: any[] = [];
  for (const [i, gd] of g.guards.entries()) { gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.awareness = 0; gd.char.vel = [0, 0, 0];
    if (i < men.length) { gd.char.pos = [SAM[0] + men[i][0], 0, SAM[2] + men[i][1]]; gd.char.bodyYaw = gd.char.aimYaw = 0; M.push(gd); } else gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; }
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...SAM]); g.player.crouch = o.crouch ?? true; const c = g.player.char; c.bodyYaw = c.aimYaw = 0;
  const C = { W, g, pl: g.player, c, M,
    step: (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([c.pos[0], 1, c.pos[2] + 6]); W.step(DT); g.player.visibility = 0.02; } },
    /** where his head looks, ° off +z (his aim's line here) */
    gaze: () => { const d = quat.rotate(quat.mul(quat.yaw(c.bodyYaw), c.skel.globalRot[c.anim.nodes.head]), c.anim.gazeLocal); return Math.atan2(d[0], d[2]) * R2D; },
    bearing: (gd: any) => Math.atan2(gd.char.pos[0] - c.pos[0], gd.char.pos[2] - c.pos[2]) * R2D,
    clear: (gd: any) => !g.col.solidBlocked([c.pos[0], 1.2, c.pos[2]], [gd.char.pos[0], 1.4, gd.char.pos[2]]),
    who: () => { const m = samLookMan(g); return m ? M.indexOf(m) : -1; } };
  C.step(40); return C;
}

async function lookAndNoticed() {
  console.log('\n=== look: his head goes to a man off to one side of his aim ===');
  const A = await world(up(), false, [[1.95, 2.3]]), b = A.bearing(A.M[0]), at0 = A.gaze(), aim0 = A.c.aimYaw; A.step(60); const at = A.gaze(), aim = A.c.aimYaw * R2D;
  const N = await world(up(), false, []); N.step(60); const none = N.gaze();
  verdict(A.clear(A.M[0]) && A.who() === 0 && Math.abs(wrap((at - b) / R2D)) * R2D < 12 && Math.abs(b) > 30 && Math.abs(aim) < 3 && Math.abs((A.c.aimYaw - aim0) * R2D) < 1 && Math.abs(none) < 10 && N.who() === -1,
    'a man three metres off and forty degrees to one side: inside a second and a half his head is on him, his aim has not moved, and with nobody near his head is on his aim\'s line',
    `the man is ${f1(b)}° off his aim, in the clear ${A.clear(A.M[0])} · his head ${f1(at0)}° after two thirds of a second, ${f1(at)}° a second on · his aim ${f1(aim)}° · nobody near: his head ${f1(none)}°, watching ${N.who() < 0 ? 'nobody' : 'someone'}`);

  console.log('\n=== noticed: the man who has begun to see him before a nearer one who has not ===');
  const T = await world(up(), false, [[-1.2, 2.2], [2.0, 4.0]]), calm = T.who(), d0 = Math.hypot(1.2, 2.2), d1 = Math.hypot(2.0, 4.0);
  const hot = T.M[1]; for (let i = 0; i < 40; i++) { hot.awareness = 0.3; hot.sightT = T.g.time; T.step(1); } const seen = T.who(), at1 = T.gaze(), b1 = T.bearing(hot);
  for (let i = 0; i < 60; i++) { hot.awareness = 0; T.step(1); } const back = T.who();
  verdict(T.clear(T.M[0]) && T.clear(T.M[1]) && calm === 0 && seen === 1 && back === 0 && Math.abs(at1 - b1) < 14,
    'of two men in front of him the nearer is the one he watches; when the further has him in view with his notice risen he watches that one, his head on him; when that man has lost him he watches the nearer again',
    `the men are ${f2(d0)} m and ${f2(d1)} m off · both calm: he watches the ${calm === 0 ? 'nearer' : calm === 1 ? 'further' : 'neither'} · the further noticing: the ${seen === 0 ? 'nearer' : seen === 1 ? 'further' : 'neither'}, his head ${f1(at1)}° (that man is at ${f1(b1)}°) · calm again: the ${back === 0 ? 'nearer' : back === 1 ? 'further' : 'neither'}`);
}
async function stickyAndNobody() {
  console.log('\n=== sticky: two men at one distance do not trade him back and forth ===');
  const S = await world(up(), false, [[-1.5, 3.0], [1.5, 3.0]]), first = S.who(), other = 1 - first, o = S.M[other];
  if (first >= 0) { o.char.pos[2] -= 0.4; } S.step(30); const little = S.who();
  if (first >= 0) { o.char.pos[2] -= 0.9; } S.step(30); const lot = S.who();
  verdict(first >= 0 && little === first && lot === other && SAMLOOK.swapM > 0.4 && SAMLOOK.swapM < 1.2,
    'with two men at the same distance he watches one; the other coming 0.4 m nearer does not take him, and coming a further 0.9 m nearer does',
    `he watches man ${first} · the other 0.4 m nearer: man ${little} · 1.3 m nearer: man ${lot} (the man he has counts as ${f2(SAMLOOK.swapM)} m nearer)`);

  console.log('\n=== nobody: behind him, too far, in the fog, or with a gun in the aim ===');
  const B = await world(up(), false, [[0.6, -2.4]]); B.step(30); const behind = B.who(), bg = B.gaze();
  const F = await world(up(), false, [[0.5, 5.2]]); const nearW = F.who(), reach = SAMLOOK.nearM; SAMLOOK.nearM = 4; F.step(20); const far = F.who(); SAMLOOK.nearM = reach;   // (the floor is not as long as the range: the range brought in under him instead)
  const G = await world(up(), false, [[1.2, 2.6]]); const before = G.who(); const hid = G.g.fogOfWar.hidden.bind(G.g.fogOfWar); G.g.fogOfWar.hidden = (x: any) => x === G.M[0] || hid(x); G.step(10); const fog = G.who(); G.g.fogOfWar.hidden = hid;
  G.pl.holstered = false; G.pl.pistol.lightOn = true; for (let i = 0; i < 60; i++) { G.W.cursorAt([G.c.pos[0], 1, G.c.pos[2] + 6]); G.W.step(DT); } const upper = G.c.anim.upper, gun = G.who(), gg = G.gaze();
  verdict(behind === -1 && Math.abs(bg) < 10 && (BREAK || (nearW === 0 && before === 0)) && far === -1 && fog === -1 && upper === 'aim' && gun === -1 && Math.abs(gg) < 20,
    'a man two and a half metres behind him is not watched and his head stays on his aim; a man past the range is not watched; a man the fog hides is not watched; with the pistol up and its light on (the aim) nobody is watched and his head is the gun\'s',
    `behind: ${behind < 0 ? 'nobody' : 'watched'}, his head ${f1(bg)}° · inside the range ${nearW === 0 ? 'watched' : 'nobody'}, past it ${far < 0 ? 'nobody' : 'watched'} · in the open ${before === 0 ? 'watched' : 'nobody'}, hidden by the fog ${fog < 0 ? 'nobody' : 'watched'} · the gun up (${upper}): ${gun < 0 ? 'nobody' : 'watched'}, his head ${f1(gg)}°`);
}
async function stalkAndSlip() {
  console.log('\n=== stalk: the man a held click creeps up on is the man he watches ===');
  const K = await world(up(), false, [[1.5, 1.5], [0, 2.8]]); STALK.on = true; STALK.only = true; const near = K.who(), far = K.M[1];
  for (let i = 0; i < 40; i++) { K.W.cursorAt([far.char.pos[0], 1.2, far.char.pos[2]]); if (i === 0) K.W.input.clicked |= 1; K.W.input.buttons |= 1; K.W.step(DT); K.g.player.visibility = 0.02; }
  const on = stalkOn(K.g), w = samLookMan(K.g); K.W.input.buttons &= ~1; STALK.on = false;
  verdict(near === 0 && on === far && w === far, 'with a nearer man off to one side, a held click on the back of the further one begins the creep, and the man crept up on is the man he watches',
    `before the click he watches the ${near === 0 ? 'nearer' : 'other'} · the creep is on ${on === far ? 'the further man' : on ? 'another' : 'nobody'} · he watches ${w === far ? 'the further man' : w ? 'another' : 'nobody'}`);

  console.log('\n=== slip: beside a man he tips away, sinks, and the near arm goes out low ===');
  const rows: string[] = []; let ok = true;
  for (const side of [1, -1]) {   // (+1: the man is on +x — his left as he aims up the floor)
    const P = await world(false, false, [[side * 1.2, 0.15]]); P.M[0].char.bodyYaw = P.M[0].char.aimYaw = -side * Math.PI / 2; P.step(40); const p = { chest: [...P.c.bones.chest], hand: [...P.c.bones[side > 0 ? 'handL' : 'handR']] };
    const Q = await world(false, up(), [[side * 1.2, 0.15]]); Q.M[0].char.bodyYaw = Q.M[0].char.aimYaw = -side * Math.PI / 2; Q.step(40); const q = { chest: [...Q.c.bones.chest], hand: [...Q.c.bones[side > 0 ? 'handL' : 'handR']] }, sl = samSlipMan(Q.g);
    const away = -(q.chest[0] - p.chest[0]) * side, down = p.chest[1] - q.chest[1], out = (q.hand[0] - q.chest[0]) * side, out0 = (p.hand[0] - p.chest[0]) * side, low = q.chest[1] - q.hand[1], shown = Q.c.anim.watchShown.slip;
    ok &&= away > 0.02 && down > 0.015 && out > 0.22 && out > out0 - 0.02 && low > 0.12 && shown > 0.9 && !!sl && sl.gd === Q.M[0];
    rows.push(`the man on his ${side > 0 ? 'left' : 'right'}: his chest ${cm(away)} cm further from him and ${cm(down)} cm lower, that hand ${cm(out)} cm out from his chest on the man's side (${cm(out0)} with the key down) and ${cm(low)} cm under it (the pose's share ${f2(shown)})`);
  }
  const St = await world(false, up(), [[1.2, 0.15]], { crouch: false }); St.step(30); const stand = St.c.anim.watchShown.slip;
  const Al = await world(false, up(), [[1.2, 0.15]]); Al.M[0].state = 'alert'; Al.step(120); const alert = Al.c.anim.watchShown.slip;
  const Fr = await world(false, up(), [[3.0, 0.15]]); Fr.step(30); const farS = Fr.c.anim.watchShown.slip;
  const Bk = await world(false, up(), [[0.3, 1.3]]); Bk.step(40); const backS = Bk.c.anim.watchShown.slip;   // (the man faces up the floor: Sam is behind his back)
  verdict(ok && stand === 0 && alert < 0.02 && farS === 0 && backS === 0 && WATCH.lean > 0,
    'crouched with empty hands and a man 1.2 m off his side, against the same moment with the key down: his chest is further from the man and lower, and the hand on that side is out from his chest toward the man and under it, on either side; on his feet, beside a man who is onto him, from three metres, and behind a man\'s back there is none of it',
    `${rows.join(' · ')} · on his feet ${f2(stand)} · the man onto him ${f2(alert)} · from 3 m ${f2(farS)} · behind a man's back ${f2(backS)}`);

  console.log('\n=== between: dead between two men he tips into neither, and gets smaller ===');
  { const two: [number, number][] = [[1.2, 0], [-1.2, 0]], face = (X: any) => { X.M.forEach((m: any, i: number) => { m.char.bodyYaw = m.char.aimYaw = (i === 0 ? -1 : 1) * Math.PI / 2; }); };
    const P = await world(false, false, two); face(P); P.step(60); const Q = await world(false, up(), two); face(Q); Q.step(60);
    const O = await world(false, up(), [[1.2, 0]]); face(O); O.step(60); const O0 = await world(false, false, [[1.2, 0]]); face(O0); O0.step(60);
    const side = Math.abs(Q.c.bones.chest[0] - P.c.bones.chest[0]), down = P.c.bones.chest[1] - Q.c.bones.chest[1], down1 = O0.c.bones.chest[1] - O.c.bones.chest[1], sh = Q.c.anim.watchShown;
    verdict(sh.slip > 0.9 && sh.lean < 0.1 && side < 0.01 && down > down1 + 0.008 && down1 > 0.015 && WATCH.squeeze > 0,
      'with a man 1.2 m off each side, against the same moment with the key down: his chest has gone to neither side, and it is lower than beside one man alone',
      `the pose's share ${f2(sh.slip)} with ${f2(sh.lean)} of the lean left · his chest ${cm(side)} cm to a side and ${cm(down)} cm lower (beside one man ${cm(down1)} cm lower)`); }
}
async function off() {
  console.log('\n=== off: both keys down, nobody is his ===');
  const O = await world(false, false, [[1.95, 2.3], [-1.2, 0.15]]); O.step(60); const an = O.c.anim;
  verdict(O.who() === -1 && samSlipMan(O.g) === null && an.watchAt === null && an.slipAt === null && an.watchShown.w === 0 && an.watchShown.slip === 0,
    'with both keys down a man off to one side and a man beside him change nothing: nobody is watched, nobody is given room, and the animator is handed nothing',
    `watching ${O.who() < 0 ? 'nobody' : 'someone'} · room for ${samSlipMan(O.g) ? 'someone' : 'nobody'} · the animator's look ${f2(an.watchShown.w)}, slip ${f2(an.watchShown.slip)}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', wl = process.env.TPS_SAMLOOK, ws = process.env.TPS_SAMSLIP, wantL = wl !== undefined ? wl === '1' : shipped, wantS = ws !== undefined ? ws === '1' : shipped;
  SAMLOOK.on = shipped ? found.on : !wantL; SAMLOOK.slip = shipped ? found.slip : !wantS;   // (the frozen stand's pins write the keys at every stand-up; the page's stand has them from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = { on: SAMLOOK.on, slip: SAMLOOK.slip }, foundOk = !shipped || ((wl !== undefined || found.on === wantL) && (ws !== undefined || found.slip === wantS));
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.SAMLOOK?.on === 'boolean' && typeof snap.tables.SAMLOOK?.slip === 'boolean';
  SAMLOOK.on = SAMLOOK.slip = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); SAMLOOK.on = SAMLOOK.slip = false; JR.applyKnobs(W.game, snapUp); const kept = SAMLOOK.on && SAMLOOK.slip;
  delete snap.tables.SAMLOOK; SAMLOOK.on = SAMLOOK.slip = true; JR.applyKnobs(W.game, snap); const old = SAMLOOK.on || SAMLOOK.slip;
  const read = (q: string) => { SAMLOOK.on = !SAMLOOK.on; SAMLOOK.slip = !SAMLOOK.slip; PR.pageSwitches(new URLSearchParams(q)); return `${SAMLOOK.on ? 1 : 0}${SAMLOOK.slip ? 1 : 0}`; }, plainQ = read(''), offL = read('samlook=0'), offS = read('slip=0');
  const E = STAND_ENV as string[];
  verdict(E.includes('TPS_SAMLOOK') && E.includes('TPS_SAMSLIP') && PR.FROZEN_HOLDS['SAMLOOK.on'] === 'TPS_SAMLOOK=1' && PR.FROZEN_HOLDS['SAMLOOK.slip'] === 'TPS_SAMSLIP=1' && stood.on === wantL && stood.slip === wantS && foundOk && had && kept === true && old === false && plainQ === '11' && offL === '01' && offS === '10',
    'the two keys are rows of the two stands\' list with their words, stand up on the shipped stand and down on the frozen one, ride a recording\'s tables, a recording from before the table replays with both down, and the page\'s boot writes both on for a plain address, ?samlook=0 puts the look off and ?slip=0 the slip',
    `STAND_ENV ${E.includes('TPS_SAMLOOK')} ${E.includes('TPS_SAMSLIP')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['SAMLOOK.on']} ${PR.FROZEN_HOLDS['SAMLOOK.slip']} · found ${found.on} ${found.slip}, stood up ${stood.on} ${stood.slip}, wanted ${wantL} ${wantS} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?samlook=0 ${offL} · ?slip=0 ${offS}`);
}

/** the whole card (probes.ts 'samlook'): true = every check passed. The switches are put back as they were found. */
export async function samlookCheck(): Promise<boolean> {
  const was = { ...SAMLOOK }, stalk = { ...STALK }, close = JSON.parse(JSON.stringify(CLOSE)); allPass = true; found = { on: SAMLOOK.on, slip: SAMLOOK.slip };
  try { await lookAndNoticed(); await stickyAndNobody(); await stalkAndSlip(); await off(); Object.assign(SAMLOOK, was); await harness(); }
  finally { Object.assign(SAMLOOK, was); Object.assign(STALK, stalk); Object.assign(CLOSE, close); }
  console.log(`\n=== samlook: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await samlookCheck()) ? 0 : 1);
