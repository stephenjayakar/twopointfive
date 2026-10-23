// 'crouchrun' — SHIFT IN A CROUCH IS A FAST CROUCH WALK (CROUCHRUN, src/game/player.ts; its look: character.ts DASH). The maintainer's design: "we can make
// sprint when crouching a really fast crouch walk, but you have to stand up to sprint properly".
//   bun run tools/qa/crouchrun-check.ts        (also `probes.ts crouchrun`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   stays     crouched, a move key and Shift: he stays down, he is not `sprinting`, and he covers ground at the table's pace — quicker than his walk, well
//             under his sprint.
//   heard     a footfall of it is the table's level on this floor: louder than a step of the crouch walk and of the walk, quieter than a step of the sprint.
//   sneak     it is no sneak (unseen.ts samSneaks), where the crouch walk is.
//   stand     the sprint is the standing man's: crouched with Shift held, [C] stands him up and he sprints; on his feet Shift is the sprint as it was.
//   look      the stride: with Shift the crouch cycle's long stride comes in (the animator's share whole inside a second) and lets go when Shift does; it
//             takes fewer steps a second than the same speed would on the crouch walk's own stride.
//   off       the key down: Shift in a crouch stands him up into the sprint, as it did.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?crouchrun=0` puts it off), rides a
//             recording's tables, and a recording from before the table replays with it off.
// CROUCHRUN_BREAK=1 = the key left down where stays, heard, sneak, stand and look ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU AND NO EARS: nothing here says how the fast crouch walk LOOKS or how its steps SOUND.
import { standUp, ROOT } from './headless.ts';

