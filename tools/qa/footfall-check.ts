// 'footfall' — ONE FOOTFALL A STEP (FOOTFALL.once, src/game/player.ts). A footfall is filed when the walk cycle crosses its half or turns over. The cycle runs
// backwards while he backpedals, and backpedalling is decided from where he aims against where he goes: with the cursor at his own feet that flips frame by
// frame, the cycle rocks over one edge, and every frame of it filed a footfall (seven running in a scripted creep up to a man's back: seven crouched steps in
// a tenth of a second to the man's ears).
//   bun run tools/qa/footfall-check.ts        (also `probes.ts footfall`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   rock      crouched on the lobby's open floor, walking, and from the frame a footfall is filed the forward key and the back key by turns, a frame each,
//             for a third of a second (a scripted player hunting its mark; the drag's facing rule has no slack either). Key down: a footfall on five or
//             more frames running (the flaw). Key up: two at the most in that third of a second and no two of the whole run on frames next to each
//             other. On three seeds (the cycle starts each at another place).
//   walk      the same floor walked plainly — crouched, standing, sprinting, and backwards — for four seconds each, on three seeds: the key up files the
//             footfalls the key down does, frame for frame and level for level, and the two runs digest the same.
//   slow      the rocking kept up for ten seconds with legs of 2, 4 and 10 frames: the key up never files two footfalls nearer than a quarter of the
//             cycle, and no more than twice what a plain walk of the same ten seconds files (the legs ARE moving: it is not silence).
//   turns     what a first cut of the rule got wrong (it swallowed any edge crossed twice, however far he had been in between, and a pacing man walked
//             silent): forwards and backwards by turns of 30 and 50 frames, and a steady walk with the cursor put in front of him and behind him every
//             15, 25 and 35 frames — the key up files at least six in ten of what the key down does (its footfalls on frames running counted once).
//             What it loses are about-turns made within an eighth of the cycle of an edge.
//   held      the second place a footfall is filed, a man walked in the arm: the same rocking, the same two verdicts.
//   ears      a calm man a stride in front of EIGHT frames of rocking (the flaw as it was met: seven), his back to it: his awareness peaks higher with
//             the key down than with it up.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?footfallonce=0` puts it off), rides a
//             recording's tables, a recording from before it replays with it off, and a checkpoint carries the travel only once the key has been on.
// FOOTFALL_BREAK=1 = the key left down where `rock`, `held` and `ears` ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { FOOTFALL, startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { saveState } = await import(`${ROOT}/src/game/savestate.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.FOOTFALL_BREAK === '1', DT = 1 / 60, START: P3 = [5.2, 0, 19.5], SEEDS = [4411, 1, 2], FWD = 'KeyD', BACK = 'KeyA';   // (east along the lobby: some 17 m of clear floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Fall { f: number; level: number }
interface Ctx { W: any; g: any; f: number; falls: Fall[]; step(aim: 'ahead' | 'behind' | P3): void; keys(...k: string[]): void; A: any; moved(): number }
/** the lobby's open floor, the floor's men parked far off but one (`near`: stood 1.8 m in front of where the walk begins, his back to it); a walk is keys held
 *  and the cursor put 4 m ahead of his travel, 4 m behind it, or on a point, each frame. Every footfall filed is noted with the frame it was filed on. */
async function world(once: boolean, crouch: boolean, seed: number, near = false): Promise<Ctx> {
  Math.random = seeded(seed); const W: any = await quiet(() => standUp({ seed } as any)), g = W.game; FOOTFALL.once = once;
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true;
  const [A, ...rest] = g.guards; rest.forEach((gd: any, i: number) => { gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; });
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...START]); g.player.crouch = crouch;
  const pl = g.player.char, seen = new Set<object>(); let path = 0, last = [...pl.pos];
  const C: Ctx = { W, g, f: 0, falls: [], A, moved: () => path, keys: (...k) => { W.input.keys.clear(); for (const x of k) W.input.keys.add(x); }, step: aim => {
    const v = pl.vel, sp = Math.hypot(v[0], v[2]), d = sp > 0.05 ? [v[0] / sp, v[2] / sp] : [1, 0], k = aim === 'ahead' ? 4 : -4;
    W.cursorAt(typeof aim === 'string' ? [pl.pos[0] + d[0] * k, 1.0, pl.pos[2] + d[1] * k] : aim); W.step(DT); g.player.visibility = 0.02; C.f++;
    path += Math.hypot(pl.pos[0] - last[0], pl.pos[2] - last[2]); last = [...pl.pos];
    for (const e of g.events) if (e.kind === 'step' && !seen.has(e)) { seen.add(e); C.falls.push({ f: C.f, level: e.level }); }
  } };
  A.char.pos = near ? [START[0] + 1.8, 0, START[2]] : [37.5, 0, 4.5]; A.char.bodyYaw = A.char.aimYaw = Math.PI / 2; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; if (!near) A.heardUpTo = 1e12;
  for (let i = 0; i < 30; i++) C.step([START[0] + 5, 1.0, START[2]]);
  return C;
}
/** the longest run of footfalls on frames next to each other, and the footfalls with each such run counted once */
const longest = (F: Fall[]) => { let best = F.length ? 1 : 0, run = 1; for (let i = 1; i < F.length; i++) { run = F[i].f === F[i - 1].f + 1 ? run + 1 : 1; best = Math.max(best, run); } return best; };
const apart = (F: Fall[]) => F.filter((x, i) => i === 0 || x.f - F[i - 1].f >= 2).length;
const leastGap = (F: Fall[]) => F.reduce((m, x, i) => i ? Math.min(m, x.f - F[i - 1].f) : m, 1e9);
/** walk until a footfall is filed (the cycle has just crossed an edge), then `n` frames of the forward key and the back key by turns with the cursor where
 *  it was (a scripted player hunting its mark does exactly this: it is how the flaw was met) */
