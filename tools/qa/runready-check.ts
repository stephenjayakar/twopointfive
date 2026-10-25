// 'runready' — SAM SPRINTS WITH BOTH HANDS ON THE PISTOL (RUNREADY, src/game/character.ts; asked for by src/game/player.ts). The maintainer: "sprinting with
// pistol animation is weird, should keep two hands on it and at low ready, like rifle sprinting animation".
//   bun run tools/qa/runready-check.ts        (also `probes.ts runready`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   hands     the pistol in his hand and the sprint held: the animator is told, and over a second of the run his two hands stay together on the gun, below
//             his chest and ahead of him, the muzzle down, and the gun hand keeps its place by his body where the fist pumped.
//             (On the page's stand the run passes a thing inside the gun's reach: for those frames the low ready is the wall rule's own, gunwall.ts, with
//             the key up or down. They are counted apart, and the hands are judged through them too.)
//   back      Shift let go: the gun is back in its carry within half a second, and nothing is left up (no stance was written, the input is down).
//   others    the same sprint with the pistol holstered, and with the rifle in his hands, never tells the animator: the bare arms and the long gun's low
//             ready are as they were.
//   off       the key down: the pistol rides the pumping fist, as it did.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?runready=0` puts it off), rides a
//             recording's tables, and a recording from before the table replays with it off.
// RUNREADY_BREAK=1 = the key left down where hands and back ask for it up: `hands` must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: the numbers say where the hands are, not how the run LOOKS.
import { standUp, ROOT } from './headless.ts';

