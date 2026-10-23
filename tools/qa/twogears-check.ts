// 'twogears' — TWO GEARS, NOT A DIAL (TWOGEARS, src/game/player.ts). The wheel's six notches of walking pace bought nothing a man sneaking could use: a footfall's
// level is the stance's × the floor's whatever the notch, and one notch down a crouched man no longer gains on a patrol. With the key up the wheel is nobody's
// pace and the crouch-walk is the sneak, at its own quicker pace, under the walk and over a patrol's.
//   bun run tools/qa/twogears-check.ts        (also `probes.ts twogears`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   wheel     the lobby's open floor, a notch of the wheel toward him every frame for ten frames. Key down: his pace comes down to the slowest notch and the
//             ticks are asked for. Key up: his pace is whole, and no ticks.
//   saved     a pace under the whole put on him by hand (a checkpoint from before, an older visit): key up, the next frame it is whole; key down, it stays.
//   paces     walked four seconds each on three seeds — crouched, standing, sprinting. Key up: the crouch-walk settles at TWOGEARS.crouch, which is over
//             tune.guardWalk and under tune.playerWalk; the walk and the sprint settle where they do with the key down (to a millimetre a second).
//   tail      a calm man walked away from him along the lobby at tune.guardWalk, Sam crouched two metres behind and holding the key toward him: the
//             seconds until he is inside the grab's reach. Key up: under four and a half. Key down: over five and a half, and more than half as long
//             again (from the close-in mode's edge, three metres, the same paces make it about six and a half seconds against thirteen).
//   ears      the same crouched walk: every footfall filed is at the level the key down files (the sneak is quicker, not louder a step).
//   off       four seconds of each walk with the key down digest as the same four seconds on a stand that never heard of the key (the table left as the
//             module has it): off is the build.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?twogears=0` puts it off), rides a
//             recording's tables, and a recording from before it replays with it off.
// TWOGEARS_BREAK=1 = the key left down where `wheel`, `saved`, `paces` and `tail` ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { TWOGEARS, FOOTFALL, PACE_MIN } = await import(`${ROOT}/src/game/player.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.TWOGEARS_BREAK === '1', DT = 1 / 60, START: P3 = [5.2, 0, 19.5], SEEDS = [4411, 1, 2], FWD = 'KeyD';   // (east along the lobby: some 17 m of clear floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
/** the key as a line asks for it: up where it wants it up — unless the break holds it down there */
const up = () => !BREAK;

interface Ctx { W: any; g: any; f: number; levels: number[]; step(): void; keys(...k: string[]): void; A: any; speed(): number }
/** the lobby's open floor with the floor's men parked far off and deaf; a walk is a key held and the cursor kept 4 m ahead of him */
async function world(on: boolean | null, seed: number): Promise<Ctx> {
  Math.random = seeded(seed); if (on !== null) TWOGEARS.on = on;
  const W: any = await quiet(() => standUp({ seed } as any)), g = W.game; if (on !== null) TWOGEARS.on = on;   // (the frozen stand's pin writes the key at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true;
  const [A, ...rest] = g.guards; for (const [i, gd] of [A, ...rest].entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...START]);
  const pl = g.player.char, seen = new Set<object>();
  const C: Ctx = { W, g, f: 0, levels: [], A, speed: () => Math.hypot(pl.vel[0], pl.vel[2]), keys: (...k) => { W.input.keys.clear(); for (const x of k) W.input.keys.add(x); }, step: () => {
    W.cursorAt([pl.pos[0] + 4, 1.0, pl.pos[2]]); W.step(DT); g.player.visibility = 0.02; C.f++;
    for (const e of g.events) if (e.kind === 'step' && !seen.has(e)) { seen.add(e); C.levels.push(e.level); }
  } };
  for (let i = 0; i < 30; i++) C.step();
  return C;
}
type Gait = 'crouch' | 'walk' | 'sprint';
/** four seconds of one gait: the settled speed (the last second's mean), the footfall levels filed, the digest at the end */
async function walked(on: boolean | null, gait: Gait, seed: number): Promise<{ v: number; levels: number[]; hash: string; pace: number }> {
  const C = await world(on, seed); C.g.player.crouch = gait === 'crouch'; C.levels.length = 0;
  C.keys(...(gait === 'sprint' ? [FWD, 'ShiftLeft'] : [FWD])); let sum = 0;
  for (let i = 0; i < 240; i++) { C.step(); if (i >= 180) sum += C.speed(); }
  return { v: sum / 60, levels: [...C.levels], hash: hashDigest(digestGame(C.g)), pace: C.g.player.pace };
}