const { CROUCHRUN, crouchPace } = await import(`${ROOT}/src/game/player.ts`);
const { samSneaks } = await import(`${ROOT}/src/game/unseen.ts`);
const { DASH, defaultAnimParams } = await import(`${ROOT}/src/game/character.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.CROUCHRUN_BREAK === '1', DT = 1 / 60, FROM = [5.2, 0, 19.5];   // (the lobby's open floor, the long way east)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (n: number) => n.toFixed(2), f3 = (n: number) => n.toFixed(3);
/** Sam alone on the lobby's floor, hands empty, the shift parked: `go(keys, secs)` holds keys and returns his speed at the end, the loudest footfall, the steps filed */
async function world(on: boolean, crouch: boolean) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game; CROUCHRUN.on = on;
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  for (const [i, gd] of g.guards.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...FROM]); g.player.crouch = crouch; const c = g.player.char;
  const C = { W, g, pl: g.player, c,
    go: (keys: string[], secs: number) => { for (const k of keys) W.input.keys.add(k); let loud = 0, steps = 0; const x0 = c.pos[0];
      for (let i = 0; i < Math.round(secs / DT); i++) { W.cursorAt([c.pos[0] + 6, 1, c.pos[2]]); W.step(DT); for (const e of g.events) if (e.kind === 'step' && e.time === g.time) { loud = Math.max(loud, e.level); steps++; } }
      for (const k of keys) W.input.keys.delete(k); return { v: Math.hypot(c.vel[0], c.vel[2]), loud, steps, dx: c.pos[0] - x0, per: steps / secs }; },
    still: () => { g.teleportPlayer([...FROM]); for (let i = 0; i < 30; i++) { W.cursorAt([c.pos[0] + 6, 1, c.pos[2]]); W.step(DT); } } };
  C.still(); return C;
}

async function staysAndHeard() {
  console.log('\n=== stays: Shift in a crouch keeps him down and moves him quickly ===');
  const A = await world(up(), true), T = A.g.tune; A.go(['KeyD'], 1); const slow = A.go(['KeyD'], 1.5), sneakA = samSneaks(A.pl);
  const fast0 = A.go(['KeyD', 'ShiftLeft'], 1); const fast = A.go(['KeyD', 'ShiftLeft'], 1.5), down = A.pl.crouch, spr = A.pl.sprinting, flag = A.pl.dash;
  A.W.input.keys.add("KeyD"); A.W.input.keys.add("ShiftLeft"); A.W.step(DT);
  const sneakB = samSneaks(A.pl); A.W.input.keys.delete('KeyD'); A.W.input.keys.delete('ShiftLeft');
  verdict(down && !spr && flag && fast.v > T.playerWalk * 1.15 && fast.v < T.playerSprint * 0.75 && Math.abs(fast.v / slow.v - CROUCHRUN.pace / crouchPace(A.g)) < 0.12 && fast0.v > slow.v,
    'crouched with a move key and Shift held: he stays in the crouch, he is not sprinting, and he covers ground at the table\'s pace over the crouch walk\'s — quicker than his walk, well under his sprint',
    `crouched ${down} · sprinting ${spr} · the fast walk's flag ${flag} · ${f2(fast.v)} m/s (the crouch walk here ${f2(slow.v)}, the table ${f2(CROUCHRUN.pace)} over ${f2(crouchPace(A.g))}; his walk ${f2(T.playerWalk)}, his sprint ${f2(T.playerSprint)})`);

  console.log('\n=== heard: a step of it is louder than a walk\'s and quieter than a run\'s ===');
  const B = await world(up(), false); B.go(['KeyD'], 0.8); const walk = B.go(['KeyD'], 1.5); B.still(); B.go(['KeyD', 'ShiftLeft'], 0.8); const run = B.go(['KeyD', 'ShiftLeft'], 1.2);
  const floor = slow.loud / 0.125;
  verdict(fast.steps > 2 && slow.steps > 1 && walk.steps > 1 && run.steps > 1 && fast.loud > walk.loud + 0.02 && fast.loud > slow.loud * 2 && fast.loud < run.loud - 0.2 && Math.abs(fast.loud - CROUCHRUN.loud * floor) < 0.02,
    'its footfalls are filed at the table\'s level on this floor: over a step of the crouch walk and of the walk, well under a step of the sprint',
    `a step of the crouch walk ${f3(slow.loud)} · of the walk ${f3(walk.loud)} · of Shift in a crouch ${f3(fast.loud)} (the table ${f3(CROUCHRUN.loud)} × this floor's ${f2(floor)}) · of the sprint ${f3(run.loud)} · steps filed ${slow.steps} / ${walk.steps} / ${fast.steps} / ${run.steps}`);

  console.log('\n=== sneak: it is no sneak ===');
  verdict(sneakA && !sneakB && down && !spr, 'the crouch walk is a sneak (unseen.ts) and Shift in a crouch, down and not sprinting, is not', `the crouch walk ${sneakA} · Shift in a crouch ${sneakB} (crouched ${down}, sprinting ${spr})`);

  console.log('\n=== look: the long stride comes in with Shift and lets go with it ===');
  const an: any = A.c.anim, share = an.dashW; A.go(['KeyD'], 1.2); const after = an.dashW, P = defaultAnimParams;
  const own = slow.per * (fast.v / slow.v);   // (the crouch walk's own stride at the fast walk's speed)
  verdict(share > 0.9 && after < 0.02 && DASH.stride > 0.05 && fast.per < own * 0.9 && fast.per > slow.per,
    'with Shift held the animator has the long stride whole, a second after Shift is let go it has none of it, and at its speed he takes fewer steps a second than the crouch walk\'s own stride would',
    `the stride's share with Shift ${f2(share)}, a second after ${f2(after)} · steps a second: the crouch walk ${f2(slow.per)}, Shift in a crouch ${f2(fast.per)} (its own stride at that speed would take ${f2(own)}) · the clip's natural ${f2(P.crouchSpeed)} m/s`);
}
async function standAndOff() {
  console.log('\n=== stand: the sprint is the standing man\'s ===');
  const A = await world(up(), true); A.W.input.keys.add('KeyD'); A.W.input.keys.add('ShiftLeft'); for (let i = 0; i < 40; i++) A.W.step(DT); const before = { down: A.pl.crouch, spr: A.pl.sprinting };
  A.W.input.pressed.add('KeyC'); for (let i = 0; i < 70; i++) { A.W.cursorAt([A.c.pos[0] + 6, 1, A.c.pos[2]]); A.W.step(DT); } const v = Math.hypot(A.c.vel[0], A.c.vel[2]), after = { down: A.pl.crouch, spr: A.pl.sprinting };
  A.W.input.keys.delete('KeyD'); A.W.input.keys.delete('ShiftLeft');
  const B = await world(up(), false); B.go(['KeyD', 'ShiftLeft'], 0.6); const r = B.go(['KeyD', 'ShiftLeft'], 0.8), bs = { down: B.pl.crouch };
  verdict(before.down && !before.spr && !after.down && after.spr && v > A.g.tune.playerSprint * 0.8 && !bs.down && r.v > B.g.tune.playerSprint * 0.8,
    'crouched with Shift held he is down and not sprinting; [C] stands him up and he sprints; on his feet Shift is the sprint as it was',
    `crouched + Shift: down ${before.down}, sprinting ${before.spr} · after [C]: down ${after.down}, sprinting ${after.spr}, ${f2(v)} m/s · standing + Shift: ${f2(r.v)} m/s (his sprint ${f2(A.g.tune.playerSprint)})`);

  console.log('\n=== off: the key down, Shift stands him up into the sprint ===');
  const O = await world(false, true); O.go(['KeyD', 'ShiftLeft'], 0.6); const o = O.go(['KeyD', 'ShiftLeft'], 0.8); O.W.input.keys.add('KeyD'); O.W.input.keys.add('ShiftLeft'); O.W.step(DT);
  verdict(!O.pl.crouch && O.pl.sprinting && !O.pl.dash && o.v > O.g.tune.playerSprint * 0.8 && (O.c.anim as any).dashW === 0,
    'with the key down Shift in a crouch stands him up and he sprints, and the animator has none of the long stride',
    `down ${O.pl.crouch} · sprinting ${O.pl.sprinting} · ${f2(o.v)} m/s · the stride's share ${f2((O.c.anim as any).dashW)}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_CROUCHRUN, want = word !== undefined ? word === '1' : shipped;
  CROUCHRUN.on = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = CROUCHRUN.on, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.CROUCHRUN?.on === 'boolean';
  CROUCHRUN.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CROUCHRUN.on = false; JR.applyKnobs(W.game, snapUp); const kept = CROUCHRUN.on;
  delete snap.tables.CROUCHRUN; CROUCHRUN.on = true; JR.applyKnobs(W.game, snap); const old = CROUCHRUN.on;
  const read = (q: string) => { CROUCHRUN.on = !CROUCHRUN.on; PR.pageSwitches(new URLSearchParams(q)); return CROUCHRUN.on; }, plainQ = read(''), offQ = read('crouchrun=0');
  verdict((STAND_ENV as string[]).includes('TPS_CROUCHRUN') && PR.FROZEN_HOLDS['CROUCHRUN.on'] === 'TPS_CROUCHRUN=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before the table replays with it down, and the page\'s boot writes it on for a plain address and off for ?crouchrun=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_CROUCHRUN')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CROUCHRUN.on']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?crouchrun=0 ${offQ}`);
}

/** the whole card (probes.ts 'crouchrun'): true = every check passed. The switch is put back as it was found. */
export async function crouchrunCheck(): Promise<boolean> {
  const was = { ...CROUCHRUN }; allPass = true; found = CROUCHRUN.on;
  try { await staysAndHeard(); await standAndOff(); Object.assign(CROUCHRUN, was); await harness(); }
  finally { Object.assign(CROUCHRUN, was); }
  console.log(`\n=== crouchrun: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await crouchrunCheck()) ? 0 : 1);
