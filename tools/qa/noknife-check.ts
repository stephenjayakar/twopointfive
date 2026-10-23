// 'noknife' — NO KNIFE (CLOSE.noKnife, src/game/close.ts). The maintainer's design: "remove the knife, only rmb for non lethal CQC when nothing equipped … then
// we also remove the knife from interrogation. you can still select nothing equipped or the pistol, but there's only rmb to choke out".
//   bun run tools/qa/noknife-check.ts        (also `probes.ts noknife`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   blow      empty hands in reach of a man who stands, from behind, from a side and from the front: a left click starts nothing and he is on his feet a second
//             and a half later; a right click puts him down, out cold (the chronicle files a knockout, no kill).
//   hold      a man in the arm: a left click is no kill (no kill phase, he breathes a second later); a right click starts the choke and he goes down choked.
//   draw      with him in the arm no box of Sam's is the knife or its sheath, and his rows name no knife; in reach with empty hands the list says the right
//             click's knockout and no knife. The control: with the key down the arm hold draws the knife.
//   words     the three lesson lines that teach the knife say the knockout instead, and are word for word as written with the key down.
//   off       the key down: the left click from behind kills him with the knife, as it did.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?noknife=0` puts it off), rides a recording's
//             tables, and a recording from before the key replays with it off.
// NOKNIFE_BREAK=1 = the key left down where blow, hold, draw and words ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the bare-handed hold or the tell without a hilt LOOKS.
import { standUp, ROOT } from './headless.ts';

const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK } = await import(`${ROOT}/src/game/stalk.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { KNIFE_TAG, SHEATH_TAG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { lessonLine } = await import(`${ROOT}/src/game/lesson.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.NOKNIFE_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK;
/** one man stood on the lobby's floor facing east, the rest parked, Sam with empty hands `gap` m from him `bearing` degrees off his facing (180 = behind) */
async function world(on: boolean, bearing: number, gap = 0.8) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  CLOSE.on = true; CLOSE.lethal = true; CLOSE.heldClicks = true; CLOSE.side = CLOSE.front = true; CLOSE.noKnife = on; STALK.on = false;   // (the frozen stand's pins write them at every stand-up; the stalk held down: the left click here is asked as a blow)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  const [A, ...rest] = g.guards; for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  const a = EAST + bearing * Math.PI / 180; W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] + Math.sin(a) * gap, 0, AT[2] + Math.cos(a) * gap]);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  const click = (bit: number) => { W.input.buttons |= bit; W.input.clicked |= bit; step(); W.input.buttons &= ~bit; step(); };
  const said = () => g.nearby.map((r: any) => Object.values(r).filter(v => typeof v === 'string').join(' ')).join(' | ');
  const ev0 = g.chronicle.events.length, filed = () => g.chronicle.events.slice(ev0).map((e: any) => `${e.kind}${e.data?.weapon ? ':' + e.data.weapon : ''}${e.data?.method ? ':' + e.data.method : ''}`);
  step(40);
  return { W, g, A, step, click, said, filed };
}