async function wheel() {
  const run = async (on: boolean) => { const C = await world(on, SEEDS[0]); const pl = C.g.player; pl.paceShownT = -10; for (let i = 0; i < 10; i++) { C.W.input.wheel = 100; C.step(); } C.W.input.wheel = 0; return { pace: pl.pace as number, shown: C.g.time - pl.paceShownT < 2.5 }; };
  const off = await run(false), on = await run(up());
  verdict(Math.abs(off.pace - PACE_MIN) < 1e-9 && off.shown && on.pace === 1 && !on.shown, 'ten notches of the wheel toward him: with the key down his pace is at the slowest notch and its ticks are asked for; with it up his pace is whole and nothing is shown',
    `key down: pace ${f2(off.pace)}, ticks ${off.shown} · key up: pace ${f2(on.pace)}, ticks ${on.shown}`);
}
async function saved() {
  const run = async (on: boolean) => { const C = await world(on, SEEDS[0]); C.g.player.pace = 0.48; C.keys(FWD); C.step(); return C.g.player.pace as number; };
  const off = await run(false), on = await run(up());
  verdict(off === 0.48 && on === 1, 'a notch left on him by a checkpoint or an older visit: with the key up the next frame his pace is whole; with it down it stays', `key down ${f2(off)} · key up ${f2(on)}`);
}
async function paces() {
  const rows: string[] = []; let ok = true;
  for (const seed of SEEDS) {
    const c0 = await walked(false, 'crouch', seed), c1 = await walked(up(), 'crouch', seed), w0 = await walked(false, 'walk', seed), w1 = await walked(up(), 'walk', seed), s0 = await walked(false, 'sprint', seed), s1 = await walked(up(), 'sprint', seed);
    const T = (await world(null, seed)).g.tune;
    const good = Math.abs(c1.v - TWOGEARS.crouch) < 0.02 && c1.v > T.guardWalk + 0.2 && c1.v < w1.v - 0.05 && Math.abs(c0.v - T.playerCrouch) < 0.02 && Math.abs(w1.v - w0.v) < 1e-3 && Math.abs(s1.v - s0.v) < 1e-3;
    ok &&= good; rows.push(`seed ${seed}: crouch ${f3(c0.v)} → ${f3(c1.v)} · walk ${f3(w0.v)} → ${f3(w1.v)} · sprint ${f3(s0.v)} → ${f3(s1.v)}`);
  }
  verdict(ok, `the crouch-walk settles at the sneak's own pace (${TWOGEARS.crouch}), over a patrol's walk and under his own; the walk and the sprint are where they were`, rows.join('\n    '));
}
/** m: the gap the tail begins at — a metre short of the close-in mode's edge, so that the slower arm is still caught on this floor (at the patrol's pace the
 *  lobby is fifteen seconds long) */
