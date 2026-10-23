// 'handslow' — CROUCHED, HIS HANDS STAY LOW UNTIL THE MOVE (CLOSE.handsLow, src/game/close.ts closeReady). The maintainer, of a still from the pair's mission with
// Sam crouched a metre behind a guard: "the weirdness in this case was his hand". The grab's tell holds the open left hand out for the man's neck; at the crouch
// (with `reachUp`) that is a hand 1.15 m up over a head 0.9 m up, a third to half a metre short of anybody: from the game's camera, a hand put up.
//   bun run tools/qa/handslow-check.ts        (also `probes.ts handslow`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   low       crouched and stopped behind a standing man at three gaps, the key up against the key down (`reachUp` up for both, as the page has it): key down
//             the tell is the grab's and the left hand is over his own head; key up the tell is the knife hand's alone, the left hand is under his own
//             head and under 0.9 m, and the crouch the game reads has not moved.
//   offer     the same three spots with the key up: the grab is still on offer there (close.ts closeAt) and its row is in the list.
//   stand     on his feet behind the same man the tell is the grab's and every joint is the same to the bit with the key up or down; crouched with the
//             pistol up ('grabGun') the same to the bit too.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?handslow=0` puts it off), rides a
//             recording's tables, and a recording from before the key replays with it off.
// HANDSLOW_BREAK=1 = the key left down where `low` asks for it up: low must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here is a picture (tools/qa/close-stills.ts + pose-mesh-raster.py draw the same staging on the worn mesh).
import { standUp, ROOT } from './headless.ts';