async function blow() {
  console.log('\n=== blow: the left click is no blow, the right click the knockout, from every side ===');
  const rows: string[] = []; let ok = true;
  for (const [name, bearing] of [['behind', 180], ['a side', 90], ['the front', 0]] as const) {
    const C = await world(up(), bearing), { g, A } = C; const offered = /RMB {2}knock him out/.test(C.said()) && !/knife/i.test(C.said());
    C.click(1); const begun = !!g.player.takedown; C.step(90); const stood = A.state !== 'dead';
    C.click(4); let t = Infinity; for (let f = 0; f < 240; f++) { C.step(); if (A.state === 'dead') { t = (f + 1) * DT; break; } }
    const F = C.filed(), ko = F.some((e: string) => e.startsWith('ko')), kill = F.some((e: string) => e.startsWith('kill'));
    ok &&= offered && !begun && stood && t < 4 && ko && !kill;
    rows.push(`${name}: the list says the knockout and no knife ${offered} · the left click began a blow ${begun}, he stood a second and a half on ${stood} · the right click: ${isFinite(t) ? `down in ${t.toFixed(2)} s` : 'still up'}, filed ${F.join(', ') || 'nothing'}`);
  }
  verdict(ok, 'empty hands in reach of a man who stands, from behind, a side and the front: the left click starts nothing, the right click puts him out cold and no kill is filed', rows.join('\n    '));
}
async function hold() {
  console.log('\n=== hold: in the arm the left click is no kill, the right click the choke ===');
  const C = await world(up(), 180), { g, A } = C; startGrab(g, A); C.step(120);
  const H0 = g.player.holding, held = !!H0 && H0.phase === 'held';
  C.click(1); C.step(60); const H1 = g.player.holding, killing = !H1 || H1.phase === 'kill' || A.state === 'dead';
  C.click(4); let choking = false; for (let f = 0; f < 60 && !choking; f++) { C.step(); const H = g.player.holding; choking = !!H && (H.phase === 'choke' || H.windT >= 0); }
  let t = Infinity; for (let f = 0; f < 15 * 60; f++) { C.step(); if (A.state === 'dead') { t = (f + 1) * DT; break; } }
  const F = C.filed();
  verdict(held && !killing && choking && t < 15 && F.some((e: string) => e.startsWith('ko')) && !F.some((e: string) => e.startsWith('kill')),
    'a man in the arm: the left click is no kill and he breathes a second later; the right click starts the choke and he goes down choked, no kill filed',
    `held ${held} · after the left click: killed or killing ${killing} · the right click began the choke ${choking} · ${isFinite(t) ? `down in ${t.toFixed(2)} s` : 'never down'} · filed ${F.join(', ') || 'nothing'}`);
}
async function draw() {
  console.log('\n=== draw: nothing of his is a knife ===');
  const boxes = (g: any) => { const out: any[] = []; handProps(g, out); const mine = out.filter(b => b.owner === (g.player.char.id & 0xff)); return { knife: mine.filter(b => b.name === KNIFE_TAG).length, sheath: mine.filter(b => b.name === SHEATH_TAG).length }; };
  const C = await world(up(), 180), reach = C.said(), near = boxes(C.g); startGrab(C.g, C.A); C.step(120); const inArm = boxes(C.g), rows = C.said(), flag = !!C.g.player.char.anim.noKnife;
  const D = await world(false, 180); startGrab(D.g, D.A); D.step(120); const was = boxes(D.g);
  verdict(flag && inArm.knife === 0 && inArm.sheath === 0 && near.knife === 0 && near.sheath === 0 && !/knife/i.test(rows) && !/knife/i.test(reach) && was.knife > 0,
    'in reach and with him in the arm no box of Sam\'s is the knife or its sheath and no row names one; with the key down the arm hold draws the knife',
    `the animator told ${flag} · in reach: knife boxes ${near.knife}, sheath ${near.sheath} · in the arm: knife ${inArm.knife}, sheath ${inArm.sheath} · rows name a knife: in reach ${/knife/i.test(reach)}, in the arm ${/knife/i.test(rows)} · key down, in the arm: knife boxes ${was.knife}`);
}
async function words() {
  console.log('\n=== words: the lessons teach the knockout ===');
  const LINES = ['Right click to knock him out, or left click to use the knife', 'Stay low so he doesn\'t hear you, then left click to knife him', 'When the guard comes through, step in and left-click to kill him with the knife'];
  CLOSE.on = true; CLOSE.noKnife = up(); const now = LINES.map(l => lessonLine(l)); CLOSE.noKnife = false; const asWas = LINES.map(l => lessonLine(l));
  verdict(now.every((l: string) => !/knife/i.test(l) && /knock him out/.test(l)) && asWas.every((l: string, i: number) => l === LINES[i]),
    'each of the three lesson lines that teach the knife says the knockout and no knife, and with the key down reads as written', now.map((l: string) => `'${l}'`).join(' · '));
}
async function off() {
  console.log('\n=== off: the key down ===');
  const C = await world(false, 180); C.click(1); let t = Infinity; for (let f = 0; f < 240; f++) { C.step(); if (C.A.state === 'dead') { t = (f + 1) * DT; break; } }
  const F = C.filed();
  verdict(t < 4 && F.some((e: string) => e === 'kill:knife'), 'with the key down the left click from behind kills him with the knife, as it did', `${isFinite(t) ? `down in ${t.toFixed(2)} s` : 'still up'} · filed ${F.join(', ') || 'nothing'}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_NOKNIFE, want = word !== undefined ? word === '1' : shipped;
  CLOSE.noKnife = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = CLOSE.noKnife, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.CLOSE?.noKnife === 'boolean';
  CLOSE.noKnife = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CLOSE.noKnife = false; JR.applyKnobs(W.game, snapUp); const kept = CLOSE.noKnife;
  delete snap.tables.CLOSE.noKnife; CLOSE.noKnife = true; JR.applyKnobs(W.game, snap); const old = CLOSE.noKnife;
  const read = (q: string) => { CLOSE.noKnife = !CLOSE.noKnife; PR.pageSwitches(new URLSearchParams(q)); return CLOSE.noKnife; }, plainQ = read(''), offQ = read('noknife=0');
  verdict((STAND_ENV as string[]).includes('TPS_NOKNIFE') && PR.FROZEN_HOLDS['CLOSE.noKnife'] === 'TPS_NOKNIFE=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?noknife=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_NOKNIFE')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CLOSE.noKnife']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?noknife=0 ${offQ}`);
}

/** the whole card (probes.ts 'noknife'): true = every check passed. The switches are put back as they were found. */
export async function noknifeCheck(): Promise<boolean> {
  const close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = CLOSE.noKnife;
  try { await blow(); await hold(); await draw(); await words(); await off(); Object.assign(CLOSE, close); await harness(); }
  finally { Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== noknife: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await noknifeCheck()) ? 0 : 1);