const GAP = 2;
/** a calm man walked away along the lobby at the patrol's pace, Sam crouched GAP m behind holding the key toward him: seconds until he is in the grab's reach */
async function tailSecs(on: boolean, seed: number): Promise<number> {
  const C = await world(on, seed), g = C.g, A = C.A, pl = g.player.char, was = CLOSE.on; CLOSE.on = false;   // (the walk's own arithmetic: the close-in mode's stance is not what is timed)
  try {
    A.char.pos = [START[0] + GAP, 0, START[2]]; A.char.bodyYaw = A.char.aimYaw = Math.PI / 2; A.awareness = 0; A.pinned = true; g.player.crouch = true; C.keys(FWD);   // (pinned: he goes where the check walks him, his back to Sam)
    for (let i = 0; i < 1500; i++) {
      A.char.pos[0] += g.tune.guardWalk * DT; C.step();
      if (A.char.pos[0] - pl.pos[0] <= CLOSE.reach.behind) return i * DT;
      if (A.char.pos[0] > 21) break;   // (the lobby's end: he was not caught on this floor)
    }
    return Infinity;
  } finally { CLOSE.on = was; }
}
async function tail() {
  const rows: string[] = []; let ok = true;
  for (const seed of SEEDS) { const off = await tailSecs(false, seed), on = await tailSecs(up(), seed); ok &&= on < 4.5 && off > 5.5 && off / on > 1.6; rows.push(`seed ${seed}: key down ${isFinite(off) ? f2(off) + ' s' : 'not on this floor'} · key up ${isFinite(on) ? f2(on) + ' s' : 'not on this floor'}`); }
  verdict(ok, 'crouched two metres behind a man walking away at a patrol\'s pace: with the key up he is in the grab\'s reach in under four and a half seconds; with it down it takes over five and a half, and more than half as long again', rows.join('\n    '));
}
async function ears() {
  const rows: string[] = []; let ok = true;
  for (const seed of SEEDS) {
    const a = await walked(false, 'crouch', seed), b = await walked(true, 'crouch', seed), la = new Set(a.levels.map(f3)), lb = new Set(b.levels.map(f3));
    const same = a.levels.length > 3 && b.levels.length > 3 && la.size === 1 && lb.size === 1 && [...la][0] === [...lb][0]; ok &&= same;
    rows.push(`seed ${seed}: key down ${a.levels.length} footfalls at ${[...la].join(' / ')} · key up ${b.levels.length} at ${[...lb].join(' / ')}`);
  }
  verdict(ok, 'the sneak is quicker, not louder a step: every crouched footfall is filed at the level the key down files it at', rows.join('\n    '));
}
async function off() {
  const rows: string[] = []; let ok = true;
  for (const gait of ['crouch', 'walk', 'sprint'] as Gait[]) {
    const a = await walked(false, gait, SEEDS[0]); const keep = TWOGEARS.crouch; TWOGEARS.crouch = 9; const b = await walked(false, gait, SEEDS[0]); TWOGEARS.crouch = keep;   // (with the key down nothing of the table is read)
    ok &&= a.hash === b.hash; rows.push(`${gait}: ${a.hash} · ${b.hash}`);
  }
  verdict(ok, 'with the key down nothing of the table reaches the game: four seconds of each gait digest the same whatever the sneak\'s pace is set to', rows.join('\n    '));
}
async function harness() {
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_TWOGEARS, want = word !== undefined ? word === '1' : shipped;
  if (!shipped) TWOGEARS.on = !want; else TWOGEARS.on = found;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = TWOGEARS.on, foundOk = !shipped || word !== undefined || found === want;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = !!snap.tables.TWOGEARS && 'on' in snap.tables.TWOGEARS;
  TWOGEARS.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); TWOGEARS.on = false; JR.applyKnobs(W.game, snapUp); const kept = TWOGEARS.on;
  delete snap.tables.TWOGEARS; TWOGEARS.on = true; JR.applyKnobs(W.game, snap); const old = TWOGEARS.on;
  const read = (q: string) => { TWOGEARS.on = !TWOGEARS.on; PR.pageSwitches(new URLSearchParams(q)); return TWOGEARS.on; }, plainQ = read(''), offQ = read('twogears=0');
  verdict((STAND_ENV as string[]).includes('TPS_TWOGEARS') && PR.FROZEN_HOLDS['TWOGEARS.on'] === 'TPS_TWOGEARS=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && offQ === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?twogears=0',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_TWOGEARS')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['TWOGEARS.on']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?twogears=0 ${offQ}`);
}

/** the whole card (probes.ts 'twogears'): true = every check passed. The switches are put back as they were found. */
export async function twogearsCheck(): Promise<boolean> {
  const was = { ...TWOGEARS }, foot = { ...FOOTFALL }, close = { ...CLOSE }, rnd = Math.random; allPass = true; found = TWOGEARS.on;
  try { await wheel(); await saved(); await paces(); await tail(); await ears(); await off(); Object.assign(TWOGEARS, was); await harness(); }
  finally { Object.assign(TWOGEARS, was); Object.assign(FOOTFALL, foot); Object.assign(CLOSE, close); Math.random = rnd; }
  console.log(`\n=== twogears: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await twogearsCheck() ? 0 : 1);