const { CLOSE, closeAt } = await import(`${ROOT}/src/game/close.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.HANDSLOW_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, LOBBY: P3 = [10.2, 0, 19.5];
const f2 = (n: number) => n.toFixed(2);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** the lobby's open floor (reachup-check.ts's staging): the shift parked, one man stood facing east, Sam hands empty behind him, the key as given */
async function lobby(key: boolean) {
  Math.random = seeded(7301); const W: any = await quiet(() => standUp()), g = W.game; CLOSE.on = true; CLOSE.reachUp = true; CLOSE.handsLow = key;
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const place = (gd: any, p: P3) => { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = EAST; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.char.update(0); gd.char.update(DT); };
  const [A, ...rest] = g.guards; rest.forEach((gd: any, i: number) => { place(gd, [37.5, 0, 6 + i * 1.5]); gd.heardUpTo = 1e12; }); place(A, LOBBY); A.wp = 1;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  const samAt = (d: number, crouch: boolean) => { g.teleportPlayer([A.char.pos[0] - d, 0, A.char.pos[2]]); g.player.crouch = crouch; const pl = g.player.char; pl.bodyYaw = pl.aimYaw = EAST; step(90); };
  const at = (c: any, node: string): P3 => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world; return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
  return { W, g, A, step, samAt, at };
}
interface Read { hand: P3; head: P3; crouch: number; ready: string | null; joints: Float32Array; grab: boolean; row: boolean }
async function stopped(key: boolean, gap: number, crouch: boolean, pistol = false): Promise<Read> {
  const S = await lobby(key), g = S.g, c = g.player.char; if (pistol) g.player.holstered = false; S.samAt(gap, crouch);
  return { hand: S.at(c, 'handL'), head: S.at(c, 'head'), crouch: c.anim.crouch, ready: c.anim.ready, joints: Float32Array.from(c.skel.jointData),
    grab: !!closeAt(g, S.A, c.pos).grab, row: g.nearby.some((x: any) => x.kind === 'guard' && x.guard === S.A && x.verb === 'grab') };
}
const GAPS = [1.0, 0.85, 0.72];

async function low() {
  console.log('\n=== low: crouched behind a standing man, the tell is the hand on the knife and the other stays down ===');
  const rows: string[] = []; let bad = 0;
  for (const gap of GAPS) {
    const U = await stopped(!BREAK, gap, true), D = await stopped(false, gap, true);
    const ok = D.ready === 'grab' && D.hand[1] > D.head[1] && U.ready === 'strike' && U.hand[1] < U.head[1] - 0.05 && U.hand[1] < 0.9 && U.crouch > 0.99 && D.crouch > 0.99;
    if (!ok) bad++;
    rows.push(`${f2(gap)} m: key down the tell ${D.ready}, the left hand ${f2(D.hand[1])} m up, his head ${f2(D.head[1])} · key up the tell ${U.ready}, the hand ${f2(U.hand[1])}, his head ${f2(U.head[1])} · the crouch ${f2(U.crouch)} / ${f2(D.crouch)}`);
  }
  verdict(bad === 0, 'at three gaps: with the key down the grab\'s tell holds the left hand over his own head; with it up the tell is the knife hand\'s, the left hand is under his head and under 0.9 m, and the crouch the game reads is whole either way', rows.join('\n    '));
}
async function offer() {
  console.log('\n=== offer: the grab is still there to take ===');
  const rows: string[] = []; let bad = 0;
  for (const gap of GAPS) { const U = await stopped(true, gap, true); if (!U.grab || !U.row) bad++; rows.push(`${f2(gap)} m: the grab on offer ${U.grab}, its row in the list ${U.row}`); }
  verdict(bad === 0, 'crouched at the same three spots with the key up: the grab is on offer and its row is in the list, as it was', rows.join(' · '));
}
async function stand() {
  console.log('\n=== stand: on his feet, and with the pistol up, the tell is what it was ===');
  const U = await stopped(true, 0.85, false), D = await stopped(false, 0.85, false); let worst = 0; for (let i = 0; i < U.joints.length; i++) worst = Math.max(worst, Math.abs(U.joints[i] - D.joints[i]));
  verdict(U.ready === 'grab' && D.ready === 'grab' && worst === 0, 'standing 0.85 m behind him: the grab\'s tell, every joint the same to the bit with the key up or down', `the tell ${U.ready} / ${D.ready} · the largest difference in any joint's matrix ${worst} · the hand ${f2(U.hand[1])} m up`);
  const GU = await stopped(true, 0.85, true, true), GD = await stopped(false, 0.85, true, true); let gw = 0; for (let i = 0; i < GU.joints.length; i++) gw = Math.max(gw, Math.abs(GU.joints[i] - GD.joints[i]));
  verdict(GU.ready === 'grabGun' && gw === 0, 'crouched 0.85 m behind him with the pistol up: the gun keeps its aim — every joint the same to the bit with the key up or down', `the tell ${GU.ready} · the largest difference in any joint's matrix ${gw}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_HANDSLOW, want = word !== undefined ? word === '1' : shipped;
  CLOSE.handsLow = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up, so it is set wrong first; the page's stand has it from the page's boot, read once when the harness loads: `found`, put back after the lines above wrote it)
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), stood = CLOSE.handsLow;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = 'handsLow' in snap.tables.CLOSE;
  CLOSE.handsLow = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CLOSE.handsLow = false; JR.applyKnobs(W.game, snapUp); const kept = CLOSE.handsLow;
  delete snap.tables.CLOSE.handsLow; CLOSE.handsLow = true; JR.applyKnobs(W.game, snap); const old = CLOSE.handsLow;
  const read = (q: string) => { CLOSE.handsLow = !CLOSE.handsLow; PR.pageSwitches(new URLSearchParams(q)); return CLOSE.handsLow; }, plain = read(''), off = read('handslow=0');
  verdict((STAND_ENV as string[]).includes('TPS_HANDSLOW') && PR.FROZEN_HOLDS['CLOSE.handsLow'] === 'TPS_HANDSLOW=1' && stood === want && (!shipped || word !== undefined || found === want) && had && kept === true && old === false && plain === true && off === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?handslow=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_HANDSLOW')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CLOSE.handsLow']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plain} · ?handslow=0 ${off}`);
}

/** the whole card (probes.ts 'handslow'): true = every check passed. The switches are put back as they were found. */
export async function handsLowCheck(): Promise<boolean> {
  const was = { ...CLOSE }, rnd = Math.random; allPass = true; found = CLOSE.handsLow;
  try { await low(); await offer(); await stand(); Object.assign(CLOSE, was); await harness(); }
  finally { Object.assign(CLOSE, was); Math.random = rnd; }
  console.log(`\n=== handslow: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await handsLowCheck() ? 0 : 1);
