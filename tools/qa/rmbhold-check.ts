// 'rmbhold' — THE RIGHT BUTTON, TAPPED OR HELD (CLOSE.rmbHold, src/game/close.ts). The maintainer's design: "make it possible to just right click to knock him
// out quickly but it's a bit louder, or holding right click does a choke. we already have this when you can pistol whip him if the gun is out".
//   bun run tools/qa/rmbhold-check.ts        (also `probes.ts rmbhold`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   tap       empty hands behind a man who stands, the right button down for four frames and let go: the blow starts as it is let go, he is out cold inside
//             a second, nobody was ever in the arm, and the room hears it `rmbLoud` further up the scale than the knockout was.
//   hold      the button kept down: no blow; at `rmbTapSecs` he is in the arm, the arm closes the frame the hold has him (no key, no commit beat), and he
//             goes down choked with the button never let go — and nothing the room hears of it is as loud as the tap's knockout.
//   early     the button let go while the grab is still landing: he is held, the arm never closes, and nothing louder than the grab is heard.
//   release   the button let go half a second into the choke: he breathes, he is held, and three seconds on he is still on his feet in the arm.
//   stopped   the choke stopped by something else (a step, a tap of the key) with the button still down: it is a hold, and the button does not start it again.
//   again     in the arm the button is the same: pressed again and kept down it chokes, let go he breathes; a one-frame click there is the whole choke.
//   late      a press made just out of reach and kept down takes him when Sam is in reach; one that waited too long does nothing. A button the page took
//             away (a blur) is no tap.
//   front     from his front no grab is offered and there is nothing to choose: the press itself is the knockout, on its frame, as loud as it was.
//   words     behind him the man's row says the hold's choke beside the knockout; from his front, and with the key down, it does not.
//   page      with the stalk as the page has it the held button's grab is the stalk's own (its step in, counted once); the click-only row and the row with
//             the knife back both say the choke, and with the knife back the tap and the hold do what they do without it.
//   off       the key down: the press itself is the knockout (begun on the press's own frame, as loud as it was), and the button kept down takes nobody.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?rmbhold=0` puts it off), rides a
//             recording's tables, and a recording from before the key replays with it off.
// RMBHOLD_BREAK=1 = the key left down where tap, hold, early, release, stopped, again, late, words and page ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU AND NO EARS: nothing here says how the choke out of a held button LOOKS, or how the louder blow SOUNDS.
import { standUp, ROOT } from './headless.ts';