function rockRun(C: Ctx, n: number, after = 90, fwd = FWD, back = BACK, leg = 1): { from: number; inRock: number; at: P3 } {
  C.keys(fwd); let from = -1;
  for (let i = 0; i < 240 && from < 0; i++) { const had = C.falls.length; C.step('ahead'); if (i > 40 && C.falls.length > had) from = C.f; }
  const pl = C.g.player.char, v = pl.vel, sp = Math.hypot(v[0], v[2]) || 1, far: P3 = [pl.pos[0] + v[0] / sp * 5, 1.0, pl.pos[2] + v[2] / sp * 5];
  const at = [...pl.pos]; for (let i = 0; i < n; i++) { C.keys(Math.floor(i / leg) % 2 ? fwd : back); C.step(far); }
  const inRock = C.falls.filter(x => x.f > from && x.f <= from + n).length;
  if (after > 0) C.keys(fwd); else C.keys(); for (let i = 0; i < Math.abs(after); i++) C.step(far);
  return { from, inRock, at };
}
async function rock() {
  console.log('\n=== rock: forwards and backwards by turns, a frame each, at an edge of the cycle ===');
  const rows: string[] = []; let flaw = 0, mended = 0;
  for (const seed of SEEDS) {
    const off = await world(false, true, seed), a = rockRun(off, 20), on = await world(!BREAK, true, seed), b = rockRun(on, 20);
    if (a.from > 0 && longest(off.falls) >= 5 && a.inRock >= 5) flaw++;
    if (b.from > 0 && b.inRock <= 2 && longest(on.falls) <= 1 && on.falls.length >= 4) mended++;
    rows.push(`seed ${seed}: key down ${a.inRock} footfalls in the 20 frames of it, ${longest(off.falls)} frames running, ${off.falls.length} in the run · key up ${b.inRock}, ${longest(on.falls)} running, ${on.falls.length} in the run`);
  }
  verdict(flaw === SEEDS.length, '(the flaw) key down: a footfall on five or more frames running, on every seed', rows.join('\n    '));
  verdict(mended === SEEDS.length, 'key up: two footfalls at the most in that third of a second, no two of the run on frames next to each other, and he still treads before and after', `${mended} of ${SEEDS.length} seeds`);
}
async function slow() {
  console.log('\n=== slow: the rocking kept up for ten seconds ===');
  const base = (await plain(true, true, [FWD], 'ahead', SEEDS[0], 630)).falls.filter(x => x.f > 60).length, rows: string[] = []; let bad = 0;
  for (const leg of [2, 4, 10]) {
    const off = await world(false, true, SEEDS[0]), a = rockRun(off, 600, 0, FWD, BACK, leg), on = await world(true, true, SEEDS[0]), b = rockRun(on, 600, 0, FWD, BACK, leg);
    const F = on.falls.filter(x => x.f > b.from), gap = leastGap(F);
    if (!(a.inRock >= 2 * b.inRock && b.inRock <= 2 * base && b.inRock >= 4 && gap >= 12)) bad++;
    rows.push(`legs of ${leg} frames: ${a.inRock} footfalls key down, ${b.inRock} key up, never nearer than ${gap} frames (a plain walk of the ten seconds: ${base})`);
  }
  verdict(bad === 0, 'ten seconds of rocking with legs of 2, 4 and 10 frames: the key up files half the key down\'s footfalls or fewer, never two nearer than 12 frames, no more than twice a plain walk\'s, and not none', rows.join('\n    '));
}
async function plain(once: boolean, crouch: boolean, keys: string[], aim: 'ahead' | 'behind', seed: number, frames = 240) {
  const C = await world(once, crouch, seed); C.keys(...keys); let d = '';
  for (let i = 0; i < frames; i++) { C.step(aim); if (i % 30 === 29) d += hashDigest(digestGame(C.g, true)) + ' '; }
  return { falls: C.falls, d, travel: C.g.player.stepTravel as number, m: C.moved() };
}
async function walk() {
  console.log('\n=== walk: a plain walk files what it always did ===');
  const rows: string[] = []; let bad = 0;
  for (const seed of SEEDS) for (const [name, crouch, keys, aim] of [['crouched', true, [FWD], 'ahead'], ['standing', false, [FWD], 'ahead'], ['sprinting', false, [FWD, 'ShiftLeft'], 'ahead'], ['backwards', false, [FWD], 'behind']] as [string, boolean, string[], 'ahead' | 'behind'][]) {
    const a = await plain(false, crouch, keys, aim, seed), b = await plain(true, crouch, keys, aim, seed);
    const same = a.falls.length === b.falls.length && a.falls.every((x, i) => x.f === b.falls[i].f && x.level === b.falls[i].level);
    if (!(same && a.d === b.d && a.falls.length >= 3 && a.travel === 1 && a.m > 2)) bad++;
    rows.push(`seed ${seed} ${name}: ${a.falls.length} footfalls key down, ${b.falls.length} key up over ${a.m.toFixed(1)} m, ${same ? 'the same frames and levels' : 'DIFFERENT'} · digests ${a.d === b.d ? 'equal' : 'DIFFER'} · the travel kept ${a.travel} / ${b.travel.toFixed(2)}`);
  }
  verdict(bad === 0, 'crouched, standing, sprinting and backwards, four seconds each on three seeds: the key up files the key down\'s footfalls frame for frame and level for level, the runs digest the same, and the key down keeps no travel', rows.join('\n    '));
}
async function turns() {
  console.log('\n=== turns: pacing, and the cursor across him, are not a silent walk ===');
  const rows: string[] = []; let bad = 0;
  const pace = async (once: boolean, crouch: boolean, leg: number) => { const C = await world(once, crouch, SEEDS[0]); const far: P3 = [START[0] + 12, 1.0, START[2]]; for (let i = 0; i < 600; i++) { C.keys(Math.floor(i / leg) % 2 ? BACK : FWD); C.step(far); } return C; };
  const wave = async (once: boolean, crouch: boolean, every: number) => { const C = await world(once, crouch, SEEDS[0]); C.keys(FWD); for (let i = 0; i < 480; i++) C.step(Math.floor(i / every) % 2 ? 'behind' : 'ahead'); return C; };
  for (const [name, run] of [['pacing 30 frames a leg, crouched', (o: boolean) => pace(o, true, 30)], ['pacing 50, crouched', (o: boolean) => pace(o, true, 50)], ['pacing 40, standing', (o: boolean) => pace(o, false, 40)],
    ['the cursor across him every 15 frames, crouched', (o: boolean) => wave(o, true, 15)], ['every 25, crouched', (o: boolean) => wave(o, true, 25)], ['every 35, standing', (o: boolean) => wave(o, false, 35)]] as [string, (o: boolean) => Promise<Ctx>][]) {
    const a = await run(false), b = await run(true), want = apart(a.falls);
    if (!(b.falls.length >= Math.ceil(want * 0.6) && want >= 4 && longest(b.falls) <= 1)) bad++;
    rows.push(`${name}: ${a.falls.length} footfalls key down (${want} with frames running counted once), ${b.falls.length} key up, over ${a.moved().toFixed(1)} m of path`);
  }
  verdict(bad === 0, 'forwards and backwards by turns, and a walk with the cursor put in front of him and behind him: the key up files at least six in ten of the key down\'s footfalls (frames running counted once), none on frames running', rows.join('\n    '));
}
async function held() {
  console.log('\n=== held: a man walked in the arm (the second place a footfall is filed) ===');
  const run = async (once: boolean) => {
    const C = await world(false, true, SEEDS[0], true), g = C.g, A = C.A; CLOSE.on = true; A.pinned = true;
    g.teleportPlayer([A.char.pos[0] - 0.8, 0, A.char.pos[2]]); for (let i = 0; i < 40; i++) C.step([A.char.pos[0], 1.2, A.char.pos[2]]);
    startGrab(g, A); for (let i = 0; i < 90; i++) C.step([A.char.pos[0] + 3, 1.2, A.char.pos[2]]);
    const holding = !!g.player.holding; FOOTFALL.once = once; C.falls.length = 0;
    const R = rockRun(C, 20, 200, BACK, FWD); return { holding, R, falls: C.falls.slice(), still: !!g.player.holding, after: C.falls.filter(x => x.f > R.from + 20).length };
  };
  const a = await run(false), b = await run(!BREAK);
  verdict(a.holding && a.still && a.R.from > 0 && a.R.inRock >= 5 && longest(a.falls) >= 5, '(the flaw) key down, a man in the arm: a footfall on five or more frames running', `holding ${a.holding}, still at the end ${a.still} · ${a.R.inRock} footfalls in the 20 frames of it, ${longest(a.falls)} running, ${a.falls.length} in the walk`);
  verdict(b.holding && b.still && b.R.from > 0 && b.R.inRock <= 2 && longest(b.falls) <= 1 && b.after >= 2 && b.after === a.after, 'key up: two at the most, none on frames running, and the walk after it treads as it does with the key down', `holding ${b.holding}, still at the end ${b.still} · ${b.R.inRock} footfalls in the 20 frames of it, ${longest(b.falls)} running · in the walk after it ${b.after} (key down ${a.after})`);
}
async function ears() {
  console.log('\n=== ears: a calm man a stride in front of eight frames of it ===');
  const run = async (once: boolean) => { const C = await world(once, true, SEEDS[0], true); C.g.aiEnabled = true; C.g.playerInvisible = false; let peak = 0; const st = C.step; C.step = a => { st(a); peak = Math.max(peak, C.A.awareness); };
    const R = rockRun(C, 8, -45); return { peak, state: C.A.state as string, n: R.inRock, d: Math.hypot(R.at[0] - C.A.char.pos[0], R.at[2] - C.A.char.pos[2]) }; };
  const a = await run(false), b = await run(!BREAK);
  verdict(b.n <= 1 && a.n >= 5 && a.peak > b.peak + 0.02 && a.d < 1.6 && Math.abs(a.d - b.d) < 1e-9, 'a calm man with his back to it, a stride in front: eight frames of rocking are in his ears with the key down, and are not with it up', `key down: ${a.n} footfalls in it ${a.d.toFixed(2)} m behind him, his awareness peaks ${a.peak.toFixed(3)}, he ends ${a.state} · key up: ${b.n} at ${b.d.toFixed(2)} m, peak ${b.peak.toFixed(3)}, ${b.state}`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, in a recording and in a checkpoint ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_FOOTFALL, want = word !== undefined ? word === '1' : shipped;
  if (!shipped) FOOTFALL.once = !want; else FOOTFALL.once = found;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = FOOTFALL.once, foundOk = !shipped || word !== undefined || found === want;   // (what the card found is the page's boot only on the page's stand)
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = !!snap.tables.FOOTFALL && 'once' in snap.tables.FOOTFALL;
  FOOTFALL.once = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); FOOTFALL.once = false; JR.applyKnobs(W.game, snapUp); const kept = FOOTFALL.once;
  delete snap.tables.FOOTFALL; FOOTFALL.once = true; JR.applyKnobs(W.game, snap); const old = FOOTFALL.once;
  const read = (q: string) => { FOOTFALL.once = !FOOTFALL.once; PR.pageSwitches(new URLSearchParams(q)); return FOOTFALL.once; }, plainQ = read(''), off = read('footfallonce=0');
  W.game.player.stepTravel = 1; const s0 = JSON.stringify(saveState(W.game)).includes('"stepTravel"'); W.game.player.stepTravel = 0.125; const S2 = saveState(W.game), s2 = JSON.stringify(S2).includes('"stepTravel":0.125'); W.game.player.stepTravel = 1; W.restore(S2); const back = W.game.player.stepTravel;
  verdict((STAND_ENV as string[]).includes('TPS_FOOTFALL') && PR.FROZEN_HOLDS['FOOTFALL.once'] === 'TPS_FOOTFALL=1' && stood === want && foundOk && had && kept === true && old === false && plainQ === true && off === false && !s0 && s2 && back === 0.125,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, the page\'s boot writes it on for a plain address and off for ?footfallonce=0, and a checkpoint carries the travel only once the key has been on and gives it back',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_FOOTFALL')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['FOOTFALL.once']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?footfallonce=0 ${off} · a checkpoint of a man who has never had the key names the travel ${s0}, one who has ${s2}, given back ${back}`);
}

/** the whole card (probes.ts 'footfall'): true = every check passed. The switches are put back as they were found. */
export async function footfallCheck(): Promise<boolean> {
  const was = { ...FOOTFALL }, close = { ...CLOSE }, rnd = Math.random; allPass = true; found = FOOTFALL.once;
  try { await rock(); await slow(); await walk(); await turns(); await held(); await ears(); Object.assign(FOOTFALL, was); Object.assign(CLOSE, close); await harness(); }
  finally { Object.assign(FOOTFALL, was); Object.assign(CLOSE, close); Math.random = rnd; }
  console.log(`\n=== footfall: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await footfallCheck() ? 0 : 1);