const { RUNREADY } = await import(`${ROOT}/src/game/character.ts`);
const { gunWallIs } = await import(`${ROOT}/src/game/gunwall.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.RUNREADY_BREAK === '1', DT = 1 / 60, FROM = [5.2, 0, 19.5];   // (the lobby's open floor, the long way east)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (n: number) => n.toFixed(2), cm = (n: number) => (n * 100).toFixed(0);
/** Sam alone on the lobby's floor with `gun` in his hands (or the pistol on his thigh). `go(keys, secs)` holds keys and measures every frame of it: how far
 *  apart his hands are (the most), the gun hand's height and its place ahead of him along the run (least, most), the muzzle's dip, and what was asked */
async function world(on: boolean, gun: 'pistol' | 'holstered' | 'rifle') {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game; RUNREADY.on = on;
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; const pl = g.player;
  if (gun === 'rifle') { if (!pl.hasRifle) return null; pl.slot = 'rifle'; pl.holstered = false; } else { pl.slot = 'pistol'; pl.holstered = gun === 'holstered'; }
  for (const [i, gd] of g.guards.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...FROM]); pl.crouch = false; const c = pl.char;
  const C = { W, g, pl, c,
    go: (keys: string[], secs: number) => { for (const k of keys) W.input.keys.add(k);
      const M = { apart: 0, yLo: 9, yHi: -9, fLo: 9, fHi: -9, dip: 9, told: 0, n: 0, sprint: 0, stance: 0, walled: 0, v: 0 };
      for (let i = 0; i < Math.round(secs / DT); i++) { W.cursorAt([c.pos[0] + 6, 1, c.pos[2]]); W.step(DT); const b = c.bones, r = b.handR, l = b.handL; M.n++;
        M.apart = Math.max(M.apart, Math.hypot(r[0] - l[0], r[1] - l[1], r[2] - l[2])); M.yLo = Math.min(M.yLo, r[1]); M.yHi = Math.max(M.yHi, r[1]);
        const f = (r[0] - c.pos[0]) * Math.sin(c.bodyYaw) + (r[2] - c.pos[2]) * Math.cos(c.bodyYaw); M.fLo = Math.min(M.fLo, f); M.fHi = Math.max(M.fHi, f);
        M.dip = Math.min(M.dip, -c.gunDir[1]); if (c.anim.runReady) M.told++; if (pl.sprinting) M.sprint++; const wall = gunWallIs(g, c); if (wall) M.walled++; else if (c.anim.stance !== 'none') M.stance++; }
      for (const k of keys) W.input.keys.delete(k); M.v = Math.hypot(c.vel[0], c.vel[2]); return M; },
    still: () => { g.teleportPlayer([...FROM]); for (let i = 0; i < 30; i++) { W.cursorAt([c.pos[0] + 6, 1, c.pos[2]]); W.step(DT); } } };
  C.still(); return C;
}
const RUN = ['KeyD', 'ShiftLeft'];
const say = (M: any) => `told on ${M.told} of ${M.n} frames · sprinting on ${M.sprint} · hands at most ${cm(M.apart)} cm apart · the gun hand ${cm(M.yLo)}‥${cm(M.yHi)} cm up, ${cm(M.fLo)}‥${cm(M.fHi)} cm ahead of him (it travels ${cm(M.fHi - M.fLo)}) · muzzle down at least ${(Math.asin(Math.max(-1, Math.min(1, M.dip))) * 180 / Math.PI).toFixed(0)}° · ${f2(M.v)} m/s`;

async function handsAndBack() {
  console.log('\n=== hands: the sprint with the pistol keeps both hands on it, low ===');
  const A = (await world(up(), 'pistol'))!; A.go(RUN, 1.0); const run = A.go(RUN, 1.0);
  const O = (await world(false, 'pistol'))!; O.go(RUN, 1.0); const old = O.go(RUN, 1.0);
  verdict(run.told === run.n && run.sprint === run.n && run.apart < 0.14 && run.yHi < 1.2 && run.fLo > 0.1 && run.dip > 0.4 && run.fHi - run.fLo < 0.12 && old.fHi - old.fLo > (run.fHi - run.fLo) * 2 && run.stance === 0 && run.v > 4,
    'over a second of the sprint the animator is told, his hands stay together on the pistol, below his chest and ahead of him, the muzzle down, and the gun hand keeps its place where the fist pumped; no stance is written but the one the wall rule owns',
    `${say(run)} · a stance written on ${run.stance} frames (the wall rule's own low ready on ${run.walled} more, ${old.walled} with the key down)\n    with the key down: ${say(old)}`);

  console.log('\n=== back: Shift let go, the gun is back in its carry ===');
  const walk0 = A.go(['KeyD'], 0.5), walk = A.go(['KeyD'], 0.5), upper = A.c.anim.upper;
  verdict(walk0.told === 0 && walk.told === 0 && walk.sprint === 0 && upper === 'relaxed' && walk.stance === 0 && A.c.anim.runReady === false,
    'walking on with Shift up: the animator is not told on any frame, the pistol\'s carry is back and no stance is left up',
    `told on ${walk0.told + walk.told} frames after the sprint · upper ${upper} · stance ${A.c.anim.stance} · hands at most ${cm(walk.apart)} cm apart half a second on`);

  console.log('\n=== off: the key down, the gun rides the pumping fist ===');
  verdict(old.told === 0 && old.sprint === old.n && old.apart > 0.3 && old.fHi - old.fLo > 0.2, 'with the key down the same sprint never tells the animator: the hands swing apart and the gun hand pumps, as it did', say(old));
}
async function others() {
  console.log('\n=== others: a holstered pistol and the rifle are as they were ===');
  const H = (await world(up(), 'holstered'))!; H.go(RUN, 1.0); const hol = H.go(RUN, 1.0);
  const R = await world(up(), 'rifle'); let rif: any = null, stanceR = ''; if (R) { R.go(RUN, 1.0); rif = R.go(RUN, 1.0); stanceR = String(R.c.anim.longStance); }
  verdict(hol.told === 0 && hol.sprint === hol.n && hol.apart > 0.3 && (!rif || (rif.told === 0 && rif.sprint === rif.n && stanceR === 'lowLong')),
    'sprinting with the pistol on his thigh his arms are the run\'s own, and with the rifle in his hands it is the long gun\'s low ready: the animator is told for neither',
    `holstered: ${say(hol)}\n    ${rif ? `the rifle: ${say(rif)} · carriage ${stanceR}` : 'the rifle: this stand\'s kit has none (not asked)'}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_RUNREADY, want = word !== undefined ? word === '1' : shipped;
  RUNREADY.on = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = RUNREADY.on, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.RUNREADY?.on === 'boolean';
  RUNREADY.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); RUNREADY.on = false; JR.applyKnobs(W.game, snapUp); const kept = RUNREADY.on;
  delete snap.tables.RUNREADY; RUNREADY.on = true; JR.applyKnobs(W.game, snap); const old = RUNREADY.on;
  const read = (q: string) => { RUNREADY.on = !RUNREADY.on; PR.pageSwitches(new URLSearchParams(q)); return RUNREADY.on; }, plainQ = read(''), offQ = read('runready=0');
  verdict((STAND_ENV as string[]).includes('TPS_RUNREADY') && PR.FROZEN_HOLDS['RUNREADY.on'] === 'TPS_RUNREADY=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before the table replays with it down, and the page\'s boot writes it on for a plain address and off for ?runready=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_RUNREADY')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['RUNREADY.on']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?runready=0 ${offQ}`);
}

/** the whole card (probes.ts 'runready'): true = every check passed. The switch is put back as it was found. */
export async function runreadyCheck(): Promise<boolean> {
  const was = { ...RUNREADY }; allPass = true; found = RUNREADY.on;
  try { await handsAndBack(); await others(); Object.assign(RUNREADY, was); await harness(); }
  finally { Object.assign(RUNREADY, was); }
  console.log(`\n=== runready: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await runreadyCheck()) ? 0 : 1);