const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, STALK_STATS } = await import(`${ROOT}/src/game/stalk.ts`);
const { easeOffHold } = await import(`${ROOT}/src/game/player.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.RMBHOLD_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (n: number) => n.toFixed(2);
/** one man stood on the lobby's floor facing east, the rest parked, Sam with empty hands `gap` m from him `bearing` degrees off his facing (180 = behind) */
async function world(on: boolean, bearing = 180, gap = 0.8, o: { stalk?: boolean; key?: boolean; knife?: boolean } = {}) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  CLOSE.on = true; CLOSE.lethal = true; CLOSE.heldClicks = true; CLOSE.side = CLOSE.front = true; CLOSE.noKnife = !o.knife; CLOSE.rmbHold = on; STALK.on = !!o.stalk; STALK.only = true; STALK.key = !!o.key; STALK.low = !!o.stalk;   // (the frozen stand's pins write them at every stand-up; the stalk held down unless a card asks for the page's own: most of these are of the right button alone)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  const [A, ...rest] = g.guards; for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  const a = EAST + bearing * Math.PI / 180; W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] + Math.sin(a) * gap, 0, AT[2] + Math.cos(a) * gap]);
  const C = { W, g, A, f: 0, loud: 0, blowAt: -1, armAt: -1, chokeAt: -1, downAt: -1,
    /** a frame: the loudest thing the room was given to hear so far, and the frame each beat was first seen on (counted from the press) */
    step: (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; C.f++;
      for (const e of g.events) if (e.kind === 'prop' && e.time === g.time) C.loud = Math.max(C.loud, e.level);
      if (C.blowAt < 0 && g.player.takedown) C.blowAt = C.f; if (C.armAt < 0 && g.player.holding) C.armAt = C.f; if (C.chokeAt < 0 && g.player.holding?.phase === 'choke') C.chokeAt = C.f; if (C.downAt < 0 && A.state === 'dead') C.downAt = C.f; } },
    press: () => { W.input.buttons |= 4; W.input.clicked |= 4; C.f = 0; C.loud = 0; }, lift: () => { W.input.buttons &= ~4; },
    said: () => g.nearby.map((r: any) => Object.values(r).filter(v => typeof v === 'string').join(' ')).join(' | '),
    filed: () => g.chronicle.events.slice(ev0).map((e: any) => `${e.kind}${e.data?.weapon ? ':' + e.data.weapon : ''}${e.data?.method ? ':' + e.data.method : ''}`) };
  const ev0 = g.chronicle.events.length;
  C.step(40);
  return C;
}
const secs = (f: number) => f < 0 ? 'never' : `${f2(f * DT)} s`;

async function tapAndHold() {
  console.log('\n=== tap: let go inside a tap, it is the knockout — quick, and heard further ===');
  const T = await world(up()); T.press(); T.step(4); T.lift(); T.step(90); const TF = T.filed(), was = CLOSE.noise.behind;
  verdict(T.blowAt >= 5 && T.blowAt <= 6 && T.armAt < 0 && T.downAt > 0 && T.downAt < 60 && TF.some((e: string) => e.startsWith('ko')) && !TF.some((e: string) => e.startsWith('kill')) && Math.abs(T.loud - (was + CLOSE.rmbLoud)) < 1e-6 && CLOSE.rmbLoud > 0,
    'behind a man who stands, the right button down for four frames and let go: the blow starts as it is let go, he is out cold inside a second with nobody ever in the arm, and the room hears it louder than the knockout was, by the table\'s own number',
    `the blow began ${secs(T.blowAt)} after the press · in the arm ${T.armAt >= 0} · down ${secs(T.downAt)} · filed ${TF.join(', ') || 'nothing'} · the loudest the room heard ${f2(T.loud)} (the knockout was ${f2(was)}, +${f2(CLOSE.rmbLoud)})`);

  console.log('\n=== hold: kept down, it is the choke — into the arm, and the arm closes at once ===');
  const H = await world(up()); H.press(); let let0 = false; for (let i = 0; i < 8 * 60 && H.downAt < 0; i++) { H.step(); let0 ||= !H.W.input.buttons; } const HF = H.filed(), tapF = Math.round(CLOSE.rmbTapSecs / DT);
  verdict(H.blowAt < 0 && H.armAt >= tapF && H.armAt <= tapF + 2 && H.chokeAt > H.armAt && H.chokeAt * DT < CLOSE.rmbTapSecs + 0.75 && H.downAt > H.chokeAt && !let0 && HF.some((e: string) => e.startsWith('ko')) && !HF.some((e: string) => e.startsWith('kill')) && H.loud < T.loud - 0.05,
    'the button kept down: no blow; he is in the arm as the tap\'s time runs out, the arm closes as soon as the hold has him with no key pressed, he goes down choked with the button never let go, and nothing the room hears of it is as loud as the tap\'s knockout',
    `a blow ${H.blowAt >= 0} · in the arm ${secs(H.armAt)} after the press (a tap is under ${f2(CLOSE.rmbTapSecs)} s) · the arm closing ${secs(H.chokeAt)} · down ${secs(H.downAt)} · filed ${HF.join(', ') || 'nothing'} · the loudest the room heard ${f2(H.loud)} (the tap: ${f2(T.loud)})`);
}
async function releaseAndStop() {
  console.log('\n=== early: let go while the grab is landing, he is held and the arm never closes ===');
  const E = await world(up()); E.press(); for (let i = 0; i < 120 && E.armAt < 0; i++) E.step(); E.step(4); const landing = E.g.player.holding?.phase; E.lift(); E.step(120);
  verdict(E.armAt >= 0 && landing === 'grab' && E.g.player.holding?.g === E.A && E.g.player.holding.phase === 'held' && E.chokeAt < 0 && E.A.state !== 'dead' && E.g.player.holding.rmbChoke === undefined && E.loud < 0.14,
    'the button kept down takes him into the arm and is let go four frames into the grab: two seconds on he is held, on his feet, the arm never closed on his throat, and nothing as loud as the choke was heard',
    `in the arm ${secs(E.armAt)} after the press · let go in the ${landing ?? 'no'} phase · now ${E.g.player.holding?.phase ?? 'not held'} · the arm closed ${E.chokeAt >= 0} · the loudest the room heard ${f2(E.loud)} (the grab is 0.12, the arm closing 0.15)`);
  console.log('\n=== release: let go mid-choke, he breathes and is held ===');
  const R = await world(up()); R.press(); for (let i = 0; i < 300 && R.chokeAt < 0; i++) R.step(); R.step(30); const choking = R.g.player.holding?.phase === 'choke'; R.lift(); R.step(20); const ph = R.g.player.holding?.phase; R.step(180);
  verdict(choking && ph === 'held' && R.g.player.holding?.g === R.A && R.g.player.holding.phase === 'held' && R.A.state !== 'dead' && R.g.player.holding.rmbChoke === undefined,
    'the button let go half a second into the choke: a third of a second on the arm is off his throat and he is held; three seconds later he is still on his feet in the arm',
    `choking as it was let go ${choking} · a third of a second on: ${ph ?? 'nobody held'} · three seconds on: ${R.g.player.holding ? R.g.player.holding.phase : 'nobody held'}, the man ${R.A.state}`);

  console.log('\n=== stopped: stopped by anything else, the button still down does not start it again ===');
  const S = await world(up()); S.press(); for (let i = 0; i < 300 && S.chokeAt < 0; i++) S.step(); S.step(30); const was = S.g.player.holding?.phase; easeOffHold(S.g); let again = false; for (let i = 0; i < 180; i++) { S.step(); again ||= S.g.player.holding?.phase === 'choke'; }
  verdict(was === 'choke' && !again && S.g.player.holding?.g === S.A && S.A.state !== 'dead' && !!(S.W.input.buttons & 4),
    'the choke eased off by something else (what a step or a tap of the key does) with the button still down: for three seconds it does not start again, and he is held',
    `choking before ${was === 'choke'} · started again ${again} · ${S.g.player.holding ? S.g.player.holding.phase : 'nobody held'}, the man ${S.A.state} · the button still down ${!!(S.W.input.buttons & 4)}`);
}
async function frontAndWords() {
  console.log('\n=== front: where no grab is offered there is nothing to choose, and the press is the knockout ===');
  const F = await world(up(), 0), front = F.said(); F.press(); F.step(120);
  verdict(F.armAt < 0 && F.blowAt === 1 && F.downAt > 0 && Math.abs(F.loud - CLOSE.noise.front) < 1e-6, 'from his front, the button pressed and kept down: the knockout begins on the press\'s own frame, as loud as it was from there, and nobody is taken into the arm',
    `in the arm ${F.armAt >= 0} · the blow began on frame ${F.blowAt} · down ${secs(F.downAt)} · the loudest the room heard ${f2(F.loud)} (the table's ${f2(CLOSE.noise.front)})`);
  console.log('\n=== words: the row says the hold\'s choke where there is one ===');
  const B = await world(up()), behind = B.said(), O = await world(false), off = O.said(), RE = /RMB {2}knock him out {2}· {2}RMB {2}hold to choke him/;
  verdict(RE.test(behind) && !/choke/.test(front) && /RMB {2}knock him out/.test(front) && !/choke him/.test(off) && /RMB {2}knock him out/.test(off),
    'behind him the man\'s row names the knockout and, beside it, the choke on the same button held; from his front it names the knockout alone, and so it does behind him with the key down',
    `behind: '${behind}' · front: '${front}' · the key down: '${off}'`);
}
async function againAndLate() {
  console.log('\n=== again: in the arm the button is the same ===');
  const R = await world(up()); R.press(); for (let i = 0; i < 300 && R.chokeAt < 0; i++) R.step(); R.step(20); R.lift(); R.step(40); const held0 = R.g.player.holding?.phase;
  R.W.input.buttons |= 4; R.W.input.clicked |= 4; R.step(40); const p1 = R.g.player.holding?.phase; R.lift(); R.step(30); const p2 = R.g.player.holding?.phase;
  R.step(120); const alive = R.A.state !== 'dead' && R.g.player.holding?.phase === 'held';
  R.W.input.buttons |= 4; R.W.input.clicked |= 4; R.step(1); R.lift(); R.step(1); const p3 = R.g.player.holding?.phase; R.downAt = -1; R.f = 0; for (let i = 0; i < 300 && R.downAt < 0; i++) R.step();
  verdict(held0 === 'held' && p1 === 'choke' && p2 === 'held' && alive && p3 === 'choke' && R.downAt > 0 && R.filed().some((e: string) => e === 'ko:choke'),
    'held after the first hold was let go: the button pressed again and kept down chokes (two thirds of a second on), let go he breathes and is held two seconds on; a one-frame click then is the whole choke, as a click in the arm always was: the arm closes at once and he goes down choked with the button up',
    `let go: ${held0} · pressed again, kept down: ${p1} · let go: ${p2}, two seconds on held and breathing ${alive} · a one-frame click: ${p3 ?? 'nobody held'}, down ${secs(R.downAt)} after it`);

  console.log('\n=== late: pressed just out of reach, and a button the page took away ===');
  const put = (C: any, gap: number) => C.g.teleportPlayer([AT[0] - gap, 0, AT[2]]);   // (behind him: he faces east)
  const L = await world(up(), 180, 1.7), far = L.said(); L.press(); L.step(18); const before = L.armAt >= 0 || L.blowAt >= 0; put(L, 0.8); L.step(30); const took = L.armAt >= 0 && L.blowAt < 0;
  const N = await world(up(), 180, 1.7); N.press(); N.step(Math.round((CLOSE.rmbTapSecs + CLOSE.rmbWaitSecs) * 60) + 12); put(N, 0.8); N.step(90); const none = N.armAt < 0 && N.blowAt < 0;
  const B = await world(up()); B.press(); B.step(3); B.W.input.pressed.add('Blur'); B.lift(); B.step(90); const blur = B.blowAt < 0 && B.armAt < 0 && B.A.state !== 'dead';
  verdict(!/knock him out/.test(far) && !before && took && none && blur,
    'the button pressed 1.7 m behind him (out of reach, no row) and kept down: nothing until Sam is in reach, then he is in the arm with no blow; kept down past the wait and only then in reach, nothing happens; and a press the page takes away after three frames (a blur) is no tap: nobody is struck',
    `out of reach the list says a blow ${/knock him out/.test(far)} · before he is in reach anything began ${before} · in reach: taken into the arm ${took} · after the wait (${f2(CLOSE.rmbTapSecs + CLOSE.rmbWaitSecs)} s): nothing ${none} · the blur: nothing ${blur}`);
}
async function page() {
  console.log('\n=== page: with the stalk as the page has it, and with the knife back ===');
  const g0 = STALK_STATS.grabs, P = await world(up(), 180, 0.8, { stalk: true, key: true }), row = P.said(); P.press(); for (let i = 0; i < 300 && P.chokeAt < 0; i++) P.step(); const from = !!P.g.player.holding?.from, counted = STALK_STATS.grabs - g0;
  const O = await world(up(), 180, 0.8, { stalk: true, key: false }), only = O.said();
  const K = await world(up(), 180, 0.8, { knife: true }), knife = K.said(); K.press(); K.step(4); K.lift(); K.step(90);
  const KH = await world(up(), 180, 0.8, { knife: true }); KH.press(); for (let i = 0; i < 8 * 60 && KH.downAt < 0; i++) KH.step(); const KF = KH.filed();
  const RE = /RMB {2}knock him out {2}· {2}RMB {2}hold to choke him/;
  verdict(RE.test(row) && P.chokeAt > 0 && P.blowAt < 0 && from && counted === 1 && /LMB {2}hold to grab him {2}· {2}RMB {2}knock him out {2}· {2}RMB {2}hold to choke him/.test(only)
    && /LMB {2}knife — lethal {2}· {2}RMB {2}knock him out {2}· {2}RMB {2}hold to choke him/.test(knife) && K.downAt > 0 && K.armAt < 0 && KH.chokeAt > 0 && KH.blowAt < 0 && KF.some((e: string) => e === 'ko:choke') && !KF.some((e: string) => e.startsWith('kill')),
    'with the stalk and its key up, as the page opens: the row says the choke, and the held button\'s grab is the stalk\'s own (it steps in from where he stood, and is counted once) and closes into the choke; with the click the only way the row says it too; with the knife back the row says it, a tap is the knockout and the held button chokes him with no kill',
    `the page: '${row}' · the arm closing ${secs(P.chokeAt)}, a blow ${P.blowAt >= 0}, the stalk's step in ${from}, counted ${counted} · the click the only way: '${only}' · the knife back: '${knife}' · its tap: down ${secs(K.downAt)}, in the arm ${K.armAt >= 0} · its hold: the arm closing ${secs(KH.chokeAt)}, filed ${KF.join(', ') || 'nothing'}`);
}
async function off() {
  console.log('\n=== off: the key down, the press is the knockout ===');
  const C = await world(false); C.press(); C.step(120);
  verdict(C.blowAt === 1 && C.armAt < 0 && C.downAt > 0 && Math.abs(C.loud - CLOSE.noise.behind) < 1e-6, 'with the key down the press itself is the knockout, begun on the press\'s own frame and as loud as it was, and the button kept down for two seconds takes nobody into the arm',
    `the blow began on frame ${C.blowAt} · in the arm ${C.armAt >= 0} · down ${secs(C.downAt)} · the loudest the room heard ${f2(C.loud)} (the table's ${f2(CLOSE.noise.behind)})`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_RMBHOLD, want = word !== undefined ? word === '1' : shipped;
  CLOSE.rmbHold = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = CLOSE.rmbHold, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.CLOSE?.rmbHold === 'boolean';
  CLOSE.rmbHold = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CLOSE.rmbHold = false; JR.applyKnobs(W.game, snapUp); const kept = CLOSE.rmbHold;
  delete snap.tables.CLOSE.rmbHold; CLOSE.rmbHold = true; JR.applyKnobs(W.game, snap); const old = CLOSE.rmbHold;
  const read = (q: string) => { CLOSE.rmbHold = !CLOSE.rmbHold; PR.pageSwitches(new URLSearchParams(q)); return CLOSE.rmbHold; }, plainQ = read(''), offQ = read('rmbhold=0');
  verdict((STAND_ENV as string[]).includes('TPS_RMBHOLD') && PR.FROZEN_HOLDS['CLOSE.rmbHold'] === 'TPS_RMBHOLD=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?rmbhold=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_RMBHOLD')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CLOSE.rmbHold']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?rmbhold=0 ${offQ}`);
}

/** the whole card (probes.ts 'rmbhold'): true = every check passed. The switches are put back as they were found. */
export async function rmbholdCheck(): Promise<boolean> {
  const close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = CLOSE.rmbHold;
  try { await tapAndHold(); await releaseAndStop(); await againAndLate(); await frontAndWords(); await page(); await off(); Object.assign(CLOSE, close); await harness(); }
  finally { Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== rmbhold: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await rmbholdCheck()) ? 0 : 1);
